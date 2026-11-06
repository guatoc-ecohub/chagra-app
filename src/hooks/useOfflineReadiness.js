import { useEffect, useState } from 'react';

// A controller alone is insufficient: installation can have partial cache misses.
export default function useOfflineReadiness() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return undefined;
    let active = true;
    const check = async () => {
      const controller = sw.controller;
      if (!controller) { if (active) setReady(false); return; }
      const available = await new Promise(resolve => {
        const channel = new MessageChannel();
        const finish = value => { clearTimeout(timeout); channel.port1.close(); resolve(value); };
        const timeout = setTimeout(() => finish(false), 1500);
        channel.port1.onmessage = event => finish(event.data?.ready === true);
        try { controller.postMessage({ type: 'GET_OFFLINE_STATUS' }, [channel.port2]); }
        catch { finish(false); }
      });
      if (active) setReady(controller === sw.controller && available === true);
    };
    check();
    sw.addEventListener('controllerchange', check);
    const timer = setInterval(check, 3000);
    return () => { active = false; clearInterval(timer); sw.removeEventListener('controllerchange', check); };
  }, []);
  return ready;
}
