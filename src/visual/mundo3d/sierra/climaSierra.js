/*
 * climaSierra — traducción pequeña y pura del dato climático a parámetros
 * visuales de la SierraMonte3D. No inventa clima: sin señal, deja la escena
 * en su atmósfera base y no monta fenómenos.
 */
import { hayHelada } from './vendor/clima/climaPorPiso.js';

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const NUMERIC_FIELDS = [
  ['temp', ['temp', 'temperatura', 'temperatura_c']],
  ['tempMin', ['tempMin', 'minimaNocturna_c', 'temperaturaMinimaMadrugada']],
  ['tempMax', ['tempMax', 'maxima_c']],
  ['lluviaMm', ['lluviaMm', 'lluviaCantidad_mm', 'lluviaHoyMm']],
  ['lluviaProb', ['lluviaProb_pct']],
  ['viento', ['viento', 'vientoRacha_kmh', 'racha']],
  ['humedad', ['humedad', 'humedadRelativa_pct']],
  ['rachaDiasSecos', ['rachaDiasSecos']],
];

function unwrap(value) {
  return value && typeof value === 'object' && 'valor' in value ? value.valor : value;
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function freshnessOf(clima, piso) {
  if (clima?.tieneOpenMeteo && clima.stale !== true) return 'fresco';
  if (piso?.estado === 'fresco') return 'fresco';
  if (clima?.tieneOpenMeteo || piso?.estado === 'viejo') return 'viejo';
  return 'sin_lectura';
}

function sourcesFor(clima, piso) {
  return [
    { id: 'finca', freshness: clima?.tieneOpenMeteo && clima.stale !== true ? 'fresco' : 'viejo', values: clima },
    { id: 'piso', freshness: piso?.estado === 'fresco' ? 'fresco' : piso?.estado === 'viejo' ? 'viejo' : 'sin_lectura', values: piso },
  ];
}

function readPiso(piso, names) {
  const values = [piso?.datos?.actual, piso?.datos, piso];
  for (const source of values) {
    for (const name of names) {
      const value = finite(unwrap(source?.[name]));
      if (value != null) return value;
    }
  }
  return null;
}

function weatherField(name, names, sources) {
  for (const source of sources) {
    if (source.freshness !== 'fresco') continue;
    const value = finite(source.id === 'piso' ? readPiso(source.values, names) : names.map((key) => unwrap(source.values?.[key])).find((candidate) => finite(candidate) != null));
    if (value != null) {
      return Object.freeze({
        value,
        source: source.id,
        freshness: source.freshness,
        // Contrato público de la escena: cada campo conserva procedencia y
        // vigencia, además de los alias usados por consumidores existentes.
        valor: value,
        fuente: source.id,
        vigencia: source.freshness,
      });
    }
  }
  const vigencia = sources[0]?.freshness === 'viejo' || sources[1]?.freshness === 'viejo' ? 'viejo' : 'sin_lectura';
  return Object.freeze({ value: null, source: null, freshness: vigencia, valor: null, fuente: null, vigencia });
}

function alertHas(clima, pattern) {
  return Array.isArray(clima?.alertas)
    && clima.alertas.some((alerta) => pattern.test(typeof alerta === 'string' ? alerta : JSON.stringify(alerta)));
}

/**
 * Contrato único de entrada para el cielo. Cada valor conserva procedencia y
 * vigencia para que la escena no mezcle una lectura de finca con un respaldo
 * por piso ni pinte un fenómeno a partir de un dato vencido.
 */
export function contratoClimaEscena({ clima = null, climaPiso = null, simulacion = null } = {}) {
  const fuentes = sourcesFor(clima, climaPiso);
  const campos = Object.fromEntries(NUMERIC_FIELDS.map(([name, names]) => [name, weatherField(name, names, fuentes)]));
  const tieneDato = Object.values(campos).some((campo) => campo.value != null);
  const localUtilizable = fuentes.some((fuente) => fuente.freshness === 'fresco') && tieneDato;
  const base = simulacion || {};
  const estado = {
    lluvia: localUtilizable && campos.lluviaMm.value != null ? campos.lluviaMm.value >= 2 : Boolean(base.lluvia),
    niebla: localUtilizable && (clima?.niebla === true || (campos.humedad.value >= 92 && (clima?.nubosidad ?? 0) >= 80))
      ? true : Boolean(base.niebla),
    seco: localUtilizable && campos.rachaDiasSecos.value != null ? campos.rachaDiasSecos.value >= 5 : false,
    vientoFuerte: localUtilizable && campos.viento.value != null ? campos.viento.value >= 35 : false,
    helada: localUtilizable && (clima?.helada === true || (campos.tempMin.value != null && campos.tempMin.value <= 3)),
    granizo: localUtilizable && alertHas(clima, /granizo|hail/i),
  };
  const senal = simulacion ? true : localUtilizable;
  const cielo = clima || simulacion || {};
  const nubosidad = finite(cielo.nubosidad);
  const nubosidadConocida = nubosidad != null;
  const estadoDato = !senal || !nubosidadConocida
    ? 'sin-dato'
    : nubosidad < 18 ? 'conocido-despejado' : 'conocido-cubierto';
  return Object.freeze({
    senal,
    estadoDato,
    localUtilizable,
    fuenteActiva: localUtilizable ? campos.temp.source || campos.lluviaMm.source : null,
    vigencia: localUtilizable ? 'fresco' : freshnessOf(clima, climaPiso),
    campos: Object.freeze(campos),
    estados: Object.freeze(estado),
    lluvia: estado.lluvia,
    niebla: estado.niebla,
    seco: estado.seco,
    vientoFuerte: estado.vientoFuerte,
    helada: estado.helada,
    granizo: estado.granizo,
    lluviaMm: campos.lluviaMm.value,
    nubosidad,
    humedad: campos.humedad.value,
    viento: campos.viento.value,
    temp: campos.temp.value,
    tempMin: campos.tempMin.value,
    luz: base.luz || clima?.luz || 'dia',
    condicion: base.condicion || clima?.condicion || null,
  });
}

function banderaManto(search = '') {
  const query = new URLSearchParams(search);
  const explicita = query.get('mantoHelada');
  const gateHelada = query.get('helada');
  return explicita === '1' || explicita === 'true' || ['escarcha', 'negra'].includes(gateHelada);
}

/** Decide publicación DOM y montaje desde el gate único, siempre opt-in. */
export function estadoHeladaDom(clima = null, { search = '', hora = new Date().getHours() } = {}) {
  const nivel = hayHelada({
    piso: clima?.pisoTermico?.id,
    tempMin: clima?.tempMin,
    nubosidad: clima?.nubosidad,
    viento: clima?.viento,
    alertas: clima?.alertas,
    ensoFamily: clima?.ensoFamily,
    hora,
  });
  const activa = clima?.senal === true && banderaManto(search);
  const montar = activa && ['escarcha', 'negra'].includes(nivel.nivel);
  return Object.freeze({
    activa,
    nivel: montar ? nivel.nivel : null,
    intensidad: montar ? nivel.intensidad : 0,
    montar,
  });
}

export function perfilClimaSierra(clima = null) {
  const senal = clima?.senal === true;
  const nubosidadConocida = Number.isFinite(clima?.nubosidad);
  const nubosidad = nubosidadConocida ? clamp01(clima.nubosidad / 100) : null;
  const lluvia = clima?.lluvia === true;
  const niebla = clima?.niebla === true;
  const helada = clima?.helada === true;
  const viento = finite(clima?.viento);
  const estadoDato = !senal || !nubosidadConocida
    ? 'sin-dato'
    : nubosidad < 0.18 ? 'conocido-despejado' : 'conocido-cubierto';
  // La ausencia de nubosidad no es 0 %. Reservamos una cobertura intermedia
  // para que el cielo sin dato no se lea como despejado ni como cubierto.
  const coberturaBase = nubosidad ?? 0.34;
  const cobertura = senal
    ? Math.max(coberturaBase, lluvia ? 0.86 : 0, niebla ? 0.9 : 0)
    : 0.34;
  const coberturaNubes = estadoDato === 'conocido-cubierto' ? cobertura : 0;

  return Object.freeze({
    senal,
    estadoDato,
    cobertura,
    coberturaNubes,
    viento,
    movimientoNubes: estadoDato !== 'sin-dato' && viento != null ? clamp01(viento / 45) : 0,
    lluvia,
    niebla,
    helada,
    nubes: estadoDato === 'conocido-cubierto' && cobertura >= 0.18
      ? Math.max(2, Math.round(3 + cobertura * 11)) : 0,
    intensidadLluvia: lluvia
      ? clima.lluviaMm == null ? 0.62 : clamp01(Math.max(0.25, clima.lluviaMm / 18))
      : 0,
    intensidadNiebla: niebla
      ? nubosidad == null ? 0.7 : clamp01(Math.max(0.35, nubosidad))
      : 0,
    // Sin lectura no se pinta una condición meteorológica. La luz baja y
    // neutral es una marca de ausencia, no una predicción de nubosidad.
    luzIntensidad: senal ? 1 - cobertura * 0.46 : 0.58,
  });
}

export default perfilClimaSierra;
