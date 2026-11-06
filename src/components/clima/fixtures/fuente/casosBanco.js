/**
 * Los casos del banco fijo de «El tiempo» (bancoFuente.test.jsx), sin DOM:
 * los siete payloads del banco (dos reales, dos sintéticos del arnés, los
 * sintéticos N3 y P2 de la v16 y la v17, y el vivo del 3 de octubre), cada uno
 * a los nueve relojes del banco. Los usan las pruebas que comparan versiones
 * de la pantalla y las del módulo de respuestas del día.
 */
import dia28 from './dia-20260928.json' with { type: 'json' };
import dia29 from './dia-20260929.json' with { type: 'json' };
import hongos from './sintetico-cultivos-hongos.json' with { type: 'json' };
import tormenta from './sintetico-tormenta-granizo-helada-alta.json' with { type: 'json' };
import vivo1003 from './dia-20261003.json' with { type: 'json' };

/** Los mismos relojes del banco; 00:30 es la madrugada que sigue a las 23:30. */
export const RELOJES = ['05:30', '06:00', '06:30', '06:59', '11:00', '13:30', '17:00', '23:30', '00:30'];

/** Sintético N3 de la v16, el mismo del banco: lluvia solo de 10 a 11 a. m. */
function sinteticoN3() {
    const raw = structuredClone(dia28);
    const fecha = '2026-09-28';
    raw.hourly.time.forEach((t, i) => {
        if (!t.startsWith(fecha)) return;
        Object.assign(raw.hourly.wind_speed_10m, { [i]: 5 });
        Object.assign(raw.hourly.wind_gusts_10m, { [i]: 8 });
        Object.assign(raw.hourly.relative_humidity_2m, { [i]: 70 });
        Object.assign(raw.hourly.dew_point_2m, { [i]: 6 });
        Object.assign(raw.hourly.temperature_2m, { [i]: 15 });
        Object.assign(raw.hourly.cloud_cover, { [i]: 60 });
        Object.assign(raw.hourly.weathercode, { [i]: 3 });
        Object.assign(raw.hourly.precipitation, { [i]: t.endsWith('T11:00') ? 0.5 : 0 });
    });
    const d = raw.daily.time.indexOf(fecha);
    raw.daily.weathercode[d] = 3;
    raw.daily.precipitation_sum[d] = 0.5;
    return raw;
}

/** Sintético P2 de la v17, el mismo del banco: racha de 19,1 km/h a las 11 a. m. */
function sinteticoP2() {
    const raw = structuredClone(dia28);
    const fecha = '2026-09-28';
    raw.hourly.time.forEach((t, i) => {
        if (!t.startsWith(fecha)) return;
        const racha = t.endsWith('T11:00');
        Object.assign(raw.hourly.wind_speed_10m, { [i]: racha ? 10 : 5 });
        Object.assign(raw.hourly.wind_gusts_10m, { [i]: racha ? 19.1 : 8 });
        Object.assign(raw.hourly.relative_humidity_2m, { [i]: 70 });
        Object.assign(raw.hourly.dew_point_2m, { [i]: 6 });
        Object.assign(raw.hourly.temperature_2m, { [i]: 15 });
        Object.assign(raw.hourly.cloud_cover, { [i]: 60 });
        Object.assign(raw.hourly.weathercode, { [i]: 3 });
        Object.assign(raw.hourly.precipitation, { [i]: 0 });
    });
    const d = raw.daily.time.indexOf(fecha);
    raw.daily.weathercode[d] = 3;
    raw.daily.precipitation_sum[d] = 0;
    return raw;
}

export const FUENTES_BANCO = [
    { id: 'dia-20260928', raw: dia28, fecha: '2026-09-28' },
    { id: 'dia-20260929', raw: dia29, fecha: '2026-09-29' },
    { id: 'sint-cultivos-hongos', raw: hongos, fecha: '2026-09-28', cultivos: 'papa, tomate, maíz' },
    { id: 'sint-tormenta-helada', raw: tormenta, fecha: '2026-09-28', cultivos: 'papa, tomate, maíz' },
    { id: 'sint-n3', raw: sinteticoN3(), fecha: '2026-09-28' },
    { id: 'sint-p2', raw: sinteticoP2(), fecha: '2026-09-28' },
    { id: 'dia-20261003', raw: vivo1003, fecha: '2026-10-03' },
];

const siguiente = (fecha) => new Date(Date.parse(`${fecha}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** Cada payload a cada reloj, con el instante en hora de Colombia. */
export const CASOS_BANCO = FUENTES_BANCO.flatMap((f) => RELOJES.map((reloj) => {
    const fecha = reloj === '00:30' ? siguiente(f.fecha) : f.fecha;
    return { ...f, reloj, id: `${f.id}@${reloj}`, ahora: Date.parse(`${fecha}T${reloj}:00-05:00`) };
}));

/**
 * Las dos fuentes sin dato del banco del mundo (mundo/bancoMundo.test.jsx),
 * hechas desde el 28-sep a la 1:30 p. m.: (a) la hora en curso sin cielo, sin
 * temperatura y sin lluvia; (b) código de lluvia con la lluvia del intervalo
 * en curso sin cifra (la de la hora anterior sí trae). Aparte de CASOS_BANCO
 * para no cambiar las pruebas que ya lo recorren.
 */
function sinDato(variante) {
    const ahora = Date.parse('2026-09-28T13:30:00-05:00');
    const raw = structuredClone(dia28);
    const h = raw.hourly;
    const i = h.time.indexOf('2026-09-28T13:00');
    const enCurso = h.time.indexOf('2026-09-28T14:00');
    if (variante === 'todo') {
        for (const k of ['temperature_2m', 'apparent_temperature', 'weathercode', 'cloud_cover', 'relative_humidity_2m']) if (Array.isArray(h[k])) h[k][i] = null;
        h.precipitation[enCurso] = null;
    } else {
        h.weathercode[i] = 63;
        h.precipitation[i] = 2.4;
        h.precipitation[enCurso] = null;
    }
    return { id: `sin-dato-${variante}@13:30`, raw, fecha: '2026-09-28', reloj: '13:30', ahora };
}
export const CASOS_SIN_DATO = [sinDato('todo'), sinDato('lluvia-sin-cifra')];
