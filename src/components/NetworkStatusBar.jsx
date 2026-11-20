import React, { useEffect, useCallback, useReducer } from 'react';
import { MSG } from '../config/messages.js';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { syncManager } from '../services/syncManager';

// Helpers de dismiss persistente por sesión — top-level para que sean
// estables y no requieran dependencias en useCallback.
const dismissKey = (st, count) => `chagra:netStatus:dismissed:${st}:${count}`;
const isDismissedInSession = (st, count) => {
  try { return sessionStorage.getItem(dismissKey(st, count)) === '1'; }
  catch (_) { return false; }
};
const markDismissedInSession = (st, count) => {
  try { sessionStorage.setItem(dismissKey(st, count), '1'); } catch (_) { /* noop */ }
};

const STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  ERROR: 'error',
};

const createInitialState = (isOnline) => ({
  status: isOnline ? STATUS.ONLINE : STATUS.OFFLINE,
  isOnline,
  pendingCount: 0,
  syncedCount: 0,
  errorMessage: '',
  visible: !isOnline,
  errorRevision: 0,
  syncedRevision: 0,
});

// Cada evento produce una única transición; los efectos solo se ocupan de
// consultar datos o programar la expiración del estado que la máquina eligió.
const transitionStatus = (state, event) => {
  switch (event.type) {
    case 'POLL': {
      const { stats } = event;
      const pendingCount = stats.pendingCount ?? state.pendingCount;
      const isOnline = stats.isOnline !== false;
      const next = { ...state, pendingCount, isOnline };

      if (!isOnline) {
        if (
          state.status === STATUS.OFFLINE
          && state.pendingCount === pendingCount
          && state.visible === event.offlineVisible
          && state.errorMessage === ''
        ) return state;
        return {
          ...next,
          status: STATUS.OFFLINE,
          visible: event.offlineVisible,
          errorMessage: '',
        };
      }
      if (stats.isSyncing) {
        if (
          state.status === STATUS.SYNCING
          && state.pendingCount === pendingCount
          && !state.visible
          && state.errorMessage === ''
        ) return state;
        return { ...next, status: STATUS.SYNCING, visible: false, errorMessage: '' };
      }
      if (state.status === STATUS.OFFLINE || state.status === STATUS.SYNCING) {
        return { ...next, status: STATUS.ONLINE, visible: false, errorMessage: '' };
      }
      if (pendingCount === state.pendingCount && isOnline === state.isOnline) return state;
      return next;
    }
    case 'ONLINE':
      return {
        ...state,
        status: STATUS.SYNCING,
        isOnline: true,
        visible: true,
        errorMessage: '',
      };
    case 'ONLINE_STATS':
      return state.syncedCount === event.pendingCount
        ? state
        : { ...state, syncedCount: event.pendingCount };
    case 'OFFLINE':
      return {
        ...state,
        status: STATUS.OFFLINE,
        isOnline: false,
        visible: true,
        errorMessage: '',
      };
    case 'SYNC_ERROR':
      if (!event.isOnline || !state.isOnline) {
        return {
          ...state,
          status: STATUS.OFFLINE,
          isOnline: false,
          visible: true,
          errorMessage: '',
        };
      }
      return {
        ...state,
        status: STATUS.ERROR,
        visible: true,
        errorMessage: event.message || 'Error sincronizando con FarmOS',
        errorRevision: state.errorRevision + 1,
      };
    case 'ERROR_TIMEOUT':
      if (state.status !== STATUS.ERROR || state.errorRevision !== event.revision) return state;
      if (!event.isOnline) {
        return {
          ...state,
          status: STATUS.OFFLINE,
          isOnline: false,
          visible: true,
          errorMessage: '',
        };
      }
      return {
        ...state,
        status: STATUS.ONLINE,
        isOnline: true,
        visible: false,
        errorMessage: '',
      };
    case 'SYNC_COMPLETE': {
      if (!event.isOnline) {
        return {
          ...state,
          status: STATUS.OFFLINE,
          isOnline: false,
          visible: true,
          errorMessage: '',
        };
      }
      if (!event.stats || event.failedCount === null) {
        return {
          ...state,
          status: STATUS.ERROR,
          isOnline: true,
          visible: true,
          errorMessage: MSG.status.errorSincronizar,
          errorRevision: state.errorRevision + 1,
        };
      }

      const pendingCount = event.stats.pendingCount ?? state.pendingCount;
      if (pendingCount > 0 || event.failedCount > 0) {
        return {
          ...state,
          status: STATUS.ERROR,
          isOnline: true,
          pendingCount,
          visible: true,
          errorMessage: MSG.status.errorSincronizar,
          errorRevision: state.errorRevision + 1,
        };
      }

      return {
        ...state,
        status: STATUS.SYNCED,
        isOnline: true,
        pendingCount,
        syncedCount: event.synced ?? state.syncedCount,
        visible: true,
        errorMessage: '',
        syncedRevision: state.syncedRevision + 1,
      };
    }
    case 'SYNCED_TIMEOUT':
      if (state.status !== STATUS.SYNCED || state.syncedRevision !== event.revision) return state;
      return { ...state, visible: false };
    case 'DISMISS':
      return { ...state, visible: false };
    default:
      return state;
  }
};

export default function NetworkStatusBar() {
  const [state, dispatch] = useReducer(transitionStatus, navigator.onLine, createInitialState);
  const { status, pendingCount, syncedCount, errorMessage, visible } = state;

  const refreshStats = useCallback(async () => {
    try {
      const stats = await syncManager.getSyncStats();
      dispatch({
        type: 'POLL',
        stats,
        offlineVisible: !isDismissedInSession(STATUS.OFFLINE, stats.pendingCount),
      });
    } catch (_err) {
      // DB no inicializada aún, ignorar
    }
  }, []);

  useEffect(() => {
    // Polling ligero del estado de sincronización. La llamada inmediata es
    // intencional: sin ella el estado visible queda 1.5s desfasado al montar.
    // El reductor devuelve el mismo estado cuando nada cambió.
    const interval = setInterval(refreshStats, 1500);
    refreshStats();
    return () => clearInterval(interval);
  }, [refreshStats]);

  useEffect(() => {
    if (status === STATUS.ERROR) {
      const revision = state.errorRevision;
      const timeout = setTimeout(() => {
        dispatch({ type: 'ERROR_TIMEOUT', revision, isOnline: navigator.onLine });
      }, 8000);
      return () => clearTimeout(timeout);
    }
    if (status === STATUS.SYNCED) {
      const revision = state.syncedRevision;
      const timeout = setTimeout(() => dispatch({ type: 'SYNCED_TIMEOUT', revision }), 3000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [status, state.errorRevision, state.syncedRevision]);

  useEffect(() => {
    const handleOnline = async () => {
      dispatch({ type: 'ONLINE' });

      // Contar pendientes antes de sync para reportar cuántos se sincronizaron
      try {
        const stats = await syncManager.getSyncStats();
        dispatch({ type: 'ONLINE_STATS', pendingCount: stats.pendingCount });
      } catch (_e) { /* noop */ }
    };

    const handleOffline = () => {
      dispatch({ type: 'OFFLINE' });
    };

    const handleSyncError = (e) => {
      // Una petición puede terminar después de que el navegador ya notificó
      // `offline`. En ese caso el error de red no reemplaza la señal estable
      // de modo offline-first por un mensaje técnico de reintento.
      dispatch({
        type: 'SYNC_ERROR',
        isOnline: navigator.onLine,
        message: e.detail?.message,
      });
    };

    const handleSyncComplete = async (event) => {
      const [stats, failed] = await Promise.all([
        syncManager.getSyncStats(), syncManager.getFailedTransactions(),
      ]).catch(() => [null, null]);
      dispatch({
        type: 'SYNC_COMPLETE',
        stats,
        failedCount: failed?.length ?? null,
        synced: Number.isFinite(event.detail?.synced) ? event.detail.synced : undefined,
        isOnline: navigator.onLine && stats?.isOnline !== false,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('syncError', handleSyncError);
    window.addEventListener('syncComplete', handleSyncComplete);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('syncError', handleSyncError);
      window.removeEventListener('syncComplete', handleSyncComplete);
    };
  }, []);

  const dismiss = (e) => {
    e.stopPropagation();
    markDismissedInSession(status, pendingCount);
    dispatch({ type: 'DISMISS' });
  };

  if (!visible) return null;

  const isClickable = pendingCount > 0 || status === STATUS.OFFLINE || status === STATUS.SYNCING || status === STATUS.ERROR;
  const goToBitacora = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chagraNavigate', { detail: { view: 'historial' } }));
    }
  };
  const configs = {
    [STATUS.OFFLINE]: {
      bg: 'bg-frog/10',
      border: 'border-frog/50',
      icon: <WifiOff size={16} className="shrink-0 text-frog" />,
      text: pendingCount > 0 ? MSG.status.sinConexionPendientes(pendingCount) : MSG.status.sinConexionSinPendientes,
    },
    [STATUS.SYNCING]: {
      bg: 'bg-morpho/10',
      border: 'border-morpho/50',
      icon: <RefreshCw size={16} className="animate-spin shrink-0 text-morpho" />,
      text: MSG.ui.sincronizandoRegistros(pendingCount),
    },
    [STATUS.SYNCED]: {
      bg: 'bg-muzo/10',
      border: 'border-muzo/50',
      icon: <CheckCircle size={16} className="shrink-0 text-muzo" />,
      text: `${syncedCount > 0 ? syncedCount : ''} registro${syncedCount !== 1 ? 's' : ''} sincronizado${syncedCount !== 1 ? 's' : ''}.`,
    },
    [STATUS.ERROR]: {
      bg: 'bg-red-900/90',
      border: 'border-red-700',
      icon: <AlertTriangle size={16} className="shrink-0" />,
      text: errorMessage || MSG.status.errorSincronizar,
    },
    [STATUS.ONLINE]: {
      bg: 'bg-muzo/10',
      border: 'border-muzo/50',
      icon: <Wifi size={16} className="shrink-0 text-muzo" />,
      text: 'Conectado.',
    },
  };

  const config = configs[status] || configs[STATUS.ONLINE];

  return (
    <div
      role={isClickable ? 'button' : 'status'}
      tabIndex={isClickable ? 0 : -1}
      aria-live="polite"
      onClick={isClickable ? goToBitacora : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToBitacora(); } } : undefined}
      className={`shrink-0 w-full ${config.bg} ${config.border} border-b px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] flex items-center gap-2 text-white text-sm font-medium backdrop-blur-md transition-all ${isClickable ? 'cursor-pointer hover:brightness-110 active:brightness-95' : ''}`}
    >
      {config.icon}
      <span className="flex-1 min-w-0">{config.text}</span>
      {isClickable && (
        <span className="text-[10px] text-white/60 shrink-0 hidden sm:inline">Toque para detalle</span>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar barra de sincronización"
        className="shrink-0 p-1 -mr-1 rounded hover:bg-white/10 active:bg-white/20 min-h-[32px] min-w-[32px] flex items-center justify-center"
      >
        <X size={14} className="text-white/70" />
      </button>
    </div>
  );
}
