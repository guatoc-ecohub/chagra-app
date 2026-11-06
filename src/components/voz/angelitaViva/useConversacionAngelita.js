/**
 * useConversacionAngelita — la conversación real detrás de la ventana de
 * angelita, con el mismo camino que usa la escucha manos libres de la PWA:
 *
 *   micrófono (useVoiceRecorder) → Whisper (voiceService.transcribe)
 *   → routeUtterance → AgentScreen con autoSend + fromVoice
 *   → la respuesta se dice por ttsService.speakSentences (Kokoro)
 *
 * Lo único nuevo es que la ventana NO se cierra al mandar la pregunta: se
 * queda encima del agente y sigue el turno por `vozAgenteBus` para que
 * angelita piense mientras llega la respuesta y gesticule en cada frase.
 *
 * El nivel del micrófono va por ref (`nivelRef`): el lienzo lo lee en cada
 * cuadro sin re-render. Umbrales de manos libres: los de EscuchaOverlay.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import useVoiceRecorder from '../../../hooks/useVoiceRecorder';
import { transcribe, queueForRetry } from '../../../services/voiceService';
import { routeUtterance } from '../../../services/escuchaIntentRouter';
import { oirVozAgente } from '../../../services/vozAgenteBus';
import { stop as callarVoz } from '../../../services/ttsService';
import { mensajeErrorMicrofono } from '../../escucha/escuchaOverlayUtils';
import { VOZ_REPOSO, VOZ_ESCUCHANDO, VOZ_PENSANDO, VOZ_HABLANDO, VOZ_ERROR } from '../../../constants/estadosVoz';

export const UMBRAL_VOZ = 0.14;
const SILENCIO_MS = 1800;
const MIN_ESCUCHA_MS = 1500;
const TOPE_ESCUCHA_MS = 25000;
// Si el agente termina sin pedir voz, o pide voz y no suena, no se queda
// pensando para siempre.
const GRACIA_SIN_VOZ_MS = 3000;
const GRACIA_VOZ_MUDA_MS = 15000;

const navegarPorDefecto = (view, initialData = null) => {
  window.dispatchEvent(new CustomEvent('chagraNavigate', { detail: { view, initialData } }));
};

function registrar(detalle) {
  window.dispatchEvent(new CustomEvent('angelita-viva:registro', { detail: { ...detalle, t: performance.now() } }));
}

export const PIZARRA = {
  [VOZ_REPOSO]: 'Toque «Hablar con Angelita» y cuénteme qué pasa en su finca.',
  [VOZ_ESCUCHANDO]: 'Le escucho. Cuando se quede callado, le contesto.',
  [VOZ_PENSANDO]: 'Déjeme pensarlo un momento.',
  [VOZ_HABLANDO]: 'Le estoy contestando en voz alta. La respuesta también queda escrita.',
  [VOZ_ERROR]: 'No le alcancé a oír.',
};

// `fuente`: qué compai abrió la conversación (la ventana de la guacamaya reusa este mismo camino).
export default function useConversacionAngelita({ navegar = navegarPorDefecto, fuente = 'angelita' } = {}) {
  const { audioLevel, start, stop, reset } = useVoiceRecorder();
  const [estado, setEstadoCrudo] = useState(VOZ_REPOSO);
  const [frase, setFrase] = useState(null);
  const [pizarra, setPizarra] = useState(PIZARRA[VOZ_REPOSO]);
  const [pregunta, setPregunta] = useState('');
  const [cierre, setCierre] = useState(0);

  const estadoRef = useRef(VOZ_REPOSO);
  const nivelRef = useRef(0);
  const turnoRef = useRef({ activo: false, penso: false, vozPedida: false, sonando: false, espera: null });
  const escuchaRef = useRef({ abierta: 0, yaHablo: false, ultimaVoz: 0, finalizando: false });
  const escuchaIdRef = useRef(0);

  const setEstado = useCallback((nuevo, texto) => {
    estadoRef.current = nuevo;
    setEstadoCrudo(nuevo);
    setPizarra(texto ?? PIZARRA[nuevo]);
  }, []);

  const soltarTurno = useCallback(() => {
    const r = turnoRef.current;
    clearTimeout(r.espera);
    turnoRef.current = { activo: false, penso: false, vozPedida: false, sonando: false, espera: null };
  }, []);

  // El nivel real solo mueve a angelita mientras escucha; fuera de ahí, 0.
  useEffect(() => {
    nivelRef.current = estado === VOZ_ESCUCHANDO ? audioLevel : 0;
    if (estado !== VOZ_ESCUCHANDO) return;
    const e = escuchaRef.current;
    if (audioLevel > UMBRAL_VOZ) { e.yaHablo = true; e.ultimaVoz = Date.now(); }
  }, [audioLevel, estado]);

  const finalizar = useCallback(async () => {
    const e = escuchaRef.current;
    if (e.finalizando) return;
    e.finalizando = true;
    setCierre(0);
    setEstado(VOZ_PENSANDO);
    const resultado = await stop();
    if (!resultado?.blob || resultado.blob.size === 0) {
      e.finalizando = false;
      setEstado(VOZ_ERROR, 'No alcancé a oírle. Acérquese al micrófono e intente de nuevo.');
      return;
    }
    let texto;
    try {
      texto = await transcribe(resultado.blob);
    } catch (err) {
      queueForRetry(resultado.blob, { reason: `angelita: ${err?.message || 'transcribe failed'}`, durationMs: resultado.durationMs || 0 }).catch(() => {});
      e.finalizando = false;
      setEstado(VOZ_ERROR, 'No pude entenderle esta vez. Guardé el audio para reintentarlo.');
      return;
    }
    e.finalizando = false;
    registrar({ tipo: 'transcripcion', texto });
    setPregunta(texto);
    const ruta = routeUtterance(texto);
    if (ruta.tipo === 'navegar') {
      setEstado(VOZ_REPOSO, `Abriendo ${ruta.etiqueta}.`);
      navegar(ruta.view, /** @type {any} */ (ruta).initialData);
      return;
    }
    const r = turnoRef.current;
    r.activo = true;
    r.espera = setTimeout(() => {
      // El agente nunca abrió el turno: no dejamos a angelita pensando sola.
      if (turnoRef.current.activo && !turnoRef.current.vozPedida) {
        soltarTurno();
        setEstado(VOZ_REPOSO, 'Le dejé la respuesta escrita en el chat.');
      }
    }, 60000);
    navegar('agente', { prefilledPrompt: ruta.prompt, autoSend: true, fromVoice: true, fuente });
  }, [stop, navegar, fuente, setEstado, soltarTurno]);

  // Vigía de silencio: igual que la escucha manos libres.
  useEffect(() => {
    if (estado !== VOZ_ESCUCHANDO) return undefined;
    const reloj = setInterval(() => {
      const e = escuchaRef.current;
      const ahora = Date.now();
      const desde = ahora - e.abierta;
      if (desde >= TOPE_ESCUCHA_MS) { finalizar(); return; }
      if (!e.yaHablo || desde < MIN_ESCUCHA_MS) { setCierre(0); return; }
      const callado = ahora - e.ultimaVoz;
      if (callado >= SILENCIO_MS) { finalizar(); return; }
      setCierre(Math.min(1, callado / SILENCIO_MS));
    }, 120);
    return () => clearInterval(reloj);
  }, [estado, finalizar]);

  // El turno del agente, tal como AgentScreen lo publica.
  useEffect(() => oirVozAgente((ev) => {
    const r = turnoRef.current;
    if (!r.activo) return;
    if (ev.tipo === 'voz') {
      r.vozPedida = true;
      clearTimeout(r.espera);
      r.espera = setTimeout(() => {
        if (turnoRef.current.activo && !turnoRef.current.sonando) {
          soltarTurno();
          setEstado(VOZ_REPOSO, 'No pude decirlo en voz alta. Le dejé la respuesta escrita.');
        }
      }, GRACIA_VOZ_MUDA_MS);
      return;
    }
    if (ev.tipo === 'frase') {
      r.sonando = true;
      clearTimeout(r.espera);
      if (estadoRef.current !== VOZ_HABLANDO) setEstado(VOZ_HABLANDO);
      setFrase({ ...ev.frase });
      return;
    }
    if (ev.tipo !== 'turno') return;
    if (ev.hablando) {
      r.sonando = true;
      clearTimeout(r.espera);
      if (estadoRef.current !== VOZ_HABLANDO) setEstado(VOZ_HABLANDO);
      return;
    }
    if (ev.fase === 'thinking') {
      // El agente tomó la pregunta: ya no corre el reloj de «nunca llegó».
      r.penso = true;
      clearTimeout(r.espera);
      if (estadoRef.current !== VOZ_PENSANDO) setEstado(VOZ_PENSANDO);
      return;
    }
    // El `idle` que AgentScreen publica al montar llega antes de pensar: no
    // cierra nada.
    if (ev.fase !== 'idle' || !r.penso) return;
    if (ev.error) { soltarTurno(); setEstado(VOZ_ERROR, ev.error); return; }
    if (r.sonando) { soltarTurno(); setEstado(VOZ_REPOSO); return; }
    if (!r.vozPedida) {
      clearTimeout(r.espera);
      r.espera = setTimeout(() => {
        if (turnoRef.current.activo && !turnoRef.current.vozPedida) {
          soltarTurno();
          setEstado(VOZ_REPOSO, 'Le dejé la respuesta escrita en el chat.');
        }
      }, GRACIA_SIN_VOZ_MS);
    }
  }), [setEstado, soltarTurno]);

  const resetRef = useRef(reset);
  useEffect(() => { resetRef.current = reset; }, [reset]);
  useEffect(() => () => { soltarTurno(); resetRef.current(); }, [soltarTurno]);

  const escuchar = useCallback(async () => {
    if (estadoRef.current === VOZ_ESCUCHANDO || estadoRef.current === VOZ_PENSANDO) return;
    if (estadoRef.current === VOZ_HABLANDO) callarVoz();
    soltarTurno();
    setFrase(null);
    setPregunta('');
    const escuchaId = ++escuchaIdRef.current;
    escuchaRef.current = { abierta: Date.now(), yaHablo: false, ultimaVoz: Date.now(), finalizando: false };
    setEstado(VOZ_ESCUCHANDO);
    try {
      await start();
    } catch (err) {
      if (escuchaIdRef.current !== escuchaId) return;
      setEstado(VOZ_ERROR, mensajeErrorMicrofono(err));
    }
  }, [start, setEstado, soltarTurno]);

  const cancelar = useCallback(() => {
    escuchaIdRef.current += 1;
    if (estadoRef.current === VOZ_ESCUCHANDO) stop().catch(() => {});
    if (estadoRef.current === VOZ_HABLANDO) callarVoz();
    soltarTurno();
    reset();
    escuchaRef.current.finalizando = false;
    setCierre(0);
    setEstado(VOZ_REPOSO);
  }, [stop, reset, setEstado, soltarTurno]);

  return { estado, frase, pizarra, pregunta, cierre, nivelRef, escuchar, listo: finalizar, cancelar };
}
