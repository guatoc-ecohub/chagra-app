/**
 * vozAgenteBus — lo que el agente está haciendo con su voz, para quien lo
 * quiera acompañar con el cuerpo (la ventana de voz de angelita).
 *
 * AgentScreen publica; nadie más. Cuatro señales, sin estado propio:
 *   - `turno`  { fase: 'idle'|'recording'|'thinking', hablando: bool, error: string }
 *   - `voz`    se pidió decir la respuesta (antes de que suene); `origen:
 *              'segunda-opinion'` cuando habla la segunda mirada de una foto
 *   - `frase`  { indice, total, texto, t } cuando el TTS arranca cada frase
 *   - `foto`   { fase: 'elegida'|'quitada'|'analizando'|'lista'|'sin-analisis' }
 *              el camino de una foto en el agente, para que el compai la mire
 *
 * Es un canal de solo avisos: no guarda la conversación ni la reenvía, y un
 * suscriptor que falla no rompe al agente.
 */

const oyentes = new Set();

export function publicarVozAgente(evento) {
  for (const fn of [...oyentes]) {
    try { fn(evento); } catch { /* un oyente roto no calla al agente */ }
  }
}

/** Devuelve la función para dejar de oír. */
export function oirVozAgente(fn) {
  oyentes.add(fn);
  return () => { oyentes.delete(fn); };
}

/**
 * Ruta inversa, la única: un compai (la ventana de voz de la guacamaya) le pide
 * al agente que abra SU cámara para mostrarle una foto. AgentScreen la atiende
 * con el mismo input del compositor (nunca un segundo input) y envía sola la
 * foto elegida. Devuelve true si un AgentScreen montado la atendió.
 */
export const PEDIR_FOTO = 'chagra:agente:pedir-foto';
export function pedirFotoAlAgente(context = null) {
  if (typeof window === 'undefined') return false;
  const evento = new CustomEvent(PEDIR_FOTO, { detail: { atendida: false, context } });
  window.dispatchEvent(evento);
  return evento.detail.atendida === true;
}
