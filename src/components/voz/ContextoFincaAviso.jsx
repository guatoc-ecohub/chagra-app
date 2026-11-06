/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Copy visible de la ventana de voz, pendiente de messages.js. */
import { useEffect, useState } from 'react';
import { MapPin, Sprout } from 'lucide-react';
import { getProfile } from '../../services/userProfileService';

function tieneAltitud(perfil) {
  const valor = Number(perfil?.finca_altitud ?? perfil?.altitud);
  return Number.isFinite(valor) && valor >= 0;
}

function tieneMatas(perfil) {
  return typeof perfil?.cultivos_actuales === 'string' && perfil.cultivos_actuales.trim().length > 0;
}

export default function ContextoFincaAviso() {
  const [perfil, setPerfil] = useState(() => getProfile());

  useEffect(() => {
    const actualizar = () => setPerfil(getProfile());
    window.addEventListener('chagra:profile-changed', actualizar);
    window.addEventListener('chagra:location-updated', actualizar);
    window.addEventListener('chagra:roster-changed', actualizar);
    return () => {
      window.removeEventListener('chagra:profile-changed', actualizar);
      window.removeEventListener('chagra:location-updated', actualizar);
      window.removeEventListener('chagra:roster-changed', actualizar);
    };
  }, []);

  const altitud = tieneAltitud(perfil);
  const matas = tieneMatas(perfil);
  if (altitud && matas) return null;

  const texto = !altitud && !matas
    ? 'Todavía no tengo registrada la altitud ni las matas de su finca. No voy a adivinarlas.'
    : !altitud
      ? 'Todavía no tengo registrada la altitud de su finca. No voy a adivinarla.'
      : 'Todavía no tengo registradas las matas de su finca. No voy a adivinarlas.';

  return (
    <div className="voz-finca-aviso" aria-label="Datos de la finca pendientes">
      <p className="voz-finca-aviso__titulo">Para leer mejor su finca</p>
      <p className="voz-finca-aviso__texto">{texto}</p>
      <div className="voz-finca-aviso__acciones">
        {!altitud ? <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('chagra:nav', { detail: 'perfil' }))}>
          <MapPin size={16} aria-hidden="true" /> Registrar altitud
        </button> : null}
        {!matas ? <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('chagra:nav', { detail: 'activos' }))}>
          <Sprout size={16} aria-hidden="true" /> Registrar matas
        </button> : null}
      </div>
    </div>
  );
}
