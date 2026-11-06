/**
 * El cocuyo acompaña con su luz y devuelve observaciones, no diagnósticos.
 * El host entrega datos confirmados; no hay escrituras ni inferencias de fauna.
 */
import { datosDeMundo } from './nucleo/datosFinca.js';
import { esDeNoche } from './nucleo/susurroNocturno.js';
import { planEntradaDe, planSalidaDe } from './nucleo/entradaSalida.js';

export const PERFIL_CONDUCTA_LUCIERNAGA = Object.freeze({
  especie: 'luciernaga',
  medio: 'noche',
  vocacion: 'cocuyo que alumbra y acompaña la observación nocturna',
});

/** Horario de interfaz compartido, no una estimación de luz solar ni de fauna. */
export function alumbrarDeNocheLuciernaga(ahora = new Date()) {
  if (!(ahora instanceof Date) || !Number.isFinite(ahora.getTime()) || !esDeNoche(ahora)) return null;
  return Object.freeze({ tipo: 'alumbrar', mensaje: 'En mi turno de noche enciendo mi lucecita. ¿Qué quiere observar conmigo?' });
}

/** Solo lecturas numéricas explícitas, sin umbrales agronómicos inventados. */
export function leerHumedadLuciernaga(humedad = null) {
  if (!Number.isFinite(humedad) || humedad < 0 || humedad > 100) return null;
  return Object.freeze({ tipo: 'humedad', valor: humedad,
    mensaje: `La lectura de humedad recibida es ${humedad} %. La dejo a la vista, sin deducir si hay rocío.` });
}

export function observarRocioLuciernaga(rocioObservado = false) {
  if (rocioObservado !== true) return null;
  return Object.freeze({ tipo: 'rocio', mensaje: 'Usted reportó rocío. Acerco mi lucecita a esa observación: ¿dónde lo vio?' });
}

export function observarPolillasLuciernaga(polillasObservadas = null) {
  if (!Number.isSafeInteger(polillasObservadas) || polillasObservadas <= 0) return null;
  return Object.freeze({ tipo: 'polillas', cantidad: polillasObservadas,
    mensaje: `Reportó ${polillasObservadas} polillas. Miremos ese encuentro sin asignarles una especie ni llamarlas plaga.` });
}

export function escucharMovimientoLuciernaga(movimientoNocturno = '') {
  if (typeof movimientoNocturno !== 'string' || !movimientoNocturno.trim()) return null;
  return Object.freeze({ tipo: 'movimiento',
    mensaje: `Me cuenta este movimiento nocturno: “${movimientoNocturno.trim()}”. Lo acompaño con mi luz, sin adivinar quién pasó.` });
}

/** Comentarios por pantalla: preguntas y acompañamiento, sin hechos no verificados. */
const COMENTARIOS_LUCIERNAGA = Object.freeze({
  mis_matas: ({ cultivos }) => cultivos?.[0]?.name
    ? `Alumbro sus registros de ${cultivos[0].name.toLowerCase()}. ¿Qué observó allí de noche?`
    : 'Mi lucecita espera sus registros de matas. ¿Qué quiere observar de noche?',
  mis_animales: ({ especies }) => especies?.[0]?.name
    ? `Reviso con usted los registros de ${especies[0].name.toLowerCase()}. ¿Anotó algún movimiento nocturno?`
    : '¿Qué animales tiene registrados? Podemos revisar juntos lo que haya observado de noche.',
  clima: () => 'Pongo mi lucecita sobre las lecturas de humedad. Si no hay una lectura, prefiero preguntarle.',
  finca: () => 'Soy su cocuyo. Alumbremos una observación de la finca a la vez, también cuando los demás descansan.',
  bosque: () => '¿Qué oyó o vio de noche en el bosque? Lo escucho sin ponerle nombre a lo que no reconocimos.',
  paramo: () => 'Lo acompaño con mi lucecita. Cuénteme qué observó, sin completar lo que todavía no sabemos.',
  vender: () => 'Alumbremos sus cuentas con los registros que tenga. No invento cifras para completar la noche.',
  aprender: () => '¿Qué le da curiosidad de la noche? Busquemos respaldo antes de dar una respuesta.',
});

export function comentarioDeMundoLuciernaga(mundo, inventario = null, extra = {}) {
  const comentar = Object.hasOwn(COMENTARIOS_LUCIERNAGA, mundo) ? COMENTARIOS_LUCIERNAGA[mundo] : null;
  return comentar ? comentar(datosDeMundo(mundo, inventario, extra)) : null;
}

/**
 * Contexto opcional: humedad (porcentaje), rocioObservado (booleano),
 * polillasObservadas (conteo), movimientoNocturno (relato humano).
 * Ausencia no significa cero ni ausencia de fauna. Cada señal aporta voz,
 * incluso si llegan varias juntas. El horario solo controla el turno de luz;
 * una observación nocturna puede revisarse durante el día.
 */
export function conductaLuciernaga({
  activo = true, mundo = null, inventario = null, extra = {}, ahora = new Date(),
  humedad = null, rocioObservado = false, polillasObservadas = null, movimientoNocturno = '',
} = {}) {
  if (!activo) return null;
  const luz = alumbrarDeNocheLuciernaga(ahora);
  const observaciones = Object.freeze([
    leerHumedadLuciernaga(humedad),
    observarRocioLuciernaga(rocioObservado),
    observarPolillasLuciernaga(polillasObservadas),
    escucharMovimientoLuciernaga(movimientoNocturno),
  ].filter(Boolean));
  const comentarioMundo = comentarioDeMundoLuciernaga(mundo, inventario, extra);
  const comentario = [comentarioMundo, luz?.mensaje, ...observaciones.map((item) => item.mensaje)]
    .filter(Boolean).join(' ') || null;
  return Object.freeze({
    especie: PERFIL_CONDUCTA_LUCIERNAGA.especie,
    comentario, comentarioMundo, luz, observaciones,
    nocturno: Boolean(luz),
    datosMundo: mundo ? datosDeMundo(mundo, inventario, extra) : {},
    entrada: planEntradaDe('luciernaga'), salida: planSalidaDe('luciernaga'),
    vozEntrada: 'Llego con mi lucecita. Miremos juntos lo que alcanzó a observar.',
    vozSalida: 'Me llevo mi lucecita. Sus observaciones quedan para la próxima conversación.',
  });
}
