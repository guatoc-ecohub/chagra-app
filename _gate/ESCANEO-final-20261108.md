# Escaneo pre-publicación — guatoc-ecohub/chagra-app

> Generado por el skill `pre-publicacion-oss` el 2026-11-08T23:56:22-05:00. Ningún valor secreto aparece en este informe: solo ruta:línea:tipo y una huella sha256 de 12 caracteres del valor.

## Veredicto: **PUBLICAR CON REVISIÓN**

- Hallazgos de severidad alta sin decisión: **0**
- Hallazgos para revisión humana: **155**
- Decisiones del operador y falsos positivos verificados, por `--permitir` (no cuentan): **13**
- Herramientas no corridas: **ninguna**
- Red para verificar tokens vivos: **sí**

Regla del veredicto: cualquier hallazgo alto sin decisión → NO PUBLICAR. Solo hallazgos de revisión, una herramienta sin correr o sin red → PUBLICAR CON REVISIÓN. Nada de eso → PUBLICAR (la checklist humana sigue aplicando).

## Alcance

| Qué | Valor |
|---|---|
| Repo local | /mnt/data/private/fleet-worktrees/home-kortux-Workspace-chagra-publico-20261103/CHAGRA-APP-LIMPIEZA-PREPUBLICACION-20261108 |
| HEAD (árbol que se publica) | 364e88bb0351 |
| Refs recorridas | 56 (locales + remotas convertidas en ramas) |
| Refs de PR traídas del remoto | 22 |
| Commits alcanzables | 49 |
| Remotos | origin: 25 refs (22 de PR);  |
| LICENSE | AGPL-3.0 (LICENSE); package.json: AGPL-3.0-only |
| Lista de decisiones (--permitir) | /mnt/data/private/fleet-worktrees/home-kortux-Workspace-chagra-publico-20261103/CHAGRA-APP-LIMPIEZA-PREPUBLICACION-20261108/.github/prepublicacion-permitidos.tsv |

## Herramientas

| Herramienta | Corrida | Versión / nota |
|---|---|---|
| gitleaks | sí | 8.30.1 · --log-opts=--all · 3 hallazgos crudos |
| trufflehog | sí | trufflehog 3.99.8 · --only-verified · 0 verificados vivos |
| nucleo | sí | patrones de config/ · {"blobs_total": 3874, "blobs_arbol": 3228, "medios": 385, "blobs_texto": 3478} |
| exiftool | sí | 13.59 · GPS, autor, serie, software |
| license-checker | sí | npx license-checker --production · 140 paquetes |

## Resumen por categoría

| Categoría | Alta | Revisión | Info | En árbol | Solo en historial/refs | Decididos |
|---|---:|---:|---:|---:|---:|---:|
| a. Secretos (historial completo y refs de PR) | 0 | 0 | 0 | 0 | 0 | 4 |
| b. Anti-leak capas 1-3 de la casa | 0 | 25 | 52 | 62 | 15 | 7 |
| c. Datos personales | 0 | 118 | 0 | 73 | 45 | 1 |
| d. Infraestructura | 0 | 0 | 0 | 0 | 0 | 0 |
| e. Metadatos de medios | 0 | 6 | 3 | 9 | 0 | 0 |
| f. Licencias | 0 | 0 | 14 | 14 | 0 | 0 |
| g. Archivos peligrosos y grandes | 0 | 6 | 0 | 2 | 4 | 1 |

## a. Secretos (historial completo y refs de PR)

Sin hallazgos. (4 decididos, ver la tabla de decisiones.)

## b. Anti-leak capas 1-3 de la casa

| Severidad | Tipo | Cuántos | Archivos distintos |
|---|---|---:|---:|
| revision | flota-codename:deepseek | 18 | 15 |
| revision | flota-codename:esclavos | 6 | 4 |
| revision | capa2-repo-pro-por-nombre:chagra-pro | 1 | 1 |

| Sev | Tipo | Ruta:línea | Dónde | Refs / commit | Huella | Herramienta | Detalle |
|---|---|---|---|---|---|---|---|
| revision | capa2-repo-pro-por-nombre:chagra-pro | `eslint.config.js:135` | árbol |  | `698555879be9` | nucleo |  |
| revision | flota-codename:deepseek | `public/cycle-content/fresa.json:173` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `public/cycle-content/lechuga.json:168` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `public/cycle-content/tomate_chonto.json:188` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `src/data/agro-lecciones.json:6` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `src/data/cursoChagra.js:87` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `src/data/dictionary.js:693` | árbol |  | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `src/data/dictionary.js:1232` | árbol |  | `6f7ac1823da8` | nucleo |  |
| revision | flota-codename:deepseek | `src/data/glosario.json:2` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `src/data/iot-hardware.json:2` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `src/data/iot-sensores-evitar.json:2` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `src/data/iot-vision-pipeline.json:2` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `src/data/soil-diagnostics.json:2` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `src/data/water-diagnostics.json:2` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `src/data/water-diagnostics.json:61` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `src/data/water-diagnostics.json:63` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `src/services/llmRouter.js:170` | árbol |  | `6f7ac1823da8` | nucleo |  |
| revision | flota-codename:deepseek | `src/services/soilDiagnostic.js:4` | árbol |  | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:deepseek | `src/services/waterDiagnostic.js:4` | árbol |  | `0648d2111ec0` | nucleo |  |
| revision | flota-codename:esclavos | `catalog/chagra-catalog-oss-subset-v3.2.json:20060` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `b461e08376b8` | nucleo |  |
| revision | flota-codename:esclavos | `catalog/chagra-catalog-oss-subset-v3.2.json:20152` | árbol |  | `b461e08376b8` | nucleo |  |
| revision | flota-codename:esclavos | `catalog/chagra-catalog-oss-subset-v3.2.json:20244` | árbol |  | `b461e08376b8` | nucleo |  |
| revision | flota-codename:esclavos | `public/cycle-content/dioscorea_cayennensis.json:73` | árbol |  | `b461e08376b8` | nucleo |  |
| revision | flota-codename:esclavos | `public/cycle-content/dioscorea_rotundata.json:73` | árbol |  | `b461e08376b8` | nucleo |  |
| revision | flota-codename:esclavos | `public/cycle-content/vigna_unguiculata.json:66` | árbol |  | `b461e08376b8` | nucleo |  |

<details><summary>Informativo (no cuenta para el veredicto)</summary>

| Tipo | Detalle | Cuántos |
|---|---|---:|
| capa2-guatoc-codename:guatoc |  | 52 |

</details>

## c. Datos personales

| Severidad | Tipo | Cuántos | Archivos distintos |
|---|---|---:|---:|
| revision | nombre-tercero:coco | 103 | 30 |
| revision | nombre-tercero:santiago | 6 | 3 |
| revision | correo-externo | 4 | 2 |
| revision | celular-3xx | 3 | 2 |
| revision | cedula-formato-puntos | 2 | 2 |

| Sev | Tipo | Ruta:línea | Dónde | Refs / commit | Huella | Herramienta | Detalle |
|---|---|---|---|---|---|---|---|
| revision | cedula-formato-puntos | `public/descensos/erosion-ladera/index.html:277` | árbol |  | `9260549005dd` | nucleo |  |
| revision | cedula-formato-puntos | `src/components/TelemetryAlerts.jsx:288` | árbol |  | `dba50cdbe815` | nucleo |  |
| revision | celular-3xx | `public/estiercol-compost/_meta.json:18` | árbol |  | `93b998ac2b1d` | nucleo |  |
| revision | celular-3xx | `public/estiercol-compost/_meta.json:22` | árbol |  | `93b998ac2b1d` | nucleo |  |
| revision | celular-3xx | `src/components/CompostScreen.jsx:50` | árbol |  | `93b998ac2b1d` | nucleo |  |
| revision | correo-externo | `package-lock.json:6508` | historial | _remoto/origin/pull/5/head, fix/oss-cve-dependencies-2026-11-07 @ 44cae97 | `b0373516d594` | nucleo | dominio izs.me |
| revision | correo-externo | `package-lock.json:6518` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `b0373516d594` | nucleo | dominio izs.me |
| revision | correo-externo | `public/descensos/citricos-hlb/index.html:286` | árbol |  | `079cb7bd9c4f` | nucleo | dominio ica.gov.co |
| revision | correo-externo | `public/descensos/citricos-hlb/index.html:1188` | árbol |  | `079cb7bd9c4f` | nucleo | dominio ica.gov.co |
| revision | nombre-tercero:coco | `catalog/SUBSET_OSS_V3.2_RATIONALE.md:101` | árbol |  | `2a6aef767af7` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/arquetipos-flora.json:1083` | árbol |  | `2a6aef767af7` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/biodiversidad-vernacular-CO.json:1338` | árbol |  | `2a6aef767af7` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/biodiversidad-vernacular-CO.json:1772` | árbol |  | `2a6aef767af7` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/biodiversidad-vernacular-CO.json:1935` | árbol |  | `2a6aef767af7` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/biopreparados-seed.json:460` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/biopreparados-seed.json:463` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.1.json:5161` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `2a6aef767af7` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.1.json:5164` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.1.json:11944` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.1.json:12045` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.1.json:16157` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:5704` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `2a6aef767af7` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:5707` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:5752` | árbol |  | `2a6aef767af7` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:5755` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:16947` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:17039` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:17138` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:17230` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:19363` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:19455` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:19512` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:19604` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:22100` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:22192` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:22566` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:22658` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:22842` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:22934` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:24917` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:25009` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:29237` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:29329` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:33646` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-oss-subset-v3.2.json:33752` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-seed-v3.1.json:7162` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-seed-v3.1.json:7165` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-seed-v3.1.json:7251` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-seed-v3.1.json:7254` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-seed-v3.1.json:7636` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-seed-v3.1.json:7734` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-seed-v3.2.json:6569` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-seed-v3.2.json:6572` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-catalog-seed-v3.2.json:7052` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-kg-graph-snapshot.json:2104` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-kg-graph-snapshot.json:2109` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-kg-graph-snapshot.json:2123` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-kg-graph-snapshot.json:2128` | árbol |  | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-kg-graph-snapshot.json:2144` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `4f682b71153f` | nucleo |  |
| revision | nombre-tercero:coco | `catalog/chagra-kg-graph-snapshot.json:2149` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `4f682b71153f` | nucleo |  |

… y 58 más en `hallazgos.tsv`.

## d. Infraestructura

Sin hallazgos.

## e. Metadatos de medios

| Severidad | Tipo | Cuántos | Archivos distintos |
|---|---|---:|---:|
| revision | autor:Artist | 3 | 3 |
| revision | autor:Copyright | 3 | 3 |

| Sev | Tipo | Ruta:línea | Dónde | Refs / commit | Huella | Herramienta | Detalle |
|---|---|---|---|---|---|---|---|
| revision | autor:Artist | `public/botica/calendula.jpg:0` | árbol |  | `db9c05e18568` | exiftool | reinhold möller |
| revision | autor:Artist | `public/botica/ortiga.jpg:0` | árbol |  | `de2e37ff8e86` | exiftool | Dominicus Johannes Bergsma |
| revision | autor:Artist | `public/botica/ruda.jpg:0` | árbol |  | `ac15971f45ca` | exiftool | KRZYSZTOF ZIARNEK |
| revision | autor:Copyright | `public/botica/calendula.jpg:0` | árbol |  | `f16b907782b8` | exiftool | CC-BY-SA |
| revision | autor:Copyright | `public/botica/manzanilla.jpg:0` | árbol |  | `b6190d956acc` | exiftool | Copyright 2008 |
| revision | autor:Copyright | `public/botica/ruda.jpg:0` | árbol |  | `ac15971f45ca` | exiftool | KRZYSZTOF ZIARNEK |

<details><summary>Informativo (no cuenta para el veredicto)</summary>

| Tipo | Detalle | Cuántos |
|---|---|---:|
| software:Encoder | Lavf62.12.100 | 2 |
| software:Encoder | Lavc62.28.100 libvpx-vp9 | 1 |

</details>

## f. Licencias

<details><summary>Informativo (no cuenta para el veredicto)</summary>

| Tipo | Detalle | Cuántos |
|---|---|---:|
| LICENSE | AGPL-3.0 (LICENSE); package.json license=AGPL-3.0-only | 1 |
| resumen-licencias | MIT: 108 | 1 |
| resumen-licencias | Apache-2.0: 11 | 1 |
| resumen-licencias | ISC: 10 | 1 |
| resumen-licencias | MIT*: 2 | 1 |
| resumen-licencias | (MPL-2.0 OR Apache-2.0): 1 | 1 |
| resumen-licencias | (MIT OR WTFPL): 1 | 1 |
| resumen-licencias | BSD-3-Clause: 1 | 1 |
| resumen-licencias | BSD-2-Clause: 1 | 1 |
| resumen-licencias | (MIT AND Zlib): 1 | 1 |
| resumen-licencias | (BSD-2-Clause OR MIT OR Apache-2.0): 1 | 1 |
| resumen-licencias | 0BSD: 1 | 1 |
| resumen-licencias | CC0-1.0: 1 | 1 |
| resumen-licencias | MIT AND BSD-3-Clause: 1 | 1 |

</details>

## g. Archivos peligrosos y grandes

| Severidad | Tipo | Cuántos | Archivos distintos |
|---|---|---:|---:|
| revision | base-de-datos | 4 | 1 |
| revision | config-escaner-en-repo | 2 | 1 |

| Sev | Tipo | Ruta:línea | Dónde | Refs / commit | Huella | Herramienta | Detalle |
|---|---|---|---|---|---|---|---|
| revision | base-de-datos | `public/catalog.sqlite:0` | árbol |  | `9fd3a739ad16` | nucleo | 3055616 bytes |
| revision | base-de-datos | `public/catalog.sqlite:0` | historial | _remoto/origin/pull/6/head @ b800b64 | `6580a0e8487d` | nucleo | 3059712 bytes |
| revision | base-de-datos | `public/catalog.sqlite:0` | historial | _local/remotes/origin/HEAD, _local/remotes/origin/chore/cabeceras-sin-cadena-modelos, _local/remotes/origin/chore/comentarios-sin-referencias-internas, _local/remotes/origin/chore/deps-sin-uso-declaradas … @ f741941 | `67971c5d9d0c` | nucleo | 3059712 bytes |
| revision | base-de-datos | `public/catalog.sqlite:0` | historial | _remoto/origin/pull/6/head, fix/public-data-provenance-20261107 @ 2a90d1c | `9ff49972ec7d` | nucleo | 3051520 bytes |
| revision | config-escaner-en-repo | `.gitleaksignore:0` | árbol |  | `bebe2159dd28` | nucleo | 485 bytes |
| revision | config-escaner-en-repo | `.gitleaksignore:0` | historial | _remoto/origin/pull/11/head, _remoto/origin/pull/13/head, ci/seguridad-codeowners-workflow-20261108, prueba/gitleaks-descartable-20261108 @ a473447 | `08ae15ea30cf` | nucleo | 162 bytes |

## Decisiones del operador y falsos positivos verificados (no son hallazgos)

Cada fila sale de la lista `--permitir`; el motivo dice quién lo decidió. Revísela: lo que entra aquí deja de contar.

| Categoría | Tipo | Ruta | Cuántos | Motivo |
|---|---|---|---:|---|
| antileak | capa2-familia | `public/botica/creditos.json` | 1 | falso positivo verificado: autor de la foto de manzanilla en Wikimedia Commons (dominio público), coincide con el campo Artist de Commons; es la atribución de la imagen (huella 0e1e847b6d1d) |
| antileak | capa2-familia | `src/data/boticaCampesina.js` | 1 | falso positivo verificado: copia JS del mismo crédito de Wikimedia Commons de la manzanilla (huella 0e1e847b6d1d) |
| antileak | capa2-operador | `CLA.md` | 1 | operador: el nombre del mantenedor queda tal como está en el CLA (huella 5928257da7be) |
| antileak | capa2-operador | `catalog/.zenodo.json` | 1 | operador: la autoría del dataset queda tal como está (huella c888aa540520) |
| antileak | capa2-operador | `catalog/CITATION.cff` | 1 | operador: la autoría del dataset queda tal como está (huella c888aa540520) |
| antileak | capa2-operador | `catalog/CITATION.cff` | 1 | operador: la autoría en preferred-citation queda tal como está (huella c888aa540520) |
| antileak | capa2-usuario-sistema | `README.md` | 1 | operador: el correo de contacto del README queda tal como está (huella 9400f0edc722) |
| archivos | credenciales | `.npmrc` | 1 | falso positivo verificado: la regla dispara por el nombre del archivo; la única versión del historial solo tiene comentarios y legacy-peer-deps=true, sin credenciales (huella d35f45208e68) |
| personales | correo-personal | `README.md` | 1 | operador: el correo de contacto del README queda tal como está (huella 14c425a5fa81) |
| secretos | gitleaks:generic-api-key | `src/services/__tests__/authService.cierreSesion.test.jsx` | 1 | falso positivo verificado: literal ficticio AT-prueba de un mock de prueba unitaria, sin uso fuera de __tests__; ya figura en .gitleaksignore (huella 4b2a382a08cc) |
| secretos | gitleaks:generic-api-key | `src/services/__tests__/tokenStore.sinIndexedDB.test.js` | 1 | falso positivo verificado: literal ficticio AT-prueba de un mock de prueba unitaria, sin uso fuera de __tests__; ya figura en .gitleaksignore (huella 667d1441bdd9) |
| secretos | gitleaks:github-pat | `_gate/prueba-token-falso.js` | 1 | operador: token inventado para comprobar que el escaneo de secretos falla; GitHub lo rechaza al verificarlo; solo vive en la ref de una PR cerrada (huella 4bbfd4183537) |
| secretos | token-github | `_gate/prueba-token-falso.js` | 1 | operador: el mismo token inventado de la prueba del escaneo, detectado por el segundo motor (huella 4bbfd4183537) |

## Checklist humana (lo que ninguna herramienta cubre)

- [ ] **README y documentos en prosa**: leer README, CONTRIBUTING, CLA y todo `*.md` buscando estrategia, modelo de negocio, nombres de pilotos o instituciones, y tono (usted, sin voseo). Los patrones solo atrapan palabras exactas, no ideas.
- [ ] **Contenido estratégico en comentarios**: posicionamiento institucional, fincas piloto, decisiones de negocio descritas sin las palabras clave de la capa 2.
- [ ] **Historial fuera del repo**: forks públicos, previews de despliegue (Cloudflare Pages/Vercel guardan builds viejos con URL propia), cachés de paquetes, Wayback Machine, capturas en issues/PR. Si algún secreto estuvo público alguna vez, **rotarlo**: borrarlo del historial no lo revoca.
- [ ] **Refs de PR del lado de GitHub**: `refs/pull/*` no se pueden borrar desde el cliente. Si un PR viejo trajo un secreto, solo el soporte de GitHub los purga; el repo nuevo de una sola rama evita heredarlos.
- [ ] **Issues, discussions, wiki, releases y Actions**: sus textos, artefactos y logs se publican con el repo y este escáner no los ve.
- [ ] **Metadatos de GitHub**: descripción, topics, autor de cada commit (nombre y correo) y firmas.
- [ ] **Licencias de recursos no-npm**: fuentes tipográficas, imágenes, modelos 3D, audio y datos. Comprobar atribuciones (CC BY exige crédito) y que nada sea NC/ND si se mezcla con AGPL.
- [ ] **Rotar** cualquier credencial que haya aparecido aquí aunque esté en un commit viejo o fuera verificada como muerta.

Detalle completo, una fila por hallazgo: `hallazgos.tsv` (sin valores, solo huellas).
