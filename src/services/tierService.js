/**
 * tierService.js — Tier free|pro del usuario, decidido por el servidor.
 *
 * PROPÓSITO:
 *   El sidecar agro-mcp resuelve el tier desde el principal autenticado (UID
 *   de farmOS) y lo publica en `GET /tier` (vía nginx: `/api/mcp/agro/tier`).
 *   El bundle NO lleva ninguna lista de usuarios Pro: la lista vive solo en la
 *   configuración del servidor. Este módulo guarda la última respuesta del
 *   servidor para la cuenta activa y con ella decide qué ve la UI (chip 🔬
 *   Deep Research) y qué header `x-chagra-tier` se envía al sidecar.
 *
 * NOTA DE SEGURIDAD:
 *   El tier guardado es una pista de UX. El sidecar NO confía en el header
 *   `x-chagra-tier`; autoriza con su propio principal. Sin respuesta del
 *   servidor, o si la respuesta no es de la cuenta activa, el tier es 'free'.
 *
 * Español colombiano (tú/usted). NUNCA voseo argentino.
 *
 * @module tierService
 */

import { getActiveTenantId } from './tenantContext.js';
import { ROLE_IDS } from '../config/roleCatalog.js';

/** Clave de localStorage con la última respuesta de `GET /tier`. */
export const SERVER_TIER_STORAGE_KEY = 'chagra:server_tier';

/** Evento que se emite cuando cambia el tier guardado. */
export const SERVER_TIER_CHANGED_EVENT = 'chagra:tier-changed';

function normalizeUsername(username) {
  if (!username || typeof username !== 'string') return null;
  const normalized = username.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function readServerTier() {
  try {
    const value = JSON.parse(localStorage.getItem(SERVER_TIER_STORAGE_KEY) || 'null');
    if (!value || typeof value !== 'object') return null;
    if (typeof value.user !== 'string' || (value.tier !== 'pro' && value.tier !== 'free')) return null;
    return value;
  } catch (_) {
    return null;
  }
}

function emitTierChanged(tier) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent(SERVER_TIER_CHANGED_EVENT, { detail: { tier } }));
  } catch (_) { /* CustomEvent existe en browsers soportados */ }
}

/**
 * Guarda el tier que respondió el servidor para una cuenta.
 *
 * @param {string} username — username farmOS de la cuenta activa.
 * @param {string} tier — valor recibido del servidor.
 * @returns {'free'|'pro'}
 */
export function storeServerTier(username, tier) {
  const user = normalizeUsername(username);
  const value = tier === 'pro' ? 'pro' : 'free';
  if (!user) return 'free';
  const previous = readServerTier();
  try {
    localStorage.setItem(SERVER_TIER_STORAGE_KEY, JSON.stringify({ user, tier: value }));
  } catch (_) { /* sin storage el tier queda en free */ }
  if (!previous || previous.user !== user || previous.tier !== value) emitTierChanged(value);
  return value;
}

/** Borra el tier guardado. Llamar en logout. */
export function clearServerTier() {
  const previous = readServerTier();
  try {
    localStorage.removeItem(SERVER_TIER_STORAGE_KEY);
  } catch (_) { /* ignore */ }
  if (previous?.tier === 'pro') emitTierChanged('free');
}

function sidecarEnabled() {
  try {
    const raw = import.meta.env?.VITE_USE_SIDECAR_AGRO_MCP;
    if (raw === true) return true;
    return typeof raw === 'string' && ['true', '1'].includes(raw.trim().toLowerCase());
  } catch (_) {
    return false;
  }
}

function sidecarBaseUrl() {
  try {
    const raw = import.meta.env?.VITE_SIDECAR_URL;
    if (typeof raw === 'string' && raw.trim()) return raw.trim().replace(/\/+$/, '');
  } catch (_) { /* ignore */ }
  return '/api/mcp/agro';
}

/**
 * Pregunta al servidor el tier de la cuenta activa (`GET /tier` del sidecar,
 * autenticado con el bearer de farmOS) y lo guarda.
 *
 * - Respuesta 2xx con `{ tier }`: se guarda ese tier.
 * - Respuesta no 2xx (401, 403, 404 de una ruta sin publicar, 5xx): 'free'.
 * - Sin red: se conserva lo último que dijo el servidor para esa misma cuenta.
 *
 * @param {{ fetchImpl?: (url: string, init: RequestInit) => Promise<Response> }} [options]
 * @returns {Promise<'free'|'pro'>}
 */
export async function refreshServerTier({ fetchImpl } = {}) {
  const username = getActiveTenantId();
  if (!normalizeUsername(username)) {
    clearServerTier();
    return 'free';
  }
  if (!sidecarEnabled() && !fetchImpl) return storeServerTier(username, 'free');
  let doFetch = fetchImpl;
  if (!doFetch) {
    const { fetchWithAuthRetry } = await import('./apiService.js');
    doFetch = fetchWithAuthRetry;
  }
  let response;
  try {
    response = await doFetch(`${sidecarBaseUrl()}/tier`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch (_) {
    return resolveTier(username);
  }
  // La cuenta pudo cambiar mientras esperábamos: no atribuirle la respuesta.
  if (normalizeUsername(getActiveTenantId()) !== normalizeUsername(username)) {
    return resolveTier(getActiveTenantId());
  }
  if (!response || !response.ok) return storeServerTier(username, 'free');
  try {
    const body = await response.json();
    return storeServerTier(username, body?.tier);
  } catch (_) {
    return storeServerTier(username, 'free');
  }
}

/**
 * Tiers de licencia para federacion de usuarios.
 *
 * maxSubUsers cuenta a la gente activa de la finca. El asesor no consume cupo
 * porque depende de delegacion externa.
 */
export const TIERS = Object.freeze({
  free: Object.freeze({
    maxSubUsers: 1,
    roles: Object.freeze(['dueno']),
    canDelegate: false,
  }),
  familiar: Object.freeze({
    maxSubUsers: 4,
    roles: Object.freeze(['dueno', 'esposa', 'trabajador', 'nina', 'mayor']),
    canDelegate: false,
  }),
  cuadrilla: Object.freeze({
    maxSubUsers: 12,
    roles: Object.freeze(['dueno', 'esposa', 'trabajador', 'nina', 'mayor']),
    canDelegate: true,
  }),
  cooperativa: Object.freeze({
    maxSubUsers: 50,
    roles: Object.freeze(['dueno', 'esposa', 'trabajador', 'nina', 'mayor', 'asesor']),
    canDelegate: true,
  }),
});

function normalizeTierId(tier) {
  if (typeof tier !== 'string') return null;
  const normalized = tier.trim().toLowerCase();
  return TIERS[normalized] ? normalized : null;
}

function normalizeRoleId(roleId) {
  if (typeof roleId !== 'string') return null;
  const normalized = roleId.trim().toLowerCase();
  return ROLE_IDS.includes(normalized) ? normalized : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tier de una cuenta según la última respuesta del servidor.
 *
 * @param {string|null|undefined} username — username farmOS del usuario.
 * @returns {'free'|'pro'} — 'pro' solo si el servidor lo dijo para esa misma
 *   cuenta; 'free' en todos los demás casos.
 */
export function resolveTier(username) {
  const user = normalizeUsername(username);
  if (!user) return 'free';
  const stored = readServerTier();
  return stored && stored.user === user && stored.tier === 'pro' ? 'pro' : 'free';
}

/**
 * Traduce el tier de producto al tier de roster. `pro` conserva su contrato
 * para el sidecar, pero el roster necesita una capacidad concreta.
 *
 * @param {string|null|undefined} username
 * @returns {'free'|'familiar'}
 */
export function resolveRosterTier(username) {
  return resolveTier(username) === 'pro' ? 'familiar' : 'free';
}

/**
 * @returns {'free'|'familiar'}
 */
export function getCurrentRosterTier() {
  return resolveRosterTier(getActiveTenantId());
}

/**
 * Resuelve el tier del usuario actualmente logueado, leyendo el tenantId
 * persistido por `tenantContext` (se setea en login).
 *
 * @returns {'free'|'pro'}
 */
export function getCurrentTier() {
  const username = getActiveTenantId();
  return resolveTier(username);
}

/**
 * Construye los headers HTTP para llamadas al sidecar, inyectando
 * `x-chagra-tier` con el tier del usuario activo.
 *
 * Uso típico en sidecarClient y deepResearchClient:
 * @returns {Object.<string, string>} headers listos para inyectar en fetch.
 */
export function buildSidecarHeaders() {
  const tier = getCurrentTier();
  const headers = {
    'Content-Type': 'application/json',
    'x-chagra-tier': tier,
  };
  return headers;
}

/**
 * @param {{ tier?: string, usuarios?: Array<{ status?: string }> }} roster
 * @returns {boolean}
 */
export function canAddSubUser(roster) {
  if (!roster || typeof roster !== 'object') return false;
  const tierId = normalizeTierId(roster.tier);
  const tier = tierId ? TIERS[tierId] : null;
  if (!tier) return false;
  const usuarios = Array.isArray(roster.usuarios) ? roster.usuarios : [];
  const activeUsers = usuarios.filter((user) => !user || user.status !== 'revoked').length;
  return activeUsers < tier.maxSubUsers;
}

/**
 * @param {string} tier
 * @param {string} roleId
 * @returns {boolean}
 */
export function tierAllowsRole(tier, roleId) {
  const tierId = normalizeTierId(tier);
  const normalizedRole = normalizeRoleId(roleId);
  if (!tierId || !normalizedRole) return false;
  return TIERS[tierId].roles.includes(normalizedRole);
}

/**
 * @param {string} tier
 * @returns {boolean}
 */
export function tierAllowsDelegation(tier) {
  const tierId = normalizeTierId(tier);
  if (!tierId) return false;
  return TIERS[tierId].canDelegate === true;
}
