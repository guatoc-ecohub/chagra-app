/**
 * El mundo del clima en 2.5D: capas ilustradas con profundidad (cielo, astro,
 * nubes, cordilleras, monte, ladera con surcos y casa, lluvia, niebla,
 * escarcha), cada una pintada SOLO si la escena la trae del dato
 * (escenaMundo.js). Presentacional: no lee red ni reloj.
 *
 * Cada capa de dato lleva `data-capa` y sus cifras en `data-*`: el banco del
 * mundo lee lo DIBUJADO, no lo calculado.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Luna } from '../EscenaAtmosfera';
import { ALTO, ANCHO, ALISO, ARBOLES, CASA, COPA_ALISO, ESTRELLAS, MATOJOS, MONTE_CERRO, NUBES_SUELTAS, PAISAJE, gotasPara, matasDe, parcelas, posicionAstro, surcos } from './paisajeMundo.js';
import './mundoClima.css';

const SURCOS = surcos();
const PARCELAS = parcelas();
const MATAS = SURCOS.map((s) => matasDe(s.puntos));
const VB = `0 0 ${ANCHO} ${ALTO}`;

/** Degradado vertical de una capa: arriba se funde con el cielo (lejanía), abajo su color. */
function Degradado({ id, color, mezcla = 55 }) {
    return (
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: `color-mix(in oklab, var(${color}) ${mezcla}%, var(--mc-cielo-bajo))` }} />
            <stop offset="0.55" style={{ stopColor: `var(${color})` }} />
        </linearGradient>
    );
}
const iso = (ms) => (ms == null ? undefined : new Date(ms).toISOString());

/** Cúmulo: copas redondas con la base plana, en masa. */
function Cumulo({ claro = false, i = 0 }) {
    const id = `mc-cumulo-g${i}`;
    return (
        <svg className={`mc-cumulo${claro ? ' mc-cumulo--claro' : ''}`} viewBox="0 0 220 120" aria-hidden="true">
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0.25" className="mc-cumulo__luz" />
                    <stop offset="1" className="mc-cumulo__base" />
                </linearGradient>
            </defs>
            <path fill={`url(#${id})`} d="M14,96 Q2,94 8,80 Q12,66 30,68 Q24,48 46,42 Q58,40 64,46 Q70,18 100,20 Q118,6 138,24 Q152,16 164,30 Q186,30 186,52 Q210,52 212,74 Q216,96 192,98 Q170,106 140,100 Q112,108 84,100 Q52,108 14,96 Z" />
            <path className="mc-cumulo__brillo" d="M70,30 Q84,14 104,22 Q116,10 134,26 Q112,24 98,34 Q84,26 70,30 Z" />
        </svg>
    );
}

/** El techo de nubes: bancos alargados que se solapan, de borde a borde. */
function Techo({ oscuro }) {
    return (
        <svg className={`mc-techo${oscuro ? ' mc-techo--oscuro' : ''}`} viewBox="0 0 1600 420" preserveAspectRatio="none" aria-hidden="true">
            <path className="mc-techo__alto" d="M0,0 H1600 V210 Q1500,250 1380,226 Q1260,270 1120,238 Q980,280 840,240 Q700,282 560,244 Q420,286 280,240 Q140,272 0,236 Z" />
            <path className="mc-techo__medio" d="M0,150 Q120,120 260,160 Q400,118 560,166 Q720,124 880,170 Q1040,128 1200,168 Q1360,126 1600,160 V300 Q1460,336 1320,306 Q1160,344 1000,308 Q840,346 680,306 Q520,344 360,304 Q200,340 0,300 Z" />
            <path className="mc-techo__bajo" d="M0,260 Q180,232 360,272 Q540,236 720,278 Q900,240 1080,280 Q1260,244 1440,282 Q1530,262 1600,270 V360 Q1420,392 1240,362 Q1060,398 880,364 Q700,400 520,362 Q340,396 160,360 Q80,372 0,356 Z" />
        </svg>
    );
}

/** Casa campesina de tierra fría: bahareque encalado y teja de barro. */
function Casa({ noche }) {
    const { x, y } = CASA;
    return (
        <g className="mc-casa" transform={`translate(${x - 60},${y - 78})`}>
            <path className="mc-casa__muro" d="M8,40 L112,40 L112,82 L8,82 Z" />
            <path className="mc-casa__muro-sombra" d="M86,40 L112,40 L112,82 L86,82 Z" />
            <path className="mc-casa__teja" d="M0,44 L22,12 L98,12 L120,44 Z" />
            <path className="mc-casa__teja-borde" d="M0,44 L120,44 L118,48 L2,48 Z" />
            <rect className="mc-casa__puerta" x="50" y="56" width="16" height="26" rx="1" />
            <rect className={`mc-casa__ventana${noche ? ' mc-casa__ventana--luz' : ''}`} x="20" y="54" width="16" height="12" rx="1" />
            <rect className={`mc-casa__ventana${noche ? ' mc-casa__ventana--luz' : ''}`} x="80" y="54" width="14" height="12" rx="1" />
            <path className="mc-casa__chimenea" d="M84,6 L94,6 L94,22 L84,22 Z" />
        </g>
    );
}

/**
 * Aliso: copa en masa de lóbulos grandes, tronco corto que se abre en ramas.
 * @param {{ x?: number, y?: number, s?: number }} props
 */
function Aliso({ x = ALISO.x, y = ALISO.y, s = 0.85 }) {
    return (
        <g className="mc-aliso" transform={`translate(${x},${y}) scale(${s})`}>
            <path className="mc-aliso__tronco" d={COPA_ALISO.tronco} />
            <path className="mc-aliso__copa" d={COPA_ALISO.copa} />
            <path className="mc-aliso__sombra" d={COPA_ALISO.sombra} />
            <path className="mc-aliso__sombra" d={COPA_ALISO.hueco} />
            <path className="mc-aliso__luz" d={COPA_ALISO.luz} />
        </g>
    );
}

/** Humo del fogón: se dobla con el viento (dirección y fuerza del dato). */
function Humo({ viento }) {
    const { x, y } = CASA;
    // Se mira al sur: el viento del oriente (90°) empuja el humo a la derecha (occidente).
    const empuje = Math.sin((viento.direccion * Math.PI) / 180) * Math.min(1, viento.kmh / 20);
    const dx = empuje * 90;
    const sube = 90 - Math.abs(empuje) * 40;
    const x0 = x + 29;
    const y0 = y - 78;
    return (
        <path className="mc-humo" data-capa="humo" data-kmh={viento.kmh} data-direccion={viento.direccion}
            d={`M${x0},${y0} C${x0 + dx * 0.15},${y0 - sube * 0.4} ${x0 + dx * 0.55},${y0 - sube * 0.7} ${x0 + dx},${y0 - sube}`} />
    );
}

/**
 * @param {{ escena: ReturnType<typeof import('./escenaMundo.js').escenaDelMundo>, etiquetas?: Record<string,string>,
 *   onTocar?: (capa: string) => void }} props
 */
export default function MundoClimaEscena({ escena: e, etiquetas = {}, onTocar = undefined }) {
    const raiz = useRef(/** @type {HTMLDivElement|null} */ (null));
    // Profundidad: las capas cercanas se corren más que las lejanas con el puntero.
    useEffect(() => {
        const el = raiz.current;
        if (!el || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
        let cuadro = 0;
        const mover = (ev) => {
            const r = el.getBoundingClientRect();
            const px = ((ev.clientX - r.left) / r.width) * 2 - 1;
            const py = ((ev.clientY - r.top) / r.height) * 2 - 1;
            cancelAnimationFrame(cuadro);
            cuadro = requestAnimationFrame(() => {
                el.style.setProperty('--mc-px', px.toFixed(3));
                el.style.setProperty('--mc-py', py.toFixed(3));
            });
        };
        el.addEventListener('pointermove', mover);
        return () => { el.removeEventListener('pointermove', mover); cancelAnimationFrame(cuadro); };
    }, []);

    // La caja de la escena y de la tierra, medida: el astro se apoya sobre la
    // cresta que de verdad se ve en esta pantalla (en vertical la tierra sube).
    const [caja, setCaja] = useState(/** @type {Parameters<typeof posicionAstro>[1]} */ (null));
    const hayAstro = Boolean(e.astro);
    useLayoutEffect(() => {
        const el = raiz.current;
        if (!el || !hayAstro) return undefined;
        const medir = () => {
            const r = el.getBoundingClientRect();
            const t = el.querySelector('.mc-tierra--lejos')?.getBoundingClientRect();
            const a = el.querySelector('.mc-astro')?.getBoundingClientRect();
            if (!t) return;
            // El disco ocupa el 64 % de la caja del astro (inset 18 %).
            const radio = a && a.width > 0 ? a.width * 0.32 : 21;
            setCaja((antes) => {
                const nueva = { ancho: r.width, alto: r.height, tierra: { x: t.left - r.left, y: t.top - r.top, w: t.width, h: t.height }, radio };
                return antes && JSON.stringify(antes) === JSON.stringify(nueva) ? antes : nueva;
            });
        };
        medir();
        if (typeof ResizeObserver === 'undefined') {
            globalThis.addEventListener?.('resize', medir);
            return () => globalThis.removeEventListener?.('resize', medir);
        }
        const obs = new ResizeObserver(medir);
        obs.observe(el);
        return () => obs.disconnect();
    }, [hayAstro]);

    const noche = e.luz === 'noche';
    const viento = e.viento;
    const balanceo = viento ? Math.min(1, viento.kmh / 25) : 0;
    const deriva = viento?.direccion != null ? Math.sin((viento.direccion * Math.PI) / 180) : 0;
    const estilo = /** @type {React.CSSProperties} */ ({
        '--mc-balanceo': balanceo.toFixed(2),
        '--mc-deriva': deriva.toFixed(2),
        ...(e.niebla?.densidad != null ? { '--mc-niebla': e.niebla.densidad } : {}),
    });
    const tocar = (capa) => () => onTocar?.(capa);
    const zona = (capa, clase, style = undefined) => etiquetas[capa] && (
        <button type="button" className={`mc-zona ${clase}`} style={style} aria-label={etiquetas[capa]} onClick={tocar(capa)} data-zona={capa} />
    );
    const pos = e.astro ? posicionAstro(e.astro.avance, caja) : null;
    const astroIzq = pos ? Number(pos.izq.toFixed(2)) : null;
    const astroArriba = pos ? Number(pos.arriba.toFixed(2)) : null;

    return (
        <div ref={raiz} className="mc-escena" style={estilo} data-clave={e.clave} data-luz={e.luz ?? 'sin-dato'}
            data-condicion={e.condicion ?? 'sin-dato'} data-viento={viento ? 'si' : 'no'} data-testid="mundo-escena">
            <div className="mc-cielo" aria-hidden="true" />

            {e.estrellas && (
                <div className="mc-capa mc-estrellas" data-capa="estrellas" data-cantidad={e.estrellas} aria-hidden="true">
                    {ESTRELLAS.filter((_, i) => e.estrellas === 'muchas' || i % 3 === 0).map((s, i) => (
                        <span key={i} className="mc-estrella" style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.r * 2}px`, height: `${s.r * 2}px`, animationDelay: `${-s.fase * 4}s` }} />
                    ))}
                </div>
            )}

            {e.nubes && (
                <div className={`mc-capa mc-nubes${e.nubes.techo ? ' mc-nubes--techo' : ''}`} data-capa="nubes"
                    data-techo={e.nubes.techo ? 'si' : 'no'} data-sueltas={e.nubes.sueltas}
                    data-cobertura={e.nubes.cobertura ?? 'sin-dato'} aria-hidden="true">
                    {e.nubes.techo
                        ? <Techo oscuro={e.condicion === 'tormenta' || e.condicion === 'lluvia' || noche} />
                        : NUBES_SUELTAS.slice(0, e.nubes.sueltas).map((n, i) => (
                            <span key={i} className="mc-nube" style={{ left: `${n.x}%`, top: `${n.y}%`, '--mc-s': n.s, animationDelay: `${-i * 7}s` }}>
                                <Cumulo claro={!noche} i={i} />
                            </span>
                        ))}
                </div>
            )}

            {/* El astro va delante de las nubes sueltas: con «Despejado» ninguna nube
                lo tapa; el velo de «Parcialmente nublado» lo pone él mismo. */}
            {e.astro && (
                <div className={`mc-astro mc-astro--${e.astro.tipo}${e.astro.velo ? ' mc-astro--velado' : ''}`} data-capa="astro"
                    data-astro={e.astro.tipo} data-velo={e.astro.velo ?? undefined}
                    data-avance={e.astro.avance == null ? 'sin-dato' : e.astro.avance.toFixed(3)}
                    style={{ left: `${astroIzq}%`, top: `${astroArriba}%` }} aria-hidden="true">
                    {e.astro.tipo === 'luna'
                        ? <Luna luna={e.astro.luna} className="mc-luna" testId="mundo-luna" />
                        : <span className="mc-sol"><span className="mc-sol__halo" /><span className="mc-sol__disco" /></span>}
                    {e.astro.velo && <span className="mc-velo" />}
                </div>
            )}

            {e.relampago && (
                <svg className="mc-capa mc-relampago" data-capa="relampago" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M58,8 L52,22 L56,22 L49,38 L53,38 L45,56" />
                </svg>
            )}

            <svg className="mc-capa mc-tierra mc-tierra--lejos" viewBox={VB} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
                <defs><Degradado id="mc-g-lejos" color="--mc-lejos" mezcla={45} /></defs>
                <path fill="url(#mc-g-lejos)" d={PAISAJE.lejos} />
            </svg>
            <svg className="mc-capa mc-tierra mc-tierra--lejos2" viewBox={VB} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
                <defs><Degradado id="mc-g-lejos2" color="--mc-lejos2" mezcla={60} /></defs>
                <path fill="url(#mc-g-lejos2)" d={PAISAJE.lejos2} />
            </svg>
            {e.niebla && <div className="mc-capa mc-niebla mc-niebla--valle" data-capa="niebla"
                data-densidad={e.niebla.densidad ?? 'sin-dato'} aria-hidden="true"><span /><span /></div>}
            <svg className="mc-capa mc-tierra mc-tierra--medio" viewBox={VB} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
                <defs>
                    <Degradado id="mc-g-cerro" color="--mc-cerro" mezcla={75} />
                    <clipPath id="mc-c-cerro"><path d={PAISAJE.cerro} /></clipPath>
                </defs>
                <path fill="url(#mc-g-cerro)" d={PAISAJE.cerro} />
                <g clipPath="url(#mc-c-cerro)">
                    {PARCELAS.map((p, i) => <path key={i} className={`mc-parcela mc-parcela--${p.tono}`} d={p.d} />)}
                </g>
                <path className="mc-bosque" d={MONTE_CERRO} />
                {ARBOLES.filter((a) => a.capa === 'medio').map((a, i) => <Aliso key={i} x={a.x} y={a.y} s={a.s} />)}
            </svg>
            <svg className="mc-capa mc-tierra mc-tierra--cerca" viewBox={VB} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
                <defs>
                    <linearGradient id="mc-g-ladera" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" style={{ stopColor: 'color-mix(in oklab, var(--mc-ladera) 82%, #fff6c8)' }} />
                        <stop offset="0.35" style={{ stopColor: 'var(--mc-ladera)' }} />
                        <stop offset="1" style={{ stopColor: 'var(--mc-pasto)' }} />
                    </linearGradient>
                </defs>
                <path fill="url(#mc-g-ladera)" d={PAISAJE.ladera} />
                {SURCOS.map((s) => <path key={s.k} className="mc-surco__tierra" d={s.linea} />)}
                {MATAS.map((d, k) => <path key={k} className="mc-matas" d={d} />)}
                {ARBOLES.filter((a) => a.capa === 'cerca' && a.s < 1).map((a, i) => <Aliso key={i} x={a.x} y={a.y} s={a.s} />)}
                <Aliso />
                <Casa noche={noche} />
                {viento?.direccion != null && <Humo viento={viento} />}
                {e.escarcha && (
                    <g className="mc-escarcha" data-capa="escarcha">
                        {MATAS.map((d, k) => <path key={k} className="mc-escarcha__matas" d={d} />)}
                        <path className="mc-escarcha__pasto" d={PAISAJE.pasto} />
                    </g>
                )}
            </svg>
            <svg className="mc-capa mc-tierra mc-tierra--frente" viewBox={VB} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
                <path className="mc-pasto" d={PAISAJE.pasto} />
                {/* El suelo sigue bajo el marco: en vertical la tierra sube y no queda hueco. */}
                <rect className="mc-pasto" x="0" y="990" width={ANCHO} height="900" />
                {ARBOLES.filter((a) => a.capa === 'cerca' && a.s >= 1).map((a, i) => <Aliso key={i} x={a.x} y={a.y + 150} s={a.s} />)}
                {MATOJOS.map((m, i) => (
                    <path key={i} className="mc-matojo" style={{ transformOrigin: `${m.x}px ${m.y}px`, animationDelay: `${-m.fase * 3}s` }} d={m.hojas} />
                ))}
                {e.escarcha && <path className="mc-escarcha__frente" d={PAISAJE.pasto} />}
            </svg>
            {e.niebla && <div className="mc-capa mc-niebla mc-niebla--ras" aria-hidden="true"><span /><span /></div>}

            {e.lluvia && (
                <svg className="mc-capa mc-lluvia" data-capa="lluvia" data-mm={e.lluvia.mm} data-desde={iso(e.lluvia.desde)} data-hasta={iso(e.lluvia.hasta)}
                    viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    {gotasPara(e.lluvia.mm).map((g, i) => (
                        <line key={i} x1={g.x} y1={-6} x2={g.x - 0.6 * (1 + Math.abs(deriva))} y2={-6 + 4.2 * g.largo}
                            style={{ animationDelay: `${-g.retraso * 0.9}s` }} />
                    ))}
                </svg>
            )}
            {e.relampago && <div className="mc-capa mc-destello" aria-hidden="true" />}

            {e.astro && zona('astro', 'mc-zona--astro', { left: `${astroIzq}%`, top: `${astroArriba}%` })}
            {zona('nubes', 'mc-zona--nubes')}
            {zona('lluvia', 'mc-zona--lluvia')}
            {zona('niebla', 'mc-zona--niebla')}
            {zona('escarcha', 'mc-zona--escarcha')}
        </div>
    );
}
