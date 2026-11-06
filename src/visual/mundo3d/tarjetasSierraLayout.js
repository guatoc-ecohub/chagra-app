const MARGEN = 8;
const ANCHO_MAXIMO = 166.4;

/** Posiciones de tarjetas sobre el macizo en el espacio libre del teléfono. */
export function slotTarjetaSierra(id, anchoViewport) {
  const ancho = Math.min(ANCHO_MAXIMO, anchoViewport * 0.39);
  const derecha = id === 'minima' || id === 'viento';
  const abajo = id === 'humedad' || id === 'viento';
  return {
    x: derecha ? anchoViewport - MARGEN - ancho : MARGEN,
    y: abajo ? 190 : 62,
    ancho,
  };
}
