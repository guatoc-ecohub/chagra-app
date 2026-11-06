/**
 * Query-only helpers shared by boot-time services and the lazy chat guards.
 *
 * This module intentionally contains only normalization, intent classification,
 * and entity-noise filtering. Output safety guards remain in outputGuards.js.
 *
 * @module outputGuardQueryUtils
 */

export const stripDiacritics = (value) =>
  (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

const PRICE_INTENT_PATTERNS = [
  /\ba\s+como\s+(esta|estan|va|van|vale|valen)\b/,
  /\bcuanto\s+(vale|valen|cuesta|cuestan|sale|salen|pagan|esta\s+pagando)\b/,
  /\bque\s+precio\b/,
  /\bprecio[s]?\b/,
  /\bmercado[s]?\b/,
  /\bplaza\s+de\s+mercado\b/,
  /\b(donde|a\s+quien)\s+(puedo\s+)?(vendo|vender|comprar|compro)\b/,
  /\b(vendo|vender|venta|comprar|compra|comprador|comercializ)\w*\b/,
  /\bcosecha\s+para\s+(vender|venta)\b/,
  /\bbulto[s]?\s+(de|a)\b/,
  /\barroba[s]?\s+(de|a)\b/,
  /\bcarga[s]?\s+(de|a)\b/,
  /\bcarga\s+de\b/,
  /\b(el|la|los|las|una?|cuantas?)\s+(arroba|bulto|carga)[s]?\b/,
];

const CARBON_INTENT_PATTERNS = [
  /\b(bonos?\s+(de\s+)?carbono|carbono\s+neutral|creditos?\s+(de\s+)?carbono)\b/,
  /\b(me\s+quieren\s+pagar\s+por\s+sembrar|pagar\s+por\s+sembrar\s+arboles|pago\s+por\s+carbono)\b/,
  /\b(psa|pago\s+por\s+servicios?\s+ambientales?|decreto\s+1007)\b/,
];

const RESTORATION_INTENT_PATTERNS = [
  // RA5: sin tildes «restauración» es «restauracion»; `restaura[cçr]\b` no lo
  // reconocía (ni «reforestación»). Se cubren las familias enteras.
  /\b(restaur(?!ante)\w*|reforest\w*|recuperar\s+(el\s+|la\s+)?(monte|bosque|terreno|suelo|lote|ronda)|regenera(r|cion)\w*)\b/,
  /\b(arbol(es)?\s+nativ[oa]s?|especies?\s+nativ[oa]s?|nativ[oa]s?\s+(de|para|a)\b)/,
  /\b(p[aá]ramo|frailej[oó]n|sucesi[oó]n\s+(ecol[oó]gica|natural)|corredor\s+(biol[oó]gico|ripario)|cerca\s+viva)\b/,
  /\b(sembrar|plantar)\s+(pino|eucalipto|cedro|roble|aliso|nacedero|guadua)\b/,
  /\b(proteger\s+(el\s+)?nacimiento|restaurar\s+la\s+quebrada|controlar\s+(la\s+)?erosion|barrera[s]?\s+viva[s]?)\b/,
];

const PLANTING_INTENT_PATTERNS = [
  /\bsiembr\w*\b/,
  /\bsembr\w*\b/,
  /\bplant\w*\b/,
  /\bcultiv\w*\b/,
  /\bpropag\w*\b/,
  /\bque\s+(cultivo|siembr|planto|cultivar)\b/,
  /\bque\s+(puedo|debo|deberia)\s+(sembrar|plantar|cultivar)\b/,
  /\bsemilla[s]?\b/,
  /\b(me\s+)?(conviene|sirve|recomienda[sn]?)\s+sembrar\b/,
  /\bviable[s]?\b/,
  /\bmsnm\b/,
  /\baltitud\b/,
  /\ben\s+mi\s+finca\b/,
];

/**
 * Classifies the user's query without loading any output safety tables.
 * @param {string|null|undefined} userMessage
 * @returns {'restauracion'|'carbono'|'siembra'|'precio'|'unknown'}
 */
export function classifyQueryIntent(userMessage) {
  if (typeof userMessage !== 'string') return 'unknown';
  const norm = stripDiacritics(userMessage);
  if (!norm) return 'unknown';
  if (RESTORATION_INTENT_PATTERNS.some((re) => re.test(norm))) return 'restauracion';
  if (CARBON_INTENT_PATTERNS.some((re) => re.test(norm))) return 'carbono';
  if (PLANTING_INTENT_PATTERNS.some((re) => re.test(norm))) return 'siembra';
  if (PRICE_INTENT_PATTERNS.some((re) => re.test(norm))) return 'precio';
  return 'unknown';
}

const NLU_NOISE_MENTIONS = new Set([
  'aqui', 'aca', 'alla', 'alli', 'ahi', 'ahy',
  'don', 'dona', 'sumerce', 'su merced', 'vea', 'mano', 'mijo', 'mija', 'mka',
  'pues', 'bueno', 'oiga', 'oye', 'hombre', 'senor', 'senora',
  'pasto', 'monte', 'hierba', 'yerba', 'mata', 'planta', 'arbol', 'palo',
  'ica', 'sena', 'agrosavia', 'corpoica', 'mads', 'ideam', 'icontec', 'dane',
  'cenicafe', 'fao', 'minagricultura', 'umata', 'car', 'cvc', 'invima', 'upra',
  'fuente', 'fuentes', 'entidad', 'entidades', 'norma', 'normativa',
  'resolucion', 'decreto', 'ley', 'cartilla', 'referencia', 'recomendacion',
]);

/**
 * Removes resolver entities whose complete user mention is known NLU noise.
 * @param {Array<object>|null} entities
 * @returns {Array<object>}
 */
export function filterNoiseEntities(entities) {
  if (!Array.isArray(entities)) return [];
  return entities.filter((entity) => {
    if (!entity || typeof entity !== 'object') return false;
    const mentioned = stripDiacritics(entity.mentioned || '').replace(/\s+/g, ' ').trim();
    if (!mentioned) return true;
    return !NLU_NOISE_MENTIONS.has(mentioned);
  });
}
