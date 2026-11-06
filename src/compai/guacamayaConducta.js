/**
 * Conducta de la guacamaya: adapta los lógicos portables a un ave grande,
 * gregaria y parlanchina que mira la finca desde arriba.
 *
 * Esta fachada conecta únicamente los cuatro lógicos base de la conducta.
 * El cuerpo y sus animaciones viven en el componente visual, no aquí.
 */
import { leerCooldowns, escribirCooldowns } from './nucleo/cooldowns.js';
import { datosDeMundo } from './nucleo/datosFinca.js';
import { reaccionAlClima } from './nucleo/climaVivo.js';
import { comentarioDeMundo } from './nucleo/comentarista.js';
import { esDeNoche, susurroDeNoche } from './nucleo/susurroNocturno.js';
import { preguntaDeAprendiz } from './nucleo/modoAprendiz.js';
import { datoAgroecologicoReal } from './nucleo/agroecologia.js';
import { planEntradaDe, planSalidaDe } from './nucleo/entradaSalida.js';
import {
  puedeDisparar,
  registrarDisparo,
  resolverGestoGuacamaya,
} from './nucleo/guacamayaGestos.js';

export const PERFIL_CONDUCTA_GUACAMAYA = Object.freeze({
  especie: 'guacamaya',
  medio: 'aire',
  vocacion: 'ave grande, gregaria y parlanchina',
});

/**
 * Contrato de los comportamientos que solo puede aportar esta ave. Los
 * nombres son estables para que la UI pueda consumir decisiones sin depender
 * de una frase concreta.
 */
export const UNICOS_GUACAMAYA = Object.freeze({
  resumenFinca: 'resumen-finca-de-un-vistazo',
  lotePendiente: 'lote-con-mas-tiempo-sin-visitar',
  confirmacion: 'repetir-para-confirmar',
  plagaVecina: 'plaga-compartida-entre-lotes-vecinos',
  frutoMaduro: 'fruto-maduro-visible-desde-el-aire',
  llamadaBandada: 'llamada-en-bandada-a-vecino',
  corredorBosque: 'corredor-entre-parches-de-bosque',
});

const textoDe = (valor) => (typeof valor === 'string' ? valor.trim() : '');

function fechaDeVisita(lote) {
  const valor = lote?.ultimaVisitaAt
    ?? lote?.ultimaVisita
    ?? lote?.lastVisitedAt
    ?? lote?.fechaUltimaVisita;
  if (valor == null || valor === '') return null;
  const numero = Number(valor);
  if (Number.isFinite(numero)) return numero < 1e12 ? numero * 1000 : numero;
  const fecha = Date.parse(valor);
  return Number.isFinite(fecha) ? fecha : null;
}

/** Resume únicamente lo que el inventario o el contexto realmente entregan. */
export function resumirFincaGuacamaya(inventario = {}, contexto = {}) {
  const fuente = inventario || {};
  const cultivos = Array.isArray(fuente.cultivos) ? fuente.cultivos : [];
  const animales = Array.isArray(fuente.especies) ? fuente.especies : [];
  const lotes = Array.isArray(contexto.lotes) ? contexto.lotes : [];
  if (!cultivos.length && !animales.length && !lotes.length && !Number.isFinite(fuente.total)) return null;
  const totalCultivos = cultivos.reduce((total, item) => total + (Number(item.count) || 0), 0);
  const totalAnimales = Number(fuente.total) || animales.reduce((total, item) => total + (Number(item.count) || 0), 0);
  return Object.freeze({
    id: UNICOS_GUACAMAYA.resumenFinca,
    cultivos: cultivos.map((item) => item.name),
    animales: animales.map((item) => item.name),
    totalCultivos,
    totalAnimales,
    lotes: lotes.length,
    mensaje: `En una sola mirada cuento ${totalCultivos} matas, ${totalAnimales} animales y ${lotes.length} lotes registrados.`,
  });
}

/** Encuentra el lote sin visita más antigua, sin convertir ausencia en fecha inventada. */
export function loteConMasTiempoSinVisitar(lotes = [], ahora = Date.now()) {
  if (!Array.isArray(lotes) || !lotes.length) return null;
  const candidatos = lotes.map((lote, indice) => ({ lote, indice, fecha: fechaDeVisita(lote) }));
  candidatos.sort((a, b) => {
    if (a.fecha == null && b.fecha == null) return a.indice - b.indice;
    if (a.fecha == null) return -1;
    if (b.fecha == null) return 1;
    return a.fecha - b.fecha;
  });
  const elegido = candidatos[0];
  const nombre = textoDe(elegido.lote.nombre || elegido.lote.name || elegido.lote.id) || `lote ${elegido.indice + 1}`;
  const dias = elegido.fecha == null ? null : Math.max(0, Math.floor((Number(ahora) - elegido.fecha) / 86400000));
  return Object.freeze({
    id: UNICOS_GUACAMAYA.lotePendiente,
    lote: nombre,
    ultimaVisitaAt: elegido.fecha,
    diasSinVisita: dias,
    mensaje: elegido.fecha == null
      ? `${nombre} no tiene una visita registrada; conviene revisarlo primero.`
      : `${nombre} lleva ${dias} días sin visita registrada.`,
  });
}

/** Repite las palabras recibidas, sin exigir una cadena fija en los tests. */
export function repetirParaConfirmarGuacamaya(usuarioDijo) {
  const original = textoDe(usuarioDijo);
  if (!original) return null;
  return Object.freeze({
    id: UNICOS_GUACAMAYA.confirmacion,
    original,
    confirmacion: `Entendí: “${original}”. ¿Es eso lo que quiere que tengamos en cuenta?`,
  });
}

function nombrePlaga(lote) {
  return textoDe(lote?.plaga || lote?.plagas?.[0] || lote?.problema);
}

/** Detecta una plaga repetida solo entre lotes marcados como vecinos. */
export function detectarPlagaVecina(lotes = []) {
  if (!Array.isArray(lotes)) return null;
  const grupos = new Map();
  for (const lote of lotes) {
    const plaga = nombrePlaga(lote);
    const vecinos = lote?.vecinos ?? lote?.lotesVecinos ?? lote?.colindantes;
    if (!plaga || !Array.isArray(vecinos) || !vecinos.length) continue;
    const llave = plaga.toLowerCase();
    const entrada = grupos.get(llave) || { plaga, lotes: [] };
    entrada.lotes.push(textoDe(lote.nombre || lote.name || lote.id));
    grupos.set(llave, entrada);
  }
  const hallazgo = [...grupos.values()].find((grupo) => grupo.lotes.length >= 2);
  return hallazgo ? Object.freeze({ id: UNICOS_GUACAMAYA.plagaVecina, ...hallazgo }) : null;
}

/** Señala el primer árbol que trae ambas evidencias: fruto maduro y visibilidad aérea. */
export function arbolConFrutoMaduroVisible(arboles = []) {
  if (!Array.isArray(arboles)) return null;
  const arbol = arboles.find((item) => (
    (item?.frutoMaduro === true || item?.fruto === 'maduro' || item?.madurez === 'maduro')
    && (item?.visibleDesdeArriba === true || item?.visibleDesdeElAire === true || item?.vistaAerea === true)
  ));
  if (!arbol) return null;
  return Object.freeze({
    id: UNICOS_GUACAMAYA.frutoMaduro,
    arbol: textoDe(arbol.nombre || arbol.name || arbol.id) || 'árbol sin nombre',
    mensaje: `El árbol ${textoDe(arbol.nombre || arbol.name || arbol.id) || 'sin nombre'} ya tiene fruto maduro y se distingue desde el aire.`,
  });
}

/** Propone aviso vecinal como llamada colectiva, no como una orden individual. */
export function llamarEnBandada(vecino) {
  const nombre = textoDe(typeof vecino === 'object' ? (vecino.nombre || vecino.name || vecino.id) : vecino);
  if (!nombre) return null;
  return Object.freeze({
    id: UNICOS_GUACAMAYA.llamadaBandada,
    vecino: nombre,
    mensaje: `Los de la bandada vemos algo que conviene compartir con ${nombre}. ¿Le avisamos al vecino?`,
  });
}

/** Devuelve corredores ya declarados entre parches, sin dibujar relaciones nuevas. */
export function marcarCorredoresBosque(parchesBosque = [], corredores = []) {
  const declarados = Array.isArray(corredores) ? corredores : [];
  const derivados = Array.isArray(parchesBosque)
    ? parchesBosque.flatMap((parche) => (Array.isArray(parche?.corredores) ? parche.corredores : []))
    : [];
  const todos = [...declarados, ...derivados].filter(Boolean);
  if (!todos.length) return null;
  return Object.freeze({ id: UNICOS_GUACAMAYA.corredorBosque, corredores: todos });
}

function comportamientosUnicosGuacamaya({ inventario, contexto, ahora }) {
  const resumen = resumirFincaGuacamaya(inventario, contexto);
  const lotePendiente = loteConMasTiempoSinVisitar(contexto.lotes, ahora);
  const confirmacion = repetirParaConfirmarGuacamaya(contexto.usuarioDijo);
  const plagaVecina = detectarPlagaVecina(contexto.lotes);
  const frutoMaduro = arbolConFrutoMaduroVisible(contexto.arboles);
  const llamadaBandada = llamarEnBandada(contexto.vecino || contexto.vecina);
  const corredorBosque = marcarCorredoresBosque(contexto.parchesBosque, contexto.corredores);
  return Object.freeze({ resumen, lotePendiente, confirmacion, plagaVecina, frutoMaduro, llamadaBandada, corredorBosque });
}

/** Copy propio de especie para la misma situación que comenta Angelita. */
const COMENTARIOS_GUACAMAYA = Object.freeze({
  mis_matas: ({ cultivos }) => {
    const primero = cultivos?.[0];
    return primero
      ? `Desde arriba, a vuelo de guacamaya, veo sus ${primero.name.toLowerCase()} y la finca entera. ¡Oiga, ${primero.name.toLowerCase()}!`
      : 'Tengo la finca completa bajo el ala. Cuando registre sus matas, las sobrevuelo con usted.';
  },
  mis_animales: ({ especies }) => {
    const primero = especies?.[0];
    return primero
      ? `Ya vi ${primero.name.toLowerCase()} desde el aire. Somos varios mirando la finca, ¿los revisamos juntos?`
      : 'La finca completa se me abre bajo el vuelo. Cuando registre sus animales, los distinguimos sin bajar a estorbar.';
  },
  clima: () => 'Con el cielo bajo mis alas alcanzo a leer cómo cambia. Si me oye repetirlo, es porque el aviso importa.',
  finca: () => 'La finca entera cabe en mi mirada. Le cuento lo que alcanzo a mirar y usted me cuenta lo que oye abajo.',
  bosque: () => 'Las copas dibujan el bosque allá abajo: claros y corredores. Volamos juntos por esa lectura.',
  paramo: () => 'El páramo guarda el agua que baja a la finca y yo lo alcanzo a ver en el vuelo. Ese paisaje merece voz baja.',
  vender: ({ cultivos }) => {
    const primero = cultivos?.[0];
    return primero
      ? `A vuelo tendido ubico sus ${primero.name.toLowerCase()}. Para venderlos, bajamos la mirada a las cuentas sin perder la vista del conjunto.`
      : 'Puedo sobrevolar la finca con usted cuando haya algo registrado para pensar su venta.';
  },
  aprender: () => 'Dígame algo y lo repito con usted hasta entenderlo. Yo escucho mucho desde mi percha.',
});

const PREGUNTAS_GUACAMAYA = Object.freeze({
  mis_matas: '¿Qué están guardando los árboles allá abajo: fruto blando o semilla dura? Yo veo el conjunto desde arriba; usted conoce el detalle.',
  mis_animales: '¿Qué alcanza a distinguir allá abajo cuando sus animales se juntan: buscan sombra, agua o compañía?',
  bosque: '¿Qué copa reconoce primero bajo mi vuelo, y qué animal cree que se mueve debajo?',
  paramo: 'Veo el agua bajar del páramo: ¿qué parte alcanza a reconocer usted desde la finca?',
});

function susurroGuacamaya({ fase = null, reaccionClima = null, base = null } = {}) {
  if (!base) return null;
  const nombreFase = typeof fase?.name === 'string' ? fase.name.toLowerCase() : null;
  const partes = [];
  if (nombreFase) partes.push(`Esta noche hay ${nombreFase}; desde mi percha alta veo la finca entera`);
  if (reaccionClima?.tipo) partes.push('los míos, el cielo cambió allá arriba');
  if (partes.length === 0) partes.push('La finca queda en silencio y yo vigilo desde la percha');
  return { mensaje: `${partes.join('. ')}. Si me oyen repetir algo, es porque el monte me lo contó primero.`, gesto: 'susurra' };
}

function agroecologiaGuacamaya(nombreCultivo, especieCatalogo) {
  const dato = datoAgroecologicoReal(nombreCultivo, especieCatalogo);
  return dato ? `En el dosel noto que ${dato}. Usted conoce el detalle del suelo; yo alcanzo a ver el conjunto.` : null;
}

/**
 * Devuelve una intervención de la guacamaya con datos locales reales.
 * El comentarista compartido queda como fallback para mundos futuros, pero
 * recibe el perfil de la especie para conservar la fachada portable.
 */
export function comentarioDeMundoGuacamaya(mundo, inventario, extra = {}, perfil = {}) {
  const datos = datosDeMundo(mundo, inventario, extra);
  const propio = COMENTARIOS_GUACAMAYA[mundo];
  return propio
    ? propio(datos)
    : comentarioDeMundo(mundo, datos, { ...perfil, especie: PERFIL_CONDUCTA_GUACAMAYA.especie });
}

export function conductaGuacamaya({
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
  destinoConcreto = false,
  accionSiembra = false,
  lecturaDispersionPositiva = false,
  observacionSaludConfirmada = false,
  alertaConfirmada = false,
  acuerdoConfirmado = false,
  resumenFinca = null,
  lotes = [],
  usuarioDijo = '',
  arboles = [],
  vecino = null,
  vecina = null,
  parchesBosque = [],
  corredores = [],
} = {}) {
  if (!activo) return null;

  const reaccionClima = reaccionAlClima({ forecast7d });
  const comentario = mundo ? comentarioDeMundoGuacamaya(mundo, inventario, extra, perfil) : null;
  const datosMundo = mundo ? datosDeMundo(mundo, inventario, extra) : {};
  const preguntaBase = preguntaDeAprendiz({ mundo, datosMundo, rand });
  const pregunta = preguntaBase ? (PREGUNTAS_GUACAMAYA[mundo] || preguntaBase) : null;
  const deNoche = esDeNoche(ahora);
  const susurroBase = deNoche ? susurroDeNoche({ fase, reaccionClima }) : null;
  const susurro = susurroGuacamaya({ fase, reaccionClima, base: susurroBase });
  const cooldowns = storage ? leerCooldowns(storage) : null;
  const ahoraMs = ahora instanceof Date ? ahora.getTime() : Number(ahora);
  const gestoSolicitado = resolverGestoGuacamaya({
    estado,
    respuestaEnCurso,
    destinoConcreto,
    accionSiembra,
    lecturaDispersionPositiva,
    observacionSaludConfirmada,
    alertaConfirmada,
    acuerdoConfirmado,
    ...extra,
  });
  const gestoPuedeDisparar = gestoSolicitado === 'idle'
    || puedeDisparar(gestoSolicitado, cooldowns || {}, ahoraMs);
  const gesto = gestoPuedeDisparar ? gestoSolicitado : 'idle';
  const cooldownsActualizados = gesto !== 'idle'
    ? registrarDisparo(cooldowns || {}, gesto, ahoraMs)
    : cooldowns;
  if (storage && gesto !== 'idle') escribirCooldowns(cooldownsActualizados, storage);
  const contextoUnicos = {
    ...extra,
    ...(resumenFinca ? { resumenFinca } : {}),
    lotes,
    usuarioDijo,
    arboles,
    vecino: vecino || vecina,
    parchesBosque,
    corredores,
  };
  const unicos = comportamientosUnicosGuacamaya({ inventario, contexto: contextoUnicos, ahora: ahoraMs });

  return Object.freeze({
    especie: PERFIL_CONDUCTA_GUACAMAYA.especie,
    comentario,
    datosMundo,
    reaccionClima,
    pregunta,
    susurro,
    agro: nombreCultivo ? agroecologiaGuacamaya(nombreCultivo, especieCatalogo) : null,
    cooldowns: cooldownsActualizados,
    gesto,
    gestoSolicitado,
    gestoBloqueado: !gestoPuedeDisparar,
    unicos,
    entrada: planEntradaDe('guacamaya'),
    salida: planSalidaDe('guacamaya'),
    vozEntrada: '¡Ya llegué, los míos! Me poso en lo alto y miro de una vez el patio, el monte y los surcos.',
    vozSalida: 'Me voy al dosel, los míos. Si me oyen repetir algo, es porque el monte me lo contó primero. ¡Hasta luego!',
  });
}

export const conductaCooldowns = Object.freeze({ leer: leerCooldowns, escribir: escribirCooldowns });

export default {
  conductaGuacamaya,
  comentarioDeMundoGuacamaya,
  conductaCooldowns,
  PERFIL_CONDUCTA_GUACAMAYA,
  UNICOS_GUACAMAYA,
  resumirFincaGuacamaya,
  loteConMasTiempoSinVisitar,
  repetirParaConfirmarGuacamaya,
  detectarPlagaVecina,
  arbolConFrutoMaduroVisible,
  llamarEnBandada,
  marcarCorredoresBosque,
};
