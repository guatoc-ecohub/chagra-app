// SPDX-License-Identifier: AGPL-3.0-only
/**
 * interfazPorRol.js — qué interfaz ve cada rol de la finca.
 *
 * El rol de seguridad (roleCatalog.js) dice qué puede HACER la persona; este
 * mapa dice qué VE al entrar. Reutiliza lo que ya existe: el modo «Letra
 * grande» (hooks/useModoLectura.js), la sala de juegos (`juegos`) y la entrada
 * al Valle 3D (`valle3d`). Los roles que no aparecen ven la app completa.
 *
 * - nina  (C17): el inicio es la sala de juegos y el Valle 3D, no el tablero.
 * - mayor (C16): letra grande siempre y un inicio corto con pocas acciones.
 */

export const INICIO_COMPLETO = 'completo';

const COMPLETA = Object.freeze({ inicio: INICIO_COMPLETO, letraGrande: false });

export const INTERFAZ_POR_ROL = Object.freeze({
  nina: Object.freeze({ inicio: 'nina', letraGrande: false }),
  mayor: Object.freeze({ inicio: 'mayor', letraGrande: true }),
});

/**
 * @param {string|null|undefined} rol
 * @returns {{ inicio: string, letraGrande: boolean }}
 */
export function interfazParaRol(rol) {
  return (typeof rol === 'string' && INTERFAZ_POR_ROL[rol]) || COMPLETA;
}
