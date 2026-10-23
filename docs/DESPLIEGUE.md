# Despliegue de AutoPost

La publicación programada se ejecuta en el backend con Quartz y PostgreSQL. Para publicar aunque tu PC esté apagada, ambos servicios deben correr en un servidor siempre disponible.

## Configuración

1. Copia `.env.example` a `.env` en la raíz.
2. Define `DB_ADMIN_PASSWORD`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` y `ENCRYPTION_KEY`. Usa secretos aleatorios y conserva la misma `ENCRYPTION_KEY` mientras haya credenciales cifradas.
3. Configura `SCHEDULER_MODE=quartz` para activar la programación en el servidor.
4. Añade `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` y la URI OAuth HTTPS que registraste en LinkedIn. Consulta [la guía de OAuth](LINKEDIN-OAUTH.md).
5. Configura `DEEPSEEK_API_KEY` para generación de texto y `NANOGPT_API_KEY` para imágenes, si usarás esas funciones.

La cookie de sesión del navegador es `HttpOnly` y no se expone al JavaScript. `SESSION_COOKIE_SECURE` vale `true` por defecto y en producción HTTPS debe permanecer así. Para desarrollo HTTP local, define `SESSION_COOKIE_SECURE=false` en la configuración de ejecución del backend. `docker-compose.production.yml` lo activa por defecto. El frontend y `/api` deben pasar por el mismo host HTTPS, como en el proxy de esta composición.

También puedes dejar esas variables vacías y permitir que cada espacio configure sus claves desde **Ajustes → Proveedores de IA**. Las claves de usuario se cifran en PostgreSQL con `ENCRYPTION_KEY`. Mantén esa clave estable y respaldada: cambiarla sin un proceso de recifrado impediría descifrar las credenciales guardadas. Configura el backend detrás de HTTPS para proteger las claves mientras se envían desde el navegador.

Los destinos de **Ajustes → Webhooks** solo admiten HTTPS público, sin puertos personalizados ni redirects. AutoPost vuelve a resolver y revisar las direcciones antes de entregar cada evento y firma el cuerpo JSON con HMAC-SHA256. Para defensa frente a cambios de DNS, configura además reglas de salida del contenedor/backend que bloqueen redes privadas, loopback, link-local y metadatos de nube. Las entregas se ejecutan de forma asíncrona y se inspeccionan desde la propia app.
6. Inicia los servicios:

   ```sh
   docker compose -f docker-compose.production.yml up -d --build
   ```

El frontend queda ligado a `127.0.0.1:8088`; publica el acceso mediante un proxy inverso con HTTPS. PostgreSQL no expone su puerto al exterior. Guarda `.env` en el servidor y no lo añadas a Git.

El backend no publica su puerto al host y confía en `X-Forwarded-For` solo en la composición de producción. El Nginx del frontend acepta ese encabezado únicamente desde la red proxy privada `172.16.0.0/12`, normaliza la dirección y reenvía un solo valor. Configura el proxy HTTPS para reemplazar `X-Forwarded-For` con la IP real del cliente, nunca para copiar un valor libre enviado por el navegador. Si usas otra subred Docker, ajusta `set_real_ip_from` en `frontend/nginx.conf`; si expones el backend directamente, deja `RATE_LIMIT_TRUST_FORWARDED_FOR=false`.

## Horarios y publicación

Configura la zona horaria, el modo de aprobación y los horarios desde **Ajustes → Programación**. En **Necesita aprobación**, AutoPost solo envía borradores aprobados. El modo **Automática** puede publicar sin revisión y debe activarse de forma deliberada. Mantén la pausa de emergencia mientras compruebas la integración.

Quartz procesa los horarios en el proceso del backend. Si el backend está detenido, no puede ejecutar trabajos. Tras un reinicio, los horarios persistidos vuelven a registrarse desde PostgreSQL. Revisa **Historial** para confirmar resultados; un intento fallido o incierto necesita revisión antes de repetirse.

## Comprobación

- Comprueba `GET /api/v1/health` detrás del proxy.
- Verifica que PostgreSQL esté saludable y que las migraciones Flyway hayan terminado.
- Conecta una cuenta LinkedIn y confirma que el token no haya expirado.
- Deja desactivada la publicación automática, crea un borrador de prueba y verifica el flujo de aprobación y el modo de simulación antes de habilitar envíos reales.
- Consulta los logs del backend y el historial de AutoPost para resolver errores.
