import { useEffect, useMemo, useState } from 'react';
import { explicacionDePantalla } from '../services/compaiExplicaPantallas.js';
import { registrarParadas, desregistrarParadas } from '../services/compaiParadasPorPantalla.js';
import useAngelitaStore from '../store/useAngelitaStore.js';

/** Usa la parada de la guía existente sin montar otro compañero ni otro aviso. */
export default function useCompaiDescensoPantalla(pantalla, activo = true) {
  const explicacion = explicacionDePantalla(pantalla);
  const [destino, setDestino] = useState(null);
  useEffect(() => {
    if (!explicacion?.descenso) return undefined;
    const buscar = () => {
      const boton = document.querySelector('button[aria-label^="Abrir descenso:"]');
      setDestino((actual) => actual?.pantalla === pantalla && actual?.boton === boton
        ? actual : boton ? { pantalla, boton } : null);
    };
    buscar();
    const observer = new MutationObserver(buscar);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pantalla, explicacion]);
  const boton = destino?.pantalla === pantalla ? destino.boton : null;
  const paradas = useMemo(() => boton && explicacion?.descenso ? [{
    id: 'ver-descenso', ref: () => boton, gesto: 'senala', texto: explicacion.texto,
  }] : [], [boton, explicacion]);
  useEffect(() => {
    if (!paradas.length) return undefined;
    const id = `descenso:${pantalla}`;
    registrarParadas(id, paradas);
    return () => desregistrarParadas(id);
  }, [pantalla, paradas]);
  const [enVista, setEnVista] = useState(false);
  useEffect(() => {
    if (!boton || !activo) return undefined;
    boton.setAttribute('data-compai-reserva', 'true');
    const actualizar = () => {
      const rect = boton.getBoundingClientRect();
      const visible = rect.top >= 0 && rect.bottom + 96 < window.innerHeight;
      setEnVista(visible);
      const anterior = useAngelitaStore.getState().destinoCompai;
      const siguiente = visible ? { x: rect.left, y: rect.bottom + 12, direccion: 'derecha', gesto: 'senala', origen: 'descenso', objetivo: boton } : null;
      if (anterior?.x !== siguiente?.x || anterior?.y !== siguiente?.y || anterior?.objetivo !== siguiente?.objetivo) {
        useAngelitaStore.getState().publicarDestinoCompai(siguiente);
      }
    };
    actualizar();
    window.addEventListener('resize', actualizar);
    window.addEventListener('scroll', actualizar, true);
    const observer = new ResizeObserver(actualizar);
    observer.observe(boton);
    let frame;
    const mutations = new MutationObserver((records) => {
      if (!records.some((r) => !r.target.parentElement?.closest('[data-compai-draggable]'))) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(actualizar);
    });
    mutations.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      mutations.disconnect();
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', actualizar);
      window.removeEventListener('scroll', actualizar, true);
      boton.removeAttribute('data-compai-reserva');
      boton.style.removeProperty('--compai-reserva');
      if (useAngelitaStore.getState().destinoCompai?.objetivo === boton) useAngelitaStore.getState().publicarDestinoCompai(null);
    };
  }, [boton, activo]);
  return { boton, visible: Boolean(boton) && activo, enVista };

}
