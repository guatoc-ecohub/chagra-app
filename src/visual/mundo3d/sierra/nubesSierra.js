/*
 * nubesSierra — NUBES CON VOLUMEN para la vista global de la Sierra: cúmulos
 * de geometría (lóbulos de icosaedro fundidos en UNA malla) que la luz de la
 * escena ILUMINA de verdad —cara al sol cálida, panza y cara opuesta azul-gris
 * por el hemisferio—, en vez de billboards pintados.
 *
 * Traído del mundo costero (`valle:mundo-costero/costero.js`, «NUBES
 * low-poly»): allí siete cúmulos de 4-6 icosaedros achatados, Lambert, un solo
 * draw call. Dos cambios declarados:
 *  · normales SUAVES (detalle 2, normal = posición normalizada tras un ruido
 *    radial pequeño) en vez de `flatShading`: en el costero las nubes están a
 *    600-900 m del ojo y la faceta no se ve; aquí ocupan 60-250 px y se vería;
 *  · la BASE ES PLANA y es un DATO: la cota de condensación. Los vértices bajo
 *    la base se recortan a ella. la verdad produce la imagen — una nube
 *    tiene lomo por convección y base por la física del vapor.
 *
 * Dos poblaciones, dos causas (el climatólogo):
 *  1. CÚMULOS DE ALISIOS sobre el Caribe: los cúmulos de buen tiempo del
 *     alisio, base ~600-900 m, chicos, muchos, flotando sobre el mar hacia el
 *     macizo. El Niño los REDUCE y sube su base (subsidencia, menos vapor);
 *     La Niña los multiplica y los baja. Sale de `fase` (fuente única GR-9).
 *  2. NUBES OROGRÁFICAS en el bosque de niebla: la franja de condensación de
 *     `franjaCondensacion(fase, humedad)` —la MISMA que consume el descenso—,
 *     enganchadas delante del talud como antes, pero con cuerpo.
 *
 * Costo: geometría opaca. alto ≈ 15 nubes × 5 lóbulos × 320 tri ≈ 24 k tri;
 * medio ≈ 13 k; bajo (detalle 1) ≈ 2 k. UN draw call. Menos fill que los siete
 * billboards transparentes de antes. Proyectan sombra en tier alto (la sombra
 * de la nube sobre la ladera es la escala por comparación).
 * Nada de esto está certificado: el operador juzga.
 */
import * as THREE from 'three';
import { mulberry32 } from './sierraRelieve.js';
import { GLSL_BRUMA_ALTURA } from './aireSierra.js';

/** Cuenta y detalle por tier. */
export const NUBES_POR_TIER = {
  alto: { alisios: 11, orograficas: 6, interior: 14, lobulos: [6, 9], detalle: 2 },
  medio: { alisios: 7, orograficas: 4, interior: 8, lobulos: [5, 7], detalle: 2 },
  bajo: { alisios: 4, orograficas: 3, interior: 4, lobulos: [4, 5], detalle: 1 },
};

/** Efecto ENSO sobre los cúmulos de alisios: cuántos y a qué base (u de mundo). */
export const ALISIOS_POR_FASE = {
  neutral: { factor: 1.0, base: 0.62 },
  nino: { factor: 0.6, base: 0.78 },
  nina: { factor: 1.3, base: 0.52 },
};

/**
 * @typedef {object} Nube
 * @property {number} x
 * @property {number} y   base (cota de condensación), en u de mundo
 * @property {number} z
 * @property {number} ancho
 * @property {number} alto
 * @property {number} largo
 * @property {number} lobulos
 * @property {boolean} [torre]   torre de convección (lóbulos más altos que anchos)
 * @property {number} [amplitud]
 */

/**
 * Cúmulos de alisios sobre el mar (al norte de la costa), deterministas.
 * @returns {Array<Nube>}
 */
export function nubesAlisios({ cuantas, fase = 'neutral', semilla = 31, lobulos = [4, 6], costaZ = -3 }) {
  const f = ALISIOS_POR_FASE[fase] ?? ALISIOS_POR_FASE.neutral;
  const n = Math.max(2, Math.round(cuantas * f.factor));
  const r = mulberry32(semilla);
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = -10.5 + (21 * (i + 0.5)) / n + (r() - 0.5) * 1.8;   // repartidos a lo ancho, con jitter
    const z = costaZ - 0.8 - r() * 4.6;                         // mar adentro, a ≥ 4 u de la cámara
    const ancho = 0.45 + r() * 0.55;                            // 0,5-1,2 km: cúmulo de buen tiempo
    out.push({
      x, y: f.base + (r() - 0.5) * 0.08, z,
      ancho, alto: ancho * (0.30 + r() * 0.14), largo: ancho * (0.6 + r() * 0.3),
      lobulos: lobulos[0] + Math.floor(r() * (lobulos[1] - lobulos[0] + 1)),
    });
  }
  return out;
}

/**
 * Nubes orográficas delante del talud, en la cota de condensación.
 * @param {object} o
 * @param {number} o.cuantas
 * @param {{cota:number, sigma:number, amplitud:number}} o.franja  metros (franjaCondensacion)
 * @param {(x:number,z:number)=>number} o.alturaFn
 * @param {number} [o.metrosPorUnidad=1155]
 * @param {number} [o.costaZ=-3]
 * @param {number} [o.semilla=53]
 * @param {[number, number]} [o.lobulos=[4, 6]]
 * @returns {Array<Nube>}
 */
export function nubesOrograficas({ cuantas, franja, alturaFn, metrosPorUnidad = 1155, costaZ = -3, semilla = 53, lobulos = [4, 6] }) {
  const r = mulberry32(semilla);
  const cotaY = franja.cota / metrosPorUnidad;
  const sigmaY = (franja.sigma / metrosPorUnidad) * 0.6;
  const out = [];
  for (let i = 0; i < cuantas; i++) {
    const wx = -7 + (14 * (i + 0.5)) / cuantas + Math.sin(i * 2.3) * 0.7;
    const y = cotaY + (((i * 7) % 5) - 2) * 0.5 * sigmaY;
    let wz = costaZ + 1.2, mejor = 99;
    for (let z = costaZ + 0.5; z < 6; z += 0.25) {
      const d = Math.abs(alturaFn(wx, z) - y);
      if (d < mejor) { mejor = d; wz = z; }
    }
    const ancho = 0.9 + r() * 0.8;                              // 1-2 km: la nube del bosque de niebla
    out.push({
      x: wx, y, z: wz - 0.9,                                    // delante del talud, en el aire
      ancho, alto: ancho * (0.20 + r() * 0.10), largo: ancho * (0.45 + r() * 0.25),
      lobulos: lobulos[0] + Math.floor(r() * (lobulos[1] - lobulos[0] + 1)),
      amplitud: franja.amplitud,
    });
  }
  return out;
}

/**
 * Cúmulos de CONVECCIÓN VESPERTINA tierra adentro (detrás del macizo, sobre el
 * valle del Cesar y las llanuras): a media tarde el suelo caliente levanta
 * cúmulos con base más alta (~1 200-1 800 m: aire más seco) y torres más
 * grandes que los del alisio. Están LEJOS (z 13-32 u): la bruma por altura los
 * pone en perspectiva aérea sola, y son el fondo que le da al cielo sus planos.
 * El Niño (subsidencia) los reduce; La Niña los engorda.
 * @returns {Array<Nube>}
 */
export function nubesInterior({ cuantas, fase = 'neutral', semilla = 77, lobulos = [5, 8] }) {
  const f = ALISIOS_POR_FASE[fase] ?? ALISIOS_POR_FASE.neutral;
  const n = Math.max(2, Math.round(cuantas * f.factor));
  const r = mulberry32(semilla);
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = -19 + (38 * (i + 0.5)) / n + (r() - 0.5) * 2.5;
    const z = 17 + r() * 21;                                    // 17-38 u: lejos, en su bruma
    const ancho = 1.0 + r() * 1.2;                              // 1,2-2,5 km: torres de tarde
    out.push({
      x, y: 0.9 + r() * 0.4 + (f.base - 0.62) * 1.5, z,
      ancho, alto: ancho * (0.7 + r() * 0.4), largo: ancho * (0.6 + r() * 0.35),
      torre: true,
      lobulos: lobulos[0] + Math.floor(r() * (lobulos[1] - lobulos[0] + 1)),
    });
  }
  return out;
}

/* ruido radial determinista chico (rompe la esfera perfecta sin geometría extra) */
function bulto(x, y, z) {
  return Math.sin(x * 9.1 + y * 7.3) * 0.5 + Math.sin(y * 11.7 - z * 8.9 + 1.3) * 0.3 + Math.sin(z * 13.1 + x * 6.7 + 2.9) * 0.2;
}

/**
 * Funde todas las nubes en UNA geometría (position + normal), lista para un
 * `MeshLambertMaterial`. Base plana en `y` de cada nube.
 * @param {Array<Nube>} nubes
 * @param {{detalle?:number, semilla?:number}} [opts]
 */
export function geometriaCumulos(nubes, { detalle = 2, semilla = 7 } = {}) {
  const r = mulberry32(semilla);
  const pos = [], nor = [];
  const v = new THREE.Vector3();
  for (const nb of nubes) {
    const base = nb.y;
    for (let l = 0; l < nb.lobulos; l++) {
      const t = (l + 0.5) / nb.lobulos;
      // radio del lóbulo: los del centro más altos (torre), los extremos más bajos
      const centroT = 1 - Math.abs(t - 0.5) * 2;
      const rad = nb.alto * (0.42 + 0.40 * centroT) * (0.8 + r() * 0.4);
      // torres de convección: lóbulos más altos que anchos; alisios: achatados
      const sx = nb.torre ? 0.8 + r() * 0.3 : 1.05 + r() * 0.5;
      const sy = nb.torre ? 1.0 + r() * 0.35 : 0.7 + r() * 0.2;
      const sz = 0.9 + r() * 0.35;
      const cx = nb.x + (t - 0.5) * (nb.ancho - rad * sx) + (r() - 0.5) * 0.12 * nb.ancho;
      const cz = nb.z + (r() - 0.5) * Math.max(0, nb.largo - rad * sz);
      const cy = base + rad * sy * 0.92 + r() * 0.05 * nb.alto;  // apoyado en la base
      const g = new THREE.IcosahedronGeometry(rad, detalle);
      const p = g.getAttribute('position');
      for (let k = 0; k < p.count; k++) {
        v.set(p.getX(k), p.getY(k), p.getZ(k));
        const n = v.clone().normalize();
        const esc = 1 + 0.10 * bulto(n.x * 3 + cx, n.y * 3 + cy, n.z * 3 + cz);
        v.multiplyScalar(esc);
        v.x *= sx; v.y *= sy; v.z *= sz;
        let py = cy + v.y;
        let ny = n.y;
        if (py < base) { py = base; ny = -1; }                  // base plana: la cota de condensación
        pos.push(cx + v.x, py, cz + v.z);
        // normal aproximada: la de la esfera, corregida por el achatado
        const nn = new THREE.Vector3(n.x / sx, ny / sy, n.z / sz).normalize();
        nor.push(nn.x, nn.y, nn.z);
      }
      g.dispose();
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.computeBoundingSphere();
  return geo;
}

/** Trayectoria artística continua; no representa una velocidad meteorológica. */
export function avanceNube(nube, segundos, capa = 0) {
  const recorrido = nube.x + segundos * (0.18 + capa * 0.095);
  const x = ((recorrido + 24) % 48 + 48) % 48 - 24;
  return { x, z: nube.z + x * 0.12, entrada: Math.min(1, (24 - Math.abs(x)) / 4) };
}

/** Densidad y normal horneadas: tres variantes compartidas, sin ruido por fragmento. */
export function texturaRioNube(semilla = 77, tam = 256) {
  const r = mulberry32(semilla);
  const grid = new Float32Array(64 * 64);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = smooth(x - ix), fy = smooth(y - iy);
    const at = (a, b) => grid[((b % 64 + 64) % 64) * 64 + (a % 64 + 64) % 64];
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(ix, iy), at(ix + 1, iy), fx),
      THREE.MathUtils.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), fx), fy);
  };
  const field = new Float32Array(tam * tam);
  const cuerpos = Array.from({ length: 6 }, (_, i) => ({
    x: 0.18 + i * 0.125, y: 0.43 + r() * 0.15,
    rx: 0.13 + r() * 0.1, ry: 0.15 + r() * 0.14,
  }));
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    const u = x / (tam - 1), v = y / (tam - 1);
    const n = noise(u * 8, v * 8) * 0.52 + noise(u * 21, v * 21) * 0.28
      + noise(u * 53, v * 53) * 0.14 + noise(u * 117, v * 117) * 0.06;
    let masa = 0;
    for (const b of cuerpos) {
      const dx = (u - b.x) / b.rx, dy = (v - b.y) / b.ry;
      masa = Math.max(masa, Math.exp(-(dx * dx + dy * dy) * 1.6));
    }
    // Cizalla en el borde, con filamentos longitudinales y una panza continua.
    const jiron = noise(u * 13 + v * 9, v * 65) * 0.12;
    const d = Math.max(0, masa - 0.29 + (n - 0.5) * 0.72 + jiron);
    const borde = smooth(Math.min(1, Math.min(u, v, 1 - u, 1 - v) * 16));
    field[y * tam + x] = Math.min(1, d * 1.85) * borde;
  }
  const data = new Uint8Array(tam * tam * 4);
  const at = (x, y) => field[Math.max(0, Math.min(tam - 1, y)) * tam + Math.max(0, Math.min(tam - 1, x))];
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    const i = (y * tam + x) * 4;
    const nx = (at(x - 2, y) - at(x + 2, y)) * 3;
    const ny = (at(x, y - 2) - at(x, y + 2)) * 3;
    const inv = 1 / Math.hypot(nx, ny, 1);
    data[i] = Math.round((nx * inv * 0.5 + 0.5) * 255);
    data[i + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
    data[i + 2] = Math.round(at(x, y) * 255);
    data[i + 3] = Math.round(smooth(Math.min(1, at(x, y) * 3)) * 255);
  }
  const texture = new THREE.DataTexture(data, tam, tam, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Una lectura de textura: panza fría, relieve y transmisión orientados al sol. */
export function materialRioNube(textura, lluvia = false) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      mapa: { value: textura }, opacidad: { value: 0.85 },
      tiempo: { value: 0 }, velocidad: { value: 0.18 }, dia: { value: 1 },
      densidad: { value: 0 }, bruma: { value: new THREE.Color() },
      sol: { value: new THREE.Vector3(-0.65, 0.55, 0.52).normalize() },
      frio: { value: new THREE.Color(lluvia ? '#596b7b' : '#3c536b') },
      luz: { value: new THREE.Color(lluvia ? '#d6e2e6' : '#fff1d6') },
    },
    vertexShader: `
      attribute vec3 centro;
      uniform float tiempo, velocidad;
      uniform vec3 sol;
      varying vec2 vUv;
      varying vec3 vSol, vMundo;
      varying float vEntrada;
      void main() {
        vUv = uv;
        vSol = mat3(viewMatrix) * sol;
        vec3 p = centro;
        p.x = mod(centro.x + tiempo * velocidad + 24.0, 48.0) - 24.0;
        p.z += p.x * 0.12;
        vEntrada = min(1.0, (24.0 - abs(p.x)) / 4.0);
        vMundo = (modelMatrix * vec4(p, 1.0)).xyz;
        vec4 vista = viewMatrix * vec4(vMundo, 1.0);
        vista.xy += position.xy;
        gl_Position = projectionMatrix * vista;
      }`,
    fragmentShader: `
      uniform sampler2D mapa;
      uniform float opacidad;
      uniform vec3 frio;
      uniform vec3 luz;
      uniform float dia, densidad;
      uniform vec3 bruma;
      varying float vEntrada;
      varying vec3 vMundo;
      ${GLSL_BRUMA_ALTURA}
      varying vec2 vUv;
      varying vec3 vSol;
      void main() {
        vec4 d = texture2D(mapa, vUv);
        if (d.a < 0.012) discard;
        vec2 xy = d.rg * 2.0 - 1.0;
        vec3 normal = normalize(vec3(xy, sqrt(max(0.05, 1.0 - dot(xy, xy)))));
        float lambert = max(0.0, dot(normal, normalize(vSol)));
        float lomo = smoothstep(0.25, 0.8, vUv.y);
        float transmision = pow(max(0.0, -normalize(vSol).z), 3.0) * (1.0 - d.b);
        vec3 color = mix(frio, luz, clamp(0.04 + lomo * 0.68 + lambert * 0.13 + transmision * 0.5, 0.0, 1.0));
        color *= 1.0 - d.b * (1.0 - lomo) * 0.24;
        color *= 0.15 + 0.85 * dia;
        color = mix(color, bruma, brumaAltura(cameraPosition, vMundo, densidad, 1.5));
        gl_FragColor = vec4(color, d.a * opacidad * vEntrada * (0.62 + d.b * 0.38));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}


/** Un lote por capa. Dos triángulos por nube, sin mallas por lóbulo. */
export function geometriaRioNubes(nubes) {
  const pos = [], uv = [], centros = [];
  for (const n of nubes) {
    const ancho = n.ancho * 2.6;
    const alto = Math.max(n.alto * 2.8, n.ancho * 1.05);
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) {
      pos.push((u - 0.5) * ancho, (v - 0.5) * alto, 0);
      uv.push(u, v);
      centros.push(n.x, n.y + alto * 0.3, n.z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('centro', new THREE.Float32BufferAttribute(centros, 3));
  return geo;
}
