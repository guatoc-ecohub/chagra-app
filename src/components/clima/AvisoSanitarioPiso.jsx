import React, { useMemo } from 'react';
import { ShieldAlert, Shield, ShieldCheck, HelpCircle } from 'lucide-react';
import { evaluarRiesgoSanitarioPiso } from '../../services/riesgoSanitarioPiso';
import { lecturaSanitaria } from './respuestasDelDia.js';

/**
 * AvisoSanitarioPiso — el riesgo de gota, mildeo o moho gris de la finca como
 * una fila más del veredicto: la respuesta corta y UNA frase con su acción.
 * Nombra un cultivo solo si está en el perfil; sin cultivos habla del riesgo
 * en el piso. La acción por enfermedad, el porqué, la confianza y las fuentes
 * van plegados: con varios cultivos la lista desplegada doblaba el alto de
 * Hoy. Las frases salen de `lecturaSanitaria` (respuestasDelDia.js).
 *
 * @param {{riesgo?:object, piso?:string, daily?:object[], hoy?:string, cultivos?:Array<string|object>|null, deNoche?:boolean}} props
 *   `riesgo` = salida de evaluarRiesgoSanitarioPiso; si falta, se calcula con
 *   `piso`, `daily` y `hoy`. `cultivos` = los del perfil.
 */

const ICONO = { alto: ShieldAlert, medio: Shield, bajo: ShieldCheck, sin_evaluar: HelpCircle };
// El color sigue la misma escala que las filas del veredicto.
const TONO = { alto: 'peligro', medio: 'aviso', bajo: 'bien', sin_evaluar: 'sin-dato' };

/** @typedef {{riesgo?: object, piso?: string, daily?: object[], hoy?: string, cultivos?: Array<string|object>|null, deNoche?: boolean}} AvisoSanitarioPisoProps */

/** @param {AvisoSanitarioPisoProps} props */
export default function AvisoSanitarioPiso({ riesgo, piso, daily, hoy, cultivos = null, deNoche = false }) {
    const r = useMemo(
        () => riesgo || evaluarRiesgoSanitarioPiso({ piso, daily, hoy }),
        [riesgo, piso, daily, hoy],
    );
    const lectura = lecturaSanitaria(r, { cultivos, piso, deNoche });
    const { nivel, detalle } = lectura;
    const Icon = ICONO[nivel] || HelpCircle;

    return (
        <div
            className="cl-veredicto__fila cl-sanitario"
            data-testid="aviso-sanitario-piso"
            data-nivel={nivel}
            data-tono={TONO[nivel] || 'sin-dato'}
            aria-live="polite"
        >
            <span className="cl-veredicto__marca" aria-hidden="true"><Icon size={18} /></span>
            <div className="min-w-0">
                <p className="cl-veredicto__cabeza">
                    <span className="cl-veredicto__pregunta">¿Hongos?</span>{' '}
                    <strong className="cl-veredicto__respuesta">{lectura.respuesta}</strong>
                </p>
                <p className="cl-veredicto__accion">{lectura.accion}</p>
                {lectura.sinMemoria && (
                    <p className="cl-veredicto__porque">{lectura.sinMemoria}</p>
                )}
                {detalle && (
                    <details className="cl-veredicto__mas" data-testid="aviso-sanitario-detalle">
                        <summary>{detalle.titulo}</summary>
                        {detalle.proteccion && <p className="cl-veredicto__porque" data-testid="aviso-sanitario-proteccion">{detalle.proteccion}</p>}
                        <ul className="cl-veredicto__porque" aria-label="Enfermedades y acciones">
                            {detalle.enfermedades.map((item) => (
                                <li key={item.enfermedad}>
                                    <p><strong>{item.nombre}</strong>, riesgo {item.nivel}: {item.accion}</p>
                                    <p>{item.porque}</p>
                                    <p>Confianza {item.confianza}.</p>
                                    {/* Las citas, con sus siglas, enlaces y nombres internos, para quien las coteja (W36, M3 de la v15). */}
                                    <details className="mt-1 text-xs leading-tight text-slate-500">
                                        <summary className="flex items-center">Para técnicos</summary>
                                        <p>Fuentes: {item.fuente}</p>
                                    </details>
                                </li>
                            ))}
                        </ul>
                        {/* De dónde sale el nivel, una sola vez para toda la lista (W44, R6 de la v19). */}
                        <p className="cl-veredicto__porque" data-testid="aviso-sanitario-origen">{detalle.origen}</p>
                    </details>
                )}
            </div>
        </div>
    );
}
