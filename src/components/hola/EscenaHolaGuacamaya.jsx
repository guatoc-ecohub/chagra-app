import React, { useEffect, useState } from 'react';
import ChagraAgentAvatarGuacamaya from '../ChagraAgentAvatarGuacamaya';
import '../../styles/hola-chagra.css';
import CapaViva from './viva/CapaViva';

function usePrefiereQuietud() {
  const [quieto, setQuieto] = useState(() => (
    typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event) => setQuieto(event.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  return quieto;
}

function MundoGuacamaya() {
  return (
    <div className="hc-mundo" aria-hidden="true">
      <div className="hc-cielo" />
      <div className="hc-alba" />
      <svg className="hc-cordillera" viewBox="0 0 430 150" preserveAspectRatio="none" focusable="false">
        <path
          fill="currentColor"
          d="M0 118 C 28 104 44 78 70 76 C 96 74 108 96 132 92 C 160 88 172 54 204 50 C 236 46 250 72 278 74 C 306 76 320 44 350 40 C 380 36 398 66 430 62 L 430 150 L 0 150 Z"
        />
      </svg>
      <div className="hc-bruma" />
      <svg className="hc-dosel" viewBox="0 0 430 170" preserveAspectRatio="none" focusable="false">
        <path
          className="hc-dosel-hondo"
          fill="currentColor"
          d="M0 96 C 20 70 46 62 70 74 C 90 52 122 48 142 68 C 158 40 196 36 214 62 C 232 44 262 46 278 66 C 296 42 330 40 350 62 C 372 48 404 52 430 78 L 430 170 L 0 170 Z"
        />
        <path
          fill="currentColor"
          d="M0 126 C 24 104 52 100 74 112 C 92 92 126 90 146 108 C 164 84 200 82 218 104 C 238 88 270 90 288 108 C 306 86 342 84 362 106 C 384 94 412 98 430 116 L 430 170 L 0 170 Z"
        />
      </svg>
    </div>
  );
}

export default function EscenaHolaGuacamaya({
  estado = 'acompana',
  mensaje = null,
  variante = 'amplia',
  nombreCompai = 'La guacamaya',
  children = null,
}) {
  const quieto = usePrefiereQuietud();
  void mensaje;

  return (
    <>
      <MundoGuacamaya />
      <section className="hc-hero" aria-labelledby="hc-titulo" data-estado={estado} data-variante={variante}>
        <div className="hc-saludo">
          <p className="hc-kicker anim-brota" style={{ '--i': 1 }}>Hola, soy la guacamaya</p>
          <h1 id="hc-titulo" className="hc-titulo anim-brota" style={{ '--i': 2 }}>
            Qué bueno que llegó.
          </h1>
          <p className="hc-lema anim-brota" style={{ '--i': 3 }}>
            Esta chagra es suya. Cuénteme de usted y arrancamos. Todo se puede saltar.
          </p>
        </div>
        <div className={`hc-ave${quieto ? '' : ' hc-llega'}`} data-testid="onb2-guacamaya">
          <ChagraAgentAvatarGuacamaya
            size={385}
            state="idle"
            reducedMotion={quieto}
            ariaLabel={`${nombreCompai}, la compai que le da la bienvenida`}
          />
        </div>
        <CapaViva compai="guacamaya" />
      </section>
      <div className="hc-tarjeta anim-brota" style={{ '--i': 4 }}>
        {children}
      </div>
    </>
  );
}
