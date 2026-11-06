export const ONBOARDING_EXTENDIDO_KEY = 'chagra:onboarding-extendido:v1';
export const ONBOARDING_EXTENDIDO_EVENT = 'chagra:onboarding-extendido:cambio';

const IDENTIDADES_PLANTA = new Set(['cultivo', 'frutales', 'invernadero', 'urbano', 'restauro']);
const ESPECIES_ANIMAL = {
  gallinas: 'Gallinas o pollos',
  cerdos: 'Cerdos',
  ganado: 'Ganado (vacas)',
  ovejas_cabras: 'Ovejas o cabras',
  otros: 'Otros',
};
const CANTIDAD_POR_RANGO = {
  menos_10: 5,
  '10_50': 30,
  '50_200': 125,
  mas_200: 201,
};

export function cantidadDesdeRango(rango) {
  return CANTIDAD_POR_RANGO[rango] || '';
}

export function crearRecorridoExtendido({
  identidades = [],
  animales = [],
  cantidadesAnimales = {},
  compai = null,
} = {}) {
  const confirmadas = new Set(Array.isArray(identidades) ? identidades : []);
  const animalId = confirmadas.has('animales') ? animales.find((id) => ESPECIES_ANIMAL[id]) : null;
  const animal = confirmadas.has('animales')
    ? {
      name: animalId ? `Primer lote de ${ESPECIES_ANIMAL[animalId].toLowerCase()}` : 'Mi primer lote',
      species: animalId ? ESPECIES_ANIMAL[animalId] : '',
      count: cantidadDesdeRango(animalId ? cantidadesAnimales[animalId] : ''),
      housing: '',
    }
    : null;
  const planta = Array.from(confirmadas).some((id) => IDENTIDADES_PLANTA.has(id));
  if (!animal && !planta) return null;
  return {
    version: 1,
    compai,
    current: 'offer',
    deferred: false,
    pasos: { animal: Boolean(animal), planta },
    animal,
    planta: planta ? { status: 'pending' } : null,
  };
}

export function leerRecorridoExtendido() {
  try {
    const raw = localStorage.getItem(ONBOARDING_EXTENDIDO_KEY);
    const value = raw ? JSON.parse(raw) : null;
    if (value?.version !== 1 || !['offer', 'animal', 'planta', 'close'].includes(value.current)) return null;
    return value;
  } catch (_) {
    return null;
  }
}

export function guardarRecorridoExtendido(value) {
  try {
    localStorage.setItem(ONBOARDING_EXTENDIDO_KEY, JSON.stringify(value));
    window.dispatchEvent(new Event(ONBOARDING_EXTENDIDO_EVENT));
    return true;
  } catch (_) {
    return false;
  }
}

export function iniciarRecorridoExtendido() {
  const recorrido = leerRecorridoExtendido();
  if (!recorrido) return null;
  const current = recorrido.animal ? 'animal' : recorrido.planta ? 'planta' : recorrido.current === 'close' ? 'close' : 'offer';
  const next = { ...recorrido, current, deferred: false };
  guardarRecorridoExtendido(next);
  return next;
}

export function posponerRecorridoExtendido() {
  const recorrido = leerRecorridoExtendido();
  if (!recorrido) return null;
  const next = { ...recorrido, deferred: true };
  guardarRecorridoExtendido(next);
  return next;
}

export function completarPasoExtendido(step, { keepOpen = false } = {}) {
  const recorrido = leerRecorridoExtendido();
  if (!recorrido || !['animal', 'planta'].includes(step)) return null;
  const next = { ...recorrido, [step]: null };
  if (next.animal) next.current = 'animal';
  else if (next.planta) next.current = 'planta';
  else if (keepOpen) next.current = 'close';
  else {
    limpiarRecorridoExtendido();
    return null;
  }
  guardarRecorridoExtendido(next);
  return next;
}

export function cambiarPasoExtendido(step) {
  const recorrido = leerRecorridoExtendido();
  if (!recorrido || !['offer', 'animal', 'planta', 'close'].includes(step)) return null;
  const next = { ...recorrido, current: step };
  guardarRecorridoExtendido(next);
  return next;
}

export function limpiarRecorridoExtendido() {
  try {
    localStorage.removeItem(ONBOARDING_EXTENDIDO_KEY);
    window.dispatchEvent(new Event(ONBOARDING_EXTENDIDO_EVENT));
  } catch (_) {
    // El cierre visual del recorrido no depende de que localStorage esté disponible.
  }
}
