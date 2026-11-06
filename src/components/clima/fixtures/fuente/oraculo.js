/**
 * Oráculo del banco fijo de «El tiempo»: lo que DEBE decirse, calculado solo
 * desde la respuesta cruda de Open-Meteo (nunca con las funciones de la app),
 * y un lector de horas del texto de la pantalla y de la voz.
 *
 * Contrato de la fuente: la fila `hourly.precipitation` sellada HH:00 es lo
 * acumulado entre HH−1 y HH; la temperatura de HH:00 es instantánea.
 */
const HORA = 3_600_000;
export const UMBRAL_LLUVIA_MM = 0.2;

/**
 * @typedef {{ fin: number, mm: number | null, inicio: number }} FilaLluvia
 * @typedef {{ desde: number, hasta: number, filas: FilaLluvia[], abierto?: boolean }} TramoLluvia
 * @typedef {number | 'siguiente'} DiaDicho  días después de hoy, o «siguiente» al anterior
 * @typedef {{ palabra: string | undefined, n: number | null, meridiano: string | null,
 *   dias: DiaDicho | null, desde: number, fin: number, prestado?: DiaDicho }} HoraCruda
 */

const num = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

/** Epoch de un sello local «2026-09-29T05:00» con el offset de la fuente. */
export function epochLocal(time, offset) {
    return Date.parse(`${time}:00Z`) - offset * 1000;
}

/** Fecha y hora locales (de la finca) de un epoch. */
export function partesLocales(epoch, offset) {
    const d = new Date(epoch + offset * 1000);
    return { fecha: d.toISOString().slice(0, 10), hora: d.getUTCHours(), minuto: d.getUTCMinutes() };
}

/** Medianoche local (epoch) del día `dias` después de hoy. */
export function medianocheLocal(ahora, offset, dias = 0) {
    const { fecha } = partesLocales(ahora, offset);
    return Date.parse(`${fecha}T00:00:00Z`) - offset * 1000 + dias * 24 * HORA;
}

/**
 * La fuente vista a una hora del reloj: el bloque `current` que Open-Meteo
 * daría a esa hora, tomado de la fila horaria del reloj (sello en punto
 * anterior para lo instantáneo; la lluvia, la del intervalo en curso). Sin
 * esto, un payload consultado a las 5:15 diría a las 23:30 el cielo de las 5:15.
 */
export function fuenteAlReloj(raw, ahora) {
    const copia = structuredClone(raw);
    const offset = copia.utc_offset_seconds;
    const h = copia.hourly;
    const i = h.time.findIndex((t) => { const e = epochLocal(t, offset); return e <= ahora && ahora < e + HORA; });
    const enCurso = h.time.findIndex((t) => { const e = epochLocal(t, offset); return e - HORA <= ahora && ahora < e; });
    if (i < 0) return copia;
    const campo = (k) => (Array.isArray(h[k]) ? h[k][i] : undefined);
    const inicio15 = Math.floor(ahora / (15 * 60_000)) * 15 * 60_000;
    const local = partesLocales(inicio15, offset);
    copia.current = {
        ...copia.current,
        time: `${local.fecha}T${String(local.hora).padStart(2, '0')}:${String(local.minuto).padStart(2, '0')}`,
        temperature_2m: campo('temperature_2m'),
        relative_humidity_2m: campo('relative_humidity_2m'),
        // La app pide el rocío en `current` (W44, R3 de la v19).
        dew_point_2m: campo('dew_point_2m'),
        apparent_temperature: campo('apparent_temperature') ?? campo('temperature_2m'),
        is_day: campo('is_day'),
        precipitation: enCurso >= 0 ? h.precipitation[enCurso] : 0,
        weathercode: campo('weathercode'),
        cloud_cover: campo('cloud_cover'),
        wind_speed_10m: campo('wind_speed_10m'),
        wind_gusts_10m: campo('wind_gusts_10m'),
        wind_direction_10m: campo('wind_direction_10m'),
    };
    return copia;
}

/**
 * Intervalos de lluvia cuyo cierre cae en (ahora, ahora + 24 h].
 * @returns {FilaLluvia[]}
 */
export function ventanaLluvia(raw, ahora) {
    const offset = raw.utc_offset_seconds;
    return raw.hourly.time.map((t, i) => ({ fin: epochLocal(t, offset), mm: num(raw.hourly.precipitation[i]) }))
        .filter((f) => f.fin > ahora && f.fin <= ahora + 24 * HORA)
        .map((f) => ({ ...f, inicio: f.fin - HORA }));
}

/**
 * Tramos de la fuente: horas seguidas con ≥ 0,2 mm. El último queda abierto si
 * llega al borde de la ventana y la fuente sigue con lluvia (o sin dato) en la
 * hora siguiente.
 */
export function tramosFuente(raw, ahora) {
    const filas = ventanaLluvia(raw, ahora);
    /** @type {TramoLluvia[]} */
    const tramos = [];
    for (const f of filas) {
        if ((f.mm ?? 0) < UMBRAL_LLUVIA_MM) continue;
        const ultimo = tramos.at(-1);
        if (ultimo && ultimo.hasta === f.inicio) { ultimo.hasta = f.fin; ultimo.filas.push(f); }
        else tramos.push({ desde: f.inicio, hasta: f.fin, filas: [f] });
    }
    const ultimo = tramos.at(-1);
    if (ultimo && ultimo.hasta === filas.at(-1)?.fin) {
        const offset = raw.utc_offset_seconds;
        const j = raw.hourly.time.findIndex((t) => epochLocal(t, offset) === ultimo.hasta + HORA);
        const mm = j < 0 ? null : num(raw.hourly.precipitation[j]);
        ultimo.abierto = mm == null || mm >= UMBRAL_LLUVIA_MM;
    }
    const max = filas.reduce((m, f) => Math.max(m, f.mm ?? 0), 0);
    const total = filas.length === 24 && filas.every((f) => f.mm != null)
        ? Math.round(filas.reduce((s, f) => s + f.mm, 0) * 10) / 10 : null;
    return { filas, tramos, max, picos: filas.filter((f) => f.mm === max && max >= UMBRAL_LLUVIA_MM), total };
}

/**
 * Ventana de la probabilidad de lluvia: la misma que describe «¿Llueve?», las
 * próximas 24 horas; o el día de mañana (su fecha) si toda la lluvia de la
 * ventana cae mañana. Sin la probabilidad de las 24 horas, la lista de días
 * cuyo máximo diario vale (W31).
 * @returns {{ ventana: '24h' | string | string[], rotulo: string }}
 */
export function ventanaDeLaProbabilidad(raw, ahora) {
    const offset = raw.utc_offset_seconds;
    const { tramos } = tramosFuente(raw, ahora);
    const manana = medianocheLocal(ahora, offset, 1);
    if (tramos.length && tramos.every((t) => t.desde >= manana && t.hasta <= manana + 24 * HORA)) {
        return { ventana: partesLocales(manana, offset).fecha, rotulo: 'mañana' };
    }
    const h = raw.hourly;
    const dentro = h.time.flatMap((t, i) => { const e = epochLocal(t, offset); return e > ahora && e <= ahora + 24 * HORA ? [i] : []; });
    if (dentro.length === 24 && dentro.every((i) => num(h.precipitation_probability?.[i]) != null)) {
        return { ventana: '24h', rotulo: 'en las próximas 24 horas' };
    }
    // Sin la horaria completa (W31): el máximo diario de los días donde cae la
    // lluvia de la ventana (sin lluvia, de los días que toca), dicho así.
    const conLluvia = dentro.filter((i) => num(h.precipitation[i]) >= UMBRAL_LLUVIA_MM);
    const dias = [...new Set((conLluvia.length ? conLluvia : dentro).map((i) => h.time[i].slice(0, 10)))].sort();
    const hoy = partesLocales(ahora, offset).fecha;
    const nombres = { [hoy]: 'hoy', [partesLocales(manana, offset).fecha]: 'mañana' };
    const diaria = (d) => num(raw.daily.precipitation_probability_max?.[raw.daily.time.indexOf(d)]);
    // Sin la diaria de alguno de esos días no se sabe: «sin dato» de las 24 horas.
    if (!dias.every((d) => nombres[d] && diaria(d) != null)) return { ventana: '24h', rotulo: 'en las próximas 24 horas' };
    return { ventana: dias, rotulo: `${dias.map((d) => nombres[d]).join(' y ')}, todo el día` };
}

/**
 * Máximo de `hourly.precipitation_probability` (de la hora anterior al sello,
 * como la lluvia) en una ventana: '24h' (sellos en (ahora, ahora + 24 h]) o
 * una fecha (sellos de ese día local), o una lista de fechas (el máximo de
 * sus diarios, null si falta alguno). Si falta la probabilidad de alguna
 * hora, para un día vale `daily.precipitation_probability_max`, que la fuente
 * calcula con esas mismas horas; para 24 horas, null (no se sabe).
 */
export function probabilidadVentana(raw, ahora, ventana) {
    const offset = raw.utc_offset_seconds;
    if (Array.isArray(ventana)) {
        const diarias = ventana.map((d) => num(raw.daily.precipitation_probability_max?.[raw.daily.time.indexOf(d)]));
        return diarias.every((p) => p != null) ? Math.max(...diarias) : null;
    }
    const h = raw.hourly;
    const dentro = ventana === '24h'
        ? (t) => { const e = epochLocal(t, offset); return e > ahora && e <= ahora + 24 * HORA; }
        : (t) => t.startsWith(ventana);
    const probs = h.time.flatMap((t, i) => (dentro(t) ? [num(h.precipitation_probability?.[i])] : []));
    if (probs.length === 24 && probs.every((p) => p != null)) return Math.max(...probs);
    if (ventana === '24h') return null;
    return num(raw.daily.precipitation_probability_max?.[raw.daily.time.indexOf(ventana)]);
}

const LLUVIA_WMO = (c) => (c >= 51 && c <= 67) || (c >= 71 && c <= 77) || (c >= 80 && c <= 86);

/** Fila horaria del intervalo en curso (su sello cierra la hora que corre): `{ fin, mm }` o null. */
export function filaEnCurso(raw, ahora) {
    const offset = raw.utc_offset_seconds;
    const j = raw.hourly.time.findIndex((t) => { const e = epochLocal(t, offset); return e - HORA <= ahora && ahora < e; });
    return j < 0 ? null : { fin: epochLocal(raw.hourly.time[j], offset), mm: num(raw.hourly.precipitation[j]) };
}

/**
 * ¿La fuente dice que llueve en este momento? Manda la lluvia medida del
 * intervalo en curso (> 0 mm); el bloque current (código de lluvia o
 * precipitación) solo decide si la serie no trae ese intervalo.
 */
export function lloviendoAhora(raw, ahora) {
    const fila = filaEnCurso(raw, ahora);
    if (fila?.mm != null) return fila.mm > 0;
    const c = num(raw.current?.weathercode ?? raw.current?.weather_code);
    return (c != null && (LLUVIA_WMO(c) || c >= 95)) || num(raw.current?.precipitation) > 0;
}

/**
 * Tramo de la lluvia que está cayendo: el tramo (≥ 0,2 mm) que contiene el
 * intervalo en curso; con menos de 0,2 mm en curso, ese intervalo solo, o
 * unido al tramo que empieza justo al cerrarlo. Null si no llueve ahora o si
 * la serie no trae el intervalo en curso (el fin no se puede saber).
 * @returns {TramoLluvia | null}
 */
export function tramoEnCurso(raw, ahora) {
    if (!lloviendoAhora(raw, ahora)) return null;
    const fila = filaEnCurso(raw, ahora);
    if (fila?.mm == null) return null;
    const [primero] = tramosFuente(raw, ahora).tramos;
    if (primero && primero.desde <= ahora) return primero;
    if (primero && primero.desde === fila.fin) return { ...primero, desde: fila.fin - HORA };
    return { desde: fila.fin - HORA, hasta: fila.fin, filas: [{ inicio: fila.fin - HORA, ...fila }], abierto: false };
}

/**
 * Ventana de la noche que corresponde al reloj: hasta las 6:00, la madrugada
 * ENTERA de hoy (sellos de 00:00 a 06:00, también los que ya pasaron); desde
 * las 6:00 (el último sello de la madrugada ya llegó) y de día, la noche que
 * viene (18:00 a 06:00); desde las 18:00, lo que queda de esa noche (sellos
 * ≥ ahora). `madrugada` dice si la ventana es la madrugada entera de hoy.
 * @returns {{ desde: number, hasta: number, madrugada: boolean }}
 */
export function ventanaNoche(raw, ahora) {
    const offset = raw.utc_offset_seconds;
    const cero = medianocheLocal(ahora, offset);
    if (ahora < cero + 6 * HORA) return { desde: cero, hasta: cero + 7 * HORA, madrugada: true };
    return { desde: Math.max(ahora, cero + 18 * HORA), hasta: medianocheLocal(ahora, offset, 1) + 7 * HORA, madrugada: false };
}

/**
 * Mínima de la noche que corresponde al reloj (`ventanaNoche`), desde la serie
 * horaria. Con empate vale la primera hora; si la cifra vuelve en una hora por
 * venir, esa. `pasada` = su hora ya pasó (se dice «fue … a las …»).
 */
export function minimaNoche(raw, ahora) {
    const offset = raw.utc_offset_seconds;
    const { desde, hasta } = ventanaNoche(raw, ahora);
    const filas = raw.hourly.time.map((t, i) => ({ e: epochLocal(t, offset), c: num(raw.hourly.temperature_2m[i]) }))
        .filter((f) => f.e >= desde && f.e < hasta && f.c != null);
    if (!filas.length) return null;
    const c = Math.min(...filas.map((f) => f.c));
    const conMinima = filas.filter((f) => f.c === c);
    const { e } = conMinima.find((f) => f.e >= ahora) ?? conMinima[0];
    return { c, epoch: e, hora: partesLocales(e, offset).hora, pasada: e < ahora, desde, hasta };
}

/**
 * Nivel de helada de la noche del reloj con la regla publicada (P: mínima
 * ≤ 7 °C, nube media de la madrugada ≤ 30 % y viento máximo ≤ 8 km/h = alto;
 * vigilar: ≤ 8 °C, ≤ 60 %, ≤ 12 km/h = medio; si no, bajo), sobre TODAS las
 * horas de la ventana (`ventanaNoche`); la nube y el viento, de las horas
 * antes de las 7. Null si falta un dato.
 * @returns {'alto' | 'medio' | 'bajo' | null}
 */
export function nivelHeladaNoche(raw, ahora) {
    const offset = raw.utc_offset_seconds;
    const { desde, hasta } = ventanaNoche(raw, ahora);
    const h = raw.hourly;
    const filas = h.time.flatMap((t, i) => {
        const e = epochLocal(t, offset);
        return e >= desde && e < hasta ? [{ hora: partesLocales(e, offset).hora, c: num(h.temperature_2m[i]), nube: num(h.cloud_cover[i]), viento: num(h.wind_speed_10m[i]) }] : [];
    });
    const madrugada = filas.filter((f) => f.hora < 7);
    if (!filas.length || !madrugada.length || filas.some((f) => f.c == null) || madrugada.some((f) => f.nube == null || f.viento == null)) return null;
    const min = Math.min(...filas.map((f) => f.c));
    const nube = madrugada.reduce((s, f) => s + f.nube, 0) / madrugada.length;
    const viento = Math.max(...madrugada.map((f) => f.viento));
    if (min <= 7 && nube <= 30 && viento <= 8) return 'alto';
    if (min <= 8 && nube <= 60 && viento <= 12) return 'medio';
    return 'bajo';
}

/** Mínima de la serie horaria en el día local de hoy (00:00 a 23:00). */
export function minimaDelDia(raw, ahora) {
    const offset = raw.utc_offset_seconds;
    const cero = medianocheLocal(ahora, offset);
    const cs = raw.hourly.time.flatMap((t, i) => {
        const e = epochLocal(t, offset);
        return e >= cero && e < cero + 24 * HORA ? [num(raw.hourly.temperature_2m[i])] : [];
    });
    return cs.length === 24 && cs.every((c) => c != null) ? Math.min(.../** @type {number[]} */ (cs)) : null;
}

/**
 * Rótulos del cielo que dice la fuente (código WMO y nubosidad del bloque
 * current), por la tabla de la OMM: 0–1 despejado, 2 parcialmente nublado,
 * 3 nublado. La nubosidad solo desempata cuando el código no define el cielo
 * (sin código): entonces se rechaza solo lo grueso, «Despejado» con la mitad
 * del cielo o más tapada y «Nublado» con menos de la mitad.
 * Única holgura que no sale de la tabla: en tierra alta (≥ 2600 m) con el
 * cielo tapado (≥ 80 %) la nube baja es niebla en la finca, y vale «Niebla».
 * En el banco `current.precipitation` es la del intervalo en curso
 * (`fuenteAlReloj`): con 0 mm, un código de lluvia no hace «Lluvia».
 */
export function cielosPermitidos(current, elevation) {
    const codigo = num(current?.weathercode ?? current?.weather_code);
    const nubes = num(current?.cloud_cover);
    if (codigo != null && codigo >= 95) return ['Tormenta'];
    // Código de lluvia con 0 mm medidos en el intervalo en curso: la lluvia no
    // es de esta hora y el cielo lo dice la nubosidad (`lloviendoAhora`).
    const seco = codigo != null && LLUVIA_WMO(codigo) && num(current?.precipitation) === 0;
    if (codigo != null && LLUVIA_WMO(codigo) && !seco) return ['Lluvia'];
    const c = seco ? null : codigo;
    if (c === 45 || c === 48) return ['Niebla'];
    const permitidos = new Set();
    if (nubes != null && nubes >= 80 && num(elevation) >= 2600) permitidos.add('Niebla');
    if (c != null && c <= 1) permitidos.add('Despejado');
    else if (c === 2) permitidos.add('Parcialmente nublado');
    else if (c === 3) permitidos.add('Nublado');
    else if (nubes != null) {
        permitidos.add('Parcialmente nublado');
        permitidos.add(nubes >= 50 ? 'Nublado' : 'Despejado');
    } else return null;
    return [...permitidos];
}

/** Rótulo del ícono de un día según su código WMO (tabla de la OMM). */
export function iconoPermitido(codigo) {
    const c = num(codigo);
    if (c == null) return null;
    if (c >= 95) return 'Tormenta';
    if (c >= 51 && c <= 57) return 'Llovizna';
    if (LLUVIA_WMO(c)) return 'Lluvia';
    if (c === 45 || c === 48) return 'Neblina';
    if (c === 3) return 'Cubierto';
    if (c === 2) return 'Sol y nubes';
    return 'Soleado';
}

/* ── Lector de horas ─────────────────────────────────────────────────── */

const DIAS_CORTOS = '(?:lun|mar|mié|jue|vie|sáb|dom|lunes|martes|miércoles|jueves|viernes|sábado|domingo)';
const FRANJA_VOZ = { madrugada: 'a', mañana: 'a', tarde: 'p', noche: 'p' };

/**
 * Horas nombradas en un texto, en orden, como epochs de la finca. Lee la
 * pantalla («las 6 p. m.», «de 2 a 3 p. m.», «el mediodía», «la medianoche de
 * mañana», «del mié 30») y la voz («las 6 de la tarde», «de la mañana
 * siguiente»). «mañana …» al frente vale para todas las horas sin día propio.
 */
export function horasDelTexto(texto, ahora, offset) {
    const s = String(texto).replace(/[\s\u00a0]+/g, ' ');
    const todoManana = /^(?:Sí, )?mañana\b/.test(s);
    const re = new RegExp(String.raw`\b(mediodía|medianoche)\b|\b(\d{1,2})(?::\d{2})?(?: ([ap])\. m\.| de la (madrugada|mañana|tarde|noche)| del mediodía)?(?![\d,])`, 'g');
    /** @type {HoraCruda[]} */
    const crudos = [];
    let m;
    while ((m = re.exec(s))) {
        const resto = s.slice(re.lastIndex);
        if (m[2] && /^ ?(mm|%|°|grados|km|milímetros|por ciento|cm)/.test(resto)) continue;
        let meridiano = m[3] || (m[4] ? FRANJA_VOZ[m[4]] : null);
        if (m[0].endsWith('del mediodía')) meridiano = 'p';
        /** @type {DiaDicho | null} */
        let dias = null;
        const sig = resto.match(/^( siguiente)?( de mañana| del (\S+) (\d{1,2}))?/);
        if (sig?.[1]) dias = 'siguiente';
        if (sig?.[2]?.startsWith(' de mañana')) dias = 1;
        if (sig?.[4]) {
            const dm = Number(sig[4]);
            for (let d = 0; d < 4; d += 1) {
                if (Number(partesLocales(medianocheLocal(ahora, offset, d), offset).fecha.slice(8)) === dm) dias = d;
            }
        }
        // «de la mañana siguiente» = «de la mañana de mañana».
        if (m[4] === 'mañana' && sig?.[1]) dias = 1;
        crudos.push({ palabra: m[1], n: m[2] ? Number(m[2]) : null, meridiano, dias, desde: m.index, fin: re.lastIndex });
    }
    // «de 2 a 3 p. m.»: la hora sin meridiano toma el de la siguiente.
    crudos.forEach((c, i) => {
        if (c.n != null && !c.meridiano) c.meridiano = crudos.slice(i + 1).find((x) => x.meridiano || x.palabra)?.meridiano ?? null;
    });
    // «entre las 4 p. m. y las 5 p. m. de mañana», «de 2 a 3 p. m. de mañana»:
    // el día se dice una vez, al final, y vale para las dos horas.
    crudos.forEach((c, i) => {
        const otro = crudos[i + 1];
        if (c.dias != null || otro?.dias == null) return;
        if (/^ (?:y|a|al) $/.test(s.slice(c.fin, otro.desde).replace(/ (?:el|la|las) $/, ' '))) c.prestado = otro.dias;
    });
    /** @type {{ epoch: number, dias: number, h: number, prestado?: DiaDicho }[]} */
    const salida = [];
    for (const c of crudos) {
        let h;
        if (c.palabra === 'mediodía') h = 12;
        else if (c.palabra === 'medianoche') h = 24;
        else if (c.n != null && c.meridiano) h = c.n % 12 + (c.meridiano === 'p' ? 12 : 0);
        else continue;
        let dias = c.dias;
        if (dias === 'siguiente') dias = (salida.at(-1)?.dias ?? 0) + 1;
        if (dias == null) dias = todoManana ? 1 : 0;
        salida.push({ epoch: medianocheLocal(ahora, offset, dias) + h * HORA, dias, h, prestado: c.prestado });
    }
    // El día prestado solo vale si deja las horas en orden: «de las 11 p. m. a
    // la 1 a. m. de mañana» empieza hoy.
    salida.forEach((x, i) => {
        if (x.prestado == null || x.prestado === 'siguiente') return;
        const epoch = medianocheLocal(ahora, offset, x.prestado) + x.h * HORA;
        if (epoch < (salida[i + 1]?.epoch ?? Infinity)) x.epoch = epoch;
    });
    return salida.map((x) => x.epoch);
}

/* ── ¿Aplico? ────────────────────────────────────────────────────────── */

/**
 * Código WMO del parte diario de `fecha` si es tormenta (95–99: tormenta
 * eléctrica, con o sin granizo); si no, null.
 */
export function tormentaDelDia(raw, fecha) {
    const i = raw.daily.time.indexOf(fecha);
    const c = i < 0 ? null : num(raw.daily.weathercode?.[i]);
    return c != null && c >= 95 && c <= 99 ? c : null;
}

/**
 * Día (fecha de la finca) de lo que responde «¿Aplico?»: `{ fecha, ofrece }`,
 * con `ofrece` true si da una franja para ese día y false si lo niega. Lee
 * «Sí, hoy …», «Hoy no …», «Mañana, …», «Mañana no …» y «La próxima: mié 30, …».
 * @returns {{ fecha: string, ofrece: boolean }[]}
 */
export function diasDeAplicar(respuesta, ahora, offset) {
    const s = String(respuesta).replace(/[\s\u00a0]+/g, ' ').trim();
    const dia = (n) => partesLocales(medianocheLocal(ahora, offset, n) + 12 * HORA, offset).fecha;
    const dichos = [];
    if (/^Sí, hoy\b/.test(s)) dichos.push({ fecha: dia(0), ofrece: true });
    if (/^Hoy no\b/.test(s)) dichos.push({ fecha: dia(0), ofrece: false });
    if (/^Mañana, (?!sin)/.test(s)) dichos.push({ fecha: dia(1), ofrece: true });
    if (/^Mañana no\b|Mañana tampoco/.test(s)) dichos.push({ fecha: dia(1), ofrece: false });
    const proxima = s.match(new RegExp(String.raw`La próxima: ${DIAS_CORTOS}\.? (\d{1,2})`));
    if (proxima) {
        for (let d = 0; d < 17; d += 1) {
            if (Number(dia(d).slice(8)) === Number(proxima[1])) { dichos.push({ fecha: dia(d), ofrece: true }); break; }
        }
    }
    return dichos;
}

/**
 * ¿Queda tormenta hoy desde el reloj (W35)? Sí si el `current` es WMO 95–99 o
 * si alguna hora sellada desde la hora en curso hasta la medianoche lo es. El
 * código diario no cuenta: es del día entero, incluida la tormenta que ya pasó.
 */
export function tormentaPorVenirFuente(raw, ahora) {
    const offset = raw.utc_offset_seconds;
    const es = (c) => c != null && c >= 95 && c <= 99;
    if (es(num(raw.current?.weathercode ?? raw.current?.weather_code))) return true;
    const desde = Math.floor(ahora / HORA) * HORA;
    const hasta = medianocheLocal(ahora, offset, 1);
    return raw.hourly.time.some((t, i) => {
        const e = epochLocal(t, offset);
        return e >= desde && e <= hasta && es(num(raw.hourly.weathercode?.[i]));
    });
}

/**
 * Lluvia que falta (W35): la suma de los intervalos horarios que cierran
 * después del reloj y hasta la medianoche que termina `dias` días contando hoy.
 * Con alguna hora sin dato, null.
 */
export function lluviaRestante(raw, ahora, dias) {
    const offset = raw.utc_offset_seconds;
    const fin = medianocheLocal(ahora, offset, dias);
    const mm = raw.hourly.time.flatMap((t, i) => {
        const e = epochLocal(t, offset);
        return e > ahora && e <= fin ? [num(raw.hourly.precipitation[i])] : [];
    });
    if (!mm.length || mm.some((v) => v == null)) return null;
    return Math.round(mm.reduce((s, v) => s + v, 0) * 10) / 10;
}
