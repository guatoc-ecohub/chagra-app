/* global process, console, setTimeout */
// sonda-leaflet — ¿qué icono pinta un L.marker() SIN icono propio en el dist?
// Carga el chunk de Leaflet empaquetado y su CSS, crea un mapa sin teselas,
// pone dos marcadores (uno por defecto, uno con el icono explícito de la app si
// el chunk que lo fija está cargado) y lee src + naturalWidth del <img>.
// Uso: node sonda-leaflet.mjs <etiqueta> [modulo-que-se-carga-antes]
import http from 'node:http';
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

// Chromium del sistema: $CHROMIUM_PATH o el primero que resuelva el PATH.
const chromiumDelSistema = () => process.env.CHROMIUM_PATH || execFileSync('sh', ['-c', 'command -v chromium'], { encoding: 'utf8' }).trim();

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(aqui, '../../dist');
const [etiqueta = 'sin-etiqueta'] = process.argv.slice(2);
const assets = readdirSync(path.join(dist, 'assets'));
const chunkJs = assets.find((n) => /^leaflet-[^.]+\.js$/.test(n));
const chunkCss = assets.find((n) => /^leaflet-[^.]+\.css$/.test(n));
const chunkPicker = assets.find((n) => /^MapPicker-[^.]+\.js$/.test(n));

const servidor = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/__mapa__.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><link rel="stylesheet" href="/assets/${chunkCss}"><div id="m" style="width:300px;height:200px"></div>`);
    return;
  }
  const f = path.join(dist, url);
  if (!f.startsWith(dist) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': /\.m?js$/.test(f) ? 'text/javascript' : /\.css$/.test(f) ? 'text/css' : 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const origen = `http://127.0.0.1:${servidor.address().port}`;

const navegador = await chromium.launch({ executablePath: chromiumDelSistema(), headless: true });
const page = await navegador.newPage();
const fallas = [];
page.on('response', (r) => { if (r.request().resourceType() === 'image' && r.status() >= 400) fallas.push(`${r.status()} ${r.url().replace(origen, '')}`); });
await page.goto(`${origen}/__mapa__.html`);
const r = await page.evaluate(async ({ chunkJs, chunkPicker }) => {
  // Primero el chunk real de MapPicker: sus efectos de módulo (si los hay) son
  // los que viven en producción cuando se abre el selector de mapa.
  let pickerCargado = 'sin chunk';
  if (chunkPicker) pickerCargado = await import(`/assets/${chunkPicker}`).then(() => 'si', (e) => `error: ${String(e).slice(0, 80)}`);
  const mod = await import(`/assets/${chunkJs}`);
  const fabrica = Object.values(mod).find((v) => typeof v === 'function');
  const L = fabrica();
  const mapa = L.map('m', { center: [4.6, -74.1], zoom: 8 });
  const mk = L.marker([4.6, -74.1]).addTo(mapa);
  const img = mk.getElement();
  await new Promise((ok) => (img.complete ? ok() : (img.onload = img.onerror = ok)));
  await new Promise((ok) => setTimeout(ok, 500));
  return { pickerCargado, src: img.getAttribute('src').slice(0, 60), naturalWidth: img.naturalWidth };
}, { chunkJs, chunkPicker });
await page.screenshot({ path: path.join(aqui, 'capturas', `leaflet-${etiqueta}.png`), clip: { x: 0, y: 0, width: 320, height: 220 } });
await navegador.close();
servidor.close();
const salida = { etiqueta, chunkJs, chunkCss, chunkPicker, marcadorPorDefecto: r, fallasRed: fallas };
mkdirSync(path.join(aqui, 'capturas'), { recursive: true });
writeFileSync(path.join(aqui, `sonda-leaflet-${etiqueta}.json`), JSON.stringify(salida, null, 2));
console.log(JSON.stringify(salida));
