# Publicar con el PC apagado

Hay dos vías independientes. **AutoPost** usa el backend y requiere que esté en ejecución; **GitHub Actions** se ejecuta en GitHub aunque el PC esté apagado. Configura ambas desde Programación y evita habilitar otra ruta para los mismos borradores.

## A. Solo GitHub Actions, sin servidor permanente

### Preparar la app

1. Conserva una copia de PostgreSQL y de la configuración antes de actualizar. Revisa la sección de migraciones más abajo.
2. Configura `JWT_SECRET` y `ENCRYPTION_KEY` en el entorno local. La primera debe ser aleatoria y tener al menos 32 bytes; la segunda exactamente 32 bytes UTF-8. No pongas secretos en código o archivos exportados.
3. Usa `SCHEDULER_MODE=manual`. Arranca PostgreSQL local con `docker compose up -d`; backend con Java 21 mediante `backend/mvnw spring-boot:run`; frontend desde `frontend` con `npm ci --ignore-scripts` y `npm start`.
4. Configura el proveedor de texto si quieres IA. Para analizar imágenes, configura además `VISION_BASE_URL`, `VISION_API_KEY` y `VISION_MODEL`. La URL base debe incluir el prefijo API del proveedor: el servicio añade `/chat/completions`. Puedes escribir y guardar manualmente sin IA.
5. Conecta tu cuenta LinkedIn en la app. El token de esa cuenta también se configura como secreto en GitHub: la exportación nunca incluye tokens.
6. Para subir desde la app, conecta GitHub en **Conexiones** con un token de alcance limitado al repositorio y permiso **Contents: write**. Añade ese repositorio a la lista de repositorios conectados. El backend cifra el token; la cola enviada no contiene credenciales. La rama predeterminada debe permitir esa escritura.

El `.env.example` contiene nombres y valores vacíos. Para el Docker local actual, PostgreSQL usa su configuración de desarrollo en `docker-compose.yml`; el archivo de ejemplo describe además los valores de producción, por lo que debes hacer coincidir `DB_USERNAME`, `DB_PASSWORD` y `DB_URL` con tu instalación local. No ejecutes migraciones contra una base de datos que no hayas respaldado.

### Configurar GitHub una vez

Sube los cambios del proyecto a la rama predeterminada. En **Settings → Environments**, crea `production`. En **Settings → Secrets and variables → Actions** o en ese entorno, configura:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| Variable | `PUBLICATION_MODE` | `queue` para la cola antigua sin configuración en app; la configuración actual se guarda en `automation/autopost-config.json`. |
| Variable | `PUBLISH_ENABLED` | `false` inicialmente; `true` cuando decidas habilitar el envío real. |
| Variable | `LINKEDIN_AUTHOR_URN` | El mismo `urn:li:person:...` o `urn:li:organization:...` que la cuenta exportada. |
| Variable | `LINKEDIN_API_VERSION` | Una versión YYYYMM soportada por tu acceso; el backend usa actualmente `202607`. |
| Variable | `PUBLICATION_TIMEZONE` | `America/Lima` para exportaciones de cola antiguas. El horario de Actions actual se guarda en el archivo de configuración. |
| Variable | `MAX_POSTS_PER_DAY` | `1` inicialmente; valores de 1 a 5. |
| Secret | `LINKEDIN_ACCESS_TOKEN` | Token válido para ese autor y con los permisos necesarios. |
| Secret | `DEEPSEEK_API_KEY` | Generación del texto y del prompt de imagen de Actions. |
| Secret | `NANOGPT_KEY` | Generación de imágenes con el modelo seleccionado en Programación. |
| Secret | `LINKEDIN_PERSON_URN` | Autor para el modo automático de generación y publicación de Actions. |

`GITHUB_TOKEN` lo proporciona GitHub automáticamente; no necesitas crear un PAT para los recibos. El workflow declara `contents: write` exclusivamente en el job de la cola para guardar `automation/state.json`. El repositorio debe permitir esa escritura. Si las reglas de la rama la bloquean, el runner se detiene antes del envío. Puedes usar un repositorio dedicado privado para la cola con reglas ajustadas a ese uso, sin debilitar las reglas del repositorio de tu aplicación. Ver [permisos del token de Actions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token) y [API de contenidos](https://docs.github.com/en/rest/repos/contents).

Un perfil personal necesita el producto y permiso adecuados para [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin). Las páginas necesitan permisos de organización y el rol correspondiente. Un token caducado debe renovarse; Actions no evita la caducidad.

### Configuración desde AutoPost

En **Programación → Publicación con GitHub Actions**, selecciona el repositorio y configura su hora y zona, política de aprobación, prompt, máximo de caracteres y modelo de imagen. AutoPost escribe la configuración no secreta en `automation/autopost-config.json`; las claves permanecen en Actions Secrets. El workflow consulta la configuración cada 30 minutos, por lo que la hora es objetivo y puede retrasarse. La variable `PUBLISH_ENABLED` debe permanecer en `false` hasta revisar conexiones y pruebas; para publicar realmente cámbiala a `true`.

En modo **Necesita aprobación**, el workflow guarda el resultado en `automation/review.json`; la sección de revisión de Programación muestra texto e imagen. Al aprobar, AutoPost añade el borrador a `automation/queue.json` y el workflow publica solo esa cola. En modo **Automática**, el workflow genera y envía el post sin revisión; el recibo se guarda en `automation/autopost-state.json` y el historial detallado en `automation/autopost-history.json`.

Usa un repositorio privado: la configuración no contiene secretos, pero los archivos de revisión, cola e historial contienen texto e imágenes.

### Uso en tus ratos libres

1. Abre **Crear publicación**, elige cómo quieres sonar, público y objetivo.
2. Escribe el post, pide mejorar el texto o adjunta una imagen PNG/JPEG de hasta 5 MB para que el modelo de visión proponga contenido.
3. Revisa los hechos, elige la cuenta y pulsa **Aprobar y poner en cola**. Guardar borrador por sí solo no autoriza el envío.
4. En **Publicar con GitHub Actions**, elige esa cuenta y la fecha futura del primer post. La hora corresponde al dispositivo; se exporta convertida a UTC. Los posts salen uno por día, en el orden que muestra la biblioteca.
5. Elige el repositorio conectado y pulsa **Subir y reemplazar cola en GitHub**: el backend escribe únicamente `automation/queue.json` en la rama predeterminada, con los posts aprobados de la cuenta seleccionada. Esta acción reemplaza el archivo de cola existente. Como alternativa, usa **Descargar cola aprobada** y súbelo mediante **Add file → Upload files**. Mantén los IDs existentes al ampliar la cola.
6. En **Actions → Publish exported queue (no server)** ejecuta **Run workflow** para verificar configuración. Con `PUBLISH_ENABLED=false` no publica ni consume contenido. Una ejecución anterior a la fecha prevista informa que no hay posts vencidos.
7. Activa `PUBLISH_ENABLED=true` cuando esté revisado. Ya puedes apagar tu PC. Revisa el resultado en Actions y los recibos de `automation/state.json`.

La subida requiere pulsar el botón explícito; guardar o aprobar no modifica GitHub. No configura workflows ni secretos: prepara esos elementos una vez. Si usas otro repositorio para la cola, copia también `.github/workflows/linkedin_queue.yml` y `scripts/publish_queue.py`. El envío de Actions no elimina los borradores locales ni actualiza automáticamente el historial del backend. Si una subida falla sin confirmación, revisa el archivo en GitHub antes de reintentar.

La cola contiene texto e imágenes en base64. En un repositorio público será visible incluso antes de publicar: utiliza uno privado para ese contenido. El máximo es 100 posts y 50 MB por exportación; con muchas imágenes tendrás que reducir el lote. No se incluyen imágenes remotas para evitar descargas arbitrarias. El workflow no genera contenido nuevo sin aprobación.

### Horarios, pausa y errores

Los workflows consultan la cola aproximadamente cada 30 minutos y publican como máximo un post por ejecución respetando el límite diario. Aceptan posts cuyo horario haya pasado en las últimas 24 horas; los anteriores quedan pendientes de reprogramación manual. GitHub puede retrasar o descartar ejecuciones; no es un reloj con puntualidad garantizada. [Documentación de schedules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).

Para pausar la cola exportada cambia `PUBLISH_ENABLED=false` o deshabilita ese workflow. El botón **Backend listo/pausado** controla únicamente Spring Boot. Si una ejecución ya comenzó, una pausa posterior no deshace una solicitud ya enviada.

Los estados son `SENDING`, `SUCCESS` y `UNKNOWN`. El runner escribe `SENDING` en GitHub antes de comunicarse con LinkedIn. Si no puede persistirlo, no envía. Ante un resultado incierto detiene la cola y no lo reintenta automáticamente.

Para resolver `UNKNOWN`/`SENDING`, pausa Actions y revisa directamente LinkedIn. Si el post existe, conserva el recibo y cambia su estado a `SUCCESS` con el `postUrn` confirmado. Si comprobaste que no existe, conserva el recibo como `CANCELLED` y prepara un nuevo borrador con un nuevo ID para un envío deliberado. No borres los recibos para forzar reintentos. Una edición del contenido con el mismo ID ya intentado es rechazada.

Usa un único mecanismo de publicación para cada cola: `queue`, backend con Actions o Quartz. No actives el scheduler local ni pulses publicar ahora para posts ya exportados.

## B. App y backend conectados de forma permanente

Esta modalidad requiere un servidor que ejecute Docker/PostgreSQL aunque tu PC esté apagada. El frontend de producción usa `/api/v1` y Nginx lo conecta con Spring Boot. La base de datos permanece privada; el frontend escucha en `127.0.0.1:8088` para colocar un proxy HTTPS delante.

1. Configura los secretos de `.env.example` en el servidor, incluidas contraseñas separadas de administrador y usuario de PostgreSQL. `docker/postgres-init.sh` crea el usuario de aplicación sin superusuario en un volumen nuevo.
2. Usa `docker compose --env-file .env -f docker-compose.production.yml up -d --build` y configura HTTPS en el proxy del servidor. No expongas directamente PostgreSQL o el backend.
3. Para el scheduler de Actions usa `SCHEDULER_MODE=actions`, un `AUTOMATION_TOKEN` aleatorio de al menos 32 caracteres y `AUTOMATION_TENANT_ID` de tu cuenta. La ruta de automatización solo trabaja para ese tenant configurado; no acepta elegir otro por el request.
4. En GitHub define la variable de repositorio `PUBLICATION_MODE=backend`, variable `AUTOMATION_API_URL=https://tu-dominio` sin rutas/query, y secret `AUTOMATION_TOKEN` igual al del servidor. No copies a GitHub los tokens LinkedIn ni las claves de IA en esta modalidad.
5. Crea los horarios en la app, mantén simulación durante las comprobaciones y aprueba contenido. **Publish approved LinkedIn queue** invoca el backend; PostgreSQL conserva la cola, cuota e historial compartidos con la UI.

La ruta `POST /api/v1/automation/run-due` exige el Bearer de automatización, modo `actions` y cuenta configurada. Procesa el último horario vencido dentro de una ventana de 20 minutos, con recibo único por horario/instante. Una demora mayor puede perder el slot. Para precisión y continuidad del scheduler puedes usar `SCHEDULER_MODE=quartz` en un servidor permanente y desactivar ambos workflows de publicación; los fallos de envío siguen requiriendo revisión, no replay masivo.

No se eligió ni contrató hosting, no se modificaron secretos de GitHub y no se desplegó ni publicó contenido real durante este trabajo.

## Migraciones y validación antes de actualizar

Haz backup de la base y de la clave de cifrado. Se conserva V10 de metadatos; V11 invalida los códigos OTP anteriores al cambio; solicita uno nuevo. V12 añade la versión para revocar sesiones al cambiar contraseña. V13 crea los recibos duraderos de publicación y automatización y conserva las columnas de borradores. Los borradores antiguos sin aprobación explícita deben revisarse antes de encolar.

La base local inspeccionada tiene tablas pero **no tiene `flyway_schema_history`**. No basta con arrancar sobre ella ni habilitar un baseline automático genérico: marcar V1 como aplicado haría que las migraciones siguientes intentasen crear tablas existentes. Flyway queda sin baseline automático y Hibernate valida el esquema. Antes de actualizar esa instalación, respalda y restaura una copia; comprueba su correspondencia con V1–V9 y prueba un baseline **explícito V9** en la copia. Solo después, en un arranque controlado sobre la base respaldada, usa `SPRING_FLYWAY_BASELINE_ON_MIGRATE=true` y `SPRING_FLYWAY_BASELINE_VERSION=9`; retira ambas variables tras confirmar V13. Este procedimiento es exclusivo de esa base heredada sin historial; no se aplica a bases vacías ni a bases con historial válido. No se modificó la base real durante la auditoría.

Si la antigua clave AES tenía más de 32 bytes, el código anterior solo usaba sus primeros 32 bytes; si tenía menos, añadía ceros. Conserva la **clave efectiva** mientras migras datos. Para abrir credenciales históricas con ese mismo valor original, existe `ALLOW_LEGACY_ENCRYPTION_KEY=true`, desactivado por defecto; reproduce explícitamente el tratamiento anterior y sigue exigiendo un valor no vacío. Es una compatibilidad temporal para migrar, no una rotación. No reemplaces ENCRYPTION_KEY a ciegas: necesitarás un proceso que descifre con la antigua y vuelva a cifrar con la nueva, o renovar y reconectar credenciales. Los secretos predeterminados publicados deben retirarse mediante una rotación controlada.

El bootstrap del rol de PostgreSQL se ejecuta solo en volúmenes nuevos. Para una base existente no borres el volumen: crea el rol y adapta permisos/propiedad mediante una migración administrativa planificada y backup. Las migraciones previas no se reescribieron.

CI incluye frontend, auditoría npm, Python y pruebas Spring Boot con PostgreSQL efímero. Para las pruebas locales con DB usa una **base de ensayo vacía** y configura `RUN_DB_TESTS=true`, `TEST_DB_URL`, `TEST_DB_USERNAME`, `TEST_DB_PASSWORD` antes de `mvnw verify`. Las pruebas crean usuarios y cuentas ficticias con publicación en simulación.

El detalle de lo corregido y las limitaciones pendientes está en [AUDITORIA.md](AUDITORIA.md).
