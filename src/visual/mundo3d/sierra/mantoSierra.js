import * as THREE from 'three';
import { BANDAS_SIERRA } from '../pisosTermicos.js';
import { NIEVE } from './nieveSierra.js';
import { ruido, smoothstep } from './sierraRelieve.js';

const colores = BANDAS_SIERRA.map((b, i) => new THREE.Color(
  i === BANDAS_SIERRA.length - 1 ? NIEVE.roca : b.hexColor,
));

// Cada transición se evalúa a ambos lados de su cota, sin saltar de intervalo.
// La perturbación solo viste el manto: no mueve relieve, cotas ni nieve.
export function colorManto(y, x, z, out) {
  const variacion = (ruido(x * 1.1, z * 1.1) * 0.10
    + ruido(x * 3.2 + 7, z * 3.2) * 0.035)
    * smoothstep(0.10, 0.4, y) * (1 - smoothstep(3.5, 4.0, y));
  out.copy(colores[0]);
  for (let i = 0; i < colores.length - 1; i++) {
    const borde = BANDAS_SIERRA[i].tope;
    const ancho = i === colores.length - 2 ? 0.02 : i === 0 ? 0.08 : 0.27;
    out.lerp(colores[i + 1], smoothstep(borde - ancho, borde + ancho, y + variacion));
  }
  return out;
}

// Detalle por fragmento: el faldón conserva su malla y comparte el grano
// con el terreno central. Las derivadas apagan las motas subpíxel a distancia.
export function inyectarGranoManto(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vManto;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvManto = position;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
varying vec3 vManto;
float mantoHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mantoNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mantoHash(i), mantoHash(i + vec2(1,0)), f.x),
    mix(mantoHash(i + vec2(0,1)), mantoHash(i + vec2(1,1)), f.x), f.y);
}`)
    .replace('#include <color_fragment>', `#include <color_fragment>
float tierra = smoothstep(0.10, 0.24, vManto.y) * (1.0 - smoothstep(1.35, 2.1, vManto.y));
vec2 pManto = vManto.xz * 19.0;
float resuelto = 1.0 - smoothstep(0.35, 1.2, length(fwidth(pManto)));
float mata = mantoNoise(mat2(0.8, -0.6, 0.6, 0.8) * pManto);
float claros = mantoNoise(vManto.xz * 3.7 + 8.0);
float dosel = smoothstep(0.28, 0.45, vManto.y) * (1.0 - smoothstep(0.85, 1.2, vManto.y));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.14, 0.19, 0.055), dosel * smoothstep(0.28, 0.72, claros) * 0.4);
diffuseColor.rgb *= 1.0 + tierra * ((claros - 0.5) * 0.20 + (mata - 0.5) * 0.35 * resuelto);
// Fracturas y grano mineral en el sustrato alto. La nieve se compone después.
float roca = smoothstep(3.25, 4.15, vManto.y);
vec2 veta = vManto.xz * 8.0 + vec2(vManto.y * 2.3, -vManto.y * 4.7);
float bloque = mantoNoise(veta) * 0.55 + mantoNoise(veta * 2.13 + 7.0) * 0.3
  + mantoNoise(veta * 4.31 - 3.0) * 0.15;
float junta = (1.0 - smoothstep(0.22, 0.43, bloque))
  * (1.0 - smoothstep(0.5, 1.4, length(fwidth(veta))));
float mineral = mantoNoise(vManto.xz * 47.0 + vManto.y * 13.0);
float granoVisible = 1.0 - smoothstep(0.3, 1.1, length(fwidth(vManto.xz * 47.0)));
vec3 piedra = diffuseColor.rgb * vec3(0.59, 0.64, 0.68);
piedra *= 0.62 + bloque * 0.68 - junta * 0.25 + (mineral - 0.5) * 0.22 * granoVisible;
diffuseColor.rgb = mix(diffuseColor.rgb, piedra, roca);
`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// Relieve mineral en la normal de iluminación, sin desplazar cotas ni malla.
float relieveMineral = roca * (bloque - junta * 0.25) * 0.065;
vec3 pasoX = dFdx(-vViewPosition), pasoY = dFdy(-vViewPosition);
vec3 tangenteX = cross(pasoY, normal), tangenteY = cross(normal, pasoX);
float orientacion = dot(pasoX, tangenteX);
vec3 gradiente = sign(orientacion) * (dFdx(relieveMineral) * tangenteX + dFdy(relieveMineral) * tangenteY);
normal = normalize(max(abs(orientacion), 0.000001) * normal - gradiente);
`);
}
