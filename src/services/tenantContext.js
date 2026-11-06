/**
 * tenantContext — Identidad del "tenant" activo en la sesión PWA.
 *
 * Esto es el camino MVP del ADR-036 multi-finca: la versión completa propone
 * `did:key` Ed25519 + UCAN delegations + DB-per-finca en OPFS, pero para
 * habilitar HOY entregar la PWA a 3-5 usuarios reales compartiendo un único
 * backend farmOS sin que vean assets ajenos, alcanza con scoping cliente-side
 * derivado del username del login OAuth2.
 *
 * Diferencias con módulos vecinos:
 *  - `operatorIdentityService` calcula `operator_id_hash` (HMAC-SHA256) para
 *    pseudonimización Ley 1581 — opaco, no útil como filtro de servidor.
 *  - `fincaActiveStore` resuelve la finca activa. Para fincas propias, su id de
 *    grupo y su terreno viven en claves separadas de la identidad de cuenta.
 *
 * `tenantContext` provee el `tenantId` plaintext (username farmOS), que es
 * lo que farmOS JSON:API entiende como `filter[uid.name]` / `filter[owner.id]`.
 * `getActiveFincaId()` identifica el grupo seleccionado y nunca reemplaza ese username.
 *
 * TODO(multifinca-backend): cuando ADR-036 Fase 1 active did:key + UCAN,
 * sustituir `tenantId = username` por `tenantId = did:key:zABC...` y delegar
 * a `farm_did_auth` (módulo Drupal a desarrollar) la verificación server-side.
 * Hasta entonces, este scoping es DEFENSE-IN-DEPTH cliente-side: defensa real
 * server-side requiere que farmOS aplique el `filter[uid.name]` y, idealmente,
 * que el token OAuth2 ya esté ligado a un user que solo ve sus propios assets.
 */

import { TENANT_READY_EVENT } from './sessionSignals';

const TENANT_ID_KEY = 'chagra:active_tenant_id';
const TENANT_MEMBERS_KEY = 'chagra:active_tenant_members';
const ACTIVE_FINCA_ID_KEY = 'chagra:active_finca_id';
const ACTIVE_FINCA_LAND_ID_KEY = 'chagra:active_finca_land_id';

export function getActiveTenantMembers() {
  try {
    const value = JSON.parse(localStorage.getItem(TENANT_MEMBERS_KEY) || '[]');
    return Array.isArray(value) ? value.filter((name) => typeof name === 'string' && name) : [];
  } catch (_) { return []; }
}

function storeActiveTenantId(tenantId) {
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new Error('tenantId must be non-empty string');
  }
  const normalized = tenantId.trim();
  const previous = getActiveTenantId();
  try {
    localStorage.setItem(TENANT_ID_KEY, normalized);
  } catch (err) {
    console.warn('[tenantContext] localStorage write failed:', err);
  }
  if (previous && previous !== normalized && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tenantChanged', { detail: { previous, current: normalized } })
    );
  }
  // También tras un login con la misma cuenta: la cola espera a saber de quién
  // es la sesión antes de subir, para no enviar lo de otra cuenta con este token.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TENANT_READY_EVENT, { detail: { current: normalized } }));
  }
  return normalized;
}

/** Keep account identity separate from the selected farm group. */
export function setActiveFincaTenant(username, groupId, members = [username], landId = null) {
  if (typeof groupId !== 'string' || !groupId.trim()) throw new Error('A finca requiere un grupo válido');
  if (!Array.isArray(members) || !members.length) throw new Error('A finca requiere al menos un miembro');
  const normalizedMembers = [...new Set(members.filter((name) => typeof name === 'string').map((name) => name.trim()).filter(Boolean))];
  if (!normalizedMembers.includes(username)) normalizedMembers.unshift(username);
  const previousFinca = getActiveFincaId();
  try { localStorage.setItem(TENANT_MEMBERS_KEY, JSON.stringify(normalizedMembers)); } catch (_) { /* best effort */ }
  try {
    localStorage.setItem(ACTIVE_FINCA_ID_KEY, groupId.trim());
    if (typeof landId === 'string' && landId.trim()) localStorage.setItem(ACTIVE_FINCA_LAND_ID_KEY, landId.trim());
    else localStorage.removeItem(ACTIVE_FINCA_LAND_ID_KEY);
  } catch (_) { /* best effort */ }
  const identity = storeActiveTenantId(username);
  if (previousFinca !== groupId.trim() && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fincaChanged', { detail: { previous: previousFinca, current: groupId.trim() } }));
  }
  return identity;
}

export function getActiveFincaId() {
  try { return localStorage.getItem(ACTIVE_FINCA_ID_KEY); } catch (_) { return null; }
}

export function getActiveFincaLandId() {
  try { return localStorage.getItem(ACTIVE_FINCA_LAND_ID_KEY); } catch (_) { return null; }
}

export function clearActiveFincaContext({ notify = true } = {}) {
  const previous = getActiveFincaId();
  try {
    localStorage.removeItem(ACTIVE_FINCA_ID_KEY);
    localStorage.removeItem(ACTIVE_FINCA_LAND_ID_KEY);
    localStorage.removeItem(TENANT_MEMBERS_KEY);
  } catch (_) { /* best effort */ }
  if (notify && previous && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fincaChanged', { detail: { previous, current: null } }));
  }
}

/**
 * Setea el tenantId activo. Llamar tras login exitoso con el username farmOS.
 * Si cambia respecto al anterior, dispara evento `tenantChanged` para que
 * stores invaliden cachés (ver useAssetStore.invalidateForTenantChange).
 *
 * @param {string} tenantId — username plaintext del operador (ej. 'alice', 'bob')
 */
export function setActiveTenantId(tenantId) {
  const previous = getActiveTenantId();
  const next = typeof tenantId === 'string' ? tenantId.trim() : null;
  if (next && previous !== next) clearActiveFincaContext({ notify: false });
  const identity = storeActiveTenantId(tenantId);
  if (!getActiveFincaId()) {
    try { localStorage.removeItem(TENANT_MEMBERS_KEY); } catch (_) { /* best effort */ }
  }
  return identity;
}

/**
 * @returns {string|null} tenantId activo o null si no hay login en este device.
 */
export function getActiveTenantId() {
  try {
    return localStorage.getItem(TENANT_ID_KEY);
  } catch (err) {
    console.warn('[tenantContext] localStorage read failed:', err);
    return null;
  }
}

/**
 * Limpia el tenantId activo. Llamar en logout.
 */
export function clearActiveTenantId() {
  try {
    localStorage.removeItem(TENANT_ID_KEY);
    localStorage.removeItem(TENANT_MEMBERS_KEY);
    localStorage.removeItem(ACTIVE_FINCA_ID_KEY);
    localStorage.removeItem(ACTIVE_FINCA_LAND_ID_KEY);
  } catch (err) {
    console.warn('[tenantContext] localStorage remove failed:', err);
  }
}

/**
 * @returns {boolean} true si hay un tenant activo (proxy de "estamos logueados
 * con un usuario identificado").
 */
export function hasActiveTenant() {
  return !!getActiveTenantId();
}

/**
 * Para tests.
 */
export function _resetForTests() {
  try {
    localStorage.removeItem(TENANT_ID_KEY);
    localStorage.removeItem(TENANT_MEMBERS_KEY);
    localStorage.removeItem(ACTIVE_FINCA_ID_KEY);
    localStorage.removeItem(ACTIVE_FINCA_LAND_ID_KEY);
  } catch (_) { /* no-op en entornos sin localStorage */ }
}
