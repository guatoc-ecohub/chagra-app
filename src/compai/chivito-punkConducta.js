/**
 * Conducta del chivito-punk: adapta el núcleo portable a un animal terco,
 * saltarín y de monte.
 *
 * El punk es una alerta visible, no una anatomía permanente: la fachada lo
 * enciende únicamente mientras habla o señala un riesgo.
 */
import { leerCooldowns, escribirCooldowns } from './nucleo/cooldowns.js';
import { datosDeMundo } from './nucleo/datosFinca.js';
import { reaccionAlClima } from './nucleo/climaVivo.js';
import { comentarioDeMundo } from './nucleo/comentarista.js';
import { esDeNoche, susurroDeNoche } from './nucleo/susurroNocturno.js';
import { preguntaDeAprendiz } from './nucleo/modoAprendiz.js';
import { datoAgroecologicoReal } from './nucleo/agroecologia.js';
import { planEntradaDe, planSalidaDe } from './nucleo/entradaSalida.js';

export const PERFIL_CONDUCTA_CHIVITO_PUNK = Object.freeze({
  especie: 'chivito-punk',
  medio: 'monte',
  vocacion: 'terco, saltarín y atento al terreno',
});

/** Copy propio de especie para situaciones que también comenta Angelita. */
const COMENTARIOS_CHIVITO = Object.freeze({
  mis_matas: ({ cultivos }) => {
    const primero = cultivos?.[0];
    return primero
      ? `Voy saltando junto a sus ${primero.name.toLowerCase()}, pero no piso la mata. Terco sí, descuidado no.`
      : 'Me quedo en la loma y miro el terreno antes de saltar. Cuando registre sus matas, las recorremos con cuidado.';
  },
  mis_animales: ({ especies }) => {
    const primero = especies?.[0];
    return primero
      ? `Ya vi ${primero.name.toLowerCase()} desde la loma. Yo cuido mi paso y dejo que cada cual tenga su espacio.`
      : 'Desde la loma alcanzo a ver el movimiento. Cuando registre sus animales, revisamos por dónde pasan sin revolverlos.';
  },
  clima: () => 'Si el frío aprieta, busco reparo entre el monte. Antes de brincar, revisemos que la finca tenga dónde escampar.',
  paramo: () => 'El páramo no es pista de saltos: allí el agua nace y el suelo se pisa con respeto. Yo miro por dónde paso.',
  finca: () => 'Yo recorro la finca a mi manera: salto la zanja, paro en la loma y vuelvo a mirar el suelo.',
});

const PREGUNTAS_CHIVITO = Object.freeze({
  mis_matas: '¿Qué parte del terreno le parece firme para pasar sin maltratar las matas?',
  mis_animales: '¿Por dónde se mueven sus animales cuando cambia el tiempo: hacia la loma o hacia el reparo?',
  bosque: '¿Qué rastro le muestra por dónde conviene pasar sin abrirle camino al monte?',
  paramo: '¿Dónde ve que el agua empieza a juntarse, antes de bajar hacia la finca?',
});

export function alertaSuelo(huellas = []) {
  return huellas
    .filter((huella) => Number(huella?.pisadas) > Number(huella?.capacidad)
      || huella?.compactacion === true)
    .map((huella) => Object.freeze({
      tipo: 'suelo-pisado-de-mas',
      loteId: huella.loteId || null,
      lote: huella.nombre || huella.lote || null,
      mensaje: `Este suelo ya recibe más paso del que aguanta${huella.nombre ? ` en ${huella.nombre}` : ''}. Conviene cambiar la ruta y dejarlo recuperar.`,
    }));
}

export function sugerirRotacionEntreLotes(lotes = []) {
  const candidatos = lotes.filter((lote) => lote?.id && lote?.cultivo);
  if (candidatos.length < 2) return null;
  const [primero, segundo] = candidatos;
  if (primero.cultivo === segundo.cultivo) return null;
  return Object.freeze({
    tipo: 'rotacion-lotes',
    desdeLoteId: primero.id,
    haciaLoteId: segundo.id,
    mensaje: `Salto de ${primero.nombre || primero.id} a ${segundo.nombre || segundo.id}: alternar ${primero.cultivo} con ${segundo.cultivo} ayuda a no cansar el mismo suelo.`,
  });
}

export function protegerBorrado(intencionBorrado) {
  if (!intencionBorrado?.solicitado || !intencionBorrado?.importante) return null;
  return Object.freeze({
    tipo: 'borrado-importante',
    bloqueado: true,
    recursoId: intencionBorrado.recursoId || null,
    mensaje: `Me planto: no borremos ${intencionBorrado.nombre || 'este registro importante'} sin confirmar qué historia de la finca se pierde.`,
  });
}

export function probarLoma(prueba) {
  if (!prueba?.capacidad || prueba.carga == null) return null;
  const aguanta = Number(prueba.carga) <= Number(prueba.capacidad);
  return Object.freeze({
    tipo: 'prueba-loma',
    aguanta,
    loma: prueba.nombre || null,
    carga: Number(prueba.carga),
    capacidad: Number(prueba.capacidad),
    mensaje: aguanta
      ? `La loma ${prueba.nombre || 'probada'} aguanta este paso: ${prueba.carga} de carga sobre ${prueba.capacidad}.`
      : `La loma ${prueba.nombre || 'probada'} no aguanta este paso: ${prueba.carga} de carga sobre ${prueba.capacidad}. Busquemos otro terreno.`,
  });
}

export function alertaSobrepastoreo(pastoreo) {
  if (!pastoreo || pastoreo.carga == null || pastoreo.capacidad == null) return null;
  const excede = Number(pastoreo.carga) > Number(pastoreo.capacidad);
  return excede
    ? Object.freeze({
      tipo: 'sobrepastoreo',
      excede: true,
      carga: Number(pastoreo.carga),
      capacidad: Number(pastoreo.capacidad),
      mensaje: `Hay más carga de la que este potrero puede sostener: ${pastoreo.carga} sobre ${pastoreo.capacidad}. Dejemos descansar el pasto.`,
    })
    : null;
}

function comentarioDeMundoChivito(mundo, inventario, extra = {}, perfil = {}) {
  const datos = datosDeMundo(mundo, inventario, extra);
  const propio = COMENTARIOS_CHIVITO[mundo];
  return propio
    ? propio(datos)
    : comentarioDeMundo(mundo, datos, { ...perfil, especie: PERFIL_CONDUCTA_CHIVITO_PUNK.especie });
}

export { comentarioDeMundoChivito };

export function conductaChivitoPunk({
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
  actuando = false,
  respuestaEnCurso = false,
  huellas = [],
  lotes = [],
  intencionBorrado = null,
  pruebaLoma = null,
  pastoreo = null,
} = {}) {
  if (!activo) return null;

  const reaccionClima = reaccionAlClima({ forecast7d });
  const datosMundo = mundo ? datosDeMundo(mundo, inventario, extra) : {};
  const comentario = mundo ? comentarioDeMundoChivito(mundo, inventario, extra, perfil) : null;
  const preguntaBase = preguntaDeAprendiz({ mundo, datosMundo, rand });
  const pregunta = preguntaBase ? (PREGUNTAS_CHIVITO[mundo] || preguntaBase) : null;
  const deNoche = esDeNoche(ahora);
  const susurro = deNoche ? susurroDeNoche({ fase, reaccionClima }) : null;
  const cooldowns = storage ? leerCooldowns(storage) : null;
  const agro = nombreCultivo ? datoAgroecologicoReal(nombreCultivo, especieCatalogo) : null;
  const habla = Boolean(respuestaEnCurso || comentario || pregunta || reaccionClima);
  const alertasSuelo = alertaSuelo(huellas);
  const borradoProtegido = protegerBorrado(intencionBorrado);
  const loma = probarLoma(pruebaLoma);
  const sobrepastoreo = alertaSobrepastoreo(pastoreo);
  const rotacion = sugerirRotacionEntreLotes(lotes);
  const alertas = Object.freeze([
    ...alertasSuelo,
    ...(borradoProtegido ? [borradoProtegido] : []),
    ...(loma && !loma.aguanta ? [loma] : []),
    ...(sobrepastoreo ? [sobrepastoreo] : []),
  ]);
  const punkActivo = Boolean(habla || alertas.length);
  const ahoraMs = ahora instanceof Date ? ahora.getTime() : Number(ahora);

  const cooldownsActualizados = storage && punkActivo
    ? escribirCooldowns({ ...cooldowns, 'chivito-punk:accion': ahoraMs }, storage)
    : cooldowns;

  return Object.freeze({
    especie: PERFIL_CONDUCTA_CHIVITO_PUNK.especie,
    comentario,
    datosMundo,
    reaccionClima,
    pregunta,
    susurro,
    agro,
    cooldowns: cooldownsActualizados,
    habla,
    actuando: Boolean(actuando),
    punkActivo,
    crestaPermanente: false,
    alertas,
    rotacion,
    borradoProtegido,
    loma,
    sobrepastoreo,
    entrada: planEntradaDe('chivito-punk'),
    salida: planSalidaDe('chivito-punk'),
    vozEntrada: 'Llego de un salto, miro dónde piso y me quedo cerca del monte.',
    vozSalida: 'Me vuelvo a la loma. Cuide el paso y nos vemos en el próximo recorrido.',
  });
}

export const conductaCooldowns = Object.freeze({ leer: leerCooldowns, escribir: escribirCooldowns });

export default {
  conductaChivitoPunk,
  comentarioDeMundoChivito,
  conductaCooldowns,
  PERFIL_CONDUCTA_CHIVITO_PUNK,
  alertaSuelo,
  sugerirRotacionEntreLotes,
  protegerBorrado,
  probarLoma,
  alertaSobrepastoreo,
};
