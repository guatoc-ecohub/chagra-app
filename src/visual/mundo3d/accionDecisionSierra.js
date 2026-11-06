import { REGLA_P } from '../../services/frostRisk.js';

export function accionDecisionSierra(id, dato) {
  if (id === 'minima') {
    if (!Number.isFinite(dato.lectura)) return 'Qué hacer: falta la mínima nocturna para decidir.';
    const limite = REGLA_P.minima_c;
    const relacion = dato.lectura < limite ? 'por debajo del' : dato.lectura > limite ? 'por encima del' : 'igual al';
    const grados = (valor) => String(valor).replace('.', ',');
    const comparacion = `Mínima prevista${dato.periodo === 'dia' ? ' del día' : ''}: ${grados(dato.lectura)} °C, ${relacion} límite de aviso de ${grados(limite)} °C.`;
    if (/no disponible/i.test(dato.titulo)) return `Qué hacer: ${comparacion} Todavía falta evaluar el riesgo para decidir.`;
    const cuidado = /Proteger/i.test(dato.titulo) ? ' Revise la protección de los brotes tiernos.' : '';
    return `Qué hacer: ${comparacion} Mire en el lote si el cielo se despeja y el viento se calma.${cuidado}`;
  }
  if (id === 'humedad') {
    if (!Number.isFinite(dato.lectura)) return 'Qué hacer: falta humedad relativa para decidir.';
    return dato.lectura >= 90
      ? 'Qué hacer: revise el cultivo si la humedad se sostiene en 90 % o más.'
      : 'Qué hacer: vigile si la humedad llega a 90 % o más.';
  }
  if (id === 'suelo') {
    if (!Number.isFinite(dato.lluvia) || !Number.isFinite(dato.eto)) {
      const faltantes = [!Number.isFinite(dato.lluvia) && 'lluvia', !Number.isFinite(dato.eto) && 'ETo'].filter(Boolean);
      return `Qué hacer: falta ${faltantes.join(' y ')} para decidir sobre riego.`;
    }
    return dato.lluvia > dato.eto
      ? 'Qué hacer: revise el drenaje, porque la lluvia supera la ETo.'
      : 'Qué hacer: revise la reserva y riegue solo si hace falta.';
  }
  if (id === 'viento') {
    if (/No se puede evaluar el horario/i.test(dato.titulo)) return 'Qué hacer: falta la serie horaria para decidir.';
    if (/Hoy no quedan horas aplicables por viento/i.test(dato.titulo)) return 'Qué hacer: posponga la aplicación; hoy no hay franja segura.';
    return /Aplicar por viento/i.test(dato.titulo)
      ? 'Qué hacer: aplique solo en la franja horaria indicada.'
      : 'Qué hacer: espere una condición segura antes de aplicar.';
  }
  return '';
}
