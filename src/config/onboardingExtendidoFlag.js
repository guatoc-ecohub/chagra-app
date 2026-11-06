const FLAG_KEY = 'VITE_ONBOARDING_EXTENDIDO';

export function onboardingExtendidoActivo() {
  try {
    const raw = import.meta.env?.[FLAG_KEY];
    if (raw === true) return true;
    return typeof raw === 'string' && ['true', '1'].includes(raw.trim().toLowerCase());
  } catch (_) {
    return false;
  }
}

export default onboardingExtendidoActivo;
