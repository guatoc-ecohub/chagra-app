// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Transiciones de la máquina «acción con aviso» y los estados imposibles que
 * deja de poder construir.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { ESTADO_INICIAL, FASE, transicion, useAccionConAviso } from '../useAccionConAviso';

const FASES = Object.values(FASE);
const EVENTOS = [
  { tipo: 'INICIA' },
  { tipo: 'TERMINA', mensaje: 'listo' },
  { tipo: 'FALLA', mensaje: 'falló' },
  { tipo: 'VENCE' },
  { tipo: 'DESCONOCIDO' },
];
const estadoEn = (fase) => ({
  fase,
  mensaje: fase === FASE.EXITO || fase === FASE.ERROR ? 'previo' : '',
});

describe('transicion (tabla pura)', () => {
  it('tabla completa: cada par estado × evento', () => {
    const tabla = {};
    for (const fase of FASES) {
      for (const evento of EVENTOS) {
        tabla[`${fase} + ${evento.tipo}`] = transicion(estadoEn(fase), evento).fase;
      }
    }
    expect(tabla).toEqual({
      'idle + INICIA': 'generating',
      'idle + TERMINA': 'idle',
      'idle + FALLA': 'idle',
      'idle + VENCE': 'idle',
      'idle + DESCONOCIDO': 'idle',
      'generating + INICIA': 'generating',
      'generating + TERMINA': 'success',
      'generating + FALLA': 'error',
      'generating + VENCE': 'generating',
      'generating + DESCONOCIDO': 'generating',
      'success + INICIA': 'generating',
      'success + TERMINA': 'success',
      'success + FALLA': 'success',
      'success + VENCE': 'idle',
      'success + DESCONOCIDO': 'success',
      'error + INICIA': 'generating',
      'error + TERMINA': 'error',
      'error + FALLA': 'error',
      'error + VENCE': 'idle',
      'error + DESCONOCIDO': 'error',
    });
  });

  it('un evento que no aplica devuelve el mismo objeto', () => {
    const enCurso = estadoEn(FASE.EN_CURSO);
    expect(transicion(enCurso, { tipo: 'INICIA' })).toBe(enCurso);
    expect(transicion(enCurso, { tipo: 'VENCE' })).toBe(enCurso);
    expect(transicion(ESTADO_INICIAL, { tipo: 'TERMINA', mensaje: 'x' })).toBe(ESTADO_INICIAL);
  });

  it('imposible: mensaje fuera de success/error, sea cual sea la secuencia', () => {
    // Recorre todas las secuencias de hasta 5 eventos desde el estado inicial.
    let frontera = [ESTADO_INICIAL];
    for (let paso = 0; paso < 5; paso += 1) {
      const siguiente = [];
      for (const estado of frontera) {
        for (const evento of EVENTOS) {
          const s = transicion(estado, evento);
          expect(FASES).toContain(s.fase);
          if (s.fase === FASE.REPOSO || s.fase === FASE.EN_CURSO) expect(s.mensaje).toBe('');
          siguiente.push(s);
        }
      }
      frontera = siguiente;
    }
  });

  it('imposible: un VENCE viejo no saca de generating', () => {
    let s = transicion(ESTADO_INICIAL, { tipo: 'INICIA' });
    s = transicion(s, { tipo: 'FALLA', mensaje: 'falló' });
    s = transicion(s, { tipo: 'INICIA' }); // la persona reintenta
    s = transicion(s, { tipo: 'VENCE' }); // temporizador del error anterior
    expect(s).toEqual({ fase: 'generating', mensaje: '' });
  });
});

describe('useAccionConAviso (hook)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  const diferida = () => {
    let resolve; let reject;
    const promesa = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promesa, resolve, reject };
  };

  it('reintentar dentro del aviso de error: el temporizador viejo no corta la acción nueva', async () => {
    const { result } = renderHook(() => useAccionConAviso({ msExito: 5000, msError: 6000 }));

    const primera = diferida();
    let corrida;
    act(() => { corrida = result.current.ejecutar(() => primera.promesa); });
    await act(async () => { primera.reject(new Error('falló')); await corrida; });
    expect(result.current.fase).toBe('error');

    await act(async () => { vi.advanceTimersByTime(4000); });
    const segunda = diferida();
    act(() => { corrida = result.current.ejecutar(() => segunda.promesa); });
    expect(result.current.fase).toBe('generating');

    // A los 6 s del primer error vencería su temporizador: ya no existe.
    await act(async () => { vi.advanceTimersByTime(2500); });
    expect(result.current.fase).toBe('generating');
    expect(result.current.mensaje).toBe('');

    await act(async () => { segunda.resolve('listo'); await corrida; });
    expect(result.current).toMatchObject({ fase: 'success', mensaje: 'listo' });
    // Y el aviso nuevo dura sus 5 s completos, no lo que le quedaba al viejo.
    await act(async () => { vi.advanceTimersByTime(4999); });
    expect(result.current.fase).toBe('success');
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(result.current.fase).toBe('idle');
  });

  it('imposible: dos acciones en vuelo, ni con dos llamadas en el mismo tick', async () => {
    const { result } = renderHook(() => useAccionConAviso());
    const accion = vi.fn(() => new Promise(() => {}));
    act(() => {
      result.current.ejecutar(accion);
      result.current.ejecutar(accion);
    });
    expect(accion).toHaveBeenCalledTimes(1);
    expect(result.current.fase).toBe('generating');
  });

  it('sin msError el error se queda hasta la próxima acción', async () => {
    const { result } = renderHook(() => useAccionConAviso({ msExito: 2500 }));
    await act(async () => { await result.current.ejecutar(async () => { throw new Error('sin red'); }); });
    await act(async () => { vi.advanceTimersByTime(60000); });
    expect(result.current).toMatchObject({ fase: 'error', mensaje: 'sin red' });
    await act(async () => { await result.current.ejecutar(async () => undefined); });
    expect(result.current).toMatchObject({ fase: 'success', mensaje: '' });
  });

  it('alFallar decide el mensaje de error', async () => {
    const { result } = renderHook(() => useAccionConAviso());
    await act(async () => {
      await result.current.ejecutar(async () => { throw {}; }, (err) => err?.message || 'por omisión');
    });
    expect(result.current).toMatchObject({ fase: 'error', mensaje: 'por omisión' });
  });
});
