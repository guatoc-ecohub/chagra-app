import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { geometriaRioNubes, materialRioNube, texturaRioNube } from './nubesSierra.js';
import { estadoAtmosferaSierra } from './atmosferaVivaSierra.js';
import { alturaSierra } from './sierraRelieve.js';

/*
 * Capa atmosférica composable para la Sierra. No conoce el host ni altera el
 * relieve: se monta como hermana del macizo dentro de un Canvas existente.
 *
 * La dirección de arte es aire andino: masas amplias, verdes visibles y una
 * velocidad que se percibe al mirar, no en el primer vistazo. La semilla solo
 * decide la distribución inicial, así cada captura conserva la misma escena.
 */
const CIELOS = {
  amanecer: ['#e7b58f', '#6685a7'],
  dia: ['#b8d8de', '#4d91c2'],
  atardecer: ['#e6a879', '#5d638f'],
  noche: ['#263a68', '#080f2d'],
};

const CIELO_VERTEX = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w;
  }
`;

const CIELO_FRAGMENT = /* glsl */ `
  uniform vec3 uHorizonte;
  uniform vec3 uZenit;
  uniform float uTiempo;
  varying vec3 vPos;
  void main() {
    float altura = smoothstep(-0.12, 0.92, vPos.y);
    vec3 color = mix(uHorizonte, uZenit, pow(altura, 0.72));
    float velo = sin(vPos.x * 2.4 + uTiempo * 0.012) * 0.012;
    gl_FragColor = vec4(color + velo, 1.0);
  }
`;

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function colorPair(luz) {
  const [horizonte, zenit] = CIELOS[luz] || CIELOS.dia;
  return {
    horizonte: new THREE.Color(horizonte),
    zenit: new THREE.Color(zenit),
  };
}

function crearNubes({ seed, cantidad, lluvia }) {
  if (cantidad <= 0) return [];
  const random = rng(seed);
  const nubes = [];
  const total = Math.max(3, Math.round(4 + cantidad * 9));
  for (let i = 0; i < total; i += 1) {
    const centro = {
      x: (random() - 0.5) * 18,
      y: 4.9 + random() * 2.4,
      z: -3.2 - random() * 3.6,
      escala: 0.7 + random() * 0.72,
      fase: random() * 18,
    };
    nubes.push({ ...centro, gris: lluvia && random() > 0.28 });
  }
  return nubes;
}

function DomoCielo({ luz, reducido }) {
  const materialRef = useRef(null);
  const material = useMemo(() => {
    const par = colorPair(luz);
    return new THREE.ShaderMaterial({
      uniforms: {
        uHorizonte: { value: par.horizonte },
        uZenit: { value: par.zenit },
        uTiempo: { value: 0 },
      },
      vertexShader: CIELO_VERTEX,
      fragmentShader: CIELO_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      toneMapped: true,
    });
  }, [luz]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    if (!reducido && materialRef.current) materialRef.current.uniforms.uTiempo.value = clock.elapsedTime;
  });
  return (
    <mesh renderOrder={-100} frustumCulled={false}>
      <sphereGeometry args={[80, 32, 16]} />
      <primitive ref={materialRef} object={material} attach="material" />
    </mesh>
  );
}

function MasasNube({ nubes, reducido, clima, seed }) {
  const grupo = useRef(null);
  const anchoViewport = useThree((state) => state.size.width);
  const encuadreMovil = anchoViewport <= 600;
  const estado = useMemo(() => estadoAtmosferaSierra(clima), [clima]);
  // Reutiliza la densidad procedural de la escena: el borde transmite luz y
  // deja ver el relieve. Los lóbulos opacos se leían como cantos de piedra.
  const capas = useMemo(() => [false, true].map((gris, i) => {
    const textura = texturaRioNube(seed + i);
    const material = materialRioNube(textura, gris);
    material.uniforms.velocidad.value = 0.09;
    const geo = geometriaRioNubes(nubes.filter((n) => n.gris === gris).map((n) => {
      const ancho = n.escala * 1.25, alto = n.escala * 0.58;
      const z = n.z + (encuadreMovil ? 2.15 : 0);
      // El encuadre móvil no debe enterrar el borde de la nube en la ladera.
      let suelo = 0;
      for (const dx of [-1.3, 0, 1.3]) for (const dz of [-0.5, 0, 0.5]) {
        suelo = Math.max(suelo, alturaSierra(n.x + dx * ancho, z + dz * ancho));
      }
      return { x: n.x, y: Math.max(n.y + (encuadreMovil ? -5 : 0), suelo + alto * 0.6 + 0.15),
        z, ancho, alto };
    }));
    return { textura, material, geo };
  }), [nubes, encuadreMovil, seed]);
  useEffect(() => () => capas.forEach(({ geo, material, textura }) => {
    geo.dispose(); material.dispose(); textura.dispose();
  }), [capas]);
  useFrame((_, dt) => {
    for (const { material } of grupo.current?.children ?? []) {
      const u = material.uniforms;
      if (!reducido) u.tiempo.value += Math.min(dt, 0.1);
      u.sol.value.copy(estado.atm.dirSol);
      u.dia.value = estado.dia;
      u.densidad.value = estado.densidad;
      u.bruma.value.copy(estado.atm.horizonte);
    }
  });
  return (
    <group ref={grupo} name="masas-nube-macizo">
      {capas.map(({ geo, material }, i) => <mesh key={i} geometry={geo} material={material} frustumCulled={false} />)}
    </group>
  );
}

function LluviaMacizo({ intensidad, reducido, seed }) {
  const ref = useRef(null);
  const matriz = useMemo(() => new THREE.Matrix4(), []);
  const posicion = useMemo(() => new THREE.Vector3(), []);
  const rotacion = useMemo(() => new THREE.Quaternion(), []);
  const escala = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const gotas = useMemo(() => {
    const random = rng(seed + 17);
    return Array.from({ length: Math.max(12, Math.round(42 * intensidad)) }, () => ({
      x: (random() - 0.5) * 12,
      z: -1.5 - random() * 7,
      fase: random(),
    }));
  }, [intensidad, seed]);
  useFrame(({ clock }) => {
    if (reducido || !ref.current) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < gotas.length; i += 1) {
      const gota = gotas[i];
      posicion.set(gota.x, 5.4 - ((gota.fase + t * 0.42) % 1) * 5.6, gota.z);
      matriz.compose(posicion, rotacion, escala);
      ref.current.setMatrixAt(i, matriz);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, gotas.length]} frustumCulled={false}>
      <cylinderGeometry args={[0.012, 0.012, 0.28, 4]} />
      <meshBasicMaterial color="#c2e4ee" transparent opacity={0.62} />
    </instancedMesh>
  );
}

function RachasMacizo({ reducido, seed }) {
  const ref = useRef(null);
  const gotas = useMemo(() => {
    const random = rng(seed + 31);
    return Array.from({ length: 18 }, () => ({ x: (random() - 0.5) * 12, y: 1.2 + random() * 3.4, z: -2 - random() * 5 }));
  }, [seed]);
  useFrame(({ clock }) => {
    if (reducido || !ref.current) return;
    ref.current.position.x = Math.sin(clock.elapsedTime * 0.8) * 0.22;
  });
  return <group ref={ref} name="rachas-viento-fuerte">
    {gotas.map((gota, index) => <mesh key={index} position={[gota.x, gota.y, gota.z]} rotation={[0, 0, -0.28]}>
      <boxGeometry args={[0.42, 0.012, 0.012]} />
      <meshBasicMaterial color="#e6f1e8" transparent opacity={0.48} depthWrite={false} />
    </mesh>)}
  </group>;
}

function GranizoMacizo({ reducido, seed }) {
  const ref = useRef(null);
  const piedras = useMemo(() => {
    const random = rng(seed + 47);
    return Array.from({ length: 22 }, () => ({ x: (random() - 0.5) * 11, z: -2 - random() * 6, fase: random() }));
  }, [seed]);
  useFrame(({ clock }) => {
    if (reducido || !ref.current) return;
    ref.current.children.forEach((piedra, index) => { piedra.position.y = 4.8 - ((piedras[index].fase + clock.elapsedTime * 0.58) % 1) * 5.2; });
  });
  return <group ref={ref} name="granizo-macizo">
    {piedras.map((piedra, index) => <mesh key={index} position={[piedra.x, 4, piedra.z]}>
      <sphereGeometry args={[0.045, 6, 4]} />
      <meshBasicMaterial color="#f4fbff" transparent opacity={0.82} depthWrite={false} />
    </mesh>)}
  </group>;
}

function NieblaMacizo({ intensidad, reducido }) {
  const ref = useRef(null);
  useFrame(({ clock }) => {
    if (reducido || !ref.current) return;
    const pulso = 1 + Math.sin(clock.elapsedTime * 0.32) * 0.045;
    ref.current.scale.set(pulso, 1, 1);
    ref.current.position.x = Math.sin(clock.elapsedTime * 0.07) * 0.18;
  });
  return (
    <group ref={ref} position={[0, 2.25, 0.2]} scale={[1.7, 0.34, 0.75]}>
      <mesh>
        <sphereGeometry args={[1, 16, 8]} />
        <meshBasicMaterial color="#d9e8e2" transparent opacity={0.12 + intensidad * 0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * Capa visual pura. `clima` es opcional y solo controla señales ya disponibles.
 * `seed` permite barrer variaciones sin cambiar el contrato del host.
 */
export default function CieloVivoMacizo({ clima = null, tier = 'medio', reducedMotion = false, seed = 20260915, dibujarAtmosfera = true }) {
  const reducido = reducedMotion;
  const luz = clima?.luz || 'dia';
  const lluvia = Boolean(clima?.lluvia);
  const niebla = Boolean(clima?.niebla);
  const estados = clima?.estados || clima || {};
  const cobertura = Math.min(1, Math.max(0, clima?.cobertura ?? 0.34));
  const cieloCubierto = clima?.estadoDato === 'conocido-cubierto';
  const nubes = useMemo(() => crearNubes({
    seed,
    cantidad: cieloCubierto ? (tier === 'bajo' ? cobertura * 0.65 : cobertura) : 0,
    lluvia,
  }), [seed, cobertura, cieloCubierto, lluvia, tier]);
  return (
    <group name="cielo-vivo-macizo">
      {dibujarAtmosfera && <DomoCielo luz={luz} reducido={reducido} />}
      {dibujarAtmosfera && <MasasNube nubes={nubes} reducido={reducido} clima={clima} seed={seed} />}
      {lluvia && <LluviaMacizo intensidad={Math.max(0.3, Math.min(1, clima?.lluviaMm == null ? 0.65 : clima.lluviaMm / 18))} reducido={reducido} seed={seed} />}
      {niebla && <NieblaMacizo intensidad={Math.max(0.35, Math.min(1, cobertura))} reducido={reducido} />}
      {estados.vientoFuerte && <RachasMacizo reducido={reducido} seed={seed} />}
      {estados.granizo && <GranizoMacizo reducido={reducido} seed={seed} />}
    </group>
  );
}
