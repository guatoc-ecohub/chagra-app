export const UNIFIED_PROGRESS_KEY = 'chagra:onboarding-unificado:avance:v1';

export function leerProgresoUnificado() {
  try {
    const raw = localStorage.getItem(UNIFIED_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

export function guardarProgresoUnificado(fragmento) {
  try {
    localStorage.setItem(UNIFIED_PROGRESS_KEY, JSON.stringify({ ...leerProgresoUnificado(), ...fragmento }));
  } catch (_) {
    /* La sesión continúa aunque el navegador no permita persistir. */
  }
}

export function limpiarProgresoUnificado() {
  try { localStorage.removeItem(UNIFIED_PROGRESS_KEY); } catch (_) { /* nada que bloquear */ }
}
