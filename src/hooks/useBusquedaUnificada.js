/**
 * useBusquedaUnificada.js — Búsqueda instantánea local del catálogo.
 *
 * Busca en: especies (taxonomy local). Todo local, sin backend.
 * Atajo: / o Ctrl+K.
 *
 * NOTA (ronda TSC3, 2026-09-28): los bloques que buscaban mundos 3D y
 * biopreparados se retiraron. Importaban módulos que nunca existieron en
 * esas rutas (`../../visual/mundo3d/mundoData.js` y
 * `../../data/biopreparadosCatalog.js` resuelven fuera de src/), así que el
 * import dinámico lanzaba y el catch vacío los descartaba SIEMPRE: cero
 * resultados desde el día uno. Para reconectarlos:
 *  - Mundos: `../visual/mundo3d/mundoData.js` exporta `MUNDO` como OBJETO
 *    (no arreglo) — iterar con Object.values y mapear titulo/id.
 *  - Biopreparados: la fuente real es la DB local (`getAllBiopreparados`,
 *    src/db/catalogDB) o los catálogos por cultivo de src/data.
 */
import { useState, useCallback, useEffect } from 'react';

/** @typedef {{ id: string, titulo: string, tipo: string, subtipo: string, ruta: string }} Resultado */

/**
 * @returns {{ resultados: Resultado[], buscar: (q: string) => void, abierto: boolean, toggle: () => void, query: string }}
 */
export function useBusquedaUnificada() {
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState(/** @type {Resultado[]} */ ([]));

  const toggle = useCallback(() => setAbierto((v) => !v), []);

  const buscar = useCallback(async (q) => {
    setQuery(q);
    if (q.length < 2) { setResultados([]); return; }

    const lower = q.toLowerCase();
    /** @type {Resultado[]} */
    const res = [];

    // Buscar en el catálogo de especies (desde el manifiesto + taxonomy)
    try {
      const { CROP_TAXONOMY } = await import('../config/taxonomy.js');
      for (const [grupo, data] of Object.entries(CROP_TAXONOMY)) {
        for (const sp of data.species || []) {
          const nombre = sp.commonName || sp.id || '';
          if (nombre.toLowerCase().includes(lower)) {
            res.push({ id: sp.id, titulo: nombre, tipo: 'especie', subtipo: grupo, ruta: 'directorio' });
          }
          if (res.length > 8) break;
        }
        if (res.length > 8) break;
      }
    } catch {
      // Sin taxonomy local (tabla aún sin poblar): la búsqueda de especies
      // queda vacía y el hook sigue respondiendo.
    }

    // (Mundos 3D y biopreparados: retirados — ver NOTA en el encabezado.)

    setResultados(res.slice(0, 12));
  }, []);

  // Atajo de teclado: / o Ctrl+K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement === document.body) ||
          (e.key === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && abierto) setAbierto(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, toggle]);

  return { resultados, buscar, abierto, toggle, query };
}
