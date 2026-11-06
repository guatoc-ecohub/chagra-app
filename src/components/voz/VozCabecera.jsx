import { ArrowLeft, Moon, Pause, Play, Sun } from 'lucide-react';

export default function VozCabecera({ pausada, onPausa, tema, onTema, localidad = 'UNA CONVERSACIÓN EN LA CHAGRA', movimientoBloqueado = false, etiquetaMovimientoBloqueado = 'Movimiento reducido por su dispositivo', etiquetaTemaSol = 'Activar modo para el sol' }) {
  const esNoche = tema === 'noche';

  return (
    <header className="voz-familia-cabecera">
      <a href="/" className="voz-familia-marca" aria-label="Volver a Chagra">
        <ArrowLeft size={17} aria-hidden="true" />
        <span>chagra<span className="voz-familia-punto">.</span></span>
      </a>
      <span className="voz-familia-localidad">{localidad}</span>
      <div className="voz-familia-ajustes">
        <button type="button" onClick={onPausa} aria-pressed={pausada} disabled={movimientoBloqueado}
          aria-label={movimientoBloqueado ? etiquetaMovimientoBloqueado : pausada ? 'Reanudar movimiento' : 'Pausar movimiento'}>
          {pausada ? <Play size={17} aria-hidden="true" /> : <Pause size={17} aria-hidden="true" />}
        </button>
        <button type="button" onClick={onTema} aria-label={esNoche ? etiquetaTemaSol : 'Activar modo noche'}>
          {esNoche ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          <span>{esNoche ? 'Sol' : 'Noche'}</span>
        </button>
      </div>
    </header>
  );
}
