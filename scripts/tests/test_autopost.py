import base64
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch


spec = importlib.util.spec_from_file_location("autopost", Path(__file__).parents[1] / "autopost.py")
autopost = importlib.util.module_from_spec(spec)
spec.loader.exec_module(autopost)


class AutoPostTests(unittest.TestCase):
    def test_image_prompt_uses_the_actual_post_as_context(self):
        topic = {"title": "PostgreSQL indexes", "context": "A technical discussion"}
        with patch.object(autopost, "deepseek", return_value="A focused editorial image about query plans") as generate:
            prompt = autopost.image_prompt(topic, "The post explains when partial indexes help.", "key")

        self.assertEqual(prompt, "A focused editorial image about query plans")
        messages = generate.call_args.args[0]
        self.assertIn("The post explains when partial indexes help.", messages[1]["content"])
        self.assertIn("not generic technology", messages[0]["content"])

    def test_image_generation_uses_configured_model_and_decodes_base64(self):
        image = b"x" * 1500
        response = MagicMock()
        response.json.return_value = {"data": [{"b64_json": base64.b64encode(image).decode()}]}
        with patch.dict("os.environ", {"NANOGPT_IMAGE_MODEL": "google/gemini-nano-banana-2.1"}, clear=False), \
                patch.object(autopost.HTTP, "post", return_value=response) as request:
            result = autopost.image_bytes("specific editorial prompt", "secret")

        payload = request.call_args.kwargs["json"]
        self.assertEqual(payload["model"], "google/gemini-nano-banana-2.1")
        self.assertEqual(payload["prompt"], "specific editorial prompt")
        self.assertEqual(payload["resolution"], "1k")
        self.assertEqual(payload["aspect_ratio"], "1:1")
        self.assertNotIn("size", payload)
        self.assertEqual(result, image)

    def test_image_generation_uses_repository_model_over_the_environment_default(self):
        response = MagicMock()
        response.json.return_value = {"data": [{"b64_json": base64.b64encode(b"x" * 1500).decode()}]}
        with patch.dict("os.environ", {"NANOGPT_IMAGE_MODEL": "gpt-image-2"}, clear=False), \
                patch.object(autopost.HTTP, "post", return_value=response) as request:
            autopost.image_bytes("prompt", "secret", {"imageModel": "nano-banana-pro"})

        self.assertEqual(request.call_args.kwargs["json"]["model"], "nano-banana-pro")

    def test_nano_banana_2_fast_uses_its_supported_default_resolution(self):
        response = MagicMock()
        response.json.return_value = {"data": [{"b64_json": base64.b64encode(b"x" * 1500).decode()}]}
        with patch.dict("os.environ", {"NANOGPT_IMAGE_RESOLUTION": ""}, clear=False), \
                patch.object(autopost.HTTP, "post", return_value=response) as request:
            autopost.image_bytes("prompt", "secret", {"imageModel": "nano-banana-2-fast"})

        self.assertEqual(request.call_args.kwargs["json"]["resolution"], "2k")

    def test_post_generation_applies_repository_prompt_and_character_limit(self):
        topic = {"title": "Signals", "context": "Context", "url": "https://example.com"}
        config = {"prompt": "Escribe para backend Java, en tono cercano.", "targetCharacters": 120}
        with patch.object(autopost, "deepseek", return_value="Una idea técnica breve." ) as generate:
            result = autopost.post_text(topic, "key", config)
        self.assertEqual(result, "Una idea técnica breve.")
        self.assertIn("backend Java", generate.call_args.args[0][0]["content"])
        self.assertIn("hasta 120 caracteres", generate.call_args.args[0][0]["content"])

        with patch.object(autopost, "deepseek", return_value="x" * 121):
            with self.assertRaisesRegex(RuntimeError, "supera el límite"):
                autopost.post_text(topic, "key", config)

    def test_large_github_file_uses_raw_download_when_contents_api_omits_content(self):
        metadata = MagicMock()
        metadata.status_code = 200
        metadata.ok = True
        metadata.json.return_value = {"content": "", "sha": "abc123"}
        raw = MagicMock()
        raw.status_code = 200
        raw.ok = True
        raw.content = b'{"version": 1, "posts": []}'
        with patch.dict("os.environ", {"GITHUB_REPOSITORY": "owner/repo", "QUEUE_BRANCH": "main", "GITHUB_TOKEN": "token"}), \
                patch.object(autopost.HTTP, "get", side_effect=[metadata, raw]) as request:
            data, sha = autopost._github_file("automation/review.json")

        self.assertEqual(data, {"version": 1, "posts": []})
        self.assertEqual(sha, "abc123")
        self.assertEqual(request.call_args.kwargs["headers"]["Accept"], "application/vnd.github.raw")

    def test_empty_model_variable_falls_back_to_quality_default(self):
        response = MagicMock()
        response.json.return_value = {"data": [{"b64_json": base64.b64encode(b"x" * 1500).decode()}]}
        with patch.dict("os.environ", {"NANOGPT_IMAGE_MODEL": ""}, clear=False), \
                patch.object(autopost.HTTP, "post", return_value=response) as request:
            autopost.image_bytes("prompt", "secret")

        self.assertEqual(request.call_args.kwargs["json"]["model"], "qwen-image-2.1/text-to-image")
        self.assertEqual(request.call_args.kwargs["json"]["size"], "1024x1024")
        self.assertEqual(request.call_args.args[0], "https://api.nano-gpt.com/v1/images/generations")

    def test_preview_image_is_saved_only_to_the_requested_path(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "review" / "preview.png"
            with patch.dict("os.environ", {"AUTOPOST_PREVIEW_PATH": str(output)}, clear=False):
                autopost.save_preview_image(b"preview-image")
            self.assertEqual(output.read_bytes(), b"preview-image")


if __name__ == "__main__":
    unittest.main()
