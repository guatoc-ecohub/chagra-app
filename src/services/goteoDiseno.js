/**
 * goteoDiseno.js — el diseño de goteo que llega de un mundo del goteo.
 *
 * Los cuatro mundos del goteo (campo abierto, invernadero, casa y bomba solar)
 * arman un enlace a la app con el sistema que el campesino calculó:
 *
 *   https://chagra.app/#mi_goteo?d=<JSON en base64url>
 *
 * Dentro de la app (iframe en /descensos/) el mismo texto `d` llega por
 * postMessage. Este módulo es la ÚNICA puerta de entrada de ese dato: lo
 * decodifica y lo valida contra un esquema cerrado. Lo que no cumple se
 * rechaza entero (no se "arregla"), y lo que sale es un objeto nuevo armado
 * solo con campos conocidos: nada del enlace pasa sin revisar.
 *
 * La vista lo pinta como texto de React; nunca como HTML.
 *
 * Esquema v1:
 *   { v: 1, mundo, nombre?, id?, estado: {llave: número|booleano|texto},
 *     resumen: {…campos conocidos}, piezas: [{ n, q, med? }] }
 */

/**
 * Lo que devuelve la validación: `diseno` si `ok`, `motivo` si no.
 * @typedef {{ok: boolean, diseno?: any, motivo?: string}} ResultadoDiseno
 */

/** Los mundos que pueden mandar un diseño, y su pieza dentro de la app. */
export const MUNDOS_GOTEO = Object.freeze({
  'riego-goteo': { titulo: 'Goteo en campo abierto', ruta: '/descensos/riego-goteo/index.html' },
  'goteo-invernadero': { titulo: 'Goteo en el invernadero', ruta: '/descensos/goteo-invernadero/index.html' },
  'goteo-en-casa': { titulo: 'Goteo en la casa', ruta: '/descensos/goteo-en-casa/index.html' },
  'goteo-bomba-solar': { titulo: 'Goteo con bomba solar', ruta: '/descensos/goteo-bomba-solar/index.html' },
});

/** Topes: un enlace más largo que esto no viene de un mundo del goteo. */
export const MAX_ENLACE = 16000;
const MAX_PIEZAS = 80;
const MAX_LLAVES_ESTADO = 40;

/**
 * Lo que puede traer el resumen. Números con su rango, o texto corto.
 * @type {Record<string, {tipo:'num', min:number, max:number, etiqueta:string, unidad?:string} | {tipo:'txt', etiqueta:string}>}
 */
export const CAMPOS_RESUMEN = Object.freeze({
  cultivo: { tipo: 'txt', etiqueta: 'Qué riega' },
  area_m2: { tipo: 'num', min: 0, max: 1_000_000, etiqueta: 'Área', unidad: 'm²' },
  agua_dia_l: { tipo: 'num', min: 0, max: 10_000_000, etiqueta: 'Agua al día', unidad: 'L' },
  sectores: { tipo: 'num', min: 0, max: 500, etiqueta: 'Sectores (turnos)' },
  manguera_m: { tipo: 'num', min: 0, max: 100_000, etiqueta: 'Manguera', unidad: 'm' },
  cinta_m: { tipo: 'num', min: 0, max: 1_000_000, etiqueta: 'Cinta de goteo', unidad: 'm' },
  goteros: { tipo: 'num', min: 0, max: 10_000_000, etiqueta: 'Goteros' },
  caudal_lh: { tipo: 'num', min: 0, max: 100, etiqueta: 'Caudal de cada gotero', unidad: 'L/h' },
  fuente: { tipo: 'txt', etiqueta: 'De dónde viene el agua' },
  tanque_l: { tipo: 'num', min: 0, max: 10_000_000, etiqueta: 'Tanque', unidad: 'L' },
  bomba: { tipo: 'txt', etiqueta: 'Bomba' },
  paneles_w: { tipo: 'num', min: 0, max: 1_000_000, etiqueta: 'Paneles solares', unidad: 'W' },
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LLAVE_ESTADO = /^[a-zA-Z][a-zA-Z0-9]{0,19}$/;
const VALOR_TEXTO_ESTADO = /^[a-zA-Z0-9_-]{1,24}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
// Texto para mostrar: sin caracteres de control ni ángulos. El mundo ya
// manda texto plano; si trae otra cosa, el enlace no salió de un mundo.
const esControl = (c) => { const n = c.charCodeAt(0); return n < 32 || n === 127; };
const tieneProhibido = (t) => [...t].some((c) => c === '<' || c === '>' || esControl(c));

const esObjetoPlano = (x) => x !== null && typeof x === 'object' && !Array.isArray(x)
  && Object.getPrototypeOf(x) === Object.prototype;

/** Error de validación con un motivo que se puede mostrar. */
class DisenoInvalido extends Error {}
const falla = (motivo) => { throw new DisenoInvalido(motivo); };

function texto(x, max, campo, { opcional = false } = {}) {
  if (x === undefined && opcional) return undefined;
  if (typeof x !== 'string') falla(`${campo}: no es texto`);
  const t = x.trim();
  if (!t) return opcional ? undefined : falla(`${campo}: vacío`);
  if (t.length > max) falla(`${campo}: demasiado largo`);
  if (tieneProhibido(t)) falla(`${campo}: caracteres no permitidos`);
  return t;
}

function numero(x, min, max, campo) {
  if (typeof x !== 'number' || !Number.isFinite(x)) falla(`${campo}: no es un número`);
  if (x < min || x > max) falla(`${campo}: fuera de rango`);
  return x;
}

function validarEstado(estado) {
  if (!esObjetoPlano(estado)) falla('estado: no es un objeto');
  const llaves = Object.keys(estado);
  if (llaves.length > MAX_LLAVES_ESTADO) falla('estado: demasiadas llaves');
  const out = {};
  for (const k of llaves) {
    if (!LLAVE_ESTADO.test(k)) falla('estado: llave no permitida');
    const v = estado[k];
    if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'number') out[k] = numero(v, -1_000_000, 1_000_000, `estado.${k}`);
    else if (typeof v === 'string' && VALOR_TEXTO_ESTADO.test(v)) out[k] = v;
    else falla(`estado.${k}: valor no permitido`);
  }
  return out;
}

function validarResumen(resumen) {
  if (resumen === undefined) return {};
  if (!esObjetoPlano(resumen)) falla('resumen: no es un objeto');
  const out = {};
  for (const k of Object.keys(resumen)) {
    const campo = Object.hasOwn(CAMPOS_RESUMEN, k) ? CAMPOS_RESUMEN[k] : null;
    if (!campo) falla(`resumen: campo desconocido`);
    out[k] = campo.tipo === 'num'
      ? numero(resumen[k], campo.min, campo.max, `resumen.${k}`)
      : texto(resumen[k], 60, `resumen.${k}`);
  }
  return out;
}

function validarPiezas(piezas) {
  if (!Array.isArray(piezas)) falla('piezas: no es una lista');
  if (piezas.length === 0) falla('piezas: la lista está vacía');
  if (piezas.length > MAX_PIEZAS) falla('piezas: demasiadas');
  return piezas.map((p, i) => {
    if (!esObjetoPlano(p)) falla(`piezas[${i}]: no es un objeto`);
    const pieza = { n: texto(p.n, 80, `piezas[${i}].n`), q: texto(p.q, 40, `piezas[${i}].q`) };
    const med = texto(p.med, 200, `piezas[${i}].med`, { opcional: true });
    if (med) pieza.med = med;
    return pieza;
  });
}

/**
 * Valida un diseño ya parseado. Devuelve un objeto nuevo con solo lo conocido.
 * @param {unknown} crudo
 * @returns {ResultadoDiseno}
 */
export function validarDiseno(crudo) {
  try {
    if (!esObjetoPlano(crudo)) falla('no es un objeto');
    const o = /** @type {Record<string, unknown>} */ (crudo);
    if (o.v !== 1) falla('versión desconocida');
    if (typeof o.mundo !== 'string' || !Object.hasOwn(MUNDOS_GOTEO, o.mundo)) falla('mundo desconocido');
    const mundo = /** @type {string} */ (o.mundo);   // ya comprobado arriba
    const diseno = {
      v: 1,
      mundo,
      nombre: texto(o.nombre, 60, 'nombre', { opcional: true }) || MUNDOS_GOTEO[mundo].titulo,
      estado: validarEstado(o.estado),
      resumen: validarResumen(o.resumen),
      piezas: validarPiezas(o.piezas),
    };
    if (o.id !== undefined) {
      const id = typeof o.id === 'string' ? o.id : '';
      if (!UUID.test(id)) falla('id no válido');
      diseno.id = id.toLowerCase();
    }
    return { ok: true, diseno };
  } catch (e) {
    if (e instanceof DisenoInvalido) return { ok: false, motivo: e.message };
    return { ok: false, motivo: 'no se pudo leer' };
  }
}

/**
 * Decodifica el texto `d` del enlace (base64url de un JSON en UTF-8) y lo valida.
 * @param {unknown} d
 * @returns {ResultadoDiseno}
 */
export function decodificarDiseno(d) {
  if (typeof d !== 'string' || !d) return { ok: false, motivo: 'enlace vacío' };
  if (d.length > MAX_ENLACE) return { ok: false, motivo: 'enlace demasiado largo' };
  if (!BASE64URL.test(d)) return { ok: false, motivo: 'enlace alterado' };
  let json;
  try {
    const b64 = d.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (d.length % 4)) % 4);
    const binario = atob(b64);
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, motivo: 'enlace alterado' };
  }
  return validarDiseno(json);
}

/**
 * Codifica un diseño como lo hacen los mundos (para pruebas y para reenviar).
 * @param {object} diseno
 * @returns {string}
 */
export function codificarDiseno(diseno) {
  const bytes = new TextEncoder().encode(JSON.stringify(diseno));
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Lee el parámetro `d` de un hash `#mi_goteo?d=…` (o `#/mi_goteo?d=…`).
 * @param {string} hash
 * @returns {string|null}
 */
export function leerParametroEnlace(hash) {
  const m = /^#\/?mi[_-]goteo\?(.*)$/i.exec(String(hash || ''));
  if (!m) return null;
  try {
    return new URLSearchParams(m[1]).get('d');
  } catch {
    return null;
  }
}

/**
 * La dirección de la pieza del mundo con el diseño cargado, para «Cambiar en el mundo».
 * Solo pasa llaves y valores ya validados; `puerta=0` evita que la pieza pregunte de nuevo.
 * @param {{mundo:string, estado:Record<string, unknown>}} diseno
 * @param {string} [id] el sistema guardado, para que el mundo lo devuelva y se actualice ese
 * @returns {string|null}
 */
export function rutaCambiarEnMundo(diseno, id) {
  const mundo = diseno && Object.hasOwn(MUNDOS_GOTEO, diseno.mundo) ? MUNDOS_GOTEO[diseno.mundo] : null;
  if (!mundo) return null;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(diseno.estado || {})) {
    if (!LLAVE_ESTADO.test(k)) continue;
    if (typeof v === 'boolean') q.set(k, v ? '1' : '0');
    else if (typeof v === 'number' && Number.isFinite(v)) q.set(k, String(v));
    else if (typeof v === 'string' && VALOR_TEXTO_ESTADO.test(v)) q.set(k, v);
  }
  if (id && UUID.test(id)) q.set('goteo_id', id);
  q.set('puerta', '0');
  return `${mundo.ruta}?${q.toString()}`;
}

// ── El enlace que llegó y todavía no se ha confirmado ─────────────────────
// Se guarda en el teléfono para que no se pierda si hace falta iniciar sesión
// o si se cierra la app antes de confirmar.

export const CLAVE_POR_CONFIRMAR = 'chagra:goteo:por-confirmar';

/** @param {string} d */
export function guardarPorConfirmar(d) {
  if (typeof d !== 'string' || d.length > MAX_ENLACE || !BASE64URL.test(d)) return false;
  try { localStorage.setItem(CLAVE_POR_CONFIRMAR, d); return true; } catch { return false; }
}

/** @returns {string|null} */
export function leerPorConfirmar() {
  try { return localStorage.getItem(CLAVE_POR_CONFIRMAR); } catch { return null; }
}

export function olvidarPorConfirmar() {
  try { localStorage.removeItem(CLAVE_POR_CONFIRMAR); } catch { /* sin almacenamiento */ }
}

/**
 * Si la dirección actual trae un diseño, lo deja por confirmar. Se llama al
 * arrancar la app, antes de saber si hay sesión, para que el login no lo pierda.
 * @returns {boolean} si había un diseño en la dirección
 */
export function capturarEnlaceDeLaDireccion() {
  if (typeof window === 'undefined') return false;
  const d = leerParametroEnlace(window.location.hash);
  return d ? guardarPorConfirmar(d) : false;
}
