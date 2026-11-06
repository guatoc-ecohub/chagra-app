/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Copy de esta ventana aislada en un único archivo. */
export const MOMENTOS = [
  { estado: 'mirando', verbo: 'Miro', titulo: 'Primero, de cerca.', detalle: 'Mi atención está en la hoja. El resto puede esperar.', objeto: 'Una hoja, muchas preguntas', nota: 'Ilustración de ejemplo. No es una foto analizada.' },
  { estado: 'escuchando', verbo: 'Escucho', titulo: 'Ahora, cuénteme.', detalle: 'Usted conoce su tierra. Yo le doy espacio.', objeto: '«Empezó en las hojas de abajo…»', nota: 'Frase de ejemplo. El micrófono está apagado.' },
  { estado: 'pensando', verbo: 'Pienso', titulo: 'Un momento de calma.', detalle: 'Antes de responder, hace falta unir las pistas.', objeto: 'La hoja · el suelo · su historia', nota: 'Pausa del recorrido. No hay una consulta de IA en curso.' },
  { estado: 'respuesta', verbo: 'Respondo', titulo: 'Miremos un poco más.', detalle: 'Una respuesta también puede ser una buena pregunta.', objeto: '¿La tierra sigue húmeda debajo de la superficie?', nota: 'Respuesta escrita para este ejemplo, no un diagnóstico.' },
];

export const RESPUESTA_EJEMPLO = 'Miremos un poco más. ¿La tierra sigue húmeda debajo de la superficie?';

export const COPY = {
  inicio: 'Aquí estoy.',
  pregunta: '¿Qué miramos hoy?',
  invitacion: 'Acérquese. Hay tiempo para mirar, escuchar y entender.',
  limite: 'Sus fotos y sonidos se quedan en este dispositivo. La respuesta de ejemplo está escrita aquí.',
  ejemplo: 'Recorrer un ejemplo para ver cómo funciona',
  volver: 'Volver al inicio',
  siguiente: 'Siguiente momento',
  escuchar: 'Hablar con Chagra',
  mirar: 'Mostrar una mata',
  hablar: 'Oír el ejemplo',
  detener: 'Detener',
  camara: 'La cámara está abierta. Veo la imagen en pantalla, pero no la analizo.',
  microfono: 'El micrófono está abierto. El medidor responde al sonido; no transcribo palabras.',
  permiso: 'Esperando su permiso. Todavía no recibo imagen ni sonido.',
  denegado: 'No pude abrir el dispositivo. Revise el permiso del navegador o pruebe el recorrido de ejemplo.',
  noMedios: 'Este navegador no permite abrir el dispositivo aquí. Puede recorrer el ejemplo.',
  noVoz: 'La voz no está disponible en este navegador. Puede leer la respuesta en el cuaderno.',
  errorVoz: 'No pude reproducir la voz. La respuesta sigue escrita en el cuaderno.',
  oculto: 'La prueba se detuvo al salir de la ventana. Puede iniciarla de nuevo.',
  terminado: 'El dispositivo dejó de enviar señal. Puede volver a intentarlo.',
  permisoLento: 'El permiso sigue sin resolverse. La solicitud se canceló en esta ventana; puede intentarlo de nuevo.',
  sinMedidor: 'Micrófono abierto, pero este navegador no ofrece el medidor. No grabo ni transcribo.',
  sinVozLocal: 'No hay una voz local en español disponible todavía. Puede intentar de nuevo o leer el cuaderno.',
  preparandoVoz: 'Preparando la voz del dispositivo. Todavía no hay audio.',
  lecturaLocal: 'Voz del dispositivo. Lee la respuesta escrita.',
  lecturaTerminada: 'Terminó la lectura. El texto sigue en el cuaderno.',
  vozLocal: 'Voz del dispositivo. Lee el texto de ejemplo; no es una respuesta de IA.',
  vozTerminada: 'Terminó la lectura del ejemplo. Le escucho cuando active el micrófono.',
  silencio: 'Ya le escuché. Me cerré al quedar en silencio; puede hablar de nuevo.',
};
