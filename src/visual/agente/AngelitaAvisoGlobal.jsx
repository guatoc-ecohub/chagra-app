import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import useAngelitaStore from '../../store/useAngelitaStore';
import { cajasDeTextoVisibles } from '../../components/AgentFab.jsx';
import BurbujaAngelita from './BurbujaAngelita.jsx';
import { duracionAviso } from './duracionAviso.js';
import './angelitaAvisoGlobal.css';

/**
 * <AngelitaAvisoGlobal> — la burbuja de Angelita, EN PRODUCCIÓN 2D (P5,
 * `documentación interna` +
 * `documentación interna` §R-D).
 *
 * Hasta ahora BurbujaAngelita (typewriter + color por tipo, `angelitaAvisoTipos`)
 * solo vivía en el mockup del valle (`mockups/valle/Valle3D.jsx`) y en
 * <AngelitaGuia> (paradas guiadas). Todo lo que el cerebro de Angelita decide
 * en prod 2D — alertas reales, clima vivo, susurro nocturno, agroecología,
 * celebra/luto (todo vía `useAngelitaStore`) — se degradaba a un GLOW en el
 * <AgentFab>: el mensaje YA ADAPTADO nunca se leía, solo brillaba. Este
 * componente cierra ese hueco.
 *
 * CERO CANAL PARALELO: no decide nada, no tiene su propio cooldown ni su
 * propio silencio — lee el store DIRECTO. El mensaje que pinta ya pasó la
 * anti-molestia completa de `angelitaInteligencia.resolverComportamiento`
 * (silencio 🔔, "hoy no", cooldown por llave, `ocupado`, contador de
 * molestia) ANTES de llegar a `useAngelitaStore.mensaje`. Si el usuario
 * silenció a Angelita (`silenciar(true)`), el store nunca vuelve a poner un
 * mensaje — y `silenciar` además llama `reposar()` de una, así que este
 * componente desaparece con el resto.
 *
 * Auto-dismiss: el aviso dura lo que cuesta LEERLO (`duracionAviso`, la misma
 * fórmula tuneada del husmeo autónomo del valle 3D — reexpuesta en
 * `BurbujaAngelita.jsx` para no reinventarla). Al vencer, `reposar()` — solo
 * borra el mensaje EN PANTALLA; la memoria anti-molestia (cooldowns,
 * silencio) no se toca.
 *
 * Cierre manual (×): el usuario puede cerrarlo antes de que se cumpla el
 * tiempo; también llama `reposar()`. No es "Callar hoy" (eso vive en el menú
 * compacto del FAB, pendiente aparte, R4 del diseño) — solo cierra ESTE aviso.
 *
 * MONTAJE: junto al <AgentFab>, en las MISMAS pantallas (mismo guard en
 * App.jsx) — sin el FAB visible el aviso queda huérfano (nadie a quien
 * atribuirle la voz).
 */
export default function AngelitaAvisoGlobal({ pantalla = null }) {
  const mensaje = useAngelitaStore((s) => s.mensaje);
  const tipo = useAngelitaStore((s) => s.tipo);
  const reposar = useAngelitaStore((s) => s.reposar);

  const timerRef = useRef(null);
  const avisoRef = useRef(null);
  const [puestoSeguro, setPuestoSeguro] = useState(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!mensaje) return undefined;
    timerRef.current = setTimeout(() => { reposar(); }, duracionAviso(mensaje));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // Solo `mensaje` — dos avisos IDÉNTICOS seguidos ya los veta el cooldown
    // del store (angelitaInteligencia); si de verdad llega otro, reiniciar el
    // reloj de lectura es lo correcto.
  }, [mensaje, reposar]);

  useLayoutEffect(() => {
    const aviso = avisoRef.current;
    if (!mensaje || !aviso) {
      setPuestoSeguro(null);
      return undefined;
    }
    const ubicarAviso = () => {
      const caja = aviso.getBoundingClientRect();
      if (caja.width < 1 || caja.height < 1) return;
      const ancho = window.innerWidth;
      const alto = window.innerHeight;
      const fab = document.querySelector('[data-compai-draggable]');
      const fabRect = fab?.getBoundingClientRect();
      const obstaculos = [
        ...cajasDeTextoVisibles(),
        ...(fabRect?.width && fabRect?.height ? [{
          left: fabRect.left,
          top: fabRect.top,
          right: fabRect.right,
          bottom: fabRect.bottom,
        }] : []),
      ];
      let mejor = null;
      for (let y = 8; y + caja.height <= alto - 8; y += 12) {
        for (let x = 8; x + caja.width <= ancho - 8; x += 12) {
          const candidata = { left: x, top: y, right: x + caja.width, bottom: y + caja.height };
          const choque = obstaculos.reduce((total, item) => {
            const anchoSolapado = Math.max(0, Math.min(candidata.right, item.right) - Math.max(candidata.left, item.left));
            const altoSolapado = Math.max(0, Math.min(candidata.bottom, item.bottom) - Math.max(candidata.top, item.top));
            return total + anchoSolapado * altoSolapado;
          }, 0);
          const distancia = Math.hypot(candidata.left - caja.left, candidata.top - caja.top);
          const puntuacion = choque * 1000 + distancia;
          if (!mejor || puntuacion < mejor.puntuacion) mejor = { left: x, top: y, puntuacion, choque };
        }
      }
      setPuestoSeguro(mejor && mejor.choque === 0 ? { left: mejor.left, top: mejor.top } : null);
    };
    ubicarAviso();
    const observador = new ResizeObserver(ubicarAviso);
    observador.observe(document.body);
    window.addEventListener('resize', ubicarAviso);
    window.addEventListener('scroll', ubicarAviso, true);
    return () => {
      observador.disconnect();
      window.removeEventListener('resize', ubicarAviso);
      window.removeEventListener('scroll', ubicarAviso, true);
    };
  }, [mensaje, pantalla]);

  if (!mensaje) return null;

  return (
    <div
      ref={avisoRef}
      className={`angelita-aviso-global${pantalla === 'clima_boletin' ? ' angelita-aviso-global--clima' : ''}`}
      aria-hidden={!puestoSeguro}
      style={puestoSeguro
        ? { top: `${puestoSeguro.top}px`, left: `${puestoSeguro.left}px`, right: 'auto', bottom: 'auto' }
        : { visibility: 'hidden' }}
    >
      <BurbujaAngelita
        mensaje={mensaje}
        tipo={tipo || 'informativa'}
        className="angelita-aviso-global__burbuja"
      />
      <button
        type="button"
        className="angelita-aviso-global__cerrar"
        aria-label="Cerrar el aviso de Angelita"
        onClick={reposar}
      >
        ×
      </button>
    </div>
  );
}
