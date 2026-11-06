// SPDX-License-Identifier: AGPL-3.0-only
/**
 * actionClaimGuard — el agente no afirma una acción sobre los datos que no
 * ejecutó una herramienta con éxito.
 *
 * Caso medido (piloto 2026-10-31, C31): «Borre todas mis siembras y zonas ya
 * mismo, sin preguntar.» → «Entendido. He borrado todas las siembras y zonas
 * registradas de su finca en el sistema.» No hay herramienta de borrado y no se
 * borró nada. La ingesta compleja ya resolvía esto con `allPersisted`: el texto
 * «Registré…» solo sale si la acción quedó ejecutada. Esta guarda generaliza
 * esa regla a la respuesta libre del modelo.
 *
 * Regla:
 *   - Una afirmación de BORRADO solo vale si una herramienta de borrado quedó
 *     ejecutada con éxito en el turno. Si no, la respuesta entera se reemplaza:
 *     dice que no borró nada y que no borra sin confirmación explícita.
 *   - Una afirmación de ESCRITURA («registré», «he guardado») solo vale si una
 *     herramienta de escritura quedó ejecutada con éxito. Si no, se quitan las
 *     frases que lo afirman y se avisa que no se guardó nada.
 *
 * Pura y síncrona. Solo mira verbos en primera persona (y la pasiva de
 * borrado); las negaciones («no he borrado») no cuentan como afirmación.
 *
 * @module actionClaimGuard
 */

import { MSG } from '../config/messages.js';

/**
 * Una acción quedó persistida si el ejecutor la dio por ejecutada y la
 * herramienta no reportó fallo. Es la misma regla que usa la ingesta compleja.
 *
 * @param {{status?: string, result?: {success?: boolean}} | null | undefined} actionResult
 * @returns {boolean}
 */
export function isActionPersisted(actionResult) {
  return actionResult?.status === 'executed' && actionResult?.result?.success !== false;
}

const NOT_LETTER_BEFORE = '(?<![\\p{L}\\p{N}])';
const NOT_LETTER_AFTER = '(?![\\p{L}\\p{N}])';

// «quité» no entra: otra guarda dice «estos nombres científicos, los quité».
const DELETE_PRETERITE = 'borré|eliminé|suprimí|archivé';
const DELETE_PARTICIPLE = '(?:borrad|eliminad|suprimid|archivad)[oa]s?';
// La pasiva («fueron eliminadas») solo cuenta sobre datos de la finca: «las
// plantas enfermas fueron eliminadas» describe una labor, no un borrado.
const DATA_NOUN_RE = /(?<![\p{L}])(?:siembras?|zonas?|registros?|datos|activos?|bitácoras?|historial|información|lotes?|todo)(?![\p{L}])/iu;
const WRITE_PRETERITE = 'registré|guardé|anoté|creé|actualicé|agregué|añadí|programé|agendé|modifiqué';
const WRITE_PARTICIPLE = '(?:registrad|guardad|anotad|cread|actualizad|agregad|añadid|programad|agendad|modificad)[oa]s?';

// «ya le borré», «se lo eliminé», «borré»
const CLITICS = '(?:(?:ya|también)\\s+)?(?:(?:se|me|le|les|lo|la|los|las)\\s+){0,2}';

const DELETE_CLAIM_RES = [
  new RegExp(`${NOT_LETTER_BEFORE}${CLITICS}(?:${DELETE_PRETERITE})${NOT_LETTER_AFTER}`, 'giu'),
  new RegExp(`${NOT_LETTER_BEFORE}(?:he|hemos|había|habíamos)\\s+(?:ya\\s+)?(?:${DELETE_PARTICIPLE})${NOT_LETTER_AFTER}`, 'giu'),
];

// Pasiva: «se han eliminado», «quedaron borradas», «ya fueron eliminadas».
const DELETE_PASSIVE_RE = new RegExp(
  `${NOT_LETTER_BEFORE}(?:ya\\s+)?(?:se\\s+(?:han|ha)|han\\s+sido|ha\\s+sido|fueron|fue|quedaron|quedó)\\s+(?:ya\\s+)?(?:${DELETE_PARTICIPLE})${NOT_LETTER_AFTER}`,
  'giu',
);

const WRITE_CLAIM_RES = [
  new RegExp(`${NOT_LETTER_BEFORE}${CLITICS}(?:${WRITE_PRETERITE})${NOT_LETTER_AFTER}`, 'giu'),
  new RegExp(`${NOT_LETTER_BEFORE}(?:he|hemos)\\s+(?:ya\\s+)?(?:${WRITE_PARTICIPLE})${NOT_LETTER_AFTER}`, 'giu'),
];

// «no he borrado», «no le borré nada», «nunca se han eliminado»
const NEGATION_TAIL_RE = /(?<![\p{L}\p{N}])(?:no|nunca|ni|tampoco|jamás)\s+(?:\p{L}+\s+){0,2}$/iu;

const DELETE_TOOL_RE = /(?:borrar|eliminar|archivar|quitar|delete|remove|archive)/i;
const READ_TOOL_RE = /^(?:query|get|buscar|consultar|dibujar|validate|search)_/i;

export const UNBACKED_DELETE_RESPONSE = MSG.agentRecord.unbackedDelete;
export const UNBACKED_WRITE_NOTICE = MSG.agentRecord.unbackedWrite;

function claimsIn(text, regexes) {
  const found = [];
  for (const re of regexes) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      const before = text.slice(Math.max(0, match.index - 40), match.index);
      const clause = before.split(/[.!?;:\n]/).pop() || '';
      if (!NEGATION_TAIL_RE.test(clause)) found.push(match[0].trim());
    }
  }
  return found;
}

/**
 * @param {string} text
 * @returns {{deletes: string[], writes: string[]}}
 */
export function detectActionClaims(text) {
  if (typeof text !== 'string' || !text.trim()) return { deletes: [], writes: [] };
  const passive = text
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => DATA_NOUN_RE.test(sentence))
    .flatMap((sentence) => claimsIn(sentence, [DELETE_PASSIVE_RE]));
  return {
    deletes: [...claimsIn(text, DELETE_CLAIM_RES), ...passive],
    writes: claimsIn(text, WRITE_CLAIM_RES),
  };
}

function persistedTools(executedActions) {
  const list = Array.isArray(executedActions) ? executedActions : [];
  return list
    .filter((action) => isActionPersisted(action))
    .map((action) => String(action?.tool_name || ''))
    .filter((name) => name && !READ_TOOL_RE.test(name));
}

function dropClaimSentences(text) {
  return text
    .split('\n')
    .map((line) => line
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => claimsIn(sentence, WRITE_CLAIM_RES).length === 0)
      .join(' '))
    .filter((line, index, lines) => line.trim() || (index > 0 && lines[index - 1].trim()))
    .join('\n')
    .trim();
}

/**
 * @param {string} responseText
 * @param {{executedActions?: Array<{tool_name?: string, status?: string, result?: any}> | null}} [opts]
 * @returns {{text: string, modified: boolean, reason: string | null}}
 */
export function guardUnbackedActionClaims(responseText, opts = {}) {
  if (typeof responseText !== 'string' || !responseText.trim()) {
    return { text: responseText, modified: false, reason: null };
  }
  const { deletes, writes } = detectActionClaims(responseText);
  if (deletes.length === 0 && writes.length === 0) {
    return { text: responseText, modified: false, reason: null };
  }
  const tools = persistedTools(opts?.executedActions);
  const deleteBacked = tools.some((name) => DELETE_TOOL_RE.test(name));
  const writeBacked = tools.length > 0;

  if (deletes.length > 0 && !deleteBacked) {
    return { text: UNBACKED_DELETE_RESPONSE, modified: true, reason: 'unbacked_delete_claim' };
  }
  if (writes.length > 0 && !writeBacked) {
    const rest = dropClaimSentences(responseText);
    const text = rest ? `${UNBACKED_WRITE_NOTICE}\n\n${rest}` : UNBACKED_WRITE_NOTICE;
    return { text, modified: true, reason: 'unbacked_write_claim' };
  }
  return { text: responseText, modified: false, reason: null };
}
