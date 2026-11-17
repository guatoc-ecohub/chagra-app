// SPDX-License-Identifier: AGPL-3.0-only
/**
 * useAccionConAviso — máquina de estados de «una acción asíncrona que avisa
 * cómo terminó» (generar un PDF, exportar una copia…).
 *
 *            INICIA               TERMINA
 *   idle ───────────▶ generating ─────────▶ success ──┐
 *    ▲                    │                           │ VENCE (msExito)
 *    │                    │ FALLA                     │
 *    │                    ▼                           │
 *    └──── VENCE ────── error ◀── (msError) ──────────┘
 *
 * Reglas que antes vivían repartidas entre un `useState` de fase, otro de
 * mensaje y un `setTimeout` suelto por cada desenlace:
 *
 *   - Solo hay UNA acción en vuelo: `INICIA` sobre `generating` no hace nada.
 *   - El mensaje existe solo en `success` y `error`; en `idle` y `generating`
 *     es siempre la cadena vacía.
 *   - El temporizador que devuelve a `idle` pertenece al desenlace que lo
 *     creó: si el estado cambia antes (la persona reintenta), se cancela. Un
 *     temporizador viejo ya no puede devolver a `idle` una acción en curso.
 *
 * La tabla (`transicion`) es una función pura para poder probarla sin React.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';

export const FASE = Object.freeze({
  REPOSO: 'idle',
  EN_CURSO: 'generating',
  EXITO: 'success',
  ERROR: 'error',
});

export const ESTADO_INICIAL = Object.freeze({ fase: FASE.REPOSO, mensaje: '' });

/**
 * @typedef {{ fase: 'idle' | 'generating' | 'success' | 'error', mensaje: string }} EstadoAccion
 * @typedef {{ tipo: 'INICIA' } | { tipo: 'TERMINA', mensaje?: string }
 *   | { tipo: 'FALLA', mensaje?: string } | { tipo: 'VENCE' }} EventoAccion
 */

/**
 * Tabla de transiciones. Un evento que no aplica al estado actual lo deja
 * intacto (misma referencia), así que no hay forma de saltarse una fase.
 *
 * @param {EstadoAccion} estado
 * @param {EventoAccion} evento
 * @returns {EstadoAccion}
 */
export function transicion(estado, evento) {
  switch (evento.tipo) {
    case 'INICIA':
      return estado.fase === FASE.EN_CURSO ? estado : { fase: FASE.EN_CURSO, mensaje: '' };
    case 'TERMINA':
      return estado.fase === FASE.EN_CURSO
        ? { fase: FASE.EXITO, mensaje: evento.mensaje || '' }
        : estado;
    case 'FALLA':
      return estado.fase === FASE.EN_CURSO
        ? { fase: FASE.ERROR, mensaje: evento.mensaje || '' }
        : estado;
    case 'VENCE':
      return estado.fase === FASE.EXITO || estado.fase === FASE.ERROR ? ESTADO_INICIAL : estado;
    default:
      return estado;
  }
}

/**
 * @param {object} [opciones]
 * @param {number|null} [opciones.msExito] - ms que dura `success` antes de
 *   volver a `idle`. Sin valor, `success` se queda hasta la próxima acción.
 * @param {number|null} [opciones.msError] - ídem para `error`.
 * @returns {{
 *   fase: EstadoAccion['fase'],
 *   mensaje: string,
 *   ejecutar: (accion: () => Promise<string|void>|string|void,
 *              alFallar?: (err: any) => string) => Promise<void>,
 * }}
 */
export function useAccionConAviso({ msExito = null, msError = null } = {}) {
  const [estado, despachar] = useReducer(transicion, ESTADO_INICIAL);
  // El reducer ya ignora un segundo INICIA, pero el trabajo asíncrono se
  // lanza fuera de él: este candado evita arrancarlo dos veces en el mismo
  // tick, antes de que React vuelva a pintar el botón deshabilitado.
  const enVuelo = useRef(false);

  useEffect(() => {
    const ms = estado.fase === FASE.EXITO ? msExito : estado.fase === FASE.ERROR ? msError : null;
    if (ms == null) return undefined;
    const temporizador = setTimeout(() => despachar({ tipo: 'VENCE' }), ms);
    return () => clearTimeout(temporizador);
  }, [estado, msExito, msError]);

  const ejecutar = useCallback(async (accion, alFallar) => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    despachar({ tipo: 'INICIA' });
    try {
      const mensaje = await accion();
      despachar({ tipo: 'TERMINA', mensaje: typeof mensaje === 'string' ? mensaje : '' });
    } catch (err) {
      despachar({ tipo: 'FALLA', mensaje: alFallar ? alFallar(err) : (err?.message || '') });
    } finally {
      enVuelo.current = false;
    }
  }, []);

  return { fase: estado.fase, mensaje: estado.mensaje, ejecutar };
}

export default useAccionConAviso;
