/**
 * agentEntityFocus.js — el cultivo de la PREGUNTA manda sobre el historial.
 *
 * Problema medido en producción (hard-test del caso invernadero de tomate,
 * 2026-10-31, filas D-25 y D-37):
 *   - `resolveEntities` envía el historial pegado delante del mensaje actual
 *     («Conversación previa… Mensaje actual: …»). El sidecar resuelve TODO lo
 *     que aparece ahí, así que a «¿Cómo se cultiva el calabacín…?» le llegaban
 *     `zea_mays`, `phaseolus_vulgaris` y `passiflora_edulis` de turnos
 *     anteriores, y la respuesta terminó hablando de maíz.
 *   - «tomate» sin calificativo salía como `solanum_betaceum` (tomate de
 *     árbol), el único de la familia cuyo rango altitudinal cubre 2200 msnm.
 *
 * Este módulo corrige la salida del sidecar en el cliente, sin red:
 *   1. `focusEntitiesOnCurrentMessage`: si el mensaje actual nombra una especie
 *      (o una plaga), se descartan las especies (o plagas) que solo vienen del
 *      historial. Si el mensaje actual no nombra ninguna («¿y qué plagas
 *      tiene?»), el historial se conserva: es una pregunta de seguimiento.
 *   2. `applyCommonNameLexicon`: los nombres comunes ambiguos de la tabla
 *      `COMMON_NAME_LEXICON` se fijan al id canónico del grafo.
 *   3. `anchorToolArgsToEntities`: los argumentos de herramienta que nombran
 *      una entidad ya resuelta pasan a llevar su `canonical_id`.
 *
 * Los ids y nombres de la tabla salen del grafo AGE (`chagra_kg`), exportado en
 * `catalog/chagra-kg-graph-snapshot.json` (nodos :Species con esos ids).
 */

/** Minúsculas, sin tildes, espacios colapsados. */
export function normEntityText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ_\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SPECIES_KINDS = new Set(['cultivo', 'especie', 'species', 'planta']);
const PEST_KINDS = new Set(['pest', 'plaga']);

function entityGroup(e) {
  const k = String(e?.kind || '').toLowerCase();
  if (SPECIES_KINDS.has(k)) return 'species';
  if (PEST_KINDS.has(k)) return 'pest';
  return null;
}

// Calificativos que, detrás de «tomate», nombran OTRA variedad o especie: con
// ellos «tomate» no es el tomate genérico.
const TOMATE_CALIFICATIVOS = '(?:de arbol|cherry|cereza|san marzano|sungold|uvalina|de alino|milano|larga vida)';

/**
 * Nombres comunes ambiguos → id canónico del grafo. El orden importa: las
 * formas más largas van primero y consumen su tramo del texto, para que
 * «tomate de árbol» no cuente además como «tomate».
 */
export const COMMON_NAME_LEXICON = [
  {
    key: 'tomate_de_arbol',
    re: /\b(?:tomates? de arbol|tamarillos?)\b/g,
    canonical_id: 'solanum_betaceum',
    nombre_comun: 'Tomate de árbol / Tamarillo',
    nombre_cientifico: 'Solanum betaceum Cav.',
  },
  {
    key: 'tomate_cherry',
    re: /\b(?:tomates? cherry|tomatitos? cherry)\b/g,
    canonical_id: 'solanum_lycopersicum_cerasiforme',
    nombre_comun: 'Tomate cherry',
    nombre_cientifico: 'Solanum lycopersicum var. cerasiforme',
  },
  {
    key: 'tomate',
    // «tomate» o «tomate chonto», salvo que lo siga otro calificativo.
    re: new RegExp(`\\btomates?(?: chonto)?\\b(?! ${TOMATE_CALIFICATIVOS}\\b)`, 'g'),
    canonical_id: 'solanum_lycopersicum',
    nombre_comun: 'Tomate',
    nombre_cientifico: 'Solanum lycopersicum L.',
  },
  {
    key: 'calabacin',
    re: /\b(?:calabacin(?:es)?|zucchinis?|zuquinis?)\b/g,
    canonical_id: 'cucurbita_pepo',
    nombre_comun: 'Calabacín / Zucchini',
    nombre_cientifico: 'Cucurbita pepo L.',
  },
];

const LEXICON_BY_ID = new Map(COMMON_NAME_LEXICON.map((l) => [l.canonical_id, l]));

/**
 * Busca en el texto los nombres de la tabla. Devuelve los aciertos con su
 * tramo; los tramos no se solapan (gana la forma más larga, por orden).
 * @param {string} text
 * @returns {Array<{ key: string, canonical_id: string, text: string, start: number, end: number }>}
 */
export function findLexiconMentions(text) {
  const t = normEntityText(text);
  const taken = [];
  const hits = [];
  for (const entry of COMMON_NAME_LEXICON) {
    entry.re.lastIndex = 0;
    let m;
    while ((m = entry.re.exec(t)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (!taken.some(([a, b]) => start < b && end > a)) {
        taken.push([start, end]);
        hits.push({ key: entry.key, canonical_id: entry.canonical_id, text: m[0], start, end });
      }
      if (m[0].length === 0) entry.re.lastIndex += 1;
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

/**
 * Resuelve una mención suelta (lo que el usuario escribió, o el argumento de
 * una herramienta) contra la tabla. Solo acierta si TODO el texto es el nombre.
 * @param {string} text
 * @returns {null | typeof COMMON_NAME_LEXICON[number]}
 */
export function lexiconEntryFor(text) {
  const t = normEntityText(text);
  if (!t) return null;
  const hits = findLexiconMentions(t);
  if (hits.length !== 1 || hits[0].text !== t) return null;
  return LEXICON_BY_ID.get(hits[0].canonical_id) || null;
}

function containsWords(haystackNorm, needle) {
  const n = normEntityText(needle);
  if (!n || n.length < 3) return false;
  return (` ${haystackNorm} `).includes(` ${n} `);
}

/** ¿El mensaje actual nombra esta entidad? */
function isMentionedIn(entity, messageNorm, lexiconIds) {
  if (lexiconIds.has(entity?.canonical_id)) return true;
  if (containsWords(messageNorm, entity?.mentioned)) return true;
  if (containsWords(messageNorm, entity?.canonical_id?.replace(/_/g, ' '))) return true;
  return false;
}

/**
 * Descarta las especies/plagas que solo vienen del historial cuando el mensaje
 * actual nombra las suyas. Las demás clases de entidad no se tocan.
 * @param {Array<object>} entities
 * @param {string} currentMessage — SOLO el mensaje actual, sin historial.
 * @returns {Array<object>}
 */
export function focusEntitiesOnCurrentMessage(entities, currentMessage) {
  if (!Array.isArray(entities) || entities.length === 0) return Array.isArray(entities) ? entities : [];
  const messageNorm = normEntityText(currentMessage);
  if (!messageNorm) return entities;
  const hits = findLexiconMentions(messageNorm);
  const lexiconIds = new Set(hits.map((h) => h.canonical_id));
  const current = new Map(entities.map((e) => [e, isMentionedIn(e, messageNorm, lexiconIds)]));
  // Un nombre del léxico en la pregunta también vale como mención de su grupo
  // aunque el sidecar lo haya resuelto mal: «tomate» → solanum_betaceum.
  const lexMentioned = (e) => {
    const m = normEntityText(e?.mentioned);
    return !!m && hits.some((h) => h.text.includes(m));
  };
  const groupHasCurrent = { species: false, pest: false };
  for (const e of entities) {
    const g = entityGroup(e);
    if (g && (current.get(e) || lexMentioned(e))) groupHasCurrent[g] = true;
  }
  return entities.filter((e) => {
    const g = entityGroup(e);
    if (!g || !groupHasCurrent[g]) return true;
    return current.get(e) || lexMentioned(e);
  });
}

// Campos que describen a UNA especie concreta: al cambiar el id ya no valen.
const SPECIES_SPECIFIC_FIELDS = [
  'altitud_min', 'altitud_max', 'piso_termico', 'temp_min', 'temp_max',
  'viabilidad', 'delta_altitud', 'companions', 'antagonists',
  'alternativas_viables', 'alternativas_cercanas', 'categoria',
  'es_invasora', 'conservation_status', 'source', 'validation_level',
];

/**
 * Fija al id canónico los nombres ambiguos del mensaje actual. Una entidad cuyo
 * `mentioned` cae dentro de una mención del léxico y cuyo id no coincide se
 * reescribe con el id correcto (y sin los datos de la especie equivocada).
 * Si al final quedan dos entidades con el mismo id, se conserva la primera.
 * @param {Array<object>} entities
 * @param {string} currentMessage
 * @returns {Array<object>}
 */
export function applyCommonNameLexicon(entities, currentMessage) {
  if (!Array.isArray(entities) || entities.length === 0) return Array.isArray(entities) ? entities : [];
  const hits = findLexiconMentions(currentMessage);
  if (hits.length === 0) return entities;
  const out = entities.map((e) => {
    if (entityGroup(e) !== 'species') return e;
    const m = normEntityText(e?.mentioned);
    if (!m) return e;
    // Mención exacta primero; si no, la única mención del léxico que la
    // contenga («tomate» dentro de «tomate de arbol»). Con dos candidatas
    // distintas no se toca.
    let candidates = hits.filter((h) => h.text === m);
    if (candidates.length === 0) candidates = hits.filter((h) => h.text.includes(m));
    const ids = [...new Set(candidates.map((h) => h.canonical_id))];
    if (ids.length !== 1) return e;
    const entry = LEXICON_BY_ID.get(ids[0]);
    if (!entry || e.canonical_id === entry.canonical_id) return e;
    const fixed = { ...e };
    for (const f of SPECIES_SPECIFIC_FIELDS) delete fixed[f];
    fixed.canonical_id = entry.canonical_id;
    fixed.nombre_comun = entry.nombre_comun;
    fixed.nombre_cientifico = entry.nombre_cientifico;
    fixed.corrected_from = e.canonical_id;
    fixed.correction = 'lexico_nombre_comun';
    return fixed;
  });
  const seen = new Set();
  return out.filter((e) => {
    const id = e?.canonical_id;
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/**
 * Las dos correcciones en orden: primero el foco (quita el historial que no
 * pertenece a la pregunta), después el léxico.
 * @param {Array<object>} entities
 * @param {string} currentMessage
 */
export function refineResolvedEntities(entities, currentMessage) {
  return applyCommonNameLexicon(focusEntitiesOnCurrentMessage(entities, currentMessage), currentMessage);
}

// Argumentos de herramienta que nombran una entidad. El valor es el grupo que
// puede ocupar ese argumento; `any` acepta especie o plaga.
const ANCHORABLE_ARGS = {
  id_or_name: 'species',
  species_id: 'species',
  species: 'species',
  especie: 'species',
  cultivo: 'species',
  crop: 'species',
  pest: 'pest',
  pest_id: 'pest',
  plaga: 'pest',
  species_id_or_pest: 'any',
};

/** Mención/nombre normalizados por los que se reconoce una entidad. */
function entityNames(e) {
  const names = [e?.mentioned, e?.canonical_id, e?.canonical_id?.replace(/_/g, ' ')];
  for (const part of String(e?.nombre_comun || '').split('/')) names.push(part);
  return names.map(normEntityText).filter(Boolean);
}

/**
 * Cambia por el `canonical_id` todo argumento de herramienta que nombre una
 * entidad ya resuelta: «calabacin» → `cucurbita_pepo`, «trozador» → el id de
 * la plaga. Un argumento que no corresponde a ninguna entidad se deja igual.
 * @param {object} args
 * @param {Array<object>|null} entities — las ya refinadas por la pregunta.
 * @returns {object} args nuevos (o los mismos si no hubo cambio).
 */
export function anchorToolArgsToEntities(args, entities) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return args;
  if (!Array.isArray(entities) || entities.length === 0) return args;
  let changed = false;
  const next = { ...args };
  for (const [key, group] of Object.entries(ANCHORABLE_ARGS)) {
    const value = next[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    const v = normEntityText(value);
    const pool = entities.filter((e) => e?.canonical_id && (group === 'any' ? entityGroup(e) : entityGroup(e) === group));
    if (pool.some((e) => e.canonical_id === value)) continue;
    const match = pool.find((e) => entityNames(e).includes(v));
    if (match) {
      next[key] = match.canonical_id;
      changed = true;
      continue;
    }
    // Un nombre ambiguo de la tabla («tomate») que el sidecar no resolvió.
    const lex = group !== 'pest' ? lexiconEntryFor(value) : null;
    if (lex && pool.some((e) => e.canonical_id === lex.canonical_id)) {
      next[key] = lex.canonical_id;
      changed = true;
    }
  }
  return changed ? next : args;
}

/**
 * Igual que `anchorToolArgsToEntities`, sobre una cadena `[{ tool, args }]`.
 * @param {Array<{tool: string, args: object}>} chain
 * @param {Array<object>|null} entities
 */
export function anchorToolChainToEntities(chain, entities) {
  if (!Array.isArray(chain)) return chain;
  return chain.map((step) => {
    if (!step || typeof step !== 'object') return step;
    const args = anchorToolArgsToEntities(step.args, entities);
    return args === step.args ? step : { ...step, args };
  });
}
