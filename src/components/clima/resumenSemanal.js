import { cifra } from './cieloHoy.js';

/** Resumen breve del mismo pronóstico que alimenta la tabla semanal. */
export function resumenSemanal({ dias, location }) {
    if (!location || !dias.length) return '';
    const lugar = [location.vereda, location.municipio, location.departamento].filter(Boolean).join(', ')
        || `coordenadas ${cifra(location.lat, 3)}; ${cifra(location.lng, 3)}`;
    const disponibles = dias.filter((dia) => Number.isFinite(dia.precip_mm));
    const total = disponibles.reduce((suma, dia) => suma + dia.precip_mm, 0);
    const lluvia = disponibles.length
        ? `Se pronostican ${cifra(total, 1)} milímetros de lluvia acumulada en ${disponibles.length} días con dato.`
        : 'No hay cantidades de lluvia disponibles.';
    const faltantes = disponibles.length < dias.length ? ' Faltan datos de lluvia; el acumulado es parcial.' : '';
    const precision = location.precision === 'centroid'
        ? ' Es una referencia del municipio, no una medición de su finca. Confirme la ubicación del lote.'
        : ' Es un modelo para la ubicación indicada, no una medición en el lote.';
    return `Lluvia para ${lugar}, del ${dias[0].date} al ${dias.at(-1).date}. ${lluvia}${faltantes}${precision} Hay incertidumbre y aumenta con la distancia de la fecha. Revise de nuevo antes de decidir. Fuente: Open-Meteo.`;
}
