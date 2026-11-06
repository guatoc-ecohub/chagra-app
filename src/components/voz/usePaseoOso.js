import { useEffect, useRef, useState } from 'react';

// Reposo, seis ciclos de paso, reposo, regreso. Reloj detenido al pausar.
const REPOSO = 1800;
const MARCHA = 9600;
const CICLO = (REPOSO + MARCHA) * 2;

export function usePaseoOso(pausado) {
  const caminanteRef = useRef(null);
  const reloj = useRef(0);
  const faseRef = useRef(false);
  const [camina, setCamina] = useState(false);

  useEffect(() => {
    if (pausado) return;
    let frame;
    let anterior;
    function avanzar(ahora) {
      if (anterior !== undefined) reloj.current += Math.min(ahora - anterior, 100);
      anterior = ahora;
      const t = reloj.current % CICLO;
      const vuelta = t >= REPOSO + MARCHA;
      const tramo = t % (REPOSO + MARCHA);
      const andando = tramo >= REPOSO;
      const avance = Math.max(0, (tramo - REPOSO) / MARCHA);
      const posicion = vuelta ? 1 - avance : avance;
      // El envoltorio traslada el esqueleto entero, incluidos bastón y sombra.
      caminanteRef.current?.style.setProperty('--recorrido', String(posicion));
      if (andando !== faseRef.current) {
        faseRef.current = andando;
        setCamina(andando);
      }
      frame = requestAnimationFrame(avanzar);
    }
    frame = requestAnimationFrame(avanzar);
    return () => cancelAnimationFrame(frame);
  }, [pausado]);

  return { caminanteRef, camina };
}
