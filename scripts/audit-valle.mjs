#!/usr/bin/env node
/**
 * Inspecciona los nombres de dist/valle sin leer el contenido de sus archivos.
 * Uso: node scripts/audit-valle.mjs [directorio-dist]
 * Salidas: 0 sin artefactos (o valle opcional ausente), 1 artefactos, 2 error.
 */
import { lstatSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process, { argv } from 'node:process';
import { fileURLToPath } from 'node:url';
import console from 'node:console';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(argv[2] || join(ROOT, 'dist'));

// Independiente del filtro de copia: una regresión del sync debe fallar aquí.
const ARTIFACT_NAME = /^(?:_bk-|_backup-|_gate-)|^(?:_spike|_archivo)$/;
const OUTPUT_FILE = /\.(?:out|log)$/i;

function inspect(directory, relativePath, hits) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${relativePath}/${entry.name}`;
    if (ARTIFACT_NAME.test(entry.name) || (entry.isFile() && OUTPUT_FILE.test(entry.name))) {
      hits.push(path);
    } else if (entry.isSymbolicLink()) {
      hits.push(`${path} (enlace simbólico)`);
    } else if (entry.isDirectory()) {
      inspect(join(directory, entry.name), path, hits);
    }
  }
}

try {
  if (!lstatSync(dist).isDirectory()) throw new Error('el destino no es un directorio');
  const valle = readdirSync(dist, { withFileTypes: true }).find(entry => entry.name === 'valle');
  if (!valle) {
    console.log('[audit-valle] dist/valle ausente: valle opcional, sin archivos que inspeccionar.');
  } else {
    if (!valle.isDirectory()) throw new Error('dist/valle no es un directorio');
    const hits = [];
    inspect(join(dist, 'valle'), 'valle', hits);
    if (hits.length > 0) {
      console.error(`[audit-valle] ${hits.length} artefacto(s) de desarrollo en el bundle:`);
      for (const hit of hits.sort()) console.error(`  ${hit}`);
      process.exitCode = 1;
    } else {
      console.log('[audit-valle] dist/valle inspeccionado: 0 artefactos de desarrollo.');
    }
  }
} catch (error) {
  console.error('[audit-valle] no se pudo inspeccionar el bundle:', error.code || error.message);
  process.exitCode = 2;
}
