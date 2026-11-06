/**
 * plagaImageResolver.js — resolver OFFLINE de fotos CC de plagas/enfermedades.
 *
 * Espejo de `speciesImageResolver` pero para el daño/síntoma o el insecto. El
 * manifiesto `/plaga-images.json` lista sólo imágenes de LICENCIA LIBRE
 * (CC0 / CC-BY / CC-BY-SA / dominio público), verificadas a mano y ya
 * optimizadas a ≤900 px / ≤200 KB para cuidar el ancho de banda rural. La foto
 * se sirve como binario local (`/plaga-images/<id>.jpg`), precacheable por el SW.
 *
 * Contrato de degradación: si el manifiesto no existe (build sin fotos, o sin
 * red y sin caché) o la plaga no tiene foto verificada, devuelve `null` — la
 * ficha muestra la ilustración de la viñeta de sanidad, nunca una imagen rota.
 * NUNCA inventa una URL ni una atribución.
 *
 * Forma del JSON:
 *   {
 *     "generated_at": "...", "source": "...", "count": N,
 *     "images": [{
 *       id, file, binomio, license, licenseUrl, attribution, source, sourceUrl,
 *       bytes, width, height
 *     }]
 *   }
 */

const PLAGA_IMAGES_PATH = '/plaga-images.json';

// Umbral unico de licencia para el contenido que llega a la aplicacion.
const COMMERCIAL_LICENSE_RE = /(?:^|\b)(?:cc0|public\s*domain|cc\s*-?\s*by(?:\s*-?\s*sa)?)(?:\b|$)|creativecommons\.org\/licenses\/by(?:\/|[-])/i;
const NON_COMMERCIAL_LICENSE_RE = /by\s*-?\s*nc|non\s*-?\s*commercial/i;

/** @param {object} entry */
export function isCommerciallyAllowedLicense(entry) {
  const text = `${entry?.license || ''} ${entry?.licenseUrl || ''}`;
  return !NON_COMMERCIAL_LICENSE_RE.test(text) && COMMERCIAL_LICENSE_RE.test(text);
}

// Los ids de fotos proceden de binomios, mientras que CAUSAS usa el sindrome
// canonico. Estas equivalencias conectan el material real sin adivinar URLs.
const CAUSA_IMAGE_ALIASES = Object.freeze({
  bemisia_tabaci: 'mosca_blanca',
  fusarium_oxysporum: 'marchitez_vascular',
  ralstonia_solanacearum: 'ralstonia_moko',
});

// Cache en memoria del índice { id -> entry } ya parseado.
let indexCache = null;
// Coalesce de cargas concurrentes.
let loadPromise = null;

/**
 * Carga y cachea el índice de imágenes. Devuelve `null` si la red o el
 * manifiesto están ausentes. Un duplicado es corrupción del contrato y lanza.
 * @returns {Promise<Record<string, object> | null>}
 */
async function loadPlagaImages() {
  if (indexCache) return indexCache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const res = await fetch(PLAGA_IMAGES_PATH);
      if (!res || !res.ok) return null;
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) return null;
      const raw = await res.json();
      const list = raw && Array.isArray(raw.images) ? raw.images : null;
      if (!list) return null;
      if (raw.count !== list.length) {
        throw new Error(`[plagaImageResolver] count=${raw.count} no coincide con images.length=${list.length}`);
      }
      const idx = {};
      for (const entry of list) {
        if (entry && typeof entry.id === 'string' && (entry.file || entry.url)) {
          if (Object.prototype.hasOwnProperty.call(idx, entry.id)) {
            throw new Error(`[plagaImageResolver] id duplicado en manifiesto: ${entry.id}`);
          }
          if (!isCommerciallyAllowedLicense(entry)) {
            throw new Error(`[plagaImageResolver] licencia no permitida en manifiesto: ${entry.id}`);
          }
          idx[entry.id] = entry;
        }
      }
      indexCache = idx;
      return idx;
    } catch (err) {
      if (err?.message?.includes('manifiesto') || err?.message?.includes('count=')) throw err;
      console.warn('[plagaImageResolver] no se pudieron cargar fotos:', err?.message);
      return null;
    } finally {
      // permitir reintento si la carga devolvió null (offline sin caché).
      if (!indexCache) loadPromise = null;
    }
  })();

  return loadPromise;
}

/**
 * Mapea una entrada del manifiesto al shape de imagen que consume la ficha.
 * Reusa las mismas claves que `speciesImageResolver.toImageResult` para que
 * el Hero sea intercambiable (url, license, rightsHolder, source, sourceUrl).
 */
function toImageResult(entry) {
  const url = entry.file || entry.url;
  return {
    url,
    thumbUrl: url, // ya viene optimizada (≤900 px / ≤200 KB); no hay variante ligera aparte
    license: entry.license || '',
    licenseUrl: entry.licenseUrl || null,
    rightsHolder: entry.attribution || 'Autor no informado',
    source: entry.source || 'Wikimedia Commons',
    sourceUrl: entry.sourceUrl || null,
  };
}

/**
 * Busca la foto CC verificada de una plaga por su id (clave de `CAUSAS`).
 * @param {string} plagaId
 * @returns {Promise<{ url, thumbUrl, license, licenseUrl, rightsHolder, source, sourceUrl } | null>}
 */
export async function findPlagaImage(plagaId) {
  if (!plagaId || typeof plagaId !== 'string') return null;
  const idx = await loadPlagaImages();
  if (!idx) return null;
  const entry = idx[plagaId] || idx[CAUSA_IMAGE_ALIASES[plagaId]];
  return entry ? toImageResult(entry) : null;
}

/** Reinicia el cache en memoria (uso en tests). */
export function __resetPlagaImagesCache() {
  indexCache = null;
  loadPromise = null;
}
