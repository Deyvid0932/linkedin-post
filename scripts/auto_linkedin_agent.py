#!/usr/bin/env python3
"""
AutoPost LinkedIn Autonomous Agent
Cycle: Extract Trending Tech -> DeepSeek 3-Role Generation (400-600 chars)
       -> Hugging Face FLUX.1 Image (Fallback to Pure Text) -> Publish to LinkedIn API.
Zero local server required. Runs 100% serverless in GitHub Actions.
"""

import os
import sys
import json
import time
import datetime
import urllib.parse
import requests

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

def log(msg: str):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        print(f"[{timestamp}] {msg}", flush=True)
    except UnicodeEncodeError:
        safe_msg = msg.encode("ascii", errors="replace").decode("ascii")
        print(f"[{timestamp}] {safe_msg}", flush=True)


def truncate_at_sentence_boundary(text: str, limit: int = 600) -> str:
    """Corta el texto en el límite natural de una oración antes del límite máximo."""
    if not text or len(text) <= limit:
        return text

    search_floor = max(limit - 120, limit // 2)
    cut_pos = -1

    # Buscar delimitador de fin de oración
    for i in range(limit - 1, search_floor - 1, -1):
        c = text[i]
        if c in ('.', '!', '?', '\n') and (i + 1 == len(text) or text[i + 1].isspace()):
            cut_pos = i + 1
            break

    # Si no hay delimitador, cortar en el último espacio
    if cut_pos == -1:
        for i in range(limit - 1, search_floor - 1, -1):
            if text[i].isspace():
                cut_pos = i
                break

    if cut_pos == -1:
        cut_pos = limit

    return text[:cut_pos].strip()

# función busqueda de temas virales
def fetch_trending_tech_topic() -> dict:
    """
    Extrae un tema o herramienta de tecnología/IA viral desde Hacker News o GitHub Search API.
    """
    log("🔍 Paso 1: Buscando tendencias tecnológicas en tiempo real...")

    # 1. Intentar con Hacker News API (100% gratuita y pública)
    try:
        hn_top_url = "https://hacker-news.firebaseio.com/v0/topstories.json"
        res = requests.get(hn_top_url, timeout=10)
        if res.status_code == 200:
            story_ids = res.json()[:35]
            tech_keywords = [
                "ai", "llm", "deepseek", "model", "agent", "python", "rust", "database",
                "architecture", "cloud", "open source", "framework", "performance",
                "api", "linux", "compiler", "security", "infra", "postgres"
            ]

            for sid in story_ids:
                item_url = f"https://hacker-news.firebaseio.com/v0/item/{sid}.json"
                item_res = requests.get(item_url, timeout=5)
                if item_res.status_code == 200:
                    data = item_res.json()
                    title = data.get("title", "")
                    title_lower = title.lower()

                    if any(k in title_lower for k in tech_keywords):
                        url = data.get("url", f"https://news.ycombinator.com/item?id={sid}")
                        score = data.get("score", 100)
                        log(f"✅ Tendencia encontrada en HackerNews ({score} puntos): '{title}'")
                        return {
                            "title": title,
                            "url": url,
                            "context": f"Discusión técnica en HackerNews con {score} puntos de comunidad sobre '{title}'."
                        }
    except Exception as e:
        log(f"⚠️ Aviso al consultar HackerNews: {e}")

    try:
        week_ago = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
        gh_url = f"https://api.github.com/search/repositories?q=topic:ai+created:>{week_ago}&sort=stars&order=desc&per_page=5"
        gh_headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "AutoPost-Agent"}
        res = requests.get(gh_url, headers=gh_headers, timeout=10)
        if res.status_code == 200:
            items = res.json().get("items", [])
            if items:
                repo = items[0]
                name = repo.get("full_name")
                desc = repo.get("description", "Herramienta open-source emergente")
                stars = repo.get("stargazers_count", 0)
                html_url = repo.get("html_url")
                log(f"✅ Repositorio trending encontrado en GitHub ({stars} estrellas): '{name}'")
                return {
                    "title": f"Nuevo proyecto viral en GitHub: {name}",
                    "url": html_url,
                    "context": f"Repositorio {name} ({stars} estrellas esta semana): {desc}"
                }
    except Exception as e:
        log(f"⚠️ Aviso al consultar GitHub API: {e}")

    # Fallback contextual sólido si no hay conexión externa
    log("📌 Utilizando tema contextual de arquitectura técnica...")
    return {
        "title": "Arquitectura Moderna de Software: Eficiencia y Simplicidad en Producción",
        "url": "https://linkedin.com",
        "context": "Criterios de ingeniería de software sobre balance entre pragmatismo, costo y escalabilidad técnica."
    }


# Genera el prompt de deepseek
def generate_post_text(topic: dict, niche_prompt: str, api_key: str) -> str:
    """
    Genera un Micro-Post de 400 a 600 caracteres con DeepSeek.
    La IA analiza el tema y adopta automáticamente uno de los 3 roles:
    1. Consultor Técnico B2B (Comparativa, ROI, Criterio)
    2. Tech Storyteller (Reto en producción, lección real en 1ra persona)
    3. Provocador Técnico (Mito vs Realidad, debate constructivo)
    """
    log("🧠 Paso 2: Generando contenido con DeepSeek (Evaluación de 3 roles dinámicos)...")

    system_prompt = f"""
Eres un especialista y creador de contenido técnico en LinkedIn con la siguiente identidad:
{niche_prompt}

Tu misión es analizar la tendencia técnica provista y REDACTAR UN MICRO-POST TÉCNICO CONCRETO (400 a 600 CARACTERES MÁXIMO).

EVALUACIÓN DE ROLES (Elige autónomamente el que mejor encaje con el tema):
1. ROL: CONSULTOR TÉCNICO B2B (Si el tema trata de herramientas, arquitecturas, costos o trade-offs):
   - Gancho comparativo o de criterio en 1 línea.
   - 2 líneas de criterio técnico pragmático sin rodeos (cuándo usar qué, costo/beneficio).
   - 1 pregunta de criterio para colegas de la industria.

2. ROL: TECH STORYTELLER (Si el tema es un nuevo release, bug común o reto en producción):
   - Gancho de experiencia real en 1ra persona en 1 línea.
   - 2 líneas explicando el reto técnico y la solución concreta que funcionó.
   - 1 pregunta sobre lecciones aprendidas en el campo.

3. ROL: PROVOCADOR TÉCNICO (Si el tema desafía el hype o una creencia común de la industria):
   - Gancho contracorriente que cuestiona una moda técnica en 1 línea.
   - 2 líneas de contraste: Mito de moda vs lo que realmente funciona en producción.
   - 1 pregunta de debate binario o directo (ej. '¿Team A o Team B? Justifica en 1 frase 👇').

REGLAS ESTRICTAS DE FORMATO:
- LONGITUD: 400 a 600 CARACTERES MÁXIMO. Prohibido superar 600 caracteres.
- CERO ASTERISCOS (**): En LinkedIn los asteriscos ** no funcionan como negrita y ensucian el texto. NUNCA los uses.
- Emojis profesionales en puntos clave (🎯, ⚡, 💡, 🔹, 👇).
- Cierra siempre con la pregunta de remate y exactamente 2 hashtags pertinentes.
- RESPUESTA PURA Y DIRECTA: Devuelve ÚNICAMENTE el texto final del post. Prohibido incluir preámbulos, saludos,
aclaraciones, descargos de responsabilidad o frases como "Aquí está el micro-post:". Comienza directamente con la primera
palabra del post.
"""

    user_prompt = f"""
TEMA DE TENDENCIA A EVALUAR:
- TÍTULO: {topic['title']}
- CONTEXTO: {topic['context']}
- REFERENCIA: {topic['url']}

Redacta el Micro-Post para LinkedIn en español de 400 a 600 caracteres aplicando el rol más adecuado.
"""

    url = "https://api.deepseek.com/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt.strip()},
            {"role": "user", "content": user_prompt.strip()}
        ],
        "max_tokens": 240,
        "temperature": 0.7
    }

    res = requests.post(url, headers=headers, json=payload, timeout=45)
    res.raise_for_status()

    content = res.json()["choices"][0]["message"]["content"]
    # Limpieza de asteriscos
    clean_text = content.replace("**", "").strip()

    # Validación post-generación de 600 caracteres
    if len(clean_text) > 600:
        log(f"✂️ Ajustando post de {len(clean_text)} a un máximo de 600 caracteres...")
        clean_text = truncate_at_sentence_boundary(clean_text, 600)

    log(f"✅ Post generado exitosamente ({len(clean_text)} caracteres):")
    print("\n" + "=" * 50)
    print(clean_text)
    print("=" * 50 + "\n")
    return clean_text

# Generación de imagen
def generate_hf_flux_image(topic_concept: str, hf_token: str | None) -> bytes | None:
    """
    Genera una ilustración 3D técnica limpia con Hugging Face (FLUX.1-schnell).
    Si Hugging Face falla o no hay token, retorna None para fallback a Solo Texto.
    """
    if not hf_token or not hf_token.strip():
        log("ℹ️ No se detectó HF_TOKEN. Fallback activado: Se publicará como Post de Solo Texto.")
        return None

    log("🎨 Paso 3: Solicitando ilustración 3D a Hugging Face Inference API (FLUX.1-schnell)...")

    # Prompt anti-texto estricto
    prompt = (
        f"minimalist 3d technical isometric illustration representing {topic_concept}, "
        "clay render style, soft ambient studio lighting, clean geometric composition, "
        "modern tech color palette, octane render, 8k resolution, "
        "strictly no text, no words, no letters, no typography, no watermark, no logos"
    )

    hf_url = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell"
    headers = {
        "Authorization": f"Bearer {hf_token.strip()}",
        "Content-Type": "application/json"
    }
    payload = {
        "inputs": prompt,
        "parameters": {
            "num_inference_steps": 4
        }
    }

    try:
        res = requests.post(hf_url, headers=headers, json=payload, timeout=60)
        if res.status_code == 200 and len(res.content) > 1000:
            log(f"✅ Imagen generada exitosamente con Hugging Face ({len(res.content)} bytes).")
            return res.content
        else:
            log(f"⚠️ Hugging Face respondió con status {res.status_code}: {res.text[:150]}")
            log("ℹ️ Fallback activado: Se publicará como Post de Solo Texto.")
            return None
    except Exception as e:
        log(f"⚠️ Error conectando con Hugging Face API: {e}")
        log("ℹ️ Fallback activado: Se publicará como Post de Solo Texto.")
        return None


def publish_to_linkedin(post_text: str, image_bytes: bytes | None, author_urn: str, access_token: str, dry_run: bool = False) -> str:
    """
    Publica en LinkedIn API.
    Si image_bytes está presente: Ejecuta registro en /v2/assets -> PUT binario -> POST /v2/ugcPosts (con media).
    Si image_bytes es None o la subida falla: Publica directamente en /v2/ugcPosts como Solo Texto.
    Si dry_run es True: Simula la publicación e imprime los payloads sin enviar la petición a LinkedIn.
    """
    if dry_run:
        log("🔍 [DRY-RUN] Simulación activa. No se realizarán peticiones de publicación a LinkedIn.")
        if image_bytes:
            log(f"🔍 [DRY-RUN] Se habría subido una imagen de {len(image_bytes)} bytes vía /v2/assets.")
        else:
            log("🔍 [DRY-RUN] Se habría publicado como Post de Solo Texto.")
        print("\n" + "-" * 40 + " PAYLOAD SIMULADO " + "-" * 40)
        print(f"Autor: {author_urn}")
        print(f"Tipo: {'IMAGE' if image_bytes else 'NONE'}")
        print(f"Texto ({len(post_text)} chars):\n{post_text}")
        print("-" * 98 + "\n")
        return "urn:li:share:DRY_RUN_SIMULATED_ID"

    headers = {
        "Authorization": f"Bearer {access_token.strip()}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
    }

    if image_bytes is not None and len(image_bytes) > 0:
        try:
            log("💼 Paso 4: Registrando carga de imagen en LinkedIn API (/v2/assets?action=registerUpload)...")
            register_url = "https://api.linkedin.com/v2/assets?action=registerUpload"
            register_payload = {
                "registerUploadRequest": {
                    "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                    "owner": author_urn,
                    "supportedUploadMechanism": ["SYNCHRONOUS_UPLOAD"]
                }
            }

            reg_res = requests.post(register_url, headers=headers, json=register_payload, timeout=30)
            if reg_res.status_code in (200, 201):
                reg_data = reg_res.json().get("value", {})
                asset = reg_data.get("asset")
                upload_mech = reg_data.get("uploadMechanism", {}).get(
                    "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest", {}
                )
                upload_url = upload_mech.get("uploadUrl")

                if asset and upload_url:
                    log("📤 Subiendo binario de la imagen a LinkedIn...")
                    upload_headers = {
                        "Authorization": f"Bearer {access_token.strip()}",
                        "Content-Type": "application/octet-stream"
                    }
                    put_res = requests.put(upload_url, headers=upload_headers, data=image_bytes, timeout=60)
                    if put_res.status_code in (200, 201):
                        log("✅ Binario de imagen subido exitosamente. Creando post con imagen adjunta...")
                        ugc_url = "https://api.linkedin.com/v2/ugcPosts"
                        post_payload = {
                            "author": author_urn,
                            "lifecycleState": "PUBLISHED",
                            "specificContent": {
                                "com.linkedin.ugc.ShareContent": {
                                    "shareCommentary": {"text": post_text},
                                    "shareMediaCategory": "IMAGE",
                                    "media": [
                                        {
                                            "status": "READY",
                                            "description": {"text": "Ilustración Técnica"},
                                            "media": asset,
                                            "title": {"text": "Insight Técnico"}
                                        }
                                    ]
                                }
                            },
                            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
                        }
                        ugc_res = requests.post(ugc_url, headers=headers, json=post_payload, timeout=30)
                        if ugc_res.status_code in (200, 201):
                            post_id = ugc_res.json().get("id", "PUBLISHED")
                            log(f"🎉 ¡Post con imagen publicado con éxito en LinkedIn! ID: {post_id}")
                            return post_id
                        else:
                            log(f"⚠️ Error al crear post con imagen [HTTP {ugc_res.status_code}]: {ugc_res.text}")
                    else:
                        log(f"⚠️ Error al subir binario de imagen [HTTP {put_res.status_code}]: {put_res.text}")
            else:
                log(f"⚠️ Error al registrar asset en LinkedIn [HTTP {reg_res.status_code}]: {reg_res.text}")
        except Exception as e:
            log(f"⚠️ Excepción durante el flujo de imagen: {e}")

        log("ℹ️ Conmutando a fallback: Publicando post como Solo Texto...")

    # =========================================================================
    # RAMA B: Publicación de Solo Texto (shareMediaCategory: NONE)
    # =========================================================================
    log("💼 Publicando post como Solo Texto en LinkedIn (/v2/ugcPosts)...")
    ugc_url = "https://api.linkedin.com/v2/ugcPosts"
    text_payload = {
        "author": author_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": post_text},
                "shareMediaCategory": "NONE"
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
    }

    res = requests.post(ugc_url, headers=headers, json=text_payload, timeout=30)
    if res.status_code in (200, 201):
        post_id = res.json().get("id", "PUBLISHED")
        log(f"🎉 ¡Post de solo texto publicado con éxito en LinkedIn! ID: {post_id}")
        return post_id
    else:
        raise RuntimeError(f"Fallo crítico al publicar en LinkedIn [HTTP {res.status_code}]: {res.text}")


def main():
    dry_run = "--dry-run" in sys.argv
    log("🚀 Iniciando Agente Autónomo de LinkedIn (GitHub Actions Serverless)...")
    if dry_run:
        log("⚡ Modo --dry-run activado: El script se ejecutará completamente sin publicar en LinkedIn.")

    deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
    linkedin_token = os.getenv("LINKEDIN_ACCESS_TOKEN", "mock_linkedin_token" if dry_run else None)
    linkedin_urn = os.getenv("LINKEDIN_PERSON_URN", "urn:li:person:mock_dry_run_user" if dry_run else None)
    hf_token = os.getenv("HF_TOKEN")
    niche_prompt = os.getenv(
        "USER_NICHE_PROMPT",
        "Consultor de Software Fullstack especializado en Spring Boot, Angular, IA generativa y arquitecturas modernas."
    )

    if not deepseek_api_key or not deepseek_api_key.strip():
        log("❌ ERROR: La variable 'DEEPSEEK_API_KEY' no está configurada.")
        sys.exit(1)

    if not linkedin_token or not linkedin_token.strip():
        log("❌ ERROR: La variable 'LINKEDIN_ACCESS_TOKEN' no está configurada en los Secretos de GitHub.")
        sys.exit(1)

    if not linkedin_urn or not linkedin_urn.strip():
        log("❌ ERROR: La variable 'LINKEDIN_PERSON_URN' no está configurada en los Secretos de GitHub.")
        sys.exit(1)

    # 1. Extraer tendencia
    topic = fetch_trending_tech_topic()

    # 2. Generar Micro-Post (400-600 caracteres) con selección de 3 roles
    post_text = generate_post_text(topic, niche_prompt, deepseek_api_key)

    # 3. Generar imagen con Hugging Face (con fallback a Solo Texto)
    image_bytes = generate_hf_flux_image(topic["title"], hf_token)

    # 4. Publicar en LinkedIn (o simular con dry-run)
    post_id = publish_to_linkedin(post_text, image_bytes, linkedin_urn, linkedin_token, dry_run=dry_run)

    log(f"🏁 Pipeline autónomo finalizado con éxito. Post ID: {post_id}")


if __name__ == "__main__":
    main()