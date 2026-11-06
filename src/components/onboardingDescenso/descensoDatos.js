/*
 * Datos y persistencia del onboarding-juego (separados del componente para
 * que el refresco en caliente de Vite no se rompa y las pruebas los usen).
 */
import { COLOMBIA_LOCATIONS } from '../../utils/colombiaLocations';
import { INVERNADERO_FORMAS } from '../../services/userProfileService';
import { leerProgresoUnificado } from '../onboardingState';

export const LLAVE_AVANCE = 'chagra:onb-juego:v1';

export const PASOS = ['compai', 'ubicacion', 'vereda', 'trabajo', 'animales', 'sellos', 'tamano', 'listo'];

/* Catálogo único de identidades compartido por las dos formas del onboarding. */
export const IDENTIDADES = [
  { id: 'cultivo', titulo: 'Cultivo comida', valores: { vocacion: 'campesino', rol: 'campesino', finca_tipo: 'rural' } },
  { id: 'animales', titulo: 'Tengo animales', valores: { vocacion: 'campesino', rol: 'ganadero', finca_tipo: 'rural' } },
  { id: 'restauro', titulo: 'Restauro la tierra', valores: { vocacion: 'campesino', rol: 'restaurador', finca_tipo: 'rural' } },
  { id: 'frutales', titulo: 'Tengo frutales', valores: { vocacion: 'campesino', rol: 'campesino', finca_tipo: 'rural' } },
  { id: 'invernadero', titulo: 'Cultivo en invernadero', valores: { vocacion: 'campesino', rol: 'campesino', finca_tipo: 'rural' } },
  { id: 'urbano', titulo: 'Cultivo en la ciudad', valores: { vocacion: 'urbano', rol: 'campesino', finca_tipo: 'balcon' } },
  { id: 'tecnico', titulo: 'Acompaño a otros', valores: { vocacion: 'tecnico', rol: 'tecnico', finca_tipo: 'rural' } },
  { id: 'aprendo', titulo: 'Aprendo o enseño con Chagra', valores: { vocacion: 'curioso', rol: 'socio' } },
];
export const SELECCION_MULTIPLE = ['cultivo', 'animales', 'restauro', 'frutales', 'invernadero'];
export const ESCALAS = [
  { id: 'balcon', titulo: 'Unas matas', copy: 'Balcón, patio o terraza' },
  { id: 'invernadero', titulo: 'Un invernadero', copy: 'Cultivo bajo techo' },
  { id: 'finca', titulo: 'Una finca', copy: 'Cultivo al aire libre' },
];
export const ESCALAS_CIUDAD = [
  { id: 'balcon', titulo: 'Materas o terraza' },
  { id: 'jardin', titulo: 'Jardín o patio' },
  { id: 'mini_invernadero', titulo: 'Invernadero pequeño o casa de malla' },
];
export const FORMAS = [
  { id: 'cuadrado', titulo: 'De dos aguas' },
  { id: 'tunel', titulo: 'Túnel' },
  { id: 'casa_sombra', titulo: 'Casa malla' },
].filter((f) => INVERNADERO_FORMAS.includes(f.id));
export const PISOS = [
  { id: 'cálido', titulo: 'Tierra caliente' },
  { id: 'templado', titulo: 'Tierra templada' },
  { id: 'frío', titulo: 'Tierra fría' },
  { id: 'páramo', titulo: 'Páramo' },
];
export const ANIMALES = [
  { id: 'gallinas', titulo: 'Gallinas o pollos' },
  { id: 'cerdos', titulo: 'Cerdos' },
  { id: 'ganado', titulo: 'Ganado (vacas)' },
  { id: 'ovejas_cabras', titulo: 'Ovejas o cabras' },
  { id: 'otros', titulo: 'Otros' },
];
export const RANGOS_ANIMALES = [
  { id: 'menos_10', titulo: 'Menos de 10' },
  { id: '10_50', titulo: 'De 10 a 50' },
  { id: '50_200', titulo: 'De 50 a 200' },
  { id: 'mas_200', titulo: 'Más de 200' },
];
export const ESQUEMAS_ORGANICO = ['USDA', 'JAS', 'Unión Europea', 'Colombia (Alimento Ecológico)'];
export const SELLOS = [
  { id: '4c', titulo: '4C' },
  { id: 'rainforest_comercio_justo', titulo: 'Rainforest Alliance o Comercio Justo' },
  { id: 'denominacion_origen_igp', titulo: 'Denominación de Origen o Indicación Geográfica Protegida' },
  { id: 'bpa_ica', titulo: 'BPA (ICA)' },
  { id: 'otro', titulo: 'Otro' },
];

/* Todos los municipios DANE, para escribir el propio. */
const MUNICIPIOS = (() => {
  const out = [];
  for (const [dpto, munis] of Object.entries(COLOMBIA_LOCATIONS)) for (const m of munis) out.push({ ...m, departamento: dpto });
  return out;
})();
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function buscarMunicipios(q, max = 6) {
  const n = norm(q);
  if (n.length < 2) return [];
  const empieza = [];
  const contiene = [];
  for (const m of MUNICIPIOS) {
    const nm = norm(m.name);
    if (nm.startsWith(n)) empieza.push(m);
    else if (nm.includes(n)) contiene.push(m);
    if (empieza.length >= max) break;
  }
  return [...empieza, ...contiene].slice(0, max);
}

export function leerAvance() {
  try {
    const raw = localStorage.getItem(LLAVE_AVANCE);
    const a = raw ? JSON.parse(raw) : null;
    const unificado = leerProgresoUnificado();
    const avance = a && typeof a === 'object'
      ? {
        ...a,
        paso: typeof a.pasoId === 'string'
          ? Math.max(0, PASOS.indexOf(a.pasoId))
          : a.paso === 4 ? 6 : a.paso === 5 ? 7 : a.paso,
      }
      : null;
    if (!Object.keys(unificado).length) return avance;
    const compaiGuardado = unificado.compai === 'elegido'
      ? (localStorage.getItem('chagra:agent-avatar-type') || localStorage.getItem('compai:companero'))
      : unificado.compai;
    return {
      ...(avance || {}),
      paso: Math.max(0, PASOS.indexOf(unificado.step)),
      compai: compaiGuardado || a?.compai || null,
      loc: unificado.loc ?? a?.loc ?? null,
      identidad: unificado.identidad ?? a?.identidad ?? null,
      escala: unificado.escala ?? a?.escala ?? null,
      forma: unificado.forma ?? a?.forma ?? null,
      piso: unificado.piso ?? a?.piso ?? null,
    };
  } catch (_) {
    return null;
  }
}
export function guardarAvance(a) {
  try {
    localStorage.setItem(LLAVE_AVANCE, JSON.stringify(a));
  } catch (_) {
    /* modo privado: el avance no se guarda, el flujo sigue */
  }
}
