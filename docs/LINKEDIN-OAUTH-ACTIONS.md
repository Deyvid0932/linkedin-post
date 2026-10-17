# Conectar LinkedIn y GitHub Actions

AutoPost conecta perfiles personales mediante autorización OAuth de LinkedIn. La contraseña se introduce en LinkedIn; AutoPost nunca la recibe. Spring Boot intercambia el código y cifra el token con la clave `ENCRYPTION_KEY` ya usada por la aplicación. Al vincular un perfil a un repositorio, AutoPost cifra una copia con la clave pública de GitHub y la guarda como `LINKEDIN_ACCESS_TOKEN` en el entorno `production` de ese repositorio. El token nunca vuelve al navegador.

## Requisitos de LinkedIn

1. Crea una aplicación en [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps) asociada a tu organización.
2. Solicita los productos **Sign In with LinkedIn using OpenID Connect** y **Share on LinkedIn**. El segundo habilita `w_member_social`; LinkedIn debe aprobar el acceso antes de que el flujo OAuth pueda publicar. AutoPost solicita `openid profile w_member_social` y solo vincula perfiles personales.
3. En **Auth → Authorized redirect URLs**, registra exactamente:

   `https://localhost:8443/api/v1/credentials/linkedin/oauth/callback`

   LinkedIn exige una URI absoluta HTTPS registrada en la aplicación; el valor debe coincidir con `LINKEDIN_OAUTH_REDIRECT_URI`.
4. Guarda `LINKEDIN_CLIENT_ID` y `LINKEDIN_CLIENT_SECRET` en tu `.env` local o en el secret manager del servidor. No los pongas en Angular, `automation/`, variables de GitHub Actions ni en Git. Mantén `ENCRYPTION_KEY` estable mientras existan credenciales cifradas. El archivo `.env` de ejemplo solo contiene espacios vacíos: debes poner ahí el Client ID y Client Secret de tu aplicación de LinkedIn.

La referencia oficial describe el consentimiento del usuario, el código de un solo uso, la verificación de `state` y la URI HTTPS: [LinkedIn Authorization Code Flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow). La disponibilidad de productos/permisos depende de la aplicación aprobada en LinkedIn.

## HTTPS local para el callback

El archivo `docker-compose.oauth-local.yml` sirve HTTPS en `localhost:8443` y reenvía el callback a Spring Boot en `localhost:8080`. No expone el puerto a otras interfaces de red. Este proxy usa la CA de desarrollo interna de Caddy; el navegador debe confiar en esa CA para que LinkedIn pueda completar el retorno sin una advertencia de certificado.

1. Arranca PostgreSQL y Spring Boot como de costumbre. Confirma que la API responde en `http://localhost:8080/api/v1/health`.
2. En otra terminal, desde la raíz del proyecto, ejecuta `docker compose -f docker-compose.oauth-local.yml up -d`.
3. Exporta el certificado raíz de Caddy: `docker cp autopost-linkedin-oauth-https:/data/caddy/pki/authorities/local/root.crt .\oauth-local-root.crt`.
4. Confía en él solo para tu usuario de Windows: `certutil -user -addstore Root .\oauth-local-root.crt`. Cierra y vuelve a abrir el navegador. El certificado raíz es público; no es un secreto, pero puedes borrar el archivo exportado al terminar.
5. Configura `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_OAUTH_REDIRECT_URI=https://localhost:8443/api/v1/credentials/linkedin/oauth/callback`, `FRONTEND_BASE_URL=http://localhost:4200`, `LINKEDIN_OAUTH_SECURE_COOKIE=true` y `APP_CORS_ALLOWED_ORIGINS=http://localhost:4200,http://127.0.0.1:4200` en el entorno del backend. Spring Boot ejecutado directamente no carga `.env` automáticamente. En PowerShell puedes cargarlas para la terminal actual antes de arrancar:

   ```powershell
   $env:LINKEDIN_CLIENT_ID = "TU_CLIENT_ID"
   $env:LINKEDIN_CLIENT_SECRET = "TU_CLIENT_SECRET"
   $env:LINKEDIN_OAUTH_REDIRECT_URI = "https://localhost:8443/api/v1/credentials/linkedin/oauth/callback"
   $env:FRONTEND_BASE_URL = "http://localhost:4200"
   $env:LINKEDIN_OAUTH_SECURE_COOKIE = "true"
   $env:APP_CORS_ALLOWED_ORIGINS = "http://localhost:4200,http://127.0.0.1:4200"
   ```

   Después, desde `backend`, inicia Spring Boot en esa misma terminal (`.\mvnw.cmd spring-boot:run`). Si usas Docker Compose de producción, coloca las variables en el `.env` de la raíz; `docker-compose.production.yml` las pasa al contenedor del backend. No copies estos valores a Angular ni los publiques en GitHub.
6. Reinicia Spring Boot y abre **Canales → LinkedIn → Conectar LinkedIn**. La cookie de vinculación del navegador es HttpOnly, Secure, limitada al callback y expira en 10 minutos; `state` queda ligado a usuario, tenant y navegador, se guarda como hash y solo se consume una vez.

Si el portal de LinkedIn no acepta `localhost` como redirect autorizado, usa un hostname HTTPS estable de un túnel de desarrollo y configura ese mismo URL en LinkedIn, `LINKEDIN_OAUTH_REDIRECT_URI` y el proxy. No publiques el callback ni la API de desarrollo sin autenticación y TLS correctamente configurados.

Para detener el proxy: `docker compose -f docker-compose.oauth-local.yml down`. Conserva el volumen de Caddy mientras uses esa CA. Si ya no la necesitas, elimina el certificado raíz desde **Administrar certificados de usuario → Entidades de certificación raíz de confianza**; no elimines otras CA.

## Permisos GitHub para sincronizar la cuenta

En cada repositorio monitoreado, crea el entorno **Settings → Environments → production** o deja que AutoPost lo cree con su PAT. Usa un Fine-grained PAT limitado a esos repositorios, con **Environments: write** y acceso de contenido necesario para la cola; también debe poder escribir variables de Actions del entorno. Un PAT classic necesita el alcance `repo` para repositorios privados. Consulta los requisitos actualizados en [GitHub: Actions secrets API](https://docs.github.com/en/rest/actions/secrets) y [cifrado de secretos](https://docs.github.com/en/rest/guides/encrypting-secrets-for-the-rest-api).

En **Canales → GitHub**, registra el PAT y el repositorio. Después selecciona una cuenta personal en **Cuenta de LinkedIn para Actions** y pulsa **Vincular y sincronizar**. Se guardan en `production` el secreto `LINKEDIN_ACCESS_TOKEN` y las variables `LINKEDIN_AUTHOR_URN` y `LINKEDIN_PERSON_URN`. Las respuestas de AutoPost solo muestran estado, cuenta y fecha de sincronización. Si LinkedIn se desconecta, AutoPost intenta establecer `PUBLISH_ENABLED=false` y retirar el secreto; un fallo remoto conserva la vinculación y muestra un error para reintentar.

La sincronización pausa siempre `PUBLISH_ENABLED` en ese entorno para evitar cambiar una cuenta de destino y publicar accidentalmente. Revisar la vinculación no activa publicaciones. Para autorizarlas, abre **Settings → Environments → production → Environment variables** y cambia manualmente `PUBLISH_ENABLED` a `true` después de comprobar cuenta, permisos, modo y contenido. Vuelve a ponerlo en `false` para pausar. AutoPost no declara que una publicación se haya realizado hasta leer un recibo `SUCCESS` con URN de LinkedIn.

Mantén el workflow `Publish exported queue (no server)` habilitado. GitHub lo ejecuta aunque tu PC esté apagada; su cron consulta cada 15 minutos, pero la hora configurada es un objetivo y GitHub puede retrasar la ejecución. El historial y calendario leen `automation/queue.json` y `automation/state.json` al abrir o refrescar la app.

## Calendario y concurrencia

El calendario solo lista posts de la cola actual del repositorio y sus recibos, sin incluir las imágenes base64. `Previsto` significa fecha objetivo; `Publicado confirmado` requiere el recibo `SUCCESS`. La UI ofrece semana, mes, lista y reprogramación por arrastre o teclado.

Reprogramar actualiza únicamente `publishAt` y crea un commit Git normal en la rama predeterminada. Tanto AutoPost como el runner crean commits sobre la revisión que leyeron y mueven la rama sin `force`. Si otra operación cambia la rama antes, GitHub rechaza el commit; AutoPost pide recargar. El runner escribe primero un recibo `SENDING`; si pierde esa carrera, aborta antes de llamar a LinkedIn. No se pueden reprogramar posts con recibos, incluidos `SENDING` y `UNKNOWN`. No borres esos recibos para forzar un segundo envío.

## Comprobación sin publicar

Deja `PUBLISH_ENABLED=false`. Conecta LinkedIn, vincula un repositorio, confirma el estado `Credencial sincronizada` y configura Actions en **Necesita aprobación**. Revisa desde GitHub que `LINKEDIN_ACCESS_TOKEN` exista en Secrets y que la cuenta/URN sean las esperadas. Ejecuta `Publish exported queue (no server)` manualmente: no debe enviar contenido mientras `PUBLISH_ENABLED` sea `false`. Comprueba el calendario, crea un borrador futuro y prueba reprogramación. Solo cuando quieras publicar de verdad, aprueba el contenido y activa la variable de forma explícita.

El callback OAuth necesita que AutoPost y el proxy local estén ejecutándose durante la conexión inicial o reconexión. Una vez sincronizada la credencial y activada Actions, el runner de GitHub no necesita el PC. LinkedIn puede revocar o caducar permisos; si eso ocurre, vuelve a conectar la cuenta y sincroniza otra vez.
