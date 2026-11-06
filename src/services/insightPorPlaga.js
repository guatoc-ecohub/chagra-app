// SPDX-License-Identifier: AGPL-3.0-only
/**
 * insightPorPlaga — card de la PLAGA nombrada en la pregunta.
 *
 * En un turno de cogollero la card ofrecida tiene que ser la del cogollero, no
 * la primera del cultivo (auditoría 2026-10-04: turno de cogollero con una card
 * de milpa o de otra plaga). Va antes que la elección por cultivo de
 * useInsightProactivo. Las cards de plaga que no deben salir en turnos genéricos
 * del cultivo viven aparte (agro-insight-cards-plaga.json), así elegirInsight
 * nunca las ve.
 *
 * @module insightPorPlaga
 */
import cardsCultivo from '../data/agro-insight-cards.json';
import cardsPlaga from '../data/agro-insight-cards-plaga.json';

const CARDS = [...cardsPlaga, ...cardsCultivo];

const _norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const CULTIVOS = {
  cafe: /\b(cafe|cafeto|cafetal|coffea)\b/,
  papa: /\b(papa|patata|solanum tuberosum)\b/,
  maiz: /\b(maiz|zea mays)\b/,
  tomate: /\btomate\b/,
  frijol: /\bfrijol\b/,
  aguacate: /\b(aguacate|persea)\b/,
  cacao: /\bcacao\b/,
};
const TEMA_CARD = {
  'cafe-recoleccion-sanitaria': /\b(broca|hypothenemus)\b/,
  'cafe-variedades-resistentes-roya': /\b(roya|hemileia)\b/,
  'cafe-guamo-sombra': /\b(sombra|sombrio)\b/,
  'papa-baculovirus-polilla': /\b(polilla|tecia)\b/,
  'papa-beauveria-gusano-blanco': /\bgusano blanco\b|\bpremnotrypes\b/,
};

export function insightCoincideConPregunta(card, question) {
  if (!card) return false;
  const text = _norm(question);
  const cultivos = Object.entries(CULTIVOS).filter(([, re]) => re.test(text)).map(([slug]) => slug);
  if (cultivos.length && (cultivos.length !== 1 || cultivos[0] !== card.entity_slug)) return false;
  const topic = TEMA_CARD[card.id];
  return topic ? topic.test(text) : Array.isArray(card.plaga_claves)
    && card.plaga_claves.some(kw => new RegExp(`\\b${_norm(kw)}\\b`).test(text));
}

// No general crop fallback: absence of a relevant card is a valid result.
export function elegirInsightDelTurno(question, seen = []) {
  return CARDS.find(card => !seen.includes(card.id) && insightCoincideConPregunta(card, question)) || null;
}

/**
 * Card curada cuya `plaga_claves` aparece en el texto, si no se ha visto ya.
 *
 * @param {string} texto  pregunta del usuario.
 * @param {string[]} [insightsVistos]
 * @returns {object|null}
 */
export function elegirInsightPorPlaga(texto, insightsVistos = []) {
  if (!texto || typeof texto !== 'string') return null;
  const t = _norm(texto);
  return CARDS.find(
    (c) => Array.isArray(c.plaga_claves)
      && !insightsVistos.includes(c.id)
      && insightCoincideConPregunta(c, texto)
      && c.plaga_claves.some((kw) => new RegExp(`\\b${_norm(kw)}`).test(t)),
  ) || null;
}
