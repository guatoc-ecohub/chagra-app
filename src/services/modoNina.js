// SPDX-License-Identifier: AGPL-3.0-only
/**
 * modoNina.js — respuestas cortas y sencillas para una niña o un niño.
 *
 * Re-auditoría RA1 2026-10-06 (N14): a «¿por qué son importantes las abejas?»
 * una niña de 11 años recibió 217 a 238 palabras, «Tetragonisca angustula»,
 * «meliponicultura», el panel de fuentes y una tarjeta de Beauveria contra el
 * gusano blanco. Criterio: ≤ 60 palabras, frases ≤ 15 palabras, sin nombre
 * científico sin explicar y sin tarjetas de otro tema.
 *
 * Cómo se activa (decisión provisional mientras no exista entrada sin cuenta,
 * C20): (a) el perfil elige `nivel_respuestas: 'nina'`, o (b) en esta sesión la
 * persona dijo que es menor («tengo 11 años», «soy una niña»); eso ya lo
 * detecta safetyIntentResponder y aquí se recuerda en sessionStorage, o (c)
 * (RA2 2026-10-07) el subusuario de la finca tiene rol `nina`; eso lo mira
 * AgentScreen con roleService.isNina(). No se adivina la edad por el estilo de
 * la pregunta.
 *
 * El recorte es DETERMINISTA: el prompt pide la forma, pero lo que se muestra
 * pasa por `ajustarRespuestaNina`, que garantiza los límites aunque el modelo
 * no obedezca. Puro salvo el acceso a sessionStorage, que degrada a no-op.
 */
import { segmentarOraciones } from './respuestaCorta.js';

export const MODO_NINA_KEY = 'chagra:modo-nina';
export const MAX_PALABRAS = 60;
export const MAX_PALABRAS_FRASE = 15;

export const MODO_NINA_PROMPT = `=== MODO NIÑA O NIÑO (prioridad máxima sobre el formato) ===
Quien pregunta es una niña o un niño. Responde en tú, con cariño y sin infantilizar.
- Máximo 3 frases y 50 palabras en total. Cada frase de 12 palabras o menos.
- Nada de nombres científicos, siglas, fuentes, porcentajes ni palabras técnicas.
- No menciones su finca, su ciudad ni su región: no los sabes.
- Habla solo del tema que preguntó.
- Si algo puede ser peligroso, dile que le pregunte a un adulto.
=== FIN MODO NIÑA O NIÑO ===`;

/**
 * ¿Está activo el modo niña?
 * @param {{ nivel_respuestas?: string }|null} profile perfil del usuario (getProfile())
 * @param {{ getItem?: Function }|null} [storage] sessionStorage inyectable
 * @returns {boolean}
 */
export function esModoNina(profile, storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null) {
  if (profile && typeof profile === 'object' && profile.nivel_respuestas === 'nina') return true;
  try {
    return Boolean(storage && storage.getItem(MODO_NINA_KEY) === '1');
  } catch (_) {
    return false;
  }
}

/**
 * Recuerda en esta sesión que quien escribe es menor.
 * @param {{ setItem?: Function }|null} [storage]
 */
export function activarModoNinaSesion(storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null) {
  try {
    if (storage) storage.setItem(MODO_NINA_KEY, '1');
  } catch (_) {
    // Sin sessionStorage (modo privado estricto): el modo vive solo en el turno.
  }
}

const palabras = (t) => String(t || '').trim().split(/\s+/).filter(Boolean);

// Binomio latino: «Tetragonisca angustula», «Apis mellifera», «Beauveria
// bassiana», «Rubus spp.». Mayúscula + epíteto con terminación latina; las
// palabras españolas comunes con esas terminaciones no cuentan.
const RE_BINOMIO = /\b([A-Z][a-z]{3,})\s+([a-z]{3,}|spp?\.)/g;
const RE_EPITETO = /^(spp?\.|[a-z]*(us|um|is|ii|ae|ensis|ata|ula|ica|ana|ella|ifera|oides|ea|ia|osa|ina|ida|era|ata))$/;
const COMUNES = new Set(['para', 'pera', 'era', 'ella', 'esta', 'esa', 'toda', 'cada', 'nunca', 'mucha', 'poca',
  'otra', 'misma', 'buena', 'nada', 'casa', 'sea', 'tiera', 'tierra', 'fea', 'idea', 'vida', 'comida', 'medida',
  'sus', 'mis', 'tus', 'menos', 'más', 'antes', 'después', 'ayudan', 'linda', 'bonita', 'pequeña', 'ahora', 'agua',
  'cosa', 'ida', 'cosecha', 'miel', 'ellas', 'unica', 'única', 'rica', 'antigua', 'propia']);
const tieneBinomio = (f) => {
  for (const m of f.matchAll(RE_BINOMIO)) {
    if (RE_EPITETO.test(m[2]) && !COMUNES.has(m[2])) return true;
  }
  return false;
};
// Palabras técnicas que una niña no tiene por qué conocer, y referencias al
// lugar del perfil (que no es el de ella).
// RA2 2026-10-07 (N43): «según el principio de precaución y mis reglas» y
// «edabilidad» también son maquinaria del agente, no lenguaje de niña.
const RE_TECNICO = /\b(principio de precauci[oó]n|mis reglas|edabilidad|comestibilidad|nombre cient[ií]fico|meliponicultura|entomopat\w+|polinizaci[oó]n cruzada|biodiversidad funcional|agroecosistema\w*|fitosanitari\w+|lepid[oó]pter\w+|himen[oó]pter\w+|BETA|ONI|IDEAM|NOAA|cat[aá]logo|fuente[s]? consultada\w*)\b/i;
const RE_LUGAR_PERFIL = /\b(tu|su) (regi[oó]n|finca|zona|vereda|municipio|piso t[eé]rmico)\b|\bBogot[aá]\b|\bzona alta\b/i;

function limpiarMarkdown(text) {
  return String(text || '')
    .replace(/\*\*|__|`/g, '')
    .replace(/(^|\s)[*_](\S[^*_]*\S)[*_](?=\s|[.,;:!?]|$)/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

/**
 * Parte una frase larga por comas o «y», quedándose con el primer tramo que
 * cabe en el límite. Devuelve null si ningún tramo inicial cabe.
 * @param {string} frase
 * @returns {string|null}
 */
function acortarFrase(frase) {
  if (palabras(frase).length <= MAX_PALABRAS_FRASE) return frase;
  const tramos = frase.split(/,\s+|;\s+|\s+y\s+(?=[a-záéíóúñ])/).map((t) => t.trim()).filter(Boolean);
  // Primer tramo solo, o primer tramo + último (quita el inciso del medio:
  // «Las abejas, especialmente…, juegan un rol» → «Las abejas juegan un rol»).
  const candidatos = [tramos[0]];
  if (tramos.length >= 3) candidatos.push(`${tramos[0]} ${tramos[tramos.length - 1]}`);
  for (const c of candidatos) {
    const n = palabras(c).length;
    if (c && n >= 4 && n <= MAX_PALABRAS_FRASE) return /[.!?]$/.test(c) ? c : `${c}.`;
  }
  return null;
}

export const RESPUESTA_NINA_VACIA = 'Buena pregunta. No tengo una respuesta corta y segura para eso. Pregúntele a un adulto o a su profe.';

/**
 * Lleva una respuesta a la forma del modo niña: ≤ 60 palabras, frases ≤ 15
 * palabras, sin binomios latinos, sin palabras técnicas, sin el lugar del perfil.
 * @param {string} text
 * @returns {string}
 */
export function ajustarRespuestaNina(text) {
  const plano = limpiarMarkdown(text)
    // Paréntesis: suelen traer el binomio o la sigla. Fuera.
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plano) return RESPUESTA_NINA_VACIA;
  const frases = segmentarOraciones(plano);
  const salida = [];
  let total = 0;
  for (const original of frases) {
    if (tieneBinomio(original) || RE_TECNICO.test(original) || RE_LUGAR_PERFIL.test(original)) continue;
    if (/\?$/.test(original) && salida.length === 0) continue; // no abrir con pregunta de vuelta
    const frase = acortarFrase(original);
    if (!frase) continue;
    const n = palabras(frase).length;
    if (total + n > MAX_PALABRAS) break;
    salida.push(frase);
    total += n;
    if (salida.length >= 4) break;
  }
  return salida.length ? salida.join(' ') : RESPUESTA_NINA_VACIA;
}

export default { esModoNina, activarModoNinaSesion, ajustarRespuestaNina, MODO_NINA_PROMPT };
