/** Convierte timestamps FarmOS en fecha local para el gesto de agenda. */
export function fechaLocalDeTarea(timestamp) {
  if (timestamp == null || timestamp === '') return null;
  const fecha = typeof timestamp === 'number'
    ? new Date(timestamp > 1e12 ? timestamp : timestamp * 1000)
    : new Date(timestamp);
  if (!Number.isFinite(fecha.getTime())) return null;
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

export function esTareaPendienteDeHoy(task, ahora = new Date()) {
  const status = task?.status ?? task?.attributes?.status;
  const timestamp = task?.timestamp ?? task?.attributes?.timestamp ?? task?.date;
  return status === 'pending' && fechaLocalDeTarea(timestamp) === fechaLocalDeTarea(ahora.getTime());
}

export function tareaDeHoy(tasks, ahora = new Date()) {
  return Array.isArray(tasks) ? tasks.find((task) => esTareaPendienteDeHoy(task, ahora)) || null : null;
}

/** Busca un puesto adyacente que no cruce texto ni controles visibles. */
export function puestoLibreJuntoATarea(rect, ocupados = [], opciones = {}) {
  if (!rect) return null;
  const { ancho = 84, alto = 84, viewportW = window.innerWidth, viewportH = window.innerHeight, margen = 8 } = opciones;
  const centroY = rect.top + (rect.height - alto) / 2;
  const candidatos = [
    { x: rect.left - ancho - margen, y: centroY, direccion: 'derecha' },
    { x: rect.right + margen, y: centroY, direccion: 'izquierda' },
    { x: rect.right - ancho, y: rect.bottom + margen, direccion: 'izquierda' },
    { x: rect.left, y: rect.bottom + margen, direccion: 'derecha' },
    { x: rect.right - ancho, y: rect.top - alto - margen, direccion: 'izquierda' },
    { x: rect.left, y: rect.top - alto - margen, direccion: 'derecha' },
  ];

  return candidatos.find(({ x, y }) => {
    const caja = { left: x, top: y, right: x + ancho, bottom: y + alto };
    if (x < margen || y < margen || caja.right > viewportW - margen || caja.bottom > viewportH - margen) return false;
    return ocupados.every((ocupado) => caja.right <= ocupado.left || caja.left >= ocupado.right
      || caja.bottom <= ocupado.top || caja.top >= ocupado.bottom);
  }) || null;
}
