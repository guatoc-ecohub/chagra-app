// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Navegador sin IndexedDB (jsdom no lo trae): el login debe fallar sin dejar
 * ningún token en localStorage ni en sessionStorage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ACCESS = 'AT-prueba-sin-idb-7f3a';
const REFRESH = 'RT-prueba-sin-idb-91c2';

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

describe('tokens sin IndexedDB', () => {
    beforeEach(() => {
        vi.resetModules();
        localStorage.clear();
        sessionStorage.clear();
        vi.stubGlobal('fetch', vi.fn(async () => tokenResponse()));
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('control: localforage sin driver fijado SÍ cae a localStorage en este entorno', async () => {
        expect(typeof globalThis.indexedDB).toBe('undefined');
        const { default: localforage } = await import('localforage');
        const inst = localforage.createInstance({ name: 'Chagra', storeName: 'syncQueue' });
        await inst.setItem('farmos_access_token', ACCESS);
        expect(webStorageDump()).toContain(ACCESS);
    });

    it('password grant: falla de forma segura y no persiste el token', async () => {
        const { authenticateUser, getAccessToken } = await import('../authService');
        const { MSG } = await import('../../config/messages');

        const res = await authenticateUser('usuario', 'clave');
        const dump = webStorageDump();
        console.info('[sin-idb] resultado login:', JSON.stringify(res));
        console.info('[sin-idb] web storage tras login:\n' + (dump || '(vacío)'));

        expect(res.success).toBe(false);
        expect(res.error).toBe(MSG.auth.almacenamientoNoDisponible);
        expect(dump).not.toContain(ACCESS);
        expect(dump).not.toContain(REFRESH);
        expect(await getAccessToken()).toBeNull();
    });

    it('PKCE: iniciar y completar el flujo no deja verifier ni tokens', async () => {
        const { iniciarLoginPKCE, exchangeCodeForToken } = await import('../authService');
        const inicio = await iniciarLoginPKCE({ pkceOperativo: true });
        const afterStart = webStorageDump();
        // Si una versión insegura guardó el state en localStorage, se usa para
        // completar el flujo y ver si además persiste los tokens.
        const leaked = localStorage.getItem('Chagra/syncQueue/oauth_state')
            || localStorage.getItem('localforage/oauth_state');
        const state = leaked ? JSON.parse(leaked) : 'state';
        const res = await exchangeCodeForToken('code', state);
        const dump = webStorageDump();
        console.info('[sin-idb] PKCE inicio:', JSON.stringify(inicio), 'intercambio:', JSON.stringify(res));
        console.info('[sin-idb] web storage tras PKCE:\n' + (dump || '(vacío)'));
        expect(inicio.success).toBe(false);
        expect(afterStart).not.toContain('oauth_code_verifier');
        expect(afterStart).not.toContain('oauth_state');
        expect(res.success).toBe(false);
        expect(dump).not.toContain(ACCESS);
        expect(dump).not.toContain(REFRESH);
    });

    it('borra copias heredadas que una versión anterior dejó en localStorage', async () => {
        localStorage.setItem('Chagra/syncQueue/farmos_access_token', JSON.stringify(ACCESS));
        localStorage.setItem('Chagra/syncQueue/farmos_refresh_token', JSON.stringify(REFRESH));
        await import('../tokenStore');
        const dump = webStorageDump();
        expect(dump).not.toContain(ACCESS);
        expect(dump).not.toContain(REFRESH);
    });
});
