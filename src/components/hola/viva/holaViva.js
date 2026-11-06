/**
 * holaViva — el estado vivo de «Hola Chagra»: voz, nivel, latidos, paisaje.
 *
 * Un solo lugar para lo que la capa viva necesita saber y para lo que se
 * mide (el registro). Todo lo que mueve la capa sale de aquí y de un dato:
 *   - `nivel`: RMS del micrófono, con la MISMA fórmula, el mismo analizador
 *     (fftSize 256), la misma cadencia (80 ms) y el mismo umbral de habla
 *     (0,14) que `src/components/voz/useMediosVoz.js`. Sin micrófono abierto
 *     el nivel es 0.
 *   - `latido`: cada vez que el TTS arranca una frase (`onFrase` de
 *     `speakSentences`), no adivinado por el volumen.
 *   - eventos del paisaje (ave, racha, abeja): los emite el motor sonoro.
 *
 * Nada pide micrófono ni crea un `AudioContext` al abrir: el paisaje arranca
 * con el primer gesto (`instalarArranquePorGesto`) y el micrófono solo con
 * el botón «Háblele».
 */
import { crearPaisajeSonoro } from './paisajeSonoro';
import { VOZ_ERROR, VOZ_ESCUCHANDO, VOZ_HABLANDO, VOZ_PENSANDO, VOZ_REPOSO } from '../../../constants/estadosVoz';

/** Luz por estado de voz (el brief): nunca rojo de alarma. */
export const COLOR_ESTADO = Object.freeze({
  [VOZ_REPOSO]: '#f3c969',
  [VOZ_ESCUCHANDO]: '#8ccf7e',
  [VOZ_PENSANDO]: '#6b73c9',
  [VOZ_HABLANDO]: '#f4a259',
  [VOZ_ERROR]: '#c9774a',
});

export const UMBRAL_HABLA = 0.14;
/** Por debajo de esto la capa se queda quieta (ruido de fondo del micrófono). */
export const PISO_QUIETUD = 0.04;
export const SILENCIO_CIERRA_MS = 1800;
export const ESPERA_SIN_VOZ_MS = 20000;
export const LLAVE_SILENCIO = 'hola:silencio';
const MAX_REGISTRO = 4000;

/** Fórmula de `useMediosVoz.js` (líneas 128-130), tal cual. */
export function nivelDeMuestras(datos) {
  let suma = 0;
  for (let i = 0; i < datos.length; i += 1) suma += ((datos[i] - 128) / 128) ** 2;
  const energia = suma / datos.length;
  return Math.min(1, Math.sqrt(energia) * 5);
}

/** El nivel que mueve la capa: el mismo, con el ruido de fondo en cero. */
export function nivelDeCapa(nivel) {
  return nivel < PISO_QUIETUD ? 0 : nivel;
}

function ahora() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function leerSilencio() {
  try { return localStorage.getItem(LLAVE_SILENCIO) === '1'; } catch { return false; }
}

function escribirSilencio(si) {
  try {
    if (si) localStorage.setItem(LLAVE_SILENCIO, '1');
    else localStorage.removeItem(LLAVE_SILENCIO);
  } catch { /* sin almacenamiento: vale para esta visita */ }
}

function registroVacio() {
  return { nivel: [], latidos: [], llamadas: [], frases: [], eventos: [], estados: [] };
}

let estado = {
  voz: VOZ_REPOSO,
  silencio: leerSilencio(),
  sonando: false,
  microfono: false,
};
const oyentes = new Set();
const oyentesNivel = new Set();
const oyentesLatido = new Set();
const oyentesEvento = new Set();
let registro = registroVacio();
let motor = null;
let bioma = null;
let arrancado = false;
let mic = null;
let temporizadorError = null;

function anotar(lista, dato) {
  const l = registro[lista];
  l.push(dato);
  if (l.length > MAX_REGISTRO) l.shift();
}

function cambiar(parcial) {
  const antes = estado;
  estado = { ...estado, ...parcial };
  if (parcial.voz && parcial.voz !== antes.voz) anotar('estados', { t: ahora(), voz: parcial.voz });
  oyentes.forEach((fn) => fn());
  agacharSiHabla();
}

let personaHabla = false;
function agacharSiHabla() {
  motor?.agachar(personaHabla || estado.voz === VOZ_HABLANDO);
}

export function suscribir(fn) {
  oyentes.add(fn);
  return () => { oyentes.delete(fn); };
}
export function leerEstado() {
  return estado;
}
export function alNivel(fn) {
  oyentesNivel.add(fn);
  return () => { oyentesNivel.delete(fn); };
}
export function alLatido(fn) {
  oyentesLatido.add(fn);
  return () => { oyentesLatido.delete(fn); };
}
export function alEvento(fn) {
  oyentesEvento.add(fn);
  return () => { oyentesEvento.delete(fn); };
}

/** Lo medido, para el informe (el arnés lo expone en `window.__holaViva`). */
export function leerRegistro() {
  return registro;
}
export function limpiarRegistro() {
  registro = registroVacio();
}

/** La capa del latido avisa cuándo lo pintó (para medir evento → latido). */
export function anotarLatidoPintado(info) {
  anotar('latidos', { t: ahora(), indice: info.indice, tFrase: info.t });
}

function emitirNivel(nivel, crudo) {
  anotar('nivel', { t: ahora(), crudo, capa: nivel });
  oyentesNivel.forEach((fn) => fn(nivel));
}

/* ── Paisaje ──────────────────────────────────────────────────────────── */

function crearMotor() {
  const nuevo = crearPaisajeSonoro({
    bioma,
    onEvento: (e) => {
      anotar('eventos', e);
      oyentesEvento.forEach((fn) => fn(e));
    },
  });
  motor = nuevo;
  return nuevo;
}

/** La escena dice qué bioma suena detrás. */
export function usarBioma(nuevo) {
  if (nuevo === bioma) return;
  bioma = nuevo;
  if (motor) {
    const viejo = motor;
    motor = null;
    viejo.destruir();
    if (arrancado && !estado.silencio) {
      crearMotor().arrancar().then(() => agacharSiHabla());
    }
  }
}

export async function arrancarPaisaje() {
  arrancado = true;
  if (estado.silencio || !bioma) return false;
  const m = motor || crearMotor();
  const ok = await m.arrancar();
  cambiar({ sonando: ok });
  return ok;
}

export async function alternarSilencio() {
  const si = !estado.silencio;
  escribirSilencio(si);
  cambiar({ silencio: si });
  if (si) {
    await motor?.pausar();
    cambiar({ sonando: false });
  } else {
    await arrancarPaisaje();
  }
}

/** Pestaña oculta: el paisaje se pausa; al volver, sigue si no hay silencio. */
function alCambiarVisibilidad() {
  if (!motor) return;
  if (document.hidden) { motor.pausar(); cambiar({ sonando: false }); } else if (arrancado && !estado.silencio) arrancarPaisaje();
}

/**
 * El sonido arranca con el primer gesto (toque o tecla), nunca al abrir.
 * Un toque sobre el botón de silencio no cuenta como "arranque".
 */
export function instalarArranquePorGesto(documento = document) {
  let hecho = false;
  const alGesto = (ev) => {
    if (hecho) return;
    if (ev.target?.closest?.('[data-hola-silencio]')) { arrancado = true; quitar(); return; }
    hecho = true;
    quitar();
    arrancarPaisaje();
  };
  const quitar = () => {
    hecho = true;
    documento.removeEventListener('pointerdown', alGesto, true);
    documento.removeEventListener('keydown', alGesto, true);
  };
  documento.addEventListener('pointerdown', alGesto, true);
  documento.addEventListener('keydown', alGesto, true);
  documento.addEventListener('visibilitychange', alCambiarVisibilidad);
  return () => {
    quitar();
    documento.removeEventListener('visibilitychange', alCambiarVisibilidad);
  };
}

/** Al salir de «Hola Chagra»: se apaga todo lo que suena y escucha. */
export async function apagarTodo() {
  cerrarMicrofono();
  const m = motor;
  motor = null;
  arrancado = false;
  bioma = null;
  cambiar({ sonando: false });
  await m?.destruir();
}

/* ── Micrófono («Háblele») ────────────────────────────────────────────── */

export function cerrarMicrofono() {
  if (!mic) return;
  const m = mic;
  mic = null;
  cancelAnimationFrame(m.frame);
  m.stream?.getTracks().forEach((t) => t.stop());
  m.contexto?.close().catch(() => {});
  personaHabla = false;
  emitirNivel(0, 0);
  if (estado.voz === VOZ_ESCUCHANDO) cambiar({ voz: VOZ_REPOSO, microfono: false });
  else cambiar({ microfono: false });
}

function mostrarError() {
  clearTimeout(temporizadorError);
  cambiar({ voz: VOZ_ERROR });
  temporizadorError = setTimeout(() => {
    if (estado.voz === VOZ_ERROR) cambiar({ voz: VOZ_REPOSO });
  }, 5000);
}

export async function abrirMicrofono() {
  if (mic) { cerrarMicrofono(); return; }
  detenerVoz();
  const pedir = navigator.mediaDevices?.getUserMedia;
  const ContextoAudio = window.AudioContext || window.webkitAudioContext;
  if (!pedir || !ContextoAudio) { mostrarError(); return; }
  const m = { frame: 0, stream: null, contexto: null, desde: Date.now(), ultimaVoz: 0, yaHablo: false };
  mic = m;
  cambiar({ voz: VOZ_ESCUCHANDO, microfono: true });
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    if (mic !== m) { stream.getTracks().forEach((t) => t.stop()); return; }
    m.stream = stream;
    const contexto = new ContextoAudio();
    m.contexto = contexto;
    await contexto.resume();
    const analizador = contexto.createAnalyser();
    analizador.fftSize = 256;
    contexto.createMediaStreamSource(stream).connect(analizador);
    const datos = new Uint8Array(analizador.fftSize);
    let ultimo = 0;
    const medir = (tiempo) => {
      if (mic !== m) return;
      if (tiempo - ultimo >= 80) {
        analizador.getByteTimeDomainData(datos);
        const crudo = nivelDeMuestras(datos);
        const nivel = nivelDeCapa(crudo);
        const antes = personaHabla;
        if (crudo >= UMBRAL_HABLA) {
          m.yaHablo = true;
          m.ultimaVoz = Date.now();
          personaHabla = true;
        } else if (Date.now() - m.ultimaVoz >= 400) personaHabla = false;
        if (antes !== personaHabla) agacharSiHabla();
        emitirNivel(nivel, crudo);
        if (m.yaHablo && Date.now() - m.ultimaVoz >= SILENCIO_CIERRA_MS) { cerrarMicrofono(); return; }
        if (!m.yaHablo && Date.now() - m.desde >= ESPERA_SIN_VOZ_MS) { cerrarMicrofono(); return; }
        ultimo = tiempo;
      }
      m.frame = requestAnimationFrame(medir);
    };
    m.frame = requestAnimationFrame(medir);
  } catch {
    if (mic === m) {
      mic = null;
      cambiar({ microfono: false });
      mostrarError();
    }
  }
}

/* ── Voz del compai («Escuchar») ──────────────────────────────────────── */

let turnoVoz = 0;
const TOPE_AUDIO_MS = 90000;

function esperarFinDeAudio(servicio) {
  const sonando = servicio.isAudioPlaying?.() || servicio.isSpeaking?.();
  if (!sonando || typeof servicio.onSpeakingChange !== 'function') return Promise.resolve();
  return new Promise((listo) => {
    let quitar = () => {};
    const fin = () => { clearTimeout(tope); quitar(); listo(); };
    const tope = setTimeout(fin, TOPE_AUDIO_MS);
    quitar = servicio.onSpeakingChange((s) => { if (!s) fin(); });
  });
}

function detenerVoz() {
  turnoVoz += 1;
  if (estado.voz === VOZ_PENSANDO || estado.voz === VOZ_HABLANDO) cambiar({ voz: VOZ_REPOSO });
}

/**
 * Lee el texto con el TTS y late una vez por cada frase que arranca.
 * @param {string} texto
 * @param {{ tts?: { speakSentences: Function } }} [opciones] inyección para pruebas
 */
export async function decir(texto, { tts = null } = {}) {
  cerrarMicrofono();
  turnoVoz += 1;
  const turno = turnoVoz;
  anotar('llamadas', { t: ahora(), largo: texto.length });
  cambiar({ voz: VOZ_PENSANDO });
  let ok = false;
  try {
    const servicio = tts || await import('../../../services/ttsService');
    ok = await servicio.speakSentences(texto, {
      onFrase: (info) => {
        if (turno !== turnoVoz) return;
        anotar('frases', { t: info.t, indice: info.indice, total: info.total });
        if (estado.voz !== VOZ_HABLANDO) cambiar({ voz: VOZ_HABLANDO });
        oyentesLatido.forEach((fn) => fn(info));
      },
    });
    // El respaldo Web Speech puede resolver antes de terminar de sonar: el
    // estado «hablando» dura lo que dura el audio, según el propio TTS.
    if (ok) await esperarFinDeAudio(servicio);
  } catch {
    ok = false;
  }
  if (turno !== turnoVoz) return ok;
  if (ok) cambiar({ voz: VOZ_REPOSO });
  else mostrarError();
  return ok;
}

/** Solo para pruebas: vuelve al estado de recién cargado. */
export function _reiniciarParaPruebas() {
  cerrarMicrofono();
  motor = null;
  bioma = null;
  arrancado = false;
  turnoVoz += 1;
  clearTimeout(temporizadorError);
  personaHabla = false;
  estado = { voz: VOZ_REPOSO, silencio: leerSilencio(), sonando: false, microfono: false };
  registro = registroVacio();
}
