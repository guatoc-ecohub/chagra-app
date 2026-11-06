/**
 * fechaEsCO.js — UN solo formato de hora, día y mes para «El tiempo»
 * (CLIMA-R7). Antes la pantalla mezclaba «06:00 a 07:00», «10p/2a», «ju 24»,
 * «Ju 24» y «Ago – Sep». Canónico es-CO:
 *
 *   horas  → «6 a. m.» · «2 p. m.»
 *   días   → «jue 24»
 *   meses  → «oct–dic» · con año: «nov–dic de 2026»
 *
 * Las fechas puras («2026-09-24») se anclan al mediodía UTC y se formatean con
 * zona fija (America/Bogota): el día no cambia con la zona del runtime. Las
 * cadenas locales de finca SIN zona («2026-09-24T05:00») son hora de pared: se
 * leen tal cual, sin re-proyectarlas.
 */

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ZONA_BASE = 'America/Bogota';

/** ¿Es una cadena local de finca sin zona explícita? («2026-09-24T05:00»). */
function esIsoLocalSinZona(valor) {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valor) && !/(?:Z|[+-]\d{2}:?\d{2})$/.test(valor);
}

/** Hora de pared (0–23) de una cadena local de finca, sin re-proyección. */
function horaDePared(valor) {
    const h = Number(String(valor).slice(11, 13));
    return Number.isInteger(h) && h >= 0 && h <= 23 ? h : null;
}

function fechaDe(valor) {
    if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
    if (typeof valor === 'number' && Number.isFinite(valor)) return new Date(valor);
    if (typeof valor !== 'string' || !valor.trim()) return null;
    if (esIsoLocalSinZona(valor)) {
        const h = horaDePared(valor);
        return h == null ? null : new Date(`${valor.slice(0, 10)}T${String(h).padStart(2, '0')}:00:00Z`);
    }
    // Fecha pura («2026-09-24»): mediodía UTC, así el día no se corre.
    const ancla = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T12:00:00Z` : valor;
    const fecha = new Date(ancla);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function horaDeReloj(fecha, timeZone) {
    try {
        const h = Number(new Intl.DateTimeFormat('en-US', {
            timeZone: timeZone || ZONA_BASE, hour: 'numeric', hourCycle: 'h23',
        }).format(fecha));
        return Number.isInteger(h) && h >= 0 && h <= 23 ? h : null;
    } catch {
        return null;
    }
}

/**
 * «6 a. m.» · «2 p. m.». Acepta Date, epoch (ms) o cadena ISO (con o sin
 * zona; sin zona se lee como hora local de la finca).
 */
export function horaEsCO(valor, timeZone = ZONA_BASE) {
    if (valor == null || valor === '') return null;
    let h = null;
    if (typeof valor === 'string' && esIsoLocalSinZona(valor)) {
        h = horaDePared(valor);
    } else {
        const fecha = fechaDe(valor);
        h = fecha ? horaDeReloj(fecha, timeZone) : null;
    }
    if (h == null) return null;
    if (h === 0) return 'medianoche';
    if (h === 12) return 'mediodía';
    return `${h % 12 || 12} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** «5:40 a. m.» para eventos del reloj; conserva el formato es-CO de horaEsCO. */
export function horaConMinutosEsCO(valor, timeZone = ZONA_BASE) {
    if (valor == null || valor === '') return null;
    const fecha = fechaDe(valor);
    if (!fecha) return null;
    try {
        const partes = new Intl.DateTimeFormat('es-CO', {
            timeZone: timeZone || ZONA_BASE, hour: 'numeric', minute: '2-digit', hourCycle: 'h12',
        }).formatToParts(fecha);
        const hora = partes.find((p) => p.type === 'hour')?.value;
        const minuto = partes.find((p) => p.type === 'minute')?.value;
        const periodo = partes.find((p) => p.type === 'dayPeriod')?.value;
        if (hora === '12' && minuto === '00') return periodo.toLowerCase().startsWith('a') ? 'medianoche' : 'mediodía';
        return hora && minuto && periodo ? `${hora}:${minuto} ${periodo.toLowerCase().replaceAll('.', '. ')}`.replace(/\s+/g, ' ').trim() : null;
    } catch {
        return null;
    }
}

/**
 * «jue 24». Acepta Date, epoch o cadena ISO. Las fechas puras se anclan al
 * mediodía UTC y se formatean en la zona pedida.
 */
export function diaEsCO(valor, timeZone = ZONA_BASE) {
    const fecha = fechaDe(valor);
    if (!fecha) return null;
    try {
        const partes = new Intl.DateTimeFormat('es-CO', {
            timeZone: timeZone || ZONA_BASE, weekday: 'short', day: 'numeric',
        }).formatToParts(fecha);
        const dia = (partes.find((p) => p.type === 'weekday')?.value || '').replace('.', '');
        const numero = partes.find((p) => p.type === 'day')?.value || '';
        return dia && numero ? `${dia} ${numero}` : null;
    } catch {
        return null;
    }
}

/**
 * «oct–dic» · con año: «nov–dic de 2026». Meses 1–12 (enero = 1). Para los
 * rangos del calendario ENSO y cualquier rótulo de mes en «El tiempo».
 */
export function mesesEsCO(desde, hasta, anio = null) {
    if (!Number.isInteger(desde) || desde < 1 || desde > 12) return null;
    if (!Number.isInteger(hasta) || hasta < 1 || hasta > 12) return null;
    if (anio != null && !Number.isInteger(anio)) return null;
    const rango = `${MESES_CORTOS[desde - 1]}–${MESES_CORTOS[hasta - 1]}`;
    return Number.isInteger(anio) ? `${rango} de ${anio}` : rango;
}
