// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Normaliza altitudes registradas en la finca o el perfil.
 * Las separaciones de miles con punto o coma se aceptan como `2.580`.
 *
 * @param {unknown} value
 * @returns {number|null}
 */
export function parseAgentFarmAltitude(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(String(value).trim().replace(/[.,]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * La finca activa es la autoridad cuando existe. El perfil solo aporta la
 * altitud cuando no hay un objeto de finca activa.
 *
 * @param {object|null|undefined} finca
 * @param {object|null|undefined} profile
 * @returns {number|null}
 */
export function resolveAgentFarmAltitude(finca, profile) {
  const rawAltitude = finca && typeof finca === 'object'
    ? finca.altitud ?? finca.finca_altitud
    : profile?.finca_altitud;
  return parseAgentFarmAltitude(rawAltitude);
}

/**
 * Instrucción compartida para prompts del agente, incluidos los reintentos
 * headless. Una ubicación o altitud explícita del turno conserva prioridad.
 *
 * @param {object|null|undefined} finca
 * @param {object|null|undefined} profile
 * @param {number|null|undefined} resolvedAltitude Altitud ya resuelta para el turno actual.
 * @returns {string}
 */
export function buildAgentFarmAltitudeContext(finca, profile, resolvedAltitude = resolveAgentFarmAltitude(finca, profile)) {
  const altitude = parseAgentFarmAltitude(resolvedAltitude);
  if (altitude == null) return '';

  const source = finca && typeof finca === 'object'
    ? 'FINCA ACTIVA'
    : 'PERFIL DE FINCA, cuando no hay finca activa';
  return `ALTITUD PRIORITARIA DE ${source}: ${altitude} msnm. Si otra parte del contexto menciona una altitud diferente, incluida una del perfil, use esta altitud. Respete una altitud o ubicación explícita de la pregunta.`;
}
