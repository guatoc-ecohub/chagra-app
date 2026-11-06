// SPDX-License-Identifier: AGPL-3.0-only
/**
 * guardaPisoEspecie — frena especies recomendadas fuera de su rango altitudinal.
 *
 * Auditoría RA5 (PISOS-03/04): a 20 m en Montería el agente recomendó fresa
 * silvestre andina, lechuga y zanahoria; a 3.350 m en Vetas, crotalaria. Las
 * guardas existentes cubren una lista de cultivos escrita a mano; esta decide
 * por el RANGO del dato (catálogo v3.2, `rangosAltitudEspecies.json`), así que
 * vale para cualquier especie con rango, sin listas por nombre.
 *
 * Qué hace: si la respuesta recomienda sembrar o cultivar una especie cuyo
 * rango no incluye la altitud de la finca, ANTEPONE una corrección con el rango
 * y propone nativas de ese piso. No corrige menciones descriptivas, ejemplos ni
 * comparaciones, y no borra el texto del modelo.
 *
 * Anti-falso-positivo: no cuenta frases que niegan («no se da», «evite»), que
 * hablan de otro piso («en tierra fría…»), que traen otra altitud o que son
 * hipotéticas («si estuviera más arriba»).
 */
import {
  altitudValida,
  mencionesConRango,
  nombresNativasDelPiso,
  rangoDeEspecie,
  textoRango,
} from './pisoEspecies.js';
import RANGOS from '../data/rangosAltitudEspecies.json';
import { segmentarOraciones } from './respuestaCorta.js';

const FILAS_POR_ID = new Map(RANGOS.especies.map((fila) => [fila.id, fila]));

/** Normaliza carácter a carácter para que los índices coincidan con el original. */
function normAlineado(texto) {
  let out = '';
  for (const ch of String(texto)) {
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    out += base.length === ch.length ? base : ch.toLowerCase();
  }
  return out;
}

function normalizarNombre(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function contieneNombre(texto, nombre) {
  const phrase = normalizarNombre(nombre);
  if (!phrase) return false;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(normalizarNombre(texto));
}

function especiesGrounding(resolvedEntities, toolEvidence) {
  const porId = new Map();
  const agregar = (candidato) => {
    if (!candidato || typeof candidato !== 'object' || Array.isArray(candidato)) return;
    const cientifico = candidato.nombre_cientifico || candidato.nombre_científico || candidato.scientific_name;
    const id = candidato.id || candidato.canonical_id || candidato.canonicalId || candidato.species_id;
    const rango = rangoDeEspecie({ id, cientifico });
    if (!rango) return;
    const fila = FILAS_POR_ID.get(rango.id);
    if (!fila) return;
    const alias = [
      ...fila.n,
      fila.b,
      candidato.nombre_comun,
      candidato.nombre,
      candidato.mentioned,
    ].flatMap((nombre) => Array.isArray(nombre) ? nombre : [nombre])
      .filter((nombre) => typeof nombre === 'string' && nombre.trim())
      .map(normalizarNombre);
    const nombreComun = Array.isArray(candidato.nombre_comun)
      ? candidato.nombre_comun[0]
      : candidato.nombre_comun;
    const previo = porId.get(fila.id);
    porId.set(fila.id, {
      ...rango,
      nombres: new Set([...(previo?.nombres || []), ...alias]),
      display: previo?.display || nombreComun || fila.n[0] || fila.b,
    });
  };
  const agregarLista = (valor) => {
    for (const candidato of Array.isArray(valor) ? valor : [valor]) agregar(candidato);
  };

  agregarLista(resolvedEntities);
  for (const evidencia of Array.isArray(toolEvidence) ? toolEvidence : [toolEvidence]) {
    if (!evidencia || typeof evidencia !== 'object') continue;
    const resultado = evidencia.result || evidencia;
    agregarLista(resultado.species || resultado.especie || resultado.species_result);
    agregar(resultado);
  }
  return [...porId.values()];
}

function especiesResueltasParaConsulta(resolvedEntities, toolEvidence, userMessage) {
  const resueltas = especiesGrounding(resolvedEntities, toolEvidence);
  const consulta = normalizarNombre(userMessage);
  if (!consulta) return resueltas.length === 1 ? resueltas : [];
  return resueltas.filter((especie) => [...especie.nombres].some((nombre) => contieneNombre(consulta, nombre)));
}

function especieResueltaParaMencion(mencion, especies) {
  if (especies.length === 0) return null;
  const porNombre = especies.filter((especie) => [...especie.nombres].some((nombre) => contieneNombre(mencion.clave, nombre)));
  if (porNombre.length === 1) return porNombre[0];
  const porId = especies.filter((especie) => mencion.ids.includes(especie.id));
  return porId.length === 1 ? porId[0] : null;
}

/** Negación ANTES de la mención, en la misma frase («no siembre fresa»). */
const NEGACION_ANTES_RE = /\b(no|ni|nunca|jamas|tampoco|evit\w*|descart\w*|olvide\w*)\b|en\s+(vez|lugar)\s+de|en\s+cambio\s+de|ademas\s+de\s+no/;
/** Negación DESPUÉS de la mención que habla de ella («la fresa no se da aquí»). */
const NEGACION_DESPUES_RE = /^[^.;:]{0,40}?\b(no\s+(se\s+)?(da|dan|prospera\w*|sirve\w*|conviene\w*|crece\w*|aguanta\w*|es\s+(viable|de\s+su\s+piso|recomendable)|se\s+recomienda\w*|funciona\w*)|es\s+inviable|fracasa\w*|queda\s+fuera|fuera\s+de\s+(su\s+)?rango|no\s+le\s+sirve)/;
const VENTANA_ANTES = 60;
const OTRO_PISO_RE = /\b(tierra|clima|piso|zona)\s+(fri[oa]|caliente|calid[oa]|templad[oa]|medi[oa]|alta|baja)\b|\bparamo\b|\b(si|cuando)\s+(estuviera|tuviera|subiera|bajara|viviera|fuera)\b|\bmas\s+(arriba|abajo)\b|\ben\s+otr[ao]s?\s+(finca|piso|clima|zona|region)/;
const ALTITUD_RE = /(\d{1,2}[.,]\d{3}|\d{3,4})\s*(m\b|msnm|m\.?\s?s\.?\s?n\.?\s?m|metros)/g;

const MARCA = 'fuera del rango de altitud';

/**
 * Frases (y líneas de lista) de un texto, con su posición en el original. El
 * punto corta solo si lo sigue un espacio o el final: «1.800 m» no se parte.
 */
function frases(texto) {
  let desde = 0;
  return segmentarOraciones(texto, { separarPuntoYComa: true }).map((t) => {
    const i = texto.indexOf(t, desde);
    if (i >= 0) desde = i + t.length;
    return { t, i: i >= 0 ? i : desde };
  });
}

/** ¿La frase trae una altitud distinta de la de la finca? */
function hablaDeOtraAltitud(fraseNorm, alt) {
  for (const m of fraseNorm.matchAll(ALTITUD_RE)) {
    const n = Number(m[1].replace(/[.,]/g, ''));
    if (Number.isFinite(n) && Math.abs(n - alt) > 50) return true;
  }
  return false;
}

const ACCION_DE_SIEMBRA_RE = /\b(?:sembr\w*|siembr\w*|plant\w*|cultiv\w*|establec\w*)\b/;
const RECOMENDACION_DE_SIEMBRA_RE = /\b(?:sembr\w*|siembr\w*|plant\w*|cultiv\w*|establec\w*|recomiend\w*|considere\w*|conviene\w*|debe\w*|puede\w*|podr[ií]a\w*|mejor\s+(?:momento|[eé]poca)|recomendad\w*)\b/;
const EJEMPLO_O_COMPARACION_RE = /^(?:\s*(?:tal\s+como|por\s+ejemplo|p\.\s*ej\.|a\s+diferencia\s+de|en\s+comparaci[oó]n\s+con|al\s+igual\s+que|igual\s+que)\b)/;
const REFERENCIA_DE_COMPANIA_RE = /\b(?:junto\s+(?:a|al)|al\s+lado\s+(?:de(?:l)?|de\s+la|de\s+los|de\s+las)|como\s+complemento\s+(?:de|del|de\s+la|de\s+los|de\s+las)|complemento\s+(?:de|del|de\s+la|de\s+los|de\s+las)|(?:como\s+)?compa[nñ]er[oa]s?\s+(?:de|del|de\s+la|de\s+los|de\s+las)|(?:como\s+)?vecin[oa]s?\s+(?:de|del|de\s+la|de\s+los|de\s+las)|asociad[oa]s?\s+(?:a|al|con)|en\s+asociaci[oó]n\s+con|tal\s+como\s+se\s+recomienda\s+para|(?:como|a\s+modo\s+de)\s+referencia\s+(?:para|de))\b[^.;:]*$/i;
const COMPANIA_DESPUES_RE = /^\s*[,()]?\s*(?:como\s+complemento\s+(?:de|del|de\s+la|de\s+los|de\s+las)|complemento\s+(?:de|del|de\s+la|de\s+los|de\s+las)|(?:como\s+)?compa[nñ]er[oa]s?\s+(?:de|del|de\s+la|de\s+los|de\s+las)|(?:como\s+)?vecin[oa]s?\s+(?:de|del|de\s+la|de\s+los|de\s+las)|asociad[oa]s?\s+(?:a|al|con)|en\s+asociaci[oó]n\s+con|junto\s+(?:a|al)|al\s+lado\s+(?:de(?:l)?|de\s+la|de\s+los|de\s+las)|como\s+referencia\s+(?:para|de))\b/i;

function recomendacionParaMencion(fraseNorm, mentionStart, mentionLength) {
  const boundaries = /[,;:]/g;
  let start = 0;
  let end = fraseNorm.length;
  let boundary;
  while ((boundary = boundaries.exec(fraseNorm)) !== null) {
    if (boundary.index < mentionStart) start = boundary.index + 1;
    else {
      end = boundary.index;
      break;
    }
  }
  const clause = fraseNorm.slice(start, end).trim();
  if (EJEMPLO_O_COMPARACION_RE.test(clause)) return false;

  const localStart = mentionStart - start;
  const localEnd = localStart + mentionLength;
  const openParenthesis = clause.lastIndexOf('(', localStart);
  const closeParenthesis = clause.indexOf(')', localEnd);
  if (openParenthesis >= 0 && (closeParenthesis < 0 || openParenthesis < closeParenthesis)) return false;
  // Un cultivo mencionado como compañía, complemento, vecino o referencia no
  // es el objeto de la acción de sembrar que aparece antes en la misma frase.
  // Limitarlo a la cláusula protege una recomendación directa que venga después
  // de una comparación separada por coma, punto y coma o dos puntos.
  if (
    REFERENCIA_DE_COMPANIA_RE.test(clause.slice(0, localStart)) ||
    COMPANIA_DESPUES_RE.test(clause.slice(localEnd))
  ) return false;

  const nearbyText = clause.slice(Math.max(0, localStart - 80), Math.min(clause.length, localEnd + 80));
  return ACCION_DE_SIEMBRA_RE.test(nearbyText) && RECOMENDACION_DE_SIEMBRA_RE.test(nearbyText);
}

/**
 * @param {string} responseText
 * @param {{altitud?: number|string|null, userMessage?: string|null, resolvedEntities?: Array<object>|null, toolEvidence?: object|Array<object>|null}} [ctx]
 * @returns {{text:string, modified:boolean, reason:string|null, especies?:string[]}}
 */
export function guardEspecieFueraDePiso(responseText, {
  altitud = null,
  userMessage = null,
  resolvedEntities = null,
  toolEvidence = null,
} = {}) {
  const alt = altitudValida(altitud);
  if (typeof responseText !== 'string' || !responseText.trim() || alt == null) {
    return { text: responseText ?? '', modified: false, reason: null };
  }
  const norm = normAlineado(responseText);
  if (norm.includes(MARCA)) return { text: responseText, modified: false, reason: null };

  const especiesResueltas = especiesResueltasParaConsulta(resolvedEntities, toolEvidence, userMessage);
  const fuera = new Map();
  for (const f of frases(responseText)) {
    const fn = norm.slice(f.i, f.i + f.t.length);
    if (OTRO_PISO_RE.test(fn) || hablaDeOtraAltitud(fn, alt)) continue;
    for (const coincidencia of mencionesConRango(fn)) {
      if (!recomendacionParaMencion(fn, coincidencia.inicio, coincidencia.clave.length)) continue;
      const resuelta = especieResueltaParaMencion(coincidencia, especiesResueltas);
      const m = resuelta
        ? { ...coincidencia, min: resuelta.min, max: resuelta.max, ids: [resuelta.id], nombreResuelto: resuelta.display }
        : coincidencia;
      if (alt >= m.min && alt <= m.max) continue;
      const antes = fn.slice(Math.max(0, m.inicio - VENTANA_ANTES), m.inicio);
      const despues = fn.slice(m.inicio + m.clave.length);
      if (NEGACION_ANTES_RE.test(antes) || NEGACION_DESPUES_RE.test(despues)) continue;
      const nombre = resuelta?.display || responseText.slice(f.i + m.inicio, f.i + m.inicio + m.clave.length);
      const clave = m.ids.slice().sort().join('|');
      if (!fuera.has(clave)) fuera.set(clave, { nombre, min: m.min, max: m.max });
    }
  }
  if (fuera.size === 0) return { text: responseText, modified: false, reason: null };

  const lista = [...fuera.values()];
  const detalle = lista.map((e) => `${e.nombre} (${textoRango(e)})`).join('; ');
  const nativas = nombresNativasDelPiso(alt, 4);
  const altTxt = alt.toLocaleString('es-CO');
  const alternativa = nativas.length
    ? ` Nativas que sí se dan a ${altTxt} m: ${nativas.join(', ')}.`
    : ' Para su altura no tengo una lista de nativas con fuente; pregunte en el vivero de la CAR de su zona.';
  const correccion =
    `Corrección de piso: su finca está a ${altTxt} m s. n. m. y esto queda ${MARCA} del catálogo Chagra: ${detalle}. ` +
    `No lo siembre allí: no es de su piso.${alternativa}`;
  return {
    text: `${correccion}\n\n${responseText.trim()}`,
    modified: true,
    reason: `especie_fuera_de_piso: ${lista.map((e) => e.nombre).join(', ')} @ ${alt}msnm`,
    especies: lista.map((e) => e.nombre),
  };
}
