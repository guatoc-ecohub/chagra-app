# INFORME — CHAGRA-APP-LIMPIEZA-PREPUBLICACION-20261108

**Rama solo local, a propósito**: este informe nombra rutas del host y del skill, y el repo es PUBLIC (`gh repo view` → `PUBLIC`). No se empuja. La entrega es la PR #21 (rama `chore/limpieza-prepublicacion`, `364e88b`, en origin según `ls-remote`).

## Entregado (medido)
- PR https://github.com/guatoc-ecohub/chagra-app/pull/21: 3 commits, autor y committer `guatoc-ecohub <142938895+…noreply>`, 0 trailers. CI: build y audit pass, gitleaks pass, lint pass. `MERGEABLE`. No mergeado.
- `catalog.sqlite`: regenerado con `scripts/build-catalog-sqlite.mjs` (better-sqlite3, `npm ci` local). Nombre del repo privado: 19 → 0 (`strings`), 0 con `sqlite3 … like`. Diff semántico: 19 filas de species, solo `_curation_status`; 12 biopreparados, 13+1 sources y 1 fermento se ponen al día con la semilla de main (estaba desfasada desde #6 y siguientes); los 2 comentarios `ADR-n` del esquema desaparecen porque el script de main ya no los tiene (efecto de regenerar, no edición).
- Fuentes: Baloo 2 v1.700 y Nunito v3.602, subconjuntos latinos de Google Fonts. nameID 0 = copyright de `google/fonts` `ofl/*/OFL.txt` y METADATA.pb `license: "OFL"`. OFL.txt copiado byte por byte.
- Lista `--permitir`: el skill **no tiene almacén propio**; es un TSV pasado por ruta (`nucleo.py:cargar_permitir/permitido`), con match por ruta-glob + `cat:tipo` + línea. **No hay match por huella**: la huella va en el motivo. Vive en `.github/prepublicacion-permitidos.tsv`.
- Escáner: sin lista → NO PUBLICAR (13 altas, 155 rev). Con lista → **PUBLICAR CON REVISIÓN** (0 altas, 155 rev, 13 decididos, 0 tokens vivos, todas las herramientas corridas). Informe crudo: `_gate/ESCANEO-final-20261108.md`.
- ADR/DR en origin/main `d674f38`: 95 `ADR-n` en 45 archivos de texto; 0 `DR-n` sueltas (`(?<![A-Za-z])DR-\d+`). No se tocaron.

## Lo que NO verifiqué / pendientes
- Los manuales `public/manual/mv-*.html` (4) incrustan Baloo 2/Nunito en base64 sin enlace a la licencia. Fuera del brief (no son `.woff2`); dicho en el PR.
- `biopreparados` del sqlite y de la semilla contienen `_curation_status` con «caso <nombre de pila> trozador»: un nombre propio de un tercero en datos públicos. No lo toqué (está en la semilla, fuera del alcance). Lo debería decidir el operador.
- Los 155 hallazgos de revisión no se leyeron uno a uno.
- La regla por línea es frágil: si cambia la línea del CLA/README/CITATION, el alto vuelve a salir. Lo elegí así por conservador.
- El historial conserva las versiones previas de `catalog.sqlite` con el nombre (no se reescribe, por orden del brief). El escáner no ve dentro de binarios.
- La ref local `prueba/gitleaks-descartable-20261108` sigue en el clon compartido (el escáner la ve); su borrado lo decide el operador.
