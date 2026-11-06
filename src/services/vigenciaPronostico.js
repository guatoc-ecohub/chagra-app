/** Vigencia compartida del pronóstico para las pantallas 2D y 3D. */
export const PRONOSTICO_TTL_MS = 3 * 60 * 60 * 1000;

export function vigenciaPronostico(dato, ahoraMs = Date.now()) {
    if (!dato) return { estado: 'sin-dato', cuandoMs: null };
    const emitido = Date.parse(dato.fetched_at || '');
    const cuandoMs = Number.isFinite(emitido) ? emitido : null;
    const guardado = dato.saved_at == null || dato.saved_at === '' ? NaN : Number(dato.saved_at);
    if (dato.stale) return { estado: 'vencido', motivo: 'sin-red', cuandoMs: Number.isFinite(guardado) ? guardado : cuandoMs };
    if (cuandoMs == null) return { estado: 'sin-hora', cuandoMs: null };
    return ahoraMs - cuandoMs >= PRONOSTICO_TTL_MS
        ? { estado: 'vencido', motivo: 'viejo', cuandoMs }
        : { estado: 'fresco', cuandoMs };
}
