/** Decide qué saludo corresponde a la primera apertura de cada franja y día. */
export function franjaDeSaludo(fecha = new Date()) {
  const minutos = fecha.getHours() * 60 + fecha.getMinutes();
  if (minutos >= 5 * 60 + 45 && minutos < 12 * 60) return 'manana';
  if (minutos >= 15 * 60 && minutos < 19 * 60) return 'tarde';
  return null;
}

export function claveSaludo(fecha, franja) {
  if (!franja) return null;
  const dia = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  return `angelita:saludo:${dia}:${franja}`;
}

/** Pura: indica si corresponde el saludo sin leer ni escribir almacenamiento. */
export function debeSaludar(fecha, saludosDelDia = []) {
  const franja = franjaDeSaludo(fecha);
  const clave = claveSaludo(fecha, franja);
  return franja && !saludosDelDia.includes(clave) ? franja : null;
}

export function fincaSana(saludFinca) {
  return Boolean(saludFinca
    && saludFinca.matasTotal > 0
    && saludFinca.matasVivas === saludFinca.matasTotal
    && saludFinca.agua === true);
}

export function puedeOfrecerMiel(fecha, diasConMiel = []) {
  const dia = claveSaludo(fecha, 'miel');
  return !diasConMiel.includes(dia);
}

export function esPrimeraCosecha(anterior, actual) {
  return anterior === 0 && actual === 1;
}
