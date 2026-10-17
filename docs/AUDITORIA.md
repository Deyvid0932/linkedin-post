# Auditoría y mejoras — 5 de octubre de 2026

Se revisaron autenticación, recuperación de contraseña, aislamiento de usuarios, generación de contenido, imágenes, publicación, horarios, migraciones, dependencias, Docker, GitHub Actions y las pantallas principales. Se implementaron correcciones y un editor nuevo. Este documento distingue las correcciones comprobadas de lo que todavía necesita integración o trabajo adicional; no certifica ausencia de vulnerabilidades.

## Hallazgos y correcciones

El correo de la ejecución [37372739380](https://github.com/Deyvid0932/linkedin-post/actions/runs/37372739380) corresponde al workflow antiguo de `main` en `56778b0`. Sus anotaciones muestran un error interno de GitHub y que no se asignó un runner hospedado tras varios intentos; el job terminó cancelado sin ejecutar el agente. No es evidencia de un fallo en Angular, Spring Boot o PostgreSQL. No se reejecutó, porque ese workflow antiguo publica directamente. Los workflows locales nuevos fijan Ubuntu 24.04 para estabilizar el entorno, pero no garantizan disponibilidad de runners.

| Prioridad | Problema observado | Cambio implementado y evidencia |
| --- | --- | --- |
| Crítica | JWT y AES tenían claves predeterminadas en el código; AES recortaba o rellenaba claves silenciosamente. | Secretos obligatorios, AES de exactamente 32 bytes; compatibilidad histórica solo con opt-in explícito. `JwtTokenProvider`, `EncryptionService`, pruebas `JwtAndKeySecurityTest`. Revisar rotación de las credenciales existentes. |
| Alta | Recuperación de contraseña guardaba y registraba códigos de seis dígitos, sin límite de intentos. | Hash BCrypt, cinco intentos, invalidación de códigos anteriores, bloqueo transaccional al verificar. V11 invalida códigos antiguos. `PasswordResetSecurityTest`. |
| Alta | Los JWT anteriores seguían funcionando tras cambiar la contraseña. | Versión de sesión persistente, verificada contra el usuario en cada petición. V12. Prueba unitaria y HTTP con PostgreSQL aislado correctas. |
| Alta | Búsquedas de ejemplos vectoriales no filtraban el usuario. | Filtro de tenant en la consulta y comprobación defensiva de metadatos; prueba de aislamiento. Se retiraron los embeddings ficticios con valores cero. |
| Alta | El cliente adjuntaba el JWT a peticiones externas y confundía 403 con sesión expirada. | Token limitado al origen/ruta de la API propia, incluidos casos de URL relativa al protocolo. Solo 401 de rutas protegidas cierra sesión. Tres pruebas del interceptor. |
| Alta | URLs de imagen podían alcanzar servicios internos; base64 aceptaba contenido arbitrario. | Solo PNG/JPEG adjuntos hasta 5 MB, validación de firma y MIME; URLs HTTPS de proveedores permitidos y sin redirecciones. SVG, direcciones locales y URLs disfrazadas rechazadas. |
| Alta | El programador podía publicar borradores sin aprobación. | Estados separados de vista previa, borrador y cola aprobada. Todas las rutas de envío pasan por `ApprovedPublicationService`. Los registros anteriores quedan como borradores para revisión. |
| Alta | Envíos inmediatos podían saltarse pausa, simulación o cuota; borrar historial restablecía la cuota. | Control común de tenant, cuenta seleccionada, pausa y límite diario por autor. La cuota usa recibos duraderos y también reserva los resultados inciertos. Se eliminó el botón de restablecer cuota. |
| Alta | Un fallo de imagen/red podía provocar otro POST de texto y duplicar el envío. | Un único POST de creación; sin fallback a texto ni reintentos automáticos. Recibo confirmado con ID real o resultado incierto para revisión. |
| Alta | Simulación consumía la cola y se registraba como éxito real. | La simulación conserva el post y no llama a LinkedIn ni reserva un intento. Prueba automatizada. |
| Alta | Cuenta de destino y deduplicación podían impedir una segunda cuenta o publicar en otra. | Destino explícito y habilitado; recibos por borrador/cuenta. No hay sustitución silenciosa de la cuenta original al republicar. |
| Media | Quartz recreaba su esquema al arrancar y Hibernate modificaba tablas por su cuenta. | Flyway como fuente del esquema, Hibernate `validate`, inicialización Quartz `never`; modo manual por defecto y modos `actions`/`quartz` excluyentes. |
| Alta | Flyway no arrancaba en Spring Boot 4 porque faltaba su starter; dos migraciones locales compartían V10. La base existente no tiene historial de Flyway. | Starter correcto y versiones únicas V1–V13, preservando V10 de metadatos. Sin baseline automático. Procedimiento de adopción explícita del esquema heredado documentado y verificado en copia aislada. |
| Media | El wrapper de Maven imponía un JDK instalado en una ruta personal. | Respeta `JAVA_HOME`; compilación y pruebas verificadas con Java 21. |
| Media | No había freno para solicitudes masivas de autenticación y generación. | Límite básico por IP e instancia y timeout de proveedores. Debe complementarse en el proxy para una aplicación pública con múltiples instancias. |
| Alta | Dependencias npm tenían 10 avisos: 5 moderados, 3 altos y 2 críticos. | Angular y tooling actualizados a 22.2.1, lockfile renovado. Auditoría posterior: cero avisos. Maven compilado y dependencias Spring AI coherentes; no se ejecutó un escáner de CVE Maven. |
| Media | Actions publicaba con lógica separada de la app; frontend de producción apuntaba a localhost. | Dos modalidades documentadas: exportación aprobada sin servidor y llamada al backend remoto. API de producción relativa al mismo origen. Workflows separados, permisos acotados, acciones fijadas por SHA y CI. |
| Media | El panel mostraba crecimiento, gráficos y horarios recomendados sin datos que los respaldaran. | Panel y cabecera simplificados; estados, cola e historial reales del backend. Se retiraron métricas decorativas. |

La inyección de dependencias de Spring es un mecanismo normal de arquitectura. Los riesgos aquí son dependencias comprometidas, SQL construido con entradas, SSRF, XSS, autorización y órdenes maliciosas dentro del material que lee la IA. Los nuevos accesos SQL usan parámetros. Los prompts separan las instrucciones del autor del contexto e indican que el texto de imágenes/fuentes no concede autoridad; esto reduce riesgos, pero no garantiza inmunidad a inyección de prompts. La IA no tiene herramientas de ejecución ni permiso para publicar: el autor revisa y aprueba.

## UI y flujo de trabajo

**Crear publicación** permite elegir tono profesional, técnico, personal o conversacional; público, objetivo e instrucciones adicionales. El autor puede escribir manualmente, mejorar su texto o pedir un post desde una imagen. La generación visual requiere configurar un modelo con visión, además del proveedor de texto. Un proveedor de texto no se supone multimodal.

Guardar conserva un borrador sin enviarlo. Aprobar exige texto y cuenta de destino, bloquea edición y permite retirarlo de la cola mientras no tenga un intento de envío. Hay vista previa sin métricas inventadas, estados de carga/error, navegación móvil, foco visible, soporte de movimiento reducido y aviso ante cambios sin guardar. Los fallos de IA conservan el contenido del autor.

La cola para Actions elige una cuenta y una fecha futura; permite descargar o subir explícitamente al repositorio conectado los posts aprobados para esa cuenta, uno por día. La subida desde el backend verifica tenant, repositorio, cuenta, aprobación y ausencia de intentos previos del backend; escribe solo `automation/queue.json`, sin credenciales. La biblioteca local conserva esos posts. **En esta modalidad el historial y la pausa de Actions se administran en GitHub**: no hay sincronización automática de vuelta a PostgreSQL. No se debe publicar la misma cola por dos mecanismos.

Las capturas de `screenshots/` muestran el editor con datos ficticios, no una conexión real a LinkedIn.

## Comprobaciones

| Comprobación | Resultado local |
| --- | --- |
| Backend, Java 21, `mvnw verify` | 40 pruebas correctas, sin omisiones, con PostgreSQL aislado. Incluyen HTTP, aislamiento, cambio de contraseña, simulación y recibos que sobreviven al rollback. |
| Angular, `npm test -- --watch=false` | 34 pruebas correctas. |
| Angular, compilación de producción | Correcta. Advertencia de CSS del editor: 7,24 kB frente al presupuesto recomendado de 4 kB; por debajo del límite de error de 8 kB. |
| Editor en navegador | Guardar sin aprobar, bloqueo tras aprobación, fallo de IA sin pérdida de texto, contenido exportado y solicitud de subida a GitHub, navegación móvil y ausencia de desbordamiento horizontal comprobados con API ficticia. Capturas de escritorio y móvil. |
| Python, `python -m unittest discover -s scripts/tests` | Nueve pruebas correctas: validación, simulación/backend, cuota, recibos previos al envío y conservación del estado incierto. |
| Docker Compose de producción | Imágenes construidas y pila aislada arrancada con credenciales ficticias. Nginx sirve la SPA y conecta con Spring Boot; health HTTP 200 y ruta protegida anónima HTTP 401. Rol de aplicación sin superusuario, creación de bases ni roles. El frontend espera el health del backend para evitar 502 durante su arranque. |
| PostgreSQL, migraciones y bloqueo entre transacciones | V1–V13 aplicadas correctamente en base vacía; Hibernate valida el esquema. Copia solo del esquema heredado: baseline explícito V9, V10–V13 y arranque correctos. No se copiaron datos personales ni se modificó la base real. Prueba de recibo en transacción independiente sin bloquear el tenant correcta. |
| LinkedIn y proveedores de IA | Sin envíos reales ni llamadas de generación pagadas durante la auditoría. Configuración y permisos reales pendientes de validar. |

Los recibos se guardan antes de llamar a LinkedIn y sobreviven a una interrupción. Si LinkedIn acepta el post pero la respuesta o la escritura posterior falla, el resultado puede quedar `SENDING` o `UNKNOWN`. Se evita el reintento automático; no se promete entrega exactamente una vez. La revisión manual decide qué ocurrió antes de preparar otro post.

## Trabajo pendiente priorizado

1. **Actualización existente:** adoptar Flyway explícitamente después del backup y ensayo de restauración. La base local sin historial exige baseline controlado; no se modificaron datos reales. Probar credenciales y contenido histórico antes de sustituir la instalación.
2. **Credenciales históricas:** las claves predeterminadas previas estaban en el código. Preservar la clave AES efectiva para recuperar datos, renovar tokens de LinkedIn/GitHub y migrar el cifrado con procedimiento controlado. Cambiar AES sin migrar rompe el acceso a las credenciales guardadas.
3. **Autenticación pública:** JWT sigue en `localStorage`, vulnerable si se introduce XSS. Evaluar cookies HttpOnly con refresh, CSRF y política de sesiones; validar contraseña más fuerte y límite por cuenta además de IP. El proxy actual agrupa las IP bajo la conexión de Nginx: requiere un límite de borde y proxies de confianza bien definidos.
4. **Integraciones reales:** verificar scopes, caducidad y renovación de LinkedIn, roles de organizaciones y procesamiento asíncrono de imágenes. La validación heredada de organizaciones todavía no comprueba estrictamente una ACL aprobada del destino. Versionar y probar el contrato HTTP de proveedores antes de habilitar envíos.
5. **Datos y escala:** paginar la biblioteca de borradores, separar imágenes de PostgreSQL a almacenamiento de objetos, limitar tamaño/coste total de generación, definir retención y backups con restauración probada. El rol de producción no es superusuario, pero conserva permisos DDL para Flyway: conviene separar el migrador del usuario de ejecución.
6. **IA y GitHub:** la fuente GitHub heredada usa mensajes de commits y puede avanzar su marcador durante una vista previa; no analiza realmente todos los diffs. El componente vectorial no tiene ahora un proveedor de embeddings conectado: usa ejemplos relacionales. Guardar feedback no equivale a RLHF ni a entrenar un modelo. Quedan contratos de fuentes, cuotas y observabilidad.
7. **Producto y accesibilidad:** consolidar el editor nuevo y el Studio heredado, revisar el resto de formularios y mensajes, probar teclado/lector de pantalla y focus del menú móvil. El Studio heredado ofrece variantes/imágenes que necesitan otra revisión completa. Medir alcance, conversaciones y conversión con datos reales; no hay garantía de ganar seguidores.
8. **Operación y suministro:** escáner Maven con base de vulnerabilidades, escaneo de secretos en historial, imágenes Docker fijadas por digest, alertas, backups y revisión de cambios en workflows. Dependabot está preparado; sus avisos necesitan revisión humana.

## Referencias verificadas

GitHub documenta que las ejecuciones programadas pueden retrasarse o descartarse y que en repositorios públicos pueden deshabilitarse por inactividad: [eventos de workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows). Los permisos mínimos y los SHA inmutables siguen la [guía de seguridad de Actions](https://docs.github.com/en/actions/reference/security/secure-use).

El runner usa los contratos oficiales de [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-07), [Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api?view=li-lms-2026-07) y [carga binaria de imágenes](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/vector-asset-api?view=li-lms-2026-07#upload-the-image). Los recibos de Actions se conservan con la [API de contenidos de GitHub](https://docs.github.com/en/rest/repos/contents).
