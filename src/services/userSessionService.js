import { getActiveTenantId } from './tenantContext';

const PREFIX = 'chagra:last-access:v1:';
let session = null;

/**
 * Una visita comienza al entrar a la app autenticada, no al sincronizar.
 * Conserva la fecha anterior en memoria durante esta visita. Solo persiste
 * una fecha por identidad ya existente; nunca crea identidad para anónimos.
 */
export function beginUserAccess(now = Date.now()) {
  const user = getActiveTenantId();
  if (!user || !Number.isFinite(now)) return null;
  if (session?.user === user) return session;
  let previous = null;
  try {
    const raw = localStorage.getItem(PREFIX + user);
    const parsed = raw === null ? NaN : Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= now) previous = parsed;
    localStorage.setItem(PREFIX + user, String(now));
  } catch { /* Sin almacenamiento, no inferir una visita anterior. */ }
  session = { user, ultimoAccesoMs: previous, ahoraMs: now };
  return session;
}

/** Lectura sin escrituras: montar el chat no cuenta como una visita nueva. */
export function getUserAccess() {
  return session?.user === getActiveTenantId() ? session : null;
}

export function endUserAccess() {
  session = null;
}
