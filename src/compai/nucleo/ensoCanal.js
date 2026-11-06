/**
 * ensoCanal — CANAL PROPIO PARA ENSO/NIÑO, con rotación de hechos.
 *
 * Canal prioritario específico para mensajes del Fenómeno del Niño / Oscilación
 * del Sur (ENSO), independiente del canal genérico de clima. Implementa:
 *   - Canal propio priorizado (no fallback a genéricos de cultivo/piso térmico)
 *   - Rotación de hechos para no repetir el mismo mensaje ENSO
 *   - Mensajes regionales específicos por fase (El Niño, La Niña, Vigilancia)
 *
 * REGLA DURA: cero invención de datos climáticos. Este módulo NO predice el
 * clima ni fabrica probabilidades — solo traduce la fase ENSO (que viene del
 * servicio ensoService / sidecar) a mensajes contextualizados por región.
 *
 * Uso típico (ejemplo en proactiveGreeting o angelitaInteligencia):
 *   ```js
 *   import { mensajeEnsoPrioritario, rotarHechoEnso } from './ensoCanal';
 *
 *   const fase = ensoService.getEnsoPhase(); // 'el_nino' | 'la_nina' | 'neutral'
 *   const region = regionFromProfile(profile); // 'andina' | 'caribe' | ...
 *   const indice = ultimaEnsoIdx || 0; // índice de rotación (persistido)
 *   const mensaje = mensajeEnsoPrioritario({ fase, region, indice });
 *
 *   if (mensaje) {
 *     // Canal ENSO activado — tiene prioridad sobre genéricos
 *     return { lead: mensaje, channel: 'enso', nextIdx: rotarHechoEnso(fase, region, indice) };
 *   }
 *   // fallback a otros canales (cultivos, piso térmico, etc.)
 *   ```
 *
 * @module compai/nucleo/ensoCanal
 */

/**
 * Familia de fase ENSO normalizada.
 * @typedef {'nino'|'nina'|'neutral'} EnsoFamily
 * @typedef {'nino'|'nina'|'vigilancia'} EnsoFactKey
 */

/**
 * Regiones naturales de Colombia (mismo mapping que ensoContext).
 * @typedef {string|null} Region
 */

/**
 * @typedef {Object} MensajeEnso
 * @property {string} mensaje — texto en tú, colombiano, sin voseo.
 * @property {string} fuente — 'NOAA CPC · IDEAM' o variante.
 * @property {('nino'|'nina'|'neutral')} family — fase normalizada.
 * @property {number} nextIdx — siguiente índice de rotación (para persistir).
 */

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. HECHOS ENSO POR REGIÓN — múltiples hechos rotacionales por fase.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Hechos documentados por fase ENSO y región. Cada región tiene un array de
 * hechos rotacionales (2-3 hechos distintos) para evitar repetición.
 *
 * Orientación general, no boletín vigente. Fuentes y límites por hallazgo:
 * evidencia interna.
 */
// Cifra heredada sin evaluación de pérdidas localizable (fri#20).
export const PERDIDA_PAPA_HISTORICA = Object.freeze({
  toneladas: 25000,
  toneladas_verificacion: 'no_verificado',
  periodo: '2015-16',
});

/** @type {Record<string, Record<EnsoFactKey, string[]>>} */
const HECHOS_ENSO = Object.freeze({
  andina: {
    nino: [
      'El Niño en los Andes puede favorecer menos lluvia y más calor, según localidad y temporada. En piso frío aumenta el riesgo de heladas por noches despejadas: conviene revisar el pronóstico local. La cifra histórica de cerca de 25.000 toneladas de papa perdidas en 2015-16 no está verificada; no la uses para estimar pérdidas.',
      'Prepara la protección según el pronóstico local. Usa aspersión antihelada solo con diseño técnico y suministro continuo adecuados, control de temperatura de bulbo húmedo, viento y riesgo de encharcamiento; ajusta el cálculo a la altitud. Una aplicación insuficiente puede agravar el daño. El acolchado puede conservar humedad, pero evalúa su efecto térmico ante helada radiativa.',
      'En café y cacao, ajusta el sombrío al cultivo y al sitio: evalúa especie, densidad, poda y agua disponible; puede amortiguar calor, pero también competir por agua. En papa de altura, consulta el pronóstico de heladas y vigila las noches despejadas.',
    ],
    nina: [
      'La Niña puede favorecer más lluvia en los Andes, con diferencias locales y estacionales. Antes de decidir riego o manejo de encharcamiento, cruza el boletín vigente y el pronóstico local con lluvia observada, suelo y cultivo; consulta las alertas de deslizamientos.',
      'Si se prevén lluvias persistentes, vigila enfermedades en tus cultivos y busca diagnóstico local antes de intervenir. Ajusta el manejo al cultivo, al suelo y a la lluvia observada.',
      'Ante riesgo de encharcamiento, solicita evaluación local en áreas productivas existentes antes de intervenir el agua o el suelo. No hagas drenajes en humedales ni en suelos naturales de páramo. En ladera, consulta las alertas de deslizamientos.',
    ],
    vigilancia: [
      'En piso frío, prepara protección según el pronóstico local. Usa aspersión antihelada solo con diseño técnico y suministro continuo adecuados, control de temperatura de bulbo húmedo, viento y riesgo de encharcamiento; ajusta el cálculo a la altitud. En café y cacao, evalúa especie de sombra, densidad, poda y agua disponible: la sombra puede competir por agua.',
      'Revisa tus reservas de agua y el estado del riego. Ajusta las medidas al pronóstico local, al suelo y al cultivo antes de invertir.',
      'Consulta un boletín ENSO con fecha de emisión y período de validez. La fase neutral por sí sola no indica vigilancia de El Niño ni una transición prevista.',
    ],
  },
  caribe: {
    nino: [
      'En el Caribe, revisa el riesgo de sequía en el boletín vigente y las alertas locales. Prioriza ahorro de agua según las necesidades de cultivos y ganado.',
      'Ante condiciones secas, revisa captación y almacenamiento de agua lluvia según su disponibilidad. Evalúa la cobertura del suelo y el agua necesaria para tus cultivos.',
      'Temporada de El Niño en el Caribe: cuidado con el estrés hídrico en tus cultivos y ganado. Optimiza riego y busca cultivos tolerantes a sequía para reducir vulnerabilidad.',
    ],
    nina: [
      'Durante La Niña en el Caribe, consulta el pronóstico local y las alertas de inundación. Revisa las zonas anegables antes de decidir dónde sembrar.',
      'Si hay lluvias persistentes, vigila encharcamiento en arroz de riego y banano. Refuerza canales de drenaje y planifica siembras en zonas altas dentro de tu finca.',
      'Temporada de La Niña: refuerza drenajes y camas altas para manejar exceso de agua. En zonas inundables, considera cultivos tolerantes a saturación.',
    ],
    vigilancia: [
      'En el Caribe, revisa reservas de agua y necesidades del cultivo. Decide la captación y el riego según la lluvia observada y el pronóstico local.',
      'Revisa captación de agua lluvia y sistemas de riego eficiente según las necesidades de tu finca y el pronóstico local.',
      'Consulta el boletín ENSO fechado y las alertas locales del Caribe antes de ajustar el manejo del agua; no hay una transición confirmada por estar en fase neutral.',
    ],
  },
  pacifico: {
    nino: [
      'En el Pacífico, evalúa déficit hídrico, lluvias intensas, erosión e incendios según localidad, temporada y alertas. El Niño no elimina episodios intensos ni determina una prioridad única.',
      'Antes de ajustar el manejo del agua en el Pacífico, revisa la lluvia observada, la humedad del suelo y el pronóstico local. No des por hecho que El Niño reduce todos los extremos.',
      'En el Pacífico, decide las medidas de conservación de agua y suelo con evaluación local. No asumas que el exceso de agua siempre es el riesgo principal durante El Niño.',
    ],
    nina: [
      'Durante La Niña en el Pacífico, consulta el pronóstico de lluvias y las alertas de erosión y deslizamiento. Solicita evaluación local antes de modificar drenajes en ladera.',
      'Ante lluvias previstas localmente, vigila laderas y cauces sin exponerte. Busca acompañamiento técnico antes de abrir zanjas o modificar la escorrentía.',
      'Durante La Niña en el Pacífico, revisa las alertas locales antes de trabajar en laderas. Evalúa las medidas de conservación del suelo con acompañamiento técnico.',
    ],
    vigilancia: [
      'En el Pacífico, evalúa déficit hídrico, lluvias intensas, erosión e incendios según localidad, temporada y alertas oficiales antes de intervenir.',
      'Revisa la cobertura del suelo y busca evaluación local antes de abrir zanjas o modificar el drenaje en laderas.',
      'Consulta un boletín ENSO fechado y las alertas locales del Pacífico para decidir el manejo del agua; la fase neutral no anuncia por sí sola una transición.',
    ],
  },
  orinoquia: {
    nino: [
      'En la Orinoquía, evita quemas durante condiciones de riesgo. Prepara cortafuegos, puntos de agua y medidas de respuesta con acompañamiento local y consulta alertas oficiales.',
      'Revisa agua y sombra para el ganado según las condiciones de tus pasturas. Evita quemas durante condiciones de riesgo; organiza la prevención con acompañamiento local y alertas oficiales.',
      'Ante riesgo de incendio en la Orinoquía, evita quemas. Organiza cortafuegos, puntos de agua y respuesta con acompañamiento local; consulta alertas oficiales.',
    ],
    nina: [
      'Durante La Niña en la Orinoquía, consulta las alertas y revisa la saturación de la sabana inundable. Solicita evaluación local antes de sembrar o intervenir el agua.',
      'Si hay lluvias persistentes, vigila pasturas saturadas y riesgo de inundación. Planifica zonas altas para refugio del ganado y cultivos tolerantes a encharcamiento.',
      'Si hay encharcamiento en la Orinoquía, evalúa el manejo del agua con acompañamiento local antes de intervenir suelos o cauces.',
    ],
    vigilancia: [
      'En la Orinoquía, evita quemas durante condiciones de riesgo. Prepara cortafuegos, puntos de agua y medidas de respuesta con acompañamiento local y consulta alertas oficiales.',
      'Revisa con acompañamiento local cortafuegos, puntos de agua y el plan de evacuación del ganado. Consulta alertas oficiales y evita quemas durante condiciones de riesgo.',
      'Consulta un boletín ENSO fechado y las alertas locales antes de planificar la temporada en la sabana; la fase neutral no confirma una sequía futura.',
    ],
  },
  amazonia: {
    nino: [
      'Durante El Niño en la Amazonía, consulta las alertas de sequía e incendio de tu localidad. Protege la chagra de quemas accidentales y revisa el agua disponible.',
      'Ante condiciones secas, prioriza conservación de bosque y diversificación de cultivos. La chagra tradicional se resiste mejor si diversifica y evita monocultivos.',
      'Temporada de El Niño en Amazonía: riesgo de sequía e incendio. Evita quemas, prepara sistemas de captación de agua y refuerza la chagra diversificada.',
    ],
    nina: [
      'Durante La Niña en la Amazonía, consulta las alertas locales de inundación. Revisa el estado de las vegas antes de decidir dónde sembrar.',
      'Si hay lluvias persistentes, vigila saturación en vegas de río. Planifica cultivos en zonas altas y refuerza drenajes naturales.',
      'Si hay saturación del suelo en la Amazonía, solicita evaluación local antes de intervenir el agua o elegir cultivos para las zonas bajas.',
    ],
    vigilancia: [
      'Protege la chagra de quemas accidentales y revisa el agua disponible según el pronóstico local y las alertas oficiales.',
      'Evalúa la diversificación de tu chagra según suelo, agua y cultivos; consulta el pronóstico local antes de cambiar el manejo.',
      'Consulta un boletín ENSO fechado y las alertas locales de la Amazonía; la fase neutral no confirma sequías ni una transición a El Niño.',
    ],
  },
});

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. MENSAJES GENÉRICOS (fallback sin región específica).
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Hechos genéricos por fase ENSO cuando no hay región identificada.
 */
/** @type {Record<EnsoFactKey, string[]>} */
const HECHOS_GENERICOS = Object.freeze({
  nino: [
    'El Niño puede favorecer más calor y menos lluvia, con variaciones por localidad y temporada. Revisa el pronóstico y las alertas locales antes de decidir riego. Ajusta sombra, densidad y poda al cultivo y al agua disponible: puede haber competencia por agua.',
    'Ante condiciones secas, optimiza el uso de agua. Riego por goteo, cobertura permanente y sistemas agroforestales te ayudan a resistir.',
    'Temporada de El Niño: reduce vulnerabilidad a sequía. Captación de agua lluvia, mulch y cultivos tolerantes a sequía son tus mejores aliados.',
  ],
  nina: [
    'Durante La Niña pueden cambiar las probabilidades de lluvia según localidad y temporada. Revisa el pronóstico, las alertas y el estado del suelo antes de decidir el manejo del agua.',
    'Ante lluvias previstas localmente, refuerza drenajes agroecológicos. Camas altas y canales de desagüe te ayudan a manejar el exceso de agua.',
    'Temporada de La Niña: prepara tu finca para lluvias intensas. Drenajes, barreras vivas y cultivos tolerantes a saturación reducen pérdidas.',
  ],
  vigilancia: [
    'Consulta un boletín ENSO con fecha de emisión y período de validez antes de ajustar el manejo de tu finca.',
    'Revisa reservas de agua y estado del suelo; prepara medidas según el pronóstico local y las necesidades de tu cultivo.',
    'La fase neutral por sí sola no indica vigilancia de El Niño. Consulta el estado oficial en un boletín fechado.',
  ],
});

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. FUNCIONES PÚBLICAS — canal prioritario y rotación.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Normaliza una fase ENSO a familia corta.
 * @param {string} phase: fase del servicio (ej. 'el_nino', 'la_nina', 'neutral')
 * @returns {EnsoFamily}
 */
export function ensoFamily(phase) {
  if (typeof phase !== 'string') return 'neutral';
  const normalized = phase.toLowerCase().replace(/[^a-z_]/g, '');
  if (normalized.includes('nino')) return 'nino';
  if (normalized.includes('nina')) return 'nina';
  return 'neutral';
}

/**
 * Devuelve el array de hechos para una familia y región.
 * @param {EnsoFamily|EnsoFactKey} family
 * @param {Region} region
 * @returns {Array<string>} array de hechos (vacío si no hay datos)
 */
function hechosParaFamilyRegion(family, region) {
  // Para fase neutral, usamos 'vigilancia' como clave en los datos
  const dataKey = family === 'neutral' ? 'vigilancia' : family;

  if (!region || !HECHOS_ENSO[region]) return HECHOS_GENERICOS[dataKey] || [];
  const hechosRegion = HECHOS_ENSO[region][dataKey];
  return Array.isArray(hechosRegion) && hechosRegion.length > 0
    ? hechosRegion
    : HECHOS_GENERICOS[dataKey] || [];
}

/**
 * Devuelve orientación ENSO por fase, sin fabricar un pronóstico vigente.
 * El mensaje está contextualizado por región y rotado según el índice.
 *
 * @param {Object} opts
 * @param {string} [opts.fase='neutral']: fase del servicio ensoService.getEnsoPhase()
 * @param {Region} [opts.region=null]: región desde ensoContext.regionFromProfile()
 * @param {number} [opts.indice=0]: índice de rotación (0, 1, 2...)
 * @returns {MensajeEnso|null} null si no hay textos disponibles.
 */
export function mensajeEnsoPrioritario({ fase = 'neutral', region = null, indice = 0 } = {}) {
  const family = ensoFamily(fase);
  
  // Neutral no demuestra que exista un Watch oficial.
  if (family === 'neutral') return mensajeEnsoVigilancia({ region, indice });

  // Fase activa (El Niño o La Niña)
  const hechos = hechosParaFamilyRegion(family, region);
  if (hechos.length === 0) return null;

  const idx = Math.max(0, Math.min(indice, hechos.length - 1));
  return {
    mensaje: hechos[idx],
    fuente: 'NOAA CPC · IDEAM',
    family,
    nextIdx: rotarHechoEnso(fase, region, indice),
  };
}

/**
 * Calcula el siguiente índice de rotación para evitar repetición.
 * Avanza cíclicamente dentro del array de hechos disponibles.
 *
 * @param {string} fase
 * @param {Region} region
 * @param {number} indiceActual
 * @returns {number} siguiente índice (0, 1, 2...)
 */
export function rotarHechoEnso(fase, region, indiceActual = 0) {
  const family = ensoFamily(fase);
  const hechos = hechosParaFamilyRegion(family, region);
  const maxIdx = Math.max(0, hechos.length - 1);

  if (maxIdx <= 0) return 0; // Solo un hecho disponible o ninguno

  const siguiente = indiceActual + 1;
  return siguiente > maxIdx ? 0 : siguiente;
}

/**
 * Devuelve orientación general cuando no hay un boletín trazable.
 * No convierte una fase neutral ni una probabilidad aislada en Watch oficial.
 *
 * @param {Object} opts
 * @param {Region} [opts.region=null]
 * @param {number} [opts.indice=0]
 * Una probabilidad aislada del caller no se publica: este contrato no recibe
 * boletín verificable con fecha de emisión y período objetivo.
 * @returns {MensajeEnso|null}
 */
export function mensajeEnsoVigilancia({ region = null, indice = 0 } = {}) {
  const hechos = hechosParaFamilyRegion('vigilancia', region);
  if (hechos.length === 0) return null;

  const idx = Math.max(0, Math.min(indice, hechos.length - 1));
  const mensaje = `Pronóstico ENSO no disponible en este canal: falta un boletín con fecha de emisión y período de validez. ${hechos[idx]}`;

  return {
    mensaje,
    fuente: 'NOAA CPC · IRI / IDEAM',
    family: 'neutral',
    nextIdx: rotarHechoEnso('neutral', region, indice),
  };
}

/**
 * Predicado: ¿hay mensaje ENSO prioritario para mostrar?
 * Útil para filtrar antes de llamar a mensajeEnsoPrioritario.
 *
 * @param {Object} opts
 * @param {string} [opts.fase='neutral']
 * @param {Region} [opts.region=null]
 * @returns {boolean}
 */
export function hayMensajeEnso({ fase = 'neutral', region = null } = {}) {
  const family = ensoFamily(fase);
  if (family === 'neutral') {
    // Solo si hay hechos de vigilancia disponibles
    const hechos = hechosParaFamilyRegion('vigilancia', region);
    return hechos.length > 0;
  }
  // Fase activa: verificar si hay hechos específicos o genéricos
  const hechos = hechosParaFamilyRegion(family, region);
  return hechos.length > 0;
}

export default {
  mensajeEnsoPrioritario,
  mensajeEnsoVigilancia,
  rotarHechoEnso,
  hayMensajeEnso,
  ensoFamily,
};
