// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Combinaciones que los tres booleanos (`downloading`, `doneFlash`, `error`)
 * permitían y que una sola fase ya no puede representar. Se alcanzaban
 * volviendo a tocar el botón dentro de los 2,5 s del aviso de «listo».
 *
 * NO pasa contra la versión anterior: es el control de que eran alcanzables.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const copia = vi.hoisted(() => ({ pendiente: null }));

vi.mock('../../services/dataBackup', () => ({
  getBackupSummary: async () => null,
  downloadBackupJSON: () => new Promise((resolve, reject) => {
    copia.pendiente = { resolve, reject };
  }),
}));

import BackupExportButton from '../BackupExportButton';

const asentar = async () => {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => { await new Promise((r) => globalThis.setImmediate(r)); });
  }
};
const avanzar = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms); }); };
const boton = () => screen.getByRole('button');

const exportarConExito = async () => {
  fireEvent.click(boton());
  await asentar();
  copia.pendiente.resolve();
  await asentar();
};

describe('BackupExportButton — estados imposibles', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    copia.pendiente = null;
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('nunca «Descarga iniciada» y error a la vez', async () => {
    render(<BackupExportButton />);
    await asentar();
    await exportarConExito();
    expect(boton().textContent).toContain('Descarga iniciada');

    await avanzar(1000);
    fireEvent.click(boton());
    await asentar();
    copia.pendiente.reject(new Error('Almacenamiento lleno'));
    await asentar();

    expect(screen.getByRole('alert').textContent).toBe('Almacenamiento lleno');
    expect(boton().textContent).not.toContain('Descarga iniciada');
    expect(boton().textContent).toContain('Exportar copia ahora');
  });

  it('compacta: nunca «Listo» con una exportación en vuelo', async () => {
    render(<BackupExportButton compact />);
    await asentar();
    await exportarConExito();
    expect(boton().textContent).toContain('Listo');

    await avanzar(1000);
    fireEvent.click(boton());
    await asentar();
    expect(boton().disabled).toBe(true);
    expect(boton().textContent).not.toContain('Listo');
  });

  it('el aviso de la segunda exportación dura sus 2,5 s completos', async () => {
    render(<BackupExportButton />);
    await asentar();
    await exportarConExito();
    await avanzar(2000);
    await exportarConExito();
    // El temporizador del primer aviso vencería 500 ms después.
    await avanzar(600);
    expect(boton().textContent).toContain('Descarga iniciada');
    await avanzar(1900);
    expect(boton().textContent).toContain('Exportar copia ahora');
  });
});
