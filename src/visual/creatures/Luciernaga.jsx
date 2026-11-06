import { useId, useRef } from 'react';
import './creatures.css';
import { useVidaIdle, useRitmoPropio, useMiradaUsted } from './useVidaIdle.js';
import { CreatureFilters } from './_filters.jsx';
import { LuciernagaCuerpo } from './LuciernagaCuerpo.jsx';
import {
  LUCIERNAGA_SLUG, PERFIL_LUCIERNAGA,
  resolverEstadoLuciernaga,
} from './luciernagaIdentidad.js';
import { cuerpoDeClima } from './creatureClimaCuerpo.js';
import { LineBoilFilter } from './LineBoilFilter.jsx';
import { AuraPoder } from './AuraPoder.jsx';
import { auraDeBicho } from './transformacion.js';
import { CompaiAgente } from '../agente/CompaiAgente.jsx';
import { COMPAI_ESPECIES } from '../agente/compaiEspecies.js';

// El rig conserva conducta, clima y lip-sync; el cuerpo vive en LuciernagaCuerpo.
// El dibujo mide 320 × 424 y su centro real está en y=18. El cuadro cuadrado
// deja 8 unidades de margen vertical después de recentrar el cuerpo.
const VIEWBOX = '-220 -220 440 440';
const CUERPO_CENTRO_Y = 18;
const LUCIERNAGA_PERFIL = COMPAI_ESPECIES.luciernaga;

function LuciernagaRig({
  size = 64,
  className = '',
  inline = false,
  animated = true,
  reducedMotion = false,
  estado = 'acompana',
  title = 'Luciérnaga (cocuyo)',
  /* Pose de VIDA (idle-life), species-agnostic (gestos rh-g-* de creatures.css):
     'vuela' (base, flota) | 'celebra' | 'reposo' | 'señala'. */
  pose = 'vuela',
  animo = 'sereno',
  energia = 1,
  /* CLIMA REAL escrito en el cuerpo (perfil luciérnaga: la niebla se la traga,
     la seca la amenaza). Sin clima (avatares, catálogo) = neutro digno. */
  clima = null,
  enso = 'neutro',
  /* ── LIP-SYNC (sistema transversal, useLipSync) ────────────────────────────
     visema opcional ('V1'..'V4'): la boca amable se abre cuando el agente narra.
     Sin visema (o 'V1') = la sonrisa de goma de siempre. */
  visema = null,
  /* ── ECO — LA LINTERNA COMO BIOINDICADOR (su firma científica) ──────────────
     null|'normal' (reposo, late suave) | 'sano' (fuerte y grande) | 'leer'
     (atenta, lee la noche) | 'degradado' (titila débil: el aviso del cambio
     climático) | 'pacto' (fuerte y serena). Ver LUCIERNAGA_ESTADOS_ECO. */
  eco = null,
  /* Device-tier (DR-3D-PERF-GAMABAJA): 'alto'|'medio' corren el rubber-hose
     pleno; 'bajo' apaga el idle continuo (boil + aleteo + antenas) y deja la
     linterna latiendo (su señal no se apaga: es su alma). */
  tier,
  /* ── LÍNEA QUE RESPIRA (line-boil, Cuphead años 30) — OPT-IN. ───────────────*/
  lineBoil = false,
  /* ── MODO PODER (transformación / power-up VERDE-LINTERNA) — OPT-IN. ────────*/
  poder = false,
  /* ── VIDA PROPIA (idle-cerebro v2 — la vara de Angelita). Default ON. ───────*/
  vida = true,
  ...rest
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const glow = `crt-glow-${uid}`;
  const blur = `crt-blur-${uid}`;
  const boil = `crt-boil-${uid}`;
  const vivo = animated && !reducedMotion;

  // ═══ VIDA PROPIA (idle-cerebro + ritmo propio + mirada — vara Angelita v2).
  const raizRef = useRef(null);
  const ritmoPropio = useRitmoPropio();
  const enBase = pose === 'vuela' && !visema;
  const momento = useVidaIdle('luciernaga', vida && vivo && tier !== 'bajo' && enBase);
  useMiradaUsted(raizRef, vida && vivo && tier !== 'bajo');
  const destellaFx = momento === 'destella';
  const leeFx = eco === 'leer' || momento === 'lee';
  const poseFx = momento === 'reposo' ? 'reposo' : pose;
  // La lectura de eco: 'leer' del momento idle se traduce a data-eco='leer'.
  const ecoFx = eco || (momento === 'lee' ? 'leer' : null);

  // CLIMA → cuerpo (determinista): tinte + opacidad al contorno.
  const cuerpoClima = cuerpoDeClima(clima, { enso: /** @type {any} */ (enso), tier, perfil: PERFIL_LUCIERNAGA });
  const climaEstado = typeof clima === 'string' ? clima : clima?.estado || clima?.tipo;
  const estiloClima = (cuerpoClima.tinte || cuerpoClima.opacidad < 1)
    ? { filter: cuerpoClima.tinte || undefined, opacity: cuerpoClima.opacidad < 1 ? cuerpoClima.opacidad : undefined }
    : undefined;

  const defs = (
    <defs>
      <CreatureFilters glow={glow} blur={blur} />
      {lineBoil && <LineBoilFilter id={boil} animated={vivo} />}
    </defs>
  );
  const body = (
    <LuciernagaCuerpo
      uid={uid}
      vivo={vivo}
      visema={visema}
      energia={energia}
      estado={estado}
      eco={ecoFx}
    />
  );

  // Antics de VIDA (períodos co-primos) SOLO viva; nodos aparte para no pisar el
  // boil de `.crt-body`. Envueltos en el bob de flota (luci-flota).
  const conAntics = vivo ? (
    <g className="rh-antic">
      <g className="rh-travieso">
        <g className="luci-flota" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>{body}</g>
      </g>
    </g>
  ) : body;
  const cuerpoVivo = lineBoil ? <g filter={`url(#${boil})`}>{conAntics}</g> : conAntics;

  const estadoAttrs = {
    'data-creature': LUCIERNAGA_SLUG,
    'data-agt-estado': estado,
    'data-pose': vivo ? poseFx : undefined,
    'data-animo': animo,
    'data-tier': tier || undefined,
    'data-clima': climaEstado || undefined,
    'data-visema': visema || undefined,
    'data-eco': ecoFx || undefined,
    'data-destella': destellaFx ? '1' : undefined,
    'data-lee': leeFx ? '1' : undefined,
    'data-vida': momento || undefined,
    'data-lineboil': lineBoil ? '1' : undefined,
  };

  // El ritmo propio (parpadeo/dardeo por instancia) viaja como vars CSS.
  const estiloRaiz = { ...ritmoPropio, ...estiloClima };

  if (inline) {
    return (
      <g ref={raizRef} className={className} style={estiloRaiz} data-poder={poder ? '1' : undefined} {...estadoAttrs}>
        {defs}
        {cuerpoVivo}
      </g>
    );
  }
  const svg = (
    <svg ref={raizRef} viewBox={VIEWBOX} width={size} height={size} className={className} style={estiloRaiz}
      role="img" aria-label={title} {...estadoAttrs} {...rest}>
      <title>{title}</title>
      {defs}
      <g transform={`translate(0 ${-CUERPO_CENTRO_Y})`}>{cuerpoVivo}</g>
    </svg>
  );
  // MODO PODER (standalone): aura VERDE-LINTERNA de 4 capas.
  if (poder) {
    return (
      <span
        className="is-powered-up luciernaga-poder"
        data-creature-poder={LUCIERNAGA_SLUG}
        style={{ '--aura-color': auraDeBicho(LUCIERNAGA_SLUG), display: 'inline-flex' }}
      >
        {svg}
        <AuraPoder />
      </span>
    );
  }
  return svg;
}

const POSE_RIG_DE_ESTADO = LUCIERNAGA_PERFIL.posePorEstado;

function AdaptadorLuciernaga({
  especie: _especie,
  creatureSlug: _creatureSlug,
  capacidades: _capacidades,
  perfil: _perfil,
  idlePerfil: _idlePerfil,
  climaPerfil: _climaPerfil,
  pose: posePerfil,
  estadoLegado = undefined,
  reducedMotion,
  'data-agt-especie': dataEspecie,
  'data-creature': dataCreature,
  'data-agt-estado': dataEstado,
  'data-pose': dataPose,
  'data-visema': dataVisema,
  'data-clima': dataClima,
  'data-tier': dataTier,
  ...props
}) {
  const estadoActual = estadoLegado || dataEstado || 'acompana';
  const pose = POSE_RIG_DE_ESTADO[estadoActual] || posePerfil || 'vuela';
  return (
    <LuciernagaRig
      {...props}
      estado={estadoActual}
      pose={pose}
      reducedMotion={reducedMotion}
      tier={dataTier}
      data-agt-especie={dataEspecie}
      data-creature={dataCreature}
      data-agt-estado={estadoActual}
      data-pose={dataPose || pose}
      data-visema={dataVisema}
      data-clima={dataClima}
      data-tier={dataTier}
    />
  );
}

/** Fachada compatible de la luciérnaga sobre el contrato común Compai. */
export function Luciernaga({ estado = 'acompana', ...props }) {
  const estadoResuelto = resolverEstadoLuciernaga(estado, props.eco);
  return (
    <CompaiAgente
      {...props}
      estado={estadoResuelto.estado}
      eco={estadoResuelto.eco}
      estadoLegado={estadoResuelto.estado}
      especie={LUCIERNAGA_PERFIL.avatarType}
      chrome={false}
      preserveRigAnimation
      adaptador={AdaptadorLuciernaga}
    />
  );
}

export { LuciernagaRig };
export default Luciernaga;
