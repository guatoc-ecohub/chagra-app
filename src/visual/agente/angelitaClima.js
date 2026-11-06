/** Reglas visuales deterministas para el clima actual de Angelita. */
export const UMBRAL_VIENTO_KMH = 20;
export const UMBRAL_LLUVIA_FUERTE_MM = 10;
export const UMBRAL_CALOR_SECO_C = 28;
export const UMBRAL_HUMEDAD_SECA_PCT = 45;
export const PAUSA_RECONOCIMIENTO_MS = 5 * 60 * 1000;

const numero = (valor) => {
  if (valor == null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

/** Toma la salida de useClima3DVivo. Datos vencidos/no disponibles dan conducta neutra. */
export function derivarConductaClimatica(clima) {
  if (!clima || clima.stale || !clima.senal) {
    return { viento: false, refugio: false, helada: false, calorSeco: false, rumbo: null };
  }
  const viento = numero(clima.viento ?? clima.actual?.wind_speed_10m);
  const lluvia = numero(clima.actual?.precip_mm ?? clima.actual?.precip);
  const temperatura = numero(clima.temp ?? clima.actual?.temp_c ?? clima.actual?.temperature_2m);
  const humedad = numero(clima.humedad ?? clima.actual?.rh_pct ?? clima.actual?.relative_humidity_2m);
  const refugio = lluvia != null && lluvia >= UMBRAL_LLUVIA_FUERTE_MM;
  // `heladaRiesgo` es la banda de agroMeteo que cieloHoy.js presenta como
  // riesgo de helada; `helada` cubre además la alerta de la madrugada actual.
  const helada = Boolean(clima.helada) || clima.heladaRiesgo === 'alto' || clima.clima?.heladaRiesgo === 'alto';
  const esSoleado = ['despejado', 'soleado', 'dorada'].includes(clima.condicion)
    || clima.luz === 'dia' && clima.nubosidad != null && clima.nubosidad < 35;
  const calorSeco = temperatura != null && temperatura >= UMBRAL_CALOR_SECO_C
    && humedad != null && humedad <= UMBRAL_HUMEDAD_SECA_PCT && esSoleado && !helada
    && (lluvia == null || lluvia < 1);
  const velocidadViento = viento != null && viento > UMBRAL_VIENTO_KMH;
  return {
    viento: velocidadViento,
    refugio,
    helada,
    calorSeco,
    rumbo: velocidadViento ? numero(clima.actual?.wind_direction_10m ?? clima.vientoDireccion) : null,
  };
}

/** Label del rig. `sin-dato` evita que el gesto de gafas caiga al reloj local. */
export function condicionParaRig(clima) {
  if (!clima || clima.stale || !clima.senal) return 'sin-dato';
  const conducta = derivarConductaClimatica(clima);
  if (conducta.helada) return 'frio';
  return clima.condicion || 'sin-dato';
}

/** Cantidad reproducible de arcos: depende del nombre de pantalla, no del azar. */
export function arcosDeReconocimiento(pantalla = '') {
  let hash = 0;
  for (const caracter of String(pantalla)) hash = (hash * 31 + caracter.charCodeAt(0)) >>> 0;
  return 1 + (hash % 3);
}

export function puedeReconocerPantalla(pantalla, ultimaVez, ahora) {
  if (pantalla == null || pantalla === '') return false;
  return !Number.isFinite(ultimaVez) || ahora - ultimaVez >= PAUSA_RECONOCIMIENTO_MS;
}
