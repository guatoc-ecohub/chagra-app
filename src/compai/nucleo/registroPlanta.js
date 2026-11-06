/** Detecta silencio de una planta a partir de logs reales entregados por el host. */
/**
 * @param {{plantaId?: string, logs?: Array<{assetId?: string, asset_id?: string, timestampMs?: number, timestamp?: number, dateMs?: number, relationships?: {asset?: {data?: Array<{id?: string}>}}}>, ahoraMs?: number, dias?: number}} [p]
 */
export function plantaSinRegistro({ plantaId, logs = [], ahoraMs = Date.now(), dias = 14 } = {}) {
  if (!plantaId || !Array.isArray(logs) || !Number.isFinite(ahoraMs)) return null;
  const propios = logs.filter((l) => (l?.assetId === plantaId || l?.asset_id === plantaId || l?.relationships?.asset?.data?.some?.((a) => a.id === plantaId)));
  const ultima = propios.map((l) => Number(l.timestampMs ?? l.timestamp ?? l.dateMs)).filter(Number.isFinite).sort((a, b) => b - a)[0];
  if (Number.isFinite(ultima) && ahoraMs - ultima < dias * 86400000) return null;
  return { plantaId, ultimaRegistroMs: Number.isFinite(ultima) ? ultima : null, diasSinRegistro: Number.isFinite(ultima) ? Math.floor((ahoraMs - ultima) / 86400000) : null };
}

export default { plantaSinRegistro };
