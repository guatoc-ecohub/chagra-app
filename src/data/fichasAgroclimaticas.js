/**
 * Fichas agroclimáticas verificables para el radar de cultivos.
 *
 * Un valor numérico conserva su fuente y su estado de verificación. `null`
 * significa que no se halló un valor apto para usar como umbral. Los rangos
 * son de cultivo, no pronósticos.
 */

export const FUENTES_AGROCLIMATICAS = Object.freeze({
  agrosavia_fresa: {
    titulo: 'AGROSAVIA, Manual de recomendaciones para fresa',
    url: 'https://repository.agrosavia.co/server/api/core/bitstreams/520c1539-6a3a-4d81-9fb7-948ca18d1aa3/content',
  },
  dane_granadilla: {
    titulo: 'DANE SIPSA, Demanda agroecológica de granadilla en Colombia',
    url: 'https://www.dane.gov.co/files/investigaciones/agropecuario/sipsa/Bol_Insumos_jun_2016.pdf',
  },
  agrosavia_gulupa: {
    titulo: 'AGROSAVIA, Ecología del cultivo de gulupa',
    url: 'https://repository.agrosavia.co/server/api/core/bitstreams/2063f323-e909-4304-bbbb-9b03c01c5d83/content',
  },
  agrosavia_tomate: {
    titulo: 'AGROSAVIA, Manual técnico para cultivo de tomate bajo condiciones protegidas',
    url: 'https://repository.agrosavia.co/bitstream/20.500.12324/13469/1/Ver_Documento_13469.pdf',
  },
  utadeo_espinaca: {
    titulo: 'Universidad de Bogotá Jorge Tadeo Lozano, El cultivo de la espinaca y su manejo fitosanitario en Colombia',
    url: 'https://www.utadeo.edu.co/sites/tadeo/files/node/wysiwyg/pub_49_el_cultivo_de_la_espinaca_y_su_manejo.pdf',
  },
  inia_limon: {
    titulo: 'INIA Chile / CIREN, valores umbrales de adaptabilidad de cultivos',
    url: 'https://bibliotecadigital.ciren.cl/server/api/core/bitstreams/4ddaeb6e-9053-412d-8550-886f9b6fe109/content',
  },
  uptc_guayaba: {
    titulo: 'UPTC, Ecophysiological aspects of guava (Psidium guajava L.): a review',
    url: 'https://revistas.uptc.edu.co/index.php/ciencias_horticolas/article/download/12355/10275',
  },
  agrosavia_guayaba: {
    titulo: 'AGROSAVIA, Prácticas de manejo sostenible para el cultivo de guayaba',
    url: 'https://repository.agrosavia.co/bitstream/20.500.12324/35029/7/Ver_Documento_35029.pdf',
  },
  wmo_spi: {
    titulo: 'OMM, Standardized Precipitation Index User Guide',
    url: 'https://library.wmo.int/idurl/4/55815',
  },
  ideam_mta: {
    titulo: 'IDEAM, Protocolo de elaboración del Boletín Agroclimático Nacional',
    url: 'https://www.ideam.gov.co/sites/default/files/mapa-de-procesos/gdi-pc021_protocolo_elaboracion_boletin_agrometeorologico.pdf',
  },
});

const pendiente = Object.freeze({ valor: null, fuente: null, estado: 'pendiente' });
const dato = (valor, fuente) => Object.freeze({ valor, fuente, estado: 'verificado' });
const datoNoVerificado = (valor, fuente) => Object.freeze({ valor, fuente, estado: 'no_verificado' });
const rango = (min, opt, max, fuente) => Object.freeze({ min: dato(min, fuente), opt: dato(opt, fuente), max: dato(max, fuente) });
const rangoConPendientes = (min, opt, max, fuente, pendientes = []) => Object.freeze({
  min: pendientes.includes('min') ? datoNoVerificado(min, fuente) : dato(min, fuente),
  opt: pendientes.includes('opt') ? datoNoVerificado(opt, fuente) : dato(opt, fuente),
  max: pendientes.includes('max') ? datoNoVerificado(max, fuente) : dato(max, fuente),
});

const alerta = (id, metrica, comparador, umbral, fuente, accion, umbralVerificacion = 'verificado') => Object.freeze({
  id, metrica, comparador,
  umbral: umbralVerificacion === 'no_verificado' ? datoNoVerificado(umbral, fuente) : dato(umbral, fuente),
  accion,
});

const ALERTA_SEQUIA = alerta(
  'deficit-hidrico', 'spei', '<=', -1, 'wmo_spi',
  'Revise la humedad del suelo, priorice el riego disponible y proteja el suelo con cobertura.',
  'no_verificado',
);
const ALERTA_EXCESO = alerta(
  'exceso-hidrico', 'spi', '>=', 1, 'wmo_spi',
  'Revise drenajes y el lote antes de que el exceso de agua afecte las raíces.',
  'no_verificado',
);

const VENTANA_SIEMBRA_LOCAL = Object.freeze({
  recomendacion: 'Consulte el boletín agroclimático de su región y el calendario del cultivo. Esta ficha no fija una fecha nacional.',
  fuente: 'ideam_mta',
});

/**
 * Un dato puntual con fuente respaldada, o el marcador `pendiente` cuando no
 * se halló un valor apto para usar como umbral.
 *
 * @typedef {Object} DatoAgroclimatico
 * @property {number|null} valor Valor numérico, null si está pendiente.
 * @property {string|null} fuente Clave de FUENTES_AGROCLIMATICAS, null si está pendiente.
 * @property {'verificado'|'pendiente'|'no_verificado'} estado
 */

/**
 * Rango de cultivo (no pronóstico) con mínimo, óptimo y máximo verificados.
 * Algunos rangos pueden traer `opt` o `max` como marcador `pendiente`.
 *
 * @typedef {Object} RangoAgroclimatico
 * @property {DatoAgroclimatico} min
 * @property {DatoAgroclimatico} opt
 * @property {DatoAgroclimatico} max
 * @property {string} [unidad] Solo para rangos que no son °C ni % HR (p. ej. mm/año).
 */

/**
 * @typedef {Object} FichaAgroclimaticaParams
 * @property {string} id
 * @property {string} nombre
 * @property {string} cientifico
 * @property {string[]} sinonimos
 * @property {boolean} [invernadero]
 * @property {RangoAgroclimatico} temperatura
 * @property {RangoAgroclimatico|DatoAgroclimatico} [humedad] Rango verificado o `pendiente`.
 * @property {RangoAgroclimatico|DatoAgroclimatico} [altitud] Rango verificado o `pendiente`.
 * @property {RangoAgroclimatico|DatoAgroclimatico} [precipitacion] Rango verificado o `pendiente`.
 * @property {{ nombre: string, gatillo: string, fuente: string|null, gatillo_verificacion?: 'no_verificado' }[]} [riesgos]
 * @property {object[]} [alertas] Resultados de `alerta(...)`.
 */

/** @param {FichaAgroclimaticaParams} param */
function ficha({ id, nombre, cientifico, sinonimos, invernadero = false, temperatura, humedad = pendiente, altitud = pendiente, precipitacion = pendiente, riesgos = [], alertas = [] }) {
  return Object.freeze({ id, nombre, cientifico, sinonimos: Object.freeze(sinonimos), invernadero, temperatura, humedad, altitud, precipitacion, ventanaSiembra: VENTANA_SIEMBRA_LOCAL, riesgos: Object.freeze(riesgos), alertas: Object.freeze(alertas) });
}

export const FICHAS_AGROCLIMATICAS = Object.freeze({
  fresa: ficha({
    id: 'fresa', nombre: 'Fresa', cientifico: 'Fragaria × ananassa', sinonimos: ['fresa', 'fresa-invernadero', 'frutilla'], invernadero: true,
    temperatura: rangoConPendientes(10, 18, 26, 'agrosavia_fresa', ['opt']),
    humedad: Object.freeze({ min: dato(60, 'agrosavia_fresa'), opt: datoNoVerificado(65, 'agrosavia_fresa'), max: dato(75, 'agrosavia_fresa') }),
    altitud: Object.freeze({ min: dato(1200, 'agrosavia_fresa'), opt: pendiente, max: pendiente }),
    precipitacion: Object.freeze({ min: dato(700, 'agrosavia_fresa'), opt: pendiente, max: dato(900, 'agrosavia_fresa'), unidad: 'mm/año' }),
    riesgos: [{ nombre: 'Moho gris (Botrytis cinerea)', gatillo: 'La guía recomienda monitorear patógenos fúngicos cuando la humedad relativa se aparta del rango de 60 a 75%.', fuente: 'agrosavia_fresa' }],
    alertas: [alerta('frio', 'temp_min', '<', 10, 'agrosavia_fresa', 'Proteja las plantas durante la noche y revise el daño al amanecer.'), alerta('calor', 'temp_max', '>', 26, 'agrosavia_fresa', 'Reduzca el estrés térmico con riego oportuno y manejo del invernadero.'), alerta('humedad-alta', 'humedad', '>', 75, 'agrosavia_fresa', 'Ventile y revise flores y frutos por moho gris.'), ALERTA_SEQUIA, ALERTA_EXCESO],
  }),
  granadilla: ficha({
    id: 'granadilla', nombre: 'Granadilla', cientifico: 'Passiflora ligularis', sinonimos: ['granadilla'],
    temperatura: rango(16, 17, 24, 'dane_granadilla'),
    humedad: Object.freeze({ min: dato(70, 'dane_granadilla'), opt: datoNoVerificado(75, 'dane_granadilla'), max: dato(80, 'dane_granadilla') }),
    altitud: Object.freeze({ min: dato(1700, 'dane_granadilla'), opt: dato(1900, 'dane_granadilla'), max: dato(2100, 'dane_granadilla') }),
    precipitacion: Object.freeze({ min: dato(2200, 'dane_granadilla'), opt: pendiente, max: dato(3200, 'dane_granadilla'), unidad: 'mm/año' }),
    riesgos: [{ nombre: 'Antracnosis (Colletotrichum spp.)', gatillo: 'Humedad relativa superior al rango favorece enfermedades.', fuente: 'dane_granadilla' }],
    alertas: [alerta('frio', 'temp_min', '<', 16, 'dane_granadilla', 'Revise floración y protección nocturna.'), alerta('calor', 'temp_max', '>', 24, 'dane_granadilla', 'Asegure agua y revise estrés térmico.'), alerta('humedad-alta', 'humedad', '>', 80, 'dane_granadilla', 'Mejore ventilación y revise frutos por antracnosis.'), ALERTA_SEQUIA, ALERTA_EXCESO],
  }),
  tomate_cherry: ficha({
    id: 'tomate_cherry', nombre: 'Tomate Cherry', cientifico: 'Solanum lycopersicum var. cerasiforme', sinonimos: ['tomate cherry', 'tomate-cherry', 'tomate cherry-invernadero'], invernadero: true,
    temperatura: rangoConPendientes(18, 24, 32, 'agrosavia_tomate', ['min', 'opt', 'max']),
    humedad: Object.freeze({ min: dato(65, 'agrosavia_tomate'), opt: datoNoVerificado(70, 'agrosavia_tomate'), max: dato(75, 'agrosavia_tomate') }),
    altitud: pendiente, precipitacion: pendiente,
    riesgos: [{ nombre: 'Tizón tardío (Phytophthora infestans)', gatillo: 'El ambiente húmedo favorece enfermedades criptogámicas; el radar requiere hoja mojada para elevar la prioridad.', fuente: 'agrosavia_tomate' }],
    alertas: [alerta('frio', 'temp_min', '<', 18, 'agrosavia_tomate', 'Cierre cortinas y proteja el cultivo del frío nocturno.', 'no_verificado'), alerta('calor', 'temp_max', '>', 32, 'agrosavia_tomate', 'Ventile, sombree si corresponde y mantenga riego uniforme.', 'no_verificado'), alerta('humedad-alta', 'humedad', '>', 75, 'agrosavia_tomate', 'Ventile y vigile tizones antes de mojar el follaje.'), ALERTA_SEQUIA, ALERTA_EXCESO],
  }),
  tomate: ficha({
    id: 'tomate', nombre: 'Tomate', cientifico: 'Solanum lycopersicum', sinonimos: ['tomate', 'tomate-invernadero'], invernadero: true,
    temperatura: rangoConPendientes(18, 24, 32, 'agrosavia_tomate', ['min', 'opt', 'max']),
    humedad: Object.freeze({ min: dato(65, 'agrosavia_tomate'), opt: datoNoVerificado(70, 'agrosavia_tomate'), max: dato(75, 'agrosavia_tomate') }),
    altitud: pendiente, precipitacion: pendiente,
    riesgos: [{ nombre: 'Tizón tardío (Phytophthora infestans)', gatillo: 'El ambiente húmedo favorece enfermedades criptogámicas; el radar requiere hoja mojada para elevar la prioridad.', fuente: 'agrosavia_tomate' }],
    alertas: [alerta('frio', 'temp_min', '<', 18, 'agrosavia_tomate', 'Cierre cortinas y proteja el cultivo del frío nocturno.', 'no_verificado'), alerta('calor', 'temp_max', '>', 32, 'agrosavia_tomate', 'Ventile, sombree si corresponde y mantenga riego uniforme.', 'no_verificado'), alerta('humedad-alta', 'humedad', '>', 75, 'agrosavia_tomate', 'Ventile y vigile tizones antes de mojar el follaje.'), ALERTA_SEQUIA, ALERTA_EXCESO],
  }),
  espinaca: ficha({
    id: 'espinaca', nombre: 'Espinaca', cientifico: 'Spinacia oleracea', sinonimos: ['espinaca'],
    temperatura: rangoConPendientes(8.8, 16, 29.2, 'utadeo_espinaca', ['min', 'opt', 'max']), humedad: pendiente,
    altitud: Object.freeze({ min: datoNoVerificado(1430, 'utadeo_espinaca'), opt: pendiente, max: datoNoVerificado(2800, 'utadeo_espinaca') }),
    precipitacion: Object.freeze({ min: datoNoVerificado(1300, 'utadeo_espinaca'), opt: pendiente, max: datoNoVerificado(1600, 'utadeo_espinaca'), unidad: 'mm/año' }),
    riesgos: [{ nombre: 'Floración prematura', gatillo: 'La fuente citada no estuvo disponible para confirmar esta relación.', fuente: 'utadeo_espinaca', gatillo_verificacion: 'no_verificado' }],
    alertas: [alerta('frio', 'temp_min', '<', 8.8, 'utadeo_espinaca', 'Revise daño por frío y el crecimiento de las hojas.', 'no_verificado'), alerta('calor', 'temp_max', '>', 29.2, 'utadeo_espinaca', 'Proteja del calor y coseche oportunamente para evitar elevación.', 'no_verificado'), ALERTA_SEQUIA, ALERTA_EXCESO],
  }),
  gulupa: ficha({
    id: 'gulupa', nombre: 'Gulupa', cientifico: 'Passiflora edulis f. edulis', sinonimos: ['gulupa', 'gulupa-invernadero'], invernadero: true,
    temperatura: Object.freeze({ min: dato(10, 'agrosavia_gulupa'), opt: datoNoVerificado(16.5, 'agrosavia_gulupa'), max: dato(24, 'agrosavia_gulupa') }),
    humedad: Object.freeze({ min: dato(80, 'agrosavia_gulupa'), opt: datoNoVerificado(87, 'agrosavia_gulupa'), max: dato(94, 'agrosavia_gulupa') }),
    altitud: Object.freeze({ min: dato(1600, 'agrosavia_gulupa'), opt: datoNoVerificado(1950, 'agrosavia_gulupa'), max: dato(2500, 'agrosavia_gulupa') }),
    precipitacion: Object.freeze({ min: dato(1300, 'agrosavia_gulupa'), opt: datoNoVerificado(1550, 'agrosavia_gulupa'), max: dato(1800, 'agrosavia_gulupa'), unidad: 'mm/año' }),
    riesgos: [{ nombre: 'Enfermedades fúngicas en fruto', gatillo: 'El exceso de lluvias favorece enfermedades fúngicas, especialmente en el fruto.', fuente: 'agrosavia_gulupa' }],
    alertas: [alerta('frio', 'temp_min', '<', 10, 'agrosavia_gulupa', 'Proteja el cultivo del frío y revise el vigor de las plantas.'), alerta('calor', 'temp_max', '>', 24, 'agrosavia_gulupa', 'Asegure agua y revise estrés térmico en floración.'), alerta('humedad-alta', 'humedad', '>', 94, 'agrosavia_gulupa', 'Mejore la ventilación y revise los frutos por enfermedades fúngicas.'), ALERTA_SEQUIA, ALERTA_EXCESO],
  }),
  limon: ficha({
    id: 'limon', nombre: 'Limón', cientifico: 'Citrus × limon', sinonimos: ['limon', 'limón', 'limon-invernadero', 'limón-invernadero'], invernadero: true,
    temperatura: Object.freeze({ min: dato(10, 'inia_limon'), opt: datoNoVerificado(21.5, 'inia_limon'), max: dato(36, 'inia_limon') }), humedad: pendiente,
    altitud: Object.freeze({ min: dato(0, 'inia_limon'), opt: pendiente, max: dato(3000, 'inia_limon') }), precipitacion: pendiente,
    riesgos: [{ nombre: 'Datos de enfermedad por clima', gatillo: 'Pendiente de fuente colombiana específica para el umbral epidemiológico.', fuente: null }],
    alertas: [alerta('frio', 'temp_min', '<', 10, 'inia_limon', 'Proteja del frío y revise daño en brotes.'), alerta('calor', 'temp_max', '>', 36, 'inia_limon', 'Revise disponibilidad de agua y estrés térmico.'), ALERTA_SEQUIA, ALERTA_EXCESO],
  }),
  guayaba: ficha({
    id: 'guayaba', nombre: 'Guayaba', cientifico: 'Psidium guajava', sinonimos: ['guayaba', 'guayaba-invernadero'], invernadero: true,
    temperatura: Object.freeze({ min: dato(15, 'uptc_guayaba'), opt: datoNoVerificado(17.3, 'uptc_guayaba'), max: dato(30, 'uptc_guayaba') }), humedad: pendiente,
    altitud: Object.freeze({ min: dato(0, 'uptc_guayaba'), opt: pendiente, max: dato(2000, 'uptc_guayaba') }),
    precipitacion: Object.freeze({ min: dato(1000, 'uptc_guayaba'), opt: pendiente, max: dato(2000, 'uptc_guayaba'), unidad: 'mm/año' }),
    riesgos: [{ nombre: 'Antracnosis (Colletotrichum spp.)', gatillo: 'La fuente citada no estuvo disponible para confirmar esta relación.', fuente: 'agrosavia_guayaba', gatillo_verificacion: 'no_verificado' }],
    alertas: [alerta('frio', 'temp_min', '<', 15, 'uptc_guayaba', 'Revise flores y frutos después de una noche fría.'), alerta('calor', 'temp_max', '>', 30, 'uptc_guayaba', 'Revise riego y estrés en floración y cuajado.'), ALERTA_SEQUIA, ALERTA_EXCESO],
  }),
});

export const FICHAS_POR_SINONIMO = Object.freeze(Object.values(FICHAS_AGROCLIMATICAS).reduce((index, ficha_) => {
  ficha_.sinonimos.forEach((sinonimo) => { index[sinonimo] = ficha_.id; });
  return index;
}, {}));

export function resolverFichaAgroclimatica(nombre) {
  const normalizado = String(nombre || '').trim().toLowerCase();
  const id = FICHAS_POR_SINONIMO[normalizado]
    || Object.entries(FICHAS_POR_SINONIMO).find(([sinonimo]) => normalizado.includes(sinonimo))?.[1];
  return id ? FICHAS_AGROCLIMATICAS[id] : null;
}

function cumple(valor, comparador, umbral) {
  if (!Number.isFinite(valor) || !Number.isFinite(umbral)) return false;
  return comparador === '<' ? valor < umbral : comparador === '<=' ? valor <= umbral : comparador === '>' ? valor > umbral : valor >= umbral;
}

/** Evalúa solo alertas cuyos datos de clima y umbrales existen. */
export function evaluarAlertasAgroclimaticas(ficha_, clima = {}) {
  if (!ficha_) return [];
  const metricas = { temp_min: clima.tempMin, temp_max: clima.tempMax, humedad: clima.humedad, spi: clima.spi, spei: clima.spei };
  return ficha_.alertas.filter((item) => cumple(metricas[item.metrica], item.comparador, item.umbral.valor));
}
