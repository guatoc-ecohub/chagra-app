// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Comportamiento observable del botón «Descargar cuaderno (PDF)».
 *
 * Solo recorre caminos legales (una acción a la vez, sin pisar avisos), así
 * que describe lo mismo antes y después de volver explícita su máquina de
 * estados: debe pasar igual contra la versión con `useState` sueltos.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const descarga = vi.hoisted(() => ({ pendiente: null }));

vi.mock('../../db/assetCache', () => ({ assetCache: { getByType: async () => [] } }));
vi.mock('../../db/logCache', () => ({ logCache: { getAll: async () => [] } }));
vi.mock('../../services/fincaActiveStore', () => ({
  default: (selector) => selector({ getActiveFinca: () => null }),
}));
vi.mock('../../services/cuadernoPDF', () => ({
  buildFincaData: async () => ({}),
  downloadCuadernoPDF: () => new Promise((resolve, reject) => {
    descarga.pendiente = { resolve, reject };
  }),
}));

import CuadernoPDFButton from '../CuadernoPDFButton';

// Deja correr promesas e imports dinámicos sin tocar los temporizadores falsos.
const asentar = async () => {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => { await new Promise((r) => globalThis.setImmediate(r)); });
  }
};
const avanzar = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms); }); };
const boton = () => screen.getByRole('button');

describe('CuadernoPDFButton — comportamiento observable', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    descarga.pendiente = null;
    await import('../../services/cuadernoPDF');
    render(<CuadernoPDFButton />);
    await asentar();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('arranca en reposo: botón habilitado y sin aviso', () => {
    expect(boton().textContent).toContain('Descargar cuaderno (PDF)');
    expect(boton().disabled).toBe(false);
    expect(screen.queryByText(/Cuaderno generado/)).toBeNull();
  });

  it('reposo → generando → listo con su aviso → reposo a los 5 s', async () => {
    fireEvent.click(boton());
    await asentar();
    expect(boton().textContent).toContain('Generando cuaderno…');
    expect(boton().disabled).toBe(true);

    descarga.pendiente.resolve({ sizeBytes: 2048 });
    await asentar();
    expect(boton().textContent).toContain('Cuaderno descargado');
    expect(boton().disabled).toBe(false);
    expect(screen.getByText('Cuaderno generado (2 kB). Revise su carpeta de descargas.')).toBeTruthy();

    await avanzar(4999);
    expect(boton().textContent).toContain('Cuaderno descargado');
    await avanzar(1);
    expect(boton().textContent).toContain('Descargar cuaderno (PDF)');
    expect(screen.queryByText(/Cuaderno generado/)).toBeNull();
  });

  it('reposo → generando → error con alerta → reposo a los 6 s', async () => {
    fireEvent.click(boton());
    await asentar();
    descarga.pendiente.reject(new Error('Sin espacio en el dispositivo'));
    await asentar();
    expect(boton().textContent).toContain('Reintentar');
    expect(boton().disabled).toBe(false);
    expect(screen.getByRole('alert').textContent).toBe('Sin espacio en el dispositivo');

    await avanzar(5999);
    expect(boton().textContent).toContain('Reintentar');
    await avanzar(1);
    expect(boton().textContent).toContain('Descargar cuaderno (PDF)');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un error sin mensaje usa el texto por omisión', async () => {
    fireEvent.click(boton());
    await asentar();
    descarga.pendiente.reject({});
    await asentar();
    expect(screen.getByRole('alert').textContent).toBe('No se pudo generar el cuaderno.');
  });

  it('tras volver a reposo se puede generar de nuevo', async () => {
    fireEvent.click(boton());
    await asentar();
    descarga.pendiente.resolve({ sizeBytes: 1024 });
    await asentar();
    await avanzar(5000);

    fireEvent.click(boton());
    await asentar();
    expect(boton().textContent).toContain('Generando cuaderno…');
    descarga.pendiente.resolve({ sizeBytes: 1024 });
    await asentar();
    expect(boton().textContent).toContain('Cuaderno descargado');
  });
});
