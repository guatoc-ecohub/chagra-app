/**
 * agentIntentParser.js — Detecta intenciones accionables del usuario en texto.
 *
 * Analiza el input del usuario para detectar si quiere realizar una accion
 * en Chagra (crear log, registrar cosecha, agendar riego, etc.)
 */

import { MSG } from '../config/messages.js';

const ACTION_PATTERNS = [
  {
    id: 'registrar_cosecha',
    patterns: [
      /(?:reg(?:istr(?:ar|e|o))?[:\s]+(?:(?:la\s+)?cosecha|(?:\d+)\s*(?:kg|kilos?|libras?|unidades?|piezas?)(?:\s+de)?\s*\w+))/i,
      /(?:cosech(?:ar?|e|é|aste))/i,
      /(?:recolect(?:ar?|e|aste))/i,
      /(?:recog(?:i|iste|er)\s+(?:las?|el|los)\s+\w+)/i,
    ],
    toolName: 'crear_log',
    logType: 'log--harvest',
    extract: (text) => {
      const qtyMatch = text.match(/(\d+(?:\.\d+)?)\s*(kg|kilos?|libras?|arrobas?|@|bultos?|cargas?|quintales?|unidades?|piezas?|g|gramos?)/i);
      const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 1;
      const unit = qtyMatch ? qtyMatch[2].toLowerCase()
        .replace(/kilo(s)?/, 'kg')
        .replace(/libras?/, 'lb')
        .replace(/arrobas?/, 'arroba')
        .replace(/bultos?/, 'bulto')
        .replace(/cargas?/, 'carga')
        .replace(/quintales?/, 'quintal')
        .replace(/gramos?/, 'g')
        .replace(/piezas?/, 'unidades') : 'unidades';
      const plantMatch = text.match(/(?:de|del)\s+([\p{L}\p{N}_-]+)/iu);
      return { quantity: qty, unit, plantHint: plantMatch ? plantMatch[1] : null };
    },
  },
  {
    id: 'registrar_riego',
    patterns: [
      /(?:reg(?:istr(?:ar|e|o))?[:\s]+(?:el\s+)?riego)/i,
      /(?:reg(?:ué?|ar?|aste)\s+(?:las?|el|los)\s+\w+)/i,
      /(?:regar\s+(?:las?|el|los)\s+\w+)/i,
    ],
    toolName: 'crear_log',
    logType: 'log--input',
    extract: (text) => {
      const qtyMatch = text.match(/(\d+(?:\.\d+)?)\s*(ml|L|litros?|galones?|baldes?)/i);
      return {
        quantity: qtyMatch ? parseFloat(qtyMatch[1]) : null,
        unit: qtyMatch ? qtyMatch[2].toLowerCase().replace(/litros?/, 'L').replace(/galones?/, 'L').replace(/baldes?/, 'L') : 'L',
        notes: 'Riego registrado via asistente de voz',
      };
    },
  },
  {
    id: 'registrar_observacion',
    patterns: [
      /(?:observ(?:ar?|é|aste|ación))/i,
      /(?:not(?:ar?|é|aste))/i,
      /(?:vi\s+(?:que|como|un|una|el|la|los|las))/i,
    ],
    toolName: 'crear_log',
    logType: 'log--observation',
    extract: (text) => {
      const cleanText = text.replace(/^(?:observ(?:ar?|é|aste|ación)|not(?:ar?|é|aste)|vi\s+)/i, '').trim();
      return { notes: cleanText || MSG.agentRecord.observation };
    },
  },
  {
    id: 'registrar_aplicacion',
    patterns: [
      /(?:aplic(?:ar?|é|aste)|apliqu[ée])/i,
      /(?:aplicaci[oó]n\s+de)/i,
      /(?:fertiliz(?:ar?|é|aste))/i,
      /(?:abon(?:ar?|é|aste))/i,
    ],
    toolName: 'crear_log',
    logType: 'log--input',
    extract: (text) => {
      const productMatch = text.match(/(?:aplic\S+|fertiliz\S+|abon\S+)\s+(?:(?:de|con)\s+)?(\w+(?:\s+\w+)?)/i);
      return {
        notes: MSG.format(MSG.agentRecord.application, { product: productMatch ? productMatch[1] : 'producto no especificado' }),
        quantity: null,
        unit: null,
      };
    },
  },
];

/**
 * Analiza el texto del usuario y detecta si hay una intencion accionable.
 * @param {string} text - Texto del usuario
 * @returns {{ intent: Object|null, confidence: number }}
 */
export function parseIntent(text) {
  if (!text || typeof text !== 'string') return { intent: null, confidence: 0 };
  if (isAdviceQuestion(text)) return { intent: null, confidence: 0 };

  for (const action of ACTION_PATTERNS) {
    for (const pattern of action.patterns) {
      if (pattern.test(text)) {
        const params = action.extract(text);
        return {
          intent: {
            id: action.id,
            toolName: action.toolName,
            logType: action.logType,
            parameters: params,
            originalText: text,
          },
          confidence: 0.8,
        };
      }
    }
  }

  return { intent: null, confidence: 0 };
}

/** Questions about a possible operation do not authorize recording it. */
export function isAdviceQuestion(text) {
  const plain = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(?:no|nunca)\s+(?:registr|anot|guard|cre)/.test(plain)) return true;
  const request = plain.replace(/^\s*¿?\s*/, '');
  if (/^(?:por favor\s+)?(?:registra|anota|guarda)\b/.test(request) || /^(?:puedes|podrias)\s+(?:registrar|anotar|guardar)\b/.test(request)) return false;
  return /[¿?]/.test(plain) || /\b(?:puedo|podria|se puede|debo|conviene|es compatible|como|cuando)\b/.test(plain);
}

/**
 * Formatea los parametros detectados para mostrar en el modal de confirmacion.
 * @param {Object} intent
 * @returns {string}
 */
export function formatIntentDescription(intent) {
  const { id, parameters } = intent;

  switch (id) {
    case 'registrar_cosecha':
      return MSG.format(MSG.agentRecord.harvestDescription, { quantity: parameters.quantity, unit: parameters.unit, plant: parameters.plantHint ? ` de ${parameters.plantHint}` : '' });
    case 'registrar_riego':
      return MSG.format(MSG.agentRecord.irrigationDescription, { quantity: parameters.quantity ? ` (${parameters.quantity} ${parameters.unit})` : '' });
    case 'registrar_observacion':
      return MSG.format(MSG.agentRecord.observationDescription, { notes: parameters.notes });
    case 'registrar_aplicacion':
      return MSG.format(MSG.agentRecord.applicationDescription, { notes: parameters.notes });
    default:
      return `Ejecutar acción: ${id}`;
  }
}

export default {
  parseIntent,
  formatIntentDescription,
};
