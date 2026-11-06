/**
 * sidecarClient.js — Cliente HTTP del sidecar chagra-agro-mcp (ADR-045 Fase 2).
 *
 * Wirea el AgentScreen del PWA con el endpoint `/api/mcp/agro/` (nginx
 * proxia al sidecar). Detrás de un feature flag — mientras el deploy del
 * sidecar no esté disponible, la flag queda en false y el comportamiento
 * del cliente es idéntico al anterior (todas las funciones devuelven null
 * sin hacer fetch).
 *
 * Pipeline esperado (cuando flag=true + sidecar live):
 *   userMessage → planNlu() → { use_tool, tool, args, ... }
 *                ↓ (si use_tool)
 *                callTool(tool, args) → result (ficha species/companions/etc.)
 *                ↓
 *   El AgentScreen inyecta `result` como context turn antes del chat LLM,
 *   dándole grounding citable. Si NLU/tool fallan o devuelven null, el
 *   chat sigue con el flujo RAG actual sin degradar UX.
 *
 * Reglas operativas:
 * - Offline-first: si `!navigator.onLine` → null inmediato, no fetch.
 * - Timeout NLU/pre-LLM y clima local 20s, otras tools 5s por defecto.
 * - Falla silenciosa: en error/non-200/abort → null + console.debug.
 *   NUNCA throw — el caller espera contract `T | null`.
 * - Sin dependencias: fetch puro + AbortController. Testeable sin red real.
 *
 * Env vars (todas opcionales, default seguro para offline-only):
 * - VITE_USE_SIDECAR_AGRO_MCP=true|false  — master switch (default false)
 * - VITE_SIDECAR_URL=/api/mcp/agro        — base relativa, nginx-proxied
 *
 * Telemetry: `console.debug('[sidecar]', ...)` con latencias para que el
 * operador mida adopción cuando active la flag (no hay backend de
 * telemetría aún — esto se sumará a una task futura si hace falta).
 */

import { fetchWithAuthRetry } from './apiService.js';
import { buildSidecarHeaders } from './tierService.js';
import { FINCA_TOOLS, confirmPlantOperation, fincaReadArgs, resolveOwnedFincaId, buildFincaComparisonChain } from './fincaToolConsent.js';
import { resolveAgentFarmAltitude } from './agentFarmAltitude.js';
import { pisoDeFinca } from '../visual/mundo3d/pisosTermicos.js';
// Fallo real del canario 2026-07-20: "ICA"/"Fuente" (mención de institución o
// meta-pregunta) se resolvían a especies fantasma (col rizada / Pennisetum
// setaceum) y el agente construía la respuesta sobre esa basura porque el
// único filtro (filterNoiseEntities) corría DESPUÉS de que el LLM ya había
// respondido (outputGuards.applyOutputGuards). Filtramos AQUÍ, apenas llega la
// respuesta del sidecar, para que ningún consumidor (prompt del LLM incluido)
// vea entidades-ruido. La utilidad de consultas no importa servicios de chat,
// así que no hay ciclo posible al importarla desde aquí.
import { filterNoiseEntities } from './outputGuardQueryUtils.js';
import { refineResolvedEntities } from './agentEntityFocus.js';

export const NLU_TIMEOUT_MS = 20000;
export const TOOL_TIMEOUT_MS = 5000;
// Presupuestos publicados por el sidecar en tool-timeouts.ts. Las demás
// herramientas usan el timeout de transporte de 5 s.
export const TOOL_TIMEOUTS_MS = Object.freeze({
  get_normativa_ica: 20000,
  get_clima_ideam: 20000,
  get_alertas_clima_zona: 20000,
  get_precio_sipsa: 20000,
  get_multihop_companions: 12000,
  get_subgrafo_relacional: 12000,
  get_enso_status: 20000,
  get_presion_enfermedad: 20000,
  get_finca_overview: 15000,
});

/**
 * Lee la flag `VITE_USE_SIDECAR_AGRO_MCP`. Acepta los strings 'true'/'1'
 * como habilitado. Cualquier otro valor (incluido undefined) → false.
 *
 * Exportado para que el caller pueda short-circuitear UI/telemetría sin
 * llamar las funciones (ej. tooltip "sidecar inactivo").
 */
export function isSidecarEnabled() {
  try {
    const raw = import.meta.env?.VITE_USE_SIDECAR_AGRO_MCP;
    if (raw === true) return true;
    if (typeof raw === 'string') {
      const v = raw.trim().toLowerCase();
      return v === 'true' || v === '1';
    }
    return false;
  } catch (_) {
    return false;
  }
}

function getBaseUrl() {
  try {
    const raw = import.meta.env?.VITE_SIDECAR_URL;
    if (typeof raw === 'string' && raw.trim()) {
      // Strip trailing slash para joinear sin duplicar
      return raw.trim().replace(/\/+$/, '');
    }
  } catch (_) {
    // ignore
  }
  return '/api/mcp/agro';
}

/**
 * Wrapper interno: GET con timeout + headers + degrade-to-null. Espejo
 * defensivo de `postJson`. Usado por `/clima/snapshot` (#316). NO exportado.
 */
async function getJson(path, query, timeoutMs, signal) {
  if (!isSidecarEnabled()) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    console.debug('[sidecar] offline — skip', path);
    return null;
  }

  const base = getBaseUrl();
  const qs = query && Object.keys(query).length > 0
    ? '?' + new URLSearchParams(
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  const url = `${base}${path}${qs}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();

  // Incluir x-chagra-tier para que el sidecar aplique gating de features Pro.
  // buildSidecarHeaders resuelve el tier del usuario logueado (defense-in-depth;
  // el gating duro es server-side).
  const headers = buildSidecarHeaders();

  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  try {
    const res = await fetchWithAuthRetry(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.debug('[sidecar] non-2xx', { path, status: res.status });
      return null;
    }
    const json = await res.json();
    const latency = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0);
    console.debug('[sidecar] ok', { path, latency_ms: latency });
    return json;
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'unknown');
    console.debug('[sidecar] fail', { path, reason });
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

/**
 * Wrapper POST con timeout + headers + degrade-to-null (offline/timeout/non-2xx → null).
 * Exportado como primitivo compartido para servicios de feature que hablan con el
 * mismo sidecar (p.ej. redService.js / RED de trueque). Mantiene el mismo auth-retry,
 * tier header y degradación graceful que el resto del cliente.
 */
export async function postJson(path, body, timeoutMs, errorContext = null) {
  if (!isSidecarEnabled()) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    console.debug('[sidecar] offline — skip', path);
    return null;
  }

  const fincaTool = path.startsWith('/tools/') && FINCA_TOOLS.has(path.slice(7));
  const base = getBaseUrl();
  const url = `${base}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Incluir x-chagra-tier para gating Pro en el sidecar (defense-in-depth).
  const headers = buildSidecarHeaders();

  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  try {
    const res = await fetchWithAuthRetry(url, {
      method: 'POST',
      ...(fincaTool ? { retryForbidden: false } : {}),
      headers,
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.debug('[sidecar] non-2xx', { path, status: res.status });
      if (fincaTool && res.status === 403) {
        return { _error: true, reason: 'finca_forbidden', tool: path.slice(7) };
      }
      if (errorContext) {
        let serverMessage = '';
        try {
          const payload = await res.json();
          serverMessage = payload?.error || payload?.message || payload?.reason || '';
        } catch (_) { /* body no JSON: el status sigue siendo causa suficiente */ }
        return {
          _error: true,
          reason: 'http_error',
          tool: errorContext.tool,
          status: res.status,
          ...(serverMessage ? { message: String(serverMessage) } : {}),
        };
      }
      return null;
    }
    const json = await res.json();
    const latency = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0);
    console.debug('[sidecar] ok', { path, latency_ms: latency });
    return json;
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'unknown');
    console.debug('[sidecar] fail', { path, reason });
    if (errorContext) {
      return {
        _error: true,
        reason: err?.name === 'AbortError' ? 'timeout' : 'network_error',
        tool: errorContext.tool,
        ...(err?.message && err?.name !== 'AbortError' ? { message: err.message } : {}),
      };
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Llama `POST ${BASE}/nlu` para que el planner decida si el mensaje del
 * usuario debe routearse a un MCP tool.
 *
 * @param {string} userMessage — texto del operador
 * @param {string} [context] - context turn opcional (ej. historial reciente)
 * @returns {Promise<null | {
 *   useTool: boolean,
 *   tool: string | null,
 *   args: object | null,
 *   toolChain: Array<{tool: string, args: object}> | null,
 *   latencyMs: number | null,
 *   modelUsed: string | null,
 *   heuristicSkipped: boolean,
 *   reason: string | null,
 *   error: string | null,
 *   directResponse?: string,
 * }>}
 *
 * Normaliza el snake_case del API a camelCase JS-idiomatic. Devuelve null
 * si: flag off, offline, timeout, non-2xx, body inválido.
 *
 * D2 (#246) tool composition: cuando el sidecar NLU devuelve `tool_chain`
 * (array no vacío), se expone como `toolChain` camelCase para que el
 * cliente ejecute la cadena con `executeToolChain()`. El modo simple
 * (`tool` + `args`) sigue siendo soportado en paralelo.
 */
export async function planNlu(userMessage, context) {
  if (!userMessage || typeof userMessage !== 'string') return null;
  const body = { user_message: userMessage };
  if (context && typeof context === 'string') body.context = context;

  const raw = await postJson('/nlu', body, NLU_TIMEOUT_MS);
  if (!raw || typeof raw !== 'object') return null;

  let toolChain = null;
  if (Array.isArray(raw.tool_chain) && raw.tool_chain.length > 0) {
    toolChain = raw.tool_chain
      .filter((step) => step && typeof step === 'object' && typeof step.tool === 'string')
      .map((step) => ({
        tool: step.tool,
        args: normalizePlannerToolArgs(step.tool, step.args) || {},
      }));
    if (toolChain.length === 0) toolChain = null;
  }

  let tool = typeof raw.tool === 'string' ? raw.tool : null;
  let args = normalizePlannerToolArgs(raw.tool, raw.args);

  // Bug reportado 2026-10-29: el planner NLU no conoce los ids reales de las
  // fincas del usuario (solo ve texto de chat), así que ante "compare mis dos
  // fincas" no puede rellenar un finca_id por cada una — a lo mucho adivina
  // uno (o un marcador). Una sola llamada nunca contesta una comparación:
  // se reemplaza por una llamada por cada finca propia de la cuenta.
  const compareToolName = tool || (toolChain && toolChain[0] && toolChain[0].tool) || null;
  if (compareToolName) {
    const compareArgs = tool ? args : toolChain[0].args;
    const comparisonChain = buildFincaComparisonChain(compareToolName, compareArgs, userMessage);
    if (comparisonChain) {
      toolChain = comparisonChain;
      tool = null;
      args = null;
    }
  }

  return {
    useTool: Boolean(raw.use_tool) || Boolean(toolChain),
    tool,
    args,
    toolChain,
    latencyMs: Number.isFinite(raw.latency_ms) ? raw.latency_ms : null,
    modelUsed: typeof raw.model_used === 'string' ? raw.model_used : null,
    heuristicSkipped: Boolean(raw.heuristic_skipped),
    reason: typeof raw.reason === 'string' ? raw.reason : null,
    error: typeof raw.error === 'string' ? raw.error : null,
    ...(typeof raw.direct_response === 'string' && raw.direct_response.trim()
      ? { directResponse: raw.direct_response } : {}),
  };
}

/**
 * Normaliza la salida no confiable del planner antes de que llegue al
 * dispatcher de tools. El planner puede representar un dato que no pudo
 * derivar como string vacío; para el calendario eso no es un argumento
 * válido, sino la causa del 502 del sidecar (`mes:"", piso_termico:""`).
 *
 * La ausencia queda visible para `callTool`, que devuelve el stub
 * `no_piso_termico` y no hace una petición inválida. Los valores reales se
 * conservan, con la normalización de tildes existente.
 *
 * @param {string|null|undefined} toolName
 * @param {object|null|undefined} args
 * @returns {object|null}
 */
const SINGLE_VALUE_ENUM_FIELDS = Object.freeze({
  get_calendario_siembra: ['piso_termico'],
  get_cultivos_viables: ['piso_termico'],
  get_diseno_restauracion: ['objetivo'],
  get_normativa_ica: ['action'],
  get_clima_ideam: ['action'],
  get_precio_sipsa: ['action'],
  get_practicas_agua: ['accion'],
});

function normalizeOriginEnumArg(toolName, args) {
  if (!['get_cultivos_viables', 'get_diseno_restauracion'].includes(toolName)
    || !Array.isArray(args.origin)) return args;

  const canonicalValues = args.origin.map((value) => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'co') return 'Co';
    if (normalized === 'non-co') return 'NON-Co';
    if (normalized === 'both') return 'both';
    return null;
  });
  if (canonicalValues.length === 0 || canonicalValues.some((value) => value === null)) return args;

  const selected = new Set(canonicalValues);
  const origin = selected.size > 1 || selected.has('both')
    ? 'both'
    : [...selected][0];
  return { ...args, origin };
}

function normalizeSingleValueEnumArrays(toolName, args) {
  const fields = SINGLE_VALUE_ENUM_FIELDS[toolName] || [];
  let normalized = args;
  for (const field of fields) {
    const value = normalized[field];
    if (!Array.isArray(value) || value.length !== 1 || typeof value[0] !== 'string') continue;
    if (normalized === args) normalized = { ...args };
    normalized[field] = value[0];
  }
  return normalized;
}

/**
 * Normaliza argumentos de enum del planner y del dispatcher. El planner a
 * veces serializa un enum de texto como una lista; los campos con una sola
 * selección se desenvuelven, y `get_cultivos_viables.origin` combina Co y
 * NON-Co en el valor contractual `both`.
 *
 * @param {string|null|undefined} toolName
 * @param {object|null|undefined} args
 * @returns {object|null}
 */
export function normalizePlannerToolArgs(toolName, args) {
  if (!args || typeof args !== 'object') return null;

  const withSingleEnums = normalizeSingleValueEnumArrays(toolName, args);
  const withOrigin = normalizeOriginEnumArg(toolName, withSingleEnums);
  const normalized = normalizePisoTermicoArg(withOrigin);
  if (toolName === 'get_diseno_restauracion') return omitEmptyRestauracionArgs(normalized);
  if (toolName !== 'get_calendario_siembra') return normalized;

  const sanitized = omitEmptyCalendarioArgs(toolName, normalized);
  if (calendarioSinPisoTermico(sanitized)) {
    const withoutEmptyPiso = { ...sanitized };
    if ('piso_termico' in withoutEmptyPiso) {
      delete withoutEmptyPiso.piso_termico;
    }
    return withoutEmptyPiso;
  }
  return sanitized;
}

/**
 * `get_diseno_restauracion` — `region` e `invasora_mencionada` son opcionales
 * en el schema zod del sidecar, pero CUANDO VIAJAN exigen `.min(2)`: una
 * cadena vacía no es "sin dato" para zod, es un valor presente que no cumple
 * el mínimo, y el tool responde 400 `invalid_arguments` (`too_small`) —
 * tumbando TODO el plan aunque `objetivo`/`altitud_msnm` sí sean correctos.
 * Mismo patrón que `omitEmptyCalendarioArgs` para `mes`: el planner NLU
 * (LLM chico, function-calling con schema completo) representa un campo
 * opcional que no pudo derivar como string vacío en vez de omitirlo.
 * Confirmado contra el schema real (`GetDisenoRestauracionInput`,
 * módulos-opcionales/modules/agro-mcp/src/schemas/inputs.ts): `{objetivo:'bosque',
 * region:''}` → zod `too_small` en `region`; sin el campo, pasa.
 */
function omitEmptyRestauracionArgs(args) {
  if (!args || typeof args !== 'object') return args;
  let out = args;
  for (const field of ['region', 'invasora_mencionada']) {
    if (typeof out[field] === 'string' && out[field].trim() === '') {
      if (out === args) out = { ...args };
      delete out[field];
    }
  }
  return out;
}

/**
 * D2 (#246) — ejecuta una cadena de tools secuencialmente. Devuelve un
 * array de evidences (uno por tool), preservando el orden. Tools con
 * resultado null (timeout/error) se devuelven con `result: null` para
 * que el formatter pueda señalar el gap al LLM.
 *
 * Cap máximo de pasos: 3 (alineado con el contrato NLU del sidecar). Pasos
 * extra se ignoran para evitar inflar el contexto del LLM.
 *
 * @param {Array<{tool: string, args?: object}>} chain
 * @param {{farmAltitude?: number|null}} [options] Altitud resuelta para el turno actual.
 * @returns {Promise<Array<{tool: string, args: object, result: any}>>}
 */
export async function executeToolChain(chain, options = {}) {
  if (!Array.isArray(chain) || chain.length === 0) return [];
  const MAX_STEPS = 3;
  const limited = chain.slice(0, MAX_STEPS);
  const steps = [];
  for (const step of limited) {
    if (!step || typeof step.tool !== 'string') continue;
    const args = (step.args && typeof step.args === 'object') ? step.args : {};
    const toolOptions = TOOLS_REQUIRING_FARM_ALTITUDE.has(step.tool) &&
      Object.prototype.hasOwnProperty.call(options, 'farmAltitude')
      ? { farmAltitude: options.farmAltitude }
      : undefined;
    steps.push({ tool: step.tool, args, toolOptions });
  }

  // Bug reportado 2026-10-31 (comparación de fincas): una cadena que repite
  // la MISMA finca tool (el patrón que arma buildFincaComparisonChain, una
  // llamada por finca propia) pega contra el mismo backend lento —
  // get_finca_overview ya tiene presupuesto propio de 15 s (8214a5b61) porque
  // farmOS no filtra plantas por finca y UNA sola consulta tarda varios
  // segundos. Dispararlas a la vez (SPEED-5 #257, pensado para tools
  // DISTINTAS e independientes) hace que las dos compitan por ese mismo
  // recurso lento; la más lenta puede superar su propio presupuesto aunque
  // el sidecar termine respondiendo 200 — el aviso "no pude consultar una
  // de las fuentes" con evidencia que en realidad sí llegó. Para esta forma
  // de cadena (misma finca tool repetida) se corre en SERIE; el resto de
  // cadenas (tools distintos) sigue en paralelo sin cambios.
  const sameFincaToolRepeated = steps.length > 1 &&
    steps.every((s) => s.tool === steps[0].tool && FINCA_TOOLS.has(s.tool));
  if (sameFincaToolRepeated) {
    const out = [];
    for (const s of steps) {
      const result = s.toolOptions ? await callTool(s.tool, s.args, s.toolOptions) : await callTool(s.tool, s.args);
      out.push({ tool: s.tool, args: s.args, result });
    }
    return out;
  }

  // SPEED-5 (#257): los pasos del chain son lecturas INDEPENDIENTES — sus args
  // vienen del query del usuario, no del resultado de un paso previo (ver
  // synthesizeToolChain en el sidecar nlu.ts, que sintetiza p.ej.
  // [get_companions, get_biopreparados] ambos con args del mensaje). Por eso
  // los disparamos en paralelo: la latencia del chain pasa de sum(pasos) a
  // max(pasos). callTool() se invoca AHORA (inicia el fetch en orden → el orden
  // de mock.calls / requests se preserva) y guardamos la promesa; reensamblamos
  // las evidences en el mismo orden del chain. callTool ya tolera errores
  // (devuelve null), así que Promise.all nunca rechaza.
  const pending = steps.map((s) => ({
    tool: s.tool,
    args: s.args,
    promise: s.toolOptions ? callTool(s.tool, s.args, s.toolOptions) : callTool(s.tool, s.args),
  }));
  const results = await Promise.all(pending.map((p) => p.promise));
  return pending.map((p, i) => ({ tool: p.tool, args: p.args, result: results[i] }));
}

/**
 * Whitelist de tools que el cliente puede invocar. Defensa en profundidad:
 * el endpoint del sidecar es trusted, pero acotamos el set para que un
 * planner buggy/comprometido no pueda pedir paths arbitrarios.
 *
 * Las últimas 3 (`get_normativa_ica`, `get_clima_ideam`, `get_precio_sipsa`)
 * vienen de los merges módulos opcionales #64/#65/#66 + hotfix #67 — exponen
 * normativa ICA defensiva, clima IDEAM nacional y precios SIPSA DANE.
 *
 * TODO(NLU): add keywords agroquimico/clima/precio in módulos opcionales nlu.ts
 * (sidecar repo, NO aquí) para que el planner las routee automáticamente.
 * Mientras tanto el frontend hace detection por keywords + invocación
 * directa de los wrappers (ver AgentScreen handleSubmit).
 */
const ALLOWED_TOOLS = new Set([
  'get_finca_overview',
  'get_sensor_finca',
  'get_weather_data',
  'add_planta_finca',
  'get_species',
  'get_companions',
  'get_biopreparados',
  'get_pest_controllers',
  'get_multihop_companions',
  // GraphRAG multi-hop + restauración (sidecar feat/graphrag-multihop, 2026-06-10).
  'get_subgrafo_relacional',
  'get_diseno_restauracion',
  // Silvopastoril (chip Silvopastoreo, 2026-06-10): forrajeras multipropósito
  // CIPAV/Agrosavia del grafo AGE. La tool existía en el sidecar pero no estaba
  // en esta allow-list — el chip la expone.
  'get_diseno_silvopastoril',
  'validate_visual_match',
  'validate_taxonomy',
  'get_normativa_ica',
  'get_clima_ideam',
  'get_precio_sipsa',
  // PoC alertas meteorológicas (#316) — resueltas por el sidecar (NO MCP child).
  // Cache compartida con `/clima/snapshot` y refrescada por systemd timer.
  'get_enso_status',
  'get_alertas_clima_zona',
  // Grounding de conocimiento del grafo (2026-06-10): usos tradicionales
  // documentados (siempre con descargo educativo), perfil de toxicidad,
  // variedades/cultivares registrados y requerimientos de suelo/nutrición.
  // Si el grafo no tiene el dato, la tool devuelve found:false y el agente
  // responde neutral — NUNCA inventa.
  'get_saberes',
  'get_toxicidad',
  'get_variedades',
  'get_suelo',
  // Calendario de siembra (chip "calendario", fix grounding P0 2026-06-24):
  // cultivos a sembrar este mes según el piso térmico. El tool ya vivía en el
  // sidecar pero NO estaba en esta allow-list — el chip routeaba a get_species
  // por un comentario stale. Es read-only seguro (solo lee el catálogo).
  'get_calendario_siembra',
  // ── Reconciliación allow-list cliente ↔ 41 tools del NLU (fix grounding P0
  //    2026-06-25). El NLU planner conocía 41 tools pero el cliente exponía 20:
  //    si el planner ruteaba a una de las 21 restantes, el turno degradaba a
  //    RAG SIN grounding en silencio. Agregamos aquí las tools que son SEGURAS y
  //    VALIOSAS de exponer (grounding del grafo AGE / catálogo / dataset
  //    institucional local, ruteables por el NLU con id|nombre|término).
  //
  //    NO se exponen las que exigen credenciales farmOS, coords de dispositivo
  //    o NIT DIAN (get_clima_finca, get_documento_soporte_dian,
  //    get_ubicacion_actual): el NLU no puede rellenar esos args desde una
  //    frase de chat → devolverían {available:false}/502. Esas quedan en
  //    DEFLECCIÓN HONESTA (ver guard `not_allowed` en AgentScreen): el agente
  //    dice claro "esa consulta todavía no está disponible" en vez de degradar
  //    callado a RAG.

  // Grounding del grafo AGE por especie (id snake_case O nombre común): el NLU
  // rellena `species_id` (o el arg análogo) desde el nombre que dijo el usuario.
  'get_associations', //          asociaciones benéficas + técnicas aplicables
  'get_fenologia', //             etapas BBCH + ventanas de plaga por etapa
  'get_polinizacion', //          polinizadores + colmenas/ha + efecto cuaje
  'get_invasoras_alternativas', // nativas de reemplazo a invasoras combustibles
  // Grounding standalone (catálogo / glosario / dataset institucional local):
  'get_saberes_tradicionales', // glosario agroecológico (96 términos) por término
  'get_variedades_cultivo', //    variedades registradas ICA/AGROSAVIA por cultivo
  'get_psa_elegibilidad', //      Pago por Servicios Ambientales (Decreto 1007/2018)
  'get_alerta_carbono', //        alerta defensiva bonos de carbono + PSA estatal
  'get_alerta_normativa_paramo', // alerta regulatoria de páramo (Ley 1930/2018)
  'get_alerta_clima_consejo', //  alerta de decisión por cambio climático
  // «Chagra enseña a usar Chagra» (ayuda groundeada): cómo usar una función de
  // la app, qué puede hacer Chagra y dónde se ve algo, con deep-link. Standalone
  // (manifiesto de funciones), grounded — found:false si la función no existe
  // (nunca inventa). El cliente además intercepta la mayoría de estas preguntas
  // localmente (metaAyudaIntent), pero se expone para el ruteo del NLU en chat.
  'get_ayuda_funcion',
  // ── Reconciliación allow-list cliente ↔ 41 tools del NLU · Fase 1 (fix
  //    grounding P0, CAPABILITIES_STATUS.md §7.3). El sidecar NLU (nlu.ts) ya
  //    define y rutea estas 3, pero el cliente las rechazaba con
  //    {_error, reason:'not_allowed'} → el turno degradaba a RAG SIN grounding
  //    en silencio. Las 3 son read-only del grafo AGE, con args que el NLU SÍ
  //    puede rellenar desde una frase de chat (mismo patrón que tools ya
  //    expuestas), así que son seguras y valiosas de exponer:
  //  - get_cultivos_viables: cultivos VIABLES a una altitud (grafo AGE). Arg
  //    `altitud` (msnm) — idéntico patrón a get_diseno_silvopastoril/restauracion
  //    ya expuestas. Alternativas honestas cuando el usuario propone un cultivo
  //    inviable para su piso térmico. Degrada a {available:false} si AGE cae.
  //  - get_diseno_finca: policultivo agroecológico estilo Restrepo por rol
  //    funcional (polinizadores/abonos_verdes/sombra/cercas_vivas/alelopaticas)
  //    y VIABLE a la altitud. Mismo arg `altitud`. Degrada si AGE cae.
  //  - get_dosis_biopreparado: dosis, periodo de carencia, incompatibilidades y
  //    registro ICA de biopreparados (grafo AGE). SEGURIDAD: responde
  //    "¿cuánto le pongo? ¿cada cuánto? ¿tiene carencia?". Args
  //    `biopreparado_id`|`pest_id` (snake_case) — mismo patrón que get_biopreparados
  //    ya expuesta. Degrada a found:false si el grafo no tiene el dato.
  'get_cultivos_viables',
  'get_diseno_finca',
  'get_dosis_biopreparado',
  // ── Reconciliación allow-list · Fase 3 (SSOT 2026-07-29). main las exponía
  //    (39 tools), dev no (35) → el NLU las ruteaba y el cliente las rechazaba
  //    con `not_allowed` → el turno degradaba a RAG SIN grounding en silencio.
  //    Las 4 son read-only del grafo AGE / dataset institucional local, con args
  //    que el NLU SÍ rellena desde una frase. VERIFICADAS EN VIVO (200):
  //  - get_folk_sintoma: mapea un nombre folk de síntoma/enfermedad al grafo
  //    (args `sintoma`/`cultivo`). Muy ruteada por el NLU. found:false → pide
  //    foto/descripción, NUNCA inventa a qué plaga corresponde.
  //  - get_aporte_nutricional: aporte nutricional (ICBF TCAC) por especie
  //    (arg `species_id_or_name`). found:false si no documentado.
  //  - get_canales_comercializacion: canales de comercialización por especie
  //    (arg `species_id_or_name`).
  //  - get_practicas_agua: prácticas de manejo del agua (arg `accion`:
  //    conservacion|captacion|tratamiento|riesgo).
  'get_folk_sintoma',
  'get_aporte_nutricional',
  'get_canales_comercializacion',
  'get_practicas_agua',
  // FASE 2 (deferidas, NO exponer aún):
  //  - get_grado_dia: requiere `fecha_siembra` (ISO YYYY-MM-DD, sin default) que
  //    el NLU no puede sintetizar con fiabilidad desde una frase libre de chat.
  //    Se cablea mejor desde un contexto estructurado (asset plant con fecha de
  //    siembra conocida) o un chip dedicado, no desde el ruteo NLU. Mientras
  //    tanto queda en deflección honesta (guard `not_allowed` en AgentScreen).
  //
  // NO se exponen (siguen en deflección honesta) las que exigen credenciales
  // farmOS, coords de dispositivo o NIT DIAN — el NLU no puede rellenar esos
  // args desde una frase de chat: get_clima_finca, get_ubicacion_actual,
  // get_documento_soporte_dian.
]);

/**
 * ¿Está `toolName` en la allow-list que el cliente PWA expone?
 *
 * El NLU planner del sidecar conoce 41 tools, pero el cliente solo expone un
 * subconjunto (ver ALLOWED_TOOLS). Si el planner rutea a una de las restantes,
 * `callTool` la rechaza internamente con `{_error, reason:'not_allowed'}` —
 * pero ese rechazo es indistinguible de un fallo transitorio de red. Este
 * predicado permite al caller (AgentScreen) detectar el caso ANTES de llamar y
 * manejarlo de forma EXPLÍCITA y OBSERVABLE (telemetría + degradación
 * transparente) en vez de degradar a RAG en silencio.
 *
 * @param {string} toolName
 * @returns {boolean}
 */
export function isToolAllowed(toolName) {
  return typeof toolName === 'string' && ALLOWED_TOOLS.has(toolName);
}

const NORMATIVA_ICA_ACTIONS = new Set([
  'latest_active_ingredients',
  'extract_resolutions',
  'full_sync',
]);
const CLIMA_IDEAM_ACTIONS = new Set([
  'stations_near',
  'climate_series',
  'monthly_avg',
  'anomalies',
]);
const PRECIO_SIPSA_ACTIONS = new Set([
  'latest_price',
  'dataset_metadata',
  'related_resources',
]);

/**
 * Resuelve entidades vegetales/plagas mencionadas en el user_message contra
 * Apache AGE (chagra_kg). Sirve como capa pre-validation anti-alucinación
 * (DR taxonómico Tier 1 B): el binomio canónico autoritativo se inyecta al
 * system prompt del LLM ANTES de que responda, así no puede inventar
 * "gulupa = Psidium guajava".
 *
 * Returns null si: flag off, offline, AGE down (graceful), timeout.
 * Returns { entities: [...] } con entidades resueltas (puede ser []).
 *
 * Si se pasa `fincaAltitud` (msnm), se reenvía como `finca_altitud` para que el
 * sidecar enriquezca cada entidad con viabilidad/alternativas a esa altitud
 * (viabilidad ∈ {viable,marginal,inviable}, delta_altitud, alternativas_viables,
 * alternativas_cercanas). Es el MISMO request — CERO latencia añadida. El
 * sidecar lo ignora si no soporta el campo (degrada con gracia).
 *
 * MULTI-TURNO (#multiturno-grounding-2026-06-19): si se pasa `context` (historial
 * de conversación), se concatena con `userMessage` para enriquecer la query de
 * retrieval. Esto permite que el grounding mantenga contexto de turnos previos
 * (cultivo, variedad, altitud, problema mencionado). Retrocompatible: sin
 * `context`, comportamiento idéntico al anterior.
 *
 * @param {string} userMessage
 * @param {object} [opts]
 * @param {number|string|null} [opts.fincaAltitud] - msnm de la finca activa.
 * @param {string} [opts.context] - historial de conversación (últimos N turnos).
 * MODO CIENTÍFICO (#17): el sidecar corre `grounding-policy.ts`/`grounding-
 * prompt-formatter.ts` (WIRING real, audit 2026-07-04-optimizacion-
 * grounding-velocidad-inteligencia.md win #4) sobre las entidades ya
 * resueltas y devuelve un campo `grounding` con la decisión answer/hedge/
 * abstain + el semáforo verde/ámbar/rojo — se pasa tal cual (puede ser
 * `null` si el sidecar no lo computó, degradación graceful).
 *
 * @returns {Promise<null | { entities: Array<{
 *   mentioned: string,
 *   kind: 'species' | 'pest' | 'biopreparado',
 *   canonical_id: string,
 *   nombre_comun: string,
 *   nombre_cientifico: string,
 *   confidence: number,
 *   altitud_min?: number, altitud_max?: number, piso_termico?: string,
 *   temp_min?: number, temp_max?: number, categoria?: string,
 *   es_invasora?: boolean, conservation_status?: string,
 *   viabilidad?: 'viable' | 'marginal' | 'inviable', delta_altitud?: number,
 *   companions?: Array<string|object>, antagonists?: Array<string|object>,
 *   alternativas_viables?: Array<string|object>, alternativas_cercanas?: Array<string|object>,
 *   corrected_from?: string, correction?: string,
 * }>, grounding: null | {
 *   semaphore: 'verde' | 'ambar' | 'rojo',
 *   policy: 'answer' | 'hedge' | 'abstain',
 *   reason: string,
 *   resolved_entities: number,
 *   min_confidence: number,
 *   provenance: Array<{ entity_id: string, confidence: number, source: string|null, validation_level: string|null }>,
 *   block: string,
 * } }>}
 */
export async function resolveEntities(userMessage, opts = {}) {
  if (!userMessage || typeof userMessage !== 'string') return null;

  // Multi-turno: enriquecer la query con el contexto de la conversación
  // si está disponible. Esto permite que el grounding mantenga contexto
  // de turnos previos (cultivo, variedad, altitud, problema mencionado).
  let enrichedMessage = userMessage;
  if (opts && typeof opts.context === 'string' && opts.context.trim()) {
    // Concatenamos el historial ANTES del mensaje actual para dar contexto
    // El sidecar puede usar esto para mejorar la detección de entidades
    enrichedMessage = `${opts.context.trim()}\n\nMensaje actual: ${userMessage}`;
  }

  const body = { user_message: enrichedMessage };
  const alt = opts && opts.fincaAltitud != null ? Number(opts.fincaAltitud) : NaN;
  if (Number.isFinite(alt)) body.finca_altitud = alt;
  const raw = await postJson('/resolve-entities', body, NLU_TIMEOUT_MS);
  if (!raw || typeof raw !== 'object') return null;
  const grounding = raw.grounding && typeof raw.grounding === 'object' ? raw.grounding : null;
  if (!Array.isArray(raw.entities)) return { entities: [], grounding };
  // Filtramos entidades-ruido (siglas institucionales, meta-vocabulario de
  // "dame la fuente/norma", muletillas campesinas) ANTES de devolver — así
  // ningún consumidor (incluido el prompt del LLM en agentPromptBase.js, que
  // las presenta como "ENTIDADES RESUELTAS... autoritativo") ve basura como
  // verdad verificada. applyOutputGuards también filtra (idempotente y puro,
  // aplicarlo dos veces es inofensivo) — se deja así como defensa en capas.
  //
  // Después, el cultivo de la PREGUNTA manda (hard-test 2026-10-31, D-25 y
  // D-37): el sidecar resuelve también lo que viene del historial, así que se
  // descartan las especies/plagas que el mensaje actual no nombra cuando sí
  // nombra las suyas, y los nombres ambiguos («tomate») se fijan a su id.
  return { entities: refineResolvedEntities(filterNoiseEntities(raw.entities), userMessage), grounding };
}

/**
 * Pre-filtro determinista de FERMENTOS (capa 1 SAFETY-CRITICAL, módulos opcionales
 * #159 — DR-FOOD-3). Llama `POST ${BASE}/fermento-prefilter` con la query del
 * usuario; el sidecar detecta intención-fermento (kombucha, hidromiel, yuca
 * amarga, etc.), resuelve el nodo :Fermento en Apache AGE y devuelve un bloque
 * de instrucción listo para inyectar al system prompt (refusal/veto si aplica,
 * disclaimer fuerte, veto de claims de salud, autoridad institucional citada).
 *
 * El bloque es FAIL-SAFE: ante AGE caído o nodo sin revisión humana el sidecar
 * igual inyecta el bloque conservador. Se invoca EN PARALELO con
 * resolveEntities (mismo turno, antes del LLM) — espejo exacto de su patrón.
 *
 * NUNCA throw. Devuelve null si: flag off, offline, timeout, non-2xx, body
 * inválido → el caller degrada con gracia (no inyecta bloque, no rompe el
 * turno). Cuando `is_fermento_intent` es false, NO hay que inyectar nada.
 *
 * @param {string} userMessage — texto del operador.
 * @returns {Promise<null | {
 *   is_fermento_intent: boolean,
 *   fermento_id: string | null,
 *   veto_total: boolean,
 *   disclaimer_fuerte: boolean,
 *   system_prompt_block: string,
 *   fuente_autoridad: string | null,
 *   reason: string,
 * }>}
 */
export async function fermentoPrefilter(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return null;
  const raw = await postJson('/fermento-prefilter', { user_message: userMessage }, NLU_TIMEOUT_MS);
  if (!raw || typeof raw !== 'object') return null;
  return {
    is_fermento_intent: raw.is_fermento_intent === true,
    fermento_id: typeof raw.fermento_id === 'string' ? raw.fermento_id : null,
    veto_total: raw.veto_total === true,
    disclaimer_fuerte: raw.disclaimer_fuerte === true,
    system_prompt_block: typeof raw.system_prompt_block === 'string' ? raw.system_prompt_block : '',
    fuente_autoridad: typeof raw.fuente_autoridad === 'string' ? raw.fuente_autoridad : null,
    reason: typeof raw.reason === 'string' ? raw.reason : '',
  };
}

/**
 * Capa 1 GROUNDING de BIOPREPARADOS (módulos opcionales #248). Espejo exacto de
 * `fermentoPrefilter`: llama `POST ${BASE}/biopreparado-grounding` con
 * `{ user_message }` para que el sidecar resuelva, contra el catálogo MCP, si la
 * query toca un biopreparado real (p.ej. caldo bordelés) y devuelva un bloque de
 * system prompt con su composición/uso curados + la regla anti-negación
 * ("NUNCA digas que este insumo no existe"). FAIL-SAFE: ante MCP caído el sidecar
 * NO fabrica datos; este wrapper, además, es no-throw (devuelve null en
 * flag off / offline / timeout / 5xx / error de red), así que el caller degrada
 * con gracia (no inyecta bloque, no rompe el turno). Cuando `has_biopreparado`
 * es false, NO hay que inyectar nada.
 *
 * @param {string} userMessage — texto del operador.
 * @returns {Promise<null | {
 *   has_biopreparado: boolean,
 *   directResponse?: string,
 *   biopreparado_id: string | null,
 *   system_prompt_block: string,
 *   reason: string,
 * }>}
 */
export async function biopreparadoGrounding(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return null;
  const raw = await postJson('/biopreparado-grounding', { user_message: userMessage }, NLU_TIMEOUT_MS);
  if (!raw || typeof raw !== 'object') return null;
  return {
    has_biopreparado: raw.has_biopreparado === true,
    ...(typeof raw.direct_response === 'string' && raw.direct_response.trim()
      ? { directResponse: raw.direct_response } : {}),
    biopreparado_id: typeof raw.biopreparado_id === 'string' ? raw.biopreparado_id : null,
    system_prompt_block: typeof raw.system_prompt_block === 'string' ? raw.system_prompt_block : '',
    reason: typeof raw.reason === 'string' ? raw.reason : '',
  };
}

/**
 * GUARDA de desajuste de PISO TÉRMICO (módulos opcionales #288, determinista,
 * PRE-LLM — cierra el driver #1 de contaminación cross-domain, sonda
 * `cross_thermal` de `bench-contaminacion.mjs`, ~86.7% de contaminación
 * medida 2026-07). Llama `POST ${BASE}/piso-termico-guard` con
 * `{ user_message, finca_altitud?, piso_termico? }` para que el sidecar
 * detecte el piso térmico del usuario (finca georreferenciada > piso
 * explícito del perfil > frase en texto libre, ej. "tengo finca en piso
 * térmico cálido") y, si la especie mencionada resulta marginal/inviable a
 * esa altitud (motor de viabilidad de `/resolve-entities`, mismo grafo AGE),
 * devuelva un `system_prompt_block` de SUPRESIÓN-Y-REEMPLAZO: el LLM debe
 * advertir el desajuste PRIMERO y ofrecer solo alternativas reales del
 * catálogo, nunca inventadas.
 *
 * Espejo exacto de `fermentoPrefilter`/`biopreparadoGrounding`: FAIL-SAFE,
 * no-throw. Devuelve null si: flag off, offline, timeout, non-2xx, body
 * inválido → el caller degrada con gracia (no inyecta bloque, no rompe el
 * turno). Cuando `has_mismatch` es false, NO hay que inyectar nada.
 *
 * @param {string} userMessage — texto del operador.
 * @param {object} [opts]
 * @param {number|string|null} [opts.fincaAltitud] - msnm de la finca activa (prioridad 1).
 * @param {string|null} [opts.pisoTermico] - piso térmico explícito del perfil (prioridad 2).
 * @returns {Promise<null | {
 *   has_mismatch: boolean,
 *   user_piso_termico: string | null,
 *   user_piso_origen: string | null,
 *   species_id: string | null,
 *   species_nombre_comun: string | null,
 *   species_altitud_min: number | null,
 *   species_altitud_max: number | null,
 *   viabilidad: string | null,
 *   alternativas: string[],
 *   system_prompt_block: string,
 *   reason: string,
 * }>}
 */
export async function pisoTermicoGuard(userMessage, opts = {}) {
  if (!userMessage || typeof userMessage !== 'string') return null;
  const body = { user_message: userMessage };
  const alt = opts && opts.fincaAltitud != null ? Number(opts.fincaAltitud) : NaN;
  if (Number.isFinite(alt)) body.finca_altitud = alt;
  if (opts && typeof opts.pisoTermico === 'string' && opts.pisoTermico.trim()) {
    body.piso_termico = opts.pisoTermico.trim();
  }
  const raw = await postJson('/piso-termico-guard', body, NLU_TIMEOUT_MS);
  if (!raw || typeof raw !== 'object') return null;
  return {
    has_mismatch: raw.has_mismatch === true,
    user_piso_termico: typeof raw.user_piso_termico === 'string' ? raw.user_piso_termico : null,
    user_piso_origen: typeof raw.user_piso_origen === 'string' ? raw.user_piso_origen : null,
    species_id: typeof raw.species_id === 'string' ? raw.species_id : null,
    species_nombre_comun: typeof raw.species_nombre_comun === 'string' ? raw.species_nombre_comun : null,
    species_altitud_min: typeof raw.species_altitud_min === 'number' ? raw.species_altitud_min : null,
    species_altitud_max: typeof raw.species_altitud_max === 'number' ? raw.species_altitud_max : null,
    viabilidad: typeof raw.viabilidad === 'string' ? raw.viabilidad : null,
    alternativas: Array.isArray(raw.alternativas) ? raw.alternativas.filter((a) => typeof a === 'string') : [],
    system_prompt_block: typeof raw.system_prompt_block === 'string' ? raw.system_prompt_block : '',
    reason: typeof raw.reason === 'string' ? raw.reason : '',
  };
}

/**
 * PISO DE SEGURIDAD ANTE VENENOS query-side (módulos opcionales P0 #2, determinista,
 * PRE-LLM). Llama `POST ${BASE}/toxic-safety-guard` con `{ user_message }`: si
 * la CONSULTA del usuario menciona un plaguicida tóxico/prohibido (clorpirifos,
 * glifosato, paraquat, lorsban…), el sidecar devuelve un `system_prompt_block`
 * de advertencia + alternativas MIP para inyectar al system prompt,
 * INDEPENDIENTE del RAG. Cierra el hueco de la abstención (`low_relevance`),
 * donde el guard de SALIDA `detectPoisonEndorsement` no ve nada porque el
 * modelo respondió "no tengo información" sin repetir el nombre del veneno.
 * FAIL-SAFE: null ante error/timeout → no-op, el turno sigue sin romperse.
 *
 * @param {string} userMessage
 * @returns {Promise<null | {
 *   has_toxic_mention: boolean,
 *   toxics: string[],
 *   system_prompt_block: string,
 *   reason: string,
 * }>}
 */
export async function toxicSafetyGuard(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return null;
  const raw = await postJson('/toxic-safety-guard', { user_message: userMessage }, NLU_TIMEOUT_MS);
  if (!raw || typeof raw !== 'object') return null;
  return {
    has_toxic_mention: raw.has_toxic_mention === true,
    toxics: Array.isArray(raw.toxics) ? raw.toxics.filter((t) => typeof t === 'string') : [],
    system_prompt_block: typeof raw.system_prompt_block === 'string' ? raw.system_prompt_block : '',
    reason: typeof raw.reason === 'string' ? raw.reason : '',
  };
}

/**
 * GUARDA de CONFUSIÓN DE ESPECIE / familia botánica equivocada (módulos opcionales
 * #292, determinista, PRE-LLM — segundo driver de contaminación
 * cross-domain, sonda `confusion_especie` de `bench-contaminacion.mjs`,
 * ~20% medida 2026-07, el driver siguiente tras `cross_thermal` que
 * `/piso-termico-guard` bajó de 86.7% a 6.7%). Llama `POST
 * ${BASE}/confusion-especie-guard` con `{ user_message }` para que el
 * sidecar detecte si el mensaje menciona una especie del catálogo con (a)
 * advertencia `_anti_confusion` curada, o (b) otra especie de nombre
 * parecido pero familia botánica DISTINTA (riesgo algorítmico) y, si aplica,
 * devuelva un `system_prompt_block` de SUPRESIÓN-Y-REEMPLAZO: el LLM debe
 * citar la familia REAL primero y no mezclar datos de la especie parecida.
 *
 * Espejo exacto de `pisoTermicoGuard`/`biopreparadoGrounding`: FAIL-SAFE,
 * no-throw. Devuelve null si: flag off, offline, timeout, non-2xx, body
 * inválido → el caller degrada con gracia (no inyecta bloque, no rompe el
 * turno). Cuando `has_confusion` es false, NO hay que inyectar nada.
 *
 * @param {string} userMessage — texto del operador.
 * @returns {Promise<null | {
 *   has_confusion: boolean,
 *   species_mentioned: string | null,
 *   species_id: string | null,
 *   species_nombre_cientifico: string | null,
 *   species_familia_botanica: string | null,
 *   confusion_source: string | null,
 *   lookalike_nombre_comun: string | null,
 *   lookalike_nombre_cientifico: string | null,
 *   lookalike_familia_botanica: string | null,
 *   system_prompt_block: string,
 *   reason: string,
 * }>}
 */
export async function confusionEspecieGuard(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return null;
  const raw = await postJson('/confusion-especie-guard', { user_message: userMessage }, NLU_TIMEOUT_MS);
  if (!raw || typeof raw !== 'object') return null;
  return {
    has_confusion: raw.has_confusion === true,
    species_mentioned: typeof raw.species_mentioned === 'string' ? raw.species_mentioned : null,
    species_id: typeof raw.species_id === 'string' ? raw.species_id : null,
    species_nombre_cientifico: typeof raw.species_nombre_cientifico === 'string' ? raw.species_nombre_cientifico : null,
    species_familia_botanica: typeof raw.species_familia_botanica === 'string' ? raw.species_familia_botanica : null,
    confusion_source: typeof raw.confusion_source === 'string' ? raw.confusion_source : null,
    lookalike_nombre_comun: typeof raw.lookalike_nombre_comun === 'string' ? raw.lookalike_nombre_comun : null,
    lookalike_nombre_cientifico: typeof raw.lookalike_nombre_cientifico === 'string' ? raw.lookalike_nombre_cientifico : null,
    lookalike_familia_botanica: typeof raw.lookalike_familia_botanica === 'string' ? raw.lookalike_familia_botanica : null,
    system_prompt_block: typeof raw.system_prompt_block === 'string' ? raw.system_prompt_block : '',
    reason: typeof raw.reason === 'string' ? raw.reason : '',
  };
}

/**
 * GUARDA de confusión PLAGA VS ENFERMEDAD (módulos opcionales #293, determinista,
 * PRE-LLM — tercer driver de contaminación cross-domain, sonda
 * `pest_vs_disease` de `bench-contaminacion.mjs`). Llama `POST
 * ${BASE}/pest-vs-disease-guard` con `{ user_message }` para que el sidecar
 * detecte si el mensaje menciona un término de `plagas_criticas`/
 * `enfermedades_criticas` del catálogo Y la categoría del catálogo NO es
 * contradicha por la heurística léxica/taxonómica; si `has_classification`,
 * devuelve un `system_prompt_block` de SUPRESIÓN-Y-REEMPLAZO: el LLM debe
 * afirmar la categoría REAL primero y recomendar el TIPO de manejo correcto
 * (nunca fungicida para un insecto ni insecticida para un hongo/bacteria).
 *
 * Espejo exacto de `confusionEspecieGuard`/`pisoTermicoGuard`: FAIL-SAFE,
 * no-throw. Devuelve null si: flag off, offline, timeout, non-2xx, body
 * inválido → el caller degrada con gracia. Cuando `has_classification` es
 * false (incluye el caso de desacuerdo catálogo↔heurística, fail-safe a
 * propósito), NO hay que inyectar nada.
 *
 * @param {string} userMessage — texto del operador.
 * @returns {Promise<null | {
 *   has_classification: boolean,
 *   term_mentioned: string | null,
 *   term_categoria: string | null,
 *   species_id: string | null,
 *   species_nombre_comun: string | null,
 *   heuristica_categoria: string | null,
 *   source: string | null,
 *   manejo_equivocado_detectado: boolean,
 *   system_prompt_block: string,
 *   reason: string,
 * }>}
 */
export async function pestVsDiseaseGuard(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return null;
  const raw = await postJson('/pest-vs-disease-guard', { user_message: userMessage }, NLU_TIMEOUT_MS);
  if (!raw || typeof raw !== 'object') return null;
  return {
    has_classification: raw.has_classification === true,
    term_mentioned: typeof raw.term_mentioned === 'string' ? raw.term_mentioned : null,
    term_categoria: typeof raw.term_categoria === 'string' ? raw.term_categoria : null,
    species_id: typeof raw.species_id === 'string' ? raw.species_id : null,
    species_nombre_comun: typeof raw.species_nombre_comun === 'string' ? raw.species_nombre_comun : null,
    heuristica_categoria: typeof raw.heuristica_categoria === 'string' ? raw.heuristica_categoria : null,
    source: typeof raw.source === 'string' ? raw.source : null,
    manejo_equivocado_detectado: raw.manejo_equivocado_detectado === true,
    system_prompt_block: typeof raw.system_prompt_block === 'string' ? raw.system_prompt_block : '',
    reason: typeof raw.reason === 'string' ? raw.reason : '',
  };
}

/**
 * POST-LLM companion species guard. Valida la respuesta ya generada del
 * agente contra el catalogo y devuelve un bloque de correccion listo para
 * anteponer. Es fail-safe: si el endpoint cae, el turno sigue igual.
 *
 * BUG-04 (2026-09-03): el endpoint real (`módulos-opcionales/modules/agro-mcp/
 * sidecar/src/server.ts`, `POST /companion-species-guard`) exige el campo
 * `agent_response` -- asi lo documenta su propio comentario ("Recibe
 * {agent_response, piso_termico?}"). El cliente mandaba `response_text`
 * (un intento previo de fix que corrigio el casing pero no el nombre del
 * campo), asi que el sidecar respondia 400 `{error:"agent_response
 * required"}` en CADA turno -- confirmado en vivo contra el sidecar real
 * (127.0.0.1:7880) el 2026-09-03. La salvaguarda de especies antagonistas
 * quedaba muerta en silencio (postJson degrada 400 a null, no rompe UI).
 * El shape de respuesta real tambien usa `has_fabricated_species` (NO
 * `has_companion_species`/`has_companion`/`needs_correction`, que nunca
 * existieron en el servidor) -- sin embargo el gate real en AgentScreen usa
 * `system_prompt_block` (ya bien parseado), asi que este segundo mismatch
 * solo rompia la telemetria `console.debug`, no el guard en si.
 *
 * @param {string} responseText - salida final del LLM ya generada.
 * @returns {Promise<null | {
 *   has_fabricated_species: boolean,
 *   species_mentioned: string|null,
 *   species_id: string|null,
 *   alternativas_reales: Array<string|object>,
 *   system_prompt_block: string,
 *   reason: string,
 * }>}
 */
export async function companionSpeciesGuard(responseText) {
  if (!responseText || typeof responseText !== 'string' || !responseText.trim()) return null;
  const raw = await postJson('/companion-species-guard', { agent_response: responseText }, TOOL_TIMEOUT_MS);
  if (!raw || typeof raw !== 'object') return null;
  return {
    has_fabricated_species: raw.has_fabricated_species === true,
    species_mentioned: typeof raw.species_mentioned === 'string' ? raw.species_mentioned : null,
    species_id: typeof raw.species_id === 'string' ? raw.species_id : null,
    alternativas_reales: Array.isArray(raw.alternativas_reales) ? raw.alternativas_reales : [],
    system_prompt_block: typeof raw.system_prompt_block === 'string' ? raw.system_prompt_block : '',
    reason: typeof raw.reason === 'string' ? raw.reason : '',
  };
}

/**
 * Capa 2 anti-alucinación (cross-check de contexto). Llama
 * `POST ${BASE}/post-validate` con el TEXTO que el LLM ya generó y, opcional,
 * los `nombre_cientifico` de las entidades que la capa 1 resolvió para el turno
 * (`expected`). El sidecar:
 *   - extrae los binomios Linneanos del texto,
 *   - los valida contra Apache AGE (los inexistentes → `hallucinated`),
 *   - y si pasás `expected`, marca como `suspect` los binomios que SÍ existen
 *     pero NO corresponden a la entidad que el usuario mencionó (caso "nombre
 *     correcto, especie equivocada": dice Solanum lycopersicum para 'tomate de
 *     árbol', que en realidad es Solanum betaceum).
 *
 * Se invoca DESPUÉS de `callLLM` (no antes — necesita la respuesta). NUNCA
 * bloquea: el PWA usa el resultado solo para un badge no intrusivo. Devuelve
 * null si flag off / offline / sidecar falla / timeout → el caller degrada a
 * "sin advertencia" (política conservadora: no advertir si no se pudo verificar).
 *
 * @param {string} text — respuesta del LLM ya generada.
 * @param {string[]} [expected] - nombre_cientifico de las entidades resueltas.
 * @returns {Promise<null | {hallucinated: string[], validated: Array<{scientific_name: string, canonical_id: string}>, suspect: string[], age_available: boolean, detected_count: number}>}
 */
export async function postValidate(text, expected) {
  if (!text || typeof text !== 'string') return null;
  const body = { text };
  if (Array.isArray(expected) && expected.length > 0) {
    const clean = expected.filter((e) => typeof e === 'string' && e.trim().length > 0);
    if (clean.length > 0) body.expected = clean;
  }
  const raw = await postJson('/post-validate', body, NLU_TIMEOUT_MS);
  if (!raw || typeof raw !== 'object') return null;
  return {
    hallucinated: Array.isArray(raw.hallucinated) ? raw.hallucinated : [],
    validated: Array.isArray(raw.validated) ? raw.validated : [],
    suspect: Array.isArray(raw.suspect) ? raw.suspect : [],
    age_available: raw.age_available === true,
    detected_count: typeof raw.detected_count === 'number' ? raw.detected_count : 0,
  };
}

/**
 * Resultado de error de tool MCP.
 * @typedef {object} ToolError
 * @property {true}       _error   — discrimina de resultados exitosos
 * @property {string}     reason   — 'not_allowed' | 'timeout' | 'http_error' | 'network_error'
 * @property {string}     tool     — nombre del tool que falló
 */

/**
 * Llama `POST ${BASE}/tools/<toolName>` con los args dados.
 *
 * El contrato de retorno es tri-estado:
 *   - object (sin _error) → datos reales del sidecar.
 *   - ToolError → tool fue intentado pero falló (timeout, HTTP error, not allowed).
 *   - null → tool NO fue intentado (flag off, offline).
 *
 * @param {string} toolName — uno de ALLOWED_TOOLS
 * @param {object} args — body raw (forma específica por tool)
 * @param {{farmAltitude?: number|null}} [options] Altitud resuelta una vez por quien arma el turno.
 * @returns {Promise<null | object | ToolError>}
 */
/**
 * Coerción defensiva de argumentos numéricos. El sidecar (Zod) espera `number`
 * en argumentos como `altitud_msnm`; el chat LLM a veces los genera como string
 * → el sidecar respondía 502 (invalid_type) y el usuario de prueba recibía respuesta vacía.
 * Coercionamos en el chokepoint para que TODO caller (chat LLM, chips, plan
 * determinístico) sea robusto. Fix P0 — test integral 2026-06-13.
 */
const NUMERIC_TOOL_ARGS = new Set(['altitud_msnm', 'altitud', 'altura']);
const TOOLS_REQUIRING_FARM_ALTITUDE = new Set(['get_cultivos_viables', 'get_diseno_finca']);

export const ALTITUD_REQUERIDA_STUB = Object.freeze({
  available: false,
  reason: 'altitud_requerida',
  hint: 'Pregunte al usuario a qué altitud, en metros sobre el nivel del mar, está su finca antes de responder esta consulta.',
});

function parseToolAltitude(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const altitude = Number(value);
  return Number.isFinite(altitude) && altitude >= 0 ? altitude : null;
}

async function readAgentFarmAltitudeFromAppState() {
  try {
    const [{ default: useFincaActiveStore }, { getProfile }] = await Promise.all([
      import('./fincaActiveStore.js'),
      import('./userProfileService.js'),
    ]);
    const state = useFincaActiveStore.getState();
    const fincas = Array.isArray(state?.fincas) ? state.fincas : [];
    const activeFinca = fincas.find((finca) => finca?.slug === state?.activeFincaSlug) || null;
    return resolveAgentFarmAltitude(activeFinca, getProfile());
  } catch (_) {
    return null;
  }
}

async function completeFarmAltitude(toolName, args, options = {}) {
  if (!TOOLS_REQUIRING_FARM_ALTITUDE.has(toolName)) return { args, missing: false };

  if (Object.prototype.hasOwnProperty.call(options, 'farmAltitude')) {
    const farmAltitude = parseToolAltitude(options.farmAltitude);
    return farmAltitude === null
      ? { args, missing: true }
      : { args: { ...args, altitud: farmAltitude }, missing: false };
  }

  const suppliedAltitude = parseToolAltitude(args?.altitud);
  if (suppliedAltitude !== null) {
    return { args: { ...args, altitud: suppliedAltitude }, missing: false };
  }

  const fincaAltitude = await readAgentFarmAltitudeFromAppState();

  return fincaAltitude === null
    ? { args, missing: true }
    : { args: { ...args, altitud: fincaAltitude }, missing: false };
}

export function coerceNumericArgs(args) {
  if (!args || typeof args !== 'object') return args;
  let changed = false;
  const out = { ...args };
  for (const k of NUMERIC_TOOL_ARGS) {
    if (typeof out[k] === 'string' && out[k].trim() !== '') {
      // Spanish thousands separators are not decimal metres.
      const raw = out[k].trim();
      const grouped = /^\d{1,3}(?:[.,\s]\d{3})+$/.test(raw);
      const n = Number(grouped ? raw.replace(/[.,\s]/g, '') : raw);
      if (Number.isFinite(n)) out[k] = n; else delete out[k];
      changed = true;
    }
  }
  return changed ? out : args;
}

/**
 * BUG-03 (2026-09-03) — coercion defensiva de `piso_termico`. Los enums Zod
 * del sidecar exigen el vocabulario canonico SIN tildes ('frio'/'templado'/
 * 'calido'[/'paramo'] segun el tool) -- el propio schema de
 * `get_calendario_siembra` lo documenta: "Sin tildes a proposito... el
 * agente deberia mapear 'frío'->'frio' antes de invocar este tool". Nadie
 * hacia ese mapeo: `pisoTermicoFromAltitud()` (agentService.js) devuelve el
 * piso CON tildes para lectura humana ('frío','cálido','páramo'), y el NLU
 * planner (LLM server-side) tiende a lo mismo por ortografia natural.
 *
 * Repro real BUG-03: "...a 2200 msnm" -> pisoTermicoFromAltitud() = 'frío'
 * -> get_calendario_siembra rechaza con Zod invalid_enum_value -> el
 * dispatcher generico del sidecar (`/tools/:name`, mismo catch de
 * NUMERIC_TOOL_ARGS/P0 2026-06-13) lo envuelve como 502. Confirmado en vivo
 * contra el sidecar real (127.0.0.1:7880, 2026-09-03): 'frío' -> 502
 * mcp_call_failed / invalid_enum_value; 'frio' -> 200 con datos reales.
 *
 * Mismo chokepoint que `coerceNumericArgs` para que CUALQUIER caller (chat
 * LLM, chips deterministicos, plan NLU) sea robusto. Solo quita tildes/
 * espacios/mayusculas -- un piso_termico genuinamente invalido (ej.
 * 'montaña') sigue sin matchear el enum y el sidecar lo sigue rechazando,
 * como corresponde.
 */
export function normalizePisoTermicoArg(args) {
  if (!args || typeof args !== 'object' || typeof args.piso_termico !== 'string') return args;
  const normalized = args.piso_termico
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (normalized === args.piso_termico) return args;
  return { ...args, piso_termico: normalized };
}

/**
 * El planner NLU es un límite no confiable: sus argumentos son inferencias,
 * no una garantía de que tenga el dato. En el contrato de
 * `get_calendario_siembra` el único campo que este saneo puede omitir es
 * `mes` (OPCIONAL en el schema zod, 1..12; el sidecar usa el mes actual si
 * no viaja) y el string vacío es un valor inválido para él, así que lo
 * quitamos.
 *
 * `piso_termico` NO se toca aquí: es el campo EXIGIDO del schema (enum
 * frio|templado|calido, sin tildes). Borrarlo cuando viene vacío no arregla
 * el 502 — el schema lo reclama igual (invalid_type, received "undefined")
 * y se cambia un 502 por otro 502 (BUG-03a, 2026-09-05). Cuando falta o
 * viene vacío, la decisión la toma `callTool`: NO llama al tool y devuelve
 * el stub `no_piso_termico` (evidencia sintética que obliga al LLM a PEDIR
 * la altura/municipio en vez de inventar fechas de siembra). Mismo contrato
 * que clima sin municipio / silvopastoreo sin altura en chipIntentRouter.
 */
export function omitEmptyCalendarioArgs(toolName, args) {
  if (toolName !== 'get_calendario_siembra' || !args || typeof args !== 'object') return args;
  if (typeof args.mes !== 'string' || args.mes.trim() !== '') return args;
  const rest = { ...args };
  delete rest.mes;
  return rest;
}

/**
 * BUG-03a (2026-09-05) — ¿el caller de `get_calendario_siembra` vino SIN el
 * `piso_termico` que el schema zod exige? (ausente, string vacío o solo
 * espacios). Confirmado en vivo contra el sidecar real (127.0.0.1:7880):
 * `{"mes":"","piso_termico":""}`, `{}` y `{"piso_termico":""}` responden
 * todos 502 (invalid_enum_value / invalid_type). El piso lo derivan el
 * perfil/finca o el planner NLU; cuando no pudieron, el tool NO se llama.
 *
 * Evidence sintética (mismo shape que los stubs de chipIntentRouter para
 * clima sin municipio y silvopastoreo sin altura): `available:false` +
 * reason + hint, que formatToolEvidence inyecta al LLM para que PIDA la
 * altura o el municipio y NO invente un calendario.
 */
export const CALENDARIO_SIN_PISO_STUB = Object.freeze({
  available: false,
  reason: 'no_piso_termico',
  hint:
    'pedirle al usuario su municipio o la altura de su finca (msnm) para saber el piso térmico (frío/templado/cálido) y poder sugerir qué sembrar este mes',
});

/**
 * Verdadero cuando falta o viene vacío `piso_termico` (el campo EXIGIDO del
 * schema de `get_calendario_siembra`). Valores no-string también cuentan
 * como "no determinable": el enum zod espera 'frio'|'templado'|'calido' y
 * cualquier otra cosa es un 502 garantizado.
 * @param {object|null|undefined} args
 * @returns {boolean}
 */
export function calendarioSinPisoTermico(args) {
  if (!args || typeof args !== 'object') return true;
  return typeof args.piso_termico !== 'string' || args.piso_termico.trim() === '';
}

/**
 * Piloto multifinca, bug 12 (2026-10-31): el planner NLU elige `piso_termico` por su cuenta y a
 * 2.532 msnm mandó «templado», mientras «El tiempo» de la misma finca decía
 * piso frío. Con la altitud ya resuelta, el piso de `get_cultivos_viables` se
 * deriva de ella con `pisoDeFinca`, la misma tabla del resto de la app; el
 * valor del planner se descarta. Solo se corrige el piso que el planner mandó:
 * no se añade uno nuevo, porque el filtro exige la arista GROWS_IN del grafo
 * y quitaría especies que hoy salen por rango de altitud. Sin altitud válida
 * no se inventa piso.
 *
 * @param {string} toolName
 * @param {object|null} args
 * @returns {object|null}
 */
export function pisoTermicoFromToolAltitude(toolName, args) {
  if (toolName !== 'get_cultivos_viables' || !args || typeof args !== 'object') return args;
  if (!('piso_termico' in args)) return args;
  const altitud = parseToolAltitude(args.altitud);
  const piso = altitud !== null && altitud > 0 ? pisoDeFinca(altitud) : null;
  if (!piso || args.piso_termico === piso) return args;
  return { ...args, piso_termico: piso };
}

export async function callTool(toolName, args, options = {}) {
  if (!toolName || typeof toolName !== 'string') return null;
  if (!ALLOWED_TOOLS.has(toolName)) {
    console.debug('[sidecar] tool no permitido', toolName);
    return { _error: true, reason: 'not_allowed', tool: toolName };
  }
  // Bug reportado 2026-10-29: un planner/modelo que no conoce los ids reales
  // de las fincas del usuario puede pedir un marcador de plantilla
  // (`<FINCA_ID_1>`) o el id de otra cuenta. Ninguno de los dos cruza el
  // límite HTTP: se sustituye por la finca activa propia, o se bloquea. Una
  // cuenta sin fincas propias (modo legado, #4331 r2) no tiene lista contra
  // la que validar: resolveOwnedFincaId devuelve el id tal cual (o
  // `undefined` si no vino ninguno) y es el sidecar quien decide; solo
  // `null` (marcador de plantilla u otro valor inválido) bloquea la llamada.
  if (FINCA_TOOLS.has(toolName)) {
    const fincaId = resolveOwnedFincaId(args?.finca_id);
    if (fincaId === null) {
      console.debug('[sidecar] finca_id no es de una finca propia de la cuenta', { tool: toolName });
      return { _error: true, reason: 'finca_id_invalido', tool: toolName };
    }
    args = { ...(args || {}), finca_id: fincaId };
  }
  if (toolName === 'add_planta_finca') {
    if (!isSidecarEnabled() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return null;
    const operation = confirmPlantOperation(args);
    if (!operation) return { _error: true, reason: 'confirmation_required', tool: toolName };
    args = operation;
  }
  const altitudeResult = await completeFarmAltitude(toolName, args || {}, options);
  if (altitudeResult.missing) return ALTITUD_REQUERIDA_STUB;
  const normalizedArgs = pisoTermicoFromToolAltitude(toolName, normalizePlannerToolArgs(
    toolName,
    coerceNumericArgs(fincaReadArgs(toolName, altitudeResult.args)),
  ));
  if (toolName === 'get_calendario_siembra' && calendarioSinPisoTermico(normalizedArgs)) {
    // Sin piso térmico NO llamamos el tool (el zod lo exige): evidence
    // sintética que obliga al LLM a PEDIR la altura/municipio (NO inventar
    // fechas). Mismo contrato que chipIntentRouter (calendario sin piso) y
    // que clima sin municipio / silvopastoreo sin altura.
    return CALENDARIO_SIN_PISO_STUB;
  }
  const sanitizedArgs = omitEmptyCalendarioArgs(toolName, normalizedArgs);
  const timeoutMs = TOOL_TIMEOUTS_MS[toolName] || TOOL_TIMEOUT_MS;
  const result = await postJson(`/tools/${toolName}`, sanitizedArgs, timeoutMs, { tool: toolName });
  if (result !== null) return result;
  // postJson retornó null. Distinguir: tool fue intentado pero falló
  // (timeout / HTTP error / network) vs. ni siquiera se intentó (flag off / offline).
  const attempted =
    isSidecarEnabled() &&
    !(typeof navigator !== 'undefined' && navigator.onLine === false);
  if (attempted) {
    return { _error: true, reason: 'network_error', tool: toolName };
  }
  return null;
}

/**
 * V-08 (#229) — LLM-as-judge anti-alucinación de visión. Pregunta al modelo
 * multimodal si la FOTO realmente muestra `speciesId` (complementa a
 * `validate_visual_match`, que solo verifica que el NOMBRE exista en catálogo).
 * El presupuesto síncrono del sidecar es 45 s; el cliente concede 50 s. Si no puede juzgar
 * devuelve `{plausible: null, ...}`.
 *
 * @param {string} speciesId — id snake_case canónico del catálogo.
 * @param {string} imageB64 — base64 crudo de la foto (sin prefijo data:).
 * @returns {Promise<null | {plausible: boolean|null, confidence: number|null, motivo: string}>}
 *   null si flag off / offline / sin args / sidecar falla.
 */
export async function judgeVision(speciesId, imageB64) {
  if (!speciesId || typeof speciesId !== 'string') return null;
  if (!imageB64 || typeof imageB64 !== 'string') return null;
  const raw = await postJson(
    '/judge-vision',
    { species_id: speciesId, image_b64: imageB64 },
    50000,
  );
  if (!raw || typeof raw !== 'object') return null;
  return {
    plausible: typeof raw.plausible === 'boolean' ? raw.plausible : null,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : null,
    motivo: typeof raw.motivo === 'string' ? raw.motivo : '',
  };
}

/**
 * El POST asíncrono solo encola, por eso conserva el transporte de 5 s.
 * El seguimiento concede 370 s al presupuesto de inferencia de 360 s.
 * Una cola congestionada puede superar ese límite y la UI informa el plazo.
 *
 * @param {string} speciesId @param {string} imageB64
 * @returns {Promise<null | {request_id: string}>}
 */
export async function judgeVisionAsync(speciesId, imageB64) {
  if (!speciesId || typeof speciesId !== 'string') return null;
  if (!imageB64 || typeof imageB64 !== 'string') return null;
  const raw = await postJson(
    '/judge-vision-async',
    { species_id: speciesId, image_b64: imageB64 },
    TOOL_TIMEOUT_MS,
  );
  if (!raw || typeof raw !== 'object' || typeof raw.request_id !== 'string') {
    return null;
  }
  return { request_id: raw.request_id };
}

/**
 * Recoge el veredicto async por `request_id` (poll del gate #328). El sidecar
 * devuelve `{status:'pending'}` mientras el juez CPU no termina, `{status:'done',
 * plausible, confidence, motivo}` cuando resuelve, o `{status:'error', reason}`.
 * Pasa el body crudo del sidecar tal cual (el consumidor decide por `status`).
 *
 * @param {string} requestId
 * @param {{signal?: AbortSignal}} options
 * @returns {Promise<null | {status:'done', plausible:boolean|null, confidence:number|null, motivo:string} | {status:'pending'} | {status:'error', reason?:string}>}
 */
export async function judgeVisionResult(requestId, { signal } = {}) {
  if (!requestId || typeof requestId !== 'string') return null;
  const raw = await getJson(
    '/judge-vision-result',
    { request_id: requestId },
    TOOL_TIMEOUT_MS,
    signal,
  );
  if (!raw || typeof raw !== 'object') return null;
  return raw;
}

/**
 * Wrapper defensivo de `get_normativa_ica`. Validá la action localmente
 * para que el frontend NO pueda pedir paths arbitrarios al sidecar.
 *
 * USO DEFENSIVO ÚNICAMENTE: este tool sirve para validar si un producto
 * agroquímico está registrado/restringido por el ICA. NUNCA debe usarse
 * para responder "¿qué le pongo a la plaga X?" — para eso primero
 * `get_biopreparados` + `get_pest_controllers` (agroecológico). El system
 * prompt del agente debe explicitar esta restricción.
 *
 * @param {string} action — uno de NORMATIVA_ICA_ACTIONS
 * @param {object} [args] - body adicional pasado al tool
 * @returns {Promise<null | object>}
 */
export async function getNormativaIca(action, args) {
  if (!action || typeof action !== 'string' || !NORMATIVA_ICA_ACTIONS.has(action)) {
    console.debug('[sidecar] get_normativa_ica action inválida', action);
    return null;
  }
  return callTool('get_normativa_ica', { action, ...(args || {}) });
}

/**
 * Wrapper de `get_clima_ideam`. Estaciones IDEAM nacional para grounding
 * climático histórico. El sidecar devuelve null si IDEAM no responde
 * (graceful degrade — caller debe seguir sin clima inyectado).
 *
 * @param {string} action — uno de CLIMA_IDEAM_ACTIONS
 * @param {object} [args] - body adicional (municipio, metric, desde, etc.)
 * @returns {Promise<null | object>}
 */
export async function getClimaIdeam(action, args) {
  if (!action || typeof action !== 'string' || !CLIMA_IDEAM_ACTIONS.has(action)) {
    console.debug('[sidecar] get_clima_ideam action inválida', action);
    return null;
  }
  return callTool('get_clima_ideam', { action, ...(args || {}) });
}

/**
 * Wrapper de `get_precio_sipsa`. Precios mayoristas SIPSA — el tool lee la
 * tabla `chagra.sipsa_precios` que llena el feed DIARIO en vivo del servicio
 * REST oficial DANE (pipeline #19, `dane-live`), así que para los staples
 * comunes (papa, tomate, cebolla, yuca, plátano, zanahoria, aguacate, maíz)
 * devuelve un PRECIO PUNTUAL real: {price{precio_promedio_cop_kg, plaza,
 * fecha, min/max}, central_abastos, frescura, especie}. Si un producto no está
 * en la tabla ni en Socrata, devuelve {available:false} (honesto, no inventa)
 * y el agente orienta al ZIP DANE / Corabastos.
 *
 * @param {string} action — uno de PRECIO_SIPSA_ACTIONS
 * @param {object} [args] - body adicional (producto, fecha, etc.)
 * @returns {Promise<null | object>}
 */
export async function getPrecioSipsa(action, args) {
  if (!action || typeof action !== 'string' || !PRECIO_SIPSA_ACTIONS.has(action)) {
    console.debug('[sidecar] get_precio_sipsa action inválida', action);
    return null;
  }
  return callTool('get_precio_sipsa', { action, ...(args || {}) });
}

/**
 * GET `${BASE}/clima/snapshot` con lat/lng (+ elevation opcional) (#316).
 *
 * Devuelve el snapshot completo: ENSO + 7d forecast + alertas. Si no se pasan
 * coords, el sidecar responde solo el bloque ENSO (NOAA + IDEAM + CIIFEN) y
 * deja `openmeteo: null` + `alertas_locales: []`.
 *
 * `elevation` (msnm reales de la finca): Open-Meteo corrige la temperatura por
 * gradiente térmico (lapse rate ~6.5 °C/1000 m) usando la elevación que se le
 * pase. Si NO se pasa, Open-Meteo usa la elevación de SU grilla, que para un
 * municipio andino cae cerca de la CABECERA (valle/casco urbano), no de la
 * finca en ladera alta — y el pronóstico sale varios grados más cálido de lo
 * real (p. ej. finca a 2580 msnm vs cabecera ~1900 msnm: ~4–5 °C de
 * diferencia). Pasar la altitud real corrige eso. El sidecar reenvía este
 * parámetro a Open-Meteo (`?elevation=`).
 *
 * Reglas: flag off → null. Offline → null. HTTP ≥400 → null. Nunca throw.
 *
 * @param {{ lat?: number, lng?: number, elevation?: number }} [opts]
 * @returns {Promise<null | object>}
 */
export async function getClimaSnapshot(opts = {}) {
  const query = {};
  if (typeof opts.lat === 'number' && Number.isFinite(opts.lat)) query.lat = opts.lat;
  if (typeof opts.lng === 'number' && Number.isFinite(opts.lng)) query.lng = opts.lng;
  // elevation: solo si es número finito y físicamente plausible (msnm). El
  // techo de 6000 m cubre el pico más alto de Colombia (Cristóbal Colón,
  // 5775 m) con margen y descarta basura tipo pies, sensores locos o NaN.
  if (typeof opts.elevation === 'number' && Number.isFinite(opts.elevation)
      && opts.elevation >= -100 && opts.elevation <= 6000) {
    query.elevation = opts.elevation;
  }
  return getJson('/clima/snapshot', query, TOOL_TIMEOUT_MS);
}

/**
 * POST `${BASE}/tools/get_enso_status` — narrow shape ENSO-only (#316).
 *
 * Útil cuando el agente solo necesita el bloque ENSO sin pronóstico local.
 * El sidecar ya lo expone como tool al planner, así que esto es un atajo
 * para wireos directos desde el frontend (ej. badge del bell).
 *
 * @returns {Promise<null | object>}
 */
export async function getEnsoStatus() {
  return callTool('get_enso_status', {});
}

/**
 * POST `${BASE}/tools/get_alertas_clima_zona` — alertas + forecast local (#316).
 *
 * @param {{ lat: number, lng: number }} args
 * @returns {Promise<null | object>}
 */
export async function getAlertasClimaZona(args) {
  if (!args || typeof args.lat !== 'number' || typeof args.lng !== 'number') {
    console.debug('[sidecar] get_alertas_clima_zona lat/lng requeridos');
    return null;
  }
  return callTool('get_alertas_clima_zona', { lat: args.lat, lng: args.lng });
}

// Export interno para testabilidad — los tests pueden assertear el set
// sin tener que reflectar la closure.
export const __TEST__ = {
  ALLOWED_TOOLS,
  TOOL_TIMEOUTS_MS,
  NORMATIVA_ICA_ACTIONS,
  CLIMA_IDEAM_ACTIONS,
  PRECIO_SIPSA_ACTIONS,
  getBaseUrl,
};
