/**
 * Ejecuta visión manteniendo el contrato de las fotos normales del agente.
 * Solo la acción explícita desde una ficha de planta habilita contexto RAG.
 */
export function analyzeAgentPhoto(analyze, blob, signal, speciesContext = null) {
  const options = speciesContext?.speciesSlug
    ? { signal, speciesSlug: speciesContext.speciesSlug }
    : { signal, skipRag: true };
  return analyze(blob, options);
}
