import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Scripts use bundled files; styles retain the inline permission needed by UI.
// script-src incluye static.cloudflareinsights.com (bug consola prod
// STEV-03/C12, 2026-10-31): Cloudflare inyecta el beacon de Web Analytics
// en el borde de la zona (fuera de este repo), y sin este origen la CSP lo
// bloqueaba en cada carga. connect-src ya admite https: en general, así
// que el reporte del beacon (otro dominio) no necesita ajuste aparte.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "frame-src 'self' https://3d.guatoc.co",
  "script-src 'self' 'wasm-unsafe-eval' blob: https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ') + ';';

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
  const install = (server, appPolicy, descensosPolicy) => {
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
      const policy = isDescensosPath(req.url) ? descensosPolicy : appPolicy;
      res.setHeader('Content-Security-Policy', policy);
      res.setHeader('Cache-Control', 'no-transform');
      next();
    });
  };

  const descensosPolicy = () => withScriptHashes(CONTENT_SECURITY_POLICY, descensosHashes);
  return {
    name: 'chagra-http-security',
    configResolved(config) {
      if (!config.publicDir) throw new Error('httpSecurityHeaders requires Vite publicDir for the descensos CSP.');
      descensosHashes = collectDescensosScriptHashes(config.publicDir);
    },
    configureServer: server => install(
      server,
      withScriptHashes(CONTENT_SECURITY_POLICY, devHashes),
      descensosPolicy(),
    ),
    configurePreviewServer: server => install(server, CONTENT_SECURITY_POLICY, descensosPolicy()),
    transformIndexHtml(html, ctx) {
      if (!ctx.server || !devHashes.length) return html;
      return html.replace(/(<meta http-equiv="Content-Security-Policy"[^>]*?script-src [^;]*)/, `$1 ${devHashes.join(' ')}`);
    },
    generateBundle() {
      const lessonPolicy = descensosPolicy();
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: `/*\n  Content-Security-Policy: ${CONTENT_SECURITY_POLICY}\n  Cache-Control: no-transform\n\n/descensos/*\n  Content-Security-Policy: ${lessonPolicy}\n  Cache-Control: no-transform\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'security-headers.conf',
        source: `add_header Content-Security-Policy "${CONTENT_SECURITY_POLICY}" always;\nadd_header Cache-Control "no-transform" always;\n\nlocation ^~ /descensos/ {\n    add_header Content-Security-Policy "${lessonPolicy}" always;\n    add_header Cache-Control "no-transform" always;\n}\n`,
      });
    },
  };
}
