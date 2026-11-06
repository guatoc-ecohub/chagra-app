import { memo, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, BadgeCheck, OctagonAlert, Volume2 } from 'lucide-react';
import AgentMarkdown from '../AgentScreen/AgentMarkdown';
import { humanizarEntidad, confianzaPorcentaje, describeFuente, nivelValidacionInfo } from '../../services/semaforoConfianza';
import { CONVERSACION as C } from './conversacion.copy';
import { enlaceSeguro, senalesConversacion } from './senalesConversacion';

const VACIO = [];

/** @param {{url?: string, texto?: string}} props */
function Fuente({ url, texto }) {
  const enlace = enlaceSeguro(url);
  return enlace ? <a href={enlace} target="_blank" rel="noopener noreferrer">{texto || C.fuente} ↗</a>
    : <span>{texto || C.sinFuente}{texto ? ` (${C.sinEnlace})` : ''}</span>;
}

/** @typedef {{entity_id?: string, source?: string, disputed?: boolean, validation_level?: string, confidence?: number}|undefined} DatoProcedencia */
/** @typedef {{confianza?: string, fuente?: string, fuente_url?: string, grounding_provenance?: DatoProcedencia[]}|undefined} MetadataConversacion */
/** @param {{metadata?: MetadataConversacion}} props */
function Senales({ metadata }) {
  const { nivel, titulo, avisos, confianza, procedencia } = senalesConversacion(metadata);
  const md = metadata || {};
  return <>
    <div className="voz-confianza" data-nivel={nivel}>
      {nivel === 'verde' ? <BadgeCheck size={17} aria-hidden="true" /> : nivel === 'rojo' ? <OctagonAlert size={17} aria-hidden="true" /> : <AlertTriangle size={17} aria-hidden="true" />}
      <span>{titulo}{confianza && nivel !== 'verde' && md.confianza === 'alta' ? '' : confianza ? ` · ${confianza}` : ''}</span>
    </div>
    {avisos.map(aviso => <div className="voz-advertencia" data-nivel={aviso.nivel} key={aviso.titulo}>
      <strong>{aviso.titulo}</strong><p>{aviso.detalle}</p>
    </div>)}
    <details className="voz-fuentes">
      <summary>{C.fuentes}</summary>
      <Fuente url={md.fuente_url} texto={typeof md.fuente === 'string' ? md.fuente : ''} />
      {procedencia.length > 0 ? <>
        <h4>{C.procedencia}</h4>
        <ul>{procedencia.map((dato, i) => <li key={`${dato.entity_id || 'dato'}-${i}`}>
          <strong>{humanizarEntidad(dato.entity_id)}</strong>
          <Fuente url={describeFuente(dato.source).url} texto={describeFuente(dato.source).label} />
          <span>{C.revisado}: {dato.disputed ? C.ambar : nivelValidacionInfo(dato.validation_level).label}</span>
          {confianzaPorcentaje(dato.confidence) !== null ? <span>{C.coincidencia}: {confianzaPorcentaje(dato.confidence)}%</span> : null}
        </li>)}</ul>
      </> : null}
    </details>
  </>;
}

const Turno = memo(/** @param {{mensaje: {id?: string, role?: string, content?: string, imageUrl?: string, photo?: string, imageAlt?: string, timestamp?: string, metadata?: MetadataConversacion, _orphan_recovery?: boolean, _deepResearch?: boolean}, parcial?: boolean, onLeer?: (mensaje: {role?: string, content?: string}) => void, leyendo?: boolean, onDetener?: () => void, nombreCompai?: string}} props */ function Turno({ mensaje, parcial = false, onLeer, leyendo = false, onDetener, nombreCompai = C.ave }) {
  const persona = mensaje.role === 'user';
  const contenido = typeof mensaje.content === 'string' ? mensaje.content : '';
  const foto = mensaje.imageUrl || mensaje.photo;
  const avisoEspecial = parcial ? C.parcial : mensaje._orphan_recovery ? C.recuperacion : mensaje._deepResearch ? C.investigacion : null;
  return <article className="voz-turno" data-persona={persona}>
    <header><strong>{persona ? C.persona : nombreCompai}</strong>
      {mensaje.timestamp && Number.isFinite(new Date(mensaje.timestamp).getTime()) ? <time dateTime={new Date(mensaje.timestamp).toISOString()}>{new Date(mensaje.timestamp).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time> : null}
    </header>
    {!persona && !avisoEspecial ? <Senales metadata={mensaje.metadata} /> : null}
    {avisoEspecial ? <p className="voz-confianza">{avisoEspecial}</p> : null}
    {foto ? <img className="voz-foto-conversacion" src={foto} alt={mensaje.imageAlt || C.foto} loading="lazy" /> : null}
    {persona || parcial ? <p className="voz-palabras">{contenido}</p> : contenido ? <AgentMarkdown content={contenido} /> : !avisoEspecial ? <p>{C.sinRespuesta}</p> : null}
    {!persona && !avisoEspecial && contenido && onLeer ? <button className="voz-leer" type="button" onClick={leyendo ? onDetener : () => onLeer(mensaje)}>
      <Volume2 size={16} aria-hidden="true" />{leyendo ? C.detener : C.oir}
    </button> : null}
  </article>;
});

/** @param {{messages?: Array<{id?: string, role?: string, content?: string, timestamp?: string, metadata?: MetadataConversacion, imageUrl?: string, photo?: string, _orphan_recovery?: boolean, _deepResearch?: boolean}>, isStreaming?: boolean, streamingContent?: string, etiqueta?: string, onLeer?: (mensaje: {role?: string, content?: string}) => void, lecturaId?: object|null, onDetener?: () => void, nombreCompai?: string}} props */
export default function ConversacionVoz({ messages = VACIO, isStreaming = false, streamingContent = '', etiqueta = '', onLeer, lecturaId, onDetener, nombreCompai = C.ave }) {
  const id = useId();
  const scrollRef = useRef(null);
  const seguirRef = useRef(true);
  const [atras, setAtras] = useState(false);
  const [nuevos, setNuevos] = useState(false);
  const visibles = messages.filter(m => m && ['user', 'assistant'].includes(m.role));
  const ultimo = visibles.at(-1);

  useEffect(() => {
    const nodo = scrollRef.current;
    if (!nodo) return;
    if (seguirRef.current) nodo.scrollTop = nodo.scrollHeight;
    else setNuevos(true);
  }, [messages, streamingContent, isStreaming]);

  function alDesplazar() {
    const nodo = scrollRef.current;
    seguirRef.current = nodo.scrollHeight - nodo.scrollTop - nodo.clientHeight < 48;
    setAtras(!seguirRef.current);
    if (seguirRef.current) setNuevos(false);
  }

  function irAlFinal() {
    seguirRef.current = true;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    setAtras(false);
    setNuevos(false);
    scrollRef.current.focus({ preventScroll: true });
  }

  return <section className="voz-cuaderno" data-vacio={!visibles.length && !isStreaming} aria-labelledby={`${id}-titulo`}>
    <header className="voz-cuaderno-cabecera"><div><p className="voz-cuaderno-etiqueta">{etiqueta || C.subtitulo}</p><h2 id={`${id}-titulo`}>{C.titulo}</h2></div></header>
    <div className="voz-cuaderno-nav">
      <button type="button" onClick={() => { seguirRef.current = false; scrollRef.current.scrollTop = 0; setAtras(true); scrollRef.current.focus({ preventScroll: true }); }} disabled={!visibles.length}>{C.anterior}</button>
      <button type="button" onClick={irAlFinal} disabled={!atras && !nuevos}>{nuevos ? C.nuevos : C.reciente}</button>
    </div>
    <div className="voz-conversacion-scroll" ref={scrollRef} onScroll={alDesplazar} tabIndex={0} role="region" aria-label={C.turnos}>
      {!visibles.length && !isStreaming ? <p className="voz-conversacion-vacia">{nombreCompai === C.ave ? C.vacio : `Aquí podrá releer sus palabras y las de ${nombreCompai}.`}</p> : null}
      {visibles.map((mensaje, i) => <Turno key={mensaje.id || `${mensaje.timestamp || 'turno'}-${i}`} mensaje={mensaje} nombreCompai={nombreCompai} onLeer={onLeer} leyendo={Boolean(lecturaId && lecturaId === mensaje)} onDetener={onDetener} />)}
      {isStreaming ? <Turno mensaje={{ role: 'assistant', content: streamingContent || C.pendiente }} nombreCompai={nombreCompai} parcial /> : null}
    </div>
    <span className="voz-solo-lector" aria-live="polite" aria-atomic="true">{isStreaming ? C.parcial : ultimo ? `${ultimo.role === 'user' ? C.persona : nombreCompai}: ${ultimo.content || C.sinRespuesta}` : ''}</span>
  </section>;
}
