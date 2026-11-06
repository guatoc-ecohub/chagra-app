/* eslint-disable chagra-i18n/no-hardcoded-spanish -- copy de la ventana pendiente de migrar a messages.js */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, Mic, Pause, Play, X } from 'lucide-react';
import GuacamayaViva from './guacamayaViva/GuacamayaViva.jsx';
import useConversacionAngelita from './angelitaViva/useConversacionAngelita';
import { oirVozAgente, pedirFotoAlAgente } from '../../services/vozAgenteBus';
import { VOZ_REPOSO, VOZ_ESCUCHANDO, VOZ_PENSANDO, VOZ_HABLANDO, VOZ_ERROR } from '../../constants/estadosVoz';
import VozCabecera from './VozCabecera';
import { PIZARRA_GUACAMAYA, SALIDA_MS } from './guacamayaViva/ventanaGuacamaya';
import './vozFamilia.css';
import './ventanasFamilia.css';
import './ventanaGuacamaya.css';

/*
 * Ventana de voz de la guacamaya: el mismo camino de conversación real que
 * angelita (micrófono → Whisper → AgentScreen con autoSend → TTS por frases,
 * turno por vozAgenteBus) con la guacamaya viva del corto en su rama.
 * Coreografía: documentación interna documentación interna.
 */

const TITULO_PIZARRA = {
  [VOZ_REPOSO]: 'DESDE ESTA VENTANA',
  [VOZ_ESCUCHANDO]: 'LA GUACAMAYA ESCUCHA',
  [VOZ_PENSANDO]: 'LA GUACAMAYA PIENSA',
  [VOZ_HABLANDO]: 'LA GUACAMAYA RESPONDE',
  [VOZ_ERROR]: 'NO SALIÓ ESTA VEZ',
};

const ACCION_PRINCIPAL = {
  [VOZ_REPOSO]: 'Hablar con la guacamaya',
  [VOZ_HABLANDO]: 'Preguntar otra cosa',
  [VOZ_ERROR]: 'Intentar de nuevo',
};

// Para la lámina de diseño: un nivel de voz medio y una frase en curso.
const NIVEL_VISTA = { current: .45 };
const FRASE_VISTA = { indice: 1, total: 3 };

function movimientoReducido() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * `alAbrir="escuchar"` abre ya oyendo (así la monta EscuchaOverlay).
 * `estadoVista` fija un estado sin tocar el micrófono (lámina de diseño y pruebas).
 * `navegar` reemplaza cómo llega la pregunta al agente: fuera de la app (la entrada
 * suelta `voz.html`) no hay quien oiga `chagraNavigate`.
 */
/** @param {{onCerrar?: () => void, alAbrir?: string, estadoVista?: string, preguntaVista?: string, navegar?: (destino: string) => void}} props */
export default function VentanaGuacamaya({ onCerrar, alAbrir, estadoVista, preguntaVista = '', navegar }) {
  const [tema, setTema] = useState('noche');
  const [pausada, setPausada] = useState(false);
  const [foto, setFoto] = useState(null);
  const [saliendo, setSaliendo] = useState(false);
  // El turno de una foto no lo abre la voz: la ventana lo sigue por el bus (piensa, responde, frases).
  const [turnoFoto, setTurnoFoto] = useState(null);
  const cierreRef = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null));
  const conversacion = useConversacionAngelita(navegar ? { fuente: 'guacamaya', navegar } : { fuente: 'guacamaya' });
  const estado = estadoVista || (conversacion.estado === VOZ_REPOSO && turnoFoto?.estado) || conversacion.estado;
  const pregunta = estadoVista ? preguntaVista : conversacion.pregunta;
  // En error se muestra el motivo real (micrófono, red…); en lo demás, la voz de la guacamaya.
  const mirandoFoto = !estadoVista && turnoFoto && (foto?.fase === 'elegida' || foto?.fase === 'analizando');
  const pizarra = estado === VOZ_ERROR ? (estadoVista ? 'No le alcancé a oír.' : conversacion.pizarra)
    : mirandoFoto ? 'A ver esa foto… la estoy mirando con cuidado.' : PIZARRA_GUACAMAYA[estado];
  const ocupada = estado === VOZ_ESCUCHANDO || estado === VOZ_PENSANDO;
  const { escuchar } = conversacion;

  useEffect(() => {
    if (alAbrir === 'escuchar' && !estadoVista) escuchar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // La foto del agente: la mira mientras se elige y se analiza; la señala cuando llega.
  useEffect(() => oirVozAgente((ev) => {
    if (ev?.tipo === 'foto') {
      setFoto({ fase: ev.fase });
      if (ev.fase === 'elegida' || ev.fase === 'analizando') setTurnoFoto((t) => t || { estado: VOZ_PENSANDO, frase: null, hablo: false });
      if (ev.fase === 'quitada') setTurnoFoto((t) => (t && !t.hablo ? null : t));
    } else if (ev?.tipo === 'voz') {
      setTurnoFoto((t) => (t ? { ...t, esperaVoz: true } : t));
    } else if (ev?.tipo === 'turno') {
      setTurnoFoto((t) => {
        if (!t) return t;
        if (ev.hablando) return { ...t, estado: VOZ_HABLANDO, hablo: true };
        if (ev.fase === 'thinking') return { ...t, estado: VOZ_PENSANDO, penso: true };
        // En idle: terminó de hablar, o pensó y no va a hablar (TTS apagado). Si pidió voz, se espera.
        if (t.hablo || (t.penso && !t.esperaVoz)) return null;
        return t;
      });
    } else if (ev?.tipo === 'frase' && ev.frase) {
      setTurnoFoto((t) => (t ? { ...t, frase: { indice: ev.frase.indice, total: ev.frase.total } } : t));
    }
  }), []);
  useEffect(() => () => { if (cierreRef.current) clearTimeout(cierreRef.current); }, []);

  // «Mostrarle una foto»: abre la cámara del agente (el mismo input del compositor). Si el chat aún
  // no está montado, se abre el agente con la cámara lista y la foto se envía sola al elegirla.
  const mostrarFoto = useCallback(() => {
    if (pedirFotoAlAgente()) return;
    window.dispatchEvent(new CustomEvent('chagraNavigate', { detail: { view: 'agente', initialData: { autoOpenCamera: true, enviarFotoSola: true } } }));
  }, []);

  const verChat = useCallback(() => {
    if (!onCerrar) return;
    const abrirChat = () => {
      onCerrar();
      if (navegar) navegar('agente');
      else window.dispatchEvent(new CustomEvent('chagraNavigate', { detail: { view: 'agente' } }));
    };
    if (movimientoReducido() || pausada) { abrirChat(); return; }
    setSaliendo(true);
    cierreRef.current = setTimeout(abrirChat, SALIDA_MS);
  }, [onCerrar, pausada]);

  return (
    <main className="guaca-ventana voz-casa" data-tema={tema} data-pausada={pausada} data-estado={estado} data-saliendo={saliendo}>
      <div className="guaca-paisaje" aria-hidden="true">
        <div className="guaca-cielo" />
        <div className="guaca-dosel guaca-dosel-lejano" />
        <div className="guaca-dosel guaca-dosel-medio" />
        <div className="guaca-dosel guaca-dosel-cerca" />
      </div>

      <VozCabecera
        pausada={pausada}
        onPausa={() => setPausada((valor) => !valor)}
        tema={tema}
        onTema={() => setTema((valor) => (valor === 'noche' ? 'dia' : 'noche'))}
        localidad="UNA CONVERSACIÓN CON LA GUACAMAYA"
        etiquetaTemaSol="Activar modo para el sol"
      />

      <section className="guaca-escena" aria-label="Un encuentro con la guacamaya">
        <div className="guaca-presentacion">
          <p className="guaca-antetitulo"><span />GUACAMAYA BANDERA · AQUÍ, CON USTED</p>
          <h1>La chagra<br /><em>se ve desde arriba.</em></h1>
          <p className="guaca-bajada">Cuénteme qué pasa en su finca. Yo miro el conjunto; usted conoce el detalle.</p>
          <div className="voz-finca-aviso guaca-pizarra" data-testid="guacamaya-pizarra" aria-live="polite">
            <span className="voz-finca-aviso__titulo">{TITULO_PIZARRA[estado]}</span>
            <p className="voz-finca-aviso__texto">{pizarra}</p>
            {pregunta && estado !== VOZ_ESCUCHANDO && <p className="guaca-pizarra__pregunta">Usted dijo: «{pregunta}»</p>}
            {estado === VOZ_ESCUCHANDO && <span className="guaca-pizarra__cierre" style={{ '--cierre': conversacion.cierre }} aria-hidden="true" />}
          </div>
        </div>

        <div className="guaca-compai" aria-label="La guacamaya, guacamaya bandera">
          <GuacamayaViva estado={estado} pausada={pausada} foto={foto} saliendo={saliendo}
            nivelRef={estadoVista === VOZ_ESCUCHANDO ? NIVEL_VISTA : conversacion.nivelRef}
            frase={estadoVista === VOZ_HABLANDO ? FRASE_VISTA : (turnoFoto?.frase || conversacion.frase)} />
        </div>
      </section>

      <footer className="guaca-pie">
        <div className="guaca-acciones" aria-label="Controles de conversación">
          {estado === VOZ_ESCUCHANDO ? (
            <button type="button" className="guaca-principal" data-testid="guacamaya-listo" onClick={conversacion.listo}>
              <Check size={19} aria-hidden="true" /> Listo, eso era
            </button>
          ) : (
            <button type="button" className="guaca-principal" data-testid="guacamaya-hablar" disabled={ocupada} onClick={conversacion.escuchar}>
              <Mic size={19} aria-hidden="true" /> {ACCION_PRINCIPAL[estado] || 'Hablar con la guacamaya'}
            </button>
          )}
          {estado !== VOZ_REPOSO ? (
            <button type="button" className="guaca-secundario" data-testid="guacamaya-cancelar" onClick={conversacion.cancelar}>
              <X size={18} aria-hidden="true" /> {estado === VOZ_HABLANDO ? 'Callar' : 'Cancelar'}
            </button>
          ) : (
            <button type="button" className="guaca-secundario" onClick={() => setPausada((valor) => !valor)}>
              {pausada ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
              {pausada ? 'Reanudar presencia' : 'Pausar presencia'}
            </button>
          )}
          <button type="button" className="guaca-secundario" data-testid="guacamaya-foto" disabled={ocupada} onClick={mostrarFoto}>
            <Camera size={18} aria-hidden="true" /> Mostrarle una foto
          </button>
          {onCerrar && (
            <button type="button" className="guaca-secundario" data-testid="guacamaya-cerrar" onClick={verChat}>
              Ver el chat
            </button>
          )}
        </div>
        <p className="guaca-nota">La guacamaya se queda en su rama mientras usted decide qué contar.</p>
      </footer>
    </main>
  );
}
