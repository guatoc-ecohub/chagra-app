/*
 * compaiPuestoSeguro — dónde se sienta el compai para no tapar texto.
 *
 * Sale de AgentFab (#3675) para poder probarlo sin montar el FAB. Dos
 * defectos medidos el 2026-09-23 en la PWA quieta, sin tocar la pantalla,
 * convertían el puesto en un desplazamiento errático (80 cambios de puesto en
 * 20 s, ~730 px/s):
 *
 *   1. El compai se contaba a sí mismo como texto: su `<span>` envuelve un SVG
 *      cuyo `<title>` dice el nombre, así que cada 250 ms huía de su propia
 *      caja hacia otro hueco, y de ese hacia otro.
 *   2. No había histéresis: aunque el puesto actual no tapara nada, se volvía
 *      a elegir «el mejor» y la rejilla lo desplazaba.
 *
 * Regla que queda: el compai se mueve de puesto SOLO si el actual tapa texto.
 */

export const COMPAI_SAFE_SIZE = 84;
export const COMPAI_SAFE_GAP = 8;
export const COMPAI_SAFE_STEP = 12;

const SELECTOR_TEXTO = 'p, h1, h2, h3, h4, li, span, [data-testid="panel-datos-piso"]';

export function rectaSeSolapa(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function areaSolapada(a, b) {
  if (!rectaSeSolapa(a, b)) return 0;
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

/**
 * Cajas del texto visible de la página, con un margen de aire.
 * @param {Element|null} [propio] el compai: su propio texto no cuenta.
 */
export function cajasDeTextoVisibles(propio = null) {
  if (typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll(SELECTOR_TEXTO))
    .filter((node) => !(propio && propio.contains(node)))
    .filter((node) => node.getClientRects().length && node.textContent.trim())
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left - 6, top: rect.top - 4, right: rect.right + 6, bottom: rect.bottom + 4 };
    });
}

/**
 * El puesto COMPROMETIDO del compai: el destino escrito en su estilo
 * (bottom/right), no la posición a mitad de un vuelo ni la excursión del roam.
 * Sin estilo, su caja de maquetación (offsetLeft/offsetTop ignoran transforms).
 * @param {HTMLElement} el
 */
export function rectaDelPuesto(el) {
  const ancho = el.offsetWidth || COMPAI_SAFE_SIZE;
  const alto = el.offsetHeight || COMPAI_SAFE_SIZE;
  const right = parseFloat(el.style?.right);
  const bottom = parseFloat(el.style?.bottom);
  const left = Number.isFinite(right) && typeof window !== 'undefined' ? window.innerWidth - right - ancho : el.offsetLeft;
  const top = Number.isFinite(bottom) && typeof window !== 'undefined' ? window.innerHeight - bottom - alto : el.offsetTop;
  return { left, top, right: left + ancho, bottom: top + alto };
}

/**
 * Busca un puesto que no tape texto, lo más cerca posible del actual.
 * Devuelve null si el actual ya sirve (no hay que moverse) o si no hay dónde.
 * @param {{left:number,top:number,right:number,bottom:number}|null} rectaActual
 * @param {Array<{left:number,top:number,right:number,bottom:number}>} textos
 * @param {{ancho:number, alto:number}} viewport
 * @returns {{right:number, bottom:number, choque:number}|null}
 */
export function buscarPuestoSeguro(rectaActual, textos, { ancho, alto }) {
  if (rectaActual && !textos.some((texto) => rectaSeSolapa(rectaActual, texto))) return null;
  const maxX = Math.max(COMPAI_SAFE_GAP, ancho - COMPAI_SAFE_SIZE - COMPAI_SAFE_GAP);
  const maxY = Math.max(COMPAI_SAFE_GAP, alto - COMPAI_SAFE_SIZE - COMPAI_SAFE_GAP);
  let mejor = null;

  for (let y = COMPAI_SAFE_GAP; y <= maxY; y += COMPAI_SAFE_STEP) {
    for (let x = COMPAI_SAFE_GAP; x <= maxX; x += COMPAI_SAFE_STEP) {
      const candidata = { left: x, top: y, right: x + COMPAI_SAFE_SIZE, bottom: y + COMPAI_SAFE_SIZE };
      const choque = textos.reduce((total, texto) => total + areaSolapada(candidata, texto), 0);
      const distancia = rectaActual
        ? Math.hypot(candidata.left - rectaActual.left, candidata.top - rectaActual.top)
        : 0;
      const puntuacion = choque * 1000 + distancia;
      if (!mejor || puntuacion < mejor.puntuacion) mejor = { candidata, puntuacion, choque };
    }
  }

  if (!mejor) return null;
  return {
    right: Math.round(ancho - mejor.candidata.right),
    bottom: Math.round(alto - mejor.candidata.bottom),
    choque: mejor.choque,
  };
}

/* Cuando SÍ se cambia de puesto, el compai vuela hasta allá a paso de abeja
   (~220 px/s, entre 0,6 y 2,4 s), arrancando y frenando suave. Con 0,3 s fijos
   un cambio de 400 px era un salto de ~1.400 px/s: se leía como tic, no como
   ir a algún sitio. */
const VELOCIDAD_VUELO = 220;
export const CURVA_DE_VUELO = 'cubic-bezier(.45, 0, .25, 1)';

/**
 * @param {{left:number, top:number}} desde
 * @param {{left:number, top:number}} hasta
 * @returns {number} ms del vuelo entre los dos puestos
 */
export function duracionDeVuelo(desde, hasta) {
  const distancia = Math.hypot(hasta.left - desde.left, hasta.top - desde.top);
  return Math.round(Math.min(2400, Math.max(600, (distancia / VELOCIDAD_VUELO) * 1000)));
}
