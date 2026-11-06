import * as THREE from 'three';
import { perfilClimaSierra } from './climaSierra.js';
import { atmosferaLinealSierra, radianciaParaPantalla, BRUMA_SIERRA, GLSL_BRUMA_ALTURA } from './aireSierra.js';
import { ATMOSFERA_SIERRA } from './luzSierra.js';

// Interpretación visual, no pronóstico ni observación meteorológica del macizo.
/**
 * @typedef {Object} EstadoLuzHora
 * @property {[number, number, number]} sol
 * @property {number} fuerza
 * @property {number} [luna]
 * @property {string} [colorLuz]
 * @property {string|THREE.Color} cielo
 * @property {string|THREE.Color} horizonte
 * @property {number} [brilloTerreno]
 */
/** @type {Record<string, EstadoLuzHora>} */
const HORAS = {
  amanecer: { sol: [12, 2, -6], fuerza: 0.65, cielo: '#829bb8', horizonte: '#dfbb9e' },
  dia: { sol: [-5, 14, -6], fuerza: 1, cielo: '#709fca', horizonte: '#bccdd5' },
  atardecer: { sol: [-13, 4.4, -6], fuerza: 0.8, cielo: '#819aaf', horizonte: '#d8b998' },
  // La luna no reanima el sol: aporta una direccional fría y baja, suficiente
  // para separar relieve, nieve y agua sin convertir la noche en otro día.
  noche: { sol: [8, 5, 10], fuerza: 0, luna: 0.24, colorLuz: '#789bd8', cielo: '#101d32', horizonte: '#283c50' },
};

/** @type {EstadoLuzHora} */
const HORA_SIN_DATO = {
  sol: [-5, 8, -6], fuerza: 0.48, cielo: '#718087', horizonte: '#8b928c',
  colorLuz: '#b6b7aa', brilloTerreno: 0.52,
};

/** @type {Array<[number, string]>} */
const HORA_SIERRA = [
  [0, 'noche'], [5.5, 'noche'], [6, 'amanecer'], [7, 'dia'],
  [17, 'dia'], [17.5, 'atardecer'], [18.75, 'atardecer'], [19.25, 'noche'], [24, 'noche'],
];

/** @param {number} hora */
const clampHora = (hora) => ((hora % 24) + 24) % 24;

/** @param {number} hora */
export function luzSierraDesdeHora(hora) {
  const h = clampHora(hora);
  for (let i = 1; i < HORA_SIERRA.length; i += 1) {
    const [hasta, nombre] = HORA_SIERRA[i];
    if (h <= hasta) return nombre;
  }
  return 'noche';
}

/** @param {number} a @param {number} b @param {number} t */
function interpolar(a, b, t) {
  return a + (b - a) * t;
}

/** @param {{hora?: number, luz?: string}|null} clima */
function horaVisual(clima) {
  if (!Number.isFinite(clima?.hora)) return HORAS[clima?.luz] ?? HORAS.atardecer;
  const h = clampHora(clima.hora);
  let izquierda = HORA_SIERRA[0];
  let derecha = HORA_SIERRA[1];
  for (let i = 1; i < HORA_SIERRA.length; i += 1) {
    if (h <= HORA_SIERRA[i][0]) { derecha = HORA_SIERRA[i]; izquierda = HORA_SIERRA[i - 1]; break; }
  }
  const inicio = izquierda[0], fin = derecha[0];
  const t = fin === inicio ? 0 : (h - inicio) / (fin - inicio);
  const a = HORAS[izquierda[1]], b = HORAS[derecha[1]];
  const color = (clave) => new THREE.Color(a[clave]).lerp(new THREE.Color(b[clave]), t);
  /** @type {[number, number, number]} */
  const sol = [
    interpolar(a.sol[0], b.sol[0], t),
    interpolar(a.sol[1], b.sol[1], t),
    interpolar(a.sol[2], b.sol[2], t),
  ];
  const fuerza = interpolar(a.fuerza, b.fuerza, t);
  const luna = interpolar(a.luna ?? 0, b.luna ?? 0, t);
  return {
    sol, fuerza, luna: luna > 0.001 ? luna : undefined,
    cielo: color('cielo'), horizonte: color('horizonte'),
    colorLuz: a.colorLuz || b.colorLuz || ATMOSFERA_SIERRA.luz,
    brilloTerreno: interpolar(a.luna ? 0.22 : 0.78, b.luna ? 0.22 : 0.78, t),
  };
}

export function estadoAtmosferaSierra(clima = null, preset = null) {
  const perfil = perfilClimaSierra(clima);
  /** @type {EstadoLuzHora} */
  const hora = preset ? {
    sol: [preset.solPos[0], preset.solPos[1], preset.solPos[2]],
    fuerza: preset.sol,
    luna: preset.sol === 0 ? 0.24 : undefined,
    colorLuz: preset.luz,
    cielo: preset.cielo,
    horizonte: preset.fondo,
    brilloTerreno: Math.max(0.22, 0.22 + (0.56 * preset.sol)),
  } : perfil.estadoDato === 'sin-dato' && !perfil.senal ? HORA_SIN_DATO : horaVisual(clima);
  const atm = atmosferaLinealSierra();
  if (preset) {
    atm.dirSol.fromArray(preset.solPos).normalize();
    atm.cenit.copy(radianciaParaPantalla(preset.cielo));
    atm.horizonte.copy(radianciaParaPantalla(preset.fondo));
    atm.colorSol.copy(new THREE.Color(preset.luz)).multiplyScalar(2.2 * preset.sol * preset.intensidad);
    atm.ambiente.copy(new THREE.Color(preset.cielo)).multiplyScalar(0.62 * preset.intensidad);
  }
  const gris = new THREE.Color('#899ca8');
  atm.dirSol.fromArray(hora.sol).normalize();
  if (!preset) {
    atm.cenit.set(hora.cielo).lerp(gris, perfil.cobertura * 0.65);
    atm.horizonte.set(hora.horizonte).lerp(gris, perfil.cobertura * 0.7);
  }
  const dia = preset ? preset.sol * preset.intensidad : hora.fuerza;
  if (!preset) {
    atm.colorSol.set('#fff0db').multiplyScalar(2.2 * dia * perfil.luzIntensidad);
    atm.ambiente.copy(atm.cenit).multiplyScalar(0.62);
  }
  const fuerzaDireccional = hora.luna ?? dia;
  if (hora.luna && !preset) {
    // Cielo y mar reciben la misma fuente de color lunar.
    atm.colorSol.set('#001f66').multiplyScalar(2.2 * hora.luna * perfil.luzIntensidad);
    atm.ambiente.copy(atm.cenit).multiplyScalar(0.34);
  }
  return { ...perfil, atm, sol: hora.sol, dia, luna: hora.luna ?? null, fuerzaDireccional, brilloTerreno: hora.brilloTerreno ?? (hora.luna ? 0.22 : 1), colorLuz: hora.colorLuz ?? ATMOSFERA_SIERRA.luz,
    densidad: BRUMA_SIERRA.densidad * (1 + perfil.cobertura * 0.8 + perfil.intensidadNiebla * 1.2),
    alturaEscala: BRUMA_SIERRA.alturaEscala,
  };
}

// Uniformes por instancia: cambiar la hora no recompila ni reconstruye el terreno.
export function crearAireVivo() {
  const uniforms = {
    uSierraDensidad: { value: BRUMA_SIERRA.densidad },
    uSierraBruma: { value: new THREE.Color(BRUMA_SIERRA.color) },
    uSierraDia: { value: 1 },
    uSierraLuna: { value: 0 },
    uSierraTerreno: { value: 1 },
  };
  const inyectar = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAireSierra;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAireSierra = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vAireSierra;
uniform float uSierraDensidad, uSierraDia, uSierraLuna, uSierraTerreno;
uniform vec3 uSierraBruma;
${GLSL_BRUMA_ALTURA}`)
      .replace('#include <fog_fragment>', `
float aire = brumaAltura(cameraPosition, vAireSierra, uSierraDensidad, 1.5);
gl_FragColor.rgb *= uSierraTerreno;
gl_FragColor.rgb = mix(gl_FragColor.rgb, uSierraBruma, aire);`);
    // El casquete conserva brillo propio bajo la luna, sin cambiar el día.
    shader.fragmentShader = shader.fragmentShader.replace('vNieve.rgb,', 'vNieve.rgb * (0.18 + 0.82 * uSierraDia) + vNieve.rgb * (0.82 * (1.0 - uSierraDia) * uSierraLuna),');
  };
  const actualizar = (estado) => {
    uniforms.uSierraDensidad.value = estado.densidad;
    uniforms.uSierraBruma.value.copy(estado.atm.horizonte).convertLinearToSRGB();
    uniforms.uSierraDia.value = estado.dia;
    uniforms.uSierraLuna.value = estado.luna ?? 0;
    uniforms.uSierraTerreno.value = estado.brilloTerreno;
  };
  return { uniforms, inyectar, actualizar };
}
