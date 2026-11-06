/**
 * Intérprete de la lámina de angelita sobre Canvas 2D.
 *
 * Portado del corto «compai vivo · angelita» (documentación interna, PR #497,
 * `documentación interna`, sección 1 y ganchos).
 * La diferencia es de dónde sale el SVG: el corto lo traía incrustado como
 * JSON exportado; aquí se lee del `<svg>` que `AbejaLamina` acaba de pintar
 * en el DOM, así que la tinta es la fuente misma y no una copia.
 *
 * El intérprete (árbol, estilos, pintura) es el compartido de
 * `compaiViva/lienzoRig.js`; aquí quedan los ganchos propios de la abeja.
 *
 * Nada se traza ni se redibuja: se recorre el árbol del SVG tal cual, y los
 * gestos entran por `data-anatomia` (cabeza, antenas, ojos, brazos, abdomen,
 * patas, alas, tórax). El estado de la abeja es un objeto plano `B` que
 * produce `gestosVoz.js`; este módulo solo lo pinta.
 */

import { arbolDeSvg as arbolRig, hornear, pintar } from '../compaiViva/lienzoRig';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, k) => a + (b - a) * k;
function h1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h1(i), h1(i + 1), u) * 2 - 1;
}

/** De centro del tórax a la planta, en unidades de lámina (poses de pie). */
export const PIE = 11.9;

function marcar(n, dentroOjos) {
  if (n.anat === 'ojos') dentroOjos = true;
  if (dentroOjos && n.tag === 'g' && n.kids[0] && n.kids[0].circ === '#20130a') n.rol = 'pupila';
  if ((n.anat === 'torax' || n.anat === 'abdomen') && n.kids[0] && n.kids[0].p) n.silueta = n.kids[0].p;
  for (const k of n.kids) marcar(k, dentroOjos);
}

/** Árbol pintable a partir del `<svg>` vivo de AbejaLamina. */
export function arbolDeSvg(svg) {
  const raiz = arbolRig(svg, { clave: (el) => el.getAttribute('data-anatomia') });
  const alias = (n) => { n.anat = n.clave; for (const k of n.kids) alias(k); };
  alias(raiz);
  marcar(raiz, false);
  hornear(raiz, { guardar: (n) => !!(n.tf || n.anat || n.rol) });
  return raiz;
}

const POLEN_T = [...Array(46)].map((_, i) => [lerp(-3.6, 3.6, h1(i * 3.1)), lerp(-2.3, 2.7, h1(i * 5.7 + 1)), lerp(.11, .22, h1(i * 9.3 + 2)), h1(i * 1.9 + 7)]);
const POLEN_A = [...Array(34)].map((_, i) => [lerp(-4.2, 3.3, h1(i * 4.3 + 11)), lerp(2.4, 10, h1(i * 6.1 + 13)), lerp(.12, .2, h1(i * 2.7 + 5)), h1(i * 8.9 + 3)]);

// El alfa de la abeja (B.alpha) multiplica el del nodo: la pintura es la del intérprete compartido.
const pintarB = (c, n, alpha, B) => pintar(c, n, alpha * B.alpha);

function giro(c, px, py, a) { if (!a) return; c.translate(px, py); c.rotate(a); c.translate(-px, -py); }

function polenEn(c, sil, pts, cant, B) {
  c.save(); c.clip(sil);
  for (const [x, y, r, u] of pts) {
    if (u > cant) continue;
    c.globalAlpha = B.alpha * clamp((cant - u) * 6);
    c.fillStyle = u > .5 ? '#ffe28a' : '#f3bf2f';
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  c.restore();
}

// Ganchos por data-anatomia: los del corto, con los mismos pivotes.
const GANCHO = {
  cabeza: { pre(c, n, B) { giro(c, .3, -1.7, B.cabeza); } },
  antenas: { pre(c, n, B) {
    const tw = B.antena + Math.sin(B.t * 2.1 + B.sem) * .035 + vn(B.t * 3 + B.sem * 5) * .05;
    giro(c, .35, -17, tw);
  } },
  ojos: { pre(c, n, B) { if (B.parpado < .999) { c.translate(.5, -4.05); c.scale(1, B.parpado); c.translate(-.5, 4.05); } } },
  'brazo-izquierdo': { pre(c, n, B) { giro(c, -2.7, .4, B.brazoI); } },
  // En «hablar» ese brazo ya viene alzado en la tinta: el gesto se atenúa.
  'brazo-derecho': { pre(c, n, B) { giro(c, 2.6, .4, -B.brazoD * (B.pose === 'hablar' && !B.onda ? .22 : 1)); } },
  abdomen: {
    pre(c, n, B) { giro(c, -.3, 2.3, B.abdomen); },
    post(c, n, B) { if (B.polen > 0 && n.silueta) polenEn(c, n.silueta, POLEN_A, B.polen, B); },
  },
  torax: { post(c, n, B) {
    // Calor del tórax (el corto lo usaba para tiritar): aquí es el «pensar».
    const tib = clamp(B.calor || 0);
    if (tib > 0 && n.silueta) {
      c.save(); c.clip(n.silueta);
      const gr = c.createRadialGradient(-.2, .1, .1, -.2, .1, 3.8);
      gr.addColorStop(0, 'rgba(255,190,70,.95)'); gr.addColorStop(.55, 'rgba(255,120,30,.55)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
      c.globalAlpha = tib * .6 * B.alpha; c.fillStyle = gr; c.fillRect(-5, -4, 10, 9);
      c.restore();
    }
    if (B.polen > 0 && n.silueta) polenEn(c, n.silueta, POLEN_T, B.polen, B);
  } },
  'pata-posterior': { pre(c, n, B) { if (B.pata) c.rotate((n.i ? 1 : -1) * B.pata); } },
  'pata-media': { pre(c, n, B) { if (B.pata) c.rotate((n.i ? -1 : 1) * B.pata * .8); } },
  ala: { pre(c, n, B, alpha) {
    // Con estela: dos fantasmas detrás del ala (la técnica del corto).
    const tomas = B.estela ? [[-.34, .16], [-.17, .28], [0, .85]] : [[0, 1]];
    for (const [dp, al] of tomas) {
      c.save();
      const fase = (B.alaFase + dp) * TAU;
      c.rotate(B.alaReposo + B.alaAmp * Math.sin(fase));
      c.scale(1, 1 - .45 * B.alaAmp * Math.abs(Math.cos(fase)) * .3);
      for (const k of n.kids) nodo(c, k, alpha * al, B);
      c.restore();
    }
    return 'hecho';
  } },
};

function nodo(c, n, alpha, B) {
  alpha *= n.op;
  if (!n.guardar) { if (n.p) pintarB(c, n, alpha, B); for (const k of n.kids) nodo(c, k, alpha, B); return; }
  c.save();
  if (n.tf) c.transform(n.tf.a, n.tf.b, n.tf.c, n.tf.d, n.tf.e, n.tf.f);
  const g = n.anat && GANCHO[n.anat];
  if (g && g.pre && g.pre(c, n, B, alpha) === 'hecho') { c.restore(); return; }
  if (n.rol === 'pupila') c.translate(B.mirada[0] * .3, B.mirada[1] * .24);
  if (n.p) pintarB(c, n, alpha, B);
  for (const k of n.kids) nodo(c, k, alpha, B);
  if (g && g.post) g.post(c, n, B, alpha);
  c.restore();
}

/**
 * Pinta la abeja `B` con el árbol de su pose. `escala` = px por unidad de
 * lámina; (x, y) = centro del tórax en px del canvas. `B.dx/dy` van en
 * unidades de lámina para que el gesto no dependa del tamaño en pantalla.
 */
export function pintarAbeja(c, arboles, B, { x, y, escala }) {
  const P = arboles[B.pose] || arboles.decir;
  if (!P) return;
  c.save();
  c.translate(x + B.dx * escala, y + B.dy * escala);
  c.rotate(B.rot);
  c.scale(escala, escala);
  if (B.sq !== 1) {
    // squash con el pie fijo: la abeja se apoya, no flota
    c.translate(0, PIE); c.scale(1 + (1 - B.sq) * .55, B.sq); c.translate(0, -PIE);
  }
  nodo(c, P, 1, B);
  c.restore();
}
