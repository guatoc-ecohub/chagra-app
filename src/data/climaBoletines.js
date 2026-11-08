/**
 * climaBoletines.js — CONTENIDO del módulo "El clima que viene" (traductor de
 * boletines IDEAM/ENSO).
 *
 * POSICIONAMIENTO (grounding 2026-07-04, Parte B): Chagra NO reemplaza al IDEAM
 * ni pronostica el clima. Es el TRADUCTOR CAMPESINO de los boletines oficiales:
 * lee la FASE ENSO en vivo (ensoService, alimentado por el sidecar NOAA/IDEAM),
 * la explica en palabras de finca y REMITE al boletín de la Mesa Técnica
 * Agroclimática (MTA) departamental y a Fenalce para la ventana de siembra.
 *
 * REGLA ANTI-ALUCINACIÓN: este archivo solo contiene conocimiento DURABLE y
 * citado (qué significa cada fase ENSO, la regla agronómica institucional, el
 * catálogo de boletines oficiales). NADA de pronósticos concretos: esos CADUCAN
 * y se leen del boletín vigente. Las cifras coyunturales (probabilidades, mm por
 * municipio) son SLOTS grounded-pendiente que se remiten a la fuente, no se
 * inventan aquí.
 *
 * Fuentes (ver deepresearch/2026-07-04-cultivos-clima-nacional-CO.md, Parte B):
 *   IDEAM [R32-R37], FAO/MADR Mesas Técnicas Agroclimáticas [R38-R40],
 *   Fenalce agroclimatología [R41-R42], impactos ENSO [R32-R35].
 */

// UN solo formato de mes para todo el módulo (CLIMA-R7): «nov–dic de 2026».
import { mesesEsCO } from '../utils/fechaEsCO.js';

export const ESTADO_GROUNDED_PENDIENTE = 'grounded_pendiente';

/* ── Pilares del módulo (pestañas) ────────────────────────────────────── */
export const PILARES_CLIMA = [
  { id: 'que_viene', titulo: '¿Qué viene?', descripcion: 'El estado del clima ahora' },
  { id: 'que_hacer', titulo: 'Qué hacer', descripcion: 'Según la fase' },
  { id: 'donde_mirar', titulo: 'Dónde mirar', descripcion: 'Los boletines' },
];

/* ── PILAR 1 · ¿Qué viene? — lectura de cada fase ENSO ─────────────────── */
/**
 * Qué significa cada fase del ciclo ENSO para la finca. Conocimiento durable y
 * citado (IDEAM, Fenalce). Se cruza con la fase EN VIVO de ensoService — aquí
 * NO se decide qué fase es, solo qué implica.
 * Clave = familia ENSO de ensoContext.ensoFamily: 'nino' | 'nina' | 'neutral'.
 */
export const LECTURA_ENSO = Object.freeze({
  nino: {
    titulo: 'El Niño: más sol, menos lluvia',
    resumen:
      'En fase El Niño el país tiende a llover menos y calentar más. Sube el riesgo de sequía, de incendio y de que el agua no alcance para el riego.',
    senales: [
      'Aguaceros más tardíos o más flojos de lo normal.',
      'Días más calurosos y quebradas con menos caudal.',
      'En el altiplano frío, cielo despejado de noche = más riesgo de helada.',
    ],
    regla:
      'Siembre material precoz y de menor necesidad de agua. Guarde agua desde ya y refuerce el riego.',
    fuente: 'IDEAM · Fenalce (boletín ENSO)',
  },
  nina: {
    titulo: 'La Niña: más lluvia',
    resumen:
      'En fase La Niña llueve más de lo normal. El problema pasa a ser el exceso de agua: encharcamiento, hongos y enfermedades en la mata.',
    senales: [
      'Lluvias más largas y fuertes; suelos que no alcanzan a secar.',
      'Más gota, mildiu y hongos en papa, café y hortalizas.',
      'Riesgo de deslizamiento en ladera y de anegar el lote.',
    ],
    regla:
      'Prepare el drenaje y las camas altas. Vigile hongos y cuide maíz, fríjol y soya, que sufren con el agua parada.',
    fuente: 'IDEAM · Fenalce (boletín ENSO)',
  },
  neutral: {
    titulo: 'Neutral: ni Niño ni Niña marcados',
    resumen:
      'El ciclo ENSO está en fase neutral: el clima sigue el patrón normal de su región (dos temporadas de lluvia en los Andes, una en llanos y Caribe). Es el momento de planear con calma.',
    senales: [
      'Lluvias dentro de lo esperado para la época.',
      'Buen momento para revisar el calendario de siembra por región.',
      'Conviene mirar si el IDEAM anuncia vigilancia de Niño o de Niña.',
    ],
    regla:
      'Siembre al ritmo normal de su región, apenas se estabilicen las primeras lluvias. Mantenga el ojo en el boletín por si cambia la fase.',
    fuente: 'IDEAM (boletín de seguimiento ENSO)',
  },
});

/* ── PILAR 2 · Qué hacer — acciones por fase ENSO ─────────────────────── */
/**
 * Medidas accionables por fase. Regla institucional del grounding [R34][R42]:
 *   El Niño → materiales precoces y de menor demanda hídrica; reforzar agua.
 *   La Niña → manejo de exceso de agua, drenaje y enfermedades.
 */
export const ACCIONES_ENSO = Object.freeze({
  nino: [
    { emoji: '🌱', titulo: 'Variedad precoz', detalle: 'Elija material que madure rápido y aguante seco: menos días en el lote, menos exposición a la sequía.' },
    { emoji: '💧', titulo: 'Guarde agua desde ya', detalle: 'Coseche lluvia mientras todavía cae y cuide el nacimiento. En verano cada caneca cuenta.' },
    { emoji: '🌾', titulo: 'Mulch (hojarasca o pasto seco) y sombrío', detalle: 'Cubra el suelo con hojarasca o pasto seco para que no se le vaya la humedad.' },
    { emoji: '🔥', titulo: 'Ojo con el fuego', detalle: 'Con todo seco, una quema se sale de control fácil. Haga rondas cortafuego y evite quemar.' },
  ],
  nina: [
    { emoji: '🚰', titulo: 'Drenaje al día', detalle: 'Destape zanjas y canales antes del aguacero. Agua parada pudre la raíz.' },
    { emoji: '🛏️', titulo: 'Camas altas', detalle: 'Siembre en eras levantadas para que la mata no quede con los pies en el barro.' },
    { emoji: '🍄', titulo: 'Vigile hongos', detalle: 'Con humedad se disparan gota, mildiu y roya. Revise seguido y actúe temprano.' },
    { emoji: '⛰️', titulo: 'Cuide la ladera', detalle: 'En pendiente, barreras vivas y coberturas para que la lluvia no le lave el suelo.' },
  ],
  neutral: [
    { emoji: '🗓️', titulo: 'Siembre a tiempo', detalle: 'Arranque apenas se estabilicen las primeras lluvias de su región; no adelante ni atrase por costumbre.' },
    { emoji: '📻', titulo: 'Siga el boletín', detalle: 'Revise el boletín ENSO del IDEAM: si empieza vigilancia de Niño o de Niña, ajuste el plan.' },
    { emoji: '🌱', titulo: 'Diversifique', detalle: 'Mezclar variedades y ciclos reparte el riesgo si el clima cambia a mitad de temporada.' },
    { emoji: '💧', titulo: 'Deje lista el agua', detalle: 'Tenga el sistema de riego y de cosecha de lluvia a punto para cualquiera de los dos escenarios.' },
  ],
});

/**
 * La regla accionable insignia del grounding, resumida en una línea por fase.
 * La usa el encabezado del pilar "Qué hacer".
 */
export const REGLA_INSIGNIA = Object.freeze({
  nino: 'El Niño → material precoz y de menor necesidad de agua.',
  nina: 'La Niña → manejo del exceso de agua: drenaje y enfermedades.',
  neutral: 'Neutral → siembre al ritmo normal de su región y siga el boletín.',
});

/* ── CHECKLIST CONTEXTUAL · fase ENSO × piso térmico ─────────────────────
 * Una sola lista de preparación, priorizada por el riesgo dominante de la
 * finca. En frío y páramo, El Niño conserva la regla de ahorro de agua pero
 * pone primero la vigilancia de mínimas y la preparación ante helada nocturna.
 * Sin piso confirmado no se atribuye un riesgo térmico concreto.
 */
/* eslint-disable chagra-i18n/no-hardcoded-spanish -- copy UI es-CO, deuda de i18n (messages.js) pendiente igual que el resto del módulo */
const CHECKLIST_NINO_AGUA = Object.freeze([
  { emoji: '💧', t: 'Cosechar y guardar agua', d: 'Llene reservorios y aljibes mientras aún cae agua: en el pico seco cada caneca cuenta.' },
  { emoji: '🌾', t: 'Mulch (hojarasca o pasto seco) y sombrío', d: 'Cubra el suelo con hojarasca para conservar la humedad.' },
  { emoji: '🌱', t: 'Variedades precoces y rústicas', d: 'Elija material que madure rápido y aguante seco: menos días expuesto a la sequía.' },
  { emoji: '🔥', t: 'Rondas cortafuego', d: 'Con todo seco una quema se sale de control. Haga cortafuegos y evite quemar.' },
]);

const CHECKLIST_NINO_FRIO = Object.freeze([
  { emoji: '❄️', t: 'Revise las mínimas antes de cada madrugada', d: 'En piso frío o páramo, el cielo despejado puede enfriar más la noche. Consulte el pronóstico local y no trate una helada como un dato seguro de El Niño.' },
  { emoji: '💧', t: 'Agua contra la helada: consulte antes', d: 'Revise con un técnico si su sistema y su reserva de agua sirven para protección contra heladas. Una aspersión que se corta antes de tiempo o con poca agua hace más daño que no regar.' },
  { emoji: '🌾', t: 'Proteja el suelo y los cultivos sensibles', d: 'Conserve cobertura y priorice material precoz de menor demanda de agua para reducir la exposición a la temporada seca.' },
  { emoji: '📻', t: 'Siga el boletín de su zona', d: 'La fase ENSO da contexto, pero la decisión de esta madrugada depende de la mínima y la alerta local.' },
]);

const CHECKLIST_LLUVIA = Object.freeze([
  { emoji: '🚰', t: 'Drenaje al día', d: 'Destape zanjas y canales antes del aguacero. Agua parada pudre la raíz.' },
  { emoji: '🛏️', t: 'Camas altas', d: 'Siembre en eras levantadas para que la mata no quede con los pies en el barro.' },
  { emoji: '🍄', t: 'Vigile hongos', d: 'Con humedad se disparan gota, mildiu y roya. Revise seguido y actúe temprano.' },
  { emoji: '⛰️', t: 'Cuide la ladera', d: 'En pendiente, barreras vivas y coberturas para que la lluvia no le lave el suelo.' },
]);

const CHECKLIST_NEUTRAL = Object.freeze([
  { emoji: '🗓️', t: 'Siembre a tiempo', d: 'Arranque apenas se estabilicen las primeras lluvias de su región; no adelante ni atrase por costumbre.' },
  { emoji: '📻', t: 'Siga el boletín', d: 'Revise el boletín ENSO del IDEAM: si empieza vigilancia de Niño o de Niña, ajuste el plan.' },
  { emoji: '🌱', t: 'Diversifique', d: 'Mezclar variedades y ciclos reparte el riesgo si el clima cambia a mitad de temporada.' },
  { emoji: '💧', t: 'Deje lista el agua', d: 'Tenga el sistema de riego y de cosecha de lluvia a punto para cualquiera de los dos escenarios.' },
]);

export const REGLA_INSIGNIA_POR_PISO = Object.freeze({
  ninoFrio: 'En piso frío o páramo, El Niño: vigile las mínimas y cuide el agua; la protección contra helada, revísela con un técnico.',
  nino: REGLA_INSIGNIA.nino,
  nina: REGLA_INSIGNIA.nina,
  neutral: REGLA_INSIGNIA.neutral,
});

const SU_PISO = Object.freeze({ frio: 'su piso frío', paramo: 'su piso de páramo', calido: 'su piso cálido', templado: 'su piso templado' });

/** «su piso frío», «su piso de páramo»…; null si no se conoce el piso. */
export function suPisoTexto(piso) {
  return SU_PISO[piso] || null;
}

/** Con el piso conocido, la regla de El Niño en frío le habla a SU piso. */
export function reglaInsigniaNinoFrio(piso) {
  const su = suPisoTexto(piso);
  return su ? `En ${su}, El Niño: vigile las mínimas y cuide el agua; la protección contra helada, revísela con un técnico.` : REGLA_INSIGNIA_POR_PISO.ninoFrio;
}

export function checklistPreparacion(fase, piso) {
  if (fase === 'nino' && (piso === 'frio' || piso === 'paramo')) {
    const su = suPisoTexto(piso);
    return CHECKLIST_NINO_FRIO.map((item, i) => (i === 0 ? { ...item, d: item.d.replace('En piso frío o páramo', `En ${su}`) } : item));
  }
  if (fase === 'nino') return CHECKLIST_NINO_AGUA;
  if (fase === 'nina') return CHECKLIST_LLUVIA;
  return CHECKLIST_NEUTRAL;
}
/* eslint-enable chagra-i18n/no-hardcoded-spanish */

/* ── PILAR 3 · Dónde mirar — catálogo de boletines oficiales ──────────── */
/**
 * Los productos oficiales que Chagra ayuda a leer (no reemplaza). Cada uno con
 * su frecuencia, para qué sirve y dónde consultarlo. URLs de fuentes públicas
 * institucionales (IDEAM / MADR-FAO / Fenalce).
 *
 * MIGRACIÓN IDEAM (verificada HTTP 200 el 2026-09-23): el portal ideam.gov.co
 * abandonó las rutas Liferay `/web/...` (puerto 80 en timeout y 404 en https)
 * por un sitio Drupal con secciones en `/sala-de-prensa/boletines/<Boletín>`.
 * Las URLs van percent-encoded (formato exacto que emite el HTML del sitio).
 */
export const BOLETINES_IDEAM = Object.freeze([
  {
    id: 'agrometeorologico',
    nombre: 'Boletín Semanal para el Sector Agrícola (BSA)',
    frecuencia: 'semanal',
    para: 'El pronóstico de lluvia de la semana por departamento: para decidir labores, riego y qué día no llueve. Sale los lunes.',
    emisor: 'IDEAM',
    url: 'https://www.ideam.gov.co/sala-de-prensa/boletines/Bolet%C3%ADn-Semanal-para-el-Sector-Agr%C3%ADcola-%28BSA%29',
  },
  {
    id: 'agroclimatico',
    nombre: 'Boletín Agroclimático Nacional',
    frecuencia: 'mensual',
    para: 'Predicción del trimestre que viene con recomendaciones por cultivo. Lo hace la Mesa Técnica Agroclimática (MADR + FAO + IDEAM).',
    emisor: 'IDEAM · MADR · FAO',
    url: 'https://www.ideam.gov.co/sala-de-prensa/boletines/Bolet%C3%ADn-agroclim%C3%A1tico-nacional',
  },
  {
    id: 'enso',
    nombre: 'Predicción climática · seguimiento ENSO',
    frecuencia: 'mensual',
    para: 'La fase oficial El Niño / La Niña / Neutral vigente y el pronóstico del mes. Es la fuente de verdad de "qué viene".',
    emisor: 'IDEAM',
    url: 'https://www.ideam.gov.co/sala-de-prensa/boletines/Bolet%C3%ADn-de-predicci%C3%B3n-clim%C3%A1tica',
  },
]);

/**
 * Mesas Técnicas Agroclimáticas (MTA): infraestructura institucional existente
 * (8 mesas, 36 cultivos, ~631.000 productores) [R38]. Chagra REMITE a la MTA
 * del departamento del usuario para la ventana de siembra local.
 */
export const MTA_INFO = Object.freeze({
  titulo: 'Mesa Técnica Agroclimática (MTA)',
  descripcion:
    'Reunión trimestral donde científicos, técnicos y campesinos leen juntos el pronóstico y sacan las medidas por cultivo para cada departamento. De ahí sale el Boletín Agroclimático de su región.',
  coordinacion: 'MADR + FAO + IDEAM, con ICA, AGROSAVIA, Cenicafé y los gremios.',
  fuente: 'FAO Colombia · MADR (Mesas Técnicas Agroclimáticas)',
});

/**
 * Nombre humano de la mesa/boletín por región natural (para remitir según el
 * perfil). La región se infiere con ensoContext.regionFromProfile.
 */
export const MTA_POR_REGION = Object.freeze({
  andina: 'Mesa Técnica Agroclimática de la región Andina',
  caribe: 'Mesa Técnica Agroclimática del Caribe',
  pacifico: 'Mesa Técnica Agroclimática del Pacífico',
  orinoquia: 'Mesa Técnica Agroclimática de la Orinoquía',
  amazonia: 'Mesa Técnica Agroclimática de la Amazonía',
});

/** Fenalce: pronóstico a 3 meses para cereales y leguminosas [R41][R42]. */
export const FENALCE_INFO = Object.freeze({
  titulo: 'Fenalce, agroclimatología',
  descripcion:
    'Consulte las orientaciones para cereales y leguminosas de su región. Confirme que el boletín corresponde al cultivo, al piso térmico y a la temporada de su finca.',
  url: 'https://www.fenalce.co/areas-estrategicas/agroclimatologia-y-agrometereologia/',
  fuente: 'Fenalce (área de agroclimatología y agrometeorología)',
});

// Intersección conservadora con public/grafo-relations.json, _piso_termico.pisos
// (export AGE): cereales/leguminosas representativos, no lista de aptitud exhaustiva.
// Si el grafo no respalda un ejemplo para el piso, se usa la descripción general.
export const FENALCE_CULTIVOS_POR_PISO = Object.freeze({
  calido: Object.freeze(['maíz']),
  frio: Object.freeze(['fríjol']),
});

/**
 * Lluvia mensual por municipio (mm) — SLOT grounded-pendiente. Igual que el
 * módulo de agua: llega por el pipeline de clima (IDEAM por estación/municipio).
 * Mientras tanto, el módulo REMITE al boletín, no inventa el número.
 */
export const LLUVIA_MENSUAL_ZONA = Object.freeze({
  estado: ESTADO_GROUNDED_PENDIENTE,
  valor: null,
  fuentePrevista: 'IDEAM — promedios mensuales de precipitación por municipio (pipeline clima Chagra)',
});

/**
 * Probabilidad de transición de fase (%) por trimestre — SLOT grounded-pendiente
 * en producción: CADUCA. El respaldo estático vive en ensoContext.ENSO_WATCH_2026;
 * el número vigente se lee del boletín ENSO, no se cachea aquí.
 */
export const PROBABILIDAD_TRANSICION = Object.freeze({
  estado: ESTADO_GROUNDED_PENDIENTE,
  valor: null,
  fuentePrevista: 'IDEAM / NOAA CPC — boletín ENSO vigente (las probabilidades caducan)',
});

/* ── FUENTES EN VIVO (mirror de fuentes-vivas.json / dr-clima-refresh.sh) ──
 *
 * URLs oficiales de SECCIÓN: cada una LISTA el boletín vigente de su tipo, así
 * que enlazar aquí = enlazar a lo ÚLTIMO EN VIVO, no a un snapshot. Es el espejo
 * en la app de `documentación interna`,
 * que el timer `dr-clima-refresh.sh` (systemd-user, semanal) mantiene fresco.
 * NO son deep-links a un PDF fechado a propósito: un PDF caduca, la sección no.
 *
 * Re-verificadas HTTP 200 el 2026-09-23 tras la migración del portal IDEAM
 * (rutas `/web/...` Liferay → secciones `/sala-de-prensa/boletines/` en Drupal;
 * ver evidencia interna). El sitio nuevo expone además una
 * URL ESTABLE al último ejemplar de cada boletín (`/boletines/ultimo/<Boletín>`),
 * que siempre lista UN solo archivo: el más reciente — es la puerta de ingesta.
 *
 * RETIRADA por AC3 (enlace roto confirmado el 2026-09-23, sin equivalente
 * confirmado): `upra_boletines` (https://upra.gov.co/web/guest/boletines-
 * agroclimaticos → 404; la UPRA solo ofrece hoy /es-co/sala-de-prensa/
 * boletines-y-estadisticas, una sala general, no la sección agroclimática).
 * Se retira en vez de dejar un 404; se puede reintroducir con URL verificada.
 */
export const FUENTES_VIVAS = Object.freeze({
  actualizado: '2026-09-23',
  ideam_prediccion_climatica: 'https://www.ideam.gov.co/sala-de-prensa/boletines/Bolet%C3%ADn-de-predicci%C3%B3n-clim%C3%A1tica',
  ideam_agroclimatico_nacional: 'https://www.ideam.gov.co/sala-de-prensa/boletines/Bolet%C3%ADn-agroclim%C3%A1tico-nacional',
  ideam_enandes_andina: 'https://www.ideam.gov.co/sala-de-prensa/boletines/Boletines-agroclim%C3%A1ticos-ENANDES',
  ideam_bsa_semanal: 'https://www.ideam.gov.co/sala-de-prensa/boletines/Bolet%C3%ADn-Semanal-para-el-Sector-Agr%C3%ADcola-%28BSA%29',
  // URL estable al ÚLTIMO BSA publicado (siempre lista un solo PDF, el vigente):
  // verificada 200 el 2026-09-23 con bam_38 (21-sep-2026) como único archivo.
  ideam_bsa_ultimo: 'https://www.ideam.gov.co/sala-de-prensa/boletines/ultimo/Bolet%C3%ADn-Semanal-para-el-Sector-Agr%C3%ADcola-%28BSA%29',
  mta_region_andina: 'https://ccafs.cgiar.org/es/boletin-agroclimatico-local',
  // Agronet migró /agroclima/Paginas (404) a esta sección de boletines
  // territoriales por departamento (verificada 200 el 2026-09-23).
  agronet_agroclima: 'https://www.agronet.gov.co/boletines-agroclimaticos',
  // NOAA CPC ENSO Diagnostic Discussion (mensual) y tabla ONI. Servidor estático
  // (no JS-SPA): verificadas HTTP 200 el 2026-08-23. La discusión mensual es el
  // "mes a mes" ENSO oficial; ONI_v5.php ya venía verificada en institutionalSources.
  noaa_enso_disc: 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml',
  noaa_oni: 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/ONI_v5.php',
  ciifen: 'https://www.ciifen.org',
});

/* Calendario de referencia 2026–2027 heredado. No es evidencia de la fase
 * actual ni un pronóstico actualizado: la UI lo presenta como escenario.
 * Los porcentajes, cuando existen, se leen separadamente del snapshot.
 * Las acciones son orientaciones generales del piso frío andino. */
export const ENSO_CALENDARIO_2026_27 = Object.freeze([
  {
    id: 'fortalecimiento',
    periodo: mesesEsCO(8, 9, 2026),
    titulo: 'Fortaleciéndose',
    fase: 'nino',
    narrativa:
      'Si El Niño se fortalece, conviene preparar la finca. Este tramo del calendario no confirma la fase observada.',
    accionCultivo:
      'Papa y hortaliza del altiplano: empiece a reservar agua y revise con un técnico si su sistema y su reserva de agua sirven para protección contra heladas. Elija variedades precoces para la siembra de segunda.',
  },
  {
    id: 'pico',
    // El intervalo de la fila y el selector incluyen octubre. La ventana de
    // pico del escenario se distingue del trimestre completo.
    periodo: mesesEsCO(10, 12, 2026),
    titulo: 'Pico',
    fase: 'nino',
    narrativa:
      'Ante un episodio intenso, revise el agua disponible y las mínimas nocturnas. Octubre está incluido; la mayor intensidad puede concentrarse en noviembre y diciembre.',
    accionCultivo:
      'Papa: máximo riesgo de helada y de sequía. Consulte la mínima local cada noche. Antes de usar aspersión contra la helada, revise con un técnico si su sistema y su agua sirven: solo ayuda si es un sistema diseñado para eso y con agua para toda la noche, y si se interrumpe antes de tiempo, el daño puede aumentar. Ponga mulch (hojarasca o pasto seco) y no arriesgue siembras tardías sensibles. Pastos: guarde forraje y baje la carga animal.',
  },
  {
    id: 'persistencia',
    periodo: mesesEsCO(1, 3, 2027),
    titulo: 'Se sostiene fuerte',
    fase: 'nino',
    narrativa:
      'Si el episodio persiste, mantenga la preparación. El debilitamiento planteado para este tramo requiere confirmación en los boletines de la temporada.',
    accionCultivo:
      'Planee la siembra de la primera temporada (arranca ~marzo) con material precoz; no adelante por costumbre: espere a que se estabilicen las primeras lluvias.',
  },
  {
    id: 'transicion',
    periodo: mesesEsCO(4, 6, 2027),
    titulo: 'Se alivia',
    fase: 'neutral',
    narrativa:
      'La transición a Neutral es un escenario de referencia, no una fase confirmada por este calendario. Consulte el dato disponible antes de cambiar el manejo.',
    accionCultivo:
      'Vuelva al ritmo normal del altiplano, con sus dos temporadas de lluvia al año, pero con el ojo en el boletín: si tras el alivio el IDEAM abre vigilancia de La Niña, prepare drenaje para exceso de agua.',
  },
]);

/**
 * Resumen "cuándo se alivia" para la pestaña El Niño. Las probabilidades
 * vigentes se leen del snapshot; este resumen conserva una única ventana de pico.
 */
export const ENSO_TRANSICION = Object.freeze({
  // UNA sola ventana de pico en toda la pestaña (CLIMA-R7): la que citan los
  // boletines de la fuente de abajo.
  pico: mesesEsCO(11, 12, 2026),
  aliviaDesde: mesesEsCO(2, 3, 2027),
  transicionNeutral: mesesEsCO(4, 6, 2027),
  laNinaConfirmada: false,
  fuente: 'NOAA CPC · IDEAM · CIIFEN',
});

/** Devuelve probabilidades vigentes solo si el snapshot trae tres porcentajes y una fecha. */
export function probabilidadesEnsoSnapshot(snapshot) {
  if (!snapshot || snapshot.stale === true) return null;
  const enso = snapshot?.enso_status;
  const probabilidades = enso?.ideam_probabilities || enso?.ideam_probabilidades;
  if (!probabilidades || typeof probabilidades !== 'object') return null;
  const claves = ['nino_pct', 'neutral_pct', 'nina_pct'];
  if (!claves.every((key) => Number.isFinite(probabilidades[key])
    && probabilidades[key] >= 0 && probabilidades[key] <= 100)) return null;
  const fechaDelDato = probabilidades.published_at || probabilidades.updated_at || probabilidades.observed_at || probabilidades.date || probabilidades.fecha
    || enso.probabilities_updated_at || enso.probabilities_date || enso.observed_at || enso.date || enso.fecha;
  const fecha = fechaDelDato || snapshot.fetched_at;
  if (!fecha || !Number.isFinite(new Date(fecha).getTime())) return null;
  const fuentes = Array.isArray(enso.sources) ? enso.sources.filter((source) => typeof source === 'string' && /NOAA|IDEAM|IRI|CIIFEN/i.test(source)) : [];
  return {
    probabilidades,
    fecha,
    etiquetaFecha: fechaDelDato ? 'dato del' : 'snapshot recibido el',
    fuente: fuentes.join(' · ') || 'Fuente ENSO del snapshot',
  };
}

/* ── PESTAÑA EL NIÑO · VENTANA DE SIEMBRA (Boletín MTA región Andina) ────────
 *
 * REGLA DURA (deflección honesta, patrón SIPSA/precioReferencia): el cross-check
 * DR (2026-08-23-MTA-andina-ventana-siembra.md) es EXPLÍCITO en que NO existe una
 * recomendación de siembra específica y vigente publicada para agosto de 2026 en
 * el altiplano cundiboyacense — el boletín territorial de Cundinamarca más
 * reciente hallado es de OCT-2025, y el mes-a-mes se deriva del Boletín
 * Agroclimático Nacional / BSA. Por eso la ventana VIGENTE es grounded_pendiente:
 * se lee del boletín MTA región Andina EN VIVO (deep-link), NO se inventa aquí.
 *
 * Lo DURABLE y citado que sí mostramos: quién emite el boletín, cada cuánto sale,
 * qué productos existen (con sus fechas), el régimen bimodal del altiplano y el
 * matiz ENSO (bajo El Niño la segunda temporada de lluvias puede llegar más tarde
 * o más floja — ensoContext.andina). El número/fecha exacta de siembra vive en la
 * fuente, no aquí.
 */
export const MTA_VENTANA_SIEMBRA = Object.freeze({
  zona: 'Altiplano cundiboyacense (clima frío, con dos temporadas de lluvia al año)',
  emisor: 'MADR · UPRA · IDEAM · FAO · Gobernación de Cundinamarca',
  cadencia: 'Boletín agroclimático mensual + Boletín Semanal para el Sector Agrícola (BSA) del IDEAM, los lunes.',
  // Marco DURABLE del régimen bimodal (aprox.): sirve para orientar, no reemplaza
  // la fecha del boletín. El altiplano tiene dos temporadas de lluvia y se siembra
  // al arrancar cada una.
  regimenBimodal:
    `El altiplano tiene dos temporadas de lluvia: la primera hacia ${mesesEsCO(3, 5)} y la segunda hacia ${mesesEsCO(9, 11)}. La siembra suele arrancar al comienzo de cada una.`,
  matizEnso:
    'Con El Niño fortaleciéndose, la segunda temporada (sep–nov) puede estar llegando más tarde o venir más floja: conviene sembrar temprano y reservar agua.',
  // La ventana VIGENTE NO se hardcodea: se lee del boletín en vivo.
  ventanaVigente: Object.freeze({
    estado: ESTADO_GROUNDED_PENDIENTE,
    valor: null,
    fuentePrevista: 'Boletín MTA región Andina / Agronet · IDEAM ENANDES (se lee del boletín vigente)',
  }),
  // Productos oficiales existentes con su última fecha conocida. URLs
  // re-verificadas HTTP 200 el 2026-09-23 (migración del portal IDEAM y de
  // Agronet; ver evidencia interna).
  productos: Object.freeze([
    { nombre: 'Boletín Agroclimático Nacional (No. 136)', ultima: 'Dato antiguo: mayo–julio de 2026', url: 'https://www.ideam.gov.co/sala-de-prensa/boletines/Bolet%C3%ADn-agroclim%C3%A1tico-nacional' },
    { nombre: 'Boletín de Predicción Climática', ultima: 'Dato antiguo: publicado el 10 de agosto de 2026', url: 'https://www.ideam.gov.co/sala-de-prensa/boletines/Bolet%C3%ADn-de-predicci%C3%B3n-clim%C3%A1tica' },
    { nombre: 'Boletín Semanal para el Sector Agrícola (BSA)', ultima: 'semanal (lunes)', url: 'https://www.ideam.gov.co/sala-de-prensa/boletines/Bolet%C3%ADn-Semanal-para-el-Sector-Agr%C3%ADcola-%28BSA%29' },
    { nombre: 'Boletín Agroclimático ENANDES · región Andina', ultima: 'Dato antiguo: septiembre de 2025', url: 'https://www.ideam.gov.co/sala-de-prensa/boletines/Boletines-agroclim%C3%A1ticos-ENANDES' },
    { nombre: 'Boletín Territorial Agroclimático de Cundinamarca', ultima: 'Dato antiguo: octubre de 2025', url: 'https://www.agronet.gov.co/boletines-agroclimaticos' },
  ]),
  urlVivo: 'https://ccafs.cgiar.org/es/boletin-agroclimatico-local',
  fuente: 'MADR · FAO · IDEAM · UPRA (enlaces re-verificados el 23 de sep. de 2026)',
});

/**
 * Elige el período del calendario ENSO vigente según la fecha (para resaltar el
 * "ahora" en el timeline). Devuelve el `id` del período o null si la fecha cae
 * fuera del rango cubierto (ago-2026 → jun-2027). Puro y determinístico.
 *
 * @param {Date} [date=new Date()]
 * @returns {string|null}
 */
export function faseCalendarioActual(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const partes = new Intl.DateTimeFormat('en', { timeZone: 'America/Bogota', year: 'numeric', month: 'numeric' }).formatToParts(d);
  const ym = Number(partes.find((p) => p.type === 'year').value) * 12 + Number(partes.find((p) => p.type === 'month').value) - 1;
  const M = (y, m) => y * 12 + (m - 1); // m: 1-12
  if (ym >= M(2026, 8) && ym <= M(2026, 9)) return 'fortalecimiento';
  if (ym >= M(2026, 10) && ym <= M(2026, 12)) return 'pico';
  if (ym >= M(2027, 1) && ym <= M(2027, 3)) return 'persistencia';
  if (ym >= M(2027, 4) && ym <= M(2027, 6)) return 'transicion';
  return null;
}
