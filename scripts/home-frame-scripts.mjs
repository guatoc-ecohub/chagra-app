import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

// Generate classic scripts for the opaque, sandboxed home frames. They can use
// same-origin external scripts under CSP without granting inline execution.
export function homeFrameScripts() {
  const root = new URL('../', import.meta.url);
  const sources = new Map();
  const documents = new Map();
  for (const name of ['a', 'b']) {
    const html = readFileSync(new URL(`src/components/dashboard/home-a/${name}.html`, root), 'utf8');
    let index = 0;
    documents.set(name, html.replace(/<script>([\s\S]*?)<\/script>/g, (_tag, body) => {
      const path = `/home-frames/${name}-${index++}.js`;
      sources.set(path, body);
      return `<script src="${path}"></script>`;
    }));
  }
  const bridge = readFileSync(new URL('src/components/dashboard/home-a/bridge.js', root), 'utf8').replaceAll('export function ', 'function ');
  sources.set('/home-frames/bridge.js', `${bridge}\ninstallHomeBridge();`);
  sources.set('/home-frames/voice.js', `${bridge}\ninstallHomeVoiceEntry();`);
  sources.set('/home-frames/size.js', `(() => {
    const sendHeight = () => parent.postMessage({channel:'home-b',action:'height',value:Math.ceil(document.body.getBoundingClientRect().height)},'*');
    addEventListener('message', e => {
      if(e.source!==parent || e.data?.channel!=='home-b-scroll') return;
      const section=document.getElementById('g-'+e.data.group);
      if(section) {
        if(section instanceof HTMLDetailsElement) section.open = true;
        requestAnimationFrame(() => {
          sendHeight();
          parent.postMessage({channel:'home-b',action:'target',value:Math.ceil(section.getBoundingClientRect().top+scrollY)},'*');
        });
      }
    });
    if('ResizeObserver' in window) new ResizeObserver(sendHeight).observe(document.body);
    addEventListener('load',sendHeight); requestAnimationFrame(sendHeight);
  })();`);
  const serve = server => { server.middlewares.use((req, res, next) => {
    const body = sources.get((req.url || '').split('?')[0]);
    if (body === undefined) return next();
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.end(body);
  }); };
  return {
    name: 'chagra-home-frame-scripts', enforce: 'pre',
    load(id) {
      const name = id.match(/\/dashboard\/home-a\/([ab])\.html\?raw$/)?.[1];
      if (name) return `export default ${JSON.stringify(documents.get(name))};`;
    },
    configureServer: serve,
    configurePreviewServer: serve,
    generateBundle() {
      for (const [path, source] of sources) this.emitFile({ type: 'asset', fileName: path.slice(1), source });
    },
  };
}
