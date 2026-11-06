/**
 * guacamayaGestos — mapa portable de situaciones a estados visuales.
 *
 * Este archivo solo describe decisiones. El adaptador de conducta decide si
 * una situación ocurrió y el runtime escribe el estado en el ave.
 * Los nombres de estado son el contrato de `arte-valle/guacamaya.css`.
 *
 * @module compai/nucleo/guacamayaGestos
 */

/** Estados que el CSS de la guacamaya dibuja de verdad. */
export const GESTOS_VISIBLES = Object.freeze([
  'idle',
  'hablar',
  'senalar',
  'dispersar',
  'sana',
  'amenaza',
  'pacto',
]);

/** Narración accesible por gesto. */
export const ARIA_GUACAMAYA = Object.freeze({
  idle: 'La guacamaya descansa, respira y se acicala las plumas',
  hablar: 'La guacamaya conversa y acompaña sus palabras con el ala',
  senalar: 'La guacamaya extiende el ala para señalar algo en la chagra',
  dispersar: 'La guacamaya aletea y dispersa semillas por la chagra',
  sana: 'La guacamaya abre sus alas para celebrar una chagra sana',
  amenaza: 'La guacamaya baja las alas y advierte que hay una amenaza',
  pacto: 'La guacamaya abre sus alas e invita a sostener el pacto',
});

/*
 * Una fila por selector CSS. `ocasion` es el contrato para conducta:
 * describe el evento mínimo que justifica el estado, no una interacción
 * genérica. `peso: 0` evita que los estados conversacionales o reactivos
 * aparezcan como ruido del idle.
 */
export const REPERTORIO_GUACAMAYA = Object.freeze({
  idle: Object.freeze({
    dur: [3400, 8200], peso: 1, cooldownMs: 0,
    ocasion: 'No hay situación activa: vuelve al descanso vivo.',
  }),
  hablar: Object.freeze({
    dur: 2800, peso: 0, cooldownMs: 1200,
    ocasion: 'Hay una respuesta hablada en curso.',
  }),
  senalar: Object.freeze({
    dur: 2200, peso: 0, cooldownMs: 7000,
    ocasion: 'La guacamaya dirige la atención a un cultivo, animal o lugar concreto.',
  }),
  dispersar: Object.freeze({
    dur: 2200, peso: 0, cooldownMs: 14000,
    ocasion: 'Ocurre una acción de siembra o una lectura positiva de dispersión de semillas.',
  }),
  sana: Object.freeze({
    dur: 3400, peso: 0, cooldownMs: 18000,
    ocasion: 'Una observación confirmada muestra recuperación o buena salud del sistema.',
  }),
  amenaza: Object.freeze({
    dur: 5000, peso: 0, cooldownMs: 30000,
    ocasion: 'Una alerta confirmada requiere advertir de un riesgo concreto.',
  }),
  pacto: Object.freeze({
    dur: 3400, peso: 0, cooldownMs: 20000,
    ocasion: 'La persona confirma un acuerdo o una acción compartida.',
  }),
});

/** Alias de repertorio para callers que consumen la convención de zarigüeya. */
export const IDLE_GUACAMAYA = REPERTORIO_GUACAMAYA;

/**
 * Estado manual o proveniente de conducta → gesto visual.
 * `null` significa descanso y no fuerza un gesto reactivo.
 */
export const ESTADO_A_GESTO = Object.freeze({
  idle: 'idle',
  hablar: 'hablar',
  senalar: 'senalar',
  señalar: 'senalar',
  dispersar: 'dispersar',
  sana: 'sana',
  amenaza: 'amenaza',
  pacto: 'pacto',
  acompana: 'idle',
});

/** Alias compatible con el nombre usado por otros repertorios. */
export const ESTADO_A_MOMENTO = ESTADO_A_GESTO;

// eslint-disable-next-line chagra-i18n/no-hardcoded-spanish -- identificador técnico del contrato de conducta
const ESTADOS_HABLADOS = new Set(['respondiendo', 'speaking', 'hablar']);
const ESTADOS_SENALAR = new Set(['senala', 'señala', 'senalar']);

/**
 * Convierte señales de conducta en una ocasión concreta del repertorio.
 * Las señales extraordinarias son opt-in: un dato genérico de finca no puede
 * convertirse por accidente en alarma, celebración o pacto.
 */
export function resolverGestoGuacamaya({
  estado = null,
  respuestaEnCurso = false,
  destinoConcreto = false,
  accionSiembra = false,
  lecturaDispersionPositiva = false,
  observacionSaludConfirmada = false,
  alertaConfirmada = false,
  acuerdoConfirmado = false,
} = {}) {
  if (ESTADOS_HABLADOS.has(estado) || respuestaEnCurso) return 'hablar';
  if (ESTADOS_SENALAR.has(estado) || destinoConcreto) return 'senalar';
  if (accionSiembra || lecturaDispersionPositiva) return 'dispersar';
  if (observacionSaludConfirmada) return 'sana';
  if (alertaConfirmada) return 'amenaza';
  if (acuerdoConfirmado) return 'pacto';

  return 'idle';
}

/** Indica si el gesto todavía está protegido por su descanso. */
export function estaEnCooldown(gesto, ultimoDisparo, ahora = Date.now()) {
  const config = REPERTORIO_GUACAMAYA[gesto];
  if (!config || !Number.isFinite(ultimoDisparo)) return false;
  return ahora - ultimoDisparo < config.cooldownMs;
}

/**
 * Registra un disparo sin mutar el mapa recibido. Un gesto desconocido no se
 * registra: así el runtime nunca puede anunciar un estado que CSS no dibuja.
 */
export function registrarDisparo(cooldowns = {}, gesto, ahora = Date.now()) {
  if (!Object.hasOwn(REPERTORIO_GUACAMAYA, gesto)) return { ...cooldowns };
  return { ...cooldowns, [gesto]: ahora };
}

/** Pregunta completa para el caller: existe, y ya cumplió su descanso. */
export function puedeDisparar(gesto, cooldowns = {}, ahora = Date.now()) {
  return Object.hasOwn(REPERTORIO_GUACAMAYA, gesto)
    && !estaEnCooldown(gesto, cooldowns[gesto], ahora);
}

export default {
  ARIA_GUACAMAYA,
  GESTOS_VISIBLES,
  IDLE_GUACAMAYA,
  REPERTORIO_GUACAMAYA,
  ESTADO_A_GESTO,
  ESTADO_A_MOMENTO,
  resolverGestoGuacamaya,
  estaEnCooldown,
  registrarDisparo,
  puedeDisparar,
};
