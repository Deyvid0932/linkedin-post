import copy
import json
import sys
import os
import tempfile
import unittest
from pathlib import Path
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError
from unittest.mock import Mock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import publish_queue as runner

AUTHOR = "urn:li:person:audit"
NOW = datetime(2026, 10, 4, 15, tzinfo=timezone.utc)
POST = {"id": "12345678-1234-1234-1234-123456789012", "text": "Reviewed real content", "approved": True,
        "publishAt": NOW.isoformat(), "imageDataUrl": None}


class Store:
    def __init__(self, fail_at=0):
        self.saved = []
        self.fail_at = fail_at

    def save(self, state):
        if len(self.saved) + 1 == self.fail_at:
            raise RuntimeError("Storage unavailable")
        self.saved.append(copy.deepcopy(state))


class QueueSafetyTest(unittest.TestCase):
    def test_queue_uses_repository_timezone_when_environment_variable_is_missing(self):
        with tempfile.TemporaryDirectory() as directory:
            previous = Path.cwd()
            os.chdir(directory)
            try:
                Path("automation").mkdir()
                Path("automation/autopost-config.json").write_text(json.dumps({"timezone": "Europe/Madrid"}), encoding="utf-8")
                with patch.dict(os.environ, {"PUBLICATION_TIMEZONE": ""}), patch.object(runner, "ZoneInfo", side_effect=lambda value: value):
                    self.assertEqual("Europe/Madrid", str(runner.publication_timezone()))
            finally:
                os.chdir(previous)

    def test_rejects_unapproved_wrong_account_and_remote_images(self):
        for post, author in [({**POST, "approved": False}, AUTHOR), (POST, "urn:li:person:other"),
                             ({**POST, "imageDataUrl": "http://127.0.0.1/private"}, AUTHOR)]:
            with self.assertRaises(ValueError):
                runner.validate_queue({"version": 1, "authorUrn": AUTHOR, "posts": [post]}, author)

    def test_due_window_and_quota(self):
        state = {"receipts": {}}
        zone = timezone(timedelta(hours=-5))
        self.assertEqual(POST, runner.choose_due([POST], state, AUTHOR, NOW, zone, 1))
        self.assertIsNone(runner.choose_due([POST], state, AUTHOR, NOW - timedelta(minutes=1), zone, 1))
        self.assertIsNone(runner.choose_due([POST], state, AUTHOR, NOW + timedelta(hours=25), zone, 1))
        state["receipts"]["other"] = {"authorUrn": AUTHOR, "attemptedAt": NOW.isoformat()}
        self.assertIsNone(runner.choose_due([POST], state, AUTHOR, NOW, zone, 1))

    def test_persists_claim_before_send(self):
        store, state = Store(), {"receipts": {}}
        def send(*args):
            self.assertEqual("SENDING", store.saved[0]["receipts"][POST["id"]]["status"])
            return "urn:li:share:actual"
        runner.execute(POST, state, store, AUTHOR, NOW, send)
        self.assertEqual("SUCCESS", store.saved[-1]["receipts"][POST["id"]]["status"])

    def test_no_external_request_when_claim_cannot_be_saved(self):
        from unittest.mock import Mock
        sender = Mock()
        with self.assertRaises(RuntimeError):
            runner.execute(POST, {"receipts": {}}, Store(fail_at=1), AUTHOR, NOW, sender)
        sender.assert_not_called()

    def test_unknown_attempt_never_retried_and_edited_id_rejected(self):
        store, state = Store(), {"receipts": {}}
        def timeout(*args):
            raise TimeoutError()
        with self.assertRaises(RuntimeError):
            runner.execute(POST, state, store, AUTHOR, NOW, timeout)
        self.assertEqual("UNKNOWN", state["receipts"][POST["id"]]["status"])
        self.assertIsNone(runner.choose_due([POST], state, AUTHOR, NOW, timezone(timedelta(hours=-5)), 5))
        with self.assertRaises(ValueError):
            runner.choose_due([{**POST, "text": "Changed after send"}], state, AUTHOR, NOW, timezone(timedelta(hours=-5)), 5)

    def test_success_receipt_failure_leaves_durable_sending(self):
        store = Store(fail_at=2)
        with self.assertRaises(RuntimeError):
            runner.execute(POST, {"receipts": {}}, store, AUTHOR, NOW, lambda *args: "urn:li:share:actual")
        self.assertEqual("SENDING", store.saved[0]["receipts"][POST["id"]]["status"])

    def test_github_receipt_commit_uses_loaded_head_and_fast_forward_only(self):
        store = runner.GitHubState.__new__(runner.GitHubState)
        store.api = "https://api.github.com/repos/owner/repo"
        store.branch = "main"
        store.headers = {"Authorization": "Bearer token"}
        store.head = "head-before-send"
        store.tree = "tree-before-send"
        responses = [{"sha": "blob-receipt"}, {"sha": "tree-with-receipt"}, {"sha": "commit-with-receipt"}]
        calls = []

        def fake_request(url, method="GET", body=None, headers=None):
            calls.append((url, method, body))
            if method == "PATCH":
                return {}, b"{}"
            return {}, json.dumps(responses.pop(0)).encode()

        with patch.object(runner, "request", side_effect=fake_request):
            store.save({"version": 1, "receipts": {POST["id"]: {"status": "SENDING"}}})

        commit_request = next(body for _, method, body in calls if method == "POST" and body.get("parents"))
        ref_request = next(body for _, method, body in calls if method == "PATCH")
        self.assertEqual(["head-before-send"], commit_request["parents"])
        self.assertEqual({"sha": "commit-with-receipt", "force": False}, ref_request)
        self.assertEqual("commit-with-receipt", store.head)

    def test_runner_aborts_before_linkedin_if_branch_revision_changed(self):
        store = runner.GitHubState.__new__(runner.GitHubState)
        store.api = "https://api.github.com/repos/owner/repo"
        store.branch = "main"
        store.headers = {"Authorization": "Bearer token"}
        store.head = "stale-head"
        store.tree = "stale-tree"
        sender = Mock()

        def conflict(url, method="GET", body=None, headers=None):
            if method == "PATCH":
                raise HTTPError(url, 422, "reference moved", {}, None)
            if url.endswith("/git/blobs"):
                return {}, b'{"sha":"blob"}'
            if url.endswith("/git/trees"):
                return {}, b'{"sha":"tree"}'
            if url.endswith("/git/commits"):
                return {}, b'{"sha":"commit"}'
            raise AssertionError("Unexpected GitHub API call")

        with patch.object(runner, "request", side_effect=conflict):
            with self.assertRaises(HTTPError):
                runner.execute(POST, {"receipts": {}}, store, AUTHOR, NOW, sender)
        sender.assert_not_called()


if __name__ == "__main__":
    unittest.main()
