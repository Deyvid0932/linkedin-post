# Cola aprobada para GitHub Actions

En **Programación**, configura la vía de GitHub Actions: horario/zona, prompt propio, límite de caracteres, modelo de imagen y publicación automática o con aprobación. AutoPost escribe `autopost-config.json` en este directorio; las claves continúan en GitHub Actions Secrets. Con el PC apagado, Actions genera y publica según el modo elegido.

En modo de aprobación, los posts pendientes se guardan en `review.json` y se revisan desde AutoPost. Al aprobarlos se añaden a `queue.json`. En modo automático, el resultado e intento quedan en `autopost-history.json` y `autopost-state.json`.

También puedes preparar posts manualmente desde **Crear publicación** y subir la cola aprobada. Esa cola reemplaza `queue.json`, así que revisa su contenido antes de reemplazarla.

El archivo contiene el texto y las imágenes que has aprobado, nunca credenciales. En un repositorio público también será público: usa un repositorio privado para preparar contenido aún no publicado.

`state.json` lo crea Actions para conservar los recibos de la cola; `autopost-state.json` bloquea intentos repetidos del modo automático. No los borres: evitan repetir envíos después de un timeout o una ejecución interrumpida. Usa un repositorio privado porque textos e imágenes se almacenan en sus archivos. Las instrucciones están en [la guía de despliegue](../docs/DESPLIEGUE.md).
