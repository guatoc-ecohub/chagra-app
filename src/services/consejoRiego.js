/**
 * consejoRiego.js — cuánto regar hoy cada sistema de «Mi goteo», con el
 * pronóstico de la finca.
 *
 * ── La cuenta es la de los mundos del goteo ─────────────────────────────────
 * El mundo calcula con la ETo media de la altitud (Cenicafé 2006). Aquí se
 * hace la MISMA cuenta, paso por paso, cambiando solo de dónde sale la ETo:
 * la del pronóstico de hoy (Open-Meteo, FAO-56), y se le descuenta la lluvia
 * pronosticada para hoy en lo que está a cielo abierto. Con la ETo de la
 * altitud y sin lluvia, los minutos salen iguales a los del mundo (lo prueba
 * `consejoRiego.test.js` contra los casos de cada mundo).
 *
 *   riego-goteo (campo abierto, `public/descensos/riego-goteo/`, sistema()):
 *     L/m² = ETc ÷ 0,9 · hortaliza: L/día = L/m² × área del lote
 *                      · árbol: L/día = L/m² × espacio por mata × matas
 *     minutos por turno = L/día ÷ (caudal de todo abierto) × 60
 *   goteo-invernadero (`public/descensos/goteo-invernadero/`, cuenta()):
 *     L/m² = ETo × 0,6 (bajo plástico) × Kc ÷ 0,9 · lo demás, igual
 *
 * ── Lluvia ──────────────────────────────────────────────────────────────────
 * La misma regla prudente de la alerta de riego por lote
 * (irrigationAlertService): la lluvia del día cuenta hasta lo que pide la
 * mata ese día, y lo que sobra no se guarda como reserva (no hay dato del
 * suelo). Bajo plástico la lluvia no cuenta. La lluvia de mañana no se
 * descuenta hoy: si no llega, la mata ya pasó el día sin agua.
 *
 * ── Lo que NO hace ──────────────────────────────────────────────────────────
 * Sin pronóstico, viejo o sin ETo de hoy: lo dice y no da minutos. No riega
 * por encima del tanque: si lo de hoy pasa del tanque, da los minutos que
 * alcanza el tanque lleno y lo dice. Los sistemas de la casa y de la bomba
 * solar no traen en el diseño con qué rehacer la cuenta: lo dice.
 *
 * Pura, sin red ni almacenamiento: el que llama le pasa el pronóstico ya
 * normalizado (agroMeteoService.normalizarAgroMeteo) y los sistemas
 * (miGoteoService.sistemasDeGoteo).
 *
 * @module services/consejoRiego
 */

import { vigenciaPronostico } from './vigenciaPronostico.js';

/** Eficiencia del goteo (FAO, manual 4, anexo I), la de los mundos. */
export const EF_GOTEO = 0.9;
/** Bajo plástico la mata pide el 60 % de afuera (FAO 2013, invernaderos), la del mundo del invernadero. */
export const BAJO_PLASTICO = 0.6;

/** ETo media por altitud (Cenicafé 2006, de 170 a 3 700 m), la de los mundos. */
export const etoCenicafe = (alt) => 4.37 * Math.exp(-0.0002 * alt);

/** Coeficientes del cultivo del mundo de campo abierto: FAO-56, tabla 12 (inicio, mitad, final). */
export const KC_CAMPO = Object.freeze({
  tomate: { t: 'Tomate', kc: [0.6, 1.15, 0.80] },
  pimenton: { t: 'Pimentón', kc: [0.6, 1.05, 0.90] },
  frijol: { t: 'Fríjol verde', kc: [0.5, 1.05, 0.90] },
  cebolla: { t: 'Cebolla de bulbo', kc: [0.7, 1.05, 0.75] },
  lechuga: { t: 'Lechuga', kc: [0.7, 1.00, 0.95] },
  repollo: { t: 'Repollo', kc: [0.7, 1.05, 0.95] },
  cafe: { t: 'Café, suelo desnudo', kc: [0.90, 0.95, 0.95] },
  cafeA: { t: 'Café con arvenses', kc: [1.05, 1.10, 1.10] },
  banano: { t: 'Banano, primer año', kc: [0.50, 1.10, 1.00] },
  cacao: { t: 'Cacao', kc: [1.00, 1.05, 1.05] },
  aguacate: { t: 'Aguacate sin cobertura', kc: [0.60, 0.85, 0.75] },
});
const ETAPAS = Object.freeze({ inicio: 0, media: 1, final: 2 });
const NOMBRE_ETAPA = Object.freeze({ inicio: 'recién sembrado', media: 'en plena producción', final: 'al final del ciclo' });

/** Coeficientes del mundo del invernadero: FAO-56, tabla 12, mitad del ciclo, con tutor. */
export const KC_INVERNADERO = Object.freeze({
  tomate: { t: 'Tomate', kc: 1.20 },
  pimenton: { t: 'Pimentón', kc: 1.15 },
  pepino: { t: 'Pepino', kc: 1.15 },
  fresa: { t: 'Fresa', kc: 0.85 },
  hoja: { t: 'Hortaliza de hoja', kc: 1.00 },
});
/** Tabla 14 de CORPOICA y FAO 2007 (máximo, L/m² al día por semana), la del mundo del invernadero. */
const TABLA14 = [[1, 1, 1.25], [2, 5, 3.0], [6, 6, 3.5], [7, 9, 4.0], [10, 11, 4.5], [12, 15, 5.5], [16, 17, 6.5], [18, 20, 6.0], [21, 27, 5.0]];
const tablaMax = (sem) => { for (const [a, b, v] of TABLA14) if (sem >= a && sem <= b) return v; return 5.0; };

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const pos = (x) => { const n = num(x); return n !== null && n > 0 ? n : null; };

/**
 * Lo que la cuenta del día necesita de un sistema guardado.
 * @typedef {Object} Geometria
 * @property {number} kc
 * @property {string} cultivo
 * @property {string|null} etapa
 * @property {number} Qtot litros por hora con todo abierto
 * @property {number} turnos
 * @property {number} m2 metros cuadrados a los que se les pone el agua
 * @property {'clima'|'tabla'|'medido'} metodo
 * @property {boolean} bajoPlastico
 * @property {number|null} semana
 * @property {number|null} medido
 */

/**
 * La geometría del sistema de campo abierto, como `sistema()` del mundo.
 * @returns {Geometria|null}
 */
function geometriaCampo(e) {
  const C = KC_CAMPO[e.cultivo];
  const etapa = Object.hasOwn(ETAPAS, e.etapa) ? e.etapa : null;
  const ancho = pos(e.ancho), largo = pos(e.largo), surco = pos(e.surco), qf = pos(e.qf), amata = pos(e.amata);
  if (!C || !etapa || !ancho || !largo || !surco || !qf || !amata) return null;
  const boton = e.linea === 'boton';
  const q = pos(e.qgot), n = pos(e.ngot), s = pos(e.s), qe = pos(e.qe);
  if (boton ? !q || !n : !s || !qe) return null;
  const area = ancho * largo;
  const nSurcos = Math.max(1, Math.floor(ancho / surco + 1e-9));
  const largoSurco = Math.max(1, largo - 1);
  const entre = amata / surco;
  const matasSurco = Math.max(1, Math.floor(largoSurco / entre + 1e-9));
  const nMatas = nSurcos * matasSurco;
  const lateral = nSurcos * largoSurco;
  const Qtot = boton ? nMatas * n * q : lateral / s * qe;
  const turnos = Math.max(1, Math.ceil(Qtot / (qf * 60) - 1e-9));
  // Metros cuadrados a los que se les pone el agua: árboles por mata, hortalizas el lote.
  const m2 = boton ? amata * nMatas : area;
  return { kc: C.kc[ETAPAS[etapa]], cultivo: C.t, etapa, Qtot, turnos, m2, metodo: 'clima', bajoPlastico: false, semana: null, medido: null };
}

/**
 * La geometría del sistema del invernadero, como `cuenta()` del mundo.
 * @returns {Geometria|null}
 */
function geometriaInvernadero(e) {
  const C = KC_INVERNADERO[e.cultivo];
  const ancho = pos(e.ancho), largo = pos(e.largo), centro = pos(e.centro), lineas = pos(e.lineas), qf = pos(e.qf);
  if (!C || !ancho || !largo || !centro || !lineas || !qf) return null;
  const familiar = e.linea === 'familiar';
  const desnivel = num(e.desnivel) ?? 0;
  const s = familiar ? 0.3 : pos(e.s);
  const qe = familiar ? 0.6 * Math.sqrt(Math.min(Math.max(desnivel, 1), 2)) : pos(e.qe);
  if (!s || !qe) return null;
  const area = ancho * largo;
  const nCamas = Math.max(1, Math.floor(ancho / centro + 1e-9));
  const largoCama = Math.max(1, largo - 1);
  const nLineas = nCamas * lineas;
  const Qtot = nLineas * largoCama / s * qe;
  const turnos = Math.max(1, Math.ceil(Qtot / (qf * 60) - 1e-9));
  /** @type {'clima'|'tabla'|'medido'} */
  const metodo = e.metodo === 'tabla' && e.cultivo !== 'tomate' ? 'clima' : e.metodo === 'tabla' || e.metodo === 'medido' ? e.metodo : 'clima';
  const bajoPlastico = e.lugar !== 'campo';
  return { kc: C.kc, cultivo: C.t, etapa: null, Qtot, turnos, m2: area, metodo, bajoPlastico, semana: num(e.semana), medido: num(e.medido) };
}

/**
 * Minutos de un turno para un sistema y un día de clima.
 * Exportada para las pruebas de igualdad con los mundos.
 *
 * @param {{mundo:string, estado:object, resumen?:object}} diseno validado por goteoDiseno
 * @param {{eto:number, lluvia?:number}} dia ETo y lluvia del día, en mm
 * @returns {null | {
 *   tipo:'minutos'|'no-riegue'|'sin-clima', minutos:number, turnos:number, litros:number, litrosPide:number,
 *   etcMm:number|null, lluviaMm:number, lluviaCuenta:number, kc:number|null, cultivo:string, etapa:string|null,
 *   bajoPlastico:boolean, tanque:{litros:number, recortado:boolean}|null, metodo:string
 * }}
 */
export function cuentaDelDia(diseno, dia) {
  const e = diseno?.estado || {};
  const eto = num(dia?.eto);
  const lluvia = Math.max(0, num(dia?.lluvia) ?? 0);
  let G;
  if (diseno?.mundo === 'riego-goteo') {
    G = geometriaCampo(e);
  } else if (diseno?.mundo === 'goteo-invernadero') {
    G = geometriaInvernadero(e);
  } else {
    return null;
  }
  if (!G) return null;

  let litros, etc = null, lluviaCuenta = 0;
  /** @type {'minutos'|'no-riegue'|'sin-clima'} */
  let tipo = 'minutos';
  if (G.metodo === 'clima') {
    if (eto === null || eto < 0) return null;
    etc = eto * (G.bajoPlastico ? BAJO_PLASTICO : 1) * G.kc;          // mm = L/m² que usa la mata hoy
    lluviaCuenta = G.bajoPlastico ? 0 : Math.min(lluvia, etc);        // regla prudente de la alerta de riego
    const falta = etc - lluviaCuenta;
    litros = falta / EF_GOTEO * G.m2;
    if (falta <= 1e-9) tipo = 'no-riegue';
  } else if (G.metodo === 'tabla') {
    if (G.semana === null) return null;
    litros = tablaMax(G.semana) * G.m2;
    tipo = 'sin-clima';
  } else {
    if (G.medido === null) return null;
    litros = G.medido;
    tipo = 'sin-clima';
  }

  let minutos = tipo === 'no-riegue' ? 0 : litros / G.Qtot * 60;
  let tanque = null;
  const tanqueL = pos(diseno?.resumen?.tanque_l);
  if (tanqueL !== null) {
    const recortado = litros > tanqueL + 1e-9;
    if (recortado) minutos = tanqueL / G.Qtot * 60;
    tanque = { litros: tanqueL, recortado };
  }
  return {
    tipo,
    minutos,
    turnos: G.turnos,
    litros: tanque?.recortado ? tanqueL : (tipo === 'no-riegue' ? 0 : litros),
    litrosPide: tipo === 'no-riegue' ? 0 : litros,
    etcMm: etc,
    lluviaMm: lluvia,
    lluviaCuenta,
    kc: G.metodo === 'clima' ? G.kc : null,
    cultivo: G.cultivo,
    etapa: G.etapa,
    bajoPlastico: G.bajoPlastico,
    tanque,
    metodo: G.metodo,
  };
}

const fmt = (n, d = 1) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: d });
/** Minutos para decir: redondeados al minuto, nunca «0 minutos» si hay que regar. */
export const minutosTxt = (m) => {
  const r = Math.max(1, Math.round(m));
  if (r < 60) return `${r} ${r === 1 ? 'minuto' : 'minutos'}`;
  const h = Math.floor(r / 60), mm = r % 60;
  return `${h} ${h === 1 ? 'hora' : 'horas'}${mm ? ` y ${mm} min` : ''}`;
};

/**
 * El día de hoy del pronóstico normalizado, o por qué no hay.
 * @param {object|null} agrometeo salida de normalizarAgroMeteo / fetchAgroMeteo
 * @param {number} ahoraMs
 */
export function climaDeHoy(agrometeo, ahoraMs = Date.now()) {
  const vig = vigenciaPronostico(agrometeo, ahoraMs);
  if (vig.estado === 'sin-dato') return { ok: false, motivo: 'sin-pronostico' };
  if (vig.estado !== 'fresco') return { ok: false, motivo: 'pronostico-viejo', cuandoMs: vig.cuandoMs };
  const hoy = agrometeo?.today;
  const eto = num(hoy?.eto_mm);
  if (!hoy || eto === null) return { ok: false, motivo: 'sin-eto' };
  const lluvia = num(hoy.precip_mm);
  if (lluvia === null) return { ok: false, motivo: 'sin-lluvia' };
  const i = Array.isArray(agrometeo.daily) ? agrometeo.daily.indexOf(hoy) : -1;
  const manana = i >= 0 ? agrometeo.daily[i + 1] || null : null;
  return {
    ok: true,
    fecha: hoy.date,
    eto,
    lluvia,
    prob: num(hoy.precip_prob),
    lluviaManana: num(manana?.precip_mm),
    fuente: agrometeo.source || 'Open-Meteo',
    consultado: agrometeo.fetched_at || null,
  };
}

const TEXTO_SIN_CLIMA = Object.freeze({
  'sin-pronostico': 'No tengo el pronóstico de su finca, así que hoy no le doy minutos. Abra «El tiempo» con señal y vuelva a mirar.',
  'pronostico-viejo': 'El pronóstico que tengo está viejo, así que hoy no le doy minutos. Ábralo de nuevo con señal y vuelva a mirar.',
  'sin-eto': 'El pronóstico de hoy no trae cuánta agua pide el aire (la ETo), así que no le doy minutos. Mire la tierra antes de regar.',
  'sin-lluvia': 'El pronóstico de hoy no trae la lluvia, así que no le doy minutos. Mire la tierra antes de regar.',
});

/**
 * El consejo de riego de hoy para todos los sistemas guardados.
 *
 * @param {object} [params]
 * @param {Array<{id:string, nombre:string, diseno:object}>} [params.sistemas] miGoteoService.sistemasDeGoteo
 * @param {object|null} [params.agrometeo] pronóstico normalizado
 * @param {number} [params.ahoraMs]
 * @returns {{
 *   estado:'sin-sistema'|'sin-clima'|'listo', texto:string, motivo?:string,
 *   clima?:object, sectores:Array<{id:string, nombre:string, tipo:string, texto:string, detalle:string|null, cuenta:object|null}>
 * }}
 */
export function consejoRiegoHoy({ sistemas = [], agrometeo = null, ahoraMs = Date.now() } = {}) {
  if (!Array.isArray(sistemas) || sistemas.length === 0) {
    return {
      estado: 'sin-sistema',
      texto: 'Todavía no tiene un sistema de goteo guardado. Calcúlelo en el mundo del goteo y le digo cuántos minutos regar cada día.',
      sectores: [],
    };
  }
  const clima = climaDeHoy(agrometeo, ahoraMs);
  if (!clima.ok) {
    return { estado: 'sin-clima', motivo: clima.motivo, texto: TEXTO_SIN_CLIMA[clima.motivo], sectores: [] };
  }
  const sectores = sistemas.map((s) => {
    const c = cuentaDelDia(s.diseno, { eto: clima.eto, lluvia: clima.lluvia });
    const texto = textoSector(s.nombre, c, clima);
    // Lo que la frase dice además de los minutos, para la tarjeta que ya los muestra en grande.
    const base = c && c.tipo !== 'no-riegue' ? textoSector(s.nombre, { ...c, tanque: null, tipo: 'minutos', lluviaCuenta: 0 }, clima) : null;
    const detalle = base && texto.startsWith(base) ? texto.slice(base.length).trim() || null : texto;
    return { id: s.id, nombre: s.nombre, tipo: c ? c.tipo : 'no-calcula', cuenta: c, texto, detalle };
  });
  return { estado: 'listo', clima, sectores, texto: sectores.map((x) => x.texto).join(' ') };
}

/** Lo que se le dice de un sistema. Sin em dashes (copy de la app). */
function textoSector(nombre, c, clima) {
  if (!c) return `«${nombre}»: con este diseño todavía no puedo rehacer la cuenta del día. Riegue lo que le dio el mundo y mire la tierra.`;
  const turnos = c.turnos > 1 ? ` en cada uno de sus ${c.turnos} turnos` : '';
  if (c.tipo === 'no-riegue') {
    return `«${nombre}»: hoy no riegue. El pronóstico trae ${fmt(clima.lluvia)} mm de lluvia y la mata pide ${fmt(c.etcMm)} mm. Mire la tierra mañana antes de regar.`;
  }
  const base = `«${nombre}»: riegue ${minutosTxt(c.minutos)}${turnos}.`;
  if (c.tanque?.recortado) {
    return `${base} Es lo que alcanza su tanque lleno de ${fmt(c.tanque.litros, 0)} L; hoy pediría ${fmt(c.litrosPide, 0)} L.`;
  }
  if (c.tipo === 'sin-clima') return `${base} Su cuenta sale de ${c.metodo === 'tabla' ? 'la tabla por semanas' : 'lo que usted mide'}, no del pronóstico.`;
  if (c.lluviaCuenta > 0) return `${base} Ya le descuento ${fmt(c.lluviaCuenta)} mm de la lluvia que da el pronóstico para hoy.`;
  return base;
}

/**
 * De dónde sale el número de un sistema, para mostrarlo debajo.
 * @param {object} c resultado de cuentaDelDia
 * @param {object} clima resultado ok de climaDeHoy
 */
export function deDondeSale(c, clima) {
  if (!c || c.metodo !== 'clima') return null;
  const partes = [
    `ETo de hoy ${fmt(clima.eto)} mm (Open-Meteo, FAO-56)`,
    c.bajoPlastico ? `× ${fmt(BAJO_PLASTICO)} bajo plástico` : null,
    `× Kc ${fmt(c.kc, 2)} del ${c.cultivo.toLocaleLowerCase('es-CO')}${c.etapa ? ` ${NOMBRE_ETAPA[c.etapa]}` : ''} = ${fmt(c.etcMm)} mm`,
    c.bajoPlastico ? 'la lluvia no entra al invernadero' : `menos ${fmt(c.lluviaCuenta)} mm de lluvia`,
    `÷ ${fmt(EF_GOTEO)} del goteo`,
  ].filter(Boolean);
  return `${partes.join(', ')}. La misma cuenta del mundo del goteo, con el pronóstico de hoy en vez del promedio de la altitud.`;
}

export default { consejoRiegoHoy, cuentaDelDia, climaDeHoy, deDondeSale, etoCenicafe };
