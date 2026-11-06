import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, Mic, Moon, Square, Sun, Volume2 } from 'lucide-react';
import OsoBaston from '../../visual/creatures/OsoBaston.jsx';
import { VOZ_REPOSO, VOZ_ESCUCHANDO, VOZ_PENSANDO, VOZ_HABLANDO, VOZ_ERROR } from '../../constants/estadosVoz.js';
import './encuentro-compai.css';
import { responder } from './responderCompai.js';

const DIRECCION = {
  [VOZ_REPOSO]: { titulo: 'Aquí estoy.', detalle: 'Cuénteme, ¿cómo va todo?', pose: 'anda', giro: '0deg' },
  [VOZ_ESCUCHANDO]: { titulo: 'Lo escucho.', detalle: 'Hable tranquilo. Al terminar, toque el botón.', pose: 'reposo', giro: '-5deg' },
  [VOZ_PENSANDO]: { titulo: 'Déjeme pensar.', detalle: 'Estoy buscando cómo ayudarle.', pose: 'reposo', giro: '4deg' },
  [VOZ_HABLANDO]: { titulo: 'Le cuento.', detalle: 'Puede detener mi voz cuando quiera.', pose: 'señala', giro: '0deg' },
  [VOZ_ERROR]: { titulo: 'Vamos despacio.', detalle: 'Su pregunta sigue aquí.', pose: 'reposo', giro: '-8deg' },
};

/** @typedef {{quien: 'usted'|'compai', texto: string}} Turno */
/** @typedef {{lang: string, interimResults: boolean, onstart: (() => void)|null, onend: (() => void)|null, onerror: (() => void)|null, onresult: ((event: {results: ArrayLike<ArrayLike<{transcript: string}>>}) => void)|null, start: () => void, stop: () => void, abort: () => void}} Reconocimiento */
/** @typedef {new () => Reconocimiento} ConstructorReconocimiento */
/** @typedef {Window & {SpeechRecognition?: ConstructorReconocimiento, webkitSpeechRecognition?: ConstructorReconocimiento}} WindowConReconocimiento */

/** Conversación temporal: no escribe Assets, Logs ni historial en disco. */
/** @param {{onBack?: () => void, responderPregunta?: (historial: Turno[], signal: AbortSignal) => Promise<string>}} props */
export default function EncuentroCompai({ onBack, responderPregunta = responder }) {
  const [estado, setEstado] = useState(VOZ_REPOSO);
  const [noche, setNoche] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [historial, setHistorial] = useState(/** @type {Turno[]} */ ([]));
  const [borrador, setBorrador] = useState('');
  const [error, setError] = useState('');
  const [voz, setVoz] = useState(false);
  const [boca, setBoca] = useState(null);
  const reconocimiento = useRef(/** @type {Reconocimiento|null} */ (null));
  const solicitud = useRef(null);
  const ocupado = useRef(false);
  const audio = useRef(/** @type {SpeechSynthesisUtterance|null} */ (null));
  const entrada = useRef(null);
  const direccion = DIRECCION[estado];
  const ultimoUsuario = [...historial].reverse().find(m => m.quien === 'usted');
  const ultimaRespuesta = historial.at(-1)?.quien === 'compai' ? historial.at(-1) : null;
  const puedeLeer = Boolean(window.speechSynthesis);
  const puedeEscuchar = typeof window !== 'undefined' && Boolean(/** @type {WindowConReconocimiento} */ (window).SpeechRecognition || /** @type {WindowConReconocimiento} */ (window).webkitSpeechRecognition);

  useEffect(() => () => {
    solicitud.current?.abort();
    solicitud.current = null;
    const rec = reconocimiento.current;
    if (rec) { rec.onend = null; rec.onerror = null; rec.onresult = null; rec.abort(); }
    if (audio.current) { audio.current.onstart = null; audio.current.onboundary = null; audio.current.onend = null; audio.current.onerror = null; window.speechSynthesis?.cancel(); }
  }, []);

  function detenerVoz() {
    if (audio.current) { audio.current.onstart = null; audio.current.onboundary = null; audio.current.onend = null; audio.current.onerror = null; window.speechSynthesis?.cancel(); audio.current = null; }
    setBoca(null);
    setEstado(VOZ_REPOSO);
  }

  function leer(texto) {
    if (!window.speechSynthesis) return;
    detenerVoz();
    const frase = new SpeechSynthesisUtterance(texto);
    frase.lang = 'es-CO';
    frase.rate = 0.9;
    frase.onstart = () => { setEstado(VOZ_HABLANDO); setBoca('V2'); };
    frase.onboundary = () => setBoca(prev => prev === 'V2' ? 'V1' : 'V2');
    frase.onend = detenerVoz;
    frase.onerror = () => { detenerVoz(); setError('No pude leer en voz alta. Puede leer mi respuesta aquí.'); };
    audio.current = frase;
    window.speechSynthesis.speak(frase);
  }

  async function enviar(event) {
    event.preventDefault();
    const texto = borrador.trim();
    if (!texto || ocupado.current || reconocimiento.current) return;
    prepararTurno();
    const base = historial.at(-1)?.quien === 'usted' && historial.at(-1)?.texto === texto ? historial.slice(0, -1) : historial;
    const siguiente = /** @type {Turno[]} */ ([...base, { quien: 'usted', texto }]);
    setHistorial(siguiente);
    setBorrador('');
    setEstado(VOZ_PENSANDO);
    ocupado.current = true;
    const controller = new AbortController();
    solicitud.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const respuesta = await responderPregunta(siguiente, controller.signal);
      if (solicitud.current !== controller) return;
      if (controller.signal.aborted) throw new Error('timeout');
      if (!respuesta?.trim()) throw new Error('empty');
      setHistorial(/** @type {Turno[]} */ ([...siguiente, { quien: 'compai', texto: respuesta }]));
      setEstado(VOZ_REPOSO);
      if (voz) leer(respuesta);
    } catch {
      if (solicitud.current !== controller) return;
      setError('No pude responder. Revise su conexión y vuelva a enviar su pregunta.');
      setBorrador(texto);
      setEstado(VOZ_ERROR);
    } finally {
      clearTimeout(timeout);
      ocupado.current = false;
      if (solicitud.current === controller) solicitud.current = null;
    }
  }

  function prepararTurno() { detenerVoz(); setError(''); }

  function escuchar() {
    if (reconocimiento.current) { reconocimiento.current.stop(); return; }
    prepararTurno();
    const { SpeechRecognition, webkitSpeechRecognition } = /** @type {WindowConReconocimiento} */ (window);
    const Reconocer = SpeechRecognition || webkitSpeechRecognition;
    if (!Reconocer) { entrada.current?.focus(); return; }
    const rec = new Reconocer();
    rec.lang = 'es-CO';
    rec.interimResults = true;
    const previo = borrador.trim();
    reconocimiento.current = rec;
    rec.onresult = event => {
      const texto = Array.from(event.results, resultado => resultado[0].transcript).join(' ');
      setBorrador([previo, texto].filter(Boolean).join(' '));
    };
    rec.onerror = () => { setError('No pude escuchar. Puede escribir o intentar otra vez.'); setEstado(VOZ_ERROR); };
    rec.onend = () => { reconocimiento.current = null; setEstado(actual => actual === VOZ_ESCUCHANDO ? VOZ_REPOSO : actual); entrada.current?.focus(); };
    rec.onstart = () => setEstado(VOZ_ESCUCHANDO);
    setEstado(VOZ_ESCUCHANDO);
    try { rec.start(); } catch { reconocimiento.current = null; setError('El micrófono no está disponible. Puede escribir.'); setEstado(VOZ_ERROR); }
  }

  return (
    <main className="encuentro" data-noche={noche} data-estado={estado}>
      <div className="encuentro-marco">
        <header className="encuentro-cabecera">
          {onBack ? <button type="button" onClick={onBack} aria-label="Volver"><ArrowLeft size={22} /></button> : <span className="encuentro-marca">CHAGRA</span>}
          <span className="encuentro-lugar">Un rato con el compai</span>
          <button type="button" onClick={() => setNoche(!noche)} aria-label={noche ? 'Usar modo sol' : 'Usar modo noche'}>{noche ? <Sun size={20} /> : <Moon size={20} />}<span>{noche ? 'Sol' : 'Noche'}</span></button>
        </header>
        <section className="encuentro-presencia" aria-label="Su compai">
          <div className="encuentro-saludo" role="status"><span className="encuentro-ceja">AQUÍ, CON USTED</span><h1>{direccion.titulo}</h1><p>{direccion.detalle}</p></div>
          <div className="encuentro-claro" aria-hidden="true">
            <div className="encuentro-sol" />
            <div className="encuentro-oso" style={{ '--giro': direccion.giro }}>
              <OsoBaston size={320} pose={direccion.pose} modo={estado === VOZ_HABLANDO ? 'actuando' : 'normal'} tier="bajo" vida={false} lineBoil={false} visema={boca} resopla={estado === VOZ_PENSANDO} florece={estado === VOZ_HABLANDO} />
            </div>
            <div className="encuentro-huellas"><i /><i /><i /></div>
          </div>
        </section>
        <section className="encuentro-palabras" aria-label="Conversación">
          {ultimoUsuario ? <div className="encuentro-usted"><span className="encuentro-ceja">USTED DIJO</span><p>{ultimoUsuario.texto}</p></div> : null}
          <div className="encuentro-respuesta" aria-live="polite" aria-atomic="true">
            <span className="encuentro-ceja">EL COMPAI</span>
            <p>{estado === VOZ_PENSANDO ? 'Me quedo con su pregunta. Un momento…' : ultimaRespuesta?.texto || (ultimoUsuario ? 'No alcancé a responder. Puede intentar de nuevo.' : 'Hay días que traen preguntas. Otros, solo ganas de conversar. Lo escucho.')}</p>
          </div>
          {puedeLeer && ultimaRespuesta && estado !== VOZ_PENSANDO && estado !== VOZ_ESCUCHANDO ? <button className="encuentro-leer" type="button" onClick={() => estado === VOZ_HABLANDO ? detenerVoz() : leer(ultimaRespuesta.texto)}><Volume2 size={19} />{estado === VOZ_HABLANDO ? 'Detener voz' : 'Escuchar respuesta'}</button> : null}
          {historial.length > 2 ? <details className="encuentro-historia"><summary>Lo que hemos conversado</summary>{historial.map((mensaje, index) => <p key={index}><strong>{mensaje.quien === 'usted' ? 'Usted' : 'Compai'}: </strong>{mensaje.texto}</p>)}</details> : null}
        </section>
        <footer className="encuentro-pie">
          {error ? <p className="encuentro-error" role="alert">{error}</p> : null}
          <form onSubmit={enviar}>
            <label htmlFor="encuentro-pregunta">{estado === VOZ_ESCUCHANDO ? 'Esto voy escuchando' : '¿Qué tiene en mente?'}</label>
            <div className="encuentro-escribir"><textarea ref={entrada} id="encuentro-pregunta" rows={2} value={borrador} onChange={e => setBorrador(e.target.value)} placeholder="Escriba aquí, a su manera…" disabled={estado === VOZ_PENSANDO || estado === VOZ_ESCUCHANDO} /><button type="submit" aria-label="Enviar pregunta" disabled={!borrador.trim() || estado === VOZ_PENSANDO || estado === VOZ_ESCUCHANDO}><ArrowUp size={25} /></button></div>
            <div className="encuentro-acciones"><button className="encuentro-hablar" type="button" onClick={escuchar} disabled={estado === VOZ_PENSANDO || !puedeEscuchar}>{estado === VOZ_ESCUCHANDO ? <Square size={21} /> : <Mic size={23} />} {estado === VOZ_ESCUCHANDO ? 'Terminé de hablar' : 'Hablar con el compai'}</button><label className="encuentro-voz"><input type="checkbox" disabled={!puedeLeer} checked={voz} onChange={e => { setVoz(e.target.checked); if (!e.target.checked && estado === VOZ_HABLANDO) detenerVoz(); }} />Con voz</label></div>
            <p className="encuentro-nota">{puedeEscuchar ? 'Toque para hablar. Revise sus palabras antes de enviar.' : 'En este teléfono, conversemos por escrito.'}</p>
          </form>
        </footer>
      </div>
    </main>
  );
}
