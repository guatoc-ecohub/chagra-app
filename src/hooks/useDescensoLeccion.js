import { useEffect, useRef, useState } from 'react';

/**
 * @typedef {Object} PaginaLeccion
 * @property {number} estacion
 * @property {number} total
 * @property {string} titulo
 * @property {number} pagina
 * @property {number} paginas
 * @property {string} [cabecera]
 * @property {{i: number, texto: string, tipo: 'boton'|'enlace', href: string|null, pulsado: boolean, desactivado: boolean}[]} [acciones]
 * @property {string} clase
 * @property {string[]} frases
 * @property {string} [nota]
 * @property {{palabra: string, definicion: string}[]} palabras
 * @property {{medidor?: {x: number, y: number, w: number, h: number}}} [anclas]
 */

function listaValida(data, slug) {
  return data.v === 1 && data.slug === slug && typeof data.titulo === 'string'
    && Array.isArray(data.estaciones) && data.estaciones.length > 0
    && data.estaciones.every((e) => e && typeof e.t === 'string' && Number.isInteger(e.paginas) && e.paginas > 0);
}

function accionesValidas(acciones) {
  return acciones == null || (Array.isArray(acciones)
    && acciones.every((a) => a && Number.isInteger(a.i) && a.i >= 0
      && typeof a.texto === 'string' && ['boton', 'enlace'].includes(a.tipo)
      && typeof a.pulsado === 'boolean' && typeof a.desactivado === 'boolean'
      && (a.tipo === 'boton' ? a.href == null || typeof a.href === 'string'
        : typeof a.href === 'string' && /^(https?:|tel:|mailto:|\/|#)/i.test(a.href)))
    && new Set(acciones.map((a) => a.i)).size === acciones.length);
}

function paginaValida(data, lista) {
  return data.v === 1 && Number.isInteger(data.estacion) && data.estacion >= 1
    && data.total === lista.estaciones.length && data.estacion <= data.total
    && Number.isInteger(data.pagina) && data.pagina >= 1
    && data.paginas === lista.estaciones[data.estacion - 1].paginas && data.pagina <= data.paginas
    && typeof data.titulo === 'string' && typeof data.clase === 'string'
    && Array.isArray(data.frases) && data.frases.every((f) => typeof f === 'string')
    && accionesValidas(data.acciones)
    && (data.cabecera == null || typeof data.cabecera === 'string')
    && (data.nota == null || typeof data.nota === 'string')
    && Array.isArray(data.palabras) && data.palabras.every((p) => p && typeof p.palabra === 'string' && typeof p.definicion === 'string');
}

export function estadoLeccion(pagina, especie) {
  if (pagina.estacion === pagina.total && pagina.pagina === pagina.paginas) return 'contenta';
  switch (pagina.clase) {
    case 'tam': case 'cuando': return 'senala';
    case 'hacer': return especie === 'angelita' ? 'asiente' : 'invita';
    // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish -- Estado del contrato, no texto UI.
    case 'pensar': return 'pensando';
    case 'cuidado': return 'preocupada';
    default: return 'acompana';
  }
}

/** The bridge exposes one-based station and page numbers. */
export default function useDescensoLeccion(iframeRef, slug) {
  const [pagina, setPagina] = useState(null);
  const [entrada, setEntrada] = useState(false);
  const sesion = useRef({ lista: null, abierta: false, timer: null, gestoTimer: null, estacion: -1 });
  const enviar = (tipo, carga = {}) => iframeRef.current?.contentWindow?.postMessage(
    { tipo: `chagra:leccion-${tipo}`, v: 1, ...carga }, window.location.origin,
  );
  const cargar = () => {
    const s = sesion.current;
    clearTimeout(s.timer);
    clearTimeout(s.gestoTimer);
    s.lista = null;
    s.estacion = -1;
    s.abierta = true;
    setPagina(null);
    setEntrada(false);
    s.timer = setTimeout(() => { if (!s.lista) s.abierta = false; }, 1500);
    enviar('hola');
  };
  useEffect(() => {
    const s = sesion.current;
    const recibir = (event) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!s.abierta || !data) return;
      if (data.tipo === 'chagra:leccion-lista' && !s.lista && listaValida(data, slug)) {
        s.lista = data;
        clearTimeout(s.timer);
      } else if (data.tipo === 'chagra:leccion-pagina' && s.lista && paginaValida(data, s.lista)) {
        const nueva = s.estacion !== data.estacion && data.pagina === 1;
        s.estacion = data.estacion;
        clearTimeout(s.gestoTimer);
        setEntrada(nueva);
        setPagina(data);
        if (nueva) s.gestoTimer = setTimeout(() => setEntrada(false), 1000);
      }
    };
    window.addEventListener('message', recibir);
    return () => {
      window.removeEventListener('message', recibir);
      clearTimeout(s.timer);
      clearTimeout(s.gestoTimer);
      s.abierta = false;
    };
  }, [iframeRef, slug]);
  return { pagina, entrada, enviar, cargar };
}
