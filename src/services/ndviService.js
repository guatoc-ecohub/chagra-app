import { fetchWithAuthRetry } from './apiService.js';
import { buildSidecarHeaders } from './tierService.js';
import { getActiveTenantId } from './tenantContext.js';
import { loteGeoJson, parentLandIdOf } from './loteService.js';

export const NDVI_CACHE_NAME = 'chagra-ndvi-v1';
const NDVI_CACHE_KEY_PREFIX = '/__chagra_ndvi_cache__/';

function sidecarUrl() {
  let base = '/api/mcp/agro';
  try {
    const configured = import.meta.env?.VITE_SIDECAR_URL;
    if (typeof configured === 'string' && configured.trim()) base = configured.trim();
  } catch { /* Use the same proxy default as sidecarClient. */ }
  return `${base.replace(/\/+$/, '')}/api/ndvi/series`;
}

function requestData(lote) {
  const geometry = loteGeoJson(lote);
  const fincaId = parentLandIdOf(lote) || lote?.id;
  if (!lote?.id || !fincaId || !geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) {
    throw new Error('lote_sin_poligono_o_finca');
  }
  // Keep property order stable: the Service Worker hashes these exact bytes.
  return { fincaId, loteId: lote.id, geometry };
}

async function cacheScope() {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') return null;
  const tenant = getActiveTenantId() || 'anonymous';
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ndvi-tenant\u0000${tenant}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function cacheKey(body, scope) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') return null;
  if (!scope) return null;
  const input = `${scope}\u0000${JSON.stringify(body)}`;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${NDVI_CACHE_KEY_PREFIX}${hex}`;
}

/** Read the last exact-request result from CacheStorage without contacting the network. */
export async function readCachedNdviSeries(lote) {
  try {
    if (!globalThis.caches?.open || typeof location === 'undefined') return null;
    const body = requestData(lote);
    const key = await cacheKey(body, await cacheScope());
    if (!key) return null;
    const cache = await caches.open(NDVI_CACHE_NAME);
    const response = await cache.match(new URL(key, location.origin).toString());
    if (!response || response.status !== 200) return null;
    return { ...(await response.json()), cache_origen: 'guardada' };
  } catch {
    return null;
  }
}

/** Request one lot's series; the Service Worker can satisfy this exact POST offline. */
export async function requestNdviSeries(lote) {
  const body = requestData(lote);
  const headers = {
    ...buildSidecarHeaders(),
    'x-chagra-ndvi-cache-scope': await cacheScope() || 'anonymous',
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetchWithAuthRetry(sidecarUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      allowServiceWorkerOffline: true,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = /** @type {Error & { status?: number }} */ (new Error(payload?.error || `ndvi_http_${response.status}`));
      error.status = response.status;
      throw error;
    }
    return {
      ...payload,
      cache_origen: response.headers.get('x-chagra-ndvi-cache') === 'offline' ? 'offline' : 'red',
    };
  } finally {
    clearTimeout(timeout);
  }
}
