# Chagra — Catálogo agroecológico público

**Licencia:** AGPL-3.0-only para los datos y el código propios. Las fotos de terceros conservan sus licencias y atribuciones. Ver `LICENSE.md` en este directorio.

**Source of truth canónico:** este directorio en el repo público `guatoc-ecohub/chagra-app`. Decisión formalizada en **ADR-026** (Scope público/privado del catálogo) y **ADR-025** (Format reconciliation markdown ↔ JSON).

## Estructura

| Archivo | Rol |
|---------|-----|
| `schema-v3.1.json` | JSON Schema draft-07 con definición formal de `species`, `biopreparado`, `source` |
| `chagra-catalog-oss-subset-v3.2.json` | **Catálogo OSS canónico (581 especies, 36 biopreparados y 132 fuentes en `sources[]`)** — el archivo que consume la PWA vía `npm run build:catalog` → `public/catalog.sqlite` (es el `DEFAULT_SEED` en `scripts/build-catalog-sqlite.mjs`). Es autocontenido y no se deriva en vivo de otro seed. Ver `CATALOG_VERSIONS.md` para el estado de cada archivo. |
| `chagra-catalog-seed-v3.1.json` | Catálogo fuente (formato v3.1) del cual se extrae el subset OSS via `scripts/extract-oss-subset-v32.mjs`. El corpus full curado vive en el repo privado hermano; en este repo público se conserva la base referenciada por los scripts de validación/ETL. |
| `biopreparados-seed.json` | Catálogo de biopreparados agroecológicos |
| `sources-seed.json` | Fuentes científicas referenciadas por `species[].source_ids` |
| `AMBIGUITIES_RESOLUTION.md` | Las 11 ambigüedades del schema v3 resueltas (ADR-013) |
| `LICENSE.md` | AGPL-3.0-only. Fotos bajo sus licencias originales |

### Subset OSS vs catálogo full

Este árbol publica un **subset curado** bajo AGPL-3.0-only. Las fotografías de terceros conservan las licencias que figuran en sus manifiestos.

El subset que **realmente ships** y compila a `public/catalog.sqlite` es `chagra-catalog-oss-subset-v3.2.json`:

- **581 especies**, conteo directo de `species[]`.
- **36 biopreparados**, conteo directo de `biopreparados[]`.
- **132 fuentes**, conteo directo de `sources[]`.

El primer subset OSS (`chagra-catalog-oss-subset-v3.1.json`, 50 species, criterio editorial-v2) cortaba species críticas (aguacate, tomate, lechuga, acelga) y fue revertido en PR #1012; se retiró del repo el 2026-11-06 y sigue disponible en la historia de git (commit `f741941`).

Para reconstruir el subset desde el full Pro (idempotente):

```bash
node scripts/build-oss-subset.mjs <ruta-al-full> catalog/chagra-catalog-seed-v3.1.json
```

El script poda automáticamente `companions[]` / `antagonists[]` / `recommended_covers[]` / `recommended_fences[]` / `especies_nativas_sustitutas[]` para que solo apunten a IDs presentes en el subset, manteniendo AMB-10 (simetría) y AMB-13 (cross-refs) verdes.

## Pipeline ADR-025 (markdown frontmatter → JSON)

Las fichas narrativas viven en `docs/species/[NN]-[id].md`. Cuando una ficha tiene frontmatter YAML completo cubriendo el schema v3.1, el script `scripts/md-fichas-to-catalog-json.mjs` la migra al seed JSON. Fichas legacy sin frontmatter se conservan saltadas (warning, no error).

```bash
# Regenerar JSON desde fichas markdown
node scripts/md-fichas-to-catalog-json.mjs

# Validar coherencia (CI mode — no escribe)
node scripts/md-fichas-to-catalog-json.mjs --check

# Validar JSON contra schema + reglas semánticas (AMB-05/10/11/13/14/15)
node scripts/validate-catalog.mjs

# Build SQLite WASM consumible por la PWA
npm run build:catalog
```

## Convención de IDs

`species[].id` sigue patrón `género_especie` snake_case estable. Ej: `persea_americana`, `coffea_arabica`, `inga_edulis`.

`source_ids` sigue patrón `<institucion>-<año>-<slug>`. Ej: `agrosavia-2020-aguacate`, `humboldt-2020-frailejones`, `restrepo-1996-abc-agricultura-organica`.

## Validación humana (ADR-016)

Cada `species[]` lleva campo `validation_level`:
- `unreviewed_draft` — borrador editorial sin revisar
- `operator_reviewed` — el operador la verificó
- `agronomist_validated` — un agrónomo con registro profesional la firmó (campo `validated_by[]`)
- `community_attested` — saber tradicional documentado y atestiguado por custodios

Las contribuciones externas vía PR DEBEN venir con `validation_level: unreviewed_draft` o superior + `source_ids[]` poblado.

## Atribución requerida

Al usar, modificar o redistribuir este catálogo, cite:

> Chagra (2026). Chagra species catalog v3.2 (OSS subset, 581 species). AGPL-3.0-only. https://github.com/guatoc-ecohub/chagra-app

## Boundary OSS / Pro

Esta página documenta el subset que está versionado en este repositorio. Sus conteos y ejemplos se derivan de `chagra-catalog-oss-subset-v3.2.json`; no incluye comparaciones con catálogos que no están en este árbol.
