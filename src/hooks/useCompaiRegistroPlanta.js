import { useEffect, useRef } from 'react';
import useAssetStore from '../store/useAssetStore';
import useAngelitaStore from '../store/useAngelitaStore';
import { logCache } from '../db/logCache';
import { plantaSinRegistro } from '../compai/nucleo/registroPlanta.js';
import { estaOcupado } from '../services/compaiOcupado.js';

// Los logs del cache usan segundos; el núcleo recibe milisegundos.
function fechaMs(log) {
  const value = log.timestamp ?? log.attributes?.timestamp;
  if (Number.isFinite(value)) return value > 1e12 ? value : value * 1000;
  return typeof value === 'string' ? Date.parse(value) : NaN;
}

/**
 * Revisa la planta seleccionada, por el mismo canal común de los susurros.
 * @param {{ activo?: boolean, onMensaje?: (mensaje: string) => void }} [opciones]
 */
export function useCompaiRegistroPlanta({ activo = true, onMensaje } = {}) {
  const plantaId = useAssetStore((s) => s.selectedAssetId);
  const plants = useAssetStore((s) => s.plants);
  const hydrated = useAssetStore((s) => s.isHydrated);
  const error = useAssetStore((s) => s.error);
  const callback = useRef(onMensaje);
  useEffect(() => { callback.current = onMensaje; }, [onMensaje]);

  useEffect(() => {
    const planta = plants?.find((p) => p.id === plantaId);
    if (!activo || !hydrated || error || !planta) return undefined;
    if (['dead', 'archived'].includes(planta.attributes?.status ?? planta.status)) return undefined;
    let vivo = true;
    let revision = 0;
    const revisar = async () => {
      const actual = ++revision;
      try {
        // getAll conserva también las referencias secundarias de operaciones masivas.
        const todos = await logCache.getAll();
        if (!vivo || actual !== revision) return;
        const logs = todos.filter((log) => {
          const refs = log.relationships?.asset?.data;
          const propio = log.asset_id === plantaId || (Array.isArray(refs)
            ? refs.some((a) => a.id === plantaId) : refs?.id === plantaId);
          return propio && (log.status ?? log.attributes?.status) !== 'pending'
            && !['cancelled', 'canceled'].includes(log.status ?? log.attributes?.status)
            && !(log.metadata?.ai ?? log.attributes?.metadata?.ai)?.needs_human_review;
        }).map((log) => ({ assetId: plantaId, timestampMs: fechaMs(log) }));
        // Una fecha ilegible no demuestra ausencia de registros.
        if (logs.some((log) => !Number.isFinite(log.timestampMs))) return;
        const senal = plantaSinRegistro({ plantaId, logs });
        if (!senal || useAngelitaStore.getState().estado !== 'calma') return;
        const nombre = planta.attributes?.name || planta.name || 'esta planta';
        const lead = senal.ultimaRegistroMs == null
          ? `No encuentro registros confirmados de ${nombre}. ¿Quiere anotar cómo está?`
          : `Hace ${senal.diasSinRegistro} días que no hay un registro confirmado de ${nombre}. ¿Cómo está hoy?`;
        const decision = useAngelitaStore.getState().evaluar({
          notificaciones: { hay: true, severidad: 'baja', lead, prioridad: 45, prompt: null },
          ocupado: estaOcupado(),
        });
        if (decision.interrumpe) callback.current?.(decision.mensaje);
      } catch {
        // Una lectura fallida no equivale a una planta sin registros.
      }
    };
    revisar();
    const eventos = ['farmosLog', 'puertaLogSaved', 'syncCompleted'];
    eventos.forEach((evento) => window.addEventListener(evento, revisar));
    const invalidar = () => { vivo = false; revision += 1; };
    window.addEventListener('tenantChanged', invalidar);
    return () => {
      invalidar();
      eventos.forEach((evento) => window.removeEventListener(evento, revisar));
      window.removeEventListener('tenantChanged', invalidar);
    };
  }, [activo, plantaId, plants, hydrated, error]);
}
