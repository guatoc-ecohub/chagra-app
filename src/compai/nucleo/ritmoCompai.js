/** Decisiones portables de cadencia. El host aporta texto y ejecuta efectos. */
export const ESTADOS_RITMO = Object.freeze(['acompanar', 'retirarse', 'celebrar', 'observar']);

/** @param {{ocupado?: boolean, severidad?: string|null}} [input] */
export function debeCallarMientrasTrabaja({ ocupado = false, severidad = null } = {}) {
  return Boolean(ocupado) && severidad !== 'alta';
}

/** @param {{ultimaRespuestaMs?: number|null, ahoraMs?: number, esperaMs?: number}} [input] */
export function puedeRetirarse({ ultimaRespuestaMs = null, ahoraMs = Date.now(), esperaMs = 120000 } = {}) {
  if (typeof ultimaRespuestaMs !== 'number' || !Number.isFinite(ultimaRespuestaMs) || !Number.isFinite(ahoraMs)) return false;
  return ahoraMs - ultimaRespuestaMs >= Math.max(0, esperaMs);
}

/** @param {{texto?: string, maxChars?: number}} [p] */
export function celebracionBreve({ texto, maxChars = 120 } = {}) {
  if (typeof texto !== 'string' || !texto.trim()) return null;
  const limpio = texto.trim();
  if (limpio.length <= maxChars) return limpio;
  return `${limpio.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

/** @param {{ocupado?: boolean, severidad?: string|null, ultimaRespuestaMs?: number|null, ahoraMs?: number, esperaMs?: number, observar?: boolean}} [input] */
export function decidirIntervencion({ ocupado = false, severidad = null, ultimaRespuestaMs = null, ahoraMs = Date.now(), esperaMs, observar = true } = {}) {
  if (debeCallarMientrasTrabaja({ ocupado, severidad })) return 'acompanar';
  if (puedeRetirarse({ ultimaRespuestaMs, ahoraMs, esperaMs })) return 'retirarse';
  return observar ? 'observar' : 'acompanar';
}

export default { ESTADOS_RITMO, debeCallarMientrasTrabaja, puedeRetirarse, celebracionBreve, decidirIntervencion };
