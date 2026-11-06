const FLAG_KEY = 'VITE_RECORRIDO_HOME';

export function recorridoHomeActivo() {
  try {
    const raw = import.meta.env?.[FLAG_KEY];
    if (raw === true) return true;
    return typeof raw === 'string' && ['true', '1'].includes(raw.trim().toLowerCase());
  } catch (_) {
    return false;
  }
}

export default recorridoHomeActivo;
