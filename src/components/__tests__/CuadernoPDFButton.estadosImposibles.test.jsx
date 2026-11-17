// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Estado imposible que el botón SÍ alcanzaba antes de tener máquina explícita:
 * «reposo» pintado con una generación en vuelo. Bastaba tocar «Reintentar»
 * dentro de los 6 s del aviso de error: el temporizador de ese aviso seguía
 * vivo y devolvía el botón a reposo en mitad de la generación nueva.
 *
 * A diferencia de la prueba de comportamiento, esta NO pasa contra la versión
 * anterior: es el control que demuestra que el estado era alcanzable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const descarga = vi.hoisted(() => ({ pendiente: null, llamadas: 0 }));

vi.mock('../../db/assetCache', () => ({ assetCache: { getByType: async () => [] } }));
vi.mock('../../db/logCache', () => ({ logCache: { getAll: async () => [] } }));
vi.mock('../../services/fincaActiveStore', () => ({
  default: (selector) => selector({ getActiveFinca: () => null }),
}));
vi.mock('../../services/cuadernoPDF', () => ({
  buildFincaData: async () => ({}),
  downloadCuadernoPDF: () => new Promise((resolve, reject) => {
    descarga.llamadas += 1;
    descarga.pendiente = { resolve, reject };
  }),
}));

import CuadernoPDFButton from '../CuadernoPDFButton';

const asentar = async () => {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => { await new Promise((r) => globalThis.setImmediate(r)); });
  }
};
const avanzar = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms); }); };
const boton = () => screen.getByRole('button');

describe('CuadernoPDFButton — estados imposibles', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    descarga.pendiente = null;
    descarga.llamadas = 0;
    await import('../../services/cuadernoPDF');
    render(<CuadernoPDFButton />);
    await asentar();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reintentar dentro del aviso de error no vuelve a «reposo» con la generación en vuelo', async () => {
    fireEvent.click(boton());
    await asentar();
    descarga.pendiente.reject(new Error('falló'));
    await asentar();
    expect(boton().textContent).toContain('Reintentar');

    await avanzar(4000);
    fireEvent.click(boton());
    await asentar();
    expect(boton().textContent).toContain('Generando cuaderno…');

    // Aquí vencía el temporizador del primer error (4000 + 2500 > 6000).
    await avanzar(2500);
    expect(boton().textContent).toContain('Generando cuaderno…');
    expect(boton().disabled).toBe(true);

    // Con el botón deshabilitado no hay forma de lanzar una segunda generación.
    fireEvent.click(boton());
    await asentar();
    expect(descarga.llamadas).toBe(2);
  });
});
