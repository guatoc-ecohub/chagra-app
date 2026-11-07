# Informe: retiro del piloto Kart sin uso

## Hallazgos y cambio

- Se retiró `public/valle/juegos/chagra-kart/js/pilotos.js`: la búsqueda de su nombre exacto en el repositorio no encontró consumidores fuera del propio archivo.
- Se conservó `public/valle/pasto-vivo.svg`. Tiene un uso directo en `src/mockups/valle/PastoVivoValle.jsx:159`, donde `THREE.TextureLoader` carga `/valle/pasto-vivo.svg`.
- La búsqueda de `pilotos.js` y `pasto-vivo.svg` en `src/`, `public/`, `index.html`, `scripts/` y `vite.config.js` deja una coincidencia: la carga del SVG indicada arriba. Por esa dependencia, el criterio de cero referencias para `pasto-vivo.svg` no se cumple sin tocar su consumidor, que el encargo indica preservar cuando exista un uso.

## Validación

- `npm ci`: terminó con código 0.
- Build del contenido original de `origin/main`, con `pilotos.js` restituido temporalmente desde el HEAD: `npm run build` terminó con código 0; Vite compiló y los dos chequeos posteriores finalizaron correctamente.
- Build con `pilotos.js` retirado: `npm run build` terminó con código 0; Vite compiló en 32,11 s y los chequeos posteriores finalizaron correctamente (`audit-valle` y `OFFLINE_SHELL_ASSETS`, 364 archivos presentes).
- `git diff --check`: terminó con código 0.
- El prebuild regeneró `public/catalog.sqlite`, `public/chagra-stats.json` y `public/cycle-content/manifest.json`; se reconstruyeron desde el HEAD para excluir esos cambios ajenos al arreglo.

## No verificado

- No se ejecutó la suite completa de CI; la aceptación solicitó verificar el build.
- El requisito literal de no dejar ninguna referencia a `pasto-vivo` queda pendiente por el uso activo del mockup descrito arriba. El SVG se conserva de acuerdo con la condición de no retirar archivos utilizados.
