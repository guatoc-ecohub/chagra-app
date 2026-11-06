/**
 * MundoClima — el mundo del clima interactivo en 2.5D. Vive aparte de la
 * navegación: lo monta su arnés (scripts/diag/clima-mundo.html).
 *
 * Lee la MISMA fuente que «El tiempo» 2D (useFuenteClima) y la compone con las
 * MISMAS funciones (escenaMundo.js). El panel dice lo mismo que la pantalla:
 * el cielo y la temperatura de la portada, el titular, «¿Llueve?» y «¿Hiela
 * esta noche/madrugada?» con sus respuestas, palabra por palabra.
 *
 * Interacción: el puntero da profundidad a las capas; tocar el sol o la luna,
 * las nubes, la lluvia, la niebla o la escarcha dice qué es, con su cifra.
 */
import React, { useMemo, useState } from 'react';
import { RefreshCw, Tags } from 'lucide-react';
import { getProfile } from '../../../services/userProfileService';
import { leerGateCielo } from '../cieloHoy.js';
import { horasJuntas } from '../horasJuntas';
import { CompaiAvatar } from '../pedagogia';
import { COMPAI } from '../compaiCast';
import { horaConMinutosEsCO } from '../../../utils/fechaEsCO.js';
import { escenaDelMundo, etiquetasDeLaEscena } from './escenaMundo.js';
import { familiaEnso, useFuenteClima } from './useFuenteClima.js';
import MundoClimaEscena from './MundoClimaEscena.jsx';

/** Rótulo corto de cada capa, para los nombres sobre la escena. */
const NOMBRE_CAPA = { astro: null, nubes: 'Nubes', lluvia: 'Lluvia', niebla: 'Niebla', escarcha: 'Escarcha', relampago: 'Tormenta', viento: 'Viento' };

/** @param {{ location?: { lat: number, lng: number, elevation?: number, municipio?: string } }} props */
export default function MundoClima({ location = undefined }) {
    const [perfil] = useState(() => getProfile());
    const { agrometeo, snapshot, cargando, reloj, actualizar } = useFuenteClima(location);
    const escena = useMemo(() => escenaDelMundo({
        agrometeo, snapshot, location, ahoraMs: reloj.getTime(), gate: leerGateCielo(), perfil, enso: familiaEnso(),
    }), [agrometeo, snapshot, location, reloj, perfil]);
    const estado = !location ? 'sin-ubicacion' : cargando && !agrometeo ? 'cargando' : escena.hayDato ? 'listo' : 'sin-dato';
    return <MundoClimaVista escena={escena} estado={estado} municipio={location?.municipio} cargando={cargando} onActualizar={actualizar} />;
}

/**
 * La vista del mundo para una escena ya leída: el paisaje y el panel.
 * @param {{ escena: ReturnType<typeof escenaDelMundo>, estado: string, municipio?: string, cargando?: boolean, onActualizar?: () => void }} props
 */
export function MundoClimaVista({ escena, estado, municipio = undefined, cargando = false, onActualizar = undefined }) {
    const [tocada, setTocada] = useState(/** @type {string|null} */ (null));
    const [nombres, setNombres] = useState(false);
    const etiquetas = useMemo(() => etiquetasDeLaEscena(escena), [escena]);
    // Doña Zarigüeya, la guía sabia y calmada del elenco (compaiCast).
    const compai = 'zariguya';
    const capas = Object.keys(etiquetas).filter((k) => k !== 'viento');

    return (
        <div className="mc-mundo" data-testid="mundo-clima" data-estado={estado} data-condicion={escena.condicion ?? 'sin-dato'}
            data-luz={escena.luz ?? 'sin-dato'} data-tramo={escena.tramo}>
            <MundoClimaEscena escena={estado === 'listo' ? escena : { ...escena, astro: null, nubes: null, lluvia: null, niebla: null, relampago: false, escarcha: null, estrellas: null, viento: null }}
                etiquetas={etiquetas} onTocar={setTocada} />

            {nombres && estado === 'listo' && (
                <ul className="mc-nombres" aria-label="Nombres de lo que se ve">
                    {capas.map((k) => (
                        <li key={k} className={`mc-nombre mc-nombre--${k}`} data-nombre={k}>
                            <button type="button" onClick={() => setTocada(k)}>{NOMBRE_CAPA[k] ?? (escena.astro?.tipo === 'luna' ? 'Luna' : 'Sol')}</button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="mc-herramientas">
                <button type="button" className="mc-boton" aria-pressed={nombres} onClick={() => setNombres((n) => !n)} disabled={estado !== 'listo'}>
                    <Tags size={16} aria-hidden="true" /> Nombres
                </button>
                <button type="button" className="mc-boton" onClick={onActualizar} aria-label="Actualizar pronóstico">
                    <RefreshCw size={16} aria-hidden="true" className={cargando ? 'animate-spin' : undefined} />
                </button>
            </div>

            <section className="mc-panel" aria-live="polite">
                {estado === 'sin-ubicacion' && <p className="mc-panel__aviso">Aún no tenemos el tiempo de su finca. Complete la ubicación para consultar el pronóstico.</p>}
                {estado === 'cargando' && <p className="mc-panel__aviso">Leyendo el cielo de su finca…</p>}
                {estado === 'sin-dato' && <p className="mc-panel__aviso" data-testid="mundo-sin-dato">No pudimos leer el pronóstico de su finca. No dibujamos un cielo que no conocemos.</p>}
                {estado === 'listo' && <>
                    <p className="mc-panel__hora" data-testid="mundo-hora">
                        Ahora en {municipio || 'su finca'}, {horaConMinutosEsCO(escena.ahoraMs, escena.zona)}
                    </p>
                    <div className="mc-panel__cielo">
                        <span className="mc-panel__temp" data-testid="mundo-temperatura">
                            {escena.temperatura == null ? 'sin dato' : `${Math.round(escena.temperatura)} °C`}
                        </span>
                        <span className="mc-panel__rotulo" data-testid="mundo-rotulo">{escena.rotulo ?? 'Cielo sin dato'}</span>
                    </div>
                    {escena.titular && (
                        <div className="mc-panel__dice">
                            <CompaiAvatar compai={compai} size={40} />
                            <p data-testid="mundo-titular"><span className="mc-sr">{COMPAI[compai].nombre} dice: </span>{horasJuntas(escena.titular)}</p>
                        </div>
                    )}
                    <dl className="mc-panel__respuestas">
                        {escena.lluviaRespuesta && <div>
                            <dt>¿Llueve?</dt>
                            <dd data-testid="mundo-lluvia-respuesta">{horasJuntas(escena.lluviaRespuesta)}</dd>
                        </div>}
                        {escena.heladaPregunta && <div>
                            <dt data-testid="mundo-helada-pregunta">{escena.heladaPregunta}</dt>
                            <dd data-testid="mundo-helada-respuesta">{horasJuntas(escena.heladaRespuesta ?? '')}</dd>
                        </div>}
                    </dl>
                    {tocada && etiquetas[tocada] && (
                        <p className="mc-panel__etiqueta" data-testid="mundo-etiqueta" data-capa-tocada={tocada}>{horasJuntas(etiquetas[tocada])}</p>
                    )}
                    <p className="mc-panel__fuente">Pronóstico por hora de Open-Meteo para su finca, el mismo de «El tiempo». Toque el cielo para saber qué es cada cosa.</p>
                </>}
            </section>
        </div>
    );
}
