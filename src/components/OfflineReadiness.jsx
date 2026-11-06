import useOfflineReadiness from '../hooks/useOfflineReadiness';

export default function OfflineReadiness({ className = '' }) {
  const ready = useOfflineReadiness();
  return <span role="status" className={className} data-offline-ready={String(ready)}>
    {ready ? 'Uso sin conexión listo' : 'Preparando uso sin conexión'}
  </span>;
}
