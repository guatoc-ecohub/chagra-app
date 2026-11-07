# Informe: procedencia pública de datos

## Cambios

- Se restauraron las citas y los bloques de metadatos del catálogo, con sus licencias, conteos y alcance.
- Se conservaron las marcas de borrador y el estado de curaduría; se limpiaron solo las referencias internas.
- Se revirtió el cambio de `validation_level` y se restauraron sus lectores para mantener el aviso ámbar.
- Se retiraron las referencias internas y las cadenas de modelos de las fuentes y metadatos, dejando el contenido científico restante.
- Se mantuvieron los valores de especies, números y recomendaciones. La comparación estructural de los JSON no encontró cambios en valores numéricos; las dos listas reducidas contenían notas internas de trabajo.

## Conteos `git grep -c` (origin/main → resultado)

| Cadena | `public` | `src/data` | `catalog` |
|---|---:|---:|---:|
| Bernal 2015 | 328 → 328 | 3 → 3 | 200 → 200 |
| POWO | 764 → 764 | 10 → 10 | 611 → 611 |
| 978-958-740-120-2 | 2 → 2 | 0 → 0 | 0 → 0 |
| BORRADOR_IA | 4 → 4 | 17 → 17 | 50 → 50 |
| claude_draft | 244 → 244 | 36 → 36 | 702 → 702 |

El guard de referencias internas devuelve cero coincidencias. `node -e` parseó los 36 archivos JSON modificados. SQLite pasa `PRAGMA integrity_check` y conserva 581 especies, 36 biopreparados, 132 fuentes y 24 fermentos.

## Validación y límites

- `npm run build`: exit 0. El prebuild generó una base con 133 fuentes; el SQLite de `origin/main` tenía 132. Para respetar el criterio de no alterar conteos, el archivo final conserva los datos de esa base y elimina las referencias internas en sitio. El desfase entre el seed y la base publicada queda pendiente.
- `npm run lint`: exit 1, con 140 errores y 260 advertencias en el repositorio. Los seis archivos JavaScript modificados mantienen los mismos resultados de ESLint que `origin/main`: cero errores; el único archivo con advertencias conserva las mismas cinco.
- El guard visual y las mediciones de rendimiento no aplican a este cambio de datos.
