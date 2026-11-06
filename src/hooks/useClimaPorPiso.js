import { useEffect, useMemo, useState } from 'react';
import { fetchClimaPorPiso, normalizarClimaPorPiso } from '../services/climaPorPisoService.js';

/** Hook reactivo del contrato de clima por piso. No rellena ausencias. */
export function useClimaPorPiso(piso, finca = null) {
    const inicial = useMemo(() => normalizarClimaPorPiso({ piso, finca }), [piso, finca]);
    const clave = useMemo(() => JSON.stringify([piso, finca]), [piso, finca]);
    const [resultado, setResultado] = useState(() => ({ clave, valor: inicial }));

    useEffect(() => {
        let activo = true;
        fetchClimaPorPiso({ piso, finca }).then((siguiente) => {
            if (activo) setResultado({ clave, valor: siguiente });
        });
        return () => { activo = false; };
    }, [piso, finca, clave]);

    return resultado.clave === clave ? resultado.valor : inicial;
}

export default useClimaPorPiso;
