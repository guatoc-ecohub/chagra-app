// SPDX-License-Identifier: AGPL-3.0-only
/**
 * fuenteDocumento — ¿una URL de fuente lleva a un DOCUMENTO o solo a la
 * portada de una institución?
 *
 * Re-auditoría RA3 2026-10-11 (R08): «Ver fuente» del cogollero llevaba a
 * https://www.agrosavia.co, la portada institucional. Una portada, una
 * búsqueda o un dominio sin ruta no dicen qué documento respalda el dato, así
 * que no cuentan como fuente verificada.
 *
 * @param {unknown} url
 * @returns {boolean}
 */
export function esUrlDeDocumento(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  let p;
  try {
    p = new URL(url.trim());
  } catch {
    return false;
  }
  if (p.protocol !== 'http:' && p.protocol !== 'https:') return false;
  const ruta = p.pathname.replace(/\/+$/, '');
  if (!ruta || /^\/(index|inicio|home)(\.\w+)?$/i.test(ruta)) return false;
  if (/\/(search|buscador|busqueda)(\/|$)/i.test(p.pathname)) return false;
  return true;
}

/** Texto que acompaña al dato cuando no hay documento citable. */
export const SIN_DOCUMENTO_CITABLE = 'Sin documento citable';

/**
 * Localizador legible de un documento: dominio y ruta, sin protocolo.
 * Los datos curados no traen página ni sección; la ruta del documento es lo
 * único que ubica el dato dentro de la fuente.
 * @param {unknown} url
 * @returns {string}
 */
export function localizadorDocumento(url) {
  if (!esUrlDeDocumento(url)) return '';
  const p = new URL(/** @type {string} */ (url).trim());
  return `${p.hostname.replace(/^www\./, '')}${p.pathname.replace(/\/+$/, '')}`;
}

/**
 * RA4 R08: una respuesta sin sello verde no puede decir en su cuerpo que sus
 * datos están «verificados». Quita el adjetivo (o la frase «según datos
 * verificados por/del…») y deja el resto del texto intacto.
 * @param {string} text
 * @returns {string}
 */
export function sinAfirmarVerificado(text) {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(/\b(datos?|informaci[oó]n|fuentes?|cifras?|dosis)\s+verificad[oa]s?\s+(por|del|de la|de los|de las)\b/gi, (_m, n, prep) => `${n} ${prep === 'por' ? 'de' : prep}`)
    .replace(/\b(datos?|informaci[oó]n|fuentes?|cifras?|dosis)\s+verificad[oa]s?\b/gi, '$1')
    .replace(/\b(est[aá]n?|es|fue|fueron)\s+verificad[oa]s?\b/gi, '$1 reportado')
    .replace(/[ \t]{2,}/g, ' ');
}
