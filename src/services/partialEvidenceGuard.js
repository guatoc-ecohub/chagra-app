// SPDX-License-Identifier: AGPL-3.0-only
/**
 * partialEvidenceGuard — el turno degrada por fuente, no entero
 * (re-auditoría RA5 2026-10-24: PISOS-01, RESTAURACION-05, SANIDAD-06,
 * FAMILIAS-07, BIOPREP-RECETAS-08).
 *
 * Antes, si UNA herramienta del turno traía `_error`, `available:false` o
 * `status:'unavailable'`, la respuesta entera se cambiaba por «Una fuente no
 * está disponible…», aunque las demás fuentes hubieran respondido (19 de 30
 * preguntas de los cuatro pisos; la advertencia contra el pino junto al
 * nacimiento se borraba porque caía una herramienta secundaria).
 *
 * Ahora:
 *   1. Se quitan las oraciones que solo la fuente caída podía respaldar: toda
 *      cantidad (distancia, peso, volumen, porcentaje, plazo) cuyo número no
 *      esté en la evidencia que sí llegó, en la pregunta o en la altitud de la
 *      finca; y las afirmaciones sobre el estado de la fuente («está
 *      disponible», «no encontré la especie»), porque un fallo no prueba
 *      ausencia.
 *   2. Si cayó una fuente de seguridad (dosis, ficha del biopreparado,
 *      toxicidad), sale toda dosis, cantidad o frecuencia, aunque otra fuente
 *      la nombre.
 *   3. Si no sobrevive nada, la respuesta es la abstención de siempre.
 *   4. Lo demás llega con un aviso de una línea al final (`noticeFor`).
 *
 * Pura y síncrona. Copy de cara al usuario: usted, sin raya larga.
 *
 * @module partialEvidenceGuard
 */

import { stripDiacritics } from './outputGuardQueryUtils.js';
import { DOSIS_O_FRECUENCIA_RE, CALDO_CTX_RE } from './caldoSinDocumento.js';
import { CUIDADOS_CALDO } from './recetasSeguras.js';
import { segmentarOraciones } from './respuestaCorta.js';
import {
  partitionEvidence,
  buildUnavailableNotice,
  UNAVAILABLE_EVIDENCE_RESPONSE,
  UNAVAILABLE_NOTICE_PREFIX,
} from './toolEvidenceAvailability.js';

const NUM = '\\d+(?:[.,]\\d+)*';
const UNIDAD =
  '%|por ciento|km|kilometros?|m|mts?|metros?|cm|centimetros?|mm|milimetros?|msnm|m\\.?\\s?s\\.?\\s?n\\.?\\s?m\\.?|' +
  'kg|kilos?|kilogramos?|g|gr|grs|gramos?|mg|ml|mililitros?|l|lt|litros?|cc|ha|hectareas?|' +
  'dias?|semanas?|meses|anos?|plantas?|semillas?|cucharad\\w*|tazas?|bultos?|arrobas?|libras?';

/** Cantidad con unidad, también en rango («0,75 a 1 m», «30–60 cm»). Texto normalizado. */
const CANTIDAD_RE = new RegExp(`(${NUM})(?:\\s*(?:-|–|—|a|y)\\s*(${NUM}))?\\s*(?:${UNIDAD})(?![a-z0-9])`, 'g');
const NUM_RE = new RegExp(NUM, 'g');

/** Afirmaciones sobre la fuente o sobre la ausencia del dato (normalizado). */
const ESTADO_FUENTE_RE =
  /\b(fuentes?|catalogo|herramienta|servicio)\s+(si\s+)?(esta|estan|quedo|sigue)\s+disponible|\b(el|la)\s+(catalogo|fuente)\s+(no\s+tiene|carece)|\bno\s+(encontre|existe|hay|figura|aparece)\b[^.!?\n]{0,40}\b(especie|dato|registro|informacion|ficha|catalogo)|\bno\s+esta\s+en\s+(el|nuestro|mi)\s+catalogo/;

function _numero(token) {
  const sinMiles = String(token).replace(/\.(?=\d{3}(?!\d))/g, '');
  const n = Number(sinMiles.replace(',', '.'));
  return Number.isFinite(n) ? String(n) : null;
}

function _numerosDe(texto) {
  const set = new Set();
  for (const m of String(texto || '').matchAll(NUM_RE)) {
    const n = _numero(m[0]);
    if (n != null) set.add(n);
  }
  return set;
}

function _respaldo(usable, userMessage, fincaAltitud) {
  let evidencia = '';
  try { evidencia = JSON.stringify(usable.map((item) => item?.result ?? null)); } catch (_) { evidencia = ''; }
  const set = _numerosDe(`${evidencia} ${userMessage || ''}`);
  const altitud = _numero(fincaAltitud);
  if (altitud != null) set.add(altitud);
  return set;
}

function _cantidadSinRespaldo(n, respaldo) {
  for (const m of n.matchAll(CANTIDAD_RE)) {
    for (const token of [m[1], m[2]]) {
      if (token == null) continue;
      const num = _numero(token);
      if (num == null || !respaldo.has(num)) return true;
    }
  }
  return false;
}

function _partes(text) {
  return String(text).split('\n').map((linea) => segmentarOraciones(linea));
}

/**
 * @param {string|null|undefined} responseText
 * @param {{toolEvidence?: any, userMessage?: string|null, fincaAltitud?: number|string|null}} [opts]
 * @returns {{text: string, modified: boolean, terminal: boolean, critical: boolean, unavailable: any[], reason: string|null}}
 */
export function guardPartialEvidence(responseText, { toolEvidence = null, userMessage = null, fincaAltitud = null } = {}) {
  const plan = partitionEvidence(toolEvidence);
  const base = { critical: plan.critical, unavailable: plan.unavailable };
  if (plan.unavailable.length === 0) {
    return { text: responseText ?? '', modified: false, terminal: false, reason: null, ...base };
  }
  if (responseText === UNAVAILABLE_EVIDENCE_RESPONSE) {
    return { text: responseText, modified: false, terminal: true, reason: null, ...base };
  }
  const original = typeof responseText === 'string' ? responseText : '';
  const respaldo = _respaldo(plan.usable, userMessage, fincaAltitud);
  const lineas = _partes(original).map((oraciones) => oraciones.filter((o) => {
    const n = stripDiacritics(o);
    if (!n) return true;
    if (o.includes(UNAVAILABLE_NOTICE_PREFIX)) return false;
    if (ESTADO_FUENTE_RE.test(n)) return false;
    if (plan.critical && DOSIS_O_FRECUENCIA_RE.test(n)) return false;
    if (_cantidadSinRespaldo(n, respaldo)) return false;
    return true;
  }).join(' ').trim());
  const text = lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  // Un rótulo suelto («Distancias:») o una viñeta vacía no es respuesta.
  const quedaRespuesta = text.split('\n').some((l) => {
    const limpia = l.replace(/^[\s*\-•#\d.)]+/, '').trim();
    return (limpia.match(/[a-záéíóúñ]/gi) || []).length >= 12 && !/:\s*$/.test(limpia);
  });
  if (!quedaRespuesta) {
    return { text: UNAVAILABLE_EVIDENCE_RESPONSE, modified: true, terminal: true, reason: 'evidence_unavailable', ...base };
  }
  const modified = text !== original.trim();
  return { text: modified ? text : original, modified, terminal: false, reason: modified ? 'evidence_partial' : null, ...base };
}

/**
 * Aviso de una línea para anexar al final de una respuesta parcial.
 * @param {any} toolEvidence
 * @returns {string}
 */
export function noticeFor(toolEvidence) {
  return buildUnavailableNotice(partitionEvidence(toolEvidence).unavailable);
}

const BIOPREP_CTX_RE = /\b(biopreparad\w*|biol|purin\w*|supermagro|sulfocalcico|bordeles|caldos?|fermentad\w*|bocashi)\b/;

/**
 * «No» conservador para preguntas de seguridad de un caldo o biopreparado
 * cuando su ficha no respondió (BIOPREP-RECETAS-08). No afirma química ni
 * cifras: dice qué no hacer y lleva los cuidados curados de los caldos.
 * `veto` marca las preguntas que son enteras de seguridad (mezcla, niños,
 * calor): ahí el «no» reemplaza lo que el modelo haya dicho sin la ficha.
 * Devuelve null si la pregunta no es de seguridad de un caldo.
 * @param {string|null|undefined} userMessage
 * @returns {{text: string, veto: boolean}|null}
 */
export function respuestaSeguridadConservadora(userMessage) {
  const q = stripDiacritics(userMessage || '');
  if (!q || !(CALDO_CTX_RE.test(q) || BIOPREP_CTX_RE.test(q))) return null;
  const partes = [];
  let veto = false;
  if (/\bmezcl\w*|\bmisma bomba\b|\bmismo tanque\b|\bjunt[oa]s?\b/.test(q)) {
    partes.push('No los mezcle en la misma bomba mientras una ficha con fuente no diga que esa mezcla se puede hacer.');
    veto = true;
  }
  if (/\bnin[oa]s?\b|\bmenor(es)?\b|\bhij[oa]s?\b|\bpelad[oa]s?\b|\b\d{1,2}\s+anos\b/.test(q)) {
    partes.push('Un niño no debe preparar, revolver ni aplicar caldos: que lo haga un adulto con guantes y gafas.');
    veto = true;
  }
  if (/\bmedio\s?dia\b|\bcalor\b|\bsol (fuerte|picante)\b|\b\d{2}\s*(°|grados)/.test(q)) {
    partes.push('No lo aplique al mediodía ni con calor fuerte.');
    veto = true;
  }
  if (/\breceta\b|\bdosis\b|\bcuant[oa]s?\b|\bcarencia\b|\bcada cuanto\b|\bproporcion\w*\b|\bprepar\w*\b/.test(q)) {
    partes.push('No le doy receta, dosis ni tiempo de carencia sin la ficha con fuente: siga la etiqueta o consulte al ICA o a Agrosavia.');
  }
  if (partes.length === 0) return null;
  return { text: [...partes, CUIDADOS_CALDO].join(' '), veto };
}
