/**
 * Siluetas del paisaje del mundo del clima (tierra fría andina, finca de
 * ejemplo): cordilleras en capas, cerro con monte, ladera con surcos y la casa.
 * Geometría fija y determinista (sin azar en el render): la misma escena en
 * cada carga, para que las capturas se puedan comparar.
 *
 * Lienzo: 1600 × 1000, recortado desde el centro abajo (xMidYMax slice). La
 * franja x 560–1040 es la que se ve en un teléfono vertical: ahí va lo que no
 * puede faltar (surcos, casa, aliso).
 *
 * Orientación: se mira hacia el SUR. A 4,8° N el sol pasa casi por encima,
 * un poco al sur: sale por la izquierda (oriente) y se pone por la derecha
 * (occidente). El viento que viene del oriente empuja hacia la derecha.
 */

export const ANCHO = 1600;
export const ALTO = 1000;

/** Suma de senos con fases fijas: una cresta suave y repetible. */
function onda(x, armonicos) {
    return armonicos.reduce((s, [amp, periodo, fase]) => s + amp * Math.sin((x / periodo) * 2 * Math.PI + fase), 0);
}

/** Cresta cerrada por abajo, de borde a borde. */
export function cresta(base, armonicos, paso = 16) {
    const puntos = [];
    for (let x = 0; x <= ANCHO; x += paso) puntos.push(`${x},${(base + onda(x, armonicos)).toFixed(1)}`);
    return `M0,${ALTO} L${puntos.join(' L')} L${ANCHO},${ALTO} Z`;
}

/**
 * Borde de monte: una cresta coronada de copas redondas que se tocan, para
 * que el bosque se lea como MASA y no como árboles contables.
 */
export function monte(base, armonicos, radio, semillaFase = 0) {
    const partes = [`M0,${ALTO}`];
    let x = 0;
    let i = 0;
    partes.push(`L0,${(base + onda(0, armonicos)).toFixed(1)}`);
    while (x < ANCHO) {
        const r = radio * (0.75 + 0.35 * (0.5 + 0.5 * Math.sin(i * 2.399 + semillaFase)));
        const x2 = Math.min(ANCHO, x + r * 1.5);
        const y1 = base + onda(x, armonicos);
        const y2 = base + onda(x2, armonicos);
        const alto = r * (0.7 + 0.3 * Math.cos(i * 1.7 + semillaFase));
        partes.push(`Q${((x + x2) / 2).toFixed(1)},${(Math.min(y1, y2) - alto * 1.25).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`);
        x = x2;
        i += 1;
    }
    partes.push(`L${ANCHO},${ALTO} Z`);
    return partes.join(' ');
}

/**
 * Franja de monte: la copa en masa arriba y un borde inferior ondulado, para
 * que debajo se vean los potreros del cerro.
 */
export function franjaMonte(base, armonicos, radio, semillaFase, grosor) {
    const arriba = monte(base, armonicos, radio, semillaFase).replace(/^M0,1000 /, '').replace(/ L1600,1000 Z$/, '');
    const abajo = [];
    for (let x = ANCHO; x >= 0; x -= 20) abajo.push(`L${x},${(base + grosor + onda(x, armonicos) + 9 * Math.sin(x / 37 + semillaFase)).toFixed(1)}`);
    return `M${arriba.slice(1)} ${abajo.join(' ')} Z`;
}

/**
 * Potreros y parcelas del cerro medio (la sabana de tierra fría): cuadros
 * irregulares en bandas, con su cerca viva por el borde.
 */
export function parcelas() {
    const filas = [664, 700, 744, 800, 870];
    const out = [];
    for (let f = 0; f < filas.length - 1; f += 1) {
        let x = -40 + 30 * Math.sin(f * 1.7);
        let k = 0;
        while (x < ANCHO + 40) {
            const ancho = 150 + 70 * (0.5 + 0.5 * Math.sin(f * 3.1 + k * 1.9));
            const inclina = 0.06 * Math.sin(f + k);
            const y0 = filas[f] + 8 * Math.sin(k * 2.3 + f);
            const y1 = filas[f + 1] + 8 * Math.sin(k * 2.3 + f + 1);
            const x1 = x + ancho;
            out.push({
                d: `M${x.toFixed(0)},${(y0 + inclina * 0).toFixed(1)} L${x1.toFixed(0)},${(y0 + inclina * ancho).toFixed(1)} L${(x1 + 12).toFixed(0)},${(y1 + inclina * ancho).toFixed(1)} L${(x - 10).toFixed(0)},${y1.toFixed(1)} Z`,
                tono: (f * 3 + k * 2 + (k % 3)) % 4,
            });
            x = x1;
            k += 1;
        }
    }
    return out;
}

/** Altura de la ladera cercana en x (la tierra de la finca). */
export const ladera = (x) => 742 + onda(x, [[26, 2100, 0.6], [9, 610, 1.9], [4, 230, 0.2]]) - (x - 800) * 0.055;

export const PAISAJE = Object.freeze({
    lejos: cresta(452, [[38, 900, 0.3], [22, 410, 1.1], [9, 170, 2.4]]),
    lejos2: cresta(520, [[30, 1150, 2.2], [16, 520, 0.4], [7, 190, 1.3]]),
    cerro: cresta(606, [[28, 1300, 1.4], [14, 470, 2.8], [5, 160, 0.9]]),
    bosque: monte(626, [[24, 1300, 1.4], [12, 470, 2.8]], 22, 0.7),
    ladera: `M0,${ALTO} ${Array.from({ length: ANCHO / 8 + 1 }, (_, i) => `L${i * 8},${ladera(i * 8).toFixed(1)}`).join(' ')} L${ANCHO},${ALTO} Z`,
    pasto: cresta(902, [[10, 700, 0.1], [5, 260, 1.4]]),
});

/**
 * Surcos de papa sobre la ladera, entre x0 y x1: bandas que siguen la
 * pendiente, cada una con su línea de matas (masa, no hojas sueltas).
 */
export function surcos(x0 = 470, x1 = 860, n = 7) {
    const filas = [];
    for (let k = 0; k < n; k += 1) {
        const dy = 22 + k * 19;
        const puntos = [];
        for (let x = x0 + k * 6; x <= x1 - k * 4; x += 10) puntos.push([x, ladera(x) + dy]);
        const linea = puntos.map(([x, y], j) => `${j ? 'L' : 'M'}${x},${y.toFixed(1)}`).join(' ');
        filas.push({ k, linea, puntos });
    }
    return filas;
}

/** Posición del ancla de la casa y del aliso sobre la ladera. */
export const CASA = Object.freeze({ x: 905, y: ladera(905) - 4 });
export const ALISO = Object.freeze({ x: 1010, y: ladera(1010) + 6 });

/**
 * Matojos de kikuyo del frente: varias hojas finas y curvas que salen de un
 * mismo pie (nada de copas en punta: no son arbolitos). Fase fija para que el
 * viento no los mueva al unísono.
 */
export const MATOJOS = Object.freeze(Array.from({ length: 70 }, (_, i) => {
    const x = 6 + i * 23 + 11 * Math.sin(i * 2.1);
    const y = 904 + 10 * Math.sin(i * 1.3) + 6 * Math.sin(i * 0.41);
    const alto = 16 + 12 * (0.5 + 0.5 * Math.sin(i * 0.77));
    const hojas = [-1, -0.6, -0.2, 0.2, 0.6, 1].map((a, j) => {
        const largo = alto * (0.7 + 0.3 * Math.cos(j * 1.3 + i));
        const tx = x + a * 7;
        const px = x + a * largo * 0.55;
        return `M${tx.toFixed(1)},${y.toFixed(1)} Q${(x + a * 3).toFixed(1)},${(y - largo * 0.6).toFixed(1)} ${px.toFixed(1)},${(y - largo).toFixed(1)}`;
    }).join(' ');
    return { x, y, hojas, fase: (i * 0.37) % 1 };
}));

/**
 * El follaje de un surco de papa como UNA masa: el borde de arriba ondulado
 * por las matas que se tocan y la base pegada al surco. Nada de matas sueltas.
 */
export function matasDe(puntos) {
    if (puntos.length < 2) return '';
    const [x0, y0] = puntos[0];
    const partes = [`M${x0},${(y0 - 2).toFixed(1)}`];
    for (let j = 2; j < puntos.length; j += 2) {
        const [xa, ya] = puntos[j - 2];
        const [xb, yb] = puntos[j];
        const alto = 11 + 3.5 * Math.sin(j * 1.9 + xa * 0.05);
        partes.push(`Q${((xa + xb) / 2).toFixed(1)},${(Math.min(ya, yb) - alto * 1.6).toFixed(1)} ${xb},${(yb - 2).toFixed(1)}`);
    }
    for (let j = puntos.length - 1; j >= 0; j -= 3) partes.push(`L${puntos[j][0]},${(puntos[j][1] + 3).toFixed(1)}`);
    return `${partes.join(' ')} Z`;
}

/**
 * Copa de aliso en masa: lóbulos grandes e irregulares (no una bola), con la
 * sombra abajo y la luz arriba a la izquierda. Coordenadas con el pie en 0,0.
 */
export const COPA_ALISO = Object.freeze({
    copa: 'M-70,-62 Q-92,-80 -78,-104 Q-90,-132 -60,-142 Q-58,-176 -24,-178 Q-4,-204 26,-186 Q58,-196 66,-164 Q98,-156 88,-122 Q106,-96 82,-76 Q76,-52 46,-56 Q24,-40 -4,-50 Q-30,-38 -50,-52 Q-66,-48 -70,-62 Z',
    sombra: 'M-70,-62 Q-50,-74 -24,-66 Q4,-80 30,-68 Q60,-82 84,-78 Q76,-52 46,-56 Q24,-40 -4,-50 Q-30,-38 -50,-52 Q-66,-48 -70,-62 Z',
    hueco: 'M14,-104 Q30,-116 44,-102 Q36,-90 22,-92 Z',
    luz: 'M-58,-132 Q-54,-166 -20,-168 Q0,-190 26,-176 Q2,-160 -14,-150 Q-38,-150 -58,-132 Z',
    tronco: 'M-7,0 Q-4,-30 -6,-52 L-18,-78 L-12,-80 L-1,-62 L4,-84 L10,-82 L6,-56 Q6,-28 9,0 Z',
});

/** Otros alisos y arbustos en la ladera y el cerro: tamaños y profundidades distintas. */
export const ARBOLES = Object.freeze([
    { x: 640, y: 694, s: 0.42, capa: 'medio' }, { x: 1180, y: 676, s: 0.5, capa: 'medio' },
    { x: 360, y: 712, s: 0.38, capa: 'medio' }, { x: 1440, y: 664, s: 0.46, capa: 'medio' },
    { x: 1080, y: ladera(1080) + 10, s: 0.62, capa: 'cerca' }, { x: 1330, y: ladera(1330) + 12, s: 1.25, capa: 'cerca' },
]);

/** El monte del cerro medio: copas en masa sobre los potreros. */
export const MONTE_CERRO = franjaMonte(612, [[24, 1300, 1.4], [12, 470, 2.8]], 20, 0.7, 64);

/** Pares x,y de un trazado, con el traslado y la escala de su grupo. */
function puntosDe(d, dx = 0, dy = 0, s = 1) {
    const n = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const out = [];
    for (let i = 0; i + 1 < n.length; i += 2) out.push([dx + n[i] * s, dy + n[i + 1] * s]);
    return out;
}

/**
 * Todo lo que la tierra dibuja por encima del suelo, como nube de puntos del
 * lienzo: cordilleras, cerro, monte, ladera, alisos y casa. Los puntos de
 * control de las curvas quedan por fuera de la curva, así que el techo que se
 * saca de aquí nunca queda por debajo de lo dibujado.
 */
const SILUETA = Object.freeze([
    PAISAJE.lejos, PAISAJE.lejos2, PAISAJE.cerro, PAISAJE.ladera, MONTE_CERRO,
].flatMap((d) => puntosDe(d)).concat(
    // El aliso principal va a escala 0,85; los de cerca y grandes, 150 más abajo (capa del frente).
    [{ x: ALISO.x, y: ALISO.y, s: 0.85 }, ...ARBOLES.map((a) => ({ x: a.x, y: a.capa === 'cerca' && a.s >= 1 ? a.y + 150 : a.y, s: a.s }))]
        .flatMap(({ x, y, s }) => puntosDe(COPA_ALISO.copa, x, y, s)),
    puntosDe('M0,0 L120,0', CASA.x - 60, CASA.y - 72),
).filter(([, y]) => y < ALTO));

/** Lo más alto (y mínima del lienzo) que dibuja la tierra entre x0 y x1. */
export function techoTierra(x0, x1) {
    // Los puntos de las cordilleras van cada 16: se mira un paso más a cada lado.
    let techo = ALTO;
    for (const [x, y] of SILUETA) if (x >= x0 - 16 && x <= x1 + 16 && y < techo) techo = y;
    return techo;
}

/**
 * Dónde va el astro en la escena, en % de su caja. El arco es el de siempre
 * (sale por la izquierda, culmina arriba, se pone por la derecha), pero el
 * disco nunca queda detrás de la tierra: si el arco lo hunde en el monte (en
 * vertical la tierra sube y la cresta queda muy arriba), el astro se apoya
 * sobre la cresta, a la vista.
 *
 * `caja` es lo medido en el navegador: la escena, la caja de las capas de
 * tierra (viewBox ANCHO × ALTO con xMidYMax slice) y el radio del disco, en px.
 * Sin medida (sin maquetación), el arco de siempre.
 * @param {number|null|undefined} avance 0 = salida, 1 = puesta; null = sin arco (la luna)
 * @param {{ ancho: number, alto: number, tierra: { x: number, y: number, w: number, h: number }, radio: number }|null} caja
 * @returns {{ izq: number, arriba: number }}
 */
export function posicionAstro(avance, caja) {
    const izq = avance == null ? 72 : 8 + avance * 84;
    const arco = avance == null ? 12 : 44 - Math.sin(Math.PI * avance) * 32;
    if (!caja || !(caja.ancho > 0) || !(caja.alto > 0) || !(caja.tierra?.w > 0) || !(caja.tierra?.h > 0)) return { izq, arriba: arco };
    const { ancho, alto, tierra, radio } = caja;
    const s = Math.max(tierra.w / ANCHO, tierra.h / ALTO);
    const ox = tierra.x + (tierra.w - ANCHO * s) / 2;
    const oy = tierra.y + tierra.h - ALTO * s;
    const cx = (izq / 100) * ancho;
    const techo = oy + techoTierra((cx - radio - ox) / s, (cx + radio - ox) / s) * s;
    // Holgura: el corrimiento de profundidad mueve la tierra hasta ~10 px en vertical.
    const tope = techo - radio - 12;
    const arriba = Math.min((arco / 100) * alto, Math.max(radio + 4, tope));
    return { izq, arriba: (arriba / alto) * 100 };
}

/** Posiciones fijas de las nubes sueltas (en % del cielo) y su tamaño. */
export const NUBES_SUELTAS = Object.freeze([
    { x: 18, y: 14, s: 1.1 }, { x: 62, y: 9, s: 0.9 }, { x: 40, y: 22, s: 1.3 }, { x: 82, y: 19, s: 1 },
    { x: 6, y: 27, s: 0.8 }, { x: 52, y: 31, s: 0.75 }, { x: 74, y: 30, s: 0.85 },
]);

/** Estrellas en posiciones fijas (pseudoaleatorio con semilla). */
export const ESTRELLAS = Object.freeze(Array.from({ length: 70 }, (_, i) => {
    const a = Math.sin(i * 12.9898) * 43758.5453;
    const b = Math.sin(i * 78.233) * 12345.6789;
    return { x: (a - Math.floor(a)) * 100, y: (b - Math.floor(b)) * 52, r: i % 9 === 0 ? 1.6 : i % 3 === 0 ? 1.1 : 0.7, fase: (i * 0.61) % 1 };
}));

/**
 * Gotas: cuántas según los milímetros de la hora (más lluvia, más gotas; con
 * menos de 0,2 mm, llovizna rala). Posiciones fijas por índice.
 */
export function gotasPara(mm) {
    const n = mm < 0.2 ? 26 : Math.round(Math.min(190, 50 + mm * 26));
    return Array.from({ length: n }, (_, i) => {
        const a = Math.sin(i * 91.17) * 24634.6345;
        const b = Math.sin(i * 17.31) * 9137.113;
        return { x: (a - Math.floor(a)) * 104 - 2, retraso: (b - Math.floor(b)), largo: 0.8 + ((i * 0.37) % 1) * 0.6 };
    });
}
