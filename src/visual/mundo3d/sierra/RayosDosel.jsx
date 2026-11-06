/*
 * RayosDosel — cableado del pase vendorizado de rayos filtrados por dosel.
 *
 * El pase solo puede ejecutarse después del RenderPass, porque muestrea el
 * color y la profundidad ya renderizados. Este componente toma el control del
 * frame loop de r3f, igual que BloomSutil, y devuelve el control al desmontar.
 * La intensidad sigue el presupuesto continuo de `descensoSierra.js`.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { crearRayosDosel, leerParamsRayos } from './vendor/godRaysSylva.js';

function rayosApagadosPorQuery() {
  if (typeof window === 'undefined') return false;
  const raw = new URLSearchParams(window.location.search).get('rayos');
  return raw === '0' || raw === 'off' || raw === 'false';
}

export default function RayosDosel({ refEstado, luzRef, permitido = true }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const prAnterior = useRef(0);
  const posicionSol = useMemo(() => new THREE.Vector3(0.7, 0.2, 0.7), []);
  const solProxy = useMemo(() => ({
    material: { uniforms: { sunPosition: { value: posicionSol } } },
  }), [posicionSol]);
  const apagado = useMemo(() => rayosApagadosPorQuery(), []);
  const params = useMemo(() => {
    if (apagado) return null;
    const desdeQuery = leerParamsRayos();
    if (desdeQuery) return desdeQuery;
    // El pase viene con una dosis de valle muy discreta. En la Sierra la
    // escala de cámara es mayor, así que el presupuesto por defecto necesita
    // una señal algo más legible para que el fenómeno no se pierda en la toma.
    return { ...leerParamsRayos('?rayos=1'), peso: 0.08 };
  }, [apagado]);

  const composer = useMemo(() => {
    if (!permitido || !params) return null;
    const comp = /** @type {EffectComposer & { __rayos?: ReturnType<typeof crearRayosDosel> }} */ (new EffectComposer(gl));
    comp.addPass(new RenderPass(scene, camera));
    const rayos = crearRayosDosel({
      renderer: gl,
      composer: comp,
      camera,
      // El ref de la luz se llena después del primer render. El proxy mantiene
      // el contrato del vendor sin congelar una referencia nula al montarse.
      sun: solProxy,
      params,
    });
    comp.addPass(rayos.pass);
    comp.addPass(new OutputPass());
    comp.__rayos = rayos;
    return comp;
  }, [camera, gl, params, permitido, scene, solProxy]);

  useEffect(() => {
    if (!composer) return undefined;
    composer.setSize(size.width, size.height);
    return undefined;
  }, [composer, size]);

  useEffect(() => () => composer?.dispose(), [composer]);

  useFrame(() => {
    if (!composer) {
      // A priority-1 frame callback takes over r3f's automatic render. The
      // explicit query-off path must therefore preserve the baseline render.
      gl.render(scene, camera);
      return;
    }
    const rayos = composer.__rayos;
    if (!rayos) return;
    const est = refEstado.current;
    if (est) {
      if (luzRef?.current?.position) posicionSol.copy(luzRef.current.position).sub(camera.position);
      const peso = est.fx?.godRays ?? 0;
      rayos.set(peso > 0 && permitido);
      rayos.preparar(camera);
      if (typeof window !== 'undefined') {
        /** @type {Window & { __godRays?: object }} */ (window).__godRays = { ...rayos.estado(), presupuesto: peso };
      }
    }
    const pr = gl.getPixelRatio();
    if (pr !== prAnterior.current) {
      prAnterior.current = pr;
      composer.setPixelRatio(pr);
      composer.setSize(size.width, size.height);
    }
    composer.render();
  }, 1);

  useEffect(() => () => {
    if (typeof window !== 'undefined' && /** @type {Window & { __godRays?: object }} */ (window).__godRays) delete /** @type {Window & { __godRays?: object }} */ (window).__godRays;
  }, []);

  return null;
}
