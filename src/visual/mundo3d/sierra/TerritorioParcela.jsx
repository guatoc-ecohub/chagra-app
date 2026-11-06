import { useState } from 'react';
import { MSG } from '../../../config/messages.js';
import { getProfile, saveProfile } from '../../../services/userProfileService.js';
import './territorioParcela.css';

const ORIENTACIONES = ['Norte', 'Nororiente', 'Oriente', 'Suroriente', 'Sur', 'Suroccidente', 'Occidente', 'Noroccidente'];
const PENDIENTES = ['Suave', 'Moderada', 'Fuerte'];

export default function TerritorioParcela({ msnm, pisoNombre, onDeclaracionChange }) {
  const [perfil, setPerfil] = useState(() => getProfile() || {});
  const [mensaje, setMensaje] = useState('');
  function guardar(event) {
    event.preventDefault();
    const datos = new FormData(event.currentTarget);
    const parcial = {
      finca_orientacion_ladera: datos.get('orientacion'),
      finca_pendiente_aproximada: datos.get('pendiente'),
    };
    saveProfile(parcial);
    const guardado = getProfile();
    if (Object.entries(parcial).every(([clave, valor]) => guardado?.[clave] === valor)) {
      setPerfil(guardado);
      onDeclaracionChange?.(parcial);
      setMensaje('Declaración guardada en este dispositivo.');
    } else setMensaje(MSG.territorioSierra.errorGuardar);
  }
  const tieneDeclaracion = Boolean(perfil.finca_orientacion_ladera || perfil.finca_pendiente_aproximada);
  const declaracion = [
    perfil.finca_orientacion_ladera && `orientación ${perfil.finca_orientacion_ladera.toLowerCase()}`,
    perfil.finca_pendiente_aproximada && `pendiente ${perfil.finca_pendiente_aproximada.toLowerCase()}`,
  ].filter(Boolean).join(' y ');
  return <section className="vsierra-territorio" aria-label="Territorio de la parcela">
    <p>{Number.isFinite(msnm)
      ? `La curva «a la altura de su finca» sitúa sus ${Math.round(msnm).toLocaleString('es-CO')} m en el esquema. El panel muestra ${pisoNombre}.`
      : `El panel muestra ${pisoNombre}. Sin altitud confirmada no se sitúa su finca.`}</p>
    {tieneDeclaracion && <p className="vsierra-territorio__reconocida" data-testid="declaracion-reconocida">
      Declaración reconocida: <strong>{declaracion}</strong>. El consejo de agua se calculó con esta información declarada por usted.
    </p>}
    <details>
    <summary>{tieneDeclaracion ? 'Cambiar orientación o pendiente' : 'Declarar orientación y pendiente'}</summary>
    <p>Relieve ilustrativo: la curva indica altura, no la ubicación real de su parcela. Los consejos del panel no se calculan con esta ladera dibujada.</p>
    <form onSubmit={guardar}>
      <label>¿Hacia dónde baja principalmente su ladera?
        <select name="orientacion" defaultValue={perfil.finca_orientacion_ladera || ''}>
          <option value="">No sé / sin declarar</option>
          {ORIENTACIONES.map(valor => <option key={valor}>{valor}</option>)}
        </select>
      </label>
      <label>{MSG.territorioSierra.pendiente}
        <select name="pendiente" defaultValue={perfil.finca_pendiente_aproximada || ''}>
          <option value="">No sé / sin declarar</option>
          {PENDIENTES.map(valor => <option key={valor}>{valor}</option>)}
        </select>
      </label>
      <p>Datos opcionales declarados por usted. No son una medición ni ajustan el pronóstico o el riego.</p>
      <button type="submit">{MSG.territorioSierra.guardar}</button>
      <p role="status">{mensaje}</p>
    </form>
    </details>
  </section>;
}
