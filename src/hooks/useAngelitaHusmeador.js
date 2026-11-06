/**
 * useAngelitaHusmeador — Hook para husmear mundos automáticamente.
 *
 * Facilita la integración del husmeo proactivo de Angelita al detectar
 * cambios de mundo (vistas) y llamar a entrarMundo() con los datos apropiados.
 *
 * Este hook está diseñado para usarse en componentes de nivel superior como
 * AgentFab o App, sin modificar su lógica interna.
 *
 * @module hooks/useAngelitaHusmeador
 */
import { useEffect, useRef } from 'react';
import useAngelitaStore from '../store/useAngelitaStore';
import useAssetStore from '../store/useAssetStore';
import { useInventarioCompai } from './useInventarioCompai.js';
import { mundoDePantalla } from '../services/angelitaInteligencia';
import { datosDeMundo } from '../compai/nucleo/datosFinca.js';
import { estaOcupado } from '../services/compaiOcupado.js';
import { getCachedClimaSnapshot, CLIMA_UPDATED_EVENT } from '../services/climaService.js';
import { pisoPorAltitud } from '../visual/mundo3d/pisosTermicos.js';
import { FORECAST_THRESHOLDS } from '../constants/alertThresholds.js';

/**
 * Hook que husmea mundos automáticamente al montar o cambiar de vista.
 *
 * @param {Object} opts
 * @param {string|null} [opts.pantalla] - Vista actual (para detectar mundo).
 * @param {boolean} [opts.activo=true] - Si el husmeo está activo.
 * @param {number} [opts.cooldownMs=20000] - Cooldown entre husmeos (default 20s).
 */
export function useAngelitaHusmeador({ pantalla = null, activo = true, cooldownMs = 20000 } = {}) {
  const entrarMundo = useAngelitaStore((s) => s.entrarMundo);
  const inventario = useInventarioCompai();
  const sincronizando = useAssetStore((s) => s.isLoading
    && !s.syncProgress?.isComplete && !s.syncProgress?.isCancelled);
  const ultimoMundo = useRef(null);
  const ultimoHusmeoMs = useRef(0);

  useEffect(() => {
    if (!activo || !pantalla) return;

    const mundo = mundoDePantalla(pantalla);
    if (!mundo) return;
    // No declarar vacío el inventario mientras el pull inicial todavía puede
    // traer plantas. Al cambiar isLoading, el efecto vuelve a intentarlo.
    if (mundo === 'mis_matas' && sincronizando) return;

    const husmear = () => {
      const ahoraMs = Date.now();
      const esMundoDiferente = mundo !== ultimoMundo.current;
      const esActualizacionClima = mundo === 'clima' && getCachedClimaSnapshot() != null;
      const pasoCooldown = ahoraMs - ultimoHusmeoMs.current >= cooldownMs;
      if (!esMundoDiferente && !pasoCooldown && !esActualizacionClima) return;
      if (useAngelitaStore.getState().estado !== 'calma') return;

      const datosMundo = datosDeMundo(mundo, inventario);
      if (mundo !== 'clima') {
        entrarMundo(mundo, datosMundo, { ocupado: estaOcupado() });
        ultimoMundo.current = mundo;
        ultimoHusmeoMs.current = ahoraMs;
        return;
      }

      const snapshot = getCachedClimaSnapshot();
      const piso = pisoPorAltitud(snapshot?.location_context?.elevation);
      const dia = snapshot?.openmeteo?.forecast_7d?.[0];
      const minima = snapshot?.clima?.minimaNocturna_c ?? dia?.temp_min_c ?? dia?.temperature_2m_min ?? null;
      const umbral = FORECAST_THRESHOLDS.HELADA_MIN_C[piso?.id]
        ?? FORECAST_THRESHOLDS.HELADA_MIN_C.default;
      const nubosidad = snapshot?.clima?.nubosidad ?? dia?.cloud_cover_pct ?? null;
      const codigoCielo = Number(dia?.weathercode);
      entrarMundo(mundo, {
        ...datosMundo,
        snapshot,
        pisoTermico: piso,
        minima,
        lluvia: snapshot?.clima?.lluviaCantidad_mm ?? dia?.precip_mm ?? dia?.precipitation_sum ?? null,
        umbralHelada: umbral,
        cieloDespejado: snapshot?.clima?.condicion === 'despejado'
          || (Number.isFinite(Number(nubosidad)) && Number(nubosidad) < 20)
          || codigoCielo === 0 || codigoCielo === 1,
      }, { ocupado: estaOcupado() });
      ultimoMundo.current = mundo;
      ultimoHusmeoMs.current = ahoraMs;
    };

    husmear();
    if (mundo === 'clima') {
      window.addEventListener(CLIMA_UPDATED_EVENT, husmear);
      return () => window.removeEventListener(CLIMA_UPDATED_EVENT, husmear);
    }
    return undefined;
  }, [pantalla, activo, cooldownMs, entrarMundo, inventario, sincronizando]);
}

export default useAngelitaHusmeador;
