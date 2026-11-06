/**
 * Eje de horas de la franja de 24 h (W33): qué rótulos caben y cada cuánto,
 * según el ancho medido de la fila. Puro, sin React.
 */

// Ancho de la letra de 12 px por carácter, por arriba de la tinta medida a 390 px
// («medianoche» 69,7 px, «mediodía» 52,0, «4 a. m.» 38,7): el rótulo nunca mide más.
const PX_ESTRECHO = 3.6; // espacio, punto, i, í, l
const PX_ANCHO = 10.5; // m
const PX_RESTO = 7.2;
const HUECO_EJE = 6;
/** Ancho estimado (px) de un rótulo del eje a 12 px. */
export function anchoRotulo(texto) {
    let px = 0;
    for (const c of String(texto ?? '')) px += /[\s.,iíl]/.test(c) ? PX_ESTRECHO : c === 'm' ? PX_ANCHO : PX_RESTO;
    return px;
}
// Sin medir todavía (primer render, pruebas): el ancho de un teléfono angosto.
export const ANCHO_EJE_DEFECTO = 280;

/**
 * Rótulos del eje de horas. Cada rótulo arranca en su columna y debe caber,
 * con su hueco, antes del siguiente: si «medianoche» o «mediodía» no caben
 * cada 4 horas, el eje pasa a cada 6 (u 8). El que no cabe antes del borde
 * derecho se calla. Devuelve [{ i, texto, span }].
 */
export function marcasEje(filas, etiquetaHora, anchoPx = ANCHO_EJE_DEFECTO) {
    const n = filas?.length || 0;
    if (n === 0) return [];
    const col = anchoPx / n;
    const rotulos = filas.map((f) => String(etiquetaHora(f) ?? ''));
    const pasos = [4, 6, 8];
    const paso = pasos.find((p) => rotulos.every((t, i) => i % p !== 0 || i + p >= n || anchoRotulo(t) + HUECO_EJE <= p * col)) ?? pasos.at(-1);
    return rotulos
        .map((texto, i) => ({ i, texto, span: Math.min(paso, n - i) }))
        .filter(({ i, texto }) => i % paso === 0 && i * col + anchoRotulo(texto) <= anchoPx);
}

/**
 * Posición en el viewBox de un instante sobre el eje de la franja: la columna
 * i va de `inicioEpoch` a `epoch` (la lluvia se suma HH−1 a HH), así que un
 * valor instantáneo del sello T cae en el borde derecho de su columna y no en
 * el centro, que se leería como T − 30 min.
 */
export function xDelInstante(filas, paso) {
    const inicio = filas[0]?.inicioEpoch ?? (filas[0]?.epoch ?? 0) - 3600000;
    return (epoch) => ((epoch - inicio) / 3600000) * paso;
}
