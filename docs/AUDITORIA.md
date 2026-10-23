# Auditoría y mejoras — 5 de octubre de 2026

Se revisaron autenticación, recuperación de contraseña, aislamiento de usuarios, generación de contenido, imágenes, publicación, horarios, migraciones, dependencias, Docker y las pantallas principales. Este informe distingue las correcciones comprobadas del trabajo pendiente; no certifica ausencia de vulnerabilidades. La publicación programada actual se ejecuta en el backend con Quartz; se retiraron los workflows de GitHub Actions.

## Hallazgos y correcciones

| Prioridad | Problema observado | Cambio implementado y evidencia |
| --- | --- | --- |
| Crítica | JWT y AES tenían claves predeterminadas en el código; AES recortaba o rellenaba claves silenciosamente. | Secretos obligatorios, AES de exactamente 32 bytes; compatibilidad histórica solo con opt-in explícito. `JwtTokenProvider`, `EncryptionService`, pruebas `JwtAndKeySecurityTest`. Revisar rotación de las credenciales existentes. |
| Alta | Recuperación de contraseña guardaba y registraba códigos de seis dígitos, sin límite de intentos. | Hash BCrypt, cinco intentos, invalidación de códigos anteriores, bloqueo transaccional al verificar. V11 invalida códigos antiguos. `PasswordResetSecurityTest`. |
| Alta | Los JWT anteriores seguían funcionando tras cambiar la contraseña. | Versión de sesión persistente, verificada contra el usuario en cada petición. V12. Prueba unitaria y HTTP con PostgreSQL aislado correctas. |
| Alta | Búsquedas de ejemplos vectoriales no filtraban el usuario. | Filtro de tenant en la consulta y comprobación defensiva de metadatos; prueba de aislamiento. Se retiraron los embeddings ficticios con valores cero. |
| Alta | El frontend almacenaba el JWT en `localStorage` y lo enviaba en `Authorization`. | La sesión del navegador ahora usa cookie `HttpOnly`, `SameSite=Lax` y `Secure` en producción. CSRF valida las mutaciones autenticadas por cookie; los clientes API pueden seguir enviando Bearer explícitamente. Angular adjunta credenciales y CSRF solo a la API propia, y únicamente un 401 protegido termina la sesión. |
| Alta | URLs de imagen podían alcanzar servicios internos; base64 aceptaba contenido arbitrario. | Solo PNG/JPEG adjuntos hasta 5 MB, validación de firma y MIME; URLs HTTPS de proveedores permitidos y sin redirecciones. SVG, direcciones locales y URLs disfrazadas rechazadas. |
| Alta | El programador podía publicar borradores sin aprobación. | Estados separados de vista previa, borrador y cola aprobada. Todas las rutas de envío pasan por `ApprovedPublicationService`. Los registros anteriores quedan como borradores para revisión. |
| Alta | Envíos inmediatos podían saltarse pausa, simulación o cuota; borrar historial restablecía la cuota. | Control común de tenant, cuenta seleccionada, pausa y límite diario por autor. La cuota usa recibos duraderos y también reserva los resultados inciertos. Se eliminó el botón de restablecer cuota. |
| Alta | Un fallo de imagen/red podía provocar otro POST de texto y duplicar el envío. | Un único POST de creación; sin fallback a texto ni reintentos automáticos. Recibo confirmado con ID real o resultado incierto para revisión. |
| Alta | Simulación consumía la cola y se registraba como éxito real. | La simulación conserva el post y no llama a LinkedIn ni reserva un intento. Prueba automatizada. |
| Alta | Cuenta de destino y deduplicación podían impedir una segunda cuenta o publicar en otra. | Destino explícito y habilitado; recibos por borrador/cuenta. No hay sustitución silenciosa de la cuenta original al republicar. |
| Media | Quartz recreaba su esquema al arrancar y Hibernate modificaba tablas por su cuenta. | Flyway como fuente del esquema, Hibernate `validate`, inicialización Quartz `never`; modo manual por defecto y Quartz explícito para activar horarios. |
| Alta | Flyway no arrancaba en Spring Boot 4 porque faltaba su starter; dos migraciones locales compartían V10. La base existente no tiene historial de Flyway. | Starter correcto y versiones únicas V1–V13, preservando V10 de metadatos. Sin baseline automático. Procedimiento de adopción explícita del esquema heredado documentado y verificado en copia aislada. |
| Media | El wrapper de Maven imponía un JDK instalado en una ruta personal. | Respeta `JAVA_HOME`; compilación y pruebas verificadas con Java 21. |
| Media | No había freno para solicitudes masivas de autenticación y generación. | Token bucket atómico compartido en PostgreSQL por IP y grupo de ruta; el límite global se consulta en cada petición. Producción normaliza la IP mediante Nginx y falla cerrado ante una caída de base. El proxy externo debe reemplazar `X-Forwarded-For`; no hay todavía límites por usuario ni WAF. |
| Alta | Dependencias npm tenían 10 avisos: 5 moderados, 3 altos y 2 críticos. | Angular y tooling actualizados a 22.2.1, lockfile renovado. Auditoría posterior: cero avisos. Maven compilado y dependencias Spring AI coherentes; no se ejecutó un escáner de CVE Maven. |
| Media | La publicación dependía de runners separados del backend. | Se retiraron los workflows externos de publicación y el CI automático del repositorio; Quartz queda como vía de publicación programada y requiere un backend siempre activo. |
| Media | El panel mostraba crecimiento, gráficos y horarios recomendados sin datos que los respaldaran. | Panel y cabecera simplificados; estados, cola e historial reales del backend. Se retiraron métricas decorativas. |

La inyección de dependencias de Spring es un mecanismo normal de arquitectura. Los riesgos aquí son dependencias comprometidas, SQL construido con entradas, SSRF, XSS, autorización y órdenes maliciosas dentro del material que lee la IA. Los nuevos accesos SQL usan parámetros. Los prompts separan las instrucciones del autor del contexto e indican que el texto de imágenes/fuentes no concede autoridad; esto reduce riesgos, pero no garantiza inmunidad a inyección de prompts. La IA no tiene herramientas de ejecución ni permiso para publicar: el autor revisa y aprueba.

## UI y flujo de trabajo

**Crear publicación** permite elegir tono profesional, técnico, personal o conversacional; público, objetivo e instrucciones adicionales. El autor puede escribir manualmente, mejorar su texto o pedir un post desde una imagen. La generación visual requiere configurar un modelo con visión, además del proveedor de texto. Un proveedor de texto no se supone multimodal.

Guardar conserva un borrador sin enviarlo. Aprobar exige texto y cuenta de destino, bloquea edición y permite retirarlo de la cola mientras no tenga un intento de envío. Hay vista previa sin métricas inventadas, estados de carga/error, navegación móvil, foco visible, soporte de movimiento reducido y aviso ante cambios sin guardar. Los fallos de IA conservan el contenido del autor.

La publicación programada actual usa Quartz en el backend; requiere un servidor activo. GitHub sigue disponible como fuente de commits, pero la cola de publicación ya no se exporta a GitHub.

Se retiraron las capturas antiguas del editor porque mostraban un flujo de publicación que ya no corresponde a AutoPost. La revisión visual actual sigue pendiente y no se afirma que esas imágenes representen el producto vigente.

## Comprobaciones

| Comprobación | Resultado local |
| --- | --- |
| Backend, Java 21, `mvnw verify` | 40 pruebas correctas, sin omisiones, con PostgreSQL aislado. Incluyen HTTP, aislamiento, cambio de contraseña, simulación y recibos que sobreviven al rollback. |
| Angular, `npm test -- --watch=false` | 34 pruebas correctas. |
| Angular, compilación de producción | Correcta. Advertencia de CSS del editor: 7,24 kB frente al presupuesto recomendado de 4 kB; por debajo del límite de error de 8 kB. |
| Editor en navegador | Guardar sin aprobar, bloqueo tras aprobación, fallo de IA sin pérdida de texto, navegación móvil y ausencia de desbordamiento horizontal comprobados con API ficticia. Capturas de escritorio y móvil. |
| Docker Compose de producción | Imágenes construidas y pila aislada arrancada con credenciales ficticias. Nginx sirve la SPA y conecta con Spring Boot; health HTTP 200 y ruta protegida anónima HTTP 401. Rol de aplicación sin superusuario, creación de bases ni roles. El frontend espera el health del backend para evitar 502 durante su arranque. |
| PostgreSQL, migraciones y bloqueo entre transacciones | V1–V13 aplicadas correctamente en base vacía; Hibernate valida el esquema. Copia solo del esquema heredado: baseline explícito V9, V10–V13 y arranque correctos. No se copiaron datos personales ni se modificó la base real. Prueba de recibo en transacción independiente sin bloquear el tenant correcta. |
| LinkedIn y proveedores de IA | Sin envíos reales ni llamadas de generación pagadas durante la auditoría. Configuración y permisos reales pendientes de validar. |

Los recibos se guardan antes de llamar a LinkedIn y sobreviven a una interrupción. Si LinkedIn acepta el post pero la respuesta o la escritura posterior falla, el resultado puede quedar `SENDING` o `UNKNOWN`. Se evita el reintento automático; no se promete entrega exactamente una vez. La revisión manual decide qué ocurrió antes de preparar otro post.

## Trabajo pendiente priorizado

1. **Actualización existente:** adoptar Flyway explícitamente después del backup y ensayo de restauración. La base local sin historial exige baseline controlado; no se modificaron datos reales. Probar credenciales y contenido histórico antes de sustituir la instalación.
2. **Credenciales históricas:** las claves predeterminadas previas estaban en el código. Preservar la clave AES efectiva para recuperar datos, renovar tokens de LinkedIn/GitHub y migrar el cifrado con procedimiento controlado. Cambiar AES sin migrar rompe el acceso a las credenciales guardadas.
3. **Autenticación pública:** se retiró el JWT de `localStorage` y se activó CSRF para sesiones por cookie. Pendiente: política de contraseñas más fuerte y límites por cuenta además de IP. Configura HTTPS y `SESSION_COOKIE_SECURE=true` en producción, reemplaza `X-Forwarded-For` en el proxy y mantén el backend sin exposición pública.
4. **Integraciones reales:** verificar scopes, caducidad y renovación de LinkedIn, roles de organizaciones y procesamiento asíncrono de imágenes. La validación heredada de organizaciones todavía no comprueba estrictamente una ACL aprobada del destino. Versionar y probar el contrato HTTP de proveedores antes de habilitar envíos.
5. **Datos y escala:** paginar la biblioteca de borradores, separar imágenes de PostgreSQL a almacenamiento de objetos, limitar tamaño/coste total de generación, definir retención y backups con restauración probada. El rol de producción no es superusuario, pero conserva permisos DDL para Flyway: conviene separar el migrador del usuario de ejecución.
6. **IA y GitHub:** la fuente GitHub heredada usa mensajes de commits y puede avanzar su marcador durante una vista previa; no analiza realmente todos los diffs. El componente vectorial no tiene ahora un proveedor de embeddings conectado: usa ejemplos relacionales. Guardar feedback no equivale a RLHF ni a entrenar un modelo. El límite global de solicitudes ya comparte estado entre instancias en PostgreSQL; quedan cuotas por tenant/proveedor y observabilidad operativa.
7. **Producto y accesibilidad:** consolidar el editor nuevo y el Studio heredado, revisar el resto de formularios y mensajes, probar teclado/lector de pantalla y focus del menú móvil. El Studio heredado ofrece variantes/imágenes que necesitan otra revisión completa. Medir alcance, conversaciones y conversión con datos reales; no hay garantía de ganar seguidores.
8. **Operación y suministro:** escáner Maven con base de vulnerabilidades, escaneo de secretos en historial, imágenes Docker fijadas por digest, alertas y backups. Dependabot está preparado; sus avisos necesitan revisión humana.

## Referencias verificadas

La publicación usa las interfaces oficiales de LinkedIn para crear publicaciones y cargar imágenes. La autorización OAuth requiere los productos y permisos que LinkedIn apruebe para cada aplicación.

## Revisión adicional — 17 de octubre de 2026

- Los endpoints de administración están protegidos con `@PreAuthorize("hasRole('ADMIN')")` y Method Security está habilitado. La política global de colores también exige administrador; el cambio del color personal deriva el usuario autenticado en el servidor, sin aceptar un identificador de usuario del cliente. Se permiten rojo, azul, verde y amarillo, y la política puede limitar las opciones disponibles.
- Las URL de webhook exigen HTTPS, dominio público, sin credenciales ni puerto personalizado. El transporte fija las IP públicas resueltas y validadas para esa entrega, conserva el host original para TLS, no sigue redirecciones y limita el tiempo y el cuerpo de respuesta; las pruebas cubren la fijación DNS y el rechazo de destinos privados.
- La paleta tiene navegación por flechas y un único color en el orden de tabulación. El panel de inicio evita estirar la tarjeta vacía de la cola a la altura de la actividad reciente.
- La administración ahora edita los tres roles existentes desde una lista cerrada, impide que el administrador cambie sus propios permisos o que se suspenda a sí mismo, invalida sesiones al editar roles y registra las acciones. La consulta bloquea las filas de administradores activos al suspender o retirar el último rol administrativo.
- Verificación de esta revisión: 28 pruebas dirigidas del backend pasaron con Java 21; la suite Angular completa aprobó 105 pruebas en 29 archivos; y la compilación de producción pasó con avisos de CSS bajo el máximo de error. PostgreSQL/Docker y la revisión visual completa no estuvieron disponibles en este proceso.

## Revisión de sesión web — 17 de octubre de 2026

- Login y registro ya no incluyen el JWT en el JSON. Spring lo entrega en `AUTOPOST_SESSION`, cookie `HttpOnly`, `SameSite=Lax` y `Secure` por defecto. En desarrollo HTTP, configura `SESSION_COOKIE_SECURE=false`; el compose de producción lo conserva activo.
- El JWT filter autentica por la cookie o por Bearer explícito. Angular ya no adjunta ni persiste JWT; restaura la sesión mediante `/users/me`. Las solicitudes mutables del navegador inicializan y envían el token CSRF; los requests Bearer explícitos mantienen el flujo de clientes API.
- La emisión y expiración de cookies se centraliza en `SessionCookieFactory`; el controlador coordina la autenticación HTTP y el servicio mantiene el estado del cliente. Esto aplica responsabilidad única a las piezas nuevas, sin afirmar que toda la aplicación heredada cumpla cada principio SOLID.
- Validación: 155 pruebas Angular y build de producción correctos; 131 pruebas backend sin fallos, con 8 omitidas (incluidas las de PostgreSQL, porque Docker no estaba accesible). Las pruebas nuevas validan lectura de JWT desde cookie y atributos/expiración de la cookie.
- Revisión estática: no se encontraron endpoints ni dependencias WebSocket/SockJS/STOMP. La generación progresiva usa SSE sobre HTTP y requiere autenticación normal de API; no hay upgrade/proxy WebSocket configurado en Nginx.
- Aún falta ejecutar PostgreSQL de integración, SAST/SCA y una prueba de penetración. Una cookie `HttpOnly` reduce el robo persistente del JWT por XSS, pero un XSS activo todavía podría hacer acciones como el usuario; no se garantiza ausencia absoluta de vulnerabilidades.
