// Presentation only. Original conditions and prohibitions remain visible.
export const INSTRUCCIONES_FERMENTOS = {
  masato_maiz: ['Use frascos, ollas, cucharas y manos limpios.', 'Una vez listo, refrigere y consuma en pocos días.', 'Para guardarlo más, conserve en frío o deje que quede ácido.'],
  masato_arroz: ['No deje el arroz cocido tibio durante horas.', 'Use agua y utensilios limpios; tape con tela limpia.', 'Refrigere y consuma en el plazo indicado.'],
  masato_yuca: ['Use solo yuca dulce comercial.', 'Cocine bien la yuca y use utensilios limpios.', 'Refrigere y consuma en el plazo indicado.'],
  chicha_maiz: ['No use cerámica vidriada tradicional; use vidrio, acero o barro sin plomo.', 'Use recipiente limpio y tela; deje acidificar antes de embotellar.', 'Al embotellar, guarde en frío y abra con cuidado.'],
  champus: ['Lave bien la fruta antes de agregarla.', 'Use ollas y frascos limpios y agua potable.', 'Refrigere y consuma en el plazo indicado.'],
  guarapo: ['Limpie bien el trapiche o extractor.', 'Use agua potable y tape para evitar moscas y polvo.', 'Refrigere apenas alcance el punto.'],
  suero_costeno: ['Use leche o nata pasteurizada.', 'Mantenga frío y tapado.', 'Use frascos y cucharas hervidos o bien lavados.'],
  chucrut: ['Use la cantidad de sal indicada para el peso del repollo.', 'Mantenga todo el repollo bajo la salmuera con un peso.', 'Si no se acidifica, no conserve a temperatura ambiente.', 'Use utensilios y frasco bien limpios.'],
  kimchi: ['Use la cantidad de sal indicada.', 'Mantenga la verdura bajo el líquido.', 'Compruebe que la fermentación se vuelva ácida.', 'Con productos del mar, use ingredientes frescos y mantenga frío.'],
  kombucha: ['Use agua sin cloro.', 'Use frasco y manos limpios; cubra con tela.', 'No use metal reactivo ni cerámica vidriada; compruebe la acidez.', 'Si embotella con azúcar, refrigere y abra con cuidado.'],
  kefir_leche: ['Use leche pasteurizada.', 'Use frasco, colador y cuchara muy limpios.', 'Cuando esté ácido y espeso, refrigere; respete el plazo indicado.'],
  kefir_agua: ['Use agua sin cloro.', 'Use frasco y utensilios limpios; cubra con tela.', 'En botella cerrada, refrigere y abra con cuidado.'],
  yogur: ['Antes de agregar el cultivo, caliente leche pasteurizada o hervida.', 'Controle la temperatura indicada para el reposo del cultivo.', 'Apenas cuaje, refrigere; use recipientes limpios.'],
  chapo: ['Use agua potable y recipientes limpios; tape.', 'Refrigere y consuma en el plazo indicado.', 'No guarde sellado mucho tiempo a temperatura ambiente.'],
  siete_granos: ['Cocine bien las leguminosas; no las use crudas ni mal cocidas.', 'Use agua potable; no deje los granos cocidos tibios durante horas.', 'Refrigere y consuma en el plazo indicado.'],
  cuajada: ['Use leche pasteurizada.', 'Mantenga siempre frío y bien tapado.', 'Use ollas, lienzos y moldes muy limpios.'],
  pan_masa_madre: ['Hornee hasta que la miga esté cocida.', 'Si la masa madre tiene moho, descártela y empiece de nuevo.', 'Guarde el pan cuando ya esté frío.'],
  vinagre_casero: ['Cubra con tela; no selle herméticamente.', 'No conserve verduras selladas con vinagre casero de acidez desconocida.', 'Use frascos limpios de vidrio o acero.'],
};

export const VETOS_LECTURA = {
  veto_conservas_anaerobias: { instruccion: 'No guarde alimentos de baja acidez sellados o en aceite a temperatura ambiente.', accion: 'Refrigere y consuma pronto. Ante visión doble, debilidad o dificultad para respirar, acuda al puesto de salud.' },
  veto_carnicos_caseros_anaerobios: { instruccion: 'No prepare carnes selladas o en aceite a temperatura ambiente.', accion: 'Refrigere y consuma pronto, o evite esta preparación. Hervir no garantiza que sea segura.' },
  veto_miel_crudas_bebe: { instruccion: 'Nunca dé miel cruda ni procesada a menores de un año.', accion: 'Ante debilidad, llanto débil o dificultad para mamar, acuda de inmediato al puesto de salud.' },
  veto_ceramica_vidriada: { instruccion: 'No use cerámica vidriada sin certificar para alimentos o bebidas ácidas.', accion: 'Use cerámica certificada libre de plomo, vidrio o acero inoxidable.' },
  veto_yuca_amarga: { instruccion: 'Si no sabe procesar la yuca amarga, use solo yuca dulce.', accion: 'No consuma yuca amarga sin procesar correctamente. Ante vómito, dolor de cabeza o debilidad, acuda al puesto de salud.' },
  veto_lacteos_crudos_vulnerables: { instruccion: 'No dé lácteos crudos a personas de riesgo.', accion: 'Embarazadas, niños pequeños, adultos mayores y personas con defensas bajas: use leche pasteurizada para los fermentos.' },
};

const GLOSAS = [
  ['inocuidad', 'seguridad del alimento para comerlo'],
  ['anaerobias', 'sin oxígeno'], ['anaerobios', 'sin oxígeno'],
  ['neurotóxico', 'daña el sistema nervioso'], ['botulismo', 'intoxicación grave'],
  ['pasteurizada', 'calentada para reducir microbios'], ['pasteurizar', 'calentar para reducir microbios'],
  ['pasteurización', 'calentamiento para reducir microbios'],
  ['patógenos', 'microbios que causan enfermedad'], ['toxina', 'sustancia venenosa'],
  ['pH', 'medida de acidez'], ['autoclave', 'equipo de esterilización a presión'],
  ['cianuro', 'veneno'], ['konzo', 'parálisis de las piernas'],
  ['detoxificar', 'quitar sustancias tóxicas'], ['vidriada', 'con esmalte'],
  ['micotoxinas', 'sustancias tóxicas de hongos'], ['SCOBY', 'cultivo de kombucha'],
  ['incubación', 'reposo a temperatura controlada'], ['inocular', 'agregar el cultivo'],
  ['acética', 'del vinagre'], ['carbonata', 'produce gas'], ['bacilo', 'tipo de bacteria'],
  ['salmuera', 'agua con sal'], ['acidifica', 'se vuelve ácido'],
  ['listeriosis', 'infección causada por listeria'], ['gastroenteritis', 'infección del estómago y el intestino'],
  ['glucósidos cianogénicos', 'compuestos que pueden liberar cianuro'],
];
const glosas = new Map(GLOSAS.map(([termino, glosa]) => [termino.toLocaleLowerCase('es'), glosa]));
const terminos = new RegExp(`(?<![\\p{L}])(${GLOSAS.map(([termino]) => termino).join('|')})(?![\\p{L}])`, 'giu');

export const MAX_PALABRAS_FRASE = 25;
const MIN_PALABRAS_TRAMO = 5;
const palabras = t => t.trim().split(/\s+/).filter(Boolean).length;
const mayuscula = t => t.replace(/^(\P{L}*)(\p{L})/u, (_, pre, c) => pre + c.toLocaleUpperCase('es'));

// Puntos de corte a profundidad 0 de paréntesis: ; : y comas.
function puntosDeCorte(frase) {
  const puntos = [];
  let prof = 0;
  for (let i = 0; i < frase.length; i += 1) {
    const c = frase[i];
    if (c === '(') prof += 1;
    else if (c === ')') prof = Math.max(0, prof - 1);
    else if (prof === 0 && (c === ';' || c === ':' || c === ',') && /\s/.test(frase[i + 1] || '')) puntos.push(i);
  }
  return puntos;
}

function partirFrase(frase) {
  if (palabras(frase) <= MAX_PALABRAS_FRASE) return [frase];
  const mitad = palabras(frase) / 2;
  let mejor = null;
  for (const i of puntosDeCorte(frase)) {
    const izq = frase.slice(0, i);
    const der = frase.slice(i + 1);
    if (palabras(izq) < MIN_PALABRAS_TRAMO || palabras(der) < MIN_PALABRAS_TRAMO) continue;
    const dist = Math.abs(palabras(izq) - mitad);
    if (!mejor || dist < mejor.dist) mejor = { izq, der, dist };
  }
  if (!mejor) return [frase];
  const izq = mejor.izq.trim().replace(/\s+(y|o|e|ni)$/i, '');
  const final = /[.?!]$/.test(izq) ? izq : `${izq}.`;
  const der = mejor.der.trim().replace(/^porque\s/i, 'Esto es así porque ').replace(/^o\s/i, 'O bien ');
  return [...partirFrase(final), ...partirFrase(mayuscula(der))];
}

/** Parte en frases de hasta 25 palabras sin quitar ninguna palabra (solo cambia la puntuación de corte). */
export function frasesCortas(texto) {
  return String(texto || '')
    .split(/(?<=[.?!])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
    .flatMap(partirFrase)
    .join(' ');
}

export const conGlosas = texto => frasesCortas(String(texto || '').replace(terminos, termino => `${termino} (${glosas.get(termino.toLocaleLowerCase('es'))})`).replaceAll(' — ', ': '));

const normalizar = t => String(t || '').toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** True si la alerta dice exactamente lo mismo que la instrucción corta que ya la encabeza. */
export const repiteAlerta = (instruccion, alerta) => {
  const i = normalizar(instruccion);
  return i.length > 0 && i === normalizar(alerta);
};
