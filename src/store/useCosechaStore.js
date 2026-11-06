import { create } from 'zustand';
import { logCache } from '../db/logCache';
import useAssetStore from './useAssetStore';
import {
  harvestSummary,
  HARVEST_LOG_TYPE,
  buildHarvestLoteAssignment,
} from '../services/cosechaService';
import { loteAreaSqMeters } from '../services/loteService';
import { savePayload } from '../services/payloadService';

/**
 * useCosechaStore — estado reactivo de "Mi cosecha". Carga los `log--harvest`
 * desde IndexedDB (offline-first) y expone el `summary` ya agregado por
 * cosechaService para que la vista de dirección de arte solo pinte.
 *
 * Fuente de verdad: los logs viven en `logCache`; las plantas/lotes en
 * `useAssetStore`. Este store no persiste nada — solo lee y agrega.
 */
const useCosechaStore = create((set, get) => ({
  /** Resumen agregado (ver cosechaService.harvestSummary) o null si no cargado. */
  summary: null,
  isLoading: false,
  error: null,
  lastComputedAt: null,

  /**
   * Carga los log--harvest desde IndexedDB y recalcula el resumen usando las
   * plantas/lotes actuales del store de assets.
   * @returns {Promise<object|null>} el summary calculado.
   */
  loadHarvests: async () => {
    set({ isLoading: true, error: null });
    try {
      const [logs, assignmentLogs] = await Promise.all([
        logCache.getByType(HARVEST_LOG_TYPE),
        logCache.getByType('log--observation'),
      ]);
      const { plants, lands } = useAssetStore.getState();
      const summary = harvestSummary(logs, {
        plants,
        lands,
        areaOf: loteAreaSqMeters,
        assignmentLogs,
      });
      set({ summary, isLoading: false, lastComputedAt: Date.now() });
      return summary;
    } catch (err) {
      set({ isLoading: false, error: err.message || 'No se pudieron cargar las cosechas' });
      return null;
    }
  },

  /**
   * Recalcula el resumen a partir de una lista de logs ya en memoria (evita
   * el round-trip a IndexedDB cuando el caller ya los tiene).
   * @param {object[]} logs
   */
  computeFrom: (logs) => {
    const { plants, lands } = useAssetStore.getState();
    const summary = harvestSummary(logs || [], { plants, lands, areaOf: loteAreaSqMeters });
    set({ summary, lastComputedAt: Date.now() });
    return summary;
  },

  /** Confirma el lote de cosechas antiguas con eventos append-only. */
  assignHarvestsToLote: async (harvestIds, loteId) => {
    const ids = [...new Set((harvestIds || []).filter(Boolean))];
    if (!ids.length || !loteId) return { success: false, assigned: 0 };
    const result = await savePayload(
      'observation',
      buildHarvestLoteAssignment(ids, loteId),
      { waitForSync: false },
    );
    if (!result.success && !result.savedLocally) {
      await get().loadHarvests();
      return { success: false, assigned: 0, message: result.message };
    }
    await get().loadHarvests();
    return { success: true, assigned: ids.length };
  },

  reset: () => set({ summary: null, isLoading: false, error: null, lastComputedAt: null }),
}));

// Al cambiar de finca (tenant), invalidar el resumen: los logs del tenant
// anterior no deben quedar cacheados en memoria.
if (typeof window !== 'undefined') {
  window.addEventListener('tenantChanged', () => {
    useCosechaStore.getState().reset();
  });
}

export default useCosechaStore;
