/**
 * useChagraStats.js — Hook de consumo de `public/chagra-stats.json`, la
 * FUENTE ÚNICA DE VERDAD de "qué tiene Chagra" (especies, MIP, biopreparados,
 * estado del grafo). Ver scripts/gen-chagra-stats.mjs para cómo se genera.
 *
 * Uso previsto (cablear cuando aplique — NO se importa todavía en Login ni
 * en ningún componente: el login está en rediseño concurrente y este cambio
 * deliberadamente no toca su JSX; ver header de gen-chagra-stats.mjs):
 *
 *   import { useChagraStats } from '../hooks/useChagraStats';
 *
 *   function TrustSignals() {
 *     const { data, loading, error } = useChagraStats();
 *     if (loading) return null;
 *     if (error || !data) return null; // degradar en silencio, no bloquear login
 *     return (
 *       <p>
 *         {data.catalogo.especies} especies · {data.catalogo.mip_plagas.con_mip}{' '}
 *         plagas con MIP · {data.verificacion.doi_pct}% verificado por DOI
 *       </p>
 *     );
 *   }
 *
 * Consumo desde chagra.bio (sitio externo, NO vive en este repo — ver
 * src/components/LegalLinks.jsx para el dominio): chagra.bio haría
 * `fetch('https://chagra.guatoc.co/chagra-stats.json')` (cross-origin, ya
 * que chagra.bio y el PWA sirven desde dominios distintos). Requiere que
 * nginx del PWA agregue `Access-Control-Allow-Origin: https://chagra.bio`
 * para esta ruta estática específica (fuera del alcance de este repo —
 * es configuración del servidor web del despliegue, no de este repo).
 */
import { useEffect, useState } from 'react';

const STATS_URL = '/chagra-stats.json';

// Todos los consumidores de este hook comparten una única promesa durante la
// sesión. Esto evita que el home y El Ciclo Vivo abran fetches duplicados al
// montarse juntos. Un error no se memoriza: la siguiente montada puede
// reintentar con conectividad recuperada.
let statsRequest = null;
let statsFetch = null;

function loadStats() {
  if (statsRequest && statsFetch === globalThis.fetch) return statsRequest;

  statsFetch = globalThis.fetch;

  statsRequest = fetch(STATS_URL, { cache: 'no-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`chagra-stats.json HTTP ${res.status}`);
      return res.json();
    })
    .catch((error) => {
      statsRequest = null;
      statsFetch = null;
      throw error;
    });

  return statsRequest;
}

export function getChagraStats() {
  return loadStats();
}

/** Solo para tests y recuperación explícita de sesión. */
export function clearChagraStatsCache() {
  statsRequest = null;
  statsFetch = null;
}

/**
 * @returns {{ data: object|null, loading: boolean, error: Error|null }}
 */
export function useChagraStats() {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let alive = true;

    loadStats()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (alive) {
          console.warn('[useChagraStats] Error:', err?.message || err);
          setState({ data: null, loading: false, error: err });
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  return state;
}

export default useChagraStats;
