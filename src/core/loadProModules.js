/**
 * loadProModules.js — Carga dinámica de módulos Pro
 * ==================================================
 * Si la variable de entorno VITE_PRO_MODULES_PATH apunta a un directorio
 * con módulos Pro, los carga vía dynamic import() y los registra en el
 * moduleRegistry. Si la variable no está (build público puro), esta
 * función no hace nada y la UI degrada elegantemente.
 *
 * IMPORTANTE — ADR-002: este archivo NO importa estáticamente de
 * módulos opcionales. Todo se hace vía import dinámico cuyo path viene de una
 * variable de entorno del build. Vite no puede bundlear lo que no
 * puede resolver estáticamente.
 *
 * Módulos Pro esperados (actualizar cuando se agreguen al catálogo
 * privado):
 *   - gremios-receta-pro (capability: enriched-guild-suggestions)
 *   - avatar-espiritu-pro (capability: avatar-espiritu)
 *   - export-ecocert-pro (capability: export-ecocert)  [v0.9.0+]
 *   - plan-nutricion-pro (capability: auto-plan-nutricion) [v0.9.1+]
 *
 * ACCESO RESTRINGIDO: en producción el servidor solo entrega
 * `/pro-modules/*` a una sesión farmOS con tier Pro (nginx auth_request).
 * Un `import()` no puede llevar la cabecera Authorization, así que fuera de
 * DEV el bundle se pide con fetch + bearer y se importa desde un blob: (la
 * CSP de index.html ya admite blob: en script-src). Sin sesión no se pide
 * nada; al iniciar sesión (SESSION_STARTED_EVENT) se reintenta.
 *
 * GATE DE TIER (bug consola prod, 2026-10-31): antes de pedir CUALQUIER
 * bundle también se exige que el tier cliente-side (tierService) resuelva
 * 'pro'. Sin este gate, toda cuenta autenticada (Pro o no) terminaba
 * pidiendo los 3 bundles; nginx responde 403 a quien no es Pro y Chrome
 * registra ese 403 en consola aunque el `catch` de abajo lo absorba — el
 * log del navegador no depende de que el JS maneje el error.
 *
 * CARRERA login-tier: el tier ya no es una allowlist síncrona del bundle
 * (ver tierService.js, SEG Ola 0 #4337) — lo resuelve el servidor por
 * `GET /tier`, y esa respuesta llega después de SESSION_STARTED_EVENT (que
 * authService dispara apenas guarda el token, antes de que exista tenant o
 * tier conocidos). Si este loader solo reintentara en SESSION_STARTED_EVENT,
 * un usuario Pro recién logueado se quedaría sin sus módulos hasta el
 * próximo refresco de página. Por eso también escucha
 * SERVER_TIER_CHANGED_EVENT, que tierService emite apenas guarda la
 * respuesta del servidor (desde LoginScreen.finalizarIngreso y desde el
 * efecto de montaje de App.jsx) — esa es la señal real de "ya se sabe el
 * tier", no la presencia del tenant.
 *
 * REACT COMPARTIDO: algunos módulos Pro traen componentes React
 * pre-construidos (ESM de navegador). Para que usen la MISMA instancia de
 * React que el público (si no, los hooks rompen con "Invalid hook call"),
 * este loader publica `globalThis.__CHAGRA_VENDOR__ = { React, jsxRuntime }`
 * ANTES de importar cualquier módulo Pro. El bundle Pro resuelve `react` /
 * `react/jsx-runtime` contra ese global (ver módulos-opcionales/.../build.mjs).
 */

import React from 'react';
import * as JsxRuntime from 'react/jsx-runtime';
import { registry } from './moduleRegistry';
import { getAccessToken, SESSION_STARTED_EVENT } from '../services/authService';
import { getCurrentTier, SERVER_TIER_CHANGED_EVENT } from '../services/tierService';

// Expone el React del host para los módulos Pro que traen componentes
// pre-construidos. Idempotente; solo se llama cuando hay módulos Pro que
// cargar (no toca el global en un build puro OSS).
function ensureVendorGlobals() {
  if (typeof globalThis === 'undefined') return;
  if (!globalThis.__CHAGRA_VENDOR__) {
    globalThis.__CHAGRA_VENDOR__ = { React, jsxRuntime: JsxRuntime };
  }
}

// Vite resuelve import.meta.glob en build-time. El path con variable
// de entorno no se resuelve estáticamente, así que el bundle público no
// contiene el código Pro — solo el intento de import dinámico que
// falla silenciosamente si la variable no apunta a algo real.
const PRO_MODULES_ENV = (import.meta.env && import.meta.env.VITE_PRO_MODULES_PATH) || null;

// Lista explícita de módulos Pro que conocemos. Añadir aquí cuando
// el equipo Pro confirme el id y capability del nuevo módulo.
const KNOWN_PRO_MODULES = ['gremios-receta-pro', 'voice-entity-extractor-pro', 'avatar-espiritu-pro'];

// Carpetas ya registradas en esta pestaña: un reintento tras el login no
// vuelve a pedirlas.
const loadedNames = new Set();
let sessionListenerInstalled = false;

const JS_CONTENT_TYPE = /^(?:application|text)\/(?:javascript|ecmascript)\b/i;

/**
 * Pide el bundle con el bearer de farmOS y lo importa desde un blob:.
 * Rechaza cualquier respuesta que no sea JavaScript: el fallback SPA
 * devuelve index.html con 200 para rutas inexistentes.
 */
async function importAuthenticated(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!JS_CONTENT_TYPE.test(contentType)) throw new Error(`content-type ${contentType || 'vacío'}`);
  const source = await response.text();
  const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    return await import(/* @vite-ignore */ blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function installSessionListener() {
  if (sessionListenerInstalled || typeof window === 'undefined') return;
  sessionListenerInstalled = true;
  // Reintento temprano: cubre el caso de una cuenta con tier ya cacheado
  // (misma sesión, token refrescado) — gate de tier lo descarta sin red si
  // todavía no se sabe. Ver nota "CARRERA login-tier" arriba para el caso
  // en que el tier llega después.
  window.addEventListener(SESSION_STARTED_EVENT, () => {
    loadProModules().catch(() => {});
  });
  window.addEventListener(SERVER_TIER_CHANGED_EVENT, (event) => {
    const detail = /** @type {CustomEvent} */ (event).detail;
    if (detail?.tier !== 'pro') return;
    loadProModules().catch(() => {});
  });
}

// SESSION_STARTED_EVENT y SERVER_TIER_CHANGED_EVENT pueden llegar casi
// juntos (ambos los dispara el mismo login): sin esta compuerta, dos
// llamadas concurrentes pasan la revisión `loadedNames.has(name)` del mismo
// módulo antes de que la primera termine de registrarlo, y cada una pide el
// bundle — el doble de fetches de los que hay módulos. Una llamada nueva
// después de que la anterior ya resolvió sí corre de nuevo (p.ej. el
// reintento real cuando cambia el tier).
let pending = null;

export async function loadProModules() {
  if (pending) return pending;
  pending = loadProModulesOnce().finally(() => {
    pending = null;
  });
  return pending;
}

async function loadProModulesOnce() {
  if (!PRO_MODULES_ENV) {
    if (import.meta.env && import.meta.env.DEV) {
      console.info('[loadProModules] sin VITE_PRO_MODULES_PATH; build puro OSS');
    }
    return { loaded: [], skipped: KNOWN_PRO_MODULES };
  }

  const isDev = Boolean(import.meta.env && import.meta.env.DEV);
  installSessionListener();

  // Gate de tier (defense-in-depth cliente-side, igual que buildSidecarHeaders):
  // sin esto, cualquier cuenta autenticada —Pro o no— pide los 3 bundles y
  // nginx le responde 403 a quien no es Pro. Ese 403 ensucia la consola
  // aunque el `catch` del loop lo absorba (el navegador lo registra solo).
  if (!isDev && getCurrentTier() !== 'pro') {
    return { loaded: [], skipped: KNOWN_PRO_MODULES.filter((n) => !loadedNames.has(n)) };
  }

  // En DEV el path apunta a las fuentes locales (con imports relativos), que
  // se cargan tal cual. Fuera de DEV el servidor exige sesión Pro.
  const token = isDev ? null : await getAccessToken();
  if (!isDev && !token) {
    return { loaded: [], skipped: KNOWN_PRO_MODULES.filter((n) => !loadedNames.has(n)) };
  }

  // Publica el React del host antes de importar módulos Pro (React compartido).
  ensureVendorGlobals();

  const loaded = [];
  const skipped = [];

  for (const name of KNOWN_PRO_MODULES) {
    if (loadedNames.has(name)) continue;
    try {
      const url = `${PRO_MODULES_ENV}/${name}/index.js`;
      // @vite-ignore: import dinámico con path fuera del grafo estático,
      // intencional por diseño (ADR-002). Vite imprime warning — esperado.
      const mod = isDev ? await import(/* @vite-ignore */ url) : await importAuthenticated(url, token);
      if (mod && mod.default && mod.default.id) {
        if (!registry.has(mod.default.id)) registry.register(mod.default);
        loadedNames.add(name);
        loaded.push(mod.default.id);
      } else {
        skipped.push(name);
        console.warn(`[loadProModules] "${name}" no exporta un ChagraModule válido como default`);
      }
    } catch (e) {
      skipped.push(name);
      if (import.meta.env && import.meta.env.DEV) {
        console.info(`[loadProModules] "${name}" no disponible: ${e.message}`);
      }
    }
  }

  return { loaded, skipped };
}
