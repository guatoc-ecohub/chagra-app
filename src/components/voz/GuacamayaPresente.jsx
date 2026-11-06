import { memo, useEffect, useId, useMemo, useRef } from 'react';
import rig from '../../visual/creatures/arte-valle/guacamaya.rig.svg?raw';
import defs from '../../visual/creatures/arte-valle/guacamaya.defs.svg?raw';
import { idsDeclaradosEnSvg, namespaceSvg } from '../../visual/creatures/arte-valle/nsRigValle';
import { defsPiel, materiaPiel } from '../../visual/creatures/arte-valle/pielGuacamaya';
import { useVueloGuacamaya } from './useVueloGuacamaya';
import './guacamayaPresente.css';


// La piel y el plumón provienen de la misma fuente que el renderizador Compai.
// El ajuste de percha y sus articulaciones siguen locales a esta ventana.
const torso = rig.match(/<path d="([^"]+)"\s+fill="url\(#gEscarlata\)"/)[1];
const patas = rig.match(/<g stroke="#4a4a52"[\s\S]*?<\/g>/)[0];
const volumen = defsPiel(torso);
const materia = materiaPiel();

const agarre = `<g data-hueso="apoyo">
  <g fill="#10211d" opacity=".55">
    <ellipse cx="-24" cy="172" rx="24" ry="4"/>
    <ellipse cx="27" cy="168" rx="22" ry="3.5"/>
  </g>
  ${patas.replace('stroke="#4a4a52"', 'stroke="url(#vozGarra)"')}
  <g fill="none" stroke="#d0c4a0" stroke-width="1.2" opacity=".65">
    <path d="m-25,157 6,2 m-6,4 6,1 m-15,0 4,3 m-11,-1 3,3 M20,155l6,-1 m-4,7 6,-2 m4,3 -4,3 m9,-1 -3,3"/>
  </g>
  <path d="M-14,175q5,0 6,-4 M-42,167q-4,1 -3,5 M14,175q-5,0 -6,-4 M42,167q4,0 3,4"
    fill="none" stroke="#252b29" stroke-width="2.4" stroke-linecap="round"/>
</g>`;

const rigPresente = rig
  .replace(patas, '')
  // El origen local de cada ala queda dentro del torso, bajo sus coberteras.
  // Los grupos de montaje conservan la traslación y el espejo al batir.
  .replace('translate(-52,10)', 'translate(-38,18)')
  .replace('translate(52,10) scale(-1,1)', 'translate(38,18) scale(-1,1)')
  // Longitud anatómica constante: el batido solo gira las plumas en su raíz.
  .replace('<g transform="translate(0,132)">', '<g data-hueso="colaMontaje" transform="translate(0,132) scale(1,.72)">')
  .replace('<!-- luz de la corona -->', `<g fill="none" stroke-linecap="round">
    <path d="M-29,-99q4,-3 9,-3 m6,-5q5,-1 9,0 m8,1q6,0 9,3 m7,3q5,2 7,6
      M-37,-88q4,-4 8,-4 m7,-5q5,-2 9,-1 m9,-3q5,0 9,2 m8,2q5,2 7,6"
      stroke="#ffbf83" stroke-width="1.4" opacity=".3"/>
    <path d="M-40,-83q3,4 7,4 m5,-12q3,4 8,4 m8,-9q3,4 8,4 m10,-1q4,4 9,4"
      stroke="#69282c" stroke-width="1.2" opacity=".22"/>
  </g><!-- luz de la corona -->`)
  .replace(`<path d="${torso}"`, `<g data-hueso="torax"><path data-superficie="pecho" d="${torso}"`)
  .replace('<g id="cabezaRig">', `${materia}<g id="cabezaRig">`)
  .replace('</g><!-- /cabezaRig -->', '</g><!-- /cabezaRig --></g>')
  .replace('</g><!-- /cuerpoRig -->', `</g><!-- /cuerpoRig -->${agarre}`)
  .replace('fill="#f6f0e4" stroke="#e2d8c6"', 'fill="url(#vozCara)" stroke="#bbae92"')
  .replaceAll('fill="#a8151a"', 'fill="url(#vozCola)"');

const dibujo = `${defs}${volumen}${rigPresente}`
  .replaceAll('url(#gEscarlata)', 'url(#vozPecho)')
  .replaceAll('url(#gCabeza)', 'url(#vozCorona)')
  .replaceAll('url(#gPicoAlto)', 'url(#vozPico)')
  .replaceAll('url(#gAmarillo)', 'url(#vozOro)')
  .replaceAll('url(#gAzulAla)', 'url(#vozAzul)')
  .replaceAll('url(#gColaRoja)', 'url(#vozCola)')
  .replace(/id="([^"]+)"/g, 'id="$1" data-hueso="$1"')
  .replace(/class="([^"]+)"/g, (_, clases) => `class="${clases.split(/\s+/).map(clase => clase.startsWith('voz-') ? clase : `voz-arte-${clase}`).join(' ')}"`);
const ids = idsDeclaradosEnSvg(dibujo);

const entre = (min, max) => min + Math.random() * (max - min);

// La ventana ya publica su estado en el DOM. Observar solo esos atributos
// permite acompañarla sin cambiar su contrato ni renderizar React por gesto.
function useConducta(ref) {
  useEffect(() => {
    const ave = ref.current;
    const ventana = ave.closest('.voz-ventana');
    const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hueso = nombre => ave.querySelector(`[data-hueso="${nombre}"]`);
    const torax = hueso('torax');
    const mandibula = hueso('picoBajo');
    const cuerpo = hueso('cuerpoRig');
    const alas = [hueso('alaIzq'), hueso('alaDer')];
    const cola = ['colaExterna', 'colaMedia', 'colaCentro'].map(hueso);
    const ojos = ave.querySelectorAll('.voz-arte-ojo');
    const articulaciones = [torax, mandibula, cuerpo, hueso('cabezaRig'), ...alas, ...cola,
      ...ojos, ...ave.querySelectorAll('.voz-arte-pupila')];
    const temporizadores = new Set();
    const animaciones = new Set();
    const posesCongeladas = new Map();
    let estado;
    let activa = false;
    let ultimoGesto = '';
    let ladoApoyo = 1;

    function despues(callback, demora) {
      const id = window.setTimeout(() => {
        temporizadores.delete(id);
        if (activa) callback();
      }, demora);
      temporizadores.add(id);
    }

    function animar(nodo, frames, duracion) {
      if (!nodo.animate) return;
      const animacion = nodo.animate(frames, { duration: duracion, easing: 'ease-in-out' });
      animaciones.add(animacion);
      animacion.onfinish = () => animaciones.delete(animacion);
    }

    function respirar() {
      const duracion = entre(4300, 6200);
      const amplitud = entre(.032, .045) * (estado === 'escuchando' ? .7 : 1);
      animar(torax, [
        { transform: 'scale(1)', offset: 0 },
        { transform: `scale(${1 + amplitud}, ${1 + amplitud * .6})`, offset: .38 },
        { transform: 'scale(1)', offset: .86 },
        { transform: 'scale(1)', offset: 1 },
      ], duracion);
      despues(respirar, duracion + entre(180, 650));
    }

    function cerrarOjos() {
      ojos.forEach((ojo, i) => {
        despues(() => animar(ojo, [
          { transform: 'scale(.83, .88)', offset: 0 },
          { transform: 'scale(.83, .07)', offset: .38 },
          { transform: 'scale(.83, .88)', offset: 1 },
        ], entre(170, 230)), i * 24);
      });
    }

    function parpadear() {
      cerrarOjos();
      if (Math.random() < .18) despues(cerrarOjos, entre(340, 520));
      despues(parpadear, estado === 'escuchando' ? entre(5600, 11000) : entre(3200, 8500));
    }

    // Propiedades individuales: se suman a la postura CSS sin reemplazar
    // sus escalas, asimetrías ni la orientación del pico.
    function acomodarCola() {
      const amplitud = entre(5, 9) * (Math.random() < .5 ? -1 : 1);
      const duracion = entre(3400, 4800);
      cola.forEach((pluma, i) => {
        despues(() => animar(pluma, [
          { rotate: '0deg', offset: 0 },
          { rotate: `${amplitud * (1 - i * .24)}deg`, offset: .3 },
          { rotate: `${-amplitud * .16}deg`, offset: .72 },
          { rotate: '0deg', offset: 1 },
        ], duracion + i * 240), i * 170);
      });
      despues(acomodarCola, duracion + entre(1600, 3800));
    }

    function cambiarApoyo() {
      const amplitud = ladoApoyo * entre(2, 3.5);
      ladoApoyo *= -1;
      const duracion = entre(6500, 9500);
      animar(cuerpo, [
        { rotate: '0deg', offset: 0 },
        { rotate: `${amplitud}deg`, offset: .24 },
        { rotate: `${amplitud}deg`, offset: .68 },
        { rotate: '0deg', offset: 1 },
      ], duracion);
      // Un ala afloja primero; la otra termina de plegarse después.
      alas.forEach((ala, i) => {
        despues(() => animar(ala, [
          { rotate: '0deg', offset: 0 },
          { rotate: `${(i ? -1 : 1) * entre(4, 7)}deg`, offset: .35 },
          { rotate: '0deg', offset: 1 },
        ], entre(2400, 3400)), 450 + i * 600);
      });
      despues(cambiarApoyo, duracion + entre(2800, 5500));
    }

    function gesto() {
      const opciones = estado === 'presente' || estado === 'respuesta'
        ? ['horizonte', 'cerca', 'quietud']
        : estado === 'escuchando' ? ['atencion', 'quietud'] : ['cerca', 'quietud'];
      const disponibles = opciones.filter(opcion => opcion !== ultimoGesto);
      ultimoGesto = disponibles[Math.floor(entre(0, disponibles.length))];
      ave.dataset.gesto = ultimoGesto;
      despues(() => {
        delete ave.dataset.gesto;
        despues(gesto, entre(1600, 4200));
      }, entre(2400, 4600));
    }

    function frase() {
      // El estado hablando procede del inicio real de la voz. Sin fonemas
      // disponibles, articula grupos breves con silencios, no sílabas falsas.
      const duracion = entre(650, 1350);
      const acentos = Math.floor(entre(1, 4));
      const frames = [{ transform: 'translateY(0) rotate(0)', offset: 0 }];
      for (let i = 0; i < acentos; i++) {
        frames.push(
          { transform: `translateY(${entre(3, 10)}px) rotate(${entre(1, 3)}deg)`, offset: (i + entre(.2, .45)) / acentos },
          { transform: 'translateY(0) rotate(0)', offset: (i + .8) / acentos },
        );
      }
      frames.push({ transform: 'translateY(0) rotate(0)', offset: 1 });
      animar(mandibula, frames, duracion);
      ave.dataset.gesto = Math.random() > .65 ? 'enfasis' : 'quietud';
      despues(() => {
        delete ave.dataset.gesto;
        despues(frase, entre(400, 1200));
      }, duracion);
    }

    function detener() {
      activa = false;
      temporizadores.forEach(id => window.clearTimeout(id));
      temporizadores.clear();
      animaciones.forEach(animacion => animacion.cancel());
      animaciones.clear();
      delete ave.dataset.gesto;
    }

    function congelarPose() {
      // Leer todas las matrices antes de escribir. Cancelar una animación
      // sin guardar su pose haría saltar el ave justo al pulsar pausa.
      const poses = articulaciones.map(nodo => {
        const estilo = window.getComputedStyle(nodo);
        return { nodo, transform: estilo.transform, rotate: estilo.rotate };
      });
      poses.forEach(({ nodo, transform, rotate }) => {
        posesCongeladas.set(nodo, { transform: nodo.style.transform, rotate: nodo.style.rotate });
        nodo.style.transform = transform;
        nodo.style.rotate = rotate;
      });
    }

    function liberarPose() {
      posesCongeladas.forEach(({ transform, rotate }, nodo) => {
        nodo.style.transform = transform;
        nodo.style.rotate = rotate;
      });
      posesCongeladas.clear();
    }

    function actualizar() {
      const siguienteEstado = ventana?.dataset.estado || 'presente';
      const permitida = !movimientoReducido.matches && !document.hidden && ventana?.dataset.pausada !== 'true';
      if (ave.dataset.fase && ave.dataset.fase !== 'posada') {
        detener();
        liberarPose();
        ave.dataset.quieta = String(!permitida);
        return;
      }
      if (!permitida) {
        if (activa) congelarPose();
        detener();
        // Un cambio de conversación durante la pausa tampoco cambia la pose.
        ave.dataset.actitud ||= siguienteEstado;
        ave.dataset.quieta = 'true';
        return;
      }
      detener();
      liberarPose();
      estado = siguienteEstado;
      ave.dataset.actitud = estado;
      activa = true;
      ave.dataset.quieta = 'false';
      despues(respirar, entre(250, 900));
      despues(parpadear, entre(1800, 4800));
      despues(acomodarCola, entre(450, 950));
      despues(cambiarApoyo, entre(1000, 1800));
      if (estado === 'hablando') despues(frase, 100);
      else despues(gesto, estado === 'escuchando' ? entre(4500, 8000) : entre(900, 1800));
    }

    const observador = new MutationObserver(actualizar);
    ave.addEventListener('vuelo-cambio', actualizar);
    if (ventana) observador.observe(ventana, { attributes: true, attributeFilter: ['data-estado', 'data-pausada'] });
    movimientoReducido.addEventListener('change', actualizar);
    document.addEventListener('visibilitychange', actualizar);
    actualizar();
    return () => {
      detener();
      liberarPose();
      observador.disconnect();
      ave.removeEventListener('vuelo-cambio', actualizar);
      movimientoReducido.removeEventListener('change', actualizar);
      document.removeEventListener('visibilitychange', actualizar);
    };
  }, [ref]);
}

function GuacamayaPresente() {
  const aveRef = useRef(null);
  const instancia = useId().replace(/[^a-zA-Z0-9]/g, '');
  const markup = useMemo(() => ({ __html: namespaceSvg(dibujo, ids, `voz${instancia}`) }), [instancia]);
  useVueloGuacamaya(aveRef);
  useConducta(aveRef);

  return (
    <div ref={aveRef} className="voz-ave voz-ave-presente" aria-hidden="true">
      <div className="voz-ave-sombra" />
      <svg className="voz-rig" viewBox="-210 -145 420 590" focusable="false"
        dangerouslySetInnerHTML={markup} />
    </div>
  );
}

export default memo(GuacamayaPresente);
