// SPDX-License-Identifier: AGPL-3.0-only

function normalizeEntityName(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function commonNameAliases(value) {
  const names = Array.isArray(value) ? value : [value];
  return names.flatMap((name) => typeof name === 'string' ? name.split('/') : [])
    .map(normalizeEntityName)
    .filter(Boolean);
}

function confidenceOf(entity) {
  const confidence = Number(entity?.confidence);
  return Number.isFinite(confidence) ? confidence : Number.NEGATIVE_INFINITY;
}

function bestByConfidence(entities) {
  return entities.reduce((best, entity) => (
    !best || confidenceOf(entity) > confidenceOf(best) ? entity : best
  ), null);
}

/**
 * Keeps one canonical result for each mention from the resolver. A confidence
 * of 1 wins first; an exact common-name match wins over fuzzy aliases; otherwise
 * the highest-confidence entity wins. Entities without a mention are retained
 * because they cannot be grouped safely.
 *
 * @param {Array<object>|null|undefined} entities
 * @returns {Array<object>}
 */
export function selectBestEntityPerMention(entities) {
  if (!Array.isArray(entities) || entities.length === 0) return [];

  const groups = new Map();
  for (const entity of entities) {
    const mention = normalizeEntityName(entity?.mentioned);
    if (!mention) continue;
    const group = groups.get(mention) || [];
    group.push(entity);
    groups.set(mention, group);
  }

  const selected = new Set();
  for (const [mention, group] of groups) {
    const certain = group.filter((entity) => confidenceOf(entity) === 1);
    const exact = group.filter((entity) => commonNameAliases(entity?.nombre_comun)
      .includes(mention));
    selected.add(bestByConfidence(certain.length > 0 ? certain : exact.length > 0 ? exact : group));
  }

  return entities.filter((entity) => !normalizeEntityName(entity?.mentioned) || selected.has(entity));
}
