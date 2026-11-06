// SPDX-License-Identifier: AGPL-3.0-only
// Retrieval intent only: negated agricultural actions remain searchable warnings.
const STOP = new Set('de del la el los las un una al con en para por y manejo control agroecologico agroecologica integrado ficha fichas informacion sobre'.split(' '));
const normalize = text => String(text ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const terms = text => (normalize(text).match(/[a-z0-9]+/g) || []).filter(t => !STOP.has(t));

/** Conservative, clause-bounded exclusions. Unknown constructions keep retrieval intact. */
export function parseRetrievalExclusions(query) {
  const clauses = normalize(query).split(/[;,.!?:¿¡]+|\b(?:pero|sino)\b|\by\s+(?=(?:necesito|quiero|busco|muestreme)\b)/);
  const exclusions = [];
  let cancel = false;
  let positiveRequest = false;
  for (const raw of clauses) {
    const clause = raw.trim();
    if (/^(?:necesito|quiero|busco|muestreme|traigame)\b/.test(clause)) positiveRequest = true;
    // Cancellation needs a generic retrieval object, never an arbitrary topic.
    if (/^(?:no (?:me )?busque(?: (?:ninguna ficha|fichas|nada|tratamiento)(?: por ahora)?)?|no necesito informacion del .+ ni de otro cultivo|no quiero que me recomiende nada(?: todavia)?|no le estoy pidiendo una consulta|cancele la busqueda|no quiero resultados(?: de plantas)?)$/.test(clause)) {
      cancel = true;
      continue;
    }
    const match = clause.match(/^no (?:busco|(?:me )?busque)\s+(.+)$/)
      || clause.match(/^de\s+(.+?)\s+no me traiga nada$/)
      || clause.match(/^sin\s+(.+)$/);
    if (!match) continue;
    // A new positive request bounds the exclusion even without punctuation.
    const span = match[1].split(/\b(?:necesito|quiero|busco|muestreme)\b/)[0];
    for (const part of span.split(/\b(?:ni|y)\b/)) {
      const tokens = terms(part);
      if (tokens.length) exclusions.push(tokens);
    }
  }
  return { cancel: cancel && !positiveRequest, exclusions };
}

/** Identity comes from names/slug, never passage prose or expanded query synonyms. */
export function matchesRetrievalExclusion(identity, exclusions) {
  const identityTerms = new Set(terms(Array.isArray(identity) ? identity.join(' ') : identity));
  return exclusions.some(tokens => tokens.every(token => identityTerms.has(token)));
}
