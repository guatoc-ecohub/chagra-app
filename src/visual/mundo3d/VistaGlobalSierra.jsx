import { parseCultivos } from '../../services/agroIndices.js';
import AvisoSanitarioPiso from '../../components/clima/AvisoSanitarioPiso.jsx';
import { tituloSanitarioDeCultivos, accionSanitariaDeCultivos } from '../../services/riesgoSanitarioPiso.js';
/*
 * VistaGlobalSierra — la MONTAÑA MAESTRA: la Sierra Nevada de Santa Marta
 * emergiendo del Caribe como portada y mapa vertical de todo Chagra.
 *
 * Es el establishing shot de más alto calibre del mundo 3D: el único macizo
 * litoral que reúne TODOS los pisos térmicos, del mar a la nieve perpetua en
 * ~42 km. Aquí se lee el gradiente altitudinal que estructura al agente y al
 * grafo (cross_thermal): playa y bosque seco → selva húmeda → bosque de niebla
 * → páramo y frailejones → superpáramo → nieve. La silueta es reconocible:
 * la cumbre nevada del **Pico Cristóbal Colón**, el **Pico Simmonds** al
 * flanco, **Palomino** al pie sobre el Caribe, y el mar abierto al norte.
 *
 * ── TERRITORIO SAGRADO Y HABITADO (regla no negociable, DR cultural) ────────
 * La Sierra es el Corazón del Mundo para los pueblos Kogui, Arhuaco (Iku),
 * Wiwa y Kankuamo, dentro de la Línea Negra. NO es un decorado. Esta escena la
 * representa con dignidad y sobriedad: reverencia, no exotización. Cero
 * iconografía ceremonial (poporo, tejidos rituales, sitios de pagamento), cero
 * "tierra vacía", cero estética mística de adorno. Un pie de texto acredita a
 * los cuatro pueblos SIEMPRE (viaja con la escena: DOM en el modo con Canvas,
 * `Html` en el grupo componible). Cualquier uso público de identidad cultural
 * exige consulta y consentimiento previo, libre e informado (CLPI) con la CIT y
 * las autoridades tradicionales — es decisión de producto, no de esta escena.
 *
 * ── LO QUE TRAJO EL MUNDO COSTERO (2026-09-05, ARTE-SIERRA-COSTERO) ────────
 * El operador puso la vara en `mundo-costero.guatoc.co` («ESTAMOS LEJOS»). De
 * ese mundo se trajeron, adaptadas a esta escala (1 u = 1 155 m):
 *   · el MAR: `sierra/marSierra.js` (la superficie Gerstner de `costero/Mar.js`
 *     hecha escalable) — banda turquesa de la plataforma, rompiente sobre la
 *     costa, chispeo del sol, fresnel del MISMO cielo del domo. Y su segunda
 *     instancia en modo espejo: dos LAGUNAS DE PÁRAMO (Naboba, Sintana);
 *   · la COSTA con forma y el LECHO marino: `sierra/sierraRelieve.js` (costaZ,
 *     plataforma, promontorio de Tayrona, delta de Palomino), ley ÚNICA que
 *     esta vista ahora IMPORTA (murió la copia local);
 *   · las CRESTAS: ruido simplex `ridged` del `RNG.js` del costero en la ley
 *     de altura — cordales y vaguadas en vez de tres gaussianas lisas;
 *   · el CIELO como función (`sierra/aireSierra.js`): domo HDR que reproduce
 *     los colores ya afinados, con el sol donde la luz viene, y BRUMA POR
 *     ALTURA (la capa húmeda de los alisios abajo, cumbre nítida arriba)
 *     inyectada en terreno, nubes y mar: un solo aire;
 *   · las NUBES con volumen (`sierra/nubesSierra.js`): cúmulos de geometría
 *     iluminados por la escena, base plana en su cota, sombra sobre la ladera
 *     en tier alto — cúmulos de alisios sobre el Caribe (cuántos y a qué base
 *     lo decide la fase ENSO) y orográficas en la franja de condensación;
 *   · SOMBRAS proyectadas (solo `perfil.sombras`, tier alto): el sol bajo
 *     modela las crestas y las nubes marcan la ladera.
 *
 * ── RENDIMIENTO (gama baja + offline, DR render §B/§6) ──────────────────────
 * Terreno 100% procedural (heightmap por función determinista; cero DEM/GLTF/
 * HDR remoto → cachea limpio en el service worker). Presupuesto por `tier`:
 *   alto  → terreno 96², mar calidad 2, 15 nubes, sombras, bruma por altura;
 *   medio → terreno 48², mar calidad 1, 10 nubes, sin sombras, bruma;
 *   bajo  → terreno 32², mar calidad 0, 7 nubes, sin sombras, sin bruma.
 * El sombreado es SUAVE en todos los tiers (el costero es suave; las facetas
 * leían como decorado — tensión T4 del informe anterior, resuelta hacia el
 * mandato de realismo). `reducedMotion` congela mar/nubes y pasa a `demand`.
 * 🔴 Costo en Mali-G78: ver el informe del carril (medido en el Pixel 6 Pro).
 *
 * ── EXPORTS ─────────────────────────────────────────────────────────────────
 *   default  VistaGlobalSierra  → escena montable con su propio <Canvas> + pie
 *                                 de crédito DOM + clave de pisos accesible.
 *   named    SierraDiorama      → grupo r3f puro para COMPONER dentro de otro
 *                                 <Canvas> (trae luces/niebla/crédito por props).
 *
 * ── CABLEO (lo hace el host / otra dirección de arte / el orquestador; este archivo NO toca App.jsx
 *    ni mundoData.js) ─────────────────────────────────────────────────────────
 *
 *   import VistaGlobalSierra from './visual/mundo3d/VistaGlobalSierra.jsx';
 *   <VistaGlobalSierra tier={tier} reducedMotion={reducedMotion} pisoUsuario="frio" />
 *
 *   import { SierraDiorama } from './visual/mundo3d/VistaGlobalSierra.jsx';
 *   <Canvas camera={{ position: [-1.5, 6.6, -12.8], fov: 48 }} shadows>
 *     <SierraDiorama tier={tier} reducedMotion={reducedMotion} />
 *   </Canvas>
 *
 * El contenedor padre define el alto (como `.mundo-root`).
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, AdaptiveDpr } from '@react-three/drei';
import { ATMOSFERA_SIERRA, SOL_SIERRA } from './sierra/luzSierra.js';
import { perfilDeTier } from './deviceTier.js';
import PisosTermicosBandas from './PisosTermicosBandas.jsx';
import { getProfile } from '../../services/userProfileService.js';
import { sugerenciasCultivosSierra } from './sierra/lecturaClimaAterrizaje.js';
import MapaDeNivel from './sierra/MapaDeNivel.jsx';
import ClimaParcelaSierra from './sierra/ClimaParcelaSierra.jsx';
import { slotTarjetaSierra } from './tarjetasSierraLayout.js';
import TransicionSierraMundo from './TransicionSierraMundo.jsx';
import { BANDAS_SIERRA, PISOS_TERMICOS_SIERRA, altitudFincaValida, mundoPrincipalDePiso, pisoPorAltitud } from './pisosTermicos.js';
import { leerGateDescenso } from './sierra/descensoSierra.js';

const _posicionHtmlSierra = new THREE.Vector3();

function posicionHtmlTarjetaSierra(grupo, camara, tamano, id) {
  if (tamano.width <= 600) {
    const slot = slotTarjetaSierra(id, tamano.width);
    const tarjeta = document.querySelector(`.vsierra-dato-mundo[data-lectura="${id}"]`);
    const lienzo = document.querySelector('.vsierra-canvas');
    const cajaTarjeta = tarjeta?.getBoundingClientRect();
    const cajaLienzo = lienzo?.getBoundingClientRect();
    const anchoTarjeta = cajaTarjeta?.width || slot.ancho;
    const altoTarjeta = cajaTarjeta?.height || 52;
    return [slot.x - (cajaLienzo?.left || 0) + anchoTarjeta / 2,
      slot.y - (cajaLienzo?.top || 0) + altoTarjeta / 2];
  }
  grupo.getWorldPosition(_posicionHtmlSierra).project(camara);
  return [tamano.width / 2 + (_posicionHtmlSierra.x * tamano.width) / 2,
    tamano.height / 2 - (_posicionHtmlSierra.y * tamano.height) / 2];
}
import {
  anadirAtributoNieve, crearInyectorNieve,
} from './sierra/nieveSierra.js';
import {
  alturaSierra, alturaFaldon, ruido, smoothstep, CIMA, COSTA_Z, ANCHO, FONDO, LAGUNAS_PARAMO, exposicionMar, pesoPromontorio,
} from './sierra/sierraRelieve.js';
import { atmosferaLinealSierra, BRUMA_SIERRA } from './sierra/aireSierra.js';
import { MarSierra, PERFIL_PLAYA, PERFIL_PARAMO } from './sierra/marSierra.js';
import { geometriaRioNubes, texturaRioNube, materialRioNube } from './sierra/nubesSierra.js';
import { faseEnsoViva } from './sierra/aterrizajeDescenso.js';
import { estadoAtmosferaSierra, crearAireVivo, luzSierraDesdeHora } from './sierra/atmosferaVivaSierra.js';
import { leerCicloParam } from './useCicloDia.js';
import { contratoClimaEscena } from './sierra/climaSierra.js';
import useClima3DVivo from '../../hooks/useClima3DVivo.js';
import useClimaPorPiso from '../../hooks/useClimaPorPiso.js';
import { leerGateAtmosfera } from '../../services/atmosphereService.js';

import { componerNubesSierra } from './sierra/composicionNubesSierra.js';
import { colorManto, inyectarGranoManto } from './sierra/mantoSierra.js';
import CieloVivoMacizo from './sierra/CieloVivoMacizo.jsx';
import { ordenarDecisionesSierra } from './prioridadPanelSierra.js';
import { accionDecisionSierra } from './accionDecisionSierra.js';
import { interpretarHelada, interpretarViento, razonMinimaHelada } from './interpretacionPanelSierra.js';
import { FORECAST_THRESHOLDS } from '../../constants/alertThresholds.js';
import { AtmosferaViva, useAtmosferaViva } from './atmosfera/index.js';

/** @returns {[number, number, number]} */
const posicionSierra = (x, y, z) => [x, y, z];

const MEDIA_CALMA = '(prefers-reduced-motion: reduce)';
function suscribirCalma(notificar) {
  const media = window.matchMedia(MEDIA_CALMA);
  media.addEventListener('change', notificar);
  return () => media.removeEventListener('change', notificar);
}
function leerCalma() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia(MEDIA_CALMA).matches;
}
const calmaServidor = () => false;
function useCalma(solicitada) {
  return useSyncExternalStore(suscribirCalma, leerCalma, calmaServidor) || solicitada;
}

const AVISO_UBICACION = 'sierra:aviso-ubicacion-visto';

/* La caja de herramientas es una puerta contextual, no un segundo catálogo.
   Esta lista replica la selección operativa de CAJA-MUNDOS-POR-PISO y conserva
   el path que el router productivo entiende. */
const HERRAMIENTAS_POR_PISO = {
  nevado: [
    ['mockup_paramo_humboldt_3d', 'Corte de altura y exposición'],
    ['mockup_valle_lluvia_3d', 'Lluvia, escorrentía y reserva'],
    ['mockup_mundo_agua_3d', 'Nieve, deshielo y nacimiento'],
    ['mockup_mundo_semillero_3d', 'Semillero protegido'],
    ['mockup_mundo3d_sanidad', 'Sanidad del cultivo'],
    ['mockup_mundo3d_suelo', 'Suelo frente a las heladas'],
  ],
  paramo: [
    ['mockup_mundo_bosque_nativo', 'Frailejonal, bosque y cuidado'],
    ['mockup_restauracion_tiempo_3d', 'Recuperación de cobertura'],
    ['mockup_mundo_agua_3d', 'Nacimientos y regulación del agua'],
    ['mockup_mundo3d_suelo', 'Suelo altoandino'],
    ['mockup_mundo_microfauna_3d', 'Vida pequeña del suelo'],
    ['mockup_micorrizas_3d', 'Raíces y micorrizas'],
  ],
  frio: [
    ['mockup_papa_viva_3d', 'Papa y decisiones de siembra'],
    ['mockup_invernadero_vivo_3d', 'Microclima y protección'],
    ['mockup_lecheria_viva_3d', 'Pastos y animales'],
    ['mockup_mundo_leguminosas_3d', 'Asociación y cobertura'],
    ['mockup_mundo_semillero_3d', 'Germinación y trasplante'],
    ['mockup_mundo3d_sanidad', 'Plagas y enfermedades'],
  ],
  templado: [
    ['mockup_cafetal_vivo_3d', 'Café y asociaciones'],
    ['mockup_mundo_piscicultura_3d', 'Agua, peces y manejo'],
    ['mockup_mundo_polinizadores_3d', 'Floración y cercas vivas'],
    ['mockup_lecheria_viva_3d', 'Pastos y leche'],
    ['mockup_mundo_botica_cana_3d', 'Caña y transformación'],
    ['mockup_mundo_frutales_3d', 'Combinación y cosecha'],
  ],
  calido: [
    ['mockup_cacao_vivo_3d', 'Cacao y manejo de la sombra'],
    ['mockup_mundo_frutales_3d', 'Frutales de tierra caliente'],
    ['mockup_mundo_botica_cana_3d', 'Caña y transformación'],
    ['mockup_mundo_abejas_3d', 'Polinización y colmenas'],
    ['mockup_mundo_frutales_3d', 'Vergel y asociación'],
    ['mockup_mundo_piscicultura_3d', 'Agua y proteína animal'],
  ],
  rio: [
    ['mockup_mundo_piscicultura_3d', 'Agua, peces y calidad'],
    ['mockup_valle_lluvia_3d', 'Lluvia, escorrentía y crecidas'],
    ['mockup_mundo_agua_3d', 'Captación y cuidado del cauce'],
    ['mockup_mundo3d_suelo', 'Erosión y suelo de orilla'],
    ['mockup_mundo3d_sanidad', 'Sanidad y contaminación del agua'],
    ['mockup_momento_venta_mercado_3d', 'Salida al mercado'],
  ],
};

const NOMBRES_CAJA = {
  nevado: 'nevado', paramo: 'páramo', frio: 'frío', templado: 'templado', calido: 'cálido', rio: 'río',
};

function pisoDeCaja(pisoActivo, pisoUsuario, msnm) {
  const texto = String(pisoActivo || pisoUsuario || '').toLowerCase();
  if (texto.includes('nevado') || texto === 'nival') return 'nevado';
  if (['frio', 'templado', 'calido'].includes(texto)) return texto;
  if (texto.includes('río') || texto.includes('rio')) return 'rio';
  if (texto.includes('páramo') || texto.includes('paramo') || texto === 'superparamo') return 'paramo';
  const piso = pisoPorAltitud(typeof msnm === 'number' ? msnm : null);
  return piso?.id || 'calido';
}

function PuertaHerramientas({ pisoId, msnm = null, abierta, onAbrir, onCerrar, onNavigate, clima = null, children }) {
  const pisoNombre = NOMBRES_CAJA[pisoId] || pisoId;
  const mundos = HERRAMIENTAS_POR_PISO[pisoId] || [];
  const cota = typeof msnm === 'number' && Number.isFinite(msnm)
    ? `${Math.round(msnm).toLocaleString('es-CO')} m`
    : 'sin cota confirmada';
  const helada = campoClima(clima, ['heladaRiesgo']);
  const alerta = helada === 'alto'
    ? 'Proteger esta noche'
    : helada === 'medio'
      ? 'Vigilar la noche'
      : 'Sin alerta prioritaria';
  const acciones = [
    ...(helada === 'alto' || helada === 'medio' ? [['clima_boletin', alerta, true]] : []),
    ...mundos.map(([path, nombre]) => [path, nombre, false]),
  ];
  const botonRef = useRef(null);
  useEffect(() => {
    if (!abierta) botonRef.current?.focus();
  }, [abierta]);
  return (
    <>
      {!abierta && (
        <button
          ref={botonRef}
          type="button"
          className="vsierra-puerta"
          data-testid="puerta-herramientas"
          aria-label="Abrir más opciones"
          title="Más opciones"
          aria-haspopup="dialog"
          aria-expanded="false"
          onClick={onAbrir}
        >
          <span className="vsierra-puerta__marca" aria-hidden="true">+</span>
        </button>
      )}
      {abierta && (
        <div className="vsierra-caja" role="dialog" aria-modal="true" aria-labelledby="titulo-caja-herramientas" data-testid="caja-herramientas">
          <div className="vsierra-caja__velo" onClick={onCerrar} aria-hidden="true" />
          <div className="vsierra-caja__contenido">
            <button type="button" className="vsierra-caja__cerrar" aria-label="Cerrar herramientas" onClick={onCerrar}>×</button>
            <div className="vsierra-caja__encabezado">
              <span>Piso {pisoNombre}</span>
              <strong>{cota}</strong>
              <em>Alerta del día: {alerta}</em>
            </div>
            <p className="vsierra-caja__eyebrow">Caja de herramientas</p>
            <h3 id="titulo-caja-herramientas">Las {mundos.length} herramientas de su piso {pisoNombre}</h3>
            <p className="vsierra-caja__intro">Elija una labor para entrar a su mundo.</p>
            <div className="vsierra-caja__lecturas" aria-label="Lecturas climáticas adicionales">
              <span>Ahora: {textoDato(formatoTemperatura(campoClima(clima, ['temp'])), 'sin lectura')}</span>
              <span>Máxima: {textoDato(formatoTemperatura(campoClima(clima, ['tempMax'])), 'sin lectura')}</span>
              <span>Humedad relativa: {textoDato(formatearNumero(campoClima(clima, ['humedad', 'humedadRelativa_pct']), '%'), 'sin lectura')}</span>
              <span>Punto de rocío: {textoDato(formatoTemperatura(campoClima(clima, ['puntoRocio_c', 'dewPoint'])), 'sin lectura')}</span>
              <span>Radiación: {textoDato(formatearNumero(campoClima(clima, ['radiacion_wm2', 'radiacion']), ' W/m²'), 'sin lectura')}</span>
              <span>Brillo solar: {textoDato(formatearNumero(campoClima(clima, ['brilloSolar_h', 'sol']), ' h'), 'sin lectura')}</span>
              <span>UV: {textoDato(formatearNumero(campoClima(clima, ['uv']), ''), 'sin lectura')}</span>
            </div>
            <ol>
              {acciones.map(([path, nombre, contextual]) => (
                <li key={path} className={contextual ? 'vsierra-caja__accion-contextual' : undefined}>
                  <button type="button" onClick={() => onNavigate?.(path)}>{nombre}<span aria-hidden="true">↗</span></button>
                </li>
              ))}
            </ol>
            {children}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Geografía del macizo: la ley de altura, la costa y las cotas viven en
      `sierra/sierraRelieve.js` (una sola montaña para la vista global, el
      descenso y la bóveda). Aquí solo los puntos de referencia de los rótulos. ── */
const CUMBRE = { x: -0.4, y: 5.0, z: 4.1 }; // Pico Cristóbal Colón, cota compartida

const PALOMINO = { x: 5.0, y: 0.2, z: -2.85 }; // desembocadura sobre el Caribe

/* Resolución del terreno por tier. Con crestas reales (paso ≈ 2,4 u y dos
   octavas más finas) y una costa con bahías de ~2 u, los 56² de antes daban
   0,39 u por segmento: las vaguadas no se resolvían. Indexada y suave: 96² son
   9,4 k vértices (los 56² de-indexados con flat shading eran 19 k). */
const SEGMENTOS_SIERRA = { alto: 144, medio: 96, bajo: 64 };
const CALIDAD_MAR = { alto: 2, medio: 1, bajo: 0 };

/* ── Banding de pisos térmicos por altitud. El bosque de niebla es la banda
      donde se enganchan las nubes.

      🔴 UNIFICADO (2026-09-02): las 7 bandas —cota, nombre y COLOR— salen
      enteras de `BANDAS_SIERRA` (`pisosTermicos.js`). La transición cromática
      continua vive en `mantoSierra.js`; las etiquetas conservan las cotas.

      🔴 EL ORDEN IMPORTA: `BANDAS_SIERRA` llega MAR→CIMA con `Infinity` de
      último, que es justo lo que el manto necesita para avanzar. ── */
/* 2026-09-04 (arte): la NIEVE ya no es color de vértice: el casquete va como capa
   con luz propia (`aNieve` + `inyectarNieve`, ver sierra/nieveSierra.js). Lo que
   queda de vértice en la banda nival es la ROCA entre parches. */
const BANDAS = BANDAS_SIERRA;
/* La línea de hielo CANÓNICA (4 800 m = tope del superpáramo): hasta aquí llegaba. */
const LINEA_HIELO = BANDAS_SIERRA.find((b) => b.id === 'superparamo')?.tope ?? 4.15;
/* La dirección del sol de la hora dorada (= la posición de la direccional principal). */
const SOL_DIR = SOL_SIERRA;
/* UNA sola instancia de cada inyector: r3f no recompila el material si la identidad no cambia. */
const inyectarNieve = crearInyectorNieve({ lineaHielo: LINEA_HIELO });



/* Lo que NO es un piso térmico y el costero pinta aparte (paleta de
   `TerrenoCostero.js`): la arena bajo el agua (más oscura que la seca: la
   lección del costero contra la «manta blanca» somera), el lecho hondo, la
   roca del promontorio y la turba del fondo de las lagunas. */
const PALETA_COSTA = {
  arenaSumergida: new THREE.Color('#9c855a'),
  lechoHondo: new THREE.Color('#5f6a58'),
  roca: new THREE.Color('#8d8578'),
  rocaOscura: new THREE.Color('#6e6858'),
  lechoLaguna: new THREE.Color('#3a3b2c'),
  morrena: new THREE.Color('#77715f'),
};

/* La clave de pisos accesible (DOM del modo con Canvas). */




/* MOTEADO del manto (2026-09-05, arte): un dosel no es un degradado liso. Una
   modulación de VALOR por vértice, determinista (el mismo `ruido` del relieve, a
   otra escala), ±10 % en los bosques, menos en los pisos abiertos, nada en la
   arena ni bajo el mar. Cero costo: se hornea en el color de vértice. */
function amplitudMoteado(y) {
  if (y < 0.12) return 0; // arena a ras del mar y fondo marino
  if (y < BANDAS[0].tope) return 0.04; // playa
  if (y < BANDAS[3].tope) return 0.1; // bosque seco · selva húmeda · bosque de niebla
  if (y < BANDAS[4].tope) return 0.07; // páramo: pajonal y frailejonal
  if (y < BANDAS[5].tope) return 0.06; // superpáramo: roca, cojines y líquenes
  return 0.05; // la roca nival entre parches
}

/* Color de un vértice: la ley de bandas más lo que el costero pinta aparte. */
function colorVertice(wx, wz, y, c) {
  if (y < 0) {
    // lecho marino: arena sumergida → más parda y verdosa al hondo
    c.copy(PALETA_COSTA.arenaSumergida).lerp(PALETA_COSTA.lechoHondo, smoothstep(0.006, 0.08, -y));
    return c;
  }
  colorManto(y, wx, wz, c);
  // roca del promontorio (Tayrona), por zona y por altura sobre la playa
  const pp = pesoPromontorio(wx);
  if (pp > 0.02) {
    const r = ruido(wx * 3.1, wz * 3.1) > 0 ? PALETA_COSTA.roca : PALETA_COSTA.rocaOscura;
    c.lerp(r, Math.min(1, pp * 1.2 * smoothstep(0.03, 0.14, y)));
  }
  // las lagunas de páramo: morrena OSCURA en el anillo (roca y turba, no pajonal
  // claro: el labio claro se leía como un ala blanca, medido al 300 %) y turba en el fondo
  for (const L of LAGUNAS_PARAMO) {
    const rl = Math.hypot(wx - L.x, wz - L.z);
    if (rl < L.radio * 1.45) {
      c.lerp(PALETA_COSTA.morrena, 0.75 * smoothstep(L.radio * 1.45, L.radio * 1.1, rl));
      if (y < L.nivel) c.lerp(PALETA_COSTA.lechoLaguna, smoothstep(0.003, 0.02, L.nivel - y));
    }
  }
  const m = 1 + amplitudMoteado(y) * ruido(wx * 2.2 + 1.3, wz * 2.2 - 0.6);
  c.multiplyScalar(m);
  return c;
}

/* Construye la malla del terreno en coordenadas de mundo (indexada, normales suaves). */
function construirTerreno(segX, segZ) {
  const nx = segX + 1, nz = segZ + 1;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  const c = new THREE.Color();
  let p = 0;
  for (let iz = 0; iz < nz; iz++) {
    const wz = -FONDO / 2 + (FONDO * iz) / segZ;
    for (let ix = 0; ix < nx; ix++) {
      const wx = -ANCHO / 2 + (ANCHO * ix) / segX;
      const y = alturaSierra(wx, wz);
      pos[p] = wx; pos[p + 1] = y; pos[p + 2] = wz;
      colorVertice(wx, wz, y, c);
      col[p] = c.r; col[p + 1] = c.g; col[p + 2] = c.b;
      p += 3;
    }
  }
  const idx = [];
  for (let iz = 0; iz < segZ; iz++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iz * nx + ix, b = a + 1, d = a + nx, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  anadirAtributoNieve(geo, alturaSierra, { lineaHielo: LINEA_HIELO, sol: SOL_DIR });   // el casquete
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/* EL FALDÓN (2026-09-05): la ley de altura es analítica y global, así que el
   macizo CONTINÚA fuera de la malla principal en una malla barata (1 u por
   segmento, solo el anillo exterior: ~2,7 k triángulos) que cae hacia el valle
   del Cesar. Antes el borde de la malla cortaba la ladera en seco contra el
   cielo (medido arriba a la izquierda). Sin nieve ni curvas: es fondo hazado. */
function construirFaldon() {
  // 0,8 u elimina los escalones largos de la silueta sin romper el presupuesto
  // bajo: 4.204 triángulos del faldón, 12.396 en total (+14,44 % vs. 10.832).
  const X1 = 22, Z1 = 20, PASO = 0.8;              // exterior: [-22,22]×[-20,20]
  const IX = ANCHO / 2, IZ = FONDO / 2;             // interior (la malla principal)
  const nx = Math.round((2 * X1) / PASO) + 1, nz = Math.round((2 * Z1) / PASO) + 1;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  const c = new THREE.Color();
  let p = 0;
  for (let iz = 0; iz < nz; iz++) {
    const wz = -Z1 + iz * PASO;
    for (let ix = 0; ix < nx; ix++) {
      const wx = -X1 + ix * PASO;
      const y = alturaFaldon(wx, wz);
      pos[p] = wx; pos[p + 1] = y; pos[p + 2] = wz;
      colorVertice(wx, wz, y, c);
      col[p] = c.r; col[p + 1] = c.g; col[p + 2] = c.b;
      p += 3;
    }
  }
  const idx = [];
  const dentro = (x, z) => x > -IX - 1e-6 && x < IX + 1e-6 && z > -IZ - 1e-6 && z < IZ + 1e-6;
  for (let iz = 0; iz < nz - 1; iz++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const x0 = -X1 + ix * PASO, z0 = -Z1 + iz * PASO;
      // una celda se omite solo si sus CUATRO esquinas caen dentro de la malla principal
      if (dentro(x0, z0) && dentro(x0 + PASO, z0) && dentro(x0, z0 + PASO) && dentro(x0 + PASO, z0 + PASO)) continue;
      const a = iz * nx + ix, b = a + 1, d = a + nx, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/* La atmósfera en radiancia lineal HDR, UNA vez: la comparten el domo y las aguas. */
let _atm = null;
const atmosfera = () => (_atm ??= atmosferaLinealSierra());

/* EL MAR CARIBE y LAS LAGUNAS DE PÁRAMO (2026-09-05, del costero): la misma
   superficie, dos perfiles. El mar en calidad por tier; las lagunas en modo
   espejo (uEscalaOla 0,07, perfil de turba, espuma casi nula), nunca por encima
   de calidad 1. `reducedMotion` congela el reloj del agua. */
/** @param {{ calidad: 0|1|2, conBruma: boolean, reducedMotion: boolean, estado: ReturnType<typeof estadoAtmosferaSierra> }} props */
function AguasSierra({ calidad, conBruma, reducedMotion, estado }) {
  const aguas = useMemo(() => {
    const atm = atmosfera();
    const bruma = conBruma ? BRUMA_SIERRA : { densidad: 0, alturaEscala: 1, color: BRUMA_SIERRA.color };
    const mar = new MarSierra({
      alturaFn: alturaSierra, fetchFn: exposicionMar,
      tam: ANCHO, nivel: 0, margen: 20, seg: 48, escala: 10, calidad,
      zAguaFuera: COSTA_Z - 0.4,    // fuera del mapa el Caribe sigue al E y al O; al sur, tierra
      escalaRizo: 1.5, chispa: 0, grano: 0.12,  // el chispeo de textura se apaga (celosía al 300 %); grano procedural
      suavizarN: 0.55, cabrillas: 0.08, trenesFragment: 2, // de avión: dos trenes largos = líneas de mar de fondo; borregos del alisio
      escalaRompe: 0.12,            // la ola rompe a 1,3× su altura de fondo REAL: la ventana no se exagera ×10
      rugDistancia: 0.00012,        // el brillo del sol no se ensancha hasta blanquear el mar (costero: 0.0004)
      resCampo: calidad >= 2 ? 512 : 256,
      perfil: PERFIL_PLAYA,
      // más cuerpo de agua en lo somero (el costero: sin esto la playa tendida
      // salía como arena blanca mojada hasta 45 m mar adentro)
      // detalle 0: a escala de avión el rizado de textura (periodo 12 px) dibujaba una
      // CELOSÍA (medido al 300 %); la normal es Gerstner suavizado + estadística GGX
      escalares: { turbiedad: 1.35, causticas: 0.5, detalle: 0 },
      atmosfera: atm, bruma, semilla: 21,
      debug: Number(new URLSearchParams(globalThis.location?.search ?? '').get('marDebug') ?? 0),   // solo el gate
    });
    const lagunas = LAGUNAS_PARAMO.map((L, i) => new MarSierra({
      // fuera de su cuenco la altura se clava en TIERRA: el campo jamás inventa agua ladera abajo
      // fuera del ESPEJO (1,02 R) la altura se clava en TIERRA: sin dique, la ladera
      // aguas abajo queda bajo el nivel y el campo inventaba una lámina ladera abajo
      alturaFn: (x, z) => (Math.hypot(x - L.x, z - L.z) > L.radio * 1.02 ? L.nivel + 0.02 : alturaSierra(x, z)),
      tam: L.radio * 3.2, nivel: L.nivel, margen: 0, seg: 16, escala: 10,
      centro: { x: L.x, z: L.z }, resCampo: 128,
      profExterior: -2,          // fuera del mapa: TIERRA (recorta la lámina)
      zAguaFuera: -Infinity, escalaRizo: 1.5, chispa: 0, suavizarN: 0.7,
      escalaOla: 0.07,           // casi quieta: espejo
      calidad: /** @type {0|1|2} */ (Math.min(calidad, 1)),
      perfil: PERFIL_PARAMO,
      // espejo de páramo: sin espuma (0,14 dibujaba una «pluma» blanca, medido al 300 %)
      escalares: { rugosidad: 0.03, causticas: 0.25, turbiedad: 1.6, detalle: 0, espuma: 0.02 },
      atmosfera: atm, bruma, semilla: 22 + i,
    }));
    return { mar, lagunas };
  }, [calidad, conBruma]);
  useEffect(() => () => { aguas.mar.dispose(); aguas.lagunas.forEach((l) => l.dispose()); }, [aguas]);
  useFrame((_, dt) => {
    for (const agua of [aguas.mar, ...aguas.lagunas]) {
      const u = agua.material.uniforms;
      u.uDirSol.value.copy(estado.atm.dirSol);
      u.uColorSol.value.copy(estado.atm.colorSol);
      u.uColorCenit.value.copy(estado.atm.cenit);
      u.uColorHorizonte.value.copy(estado.atm.horizonte);
      u.uAmbiente.value.copy(estado.atm.ambiente);
      u.uBrumaD0.value = conBruma ? estado.densidad : 0;
      u.uColorBruma.value.set(estado.atm.horizonte.r, estado.atm.horizonte.g, estado.atm.horizonte.b);
    }
    if (reducedMotion) return;
    const paso = Math.min(dt, 0.05);
    aguas.mar.cada(paso);
    for (const l of aguas.lagunas) l.cada(paso);
  });
  return (
    <group name="aguas-sierra">
      <primitive object={aguas.mar.malla} />
      {aguas.lagunas.map((l, i) => <primitive key={LAGUNAS_PARAMO[i].id} object={l.malla} />)}
    </group>
  );
}

/* EL DOMO DEL CIELO (2026-09-05, del costero): esfera con el MISMO `cieloAprox`
   que refleja el mar, en radiancia lineal HDR con el ACES al final. Reproduce en
   pantalla los hex ya afinados de `luzSierra.js` (inversa numérica del ACES) y
   añade el sol donde la luz VIENE (los tres lóbulos del costero). Sigue a la
   cámara: el horizonte del domo es el horizonte de verdad. UN draw call; el
   fragmento son tres `pow`. Solo con `perfil.fog` (el tier bajo conserva el
   color plano). */
/* Tres corrientes de densidad horneada: panza, jirones y luz transmitida.
   La velocidad es composición artística, no una lectura del viento local. */
function NubesSierra({ tier, reducedMotion, fase = 'neutral', humedad = null, conBruma, estado }) {
  const grupo = useRef(null);
  const anchoViewport = useThree((state) => state.size.width);
  const nubes = useMemo(() => componerNubesSierra({
    tier, fase, humedad, cantidad: estado.coberturaNubes,
  }), [tier, fase, humedad, estado.coberturaNubes]);
  /* En portrait la interfaz reserva la franja alta para el rótulo de la cumbre
     y la franja media para el panel de clima. Las nubes siguen cruzando el
     cielo, pero bajan a una banda limpia del horizonte. La geometría no cambia
     en escritorio: allí el encuadre amplio permite conservar las cotas
     orográficas originales. */
  const nubesDeEncuadre = useMemo(() => {
    if (anchoViewport > 600) return nubes;
    return nubes.map((nube) => ({
      ...nube,
      y: Math.max(-0.55, nube.y - 3.95),
      z: nube.z + 1.05,
      ancho: nube.ancho * 0.88,
    }));
  }, [anchoViewport, nubes]);
  const capas = useMemo(() => [0, 1, 2].map((capa) => {
    const textura = texturaRioNube(77 + capa);
    const material = materialRioNube(textura);
    material.uniforms.velocidad.value = estado.movimientoNubes * (0.18 + capa * 0.095);
    return { textura, material, geo: geometriaRioNubes(nubesDeEncuadre.filter((_, i) => i % 3 === capa)) };
  }), [nubesDeEncuadre, estado.movimientoNubes]);
  useEffect(() => () => capas.forEach(({ geo, material, textura }) => {
    geo.dispose(); material.dispose(); textura.dispose();
  }), [capas]);
  useFrame((_, dt) => {
    if (!grupo.current) return;
    for (const mesh of grupo.current.children) {
      const u = mesh.material.uniforms;
      if (!reducedMotion && estado.movimientoNubes > 0) u.tiempo.value += Math.min(dt, 0.1);
      u.sol.value.copy(estado.atm.dirSol);
      u.dia.value = estado.dia;
      u.densidad.value = conBruma ? estado.densidad : 0;
      u.bruma.value.copy(estado.atm.horizonte);
    }
  });
  return (
    <group ref={grupo} name="nubes-sierra">
      {capas.map(({ geo, material }, i) => (
        <mesh key={i} geometry={geo} material={material} frustumCulled={false} />
      ))}
    </group>
  );
}

/* Etiqueta sobria de un lugar, con LEADER LINE: el grupo se ancla en el punto
   geográfico (cima, desembocadura) y una línea fina sube hasta el rótulo. El
   `alto` se ESCALONA entre rótulos vecinos para que nunca colisionen en
   pantalla (Cristóbal Colón arriba, Simmonds a media asta, Palomino a
   ras de costa), sin importar el barrido de la órbita. */
function Rotulo({ pos, texto, sub, distancia = 12, alto = 0.6, clase = '' }) {
  return (
    <group position={pos}>
      {/* punto de anclaje sobre el lugar */}
      <mesh position={[0, 0.04, 0]}>
        <sphereGeometry args={[0.055, 10, 8]} />
        <meshBasicMaterial color="#fff3cf" depthWrite={false} />
      </mesh>
      {/* la línea guía hasta el rótulo */}
      <mesh position={[0, alto / 2, 0]}>
        <cylinderGeometry args={[0.014, 0.014, alto, 6]} />
        <meshBasicMaterial color="#5a4326" transparent opacity={0.65} depthWrite={false} />
      </mesh>
      <Html center position={[0, alto + 0.12, 0]} distanceFactor={distancia} zIndexRange={[100, 90]} style={{ pointerEvents: 'none' }}>
        <div className={`vsierra-rotulo ${clase}`} aria-hidden="true">
          <span className="vsierra-rotulo__txt">
            {texto}
            {sub ? <em className="vsierra-rotulo__sub">{sub}</em> : null}
          </span>
        </div>
      </Html>
    </group>
  );
}

/* La lectura primaria vive en el lugar al que se refiere. El detalle completo
   sigue siendo HTML accesible dentro de cada rótulo, incluido el umbral y la
   procedencia, para que mover la información al relieve no la vuelva opaca. */
function DecisionesSobreMacizo({ clima, pisoId, msnm = null }) {
  const piso = PISOS_TERMICOS_SIERRA.find((banda) => banda.piso === pisoId || banda.id === pisoId)
    || PISOS_TERMICOS_SIERRA.find((banda) => banda.piso === 'frio');
  const pisoFinca = typeof msnm === 'number' && Number.isFinite(msnm) ? pisoPorAltitud(msnm) : null;
  const pisoEvaluado = pisoFinca?.id ?? piso.piso;
  const minima = primerDato(
    campoClima(clima, ['minimaNocturna_c', 'tempMin']),
    valorClima(clima?.datos?.minimaMadrugada),
  );
  const helada = campoClima(clima, ['heladaRiesgo']);
  const lluvia = primerDato(
    campoClima(clima, ['lluviaCantidad_mm']),
    valorClima(clima?.datos?.lluviaHoyMm),
  );
  const humedad = campoClima(clima, ['humedadRelativa_pct', 'humedad']);
  const humedadSueloCapas = campoClima(clima, ['humedadSueloCapas']);
  const eto = campoClima(clima, ['eto_mm']);
  const racha = campoClima(clima, ['vientoRacha_kmh', 'viento']);
  const direccion = campoClima(clima, ['vientoDireccion']);
  const vientoHorario = campoClima(clima, ['vientoHorario']);
  const umbral = FORECAST_THRESHOLDS.HELADA_MIN_C[pisoEvaluado]
    ?? FORECAST_THRESHOLDS.HELADA_MIN_C.default;
  const decisionHelada = interpretarHelada(minima, pisoEvaluado, helada);
  const cultivos = parseCultivos(getProfile()?.cultivos_actuales).cultivos.map((c) => c.key);
  const decisionHumedad = { titulo: tituloSanitarioDeCultivos(clima?.sanitario, cultivos), detalle: 'Riesgo del pronóstico diario compartido con El tiempo. Revise el lote; no es un diagnóstico.' };
  const decisionViento = interpretarViento(vientoHorario);
  const razonHelada = razonMinimaHelada(minima, pisoEvaluado, helada)
    .replace(`${minima} °C`, formatoTemperatura(minima))
    .replace(`umbral ${umbral} °C`, `umbral ${formatoTemperatura(umbral)}`);
  const razonAgua = Number.isFinite(lluvia) && Number.isFinite(eto)
    ? `${formatoLluvia(lluvia)} lluvia ${lluvia > eto ? '>' : '≤'} ${formatearNumero(eto, ' mm')} ETo.`
    : 'Falta lluvia o ETo para comparar.';
  const razonHumedad = Number.isFinite(humedad)
    ? `Humedad actual: ${humedad} %. El riesgo evalúa varios días.`
    : 'Falta humedad relativa para evaluar.';
  const razonViento = decisionViento.titulo === 'No se puede evaluar el horario'
    ? 'Falta una serie horaria válida.'
    : decisionViento.titulo === 'Hoy no quedan horas aplicables por viento'
      ? 'No queda franja con viento y racha menores de 15 km/h, sin lluvia.'
      : 'Solo aplica con viento y racha menores de 15 km/h, sin lluvia.';
  const contextoSanitario = { cultivos, piso: pisoEvaluado };
  const datos = [
    {
      id: 'minima', clase: 'vsierra-dato-mundo--frio', pos: posicionSierra(-1.85, alturaSierra(-1.85, -0.85) + 0.8, -0.85),
      etiqueta: 'Helada', momento: 'Esta noche', valor: decisionHelada.titulo, razon: razonHelada,
      numero: textoDato(formatoTemperatura(minima), 'No disponible'),
      detalle: decisionHelada.detalle, nombres: ['minimaNocturna_c', 'tempMin'], lectura: minima, titulo: decisionHelada.titulo,
      disponible: Number.isFinite(minima) && decisionHelada.titulo !== 'Mínima de la próxima noche: no disponible',
    },
    {
      id: 'suelo', clase: 'vsierra-dato-mundo--agua', pos: posicionSierra(2.25, alturaSierra(2.25, 1.1) + 0.42, 1.1),
      etiqueta: 'Agua', momento: 'Hoy', valor: Number.isFinite(lluvia) && Number.isFinite(eto)
        ? lluvia > eto ? 'Balance con excedente' : 'Sin excedente de referencia' : 'Balance sin calificar',
      razon: razonAgua, numero: `${textoDato(formatoLluvia(lluvia), 'Lluvia no disponible')} · ${textoDato(formatearNumero(eto, ' mm ETo'), 'ETo no disponible')}`,
      detalle: 'Si lluvia < ETo, revise la reserva de agua.', capas: humedadSueloCapas, lluvia, eto,
      titulo: Number.isFinite(lluvia) && Number.isFinite(eto) && lluvia > eto ? 'Balance con excedente' : 'Sin excedente de referencia',
      nombres: ['lluviaCantidad_mm', 'lluviaMm'],
      disponible: Number.isFinite(lluvia) && Number.isFinite(eto),
    },
    {
      id: 'humedad', clase: 'vsierra-dato-mundo--humedad', pos: posicionSierra(0.85, alturaSierra(0.85, -1.35) + 0.9, -1.35),
      etiqueta: 'Enfermedades', momento: 'Pronóstico', valor: decisionHumedad.titulo, razon: razonHumedad,
      numero: textoDato(formatearNumero(humedad, '%'), 'No disponible'), detalle: decisionHumedad.detalle,
      nombres: ['sanitario'], lectura: humedad, titulo: decisionHumedad.titulo,
      accion: accionSanitariaDeCultivos(clima?.sanitario, contextoSanitario),
      disponible: Boolean(clima?.sanitario?.peor),
    },
    {
      id: 'viento', clase: 'vsierra-dato-mundo--viento', pos: posicionSierra(-2.35, alturaSierra(-2.35, 1.8) + 0.62, 1.8),
      etiqueta: 'Trabajo con viento', momento: 'Hoy', valor: decisionViento.titulo, razon: razonViento,
      numero: `Racha máxima: ${textoDato(formatearNumero(racha, ' km/h'), 'No disponible')}`,
      detalle: decisionViento.detalle, direccion, nombres: [], titulo: decisionViento.titulo,
      disponible: Number.isFinite(racha),
    },
  ];
  datos.forEach((dato) => {
    dato.estadoConocimiento = estadoConocimiento(clima, dato.nombres, dato.disponible);
    dato.fechaEmision = fechaEmision(clima, dato.nombres);
  });
  return datos.map((dato) => (
    <group key={dato.id} position={dato.pos}>
      <mesh position={[0, -0.34, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.68, 6]} />
        <meshBasicMaterial color="#f1d58a" transparent opacity={0.78} depthWrite={false} />
      </mesh>
      <Html center distanceFactor={9.5} zIndexRange={[96, 86]} calculatePosition={(grupo, camara, tamano) => posicionHtmlTarjetaSierra(grupo, camara, tamano, dato.id)} style={{ pointerEvents: 'auto' }}>
        <details className={`vsierra-dato-mundo ${dato.clase}`} data-lectura={dato.id}>
          <summary><span>{dato.etiqueta}</span><em>{dato.momento}</em><b className="vsierra-dato-mundo__certeza" data-certeza={dato.estadoConocimiento}>{dato.estadoConocimiento === 'medido' ? 'MEDIDO' : dato.estadoConocimiento === 'pronostico' ? 'PRONÓSTICO' : 'FALTA EL DATO'}</b><strong>{dato.valor}</strong><time className="vsierra-dato-mundo__emision">Emitido: {dato.fechaEmision}</time><small className="vsierra-dato-mundo__accion">{dato.accion || accionDecisionSierra(dato.id, dato)}</small></summary>
          <p className="vsierra-dato-mundo__razon" data-testid={`razon-${dato.id}`}>{dato.razon}</p>
          {dato.id === 'minima' && (clima?.helada === true || clima?.estados?.helada === true) && (
            <p className="vsierra-datos__cielo" data-testid="senal-cielo-helada">
              Cielo despejado al amanecer: el suelo pierde calor y puede formar escarcha.
            </p>
          )}
          <b>{dato.numero}</b>
          <small>{dato.detalle}</small>
          {dato.id === 'suelo' ? (
            <>
              <LecturasSueloSierra capas={dato.capas} />
              <small>La humedad del suelo es una lectura por profundidad, no una dosis de riego.</small>
            </>
          ) : null}
          {dato.id === 'viento' ? <small>Dirección: {textoDato(dato.direccion, 'no disponible')}.</small> : null}
          <ProcedenciaDecision clima={clima} nombres={dato.nombres} />
        </details>
      </Html>
    </group>
  ));
}

/* EL MAPA VERTICAL, dibujado como mapa (2026-09-04, arte): curvas de nivel finas
   sobre el relieve en los topes de cada banda, con la tinta de los rótulos, y la
   LÍNEA ÁMBAR de la cota canónica del hielo (4 800 m) con su rótulo — «hasta aquí
   llegaba». Las cintas se apoyan en las FACETAS del terreno tal como se dibujan
   (muestreadorFacetas), no en la función suave: no se hunden.

   P1 de DIRECCION-NUMEROS-VIVOS (2026-09-05): con `msnm` CONFIRMADO se dibuja la
   curva EXACTA de la cota de la finca (`yDeMsnm(msnm)`, no una representativa de
   banda) en el color del piso donde vive, con su rótulo «a la altura de su
   finca» colgado del punto más oriental. Sin altitud confirmada NO se dibuja
   nada de la finca (el hueco es honesto): las bandas siguen igual. */

/* Contexto mínimo de la vista: ubicación y piso. El catálogo vive en su propia
   pantalla, no compite con la atmósfera de esta portada climática. */
function valorClima(campo) {
  return campo && typeof campo === 'object' ? campo.valor : null;
}

function contratoClimaVivo(clima, climaPiso) {
  if (!clima?.tieneOpenMeteo) return { ...(climaPiso || {}), ...(clima || {}) };
  const tieneDato = [clima.temp, clima.tempMin, clima.lluviaMm]
    .some((valor) => typeof valor === 'number' && Number.isFinite(valor));
  if (!tieneDato) return { ...(climaPiso || {}), ...(clima || {}) };
  const campoVivo = (valor) => ({ valor: typeof valor === 'number' && Number.isFinite(valor) ? valor : null });
  return {
    ...climaPiso,
    ...clima,
    estado: clima.vigenciaAgro?.estado === 'fresco' ? 'fresco' : 'viejo',
    datos: {
      ...(climaPiso?.datos || {}),
      actual: { ...(climaPiso?.datos?.actual || {}), temperatura: campoVivo(clima.temp) },
      minimaMadrugada: campoVivo(clima.tempMin),
      lluviaHoyMm: campoVivo(clima.lluviaMm),
    },
  };
}

function formatoTemperatura(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) ? `${Math.round(valor * 10) / 10} °C` : null;
}

function formatoLluvia(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) ? `${Math.round(valor * 10) / 10} mm` : null;
}

function primerDato(...valores) {
  return valores.find((valor) => {
    if (typeof valor === 'number') return Number.isFinite(valor);
    return typeof valor === 'string' && valor.trim().length > 0;
  }) ?? null;
}

function textoDato(valor, ausencia) {
  return valor == null ? ausencia : String(valor);
}

function riesgoCapitalizado(valor) {
  return typeof valor === 'string' ? `${valor.charAt(0).toUpperCase()}${valor.slice(1)}` : valor;
}

function claseDatoAusente(valor) {
  return valor == null ? 'vsierra-datos__ausencia' : undefined;
}

function procedenciaCampo(clima, nombres = []) {
  const texto = nombres.join(',');
  const envueltos = texto.includes('sanitario') ? [clima?.sanitarioProcedencia]
    : texto.includes('minima') || texto.includes('tempMin')
    ? [clima?.datos?.minimaMadrugada, clima?.datos?.manana?.temperaturaMinimaMadrugada]
    : texto.includes('lluvia')
      ? [clima?.datos?.lluviaHoyMm, clima?.datos?.manana?.lluviaTotalMm]
      : texto.includes('viento')
        ? [clima?.datos?.actual?.viento]
        : [];
  const envoltura = envueltos.find((dato) => dato && typeof dato === 'object' && ('fuente' in dato || 'emitidoEn' in dato));
  const emitidoEn = envoltura?.emitidoEn || campoClima(clima, ['frescura_iso', 'actualizado', 'emitidoEn']);
  const fuente = envoltura?.fuente || campoClima(clima, ['fuente']) || 'Fuente no disponible';
  const validoHasta = envoltura?.validoHasta || null;
  const vencidoPorFecha = validoHasta && Number.isFinite(Date.parse(validoHasta)) && Date.parse(validoHasta) < Date.now();
  return {
    fuente,
    emitidoEn,
    vencido: clima?.estado === 'viejo' || clima?.stale === true || vencidoPorFecha,
  };
}

function estadoConocimiento(clima, nombres, disponible) {
  if (!disponible) return 'faltante';
  if (nombres.includes('sanitario')) return 'pronostico';
  const procedencia = procedenciaCampo(clima, nombres);
  const fuente = `${procedencia.fuente} ${JSON.stringify(clima?.observacion ?? clima?.observaciones ?? '')}`;
  return /observaci[oó]n|medici[oó]n|sensor|estaci[oó]n local/i.test(fuente) ? 'medido' : 'pronostico';
}

function fechaEmision(clima, nombres) {
  const dato = procedenciaCampo(clima, nombres);
  return dato.emitidoEn && Number.isFinite(Date.parse(dato.emitidoEn))
    ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(dato.emitidoEn))
    : 'hora no disponible';
}

function ProcedenciaDecision({ clima, nombres }) {
  const dato = procedenciaCampo(clima, nombres);
  const fecha = fechaEmision(clima, nombres);
  return <small className="vsierra-datos__procedencia" data-testid="procedencia-decision">Fuente y hora: {dato.fuente} · {fecha}{dato.vencido ? ' · dato vencido' : ''}</small>;
}

function campoClima(clima, nombres) {
  const fuentes = [clima, clima?.clima, clima?.datos, clima?.datos?.actual, clima?.clima?.actual];
  for (const fuente of fuentes) {
    for (const nombre of nombres) {
      const valor = fuente?.[nombre];
      const limpio = valor && typeof valor === 'object' && 'valor' in valor ? valor.valor : valor;
      if (limpio !== null && limpio !== undefined && limpio !== '') return limpio;
    }
  }
  return null;
}

function formatearNumero(valor, unidad = '') {
  return typeof valor === 'number' && Number.isFinite(valor)
    ? `${Math.round(valor * 10) / 10}${unidad}`
    : null;
}

const CAPAS_SUELO_SIERRA = [
  ['0–1 cm', '0_1cm'],
  ['1–3 cm', '1_3cm'],
  ['3–9 cm', '3_9cm'],
];

function LecturasSueloSierra({ capas }) {
  const unidad = capas?.unidad || '% vol.';
  const tieneDato = CAPAS_SUELO_SIERRA.some(([, clave]) => Number.isFinite(capas?.[clave]));

  return (
    <div className="vsierra-suelo-capas" data-testid="humedad-suelo-capas">
      <span className="vsierra-suelo-capas__titulo">Humedad del suelo, vigente</span>
      <div className="vsierra-suelo-capas__lista">
        {CAPAS_SUELO_SIERRA.map(([profundidad, clave]) => {
          const valor = capas?.[clave];
          return (
            <div className="vsierra-suelo-capas__capa" key={clave} data-testid={`humedad-suelo-${clave}`}>
              <span>{profundidad}</span>
              <strong>{Number.isFinite(valor) ? `${valor} ${unidad}` : 'sin dato'}</strong>
            </div>
          );
        })}
      </div>
      {!tieneDato && <small className="vsierra-suelo-capas__vacio">Las tres capas están sin dato.</small>}
      <small>Lectura volumétrica por profundidad. No es un promedio.</small>
    </div>
  );
}

function SeccionDatosPiso({ id, titulo, abierta, onAbrir, children }) {
  const handleToggle = (event) => {
    if (event.currentTarget.open) onAbrir(id);
  };

  return (
    <details
      className={`vsierra-datos__seccion vsierra-datos__seccion--${id}`}
      open={abierta}
      onToggle={handleToggle}
      data-testid={`seccion-${id}`}
    >
      <summary>{titulo}</summary>
      <div className="vsierra-datos__seccion-contenido">{children}</div>
    </details>
  );
}

function PanelDatosPiso({ pisoId, msnm = null, clima = null, climaPiso: _climaPiso = null, avisoAltitud: _avisoAltitud = null }) {
  const [seccionAbierta, setSeccionAbierta] = useState('decisiones');
  const abrirSeccion = useCallback((seccion) => {
    setSeccionAbierta(seccion);
  }, []);
  const piso = PISOS_TERMICOS_SIERRA.find((banda) => banda.piso === pisoId || banda.id === pisoId);
  if (!piso) return null;

  const pisoFinca = typeof msnm === 'number' && Number.isFinite(msnm)
    ? pisoPorAltitud(msnm)
    : null;
  const cotaFinca = pisoFinca
    ? `${Math.round(msnm).toLocaleString('es-CO')} m · piso ${pisoFinca.nombre.toLowerCase()}`
    : null;
  const minima = primerDato(
    campoClima(clima, ['minimaNocturna_c', 'tempMin']),
    valorClima(clima?.datos?.minimaMadrugada),
  );
  const helada = campoClima(clima, ['heladaRiesgo']);
  const lluviaProb = campoClima(clima, ['lluviaProb_pct']);
  const lluviaCantidad = primerDato(
    campoClima(clima, ['lluviaCantidad_mm']),
    valorClima(clima?.datos?.lluviaHoyMm),
  );
  const ahora = campoClima(clima, ['temp']);
  const maxima = campoClima(clima, ['tempMax']);
  const humedadRelativa = campoClima(clima, ['humedadRelativa_pct', 'humedad']);
  const vientoHorario = campoClima(clima, ['vientoHorario']);
  const puntoRocio = campoClima(clima, ['puntoRocio_c', 'dewPoint']);
  const radiacion = campoClima(clima, ['radiacion_wm2', 'radiacion']);
  const brilloSolar = campoClima(clima, ['brilloSolar_h', 'sol']);
  const uv = campoClima(clima, ['uv', 'indiceUv']);
  const racha = campoClima(clima, ['vientoRacha_kmh', 'viento']);
  const humedadSueloCapas = campoClima(clima, ['humedadSueloCapas']);
  const eto = campoClima(clima, ['eto_mm']);
  const granizo = campoClima(clima, ['granizoRiesgo', 'granizo']);
  const diasSecos = campoClima(clima, ['rachaDiasSecos', 'diasSecos', 'racha_seca_dias']);
  const enso = campoClima(clima, ['enso']) || {};
  const ensoFase = enso?.fase || campoClima(clima, ['ensoPhase', 'ensoFamily']);
  const frescura = campoClima(clima, ['frescura_iso', 'actualizado', 'emitidoEn']);
  const fechaDato = campoClima(clima, ['fechaDato']) || frescura;
  const fechaConsulta = campoClima(clima, ['fechaConsulta']) || clima?.adquisicion?.consultado_at;
  const fuente = campoClima(clima, ['fuente']);
  const adquisicion = clima?.adquisicion || { estado: 'error', error: 'No hay estado de adquisición.' };
  const frescuraConfirmada = clima?.estado === 'fresco' && clima?.stale !== true;
  const confianzaTexto = adquisicion.estado === 'consultando'
    ? 'Consultando el clima. La decisión de hoy espera la respuesta.'
    : adquisicion.estado === 'error'
      ? `No hay consulta completa. ${adquisicion.error || 'La decisión de hoy no tiene datos de red.'}`
      : frescuraConfirmada
        ? 'Consulta completa y frescura confirmada. Este pronóstico sirve para decidir hoy, junto con la revisión del suelo.'
        : 'Consulta completa, pero la frescura no está confirmada. Úselo como referencia y revise el suelo antes de decidir hoy.';
  const ensoTexto = ensoFase === 'nino'
    ? 'El Niño: vigile noches despejadas y helada en piso frío.'
    : ensoFase === 'nina'
      ? 'La Niña está señalada. Revise lluvia y drenaje en este piso.'
      : ensoFase === 'neutral'
        ? 'Neutral: sin señal regional disponible.'
        : 'Sin señal regional disponible.';

  const formatoFecha = (valor) => valor && Number.isFinite(Date.parse(valor))
    ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(valor))
    : valor;
  const fechaDatoVisible = formatoFecha(fechaDato);
  const fechaConsultaVisible = formatoFecha(fechaConsulta);
  const ordenBase = ordenarDecisionesSierra({ minima, helada,
    lluvia: lluviaCantidad, eto, humedad: humedadRelativa, viento: racha, estado: clima?.estado });
  const pisoEvaluado = (typeof msnm === 'number' && Number.isFinite(msnm) ? pisoPorAltitud(msnm)?.id : null) ?? piso.piso;
  const contextoSanitarioHoy = {
    cultivos: parseCultivos(getProfile()?.cultivos_actuales).cultivos.map((c) => c.key), piso: pisoEvaluado,
  };
  const accionesHoy = {
    minima: { lectura: minima, titulo: interpretarHelada(minima, pisoEvaluado, helada).titulo },
    suelo: { lluvia: lluviaCantidad, eto, titulo: Number.isFinite(lluviaCantidad) && Number.isFinite(eto) && lluviaCantidad > eto ? 'Balance con excedente' : 'Sin excedente de referencia' },
    humedad: { accion: accionSanitariaDeCultivos(clima?.sanitario, contextoSanitarioHoy) },
    viento: { titulo: interpretarViento(vientoHorario).titulo },
  };
  const primeroHoy = accionesHoy[ordenBase[0]].accion || accionDecisionSierra(ordenBase[0], accionesHoy[ordenBase[0]]);
  return (
    <aside className="vsierra-datos" data-testid="panel-datos-piso" aria-label="Lecturas del piso y de su finca" tabIndex={0} aria-live="polite">
      <SeccionDatosPiso id="decisiones" titulo="Qué revisar hoy" abierta={seccionAbierta === 'decisiones'} onAbrir={abrirSeccion}>
        <div className="vsierra-datos__clima" aria-label="Clima del piso">
          <section className="vsierra-datos__prioridad vsierra-datos__prioridad--principal" data-prioridad={ordenBase[0]}>
            <p className="vsierra-datos__manda">Primero hoy</p>
            <p className="vsierra-datos__anclado" data-testid="primero-hoy-texto">{primeroHoy}</p>
          </section>
          <AvisoSanitarioPiso riesgo={clima?.sanitario} piso={pisoEvaluado} daily={undefined} hoy={undefined} cultivos={parseCultivos(getProfile()?.cultivos_actuales).cultivos.map((c) => c.key)} />
          <details className="vsierra-datos__apoyos" open><summary>10 lecturas de apoyo <small>Pronóstico, no medición en finca</small></summary>
        <div className="vsierra-datos__clima vsierra-datos__clima--apoyos">
        <div className="vsierra-datos__insumo" data-lectura="lluvia"><span>Lluvia <em>Hoy</em></span><strong>{textoDato(formatearNumero(lluviaProb, '% prob.'), 'Probabilidad no disponible')}</strong><small>{textoDato(formatoLluvia(lluviaCantidad), 'Cantidad no disponible')}</small></div>
        <div className="vsierra-datos__insumo" data-lectura="suelo-apoyo"><span>Humedad del suelo <em>0–9 cm</em></span><strong>{textoDato(formatearNumero(humedadSueloCapas?.['0_1cm'], '% vol.'), 'No disponible')}</strong><small>Lectura de la capa superficial.</small></div>
        <div className="vsierra-datos__insumo" data-lectura="ahora"><span>Temperatura <em>Ahora</em></span><strong>{textoDato(formatoTemperatura(ahora), 'No disponible')}</strong></div>
        <div className="vsierra-datos__insumo" data-lectura="maxima"><span>Máxima <em>Hoy</em></span><strong>{textoDato(formatoTemperatura(maxima), 'No disponible')}</strong></div>
        <details className="vsierra-datos__apoyos-resto"><summary>6 lecturas adicionales</summary>
        <div className="vsierra-datos__clima">
        <div className="vsierra-datos__insumo" data-lectura="granizo"><span>Granizo <em>Hoy</em></span><strong className={claseDatoAusente(granizo)}>{textoDato(riesgoCapitalizado(granizo), 'No disponible')}</strong><small>{granizo ? `Riesgo ${riesgoCapitalizado(granizo)}` : 'Riesgo no disponible'}</small></div>
        <div className="vsierra-datos__insumo" data-lectura="dias"><span>Días secos <em>Hasta hoy, según serie diaria</em></span><strong>{textoDato(formatearNumero(diasSecos, ' días'), 'No disponible')}</strong><small>{diasSecos ? `Riesgo ${diasSecos > 7 ? 'alto' : diasSecos > 3 ? 'medio' : 'bajo'}` : diasSecos === 0 ? 'Sin racha seca' : 'Historial insuficiente para determinar la racha'}</small></div>
        <div className="vsierra-datos__insumo" data-lectura="rocio"><span>Punto de rocío <em>Ahora</em></span><strong>{textoDato(formatoTemperatura(puntoRocio), 'No disponible')}</strong><svg viewBox="0 0 48 28" aria-hidden="true"><path d="M5 23Q12 6 34 13Q28 28 5 23ZM5 23L30 15M29 13Q22 10 29 3Q36 10 29 13Z" /></svg></div>
        <div className="vsierra-datos__insumo" data-lectura="radiacion"><span>Radiación <em>Ahora</em></span><strong>{textoDato(formatearNumero(radiacion, ' W/m²'), 'No disponible')}</strong><svg viewBox="0 0 48 28" aria-hidden="true">{radiacion === 0 ? <path d="M24 3A10 10 0 1 0 34 20A12 12 0 0 1 24 3ZM38 4V10M35 7H41" /> : <><circle cx="11" cy="9" r="4"/><path d="M11 1V3M3 9H5M17 9H19M6 3L7 4M15 14L17 16M22 24L30 10L36 24ZM30 24H46"/></>}</svg><small>{radiacion === 0 ? 'Sin radiación solar. Compatible con noche.' : 'Sol recibido y sombra.'}</small></div>
        <div className="vsierra-datos__insumo" data-lectura="uv"><span>UV <em>Índice previsto</em></span><strong>{textoDato(formatearNumero(uv), 'No disponible')}</strong><small>{uv === 0 ? 'Sin UV indicado; de noche puede ser cero.' : 'Exposición solar. Período no especificado por la fuente.'}</small></div>
        <div className="vsierra-datos__insumo" data-lectura="sol"><span>Brillo solar <em>Hoy</em></span><strong>{textoDato(formatearNumero(brilloSolar, ' h'), 'No disponible')}</strong><small>Horas de sol del día.</small></div>
        </div></details>
        </div></details>
        </div>
      </SeccionDatosPiso>
      <SeccionDatosPiso id="procedencia" titulo="Procedencia" abierta={seccionAbierta === 'procedencia'} onAbrir={abrirSeccion}>
        <div className={`vsierra-datos__adquisicion vsierra-datos__adquisicion--${adquisicion.estado}`} data-testid="estado-adquisicion" role="status" aria-live="polite">
          <strong data-testid="confianza-clima">{confianzaTexto}</strong>
          {adquisicion.estado === 'error' && typeof clima?.reintentar === 'function' && (
            <button type="button" onClick={clima.reintentar}>Reintentar consulta</button>
          )}
        </div>
        <p className="vsierra-datos__fecha">
          {fechaDatoVisible ? `Hora del dato: ${fechaDatoVisible} (Colombia)` : 'Hora del dato no disponible'}<br />
          {fechaConsultaVisible ? `Hora de consulta: ${fechaConsultaVisible} (Colombia)` : 'Hora de consulta no disponible'}<br />
          {fuente || 'Open-Meteo'} · Pronóstico
        </p>
        <p className="vsierra-datos__enso"><strong>ENSO</strong> {ensoTexto}</p>
        <p className="vsierra-datos__fuente">
          Cota confirmada: {cotaFinca || 'no disponible'}. {cotaFinca ? `Piso aplicado: ${piso.nombre}.` : ''}
          {frescura ? ` Dato: ${frescura}.` : ' Frescura: sin lectura.'}
          {fuente ? ` Fuente: ${fuente}.` : ''} Pronóstico Open-Meteo, no estación en finca.
        </p>
        {clima?.estado !== 'fresco' && clima?.estado !== 'sin_finca' && <p className="vsierra-datos__nota">Sin datos recientes para este piso.</p>}
      </SeccionDatosPiso>
    </aside>
  );
}

function LlegadaSierra({ visible, relieveListo, completa }) {
  if (!visible) return null;
  const estado = completa
    ? 'La lectura ya está aquí'
    : relieveListo
      ? 'La Sierra ya está aquí'
      : 'La Sierra está llegando';
  return (
    <div className="vsierra-llegada" role="status" aria-live="polite" data-testid="llegada-sierra">
      <div className="vsierra-llegada__marca" aria-hidden="true"><span /></div>
      <div>
        <p className="vsierra-llegada__eyebrow">Sierra, datos en territorio</p>
        <strong>{estado}</strong>
        <p className="vsierra-llegada__detalle">
          {completa
            ? 'El macizo y sus lecturas ya se pueden recorrer.'
            : relieveListo
              ? 'El macizo está listo. Sus lecturas terminan de llegar.'
              : 'Del Caribe a la nieve, el territorio va tomando forma.'}
        </p>
      </div>
    </div>
  );
}

/**
 * SierraDiorama — el grupo r3f puro de la Sierra, para COMPONER dentro de un
 * `<Canvas>` propio (otra escena, un mockup, un preview). Trae el terreno, las
 * aguas, las nubes, el sol, los rótulos y —por defecto— sus luces, su aire y su
 * crédito; el que compone puede apagarlos por props si ya los aporta.
 *
 * @param {object} props
 * @param {'alto'|'medio'|'bajo'} [props.tier='alto']  presupuesto de render.
 * @param {boolean} [props.reducedMotion=false]  congela aguas/nubes.
 * @param {string}  [props.pisoUsuario]  'calido'|'templado'|'frio'|'paramo'|'superparamo'|'nival'.
 * @param {number|null} [props.msnm]  altitud CONFIRMADA de la finca en metros:
 *        dibuja la curva exacta P1 «a la altura de su finca». Sin ella no se
 *        dibuja nada de la finca (guard anti-fabricación).
 * @param {boolean} [props.luces=true]  monta las luces de la hora dorada.
 * @param {boolean} [props.atmosfera=true]  fondo + domo + bruma por altura.
 * @param {import('react').ReactNode} [props.rotuloFinca=null] false si el host ya presenta el rótulo fuera del terreno.
 * @param {(piso:object)=>void} [props.onSeleccionPiso]  avisa al host al llegar a un piso.
 * @param {string|null} [props.pisoActivo=null]  piso resaltado desde el host.
 * @param {{ senal?: boolean, nubosidad?: number, condicion?: string, lluvia?: boolean, niebla?: boolean, helada?: boolean, lluviaMm?: number, luz?: string, ensoFamily?: string, humedad?: number }|null} [props.clima=null]  señales visuales ya disponibles.
 */
export function SierraDiorama({
  tier = 'alto',
  reducedMotion: calmaSolicitada = false,
  pisoUsuario,
  msnm = null,
  luces = true,
  atmosfera: conAtmosfera = true,
  rotuloFinca = null,
  onSeleccionPiso,
  pisoActivo = null,
  clima = null,
}) {
  const reducedMotion = useCalma(calmaSolicitada);
  const { hora, preset } = useAtmosferaViva({ reducedMotion });
  const estado = useMemo(() => estadoAtmosferaSierra(clima, preset), [clima, preset]);
  const aire = useMemo(() => crearAireVivo(), []);
  const materialTerreno = useMemo(() => (shader) => {
    inyectarGranoManto(shader); inyectarNieve(shader);
    if (conAtmosfera && perfilDeTier(tier).fog) aire.inyectar(shader);
  }, [aire, conAtmosfera, tier]);
  const materialFaldon = useMemo(() => (shader) => {
    inyectarGranoManto(shader);
    if (conAtmosfera && perfilDeTier(tier).fog) aire.inyectar(shader);
  }, [aire, conAtmosfera, tier]);
  useFrame(() => aire.actualizar(estado));
  const perfil = perfilDeTier(tier);
  const segmentos = SEGMENTOS_SIERRA[tier] ?? SEGMENTOS_SIERRA.medio;
  const conBruma = conAtmosfera && perfil.fog;
  const montarSenalesClima = clima?.senal === true;
  const sombras = perfil.sombras;
  /* P1 — solo una altitud CONFIRMADA dibuja la curva de la finca. El guard se
     respeta: sin ella no se dibuja ningún marcador de finca. */
  const msnmConfirmado = altitudFincaValida(msnm);
  const geo = useMemo(() => construirTerreno(segmentos, segmentos), [segmentos]);
  useEffect(() => () => geo.dispose(), [geo]);
  const faldon = useMemo(() => construirFaldon(), []);
  useEffect(() => () => faldon.dispose(), [faldon]);

  const faseRaw = leerGateDescenso().fase ?? (clima?.ensoFamily || faseEnsoViva());
  const faseEnso = faseRaw.includes('nino') ? 'el_nino' : faseRaw.includes('nina') ? 'la_nina' : 'neutral';   // `?enso=` solo para el gate; la app lee la fase VIVA

  /* `color` se adjunta a la ESCENA: va como hijo directo (fragment), nunca envuelto
     en un <group>. La niebla de three ya no se usa: la bruma por altura va
     inyectada en cada material (terreno, nubes, mar) con el mismo color. */
  return (
    <>
      {conAtmosfera && luces && <AtmosferaViva hora={hora} tier={tier} reducedMotion={reducedMotion || estado.estadoDato === 'sin-dato'} luciernagas={false} />}
      {(conAtmosfera && perfil.fog || montarSenalesClima) && (
        <CieloVivoMacizo
          clima={clima}
          tier={tier}
          reducedMotion={reducedMotion}
          seed={20260915}
          dibujarAtmosfera={false}
        />
      )}


      <mesh geometry={geo} castShadow={sombras} receiveShadow={sombras}>
        <meshLambertMaterial vertexColors onBeforeCompile={materialTerreno} customProgramCacheKey={() => `manto-nieve-${conBruma}`} />
      </mesh>
      <mesh geometry={faldon} receiveShadow={sombras} name="faldon">
        <meshLambertMaterial vertexColors onBeforeCompile={materialFaldon} customProgramCacheKey={() => `manto-faldon-${conBruma}`} />
      </mesh>

      <AguasSierra calidad={/** @type {0|1|2} */ (CALIDAD_MAR[tier] ?? 1)} conBruma={conBruma} reducedMotion={reducedMotion} estado={estado} />
      <NubesSierra tier={tier} reducedMotion={reducedMotion} fase={faseEnso} humedad={clima?.humedad} conBruma={conBruma} estado={estado} />

      {/* Rótulos sobrios de los lugares exigidos por el encargo. Los `alto`
          escalonados (1.25 / 0.6 / 0.45) separan los rótulos verticalmente en
          pantalla — antes se encimaban ilegibles sobre las cumbres. */}
      <Rotulo pos={[CUMBRE.x, CUMBRE.y, CUMBRE.z]} clase="vsierra-cumbre" texto="Pico Cristóbal Colón" sub="5.775 m" distancia={13} alto={1.25} />
      <Rotulo pos={[PALOMINO.x, PALOMINO.y, PALOMINO.z]} clase="vsierra-costa" texto="Palomino" sub="Caribe · 0 m" distancia={11} alto={0.45} />

      <DecisionesSobreMacizo clima={clima} pisoId={pisoActivo || pisoUsuario} msnm={msnmConfirmado} />
      <ClimaParcelaSierra clima={clima} msnm={msnmConfirmado} tier={tier} reducedMotion={reducedMotion} />
      <MapaDeNivel
        segmentos={segmentos}
        soloFinca
        rotuloFinca={rotuloFinca}
        msnm={msnmConfirmado}
      />
      <PisosTermicosBandas
        aura={false}
        pisoUsuario={pisoUsuario}
        tier={tier}
        reducedMotion={reducedMotion}
        alturaCumbre={CIMA}
        radioBase={4}
        radioCumbre={0.35}
        onSeleccionPiso={onSeleccionPiso}
        pisoActivo={pisoActivo}
        mostrarEtiquetas={Boolean(pisoUsuario)}
      />
    </>
  );
}

function EncuadreSierra() {
  useFrame(({ camera, size }) => {
    const zoom = size.width < 600 ? 0.68 : 1;
    if (camera.zoom !== zoom) { camera.zoom = zoom; camera.updateProjectionMatrix(); }
  });
  return null;
}

/* Estilos de los rótulos y pie de crédito (viven aquí: son de ESTA escena). */
const CSS_SIERRA = `
.vsierra-root[data-viaje="1"] .vsierra-canvas { pointer-events:none; }
.vsierra-sindato { position:absolute; z-index:40; bottom:13vh; left:4vw; display:flex; align-items:flex-end; gap:12px; max-width:88vw; }
.vsierra-sindato__pizarra { position:relative; background:transparent; color:#f5f1e7; border:2px solid #0c110e; padding:18px; max-width:260px; font-size:14px; text-shadow:0 1px 2px #10232b,0 0 5px rgba(0,0,0,.95); }
.vsierra-sindato__pizarra button { position:absolute; right:2px; top:2px; background:transparent; color:inherit; border:0; cursor:pointer; }
.vsierra-sindato__pizarra p { margin:0 0 8px; }


.vsierra-root { position: relative; width: 100%; height: 100dvh; min-height: 320px; overflow: hidden; background: ${ATMOSFERA_SIERRA.fondo}; }
.vsierra-cielo-estado { position:absolute; inset:0; z-index:1; pointer-events:none; mix-blend-mode:color; }
.vsierra-cielo-estado--conocido-despejado { background:linear-gradient(180deg,rgba(67,143,190,.14),rgba(242,198,126,.02) 58%,transparent 78%); }
.vsierra-cielo-estado--conocido-cubierto { background:linear-gradient(180deg,rgba(35,53,62,.24),rgba(60,72,72,.12) 62%,transparent 82%); }
.vsierra-cielo-estado--sin-dato { background:linear-gradient(180deg,rgba(113,128,135,.42),rgba(139,146,140,.22) 62%,rgba(82,93,89,.12)); mix-blend-mode:normal; opacity:.8; }
.vsierra-canvas { position: absolute; inset: 0; opacity: 0; transition: opacity 0.7s ease; }
.vsierra-canvas--lista { opacity: 1; }
.vsierra-llegada { position:absolute; z-index:35; top:clamp(5rem,16vh,9rem); left:clamp(1rem,6vw,5rem); display:flex; align-items:flex-start; gap:.8rem; width:min(22rem,calc(100% - 2rem)); padding:.9rem 1rem; color:#f8f1df; border:1px solid rgba(255,236,178,.54); border-radius:1rem; background:linear-gradient(135deg,rgba(14,47,38,.88),rgba(14,35,31,.68)); box-shadow:0 18px 48px rgba(4,18,15,.24); backdrop-filter:blur(8px); pointer-events:none; animation:vsierra-llegada-entra .75s cubic-bezier(.22,1,.36,1) both; }
.vsierra-llegada__marca { display:grid; place-items:center; width:2rem; height:2rem; flex:0 0 auto; border:1px solid rgba(255,226,144,.72); border-radius:50%; }
.vsierra-llegada__marca::before,.vsierra-llegada__marca::after,.vsierra-llegada__marca span { content:''; display:block; position:absolute; width:.3rem; height:.3rem; border-radius:50%; background:#f6d783; box-shadow:0 0 12px rgba(246,215,131,.9); }
.vsierra-llegada__marca::before { transform:translate(-.52rem,-.32rem); opacity:.55; }
.vsierra-llegada__marca::after { transform:translate(.48rem,.4rem); opacity:.45; }
.vsierra-llegada__marca span { position:relative; }
.vsierra-llegada__eyebrow { margin:0 0 .16rem; color:#f1d58a; font:700 .6rem/1 system-ui,sans-serif; letter-spacing:.13em; text-transform:uppercase; }
.vsierra-llegada strong { display:block; font:700 clamp(1.15rem,3vw,1.5rem)/1.05 Georgia,serif; }
.vsierra-llegada__detalle { margin:.32rem 0 0; color:#e3ddcf; font:500 .72rem/1.35 system-ui,sans-serif; }
@keyframes vsierra-llegada-entra { from { transform:translateY(.7rem); } to { transform:none; } }
.vsierra-puerta { position:absolute; z-index:31; left:1rem; bottom:1.2rem; display:flex; align-items:center; gap:0.75rem; max-width:min(21rem,calc(100vw - 2rem)); padding:0.62rem 0.84rem 0.62rem 0.62rem; border:1px solid rgba(255,246,209,.62); border-radius:0.62rem; color:#fff8df; background:rgba(13,35,28,.3); cursor:pointer; text-align:left; box-shadow:0 4px 12px rgba(12,31,24,.22); text-shadow:0 1px 4px #10232b; backdrop-filter:blur(2px); }
.vsierra-puerta:hover,.vsierra-puerta:focus-visible { border-color:#ffe6a2; box-shadow:0 0 0 3px rgba(255,230,162,.22),0 7px 26px rgba(12,31,24,.38),0 0 32px rgba(244,208,105,.28); }
.vsierra-puerta:focus-visible,.vsierra-caja button:focus-visible { outline:3px solid #ffe39a; outline-offset:3px; }
.vsierra-puerta__marca { display:grid; place-items:center; width:2rem; height:2rem; border:1px solid rgba(255,230,162,.78); border-radius:50%; color:#ffe39a; font-size:1.2rem; flex:0 0 auto; }
.vsierra-puerta__marca { width:2.8rem; height:2.8rem; font:700 1.8rem/1 Georgia,serif; }
.vsierra-puerta > * { pointer-events:none; }
.vsierra-puerta strong,.vsierra-puerta small { display:block; }
.vsierra-puerta strong { font:700 .82rem/1.2 Georgia,serif; letter-spacing:.01em; }
.vsierra-puerta small { margin-top:.18rem; font:600 .62rem/1 system-ui,sans-serif; opacity:.78; text-transform:uppercase; letter-spacing:.08em; }
.vsierra-caja { position:absolute; inset:0; z-index:60; isolation:isolate; pointer-events:auto; overflow:hidden; overscroll-behavior:none; }
.vsierra-caja__velo { position:absolute; inset:0; z-index:0; background:rgba(8,26,22,.58); }
.vsierra-caja__contenido { position:absolute; left:1rem; bottom:1rem; z-index:1; width:min(31rem,calc(100% - 2rem)); max-width:calc(100% - 2rem); max-height:calc(100% - 2rem); min-width:0; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; padding:0 1.2rem 1.2rem; box-sizing:border-box; border:1px solid rgba(255,239,185,.78); border-radius:1.1rem; color:#fff8df; background:linear-gradient(145deg,#214d3d 0%,#163a2f 58%,#123229 100%); box-shadow:0 14px 38px rgba(5,21,17,.48),0 0 28px rgba(240,204,105,.14); text-shadow:0 1px 4px #10232b; }
.vsierra-caja__contenido::before { content:''; display:block; height:3px; margin:0 -1.2rem; background:linear-gradient(90deg,#e3b95c,#8fb88d 58%,transparent); }
.vsierra-caja__contenido > * { min-width:0; max-width:100%; }
.vsierra-caja__encabezado { position:sticky; top:0; z-index:2; display:grid; gap:.15rem; margin:0 -1.2rem .9rem; padding:.85rem 3.8rem .7rem 1.2rem; border-bottom:1px solid rgba(255,239,185,.28); background:#183f32; box-shadow:0 8px 14px rgba(10,34,26,.22); }
.vsierra-caja__encabezado span { color:#ffe39a; font:700 .62rem/1 system-ui,sans-serif; letter-spacing:.1em; text-transform:uppercase; }
.vsierra-caja__encabezado strong { color:#fffdf4; font:800 1.05rem/1.1 Georgia,serif; }
.vsierra-caja__encabezado em { color:#f1d58a; font:600 .68rem/1.25 system-ui,sans-serif; font-style:normal; }
.vsierra-caja__cerrar { position:absolute; top:.55rem; right:.65rem; width:2rem; height:2rem; border:1px solid rgba(255,239,185,.6); border-radius:50%; color:inherit; background:transparent; font-size:1.35rem; line-height:1; cursor:pointer; }
.vsierra-caja__eyebrow { margin:0 2.2rem .25rem 0; color:#ffe39a; font:700 .62rem/1 system-ui,sans-serif; letter-spacing:.12em; text-transform:uppercase; }
.vsierra-caja h3 { margin:0; max-width:25rem; overflow-wrap:anywhere; font:700 clamp(1.2rem,4vw,1.8rem)/1.05 Georgia,serif; }
.vsierra-caja__intro { margin:.45rem 0 .8rem; font:500 .76rem/1.35 system-ui,sans-serif; opacity:.84; }
.vsierra-caja__lecturas { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.22rem .7rem; margin:0 0 .9rem; padding:.65rem .7rem; border:1px solid rgba(255,239,185,.22); border-radius:.7rem; color:#e8dfcf; background:rgba(7,30,24,.28); font:500 .65rem/1.25 system-ui,sans-serif; }
.vsierra-caja ol { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.45rem .55rem; margin:0; padding:0; list-style:none; counter-reset:herramienta; }
.vsierra-caja li { counter-increment:herramienta; }
.vsierra-caja li button { width:100%; min-width:0; min-height:3rem; display:flex; align-items:center; justify-content:space-between; gap:.45rem; padding:.55rem .65rem; box-sizing:border-box; border:1px solid rgba(255,239,185,.33); border-radius:.65rem; color:inherit; background:rgba(255,248,223,.08); cursor:pointer; text-align:left; font:600 .72rem/1.15 system-ui,sans-serif; }
.vsierra-caja li button span { min-width:0; overflow-wrap:anywhere; }
.vsierra-caja li button::before { content:counter(herramienta,decimal-leading-zero); color:#ffe39a; font:700 .62rem/1 Georgia,serif; }
.vsierra-caja li button:hover { background:rgba(255,248,223,.17); border-color:rgba(255,239,185,.72); }
.vsierra-caja__accion-contextual button { border-color:rgba(241,213,138,.9); background:rgba(241,213,138,.16); color:#fff4c8; }
.vsierra-rotulo { white-space: nowrap; font: 700 1rem/1.15 system-ui, sans-serif; color: #402c16; padding: 0.18rem 0.56rem; border-radius: 999px; }
.vsierra-rotulo__txt { display: inline-flex; align-items: baseline; gap: 0.3rem; }
.vsierra-rotulo__sub { font-weight: 600; font-style: normal; opacity: 0.78; font-size: 0.9em; }
.vsierra-hielo { padding: 0.16rem 0.5rem; border-radius: 999px; color: #6a4a12; border: 1px solid rgba(224,168,74,0.9); font: 600 0.68rem/1.1 system-ui, sans-serif; white-space: nowrap; }
.vsierra-finca { padding: 0.18rem 0.6rem; border-radius: 999px; color: #3a2a18; border: 1px solid rgba(64,44,22,0.3); border-left: 4px solid var(--finca, #4f8f7d); font: 600 0.72rem/1.15 system-ui, sans-serif; white-space: nowrap; }
.vsierra-aqui { padding: 0.2rem 0.55rem; border-radius: 999px; color: #fff3d6; font: 600 0.72rem/1.1 system-ui, sans-serif; white-space: nowrap; }
.vsierra-credito { margin: 0; max-width: min(90vw, 40rem); text-align: center; font: 500 0.78rem/1.4 system-ui, sans-serif; color: #f4ecdd; }
.vsierra-credito--3d { padding: 0.4rem 0.8rem; border-radius: 0.7rem; }
.vsierra-credito--pisos { padding: .7rem 1rem; border: 1px solid rgba(255,239,185,.72); border-radius: .7rem; color: #f4ecdd; background: #0a1a15; box-shadow: 0 6px 18px rgba(3,16,13,.3); font-size: 1rem; }
.vsierra-chrome { position: absolute; inset: 0; z-index: 20; pointer-events: none; display: flex; flex-direction: column; justify-content: space-between; }
.vsierra-titulo { margin: 0; padding: 0.9rem 1rem 0; color: #f7f3e8; text-shadow: 0 1px 5px #10232b; font: 700 1.15rem/1.2 system-ui, sans-serif; letter-spacing: 0.01em; }
.vsierra-titulo small { display: block; font: 500 0.8rem/1.3 system-ui, sans-serif; opacity: 0.78; margin-top: 0.15rem; }
.vsierra-finca-overlay { grid-column:1 / -1; grid-row:2; justify-self:start; margin:0 1rem; padding:0.35rem 0.62rem; border:1px solid rgba(255,239,185,.78); border-left:4px solid #86c68f; border-radius:0.55rem; color:#fff3d6; background:rgba(20,57,45,.76); font:700 0.72rem/1.2 system-ui,sans-serif; text-shadow:0 1px 3px #10232b; pointer-events:none; }
.vsierra-clave { align-self: flex-end; margin: 0 0.8rem 0.55rem; display: flex; flex-direction: column; gap: 0.24rem; padding: 0.5rem 0.65rem; border-radius: 0.7rem; }
.vsierra-datos { align-self: flex-end; margin: 0.55rem 0.8rem 0 0; max-width: min(19rem, calc(100vw - 2rem)); padding: 0.62rem 0.78rem; border-radius: 0.7rem; font: 500 0.72rem/1.35 system-ui, sans-serif; color: #3a2a18; pointer-events: auto; }
.vsierra-datos__contexto { margin: 0; color: #fffdf4; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
.vsierra-datos__tit { margin: 0; color: #fffdf4; font-weight: 800; font-size: 0.85rem; }
.vsierra-datos__finca { display: grid; gap: 0.08rem; margin: 0.42rem 0 0.1rem; padding: 0.34rem 0.48rem; border-left: 3px solid #4f8f7d; }
.vsierra-datos__finca span { color: #52665d; font-size: 0.66rem; font-weight: 700; }
.vsierra-datos__finca strong { font-size: 0.74rem; font-weight: 600; }
.vsierra-datos__rango { margin: 0.12rem 0 0; color: #fffdf4; font-size: 0.72rem; opacity: 1; }
.vsierra-datos__adquisicion { display:grid; gap:.18rem; margin:.48rem 0 .35rem; padding:.42rem .5rem; border:1px solid rgba(255,239,185,.35); border-left:3px solid #8fb88d; border-radius:.45rem; color:#f5e8c7; background:rgba(7,30,24,.24); font-size:.66rem; }
.vsierra-datos__adquisicion--consultando { border-left-color:#f1d58a; }
.vsierra-datos__adquisicion--error { border-left-color:#e8a44c; }
.vsierra-datos__adquisicion span { color:#d8ccb9; }
.vsierra-datos__adquisicion button { justify-self:start; min-height:32px; margin-top:.12rem; padding:.3rem .52rem; border:1px solid rgba(255,239,185,.6); border-radius:.4rem; color:#fff8df; background:rgba(255,248,223,.1); cursor:pointer; font:700 .65rem/1.1 system-ui,sans-serif; }
.vsierra-datos__adquisicion button:hover,.vsierra-datos__adquisicion button:focus-visible { background:rgba(255,248,223,.2); }
.vsierra-datos__clima { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.62rem 0.7rem; margin-top: 0.7rem; }
.vsierra-datos__clima div { display: grid; gap: 0.08rem; min-width: 0; }
.vsierra-datos__nivel-2 { padding: 0.28rem 0.35rem; border-left: 2px solid rgba(255,239,185,.35); }
.vsierra-datos__nivel-2--senal { border-color: #e8a44c; background: rgba(232,164,76,.13); }
.vsierra-datos__nivel-3 { opacity: .94; }
.vsierra-datos__nivel-3--pequeno { opacity: .78; }
.vsierra-datos__clima span { color: #e8dfcf; font-size: 0.6rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; opacity: 1; }
.vsierra-datos__clima strong { color: #f5e8c7; font-size: 1rem; line-height: 1.05; font-weight: 800; }
.vsierra-datos__clima small { color: #d8ccb9; font-size: 0.62rem; line-height: 1.2; }
.vsierra-datos__enso { margin: 0.7rem 0 0; color: #e8dfcf; font-size: 0.68rem; line-height: 1.35; }
.vsierra-datos__enso strong { color: #f1d58a; letter-spacing: 0.06em; text-transform: uppercase; }
.vsierra-datos__fuente { margin: 0.55rem 0 0; color: #d8ccb9; font-size: 0.62rem; line-height: 1.35; }
.vsierra-datos__nota { margin: 0.55rem 0 0; font-size: 0.68rem; font-style: italic; opacity: 0.84; }
.vsierra-datos__num { margin: 0.18rem 0 0.1rem; }
.vsierra-datos__num strong { font-size: 1.12rem; }
.vsierra-datos__num small { display: block; opacity: 0.72; }
.vsierra-datos__formacion { margin: 0.1rem 0 0; opacity: 0.8; }
.vsierra-clave li { display: flex; align-items: center; gap: 0.42rem; list-style: none; font: 500 0.72rem/1.1 system-ui, sans-serif; color: #3a2a18; }
.vsierra-clave b { width: 12px; height: 12px; border-radius: 3px; flex: 0 0 auto; box-shadow: inset 0 0 0 1px rgba(60,42,24,0.18); }
.vsierra-clave ul { margin: 0; padding: 0; }
.vsierra-abajo { display: flex; flex-direction: column; align-items: stretch; }
.vsierra-clima-estado { width:calc(100% - 2rem); margin:0 1rem 0.5rem; box-sizing:border-box; padding:0.65rem 0.8rem; border:1px solid #b87932; border-radius:12px; color:#3c2a18; }
.vsierra-clima-estado__titulo { display:flex; align-items:center; gap:0.45rem; font:700 0.82rem/1.2 system-ui,sans-serif; }
.vsierra-clima-estado__titulo::before { content:'○'; display:inline-grid; place-items:center; width:1.1rem; height:1.1rem; border:2px solid currentColor; border-radius:50%; font-size:0.62rem; }
.vsierra-clima-estado p { margin:0.3rem 0 0; font:500 0.72rem/1.35 system-ui,sans-serif; }
.vsierra-pie { pointer-events: none; padding: 0 1rem 0.85rem; display: flex; justify-content: center; }
.vsierra-pie p { margin: 0; max-width: 42rem; text-align: center; padding: 0.42rem 0.85rem; border-radius: 0.7rem; color: #f4ecdd; font: 500 0.76rem/1.4 system-ui, sans-serif; }
.vsierra-volver { position:absolute;right:1rem;top:1rem;z-index:40;width:44px;height:44px;border:1px solid #ffffff80;border-radius:50%;color:#fff;font-size:1.5rem;cursor:pointer; }
.vsierra-recorrer { display:none; }
.vsierra-puerta__navegacion { margin-top:1rem; padding-top:.85rem; border-top:1px solid rgba(255,239,185,.28); }
.vsierra-puerta__navegacion > label { display:block; margin:0 0 .35rem; color:#ffe39a; font:700 .62rem/1 system-ui,sans-serif; letter-spacing:.1em; text-transform:uppercase; }
.vsierra-puerta__navegacion .vsierra-recorrer { display:block; width:100%; min-height:44px; margin:0; border:1px solid rgba(255,239,185,.5); border-radius:10px; padding:.5rem .8rem; background:rgba(255,248,223,.08); color:#fff8df; }
.vsierra-puerta__navegacion .vsierra-laboratorio { width:100%; margin:1rem 0 0; box-sizing:border-box; }
.vsierra-aviso { position:relative; padding:0 20px 6px 0; border-bottom:1px solid #c0c7b6; }
.vsierra-aviso button { position:absolute;right:0;top:0;background:transparent;border:0;color:inherit;min-width:28px;min-height:28px;cursor:pointer; }
.vsierra-laboratorio { pointer-events:auto; align-self:flex-end; width:min(19rem, calc(100% - 2rem)); margin:0 1rem 1rem; padding:0.6rem 0.8rem; color:#273b38; border:1px solid #ffffff80; border-radius:12px; font:500 0.8rem/1.4 system-ui; }
.vsierra-laboratorio summary { cursor:pointer; min-height:28px; padding-top:5px; }
.vsierra-laboratorio label { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:10px; }
.vsierra-laboratorio select { max-width:72%; min-height:44px; background:transparent; border:1px solid #758c7e; border-radius:6px; color:#213e36; padding:5px; }
.vsierra-laboratorio p { margin:10px 0 0; font-size:0.75rem; }
.vsierra-laboratorio :focus-visible { outline:3px solid #376e63; outline-offset:3px; }
.vsierra-chrome { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 24rem); grid-template-rows: auto auto minmax(0, 1fr) auto; align-content: stretch; }
.vsierra-titulo { grid-column: 1 / -1; grid-row: 1; }
/* La fila central recibe el espacio restante; el contenido nunca fija su altura. */
.vsierra-datos { grid-column: 2; grid-row: 3; justify-self: stretch; align-self: stretch; min-height: 0; min-width: 0; box-sizing: border-box; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
.vsierra-datos:focus-visible { outline: 2px solid #ffe39a; outline-offset: -2px; }
.vsierra-abajo { grid-column: 1 / -1; grid-row: 4; min-height: 0; padding-left: min(23rem, 28vw); }
.vsierra-clima-estado { width: calc(100% - min(23rem, 28vw) - 1rem); margin-left: min(23rem, 28vw); }
.vsierra-pie { padding-right: 1rem; }
.vsierra-titulo { font-family:Georgia,serif; font-size:1.5rem; padding:1.3rem 1.5rem; }
.vsierra-titulo small { font-size:0.75rem; max-width:26rem; }
@media(max-width:600px) {
.vsierra-chrome { display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; align-content: stretch; }
.vsierra-titulo { position:static; z-index:2; }
.vsierra-datos { position:static; z-index:3; max-width:none; margin:.55rem 1rem 0; padding:0.8rem 0.9rem; }
.vsierra-abajo { position:static; grid-column:1; grid-row:4; z-index:4; padding:0 0 max(0.6rem, env(safe-area-inset-bottom)); }
.vsierra-clima-estado { width:calc(100% - 2rem); margin:0 1rem 0.5rem; }
.vsierra-root [data-piso], .vsierra-costa { display:none; }
.vsierra-puerta__navegacion .vsierra-recorrer { display:block; width:100%; margin:0; }
.vsierra-puerta__navegacion .vsierra-laboratorio { width:100%; margin-bottom:0.5rem; box-sizing:border-box; }
.vsierra-titulo {font-size:1.15rem;padding:1rem 5.25rem 1rem 1rem;} .vsierra-titulo small {max-width:20rem;} .vsierra-pie p {font-size:0.65rem;} .vsierra-sindato {bottom:24vh;} }
@media(max-width:600px) { .vsierra-puerta { left:1rem; right:1rem; bottom:calc(.8rem + env(safe-area-inset-bottom)); max-width:none; } .vsierra-caja__contenido { left:1rem; right:1rem; bottom:calc(.8rem + env(safe-area-inset-bottom)); width:auto; } }
@media(max-width:390px) { .vsierra-caja ol { grid-template-columns:1fr; } .vsierra-caja__contenido { padding:.95rem 1rem 1rem; } }
@media(max-width:390px) { .vsierra-caja__lecturas { grid-template-columns:1fr; } }
@media(max-width:390px) { .vsierra-datos__clima { gap: 0.35rem; } .vsierra-datos__clima strong { font-size: 1.04rem; } }
@media(max-width:600px) {
 .vsierra-llegada { top:4.8rem; left:1rem; right:1rem; width:auto; padding:.75rem .8rem; }
 .vsierra-llegada strong { font-size:1.08rem; }
 .vsierra-root .vsierra-cumbre { transform: translateY(-20vh); }
  .vsierra-pie { padding-left: 1rem; padding-bottom: calc(4.6rem + env(safe-area-inset-bottom)); }
}

.vsierra-datos__nivel-1 { padding-bottom:.18rem; border-bottom:1px solid rgba(255,239,185,.22); }
.vsierra-datos__nivel-1 strong { font-size:1.06rem; }
.vsierra-datos__nivel-2 { min-height:2.45rem; }
.vsierra-datos__nivel-2 strong { font-size:.86rem; text-transform:capitalize; }
.vsierra-datos__nivel-2 strong.vsierra-datos__ausencia { text-transform:none; }
.vsierra-datos__nivel-3 { min-height:2.15rem; padding-left:.3rem; border-left:1px solid rgba(255,239,185,.22); }
.vsierra-datos__nivel-3 strong { font-size:.74rem; }
@media (prefers-reduced-motion: reduce) { .vsierra-canvas { transition: none; } .vsierra-llegada { animation:none; } }

/* La atmósfera queda siempre visible: el contraste lo pone el halo tipográfico,
   nunca una placa de color delante del macizo. */
.vsierra-root .vsierra-rotulo,
.vsierra-root .vsierra-hielo,
.vsierra-root .vsierra-finca,
.vsierra-root .vsierra-aqui,
.vsierra-root .vsierra-clima-estado,
.vsierra-root .vsierra-pie p,
.vsierra-root .vsierra-credito--3d,
.vsierra-root .vsierra-laboratorio,
.vsierra-root .vsierra-recorrer,
.vsierra-root .vsierra-volver {
  background: transparent !important;
  backdrop-filter: none !important;
  box-shadow: none !important;
}
.vsierra-root .vsierra-pie p,
.vsierra-root .vsierra-credito--3d {
  background: rgba(8, 25, 20, 0.88) !important;
}
.vsierra-root .vsierra-rotulo,
.vsierra-root .vsierra-hielo,
.vsierra-root .vsierra-finca,
.vsierra-root .vsierra-aqui,
.vsierra-root .vsierra-datos,
.vsierra-root .vsierra-clima-estado,
.vsierra-root .vsierra-laboratorio,
.vsierra-root .vsierra-recorrer,
.vsierra-root .vsierra-volver,
.vsierra-root .vsierra-pie p,
.vsierra-root .vsierra-credito--3d {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
}
.vsierra-root .vsierra-rotulo,
.vsierra-root .vsierra-datos,
.vsierra-root .vsierra-datos__contexto,
.vsierra-root .vsierra-datos__tit,
.vsierra-root .vsierra-datos__finca,
.vsierra-root .vsierra-datos__rango,
.vsierra-root .vsierra-datos__clima,
.vsierra-root .vsierra-datos__nota {
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.95), 0 0 7px rgba(0, 0, 0, 0.98), 0 0 12px rgba(0, 0, 0, 0.72);
}
.vsierra-root .vsierra-datos {
  background: rgba(16, 35, 31, 0.34) !important;
  border: 1px solid rgba(255, 239, 185, 0.34);
  backdrop-filter: blur(4px);
  box-shadow: 0 8px 28px rgba(5, 21, 17, 0.2) !important;
}
.vsierra-root .vsierra-datos__finca { background: transparent; }
.vsierra-root .vsierra-finca { background: rgba(20, 57, 45, 0.82) !important; color: #fff3d6; border-color: rgba(255, 239, 185, 0.72); }
.vsierra-root--caja-abierta .vsierra-rotulo { visibility: hidden; }
.vsierra-root .vsierra-recorrer { color: #273b38; }
/* Jerarquía del consejo, independiente de la lectura meteorológica. */
.vsierra-chrome { z-index:101; }
.vsierra-caja { z-index:110; }
.vsierra-root .vsierra-datos { width:auto; max-width:none; padding:.65rem .9rem; color:#f5e8c7; background:rgba(16,35,31,.94) !important; border-radius:4px; }
.vsierra-root .vsierra-datos, .vsierra-root .vsierra-datos * { text-shadow:none; }
.vsierra-datos__guia { margin:.35rem 0 .2rem; color:#fff5d9; font:700 1.35rem/1.1 Georgia,serif; }
.vsierra-datos__clima { grid-template-columns:repeat(6,minmax(0,1fr)); gap:.4rem .6rem; margin-top:.35rem; }
.vsierra-datos__clima .vsierra-datos__decision { grid-column:span 6; gap:.14rem; padding:.4rem .65rem; border-left:3px solid #e2c783; background:#263f37; }
.vsierra-datos__clima .vsierra-datos__decision--helada { border-left-width:6px; background:#f3e8ca; color:#21392f; }
.vsierra-datos__decision--helada span, .vsierra-datos__decision--helada strong, .vsierra-datos__decision--helada small { color:#21392f; }
.vsierra-datos__decision--helada strong { font:700 1.3rem/1.15 Georgia,serif; }
.vsierra-datos__decision > span { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:baseline; gap:.4rem; }
.vsierra-datos__decision > span em { flex-shrink:0; }
.vsierra-datos__decision b { color:inherit; font-size:.95rem; font-variant-numeric:tabular-nums; }
.vsierra-datos__decision--agua { color:#f5e8c7; }
.vsierra-datos__decision--agua strong { font-size:1rem; }
.vsierra-datos__clima .vsierra-datos__decision--apoyo { grid-column:span 3; background:transparent; border-left:2px solid #90b5a1; color:#f5e8c7; padding:.3rem .5rem; }
.vsierra-datos__decision--apoyo strong { font-size:.85rem; }
.vsierra-datos__procedencia { display:block; margin-top:.12rem; color:#b7d3bc; font:600 .66rem/1.3 system-ui,sans-serif; letter-spacing:.01em; }
.vsierra-datos__razon { display:none; }
.vsierra-datos__cielo { margin:.2rem 0; color:#496b62; font-size:.72rem; line-height:1.25; }
.vsierra-suelo-capas { display:grid; gap:.35rem; margin:.45rem 0; padding:.45rem; border:1px solid rgba(144,181,161,.5); border-radius:3px; }
.vsierra-suelo-capas__titulo { font-weight:700; }
.vsierra-suelo-capas__lista { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.35rem; }
.vsierra-suelo-capas__capa { display:grid; gap:.12rem; min-width:0; padding:.3rem; background:rgba(144,181,161,.12); }
.vsierra-suelo-capas__capa span { font-size:.72rem; }
.vsierra-suelo-capas__capa strong { font-size:.82rem; font-variant-numeric:tabular-nums; }
.vsierra-suelo-capas small { font-size:.72rem; line-height:1.35; }
.vsierra-suelo-capas__vacio { color:#f5d890; font-weight:700; }
.vsierra-datos__prioridad--principal .vsierra-datos__procedencia { color:#526b5b; }
.vsierra-datos__clima em { display:block; font-style:normal; text-transform:none; letter-spacing:0; font-weight:500; font-size:.64rem; margin-top:.1rem; }
.vsierra-datos__insumos { grid-column:1/-1; margin:.1rem 0 0; padding-top:.5rem; border-top:1px solid #7a9585; color:#ede6d2; font:700 .75rem/1.2 Georgia,serif; }
.vsierra-datos__insumos small { display:block; margin-top:.15rem; }
.vsierra-datos__clima .vsierra-datos__insumo { grid-column:span 2; grid-template-columns:minmax(0,1fr) auto; align-content:start; gap:.2rem; padding:.2rem 0; }
.vsierra-datos__insumo > span, .vsierra-datos__insumo > small { grid-column:1/-1; }
.vsierra-datos__insumo > strong { grid-column:1; grid-row:2; }
.vsierra-datos__insumo > svg { grid-column:2; grid-row:2; }
.vsierra-datos__insumo strong { font-size:.86rem; font-variant-numeric:tabular-nums; }
.vsierra-datos__insumo svg { width:40px; height:24px; fill:none; stroke:#c9d9ac; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
.vsierra-datos__finca { display:flex; align-items:baseline; gap:.5rem; margin:.2rem 0 .1rem; padding:.15rem .4rem; }
.vsierra-datos__finca span { color:#b7d3bc; }
.vsierra-datos__finca strong { color:#f5e8c7; }
.vsierra-datos__rango { font-size:.64rem; }
.vsierra-datos__enso, .vsierra-datos__fuente { margin-top:.45rem; }
.vsierra-datos__seccion { min-width:0; margin:.3rem 0; border:1px solid rgba(255,239,185,.28); border-radius:.45rem; background:rgba(7,30,24,.22); }
.vsierra-datos__seccion > summary { display:flex; align-items:center; justify-content:space-between; gap:.75rem; min-height:44px; padding:.55rem .65rem; color:#fff5d9; cursor:pointer; font:700 .92rem/1.2 Georgia,serif; list-style:none; }
.vsierra-datos__seccion > summary::-webkit-details-marker { display:none; }
.vsierra-datos__seccion > summary::after { content:'+'; color:#f1d58a; font:700 1.15rem/1 system-ui,sans-serif; }
.vsierra-datos__apoyos > summary { display:flex; align-items:baseline; justify-content:space-between; gap:.5rem; color:#fff5d9; cursor:pointer; font:700 .86rem/1.2 Georgia,serif; }
.vsierra-datos__apoyos > summary small { color:#b7d3bc; font:600 .66rem/1.2 system-ui,sans-serif; }
.vsierra-datos__apoyos-resto { grid-column:1/-1; margin-top:.2rem; padding-top:.35rem; border-top:1px solid rgba(144,181,161,.3); }
.vsierra-datos__apoyos-resto > summary { color:#d8ccb9; cursor:pointer; font:700 .7rem/1.2 system-ui,sans-serif; }
.vsierra-datos__seccion[open] > summary { border-bottom:1px solid rgba(255,239,185,.2); }
.vsierra-datos__seccion[open] > summary::after { content:'−'; }
.vsierra-datos__seccion > summary:focus-visible { outline:2px solid #ffe39a; outline-offset:2px; border-radius:.3rem; }
.vsierra-datos__seccion-contenido { min-width:0; padding:.05rem .65rem .65rem; }
.vsierra-datos__seccion-contenido > :first-child { margin-top:.25rem; }
@media(max-width:600px) {
  .vsierra-root .vsierra-datos { padding:.8rem; }
  .vsierra-datos__seccion { margin:.42rem 0; }
  .vsierra-datos__seccion > summary { min-height:48px; padding:.7rem .72rem; font-size:.95rem; }
  .vsierra-datos__seccion-contenido { padding:.08rem .72rem .72rem; }
}

/* El primer bloque sigue el orden DOM, también para teclado y lector. */
.vsierra-datos__prioridad, .vsierra-datos__apoyos { grid-column:1/-1; min-width:0; }
.vsierra-datos__clima .vsierra-datos__decision { background:transparent; border-left:2px solid #90b5a1; color:#f5e8c7; display:grid; }
.vsierra-datos__decision span, .vsierra-datos__decision strong, .vsierra-datos__decision small { color:inherit; }
.vsierra-datos__decision strong { font:700 1rem/1.2 Georgia,serif; }
.vsierra-datos__prioridad--principal { background:#f3e8ca; color:#21392f; border-radius:4px; padding:.45rem; }
.vsierra-datos__prioridad--principal .vsierra-datos__decision { color:#21392f; border:0; }
.vsierra-datos__prioridad--principal strong { font-size:1.35rem; }
.vsierra-datos__manda { margin:0 .65rem; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
.vsierra-datos__anclado { margin:.2rem .65rem .1rem; color:#d8ccb9; font-size:.74rem; }
.vsierra-datos__prioridad--principal { background:#f3e8ca !important; color:#21392f !important; text-shadow:none !important; }
.vsierra-datos__prioridad--principal .vsierra-datos__anclado { color:#21392f; font-weight:700; }
.vsierra-datos__fecha { color:#f5e8c7; font-size:.8rem; margin:.35rem 0; overflow-wrap:anywhere; }
.vsierra-datos__lluvia--resumen { color:#fff5d9; }
.vsierra-datos__lluvia { margin:.1rem 0; font-size:1rem; font-weight:700; }
.vsierra-datos__clima em, .vsierra-datos__clima small { font-size:.8rem; line-height:1.4; }
.vsierra-datos__clima summary { cursor:pointer; min-height:44px; display:flex; align-items:center; font-size:.85rem; text-decoration:none; }
.vsierra-datos__clima summary::before { content:'+ '; margin-right:.4rem; }
.vsierra-datos__clima details[open] > summary::before { content:'− '; }
.vsierra-datos__clima details small { display:block; margin-bottom:.3rem; }
.vsierra-datos__clima summary:focus-visible { outline:2px solid currentColor; outline-offset:2px; }
.vsierra-consejo-agua { margin:.25rem 0 .35rem; padding:.45rem !important; border-radius:.45rem !important; }
.vsierra-consejo-agua, .vsierra-datos__prioridad--principal .vsierra-consejo-agua { color:#f5e8c7 !important; background:rgba(8,26,22,.82) !important; }
.vsierra-consejo-agua h3, .vsierra-consejo-agua p, .vsierra-consejo-agua span, .vsierra-consejo-agua strong { color:inherit !important; }
.vsierra-consejo-agua .mt-2 { margin-top:.3rem; }
.vsierra-consejo-agua .mt-3 { margin-top:.35rem; }
.vsierra-consejo-agua .text-sm { font-size:.72rem; line-height:1.25; }
.vsierra-consejo-agua .text-xs { font-size:.64rem; line-height:1.25; }
.vsierra-consejo-agua .text-[11px] { font-size:.6rem; }
@media(max-width:600px) {
 .vsierra-root .vsierra-canvas { top:-12vh; bottom:-12vh; height:auto; }
 .vsierra-chrome { grid-template-columns:minmax(0,1fr); }
 .vsierra-root .vsierra-datos { display:flex; flex-direction:column; }
 .vsierra-root .vsierra-datos__guia { order:-2; }
 .vsierra-root .vsierra-datos__clima { order:-1; }
 .vsierra-root .vsierra-datos { grid-column:1; }
 .vsierra-datos__clima .vsierra-datos__insumo { grid-column:span 3; }
 .vsierra-suelo-capas__lista { grid-template-columns:1fr; }
 /* En teléfono la lectura sigue completa y desplazable, pero se ancla abajo.
    Así el canvas conserva una ventana alta para que el macizo sea identificable
    antes de que el usuario abra el resto de las decisiones. */
 .vsierra-root .vsierra-datos { align-self:end; width:calc(100% - 2rem); height:min(31vh, 18rem); max-height:min(31vh, 18rem); margin:.55rem 1rem 0; overflow-y:auto; }
 .vsierra-root .vsierra-datos__nota { margin:.28rem 0; font-size:.62rem; }
 .vsierra-root .vsierra-datos__adquisicion { margin:.28rem 0 .2rem; padding:.32rem .4rem; }
 .vsierra-root .vsierra-datos__fecha { margin:.22rem 0; font-size:.72rem; }
 .vsierra-root .vsierra-datos__lluvia--resumen { margin:.2rem 0; }
 .vsierra-root .vsierra-territorio { margin:.3rem 0; padding:.4rem; font-size:.68rem; }
 .vsierra-root .vsierra-territorio p { line-height:1.25; }
 .vsierra-root .vsierra-datos__guia { margin:.2rem 0 .1rem; font-size:1.2rem; }
 .vsierra-root .vsierra-datos__prioridad--principal { padding:.3rem; }
 .vsierra-root .vsierra-datos__prioridad--principal strong { font-size:1.15rem; }
 .vsierra-root .vsierra-datos__prioridad--principal .vsierra-datos__procedencia { font-size:.58rem; }
 .vsierra-root .vsierra-datos__clima summary { min-height:32px; }
 .vsierra-abajo { align-self:end; }
 .vsierra-pie { padding-bottom:calc(4.6rem + env(safe-area-inset-bottom)); }
}

/* En teléfono las cuatro decisiones son el primer vistazo: estado breve arriba,
   detalle completo bajo demanda. El orden recibido sigue siendo el de riesgo. */
@media(max-width:600px) {
 .vsierra-root .vsierra-datos__clima { grid-template-columns:repeat(2,minmax(0,1fr)); gap:.35rem; }
 .vsierra-root .vsierra-datos__prioridad { grid-column:span 1; padding:0; background:transparent; }
 .vsierra-root .vsierra-datos__prioridad--principal { grid-column:1/-1; padding:.25rem; }
 .vsierra-root .vsierra-datos__prioridad--principal { color:#f5e8c7; background:transparent; }
 .vsierra-root .vsierra-datos__prioridad--principal .vsierra-datos__decision { color:#f5e8c7; border-left:2px solid #90b5a1; }
 .vsierra-root .vsierra-datos__manda { margin:0 .4rem .1rem; font-size:.58rem; }
 .vsierra-root .vsierra-datos__decision,
 .vsierra-root .vsierra-datos__clima .vsierra-datos__decision--apoyo { grid-column:auto; min-height:0; gap:.1rem; padding:.34rem .42rem; border-left-width:2px; }
 .vsierra-root .vsierra-datos__prioridad--principal .vsierra-datos__decision { padding:.34rem .42rem; }
 .vsierra-root .vsierra-datos__prioridad--principal strong,
 .vsierra-root .vsierra-datos__decision strong { font-size:1.05rem; line-height:1.15; }
 .vsierra-root .vsierra-datos__decision--helada strong { font-size:.82rem; }
 .vsierra-root .vsierra-datos__decision b { font-size:.72rem; line-height:1.15; }
 .vsierra-root .vsierra-datos__decision > span { font-size:.72rem; }
 .vsierra-root .vsierra-datos__decision > span em { font-size:.58rem; }
 .vsierra-root .vsierra-datos__razon { display:block; margin:0; color:inherit; font-size:.72rem; line-height:1.2; overflow-wrap:anywhere; }
 .vsierra-root .vsierra-datos__cielo { display:block; margin:.15rem 0; color:inherit; font-size:.68rem; line-height:1.2; }
 .vsierra-root .vsierra-datos__clima summary { min-height:18px; font-size:.58rem; line-height:1; }
 .vsierra-root .vsierra-datos__decision details small { font-size:.54rem; line-height:1; }
 .vsierra-root .vsierra-datos__decision .vsierra-datos__procedencia { font-size:.45rem; line-height:.85; }
 .vsierra-root .vsierra-datos__decision--agua details,
 .vsierra-root .vsierra-datos__decision--agua .vsierra-consejo-agua { min-width:0; }
 .vsierra-root .vsierra-datos__decision--agua .vsierra-consejo-agua { margin:.25rem 0 .35rem; }
}

/* Opción B: cuatro lecturas pequeñas, pegadas a cuatro lugares del relieve.
   La placa queda abierta solo como respaldo de navegación y teclado. */
.vsierra-dato-mundo { width:min(12.5rem, 32vw); color:#fff5d9; border:1px solid rgba(255,239,185,.72); border-left:3px solid #e2c783; border-radius:.45rem; background:rgba(12,35,29,.78); box-shadow:0 5px 18px rgba(3,16,13,.32); backdrop-filter:blur(3px); text-shadow:0 1px 3px #10232b; overflow:hidden; }
.vsierra-dato-mundo summary { position:relative; display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:.12rem .2rem; min-width:0; padding:.42rem .5rem; cursor:pointer; list-style:none; }
.vsierra-dato-mundo summary::-webkit-details-marker { display:none; }
.vsierra-dato-mundo summary::after { position:absolute; top:1.7rem; right:.5rem; content:'+'; color:#f1d58a; font:700 .9rem/1 system-ui,sans-serif; }
.vsierra-dato-mundo[open] summary::after { content:'−'; }
.vsierra-dato-mundo summary span { min-width:0; color:#f1d58a; font:800 .56rem/1.05 system-ui,sans-serif; letter-spacing:.025em; text-transform:uppercase; white-space:nowrap; }
.vsierra-dato-mundo summary em { grid-column:2; grid-row:1; justify-self:end; color:#d8ccb9; font:600 .54rem/1 system-ui,sans-serif; font-style:normal; }
.vsierra-dato-mundo summary strong { grid-column:1 / -1; grid-row:3; color:#fffdf4; font:700 .88rem/1.12 Georgia,serif; }
.vsierra-dato-mundo summary .vsierra-dato-mundo__certeza { grid-column:1 / -1; grid-row:2; justify-self:start; padding:.13rem 1.3rem .13rem .28rem; border:1px solid currentColor; border-radius:.2rem; color:#fffdf4; font:800 .58rem/1.1 system-ui,sans-serif; letter-spacing:.035em; white-space:nowrap; }
.vsierra-dato-mundo__certeza[data-certeza="medido"]::before { content:'● '; }
.vsierra-dato-mundo__certeza[data-certeza="pronostico"]::before { content:'◇ '; }
.vsierra-dato-mundo__certeza[data-certeza="faltante"]::before { content:'! '; }
.vsierra-dato-mundo summary .vsierra-dato-mundo__emision { grid-column:1 / -1; grid-row:4; color:#e2e5d9; font:500 .57rem/1.1 system-ui,sans-serif; font-style:normal; }
.vsierra-dato-mundo summary .vsierra-dato-mundo__accion { grid-column:1 / -1; grid-row:5; display:block; margin-top:.08rem; color:#ffe39a; font:700 .68rem/1.2 system-ui,sans-serif; }
.vsierra-dato-mundo__razon { margin:0; padding:.35rem .5rem 0; color:#f7eacb; font:600 .59rem/1.2 system-ui,sans-serif; }
.vsierra-dato-mundo > b { display:block; padding:.18rem .5rem 0; color:#fffdf4; font:700 .65rem/1.15 system-ui,sans-serif; }
.vsierra-dato-mundo > small { display:block; padding:.22rem .5rem .45rem; color:#d8ccb9; font:500 .55rem/1.2 system-ui,sans-serif; }
.vsierra-dato-mundo .vsierra-datos__procedencia { display:block; margin:0; padding:.35rem .5rem .45rem; border-top:1px solid rgba(255,239,185,.22); color:#b7d3bc; font:600 .5rem/1.2 system-ui,sans-serif; }
.vsierra-dato-mundo--frio { border-left-color:#f1d58a; }
.vsierra-dato-mundo--agua { border-left-color:#8fc5bb; }
.vsierra-dato-mundo--humedad { border-left-color:#a9c6d7; }
.vsierra-dato-mundo--viento { border-left-color:#c9d9ac; }
@media(max-width:600px) {
 .vsierra-dato-mundo { width:min(10.4rem, 39vw); }
 .vsierra-dato-mundo summary { padding:.34rem .4rem; }
 .vsierra-dato-mundo summary span { font-size:.68rem; }
 .vsierra-dato-mundo summary strong { font-size:.74rem; }
 .vsierra-dato-mundo summary .vsierra-dato-mundo__accion { font-size:.68rem; }
 .vsierra-dato-mundo__razon { padding:.28rem .4rem 0; font-size:.51rem; }
 .vsierra-dato-mundo > b { padding:.15rem .4rem 0; font-size:.55rem; }
 .vsierra-dato-mundo > small, .vsierra-dato-mundo .vsierra-datos__procedencia { padding-left:.4rem; padding-right:.4rem; font-size:.48rem; }
 .vsierra-dato-mundo[open] { box-sizing:border-box; max-height:min(55vh, calc(84vh - 224px)); overflow-y:auto; overscroll-behavior:contain; }
}
/* El panel acompaña al macizo: los apoyos mínimos quedan en el primer pliegue
   y el resto sigue dentro de un detalle climático. */
.vsierra-root .vsierra-datos { position:absolute; right:1rem; top:5.3rem; bottom:4.2rem; width:min(28rem, calc(100% - 2rem)); height:auto; max-height:none; margin:0; padding:.65rem .9rem; overflow-y:auto; clip:auto; clip-path:none; white-space:normal; border:1px solid rgba(255,239,185,.34); }
.vsierra-datos__seccion--decisiones .vsierra-datos__seccion-contenido { display:flex; flex-direction:column; }
@media(max-width:600px) {
  .vsierra-root .vsierra-datos { left:1rem; right:1rem; top:auto; bottom:8.8rem; width:auto; height:31vh; max-height:31vh; margin:.55rem 1rem .7rem; }
  .vsierra-root .vsierra-datos__seccion--piso { display:none; }
  .vsierra-root .vsierra-datos__seccion--decisiones > summary,
  .vsierra-root .vsierra-datos__guia { display:none; }
  .vsierra-root .vsierra-datos__apoyos .vsierra-datos__clima { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .vsierra-root .vsierra-datos__apoyos .vsierra-datos__insumo { grid-column:span 1; }
  .vsierra-root .vsierra-datos__apoyos > .vsierra-datos__clima > .vsierra-datos__insumo > small { display:none; }
}

/* La transición tiene dos piezas operables: el aviso y el avance. En retrato
   se reservan filas distintas para que el aviso territorial nunca cubra el
   botón de continuar. */
@media(max-width:600px) {
 .tsm__aviso-riesgo { bottom:calc(4.8rem + env(safe-area-inset-bottom)); }
 .tsm__pizarra { max-height:calc(100dvh - 10rem); overflow:auto; }
 .tsm__continuar { left:1rem; right:1rem; bottom:calc(1rem + env(safe-area-inset-bottom)); width:calc(100% - 2rem); min-height:44px; }
}

`;

/**
 * VistaGlobalSierra — la vista global montable con su propio `<Canvas>`.
 * Trae la cámara de establishing shot, órbita suave acotada, título, clave de
 * pisos accesible y el pie de crédito DOM a los cuatro pueblos. El host decide
 * cuándo mostrarla (no monta lógica de negocio).
 *
 * @param {object} props
 * @param {'alto'|'medio'|'bajo'} [props.tier='alto']  presupuesto de render.
 * @param {boolean} [props.reducedMotion=false]  sin órbita ni nubes; frameloop a demanda.
 * @param {string}  [props.pisoUsuario]  piso de la finca a resaltar (opcional).
 * @param {number|null} [props.msnm]  altitud CONFIRMADA de la finca (metros).
 *        Sin la prop, se lee el perfil persistido o `?msnm=` (gate): si tampoco,
 *        nada de la finca se dibuja (P1, guard anti-fabricación).
 * @param {(piso:object)=>void} [props.onSeleccionPiso]  se llama al llegar al piso seleccionado.
 * @param {string}  [props.className]  clases extra del contenedor.
 * @param {Array}   [props.sugerencias]  salida de `buildClimaCultivoSuggestions`
 *        si el host ya la calculó (sin plantas no hay tiza de SU cultivo).
 * @param {() => void} [props.onBack]  vuelve a la vista anterior.
 * @param {(destino:string) => void} [props.onNavigate]  navega al mundo elegido.
 */
export default function VistaGlobalSierra({
  tier = 'alto',
  reducedMotion: calmaSolicitada = false,
  pisoUsuario,
  msnm = null,
  onSeleccionPiso,
  className = '',
  onBack,
  onNavigate,
  sugerencias = [],
}) {
  const reducedMotion = useCalma(calmaSolicitada);
  const encuadreMovil = typeof window !== 'undefined' && window.innerWidth < 600;
  const [listo, setListo] = useState(false);
  const [mostrarLlegada, setMostrarLlegada] = useState(true);
  const [llegadaAsentada, setLlegadaAsentada] = useState(false);
  const [mostrarAyuda, setMostrarAyuda] = useState(() => {
    try { return sessionStorage.getItem(AVISO_UBICACION) !== '1'; } catch { return true; }
  });
  /* El clima de la finca entra por el MISMO hook que la vitrina 2D y la Página
     del Tiempo (`useClima3DVivo`): lee la cache compartida y escucha el evento.
     Se baja al aterrizaje del descenso para que la Sierra absorba el dato que
     ya existe, sin armar un camino paralelo a `climaService`. */
  const climaVivo = useClima3DVivo();
  const perfilFinca = useMemo(() => getProfile() || null, []);
  const [ensayo, setEnsayo] = useState(() => leerGateAtmosfera().clima || 'vivo');
  const [horaEnsayo, setHoraEnsayo] = useState('dia');
  const cicloParam = useMemo(() => leerCicloParam(), []);
  const climaEscena = useMemo(() => {
    const base = ensayo === 'vivo' ? climaVivo : {
      senal: true, luz: horaEnsayo, condicion: ensayo,
      nubosidad: ensayo === 'despejado' ? 5 : ensayo === 'nublado' ? 75 : 95,
      lluvia: ensayo === 'lluvia', niebla: ensayo === 'niebla',
      humedad: ensayo === 'niebla' ? 95 : ensayo === 'despejado' ? 50 : 80,
    };
    const gate = leerGateAtmosfera();
    const horaCiclo = cicloParam?.modo === 'fijo' ? cicloParam.hora : null;
    const forzada = gate.clima || gate.luz;
    return forzada ? {
      ...base,
      senal: true,
      condicion: gate.clima || base.condicion,
      lluvia: gate.clima === 'lluvia' || (gate.clima ? false : base.lluvia),
      niebla: gate.clima === 'niebla' || (gate.clima ? false : base.niebla),
      luz: gate.luz || (horaCiclo == null ? base.luz : luzSierraDesdeHora(horaCiclo)),
      ...(horaCiclo == null ? {} : { hora: horaCiclo }),
    } : horaCiclo == null ? base : { ...base, luz: luzSierraDesdeHora(horaCiclo), hora: horaCiclo };
  }, [climaVivo, ensayo, horaEnsayo, cicloParam]);
  /* P1 — la altitud de la finca que manda: la prop del host gana; sin ella, el
     parámetro de gate `?msnm=` (que el descenso ya usa) puebla la curva para
     capturas/demo. En el viaje real sin ninguno de los dos, no se dibuja. */
  const msnmPortada = msnm
    ?? leerGateDescenso().msnmFijo
    ?? perfilFinca?.finca_altitud
    ?? perfilFinca?.altitud
    ?? null;
  const pisoUsuarioEfectivo = pisoUsuario ?? pisoPorAltitud(altitudFincaValida(msnmPortada))?.id ?? null;
  /* GATE (2026-09-04): `?viaje=<id de banda>` (antes del hash) arranca el viaje a
     ese piso sin clic — es lo que permite capturar el descenso congelado con
     `?msnm=`. Estado INICIAL perezoso (nada de setState en un efecto); sin el
     parámetro, null, como siempre. */
  const [viajeInicial] = useState(() => {
    const id = new URLSearchParams(globalThis.location?.search ?? '').get('viaje');
    if (!id) return null;
    const banda = PISOS_TERMICOS_SIERRA.find((b) => b.id === id || b.piso === id);
    return banda ? { id: banda.piso, nombre: banda.nombre, minMsnm: banda.minMsnm, maxMsnm: banda.maxMsnm, banda } : null;
  });
  const [pisoActivo, setPisoActivo] = useState(viajeInicial ? viajeInicial.id : null);
  const [viaje, setViaje] = useState(viajeInicial ? { piso: viajeInicial, activa: true } : null);
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const perfil = perfilDeTier(tier);
  const seleccionarPiso = useCallback((piso) => {
    setPisoActivo(piso.id);
    setViaje({ piso, activa: true });
  }, []);
  const llegarAPiso = useCallback(() => {
    if (!viaje?.piso) return;
    if (onSeleccionPiso) onSeleccionPiso(viaje.piso);
    else {
      const mundo = mundoPrincipalDePiso(viaje.piso);
      if (mundo?.view) onNavigate?.(mundo.view);
    }
  }, [onSeleccionPiso, onNavigate, viaje]);
  const terminarViaje = useCallback(() => setViaje(null), []);
  const msnmConfirmado = altitudFincaValida(msnmPortada);
  const sinAltitud = msnmConfirmado == null;
  /* La tarjeta distingue el piso que se explora de la cota de la finca. La
     selección no se sustituye por la finca: ambos contextos deben quedar
     visibles cuando son distintos. */
  const pisoDatos = pisoActivo ?? pisoPorAltitud(msnmConfirmado)?.id ?? pisoDeCaja(null, pisoUsuarioEfectivo, null);
  const pisoCaja = pisoDeCaja(pisoDatos, pisoUsuarioEfectivo, msnmConfirmado);
  const climaPiso = useClimaPorPiso(pisoDatos, perfilFinca);
  const climaPanel = useMemo(() => {
    const panel = contratoClimaVivo(climaVivo, climaPiso);
    return msnmConfirmado == null ? { ...panel, estado: 'sin_finca', datos: {} } : panel;
  }, [climaVivo, climaPiso, msnmConfirmado]);
  const lecturaCompleta = climaPanel?.adquisicion?.estado !== 'consultando';
  useEffect(() => {
    if (!listo || !lecturaCompleta) return undefined;
    const asentamiento = window.setTimeout(() => setLlegadaAsentada(true), 900);
    return () => window.clearTimeout(asentamiento);
  }, [listo, lecturaCompleta]);
  useEffect(() => {
    if (!llegadaAsentada) return undefined;
    const cierre = window.setTimeout(() => setMostrarLlegada(false), 1800);
    return () => window.clearTimeout(cierre);
  }, [llegadaAsentada]);
  const fincaUbicada = msnmConfirmado != null
    && Number.isFinite(Number(perfilFinca?.ubicacion_lat))
    && Number.isFinite(Number(perfilFinca?.ubicacion_lng));
  const mostrarAvisoClima = ensayo === 'vivo' && !fincaUbicada;
  const climaEscenaPiso = useMemo(() => contratoClimaEscena({
    clima: ensayo === 'vivo' ? climaVivo : null,
    climaPiso: ensayo === 'vivo' ? climaPiso : null,
    simulacion: ensayo === 'vivo' ? null : climaEscena,
  }), [climaEscena, climaPiso, climaVivo, ensayo]);
  useEffect(() => {
    if (sinAltitud && mostrarAyuda && !viaje) {
      try { sessionStorage.setItem(AVISO_UBICACION, '1'); } catch { /* La ayuda sigue disponible sin storage. */ }
    }
  }, [sinAltitud, mostrarAyuda, viaje]);


  return (
    <section
      className={`vsierra-root vsierra-root--${climaEscenaPiso.estadoDato}${cajaAbierta ? ' vsierra-root--caja-abierta' : ''}${className ? ` ${className}` : ''}`}
      data-tier={tier}
      data-viaje={viaje ? "1" : "0"}
      aria-label="Vista global de la Sierra Nevada de Santa Marta: portada y mapa por pisos térmicos"
      >
        <style>{CSS_SIERRA}</style>
      <div className={`vsierra-cielo-estado vsierra-cielo-estado--${climaEscenaPiso.estadoDato}`} aria-hidden="true" />
      {onBack && <button type="button" className="vsierra-volver" aria-label="Volver al valle" onClick={onBack}>‹</button>}
      <Canvas
        className={`vsierra-canvas${listo ? ' vsierra-canvas--lista' : ''}`}
        dpr={perfil.dpr}
        shadows={perfil.sombras ? { type: THREE.PCFShadowMap } : false}
        gl={{ antialias: perfil.antialias, powerPreference: 'high-performance' }}
        camera={{ position: [-1.5, 6.6, -12.8], fov: 48 }}
        frameloop={reducedMotion ? 'demand' : 'always'}
        onCreated={() => {
          // Deja que la entrada anuncie el macizo antes de revelar el primer
          // cuadro completo. Así el asentamiento se percibe, no solo se mide.
          window.setTimeout(() => setListo(true), 650);
        }}
      >
        {/* Cámara PARADA sobre el mar Caribe (−Z, norte), mirando al SUR (+Z) y
            un poco hacia arriba: el mar llena el primer plano y las cumbres
            nevadas suben en el tercio superior. Distancia 15,4 < max 16; polar
            1,27 rad dentro de [1,05, 1,45]; los clamps de azimuth abrazan el
            azimuth natural (≈ −3.0 rad). El `fov` vertical (48°) encuadra igual
            en portrait y en landscape. */}
        <EncuadreSierra />
        <SierraDiorama
          tier={tier}
          reducedMotion={reducedMotion}
          pisoUsuario={pisoUsuarioEfectivo}
          msnm={msnmPortada}
          rotuloFinca={false}
          clima={ensayo === 'vivo' ? { ...climaEscenaPiso, ...climaVivo } : climaEscenaPiso}
          onSeleccionPiso={seleccionarPiso}
          pisoActivo={pisoActivo}
        />
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom
          minDistance={9}
          maxDistance={16}
          target={encuadreMovil ? [0, 1.25, 2.2] : [0, 2.1, 2.2]}
          minPolarAngle={1.05}
          maxPolarAngle={1.45}
          minAzimuthAngle={-Math.PI}
          maxAzimuthAngle={-2.75}
          enableDamping
          dampingFactor={0.08}
          autoRotate={!reducedMotion}
          autoRotateSpeed={0.09}
        />
        <AdaptiveDpr pixelated />
      </Canvas>

      <LlegadaSierra
        visible={mostrarLlegada}
        relieveListo={listo}
        completa={llegadaAsentada}
      />

      <TransicionSierraMundo
        activa={viaje?.activa ?? false}
        pisoDestino={viaje?.piso.id}
        tier={tier}
        reducedMotion={reducedMotion}
        sostenerAterrizaje
        avisarUbicacion={false}
        onMitad={llegarAPiso}
        onFin={terminarViaje}
        msnmUsuario={altitudFincaValida(msnmPortada)}
        faseEnso={climaVivo.tieneEnso ? climaVivo.ensoPhase : null}
        climaVivo={climaVivo}
        sugerencias={sugerencias.length ? sugerencias : sugerenciasCultivosSierra(climaVivo, getProfile()?.cultivos_actuales)}
      />

      <PuertaHerramientas
        pisoId={pisoCaja}
        msnm={msnmConfirmado}
        abierta={cajaAbierta}
        onAbrir={() => setCajaAbierta(true)}
        onCerrar={() => setCajaAbierta(false)}
        onNavigate={onNavigate}
        clima={climaPanel}
      >
        <div className="vsierra-puerta__navegacion">
          <label htmlFor="sierra-recorrer-piso">Recorrer un piso</label>
          <select id="sierra-recorrer-piso" className="vsierra-recorrer" aria-label="Recorrer un piso térmico" value="" onChange={(e) => {
            const banda = PISOS_TERMICOS_SIERRA.find((b) => b.id === e.target.value);
            if (banda) seleccionarPiso({ id: banda.piso, nombre: banda.nombre, minMsnm: banda.minMsnm, maxMsnm: banda.maxMsnm, banda });
          }}>
            <option value="" disabled>Seleccione un piso</option>
            {PISOS_TERMICOS_SIERRA.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
          <details className="vsierra-laboratorio">
            <summary>{ensayo === 'vivo' ? 'Explorar el clima' : 'Simulación del clima'}</summary>
            {sinAltitud && mostrarAyuda && !viaje && (
              <aside className="vsierra-aviso">
                <button aria-label="Cerrar aviso" onClick={() => setMostrarAyuda(false)}>×</button>
                <p>Confirme su finca y la montaña le muestra su clima.</p>
              </aside>
            )}
            <label>Condición
              <select aria-label="Condición del clima" value={ensayo} onChange={(e) => setEnsayo(e.target.value)}>
                <option value="vivo">Clima de la finca</option>
                <option value="despejado">Despejado</option><option value="nublado">Nublado</option>
                <option value="lluvia">Lluvia</option><option value="niebla">Niebla</option>
              </select>
            </label>
            {ensayo !== 'vivo' && <label>Hora
              <select aria-label="Hora de la simulación" value={horaEnsayo} onChange={(e) => setHoraEnsayo(e.target.value)}>
                <option value="amanecer">Amanecer</option><option value="dia">Día</option>
                <option value="atardecer">Atardecer</option><option value="noche">Noche</option>
              </select>
            </label>}
            <p>{ensayo === 'vivo'
              ? climaEscenaPiso.localUtilizable ? 'La atmósfera interpreta el clima de su finca, no mide toda la Sierra.' : 'Sin lectura local disponible. La atmósfera es ilustrativa.'
              : 'Aire húmedo, frío hasta el rocío: nubes.'}</p>
          </details>
        </div>
      </PuertaHerramientas>

      {/* Chrome DOM anclado a la composición: título arriba; abajo la clave de
          pisos (accesible) y el pie de crédito, apoyados sobre la playa/mar del
          encuadre — nada flota fuera de la escena. */}
      <div className="vsierra-chrome">
        <h2 className="vsierra-titulo">Clima de su piso</h2>
        <PanelDatosPiso pisoId={pisoDatos} msnm={msnmConfirmado} clima={climaPanel} climaPiso={climaPiso} avisoAltitud={climaVivo?.avisoAltitud} />
        <div className="vsierra-abajo">
          {mostrarAvisoClima && (
            <div className="vsierra-clima-estado" role="status" data-testid="clima-sin-datos">
              <div className="vsierra-clima-estado__titulo">Sin datos locales de clima</div>
              <p>Ubique su finca para leer el clima local.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
