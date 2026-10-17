"""Crea una publicación técnica con imagen y la publica en LinkedIn."""
import argparse
import base64
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

HTTP = requests.Session()


def log(message):
    print(f"[{datetime.now(timezone.utc).isoformat(timespec='seconds')}] {message}", flush=True)


def required(name, dry_run=False):
    value = os.getenv(name, '').strip()
    if not value and not dry_run:
        raise RuntimeError(f"Falta el secreto {name} en el entorno del workflow")
    return value


def checked(response, source):
    if not response.ok:
        raise RuntimeError(f"{source}: HTTP {response.status_code}. Revisa el secreto, permiso o cuota configurada.")
    return response


def trend():
    log('Buscando tendencia tecnológica en Hacker News')
    keywords = ('ai', 'llm', 'model', 'agent', 'python', 'java', 'cloud', 'rust',
                'software', 'open source', 'security', 'database', 'api', 'server',
                'docker', 'kubernetes', 'compiler', 'framework', 'postgres')
    try:
        ids = checked(HTTP.get('https://hacker-news.firebaseio.com/v0/topstories.json', timeout=12), 'HN top').json()[:25]
        for story_id in ids:
            response = HTTP.get(f'https://hacker-news.firebaseio.com/v0/item/{story_id}.json', timeout=7)
            if not response.ok:
                continue
            item = response.json() or {}
            title = item.get('title', '')
            if any(re.search(r'\b' + re.escape(word) + r'\b', title, re.I) for word in keywords):
                return {'title': title, 'url': item.get('url') or f'https://news.ycombinator.com/item?id={story_id}',
                        'context': f"Historia pública de Hacker News con {item.get('score', 0)} puntos."}
    except (requests.RequestException, ValueError) as err:
        log(f'Aviso Hacker News: {type(err).__name__}')
    return {'title': 'Cuándo conviene elegir una arquitectura simple frente a microservicios',
            'url': 'https://news.ycombinator.com/',
            'context': 'Tema general de ingeniería de software; no presentarlo como noticia reciente.'}


def deepseek(messages, key, max_tokens=300):
    response = HTTP.post('https://api.deepseek.com/chat/completions',
                         headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
                         json={'model': 'deepseek-chat', 'messages': messages,
                               'max_tokens': max_tokens, 'temperature': 0.65}, timeout=65)
    checked(response, 'DeepSeek')
    return response.json()['choices'][0]['message']['content'].strip().replace('**', '')


def post_text(topic, key, config=None):
    config = config or {}
    niche = config.get('prompt') or os.getenv('USER_NICHE_PROMPT', 'Desarrollador Full Stack de Java, React, Spring Boot e IA, con criterio técnico práctico.')
    target = int(config.get('targetCharacters') or 1200)
    system = (f'Eres un creador de contenido de LinkedIn en español. Perfil e instrucciones: {niche}. '
              f'Escribe una publicación original de hasta {target} caracteres sobre el tema indicado. '
              'Usa una idea central concreta, 1 gancho y 1 pregunta final, exactamente 2 hashtags. '
              'No inventes experiencia personal, métricas, anuncios ni citas. '
              'No afirmes monopolios o adquisiciones que no estén verificadas. '
              'Si la fuente es débil, presenta el tema como análisis/opinión. '
              'Evita frases vacías, exageraciones, asteriscos y exceso de emojis. '
              'Devuelve SOLO la publicación.')
    content = deepseek([{'role': 'system', 'content': system},
                        {'role': 'user', 'content': f"Título: {topic['title']}\nContexto: {topic['context']}\nEnlace: {topic['url']}"}], key)
    if not content:
        raise RuntimeError('DeepSeek devolvió un post vacío')
    if len(content) > target:
        raise RuntimeError(f'El texto generado supera el límite configurado de {target} caracteres')
    log(f'Post generado: {len(content)} caracteres')
    return content


def image_prompt(topic, post, key):
    system = (
        "Create one precise English prompt for a premium editorial illustration that will accompany a LinkedIn post by a software engineer. "
        "Read the post and identify its single main technical lesson; depict that lesson literally or with one clear visual metaphor. "
        "The image must be unmistakably about this specific subject, not generic technology. Pick a concrete scene, one focal object, "
        "and no more than two supporting details. Use a polished magazine-art direction: realistic materials, deliberate composition, "
        "crisp subject, natural studio lighting, restrained AutoPost violet/indigo accent with neutral colors, generous clean negative space, "
        "square composition suitable for a LinkedIn feed. Keep the focal subject large and readable on a phone. "
        "No text, letters, numbers, logos, watermark, fake screenshots, decorative UI, random servers, glowing cubes, network webs, "
        "floating icons, or unrelated circuitry. Return only the image prompt, under 120 words."
    )
    user = (
        f"Topic: {topic['title']}\nSource context: {topic['context']}\n"
        f"Actual LinkedIn post to illustrate (use its idea, do not place its words in the image):\n{post}"
    )
    prompt = deepseek([{'role': 'system', 'content': system}, {'role': 'user', 'content': user}], key, 220)
    if not prompt:
        raise RuntimeError('DeepSeek devolvió un prompt de imagen vacío')
    return prompt


def image_bytes(prompt, key, config=None):
    # NanoGPT model IDs are configurable in Actions; use a quality model by default.
    model = ((config or {}).get('imageModel') or os.getenv('NANOGPT_IMAGE_MODEL', '').strip() or 'qwen-image-2.1/text-to-image')
    log(f'Generando imagen con NanoGPT, modelo: {model}')
    payload = {'model': model, 'prompt': prompt, 'n': 1}
    if 'banana' in model.lower():
        # Nano Banana uses resolution/aspect_ratio rather than OpenAI's size field.
        default_resolution = '2k' if model == 'nano-banana-2-fast' else '1k'
        payload['resolution'] = os.getenv('NANOGPT_IMAGE_RESOLUTION', '').strip() or default_resolution
        payload['aspect_ratio'] = os.getenv('NANOGPT_IMAGE_ASPECT_RATIO', '').strip() or '1:1'
    else:
        payload['size'] = os.getenv('NANOGPT_IMAGE_SIZE', '').strip() or '1024x1024'
    response = HTTP.post('https://api.nano-gpt.com/v1/images/generations',
                         headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
                         json=payload, timeout=180)
    checked(response, 'NanoGPT')
    record = (response.json().get('data') or [{}])[0]
    if record.get('b64_json'):
        data = base64.b64decode(record['b64_json'])
    elif record.get('url'):
        image_response = HTTP.get(record['url'], timeout=90)
        checked(image_response, 'Descarga imagen NanoGPT')
        data = image_response.content
    else:
        raise RuntimeError('NanoGPT no devolvió url ni b64_json')
    if len(data) < 1000:
        raise RuntimeError('Imagen vacía o demasiado pequeña')
    return data


def save_preview_image(data):
    output = os.getenv('AUTOPOST_PREVIEW_PATH', '').strip()
    if not output:
        return
    path = Path(output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    log(f'Vista previa guardada: {path.name}')


def linkedin_headers(token):
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
            'Linkedin-Version': os.getenv('LINKEDIN_API_VERSION', '202609')}


def upload_image(data, author, token):
    headers = linkedin_headers(token)
    response = HTTP.post('https://api.linkedin.com/rest/images?action=initializeUpload',
                         headers=headers, json={'initializeUploadRequest': {'owner': author}}, timeout=30)
    checked(response, 'LinkedIn initializeUpload')
    value = response.json()['value']
    upload_url, image_urn = value['uploadUrl'], value['image']
    # La uploadUrl es prefirmada; usar Authorization según el flujo oficial.
    response = HTTP.put(upload_url, headers={'Authorization': f'Bearer {token}',
                                             'Content-Type': 'application/octet-stream'},
                        data=data, timeout=90)
    checked(response, 'LinkedIn subida de imagen')
    return image_urn


def publish(text, author, token, image_urn=None, topic='tecnología y software'):
    payload = {'author': author, 'commentary': text, 'visibility': 'PUBLIC',
               'distribution': {'feedDistribution': 'MAIN_FEED', 'targetEntities': [],
                                'thirdPartyDistributionChannels': []},
               'lifecycleState': 'PUBLISHED', 'isReshareDisabledByAuthor': False}
    if image_urn:
        payload['content'] = {'media': {'id': image_urn, 'altText': f'Ilustración editorial sobre {topic[:180]}'}}
    # No se reintenta este POST: un timeout no demuestra que no se publicara.
    response = HTTP.post('https://api.linkedin.com/rest/posts',
                         headers=linkedin_headers(token), json=payload, timeout=45)
    checked(response, 'LinkedIn crear publicación')
    post_id = response.headers.get('x-restli-id', 'Publicado (ID no devuelto)')
    log(f'Publicado correctamente: {post_id}')
    return post_id


def _github_file(path):
    repo = required('GITHUB_REPOSITORY')
    branch = required('QUEUE_BRANCH')
    token = required('GITHUB_TOKEN')
    url = f'https://api.github.com/repos/{repo}/contents/{path}?ref={branch}'
    response = HTTP.get(url, headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json',
                                      'X-GitHub-Api-Version': '2022-11-28'}, timeout=30)
    if response.status_code == 404:
        return None, None
    checked(response, 'GitHub leer archivo de automatización')
    file = response.json()
    content = file.get('content') or ''
    if content.strip():
        raw = base64.b64decode(content)
    else:
        raw_response = HTTP.get(url, headers={'Authorization': f'Bearer {token}',
                                               'Accept': 'application/vnd.github.raw',
                                               'X-GitHub-Api-Version': '2022-11-28'}, timeout=60)
        checked(raw_response, 'GitHub leer archivo de automatización')
        raw = raw_response.content
    return json.loads(raw), file['sha']


def _save_github_file(path, value, message):
    repo = required('GITHUB_REPOSITORY')
    branch = required('QUEUE_BRANCH')
    token = required('GITHUB_TOKEN')
    _, sha = _github_file(path)
    body = {'message': message, 'branch': branch,
            'content': base64.b64encode(json.dumps(value, ensure_ascii=False, indent=2).encode()).decode()}
    if sha:
        body['sha'] = sha
    response = HTTP.put(f'https://api.github.com/repos/{repo}/contents/{path}',
                        headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json',
                                 'X-GitHub-Api-Version': '2022-11-28'}, json=body, timeout=40)
    checked(response, 'GitHub guardar archivo de automatización')


def load_settings():
    path = Path('automation/autopost-config.json')
    if not path.exists():
        return {'enabled': os.getenv('PUBLICATION_MODE') == 'daily', 'approvalMode': 'AUTOMATIC', 'targetCharacters': 1200,
                'prompt': '', 'imageModel': os.getenv('NANOGPT_IMAGE_MODEL', '').strip() or 'qwen-image-2.1/text-to-image', 'timezone': 'America/Lima', 'publishTime': '08:00'}
    config = json.loads(path.read_text(encoding='utf-8'))
    if config.get('version') != 1:
        raise ValueError('El formato de configuración de Actions no es compatible')
    config.setdefault('approvalMode', 'REQUIRE_APPROVAL')
    config.setdefault('targetCharacters', 1200)
    config.setdefault('prompt', '')
    config.setdefault('imageModel', os.getenv('NANOGPT_IMAGE_MODEL', '').strip() or 'qwen-image-2.1/text-to-image')
    if not config['imageModel']:
        config['imageModel'] = os.getenv('NANOGPT_IMAGE_MODEL', '').strip() or 'qwen-image-2.1/text-to-image'
    config.setdefault('timezone', 'America/Lima')
    config.setdefault('publishTime', '08:00')
    config.setdefault('enabled', False)
    if not 100 <= int(config['targetCharacters']) <= 3000:
        raise ValueError('El límite de caracteres configurado está fuera de rango')
    if len(str(config['prompt'])) > 5000:
        raise ValueError('El prompt supera el máximo de 5000 caracteres')
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._/-]{0,99}', str(config['imageModel'])) or '..' in str(config['imageModel']):
        raise ValueError('El identificador del modelo de imagen no es válido')
    if config['approvalMode'] not in ('REQUIRE_APPROVAL', 'AUTOMATIC'):
        raise ValueError('Modo de aprobación de Actions inválido')
    ZoneInfo(config['timezone'])
    if not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', str(config['publishTime'])):
        raise ValueError('La hora configurada debe tener formato HH:mm')
    return config


def run_due(config, dry_run=False):
    timezone_name = config.get('timezone', 'America/Lima')
    zone = ZoneInfo(timezone_name)
    now = datetime.now(timezone.utc).astimezone(zone)
    hour, minute = map(int, config.get('publishTime', '08:00').split(':'))
    return dry_run or (now.hour, now.minute) >= (hour, minute), now


def record_history(entry):
    data, _ = _github_file('automation/autopost-history.json')
    if not isinstance(data, dict):
        data = {'version': 1, 'posts': []}
    posts = data.get('posts', [])
    posts.insert(0, entry)
    data['posts'] = posts[:200]
    _save_github_file('automation/autopost-history.json', data, 'chore: record AutoPost Actions history [skip ci]')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Genera post e imagen, pero NO publica')
    parser.add_argument('--text-only', action='store_true', help='Publica sin imagen')
    args = parser.parse_args()
    config = load_settings()
    due, now = run_due(config, args.dry_run)
    if not args.dry_run and not config.get('enabled'):
        log('Automatización de GitHub Actions desactivada en automation/autopost-config.json')
        return
    if not args.dry_run and config.get('approvalMode') == 'AUTOMATIC' and os.getenv('PUBLISH_ENABLED') != 'true':
        log('Modo automático sin enviar: configura PUBLISH_ENABLED=true en Actions cuando hayas revisado los secretos')
        return
    if not due:
        log(f'Aún no llega la hora objetivo ({config["publishTime"]} {config["timezone"]})')
        return
    local_date = now.date().isoformat()
    state, _ = _github_file('automation/autopost-state.json')
    state = state if isinstance(state, dict) else {'version': 1, 'days': {}}
    days = state.setdefault('days', {})
    if not args.dry_run and local_date in days:
        log(f'Ya existe un intento de publicación para {local_date}; no se repetirá automáticamente')
        return
    key = required('DEEPSEEK_API_KEY')
    preview_only = args.dry_run or config.get('approvalMode') == 'REQUIRE_APPROVAL'
    token = required('LINKEDIN_ACCESS_TOKEN', preview_only)
    author = required('LINKEDIN_AUTHOR_URN', preview_only) or required('LINKEDIN_PERSON_URN', preview_only)
    nanogpt = os.getenv('NANOGPT_KEY', '').strip()
    require_image = os.getenv('REQUIRE_IMAGE', 'false').strip().lower() in ('true', '1', 'yes')
    topic = trend()
    log(f"Tema seleccionado: {topic['title']}")
    content = post_text(topic, key, config)
    print('\n--- POST GENERADO ---\n' + content + '\n---------------------\n')
    text_only = args.text_only or os.getenv('FORCE_TEXT_ONLY', 'false').lower() in ('true', '1', 'yes')
    img = None
    if not text_only and nanogpt:
        try:
            prompt = image_prompt(topic, content, key)
            img = image_bytes(prompt, nanogpt, config)
            log(f'Imagen generada: {len(img)} bytes')
        except (requests.RequestException, ValueError, KeyError, RuntimeError) as err:
            if require_image:
                raise RuntimeError(f'La imagen es obligatoria y no se pudo generar: {err}') from err
            log(f'No se pudo generar imagen: {err}. Se publicará solo texto.')
    elif not nanogpt and not text_only:
        if require_image:
            raise RuntimeError('REQUIRE_IMAGE está activo, pero falta el secreto NANOGPT_KEY')
        log('NANOGPT_KEY no configurada; se publicará solo texto.')
    if img and len(img) > 5 * 1024 * 1024:
        raise RuntimeError('La imagen supera el máximo de 5 MB permitido')
    if img and not img.startswith(b'\x89PNG\r\n\x1a\n') and not img.startswith(b'\xff\xd8\xff'):
        raise RuntimeError('El proveedor devolvió una imagen que no es PNG/JPEG')
    if args.dry_run:
        if img:
            save_preview_image(img)
        log('DRY RUN terminado: nada fue publicado.')
        return
    if config.get('approvalMode') == 'REQUIRE_APPROVAL':
        if not img:
            raise RuntimeError('No se creó la imagen necesaria para enviar el borrador a revisión')
        identifier = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{os.getenv('GITHUB_REPOSITORY')}:{local_date}"))
        review, _ = _github_file('automation/review.json')
        review = review if isinstance(review, dict) else {'version': 1, 'posts': []}
        review.setdefault('posts', [])
        if any(item.get('id') == identifier for item in review['posts'] if isinstance(item, dict)):
            log(f'El borrador de revisión de {local_date} ya existe; no se duplicará')
            return
        image_type = 'png' if img.startswith(b'\x89PNG\r\n\x1a\n') else 'jpeg'
        scheduled_at = now.replace(hour=int(config['publishTime'][:2]), minute=int(config['publishTime'][3:]), second=0, microsecond=0)
        candidate = {'id': identifier, 'status': 'PENDING', 'title': topic['title'], 'text': content,
                     'imageDataUrl': f'data:image/{image_type};base64,' + base64.b64encode(img).decode(),
                     'publishAt': scheduled_at.isoformat(), 'createdAt': datetime.now(timezone.utc).isoformat(),
                     'prompt': config.get('prompt', ''), 'imageModel': config.get('imageModel', ''),
                     'targetCharacters': config.get('targetCharacters', 1200), 'source': 'GITHUB_ACTIONS'}
        review.setdefault('posts', []).insert(0, candidate)
        review['posts'] = review['posts'][:100]
        _save_github_file('automation/review.json', review, 'chore: save generated post for approval [skip ci]')
        days[local_date] = {'status': 'REVIEW_REQUIRED', 'postId': identifier, 'createdAt': now.isoformat()}
        _save_github_file('automation/autopost-state.json', state, 'chore: prevent duplicate daily post generation [skip ci]')
        log(f'Borrador {identifier} guardado para revisión; todavía no se publicó')
        return
    days[local_date] = {'status': 'SENDING', 'attemptedAt': now.isoformat(), 'title': topic['title']}
    _save_github_file('automation/autopost-state.json', state, 'chore: reserve daily LinkedIn publication [skip ci]')
    image_urn = None
    if img:
        try:
            image_urn = upload_image(img, author, token)
        except (requests.RequestException, ValueError, KeyError, RuntimeError) as err:
            if require_image:
                raise RuntimeError(f'La imagen es obligatoria y LinkedIn no pudo recibirla: {err}') from err
            log(f'No se pudo subir imagen: {err}. Se publicará solo texto.')
    if require_image and not image_urn:
        raise RuntimeError('REQUIRE_IMAGE está activo, se canceló para no publicar solo texto')
    try:
        linkedin_urn = publish(content, author, token, image_urn, topic['title'])
    except Exception:
        days[local_date]['status'] = 'UNKNOWN'
        _save_github_file('automation/autopost-state.json', state, 'chore: record uncertain LinkedIn result [skip ci]')
        raise
    days[local_date]['status'] = 'SUCCESS'
    days[local_date]['postUrn'] = linkedin_urn
    days[local_date]['publishedAt'] = datetime.now(timezone.utc).isoformat()
    _save_github_file('automation/autopost-state.json', state, 'chore: record LinkedIn publication [skip ci]')
    record_history({'id': str(uuid.uuid5(uuid.NAMESPACE_URL, f"{os.getenv('GITHUB_REPOSITORY')}:{local_date}")), 'source': 'GITHUB_ACTIONS', 'status': 'SUCCESS', 'title': topic['title'],
                    'text': content, 'imageModel': config.get('imageModel', ''), 'targetCharacters': config.get('targetCharacters'),
                    'publishAt': f'{local_date}T{config.get("publishTime", "08:00")}:00',
                    'publishedAt': datetime.now(timezone.utc).isoformat(), 'postUrn': linkedin_urn})


if __name__ == '__main__':
    try:
        main()
    except (requests.RequestException, RuntimeError, ValueError, KeyError) as exc:
        log(f'ERROR: {exc}')
        sys.exit(1)
