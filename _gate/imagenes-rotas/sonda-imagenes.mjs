/* global process, console, setTimeout, document, window, location, indexedDB */
// sonda-imagenes — sirve dist/ con un servidor estático propio (fallback SPA),
// recorre rutas de la app con el Chromium del sistema y anota TODA imagen que
// falla: respuesta >= 400 de tipo image, petición fallida, o <img> completo con
// naturalWidth 0 (hueco roto visible). Captura cada ruta en capturas/<etiqueta>/.
//
// Uso: node sonda-imagenes.mjs <etiqueta> [ruta1,ruta2,...]
// Control positivo: la ruta especial `__control__` pinta un <img> a un archivo
// inexistente; si la sonda no lo cuenta, la sonda está ciega y sale con 3.
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

// Chromium del sistema: $CHROMIUM_PATH o el primero que resuelva el PATH.
const chromiumDelSistema = () => process.env.CHROMIUM_PATH || execFileSync('sh', ['-c', 'command -v chromium'], { encoding: 'utf8' }).trim();

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '../..');
const dist = path.join(raiz, 'dist');
const [etiqueta = 'sin-etiqueta', lista] = process.argv.slice(2);
const RUTAS = (lista || 'dashboard,animales_abejas,fermentos,biodiversidad,citricos,frutales,aguacate,mango,cacao,cafe,cana,fique,hortalizas,aromaticas,almacenamiento,estiercol,milpa,plagas,especies,directorio,biopreparados,botica,agente,mercado,perfil,herbario_vivo,toxicologia,sanidad_sintoma').split(',');

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.sqlite': 'application/octet-stream', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const servidor = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/__blank__.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>blank</title>'); return; }
  if (url === '/__control__.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><img id="c" src="/no-existe-control.jpg" alt="control">');
    return;
  }
  let f = path.join(dist, url);
  if (!f.startsWith(dist)) { res.writeHead(403); res.end(); return; }
  if (existsSync(f) && statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!existsSync(f)) {
    // Fallback SPA solo para navegación; un recurso con extensión da 404 real.
    if (path.extname(url)) { res.writeHead(404); res.end(); return; }
    f = path.join(dist, 'index.html');
  }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const puerto = servidor.address().port;
const origen = `http://127.0.0.1:${puerto}`;

const navegador = await chromium.launch({ executablePath: chromiumDelSistema(), headless: true });
const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
// Sesión local falsa (no hay backend): localforage({name:'Chagra',storeName:'syncQueue'})
// guarda el token en IndexedDB 'Chagra' / 'syncQueue'. Se siembra UNA vez, en una
// página en blanco del mismo origen, antes de abrir la app.
{
  const p = await ctx.newPage();
  await p.goto(`${origen}/__blank__.html`);
  await p.evaluate(() => new Promise((ok, mal) => {
    const req = indexedDB.open('Chagra');
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('syncQueue')) req.result.createObjectStore('syncQueue'); };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('syncQueue', 'readwrite');
      tx.objectStore('syncQueue').put('sonda-token-falso', 'farmos_access_token');
      tx.objectStore('syncQueue').put(Date.now() + 864e5, 'farmos_token_expiry');
      tx.oncomplete = () => { db.close(); ok(); };
      tx.onerror = () => mal(tx.error);
    };
    req.onerror = () => mal(req.error);
  }));
  await p.close();
}
const salida = path.join(aqui, 'capturas', etiqueta);
mkdirSync(salida, { recursive: true });

const medir = async (url, nombre) => {
  const page = await ctx.newPage();
  const fallas = [];
  page.on('response', (r) => { if (r.request().resourceType() === 'image' && r.status() >= 400) fallas.push(`${r.status()} ${r.url().replace(origen, '')}`); });
  page.on('requestfailed', (r) => { if (r.resourceType() === 'image') fallas.push(`FALLA ${r.failure()?.errorText} ${r.url().replace(origen, '')}`); });
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e.message).slice(0, 160)));
  await page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch((e) => errores.push(`goto: ${e.message.slice(0, 120)}`));
  await page.waitForTimeout(3500);
  // Fuerza la carga de imágenes perezosas recorriendo la página.
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); }).catch(() => {});
  await page.waitForTimeout(1500);
  const rotasDom = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.src)).map((i) => (i.currentSrc || i.src).replace(location.origin, ''))).catch(() => ['(no pude leer el DOM)']);
  const nImg = await page.evaluate(() => document.images.length).catch(() => -1);
  const texto = await page.evaluate(() => document.body.innerText.slice(0, 80).replace(/\s+/g, ' ')).catch(() => '');
  await page.screenshot({ path: path.join(salida, `${nombre}.png`), fullPage: false }).catch(() => {});
  await page.close();
  return { ruta: nombre, imgs: nImg, fallasRed: [...new Set(fallas)], rotasDom: [...new Set(rotasDom)], errores: errores.slice(0, 3), texto };
};

const control = await medir(`${origen}/__control__.html`, '__control__');
const controlOk = control.fallasRed.length > 0 && control.rotasDom.length > 0;
const resultados = [];
for (const r of RUTAS) resultados.push(await medir(`${origen}/#/${r}`, r));
await navegador.close();
servidor.close();

const informe = { etiqueta, origen: 'dist servido localmente', control: { ...control, ok: controlOk }, resultados };
writeFileSync(path.join(aqui, `sonda-${etiqueta}.json`), JSON.stringify(informe, null, 2));
console.log(`control positivo: ${controlOk ? 'DETECTA' : 'CIEGO'} (${control.fallasRed.join(' | ')})`);
for (const x of resultados) console.log(`${x.ruta.padEnd(18)} imgs=${String(x.imgs).padStart(3)} red=${x.fallasRed.length} dom=${x.rotasDom.length} ${x.fallasRed.concat(x.rotasDom).slice(0, 4).join(' ; ')} ${x.errores.length ? '[pageerror] ' + x.errores[0] : ''} «${x.texto.slice(0, 40)}»`);
process.exit(controlOk ? 0 : 3);
