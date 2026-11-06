// Recorrido de bienvenida de Home A: las paradas que el compai muestra con
// <AngelitaGuia> y la memoria de «ya lo vio». Detrás de VITE_RECORRIDO_HOME
// (src/config/recorridoHomeFlag.js).
import { claveCierreGuia } from '../../../hooks/useAngelitaGuia';

const GUIA_ID = 'home-a-recorrido';
export const RECORRIDO_PEDIDO_EVENT = 'chagra:recorrido-home-a';

/**
 * Dónde está la sección que se explica:
 * - `page`: selector en el documento de la app.
 * - `frame`: `a` (encabezado ilustrado) o `b` (Home B); `key` se resuelve en
 *   el puente del iframe (`recorridoSelector` de bridge.js).
 * @typedef {{ page: string } | { frame: 'a' | 'b', key: string }} RecorridoTarget
 * @typedef {{ id: string, texto: string, target: RecorridoTarget, gesto: string, tamano?: number, margen?: number }} RecorridoPaso
 */

export const FRAME_TITLES = {
  a: 'Encabezado ilustrado de su finca',
  b: 'Un día en la finca, Home B',
};

/**
 * @param {string} companionName nombre del compai elegido ('Angelita', 'el jaguar'…)
 * @returns {RecorridoPaso[]}
 */
export function recorridoPasos(companionName) {
  const nombre = companionName || 'Angelita';
  return [
    {
      id: 'saludo', gesto: 'invita', target: { page: `iframe[title="${FRAME_TITLES.a}"]` },
      texto: `Hola, soy ${nombre}. Si me deja, le muestro su inicio parte por parte, sin afán.`,
    },
    {
      id: 'buscador', gesto: 'senala', tamano: 48, margen: 8, target: { page: '.hia-search' },
      texto: 'Aquí busca lo que necesite. Escriba, por ejemplo, «abono» o «semillas», y le aparece para abrirlo.',
    },
    {
      id: 'ubicacion', gesto: 'senala', tamano: 48, margen: 8, target: { page: '.hia-location' },
      texto: 'Aquí confirma su municipio y la altura de su finca, para contarle qué tiempo va a hacer allá.',
    },
    {
      id: 'escena', gesto: 'senala', target: { frame: 'a', key: 'escena' },
      texto: 'Esta es su finca dibujada. Toque un letrero, como El tiempo o Mis plantas, y lo llevo allá.',
    },
    {
      id: 'botones', gesto: 'senala', target: { frame: 'a', key: 'botones' },
      texto: 'La campana trae sus avisos, el signo de pregunta es la ayuda y el muñequito es su perfil.',
    },
    {
      id: 'hableme', gesto: 'invita', target: { frame: 'a', key: 'hableme' },
      texto: 'Toque aquí y hábleme como a un vecino: pregúnteme por sus cultivos o anote algo con la voz.',
    },
    {
      id: 'hoy', gesto: 'senala', target: { frame: 'b', key: 'hoy' },
      texto: 'Aquí está lo de hoy: lo que no puede esperar, sus tareas y la opción de agendar una labor.',
    },
    {
      id: 'a-un-toque', gesto: 'senala', target: { frame: 'b', key: 'atajos' },
      texto: 'En estos cuadros tiene a un toque lo de todos los días: el tiempo, sus tareas, sus plantas y más.',
    },
    {
      id: 'anio', gesto: 'senala', tamano: 48, margen: 0, target: { frame: 'b', key: 'anio' },
      texto: 'Este es el año de la finca. Tóquelo y ve las cosechas que ha anotado, mes por mes.',
    },
    {
      id: 'pestanas', gesto: 'senala', tamano: 48, margen: 4, target: { frame: 'b', key: 'pestanas' },
      texto: 'Estas pestañas son los lugares de la finca. Deslice el dedo hacia un lado para verlos todos.',
    },
    {
      id: 'plegables', gesto: 'senala', tamano: 48, margen: 8, target: { frame: 'b', key: 'plegables' },
      texto: 'Cada lugar tiene sus secciones. Toque el signo más para abrirlas, y otra vez para cerrarlas.',
    },
    {
      id: 'muelle', gesto: 'senala', tamano: 48, margen: 0, target: { frame: 'b', key: 'muelle' },
      texto: 'Al final están Hablarle, para contarme algo; Anotar, para escribir lo que pasó, y Buscar.',
    },
    {
      id: 'tareas', gesto: 'senala', tamano: 48, margen: 0, target: { page: '[aria-controls="pending-tasks-content"]' },
      texto: 'Aquí abajo están sus tareas pendientes. El número dice cuántas faltan; toque la barra para verlas.',
    },
    {
      id: 'despedida', gesto: 'contenta', target: { frame: 'a', key: 'ayuda' },
      texto: 'Ya conoce su inicio. Para repasarlo, toque este signo de pregunta. Aquí estoy para lo que necesite.',
    },
  ];
}

/** Id de cierre de <AngelitaGuia> (recordarCierreId), uno por finca. */
export function recorridoGuiaId() {
  try {
    const tenant = localStorage.getItem('chagra:active_tenant_id');
    return tenant ? `${GUIA_ID}:${tenant}` : GUIA_ID;
  } catch (_) {
    return GUIA_ID;
  }
}

/** ¿Ya lo terminó o lo cerró? Sin almacenamiento se asume visto: nunca insiste. */
export function recorridoVisto() {
  try {
    return localStorage.getItem(claveCierreGuia(recorridoGuiaId())) != null;
  } catch (_) {
    return true;
  }
}

/** Desde la ayuda: el recorrido vuelve a salir la próxima vez que se abra el inicio. */
export function pedirRecorrido() {
  try {
    localStorage.removeItem(claveCierreGuia(recorridoGuiaId()));
  } catch (_) { /* sin almacenamiento no hay nada que olvidar */ }
  window.dispatchEvent(new Event(RECORRIDO_PEDIDO_EVENT));
}
