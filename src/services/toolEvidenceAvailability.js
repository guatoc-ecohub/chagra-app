// SPDX-License-Identifier: AGPL-3.0-only

export function hasUnavailableEvidence(evidence) {
  const items = Array.isArray(evidence) ? evidence : [evidence];
  return items.some(item => {
    const result = item?.result;
    return result && typeof result === 'object' &&
      (result._error === true || result.available === false || result.status === 'unavailable');
  });
}

export const ALTITUD_REQUERIDA_RESPONSE =
  '¿A qué altitud, en metros sobre el nivel del mar (msnm), está su finca?';

export function hasRequiredFarmAltitudeEvidence(evidence) {
  const items = Array.isArray(evidence) ? evidence : [evidence];
  return items.some(item =>
    ['get_cultivos_viables', 'get_diseno_finca'].includes(item?.tool) &&
    item?.result?.reason === 'altitud_requerida');
}

// Only an explicit, successful catalog miss establishes absence. An empty
// or malformed payload, and any service failure, cannot establish it.
export function hasMissingBiopreparadoEvidence(evidence) {
  const items = Array.isArray(evidence) ? evidence : [evidence];
  return !hasUnavailableEvidence(evidence) && items.some(item =>
    item?.tool === 'get_biopreparados' &&
    (item.result?.found === false || item.result?.matches_count === 0));
}

export const MISSING_BIOPREPARADO_RESPONSE =
  'No hay ficha verificada de este biopreparado en esta consulta. No lo prepare ni aplique sin acompañamiento técnico. ' +
  'Si contiene estiércol o rumen crudo, evite el contacto con alimentos, agua de consumo y partes del cultivo que se comen crudas. ' +
  'Use guantes, evite salpicaduras y lávese las manos con agua y jabón. Manténgalo fuera del alcance de niños y animales. ' +
  'Consulte al ICA o a Agrosavia para orientación técnica. No puedo indicar una receta, dosis ni tiempo de fermentación sin una ficha verificada.';

// Abstention used only when nothing supported survives a failed source
// (partialEvidenceGuard.js). A partial answer carries a one-line notice instead.
export const UNAVAILABLE_EVIDENCE_RESPONSE =
  'Una fuente no está disponible para completar esta consulta. No pude comprobar el dato solicitado. Puede reintentar la consulta más tarde.';

// ── Degradación por fuente (RA5 2026-10-24) ─────────────────────────────────
// Antes, UNA herramienta caída del turno reemplazaba la respuesta entera por
// UNAVAILABLE_EVIDENCE_RESPONSE (19 de 30 preguntas de pisos). Ahora el turno
// conserva lo que la evidencia disponible sostiene, quita lo que solo la fuente
// caída podía respaldar y dice en una línea qué faltó. La abstención entera
// queda para cuando no sobrevive nada.

/** Fuentes de seguridad: si caen, no sale ninguna dosis, receta ni frecuencia. */
export const SAFETY_CRITICAL_TOOLS = new Set([
  'get_dosis_biopreparado',
  'get_biopreparados',
  'get_toxicidad',
]);

const SOURCE_LABELS = {
  get_precio_sipsa: 'el precio de SIPSA',
  get_clima_ideam: 'los datos de clima del IDEAM',
  get_alertas_clima_zona: 'las alertas de clima de su zona',
  get_enso_status: 'el estado de El Niño y La Niña',
  get_calendario_siembra: 'el calendario de siembra',
  get_cultivos_viables: 'la lista de cultivos para su altura',
  get_diseno_finca: 'el diseño de policultivo para su altura',
  get_species: 'la ficha de la especie',
  get_variedades: 'las variedades registradas',
  get_variedades_cultivo: 'las variedades registradas',
  get_companions: 'las asociaciones entre plantas',
  get_multihop_companions: 'las asociaciones entre plantas',
  get_subgrafo_relacional: 'las relaciones entre plantas, plagas y controles',
  get_associations: 'las asociaciones entre plantas',
  get_pest_controllers: 'los controles de la plaga',
  get_folk_sintoma: 'la lectura del síntoma',
  get_diseno_restauracion: 'el diseño de restauración',
  get_diseno_silvopastoril: 'el diseño silvopastoril',
  get_invasoras_alternativas: 'las alternativas a especies invasoras',
  get_normativa_ica: 'la normativa del ICA',
  get_dosis_biopreparado: 'la ficha de dosis del biopreparado',
  get_biopreparados: 'la ficha del biopreparado',
  get_toxicidad: 'la ficha de toxicidad',
  get_suelo: 'los requerimientos de suelo',
  get_fenologia: 'las etapas del cultivo',
  get_finca_overview: 'el resumen de una de sus fincas',
};

function _items(evidence) {
  return (Array.isArray(evidence) ? evidence : [evidence]).filter(Boolean);
}

function _isUnavailableItem(item) {
  const result = item?.result;
  // Falta la altitud: es una pregunta al usuario, no una fuente caída.
  if (result?.reason === 'altitud_requerida') return false;
  return Boolean(result && typeof result === 'object' &&
    (result._error === true || result.available === false || result.status === 'unavailable'));
}

/**
 * Separa la evidencia del turno en lo que llegó y lo que no.
 * @param {any} evidence
 * @returns {{usable: any[], unavailable: any[], critical: boolean}}
 */
export function partitionEvidence(evidence) {
  const usable = [];
  const unavailable = [];
  for (const item of _items(evidence)) {
    if (_isUnavailableItem(item)) unavailable.push(item);
    else if (item?.result != null) usable.push(item);
  }
  return {
    usable,
    unavailable,
    critical: unavailable.some((item) => SAFETY_CRITICAL_TOOLS.has(item?.tool)),
  };
}

/**
 * Nombre para el campesino de lo que no se pudo consultar.
 * @param {any[]} unavailable
 * @returns {string}
 */
export function unavailableSourcesLabel(unavailable) {
  const labels = [];
  for (const item of unavailable || []) {
    const label = SOURCE_LABELS[item?.tool] || 'una de las fuentes de la consulta';
    if (!labels.includes(label)) labels.push(label);
  }
  if (labels.length <= 1) return labels[0] || 'una de las fuentes de la consulta';
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}

/** Marca común de los avisos, para reconocerlos y no duplicarlos. */
export const UNAVAILABLE_NOTICE_PREFIX = 'Aviso: no pude consultar';

/**
 * Aviso de una línea sobre la fuente que faltó.
 * @param {any[]} unavailable
 * @returns {string}
 */
export function buildUnavailableNotice(unavailable) {
  const items = unavailable || [];
  if (items.length === 0) return '';
  if (items.every((item) => item?.result?.reason === 'no_municipio')) {
    return 'Aviso: no sé en qué municipio está su finca, así que no consulté el clima. Dígame el municipio y lo reviso.';
  }
  const critical = items.some((item) => SAFETY_CRITICAL_TOOLS.has(item?.tool));
  const label = unavailableSourcesLabel(items);
  return critical
    ? `${UNAVAILABLE_NOTICE_PREFIX} ${label} en este momento, así que no le doy dosis, cantidades ni receta. Para eso, siga la etiqueta o consulte al ICA o a Agrosavia.`
    : `${UNAVAILABLE_NOTICE_PREFIX} ${label} en este momento; esta respuesta no incluye ese dato.`;
}
