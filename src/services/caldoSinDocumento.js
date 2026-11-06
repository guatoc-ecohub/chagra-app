// SPDX-License-Identifier: AGPL-3.0-only
import { segmentarOraciones } from './respuestaCorta.js';
/**
 * caldoSinDocumento — guarda final de la vía generativa para caldos y
 * diagnósticos (re-auditoría RA4 2026-10-12, S01, P0).
 *
 * «¿Qué le echo a la gota?» volvió del modelo con «50 gramos de cal viva por
 * cada litro de agua tibia… la misma cantidad de sulfato cúprico (azufre)»,
 * «solución de 1 %… repite cada 7 días», «Causa confirmada», «Manejo
 * validado… registrado» y «respaldados por el catálogo Chagra», sin foto, sin
 * documento y sin cuidados. Ninguna guarda lo tocaba: las de dosis solo
 * anexaban una nota y no conocían la cal viva ni esos sellos.
 *
 * Esta guarda corre sobre el texto FINAL de `applyOutputGuards` (después de
 * cualquier retorno temprano), así que ninguna rama la salta:
 *
 *   1. Quita toda oración con cal viva y deja el aviso de la cal sin apagar.
 *   2. Quita los sellos que el modelo no puede afirmar: causa confirmada,
 *      manejo validado, producto registrado, datos verificados, respaldado por
 *      el catálogo. En su lugar dice que es una orientación general.
 *   3. Si la respuesta habla de un caldo o fungicida y NO es una respuesta
 *      curada con documento (`documentado`), quita las oraciones con
 *      cantidades, porcentajes, proporciones o frecuencias, y remite a la
 *      ficha con fuente o a la etiqueta.
 *   4. Toda respuesta que mande preparar, aplicar o usar un caldo lleva los
 *      cuidados (guantes, gafas, no en floración, lejos de los niños).
 *
 * Pura y síncrona. Copy de cara al usuario: usted, sin raya larga.
 *
 * @module caldoSinDocumento
 */

import { stripDiacritics } from './outputGuardQueryUtils.js';
import { AVISO_CAL_SIN_APAGAR, CUIDADOS_CALDO } from './recetasSeguras.js';

const norm = (s) => (typeof s === 'string' ? stripDiacritics(s) : '');

/** Caldos minerales y fungicidas (texto normalizado). */
export const CALDO_CTX_RE =
  /\b(caldos?|bordeles\w*|sulfocalcico|polisulfuro\w*|visosa|sulfato (de )?cobre|sulfato cuprico|cobre sulfato|oxicloruro\w*|hidroxido de cobre|cupric\w*|fungicida\w*|cal viva|cal hidratada|cal apagada)\b/;

const CAL_VIVA_RE = /\bcal viva\b/;

/** Contextos en los que sí aporta la nota sobre diagnóstico de una planta. */
const PLANT_HEALTH_DIAGNOSIS_RE =
  /\b(diagnost\w*|sintom\w*|enferm\w*|plag\w*|hongo\w*|got(?:a)?|roya|mildiu|tizon|mancha\w*|marchitez|pudric\w*|amarill\w*|hojas?\s+(?:con|manchad\w*|amarill\w*))\b/;

/** Sellos de certeza que la vía generativa no puede afirmar (normalizado). */
export const SELLO_FALSO_RE =
  /\b(causa confirmada|diagnostico confirmado|confirmad[oa] (el|la) (diagnostico|causa)|manejo validado|validad[oa]s? (por|para|en|del|de la)|(biopreparado|producto|fungicida|caldo|insumo)s? registrad[oa]s?|registrad[oa]s? (para|ante|en el ica)|datos? verificad\w*|informacion verificada|verificad[oa]s? (por|en|del|de la|de)|respaldad[oa]s? por|fuente de la recomendacion)\b/;

/** Cantidad, porcentaje, proporción o frecuencia de aplicación (normalizado). */
export const DOSIS_O_FRECUENCIA_RE =
  /\d+(?:[.,]\d+)?\s*(?:%|por ciento|(?:g|gr|grs|gramos?|kg|kilos?|kilogramos?|mg|ml|mililitros?|l|lt|litros?|cc|cucharad\w*|tazas?|copas?|onzas?|libras?)\b)|\b\d+\s*:\s*\d+\b|\b\d+\s+(?:partes?|medidas?)\b|\bcada\s+(?:\d+|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|quince|veinte)\s*(?:a\s+\d+\s*)?(?:dias?|semanas?|meses|horas)\b|\bcada (?:semana|mes|ocho dias|quince dias)\b|\b\d+\s+veces\b|\b(?:la misma|igual) cantidad\b/;

/** «sin una ficha verificada», «no está confirmado»: niega, no afirma. */
const SELLO_NEGADO_RE =
  /\b(no|sin|ni|ningun[oa]?)\s+(?:\S+\s+){0,4}?(verificad\w*|confirmad\w*|validad\w*|registrad\w*)/g;

/** Oración que manda preparar, aplicar o usar un caldo (no la que lo prohíbe). */
const ORDEN_CALDO_RE = /\b(prepar\w*|aplic\w*|roci\w*|asperj\w*|fumig\w*|us[ae]r?|usela|uselo|ech[ae]r?)\b/;
const ORDEN_NEGADA_RE = /\b(no|nunca|jamas|evite)\s+(?:se |lo |la |los |las |le )?(prepar\w*|aplic\w*|roci\w*|asperj\w*|fumig\w*|us[ae]\w*|ech\w*|mezcl\w*)/;

const CUIDADOS_OK = (t) => /\bguantes?\b/.test(t) && /\bgafas\b/.test(t) && /\bfloracion\b/.test(t) && /\bnin(o|a)s\b/.test(t);

export const NOTA_ORIENTACION =
  'Esto es una orientación general, no un diagnóstico seguro: sin foto ni síntomas no se puede saber qué tiene la planta.';

export function notaDosis(t) {
  return /\bbordeles\b/.test(t)
    ? 'La cantidad y cada cuánto aplicar el caldo bordelés están en su ficha, con fuente: pídame «receta del caldo bordelés». Para un producto comprado, siga la etiqueta.'
    : 'La cantidad y cada cuánto aplicar un caldo los da su ficha con fuente o la etiqueta del producto, no una cifra suelta.';
}

/** Parte en líneas y cada línea en oraciones. */
function _partes(text) {
  return String(text).split('\n').map((linea) => segmentarOraciones(linea));
}

/**
 * @param {string} responseText
 * @param {{userMessage?: string|null, documentado?: boolean}} [opts]
 * @returns {{text: string, modified: boolean, reason: string|null}}
 */
export function guardCaldoSinDocumento(responseText, { userMessage = null, documentado = false } = {}) {
  if (typeof responseText !== 'string' || !responseText.trim()) {
    return { text: responseText ?? '', modified: false, reason: null };
  }
  const tAll = norm(responseText);
  const userNorm = norm(userMessage || '');
  const caldoEnRespuesta = CALDO_CTX_RE.test(tAll);
  const caldoEnPregunta = CALDO_CTX_RE.test(userNorm);
  const caldo = caldoEnRespuesta || caldoEnPregunta;
  const contextoDiagnostico = typeof userMessage === 'string' && userMessage.trim()
    ? caldoEnPregunta || PLANT_HEALTH_DIAGNOSIS_RE.test(userNorm)
    : caldo || PLANT_HEALTH_DIAGNOSIS_RE.test(tAll);
  const motivos = new Set();

  // «sulfato cúprico (azufre)» confunde dos insumos; el bordelés no cura.
  const corregido = responseText
    .replace(/sulfato (c[uú]prico|de cobre)\s*\(\s*azufre\s*\)/gi, 'sulfato de cobre')
    .replace(/\b(preventiv[oa])\s+o\s+curativ[oa]\b/gi, '$1');
  if (corregido !== responseText && caldo) motivos.add('caldo_no_cura');
  const lineas = _partes(corregido)
    .map((oraciones) => oraciones.filter((o) => {
      const n = norm(o);
      if (CAL_VIVA_RE.test(n)) { motivos.add('cal_viva'); return false; }
      if (SELLO_FALSO_RE.test(n.replace(SELLO_NEGADO_RE, ' '))) { motivos.add('sello_falso'); return false; }
      if (caldo && !documentado && DOSIS_O_FRECUENCIA_RE.test(n)) { motivos.add('dosis_sin_documento'); return false; }
      return true;
    }).join(' ').trim());

  let text = lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  // Una línea que quedó en un rótulo suelto («Detalles técnicos:») no dice nada.
  text = text.split('\n').filter((l, i, arr) => !(/:\s*$/.test(l) && (arr[i + 1] ?? '').trim() === '' && /^\W*[\wÁÉÍÓÚáéíóúñÑ ]{1,40}:\s*$/.test(l))).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const anexos = [];
  if (motivos.has('sello_falso') && contextoDiagnostico) anexos.push(NOTA_ORIENTACION);
  if (motivos.has('dosis_sin_documento')) anexos.push(notaDosis(tAll));
  if (motivos.has('cal_viva') && !text.includes(AVISO_CAL_SIN_APAGAR)) anexos.push(AVISO_CAL_SIN_APAGAR);
  const base = [text, ...anexos].filter(Boolean).join('\n\n');
  // Los cuidados van cuando la respuesta manda preparar, aplicar o usar un
  // caldo; nombrarlo para decir «no lo mezcle» no es una receta.
  const ordenaCaldo = _partes(base).flat().some((o) => {
    const n = norm(o);
    return CALDO_CTX_RE.test(n) && ORDEN_CALDO_RE.test(n) && !ORDEN_NEGADA_RE.test(n);
  });
  if (caldo && ordenaCaldo && !CUIDADOS_OK(norm(base))) {
    motivos.add('cuidados_caldo');
    anexos.push(CUIDADOS_CALDO);
  }
  if (motivos.size === 0) return { text: responseText, modified: false, reason: null };
  return {
    text: [text, ...anexos].filter(Boolean).join('\n\n'),
    modified: true,
    reason: `caldo_sin_documento: ${[...motivos].join(', ')}`,
  };
}
