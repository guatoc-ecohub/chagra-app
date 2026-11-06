/*
 * AtmosferaViva — la finca RESPIRA con el reloj real (componente r3f, A4).
 *
 * Montado dentro de cualquier <Canvas>, ES el cielo del mundo: fondo, niebla,
 * hemisferio cielo/suelo, ambiente, sol direccional que ARQUEA con la hora
 * real y relleno frío opuesto — el mismo esquema de luces de EscenaBase3D y
 * CielosHora, para que una escena vestida por esta pieza se lea hermana de
 * las existentes. Reemplaza (no suma) al bloque fondo/fog/luces de la escena.
 *
 * Lo que agrega sobre CielosHora:
 *   - ARCO CONTINUO: no seis presets que saltan sino un día que gira — a las
 *     5:40 el valle está ENTRE la madrugada y el amanecer, de verdad.
 *   - MADRUGADA propia (4-6 am): azul frío, la niebla más pesada, la cocina
 *     encendida. La hora real del campesino.
 *   - TEMPORADA bimodal colombiana: lluvia (verde hondo, cielo cargado que se
 *     come las estrellas, fog cerca) vs seca (pasto paja, aire limpio, se ve
 *     lejos). "Invierno" aquí es lluvia — identidad, no primavera/otoño.
 *   - LUCIÉRNAGAS de monte al anochecer (un solo draw-call de points aditivos,
 *     solo gama media/alta; gama baja ni las monta).
 *
 * CABLEO (para quien integre — no toca este archivo):
 *   <AtmosferaViva tier={tier} reducedMotion={reducedMotion} />          // reloj+calendario reales
 *   <AtmosferaViva hora={4.8} temporada="lluvia" tier={tier} />          // momento fijo (QA/fotos)
 *   Overrides de URL heredados: ?ciclo=demo (día en ~3 min), ?ciclo=17.5,
 *   ?temporada=lluvia|seca.
 *   La paleta viva para VESTIR el mundo (pasto de temporada, charcos, rocío,
 *   ventanas encendidas) se lee con el hook useAtmosferaViva en el padre.
 *
 * TIER-SAFE (contrato A4): cero luces extra sobre el rig canónico de cuatro,
 * cero shadow-maps, cero post-proceso. En gama baja quedan SOLO paleta y
 * luces (perfilDeTier: sin fog, sin estrellas, sin luciérnagas). reducedMotion
 * → el momento entra por snap y nada titila.
 *
 * RENDIMIENTO: el estado animado vive en refs y se escribe imperativo en
 * useFrame (cero setState por frame; Color/Vector3 mutados in-place). El
 * objetivo cambia 1 vez por minuto (1/seg en demo) y la amortiguación
 * exponencial lo persigue suave.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { perfilDeTier } from '../deviceTier.js';
import { TRANSICION } from '../cielosHoraData.js';
import useAtmosferaViva from './useAtmosferaViva.js';

/* Relleno fijo al lado opuesto del valle (como EscenaBase3D/CielosHora):
   solo color e intensidad viajan con la hora. */
/** @type {[number, number, number]} */
const RELLENO_POS = [-5, 4, -6];

/* Presupuesto de luciérnagas por tier (gama baja: cero, ni el buffer). */
const LUCIERNAGAS_TIER = { alto: 24, medio: 12, bajo: 0 };

const CIELO_VERTEX = /* glsl */ `
  varying vec3 vDireccion;
  void main() {
    vDireccion = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w;
  }
`;

const CIELO_FRAGMENT = /* glsl */ `
  uniform vec3 uHorizonte;
  uniform vec3 uCenit;
  varying vec3 vDireccion;
  void main() {
    float altura = smoothstep(-0.16, 0.88, vDireccion.y);
    vec3 color = mix(uHorizonte, uCenit, pow(altura, 0.78));
    gl_FragColor = vec4(color, 1.0);
  }
`;

/* Preset plano → objetos three mutables in-place (una alocación por cambio
   de objetivo, ninguna por frame). */
function estadoDesde(p) {
  return {
    fondo: new THREE.Color(p.fondo),
    cielo: new THREE.Color(p.cielo),
    suelo: new THREE.Color(p.suelo),
    luz: new THREE.Color(p.luz),
    relleno: new THREE.Color(p.relleno),
    niebla: new THREE.Color(p.niebla),
    solPos: new THREE.Vector3(...p.solPos),
    intensidad: p.intensidad,
    hemisferio: p.hemisferio,
    ambiente: p.ambiente,
    sol: p.sol,
    rellenoInt: p.rellenoInt,
    nieblaCerca: p.nieblaCerca,
    nieblaLejos: p.nieblaLejos,
  };
}

const CAMPOS_ANIMADOS = [
  'intensidad',
  'hemisferio',
  'ambiente',
  'sol',
  'rellenoInt',
  'nieblaCerca',
  'nieblaLejos',
];

/* Amortigua `actual` hacia `objetivo` con factor k. */
function amortiguar(actual, objetivo, k) {
  actual.fondo.lerp(objetivo.fondo, k);
  actual.cielo.lerp(objetivo.cielo, k);
  actual.suelo.lerp(objetivo.suelo, k);
  actual.luz.lerp(objetivo.luz, k);
  actual.relleno.lerp(objetivo.relleno, k);
  actual.niebla.lerp(objetivo.niebla, k);
  actual.solPos.lerp(objetivo.solPos, k);
  for (const c of CAMPOS_ANIMADOS) actual[c] += (objetivo[c] - actual[c]) * k;
}

/* Escribe el estado en los nodos three montados (null → se salta: el fog no
   existe en tier bajo). Intensidades × intensidad global de la hora. */
function pintar(n, e) {
  if (n.fondo.current?.copy) n.fondo.current.copy(e.fondo);
  if (n.fog.current) {
    if (n.fog.current.color?.copy) n.fog.current.color.copy(e.niebla);
    n.fog.current.near = e.nieblaCerca;
    n.fog.current.far = e.nieblaLejos;
  }
  if (n.hemi.current) {
    n.hemi.current.intensity = e.hemisferio * e.intensidad;
    if (n.hemi.current.color?.copy) n.hemi.current.color.copy(e.cielo);
    if (n.hemi.current.groundColor?.copy) n.hemi.current.groundColor.copy(e.suelo);
  }
  if (n.amb.current) {
    n.amb.current.intensity = e.ambiente * e.intensidad;
    if (n.amb.current.color?.copy) n.amb.current.color.copy(e.luz);
  }
  if (n.sol.current) {
    n.sol.current.intensity = e.sol * e.intensidad;
    if (n.sol.current.color?.copy) n.sol.current.color.copy(e.luz);
    if (n.sol.current.position?.copy) n.sol.current.position.copy(e.solPos);
  }
  if (n.rell.current) {
    n.rell.current.intensity = e.rellenoInt * e.intensidad;
    if (n.rell.current.color?.copy) n.rell.current.color.copy(e.relleno);
  }
}

/* El fondo plano contaba una hora distinta a la ladera. Este domo usa los
   mismos colores que ya alimentan el hemisferio y sigue su transición. */
function DomoCieloVivo({ estado, reducido }) {
  const materialRef = useRef(null);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uHorizonte: { value: estado.fondo.clone() },
      uCenit: { value: estado.cielo.clone() },
    },
    vertexShader: CIELO_VERTEX,
    fragmentShader: CIELO_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    toneMapped: true,
  }), [estado]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const uniforms = materialRef.current?.uniforms;
    if (!reducido && uniforms) {
      uniforms.uHorizonte.value.copy(estado.fondo);
      uniforms.uCenit.value.copy(estado.cielo);
    }
  });

  useEffect(() => {
    const uniforms = materialRef.current?.uniforms;
    if (!uniforms) return;
    uniforms.uHorizonte.value.copy(estado.fondo);
    uniforms.uCenit.value.copy(estado.cielo);
  }, [estado]);

  return (
    <mesh renderOrder={-100} frustumCulled={false}>
      <sphereGeometry args={[80, 32, 16]} />
      <primitive ref={materialRef} object={material} attach="material" />
    </mesh>
  );
}

/**
 * Luciérnagas de monte: UN points aditivo (un draw call), opacidad que
 * persigue la fracción viva de la hora×temporada y un latido lento colectivo.
 * En calma (reducedMotion) quedan encendidas fijas, sin titilar ni derivar.
 */
function Luciernagas({ maximo, objetivo, reducedMotion }) {
  const posiciones = useMemo(() => {
    const arr = new Float32Array(maximo * 3);
    for (let i = 0; i < maximo; i++) {
      const ang = (i / maximo) * Math.PI * 2 + (i % 3) * 0.7;
      const radio = 3 + ((i * 37) % 90) / 10; // anillo 3..12, determinista
      arr[i * 3] = Math.cos(ang) * radio;
      arr[i * 3 + 1] = 0.4 + ((i * 53) % 18) / 10; // 0.4..2.2 sobre el suelo
      arr[i * 3 + 2] = Math.sin(ang) * radio;
    }
    return arr;
  }, [maximo]);

  const puntosRef = useRef(/** @type {THREE.Points|null} */ (null));
  const matRef = useRef(/** @type {THREE.PointsMaterial|null} */ (null));
  const objetivoRef = useRef(objetivo);
  useEffect(() => {
    objetivoRef.current = objetivo;
  }, [objetivo]);

  useEffect(() => {
    if (!reducedMotion || !matRef.current) return;
    matRef.current.opacity = Math.min(objetivo, 1) * 0.7; // encendidas, quietas
  }, [reducedMotion, objetivo]);

  useFrame((estado, dt) => {
    if (reducedMotion) return;
    const mat = matRef.current;
    if (mat) {
      const latido = 0.6 + 0.4 * Math.sin(estado.clock.elapsedTime * 1.7);
      const meta = Math.min(objetivoRef.current, 1) * latido;
      mat.opacity += (meta - mat.opacity) * Math.min(dt * 2.5, 1);
    }
    if (puntosRef.current) puntosRef.current.rotation.y += dt * 0.03; // deriva lenta
  });

  return (
    <points ref={puntosRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posiciones, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        color="#ffdf8a"
        size={0.14}
        sizeAttenuation
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * La atmósfera viva del valle. Montar DENTRO de un <Canvas>, en lugar del
 * bloque fondo/fog/luces de la escena.
 *
 * @param {object} props
 * @param {number|null} [props.hora=null]  hora decimal FIJA (0..24); null =
 *        el reloj real del dispositivo (el uso de producto).
 * @param {'lluvia'|'seca'|'auto'} [props.temporada='auto']  'auto' = URL
 *        override → calendario bimodal real (temporadaDeFecha).
 * @param {'alto'|'medio'|'bajo'} [props.tier='medio']  perfil del equipo
 *        (decidirTier): gobierna fog, estrellas y luciérnagas.
 * @param {boolean} [props.reducedMotion=false]  snap sin animación.
 * @param {number} [props.duracion]  segundos de la transición amortiguada.
 * @param {boolean} [props.luciernagas=true]  dibuja luciérnagas del ambiente.
 */
export default function AtmosferaViva({
  hora = null,
  temporada = 'auto',
  tier = 'medio',
  reducedMotion = false,
  duracion = TRANSICION.duracion,
  luciernagas = true,
}) {
  const perfil = perfilDeTier(tier);
  const { preset } = useAtmosferaViva({ hora, temporada, reducedMotion });

  const objetivo = useMemo(() => estadoDesde(preset), [preset]);

  /* Preset del PRIMER montaje, congelado: alimenta los valores declarativos
     del JSX (nunca cambian tras montar; la animación escribe imperativa). */
  const [ini] = useState(() => preset);
  const [actual] = useState(() => estadoDesde(ini));

  const fondoRef = useRef(null);
  const fogRef = useRef(null);
  const hemiRef = useRef(null);
  const ambRef = useRef(null);
  const solRef = useRef(null);
  const rellRef = useRef(null);
  const bundle = () => ({
    fondo: fondoRef,
    fog: fogRef,
    hemi: hemiRef,
    amb: ambRef,
    sol: solRef,
    rell: rellRef,
  });

  /* Calma pedida → el momento entra completo, sin animar. */
  useEffect(() => {
    if (!reducedMotion) return;
    amortiguar(actual, objetivo, 1);
    pintar(bundle(), actual);
  });

  /* Transición viva: amortiguación exponencial estable en dt variable. */
  useFrame((_, dt) => {
    if (reducedMotion) return;
    const k = 1 - Math.exp((-3 / Math.max(duracion, 0.001)) * Math.min(dt, 0.1));
    amortiguar(actual, objetivo, k);
    pintar(bundle(), actual);
  });

  /* Estrellas: presupuesto del tier × fracción del momento, CUANTIZADA a
     cuartos (drei regenera el buffer al cambiar count; así son ≤4 pasos por
     transición y no uno por minuto). El cielo cargado de lluvia ya viene
     descontado en el preset. */
  const nEstrellas = Math.round(perfil.estrellas * (Math.round(preset.estrellas * 4) / 4));

  const maxLuciernagas = LUCIERNAGAS_TIER[tier] ?? 0;

  return (
    <group>
      <color ref={fondoRef} attach="background" args={[ini.fondo]} />
      <DomoCieloVivo estado={actual} reducido={reducedMotion} />
      {perfil.fog && (
        <fog ref={fogRef} attach="fog" args={[ini.niebla, ini.nieblaCerca, ini.nieblaLejos]} />
      )}
      <hemisphereLight
        ref={hemiRef}
        intensity={ini.hemisferio * ini.intensidad}
        color={ini.cielo}
        groundColor={ini.suelo}
      />
      <ambientLight ref={ambRef} intensity={ini.ambiente * ini.intensidad} color={ini.luz} />
      <directionalLight
        ref={solRef}
        position={ini.solPos}
        intensity={ini.sol * ini.intensidad}
        color={ini.luz}
      />
      <directionalLight
        ref={rellRef}
        position={RELLENO_POS}
        intensity={ini.rellenoInt * ini.intensidad}
        color={ini.relleno}
      />
      {nEstrellas > 0 && (
        <Stars
          radius={80}
          depth={40}
          count={nEstrellas}
          factor={3}
          saturation={0}
          fade
          speed={reducedMotion ? 0 : 0.5}
        />
      )}
      {luciernagas && maxLuciernagas > 0 && preset.luciernagas > 0.02 && (
        <Luciernagas
          maximo={maxLuciernagas}
          objetivo={preset.luciernagas}
          reducedMotion={reducedMotion}
        />
      )}
    </group>
  );
}
