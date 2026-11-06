import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { biomaPara } from './paisajeSonoro';
import {
  abrirMicrofono,
  alEvento,
  alLatido,
  alNivel,
  alternarSilencio,
  anotarLatidoPintado,
  apagarTodo,
  COLOR_ESTADO,
  instalarArranquePorGesto,
  leerEstado,
  suscribir,
  usarBioma,
} from './holaViva';
import './capaViva.css';

function useEstadoViva() {
  return useSyncExternalStore(suscribir, leerEstado, leerEstado);
}

function prefiereQuietud() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function Ave() {
  return (
    <svg viewBox="0 0 40 20" className="cv-ave-cuerpo" aria-hidden="true" focusable="false">
      <path className="cv-ala cv-ala--izq" d="M20 11 C 15 4 8 3 1 7 C 8 7 14 9 20 13 Z" />
      <path className="cv-ala cv-ala--der" d="M20 11 C 25 4 32 3 39 7 C 32 7 26 9 20 13 Z" />
      <ellipse cx="20" cy="12" rx="3.2" ry="2" />
    </svg>
  );
}

/**
 * CapaViva — la vida alrededor del compai: halo por estado de voz, latido por
 * frase del TTS, y el espejo visual del paisaje sonoro (ave, abeja, racha).
 *
 * Va DESPUÉS del compai en el DOM y DEBAJO por z-index: el dibujo del compai
 * no cambia ni un byte (ver __tests__/compaiIntacto.test.jsx). Nada se mueve
 * sin un dato: sin sonido, sin voz y sin frase, la capa está quieta.
 */
export default function CapaViva({ compai }) {
  const raiz = useRef(null);
  const { voz } = useEstadoViva();
  const [latidos, setLatidos] = useState([]);
  const [pasos, setPasos] = useState([]);

  useEffect(() => {
    usarBioma(biomaPara(compai));
  }, [compai]);

  useEffect(() => alNivel((nivel) => {
    raiz.current?.style.setProperty('--cv-nivel', nivel.toFixed(3));
  }), []);

  useEffect(() => alLatido((info) => {
    setLatidos((l) => [...l.slice(-2), { id: `${info.indice}-${info.t}`, info }]);
    requestAnimationFrame(() => anotarLatidoPintado(info));
  }), []);

  useEffect(() => alEvento((e) => {
    if (prefiereQuietud()) return;
    const id = `${e.tipo}-${e.t}`;
    if (e.tipo === 'racha') {
      const escena = raiz.current?.closest('[data-testid="hola-escena"]');
      escena?.style.setProperty('--cv-racha-dura', `${e.dura}s`);
      escena?.setAttribute('data-racha', id);
      setTimeout(() => {
        if (escena?.getAttribute('data-racha') === id) escena.removeAttribute('data-racha');
      }, e.dura * 1000);
      return;
    }
    setPasos((p) => [...p, { id, ...e }]);
    setTimeout(() => setPasos((p) => p.filter((x) => x.id !== id)), e.dura * 1000 + 100);
  }), []);

  const quitarLatido = (id) => setLatidos((l) => l.filter((x) => x.id !== id));

  return (
    <div
      ref={raiz}
      className="capa-viva"
      data-compai={compai}
      data-voz={voz}
      data-testid="hola-capa-viva"
      style={{ '--cv-color': COLOR_ESTADO[voz] || COLOR_ESTADO.reposo }}
      aria-hidden="true"
    >
      <span className="cv-halo" />
      {latidos.map(({ id }) => (
        <span key={id} className="cv-latido" data-testid="hola-latido" onAnimationEnd={() => quitarLatido(id)} />
      ))}
      {pasos.map((p) => (
        <span
          key={p.id}
          className={p.tipo === 'ave' ? 'cv-ave' : 'cv-abeja'}
          data-desde={p.desde}
          data-testid={`hola-${p.tipo}`}
          style={{ '--cv-dura': `${p.dura}s` }}
        >
          {p.tipo === 'ave' ? <Ave /> : <span className="cv-abeja-cuerpo" />}
        </span>
      ))}
    </div>
  );
}

/**
 * ControlesHola — silencio del paisaje (siempre visible, se recuerda) y
 * «Háblele» (pide micrófono solo al tocarlo). Montado por el onboarding en el
 * paso 0; instala el arranque del paisaje por gesto y lo apaga al salir.
 */
export function ControlesHola() {
  const { silencio, microfono, voz } = useEstadoViva();

  useEffect(() => {
    const quitar = instalarArranquePorGesto();
    return () => { quitar(); apagarTodo(); };
  }, []);

  return (
    <div className="cv-controles" style={{ '--cv-color': COLOR_ESTADO[voz] || COLOR_ESTADO.reposo }}>
      <button
        type="button"
        className="cv-boton"
        data-hola-silencio
        aria-pressed={silencio}
        aria-label={silencio ? 'Activar el sonido del paisaje' : 'Silenciar el sonido del paisaje'}
        onClick={() => alternarSilencio()}
        data-testid="hola-silencio"
      >
        {silencio ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
      </button>
      <button
        type="button"
        className="cv-boton cv-boton--hablar"
        aria-pressed={microfono}
        aria-label={microfono ? 'Dejar de escuchar' : 'Háblele a su compai'}
        onClick={() => abrirMicrofono()}
        data-testid="hola-hablele"
      >
        {microfono ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
      </button>
    </div>
  );
}
