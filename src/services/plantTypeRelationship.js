/**
 * farmOS exige `plant_type` en todo asset--plant (422 «This value should not
 * be null» si falta). La «Variedad» del formulario es opcional, así que el
 * término sale de la variedad si la hay y, si no, de la especie elegida.
 * Si ya existe un término con ese nombre se referencia por id, para no crear
 * un duplicado en la taxonomía compartida en cada siembra.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');

/**
 * @param {{plantType?: string, name?: string}} formData
 * @param {Array<{id?: string, type?: string, attributes?: {name?: string}}>} [terms]
 * @returns {{data: Array<Object>} | null}
 */
export function buildPlantTypeRelationship(formData, terms = []) {
  const name = String(formData?.plantType || '').trim() || String(formData?.name || '').trim();
  if (!name) return null;
  const wanted = normalize(name);
  const existing = (Array.isArray(terms) ? terms : []).find((term) =>
    UUID_RE.test(term?.id || '')
    && term.type === 'taxonomy_term--plant_type'
    && normalize(term.attributes?.name) === wanted);
  if (existing) {
    return { data: [{ type: 'taxonomy_term--plant_type', id: existing.id }] };
  }
  return { data: [{ type: 'taxonomy_term--plant_type', attributes: { name } }] };
}
