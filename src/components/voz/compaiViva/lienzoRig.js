/**
 * lienzoRig — el intérprete compartido de la tinta de un compai sobre Canvas 2D.
 *
 * Portado de los cortos «compai vivo» (documentación interna, PR #497 angelita y
 * PR #506 guacamaya). Lee el `<svg>` que el componente de arte acaba de pintar
 * en el DOM y lo recorre tal cual: nada se traza ni se redibuja. Cada especie
 * trae sus ganchos (qué nodo se mueve y cómo); este módulo solo arma el árbol
 * y pinta.
 *
 * Dos modos de estilo:
 *   - 'atributos'  hereda fill/stroke por atributos (la lámina de angelita).
 *   - 'computados' lee getComputedStyle del SVG vivo: así entra el CSS de la
 *                  piel (p. ej. `estiloPiel` de la guacamaya) y los ids
 *                  namespaceados por instancia, sin copiarlos aquí.
 * Soporta g, path, circle, ellipse, rect, line, use, gradientes lineales y
 * radiales (con gradientTransform) y clip-path.
 */

const TAU = Math.PI * 2;

export function parseTf(s) {
  if (!s) return null;
  let m = new DOMMatrix();
  const re = /(\w+)\(([^)]*)\)/g;
  let r;
  while ((r = re.exec(s))) {
    const a = r[2].trim().split(/[\s,]+/).map(Number);
    if (r[1] === 'translate') m = m.translate(a[0], a[1] || 0);
    else if (r[1] === 'scale') m = m.scale(a[0], a.length > 1 ? a[1] : a[0]);
    else if (r[1] === 'rotate') m = m.rotate(a[0]);
    else if (r[1] === 'matrix') m = m.multiply(new DOMMatrix(a));
  }
  return m;
}

const ESTILOS = ['fill', 'stroke', 'stroke-width', 'fill-opacity', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'fill-rule'];
const SIN_PINTURA = new Set(['title', 'desc', 'defs', 'style', 'linearGradient', 'radialGradient', 'clipPath', 'filter', 'stop', 'mask']);

const urlId = (v) => {
  const m = /url\(\s*["']?#([^"')]+)["']?\s*\)/.exec(v || '');
  return m ? m[1] : null;
};

function geometria(el, n) {
  const num = (a) => +el.getAttribute(a) || 0;
  if (n.tag === 'path') { n.d = el.getAttribute('d'); n.p = new Path2D(n.d); }
  else if (n.tag === 'circle') { n.p = new Path2D(); n.p.arc(num('cx'), num('cy'), num('r'), 0, TAU); n.circ = el.getAttribute('fill'); n.bb = [num('cx') - num('r'), num('cy') - num('r'), 2 * num('r'), 2 * num('r')]; }
  else if (n.tag === 'ellipse') { n.p = new Path2D(); n.p.ellipse(num('cx'), num('cy'), num('rx'), num('ry'), 0, 0, TAU); n.bb = [num('cx') - num('rx'), num('cy') - num('ry'), 2 * num('rx'), 2 * num('ry')]; }
  else if (n.tag === 'rect') { n.p = new Path2D(); n.p.rect(num('x'), num('y'), num('width'), num('height')); n.bb = [num('x'), num('y'), num('width'), num('height')]; }
  else if (n.tag === 'line') { n.p = new Path2D(); n.p.moveTo(num('x1'), num('y1')); n.p.lineTo(num('x2'), num('y2')); }
}

/**
 * Árbol pintable a partir de un `<svg>` vivo.
 * @param {SVGSVGElement} svg
 * @param {{clave?: (el: Element) => string|null, estilos?: 'atributos'|'computados', origenes?: Record<string, number[]>}} [op={}] gancho, modo de estilo y origenes por clave
 */
export function arbolDeSvg(svg, { clave = () => null, estilos = 'atributos', origenes = null } = {}) {
  const cuenta = {};
  const computados = estilos === 'computados' && typeof getComputedStyle === 'function';
  const buscar = (id) => svg.querySelector(`[id="${id}"]`) || svg.ownerDocument?.getElementById(id);

  function construir(el, vivo) {
    const tag = el.tagName;
    if (SIN_PINTURA.has(tag)) return null;
    const n = { tag, clave: vivo ? clave(el) : null, tf: parseTf(el.getAttribute('transform')), st: {}, op: 1, kids: [], el: vivo ? el : null };
    for (const a of ESTILOS) { const v = el.getAttribute(a); if (v != null) n.st[a] = v; }
    const o = el.getAttribute('opacity'); if (o != null) n.op = +o;
    if (computados && vivo) {
      const cs = getComputedStyle(el);
      for (const a of ESTILOS) { const v = cs.getPropertyValue(a); if (v) n.st[a] = v.trim(); }
      const oc = cs.getPropertyValue('opacity'); if (oc !== '') n.op = +oc;
      const clip = urlId(cs.getPropertyValue('clip-path')) || urlId(el.getAttribute('clip-path'));
      if (clip) n.clip = recorte(buscar(clip));
    } else {
      const clip = urlId(el.getAttribute('clip-path'));
      if (clip) n.clip = recorte(buscar(clip));
    }
    if (n.clave) {
      cuenta[n.clave] = cuenta[n.clave] || 0; n.i = cuenta[n.clave]++;
      if (origenes && origenes[n.clave] && el.getBBox) {
        const b = el.getBBox(), [ox, oy] = origenes[n.clave];
        n.piv = [b.x + ox * b.width, b.y + oy * b.height];
      }
    }
    geometria(el, n);
    if (tag === 'use') {
      const ref = buscar((el.getAttribute('href') || el.getAttribute('xlink:href') || '').slice(1));
      const x = +el.getAttribute('x') || 0, y = +el.getAttribute('y') || 0;
      if (x || y) n.tf = (n.tf || new DOMMatrix()).translate(x, y);
      // El contenido de un <use> hereda del <use>: se lee por atributos.
      const k = ref && construir(ref, false); if (k) n.kids.push(k);
    } else {
      for (const c of el.children) { const k = construir(c, vivo); if (k) n.kids.push(k); }
    }
    return n;
  }

  function recorte(cp) {
    if (!cp) return null;
    const p = new Path2D();
    for (const c of cp.children) {
      const n = { tag: c.tagName }; geometria(c, n);
      if (n.p) p.addPath(n.p, parseTf(c.getAttribute('transform')) || undefined);
    }
    return p;
  }

  const raiz = construir(svg, true);
  raiz.buscar = buscar;
  raiz.svg = svg.ownerSVGElement || svg;
  return raiz;
}

/** Hornea los estilos heredados y prepara los gradientes. `marca(n)` corre antes (roles de la especie). */
export function hornear(raiz, { guardar = (n) => !!(n.tf || n.clave || n.rol || n.clip) } = {}) {
  const buscar = raiz.buscar;
  // Los clones de un <use> no están vivos en el DOM: su caja se mide con un <path> temporal en el mismo SVG.
  let medidor = null;
  function caja(n) {
    if (n.el?.getBBox) { try { const b = n.el.getBBox(); return [b.x, b.y, b.width, b.height]; } catch { /* sin caja */ } }
    if (n.bb) return n.bb;
    if (n.d && raiz.svg?.ownerDocument) {
      try {
        if (!medidor) { medidor = raiz.svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path'); raiz.svg.appendChild(medidor); }
        if (!medidor) return [0, 0, 1, 1];
        medidor.setAttribute('d', n.d);
        const b = medidor.getBBox(); return [b.x, b.y, b.width, b.height];
      } catch { /* sin caja */ }
    }
    return [0, 0, 1, 1];
  }
  function grad(v, n) {
    const id = urlId(v); if (!id || !buscar) return null;
    const g = buscar(id); if (!g) return null;
    const stops = [...g.querySelectorAll('stop')].map((s) => {
      const cs = typeof getComputedStyle === 'function' ? getComputedStyle(s) : null;
      const col = s.getAttribute('stop-color') || cs?.getPropertyValue('stop-color') || '#000';
      const op = s.getAttribute('stop-opacity') ?? cs?.getPropertyValue('stop-opacity') ?? '1';
      return [+(s.getAttribute('offset') || 0), col, op === '' ? 1 : +op];
    });
    const A = (a, d) => (g.getAttribute(a) == null ? d : parseFloat(g.getAttribute(a)));
    return { tipo: g.tagName, bbox: g.getAttribute('gradientUnits') !== 'userSpaceOnUse', tf: parseTf(g.getAttribute('gradientTransform')),
      x1: A('x1', 0), y1: A('y1', 0), x2: A('x2', 1), y2: A('y2', 0), cx: A('cx', .5), cy: A('cy', .5), r: A('r', .5),
      fx: A('fx', A('cx', .5)), fy: A('fy', A('cy', .5)), stops, n };
  }
  function paso(n, padre) {
    const e = Object.assign({}, padre, n.st);
    const f = e.fill === undefined ? '#000' : (e.fill === 'none' ? null : e.fill);
    n.relleno = f; n.gradF = f && f.startsWith('url') ? grad(f, n) : null;
    n.ra = e['fill-opacity'] !== undefined ? +e['fill-opacity'] : 1;
    n.regla = e['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero';
    const s = e.stroke && e.stroke !== 'none' ? e.stroke : null;
    n.trazo = s; n.gradS = s && s.startsWith('url') ? grad(s, n) : null;
    n.ta = e['stroke-opacity'] !== undefined ? +e['stroke-opacity'] : 1;
    n.grosor = e['stroke-width'] !== undefined ? parseFloat(e['stroke-width']) : 1;
    n.punta = e['stroke-linecap'] || 'butt';
    n.union = e['stroke-linejoin'] || 'miter';
    if (n.gradF || n.gradS) n.caja = caja(n);
    n.gc = null;
    n.guardar = guardar(n);
    for (const k of n.kids) paso(k, e);
  }
  paso(raiz, {});
  const medidorFinal = medidor;
  if (medidorFinal) medidorFinal.remove();
  return raiz;
}

function rgba(col, a) {
  if (a >= 1 || !col.startsWith('#')) return col;
  const v = parseInt(col.slice(1).length === 3 ? col.slice(1).replace(/./g, (x) => x + x) : col.slice(1), 16);
  return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`;
}

function pinturaDe(c, n, G) {
  n.gc = n.gc || new Map();
  let p = n.gc.get(c); if (p) return p;
  const [x, y, w, h] = n.caja || [0, 0, 1, 1];
  const M = new DOMMatrix();
  // En unidades de caja, el gradiente vive en el cuadrado 0..1 estirado a la caja del nodo.
  const base = G.bbox ? M.translate(x, y).scale(w, h) : M;
  const T = G.tf ? base.multiply(G.tf) : base;
  const P = (a, b) => T.transformPoint(new DOMPoint(a, b));
  if (G.tipo === 'radialGradient') {
    const cc = P(G.cx, G.cy), ff = P(G.fx, G.fy), rr = P(G.cx + G.r, G.cy);
    p = c.createRadialGradient(ff.x, ff.y, 0, cc.x, cc.y, Math.hypot(rr.x - cc.x, rr.y - cc.y));
  } else {
    const a = P(G.x1, G.y1), b = P(G.x2, G.y2);
    p = c.createLinearGradient(a.x, a.y, b.x, b.y);
  }
  for (const [o, col, op] of G.stops) p.addColorStop(Math.min(1, Math.max(0, o)), rgba(col, op));
  n.gc.set(c, p);
  return p;
}

// Matriz del espacio del gradiente al espacio del nodo (caja × gradientTransform).
function matrizGradiente(n, G) {
  const [x, y, w, h] = n.caja || [0, 0, 1, 1];
  const base = G.bbox ? new DOMMatrix().translate(x, y).scale(w || 1, h || 1) : new DOMMatrix();
  return G.tf ? base.multiply(G.tf) : base;
}
// Un gradiente en unidades de caja es una elipse/isolíneas sesgadas en el espacio del nodo:
// se pinta dentro de su propio espacio (lienzo transformado, forma con la inversa), como lo hace el SVG.
function rellenoGradiente(c, n, G) {
  n.gu = n.gu || new Map();
  let p = n.gu.get(c);
  if (!p) {
    p = G.tipo === 'radialGradient'
      ? c.createRadialGradient(G.fx, G.fy, 0, G.cx, G.cy, G.r)
      : c.createLinearGradient(G.x1, G.y1, G.x2, G.y2);
    for (const [o, col, op] of G.stops) p.addColorStop(Math.min(1, Math.max(0, o)), rgba(col, op));
    n.gu.set(c, p);
  }
  if (!n.pInv) {
    const T = matrizGradiente(n, G);
    n.mT = T; n.pInv = new Path2D(); n.pInv.addPath(n.p, T.inverse());
  }
  c.save();
  c.transform(n.mT.a, n.mT.b, n.mT.c, n.mT.d, n.mT.e, n.mT.f);
  c.fillStyle = p; c.fill(n.pInv, n.regla);
  c.restore();
}

/** Pinta la geometría de un nodo (relleno y trazo) con el alfa dado. */
export function pintar(c, n, alpha) {
  if (n.relleno) {
    c.globalAlpha = alpha * n.ra;
    if (n.gradF) rellenoGradiente(c, n, n.gradF);
    else { c.fillStyle = n.relleno; c.fill(n.p, n.regla); }
  }
  if (n.trazo) {
    c.globalAlpha = alpha * n.ta; c.strokeStyle = n.gradS ? pinturaDe(c, n, n.gradS) : n.trazo; c.lineWidth = n.grosor;
    c.lineCap = n.punta; c.lineJoin = n.union; c.stroke(n.p);
  }
}

/**
 * Recorre y pinta con ganchos de transformación por clave (los del CSS de un rig):
 * `pose[clave]` = [tx, ty, rot°, sx, sy, alfa], aplicado alrededor de `n.piv`.
 * `post[clave](c, n, alpha)` pinta lo que el hueso carga.
 */
export function pintarConPose(c, n, alpha, pose, post = null) {
  alpha *= n.op; if (alpha <= .002) return;
  const H = n.clave ? pose[n.clave] : null;
  if (H) { alpha *= H[5]; if (alpha <= .002) return; }
  if (!n.guardar && !H) { if (n.p) pintar(c, n, alpha); for (const k of n.kids) pintarConPose(c, k, alpha, pose, post); return; }
  c.save();
  if (n.tf) c.transform(n.tf.a, n.tf.b, n.tf.c, n.tf.d, n.tf.e, n.tf.f);
  if (H) {
    const [px, py] = n.piv || [0, 0];
    c.translate(px + H[0], py + H[1]);
    if (H[2]) c.rotate(H[2] * Math.PI / 180);
    if (H[3] !== 1 || H[4] !== 1) c.scale(H[3], H[4]);
    c.translate(-px, -py);
  }
  if (n.clip) c.clip(n.clip);
  if (n.p) pintar(c, n, alpha);
  for (const k of n.kids) pintarConPose(c, k, alpha, pose, post);
  if (post && n.clave && post[n.clave]) post[n.clave](c, n, alpha);
  c.restore();
}
