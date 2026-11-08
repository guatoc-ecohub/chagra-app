# Imágenes rotas en chagra-app — informe (2026-11-08)

## Qué se encontró

Dos huecos reales, los mismos dos que se ven en la app:

1. **Marcador por defecto de Leaflet.** Un `L.marker()` sin icono propio pide
   `marker-icon.png` y `marker-shadow.png` relativos a la página. En el build
   eso da 404 y en pantalla sale el icono de imagen rota con el texto «Marker».
   Afecta a `MapPicker` y a `LeafletMap` cuando no recibe icono. El chequeo
   estático no lo ve; lo ve la sonda del marcador.
2. **Avatar foto del colibrí** (`ChagraAgentAvatarColibriPhoto.jsx`). Pedía
   `/avatar/colibri-transition.webm` y `/avatar/colibri-hero-still.jpg`, y
   `public/avatar/` no está en el repositorio. Hoy ninguna pantalla importa
   este componente, así que el arreglo es preventivo.

## Qué se cambió

- `src/utils/leafletIconoDefecto.js` (nuevo): fija `L.Icon.Default` con las
  imágenes que empaqueta Vite. Lo importan `MapPicker.jsx` y `LeafletMap.jsx`.
  Prueba: `src/utils/leafletIconoDefecto.test.js` (jsdom, 1/1 en verde).
- `ChagraAgentAvatarColibriPhoto.jsx`: usa `public/colibri/barbudito-transition.webm`
  y `public/colibri/barbudito-poster.webp`, que existen y son los mismos
  recursos del avatar activo.

No se repuso ninguna foto ni se escribió ninguna atribución nueva.

## Medición

| | base (`origin/main`) | rama |
|---|---|---|
| `checkimg.mjs` (script original) fuente / `dist/` | 106 / 56 | 111 / 56 |
| `checkimg-v2.mjs` fuente / `dist/` | 1 / 0 | **0 / 0** |
| Sonda en ejecución (`sonda-imagenes.mjs`), 27 rutas | 0 fallas | 0 fallas (2 corridas) |
| Marcador por defecto (`sonda-leaflet.mjs`, chunk real de `MapPicker`) | `naturalWidth 0`, 2×404 | `naturalWidth 25`, 0 fallas |
| `_build/` en `dist/` y en archivos versionados | 0 / 0 | 0 / 0 |

- El script original sube de 106 a 111 porque cuenta comentarios y la prueba
  nueva; no es un hueco. Sus otras ~105 son comentarios, nombres de archivo que
  se arman con `/abejas/${file}`, nombres por defecto de subidas, capturas que
  escriben los scripts, imports de paquete y módulos de lámina que nadie
  importa. La v2 usa el mismo regex y la misma resolución, quita esas clases de
  ruido y aplica `excepciones.tsv` con su razón escrita una por una.
- Control positivo de la v2: un archivo con `/no-existe-control.png` plantado
  da `sin archivo: 1` (`control-v2.txt`); sin el archivo vuelve a 0.
- Control positivo de la sonda: una página con un `<img>` a un archivo
  inexistente da 404 y `naturalWidth 0` («DETECTA») en cada corrida.
- La sonda del marcador sobre la base es el control de la sonda del marcador:
  detecta el hueco.
- `/home/` en `dist/`: aparecen solo 4 veces la cadena `/home/web_user`, en
  `sqlite3-worker1-*.js` y `catalogDB-*.js`. Es el sistema de archivos virtual
  de Emscripten que trae el paquete de sqlite-wasm, no una ruta de esta
  máquina. No se puede quitar sin parchear la dependencia y no es una fuga.
- `npm run build`: verde antes y después. `eslint --max-warnings=0` sobre los
  archivos tocados: 0.

## Lo que no pude verificar

- El avatar del colibrí en pantalla: ninguna ruta lo monta. Se verificó solo
  que los dos archivos nuevos existen y que el chequeo estático da 0.
- La sonda recorre 27 rutas, no todas las de la app. Las rutas con mapa
  (inventario, detalle de activo) necesitan datos de un backend que la sonda no
  tiene; por eso el marcador se mide aparte, con el chunk real de `MapPicker`.
- La sonda corre en Chromium sin cabeza y no mide FPS; no importa la
  herramienta de pantalla, que solo hace falta para medir rendimiento.
