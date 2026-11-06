// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ensoHeladaRegla — la dirección de la helada bajo El Niño, en un solo lugar.
 *
 * Piloto multifinca, bug 14 (2026-10-31): a «¿Va a helar esta semana?» en una finca a 2.532 msnm,
 * dos corridas del agente dieron explicaciones opuestas de El Niño. La regla del
 * proyecto ya estaba escrita (`climaPorPiso.js`, `lecturaClimaAterrizaje.js`,
 * `climaService.frostRiskNote`) pero el prompt no la llevaba.
 *
 * Sin imports: lo usan el clima, el prompt (ensoContext) y la guarda de salida
 * (heladaRespuesta), y ninguna prueba lo simula.
 *
 * @module ensoHeladaRegla
 */
/**
 * Regla dura del proyecto (IDEAM/Cenicafé, DR-MISSION-4; la misma que pintan
 * `climaPorPiso.js` y `lecturaClimaAterrizaje.js`): en piso frío o páramo El
 * Niño trae MÁS heladas, no menos. Una sola frase para el clima, el prompt del
 * agente y la guarda de salida.
 */
export const ENSO_HELADA_PISO_FRIO =
    'En piso frío o páramo, El Niño trae cielo despejado y más riesgo de helada en la madrugada.';

/**
 * Umbral de helada documentado en el código (`FROST_AIR_MAX_C` de
 * outputGuards.js): el hielo se forma con la superficie a 0 °C, y en noche
 * despejada eso pasa con el aire a unos 2 °C.
 */
export const UMBRAL_HELADA_TEXTO =
    'La helada empieza cuando la superficie de la planta o del suelo llega a 0 °C; en noches despejadas eso puede pasar con el aire a unos 2 °C.';

/** ¿El piso es frío o páramo? Acepta tildes y compuestos ('frío', 'paramo_andino'). */
export function esPisoDeHelada(piso) {
    if (piso == null) return false;
    const n = String(piso).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return n === 'frio' || n === 'paramo' || n === 'glacial' || n.startsWith('frio_') || n.startsWith('paramo_');
}
