/**
 * GuacamayaViva — la guacamaya del corto viviendo dentro de la ventana de voz.
 *
 * La tinta y la piel son las de `GuacamayaCompaiRig` (rig aprobado + piel
 * compartida `arte-valle/pielGuacamaya.js`), pintado quieto fuera de la vista;
 * el lienzo lo lee con estilos computados (así entra el CSS de la piel) y lo
 * interpreta con el intérprete compartido `compaiViva/lienzoRig.js`. Nada se
 * redibuja. El cuerpo en cada cuadro lo decide `gestosGuacamaya.js` con
 * entradas reales: estado de voz, nivel del micrófono (ref, sin re-render),
 * frase del TTS, visema y la foto del agente.
 *
 * Con movimiento reducido o en pausa pinta un solo cuadro por cambio.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { GuacamayaCompaiRig } from '../../../visual/creatures/GuacamayaCompai.jsx';
import { arbolDeSvg, hornear, pintarConPose } from '../compaiViva/lienzoRig';
import { claveGuacamaya, cuerpoGuacamaya, gestoDeFrase, ORIGENES, PIE } from './gestosGuacamaya';
import { VOZ_REPOSO } from '../../../constants/estadosVoz';
import './guacamayaViva.css';

const ahoraS = () => performance.now() / 1000;
/** Alto de la guacamaya posada en unidades del rig (cabeza a punta de la cola). */
const ALTO_RIG = 560;

function avisar(detalle) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('guacamaya-viva:registro', { detail: { ...detalle, t: performance.now() } }));
}
function movimientoReducido() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// La rama: punta afinada en el extremo libre y el otro extremo escondido en un manojo de hojas
// dentro del lienzo, para que no termine «en seco» contra su borde.
function rama(c, x, y, esc, w) {
  const tinta = '#2a140b', lw = Math.max(1.5, 4 * esc);
  c.save();
  c.beginPath();
  const fin = w - 36 * esc; // la rama termina escondida dentro de las hojas
  c.moveTo(fin, y - 18 * esc * 1.6); c.quadraticCurveTo(x + 60 * esc, y - 10 * esc, x - 150 * esc, y - 2 * esc);
  c.quadraticCurveTo(x - 185 * esc, y + 2 * esc, x - 150 * esc, y + 6 * esc);
  c.quadraticCurveTo(x + 60 * esc, y + 14 * esc, fin, y + 26 * esc * 1.6);
  c.closePath();
  c.fillStyle = '#6d5540'; c.fill(); c.lineWidth = lw; c.strokeStyle = tinta; c.stroke();
  const hojas = [[-34, -30, 28], [-58, -6, 24], [-32, 16, 27], [-62, 26, 20], [-44, -54, 21], [-30, -2, 26]];
  for (const [dx, dy, r] of hojas) {
    c.beginPath(); c.arc(w + dx * esc, y + dy * esc, r * esc, 0, Math.PI * 2);
    c.fillStyle = '#2f6a3a'; c.fill(); c.globalAlpha = .45; c.lineWidth = lw * .7; c.stroke(); c.globalAlpha = 1;
  }
  c.restore();
}

export default function GuacamayaViva({
  estado = VOZ_REPOSO, nivelRef = null, frase = null, visema = null, foto = null,
  saliendo = false, pausada = false, className = '',
}) {
  const fuentesRef = useRef(null);
  const lienzoRef = useRef(null);
  const arbolRef = useRef(null);
  const memRef = useRef({ estado, desde: ahoraS(), previo: null, nivel: 0, frase: null, visema: null, foto: null, montada: ahoraS(), salida: null, quieta: false });
  const pintarRef = useRef(() => {});

  // Tinta + piel: árbol pintable leído del rig que GuacamayaCompaiRig pintó quieto.
  useLayoutEffect(() => {
    const svg = fuentesRef.current?.querySelector('svg');
    if (!svg || typeof Path2D === 'undefined' || typeof DOMMatrix === 'undefined') return;
    const raiz = svg.querySelector('[id^="guacaWrap"]') || svg;
    // Los <use>, gradientes y recortes viven en los <defs> fuera de guacaWrap: se resuelven por id en el documento.
    arbolRef.current = hornear(arbolDeSvg(raiz, { clave: claveGuacamaya, estilos: 'computados', origenes: ORIGENES }));
    pintarRef.current();
  }, []);

  useEffect(() => {
    const m = memRef.current;
    if (m.estado === estado) return;
    const t = ahoraS();
    m.previo = { estado: m.estado, desde: m.desde };
    m.estado = estado; m.desde = t;
    if (estado !== 'hablando') m.frase = null;
    avisar({ tipo: 'estado', estado });
    pintarRef.current();
  }, [estado]);

  useEffect(() => {
    if (!frase) return;
    memRef.current.frase = { indice: frase.indice, t: ahoraS() };
    avisar({ tipo: 'frase', indice: frase.indice, total: frase.total, gesto: gestoDeFrase(frase.indice) });
    pintarRef.current();
  }, [frase]);

  useEffect(() => { memRef.current.visema = visema; }, [visema]);
  useEffect(() => {
    memRef.current.foto = foto ? { fase: foto.fase || foto, t: ahoraS() } : null;
    if (foto) avisar({ tipo: 'foto', fase: foto.fase || foto });
    pintarRef.current();
  }, [foto]);
  useEffect(() => {
    if (saliendo && memRef.current.salida == null) { memRef.current.salida = ahoraS(); avisar({ tipo: 'salida' }); }
  }, [saliendo]);

  useEffect(() => {
    const lienzo = lienzoRef.current;
    const c = lienzo?.getContext?.('2d');
    if (!c) return undefined;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const quieta = pausada || movimientoReducido();
    memRef.current.quieta = quieta;

    const cuadro = () => {
      const m = memRef.current;
      const t = ahoraS();
      m.nivel = Math.max(0, Math.min(1, nivelRef?.current || 0));
      const w = lienzo.clientWidth, h = lienzo.clientHeight;
      if (!w || !h) return;
      if (lienzo.width !== Math.round(w * dpr) || lienzo.height !== Math.round(h * dpr)) {
        lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr);
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const esc = Math.min(h * .9 / ALTO_RIG, w * .9 / 330);
      const px = w * .5, py = h * .58; // patas a 58 %: cabeza y punta de la cola caben en la caja
      rama(c, px, py, esc, w);
      const arbol = arbolRef.current;
      if (!arbol) return;
      const { P, dx, dy, sq } = cuerpoGuacamaya(t, m);
      c.save();
      c.translate(px + dx * esc, py - PIE * esc + dy * esc);
      c.scale(esc, esc);
      if (sq !== 1) { c.translate(0, PIE); c.scale(1 + (1 - sq) * .6, sq); c.translate(0, -PIE); }
      pintarConPose(c, arbol, 1, P);
      c.restore();
    };
    pintarRef.current = cuadro;
    if (quieta) { cuadro(); return () => { pintarRef.current = () => {}; }; }
    const paso = () => { if (!document.hidden) cuadro(); raf = requestAnimationFrame(paso); };
    raf = requestAnimationFrame(paso);
    return () => { cancelAnimationFrame(raf); pintarRef.current = () => {}; };
  }, [nivelRef, pausada]);

  return (
    <div className={`guacamaya-viva ${className}`} data-estado={estado} data-testid="guacamaya-viva">
      <canvas className="guacamaya-viva__lienzo" ref={lienzoRef} role="img" aria-label={`Guacamaya, ${estado}`} />
      <div className="guacamaya-viva__fuentes" ref={fuentesRef} aria-hidden="true">
        <GuacamayaCompaiRig estado="acompana" animated={false} luces="off" size={600} title="" />
      </div>
    </div>
  );
}
