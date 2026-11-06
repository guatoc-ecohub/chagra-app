/** Local UI contract, v1. No transport, persistence, audio or generated code.
 * Every envelope has {type, simulated:true, requestId:string|null, payload}.
 * @typedef {'escuchando'|'transcribiendo'|'entendiendo'|'planeando'|'construyendo'|'probando'|'entregando'} ApplicationStage
 * @typedef {{transcript:string, summary:string, voice:{simulated:true,durationSeconds:number,maxSeconds:240}, confirmed:true}} CreateApplicationPayload
 * @typedef {{stage:ApplicationStage, message:string}} ApplicationProgressPayload
 * @typedef {{preview:'local-example', exampleUrl:string, limitations:string}} ApplicationResultPayload
 * @typedef {{code:'CANCELLED'|'SIMULATED_FAILURE'|'SHOTS_EXHAUSTED',message:string}} ApplicationErrorPayload
 * @typedef {{remaining:number,consumed:number}} ShotsRemainingPayload
 * @typedef {({type:'createApplicationRequest',payload:CreateApplicationPayload}|{type:'applicationProgress',payload:ApplicationProgressPayload}|{type:'applicationResult',payload:ApplicationResultPayload}|{type:'applicationError',payload:ApplicationErrorPayload}|{type:'shotsRemaining',payload:ShotsRemainingPayload}) & {simulated:true,requestId:string|null}} MockApplicationEvent
 *
 * createApplicationRequest: CreateApplicationPayload, only after confirmation.
 * applicationProgress: ApplicationProgressPayload, no percentages/ETA.
 * applicationResult: ApplicationResultPayload, fixed local illustration.
 * applicationError: ApplicationErrorPayload, also represents cancellation.
 * shotsRemaining: ShotsRemainingPayload, authoritative within this demo only.
 * A real adapter must replace the timers and authority over shots, provide
 * idempotency by requestId and report actual events. Never relabel mock events.
 */
export const VOICE_MAX_SECONDS = 240;
export const SAMPLE_TRANSCRIPT = 'Quiero una aplicación para organizar los pedidos de mi huerta. Necesito ver qué pidió cada persona y marcar los pedidos entregados.';
export const STAGES = ['escuchando', 'transcribiendo', 'entendiendo', 'planeando', 'construyendo', 'probando', 'entregando'];
export const STAGE_MESSAGES = {
  escuchando: 'Escuchando en simulación. El micrófono está apagado.',
  transcribiendo: 'Transcribiendo en simulación. Voy a cargar un texto de ejemplo.',
  entendiendo: 'Entendiendo en simulación. Revisa el texto antes de continuar.',
  planeando: 'Planeando en simulación. Estoy recorriendo un plan de ejemplo.',
  construyendo: 'Construyendo en simulación. No se está generando código.',
  probando: 'Probando en simulación. No se están ejecutando pruebas de una aplicación.',
  entregando: 'Entregando en simulación. Preparando una vista de ejemplo local.',
};
export const RESULT = {
  preview: 'local-example',
  exampleUrl: 'https://example.com/mi-aplicacion',
  limitations: 'Vista fija de ejemplo: no se creó, probó ni publicó una aplicación. La URL es ilustrativa. No hay servidor, datos guardados ni fábrica conectada.',
};
export const summarize = (text) => text.trim() ? `Tu pedido: «${text.trim()}»` : '';
export const formatDuration = (seconds) => {
  const value = Math.max(0, Math.min(VOICE_MAX_SECONDS, Math.floor(seconds)));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
};
const event = (state, type, payload) => ({ type, simulated: true, requestId: state.requestId, payload });
const append = (state, type, payload) => ({ ...state, events: [...state.events, event(state, type, payload)] });
const progress = (state, phase) => append({ ...state, phase }, 'applicationProgress', { stage: phase, message: STAGE_MESSAGES[phase] });

export function initialFactoryState() {
  return {
    phase: 'borrador', shots: 3, transcript: '', elapsed: 0, requestId: null,
    events: [{ type: 'shotsRemaining', simulated: true, requestId: null, payload: { remaining: 3, consumed: 0 } }],
    result: null, error: null, fail: false,
  };
}

/** Pure local simulator. Reducer guards also prevent double-confirm charges. */
export function factoryReducer(state, action) {
  switch (action.type) {
    case 'edit':
      return ['borrador', 'listo', 'cancelado', 'error', 'resultado'].includes(state.phase)
        ? { ...state, transcript: action.text, phase: 'borrador', result: null, error: null } : state;
    case 'record':
      return ['borrador', 'listo', 'cancelado', 'error', 'resultado'].includes(state.phase)
        ? progress({ ...state, elapsed: 0, transcript: '', result: null, error: null, requestId: null }, 'escuchando') : state;
    case 'clock': {
      if (state.phase !== 'escuchando') return state;
      const next = { ...state, elapsed: Math.min(VOICE_MAX_SECONDS, Math.max(0, action.seconds)) };
      if (next.elapsed === state.elapsed) return state;
      return next.elapsed === VOICE_MAX_SECONDS ? progress(next, 'transcribiendo') : next;
    }
    case 'stop':
      return state.phase === 'escuchando' ? progress(state, 'transcribiendo') : state;
    case 'review':
      return ['borrador', 'listo', 'cancelado', 'error', 'resultado'].includes(state.phase) && state.transcript.trim()
        ? { ...state, phase: 'confirmacion', error: null } : state;
    case 'back':
      return state.phase === 'confirmacion' ? { ...state, phase: 'listo' } : state;
    case 'confirm': {
      if (state.phase !== 'confirmacion' || !state.transcript.trim()) return state;
      if (state.shots < 1) return append({ ...state, phase: 'agotado', error: 'No quedan shots de demostración.' }, 'applicationError', { code: 'SHOTS_EXHAUSTED', message: 'No quedan shots de demostración.' });
      const next = { ...state, shots: state.shots - 1, requestId: action.requestId, result: null };
      const requested = append(next, 'createApplicationRequest', {
        transcript: state.transcript.trim(), summary: summarize(state.transcript),
        voice: { simulated: true, durationSeconds: state.elapsed, maxSeconds: VOICE_MAX_SECONDS }, confirmed: true,
      });
      return progress(append(requested, 'shotsRemaining', { remaining: next.shots, consumed: 1 }), 'planeando');
    }
    case 'advance': {
      if (state.phase === 'transcribiendo') return progress({ ...state, transcript: SAMPLE_TRANSCRIPT }, 'entendiendo');
      if (state.phase === 'entendiendo') return { ...state, phase: 'listo' };
      if (state.phase === 'construyendo' && state.fail) {
        const message = 'Error simulado de construcción. Tu texto sigue aquí. El shot confirmado no se devuelve en esta demo.';
        return append({ ...state, phase: 'error', error: message }, 'applicationError', { code: 'SIMULATED_FAILURE', message });
      }
      if (state.phase === 'entregando') return append({ ...state, phase: 'resultado', result: RESULT }, 'applicationResult', RESULT);
      const index = STAGES.indexOf(state.phase);
      return index >= 3 && index < 6 ? progress(state, STAGES[index + 1]) : state;
    }
    case 'cancel': {
      if (!STAGES.includes(state.phase)) return state;
      const message = 'Simulación cancelada. No habrá más eventos de este intento. Los shots ya confirmados no se devuelven en esta demo.';
      return append({ ...state, phase: 'cancelado', error: message }, 'applicationError', { code: 'CANCELLED', message });
    }
    case 'scenario':
      return STAGES.includes(state.phase) || state.phase === 'confirmacion' ? state : { ...state, fail: action.fail };
    case 'exhaust':
      return STAGES.includes(state.phase) || state.phase === 'confirmacion' ? state
        : append({ ...state, phase: 'agotado', shots: 0, error: 'No quedan shots de demostración.' }, 'shotsRemaining', { remaining: 0, consumed: 0 });
    case 'reset':
      return initialFactoryState();
    default:
      return state;
  }
}
