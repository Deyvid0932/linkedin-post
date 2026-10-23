# AutoPost · navegación y Settings

Implementado el 20 de octubre de 2026 sobre los cambios locales existentes.

## Resultado

- Navegación principal compacta: Inicio, Crear, Publicaciones, Ideas y Rendimiento. Publicaciones reúne calendario, cola e historial; Ideas conserva banco y biblioteca.
- Menú inferior de cuenta con exactamente **Settings, Help y Log out**. Iconos, marca y accesos a canales más pequeños.
- Settings utiliza su propia pantalla y navegación, sustituyendo la barra principal. Agrupa Perfil, Preferencias, Seguridad, Canales, Publicación y Voz de IA; proveedores, repositorios y webhooks quedan en Avanzado. Administración mantiene su protección por rol.
- Inicio presenta datos de las APIs, disponibilidad por fuente, contenido pendiente y días con horarios recurrentes. No asigna fechas individuales que el backend no proporcione.
- Perfil permite guardar el nombre; Seguridad reúne cambio de contraseña y cierre de sesiones. La recuperación de contraseña sigue en el acceso público.
- Canales prioriza autorización de LinkedIn y muestra estado, vencimiento y preferencias. Las páginas de empresa existentes mantienen su configuración avanzada. No se simulan conexiones con Instagram o Threads.
- Preferencias conserva política de acentos y elección individual, además de claro/oscuro. El control de pausa está en Publicación.
- Se conservan alias antiguos de perfil, conexiones y administración; `/studio` y los parámetros de borrador/tema siguen disponibles.

## Validación

- Suite Angular: **185 pruebas correctas en 36 archivos**.
- Compilación de producción correcta: paquete inicial de 486,82 kB. Permanecen cinco avisos de tamaño CSS en pantallas existentes (Rendimiento, Calendario, Editor, Administración y Webhooks); no hay errores de compilación.
- Revisión visual de Inicio, Perfil, Canales y Preferencias en escritorio y móvil de 390 px, con ambos temas. Canales móvil: ancho del contenido de 390 px, sin desbordamiento horizontal.
- Pruebas de comportamiento para menú de cuenta, navegación y foco, datos indisponibles, horarios personalizados, validación/recuperación de formularios, desconexión y errores de OAuth.
- Las capturas usan un servidor temporal aislado con **datos sintéticos**, sin conexión a la base de datos ni envío de publicaciones. No constituyen una prueba de autorización real con LinkedIn.
- Esta iteración no modifica el backend ni las credenciales y no vuelve a ejecutar sus pruebas. La conexión real de LinkedIn requiere configurar la aplicación de desarrollador.

## Capturas de la implementación

- [Inicio](screenshots/buffer-redesign-20261020/inicio.png)
- [Menú de cuenta](screenshots/buffer-redesign-20261020/inicio-cuenta.png)
- [Perfil en Settings](screenshots/buffer-redesign-20261020/settings-perfil.png)
- [Canales](screenshots/buffer-redesign-20261020/settings-canales.png)
- [Canales en móvil](screenshots/buffer-redesign-20261020/canales-movil.png)
- [Preferencias en tema claro](screenshots/buffer-redesign-20261020/preferencias-claro.png)

No se realizaron commits, despliegues ni publicaciones.
