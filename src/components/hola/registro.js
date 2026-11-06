import React, { lazy } from 'react';

const ESCENAS = {
  angelita: lazy(() => import('./EscenaHolaAngelita.jsx')),
  guacamaya: lazy(() => import('./EscenaHolaGuacamaya.jsx')),
  jaguar: lazy(() => import('./EscenaHolaJaguar.jsx')),
  'oso-baston': lazy(() => import('./EscenaHolaOsoBaston.jsx')),
};

export const ESCENA_FALLBACK = 'angelita';

export function slugCompaiElegido() {
  try {
    return localStorage.getItem('compai:companero')
      || localStorage.getItem('chagra:agent-avatar-type')
      || ESCENA_FALLBACK;
  } catch {
    return ESCENA_FALLBACK;
  }
}

export function escenaHolaPara(slug) {
  return ESCENAS[slug] || ESCENAS[ESCENA_FALLBACK];
}

export function EscenaHolaRegistrada(props) {
  const slug = slugCompaiElegido();
  const Escena = escenaHolaPara(slug);
  return React.createElement(Escena, props);
}

export default ESCENAS;
