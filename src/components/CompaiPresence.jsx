import { lazy, Suspense } from 'react';
import { CompaiAvatarContext } from './CompaiAvatarContext.js';
import { compaiPresenceOwner } from '../config/compaiPresence.js';

const AgentFab = lazy(() => import('./AgentFab.jsx'));
const AngelitaAvisoGlobal = lazy(() => import('../visual/agente/AngelitaAvisoGlobal.jsx'));

/** The shell owns presence; scenes and conversation content cannot add copies. */
export default function CompaiPresence({ view, embeddedHome = false, sinSesion = false, onNavigate, children }) {
  const owner = compaiPresenceOwner({ view, sinSesion });
  const showFab = !embeddedHome && owner === 'fab';
  const showGlobalNotice = showFab && view !== 'hoy_finca' && view !== 'evolucion';
  return (
    <>
      <CompaiAvatarContext value={false}>{children}</CompaiAvatarContext>
      <CompaiAvatarContext value={true}>
        <Suspense fallback={null}>
          {showFab && <AgentFab onNavigate={onNavigate} pantalla={view} />}
          {showGlobalNotice && <AngelitaAvisoGlobal pantalla={view} />}
        </Suspense>
      </CompaiAvatarContext>
    </>
  );
}
