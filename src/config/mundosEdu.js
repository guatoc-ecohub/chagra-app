// Saltos de la app 2D a los mundos 3D: viven en edu.chagra.bio, no dentro de la PWA.
export const EDU_ORIGEN = 'https://edu.chagra.bio';
export const EDU_ENTRADA_VALLE = `${EDU_ORIGEN}/juego/mundo/`;

const VISTA_A_RUTA = Object.freeze({
  valle3d: '/juego/mundo/',
  mockup_vitrina_maestra: '/',
  mundo3d_micorrizas: '/micorrizas/',
  monte_vuelve: '/restauracion/',
  mundo_casa_adentro: '/juego/mundo/',
  finca_odyssey: '/juego/mundo/',
  mockup_sierra_global: '/clima-finca/',
});

const MUNDO_A_RUTA = Object.freeze({
  cafe: '/cafe/',
  agua: '/agua/',
  suelo: '/suelo/',
  animales: '/gallinas/',
  sanidad: '/control-biologico/',
  clima: '/clima-finca/',
  semillero: '/semilla/',
  mercado: '/juego/mundo/',
});

/**
 * URL de edu.chagra.bio que reemplaza una vista 3D, o null si la vista no es 3D.
 * @param {string} view
 * @param {{mundo?: string}|null} [data]
 * @returns {string|null}
 */
export function urlMundoEdu(view, data = null) {
  if (typeof view !== 'string' || !Object.hasOwn(VISTA_A_RUTA, view)) return null;
  const mundo = view === 'valle3d' ? data?.mundo : null;
  const rutaMundo = typeof mundo === 'string' && Object.hasOwn(MUNDO_A_RUTA, mundo) ? MUNDO_A_RUTA[mundo] : null;
  return `${EDU_ORIGEN}${rutaMundo || VISTA_A_RUTA[view]}`;
}

/**
 * Abre la URL en pestaña nueva; si el navegador la bloquea, usa la misma pestaña.
 * @param {string} url
 */
export function abrirMundoEdu(url, { mismaPestana = false } = {}) {
  if (!mismaPestana) {
    // Sin 'noopener' en la llamada: con él window.open devuelve null aunque abra.
    const ventana = window.open(url, '_blank');
    if (ventana) {
      try { ventana.opener = null; } catch (_) { /* misma política del navegador */ }
      return;
    }
  }
  window.location.assign(url);
}
