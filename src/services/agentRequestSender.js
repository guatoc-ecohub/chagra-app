/**
 * agentRequestSender.js — Sender headless para la cola DURABLE del agente.
 *
 * `agentRequestQueue.drainPending({ sender })` y `processRequest({ sender })`
 * delegan en una función `sender(req)` que corre la inferencia real y devuelve
 * la telemetría a persistir. En el flujo VIVO del AgentScreen ese trabajo lo
 * hace el pipeline React (que pinta tokens, TTS, grounding, etc.). Pero un
 * request que sobrevivió una RECARGA o quedó 'offline' de una sesión anterior
 * NO tiene React montado alrededor: hay que reanudarlo SIN UI.
 *
 * Este módulo provee ese sender headless. La llamada cruda al LLM se inyecta
 * (`llmCall`) → testeable sin red. En producción usa `streamOpenAI` sobre el
 * endpoint que arma `buildLLMRequest('chat'|'chat_complex')`.
 *
 * Contrato de retorno (lo que `processRequest` persiste en el registro):
 *   {
 *     response: string,
 *     latency: { t_first_token_ms: number|null },
 *     grounding: { nlu_route, grounded_status, entities, tools, rag_chunks },
 *     tokens_in: number|null,
 *     tokens_out: number|null,
 *   }
 *
 * Reglas:
 * - Si el LLM falla o devuelve texto vacío → LANZA (para que el retry/backoff
 *   de processRequest lo reintente; tras MAX_RETRIES queda 'failed' sin perder
 *   el prompt). NUNCA se traga el error en silencio.
 * - Headless = grounding mínimo (nlu_route del route, grounded_status 'none'):
 *   la reanudación prioriza NO PERDER la pregunta sobre re-resolver el grafo.
 *   El turno vivo sí captura grounding rico; esto es el camino de rescate.
 */

import { selectChatRoute, buildLLMRequest } from './llmRouter.js';
import useFincaActiveStore from './fincaActiveStore.js';
import { getProfile } from './userProfileService.js';
import { buildAgentFarmAltitudeContext } from './agentFarmAltitude.js';
import { resolveAgentScenario } from './agentScenario.js';

/**
 * Estimación de respaldo de tokens cuando el backend no reporta `usage`.
 * ~4 chars/token es la heurística estándar; suficiente para los agregados de
 * debug (no es facturación). Devuelve 0 para entradas vacías.
 */
function estimateTokens(text) {
  const s = typeof text === 'string' ? text : '';
  if (!s) return 0;
  return Math.max(1, Math.round(s.length / 4));
}

/**
 * System prompt mínimo para la reanudación headless. El prompt rico (glosarios,
 * grounding, finca) vive en el pipeline vivo; aquí solo garantizamos una
 * respuesta útil en español campesino sin inventar.
 */
const HEADLESS_SYSTEM_PROMPT =
  'Eres Chagra, el asistente agrícola del campesino colombiano. Responde claro, ' +
  'corto y en español sencillo. Si no sabes algo con certeza, dilo; nunca ' +
  'inventes datos, dosis ni nombres científicos.';

function latestUserTurn(prompt) {
  const turns = [...prompt.matchAll(/(?:^|\n)Usuario:\s*([\s\S]*?)(?=\n(?:Usuario|Asistente):|$)/g)];
  return turns.length ? turns[turns.length - 1][1].trim() : prompt;
}

/**
 * Arma los mensajes (system + user) para el sender headless a partir del req.
 * @param {{prompt: string}} req
 * @returns {Array<{role: string, content: string}>}
 */
export function buildSenderMessages(req) {
  const prompt = (req && typeof req.prompt === 'string') ? req.prompt : '';
  let farmAltitudeContext = '';
  try {
    const state = useFincaActiveStore.getState();
    const finca = Array.isArray(state?.fincas)
      ? state.fincas.find((item) => item?.slug === state.activeFincaSlug) || null
      : null;
    const profile = getProfile();
    const scenario = resolveAgentScenario(latestUserTurn(prompt), profile, finca);
    if (!scenario.isolateLocation || scenario.useKnownFarmAltitudeForThermalFloor) {
      farmAltitudeContext = buildAgentFarmAltitudeContext(finca, profile);
    }
  } catch (_) {
    // La recuperación debe poder responder si el almacenamiento local no está disponible.
  }
  return [
    { role: 'system', content: [HEADLESS_SYSTEM_PROMPT, farmAltitudeContext].filter(Boolean).join('\n\n') },
    { role: 'user', content: prompt },
  ];
}

/**
 * Llamada cruda al LLM por defecto (producción): streamOpenAI sobre el endpoint
 * que arma buildLLMRequest. Import dinámico de streamOpenAI para no acoplar el
 * módulo a la red en entornos de test que no lo mockean.
 *
 * @param {Object} args
 * @param {Array}  args.messages
 * @param {string} args.route - 'chat' | 'chat_complex'
 * @param {Function} [args.onToken]
 * @param {AbortSignal} [args.signal]
 * @returns {Promise<{fullText: string, stats: Object}>}
 */
async function defaultLlmCall({ messages, route, onToken, signal }) {
  const { url, body } = buildLLMRequest(/** @type {import('./llmRouter').LLMTask} */ (route), messages);
  const { streamOpenAI } = await import('./openaiStream.js');
  let firstTokenMs = null;
  const t0 = Date.now();
  const res = await streamOpenAI(
    url,
    body,
    (chunk, fullText) => {
      if (firstTokenMs == null) firstTokenMs = Date.now() - t0;
      onToken?.(chunk, fullText);
    },
    { signal },
  );
  return {
    fullText: res?.fullText || '',
    stats: {
      first_token_ms: firstTokenMs,
      response_len: res?.fullText?.length || 0,
    },
  };
}

/**
 * Crea un sender headless para la cola durable. El `llmCall` se inyecta para
 * tests; en producción cae al `defaultLlmCall` (streamOpenAI).
 *
 * @param {Object} [deps]
 * @param {Function} [deps.llmCall] - async({messages, route, onToken, signal}) → {fullText, stats}
 * @returns {Function} sender(req) → telemetría
 */
export function createAgentRequestSender({ llmCall = defaultLlmCall } = {}) {
  return async function sender(req = {}) {
    const prompt = (req && typeof req.prompt === 'string') ? req.prompt : '';
    if (!prompt.trim()) {
      throw new Error('[agentRequestSender] req sin prompt');
    }
    // Si el req no trae route persistido, lo recalculamos de la query.
    const route = req.route && req.route !== 'unknown' ? req.route : selectChatRoute(prompt);
    const messages = buildSenderMessages(/** @type {{prompt:string}} */ (/** @type {any} */ (req)));

    let firstTokenMs = null;
    const t0 = Date.now();
    const { fullText, stats } = await llmCall({
      messages,
      route,
      onToken: (_chunk, _full) => {
        if (firstTokenMs == null) firstTokenMs = Date.now() - t0;
      },
      signal: req.signal,
    });

    const text = typeof fullText === 'string' ? fullText : '';
    if (!text.trim()) {
      // Vacío = recuperable: lanzamos para que processRequest reintente.
      throw new Error('[agentRequestSender] el LLM devolvió respuesta vacía');
    }

    return {
      response: text,
      latency: {
        // Preferimos el stat del backend; si no, el medido aquí por el onToken.
        t_first_token_ms: stats?.first_token_ms ?? firstTokenMs ?? null,
      },
      grounding: {
        nlu_route: route,
        grounded_status: 'none',
        entities: [],
        tools: [],
        rag_chunks: 0,
      },
      tokens_in: stats?.tokens_in ?? estimateTokens(prompt),
      tokens_out: stats?.tokens_out ?? estimateTokens(text),
    };
  };
}

export default createAgentRequestSender;
