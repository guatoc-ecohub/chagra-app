import { computeSemaforoTurno } from '../../services/semaforoConfianza';
import { CONVERSACION as C } from './conversacion.copy';

const cadenas = valor => Array.isArray(valor) ? valor.filter(v => typeof v === 'string' && v.trim()) : [];

export function enlaceSeguro(valor) {
  if (typeof valor !== 'string') return null;
  try {
    const url = new URL(valor);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

// Las advertencias se acumulan; una fuente o un dato revisado no las cancela.
export function senalesConversacion(metadata) {
  const md = metadata || {};
  const semaforo = computeSemaforoTurno(md);
  const inventados = cadenas(md.hallucinated_names);
  const sospechosos = cadenas(md.suspect_names);
  const organismos = cadenas(md.cross_crop_organisms);
  const avisos = [];
  if (inventados.length) avisos.push({ nivel: 'rojo', titulo: C.nombre, detalle: `${inventados.join(', ')}. ${C.nombreDetalle}` });
  if (sospechosos.length) avisos.push({ nivel: 'ambar', titulo: C.sospecha, detalle: `${sospechosos.join(', ')}. ${C.sospechaDetalle}` });
  if (md.cross_crop === true) avisos.push({ nivel: 'ambar', titulo: C.otroCultivo, detalle: `${organismos.length ? `${organismos.join(', ')}. ` : ''}${C.otroDetalle}` });
  if (md.auto_corrected === true) avisos.push({ nivel: 'ambar', titulo: C.corregida, detalle: C.correccion });
  let nivel = semaforo?.nivel || (md.grounded === true && md.tool_used ? 'verde' : 'ambar');
  if (inventados.length) nivel = 'rojo';
  else if (nivel === 'verde' && (avisos.length || ['baja', 'media'].includes(md.confianza))) nivel = 'ambar';
  return { nivel, titulo: !semaforo && !md.grounded && !avisos.length ? C.generativa : C[nivel], avisos,
    confianza: C.confianza[md.confianza] || null,
    procedencia: semaforo?.provenance || [] };
}
