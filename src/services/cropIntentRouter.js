/**
 * Routing determinístico para preguntas generales de selección de cultivos.
 * Las consultas de daño, asociación y calendario conservan sus rutas propias.
 */

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const DAMAGE_QUERY_RE =
  /\b(?:hojas?\s+(?:mordid\w*|perforad\w*|comid\w*)|mordid\w*|mordisque\w*|huecos?|agujeros?|perforad\w*|se\s+(?:me\s+)?(?:esta|estan)\s+comiendo\b[^.!?\n]{0,45}\b(?:hojas?|planta|cultivo|frutos?)\b)/;
const ASSOCIATION_QUERY_RE =
  /\b(?:asoci\w*|compani\w*|junto\s+a|al\s+lado\s+de|acompan\w*|intercal\w*)\b/;
const PLANTING_TIME_QUERY_RE =
  /\b(?:cuando|fecha|epoca|temporada|mes)\b[^.!?\n]{0,55}\b(?:sembr\w*|plant\w*|cultiv\w*)\b/;

const WHAT_TO_PLANT_RE =
  /\bque\b[^.!?\n]{0,40}\b(?:puedo|podria|conviene|recomiend\w*)\b[^.!?\n]{0,24}\b(?:sembrar|plantar|cultivar)\b/;
const CROP_FIT_RE =
  /\bque\s+(?:cultivos?|plantas?)\b[^.!?\n]{0,55}\b(?:me\s+sirven|sirven|viables?|se\s+dan|son\s+apt\w*|van\s+bien|recomiend\w*)\b|\b(?:cultivos?|plantas?)\s+(?:viables?|adecuad\w*|para\s+mi\s+finca)\b/;
const BROAD_FOOD_SOWING_RE =
  /\b(?:quiero|quisiera|me\s+gustaria|pienso|voy\s+a)\b[^.!?\n]{0,40}\b(?:sembrar|plantar|cultivar)\b[^.!?\n]{0,35}\b(?:algo|comida|alimentos?)\b/;
const RECOMMENDED_SOWING_RE =
  /\bque\s+me\s+recomiend\w*\b[^.!?\n]{0,45}\b(?:sembrar|cultivo|plantas?)\b/;

/**
 * @param {string} userMessage
 * @returns {null | {tool: 'get_cultivos_viables', args: {}, source: string}}
 */
export function planCropIntent(userMessage) {
  if (typeof userMessage !== 'string' || !userMessage.trim()) return null;

  const query = normalize(userMessage);
  if (DAMAGE_QUERY_RE.test(query) || ASSOCIATION_QUERY_RE.test(query) || PLANTING_TIME_QUERY_RE.test(query)) {
    return null;
  }

  let source = null;
  if (WHAT_TO_PLANT_RE.test(query)) source = 'crop_discovery_question';
  else if (CROP_FIT_RE.test(query)) source = 'crop_fit_question';
  else if (BROAD_FOOD_SOWING_RE.test(query)) source = 'broad_food_sowing_request';
  else if (RECOMMENDED_SOWING_RE.test(query)) source = 'recommended_sowing_request';

  return source ? { tool: 'get_cultivos_viables', args: {}, source } : null;
}
