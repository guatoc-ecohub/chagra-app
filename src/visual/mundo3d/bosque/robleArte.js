import * as THREE from 'three';
import { curvaFuste } from './entsGradiente.geom.js';
import { rng, ruidoFbm, hornearFollaje, fusionarSeguro } from './sombreadoVegetal.js';

// Art-only canopy. Keep the trunk, face, roots and animated anchors intact.
// Overlapping shelves enclose an empty interior instead of filling it with a ball.
export function construirCopaRoble(esp, P) {
  const random = rng(esp.semilla * 51 + 3);
  const top = curvaFuste(esp).getPointAt(1);
  const parts = [];
  const segments = P.hojasCopa < .6 ? 32 : 48;
  const layers = [
    { y: -1.15, ring: 2.05, width: 1.65, height: 1.12, count: 7 },
    { y: .25, ring: 1.75, width: 1.85, height: 1.42, count: 7 },
    { y: 1.40, ring: .80, width: 1.65, height: 1.16, count: 4 },
  ];
  for (const [layerIndex, layer] of layers.entries()) {
    for (let i = 0; i < layer.count; i++) {
      const angle = i / layer.count * Math.PI * 2 + layerIndex * .53;
      const jitter = (random() - .5) * .25;
      const center = [top.x + Math.cos(angle) * layer.ring,
        top.y + layer.y + jitter + .48 * Math.sin(angle * 2 + layerIndex), top.z + Math.sin(angle) * layer.ring * .88];
      const geo = new THREE.SphereGeometry(1, segments, segments / 2);
      const positions = geo.attributes.position;
      for (let v = 0; v < positions.count; v++) {
        const x = positions.getX(v), y = positions.getY(v), z = positions.getZ(v);
        const broad = ruidoFbm(x * 3 + i, y * 3 + layerIndex, z * 3);
        const fine = ruidoFbm(x * 19 + i, y * 19, z * 19);
        const gain = 1 + .15 * broad + .035 * fine;
        positions.setXYZ(v, x * layer.width * gain, y * layer.height * gain, z * layer.width * .87 * gain);
      }
      geo.rotateY(angle);
      geo.rotateZ(.14 * Math.sin(angle + layerIndex));
      geo.computeVertexNormals();
      geo.translate(center[0], center[1], center[2]);
      hornearFollaje(geo, { ...esp.hoja, centro: center, radio: layer.width, ao: .68, manchas: .13 });
      parts.push(geo);
    }
  }
  const result = fusionarSeguro(parts, 'copa-roble-estratos', { preservarNormales: true });
  parts.forEach(geo => geo.dispose());
  return result;
}
