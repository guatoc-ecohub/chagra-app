// SPDX-License-Identifier: AGPL-3.0-only
/**
 * preguntasBasicasResponder.js — respuestas fijas a preguntas de aprender que
 * el modelo responde mal por rellenar huecos con otra ficha.
 *
 * Re-auditoría RA2 2026-10-07 (N14): a «¿por qué son importantes las abejas?»
 * el agente traía la ficha `animal_diagnostic` y escribía «la apícola
 * (melipona)», «el agroecología» y «cultivos que requieren forraje específico…
 * según el tipo animal consumidor», con 106 a 149 palabras. Criterio: menos de
 * 80 palabras, la polinización en una frase y un ejemplo de fruta.
 *
 * Precisión alta, como safetyIntentResponder: solo la pregunta general por la
 * importancia de las abejas. «¿cómo cuido mis abejas?» o «¿qué flores siembro
 * para las abejas?» siguen al flujo normal.
 *
 * Puro y sin red. Sin rayas largas en el copy.
 */

function norm(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:"«»()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const RE_ABEJAS_IMPORTANCIA = new RegExp([
  '\\bpor que (son|es|seran) (tan )?importantes? (las |los )?(abejas?|abejitas?|polinizadores?)\\b',
  '\\bpor que (las |los )?(abejas?|abejitas?|polinizadores?) (son|es) (tan )?importantes?\\b',
  '\\b(para que sirven|que hacen|de que sirven) (las |los )?(abejas|abejitas|polinizadores)\\b',
  '\\b(cual es la |la )?importancia de (las |los )?(abejas|abejitas|polinizadores)\\b',
].join('|'));

// Frases de 15 palabras o menos: así vale igual en modo niña (modoNina.js).
export const RESPUESTA_ABEJAS_IMPORTANCIA = [
  'Las abejas son importantes porque llevan el polen de una flor a otra.',
  'Eso se llama polinización, y así muchas plantas forman sus frutos y semillas.',
  'Por ejemplo, la fresa, el aguacate y el maracuyá dan más frutos con abejas.',
  'Por eso conviene cuidarlas: sembrar flores y no usar venenos cerca de ellas.',
].join(' ');

/**
 * @param {string} text texto crudo del usuario
 * @returns {{ kind: string, content: string }|null}
 */
export function buildPreguntaBasicaResponse(text) {
  const n = norm(text);
  if (!n) return null;
  if (RE_ABEJAS_IMPORTANCIA.test(n)) {
    return { kind: 'abejas_importancia', content: RESPUESTA_ABEJAS_IMPORTANCIA };
  }
  return null;
}

export default { buildPreguntaBasicaResponse };
