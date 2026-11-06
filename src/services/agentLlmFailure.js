const UNAVAILABLE_MESSAGE = 'Chagra no puede responder ahora mismo. Intente de nuevo en un momento.';

/**
 * Conserva la causa técnica cuando AgentScreen presenta el mensaje genérico.
 * El detalle viene de openaiStream, que ya limpia cuerpos HTML y limita el
 * detalle de la respuesta upstream.
 * @param {Error} original
 * @param {number|null} status
 * @returns {Error}
 */
export function createAgentLlmFailure(original, status = null) {
  const detail = typeof original?.message === 'string' ? original.message.slice(0, 300) : '';
  console.warn('[agente:llm-error]', {
    status,
    errorName: typeof original?.name === 'string' ? original.name : 'Error',
    detail,
  });
  return new Error(UNAVAILABLE_MESSAGE, { cause: original });
}
