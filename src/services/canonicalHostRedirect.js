export const CANONICAL_HOSTNAME = 'chagra.app';
export const CANONICAL_REDIRECT_GUARD_KEY = 'chagra:canonical-host-redirected';

function normalizeHostname(hostname) {
  return String(hostname || '').trim().toLowerCase();
}

function getDefaultLocation() {
  try {
    return typeof window !== 'undefined' ? window.location : null;
  } catch (_) {
    return null;
  }
}

function getDefaultSessionStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch (_) {
    return null;
  }
}

export function isCanonicalHost(hostname) {
  return normalizeHostname(hostname) === CANONICAL_HOSTNAME;
}

export function isLocalDevHost(hostname) {
  const host = normalizeHostname(hostname);
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    /(^|[.-])dev([.-]|$)/.test(host)
  );
}

export function isPreviewHost(hostname) {
  const host = normalizeHostname(hostname);
  return (
    /(^|[.-])preview([.-]|$)/.test(host) ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.netlify.app') ||
    host.endsWith('.cloudflarepages.dev')
  );
}

export function isProdAppHost(hostname) {
  // prod.chagra.app = ambiente 3D-first (build app-3d), NO debe redirigir al canónico.
  return normalizeHostname(hostname) === 'prod.chagra.app';
}

// Hosts extra del despliegue (staging, mundos 3D, preview campesina) se leen de
// variables de entorno para no fijar dominios del operador en el código público.
// Vacías = la excepción no aplica. Ver .env.example.
function envHostList(value) {
  return String(value || '')
    .split(',')
    .map((h) => normalizeHostname(h))
    .filter(Boolean);
}

const EXTRA_STAGING_HOSTS = envHostList(import.meta.env?.VITE_STAGING_HOSTS);
const THREE_D_WORLD_HOSTS = envHostList(import.meta.env?.VITE_3D_WORLD_HOST);
const CAMPESINO_PREVIEW_HOSTS = envHostList(import.meta.env?.VITE_CAMPESINO_PREVIEW_HOST);

const STAGING_HOSTS = new Set([
  'preprod.chagra.app',
  ...EXTRA_STAGING_HOSTS,
  'localhost',
  '127.0.0.1',
]);

export function isStagingHost(hostname) {
  // preprod.chagra.app = ambiente de STAGING que sirve la rama dev antes de que
  // llegue a main/prod. Si rebotara al canónico (chagra.app), el staging mandaría
  // a producción y no probaría nada. La lista es exacta: no se acepta un host
  // tercero solo porque contenga el token `preprod`.
  return STAGING_HOSTS.has(normalizeHostname(hostname));
}

export function isThreeDWorldHost(hostname) {
  // VITE_3D_WORLD_HOST = despliegue standalone de los mundos 3D (build app-3d),
  // fuera del dominio chagra.app. Igual que prod.chagra.app, NO debe redirigir
  // al canónico. Host EXACTO (sin wildcard): otros subdominios del mismo apex
  // deben seguir rebotando a chagra.app.
  const host = normalizeHostname(hostname);
  return Boolean(host) && THREE_D_WORLD_HOSTS.includes(host);
}

export function isCampesinoHost(hostname) {
  // VITE_CAMPESINO_PREVIEW_HOST = despliegue standalone de la HomeCampesinoB
  // (preview pública campesina en su propio dominio, servida como microapp
  // estática). Como prod.chagra.app y el host de mundos 3D, NO debe rebotar al
  // canónico chagra.app: si lo hiciera, el dominio serviría el PWA de prod en
  // vez de la home campesina. Host EXACTO.
  const host = normalizeHostname(hostname);
  return Boolean(host) && CAMPESINO_PREVIEW_HOSTS.includes(host);
}

export function isCampesinoAppHost(hostname) {
  // campesino.chagra.app = la vista campesina dentro del dominio de la app.
  // NO es lo mismo que VITE_CAMPESINO_PREVIEW_HOST, que es la preview estática.
  // Sin esta excepción el guard la rebota al canónico ANTES de montar, y
  // entonces esDominioCampesino() —que compara justo contra este host— no
  // puede devolver true nunca en producción: la franja de jornada quedaría
  // invisible en todos los dominios. Host EXACTO.
  return normalizeHostname(hostname) === 'campesino.chagra.app';
}

export function isAllowedHost(hostname) {
  return (
    isCanonicalHost(hostname) ||
    isLocalDevHost(hostname) ||
    isPreviewHost(hostname) ||
    isProdAppHost(hostname) ||
    isStagingHost(hostname) ||
    isThreeDWorldHost(hostname) ||
    isCampesinoHost(hostname) ||
    isCampesinoAppHost(hostname)
  );
}

/**
 * Construye la URL canónica preservando path, search y hash de la ubicación
 * dada. Solo consume `pathname`/`search`/`hash`, así que acepta cualquier
 * objeto tipo-Location (incluido un mock parcial de tests).
 *
 * @param {{ pathname?: string, search?: string, hash?: string } | null} [location]
 * @returns {string}
 */
export function buildCanonicalUrl(location = getDefaultLocation()) {
  const pathname = location?.pathname || '/';
  const search = location?.search || '';
  const hash = location?.hash || '';
  return `https://${CANONICAL_HOSTNAME}${pathname}${search}${hash}`;
}

function readRedirectGuard(storage) {
  if (!storage) return false;
  try {
    return storage.getItem(CANONICAL_REDIRECT_GUARD_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function writeRedirectGuard(storage) {
  if (!storage) return;
  try {
    storage.setItem(CANONICAL_REDIRECT_GUARD_KEY, '1');
  } catch (_) {
    /* storage unavailable, keep going */
  }
}

export function runCanonicalHostRedirectGuard(options = {}) {
  const location = options.location ?? getDefaultLocation();
  const sessionStorage = options.sessionStorage ?? getDefaultSessionStorage();
  const redirect = options.redirect || ((url) => location?.replace(url));

  if (!location || isAllowedHost(location.hostname)) {
    return { redirected: false, reason: 'allowed-host' };
  }

  if (readRedirectGuard(sessionStorage)) {
    return { redirected: false, reason: 'already-redirected' };
  }

  writeRedirectGuard(sessionStorage);
  redirect(buildCanonicalUrl(location));
  return { redirected: true, reason: 'redirected-to-canonical' };
}
