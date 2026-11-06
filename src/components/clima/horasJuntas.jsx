import React from 'react';

/**
 * Protege cada hora en la presentación, sin cambiar el texto del pronóstico.
 * La cifra y sus grados van con espacio no separable: «7 °C» no se parte, un
 * rango de grados tampoco («2 a 6 °C», W43), y la fecha corta tampoco: «dom 4»
 * queda en un renglón.
 */
export function horasJuntas(texto) {
    if (Array.isArray(texto)) return texto.map(horasJuntas);
    if (typeof texto !== 'string') return texto;
    return texto.replace(/(\d) °C/g, '$1\u00a0°C').replace(/(\d) a (\d+)(?=\u00a0°C)/g, '$1\u00a0a\u00a0$2').replace(/(?<![\p{L}\d])(lun|mar|mié|jue|vie|sáb|dom) (\d{1,2})(?!\d)/gu, '$1\u00a0$2').split(/(\b\d{1,2}(?::\d{2})?[\s\u00a0]+[ap]\.[\s\u00a0]*m\.)/g)
        .map((parte, i) => i % 2 ? <span className="cl-hora" key={i}>{parte}</span> : parte);
}
