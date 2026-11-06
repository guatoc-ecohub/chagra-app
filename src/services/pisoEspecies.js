// SPDX-License-Identifier: AGPL-3.0-only
/**
 * pisoEspecies — ¿esta especie es propia del piso de la finca?
 *
 * Una sola fuente de rangos altitudinales para el agente, sus guardas y la
 * pantalla de restauración: `src/data/rangosAltitudEspecies.json`, derivada del
 * catálogo v3.2 (rango absoluto) y del grafo por
 * `scripts/gen-rangos-altitud-especies.mjs`. Nada se decide por una lista de
 * nombres escrita a mano: se decide por el rango del dato.
 */
import RANGOS from '../data/rangosAltitudEspecies.json';
import ESPECIES_RESTAURACION from '../data/restauracion-especies.json';

const norm = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase();

/** «Fragaria vesca L.» → «fragaria vesca» (mismo criterio que el generador). */
export function binomioDe(cientifico) {
  const t = norm(cientifico).replace(/\[.*?\]|\(.*?\)/g, ' ').split(/\s+/).filter(Boolean);
  if (t.length < 2 || !/^[a-z]+$/.test(t[0]) || !/^[a-z-]+$/.test(t[1])) return null;
  return `${t[0]} ${t[1]}`;
}

const POR_ID = new Map();
const POR_BINOMIO = new Map();
/** Nombres comunes normalizados por fila (la tabla guarda los visibles). */
const NOMBRES_NORM = new Map(RANGOS.especies.map((f) => [f.id, f.n.map((n) => norm(n).replace(/\s+/g, ' ').trim())]));
for (const fila of RANGOS.especies) {
  POR_ID.set(fila.id, fila);
  if (fila.b && !POR_BINOMIO.has(fila.b)) POR_BINOMIO.set(fila.b, fila);
}

/**
 * Rango de una especie por id del catálogo o por nombre científico.
 * @param {{id?: string, cientifico?: string}|string} especie
 * @returns {{min:number, max:number, estatus:string, id:string}|null}
 */
export function rangoDeEspecie(especie) {
  const id = typeof especie === 'string' ? especie : especie?.id;
  const cientifico = typeof especie === 'string' ? especie : especie?.cientifico;
  const fila = (id && POR_ID.get(id)) || (cientifico && POR_BINOMIO.get(binomioDe(cientifico)));
  return fila ? { min: fila.min, max: fila.max, estatus: fila.e, id: fila.id } : null;
}

/** Altitud válida de finca (m s. n. m.) o null. */
export function altitudValida(alt) {
  if (alt == null || alt === '') return null;
  const n = typeof alt === 'number' ? alt : Number(String(alt).replace(/[.,\s]/g, ''));
  return Number.isFinite(n) && n > 0 && n < 6500 ? n : null;
}

/**
 * ¿La especie se da a esa altitud? true / false según su rango; null si no hay
 * rango con fuente (ni en catálogo ni en grafo).
 */
export function especieEnRango(especie, alt, rangoRespaldo = null) {
  const a = altitudValida(alt);
  if (a == null) return null;
  const r = rangoDeEspecie(especie) || rangoRespaldo;
  if (!r) return null;
  return a >= r.min && a <= r.max;
}

/** Texto corto del rango: «1.800–3.600 m». */
export function textoRango(r) {
  if (!r) return '';
  const f = (n) => Number(n).toLocaleString('es-CO');
  return `${f(r.min)}–${f(r.max)} m`;
}

/** Rango de cada bucket de restauracion-especies.json, leído de su clave. */
function rangoDeBucket(clave) {
  const m = String(clave).match(/_(\d+)(?:_(\d+))?$/);
  if (!m) return null;
  return { min: Number(m[1]), max: m[2] ? Number(m[2]) : 4800 };
}

const ROLES = ['pioneras', 'intermedias', 'climax'];

/**
 * Nativas para restaurar a esta altitud, juntando TODOS los buckets de
 * restauracion-especies.json y quedándose con las que su rango incluye la
 * altitud (el del catálogo; si no hay, el del bucket donde está). Solo especies
 * nativas: las introducidas no restauran el monte.
 *
 * @param {number} alt
 * @returns {{pioneras:any[], intermedias:any[], climax:any[]}|null}
 */
export function nativasRestauracionPorAltitud(alt) {
  const a = altitudValida(alt);
  if (a == null) return null;
  const out = { pioneras: [], intermedias: [], climax: [] };
  const vistas = new Set();
  for (const [clave, roles] of Object.entries(ESPECIES_RESTAURACION.especies_por_rol)) {
    const respaldo = rangoDeBucket(clave);
    for (const rol of ROLES) {
      for (const e of roles[rol] || []) {
        const b = binomioDe(e.cientifico);
        if (vistas.has(b)) continue;
        const r = rangoDeEspecie(e) || respaldo;
        if (!r || a < r.min || a > r.max) continue;
        const estatus = rangoDeEspecie(e)?.estatus;
        if (estatus && estatus !== 'nativa') continue;
        vistas.add(b);
        out[rol].push({ ...e, rango: r });
      }
    }
  }
  return out;
}

/** Lista plana «Nombre (Cientifico)» de nativas del piso, para notas cortas. */
export function nombresNativasDelPiso(alt, max = 4) {
  const n = nativasRestauracionPorAltitud(alt);
  if (!n) return [];
  return [...n.pioneras, ...n.intermedias, ...n.climax]
    .slice(0, max)
    .map((e) => `${e.nombre} (${e.cientifico})`);
}

/** Nombres comunes y géneros que lleva alguna especie NO invasora del catálogo. */
const NOMBRES_NO_INVASORES = new Set();
const GENEROS_NO_INVASORES = new Set();
for (const f of RANGOS.especies) {
  if (f.e === 'invasora') continue;
  NOMBRES_NORM.get(f.id).forEach((n) => NOMBRES_NO_INVASORES.add(n));
  if (f.b) GENEROS_NO_INVASORES.add(f.b.split(' ')[0]);
}

/**
 * Invasoras del catálogo (estatus derivado del catálogo, grafo y VETADA).
 * `visible` es el nombre común para mostrar, solo si ninguna especie no
 * invasora lo comparte («botón de oro» también es Tithonia): si no, null y se
 * muestra el binomio.
 */
export const INVASORAS_CATALOGO = Object.freeze(
  RANGOS.especies.filter((f) => f.e === 'invasora').map((f) => {
    const normales = NOMBRES_NORM.get(f.id);
    const i = normales.findIndex((n) => !NOMBRES_NO_INVASORES.has(n));
    return { id: f.id, binomio: f.b, nombres: normales, visible: i >= 0 ? f.n[i] : null, min: f.min, max: f.max };
  }),
);

/**
 * Invasoras para la guarda de reforestación, con sus alias. Un nombre común
 * solo cuenta si ninguna especie NO invasora del catálogo lo comparte («botón
 * de oro» es también Tithonia), y los de una palabra piden 5 letras. El género
 * vale de alias cuando todas las especies del catálogo de ese género son
 * invasoras (acacia, eucalyptus, ulex).
 */
export const INVASORAS_PARA_GUARDA = Object.freeze((() => {
  const nombresNoInv = NOMBRES_NO_INVASORES;
  const generosNoInv = GENEROS_NO_INVASORES;
  return INVASORAS_CATALOGO.map((f) => {
    const aliases = new Set();
    if (f.binomio) aliases.add(f.binomio);
    for (const n of f.nombres) {
      if (nombresNoInv.has(n) || (!n.includes(' ') && n.length < 5)) continue;
      aliases.add(n);
    }
    const g = f.binomio?.split(' ')[0];
    if (g && g.length >= 5 && !generosNoInv.has(g)) aliases.add(g);
    const key = f.binomio ? f.binomio.replace(/^./, (c) => c.toUpperCase()) : f.id;
    return { key, aliases: [...aliases], min: f.min, max: f.max };
  });
})());

/** Invasoras cuyo rango incluye la altitud (las que de verdad amenazan esa finca). */
export function invasorasEnAltitud(alt) {
  const a = altitudValida(alt);
  if (a == null) return INVASORAS_CATALOGO;
  return INVASORAS_CATALOGO.filter((f) => a >= f.min && a <= f.max);
}

// ── Menciones en un texto libre ────────────────────────────────────────────

/** Palabras que como nombre suelto no identifican una especie. */
const GENERICOS = new Set([
  'pasto', 'palma', 'helecho', 'hierba', 'yerba', 'flor', 'arbol', 'bejuco', 'mata', 'raiz',
  'hoja', 'rabo', 'oreja', 'cola', 'pata', 'lengua', 'pino', 'paja', 'lirio', 'boton', 'tilo',
  'pinto', 'blanco', 'negro', 'rojo', 'verde', 'amarillo', 'morado', 'silvestre', 'andino',
  'andina', 'criollo', 'criolla', 'comun', 'enano', 'gigante', 'nativo', 'nativa', 'castillo',
  'planta', 'barba', 'sangre', 'diente', 'corazon', 'mano', 'ojo', 'olla', 'caro', 'siete',
  'sweet', 'grape', 'guinea', 'victoria', 'galan', 'rosado', 'colorado', 'coloradito', 'esmeralda',
  'toche', 'vaquero', 'campano', 'pica', 'robo', 'chupa', 'taco', 'noli', 'voluble', 'cenicafe',
  'sungold', 'savoy', 'jamaica', 'palo', 'chinchilla', 'cosmos', 'dormilona', 'sensitiva',
]);

/** Índice nombre → rango UNIÓN de todas las especies que lo llevan. */
const POR_NOMBRE = (() => {
  const idx = new Map();
  const add = (clave, fila, display) => {
    if (!clave || clave.length < 4) return;
    const prev = idx.get(clave);
    if (prev) {
      prev.min = Math.min(prev.min, fila.min);
      prev.max = Math.max(prev.max, fila.max);
      prev.ids.add(fila.id);
      if (fila.e !== 'invasora') prev.soloInvasoras = false;
    } else {
      idx.set(clave, { min: fila.min, max: fila.max, ids: new Set([fila.id]), display, soloInvasoras: fila.e === 'invasora' });
    }
  };
  for (const fila of RANGOS.especies) {
    if (fila.b) add(fila.b, fila, fila.b.replace(/^./, (c) => c.toUpperCase()));
    for (const n of NOMBRES_NORM.get(fila.id)) {
      add(n, fila, n);
    }
  }
  // Un nombre común de base se puede usar para las variantes de un mismo
  // binomio (p. ej., «lechuga»), pero no si ese término abrevia especies
  // distintas («haba», «papa» o «frijol»). En los casos ambiguos solo cuenta
  // el nombre compuesto completo.
  const basesPorNombre = new Map();
  for (const fila of RANGOS.especies) {
    if (!fila.b) continue;
    for (const nombre of NOMBRES_NORM.get(fila.id)) {
      const palabras = nombre.split(' ');
      const base = palabras[0];
      if (palabras.length < 2 || GENERICOS.has(base)) continue;
      const grupo = basesPorNombre.get(base) || new Map();
      const filas = grupo.get(fila.b) || new Map();
      filas.set(fila.id, fila);
      grupo.set(fila.b, filas);
      basesPorNombre.set(base, grupo);
    }
  }
  for (const [base, binomios] of basesPorNombre) {
    const existentes = idx.get(base);
    if (existentes) {
      for (const id of existentes.ids) {
        const fila = POR_ID.get(id);
        if (!fila?.b) continue;
        const filas = binomios.get(fila.b) || new Map();
        filas.set(fila.id, fila);
        binomios.set(fila.b, filas);
      }
    }
    if (binomios.size !== 1) continue;
    for (const fila of binomios.values().next().value.values()) add(base, fila, base);
  }
  for (const g of GENERICOS) idx.delete(g);
  return idx;
})();

const MAX_NGRAMA = Math.max(
  4,
  ...[...NOMBRES_NORM.values()].flatMap((nombres) => nombres.map((nombre) => nombre.split(' ').length)),
);

/**
 * Especies con rango mencionadas en un texto ya normalizado (sin tildes, en
 * minúsculas). Prefiere el n-grama más largo («fresa silvestre andina» antes
 * que «fresa»).
 *
 * @param {string} textoNorm
 * @returns {Array<{clave:string, min:number, max:number, ids:string[], inicio:number}>}
 */
export function mencionesConRango(textoNorm) {
  const palabras = [];
  const re = /[a-zñ]+(?:-[a-zñ]+)?/g;
  let m;
  while ((m = re.exec(textoNorm))) palabras.push({ w: m[0], i: m.index });
  const out = [];
  const usadas = new Set();
  for (let i = 0; i < palabras.length; i += 1) {
    for (let n = Math.min(MAX_NGRAMA, palabras.length - i); n >= 1; n -= 1) {
      const clave = palabras.slice(i, i + n).map((p) => p.w).join(' ');
      const hit = POR_NOMBRE.get(clave);
      if (!hit) continue;
      const key = [...hit.ids].sort().join('|');
      if (!usadas.has(key)) {
        usadas.add(key);
        out.push({ clave, min: hit.min, max: hit.max, ids: [...hit.ids], inicio: palabras[i].i, soloInvasoras: hit.soloInvasoras });
      }
      i += n - 1;
      break;
    }
  }
  return out;
}
