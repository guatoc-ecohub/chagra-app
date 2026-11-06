/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Copy de la ventana independiente. */
export const MOMENTOS_OSO = [
  { estado: 'mirando', verbo: 'Miro', titulo: 'Al suelo, de cerca.', detalle: 'Una semilla entre las hojas. Primero nos detenemos a mirar.', objeto: 'La hojarasca guarda una semilla.', nota: 'Ilustración de ejemplo, sin análisis de imagen.' },
  { estado: 'escuchando', verbo: 'Escucho', titulo: 'Cuénteme, sin afán.', detalle: 'Me quedo aquí. Usted conoce la historia de este lugar.', objeto: '«Aquí antes había más sombra».', nota: 'Frase del ejemplo. El micrófono está apagado.' },
  { estado: 'pensando', verbo: 'Pienso', titulo: 'Sigamos las señales.', detalle: 'La sombra, el agua, la tierra. Cada una cuenta una parte.', objeto: 'Sombra · agua · hojarasca', nota: 'Momento guiado. No hay una consulta de IA en curso.' },
  { estado: 'respuesta', verbo: 'Respondo', titulo: 'Una pregunta que abre camino.', detalle: 'Antes de decidir qué hacer, miremos un poco más.', objeto: '¿Qué cambió en la sombra de este suelo?', nota: 'Respuesta escrita para el ejemplo, no un diagnóstico.' },
];

export const MEDIOS_OSO = {
  oculto: 'La prueba se detuvo al salir de la ventana.',
  denegado: 'No pude abrir el dispositivo. Revise el permiso o recorra el ejemplo.',
  noMedios: 'Este navegador no permite abrir el dispositivo aquí. Puede recorrer el ejemplo.',
  permiso: 'Esperando su permiso. Todavía no recibo imagen ni sonido.',
  permisoLento: 'La solicitud venció en esta ventana. Puede intentarlo de nuevo.',
  terminado: 'El dispositivo dejó de enviar señal. Puede volver a intentarlo.',
  camara: 'Cámara abierta. La vista es local, sin análisis de imagen.',
  microfono: 'Micrófono abierto. El medidor sigue el sonido, sin grabarlo ni transcribirlo.',
  sinMedidor: 'Este navegador no ofrece un medidor. Se cerró el micrófono.',
  noVoz: 'La voz no está disponible. Puede leer la respuesta de ejemplo.',
  sinVozLocal: 'No hay una voz local en español disponible. Puede leer el ejemplo.',
  preparandoVoz: 'Preparando la voz del dispositivo.',
  errorVoz: 'No pude reproducir la voz. El ejemplo sigue escrito en pantalla.',
  vozLocal: 'Voz del dispositivo. Lee el ejemplo, sin una respuesta de IA.',
  vozTerminada: 'Terminó la lectura del ejemplo.',
};
