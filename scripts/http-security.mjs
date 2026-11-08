import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { URL } from 'node:url';

// Orígenes externos que la app usa de verdad. Ninguna directiva admite la
// fuente `https:` suelta: cada origen nuevo se agrega aquí con su uso.
//
// script-src incluye static.cloudflareinsights.com (bug consola prod
// STEV-03/C12, 2026-10-31): Cloudflare inyecta el beacon de Web Analytics
// en el borde de la zona (fuera de este repo); el beacon reporta a
// cloudflareinsights.com, que va en connect-src.
const API_ORIGINS = [
  'https://api.open-meteo.com', // agroMeteoService, skyConditionService, locationService (elevación)
  'https://archive-api.open-meteo.com', // agroMeteoService (histórico)
  'https://nominatim.openstreetmap.org', // locationService (geocodificación)
  'https://overpass-api.de', // veredaService
  'https://api.open-elevation.com', // altitudeService
  'https://api.gbif.org', // speciesImageService
  'https://files.isric.org', // soilGridsService (VRT y GeoTIFF de SoilGrids)
  'https://commons.wikimedia.org', // speciesImageService (API de imágenes)
  'https://cdn.jsdelivr.net', // troika-three-text (<Text> de drei): fuentes de respaldo
  'https://cloudflareinsights.com', // reporte del beacon de Web Analytics
];

// Teselas de Leaflet: plantillas https://{s}.tile.openstreetmap.org y
// https://{s}.tile.osm.org, con los subdominios por omisión a, b y c.
const MAP_TILE_ORIGINS = ['a', 'b', 'c'].flatMap(sub => [
  `https://${sub}.tile.openstreetmap.org`,
  `https://${sub}.tile.osm.org`,
]);

// Fotos de especies: los hosts de `image_url` en public/species-images.json
// (assertSpeciesImageHostsAllowed frena el build si aparece uno nuevo) más
// upload.wikimedia.org, que sirve las imágenes que devuelve la API de Commons.
// Una foto que GBIF devuelva en vivo desde otro host queda bloqueada y la
// ficha muestra su respaldo sin foto.
export const SPECIES_IMAGE_HOSTS = [
  'api.jacq.org',
  'arter.dk',
  'beaty.b-cdn.net',
  'collections.nmnh.si.edu',
  'd2jcv3kl45hlgi.cloudfront.net',
  'ia601208.us.archive.org',
  'ibss-images.calacademy.org',
  'iiif.rbge.org.uk',
  'images.ala.org.au',
  'inaturalist-open-data.s3.amazonaws.com',
  'indiabiodiversity.org',
  'jbrj-public-img.s3-sa-east-1.amazonaws.com',
  'media.tepapa.govt.nz',
  'media01.symbiota.org',
  'medialib.naturalis.nl',
  'object.jacq.org',
  'observation.org',
  'oxalis.br.fgov.be',
  'plant.depo.msu.ru',
  'portal.wiktrop.org',
  'restor2-prod-1-api.restor.eco',
  'storage.googleapis.com',
  'sweetgum.nybg.org',
  'upload.wikimedia.org',
  'was.tacc.utexas.edu',
  'web.corral.tacc.utexas.edu',
  'www.digitalis.uzh.ch',
  'www.plantarium.ru',
  'www.uc.edu',
];

// La CSP se evalúa también en cada redirección: estos son los destinos a los
// que redirigen hoy algunas de esas URL (medido con curl -L sobre las 543).
const SPECIES_IMAGE_REDIRECT_HOSTS = [
  'co3-api-mediastorage.s3.ap-southeast-2.amazonaws.com', // media.tepapa.govt.nz
  'ids.si.edu', // collections.nmnh.si.edu
  'pictures.bgbm.org', // api.jacq.org
  'webapps.uc.edu', // www.uc.edu
];

const IMAGE_ORIGINS = [
  ...MAP_TILE_ORIGINS,
  ...[...SPECIES_IMAGE_HOSTS, ...SPECIES_IMAGE_REDIRECT_HOSTS].map(host => `https://${host}`),
];

// Variables de build que pueden apuntar a otro origen. Vacías o relativas
// (proxy en el mismo origen) no agregan nada.
const ENV_CONNECT_ORIGINS = [
  'VITE_FARMOS_URL',
  'VITE_PUBLIC_FINCA_FARMOS_URL',
  'VITE_ELEVATION_API_URL',
  'VITE_NOMINATIM_URL',
  'VITE_CHAGRA_CATALOG_URL',
];

export function envConnectOrigins(env = {}) {
  const origins = new Set();
  for (const name of ENV_CONNECT_ORIGINS) {
    const value = String(env[name] || '').trim();
    if (!/^https?:\/\//i.test(value)) continue;
    origins.add(new URL(value).origin);
  }
  return [...origins];
}

export function buildContentSecurityPolicy({ extraConnectOrigins = [], frameAncestors = true } = {}) {
  // El service worker vuelve a pedir con fetch() los GET de otro origen y
  // speciesImageService precarga las fotos con fetch(): por eso los orígenes
  // de imagen también van en connect-src.
  const connect = [...new Set([...API_ORIGINS, ...IMAGE_ORIGINS, ...extraConnectOrigins])];
  return [
    "default-src 'self'",
    "frame-src 'self' https://3d.guatoc.co",
    "script-src 'self' 'wasm-unsafe-eval' blob: https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${IMAGE_ORIGINS.join(' ')}`,
    `connect-src 'self' ${connect.join(' ')}`,
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // frame-ancestors no tiene efecto en <meta>; solo va en el encabezado.
    ...(frameAncestors ? ["frame-ancestors 'self'"] : []),
  ].join('; ') + ';';
}

export const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy();

function directives(policy) {
  return policy.split(';').map(item => item.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

const META_CSP = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/;

// index.html lleva la misma política escrita a mano (para leerla en el fuente);
// el build falla si se desincroniza, y la <meta> servida se reescribe desde aquí.
export function syncIndexMetaPolicy(html, policy) {
  const match = META_CSP.exec(html);
  if (!match) throw new Error('index.html sin <meta http-equiv="Content-Security-Policy">.');
  const expected = directives(buildContentSecurityPolicy({ frameAncestors: false }));
  const actual = directives(match[2]);
  if (actual.join('; ') !== expected.join('; ')) {
    throw new Error(`La CSP de index.html no coincide con scripts/http-security.mjs.\nindex.html: ${actual.join('; ')}\nesperada:   ${expected.join('; ')}`);
  }
  return html.replace(META_CSP, `$1${policy}$3`);
}

export function assertSpeciesImageHostsAllowed(publicDir) {
  const file = join(publicDir, 'species-images.json');
  if (!existsSync(file)) return;
  const allowed = new Set(SPECIES_IMAGE_HOSTS);
  const missing = new Set();
  for (const entry of JSON.parse(readFileSync(file, 'utf8')).species || []) {
    if (!entry?.image_url) continue;
    const host = new URL(entry.image_url).hostname;
    if (!allowed.has(host)) missing.add(host);
  }
  if (missing.size) {
    throw new Error(`species-images.json usa hosts fuera de la CSP (agréguelos a SPECIES_IMAGE_HOSTS): ${[...missing].join(', ')}`);
  }
}

// Dev only: @vitejs/plugin-react injects one inline module (the Fast Refresh
// preamble). Under the strict script-src it never runs and every component
// throws "can't detect preamble". Allow exactly that text by hash, never
// 'unsafe-inline'. The production policy above is not touched.
export function withScriptHashes(policy, hashes) {
  if (!hashes.length) return policy;
  return policy.replace(/(script-src [^;]*)/, `$1 ${hashes.join(' ')}`);
}

export function inlineScriptHash(code) {
  return `'sha256-${createHash('sha256').update(code).digest('base64')}'`;
}

const RAW_TEXT_TAGS = new Set(['iframe', 'noembed', 'noframes', 'plaintext', 'style', 'textarea', 'title', 'xmp']);

function closingTagFor(html, tagName, start) {
  const closingTag = new RegExp(`</${tagName}\\s*>`, 'ig');
  closingTag.lastIndex = start;
  return closingTag.exec(html);
}

function inlineScriptBodies(html) {
  const bodies = [];
  const tagOrComment = /<!--|<(\/?)((?:[a-z][\w:-]*))\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
  let tagMatch;

  while ((tagMatch = tagOrComment.exec(html))) {
    if (tagMatch[0] === '<!--') {
      const commentEnd = html.indexOf('-->', tagOrComment.lastIndex);
      tagOrComment.lastIndex = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }

    const isClosing = tagMatch[1] === '/';
    const tagName = tagMatch[2].toLowerCase();
    if (isClosing) continue;

    if (RAW_TEXT_TAGS.has(tagName)) {
      if (tagName === 'plaintext') {
        tagOrComment.lastIndex = html.length;
        continue;
      }
      const close = closingTagFor(html, tagName, tagOrComment.lastIndex);
      tagOrComment.lastIndex = close ? close.index + close[0].length : html.length;
      continue;
    }

    if (tagName !== 'script') continue;

    const attributes = tagMatch[0].slice(1 + tagMatch[1].length + tagName.length, -1);
    const hasSrc = /(?:^|\s)src(?:\s*=|\s|$)/i.test(attributes);
    const contentStart = tagOrComment.lastIndex;
    const close = closingTagFor(html, 'script', contentStart);
    if (!close) throw new Error('Unclosed <script> in a descensos HTML page.');

    if (!hasSrc) {
      // HTML input preprocessing turns CRLF and CR into LF before the browser
      // hashes the script text. Preserve every other character and whitespace.
      bodies.push(html.slice(contentStart, close.index).replace(/\r\n?/g, '\n'));
    }
    tagOrComment.lastIndex = close.index + close[0].length;
  }

  return bodies;
}

export function collectDescensosScriptHashes(publicDir) {
  const descensosDir = join(publicDir, 'descensos');
  const pages = readdirSync(descensosDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(descensosDir, entry.name, 'index.html'))
    .filter(page => existsSync(page))
    .sort();

  if (!pages.length) {
    throw new Error(`No lesson pages found under ${descensosDir}/<slug>/index.html.`);
  }

  const hashes = new Set();
  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    for (const code of inlineScriptBodies(html)) hashes.add(inlineScriptHash(code));
  }
  return [...hashes].sort();
}

function isDescensosPath(url) {
  const pathname = String(url || '/').split(/[?#]/, 1)[0];
  return pathname === '/descensos' || pathname.startsWith('/descensos/');
}

export function httpSecurityHeaders({ devInlineScripts = [] } = {}) {
  const devHashes = devInlineScripts.map(inlineScriptHash);
  let descensosHashes = [];
  const install = (server, pagePolicy, descensosPolicy) => {
    server.middlewares.use((req, res, next) => {
      // Static servers may set caching after this middleware. Keep their freshness
      // directives while preserving the proxy transformation veto.
      const setHeader = res.setHeader.bind(res);
      res.setHeader = (name, value) => {
        if (name.toLowerCase() === 'cache-control') {
          const directives = (Array.isArray(value) ? value.join(', ') : String(value)).split(',').map(item => item.trim());
          if (!directives.some(item => item.toLowerCase() === 'no-transform')) directives.push('no-transform');
          value = directives.join(', ');
        }
        return setHeader(name, value);
      };
      const policy = isDescensosPath(req.url) ? descensosPolicy : pagePolicy;
      res.setHeader('Content-Security-Policy', policy);
      res.setHeader('Cache-Control', 'no-transform');
      next();
    });
  };

  let appPolicy = CONTENT_SECURITY_POLICY;
  let metaPolicy = buildContentSecurityPolicy({ frameAncestors: false });
  let indexHtmlFile = null;
  const descensosPolicy = () => withScriptHashes(appPolicy, descensosHashes);
  return {
    name: 'chagra-http-security',
    configResolved(config) {
      if (!config.publicDir) throw new Error('httpSecurityHeaders requires Vite publicDir for the descensos CSP.');
      descensosHashes = collectDescensosScriptHashes(config.publicDir);
      assertSpeciesImageHostsAllowed(config.publicDir);
      const extraConnectOrigins = envConnectOrigins(config.env);
      appPolicy = buildContentSecurityPolicy({ extraConnectOrigins });
      metaPolicy = buildContentSecurityPolicy({ extraConnectOrigins, frameAncestors: false });
      indexHtmlFile = resolve(config.root, 'index.html');
    },
    configureServer: server => install(
      server,
      withScriptHashes(appPolicy, devHashes),
      descensosPolicy(),
    ),
    configurePreviewServer: server => install(server, appPolicy, descensosPolicy()),
    transformIndexHtml(html, ctx) {
      const hashes = ctx.server ? devHashes : [];
      if (ctx.filename && resolve(ctx.filename) === indexHtmlFile) {
        return syncIndexMetaPolicy(html, withScriptHashes(metaPolicy, hashes));
      }
      if (!hashes.length) return html;
      return html.replace(/(<meta http-equiv="Content-Security-Policy"[^>]*?script-src [^;]*)/, `$1 ${hashes.join(' ')}`);
    },
    generateBundle() {
      const lessonPolicy = descensosPolicy();
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: `/*\n  Content-Security-Policy: ${appPolicy}\n  Cache-Control: no-transform\n\n/descensos/*\n  Content-Security-Policy: ${lessonPolicy}\n  Cache-Control: no-transform\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'security-headers.conf',
        source: `add_header Content-Security-Policy "${appPolicy}" always;\nadd_header Cache-Control "no-transform" always;\n\nlocation ^~ /descensos/ {\n    add_header Content-Security-Policy "${lessonPolicy}" always;\n    add_header Cache-Control "no-transform" always;\n}\n`,
      });
    },
  };
}
