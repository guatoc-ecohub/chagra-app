import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide } from 'three';
import { Html } from '@react-three/drei';
import { LluviaValle } from '../atmosfera/clima/LluviaValle.jsx';
import { NieblaLadera } from '../atmosfera/clima/NieblaLadera.jsx';
import EscarchaHelada from '../EscarchaHelada.jsx';
import './ClimaParcelaSierra.css';
import { alturaSierra } from './sierraRelieve.js';
import { anclaParcela, senalesParcela } from './senalesParcela.js';

/** @type {[number, number, number]} */
const AREA = [5, 5, 4];
/** @type {{x: [number, number], z: [number, number]}} */
const BANDA = { x: [-2.5, 2.5], z: [-1.5, 1.5] };

function LugarParcela({ viento, reducedMotion }) {
  const manga = useRef(null);
  useFrame(({ clock }) => {
    if (!manga.current) return;
    manga.current.rotation.z = viento == null ? 0 : -viento * 1.25;
    manga.current.rotation.x = reducedMotion || viento == null ? 0
      : Math.sin(clock.elapsedTime * (2 + viento * 10)) * viento * 0.25;
  });
  return (
    <group name="lugar-parcela">
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.56, 8]} />
        <meshBasicMaterial color="#fff0c2" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]}>
        <ringGeometry args={[0.13, 0.18, 32]} />
        <meshBasicMaterial color="#fff0c2" side={DoubleSide} />
      </mesh>
      {viento != null && <group ref={manga} position={[0, 0.56, 0]}>
        <mesh position={[0, -0.17, 0]}>
          <planeGeometry args={[0.16, 0.34]} />
          <meshBasicMaterial color="#edbd69" side={DoubleSide} />
        </mesh>
      </group>}
    </group>
  );
}

function MarcaHeladaCota({ msnm, reducedMotion }) {
  return (
    <group name="marca-helada-cota" position={[0, 0.08, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
        <ringGeometry args={[0.24, 0.34, 32]} />
        <meshBasicMaterial color="#d9f3ff" transparent opacity={0.95} depthWrite={false} side={DoubleSide} />
      </mesh>
      <Html position={[0, 0.92, 0]} center distanceFactor={7} zIndexRange={[24, 4]} style={{ pointerEvents: 'none' }}>
        <div
          className="clima-cota-helada"
          data-testid="relieve-dato-helada"
          data-region="cota-finca"
          data-cota-msnm={msnm}
          data-reduced-motion={reducedMotion ? 'true' : 'false'}
        >
          <span aria-hidden="true">❄</span>
          <strong>Helada en su cota</strong>
          <small>{Math.round(msnm).toLocaleString('es-CO')} m</small>
        </div>
      </Html>
    </group>
  );
}

export default function ClimaParcelaSierra({ clima, msnm, tier, reducedMotion, semilla = 17 }) {
  const ancla = useMemo(() => anclaParcela(msnm), [msnm]);
  const alturaLocal = useMemo(() => ancla
    ? (x, z) => alturaSierra(x + ancla[0], z + ancla[2]) - ancla[1]
    : null, [ancla]);
  const { lluvia, niebla, viento } = senalesParcela(clima);
  const helada = clima?.senal === true && (clima?.helada === true || clima?.estados?.helada === true);
  if (!ancla) return null;
  return (
    <group position={/** @type {[number, number, number]} */ (ancla)} name="clima-parcela-sierra">
      <LugarParcela viento={viento} reducedMotion={reducedMotion} />
      {helada && <EscarchaHelada intensidad={0.72} tier={tier} reducedMotion={reducedMotion} area={3.6} altura={0.03} semilla={semilla} />}
      {helada && <MarcaHeladaCota msnm={msnm} reducedMotion={reducedMotion} />}
      {lluvia > 0 && <LluviaValle
        intensidad={lluvia} tier={tier} reducedMotion={reducedMotion}
        alturaDe={alturaLocal} area={AREA} viento={(viento ?? 0) * 3}
        tamanoGota={0.12} gotasEnCalma nubes={false} charcos={false} cauce={null} semilla={semilla}
      />}
      {niebla > 0 && <NieblaLadera
        intensidad={niebla} tier={tier} reducedMotion={reducedMotion}
        alturaDe={alturaLocal} banda={BANDA} velocidad={viento ?? 0}
        opacidad={0.45} profundidad={false} escalaBanco={0.5} semilla={semilla}
      />}
    </group>
  );
}
