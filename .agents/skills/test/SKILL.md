========================================
4. TESTING / QA
   ========================================

Descripción: Valida y prueba el sistema completo del generador automático
de posts (Angular + Spring Boot + PostgreSQL/pgvector) trabajando en
paralelo con los agentes de frontend, backend y base de datos. Úsalo
siempre que se pida escribir tests unitarios, de integración, end-to-end,
pruebas de scheduling/cron, o verificar que un cambio en una capa no rompió
el contrato con las otras.

Este skill coordina la verificación del sistema completo. Su rol es actuar
como "puente" entre los agentes de frontend, backend y base de datos:
cuando uno de ellos entrega trabajo, este agente diseña pruebas que
confirman que el contrato entre capas sigue funcionando.

ESTRATEGIA DE PRUEBAS POR CAPA

Base de datos (PostgreSQL + pgvector):
- Probar migraciones en una base de datos efímera (Testcontainers con
  imagen pgvector/pgvector:pg16 o la que corresponda) — nunca contra la
  base real.
- Verificar que CREATE EXTENSION vector se ejecuta sin error.
- Probar que la query de similitud (<=>) devuelve resultados ordenados
  correctamente con datos de prueba conocidos.

Backend (Spring Boot / JDK 26):
- Unitarias: PostGenerationService, SchedulingService, EmbeddingService con
  mocks del cliente de IA y del repositorio.
- Integración: @SpringBootTest + Testcontainers levantando Postgres con
  pgvector real, verificando el flujo completo: config guardada -> job
  programado -> post generado -> guardado con embedding.
- Contrato de API: verificar que los DTOs expuestos coinciden con lo que
  Angular espera (usar tests de contrato o al menos golden files de JSON).
- Probar casos de falla: la API de IA no responde, la red social rechaza la
  publicación, el cron es inválido — el sistema no debe caerse ni duplicar
  publicaciones.

Frontend (Angular 22):
- Unitarias: componentes standalone con TestBed, validadores de
  formularios (incluyendo el validador de cron).
- Integración: servicios HTTP con HttpTestingController mockeando la API
  del backend.
- E2E: Playwright o Cypress cubriendo el flujo crítico: crear
  configuración de horario -> verla en el dashboard -> ver un post
  generado con su estado.

End-to-end del sistema completo:
- Levantar los tres componentes (Angular + Spring Boot + Postgres/pgvector)
  con Docker Compose o Testcontainers y correr un escenario real:
    1. Crear config de publicación vía UI/API.
    2. Forzar la ejecución del job (sin esperar el cron real).
    3. Verificar que se generó el post, se guardó el embedding, y el estado
       quedó reflejado en el dashboard.

TRABAJO EN PARALELO CON LOS OTROS AGENTES
- Cuando el agente de base de datos cambia el esquema, este agente debe
  regenerar/ajustar los fixtures de Testcontainers y avisar si el cambio
  rompe queries existentes.
- Cuando el agente de backend cambia un DTO, este agente valida que el
  agente de frontend actualice sus tipos/interfaces correspondientes.
- Cuando el agente de frontend cambia un formulario, este agente verifica
  que las validaciones sigan alineadas con las reglas reales del backend
  (ej. el cron se valida "de verdad" en el backend, no solo con la regex
  del cliente).

CHECKLIST MÍNIMO ANTES DE DAR POR BUENA UNA ENTREGA
[ ] ¿Hay al menos un test que cubra el "camino feliz" completo (config ->
generación -> publicación)?
[ ] ¿Hay tests de los casos de error más probables (IA caída, red social
caída, cron inválido, base de datos no disponible)?
[ ] ¿Los tests de integración usan datos aislados (no comparten estado
entre tests, no dependen del orden de ejecución)?
[ ] ¿Se corrieron los tests después del último cambio, no solo se
escribieron?
[ ] ¿La cobertura toca las tres capas, no solo una?

QUÉ NO HACER
- No marcar una entrega como "lista" solo porque compila; requerir
  evidencia de tests pasando.
- No usar la base de datos de producción ni credenciales reales para
  pruebas automatizadas.
- No dejar tests "flaky" (que a veces pasan y a veces no) sin
  investigarlos — suelen esconder condiciones de carrera reales en el
  scheduler.