import './compaiPunteria.css';

// Pivotes y extremos del dibujo existente, en coordenadas de cada articulación.
const ARTICULACIONES = {
  'oso-baston': { selector: '.crt-brazo-r', pivote: [5, -6.3], punta: [13.3, -1.65] },
  zariguya: { selector: '.crt-brazo-r', pivote: [1.4, -4.8], extremo: '.zc-antebrazo-r > g', punta: [0.97, 0.38] },
  // Extremo de la primera rémige: (2.5,95), translate(-42,56) rotate(18).
  guacamaya: { selector: '[id^="alaDer-"]', pivote: [0, 0], punta: [-68.9789869, 147.1229115] },
  luciernaga: { selector: '.luci-demo-brazoDer', pivote: [0, 0], extremo: '.luci-demo-tarso', punta: [33, 4] },
  'chivito-punk': { selector: '[id^="alaDer-"]', pivote: [0, 0], punta: [122, -58] },
};

/** Orienta las articulaciones existentes hacia un punto en coordenadas de pantalla. */
export function apuntarCompai(cuerpo, especie, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const rig = ARTICULACIONES[especie];
  if (rig) return apuntarArticulacion(cuerpo, rig, x, y);
  if (!['angelita', 'jaguar'].includes(especie)) return false;
  const brazo = cuerpo?.querySelector(especie === 'jaguar'
    ? '.jc-columna > g:nth-of-type(9) > .jc-pata' : especie === 'angelita' ? '.crt-brazo-r' : null);
  if (!brazo) return false;
  const padre = /** @type {SVGGraphicsElement} */ (brazo.parentNode);
  const matrix = padre.getScreenCTM?.();
  if (!matrix) return false;
  const local = new DOMPoint(x, y).matrixTransform(matrix.inverse());
  const grados = especie === 'jaguar'
    ? Math.atan2(local.y, local.x) * 180 / Math.PI - 90
    : Math.atan2(local.y - 0.4, local.x - 2.6) * 180 / Math.PI + 5.3;
  cuerpo.style.setProperty('--leccion-apunta', `${grados}deg`);
  return true;
}

function apuntarArticulacion(cuerpo, rig, x, y) {
  const brazo = cuerpo?.querySelector(rig.selector);
  const padre = brazo?.parentNode;
  const disponible = padre?.getScreenCTM?.();
  if (!disponible || !matrizInvertible(disponible)) return false;
  const extremo = rig.extremo ? brazo.querySelector(rig.extremo) : brazo;
  if (!extremo?.getScreenCTM?.()) return false;
  cuerpo.setAttribute('data-punteria-rig', '');
  brazo.setAttribute('data-punteria-articulacion', '');
  brazo.style.setProperty('--punteria-origen', `${rig.pivote[0]}px ${rig.pivote[1]}px`);
  brazo.style.setProperty('--punteria-angulo', '0deg');
  const matrix = padre.getScreenCTM();
  if (!matrix || !matrizInvertible(matrix)) return false;
  // Leer después de neutralizar el giro evita acumularlo en cada resize.
  const punta = new DOMPoint(...rig.punta).matrixTransform(extremo.getScreenCTM())
    .matrixTransform(matrix.inverse());
  const objetivo = new DOMPoint(x, y).matrixTransform(matrix.inverse());
  const [px, py] = rig.pivote;
  const grados = (Math.atan2(objetivo.y - py, objetivo.x - px)
    - Math.atan2(punta.y - py, punta.x - px)) * 180 / Math.PI;
  brazo.style.setProperty('--punteria-angulo', `${grados}deg`);
  return true;
}

function matrizInvertible(matrix) {
  const determinante = matrix.a * matrix.d - matrix.b * matrix.c;
  return Number.isFinite(determinante) && Math.abs(determinante) > 1e-12;
}
