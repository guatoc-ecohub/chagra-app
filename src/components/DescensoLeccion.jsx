import { apuntarCompai } from '../visual/agente/compaiPunteria.js';
import { useEffect, useRef, useState } from 'react';
import ChagraAgentAvatar from './ChagraAgentAvatar.jsx';
import BurbujaPizarraPeek from './BurbujaPizarraPeek.jsx';
import { CompaiAvatarContext } from './CompaiAvatarContext.js';
import useAgentAvatarType, { AVATAR_NOMBRE } from '../hooks/useAgentAvatarType.js';
import { estadoLeccion } from '../hooks/useDescensoLeccion.js';
import { getCompanionVoice } from '../config/compaiVoices.js';
import ttsService from '../services/ttsService.js';
import { useLipSync } from '../visual/creatures/useLipSync.js';

export default function DescensoLeccion({ pagina, entrada, enviar, iframeRef }) {
  const [especie] = useAgentAvatarType();
  const [hablando, setHablando] = useState(false);
  const vozPropia = useRef(false);
  const generacionVoz = useRef(0);
  const audioEmpezado = useRef(false);
  const cuerpoRef = useRef(null);
  const { visema } = useLipSync();
  const final = pagina.estacion === pagina.total && pagina.pagina === pagina.paginas;
  // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish -- Estado del contrato, no texto UI.
  const estado = hablando ? 'respondiendo' : final ? 'contenta'
    : entrada ? 'invita' : pagina.pagina === 1 ? 'acompana' : estadoLeccion(pagina, especie);

  useEffect(() => {
    const quitar = ttsService.onSpeakingChange((suena) => {
      if (vozPropia.current) {
        setHablando(suena);
        if (suena) audioEmpezado.current = true;
        else if (audioEmpezado.current) vozPropia.current = false;
      }
    });
    return quitar;
  }, []);
  useEffect(() => () => {
    generacionVoz.current += 1;
    if (vozPropia.current) ttsService.stop();
    vozPropia.current = false;
    setHablando(false);
  }, [pagina, especie]);

  useEffect(() => {
    if (estado !== 'senala') return undefined;
    const ancla = pagina.anclas?.medidor;
    const senalaTiempo = pagina.clase === 'cuando';
    if (!senalaTiempo && (!ancla || !['x', 'y', 'w', 'h'].every((k) => Number.isFinite(ancla[k])))) return undefined;
    const apuntar = () => {
      const iframe = iframeRef.current;
      const caja = iframe?.getBoundingClientRect();
      const cuerpo = cuerpoRef.current;
      if (!caja || !cuerpo) return;
      const ancho = iframe.contentWindow?.innerWidth || caja.width;
      const alto = iframe.contentWindow?.innerHeight || caja.height;
      // A timing page explains its interval in the board, not in the size ruler.
      const texto = senalaTiempo ? cuerpo.parentElement.querySelector('.leccion-frases')?.getBoundingClientRect() : null;
      if (senalaTiempo && !texto) return;
      const x = texto ? texto.left + texto.width / 2 : caja.left + (ancla.x + ancla.w / 2) * caja.width / ancho;
      const y = texto ? texto.top : caja.top + (ancla.y + ancla.h / 2) * caja.height / alto;
      apuntarCompai(cuerpo, especie, x, y);
    };
    let frame;
    const programar = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(apuntar); };
    const montaje = new MutationObserver(programar);
    if (cuerpoRef.current) montaje.observe(cuerpoRef.current, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-agt-estado'] });
    programar();
    window.addEventListener('resize', programar);
    return () => { montaje.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', programar); };
  }, [estado, pagina, especie, iframeRef]);

  const escuchar = async () => {
    if (vozPropia.current) {
      generacionVoz.current += 1;
      ttsService.stop();
      vozPropia.current = false;
      setHablando(false);
      return;
    }
    const voz = getCompanionVoice(especie);
    const generacion = ++generacionVoz.current;
    vozPropia.current = true;
    audioEmpezado.current = false;
    try {
      await ttsService.speakSentences([...pagina.frases, pagina.nota].filter(Boolean).join(' '), {
        compai: especie, voice: voz.voice, forceEngine: voz.engine,
      });
    } catch {
      if (generacion === generacionVoz.current) { vozPropia.current = false; setHablando(false); }
    } finally {
      // The speaking subscription tracks actual audio, including single-sentence playback.
      if (generacion === generacionVoz.current && !ttsService.isAudioPlaying()) { vozPropia.current = false; setHablando(false); }
    }
  };

  return <div className="descenso-leccion">
    <div ref={cuerpoRef} className="descenso-leccion__compai" data-especie={especie}>
      <CompaiAvatarContext value={true}>
        <ChagraAgentAvatar especie={especie} estado={estado} size={110} visema={hablando ? visema : null}
          animated={especie !== 'jaguar'} idleCerebro={false} mostrarAvisoConducta={false} reaccionaPresencia={false} ariaLabel={`${AVATAR_NOMBRE[especie]} explica la lección`} />
      </CompaiAvatarContext>
    </div>
    <BurbujaPizarraPeek leccion={pagina} nombre={AVATAR_NOMBRE[especie]} hablando={hablando}
      onAccion={(i) => enviar('accion', { i })} onIr={(paso) => enviar('ir', { paso })} onAbrir={(que) => enviar('abrir', { que })} onEscuchar={escuchar} />
  </div>;
}
