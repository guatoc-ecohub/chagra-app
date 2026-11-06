/* EL GRABADO del pelaje: rayado fino de buril como en las láminas, no relleno
   plano. Trazos cortos deterministas (semilla fija, sin azar en el render),
   cada uno orientado por el flujo del pelo en su zona. Todos los trazos de una
   capa van en UN solo path: el peso en nodos del SVG no crece con la densidad. */
export function grabado({ x0, x1, y0, y1, n, semilla, largo = 0.85, flujo }) {
  let g = semilla >>> 0;
  const azar = () => ((g = (Math.imul(g, 1664525) + 1013904223) >>> 0) / 4294967296);
  let d = '';
  for (let i = 0; i < n; i += 1) {
    const x = x0 + azar() * (x1 - x0);
    const y = y0 + azar() * (y1 - y0);
    const a = flujo(x, y) + (azar() - 0.5) * 0.55;
    const l = largo * (0.65 + azar() * 0.7);
    d += `M${x.toFixed(1)},${y.toFixed(1)}l${(Math.cos(a) * l).toFixed(1)},${(Math.sin(a) * l).toFixed(1)}`;
  }
  return d;
}
