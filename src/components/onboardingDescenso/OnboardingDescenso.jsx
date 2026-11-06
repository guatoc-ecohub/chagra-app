/* eslint-disable chagra-i18n/no-hardcoded-spanish -- copy del onboarding en español colombiano. */
/*
 * OnboardingDescenso — el arranque de Chagra como el primer nivel de un juego.
 *
 * La persona elige su compai, que sale de su caja, y baja con él SIN CORTES
 * desde la Tierra de noche hasta su propia tierra. Cada respuesta es el gesto
 * que acerca la escala siguiente: la ubicación lleva la cámara a su punto de
 * Colombia, confirmar la altura la lleva a su vereda, lo que hace la lleva a
 * su finca, y el tamaño la hace aterrizar.
 *
 * Orden y reglas (documentación interna DECISIONES del 26-sep): 1 compai
 * (obligatorio; el nombre es opcional) · 2 ubicación · 3 vereda y piso
 * térmico · 4 qué hace · 5 tamaño (invernadero solo si lo eligió) · 6 listo.
 * Los pasos 3 a 5 se pueden saltar. Sin puntos ni medallas.
 *
 * Auditoría de producto 2026-10-04 (C19): la ubicación ya no es obligatoria.
 * «Ahora no» lleva al inicio sin pedir el permiso del GPS, y desde el nombre
 * se llega a anotar o a preguntar sin pasar por el resto. En los dos casos
 * el recorrido queda marcado como saltado (no vuelve a salir solo) y el
 * avance se conserva para completarlo después desde el perfil.
 *
 * Persistencia: las claves compartidas del perfil
 * `chagra:profile:*`, usePerfilFincaStore, llave canónica del compai). El
 * avance a medio camino vive en `chagra:onb-juego:v1` y se borra al terminar.
 *
 * Props: las de los dos shells. App.jsx pasa onComplete/onClose; el shell de
 * producción pasa onHome/onBack/onNavigate.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ChagraAgentAvatar from '../ChagraAgentAvatar';
import AgentAvatarSelector from '../Settings/AgentAvatarSelector';
import { CompaiAvatarContext } from '../CompaiAvatarContext.js';
import useAgentAvatarType, { AVATAR_NOMBRE } from '../../hooks/useAgentAvatarType';
import { useGeolocation } from '../../hooks/useGeolocation';
import { resolveUbicacion, getPisoTermicoInfo, isCoarseLocation, PISO_TERMICO_INFO } from '../../services/locationService';
import { loadVeredasMunicipio, filterVeredaOptions } from '../../services/veredaLookupService';
import { findNearestMunicipio } from '../../utils/colombiaLocations';
import {
  getProfile,
  saveProfile,
  markProfileDone,
  markProfileSkipped,
  resolveAltitudToSave,
} from '../../services/userProfileService';
import usePerfilFincaStore from '../../store/usePerfilFincaStore';
import { decir as decirConLatido } from '../hola/viva/holaViva';
import { crearDescenso } from './descensoMundo';
import IconoTinta from './IconosTinta';
import { Dice, Tarjetas, TarjetasMultiples } from './DescensoUI';
import {
  LLAVE_AVANCE,
  PASOS,
  IDENTIDADES,
  SELECCION_MULTIPLE,
  ESCALAS,
  ESCALAS_CIUDAD,
  FORMAS,
  PISOS,
  ANIMALES,
  RANGOS_ANIMALES,
  ESQUEMAS_ORGANICO,
  SELLOS,
  buscarMunicipios,
  leerAvance,
  guardarAvance,
} from './descensoDatos';
import { detectarPlataforma, AVISO_PERMISO } from './plataforma';
import { guardarProgresoUnificado, limpiarProgresoUnificado } from '../onboardingState';
import { onboardingExtendidoActivo } from '../../config/onboardingExtendidoFlag';
import { crearRecorridoExtendido, guardarRecorridoExtendido } from '../../services/onboardingExtendidoService';
import './onboardingDescenso.css';
import PaisajeHumboldt from '../onboardingArte/PaisajeHumboldt.jsx';
import PaisajeArranque, { CajaFondo, CajaFrente, FrenteDelSuelo } from '../onboardingArte/PaisajeArranque.jsx';
import './onboardingJuegoArte.css';

function prefiereMenosMovimiento() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {
    return false;
  }
}

function formatoAltura(m) {
  if (!Number.isFinite(m)) return '';
  if (m >= 10000) return `${Math.round(m / 1000).toLocaleString('es-CO')} km`;
  if (m >= 1000) return `${(m / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} km`;
  return `${Math.max(1, Math.round(m)).toLocaleString('es-CO')} m`;
}

const mayus = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const VIAJE = ['', '¡Allá vamos! Bajando a Colombia…', 'Bajando entre las nubes…', 'Bajando a su vereda…', 'Llegando a su tierra…', '¡Ya casi!'];

/** @param {{onComplete?: (perfil: object) => void, onClose?: () => void, onBack?: () => void, onHome?: () => void, onNavigate?: (destino: string) => void, extendido?: {recorrido?: {compai?: string|null}, current: string, texto: string, titulo: string, pasos: string[], index: number, total: number, onBack: () => void, onAhoraNo: () => void}|null, children?: import('react').ReactNode}} props */
export default function OnboardingDescenso({ onComplete, onClose, onBack, onHome, onNavigate, extendido = null, children }) {
  const [reducir] = useState(prefiereMenosMovimiento);
  const [avanceInicial] = useState(leerAvance);
  const [perfilInicial] = useState(getProfile);
  const inicioRef = useRef(0);
  useEffect(() => {
    if (!inicioRef.current) inicioRef.current = Date.now();
  }, []);

  const [, setAvatarType] = useAgentAvatarType();
  const [paso, setPaso] = useState(() => (extendido ? 7 : avanceInicial?.compai ? clampPaso(avanceInicial.paso) : 0));
  const [fase0, setFase0] = useState(() => (avanceInicial?.compai && avanceInicial?.paso === 0 ? 'nombre' : 'elegir'));
  const [seleccion, setSeleccion] = useState(null);
  const [compai, setCompai] = useState(extendido?.recorrido?.compai || avanceInicial?.compai || (extendido ? 'angelita' : null));
  const [lanzando, setLanzando] = useState(null); // rect de la caja de donde sale
  const [nombre, setNombre] = useState(perfilInicial.nombre || '');
  const [viajando, setViajando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  /** Cambia de paso y arranca el viaje en el MISMO render: nunca se ve el paso siguiente antes de llegar. */
  const irA = (siguiente) => {
    setSubiendo(siguiente < paso);
    setPaso(siguiente);
    if (!reducir) setViajando(true);
    setAterrizado(false);
  };
  const [aterrizado, setAterrizado] = useState(false);

  // ubicación
  const { request: pedirGeo } = useGeolocation();
  const plataforma = useMemo(() => detectarPlataforma(), []);
  const [geo, setGeo] = useState(avanceInicial?.loc ? 'listo' : 'idle'); // idle|buscando|listo|negado|sin-gps
  const [loc, setLoc] = useState(avanceInicial?.loc || null);
  const [aMano, setAMano] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [candidato, setCandidato] = useState(null);
  // vereda y piso
  const [corrigiendo, setCorrigiendo] = useState(null); // 'vereda'|'altura'|null
  const [consultaVereda, setConsultaVereda] = useState('');
  const [alturaTexto, setAlturaTexto] = useState('');
  const [piso, setPiso] = useState(avanceInicial?.piso || null);
  // trabajo y tamaño
  const [identidad, setIdentidad] = useState(avanceInicial?.identidad || null);
  const [identidades, setIdentidades] = useState(avanceInicial?.identidades || (avanceInicial?.identidad ? [avanceInicial.identidad] : []));
  const [animales, setAnimales] = useState(avanceInicial?.animales || getProfile().animales || []);
  const [cantidadesAnimales, setCantidadesAnimales] = useState(avanceInicial?.cantidadesAnimales || getProfile().cantidades_animales || {});
  const [sellos, setSellos] = useState(() => {
    const previos = avanceInicial?.sellos || getProfile().sellos || [];
    return previos.map((s) => typeof s === 'string' ? { id: s, estado: 'declarado' } : s);
  });
  const [otroSello, setOtroSello] = useState(() => (avanceInicial?.sellos || getProfile().sellos || []).find((s) => s?.id === 'otro')?.texto || '');
  const [escala, setEscala] = useState(avanceInicial?.escala || null);
  const [escalas, setEscalas] = useState(avanceInicial?.escalas || (avanceInicial?.loc?.barrio ? ['balcon', 'jardin'] : avanceInicial?.escala ? [avanceInicial.escala] : []));
  const [forma, setForma] = useState(avanceInicial?.forma || null);
  const setEscalaPerfil = usePerfilFincaStore((s) => s.setEscala);
  const setInvernaderoPerfil = usePerfilFincaStore((s) => s.setInvernadero);

  const canvasRef = useRef(null);
  const motorRef = useRef(null);
  const alturaRef = useRef(null);
  const guiaRef = useRef(null);
  const cajaSeleccionadaRef = useRef(null);
  const estallidoRef = useRef(null);
  const destelloRef = useRef(null);
  const hojasRef = useRef(null);
  const [festejo, setFestejo] = useState(false);
  const temporizadores = useRef([]);
  const despues = (fn, ms) => {
    const id = setTimeout(fn, ms);
    temporizadores.current.push(id);
  };
  useEffect(() => () => temporizadores.current.forEach(clearTimeout), []);

  const altitudManual = useMemo(() => {
    const t = alturaTexto.trim();
    if (!t) return null;
    const n = Number(t.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) && n >= 0 && n <= 6000 ? Math.round(n) : null;
  }, [alturaTexto]);
  const altitud = altitudManual != null ? altitudManual : Number.isFinite(loc?.altitud) ? loc.altitud : null;
  const pisoInfo = altitud != null ? getPisoTermicoInfo(altitud) : piso ? PISO_TERMICO_INFO[piso] : null;
  const nombreCompai = compai ? AVATAR_NOMBRE[compai] : '';
  const nombrePila = nombre.trim().split(/\s+/)[0] || '';

  /* ── el mundo ─────────────────────────────────────────────────── */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return undefined;
    const motor = crearDescenso(cv, {
      reducirMovimiento: reducir,
      // `m` es el ancho visible del nivel de cámara actual (F[nivel] * zoom),
      // no una altitud real de la persona — por eso en "la Tierra" marca
      // ~15.930 km: es cuánto abarca la vista a ese zoom, no cuán alto está
      // nadie. El rótulo dice "de ancho" para no afirmar una altitud falsa.
      alAltura: (m) => {
        if (alturaRef.current) alturaRef.current.textContent = formatoAltura(m);
      },
      alLlegar: () => setViajando(false),
    });
    motorRef.current = motor;
    if (typeof window !== 'undefined') /** @type {Window & {__onbjMotor?: typeof motor}} */ (window).__onbjMotor = motor;
    motor.irAPaso(paso, { inmediato: true });
    return () => {
      motor.destruir();
      motorRef.current = null;
    };
    // El motor se crea una vez; el paso inicial se aplica aquí y los cambios en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = motorRef.current;
    if (!m) return;
    m.setDatos({
      punto: loc ? { lat: loc.lat, lng: loc.lng, nombre: loc.municipio || '' } : null,
      candidato: candidato ? { lat: candidato.lat, lng: candidato.lng, nombre: `¿${candidato.name}?` } : null,
      buscando: geo === 'buscando',
      altitud,
      piso: pisoInfo?.slug || piso,
      vereda: loc?.vereda || null,
      municipio: loc?.municipio || null,
      identidad,
      escala,
      invernadero: forma,
    });
  }, [loc, candidato, geo, altitud, pisoInfo, piso, identidad, escala, forma]);

  // El polígono DANE de la vereda y sus vecinas, si el municipio tiene dataset.
  useEffect(() => {
    const cod = loc?.municipio_codigo;
    if (!cod) {
      motorRef.current?.setDatos({ veredaGeo: null });
      return undefined;
    }
    let vivo = true;
    loadVeredasMunicipio(cod).then((data) => {
      if (!vivo || !data?.veredas) return;
      const suya = data.veredas.find((v) => v.codigo === loc.vereda_codigo);
      motorRef.current?.setDatos({
        veredaGeo: {
          suya: suya?.geometry || null,
          vecinas: data.veredas.filter((v) => v !== suya && v.geometry).map((v) => v.geometry),
        },
      });
    }).catch(() => {});
    return () => { vivo = false; };
  }, [loc?.municipio_codigo, loc?.vereda_codigo]);

  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) { primeraVez.current = false; return; }
    const m = motorRef.current;
    if (!m) return;
    const dur = m.irAPaso(paso);
    if (dur <= 0) setViajando(false);
  }, [paso]);

  useEffect(() => {
    if (!compai || extendido) return;
    guardarAvance({ paso, pasoId: PASOS[paso], compai, loc, piso, identidad, identidades, animales, cantidadesAnimales, sellos, escala, escalas, forma });
    guardarProgresoUnificado({
      step: PASOS[paso], compai, loc, piso, identidad, identidades, animales, cantidadesAnimales, sellos, escala, escalas, forma,
      personName: nombre,
    });
  }, [paso, compai, loc, piso, identidad, identidades, animales, cantidadesAnimales, sellos, escala, escalas, forma, nombre, extendido]);

  /* ── 1 · el compai sale de su caja ─────────────────────────────── */
  const confirmarCompai = (compaiElegido = seleccion) => {
    if (!compaiElegido) return;
    setSeleccion(compaiElegido);
    const caja = cajaSeleccionadaRef.current;
    const rect = caja?.querySelector('.onbj-caja-compai')?.getBoundingClientRect() || null;
    setAvatarType(compaiElegido);
    if (reducir || !caja) {
      setCompai(compaiElegido);
      setFase0('nombre');
      return;
    }
    caja.animate([{ transform: 'scale(1,1)' }, { transform: 'scale(1.14,.8)' }, { transform: 'scale(.96,1.06)' }, { transform: 'scale(1,1)' }], { duration: 320, easing: 'ease-out' });
    caja.querySelector('.onbj-caja-tapa')?.animate(
      [{ transform: 'translateY(-6px) rotate(-18deg)' }, { transform: 'translate(-70px,-190px) rotate(-230deg)', opacity: 0 }],
      { duration: 760, delay: 140, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
    );
    if (estallidoRef.current && rect) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const e = estallidoRef.current;
      e.style.left = `${cx}px`;
      e.style.top = `${cy}px`;
      e.animate([{ transform: 'translate(-50%,-50%) scale(.2) rotate(0deg)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.25) rotate(30deg)', opacity: 1, offset: 0.45 }, { transform: 'translate(-50%,-50%) scale(1.7) rotate(45deg)', opacity: 0 }], { duration: 900, delay: 160, easing: 'cubic-bezier(.1,.8,.3,1)' });
      const d = destelloRef.current;
      if (d) {
        d.style.setProperty('--dx', `${cx}px`);
        d.style.setProperty('--dy', `${cy}px`);
        d.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 950, delay: 150, easing: 'ease-out' });
      }
      const hojas = hojasRef.current ? Array.from(hojasRef.current.children) : [];
      hojas.forEach((h, i) => {
        const a = (i / hojas.length) * Math.PI * 2 + (i % 3) * 0.3;
        const r = 110 + (i % 4) * 45;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r * 0.8 - 90;
        h.style.left = `${cx}px`;
        h.style.top = `${cy}px`;
        h.animate(
          [
            { transform: 'translate(-50%,-50%) rotate(0deg) scale(.4)', opacity: 1 },
            { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${200 + i * 40}deg) scale(1)`, opacity: 1, offset: 0.55 },
            { transform: `translate(calc(-50% + ${x * 1.25}px), calc(-50% + ${y + 170}px)) rotate(${380 + i * 50}deg) scale(.9)`, opacity: 0 },
          ],
          { duration: 1300, delay: 180 + (i % 5) * 25, easing: 'cubic-bezier(.2,.7,.4,1)' },
        );
      });
    }
    setFestejo(true);
    despues(() => setFestejo(false), 2600);
    setCompai(compaiElegido);
    setLanzando(rect);
    despues(() => { setFase0('nombre'); setLanzando(null); }, 1150);
  };

  // FLIP: el guía nace en su sitio y viaja desde la caja con un salto.
  useLayoutEffect(() => {
    if (!lanzando || !guiaRef.current) return;
    const g = guiaRef.current;
    const r = g.getBoundingClientRect();
    const dx = lanzando.left + lanzando.width / 2 - (r.left + r.width / 2);
    const dy = lanzando.top + lanzando.height / 2 - (r.top + r.height / 2);
    const s = Math.max(0.3, lanzando.width / r.width);
    g.animate(
      [
        { transform: `translate(${dx}px,${dy}px) scale(${s})`, offset: 0 },
        { transform: `translate(${dx}px,${dy + 8}px) scale(${s * 1.25},${s * 0.8})`, offset: 0.14 },
        { transform: `translate(${dx * 0.5}px,${Math.min(dy, 0) * 0.5 - 170}px) scale(${(s + 1) * 0.5 * 0.9},${(s + 1) * 0.5 * 1.18}) rotate(-8deg)`, offset: 0.52 },
        { transform: 'translate(0,6px) scale(1.18,.84)', offset: 0.84 },
        { transform: 'translate(0,0) scale(1)', offset: 1 },
      ],
      { duration: 980, delay: 170, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'backwards' },
    );
  }, [lanzando]);

  const seguirConNombre = () => {
    const n = nombre.trim();
    if (n) saveProfile({ nombre: n });
    irA(1);
  };

  /* ── 2 · ubicación ─────────────────────────────────────────────── */
  const buscarTierra = () => {
    setAlturaTexto('');
    setCandidato(null);
    setGeo('buscando');
    pedirGeo({
      maximumAge: 0,
      onSuccess: async (pos) => {
        const { latitude, longitude, altitude, altitudeAccuracy, accuracy } = pos.coords;
        try {
          const r = await resolveUbicacion({
            lat: latitude,
            lng: longitude,
            altitudGps: isCoarseLocation(accuracy) ? null : (altitude ?? null),
            precisionAltitudGps: altitudeAccuracy ?? null,
            permitirAltitudCabecera: false,
          });
          setLoc({ ...r, accuracy: accuracy ?? null });
          setGeo('listo');
          setAMano(false);
        } catch (_) {
          setGeo('sin-gps');
          setAMano(true);
        }
      },
      onError: (tipo) => {
        setGeo(tipo === 'denied' ? 'negado' : 'sin-gps');
        setAMano(true);
      },
    });
  };

  const escogerMunicipio = async (m) => {
    setAlturaTexto('');
    setCandidato(null);
    setConsulta('');
    const base = {
      lat: m.lat,
      lng: m.lng,
      municipio: m.name,
      municipio_codigo: String(m.codigo),
      departamento: m.departamento,
      vereda: null,
      vereda_codigo: null,
      vereda_fuente: null,
      barrio: null,
      altitud: typeof m.altitud === 'number' ? m.altitud : null,
      altitud_fuente: typeof m.altitud === 'number' ? 'cabecera' : null,
      accuracy: null,
      veredaOptions: [],
    };
    setLoc(base);
    setGeo('listo');
    setAMano(false);
    const data = await loadVeredasMunicipio(m.codigo).catch(() => null);
    if (data?.veredas) {
      setLoc((prev) => (prev && prev.municipio_codigo === String(m.codigo)
        ? { ...prev, veredaOptions: data.veredas.map((v) => ({ codigo: v.codigo, nombre: v.nombre, nombre_dane: v.nombre_dane })) }
        : prev));
    }
  };

  const tocarMapa = (e) => {
    if (paso !== 1 || geo === 'buscando' || viajando) return;
    const g = motorRef.current?.geoEnPantalla(e.clientX, e.clientY);
    if (!g) return;
    const m = findNearestMunicipio(g.lat, g.lng);
    if (!m || m.distanciaKm > 90) return;
    setCandidato(m);
    setAMano(true);
  };

  const guardarUbicacion = (l, altitudCorregida) => {
    if (!l) return;
    const existing = getProfile();
    const efectiva = altitudCorregida != null ? altitudCorregida : l.altitud ?? null;
    const { finca_altitud, altitud_source } = resolveAltitudToSave({
      altitudSource: altitudCorregida != null ? 'manual' : 'derived',
      resolvedAltitudFuente: l.altitud_fuente ?? null,
      effectiveAltitud: efectiva,
      existingFincaAltitud: existing.finca_altitud,
      existingAltitudSource: existing.altitud_source,
    });
    const info = efectiva != null ? getPisoTermicoInfo(efectiva) : null;
    saveProfile({
      ubicacion_lat: l.lat,
      ubicacion_lng: l.lng,
      vereda: l.vereda || undefined,
      vereda_codigo: l.vereda_codigo || undefined,
      vereda_source: l.vereda_fuente || undefined,
      barrio: l.barrio || undefined,
      municipio: l.municipio || undefined,
      departamento: l.departamento || undefined,
      region: l.municipio ? [l.vereda, l.municipio, l.departamento].filter(Boolean).join(', ') : undefined,
      // C09 2026-10-31: ver la misma nota en LocationDetectedScreen.handleConfirm
      // — omitir estas claves cuando el coalesce dice "no toque" evita borrar
      // una altitud buena existente, y `altitud` se mantiene mirror de
      // `finca_altitud` para que nunca queden dos alturas contradictorias.
      ...(finca_altitud !== undefined ? {
        finca_altitud,
        altitud: Number(finca_altitud),
        altitud_source,
        piso_termico: info?.slug,
      } : {}),
      ubicacion_accuracy: l.accuracy != null ? Math.round(l.accuracy) : undefined,
    });
    try {
      window.dispatchEvent(new CustomEvent('chagra:location-updated', {
        detail: { vereda: l.vereda || null, municipio: l.municipio || null, departamento: l.departamento || null },
      }));
    } catch (_) {
      /* sin window */
    }
  };

  const bajarALaMontana = () => {
    if (!loc) return;
    guardarUbicacion(loc, null);
    irA(2);
  };

  /* ── 3 · vereda y piso ─────────────────────────────────────────── */
  const confirmarMontana = () => {
    guardarUbicacion(loc, altitudManual);
    if (altitud == null && piso) saveProfile({ piso_termico: piso });
    setCorrigiendo(null);
    irA(3);
  };

  /* ── 4 · qué hace ──────────────────────────────────────────────── */
  const elegirIdentidad = (id) => {
    if (SELECCION_MULTIPLE.includes(id)) {
      setIdentidades((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
      setIdentidad(id);
      return;
    }
    setIdentidad(id);
    setIdentidades([id]);
    const t = IDENTIDADES.find((x) => x.id === id);
    if (t) saveProfile(t.valores);
    if (id === 'urbano' || loc?.barrio) {
      setEscala('balcon');
      setEscalas(['balcon', 'jardin']);
      setEscalaPerfil('balcon');
    }
    despues(() => irA(id === 'aprendo' ? 7 : id === 'animales' ? 4 : 6), reducir ? 0 : 650);
  };

  /* ── 5 · tamaño ────────────────────────────────────────────────── */
  const elegirEscala = (id) => {
    if (identidades.length > 1 || identidades.some((x) => SELECCION_MULTIPLE.includes(x))) {
      const next = escalas.includes(id) ? escalas.filter((x) => x !== id) : [...escalas, id];
      setEscalas(next);
      setEscala(next[0] || null);
      return;
    }
    setEscala(id);
    const escalaPerfil = id === 'jardin' || id === 'mini_invernadero' ? 'balcon' : id;
    setEscalaPerfil(escalaPerfil);
    if (id === 'jardin') saveProfile({ escala: 'balcon', finca_tipo: 'terraza' });
    if (id === 'mini_invernadero') {
      setForma('casa_sombra');
      setInvernaderoPerfil({ tipo: 'casa_sombra' });
      saveProfile({ escala: 'balcon', finca_tipo: 'balcon', invernadero_tiene: 'si', invernadero_forma: 'casa_sombra' });
      despues(() => irA(7), reducir ? 0 : 750);
      return;
    }
    if (id === 'invernadero') return;
    despues(() => irA(7), reducir ? 0 : 750);
  };
  const cambiarIdentidadMultiple = (id) => {
    const next = identidades.includes(id) ? identidades.filter((x) => x !== id) : [...identidades, id];
    setIdentidades(next);
    setIdentidad(next[0] || null);
  };
  const cambiarEscalaMultiple = (id) => {
    const next = escalas.includes(id) ? escalas.filter((x) => x !== id) : [...escalas, id];
    setEscalas(next);
    setEscala(next[0] || null);
  };
  const escalasDisponibles = identidad === 'urbano' || Boolean(loc?.barrio)
    ? ESCALAS_CIUDAD
    : identidades.some((x) => SELECCION_MULTIPLE.includes(x))
      ? [
        ...(identidades.some((x) => ['cultivo', 'animales', 'frutales'].includes(x)) ? [ESCALAS.find((x) => x.id === 'finca')] : []),
        ...(identidades.includes('invernadero') ? [ESCALAS.find((x) => x.id === 'invernadero')] : []),
      ].filter(Boolean)
      : ESCALAS;
  const continuarTrabajo = () => {
    const elegidas = identidades.filter((id) => SELECCION_MULTIPLE.includes(id));
    if (elegidas.length) {
      const perfil = IDENTIDADES.find((x) => x.id === elegidas[0])?.valores;
      if (perfil) saveProfile({
        ...perfil,
        rol: elegidas.includes('restauro') ? 'restaurador' : elegidas.includes('cultivo') ? 'campesino' : elegidas.includes('animales') ? 'ganadero' : perfil.rol,
        ...(elegidas.includes('restauro') ? { objetivo: ['biodiversidad'] } : {}),
        identidades: elegidas,
      });
      setIdentidad(elegidas[0]);
      if (loc?.barrio) { setEscala('balcon'); setEscalas(['balcon', 'jardin']); }
      irA(elegidas.includes('animales') ? 4 : elegidas.some((x) => ['cultivo', 'frutales'].includes(x)) ? 5 : 6);
      return;
    }
    irA(identidad === 'aprendo' ? 7 : 6);
  };
  const siguienteTrasAnimales = () => {
    saveProfile({ animales, cantidades_animales: cantidadesAnimales });
    irA(identidades.some((x) => ['cultivo', 'frutales'].includes(x)) ? 5 : 6);
  };
  const guardarSellosYContinuar = () => {
    saveProfile({ sellos: sellos.filter((s) => s.id !== 'otro' || s.texto?.trim()).map((s) => ({ ...s, estado: 'declarado', ...(s.id === 'otro' ? { texto: s.texto.trim() } : {}) })) });
    irA(6);
  };
  const continuarEscala = () => {
    if (escalas.includes('mini_invernadero')) {
      setEscala('mini_invernadero');
      setForma('casa_sombra');
      setInvernaderoPerfil({ tipo: 'casa_sombra' });
      saveProfile({ escala: 'balcon', finca_tipo: 'balcon', invernadero_tiene: 'si', invernadero_forma: 'casa_sombra' });
      irA(7);
      return;
    }
    if (escalas.includes('invernadero')) {
      setEscala('invernadero');
      return;
    }
    const seleccion = escalas[0];
    if (seleccion) {
      setEscala(seleccion);
      setEscalaPerfil(seleccion === 'jardin' ? 'balcon' : seleccion);
      if (seleccion === 'jardin' || escalas.includes('jardin')) saveProfile({ escala: 'balcon', finca_tipo: 'terraza' });
      else if (seleccion === 'finca') saveProfile({ escala: 'finca', finca_tipo: 'rural' });
      else saveProfile({ escala: 'balcon', finca_tipo: 'balcon' });
    }
    irA(7);
  };
  const elegirForma = (id) => {
    setForma(id);
    setInvernaderoPerfil({ tipo: id });
    despues(() => irA(7), reducir ? 0 : 750);
  };

  /* ── 6 · listo: el compai aterriza en su tierra ────────────────── */
  useEffect(() => {
    if (paso !== 7 || viajando || aterrizado) return;
    if (motorRef.current?.estado().moviendo) return;
    const pos = motorRef.current?.aterrizajeEnPantalla();
    const g = guiaRef.current;
    if (!pos || !g) return;
    const r = g.getBoundingClientRect();
    const dx = pos.x - (r.left + r.width / 2);
    const dy = pos.y - r.bottom + 4;
    const s = 1.25;
    g.animate(
      [
        { transform: 'translate(0,0) scale(1)' },
        { transform: `translate(${dx * 0.5}px,${Math.min(dy, 0) - 90}px) scale(1.05,1.12)`, offset: 0.55 },
        { transform: `translate(${dx}px,${dy}px) scale(${s * 1.15},${s * 0.85})`, offset: 0.85 },
        { transform: `translate(${dx}px,${dy}px) scale(${s})` },
      ],
      { duration: reducir ? 1 : 900, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' },
    );
    setAterrizado(true);
  }, [paso, viajando, aterrizado, reducir]);

  const terminar = () => {
    saveProfile({
      animales,
      cantidades_animales: cantidadesAnimales,
      sellos,
      onboarding_tiempo_segundos: Math.round((Date.now() - inicioRef.current) / 1000),
      onboarding_version: 'descenso-v1',
    });
    markProfileDone();
    try { localStorage.removeItem(LLAVE_AVANCE); } catch (_) { /* nada */ }
    limpiarProgresoUnificado();
    const perfil = getProfile();
    const recorrido = onboardingExtendidoActivo()
      ? crearRecorridoExtendido({ identidades, animales, cantidadesAnimales, compai })
      : null;
    if (recorrido && onNavigate) {
      guardarRecorridoExtendido(recorrido);
      onNavigate('onboarding-extendido');
      return;
    }
    if (onComplete) onComplete(perfil);
    else if (onHome) onHome();
    else onNavigate?.('dashboard');
  };

  /**
   * Sale del recorrido sin terminarlo. No pide permisos ni borra el avance:
   * la persona lo retoma después desde «Ubicar mi finca» o el perfil.
   * @param {string|null} destino vista a abrir; null = el inicio.
   */
  const salirSinTerminar = (destino = null) => {
    const n = nombre.trim();
    if (n) saveProfile({ nombre: n });
    markProfileSkipped();
    if (destino && onNavigate) { onNavigate(destino); return; }
    if (onComplete) onComplete(getProfile());
    else if (onHome) onHome();
    else onNavigate?.('dashboard');
  };

  const atras = () => {
    if (paso === 0) {
      if (fase0 === 'nombre') { setFase0('elegir'); setCompai(null); setSeleccion(null); return; }
      (onClose || onBack)?.();
      return;
    }
    if (paso === 1 && aMano && geo !== 'listo') { setAMano(false); setCandidato(null); return; }
    if (paso === 7 && guiaRef.current) guiaRef.current.getAnimations().forEach((a) => a.cancel());
    setCorrigiendo(null);
    if (paso === 6) {
      if (identidades.includes('animales')) irA(4);
      else if (identidades.some((x) => ['cultivo', 'frutales'].includes(x))) irA(5);
      else irA(3);
      return;
    }
    if (paso === 5) {
      irA(identidades.includes('animales') ? 4 : 3);
      return;
    }
    irA(paso - 1);
  };

  /* ── lo que dice cada momento (lo mismo que lee «Escuchar») ───────
   * C06 (auditoría de producto, 2026-10-31): quien habla es SIEMPRE el compai
   * elegido, también en el paso de ubicación; antes ahí hablaba Angelita
   * aunque se hubiera elegido otro compai (p.ej. el jaguar), y volvía a
   * cambiar de voz en el paso siguiente. */
  const quienHabla = mayus(nombreCompai);
  const textoAngelita = `Para darle el clima de su tierra, necesito saber dónde queda. ${AVISO_PERMISO[plataforma]}`;
  let texto = '';
  if (paso === 0) {
    texto = fase0 === 'elegir'
      ? (seleccion ? `${mayus(AVATAR_NOMBRE[seleccion])}. ¿Bajamos juntos?` : 'Cada caja guarda un compai. Toque una.')
      : `¡Hola! Soy ${nombreCompai}. ¿Cómo le digo a usted?`;
  } else if (paso === 1) {
    if (geo === 'listo' && loc) texto = `${loc.altitud_fuente === 'cabecera' || loc.accuracy == null ? 'Listo' : '¡La encontré!'} ${[loc.municipio, loc.departamento].filter(Boolean).join(', ')}.`;
    else if (candidato) texto = `¿Su tierra queda en ${candidato.name}, ${candidato.departamento}?`;
    else if (geo === 'buscando') texto = 'Buscando su tierra…';
    else if (geo === 'negado') texto = 'No pasa nada. Toque su municipio en el mapa, o escríbalo aquí.';
    else if (geo === 'sin-gps') texto = 'No la pude encontrar. Toque su municipio en el mapa, o escríbalo aquí.';
    else if (aMano) texto = 'Toque su municipio en el mapa, o escríbalo aquí.';
    else texto = textoAngelita;
  } else if (paso === 2) {
    texto = pisoInfo
      ? `Esta es su montaña. Su tierra está en ${PISOS.find((p) => p.id === pisoInfo.slug)?.titulo.toLowerCase() || pisoInfo.label}. ¿Así es?`
      : 'Esta es su montaña. ¿Qué clima tiene su tierra?';
  } else if (paso === 3) {
    texto = 'Y usted, ¿qué hace en la tierra?';
  } else if (paso === 4) {
    texto = '¿Cuántos animales tiene? Así le acompaño mejor.';
  } else if (paso === 5) {
    texto = '¿Su finca tiene algún sello o certificación? Puede marcar varios.';
  } else if (paso === 6) {
    texto = escala === 'invernadero' ? '¿Cómo es su invernadero?' : '¿Qué tan grande es lo suyo?';
  } else {
    texto = `Ya llegamos${nombrePila ? `, ${nombrePila}` : ''}. Esta es su tierra.`;
  }
  if (viajando) {
    texto = subiendo ? 'Subiendo un poco…' : VIAJE[paso] || '…';
  }
  if (extendido?.texto) texto = extendido.texto;

  const escuchar = () => {
    decirConLatido(texto).catch(() => {});
  };

  const estadoGuia = extendido ? (extendido.current === 'close' ? 'contenta' : 'acompana') : festejo ? 'contenta' : viajando ? 'caminando' : paso === 1 && geo === 'buscando' ? 'pensando' : paso === 7 ? 'contenta' : 'acompana';
  const sugerencias = useMemo(() => buscarMunicipios(consulta), [consulta]);
  const veredasFiltradas = useMemo(
    () => (loc?.veredaOptions?.length ? filterVeredaOptions(loc.veredaOptions, consultaVereda).slice(0, 8) : []),
    [loc, consultaVereda],
  );

  return (
    <CompaiAvatarContext value={true}>
    <div className={`onbj ${reducir ? 'onbj-quieto' : ''}`} data-paso={extendido?.current || PASOS[paso]} data-testid="onbj">
      {!extendido && paso === 0 && fase0 === 'elegir' ? (
        <div className="onbj-arte-portada onba-root onba-arte" data-testid="onbj-seleccion-arte" data-paso="0">
          <div className="onba-escenario">
            <PaisajeArranque paso={0} altitud={null} ubicado={false} llego={false}
              caja={{ fondo: <div className={`onba-caja ${compai ? 'onba-caja--abre' : 'onba-caja--cerrada'}`}><CajaFondo abierta={Boolean(compai)} /></div> }} />
            {compai ? <div className="onba-actor onba-actor--compai onbj-arte-compai"><ChagraAgentAvatar especie={compai} size={96} estado="contenta" ariaLabel={`Su compai ${nombreCompai} sale de la caja`} /></div> : null}
            <FrenteDelSuelo paso={0}>
              <div className={`onba-caja ${compai ? 'onba-caja--abre' : 'onba-caja--cerrada'}`}><CajaFrente abierta={Boolean(compai)} nombre={compai ? AVATAR_NOMBRE[compai].replace(/^(el|la) /i, '').split(' ')[0].toUpperCase() : undefined} /></div>
            </FrenteDelSuelo>
            <p className="onba-globo onba-globo--caja" role="note" data-testid="onbj-globo-arte">
              {compai ? <b className="onba-globo-quien">{mayus(nombreCompai)}</b> : null}
              <span>{compai ? '¡Hola! Vamos juntos.' : 'Toque una caja y conozca a su compai.'}</span>
            </p>
          </div>
          <section className="onba-tarjeta onbj-arte-tarjeta" aria-label="Elija su compai">
            <h1 className="onba-titulo onbj-arte-titulo">Elija su compai</h1>
            <div className={`onba-compai-selector ${seleccion ? '' : 'onba-compai-selector--sin-elegir'}`} onClickCapture={(event) => { cajaSeleccionadaRef.current = event.target instanceof Element ? event.target.closest('button') : null; }}>
              <AgentAvatarSelector showIntro={false} onSelect={confirmarCompai} />
            </div>
          </section>
        </div>
      ) : null}
      <canvas ref={canvasRef} className="onbj-mundo" onClick={tocarMapa} aria-hidden="true" data-testid="onbj-mundo" />

      {paso >= 2 && !viajando ? <PaisajeHumboldt altitud={altitud} /> : null}

      <header className="onbj-hud">
        <div className="onbj-altura" aria-hidden="true">
          <span className="onbj-altura-flecha">↓</span>
          <span className="onbj-altura-cifra">
            <span ref={alturaRef} data-testid="onbj-altura" />
            <small className="onbj-altura-etq" data-testid="onbj-altura-etq">de ancho</small>
          </span>
        </div>
        <ol className="onbj-puntos" aria-label={extendido ? `Paso ${extendido.index + 1} de ${extendido.total}` : `Paso ${paso + 1} de ${PASOS.length}`} data-testid={extendido ? 'onbe-progreso' : undefined}>
          {(extendido ? extendido.pasos : PASOS).map((p, i) => (
            <li key={p} className={extendido ? (i < extendido.index ? 'hecho' : i === extendido.index ? 'ahora' : '') : (i < paso ? 'hecho' : i === paso ? 'ahora' : '')} />
          ))}
        </ol>
        <button type="button" className="onbj-escuchar" onClick={escuchar} aria-label="Escuchar en voz alta" data-testid="onbj-escuchar">
          <IconoTinta nombre="bocina" />
        </button>
      </header>

      {!extendido && paso === 0 && fase0 === 'elegir' ? (
        <div className="onbj-titulo">
          <h1>¿Quién baja con usted?</h1>
          <p>Va a bajar desde el cielo hasta su tierra.</p>
        </div>
      ) : null}

      <span ref={destelloRef} className="onbj-destello" aria-hidden="true" />
      <span ref={hojasRef} className="onbj-hojas" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, i) => <i key={i} className={`onbj-hoja h${i % 4}`} />)}
      </span>
      <span ref={estallidoRef} className="onbj-estallido" aria-hidden="true">
        <svg viewBox="-60 -60 120 120" width="340" height="340">
          {Array.from({ length: 12 }).map((_, i) => (
            <path key={i} d="M0 -18 L5 -56 L-5 -56 Z" fill={i % 2 ? '#f2c14e' : '#fff3c4'} stroke="#231d17" strokeWidth="2" transform={`rotate(${i * 30})`} />
          ))}
          <circle r="16" fill="#fff6dc" stroke="#231d17" strokeWidth="2.5" />
        </svg>
      </span>

      <div className="onbj-abajo">
        <div className="onbj-fila-guia">
          {compai ? (
            <div ref={guiaRef} className={`onbj-guia ${viajando ? 'viaja' : ''}`} data-compai={compai} data-testid="onbj-guia">
              <ChagraAgentAvatar especie={compai} size={112} estado={estadoGuia} ariaLabel={mayus(nombreCompai)} />
            </div>
          ) : null}
        </div>
        <section className={`onbj-panel ${viajando ? 'viajando' : ''}`} aria-label={extendido ? `Paso ${extendido.index + 1}: ${extendido.titulo}` : `Paso ${paso + 1}: ${PASOS[paso]}`} data-testid={extendido ? `onbe-paso-${extendido.current}` : `onbj-paso-${PASOS[paso]}`}>
          <Dice key={texto} texto={texto} quien={!extendido && paso === 0 && fase0 === 'elegir' ? null : quienHabla} reducir={reducir} />

          {extendido ? (
            <>
              <div className="onbe-contenido-descenso">{children}</div>
              <div className="onbj-acciones onbe-acciones-descenso">
                <button type="button" className="onbj-btn onbj-sec" onClick={extendido.onBack} data-testid="onbe-atras">Atrás</button>
                <button type="button" className="onbj-btn onbj-sec" onClick={extendido.onAhoraNo} data-testid="onbe-ahora-no" data-paso={extendido.current}>Ahora no</button>
              </div>
            </>
          ) : null}

          {paso === 0 && fase0 === 'nombre' ? (
            <form className="onbj-form" onSubmit={(e) => { e.preventDefault(); seguirConNombre(); }}>
              <input
                className="onbj-input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Su nombre (si quiere)"
                autoComplete="given-name"
                maxLength={40}
                aria-label="Su nombre, si quiere"
                data-testid="onbj-nombre"
              />
              <div className="onbj-acciones">
                <button type="button" className="onbj-btn onbj-sec" onClick={atras}>Atrás</button>
                <button type="submit" className="onbj-btn onbj-primario" data-testid="onbj-seguir-nombre">
                  {nombre.trim() ? `Soy ${nombre.trim().split(/\s+/)[0]}` : 'Seguir sin nombre'}
                </button>
              </div>
              <p className="onbj-atajos" data-testid="onbj-atajos">
                <span>¿Tiene afán?</span>
                <button type="button" className="onbj-enlace" onClick={() => salirSinTerminar('registro_unificado')} data-testid="onbj-atajo-anotar">Anotar algo ya</button>
                <button type="button" className="onbj-enlace" onClick={() => salirSinTerminar('agente')} data-testid="onbj-atajo-preguntar">Preguntar ya</button>
              </p>
            </form>
          ) : null}

          {!viajando && paso === 1 ? (
            <div className="onbj-ubicacion">
              {geo === 'listo' && loc ? (
                <>
                  <dl className="onbj-ubicacion-resumen" data-testid="onbj-ubicacion-resumen">
                    <div><dt>Departamento</dt><dd>{loc.departamento || 'Por confirmar'}</dd></div>
                    <div><dt>Municipio</dt><dd>{loc.municipio || 'Por confirmar'}</dd></div>
                    <div><dt>Vereda</dt><dd>{loc.vereda || 'Por confirmar'}</dd></div>
                    <div><dt>Piso térmico</dt><dd>{pisoInfo?.label || 'Por confirmar'}</dd></div>
                  </dl>
                  <div className="onbj-acciones">
                    <button type="button" className="onbj-btn onbj-sec" onClick={() => { setGeo('idle'); setLoc(null); setAMano(true); }} data-testid="onbj-no-es-ahi">No es ahí</button>
                    <button type="button" className="onbj-btn onbj-primario" onClick={bajarALaMontana} data-testid="onbj-bajar-alla">Bajar allá</button>
                  </div>
                </>
              ) : candidato ? (
                <div className="onbj-acciones">
                  <button type="button" className="onbj-btn onbj-sec" onClick={() => setCandidato(null)}>No</button>
                  <button type="button" className="onbj-btn onbj-primario" onClick={() => escogerMunicipio(candidato)} data-testid="onbj-si-candidato">Sí, ahí</button>
                </div>
              ) : aMano ? (
                <div className="onbj-buscar">
                  <input
                    className="onbj-input"
                    value={consulta}
                    onChange={(e) => setConsulta(e.target.value)}
                    placeholder="Escriba su municipio"
                    aria-label="Escriba su municipio"
                    autoComplete="off"
                    data-testid="onbj-municipio"
                  />
                  {sugerencias.length ? (
                    <ul className="onbj-lista" data-testid="onbj-sugerencias">
                      {sugerencias.map((m) => (
                        <li key={m.codigo}>
                          <button type="button" onClick={() => escogerMunicipio(m)}>
                            <b>{m.name}</b> <span>{m.departamento}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="onbj-acciones">
                    <button type="button" className="onbj-btn onbj-sec" onClick={buscarTierra} data-testid="onbj-reintentar-gps">Buscar otra vez</button>
                  </div>
                </div>
              ) : (
                <div className="onbj-acciones onbj-columna">
                  <button type="button" className="onbj-btn onbj-primario onbj-grande" onClick={buscarTierra} disabled={geo === 'buscando'} data-testid="onbj-buscar-tierra">
                    <span className="onbj-btn-icono"><IconoTinta nombre="pin" /></span>
                    {geo === 'buscando' ? 'Buscando…' : 'Buscar mi tierra'}
                  </button>
                  <button type="button" className="onbj-enlace" onClick={() => setAMano(true)} data-testid="onbj-a-mano">Prefiero escribir mi municipio</button>
                  {/* C07 (auditoría de producto, 2026-10-31): «Ahora no» salta SOLO este paso, igual
                      que «Saltar» en los demás — antes sacaba de todo el recorrido al tablero
                      sin avisar y sin preguntar vereda, trabajo, animales, sellos ni tamaño. */}
                  <button type="button" className="onbj-enlace onbj-ahora-no" onClick={() => irA(2)} data-testid="onbj-ahora-no">Ahora no</button>
                </div>
              )}
            </div>
          ) : null}

          {!viajando && paso === 2 ? (
            <div className="onbj-montana">
              <dl className="onbj-datos">
                <div>
                  <dt>Vereda</dt>
                  <dd>
                    {loc?.vereda || <span className="onbj-sin">Sin vereda</span>}
                    <button type="button" className="onbj-lapiz" onClick={() => setCorrigiendo(corrigiendo === 'vereda' ? null : 'vereda')} data-testid="onbj-corregir-vereda">Corregir</button>
                  </dd>
                </div>
                <div>
                  <dt>Altura</dt>
                  <dd>
                    {altitud != null ? `${altitud.toLocaleString('es-CO')} m` : <span className="onbj-sin">No sé</span>}
                    <button type="button" className="onbj-lapiz" onClick={() => setCorrigiendo(corrigiendo === 'altura' ? null : 'altura')} data-testid="onbj-corregir-altura">Corregir</button>
                  </dd>
                </div>
                <div>
                  <dt>Municipio</dt>
                  <dd>{[loc?.municipio, loc?.departamento].filter(Boolean).join(', ') || <span className="onbj-sin">Sin dato</span>}</dd>
                </div>
              </dl>
              {corrigiendo === 'vereda' ? (
                <div className="onbj-buscar">
                  <input
                    className="onbj-input"
                    value={consultaVereda}
                    onChange={(e) => setConsultaVereda(e.target.value)}
                    placeholder={loc?.veredaOptions?.length ? 'Busque su vereda' : 'Escriba su vereda'}
                    aria-label="Su vereda"
                    data-testid="onbj-vereda"
                  />
                  {veredasFiltradas.length ? (
                    <ul className="onbj-lista">
                      {veredasFiltradas.map((o) => (
                        <li key={o.codigo}>
                          <button type="button" onClick={() => { setLoc((p) => ({ ...p, vereda: o.nombre, vereda_codigo: o.codigo, vereda_fuente: 'picker_dane' })); setCorrigiendo(null); setConsultaVereda(''); }}>
                            <b>{o.nombre}</b>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : consultaVereda.trim() ? (
                    <button type="button" className="onbj-btn onbj-sec" onClick={() => { setLoc((p) => ({ ...p, vereda: consultaVereda.trim(), vereda_codigo: null, vereda_fuente: 'manual' })); setCorrigiendo(null); setConsultaVereda(''); }} data-testid="onbj-vereda-guardar">
                      Mi vereda es «{consultaVereda.trim()}»
                    </button>
                  ) : null}
                </div>
              ) : null}
              {corrigiendo === 'altura' ? (
                <input
                  className="onbj-input"
                  inputMode="numeric"
                  value={alturaTexto}
                  onChange={(e) => setAlturaTexto(e.target.value)}
                  placeholder="Metros sobre el mar, por ejemplo 2600"
                  aria-label="Altura en metros"
                  data-testid="onbj-altura-input"
                />
              ) : null}
              {altitud == null ? (
                <Tarjetas opciones={PISOS} valor={piso} onElegir={setPiso} testId="onbj-piso" />
              ) : null}
              <div className="onbj-acciones">
                <button type="button" className="onbj-btn onbj-sec" onClick={atras}>Atrás</button>
                <button type="button" className="onbj-btn onbj-sec" onClick={() => irA(3)} data-testid="onbj-saltar">Saltar</button>
                <button type="button" className="onbj-btn onbj-primario" onClick={confirmarMontana} data-testid="onbj-si-asi-es">Sí, así es</button>
              </div>
            </div>
          ) : null}

            {!viajando && paso === 3 ? (
            <>
              <TarjetasMultiples opciones={IDENTIDADES.filter((o) => SELECCION_MULTIPLE.includes(o.id))} valores={identidades} onCambiar={cambiarIdentidadMultiple} testId="onbj-trabajo" />
              <Tarjetas opciones={IDENTIDADES.filter((o) => !SELECCION_MULTIPLE.includes(o.id))} valor={identidad} onElegir={elegirIdentidad} testId="onbj-trabajo-otro" />
              <div className="onbj-acciones">
                <button type="button" className="onbj-btn onbj-sec" onClick={atras}>Atrás</button>
                <button type="button" className="onbj-btn onbj-sec" onClick={() => irA(7)} data-testid="onbj-saltar">Saltar</button>
                <button type="button" className="onbj-btn onbj-primario" onClick={continuarTrabajo} data-testid="onbj-trabajo-seguir">Siguiente</button>
              </div>
            </>
          ) : null}

          {!viajando && paso === 4 ? (
            <>
              <TarjetasMultiples opciones={ANIMALES} valores={animales} onCambiar={(id) => {
                const next = animales.includes(id) ? animales.filter((x) => x !== id) : [...animales, id];
                setAnimales(next);
                if (!next.includes(id)) setCantidadesAnimales((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
              }} testId="onbj-animales" />
              {animales.map((id) => (
                <div className="onbj-animal-cantidad" key={id}>
                  <p>{ANIMALES.find((a) => a.id === id)?.titulo}: ¿cuántos?</p>
                  <Tarjetas opciones={RANGOS_ANIMALES} valor={cantidadesAnimales[id] || null}
                    onElegir={(rango) => setCantidadesAnimales((prev) => ({ ...prev, [id]: rango }))}
                    testId={`onbj-cantidad-${id}`} />
                </div>
              ))}
              <div className="onbj-acciones">
                <button type="button" className="onbj-btn onbj-sec" onClick={atras}>Atrás</button>
                <button type="button" className="onbj-btn onbj-sec" onClick={siguienteTrasAnimales} data-testid="onbj-animales-saltar">Saltar</button>
                <button type="button" className="onbj-btn onbj-primario" onClick={siguienteTrasAnimales} data-testid="onbj-animales-seguir">Siguiente</button>
              </div>
            </>
          ) : null}

          {!viajando && paso === 5 ? (
            <>
              <section className="onbj-sello-detalle" aria-label="Esquemas y detalles de sellos">
                <fieldset>
                  <legend>Orgánico</legend>
                  {ESQUEMAS_ORGANICO.map((esquema) => {
                    const marcado = sellos.some((s) => s.id === 'organico' && s.esquema === esquema);
                    return <label key={esquema}>
                      <input type="checkbox" checked={marcado} data-testid={`onbj-sello-organico-${ESQUEMAS_ORGANICO.indexOf(esquema)}`}
                        onChange={() => setSellos((prev) => marcado
                          ? prev.filter((s) => !(s.id === 'organico' && s.esquema === esquema))
                          : [...prev, { id: 'organico', esquema, estado: 'declarado' }])} />
                      {esquema}
                    </label>;
                  })}
                </fieldset>
                {sellos.some((s) => s.id === 'otro') ? <label className="onbj-sello-otro">
                  ¿Cuál otro sello?
                  <input type="text" value={otroSello} maxLength={100} data-testid="onbj-sello-otro-texto"
                    onChange={(event) => { const texto = event.target.value; setOtroSello(texto); setSellos((prev) => prev.map((s) => s.id === 'otro' ? { ...s, texto } : s)); }} />
                  </label> : null}
              </section>
              <TarjetasMultiples opciones={SELLOS} valores={sellos.map((s) => s.id)} onCambiar={(id) => setSellos((prev) => prev.some((s) => s.id === id) ? prev.filter((s) => s.id !== id) : [...prev, { id, estado: 'declarado', ...(id === 'otro' && otroSello.trim() ? { texto: otroSello.trim() } : {}) }])} testId="onbj-sellos" />
              <div className="onbj-acciones">
                <button type="button" className="onbj-btn onbj-sec" onClick={atras}>Atrás</button>
                <button type="button" className="onbj-btn onbj-sec" onClick={guardarSellosYContinuar} data-testid="onbj-sellos-saltar">Saltar</button>
                <button type="button" className="onbj-btn onbj-primario" onClick={guardarSellosYContinuar} data-testid="onbj-sellos-seguir">Siguiente</button>
              </div>
            </>
          ) : null}

          {!viajando && paso === 6 ? (
            <>
              {escala === 'invernadero'
                ? <Tarjetas opciones={FORMAS} valor={forma} onElegir={elegirForma} testId="onbj-forma" />
                : (identidad === 'urbano' || Boolean(loc?.barrio) || identidades.some((x) => SELECCION_MULTIPLE.includes(x)))
                  ? <TarjetasMultiples opciones={escalasDisponibles} valores={escalas} onCambiar={cambiarEscalaMultiple} testId="onbj-tamano" />
                  : <Tarjetas opciones={ESCALAS} valor={escala} onElegir={elegirEscala} testId="onbj-tamano" />}
              <div className="onbj-acciones">
                <button type="button" className="onbj-btn onbj-sec" onClick={escala === 'invernadero' ? () => setEscala(null) : atras}>Atrás</button>
                <button type="button" className="onbj-btn onbj-sec" onClick={() => irA(7)} data-testid="onbj-saltar">Saltar</button>
                {(identidad === 'urbano' || Boolean(loc?.barrio) || identidades.some((x) => SELECCION_MULTIPLE.includes(x))) ? <button type="button" className="onbj-btn onbj-primario" onClick={continuarEscala} data-testid="onbj-tamano-seguir">Siguiente</button> : null}
              </div>
            </>
          ) : null}

          {!extendido && !viajando && paso === 7 ? (
            <>
              <p className="onbj-resumen" data-testid="onbj-resumen">
                {[loc?.vereda ? `Vereda ${loc.vereda}` : null, loc?.municipio, pisoInfo ? PISOS.find((p) => p.id === pisoInfo.slug)?.titulo : null].filter(Boolean).join(' · ')}
              </p>
              <div className="onbj-acciones">
                <button type="button" className="onbj-btn onbj-sec" onClick={atras}>Atrás</button>
                <button type="button" className="onbj-btn onbj-primario onbj-grande" onClick={terminar} data-testid="onbj-entrar">Entrar a mi finca</button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
    </CompaiAvatarContext>
  );
}

function clampPaso(p) {
  const n = Number(p);
  return Number.isFinite(n) ? Math.max(0, Math.min(7, Math.round(n))) : 0;
}
