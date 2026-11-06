/**
 * La referencia general de una receta no respalda un plazo de seguridad.
 * Cada intervalo necesita su valor, unidad y fuente propios. Los días legacy
 * no se reinterpretan como horas ni como autorización de cosecha.
 */
export function datoConFuente(valor, fuente) {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0
    && typeof fuente === 'string' && fuente.trim().length > 0;
}

/**
 * Retiene texto del catálogo sin agregar dosis. Aparta fragmentos que ofrecen
 * una excepción a un veto, usan una estación como etapa del cultivo, mezclan
 * cosecha con frecuencia o tienen paréntesis incompletos. La UI avisa cuando
 * aparta información; el catálogo original no se modifica.
 */
export function revisarTextoAplicacion(texto, bp) {
  if (typeof texto !== 'string') return { texto: '', omitido: false };
  // Los separadores dentro de paréntesis pertenecen a la misma indicación.
  // Un punto seguido de mayúscula permite recuperar la oración posterior
  // cuando la indicación anterior dejó un paréntesis abierto.
  const partes = [];
  let inicio = 0;
  let profundidad = 0;
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] === '(') profundidad++;
    if (texto[i] === ')') profundidad--;
    const siguiente = texto.slice(i + 1);
    const fin = (texto[i] === ';' && profundidad === 0 && /^\s/u.test(siguiente))
      || (texto[i] === '.' && /^\s+[A-ZÁÉÍÓÚÜÑ]/u.test(siguiente));
    if (fin) {
      partes.push(texto.slice(inicio, i + 1).trim());
      inicio = i + 1;
      profundidad = 0;
    }
  }
  partes.push(texto.slice(inicio).trim());
  const seguras = partes.filter(parte => {
    if (/\binvierno\b|\binvernal(?:es)?\b/i.test(parte)) return false;
    if (/cosecha|carencia/i.test(parte)) return false;
    if (bp.do_not_use_when?.includes('floracion') && /floraci[oó]n/i.test(parte)
      && !/no\s+(?:aplicar|usar)|evitar|suspender/i.test(parte)) return false;
    let parentesis = 0;
    for (const c of parte) {
      if (c === '(') parentesis++;
      if (c === ')') parentesis--;
      if (parentesis < 0) return false;
    }
    return parentesis === 0;
  });
  return { texto: seguras.join(' '), omitido: seguras.length !== partes.length };
}
