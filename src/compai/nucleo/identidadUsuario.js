/** Reconocimiento local y explícito. No identifica por biometría ni red. */
export function reconocerUsuario({ ultimoAccesoMs = null, ahoraMs = Date.now(), dias = 3, nombre = null } = {}) {
  if (!Number.isFinite(ultimoAccesoMs) || !Number.isFinite(ahoraMs) || ahoraMs - ultimoAccesoMs < dias * 86400000) return null;
  return { nombre: typeof nombre === 'string' && nombre.trim() ? nombre.trim() : null, diasAusente: Math.floor((ahoraMs - ultimoAccesoMs) / 86400000) };
}

export default { reconocerUsuario };
