import { PRONOSTICO_TTL_MS, vigenciaPronostico } from '../../services/vigenciaPronostico.js';
/**
 * cieloHoy.js — lecturas PURAS que la pantalla del tiempo hace sobre datos que
 * los servicios ya calcularon. No pide nada a la red, no cambia ningún servicio
 * y no inventa: si falta el dato, devuelve null y la UI lo dice.
 *
 * Qué resuelve:
 *   - el cielo que se pinta (condición + luz), con dos estados que el gate
 *     global no conoce: tormenta y helada;
 *   - la clave de paleta con la que se re-entinta toda la interfaz;
 *   - la frescura de cada fuente;
 *   - el veredicto del día (¿hiela?, ¿llueve y a qué hora?, ¿aplico?, ¿riego?);
 *   - el granizo SOLO como riesgo (nunca como observación);
 *   - el viento de ahora, las próximas 24 horas y la luna de hoy.
 */
import { leerGateAtmosfera } from '../../services/atmosphereService.js';
import { MSG } from '../../config/messages.js';
import { lunarPhase } from '../../utils/skyEphemeris.js';
import { interpretarFranjaProteccion, interpretarHelada } from '../../visual/mundo3d/interpretacionPanelSierra.js';
import { ordenarDecisionesSierra } from '../../visual/mundo3d/prioridadPanelSierra.js';
import { accionDecisionSierra } from '../../visual/mundo3d/accionDecisionSierra.js';
import { horaEsCO, diaEsCO } from '../../utils/fechaEsCO.js';
import { frostPisoForElevation, HORA_FIN_MADRUGADA, REGLA_P, REGLA_VIGILAR } from '../../services/frostRisk.js';
import { riesgoSanitarioDesdeAgrometeo, tituloSanitarioDeCultivos, riesgosSanitariosDeCultivos } from '../../services/riesgoSanitarioPiso.js';

const num = (value) => {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

/** Cifra con coma decimal es-CO. */
export function cifra(valor, decimales = 1) {
    const n = num(valor);
    if (n == null) return null;
    return n.toLocaleString('es-CO', { maximumFractionDigits: decimales, minimumFractionDigits: 0 });
}

/* ── Cielo que se pinta ─────────────────────────────────────────────── */

/** Estados del cielo que la escena sabe pintar y el gate global no acepta. */
export const CIELOS_PROPIOS = Object.freeze(['tormenta', 'helada']);

/**
 * Gate local de la pantalla: acepta lo mismo que `leerGateAtmosfera` y además
 * `?clima=tormenta` y `?clima=helada`. Igual que el gate global, NO toca datos:
 * solo fuerza la escena para revisarla.
 */
/** @param {string} [search] */
export function leerGateCielo(search = globalThis.location?.search ?? '') {
    const base = leerGateAtmosfera(search);
    const crudo = new URLSearchParams(search).get('clima');
    return {
        clima: base.clima || (CIELOS_PROPIOS.includes(crudo) ? crudo : null),
        luz: base.luz,
    };
}

// Mismos umbrales que atmosphereService (niebla de tierra alta con cielo cubierto).
const NIEBLA_ALTA_MSNM = 2600;
const NIEBLA_ALTA_PCT = 80;
// Corte con que la escena pinta techo de nubes o sol (el de atmosphereService).
const NUBLADO_PCT = 60;

/** El cielo según el código WMO (tabla de la OMM): 0–1, 2 y 3. */
const CIELO_WMO = { 0: 'despejado', 1: 'despejado', 2: 'parcial', 3: 'nublado' };
/** Lo mismo por el rótulo, si el código no viene aparte. */
const CIELO_ROTULO = { Despejado: 'despejado', 'Cielo despejado': 'despejado', 'Casi despejado': 'despejado', 'Parcialmente nublado': 'parcial', Nublado: 'nublado' };

/**
 * El cielo solo por la nubosidad, para cuando no hay código WMO (la madrugada
 * del cálculo de helada es un promedio de nubes). Con los cortes de la regla
 * de helada: hasta el de «noche despejada» (REGLA_P), despejado; hasta el de
 * vigilancia (REGLA_VIGILAR), parcialmente nublado; por encima, nublado.
 */
export function cieloPorNubes(nubes) {
    const n = num(nubes);
    if (n == null) return null;
    if (n <= REGLA_P.nube_pct) return 'despejado';
    return n <= REGLA_VIGILAR.nube_pct ? 'parcial' : 'nublado';
}

/**
 * Lluvia del intervalo en curso según la serie horaria: la fila cuyo sello
 * cierra la hora que está corriendo (la precipitación de HH:00 es la de HH−1 a
 * HH). `{ mm, finEpoch }`, o null si la serie no trae ese intervalo o su cifra.
 */
export function lluviaDelIntervaloEnCurso(agrometeo, ahoraMs = Date.now()) {
    const offset = offsetDe(agrometeo);
    if (offset == null) return null;
    for (const h of agrometeo?.vientoHorario?.horas ?? []) {
        const fin = epochDeHoraLocal(h.time, offset);
        if (fin != null && fin - 3600000 <= ahoraMs && ahoraMs < fin) {
            const mm = num(h.lluviaMm);
            return mm == null ? null : { mm, finEpoch: fin };
        }
    }
    return null;
}

/**
 * ¿Llueve ahora? Manda la lluvia medida del intervalo en curso; el código del
 * cielo y la lluvia del bloque actual solo deciden si la serie no trae ese
 * intervalo. Un código de llovizna con 0 mm en la hora que corre es de la hora
 * anterior, no de esta.
 */
export function llueveAhora(agrometeo, ahoraMs = Date.now()) {
    const medida = lluviaDelIntervaloEnCurso(agrometeo, ahoraMs);
    if (medida) return medida.mm > 0;
    const familia = agrometeo?.now?.weather?.family;
    return num(agrometeo?.now?.precip) > 0 || familia === 'lluvia' || familia === 'tormenta';
}

/** La frase corta de cada estado de la lluvia de ahora, sin cifras. */
export const FRASE_LLUVIA_AHORA = Object.freeze({
    'con-cifra': 'Llueve ahora.',
    'sin-cifra': 'Llueve ahora, sin cantidad medida.',
    'no-llueve': 'Ahora no llueve.',
});

/**
 * La lluvia de ahora en tres estados, con la misma regla que «¿Llueve?»
 * (`llueveAhora`): «con-cifra» si la hora en curso trae su cantidad,
 * «sin-cifra» si llueve según el código del tiempo pero esa cantidad falta
 * (como la tormenta sin cantidad: no se inventa un número ni se niega la
 * lluvia) y «no-llueve». `mm` solo con cifra. Sin pronóstico, null.
 * @returns {{ estado: 'con-cifra'|'sin-cifra'|'no-llueve', mm: number|null, frase: string } | null}
 */
export function lluviaDeAhora(agrometeo, ahoraMs = Date.now()) {
    if (!agrometeo?.now) return null;
    const medida = lluviaDelIntervaloEnCurso(agrometeo, ahoraMs);
    const estado = !llueveAhora(agrometeo, ahoraMs) ? 'no-llueve' : medida?.mm > 0 ? 'con-cifra' : 'sin-cifra';
    return { estado, mm: estado === 'con-cifra' ? medida.mm : null, frase: FRASE_LLUVIA_AHORA[estado] };
}

/**
 * Condición del cielo AHORA a partir de la lectura horaria que agroMeteoService
 * ya trae (`now.weather` = código WMO traducido, `now.cloud` = nubosidad %).
 * Es más fresca que el snapshot del sidecar, que puede venir vencido y cuyo
 * respaldo es el primer día guardado. Manda el código (0–1 despejado,
 * 2 parcialmente nublado, 3 nublado); la nubosidad solo decide sin código, y
 * la niebla de tierra alta. «Lluvia» solo si llueve ahora (`llueveAhora`): con
 * el intervalo en curso seco, el cielo lo dice la nubosidad. Sin señal devuelve null.
 */
export function condicionAhora(agrometeo, elevation = null, ahoraMs = Date.now()) {
    const now = agrometeo?.now;
    if (!now || agrometeo?.stale) return null;
    const familia = now.weather?.family;
    const etiqueta = now.weather?.label;
    if (familia === 'tormenta') return 'tormenta';
    if (familia === 'lluvia' && llueveAhora(agrometeo, ahoraMs)) return 'lluvia';
    if (etiqueta === 'Neblina') return 'niebla';
    const nubes = num(now.cloud);
    const msnm = num(elevation);
    if (nubes != null && msnm != null && msnm >= NIEBLA_ALTA_MSNM && nubes >= NIEBLA_ALTA_PCT) return 'niebla';
    // Sin el campo `code` (lecturas guardadas de antes), vale el rótulo; con
    // `code: null` la fuente no trajo código y decide la nubosidad.
    const porCodigo = 'code' in (now.weather ?? {}) ? CIELO_WMO[num(now.weather.code)] : CIELO_ROTULO[etiqueta];
    return porCodigo ?? cieloPorNubes(nubes);
}

/**
 * El cielo que pinta la escena y entinta la interfaz. La escena conoce dos
 * cielos sin lluvia (sol y techo de nubes); el parcialmente nublado toma uno
 * u otro por la nubosidad, con el mismo corte de siempre.
 */
export function escenaDelCielo(clima, nubes = null) {
    if (clima !== 'parcial') return clima;
    const n = num(nubes);
    return n != null && n >= NUBLADO_PCT ? 'nublado' : 'despejado';
}

/** El cielo dicho dentro de una frase: «se espera …» y «Ahora …». */
const CIELO_FRASE = Object.freeze({
    despejado: 'cielo despejado', parcial: 'cielo parcialmente nublado', nublado: 'cielo nublado',
    niebla: 'niebla', lluvia: 'lluvia', tormenta: 'tormenta',
});
const CIELO_AHORA = Object.freeze({
    despejado: 'el cielo está despejado', parcial: 'el cielo está parcialmente nublado', nublado: 'el cielo está nublado',
    niebla: 'hay niebla', lluvia: 'llueve', tormenta: 'hay tormenta',
});

/** Rótulo del cielo en la portada (uno por estado, el mismo en toda la pantalla). */
export const CIELO_ROTULO_PANTALLA = Object.freeze({
    despejado: 'Despejado', parcial: 'Parcialmente nublado', nublado: 'Nublado', lluvia: 'Lluvia', niebla: 'Niebla',
});

/**
 * La escarcha solo se pinta cuando el dato la sostiene: una helada OBSERVADA o
 * una alerta del pronóstico para ESTA madrugada, y solo dentro de la ventana
 * 03:00–09:00 (hora de la finca), que es cuando se ve. `heladaRiesgo` NO pinta
 * escarcha: después de medianoche ese riesgo ya es el de la noche SIGUIENTE
 * (frostRisk.js, `nextNightDates`), no el de la madrugada en curso. La
 * temporada ENSO tampoco pinta nada.
 */
export function heladaVisible({ observada = false, alertaMadrugada = false, hora = null } = {}) {
    const h = num(hora);
    if (h == null || h < 3 || h >= 9) return false;
    return Boolean(observada) || Boolean(alertaMadrugada);
}

/**
 * La banda de helada solo sale con una de tres pruebas: helada observada,
 * alerta del pronóstico para esta madrugada o riesgo ALTO de `heladaRiesgo`
 * (que es de la noche que viene y se rotula así). Nunca por temporada ENSO.
 */
export function bandaHelada({ observada = false, alertaMadrugada = false, riesgo = null, tramo = 'esta noche' } = {}) {
    if (observada) return { clave: 'observada', titulo: 'Helada observada' };
    if (alertaMadrugada) return { clave: 'pronosticada', titulo: 'Helada pronosticada para esta madrugada' };
    // «de helar» y no «de helada» en la madrugada: con «helada esta madrugada» el
    // título pasa a dos renglones a 390 px y «Hoy» plegado crece 10 px (W19D).
    if (riesgo === 'alto') return { clave: 'riesgo-alto', titulo: tramo === 'esta madrugada' ? 'Riesgo alto de helar esta madrugada' : `Riesgo alto de helada ${tramo}` };
    return null;
}

/** Resuelve el cielo final. El gate manda; luego la helada visible; luego el dato. */
/** @param {{gate?: {clima?: string|null, luz?: string|null}, condicionDato?: string|null, condicionSnapshot?: string|null, luzDato?: string|null, helada?: boolean}} [opciones] */
export function resolverCielo({ gate = {}, condicionDato = null, condicionSnapshot = null, luzDato = null, helada = false } = {}) {
    const luz = gate.luz || luzDato || null;
    if (gate.clima) return { clima: gate.clima, luz };
    const base = condicionDato || condicionSnapshot || null;
    if (helada && (base == null || base === 'despejado' || base === 'parcial' || base === 'nublado')) return { clima: 'helada', luz };
    return { clima: base, luz };
}

/** Clave de paleta con la que se re-entinta toda la interfaz. */
export function claveCielo({ clima = null, luz = null } = {}) {
    if (clima === 'tormenta' || clima === 'helada') return clima;
    if (luz === 'noche') return 'noche';
    if (clima === 'despejado' && (luz === 'amanecer' || luz === 'atardecer')) return 'dorada';
    return clima || 'sin-dato';
}

/** Cielos claros llevan tinta oscura; el resto, tinta clara. */
export function tonoCielo(clave) {
    return ['despejado', 'niebla', 'helada'].includes(clave) ? 'claro' : 'oscuro';
}

/* ── Frescura por fuente ────────────────────────────────────────────── */

/** Vida útil del pronóstico en la caché de agroMeteoService (FORECAST_TTL_MS). */
export const VIDA_DEL_DATO_MS = PRONOSTICO_TTL_MS;

/** El único formato de fecha de la pantalla: «23 sept, 1:05 a. m.». */
export function fechaHora(ms, timeZone = 'America/Bogota') {
    if (!Number.isFinite(ms)) return null;
    const date = new Date(ms);
    const fecha = date.toLocaleDateString('es-CO', { timeZone, day: 'numeric', month: 'short' });
    const hora = horaEsCO(date, timeZone);
    return hora ? `${fecha}, ${hora}` : null;
}

/**
 * Frescura del pronóstico de Open-Meteo, que es el que rige las cifras de arriba.
 *  - `vencido`: agroMeteoService devolvió la copia guardada (sin red) o el dato
 *    ya pasó su vida útil mientras la pantalla seguía abierta.
 *  - `fresco`: consultado hace menos de 3 horas.
 *  - `sin-dato`: aún no hay pronóstico.
 */
export function frescuraDelDato(agrometeo, ahoraMs = Date.now(), timeZone = 'America/Bogota') {
    const vigencia = vigenciaPronostico(agrometeo, ahoraMs);
    return { ...vigencia, hora: fechaHora(vigencia.cuandoMs, timeZone) };
}

/** Frescura del snapshot del servidor (fase ENSO y alertas), por separado. */
export function frescuraDelSnapshot(snapshot, timeZone = 'America/Bogota') {
    if (!snapshot) return { estado: 'sin-dato', hora: null };
    const cuando = num(snapshot.saved_at) ?? Date.parse(snapshot.fetched_at || '');
    const hora = fechaHora(Number.isFinite(cuando) ? cuando : NaN, timeZone);
    return { estado: snapshot.stale ? 'vencido' : 'fresco', hora };
}

/* ── Granizo: solo riesgo ───────────────────────────────────────────── */

/**
 * `deriveHailRisk` solo devuelve 'alto' (WMO 99) o 'medio' (WMO 96) cuando el
 * pronóstico de hoy trae ese código; cualquier otra cosa es null. Esto lo
 * traduce a un aviso de POSIBILIDAD. Nunca afirma que esté granizando.
 */
export function avisoGranizo(granizoRiesgo) {
    if (granizoRiesgo === 'alto') {
        return { nivel: 'alto', titulo: 'Granizo posible hoy', detalle: 'El pronóstico trae tormenta con granizo fuerte. Es un pronóstico del modelo, no una observación.' };
    }
    if (granizoRiesgo === 'medio') {
        return { nivel: 'medio', titulo: 'Granizo posible hoy', detalle: 'El pronóstico trae tormenta con granizo leve. Es un pronóstico del modelo, no una observación.' };
    }
    return null;
}

/* ── Series horarias ────────────────────────────────────────────────── */

function epochDeHoraLocal(time, offsetSeconds) {
    const t = Date.parse(`${time}Z`);
    return Number.isFinite(t) ? t - offsetSeconds * 1000 : null;
}

function offsetDe(agrometeo) {
    const a = num(agrometeo?.utc_offset_seconds);
    if (a != null) return a;
    return num(agrometeo?.vientoHorario?.utcOffsetSeconds);
}

function fechaLocalDe(ms, offset) {
    return new Date(ms + offset * 1000).toISOString().slice(0, 10);
}

function diaSiguiente(fechaIso) {
    return new Date(Date.parse(`${fechaIso}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** Hora en curso, nunca una lectura futura. */
function horaVigente(agrometeo, ahoraMs) {
    const horas = agrometeo?.vientoHorario?.horas;
    const offset = offsetDe(agrometeo);
    if (!Array.isArray(horas) || offset == null) return null;
    let mejor = null;
    let dif = Infinity;
    for (const h of horas) {
        const t = epochDeHoraLocal(h.time, offset);
        if (t == null) continue;
        const d = ahoraMs - t;
        if (d >= 0 && d < 3600000 && d < dif) { dif = d; mejor = { ...h, epoch: t }; }
    }
    return dif <= 90 * 60 * 1000 ? mejor : null;
}

const RUMBOS = ['norte', 'nororiente', 'oriente', 'suroriente', 'sur', 'suroccidente', 'occidente', 'noroccidente'];
const RUMBOS_CORTOS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

/** Grados meteorológicos (de dónde VIENE el viento) a rumbo en español. */
export function rumbo(grados) {
    const g = num(grados);
    if (g == null) return null;
    const i = Math.round((((g % 360) + 360) % 360) / 45) % 8;
    return { nombre: RUMBOS[i], corto: RUMBOS_CORTOS[i] };
}

/**
 * Viento de ahora: velocidad actual de Open-Meteo (`now.viento`), dirección y
 * racha de la hora vigente. Si no hay serie horaria, la dirección dominante
 * del día, rotulada como tal.
 */
export function vientoAhora(agrometeo, ahoraMs = Date.now()) {
    if (!agrometeo) return null;
    const h = horaVigente(agrometeo, ahoraMs);
    const kmh = num(agrometeo.now?.viento) ?? num(h?.velocidad);
    const racha = num(agrometeo.now?.racha) ?? num(h?.racha);
    let direccion = num(agrometeo.now?.direccion) ?? num(h?.direccion);
    let fuenteDireccion = direccion == null ? null : 'hora';
    if (direccion == null) {
        direccion = num(agrometeo.today?.viento_dir);
        fuenteDireccion = direccion == null ? null : 'dominante del día';
    }
    if (kmh == null && direccion == null) return null;
    return { kmh, racha, direccion, fuenteDireccion, rumbo: rumbo(direccion), horaEpoch: h?.epoch ?? null };
}

/**
 * Las próximas 24 horas con lo que el servicio SÍ expone por hora: lluvia,
 * viento, racha. La helada se marca sobre la ventana nocturna que evalúa
 * `deriveFrostRisk` (incluida la madrugada en curso, hora de la finca) con su
 * único nivel (`heladaRiesgo`): el servicio no entrega riesgo hora por hora.
 */
export function proximas24h(agrometeo, ahoraMs = Date.now()) {
    const horas = agrometeo?.vientoHorario?.horas;
    const offset = offsetDe(agrometeo);
    if (!Array.isArray(horas) || offset == null) return null;
    const hoy = fechaLocalDe(ahoraMs, offset);
    const manana = diaSiguiente(hoy);
    // Sin ventana del servicio, la misma regla: hasta las 6:00 la madrugada en
    // curso; desde las 6:00, la noche de hoy.
    const madrugada = new Date(ahoraMs + offset * 1000).getUTCHours() < HORA_FIN_MADRUGADA;
    const nocheDesde = epochDeHoraLocal(agrometeo.heladaNoche?.desde ?? `${hoy}T${madrugada ? '00' : '18'}:00`, offset);
    const nocheHasta = epochDeHoraLocal(agrometeo.heladaNoche?.hasta ?? `${madrugada ? hoy : manana}T07:00`, offset);
    // precipitation es el acumulado (epoch - 1 h, epoch]. Seleccionamos
    // cierres pendientes hasta el horizonte, sin prorratear minutos desconocidos.
    const desde = ahoraMs;
    const hasta = ahoraMs + 24 * 60 * 60 * 1000;
    // Viento y racha de cada sello, para leer el COMIENZO de cada columna (el sello anterior).
    const vientoDelSello = new Map(horas.map((h) => [epochDeHoraLocal(h.time, offset), h]));
    const pasa = (h) => (num(h?.velocidad) ?? 0) >= 15 || (num(h?.racha) ?? 0) >= 15;
    const filas = horas.map((h) => {
        const epoch = epochDeHoraLocal(h.time, offset);
        if (epoch == null || epoch <= desde || epoch > hasta) return null;
        const hora = Number(String(h.time).slice(11, 13));
        // La noche es un intervalo y la fila también (de su comienzo a su
        // sello): la fila es de la noche si su hora cae entera dentro, así la
        // banda empieza y termina en las horas que dice «Noche evaluada…».
        const nocheHelada = nocheDesde != null && nocheHasta != null && epoch - 3600000 >= nocheDesde && epoch <= nocheHasta;
        const viento = num(h.velocidad);
        const racha = num(h.racha);
        return {
            time: h.time, epoch, hora,
            inicioEpoch: epoch - 3600000,
            lluviaMm: num(h.lluviaMm),
            probPct: num(h.probPct),
            viento,
            racha,
            // La regla de «¿Aplico?»: la hora se descarta si el viento o la racha llega a 15 km/h
            // al comenzar (el sello anterior) o al terminar (su sello) (W44, R1 de la v19).
            sopla: pasa(h) || pasa(vientoDelSello.get(epoch - 3600000)),
            // La hora es del día en que empieza: la de las 0:00 es la última del día anterior.
            tormentaParte: tormentaDelParte(agrometeo, fechaLocalDe(epoch - 3600000, offset)) != null,
            direccion: num(h.direccion),
            nocheHelada,
        };
    }).filter(Boolean).sort((a, b) => a.epoch - b.epoch);
    if (filas.length === 0) return null;
    const riesgo = ['alto', 'medio', 'bajo'].includes(agrometeo?.heladaRiesgo) ? agrometeo.heladaRiesgo : null;
    const lluvias = filas.map((f) => f.lluviaMm).filter((v) => v != null);
    const vientos = filas.map((f) => f.viento).filter((v) => v != null);
    const rachas = filas.map((f) => f.racha).filter((v) => v != null);
    const completa = lluvias.length === 24 && filas.length === 24
        && filas.every((f, i) => i === 0 || f.epoch - filas[i - 1].epoch === 3600000);
    // La noche evaluada sigue después del borde de las 24 horas (de 6:00 a 6:59
    // termina a las 7 del día siguiente, una hora después del borde): la franja
    // lo dice en vez de recortarla en silencio (W41, P3 de la v17).
    const nocheSigueHastaEpoch = filas.some((f) => f.nocheHelada) && nocheHasta > filas.at(-1).epoch ? nocheHasta : null;
    return {
        filas,
        heladaRiesgo: riesgo,
        nocheSigueHastaEpoch,
        tramo: tramoDeLaNoche(null, agrometeo?.heladaNoche),
        lluviaTotal: completa ? Math.round(lluvias.reduce((s, v) => s + v, 0) * 10) / 10 : null,
        lluviaMax: lluvias.length ? Math.max(...lluvias) : null,
        vientoMax: vientos.length ? Math.max(...vientos) : null,
        rachaMax: rachas.length ? Math.max(...rachas) : null,
    };
}

/* ── Veredicto del día ──────────────────────────────────────────────── */

function horaCorta(epoch, timeZone = 'America/Bogota') {
    return horaEsCO(epoch, timeZone);
}

/**
 * Las funciones del panel de la Sierra escriben las cifras con punto. La
 * pantalla habla es-CO: se pasa a coma solo el separador ENTRE dígitos.
 */
export function comaDecimal(texto) {
    return typeof texto === 'string' ? texto.replace(/(\d)\.(\d)/g, '$1,$2') : texto;
}

/** «a. m.» + «.» de cierre = «a. m..»: un solo punto. */
export function sinPuntoDoble(texto) {
    return typeof texto === 'string' ? texto.replace(/\.\.(?!\.)/g, '.') : texto;
}

const FIN_DE_FRASE = /^[\s\u00a0]*($|[A-ZÁÉÍÓÚÑ¿¡])/;
const franjaDelDia = (h, meridiano) => (meridiano === 'a'
    ? (h >= 1 && h <= 5 ? 'de la madrugada' : 'de la mañana')
    : (h === 12 ? 'del mediodía' : h <= 6 ? 'de la tarde' : 'de la noche'));

const DIAS_VOZ = { lun: 'lunes', mar: 'martes', mié: 'miércoles', mie: 'miércoles', jue: 'jueves', vie: 'viernes', sáb: 'sábado', sab: 'sábado', dom: 'domingo' };
const MESES_VOZ = { ene: 'enero', feb: 'febrero', mar: 'marzo', abr: 'abril', may: 'mayo', jun: 'junio', jul: 'julio', ago: 'agosto', sep: 'septiembre', sept: 'septiembre', oct: 'octubre', nov: 'noviembre', dic: 'diciembre' };

/**
 * Fechas de la pantalla dichas completas: «dom 4» → «domingo 4», «29 sept» o
 * «29 de sept.» → «29 de septiembre». Solo toca la abreviatura pegada a su
 * número, así que «mar» sin cifra (el sustantivo) no cambia.
 */
export function fechasCompletas(texto) {
    if (typeof texto !== 'string') return texto;
    return texto
        .replace(/(^|[^\p{L}])(lun|mar|mié|mie|jue|vie|sáb|sab|dom)\.?[\s\u00a0]+(\d{1,2})(?!\d)/giu,
            (_, antes, dia, n) => `${antes}${DIAS_VOZ[dia.toLowerCase()]} ${n}`)
        .replace(/(\d{1,2})[\s\u00a0]+(?:de[\s\u00a0]+)?(ene|feb|mar|abr|may|jun|jul|ago|sept|sep|oct|nov|dic)(\.?)(?![\p{L}])/giu,
            (todo, n, mes, punto, pos, texto) => {
                // El punto de la abreviatura se queda solo si también cerraba la frase.
                const cierre = punto && /^[\s\u00a0]*($|[A-ZÁÉÍÓÚÑ¿¡])/.test(texto.slice(pos + todo.length)) ? '.' : '';
                return `${n} de ${MESES_VOZ[mes.toLowerCase()]}${cierre}`;
            });
}

const DIAS_SEMANA_VOZ = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_ANIO_VOZ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «2026-09-29» → «martes 29 de septiembre» (fecha de calendario de la finca). */
export function diaDeVoz(fecha) {
    const m = typeof fecha === 'string' ? fecha.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
    if (!m) return null;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
    return `${DIAS_SEMANA_VOZ[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES_ANIO_VOZ[d.getUTCMonth()]}`;
}

/**
 * Boletín ligero (la cola de «Escuchar» y del desplegable «Texto»). La mínima
 * que dice es la del DÍA y se nombra así, para no confundirla de oído con la
 * de la noche que da la fila de helada.
 */
export function textoLigero({ location, faseLabel, agrometeo, frescura, ahoraMs = Date.now(), timeZone = 'America/Bogota' }) {
    const lugar = [location?.vereda, location?.municipio].filter(Boolean).join(', ') || 'su finca';
    const hoy = agrometeo?.today;
    const temp = Number.isFinite(agrometeo?.now?.temp) ? `${Math.round(agrometeo.now.temp)} grados` : 'temperatura sin dato';
    // La mínima con la misma cifra que la tarjeta de frío (un decimal, sin redondear al límite).
    const minima = Number.isFinite(hoy?.temp_min) ? ` Mínima del día de hoy: ${cifra(hoy.temp_min, 1)} grados.` : '';
    // La lluvia con la misma cifra y la misma ventana que el detalle de
    // «¿Llueve?» (las próximas 24 horas). Con serie horaria pero incompleta,
    // el detalle no suma: el boletín tampoco. Sin serie, el total del día,
    // como la fila «¿Llueve?» sin serie («Hoy: N mm previstos»).
    const conSerie = proximas24h(agrometeo, ahoraMs)?.filas.some((f) => f.lluviaMm != null);
    const acumulado = acumuladoLluvia(agrometeo, ahoraMs, timeZone);
    // Con tormenta y sin cantidad, lo mismo que «¿Llueve?», nunca «0 milímetros».
    const lluvia = tormentaSinCantidad(agrometeo, ahoraMs) ? ` Lluvia: ${TORMENTA_SIN_CANTIDAD.charAt(0).toLowerCase()}${TORMENTA_SIN_CANTIDAD.slice(1)}; puede llover fuerte en poco rato.`
        : acumulado ? ` Lluvia: ${acumulado.charAt(0).toLowerCase()}${acumulado.slice(1)}`
        : !conSerie && Number.isFinite(hoy?.precip_mm) ? ` Lluvia prevista hoy: ${cifra(hoy.precip_mm)} milímetros.` : '';
    const cuando = frescura?.estado === 'fresco' ? `Pronóstico consultado el ${frescura.hora}.`
        : frescura?.estado === 'vencido' ? `Pronóstico vencido: es del ${frescura.hora || 'sin fecha'}, no de ahora.` : 'Sin pronóstico todavía.';
    // Sin fase leída no se lee un rótulo con un error detrás: se omite (W40, J8 de la v17).
    const fase = faseLabel ? ` Fase: ${faseLabel}.` : '';
    return fechasCompletas(sinPuntoDoble(`Boletín del clima para ${lugar}.${fase} Ahora: ${temp}.${minima}${lluvia} ${cuando}`));
}

/**
 * El mismo texto de la pantalla, escrito para la voz: «5 a. m.» se dice «5 de
 * la madrugada», «°C» se dice «grados», y las unidades van en palabras. Las
 * cifras no cambian (la coma decimal se lee «coma»). Cuando la abreviatura
 * cerraba la frase, el punto que ella misma ponía se conserva.
 */
export function paraVoz(texto) {
    if (typeof texto !== 'string') return texto;
    return fechasCompletas(sinPuntoDoble(texto))
        .replace(/(\d{1,2})(?::(\d{2}))?[\s\u00a0]+([ap])\.[\s\u00a0]*m\./g, (_, h, min, meridiano, pos, todo) => {
            const minutos = min && min !== '00' ? ` y ${Number(min)}` : '';
            const cierre = FIN_DE_FRASE.test(todo.slice(pos + _.length)) ? '.' : '';
            return `${Number(h)}${minutos} ${franjaDelDia(Number(h), meridiano)}${cierre}`;
        })
        // «de 10 a 11 de la mañana de mañana» suena a tropiezo.
        .replace(/de la mañana de mañana/g, 'de la mañana siguiente')
        .replace(/(\d)[\s\u00a0]*°C?/g, '$1 grados')
        .replace(/(\d)[\s\u00a0]*km\/h/g, '$1 kilómetros por hora')
        .replace(/(\d)[\s\u00a0]*mm\b/g, '$1 milímetros')
        .replace(/(\d)[\s\u00a0]*%/g, '$1 por ciento')
        .replace(/m s\. n\. m\./g, 'metros sobre el nivel del mar')
        .replace(/[\s\u00a0]+/g, ' ')
        .trim();
}

/** Piso con el que deriveFrostRisk eligió su umbral (el mismo corte por altitud). */
export function pisoDeHelada(elevation) {
    return frostPisoForElevation(elevation);
}

const RIESGOS = ['alto', 'medio', 'bajo'];
const riesgoDe = (agrometeo) => (RIESGOS.includes(agrometeo?.heladaRiesgo) ? agrometeo.heladaRiesgo : null);

/** «la 1 p. m.», «las 5 a. m.»: el artículo concuerda con la hora. */
export function conArticulo(hora) {
    if (typeof hora !== 'string' || !hora) return hora;
    if (hora === 'mediodía') return 'el mediodía';
    if (hora === 'medianoche') return 'la medianoche';
    return `${/^1(\D|$)/.test(hora) ? 'la' : 'las'} ${hora}`;
}

/** «5 a. m.» a partir de «2026-09-24T05:00» (hora local de la finca). */
export function horaDeCampo(time) {
    return horaEsCO(time);
}

/**
 * «Qué hacer» de la tarjeta de frío: solo la acción. No repite la cifra (ya va
 * en la respuesta); el corte que puso el nivel va aparte, en `reglaHelada`
 * (W44, R6 de la v19: la regla no es la acción). Si el nivel no viene de la
 * noche evaluada, no inventa la causa.
 */
export function accionHelada({ riesgo, minima }) {
    if (minima == null) return 'Qué hacer: falta la mínima nocturna para decidir.';
    if (riesgo == null) return 'Qué hacer: todavía falta evaluar el riesgo para decidir.';
    if (riesgo === 'alto') return 'Qué hacer: proteja lo tierno.';
    if (riesgo === 'medio') return 'Qué hacer: mire en el lote si el cielo se despeja y el viento se calma.';
    if (minima <= REGLA_P.minima_c) return 'Qué hacer: tenga a mano con qué cubrir lo tierno por si la noche se despeja.';
    return 'Qué hacer: nada especial por el frío.';
}

/**
 * El corte que puso el nivel de la tarjeta de frío, en palabras de campo: la
 * regla P (aviso de helada) o la de vigilar, leídas de `frostRisk.js`. Los
 * cortes son avisos de la app, no umbrales biológicos: se dicen como tales
 * (W43). Va en su propia línea, no dentro del «Qué hacer» (W44). Null si no
 * hay nivel o no hace falta decirlo.
 */
export function reglaHelada({ riesgo, minima, noche = null }) {
    if (minima == null || riesgo == null) return null;
    const p = REGLA_P;
    const v = REGLA_VIGILAR;
    const aviso = `Chagra avisa helada con ${cifra(p.minima_c)} °C o menos, cielo despejado y sin viento.`;
    const causaDeNoche = noche?.nivel === riesgo && num(noche?.minima_c) != null;
    if (riesgo === 'medio' && causaDeNoche) {
        if (minima <= p.minima_c) return `La mínima llega a ${cifra(p.minima_c)} °C o menos, pero con algo de nube o de viento: por eso Chagra vigila y no avisa helada.`;
        // Los dos cortes con la misma forma, «N °C o menos», para que ninguno se lea «de N hacia arriba».
        return `Chagra vigila con ${cifra(v.minima_c)} °C o menos, pocas nubes y poco viento; avisa helada con ${cifra(p.minima_c)} °C o menos, cielo despejado y sin viento.`;
    }
    if (riesgo === 'bajo' && minima <= p.minima_c) return null;
    return aviso;
}

/**
 * La ventana que evaluó `deriveFrostNight`, dicha desde donde está el lector:
 * de día, «hoy de 6 p. m. a mañana 7 a. m.»; a las 11 p. m., desde esa hora;
 * pasada la medianoche, lo que queda de esta madrugada. Sin `desde` vale la
 * ventana completa de la regla.
 */
export function nocheEvaluada(noche) {
    const m = typeof noche?.desde === 'string' ? noche.desde.match(/T(\d{2}):/) : null;
    const desde = m ? Number(m[1]) : 18;
    if (desde < 7) return `esta madrugada, de ${conArticulo(horaDeCampo(noche.desde))} a las 7 a. m.`;
    return `hoy de ${horaDeCampo(`2000-01-01T${String(desde).padStart(2, '0')}:00`)} a mañana 7 a. m.`;
}

/**
 * Dónde está el reloj de la finca frente a la oscuridad: `dia` (hay luz),
 * `noche` (ya oscureció, antes de la medianoche) o `madrugada` (después de la
 * medianoche, antes de que salga el sol). Con la salida y la puesta del día de
 * la finca cuando el pronóstico las trae; si no, la franja de luz de la Sierra
 * (6 a. m. a 6 p. m.). Sin reloj o sin zona, null: el consejo queda el de día.
 */
export function momentoDeLaFinca(agrometeo, ahoraMs) {
    const offset = offsetDe(agrometeo);
    if (offset == null || !Number.isFinite(ahoraMs)) return null;
    const arco = arcoDelSol(new Date(ahoraMs), agrometeo);
    if (arco) {
        if (ahoraMs < arco.salida.getTime()) return 'madrugada';
        return ahoraMs >= arco.puesta.getTime() ? 'noche' : 'dia';
    }
    const h = horaLocalDe(ahoraMs, offset);
    if (h < HORA_INICIO_LUZ) return 'madrugada';
    return h >= HORA_FIN_LUZ ? 'noche' : 'dia';
}

/**
 * El nombre del tramo que se evalúa, UNO para titular, banda, franja,
 * pregunta, salvedad y voz: «esta madrugada» cuando la noche evaluada es la
 * madrugada en curso (`heladaNoche.desde` antes de las 7), aunque el sol ya
 * haya salido; en cualquier otro caso, «esta noche» (la que viene, o la que ya
 * empezó antes de la medianoche). Lo decide la ventana y no el reloj del sol:
 * a las 6:00 con el sol afuera, la ventana sigue siendo la madrugada.
 */
export function tramoDeLaNoche(momento, noche = null) {
    const m = typeof noche?.desde === 'string' ? noche.desde.match(/T(\d{2}):/) : null;
    return m && Number(m[1]) < 7 ? 'esta madrugada' : 'esta noche';
}

/** Hora de la finca desde la que un titular ya no dice «hoy» (9 p. m.). */
const HORA_SIN_HOY = 21;

/** ¿Pasadas las 9 p. m. en la finca? Sin reloj o sin zona, false. */
export function tardeDeNoche(agrometeo, ahoraMs) {
    const offset = offsetDe(agrometeo);
    return offset != null && Number.isFinite(ahoraMs) && horaLocalDe(ahoraMs, offset) >= HORA_SIN_HOY;
}

/**
 * Titular de helada alta dicho desde la hora de la finca. De día se cubre
 * antes de que oscurezca; ya de noche, lo que aún se puede hacer es cubrir
 * ya lo que siga destapado. Habla de la madrugada siempre que la noche
 * evaluada sea esa madrugada (`heladaNoche.desde` antes de las 7), aunque ya
 * haya salido el sol; si pasada la medianoche lo evaluado es la noche que
 * viene (o no hay ventana), el consejo es para la tarde.
 */
export function titularHeladaAlta(momento, noche = null) {
    if (tramoDeLaNoche(momento, noche) === 'esta madrugada') return 'Esta madrugada puede helar fuerte: cubra ya lo tierno destapado.';
    if (momento === 'noche') return 'Esta noche puede helar fuerte: cubra ya lo tierno que siga destapado.';
    if (momento === 'madrugada') return 'Hoy puede helar fuerte en la noche: cubra lo tierno en la tarde.';
    return 'Esta noche puede helar fuerte: cubra lo tierno antes de que oscurezca.';
}

/**
 * ¿Hiela esta noche? El nivel es el de la noche que viene (`heladaNoche.nivel`
 * o, si falta, `heladaRiesgo`: la serie de 18:00 a 07:00 con mínima, humedad,
 * nubes, viento y suelo). La cifra es la MÍNIMA DE LA NOCHE
 * (`heladaNoche.minima_c` y su hora) cuando el servicio la entrega; si no,
 * la mínima del día, dicha así y sin fingir que es la de la noche. La tarjeta
 * dice UNA sola cifra (la del pronóstico con un decimal, sin redondear al otro
 * lado del límite) y la repite igual donde aparezca. El «Qué hacer» sale de
 * `accionHelada` y el corte que puso el nivel, de `reglaHelada`. El Niño es contexto y
 * nunca sube la respuesta.
 */
/** @returns {FilaVeredicto} */
export function filaHelada(agrometeo, { enso = null, pisoTermico = null, elevation = null, sesgoSitio = null, estacion = null, ahoraMs = null } = {}) {
    const noche = agrometeo?.heladaNoche;
    const riesgo = RIESGOS.includes(noche?.nivel) ? noche.nivel : riesgoDe(agrometeo);
    const momento = momentoDeLaFinca(agrometeo, ahoraMs);
    const tramo = tramoDeLaNoche(momento, noche);
    const minimaNoche = num(noche?.minima_c);
    const minimaDia = num(agrometeo?.today?.temp_min);
    const minima = minimaNoche ?? minimaDia;
    const piso = pisoDeHelada(elevation);
    // Un solo límite: el de la regla P con que se calcula el nivel de la noche.
    const umbral = REGLA_P.minima_c;
    const lectura = interpretarHelada(minima ?? NaN, piso, riesgo);
    const contexto = enso === 'nino' && (pisoTermico === 'frio' || pisoTermico === 'paramo')
        ? `Temporada de El Niño: en su piso ${pisoTermico === 'paramo' ? 'de páramo' : 'frío'} las noches despejadas hielan más. Es contexto, no un aviso para hoy.`
        : null;
    const hora = minimaNoche != null ? horaDeCampo(noche?.horaMinima) : null;
    // La madrugada se evalúa entera: si su mínima ya pasó, se dice en pasado
    // y con su hora («la mínima fue 8,9 °C a las 5 a. m.»).
    const pasada = minimaNoche != null && hora != null && noche?.minimaPasada === true;
    // La misma cifra en toda la tarjeta: un decimal, nunca redondeada al límite.
    const grados = (valor) => `${cifra(valor, 1)} °C`;
    const horaDicha = hora ? ` ${pasada ? 'a' : 'hacia'} ${conArticulo(hora)}` : '';
    let cifraTexto = null;
    if (pasada) cifraTexto = `Mínima del pronóstico (a 2 m): fue ${grados(minimaNoche)}${horaDicha}; en la hoja y el suelo pudo bajar más`;
    else if (minimaNoche != null) cifraTexto = `Mínima del pronóstico (a 2 m): ${grados(minimaNoche)}${horaDicha}; en la hoja y el suelo puede bajar más`;
    else if (minimaDia != null) cifraTexto = `Mínima del pronóstico (a 2 m): ${grados(minimaDia)} (del día, el pronóstico no trae la de la noche); en la hoja y el suelo puede bajar más`;
    let cola = '.';
    if (minima != null && riesgo == null) cola = '. No se pudo calcular si hiela.';
    else if (minimaNoche != null && riesgo === 'bajo') {
        // «Lejos» solo con la cifra de la NOCHE y más de 3 °C sobre la regla P.
        cola = minimaNoche > umbral + 3 ? ', lejos de helar.'
            : minimaNoche > umbral ? ', sin llegar a helar.'
                : ': las nubes o el viento la protegen, pero vigile lo tierno.';
    } else if (minima != null && riesgo === 'bajo') cola = '. El cálculo de la noche da riesgo bajo.';
    const ventana = riesgo ? ` Noche evaluada: ${nocheEvaluada(noche)}.` : '';
    const nube = num(noche?.nubeMadrugada_pct);
    const viento = num(noche?.vientoMadrugada_kmh);
    // Una sola cifra de nubes en la pantalla: la de ahora, en su ficha. La
    // madrugada se dice con palabras; si ya empezó, con el cielo de la portada.
    const enCurso = Number(noche?.desde?.match?.(/T(\d{2}):/)?.[1] ?? 99) < 7;
    const cieloAhora = enCurso ? condicionAhora(agrometeo, elevation, ahoraMs ?? Date.now()) : null;
    const cieloMadrugada = cieloPorNubes(nube);
    let madrugada = '';
    if (riesgo && viento != null && cieloAhora) madrugada = ` Ahora ${CIELO_AHORA[cieloAhora]}; en la madrugada se espera viento de ${cifra(viento, 0)} km/h.`;
    else if (riesgo && viento != null && cieloMadrugada) madrugada = ` En la madrugada se espera ${CIELO_FRASE[cieloMadrugada]} y viento de ${cifra(viento, 0)} km/h.`;
    const observacion = estacion?.available === true && num(estacion.minima_anoche_c) != null
        ? `La estación del IDEAM en ${estacion.nombre || 'la zona'}, a ${cifra(estacion.distancia_km)} km, marcó ${cifra(estacion.minima_anoche_c)} °C anoche${horaDeCampo(estacion.hora_minima) ? ` a ${conArticulo(horaDeCampo(estacion.hora_minima))}` : ''}${Number(estacion.horas_cubiertas) > 0 && Number(estacion.horas_cubiertas) < 24 ? ' (registro parcial)' : ''}.`
        : null;
    const porque = cifraTexto
        ? sinPuntoDoble(comaDecimal([`${cifraTexto}${cola}${ventana}${madrugada}`, observacion].filter(Boolean).join(' ')))
        : 'Falta la mínima del pronóstico: no se puede afirmar ni descartar helada.';
    const base = {
        id: 'helada', pregunta: `¿Hiela ${tramo}?`, titulo: lectura.titulo, tramo,
        minimaDeHoy: minimaDia, minimaNoche, contexto,
        accion: accionHelada({ riesgo, minima }),
        regla: reglaHelada({ riesgo, minima, noche }),
        porque,
        salvedad: riesgo ? salvedadSesgoHelada({ ...noche, sesgoSitio: sesgoSitio ?? noche?.sesgoSitio }, { pisoTermico, riesgo, tramo, pasada }) : null,
    };
    // La respuesta visible lleva la mínima de la noche y su hora.
    let cifraCorta = '';
    // Pasada, del mismo largo que por venir: el plegado de «Hoy» no crece.
    if (pasada) cifraCorta = `: fue ${grados(minimaNoche)}${horaDicha}`;
    else if (minimaNoche != null) cifraCorta = `: ${grados(minimaNoche)}${horaDicha}`;
    let notaMinima = '';
    if (riesgo !== 'bajo' && base.salvedad) notaMinima = pasada ? '; pudo ser más baja' : '; la mínima puede quedar más baja';
    // De oído, «la mínima» de la noche se confunde con la del día que dice el
    // boletín: la voz la nombra con su tramo. La pantalla no cambia.
    let cifraVoz = '';
    if (pasada) cifraVoz = `: la mínima de ${tramo} fue ${grados(minimaNoche)}${horaDicha}`;
    else if (minimaNoche != null) cifraVoz = `: mínima de ${tramo}, ${grados(minimaNoche)}${horaDicha}`;
    let notaVoz = '';
    if (notaMinima) notaVoz = pasada ? '; pudo ser más baja' : '; puede quedar más baja';
    if (riesgo == null) return { ...base, respuesta: 'Sin cálculo', nivel: 'sin-dato' };
    if (riesgo === 'alto') {
        return { ...base, respuesta: `Sí, riesgo alto${cifraCorta}${notaMinima}`, respuestaVoz: `Sí, riesgo alto${cifraVoz}${notaVoz}`, nivel: 'peligro', titular: titularHeladaAlta(momento, noche) };
    }
    if (riesgo === 'medio') {
        return { ...base, respuesta: `Noche fría, vigile${cifraCorta}${notaMinima}`, respuestaVoz: `Noche fría, vigile${cifraVoz}${notaVoz}`, nivel: 'aviso' };
    }
    return { ...base, respuesta: `No se espera${cifraCorta}`, respuestaVoz: `No se espera${cifraVoz}`, nivel: 'bien' };
}

/**
 * Salvedad del pronóstico de helada, del campo estructurado `heladaNoche.sesgo`
 * (nunca del texto de la nota). Solo existe cuando la noche prevista es
 * despejada y en calma en tierra fría: ahí se midió que el modelo deja la
 * madrugada más caliente de lo que llega. Con riesgo bajo y nube o viento que
 * no cumplen esa condición, invita a volver a mirar si el cielo se despeja,
 * salvo que la mínima de la madrugada evaluada ya haya pasado (`pasada`):
 * entonces ya no hay noche por delante que pueda bajar más.
 */
export function salvedadSesgoHelada(noche, { pisoTermico = null, riesgo = null, tramo = 'esta noche', pasada = false } = {}) {
    const sitio = noche?.sesgoSitio;
    const condicionNoche = noche?.sesgo?.condicion;
    if (sitio && condicionNoche && sitio.condicion === condicionNoche
        && num(sitio.p10_c) != null && num(sitio.p90_c) != null) {
        const condicion = sitio.condicion === 'despejada-calma' ? 'despejadas y sin viento' : 'parecidas';
        return `Para esta finca, en noches ${condicion}, la mínima suele estar entre ${cifra(sitio.p10_c)} y ${cifra(sitio.p90_c)} °C. Mire el cielo y el lote.`;
    }
    const grados = num(noche?.sesgo?.grados_c);
    if (noche?.sesgo?.condicion === 'despejada-calma' && grados != null) {
        // Dice quién lo midió (W44, R6 de la v19).
        return 'Medido por Chagra en tierra fría: en noche despejada y sin viento, el pronóstico suele quedar de 2 a 6 °C más caliente, y más si hiela. Mire el cielo y el lote.';
    }
    const cubiertaOConViento = num(noche?.nubeMadrugada_pct) > 30 || num(noche?.vientoMadrugada_kmh) > 8;
    if ((pisoTermico === 'frio' || pisoTermico === 'paramo') && riesgo === 'bajo' && cubiertaOConViento && !pasada) {
        // En la madrugada la pregunta ya nombra el tramo; repetirlo parte el
        // renglón en la columna de escritorio.
        return tramo === 'esta madrugada' ? 'Si el cielo se despeja, vuelva a mirar: puede bajar más.'
            : 'Si el cielo se despeja esta noche, vuelva a mirar: puede bajar más.';
    }
    return null;
}

/** Observación de estación: solo se comunica cuando hay lectura usable. */
export function lineaEstacionAnoche(estacion) {
    if (!estacion || estacion.available === false || num(estacion.minima_anoche_c) == null) return null;
    const km = Number(estacion.distancia_km);
    const horas = Number(estacion.retraso_h);
    const fechaAyer = Number.isFinite(horas) && horas >= 24;
    const sitio = estacion.nombre || estacion.municipio || 'la zona';
    const hora = horaDeCampo(estacion.hora_minima);
    const distancia = Number.isFinite(km) ? `, a ${cifra(km)} km` : '';
    const parcial = Number(estacion.horas_cubiertas) > 0 && Number(estacion.horas_cubiertas) < 24 ? ' (registro parcial)' : '';
    return `La estación del IDEAM en ${sitio}${distancia} marcó ${cifra(estacion.minima_anoche_c)} °C${fechaAyer ? ' (dato de ayer)' : ' anoche'}${hora ? ` a ${conArticulo(hora)}` : ''}${parcial}.`;
}

/** Diferencia de lluvia semanal frente a la fracción semanal de la normal mensual. */
export function anomaliaLluviaSemana(daily, normalMes, fecha = new Date()) {
    const normal = num(normalMes?.precip_mm);
    if (!Array.isArray(daily) || normal == null || normal <= 0) return null;
    const inicio = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const fin = inicio.getTime() + 7 * 86400000;
    const dias = daily.filter((d) => {
        const t = Date.parse(`${d?.date}T00:00:00Z`);
        return Number.isFinite(t) && t >= inicio.getTime() && t < fin;
    });
    if (dias.length < 7 || dias.some((d) => num(d.precip_mm) == null)) return null;
    const lluvia = dias.reduce((s, d) => s + num(d.precip_mm), 0);
    const diasMes = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0)).getUTCDate();
    const esperado = normal * 7 / diasMes;
    return esperado > 0 ? Math.round((lluvia / esperado - 1) * 100) : null;
}

/** Anomalía acumulada del mes: requiere todos los días transcurridos. */
export function anomaliaLluviaMes(daily, normalMes, fecha = new Date()) {
    const normal = num(normalMes?.precip_mm);
    if (!Array.isArray(daily) || normal == null || normal <= 0) return null;
    const inicio = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), 1));
    const hasta = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const transcurridos = fecha.getDate();
    const porFecha = new Map(daily.map((d) => [d?.date, num(d?.precip_mm)]));
    let lluvia = 0;
    for (let dia = 0; dia < transcurridos; dia += 1) {
        const fechaDia = new Date(inicio.getTime() + dia * 86400000).toISOString().slice(0, 10);
        const mm = porFecha.get(fechaDia);
        if (mm == null) return null;
        lluvia += mm;
    }
    const diasMes = new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth() + 1, 0)).getUTCDate();
    const esperado = normal * transcurridos / diasMes;
    return esperado > 0 ? Math.round((lluvia / esperado - 1) * 100) : null;
}

/**
 * Horas de la finca con el día solo donde hace falta: `hora(epoch)` da «las
 * 3 p. m.», `dia(epoch)` el sufijo («», « de mañana», « del lun 29»).
 */
function horasDeLaFinca(ahoraMs, timeZone) {
    const fecha = (epoch) => new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(epoch);
    const hoy = fecha(ahoraMs);
    const manana = fecha(ahoraMs + 86400000);
    // La medianoche es de la noche que cierra: las 00:00 del 28 son «la
    // medianoche» de hoy 27, no «la medianoche de mañana». La que ya pasó hoy
    // (inicio del día en curso) se queda en hoy.
    const diaDe = (epoch) => (horaCorta(epoch, timeZone) === 'medianoche' && fecha(epoch - 1) >= hoy ? fecha(epoch - 1) : fecha(epoch));
    const dia = (epoch) => diaDe(epoch) === hoy ? ''
        : diaDe(epoch) === manana ? ' de mañana' : ` del ${diaEsCO(diaDe(epoch))}`;
    const hora = (epoch) => conArticulo(horaCorta(epoch, timeZone));
    const esManana = (epoch) => diaDe(epoch) === manana;
    return { diaDe, dia, hora, esManana };
}

/**
 * Rango de lluvia en hora de la finca, con el día solo donde hace falta.
 * `desdeHasta` pide «desde … hasta …» también dentro del mismo día (un tramo
 * de varias horas); sin él, un intervalo del mismo día es «entre … y …».
 */
export function rangoLluvia(desde, hasta, ahoraMs, timeZone = 'America/Bogota', { desdeHasta = false } = {}) {
    const { diaDe, dia, hora } = horasDeLaFinca(ahoraMs, timeZone);
    if (diaDe(desde) === diaDe(hasta)) {
        if (desde !== hasta && hora(desde) === hora(hasta)) return `desde ${hora(desde)} hasta ${hora(hasta)} siguiente${dia(hasta)}`;
        if (!desdeHasta) return `entre ${hora(desde)} y ${hora(hasta)}${dia(hasta)}`;
    }
    return `desde ${hora(desde)}${dia(desde)} hasta ${hora(hasta)}${dia(hasta)}`;
}

/**
 * Rango corto para decirlo de corrido: «de 2 a 3 p. m.», «de 11 a. m. al
 * mediodía», «de las 11 p. m. a la 1 a. m. de mañana».
 */
export function rangoCorto(desde, hasta, ahoraMs, timeZone = 'America/Bogota') {
    const { diaDe, dia, hora } = horasDeLaFinca(ahoraMs, timeZone);
    const h1 = horaCorta(desde, timeZone);
    const h2 = horaCorta(hasta, timeZone);
    const sufijo = / [ap]\. m\.$/;
    const mismoDia = diaDe(desde) === diaDe(hasta);
    if (mismoDia && sufijo.test(h1) && sufijo.test(h2) && h1.slice(-5) === h2.slice(-5)) {
        return `de ${h1.slice(0, -6)} a ${h2}${dia(hasta)}`;
    }
    const de = hora(desde).replace(/^el /, 'del ').replace(/^(la|las) /, 'de $1 ');
    const a = hora(hasta).replace(/^el /, 'al ').replace(/^(la|las) /, 'a $1 ');
    return `${de}${mismoDia ? '' : dia(desde)} ${a}${dia(hasta)}`;
}

/**
 * Tramos de lluvia: horas seguidas con lluvia apreciable (≥ 0,2 mm en el
 * intervalo). Una hora seca en medio parte el tramo.
 */
export function tramosDeLluvia(filas, umbral = 0.2) {
    const tramos = [];
    for (const f of filas ?? []) {
        if ((f.lluviaMm ?? 0) < umbral) continue;
        const ultimo = tramos.at(-1);
        if (ultimo && ultimo.hastaEpoch === f.inicioEpoch) {
            ultimo.hastaEpoch = f.epoch;
            ultimo.filas.push(f);
        } else {
            tramos.push({ desdeEpoch: f.inicioEpoch, hastaEpoch: f.epoch, filas: [f] });
        }
    }
    return tramos;
}

/**
 * El total de lluvia de las próximas 24 horas con su ventana, la misma frase
 * en el detalle de «¿Llueve?» y en el boletín (texto y voz): una cifra, una
 * ventana. Sin serie horaria completa, null.
 */
export function acumuladoLluvia(agrometeo, ahoraMs = Date.now(), timeZone = 'America/Bogota') {
    const total = totalLluvia24h(agrometeo, ahoraMs, timeZone);
    return total ? `Se esperan ${cifra(total.mm)}\u00a0mm ${total.ventana}.` : null;
}

/**
 * El total de lluvia de las próximas 24 horas y su ventana dicha («desde las
 * 11 a. m. hasta las 11 a. m. de mañana»). Es el único total del día en la
 * pantalla: la ficha de lluvia lo repite con la misma ventana en vez de dar
 * el del día calendario. Sin serie horaria completa, null.
 * @returns {{ mm: number, ventana: string } | null}
 */
export function totalLluvia24h(agrometeo, ahoraMs = Date.now(), timeZone = 'America/Bogota') {
    const serie = proximas24h(agrometeo, ahoraMs);
    if (serie?.lluviaTotal == null) return null;
    return { mm: serie.lluviaTotal, ventana: rangoLluvia(serie.filas[0].inicioEpoch, serie.filas.at(-1).epoch, ahoraMs, timeZone) };
}

/**
 * Probabilidad de lluvia de la misma ventana que dice «¿Llueve?»: la hora más
 * probable (`precipitation_probability`, de la hora anterior a su sello) de
 * las próximas 24 horas o, si toda la lluvia de esa ventana es de mañana, del
 * día de mañana (el máximo diario de la fuente es el de esas mismas horas).
 * Sin serie horaria de lluvia, la de hoy: es la ventana de la fila sin serie.
 * Si falta la probabilidad de alguna hora de las 24, se cae al máximo diario
 * de la fuente de los días donde cae la lluvia de la ventana (sin lluvia, de
 * los días que toca la ventana), y se dice: «hoy, todo el día». Solo es «sin
 * dato» si también falta el diario de alguno de esos días.
 * @returns {{ pct: number | null, ventana: string, texto: string }}
 */
export function probabilidadLluvia(agrometeo, ahoraMs = Date.now()) {
    const rotulo = (pct, ventana) => ({
        pct, ventana, texto: `Probabilidad máxima por hora ${ventana}: ${pct == null ? 'sin dato' : `${pct}\u00a0%`}`,
    });
    const serie = proximas24h(agrometeo, ahoraMs);
    if (!serie?.filas.some((f) => f.lluviaMm != null)) return rotulo(num(agrometeo?.today?.precip_prob), 'hoy');
    const maxima = (filas) => (filas.length === 24 && filas.every((f) => f.probPct != null) ? Math.max(...filas.map((f) => f.probPct)) : null);
    const offset = offsetDe(agrometeo);
    const manana = diaSiguiente(fechaLocalDe(ahoraMs, offset));
    const desde = epochDeHoraLocal(`${manana}T00:00`, offset);
    const tramos = tramosDeLluvia(serie.filas);
    if (tramos.length && tramos.every((t) => t.desdeEpoch >= desde && t.hastaEpoch <= desde + 86400000)) {
        const horas = agrometeo.vientoHorario.horas.filter((h) => String(h.time).startsWith(manana)).map((h) => ({ probPct: num(h.probPct) }));
        return rotulo(maxima(horas) ?? num(agrometeo?.daily?.find?.((d) => d?.date === manana)?.precip_prob), 'mañana');
    }
    const horaria = maxima(serie.filas);
    if (horaria != null) return rotulo(horaria, 'en las próximas 24 horas');
    // Sin la horaria completa, el máximo diario de esos días (la fuente lo
    // calcula con las horas de cada fecha, que es como se sellan las filas).
    const hoy = fechaLocalDe(ahoraMs, offset);
    const conLluvia = serie.filas.filter((f) => (f.lluviaMm ?? 0) >= 0.2);
    const dias = [...new Set((conLluvia.length ? conLluvia : serie.filas).map((f) => String(f.time).slice(0, 10)))].sort();
    const diaria = (fecha) => num(agrometeo?.daily?.find?.((d) => d?.date === fecha)?.precip_prob) ?? (fecha === hoy ? num(agrometeo?.today?.precip_prob) : null);
    const nombre = (fecha) => (fecha === hoy ? 'hoy' : fecha === manana ? 'mañana' : null);
    const pcts = dias.map(diaria);
    if (!pcts.length || pcts.some((p) => p == null) || !dias.every(nombre)) return rotulo(null, 'en las próximas 24 horas');
    return rotulo(Math.max(...pcts), `${dias.map(nombre).join(' y ')}, todo el día`);
}

/**
 * Largo máximo de la respuesta de «¿Llueve?» con el pico dentro. Medido en el
 * arnés a 390 px: hasta 69 caracteres toda respuesta cupo en dos renglones;
 * con 72 ya hubo una de tres. Si el tramo ya lo llena, el pico se queda en el
 * detalle («Lo más fuerte …»).
 */
/** El corte de «¿Llueve?» y «Escampa»: una hora con menos no cuenta como lluvia (W44, R2 de la v19). */
export const LLUVIA_APRECIABLE_MM = 0.2;

export const LARGO_RESPUESTA_LLUVIA = 69;

/**
 * ¿Llueve y a qué hora? De la serie horaria de las próximas 24 horas, con ese
 * horizonte rotulado. No trae «qué hacer» de riego: el riego es una sola
 * decisión, la fila «¿Riego?».
 */
/** @returns {FilaVeredicto} */
export function filaLluvia(agrometeo, ahoraMs = Date.now(), timeZone = 'America/Bogota') {
    const serie = proximas24h(agrometeo, ahoraMs);
    const intervalo = (f) => rangoLluvia(f.inicioEpoch, f.epoch, ahoraMs, timeZone);
    const acumulado = acumuladoLluvia(agrometeo, ahoraMs, timeZone);
    const fuerte = serie?.filas.reduce((a, f) => (f.lluviaMm ?? 0) > (a?.lluviaMm ?? 0) ? f : a, null);
    const pico = fuerte ? ` Lo más fuerte ${intervalo(fuerte)}.` : '';
    const prob = num(agrometeo?.today?.precip_prob);
    // La hora más probable de la misma ventana que se describe, no una
    // probabilidad del acumulado.
    const probabilidad = probabilidadLluvia(agrometeo, ahoraMs);
    // La cifra va pegada a su rótulo: «todo el día: / 100 %.» quedaba huérfana.
    const probTexto = probabilidad.pct == null ? '' : ` ${probabilidad.texto.replace(/: (?=\d)/, ':\u00a0')}.`;
    // La precipitación horaria corresponde al intervalo que termina en su sello.
    const offset = offsetDe(agrometeo);
    const medidaEnCurso = lluviaDelIntervaloEnCurso(agrometeo, ahoraMs);
    const tramos = tramosDeLluvia(serie?.filas);
    const { dia, hora, esManana } = horasDeLaFinca(ahoraMs, timeZone);
    const conFin = (epoch) => `${hora(epoch)}${dia(epoch)}`;
    // Borde del horizonte: si el último tramo llega a la última hora de las 24
    // y la fuente sigue con lluvia en la hora siguiente (o no la trae), el
    // tramo sigue abierto: se dice «desde …», nunca con una hora de fin que
    // es solo el borde de la ventana.
    const abierto = (() => {
        const t = tramos.at(-1);
        if (!t || t.hastaEpoch + 3600000 <= ahoraMs + 24 * 3600000) return null;
        const siguiente = agrometeo?.vientoHorario?.horas?.find((h) => epochDeHoraLocal(h.time, offset) === t.hastaEpoch + 3600000);
        const mm = num(siguiente?.lluviaMm);
        return mm == null || mm >= 0.2 ? t : null;
    })();
    const corto = (t) => (t === abierto ? `desde ${conFin(t.desdeEpoch)}` : rangoCorto(t.desdeEpoch, t.hastaEpoch, ahoraMs, timeZone));
    // Las horas secas entre tramos se dicen: «Escampa de 3 a 4 p. m.».
    const escampa = tramos.slice(1).map((t, i) => rangoCorto(tramos[i].hastaEpoch, t.desdeEpoch, ahoraMs, timeZone));
    const escampaTexto = escampa.length ? ` Escampa ${escampa.join(', ').replace(/, ([^,]*)$/, ' y $1')}.` : '';
    const tramosLluvia = tramos.map((t) => ({ desdeEpoch: t.desdeEpoch, hastaEpoch: t.hastaEpoch, ...(t === abierto ? { abierto: true } : {}) }));
    const picoLluvia = fuerte && (fuerte.lluviaMm ?? 0) >= 0.2 ? { desdeEpoch: fuerte.inicioEpoch, hastaEpoch: fuerte.epoch } : null;
    if (llueveAhora(agrometeo, ahoraMs)) {
        // El intervalo en curso es la primera fila: si llueve en él, el tramo
        // que arranca ahí dice hasta cuándo sigue, aunque sea de una hora. Con
        // menos de 0,2 mm en curso, la lluvia de ahora acaba con su hora (o
        // sigue en el tramo que empieza justo ahí).
        const pegado = medidaEnCurso && tramos[0]?.desdeEpoch === medidaEnCurso.finEpoch ? tramos[0] : null;
        const actual = tramos[0]?.desdeEpoch <= ahoraMs ? tramos[0] : pegado;
        const fin = actual ? actual.hastaEpoch : medidaEnCurso?.finEpoch;
        const hasta = actual === abierto && actual ? ' y sigue en las próximas 24 horas'
            : fin != null ? ` y hasta ${conFin(fin)}` : '';
        const despues = tramos.filter((t) => t !== actual);
        const vuelve = despues.length === 1 ? `; vuelve ${corto(despues[0])}`
            : despues.length > 1 ? `; vuelve a ratos ${abierto ? `desde ${conFin(despues[0].desdeEpoch)}` : `hasta ${conFin(despues.at(-1).hastaEpoch)}`}` : '';
        return { id: 'lluvia', pregunta: '¿Llueve?', respuesta: `Sí, ahora${hasta}${vuelve}`, nivel: serie?.lluviaTotal >= 10 ? 'aviso' : 'info',
            porque: sinPuntoDoble(`Se espera lluvia durante esta hora. Confirme en el lote.${acumulado ? ` ${acumulado}` : ''}${pico}${escampaTexto}${probTexto}`),
            titular: `Está lloviendo${hasta.replace(/^ y hasta/, ' hasta')}: lo que haya que aplicar, en una franja seca.`, desdeEpoch: ahoraMs,
            tramosLluvia, picoLluvia };
    }
    if (serie && serie.filas.some((f) => f.lluviaMm != null)) {
        const primera = serie.filas.find((f) => (f.lluviaMm ?? 0) >= 0.2);
        // Sin hora con lluvia medible pero con tormenta en el parte de hoy: la
        // tormenta se dice, sin inventarle cantidad ni hora.
        const tormentaHoy = tormentaSinCantidad(agrometeo, ahoraMs);
        if (tormentaHoy) {
            // Sin «Se esperan 0 mm»: la ventana se nombra sin cifra (W41, resto de J6 de la v17).
            const ventana = totalLluvia24h(agrometeo, ahoraMs, timeZone)?.ventana;
            return {
                id: 'lluvia', pregunta: '¿Llueve?', respuesta: TORMENTA_SIN_CANTIDAD, nivel: 'aviso', tormenta: tormentaHoy,
                porque: `Ninguna hora trae lluvia apreciable${ventana ? ` ${ventana}` : ''}, pero el parte del día trae ${tormentaHoy.razon}: puede llover fuerte en poco rato.${probTexto}`,
            };
        }
        if (!primera && acumulado) {
            return {
                id: 'lluvia', pregunta: '¿Llueve?', respuesta: 'Sin lluvia apreciable en estos intervalos', nivel: 'bien',
                porque: `${acumulado} Sin lluvia apreciable en ninguna hora.${probTexto}`,
            };
        }
        if (!primera) return { id: 'lluvia', pregunta: '¿Llueve?', respuesta: 'Sin dato completo', nivel: 'sin-dato',
            porque: 'Faltan intervalos de lluvia para evaluar el horizonte completo.' };
        // La fuente ubica la lluvia dentro de la hora anterior al sello. El
        // tramo va entero (de la primera a la última hora con lluvia), con su
        // pico; si escampa en medio, se nombran los dos tramos o, con más,
        // se dice a ratos.
        const primero = tramos[0];
        const ultimo = tramos.at(-1);
        const unaHora = tramos.length === 1 && primero.filas.length === 1 && !abierto;
        // Con dos tramos, si el pico es uno entero (de una hora) se marca ahí
        // en vez de repetir la misma franja.
        const picoEsTramo = tramos.length === 2 && tramos.find((t) => t.filas.length === 1 && t.filas[0] === fuerte && t !== abierto);
        const nombrarTramo = (t, conPico) => `${corto(t)}${conPico && t === picoEsTramo ? ' (la más fuerte)' : ''}`;
        const desdeHasta = (t1, t2) => (t2 === abierto ? `desde ${conFin(t1.desdeEpoch)}`
            : rangoLluvia(t1.desdeEpoch, t2.hastaEpoch, ahoraMs, timeZone, { desdeHasta: true }));
        const cuandoCon = (conPico) => (unaHora ? intervalo(primera)
            : tramos.length === 1 ? desdeHasta(primero, primero)
                : tramos.length === 2 ? `${nombrarTramo(primero, conPico)} y ${nombrarTramo(ultimo, conPico)}`
                    : `a ratos, ${desdeHasta(primero, ultimo)}`);
        // Lluvia pareja (todas las horas iguales): no hay hora más fuerte que nombrar.
        const pareja = tramos.every((t) => t.filas.every((f) => f.lluviaMm === fuerte.lluviaMm));
        const picoCorto = unaHora || picoEsTramo || pareja ? '' : `; lo más fuerte ${rangoCorto(fuerte.inicioEpoch, fuerte.epoch, ahoraMs, timeZone)}`;
        // Todo mañana y «de mañana» repetido: se dice una vez, al frente.
        const completo = `${cuandoCon(true)}${picoCorto}`;
        const todoManana = tramos.every((t) => esManana(t.desdeEpoch) && (t === abierto || esManana(t.hastaEpoch)));
        const enDia = (x) => (todoManana && completo.split(' de mañana').length > 2 ? `mañana ${x.replaceAll(' de mañana', '')}` : x);
        // Dos renglones a lo sumo: si con el pico no cabe, el pico queda en el detalle.
        const conPico = `Sí, ${enDia(completo)}`;
        const respuesta = conPico.length <= LARGO_RESPUESTA_LLUVIA ? conPico : `Sí, ${enDia(cuandoCon(false))}`;
        const cuando = enDia(cuandoCon(respuesta === conPico));
        const ratos = tramos.length > 2 ? ` Llueve ${tramos.map(corto).join(', ').replace(/, ([^,]*)$/, ' y $1')}.` : '';
        return {
            id: 'lluvia', pregunta: '¿Llueve?', respuesta,
            nivel: serie.lluviaTotal >= 10 ? 'aviso' : 'info',
            porque: sinPuntoDoble(`${acumulado ?? 'Faltan intervalos para sumar el horizonte completo.'} Lo más fuerte ${intervalo(fuerte)}.${ratos}${escampaTexto}${probTexto}`),
            // De noche ya no se aplica (la fila «¿Aplico?» habla de mañana): no se invita a aplicar antes.
            titular: (momentoDeLaFinca(agrometeo, ahoraMs) ?? 'dia') === 'dia'
                ? `Lluvia prevista ${cuando}: lo que haya que aplicar, antes.`
                : `Lluvia prevista ${cuando}: no aplique hasta que pase y seque la hoja.`,
            desdeEpoch: primera.inicioEpoch,
            tramosLluvia, picoLluvia,
        };
    }

    const mm = num(agrometeo?.today?.precip_mm);
    // Sin serie por hora, la tormenta del parte tampoco se dice «0 mm».
    const tormentaHoy = tormentaSinCantidad(agrometeo, ahoraMs);
    if (tormentaHoy) {
        return {
            id: 'lluvia', pregunta: '¿Llueve?', respuesta: TORMENTA_SIN_CANTIDAD, nivel: 'aviso', tormenta: tormentaHoy,
            porque: `El parte del día trae ${tormentaHoy.razon} sin cantidad de lluvia: puede llover fuerte en poco rato; sin serie por hora para decir a qué hora.${probTexto}`,
        };
    }
    if (mm == null && prob == null) {
        return { id: 'lluvia', pregunta: '¿Llueve?', respuesta: 'Sin dato', nivel: 'sin-dato', porque: 'El pronóstico no trae lluvia para hoy.' };
    }
    const probable = (prob != null && prob >= 60) || (mm != null && mm >= 10);
    return {
        id: 'lluvia', pregunta: '¿Llueve?', respuesta: probable ? 'Probable hoy' : 'Poco probable', nivel: probable ? 'aviso' : 'bien',
        porque: `Hoy: ${mm == null ? 'sin milímetros' : `${cifra(mm)} mm`} previstos; sin serie por hora para decir a qué hora.${probTexto}`,
        titular: probable ? `Lluvia probable${tardeDeNoche(agrometeo, ahoraMs) ? '' : ' hoy'}: no aplique foliares.` : null,
    };
}

/**
 * ¿Aplico? La franja la decide `interpretarViento`, la misma del panel de la
 * Sierra: horas de luz de HOY con velocidad y racha < 15 km/h y sin lluvia.
 * Es el único motor de «aplicar»: la semana lo usa día por día
 * (`franjasAplicarSemana`).
 */
/** @returns {FilaVeredicto} */
function filaAplicarActual(agrometeo, ahoraMs = Date.now()) {
    const offset = offsetDe(agrometeo);
    if (offset != null && agrometeo?.vientoHorario && horaLocalDe(ahoraMs, offset) >= HORA_FIN_LUZ) {
        return filaAplicarDeNoche(agrometeo, ahoraMs, offset);
    }
    const hoy = fechaLocalDe(ahoraMs, offset ?? -18000);
    const tormenta = tormentaDelParte(agrometeo, hoy);
    if (tormenta) return filaAplicarTormenta(tormenta, 'Hoy');
    const { lectura, trasHelada } = lecturaAplicarDelDia(agrometeo, hoy, ahoraMs, offset);
    // La aclaración de la Sierra remite a la racha máxima que su panel muestra
    // al lado; aquí esa cifra no está, así que se dice sin remitir a ella.
    const detalle = lectura.detalle.replace(
        ' La máxima diaria ocurre fuera de la franja de aplicación; por eso conviven ambas cifras.',
        ' Las rachas más fuertes del día caen fuera de esa franja.',
    );
    const porque = comaDecimal(`${trasHelada ? `${RAZON_HELADA} ` : ''}${detalle}`);
    const base = {
        id: 'aplicar', pregunta: '¿Aplico?', titulo: lectura.titulo, porque,
        accion: lectura.titulo.startsWith('No hay franja')
            ? MSG.clima.sinVentanaProteccion
            : 'Si decide proteger, use solo un biopreparado del catálogo de la casa y siga su etiqueta.',
    };
    const franja = lectura.titulo.match(/Aplicar por protección: (.+)$/);
    if (franja) {
        return { ...base, trasHelada, respuesta: `Sí, hoy ${franjaDeCampo(franja[1])}${trasHelada ? SUFIJO_HELADA : ''}`, nivel: 'bien', titular: sinPuntoDoble(`Franja probable para aplicar hoy: ${franjaDeCampo(franja[1])}${trasHelada ? SUFIJO_HELADA : ''}.`) };
    }
    if (lectura.titulo.startsWith('No hay franja')) {
        const inicio = offset == null ? HORA_INICIO_LUZ : horaLocalDe(ahoraMs, offset);
        const causa = causaSinFranja(agrometeo?.vientoHorario, fechaLocalDe(ahoraMs, offset ?? -18000), inicio);
        return { ...base, respuesta: 'Hoy no', nivel: 'aviso', titular: causa ? `No hay ventana que aguante: ${causa}.` : 'Hoy no hay una ventana segura para aplicar.' };
    }
    return { ...base, respuesta: 'Sin cálculo', nivel: 'sin-dato' };
}

/**
 * Tormenta en el parte diario de `fecha`: código WMO 95–99 de la fuente
 * (95 tormenta eléctrica; 96 y 99, con granizo). Ese día no se ofrece franja
 * aunque las horas sin lluvia y el viento lo permitan.
 */
export function tormentaDelParte(agrometeo, fecha) {
    const dia = (Array.isArray(agrometeo?.daily) ? agrometeo.daily : []).find((d) => d?.date === fecha);
    const codigo = num(dia?.weathercode);
    if (codigo == null || codigo < 95 || codigo > 99) return null;
    return { codigo, razon: codigo === 96 || codigo === 99 ? 'tormenta con granizo' : 'tormenta eléctrica' };
}

/** Lo que dicen la fila, la ficha y la voz cuando la fuente trae tormenta sin cantidad. */
export const TORMENTA_SIN_CANTIDAD = 'Posible tormenta, sin cantidad medida';

/**
 * Tormenta en el parte de hoy sin lluvia apreciable que decir: con la serie
 * horaria completa, ninguna hora con ≥ 0,2 mm; sin serie, el total del día
 * por debajo de eso o sin dato. Es la condición de «Posible tormenta, sin
 * cantidad medida» de «¿Llueve?», y la ficha y la voz la leen de aquí para no
 * decir «0 mm» donde la fila dice tormenta (W40, J6 de la v17).
 */
export function tormentaSinCantidad(agrometeo, ahoraMs = Date.now()) {
    const offset = offsetDe(agrometeo);
    if (offset == null || llueveAhora(agrometeo, ahoraMs)) return null;
    const tormenta = tormentaDelParte(agrometeo, fechaLocalDe(ahoraMs, offset));
    if (!tormenta) return null;
    const serie = proximas24h(agrometeo, ahoraMs);
    if (serie?.filas.some((f) => f.lluviaMm != null)) {
        if (serie.lluviaTotal == null || serie.filas.some((f) => (f.lluviaMm ?? 0) >= 0.2)) return null;
        return tormenta;
    }
    const mm = num(agrometeo?.today?.precip_mm);
    return mm == null || mm < 0.2 ? tormenta : null;
}

/**
 * Fin de la ventana de helada (`hasta`, 7 a. m.) cuando la madrugada de
 * `fecha` fue de helada alta por la regla P (`heladaNoche` o
 * `heladaMadrugada`, la que termina en esa fecha). Antes, la hoja sigue con
 * escarcha o mojada del deshielo: la franja no empieza.
 */
export function finDeHeladaAlta(agrometeo, fecha, offset) {
    if (offset == null) return null;
    const noche = [agrometeo?.heladaNoche, agrometeo?.heladaMadrugada]
        .find((n) => n?.nivel === 'alto' && String(n.hasta ?? '').slice(0, 10) === fecha);
    return noche ? epochDeHoraLocal(noche.hasta, offset) : null;
}

const RAZON_HELADA = 'La madrugada trae helada alta: la franja empieza cuando cierra la ventana de helada, a las 7 a. m., porque antes la hoja sigue con escarcha o mojada del deshielo.';
const SUFIJO_HELADA = ', pasada la helada';

/** El motor de la franja para `fecha` desde `inicioMs`, corrido tras una helada alta. */
function lecturaAplicarDelDia(agrometeo, fecha, inicioMs, offset) {
    const finHelada = finDeHeladaAlta(agrometeo, fecha, offset);
    const trasHelada = finHelada != null && finHelada > inicioMs;
    return { lectura: interpretarFranjaProteccion(agrometeo?.vientoHorario, trasHelada ? finHelada : inicioMs), trasHelada };
}

/** «¿Aplico?» de un día con tormenta en el parte: no, y por qué. */
/** @returns {FilaVeredicto} */
function filaAplicarTormenta(tormenta, dia, extra = {}) {
    const porque = `El parte de ${dia === 'Hoy' ? 'hoy' : 'mañana'} trae ${tormenta.razon}: no se ofrece franja aunque haya horas sin lluvia y con poco viento. La tormenta puede llegar fuera de las horas que marca el pronóstico.`;
    return {
        id: 'aplicar', pregunta: '¿Aplico?', titulo: 'No hay franja de protección', tormenta,
        respuesta: `${dia} no, hay ${tormenta.razon}`, nivel: 'aviso',
        titular: `${dia} no se recomienda aplicar: el pronóstico trae ${tormenta.razon}.`,
        porque, accion: MSG.clima.sinVentanaProteccion, ...extra,
    };
}

/** Precisión por días de calendario de la finca, no por horas transcurridas. */
export function textoFranja(franja, fecha, hoy) {
    const plazo = Math.round((Date.parse(fecha) - Date.parse(hoy)) / 86400000);
    if (!Number.isFinite(plazo) || plazo > 7) return 'revise más cerca';
    if (plazo <= 2) return franjaDeCampo(franja);
    const horas = franja.match(/(\d{2}):00/g)?.map((h) => Number(h.slice(0, 2))) ?? [];
    return horas[0] < 12 && horas[1] <= 12 ? 'por la mañana'
        : horas[0] >= 12 ? 'por la tarde' : 'durante el día';
}

/** Hoy y la semana comparten la próxima franja, incluido el veto diario. */
/** @returns {FilaVeredicto} */
export function filaAplicar(agrometeo, ahoraMs = Date.now()) {
    const actual = filaAplicarActual(agrometeo, ahoraMs);
    const franjas = franjasAplicarSemana(agrometeo, ahoraMs);
    if (!franjas.length) return actual;
    const proxima = franjas.find((f) => f.franja);
    const hoy = fechaLocalDe(ahoraMs, offsetDe(agrometeo));
    if (proxima) {
        const esHoy = proxima.date === hoy;
        const cuando = `${diaEsCO(proxima.date)}, ${textoFranja(proxima.franja, proxima.date, hoy)}`;
        const helada = proxima.trasHelada ? SUFIJO_HELADA : '';
        // Con tormenta en el parte, el «no» lleva su razón (hoy, o mañana si ya es de noche).
        const hoyNo = actual.tormenta ? actual.respuesta : actual.nivel === 'sin-dato' ? 'Hoy, sin cálculo' : 'Hoy no';
        return {
            ...actual,
            titulo: esHoy ? `Aplicar por protección: ${proxima.franja}` : 'No hay franja de protección hoy',
            respuesta: esHoy ? `Sí, hoy ${franjaDeCampo(proxima.franja)}${helada}` : `${hoyNo}. La próxima: ${cuando}${helada}`,
            // La voz dice la fecha entera («martes 29 de septiembre»); la pantalla, la corta.
            respuestaVoz: esHoy ? undefined : `${hoyNo}. La próxima: ${diaDeVoz(proxima.date) ?? diaEsCO(proxima.date)}, ${textoFranja(proxima.franja, proxima.date, hoy)}${helada}`,
            titular: esHoy ? `Franja probable para aplicar hoy: ${franjaDeCampo(proxima.franja)}${helada}`
                : actual.tormenta ? `${actual.titular} La próxima franja probable: ${cuando}${helada}`
                    : actual.deNoche && proxima.date === diaSiguiente(hoy) ? `Ya es de noche: mañana puede aplicar ${franjaDeCampo(proxima.franja)}${helada}, si se confirma el pronóstico.`
                        : `${actual.nivel === 'sin-dato' ? 'Hoy no se puede evaluar' : 'Hoy no se aplica'}. La próxima franja probable: ${cuando}${helada}`,
            nivel: esHoy && !proxima.alBorde ? 'bien' : 'aviso',
            margen: proxima.margen,
            fechaMargen: diaEsCO(proxima.date),
            condiciones: [
                ...(!esHoy ? [`Hoy (${diaEsCO(hoy)}): ${actual.deNoche ? 'ya no hay luz para aplicar.' : actual.tormenta ? `el parte trae ${actual.tormenta.razon}.` : 'sin franja que reúna las condiciones.'}`] : []),
                ...(!esHoy && actual.deNoche && actual.tormenta ? [`Mañana (${diaEsCO(diaSiguiente(hoy))}): el parte trae ${actual.tormenta.razon}.`] : []),
                `${esHoy ? 'Hoy' : diaEsCO(proxima.date)}, ${textoFranja(proxima.franja, proxima.date, hoy)}: ${proxima.detalle}`,
            ],
            accion: 'Confirme la hoja seca en el lote y el pronóstico antes de aplicar. Siga la etiqueta del biopreparado.',
            porque: esHoy ? proxima.detalle : actual.tormenta ? actual.porque : num(agrometeo?.today?.precip_mm) >= 10
                ? 'Hoy se descarta la aplicación con lluvia diaria prevista de 10 mm o más.' : actual.porque,
        };
    }
    // La tormenta del parte es la razón más fuerte: va antes que la lluvia diaria.
    if (actual.tormenta) return actual;
    // La tarjeta semanal también descarta días con lluvia acumulada alta.
    const fechaEvaluada = actual.deNoche ? diaSiguiente(hoy) : hoy;
    const diaEvaluado = agrometeo.daily?.find((d) => d.date === fechaEvaluada);
    if (num(diaEvaluado?.precip_mm) >= 10) return {
        ...actual, titulo: 'No hay franja de protección', respuesta: actual.deNoche ? 'Hoy no. Mañana tampoco' : 'Hoy no', nivel: 'aviso',
        titular: `${actual.deNoche ? 'Mañana' : 'Hoy'} no se recomienda aplicar: lluvia diaria prevista de 10 mm o más.`,
        porque: 'Se descarta la aplicación con lluvia diaria prevista de 10 mm o más. No aparece otra franja en las horas disponibles.',
        accion: MSG.clima.sinVentanaProteccion,
    };
    return actual;
}

/* La franja de luz del motor de la Sierra (`interpretarViento`). */
const HORA_INICIO_LUZ = 6;
const HORA_FIN_LUZ = 18;

function horaLocalDe(ms, offset) {
    return new Date(ms + offset * 1000).getUTCHours();
}

/**
 * La causa real de que no haya franja en las horas de luz de `fecha` desde
 * `desdeHora`: viento, lluvia o las dos. Nunca una disyuntiva: si no se puede
 * saber, no se dice causa.
 */
export function causaSinFranja(vientoHorario, fecha, desdeHora = HORA_INICIO_LUZ) {
    const horas = Array.isArray(vientoHorario?.horas) ? vientoHorario.horas : [];
    let viento = 0;
    let lluvia = 0;
    for (const h of horas) {
        const t = String(h?.time ?? '');
        const hora = Number(t.slice(11, 13));
        if (t.slice(0, 10) !== fecha) continue;
        if (hora >= desdeHora && hora < HORA_FIN_LUZ && (num(h.velocidad) >= 15 || num(h.racha) >= 15)) viento += 1;
        // El sello HH es la lluvia de HH−1 a HH: las horas de luz desde
        // `desdeHora` son los sellos de desdeHora + 1 a HORA_FIN_LUZ.
        if (hora > desdeHora && hora <= HORA_FIN_LUZ && num(h.lluviaMm) > 0) lluvia += 1;
    }
    if (viento > 0 && lluvia > 0) return 'hay viento fuerte y lluvia';
    if (viento > 0) return 'hay viento de 15 km/h o más';
    if (lluvia > 0) return 'hay lluvia prevista';
    return null;
}

/** «06:00 a 07:00; 09:00 a 11:00» → «de 6 a 7 a. m. y de 9 a 11 a. m.». */
export function franjaDeCampo(rangos) {
    const partes = String(rangos ?? '').split(';').map((r) => r.trim().match(/^(\d{2}):00 a (\d{2}):00$/));
    if (partes.length === 0 || partes.some((m) => !m)) return rangos;
    return partes.map(([, a, b]) => {
        const ini = Number(a);
        const fin = Number(b);
        if ([ini, fin].some((h) => h === 0 || h === 12)) {
            const hora = (h) => horaEsCO(`2000-01-01T${String(h).padStart(2, '0')}:00`);
            return `de ${hora(ini)} a ${hora(fin)}`;
        }
        const mer = (h) => (h < 12 ? 'a. m.' : 'p. m.');
        const h12 = (h) => h % 12 || 12;
        return mer(ini) === mer(fin) ? `de ${h12(ini)} a ${h12(fin)} ${mer(fin)}` : `de ${h12(ini)} ${mer(ini)} a ${h12(fin)} ${mer(fin)}`;
    }).join(' y ');
}

/**
 * De noche ya no hay horas de luz de hoy: la fila habla de mañana, con el
 * mismo motor evaluado desde las 5 a. m. de mañana. La causa es la noche, no
 * el viento ni la lluvia.
 */
/** @returns {FilaVeredicto} */
function filaAplicarDeNoche(agrometeo, ahoraMs, offset) {
    const manana = diaSiguiente(fechaLocalDe(ahoraMs, offset));
    const tormenta = tormentaDelParte(agrometeo, manana);
    if (tormenta) {
        const fila = filaAplicarTormenta(tormenta, 'Mañana', { deNoche: true });
        return { ...fila, porque: `Ya es de noche: hoy no quedan horas de luz. ${fila.porque}` };
    }
    const inicio = Date.parse(`${manana}T05:00:00Z`) - offset * 1000;
    const { lectura, trasHelada } = lecturaAplicarDelDia(agrometeo, manana, inicio, offset);
    const detalle = lectura.detalle
        .replace(/^Hoy,/, 'Mañana,')
        .replace(' La máxima diaria ocurre fuera de la franja de aplicación; por eso conviven ambas cifras.', ' Las rachas más fuertes de mañana caen fuera de esa franja.');
    const base = {
        id: 'aplicar', pregunta: '¿Aplico?', titulo: lectura.titulo, deNoche: true, trasHelada,
        porque: comaDecimal(`Ya es de noche: hoy no quedan horas de luz. ${trasHelada ? `${RAZON_HELADA} ` : ''}${detalle}`),
        accion: lectura.titulo.startsWith('No hay franja')
            ? MSG.clima.sinVentanaProteccion
            : 'Si decide proteger, use solo un biopreparado del catálogo de la casa y siga su etiqueta.',
    };
    const franja = lectura.titulo.match(/Aplicar por protección: (.+)$/)?.[1];
    if (franja) {
        const texto = sinPuntoDoble(`${franjaDeCampo(franja)}${trasHelada ? SUFIJO_HELADA : ''}`);
        return { ...base, respuesta: `Mañana, ${texto}`, nivel: 'info', titular: sinPuntoDoble(`Ya es de noche: mañana puede aplicar ${texto}.`) };
    }
    if (lectura.titulo.startsWith('No hay franja')) {
        const causa = causaSinFranja(agrometeo.vientoHorario, manana, 5);
        return {
            ...base, respuesta: 'Mañana no', nivel: 'aviso',
            titular: causa ? `Mañana no hay ventana que aguante: ${causa}.` : 'Mañana no hay una ventana segura para aplicar.',
        };
    }
    return { ...base, respuesta: 'Mañana, sin cálculo', nivel: 'sin-dato', titular: 'Ya es de noche: hoy no se aplica.' };
}

/** Días desde hoy (el servicio trae ayer en el índice 0 por past_days=1). */
export function diasDesdeHoy(agrometeo) {
    const dias = Array.isArray(agrometeo?.daily) ? agrometeo.daily : [];
    const hoy = agrometeo?.today?.date;
    return hoy ? dias.filter((d) => d?.date >= hoy) : dias;
}

const suma = (valores) => (valores.length > 0 && valores.every((v) => v != null)
    ? Math.round(valores.reduce((s, v) => s + v, 0) * 10) / 10 : null);

/** Días que mira la decisión de riego: hoy y los dos siguientes. */
export const DIAS_RIEGO = 3;

/**
 * Nota de ladera: solo con balance a favor de la lluvia y pendiente declarada.
 * Chagra no supone una pendiente por defecto.
 */
export function notaLadera(exceso, pendiente) {
    if (!exceso) return null;
    if (pendiente === 'Fuerte') return 'Usted declaró pendiente fuerte: parte de esa lluvia se va ladera abajo, no queda guardada en el suelo.';
    if (pendiente === 'Suave') return 'Usted declaró pendiente suave: mire dónde se encharca antes de decidir el riego de mañana.';
    return null;
}

/**
 * ¿Riego? La ÚNICA decisión de agua de la pantalla. El «Qué hacer» es la línea
 * del suelo de la Sierra (`accionDecisionSierra('suelo')`: lluvia frente a
 * evaporación) aplicada a los próximos días, no a uno solo. La humedad del
 * suelo de la hora vigente va como evidencia: Chagra no conoce la textura del
 * lote, así que no la convierte en «seco» o «húmedo» con un umbral inventado.
 */
/**
 * Lo que falta del horizonte de riego desde la hora de la finca: la lluvia de
 * cada hora cuyo intervalo no ha cerrado (la hora en curso entra entera)
 * hasta la medianoche del último día, y la evaporación de esas mismas horas.
 * La evaporación por hora sale de la fuente si la trae; si no, la de hoy se
 * reparte por la radiación de cada hora (o por las horas de luz) y los días
 * siguientes van enteros. Sin serie horaria completa, null: se usan los días
 * enteros y así se dice.
 * @returns {{ lluvia: number|null, eto: number|null }|null}
 */
export function balanceRestante(agrometeo, dias, ahoraMs) {
    const horas = agrometeo?.vientoHorario?.horas;
    const offset = offsetDe(agrometeo);
    if (!Array.isArray(horas) || offset == null || !dias.length || ahoraMs == null) return null;
    const hoy = fechaLocalDe(ahoraMs, offset);
    if (dias[0]?.date !== hoy) return null;
    const finHoy = epochDeHoraLocal(`${diaSiguiente(hoy)}T00:00`, offset);
    const fin = epochDeHoraLocal(`${diaSiguiente(dias.at(-1).date)}T00:00`, offset);
    const conEpoch = horas.map((h) => ({ ...h, epoch: epochDeHoraLocal(h.time, offset) })).filter((h) => h.epoch != null);
    const filas = conEpoch.filter((h) => h.epoch > ahoraMs && h.epoch <= fin).sort((a, b) => a.epoch - b.epoch);
    const esperadas = Math.round((fin - (Math.floor(ahoraMs / 3600000) * 3600000 + 3600000)) / 3600000) + 1;
    if (filas.length !== esperadas || filas.some((h) => num(h.lluviaMm) == null)) return null;
    const lluvia = suma(filas.map((h) => num(h.lluviaMm)));
    let eto = null;
    if (filas.every((h) => num(h.etoMm) != null)) {
        eto = suma(filas.map((h) => num(h.etoMm)));
    } else {
        const delDia = conEpoch.filter((h) => h.epoch > finHoy - 86400000 && h.epoch <= finHoy);
        const peso = delDia.length === 24 && delDia.every((h) => num(h.radiacion) != null) ? (h) => num(h.radiacion)
            : delDia.length === 24 && delDia.every((h) => h.esDia != null) ? (h) => (h.esDia ? 1 : 0) : null;
        const total = peso ? delDia.reduce((t, h) => t + peso(h), 0) : 0;
        const etoHoy = num(dias[0]?.eto_mm);
        const resto = suma(dias.slice(1).map((d) => num(d?.eto_mm)));
        if (peso && total > 0 && etoHoy != null && (dias.length === 1 || resto != null)) {
            const parte = delDia.filter((h) => h.epoch > ahoraMs).reduce((t, h) => t + peso(h), 0) / total;
            eto = Math.round((etoHoy * parte + (resto ?? 0)) * 10) / 10;
        }
    }
    return { lluvia, eto };
}

/** @returns {FilaVeredicto} */
export function filaRiego(agrometeo, { pendiente = '', ahoraMs = null } = {}) {
    const dias = diasDesdeHoy(agrometeo).slice(0, DIAS_RIEGO);
    const calculado = balanceRestante(agrometeo, dias, ahoraMs);
    const restante = calculado?.eto != null ? calculado : null;
    const lluvia = restante ? restante.lluvia : suma(dias.map((d) => num(d?.precip_mm)));
    const eto = restante ? restante.eto : suma(dias.map((d) => num(d?.eto_mm)));
    const capas = agrometeo?.humedadSueloCapas;
    const capa = num(capas?.['3_9cm']) != null ? { mm: num(capas['3_9cm']), prof: 'de 3 a 9 cm' }
        : num(capas?.['1_3cm']) != null ? { mm: num(capas['1_3cm']), prof: 'de 1 a 3 cm' } : null;
    const sueloTexto = capa == null
        ? ' Sin lectura de agua en el suelo: toque la tierra a un palmo antes de regar.'
        : ` Agua en el suelo ahora, ${capa.prof} de hondo: ${cifra(capa.mm)} % del volumen. Toque la tierra a un palmo para saber si le falta.`;
    const accion = accionDecisionSierra('suelo', { lluvia: lluvia ?? NaN, eto: eto ?? NaN })
        .replace('la ETo', 'lo que se evapora').replace('ETo', 'evaporación');
    const base = { id: 'riego', pregunta: '¿Riego?', accion, lluviaMm: lluvia, evaporaMm: eto, dias: dias.length };
    if (lluvia == null || eto == null) {
        return { ...base, respuesta: 'Sin cálculo', nivel: 'sin-dato', porque: `Falta lluvia o evaporación de los próximos días.${sueloTexto}`.trim(), contexto: null };
    }
    const dicho = dias.length === 1 ? 'hoy' : `hoy y los ${dias.length - 1} días siguientes`;
    const horizonte = restante ? `Lo que falta de ${dicho}` : dicho.charAt(0).toUpperCase() + dicho.slice(1);
    const exceso = lluvia > eto;
    // Bajo tormenta sin cantidad, «llegan 0 mm» contradice a «¿Llueve?» (W41, resto de J6 de la v17).
    const llegan = ahoraMs != null && cifra(lluvia) === '0' && tormentaSinCantidad(agrometeo, ahoraMs)
        ? 'el pronóstico no trae lluvia medida, aunque sí posible tormenta,' : `llegan ${cifra(lluvia)} mm de lluvia`;
    return {
        ...base,
        respuesta: exceso ? 'No hace falta' : 'Solo si la tierra está seca',
        nivel: exceso ? 'bien' : 'info',
        porque: comaDecimal(`${horizonte}: ${llegan} y se evaporan ${cifra(eto)} mm.${sueloTexto}`),
        contexto: notaLadera(exceso, pendiente),
    };
}

/**
 * La semana con el MISMO motor de «aplicar» que hoy (`interpretarViento`),
 * evaluado día por día desde las 5 a. m. de cada fecha. Hoy se evalúa desde
 * ahora. Devuelve una fila por día con su franja o null.
 */
export function franjasAplicarSemana(agrometeo, ahoraMs = Date.now()) {
    const offset = offsetDe(agrometeo);
    if (!agrometeo?.vientoHorario || offset == null) return [];
    const hoy = fechaLocalDe(ahoraMs, offset);
    return diasDesdeHoy(agrometeo).filter((d) => d.date >= hoy).sort((a, b) => a.date.localeCompare(b.date)).map((d) => {
        const inicio0 = d.date === hoy ? ahoraMs : Date.parse(`${d.date}T05:00:00Z`) - offset * 1000;
        const { lectura, trasHelada } = lecturaAplicarDelDia(agrometeo, d.date, inicio0, offset);
        const inicio = trasHelada ? finDeHeladaAlta(agrometeo, d.date, offset) : inicio0;
        const diaria = (agrometeo.daily || []).find((x) => x.date === d.date);
        const tormenta = tormentaDelParte(agrometeo, d.date);
        const franja = tormenta || num(diaria?.precip_mm) >= 10 ? null : lectura.titulo.match(/Aplicar por protección: (.+)$/)?.[1] ?? null;
        const evaluable = Boolean(tormenta) || num(diaria?.precip_mm) >= 10 || franja != null || lectura.titulo.startsWith('No hay franja');
        const primera = franja?.split(';')[0].trim() ?? null;
        const plazo = Math.round((Date.parse(d.date) - Date.parse(hoy)) / 86400000);
        const detalle = tormenta ? `El parte trae ${tormenta.razon}: no se ofrece franja.`
            : `${trasHelada && primera ? `${RAZON_HELADA} ` : ''}${lectura.detalle}`;
        return { date: d.date, franja: primera, evaluable, trasHelada: trasHelada && primera != null, tormenta, detalle: plazo > 7
            ? 'La tendencia aún no permite confirmar condiciones de aplicación.' : detalle,
            ...(plazo <= 2 ? margenFranja(primera, d.date, agrometeo.vientoHorario, inicio) : {}) };
    });
}

/** Margen del pronóstico, no una garantía de secado del producto. */
function margenFranja(franja, fecha, serie, ahoraMs) {
    const rango = franja?.match(/^(\d{2}):00 a (\d{2}):00$/);
    if (!rango) return {};
    const inicio = Number(rango[1]);
    const fin = Number(rango[2]);
    const horas = serie.horas.filter((h) => h.time?.startsWith(`${fecha}T`));
    // El viento es instantáneo: cuenta también el sello del fin de la franja (W41, P2 de la v17).
    const dentro = horas.filter((h) => Number(h.time.slice(11, 13)) >= inicio && Number(h.time.slice(11, 13)) <= fin);
    const maxViento = Math.max(...dentro.flatMap((h) => [h.velocidad, h.racha]).filter(Number.isFinite));
    const margenViento = 15 - maxViento;
    const inicioMs = epochDeHoraLocal(`${fecha}T${rango[1]}:00`, serie.utcOffsetSeconds);
    const restantesMin = Math.round((fin - inicio) * 60 - Math.max(0, ahoraMs - inicioMs) / 60000);
    // Aviso comunicativo: una hora restante o menos, o a 1 km/h del límite.
    const alBorde = restantesMin <= 60 || margenViento <= 1;
    const duracion = restantesMin < 60 ? `${restantesMin} min restantes` : `${cifra(restantesMin / 60)} h ${restantesMin === 60 ? 'disponible' : 'disponibles'}`;
    return {
        alBorde,
        margen: `${alBorde ? 'Franja al borde. ' : ''}${duracion}; viento/racha a ${cifra(margenViento)} km/h del límite (15). Al menos 1 h sin lluvia después. Confirme el secado indicado en la etiqueta.`,
    };
}

/* Nivel del motor sanitario → la escala de las filas del veredicto. */
const NIVEL_SANITARIO = { alto: 'peligro', medio: 'aviso', bajo: 'bien', sin_evaluar: 'sin-dato' };

/** @typedef {{id: string, pregunta?: string, titulo?: string, respuesta?: string, nivel?: string, titular?: string|null, porque?: string, accion?: string, regla?: string|null, deNoche?: boolean, margen?: string, fechaMargen?: string, condiciones?: string[], salvedad?: string, sanitario?: NonNullable<ReturnType<typeof riesgoSanitarioDesdeAgrometeo>> & {accionProteccion?: string, proteccionEsFranja?: boolean}, riesgos?: object[], cultivos?: Array<string|object>|null, desdeEpoch?: number|null, contexto?: string|null, minimaDeHoy?: number|null, minimaNoche?: number|null, tramo?: string, respuestaVoz?: string, tramosLluvia?: Array<{desdeEpoch: number, hastaEpoch: number, abierto?: boolean}>, picoLluvia?: {desdeEpoch: number, hastaEpoch: number}|null, lluviaMm?: number|null, evaporaMm?: number|null, tormenta?: {codigo: number, razon: string}|null, trasHelada?: boolean}} FilaVeredicto */

/**
 * ¿Hongos? El riesgo de gota, mildeo o moho gris (`evaluarRiesgoSanitarioPiso`)
 * como fila del veredicto, para que compita en gravedad con las demás. La
 * pantalla la pinta con `AvisoSanitarioPiso` a partir de `sanitario`.
 */
/** @param {Partial<NonNullable<ReturnType<typeof riesgoSanitarioDesdeAgrometeo>>> & {diasAnterioresDisponibles?: number}} sanitario
 * @param {{deNoche?: boolean, aplicar?: {titulo?: string}|null, cultivos?: Array<string|object>|null, piso?: string}} [opciones]
 */
/** @returns {FilaVeredicto} */
export function filaHongos(sanitario, { deNoche = false, aplicar = null, cultivos = null } = {}) {
    const riesgoCompleto = {
        gota: sanitario?.gota ?? null,
        mildeo: sanitario?.mildeo ?? null,
        botrytis: sanitario?.botrytis ?? null,
        peor: sanitario?.peor ?? null,
        diasAnterioresDisponibles: sanitario?.diasAnterioresDisponibles,
    };
    const relevantes = riesgosSanitariosDeCultivos(riesgoCompleto, cultivos);
    const perfilDeclarado = Array.isArray(cultivos) && cultivos.length > 0;
    const perfilVacio = !perfilDeclarado;
    const altos = perfilDeclarado ? relevantes.filter((r) => r.nivel === 'alto') : [];
    const peor = relevantes[0] || (perfilDeclarado ? null : riesgoCompleto.peor);
    const nivel = NIVEL_SANITARIO[peor?.nivel || 'sin_evaluar'];
    const titulo = tituloSanitarioDeCultivos(riesgoCompleto, cultivos);
    let titular = null;
    let accionProteccion = null;
    if (perfilVacio && peor?.nivel === 'alto') {
        titular = `Riesgo alto de hongos: revise hojas y tallos ${deNoche ? 'mañana temprano' : 'hoy'}.`;
    } else if (peor?.nivel === 'alto' && ['gota', 'mildeo', 'botrytis'].includes(peor.enfermedad)) {
        const franja = aplicar?.titulo?.match(/Aplicar por protección: (.+)$/)?.[1];
        const enfermedad = peor.enfermedad;
        const nombre = enfermedad === 'gota' || enfermedad === 'mildeo' ? 'caldo bordelés' : 'Bacillus subtilis foliar';
        const enfermedadNombre = String(peor.nombre || { gota: 'gota (tizón tardío)', mildeo: 'mildeo velloso', botrytis: 'moho gris' }[enfermedad]).toLowerCase();
        titular = `Revise el lote por señales de ${enfermedadNombre}.`;
        accionProteccion = franja
            ? `Para ${enfermedadNombre}, si decide proteger con ${nombre} del catálogo: ${deNoche ? 'mañana' : 'hoy'} ${franjaDeCampo(franja)}, con la hoja seca y con tiempo para que se seque por completo antes de llover, según la etiqueta del producto.`
            : aplicar?.titulo?.startsWith('No se puede evaluar')
                ? MSG.clima.ventanaProteccionSinDatos
                : `Retire los focos de ${enfermedadNombre}; hoy no se recomienda aplicar.`;
    }
    else if (altos.length > 1) titular = `${titulo}: recorra el lote ${deNoche ? 'mañana temprano' : 'hoy'} y revise las hojas.`;
    else if (peor?.nivel === 'alto') titular = `${titulo}: recorra el lote ${deNoche ? 'mañana temprano' : 'hoy'} y revise las hojas.`;
    else if (peor?.nivel === 'medio') titular = `${titulo}: revise el lote cada mañana.`;
    // `proteccionEsFranja`: la acción es la franja horaria de «¿Aplico?» y la
    // tarjeta puede plegarla; «Retire los focos…» nunca se pliega.
    const esFranja = Boolean(accionProteccion && peor?.nivel === 'alto' && aplicar?.titulo?.match(/Aplicar por protección: (.+)$/));
    const sanitarioConAccion = accionProteccion ? { ...riesgoCompleto, accionProteccion, proteccionEsFranja: esFranja } : riesgoCompleto;
    return { id: 'hongos', pregunta: '¿Hongos?', respuesta: titulo, nivel, sanitario: sanitarioConAccion, riesgos: relevantes, cultivos, titular, deNoche };
}

const CAMPOS_TEXTO = ['titulo', 'respuesta', 'titular', 'porque', 'accion', 'regla', 'salvedad', 'contexto'];

/** @param {FilaVeredicto} fila @returns {FilaVeredicto} */
function sinPuntoDobleFila(fila) {
    const limpia = { ...fila };
    for (const campo of CAMPOS_TEXTO) if (typeof limpia[campo] === 'string') limpia[campo] = sinPuntoDoble(limpia[campo]);
    if (Array.isArray(limpia.condiciones)) limpia.condiciones = limpia.condiciones.map(sinPuntoDoble);
    return limpia;
}

/**
 * ¿Queda tormenta hoy, desde la hora de la finca? Sí si el cielo de ahora es
 * de tormenta o si alguna hora desde la vigente hasta la medianoche trae WMO
 * 95–99. Con la serie horaria de códigos no se mira el código diario: el de
 * un día con tormenta a las 5 p. m. sigue en 95 a las 11:30 p. m. Sin códigos
 * por hora, el del día (lo único que hay).
 */
export function tormentaPorVenir(agrometeo, ahoraMs = Date.now()) {
    const esTormenta = (c) => c != null && c >= 95 && c <= 99;
    if (agrometeo?.now?.weather?.family === 'tormenta' || esTormenta(num(agrometeo?.now?.weather?.code))) return true;
    const horas = agrometeo?.vientoHorario?.horas;
    const offset = offsetDe(agrometeo);
    if (Array.isArray(horas) && offset != null) {
        const desde = Math.floor(ahoraMs / 3600000) * 3600000;
        const hasta = epochDeHoraLocal(`${diaSiguiente(fechaLocalDe(ahoraMs, offset))}T00:00`, offset);
        const restantes = horas.filter((h) => {
            const e = epochDeHoraLocal(h.time, offset);
            return e != null && e >= desde && e <= hasta;
        });
        if (restantes.some((h) => num(h.codigo) != null)) return restantes.some((h) => esTormenta(num(h.codigo)));
    }
    const codigo = num(agrometeo?.today?.weathercode);
    return codigo != null && codigo >= 95;
}

/* Gravedad de una fila: peligro primero, luego aviso, luego falta de dato. */
const GRAVEDAD = { peligro: 0, aviso: 1, 'sin-dato': 2, info: 3, bien: 4 };

/**
 * Veredicto del día: las respuestas con su porqué y un titular. Las filas van
 * por gravedad (peligro, aviso, falta de dato, lo demás); a igual gravedad
 * manda el orden de `ordenarDecisionesSierra`, con los mismos insumos que usa
 * el panel de la Sierra. Titular: tormenta y granizo posible primero (ponen en
 * riesgo a la persona o al cultivo hoy); luego el peligro más grave; sin
 * peligro, la acción de aplicar (de noche, la de mañana).
 */
/** @returns {{titular: {id: string, texto: string}, filas: FilaVeredicto[], orden: string[]}|null} */
export function veredictoDelDia({
    agrometeo = null, ahoraMs = Date.now(), granizo = null, enso = null, pisoTermico = null,
    elevation = null, frescura = null, timeZone = 'America/Bogota', pendiente = '', sanitario = /** @type {Partial<NonNullable<ReturnType<typeof riesgoSanitarioDesdeAgrometeo>>>|undefined} */ (undefined), cultivos = null, sesgoSitio = null,
} = {}) {
    if (!agrometeo || (!agrometeo.today && !agrometeo.now)) return null;
    const aplicar = filaAplicar(agrometeo, ahoraMs);
    const riesgoSanitario = sanitario !== undefined ? sanitario
        : (agrometeo.daily ? riesgoSanitarioDesdeAgrometeo(agrometeo, pisoTermico) : null);
    const filas = {
        helada: filaHelada(agrometeo, { enso, pisoTermico, elevation, sesgoSitio, estacion: agrometeo.estacion, ahoraMs }),
        lluvia: filaLluvia(agrometeo, ahoraMs, timeZone),
        aplicar,
        riego: filaRiego(agrometeo, { pendiente, ahoraMs }),
        ...(riesgoSanitario ? { hongos: filaHongos(riesgoSanitario, { deNoche: aplicar.deNoche === true, aplicar, cultivos }) } : {}),
    };
    const orden = ordenarDecisionesSierra({
        minima: num(agrometeo.today?.temp_min) ?? NaN,
        helada: riesgoDe(agrometeo),
        lluvia: num(agrometeo.today?.precip_mm) ?? NaN,
        eto: num(agrometeo.today?.eto_mm) ?? NaN,
        humedad: num(agrometeo.now?.rh) ?? NaN,
        viento: num(agrometeo.vientoRacha_kmh) ?? NaN,
        estado: frescura?.estado ?? null,
    });
    const mapa = { minima: ['helada'], suelo: ['lluvia', 'riego'], viento: ['aplicar'] };
    const ids = orden.flatMap((id) => mapa[id] || []);
    const ordenadas = /** @type {FilaVeredicto[]} */ ([...new Set([...ids, 'helada', 'lluvia', 'aplicar', 'riego', 'hongos'])]
        .map((id) => filas[id]).filter(Boolean)
        .map((f, i) => ({ f, i }))
        .sort((a, b) => ((GRAVEDAD[a.f.nivel] ?? 5) - (GRAVEDAD[b.f.nivel] ?? 5)) || a.i - b.i)
        .map(({ f }) => f));
    const tormenta = tormentaPorVenir(agrometeo, ahoraMs);
    // Pasadas las 9 p. m. el día ya se fue: el titular no dice «hoy».
    const hoy = tardeDeNoche(agrometeo, ahoraMs) ? '' : ' de hoy';
    let titular;
    if (tormenta) titular = { id: 'tormenta', texto: `Tormenta eléctrica en el pronóstico${hoy}: no trabaje en potrero abierto ni bajo un árbol solo mientras truene.` };
    else if (granizo) titular = { id: 'granizo', texto: `El pronóstico marca granizo posible${hoy ? ' hoy' : ''}: tenga a mano con qué cubrir los semilleros.` };
    else {
        const peligro = ordenadas.find((f) => f.titular && (f.nivel === 'peligro' || f.nivel === 'aviso'));
        const conTitular = peligro || (aplicar.titular ? aplicar : ordenadas.find((f) => f.titular));
        titular = conTitular
            ? { id: conTitular.id, texto: conTitular.titular }
            : { id: 'tranquilo', texto: 'Día sin avisos fuertes en el pronóstico. Mire el lote antes de decidir.' };
    }
    // Un solo punto al cierre en todo lo que se lee: «a. m.» + «.» = «a. m.».
    return { titular: { ...titular, texto: sinPuntoDoble(titular.texto) }, filas: ordenadas.map(sinPuntoDobleFila), orden };
}

/* ── Íconos del día ─────────────────────────────────────────────────── */

/**
 * Tipo de ícono para un día: por código WMO cuando existe; si no, por
 * probabilidad de lluvia (la regla que usaba la tira con emoji).
 */
export function iconoDelDia(dia) {
    const c = num(dia?.weathercode);
    if (c != null) {
        if (c >= 95) return 'tormenta';
        if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82) || (c >= 71 && c <= 77) || c === 85 || c === 86) return 'lluvia';
        if (c >= 51 && c <= 57) return 'llovizna';
        if (c === 45 || c === 48) return 'niebla';
        if (c === 3) return 'nube';
        if (c === 2) return 'sol-nube';
        if (c === 0 || c === 1) return 'sol';
    }
    const p = num(dia?.precip_prob);
    if (p == null) return 'sin-dato';
    if (p >= 60) return 'lluvia';
    if (p >= 30) return 'sol-nube';
    return 'sol';
}

/* ── Lluvia y niebla de la escena, por dato ─────────────────────────── */

/**
 * Cuántas gotas y con qué opacidad: los milímetros de la hora vigente mandan
 * la densidad; la probabilidad del día, la presencia. Sin dato → null (la
 * escena usa su densidad de siempre, que es la del gate).
 */
export function densidadLluvia(agrometeo) {
    const mmHora = num(agrometeo?.now?.precip);
    const mmDia = num(agrometeo?.today?.precip_mm);
    const prob = num(agrometeo?.today?.precip_prob);
    const intensidad = mmHora != null && mmHora > 0 ? mmHora : (mmDia != null ? mmDia / 12 : null);
    if (intensidad == null && prob == null) return null;
    const i = intensidad ?? 0.5;
    const cantidad = Math.max(12, Math.min(64, Math.round(12 + i * 10)));
    const opacidad = prob == null ? 1 : Math.round((0.45 + 0.55 * Math.min(100, Math.max(0, prob)) / 100) * 100) / 100;
    const ritmo = i >= 4 ? 0.75 : i >= 1 ? 0.9 : 1.15;
    return { cantidad, opacidad, ritmo };
}

/** Espesor de la niebla por humedad relativa (0,35 a 1). */
export function densidadNiebla(agrometeo) {
    const rh = num(agrometeo?.now?.rh);
    if (rh == null) return null;
    return Math.round(Math.min(1, Math.max(0.35, (rh - 70) / 25)) * 100) / 100;
}

/* ── Luna ───────────────────────────────────────────────────────────── */

/**
 * La luna de una fecha, solo como cielo (sin recomendar labores por fase lunar): la fase
 * astronómica de `lunarPhase`. Nada de labores asociadas a la fase.
 */
export function lunaDeHoy(fecha = new Date()) {
    return lunarPhase(fecha);
}

/* ── UV de ahora ────────────────────────────────────────────────────── */

/**
 * UV de la hora vigente (`now.uv`, índice horario de Open-Meteo). NUNCA el
 * máximo del día: a la 1 de la mañana el máximo es 10 y el sol no ha salido.
 * `agrometeo.uv` tampoco sirve: cae al máximo del día cuando falta el horario.
 * De noche no hay valor de ahora; se dice que es de noche.
 */
export function uvAhora(agrometeo) {
    const now = agrometeo?.now;
    if (!now) return { estado: 'sin-dato', valor: null };
    if (now.is_day === false) return { estado: 'noche', valor: null };
    const v = num(now.uv);
    return v == null ? { estado: 'sin-dato', valor: null } : { estado: 'dia', valor: Math.round(v) };
}

/* ── Arco del sol ───────────────────────────────────────────────────── */

/** Horas solares de Open-Meteo para el día de la finca, también desde caché. */
export function arcoDelSol(fecha, agrometeo) {
    const offset = offsetDe(agrometeo);
    if (offset == null) return null;
    const hoy = fechaLocalDe(fecha.getTime(), offset);
    const dia = agrometeo?.daily?.find((d) => d.date === hoy);
    if (!dia?.sunrise?.startsWith(`${hoy}T`) || !dia?.sunset?.startsWith(`${hoy}T`)) return null;
    const salida = epochDeHoraLocal(dia.sunrise, offset);
    const puesta = epochDeHoraLocal(dia.sunset, offset);
    if (salida == null || puesta == null || puesta <= salida) return null;
    const ahora = fecha.getTime();
    const avance = ahora >= salida && ahora <= puesta ? (ahora - salida) / (puesta - salida) : null;
    return { salida: new Date(salida), puesta: new Date(puesta), avance, duracionMin: (puesta - salida) / 60000 };
}

/** Primera fecha con datos completos que cumple el criterio de secado. */
export function primeraVentanaSeca(daily, hoy) {
    const pronostico = diasDesdeHoy({ daily, today: { date: hoy } });
    return pronostico.find((d) => Number.isFinite(d.sol_horas) && d.sol_horas > 5
        && Number.isFinite(d.rh_mean) && d.rh_mean < 75
        && Number.isFinite(d.precip_mm) && d.precip_mm < 1)?.date ?? null;
}
