import { LAMINAS_CATALOGO } from '../visual/laminas/laminasCatalogo.js';

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

/** Evidencia del turno, nunca texto libre ni argumentos propuestos por el modelo.
 * Especies: binomio canónico con confianza >= 0.8 o resultado get_species.
 * Conceptos: aplica_a exacto del registro, resuelto con confianza >= 0.8.
 * Un concepto genérico no demuestra la proposición completa de una lámina.
 */
export function eligibleLaminas({ resolvedEntities = [], toolEvidence = null } = {}) {
  const entities = Array.isArray(resolvedEntities) ? resolvedEntities : [];
  const facts = entities.filter((e) => isRecord(e) && Number.isFinite(e.confidence)
    && e.confidence >= 0.8 && e.confidence <= 1 && e.canonical_id
    && ![e.low_confidence, e.suggested, e.fuzzy, e.ambiguous].some(Boolean));
  const evidence = Array.isArray(toolEvidence) ? toolEvidence : [toolEvidence];
  const species = evidence.filter((ev) => ev?.tool === 'get_species'
    && isRecord(ev.result) && ev.result.found === true && !ev.result._error && !ev.result.error)
    .map((ev) => ev.result.species ?? ev.result)
    .filter((s) => isRecord(s) && s.found !== false && !s._error && !s.error);
  return Object.keys(LAMINAS_CATALOGO).filter((slug) => {
    const meta = LAMINAS_CATALOGO[slug];
    if (meta.lock === 'especie') {
      return [...facts, ...species].some((e) => e.nombre_cientifico === meta.aplica_a);
    }
    return facts.some((e) => e.canonical_id === meta.aplica_a);
  });
}

/** Las tres reglas del gate. Salida serializable o null, sin efectos laterales. */
export function resolveTurnLamina(candidate, turn = {}) {
  if (!isRecord(candidate) || Object.keys(candidate).some((k) => !['slug', 'props'].includes(k))) return null;
  const { slug, props = {} } = candidate;
  if (typeof slug !== 'string' || !owns(LAMINAS_CATALOGO, slug) || !isRecord(props)) return null;
  const allowed = LAMINAS_CATALOGO[slug].props;
  if (Object.entries(props).some(([key, value]) => !owns(allowed, key) || !allowed[key].includes(value))) return null;
  if (!eligibleLaminas(turn).includes(slug)) return null;
  return { slug, props: { ...props } };
}

/** Solo ofrece elecciones que ya tienen evidencia; ninguna herramienta sin ella. */
export function buildLaminaTool(turn) {
  const slugs = eligibleLaminas(turn);
  if (!slugs.length) return null;
  return {
    type: 'function',
    function: {
      name: 'dibujar_lamina',
      description: 'Adjunta como máximo una lámina local si ayuda a explicar la pregunta actual. '
        + 'No la uses para saludos, registros ni temas distintos. Puedes no elegir ninguna. '
        + 'Nunca generes SVG, HTML, imágenes ni código. Opciones verificadas: '
        + JSON.stringify(slugs.map((slug) => ({ slug, aplica_a: LAMINAS_CATALOGO[slug].aplica_a, props: LAMINAS_CATALOGO[slug].props }))),
      parameters: {
        type: 'object', additionalProperties: false, required: ['slug'],
        properties: {
          slug: { type: 'string', enum: slugs },
          props: {
            type: 'object', additionalProperties: false,
            properties: Object.fromEntries(slugs.flatMap((slug) => Object.entries(LAMINAS_CATALOGO[slug].props))
              .map(([key, values]) => [key, { type: 'string', enum: values }])),
          },
        },
      },
    },
  };
}

/** Una selección por turno. Duplicadas, ambiguas o malformadas: ninguna. */
export function laminaFromToolCalls(toolCalls, turn) {
  const calls = Array.isArray(toolCalls) ? toolCalls.filter((tc) => tc?.function?.name === 'dibujar_lamina') : [];
  if (calls.length !== 1) return null;
  let candidate = calls[0].function.arguments;
  if (typeof candidate === 'string') {
    try { candidate = JSON.parse(candidate); } catch { return null; }
  }
  return resolveTurnLamina(candidate, turn);
}
