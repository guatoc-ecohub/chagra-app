/** One owner for the companion, including embedded and transitional screens. */
export function compaiPresenceOwner({ view, sinSesion = false }) {
  if (view === 'loading') return 'none';
  if (view === 'agente' || view.startsWith('onboarding')) return 'none';
  // En formularios y registros el compai puede quedar sobre controles que
  // requieren escritura o selección. Se mantiene disponible al volver.
  if (['cosechar', 'sembrar', 'mi_cosecha', 'mi_goteo'].includes(view)) return 'none';
  if (view === 'login') return 'login';
  // Visita sin sesión (vistas públicas): el compai llama al LLM y a la voz, que exigen cuenta.
  if (sinSesion) return 'none';
  return 'fab';
}
