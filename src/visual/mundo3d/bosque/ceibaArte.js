import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Art-only loft. The wrist remains at the existing assembly anchor.
export function geometriaManoCeiba(spec) {
  const parts = [];
  const loft = (points, widths, depths) => {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const positions = [], indices = [];
    const rows = 36, sides = 24;
    for (let j = 0; j <= rows; j++) {
      const t = j / rows, sample = t * (widths.length - 1);
      const lo = Math.min(widths.length - 2, Math.floor(sample)), f = sample - lo;
      const w = lo === widths.length - 2 ? widths[lo] * Math.sqrt(1-f*f) : THREE.MathUtils.lerp(widths[lo], widths[lo + 1], f);
      const d = lo === depths.length - 2 ? depths[lo] * Math.sqrt(1-f*f) : THREE.MathUtils.lerp(depths[lo], depths[lo + 1], f);
      const p = path.getPoint(t), tangent = path.getTangent(t);
      const across = new THREE.Vector3(1, 0, 0).addScaledVector(tangent, -tangent.x).normalize();
      const back = new THREE.Vector3().crossVectors(tangent, across).normalize();
      for (let i = 0; i <= sides; i++) {
        const a = i / sides * Math.PI * 2;
        const v = p.clone().addScaledVector(across, Math.cos(a) * w).addScaledVector(back, Math.sin(a) * d);
        positions.push(v.x,v.y,v.z);
        if (j < rows && i < sides) {const k=j*(sides+1)+i; indices.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
      }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();parts.push(g);
  };
  const incoming = spec.curve.getTangent(1).multiplyScalar(-.13);
  loft([[incoming.x,incoming.y,incoming.z],[0,0,0],[0,-.20,.025],[0,-.36,.045],[0,-.43,.05]],
    [.055,.095,.19,.17,0], [.055,.085,.14,.11,0]);
  for(let i=0;i<4;i++) {
    const x=(i-1.5)*.105;
    const length=spec.dedos==='senala' && i===3 ? .56 : [.49,.64,.57,.42][i];
    const lean=(i-1.5)*.082;
    loft([[x,-.18,.045],[x+lean*.35,-.46,.065],[x+lean,-.46-length*.6,.12],[x+lean,-.46-length,.20]],
      [0,.079,.048,0],[0,.065,.043,0]);
  }
  loft([[-spec.lado*.14,-.16,.035],[-spec.lado*.29,-.28,.09],[-spec.lado*.34,-.43,.19],[-spec.lado*.29,-.52,.23]],
    [0,.075,.054,0],[0,.064,.046,0]);
  const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());return result;
}

// Seamless object-space relief. Art direction: old, unarmed bark with olive
// living areas, warm worn ridges and shallow irregular longitudinal fissures.
// This factory consumes the uncompiled base material and preserves its tint.
export function superficieCeiba(base, scale = [1,1,1], kind = 'bark') {
  const leaf = kind === 'leaf';
  const material = new THREE.MeshPhysicalMaterial({
    color: base.color, vertexColors: base.vertexColors, side: base.side,
    flatShading: false, roughness: .97, metalness: 0,
    sheen: leaf ? .12 : .10, sheenColor: new THREE.Color(leaf ? '#93a579' : '#b1b491'),
    sheenRoughness: 1, clearcoat: 0, specularIntensity: .12,
  });
  const prior = base.onBeforeCompile;
  base.dispose();
  material.userData.ceibaSkin = kind;
  material.onBeforeCompile = shader => {
    prior.call(material, shader);
    shader.uniforms.ceibaScale = { value: new THREE.Vector3(...scale) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCeiba; uniform vec3 ceibaScale;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCeiba=position*ceibaScale;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vCeiba;
float ceibaHash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float ceibaNoise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(ceibaHash(i),ceibaHash(i+vec3(1,0,0)),f.x),
    mix(ceibaHash(i+vec3(0,1,0)),ceibaHash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(ceibaHash(i+vec3(0,0,1)),ceibaHash(i+vec3(1,0,1)),f.x),
    mix(ceibaHash(i+vec3(0,1,1)),ceibaHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float ceibaRelief(vec3 p) {
  float warp=ceibaNoise(p*vec3(3.,1.4,3.));
  float plate=ceibaNoise(p*vec3(42.,1.8,42.)+warp*2.);
  float split=1.-smoothstep(.23,.48,plate);
  float fiber=ceibaNoise(p*vec3(125.,14.,125.));
  float pore=ceibaNoise(p*180.);
  return .32*plate-.62*split+.13*fiber+.045*pore;
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float relief=ceibaRelief(vCeiba);
float broad=ceibaNoise(vCeiba*vec3(2.1,.8,2.1));
${leaf ? `
// A softer felt field on the crown, including its underside.
diffuseColor.rgb*=.85+.19*broad+.08*ceibaNoise(vCeiba*60.);` : `
float crevice=1.-smoothstep(-.30,.08,relief);
vec3 living=mix(vec3(.62,.61,.43),vec3(.92,.80,.64),smoothstep(.28,.73,broad));
diffuseColor.rgb*=living*(.91+.13*relief)*(1.-.22*crevice);`}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor=clamp(.94+.06*ceibaNoise(vCeiba*47.),.94,1.);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// Filter the smallest relief as its footprint exceeds a pixel.
float footprint=max(length(dFdx(vCeiba)),length(dFdy(vCeiba)));
float height=${leaf ? '.0015*ceibaNoise(vCeiba*60.)' : '.022*ceibaRelief(vCeiba)'};
height*=1.-smoothstep(.012,.055,footprint);
vec3 sx=dFdx(-vViewPosition), sy=dFdy(-vViewPosition);
vec3 rx=cross(sy,normal), ry=cross(normal,sx);
float determinant=dot(sx,rx);
normal=normalize(abs(determinant)*normal-sign(determinant)*(dFdx(height)*rx+dFdy(height)*ry));`);
  };
  material.customProgramCacheKey = () => `ceiba-skin-v4-${kind}-${scale.join(',')}`;
  return material;
}

// A buried, closed board root. Broad vertical cheeks meet a rounded narrow
// crest; each root keeps its own ground footprint and intervening open sector.
export function geometriaRaizCeiba(esp, { ang, largo, alto, grosor, seed, q = 1 }, colorAt) {
  const along = Math.max(32, Math.round(48 * q));
  const around = 24;
  const positions = [], colors = [], uvs = [], indices = [];
  const radial = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
  const across = new THREE.Vector3(-radial.z, 0, radial.x);
  const color = new THREE.Color();
  for (let i = 0; i <= along; i++) {
    const u = i / along;
    const distance = esp.r0 * .65 + largo * u;
    const crest = alto * Math.pow(1 - u, 1.45) - .16;
    const floor = -.24 - .10 * u;
    const bend = Math.sin(u * 4.5 + seed) * .07 * Math.sin(Math.PI * u);
    const thickness = grosor * (1 - .82 * u);
    for (let j = 0; j <= around; j++) {
      const angle = j / around * Math.PI * 2;
      const sin = Math.sin(angle), cos = Math.cos(angle);
      const y = floor + (crest - floor) * (.5 + .5 * sin);
      // Almost planar sides, gently worn edges, longitudinal irregularity.
      const cheek = Math.sign(cos) * Math.pow(Math.abs(cos), .35);
      const grain = 1 + .06 * Math.sin(u * 29 + sin * 3 + seed);
      const width = bend + thickness * cheek * grain;
      positions.push(radial.x * distance + across.x * width, y,
        radial.z * distance + across.z * width);
      colorAt(esp, .035 * Math.sin(u * 18 + sin * 2 + seed), y, color);
      color.multiplyScalar(.78 + .22 * THREE.MathUtils.smoothstep(y, -.08, .55));
      colors.push(color.r, color.g, color.b);
      uvs.push(u, j / around);
      if (i < along && j < around) {
        const a = i * (around + 1) + j, b = a + around + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  // The inner end is inside the trunk; the outer end is entirely underground.
  for (let j = 1; j < around - 1; j++) {
    indices.push(0, j + 1, j);
    const end = along * (around + 1);
    indices.push(end, end + j, end + j + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // Weld the duplicate seam normals without losing the UV seam.
  const normals = geo.attributes.normal;
  for (let i = 0; i <= along; i++) {
    const a = i * (around + 1), b = a + around;
    const n = new THREE.Vector3().fromBufferAttribute(normals, a)
      .add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize();
    normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z);
  }
  return geo;
}
