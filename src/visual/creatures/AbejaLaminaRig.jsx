import { useId } from 'react';
import './creatures.css';
import './angelita-missminutes.css';
import { CreatureFilters } from './_filters.jsx';
import AbejaLamina from './AbejaLamina.jsx';
import { LAMINA_ANCLAS, ENCUADRE_ABEJA } from './abejaLaminaAnclas.js';
import { RH_INK } from './_rubberhose.jsx';
import { GafasSol, CejasRubber } from './AngelitaGafas.jsx';
import { ABEJA_PALETA } from './abejaIdentidad.js';
import { aplicarComportamientos, PERFIL_ABEJA, auraDeBicho } from './comportamientos/index.js';
import { AccesoriosClima } from './AccesoriosClima.jsx';
import { LineBoilFilter } from './LineBoilFilter.jsx';
import { PropEnMano } from './PropEnMano.jsx';
import { AuraPoder } from './AuraPoder.jsx';

// One state rig, rendered on the approved drawing. Accessory coordinates come from abejaLaminaAnclas.js.
const VIEWBOX = '-13.1 -13.1 26.2 26.2';


export function AbejaLaminaRig({
  size = 64,
  className = '',
  inline = false,
  animated = true,
  title = 'Abeja angelita',
  /* Pose de VIDA (idle-life): 'vuela' (default, aleteo normal) | 'celebra'
     (SALTO con anticipación + brazos en V que rebasan y asientan) | 'reposo'
     (alitas plegadas + respiración lenta) | 'señala' (se inclina hacia el POI
     y extiende el bracito apuntando, con overshoot). Los gestos viven en
     `creatures.css` (keyframes rh-celebra / rh-reposo / rh-senala) y solo se
     activan cuando la creature está viva (animated); con animated=false o
     reduced-motion la abeja queda en fotograma digno (bracitos colgando,
     sonriendo). Solo cambia CSS por data-pose: consumidores viejos no notan nada. */
  pose = 'vuela',
  // Motion vocabulary is independent from the existing state pose and drawing.
  movimiento = 'decir',
  /* Dibujo de la lámina (independiente de la pose de vida): 'decir' (default,
     erguida) | 'volar' (crucero horizontal, lámina F3) | 'esperar' (de pie,
     brazos colgando). En 'volar' no se montan la ruana ni el objeto en mano:
     sus anclas son del cuerpo erguido; en 'esperar' no hay objeto en mano. */
  dibujo = 'decir',
  'data-quieto': quieto = false,
  /* ── REACTIVIDAD AL ESTADO REAL DE LA FINCA (auditoría §5b) ────────────────
     El repertorio de reacción que la escena deriva de la finca (reaccionFinca).
     La creature lo interpreta con SU cuerpo (gotas, probóscide, brillo) — estética
     rubber-hose (Miss Minutes / Cuphead): squash-and-stretch, elástico, expresivo.
     Todo opcional: sin estos props la abeja se ve EXACTO como antes.
       animo    → piel/aura: 'pleno'|'sereno'|'atento'|'sediento'|'descansa'
       energia  → 0..1 viveza (aura y tamaño del brillo)
       mojada   → llueve: gotas que escurren + brillo húmedo
       sed      → Niño/sequía: saca la lengüita y jadea
       comiendo → hay cosecha: baja la probóscide y liba (mordisquea) */
  animo = 'sereno',
  energia = 1,
  mojada = false,
  sed = false,
  comiendo = false,
  /* ── EL CLIMA REAL escrito en el CUERPO (angelitaClimaCuerpo.js) ───────────
     clima/enso del estadoFinca REAL (useFincaViva): lluvia→brillo mojado y
     alas pesadas, Niño+día claro→tono deshidratado y alas lentas, niebla→
     silueta difusa, dorada→vibrante y alas rápidas. Sin clima (avatares,
     catálogo) = neutro digno: la abeja se ve EXACTO como siempre. */
  clima = null,
  enso = 'neutro',
  /* ── LIP-SYNC (sistema transversal, useLipSync) ────────────────────────────
     visema opcional ('V1'..'V4') que produce useLipSync desde el RMS del TTS:
     la boquita cambia de forma al hablar. Sin visema (o 'V1') = la sonrisa de
     siempre → los avatares/catálogo no cambian. El HOOK vive aparte para no
     colgar un AnalyserNode en cada instancia; acá solo se consume el estado. */
  visema = null,
  /* ── VESTUARIO por clima+hora (ropaDeClima) ───────────────────────────────
     OPT-IN: con vestuario=true la abeja se abriga según el clima real (ruana de
     noche/frío — mata el bug de sudar de noche —, sombrero+sudor al sol cálido).
     Default false → los consumidores de `clima` existentes NO ven accesorios
     nuevos (solo el tinte de piel de cuerpoDeClima). tempC afina frío/calor. */
  vestuario = false,
  tempC = undefined,
  /* Ruana puesta por el host aunque el clima no la pida (el gesto de reposo
     'ruana' de Angelita: se la echa encima y se la quita). Default false. */
  ruana = false,
  /* Device-tier (DR-3D-PERF-GAMABAJA): 'alto'|'medio' corren el rubber-hose
     pleno; 'bajo' apaga el idle continuo (boil + follow-through) y deja el
     aleteo + estados reactivos. Sin prop (standalone: avatares, catálogo) =
     pleno. El CSS gatea por [data-tier='bajo']; RM lo congela por encima. */
  tier = undefined,
  /* ── LÍNEA QUE RESPIRA (line-boil, Cuphead años 30 — LineBoilFilter) ────────
     OPT-IN: con lineBoil el CONTORNO de Angelita vibra escalonado (feTurbulence
     + feDisplacement, ~8fps) — el trazo "hierve" como dibujo animado clásico.
     Default false → los consumidores existentes NO cambian. Con animated=false
     o reduced-motion el filtro queda con seed fija (textura sin vibrar). Es la
     capa MÁS cara del kit: reservada para su entrada heroica (galería, hero). */
  lineBoil = false,
  /* ── PUFF DE POLEN (partículas) ────────────────────────────────────────────
     OPT-IN: motas de polen ámbar que flotan y se desvanecen alrededor del
     cuerpo — Angelita cargada de polen, la LOCA que va de flor en flor. CSS las
     anima (crt-polen-mota); reduced-motion las deja quietas. Default false. */
  polen = false,
  /* ── MODO PODER (transformación / power-up dorado — transformacion.css) ─────
     OPT-IN: con poder=true (y en modo standalone) la abeja se envuelve en su
     aura DORADA de 4 capas (glow, boost, ingravidez, corrientes ascendentes) —
     su firma cuando "sube de nivel". El host la enciende un rato con
     usePoderTemporal(). En modo inline el power-up lo pone el host DOM que
     envuelve la escena (::before/mix-blend no aplican a nodos SVG). */
  poder = false,
  /* ── PROP POR MUNDO (herramienta en la mano — propsPorMundo/PropEnMano) ─────
     mundoId opcional: al ENTRAR a un mundo Angelita carga su herramienta
     (agua→manguerita, suelo→lupa, animales→lazo, semillero→canasto…). Sin
     mundoId (o mundo sin prop) entra con las manos libres. Va en su manita
     izquierda (el lado libre; la carita vive a la derecha). */
  mundoId = null,
  /* ── GAFAS DE SOL (AngelitaGafas) ──────────────────────────────────────────
     OPT-IN: false (default, nada cambia) | true (puestas sobre los ojitos) |
     'poniendose' (reproduce UNA vez la caída teatral: baja girada, rebasa,
     rebota y asienta — su entrada de día soleado). La cadencia vive en
     angelita-missminutes.css gateada por data-gafas; RM = puestas quietas. */
  gafas = /** @type {boolean|'poniendose'} */ (false),
  /* ── CEJAS EXPRESIVAS (AngelitaGafas.CejasRubber) ──────────────────────────
     OPT-IN: null (default: la carita de siempre) | 'alegres' | 'altas' |
     'vivas' (con eyebrow-flash al hablar) | 'fruncidas' (concentrada). El
     agente las deriva por estado; cualquier host puede pedirlas directo. */
  cejas = null,
  cejasDeAgente = null,
  /* ── EXPRESIÓN DE LA CARA (opt-in) ─────────────────────────────────────────
     undefined (default): la cara aprobada de la pose. 'calma': párpados a
     media asta, mirada al frente y boca cerrada en sonrisa; la cara de quien
     acompaña sin que pase nada. La dibuja AbejaLamina (rig.expresion). */
  expresion = undefined,
  /* Brazos del cuerpo erguido (opt-in): undefined = los de la pose; 'reposo'
     = manos juntas sobre la barriga. En 'volar' no aplica. */
  brazos = undefined,
  gestoBrazoDerecho = undefined,
  gestoBrazoIzquierdo = undefined,
  /* Encuadre (opt-in en inline): true = la abeja llena su cuadro y queda
     centrada (ENCUADRE_ABEJA). Standalone lo trae puesto; un host inline que
     ya posa a Angelita en sus coordenadas lo deja apagado. */
  encuadre = !inline,
  ...rest
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const comportamiento = aplicarComportamientos('abeja-angelita', {
    idle: { animated: animated && !quieto, activo: animated && !quieto, tier },
    clima: { estado: clima, enso, tier, perfil: PERFIL_ABEJA, vestuario, tempC },
    lipsync: { visema },
    gestos: {
      pose, animo, energia, mojada, sed, comiendo, polen, gafas, cejas,
      mundoId, poder, lineBoil,
    },
  });
  const vivo = comportamiento.rubberhose.animado;
  const poseAplicada = comportamiento.gestos.pose.pose;
  const animoAplicado = comportamiento.gestos.animo;
  const energiaAplicada = comportamiento.gestos.energia;
  const mojadaAplicada = comportamiento.gestos.mojada;
  const sedAplicada = comportamiento.gestos.sed;
  const comiendoAplicada = comportamiento.gestos.comiendo;
  const polenAplicado = comportamiento.gestos.polen;
  const solEnClima = clima === 'soleado' || clima === 'dorada';
  const frioEnClima = ['frio', 'frío', 'noche', 'lluvia', 'niebla', 'paramo', 'páramo', 'superparamo', 'nival'].includes(clima)
    || (Number.isFinite(tempC) && tempC <= 12);
  const permiteGafas = solEnClima;
  const permiteRuana = !solEnClima && frioEnClima;
  const gafasAplicadas = permiteGafas ? comportamiento.gestos.gafas : false;
  const cejasAplicadas = comportamiento.gestos.cejas;
  const mundoIdAplicado = comportamiento.gestos.mundoId;
  const poderAplicado = comportamiento.gestos.poder;
  const lineBoilAplicado = comportamiento.gestos.lineBoil;
  const visemaAplicada = comportamiento.lipsync.visema;
  const cuerpoClima = comportamiento.clima;
  const ropaResuelta = comportamiento.clima.ropa;
  const ropa = ropaResuelta
    ? { ...ropaResuelta, ruana: permiteRuana && (ruana || ropaResuelta.ruana) }
    : (ruana && permiteRuana ? { ruana: true, sombrero: false, sudor: false, mojado: false, niebla: false } : null);
  const glow = `crt-glow-${uid}`;
  const blur = `crt-blur-${uid}`;
  const boil = `crt-boil-${uid}`;
  const wing = vivo ? 'crt-wing' : undefined;
  // El aura respira con la energía real de la finca (matas vivas + agua).
  // Ceñida (2026-08-23): antes 0.2+0.3·e con r 5.4+1.2·e y, encima del glow
  // global del cuerpo, la niebla ámbar era lo PRIMERO que se leía a tamaño
  // chico. Un anillo de calor discreto conserva la conducta (respira con la
  // energía) sin ahogar la silueta de tinta.
  const auraOp = Math.max(0.12, Math.min(0.32, 0.14 + 0.18 * energiaAplicada));
  const auraR = 5.0 + 0.9 * energiaAplicada;

  // ── EL CLIMA REAL en el cuerpo (creatureClimaCuerpo, perfil abeja). Determinista,
  //    una vez por render: tinte + opacidad al contorno; el aleteo se acelera
  //    (dorada) o pesa (lluvia) escalando la duración base de `.crt-wing` (0.15s).
  //    Sin clima → neutro: filtro/opacidad nulos, aleteo base. RM: como `wing` va
  //    solo con `animated`, la duración cuelga de nodos ya quietos (inocua).
  // Solo estampamos duración inline cuando el clima REALMENTE cambia el aleteo
  // (≠1): así un clima neutro NO pisa los overrides de pose ('celebra'/'reposo').
  const wingDur = (wing && cuerpoClima.velocidadAlas !== 1)
    ? { animationDuration: `${(0.15 / cuerpoClima.velocidadAlas).toFixed(3)}s` }
    : undefined;
  // Alitas de TUL que se DIFUMINAN al ACELERAR (motion-blur real): cuando el
  // clima acelera el aleteo (dorada/soleado, velocidadAlas alta) el tul se ve
  // borroso — la firma de las alas rápidas del meliponino. Determinista: cuelga
  // del clima, no del reloj. Tier bajo o sin aleteo → nítido (blur es raster
  // caro). RM: las alas ya están quietas, el blur queda estático (inocuo).
  const alasRapidas = wing && tier !== 'bajo' && cuerpoClima.velocidadAlas >= 1.12;
  const alaBlur = alasRapidas
    ? { filter: `blur(${(0.35 * cuerpoClima.velocidadAlas).toFixed(2)}px)` }
    : undefined;
  const alaStyle = (wingDur || alaBlur) ? { ...wingDur, ...alaBlur } : undefined;
  // Filtro/opacidad de clima para el nodo raíz (svg autónomo o <g> inline).
  const estiloClima = (cuerpoClima.tinte || cuerpoClima.opacidad < 1)
    ? { filter: cuerpoClima.tinte || undefined, opacity: cuerpoClima.opacidad < 1 ? cuerpoClima.opacidad : undefined }
    : undefined;

  // Vestuario por clima+hora (opt-in). Perfil abeja: neutro, suda al sol de día,
  // ruana de noche. Sin vestuario o sin clima → nada (comportamiento histórico).
  const defs = (
    <defs>
      <CreatureFilters glow={glow} blur={blur} />
      {/* Line-boil (contorno que hierve) — solo se instancia si se pide. */}
      {lineBoilAplicado && <LineBoilFilter id={boil} animated={vivo} />}
    </defs>
  );
  // Probóscide (lengüita): sale con SED (jadeo) o al COMER (libar). Cuelga de la
  // boca de la lámina. CSS la anima según data-sed/data-comiendo; RM la deja quieta.
  // El <g> EXTERNO posiciona (attr transform); el INTERNO (.crt-lengua) anima —
  // si el CSS animara el mismo nodo del translate, lo pisaría (CSS transform
  // gana sobre el atributo) y la lengüita saltaría al centro del cuerpo.
  const lengua = (sedAplicada || comiendoAplicada) ? (
    <g transform="translate(.7 -1.2) scale(.55)">
      <g className="crt-lengua">
        <path d="M0,0 C-0.4,2.6 0.4,4.4 0,6.2" stroke={ABEJA_PALETA.lengua} strokeWidth="1.1"
          fill="none" strokeLinecap="round" />
        <circle cx="0" cy="6.4" r="1.05" fill={ABEJA_PALETA.lengua} />
      </g>
    </g>
  ) : null;
  // Gotas de lluvia que escurren del cuerpo/alas cuando está MOJADA. Rubber-hose:
  // caen con un rebotico. CSS (crt-gota) las anima; RM las deja colgando.
  const gotas = mojadaAplicada ? (
    <g className="crt-gotas" fill={ABEJA_PALETA.gota} opacity="0.9">
      <g transform="translate(-3 3)"><path className="crt-gota" d="M0,0 q-.6,1 0,1.8 q.6,-.8 0,-1.8 Z" /></g>
      <path className="crt-gota" style={{ animationDelay: '-0.5s' }} d="M.5,5 q-.5,1 0,1.7 q.5,-.7 0,-1.7 Z" />
      <path className="crt-gota" style={{ animationDelay: '-1.1s' }} d="M3,1 q-.5,.9 0,1.5 q.5,-.7 0,-1.5 Z" />
    </g>
  ) : null;
  // Puff de POLEN: motas ámbar que flotan y se disuelven alrededor del cuerpo —
  // Angelita cargada de polen (la LOCA de flor en flor). CSS (crt-polen-mota) las
  // sube con deriva; con animated=false / RM quedan colgando dignas. Opt-in.
  const polenEl = polenAplicado ? (
    <g className="crt-polen" fill={ABEJA_PALETA.cuerpo} aria-hidden="true">
      <circle className={vivo ? 'crt-polen-mota' : undefined} cx="-9" cy="5.5" r="0.85" />
      <circle className={vivo ? 'crt-polen-mota' : undefined} style={{ animationDelay: '-0.8s' }} cx="6.5" cy="7.2" r="0.6" />
      <circle className={vivo ? 'crt-polen-mota' : undefined} style={{ animationDelay: '-1.5s' }} cx="-2.5" cy="8.4" r="0.72" />
      <circle className={vivo ? 'crt-polen-mota' : undefined} style={{ animationDelay: '-2.1s' }} cx="9.5" cy="4.2" r="0.52" />
      <circle className={vivo ? 'crt-polen-mota' : undefined} style={{ animationDelay: '-2.9s' }} cx="1.5" cy="9" r="0.6" />
    </g>
  ) : null;
  // Tool and hand share the animated shoulder group in the approved drawing.
  const propMundo = mundoIdAplicado ? (
    <PropEnMano mundoId={mundoIdAplicado} x={-7.2} y={.38} escala={0.45} ink={RH_INK} animated={vivo} />
  ) : null;

  const lamina = (
      <AbejaLamina inline title="" animated={vivo} tier={tier} pose={dibujo} movimiento={dibujo === 'volar' ? 'volar' : movimiento} visema={visemaAplicada}
        rig={{
          alasClase: wing,
          expresion,
          brazos: pose === 'celebra' ? 'celebra' : brazos,
          gestoBrazoDerecho: pose === 'celebra' ? undefined : gestoBrazoDerecho,
          gestoBrazoIzquierdo: pose === 'celebra' ? undefined : gestoBrazoIzquierdo,
          alasStyle: alaStyle,
          cejas: cejasDeAgente || (cejasAplicadas ? <CejasRubber estilo={cejasAplicadas} lamina /> : undefined),
          cara: <>{lengua}{gafasAplicadas && <GafasSol lamina puesta={gafasAplicadas === 'poniendose' ? 'poniendose' : 'puesta'} animated={vivo} />}</>,
          ropaTorax: ropa?.ruana && dibujo !== 'volar' ? <AccesoriosClima estado={{ ruana: true }} tronco={LAMINA_ANCLAS.tronco} cabeza={LAMINA_ANCLAS.cabeza} animated={vivo} /> : null,
          ropaCabeza: (ropa?.sombrero || ropa?.sudor) ? <AccesoriosClima estado={{ sombrero: ropa.sombrero, sudor: ropa.sudor }} tronco={LAMINA_ANCLAS.tronco} cabeza={LAMINA_ANCLAS.cabeza} animated={vivo} /> : null,
          // The prop is held by the open decir hand; in esperar the hands hang empty.
          manoIzquierda: dibujo === 'volar' || dibujo === 'esperar' ? null : propMundo,
        }} />
  );
  // Keep the state rig; the anatomy and accessory slots belong to AbejaLamina.
  const body = (
    <g className={`crt-body${vivo ? ' rh-boil' : ''}`}>
      {/* aura viva */}
      <circle r={auraR} fill={ABEJA_PALETA.cuerpo} opacity={auraOp} filter={`url(#${blur})`} />

      {encuadre ? <g data-encuadre={dibujo} transform={ENCUADRE_ABEJA[dibujo] ?? ENCUADRE_ABEJA.decir}>{lamina}</g> : lamina}
      {gotas}
      {polenEl}
    </g>
  );
  // Las capas de antics envuelven al cuerpo SOLO cuando está vivo (animated):
  // nodos aparte para que sus transforms no pisen el boil de `.crt-body`.
  const conAntics = vivo ? (
    <g className="rh-antic">
      <g className="rh-travieso">{body}</g>
    </g>
  ) : body;
  // El line-boil (contorno que hierve) envuelve TODO el dibujo cuando se pide:
  // el feDisplacementMap desplaza el trazo entero (Cuphead). Grupo aparte para
  // no colisionar con el glow del `.crt-body` (dos filtros, nodos distintos).
  const cuerpoVivo = lineBoilAplicado ? <g filter={`url(#${boil})`}>{conAntics}</g> : conAntics;

  // data-estado agrupa la reacción para el CSS (brillo mojado, jadeo, mordisco).
  // data-pose SOLO cuando está viva: así los gestos (celebra/reposo/señala) no
  // corren con animated=false — la abeja queda en fotograma digno (bracitos
  // colgando, sonriendo). RM lo apaga además por dentro del CSS.
  const estadoAttrs = {
    'data-creature': 'abeja-angelita',
    'data-quieto': !vivo || undefined,
    'data-pose': vivo ? poseAplicada : undefined,
    'data-animo': animoAplicado,
    'data-tier': tier || undefined,
    'data-mojada': mojadaAplicada ? '1' : undefined,
    'data-sed': sedAplicada ? '1' : undefined,
    'data-comiendo': comiendoAplicada ? '1' : undefined,
    'data-visema': visemaAplicada || undefined,
    'data-ruana': ropa?.ruana ? '1' : undefined,
    'data-sombrero': ropa?.sombrero ? '1' : undefined,
    'data-sudor': ropa?.sudor ? '1' : undefined,
    'data-lineboil': lineBoilAplicado ? '1' : undefined,
    'data-polen': polenAplicado ? '1' : undefined,
    'data-prop': mundoIdAplicado || undefined,
    'data-gafas': gafasAplicadas ? (gafasAplicadas === 'poniendose' && vivo ? 'poniendose' : '1') : undefined,
    'data-cejas': cejasAplicadas || undefined,
  };

  if (inline) {
    // En modo inline el power-up lo pone el host DOM (::before/mix-blend no
    // aplican a SVG); acá solo marcamos data-poder por si el host lo consulta.
    return (
      <g className={className} style={estiloClima} data-poder={poderAplicado ? '1' : undefined} {...estadoAttrs}>
        {defs}
        {cuerpoVivo}
      </g>
    );
  }
  const svg = (
    <svg viewBox={VIEWBOX} width={size} height={size} className={className} style={encuadre ? { overflow: 'visible', ...estiloClima } : estiloClima}
      role="img" aria-label={title} {...estadoAttrs} {...rest}>
      <title>{title}</title>
      {defs}
      {cuerpoVivo}
    </svg>
  );
  // MODO PODER (standalone): la envolvemos en su aura DORADA de 4 capas
  // (transformacion.css: glow radial + boost + ingravidez + corrientes). El
  // wrapper DOM es lo único que puede llevar ::before/mix-blend/corrientes.
  if (poderAplicado) {
    return (
      <span
        className="is-powered-up abeja-poder"
        data-creature-poder="abeja-angelita"
        style={{ '--aura-color': auraDeBicho('abeja-angelita'), display: 'inline-flex' }}
      >
        {svg}
        <AuraPoder />
      </span>
    );
  }
  return svg;
}

export default AbejaLaminaRig;
