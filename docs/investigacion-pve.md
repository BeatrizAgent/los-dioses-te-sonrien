# Investigación PvE: niveles 20–99

## Alcance

El nivel del formulario es el nivel declarado del personaje. Se usa para enseñar las zonas y mazmorras cuyo nivel de acceso ya se alcanzó. El rango que se muestra al lado de cada criatura es su nivel aleatorio de aparición; puede quedar por encima del nivel del personaje. No representa una recomendación de victoria.

Se catalogaron las expediciones de Italia, África y Germania cuyo acceso es 99 o inferior: 20 zonas y cuatro posiciones por zona (80 enemigos). Se catalogaron las 22 mazmorras cuyo requisito de acceso es 99 o inferior; la siguiente entrada de Germania de la lista consultada requiere nivel 102. No se incluyó Britannia, cuyas mazmorras consultadas empiezan por encima de este tramo.

## Fuentes

El [hilo de expediciones en el foro oficial de Gameforge](https://forum.gladiatus.gameforge.com/forum/thread/64-gu%C3%ADa-expediciones/?postID=125) enumera nombres, accesos y rangos de Italia, África y Germania. Es una guía escrita por jugadores, fechada originalmente en 2018, alojada en el foro oficial; el alojamiento no convierte el contenido en una especificación técnica del juego.

La [guía de jefes de mazmorra en el foro oficial](https://forum.gladiatus.gameforge.com/forum/thread/36-gu%C3%ADa-jefes-de-mazmorra/) enumera nombre, jefe, entrada, zona y modo de las mazmorras. Los [datos de expediciones de Gladiatus Fansite](https://gladiatus.gamerz-bg.com/expeditions) y su [tabla de mazmorras](https://gladiatus.gamerz-bg.com/dungeons) se usan como contraste comunitario, en particular para bandas actuales de nivel de jefe.

Cada fila en `src/data/catalog.json` contiene `sourceIds`. El objeto `sources` conserva URL, tipo y alcance de cada referencia.

## Discrepancias y confianza

- La guía española de 2018 repite «La Fortaleza de Dragón» para la ruta normal de Oribas y otra ruta de Gernasch. La tabla comunitaria actual llama a la segunda «The True Owner». Se deja ese nombre en inglés y se marca pendiente de confirmación en el cliente español; no se inventa una traducción.
- El jefe de «El Último Viaje de Sasama» aparece como «Ajejú» en la guía española de 2018 y «Akhekhu» en la tabla comunitaria actual. Se conserva el nombre comunitario actual y la grafía del foro como alias.
- Algunos niveles publicados para jefes son un único nivel, otros son bandas. Para el selector se conserva el rango comunitario de aparición; la guía del foro se mantiene como referencia del nombre, acceso y dificultad.
- Estos datos no describen los atributos de combate del personaje, no calculan riesgo ni garantizan botín o victoria.

## Uso por el generador y el bot

El formulario pide una región PvE compartida. Al cambiarla, filtra a esa misma región las zonas de expedición y las mazmorras disponibles para el nivel declarado. La validación también rechaza una configuración manipulada que mezcle regiones. Las 22 mazmorras del catálogo se comprobaron contra la región de su zona asociada.

La zona y la criatura se eligen por nombre. El generador guarda en el userscript la región, la zona, la posición y el nombre del objetivo seleccionados. En juego, el bot busca la zona por el texto del enlace visible y comprueba que el enemigo mostrado coincide exactamente con el elegido y su posición antes de hacer clic. No codifica identificadores `loc` tomados de una guía.

Para mazmorras, el generador guarda zona, nombre, requisito de acceso, dificultad y rango del jefe. El bot contrasta el enlace, la zona y el control normal/avanzado que encuentra en el juego. Si no puede asociar la ruta seleccionada a lo observado, no la inicia. El rango del jefe es información de referencia; el flujo no identifica atributos ocultos del enemigo.

El sitio no conoce el nivel real de la cuenta. Si se declara un nivel que no coincide con el personaje o la zona todavía no está disponible, la comprobación del enlace y del objetivo visible debe impedir la acción. Aun así, la configuración PvE requiere validación instalada antes de considerarse compatible en producción.
