/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Claves de actuación del DOM, no texto visible. */
import { useEffect } from 'react';
import { ANCHO_AVE, APOYOS, DURACION_VUELO, REPOSO_INICIAL, alasVuelo, muestraVuelo } from './vueloGuacamaya';

export function useVueloGuacamaya(ref) {
  useEffect(() => {
    const ave = ref.current;
    const corredor = ave.closest('.voz-compai');
    const ventana = ave.closest('.voz-ventana');
    if (!corredor || !ventana) return;
    const preferencia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cuerpo = ave.querySelector('[data-hueso="guacaWrap"]');
    const patas = ave.querySelector('[data-hueso="apoyo"]');
    const sombra = ave.querySelector('.voz-ave-sombra');
    const alas = ['alaIzq', 'alaDer'].map(hueso => ave.querySelector(`[data-hueso="${hueso}"]`));
    const cabeza = ave.querySelector('[data-hueso="cabezaRig"]');
    const cola = ['colaExterna', 'colaMedia', 'colaCentro'].map(hueso => ave.querySelector(`[data-hueso="${hueso}"]`));
    let apoyo = 0;
    let destino = 1;
    let viaje = null;
    let reposo = REPOSO_INICIAL;
    let vuelos = 0;
    let anterior = null;
    let frame = null;
    let espera = null;
    let inicioEspera = 0;
    let sobreLectura = false;
    let focoLectura = false;
    let seleccionando = false;
    ave.dataset.fase = 'posada';
    ave.dataset.apoyo = '0';

    const permitida = () => !preferencia.matches && !document.hidden && ventana.dataset.pausada !== 'true';
    const ocupada = () => sobreLectura || focoLectura || seleccionando
      || ventana.dataset.conversando === 'true'
      || ['escuchando', 'hablando', 'pensando', 'respuesta'].includes(ventana.dataset.estado);

    function dibujar(tiempo) {
      const pose = muestraVuelo(tiempo, APOYOS[apoyo], APOYOS[destino]);
      const ala = alasVuelo(tiempo);
      const rumbo = Math.sign(destino - apoyo);
      ave.dataset.fase = pose.fase;
      // Porcentajes del ave: la geometría se adapta sin medir ni reiniciar al redimensionar.
      ave.style.transform = `translate(${(pose.x - APOYOS[0]) / ANCHO_AVE * 100}%, ${pose.y / (ANCHO_AVE * 590 / 420) * 100}%)`;
      cuerpo.style.transform = `rotate(${pose.inclinacion}deg) scaleY(${1 - pose.compresion})`;
      patas.style.transform = `translateY(${-32 * pose.aire}px) scaleY(${1 - pose.aire * .55})`;
      patas.style.opacity = String(1 - pose.aire * .7);
      sombra.style.opacity = String(1 - pose.aire);
      alas.forEach((nodo, i) => {
        const reposoAla = i ? 8 : -12;
        const escalaX = i ? .94 : .83;
        const escalaY = i ? 1.02 : .98;
        nodo.style.transform = `rotate(${reposoAla + (ala.angulo - reposoAla) * ala.apertura}deg) scale(${escalaX + (1 - escalaX) * ala.apertura}, ${escalaY + (1 - escalaY) * ala.apertura})`;
      });
      cabeza.style.transform = `translate(${-6 + (rumbo * 8 + 6) * pose.aire}px, ${3 - 9 * pose.aire}px) rotate(${-6 + (rumbo * 6 + 6) * pose.aire}deg) scaleX(.94)`;
      cola.forEach((pluma, i) => {
        const anguloReposo = [9, 5, 2][i];
        pluma.style.transform = `rotate(${anguloReposo + (rumbo * (14 - i * 4) - anguloReposo) * pose.aire}deg)`;
      });
    }

    function avanzar(ahora) {
      frame = null;
      if (!permitida()) return;
      // Una pestaña suspendida no debe saltarse el vuelo al recuperar un frame.
      viaje += anterior === null ? 0 : Math.min(64, ahora - anterior);
      anterior = ahora;
      dibujar(viaje);
      if (viaje >= DURACION_VUELO) {
        apoyo = destino;
        ave.dataset.apoyo = String(apoyo);
        viaje = null;
        anterior = null;
        vuelos++;
        reposo = [8000, 9500, 7000][vuelos % 3];
        cuerpo.style.removeProperty('transform');
        patas.style.removeProperty('transform');
        patas.style.removeProperty('opacity');
        sombra.style.removeProperty('opacity');
        alas.forEach(nodo => nodo.style.removeProperty('transform'));
        cabeza.style.removeProperty('transform');
        cola.forEach(nodo => nodo.style.removeProperty('transform'));
        ave.dispatchEvent(new Event('vuelo-cambio'));
        programar();
      } else frame = requestAnimationFrame(avanzar);
    }

    function despegar() {
      espera = null;
      reposo = 0;
      if (!permitida() || ocupada()) return;
      destino = 1 - apoyo;
      viaje = 0;
      anterior = null;
      ave.dataset.motivo = ventana.dataset.estado === 'mirando' ? 'acercarse' : 'horizonte';
      dibujar(0);
      ave.dispatchEvent(new Event('vuelo-cambio'));
      frame = requestAnimationFrame(avanzar);
    }

    function programar() {
      if (espera !== null || frame !== null || !permitida()) return;
      if (viaje !== null) {
        anterior = null;
        frame = requestAnimationFrame(avanzar);
      } else if (!ocupada()) {
        inicioEspera = performance.now();
        espera = window.setTimeout(despegar, reposo);
      }
    }

    function actualizar() {
      if (espera !== null) {
        reposo = Math.max(0, reposo - (performance.now() - inicioEspera));
        clearTimeout(espera);
        espera = null;
      }
      if (!permitida() && frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
        anterior = null;
      }
      ave.dataset.vueloPausado = String(!permitida());
      // La interacción no interrumpe ni invierte el viaje ya iniciado.
      if (ocupada() && viaje === null) reposo = Math.max(reposo, REPOSO_INICIAL);
      programar();
    }

    const zonaLectura = nodo => nodo instanceof Element && Boolean(nodo.closest(
      '.voz-presentacion, .voz-palabras-escena, .voz-mesa, input, textarea, [contenteditable="true"]',
    ));
    function entrar(evento) { sobreLectura = zonaLectura(evento.target); actualizar(); }
    function salir(evento) { sobreLectura = zonaLectura(evento.relatedTarget); actualizar(); }
    function enfocar(evento) { focoLectura = zonaLectura(evento.target); actualizar(); }
    function desenfocar(evento) { focoLectura = zonaLectura(evento.relatedTarget); actualizar(); }
    function seleccionar() {
      const seleccion = document.getSelection();
      seleccionando = Boolean(seleccion && !seleccion.isCollapsed && ventana.contains(seleccion.anchorNode));
      actualizar();
    }
    function actividad() {
      clearTimeout(espera);
      espera = null;
      reposo = REPOSO_INICIAL;
      actualizar();
    }
    const eventos = [['pointerover', entrar], ['pointerout', salir], ['focusin', enfocar],
      ['focusout', desenfocar], ['input', actividad], ['pointerdown', actividad], ['scroll', actividad]];
    eventos.forEach(([tipo, callback]) => ventana.addEventListener(tipo, callback, true));
    const observador = new MutationObserver(actualizar);
    observador.observe(ventana, { attributes: true, attributeFilter: ['data-estado', 'data-pausada', 'data-conversando'] });
    preferencia.addEventListener('change', actualizar);
    document.addEventListener('visibilitychange', actualizar);
    document.addEventListener('selectionchange', seleccionar);
    actualizar();
    return () => {
      clearTimeout(espera);
      if (frame !== null) cancelAnimationFrame(frame);
      observador.disconnect();
      eventos.forEach(([tipo, callback]) => ventana.removeEventListener(tipo, callback, true));
      preferencia.removeEventListener('change', actualizar);
      document.removeEventListener('visibilitychange', actualizar);
      document.removeEventListener('selectionchange', seleccionar);
    };
  }, [ref]);
}
