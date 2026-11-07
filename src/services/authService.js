/**
 * authService — Autenticación OAuth2 contra FarmOS.
 * Soporta Authorization Code + PKCE (recomendado) y Password Grant (legacy).
 * Persiste tokens solo en IndexedDB (tokenStore); sin IndexedDB el login falla
 * sin guardarlos.
 *
 * @module authService
 */

import {
    TokenStorageError,
    clearTokens,
    readToken,
    removeAux,
    saveNewSession,
    updateSession,
    writeAux,
} from './tokenStore';
import { endUserAccess } from './userSessionService';
import { clearActiveTenantId } from './tenantContext';
import { clearServerTier } from './tierService';
import { MSG } from '../config/messages';

const FARMOS_URL = import.meta.env.VITE_FARMOS_URL;
const CLIENT_ID = import.meta.env.VITE_FARMOS_CLIENT_ID;
// Activar ambos roles solo después de instalar chagra_productor en el servidor.
const OAUTH_SCOPES = import.meta.env.VITE_FARMOS_SCOPES || 'farm_manager';
const REDIRECT_URI = `${window.location.origin}/callback`;
export const SESSION_EXPIRED_EVENT = 'chagra:session-expired';
// Se emite cuando un login deja un access token nuevo. Lo escucha, entre
// otros, loadProModules: los módulos Pro exigen sesión en el servidor y no se
// pueden pedir antes de tenerla.
export const SESSION_STARTED_EVENT = 'chagra:session-started';
// Se emite cuando un cierre de sesión no pudo borrar los tokens del aparato.
// La sesión queda invalidada igual; la UI avisa al usuario.
export const LOGOUT_INCOMPLETE_EVENT = 'chagra:logout-incomplete';

const announceSessionStarted = () => {
    if (typeof window === 'undefined') return;
    try {
        window.dispatchEvent(new CustomEvent(SESSION_STARTED_EVENT));
    } catch (_) { /* CustomEvent existe en browsers soportados */ }
};

/**
 * DEPRECATION NOTICE: Password grant será removido después de esta fecha.
 *
 * RED DE SEGURIDAD (2026-05-30): la fecha se MOVIÓ de 2026-06-25 a 2026-09-25.
 * Motivo: el flujo Authorization Code + PKCE existía escrito pero MUERTO (no
 * estaba cableado a la UI ni al router). Si la fecha original se cumplía antes
 * de que PKCE estuviera cableado, probado en staging y con el redirect_uri de
 * producción registrado en el cliente OAuth de farmOS, TODOS los usuarios
 * quedaban sin poder loguearse (password grant lanza error y no había
 * alternativa viva). Verificado empíricamente contra el backend que el cliente
 * de producción NO tiene PKCE habilitado ni el redirect_uri de producción
 * registrado, así que el corte NO debe activarse hasta que el operador
 * complete esos pasos backend. Mover la fecha es el seguro inmediato.
 *
 * NO acercar de vuelta esta fecha hasta que se cumpla, en producción:
 *   1. redirect_uri de la PWA registrado en el cliente OAuth de farmOS.
 *   2. PKCE habilitado en el cliente (cliente público / pkce on).
 *   3. VITE_FARMOS_CLIENT_ID seteado en el build prod al cliente correcto.
 *   4. Flujo probado end-to-end en staging.
 *
 * LoginScreen conserva ambos flujos. PKCE solo se activa mediante
 * VITE_AUTH_PKCE_ENABLED, y password grant permanece disponible.
 */

/**
 * Interruptor de rollout del camino PKCE.
 *
 * `VITE_AUTH_PKCE_ENABLED=true` selecciona Authorization Code + PKCE. Si está
 * ausente o en 'false', se usa password grant. La fecha no interviene.
 */
const PKCE_ENABLED = import.meta.env.VITE_AUTH_PKCE_ENABLED === 'true';

/**
 * ¿Está esta instalación lista para intentar PKCE? Requiere la URL del
 * client_id OAuth en el build. FARMOS_URL puede estar vacío porque Nginx
 * proxyea /oauth al mismo origen; en ese caso la URL relativa sigue siendo
 * válida para construir /oauth/authorize. Si falta el client_id, redirigir
 * sería mandar al operador a una pantalla de error de farmOS con
 * client_id=undefined, así que se usa el fallback.
 *
 * @returns {boolean}
 */
export const puedeUsarPKCE = () => !!CLIENT_ID;

/**
 * Resuelve el camino de login disponible según configuración.
 * Función pura con dependencias inyectables para probar flag y configuración.
 *
 *   - 'pkce':      login vía Authorization Code + PKCE (redirect a farmOS).
 *                  Es el camino cuando el flag está activo y la config existe.
 *   - 'password':  password grant clásico, camino predeterminado.
 *   - 'bloqueado': PKCE activado, pero sin configuración operativa.
 *
 * @param {object} [deps] - overrides para tests.
 * @param {boolean} [deps.pkceOperativo] - config PKCE presente (default: puedeUsarPKCE()).
 * @param {boolean} [deps.pkceActivado] - rollout PKCE activo (default: flag del build).
 * @returns {{camino: 'pkce'|'password'|'bloqueado', passwordGrantVivo: boolean, motivo?: string}}
 */
export const resolverCaminoLogin = ({
    pkceOperativo = puedeUsarPKCE(),
    pkceActivado,
} = {}) => {
    const activado = pkceActivado !== undefined ? pkceActivado : PKCE_ENABLED;

    if (activado && pkceOperativo) {
        return { camino: 'pkce', passwordGrantVivo: true };
    }
    if (!activado) {
        return { camino: 'password', passwordGrantVivo: true };
    }
    return {
        camino: 'bloqueado',
        passwordGrantVivo: false,
        motivo: MSG.auth.instalacionSinCamino,
    };
};

/**
 * Genera un code_verifier random para PKCE (43-128 caracteres).
 * @returns {string} code_verifier en base64url sin padding
 */
export const generateCodeVerifier = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64UrlEncode(array);
};

/**
 * Genera el code_challenge SHA256 para PKCE.
 * @param {string} codeVerifier
 * @returns {Promise<string>} code_challenge en base64url sin padding
 */
export const generateCodeChallenge = async (codeVerifier) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(hash));
};

/**
 * Helper para codificar en base64url sin padding (RFC 4648 §5).
 * @param {Uint8Array} buffer
 * @returns {string}
 */
const base64UrlEncode = (buffer) => {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

/**
 * Inicia el flujo Authorization Code + PKCE redirigiendo a FarmOS.
 * @param {string} state - string aleatorio para CSRF protection
 * @param {string} [loginHint] - suggested username for the authorization page.
 */
export const initiateAuthorizationCodeFlow = async (state, loginHint = '') => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Persistir code_verifier para usarlo en el callback
    await writeAux('oauth_code_verifier', codeVerifier);
    await writeAux('oauth_state', state);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        scope: OAUTH_SCOPES,
    });
    // OAuth 2.0 login_hint is advisory. Do not persist or log the username.
    if (typeof loginHint === 'string' && loginHint.trim()) {
        params.set('login_hint', loginHint.trim());
    }

    const authUrl = `${FARMOS_URL}/oauth/authorize?${params.toString()}`;
    window.location.href = authUrl;
};

/**
 * Puerta de entrada del LoginScreen al flujo PKCE (task
 * URGENTE-login-se-apaga-25sep). Genera el state CSRF, persiste
 * verifier+state y redirige el navegador a farmOS (/oauth/authorize).
 *
 * Contrato NO-throw (mismo patrón que authenticateUser/exchangeCodeForToken):
 * devuelve `{ success: true }` cuando el redirect quedó en curso — el usuario
 * continúa en el dominio de farmOS y regresa por /callback (OAuthCallback,
 * ya cableado en App.jsx). Si algo falla ANTES de salir (config ausente,
 * crypto rota), devuelve `{ success: false, error }` para que el caller
 * decida el fallback sin dejar el botón colgado.
 *
 * @param {object} [deps] - overrides para tests.
 * @param {boolean} [deps.pkceOperativo] - config PKCE presente (default: puedeUsarPKCE()).
 * @param {string} [deps.username] - suggested username, forwarded without persistence.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const iniciarLoginPKCE = async ({ pkceOperativo = puedeUsarPKCE(), username = '' } = {}) => {
    if (!pkceOperativo) {
        console.warn('[Auth] PKCE solicitado sin configuración (VITE_FARMOS_URL / VITE_FARMOS_CLIENT_ID).');
        return {
            success: false,
            error: MSG.auth.pkceNoConfigurado,
        };
    }
    try {
        await initiateAuthorizationCodeFlow(generateOAuthState(), username);
        return { success: true };
    } catch (err) {
        console.error('[Auth] no se pudo iniciar el flujo PKCE:', err);
        return {
            success: false,
            error: MSG.auth.accesoSeguroFallido,
        };
    }
};

/**
 * Intercambia el authorization code por tokens (PKCE flow).
 * @param {string} code - authorization code del callback
 * @param {string} state - state del callback para validación
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const exchangeCodeForToken = async (code, state) => {
    console.info('[Auth] Intercambiando code por token (PKCE)');

    // Validar state
    let savedState;
    let codeVerifier;
    try {
        savedState = await readToken('oauth_state');
        codeVerifier = await readToken('oauth_code_verifier');
    } catch (_) {
        return { success: false, error: MSG.auth.almacenamientoNoDisponible };
    }
    if (state !== savedState) {
        return { success: false, error: 'State inválido. Posible ataque CSRF.' };
    }

    if (!codeVerifier) {
        return { success: false, error: 'Code verifier no encontrado. Flujo inválido.' };
    }

    const url = `${FARMOS_URL}/oauth/token`;
    const payload = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: payload.toString(),
        });

        if (!response.ok) {
            throw new Error(`Error de Autenticación: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('json')) {
            throw new Error('Backend FarmOS no disponible (modo instalacion detectado)');
        }

        const data = await response.json();

        // Solo IndexedDB; si no está, saveNewSession rechaza sin guardar nada.
        await saveNewSession({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiry: Date.now() + (data.expires_in * 1000),
        });

        // Limpiar PKCE state
        await removeAux('oauth_code_verifier');
        await removeAux('oauth_state');

        announceSessionStarted();
        return { success: true };
    } catch (error) {
        console.error("Fallo en el intercambio del token:", error);
        return { success: false, error: loginErrorMessage(error) };
    }
};

/**
 * Mensaje para un login fallido: el de almacenamiento si no hay IndexedDB,
 * el del error en los demás casos.
 * @param {Error} error
 * @returns {string}
 */
const loginErrorMessage = (error) => (
    error instanceof TokenStorageError ? MSG.auth.almacenamientoNoDisponible : error.message
);

/**
 * Autenticación OAuth2 Password Grant (LEGACY - DEPRECATED).
 *
 * PKCE permanece disponible como alternativa activable por configuración.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{success: boolean, error?: string, deprecation?: string}>}
 */
export const authenticateUser = async (username, password) => {
    const url = `${FARMOS_URL}/oauth/token`;

    const payload = new URLSearchParams({
        grant_type: 'password',
        client_id: CLIENT_ID,
        username: username,
        password: password,
        scope: OAUTH_SCOPES,
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: payload.toString(),
        });

        if (!response.ok) {
            throw new Error(`Error de Autenticación: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('json')) {
            throw new Error('Backend FarmOS no disponible (modo instalacion detectado)');
        }

        const data = await response.json();

        // Solo IndexedDB; si no está, saveNewSession rechaza sin guardar nada.
        await saveNewSession({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiry: Date.now() + (data.expires_in * 1000),
        });

        announceSessionStarted();
        return { success: true };
    } catch (error) {
        console.error("Fallo en la negociación del token:", error);
        return { success: false, error: loginErrorMessage(error) };
    }
};

/**
 * Refresca el access token usando el refresh_token persistido (OAuth2
 * `grant_type=refresh_token`).
 *
 * RAÍZ DEL BUG "sesión zombi" (operador 2026-06-18): el access token de farmOS
 * dura 1h (`expires_in: 3600`). Hasta ahora `getAccessToken()` SOLO comprobaba
 * la expiración y, al vencer, hacía `logoutUser()` y devolvía null — el
 * refresh_token se guardaba en el login pero NUNCA se usaba. Resultado: tras 1h
 * el operador volvía a la app con un token vencido y, en vez de renovarse
 * solo, la primera petición fallaba: el home mostraba "Tu sesión expiró"
 * (friendlyErrors 401), los contadores quedaban en "sin plantas" y el selector
 * de zona salía vacío. Verificado EN VIVO que el backend SÍ acepta el
 * `refresh_token` grant (devuelve un access nuevo + refresh rotado), así que la
 * renovación silenciosa es la cura correcta: re-loguearse a mano dejaba de ser
 * necesario.
 *
 * Idempotente y serializado: si dos llamadas concurrentes detectan expiración a
 * la vez, comparten la MISMA promesa de refresh (`refreshInFlight`) para no
 * disparar dos grants en paralelo (que rotarían el refresh_token dos veces y
 * uno quedaría inválido).
 *
 * @returns {Promise<string|null>} nuevo access token, o null si no hay
 *   refresh_token, el grant falla, o el grant está deshabilitado. NUNCA lanza.
 */
let refreshInFlight = null;
let lastRefreshFailureReason = null;

export const getLastRefreshFailureReason = () => lastRefreshFailureReason;

export const refreshAccessToken = async () => {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
        lastRefreshFailureReason = null;
        let refreshToken;
        try {
            refreshToken = await readToken('farmos_refresh_token');
        } catch (err) {
            console.error('[Auth] no se pudo leer el refresh_token:', err);
            lastRefreshFailureReason = 'storage';
            return null;
        }
        if (!refreshToken) {
            lastRefreshFailureReason = 'missing';
            return null;
        }

        const url = `${FARMOS_URL}/oauth/token`;
        const payload = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: CLIENT_ID,
            refresh_token: refreshToken,
            // Sin scope: conservar exactamente los concedidos al refresh original.
        });

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: payload.toString(),
            });

            if (!response.ok) {
                // 400/401 = refresh_token vencido o revocado: no hay nada que
                // renovar. El caller debe hacer logout limpio (no quedarse en
                // estado zombi). NO logueamos el body (puede traer el token).
                console.warn(`[Auth] refresh_token grant falló (${response.status}).`);
                lastRefreshFailureReason = [400, 401, 403].includes(response.status) ? 'rejected' : 'unavailable';
                return null;
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('json')) {
                console.warn('[Auth] respuesta de refresh sin JSON (backend caído?).');
                lastRefreshFailureReason = 'invalid-response';
                return null;
            }

            const data = await response.json();
            if (!data.access_token) {
                lastRefreshFailureReason = 'invalid-response';
                return null;
            }

            // El refresh_token suele rotar en cada uso: persistir el nuevo si
            // viene, conservar el anterior si el backend no lo rota.
            const expiresIn = Number(data.expires_in) || 3600;
            const updated = await updateSession({
                accessToken: data.access_token,
                refreshToken: data.refresh_token || undefined,
                expiry: Date.now() + expiresIn * 1000,
            });
            if (!updated) {
                // La sesión se cerró mientras el refresh estaba en vuelo.
                lastRefreshFailureReason = 'missing';
                return null;
            }

            console.info('[Auth] access token renovado vía refresh_token grant.');
            return data.access_token;
        } catch (err) {
            // Red caída / timeout: NO es expiración del refresh. Devolvemos null
            // para que el caller no rompa, pero el caller NO debe hacer logout
            // por un fallo de red (ver getAccessToken: solo logout si había
            // refresh_token y el grant lo rechazó explícitamente).
            console.error('[Auth] error de red al refrescar el token:', err);
            lastRefreshFailureReason = 'network';
            return null;
        }
    })();

    try {
        return await refreshInFlight;
    } finally {
        refreshInFlight = null;
    }
};

export const expireSession = async (detail = {}) => {
    await logoutUser();
    if (typeof window !== 'undefined') {
        window.location.hash = '#login';
        try {
            window.dispatchEvent(
                new CustomEvent(SESSION_EXPIRED_EVENT, { detail })
            );
        } catch (_) { /* CustomEvent existe en browsers soportados */ }
    }
};

/**
 * Lee el access token persistido. Si está expirado, intenta RENOVARLO con el
 * refresh_token antes de rendirse; solo si la renovación falla por
 * refresh_token vencido/revocado hace un logout limpio (evita el estado zombi).
 *
 * @returns {Promise<string|null>} token activo (renovado si hizo falta), o null
 *   si no existe / no se pudo renovar / el almacenamiento falló (defensive: la app
 *   debe tratar null como "no auth").
 */
export const getAccessToken = async () => {
    try {
        const token = await readToken('farmos_access_token');
        const expiry = await readToken('farmos_token_expiry');

        if (token && expiry && Date.now() > expiry) {
            // Token vencido: intentar renovación silenciosa con el refresh_token
            // ANTES de cerrar la sesión (la cura del bug "sesión zombi").
            const refreshed = await refreshAccessToken();
            if (refreshed) return refreshed;

            // La renovación no dio token. Distinguir dos casos para no cerrar la
            // sesión por un simple fallo de red (offline-first):
            //   - HAY refresh_token pero el grant lo rechazó → sesión realmente
            //     muerta → logout limpio (la app lleva a #login, sin zombi).
            //   - red caída / sin refresh_token → devolver null SIN borrar nada:
            //     al recuperar conexión el siguiente intento renovará y el
            //     usuario no pierde su sesión por estar offline un rato.
            let hadRefresh = false;
            try {
                hadRefresh = !!(await readToken('farmos_refresh_token'));
            } catch (_) { /* asumir que no, fail-safe */ }

            if (
                hadRefresh &&
                navigator.onLine !== false &&
                lastRefreshFailureReason === 'rejected'
            ) {
                await expireSession({ reason: 'refresh-rejected' });
            }
            return null;
        }

        return token;
    } catch (err) {
        console.error('[Auth] getAccessToken failed:', err);
        return null;
    }
};

/**
 * Limpia los tokens persistidos. No-throw. Si el borrado falla, la sesión
 * queda revocada igual (tokenStore deja de leer los tokens que quedaron) y se
 * emite LOGOUT_INCOMPLETE_EVENT para que la UI avise.
 *
 * @returns {Promise<{tokensBorrados: boolean}>}
 */
export const logoutUser = async () => {
    endUserAccess();
    const tokensBorrados = await clearTokens();
    if (!tokensBorrados && typeof window !== 'undefined') {
        try {
            window.dispatchEvent(new CustomEvent(LOGOUT_INCOMPLETE_EVENT));
        } catch (_) { /* CustomEvent existe en browsers soportados */ }
    }
    // ADR-036 MVP multi-finca: limpiar tenantId asegura que un re-login con
    // otro usuario no herede el scope del anterior. NO purgamos IDB aquí —
    // useAssetStore decide qué hacer al detectar el cambio de tenantId.
    try {
        clearActiveTenantId();
    } catch (err) {
        console.warn('[Auth] clearActiveTenantId failed:', err);
    }
    clearServerTier();
    return { tokensBorrados };
};

/**
 * @returns {Promise<boolean>} true si hay token vigente. Nunca throw —
 *   delega en getAccessToken() que es defensive.
 */
export const isAuthenticated = async () => {
    const token = await getAccessToken();
    return !!token;
};

/**
 * Genera un state random para protección CSRF en OAuth flow.
 * @returns {string} state en base64url
 */
export const generateOAuthState = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return base64UrlEncode(array);
};

/**
 * Procesa el callback de OAuth desde la URL (después de redirect).
 * @param {URLSearchParams} params - URL search params del callback
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const handleOAuthCallback = async (params) => {
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
        const errorDescription = params.get('error_description') || error;
        return { success: false, error: `Error de autorización: ${errorDescription}` };
    }

    if (!code || !state) {
        return { success: false, error: 'Parámetros inválidos en callback' };
    }

    return await exchangeCodeForToken(code, state);
};
