/**
 * gestos — EL REPERTORIO OCIOSO DEL compAI. Núcleo portable.
 *
 * *"En su puesto se rasca, se pica el ojo, hace de todo. No es predecible,
 * siempre hace cosas diferentes."* — SPEC del operador.
 *
 * Vivía dentro de `visual/agente/angelitaEstados.js` (que ya era puro) y se
 * mudó al núcleo para que el compAI de la PWA y el de `3d.guatoc.co` tengan
 * EL MISMO repertorio y EL MISMO azar. `angelitaEstados.js` re-exporta desde
 * aquí — no copia. Ver `MANIFIESTO.md`.
 *
 * NUEVO 2026-07-26: **`guino`** — "picarse el ojo". El operador lo nombró por
 * su nombre en el SPEC y no estaba entre los 9 gestos. Un parpadeo es
 * biología; un guiño es complicidad, que es otra cosa.
 *
 * Y con él entran **`estira`, `bosteza`, `rascanuca`, `cabecea` y
 * `voltereta`** (merge de `arte/compai-gestos-entrada`, 2026-07-26): el
 * repertorio elegible por azar pasa de 6 a **12 momentos**, que es lo que
 * pedía el SPEC — *"no es predecible, siempre hace cosas diferentes"*. Con 6
 * gestos y anti-repetición el ciclo se leía; con 12 deja de leerse.
 *
 * NUEVO 2026-07-30 (Ola 2, batch 1, #13/#14): **`mirausted`** ("mirar al
 * usuario y volver la vista", distinto del 'mira' curioso que mira ALREDEDOR
 * sin usted de por medio) y **`cuenta`** ("contar algo con las patitas") —
 * los 2 gestos del pedido original de #13/#14 que faltaban del repertorio de
 * 12. Con ellos son **14 momentos**.
 *
 * Entran AQUÍ y no en `angelitaEstados.js` a propósito: el núcleo es la fuente
 * única, y si el repertorio se quedara en la PWA el compAI de `3d.guatoc.co`
 * heredaría otra vez un personaje más pobre — que es exactamente la divergencia
 * que este núcleo existe para cerrar.
 *
 * NUEVO 2026-09-23 (carril angelita-conductas): la copia de la PWA en
 * `angelitaEstados.js` se había quedado en 12+posa (sin `mirausted` ni
 * `cuenta`, aunque su CSS existía) y NO re-exportaba de aquí: desde hoy SÍ
 * re-exporta. Entran `saluda`, `asombro`, `circulos`, `gafas` y `ruana`, cada
 * momento declara su `intensidad` (1 suave · 2 media · 3 evidente) y los que
 * dependen del mundo declaran `requiere` ('sol'|'frio'). El ritmo lo decide
 * `elegirMomentoReposo`/`pausaDeReposo` con la inactividad medida del usuario.
 *
 * REGLA DURA: `dur` (ms) debe COINCIDIR con la duración del keyframe one-shot
 * del CSS de ese momento — el scheduler suelta el atributo exactamente cuando
 * el gesto termina en identidad, y así el empalme no salta.
 * `peso` = probabilidad relativa al elegir (0 = no se elige por azar: son los
 * momentos de secuencia — flota es el "entre-gestos"; posada/despega los
 * encadena el propio scheduler después de posa).
 *
 * @module compai/nucleo/gestos
 */

/** @typedef {{ dur: number | [number, number], peso: number, intensidad?: number, requiere?: 'sol' | 'frio' }} MomentoIdle */

/** @type {Record<string, MomentoIdle>} */
export const MOMENTOS_IDLE = {
  flota: { dur: [3200, 8600], peso: 0 },  // vuelo sereno entre gestos (dur al azar)
  mira: { dur: 2600, peso: 3, intensidad: 1 },       // mira alrededor, curiosa (ojos primero, cabeza después)
  distraida: { dur: 3600, peso: 2, intensidad: 1 },  // pasa una mota de vilano y la sigue con los ojos
  acicala: { dur: 3000, peso: 2, intensidad: 1 },    // se acicala la antena con la manita (aseo de abeja)
  rasca: { dur: 2400, peso: 1.5, intensidad: 1 },    // se rasca la barriguita, satisfecha
  sacude: { dur: 1500, peso: 1.5, intensidad: 2 },   // sacudón de alas: escalofrío alegre que la esponja
  guino: { dur: 1800, peso: 1.2, intensidad: 1 },    // se pica el ojo: complicidad, no biología (SPEC)
  estira: { dur: 2600, peso: 1.4, intensidad: 2 },   // se estira a gusto: bracitos arriba, bosteza el cuerpo
  bosteza: { dur: 3200, peso: 1.1, intensidad: 3 },  // bostezo de goma: boca enorme, manita tarde a taparla
  rascanuca: { dur: 2400, peso: 1.3, intensidad: 2 },// se rasca la nuca, medio apenada (rascarse distinto)
  cabecea: { dur: 3600, peso: 0.9, intensidad: 3 },  // se le van los ojos… zzz… y DESPIERTA de un brinco
  voltereta: { dur: 1700, peso: 0.8, intensidad: 3 },// pirueta juguetona: vuelta de campana con anticipación
  mirausted: { dur: 2600, peso: 2.2, intensidad: 1 },// voltea derecho hacia usted, sostiene, y vuelve a lo suyo
  cuenta: { dur: 3000, peso: 1.3, intensidad: 2 },   // cuenta algo con las patitas: toca uno, dos, tres…
  saluda: { dur: 2400, peso: 1.2, intensidad: 2 },   // levanta la manita y saluda: hola, sigo aquí
  asombro: { dur: 1900, peso: 0.9, intensidad: 3 },  // ¡uy!: brinco hacia atrás, ojos grandes, cejas arriba
  circulos: { dur: 3400, peso: 1, intensidad: 3 },   // dos vueltitas cortas en el aire y vuelve a su puesto
  gafas: { dur: 5200, peso: 0.9, intensidad: 2, requiere: 'sol' },   // se pone las gafas, disfruta, se las quita
  ruana: { dur: 5600, peso: 0.9, intensidad: 2, requiere: 'frio' },  // se echa la ruana encima, se arropa, se la quita
  posa: { dur: 1150, peso: 2, intensidad: 2 },       // aterriza con peso (→ posada → despega)
  posada: { dur: [3400, 5200], peso: 0 }, // descansa posada: alitas plegadas, respira hondo
  despega: { dur: 950, peso: 0 },     // se agacha, coge impulso y vuelve al aire
};

/* Los momentos elegibles por azar SIN contexto (peso > 0 y sin `requiere`),
   congelados una vez. Los de `requiere` (gafas → hay sol; ruana → hace frío o
   es de noche) solo salen por `elegirMomentoReposo`, que recibe el dato: una
   abeja que se pone la ruana a mediodía de sol está mintiendo sobre la finca. */
/** @type {string[]} */
const GESTOS_IDLE = Object.keys(MOMENTOS_IDLE)
  .filter((m) => MOMENTOS_IDLE[m].peso > 0 && !MOMENTOS_IDLE[m].requiere);

/**
 * EL AZAR DE LA CASA: elección ponderada que NUNCA repite la anterior. Es la
 * línea que separa una criatura viva de un GIF — nadie se rasca dos veces
 * seguidas. Genérica a propósito: el mismo azar sirve para los micro-gestos
 * de Angelita en la PWA y para las poses que de verdad tiene cada rig del
 * valle (el oso no tiene los mismos gestos que la abeja, pero merece la misma
 * impredecibilidad).
 *
 * @param {string[]|Record<string,{peso:number}>} candidatos - lista de
 *   nombres (peso 1 cada uno) o tabla nombre→{peso}.
 * @param {string|null} [previo] - se excluye de la tirada.
 * @param {() => number} [rand] - fuente de azar 0..1 (inyectable y testeable).
 * @returns {string|null} el elegido, o null si no había candidatos.
 */
export function elegirSinRepetir(candidatos, previo = null, rand = Math.random) {
  const esTabla = candidatos && !Array.isArray(candidatos) && typeof candidatos === 'object';
  /** @type {Record<string, {peso:number}>} */
  const tabla = esTabla ? candidatos : {};
  const candidatosNombres = esTabla ? Object.keys(tabla) : Array.isArray(candidatos) ? candidatos : [];
  const nombres = candidatosNombres.filter((n) => esTabla ? Number(tabla[n]?.peso) > 0 : true);
  const libres = nombres.filter((n) => n !== previo);
  // Con un solo candidato no hay forma de no repetir: se repite y no se miente.
  const pool = libres.length ? libres : nombres;
  if (!pool.length) return null;
  const peso = (n) => (esTabla ? Number(tabla[n].peso) : 1);
  const total = pool.reduce((s, n) => s + peso(n), 0);
  let bola = rand() * total;
  for (const n of pool) {
    bola -= peso(n);
    if (bola <= 0) return n;
  }
  return pool[pool.length - 1];
}

/**
 * Elige el próximo micro-gesto del idle de Angelita: el azar de la casa sobre
 * el repertorio ponderado de arriba.
 * @param {string|null} [previo]  el último gesto hecho (se excluye).
 * @param {() => number} [rand]  fuente de azar 0..1 (default Math.random).
 * @returns {string} nombre del momento elegido.
 */
export function elegirMomentoIdle(previo = null, rand = Math.random) {
  /** @type {Record<string, {peso:number}>} */
  const elegibles = {};
  for (const m of GESTOS_IDLE) elegibles[m] = MOMENTOS_IDLE[m];
  return elegirSinRepetir(elegibles, previo, rand);
}

/**
 * Duración en ms de un momento del idle; los rangos [min,max] salen con
 * jitter (el reloj de una criatura viva no es de cuarzo).
 * @param {string} momento
 * @param {() => number} [rand]
 * @returns {number}
 */
export function duracionDeMomento(momento, rand = Math.random) {
  const m = MOMENTOS_IDLE[momento] || MOMENTOS_IDLE.flota;
  return Array.isArray(m.dur) ? Math.round(m.dur[0] + rand() * (m.dur[1] - m.dur[0])) : m.dur;
}

/* ── EL REPOSO QUE ESCALA CON LA INACTIVIDAD (2026-09-23) ────────────────────
   La intensidad del idle la CAUSA un dato: cuánto lleva usted sin tocar la
   pantalla. Recién se queda quieto → gestos suaves y espaciados (mirar, pestañear
   de complicidad, acicalarse); si la quietud sigue → más evidentes y más
   seguidos (estirarse, saludar, dar vueltitas); con TECHO a los 3 min: de ahí en
   adelante el ritmo no sube más (nunca un bucle por reloj que se acelera sin
   fin). Cada decisión relee la inactividad: no hay un temporizador que escale
   solo — si usted vuelve, el dato vuelve a cero y ella vuelve a lo suave. */

/** Inactividad (ms) a la que el reposo toca su techo. */
export const TECHO_INACTIVIDAD_MS = 180000;

/**
 * Intervalo determinista entre excursiones, según la hora local.
 * @param {number} hora
 * @returns {number|null}
 */
export function intervaloExcursionPorHora(hora) {
  const h = ((Number(hora) % 24) + 24) % 24;
  if (h < 5.75 || h >= 19) return null;
  if (h < 8) return 170000;
  if (h < 11) return 100000;
  if (h < 14) return 45000;
  if (h < 16) return 80000;
  return 180000;
}

/**
 * Elige una excursión repetible para un bloque de reloj, sin azar.
 * @param {number} hora
 * @param {number} [bloque=0]
 * @param {{sol?:boolean,frio?:boolean}} [contexto={}]
 * @returns {string|null}
 */
export function excursionDeHorario(hora, bloque = 0, contexto = {}) {
  if (intervaloExcursionPorHora(hora) === null) return null;
  const opciones = ['circulos', 'mirausted', 'acicala', 'circulos'];
  if (contexto.sol) opciones.push('gafas');
  if (contexto.frio) opciones.push('ruana');
  return opciones[Math.abs(Math.trunc(Number(bloque) || 0)) % opciones.length];
}
/* Pausa de vuelo sereno entre gestos [min,max] en ms: al empezar y en el techo. */
const PAUSA_SUAVE = [7000, 13000];
const PAUSA_TECHO = [2200, 4200];

/**
 * El ritmo del reposo para una inactividad dada.
 * `nivel` 0..1 crece LOGARÍTMICO (el primer minuto cambia mucho, después poco)
 * y se satura en TECHO_INACTIVIDAD_MS: 10 s ≈ 0.24, 60 s ≈ 0.66, ≥3 min = 1.
 * Intensidad permitida: suave (1) hasta ~15 s, media (2) hasta ~80 s, evidente (3) después.
 * @param {number} inactivoMs  ms desde la última interacción del usuario.
 * @returns {{nivel:number, intensidadMax:1|2|3, pausa:[number,number]}}
 */
export function ritmoDeReposo(inactivoMs) {
  const s = Math.max(0, Number(inactivoMs) || 0) / 1000;
  const nivel = Math.min(1, Math.log1p(s / 10) / Math.log1p(TECHO_INACTIVIDAD_MS / 10000));
  const intensidadMax = nivel < 0.3 ? 1 : nivel < 0.75 ? 2 : 3;
  const lerp = (a, b) => Math.round(a + (b - a) * nivel);
  return {
    nivel,
    intensidadMax,
    pausa: [lerp(PAUSA_SUAVE[0], PAUSA_TECHO[0]), lerp(PAUSA_SUAVE[1], PAUSA_TECHO[1])],
  };
}

/**
 * Contexto de los gestos con requisito: ¿hay sol (gafas)? ¿hace frío o es de
 * noche (ruana)? Manda el clima real si el host lo tiene; si no, la hora local
 * del teléfono (dato real también: nadie se pone gafas de sol a medianoche).
 * @param {string|{condicion?:string,estado?:string,tipo?:string,id?:string,clima?:string,temperaturaC?:number,tempC?:number,temperatura?:number}|null|undefined} clima
 * @param {number} [hora]  0..23 (default: la hora local de ahora).
 * @returns {{sol:boolean, frio:boolean}}
 */
export function contextoDeReposo(clima, hora = new Date().getHours()) {
  if (clima) {
    const datosClima = typeof clima === 'string' ? null : clima;
    const condicion = typeof clima === 'string'
      ? clima
      : datosClima.condicion || datosClima.estado || datosClima.tipo || datosClima.id || datosClima.clima || '';
    const valor = String(condicion).toLowerCase();
    const tempC = Number(datosClima?.temperaturaC ?? datosClima?.tempC ?? datosClima?.temperatura);
    const sol = ['soleado', 'soleada', 'despejado', 'despejada', 'dorada'].includes(valor);
    return {
      sol,
      frio: !sol && (['frio', 'frío', 'noche', 'lluvia', 'niebla', 'paramo', 'páramo', 'superparamo', 'superpáramo'].includes(valor)
        || (Number.isFinite(tempC) && tempC <= 12)),
    };
  }
  const dia = hora >= 8 && hora < 17;
  const noche = hora >= 18 || hora < 6;
  return { sol: dia, frio: noche };
}

/**
 * Elige el próximo gesto del reposo según la inactividad medida.
 * Solo entran los momentos con `intensidad` ≤ la que permite la quietud; los
 * evidentes pesan más cuanto más larga la quietud; los de `requiere` solo si
 * el contexto lo sostiene. Con `algoQueDecir` pesan más los gestos que lo
 * buscan a usted (saludar, mirarlo): el cuerpo avisa, la pizarra dice.
 * @param {Object} opts
 * @param {string|null} [opts.previo]
 * @param {number} [opts.inactivoMs=0]
 * @param {{sol?:boolean, frio?:boolean}} [opts.contexto]
 * @param {boolean} [opts.algoQueDecir=false]
 * @param {() => number} [opts.rand]
 * @returns {string|null}
 */
export function elegirMomentoReposo({
  previo = null,
  inactivoMs = 0,
  contexto = {},
  algoQueDecir = false,
  rand = Math.random,
} = {}) {
  const { nivel, intensidadMax } = ritmoDeReposo(inactivoMs);
  /** @type {Record<string, {peso:number}>} */
  const tabla = {};
  for (const [nombre, m] of Object.entries(MOMENTOS_IDLE)) {
    if (!(m.peso > 0) || !m.intensidad || m.intensidad > intensidadMax) continue;
    if (m.requiere && !contexto[m.requiere]) continue;
    let peso = m.peso * (1 + nivel * (m.intensidad - 1));
    if (algoQueDecir && (nombre === 'saluda' || nombre === 'mirausted')) peso *= 3;
    tabla[nombre] = { peso };
  }
  return elegirSinRepetir(tabla, previo, rand);
}

/**
 * Pausa de vuelo sereno (ms) antes del próximo gesto, según la inactividad.
 * @param {number} inactivoMs
 * @param {() => number} [rand]
 * @returns {number}
 */
export function pausaDeReposo(inactivoMs, rand = Math.random) {
  const [min, max] = ritmoDeReposo(inactivoMs).pausa;
  return Math.round(min + rand() * (max - min));
}

export default {
  MOMENTOS_IDLE, elegirMomentoIdle, elegirSinRepetir, duracionDeMomento,
  ritmoDeReposo, contextoDeReposo, elegirMomentoReposo, pausaDeReposo, TECHO_INACTIVIDAD_MS,
};
