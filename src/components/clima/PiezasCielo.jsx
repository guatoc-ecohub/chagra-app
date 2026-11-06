import { useEffect, useState } from 'react';
import { cifra, iconoDelDia, LLUVIA_APRECIABLE_MM } from './cieloHoy.js';
import { diaEsCO } from '../../utils/fechaEsCO.js';
import { ANCHO_EJE_DEFECTO, marcasEje, xDelInstante } from './ejeHoras.js';

/**
 * IconoTiempo — íconos del tiempo dibujados en el repo (SVG en línea, sin
 * librería). Reemplazan los emoji de la tira de días. Cada uno se mueve solo
 * por lo que dice su dato: el sol gira despacio, la nube deriva, la gota cae,
 * el rayo destella. Con `prefers-reduced-motion` quedan quietos.
 */
const ETIQUETA = {
    sol: 'Soleado',
    'sol-nube': 'Sol y nubes',
    nube: 'Cubierto',
    niebla: 'Neblina',
    llovizna: 'Llovizna',
    lluvia: 'Lluvia',
    tormenta: 'Tormenta',
    'sin-dato': 'Sin dato',
};

function Sol({ cx = 24, cy = 24, r = 8 }) {
    return (
        <g className="it-sol">
            <g className="it-sol__rayos">
                {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                    <line key={a} x1={cx} y1={cy - r - 4} x2={cx} y2={cy - r - 8.5} transform={`rotate(${a} ${cx} ${cy})`} />
                ))}
            </g>
            <circle className="it-sol__disco" cx={cx} cy={cy} r={r} />
        </g>
    );
}

function Nube({ x = 0, y = 0, oscura = false }) {
    return (
        <path
            className={`it-nube${oscura ? ' it-nube--oscura' : ''}`}
            transform={`translate(${x} ${y})`}
            d="M14 36h22a8 8 0 0 0 .6-16A11 11 0 0 0 15.4 22.4 7 7 0 0 0 14 36Z"
        />
    );
}

function Gotas({ n = 3, larga = true }) {
    const xs = n === 3 ? [17, 24, 31] : [19, 29];
    return (
        <g className="it-gotas">
            {xs.map((x, i) => (
                <line key={x} className="it-gota" style={{ animationDelay: `${-i * 0.35}s` }}
                    x1={x} y1={38} x2={x - 2} y2={larga ? 45 : 42} />
            ))}
        </g>
    );
}

export default function IconoTiempo({ tipo = 'sin-dato', size = 40, titulo = undefined }) {
    const nombre = titulo || ETIQUETA[tipo] || ETIQUETA['sin-dato'];
    return (
        <svg className={`icono-tiempo icono-tiempo--${tipo}`} data-icono={tipo} viewBox="0 0 48 48"
            width={size} height={size} role="img" aria-label={nombre}>
            <title>{nombre}</title>
            {tipo === 'sol' && <Sol />}
            {tipo === 'sol-nube' && (
                <>
                    <Sol cx={18} cy={17} r={6.5} />
                    <g className="it-deriva"><Nube x={4} y={2} /></g>
                </>
            )}
            {tipo === 'nube' && (
                <g className="it-deriva">
                    <Nube x={-4} y={-6} oscura />
                    <Nube x={3} y={0} />
                </g>
            )}
            {tipo === 'niebla' && (
                <g className="it-niebla">
                    <Nube x={0} y={-8} />
                    <line className="it-niebla__banda" x1="8" y1="34" x2="36" y2="34" />
                    <line className="it-niebla__banda it-niebla__banda--2" x1="13" y1="40" x2="41" y2="40" />
                </g>
            )}
            {tipo === 'llovizna' && (
                <>
                    <Nube x={0} y={-6} />
                    <Gotas n={2} larga={false} />
                </>
            )}
            {tipo === 'lluvia' && (
                <>
                    <Nube x={0} y={-6} oscura />
                    <Gotas n={3} />
                </>
            )}
            {tipo === 'tormenta' && (
                <>
                    <Nube x={0} y={-8} oscura />
                    <path className="it-rayo" d="M25 28l-6 9h5l-3 8 9-11h-5l3-6Z" />
                    <line className="it-gota" x1={16} y1={34} x2={14} y2={40} />
                    <line className="it-gota" style={{ animationDelay: '-0.5s' }} x1={34} y1={34} x2={32} y2={40} />
                </>
            )}
            {tipo === 'sin-dato' && (
                <circle className="it-sin-dato" cx="24" cy="24" r="12" />
            )}
        </svg>
    );
}

/* ── Numeral de ahora ───────────────────────────────────────────────── */

/**
 * La temperatura usa ancho tipográfico real para mantener °C junto a la cifra.
 */
export function Numeral({ valor }) {
    const texto = String(valor);
    return (
        <span className="cl-numeral" data-testid="clima-numeral">
            <span className="cl-numeral__texto" aria-label={`${texto} grados`}>{texto}</span>
            <span className="cl-numeral__unidad">°C</span>
        </span>
    );
}

/* ── Brújula del viento ─────────────────────────────────────────────── */

/**
 * La aguja apunta hacia DONDE VA el viento (dirección meteorológica + 180°) y
 * se asienta con resorte cuando llega el dato. Las rachas corren a lo largo
 * de la aguja con un periodo que sale de la velocidad: sin viento, quietas.
 */
export function Brujula({ viento }) {
    const [giro, setGiro] = useState(0);
    const destino = viento?.direccion == null ? null : (viento.direccion + 180) % 360;
    useEffect(() => {
        if (destino == null) return undefined;
        const id = requestAnimationFrame(() => setGiro(destino));
        return () => cancelAnimationFrame(id);
    }, [destino]);
    const kmh = viento?.kmh;
    const periodo = kmh != null && kmh >= 1 ? Math.min(6, Math.max(0.5, 36 / kmh)) : null;
    return (
        <div className="cl-brujula" data-testid="clima-brujula">
            <svg viewBox="0 0 100 100" className="cl-brujula__svg" aria-hidden="true">
                <circle cx="50" cy="50" r="44" className="cl-brujula__aro" />
                {[0, 90, 180, 270].map((a) => (
                    <line key={a} x1="50" y1="8" x2="50" y2="14" className="cl-brujula__marca" transform={`rotate(${a} 50 50)`} />
                ))}
                <text x="50" y="24" className="cl-brujula__letra">N</text>
                <text x="80" y="54" className="cl-brujula__letra">E</text>
                <text x="50" y="84" className="cl-brujula__letra">S</text>
                <text x="20" y="54" className="cl-brujula__letra">O</text>
                {destino != null && (
                    <g className="cl-brujula__aguja" style={{ transform: `rotate(${giro}deg)` }}>
                        <line x1="50" y1="72" x2="50" y2="30" className="cl-brujula__asta" />
                        <path d="M50 22 L56 34 L44 34 Z" className="cl-brujula__punta" />
                        {periodo != null && [0, 1, 2].map((i) => (
                            <line key={i} x1="44" y1="66" x2="44" y2="58" className="cl-brujula__racha"
                                style={{ animationDuration: `${periodo}s`, animationDelay: `${-i * periodo / 3}s` }} />
                        ))}
                    </g>
                )}
            </svg>
        </div>
    );
}

/* ── Arco del sol ───────────────────────────────────────────────────── */

export function ArcoSol({ arco }) {
    const t = arco?.avance;
    const ang = t == null ? null : Math.PI * (1 - t);
    const x = ang == null ? null : 50 + 42 * Math.cos(ang);
    const y = ang == null ? null : 50 - 42 * Math.sin(ang);
    return (
        <svg viewBox="0 0 100 56" className="cl-arco" aria-hidden="true" data-testid="clima-arco-sol">
            <path d="M8 50 A42 42 0 0 1 92 50" className="cl-arco__camino" />
            {t != null && <path d={`M8 50 A42 42 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`} className="cl-arco__hecho" />}
            <line x1="2" y1="50" x2="98" y2="50" className="cl-arco__horizonte" />
            {t != null && <circle cx={x} cy={y} r="5" className="cl-arco__sol" />}
        </svg>
    );
}

/* ── Próximas 24 horas ──────────────────────────────────────────────── */

function useAncho() {
    const [nodo, setNodo] = useState(null);
    const [ancho, setAncho] = useState(null);
    useEffect(() => {
        if (!nodo || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(([entry]) => {
            if (entry.contentRect.width > 0) setAncho(entry.contentRect.width);
        });
        observer.observe(nodo);
        return () => observer.disconnect();
    }, [nodo]);
    return [setNodo, ancho];
}

/**
 * Lluvia por hora en barras, viento y rachas por hora en líneas con el umbral
 * de 15 km/h de aplicar, y debajo la noche marcada con UN solo nivel de
 * helada: el servicio calcula un riesgo para toda la noche, no uno por hora.
 * La raya va gruesa en las horas que «¿Aplico?» descarta por viento: viento o
 * racha de 15 km/h o más al comenzar o al terminar la hora (W44, R1 de la v19).
 * Las barras pintan solo la lluvia que cuenta «¿Llueve?» (0,2 mm o más) y
 * quedan bajo la raya: mm y km/h no comparten escala (W44, R2 y R5). Con
 * `tormenta` (tormenta en el parte sin cantidad por hora), una cinta arriba
 * marca las horas de los días cuyo parte la trae (W42, Q6 de la v18).
 * `etiquetaHora(fila)` rotula la columna de la barra: debe dar la hora en que
 * EMPIEZA su intervalo (`inicioEpoch`), no el sello en que termina.
 */
export function Franja24h({ serie, etiquetaHora, tormenta = false }) {
    const [refEje, anchoEje] = useAncho();
    const filas = serie?.filas || [];
    if (filas.length === 0) return null;
    const n = filas.length;
    const W = 240;
    const paso = W / n;
    const topeLluvia = Math.max(2, serie.lluviaMax ?? 0);
    const topeViento = Math.max(30, serie.vientoMax ?? 0, serie.rachaMax ?? 0);
    const yViento = (v) => 44 - (v / topeViento) * 40;
    // El viento es instantáneo: cae en su sello, el borde derecho de la columna.
    const xInstante = xDelInstante(filas, paso);
    const linea = (clave) => filas.map((f) => (f[clave] == null ? null : `${xInstante(f.epoch).toFixed(2)},${yViento(f[clave]).toFixed(1)}`)).filter(Boolean).join(' ');
    const puntos = linea('viento');
    const puntosRacha = linea('racha');
    const sopla = filas.map((f, i) => (f.sopla ? i : null)).filter((i) => i != null);
    const yRaya = yViento(15);
    // Las barras viven bajo la raya: la más alta (el tope) queda 3 unidades por debajo.
    const altoLluvia = Math.max(8, 44 - yRaya - 3);
    const horasTormenta = tormenta ? filas.map((f, i) => (f.tormentaParte ? i : null)).filter((i) => i != null) : [];
    const noche = filas.map((f, i) => (f.nocheHelada ? i : null)).filter((i) => i != null);
    const nivel = serie.heladaRiesgo;
    // El mismo nombre del tramo que la tarjeta de frío y la voz.
    const tramo = serie.tramo || 'esta noche';
    // La noche sigue tras el borde derecho: punta de flecha en la banda y su hora en la leyenda (W41, P3 de la v17).
    const sigue = noche.length > 0 && serie.nocheSigueHastaEpoch != null && noche.at(-1) === n - 1;
    const horaSigue = sigue ? etiquetaHora({ inicioEpoch: serie.nocheSigueHastaEpoch, epoch: serie.nocheSigueHastaEpoch + 3600000 }) : '';
    return (
        <figure className="cl-franja" data-testid="clima-franja-24h">
            <svg viewBox={`0 0 ${W} 58`} preserveAspectRatio="none" className="cl-franja__svg" aria-hidden="true">
                {horasTormenta.map((i) => (
                    <rect key={`t${filas[i].time}`} x={i * paso} y="0" width={paso} height="4" className="cl-franja__tormenta" data-hora={filas[i].time} />
                ))}
                {filas.map((f, i) => {
                    const h = f.lluviaMm == null || f.lluviaMm < LLUVIA_APRECIABLE_MM ? 0 : Math.min(1, f.lluviaMm / topeLluvia) * altoLluvia;
                    return <rect key={f.time} x={i * paso + 1} y={44 - h} width={paso - 2} height={h} className="cl-franja__lluvia" data-hora={f.time} />;
                })}
                <line x1="0" x2={W} y1={yRaya} y2={yRaya} className="cl-franja__umbral" vectorEffect="non-scaling-stroke" />
                {puntosRacha && <polyline points={puntosRacha} className="cl-franja__racha" vectorEffect="non-scaling-stroke" />}
                {puntos && <polyline points={puntos} className="cl-franja__viento" vectorEffect="non-scaling-stroke" />}
                {/* Donde se pasa, la raya se vuelve sólida y gruesa en la columna que termina en ese
                    sello: encima de las barras, para que la lluvia no la tape. */}
                {sopla.map((i) => (
                    <line key={`s${filas[i].time}`} x1={i * paso} x2={(i + 1) * paso} y1={yRaya} y2={yRaya}
                        className="cl-franja__sopla" vectorEffect="non-scaling-stroke" data-hora={filas[i].time} />
                ))}
                <line x1="0" x2={W} y1="44" y2="44" className="cl-franja__base" vectorEffect="non-scaling-stroke" />
                {noche.length > 0 && (
                    <rect x={noche[0] * paso} y="48" width={(noche.at(-1) - noche[0] + 1) * paso} height="7" rx="3.5"
                        className={`cl-franja__noche cl-franja__noche--${nivel || 'sin-dato'}`} />
                )}
                {sigue && (
                    <path d={`M${W - 6} 46 L${W} 51.5 L${W - 6} 57 Z`} data-testid="clima-franja-noche-sigue"
                        className={`cl-franja__noche cl-franja__noche--${nivel || 'sin-dato'} cl-franja__sigue`} />
                )}
            </svg>
            <div ref={refEje} className="cl-franja__horas" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden="true">
                {marcasEje(filas, etiquetaHora, anchoEje ?? ANCHO_EJE_DEFECTO).map(({ i, texto, span }) => (
                    <span key={`h${filas[i].time}`} className="cl-franja__hora" style={{ gridColumn: `${i + 1} / span ${span}` }}>{texto}</span>
                ))}
            </div>
            {/* Cada entrada en dos columnas, muestra y texto: el segundo renglón empieza bajo el texto (W42, Q2 de la v18).
                Corta a propósito: una entrada por cosa dibujada, la raya una sola vez (W44, R5 de la v19). */}
            <figcaption className="cl-franja__leyenda">
                <span><i className="cl-leyenda cl-leyenda--lluvia" /> <span>Lluvia desde {cifra(LLUVIA_APRECIABLE_MM, 1)}{'\u00a0'}mm, tope {cifra(topeLluvia)}{'\u00a0'}mm</span></span>
                <span className="cl-franja__leyenda-par"><i className="cl-leyenda cl-leyenda--viento" /> <span>Viento</span><i className="cl-leyenda cl-leyenda--racha" /> <span>rachas</span></span>
                <span><i className={`cl-leyenda cl-leyenda--raya${sopla.length > 0 ? ' cl-leyenda--raya-sopla' : ''}`} /> <span>15{'\u00a0'}km/h{sopla.length > 0 ? '; gruesa: no aplicar' : ', límite para aplicar'}</span></span>
                {horasTormenta.length > 0 && (
                    <span><i className="cl-leyenda cl-leyenda--tormenta" /> <span>Posible tormenta, sin mm por hora</span></span>
                )}
                {noche.length > 0 && (
                    <span><i className={`cl-leyenda cl-leyenda--noche-${nivel || 'sin-dato'}`} /> <span>{nivel ? `Riesgo de helada ${tramo}: ${nivel}` : `Sin cálculo de helada ${tramo}`}{sigue && `; la noche sigue hasta ${/^1 /.test(horaSigue) ? 'la' : 'las'} ${horaSigue}`}</span></span>
                )}
            </figcaption>
        </figure>
    );
}

/* ── Franja de días ─────────────────────────────────────────────────── */

export function FranjaDias({ dias, testid = 'clima-franja-dias', indiceInicio = 0, mostrarProbabilidad = true, mostrarLluvia = false, leyenda = null }) {
    if (!Array.isArray(dias) || dias.length === 0) return null;
    const temperaturas = dias.flatMap((d) => [d.temp_min, d.temp_max]).filter(Number.isFinite);
    const escalaMin = temperaturas.length ? Math.min(...temperaturas) : 0;
    const escalaMax = temperaturas.length ? Math.max(...temperaturas) : 1;
    const amplitud = escalaMax - escalaMin || 1;
    return (
        <div data-testid={testid}>
        <p className="cl-dias__leyenda">{leyenda || 'Probabilidad por hora en los primeros 3 días; desde el cuarto, tendencia con la lluvia prevista en mm. La barra compara mín. a máx. en una escala común, con menor certeza en los días lejanos.'}</p>
        <ol className="cl-dias">
            {dias.map((d, indice) => {
                const indicePronostico = indiceInicio + indice;
                const tipo = iconoDelDia(d);
                const tieneRango = Number.isFinite(d.temp_min) && Number.isFinite(d.temp_max);
                const inicio = tieneRango ? ((d.temp_min - escalaMin) / amplitud) * 100 : 0;
                const ancho = tieneRango ? ((d.temp_max - d.temp_min) / amplitud) * 100 : 0;
                const lluviaDestacada = Number.isFinite(d.precip_mm) && Math.round(d.precip_mm) >= 14;
                const pesoLluvia = lluviaDestacada ? 0.16 + 0.3 * Math.max(0, d.precip_mm - 14) / (d.precip_mm + 14) : 0;
                const opacidad = Math.max(0.34, 1 - (indice / Math.max(1, dias.length - 1)) * 0.66);
                return (
                    <li key={d.date} className="cl-dia">
                        {/* UN formato de día en toda «El tiempo» (CLIMA-R7): «jue 24». */}
                        <span className="cl-dia__nombre">{diaEsCO(d.date) || 'sin fecha'}</span>
                        <IconoTiempo tipo={tipo} size={32} />
                        <span className="cl-dia__min" aria-label={`Mínima ${tieneRango ? `${cifra(d.temp_min, 1)} grados` : 'sin dato'}`}>
                            {/* Un decimal, como la tarjeta de frío: la misma mínima no se dice con dos cifras. */}
                            {Number.isFinite(d.temp_min) ? `${cifra(d.temp_min, 1)}°` : '—'}
                        </span>
                        <span className="cl-dia__escala" aria-hidden="true">
                            {tieneRango && <span className="cl-dia__rango" data-testid="clima-rango-dia"
                                data-min={d.temp_min} data-max={d.temp_max} data-start={inicio} data-width={ancho}
                                style={{ left: `${inicio}%`, width: `${ancho}%`, opacity: opacidad }} />}
                        </span>
                        <span className="cl-dia__max" aria-label={`Máxima ${tieneRango ? `${Math.round(d.temp_max)} grados` : 'sin dato'}`}>
                            {Number.isFinite(d.temp_max) ? `${Math.round(d.temp_max)}°` : '—'}
                        </span>
                        {mostrarLluvia && <span className={`cl-dia__lluvia${lluviaDestacada ? ' cl-dia__lluvia--destacada' : ''}`} style={lluviaDestacada ? { '--lluvia-peso': pesoLluvia } : undefined} aria-label={`Lluvia ${Number.isFinite(d.precip_mm) ? `${Math.round(d.precip_mm)} milímetros` : 'sin dato'}`}>
                            <span>{Number.isFinite(d.precip_mm) ? `${Math.round(d.precip_mm)} mm` : 'sin dato'}</span>
                            {mostrarProbabilidad && indicePronostico < 3 && Number.isFinite(d.precip_prob) && <small className="cl-dia__lluvia-prob">{d.precip_prob} %</small>}
                        </span>}
                        {!mostrarLluvia && <span className="cl-dia__prob">{mostrarProbabilidad ? (indicePronostico >= 3 ? <>
                            {/* Un renglón por cifra (R7 de la v13): la leyenda ya dice que desde el cuarto día es tendencia. */}
                            <span className="sr-only">Tendencia</span><span className="sr-only">día {indicePronostico + 1}</span>
                            <strong>{Number.isFinite(d.precip_mm) ? `${cifra(d.precip_mm, 1)} mm` : 'sin dato'}</strong>
                        </> : Number.isFinite(d.precip_prob) ? `${d.precip_prob}\u00a0%` : 'sin dato') : null}</span>}
                    </li>
                );
            })}
        </ol>
        </div>
    );
}
