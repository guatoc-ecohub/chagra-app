/**
 * AngelitaViva — la angelita del corto viviendo dentro de la ventana de voz.
 *
 * La tinta es la de `AbejaLamina` (pintada oculta, una vez por pose) y el
 * lienzo la interpreta con el motor del corto (`laminaCanvas.js`). El cuerpo
 * en cada cuadro lo decide `gestosVoz.js` con tres entradas reales:
 *   - `estado`   el estado de voz (reposo · escuchando · pensando · hablando · error)
 *   - `nivelRef` el nivel del micrófono, leído en cada cuadro sin re-render
 *   - `frase`    la última frase que arrancó el TTS ({ indice })
 *
 * El halo lee el mismo nivel (`--nivel`), así lo que se ve es lo que se oye.
 * Con movimiento reducido o en pausa, pinta un solo cuadro por cambio.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import AbejaLamina from '../../../visual/creatures/AbejaLamina.jsx';
import { arbolDeSvg, pintarAbeja } from './laminaCanvas';
import { cuerpoEn, gestoVisible, gestoDeFrase, POSE_DE_ESTADO } from './gestosVoz';
import { VOZ_REPOSO } from '../../../constants/estadosVoz';
import './angelitaViva.css';

const POSES = [...new Set(Object.values(POSE_DE_ESTADO))];
const LADO_LAMINA = 26.2;

const ahoraS = () => performance.now() / 1000;

function avisar(detalle) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('angelita-viva:registro', { detail: { ...detalle, t: performance.now() } }));
}

function movimientoReducido() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function AngelitaViva({ estado = VOZ_REPOSO, nivelRef = null, frase = null, pausada = false, className = '' }) {
  const fuentesRef = useRef(null);
  const lienzoRef = useRef(null);
  const haloRef = useRef(null);
  const arbolesRef = useRef(null);
  const memRef = useRef({ estado, desde: ahoraS(), previo: null, nivel: 0, frase: null, alaFase: 0, alaFrec: 0 });
  const pintarRef = useRef(() => {});

  // Tinta: árbol pintable de cada pose, leído del SVG que AbejaLamina pintó.
  useLayoutEffect(() => {
    const raiz = fuentesRef.current;
    if (!raiz || typeof Path2D === 'undefined' || typeof DOMMatrix === 'undefined') return;
    const arboles = {};
    raiz.querySelectorAll('svg[data-pose]').forEach((svg) => { arboles[svg.getAttribute('data-pose')] = arbolDeSvg(svg); });
    arbolesRef.current = arboles;
  }, []);

  // Cambio de estado: el anterior queda como «previo» para la transición.
  useEffect(() => {
    const m = memRef.current;
    if (m.estado === estado) return;
    const t = ahoraS();
    m.previo = { estado: m.estado, desde: m.desde, frase: m.frase };
    m.estado = estado;
    m.desde = t;
    m.frase = null;
    avisar({ tipo: 'estado', estado, gesto: gestoVisible(m, t) });
    pintarRef.current();
  }, [estado]);

  // Cada frase del TTS dispara su gesto al instante en que suena.
  useEffect(() => {
    if (!frase) return;
    const m = memRef.current;
    m.frase = { indice: frase.indice, t: ahoraS() };
    avisar({ tipo: 'frase', indice: frase.indice, total: frase.total, gesto: gestoDeFrase(frase.indice) });
    pintarRef.current();
  }, [frase]);

  useEffect(() => {
    const lienzo = lienzoRef.current;
    const c = lienzo?.getContext?.('2d');
    if (!c) return undefined;
    let raf = 0;
    let previoT = ahoraS();
    let muestra = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const cuadro = () => {
      const m = memRef.current;
      const t = ahoraS();
      const dt = Math.min(.1, t - previoT);
      previoT = t;
      const nivel = Math.max(0, Math.min(1, nivelRef?.current || 0));
      m.nivel = nivel;
      m.alaFase += dt * m.alaFrec;
      haloRef.current?.style.setProperty('--nivel', nivel.toFixed(3));
      const w = lienzo.clientWidth, h = lienzo.clientHeight;
      if (!w || !h) return;
      if (lienzo.width !== Math.round(w * dpr) || lienzo.height !== Math.round(h * dpr)) {
        lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr);
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const B = cuerpoEn(t, m);
      m.alaFrec = B.alaFrec;
      if (arbolesRef.current) {
        const escala = Math.min(w, h) / (LADO_LAMINA * 1.08);
        pintarAbeja(c, arbolesRef.current, B, { x: w / 2, y: h / 2, escala });
      }
      if ((/** @type {Window & {__angelitaVivaDiag?: boolean}} */ (window)).__angelitaVivaDiag && t - muestra >= .1) {
        muestra = t;
        avisar({ tipo: 'nivel', nivel: +nivel.toFixed(4), estado: m.estado });
      }
    };
    pintarRef.current = cuadro;

    const quieta = pausada || movimientoReducido();
    if (quieta) { cuadro(); return () => { pintarRef.current = () => {}; }; }
    const paso = () => { cuadro(); raf = requestAnimationFrame(paso); };
    raf = requestAnimationFrame(paso);
    return () => { cancelAnimationFrame(raf); pintarRef.current = () => {}; };
  }, [nivelRef, pausada]);

  return (
    <div className={`angelita-viva ${className}`} data-estado={estado} data-testid="angelita-viva">
      <div className="angelita-viva__halo" ref={haloRef} aria-hidden="true" />
      <canvas className="angelita-viva__lienzo" ref={lienzoRef} role="img" aria-label={`Angelita, ${estado}`} />
      <div className="angelita-viva__fuentes" ref={fuentesRef} hidden aria-hidden="true">
        {POSES.map((pose) => <AbejaLamina key={pose} pose={pose} size={600} title="" visema={undefined} tier={undefined} />)}
      </div>
    </div>
  );
}
