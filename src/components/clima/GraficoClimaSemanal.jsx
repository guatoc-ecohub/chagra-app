/**
 * T44 — Gráfico de clima semanal (SVG puro, sin librerías).
 *
 * Dos bandas apiladas que comparten el eje de días (NO dual-axis en un mismo
 * plot): arriba temperatura (máx roja / mín azul + relleno del rango del día +
 * los valores en grados), abajo lluvia (barras en mm). Etiquetas de día REALES
 * derivadas de la fecha (no hardcodeadas) y el día de HOY marcado. El detalle accesible se presenta en la lista de días.
 * Datos de Open-Meteo via climaService.
 */
import { useEffect, useRef, useState } from 'react';
import { fincaDateISO } from '../../utils/farmDate.js';
import { diaEsCO } from '../../utils/fechaEsCO.js';
import { FranjaDias } from './PiezasCielo.jsx';
/** @typedef {{ dia: string, tempMax: number|null, tempMin: number|null, lluviaMm: number|null, prob?: number, weathercode?: number }} DiaClima */

/** Tramos de índices consecutivos que cumplen `valido`: la línea se corta donde no hay dato. */
function tramos(n, valido) {
  const lista = [];
  let actual = null;
  for (let i = 0; i < n; i += 1) {
    if (valido(i)) {
      if (!actual) { actual = []; lista.push(actual); }
      actual.push(i);
    } else {
      actual = null;
    }
  }
  return lista;
}

const C = {
  max: '#f87171', // rojo — temperatura máxima (línea superior)
  min: '#60a5fa', // azul — temperatura mínima (línea inferior)
  lluvia: '#22d3ee', // turquesa — lluvia, separado del azul de la mínima
  rango: 'rgba(148,163,184,0.14)', // relleno del rango diario
  grid: 'rgba(148,163,184,0.18)',
  ink: '#e2e8f0', // texto principal (slate-200)
  inkTenue: '#94a3b8', // texto secundario (slate-400)
  hoy: 'rgba(56,189,248,0.12)', // resalte de la columna de hoy
  fuerte: '#fbbf24', // ámbar: día con 14 mm o más
};

// Desde aquí la barra del día va en ámbar (y entra en la leyenda).
const MM_FUERTE = 14;

/** Ancho estimado (px) de una cifra corta («100», «83 %», «sin dato») a `fs` px. */
function anchoCifra(texto, fs) {
  let em = 0;
  for (const c of texto) em += c === ' ' ? 0.28 : c === '%' ? 0.83 : 0.56;
  return em * fs;
}

/**
 * Centros de las probabilidades en UN renglón: cada una bajo su columna, y si
 * dos se tocan, la de la derecha se corre lo justo.
 */
function centrosEnRenglon(centros, anchos, hueco = 5) {
  const fuera = [];
  centros.forEach((c, i) => {
    const minimo = i === 0 ? -Infinity : fuera[i - 1] + (anchos[i - 1] + anchos[i]) / 2 + hueco;
    fuera.push(Math.max(c, minimo));
  });
  return fuera;
}

function etiquetaDia(iso, hoy) {
  // UN formato de día en toda «El tiempo» (CLIMA-R7): «jue 24», no «Ju 24».
  const dow = (diaEsCO(iso) || '');
  // BUG TODAY-UTC-HELADA-20260905: "Hoy" se decide en el calendario de la
  // FINCA, no en la zona del runtime/UTC (los `date` del forecast son locales
  // de la finca).
  const esHoy = iso === (hoy || fincaDateISO());
  return { dow, esHoy };
}

/**
 * @param {{ datos: DiaClima[], ancho?: number, alto?: number, hoy?: string }} props
 *   `hoy`: fecha de hoy en la finca (la del pronóstico); si falta, fincaDateISO().
 */
export default function GraficoClimaSemanal({ datos, ancho: anchoBase = 340, alto: altoBase = 210, hoy = undefined }) {
  const contenedor = useRef(null);
  const [anchoMedido, setAnchoMedido] = useState(null);
  const sinDatos = !datos || datos.length === 0;
  useEffect(() => {
    const elemento = contenedor.current;
    if (!elemento || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setAnchoMedido(entry.contentRect.width);
    });
    observer.observe(elemento);
    return () => observer.disconnect();
  }, [sinDatos]);
  if (sinDatos) {
    return <div className="text-xs text-slate-400 py-4 text-center">Sin datos de clima de la finca todavía.</div>;
  }
  const conProb = datos.some((d) => Number.isFinite(d.prob));
  const compacto = datos.length > 7;
  // Unidades del SVG = píxeles CSS: cambia el ancho del trazado, no la letra.
  const ancho = anchoMedido ?? anchoBase;

  // Deja espacio para las etiquetas del eje, incluso en el borde izquierdo.
  const padL = 38, padR = 16;
  const plotW = ancho - padL - padR;
  const col = plotW / datos.length;
  const cx = (i) => padL + (i + 0.5) * col;
  // Cada probabilidad va bajo su columna, en un solo renglón. Si la columna no
  // alcanza para «100 %», va la cifra sola y el «%» sale una vez en el margen, como «mm».
  const angosto = col < 40;
  // Con columnas anchas cabe el día de cada columna; si no, uno de cada cuatro.
  const todosLosDias = !compacto || col >= 48;
  // Un renglón de 16 px bajo el rótulo del día.
  const alto = altoBase + (conProb ? 16 : 0);

  // Banda de temperatura (arriba)
  const legendH = 20;
  const tTop = legendH + 8;
  const tH = 82;
  // Un null de la fuente no es 0 °C: el eje sale solo de los valores medidos.
  const hayMax = (d) => Number.isFinite(d.tempMax);
  const hayMin = (d) => Number.isFinite(d.tempMin);
  const temps = datos.flatMap((d) => [d.tempMax, d.tempMin]).filter((t) => Number.isFinite(t));
  const hayTemps = temps.length > 0;
  const tMin = hayTemps ? Math.floor(Math.min(...temps) - 1) : 0;
  const tMax = hayTemps ? Math.ceil(Math.max(...temps) + 1) : 1;
  const tRango = tMax - tMin || 1;
  const yT = (t) => tTop + tH - ((t - tMin) / tRango) * tH;
  const ticks = hayTemps ? [tMin, Math.round((tMin + tMax) / 2), tMax] : [];

  // Banda de lluvia (abajo)
  const rTop = tTop + tH + 36;
  const rH = 32;
  const lluvias = datos.map((d) => d.lluviaMm).filter((value) => Number.isFinite(value));
  const maxLl = Math.max(...lluvias, 1);
  const yLl = (v) => rTop + rH - (v / maxLl) * rH;

  const dias = datos.map((d) => ({ ...d, ...etiquetaDia(d.dia, hoy) }));
  const grados = (t) => (Number.isFinite(t) ? `${Math.round(t)}°` : 'sin dato');
  const resumen = dias
    .map((d) => `${d.esHoy ? 'Hoy' : d.dow}: máx ${grados(d.tempMax)}, mín ${grados(d.tempMin)}, lluvia ${Number.isFinite(d.lluviaMm) ? `${Math.round(d.lluviaMm)} mm` : 'sin dato'}`)
    .join('. ');
  const tramosMax = tramos(dias.length, (i) => hayMax(dias[i]));
  const tramosMin = tramos(dias.length, (i) => hayMin(dias[i]));
  const tramosRango = tramos(dias.length, (i) => hayMax(dias[i]) && hayMin(dias[i]));
  const puntos = (idx, campo) => idx.map((i) => `${cx(i)},${yT(dias[i][campo])}`).join(' ');
  const yDia = altoBase - 4;
  const hayFuerte = dias.some((d) => Number.isFinite(d.lluviaMm) && Math.round(d.lluviaMm) >= MM_FUERTE);
  const fsProb = angosto ? 11 : 12;
  const probs = dias.slice(0, 3).map((d) => {
    if (!Number.isFinite(d.prob)) return 'sin dato';
    return angosto ? `${Math.round(d.prob)}` : `${Math.round(d.prob)} %`;
  });
  const xProb = centrosEnRenglon(probs.map((_, i) => cx(i)), probs.map((t) => anchoCifra(t, fsProb)));

  const grafico = (
    <svg width="100%" height={alto} viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" role="img"
      aria-label={`Temperatura y lluvia de ${datos.length} días. ${resumen}`}
      style={{ display: 'block' }}>
      {/* Leyenda */}
      <g fontSize="12" fill={C.inkTenue}>
        <circle cx={padL + 3} cy={10} r={3} fill={C.max} />
        <text x={padL + 10} y={13}>Máx</text>
        <circle cx={padL + 42} cy={10} r={3} fill={C.min} />
        <text x={padL + 49} y={13}>Mín</text>
        <circle cx={padL + 81.5} cy={10.5} r={3.5} fill={C.lluvia} />
        <text x={padL + 89} y={13}>Lluvia (mm)</text>
        {hayFuerte && (
          <g data-testid="grafico-leyenda-fuerte">
            <rect x={padL + 165} y={6} width={7} height={9} rx={2} fill={C.fuerte} />
            <text x={padL + 177} y={13}>{MM_FUERTE}{'\u00a0'}mm o más</text>
          </g>
        )}
      </g>

      {/* El sombreado crece con el plazo: expresa menor certeza sin inventar porcentajes. */}
      {dias.map((d, i) => i >= 3 ? (
        <rect key={`certeza-${i}`} x={cx(i) - col / 2} y={tTop - 2} width={col} height={rTop + rH - tTop + 4}
          fill="#94a3b8" opacity={Math.min(0.24, 0.035 + (i - 3) * 0.018)} />
      ) : null)}

      {/* Resalte de hoy (ambas bandas) */}
      {dias.map((d, i) => d.esHoy ? (
        <rect key={`hoy-${i}`} x={cx(i) - col / 2} y={tTop - 2} width={col} height={rTop + rH - tTop + 4} fill={C.hoy} rx={4} />
      ) : null)}

      {/* Grid + ejes °C de la banda de temperatura */}
      {ticks.map((t, k) => (
        <g key={`tk-${k}`}>
          <line x1={padL} y1={yT(t)} x2={ancho - padR} y2={yT(t)} stroke={C.grid} strokeWidth="1" />
          <text x={padL - 4} y={yT(t) + 3} textAnchor="end" fontSize="12" fill={C.inkTenue}>{t}°</text>
        </g>
      ))}

      {/* Relleno del rango diario (entre máx y mín), solo donde hay los dos */}
      {tramosRango.filter((idx) => idx.length > 1).map((idx) => (
        <polygon key={`rango-${idx[0]}`} fill={C.rango}
          points={`${puntos(idx, 'tempMax')} ${puntos(idx.slice().reverse(), 'tempMin')}`} />
      ))}

      {/* Líneas máx / mín, cortadas donde falta el dato */}
      {tramosMax.filter((idx) => idx.length > 1).map((idx) => (
        <polyline key={`lmax-${idx[0]}`} data-testid="grafico-linea-max" fill="none" stroke={C.max} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
          points={puntos(idx, 'tempMax')} />
      ))}
      {tramosMin.filter((idx) => idx.length > 1).map((idx) => (
        <polyline key={`lmin-${idx[0]}`} data-testid="grafico-linea-min" fill="none" stroke={C.min} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
          points={puntos(idx, 'tempMin')} />
      ))}

      {/* Columna sin dato: se dice, no se dibuja */}
      {dias.map((d, i) => (!hayMax(d) || !hayMin(d)) ? (
        <g key={`sd-${i}`} data-testid="grafico-sin-dato">
          <rect x={cx(i) - col / 2 + 1} y={tTop - 2} width={col - 2} height={tH + 4} rx={3}
            fill="none" stroke={C.inkTenue} strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
          <text x={cx(i)} y={tTop + tH / 2} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill={C.inkTenue}
            transform={col < 56 ? `rotate(-90 ${cx(i)} ${tTop + tH / 2})` : undefined}>sin dato</text>
        </g>
      ) : null)}

      {/* Puntos + valores de temperatura (en 16 días, solo el punto de un día aislado) */}
      {dias.map((d, i) => (
        <g key={`tp-${i}`}>
          {hayMax(d) && (!compacto || !tramosMax.some((idx) => idx.length > 1 && idx.includes(i))) && <circle cx={cx(i)} cy={yT(d.tempMax)} r={2.4} fill={C.max} />}
          {hayMin(d) && (!compacto || !tramosMin.some((idx) => idx.length > 1 && idx.includes(i))) && <circle cx={cx(i)} cy={yT(d.tempMin)} r={2.4} fill={C.min} />}
          {!compacto && hayMax(d) && <text x={cx(i)} y={yT(d.tempMax) - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill={C.ink}>{Math.round(d.tempMax)}°</text>}
          {!compacto && hayMin(d) && <text x={cx(i)} y={yT(d.tempMin) + 11} textAnchor="middle" fontSize="12" fill={C.inkTenue}>{Math.round(d.tempMin)}°</text>}
        </g>
      ))}

      {/* Barras de lluvia + mm */}
      <line x1={padL} y1={rTop + rH} x2={ancho - padR} y2={rTop + rH} stroke={C.grid} strokeWidth="1" />
      {dias.map((d, i) => {
        const mm = Number.isFinite(d.lluviaMm) ? Math.round(d.lluviaMm) : null;
        const barWidth = Math.min(14, col * 0.58);
        return (
          <g key={`ll-${i}`}>
            {mm !== null && mm > 0 && (
              <>
                <rect data-testid="grafico-barra-lluvia" x={cx(i) - barWidth / 2} y={yLl(d.lluviaMm)} width={barWidth} height={Math.max(2, rTop + rH - yLl(d.lluviaMm))} rx="2" fill={mm >= MM_FUERTE ? C.fuerte : C.lluvia} />
                {!compacto && <text x={cx(i)} y={yLl(d.lluviaMm) - 3} textAnchor="middle" fontSize="12" fontWeight="700" fill="#67e8f9">{mm}</text>}
              </>
            )}
          </g>
        );
      })}
      <text x={padL - 4} y={rTop - 14} textAnchor="end" fontSize="12" fill={C.inkTenue}>mm</text>
      {compacto && <text x={padL - 4} y={rTop + rH} textAnchor="end" fontSize="12" fill={C.inkTenue}>0</text>}
      {compacto && <text x={padL - 4} y={rTop + 4} textAnchor="end" fontSize="12" fill={C.inkTenue}>{Math.round(maxLl)}</text>}

      {/* Etiquetas de día reales + hoy en negrita; el primer día lleva un solo rótulo. */}
      {dias.map((d, i) => (todosLosDias || i % 4 === 0 && i <= dias.length - 4 || i === dias.length - 1) && (
        <text key={`dl-${i}`} data-testid="grafico-dia" x={cx(i)} y={yDia} textAnchor="middle" fontSize="12"
          fontWeight={d.esHoy ? '800' : '500'} fill={d.esHoy ? C.ink : C.inkTenue}>
          {d.esHoy ? 'Hoy' : d.dow}
        </text>
      ))}

      {/* Solo se cifra la probabilidad en los tres primeros días, en un renglón bajo sus columnas. */}
      {conProb && angosto && <text x={padL - 4} y={alto - 3} textAnchor="end" fontSize={fsProb} fill={C.lluvia}>%</text>}
      {conProb && probs.map((texto, i) => (
        <g key={`pb-${i}`} data-testid="grafico-probabilidad">
          <text x={xProb[i]} y={alto - 3} textAnchor="middle" fontSize={fsProb} fill={C.lluvia}>{texto}</text>
        </g>
      ))}

    </svg>
  );
  const diasExtendidos = datos.slice(0, 16).map((d) => ({
    date: d.dia,
    temp_min: d.tempMin,
    temp_max: d.tempMax,
    precip_prob: d.prob,
    precip_mm: d.lluviaMm,
    weathercode: d.weathercode,
  }));
  return (
    <>
      <div ref={contenedor} className="grafico-clima-contenedor">{grafico}</div>
      {diasExtendidos.length > 0 && (
        <div className="cl-dias-extendidos">
          <h4 className="cl-dias-extendidos__titulo">Los 16 días · lluvia diaria y temperatura</h4>
          <FranjaDias dias={diasExtendidos} testid="clima-franja-dias-extendidos" mostrarLluvia leyenda="Cada fila muestra la mínima, la máxima y la lluvia prevista para ese día. Las barras del gráfico muestran los milímetros; aquí la franja une mínima y máxima. Desde 14 mm, el ámbar gana intensidad con la lluvia prevista. El porcentaje aparece solo en los primeros 3 días. A más plazo, menor certeza." />
        </div>
      )}
    </>
  );
}
