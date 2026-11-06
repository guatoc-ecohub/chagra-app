import { useCallback, useEffect, useRef, useState } from 'react';
import './angelita-agente.css';
import { CompaiAgente } from './CompaiAgente.jsx';
import { LAMINA_ANCLAS } from '../creatures/abejaLaminaAnclas.js';
import { AbejaLaminaRig } from '../creatures/AbejaLaminaRig.jsx';
import { RH_INK, RH_CHEEK } from '../creatures/_rubberhose.jsx';
import { ABEJA_PALETA } from '../creatures/abejaIdentidad.js';
import {
  estadoCanonico,
  POSES_DE_ANGELITA,
  ARIA_DE_ESTADO,
  CEJAS_DE_ESTADO,
  nivelDeConfianza,
  duracionDeMomento,
  contextoDeReposo,
  intervaloExcursionPorHora,
  excursionDeHorario,
} from './angelitaEstados.js';
import { esDeNoche } from '../../compai/nucleo/susurroNocturno.js';
import {
  dibujoDeAngelita,
  brazosDeAngelita,
  expresionDeAngelita,
} from './angelitaDibujo.js';
import useInteraccionUsuario from '../../hooks/useInteraccionUsuario.js';
import { arcosDeReconocimiento, derivarConductaClimatica, puedeReconocerPantalla } from './angelitaClima.js';
import { debeSaludar, esPrimeraCosecha, fincaSana, puedeOfrecerMiel } from './angelitaRutina.js';
import useCosechaStore from '../../store/useCosechaStore.js';
import { useEstadoFincaReal } from '../../hooks/useEstadoFincaReal.js';
import useAssetStore from '../../store/useAssetStore.js';
import { useInventarioCompai } from '../../hooks/useInventarioCompai.js';
import { debeContarMatas } from './angelitaFinca.js';

const reconocimientosPorPantalla = new Map();

/*
 * ANGELITA — EL CUERPO DEL AGENTE DE CHAGRA.
 *
 * La inteligencia que le responde al campesino deja de ser texto: es Angelita,
 * la abeja angelita (Tetragonisca angustula, meliponino nativo SIN aguijón) —
 * noble, sabia, cercana, campesina. NO mascota corporativa: una vecina que
 * sabe de la finca, que se posa a escuchar, que piensa buscando en su memoria,
 * que gesticula al responder y que DICE cuando no sabe (Chagra valora la
 * honestidad sobre la alucinación).
 *
 * Este componente es SOLO el cuerpo con su API de estados — cero lógica de
 * agente. El host (chat, voz, tutorial) le dice qué está pasando y ella lo
 * ENCARNA:
 *
 *   <Angelita estado="pensando" />
 *   <Angelita estado="respondiendo" visema={visema} confianza={0.9} />
 *   <Angelita estado="no-se" confianza="baja" />
 *
 * ESTADOS (angelitaEstados.js — acepta sinónimos):
 *   acompana     → idle VIVO: flota, respira (boil), mira alrededor, antics.
 *                  Es la AbejaLaminaRig de siempre: viva aunque nadie hable.
 *   escuchando   → se posa (reposo), ladea la cabeza hacia usted; la voz
 *                  humana entra en ondas de tinta.
 *   pensando     → burbuja de pensamiento con recuerdos de la finca (hoja,
 *                  gota, flor) que hojea; bracito a la barbilla; mirada arriba.
 *   respondiendo → habla (lip-sync por `visema` de useLipSync) y gesticula;
 *                  su voz sale en ondas de MIEL (ámbar).
 *   contenta     → brinca celebrando (pose celebra) con chispas doradas.
 *   preocupada   → alerta honesta: cejas fruncidas, gota de sudor, aro coral
 *                  que late, vibración inquieta. Para plaga/sequía/riesgo.
 *   no-se        → LA HONESTA: NIEGA CON LA CABEZA mientras se encoge de
 *                  hombros con las palmas arriba y un "?" dibujado a mano.
 *                  Sonríe: no saber no la avergüenza. El texto que la
 *                  acompaña debe decir "No sé" claro, sin rodeos
 *                  (angelitaEstados.TEXTO_NO_SE).
 *   senala       → guía: se inclina y apunta (pose señala) con destello en
 *                  el punto señalado.
 *   invita       → guía: se inclina hacia usted y hace "venga" con la manita.
 *
 * CONFIANZA (modo científico): `confianza` acepta 0..1 o 'alta'|'media'|'baja'.
 * Se dibuja como ANILLO DE CERTEZA alrededor del cuerpo: continuo y sereno si
 * está segura; punteado girando si es parcial; entrecortado, titilante y con
 * puntos suspensivos si duda. null (default) = sin anillo — nada cambia para
 * quien no maneja confianza.
 *
 * REUTILIZA, NO REDIBUJA: el cuerpo es la AbejaLaminaRig aprobada (inline) con
 * su identidad (abejaIdentidad.js), su kit rubber-hose y sus poses; las capas
 * del agente (halo, burbuja, ondas, cejas, chispas, signos) se dibujan ALREDEDOR
 * en el mismo lenguaje: tinta cálida RH_INK, squash & stretch, overshoot,
 * follow-through. La cadencia vive en `angelita-agente.css` (clases agt-*) con
 * los gates de la casa: reduced-motion congela en fotograma digno; tier 'bajo'
 * corta lo continuo decorativo y conserva el feedback de estado.
 *
 * ═══ V2 — LA VIDA (lo que separa una vecina de un logo) ═════════════════════
 *
 * 1. IDLE-CEREBRO (solo en acompana): un reloj con jitter hojea el repertorio
 *    de MOMENTOS_IDLE — mira alrededor, sigue una mota de vilano que pasa, se
 *    acicala la antena, se rasca, sacude las alas, y de vez en cuando SE POSA
 *    (aterriza con peso, respira plegadita, despega con impulso). Nunca repite
 *    el mismo gesto dos veces; entre gesto y gesto vuelve al vuelo sereno.
 *    Los micro-gestos son la vida: existe aunque nadie le hable.
 *
 * 2. FÍSICA DE VUELO: el wrapper `.agt-vuelo` deriva en figura-8 con banqueo
 *    (la abeja se ladea hacia donde va y el cuerpo la sigue con retraso —
 *    inercia, no flotador); el aterrizaje ANTICIPA, cae con peso y amortigua
 *    con squash; el despegue se agacha para coger impulso. Las alas llevan un
 *    velo de motion-blur (solo tier alto/medio).
 *
 * 3. LA MIRADA: las pupilas SIGUEN el puntero/dedo de usted cuando anda cerca
 *    (data-agt-mira='usted', vars --agt-mx/--agt-my puestas por rAF) y lo
 *    sueltan a los ~2s para volver a sus dardeos naturales. El parpadeo lleva
 *    ritmo PROPIO por instancia (duración y fase con azar al montar: dos
 *    Angelitas jamás parpadean al tiempo — el metrónomo delataba al robot).
 *    Además cada estado ACTÚA con los ojos: contacto visual franco en no-sé,
 *    ojos clavados en el POI (con chequeo a usted) en senala, buscar la
 *    palabra arriba al responder, achinaditos de dicha en contenta.
 *
 * 4. TRANSICIONES: al cambiar de estado el wrapper se remonta (key=estado) y
 *    reproduce UNA anticipación (se recoge con squash, rebasa, asienta) antes
 *    del loop del estado — los cambios fluyen, no saltan. La burbuja del
 *    pensar nace elástica desde su colita y el "?" del no-sé se dibuja a mano.
 *
 * Todos los sistemas nuevos respetan los gates: animated=false los apaga,
 * prefers-reduced-motion los apaga (JS incluido), tier 'bajo' apaga scheduler,
 * seguimiento de mirada, deriva y blur — el feedback de estado permanece.
 *
 * ═══ V3 — LA CARA VIVA (C14+C15: la cara ES el personaje) ═══════════════════
 *
 * La expresividad Miss-Minutes de la carita, SIN tocar el dibujo base: todo va
 * por CSS sobre las clases internas de los ojos (.rh-blink / .rh-mirada), que
 * viven DENTRO del cuerpo de la abeja — así la cara sigue cada squash, antic y
 * pose sin desprenderse jamás. Scoped a [data-agente='angelita']: la abeja del
 * valle y los demás bichos del kit no cambian.
 *
 * 1. OJOS ÁMBAR VIVOS (todos los estados): iris ámbar (anillo del mismo dorado
 *    del cuerpo alrededor de la pupila de tinta), ojos un pelo más grandes y
 *    la chispa del ojo (catchlight) que TITILA de vez en cuando — período
 *    co-primo con parpadeo y dardeo, nunca el mismo compás.
 * 2. PÁRPADOS POR ESTADO: pensando entrecierra (media asta, repasa memoria);
 *    escuchando parpadea MENOS (quien escucha de verdad casi no pestañea);
 *    preocupada abre los ojos y ENCOGE la pupila (la alarma se ve en el ojo
 *    antes que en el gesto) con blink doble nervioso; contenta ya achinaba.
 * 3. LA CEJITA DEL PENSAR: ceja asimétrica (una arqueada alto, la otra baja)
 *    dibujada aquí como las de preocupada/no-sé, con un tironcito sincronizado
 *    a los golpecitos de barbilla ("¿será?…"). Pensando apaga el boil interno
 *    (mismo criterio que preocupada/no-sé: nada se despega de la cara).
 * 4. LA VOZ ACOPLADA A LA BOCA: el root estampa data-agt-visema (el mismo
 *    'V1'..'V4' que ya mueve la boquita vía BocaVisema del kit); cuando el
 *    host manda visemas, las ondas de miel fluyen SOLO mientras la boca se
 *    mueve (V1 = silencio = ondas en calma). Host sin TTS: nada cambia.
 *    Y mientras conversa, las chapetas quedan encendidas — calor de vecina.
 *
 * Tier-safe: SVG + CSS transform/opacity, cero deps nuevas, cero three.
 */

/* El escenario del agente es el cuadro de la abeja: el cuerpo encuadrado
   (ENCUADRE_ABEJA) llena el cuadro y lo que flota (burbuja, ondas, signos)
   vive en sus esquinas. El svg deja ver lo que rebasa (brincos, aire). */
const VIEWBOX = '-13.1 -13.1 26.2 26.2';
/* Las capas de aire se dibujaron para el cuadro anterior (46 de lado, la abeja
   sin encuadre). Cada una se reubica con un transform propio hacia su esquina
   y conserva su tamaño en pantalla (escala ≈ 26.2/46). */
const AIRE = Object.freeze({
  burbuja: 'translate(5.97 1.85) scale(.55) translate(-8 0)',
  ondasIn: 'translate(-.52 -4.85) scale(.57)',
  ondasOut: 'translate(1.75 -4.72) scale(.57) translate(-8 -3)',
  signoNoSe: 'translate(4.28 3) scale(.72) translate(-8 0)',
  poi: 'translate(15.2 5.8) scale(.7)',
  invita: 'translate(1.08 -1.28) scale(.6)',
  olor: 'translate(.88 -2.56) scale(.6) translate(-8 -3)',
  mota: 'translate(0 -4.5) scale(.57)',
  zetitas: 'translate(1.74 -4.08) scale(.6)',
  duda: 'translate(1.2 -4.6) scale(.6)',
});

/* La voz de cada quien tiene su color: la de USTED llega en tinta (línea), la
   de ANGELITA sale en miel (ámbar). Detalle que se lee sin explicarse. */
const COLOR_VOZ_HUMANA = RH_INK;
const COLOR_VOZ_MIEL = ABEJA_PALETA.cuerpo;
const COLOR_CERTEZA = ABEJA_PALETA.cabeza;   // el dorado claro de su cabeza
const COLOR_ALERTA = '#e0745a';              // coral de alerta (pariente del RH_CHEEK)
const CREMA_PAPEL = '#fffaf0';               // el papel de la burbuja (blanco de ojo)

/* Gotita (sudor de preocupación / recuerdo de agua) — lágrima rubber-hose. */
const GOTA_D = 'M0,-1.1 C0.75,-0.15 0.75,0.55 0,1.05 C-0.75,0.55 -0.75,-0.15 0,-1.1 Z';
/* Chispa de 4 puntas (polen dorado que estalla cuando celebra / destello POI). */
const CHISPA_D = 'M0,-2 L0.55,-0.55 L2,0 L0.55,0.55 L0,2 L-0.55,0.55 L-2,0 L-0.55,-0.55 Z';

/* ── Recuerdos de la finca (lo que hojea al PENSAR): hoja, agua, flor ────────
   Mini-íconos en el mismo trazo de la familia; viven dentro de la burbuja. */
function RecuerdoHoja() {
  return (
    <g transform="rotate(-26)">
      <ellipse rx="1.7" ry="0.95" fill="#6a994e" stroke={RH_INK} strokeWidth="0.4" />
      <path d="M-1.4,0 L1.4,0" stroke="#3f5d33" strokeWidth="0.35" strokeLinecap="round" />
    </g>
  );
}
function RecuerdoGota() {
  return <path d={GOTA_D} transform="scale(1.35)" fill={ABEJA_PALETA.gota} stroke={RH_INK} strokeWidth="0.32" />;
}
function RecuerdoFlor() {
  const petalos = [[0, -0.95], [0.9, -0.29], [0.56, 0.77], [-0.56, 0.77], [-0.9, -0.29]];
  return (
    <g>
      {petalos.map(([x, y], i) => (
        <circle key={i} cx={x * 1.15} cy={y * 1.15} r="0.68" fill={RH_CHEEK} stroke={RH_INK} strokeWidth="0.3" />
      ))}
      <circle r="0.62" fill={COLOR_CERTEZA} stroke={RH_INK} strokeWidth="0.3" />
    </g>
  );
}
const RECUERDOS = [RecuerdoHoja, RecuerdoGota, RecuerdoFlor];

/* ── La VIDA: helpers del idle-cerebro y de la mirada ───────────────────────── */

/* ¿El usuario pidió quietud? Los sistemas JS (scheduler, seguimiento) se apagan
   igual que las animaciones CSS — la dignidad de la calma es de TODO el cuerpo. */
function prefiereQuietud() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function saludoDeMontaje() {
  if (typeof window === 'undefined') return null;
  let vistos = [];
  try {
    const leidos = JSON.parse(window.localStorage.getItem('angelita:rutina') || '[]');
    vistos = Array.isArray(leidos) ? leidos : [];
  } catch { /* El saludo sigue disponible si el navegador bloquea almacenamiento. */ }
  const franja = debeSaludar(new Date(), vistos);
  return franja === 'manana' ? 'estira' : franja === 'tarde' ? 'saluda' : null;
}

/* Estados en los que Angelita LO MIRA a usted si su puntero/dedo anda cerca.
   En pensando manda su mirada pensativa; en preocupada/no-se/senala, la
   actuación del estado (el problema, sus ojos francos, el POI).
   NOTA: identificadores internos, no strings de UI. */
// eslint-disable-next-line chagra-i18n/no-hardcoded-spanish
const ESTADOS_QUE_LO_MIRAN = new Set(['acompana', 'escuchando', 'respondiendo', 'invita']);

/* Hasta dónde "se da cuenta" del puntero (px) y cuánto sostiene la mirada
   después del último movimiento antes de soltarlo (ms). */
const RADIO_DE_ATENCION = 340;
const SUELTA_MIRADA_MS = 1900;

/* LA CARA, EL DIBUJO Y LOS BRAZOS los decide `angelitaDibujo.js` (puro): cara
   alegre en reposo, crucero horizontal por defecto, de pie para actuar, y
   manos juntas cuando está de pie sin gesticular. */

/* Cuánto dura el relevo entre el cuerpo erguido y el de crucero (ms). Debe
   calzar con agt-dibujo-sale / agt-dibujo-entra de angelita-agente.css. */
const RELEVO_DIBUJO_MS = 420;

/* Tras cuánta quietud (ms) el usuario deja de estar «usándola»: mientras está
   por debajo, Angelita acompaña quieta (vuelo sereno, lo mira) y no arranca
   gestos — no le compite a lo que usted hace. */
const QUIETUD_MS = 3500;

/* Mota de vilano (semillita voladora) — lo que la distrae en el momento
   'distraida': una pelusa que cruza el aire y ella despide con los ojos.
   El viaje lo pone el CSS (.agt-mota); aquí solo el dibujo, en el trazo de
   la casa: tinta cálida, tres pelitos y su semilla. */
function MotaDeVilano() {
  return (
    <g className="agt-mota" aria-hidden="true">
      <path
        d="M0,0 L-1.15,-1.7 M0,0 L0.1,-2 M0,0 L1.2,-1.55"
        stroke={RH_INK} strokeWidth="0.28" strokeLinecap="round" opacity="0.7"
      />
      <circle r="0.5" fill={RH_INK} opacity="0.62" />
    </g>
  );
}

/* Las zetitas del sueño (momento 'cabecea'): dos z dibujadas a mano que brotan
   junto a su cabeza mientras se le van los ojos — y se ESFUMAN de golpe cuando
   despierta del brinco (el CSS las corta con el susto). Trazo de la casa. */
function Zetitas() {
  return (
    <g stroke={RH_INK} strokeLinecap="round" strokeLinejoin="round" fill="none" aria-hidden="true">
      <path className="agt-zzz" d="M12.6,-9.2 h2.5 l-2.5,2.4 h2.5" strokeWidth="0.8" />
      <path className="agt-zzz agt-zzz--2" d="M15.8,-13.2 h1.8 l-1.8,1.8 h1.8" strokeWidth="0.65" />
    </g>
  );
}

/**
 * Angelita — el cuerpo visible del agente de Chagra. Solo arte: el host cablea
 * la inteligencia y este componente la ENCARNA por estados.
 *
 * @param {Object & AngelitaDataAttributes} props
 * @param {string} [props.estado='acompana']  estado conversacional (o sinónimo).
 * @param {number|string|null} [props.confianza=null]  0..1 o 'alta'|'media'|'baja'.
 * @param {'derecha'|'izquierda'} [props.direccion='derecha']  compatibilidad
 *   de API para la guía. La presencia nunca voltea el arte.
 * @param {number} [props.size=96]
 * @param {string} [props.className]
 * @param {boolean} [props.animated=true]  false = fotograma digno.
 * @param {string|null} [props.visema]  'V1'..'V4' de useLipSync (respondiendo).
 * @param {string} [props.tier]  'alto'|'medio'|'bajo' (gama baja recorta).
 * @param {Object|null} [props.clima]  passthrough al cuerpo (clima real).
 * @param {string} [props.enso]
 * @param {string} [props.animo]  pisa el ánimo derivado del estado.
 * @param {number} [props.energia]
 * @param {string|null} [props.mundoId]  su herramienta por mundo (PropEnMano).
 * @param {boolean} [props.lineBoil]  contorno que hierve (momentos heroicos).
 * @param {boolean} [props.idleCerebro=true]  false apaga SOLO el reloj de
 *   micro-gestos (mira/distraída-con-mota/acicala/rasca/sacude/posa) del idle
 *   'acompana' — el aleteo y el boil base de <AbejaLaminaRig> siguen intactos.
 *   Para momentos "viva pero quieta" (la pausa de AngelitaEntrada antes del
 *   número: nada que compita con la entrada que viene).
 * @param {string} [props.title]  pisa la narración aria derivada del estado.
 * @param {boolean} [props.algoQueDecir]
 * @param {boolean|'poniendose'} [props.gafas]
 * @param {string[]|undefined} [props.cejas]
 */
/** @typedef {{ 'data-agt-estado'?: string, 'data-pose'?: string, 'data-visema'?: string }} AngelitaDataAttributes */
function AngelitaRig({
  estado = 'acompana',
  confianza = null,
  direccion = 'derecha',
  size = 96,
  className = '',
  style: styleHost = undefined,
  animated = true,
  visema = null,
  tier = undefined,
  clima = null,
  climaDato = null,
  saludFincaDato = undefined,
  pantalla = null,
  enso = 'neutro',
  animo = undefined,
  energia = 1,
  mundoId = null,
  lineBoil = false,
  idleCerebro = true,
  /* ¿La pantalla tiene algo que explicarle y usted aún no abrió la pizarra?
     Con true, el primer gesto cuando usted se queda quieto es SALUDARLO, y
     saludar/mirarlo pesan más en el azar: el cuerpo avisa, la pizarra dice.
     NUNCA abre un globo (regla dura de compaiExplicaPantallas). */
  algoQueDecir = false,
  /* Gafas de sol (día soleado / entrada teatral): passthrough al cuerpo.
     false | true | 'poniendose' (la caída one-shot). */
  gafas = false,
  /* Cejas: si el host no manda, cada estado actúa con las SUYAS
     (CEJAS_DE_ESTADO — el que habla hace eyebrow-flash, la contenta arquea). */
  cejas = undefined,
  title = undefined,
  dibujoForzado = undefined,
  'data-agt-estado': dataEstado = undefined,
  'data-pose': dataPose = undefined,
  'data-visema': dataVisema = undefined,
  onClick: onClickHost = undefined,
  ...rest
}) {
  const [celebraCosecha, setCelebraCosecha] = useState(false);
  const descargando = useAssetStore((s) => s.isLoading
    && !s.syncProgress?.isComplete && !s.syncProgress?.isCancelled);
  const detalleActivoAbierto = useAssetStore((s) => Boolean(s.selectedAssetId));
  const descargados = useAssetStore((s) => s.syncProgress?.current ?? null);
  const { matasTotal } = useInventarioCompai();
  const matasRef = useRef(0);
  const matasContadas = useRef(0);
  useEffect(() => {
    matasRef.current = matasTotal;
    if (!matasTotal) matasContadas.current = 0;
  }, [matasTotal]);
  // Una conversación conserva su turno. El pull real solo acompaña el reposo.
  const esperaDescarga = descargando && ['acompana', 'esperando'].includes(estadoCanonico(estado));
  const e = celebraCosecha ? 'contenta' : estadoCanonico(estado);
  const vivo = animated;
  const { estadoFinca: fincaRutina } = useEstadoFincaReal();
  const saludFinca = saludFincaDato ?? fincaRutina.saludFinca;
  const nivel = nivelDeConfianza(confianza);
  const pose = POSES_DE_ANGELITA[e];
  const svgRef = useRef(null);

  /* ═══ RITMO PROPIO DE PARPADEO — variación leve por instancia, separada del
     reloj que decide cuándo sale de excursión. */
  const [ritmoPropio] = useState(() => ({
    '--agt-blink-dur': `${(4.9 + Math.random() * 1.7).toFixed(2)}s`,
    '--agt-blink-delay': `${(-Math.random() * 5).toFixed(2)}s`,
  }));

  /* ═══ IDLE-CEREBRO (solo acompana): el reloj y el clima reales marcan el
     intervalo y el tipo de excursión. flota → gesto → flota; posa encadena
     posada → despega. Al interactuar, el gesto se corta de inmediato. */
  const [noche, setNoche] = useState(() => esDeNoche());
  const [despiertaDeNoche, setDespiertaDeNoche] = useState(false);
  const [despertarDia, setDespertarDia] = useState(false);
  const [aterrizandoNoche, setAterrizandoNoche] = useState(false);
  const nocheRef = useRef(noche);
  // eslint-disable-next-line react-hooks/refs -- Se lee desde callbacks registrados fuera del render.
  nocheRef.current = noche;
  const conductaClimatica = derivarConductaClimatica(climaDato);
  const enRefugio = conductaClimatica.refugio && e === 'acompana';
  const idleActivo = vivo && e === 'acompana' && tier !== 'bajo' && idleCerebro && !enRefugio;
  const [reconocimiento, setReconocimiento] = useState(0);
  const pantallaAnterior = useRef(pantalla);
  useEffect(() => {
    if (pantallaAnterior.current !== pantalla && pantalla != null && !conductaClimatica.refugio) {
      const ahora = Date.now();
      const ultima = reconocimientosPorPantalla.get(pantalla);
      if (puedeReconocerPantalla(pantalla, ultima, ahora)) {
        reconocimientosPorPantalla.set(pantalla, ahora);
        const raf = window.requestAnimationFrame(() => setReconocimiento(arcosDeReconocimiento(pantalla)));
        pantallaAnterior.current = pantalla;
        return () => window.cancelAnimationFrame(raf);
      }
    }
    pantallaAnterior.current = pantalla;
  }, [pantalla, conductaClimatica.refugio]);
  useEffect(() => {
    if (!reconocimiento) return undefined;
    const timer = window.setTimeout(() => setReconocimiento(0), reconocimiento * 600);
    return () => window.clearTimeout(timer);
  }, [reconocimiento]);
  const [momento, setMomento] = useState(noche ? 'posada' : 'flota');
  const [reaccionFinca, setReaccionFinca] = useState(null);
  const [carino, setCarino] = useState(false);
  const [saludoPendiente] = useState(saludoDeMontaje);
  const [saludoRutina, setSaludoRutina] = useState(null);
  const saludoManana = saludoRutina === 'estira';
  const cosechaTotal = useCosechaStore((s) => s.summary?.totalHarvests ?? null);
  const cosechaAnterior = useRef(null);
  const rutinaMiel = useRef(false);
  const mielPendiente = useRef(false);
  useEffect(() => {
    if (cosechaTotal == null) return;
    const anterior = cosechaAnterior.current;
    cosechaAnterior.current = cosechaTotal;
    if (esPrimeraCosecha(anterior, cosechaTotal)) {
      setCelebraCosecha(true);
      const timer = window.setTimeout(() => setCelebraCosecha(false), 2600);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [cosechaTotal]);
  useEffect(() => {
    if (!fincaSana(saludFinca) || rutinaMiel.current || mielPendiente.current) return;
    const hoy = new Date();
    const clave = `angelita:saludo:${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}:miel`;
    try {
      const leidas = JSON.parse(window.localStorage.getItem('angelita:rutina') || '[]');
      const vistas = Array.isArray(leidas) ? leidas : [];
      if (puedeOfrecerMiel(hoy, vistas)) {
        mielPendiente.current = true;
        const aparecer = window.setTimeout(() => {
          rutinaMiel.current = true;
          mielPendiente.current = false;
          let guardadas = [];
          try {
            const actuales = JSON.parse(window.localStorage.getItem('angelita:rutina') || '[]');
            guardadas = Array.isArray(actuales) ? actuales : [];
            window.localStorage.setItem('angelita:rutina', JSON.stringify([...guardadas, clave]));
          } catch { /* El gesto sigue disponible sin persistencia del día. */ }
          setReaccionFinca('miel');
        }, 0);
        return () => {
          window.clearTimeout(aparecer);
          mielPendiente.current = false;
        };
      }
    } catch { /* El gesto sigue siendo opcional si el navegador bloquea almacenamiento. */ }
  }, [saludFinca]);
  useEffect(() => {
    if (reaccionFinca !== 'miel') return undefined;
    const timer = window.setTimeout(() => setReaccionFinca(null), 2600);
    return () => window.clearTimeout(timer);
  }, [reaccionFinca]);
  useEffect(() => {
    if (!saludoPendiente) return undefined;
    const ahora = new Date();
    const franja = saludoPendiente === 'estira' ? 'manana' : 'tarde';
    const dia = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const clave = `angelita:saludo:${dia}:${franja}`;
    let terminar;
    const activar = window.setTimeout(() => {
      let vistos = [];
      try {
        const leidos = JSON.parse(window.localStorage.getItem('angelita:rutina') || '[]');
        vistos = Array.isArray(leidos) ? leidos : [];
        if (vistos.includes(clave)) return;
        window.localStorage.setItem('angelita:rutina', JSON.stringify([...vistos, clave]));
      } catch { /* El gesto sigue disponible si el navegador bloquea almacenamiento. */ }
      setSaludoRutina(saludoPendiente);
      terminar = window.setTimeout(() => setSaludoRutina(null), prefiereQuietud() ? 1100 : 2600);
    }, 0);
    return () => {
      window.clearTimeout(activar);
      window.clearTimeout(terminar);
    };
  }, [saludoPendiente]);
  useEffect(() => {
    if (!carino) return undefined;
    const timer = window.setTimeout(() => setCarino(false), 1100);
    return () => window.clearTimeout(timer);
  }, [carino]);
  useEffect(() => {
    let timer;
    const alGuardarCosecha = () => {
      setReaccionFinca('polen');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setReaccionFinca(null), 3000);
    };
    const alAbrirHistorial = (event) => setReaccionFinca(event.detail?.abierto ? 'leer' : null);
    window.addEventListener('chagra:cosecha-guardada', alGuardarCosecha);
    window.addEventListener('chagra:historial-planta', alAbrirHistorial);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('chagra:cosecha-guardada', alGuardarCosecha);
      window.removeEventListener('chagra:historial-planta', alAbrirHistorial);
    };
  }, []);
  const dormida = noche && e === 'acompana' && !despiertaDeNoche && !aterrizandoNoche && momento === 'posada';
  const cortarGesto = useRef(null);
  const onActividad = useCallback(() => {
    if (nocheRef.current) setDespiertaDeNoche(true);
    cortarGesto.current?.();
  }, []);
  const interactuando = useInteraccionUsuario(QUIETUD_MS, { activo: idleActivo, onActividad });
  const interactuandoRef = useRef(interactuando);
  const climaRef = useRef(clima);
  const algoRef = useRef(algoQueDecir);
  const gafasHostRef = useRef(gafas);
  const avisoPendiente = useRef(false);
  useEffect(() => {
    interactuandoRef.current = interactuando;
    climaRef.current = clima;
    gafasHostRef.current = gafas;
    // Flanco de subida: hay algo nuevo que decir → un saludo pendiente.
    if (algoQueDecir && !algoRef.current) avisoPendiente.current = true;
    algoRef.current = algoQueDecir;
  }, [interactuando, clima, algoQueDecir, gafas]);
  useEffect(() => {
    let timer;
    const revisar = () => {
      const siguiente = esDeNoche();
      if (nocheRef.current !== siguiente) {
        nocheRef.current = siguiente;
        setNoche(siguiente);
        setSaludoRutina(null);
        setDespiertaDeNoche(false);
        if (!siguiente) setDespertarDia(true);
        else setAterrizandoNoche(true);
      }
      const ahoraFecha = new Date();
      const proxima = new Date(ahoraFecha);
      if (siguiente) proxima.setHours(5, 45, 0, 0);
      else proxima.setHours(19, 0, 0, 0);
      if (proxima <= ahoraFecha) proxima.setDate(proxima.getDate() + 1);
      timer = window.setTimeout(revisar, Math.max(250, proxima.getTime() - ahoraFecha.getTime()));
    };
    revisar();
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!noche && despertarDia && e === 'acompana') {
      if (idleActivo && !prefiereQuietud()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- The sunrise gesture owns this scheduled transition.
        setMomento('estira');
        const timer = window.setTimeout(() => {
          setDespertarDia(false);
          setMomento('flota');
        }, 2600);
        return () => window.clearTimeout(timer);
      }
      setDespertarDia(false);
      setMomento('flota');
      return undefined;
    }
    if (noche && e === 'acompana') {
      if (despiertaDeNoche && !prefiereQuietud()) {
        setMomento('bosteza');
        const timer = window.setTimeout(() => setDespiertaDeNoche(false), 3200);
        return () => window.clearTimeout(timer);
      }
      if (aterrizandoNoche && !prefiereQuietud()) {
        setMomento('posa');
        const timer = window.setTimeout(() => {
          setAterrizandoNoche(false);
          setMomento('posada');
        }, duracionDeMomento('posa'));
        return () => window.clearTimeout(timer);
      }
      setMomento('posada');
      return undefined;
    }
    if (!idleActivo || prefiereQuietud()) return undefined;
    let timer = 0;
    let actual = 'flota';
    if (algoRef.current) avisoPendiente.current = true;
    const programar = (nombre, dur) => {
      actual = nombre;
      setMomento(nombre);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => siguiente(nombre), dur ?? duracionDeMomento(nombre));
    };
    const siguiente = (nombre) => {
      if (nombre === 'posa') { programar('posada'); return; }
      if (nombre === 'posada') { programar('despega'); return; }
      if (nombre !== 'flota') {
        const fecha = new Date();
        const intervalo = intervaloExcursionPorHora(fecha.getHours() + fecha.getMinutes() / 60);
        programar('flota', intervalo ?? 30000);
        return;
      }
      // Nadie la ve (pestaña oculta) o usted está usando la pantalla: sigue
      // en vuelo sereno y vuelve a preguntar después.
      const oculta = typeof document !== 'undefined' && document.hidden;
      if (oculta || interactuandoRef.current) { programar('flota', 30000); return; }
      const avisar = avisoPendiente.current && algoRef.current;
      const fecha = new Date();
      const hora = fecha.getHours() + fecha.getMinutes() / 60;
      const intervalo = intervaloExcursionPorHora(hora);
      if (intervalo === null) { programar('flota', 30000); return; }
      const bloque = Math.floor(fecha.getTime() / intervalo);
      const contexto = { ...contextoDeReposo(climaRef.current), ...(gafasHostRef.current ? { sol: false } : {}) };
      const cantidad = matasRef.current;
      const contar = debeContarMatas(cantidad) && matasContadas.current !== cantidad;
      let gesto = avisar ? 'saluda' : contar ? 'cuenta' : excursionDeHorario(hora, bloque, contexto);
      // El repertorio propone cuenta también al azar; sin un conteo nuevo no actúa.
      if (gesto === 'cuenta') {
        if (contar) matasContadas.current = cantidad;
        else gesto = 'flota';
      }
      if (!cantidad) matasContadas.current = 0;
      if (avisar) avisoPendiente.current = false;
      programar(gesto || 'flota');
    };
    // Al primer toque: el gesto en curso se suelta YA (en el mismo evento).
    cortarGesto.current = () => {
      if (actual !== 'flota') programar('flota', 30000);
    };
    // Arranca al próximo tick (nunca setState síncrono dentro del effect);
    // siempre desde el vuelo sereno, por si quedó un momento viejo colgado.
    const fechaInicio = new Date();
    const intervaloInicio = intervaloExcursionPorHora(fechaInicio.getHours() + fechaInicio.getMinutes() / 60);
    timer = window.setTimeout(() => programar('flota', intervaloInicio ?? 30000), 0);
    return () => {
      cortarGesto.current = null;
      window.clearTimeout(timer);
    };
  }, [idleActivo, noche, despiertaDeNoche, despertarDia, aterrizandoNoche, e]);

  /* ═══ LA MIRADA QUE LO RECONOCE — si su puntero/dedo anda cerca, las pupilas
     lo siguen (data-agt-mira='usted' + vars --agt-mx/--agt-my); al quedarse
     quieto ~2s lo suelta y vuelve a sus dardeos naturales. DOM directo vía ref
     (React no administra estos attrs): cero re-renders por mover el mouse. */
  const sigueUsted = vivo && tier !== 'bajo' && ESTADOS_QUE_LO_MIRAN.has(e);
  useEffect(() => {
    const svg = svgRef.current;
    if (!sigueUsted || !svg || prefiereQuietud()) return undefined;
    let raf = 0;
    let soltar = 0;
    let px = 0;
    let py = 0;
    const signo = 1;
    const liberar = () => svg.removeAttribute('data-agt-mira');
    const mirar = () => {
      raf = 0;
      const r = svg.getBoundingClientRect();
      if (!r.width) return;
      // Sus ojos viven arriba del centro del lienzo (la cabeza, no el tronco).
      const dx = px - (r.left + r.width / 2);
      const dy = py - (r.top + r.height * 0.4);
      if (Math.hypot(dx, dy) > RADIO_DE_ATENCION) { liberar(); return; }
      // Deflexión de pupila en unidades del viewBox (misma amplitud ~0.55 del
      // dardeo natural); saturada a ~150px — más lejos ya es "mirar hacia allá".
      const mx = Math.max(-1, Math.min(1, dx / 150)) * 0.55 * signo;
      const my = Math.max(-1, Math.min(1, dy / 150)) * 0.42;
      svg.style.setProperty('--agt-mx', `${mx.toFixed(3)}px`);
      svg.style.setProperty('--agt-my', `${my.toFixed(3)}px`);
      svg.setAttribute('data-agt-mira', 'usted');
      window.clearTimeout(soltar);
      soltar = window.setTimeout(liberar, SUELTA_MIRADA_MS);
    };
    const onMove = (ev) => {
      px = ev.clientX;
      py = ev.clientY;
      if (!raf) raf = window.requestAnimationFrame(mirar);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      if (raf) window.cancelAnimationFrame(raf);
      window.clearTimeout(soltar);
      liberar();
      svg.style.removeProperty('--agt-mx');
      svg.style.removeProperty('--agt-my');
    };
  }, [sigueUsted]);

  // El estado tiñe el ánimo del cuerpo base (aura/antics) salvo que el host
  // mande el suyo: contenta brilla 'pleno', preocupada se pone 'atento'.
  const animoDelEstado = animo ?? (e === 'contenta' ? 'pleno' : e === 'preocupada' ? 'atento' : 'sereno');
  // Y actúa con las CEJAS (salvo que el host mande las suyas): eyebrow-flash
  // al hablar, arqueadas de dicha, fruncidas de concentración fisgona.
  const enGesto = (m) => idleActivo && momento === m;
  const cejasDelEstado = cejas !== undefined
    ? cejas
    : enGesto('asombro') ? 'altas' : CEJAS_DE_ESTADO[e] ?? null;
  // Gafas y ruana del reposo: el CSS del momento anima el acto de ponérselas
  // y quitárselas; aquí solo se montan mientras dura el gesto. Si el host ya
  // se las puso (día soleado), el gesto no las toca.
  const gafasDelCuerpo = (conductaClimatica.calorSeco && e === 'acompana') || gafas || (enGesto('gafas') && !conductaClimatica.helada ? true : false);
  // Mientras habla (visema del TTS) manda la boca que se mueve.
  const momentoActivo = saludoRutina || (idleActivo ? momento : null);
  const expresion = expresionDeAngelita(e, { momento: momentoActivo, visema });
  const dibujo = reaccionFinca === 'leer'
    ? 'decir'
    : dormida || (conductaClimatica.helada && e === 'acompana')
    ? 'decir'
    : (dibujoForzado || dibujoDeAngelita(e, momentoActivo));
  const brazos = enGesto('cuenta') ? 'reposo' : brazosDeAngelita(e, momentoActivo);

  /* ═══ EL RELEVO ERGUIDA ↔ CRUCERO — no se cambia un dibujo por otro de golpe:
     el que sale se inclina hacia la postura nueva y se desvanece, y el que
     entra llega todavía inclinado y se endereza. Los dos conviven solo
     RELEVO_DIBUJO_MS. Quieta o con reduced-motion el cambio es directo. */
  const [dibujoVisto, setDibujoVisto] = useState(dibujo);
  const [saliente, setSaliente] = useState(null);
  if (dibujo !== dibujoVisto) {
    setDibujoVisto(dibujo);
    setSaliente(vivo && !prefiereQuietud() ? dibujoVisto : null);
  }
  useEffect(() => {
    if (!saliente) return undefined;
    const t = window.setTimeout(() => setSaliente(null), RELEVO_DIBUJO_MS);
    return () => window.clearTimeout(t);
  }, [saliente, dibujoVisto]);
  const ruanaDelReposo = (conductaClimatica.helada && e === 'acompana') || enGesto('ruana');
  const aria = title ?? (ARIA_DE_ESTADO[e] + (nivel === 'baja' ? ' (con dudas)' : ''));
  // Clase de animación solo cuando está viva; quieta = opacidad digna inline.
  const cls = (c) => (vivo ? c : undefined);

  /* ═══ CAPA FONDO: el anillo de certeza (confianza) + aro de alerta ═══════ */
  const halo = nivel ? (
    <g aria-hidden="true">
      <circle
        className={`agt-halo-${nivel}`}
        cx="0" cy="0" r="12.6"
        fill="none"
        stroke={COLOR_CERTEZA}
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray={nivel === 'media' ? '4.6 3' : nivel === 'baja' ? '1.8 4' : undefined}
        opacity={nivel === 'baja' ? 0.45 : 0.55}
      />
      {/* La duda también se dice: puntos suspensivos junto a su cabeza. */}
      {nivel === 'baja' && (
        <g fill={RH_INK} opacity="0.75" transform={AIRE.duda}>
          <circle className={cls('agt-duda-punto')} cx="15" cy="-7.8" r="0.7" />
          <circle className={cls('agt-duda-punto')} style={{ animationDelay: '-0.7s' }} cx="16.8" cy="-9.4" r="0.6" />
          <circle className={cls('agt-duda-punto')} style={{ animationDelay: '-1.4s' }} cx="18.3" cy="-11.2" r="0.5" />
        </g>
      )}
    </g>
  ) : null;
  // Preocupada: un aro coral late detrás del cuerpo — alerta que se siente,
  // no sirena. (Detrás: nunca compite con la carita.)
  const aroAlerta = e === 'preocupada' ? (
    <circle
      className={cls('agt-alerta')}
      cx="0" cy="0" r="12.4"
      fill="none" stroke={COLOR_ALERTA} strokeWidth="1.1"
      opacity={vivo ? undefined : 0.3}
      aria-hidden="true"
    />
  ) : null;

  /* ═══ SEÑALES DE CARA (dentro de .agt-cuerpo: se mueven CON ella) ════════
     Coordenadas en el espacio de la abeja: cabeza (8.6,-1) r4.4; ojos en
     (10.1,-1.9) y (7.4,-2.2); las cejas van justo encima. */
  const caraPreocupada = e === 'preocupada' ? (
    <g aria-hidden="true">
      {/* cejas fruncidas: las puntas internas suben — preocupación, no rabia */}
      <g stroke={RH_INK} strokeWidth="0.85" strokeLinecap="round" fill="none">
        <g transform={LAMINA_ANCLAS.cejaPequena}><path d="M6.1,-4.5 L8,-5.2" /></g>
        <g transform={LAMINA_ANCLAS.cejaGrande}><path d="M9.1,-5.3 L11.4,-4.5" /></g>
      </g>
      {/* gota de sudor que brota de la sien y escurre */}
      <g transform="translate(3.3 -4.4) scale(.6)">
        <path
          className={cls('agt-sudor')}
          d={GOTA_D}
          fill={ABEJA_PALETA.gota}
          stroke={RH_INK}
          strokeWidth="0.35"
          opacity={vivo ? undefined : 0.85}
        />
      </g>
    </g>
  ) : null;
  const caraNoSe = e === 'no-se' ? (
    <g stroke={RH_INK} strokeWidth="0.8" strokeLinecap="round" fill="none" aria-hidden="true">
      {/* una ceja arqueada y la otra tranquila: honestidad curiosa, sin pena */}
      <g transform={LAMINA_ANCLAS.cejaPequena}><path d="M5.9,-5.2 Q7.3,-6.1 8.6,-5.3" /></g>
      <g transform={LAMINA_ANCLAS.cejaGrande}><path d="M9.5,-4.8 L11.3,-4.7" /></g>
    </g>
  ) : null;
  // PENSANDO — la cejita del "mmm": la cercana se arquea ALTO (persigue la
  // idea) y la otra baja, concentrada. El CSS le da un tironcito sincronizado
  // con los golpecitos de barbilla; con RM/quieta, la asimetría sola ya lee.
  // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish
  const caraPensando = e === 'pensando' ? (
    <g
      className={cls('agt-ceja-piensa')}
      stroke={RH_INK} strokeWidth="0.8" strokeLinecap="round" fill="none"
      aria-hidden="true"
    >
      <g transform={LAMINA_ANCLAS.cejaGrande}><path d="M9.1,-5.4 Q10.35,-6.35 11.55,-5.45" /></g>
      <g transform={LAMINA_ANCLAS.cejaPequena}><path d="M6.45,-4.35 L8.25,-4.6" /></g>
    </g>
  ) : null;

  /* ═══ CAPA AIRE: lo que flota alrededor (burbuja, ondas, signos) ═════════ */
  // PENSANDO — burbuja de pensamiento con colita, tres puntos que laten y los
  // recuerdos de la finca que va hojeando (quieta u en tier bajo: solo el 1º).
  const recuerdosVisibles = vivo ? RECUERDOS : RECUERDOS.slice(0, 1);
  // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish
  const burbuja = e === 'pensando' ? (
    <g className={cls('agt-burbuja')} aria-hidden="true">
      <circle cx="10.8" cy="-11.6" r="0.85" fill={CREMA_PAPEL} stroke={RH_INK} strokeWidth="0.7" />
      <circle cx="12.2" cy="-14.6" r="1.35" fill={CREMA_PAPEL} stroke={RH_INK} strokeWidth="0.8" />
      <ellipse cx="13.6" cy="-21.4" rx="7" ry="5.6" fill={CREMA_PAPEL} stroke={RH_INK} strokeWidth="1.1" />
      {/* lo que está repasando: la mata, el agua, la flor */}
      <g transform="translate(13.6 -22.8)">
        {recuerdosVisibles.map((Recuerdo, i) => (
          <g key={i} className={cls('agt-recuerdo')} style={vivo ? { animationDelay: `${i * -1.8}s` } : undefined}>
            <Recuerdo />
          </g>
        ))}
      </g>
      {/* el latido del pensar */}
      <g fill={RH_INK}>
        <circle className={cls('agt-piensa-punto')} cx="10.9" cy="-18.4" r="1" />
        <circle className={cls('agt-piensa-punto')} style={{ animationDelay: '0.22s' }} cx="13.6" cy="-18.4" r="1" />
        <circle className={cls('agt-piensa-punto')} style={{ animationDelay: '0.44s' }} cx="16.3" cy="-18.4" r="1" />
      </g>
    </g>
  ) : null;
  // ESCUCHANDO — la voz de usted entra en ondas de tinta, hacia ella.
  const ondasIn = e === 'escuchando' ? (
    <g stroke={COLOR_VOZ_HUMANA} strokeWidth="1" strokeLinecap="round" fill="none" aria-hidden="true">
      {[0, -2.8, -5.4].map((dx, i) => (
        <path
          key={i}
          className={cls('agt-onda-in')}
          style={vivo ? { animationDelay: `${i * -0.63}s` } : undefined}
          opacity={vivo ? undefined : 0.4}
          d={`M${-15.8 + dx},-6.4 q2.8,4.9 0,10.6`}
        />
      ))}
    </g>
  ) : null;
  // RESPONDIENDO — su voz sale en ondas de miel, desde la boquita.
  // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish
  const ondasOut = e === 'respondiendo' ? (
    <g stroke={COLOR_VOZ_MIEL} strokeWidth="1.05" strokeLinecap="round" fill="none" aria-hidden="true">
      {[0, 2.3, 4.6].map((dx, i) => (
        <path
          key={i}
          className={cls('agt-onda-out')}
          style={vivo ? { animationDelay: `${i * -0.53}s` } : undefined}
          opacity={vivo ? undefined : 0.4}
          d={`M${14.4 + dx},-2.4 q2.9,4 0,8.2`}
        />
      ))}
    </g>
  ) : null;
  // CONTENTA — chispas de polen dorado que estallan al compás del brinco.
  const CHISPAS_POS = [[-10.4, -9.6], [10.2, -10.6], [11.4, 3], [-11.4, 3.6], [-6.2, -12], [8.8, 10.6]];
  const chispas = e === 'contenta' ? (
    <g fill={COLOR_CERTEZA} stroke={RH_INK} strokeWidth="0.3" aria-hidden="true">
      {CHISPAS_POS.map(([x, y], i) => (
        /* El sitio va en el <g> y la animación en el <path>: un transform de
           CSS pisa el atributo transform del MISMO nodo, y con él las seis
           chispas caían al centro del cuerpo, encima de la boca. */
        <g key={i} data-anatomia="adorno" transform={`translate(${x} ${y}) scale(${(0.8 + (i % 3) * 0.25) * 0.6})`}>
          <path
            className={cls('agt-chispa')}
            style={vivo ? { animationDelay: `${i * -0.19}s` } : undefined}
            opacity={vivo ? undefined : 0.55}
            d={CHISPA_D}
          />
        </g>
      ))}
    </g>
  ) : null;
  // NO-SÉ — el "?" dibujado a mano, con wobble de line-boil (steps, no péndulo).
  // Al entrar al estado se DIBUJA de un trazo (pathLength=1 + dashoffset en el
  // CSS) y el puntico cae al final — honestidad que se escribe delante de usted.
  const signoNoSe = e === 'no-se' ? (
    <g className={cls('agt-nose-signo')} aria-hidden="true">
      <path
        pathLength="1"
        d="M11.8,-19.2 Q11.7,-22 14.3,-21.8 Q16.6,-21.5 15.9,-19.3 Q15.5,-18 14.2,-17.4 Q13.5,-17 13.5,-15.9"
        stroke={RH_INK} strokeWidth="1.25" fill="none" strokeLinecap="round"
      />
      <circle cx="13.5" cy="-13.8" r="0.85" fill={RH_INK} />
    </g>
  ) : null;
  // La MOTA DE VILANO que la distrae (momento 'distraida' del idle): cruza el
  // aire una sola vez y Angelita la despide con los ojos y la cabeza (CSS).
  const mota = (vivo && e === 'acompana' && momento === 'distraida')
    ? <g transform={AIRE.mota}><MotaDeVilano /></g>
    : null;
  // Las zetitas del 'cabecea': viven montadas durante todo el acompana
  // (invisibles, opacity 0) y las DISPARA el selector [data-agt-idle='cabecea']
  // del CSS — así el one-shot corre cada vez que el gesto entra, sin depender
  // de un remontaje de React.
  const zetitas = (vivo && e === 'acompana') ? <g transform={AIRE.zetitas}><Zetitas /></g> : null;
  // SEÑALA — el destello donde apunta (abajo-derecha, donde cae su bracito).
  const destelloPoi = e === 'senala' ? (
    <g
      className={cls('agt-poi')}
      transform={AIRE.poi}
      data-anatomia="adorno"
      opacity={vivo ? undefined : 0.7}
      aria-hidden="true"
    >
      <circle r="2.9" fill="none" stroke={COLOR_CERTEZA} strokeWidth="0.7" opacity="0.7" />
      <path d={CHISPA_D} fill={COLOR_CERTEZA} stroke={RH_INK} strokeWidth="0.35" />
    </g>
  ) : null;
  // HUSMEA — las virutas de olor que entran hacia su nariz (la carita vive a
  // la derecha, x≈13): tres hilitos serpenteantes desfasados que ella persigue
  // inclinada (el cuerpo lo pone el CSS agm-husmea-cuerpo).
  const virutasOlor = e === 'husmea' ? (
    <g stroke={RH_INK} strokeWidth="0.6" strokeLinecap="round" fill="none" aria-hidden="true">
      {[[15.2, 0.6, 0], [17.1, -1.4, -0.7], [15.9, 2.8, -1.4]].map(([x, y, d], i) => (
        <path
          key={i}
          className={cls('agm-olor')}
          style={vivo ? { animationDelay: `${d}s` } : undefined}
          opacity={vivo ? undefined : 0.55}
          d={`M${x},${y} q1.1,-0.7 2.2,0 q1.1,0.7 2.2,0`}
        />
      ))}
    </g>
  ) : null;
  // INVITA — estelas del "venga": arcos que viajan HACIA ella.
  const estelasInvita = e === 'invita' ? (
    <g stroke={COLOR_VOZ_MIEL} strokeWidth="0.95" strokeLinecap="round" fill="none" aria-hidden="true">
      {[0, 2.4].map((dx, i) => (
        <path
          key={i}
          className={cls('agt-venga-onda')}
          style={vivo ? { animationDelay: `${i * -0.7}s` } : undefined}
          opacity={vivo ? undefined : 0.4}
          d={`M${16.4 + dx},-3.2 q-2.2,3.4 0,6.6`}
        />
      ))}
    </g>
  ) : null;

  /* ═══ MONTAJE ═════════════════════════════════════════════════════════════
     fondo (halo/alerta) → vuelo (la física: deriva, aterrizaje, entrada de
     estado) → cuerpo (abeja + señales de cara, UN wrapper que los estados
     mueven junto) → aire (burbuja, ondas, chispas, signos, la mota).
     `.agt-vuelo` va con key=estado: al cambiar de estado se REMONTA y su
     animación de entrada vuelve a correr. La transición conserva el arte sin
     voltear; el ritmo propio de parpadeo viaja como CSS vars. */
  const estilo = { ...ritmoPropio, ...styleHost };
  const derivaViento = conductaClimatica.rumbo == null
    ? -4
    : (Math.sin((conductaClimatica.rumbo * Math.PI) / 180) || 0.5) * -4;
  const cuerpo = (dib) => (
    <AbejaLaminaRig
      inline
      animated={vivo}
      pose={pose}
      dibujo={reaccionFinca === 'leer' ? 'leer' : dib}
      // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish -- Canonical state identifiers, not UI copy.
      movimiento={reaccionFinca === 'leer' ? 'leer' : e === 'respondiendo' ? 'hablar' : e === 'pensando' ? 'pensar' : 'decir'}
      visema={visema}
      tier={tier}
      clima={clima}
      enso={enso}
      animo={animoDelEstado}
      energia={energia}
      mundoId={mundoId}
      polen={reaccionFinca === 'polen'}
      lineBoil={lineBoil}
      gafas={gafasDelCuerpo}
      ruana={ruanaDelReposo}
      cejas={cejasDelEstado}
      expresion={expresion}
      brazos={momentoActivo === 'estira' ? 'puños' : brazos}
      gestoBrazoDerecho={e === 'senala' ? 'senala' : e === 'invita' ? 'llama' : undefined}
      gestoBrazoIzquierdo={e === 'senala' || e === 'invita' ? 'recogido' : undefined}
      cejasDeAgente={caraPreocupada || caraNoSe || caraPensando}
      encuadre
    />
  );
  return (
    <svg
      ref={svgRef}
      viewBox={VIEWBOX}
      width={size}
      height={size}
      className={className ? `agt-angelita ${className}` : 'agt-angelita'}
      style={{
        ...styleHost,
        ...estilo,
        '--agt-arcos': reconocimiento || 1,
        '--agt-viento-inclinacion': `${derivaViento.toFixed(2)}deg`,
        '--agt-viento-corrige': `${(-derivaViento).toFixed(2)}deg`,
        overflow: 'visible',
      }}
      role="img"
      aria-label={aria}
      data-agente="angelita"
      data-agt-matas={idleActivo && momento === 'cuenta' ? matasTotal : undefined}
      data-agt-descargados={esperaDescarga && Number.isInteger(descargados) ? descargados : undefined}
      data-agt-direccion={direccion}
      data-agt-vivo={vivo ? '1' : undefined}
      data-agt-noche={noche ? '1' : undefined}
      data-agt-dormida={dormida ? '1' : undefined}
      /* El visema del TTS también en el root: el CSS acopla las ondas de miel
         al movimiento real de la boquita (V1 = silencio). Solo se estampa si
         el host manda visemas — sin TTS, nada cambia. */
      data-agt-visema={visema || undefined}
      data-agt-idle={reaccionFinca || saludoRutina || (idleActivo ? momento : undefined)}
      data-agt-carino={carino ? '1' : undefined}
      data-agt-expresion={expresion}
      data-agt-brazos={brazos === 'marco' || brazos === 'saluda' ? brazos : undefined}
      data-agt-dibujo={dibujo}
      data-agt-confianza={nivel || undefined}
      data-tier={tier || undefined}
      data-agt-clima={enRefugio ? 'refugio' : conductaClimatica.helada ? 'helada' : conductaClimatica.calorSeco ? 'calor-seco' : conductaClimatica.viento ? 'viento' : undefined}
      data-agt-viento={conductaClimatica.viento ? '1' : undefined}
      data-agt-helada={conductaClimatica.helada ? '1' : undefined}
      data-agt-calor-seco={conductaClimatica.calorSeco ? '1' : undefined}
      data-agt-refugio={enRefugio ? '1' : undefined}
      data-agt-reconocimiento={reconocimiento || undefined}
      {...rest}
      onClick={(event) => {
        setCarino(true);
        onClickHost?.(event);
      }}
      // El caller puede proyectar un estado transversal como locomoción sin
      // ampliar el vocabulario conversacional interno de Angelita.
      data-agt-estado={dataEstado ?? e}
      data-pose={dataPose ?? (vivo ? pose : undefined)}
      data-visema={dataVisema ?? visema ?? undefined}
    >
      <title>{aria}</title>
      {enRefugio && <g className="agt-refugio-hoja" aria-hidden="true"><path d="M-10 -9 Q-2 -17 9 -10 Q7 -3 -3 -4 Q-7 -5 -10 -9Z" fill="#6a994e" stroke={RH_INK} strokeWidth=".55"/><path d="M-9 -9 Q-2 -9 7 -11" fill="none" stroke={RH_INK} strokeWidth=".3"/></g>}
      {halo}
      {aroAlerta}
      {reaccionFinca === 'miel' && (
        <g className="agt-gota-miel" aria-hidden="true">
          <path d="M10 -19 C8 -16 7 -14.8 7 -13.5 A3 3 0 0 0 13 -13.5 C13 -14.8 12 -16 10 -19Z" fill="#e7a72f" stroke={RH_INK} strokeWidth=".45" />
          <path d="M9 -14.4 Q9.2 -13.4 10.2 -13.2" fill="none" stroke="#fff0b7" strokeWidth=".45" strokeLinecap="round" />
        </g>
      )}
      {saludoManana && (
        <g className="agt-cafecito" aria-hidden="true" stroke={RH_INK} strokeWidth=".42" strokeLinecap="round" strokeLinejoin="round">
          <path d="M-12 -15.2 h3.2 v2.6 a1 1 0 0 1 -1 1 h-1.2 a1 1 0 0 1 -1 -1z" fill="#d69a46" />
          <path d="M-8.8 -14.5 h.65 a.6 .6 0 0 1 0 1.2 h-.65 M-12.7 -11.3 h4.5" fill="none" />
          <path className="agt-vapor-cafe" d="M-11 -16.1 q-.5 -.6 0 -1.1 M-9.8 -16.1 q-.5 -.6 0 -1.1" fill="none" />
        </g>
      )}
      <g className="agt-vuelo" key={e}>
        <g className="agt-cuerpo">
          {saliente && (
            <g className="agt-dibujo-sale" data-hacia={dibujo} aria-hidden="true">
              {cuerpo(saliente)}
            </g>
          )}
          <g key={dibujo} className={saliente ? 'agt-dibujo-entra' : undefined} data-desde={saliente || undefined}>
            {cuerpo(dibujo)}
          </g>
        </g>
      </g>
      {carino && (
        <g className="agt-pelitos-erizados" aria-hidden="true" stroke={RH_INK} strokeWidth=".34" strokeLinecap="round">
          <path d="M-3.2 5.8 l-.7 -1 M-1.7 6.4 l-.2 -1.2 M-.1 6.5 l.25 -1.2 M1.5 6.1 l.7 -1 M2.8 5.5 l.9 -.8" />
          <path d="M8.4 1.2 q1.2 -.9 2.2 0" fill="none" strokeWidth=".55" />
        </g>
      )}
      {dormida && !detalleActivoAbierto && (
        <g className="agt-puerta-cera" transform="translate(9.3 5.2) scale(2.35)" aria-hidden="true">
          <path d="M-2.05 2.1 H2.05" stroke={RH_INK} strokeWidth="0.22" strokeLinecap="round" />
          <path d="M-1.55 1.8 V-0.15 Q-1.55 -2.05 0 -2.05 Q1.55 -2.05 1.55 -0.15 V1.8 Z"
            fill="#c78a2d" stroke={RH_INK} strokeWidth="0.24" strokeLinejoin="round" />
          <path d="M-0.88 1.55 V0.03 Q-0.88 -1.12 0 -1.12 Q0.88 -1.12 0.88 0.03 V1.55 Z"
            fill="#70451f" stroke={RH_INK} strokeWidth="0.18" strokeLinejoin="round" />
          <path d="M0.54 0.72 V0.93" stroke="#f4d483" strokeWidth="0.2" strokeLinecap="round" />
        </g>
      )}
      <g transform={AIRE.burbuja}>{burbuja}</g>
      <g transform={AIRE.ondasIn}>{ondasIn}</g>
      <g transform={AIRE.ondasOut}>{ondasOut}</g>
      {chispas}
      <g transform={AIRE.signoNoSe}>{signoNoSe}</g>
      {destelloPoi}
      <g transform={AIRE.invita}>{estelasInvita}</g>
      <g transform={AIRE.olor}>{virutasOlor}</g>
      {mota}
      {zetitas}
    </svg>
  );
}

/*
 * Adaptador del perfil dorado. CompaiAgente resuelve el contrato común y este
 * adaptador conserva el cuerpo histórico sin dejar que los metadatos del
 * registro terminen como props desconocidas sobre el SVG.
 */
function AdaptadorAngelita({
  especie: _especie,
  creatureSlug: _creatureSlug,
  capacidades: _capacidades,
  perfil: _perfil,
  idlePerfil: _idlePerfil,
  climaPerfil: _climaPerfil,
  pose: _pose,
  reducedMotion: _reducedMotion,
  'data-agt-especie': dataEspecie,
  'data-creature': dataCreature,
  'data-agt-estado': dataEstado,
  'data-pose': dataPose,
  'data-visema': dataVisema,
  'data-clima': dataClima,
  'data-tier': dataTier,
  ...props
}) {
  return (
    <AngelitaRig
      {...props}
      data-agt-especie={dataEspecie}
      data-creature={dataCreature}
      data-agt-estado={dataEstado}
      data-pose={dataPose}
      data-visema={dataVisema}
      data-clima={dataClima}
      data-tier={dataTier}
    />
  );
}

/**
 * Fachada histórica de Angelita sobre el contrato común de Compai.
 *
 * `chrome={false}` es intencional: Angelita ya contiene sus halos, ondas,
 * burbujas, señales y gestos aprobados. El shell común sigue resolviendo el
 * perfil, la pose y los atributos, pero no duplica una señal visible.
 */
export function Angelita(props) {
  const descargando = useAssetStore((s) => s.isLoading
    && !s.syncProgress?.isComplete && !s.syncProgress?.isCancelled);
  const esperaDescarga = descargando && estadoCanonico(props.estado) === 'acompana';
  const [campoInvalido, setCampoInvalido] = useState(false);
  const [cuidadoInsumo, setCuidadoInsumo] = useState(false);
  const timerCuidadoRef = useRef(null);
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const revisar = () => {
      const campo = document.querySelector('[aria-invalid="true"]');
      setCampoInvalido(Boolean(campo));
      /** @type {NodeListOf<SVGSVGElement>} */
      const avatares = document.querySelectorAll('svg[data-agente="angelita"]');
      if (!campo) {
        Array.from(avatares).forEach((svg) => svg.style.removeProperty('--agt-senala-angulo'));
        return;
      }
      const rect = campo.getBoundingClientRect();
      Array.from(avatares).forEach((svg) => {
        const matrix = svg.getScreenCTM();
        if (!svg.createSVGPoint || !matrix) return;
        const punto = svg.createSVGPoint();
        punto.x = rect.left + rect.width / 2;
        punto.y = rect.top + rect.height / 2;
        const local = punto.matrixTransform(matrix.inverse());
        const grados = Math.atan2(local.y - 0.4, local.x - 2.6) * 180 / Math.PI;
        // The relaxed arm vector is about -5.3° from its shoulder; compensate
        // that base angle so its tip aims at the field center.
        svg.style.setProperty('--agt-senala-angulo', `${Math.max(-150, Math.min(150, grados + 5.3))}deg`);
      });
    };
    const observer = new MutationObserver(revisar);
    observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['aria-invalid'] });
    const frame = window.requestAnimationFrame(revisar);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    const cuidar = () => {
      setCuidadoInsumo(true);
      window.clearTimeout(timerCuidadoRef.current);
      timerCuidadoRef.current = window.setTimeout(() => setCuidadoInsumo(false), 3600);
    };
    window.addEventListener('angelita:cuidado-insumo', cuidar);
    return () => {
      window.removeEventListener('angelita:cuidado-insumo', cuidar);
      window.clearTimeout(timerCuidadoRef.current);
    };
  }, []);
  return (
    <CompaiAgente
      {...props}
      estado={campoInvalido ? 'senala' : esperaDescarga ? 'esperando' : props.estado}
      data-agt-campo-invalido={campoInvalido ? '1' : undefined}
      data-agt-cuidado-insumo={cuidadoInsumo ? '1' : undefined}
      especie="angelita"
      chrome={false}
      preserveRigAnimation
      adaptador={AdaptadorAngelita}
    />
  );
}

export default Angelita;
