"""GitHub Actions is a scheduler client. The backend owns content and credentials."""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def run(base_url: str, token: str) -> dict:
    parsed = urllib.parse.urlsplit(base_url)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or parsed.query or parsed.fragment or parsed.path not in ("", "/")):
        raise ValueError("AUTOMATION_API_URL debe ser el origen HTTPS de la app, sin ruta.")
    if len(token) < 32:
        raise ValueError("Configura AUTOMATION_TOKEN con al menos 32 caracteres.")
    req = urllib.request.Request(base_url.rstrip("/") + "/api/v1/automation/run-due",
                                 data=b"{}", method="POST",
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.build_opener(NoRedirect()).open(req, timeout=150) as response:
        return json.loads(response.read(4096))


def main():
    try:
        result = run(os.environ.get("AUTOMATION_API_URL", ""), os.environ.get("AUTOMATION_TOKEN", ""))
        print("Horarios procesados:", result.get("processed", 0))
        print("Publicaciones completadas:", result.get("published", 0))
        print("Envios que requieren revision:", result.get("reviewRequired", 0))
        if result.get("reviewRequired", 0):
            print("Revisa el historial de la app y LinkedIn antes de reintentar.")
            return 1
        return 0
    except urllib.error.HTTPError as error:
        print(f"El backend respondio HTTP {error.code}. Revisa configuracion y conectividad.")
    except (ValueError, urllib.error.URLError, TimeoutError):
        print("No se pudo consultar el backend. Comprueba el origen HTTPS, el token y la disponibilidad del servidor.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
