import { VOZ_REPOSO, VOZ_ESCUCHANDO, VOZ_PENSANDO, VOZ_HABLANDO } from '../../../constants/estadosVoz';

/** Lo que dice la pizarra de la ventana de la guacamaya en cada estado (en error manda el motivo real). */
export const PIZARRA_GUACAMAYA = {
  [VOZ_REPOSO]: 'Toque «Hablar con la guacamaya» y cuénteme qué pasa en su finca.',
  [VOZ_ESCUCHANDO]: 'Le escucho. Cuando se quede callado, le contesto.',
  [VOZ_PENSANDO]: 'Déjeme pensarlo un momento.',
  [VOZ_HABLANDO]: 'Le estoy contestando en voz alta. La respuesta también queda escrita.',
};

/** Lo que dura el vuelo de salida antes de cerrar: nunca hace esperar más de esto. */
export const SALIDA_MS = 450;
