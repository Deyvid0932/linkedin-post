========================================
FRONTEND — Angular 22
========================================

Descripción: Trabaja en la capa frontend del generador automático de posts,
Angular 22. Úsalo siempre que la tarea implique componentes, formularios de
configuración (horario/día de publicación), dashboards de posts generados,
consumo de la API REST del backend, o estado de la aplicación.

Este skill es para el agente responsable de la interfaz donde el usuario
configura el generador automático de posts (horario, día, tema, plataforma)
y visualiza el histórico/resultados. No debe implementar lógica de negocio
del backend ni tocar SQL.

CONTEXTO DEL PROYECTO
- Angular 22, standalone components (nada de NgModule salvo que el proyecto
  ya los use por legado — confirmar antes de mezclar estilos).
- Consume la API REST expuesta por el backend Spring Boot:
  post_schedule_config (CRUD de configuración) y generated_post (histórico,
  estado, métricas de engagement).
- Prioridad de UX: que el usuario configure y olvide (set-and-forget), no
  que tenga que publicar manualmente.

CONVENCIONES
- Signals para estado local de componentes en vez de BehaviorSubject cuando
  el estado es simple; RxJS sigue siendo válido para streams complejos
  (websockets, polling del estado de publicación).
- Standalone components con inject() en vez de constructor injection cuando
  mejore legibilidad.
- Control flow nativo (@if, @for, @switch) en vez de *ngIf/*ngFor.
- Formularios reactivos (FormGroup/FormBuilder) para la config de
  horario/día — nunca template-driven para algo con validaciones complejas
  como expresiones cron.
- HttpClient con httpResource o inject(HttpClient) + signals para cargar
  datos, mostrando siempre estado de loading/error explícito.

PANTALLAS MÍNIMAS DEL PROYECTO
1. Configuración de publicación: día(s), hora, zona horaria, tema/prompt
   base, plataforma destino, toggle activo/inactivo.
2. Dashboard de histórico: lista de posts generados con estado
   (borrador/publicado/fallido), score de engagement, fecha.
3. Detalle de post: contenido generado, posibilidad de editar antes de
   publicar (si el flujo lo permite) o marcar feedback para el
   autoaprendizaje.
