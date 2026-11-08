# Dependencias sin uso: auditoria y limpieza

Base: `origin/main` (incluye #5, #6 y #7). Herramienta: Knip, mas busqueda propia.

## Que se hizo

- Declaradas como dependencias directas: `dompurify` (3.4.17, exacta) y `maath` (^0.10.8). Ya llegaban de forma transitiva (`jspdf` y `@react-three/drei`), asi que no cambia ninguna version instalada.
- Retiradas: `pg` y 17 devDependencies (lista abajo).
- Se queda: `vitest` (uso real en configuracion, ver abajo).
- `package-lock.json`: 0 paquetes con version distinta, 426 entradas retiradas, 0 anadidas.

`dompurify` se fija en la misma version exacta que el override existente: con un rango (`^3.4.17`) `npm install` funciona pero `npm ci` falla con "Override ... conflicts with direct dependency".

## Prueba de que nadie usa cada paquete retirado

Comando (por paquete `$p`, sobre ficheros versionados, sin `package.json` ni lockfile; el nombre debe aparecer como token completo):

    git grep -n -I -E "(^|[^A-Za-z0-9_@./-])$p([^A-Za-z0-9_-]|$)" -- . ':!package-lock.json' ':!package.json'

Control positivo del patron: con `react` devuelve 991 coincidencias. Adicionalmente, busqueda de imports/require/import() de todos ellos sobre todo el arbol (incluye ficheros no versionados), con 0 resultados:

    grep -rIlE "(from|require\(|import\()\s*['\"](pg|ajv|ajv-formats|axe-core|@axe-core/playwright|@playwright/test|playwright|sharp|jsdom|vitest|fake-indexeddb|fast-check|workbox-build|workbox-window|@testing-library/[a-z-]+|@vitest/coverage-v8)(/[^'\"]*)?['\"]" . --exclude-dir=node_modules --exclude-dir=.git --exclude=package-lock.json

Resultado por paquete (coincidencias del primer comando):

| Paquete | Coincidencias | Que son |
|---|---|---|
| `@axe-core/playwright`, `@playwright/test`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/react`, `@testing-library/user-event`, `@vitest/coverage-v8`, `ajv`, `ajv-formats`, `axe-core`, `fast-check`, `workbox-build`, `workbox-window` | 0 | nada |
| `pg` | 12 | variables locales llamadas `pg` (gradientes, colores) en `DoomFincaScreen.jsx`, `flora.js`, paginas HTML y `tf-core.min.js` vendoreado; ningun import ni script |
| `fake-indexeddb` | 1 | un comentario en `src/services/visionCacheService.js` |
| `jsdom` | 27 | solo comentarios que mencionan el entorno de pruebas |
| `lefthook` | 7 | solo comentarios y prosa en `catalog/CATALOG_VERSIONS.md` y encabezados de componentes; no hay `lefthook.yml` versionado ni script que lo invoque |
| `sharp` | 15 | solo comentarios en `anatomia.js`/`capas.js` de las criaturas ("medido con sharp"); ningun import |

Revisado ademas: scripts de `package.json`, todo `scripts/`, `vite.config.js`, `eslint.config.js`, `postcss.config.js`, `tailwind.config.js`, `.npmrc`, `.env.example` y los HTML de la raiz. Unicas menciones: comentarios en `eslint.config.js` y `scripts/sync-valle.mjs`, y una exclusion de vigilancia en `vite.config.js` (`**/playwright-report/**`), que es un patron de ruta y no un uso del paquete. El repo publico no versiona ninguna prueba (`*.test.*`, `*.spec.*`, `vitest.config`, `playwright.config`).

`npm ls <paquete> --all` confirma que nada del arbol vivo depende de ellos (el `ajv` que usa eslint es el 6.x anidado en `@eslint/eslintrc`, que no se toca).

## Lo que se queda y por que

`vitest`: `jsconfig.json` declara `"types": ["node", "vitest/globals"]`. Prueba con un `tsconfig` temporal que extiende el real:

- con `vitest/globals` presente: `tsc` rc=0 (control);
- con un tipo ausente: `error TS2688: Cannot find type definition file`.

Retirarlo exige antes editar `jsconfig.json` y quiza `src/types/vitest-stub.d.ts`; queda fuera de este PR. Es tambien el origen de las 2 vulnerabilidades moderadas que `npm audit` aun reporta (`vitest` y `@vitest/mocker`, avisos de mocks no autenticados y recorrido de rutas en Windows); no hay altas ni criticas. Si se decide retirar vitest, ese conteo baja a 0.

## Verificacion (misma maquina, base contra cambio)

| Control | `origin/main` | Con el cambio |
|---|---|---|
| `npm ci` | ok | ok (334 paquetes instalados tras retirar 372) |
| `npm run build` (prebuild + vite build + postbuild) | rc=0 | rc=0; lista de 944 lineas `dist/` con tamanos y hashes identica |
| postbuild | `audit-valle` 0 artefactos; 364 archivos de shell offline presentes | igual |
| `npm run lint` | 400 problemas (140 errores, 260 avisos), rc=1 | salida identica, mismos 400 |
| `npm audit --audit-level=high` | 0 altas, 0 criticas (9 en total: 3 bajas, 6 moderadas) | 0 altas, 0 criticas (2 moderadas) |
| Knip, dependencias | 1 sin uso + 18 devDependencies sin uso + 2 sin declarar | 0 sin uso, 0 sin declarar; queda `vitest` (arriba) |

El lint ya fallaba en `main` antes del cambio; este PR no lo empeora ni lo mejora.

## No verificado

- No hay pruebas versionadas en este repo, asi que ningun runner se ejercito; la retirada de paquetes de prueba se apoya en la ausencia de uso, no en una suite en verde.
- El `lefthook` retirado dejaba su plantilla `lefthook.yml` al instalar; el repo no la versiona y su comentario en `scripts/sync-valle.mjs` es solo documental.
- El workflow de CI del repo de origen no esta en este arbol; si alli se invoca alguno de estos paquetes (p. ej. `npx playwright`), no se pudo comprobar.
