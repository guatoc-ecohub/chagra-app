import React, { useEffect, useState } from 'react';
import ChagraAgentAvatar from './ChagraAgentAvatar';
import { onboardingExtendidoActivo } from '../config/onboardingExtendidoFlag';
import { leerRecorridoExtendido, ONBOARDING_EXTENDIDO_EVENT } from '../services/onboardingExtendidoService';
import './onboardingExtendidoHomeCard.css';

export default function OnboardingExtendidoHomeCard({ onNavigate }) {
  const [recorrido, setRecorrido] = useState(leerRecorridoExtendido);

  useEffect(() => {
    const actualizar = () => setRecorrido(leerRecorridoExtendido());
    window.addEventListener(ONBOARDING_EXTENDIDO_EVENT, actualizar);
    window.addEventListener('storage', actualizar);
    return () => {
      window.removeEventListener(ONBOARDING_EXTENDIDO_EVENT, actualizar);
      window.removeEventListener('storage', actualizar);
    };
  }, []);

  if (!onboardingExtendidoActivo() || !recorrido) return null;
  const pendiente = recorrido.current === 'offer'
    ? 'primer registro'
    : recorrido.current === 'animal'
      ? 'su lote de animales'
      : 'su planta';

  return (
    <section className="onbe-home-card" aria-label="Retomar su primer registro" data-testid="onbe-home-card">
      <div className="onbe-home-avatar"><ChagraAgentAvatar especie={recorrido.compai || 'angelita'} size={56} estado="acompana" ariaLabel="Su compai le espera" /></div>
      <div className="onbe-home-copy"><strong>Termine su primer registro</strong><span>Retome donde iba: {pendiente}.</span></div>
      <button type="button" onClick={() => onNavigate?.('onboarding-extendido')} data-testid="onbe-retomar">Retomar</button>
    </section>
  );
}
