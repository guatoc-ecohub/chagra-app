/* global process, console */
// Uso: node checkimg.mjs <raiz-repo> <modo: src|dist>
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
const [root, mode] = process.argv.slice(2);
const base = mode === 'dist' ? path.join(root, 'dist') : root;
const walk = d => readdirSync(d).flatMap(n => { const p = path.join(d, n); if (/node_modules|\.git$|^dist$/.test(n) && mode !== 'dist') return n === 'dist' ? [] : []; const s = statSync(p); return s.isDirectory() ? walk(p) : [p]; });
const files = (mode === 'dist' ? walk(base) : ['src', 'public', 'index.html', 'mercado.html', 'species-visor.html', 'lib3d', 'scripts', 'catalog'].map(x => path.join(root, x)).filter(existsSync).flatMap(p => statSync(p).isDirectory() ? walk(p) : [p]))
  .filter(f => /\.(m?js|jsx|ts|html|css|json)$/.test(f));
const re = /["'`(]((?:\.{1,2}\/|\/)?[A-Za-z0-9_\-./]+\.(?:jpe?g|png|webp|gif|avif))(?=["'`)?#])/gi;
let total = 0; const rotas = [];
for (const f of files) {
  const t = readFileSync(f, 'utf8');
  for (const m of t.matchAll(re)) {
    const ref = m[1];
    if (/^\/\//.test(ref) || ref.includes('${')) continue;
    total++;
    const cands = [];
    if (ref.startsWith('/')) { cands.push(path.join(base, mode === 'dist' ? '' : 'public', ref)); if (mode !== 'dist') cands.push(path.join(root, ref)); }
    else if (ref.startsWith('.')) cands.push(path.resolve(path.dirname(f), ref));
    else { cands.push(path.resolve(path.dirname(f), ref)); cands.push(path.join(base, mode === 'dist' ? '' : 'public', ref)); if (mode !== 'dist') cands.push(path.join(root, ref)); }
    if (!cands.some(existsSync)) rotas.push(`${path.relative(root, f)}: ${ref}`);
  }
}
console.log(`refs revisadas: ${total} · sin archivo: ${rotas.length}`);
console.log([...new Set(rotas)].join('\n'));
