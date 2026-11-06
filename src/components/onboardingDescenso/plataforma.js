/*
 * Desde dónde abre la persona Chagra, para decirle qué aviso de permiso le va
 * a salir. Solo lee el navegador; no guarda nada.
 */

/** @typedef {{userAgent?: string, maxTouchPoints?: number, standalone?: boolean}} NavegadorOnboarding */
/** @typedef {{matchMedia?: (consulta:string) => {matches:boolean}|null}} VentanaOnboarding */
/** @param {NavegadorOnboarding|null} [nav=globalThis.navigator] @param {VentanaOnboarding|null} [win=globalThis.window] @returns {'app'|'iphone'|'android'|'computador'} */
export function detectarPlataforma(nav = typeof navigator !== 'undefined' ? navigator : null, win = typeof window !== 'undefined' ? window : null) {
  const ua = nav?.userAgent || '';
  let instalada = false;
  try {
    instalada = Boolean(win?.matchMedia?.('(display-mode: standalone)')?.matches) || nav?.standalone === true;
  } catch (_) {
    instalada = false;
  }
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && Number(nav?.maxTouchPoints) > 1);
  const android = /Android/i.test(ua);
  if (instalada) return 'app';
  if (ios) return 'iphone';
  if (android) return 'android';
  return 'computador';
}

export const AVISO_PERMISO = {
  app: 'La aplicación le va a pedir permiso. Toque «Permitir».',
  iphone: 'Su iPhone le va a preguntar. Toque «Permitir».',
  android: 'Su celular le va a preguntar. Toque «Permitir».',
  computador: 'Arriba, junto a la dirección, le sale un aviso. Toque «Permitir».',
};
