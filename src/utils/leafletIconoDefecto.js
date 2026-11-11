// SPDX-License-Identifier: AGPL-3.0-only
/**
 * leafletIconoDefecto — fija el icono por defecto de Leaflet con las imágenes
 * que empaqueta Vite.
 *
 * Sin esto, un `L.marker()` sin `icon` explícito sale como hueco roto en el
 * build: Leaflet adivina la carpeta de sus imágenes leyendo el `url(...)` de
 * `.leaflet-default-icon-path` en su CSS, pero Vite lo reescribe como `data:`
 * y Leaflet termina pidiendo `marker-icon.png` y `marker-shadow.png` relativos a
 * la página (404). Importar este módulo una vez basta: modifica `L.Icon.Default`
 * para toda la sesión.
 *
 * @module utils/leafletIconoDefecto
 */
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// `imagePath: ''` evita que Leaflet anteponga la carpeta adivinada a unas URL
// que ya son completas (data: o /assets/<nombre>-<hash>.png).
L.Icon.Default.mergeOptions({ imagePath: '', iconUrl, iconRetinaUrl, shadowUrl });
L.Icon.Default.imagePath = '';

export { iconUrl, iconRetinaUrl, shadowUrl };
