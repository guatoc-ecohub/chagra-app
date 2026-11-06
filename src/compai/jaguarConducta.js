/**
 * Conducta del jaguar: adapta el núcleo portable a un felino solitario,
 * nocturno y acechador.
 *
 * La fachada conecta datos de finca, clima, aprendizaje, agroecología,
 * susurro nocturno, cooldowns y entrada/salida. El slowBlink es su gesto de
 * confianza. No se usa guiño: no es un gesto propio del jaguar.
 */
import { leerCooldowns, escribirCooldowns } from './nucleo/cooldowns.js';
import { datosDeMundo } from './nucleo/datosFinca.js';
import { reaccionAlClima } from './nucleo/climaVivo.js';
import { comentarioDeMundo } from './nucleo/comentarista.js';
import { esDeNoche, susurroDeNoche } from './nucleo/susurroNocturno.js';
import { preguntaDeAprendiz } from './nucleo/modoAprendiz.js';
import { datoAgroecologicoReal } from './nucleo/agroecologia.js';
import { planEntradaDe, planSalidaDe } from './nucleo/entradaSalida.js';

export const PERFIL_CONDUCTA_JAGUAR = Object.freeze({
  especie: 'jaguar',
  nocturno: true,
  vocacion: 'solitario, nocturno y acechador',
  gestoConfianza: 'slowBlink',
});

const IMPORTANCIA = Object.freeze({ baja: 0, media: 1, alta: 2, critica: 3 });

function nivelImportancia(valor) {
  return typeof valor === 'number' ? valor : (IMPORTANCIA[valor] ?? 0);
}

/** El jaguar no llena el silencio: solo habla cuando hay algo accionable. */
export function hablaPocoJaguar({ importancia = 'baja', necesitaAviso = false } = {}) {
  return necesitaAviso || nivelImportancia(importancia) >= IMPORTANCIA.alta;
}

export function delimitarLinderosJaguar(linderos = []) {
  const puntos = Array.isArray(linderos)
    ? linderos.filter((lindero) => lindero != null && String(lindero).trim() !== '')
    : [];
  return Object.freeze({ tipo: 'linderos', puntos: Object.freeze(puntos.map(String)), cantidad: puntos.length });
}

export function alertaFaunaJaguar({ depredador = null, animalesPerdidos = [] } = {}) {
  const perdidos = Array.isArray(animalesPerdidos) ? animalesPerdidos.filter(Boolean).map(String) : [];
  if (!depredador && perdidos.length === 0) return null;
  return Object.freeze({
    tipo: depredador ? 'depredador' : 'perdida_animales',
    depredador: depredador ? String(depredador) : null,
    animalesPerdidos: Object.freeze(perdidos),
  });
}

export function leerRastrosJaguar(rastros = []) {
  const registros = Array.isArray(rastros) ? rastros.filter(Boolean) : [];
  return Object.freeze(registros.map((rastro) => typeof rastro === 'string'
    ? Object.freeze({ tipo: 'huella', descripcion: rastro })
    : Object.freeze({ ...rastro, tipo: rastro.tipo || 'huella' })));
}

/** Un riesgo grave produce un único rugido hasta que el host confirme otro ciclo. */
export function rugidoDeRiesgoJaguar({ helada = false, plagaFuerte = false, riesgoGrave = false, yaRugio = false } = {}) {
  if (yaRugio || !(riesgoGrave || helada || plagaFuerte)) return null;
  return Object.freeze({ tipo: 'rugido', causa: helada ? 'helada' : plagaFuerte ? 'plaga_fuerte' : 'riesgo_grave' });
}

export function avisoDelMonteJaguar(monte = null) {
  if (!monte) return null;
  if (typeof monte === 'string') return Object.freeze({ tipo: 'monte', senal: monte });
  return Object.freeze({ tipo: 'monte', ...monte });
}

/** Copy propio de especie para la misma situación que comenta Angelita. */
const COMENTARIOS_JAGUAR = Object.freeze({
  mis_matas: ({ cultivos }) => {
    const primero = cultivos?.[0];
    return primero
      ? `Paso sin ruido junto a sus ${primero.name.toLowerCase()}; miro el rastro y dejo que la mata hable.`
      : 'Cruzo la orilla sin ruido. Cuando registre sus matas, leo el rastro sin pisarlas.';
  },
  mis_animales: ({ especies }) => {
    const primero = especies?.[0];
    return primero
      ? `Ya encontré el rastro de ${primero.name.toLowerCase()}. Me quedo lejos, porque una finca tranquila se cuida sin espantarla.`
      : 'Me muevo por la sombra y observo desde lejos. Cuando registre sus animales, le ayudo a leer sus rastros.';
  },
  clima: () => 'La noche cambia primero en el monte. Le marco el riesgo que trae el clima y vuelvo a la sombra.',
  finca: () => 'Recorro la finca por los bordes y guardo silencio. Dígame dónde mirar y sigo el rastro.',
  bosque: () => 'Entre el monte, cada sonido deja una señal. Camino despacio para no romper esa lectura.',
  paramo: () => 'El páramo es nacimiento de agua. Lo miro con respeto y no confundo acecho con apuro.',
  vender: ({ cultivos }) => {
    const primero = cultivos?.[0];
    return primero
      ? `Ya ubiqué sus ${primero.name.toLowerCase()}. Para venderlos, revisamos el rastro de las cuentas sin hacer ruido.`
      : 'Cuando haya algo registrado para vender, revisamos sus cuentas con calma y sin inventar cifras.';
  },
  aprender: () => 'Pregunte. Escucho desde la sombra y le respondo sólo con lo que podamos sostener.',
});

export function comentarioDeMundoJaguar(mundo, inventario, extra = {}, perfil = {}) {
  const datos = datosDeMundo(mundo, inventario, extra);
  const propio = COMENTARIOS_JAGUAR[mundo];
  return propio
    ? propio(datos)
    : comentarioDeMundo(mundo, datos, { ...perfil, especie: PERFIL_CONDUCTA_JAGUAR.especie });
}

function resolverGestoJaguar({
  estado = null,
  respuestaEnCurso = false,
  alertaConfirmada = false,
  acuerdoConfirmado = false,
} = {}) {
  if (alertaConfirmada || estado === 'preocupada') return 'acecha';
  if (acuerdoConfirmado) return 'slowBlink';
  // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish
  if (respuestaEnCurso || estado === 'respondiendo') return 'hablar';
  return 'idle';
}

function puedeDispararGesto(gesto, cooldowns, ahoraMs) {
  if (gesto === 'idle') return true;
  const ultimo = Number(cooldowns?.[`gesto:${gesto}`]);
  return !Number.isFinite(ultimo) || ahoraMs - ultimo >= 4000;
}

function registrarGesto(cooldowns, gesto, ahoraMs) {
  return { ...cooldowns, [`gesto:${gesto}`]: ahoraMs };
}

/**
 * Devuelve una intervención del jaguar con datos locales reales.
 * El fallback compartido conserva el grounding para mundos futuros.
 */
export function conductaJaguar({
  activo = true,
  mundo = null,
  inventario = null,
  extra = {},
  perfil = {},
  forecast7d = [],
  fase = null,
  ahora = new Date(),
  rand = Math.random,
  storage = undefined,
  especieCatalogo = null,
  nombreCultivo = '',
  estado = null,
  respuestaEnCurso = false,
  alertaConfirmada = false,
  acuerdoConfirmado = false,
  importancia = 'baja',
  necesitaAviso = false,
  linderos = [],
  depredador = null,
  animalesPerdidos = [],
  rastros = [],
  helada = false,
  plagaFuerte = false,
  riesgoGrave = false,
  yaRugio = false,
  monte = null,
} = {}) {
  if (!activo) return null;

  const reaccionClima = reaccionAlClima({ forecast7d });
  const datosMundo = mundo ? datosDeMundo(mundo, inventario, extra) : {};
  const comentario = mundo ? comentarioDeMundoJaguar(mundo, inventario, extra, perfil) : null;
  const pregunta = preguntaDeAprendiz({ mundo, datosMundo, rand });
  const deNoche = esDeNoche(ahora);
  const susurro = deNoche ? susurroDeNoche({ fase, reaccionClima }) : null;
  const cooldowns = storage ? leerCooldowns(storage) : {};
  const ahoraMs = ahora instanceof Date ? ahora.getTime() : Number(ahora);
  const gestoSolicitado = resolverGestoJaguar({
    estado,
    respuestaEnCurso,
    alertaConfirmada,
    acuerdoConfirmado,
  });
  const gestoPuedeDisparar = puedeDispararGesto(gestoSolicitado, cooldowns, ahoraMs);
  const gesto = gestoPuedeDisparar ? gestoSolicitado : 'idle';
  const cooldownsActualizados = gesto !== 'idle'
    ? registrarGesto(cooldowns, gesto, ahoraMs)
    : cooldowns;
  if (storage && gesto !== 'idle') escribirCooldowns(cooldownsActualizados, storage);

  const alertaFauna = alertaFaunaJaguar({ depredador, animalesPerdidos });
  const rugido = rugidoDeRiesgoJaguar({ helada, plagaFuerte, riesgoGrave, yaRugio });

  return Object.freeze({
    especie: PERFIL_CONDUCTA_JAGUAR.especie,
    comentario,
    datosMundo,
    reaccionClima,
    pregunta,
    susurro,
    agro: nombreCultivo ? datoAgroecologicoReal(nombreCultivo, especieCatalogo) : null,
    nocturno: deNoche,
    cooldowns: cooldownsActualizados,
    gesto,
    gestoSolicitado,
    gestoBloqueado: !gestoPuedeDisparar,
    hablaPoco: hablaPocoJaguar({ importancia, necesitaAviso }),
    linderos: delimitarLinderosJaguar(linderos),
    alertaFauna,
    rastros: leerRastrosJaguar(rastros),
    rugido,
    avisoMonte: avisoDelMonteJaguar(monte),
    entrada: planEntradaDe('jaguar'),
    salida: planSalidaDe('jaguar'),
    vozEntrada: 'Llego desde la sombra. Me quedo quieto un momento y miro antes de acercarme.',
    vozSalida: 'Vuelvo al monte. Si hace falta, regreso cuando la finca esté en silencio.',
  });
}

export const conductaCooldowns = Object.freeze({ leer: leerCooldowns, escribir: escribirCooldowns });

export default {
  conductaJaguar,
  comentarioDeMundoJaguar,
  conductaCooldowns,
  PERFIL_CONDUCTA_JAGUAR,
};
