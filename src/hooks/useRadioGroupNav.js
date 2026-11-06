// SPDX-License-Identifier: AGPL-3.0-only
/**
 * useRadioGroupNav — patrón ARIA de radiogroup para grupos de botones con
 * role="radio" (C20).
 *
 * - Una sola parada de Tab: la opción marcada (o la primera habilitada).
 * - Flechas derecha/abajo y izquierda/arriba mueven el foco Y la selección,
 *   en círculo, saltando las opciones deshabilitadas. Inicio y Fin van a los
 *   extremos.
 */
import { useRef } from 'react';

const SIGUIENTE = new Set(['ArrowRight', 'ArrowDown']);
const ANTERIOR = new Set(['ArrowLeft', 'ArrowUp']);

/**
 * Índice destino de una tecla dentro del grupo, o -1 si la tecla no navega.
 * @param {boolean[]} habilitadas una entrada por opción
 * @param {number} actual índice con el foco
 * @param {string} tecla KeyboardEvent.key
 * @returns {number}
 */
export function indiceDestinoRadio(habilitadas, actual, tecla) {
  const n = habilitadas.length;
  if (!n || !habilitadas.some(Boolean)) return -1;
  if (tecla === 'Home') return habilitadas.indexOf(true);
  if (tecla === 'End') return habilitadas.lastIndexOf(true);
  const paso = SIGUIENTE.has(tecla) ? 1 : ANTERIOR.has(tecla) ? -1 : 0;
  if (!paso) return -1;
  let i = actual;
  for (let k = 0; k < n; k += 1) {
    i = (i + paso + n) % n;
    if (habilitadas[i]) return i;
  }
  return -1;
}

/**
 * @template T
 * @param {{ opciones: T[], seleccionada: T, habilitada?: (o: T) => boolean, onSeleccionar: (o: T) => void }} cfg
 * @returns {(opcion: T, indice: number) => { tabIndex: number, onKeyDown: (event: import('react').KeyboardEvent<HTMLElement>) => void, ref: (nodo: HTMLElement | null) => void }}
 */
export default function useRadioGroupNav({ opciones, seleccionada, habilitada = () => true, onSeleccionar }) {
  /** @type {import('react').MutableRefObject<Array<HTMLElement | null>>} */
  const nodos = useRef([]);
  const habilitadas = opciones.map((o) => Boolean(habilitada(o)));
  const marcada = opciones.indexOf(seleccionada);
  const paradaTab = marcada >= 0 && habilitadas[marcada] ? marcada : habilitadas.indexOf(true);

  const onKeyDown = (indice, event) => {
    const destino = indiceDestinoRadio(habilitadas, indice, event.key);
    if (destino < 0) return;
    event.preventDefault();
    onSeleccionar(opciones[destino]);
    nodos.current[destino]?.focus();
  };

  return (opcion, indice) => ({
    tabIndex: indice === paradaTab ? 0 : -1,
    onKeyDown: (event) => onKeyDown(indice, event),
    ref: (nodo) => { nodos.current[indice] = nodo; },
  });
}
