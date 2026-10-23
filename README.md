# AutoPost — contenido para LinkedIn

AutoPost es una aplicación web para preparar, revisar, aprobar y programar publicaciones de LinkedIn. Usa Angular 22.2.1, Spring Boot 4.1 / Java 21, PostgreSQL 16 y Docker.

## Flujo de publicación

1. En **Crear publicación**, redacta manualmente o genera una propuesta con IA; puedes añadir una imagen.
2. Guarda el contenido como borrador y elige la cuenta de LinkedIn.
3. Aprueba el borrador desde AutoPost.
4. El backend publica los posts aprobados según los horarios configurados con Quartz.

La publicación automática necesita que el backend y PostgreSQL estén disponibles en un servidor. Apagar tu PC no afecta a una instancia remota; si ejecutas AutoPost solo localmente, la programación se detiene cuando apagas el equipo.

GitHub puede seguir conectado para leer cambios de repositorios y crear ideas técnicas. La publicación programada se ejecuta exclusivamente desde el backend con Quartz.

## Desarrollo local

Necesitas Java 21, Node.js 24 y Docker. Copia la única plantilla, `.env.example` de la raíz, a `.env` y completa las variables de desarrollo. Usa ese mismo archivo para Docker Compose y Spring Boot; por eso inicia el backend desde la raíz del repositorio. Para el flujo local, `SCHEDULER_MODE=manual` mantiene Quartz pausado. Para validar publicaciones programadas en un servidor, configura `SCHEDULER_MODE=quartz`.

```sh
docker compose up -d
```

Desde la raíz del repositorio:

```powershell
.\backend\mvnw.cmd -f backend\pom.xml spring-boot:run
.\backend\mvnw.cmd -f backend\pom.xml test
```

En `frontend`:

```sh
npm ci --ignore-scripts
npm start
npm test -- --watch=false
npm run build
```

Las pruebas de integración con PostgreSQL usan una base aislada mediante `RUN_DB_TESTS=true` y variables `TEST_DB_*`. Nunca apuntes dichas pruebas a tus datos de producción.

## Despliegue

Para ejecutar la aplicación con Docker en un servidor, consulta [la guía de despliegue](docs/DESPLIEGUE.md) y [la guía de autorización LinkedIn](docs/LINKEDIN-OAUTH.md). No subas `.env` ni credenciales al repositorio.

## Seguridad y alcance

El color inicial y la lista de acentos permitidos se administran de forma global; cada usuario guarda su preferencia propia. Para habilitar controles de administración, configura `AUTOPOST_ADMIN_EMAILS` con las direcciones autorizadas, separadas por comas, reinicia el backend y vuelve a iniciar sesión. La lista vacía no concede nuevos roles de administrador.

El panel administrativo permite ajustar los límites por minuto de autenticación, generación de IA y el resto de la API. El limitador usa buckets atómicos por IP y grupo de ruta en PostgreSQL, compartidos entre instancias. En Docker de producción, Nginx normaliza la IP reenviada; si cambias de proxy o red Docker, revisa `set_real_ip_from` en `frontend/nginx.conf`. Mantén `RATE_LIMIT_TRUST_FORWARDED_FOR=true` solo si el backend no es público y el proxy reemplaza el encabezado `X-Forwarded-For` por una IP verificada. Si PostgreSQL no puede comprobar el límite, la solicitud se rechaza temporalmente con HTTP 503.

Las publicaciones requieren aprobación por defecto, respetan la cuenta elegida, pausa, simulación y cuota; los recibos impiden reintentos automáticos de resultados inciertos. Las claves JWT y AES son obligatorias, los códigos de recuperación se guardan como hash y los JWT anteriores se revocan al cambiar contraseña. Las imágenes tienen validación y los accesos se limitan al tenant correspondiente.

El [informe de auditoría](docs/AUDITORIA.md) distingue las correcciones comprobadas del trabajo pendiente; no certifica ausencia de vulnerabilidades. La generación de imágenes necesita `NANOGPT_API_KEY`; la visión necesita `VISION_BASE_URL`, `VISION_API_KEY` y `VISION_MODEL` configurados en el backend.

El avance funcional de AutoPost frente a las nueve pantallas del ZIP de Stitch está documentado en [PARIDAD-STITCH.md](docs/PARIDAD-STITCH.md), incluyendo módulos parciales y límites de verificación.

En **Ajustes → Proveedores de IA**, cada espacio de trabajo puede guardar sus propias claves de DeepSeek (texto) y NanoGPT (imágenes). AutoPost las cifra usando `ENCRYPTION_KEY`; la API solo informa si la clave del espacio o la alternativa del servidor está activa. Si el espacio no guarda una clave, se usa `DEEPSEEK_API_KEY` o `NANOGPT_API_KEY` del backend. Las claves de servidor las paga y comparte el dueño del despliegue entre los espacios que no tengan clave propia. Cambiar o retirar una clave propia no muestra su valor y queda registrado en la auditoría.

En **Ajustes → Webhooks**, cada espacio puede registrar destinos HTTPS para `post.published` y `post.delivery_unknown`. AutoPost guarda cifrados la URL y el secreto HMAC, muestra el secreto solo al crear el destino y permite revisar/reintentar entregas. Se rechazan IPs literales, dominios locales, direcciones privadas/reservadas y redirects. El despliegue también debe restringir el tráfico saliente a destinos públicos para cubrir cambios de DNS durante una conexión.

