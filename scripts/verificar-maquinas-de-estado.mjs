// SPDX-License-Identifier: AGPL-3.0-only
// Verifica docs/maquinas-de-estado.md: cada `archivo:línea` existe y contiene la variable citada.
// Uso: node scripts/verificar-maquinas-de-estado.mjs [ruta-del-doc]
/* global process, console */
import { readFileSync, existsSync } from 'node:fs';
const doc = readFileSync(process.argv[2] || 'docs/maquinas-de-estado.md', 'utf8').split('\n');
let filas = 0, refs = 0, conVar = 0, sec = 0; const fallos = [];
const cache = new Map();
const L = (f) => cache.get(f) || cache.set(f, readFileSync(f, 'utf8').split('\n')).get(f);
for (const [i, linea] of doc.entries()) {
  for (const m of linea.matchAll(/`((?:src|lib3d)\/[\w./-]+):(\d+)`/g)) {
    refs++;
    const [, f, n] = m;
    if (!existsSync(f)) { fallos.push(`doc L${i + 1}: no existe ${f}`); continue; }
    if (Number(n) < 1 || Number(n) > L(f).length) fallos.push(`doc L${i + 1}: ${f} no tiene línea ${n}`);
  }
  const fila = linea.match(/^\| `((?:src|lib3d)\/[\w./-]+):(\d+)` \| `(\w+)`/);
  if (fila) {
    filas++;
    const [, f, n, v] = fila;
    if (!existsSync(f)) continue;
    const texto = L(f)[Number(n) - 1] || '';
    if (texto.includes(v)) conVar++; else fallos.push(`doc L${i + 1}: ${f}:${n} no contiene «${v}» → ${texto.trim().slice(0, 80)}`);
    // Variables secundarias «`nombre` (L123)» y líneas sueltas «L123» de la misma fila.
    for (const s2 of linea.matchAll(/`(\w+)` \(L(\d+)\)/g)) {
      sec++;
      const t2 = L(f)[Number(s2[2]) - 1] || '';
      if (!t2.toLowerCase().includes(s2[1].toLowerCase())) fallos.push(`doc L${i + 1}: ${f}:${s2[2]} no contiene «${s2[1]}» → ${t2.trim().slice(0, 80)}`);
    }
    for (const s3 of linea.matchAll(/\bL(\d+)\b/g)) {
      if (Number(s3[1]) > L(f).length) fallos.push(`doc L${i + 1}: ${f} no tiene línea ${s3[1]}`);
    }
  }
}
console.log(`referencias archivo:línea: ${refs} · filas con variable comprobada: ${conVar}/${filas} · variables secundarias comprobadas: ${sec} · fallos: ${fallos.length}`);
for (const f of fallos) console.log('  ✗', f);
process.exit(fallos.length ? 1 : 0);
