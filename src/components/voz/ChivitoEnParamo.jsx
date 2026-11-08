import { memo, useEffect, useRef } from 'react';
import { ChivitoPunkRig } from '../../visual/creatures/ChivitoPunk';

const CuerpoChivito = memo(/** @param {{estado: string, pausada: boolean}} props */ function CuerpoChivito({ estado }) {
  return <ChivitoPunkRig x={-124.8} y={-193.44} size={249.6}
    className="paramo-chivito" estado={estado} pose="posado" />;
}, (anterior, siguiente) => siguiente.pausada || anterior.estado === siguiente.estado);

/** La trayectoria mueve el cuerpo entero; las articulaciones conservan sus padres. */
const ChivitoEnParamo = memo(/** @param {{estado: string, pausada: boolean}} props */ function ChivitoEnParamo({ estado, pausada }) {
  const soporte = useRef(null);

  useEffect(() => {
    // El rig también tiene iridiscencia SMIL, ajena a animation-play-state.
    const svg = soporte.current?.querySelector('svg');
    if (pausada) svg?.pauseAnimations?.();
    else svg?.unpauseAnimations?.();
  }, [pausada]);

  return (
    <g transform="translate(665 600)">
      <g className="paramo-salto" ref={soporte}>
        <g className="paramo-apoyo" aria-hidden="true"><ellipse rx="42" ry="9" /></g>
        {/* Pies del rig: y=143. Escala .48, origen a 68.64 unidades del apoyo. */}
        <g className="paramo-esfuerzo">
          <g className="paramo-respira">
            <CuerpoChivito estado={estado} pausada={pausada} />
          </g>
        </g>
      </g>
    </g>
  );
});

export default ChivitoEnParamo;
