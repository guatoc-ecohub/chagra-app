/**
 * Conducta del oso del bastón: adapta el núcleo portable a un caminante
 * grande, lento y diurno del páramo que se apoya en su bastón y florece.
 * El cuerpo y sus animaciones siguen viviendo en el componente visual.
 */
import { leerCooldowns, escribirCooldowns } from './nucleo/cooldowns.js';
import { datosDeMundo } from './nucleo/datosFinca.js';
import { reaccionAlClima } from './nucleo/climaVivo.js';
import { comentarioDeMundo } from './nucleo/comentarista.js';
import { esDeNoche, susurroDeNoche } from './nucleo/susurroNocturno.js';
import { preguntaDeAprendiz } from './nucleo/modoAprendiz.js';
import { datoAgroecologicoReal } from './nucleo/agroecologia.js';
import { planEntradaDe, planSalidaDe } from './nucleo/entradaSalida.js';
import { decidirIntervencion } from './nucleo/ritmoCompai.js';
import { recordarAniversario } from './nucleo/memoriaTemporal.js';

export const COMPORTAMIENTOS_UNICOS_OSO_BASTON = Object.freeze({
  agua: 'marca nacimiento y recorrido del agua',
  frailejon: 'recuerda el frailejón y el agua que guarda el páramo',
  paso: 'avanza despacio sin apurar al usuario',
  cosecha: 'alza el bastón para celebrar una cosecha',
  suelo: 'avisa si una labor daña el suelo de altura',
  estaciones: 'cuenta el año por estaciones',
});

export const PERFIL_CONDUCTA_OSO_BASTON = Object.freeze({
  especie: 'oso-baston',
  medio: 'suelo',
  diurno: true,
  vocacion: 'caminante grande y lento del páramo',
});

/** Copy propio de especie para la misma situación que comenta Angelita. */
const COMENTARIOS_OSO_BASTON = Object.freeze({
  mis_matas: ({ cultivos }) => {
    const primero = cultivos?.[0];
    return primero
      ? `Camino despacio junto a sus ${primero.name.toLowerCase()}; clavo el bastón y miro cómo respira la tierra.`
      : 'Camino despacio por la finca, apoyado en el bastón. Cuando registre sus matas, las recorremos sin afán.';
  },
  mis_animales: ({ especies }) => {
    const primero = especies?.[0];
    return primero
      ? `Ya vi sus ${primero.name.toLowerCase()}. Me quedo quieto, con el bastón firme, para no espantarles el paso.`
      : 'Camino con cuidado para no espantar a los animales. Cuando los registre, le ayudo a seguir sus señales.';
  },
  clima: () => 'El páramo cambia despacio, pero no perdona descuidos. Revisemos abrigo, agua y el suelo antes de que oscurezca.',
  finca: () => 'Recorro la finca a mi paso. Donde planto el bastón, miro el suelo y dejo que el paisaje me cuente su estado.',
  bosque: () => 'Entre el bosque y el páramo camino con cuidado: aquí cada planta sostiene un poco de agua.',
  paramo: () => 'El páramo es mi casa. Camino lento entre los frailejones y escucho dónde guarda el agua la montaña.',
  vender: ({ cultivos }) => {
    const primero = cultivos?.[0];
    return primero
      ? `A mi paso encuentro sus ${primero.name.toLowerCase()}. Para venderlos, revisemos juntos su cosecha y lo que costó cuidarla.`
      : 'Antes de hablar de venta, caminemos la finca y miremos qué hay realmente registrado.';
  },
});

export function marcarRutaAgua({ nacimiento = null, recorrido = [], desembocadura = null } = {}) {
  const trazo = [nacimiento, ...(Array.isArray(recorrido) ? recorrido : []), desembocadura]
    .filter((punto) => typeof punto === 'string' && punto.trim());
  return trazo.length >= 2
    ? Object.freeze({ nacimiento: trazo[0], recorrido: Object.freeze(trazo.slice(1, -1)), desembocadura: trazo.at(-1) })
    : null;
}

export function memoriaDelFrailejon({ recuerdos = [], frailejon = null, aguaGuardadaLitros = null } = {}) {
  if (!frailejon && !Number.isFinite(Number(aguaGuardadaLitros))) {
    return Array.isArray(recuerdos) && recuerdos.length ? Object.freeze([...recuerdos]) : null;
  }
  const registro = {
    frailejon: frailejon || null,
    aguaGuardadaLitros: Number.isFinite(Number(aguaGuardadaLitros)) ? Number(aguaGuardadaLitros) : null,
  };
  return Object.freeze([... (Array.isArray(recuerdos) ? recuerdos : []), registro]);
}

/** @param {{ocupado?: boolean, severidad?: string|null, ultimaRespuestaMs?: number|null, ahoraMs?: number, esperaMs?: number}} [input] */
export function pasoSinApuro({ ocupado = false, severidad = null, ultimaRespuestaMs = null, ahoraMs = Date.now(), esperaMs } = {}) {
  return Object.freeze({
    ritmo: 'lento',
    apuraUsuario: false,
    intervencion: decidirIntervencion({ ocupado, severidad, ultimaRespuestaMs, ahoraMs, esperaMs, observar: true }),
  });
}

export function alertaDeSuelo({ labor = null, danaSuelo = false, impactoSuelo = null, sueloDeAltura = false } = {}) {
  const detectada = Boolean(danaSuelo || impactoSuelo === 'alto' || impactoSuelo === 'grave');
  if (!detectada) return null;
  return Object.freeze({
    detectada: true,
    labor,
    sueloDeAltura: Boolean(sueloDeAltura),
    severidad: impactoSuelo || 'alta',
  });
}

export function estacionDelOso({ ahora = new Date(), estaciones = null } = {}) {
  const fecha = ahora instanceof Date ? ahora : new Date(ahora);
  if (Number.isNaN(fecha.getTime())) return null;
  const nombres = Array.isArray(estaciones) && estaciones.length === 4
    ? estaciones
    : ['lluvias-1', 'verano-1', 'lluvias-2', 'verano-2'];
  const indice = Math.floor(fecha.getMonth() / 3);
  return Object.freeze({ nombre: nombres[indice], indice, mes: fecha.getMonth() + 1 });
}

export function comentarioDeMundoOsoBaston(mundo, inventario, extra = {}, perfil = {}) {
  const datos = datosDeMundo(mundo, inventario, extra);
  const propio = COMENTARIOS_OSO_BASTON[mundo];
  return propio ? propio(datos) : comentarioDeMundo(mundo, datos, { ...perfil, especie: 'oso-baston' });
}

export function conductaOsoBaston({
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
  florece = false,
  cosechaConfirmada = false,
  agua = null,
  frailejon = null,
  aguaGuardadaLitros = null,
  recuerdosFrailejon = [],
  registrosTemporales = [],
  labor = null,
  danaSuelo = false,
  impactoSuelo = null,
  sueloDeAltura = false,
  estaciones = null,
  ocupado = false,
  severidad = null,
  ultimaRespuestaMs = null,
} = {}) {
  if (!activo) return null;

  const reaccionClima = reaccionAlClima({ forecast7d });
  const datosMundo = mundo ? datosDeMundo(mundo, inventario, extra) : {};
  const comentario = mundo ? comentarioDeMundoOsoBaston(mundo, inventario, extra, perfil) : null;
  const pregunta = preguntaDeAprendiz({ mundo, datosMundo, rand });
  const susurro = esDeNoche(ahora) ? susurroDeNoche({ fase, reaccionClima }) : null;
  const agro = nombreCultivo ? datoAgroecologicoReal(nombreCultivo, especieCatalogo) : null;
  const cooldowns = storage ? leerCooldowns(storage) : null;
  const rutaAgua = marcarRutaAgua(agua || {});
  const recuerdos = memoriaDelFrailejon({ recuerdos: recuerdosFrailejon, frailejon, aguaGuardadaLitros });
  const aniversario = recordarAniversario({ registros: registrosTemporales, ahoraMs: ahora.getTime?.() ?? Number(ahora) });
  const paso = pasoSinApuro({ ocupado, severidad, ultimaRespuestaMs, ahoraMs: ahora.getTime?.() ?? Number(ahora) });
  const alertaSuelo = alertaDeSuelo({ labor, danaSuelo, impactoSuelo, sueloDeAltura });
  const estacion = estacionDelOso({ ahora, estaciones });
  const gesto = florece || cosechaConfirmada ? 'florece' : 'idle';
  if (storage && florece) escribirCooldowns(cooldowns || {}, storage);

  return Object.freeze({
    especie: PERFIL_CONDUCTA_OSO_BASTON.especie,
    comentario,
    datosMundo,
    reaccionClima,
    pregunta,
    susurro,
    agro,
    rutaAgua,
    recuerdosFrailejon: recuerdos,
    aniversario,
    paso,
    alertaSuelo,
    estacion,
    gestoPropio: gesto === 'florece' ? 'alzar-baston' : null,
    cooldowns,
    gesto,
    entrada: planEntradaDe('oso-baston'),
    salida: planSalidaDe('oso-baston'),
    vozEntrada: 'Llego a pie, despacio. Clavo el bastón y miro cómo está la finca.',
    vozSalida: 'Sigo la trocha con calma. El páramo queda cuidando el agua.',
  });
}

export const conductaCooldowns = Object.freeze({ leer: leerCooldowns, escribir: escribirCooldowns });

export default {
  conductaOsoBaston,
  comentarioDeMundoOsoBaston,
  marcarRutaAgua,
  memoriaDelFrailejon,
  pasoSinApuro,
  alertaDeSuelo,
  estacionDelOso,
  conductaCooldowns,
  COMPORTAMIENTOS_UNICOS_OSO_BASTON,
  PERFIL_CONDUCTA_OSO_BASTON,
};
