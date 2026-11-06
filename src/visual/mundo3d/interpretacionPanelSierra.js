import { FORECAST_THRESHOLDS } from '../../constants/alertThresholds.js';

const HORA_LUZ_INICIO = 6;
const HORA_LUZ_FIN = 18;

export const PARAMETROS_FRANJA_PROTECCION = Object.freeze({
  humedadMaximaPct: 90,
  diferenciaRocioMinC: 2,
  horasSinLluviaDespues: 1,
  estado: 'a verificar',
});

/** Franja foliar para «El tiempo». La Sierra conserva interpretarViento. */
export function interpretarFranjaProteccion(serie, now = Date.now(), horasSecas = PARAMETROS_FRANJA_PROTECCION.horasSinLluviaDespues) {
  const noEval = (detalle) => ({ titulo: 'No se puede evaluar la franja de protección', detalle });
  if (!Array.isArray(serie?.horas) || !Number.isFinite(serie.utcOffsetSeconds)) {
    return noEval('Falta la serie horaria de clima para evaluar hoja seca, viento y lluvia.');
  }
  const local = new Date(Number(now) + serie.utcOffsetSeconds * 1000);
  if (!Number.isFinite(local.getTime())) return noEval('No se puede determinar la hora local de la finca.');
  const dia = local.toISOString().slice(0, 10);
  const horas = serie.horas.filter((h) => h?.time?.startsWith(`${dia}T`));
  if (new Set(horas.map((h) => h.time)).size !== horas.length) return noEval('La serie horaria tiene horas duplicadas.');
  const actual = local.getUTCHours();
  const inicio = Math.max(actual, HORA_LUZ_INICIO);
  const porHora = new Map(horas.map((h) => [Number(h.time.slice(11, 13)), h]));
  // Open-Meteo suma la lluvia de HH−1 a HH en el sello HH: la de la hora de h
  // a h+1 es el sello h+1. Viento, humedad y temperatura son instantáneos y se
  // leen en el sello h, el comienzo de la hora; el viento además en el h+1, su
  // fin, para que una franja no termine en una racha sobre el límite.
  const lluviaDeLaHora = (h) => porHora.get(h + 1)?.lluviaMm;
  const vientoSuave = (l) => l.velocidad < 15 && l.racha < 15;
  const selloPrimeraLluvia = horas
    .filter((h) => Number(h.time.slice(11, 13)) > inicio && Number.isFinite(h.lluviaMm) && h.lluviaMm > 0)
    .map((h) => Number(h.time.slice(11, 13)))
    .sort((a, b) => a - b)[0];
  const primeraLluvia = selloPrimeraLluvia == null ? Infinity : selloPrimeraLluvia - 1;
  const candidatas = [];
  let causaHoja = false;
  let causaCalma = false;
  let causaViento = false;
  let causaLluvia = false;
  let faltanDatos = false;
  for (let h = inicio; h < HORA_LUZ_FIN; h += 1) {
    const lectura = porHora.get(h);
    const finDeHora = porHora.get(h + 1);
    const lluvia = lluviaDeLaHora(h);
    if (!lectura || !Number.isFinite(lectura.velocidad) || !Number.isFinite(lectura.racha) || !Number.isFinite(lluvia)
      || !Number.isFinite(finDeHora?.velocidad) || !Number.isFinite(finDeHora?.racha)
      || !Number.isFinite(lectura.humedadPct) || !Number.isFinite(lectura.puntoRocioC) || !Number.isFinite(lectura.temperaturaC)) {
      faltanDatos = true;
      candidatas.push(false);
      continue;
    }
    const hojaSeca = lectura.humedadPct < PARAMETROS_FRANJA_PROTECCION.humedadMaximaPct
      || lectura.temperaturaC - lectura.puntoRocioC >= PARAMETROS_FRANJA_PROTECCION.diferenciaRocioMinC;
    const viento = lectura.velocidad > 0 && vientoSuave(lectura) && vientoSuave(finDeHora);
    if (!hojaSeca) causaHoja = true;
    if (lectura.velocidad === 0) causaCalma = true;
    if (!vientoSuave(lectura) || !vientoSuave(finDeHora)) causaViento = true;
    if (lluvia > 0) causaLluvia = true;
    candidatas.push(h < primeraLluvia - horasSecas && hojaSeca && viento && lluvia === 0);
  }
  const franjas = [];
  for (let i = 0; i < candidatas.length; i += 1) {
    if (!candidatas[i]) continue;
    const desde = inicio + i;
    let fin = desde + 1;
    while (i + 1 < candidatas.length && candidatas[i + 1]) { i += 1; fin += 1; }
    let secaDespues = true;
    // Las horas que siguen al fin de la franja (de fin a fin+1, …).
    for (let h = fin; h < fin + horasSecas; h += 1) {
      const posterior = lluviaDeLaHora(h);
      if (!Number.isFinite(posterior)) { faltanDatos = true; secaDespues = false; break; }
      if (posterior > 0) { causaLluvia = true; secaDespues = false; break; }
    }
    if (secaDespues) franjas.push({ inicio: desde, fin });
  }
  const causa = [causaHoja && 'hoja mojada (humedad ≥ 90 % y diferencia con rocío < 2 °C)', causaCalma && 'calma al amanecer, con riesgo de inversión y deriva', causaViento && 'viento o ráfaga de 15 km/h o más', causaLluvia && 'lluvia durante la aplicación o antes de completar 1 hora seca', faltanDatos && 'faltan datos horarios'].filter(Boolean).join('; ');
  if (!franjas.length) return {
    titulo: 'No hay franja de protección',
    detalle: `No se encontró una hora continua para aplicar.${causa ? ` Motivos de descarte: ${causa}.` : ''} Se necesita hoja seca, viento suave y 1 hora sin lluvia después.`,
  };
  const formato = (h) => `${String(h).padStart(2, '0')}:00`;
  const rangos = franjas.map((f) => `${formato(f.inicio)} a ${formato(f.fin)}`).join('; ');
  return { titulo: `Aplicar por protección: ${rangos}`, detalle: `El pronóstico cumple: condiciones de hoja seca (humedad menor de 90 % o temperatura al menos 2 °C sobre el rocío), viento suave mayor de cero y menor de 15 km/h, ráfagas menores de 15 km/h al comenzar y al terminar cada hora, y ${horasSecas} ${horasSecas === 1 ? 'hora' : 'horas'} sin lluvia al terminar. Confirme la hoja seca en el lote.${faltanDatos ? ' Algunas horas sin datos no se ofrecen.' : ''}` };
}

export function interpretarHelada(minima, piso, riesgo) {
  if (!Number.isFinite(minima)) return {
    titulo: 'Mínima de la próxima noche: no disponible',
    detalle: 'No hay una mínima nocturna confirmada; no se puede afirmar ni descartar riesgo de helada.',
  };
  const umbral = FORECAST_THRESHOLDS.HELADA_MIN_C[piso] ?? FORECAST_THRESHOLDS.HELADA_MIN_C.default;
  const base = `Con ${minima} °C de mínima diaria de referencia y umbral de ${umbral} °C`;
  if (riesgo === 'alto') return {
    titulo: 'Proteger esta noche', detalle: `${base}, el pronóstico señala riesgo alto de helada.`,
  };
  if (riesgo === 'bajo') return {
    titulo: 'Próxima noche evaluada: riesgo bajo',
    detalle: `${base}, la próxima noche fue evaluada y el riesgo de helada es bajo.`,
  };
  // `null` es la señal explícita de deriveFrostRisk: la noche no se evaluó.
  // `undefined` conserva la llamada histórica sin tercer argumento del panel.
  if (riesgo === 'medio' || (riesgo === undefined && minima <= umbral)) return {
    titulo: 'Vigilar esta noche', detalle: `${base}, hay alerta de helada; proteja los cultivos sensibles.`,
  };
  return {
    titulo: 'Mínima de la próxima noche: no disponible',
    detalle: `${base}, no se pudo evaluar el riesgo de helada de la próxima noche.`,
  };
}

export function razonMinimaHelada(minima, piso, riesgo) {
  if (!Number.isFinite(minima)) return 'Falta confirmar la mínima nocturna.';
  const umbral = FORECAST_THRESHOLDS.HELADA_MIN_C[piso] ?? FORECAST_THRESHOLDS.HELADA_MIN_C.default;
  const operador = minima > umbral ? '>' : minima < umbral ? '<' : '=';
  const comparacion = `${minima} °C ${operador} umbral ${umbral} °C.`;
  return riesgo === 'bajo' && minima <= umbral
    ? `${comparacion} Las nubes y la humedad reducen el riesgo esta noche, pero vigile los cultivos sensibles.`
    : comparacion;
}

export function interpretarHumedad(humedad) {
  if (!Number.isFinite(humedad)) return {
    titulo: 'Sin evaluación', detalle: 'Humedad relativa no disponible.',
  };
  // agroMeteoService cuenta HR >= 90 como aproximación al mojado foliar.
  // Una lectura instantánea no demuestra la duración que exige agroIndices.
  if (humedad >= 90) return {
    titulo: 'Humedad favorable a enfermedades',
    detalle: `Con ${humedad} % de humedad relativa, vigile enfermedades por hongos. Si se sostiene, favorece el mojado foliar. Faltan duración del mojado, temperatura media y revisión del cultivo para evaluar una enfermedad concreta. No es diagnóstico.`,
  };
  return {
    titulo: 'Sin señal de humedad alta ahora',
    detalle: `Con ${humedad} % de humedad relativa, esta lectura no indica humedad alta; no descarta enfermedad ni mojado previo.`,
  };
}

export function interpretarViento(serie, now = Date.now()) {
  const sinEvaluacion = {
    titulo: 'No se puede evaluar el horario',
    detalle: 'Falta una serie horaria válida de velocidad, ráfaga o lluvia; no se puede identificar una hora segura.',
  };
  if (!Array.isArray(serie?.horas) || !Number.isFinite(serie.utcOffsetSeconds)) return sinEvaluacion;
  const local = new Date(Number(now) + serie.utcOffsetSeconds * 1000);
  if (!Number.isFinite(local.getTime())) return sinEvaluacion;
  const dia = local.toISOString().slice(0, 10);
  const horasDelDia = serie.horas.filter(hora => hora?.time?.startsWith(`${dia}T`));
  if (new Set(horasDelDia.map(hora => hora.time)).size !== horasDelDia.length) return sinEvaluacion;
  const horaActual = local.getUTCHours();
  const inicio = Math.max(horaActual, HORA_LUZ_INICIO);
  const franjas = [];
  let completa = true;
  const seriesFaltantes = new Set();
  for (let h = inicio; h < HORA_LUZ_FIN; h += 1) {
    const time = `${dia}T${String(h).padStart(2, '0')}:00`;
    const entradas = serie.horas.filter(hora => hora?.time === time);
    const lectura = entradas.length === 1 ? entradas[0] : null;
    // La lluvia de la hora de h a h+1 es el sello h+1 (Open-Meteo suma HH−1 a HH).
    const timeLluvia = `${dia}T${String(h + 1).padStart(2, '0')}:00`;
    const entradasLluvia = serie.horas.filter(hora => hora?.time === timeLluvia);
    const velocidad = lectura?.velocidad;
    const racha = lectura?.racha;
    const lluviaMm = entradasLluvia.length === 1 ? entradasLluvia[0].lluviaMm : undefined;
    const velocidadFaltante = !Number.isFinite(velocidad) || velocidad < 0;
    const rachaFaltante = !Number.isFinite(racha) || racha < 0;
    const lluviaFaltante = !Number.isFinite(lluviaMm) || lluviaMm < 0;
    if (velocidadFaltante || rachaFaltante || lluviaFaltante) {
      completa = false;
      if (velocidadFaltante) seriesFaltantes.add('velocidad');
      if (rachaFaltante) seriesFaltantes.add('ráfaga');
      if (lluviaFaltante) seriesFaltantes.add('lluvia');
      continue;
    }
    if (velocidad >= 15 || racha >= 15 || lluviaMm > 0) continue;
    const anterior = franjas.at(-1);
    if (anterior?.fin === h) anterior.fin = h + 1;
    else franjas.push({ inicio: h, fin: h + 1 });
  }
  const nombresSeriesFaltantes = [...seriesFaltantes].join(', ');
  const detalleSeriesFaltantes = seriesFaltantes.size === 1
    ? `Falta la serie horaria de ${nombresSeriesFaltantes}.`
    : `Faltan las series horarias de ${nombresSeriesFaltantes}.`;
  if (!franjas.length) return completa ? {
    titulo: 'Hoy no quedan horas aplicables por viento',
    detalle: 'No quedan horas de luz con velocidad y ráfaga menores de 15 km/h y sin lluvia prevista, según el pronóstico horario. La ventana no se extiende a la noche.',
  } : {
    ...sinEvaluacion,
    detalle: `${detalleSeriesFaltantes} No se puede identificar una hora segura.`,
  };
  const hora = h => `${String(h).padStart(2, '0')}:00`;
  const rangos = franjas.map(f => `${f.inicio === horaActual ? 'ahora' : hora(f.inicio)} a ${hora(f.fin)}`).join('; ');
  const maxRachaDiaria = horasDelDia
    .map(hora => hora.racha)
    .filter(racha => Number.isFinite(racha) && racha >= 0)
    .reduce((max, racha) => Math.max(max, racha), null);
  const maxOcurreFueraDeFranja = Number.isFinite(maxRachaDiaria) && maxRachaDiaria >= 15;
  const aclaracion = maxOcurreFueraDeFranja
    ? ' La máxima diaria ocurre fuera de la franja de aplicación; por eso conviven ambas cifras.'
    : '';
  return {
    titulo: `${maxOcurreFueraDeFranja ? 'La máxima diaria ocurre fuera de la franja: ' : ''}Aplicar por viento: ${rangos}`,
    detalle: `Hoy, hora local de la finca y solo con luz. Pronóstico de velocidad y ráfaga menores de 15 km/h, sin lluvia prevista.${completa ? '' : ` Hay horas sin datos en las series de ${nombresSeriesFaltantes}; solo se muestran las evaluables.`}${aclaracion}`,
  };
}
