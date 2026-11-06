/**
 * seguimientoProcesos — catálogo de los procesos de finca con SEGUIMIENTO
 * visible (tarjeta en el home + vista de seguimiento), 2026-06-15.
 *
 * El operador pidió "tarjetas en el home + vista de seguimiento, como Mis
 * plantas pero para estos procesos": Reforestación · Silvopastoreo · Páramo ·
 * Cerdos. Cada entrada mapea a un `process_type` de types/farmProcess y reusa
 * el motor FarmProcess (createFarmProcess / recordFarmEvent / confirmStage) y
 * la secuencia de etapas (stageSequenceForProcessType). Biopreparados añade
 * un seguimiento local de tandas para bocashi, biol y supermagro.
 *
 * Fuente única: la vista de seguimiento (SeguimientoProcesoScreen), las tarjetas
 * del dashboard (FincaCards) y el routing (App.jsx) leen de aquí. NO duplicar
 * labels ni rutas.
 */

/**
 * @typedef {Object} SeguimientoProcesoDef
 * @property {string} key — id de ruta corta, ej. 'reforestacion'
 * @property {string} processType — process_type válido en types/farmProcess
 * @property {string} title — título de la tarjeta / pantalla
 * @property {string} subtitle — copy de campesino bajo el título
 * @property {string} emoji — ícono emoji grande (mismo patrón que FincaCards)
 * @property {string} section — clave de estilo tonal (ver SECTION_STYLES)
 * @property {'individual'|'aggregate'} subjectKind — modo por defecto del sujeto
 * @property {string} defaultUnit — unidad por defecto al iniciar
 * @property {string} subjectLabelPlaceholder — placeholder del campo "qué"
 * @property {string} startVerb — etiqueta del botón "iniciar"
 * @property {string} emptyHint — invitación amable en la tarjeta cuando el
 *   contador está en cero (en vez de un "0" triste). Español Colombia.
 * @property {string[]} [subjectOptions] - opciones de preparación para el
 *   seguimiento de biopreparados.
 */

/** @type {SeguimientoProcesoDef[]} */
export const SEGUIMIENTO_PROCESOS = [
  {
    key: 'reforestacion',
    processType: 'restoration',
    title: 'Reforestación',
    subtitle: 'Restauración con árboles nativos',
    emoji: '🌳',
    section: 'reforestacion',
    subjectKind: 'aggregate',
    defaultUnit: 'árboles',
    subjectLabelPlaceholder: 'Ej: Roble, Aliso, Cativo…',
    startVerb: 'Iniciar reforestación',
    emptyHint: 'Siembra tus primeros árboles',
  },
  {
    key: 'silvopastoreo',
    processType: 'silvopasture',
    title: 'Silvopastoreo',
    subtitle: 'Árboles + pasto + ganado',
    emoji: '🐄',
    section: 'silvopastoreo',
    subjectKind: 'aggregate',
    defaultUnit: 'árboles',
    subjectLabelPlaceholder: 'Ej: Leucaena, Botón de oro, Nacedero…',
    startVerb: 'Iniciar silvopastoreo',
    emptyHint: 'Une árboles, pasto y ganado',
  },
  {
    key: 'paramo',
    processType: 'paramo',
    title: 'Páramo',
    subtitle: 'Conservación de páramo y agua',
    emoji: '🏔️',
    section: 'paramo',
    subjectKind: 'aggregate',
    defaultUnit: 'hectáreas',
    subjectLabelPlaceholder: 'Ej: Nacimiento de agua, frailejonal…',
    startVerb: 'Iniciar conservación',
    emptyHint: 'Cuida tu páramo y el agua',
  },
  {
    key: 'cerdos',
    processType: 'pigs',
    title: 'Cerdos',
    subtitle: 'Ciclo de manejo porcino',
    emoji: '🐖',
    section: 'cerdos',
    subjectKind: 'aggregate',
    defaultUnit: 'animales',
    subjectLabelPlaceholder: 'Ej: Lote de engorde, marranas de cría…',
    startVerb: 'Iniciar ciclo',
    emptyHint: 'Arranca tu primer lote',
  },
  {
    key: 'biopreparados',
    processType: 'biopreparation',
    title: 'Biopreparados',
    subtitle: 'Siga sus tandas de bocashi, biol y supermagro',
    emoji: '🧪',
    section: 'insumos',
    subjectKind: 'aggregate',
    defaultUnit: 'tandas',
    subjectLabelPlaceholder: 'Elija qué va a preparar',
    subjectOptions: ['Bocashi', 'Biol', 'Supermagro'],
    startVerb: 'Iniciar preparación',
    emptyHint: 'Anote su primera preparación',
  },
];

const BOCASHI_TURN_OFFSETS_DAYS = [3, 6, 10, 13, 17, 20, 24, 27];

const addCalendarDays = (timestamp, days) => {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
};

/**
 * Hitos calculados desde la fecha de inicio. Las fechas no se guardan aparte:
 * la base local conserva el proceso y los eventos que usted registra.
 *
 * Bocashi: AGROSAVIA documenta dos volteos por semana durante 3 o 4 semanas,
 * con el fin del proceso cuando baja la temperatura de la mezcla.
 * https://repository.agrosavia.co/server/api/core/bitstreams/387adde1-7da6-44a6-a44e-13f5a71ef6fb/content
 * Biol: el plan de manejo AGROSAVIA da 45 a 60 días para zonas frías; esa
 * ventana no se generaliza porque la finca puede tener otro clima.
 * https://repository.agrosavia.co/server/api/core/bitstreams/98245cf1-c17c-4262-8285-179b1ba915e2/content
 * Supermagro: no se fija un plazo sin una fuente que aplique a la preparación.
 *
 * @param {string} preparation
 * @param {number} startedAt
 * @returns {{ turnReminders: { index: number, dueAt: number }[], readyWindow: [number, number] | null, guidance: string, sourceUrl?: string }}
 */
export const getBiopreparationSchedule = (preparation, startedAt) => {
  const normalized = String(preparation || '').trim().toLocaleLowerCase('es');
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    return { turnReminders: [], readyWindow: null, guidance: 'Sin fecha estimada con fuente para esta preparación.' };
  }

  if (normalized === 'bocashi') {
    return {
      turnReminders: BOCASHI_TURN_OFFSETS_DAYS.map((days, index) => ({
        index: index + 1,
        dueAt: addCalendarDays(startedAt, days),
      })),
      readyWindow: [addCalendarDays(startedAt, 21), addCalendarDays(startedAt, 28)],
      guidance: 'AGROSAVIA indica dos volteos por semana. Estas fechas son una pauta sugerida; revise la temperatura, pues el proceso termina cuando baja.',
      sourceUrl: 'https://repository.agrosavia.co/server/api/core/bitstreams/387adde1-7da6-44a6-a44e-13f5a71ef6fb/content',
    };
  }

  if (normalized === 'biol') {
    return {
      turnReminders: [],
      readyWindow: null,
      guidance: 'AGROSAVIA documenta 45 a 60 días para zonas frías. Sin la condición local confirmada, revise que ya no salgan burbujas antes de marcarlo listo.',
      sourceUrl: 'https://repository.agrosavia.co/server/api/core/bitstreams/98245cf1-c17c-4262-8285-179b1ba915e2/content',
    };
  }

  return {
    turnReminders: [],
    readyWindow: null,
    guidance: 'Sin fecha estimada con fuente para esta preparación. Registre la revisión y el resultado.',
  };
};

/** Mapa key → def, para resolver desde la ruta. */
export const SEGUIMIENTO_BY_KEY = Object.fromEntries(
  SEGUIMIENTO_PROCESOS.map((d) => [d.key, d]),
);

/** Resuelve la definición desde una key de ruta. */
export const getSeguimientoDef = (key) => SEGUIMIENTO_BY_KEY[key] || null;

/** Ruta de navegación para una key de seguimiento. */
export const seguimientoRoute = (key) => `seguimiento_${key}`;

/**
 * Parsea una vista 'seguimiento_<key>' a su key. Devuelve null si no aplica.
 * @param {string} view
 */
export const parseSeguimientoView = (view) => {
  if (typeof view !== 'string') return null;
  const m = view.match(/^seguimiento_(.+)$/);
  if (!m) return null;
  return SEGUIMIENTO_BY_KEY[m[1]] ? m[1] : null;
};
