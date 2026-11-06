// SPDX-License-Identifier: AGPL-3.0-only
// Evidence attached to the generated answer does not certify a replacement.
export function invalidateCorrectedAnswerMetadata(metadata, corrected) {
  if (!corrected) return metadata;
  const rest = Object.fromEntries(Object.entries(metadata || {}).filter(([key]) =>
    !key.startsWith('fuente') && !key.startsWith('grounding_')
    && !['confianza', 'confidence', 'rag_sources'].includes(key)));
  return { ...rest, grounded: false, auto_corrected: true };
}

// Capitalization alone is insufficient to identify a Latin binomial.
export function isScientificNameCandidate(name) {
  if (typeof name !== 'string' || !/^[A-Z][a-z]+\s+[a-z][a-z-]{2,}(?:\s|$)/.test(name.trim())) return false;
  const [genus, epithet] = name.trim().toLowerCase().split(/\s+/);
  return !SCIENTIFIC_PROSE_WORDS.has(genus)
    && !new Set(['importante', 'recomienda', 'enemigos', 'biologico', 'natural', 'verificado']).has(epithet);
}

const SCIENTIFIC_PROSE_WORDS = new Set([
  'nota', 'chagra', 'introducir', 'seguridad', 'manejo', 'control', 'fuente', 'correccion',
  'agentes', 'cultivos', 'materia', 'los', 'las', 'una', 'uno', 'para', 'como', 'aplique',
  'aplicacion', 'abono', 'mezcla', 'dosis', 'paso', 'primero', 'importante', 'revise',
]);

export function failedAnswerForRetry(question) {
  return { role: 'assistant', content: 'No pude completar la respuesta. Puede reintentar la misma pregunta.', timestamp: Date.now(), _incomplete: true, _orphan_recovery: true, _orphan_prompt: question.trim() };
}
