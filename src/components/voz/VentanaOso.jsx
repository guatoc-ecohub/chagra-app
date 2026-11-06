/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Ventana independiente; los cuatro momentos viven en ventanaOso.copy. */
import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Mic, Square, Volume2, X } from 'lucide-react';
import { VOZ_REPOSO, VOZ_ESCUCHANDO, VOZ_PENSANDO, VOZ_HABLANDO } from '../../constants/estadosVoz.js';
import { comentarioDeMundoOsoBaston } from '../../compai/osoBastonConducta';
import MonteOso from './MonteOso';
import { MOMENTOS_OSO } from './ventanaOso.copy';
import { useMediosOso } from './useMediosOso';
import { EscuchaEnVivo } from './VentanaEstado';
import { usePaseoOso } from './usePaseoOso';
import './ventanaOso.css';
import ContextoFincaAviso from './ContextoFincaAviso';
import VozCabecera from './VozCabecera';
import './vozFamilia.css';
import './ventanasFamilia.css';
import './oso-voz.css';

const SALUDO = comentarioDeMundoOsoBaston('bosque');
const OsoVoz = lazy(() => import('./OsoVoz.jsx'));

function Semilla() {
  return <svg className="oso-ventana-semilla" viewBox="0 0 160 90" aria-hidden="true">
    <path d="M13 71Q56 21 132 17Q125 70 52 76Z" fill="#70835a" />
    <path d="M22 72Q63 50 126 23m-74 37-2-19m24 8 8 17m10-29 5-13" fill="none" stroke="#bcba8b" />
    <ellipse cx="83" cy="68" rx="16" ry="10" fill="#b99055" transform="rotate(-23 83 68)" />
    <path d="M72 73Q84 60 94 64" fill="none" stroke="#70502f" strokeWidth="2" />
    <path d="M100 69Q125 58 143 65" fill="none" stroke="#6b7253" strokeWidth="2" />
  </svg>;
}

export default function VentanaOso() {
  const [tema, setTema] = useState('dia');
  const [paso, setPaso] = useState(-1);
  const [pausa, setPausa] = useState(false);
  const [reducido, setReducido] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const medios = useMediosOso();
  const { modo, pendiente, hablando, aviso, oculta, tiempoEscuchando, cierreSilencio, videoRef, medidorRef, detener, abrir, decir } = medios;
  const pausada = pausa || reducido || oculta;
  const { caminanteRef, camina } = usePaseoOso(pausada);
  const momento = MOMENTOS_OSO[paso];
  const estado = hablando ? 'hablando' : modo === 'camara' ? 'mirando' : modo === 'microfono' ? 'escuchando' : momento?.estado || 'presente';
  const estadoVoz = hablando ? VOZ_HABLANDO : modo === 'microfono' ? VOZ_ESCUCHANDO : pendiente === 'voz' ? VOZ_PENSANDO
    : momento?.estado === 'escuchando' ? VOZ_ESCUCHANDO : momento?.estado === 'pensando' ? VOZ_PENSANDO : VOZ_REPOSO;
  const prueba = modo || pendiente || hablando;
  const titulo = modo === 'camara' ? 'Acerque lo que encontró.' : modo === 'microfono' ? 'Tiene toda mi atención.' : momento?.titulo;
  const detalle = modo === 'camara' ? 'Miremos su imagen en este claro.' : modo === 'microfono' ? 'Hable a su ritmo. El medidor sigue el sonido.' : momento?.detalle;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cambiar = () => setReducido(media.matches);
    media.addEventListener('change', cambiar);
    return () => media.removeEventListener('change', cambiar);
  }, []);

  function ir(nuevoPaso) {
    detener();
    setPaso(nuevoPaso);
  }

  function probar(tipo) {
    setPaso(-1);
    void abrir(tipo);
  }

  return <main className="oso-ventana voz-casa" data-tema={tema} data-estado={estado} data-pausada={pausada}>
    <MonteOso />
    <VozCabecera pausada={pausada} onPausa={() => setPausa(p => !p)} tema={tema} onTema={() => setTema(t => t === 'dia' ? 'noche' : 'dia')} localidad="UNA CONVERSACIÓN EN LA CHAGRA" movimientoBloqueado={reducido} etiquetaMovimientoBloqueado="Movimiento reducido del sistema" />

    <section className="oso-ventana-claro" aria-label="Un encuentro con el oso andino">
      <div className="oso-ventana-presentacion" aria-live="polite" aria-atomic="true">
        <p className="oso-ventana-antetitulo"><span />{hablando ? 'LA VOZ DEL EJEMPLO' : prueba ? 'EN ESTE CLARO, EN VIVO' : momento ? `${String(paso + 1).padStart(2, '0')} / ${momento.verbo}` : 'EL CAMINANTE DEL MONTE'}</p>
        <h1>{titulo || <>Vamos<br /><em>sin afán.</em></>}</h1>
        <p className="oso-ventana-bajada">{detalle || SALUDO}</p>
        <ContextoFincaAviso />
        <EscuchaEnVivo modo={modo} pendiente={pendiente} tiempoEscuchando={tiempoEscuchando} cierreSilencio={cierreSilencio} />
      </div>

      <div ref={caminanteRef} className="oso-ventana-caminante" data-camina={camina}>
        <div className="oso-ventana-contacto" aria-hidden="true" />
        <Suspense fallback={<div className="oso-voz oso-ventana-oso" aria-hidden="true" />}>
          <OsoVoz className="oso-ventana-oso" estado={estadoVoz} reducedMotion={reducido}
            hablandoExterno={hablando}
            florece={estado === 'respuesta' || hablando} />
        </Suspense>
        <span className="oso-ventana-semillas" aria-hidden="true"><i /><i /><i /></span>
      </div>

      <span className="oso-ventana-huella" aria-hidden="true">Tremarctos ornatus<br /><span>Donde camina, viajan semillas.</span></span>

      {momento || prueba ? <aside className="oso-ventana-nota" aria-label="Detalle del encuentro">
        <div className="oso-ventana-nota-titulo"><span>{prueba ? 'SEÑAL LOCAL' : 'CUADERNO DEL CAMINO'}</span>
          <button type="button" aria-label="Cerrar detalle y detener medios" onClick={() => ir(-1)}><X size={16} /></button>
        </div>
        {pendiente ? <p role="status">{pendiente === 'voz' ? 'Preparando la lectura…' : 'Esperando su permiso…'}</p>
          : modo === 'camara' ? <video ref={videoRef} autoPlay muted playsInline aria-label="Vista local de la cámara" />
          : modo === 'microfono' ? <>
            <div ref={medidorRef} className="oso-ventana-medidor" role="meter" aria-label="Nivel de sonido del micrófono" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}><span /></div>
            <p>El sonido llega.</p>
          </> : <>
            {paso === 0 ? <Semilla /> : null}
            {paso === 1 ? <div className="oso-ventana-onda" aria-hidden="true">{[12, 24, 18, 32, 46, 29, 19, 35, 17].map((h, i) => <i key={i} style={{ height: h, animationDelay: `${i * -.14}s` }} />)}</div> : null}
            {paso === 2 ? <div className="oso-ventana-pistas" aria-hidden="true"><i /><i /><i /></div> : null}
            <p className="oso-ventana-objeto">{momento?.objeto}</p>
          </>}
        <p className="oso-ventana-nota-pie">{modo === 'camara' ? 'Solo vista previa. Sin reconocimiento de plantas.' : modo === 'microfono' ? 'Sin grabación ni transcripción.' : momento?.nota}</p>
      </aside> : null}
    </section>

    <MonteOso frente />
    <footer className="oso-ventana-pie">
      {aviso ? <p className="oso-ventana-aviso" role="status">{aviso}</p> : null}
      <div className="oso-ventana-controles">
        {prueba ? <button type="button" className="oso-ventana-principal" onClick={() => detener()}><Square size={18} />{pendiente ? 'Cancelar solicitud' : 'Detener'}</button>
          : momento ? <>
            <button type="button" className="oso-ventana-secundario" onClick={() => ir(-1)}><ArrowLeft size={18} />Al claro</button>
            {paso === 3 ? <button type="button" className="oso-ventana-principal" onClick={() => decir(momento.objeto)}><Volume2 size={18} />Oír el ejemplo</button>
              : <button type="button" className="oso-ventana-principal" onClick={() => ir(paso + 1)}>Seguimos<ArrowRight size={18} /></button>}
          </> : <>
            <button type="button" className="oso-ventana-principal" onClick={() => probar('microfono')}><Mic size={19} />Hablar con Chagra</button>
            <button type="button" className="oso-ventana-secundario" onClick={() => probar('camara')}><Camera size={19} />Mostrar una mata</button>
          </>}
      </div>
      {momento ? <ol className="oso-ventana-momentos" aria-label="Cuatro momentos del ejemplo">{MOMENTOS_OSO.map((m, i) => <li key={m.estado}>
        <button type="button" onClick={() => ir(i)} aria-current={paso === i ? 'step' : undefined}><span>0{i + 1}</span>{m.verbo}</button>
      </li>)}</ol> : !prueba ? <button type="button" className="oso-ventana-ejemplo" onClick={() => ir(0)}>Caminar un ejemplo para ver cómo escucho<ArrowRight size={15} /></button> : null}
      <p className="oso-ventana-limite">{momento && !prueba ? 'Ejemplo guiado. La respuesta está escrita aquí.' : 'Sus fotos y sonidos se quedan en este dispositivo.'}</p>
    </footer>
  </main>;
}
