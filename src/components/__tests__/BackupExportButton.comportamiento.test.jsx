// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Comportamiento observable de «Exportar copia». Solo caminos legales (una
 * exportación a la vez y sin pisar el aviso anterior): debe pasar igual
 * contra la versión con tres booleanos sueltos.
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

describe('BackupExportButton — comportamiento observable', () => {
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

  it('reposo → exportando → «Descarga iniciada» 2,5 s → reposo', async () => {
    render(<BackupExportButton />);
    await asentar();
    expect(boton().textContent).toContain('Exportar copia ahora');
    expect(boton().disabled).toBe(false);

    fireEvent.click(boton());
    await asentar();
    expect(boton().textContent).toContain('Exportando…');
    expect(boton().disabled).toBe(true);

    copia.pendiente.resolve();
    await asentar();
    expect(boton().textContent).toContain('Descarga iniciada');
    expect(boton().disabled).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();

    await avanzar(2499);
    expect(boton().textContent).toContain('Descarga iniciada');
    await avanzar(1);
    expect(boton().textContent).toContain('Exportar copia ahora');
  });

  it('un fallo muestra la alerta, que se queda hasta el próximo intento', async () => {
    render(<BackupExportButton />);
    await asentar();
    fireEvent.click(boton());
    await asentar();
    copia.pendiente.reject(new Error('Almacenamiento lleno'));
    await asentar();
    expect(boton().textContent).toContain('Exportar copia ahora');
    expect(boton().disabled).toBe(false);
    expect(screen.getByRole('alert').textContent).toBe('Almacenamiento lleno');

    await avanzar(60000);
    expect(screen.getByRole('alert').textContent).toBe('Almacenamiento lleno');

    fireEvent.click(boton());
    await asentar();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(boton().textContent).toContain('Exportando…');
    copia.pendiente.resolve();
    await asentar();
    expect(boton().textContent).toContain('Descarga iniciada');
  });

  it('un fallo sin mensaje usa el texto por omisión', async () => {
    render(<BackupExportButton />);
    await asentar();
    fireEvent.click(boton());
    await asentar();
    copia.pendiente.reject({});
    await asentar();
    expect(screen.getByRole('alert').textContent).toBe('No se pudo exportar.');
  });

  it('variante compacta: «Exportar copia» → deshabilitado → «Listo» 2,5 s → «Exportar copia»', async () => {
    render(<BackupExportButton compact />);
    await asentar();
    expect(boton().textContent).toContain('Exportar copia');
    fireEvent.click(boton());
    await asentar();
    expect(boton().disabled).toBe(true);
    copia.pendiente.resolve();
    await asentar();
    expect(boton().textContent).toContain('Listo');
    await avanzar(2500);
    expect(boton().textContent).toContain('Exportar copia');
    expect(boton().textContent).not.toContain('Listo');
  });
});
