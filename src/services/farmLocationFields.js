// Only user-confirmed location fields cross the profile / farmOS boundary.
import { parseAgentFarmAltitude } from './agentFarmAltitude.js';

export const FARM_LOCATION_FIELDS = Object.freeze([
  'ubicacion_lat', 'ubicacion_lng', 'ubicacion_accuracy',
  'municipio', 'departamento', 'region', 'vereda', 'vereda_source',
  'vereda_display_name', 'finca_altitud', 'altitud', 'altitud_source',
]);

export function pickFarmLocation(profile = {}) {
  return Object.fromEntries(FARM_LOCATION_FIELDS
    .filter(key => (typeof profile[key] === 'string' || typeof profile[key] === 'number') && profile[key] !== '')
    .map(key => [key, profile[key]]));
}

/** Overlay the selected owned finca's location without inheriting another finca's fields. */
export function profileForFincaLocation(profile = {}, finca) {
  if (!finca?.isOwnedFinca) return profile;
  const accountProfile = { ...profile };
  FARM_LOCATION_FIELDS.forEach((field) => delete accountProfile[field]);
  return { ...accountProfile, ...pickFarmLocation(finca.location || finca) };
}

/** Nombre, municipio/departamento y altitud de una finca propia, para un turno. */
function fincaFicha(finca, profile) {
  const locationProfile = profileForFincaLocation(profile, finca);
  const name = String(finca.nombre || finca.name || '').trim() || 'no registrado';
  const municipio = String(locationProfile.municipio || '').trim() || 'no disponible';
  const departamento = String(locationProfile.departamento || '').trim();
  const altitude = parseAgentFarmAltitude(
    finca.altitud ?? finca.finca_altitud ?? locationProfile.finca_altitud ?? locationProfile.altitud,
  );
  const latitude = Number(locationProfile.ubicacion_lat);
  const longitude = Number(locationProfile.ubicacion_lng);
  const hasCoordinates = Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
  const coordinates = hasCoordinates
    ? `${latitude}, ${longitude}`
    : 'no disponibles';
  const departmentLabel = departamento ? `, ${departamento}` : '';
  return { name, municipio, departmentLabel, altitude, coordinates };
}

/**
 * Serializes only the selected, owned finca's location for the private agent
 * system context. Explicit location data in the current question still wins.
 */
export function buildActiveFincaLocationContext(finca, profile = {}) {
  if (!finca?.isOwnedFinca) return '';
  const { name, municipio, departmentLabel, altitude, coordinates } = fincaFicha(finca, profile);

  return `FINCA PROPIA ACTIVA DE ESTE TURNO: nombre ${name}; municipio ${municipio}${departmentLabel}; altitud ${altitude ?? 'no disponible'} msnm; coordenadas ${coordinates}. Use esta ficha cuando el usuario pregunte por aquí o por esta finca. La ubicación o altura que nombre en el turno prevalece; no aplique esta ficha a otro lugar ni recite estos datos si no son pertinentes.`;
}

/**
 * Bug reportado 2026-10-31 (cuenta piloto `stev`): "compare mis dos fincas"
 * trae el inventario de las dos (una llamada get_finca_overview por finca),
 * pero el system prompt solo traía la ficha de la finca ACTIVA — el modelo
 * respondía pidiendo municipio y altitud de "la segunda finca" aunque ya
 * estaban en el perfil. Esta ficha lista TODAS las fincas propias cuando el
 * turno pide comparar, para que ninguna quede sin nombre/ubicación/altitud.
 *
 * @param {Array<object>} fincas - todas las fincas conocidas del store (propias y públicas).
 * @param {object} [profile]
 * @returns {string} '' si hay menos de 2 fincas propias.
 */
export function buildOwnedFincasComparisonContext(fincas, profile = {}) {
  const owned = (Array.isArray(fincas) ? fincas : []).filter((finca) => finca?.isOwnedFinca);
  if (owned.length < 2) return '';
  const fichas = owned.map((finca) => {
    const { name, municipio, departmentLabel, altitude } = fincaFicha(finca, profile);
    const id = finca.id || finca.slug || 'no disponible';
    return `- ${name} (id ${id}): municipio ${municipio}${departmentLabel}; altitud ${altitude ?? 'no disponible'} msnm.`;
  });

  return `FINCAS PROPIAS DE ESTA CUENTA (el usuario pidió comparar sus fincas): use esta ficha para cada una; NO pida municipio ni altitud de ninguna finca propia, ya están aquí. El inventario de cada finca trae su propio nombre; si por algún motivo no lo trajera, relaciónelo con esta lista por su id.\n${fichas.join('\n')}`;
}

export function hasFarmLocation(location) {
  const lat = location.ubicacion_lat;
  const lng = location.ubicacion_lng;
  return (lat != null && lng != null && lat !== '' && lng !== ''
    && Number.isFinite(Number(lat)) && Math.abs(Number(lat)) <= 90
    && Number.isFinite(Number(lng)) && Math.abs(Number(lng)) <= 180)
    || Boolean(location.municipio || location.region);
}
