/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Los estados de actuación son claves internas; el copy se agrupa en ventanaVoz.copy. */
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Mic, Volume2, Square } from 'lucide-react';
import GuacamayaPresente from './GuacamayaPresente';
import RamaGuacamaya from './RamaGuacamaya';
import { ANCHO_AVE, APOYOS } from './vueloGuacamaya';
import PaisajeVoz from './PaisajeVoz';
import { COPY, MOMENTOS, RESPUESTA_EJEMPLO } from './ventanaVoz.copy';
import { useMediosVoz } from './useMediosVoz';
import ConversacionVoz from './ConversacionVoz';
import ContextoFincaAviso from './ContextoFincaAviso';
import VozCabecera from './VozCabecera';
import { CONVERSACION as C, EJEMPLO_CONVERSACION } from './conversacion.copy';
import { useConversacionGuardada } from './useConversacionGuardada';
import { EscuchaEnVivo } from './VentanaEstado';
import './ventanaVoz.css';
import './conversacionVoz.css';
import './vozFamilia.css';
import './ventanasFamilia.css';

const SIN_MENSAJES = [];
const GEOMETRIA_CORREDOR = {
  '--voz-ave-ancho': `${ANCHO_AVE * 100}cqw`,
  '--voz-ave-izquierda': `${(APOYOS[0] - ANCHO_AVE / 2) * 100}%`,
};

function HojaDeEjemplo() {
  return (
    <svg className="voz-hoja" viewBox="0 0 240 170" aria-hidden="true">
      <path d="M39 146Q79 102 188 25" fill="none" stroke="#67502a" strokeWidth="3" />
      <path d="M57 129Q39 49 196 22Q200 136 57 129Z" fill="#6c7940" stroke="#374c30" strokeWidth="2" />
      <path d="M57 129Q103 76 196 22" fill="none" stroke="#e2d39a" strokeWidth="2" />
      <path d="m84 100-7-30m31 8 1-30m29 10 9-23M85 101l35 7m-11-29 37 2m-8-25 28 1" fill="none" stroke="#bec084" strokeWidth="1.5" />
      <path d="M57 129Q39 88 81 61L90 80 75 88 84 109Z" fill="#c2a554" />
      <circle cx="100" cy="99" r="5" fill="#a38e46" />
    </svg>
  );
}

/** @param {{messages?: Array<{id?: string, role?: string, content?: string, metadata?: Record<string, unknown>}>, isStreaming?: boolean, streamingContent?: string, lamina?: import('react').ReactNode}} props */
export default function VentanaVoz({ messages, isStreaming = false, streamingContent = '', lamina = null }) {
  const [tema, setTema] = useState('noche');
  const [paso, setPaso] = useState(-1);
  const [quieta, setQuieta] = useState(false);
  const [turnosEjemplo, setTurnosEjemplo] = useState(0);
  const [origen, setOrigen] = useState('ejemplo');
  const [lectura, setLectura] = useState(null);
  const guardada = useConversacionGuardada();
  const ejemplo = useMemo(() => turnosEjemplo ? EJEMPLO_CONVERSACION.slice(0, turnosEjemplo) : SIN_MENSAJES, [turnosEjemplo]);
  const conversacion = messages ?? (origen === 'guardada' ? guardada.messages : ejemplo);
  const { modo, pendiente, hablando, aviso, oculta, tiempoEscuchando, cierreSilencio, medidorRef, videoRef, abrir: abrirMedio, decir, detener } = useMediosVoz();
  const momento = MOMENTOS[paso];
  const estado = hablando ? 'hablando' : modo === 'camara' ? 'mirando'
    : modo === 'microfono' ? 'escuchando' : isStreaming ? 'pensando' : momento?.estado || 'presente';
  const prueba = modo || pendiente;
  const titulo = modo === 'camara' ? 'Muéstreme de cerca.'
    : modo === 'microfono' ? 'Tiene mi atención.' : momento?.titulo;
  const detalle = modo === 'camara' ? 'La imagen se queda aquí. Usted decide qué mostrar.'
    : modo === 'microfono' ? 'Hable a su ritmo. El medidor sigue el sonido.' : momento?.detalle;

  function irAlPaso(nuevoPaso) {
    detener();
    setPaso(nuevoPaso);
    if (nuevoPaso >= 0) {
      setOrigen('ejemplo');
      setTurnosEjemplo(previo => Math.max(previo, nuevoPaso >= 3 ? 2 : nuevoPaso >= 1 ? 1 : 0));
    }
  }

  function abrir(tipo) {
    setPaso(-1);
    void abrirMedio(tipo);
  }

  function leer(mensaje) {
    setLectura(mensaje);
    decir(mensaje.content, { ejemplo: messages === undefined && origen === 'ejemplo' });
  }

  return (
    <main className="voz-ventana voz-casa" data-tema={tema} data-estado={estado} data-conversando={Boolean(conversacion.length || isStreaming)} data-pausada={quieta || oculta}>
      <PaisajeVoz />
      <VozCabecera pausada={quieta} onPausa={() => setQuieta(!quieta)} tema={tema === 'noche' ? 'noche' : 'dia'} onTema={() => setTema(tema === 'noche' ? 'dia' : 'noche')} localidad="UNA CONVERSACIÓN EN LA CHAGRA" />

      <section className="voz-escena" aria-label="Un encuentro con la guacamaya">
        <div className="voz-presentacion" aria-live="polite" aria-atomic="true">
          <p className="voz-antetitulo"><span className="voz-pulso" />{hablando ? '04 / HABLO' : modo ? 'PRUEBA EN VIVO' : momento ? `${String(paso + 1).padStart(2, '0')} / ${momento.verbo}` : 'AQUÍ, CON USTED'}</p>
          <h1 key={titulo || 'inicio'}>{titulo || (conversacion.length || isStreaming ? C.presencia : <>{COPY.inicio}<br /><em>{COPY.pregunta}</em></>)}</h1>
          <p className="voz-bajada">{detalle || (conversacion.length || isStreaming ? null : COPY.invitacion)}</p>
          <ContextoFincaAviso />
          <EscuchaEnVivo modo={modo} pendiente={pendiente} tiempoEscuchando={tiempoEscuchando} cierreSilencio={cierreSilencio} />
        </div>

        <div className="voz-compai" style={GEOMETRIA_CORREDOR}>
          <div className="voz-haz" aria-hidden="true" />
          <RamaGuacamaya apoyo={0} />
          <RamaGuacamaya apoyo={1} />
          <GuacamayaPresente />
        </div>

        <div className="voz-palabras-escena">
          <ConversacionVoz messages={conversacion} isStreaming={isStreaming} streamingContent={streamingContent}
            etiqueta={messages !== undefined ? '' : origen === 'guardada' ? C.historial : turnosEjemplo ? C.ejemplo : ''}
            onLeer={leer} lecturaId={hablando || pendiente === 'voz' ? lectura : null} onDetener={() => detener()} />
          {messages === undefined ? <div className="voz-archivo">
            <button type="button" disabled={guardada.cargando} onClick={() => { detener(); setPaso(-1); setOrigen('guardada'); void guardada.recuperar(); }}>{guardada.cargando ? C.cargando : C.cargar}</button>
            <button type="button" onClick={() => { detener(); setPaso(-1); setOrigen('ejemplo'); setTurnosEjemplo(4); }}>{C.verSenales}</button>
            {origen === 'guardada' && guardada.aviso ? <p role="status">{guardada.aviso}</p> : null}
          </div> : null}
        </div>

        <section className="voz-mesa" aria-label={C.dibujo} data-voz-slot="lamina" data-ocupada={Boolean(prueba || lamina || momento)}>
          <div className="voz-lamina-superficie">
          {prueba && pendiente !== 'voz' ? (
            <div className="voz-muestra voz-muestra-viva">
              <span className="voz-muestra-etiqueta">{pendiente ? 'ESPERANDO PERMISO' : 'SEÑAL DEL DISPOSITIVO'}</span>
              {modo === 'camara' ? <video ref={videoRef} className="voz-video" muted playsInline autoPlay aria-label="Vista local de la cámara, sin análisis de imagen" /> : null}
              {modo === 'microfono' ? <>
                <div className="voz-medidor" ref={medidorRef} role="meter" aria-label="Nivel de sonido del micrófono" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}><span /></div>
                <p className="voz-objeto">El sonido llega.</p>
              </> : null}
              <p className="voz-nota">{pendiente ? 'Puede cancelar mientras decide.' : modo === 'camara' ? 'Imagen local. Sin reconocimiento de plantas.' : 'Sin grabación ni transcripción.'}</p>
            </div>
          ) : lamina || (momento ? (
            <div className="voz-muestra" key={estado}>
              <span className="voz-muestra-etiqueta">EJEMPLO GUIADO</span>
              {estado === 'mirando' ? <HojaDeEjemplo /> : null}
              {estado === 'escuchando' ? <div className="voz-onda-ejemplo" aria-hidden="true">{[14, 28, 44, 23, 56, 34, 19, 42, 30, 12].map((alto, i) => <i key={i} style={{ height: alto }} />)}</div> : null}
              {estado === 'pensando' ? <div className="voz-pistas" aria-hidden="true"><i /><i /><i /></div> : null}
              {paso === 3 ? <span className="voz-comillas" aria-hidden="true">“</span> : null}
              <p className="voz-objeto">{momento.objeto}</p>
              <p className="voz-nota">{momento.nota}</p>
            </div>
          ) : <div className="voz-reserva-dibujo"><span className="voz-muestra-etiqueta">{C.dibujo}</span><p>{C.reserva}</p><small>{C.reservaDetalle}</small></div>)}
          </div>
        </section>
      </section>

      <footer className="voz-pie">
        {aviso ? <p className="voz-aviso" role="status">{aviso}</p> : null}
        <div className="voz-controles">
          {prueba || hablando ? <>
            <button className="voz-principal voz-detener" onClick={() => detener()}><Square size={18} />{pendiente ? 'Cancelar solicitud' : COPY.detener}</button>
          </> : momento ? <>
            <button className="voz-secundario" onClick={() => irAlPaso(-1)}><ArrowLeft size={20} />{COPY.volver}</button>
            {paso === 3 ? <button className="voz-principal" onClick={() => decir(RESPUESTA_EJEMPLO)}><Volume2 size={20} />{COPY.hablar}</button>
              : <button className="voz-principal" onClick={() => irAlPaso(paso + 1)}>{COPY.siguiente}<ArrowRight size={20} /></button>}
          </> : <>
            <button className="voz-principal" onClick={() => abrir('microfono')}><Mic size={20} />{COPY.escuchar}</button>
            <button className="voz-secundario" onClick={() => abrir('camara')}><Camera size={20} />{COPY.mirar}</button>
          </>}
        </div>
        {!momento && !prueba ? <button className="voz-ejemplo" onClick={() => irAlPaso(0)}>{COPY.ejemplo}<ArrowRight size={16} /></button> : null}
        {momento ? <ol className="voz-recorrido" aria-label="Momentos del ejemplo">{MOMENTOS.map((item, i) => <li key={item.estado}><button onClick={() => irAlPaso(i)} aria-current={paso === i ? 'step' : undefined}><span>{String(i + 1).padStart(2, '0')}</span>{item.verbo}</button></li>)}</ol> : null}
        <p className="voz-honestidad">{momento ? 'Ejemplo guiado. Cámara y micrófono apagados. La respuesta está escrita aquí.' : prueba ? 'Sus fotos y sonidos se quedan en este dispositivo.' : COPY.limite}</p>
      </footer>
    </main>
  );
}
