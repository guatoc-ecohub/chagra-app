/* global process, console */
// checkimg-v2 — mismo regex y misma resolución que checkimg.mjs, con cuatro
// correcciones de falsos positivos, cada una visible en la salida:
//   1. quita comentarios (/* */ y // de línea) antes de buscar: un comentario
//      que cita una lámina no es una petición de imagen;
//   2. no revisa pruebas (__tests__, *.test.*, *.spec.*): son fixtures;
//   3. resuelve especificadores de paquete contra node_modules (leaflet/...);
//   4. aplica excepciones.tsv: pares (archivo, ruta) que NO son una imagen que
//      la app pida, con su razón escrita. Una excepción que ya no aparece se
//      reporta como «excepción sobrante» para que la lista no se pudra.
// En modo dist además: una ruta `public/x` se busca en dist/x, y una ruta de
// catalog/fotos se acepta solo si el archivo fuente existe (es la clave de
// atribución que viaja en el JSON; la URL servida es /assets/<nombre>-<hash>).
// public/valle y dist/valle son una copia sincronizada de otro repo: se
// cuentan aparte (--valle) y no entran en la cifra de la app.
//
// Uso: node checkimg-v2.mjs <raiz> <src|dist> [--valle]
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [root, mode, flag] = process.argv.slice(2);
const soloValle = flag === '--valle';
const base = mode === 'dist' ? path.join(root, 'dist') : root;
const aqui = path.dirname(fileURLToPath(import.meta.url));

const esValle = (rel) => /^(public|dist)\/valle\//.test(rel);
const esPrueba = (rel) => /(^|\/)__tests__\/|\.(test|spec)\.[cm]?[jt]sx?$/.test(rel);

const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = path.join(d, n);
  if (mode !== 'dist' && /node_modules|\.git$|^dist$/.test(n)) return [];
  const s = statSync(p);
  return s.isDirectory() ? walk(p) : [p];
});

const files = (mode === 'dist'
  ? walk(base)
  : ['src', 'public', 'index.html', 'mercado.html', 'species-visor.html', 'lib3d', 'scripts', 'catalog']
    .map((x) => path.join(root, x)).filter(existsSync)
    .flatMap((p) => (statSync(p).isDirectory() ? walk(p) : [p])))
  .filter((f) => /\.(m?js|jsx|ts|html|css|json)$/.test(f));

const sinComentarios = (t, f) => {
  if (/\.json$/.test(f)) return t;
  return t
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/([;{}),])\s*\/\/[^'"`\n]*$/gm, '$1');
};

const excepciones = readFileSync(path.join(aqui, 'excepciones.tsv'), 'utf8')
  .split('\n').filter((l) => l && !l.startsWith('#'))
  .map((l) => { const [archivo, ref, razon, debeExistir = ''] = l.split('\t'); return { archivo, ref, razon, debeExistir, usada: 0 }; });
const buscaExcepcion = (rel, ref) => excepciones.find((e) => (e.archivo === rel || (e.archivo.endsWith('*') && rel.startsWith(e.archivo.slice(0, -1)))) && e.ref === ref);

const re = /["'`(]((?:\.{1,2}\/|\/)?[A-Za-z0-9_\-./]+\.(?:jpe?g|png|webp|gif|avif))(?=["'`)?#])/gi;
let total = 0; const rotas = []; const conteo = { comentario: 0, prueba: 0, paquete: 0, excepcion: 0, catalogo: 0 };

for (const f of files) {
  const rel = path.relative(root, f);
  if (soloValle !== esValle(rel)) continue;
  if (esPrueba(rel)) { conteo.prueba += [...readFileSync(f, 'utf8').matchAll(re)].length; continue; }
  const crudo = readFileSync(f, 'utf8');
  const t = sinComentarios(crudo, f);
  conteo.comentario += [...crudo.matchAll(re)].length - [...t.matchAll(re)].length;
  for (const m of t.matchAll(re)) {
    const ref = m[1];
    if (/^\/\//.test(ref) || ref.includes('${')) continue;
    total++;
    const cands = [];
    if (ref.startsWith('/')) { cands.push(path.join(base, mode === 'dist' ? '' : 'public', ref)); if (mode !== 'dist') cands.push(path.join(root, ref)); }
    else if (ref.startsWith('.')) cands.push(path.resolve(path.dirname(f), ref));
    else {
      cands.push(path.resolve(path.dirname(f), ref));
      cands.push(path.join(base, mode === 'dist' ? '' : 'public', ref));
      if (mode !== 'dist') cands.push(path.join(root, ref));
      if (mode === 'dist' && ref.startsWith('public/')) cands.push(path.join(base, ref.slice('public/'.length)));
    }
    if (cands.some(existsSync)) continue;
    if (!ref.startsWith('.') && !ref.startsWith('/') && existsSync(path.join(root, 'node_modules', ref))) { conteo.paquete++; continue; }
    if (mode === 'dist' && /^\/?catalog\/fotos\//.test(ref) && existsSync(path.join(root, ref.replace(/^\//, '')))) { conteo.catalogo++; continue; }
    const e = buscaExcepcion(rel.replace(/-[A-Za-z0-9_-]{8}\.js$/, '-*.js'), ref) || buscaExcepcion(rel, ref);
    if (e && (!e.debeExistir || existsSync(path.join(root, e.debeExistir)))) { e.usada++; conteo.excepcion++; continue; }
    if (e) { rotas.push(`${rel}: ${ref} (excepción inválida: falta ${e.debeExistir})`); continue; }
    rotas.push(`${rel}: ${ref}`);
  }
}

const unicas = [...new Set(rotas)];
console.log(`modo: ${mode}${soloValle ? ' (solo valle sincronizado)' : ' (app, sin valle)'} · refs revisadas: ${total} · sin archivo: ${rotas.length} (${unicas.length} únicas)`);
console.log(`descartadas: comentarios ${conteo.comentario} · pruebas ${conteo.prueba} · paquetes ${conteo.paquete} · claves de catalog/fotos ${conteo.catalogo} · excepciones ${conteo.excepcion}`);
if (!soloValle) {
  const sobrantes = excepciones.filter((e) => e.usada === 0 && (e.archivo.startsWith('dist/') === (mode === 'dist')));
  if (sobrantes.length) console.log(`excepciones sobrantes (${sobrantes.length}):\n${sobrantes.map((e) => `  ${e.archivo}\t${e.ref}`).join('\n')}`);
}
if (unicas.length) console.log(unicas.join('\n'));
