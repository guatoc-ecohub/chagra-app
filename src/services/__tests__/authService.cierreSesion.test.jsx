// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Con IndexedDB: los tokens viven ahí y no en localStorage. Si el borrado
 * falla al cerrar sesión, la sesión queda inválida y el usuario ve el aviso.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { useCallback, useState } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';

const ACCESS = 'AT-prueba-idb-5d1e';
const REFRESH = 'RT-prueba-idb-0b77';

const tokenResponse = () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ access_token: ACCESS, refresh_token: REFRESH, expires_in: 3600 }),
});

const webStorageDump = () => {
    const out = [];
    for (const area of [localStorage, sessionStorage]) {
        for (let i = 0; i < area.length; i += 1) {
            const k = area.key(i);
            out.push(`${k}=${area.getItem(k)}`);
        }
    }
    return out.join('\n');
};

// Lee IndexedDB directo, sin pasar por la revocación de tokenStore.
const rawToken = async (key) => {
    const { default: localforage } = await import('localforage');
    const raw = localforage.createInstance({ name: 'Chagra', storeName: 'syncQueue', driver: localforage.INDEXEDDB });
    return raw.getItem(key);
};

const failDeletes = () => vi.spyOn(globalThis.IDBObjectStore.prototype, 'delete')
    .mockImplementation(() => { throw new Error('fallo simulado de borrado'); });

describe('tokens en IndexedDB y cierre de sesión', () => {
    let fetchMock;
    beforeEach(async () => {
        vi.resetModules();
        localStorage.clear();
        sessionStorage.clear();
        fetchMock = vi.fn(async () => tokenResponse());
        vi.stubGlobal('fetch', fetchMock);
        const { clearTokens } = await import('../tokenStore');
        await clearTokens();
    });
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('login guarda solo en IndexedDB', async () => {
        const { authenticateUser, getAccessToken } = await import('../authService');
        const res = await authenticateUser('usuario', 'clave');
        expect(res.success).toBe(true);
        expect(await getAccessToken()).toBe(ACCESS);
        expect(await rawToken('farmos_refresh_token')).toBe(REFRESH);
        const dump = webStorageDump();
        expect(dump).not.toContain(ACCESS);
        expect(dump).not.toContain(REFRESH);
    });

    it('control: logout con borrado sano borra los tokens y no avisa', async () => {
        const { authenticateUser, logoutUser, LOGOUT_INCOMPLETE_EVENT } = await import('../authService');
        await authenticateUser('usuario', 'clave');
        const onIncomplete = vi.fn();
        window.addEventListener(LOGOUT_INCOMPLETE_EVENT, onIncomplete);
        const out = await logoutUser();
        window.removeEventListener(LOGOUT_INCOMPLETE_EVENT, onIncomplete);
        expect(out).toEqual({ tokensBorrados: true });
        expect(onIncomplete).not.toHaveBeenCalled();
        expect(await rawToken('farmos_access_token')).toBeNull();
    });

    it('logout con borrado que lanza: la sesión queda inválida aunque el token siga en disco', async () => {
        const auth = await import('../authService');
        const { hasStoredAccessToken } = await import('../sessionSignals');
        await auth.authenticateUser('usuario', 'clave');
        expect(await auth.isAuthenticated()).toBe(true);

        failDeletes();
        const out = await auth.logoutUser();
        console.info('[cierre] resultado logout:', JSON.stringify(out));

        expect(out).toEqual({ tokensBorrados: false });
        // El token sigue físicamente en IndexedDB: la prueba ejerce la revocación.
        expect(await rawToken('farmos_access_token')).toBe(ACCESS);
        expect(await auth.getAccessToken()).toBeNull();
        expect(await auth.isAuthenticated()).toBe(false);
        expect(await hasStoredAccessToken()).toBe(false);

        const callsBefore = fetchMock.mock.calls.length;
        expect(await auth.refreshAccessToken()).toBeNull();
        expect(fetchMock.mock.calls.length).toBe(callsBefore);

        // Recarga de la página: la revocación persiste.
        vi.resetModules();
        const recargado = await import('../authService');
        expect(await recargado.getAccessToken()).toBeNull();

        // Un login nuevo levanta la revocación.
        vi.restoreAllMocks();
        vi.stubGlobal('fetch', fetchMock);
        expect((await recargado.authenticateUser('usuario', 'clave')).success).toBe(true);
        expect(await recargado.getAccessToken()).toBe(ACCESS);
    });

    it('el usuario ve el aviso cuando el borrado falla', async () => {
        const { authenticateUser, logoutUser } = await import('../authService');
        const { default: useAvisoCierreIncompleto } = await import('../../hooks/useAvisoCierreIncompleto');
        const { MSG } = await import('../../config/messages');

        // Mismo contrato que el toast de App: showToast(message, isError).
        function Harness() {
            const [toast, setToast] = useState(null);
            const showToast = useCallback((message, isError = false) => setToast({ message, isError }), []);
            useAvisoCierreIncompleto(showToast);
            return toast ? <div role={toast.isError ? 'alert' : 'status'}>{toast.message}</div> : null;
        }

        await authenticateUser('usuario', 'clave');
        render(<Harness />);
        expect(screen.queryByRole('alert')).toBeNull();

        failDeletes();
        await act(async () => { await logoutUser(); });

        const alert = screen.getByRole('alert');
        console.info('[cierre] aviso visible:', alert.textContent);
        expect(alert.textContent).toBe(MSG.auth.cierreSesionIncompleto);
    });
});
