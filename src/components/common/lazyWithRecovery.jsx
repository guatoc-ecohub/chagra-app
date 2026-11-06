/* eslint-disable chagra-i18n/no-hardcoded-spanish, react-refresh/only-export-components */
import React, { lazy as reactLazy } from 'react';
import { reloadPage } from '../../services/pageReload';

function tieneRutaRecuperable() {
  return Boolean(window.location.hash.replace(/^#\/?/, '').split('?')[0]);
}

function recuperarPantalla() {
  if (tieneRutaRecuperable()) {
    // A failed browser import needs a reload of the same route to be retried.
    reloadPage();
  } else {
    // Views without a URL cannot be restored by reloading the document.
    window.dispatchEvent(new CustomEvent('chagraNavigate', { detail: { view: 'historial' } }));
  }
}

/**
 * Convierte un rechazo de import() en una pantalla legible. React.lazy conserva
 * un rechazo para siempre, por eso no basta con que Suspense tenga un loading.
 * Este es el punto único de las rutas perezosas declaradas en App.jsx.
 */
function CargaPerezosaFallida() {
  return (
    <section className="h-[100dvh] w-full bg-slate-950 text-white flex items-center justify-center p-6" role="alert">
      <div className="w-full max-w-md rounded-2xl border border-amber-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
        <h2 className="text-lg font-bold">No se pudo abrir esta pantalla</h2>
        <p className="text-sm leading-relaxed text-slate-300">
          La conexión no pudo traer una parte de Chagra. Sus datos de la finca siguen guardados en este dispositivo.{' '}
          {tieneRutaRecuperable()
            ? 'Intente abrir esta misma pantalla otra vez.'
            : 'Abra el Cuaderno de labores para comprobar el registro antes de volver a guardarlo.'}
        </p>
        <button
          type="button"
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold hover:bg-emerald-500"
          onClick={recuperarPantalla}
        >
          Recargar Chagra
        </button>
      </div>
    </section>
  );
}

/**
 * Equivalente de React.lazy que resuelve un import rechazado a una UI de
 * recuperación, en vez de propagarlo hasta romper el árbol de la aplicación.
 */
export function lazy(importa) {
  return reactLazy(async () => {
    try {
      return await importa();
    } catch (error) {
      const mensaje = String(error?.message || error || '');
      const falloDeRed = /failed to fetch dynamically imported module|importing a module script failed|networkerror|fetch failed|load failed|unable to preload css/i.test(mensaje);
      if (falloDeRed) {
        return { default: CargaPerezosaFallida };
      }
      throw error;
    }
  });
}
