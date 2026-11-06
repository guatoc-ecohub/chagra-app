import { lazy, memo, Suspense } from 'react';
const OsoBastonRig = lazy(() => import('../../visual/creatures/OsoBaston.jsx').then((m) => ({ default: m.OsoBastonRig })));
import { useLipSync } from '../../visual/creatures/useLipSync.js';
import {
  VOZ_REPOSO, VOZ_ESCUCHANDO, VOZ_PENSANDO, VOZ_HABLANDO, VOZ_ERROR,
} from '../../constants/estadosVoz.js';
import './oso-voz.css';

/* La ventana DIRIGE LOS HUESOS del oso; su dibujo no se toca.
   Cada estado es una postura distinta, no el mismo cuadro con otro rótulo:
   el oso descansa, se planta atento, se recoge a pensar, articula al hablar
   y resopla cuando algo falla. La vida propia (respiración, parpadeo, mirada)
   va PRENDIDA — apagarla dejaba una calcomanía quieta. */
const ACTUACION = {
  [VOZ_REPOSO]:     { pose: 'reposo', energia: 0.7,  modo: 'normal' },
  [VOZ_ESCUCHANDO]: { pose: 'anda',   energia: 1.15, modo: 'normal' },
  [VOZ_PENSANDO]:   { pose: 'anda',   energia: 0.85, modo: 'normal' },
  [VOZ_HABLANDO]:   { pose: 'anda',   energia: 1,    modo: 'actuando' },
  [VOZ_ERROR]:      { pose: 'reposo', energia: 0.6,  modo: 'normal', resopla: true },
};

const OsoVoz = memo(/** @param {{estado?: string, className?: string, title?: string, florece?: boolean, reducedMotion?: boolean, hablandoExterno?: boolean}} props */ function OsoVoz({ estado = VOZ_REPOSO, className = '', title = 'Oso andino de anteojos con su bastón florecido', florece = false, reducedMotion = false, hablandoExterno }) {
  const { visema } = useLipSync({ activo: estado === VOZ_HABLANDO, hablandoExterno });
  const act = ACTUACION[estado] || ACTUACION[VOZ_REPOSO];
  return (
    <div className={`oso-voz ${className}`.trim()} data-estado={estado}>
      <span className="oso-voz-suelo" />
      <Suspense fallback={<span className="oso-voz-rig-fallback" aria-hidden="true" />}><OsoBastonRig
        size={260}
        reducedMotion={reducedMotion}
        pose={act.pose}
        modo={act.modo}
        energia={act.energia}
        resopla={act.resopla || false}
        florece={florece || estado === VOZ_HABLANDO}
        title={title}
        vida
        lineBoil
        visema={estado === VOZ_HABLANDO ? visema : null}
      /></Suspense>
    </div>
  );
});
export default OsoVoz;
