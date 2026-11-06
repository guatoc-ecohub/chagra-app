import { useEffect, useRef, useState } from 'react';

/**
 * useInteraccionUsuario — señal de "el usuario está usando la pantalla AHORA".
 *
 * Escucha actividad global (puntero, scroll, tacto, teclado) y devuelve
 * `interactuando=true` mientras haya habido actividad reciente; vuelve a
 * `false` tras `quietMs` de quietud. Es la base de la política dura del compai
 * (POLITICA-COMPAI-COMPORTAMIENTO-2D-3D.md):
 *   - R2 "se quita al interactuar": el compai se oculta cuando interactuando=true.
 *   - R3 "enseña en idle": el compai enseña cuando interactuando=false.
 *
 * Al MONTAR arranca en `false` (el usuario acaba de llegar a la pantalla y aún
 * no la toca) → el compai puede enseñar de una. Las escuchas son `passive` para
 * no frenar el scroll, y sólo re-renderiza en las TRANSICIONES quieto↔activo
 * (no en cada `pointermove`).
 *
 * `onActividad(ts)` (opcional, 2026-09-23) se llama en CADA señal con el
 * `performance.now()` del evento, sin re-render: así quien necesite MEDIR la
 * inactividad (el reposo de Angelita escala con ella) la lee de un ref, y quien
 * necesite cortar un gesto al primer toque lo hace en el mismo evento, sin
 * esperar al render.
 *
 * @param {number} [quietMs=3500]
 * @param {{ onActividad?: (ts:number) => void, activo?: boolean }} [opts]
 *   `activo=false` no escucha nada (el hook queda inerte y en `false`).
 * @returns {boolean} interactuando
 */
export default function useInteraccionUsuario(quietMs = 3500, { onActividad, activo = true } = {}) {
  const [interactuando, setInteractuando] = useState(false);
  const timerRef = useRef(null);
  const activoRef = useRef(false);
  const onActividadRef = useRef(onActividad);
  useEffect(() => { onActividadRef.current = onActividad; }, [onActividad]);

  useEffect(() => {
    if (!activo) return undefined;
    const marcarQuieto = () => {
      activoRef.current = false;
      setInteractuando(false);
    };
    const marcarActivo = () => {
      onActividadRef.current?.(typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (!activoRef.current) {
        activoRef.current = true;
        setInteractuando(true);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(marcarQuieto, quietMs);
    };

    const eventos = ['mouseover', 'pointerdown', 'pointermove', 'wheel', 'touchstart', 'touchmove', 'keydown', 'scroll'];
    const opts = { passive: true, capture: true };
    eventos.forEach((ev) => window.addEventListener(ev, marcarActivo, opts));

    return () => {
      eventos.forEach((ev) => window.removeEventListener(ev, marcarActivo, opts));
      if (timerRef.current) clearTimeout(timerRef.current);
      // Sin escucha no hay timer que lo devuelva a quieto: se suelta aquí, o
      // al reactivarse quedaría «interactuando» para siempre.
      if (activoRef.current) {
        activoRef.current = false;
        setInteractuando(false);
      }
    };
  }, [quietMs, activo]);

  return interactuando;
}
