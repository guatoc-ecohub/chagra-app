// SPDX-License-Identifier: AGPL-3.0-only
/** @typedef {{quien: 'usted'|'compai', texto: string}} Turno */

/** @param {Turno[]} historial @param {AbortSignal} signal */
export async function responder(historial, signal) {
  // RA1 2026-10-06 (N01, N02): esta conversación también llega al modelo, así
  // que las preguntas de seguridad y de siembra con El Niño se responden con el
  // mismo texto fijo que el chat del agente, antes de llamar al LLM.
  const ultima = [...historial].reverse().find(m => m.quien === 'usted')?.texto || '';
  const [{ detectSafetyIntent, buildSafetyResponse }, { buildEnsoSiembraResponse }, { buildPreguntaBasicaResponse }] = await Promise.all([
    import('../../services/safetyIntentResponder.js'),
    import('../../services/ensoSiembraResponder.js'),
    import('../../services/preguntasBasicasResponder.js'),
  ]);
  const fija = buildSafetyResponse(detectSafetyIntent(ultima)) || buildEnsoSiembraResponse(ultima)
    || buildPreguntaBasicaResponse(ultima);
  if (fija) return fija.content;
  const { createAgentRequestSender } = await import('../../services/agentRequestSender.js');
  const resultado = await createAgentRequestSender()({
    prompt: 'Converse de usted, nunca use voseo. Responda en texto sencillo, sin formato. No afirme haber guardado ni cambiado datos. Conversación:\n' + historial.map(m => `${m.quien === 'usted' ? 'Usuario' : 'Asistente'}: ${m.texto}`).join('\n'),
    signal,
  });
  return resultado.response;
}
