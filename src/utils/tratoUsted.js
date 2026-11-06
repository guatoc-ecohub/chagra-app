// SPDX-License-Identifier: AGPL-3.0-only
// Presentación: pasa a usted las formas de tú sin ambigüedad que el modelo generativo deja escapar.

const L = 'a-záéíóúüñ';

const POSESIVOS = { tu: 'su', tus: 'sus' };

const PRESENTE = {
  puedes: 'puede', quieres: 'quiere', tienes: 'tiene', necesitas: 'necesita', sabes: 'sabe',
  eres: 'es', estás: 'está', debes: 'debe', buscas: 'busca', haces: 'hace', vendes: 'vende',
  siembras: 'siembra', cultivas: 'cultiva', prefieres: 'prefiere', piensas: 'piensa',
  hablas: 'habla', dices: 'dice', comes: 'come', bebes: 'bebe', vives: 'vive',
  vienes: 'viene', pones: 'pone', conoces: 'conoce', refieres: 'refiere', mencionas: 'menciona',
  compartes: 'comparte', cuentas: 'cuenta', entiendes: 'entiende', recomiendas: 'recomienda',
  revisas: 'revisa', confirmas: 'confirma', consideras: 'considera', deseas: 'desea',
  ayudas: 'ayuda', eliges: 'elige', tomas: 'toma', anotas: 'anota', observas: 'observa',
  riegas: 'riega', aplicas: 'aplica', agregas: 'agrega', preguntas: 'pregunta',
  utilizas: 'utiliza', usas: 'usa', llamas: 'llama', sientes: 'siente',
  encuentras: 'encuentra', preparas: 'prepara', levantas: 'levanta', quedas: 'queda',
  asegúrate: 'asegúrese', fíjate: 'fíjese', recuérdalo: 'recuérdelo', consúltalo: 'consúltelo',
  pregúntale: 'pregúntele', cuéntame: 'cuénteme', cuéntale: 'cuéntele', dime: 'dígame',
};

const SUBJUNTIVO = {
  uses: 'use', mezcles: 'mezcle', apliques: 'aplique', inventes: 'invente', recomiendes: 'recomiende',
  confundas: 'confunda', olvides: 'olvide', excedas: 'exceda', pongas: 'ponga', mojes: 'moje',
  siembres: 'siembre', cortes: 'corte', compres: 'compre', dejes: 'deje',
  hables: 'hable', digas: 'diga', tengas: 'tenga', hagas: 'haga', puedas: 'pueda',
  quieras: 'quiera', seas: 'sea', estés: 'esté', vayas: 'vaya', vengas: 'venga',
  conozcas: 'conozca', menciones: 'mencione', cultives: 'cultive', vivas: 'viva',
  comas: 'coma', des: 'dé', veas: 'vea', salgas: 'salga', cuentes: 'cuente',
  pienses: 'piense', prefieras: 'prefiera', encuentres: 'encuentre', sepas: 'sepa',
  intentes: 'intente',
};

const PRETERITO = {
  mencionaste: 'mencionó', compartiste: 'compartió', quisiste: 'quiso', hiciste: 'hizo',
  dijiste: 'dijo', tomaste: 'tomó', anotaste: 'anotó', revisaste: 'revisó',
  preguntaste: 'preguntó', confirmaste: 'confirmó', aplicaste: 'aplicó', usaste: 'usó',
  sembraste: 'sembró', cultivaste: 'cultivó', fuiste: 'fue', tuviste: 'tuvo',
  pudiste: 'pudo', pensaste: 'pensó', viste: 'vio', diste: 'dio', trajiste: 'trajo',
  pusiste: 'puso', leíste: 'leyó', comiste: 'comió', bebiste: 'bebió', viviste: 'vivió',
  probaste: 'probó', entendiste: 'entendió', deseaste: 'deseó', elegiste: 'eligió',
  hablaste: 'habló', llegaste: 'llegó', escogiste: 'escogió',
  // C24 (piloto 2026-10-31): «¿A qué altura lo plantaste?» pasó sin corregir.
  plantaste: 'plantó', trasplantaste: 'trasplantó', regaste: 'regó', abonaste: 'abonó',
  podaste: 'podó', cosechaste: 'cosechó', recogiste: 'recogió', compraste: 'compró',
  notaste: 'notó', registraste: 'registró', fumigaste: 'fumigó', echaste: 'echó',
};

const CONDICIONAL = {
  podrías: 'podría', querrías: 'querría', deberías: 'debería', tendrías: 'tendría',
  harías: 'haría', serías: 'sería', estarías: 'estaría', preferirías: 'preferiría',
  mencionarías: 'mencionaría',
};

const REFLEXIVOS = [
  'llamas', 'sientes', 'encuentras', 'preparas', 'levantas', 'quedas', 'estás', 'refieres',
  'pones', 'acuerdas', 'preocupas', 'aseguras', 'fijas', 'mueves', 'bañas',
  'acuestas', 'diriges', 'acercas', 'alejas', 'alimentas', 'vas',
];

// Imperativos de tú que solo se tocan al abrir una oración: en otro lugar coinciden con la tercera persona.
const IMPERATIVOS = {
  aplica: 'aplique', usa: 'use', revisa: 'revise', evita: 'evite', elige: 'elija', escribe: 'escriba',
  guarda: 'guarde', busca: 'busque', mira: 'mire', mide: 'mida', anota: 'anote', registra: 'registre',
  confirma: 'confirme', corrige: 'corrija', ajusta: 'ajuste', riega: 'riegue', cubre: 'cubra',
  cuida: 'cuide', combina: 'combine', compara: 'compare', limpia: 'limpie', lava: 'lave',
  saca: 'saque', retira: 'retire', deja: 'deje', pon: 'ponga', ten: 'tenga', haz: 'haga',
  asegúrate: 'asegúrese', recuerda: 'recuerde', observa: 'observe', verifica: 'verifique',
  empieza: 'empiece', espera: 'espere', protege: 'proteja', prepara: 'prepare', cosecha: 'coseche',
};

const conCaso = (original, nuevo) =>
  original[0] === original[0].toLocaleUpperCase('es') && original[0] !== original[0].toLocaleLowerCase('es')
    ? nuevo[0].toLocaleUpperCase('es') + nuevo.slice(1)
    : nuevo;

const alternativas = (obj) => Object.keys(obj).join('|');
const FUERA = `(?<![${L}])`;
const FIN = `(?![${L}])`;
const reSuelto = new RegExp(
  `${FUERA}(${alternativas({ ...POSESIVOS, ...PRESENTE, ...SUBJUNTIVO, ...PRETERITO, ...CONDICIONAL })})${FIN}`,
  'giu',
);
const reImperativo = new RegExp(
  `((?:^|[.:;!?¿¡\\n]\\s*|\\n\\s*(?:[-*•]|\\d+[.)])\\s*|${FUERA}si [^.,;:\\n]{1,60},\\s*)(?:[-*•]\\s+)?(?:\\*\\*|_)?)(${alternativas(IMPERATIVOS)})${FIN}`,
  'giu',
);
const rePronombre = new RegExp(`${FUERA}(tú)${FIN}`, 'giu');
const reContigo = new RegExp(`${FUERA}contigo${FIN}`, 'giu');
const reTonic = new RegExp(`${FUERA}ti${FIN}`, 'giu');
const reCliticoDirecto = new RegExp(`${FUERA}te(?=\\s+(?:lo|la|los|las)\\b)`, 'giu');
const reReflexivo = new RegExp(`${FUERA}te${FIN}(?=\\s+(?:${REFLEXIVOS.join('|')})${FIN})`, 'giu');
const reTe = new RegExp(`${FUERA}te${FIN}`, 'giu');
const reEncliticoTe = new RegExp(`${FUERA}([${L}]{3,}(?:ar|er|ir)|dar|ir)te${FIN}`, 'giu');
const SUELTOS = { ...POSESIVOS, ...PRESENTE, ...SUBJUNTIVO, ...PRETERITO, ...CONDICIONAL };

/** @param {string} texto */
export function aUsted(texto) {
  if (typeof texto !== 'string' || !texto) return texto;
  return texto
    .replace(reContigo, (m) => conCaso(m, 'con usted'))
    .replace(reTonic, (m) => conCaso(m, 'usted'))
    .replace(reCliticoDirecto, (m) => conCaso(m, 'se'))
    .replace(reReflexivo, (m) => conCaso(m, 'se'))
    .replace(reEncliticoTe, (m, infinitive) => conCaso(m, `${infinitive}le`))
    .replace(reTe, (m) => conCaso(m, 'le'))
    .replace(rePronombre, (m) => conCaso(m, 'usted'))
    .replace(reSuelto, (m) => conCaso(m, SUELTOS[m.toLocaleLowerCase('es')]))
    .replace(reImperativo, (_, pre, verbo) => pre + conCaso(verbo, IMPERATIVOS[verbo.toLocaleLowerCase('es')]));
}
