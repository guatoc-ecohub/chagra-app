// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ndviCacheStore — bucket de CacheStorage donde el service worker guarda las
 * series NDVI para el modo offline.
 *
 * Cada entrada queda bajo el prefijo de UNA cuenta:
 *   `/__chagra_ndvi_cache__/<scope de la cuenta>/<huella del cuerpo>`
 * El scope es una huella del username activo (nunca el username en claro). Sin
 * cuenta activa no hay scope y el service worker no guarda ni sirve nada.
 *
 * El bucket se vacía al cerrar sesión, al vencer la sesión y al cambiar de
 * cuenta en el mismo teléfono. Mientras la misma cuenta siga activa, offline
 * conserva su último resultado por lote.
 *
 * Sin imports de servicios con red: lo usa authService al cerrar sesión.
 */

import { getActiveTenantId } from './tenantContext.js';

export const NDVI_CACHE_NAME = 'chagra-ndvi-v1';
export const NDVI_CACHE_KEY_PREFIX = '/__chagra_ndvi_cache__/';
export const NDVI_CACHE_SCOPE_HEADER = 'x-chagra-ndvi-cache-scope';
const NDVI_CACHE_ACCOUNT_KEY = 'chagra:ndvi_cache_account';

function hasDigest() {
  return Boolean(globalThis.crypto?.subtle) && typeof TextEncoder !== 'undefined';
}

export async function sha256Hex(input) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {string|null} [account] username; por defecto, la cuenta activa.
 * @returns {Promise<string|null>} huella de la cuenta, o null si no hay cuenta.
 */
export async function ndviAccountScope(account = getActiveTenantId()) {
  if (!hasDigest()) return null;
  const name = typeof account === 'string' ? account.trim() : '';
  if (!name) return null;
  return sha256Hex(`ndvi-account\u0000${name}`);
}

/** Clave de la entrada; el service worker calcula la misma con los bytes del cuerpo. */
export async function ndviCacheKey(scope, bodyText) {
  if (!scope || !hasDigest()) return null;
  return `${NDVI_CACHE_KEY_PREFIX}${scope}/${await sha256Hex(`${scope}\u0000${bodyText}`)}`;
}

function readStoredAccount() {
  try { return localStorage.getItem(NDVI_CACHE_ACCOUNT_KEY); } catch (_) { return null; }
}

function writeStoredAccount(scope) {
  try {
    if (scope) localStorage.setItem(NDVI_CACHE_ACCOUNT_KEY, scope);
    else localStorage.removeItem(NDVI_CACHE_ACCOUNT_KEY);
  } catch (_) { /* best effort */ }
}

/**
 * Borra el bucket NDVI completo. Nunca lanza.
 * @returns {Promise<boolean>} true si había bucket y se borró.
 */
export async function purgeNdviCache() {
  writeStoredAccount(null);
  try {
    if (!globalThis.caches?.delete) return false;
    return await globalThis.caches.delete(NDVI_CACHE_NAME);
  } catch (_) {
    return false;
  }
}

/**
 * Si el bucket no está asignado a `scope` (otra cuenta, ninguna cuenta o un
 * bucket anterior a esta marca), lo vacía antes de usarlo y lo asigna.
 */
export async function claimNdviCacheForAccount(scope) {
  if (scope && readStoredAccount() === scope) return;
  await purgeNdviCache();
  writeStoredAccount(scope);
}
