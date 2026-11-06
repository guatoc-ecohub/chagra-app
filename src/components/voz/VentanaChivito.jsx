/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Copy propio de esta escena y claves de actuación. */
import { useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight, Camera, Mic, Square, Volume2, BookOpen, X } from 'lucide-react';
import { comentarioDeMundoChivito } from '../../compai/chivito-punkConducta';
import PaisajeParamo from './PaisajeParamo';
import { useMediosVoz } from './useMediosVoz';
import { EscuchaEnVivo } from './VentanaEstado';
import './ventanaChivito.css';
import ContextoFincaAviso from './ContextoFincaAviso';
import VozCabecera from './VozCabecera';
import './vozFamilia.css';
import './ventanasFamilia.css';

const MOMENTOS = [
  { nombre: 'Miro', estado: 'mirando', cuerpo: 'senala', titulo: 'Primero, el terreno.', texto: 'Acérquese al borde de la roca. ¿Ve cómo el agua encuentra por dónde bajar?', pista: 'La roca · la pendiente · el agua' },
  { nombre: 'Escucho', estado: 'escuchando', cuerpo: 'escuchando', titulo: 'Desde aquí le escucho.', texto: 'Cuénteme qué ha cambiado en su tierra. Yo me quedo quieto un momento.', pista: '«Después de la lluvia, el suelo queda distinto…»' },
  { nombre: 'Pienso', estado: 'pensando', cuerpo: 'pensando', titulo: 'No salto a conclusiones.', texto: 'Una pista no cuenta toda la historia. Miremos el suelo y recordemos cuándo empezó.', pista: 'Observar → preguntar → comprobar' },
  { nombre: 'Respondo', estado: 'respuesta', cuerpo: 'acompana', titulo: 'Por aquí, con cuidado.', texto: comentarioDeMundoChivito('paramo'), pista: '¿Dónde ve que el agua empieza a juntarse?' },
];
const SIN_MENSAJES = [];
const CONSULTAS = { compacto: '(max-width: 680px)', reducido: '(prefers-reduced-motion: reduce)' };
const suscribir = (consulta, callback) => {
  const medio = window.matchMedia?.(consulta);
  medio?.addEventListener('change', callback);
  return () => medio?.removeEventListener('change', callback);
};
const suscribirCompacto = callback => suscribir(CONSULTAS.compacto, callback);
const suscribirReducido = callback => suscribir(CONSULTAS.reducido, callback);
const leerCompacto = () => Boolean(window.matchMedia?.(CONSULTAS.compacto).matches);
const leerReducido = () => Boolean(window.matchMedia?.(CONSULTAS.reducido).matches);
const leerServidor = () => false;

/** Ventana independiente: el anfitrión puede entregar mensajes y una lámina. */
/** @param {{messages?: Array<{id?: string, role?: string, content?: string, metadata?: Record<string, unknown>}>, isStreaming?: boolean, streamingContent?: string, lamina?: import('react').ReactNode}} props */
export default function VentanaChivito({ messages = SIN_MENSAJES, isStreaming = false, streamingContent = '', lamina = null }) {
  const [paso, setPaso] = useState(-1);
  const [quieta, setQuieta] = useState(false);
  const [tema, setTema] = useState('dia');
  const [cuaderno, setCuaderno] = useState(false);
  const compacto = useSyncExternalStore(suscribirCompacto, leerCompacto, leerServidor);
  const reducido = useSyncExternalStore(suscribirReducido, leerReducido, leerServidor);
  const { modo, pendiente, hablando, aviso, oculta, tiempoEscuchando, cierreSilencio, medidorRef, videoRef, abrir: abrirMedio, decir, detener } = useMediosVoz();
  const momento = MOMENTOS[paso];
  const ocupada = Boolean(modo || pendiente || hablando);
  const pausada = quieta || reducido || oculta;
  const estado = hablando ? 'hablando' : modo === 'camara' ? 'mirando'
    : modo === 'microfono' ? 'escuchando' : isStreaming ? 'pensando' : momento?.estado || 'presente';
  const cuerpo = hablando ? 'respondiendo' : modo === 'camara' ? 'senala'
    : modo === 'microfono' ? 'escuchando' : isStreaming ? 'pensando' : momento?.cuerpo || 'acompana';
  const ultima = messages.filter(mensaje => mensaje.role === 'assistant').at(-1);
  const titulo = modo === 'camara' ? 'Veamos de cerca.' : modo === 'microfono' ? 'Le escucho desde la loma.' : momento?.titulo;

  function irAlPaso(nuevo) { detener(); setPaso(nuevo); }
  function abrir(tipo) { setPaso(-1); void abrirMedio(tipo); }

  return <main className="paramo-ventana voz-casa" data-estado={estado} data-pausada={pausada} data-neblina={tema === 'noche'}>
    <VozCabecera pausada={pausada} onPausa={() => setQuieta(!quieta)} tema={tema} onTema={() => setTema(t => t === 'dia' ? 'noche' : 'dia')} localidad="UNA CONVERSACIÓN EN LA CHAGRA" movimientoBloqueado={reducido} etiquetaMovimientoBloqueado="Movimiento reducido por su dispositivo" />

    <section className="paramo-escena" aria-label="Encuentro con el chivito de páramo">
      <PaisajeParamo estado={cuerpo} pausada={pausada} compacto={compacto} />
      <div className="paramo-presentacion">
        <p className="paramo-antetitulo"><span />{ocupada ? 'SEÑAL DEL DISPOSITIVO' : momento ? `0${paso + 1} / ${momento.nombre.toUpperCase()}` : 'SU COMPAI DE ALTURA'}</p>
        <h1>{titulo || <>Un paso.<br />Otro salto.<br /><em>Aquí estoy.</em></>}</h1>
        <p className="paramo-entrada">{modo ? 'La señal se queda en esta ventana. Usted decide cuándo detenerla.' : momento?.texto || 'Suba para mirar mejor. Cuénteme, ¿qué está pasando en su tierra?'}</p>
        <ContextoFincaAviso />
        <EscuchaEnVivo modo={modo} pendiente={pendiente} tiempoEscuchando={tiempoEscuchando} cierreSilencio={cierreSilencio} />
      </div>
      <div className="paramo-cota" aria-hidden="true"><span>↑</span> TIERRA FRÍA<br /><small>Roca, agua y paciencia.</small></div>

      {pendiente && pendiente !== 'voz' ? <aside className="paramo-muestra"><span className="paramo-etiqueta">ESPERANDO PERMISO</span><p>Puede cancelar la solicitud en cualquier momento.</p></aside> : null}
      {modo === 'camara' ? <aside className="paramo-muestra">
        <span className="paramo-etiqueta">CÁMARA LOCAL</span>
        <video ref={videoRef} muted playsInline autoPlay aria-label="Vista local de la cámara, sin análisis de imagen" />
        <small>Sin guardar ni analizar la imagen.</small>
      </aside> : null}
      {modo === 'microfono' ? <aside className="paramo-muestra">
        <span className="paramo-etiqueta">EL SONIDO LLEGA</span>
        <div className="paramo-medidor" ref={medidorRef} role="meter" aria-label="Nivel de sonido del micrófono" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}><span /></div>
        <small>Sin grabación ni transcripción.</small>
      </aside> : null}
      {!ocupada && momento ? <aside className="paramo-pista"><span className="paramo-etiqueta">EJEMPLO GUIADO</span><p>{momento.pista}</p></aside> : null}
      {!ocupada && !momento && lamina ? <section className="paramo-muestra" aria-label="Lámina de campo">{lamina}</section> : null}

      {!ocupada && !momento && (messages.length || isStreaming) ? <div className="paramo-conversacion" data-con-lamina={Boolean(lamina)}>
        <button className="paramo-cuaderno-boton" aria-expanded={cuaderno} onClick={() => setCuaderno(!cuaderno)}>{cuaderno ? <X size={17} /> : <BookOpen size={17} />}{cuaderno ? 'Cerrar cuaderno' : `Cuaderno de campo · ${messages.length}`}</button>
        {cuaderno ? <section className="paramo-cuaderno" aria-label="Conversación">
          {messages.map((mensaje, i) => <article key={mensaje.id || i}><span className="paramo-etiqueta">{mensaje.role === 'user' ? 'USTED' : 'CHIVITO'}</span><p>{mensaje.content}</p>
            {mensaje.metadata?.cross_crop ? <small>Dato de otro cultivo. Compruebe si aplica.</small> : null}
            {mensaje.metadata?.auto_corrected ? <small>Respuesta corregida automáticamente.</small> : null}
            {mensaje.metadata?.confidence != null ? <small>Confianza declarada: {String(mensaje.metadata.confidence)}. Verifique antes de actuar.</small> : null}
          </article>)}
          {isStreaming ? <article aria-busy="true"><span className="paramo-etiqueta">CHIVITO ESTÁ PREPARANDO SU RESPUESTA</span><p>{streamingContent || 'Estoy reuniendo las pistas.'}</p></article> : null}
          {ultima && !isStreaming ? <button onClick={() => decir(ultima.content, { ejemplo: false })}><Volume2 size={16} />Leer última respuesta</button> : null}
        </section> : <p className="paramo-extracto">{isStreaming ? 'Estoy reuniendo las pistas…' : ultima?.content}</p>}
      </div> : null}
    </section>

    <footer className="paramo-pie">
      <nav className="paramo-momentos" aria-label="Cuatro momentos del ejemplo">{MOMENTOS.map((item, i) => <button key={item.nombre} onClick={() => irAlPaso(i)} aria-current={paso === i ? 'step' : undefined}><span>0{i + 1}</span>{item.nombre}</button>)}</nav>
      <div className="paramo-acciones">
        {ocupada ? <button className="paramo-principal" onClick={() => detener()}><Square size={17} />{pendiente ? 'Cancelar solicitud' : 'Detener'}</button> : momento ? <>
          <button onClick={() => irAlPaso(-1)}><ArrowLeft size={17} />Volver al páramo</button>
          {paso < 3 ? <button className="paramo-principal" onClick={() => irAlPaso(paso + 1)}>Siguiente momento<ArrowRight size={17} /></button> : <button className="paramo-principal" onClick={() => decir(momento.texto)}><Volume2 size={18} />Oír el ejemplo</button>}
        </> : <><button className="paramo-principal" onClick={() => abrir('microfono')}><Mic size={18} />Hablar con Chagra</button><button onClick={() => abrir('camara')}><Camera size={18} />Mostrar una mata</button></>}
      </div>
      {aviso ? <p className="paramo-aviso" role="status">{aviso}</p> : null}
      <p className="paramo-limite">{momento && !ocupada ? 'Ejemplo guiado. La respuesta está escrita aquí.' : 'Sus fotos y sonidos se quedan en este dispositivo.'}</p>
    </footer>
  </main>;
}
