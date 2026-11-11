# Los Dioses Te Sonríen

Web de configuración y generación de un userscript para Gladiatus, hecha con Astro y publicada en GitHub Pages. El generador compone el archivo dentro del navegador con los módulos y objetivos marcados; no envía la configuración a un servicio.

## Qué hace

- Explica las funciones del bot, sus dependencias y sus límites.
- Permite elegir módulos con casillas y genera un `.user.js` descargable.
- Deja declarar un nivel de personaje entre 20 y 99 y filtra zonas/mazmorras por requisito de acceso.
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

El nivel que se escribe en el formulario es una declaración para filtrar requisitos; la web no lee la cuenta. Los rangos de nivel de los bichos proceden de guías comunitarias, incluida una publicación en el foro oficial de Gameforge. Las bandas de mazmorra se contrastan con una referencia comunitaria actual. Consulta [la investigación PvE](docs/investigacion-pve.md) para fechas, fuentes y discrepancias.

El bot comprueba el nombre y la posición visibles antes de atacar una expedición. Para mazmorra valida la ruta observada, la zona y el modo que se seleccionó. Si algo no coincide, espera sin iniciar el ataque. No predice victorias y no se ha validado este flujo instalado en juego ni en un móvil real.

## Publicación

Web: https://beatrizagent.github.io/los-dioses-te-sonrien/

GitHub Actions ejecuta `pnpm test`, genera el userscript y construye Astro antes de publicar `dist/` en GitHub Pages. La ruta base del proyecto está definida en `astro.config.mjs`.

## Límites de seguridad

- No gasta rubíes/diamantes ni usa opciones premium o reduce tiempo.
- Se detiene ante CAPTCHA o una verificación.
- Los ciclos pendientes de comida y oro se comprueban antes de iniciar acciones nuevas.
- No vender, destruir ni transferir materiales de forja, pergaminos, herramientas o botín reservado.
- Ciertas transferencias requieren Crazy Addon. El userscript no invoca Forge Master; la convivencia no está validada.
