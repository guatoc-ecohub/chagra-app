#!/usr/bin/env node
/**
 * Comprueba que cada URL de OFFLINE_SHELL_ASSETS en dist/sw.js exista en dist/.
 * Uso: node scripts/verify-offline-shell-assets.mjs [directorio-dist]
 * Salidas: 0 lista completa, 1 faltan archivos o la lista no se estampó, 2 error.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process, { argv } from 'node:process';
import { fileURLToPath } from 'node:url';
import console from 'node:console';
import { missingOfflineShellAssets } from './offline-shell-assets.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(argv[2] || join(ROOT, 'dist'));

export function readOfflineShellAssets(sw) {
  const match = sw.match(/const OFFLINE_SHELL_ASSETS = \[([^\]]*)\];/);
  if (!match) throw new Error('sw.js sin OFFLINE_SHELL_ASSETS');
  if (match[1].includes('__CHAGRA_OFFLINE_SHELL_ASSETS__')) throw new Error('OFFLINE_SHELL_ASSETS sin estampar');
  return JSON.parse(`[${match[1]}]`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const urls = readOfflineShellAssets(readFileSync(join(dist, 'sw.js'), 'utf8'));
    // Una lista vacía no prueba nada: el generador dejó de encontrar el shell.
    if (urls.length === 0) {
      console.error('OFFLINE_SHELL_ASSETS vacío: no hay nada que precargar sin conexión.');
      process.exit(1);
    }
    const missing = missingOfflineShellAssets(urls, dist, existsSync);
    if (missing.length) {
      console.error(`OFFLINE_SHELL_ASSETS lista ${missing.length} de ${urls.length} archivos que no existen en dist/:`);
      for (const url of missing) console.error(`  ${url}`);
      process.exit(1);
    }
    console.log(`OFFLINE_SHELL_ASSETS: ${urls.length} archivos, todos presentes en dist/.`);
  } catch (err) {
    console.error(`verify-offline-shell-assets: ${err.message}`);
    process.exit(2);
  }
}
