/*
 * i18n: mensajes de consola en español Colombia pendientes de
 * migrar a src/config/messages.js — mismo criterio que userProfileService.js.
 */
/* eslint-disable chagra-i18n/no-hardcoded-spanish */
/**
 * onboardingProfileSync.js — persistencia del onboarding entre dispositivos
 * (C04 2026-10-31).
 *
 * Antes de este módulo, el onboarding completo (compai, nombre, identidad,
 * sellos, tamaño, animales) vivía SOLO en `localStorage`, salvo la ubicación
 * confirmada (farmLocationSync.js). Un ingreso nuevo en otro navegador/
 * aparato con la MISMA cuenta repetía "Elija su compai" desde cero, porque no
 * había nada que leer del lado del servidor.
 *
 * Reutiliza el MISMO recurso farmOS que farmLocationSync.js (el asset--land
 * "Mi finca"), pero bajo una llave de `data` JSON distinta
 * (`chagra_onboarding_profile_v1`) para no interferir con esa sincronización
 * — cada una lee/escribe su propia clave dentro del mismo blob `data`.
 *
 * Alcance deliberadamente MENOR que farmLocationSync.js: no crea una finca
 * nueva solo para cargar este marcador (si la cuenta no tiene ninguna, el
 * push es un no-op silencioso — la ubicación, que siempre se da durante el
 * mismo onboarding, crea la finca primero) y no mantiene una cola de
 * reintentos persistente — un reintento best-effort en 'online'/'focus'
 * alcanza para el caso de uso (completar el onboarding una vez).
 */
import { fetchFromFarmOS, sendToFarmOS } from './apiService.js';
import { getActiveTenantId } from './tenantContext.js';
import {
  getProfile, saveProfile, hasSeenProfileOnboarding, getProfileCompletionFlags,
  markProfileDone, markProfileSkipped,
} from './userProfileService.js';
import { leerCompanero, escribirCompanero } from '../compai/nucleo/elenco.js';

const MARKER = 'chagra_onboarding_profile_v1';

// Respuestas del onboarding que definen "cómo es esta cuenta" — no incluye
// campos diferidos de texto libre (cultivos_interes, problemas, objetivo…)
// para mantener el payload sincronizado acotado a lo que el onboarding de
// 8 pasos y su cola extendida realmente preguntan.
const SYNCED_FIELDS = Object.freeze([
  'nombre', 'vocacion', 'rol', 'finca_tipo', 'escala', 'composicion',
  'animales', 'cantidades_animales', 'gallinas_manejo',
  'invernadero_tiene', 'invernadero_forma', 'invernadero_tamano',
  'cultivos_actuales', 'sellos', 'guardian_especie',
]);

function pickSyncedProfile(profile = {}) {
  return Object.fromEntries(SYNCED_FIELDS
    .filter((key) => profile[key] !== undefined && profile[key] !== null)
    .map((key) => [key, profile[key]]));
}

function resourceList(response) {
  if (Array.isArray(response?.data)) return response.data;
  return response?.data ? [response.data] : [];
}

function readData(asset) {
  const raw = asset?.attributes?.data;
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

/** Todos los assets--land de la cuenta (cualquier finca, propia o no). */
async function fetchAccountLandAssets(tenant) {
  const assets = [];
  const query = `/api/asset/land?filter[uid.name]=${encodeURIComponent(tenant)}`;
  for (let offset = 0; ; offset += 50) {
    const page = await fetchFromFarmOS(`${query}&page[limit]=50&page[offset]=${offset}`);
    const batch = resourceList(page);
    assets.push(...batch);
    if (!page?.links?.next || batch.length === 0) break;
  }
  return assets;
}

/**
 * ¿Esta cuenta ya completó/saltó el onboarding en OTRO dispositivo? Si el
 * perfil local todavía no lo vio, restaura lo que encuentre antes de que el
 * caller decida a dónde navegar.
 *
 * No-op (false) si: ya hay marca local, no hay sesión/red, o no hay ningún
 * asset marcado para esta cuenta. Nunca lanza — una falla de red no puede
 * bloquear el login.
 *
 * @returns {Promise<boolean>} true si restauró algo.
 */
export async function restoreOnboardingProfileIfMissing() {
  if (hasSeenProfileOnboarding()) return false;
  const tenant = getActiveTenantId();
  if (!tenant) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try {
    const assets = await fetchAccountLandAssets(tenant);
    const marked = assets.find((asset) => readData(asset)[MARKER]);
    if (!marked) return false;
    const remote = readData(marked)[MARKER];
    if (!remote || typeof remote !== 'object' || (!remote.done && !remote.skipped)) return false;
    if (getActiveTenantId() !== tenant) return false; // cambió de cuenta mientras esperábamos la red.

    if (remote.profile && typeof remote.profile === 'object') {
      saveProfile(pickSyncedProfile(remote.profile));
    }
    if (typeof remote.avatarType === 'string') {
      try { escribirCompanero(remote.avatarType); } catch (_) { /* slug inválido: se ignora */ }
    }
    if (remote.done) markProfileDone();
    else if (remote.skipped) markProfileSkipped();
    try {
      window.dispatchEvent(new CustomEvent('chagra:profile-changed', { detail: { restoredFromFarmOS: true } }));
    } catch (_) { /* SSR/tests sin window */ }
    return true;
  } catch (e) {
    console.warn('[onboardingProfileSync] No se pudo restaurar el perfil:', e?.message);
    return false;
  }
}

/**
 * Empuja el perfil local (cuando ya completó o saltó el onboarding) para que
 * otro dispositivo con la misma cuenta lo recupere. Se llama desde
 * markProfileDone/markProfileSkipped; best-effort, nunca lanza.
 *
 * @returns {Promise<{status: string}>}
 */
export async function pushOnboardingProfile() {
  const tenant = getActiveTenantId();
  if (!tenant) return { status: 'no-tenant' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'offline' };
  const { done, skipped } = getProfileCompletionFlags();
  if (!done && !skipped) return { status: 'not-done' };
  try {
    const assets = await fetchAccountLandAssets(tenant);
    if (!assets.length) return { status: 'no-asset' }; // la ubicación crea la finca primero; sin ella no inventamos una.
    const asset = assets.find((a) => readData(a)[MARKER])
      || assets.find((a) => readData(a).chagra_farm_location_v1)
      || assets[0];
    const data = readData(asset);
    const profile = getProfile();
    let avatarType = null;
    try { avatarType = leerCompanero(); } catch (_) { /* elenco no disponible (SSR/tests) */ }
    const payload = {
      profile: pickSyncedProfile(profile),
      avatarType,
      done,
      skipped,
      updatedAt: profile.updatedAt || new Date().toISOString(),
    };
    if (getActiveTenantId() !== tenant) return { status: 'account-changed' };
    const attributes = { data: JSON.stringify({ ...data, [MARKER]: payload }) };
    await sendToFarmOS(`/api/asset/land/${asset.id}`, {
      data: { type: 'asset--land', id: asset.id, attributes },
    }, 'PATCH');
    return { status: 'synced' };
  } catch (e) {
    console.warn('[onboardingProfileSync] No se pudo empujar el perfil:', e?.message);
    return { status: 'pending' };
  }
}

/**
 * Reintento best-effort en 'online'/'focus'. NO es una cola persistente: si
 * el push falla offline, se reintenta la próxima vez que haya señal mientras
 * la sesión siga abierta — suficiente para "completar el onboarding una vez"
 * (si la pestaña se cierra offline justo después, la próxima que se abra con
 * red hará el intento desde aquí mismo, llamado en appRuntime.jsx).
 *
 * @returns {() => void} función para detener los listeners.
 */
export function startOnboardingProfileSync() {
  const retryPush = () => { void pushOnboardingProfile(); };
  const events = ['online', 'focus'];
  events.forEach((event) => window.addEventListener(event, retryPush));
  return () => {
    events.forEach((event) => window.removeEventListener(event, retryPush));
  };
}
