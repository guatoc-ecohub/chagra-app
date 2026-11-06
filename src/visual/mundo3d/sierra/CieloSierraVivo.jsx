import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/*
 * El firmamento es una capa visual, no una fuente de iluminación. La escena
 * conserva sus luces y el mar sigue leyendo cieloAprox() en su propio shader.
 * La técnica viene del cielo procedural de Frailejón: nubes por ruido en una
 * esfera y estrellas deterministas con respiración senoidal por estrella.
 */
const CIELO_VERTEX = /* glsl */`
  varying vec3 vDireccionCielo;
  void main() {
    vDireccionCielo = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w;
  }
`;

const CIELO_FRAGMENT = /* glsl */`
  uniform float uNoche;
  uniform float uTiempo;
  uniform float uSemilla;
  varying vec3 vDireccionCielo;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float ruido(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  float nubes(vec2 p) {
    return ruido(p) * 0.50 + ruido(p * 2.1) * 0.25
      + ruido(p * 4.3) * 0.125 + ruido(p * 8.7) * 0.0625;
  }

  vec3 estrellas(vec3 direccion, float escala, float umbral, float fase) {
    vec2 uv = vec2(atan(direccion.z, direccion.x),
      asin(clamp(direccion.y, -1.0, 1.0))) * escala;
    vec2 celda = floor(uv);
    vec2 f = fract(uv);
    float clave = hash(celda + uSemilla + fase);
    vec2 centro = vec2(0.3 + 0.4 * hash(celda + 7.1),
      0.3 + 0.4 * hash(celda + 19.3));
    float tamano = mix(0.065, 0.27, pow(clave, 5.0));
    float radio = length(f - centro) / tamano;
    float punto = exp(-radio * radio * 5.0) + exp(-radio * radio * 0.7) * 0.08;
    float brillo = mix(0.055, 1.4, pow(hash(celda + 31.7), 3.0));
    // El mínimo queda por encima del umbral visual después de la conversión
    // de color y el tone mapping. El pulso sigue siendo sutil, pero una estrella
    // no puede desaparecer por completo entre dos capturas.
    float parpadeo = 0.92 + 0.08 * sin(uTiempo * (0.22 + 0.32 * hash(celda + 9.3)) + clave * 40.0);
    vec3 color = mix(vec3(0.48, 0.64, 0.95), vec3(0.95, 0.83, 0.67), hash(celda + 4.0));
    return color * punto * brillo * parpadeo * 2.2 * step(umbral, clave);
  }

  void main() {
    vec3 direccion = normalize(vDireccionCielo);
    vec2 proyeccion = direccion.xz / max(0.18, direccion.y + 0.35) * 2.0;
    float nube = nubes(proyeccion);
    vec3 dia = mix(vec3(0.20, 0.31, 0.39), vec3(0.08, 0.18, 0.27), max(0.0, direccion.y));
    dia = mix(dia, vec3(0.48, 0.58, 0.61), smoothstep(0.34, 0.71, nube) * 0.8);
    float resplandor = pow(max(0.0, dot(direccion, normalize(vec3(-0.5, 0.4, 0.3)))), 12.0);
    dia += vec3(0.20, 0.24, 0.25) * resplandor;

    float aire = smoothstep(0.035, 0.55, direccion.y);
    vec3 noche = mix(vec3(0.045, 0.085, 0.12), vec3(0.005, 0.011, 0.028), smoothstep(0.0, 0.7, direccion.y));
    noche += aire * (estrellas(direccion, 150.0, 0.88, 0.0)
      + estrellas(direccion, 310.0, 0.95, 43.0) * 0.45
      + estrellas(direccion, 63.0, 0.965, 91.0) * 1.6);

    gl_FragColor = vec4(mix(dia, noche, uNoche), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function crearCieloFondo(seed = 20260908) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uNoche: { value: 0 },
      uTiempo: { value: 0 },
      uSemilla: { value: ((seed % 65521) + 65521) % 65521 },
    },
    vertexShader: CIELO_VERTEX,
    fragmentShader: CIELO_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    toneMapped: true,
  });
  const malla = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), material);
  malla.name = 'cielo-paramo-fondo';
  malla.frustumCulled = false;
  malla.renderOrder = -1000;
  return { malla, material, dispose() { malla.geometry.dispose(); material.dispose(); } };
}

export default function CieloSierraVivo({ estado, seed = 20260908, reducedMotion = false }) {
  const cielo = useMemo(() => crearCieloFondo(seed), [seed]);
  const cieloRef = useRef(null);
  useEffect(() => {
    cieloRef.current = cielo;
    return () => cielo.dispose();
  }, [cielo]);
  useFrame(({ camera, clock }) => {
    const capa = cieloRef.current;
    if (!capa) return;
    capa.malla.position.copy(camera.position);
    capa.material.uniforms.uNoche.value = 1 - estado.dia;
    // Usar el tiempo absoluto evita que el pulso dependa de frames perdidos o
    // de la primera captura después de compilar el shader.
    if (!reducedMotion) capa.material.uniforms.uTiempo.value = clock.elapsedTime;
  });
  return <primitive object={cielo.malla} />;
}
