========================================
2. BACKEND — Spring Boot (JDK 26)
   ========================================

Descripción: Trabaja en la capa backend del generador automático de posts,
Spring Boot sobre JDK 26. Úsalo siempre que la tarea implique controladores
REST, servicios, scheduling/cron jobs, integración con la IA generativa,
integración con PostgreSQL/pgvector vía JPA/JDBC, o publicación en APIs de
redes sociales.

Este skill es para el agente responsable de la lógica de negocio,
orquestación de la generación de posts con IA, scheduling y exposición de
API REST para el frontend Angular. No debe tocar SQL de migraciones
directamente (eso es del agente de base de datos) ni componentes Angular
(eso es del agente frontend).

CONTEXTO DEL PROYECTO
- JDK 26, Spring Boot (usar la última versión GA compatible con JDK 26).
- Base de datos: PostgreSQL + pgvector, acceso vía Spring Data JPA y/o JDBC
  directo cuando se necesiten operadores vectoriales (<=>) que JPA no
  soporta nativamente.
- Scheduling: @Scheduled con expresiones cron dinámicas leídas desde la
  tabla post_schedule_config, o TaskScheduler reprogramable en caliente si
  la config cambia sin reiniciar la app.
- Integración con IA generativa para:
    1. Generar el contenido del post.
    2. Generar el embedding del post para guardarlo en pgvector.
    3. Recuperar posts similares/pasados (RAG) antes de generar, para
       "autoaprender" del histórico.

CHECKLIST ANTES DE ENTREGAR CÓDIGO DE BACKEND
[ ] ¿Los endpoints validan input (Bean Validation, @Valid)?
[ ] ¿Las llamadas a la IA y a Postgres usan timeouts y manejo de errores
explícito (no dejar que un fallo de la IA tumbe el scheduler)?
[ ] ¿Los tokens/credenciales de APIs externas están en variables de entorno
o un vault, nunca hardcodeados ni en application.yml versionado?
[ ] ¿Los endpoints que publican o cambian configuración requieren
autenticación/autorización?
[ ] ¿Hay logs suficientes para depurar por qué un post no se publicó?
[ ] ¿El código es idempotente ante reintentos (no duplicar publicaciones)?

QUÉ NO HACER
- No embeber prompts de IA con datos sin sanitizar directamente concatenados
  (riesgo de prompt injection si el contenido viene de terceros).
- No hacer llamadas síncronas bloqueantes largas en el hilo del scheduler
  sin virtual threads o un executor dedicado.
- No exponer stack traces completos en las respuestas de la API al frontend.