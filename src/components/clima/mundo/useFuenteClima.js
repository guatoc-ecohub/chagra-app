/**
 * La fuente del mundo del clima: la misma carga que «El tiempo» 2D
 * (ClimaBoletinScreen), con los mismos servicios y en el mismo orden:
 * snapshot del servidor (climaService) + pronóstico por hora de Open-Meteo
 * (agroMeteoService), y el reloj de la finca que se renueva cada minuto.
 */
import { useEffect, useMemo, useState } from 'react';
import { fetchClimaSnapshot, getCachedClimaSnapshot } from '../../../services/climaService.js';
import { fetchAgroMeteo } from '../../../services/agroMeteoService.js';
import { getEnsoPhase, getEnsoPhaseSource } from '../../../services/ensoService.js';
import { ensoFamily } from '../../../services/ensoContext.js';

/** La familia ENSO con la misma lectura que la pantalla 2D. */
export function familiaEnso() {
    if (getEnsoPhaseSource() === 'default') return null;
    const phase = getEnsoPhase();
    return ensoFamily(phase === 'el_nino' ? 'nino' : phase === 'la_nina' ? 'nina' : phase);
}

/** @param {{ lat: number, lng: number, elevation?: number } | null | undefined} location */
export function useFuenteClima(location) {
    const [agrometeo, setAgrometeo] = useState(null);
    const [snapshotRecibido, setSnapshot] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [refresco, setRefresco] = useState(0);
    const [reloj, setReloj] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setReloj(new Date()), 60_000);
        return () => clearInterval(timer);
    }, []);
    const snapshotGuardado = useMemo(
        () => getCachedClimaSnapshot(location?.lat, location?.lng, location?.elevation),
        [location],
    );
    useEffect(() => {
        let vivo = true;
        const force = refresco > 0;
        Promise.allSettled([
            fetchClimaSnapshot(location ? { ...location, forceRefresh: force } : { forceRefresh: force }),
            location ? fetchAgroMeteo(location, { forceRefresh: force }) : Promise.resolve(null),
        ]).then(([snap, meteo]) => {
            if (!vivo) return;
            if (snap.status === 'fulfilled' && snap.value) setSnapshot(snap.value);
            if (meteo.status === 'fulfilled') setAgrometeo(meteo.value);
            setCargando(false);
        });
        return () => { vivo = false; };
    }, [location, refresco]);
    return {
        agrometeo,
        snapshot: snapshotRecibido || snapshotGuardado,
        cargando,
        reloj,
        actualizar: () => { setCargando(true); setRefresco((n) => n + 1); },
    };
}
