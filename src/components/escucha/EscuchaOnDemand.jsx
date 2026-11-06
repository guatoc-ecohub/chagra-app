import React, { Suspense, useEffect, useRef, useState } from 'react';
import { lazy } from '../common/lazyWithRecovery';
import { activarEscucha, onEscucha } from '../../services/escuchaService';

const Overlay = lazy(async () => {
  const { default: Original } = await import('./EscuchaOverlay.jsx');
  return { default: function Ready({ activation }) {
    return <ActivatedOverlay activation={activation}><Original /></ActivatedOverlay>;
  } };
});

function ActivatedOverlay({ activation, children }) {
  const replayed = useRef(false);
  // Child effects install the existing listener before this activation is replayed.
  useEffect(() => {
    if (replayed.current) return;
    replayed.current = true;
    activarEscucha(activation);
  }, [activation]);
  return children;
}

export default function EscuchaOnDemand() {
  const [activation, setActivation] = useState(null);
  useEffect(() => onEscucha(detail => setActivation(current => current || detail)), []);
  if (!activation) return null;
  return <Suspense fallback={null}><Overlay activation={activation} /></Suspense>;
}
