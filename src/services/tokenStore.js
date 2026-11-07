// SPDX-License-Identifier: AGPL-3.0-only
/**
 * tokenStore — único lugar donde se guardan los tokens OAuth.
 *
 * Solo IndexedDB: la instancia fija el driver y no tiene respaldo, así que
 * localforage nunca cae a localStorage (texto plano legible por cualquier
 * script del origen). Sin IndexedDB cada operación rechaza y el login falla
 * sin persistir nada.
 *
 * Usa el mismo name/storeName que la instancia global (main.jsx), de modo que
 * las instalaciones existentes conservan la sesión guardada.
 *
 * Revocación: si al cerrar sesión el borrado falla, la sesión se marca como
 * revocada (en memoria y con una marca sin secretos en localStorage) y los
 * tokens que hayan quedado dejan de leerse hasta que un borrado o un login
 * nuevo tengan éxito.
 *
 * @module tokenStore
 */

import localforage from 'localforage';

const STORE_NAME = 'Chagra';
const STORE_TABLE = 'syncQueue';

export const SESSION_KEYS = Object.freeze([
    'farmos_access_token',
    'farmos_refresh_token',
    'farmos_token_expiry',
]);
const PKCE_KEYS = Object.freeze(['oauth_code_verifier', 'oauth_state']);
const ALL_KEYS = Object.freeze([...SESSION_KEYS, ...PKCE_KEYS]);

const REVOKED_FLAG = 'chagra:sesion-revocada';

// Error de almacenamiento (IndexedDB ausente o rota). El login lo distingue
// de un fallo de red para mostrar el aviso correcto.
export class TokenStorageError extends Error {
    constructor(cause) {
        super('Almacenamiento seguro no disponible');
        this.name = 'TokenStorageError';
        this.cause = cause;
    }
}

let store = null;
let revokedInMemory = false;

const getStore = () => {
    if (!store) {
        store = localforage.createInstance({
            name: STORE_NAME,
            storeName: STORE_TABLE,
            driver: localforage.INDEXEDDB,
        });
    }
    return store;
};

const isRevoked = () => {
    if (revokedInMemory) return true;
    try {
        return globalThis.localStorage?.getItem(REVOKED_FLAG) === '1';
    } catch (_) {
        return false;
    }
};

const markRevoked = () => {
    revokedInMemory = true;
    try { globalThis.localStorage?.setItem(REVOKED_FLAG, '1'); } catch (_) { /* queda en memoria */ }
};

const clearRevoked = () => {
    revokedInMemory = false;
    try { globalThis.localStorage?.removeItem(REVOKED_FLAG); } catch (_) { /* sin localStorage */ }
};

/**
 * Borra copias que versiones anteriores pudieron dejar en localStorage cuando
 * localforage caía a ese driver (claves `Chagra/syncQueue/<clave>`).
 * Nunca lanza.
 */
export const purgeLegacyCopies = () => {
    try {
        const ls = globalThis.localStorage;
        if (!ls) return;
        ALL_KEYS.forEach((key) => ls.removeItem(`${STORE_NAME}/${STORE_TABLE}/${key}`));
    } catch (_) { /* sin localStorage: no hay copias */ }
};

const wrap = async (fn) => {
    try {
        return await fn();
    } catch (err) {
        throw new TokenStorageError(err);
    }
};

/**
 * Lee una clave. Las claves de sesión devuelven null si la sesión fue revocada.
 * @param {string} key
 * @returns {Promise<any>} rechaza con TokenStorageError si no hay IndexedDB.
 */
export const readToken = (key) => {
    if (SESSION_KEYS.includes(key) && isRevoked()) return Promise.resolve(null);
    return wrap(() => getStore().getItem(key));
};

/**
 * Escribe una clave auxiliar (estado PKCE).
 * @param {string} key
 * @param {any} value
 */
export const writeAux = (key, value) => wrap(() => getStore().setItem(key, value));

/** @param {string} key */
export const removeAux = (key) => wrap(() => getStore().removeItem(key));

const writeSession = async ({ accessToken, refreshToken, expiry }) => {
    const s = getStore();
    await s.setItem('farmos_access_token', accessToken);
    if (refreshToken !== undefined) await s.setItem('farmos_refresh_token', refreshToken);
    await s.setItem('farmos_token_expiry', expiry);
};

/**
 * Guarda los tokens de un login nuevo y levanta una revocación previa.
 * Si la escritura falla a medias, intenta borrar lo escrito.
 * @param {{accessToken: string, refreshToken?: string, expiry: number}} tokens
 * @returns {Promise<void>} rechaza con TokenStorageError.
 */
export const saveNewSession = async (tokens) => {
    purgeLegacyCopies();
    try {
        await writeSession(tokens);
    } catch (err) {
        await clearTokens();
        throw new TokenStorageError(err);
    }
    clearRevoked();
};

/**
 * Actualiza tokens renovados (refresh). No escribe si la sesión fue revocada:
 * un refresh en vuelo no puede resucitar una sesión cerrada.
 * @param {{accessToken: string, refreshToken?: string, expiry: number}} tokens
 * @returns {Promise<boolean>} false si la sesión estaba revocada.
 */
export const updateSession = async (tokens) => {
    if (isRevoked()) return false;
    await wrap(() => writeSession(tokens));
    return true;
};

/**
 * Borra todos los tokens. Si el borrado falla, revoca la sesión de todas
 * formas. Nunca lanza.
 * @returns {Promise<boolean>} true si los tokens quedaron borrados.
 */
export const clearTokens = async () => {
    purgeLegacyCopies();
    try {
        const s = getStore();
        for (const key of ALL_KEYS) {
            await s.removeItem(key);
        }
        clearRevoked();
        return true;
    } catch (err) {
        console.error('[Auth] no se pudieron borrar los tokens; la sesión queda revocada:', err);
        markRevoked();
        return false;
    }
};

purgeLegacyCopies();
