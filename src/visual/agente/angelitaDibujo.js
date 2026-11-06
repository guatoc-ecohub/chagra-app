/**
 * angelitaDibujo — qué dibujo, qué brazos y qué cara lleva Angelita según lo
 * que está haciendo. Puro: sin React ni DOM, para probarlo sin montar nada.
 *
 * Decisión del operador (2026-09-28): Angelita vive VOLANDO en horizontal
 * (lámina F3, `dibujo='volar'`). Se pone de pie para hablar, escuchar o
 * posarse, y de vez en cuando en el reposo: más o menos una de cada cuatro
 * excursiones. En reposo la cara es alegre (sonrisa ancha, ojos al usuario) y,
 * de pie, las manos descansan juntas: las palmas abiertas hacia arriba se
 * leían como «no sé» sostenido.
 *
 * @module visual/agente/angelitaDibujo
 */

/** Estados que van en crucero horizontal mientras ningún gesto pida estar de pie. */
export const ESTADOS_EN_VUELO = new Set(['acompana', 'guardia']);

/**
 * Momentos del reposo que se hacen DE PIE. Sus keyframes giran brazos o
 * cabeza desde la geometría del cuerpo erguido (hombro en -2.7,.4; cuello
 * abajo de la cabeza), o son el aterrizaje mismo. En crucero esos giros
 * sacarían los bracitos del cuerpo y le quitarían a la cabeza su sitio.
 */
export const MOMENTOS_DE_PIE = new Set([
  'acicala', 'rasca', 'estira', 'bosteza', 'rascanuca', 'cuenta', 'saluda',
  'gafas', 'ruana', 'mirausted', 'posa', 'posada', 'despega',
]);

/** Momentos que mueven los brazos: mientras duran, los brazos son los de la pose. */
export const MOMENTOS_CON_BRAZOS = new Set([
  'acicala', 'rasca', 'estira', 'bosteza', 'rascanuca', 'cuenta', 'saluda', 'gafas',
]);

/** Estados en los que, de pie, las manos descansan juntas. */
export const ESTADOS_BRAZOS_REPOSO = new Set(['acompana', 'escuchando', 'preocupada', 'husmea', 'asiente', 'marco', 'sin-senal']);

/** Estados con la cara alegre de la casa. Los demás actúan con la suya. */
export const ESTADOS_ALEGRES = new Set(['acompana', 'contenta', 'invita', 'husmea']);

/** Estados con la misma mirada alegre y la boca cerrada: escucha sin interrumpir. */
export const ESTADOS_ATENTOS = new Set(['escuchando', 'senala', 'asiente', 'marco', 'sin-senal']);

/** Momentos del reposo en los que la cara se abre con motivo (sorpresa, bostezo). */
export const MOMENTOS_CARA_ABIERTA = new Set(['asombro', 'bosteza']);

/** Cuota de excursiones del reposo que se hacen de pie (decisión del operador). */
export const CUOTA_DE_PIE = 0.25;

/** Estados con un dibujo de pie propio en la lámina (no el erguido de `decir`). */
export const DIBUJO_DE_ESTADO = Object.freeze({ esperando: 'esperar' });

/**
 * @param {string} estado  estado canónico
 * @param {string|null} [momento]  momento del idle en curso (solo acompana)
 * @returns {'volar'|'decir'|'esperar'}
 */
export function dibujoDeAngelita(estado, momento = null) {
  if (DIBUJO_DE_ESTADO[estado]) return DIBUJO_DE_ESTADO[estado];
  if (!ESTADOS_EN_VUELO.has(estado)) return 'decir';
  return momento && MOMENTOS_DE_PIE.has(momento) ? 'decir' : 'volar';
}

/**
 * @param {string} estado
 * @param {string|null} [momento]
 * @returns {'reposo'|'marco'|'saluda'|undefined}
 */
export function brazosDeAngelita(estado, momento = null) {
  if (estado === 'marco') return 'marco';
  if (estado === 'sin-senal') return 'saluda';
  if (!ESTADOS_BRAZOS_REPOSO.has(estado)) return undefined;
  return momento && MOMENTOS_CON_BRAZOS.has(momento) ? undefined : 'reposo';
}

/**
 * @param {string} estado
 * @param {{momento?:string|null, visema?:string|null}} [opts]
 * @returns {'alegre'|'atenta'|undefined}
 */
export function expresionDeAngelita(estado, { momento = null, visema = null } = {}) {
  if (visema) return undefined; // mientras habla manda la boca que se mueve
  if (ESTADOS_ATENTOS.has(estado)) return 'atenta';
  if (!ESTADOS_ALEGRES.has(estado)) return undefined;
  if (momento && MOMENTOS_CARA_ABIERTA.has(momento)) return undefined;
  return 'alegre';
}

/**
 * Elige el próximo gesto del reposo respetando la cuota de pie: primero se
 * tira la postura (de pie con `cuota`, en vuelo el resto) y luego se muestrea
 * el repertorio de siempre hasta que salga un gesto de esa postura. Así el
 * reparto entre gestos de una misma postura sigue siendo el del núcleo.
 * @param {() => (string|null)} elegir  el elector del núcleo, ya con su contexto
 * @param {{cuota?:number, rand?:() => number, intentos?:number}} [opts]
 * @returns {string|null}
 */
export function elegirConPostura(elegir, { cuota = CUOTA_DE_PIE, rand = Math.random, intentos = 16 } = {}) {
  const dePie = rand() < cuota;
  let primero = null;
  for (let i = 0; i < intentos; i += 1) {
    const gesto = elegir();
    if (!gesto) return primero;
    if (primero === null) primero = gesto;
    if (MOMENTOS_DE_PIE.has(gesto) === dePie) return gesto;
  }
  // Si el repertorio de ahora no tiene gestos de esa postura, no se inventa uno.
  return primero;
}
