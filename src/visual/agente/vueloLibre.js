/**
 * vueloLibre — por dónde puede volar Angelita sin tapar nada.
 *
 * Decisión del operador (2026-09-28): al salir del círculo del login vuela
 * libre y revolotea por las zonas vacías; nunca pasa sobre el formulario, los
 * campos ni los botones. Aquí vive la geometría, pura (sin React y sin DOM
 * salvo `obstaculosVisibles`), para poder probarla con cajas inventadas:
 *
 *   1. `mapaLibre`   → la rejilla de puestos (esquina sup-izq de su caja)
 *      donde la caja entera cabe en el viewport sin tocar ningún obstáculo.
 *   2. `rutaLibre`   → un camino de puesto libre en puesto libre (BFS de 8
 *      vecinos), tensado en tramos rectos que siguen sin tocar nada.
 *   3. `elegirDestino` → el próximo sitio donde revolotear.
 *
 * Los obstáculos llegan inflados por un margen: el balanceo del vuelo y el
 * corte de esquina de un paso diagonal nunca alcanzan al elemento real.
 *
 * @module visual/agente/vueloLibre
 */

/** Lo que no se tapa: el formulario entero, sus campos, botones, enlaces y el texto. */
export const SELECTOR_OBSTACULOS = 'form, input, select, textarea, button, a, label, [role="button"], h1, h2, h3, p, li';

/** Aire alrededor de cada obstáculo (px). Cubre el balanceo y el corte diagonal. */
export const MARGEN_OBSTACULO = 10;

/** @typedef {{left:number, top:number, right:number, bottom:number}} Caja */
/** @typedef {{x:number, y:number}} Punto */

/**
 * @param {Caja} a
 * @param {Caja} b
 * @returns {boolean}
 */
export function seCruzan(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Cajas de lo que no se puede tapar, ya infladas, recortadas al viewport.
 * @param {ParentNode} raiz
 * @param {{margen?:number, ignorar?:Element|null}} [opts]
 * @returns {Caja[]}
 */
export function obstaculosVisibles(raiz, { margen = MARGEN_OBSTACULO, ignorar = null } = {}) {
  if (!raiz?.querySelectorAll || typeof window === 'undefined') return [];
  const cajas = [];
  for (const nodo of raiz.querySelectorAll(SELECTOR_OBSTACULOS)) {
    if (ignorar && ignorar.contains(nodo)) continue;
    const r = nodo.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const estilo = window.getComputedStyle(nodo);
    if (estilo.visibility === 'hidden' || estilo.display === 'none') continue;
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) continue;
    cajas.push({ left: r.left - margen, top: r.top - margen, right: r.right + margen, bottom: r.bottom + margen });
  }
  return cajas;
}

/**
 * La rejilla de puestos libres.
 * @param {{ancho:number, alto:number, caja:number, obstaculos:Caja[], paso?:number, borde?:number}} opts
 * @returns {{paso:number, borde:number, columnas:number, filas:number, caja:number, libre:Uint8Array, cuantos:number}}
 */
export function mapaLibre({ ancho, alto, caja, obstaculos, paso = 12, borde = 4 }) {
  const columnas = Math.max(0, Math.floor((ancho - caja - 2 * borde) / paso) + 1);
  const filas = Math.max(0, Math.floor((alto - caja - 2 * borde) / paso) + 1);
  const libre = new Uint8Array(columnas * filas);
  let cuantos = 0;
  for (let f = 0; f < filas; f += 1) {
    for (let c = 0; c < columnas; c += 1) {
      const x = borde + c * paso;
      const y = borde + f * paso;
      const puesto = { left: x, top: y, right: x + caja, bottom: y + caja };
      if (!obstaculos.some((o) => seCruzan(puesto, o))) {
        libre[f * columnas + c] = 1;
        cuantos += 1;
      }
    }
  }
  return { paso, borde, columnas, filas, caja, libre, cuantos };
}

/** @returns {Punto} */
function puntoDeCelda(mapa, i) {
  return { x: mapa.borde + (i % mapa.columnas) * mapa.paso, y: mapa.borde + Math.floor(i / mapa.columnas) * mapa.paso };
}

/** Celda más cercana a un punto (sin mirar si está libre). */
function celdaDe(mapa, { x, y }) {
  const c = Math.min(mapa.columnas - 1, Math.max(0, Math.round((x - mapa.borde) / mapa.paso)));
  const f = Math.min(mapa.filas - 1, Math.max(0, Math.round((y - mapa.borde) / mapa.paso)));
  return f * mapa.columnas + c;
}

/**
 * ¿La caja puede ir en línea recta de `a` a `b` sin tocar ningún obstáculo?
 * Muestrea cada 3 px: la caja en cada muestra debe caber en un puesto libre
 * del viewport y no cruzarse con nada.
 * @param {Punto} a
 * @param {Punto} b
 * @param {Caja[]} obstaculos
 * @param {{caja:number, ancho:number, alto:number}} dims
 * @returns {boolean}
 */
export function tramoLibre(a, b, obstaculos, { caja, ancho, alto }) {
  const pasos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
  for (let k = 0; k <= pasos; k += 1) {
    const x = a.x + ((b.x - a.x) * k) / pasos;
    const y = a.y + ((b.y - a.y) * k) / pasos;
    if (x < 0 || y < 0 || x + caja > ancho || y + caja > alto) return false;
    const puesto = { left: x, top: y, right: x + caja, bottom: y + caja };
    if (obstaculos.some((o) => seCruzan(puesto, o))) return false;
  }
  return true;
}

/**
 * Camino de `desde` a `hasta` por puestos libres, tensado en tramos rectos.
 * `desde` puede estar tapado (p. ej. la pantalla se desplazó debajo de ella):
 * entonces el primer tramo es el más corto hasta un puesto libre.
 * @param {ReturnType<typeof mapaLibre>} mapa
 * @param {Punto} desde
 * @param {Punto} hasta  debe ser un puesto libre del mapa
 * @param {Caja[]} obstaculos
 * @param {{ancho:number, alto:number}} viewport
 * @returns {Punto[]|null}  puntos a recorrer (sin incluir `desde`), o null
 */
export function rutaLibre(mapa, desde, hasta, obstaculos, { ancho, alto }) {
  const { columnas, filas, libre } = mapa;
  if (!columnas || !filas) return null;
  const inicio = celdaDe(mapa, desde);
  const fin = celdaDe(mapa, hasta);
  if (!libre[fin]) return null;
  const previo = new Int32Array(columnas * filas).fill(-1);
  const cola = [inicio];
  previo[inicio] = inicio;
  for (let q = 0; q < cola.length; q += 1) {
    const i = cola[q];
    if (i === fin) break;
    const c = i % columnas;
    const f = Math.floor(i / columnas);
    for (let df = -1; df <= 1; df += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!df && !dc) continue;
        const cc = c + dc;
        const ff = f + df;
        if (cc < 0 || ff < 0 || cc >= columnas || ff >= filas) continue;
        const j = ff * columnas + cc;
        // Un paso diagonal exige los dos vecinos rectos libres: no rozar esquinas.
        if (dc && df && !(libre[f * columnas + cc] && libre[ff * columnas + c])) continue;
        if (previo[j] !== -1 || !libre[j]) continue;
        previo[j] = i;
        cola.push(j);
      }
    }
  }
  if (previo[fin] === -1) return null;
  const celdas = [];
  for (let i = fin; i !== inicio; i = previo[i]) celdas.push(i);
  celdas.reverse();
  const puntos = celdas.map((i) => puntoDeCelda(mapa, i));
  // Tensar: desde cada punto, saltar al más lejano alcanzable en línea recta.
  const dims = { caja: mapa.caja, ancho, alto };
  const tensa = [];
  let actual = desde;
  let k = 0;
  while (k < puntos.length) {
    let lejos = k;
    for (let m = puntos.length - 1; m > k; m -= 1) {
      if (tramoLibre(actual, puntos[m], obstaculos, dims)) { lejos = m; break; }
    }
    tensa.push(puntos[lejos]);
    actual = puntos[lejos];
    k = lejos + 1;
  }
  return tensa;
}

/**
 * Puesto libre más cercano a un punto.
 * @param {ReturnType<typeof mapaLibre>} mapa
 * @param {Punto} p
 * @returns {Punto|null}
 */
export function puestoLibreCercano(mapa, p) {
  let mejor = null;
  let dMejor = Infinity;
  for (let i = 0; i < mapa.libre.length; i += 1) {
    if (!mapa.libre[i]) continue;
    const q = puntoDeCelda(mapa, i);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < dMejor) { dMejor = d; mejor = q; }
  }
  return mejor;
}

/**
 * El próximo sitio donde revolotear: un puesto libre al azar, ni pegado al
 * actual ni al otro lado del mundo (entre `min` y `max` px).
 * `evitar` son zonas que se pueden CRUZAR pero donde no se queda (p. ej. la
 * ilustración del círculo del login): si hay puestos fuera de ellas, el
 * destino sale de esos.
 * @param {ReturnType<typeof mapaLibre>} mapa
 * @param {Punto} desde
 * @param {{rand?:() => number, min?:number, max?:number, evitar?:Caja[]}} [opts]
 * @returns {Punto|null}
 */
export function elegirDestino(mapa, desde, { rand = Math.random, min = 48, max = 260, evitar = [] } = {}) {
  const fuera = (q) => !evitar.some((z) => seCruzan({ left: q.x, top: q.y, right: q.x + mapa.caja, bottom: q.y + mapa.caja }, z));
  let hayFuera = false;
  for (let i = 0; i < mapa.libre.length && !hayFuera; i += 1) {
    if (mapa.libre[i] && fuera(puntoDeCelda(mapa, i))) hayFuera = true;
  }
  const cerca = [];
  const todos = [];
  for (let i = 0; i < mapa.libre.length; i += 1) {
    if (!mapa.libre[i]) continue;
    const q = puntoDeCelda(mapa, i);
    if (hayFuera && !fuera(q)) continue;
    todos.push(q);
    const d = Math.hypot(q.x - desde.x, q.y - desde.y);
    if (d >= min && d <= max) cerca.push(q);
  }
  const pool = cerca.length ? cerca : todos;
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}
