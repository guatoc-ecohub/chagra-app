import { useEffect, useRef } from 'react';
import { vueloLuciernaga } from './vueloLuciernaga';

export function useVueloLuciernaga(pausada) {
  const escenaRef = useRef(null);
  const tiempoRef = useRef(0);

  useEffect(() => {
    const svg = escenaRef.current;
    const movimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pantalla = window.matchMedia('(max-width: 759px)');
    const cuerpo = svg.querySelector('.luci-viajera');
    const criatura = svg.querySelector('[data-creature]');
    const foco = svg.querySelector('[data-foco]');
    const reflejo = svg.querySelector('.luci-reflejo');
    const suelo = svg.querySelector('.luci-suelo-luz');
    const sombra = svg.querySelector('.luci-sombra-compai');
    const tallo = svg.querySelector('.luci-tallo');
    let frame;
    let anterior = null;

    function pintar() {
      const compacto = pantalla.matches;
      const p = vueloLuciernaga(movimiento.matches ? 0 : tiempoRef.current, compacto);
      svg.setAttribute('viewBox', compacto ? '380 0 450 560' : '0 0 1000 560');
      svg.style.setProperty('--luci-luz', p.luz);
      svg.style.setProperty('--luci-agua', p.agua);
      cuerpo.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${p.giro})`);
      criatura.setAttribute('data-pose', p.apoyo ? 'posa' : 'vuela');
      foco.setAttribute('cx', p.focoX);
      foco.setAttribute('cy', p.focoY);
      reflejo.setAttribute('transform', `translate(${p.focoX - 622} 0)`);
      suelo.setAttribute('cx', p.focoX);
      sombra.setAttribute('cx', p.x);
      sombra.setAttribute('cy', p.y + 76);
      sombra.setAttribute('opacity', p.apoyo === 'hoja' || p.apoyo === 'borde' ? '.65' : '0');
      const talloX = compacto ? 591 + (737 - 591) * .58 : 737;
      tallo.setAttribute('d', `M${talloX + 46} 460Q${talloX + 25} 295 ${talloX} 222`);
    }
    function avanzar(ahora) {
      if (anterior !== null) tiempoRef.current += Math.min(ahora - anterior, 64) / 1000 * 1.6;
      anterior = ahora;
      pintar();
      frame = requestAnimationFrame(avanzar);
    }
    function sincronizar() {
      cancelAnimationFrame(frame);
      anterior = null;
      pintar();
      if (!pausada && !movimiento.matches && !document.hidden) frame = requestAnimationFrame(avanzar);
    }
    sincronizar();
    movimiento.addEventListener('change', sincronizar);
    pantalla.addEventListener('change', sincronizar);
    document.addEventListener('visibilitychange', sincronizar);
    return () => {
      cancelAnimationFrame(frame);
      movimiento.removeEventListener('change', sincronizar);
      pantalla.removeEventListener('change', sincronizar);
      document.removeEventListener('visibilitychange', sincronizar);
    };
  }, [pausada]);

  return escenaRef;
}
