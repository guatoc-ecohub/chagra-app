/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Copy de confirmación de ubicación. */
import { useLayoutEffect, useMemo, useRef } from 'react';
import useAgentAvatarType, { AVATAR_NOMBRE } from '../../hooks/useAgentAvatarType';
import { activarEscucha } from '../../services/escuchaService';
import a from './home-a/a.html?raw';
import './home-ilustrado-a.css';
import ChagraAgentAvatar from '../ChagraAgentAvatar';
import { CompaiAvatarContext } from '../CompaiAvatarContext';

const makeDocument = (companionName, locationLabel) => {
  // Sin etiqueta (C30): la portada ya muestra su tarjeta «Confirmar ubicación»
  // y la píldora del encabezado sería la segunda petición igual a la vez.
  const pildora = locationLabel == null ? '.ubicar{display:none!important}' : '';
  const companionAtSentenceStart = companionName[0].toLocaleUpperCase('es-CO') + companionName.slice(1);
  return a
  .replace('Pregúntele a Angelita', `Pregúntele ${companionName.startsWith('el ') ? `al ${companionName.slice(3)}` : `a ${companionName.replace(/^la /, '')}`}`)
  .replace(/(\.\s*)Angelita\b/g, `$1${companionAtSentenceStart}`)
  .replaceAll('Angelita', companionName)
  .replace('</head>', `<script src="/home-frames/voice.js"></script><style>.cuaderno,#sala{display:none!important}html,body{height:100%;overflow:hidden}.finca{height:calc(100% - 82px)!important;min-height:0!important;max-height:none!important}.ubicar span{white-space:normal;max-width:150px;text-align:left;line-height:1.15}${pildora}</style></head>`)
  .replace('<span>Ubicar mi finca</span>', `<span>${String(locationLabel ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</span>`)
  .replace('aria-label="Ubicar mi finca: aún no ha confirmado dónde queda"', 'aria-label="Confirmar la ubicación"')
  .replace('</body>', '<script src="/home-frames/bridge.js"></script></body>');
};
const TARGETS = {
  tiempo: 'cb-today',
  finca: 'cb-status',
  matas: 'cb-status',
  animales: 'cb-status',
  vender: 'cb-bottom',
  aprender: 'cb-quick',
};

export default function HomeAHeader({ onPlace = null, locationLabel = 'Ubicación por confirmar' }) {
  const frame = useRef(null);
  const avatarLayer = useRef(null);
  const [companion] = useAgentAvatarType();
  const companionName = AVATAR_NOMBRE[companion] || AVATAR_NOMBRE.angelita;
  const title = useMemo(() => `Hábleme con ${companionName}`, [companionName]);
  const frameDocument = useMemo(() => makeDocument(companionName, locationLabel), [companionName, locationLabel]);

  useLayoutEffect(() => {
    const receive = (event) => {
      if (event.source !== frame.current?.contentWindow || event.data?.channel !== 'home-a') return;
      const { action, value } = event.data;
      if (action === 'place') {
        if (value === 'agente') activarEscucha({ fuente: 'home_a' });
        else if (TARGETS[value] && !onPlace) {
          document.getElementById(TARGETS[value])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else onPlace?.(value);
      }
      if (action === 'listen') activarEscucha({ fuente: 'home_a' });
      if (action === 'presence' && avatarLayer.current) {
        const { x, y, signs = [], visible, flip } = value || {};
        const layer = avatarLayer.current;
        layer.hidden = !visible;
        if (visible && Number.isFinite(x) && Number.isFinite(y)) {
          const width = frame.current?.clientWidth || window.innerWidth;
          const height = frame.current?.clientHeight || window.innerHeight;
          // En el teléfono el encabezado mide ~412×320 con seis letreros: a 96 px
          // no quedaba ningún hueco libre y el compai caía encima de uno (C30).
          const size = width < 700 ? 72 : 96;
          const half = size / 2;
          const gap = 3;
          /** @param {number[]} point */
          const fit = ([cx, cy]) => [Math.max(half, Math.min(width - half, cx)), Math.max(half, Math.min(height - half, cy))];
          /** @param {number[]} point */
          const overlap = ([cx, cy]) => signs.reduce((total, sign) => total
            + Math.max(0, Math.min(cx + half, sign.right + gap) - Math.max(cx - half, sign.left - gap))
            * Math.max(0, Math.min(cy + half, sign.bottom + gap) - Math.max(cy - half, sign.top - gap)), 0);
          const preferred = [
            [width * .82, height * .18], [width * .18, height * .18],
            [width * .82, height * .48], [width * .18, height * .48],
            [width * .5, height * .78], [width * .5, height * .18],
          ].map(fit);
          const grid = [];
          for (let cy = half; cy <= height - half; cy += 8) {
            for (let cx = half; cx <= width - half; cx += 8) grid.push([cx, cy]);
          }
          const candidates = [...preferred, ...grid];
          const [left, top] = candidates.find((point) => overlap(point) === 0)
            || candidates.reduce((best, point) => (overlap(point) < overlap(best) ? point : best));
          layer.style.left = `${left}px`;
          layer.style.top = `${top}px`;
          layer.style.width = `${size}px`;
          layer.style.height = `${size}px`;
          layer.style.setProperty('--compai-escala', String(size / 96));
          layer.style.transform = `translate(-50%, -50%) scaleX(${flip ? -1 : 1})`;
        }
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onPlace]);

  return (
    <div className="hia hia-header-only" aria-label="Encabezado ilustrado de la finca">
      <iframe ref={frame} title="Encabezado ilustrado de su finca" sandbox="allow-scripts" srcDoc={frameDocument} />
      <button ref={avatarLayer} type="button" hidden className="hia-compai" aria-label={title} onClick={() => activarEscucha({ fuente: 'home_a_compai' })}>
        <CompaiAvatarContext value>
          <ChagraAgentAvatar state="idle" size={96} ariaLabel={`Compai ${companionName}`} />
        </CompaiAvatarContext>
      </button>
    </div>
  );
}
