# Axelbot · Guía para Gladiatus

Web estática en Astro. Explica funciones, instalación en escritorio y móvil, requisitos y límites de Axelbot. El userscript se distribuye desde el [Gist oficial](https://gist.github.com/BeatrizAgent/070b093e6207955f67ed4e88c612863b).

## Desarrollo

```powershell
pnpm install
pnpm dev
```

## Publicación

GitHub Actions construye Astro y publica `dist/` en GitHub Pages al hacer push a `main`. `astro.config.mjs` define el subpath del repositorio.
