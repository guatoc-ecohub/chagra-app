/** Consulta episódica pura: el host entrega registros, este módulo no inventa. */
/** @param {{registros?: Array<Record<string, unknown>>, ahoraMs?: number, ventanaDias?: number}} [input] */
export function recordarAniversario({ registros = [], ahoraMs = Date.now(), ventanaDias = 14 } = {}) {
  if (!Array.isArray(registros) || !Number.isFinite(ahoraMs)) return null;
  const fecha = new Date(ahoraMs);
  const candidatos = registros.filter((r) => {
    const t = Number(r?.timestampMs ?? r?.timestamp ?? r?.dateMs);
    if (!Number.isFinite(t)) return false;
    const d = new Date(t);
    const diferenciaAnios = fecha.getFullYear() - d.getFullYear();
    const diferenciaDias = Math.abs((fecha.getMonth() - d.getMonth()) * 31 + fecha.getDate() - d.getDate());
    return diferenciaAnios >= 1 && diferenciaDias <= Math.max(0, ventanaDias);
  }).sort((a, b) => Number(b.timestampMs ?? b.timestamp) - Number(a.timestampMs ?? a.timestamp));
  return candidatos[0] || null;
}

/** @param {{registros?: Array<Record<string, unknown>>, clave?: string, valor?: unknown}} [input] */
export function recuperarDato({ registros = [], clave, valor } = {}) {
  if (!Array.isArray(registros) || !clave) return null;
  return registros.find((r) => r?.[clave] === valor) || null;
}

export default { recordarAniversario, recuperarDato };
