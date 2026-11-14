# Los Dioses Te Sonríen

Web de configuración y generación de un userscript para Gladiatus, hecha con Astro y publicada en GitHub Pages. El generador compone el archivo dentro del navegador con los módulos y objetivos marcados; no envía la configuración a un servicio.

## Qué hace

- Explica las funciones del bot, sus dependencias y sus límites.
- Permite elegir módulos con casillas y genera un `.user.js` descargable.
- Deja declarar un nivel de personaje entre 20 y 99 y filtra zonas/mazmorras por requisito de acceso.
- Usa una única región PvE para expedición y mazmorra, con listas filtradas por Italia, África o Germania.
- Permite escoger el enemigo de expedición, la mazmorra y su modo normal o avanzado.
- Muestra por separado el nivel de acceso y el rango de aparición del enemigo o jefe.
- Publica un catálogo trazable de 20 zonas, 80 enemigos de expedición y 22 mazmorras.

El Gist anterior queda como copia personal/histórica. Esta web y este repositorio son la vía de generación y distribución del proyecto.

## Desarrollo

Requiere Node.js compatible con Astro y pnpm.

```powershell
pnpm install
pnpm dev
```

`src/bot/` contiene ocho fragmentos (inicio, misiones, curación, mercado, PvE, combate, tema del panel y panel) que se ensamblan dentro del mismo userscript para conservar el ámbito compartido. `src/lib/build-config.mjs` valida la selección y `src/data/catalog.json` contiene la procedencia y los datos PvE.

```powershell
pnpm test
pnpm build
```

`pnpm build` genera una configuración predeterminada para comprobar que el ensamblado funciona y después construye Astro. El archivo de compilación queda en `.generated/` y se ignora en Git. El generador interactivo permite descargar una configuración distinta desde la web.

## Datos PvE y límites

En 0.12.28, las compras de oro y alimento se preparan con una búsqueda previa de paquetes. Tras comprar, el bot exige oferta ausente, descuento exacto y un paquete de mercado único con la identidad esperada antes de continuar. Si la señal es ambigua, conserva la operación sin repetir la compra. En s64-es se observó un ciclo automático completo de oro: compra de 100.000, recepción en baúl I y anuncio a 24 horas. La compra automática de alimento y recuperación tras reinicio siguen pendientes de validación en juego.

En 0.12.29, la comprobación de una compra de alimento ambigua se aplaza y vuelve a intentarse sin repetir la compra. Si la búsqueda previa encuentra alimento igual, intenta recogerlo en lugar de comprarlo. Estos cambios están probados en simulación y pendientes de validación instalada.

En 0.12.30, la compra de apoyo a la alianza omite las búsquedas de paquetes antes y después de cada compra: comprueba la desaparición del anuncio y el descuento exacto para continuar. Una compra incierta queda pendiente sin repetirse. La compra para curación conserva su comprobación de paquetes. La nueva ruta rápida está probada en simulación y pendiente de validación en juego.

En 0.12.31, el módulo de oro seleccionado funciona al activar el bot sin otro interruptor; las nuevas ofertas se limitan a anillos de nivel 1. La recogida periódica de utilizables y la pausa de Circo tras tres listas fallidas están probadas en simulación, pendientes de validación instalada. Con la versión anterior instalada en CassiusFerox se observó la compra, recepción y anuncio a 24 horas de un anillo de 300.000; no se observó un ciclo de 500.000.

En 0.12.32, la compra de apoyo se limita a tres alimentos confirmados por ciclo de oro. Las compras inciertas no cuentan ni se repiten. La limitación está probada en simulación y pendiente de validación en juego.

En 0.12.34, la curación reconoce alimentos por su efecto sin descartar los de nivel superior, y aplaza los errores de acceso a paquetes o baúl. Las curaciones sin confirmar no se repiten con el mismo objeto. La web explica las paradas y cómo detener el bot. Comprobado en simulación; pendiente de validar instalado en juego.

En 0.12.33, los pasos de acceso a la zona y a la mazmorra tienen contadores independientes. Si una ruta realmente no progresa, solo se aplaza la mazmorra cinco minutos y las demás tareas continúan; el bot no cancela la instancia. La parada antigua por ruta repetida se recupera automáticamente. Probado en simulación; pendiente de validar instalado en juego.

En 0.12.25, cuando la página no muestra los puntos de vida en texto, el bot lee los atributos numéricos de la barra y rechaza valores inválidos. La barra se observó en el territorio de CassiusFerox; el cambio está pendiente de instalar y validar en juego.

El nivel que se escribe en el formulario es una declaración para filtrar requisitos; la web no lee la cuenta. Los rangos de nivel de los bichos proceden de guías comunitarias, incluida una publicación en el foro oficial de Gameforge. Las bandas de mazmorra se contrastan con una referencia comunitaria actual. Consulta [la investigación PvE](docs/investigacion-pve.md) para fechas, fuentes y discrepancias.

El bot comprueba la zona y el control de ataque de la posición elegida antes de atacar una expedición; muestra el nombre observado cuando está disponible. Para mazmorra valida la ruta observada, la zona y el modo que se seleccionó. Si algo no coincide, espera sin iniciar el ataque. No predice victorias y no se ha validado este flujo instalado en juego ni en un móvil real.

## Publicación

Web: https://gladibot.yampi.eu/los-dioses-te-sonrien/

El historial de rivales permanece en el almacenamiento local del navegador por personaje. El panel usa un índice temporal en memoria, reconstruido tras una recarga, y no elimina registros antiguos automáticamente. En Rivales se puede exportar el historial a JSON: contiene nombres de rivales y resultados, por lo que debe tratarse como información privada. El reinicio total elimina el historial de ese personaje tras confirmación; exportar no lo borra.

Para comparar el índice con el filtrado anterior sin datos de jugadores, ejecuta `node scripts/benchmark-rivals.mjs`. En Node 24.11.1 para Windows x64, con 100 rivales y mediana de siete ejecuciones, el filtrado y la creación del índice tardaron respectivamente 0,087/0,135 ms para 100 registros; 0,609/0,172 ms para 1.000; y 6,274/0,547 ms para 10.000. Son cifras locales, no mediciones del navegador ni una promesa de rendimiento en móviles.

GitHub Actions ejecuta `pnpm test`, genera el userscript y construye Astro. Después publica el commit comprobado en `ci/production`, solicita el despliegue a Dokploy, espera el resultado y comprueba la web. El despliegue directo por push de Dokploy debe seguir desactivado. El secreto `DOKPLOY_API_KEY` actual pertenece a la cuenta propietaria y caduca el 12 de febrero de 2027; sustituirlo por una credencial limitada al servicio cuando esté disponible. La ruta base está definida en `astro.config.mjs`.

## Límites de seguridad

- No gasta rubíes/diamantes ni usa opciones premium o reduce tiempo.
- Se detiene ante CAPTCHA o una verificación.
- Los ciclos pendientes de comida y oro se comprueban antes de iniciar acciones nuevas.
- No vender, destruir ni transferir materiales de forja, pergaminos, herramientas o botín reservado.
- Ciertas transferencias requieren Crazy Addon. El userscript no invoca Forge Master; la convivencia no está validada.

## Enlaces de instalación

La web puede mostrar un enlace HTTPS copiable para instalar la configuración elegida. El enlace contiene nivel, módulos y objetivos; no incluye credenciales. El servicio valida esa configuración y entrega el userscript. Un enlace antiguo usa la versión del servicio desplegada en ese momento. Conserva la descarga local como alternativa. La instalación mediante enlace depende del gestor y no se ha validado en móvil real.

El Dockerfile prepara la web y el servicio Node para ejecutarlos juntos en el VPS; `PUBLIC_INSTALL_ORIGIN=same-origin` habilita los enlaces durante la compilación. La aplicación escucha en el puerto 3000 y necesita un proxy HTTPS. Actualiza la web y el servicio juntos cuando cambien los fragmentos o el catálogo. Sin configurar el origen, la web estática oculta el enlace y conserva la descarga local.

## Reinicio de mazmorra (0.12.2)

Tras el número de derrotas consecutivas confirmadas contra el mismo enemigo elegido en el formulario (1–10; por defecto 3), el bot intenta cancelar la mazmorra configurada una sola vez. Si aparece el formulario de entrada, espera disponibilidad y vuelve a iniciarla con la dificultad elegida. Los resultados ambiguos no cuentan; si no puede verificar la cancelación se detiene. El botón de cancelación se observó en s64-es; el ciclo completo solo se ha probado en simulación y queda pendiente de validación instalada.

## Paquetes de oro (0.12.4)

El módulo admite ofertas de 100.000 a 1.000.000 de oro, sin limitarse a importes fijos. Selecciona la oferta válida más alta que deje una reserva de 100.000 después de compra y tarifa verificada, y anuncia el objeto al mismo precio durante 24 horas. Se conservan las demás comprobaciones de identidad y de operación pendiente. Este intervalo ampliado está probado en simulación; su aceptación y reventa en juego quedan pendientes de validar.

## Objetos de nivel 1 (0.12.5)

Admite objetos de nivel 1 de cualquier tamaño que quepan en el baúl I, salvo materiales, pergaminos, herramientas y botín reservado. Para objetos de varias casillas exige comprobar un hueco rectangular visible antes de comprar y de trasladar. Reanuncia por el precio pagado durante 24 horas. Validado en simulación; traslado y reventa de objetos grandes no verificados en juego.
## Fundición experimental 0.12.8

El generador permite activar fundición y elegir cristal, tintura o equipo verde/azul. En cristal comienza por Servius, observado en esta cuenta; revisa un prefijo por ciclo y recorre sus páginas de resultados hasta un máximo de 50. Solo considera equipo de expedición o mazmorra, no comida, materiales, herramientas, recetas ni calidad púrpura o superior. Usa Crazy Addon para traslado a baúl II, guarda recursos de huecos terminados y conserva 100.000 de oro al iniciar una fundición. Si un traslado, recogida o pago no se confirma, bloquea esa operación sin repetirla. La acción en juego es irreversible.

La secuencia automática se ensayó en simulación con DOM simplificado. En s64-es se observaron traslados e inicios de fundición de equipo Servius y retorno a expedición y mazmorra con 0.12.8. **Aún no se han confirmado los materiales producidos ni su recogida automática**, y otras cuentas y prioridades siguen sin validar. Puede no funcionar si cambian selectores, identificación del objeto o respuesta del servidor. La web y el servicio de enlaces deben actualizarse juntos cuando se use el servicio de instalación.

## Búsqueda de paquetes (0.12.10)

Una operación de oro pendiente al actualizar requiere revisión manual. En s64-es se observó que el filtro por nombre también muestra otros objetos y que los enlaces de paginación pueden llevar números repetidos. El bot compara la identidad y el origen de cada resultado, construye enlaces con un único número de página y detiene la operación si recibe páginas ambiguas o repetidas. Solo retira un objeto de oro si encuentra una coincidencia única en las páginas revisadas. Fundición también rechaza páginas ambiguas. La respuesta del filtro y la navegación limpia a la página 2 se observaron en el juego; la recuperación y reventa automáticas completas de esta versión solo se han probado parcialmente en simulación y siguen pendientes de validación instalada. No se ha confirmado que el filtro incluya todas las coincidencias existentes.

## Recuperación de avisos (0.12.11)

Ante un aviso no reconocido en los cuadros del juego que el bot detecta, vuelve una vez a una página segura para intentar retirarlo y continuar. Conserva las operaciones pendientes y no confirma sus resultados por recargar. Si el aviso persiste se detiene para evitar un bucle; ante CAPTCHA o indicios de verificación pide intervención. La recuperación se ha probado en simulación, no con todos los avisos reales. Los diálogos nativos del navegador pueden bloquear JavaScript y no están cubiertos.

## Refinamiento experimental (0.12.12)

Módulo opcional apagado por defecto. Vigila solo el equipo del personaje principal y selecciona una pieza con refinamiento del 50 % o menos. Utiliza el baúl III vacío, un hueco del banco de trabajo, oro dejando 100.000 de reserva y materiales del depósito estándar o Ceres mediante Crazy Addon. Solo inicia cuando la vista previa indica refinamiento final del 100 %. Recupera el paquete del banco y verifica que la pieza se equipa en su ranura original antes de continuar otras tareas. Una operación ambigua detiene el bot y conserva el estado para revisión; si no hay hueco o la tarifa no es verificable antes de pagar, intenta reequipar la pieza original.

En s64-es se comprobó manualmente el ciclo completo de unas botas: 1.000 de oro, 1 cobre, 30 tinturas de resistencia y 6 pociones de percepción estándar, además de refinamiento, paquete y reequipamiento confirmados. Esos importes no son universales. En la 0.12.13 se corrige una alternancia entre los baúles I y III y se programa la visita a Visión general para revisar el refinamiento. El ciclo automático solo se ha ensayado con un DOM simulado y requiere validación instalada; el filtro de paquetes no garantiza que estén representadas todas las coincidencias. Si el recurso o la identificación no se confirman, puede quedar una pieza fuera del personaje y es necesaria intervención manual.

Durante la supervisión de la 0.12.13, una pieza se retiró y sus recursos se cargaron, pero el ciclo se detuvo porque Crazy Addon restableció el selector de calidad. La pieza se reparó y reequipó manualmente en su ranura, con refinamiento al 100 %. La 0.12.14 conserva la calidad solicitada antes de cargar y permite cerrar una operación bloqueada solo tras verificar la pieza en su ranura; la corrección necesita validación instalada.

En una prueba de la 0.12.14, el bot retiró otro anillo y quedó detenido porque el menú de la ciudad estaba cerrado. El anillo se devolvió manualmente a la misma ranura sin repararlo. La 0.12.15 intenta abrir la ciudad antes del banco y, si no puede llegar, intenta reequipar la pieza original; queda pendiente validar el ciclo instalado.

En la prueba instalada de 0.12.15, el banco reparó el anillo, pero la búsqueda no reconoció el origen del paquete porque el texto incluía espacios iniciales. El anillo reparado se recogió y reequipó manualmente al 100 %. La 0.12.16 corrige esa comparación; la recuperación automática completa queda pendiente de validar instalada.

En la supervisión de 0.12.16, una armadura se detuvo antes de iniciar porque el banco mostraba el porcentaje añadido (64 %), no el porcentaje final. La armadura se refinó y reequipó manualmente al 100 %. La 0.12.17 compara el valor final previsto con el máximo leído de la pieza antes de retirarla; queda pendiente validar el ciclo automático instalado.

## Filtro de paquetes (0.12.18)

Para recuperar equipo de oro o refinamiento, se busca por un término del nombre y por tipo cuando este se reconoce. Se conserva la comparación completa de identidad y origen y se revisan todas las páginas antes de mover una coincidencia única. Si la búsqueda precisa no encuentra la pieza, se vuelve a buscar con el nombre completo y todos los tipos. En una prueba manual en s64-es, la búsqueda del nombre completo de unas botas devolvió más resultados; el término «Lulus» devolvió una coincidencia y «Elíseos», dos. No se movió esa pieza durante la prueba. El ciclo automático de recuperación con este filtro no está validado instalado.

## Versión 0.12.24

La mazmorra usa el acceso de la zona seleccionada y aplaza una instancia activa en otra zona sin cancelarla. Las operaciones de oro inciertas requieren revisión manual, sin repetir la compra. La compra de alimentos del mercado de alianza es una opción independiente, desactivada por defecto: requiere curación y puede gastar todo el saldo. Las compras confirmadas continúan automáticamente; las inciertas quedan pendientes sin repetirse. Crazy Addon sigue siendo necesario para recoger alimentos de paquetes. Las pruebas son simuladas; no garantizan aceptación del servidor ni un ciclo completo real.

### Comprobación de espacio en el mercado de alianza

La versión local calcula la cuadrícula lógica con las dimensiones de layout del baúl y usa la geometría visible para ubicar objetos, incluso con escalado. Comprueba huecos contiguos también para objetos de una casilla y rechaza posiciones ambiguas o solapadas. Las pruebas son simuladas: falta verificar una compra y el traslado completos en el juego, incluida la carga del baúl.

## Cambios locales: oro y Turma

Las nuevas ofertas de oro usan anillos de nivel 1 entre 100.000 y 1.000.000 y mantienen la reserva y la tarifa. Tras tres búsquedas sin rival reconocible, Turma Provinciarum se aplaza cinco minutos y las demás tareas continúan. Pendiente de validación en juego.

Con curación activada, el bot revisa periódicamente la categoría Utilizable y traslada un objeto al baúl I cuando hay espacio verificable. La recogida no filtra por nivel ni consume el objeto; la curación identifica alimentos por su efecto, sin descartar niveles superiores; una curación incierta no se repite con el mismo objeto. Los traslados inciertos no se repiten. Pendiente de validación del nuevo flujo en juego.
