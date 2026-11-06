import { useCallback, useEffect, useRef, useState } from 'react';
import { COPY } from './ventanaVoz.copy';

// Medios efímeros: no grabación, envío, persistencia ni permisos al entrar.
export function useMediosVoz() {
  const [modo, setModo] = useState(null);
  const [pendiente, setPendiente] = useState(null);
  const [hablando, setHablando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [oculta, setOculta] = useState(false);
  const [tiempoEscuchando, setTiempoEscuchando] = useState(0);
  const [cierreSilencio, setCierreSilencio] = useState(0);
  const recursos = useRef({ turno: 0, stream: null, contexto: null, frame: null, frase: null, espera: null, pendiente: false, escuchaDesde: 0, ultimaVoz: 0, yaHablo: false });
  const medidorRef = useRef(null);
  const ambienteRef = useRef(null);

  const liberar = useCallback(() => {
    const r = recursos.current;
    r.turno += 1;
    r.pendiente = false;
    ambienteRef.current?.style.setProperty('--nivel', '0');
    cancelAnimationFrame(r.frame);
    clearTimeout(r.espera);
    r.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    r.stream = null;
    if (r.contexto) void r.contexto.close().catch(() => {});
    r.contexto = null;
    r.escuchaDesde = 0;
    r.ultimaVoz = 0;
    r.yaHablo = false;
    if (r.frase) {
      r.frase.onstart = r.frase.onend = r.frase.onerror = null;
      window.speechSynthesis?.cancel();
    }
    r.frase = null;
  }, []);

  const detener = useCallback((mensaje = '') => {
    liberar();
    setModo(null);
    setPendiente(null);
    setHablando(false);
    setAviso(mensaje);
  }, [liberar]);

  useEffect(() => {
    if (modo !== 'microfono') return undefined;
    const reloj = window.setInterval(() => {
      const r = recursos.current;
      const ahora = Date.now();
      setTiempoEscuchando(Math.max(0, ahora - r.escuchaDesde));
      if (r.yaHablo && r.ultimaVoz) {
        setCierreSilencio(Math.min(1, (ahora - r.ultimaVoz) / 1800));
      } else {
        setCierreSilencio(0);
      }
    }, 120);
    return () => window.clearInterval(reloj);
  }, [modo]);

  useEffect(() => {
    const alOcultar = () => {
      setOculta(document.hidden);
      const r = recursos.current;
      if (document.hidden && (r.stream || r.frase || r.pendiente)) detener(COPY.oculto);
    };
    const alSalir = () => detener(COPY.oculto);
    document.addEventListener('visibilitychange', alOcultar);
    window.addEventListener('pagehide', alSalir);
    return () => {
      document.removeEventListener('visibilitychange', alOcultar);
      window.removeEventListener('pagehide', alSalir);
      liberar();
    };
  }, [detener, liberar]);

  const videoRef = useCallback((video) => {
    if (!video || !recursos.current.stream) return;
    const turno = recursos.current.turno;
    video.srcObject = recursos.current.stream;
    video.play()?.catch(() => {
      if (turno === recursos.current.turno) detener(COPY.denegado);
    });
  }, [detener]);

  async function abrir(tipo) {
    detener();
    if (!navigator.mediaDevices?.getUserMedia) { setAviso(COPY.noMedios); return; }
    const r = recursos.current;
    const turno = r.turno;
    r.pendiente = true;
    setPendiente(tipo);
    setAviso(COPY.permiso);
    // Un permiso sin resolver no mantiene la interfaz bloqueada indefinidamente.
    r.espera = setTimeout(() => {
      if (turno === r.turno) detener(COPY.permisoLento);
    }, 30000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(tipo === 'camara'
        ? { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } } }
        : { audio: true, video: false });
      if (turno !== r.turno) { stream.getTracks().forEach(track => track.stop()); return; }
      clearTimeout(r.espera);
      r.pendiente = false;
      r.stream = stream;
      stream.getTracks().forEach(track => { track.onended = () => detener(COPY.terminado); });
      setPendiente(null);
      setModo(tipo);
      if (tipo === 'microfono') {
        r.escuchaDesde = Date.now();
        r.ultimaVoz = 0;
        r.yaHablo = false;
      }
      setAviso(tipo === 'camara' ? COPY.camara : COPY.microfono);
      if (tipo !== 'microfono') return;
      const ContextoAudio = window.AudioContext || window.webkitAudioContext;
      if (!ContextoAudio) { setAviso(COPY.sinMedidor); return; }
      const contexto = new ContextoAudio();
      r.contexto = contexto;
      await contexto.resume();
      if (turno !== r.turno) return;
      const analizador = contexto.createAnalyser();
      analizador.fftSize = 256;
      contexto.createMediaStreamSource(stream).connect(analizador);
      const datos = new Uint8Array(analizador.fftSize);
      let ultimo = 0;
      const medir = (tiempo) => {
        if (turno !== r.turno) return;
        if (tiempo - ultimo >= 80) {
          analizador.getByteTimeDomainData(datos);
          const energia = datos.reduce((suma, dato) => suma + ((dato - 128) / 128) ** 2, 0) / datos.length;
          const nivel = Math.min(1, Math.sqrt(energia) * 5);
          medidorRef.current?.style.setProperty('--nivel', String(Math.max(.035, nivel)));
          ambienteRef.current?.style.setProperty('--nivel', String(nivel));
          medidorRef.current?.setAttribute('aria-valuenow', String(Math.round(nivel * 100)));
          if (nivel >= .14) {
            r.yaHablo = true;
            r.ultimaVoz = Date.now();
          } else if (r.yaHablo && Date.now() - r.ultimaVoz >= 1800) {
            detener(COPY.silencio);
            return;
          }
          ultimo = tiempo;
        }
        r.frame = requestAnimationFrame(medir);
      };
      r.frame = requestAnimationFrame(medir);
    } catch {
      if (turno === r.turno) detener(COPY.denegado);
    }
  }

  function decir(texto, { ejemplo = true } = {}) {
    detener();
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { setAviso(COPY.noVoz); return; }
    const r = recursos.current;
    const turno = r.turno;
    const frase = new window.SpeechSynthesisUtterance(texto);
    frase.lang = 'es-CO';
    frase.rate = .88;
    // Solo voces instaladas, para que esta prueba no dependa de una voz remota.
    const voz = window.speechSynthesis.getVoices().find(v => v.localService && /^es[-_]/i.test(v.lang));
    if (!voz) { setAviso(COPY.sinVozLocal); return; }
    frase.voice = voz;
    r.frase = frase;
    setPendiente('voz');
    setAviso(COPY.preparandoVoz);
    const fallo = () => { if (turno === r.turno) detener(COPY.errorVoz); };
    r.espera = setTimeout(fallo, 10000);
    frase.onstart = () => {
      if (turno !== r.turno) return;
      clearTimeout(r.espera);
      r.espera = setTimeout(fallo, Math.max(60000, Math.min(600000, texto.length * 150)));
      setPendiente(null);
      setHablando(true);
      setAviso(ejemplo ? COPY.vozLocal : COPY.lecturaLocal);
    };
    frase.onend = () => { if (turno === r.turno) detener(ejemplo ? COPY.vozTerminada : COPY.lecturaTerminada); };
    frase.onerror = fallo;
    try { window.speechSynthesis.speak(frase); } catch { fallo(); }
  }

  return { modo, pendiente, hablando, aviso, oculta, tiempoEscuchando: modo === 'microfono' ? tiempoEscuchando : 0, cierreSilencio: modo === 'microfono' ? cierreSilencio : 0, medidorRef, ambienteRef, videoRef, abrir, decir, detener };
}
