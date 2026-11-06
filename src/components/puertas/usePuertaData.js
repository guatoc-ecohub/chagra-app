import { useEffect, useState } from 'react';
import useAssetStore from '../../store/useAssetStore';
import { useLogStore } from '../../store/useLogStore';
import { logCache } from '../../db/logCache';
import { sortLogs } from './puertaData';

export default function usePuertaData() {
  const plants = useAssetStore((s) => s.plants);
  const lands = useAssetStore((s) => s.lands);
  const hydrated = useAssetStore((s) => s.isHydrated);
  const assetError = useAssetStore((s) => s.error);
  const lastPull = useLogStore((s) => s.lastPullAt);
  const [state, setState] = useState({ logs: [], loading: true, error: false, now: new Date() });
  useEffect(() => {
    let alive = true;
    let revision = 0;
    const refresh = async () => {
      const current = ++revision;
      try {
        const logs = await logCache.getAll();
        if (alive && current === revision) setState({ logs: sortLogs(logs), loading: false, error: false, now: new Date() });
      } catch {
        if (alive && current === revision) setState({ logs: [], loading: false, error: true, now: new Date() });
      }
    };
    const events = ['syncCompleted', 'farmosLog', 'puertaLogSaved', 'focus', 'tenantChanged'];
    refresh();
    events.forEach((event) => window.addEventListener(event, refresh));
    const timer = window.setInterval(refresh, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, refresh));
    };
  }, [lastPull]);
  useEffect(() => {
    if (!hydrated && !assetError) useAssetStore.getState().hydrate();
  }, [hydrated, assetError]);
  return { ...state, plants, lands, hydrated, assetError };
}
