/**
 * conversationCaptureService.js — Captura server-side de las conversaciones del
 * agente para TODOS los usuarios (task #CHAT-CAPTURE).
 *
 * POR QUÉ EXISTE: hoy el historial del chat es local-only (IndexedDB de cada
 * browser, #120) y el chat va directo a Ollama sin pasar por el sidecar, así que
 * NADA queda guardado central. Para análisis, debugging y mejora del sistema,
 * hay que persistir cada turno (pregunta + respuesta + grounding) en el sidecar.
 * Mirror del patrón de `feedbackService.js` (mismo base URL).
 *
 * Endpoint sidecar: POST /log-conversation (módulos opcionales, append a JSONL durable).
 * Base por defecto `/api/mcp/agro`, la ruta que nginx publica hacia el sidecar.
 * Bug C34 (piloto 2026-10-31): el build de producción no define
 * VITE_SIDECAR_URL y la base caía en `/api`; `/api/log-conversation` no es del
 * sidecar (lo atiende farmOS: 401 sin token, 404 con token) y ningún turno se
 * guardaba.
 *
 * Identidad (bugs D-10 y C25, 2026-10-31): `usePrefsStore.operatorId` nunca se
 * asigna y todos los turnos salían como `default-operator`, sin finca. La
 * cuenta sale de la sesión (tenantContext) y la finca del store o de la finca
 * activa de la sesión. Con el perfil de menor se conserva la cuenta titular
 * (para auditar o borrar por titular), se marca `perfil:"nina"` y la sesión
 * termina en `:nina`; nunca se guarda nombre propio ni nombre de finca.
 *
 * Reglas:
 * - Gated por `VITE_CAPTURE_CONVERSATIONS` (OFF default → privacy-first).
 * - Solo captura si el usuario dio consentimiento (hasConsent() del feedbackService).
 * - Fire-and-forget: NUNCA bloquea ni rompe la UX del chat; falla en silencio.
 * - Opcionalmente anonimiza PII (VITE_CAPTURE_ANONYMIZE=true) → user_name y
 *   finca_nombre se omiten para cumplir Habeas Data (Ley 1581).
 *
 * Schema del evento (1 línea JSONL por turno):
 * {
 *   id, ts,
 *   user_id, user_name,        // identidad del usuario (user_name omitido si anonymize)
 *   finca_slug, finca_nombre,  // finca activa (finca_nombre omitido si anonymize)
 *   perfil,                    // 'nina' con el perfil de menor; null si no
 *   session_id, turn_index,
 *   user_text,                 // pregunta del usuario (limpia)
 *   agent_text,                // respuesta del agente (final)
 *   nlu_route,                 // ruta NLU elegida (si la hubo)
 *   entities_grounded,         // entidades resueltas en el grafo
 *   guards_fired,              // guards de seguridad que actuaron
 *   grounded_status,           // _grounded.status
 *   latency_ms, model
 * }
 */

import { ulid } from 'ulid';
import { hasConsent } from './feedbackService';
import { fetchWithAuthRetry } from './apiService';
import { getActiveTenantId, getActiveFincaId } from './tenantContext';

const CAPTURE_TIMEOUT_MS = 6000;
const TEXT_MAX = 16000; // cota por campo (un turno largo del agente ~2-4k; holgado)

/** ¿Captura activa? Gated por env. OFF por defecto. */
export function isCaptureEnabled() {
  try {
    const raw = import.meta.env?.VITE_CAPTURE_CONVERSATIONS;
    if (raw === true) return true;
    if (typeof raw === 'string') {
      const v = raw.trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'on';
    }
    return false;
  } catch (_) {
    return false;
  }
}

/**
 * ¿Se exige consentimiento por-usuario (hasConsent) para capturar?
 * Default TRUE (privacy-first). Puesto en `false` vía VITE_CAPTURE_REQUIRE_CONSENT
 * (build), la captura se aplica a TODOS los usuarios sin el gate de consentimiento
 * in-app — modo PILOTO para auditar el agente con toda la data (los usuarios del
 * piloto deben ser informados fuera de la app; Habeas Data Ley 1581).
 */
export function isConsentRequired() {
  try {
    const raw = import.meta.env?.VITE_CAPTURE_REQUIRE_CONSENT;
    if (raw === false) return false;
    if (typeof raw === 'string') {
      const v = raw.trim().toLowerCase();
      if (v === 'false' || v === '0' || v === 'off') return false;
    }
    return true; // default: exige consentimiento
  } catch (_) {
    return true;
  }
}

function getBaseUrl() {
  try {
    const raw = import.meta.env?.VITE_SIDECAR_URL;
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim().replace(/\/+$/, '');
    }
  } catch (_) {
    // ignore
  }
  return '/api/mcp/agro';
}

/** Ids de relleno que no identifican a nadie. */
const PLACEHOLDER_USER_IDS = new Set(['default-operator', 'unknown-operator']);

function _safe(fn) {
  try { return fn() || null; } catch (_) { return null; }
}

/**
 * Identidad real del turno: la cuenta de la sesión cuando el llamador trae un id
 * de relleno, y la finca activa de la sesión cuando el store no la tiene.
 * Exportado para tests.
 * @param {{user_id?:any, user_name?:string|null, finca_slug?:string|null, finca_nombre?:string|null, menor?:boolean}} [identity]
 */
export function resolveCaptureIdentity(identity = {}) {
  const raw = identity?.user_id;
  const explicit = raw != null && raw !== '' && !PLACEHOLDER_USER_IDS.has(String(raw)) ? raw : null;
  const user_id = explicit ?? _safe(getActiveTenantId);
  const finca_slug = identity?.finca_slug || _safe(getActiveFincaId);
  const menor = identity?.menor === true;
  return {
    ...identity,
    user_id: user_id ?? null,
    finca_slug: finca_slug ?? null,
    menor,
    perfil: menor ? 'nina' : null,
  };
}

/** Sesión de captura: cuenta, finca y, si aplica, el perfil de menor. */
export function captureSessionId({ user_id = null, finca_slug = null, menor = false } = {}) {
  const base = `${user_id ?? 'sin-cuenta'}:${finca_slug || 'sin-finca'}`;
  return menor ? `${base}:nina` : base;
}

function clip(s) {
  if (typeof s !== 'string') return '';
  return s.length > TEXT_MAX ? `${s.slice(0, TEXT_MAX)}…[clip]` : s;
}

/** ¿Anonimizar PII? Gated por VITE_CAPTURE_ANONYMIZE. Exportado para tests. */
export function shouldAnonymizePII() {
  try {
    const raw = import.meta.env?.VITE_CAPTURE_ANONYMIZE;
    if (raw === true) return true;
    if (typeof raw === 'string') {
      const v = raw.trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'on';
    }
    return false;
  } catch (_) {
    return false;
  }
}

function anonymizeIdentity(identity) {
  // Menores: nunca se guarda nombre propio ni nombre de finca, sin importar el flag.
  if (!identity.menor && !shouldAnonymizePII()) return identity;

  return {
    ...identity,
    user_id: identity.user_id ?? null,
    user_name: null,
    finca_slug: identity.finca_slug ?? null,
    finca_nombre: null,
  };
}

/** ¿Esta sesión está registrando las conversaciones? Misma condición que captureExchange. */
export function isCaptureActive() {
  if (!isCaptureEnabled()) return false;
  if (isConsentRequired() && !hasConsent()) return false;
  return true;
}

/** Línea de aviso visible en el chat: qué se guarda y para qué. */
export function avisoRegistroTexto({ menor = false } = {}) {
  return menor
    ? 'Guardamos esta conversación sin nombre propio, solo para mejorar las respuestas de Chagra.'
    : 'Guardamos sus preguntas y las respuestas de Chagra para corregir errores y mejorar el asistente.';
}

/**
 * Captura un turno completo (pregunta del usuario + respuesta del agente).
 * Fire-and-forget: devuelve void, no espera, no lanza.
 *
 * Solo captura si:
 * - La flag VITE_CAPTURE_CONVERSATIONS está activada.
 * - El usuario dio consentimiento (hasConsent() del feedbackService).
 *
 * @param {Object} p
 * @param {string} p.userText      pregunta del usuario
 * @param {string} p.agentText     respuesta final del agente
 * @param {Object} [p.identity]    { user_id, user_name, finca_slug, finca_nombre, menor }
 * @param {Object} [p.meta]        { session_id, turn_index, nlu_route, entities_grounded,
 *                                   guards_fired, grounded_status, latency_ms, model }
 */
export function captureExchange({ userText = '', agentText = '', identity = {}, meta = {} } = /** @type {any} */ ({})) {
  if (!isCaptureEnabled()) return;
  // Gate de consentimiento: por defecto exigido (privacy-first). En modo PILOTO
  // (VITE_CAPTURE_REQUIRE_CONSENT=false) se captura a todos los usuarios.
  if (isConsentRequired() && !hasConsent()) return;
  // No capturamos turnos vacíos (p. ej. abortados sin respuesta).
  if (!userText && !agentText) return;

  const resolvedIdentity = resolveCaptureIdentity(identity);
  const sanitizedIdentity = anonymizeIdentity(resolvedIdentity);
  const sessionId = meta.session_id || captureSessionId(resolvedIdentity);
  const payload = {
    id: ulid(),
    ts: Date.now(),
    user_id: sanitizedIdentity.user_id ?? null,
    user_name: sanitizedIdentity.user_name ?? null,
    finca_slug: sanitizedIdentity.finca_slug ?? null,
    finca_nombre: sanitizedIdentity.finca_nombre ?? null,
    perfil: resolvedIdentity.perfil,
    session_id: sessionId,
    turn_index: typeof meta.turn_index === 'number' ? meta.turn_index : null,
    user_text: clip(userText),
    agent_text: clip(agentText),
    nlu_route: meta.nlu_route ?? null,
    entities_grounded: Array.isArray(meta.entities_grounded) ? meta.entities_grounded.slice(0, 50) : [],
    guards_fired: Array.isArray(meta.guards_fired) ? meta.guards_fired.slice(0, 20) : [],
    grounded_status: meta.grounded_status ?? null,
      latency_ms: typeof meta.latency_ms === 'number' ? meta.latency_ms : null,
      model: meta.model ?? null,
      eval_rate: typeof meta.eval_rate === 'number' ? meta.eval_rate : null,
      first_token_ms: typeof meta.first_token_ms === 'number' ? meta.first_token_ms : null,
      response_len: typeof meta.response_len === 'number' ? meta.response_len : null,
    };

  const base = getBaseUrl();
  const headers = { 'Content-Type': 'application/json' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CAPTURE_TIMEOUT_MS);

  // Fire-and-forget: no await, no throw. El chat NO depende de esto.
  fetchWithAuthRetry(`${base}/log-conversation`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: controller.signal,
    keepalive: true, // sobrevive si el usuario navega justo después
  })
    .catch((err) => {
      // Silencioso por diseño: la captura jamás degrada la UX.
      if (import.meta.env?.DEV) {
        console.debug('[conversationCapture] envío falló (ignorado):', err?.name || err);
      }
    })
    .finally(() => clearTimeout(timer));
}
