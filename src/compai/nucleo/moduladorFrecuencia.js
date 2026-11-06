/**
 * Modulador de frecuencia de las intervenciones espontáneas.
 *
 * Este módulo solo decide cadencia. No conoce criaturas, mensajes ni mundos.
 * La urgencia real queda fuera del modulador: un aviso crítico siempre puede
 * pasar, aunque el nivel elegido sea el más silencioso.
 */

export const LLAVE_FRECUENCIA = 'compai:frecuencia';

/** @typedef {'poco'|'normal'|'todo'} NivelFrecuencia */
/** @typedef {{getItem: (key: string) => string|null, setItem: (key: string, value: string) => void}} StorageLike */

export const NIVELES_FRECUENCIA = Object.freeze([
  Object.freeze({ id: 'poco', label: 'Habla poco', cooldownFactor: 3, probabilityFactor: 0.35 }),
  Object.freeze({ id: 'normal', label: 'Normal', cooldownFactor: 1, probabilityFactor: 1 }),
  Object.freeze({ id: 'todo', label: 'Cuénteme todo', cooldownFactor: 0.5, probabilityFactor: 1.75 }),
]);

const NIVEL_POR_ID = new Map(NIVELES_FRECUENCIA.map((nivel) => [nivel.id, nivel]));

/** @param {unknown} nivel @returns {NivelFrecuencia} */
export function normalizarFrecuencia(nivel) {
  if (nivel === 'poco' || nivel === 'normal' || nivel === 'todo') return nivel;
  return 'normal';
}

/** @param {StorageLike|null|undefined} storage */
function obtenerStorage(storage) {
  return storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
}

/** @param {StorageLike|null|undefined} [storage] */
export function leerFrecuencia(storage) {
  const st = obtenerStorage(storage);
  if (!st) return 'normal';
  try {
    return normalizarFrecuencia(st.getItem(LLAVE_FRECUENCIA));
  } catch {
    return 'normal';
  }
}

/** @param {unknown} nivel @param {StorageLike|null|undefined} [storage] */
export function escribirFrecuencia(nivel, storage) {
  const elegido = normalizarFrecuencia(nivel);
  const st = obtenerStorage(storage);
  try {
    st?.setItem(LLAVE_FRECUENCIA, elegido);
  } catch {
    // La sesión continúa en memoria si el navegador bloquea el almacenamiento.
  }
  return elegido;
}

export function obtenerModuladorFrecuencia(nivel = leerFrecuencia()) {
  return NIVEL_POR_ID.get(normalizarFrecuencia(nivel)) ?? NIVELES_FRECUENCIA[1];
}

/** @param {number} cooldownMs @param {unknown} nivel */
export function escalarCooldown(cooldownMs, nivel) {
  if (!Number.isFinite(cooldownMs) || cooldownMs < 0) return cooldownMs;
  return cooldownMs * obtenerModuladorFrecuencia(normalizarFrecuencia(nivel)).cooldownFactor;
}

/** @param {number} probabilidad @param {unknown} nivel */
export function escalarProbabilidad(probabilidad, nivel) {
  if (!Number.isFinite(probabilidad) || probabilidad < 0) return probabilidad;
  return Math.min(1, probabilidad * obtenerModuladorFrecuencia(normalizarFrecuencia(nivel)).probabilityFactor);
}

/** @param {{estado?: string|null, severidad?: string|null, critico?: boolean}} [input] */
export function esAvisoCritico({ estado, severidad, critico = false } = {}) {
  return critico === true || (estado === 'aviso' && severidad === 'alta');
}

export default {
  LLAVE_FRECUENCIA,
  NIVELES_FRECUENCIA,
  normalizarFrecuencia,
  leerFrecuencia,
  escribirFrecuencia,
  obtenerModuladorFrecuencia,
  escalarCooldown,
  escalarProbabilidad,
  esAvisoCritico,
};
