/**
 * escenaMundo.js — lo que el mundo del clima dibuja, leído del MISMO dato y
 * con las MISMAS funciones que «El tiempo» 2D (ClimaBoletinScreen): el cielo
 * sale de `resolverCielo` + `condicionAhora`, la luz de `deriveAtmosphere`, el
 * astro con la regla de la portada (W30-r3), el nombre del tramo de
 * `tramoDeLaNoche` y las respuestas de `veredictoDelDia`. Con el mismo dato y
 * la misma hora, el mundo y la pantalla no pueden decir cosas distintas.
 *
 * Regla de dibujo: sin dato no se dibuja nada. Ninguna capa se pinta con un
 * valor inventado (ni un cero): si falta la cifra, la capa no está. Lo que se
 * DICE de la lluvia de ahora va aparte (`lluviaAhora`): con código de lluvia y
 * sin cifra, «llueve sin cifra», nunca «no llueve».
 *
 * Puro: no pide nada a la red ni lee el reloj; todo entra por argumentos.
 */
import { deriveAtmosphere } from '../../../services/atmosphereService.js';
import { clasificarPisoTermico } from '../../../services/pisoTermicoClassifier.js';
import { parseCultivos } from '../../../services/agroIndices.js';
import {
    condicionAhora, escenaDelCielo, CIELO_ROTULO_PANTALLA, heladaVisible, bandaHelada, resolverCielo, claveCielo,
    tramoDeLaNoche, momentoDeLaFinca, lunaDeHoy, arcoDelSol, densidadNiebla, lluviaDelIntervaloEnCurso, lluviaDeAhora,
    vientoAhora, frescuraDelDato, avisoGranizo, veredictoDelDia, rangoCorto, cifra,
} from '../cieloHoy.js';
import { horaConMinutosEsCO, horaEsCO } from '../../../utils/fechaEsCO.js';

const HORA = 3_600_000;

const num = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

/** El rótulo del cielo, el mismo de la portada del 2D. */
export const ROTULO_CIELO = Object.freeze({ ...CIELO_ROTULO_PANTALLA, tormenta: 'Tormenta', helada: 'Helada' });

/** Cielos en los que la portada no muestra el disco del astro (W30-r3). */
export const CIELO_SIN_ASTRO = Object.freeze(new Set(['nublado', 'niebla', 'lluvia', 'tormenta']));

/*
 * Copia literal de tres lecturas privadas de ClimaBoletinScreen.jsx (no se
 * exportan desde un archivo de componentes). Si allí cambian, aquí también:
 * pendiente de moverlas a un módulo compartido (ver el informe de la pasada 1).
 */
export function horaLocalFinca(date, timezone) {
    try {
        return Number(new Intl.DateTimeFormat('en-US', {
            timeZone: timezone || 'America/Bogota', hour: '2-digit', hourCycle: 'h23',
        }).format(date));
    } catch {
        return null;
    }
}

function fechaLocalISO(date) {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
}

export function alertaObservada(alerta) {
    const texto = `${alerta?.tipo || alerta?.type || ''} ${alerta?.estado || alerta?.status || ''}`.toLowerCase();
    return alerta?.observada === true || alerta?.observed === true || alerta?.medida === true
        || alerta?.measured === true || /\b(escarcha|helada negra)\b/.test(texto);
}

export function alertaParaEstaMadrugada(alerta, date) {
    if (alertaObservada(alerta)) return false;
    const dias = Array.isArray(alerta?.dias) ? alerta.dias : [];
    const fechas = [...dias, alerta?.fecha, alerta?.date, alerta?.valid_date, alerta?.starts_at]
        .filter(Boolean).map((value) => String(value).slice(0, 10));
    const cercanas = new Set([fechaLocalISO(date), fechaLocalISO(new Date(date.getTime() + 24 * HORA))]);
    return fechas.some((fecha) => cercanas.has(fecha));
}

/**
 * La nubosidad que se dibuja: el techo cerrado con nublado, lluvia, tormenta y
 * niebla; con cielo abierto, nubes sueltas en proporción a la cobertura (si se
 * sabe). Sin cielo conocido, ninguna nube.
 * @returns {{ techo: boolean, sueltas: number, cobertura: number|null } | null}
 */
function nubesDe(condicion, cobertura) {
    if (!condicion) return null;
    if (['nublado', 'lluvia', 'tormenta', 'niebla'].includes(condicion)) return { techo: true, sueltas: 0, cobertura };
    if (cobertura == null) return condicion === 'parcial' ? { techo: false, sueltas: 3, cobertura } : null;
    const sueltas = Math.round(Math.min(100, Math.max(0, cobertura)) / 100 * 7);
    return sueltas > 0 ? { techo: false, sueltas, cobertura } : null;
}

/**
 * Lee la escena del mundo.
 * @param {{ agrometeo?: any, snapshot?: any, location?: any, ahoraMs: number, gate?: {clima?: string|null, luz?: string|null},
 *   perfil?: any, enso?: string|null }} entrada
 */
export function escenaDelMundo({ agrometeo = null, snapshot = null, location = null, ahoraMs, gate = {}, perfil = null, enso = null }) {
    const reloj = new Date(ahoraMs);
    const alertasLocales = Array.isArray(snapshot?.alertas_locales) ? snapshot.alertas_locales : [];
    const alertasOpenMeteo = Array.isArray(snapshot?.openmeteo?.alertas) ? snapshot.openmeteo.alertas : [];
    const alertas = alertasLocales.length > 0 ? alertasLocales : alertasOpenMeteo;
    const atmosfera = deriveAtmosphere({ snapshot: location ? snapshot : null, now: reloj, location });
    const piso = clasificarPisoTermico(location?.elevation);
    const zona = agrometeo?.timezone || snapshot?.timezone || 'America/Bogota';
    const horaFinca = horaLocalFinca(reloj, zona);
    const heladas = location ? alertas.filter((a) => /helad|escarch|frost/i.test(`${a?.tipo || ''} ${a?.mensaje || ''}`)) : [];
    const observada = heladas.some(alertaObservada);
    const pronosticada = !observada && heladas.some((a) => alertaParaEstaMadrugada(a, reloj));
    const tramo = tramoDeLaNoche(momentoDeLaFinca(agrometeo, ahoraMs), agrometeo?.heladaNoche);
    const banda = bandaHelada({ observada, alertaMadrugada: pronosticada, riesgo: agrometeo?.heladaRiesgo, tramo });
    const cielo = resolverCielo({
        gate,
        condicionDato: condicionAhora(agrometeo, location?.elevation, ahoraMs),
        condicionSnapshot: snapshot?.stale ? null : atmosfera.condicion,
        luzDato: atmosfera.luz,
        helada: heladaVisible({ observada, alertaMadrugada: pronosticada, hora: horaFinca }),
    });
    const condicion = cielo.clima ?? null;
    const luz = cielo.luz ?? null;
    const hayDato = Boolean(agrometeo?.now);
    const cobertura = num(agrometeo?.now?.cloud);
    const condicionEscena = escenaDelCielo(condicion, cobertura);
    const clave = claveCielo({ clima: condicionEscena, luz });

    // El astro: la regla de la portada, y además sin cielo conocido no hay disco.
    let astro = null;
    if (hayDato && condicion && luz && !CIELO_SIN_ASTRO.has(condicion)) {
        const arco = arcoDelSol(reloj, agrometeo);
        const luna = luz === 'noche' ? lunaDeHoy(reloj) : null;
        astro = {
            tipo: luna ? 'luna' : 'sol',
            velo: condicion === 'parcial' ? 'velado' : null,
            luna,
            // Avance del sol entre la salida y la puesta del pronóstico; null si no se sabe.
            avance: luna ? null : (arco?.avance ?? (luz === 'amanecer' ? 0 : luz === 'atardecer' ? 1 : null)),
            salida: arco?.salida ?? null,
            puesta: arco?.puesta ?? null,
        };
    }

    // La lluvia que cae: SOLO la medida en el intervalo en curso (la fila
    // HH:00 es la lluvia de HH−1 a HH) y solo con el cielo de lluvia o
    // tormenta, que es lo que dice la portada. Sin esa cifra no hay gotas: la
    // lluvia de la hora anterior no se dibuja como si fuera de esta.
    let lluvia = null;
    if (hayDato && (condicion === 'lluvia' || condicion === 'tormenta')) {
        const intervalo = lluviaDelIntervaloEnCurso(agrometeo, ahoraMs);
        if (intervalo && intervalo.mm > 0) lluvia = { mm: intervalo.mm, desde: intervalo.finEpoch - HORA, hasta: intervalo.finEpoch };
    }

    // Lo que la escena DICE de la lluvia de ahora, con la regla de «¿Llueve?»:
    // con código de lluvia y sin cifra en curso no hay gotas, pero tampoco se
    // dice que no llueve.
    const lluviaAhora = hayDato ? lluviaDeAhora(agrometeo, ahoraMs) : null;

    const niebla = condicion === 'niebla' ? { densidad: densidadNiebla(agrometeo), humedad: num(agrometeo?.now?.rh) } : null;
    const viento = hayDato ? vientoAhora(agrometeo, ahoraMs) : null;
    const temperatura = hayDato ? num(agrometeo.now.temp) : null;
    const estrellas = luz === 'noche' && ['despejado', 'parcial', 'helada'].includes(condicion)
        ? (condicion === 'parcial' ? 'pocas' : 'muchas') : null;

    const { cultivos } = parseCultivos(perfil?.cultivos_actuales);
    const veredicto = veredictoDelDia({
        agrometeo, ahoraMs, granizo: avisoGranizo(agrometeo?.granizoRiesgo), enso, pisoTermico: piso?.id,
        elevation: location?.elevation, frescura: frescuraDelDato(agrometeo, ahoraMs, zona), timeZone: zona,
        pendiente: perfil?.finca_pendiente_aproximada || '', cultivos: cultivos.map((c) => c.key), sesgoSitio: snapshot?.sesgoSitio,
    });
    const fila = (id) => veredicto?.filas.find((f) => f.id === id) ?? null;

    return {
        hayDato,
        condicion,
        luz,
        clave,
        piso: piso?.id ?? null,
        rotulo: condicion ? (ROTULO_CIELO[condicion] ?? null) : null,
        temperatura,
        astro,
        nubes: nubesDe(condicion, cobertura),
        lluvia,
        lluviaAhora,
        niebla,
        relampago: condicion === 'tormenta',
        escarcha: condicion === 'helada' ? (banda?.titulo ?? 'Helada') : null,
        estrellas,
        viento: viento?.kmh != null ? { kmh: viento.kmh, direccion: viento.direccion } : null,
        tramo,
        banda,
        titular: veredicto?.titular?.texto ?? null,
        lluviaRespuesta: fila('lluvia')?.respuesta ?? null,
        heladaPregunta: fila('helada')?.pregunta ?? null,
        heladaRespuesta: fila('helada')?.respuesta ?? null,
        zona,
        ahoraMs,
    };
}

/**
 * Lo que se dice al tocar cada capa: solo con el dato de la escena.
 * @param {ReturnType<typeof escenaDelMundo>} e
 */
export function etiquetasDeLaEscena(e) {
    /** @type {Record<string, string>} */
    const t = {};
    if (e.astro?.tipo === 'sol') {
        const horas = e.astro.salida && e.astro.puesta
            ? ` Salió a las ${horaConMinutosEsCO(e.astro.salida, e.zona)} y se pone a las ${horaConMinutosEsCO(e.astro.puesta, e.zona)}.` : '';
        t.astro = `${e.astro.velo ? 'Sol entre nubes.' : 'Sol.'}${horas}`;
    } else if (e.astro?.tipo === 'luna') {
        t.astro = `${e.astro.luna.name}${e.astro.velo ? ', entre nubes' : ''}.`;
    }
    if (e.nubes) {
        const parte = e.nubes.cobertura == null ? '' : `: ${Math.round(e.nubes.cobertura)} % del cielo`;
        t.nubes = `${e.nubes.techo ? 'Cielo tapado' : 'Nubes sueltas'}${parte}.`;
    }
    if (e.lluvia) {
        t.lluvia = e.lluvia.desde != null
            ? `Lluvia ${rangoCorto(e.lluvia.desde, e.lluvia.hasta, e.ahoraMs, e.zona)}: ${cifra(e.lluvia.mm, 1)} mm.`
            : `Lluvia de esta hora: ${cifra(e.lluvia.mm, 1)} mm.`;
    }
    if (e.niebla) t.niebla = e.niebla.humedad == null ? 'Niebla.' : `Niebla: el aire está a ${Math.round(e.niebla.humedad)} % de humedad.`;
    if (e.relampago) t.relampago = 'Tormenta eléctrica: no trabaje en potrero abierto ni bajo un árbol solo mientras truene.';
    if (e.escarcha) t.escarcha = `${e.escarcha}.`;
    if (e.viento) t.viento = `Viento de ${Math.round(e.viento.kmh)} km/h.`;
    return t;
}

/** Hora de la finca dicha corta («1 p. m.»), para el encabezado. */
export const horaDeLaEscena = (e) => horaEsCO(e.ahoraMs, e.zona);
