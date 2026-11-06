// SPDX-License-Identifier: AGPL-3.0-only

const MAX_BLOCKS_TRACKED = 64;
const correctionBlocksByText = new Map();

/**
 * Registra en memoria qué texto proviene de un bloque de corrección del guarda.
 * Como las cadenas son primitivas, el mapa se limita a las 64 respuestas más recientes.
 */
export function registerCorrectionBlockSource(text, correctionBlock) {
  if (typeof text !== 'string' || typeof correctionBlock !== 'string' || !correctionBlock) return text;

  correctionBlocksByText.delete(text);
  correctionBlocksByText.set(text, correctionBlock);
  if (correctionBlocksByText.size > MAX_BLOCKS_TRACKED) {
    const oldestText = correctionBlocksByText.keys().next().value;
    correctionBlocksByText.delete(oldestText);
  }
  return text;
}

/** Devuelve la marca solo para el texto ensamblado por registerCorrectionBlockSource. */
export function getCorrectionBlockSource(text) {
  return typeof text === 'string' ? correctionBlocksByText.get(text) ?? null : null;
}
