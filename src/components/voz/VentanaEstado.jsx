import { Mic } from 'lucide-react';
import { useInventarioCompai } from '../../hooks/useInventarioCompai';

export function EscuchaEnVivo({
  modo,
  pendiente,
  tiempoEscuchando = 0,
  cierreSilencio = 0,
  className = '',
}) {
  if (modo !== 'microfono' && pendiente !== 'microfono') return null;
  const segundos = Math.floor(tiempoEscuchando / 1000);
  const porcentaje = Math.round(cierreSilencio * 100);
  return (
    <div className={`voz-escucha-viva ${className}`} role="status" aria-live="polite">
      <span className="voz-escucha-icono" aria-hidden="true"><Mic size={15} /></span>
      <span><strong>{pendiente ? 'Esperando su permiso' : 'Le estoy escuchando'}</strong>
        <small>{pendiente ? 'Cuando usted lo permita, comienza la escucha.' : `${segundos}s escuchando. Me cierro si queda en silencio.`}</small>
      </span>
      {modo === 'microfono' && cierreSilencio > 0 ? <span className="voz-escucha-cierre" aria-label={`Cierre por silencio: ${porcentaje}%`}><i style={{ '--cierre': `${porcentaje}%` }} /></span> : null}
    </div>
  );
}

export function ContextoFinca({ className = '' }) {
  const inventario = useInventarioCompai();
  const cultivos = inventario.cultivos || [];
  const nombres = cultivos.slice(0, 3).map(({ name }) => name).join(', ');
  return (
    <div className={`voz-contexto-finca ${className}`} aria-label="Datos disponibles de su finca">
      <span className="voz-contexto-etiqueta">SU FINCA, AQUÍ Y AHORA</span>
      {cultivos.length ? <p>Hay {inventario.matasTotal} {inventario.matasTotal === 1 ? 'mata' : 'matas'} registradas: {nombres}{cultivos.length > 3 ? ' y otras.' : '.'}</p>
        : <p>Todavía no tengo registrada la altitud ni las matas de su finca. No voy a adivinarlas.</p>}
    </div>
  );
}
