import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { httpSecurityHeaders } from './scripts/http-security.mjs'
import { offlineShellAssetsPlugin } from './scripts/offline-shell-assets.mjs'
import { homeFrameScripts } from './scripts/home-frame-scripts.mjs'

// SHA del build para el self-heal por versión (src/services/versionCheck.js).
// Prioridad:
//   1. VITE_BUILD_SHA del entorno (deploy.yml lo setea con `git rev-parse
//      --short HEAD` — fuente de verdad del SHA desplegado, alineado con el
//      CACHE_NAME `chagra-<sha>` que deja el step "Bump SW cache version").
//   2. `git rev-parse --short HEAD` local (dev/build manual).
//   3. 'dev' si no hay git (tarball, sandbox). Con 'dev' el self-heal es no-op.
function resolveBuildSha() {
  if (process.env.VITE_BUILD_SHA) return process.env.VITE_BUILD_SHA.trim();
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

const BUILD_SHA = resolveBuildSha();

function resolveRagEmbeddingsSha() {
  try {
    const embeddings = readFileSync(resolve(import.meta.dirname, 'public', 'rag-embeddings.json'));
    return createHash('sha256').update(embeddings).digest('hex');
  } catch {
    return 'dev';
  }
}

const RAG_EMBEDDINGS_SHA = resolveRagEmbeddingsSha();

// Plugin DEV-ONLY: sirve `public/valle/**/*.html` (el valle 3D vanilla, ver
// src/components/ValleMarcoScreen.jsx + scripts/sync-valle.mjs) como archivo
// estático crudo, sin pasar por el pipeline de `vite dev` para *.html.
//
// POR QUÉ: `vite dev` (a diferencia de `vite preview`/nginx — sirv puro, ya
// verificado limpio) intercepta TODA request de navegación que acepta
// `text/html` con su propio middleware de "SPA fallback"/transformIndexHtml,
// e ignora los `index.html` (y cualquier *.html) que ya existen bajo
// `publicDir` — es una limitación conocida de Vite en dev (no de este repo):
// cualquier HTML anidado en `public/` distinto del root se pisa por el
// index.html DE LA APP. Sin este bypass, el iframe del marco de entrada
// carga Chagra-dentro-de-Chagra en vez del valle bajo `npm run dev` (rompe
// SOLO la experiencia de dev local — detectado por captura real de
// navegador, no por curl: curl con Accept por defecto no dispara el
// fallback y da un falso verde). El build de producción (`vite preview`,
// dist/ real) NO necesita este bypass — ahí no hay servidor de dev, solo
// archivos estáticos, y ya sirve `public/valle/**` correctamente.
function serveValleHtmlInDev() {
  const VALLE_DIR = resolve(import.meta.dirname, 'public', 'valle');
  const MIME_BY_EXT = { '.html': 'text/html; charset=utf-8' };
  return {
    name: 'chagra-serve-valle-html-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlPath = (req.url || '').split('?')[0].split('#')[0];
        if (!urlPath.startsWith('/valle/')) return next();
        if (extname(urlPath) !== '.html' && !urlPath.endsWith('/')) return next();
        const rel = urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath;
        const filePath = join(VALLE_DIR, rel.slice('/valle/'.length));
        if (!filePath.startsWith(VALLE_DIR)) {
          return next();
        }
        try {
          const contents = readFileSync(filePath);
          res.setHeader('Content-Type', MIME_BY_EXT[extname(filePath)] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(contents);
        } catch {
          next();
        }
      });
    },
  };
}

// En dev/preview replicamos la política que debe aplicar el servidor estático
// de producción: solo un nombre con hash estable puede ser immutable. HTML,
// manifest y version.json quedan fuera de esta regla y se revalidan.
function hashedAssetCacheHeaders() {
  const hashedAsset = /^\/assets\/[^/]+-[A-Za-z0-9]{8,}\.[^/]+(?:\?.*)?$/;
  return {
    name: 'chagra-hashed-asset-cache-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (hashedAsset.test(req.url || '')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (hashedAsset.test(req.url || '')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        next();
      });
    },
  };
}

// Plugin: emite dist/version.json con el SHA del build al cerrar el bundle.
// El cliente lo fetchea (no-store) para detectar que corre un bundle viejo y
// auto-recuperarse (versionCheck.runSelfHealCheck). Va a dist/ directo (no a
// public/) para no ensuciar el repo ni el watch del dev server; en dev el
// fetch de /version.json falla limpio (404) → self-heal no-op, sin romper nada.
function emitBuildMetadata() {
  let shellAssets = [];
  let outputDir;
  const collectShellAssets = offlineShellAssetsPlugin(assets => { shellAssets = assets; });
  return {
    configResolved(config) { outputDir = resolve(config.root, config.build.outDir); },
    writeBundle: collectShellAssets.writeBundle,
    name: 'chagra-emit-build-metadata',
    apply: 'build',
    closeBundle() {
      const payload = JSON.stringify(
        { sha: BUILD_SHA, builtAt: new Date().toISOString() },
        null,
        2,
      );
      try {
        writeFileSync(resolve(outputDir, 'version.json'), payload + '\n', 'utf8');
      } catch (err) {
        // No bloquear el build por esto: el self-heal degrada a no-op si falta.
        this.warn(`could not emit version.json: ${err.message}`);
      }
      try {
        const swPath = resolve(outputDir, 'sw.js');
        const sw = readFileSync(swPath, 'utf8');
        writeFileSync(
          swPath,
          sw.replaceAll('__CHAGRA_SW_BUILD_SHA__', BUILD_SHA)
            .replace('/* __CHAGRA_OFFLINE_SHELL_ASSETS__ */', shellAssets.map(url => JSON.stringify(url)).join(','))
            .replaceAll('__CHAGRA_RAG_EMBEDDINGS_SHA__', RAG_EMBEDDINGS_SHA),
          'utf8',
        );
      } catch (err) {
        this.warn(`could not stamp sw.js cache version: ${err.message}`);
      }
    },
  };
}

// Proxy de desarrollo hacia servicios locales opcionales. Las URL se leen del
// entorno (o de .env.local) y, vacías, el proxy correspondiente no se monta.
const DEV_PROXY_ENV = loadEnv('development', import.meta.dirname, 'DEV_')
const DEV_OLLAMA_URL = (DEV_PROXY_ENV.DEV_OLLAMA_URL || '').trim()
const DEV_HA_URL = (DEV_PROXY_ENV.DEV_HA_URL || '').trim()

export default defineConfig({
  plugins: [react(), homeFrameScripts(), httpSecurityHeaders({ devInlineScripts: [react.preambleCode.replace('__BASE__', '/')] }), emitBuildMetadata(), serveValleHtmlInDev(), hashedAssetCacheHeaders()],
  // Inyecta el SHA del build como literal en el bundle (versionCheck.js lo lee
  // como __BUILD_SHA__). JSON.stringify para que quede como string válido.
  define: {
    __BUILD_SHA__: JSON.stringify(BUILD_SHA),
  },
  server: {
    // Las trazas contienen HTML; escribir evidencia no debe recargar la app.
    watch: { ignored: ['**/_gate/**', '**/test-results/**', '**/playwright-report/**'] },
    fs: {
      allow: [
        resolve(import.meta.dirname),
        realpathSync(resolve(import.meta.dirname, 'node_modules')),
      ],
    },
    proxy: {
      '/oauth': 'http://localhost:8081',
      ...(DEV_HA_URL ? {
        '/api/ha': {
          target: DEV_HA_URL,
          rewrite: (path) => path.replace(/^\/api\/ha/, '/api'),
        },
      } : {}),
      ...(DEV_OLLAMA_URL ? {
        '/api/ollama': {
          target: DEV_OLLAMA_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
          headers: { Origin: '' },
        },
      } : {}),
      '/api': 'http://localhost:8081',
    },
  },
  build: {
    // sourcemap: los mapas reconstruyen el fuente ORIGINAL, comentarios incluidos.
    // Explícito en false y no por el valor por omisión de Vite: activarlo publicaría
    // en `dist/` texto que en el bundle minificado no existe. Verificado 2026-09-08:
    // 0 coincidencias sensibles en los 37.748 archivos servidos, precisamente porque
    // el minificador elimina comentarios. No lo encienda sin revisar qué se publica.
    sourcemap: false,
    target: 'es2022',
    rolldownOptions: {
      // Multi-página: la PWA (index.html) + el mockup público del mercado
      // (mercado.html → mercado.chagra.bio) se emiten en el mismo build.
      //
      // Las cinco ventanas de voz por compai también son entradas propias. Sin
      // estar aquí, el .html existe en el fuente pero el servidor cae al
      // fallback SPA y devuelve el cascarón de index.html: las tres páginas
      // entregaban un HTML idéntico y ninguna contenía su propio componente.
      // El control de que están registradas es que cada una emita un bundle
      // distinto — si dos comparten conteo de assets, no entraron.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        mercado: resolve(import.meta.dirname, 'mercado.html'),
        speciesViewer: resolve(import.meta.dirname, 'species-visor.html'),
        vozChivito: resolve(import.meta.dirname, 'src/components/voz/chivito.html'),
        vozLuciernaga: resolve(import.meta.dirname, 'src/components/voz/luciernaga.html'),
        vozOso: resolve(import.meta.dirname, 'src/components/voz/oso.html'),
        vozJaguar: resolve(import.meta.dirname, 'src/components/voz/jaguar.html'),
        vozChagra: resolve(import.meta.dirname, 'src/components/voz/voz.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/zustand') || id.includes('node_modules/localforage')) {
            return 'vendor-state';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // three / @react-three (fiber + drei): SOLO lo usa el mockup 3D
          // (#/mockups/entrada-3d), cargado perezoso. Chunk aparte lo mantiene
          // fuera del bundle base y cacheable por sí solo.
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three')) {
            return 'vendor-three';
          }
        },
      },
    },
  },
})
