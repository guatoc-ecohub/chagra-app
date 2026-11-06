import CompaiScenePresence from '../../../components/CompaiScenePresence.jsx';
/*
 * CompaiTransicion — el portal 2D→3D del compañero elegido.
 *
 * La coreografía y el timing siguen siendo los del portal existente. Este
 * dispatcher solo consulta el registro avatar-aware y le entrega al portal el
 * cuerpo 2D correspondiente. La selección del portal es independiente de la
 * escena 3D: Angelita es fallback únicamente cuando el dato recibido es
 * inválido o no tiene un cuerpo registrado.
 */
/* eslint-disable react-refresh/only-export-components -- el helper puro se
   prueba junto al dispatcher que define el contrato de selección del portal. */
import AbejaTransicion from '../../creatures/AbejaTransicion.jsx';
import { AbejaLaminaRig } from '../../creatures/AbejaLaminaRig.jsx';
import useCompaiElegido from './useCompaiElegido.js';

export function cuerpoPortalDe(compai) {
  return compai?.PortalComponent || AbejaLaminaRig;
}

export default function CompaiTransicion(props) {
  const compai = useCompaiElegido();
  const Cuerpo = cuerpoPortalDe(compai);
  return <CompaiScenePresence><AbejaTransicion {...props} Cuerpo={Cuerpo} /></CompaiScenePresence>;
}
