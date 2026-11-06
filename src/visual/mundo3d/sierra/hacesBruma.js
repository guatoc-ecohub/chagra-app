/** Adaptación local: conserva intacta la fuente vendorizada y su licencia. */
export function calibrarHacesBruma(grupo, alturaSuelo) {
  const mesh = grupo.getObjectByName('haces-luz');
  if (!mesh) return;
  const posiciones = mesh.geometry.getAttribute('position');
  // Cada quad parte de una base común. Escalar el mesh movería también las
  // anclas del bosque hacia el origen; aquí solo encogemos cada haz.
  const escala = 0.055;
  for (let i = 0; i < posiciones.count; i += 4) {
    const x = (posiciones.getX(i) + posiciones.getX(i + 1)) / 2;
    const y = (posiciones.getY(i) + posiciones.getY(i + 1)) / 2;
    const z = (posiciones.getZ(i) + posiciones.getZ(i + 1)) / 2;
    const suelo = alturaSuelo(x, z) + 0.15 * escala;
    for (let j = i; j < i + 4; j++) {
      posiciones.setXYZ(j,
        x + (posiciones.getX(j) - x) * escala,
        suelo + (posiciones.getY(j) - y) * escala,
        z + (posiciones.getZ(j) - z) * escala);
    }
  }
  posiciones.needsUpdate = true;
  mesh.geometry.computeBoundingSphere();
  // El shader original usa metros de bosque. Su contrato queda comprobado
  // en el test de integración para detectar cambios en la fuente vendorizada.
  mesh.material.vertexShader = mesh.material.vertexShader
    .replace('smoothstep(2.0, 7.0, d)', 'smoothstep(0.08, 0.3, d)')
    .replace('smoothstep(90.0, 150.0, d)', 'smoothstep(4.5, 9.5, d)');
  mesh.material.fragmentShader = mesh.material.fragmentShader.replace(
    'float a = texture2D(uMapaH, vUv).a * vAlfaH;',
    'float a = texture2D(uMapaH, vUv).a * vAlfaH * (1.0 - smoothstep(0.65, 1.0, vUv.y));',
  );
  mesh.material.needsUpdate = true;
}
