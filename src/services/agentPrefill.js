const PREFILL_KEY = 'chagra:agent:prefilled';

/** Lee el prefill compartido por las entradas que aún navegan por storage. */
export function readAgentPrefill() {
  try {
    const value = sessionStorage.getItem(PREFILL_KEY);
    return typeof value === 'string' && value.trim() ? value : null;
  } catch {
    return null;
  }
}

/** Consume el prefill una vez que el agente ya lo tomó para su compositor. */
export function consumeAgentPrefill() {
  const value = readAgentPrefill();
  if (!value) return null;
  try {
    sessionStorage.removeItem(PREFILL_KEY);
  } catch {
    // La lectura sigue siendo válida aunque el almacenamiento sea de solo lectura.
  }
  return value;
}

export { PREFILL_KEY };
