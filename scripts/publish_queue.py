"""Publish reviewed exports with durable GitHub receipts; no server or third-party packages."""
import base64
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, build_opener, HTTPRedirectHandler
from zoneinfo import ZoneInfo
from urllib.parse import quote


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def request(url, method="GET", body=None, headers=None):
    data = body if isinstance(body, bytes) else json.dumps(body).encode() if body is not None else None
    with build_opener(NoRedirect).open(Request(url, data=data, method=method, headers=headers or {}), timeout=60) as response:
        return response.headers, response.read(75 * 1024 * 1024)


def read_image(value):
    if not value:
        return None
    match = re.fullmatch(r"data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)", value)
    if not match:
        raise ValueError("Las imágenes deben estar adjuntas, no ser URLs externas")
    data = base64.b64decode(match[2], validate=True)
    signatures = {"png": data.startswith(b"\x89PNG\r\n\x1a\n"), "jpeg": data.startswith(b"\xff\xd8\xff")}
    if not data or len(data) > 5 * 1024 * 1024 or not signatures[match[1]]:
        raise ValueError("Imagen no válida o superior a 5 MB")
    return data


def validate_queue(queue, author):
    if queue.get("version") != 1 or queue.get("authorUrn") != author or not re.fullmatch(r"urn:li:(person|organization):[A-Za-z0-9_-]+", author):
        raise ValueError("La cuenta de destino no coincide con LINKEDIN_AUTHOR_URN")
    posts = queue.get("posts")
    if not isinstance(posts, list) or len(posts) > 100:
        raise ValueError("La cola debe tener hasta 100 posts")
    seen = set()
    for post in posts:
        if not isinstance(post, dict) or post.get("approved") is not True:
            raise ValueError("Hay contenido sin aprobar")
        identifier = post.get("id", "")
        if not re.fullmatch(r"[a-fA-F0-9-]{36}", identifier) or identifier in seen:
            raise ValueError("Identificador no válido o duplicado")
        seen.add(identifier)
        text = post.get("text", "")
        if not isinstance(text, str) or not text.strip() or len(text.encode("utf-16-le")) // 2 > 3000:
            raise ValueError("El texto debe contener entre 1 y 3000 caracteres")
        date = datetime.fromisoformat(post["publishAt"].replace("Z", "+00:00"))
        if date.tzinfo is None:
            raise ValueError("La fecha debe incluir zona horaria")
        read_image(post.get("imageDataUrl"))
    return sorted(posts, key=lambda post: datetime.fromisoformat(post["publishAt"].replace("Z", "+00:00")))


def fingerprint(post, author):
    # IDs are immutable receipts. Editing a previously attempted export must require review.
    content = {"author": author, "text": post["text"], "image": post.get("imageDataUrl")}
    return hashlib.sha256(json.dumps(content, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def choose_due(posts, state, author, now, zone, daily_limit):
    receipts = state.get("receipts", {})
    today = now.astimezone(zone).date()
    reserved = sum(1 for receipt in receipts.values() if receipt["authorUrn"] == author
                   and datetime.fromisoformat(receipt["attemptedAt"]).astimezone(zone).date() == today)
    if reserved >= daily_limit:
        return None
    for post in posts:
        receipt = receipts.get(post["id"])
        if receipt:
            if receipt["fingerprint"] != fingerprint(post, author):
                raise ValueError("Se modificó un post ya intentado: revisa los recibos antes de usar un ID nuevo")
            continue
        scheduled = datetime.fromisoformat(post["publishAt"].replace("Z", "+00:00"))
        if now - timedelta(hours=24) <= scheduled <= now:
            return post
    return None


def publication_timezone():
    value = os.getenv("PUBLICATION_TIMEZONE")
    if not value:
        config_path = Path("automation/autopost-config.json")
        if config_path.exists():
            value = json.loads(config_path.read_text(encoding="utf-8")).get("timezone")
    return ZoneInfo(value or "America/Lima")


class GitHubState:
    def __init__(self):
        repo = os.environ["GITHUB_REPOSITORY"]
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
            raise ValueError("Repositorio no válido")
        self.api = f"https://api.github.com/repos/{repo}"
        self.branch = os.environ["QUEUE_BRANCH"]
        self.headers = {"Authorization": "Bearer " + os.environ["GITHUB_TOKEN"], "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json"}
        if not re.fullmatch(r"[A-Za-z0-9._/-]+", self.branch) or ".." in self.branch:
            raise ValueError("Rama de cola no válida")
        self.head = None
        self.tree = None

    def _json(self, url, method="GET", body=None):
        _, data = request(url, method, body, self.headers)
        return json.loads(data) if data else {}

    def _load_commit(self):
        ref = self._json(self.api + "/git/ref/heads/" + quote(self.branch, safe="/"))
        self.head = ref["object"]["sha"]
        commit = self._json(self.api + "/git/commits/" + self.head)
        self.tree = commit["tree"]["sha"]

    def _blob_at(self, path):
        parts = path.split("/")
        root = self._json(self.api + "/git/trees/" + self.tree)
        directory = next((entry for entry in root.get("tree", []) if entry["path"] == parts[0] and entry["type"] == "tree"), None)
        if not directory:
            return None
        nested = self._json(self.api + "/git/trees/" + directory["sha"])
        entry = next((item for item in nested.get("tree", []) if item["path"] == parts[1] and item["type"] == "blob"), None)
        if not entry:
            return None
        return self._json(self.api + "/git/blobs/" + entry["sha"])

    @staticmethod
    def _decode_blob(blob):
        return json.loads(base64.b64decode(blob["content"])) if blob else None

    def load_queue_and_state(self, author):
        self._load_commit()
        queue = self._decode_blob(self._blob_at("automation/queue.json"))
        if queue is None:
            raise ValueError("No se encontró automation/queue.json en la rama configurada")
        state = self._decode_blob(self._blob_at("automation/state.json")) or {"version": 1, "receipts": {}}
        if state.get("version") != 1 or not isinstance(state.get("receipts"), dict):
            raise ValueError("Recibos no válidos")
        return queue, state

    def load(self):
        """Load only receipts from a single commit snapshot."""
        self._load_commit()
        state = self._decode_blob(self._blob_at("automation/state.json")) or {"version": 1, "receipts": {}}
        if state.get("version") != 1 or not isinstance(state.get("receipts"), dict):
            raise ValueError("Recibos no válidos")
        return state

    def _write(self, path, content, message):
        if not self.head or not self.tree:
            raise RuntimeError("No hay una revisión base; vuelve a cargar la cola")
        blob = self._json(self.api + "/git/blobs", "POST", {
            "content": base64.b64encode(content).decode(), "encoding": "base64"})
        tree = self._json(self.api + "/git/trees", "POST", {
            "base_tree": self.tree,
            "tree": [{"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]}]})
        commit = self._json(self.api + "/git/commits", "POST", {
            "message": message, "tree": tree["sha"], "parents": [self.head]})
        request(self.api + "/git/refs/heads/" + quote(self.branch, safe="/"), "PATCH",
                {"sha": commit["sha"], "force": False}, self.headers)
        self.head = commit["sha"]
        self.tree = tree["sha"]

    def save(self, state):
        self._write("automation/state.json", json.dumps(state, indent=2, ensure_ascii=False).encode(),
                    "chore: record publication attempt [skip ci]")


def publish(post, author):
    version = os.environ["LINKEDIN_API_VERSION"]
    if not re.fullmatch(r"20\d{4}", version):
        raise ValueError("Configura una versión vigente de LinkedIn")
    headers = {"Authorization": "Bearer " + os.environ["LINKEDIN_ACCESS_TOKEN"], "LinkedIn-Version": version,
               "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json"}
    payload = {"author": author, "commentary": post["text"], "visibility": "PUBLIC", "lifecycleState": "PUBLISHED",
               "isReshareDisabledByAuthor": False,
               "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []}}
    image = read_image(post.get("imageDataUrl"))
    if image:
        _, data = request("https://api.linkedin.com/rest/images?action=initializeUpload", "POST",
                          {"initializeUploadRequest": {"owner": author}}, headers)
        result = json.loads(data)["value"]
        from urllib.parse import urlparse
        upload = urlparse(result["uploadUrl"])
        host = upload.hostname or ""
        if upload.scheme != "https" or upload.username or upload.password or upload.port not in (None, 443) or not (host == "linkedin.com" or host.endswith((".linkedin.com", ".licdn.com"))):
            raise ValueError("Destino de imagen no permitido")
        request(result["uploadUrl"], "PUT", image, {"Content-Type": "application/octet-stream", "Authorization": headers["Authorization"]})
        payload["content"] = {"media": {"title": "Imagen del autor", "id": result["image"]}}
    response_headers, _ = request("https://api.linkedin.com/rest/posts", "POST", payload, headers)
    urn = response_headers.get("x-restli-id")
    if not urn or not urn.startswith("urn:li:"):
        raise ValueError("No se confirmó el ID del post")
    return urn


def execute(post, state, store, author, now, sender=publish):
    receipt = {"authorUrn": author, "fingerprint": fingerprint(post, author), "status": "SENDING", "attemptedAt": now.isoformat()}
    state["receipts"][post["id"]] = receipt
    store.save(state)  # Must persist BEFORE any external request. A conflict or denied write aborts the send.
    try:
        receipt["postUrn"] = sender(post, author)
        receipt["status"] = "SUCCESS"
    except Exception:
        receipt["status"] = "UNKNOWN"
        store.save(state)
        raise RuntimeError("Envío sin confirmar: revisa LinkedIn; no se reintentará automáticamente") from None
    store.save(state)  # If this fails, the persisted SENDING receipt still prevents a duplicate.


def main():
    try:
        # Backend publication is an independent execution path. Actions must not
        # race it; the queue workflow remains separate from the daily generator.
        if os.getenv("PUBLICATION_MODE") == "backend":
            print("PUBLICATION_MODE=backend: GitHub Actions no publicará la cola.")
            return 0
        config_path = Path("automation/autopost-config.json")
        if config_path.exists():
            config = json.loads(config_path.read_text(encoding="utf-8"))
            # The daily generator may publish directly in automatic mode. Do
            # not also consume a queue in that configuration. Approved queues
            # remain available when the generator is disabled or in review mode.
            if config.get("enabled") and config.get("approvalMode") == "AUTOMATIC":
                print("La publicación automática diaria está activa; no se consume también la cola.")
                return 0
        elif os.getenv("PUBLICATION_MODE") not in ("queue", "daily"):
            print("PUBLICATION_MODE no habilita la cola exportada.")
            return 0
        author = os.environ["LINKEDIN_AUTHOR_URN"]
        store = GitHubState()
        queue, state = store.load_queue_and_state(author)
        if len(json.dumps(queue, ensure_ascii=False).encode()) > 50 * 1024 * 1024:
            raise ValueError("Exportación superior a 50 MB: divide la cola")
        posts = validate_queue(queue, author)
        now = datetime.now(timezone.utc)
        limit = int(os.getenv("MAX_POSTS_PER_DAY") or "1")
        if not 1 <= limit <= 5:
            raise ValueError("Límite diario fuera de rango (1 a 5)")
        post = choose_due(posts, state, author, now, publication_timezone(), limit)
        unresolved = sum(1 for r in state["receipts"].values() if r["status"] in ("SENDING", "UNKNOWN"))
        if unresolved:
            print(f"Hay {unresolved} intentos pendientes de revisión. Publicación detenida.")
            return 1
        if post is None:
            print("Sin posts pendientes dentro de la ventana de 24 horas o límite diario alcanzado.")
            return 0
        if os.getenv("PUBLISH_ENABLED") != "true":
            print("Simulación: hay un post aprobado y vencido. No se envió ni se consumió.")
            return 0
        if not os.getenv("LINKEDIN_ACCESS_TOKEN") or not re.fullmatch(r"20\d{4}", os.getenv("LINKEDIN_API_VERSION", "")):
            raise ValueError("Configura el token y la versión de LinkedIn antes de activar")
        execute(post, state, store, author, now)
        print("Publicación confirmada; recibo guardado en automation/state.json.")
        return 0
    except Exception as error:
        # Never echo upstream bodies, tokens, upload URLs, post text or exception messages.
        print(f"Publicación detenida ({type(error).__name__}). Consulta la guía y los recibos antes de reintentar.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
