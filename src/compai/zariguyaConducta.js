/**
 * Conducta de la zarigüeya: adapta el repertorio portable al compai nocturno.
 *
 * Comparte mecanismos con Angelita (datos grounded, clima, cooldown, modo
 * aprendiz y planes de entrada/salida), pero conserva voz y prioridades de
 * especie: husmea, evita el ruido y busca restos, no flores ni miel.
 */
import { leerCooldowns, escribirCooldowns } from './nucleo/cooldowns.js';
import { datosDeMundo } from './nucleo/datosFinca.js';
import { reaccionAlClima } from './nucleo/climaVivo.js';
import { comentarioDeMundo } from './nucleo/comentarista.js';
import { esDeNoche, susurroDeNoche } from './nucleo/susurroNocturno.js';
import { preguntaDeAprendiz } from './nucleo/modoAprendiz.js';
import { datoAgroecologicoReal } from './nucleo/agroecologia.js';
import { planEntradaDe, planSalidaDe } from './nucleo/entradaSalida.js';

export const PERFIL_CONDUCTA_ZARIGUYA = Object.freeze({
  especie: 'zariguya',
  nocturna: true,
  vocacion: 'carroñera y tímida',
});

const HORA_ANOCHECER = 18;

function horaLocal(ahora) {
  const fecha = ahora instanceof Date ? ahora : new Date(ahora);
  return Number.isFinite(fecha.getTime()) ? fecha.getHours() : null;
}

function nombreRegistro(registro) {
  return String(registro?.animal || registro?.nombre || registro?.name || registro?.especie || '').trim();
}

/** Los seis comportamientos que solo puede aportar la zarigüeya. */
export function resumenAlAnochecer({ ahora = new Date(), resumenDia = null } = {}) {
  if (horaLocal(ahora) == null || horaLocal(ahora) < HORA_ANOCHECER) return null;
  const entradas = Array.isArray(resumenDia) ? resumenDia.filter(Boolean) : [];
  return Object.freeze({ tipo: 'resumen-anochecer', visible: true, entradas });
}

export function alertaPlagaNocturna({ plagasNocturnas = [], ahora = new Date() } = {}) {
  if (horaLocal(ahora) == null || horaLocal(ahora) < HORA_ANOCHECER) return null;
  const plagas = plagasNocturnas
    .filter((plaga) => plaga && (plaga.detectada === true || plaga.confirmada === true))
    .map((plaga) => nombreRegistro(plaga))
    .filter(Boolean);
  return plagas.length ? Object.freeze({ tipo: 'plaga-nocturna', plagas }) : null;
}

export function leerRastros({ rastros = [] } = {}) {
  const lecturas = rastros
    .filter((rastro) => rastro && nombreRegistro(rastro))
    .map((rastro) => Object.freeze({
      animal: nombreRegistro(rastro),
      cultivo: String(rastro.cultivo || rastro.lote || '').trim() || null,
      confianza: Number.isFinite(rastro.confianza) ? rastro.confianza : null,
    }));
  return Object.freeze({ tipo: 'lectura-rastros', lecturas });
}

export function resolverTanatosis({ usuarioEnfadado = false } = {}) {
  return usuarioEnfadado
    ? Object.freeze({ tipo: 'tanatosis', gesto: 'muerta', motivo: 'usuario-enfadado' })
    : null;
}

export function cuidarLoPequeno({ plantulasRecientes = [] } = {}) {
  const plantulas = plantulasRecientes
    .filter((plantula) => plantula && nombreRegistro(plantula))
    .map((plantula) => nombreRegistro(plantula));
  return plantulas.length
    ? Object.freeze({ tipo: 'cuidado-plantulas', plantulas })
    : null;
}

export function ensenarACrias({ pasoAprendido = null } = {}) {
  if (!pasoAprendido || typeof pasoAprendido !== 'object') return null;
  const paso = String(pasoAprendido.paso || pasoAprendido.nombre || '').trim();
  return paso
    ? Object.freeze({ tipo: 'aprendizaje-crias', paso, repetir: true })
    : null;
}

/** Copy propio de especie para la misma situación que comenta Angelita. */
const COMENTARIOS_ZARIGUYA = Object.freeze({
  mis_matas: ({ cultivos }) => {
    const primero = cultivos?.[0];
    return primero
      ? `Yo paso despacito junto a sus ${primero.name.toLowerCase()}; de noche husmeo, no me meto con sus matas.`
      : 'Paso despacito y husmeo desde la orilla. Cuando registre sus matas, las miro sin molestarlas.';
  },
  mis_animales: ({ especies }) => {
    const primero = especies?.[0];
    return primero
      ? `Ya olí que tiene ${primero.name.toLowerCase()}. Me quedo lejos y salgo cuando todo está tranquilo.`
      : 'Salgo cuando está tranquilo. Si registra sus animales, le ayudo a leer sus rastros sin asustarlos.';
  },
  clima: () => 'De noche el frío se siente más. Yo me escondo entre hojas y le aviso si mañana viene riesgo.'
});

/**
 * Construye una intervención de la zarigüeya con datos locales reales.
 * `comentarioDeMundo` sigue siendo el fallback compartido para mundos sin
 * copy específico, no una copia del texto de Angelita.
 */
export function comentarioDeMundoZariguya(mundo, inventario, extra = {}, perfil = {}) {
  const datos = datosDeMundo(mundo, inventario, extra);
  const propio = COMENTARIOS_ZARIGUYA[mundo];
  return propio ? propio(datos) : comentarioDeMundo(mundo, datos, { ...perfil, especie: 'zariguya' });
}

export function conductaZariguya({
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
  resumenDia = null,
  plagasNocturnas = [],
  rastros = [],
  usuarioEnfadado = false,
  plantulasRecientes = [],
  pasoAprendido = null,
} = {}) {
  if (!activo) return null;
  const reaccionClima = reaccionAlClima({ forecast7d });
  const deNoche = esDeNoche(ahora);
  const comentario = mundo ? comentarioDeMundoZariguya(mundo, inventario, extra, perfil) : null;
  const datosMundo = mundo ? datosDeMundo(mundo, inventario, extra) : {};
  const pregunta = preguntaDeAprendiz({ mundo, datosMundo, rand });
  const susurro = deNoche ? susurroDeNoche({ fase, reaccionClima }) : null;
  const agro = nombreCultivo ? datoAgroecologicoReal(nombreCultivo, especieCatalogo) : null;
  const cooldowns = storage ? leerCooldowns(storage) : null;
  const resumenAnochecer = resumenAlAnochecer({ ahora, resumenDia });
  const alertaNocturna = alertaPlagaNocturna({ ahora, plagasNocturnas });
  const rastrosLeidos = leerRastros({ rastros });
  const tanatosis = resolverTanatosis({ usuarioEnfadado });
  const cuidadoPlantulas = cuidarLoPequeno({ plantulasRecientes });
  const aprendizajeCrias = ensenarACrias({ pasoAprendido });
  return Object.freeze({
    especie: PERFIL_CONDUCTA_ZARIGUYA.especie,
    comentario,
    pregunta,
    reaccionClima,
    susurro,
    agro,
    cooldowns,
    unicos: Object.freeze({
      resumenAnochecer,
      alertaNocturna,
      rastros: rastrosLeidos,
      tanatosis,
      cuidadoPlantulas,
      aprendizajeCrias,
    }),
    entrada: planEntradaDe('zariguya'),
    salida: planSalidaDe('zariguya'),
  });
}

export const conductaCooldowns = Object.freeze({ leer: leerCooldowns, escribir: escribirCooldowns });

export default {
  conductaZariguya,
  comentarioDeMundoZariguya,
  conductaCooldowns,
  PERFIL_CONDUCTA_ZARIGUYA,
  resumenAlAnochecer,
  alertaPlagaNocturna,
  leerRastros,
  resolverTanatosis,
  cuidarLoPequeno,
  ensenarACrias,
};
