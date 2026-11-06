// SPDX-License-Identifier: AGPL-3.0-only
import { segmentarOraciones } from './respuestaCorta.js';
import { COLOMBIA_LOCATIONS } from '../utils/colombiaLocations.js';
import { resolveAgentFarmAltitude } from './agentFarmAltitude.js';

const normalize = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const places = [...new Set(Object.entries(COLOMBIA_LOCATIONS).flatMap(([department, municipalities]) =>
  [department, ...municipalities.map((m) => m.name), ...(normalize(department).startsWith('bogota') ? ['Bogotá'] : [])],
))].map(normalize).sort((a, b) => b.length - a.length);

const departments = new Set(Object.keys(COLOMBIA_LOCATIONS).map(normalize));

// RA1 2026-10-06 (C07): «en clima medio» o «tierra fría» nombran el lugar de la
// pregunta igual que un municipio; sin esto el prompt heredaba «Bogotá» del
// perfil y el modelo respondía «clima medio… Bogotá (zona alta)».
const THERMAL_FLOOR = /\b(?:clima|tierra|piso(?: termico)?|zona)\s+(medi[oa]|templad[oa]|fri[oa]|calid[oa]|caliente|calentan[oa])\b|\b(paramo|tierra caliente|tierra fria|tierra templada|altiplano|piedemonte|valle interandino)\b/;

// Bug reportado 2026-10-29 (cuenta piloto, Finca El Curí 2.532 msnm): "¿Cuántas
// plantas tengo?" nombra la finca propia en primera persona sin decir la
// palabra "finca" — mismo vocabulario que la regla de privacidad de
// inventario (agentService.js). Sin esto, activeOwnedFincaContext queda false,
// fincaAltitud sale null, y dos guards descartan la respuesta real: uno la
// reemplaza por "¿En qué municipio y a qué altura está el cultivo?" (sin
// locationKnown, ver guardParamoNormativa en outputGuards.js) y otro la reduce
// a la última oración que no nombra la finca ni el municipio (ver
// stripUnrequestedProfileLocation más abajo). Anclado al inicio del mensaje
// para no capturar un "que tengo" incrustado a mitad de frase (p.ej. "el café
// que tengo en clima templado").
const INVENTORY_QUESTION = /^[¿\s]*(?:cuant[oa]s?\b[^.!?]*\btengo\b|que\s+tengo\b|mis\s+plantas\b|que\s+plantas\s+hay\b|mi\s+inventario\b)/;

// C24 (piloto 2026-10-31, perfil niña): «Anote que hoy sembré 3 matas de maíz
// en Surco 12» es un registro de la finca propia, pero no decía «finca» ni
// «sembrar», así que la altitud conocida no llegaba a las guardas y una de
// ellas volvía a preguntar «¿En qué municipio y a qué altura…?». Lo que se
// anota o se hizo en primera persona en la finca usa la finca activa.
const FARM_RECORD = /\b(?:anot[eao]\w*|registr[eao]\w*|apunt[eao]\w*)\b[^.!?]*\b(?:sembr\w*|siembr\w*|plant\w*|coseche|cosechamos|regue|regamos|abone|abonamos|pode|podamos|trasplant\w*)\b|\b(?:sembre|sembramos|coseche|cosechamos|trasplante|regue|abone)\b|\b(?:surco|era|cama|bancal)\s+\d+\b/;

/** Read-only context for one turn. Explicit scenarios never inherit farm weather. */
export function resolveAgentScenario(query, profile = {}, finca = null) {
  const text = normalize(query);
  const altitude = text.match(/\b(\d{1,2}[.,]\d{3}|\d{1,4})\s*(?:msnm|m\.?\s?s\.?\s?n\.?\s?m\.?|metros?|m)\b/);
  const location = places.find((place) => {
    const escaped = place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Un departamento también vale con «de/del/por» («frijol de Boyacá»); un
    // municipio solo con «en/desde/para», porque muchos son palabras comunes.
    const preps = departments.has(place) ? 'en|desde|para|de|del|por' : 'en|desde|para';
    return text.trim() === place || new RegExp(`\\b(?:${preps})\\s+${escaped}(?=$|[^a-z])`).test(text);
  });
  const floorMatch = text.match(THERMAL_FLOOR);
  const thermalFloor = floorMatch ? floorMatch[0] : null;
  const explicit = Boolean(altitude || location || thermalFloor);
  const farmReference = /\b(?:mi|mis|nuestra|nuestras|esta|esa|la)\s+fincas?\b|\bfinca\s+(?:fria|templada|calida|caliente|media)\b/.test(text);
  const localFarmQuestion = /\b(?:aqui|aca|sembrar|siembro|plantar|plantamos|helada|helar|hiele|pronostico|sendero|erosion|quebrada|riachuelo|cauce|camping|acampar|restauracion|ronda hidrica)\b/.test(text)
    || INVENTORY_QUESTION.test(text)
    || FARM_RECORD.test(text);
  // A named place/altitude in the current turn wins. Questions that point to
  // "aquí", the selected finca, its weather, planting or its watercourse use
  // the active owned finca even when they do not repeat its municipality.
  // Calls without a turn retain the legacy farm-context API.
  const legacySavedContext = !explicit && (!text.trim()
    || /\b(mi|nuestra)\s+finca\b|\b(mi|nuestro)\s+perfil\b/.test(text));
  const activeOwnedFincaContext = Boolean(finca?.isOwnedFinca) && (farmReference || localFarmQuestion);
  const parsedSavedAltitude = resolveAgentFarmAltitude(finca, profile);
  // Una ficha de perfil sin finca activa sigue siendo la altitud conocida de
  // quien consulta. Las preguntas agrícolas locales (por ejemplo, cuándo
  // sembrar) deben conservarla en las herramientas, el prompt y las guardas.
  // Con una finca activa, su altitud sigue siendo la única autoridad.
  const useKnownFarmAltitudeForLocalQuestion = Boolean(
    !finca && !explicit && localFarmQuestion && Number.isFinite(parsedSavedAltitude) && parsedSavedAltitude > 0,
  );
  // Un piso térmico explícito es un escenario de clima, pero no identifica otra
  // finca. Si no especifican municipio ni altura, conservamos la altitud que la
  // PWA ya tiene de la finca activa/perfil para evitar volver a preguntarla.
  const useKnownFarmAltitudeForThermalFloor = Boolean(
    thermalFloor && !altitude && !location && Number.isFinite(parsedSavedAltitude) && parsedSavedAltitude > 0,
  );
  const useSavedFarm = legacySavedContext || activeOwnedFincaContext || useKnownFarmAltitudeForLocalQuestion;
  const fincaAltitud = altitude
    ? Number(altitude[1].replace(/[.,]/g, ''))
    : useSavedFarm || useKnownFarmAltitudeForThermalFloor
      ? parsedSavedAltitude
      : null;
  return {
    explicit,
    isolateLocation: !useSavedFarm,
    fincaAltitud,
    location: location || null,
    thermalFloor,
    useKnownFarmAltitudeForLocalQuestion,
    useKnownFarmAltitudeForThermalFloor,
  };
}

export function buildScenarioContext(query, { knownFincaAltitude = null } = {}) {
  const parsedAltitude = knownFincaAltitude == null || knownFincaAltitude === ''
    ? null
    : Number(String(knownFincaAltitude).replace(/[.,]/g, ''));
  const knownAltitudeLine = Number.isFinite(parsedAltitude) && parsedAltitude > 0
    ? `Altitud conocida de la finca: ${parsedAltitude} msnm; úsela y no la pregunte de nuevo.`
    : 'No herede la ubicación de la finca; pida confirmación antes de usarla.';
  return `ESCENARIO DE ESTA PREGUNTA: ${query}\nRespete el piso térmico, municipio y altura explícitos del turno; estos prevalecen sobre la ficha de la finca activa. ${knownAltitudeLine} Pregunte solo los datos necesarios que falten. Si la pregunta es educativa, no pida ubicación.`;
}

export function stripUnrequestedProfileLocation(response, query, profile = {}, finca = null) {
  if (!resolveAgentScenario(query, profile, finca).isolateLocation) return response;
  const excluded = [profile?.municipio, profile?.departamento, finca?.municipio, finca?.departamento]
    .filter(value => value && !normalize(query).includes(normalize(value)));
  if (!excluded.length) return response;
  const sentences = segmentarOraciones(response);
  const kept = sentences.filter(sentence => {
    const text = normalize(sentence);
    return !(/\b(su|tu|usted|finca|cultiv\w*|siembr\w*|region|zona)\b/.test(text)
      && excluded.some(place => text.includes(normalize(place))));
  });
  if (kept.length === sentences.length) return response;
  const result = kept.join('\n\n').trim();
  return result || '¿En qué municipio y a qué altura está el cultivo?';
}
