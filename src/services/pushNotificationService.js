/** Cliente Web Push. La suscripción es voluntaria y se envía por ruta relativa. */
import { fetchWithAuthRetry } from './apiService';
import { resolveClimaLocation } from './climaService';

const SUBSCRIPTION_PATH = '/api/push/subscriptions';
const locationSyncConfigs = new Map();
let locationListenerInstalled = false;

function resolvePushLocation() {
    const location = resolveClimaLocation();
    if (!location
        || !Number.isFinite(location.lat)
        || !Number.isFinite(location.lng)
        || !Number.isFinite(location.elevation)) return null;
    return {
        lat: location.lat,
        lon: location.lng,
        altitud_m: location.elevation,
    };
}

function installLocationSync(endpoint, fincaId) {
    if (typeof window === 'undefined') return;
    locationSyncConfigs.set(`${endpoint}\n${fincaId}`, { endpoint, fincaId });
    if (locationListenerInstalled) return;
    locationListenerInstalled = true;
    window.addEventListener('chagra:location-updated', async () => {
        const ubicacion = resolvePushLocation();
        if (!ubicacion) return;
        for (const { endpoint: target, fincaId: farmId } of locationSyncConfigs.values()) {
            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                if (!subscription) continue;
                const query = `?fincaId=${encodeURIComponent(farmId)}&endpoint=${encodeURIComponent(subscription.endpoint)}`;
                const status = await fetchWithAuthRetry(`${target}${query}`, { method: 'GET', credentials: 'same-origin' });
                if (!status.ok || (await status.json())?.active !== true) continue;
                await fetchWithAuthRetry(target, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ fincaId: farmId, subscription: subscription.toJSON(), ubicacion }),
                });
            } catch { /* Un evento posterior o el siguiente cambio reintentará. */ }
        }
    });
}

function base64ToBytes(value) {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const raw = atob(`${value.replace(/-/g, '+').replace(/_/g, '/')}${padding}`);
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function canUseWebPush() {
    return typeof window !== 'undefined'
        && 'Notification' in window
        && 'serviceWorker' in navigator
        && 'PushManager' in window;
}

/**
 * Solicita permiso solo después de una acción explícita del usuario y registra
 * la suscripción en el backend configurado por el deploy.
 *
 * @param {Object} [opciones]
 * @param {string} [opciones.vapidPublicKey] Clave pública VAPID (por defecto VITE_WEB_PUSH_PUBLIC_KEY).
 * @param {string} [opciones.endpoint] Ruta del backend (por defecto SUBSCRIPTION_PATH).
 * @param {string|null} [opciones.fincaId] Finca activa a la que se asocia la suscripción.
 */
export async function enablePushNotifications({
    vapidPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY,
    endpoint = SUBSCRIPTION_PATH,
    fincaId,
} = {}) {
    if (!canUseWebPush()) return { ok: false, reason: 'unsupported' };
    if (!vapidPublicKey) return { ok: false, reason: 'not_configured' };
    if (!fincaId) return { ok: false, reason: 'farm_not_configured' };
    const ubicacion = resolvePushLocation();
    if (!ubicacion) return { ok: false, reason: 'location_required' };

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: permission };

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToBytes(vapidPublicKey),
    });
    const response = await fetchWithAuthRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ fincaId, subscription: subscription.toJSON(), ubicacion }),
    });
    if (!response.ok) throw new Error(`push_subscription_${response.status}`);
    installLocationSync(endpoint, fincaId);
    return { ok: true };
}

/**
 * @param {Object} [opciones]
 * @param {string} [opciones.endpoint] Ruta del backend (por defecto SUBSCRIPTION_PATH).
 * @param {string|null} [opciones.fincaId] Finca activa dueña de la suscripción a dar de baja.
 */
export async function disablePushNotifications({ endpoint = SUBSCRIPTION_PATH, fincaId } = {}) {
    if (!fincaId) return { ok: false, reason: 'farm_not_configured' };
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { ok: false, reason: 'subscription_missing' };
    const response = await fetchWithAuthRetry(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ fincaId, endpoint: subscription.endpoint }),
    });
    if (!response.ok) throw new Error(`push_unsubscribe_${response.status}`);
    await subscription.unsubscribe();
    return { ok: true };
}

/**
 * @param {Object} [opciones]
 * @param {string} [opciones.vapidPublicKey] Clave pública VAPID (por defecto VITE_WEB_PUSH_PUBLIC_KEY).
 * @param {string} [opciones.endpoint] Ruta del backend (por defecto SUBSCRIPTION_PATH).
 * @param {string|null} [opciones.fincaId] Finca activa cuya suscripción se consulta.
 */
export async function getPushNotificationStatus({
    vapidPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY,
    endpoint = SUBSCRIPTION_PATH,
    fincaId,
} = {}) {
    if (!canUseWebPush() || !vapidPublicKey || !fincaId) return { active: false };
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription || Notification.permission !== 'granted') return { active: false };
        const response = await fetchWithAuthRetry(`${endpoint}?fincaId=${encodeURIComponent(fincaId)}&endpoint=${encodeURIComponent(subscription.endpoint)}`, {
            method: 'GET',
            credentials: 'same-origin',
        });
        if (!response.ok) return { active: false };
        const body = await response.json();
        const active = body?.active === true;
        if (active) installLocationSync(endpoint, fincaId);
        return { active };
    } catch {
        return { active: false };
    }
}
