/* eslint-disable chagra-i18n/no-hardcoded-spanish -- copy de la ventana pendiente de migrar a messages.js */
import { useEffect, useState } from 'react';
import { Check, Mic, Pause, Play, X } from 'lucide-react';
import AngelitaViva from './angelitaViva/AngelitaViva.jsx';
import useConversacionAngelita, { PIZARRA } from './angelitaViva/useConversacionAngelita';
import { VOZ_REPOSO, VOZ_ESCUCHANDO, VOZ_PENSANDO, VOZ_HABLANDO, VOZ_ERROR } from '../../constants/estadosVoz';
import VozCabecera from './VozCabecera';
import './vozFamilia.css';
import './ventanaAngelita.css';
import './ventanasFamilia.css';

const TITULO_PIZARRA = {
  [VOZ_REPOSO]: 'DESDE ESTA VENTANA',
  [VOZ_ESCUCHANDO]: 'ANGELITA ESCUCHA',
  [VOZ_PENSANDO]: 'ANGELITA PIENSA',
  [VOZ_HABLANDO]: 'ANGELITA RESPONDE',
  [VOZ_ERROR]: 'NO SALIÓ ESTA VEZ',
};

// Para la lámina de diseño: un nivel de voz medio y una frase en curso.
const NIVEL_VISTA = { current: .45 };
const FRASE_VISTA = { indice: 1, total: 3 };

const ACCION_PRINCIPAL = {
  [VOZ_REPOSO]: 'Hablar con Angelita',
  [VOZ_HABLANDO]: 'Preguntar otra cosa',
  [VOZ_ERROR]: 'Intentar de nuevo',
};

/**
 * Ventana de voz de angelita. `alAbrir="escuchar"` abre ya oyendo (así la
 * monta EscuchaOverlay). `estadoVista` fija un estado sin tocar el
 * micrófono: sirve para la lámina de diseño y las pruebas; en la app se
 * deja vacío y el estado lo lleva la conversación real.
 */
export default function VentanaAngelita({ onCerrar, alAbrir, estadoVista, preguntaVista = '' }) {
  const [tema, setTema] = useState('noche');
  const [pausada, setPausada] = useState(false);
  const conversacion = useConversacionAngelita();
  const estado = estadoVista || conversacion.estado;
  const pregunta = estadoVista ? preguntaVista : conversacion.pregunta;
  const pizarra = estadoVista ? PIZARRA[estadoVista] : conversacion.pizarra;
  const ocupada = estado === VOZ_ESCUCHANDO || estado === VOZ_PENSANDO;
  const { escuchar } = conversacion;

  // Abierta por la escucha manos libres (tap o «hola Chagra»): ya viene a oír.
  useEffect(() => {
    if (alAbrir === 'escuchar' && !estadoVista) escuchar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="angelita-ventana voz-casa" data-tema={tema} data-pausada={pausada} data-estado={estado}>
      <div className="angelita-paisaje" aria-hidden="true">
        <div className="angelita-cielo" />
        <div className="angelita-luz" />
        <div className="angelita-montana angelita-montana-lejana" />
        <div className="angelita-montana angelita-montana-media" />
        <div className="angelita-pradera" />
        <div className="angelita-rama angelita-rama-izquierda" />
        <div className="angelita-rama angelita-rama-derecha" />
        <div className="angelita-motas" />
      </div>

      <VozCabecera
        pausada={pausada}
        onPausa={() => setPausada((valor) => !valor)}
        tema={tema}
        onTema={() => setTema((valor) => valor === 'noche' ? 'dia' : 'noche')}
        localidad="UNA CONVERSACIÓN CON ANGELITA"
        etiquetaTemaSol="Activar modo para el sol"
      />

      <section className="angelita-escena" aria-label="Un encuentro con Angelita">
        <div className="angelita-presentacion">
          <p className="angelita-antetitulo"><span />ABEJA ANGELITA · AQUÍ, CON USTED</p>
          <h1>La chagra<br /><em>se escucha.</em></h1>
          <p className="angelita-bajada">Cuénteme qué está pasando en su finca. Angelita le acompaña con atención.</p>
          <div className="voz-finca-aviso angelita-pizarra" data-testid="angelita-pizarra" aria-live="polite">
            <span className="voz-finca-aviso__titulo">{TITULO_PIZARRA[estado]}</span>
            <p className="voz-finca-aviso__texto">{pizarra}</p>
            {pregunta && estado !== VOZ_ESCUCHANDO && <p className="angelita-pizarra__pregunta">Usted dijo: «{pregunta}»</p>}
            {estado === VOZ_ESCUCHANDO && <span className="angelita-pizarra__cierre" style={{ '--cierre': conversacion.cierre }} aria-hidden="true" />}
          </div>
        </div>

        <div className="angelita-compai" aria-label="Angelita, abeja angelita">
          <AngelitaViva estado={estado} pausada={pausada}
            nivelRef={estadoVista === VOZ_ESCUCHANDO ? NIVEL_VISTA : conversacion.nivelRef}
            frase={estadoVista === VOZ_HABLANDO ? FRASE_VISTA : conversacion.frase} />
          <span className="angelita-etiqueta">Angelita <small>ABEJA ANGELITA</small></span>
        </div>
      </section>

      <footer className="angelita-pie">
        <div className="angelita-acciones" aria-label="Controles de conversación">
          {estado === VOZ_ESCUCHANDO ? (
            <button type="button" className="angelita-principal" data-testid="angelita-listo" onClick={conversacion.listo}>
              <Check size={19} aria-hidden="true" /> Listo, eso era
            </button>
          ) : (
            <button type="button" className="angelita-principal" data-testid="angelita-hablar" disabled={ocupada} onClick={conversacion.escuchar}>
              <Mic size={19} aria-hidden="true" /> {ACCION_PRINCIPAL[estado] || 'Hablar con Angelita'}
            </button>
          )}
          {estado !== VOZ_REPOSO ? (
            <button type="button" className="angelita-secundario" data-testid="angelita-cancelar" onClick={conversacion.cancelar}>
              <X size={18} aria-hidden="true" /> {estado === VOZ_HABLANDO ? 'Callar' : 'Cancelar'}
            </button>
          ) : (
            <button type="button" className="angelita-secundario" onClick={() => setPausada((valor) => !valor)}>
              {pausada ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
              {pausada ? 'Reanudar presencia' : 'Pausar presencia'}
            </button>
          )}
          {onCerrar && (
            <button type="button" className="angelita-secundario" data-testid="angelita-cerrar" onClick={onCerrar}>
              Ver el chat
            </button>
          )}
        </div>
        <p className="angelita-nota">La abeja permanece aquí mientras usted decide qué contar.</p>
      </footer>
    </main>
  );
}
