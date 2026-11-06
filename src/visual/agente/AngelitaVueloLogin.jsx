import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Angelita } from './Angelita.jsx';
import {
  obstaculosVisibles,
  mapaLibre,
  rutaLibre,
  tramoLibre,
  puestoLibreCercano,
  elegirDestino,
} from './vueloLibre.js';
import { duracionDeVuelo } from '../../components/compaiPuestoSeguro.js';
import './angelita-vuelo-login.css';

/*
 * AngelitaVueloLogin — la misma presencia que nace dentro del círculo del
 * login y sale a volar libre.
 *
 * Coreografía (decisión del operador, 2026-09-28; los tiempos los manda
 * LoginScreen):
 *   0–2 s  dentro del círculo, volando QUIETA en crucero (aleteo, sin
 *          desplazarse), con la cara alegre. Sin gestos del reposo.
 *   1 s    parpadea una vez (`parpadea`).
 *   2 s    sale del círculo (`libre`) y revolotea por las zonas vacías de la
 *          pantalla: nunca sobre el formulario, los campos ni los botones
 *          (geometría en vueloLibre.js). Posa un rato en cada sitio y sigue.
 *
 * `quieta` (reduced-motion o gama baja): no vuela; al salir queda en un
 * puesto libre, sonriente, en fotograma digno.
 *
 * RETIRADO (2026-09-03, feedback_pizarra_unico_aviso_compai): la burbuja de
 * bienvenida durante el vuelo. Si el login necesita un texto accesible, que
 * sea un aria-label, no un globo nuevo.
 */

/** Lado de su caja en vuelo libre (px): el mismo puesto de 84 del FAB. */
const CAJA = 84;
/** Cada cuánto relee qué hay en pantalla (ms): contenido que aparece tarde. */
const RELEER_MS = 800;

const facil = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

/**
 * El motor del vuelo libre: escribe el transform de `ref` en cada cuadro, sin
 * re-renderizar React. Devuelve nada; vive mientras `activo`.
 */
function useVueloLibre(ref, { activo, origen, quieta }) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!activo || !el || typeof window === 'undefined') return undefined;
    const viewport = () => ({ ancho: window.innerWidth, alto: window.innerHeight });
    let obstaculos = [];
    let mapa = null;
    let escapando = false;
    const leer = () => {
      obstaculos = obstaculosVisibles(document, { ignorar: el });
      mapa = mapaLibre({ ...viewport(), caja: CAJA, obstaculos });
      // Sin un solo hueco (p. ej. la pantalla desplazada deja una tarjeta a lo
      // ancho) no hay dónde estar sin tapar: se esconde hasta que lo haya.
      el.classList.toggle('is-sin-hueco', mapa.cuantos === 0 || escapando);
    };
    // El círculo con la milpa se cruza volando, pero no es sitio para quedarse:
    // la ilustración y sus rótulos quedarían tapados.
    const zonasDePaso = () => [...document.querySelectorAll('.login-abejita-stage')].map((n) => {
      const r = n.getBoundingClientRect();
      return { left: r.left - 20, top: r.top - 20, right: r.right + 20, bottom: r.bottom + 20 };
    });
    const poner = (x, y, giro = 0) => {
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${giro.toFixed(2)}deg)`;
    };
    leer();
    let pos = origen ? { ...origen } : { x: viewport().ancho - CAJA - 8, y: 8 };
    poner(pos.x, pos.y);
    el.dataset.vuelo = 'libre';

    if (quieta) {
      // Fotograma digno: el puesto libre más cercano a la esquina de arriba a
      // la derecha, lejos del formulario. Se recoloca si cambia la pantalla.
      const posar = () => {
        leer();
        const sitio = mapa.cuantos ? puestoLibreCercano(mapa, { x: viewport().ancho, y: 0 }) : null;
        if (sitio) { pos = sitio; poner(pos.x, pos.y); }
        el.dataset.vuelo = sitio ? 'quieta' : 'sin-sitio';
      };
      posar();
      window.addEventListener('resize', posar);
      return () => window.removeEventListener('resize', posar);
    }

    let ruta = [];
    let tramo = null;
    let pausaHasta = 0;
    let primera = true;
    let raf = 0;
    let ultimoLeer = performance.now();
    const planear = (ahora) => {
      if (!mapa?.cuantos) { ruta = []; tramo = null; pausaHasta = ahora + 600; return; }
      // Si algo le quedó debajo (se desplazó la pantalla, rotó un carrusel),
      // no hay camino por celdas libres desde ahí: sale derecho al hueco más
      // cercano y desde ese sitio sigue revoloteando.
      if (!tramoLibre(pos, pos, obstaculos, { caja: CAJA, ...viewport() })) {
        const hueco = puestoLibreCercano(mapa, pos);
        if (hueco) {
          // La escapada cruza lo que tenga encima: va escondida y rápida.
          ruta = [hueco];
          escapando = true;
          el.classList.add('is-sin-hueco');
          el.dataset.destino = `escape ${Math.round(hueco.x)},${Math.round(hueco.y)}`;
          return;
        }
      }
      for (let intento = 0; intento < 6; intento += 1) {
        // La primera salida va hacia arriba a la derecha, hacia donde mira.
        const destino = primera
          ? puestoLibreCercano(mapa, { x: viewport().ancho, y: 0 })
          : elegirDestino(mapa, pos, { evitar: zonasDePaso() });
        if (!destino) break;
        const camino = rutaLibre(mapa, pos, destino, obstaculos, viewport());
        if (camino && camino.length) {
          ruta = camino;
          primera = false;
          el.dataset.destino = `${Math.round(destino.x)},${Math.round(destino.y)}`;
          return;
        }
      }
      ruta = [];
      pausaHasta = ahora + 600;
    };
    const siguienteTramo = (ahora) => {
      const a = ruta.shift();
      if (!a) { tramo = null; return; }
      const dur = escapando ? 450 : duracionDeVuelo({ left: pos.x, top: pos.y }, { left: a.x, top: a.y });
      tramo = { de: { ...pos }, a, t0: ahora, dur };
    };
    const cuadro = (ahora) => {
      raf = window.requestAnimationFrame(cuadro);
      if (ahora - ultimoLeer > RELEER_MS) {
        ultimoLeer = ahora;
        leer();
        // Si lo que sigue ya no está libre (apareció algo o la pantalla se
        // desplazó debajo de ella), se replanea ya. Vale también cuando está
        // revoloteando quieta en un sitio: el sitio pudo quedar ocupado.
        const dims = { caja: CAJA, ...viewport() };
        const meta = tramo?.a ?? pos;
        if (!tramoLibre(pos, meta, obstaculos, dims)) {
          tramo = null;
          ruta = [];
          pausaHasta = 0;
        }
      }
      if (!tramo) {
        if (ruta.length) siguienteTramo(ahora);
        else if (ahora >= pausaHasta) {
          planear(ahora);
          if (ruta.length) siguienteTramo(ahora);
        }
      }
      let giro = 0;
      if (tramo) {
        const t = Math.min(1, (ahora - tramo.t0) / tramo.dur);
        const k = facil(t);
        pos = { x: tramo.de.x + (tramo.a.x - tramo.de.x) * k, y: tramo.de.y + (tramo.a.y - tramo.de.y) * k };
        // Se ladea hacia donde va (y frena derecha): inercia, no flotador.
        giro = Math.max(-7, Math.min(7, ((tramo.a.x - tramo.de.x) / Math.max(1, tramo.dur)) * 9 * Math.sin(Math.PI * t)));
        if (t >= 1) {
          tramo = null;
          if (escapando) {
            escapando = false;
            el.classList.toggle('is-sin-hueco', !mapa?.cuantos);
          }
          // Al llegar al final de la ruta revolotea en el sitio antes de seguir.
          if (!ruta.length) pausaHasta = ahora + 1400 + Math.random() * 2600;
        }
      }
      // Balanceo de cernido: ±2 px, siempre dentro del margen de los obstáculos.
      const bob = Math.sin(ahora / 150) * 2;
      const { ancho, alto } = viewport();
      const x = Math.min(ancho - CAJA, Math.max(0, pos.x));
      const y = Math.min(alto - CAJA, Math.max(0, pos.y + bob));
      poner(x, y, giro);
    };
    raf = window.requestAnimationFrame(cuadro);
    const alCambiar = () => { ultimoLeer = 0; };
    window.addEventListener('resize', alCambiar);
    window.addEventListener('scroll', alCambiar, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', alCambiar);
      window.removeEventListener('scroll', alCambiar, true);
    };
  }, [ref, activo, origen, quieta]);
}

export default function AngelitaVueloLogin({
  libre = false,
  origen = null,
  parpadea = false,
  quieta = false,
  invitando = false,
}) {
  const ref = useRef(null);
  useVueloLibre(ref, { activo: libre, origen, quieta });
  // Marca de tiempo del montaje: el gate mide la coreografía desde aquí.
  useEffect(() => {
    const raiz = document.documentElement;
    if (!raiz.dataset.loginAngelitaT0) raiz.dataset.loginAngelitaT0 = String(Math.round(performance.now()));
  }, []);

  const claseAncla = libre ? 'is-libre' : 'is-en-orbe';
  const contenido = (
    <span
      ref={ref}
      className={`login-angelita-presencia ${claseAncla}${parpadea && !quieta ? ' is-parpadea' : ''}`}
      data-login-angelita={libre ? 'libre' : 'en-orbe'}
    >
      <Angelita
        estado={invitando ? 'invita' : 'acompana'}
        size={libre ? 82 : 88}
        animated={!quieta}
        idleCerebro={libre && !quieta}
        title="Angelita, compañera de Chagra"
      />
    </span>
  );

  /* El orbe de Fase 1 usa backdrop-filter, que crea un containing block para
     descendientes fixed. El portal conserva esta misma entidad React y evita
     que el vuelo libre quede relativo al círculo. */
  return libre && typeof document !== 'undefined'
    ? createPortal(contenido, document.body)
    : contenido;
}
