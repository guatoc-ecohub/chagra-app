// Un mismo payload con valores distintos en cada cierre, incluidos los bordes.
export function intervalosLluvia() {
    const horas = Array.from({ length: 72 }, (_, i) => ({
        time: new Date(Date.UTC(2026, 8, 27, i)).toISOString().slice(0, 16),
        lluviaMm: i + 1, velocidad: 4, racha: 8,
    }));
    return { utc_offset_seconds: -18000, vientoHorario: { utcOffsetSeconds: -18000, horas } };
}
