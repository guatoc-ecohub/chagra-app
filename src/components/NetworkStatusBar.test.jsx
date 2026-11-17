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

  it('does not keep an idle online bar visible after an earlier error', async () => {
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
    expect(screen.queryByText('Temporary sync issue')).toBeNull();
    expect(screen.queryByText('Conectado.')).toBeNull();
  });

  it('keeps a newer error visible when an earlier error timeout expires', async () => {
    render(<NetworkStatusBar />);
    await settlePromises();

    act(() => {
      window.dispatchEvent(new CustomEvent('syncError', { detail: { message: 'First sync issue' } }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('syncError', { detail: { message: 'Current sync issue' } }));
    });
    expect(screen.getByText('Current sync issue')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.getByText('Current sync issue')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.queryByText('Current sync issue')).toBeNull();
  });

  it.each([
    ['offline', { pendingCount: 2, isOnline: false, isSyncing: false }, false],
    ['syncing', { pendingCount: 2, isOnline: true, isSyncing: true }, true],
  ])('hides after polling online and idle from %s', async (_priorState, initialStats, dispatchOnline) => {
    mocks.getSyncStats.mockResolvedValue(initialStats);
    const { container } = render(<NetworkStatusBar />);
    await settlePromises();

    if (dispatchOnline) {
      act(() => window.dispatchEvent(new Event('online')));
      await settlePromises();
    }

    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();

    mocks.getSyncStats.mockResolvedValue({ pendingCount: 2, isOnline: true, isSyncing: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(container.querySelector('[aria-live="polite"]')).toBeNull();
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
