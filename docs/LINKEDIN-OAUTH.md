# Conectar LinkedIn mediante OAuth

AutoPost conecta perfiles personales mediante autorización OAuth de LinkedIn. La contraseña se introduce en LinkedIn; AutoPost nunca la recibe. Spring Boot intercambia el código y cifra el token con `ENCRYPTION_KEY`. La autorización permite que el backend publique desde la cuenta conectada cuando esté activo y disponible.

## Requisitos de LinkedIn

1. Crea una aplicación en [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps) asociada a tu organización.
2. Solicita **Sign In with LinkedIn using OpenID Connect** y **Share on LinkedIn**. LinkedIn debe aprobar los productos y permisos necesarios para publicar.
3. En **Auth → Authorized redirect URLs**, registra exactamente la URI configurada en `LINKEDIN_OAUTH_REDIRECT_URI`. El valor local predeterminado es:

   `https://localhost:8443/api/v1/credentials/linkedin/oauth/callback`

4. Guarda `LINKEDIN_CLIENT_ID` y `LINKEDIN_CLIENT_SECRET` en el `.env` local o en el gestor de secretos del servidor. No los pongas en Angular ni en Git. Mantén `ENCRYPTION_KEY` estable mientras existan credenciales cifradas.

La referencia oficial describe el consentimiento, el código de un solo uso, la verificación de `state` y la URI HTTPS: [LinkedIn Authorization Code Flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow). Los permisos disponibles dependen de la aprobación de tu aplicación.

## Callback HTTPS local

`docker-compose.oauth-local.yml` sirve HTTPS en `localhost:8443` y reenvía el callback a Spring Boot en `localhost:8080`. No expone el puerto a otras interfaces de red.

1. Arranca PostgreSQL y Spring Boot. Confirma que la API responda en `http://localhost:8080/api/v1/health`.
2. Desde la raíz del proyecto, inicia el proxy:

   ```powershell
   docker compose -f docker-compose.oauth-local.yml up -d
   ```

3. Si LinkedIn rechaza el certificado local, confía la CA de desarrollo de Caddy solo para tu usuario. Para un entorno compartido, usa un dominio HTTPS válido.
4. Define las variables OAuth en el entorno de Spring Boot y reinícialo.
5. Abre **Canales → LinkedIn → Conectar LinkedIn**. El `state` queda vinculado a usuario, tenant y navegador, se almacena como hash y se consume una vez. La cookie de seguridad expira en 10 minutos.

Para detener el proxy, ejecuta `docker compose -f docker-compose.oauth-local.yml down`. No expongas la API de desarrollo a internet sin autenticación y TLS correctamente configurados.
