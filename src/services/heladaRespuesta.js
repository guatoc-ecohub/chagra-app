// SPDX-License-Identifier: AGPL-3.0-only
/**
 * heladaRespuesta — «¿me puede caer helada?» se contesta con el piso y el
 * clima de la finca, sin modelo (re-auditoría RA5 2026-10-24, PISOS-02).
 *
 * En la auditoría, 0 de 5 preguntas de helada tuvieron respuesta útil: la
 * heurística de clima pedía precipitación al IDEAM (400), el turno se abstenía
 * entero, y «¿en qué meses caen más heladas y cómo protejo la papa?» salió con
 * el precio de la papa criolla. La respuesta depende de dos datos que la app ya
 * tiene: la altitud (de la pregunta o de la finca) y la mínima del pronóstico
 * cacheado de la finca.
 *
 * Fuentes, todas ya en el repo:
 *   - Piso y temperatura media: `src/data/piso-termico.json` (IGAC,
 *     IN-AGR-PC05-01 v1, tablas 1 y 2), con los cortes de `frostPisoForElevation`.
 *   - Umbral de alerta por piso: `FORECAST_THRESHOLDS.HELADA_MIN_C`, el mismo
 *     que usa el motor de alertas.
 *   - Madrugada real más fría que el pronóstico en noche despejada:
 *     `SESGO_NOCHE_DESPEJADA_C` (frostRisk.js, validación contra estaciones).
 *   - Qué hacer: el texto curado de los boletines de clima
 *     (`src/data/climaBoletines.js`, papa en el altiplano).
 *   - En qué meses hiela más: SIN DATO CON FUENTE en el repo; se dice así.
 *
 * Pura y síncrona. Copy de cara al usuario: usted, sin raya larga.
 *
 * @module heladaRespuesta
 */

import pisoTermico from '../data/piso-termico.json';
import { FORECAST_THRESHOLDS } from '../constants/alertThresholds.js';
import { frostPisoForElevation } from './frostRisk.js';
import { stripDiacritics } from './outputGuardQueryUtils.js';
import { ALTITUD_REQUERIDA_RESPONSE } from './toolEvidenceAvailability.js';
import { ENSO_HELADA_PISO_FRIO, UMBRAL_HELADA_TEXTO, esPisoDeHelada } from './ensoHeladaRegla.js';
import { pisoDeFinca } from '../visual/mundo3d/pisosTermicos.js';

export const FUENTE_HELADA =
  'IGAC, IN-AGR-PC05-01 v1 (pisos térmicos); pronóstico de su finca (Open-Meteo, el mismo de «El tiempo»)';

const HELADA_RE = /\bheladas?\b|\bescarch\w*|\bhiel(a|e|an|en)\b|\bhel(ar|ara|aran|aria|arian|ando|ase)\b|\bcongel\w*\s+(la|el|las|los|mi|mis)\s+(mata|cultivo|planta|papa|siembra)\w*/;
const MESES_RE = /\bmeses?\b|\bcuando\b|\bepocas?\b|\btemporadas?\b/;
const PROTEGER_RE = /\bproteg\w*|\bcuid\w*|\bque hago\b|\bque hacer\b|\bcomo evito\b|\bdefiend\w*/;

/** ¿La pregunta es por helada? */
export function esPreguntaHelada(userMessage) {
  return HELADA_RE.test(stripDiacritics(userMessage || ''));
}

/** Altitud dicha en la pregunta («a 20 m», «a 2.630 metros», «3300 msnm»). */
export function altitudEnPregunta(userMessage) {
  const q = stripDiacritics(userMessage || '');
  const m = q.match(/(\d{1,2}\.\d{3}|\d{1,4})\s*(?:m|mts?|metros?|msnm|m\.?\s?s\.?\s?n\.?\s?m\.?)(?![a-z])/);
  if (!m) return null;
  const alt = Number(m[1].replace('.', ''));
  return Number.isFinite(alt) && alt >= 0 && alt <= 6000 ? alt : null;
}

const fmtAlt = (n) => Math.round(n).toLocaleString('es-CO');
const fmtTemp = (n) => (Math.round(n * 10) / 10).toLocaleString('es-CO');

function _pisoIgac(id) {
  return (pisoTermico.pisos || []).find((p) => p.id === id) || null;
}

function _temperaturaMedia(id) {
  const t = String(_pisoIgac(id)?.temp_media_C || '');
  if (t.startsWith('>')) return `pasa de ${t.slice(1)} °C`;
  if (t.startsWith('<')) return `está por debajo de ${t.slice(1)} °C`;
  const rango = t.match(/^(\d+)-(\d+)$/);
  return rango ? `va de ${rango[1]} a ${rango[2]} °C` : null;
}

const NOMBRE_PISO = { calido: 'piso cálido', templado: 'piso templado', frio: 'tierra fría', paramo: 'páramo' };

export const QUE_HACER_HELADA =
  'Qué hacer: revise la mínima de su finca cada noche; cubra el suelo con mulch (hojarasca o pasto seco); ' +
  'no arriesgue siembras tardías de cultivos sensibles; y antes de usar aspersión contra la helada, revise con un técnico ' +
  'si su sistema y su agua sirven, porque si se corta antes de tiempo el daño puede aumentar.';

/**
 * Respuesta de helada para la finca, o null si la pregunta no es de helada.
 * @param {{userMessage?: string|null, fincaAltitud?: number|string|null, forecastTempMin?: number|null}} [opts]
 * @returns {{text: string, piso: string|null, altitud: number|null, fuente: string}|null}
 */
export function buildHeladaAnswer({ userMessage = null, fincaAltitud = null, forecastTempMin = null } = {}) {
  if (!esPreguntaHelada(userMessage)) return null;
  const q = stripDiacritics(userMessage || '');
  const deLaPregunta = altitudEnPregunta(userMessage);
  const deLaFinca = fincaAltitud == null || fincaAltitud === '' ? null : Number(fincaAltitud);
  const altitud = deLaPregunta ?? (Number.isFinite(deLaFinca) ? deLaFinca : null);
  if (altitud == null) {
    return {
      text: `Para saber si le puede caer helada necesito la altitud de su finca. ${ALTITUD_REQUERIDA_RESPONSE}`,
      piso: null, altitud: null, fuente: FUENTE_HELADA,
    };
  }
  const piso = frostPisoForElevation(altitud);
  const media = _temperaturaMedia(piso);
  const donde = `Su finca está a ${fmtAlt(altitud)} msnm, en ${NOMBRE_PISO[piso]}${media ? `, donde la temperatura media ${media} (IGAC)` : ''}.`;
  const frio = piso === 'frio' || piso === 'paramo';
  const partes = [];
  if (piso === 'calido') partes.push(`No. ${donde} Ahí no cae helada.`);
  else if (piso === 'templado') partes.push(`Es muy poco probable. ${donde} La helada es propia de tierra fría y páramo.`);
  else if (piso === 'frio') partes.push(`Sí, puede caer helada. ${donde} La helada llega en noches despejadas y sin viento, y pega en la madrugada.`);
  else partes.push(`Sí, la helada es un riesgo real en su finca. ${donde} Llega en noches despejadas y sin viento, y pega en la madrugada.`);

  const min = Number.isFinite(Number(forecastTempMin)) && forecastTempMin !== null ? Number(forecastTempMin) : null;
  const umbral = FORECAST_THRESHOLDS.HELADA_MIN_C[piso] ?? FORECAST_THRESHOLDS.HELADA_MIN_C.default;
  if (min != null && min <= umbral) {
    partes.push(`Ojo: el pronóstico de su finca para estos 7 días trae una mínima de ${fmtTemp(min)} °C; vigile esas madrugadas en «El tiempo».`);
  } else if (min != null && frio) {
    partes.push(`El pronóstico de su finca para estos 7 días da una mínima de ${fmtTemp(min)} °C; en noches despejadas la madrugada real suele llegar más fría que el pronóstico.`);
  } else if (min == null && frio) {
    partes.push('No tengo el pronóstico de su finca en este momento: revise la mínima en «El tiempo» antes de cada madrugada.');
  }

  if (MESES_RE.test(q)) partes.push('En qué meses hiela más en su zona: no tengo ese dato con fuente verificada.');
  if (frio) partes.push(QUE_HACER_HELADA);
  else if (PROTEGER_RE.test(q)) partes.push('En su piso no hace falta proteger el cultivo contra la helada.');

  return { text: partes.join('\n\n'), piso, altitud, fuente: FUENTE_HELADA };
}

// ── Guarda de salida: dirección de El Niño y umbral de helada ──────────────

const RE_NINO = /\bel nino\b|\bfenomeno del nino\b/;
// «noches más secas y calurosas», «noches más cálidas», «menos heladas».
const RE_NINO_CALIDO = /\bnoches?\b[^.!?\n]{0,40}\b(calid\w*|caluros\w*|calient\w*|tibi\w*|templad\w*)|\b(calid\w*|caluros\w*|calient\w*|tibi\w*)\b[^.!?\n]{0,20}\bnoches?\b|\b(menos|reduce\w*|disminu\w*|baja\w*)\s+(el\s+)?(riesgo\s+de\s+)?(las\s+)?helad|\bno\s+(habra|hay|caen?)\s+helad/;
const RE_NEGACION = /\b(no|nunca|jamas)\s+(trae|significa|implica|son|hace|es|vuelve)\b/;
// «el umbral crítico para que empiece a formarse hielo», «punto de congelación».
const RE_FORMA_HIELO = /form\w*\s+(el\s+)?hielo|hielo\s+se\s+form|empie\w*\s+a\s+(helar|formarse|congelar)|(punto|temperatura)\s+de\s+congelacion|se\s+congela/;
const RE_GRADOS = /(-?\d+(?:[.,]\d+)?)\s*(?:°\s*c?|grados)/g;
const RE_CERO_ABSOLUTO = /cero absoluto/i;
// Conclusión sacada de la frase anterior: si esa estaba al revés, esta también.
const RE_CONSECUENCIA = /^(por eso|por lo tanto|por ello|asi que|de modo que|de manera que|entonces)\b/;

/**
 * Piloto multifinca, bugs 14 y 24 (2026-10-31). Corrige en la respuesta del modelo:
 *   - en piso frío o páramo, una frase que diga que El Niño trae noches más
 *     cálidas o menos heladas (es al revés: ENSO_HELADA_PISO_FRIO);
 *   - una frase que ponga la formación de hielo por encima de 2 °C (se forma
 *     a 0 °C en la superficie: UMBRAL_HELADA_TEXTO);
 *   - la frase que saca una conclusión («Por eso…») de la de El Niño al
 *     revés, que se quita con ella;
 *   - «cero absoluto» por 0 °C.
 * Sin altitud de la finca no se toca la dirección de El Niño.
 *
 * @param {string} responseText
 * @param {{ altitud?: number|string|null }} [opts]
 * @returns {{ text: string, modified: boolean, reason: string|null }}
 */
export function guardHeladaEnso(responseText, { altitud = null } = {}) {
  if (typeof responseText !== 'string' || !responseText) {
    return { text: responseText ?? '', modified: false, reason: null };
  }
  const alt = altitud == null || altitud === '' ? NaN : Number(String(altitud).replace(/[.,\s]/g, ''));
  const pisoFrio = Number.isFinite(alt) && alt > 0 && esPisoDeHelada(pisoDeFinca(alt));
  const reasons = [];
  let ensoPuesta = false;
  let umbralPuesto = false;
  let trasEnsoCorregido = false;
  // Corte propio: `segmentarOraciones` no corta tras «°C.» (lo protege como
  // abreviatura) y uniría la frase de la mínima con la de El Niño.
  const fragments = responseText.split(/(?<=[.!?])(?=\s)/);
  const text = fragments.map((fragment) => {
    const sentence = fragment.trim();
    if (!sentence) return fragment;
    const n = stripDiacritics(sentence).toLowerCase();
    const venia = trasEnsoCorregido;
    trasEnsoCorregido = false;
    if (venia && RE_CONSECUENCIA.test(n)) {
      trasEnsoCorregido = true;
      return '';
    }
    const lead = fragment.slice(0, fragment.indexOf(sentence));
    const trail = fragment.slice(fragment.indexOf(sentence) + sentence.length);
    if (pisoFrio && RE_NINO.test(n) && RE_NINO_CALIDO.test(n) && !RE_NEGACION.test(n)) {
      if (!reasons.includes('enso_helada_direccion')) reasons.push('enso_helada_direccion');
      const out = ensoPuesta ? '' : ENSO_HELADA_PISO_FRIO;
      ensoPuesta = true;
      trasEnsoCorregido = true;
      return out ? `${lead}${out}${trail}` : '';
    }
    if (RE_FORMA_HIELO.test(n)) {
      const grados = [...n.matchAll(RE_GRADOS)].map((m) => Number(m[1].replace(',', '.')));
      if (grados.length > 0 && grados.some((g) => g > 2)) {
        if (!reasons.includes('umbral_helada_inventado')) reasons.push('umbral_helada_inventado');
        const out = umbralPuesto ? '' : UMBRAL_HELADA_TEXTO;
        umbralPuesto = true;
        return out ? `${lead}${out}${trail}` : '';
      }
    }
    if (RE_CERO_ABSOLUTO.test(sentence)) {
      if (!reasons.includes('cero_absoluto')) reasons.push('cero_absoluto');
      return fragment.replace(/cero absoluto/gi, '0 °C');
    }
    return fragment;
  }).join('');
  if (reasons.length === 0) return { text: responseText, modified: false, reason: null };
  return { text: text.replace(/[ \t]{2,}/g, ' ').trim(), modified: true, reason: reasons.join('+') };
}
