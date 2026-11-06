/** Vocabulario compartido del ciclo visible de voz. */
export const VOZ_REPOSO = 'reposo';
export const VOZ_ESCUCHANDO = 'escuchando';
// eslint-disable-next-line chagra-i18n/no-hardcoded-spanish -- identificador de estado, no copy
export const VOZ_PENSANDO = 'pensando';
export const VOZ_HABLANDO = 'hablando';
export const VOZ_ERROR = 'error';

/** El ciclo completo, en orden de vida (la tabla común). */
export const ESTADOS_VOZ = Object.freeze([
  VOZ_REPOSO,
  VOZ_ESCUCHANDO,
  VOZ_PENSANDO,
  VOZ_HABLANDO,
  VOZ_ERROR,
]);

/** Guarda barata: ¿este valor es un estado de voz del ciclo común? */
export function esEstadoVoz(valor) {
  return ESTADOS_VOZ.indexOf(valor) !== -1;
}
