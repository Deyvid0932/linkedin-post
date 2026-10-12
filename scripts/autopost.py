"""Crea una publicación técnica con imagen y la publica en LinkedIn."""
import argparse
import base64
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

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
        # No exponer tokens/URL privadas ni cuerpos completos en los logs.
        detail = response.text[:350].replace('\n', ' ')
        raise RuntimeError(f"{source}: HTTP {response.status_code}. {detail}")
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


def post_text(topic, key):
    niche = os.getenv('USER_NICHE_PROMPT', 'Desarrollador Full Stack de Java, React, Spring Boot e IA, con criterio técnico práctico.')
    system = (f'Eres un creador de contenido de LinkedIn en español. Perfil: {niche}. '
              'Escribe un post original de 75 a 105 palabras sobre una tendencia técnica. '
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


def image_bytes(prompt, key):
    # NanoGPT model IDs are configurable in Actions; use a quality model by default.
    model = os.getenv('NANOGPT_IMAGE_MODEL', '').strip() or 'gpt-image-2'
    log(f'Generando imagen con NanoGPT, modelo: {model}')
    payload = {'model': model, 'prompt': prompt, 'n': 1}
    if 'banana' in model.lower():
        # Nano Banana uses resolution/aspect_ratio rather than OpenAI's size field.
        payload['resolution'] = os.getenv('NANOGPT_IMAGE_RESOLUTION', '').strip() or '1k'
        payload['aspect_ratio'] = os.getenv('NANOGPT_IMAGE_ASPECT_RATIO', '').strip() or '1:1'
    else:
        payload['size'] = os.getenv('NANOGPT_IMAGE_SIZE', '').strip() or '1024x1024'
    response = HTTP.post('https://nano-gpt.com/api/v1/images/generations',
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Genera post e imagen, pero NO publica')
    parser.add_argument('--text-only', action='store_true', help='Publica sin imagen')
    args = parser.parse_args()
    key = required('DEEPSEEK_API_KEY')
    token = required('LINKEDIN_ACCESS_TOKEN', args.dry_run)
    author = required('LINKEDIN_PERSON_URN', args.dry_run)
    nanogpt = os.getenv('NANOGPT_KEY', '').strip()
    require_image = os.getenv('REQUIRE_IMAGE', 'false').strip().lower() in ('true', '1', 'yes')
    topic = trend()
    log(f"Tema seleccionado: {topic['title']}")
    content = post_text(topic, key)
    print('\n--- POST GENERADO ---\n' + content + '\n---------------------\n')
    text_only = args.text_only or os.getenv('FORCE_TEXT_ONLY', 'false').lower() in ('true', '1', 'yes')
    img = None
    if not text_only and nanogpt:
        try:
            prompt = image_prompt(topic, content, key)
            img = image_bytes(prompt, nanogpt)
            log(f'Imagen generada: {len(img)} bytes')
        except (requests.RequestException, ValueError, KeyError, RuntimeError) as err:
            if require_image:
                raise RuntimeError(f'La imagen es obligatoria y no se pudo generar: {err}') from err
            log(f'No se pudo generar imagen: {err}. Se publicará solo texto.')
    elif not nanogpt and not text_only:
        if require_image:
            raise RuntimeError('REQUIRE_IMAGE está activo, pero falta el secreto NANOGPT_KEY')
        log('NANOGPT_KEY no configurada; se publicará solo texto.')
    if args.dry_run:
        if img:
            save_preview_image(img)
        log('DRY RUN terminado: nada fue publicado.')
        return
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
    publish(content, author, token, image_urn, topic['title'])


if __name__ == '__main__':
    try:
        main()
    except (requests.RequestException, RuntimeError, ValueError, KeyError) as exc:
        log(f'ERROR: {exc}')
        sys.exit(1)
