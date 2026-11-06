/** Reglas puras para reacciones de Angelita a datos reales de la finca. */
export const TOPE_CUENTA_MATAS = 10;

export function cantidadVisibleDeMatas(cantidad) {
  if (!Number.isInteger(cantidad) || cantidad < 0) return 0;
  return Math.min(cantidad, TOPE_CUENTA_MATAS);
}

export function debeContarMatas(cantidad) {
  return cantidadVisibleDeMatas(cantidad) > 0;
}

export function cosechaGuardadaConExito(resultado) {
  return Boolean(resultado && (resultado.success || resultado.offline));
}
