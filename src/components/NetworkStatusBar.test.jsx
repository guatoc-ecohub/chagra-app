// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MSG } from '../config/messages.js';

const mocks = vi.hoisted(() => ({
  getSyncStats: vi.fn(),
  getFailedTransactions: vi.fn(),
}));

vi.mock('../services/syncManager', () => ({ syncManager: mocks }));

import NetworkStatusBar from './NetworkStatusBar.jsx';

const settlePromises = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('NetworkStatusBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    mocks.getSyncStats.mockResolvedValue({ pendingCount: 2, isOnline: true, isSyncing: false });
    mocks.getFailedTransactions.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps the current online state visible after an earlier error timer expires', async () => {
    render(<NetworkStatusBar />);
    await settlePromises();

    act(() => {
      window.dispatchEvent(new CustomEvent('syncError', { detail: { message: 'Temporary sync issue' } }));
    });
    expect(screen.getByText('Temporary sync issue')).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });
    expect(screen.getByText(MSG.ui.sincronizandoRegistros(2))).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(screen.getByText('Conectado.')).toBeTruthy();
  });

  it.each([
    ['pending records', 2, []],
    ['failed records', 0, [{ id: 'failed-record' }]],
  ])('leaves syncing when a batch ends with %s', async (_label, pendingCount, failed) => {
    render(<NetworkStatusBar />);
    await settlePromises();

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });

    mocks.getSyncStats.mockResolvedValue({ pendingCount, isOnline: true, isSyncing: false });
    mocks.getFailedTransactions.mockResolvedValue(failed);
    await act(async () => {
      window.dispatchEvent(new CustomEvent('syncComplete', { detail: { synced: 1 } }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(MSG.status.errorSincronizar)).toBeTruthy();
  });
});
