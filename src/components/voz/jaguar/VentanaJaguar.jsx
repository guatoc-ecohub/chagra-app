/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Escena con copy propio y claves de actuación. */
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Mic, Moon, Sun, Volume2, Square, Pause, Play, MessageSquareText } from 'lucide-react';
import JaguarCompai from '../../../visual/creatures/JaguarCompai';
import { PERFIL_CONDUCTA_JAGUAR } from '../../../compai/jaguarConducta';
import { useMediosVoz } from '../useMediosVoz';
import OrillaJaguar from './OrillaJaguar';
import { ESTADOS, MOMENTOS, RESPUESTA } from './ventanaJaguar.copy';
import './ventanaJaguar.css';
import { ContextoFinca, EscuchaEnVivo } from '../VentanaEstado';

function Rastro() {
  return <svg className="jv-hoja-muestra" viewBox="0 0 220 130" aria-hidden="true">
    <path d="M27 115Q56 85 182 19Q185 114 48 106Z" fill="#73836a" />
    <path d="M29 114Q93 68 182 19M69 87 62 60M94 72 100 41M118 56 134 31M69 87 101 93M94 72 132 78M118 56 153 58" fill="none" stroke="#d2cf99" strokeWidth="1.5" />
    <path d="M50 104Q41 76 65 57L79 68 66 83 78 95Z" fill="#bba36a" />
    <circle cx="92" cy="82" r="5" fill="#bba36a" />
  </svg>;
}

export default function VentanaJaguar() {
  const [paso, setPaso] = useState(-1);
  const [tema, setTema] = useState('noche');
  const [pausada, setPausada] = useState(false);
  const { modo, pendiente, hablando, aviso, oculta, tiempoEscuchando, cierreSilencio, medidorRef, ambienteRef, videoRef, abrir, decir, detener } = useMediosVoz();
  const momento = MOMENTOS[paso];
  const estado = hablando ? 'hablando' : modo === 'camara' ? 'mirando'
    : modo === 'microfono' ? 'escuchando' : momento?.estado || 'presente';
  const medios = modo || pendiente;
  const quietud = pausada || oculta;
  const titulo = modo === 'camara' ? 'Aquí está el rastro.' : modo === 'microfono' ? 'Le escucho.' : momento?.titulo;
  const detalle = modo === 'camara' ? 'Acerque lo que quiere mostrar. La imagen se queda en su dispositivo.'
    : modo === 'microfono' ? 'Hable a su ritmo. El agua sigue la intensidad de su voz.' : momento?.detalle;

  function irAlPaso(siguiente) {
    detener();
    setPaso(siguiente);
  }

  function abrirMedio(tipo) {
    setPaso(-1);
    void abrir(tipo);
  }

  return <main ref={ambienteRef} className="jv-ventana" data-estado={estado} data-medio={modo} data-tema={tema} data-pausada={quietud}>
    <OrillaJaguar />
    <header className="jv-cabecera">
      <a className="jv-marca" href="/" aria-label="Volver a Chagra"><ArrowLeft size={17} /><span>chagra<span>.</span></span></a>
      <p className="jv-coordenada">A LA ORILLA DEL MONTE</p>
      <div className="jv-ajustes">
        <button onClick={() => setPausada(!pausada)} aria-pressed={pausada} aria-label={pausada ? 'Reanudar movimiento' : 'Pausar movimiento'}>{pausada ? <Play size={18} /> : <Pause size={18} />}</button>
        <button onClick={() => setTema(tema === 'noche' ? 'dia' : 'noche')} aria-label={tema === 'noche' ? 'Activar luz de amanecer' : 'Activar luz de noche'}>{tema === 'noche' ? <Sun size={19} /> : <Moon size={19} />}</button>
      </div>
    </header>

    <section className="jv-encuentro" aria-label="Un encuentro con el jaguar">
      <div className="jv-relato">
        <p className="jv-antetitulo"><span /> JAGUAR · AGENTE AGROECOLÓGICO</p>
        <div aria-live="polite" aria-atomic="true">
          <h1>{titulo || <>El monte habla.<br /><em>Vamos despacio.</em></>}</h1>
          <p className="jv-detalle">{detalle || 'Estoy aquí. Muéstreme una señal o cuénteme qué cambió.'}</p>
          <EscuchaEnVivo modo={modo} pendiente={pendiente} tiempoEscuchando={tiempoEscuchando} cierreSilencio={cierreSilencio} />
          {!modo && !pendiente && !momento ? <ContextoFinca /> : null}
          <span className="jv-solo-lector">{ESTADOS[estado]}</span>
        </div>
      </div>

      <div className="jv-presencia" aria-hidden="true">
        <div className="jv-roca"><span /></div>
        <div className="jv-sombra" />
        <div className="jv-felino">
          <JaguarCompai size={560} estado={estado} animated={!quietud} vidaForzada="idle" tier={undefined} style={undefined}
            data-gesto-confianza={PERFIL_CONDUCTA_JAGUAR.gestoConfianza} />
        </div>
      </div>

      <aside className="jv-evidencia" aria-label="Lo que trae del campo">
        {medios && pendiente !== 'voz' ? <>
          <p className="jv-etiqueta">{pendiente ? 'ESPERANDO PERMISO' : 'SEÑAL LOCAL'}</p>
          {modo === 'camara' ? <video ref={videoRef} className="jv-video" muted playsInline autoPlay aria-label="Vista local de la cámara, sin análisis de imagen" /> : null}
          {modo === 'microfono' ? <div className="jv-medidor" ref={medidorRef} role="meter" aria-label="Nivel de sonido del micrófono" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}><span /><i /><i /></div> : null}
          <p className="jv-nota">{pendiente ? 'Puede cancelar mientras decide.' : modo === 'camara' ? 'Sin reconocimiento de plantas.' : 'Sin grabación ni transcripción.'}</p>
        </> : momento ? <>
          <p className="jv-etiqueta">RASTRO {String(paso + 1).padStart(2, '0')} / EJEMPLO GUIADO</p>
          {paso === 0 ? <Rastro /> : null}
          {paso === 1 ? <div className="jv-voz-ejemplo" aria-hidden="true">{[12, 27, 40, 20, 33, 48, 22, 14, 30].map((h, i) => <i key={i} style={{ '--alto': `${h}px`, '--i': i }} />)}</div> : null}
          {paso === 2 ? <div className="jv-rastros" aria-hidden="true"><i /><span /><i /><span /><i /></div> : null}
          <p className="jv-objeto">{momento.objeto}</p>
          <p className="jv-nota">{momento.nota}</p>
        </> : <p className="jv-silencio"><span>Sin prisa.</span> Hay cosas que se ven mejor<br />cuando uno se detiene.</p>}
      </aside>
    </section>

    <footer className="jv-pie">
      {aviso ? <p className="jv-aviso" role="status">{aviso}</p> : null}
      <div className="jv-acciones">
        <button className="jv-secundario" type="button" onClick={() => window.dispatchEvent(new CustomEvent('chagraNavigate', { detail: { view: 'agente' } }))}>
          <MessageSquareText size={18} />Escribir al agente
        </button>
        <div className="jv-controles">
          {medios || hablando ? <button className="jv-principal" onClick={() => detener()}><Square size={18} />{pendiente ? 'Cancelar solicitud' : 'Detener prueba'}</button>
            : momento ? <>
              <button className="jv-secundario" onClick={() => irAlPaso(-1)}><ArrowLeft size={18} />Volver al silencio</button>
              {paso === 3 ? <button className="jv-principal" onClick={() => decir(RESPUESTA)}><Volume2 size={18} />Oír el ejemplo</button>
                : <button className="jv-principal" onClick={() => irAlPaso(paso + 1)}>Siguiente momento<ArrowRight size={18} /></button>}
            </> : <>
              <button className="jv-principal" onClick={() => abrirMedio('microfono')}><Mic size={18} />Hablar con Chagra</button>
              <button className="jv-secundario" onClick={() => abrirMedio('camara')}><Camera size={18} />Mostrar una mata</button>
            </>}
        </div>
        {momento ? <ol className="jv-momentos" aria-label="Momentos del ejemplo">{MOMENTOS.map((item, i) => <li key={item.estado}><button onClick={() => irAlPaso(i)} aria-current={paso === i ? 'step' : undefined}><span>0{i + 1}</span>{' '}{item.verbo}</button></li>)}</ol>
          : !medios ? <button className="jv-recorrer" onClick={() => irAlPaso(0)}>Seguir un rastro para ver cómo trabajo<ArrowRight size={17} /></button> : null}
      </div>
      <p className="jv-limite">{momento ? 'Ejemplo guiado. La respuesta está escrita aquí.' : 'Sus fotos y sonidos se quedan en este dispositivo.'}</p>
    </footer>
  </main>;
}
