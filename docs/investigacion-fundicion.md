# Fundición: investigación y estado local

12 de noviembre de 2026. La política `src/lib/smelting-policy.mjs` es un prototipo aislado; no está incorporada al generador ni realiza movimientos. No instalarla como si fuera la funcionalidad solicitada.

En s64-es se observaron en fundición dos huecos `forge_crafting`, uno `forge_finished-succeeded` y tres `forge_closed`. El hueco terminado mostraba «Guardar recursos». Los huecos cerrados requieren una inspección adicional para distinguir los disponibles de los que implican coste; no asumir que sean gratuitos. No se pulsó guardar ni se fundió ningún objeto en esta inspección.

En paquetes se observó un equipo azul con `data-quality="1"` y clase `item-i-blue`; los materiales también pueden tener color azul. Hay que comprobar la familia y el tipo además del color. Nombres observados sitúan el prefijo después del objeto base: «Espada amplia Ichorus de las Artes Marciales». El origen de paquete no demuestra que no esté reservado.

Para priorizar cristal, la política ordena según cantidades de receta de prefijo, documentadas en https://gladiatus.gamerz-bg.com/forging/forging-goods/ores/crystal. La cantidad real obtenida depende del objeto completo y no está garantizada. Los nombres de prefijos y la clasificación necesitan validación en juego; una coincidencia textual no prueba el contenido final.

El usuario confirmó que reserva las calidades púrpura, Júpiter y Olimpo; autoriza equipo Ceres y Neptuno. Los materiales, herramientas y pergaminos siguen protegidos por las instrucciones del proyecto. El prototipo también excluye por precaución origen distinto de expedición o mazmorra y objetos marcados como reservados.

Pendiente: integración de configuración y enlaces, paginación, traslado único a baúl II, confirmación, clasificación de huecos y recogida, arrastre a fundición y confirmación de inicio. No repetir acciones ambiguas. No usar rubíes, opciones premium ni reducción de tiempo.

## Observación real: 12 de noviembre de 2026

Con el bot detenido en CassiusFerox (s64-es), se buscó «Servius», se seleccionó baúl II (`data-bag-number=513`) y se trasladó mediante doble clic de Crazy Addon el equipo azul «Guantes con remaches Servius», procedente de expedición. Se observó su aparición en baúl II y desaparición del paquete. Tras pulsar «Guardar recursos» en un hueco terminado, ese hueco pasó a `forge_closed`. Se arrastraron los guantes al `#itembox`: la vista previa identificó el objeto y ofreció 2.451 de oro o 1 rubí. Al pulsar exclusivamente `[data-rent="2"]` con `.icon_gold`, el saldo bajó 2.451 y el hueco pasó directamente a `forge_crafting`; los guantes ya no aparecían en el baúl. Duración mostrada: 01:01:04. No se espera su finalización ni se conoce el resultado de materiales. Se reactivó el bot anterior.

La prueba reveló que equipo verde en paquetes puede no tener atributo `data-quality`; la clase `item-i-green` es visible. Los filtros de tipos observados identifican comida como 7, zapatos como 8 y amuletos como 9. El color por sí solo no distingue materiales, comida, equipo o pergaminos.

## Primera supervisión instalada: 0.12.6 y corrección local 0.12.7

El 12 de noviembre se observó al script 0.12.6 abrir fundición y buscar Servius en paquetes con baúl II seleccionado. La consola mostró repetidamente un TypeError en `goldSpace`, antes del traslado de equipo: MooTools sustituye `Array.from` y no aplica el callback usado para crear la cuadrícula. Se detuvo el bot desde el panel. No se observó traslado ni pago de ese ciclo.

La corrección 0.12.7 construye la cuadrícula mediante bucles, bloquea el módulo ante excepciones y permite recuperar una búsqueda antigua únicamente si la página y los filtros coinciden. La prueba reproduce `Array.from` sustituido; 45 pruebas y compilación pasan. La versión corregida todavía necesita ser instalada y supervisada en juego.

## Supervisión real 0.12.7 y ajuste PvE 0.12.8

El 12 de noviembre de 2026, CassiusFerox reanudó la búsqueda de Servius. Se observó iniciar la fundición de «Guantes con remaches Servius de la Colina» en el hueco 0, con descenso de oro de 155.598 a 153.305; el panel confirmó la operación y después volvió a combatir. La duración mostrada era aproximadamente 57 minutos. Aún no se ha observado el material resultante ni su recogida automática.

Tras la visita a fundición se observaron avisos repetidos de ruta PvE ausente: estaba activo `submenuhead1` (ciudad), que oculta las rutas de territorio. La corrección local 0.12.8 valida el enlace visible de territorio y navega allí antes de buscar la zona. Se ha probado en simulación, incluida la exclusión de destinos externos; falta validación instalada.

## Supervisión instalada 0.12.8

El 12 de noviembre, después de instalar 0.12.8, el bot registró una victoria de expedición y una victoria de mazmorra. A las 08:12 registró «Fundición iniciada: Anillo de malaquita Servius de la Justicia» y a continuación volvió a atacar al Sumo Chamán. Esto observa el retorno a PvE después de un nuevo inicio de fundición. No se ha observado todavía el fin de esos procesos ni la recogida de sus materiales.
