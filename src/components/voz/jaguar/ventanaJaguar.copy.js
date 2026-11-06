/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Copy de esta escena independiente. */
export const RESPUESTA = 'Revise primero el envés y la humedad del suelo. Una marca sola no basta para saber qué ocurre.';

export const MOMENTOS = [
  { estado: 'mirando', verbo: 'Miro', titulo: 'Primero, el rastro.', detalle: 'Una hoja cambia. Me acerco a mirar.', objeto: 'Una marca en la hoja', nota: 'Ilustración de ejemplo. No es un diagnóstico.' },
  { estado: 'escuchando', verbo: 'Escucho', titulo: 'Le escucho.', detalle: 'Lo que usted ha visto también cuenta.', objeto: '“Apareció ayer, después de la lluvia.”', nota: 'Frase de ejemplo. El micrófono está apagado.' },
  { estado: 'pensando', verbo: 'Pienso', titulo: 'No me apresuro.', detalle: 'La marca. La lluvia. Lo que falta por saber.', objeto: 'Mirar también por debajo', nota: 'Pausa del ejemplo. No hay una consulta de IA en curso.' },
  { estado: 'respuesta', verbo: 'Hablo', titulo: 'Una cosa primero.', detalle: 'Solo lo que ayuda a dar el siguiente paso.', objeto: RESPUESTA, nota: 'Respuesta escrita de ejemplo. Puede escucharla con una voz del dispositivo.' },
];

export const ESTADOS = {
  presente: 'El jaguar vigila en silencio.',
  mirando: 'El jaguar se inclina hacia la muestra.',
  escuchando: 'El jaguar levanta las orejas y escucha.',
  pensando: 'El jaguar baja la mirada y permanece quieto.',
  respuesta: 'El jaguar está atento. La respuesta está escrita.',
  hablando: 'El jaguar habla.',
};
