/**
 * apiService — Cliente HTTP para la API JSON:API de FarmOS.
 * Gestiona autenticación OAuth, timeouts, y sanitización de errores.
 *
 * @module apiService
 * @requires authService
 */

import { expireSession, getAccessToken, getLastRefreshFailureReason, refreshAccessToken } from './authService';
import { getActiveTenantId, getActiveTenantMembers } from './tenantContext';
import { AUTH_MISSING, hasStoredAccessToken } from './sessionSignals';
import { buildCleanErrorMessage } from './sanitizeError.js';
import { prepareAssetWritePayload } from './assetWritePayload.js';
import { prepareLogForFarmOS } from './farmosLogContract.js';

/**
 * @typedef {Object} FetchOptions
 * @property {number} [timeout=10000]
 * @property {string} [method='GET']
 * @property {Object.<string,string>} [headers]
 * @property {BodyInit} [body]
 * @property {AbortSignal} [signal]
 * @property {() => boolean} [contextIsCurrent]
 * @property {boolean} [allowServiceWorkerOffline] permite que fetch llegue
 *   al Service Worker cuando navigator.onLine=false para lecturas cacheadas.
 */

/**
 * Fetch con timeout configurable.
 * @param {string} resource
 * @param {FetchOptions} options
 * @returns {Promise<Response>}
 */
const fetchWithTimeout = async (resource, options = {}) => {
  const { timeout = 10000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await globalThis.fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

const AUTH_RETRY_STATUSES = new Set([401]);

const withAuthorization = (headersInit, token) => {
  if (headersInit instanceof Headers) {
    const headers = new Headers(headersInit);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  if (Array.isArray(headersInit)) {
    const headers = new Headers(headersInit);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  return {
    ...(headersInit || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Fetch autenticado reusable para proxies que aceptan el Bearer de farmOS
 * (sidecar MCP, Ollama detras de nginx, y otros endpoints internos).
 *
 * Mantiene el contrato nativo de fetch: devuelve Response y no parsea body.
 * Ante 401 intenta renovar el access token una sola vez y reintenta la
 * misma request con el Bearer nuevo. Si no hay token local, preserva el fetch
 * original sin Authorization para no romper endpoints publicos.
 *
 * @param {RequestInfo|URL} resource
 * @param {RequestInit & { retryForbidden?: boolean, allowServiceWorkerOffline?: boolean }} [options]
 * @param {boolean} [_retried]
 * @returns {Promise<Response>}
 */
export const fetchWithAuthRetry = async (resource, options = {}, _retried = false) => {
  const { retryForbidden = true, allowServiceWorkerOffline = false, ...requestOptions } = options;
  if (typeof navigator !== 'undefined' && navigator.onLine === false && !allowServiceWorkerOffline) {
    throw new TypeError('Offline');
  }
  const token = await getAccessToken();
  const headers = withAuthorization(requestOptions.headers, token);

  const response = await globalThis.fetch(resource, { ...requestOptions, headers });

  if (!AUTH_RETRY_STATUSES.has(response.status) || _retried
      || (response.status === 403 && !retryForbidden)) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    if (token && ['rejected', 'missing'].includes(getLastRefreshFailureReason())) {
      await expireSession({ status: response.status, resource: String(resource) });
    }
    return response;
  }

  const retryHeaders = withAuthorization(options.headers, refreshed);
  console.info(`[API] ${response.status} -> token renovado, reintentando ${resource}.`);
  return globalThis.fetch(resource, { ...requestOptions, headers: retryHeaders });
};

/**
 * Mapping de bundles legacy de FarmOS 3.x → FarmOS 4.x.
 * FarmOS 4.x renombró:
 *   - log/task     → log/activity (los "tasks" se modelan como activities)
 *   - log/planting → log/seeding (los "plantings" se llaman seedings)
 *   - asset/person → NO EXISTE (los users de FarmOS 4.x son `users`, no assets;
 *                    Chagra debe migrar gradualmente a usar /user en su lugar)
 * Aplicado 2026-05-13 tras install fresh FarmOS 4.x en el servidor.
 *
 * Este mapping es transición: el cliente sigue usando los nombres viejos
 * internamente (log--task, log--planting) por compatibilidad con código
 * existente; sólo la URL outgoing se traduce. Roadmap: migrar el cliente
 * a los nombres canónicos FarmOS 4.x en sprint post-demo-institucional.
 */
const FARMOS_BUNDLE_RENAMES = [
  { legacy: '/api/log/task',     modern: '/api/log/activity' },
  { legacy: '/api/log/planting', modern: '/api/log/seeding'  },
];

// Mapping bidireccional de `type` field en payloads JSON:API.
// El cliente Chagra usa nombres legacy internamente (log--task, log--planting);
// el servidor FarmOS 4.x usa los modernos (log--activity, log--seeding).
const TYPE_LEGACY_TO_MODERN = {
  'log--task':     'log--activity',
  'log--planting': 'log--seeding',
};
const TYPE_MODERN_TO_LEGACY = {
  'log--activity': 'log--task',
  'log--seeding':  'log--planting',
};

/**
 * Walk recursivo de un objeto/array y aplica el mapping a campos `type` string.
 * NO modifica el input — devuelve copia transformada.
 */
const remapTypes = (node, mapping) => {
  if (Array.isArray(node)) return node.map((x) => remapTypes(x, mapping));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'type' && typeof v === 'string' && mapping[v]) {
        out[k] = mapping[v];
      } else {
        out[k] = remapTypes(v, mapping);
      }
    }
    return out;
  }
  return node;
};

const remapLegacyBundleUrl = (endpoint) => {
  for (const { legacy, modern } of FARMOS_BUNDLE_RENAMES) {
    if (endpoint.startsWith(legacy)) {
      // Substituir solo el prefijo, preservar query string y demás.
      return modern + endpoint.slice(legacy.length);
    }
  }
  return endpoint;
};

/**
 * MVP multi-finca — inyecta `filter[uid.name]=<tenantId>` en GET a
 * /api/asset/* y /api/log/* cuando hay un tenant activo y la URL aún no trae
 * un filtro de owner. Defense-in-depth cliente-side: si el backend ya restringe
 * por OAuth scope esto es redundante; si NO, evita IDOR latente cuando dos
 * pilotos comparten backend.
 *
 * Reglas:
 *  - Solo aplica a /api/asset/* (sin sub-id, ej /api/asset/plant) y /api/log/*.
 *    Para GET por id (/api/asset/plant/<uuid>) NO inyectamos — farmOS valida
 *    por id directo y romper acceso a un id propio sería peor que dejar pasar.
 *  - Solo en URLs sin filter[uid|owner] ya presente — respetar callers que
 *    fijan filtros explícitos (assetService.findPersonByName usa filter[name]).
 *  - Si no hay tenant activo (pre-login, dev sin login), no se toca la URL —
 *    preserva el comportamiento single-tenant histórico.
 *
 * Limitación conocida: farmOS expone `uid` (autor del asset) en asset--*; si
 * el operador hereda assets creados por otro usuario, este filtro los
 * ocultaría. Aceptable en MVP — los pilotos arrancan con bases vacías.
 *
 * TODO(multifinca-backend): cuando did:key + UCAN estén en farmOS (), sustituir `filter[uid.name]` por validación UCAN cap +
 * `filter[finca_did]` en assets y dejar este shim como deprecated.
 */
const injectTenantFilter = (endpoint, method) => {
  if (method && method !== 'GET') return endpoint;
  const tenantId = getActiveTenantId();
  if (!tenantId) return endpoint;

  // Solo bundles de asset/log de lista (no por id concreto).
  const listLikeMatch = endpoint.match(/^\/api\/(asset|log)\/[a-z_]+(?:\?|$)/);
  if (!listLikeMatch) return endpoint;
  // Excluir GET por id: /api/asset/plant/<uuid>
  const afterBundle = endpoint.slice(listLikeMatch[0].length - (listLikeMatch[0].endsWith('?') ? 1 : 0));
  if (afterBundle && afterBundle.startsWith('/')) return endpoint;

  // No pisar filtros pre-existentes de owner/uid (ej. callers que ya saben).
  if (/[?&]filter\[(uid|owner)/.test(endpoint)) return endpoint;

  const sep = endpoint.includes('?') ? '&' : '?';
  // farmOS JSON:API: filter[uid.name]=<username> matchea el autor del asset.
  // Encode para usernames con caracteres no-ASCII.
  const members = getActiveTenantMembers();
  if (members.length) {
    const memberValues = members.map((name) => `filter[m][condition][value][]=${encodeURIComponent(name)}`).join('&');
    return `${endpoint}${sep}filter[m][condition][path]=uid.name&filter[m][condition][operator]=IN&${memberValues}`;
  }
  return `${endpoint}${sep}filter[uid.name]=${encodeURIComponent(tenantId)}`;
};

// Endpoints que NO existen en FarmOS 4.x — devolver respuesta vacía graceful
// en lugar de 404 que confunde al operador con error rojo en consola.
const FARMOS_BUNDLE_GONE = [
  '/api/asset/person',  // FarmOS 4.x no tiene asset/person; users = /user
];

const isGoneBundle = (endpoint) =>
  FARMOS_BUNDLE_GONE.some((prefix) => endpoint.startsWith(prefix));

export const fetchFromFarmOS = async (endpoint, options = {}, _retried = false) => {
  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    console.info(`[DEMO] blocked FarmOS call to ${endpoint}`);
    return {};
  }

  // Bundles inexistentes en FarmOS 4.x — graceful empty respuesta.
  if (isGoneBundle(endpoint)) {
    console.info(`[API] Bundle obsoleto en FarmOS 4.x ignorado: ${endpoint}`);
    return { data: [], jsonapi: { version: '1.0' } };
  }

  // Mapping de bundles renombrados FarmOS 3.x → 4.x.
  const mappedEndpoint = remapLegacyBundleUrl(endpoint);
  // MVP multi-finca: scoping cliente-side por owner (uid.name).
  const scopedEndpoint = injectTenantFilter(mappedEndpoint, options.method || 'GET');

  const token = await getAccessToken();
  if (!token) {
    const isLoginPage = typeof window !== 'undefined' && window.location.hash === '#login';
    if (!isLoginPage) {
      console.warn('[API] Token no disponible. Continuando en modo offline.');
    }
    // La cola lo trata como auth y no gasta reintentos. `sessionLost` distingue
    // una sesión que ya no existe de un token vencido que no se renovó por red.
    const sessionLost = (await hasStoredAccessToken()) === false;
    throw Object.assign(new Error('Token no disponible.'), { code: AUTH_MISSING, sessionLost });
  }

  const isFormData = options.body instanceof FormData;
  const headers = {
    'Accept': 'application/vnd.api+json',
    'Authorization': `Bearer ${token}`,
    ...(options.headers || {})
  };

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/vnd.api+json';
  } else if (isFormData) {
    delete headers['Content-Type'];
  }

  // Outgoing: mapear `type: log--task` → `log--activity` etc. en el body
  // JSON antes de enviar al server. NO toca FormData (que usa multipart).
  let outgoingBody = options.body;
  if (!isFormData && typeof outgoingBody === 'string' && outgoingBody.includes('"type"')) {
    try {
      const parsed = JSON.parse(outgoingBody);
      const remapped = remapTypes(parsed, TYPE_LEGACY_TO_MODERN);
      outgoingBody = JSON.stringify(prepareAssetWritePayload(remapped, { method: options.method || 'GET' }));
    } catch (_) {
      // Body no es JSON parseable — dejar como está.
    }
  }

  try {
    const { useFincaActiveStore } = await import('./fincaActiveStore.js');
    const baseUrl = useFincaActiveStore.getState().getActiveEndpoint();
    // Async auth may outlive a tenant switch. Scoped callers can cancel here,
    // immediately before dispatch, including on an authentication retry.
    const { contextIsCurrent, ...requestOptions } = options;
    if (contextIsCurrent && !contextIsCurrent()) throw new Error('Request context changed');
    const response = await fetchWithTimeout(`${baseUrl}${scopedEndpoint}`, {
      ...requestOptions,
      method: options.method || 'GET',
      body: outgoingBody,
      headers
    });

    if (!response.ok) {
      // Interceptor de auth (401): el access token fue rechazado por el
      // servidor (vencido server-side o revocado) aunque el cliente lo creía
      // vigente. ANTES de mandar al operador a #login (la "sesión zombi": home
      // sin datos + "Tu sesión expiró"), intentar UNA renovación silenciosa con
      // el refresh_token y reintentar la misma petición. Solo si la renovación
      // no da token nuevo redirigimos a login. `_retried` evita bucles.
      if ((response.status === 401) && !_retried) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          console.info(`[API] ${response.status} → token renovado, reintentando ${endpoint}.`);
          return fetchFromFarmOS(endpoint, options, true);
        }
      }
      if (response.status === 401 && (_retried || ['rejected', 'missing'].includes(getLastRefreshFailureReason()))) {
        console.error(`[API] Auth error ${response.status}. Sesión vencida → re-login.`);
        // Estado de sesión CLARO (no zombi): el token fue rechazado y la
        // renovación no dio uno nuevo → la sesión está realmente muerta.
        // ANTES sólo se hacía `window.location.hash = '#login'`, pero el router
        // de App (HASH_VIEW_ROUTES) NO tiene ruta 'login' → el hash se ignoraba
        // y el usuario quedaba en el dashboard SIN datos: los contadores en 0
        // disparaban el OnboardingHero "¿dónde está su finca?" — engañoso, hace
        // creer que perdió su finca cuando sólo venció el token (prod-down
        // 2026-06-18). Ahora despachamos un evento que App escucha para navegar
        // a la pantalla de login ("Sesión vencida — vuelve a entrar"), y se
        // hace logout limpio para no reintentar con el token muerto. El hash se
        // mantiene como señal secundaria por compatibilidad.
        await expireSession({ status: response.status, endpoint });
      }
      const errorDetail = await response.text().catch(() => '');
      // Sanitize body antes de pegarlo al .message — Drupal/cloudflared a
      // veces devuelven HTML completo (página 404/502) que bloatea el toast
      // del operador (bug 2026-05-08).
      const ctype = response.headers?.get?.('content-type') || '';
      const cleanMsg = buildCleanErrorMessage('FarmOS API Error', response.status, response.statusText, errorDetail, ctype);
      const error = new Error(response.status === 403 ? 'Permiso insuficiente. Puede reintentar cuando se habilite el permiso.' : cleanMsg);
      /** @type {any} */ (error).status = response.status;
      /** @type {any} */ (error).detail = errorDetail;  // raw preservado para debug en console
      throw error;
    }
    // Incoming: mapear `type: log--activity` → `log--task` etc. en la
    // respuesta JSON:API antes de devolver al caller. Mantiene compat
    // con el resto del cliente que sigue esperando nombres legacy.
    // Un DELETE exitoso responde 204 sin cuerpo: no es un error de red.
    if (response.status === 204) return null;
    const data = await response.json();
    return remapTypes(data, TYPE_MODERN_TO_LEGACY);
  } catch (error) {
    if (error.name === 'AbortError') console.error('[Network] Timeout excedido en solicitud a FarmOS:', endpoint);
    throw error;
  }
};

/**
 * Wrapper sobre fetchFromFarmOS para POST/PUT/PATCH/DELETE.
 *
 * NO captura errores intencionalmente — delega al try/catch interno de
 * fetchFromFarmOS (que ya logea AbortError y propaga el error sanitized).
 * Cualquier caller debe envolver en try/catch para mostrar feedback al operador.
 *
 * @param {string} endpoint - ruta JSON:API ej. '/api/log/activity'
 * @param {Object|FormData|null} payload - cuerpo de la request (null para DELETE)
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} [method='POST']
 * @param {FetchOptions} [requestOptions] Optional context guard for scoped callers.
 * @returns {Promise<Object>} respuesta JSON:API parseada y type-remapped
 * @throws {Error} con .status / .detail si el servidor responde no-2xx
 * @throws {Error} si timeout (AbortError) o red caída
 */
export const sendToFarmOS = async (endpoint, payload, method = 'POST', requestOptions = {}) => {
  const isFormData = payload instanceof FormData;
  const options = { ...requestOptions, method };

  // Solo adjuntar body si hay payload y no es una operación DELETE
  if (payload && method !== 'DELETE') {
    options.body = isFormData ? payload : JSON.stringify(prepareLogForFarmOS(payload));
  }

  return await fetchFromFarmOS(endpoint, options);
};

/**
 * Sube un binario (foto/evidencia) a FarmOS por el flujo NATIVO de
 * Drupal 10 JSON:API. Hay dos rutas:
 *
 *  - Por ENTIDAD (cuando `target.entityId` viene): el archivo se agrega al campo
 *    de un log que ya existe y queda PERMANENTE de una vez.
 *      POST /api/{entity}/{bundle}/{entityId}/{field}
 *    Drupal la autoriza con el permiso de EDICIÓN de esa entidad
 *    (`update own observation log`). La respuesta es la lista de archivos del
 *    CAMPO: `data` es un ARREGLO de `file--file` (medido en producción el
 *    2026-10-28), sin `data.id`. El archivo se AGREGA a los que ya tenía el
 *    campo (no los reemplaza).
 *
 *  - Por CAMPO (sin `entityId`): crea un `file--file` TEMPORAL sin adjuntar y
 *    devuelve su UUID en `data.id`.
 *      POST /api/{entity}/{bundle}/{field}
 *    Drupal la autoriza con `administer log` OR `create log`; este último NO
 *    existe en farmOS (solo hay permisos por tipo), así que un rol de productor
 *    recibe 403 (medido en producción el 2026-10-28). El file queda temporal
 *    hasta que alguna entidad lo referencie; el cron de Drupal borra los
 *    temporales (~6 h), por eso el caller debe adjuntarlo.
 *
 * Ambas: `Content-Type: application/octet-stream` +
 * `Content-Disposition: file; filename="nombre.jpg"`.
 *
 * BUG HISTÓRICO (2026-07-08): el código usaba `POST /api/file/upload` con
 * FormData, ruta que NO EXISTE en farmOS 4.x (404), y el caller tragaba el error.
 *
 * @param {Blob} blob - binario a subir
 * @param {string} filename - nombre del archivo (se sanea para el header)
 * @param {{entity?: string, bundle?: string, field?: string, entityId?: string}} [target]
 *   Entidad/bundle/campo destino. Default: log observation, campo `file`.
 *   `entityId` (UUID) activa la subida por entidad.
 * @returns {Promise<Object>} respuesta JSON:API (ver arriba qué forma trae `data`)
 * @throws {Error} si el servidor responde no-2xx / red caída (mismo contrato
 *   que fetchFromFarmOS; el caller decide si es fatal)
 */
export const uploadBinaryToFarmOS = async (blob, filename, target = {}) => {
  const { entity = 'log', bundle = 'observation', field = 'file', entityId } = target;
  // Sanear el filename para el header (sin comillas ni saltos de línea).
  const safeName = String(filename || 'archivo.jpg').replace(/["\r\n]/g, '');
  const path = entityId
    ? `/api/${entity}/${bundle}/${encodeURIComponent(entityId)}/${field}`
    : `/api/${entity}/${bundle}/${field}`;
  return await fetchFromFarmOS(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `file; filename="${safeName}"`,
    },
    body: blob,
  });
};
