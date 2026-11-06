import React, { useId, useState } from 'react';
import './cieloENSO.css';
import { ACCIONES_ENSO } from '../../data/climaBoletines';

/**
 * Ilustración estacional, no representa una observación ni una alerta local.
 * @param {{ family?: string, piso?: string|null, onNavigate?: (destino: string) => void, onPronostico?: () => void }} props
 */
export default function CieloENSO({ family = 'neutral', piso = null, onNavigate, onPronostico }) {
  const marcoId = useId();
  const detalleId = useId();
  const pigmento = (nombre) => `url(#${marcoId}-${nombre})`;
  const [abierto, setAbierto] = useState(false);
  const frio = piso === 'frio' || piso === 'paramo';
  const calido = piso === 'calido' || piso === 'templado';
  const conocido = frio || calido;
  const nocheFria = family === 'nino' && frio;
  const descripcion = family === 'nino'
    ? nocheFria
      ? 'Las noches despejadas pueden favorecer heladas: sin la cobija de nubes, el calor del suelo se escapa. En temporadas de El Niño puede haber más noches secas; mire la mínima de su finca.'
      : calido
        ? 'Con El Niño llueve menos y hace más calor: el agua escasea.'
        : 'Sin la altura de su finca no puedo decirle cómo le pega El Niño.'
    : family === 'nina'
      ? 'La Niña: atención al exceso de lluvia; el efecto local depende de la región y del piso.'
      : 'Fase neutral: consulte el pronóstico local.';
  const pie = family === 'nino' && conocido
    ? frio ? 'Tendencia de la temporada, no el pronóstico de esta noche.'
      : 'Riesgo estacional de sequía, no el pronóstico de esta semana.'
    : null;
  const sinAltitud = family === 'nino' && !conocido;
  const accion = family === 'nino'
    ? sinAltitud ? 'Poner la altura de mi finca'
      : frio ? 'Mire la mínima de cada noche' : 'Guarde agua y ponga mulch (hojarasca o pasto seco)'
    : family === 'neutral' ? 'Ver consejo de siembra' : (ACCIONES_ENSO[family] || ACCIONES_ENSO.neutral)[0].titulo;
  const detalle = family === 'nino'
    ? frio ? 'La fase no dice si helará esta noche: lo dice la mínima local. Antes de usar agua contra la helada, revise con un técnico si su sistema y su reserva sirven.'
      : 'Recoja lluvia y cubra la tierra con hojarasca o pasto seco para conservar la humedad.'
    : (ACCIONES_ENSO[family] || ACCIONES_ENSO.neutral)[0].detalle;
  return (
    <figure className="clima-enso-lectura rounded-2xl border border-slate-600 p-4">
    <p className="mb-2 text-sm font-black text-slate-100">{family === 'nino' ? 'El Niño' : family === 'nina' ? 'La Niña' : 'Neutral'} · {conocido ? `Su piso ${{ frio: 'frío', paramo: 'páramo', calido: 'cálido', templado: 'templado' }[piso]}` : 'Altura sin dato'}</p>
    <svg
      viewBox="0 0 220 120"
      className="w-full h-auto aspect-[220/120]"
      role="img"
      aria-label={descripcion}
      data-piso={conocido ? piso : 'sin-dato'}
      data-testid="cielo-enso"
      data-family={family}
    >
      <defs>
        <clipPath id={marcoId}><rect width="220" height="120" rx="10" /></clipPath>
        <clipPath id={`${marcoId}-flujo`}><rect x="124" y="56" width="46" height="42" /></clipPath>
        <linearGradient id={`${marcoId}-cielo`} x2="0" y2="1">
          <stop stopColor="#142b50" stopOpacity=".7" /><stop offset="1" stopColor="#628891" stopOpacity=".24" />
        </linearGradient>
        <radialGradient id={`${marcoId}-abrigo`} cx=".2" cy=".8" r=".8">
          <stop stopColor="#d99150" stopOpacity=".38"/><stop offset="1" stopColor="#556f89" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id={`${marcoId}-despejado`} cx=".88" cy=".3" r=".65">
          <stop stopColor={calido ? '#efbe68' : '#71a9cd'} stopOpacity=".3"/><stop offset="1" stopColor="#355877" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id={`${marcoId}-suelo`}>
          <stop stopColor={calido ? '#345d4b' : '#805f43'}/><stop offset=".42" stopColor={calido ? '#4a6b4b' : '#75614f'}/>
          <stop offset=".65" stopColor={calido ? '#826b43' : '#516875'}/><stop offset="1" stopColor={calido ? '#a67a48' : '#3d6478'}/>
        </linearGradient>
        <linearGradient id={`${marcoId}-tierra`} x2="0" y2="1">
          <stop stopColor="#182f36" stopOpacity="0"/><stop offset="1" stopColor="#10252b" stopOpacity=".85"/>
        </linearGradient>
        <radialGradient id={`${marcoId}-nube`} cx=".4" cy=".12" r=".9">
          <stop stopColor="#fff6df"/><stop offset=".35" stopColor="#d7e2e5"/><stop offset=".7" stopColor="#8da8b9"/><stop offset="1" stopColor="#455f76"/>
        </radialGradient>
        <linearGradient id={`${marcoId}-panza`} x2="0" y2="1">
          <stop stopColor="#dce6e7" stopOpacity="0"/><stop offset="1" stopColor="#304e69" stopOpacity=".8"/>
        </linearGradient>
        <radialGradient id={`${marcoId}-luna`} cx=".25" cy=".3" r=".8">
          <stop stopColor="#fff9df"/><stop offset=".48" stopColor="#d7e5eb"/><stop offset=".67" stopColor="#7094ae"/><stop offset=".82" stopColor="#29455e"/><stop offset="1" stopColor="#1a354f"/>
        </radialGradient>
        <radialGradient id={`${marcoId}-halo`}>
          <stop stopColor="#d5edff" stopOpacity=".35"/><stop offset="1" stopColor="#a1d5f6" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id={`${marcoId}-vidrio`}>
          <stop stopColor="#5d8fa7" stopOpacity=".55"/><stop offset=".3" stopColor="#f0ffff" stopOpacity=".9"/><stop offset=".5" stopColor="#9bcfdb" stopOpacity=".18"/><stop offset="1" stopColor="#d7f6ff" stopOpacity=".8"/>
        </linearGradient>
        <linearGradient id={`${marcoId}-liquido`} gradientUnits="userSpaceOnUse" x1="193" x2="199" y1="0" y2="0">
          <stop stopColor="#d65b42"/><stop offset=".5" stopColor="#ffdc95"/><stop offset="1" stopColor="#d87748"/>
        </linearGradient>
        <linearGradient id={`${marcoId}-calor`} x2="0" y2="1">
          <stop stopColor="#fff0be"/><stop offset=".55" stopColor="#ffd58a"/><stop offset="1" stopColor="#d89255" stopOpacity=".1"/>
        </linearGradient>
        <radialGradient id={`${marcoId}-sol`} cx=".35" cy=".3">
          <stop stopColor="#fff8d3"/><stop offset=".65" stopColor="#ffe39a"/><stop offset="1" stopColor="#ecac51"/>
        </radialGradient>
        <linearGradient id={`${marcoId}-agua`}>
          <stop stopColor="#355f79"/><stop offset=".45" stopColor="#c0e6e6"/><stop offset="1" stopColor="#5a9eae"/>
        </linearGradient>
        <filter id={`${marcoId}-vapor`} x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation=".65"/></filter>
        <filter id={`${marcoId}-sombra`} x="-30%" y="-40%" width="160%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#091b30" floodOpacity=".65"/></filter>
        <filter id={`${marcoId}-bruma`} x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="2"/></filter>
        <filter id={`${marcoId}-relieve`} x="-60%" y="-30%" width="220%" height="170%"><feDropShadow dx="1" dy="2" stdDeviation="1.2" floodColor="#071c30" floodOpacity=".8"/></filter>
      </defs>
      <g clipPath={`url(#${marcoId})`}>
      <rect width="220" height="120" fill={pigmento('cielo')} />
      <rect width="220" height="120" fill={pigmento('abrigo')} />
      <rect width="220" height="120" fill={pigmento('despejado')} />
      <path d="M-5 100Q48 89 106 96T225 96V125H-5Z" fill={pigmento('suelo')} filter={pigmento('sombra')} />
      <path d="M-5 100Q48 89 106 96T225 96V125H-5Z" fill={pigmento('tierra')} />
      <path d="M-5 99Q48 88 106 95T225 95" fill="none" stroke={pigmento('suelo')} strokeWidth="2" />
      {family === 'nino' && calido && (
        <g data-testid="cielo-sol">

          <g fill="#f5f4df" fontSize="9" fontWeight="700" textAnchor="middle">
            <text x="54" y="15">Lluvia normal</text>
            <text x="165" y="15">El Niño</text>
            <text x="165" y="28">Menos lluvia</text>
          </g>
          <g filter={pigmento('sombra')}>
            <path d="M17 44Q13 37 23 34Q25 27 37 31Q43 22 54 30Q67 26 74 35Q87 33 87 44Q73 54 54 49Q35 55 17 44Z" fill={pigmento('nube')}/>
            <path d="M19 44Q40 48 49 43Q64 49 85 42Q75 53 53 49Q36 54 19 44Z" fill={pigmento('panza')} filter={pigmento('vapor')}/>
          </g>
          <g stroke="#9bdaef" strokeWidth="2.5" strokeLinecap="round">
            <path className="enso-lluvia" d="M32 56l-4 10 M51 56l-4 10 M70 56l-4 10" />
          </g>
          <g transform="translate(171 54)">
            <circle r="23" fill={pigmento('halo')} /><circle r="12" fill={pigmento('sol')} filter={pigmento('relieve')} />
            <path d="M0 -23v5 M0 18v5 M-23 0h5 M18 0h5 M-16 -16l4 4 M12 12l4 4 M16 -16l-4 4 M-12 12l-4 4" stroke="#ffdc83" strokeWidth="2.5" strokeLinecap="round" />
          </g>

          <path d="M48 80Q72 89 52 97T73 120" fill="none" stroke={pigmento('agua')} strokeWidth="8" />
          <path className="enso-caudal" d="M48 80Q72 89 52 97T73 120" fill="none" stroke="#d8f4e9" strokeWidth="1" strokeDasharray="3 10" />
          <path d="M145 96l14 7 -5 12 M159 103l18 -5 M197 110l13 7" fill="none" stroke="#342619" strokeWidth="2.5" />
          <g fill="#fff7e5" fontSize="9" fontWeight="700" textAnchor="middle">
            <text x="54" y="78">Agua corre</text><text x="165" y="84">Quebrada baja</text>
            <text x="165" y="117">Suelo seco</text>
          </g>
        </g>
      )}
      {nocheFria && (
        <g data-testid="cielo-noche-fria">

          <g fill="#edf4fa" fontSize="9" fontWeight="700" textAnchor="middle">
            <text x="54" y="14">Noche nublada</text>
            <text x="165" y="14">Noche despejada</text>
            <text x="165" y="27">Posible con El Niño</text>
          </g>
          <circle cx="190" cy="43" r="23" fill={pigmento('halo')} />
          <circle cx="190" cy="43" r="10" fill={pigmento('luna')} />
          <g fill="none" stroke="#b8d3df" strokeWidth=".5" opacity=".35">
            <ellipse cx="185" cy="40" rx="2" ry="1.4"/><ellipse cx="189" cy="47" rx="1.4" ry="1"/>
          </g>
          <g filter={pigmento('sombra')}>
            <path d="M10 44Q6 36 17 32Q20 24 32 27Q39 17 53 23Q66 18 77 28Q92 23 99 34Q108 41 98 46Q78 51 58 48Q33 54 10 44Z" fill={pigmento('nube')} />
            <path d="M12 40Q31 47 48 41Q71 47 99 39L98 45Q91 48 84 47Q75 52 67 48Q61 51 56 48Q46 52 39 49Q25 53 12 44Z" fill={pigmento('panza')} filter={pigmento('vapor')} />
            <path d="M16 33Q22 27 32 30M38 26Q44 21 53 26M61 25Q69 22 76 30" fill="none" stroke="#edf1e7" strokeOpacity=".45" filter={pigmento('vapor')} strokeWidth="1.4" strokeLinecap="round" />
          </g>
          <path d="M14 48Q32 52 43 48M62 49Q85 53 95 46" stroke="#a4bfce" strokeWidth="2.2" fill="none" filter={pigmento('bruma')} />
          <text className="enso-nube-rotulo" x="54" y="38" fontSize="9" fontWeight="700" textAnchor="middle" fill="#102c40">Nubes = cobija</text>
          <g fill="none" stroke={pigmento('calor')} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M29 91C25 80 31 73 29 67Q29 59 39 59H78Q88 59 88 68V89m-5 -5 5 5 5 -5" />
            <path className="enso-calor-rebota" pathLength="100" d="M29 91C25 80 31 73 29 67Q29 59 39 59H78Q88 59 88 68V89" stroke="#fff1c2" strokeWidth="3" />
            <path d="M137 91Q132 80 137 70T137 58m-4 4 4 -5 4 5 M160 91Q155 80 160 70T160 58m-4 4 4 -5 4 5" />
            <g clipPath={pigmento('flujo')}>{[137, 160].map((x, i) => <path key={x} className="enso-calor-sube" style={{ animationDelay: `${i * -1.5}s` }} d={`M${x} 92q-4 -6 0 -12q4 -6 0 -10`} stroke="#ffe4a3" strokeWidth="2.6" />)}</g>
          </g>
          <g fill="#ffe0a1" fontSize="9" fontWeight="700" textAnchor="middle">
            <text x="53" y="75">Calor</text><text x="53" y="86">se queda</text>
            <text x="155" y="43">Calor</text><text x="155" y="53">se escapa</text>
          </g>
          <g filter={pigmento('relieve')}>
            <path d="M192 64v21a6 6 0 1 0 8 0V64a4 4 0 0 0 -8 0Z" fill={pigmento('vidrio')} stroke="#d5edf1" strokeWidth=".7" />
            <path className="enso-mercurio" d="M196 67V90" stroke={pigmento('liquido')} strokeWidth="3" strokeLinecap="round" />
            <circle cx="196" cy="90" r="3.7" fill={pigmento('liquido')} />
            <path d="M193 65v18M192.7 88q-1 2 .5 3" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth=".7" strokeLinecap="round"/>
            <path d="M199 68h2M199 73h2M199 78h2" stroke="#c5e2ec" strokeWidth=".7"/>
          </g>
          <path d="M207 68v18m-3 -3 3 3 3 -3" fill="none" stroke="#b9e4f4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <g fill="#edf4fa" fontSize="9" fontWeight="700" textAnchor="middle">
            <text x="54" y="113">Suelo abrigado</text><text x="165" y="113">Temperatura baja</text>
          </g>
        </g>
      )}
      {sinAltitud && (
        <g data-testid="cielo-sin-altitud" fill="#e5eef6" textAnchor="middle">
          <text x="110" y="73" fontSize="62" fontWeight="800">?</text>
          <text x="110" y="99" fontSize="11">Falta la altura de su finca</text>
        </g>
      )}

      {family === 'nina' && (
        <g data-testid="cielo-lluvia">
          {/* Nube cargada */}
          <g className="clima-nube-deriva text-slate-400" fill="currentColor">
            <ellipse cx="90" cy="48" rx="34" ry="20" />
            <ellipse cx="120" cy="42" rx="26" ry="18" />
            <ellipse cx="140" cy="52" rx="22" ry="15" />
            <rect x="60" y="48" width="88" height="16" rx="8" />
          </g>
          {/* Lluvia */}
          <g className="text-sky-400" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            {[70, 90, 110, 130, 150].map((x, i) => (
              <line
                key={x}
                x1={x} y1="70" x2={x - 4} y2="86"
                className={`clima-gota clima-gota--${(i % 3) + 1}`}
              />
            ))}
          </g>
        </g>
      )}

      {(family === 'neutral') && (
        <g data-testid="cielo-mixto">
          {/* Sol asomando */}
          <circle cx="72" cy="46" r="17" className="text-amber-300/90" fill="currentColor" />
          <g className="clima-sol-rayos text-amber-400/80" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i * Math.PI) / 4;
              return (
                <line
                  key={i}
                  x1={72 + Math.cos(a) * 22}
                  y1={46 + Math.sin(a) * 22}
                  x2={72 + Math.cos(a) * 29}
                  y2={46 + Math.sin(a) * 29}
                />
              );
            })}
          </g>
          {/* Nube que deriva, tapando parte del sol */}
          <g className="clima-nube-deriva" filter={pigmento('sombra')}>
            <path d="M103 58c0-7 6-12 14-12 3-9 11-14 21-12 7-8 21-7 27 2 10-1 17 5 17 13 8 2 10 12 3 17h-69c-8 0-13-3-13-8Z" fill={pigmento('nube')} />
            <path d="M108 59c13 4 23-2 33 1 10 3 20 0 31-4-4 9-12 13-28 13h-23c-7 0-12-4-13-10Z" fill={pigmento('panza')} />
          </g>
        </g>
      )}
      </g>
    </svg>
    <figcaption className="mt-2 text-sm leading-relaxed text-slate-200">
      {descripcion}
      {family === 'nino' && conocido && <span data-testid="enso-lluvia-semanal" className="mt-2 block">El Niño baja la lluvia de la temporada; una semana puede llover igual.</span>}
      <button type="button" className="clima-enso-accion mt-3 w-full rounded-xl px-3 py-2 text-sm font-bold"
        aria-expanded={sinAltitud ? undefined : abierto} aria-controls={sinAltitud ? undefined : detalleId}
        onClick={() => sinAltitud
          ? onNavigate ? onNavigate('perfil') : window.dispatchEvent(new CustomEvent('chagra:nav', { detail: 'perfil' }))
          : setAbierto(!abierto)}>{accion}</button>
      {abierto && !sinAltitud && <div id={detalleId} className="mt-2 text-sm text-slate-100">
        <p>{detalle}</p>
        {onPronostico && <button type="button" className="min-h-11 underline" onClick={onPronostico}>{frio ? 'Consultar las mínimas previstas' : 'Consultar la lluvia prevista'}</button>}
      </div>}
      {pie && <span className="mt-2 block text-xs text-slate-300">{pie}</span>}
    </figcaption>
    </figure>
  );
}
