# Estado de los archivos de catálogo (versionado)

> Última actualización: **2026-06-27** (sinonimia regional confirmada por DR + corrección de mal-etiquetados).
> Este documento aclara cuál archivo es la **verdad** y qué es cada uno de los
> demás, para que ningún script ni contributor tome el seed equivocado. No se
> borró ningún archivo: los stale se documentan aquí y se conservan por
> trazabilidad / referencia de scripts.

> **Sinonimia regional confirmada por DR (2026-06-27)**: pasada grounded sobre el
> DR de sinonimia (Gemini, 19 fuentes). Solo se integró lo marcado
> `usado_en_Colombia=SI`; descartados los nombres en inglés/extranjeros (banana
> passionfruit / banana poka / gulián / bananadilla / *(French)*) y los
> etiquetados de otro país (*(Ecuador/Perú/Bolivia/Venezuela)*). **Corrección de
> mal-etiquetado crítico**: `passiflora_tarminiana` figuraba como "Granadilla
> común / Granadilla de China" (colisión exacta con la granadilla real,
> `passiflora_ligularis`); el DR confirma granadilla=NO para esta especie →
> `nombre_comun` corregido a **"Curuba india"** + 8 `nombre_comunes_regionales`
> (curuba, curuba quiteña, curuba ecuatoriana, tacso, tacso amarillo, taxo, tumbo,
> curuba de monte). Se excluyó "curuba de Castilla" (es el principal de
> `passiflora_tripartita_mollissima` — anti-confusión). La prosa de
> `valor_pedagogico` también se corrigió ("La granadilla común" → "La curuba
> india"). `physalis_angulata` ya estaba correcto ("Uchuva silvestre / Topotopo",
> no "tomate") y el DR no trajo filas para él. El resto del DR quedó sin integrar:
> la tabla degeneró y solo contiene filas de `passiflora_tarminiana`.

> **Sinonimia regional (2026-06-25)**: 1ª pasada grounded sobre
> `nombre_comunes_regionales` (campo array — nótese el typo histórico "nombre"
> singular, es el nombre real del campo que lee `speciesResolver`/
> `directorioEspecies`). Cobertura **107 → 160 / 530** (53 staples 0→con
> regionales: cebolla cabezona/junca, ajo, apio, remolacha, cilantro, papa
> criolla, lulo, tomate de árbol, uchuva, maracuyá, granadilla, curuba, badea,
> chulupa, aguacate, cacao, café, ñame, oca, ulluco, cubio/mashua, quinua,
> chocho/tarwi, etc.). Fuentes del lote: SiB Colombia (vernacular), GBIF
> vernacularName CO, manuales AGROSAVIA, etnobotánica andina/amazónica
> documentada. Anti-confusión respetada (Cucurbita moschata≠maxima; Passiflora;
> Solanum betaceum≠lycopersicum; Persea≠Psidium). Plagas/enfermedades:
> `public/grafo-relations.json` gana `_pest_synonyms` (157 sinónimos → 56
> etiquetas canónicas) + `_pest_index` (etiqueta → especies afectadas);
> `grafoRelations.resolvePestSynonym()` resuelve "gota"/"monilia"/"broca"/
> "phytophthora infestans" → la plaga real. Backlog para DRs en
> `scratchpad/backlog-*.txt` (370 especies + 22 plagas sin sinónimo aún).

## La verdad (lo que SHIPEA)

| Archivo | species | Estado | Quién lo consume |
|---|---:|---|---|
| **`chagra-catalog-oss-subset-v3.2.json`** | **530** | ✅ **CANÓNICO / SHIPEA** | `DEFAULT_SEED` de `scripts/build-catalog-sqlite.mjs` → `public/catalog.sqlite` → PWA (directorio + agente). Es **self-contained**: incluye `species[]`, `sources[]` (71) y `biopreparados[]` (36) inline. |

`chagra-catalog-oss-subset-v3.2.json` es la única fuente de verdad para lo que
ve el usuario. Pasa `node scripts/validate-catalog.mjs --lenient-schema
catalog/chagra-catalog-oss-subset-v3.2.json` (rc=0): todos los validadores
semánticos (AMB-05/10/13/14/16/17/18/28/29) en verde. Los warnings restantes de
schema estricto son el patrón legacy de `sources[]` (`_url_pendiente` /
`_isbn_pendiente`) y `estrato` ausente en frutales perennes (varía vid/arbusto/
árbol — se deja honesto, no se inventa).

### Historia de conteo de v3.2
- 105 (curación inicial intelligence-first, `extract-oss-subset-v32.mjs`)
- → 263 (+58 páramo Cruz Verde, 2026-06-10, `_paramo_enrichment`)
- → **530** (+267 ampliación grounded grafo→catálogo, 2026-06-25): especies
  cultivables y nativas con asocio construidas desde `public/cycle-content/<id>.json`
  (prosa + requirements + source_ids grounded) + el grafo AGE `chagra_kg`
  (companions/antagonists vía `COMPATIBLE_WITH`/`ANTAGONIST_OF`) + foto en
  `public/species-images.json`. Backfill simétrico de asociaciones a las
  entradas existentes (AMB-10). +3 sources con metadata del grafo.

## Archivos STALE / legacy (NO son la verdad — conservados)

> 2026-11-06: se retiraron de este repo público cinco archivos que ningún script ni
> código del repo consumía: `chagra-catalog-graph-export.json`,
> `chagra-catalog-oss-subset-v3.1.json`, `chagra-catalog-seed-v3.0.json`,
> `chagra-catalog-seed-v3.2.json` y `control-biologico-seed.json`. Siguen en la
> historia de git (commit `f741941`) para quien necesite trazabilidad.

| Archivo | species | Qué es | ¿Por qué no se borra? |
|---|---:|---|---|
| `chagra-catalog-seed-v3.1.json` | 72 | **Stale.** Base histórica formato v3.1 referenciada por scripts de validación/ETL y por el **default hardcodeado** de `scripts/validate-catalog.mjs` (línea ~50) + el gate `lefthook`/`.github/workflows/catalog-validate.yml` (corren el validador sin argumento → validan ESTE archivo, no el que shipea). El corpus full curado vive en el repo privado hermano de módulos opcionales. | Moverlo rompería el default del validador, `lefthook`, CI y ~12 scripts (`catalog-to-age.mjs`, `extract-oss-subset-v32.mjs`, etc.). |

## Snapshot del grafo `chagra_kg` (entidades que NO existen en ningún catálogo)

| Archivo | Qué es | Quién lo consume |
|---|---|---|
| `chagra-kg-graph-snapshot.json` | Snapshot versionado (2026-07-02, vía `podman exec ... psql` read-only sobre `chagra_kg`) de nodos `Pest` (391), `BeneficialOrganism` (136), `Biopreparado` (83) con TODAS sus propiedades, + `Species` mínimo (id/nombre_comun/nombre_cientifico/familia_botanica/category, 721) + aristas `AFFECTS` y `CONTROLS`. Estas entidades (sobre todo `BeneficialOrganism`) **no existen en ningún `catalog/*.json`** — solo viven en el grafo. | `scripts/audit-contaminacion.mjs` (clases "cruce_cultivo" vía `cultivos_afectados` + aristas reales, "sobre_asociacion" vía conteo de controladores, "placeholder" vía etiquetas genéricas de `BeneficialOrganism`). Se regenera manualmente (no hay script automatizado de refresco todavía — TODO) siguiendo el patrón de `scripts/audit-milpa-citations.mjs` / `CHAGRA_AGE_PSQL_COMMAND`. |

## Nota sobre el gate de CI

`catalog-validate.yml` y `lefthook` corren `validate-catalog.mjs --lenient-schema`
**sin argumento**, por lo que validan el default `chagra-catalog-seed-v3.1.json`
(72 species stale), **no** el catálogo que shipea (v3.2, 530). El archivo que
shipea se valida en el pipeline de build (`prebuild` → `build-catalog-sqlite.mjs`,
que falla si el conteo no cuadra) y en `tests/unit/catalog-count.test.js` (gate
de CI `unit-tests.yml`, que asierta `species.length === 530`). Apuntar el gate del
validador a v3.2 es una mejora pendiente fuera del alcance de este cambio (evita
tocar la config de CI en el mismo PR de datos).

## Miscategorizaciones en `audit-contaminacion.mjs` (clase `miscategorizacion`)

Snapshot **2026-07-03** (post-PR #2002 que arregló el único hallazgo que vivía en
el seed v3.1 — entrada de `oryza_sativa.plagas_criticas` reescrita con acrónimo
VHB para evitar falso match del regex `VIRUS_RE = /\bvirus\b/i`).

Estado por archivo (verificado con `detectMiscategorizacion` archivo por archivo):

| Archivo | Hallazgos | Nota |
|---|---:|---|
| `chagra-catalog-seed-v3.1.json` | 0 | Limpio. Editar este archivo NO reduce el conteo global porque el seed está limpio desde PR #2002. |
| `chagra-catalog-oss-subset-v3.2.json` | 0 | CANÓNICO que shipea (`DEFAULT_SEED` de `build-catalog-sqlite.mjs`). Limpio. |

Los 8 hallazgos restantes vivían en dos archivos stale derivados que ya se retiraron del repo (ver arriba).
Reducir el conteo requiere regenerar esos snapshots (vía `extract-oss-subset.mjs`
+ `export-graph-to-catalog.mjs`) o editarlos directamente — ambos fuera del scope
de tasks que prohiben tocar derivados. El gate `--check` del auditor usa
`scripts/audit-contaminacion-baseline.json` para que el conteo actual (52
hallazgos, 8 de ellos miscategorización) no bloquee CI mientras llega esa
regeneración.
