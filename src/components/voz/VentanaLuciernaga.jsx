/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Ventana independiente con tratamiento de usted. */
import { useId, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, ChevronDown, ChevronUp, Mic, Square, Volume2 } from 'lucide-react';
import NocheLuciernaga from './NocheLuciernaga';
import ConversacionVoz from './ConversacionVoz';
import { useConversacionGuardada } from './useConversacionGuardada';
import { useMediosVoz } from './useMediosVoz';
import { COPY, MOMENTOS, RESPUESTA_EJEMPLO } from './ventanaVoz.copy';
import { CONVERSACION as C, EJEMPLO_CONVERSACION } from './conversacion.copy';
import './ventanaLuciernaga.css';
import ContextoFincaAviso from './ContextoFincaAviso';
import VozCabecera from './VozCabecera';
import './vozFamilia.css';
import './ventanasFamilia.css';
import { EscuchaEnVivo } from './VentanaEstado';

const VACIO = [];

/** @param {{messages?: Array<{id?: string, role?: string, content?: string, metadata?: Record<string, unknown>}>, isStreaming?: boolean, streamingContent?: string, lamina?: import('react').ReactNode}} props */
export default function VentanaLuciernaga({ messages, isStreaming = false, streamingContent = '', lamina = null }) {
  const id = useId();
  const [pausada, setPausada] = useState(false);
  const [tema, setTema] = useState('noche');
  const [abierta, setAbierta] = useState(true);
  const [paso, setPaso] = useState(-1);
  const [origen, setOrigen] = useState('vacio');
  const [lectura, setLectura] = useState(null);
  const guardada = useConversacionGuardada();
  const medios = useMediosVoz();
  const { modo, pendiente, hablando, aviso, oculta, tiempoEscuchando, cierreSilencio, detener, videoRef, medidorRef } = medios;
  const momento = MOMENTOS[paso];
  const estado = hablando ? 'hablando' : modo === 'camara' ? 'mirando' : modo === 'microfono' ? 'escuchando'
    : isStreaming ? 'pensando' : momento?.estado || 'presente';
  const conversacion = messages ?? (origen === 'guardada' ? guardada.messages : origen === 'ejemplo' ? EJEMPLO_CONVERSACION : VACIO);
  const ocupado = modo || pendiente || hablando;
  const titulo = hablando ? 'Se lo cuento despacio.' : modo === 'camara' ? 'Acerque lo que quiere mirar.'
    : modo === 'microfono' ? 'Cuénteme. Hay tiempo.' : isStreaming ? 'La respuesta viene en camino.' : momento?.titulo;

  function irAlPaso(nuevo) {
    detener();
    setPaso(nuevo);
    if (nuevo >= 0) { setOrigen('ejemplo'); setAbierta(true); }
  }
  function abrir(tipo) {
    setPaso(-1);
    void medios.abrir(tipo);
  }
  function leer(mensaje) {
    setLectura(mensaje);
    medios.decir(mensaje.content, { ejemplo: messages === undefined && origen === 'ejemplo' });
  }

  return <main className="luci-ventana voz-casa" data-estado={estado} data-tema={tema} data-pausada={pausada || oculta}>
    <VozCabecera pausada={pausada} onPausa={() => setPausada(p => !p)} tema={tema} onTema={() => setTema(t => t === 'dia' ? 'noche' : 'dia')} localidad="UNA CONVERSACIÓN EN LA CHAGRA" />

    <section className="luci-encuentro" aria-label="La luciérnaga ilumina una hoja sobre el agua">
      <div className="luci-saludo">
        <p className="luci-ceja">A LA LUZ DE LO PEQUEÑO</p>
        <h1>{titulo || <>Aquí estoy.<br /><em>Miremos con calma.</em></>}</h1>
        <ContextoFincaAviso />
        <EscuchaEnVivo modo={modo} pendiente={pendiente} tiempoEscuchando={tiempoEscuchando} cierreSilencio={cierreSilencio} />
      </div>
      <div className="luci-paisaje"><NocheLuciernaga estado={estado} pausada={pausada || oculta} /></div>
      <div className="luci-presencia" role="status">
        <span className="luci-latido" aria-hidden="true" />
        {pendiente === 'voz' ? 'Preparando lectura' : pendiente ? 'Esperando permiso' : hablando ? 'Leyendo en voz alta' : modo ? 'Prueba local' : momento ? `Ejemplo: ${momento.verbo.toLowerCase()}` : isStreaming ? 'Recibiendo respuesta' : 'Aquí, con usted'}
      </div>
      {modo || (pendiente && pendiente !== 'voz') || lamina ? <section className="luci-muestra" aria-label={C.dibujo}>
        {modo === 'camara' ? <video ref={videoRef} autoPlay muted playsInline aria-label="Vista local de la cámara, sin análisis de imagen" />
          : modo === 'microfono' ? <div className="luci-sonido"><Mic size={24} aria-hidden="true" />
            <div className="luci-medidor" ref={medidorRef} role="meter" aria-label="Nivel de sonido del micrófono" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}><span /></div>
            <p>Sin grabar ni transcribir.</p></div>
          : pendiente && pendiente !== 'voz' ? <p>Puede cancelar mientras decide.</p> : lamina}
        {modo === 'camara' ? <p>Solo vista local. Sin análisis.</p> : null}
      </section> : null}
    </section>

    <aside className="luci-cuaderno" aria-label="Cuaderno de conversación">
      <button className="luci-cuaderno-tapa" type="button" aria-expanded={abierta} aria-controls={`${id}-cuaderno`} onClick={() => setAbierta(a => !a)}>
        <span>La conversación <small>{isStreaming ? 'Llegan palabras…' : conversacion.length ? `${conversacion.length} turnos` : 'A mano, sin prisa'}</small></span>
        {abierta ? <ChevronDown size={19} aria-hidden="true" /> : <ChevronUp size={19} aria-hidden="true" />}
      </button>
      <div id={`${id}-cuaderno`} hidden={!abierta}>
        <ConversacionVoz messages={conversacion} isStreaming={isStreaming} streamingContent={streamingContent} nombreCompai="Luciérnaga"
          etiqueta={messages !== undefined ? '' : origen === 'guardada' ? C.historial : origen === 'ejemplo' ? C.ejemplo : ''}
          onLeer={leer} lecturaId={hablando || pendiente === 'voz' ? lectura : null} onDetener={() => detener()} />
        {messages === undefined ? <div className="luci-archivo">
          <button type="button" disabled={guardada.cargando} onClick={() => { detener(); setPaso(-1); setOrigen('guardada'); void guardada.recuperar(); }}>{guardada.cargando ? 'Buscando…' : 'Recuperar guardada'}</button>
          <button type="button" onClick={() => { detener(); setPaso(-1); setOrigen('ejemplo'); }}>Ver ejemplo con corrección</button>
          {origen === 'guardada' && guardada.aviso ? <p role="status">{guardada.aviso}</p> : null}
        </div> : null}
      </div>
    </aside>

    <footer className="luci-pie">
      {momento ? <div className="luci-recorrido">
        <ol aria-label="Momentos del ejemplo">{MOMENTOS.map((m, i) => <li key={m.estado}><button type="button" aria-current={paso === i ? 'step' : undefined} onClick={() => irAlPaso(i)}><span>0{i + 1}</span>{m.verbo}</button></li>)}</ol>
        <p>{momento.nota}</p>
      </div> : null}
      {aviso ? <p className="luci-aviso" role="status">{aviso}</p> : null}
      <div className="luci-acciones">
        {ocupado ? <button className="luci-principal" type="button" onClick={() => detener()}><Square size={19} aria-hidden="true" />{pendiente ? 'Cancelar solicitud' : COPY.detener}</button>
          : momento ? <>
            <button type="button" onClick={() => irAlPaso(-1)}><ArrowLeft size={18} aria-hidden="true" />{COPY.volver}</button>
            {paso === 3 ? <button className="luci-principal" type="button" onClick={() => medios.decir(RESPUESTA_EJEMPLO)}><Volume2 size={19} aria-hidden="true" />{COPY.hablar}</button>
              : <button className="luci-principal" type="button" onClick={() => irAlPaso(paso + 1)}>{COPY.siguiente}<ArrowRight size={18} aria-hidden="true" /></button>}
          </> : <>
            <button className="luci-principal" type="button" onClick={() => abrir('microfono')}><Mic size={20} aria-hidden="true" />{COPY.escuchar}</button>
            <button type="button" onClick={() => abrir('camara')}><Camera size={20} aria-hidden="true" />{COPY.mirar}</button>
          </>}
      </div>
      {!momento && !ocupado ? <button className="luci-ejemplo" type="button" onClick={() => irAlPaso(0)}>{COPY.ejemplo}<ArrowRight size={15} aria-hidden="true" /></button> : null}
      <p className="luci-limite">{momento ? 'Ejemplo guiado. La respuesta está escrita aquí.' : 'Sus fotos y sonidos se quedan en este dispositivo. La conversación queda en su cuaderno.'}</p>
    </footer>
  </main>;
}
