import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch, MagicMock
import urllib.error

spec = importlib.util.spec_from_file_location("runner", Path(__file__).parents[1] / "run_due_publications.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class RunnerTests(unittest.TestCase):
    def test_rejects_insecure_or_credentialed_origins_without_network(self):
        for origin in ("http://host", "https://user:pass@host", "https://host/path", "https://host?q=x", ""):
            with self.subTest(origin=origin), patch("urllib.request.build_opener") as opener:
                with self.assertRaises(ValueError):
                    runner.run(origin, "x" * 32)
                opener.assert_not_called()

    def test_no_redirect_can_forward_the_automation_secret(self):
        handler = runner.NoRedirect()
        self.assertIsNone(handler.redirect_request(None, None, 302, "", {}, "https://other-host"))

    def test_run_uses_only_backend_endpoint_and_bounded_timeout(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"processed":1,"published":1,"reviewRequired":0}'
        opener = MagicMock()
        opener.open.return_value = response
        with patch("urllib.request.build_opener", return_value=opener):
            result = runner.run("https://example.test", "x" * 32)
        req = opener.open.call_args.args[0]
        self.assertEqual(req.full_url, "https://example.test/api/v1/automation/run-due")
        self.assertEqual(req.get_method(), "POST")
        self.assertEqual(opener.open.call_args.kwargs["timeout"], 150)
        self.assertEqual(result["published"], 1)


if __name__ == "__main__":
    unittest.main()
