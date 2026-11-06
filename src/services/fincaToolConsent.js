// SPDX-License-Identifier: AGPL-3.0-only

import { MSG } from '../config/messages.js';
import { useFincaActiveStore } from './fincaActiveStore.js';
import { getActiveFincaId } from './tenantContext.js';
import { stripDiacritics } from './outputGuardQueryUtils.js';

export const FINCA_TOOLS = new Set([
  'get_finca_overview', 'get_sensor_finca', 'get_weather_data', 'add_planta_finca',
]);

// Bug reportado 2026-10-29 (cuenta piloto `stev`): el planner NLU no conoce
// los ids reales de las fincas del usuario (solo ve texto de chat), así que
// ante "compare mis dos fincas" devolvió finca_id:"<FINCA_ID_1>" — un
// marcador de plantilla, literal — y el sidecar lo rechazó con
// finca_forbidden. Un id ajeno (de otra cuenta) sería igual de inválido.
function ownedFincaIds() {
  const fincas = useFincaActiveStore.getState().fincas || [];
  return fincas
    .filter((finca) => finca?.isOwnedFinca && typeof finca.id === 'string' && finca.id)
    .map((finca) => finca.id);
}

// Bug reportado 2026-10-30 (#4331 r2): una cuenta anterior a multifinca no
// tiene ningún grupo con flag `finca`, así que `ownedFincaIds()` queda
// vacío y toda llamada de finca se bloqueaba con finca_id_invalido, aunque
// esa cuenta siga funcionando hoy vía el mapa PUSH_FARM_OWNERS_JSON del
// sidecar. Un marcador de plantilla evidente (`<...>`, cadena vacía) sigue
// sin cruzar el límite HTTP en cualquier modo.
function isTemplatePlaceholder(value) {
  const trimmed = value.trim();
  return trimmed === '' || /^<[^<>]+>$/.test(trimmed);
}

/**
 * Con fincas propias: un finca_id que no sea de una finca propia de la
 * cuenta NUNCA cruza el límite HTTP: ni un marcador de plantilla del
 * modelo/planner, ni el id de otra cuenta. Si el id pedido no es propio,
 * cae a la finca activa; si tampoco esa es propia (o no hay ninguna), no
 * hay nada seguro que enviar.
 *
 * Sin fincas propias (modo legado, cuenta anterior a multifinca): no hay
 * lista contra la que validar, así que el finca_id pasa tal cual y es el
 * sidecar quien decide — como antes de #4331. Solo el marcador de
 * plantilla sigue bloqueado.
 * @param {unknown} requestedId
 * @returns {string|null|undefined}
 */
export function resolveOwnedFincaId(requestedId) {
  const owned = new Set(ownedFincaIds());
  if (owned.size > 0) {
    if (typeof requestedId === 'string' && owned.has(requestedId)) return requestedId;
    const activeId = getActiveFincaId();
    if (typeof activeId === 'string' && owned.has(activeId)) return activeId;
    return null;
  }
  if (requestedId === undefined) return undefined;
  if (typeof requestedId === 'string' && !isTemplatePlaceholder(requestedId)) return requestedId;
  return null;
}

const COMPARE_RE = /\bcompar[ae]\w*\b/;
const MULTI_FINCA_RE = /\b(?:mis|dos|ambas|las)\s+fincas?\b/;

/** @param {string} userMessage */
export function wantsFincaComparison(userMessage) {
  const text = stripDiacritics(userMessage);
  return COMPARE_RE.test(text) && MULTI_FINCA_RE.test(text);
}

/**
 * "Compare mis dos fincas" no lo contesta un solo finca_id (real, ajeno o
 * inventado): esto construye una llamada por cada finca propia de la cuenta
 * para que la PWA nunca tenga que adivinar cuál quiso decir el planner.
 * @param {string} toolName
 * @param {object|null|undefined} args
 * @param {string} userMessage
 * @returns {Array<{tool:string,args:object}>|null}
 */
export function buildFincaComparisonChain(toolName, args, userMessage) {
  if (!FINCA_TOOLS.has(toolName) || !wantsFincaComparison(userMessage)) return null;
  const owned = ownedFincaIds();
  if (owned.length < 2) return null;
  return owned.map((id) => ({ tool: toolName, args: { ...(args || {}), finca_id: id } }));
}

// Bug reportado 2026-10-31 (cuenta piloto `stev`): el resumen de
// get_finca_overview no trae nombre/municipio/altitud de la finca que
// consultó — solo plants_count y similares, por finca_id. En una cadena de
// comparación, el LLM veía dos inventarios anónimos y no podía decir a cuál
// finca correspondía cada uno. Esto adjunta la ficha de la finca propia (ya
// conocida del store, nunca inventada) a la evidencia de cada FINCA_TOOL
// antes de que llegue al prompt, para que el inventario y la ficha viajen
// juntos sin depender de que el modelo cruce un id contra el bloque de
// ubicación.
/**
 * @param {Array<{tool: string, args?: object, result?: any}>} evidences
 * @returns {Array<object>}
 */
export function labelOwnedFincaEvidence(evidences) {
  if (!Array.isArray(evidences) || evidences.length === 0) return evidences;
  const owned = useFincaActiveStore.getState().fincas || [];
  return evidences.map((ev) => {
    if (!ev || !FINCA_TOOLS.has(ev.tool) || !ev.args) return ev;
    const result = ev.result;
    if (!result || typeof result !== 'object' || result._error === true) return ev;
    const finca = owned.find((f) => f?.isOwnedFinca && f.id === ev.args.finca_id);
    if (!finca) return ev;
    return {
      ...ev,
      result: {
        ...result,
        finca_nombre: finca.nombre || finca.name || null,
        finca_municipio: finca.municipio || finca.location?.municipio || null,
        finca_departamento: finca.departamento || finca.location?.departamento || null,
        finca_altitud: finca.altitud ?? finca.finca_altitud ?? finca.location?.finca_altitud ?? null,
      },
    };
  });
}

// A model-supplied confirmation is never evidence of human consent.
export function confirmPlantOperation(args) {
  if (!args || typeof window === 'undefined') return null;
  const operation = {};
  for (const key of ['finca_id', 'species_id', 'planted_date']) {
    if (typeof args[key] !== 'string' || !args[key].trim()) return null;
    operation[key] = args[key];
  }
  if (args.zona_id !== undefined) {
    if (typeof args.zona_id !== 'string' || !args.zona_id.trim()) return null;
    operation.zona_id = args.zona_id;
  }
  const copy = MSG.fincaTools;
  const details = [
    copy.title,
    MSG.format(copy.finca, { value: JSON.stringify(operation.finca_id) }),
    MSG.format(copy.species, { value: JSON.stringify(operation.species_id) }),
    MSG.format(copy.date, { value: JSON.stringify(operation.planted_date) }),
    MSG.format(copy.zone, { value: operation.zona_id === undefined ? copy.noZone : JSON.stringify(operation.zona_id) }),
    copy.confirm,
  ].join('\n');
  if (window.confirm(details) !== true) return null;
  return {
    ...operation,
    confirmation: { confirmed: true, action: 'add_planta_finca', ...operation },
  };
}

// Only documented tool arguments cross the HTTP boundary, never model identity.
export function fincaReadArgs(tool, args) {
  const fields = {
    get_finca_overview: ['finca_id'],
    get_sensor_finca: ['finca_id', 'sensor_type', 'since'],
    get_weather_data: ['finca_id', 'lat', 'lng', 'weather_type', 'since'],
  }[tool];
  return fields ? Object.fromEntries(fields.filter((key) => args?.[key] !== undefined)
    .map((key) => [key, args[key]])) : args;
}
