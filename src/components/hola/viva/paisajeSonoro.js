/**
 * paisajeSonoro — el aire de «Hola Chagra», sintetizado con Web Audio.
 *
 * Cero archivos de audio: cada bioma se arma con osciladores y ruido.
 *   - colmena (angelita): zumbido cálido de panal; de vez en cuando una abeja
 *     pasa de un lado al otro (evento `abeja`).
 *   - paramo (oso del bastón): viento que respira y una quebrada con gorgoteo;
 *     de vez en cuando una racha (evento `racha`).
 *   - monte (guacamaya, jaguar): monte húmedo con chicharras lejanas; de vez
 *     en cuando canta un ave que cruza (evento `ave`).
 *
 * Cada evento sale con su duración y su dirección (`desde`: -1 izquierda,
 * 1 derecha). El paneo estéreo del sonido va de `desde` a `-desde` en esa
 * misma duración, así el espejo visual (un ave que cruza, la hierba que se
 * mece) cae con el sonido: los dos salen del mismo dato.
 *
 * El motor no crea su `AudioContext` hasta `arrancar()`, que solo se llama
 * tras un gesto de la persona (ver holaViva.js).
 */

export const BIOMA_DE_COMPAI = Object.freeze({
  angelita: 'colmena',
  'oso-baston': 'paramo',
  guacamaya: 'monte',
  jaguar: 'monte',
});

export function biomaPara(compai) {
  return BIOMA_DE_COMPAI[compai] || 'colmena';
}

/** Volumen general y volumen mientras alguien habla (se agacha, no se apaga). */
export const VOLUMEN = 0.9;
export const VOLUMEN_AGACHADO = 0.25;

/** Cada cuánto llega un evento (ms, rango) y cuánto dura (s). */
const EVENTOS = {
  colmena: { tipo: 'abeja', cada: [9000, 17000], dura: 3.6 },
  paramo: { tipo: 'racha', cada: [10000, 20000], dura: 4.2 },
  monte: { tipo: 'ave', cada: [7000, 14000], dura: 3.2 },
};
const PRIMER_EVENTO_MS = 2600;

function entre(a, b) {
  return a + Math.random() * (b - a);
}

function bufferDeRuido(ctx, segundos = 2) {
  const largo = Math.floor(ctx.sampleRate * segundos);
  const buffer = ctx.createBuffer(1, largo, ctx.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < largo; i += 1) datos[i] = Math.random() * 2 - 1;
  return buffer;
}

function ruido(ctx, buffer) {
  const fuente = ctx.createBufferSource();
  fuente.buffer = buffer;
  fuente.loop = true;
  return fuente;
}

function lfo(ctx, frecuencia, profundidad, destino) {
  const osc = ctx.createOscillator();
  osc.frequency.value = frecuencia;
  const g = ctx.createGain();
  g.gain.value = profundidad;
  osc.connect(g).connect(destino);
  return osc;
}

function paneador(ctx) {
  if (typeof ctx.createStereoPanner === 'function') return ctx.createStereoPanner();
  return null;
}

/* ── Fondos: lo que suena siempre ──────────────────────────────────────── */

function fondoColmena(ctx, salida) {
  const fuentes = [];
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 820;
  filtro.Q.value = 0.8;
  const cuerpo = ctx.createGain();
  cuerpo.gain.value = 0.08;
  filtro.connect(cuerpo).connect(salida);
  // Tres alas desafinadas apenas: el batido lento es el "panal vivo".
  [196, 197.4, 293.2].forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = i === 2 ? 0.35 : 0.6;
    osc.connect(g).connect(filtro);
    fuentes.push(osc, lfo(ctx, 5.5 + i, 1.4, osc.frequency));
  });
  fuentes.push(lfo(ctx, 0.11, 0.018, cuerpo.gain));
  // Soplo de cera: ruido en banda, muy bajo.
  const soplo = ruido(ctx, bufferDeRuido(ctx));
  const banda = ctx.createBiquadFilter();
  banda.type = 'bandpass';
  banda.frequency.value = 420;
  banda.Q.value = 1.1;
  const gSoplo = ctx.createGain();
  gSoplo.gain.value = 0.02;
  soplo.connect(banda).connect(gSoplo).connect(salida);
  fuentes.push(soplo);
  return { fuentes };
}

function fondoParamo(ctx, salida, bufferRuido) {
  const fuentes = [];
  // Viento: ruido en banda ancha cuyo centro deriva lento.
  const viento = ruido(ctx, bufferRuido);
  const banda = ctx.createBiquadFilter();
  banda.type = 'bandpass';
  banda.frequency.value = 480;
  banda.Q.value = 0.7;
  const gViento = ctx.createGain();
  gViento.gain.value = 0.16;
  viento.connect(banda).connect(gViento).connect(salida);
  fuentes.push(viento, lfo(ctx, 0.05, 220, banda.frequency), lfo(ctx, 0.08, 0.05, gViento.gain));
  // Quebrada: ruido agudo y suave, a la derecha.
  const agua = ruido(ctx, bufferRuido);
  const alto = ctx.createBiquadFilter();
  alto.type = 'highpass';
  alto.frequency.value = 1300;
  const bajo = ctx.createBiquadFilter();
  bajo.type = 'lowpass';
  bajo.frequency.value = 5200;
  const gAgua = ctx.createGain();
  gAgua.gain.value = 0.035;
  const pan = paneador(ctx);
  agua.connect(alto).connect(bajo).connect(gAgua);
  if (pan) { pan.pan.value = 0.45; gAgua.connect(pan).connect(salida); } else gAgua.connect(salida);
  fuentes.push(agua);
  return { fuentes, banda, gViento, destinoAgua: pan || salida };
}

function fondoMonte(ctx, salida, bufferRuido) {
  const fuentes = [];
  const hojas = ruido(ctx, bufferRuido);
  const bajo = ctx.createBiquadFilter();
  bajo.type = 'lowpass';
  bajo.frequency.value = 650;
  const gHojas = ctx.createGain();
  gHojas.gain.value = 0.2;
  hojas.connect(bajo).connect(gHojas).connect(salida);
  fuentes.push(hojas, lfo(ctx, 0.07, 0.06, gHojas.gain));
  // Chicharra lejana: un agudo que tiembla, bajito.
  const chicharra = ctx.createOscillator();
  chicharra.frequency.value = 4300;
  const gChi = ctx.createGain();
  gChi.gain.value = 0;
  const trino = lfo(ctx, 23, 0.012, gChi.gain);
  chicharra.connect(gChi).connect(salida);
  fuentes.push(chicharra, trino, lfo(ctx, 0.03, 0.006, gChi.gain));
  return { fuentes };
}

/* ── Eventos: lo que pasa de vez en cuando ─────────────────────────────── */

function sonarAve(ctx, salida, desde, dura) {
  const t0 = ctx.currentTime + 0.05;
  const pan = paneador(ctx);
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  if (pan) {
    pan.pan.setValueAtTime(desde * 0.9, t0);
    pan.pan.linearRampToValueAtTime(-desde * 0.9, t0 + dura);
    g.connect(pan).connect(salida);
  } else g.connect(salida);
  // El canto: 2 a 3 frases de 3 a 5 notas que suben y caen.
  const base = entre(2100, 3200);
  let t = t0 + entre(0.2, 0.5);
  const frases = 2 + Math.floor(Math.random() * 2);
  for (let fr = 0; fr < frases && t < t0 + dura - 0.4; fr += 1) {
    const notas = 3 + Math.floor(Math.random() * 3);
    for (let n = 0; n < notas; n += 1) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      const largo = entre(0.07, 0.14);
      const f0 = base * entre(0.85, 1.15);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * entre(1.15, 1.45), t + largo);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + largo);
      osc.connect(env).connect(g);
      osc.start(t);
      osc.stop(t + largo + 0.02);
      t += largo + entre(0.04, 0.09);
    }
    t += entre(0.35, 0.6);
  }
  g.gain.setValueAtTime(1, t0);
}

function sonarRacha(ctx, fondo, dura) {
  const t0 = ctx.currentTime + 0.05;
  const { banda, gViento } = fondo;
  if (!banda || !gViento) return;
  gViento.gain.cancelScheduledValues(t0);
  gViento.gain.setValueAtTime(gViento.gain.value, t0);
  gViento.gain.linearRampToValueAtTime(0.34, t0 + dura * 0.45);
  gViento.gain.linearRampToValueAtTime(0.16, t0 + dura);
  banda.frequency.cancelScheduledValues(t0);
  banda.frequency.setValueAtTime(banda.frequency.value, t0);
  banda.frequency.linearRampToValueAtTime(900, t0 + dura * 0.45);
  banda.frequency.linearRampToValueAtTime(480, t0 + dura);
}

function sonarAbeja(ctx, salida, desde, dura) {
  const t0 = ctx.currentTime + 0.05;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(228, t0);
  // Se acerca (sube un poquito) y se va (baja): el paso de la abeja.
  osc.frequency.linearRampToValueAtTime(252, t0 + dura * 0.5);
  osc.frequency.linearRampToValueAtTime(214, t0 + dura);
  const vibrato = lfo(ctx, 7, 9, osc.frequency);
  const banda = ctx.createBiquadFilter();
  banda.type = 'bandpass';
  banda.frequency.value = 900;
  banda.Q.value = 1.4;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.12, t0 + dura * 0.5);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dura);
  const pan = paneador(ctx);
  osc.connect(banda).connect(env);
  if (pan) {
    pan.pan.setValueAtTime(desde, t0);
    pan.pan.linearRampToValueAtTime(-desde, t0 + dura);
    env.connect(pan).connect(salida);
  } else env.connect(salida);
  osc.start(t0);
  vibrato.start(t0);
  osc.stop(t0 + dura + 0.05);
  vibrato.stop(t0 + dura + 0.05);
}

/** Gorgoteo de la quebrada: gotas cortas que suben de tono. */
function gotas(ctx, destino, hasta) {
  let t = ctx.currentTime + 0.05;
  while (t < hasta) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const f = entre(520, 1350);
    const largo = entre(0.03, 0.07);
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 1.7, t + largo);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.022, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + largo);
    osc.connect(env).connect(destino);
    osc.start(t);
    osc.stop(t + largo + 0.01);
    t += entre(0.07, 0.42);
  }
}

/**
 * Crea el motor. No toca Web Audio hasta `arrancar()`.
 * @param {{ bioma?: string, onEvento?: ((e: {tipo: string, desde: number, dura: number, t: number}) => void) | null, Contexto?: any }} [opciones]
 */
export function crearPaisajeSonoro({ bioma = 'colmena', onEvento = null, Contexto = null } = {}) {
  let ctx = null;
  let maestro = null;
  let fondo = null;
  let temporizador = null;
  let temporizadorGotas = null;
  let agachado = false;
  let activo = false;

  function programarEvento(espera) {
    clearTimeout(temporizador);
    const regla = EVENTOS[bioma];
    temporizador = setTimeout(() => {
      if (!activo || !ctx || ctx.state !== 'running') return;
      const desde = Math.random() < 0.5 ? -1 : 1;
      const dura = regla.dura;
      if (regla.tipo === 'ave') sonarAve(ctx, maestro, desde, dura);
      else if (regla.tipo === 'racha') sonarRacha(ctx, fondo, dura);
      else sonarAbeja(ctx, maestro, desde, dura);
      const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
      try { onEvento?.({ tipo: regla.tipo, desde, dura, t }); } catch { /* el espejo no tumba el sonido */ }
      programarEvento(entre(regla.cada[0], regla.cada[1]));
    }, espera);
  }

  function programarGotas() {
    clearInterval(temporizadorGotas);
    if (bioma !== 'paramo' || !fondo?.destinoAgua) return;
    const tanda = () => {
      if (activo && ctx?.state === 'running') gotas(ctx, fondo.destinoAgua, ctx.currentTime + 1.1);
    };
    tanda();
    temporizadorGotas = setInterval(tanda, 1000);
  }

  async function arrancar() {
    if (!ctx) {
      const C = Contexto || (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
      if (!C) return false;
      ctx = new C();
      maestro = ctx.createGain();
      maestro.gain.value = 0.0001;
      maestro.connect(ctx.destination);
      const bufferRuido = bufferDeRuido(ctx);
      if (bioma === 'paramo') fondo = fondoParamo(ctx, maestro, bufferRuido);
      else if (bioma === 'monte') fondo = fondoMonte(ctx, maestro, bufferRuido);
      else fondo = fondoColmena(ctx, maestro);
      fondo.fuentes.forEach((f) => f.start());
    }
    activo = true;
    if (ctx.state !== 'running') await ctx.resume();
    const t = ctx.currentTime;
    maestro.gain.cancelScheduledValues(t);
    maestro.gain.setValueAtTime(Math.max(0.0001, maestro.gain.value), t);
    // Entra despacio, como el amanecer: 2,5 s.
    maestro.gain.linearRampToValueAtTime(agachado ? VOLUMEN_AGACHADO : VOLUMEN, t + 2.5);
    programarEvento(PRIMER_EVENTO_MS);
    programarGotas();
    return true;
  }

  async function pausar() {
    activo = false;
    clearTimeout(temporizador);
    clearInterval(temporizadorGotas);
    if (ctx && ctx.state === 'running') await ctx.suspend();
  }

  /** Mientras alguien habla (la persona o el compai) el paisaje se agacha. */
  function agachar(si) {
    agachado = Boolean(si);
    if (!ctx || !maestro || !activo) return;
    const t = ctx.currentTime;
    maestro.gain.cancelScheduledValues(t);
    maestro.gain.setValueAtTime(maestro.gain.value, t);
    maestro.gain.linearRampToValueAtTime(agachado ? VOLUMEN_AGACHADO : VOLUMEN, t + (agachado ? 0.25 : 0.9));
  }

  async function destruir() {
    activo = false;
    clearTimeout(temporizador);
    clearInterval(temporizadorGotas);
    const c = ctx;
    ctx = null;
    if (c && c.state !== 'closed') await c.close().catch(() => {});
  }

  return {
    bioma,
    arrancar,
    pausar,
    agachar,
    destruir,
    get estado() { return ctx ? ctx.state : 'sin-contexto'; },
    get agachado() { return agachado; },
    get volumen() { return maestro ? maestro.gain.value : 0; },
  };
}
