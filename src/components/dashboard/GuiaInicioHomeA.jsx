import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AngelitaGuia } from '../../visual/agente/AngelitaGuia.jsx';
import { CompaiAvatarContext } from '../CompaiAvatarContext';
import { FRAME_TITLES, RECORRIDO_PEDIDO_EVENT, recorridoGuiaId, recorridoPasos, recorridoVisto } from './home-a/recorrido';

/** Aire sobre la sección al llevarla a la vista. */
const AIRE_ARRIBA = 96;

/**
 * Pide al puente del iframe la caja de una sección (coordenadas del frame).
 * @param {HTMLIFrameElement} iframe @param {string} key @param {number} timeoutMs
 * @returns {Promise<{ top: number, left: number, width: number, height: number } | null>}
 */
function frameRect(iframe, key, timeoutMs) {
  const win = iframe.contentWindow;
  if (!win) return Promise.resolve(null);
  const id = `${key}-${Math.random().toString(36).slice(2)}`;
  return new Promise(resolve => {
    const done = value => {
      window.removeEventListener('message', receive);
      window.clearTimeout(timer);
      resolve(value);
    };
    const receive = event => {
      if (event.source !== win || event.data?.channel !== 'home-a' || event.data.action !== 'recorrido-rect') return;
      if (event.data.value?.id !== id) return;
      const rect = event.data.value.rect;
      done(rect && [rect.top, rect.left, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0 ? rect : null);
    };
    const timer = window.setTimeout(() => done(null), timeoutMs);
    window.addEventListener('message', receive);
    win.postMessage({ channel: 'home-a-recorrido', action: 'recorrido-rect', key, id }, '*');
  });
}

/** Abre o cierra el espacio de 48 px junto a la fila de pestañas del frame B. */
function framePercha(iframe, activo, timeoutMs) {
  const win = iframe.contentWindow;
  if (!win) return Promise.resolve(false);
  const id = `percha-${Math.random().toString(36).slice(2)}`;
  return new Promise(resolve => {
    const done = value => {
      window.removeEventListener('message', receive);
      window.clearTimeout(timer);
      resolve(value);
    };
    const receive = event => {
      if (event.source !== win || event.data?.channel !== 'home-a' || event.data.action !== 'recorrido-percha') return;
      if (event.data.value?.id !== id) return;
      done(event.data.value.activo === activo);
    };
    const timer = window.setTimeout(() => done(false), timeoutMs);
    window.addEventListener('message', receive);
    win.postMessage({ channel: 'home-a-recorrido', action: 'recorrido-percha', id, activo }, '*');
  });
}

/** Pide al iframe aislado los rectángulos de sus textos y controles visibles. */
function frameObstaculos(iframe, timeoutMs, targetKey = null) {
  const win = iframe.contentWindow;
  if (!win) return Promise.resolve(null);
  const id = 'obstaculos-' + Math.random().toString(36).slice(2);
  return new Promise(resolve => {
    const done = value => {
      window.removeEventListener('message', receive);
      window.clearTimeout(timer);
      resolve(value);
    };
    const receive = event => {
      if (event.source !== win || event.data?.channel !== 'home-a' || event.data.action !== 'recorrido-obstaculos') return;
      if (event.data.value?.id !== id) return;
      const rects = event.data.value.rects;
      done(Array.isArray(rects) && rects.every(rect => rect && ['left', 'top', 'right', 'bottom'].every(key => Number.isFinite(rect[key]))) ? rects : null);
    };
    const timer = window.setTimeout(() => done(null), timeoutMs);
    window.addEventListener('message', receive);
    win.postMessage({ channel: 'home-a-recorrido', action: 'recorrido-obstaculos', id, key: targetKey }, '*');
  });
}

/** Los dos frames deben contestar después de que la página se haya desplazado. */
async function frameObstaculosTodos(timeoutMs, parada = null, vigente = () => true) {
  for (let intento = 0; intento < 2; intento++) {
    if (!vigente() || typeof document === 'undefined') return null;
    const medidas = await Promise.all(Object.entries(FRAME_TITLES).map(async ([frame, title]) => {
      if (!vigente() || typeof document === 'undefined') return [frame, null];
      const iframe = document.querySelector(`iframe[title="${title}"]`);
      const targetKey = parada?.target?.frame === frame ? parada.target.key : null;
      return [frame, iframe ? await frameObstaculos(iframe, timeoutMs, targetKey) : null];
    }));
    if (!vigente() || typeof document === 'undefined') return null;
    const incompletos = medidas.some(([frame, rects]) =>
      document.querySelector(`iframe[title="${FRAME_TITLES[frame]}"]`) && !rects);
    if (!incompletos) return Object.fromEntries(medidas);
    if (intento === 0) await new Promise(resolve => window.setTimeout(resolve, 200));
  }
  return null;
}

/** @param {{ top: number, left: number, right?: number, bottom?: number, width?: number, height?: number }} r */
const caja = r => ({
  top: r.top,
  left: r.left,
  right: Number.isFinite(r.right) ? r.right : r.left + r.width,
  bottom: Number.isFinite(r.bottom) ? r.bottom : r.top + r.height,
});

/** @typedef {{ left: number, top: number, right: number, bottom: number, tipo?: 'control'|'control-fijo'|'texto', objetivo?: boolean }} Obstaculo */

const SELECTOR_CONTROLES = 'button,a,input,select,textarea,[role="button"]';

function obstaculosDePagina(parada) {
  const rects = [];
  const marcos = [...document.querySelectorAll('iframe')].map(iframe => caja(iframe.getBoundingClientRect()));
  const tapadoPorMarco = rect => marcos.some(marco =>
    marco.left <= rect.left && marco.top <= rect.top && marco.right >= rect.right && marco.bottom >= rect.bottom);
  const selectorObjetivo = typeof parada?.target?.page === 'string' && !parada.target.page.startsWith('iframe[')
    ? parada.target.page
    : null;
  const objetivos = selectorObjetivo ? [...document.querySelectorAll(selectorObjetivo)] : [];
  const esObjetivo = node => objetivos.some(objetivo => objetivo === node || objetivo.contains(node));
  const guardar = (rect, tipo, objetivo = false) => {
    if (!rect.width || !rect.height || tapadoPorMarco(rect)) return;
    rects.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, tipo, objetivo });
  };
  for (const node of document.querySelectorAll(SELECTOR_CONTROLES + ',summary,label')) {
    if (node.closest('.ang-guia, .ang-guia__panel')) continue;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
    guardar(node.getBoundingClientRect(), node.matches('input,select,textarea') ? 'control-fijo' : 'control', esObjetivo(node));
  }

  // Block only the painted glyphs, not the empty part of their paragraph or
  // card boxes. This leaves usable perches beside copy on a narrow screen.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const textNode = walker.currentNode;
    if (!textNode.nodeValue?.trim() || textNode.parentElement?.closest('.ang-guia,.ang-guia__panel')) continue;
    let visible = true;
    for (let node = textNode.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        visible = false;
        break;
      }
    }
    if (!visible) continue;
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const glyphRects = typeof range.getClientRects === 'function' ? range.getClientRects() : [];
    for (const rect of glyphRects) {
      guardar(rect, 'texto', esObjetivo(textNode.parentElement));
    }
    range.detach?.();
  }
  return rects;
}

function superposicion(a, b) {
  const ancho = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const alto = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return ancho * alto;
}

function separacion(a, b) {
  const dx = Math.max(0, a.left - b.right, b.left - a.right);
  const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom);
  return Math.hypot(dx, dy);
}

function resolverPuestoCercano(rect, opciones, obstaculos) {
  if (!rect) return null;
  const { parada, tamano = 64, margen = 14, viewportW = window.innerWidth, viewportH = window.innerHeight } = opciones;
  const objetivo = caja(rect);
  const maxGap = 360;
  const targetFrame = 'frame' in (parada?.target || {})
    ? parada.target.frame
    : typeof parada?.target?.page === 'string' && parada.target.page.startsWith('iframe[')
      ? Object.keys(FRAME_TITLES).find(frame => parada.target.page === `iframe[title="${FRAME_TITLES[frame]}"]`)
      : null;
  const iframeObjetivo = targetFrame
    ? document.querySelector('iframe[title="' + FRAME_TITLES[targetFrame] + '"]')?.getBoundingClientRect()
    : null;
  const marcoObjetivo = iframeObjetivo && caja(iframeObjetivo);
  const escena = parada?.id === 'escena';
  const exigirMarco = targetFrame === 'a' && !escena;
  const exigirTextoLibre = parada?.id === 'ubicacion' || parada?.id === 'despedida';
  // Búsqueda y ubicación viven pegadas arriba. Mover la segunda al otro lado
  // del cielo de la ilustración hace visible el cambio de sección.
  const ladoPreferido = parada?.id === 'ubicacion'
    ? 'derecha'
    : parada?.id === 'buscador'
      ? 'izquierda'
      : null;
  if (parada?.id === 'anio') {
    const x = Math.max(16, Math.min(viewportW - tamano - 16,
      Math.round((objetivo.left + (objetivo.right - objetivo.left) * 0.6 - tamano / 2) / 8) * 8));
    const y = Math.max(0, Math.min(viewportH - tamano, Math.round((objetivo.top - 8) / 8) * 8));
    return {
      x, y, lado: 'izquierda', direccion: 'derecha',
      enVista: objetivo.bottom > 0 && objetivo.top < viewportH && objetivo.right > 0 && objetivo.left < viewportW,
    };
  }
  if (parada?.id === 'pestanas') {
    const x = Math.max(16, viewportW - tamano - 24);
    const y = Math.max(0, Math.min(viewportH - tamano, Math.round((objetivo.top - tamano) / 8) * 8));
    return {
      x, y, lado: 'derecha', direccion: 'izquierda',
      enVista: objetivo.bottom > 0 && objetivo.top < viewportH && objetivo.right > 0 && objetivo.left < viewportW,
    };
  }
  if (parada?.id === 'plegables') {
    const x = Math.max(margen, Math.min(viewportW - tamano - margen,
      Math.round(((objetivo.left + objetivo.right) / 2 - tamano / 2) / 8) * 8));
    const y = Math.max(margen, Math.min(viewportH - tamano - margen,
      Math.round((objetivo.top + (objetivo.bottom - objetivo.top - tamano) / 2) / 8) * 8));
    return {
      x, y, lado: 'derecha', direccion: 'izquierda',
      enVista: objetivo.bottom > 0 && objetivo.top < viewportH && objetivo.right > 0 && objetivo.left < viewportW,
    };
  }
  if (parada?.id === 'muelle') {
    const x = Math.max(margen, Math.min(viewportW - tamano - margen, Math.round(objetivo.left / 8) * 8));
    const y = Math.max(margen, Math.min(viewportH - tamano - margen, objetivo.top - tamano));
    return {
      x, y, lado: 'izquierda', direccion: 'derecha',
      enVista: objetivo.bottom > 0 && objetivo.top < viewportH && objetivo.right > 0 && objetivo.left < viewportW,
    };
  }
  if (parada?.id === 'tareas') {
    const y = Math.max(margen, Math.min(viewportH - tamano - margen, objetivo.top));
    const posibles = [];
    for (let x = margen; x <= viewportW - tamano - margen; x += 4) {
      const candidata = { left: x, top: y, right: x + tamano, bottom: y + tamano };
      if (obstaculos.some(obstaculo => !obstaculo.objetivo && superposicion(candidata, obstaculo) > 0)) continue;
      const centroX = x + tamano / 2;
      const preferido = objetivo.left + (objetivo.right - objetivo.left) * 0.68;
      posibles.push({ x, distancia: Math.abs(centroX - preferido) });
    }
    const mejor = posibles.sort((a, b) => a.distancia - b.distancia)[0];
    if (!mejor) return null;
    return {
      x: mejor.x, y, lado: 'derecha', direccion: 'izquierda',
      enVista: objetivo.bottom > 0 && objetivo.top < viewportH && objetivo.right > 0 && objetivo.left < viewportW,
    };
  }
  if (parada?.id === 'a-un-toque') {
    const x = Math.max(margen, Math.min(viewportW - tamano - margen, (objetivo.left + objetivo.right) / 2 + tamano / 2));
    const y = Math.max(0, Math.min(viewportH - tamano, objetivo.top - tamano - 23));
    return {
      x, y, lado: 'derecha', direccion: 'izquierda',
      enVista: objetivo.bottom > 0 && objetivo.top < viewportH && objetivo.right > 0 && objetivo.left < viewportW,
    };
  }
  const puntoPreferido = parada?.id === 'buscador'
    ? { x: Math.round((objetivo.right - tamano - margen - margen) / 8) * 8 + margen, y: Math.round((objetivo.top - margen) / 8) * 8 + margen }
    : parada?.id === 'ubicacion'
      ? { x: Math.round((objetivo.right - tamano - margen - margen) / 8) * 8 + margen, y: Math.round((objetivo.bottom - tamano + 4 - margen) / 8) * 8 + margen }
      : null;
  let mejor = null;
  const minX = Math.max(margen, objetivo.left - maxGap - tamano);
  const maxX = Math.min(viewportW - tamano - margen, objetivo.right + maxGap);
  const minY = Math.max(margen, objetivo.top - maxGap - tamano);
  const maxY = Math.min(viewportH - tamano - margen, objetivo.bottom + maxGap);
  for (let y = minY; y <= maxY; y += 8) {
    for (let x = minX; x <= maxX; x += 8) {
      const candidata = { left: x, top: y, right: x + tamano, bottom: y + tamano };
      const gap = separacion(candidata, objetivo);
      if (gap > maxGap) continue;
      if (exigirMarco && (candidata.left < marcoObjetivo?.left || candidata.top < marcoObjetivo?.top || candidata.right > marcoObjetivo?.right || candidata.bottom > marcoObjetivo?.bottom)) continue;
      const tocaMarco = marcoObjetivo && candidata.left < marcoObjetivo.right && marcoObjetivo.left < candidata.right && candidata.top < marcoObjetivo.bottom && marcoObjetivo.top < candidata.bottom;
      if (escena && (!tocaMarco || candidata.top < objetivo.top || candidata.bottom > objetivo.bottom + tamano)) continue;
      const tocados = obstaculos.filter(obstaculo => superposicion(candidata, obstaculo) > 0);
      const ajenos = tocados.filter(obstaculo => !obstaculo.objetivo);
      const textoTapado = exigirTextoLibre && tocados.some(obstaculo => obstaculo.tipo === 'texto');
      if (ajenos.length || textoTapado) continue;
      const areaObjetivo = tocados.reduce((area, obstaculo) => area + superposicion(candidata, obstaculo), 0);
      const pisaObjetivo = superposicion(candidata, objetivo);
      const centroX = x + tamano / 2;
      const centroY = y + tamano / 2;
      const objetivoX = (objetivo.left + objetivo.right) / 2;
      const objetivoY = (objetivo.top + objetivo.bottom) / 2;
      const distanciaCentro = Math.hypot(centroX - objetivoX, centroY - objetivoY);
      const ladoCandidato = centroX < objetivoX ? 'izquierda' : 'derecha';
      const penalidadLado = ladoPreferido && ladoCandidato !== ladoPreferido ? 1000 : 0;
      const distanciaPreferida = puntoPreferido ? Math.hypot(x - puntoPreferido.x, y - puntoPreferido.y) : 0;
      const puntaje = distanciaPreferida * 1_000_000 + areaObjetivo * 1000 + gap * 100 + pisaObjetivo * 0.1 + distanciaCentro + penalidadLado;
      if (!mejor || puntaje < mejor.puntaje) mejor = { x, y, puntaje, centroX, objetivoX };
    }
  }
  const centroObjetivo = {
    x: (objetivo.left + objetivo.right) / 2,
    y: (objetivo.top + objetivo.bottom) / 2,
  };
  const distanciaMejor = mejor
    ? separacion({ left: mejor.x, top: mejor.y, right: mejor.x + tamano, bottom: mejor.y + tamano }, objetivo)
    : Infinity;
  const perfil = parada?.id === 'despedida'
    ? obstaculos
      .filter(obstaculo => obstaculo.tipo === 'control' && !obstaculo.objetivo
        && obstaculo.left >= objetivo.right - 1
        && Math.abs((obstaculo.top + obstaculo.bottom) / 2 - centroObjetivo.y) <= tamano)
      .sort((a, b) => a.left - b.left)[0]
    : null;
  const centroPerfil = perfil && {
    x: (perfil.left + perfil.right) / 2,
    y: (perfil.top + perfil.bottom) / 2,
  };
  const cumpleLadoAyuda = puesto => {
    if (!puesto) return false;
    const centro = { x: puesto.x + tamano / 2, y: puesto.y + tamano / 2 };
    const distanciaAyuda = Math.hypot(centro.x - centroObjetivo.x, centro.y - centroObjetivo.y);
    return centroPerfil
      ? distanciaAyuda < Math.hypot(centro.x - centroPerfil.x, centro.y - centroPerfil.y)
      : centro.x <= centroObjetivo.x;
  };
  if (parada?.id === 'despedida' && marcoObjetivo
    && (distanciaMejor >= 24 || !cumpleLadoAyuda(mejor))) {
    // Si el puesto más cercano queda lejos o del lado del perfil, busque
    // alrededor de «?» y conserve cajas libres centradas del lado de la ayuda.
    const minX = Math.max(marcoObjetivo.left, objetivo.left - tamano - 24);
    const maxX = Math.min(viewportW - tamano, marcoObjetivo.right - tamano, objetivo.right + 24);
    const minY = Math.max(marcoObjetivo.top, objetivo.bottom);
    const maxY = Math.min(viewportH - tamano, marcoObjetivo.bottom - tamano, objetivo.bottom + 24);
    let puestoCercano = null;
    for (let y = minY; y <= maxY; y += 2) {
      for (let x = minX; x <= maxX; x += 2) {
        const candidata = { left: x, top: y, right: x + tamano, bottom: y + tamano };
        if (superposicion(candidata, objetivo) > 0 || separacion(candidata, objetivo) >= 24) continue;
        if (candidata.left < marcoObjetivo.left || candidata.top < marcoObjetivo.top
          || candidata.right > marcoObjetivo.right || candidata.bottom > marcoObjetivo.bottom) continue;
        const tocados = obstaculos.filter(obstaculo => superposicion(candidata, obstaculo) > 0);
        if (tocados.some(obstaculo => obstaculo.tipo === 'texto' || obstaculo.tipo === 'control-fijo')) continue;
        const puesto = { x, y };
        if (!cumpleLadoAyuda(puesto)) continue;
        const gap = separacion(candidata, objetivo);
        const distanciaCentro = Math.hypot(x + tamano / 2 - centroObjetivo.x, y + tamano / 2 - centroObjetivo.y);
        const puntaje = gap * 100 + distanciaCentro;
        if (!puestoCercano || puntaje < puestoCercano.puntaje) puestoCercano = { ...puesto, puntaje };
      }
    }
    if (puestoCercano) {
      const lado = puestoCercano.x + tamano / 2 < centroObjetivo.x ? 'izquierda' : 'derecha';
      return {
        x: puestoCercano.x,
        y: puestoCercano.y,
        lado,
        direccion: lado === 'izquierda' ? 'derecha' : 'izquierda',
        enVista: objetivo.bottom > 0 && objetivo.top < viewportH && objetivo.right > 0 && objetivo.left < viewportW,
      };
    }
  }
  if (!mejor) return null;
  const lado = mejor.centroX < mejor.objetivoX ? 'izquierda' : 'derecha';
  return {
    x: mejor.x,
    y: mejor.y,
    lado,
    direccion: lado === 'izquierda' ? 'derecha' : 'izquierda',
    enVista: objetivo.bottom > 0 && objetivo.top < viewportH && objetivo.right > 0 && objetivo.left < viewportW,
  };
}

/**
 * Función que da la caja de la sección en el viewport, o null si este inicio
 * no la pinta (p. ej. la ubicación ya confirmada).
 * @param {import('./home-a/recorrido').RecorridoTarget} target @param {number} timeoutMs
 */
async function medir(target, timeoutMs) {
  if ('page' in target) {
    const node = document.querySelector(target.page);
    if (!node) return null;
    const rect = () => {
      const r = node.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? caja(r) : null;
    };
    return rect() ? rect : null;
  }
  const iframe = /** @type {HTMLIFrameElement | null} */ (document.querySelector(`iframe[title="${FRAME_TITLES[target.frame]}"]`));
  if (!iframe) return null;
  const inner = await frameRect(iframe, target.key, timeoutMs);
  if (!inner) return null;
  return () => {
    const r = iframe.getBoundingClientRect();
    return caja({ top: r.top + inner.top, left: r.left + inner.left, width: inner.width, height: inner.height });
  };
}

/**
 * Mide todas las paradas. Un iframe que todavía no contesta ninguna clave
 * (su puente aún no arrancó) se vuelve a preguntar; las claves que un iframe
 * listo no encuentra son secciones que este inicio no pinta.
 * @param {import('./home-a/recorrido').RecorridoPaso[]} pasos @param {number} timeoutMs
 * @param {() => boolean} vigente
 */
async function medirTodas(pasos, timeoutMs, vigente, intentos = 5) {
  let rects = await Promise.all(pasos.map(paso => medir(paso.target, timeoutMs)));
  for (let i = 1; i < intentos && vigente(); i++) {
    const deFrame = (paso, frame) => 'frame' in paso.target && paso.target.frame === frame;
    const mudos = Object.keys(FRAME_TITLES).filter(frame =>
      document.querySelector(`iframe[title="${FRAME_TITLES[frame]}"]`) && pasos.some(paso => deFrame(paso, frame)) && pasos.every((paso, j) => !deFrame(paso, frame) || !rects[j]));
    if (!mudos.length) break;
    await new Promise(resolve => window.setTimeout(resolve, 800));
    rects = await Promise.all(pasos.map((paso, j) => (mudos.some(frame => deFrame(paso, frame)) ? medir(paso.target, timeoutMs) : rects[j])));
  }
  return rects;
}

function llevarALaVista(rect, paradaId) {
  const r = rect?.();
  if (!r) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  // La fila de pestañas comparte su cabecera con controles flotantes en la
  // mitad superior; bájela para dejar un perchado libre de 48 px encima.
  const aireArriba = paradaId === 'pestanas' ? 180 : AIRE_ARRIBA;
  window.scrollTo({ top: Math.max(0, r.top + window.scrollY - aireArriba), behavior: reduced ? 'instant' : 'smooth' });
}

async function esperarLayoutAsentado() {
  await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  await new Promise(resolve => window.setTimeout(resolve, 100));
}

/**
 * Recorrido de bienvenida de Home A: el compai elegido vuela con
 * <AngelitaGuia> de sección en sección y las explica en su burbuja. Las
 * secciones de los iframes se miden con el puente (home-a/bridge.js) y llegan
 * a la guía como `rect`. Sale solo la primera vez; desde la ayuda se vuelve a
 * pedir (pedirRecorrido).
 * @param {{ companionName: string, startDelayMs?: number, frameTimeoutMs?: number }} props
 */
export default function GuiaInicioHomeA({ companionName, startDelayMs = 700, frameTimeoutMs = 1500 }) {
  const [vuelta, setVuelta] = useState(0);
  const [paradas, setParadas] = useState(/** @type {null | any[]} */ (null));
  const actual = useRef(/** @type {string | null} */ (null));
  const montado = useRef(false);
  const obstaculosFrames = useRef(/** @type {Record<string, Array<{left:number,top:number,right:number,bottom:number,tipo?: 'control'|'control-fijo'|'texto',objetivo?: boolean}> | null>} */ ({}));
  const obstaculosFramesDeParada = useRef(/** @type {string | null} */ (null));
  const obstaculosPagina = useRef(/** @type {{ parada: string | null, momento: number, objetivo: Obstaculo | null, rects: Obstaculo[] }} */ ({ parada: null, momento: 0, objetivo: null, rects: [] }));

  const resolverPuesto = useCallback((rect, opciones) => {
    const ahora = performance.now();
    const idParada = opciones.parada?.id || null;
    // Los iframes desplazan su contenido al entrar a ciertas paradas. No use
    // las cajas de la parada anterior mientras el puente mide ese nuevo estado.
    if (!idParada) return null;
    const framesActualizados = obstaculosFramesDeParada.current === idParada;
    const objetivoActual = caja(rect);
    const anterior = obstaculosPagina.current.objetivo;
    const movioObjetivo = !anterior || ['left', 'top', 'right', 'bottom'].some(key => Math.abs(objetivoActual[key] - anterior[key]) > 4);
    if (obstaculosPagina.current.parada !== idParada || movioObjetivo || ahora - obstaculosPagina.current.momento >= 250) {
      obstaculosPagina.current = { parada: idParada, momento: ahora, objetivo: objetivoActual, rects: obstaculosDePagina(opciones.parada) };
    }
    const obstaculos = [...obstaculosPagina.current.rects];
    for (const [frame, rects] of Object.entries(framesActualizados && idParada !== 'tareas' ? obstaculosFrames.current : {})) {
      if (!rects) continue;
      const iframe = document.querySelector('iframe[title="' + FRAME_TITLES[frame] + '"]');
      if (!iframe) continue;
      const marco = iframe.getBoundingClientRect();
      for (const r of rects) {
        obstaculos.push({ left: marco.left + r.left, top: marco.top + r.top, right: marco.left + r.right, bottom: marco.top + r.bottom, tipo: r.tipo, objetivo: r.objetivo });
      }
    }
    return resolverPuestoCercano(rect, opciones, obstaculos);
  }, []);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  useEffect(() => {
    const pedido = () => {
      actual.current = null;
      setParadas(null);
      setVuelta(v => v + 1);
    };
    window.addEventListener(RECORRIDO_PEDIDO_EVENT, pedido);
    return () => window.removeEventListener(RECORRIDO_PEDIDO_EVENT, pedido);
  }, []);

  useEffect(() => {
    if (recorridoVisto()) return undefined;
    let activo = true;
    const timer = window.setTimeout(async () => {
      const pasos = recorridoPasos(companionName);
      const rects = await medirTodas(pasos, frameTimeoutMs, () => activo);
      if (!activo) return;
      // El saludo puede mostrarse sin bloquear el recorrido si los puentes de
      // prueba o del navegador todavía no contestan. Cada parada vuelve a medir.
      const marcos = await frameObstaculosTodos(Math.min(frameTimeoutMs, 100), pasos[0], () => activo);
      if (!activo) return;
      // El recorrido sigue disponible si un frame aún no levantó su puente.
      // En ese caso el posicionador usa su cálculo habitual hasta recibir medidas.
      obstaculosFrames.current = marcos || {};
      const listas = pasos.flatMap((paso, i) => (rects[i] ? [{ ...paso, rect: rects[i] }] : []));
      setParadas(listas.length ? listas : null);
    }, startDelayMs);
    return () => {
      activo = false;
      window.clearTimeout(timer);
    };
  }, [vuelta, companionName, startDelayMs, frameTimeoutMs]);

  // Al cambiar de parada: volver a medir la sección (el inicio se acomoda
  // cuando llegan los datos) y llevarla a la vista. La guía sigue sola el
  // desplazamiento.
  const onPosicionChange = useCallback((_posicion, parada) => {
    if (!parada || parada.id === actual.current) return;
    const paradaAnterior = actual.current;
    actual.current = parada.id;
    const paso = paradas?.find(p => p.id === parada.id);
    if (!paso) return;
    obstaculosFramesDeParada.current = null;
    const actualizarPuesto = async () => {
      if (paso.id === 'pestanas' || paradaAnterior === 'pestanas') {
        const iframeB = document.querySelector(`iframe[title="${FRAME_TITLES.b}"]`);
        if (iframeB) await framePercha(iframeB, paso.id === 'pestanas', frameTimeoutMs);
        if (!montado.current || actual.current !== paso.id) return;
      }
      let rect = paso.rect;
      if ('frame' in paso.target) {
        rect = await medir(paso.target, frameTimeoutMs);
        if (!rect || !montado.current || actual.current !== paso.id) return;
        setParadas(lista => lista?.map(p => (p.id === paso.id ? { ...p, rect } : p)) ?? lista);
      }
      llevarALaVista(rect, paso.id);
      await esperarLayoutAsentado();
      if (!montado.current || actual.current !== paso.id) return;
      const medidas = await frameObstaculosTodos(frameTimeoutMs, paso, () => montado.current && actual.current === paso.id);
      if (!montado.current || actual.current !== paso.id) return;
      // Si un frame no responde, se completa el ciclo con las medidas locales
      // disponibles y el compai conserva el cálculo de posición habitual.
      obstaculosFrames.current = medidas || {};
      obstaculosFramesDeParada.current = paso.id;
      obstaculosPagina.current.parada = null;
      window.dispatchEvent(new Event('resize'));
    };
    actualizarPuesto();
  }, [paradas, frameTimeoutMs]);

  const onCerrar = useCallback(() => {
    const iframeB = document.querySelector(`iframe[title="${FRAME_TITLES.b}"]`);
    if (iframeB) void framePercha(iframeB, false, frameTimeoutMs);
    actual.current = null;
    setParadas(null);
  }, [frameTimeoutMs]);

  if (!paradas) return null;
  // En el body: dentro del inicio, el aviso de uso sin conexión de la app le
  // quedaba encima a la navegación y se tragaba el toque.
  return createPortal(
    <CompaiAvatarContext value>
      <AngelitaGuia
        key={vuelta}
        paradas={paradas}
        tamano={48}
        recordarCierreId={recorridoGuiaId()}
        variar={false}
        className="ang-guia--inicio"
        resolverPuesto={resolverPuesto}
        onPosicionChange={onPosicionChange}
        onCerrar={onCerrar}
      />
    </CompaiAvatarContext>,
    document.body,
  );
}
