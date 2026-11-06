import { useEffect, useState } from 'react';
import SplashAngelita from './SplashAngelita.jsx';
import { MSG } from '../config/messages';

// Etiquetas contextuales del fallback de Suspense mientras baja el chunk.
const VIEW_LOADING_LABELS = {
  loading: 'Preparando tu chagra…',
  dashboard: 'Preparando tu chagra…',
  hoy_finca: 'Preparando tu chagra…',
  agente: 'Despertando al agente…',
  voz: 'Preparando el modo voz…',
  voz_planta: 'Preparando el modo voz…',
  directorio: 'Abriendo el catálogo de especies…',
  especies: 'Abriendo el catálogo de especies…',
  toxicologia: 'Abriendo el catálogo de especies…',
  mundo: 'Abriendo el mundo…',
  mundo_cultivos: 'Abriendo tus cultivos…',
  agua: 'Abriendo el mundo del agua…',
  suelo: 'Abriendo el mundo del suelo…',
  salud_suelo: 'Abriendo el mundo del suelo…',
  semilla: 'Abriendo el mundo de la semilla…',
  poscosecha: 'Abriendo la poscosecha…',
  almacenamiento: 'Abriendo el almacenamiento…',
  nutricion: 'Abriendo la comida que alimenta…',
  animales: 'Abriendo tus animales…',
  ciclo_vivo: 'Abriendo el ciclo vivo…',
  calendario: 'Abriendo el calendario…',
  calendario_finca: 'Abriendo el calendario…',
  almanaque: 'Abriendo el almanaque…',
  ano_finca: 'Recorriendo su año…',
  mapa: 'Abriendo el mapa…',
  mercado: 'Abriendo el mercado…',
  mercados: 'Abriendo el mercado…',
  aprende: 'Abriendo los cursos…',
  bitacora: 'Abriendo la bitácora…',
  historial: 'Abriendo la bitácora…',
  informes: 'Preparando los informes…',
};

const SLOW_LOAD_HINT_MS = 4000;

export default function AppSuspenseFallback({ view = null }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_LOAD_HINT_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="h-[100dvh] bg-slate-950 flex flex-col items-center justify-center gap-3 text-muzo-glow"
      data-testid="app-suspense-fallback"
    >
      <SplashAngelita />
      <p className="text-sm text-slate-300" data-testid="app-suspense-loading-label">
        {VIEW_LOADING_LABELS[view] || MSG.ui.cargando}
      </p>
      {slow && (
        <p
          className="text-xs text-slate-400 text-center px-8 max-w-xs"
          data-testid="app-suspense-slow-hint"
          aria-live="polite"
        >
          Sigue cargando. Con señal de campo puede tardar un poco más. No se perdió nada.
        </p>
      )}
    </div>
  );
}
