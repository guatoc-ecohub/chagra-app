import CompaiScenePresence from '../../../components/CompaiScenePresence.jsx';
/*
 * CompaiEscena — EL COMPAÑERO DEL MUNDO 3D, SEGÚN EL AVATAR QUE EL USUARIO ELIGIÓ.
 *
 * Drop-in de AbejaEscena (mismas props). Cierra el bug "oso→abeja": antes el
 * mundo montaba SIEMPRE a Angelita; ahora consulta el avatar elegido
 * (useCompaiElegido) y monta la escena propia del compañero si la tiene. Los
 * siete tipos canónicos están registrados; Angelita conserva `AbejaEscena`
 * como adaptador nativo y como fallback seguro para tipos desconocidos.
 *
 * Vive en escenas/ (chunk perezoso vendor-three): AbejaEscena arrastra
 * @react-three, así que este archivo NUNCA se importa desde el barrel base.
 */
import { AbejaEscena } from './useEntradaAbeja.jsx';
import useCompaiElegido from './useCompaiElegido.js';

/**
 * @param {object} props  las MISMAS de AbejaEscena (foco, entrando, hablando,
 *   rebote, animo, energia, estadoFinca, hayAlerta, reducedMotion, piso, tier,
 *   mundoId, viajeRef, ...). Se pasan tal cual al compañero resuelto.
 */
export function CompaiEscena(props) {
  const compai = useCompaiElegido();
  if (compai.EscenaComponent) {
    const Escena = compai.EscenaComponent;
    return <CompaiScenePresence><Escena {...props} compai={compai} /></CompaiScenePresence>;
  }
  // Angelita nativa o fallback seguro para un tipo desconocido.
  return <CompaiScenePresence><AbejaEscena {...props} /></CompaiScenePresence>;
}
