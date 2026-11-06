/**
 * useCompaiClimaVivo — el compAI REACCIONA al clima real (#111).
 *
 * Cablea `compai/nucleo/climaVivo.reaccionAlClima` al mismo snapshot que ya
 * consume el husmeo (climaService.getCachedClimaSnapshot — cero red aquí,
 * cache local de 30 min que climaService/otro componente ya llenó). Traduce
 * la reacción a `notificaciones` (angelitaInteligencia.notificacionDeClima)
 * y la pasa por `useAngelitaStore.evaluar()` — la MISMA anti-molestia y el
 * MISMO cooldown de aviso que cualquier otra alerta de la app.
 *
 * Anti-fabricación: sin snapshot cacheado (aún no consultado, offline sin
 * cache), no reacciona — no inventa clima. No hace fetch: si nadie más pidió
 * el clima todavía, este hook simplemente no tiene nada que decir hasta la
 * próxima vez que se re-evalúe.
 *
 * Riego (T2 del goteo): con los sistemas de «Mi goteo» (equipment ya en el
 * store) y el pronóstico de la finca ya guardado (agroMeteoService, sin red),
 * el aviso dice qué regar y cuánto (consejoRiego.consejoRiegoHoy).
 */
import { useEffect } from 'react';
import useAngelitaStore from '../store/useAngelitaStore';
import { getCachedClimaSnapshot, resolveClimaLocation } from '../services/climaService';
import { leerAgroMeteoGuardado } from '../services/agroMeteoService';
import { consejoRiegoHoy } from '../services/consejoRiego';
import { sistemasDeGoteo } from '../services/miGoteoService';
import useAssetStore from '../store/useAssetStore';
import { notificacionDeClima } from '../services/angelitaInteligencia';
import { reaccionAlClima } from '../compai/nucleo/climaVivo';
import { estaOcupado } from '../services/compaiOcupado.js';

/** El consejo de riego de hoy con lo que ya está en el teléfono; null si falla algo. */
function riegoDeHoy() {
  try {
    const sistemas = sistemasDeGoteo(useAssetStore.getState().equipment);
    const agrometeo = sistemas.length ? leerAgroMeteoGuardado(resolveClimaLocation()) : null;
    return consejoRiegoHoy({ sistemas, agrometeo });
  } catch {
    return null;
  }
}

/**
 * @param {Object} [opts]
 * @param {boolean} [opts.activo=true]  false = no evalúa (p.ej. pantalla de agente ya abierta).
 * @param {(m:string)=>void} [opts.onMensaje]  callback opcional con el mensaje que surgió (para notificaciones visuales).
 */
export function useCompaiClimaVivo({ activo = true, onMensaje } = {}) {
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    // Se re-evalúa espaciado (no en cada render): el clima no cambia minuto a
    // minuto y el propio cooldown de aviso (20-45 min) ya limita la cadencia.
    const evaluarClima = () => {
      if (!vivo) return;
      // No le quita el turno a un husmeo o aviso ya en curso.
      if (useAngelitaStore.getState().estado !== 'calma') return;
      const snapshot = getCachedClimaSnapshot();
      const forecast7d = snapshot?.openmeteo?.available ? snapshot.openmeteo.forecast_7d : null;
      const reaccion = reaccionAlClima({ forecast7d: forecast7d || [], riego: riegoDeHoy() });
      if (!reaccion) return;
      const notificaciones = notificacionDeClima(reaccion);
      const decision = useAngelitaStore.getState().evaluar({ notificaciones, ocupado: estaOcupado() });
      if (decision.interrumpe && typeof onMensaje === 'function') onMensaje(decision.mensaje);
    };
    evaluarClima();
    const id = window.setInterval(evaluarClima, 10 * 60 * 1000); // cada 10min, el cooldown filtra el resto
    return () => { vivo = false; window.clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);
}

export default useCompaiClimaVivo;
