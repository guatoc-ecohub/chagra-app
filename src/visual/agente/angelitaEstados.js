/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Existing state identifiers and agent copy; this migration only updates the body reference. */
/*
 * angelitaEstados — EL REPERTORIO DEL AGENTE, COMO DATOS.
 *
 * Angelita (Tetragonisca angustula, la abeja angelita sin aguijón) es LA CARA
 * de la inteligencia de Chagra: cuando el campesino le habla a la app, quien
 * escucha, piensa y responde es ella. Este módulo define — como datos puros,
 * cero react/three — el vocabulario de esa conversación:
 *
 *   ESTADOS_ANGELITA   → los estados conversacionales canónicos del agente.
 *   POSE_DE_ESTADO     → qué pose del dibujo base (AbejaLaminaRig) sostiene
 *                        cada estado — el agente REUTILIZA el cuerpo aprobado,
 *                        no dibuja otra abeja.
 *   ARIA_DE_ESTADO     → cómo se narra cada estado a lectores de pantalla
 *                        (usted, colombiano — nunca "tú").
 *   nivelDeConfianza   → normaliza la confianza del modo científico
 *                        (número 0..1 o etiqueta) a 'alta'|'media'|'baja'.
 *   MOMENTOS_IDLE      → el repertorio del idle VIVO (acompana): los micro-
 *                        gestos de criatura que existe aunque nadie le hable.
 *   elegirMomentoIdle  → el azar ponderado (sin repetir) con el que Angelita
 *                        decide qué hacer en el próximo rato de vuelo.
 *
 * REGLA DE ORO (la misma de abejaIdentidad.js): SOLO datos. La CADENCIA vive
 * en `angelita-agente.css`; el DIBUJO en `Angelita.jsx`.
 */

/* Los estados canónicos del cuerpo del agente. En ASCII (sin ñ/tildes) porque
   viajan como valores de atributo data-* que el CSS selecciona. El nombre es
   deliberadamente species-neutral: cada rig traduce estas ideas a su cuerpo. */
export const ESTADOS_AGENTE = Object.freeze([
  'acompana',     // idle vivo: flota, respira, mira alrededor — presente sin hablar
  'escuchando',   // se posa y ladea la cabeza hacia usted; ondas de voz entrando
  'pensando',     // busca en su memoria de la finca (burbuja con recuerdos)
  'respondiendo', // habla (lip-sync por visema) y gesticula; su voz sale en miel
  'contenta',     // acertó / buena noticia: brinca celebrando con chispas
  'preocupada',   // alerta (plaga, sequía, riesgo): cejas, sudor, aro de alerta
  'no-se',        // honesta: se encoge de hombros — no sabe y LO DICE
  'senala',       // guía: se inclina y apunta al POI, con destello donde señala
  'invita',       // guía: hace "venga" con la manita, acercándose
  'husmea',       // fisgona: se inclina a olfatear el rastro (revisa la finca)
]);

/* Estados propios que quedan fuera del contrato común de perfiles. Un compai
   que no los tiene cae a 'acompana'; guardia solo aplica a Angelita. */
export const ESTADOS_PROPIOS_ANGELITA = Object.freeze(['esperando', 'guardia', 'marco', 'asiente', 'sin-senal']);

/* Nombres de transición para consumidores nuevos. Son la misma referencia,
   no copias que puedan divergir del vocabulario canónico. */
export const ESTADOS_COMPAI = ESTADOS_AGENTE;
export const ESTADOS_CONVERSACIONALES = ESTADOS_AGENTE;

/* Alias histórico: Angelita fue el primer cuerpo, pero el contrato ya no le
   pertenece. */
export const ESTADOS_ANGELITA = ESTADOS_AGENTE;

/* Sinónimos amables → canónico. El host escribe como piensa; el cuerpo entiende. */
export const ALIASES_ESTADO = Object.freeze({
  idle: 'acompana',
  acompaña: 'acompana',
  escucha: 'escuchando',
  piensa: 'pensando',
  buscando: 'pensando',
  habla: 'respondiendo',
  hablando: 'respondiendo',
  celebra: 'contenta',
  alerta: 'preocupada',
  nose: 'no-se',
  'no-sé': 'no-se',
  'nosé': 'no-se',
  duda: 'no-se',
  'señala': 'senala',
  guia: 'senala',
  'guía': 'senala',
  ven: 'invita',
  calma: 'acompana',
  aviso: 'preocupada',
  husmeando: 'husmea',
  fisgonea: 'husmea',
  espera: 'esperando',
  esperar: 'esperando',
  cargando: 'esperando',
});

export const ALIAS_DE_ESTADO = ALIASES_ESTADO;
export const ALIAS_ESTADO = ALIASES_ESTADO;

/**
 * Devuelve el estado canónico (o 'acompana' si no se reconoce: el agente
 * nunca se rompe por un estado desconocido — se queda acompañando, digno).
 * @param {string} [estado]
 * @returns {string}
 */
export function estadoCanonico(estado) {
  if (!estado) return 'acompana';
  const e = String(estado).toLowerCase().trim();
  if (ESTADOS_ANGELITA.includes(e) || ESTADOS_PROPIOS_ANGELITA.includes(e)) return e;
  return ALIASES_ESTADO[e] || 'acompana';
}

/* Cada estado del agente sostiene UNA pose del dibujo base (AbejaLaminaRig:
   'vuela'|'reposo'|'celebra'|'señala'). El resto del carácter (ondas, burbuja,
   cejas, shrug) lo ponen las capas del agente encima. */
export const POSES_DE_ESTADO = Object.freeze({
  acompana: 'vuela',
  escuchando: 'reposo',   // se posa a escuchar — atención de verdad, no vuelo
  pensando: 'vuela',
  respondiendo: 'vuela',
  contenta: 'celebra',
  preocupada: 'vuela',
  'no-se': 'vuela',
  senala: 'señala',       // el gesto afinado que ya vive en creatures.css
  invita: 'vuela',
  husmea: 'vuela',        // la inclinación fisgona la pone el CSS del estado
  caminando: 'vuela',     // la especie puede resolverlo a `camina`
});

export const POSE_POR_ESTADO = POSES_DE_ESTADO;

/* Poses de vida del cuerpo de Angelita, con sus estados propios. 'reposo'
   pliega las alitas y apaga los arrebatos (vuelta de campana, saltito): el
   gesto de la espera lo pone la lámina `esperar`, y así se lee limpio. */
export const POSES_DE_ANGELITA = Object.freeze({
  ...POSES_DE_ESTADO,
  guardia: 'volar',
  esperando: 'reposo',
  marco: 'reposo',
  asiente: 'reposo',
  'sin-senal': 'reposo',
});
export const POSE_DE_ESTADO = POSES_DE_ESTADO;

/* Cada estado ACTÚA también con las CEJAS (CejasRubber, opt-in del cuerpo):
   el que habla hace eyebrow-flash, la contenta las arquea, la que escucha las
   levanta, la fisgona las frunce de concentración. null = la carita de siempre
   (preocupada y no-se conservan SUS cejas dibujadas por el agente). */
export const CEJAS_POR_ESTADO = Object.freeze({
  acompana: null,
  escuchando: 'altas',
  pensando: null,
  respondiendo: 'vivas',
  contenta: 'alegres',
  preocupada: null,
  'no-se': null,
  senala: null,
  invita: 'altas',
  husmea: 'fruncidas',
  guardia: 'fruncidas',
  esperando: null,        // las cejas tranquilas que trae la lámina `esperar`
  marco: null,
  asiente: null,
  'sin-senal': 'alegres',
});

export const CEJAS_DE_ESTADO = CEJAS_POR_ESTADO;

/* Copy común. Las plantillas son datos, y el nombre se inyecta solo al
   construir el texto. Así un jaguar o una luciérnaga no anuncian a Angelita. */
export const TEXTO_POR_ESTADO = Object.freeze({
  acompana: '{nombre} lo acompaña',
  escuchando: '{nombre} lo está escuchando con atención',
  pensando: '{nombre} está pensando, buscando en su memoria de la finca',
  respondiendo: '{nombre} le está respondiendo',
  contenta: '{nombre} está contenta',
  preocupada: '{nombre} está preocupada: hay algo que conviene revisar',
  'no-se': '{nombre} no sabe la respuesta y se lo dice con honestidad',
  senala: '{nombre} le está señalando algo',
  invita: '{nombre} lo invita a acercarse',
  husmea: '{nombre} está husmeando: revisa la finca con cuidado',
  guardia: '{nombre} está en guardia: protege la hoja',
  esperando: '{nombre} está esperando, ya casi',
  marco: '{nombre} sostiene un marco para la foto',
  asiente: '{nombre} asiente al escucharle',
  'sin-senal': '{nombre} sigue aquí, con la conexión pausada',
});

export const ARIA_POR_ESTADO = Object.freeze({
  acompana: '{nombre} lo acompaña',
  escuchando: '{nombre} lo está escuchando con atención',
  pensando: '{nombre} está pensando, buscando en su memoria de la finca',
  respondiendo: '{nombre} le está respondiendo',
  contenta: '{nombre} está contenta',
  preocupada: '{nombre} está preocupada: hay algo que conviene revisar',
  'no-se': '{nombre} niega con la cabeza: no sabe la respuesta, y se lo dice con honestidad',
  senala: '{nombre} le está señalando algo',
  invita: '{nombre} lo invita a acercarse',
  husmea: '{nombre} está husmeando: revisa la finca con cuidado',
  guardia: '{nombre} está en guardia: protege la hoja',
  esperando: '{nombre} espera con paciencia mientras algo termina de cargar',
  marco: '{nombre} sostiene un marco para la foto',
  asiente: '{nombre} asiente al escucharle',
  'sin-senal': '{nombre} sigue aquí, con la conexión pausada',
});

function nombreDeAgente(nombre) {
  return typeof nombre === 'string' && nombre.trim() ? nombre.trim() : 'Angelita';
}

function interpolarEstado(plantillas, estado, nombre) {
  const canonico = estadoCanonico(estado);
  return plantillas[canonico].replaceAll('{nombre}', nombreDeAgente(nombre));
}

/** Texto breve del estado, parametrizado por el nombre visible del compai. */
export function textoDeEstado(estado, nombre = 'Angelita') {
  return interpolarEstado(TEXTO_POR_ESTADO, estado, nombre);
}

/** Narración accesible del estado, parametrizada por el nombre visible. */
export function ariaDeEstado(estado, nombre = 'Angelita') {
  return interpolarEstado(ARIA_POR_ESTADO, estado, nombre);
}

export const textoParaEstado = textoDeEstado;
export const ariaParaEstado = ariaDeEstado;

/* Alias compatible con Angelita: conserva exactamente el copy histórico,
   incluido el descriptor de abeja que ya pueden anunciar consumidores viejos. */
/** @type {Record<string, string>} */
export const ARIA_DE_ESTADO = Object.freeze({
  ...Object.fromEntries([...ESTADOS_AGENTE, ...ESTADOS_PROPIOS_ANGELITA]
    .map((estado) => [estado, ariaDeEstado(estado, 'Angelita')])),
  acompana: 'Angelita la abeja lo acompaña',
});

/* Un perfil de rig debe resolver todos los estados conversacionales y la
   locomoción transversal. La validación vive aquí para que cualquier especie
   pueda usarla sin importar React, Three ni un componente concreto. */
export const ESTADOS_DE_PERFIL = Object.freeze([...ESTADOS_AGENTE, 'caminando']);

function argumentosDeValidacion(perfil, slug) {
  /* Admite tanto validarPerfilDeEstados(perfil, slug) como la forma legible
     validarPerfilDeEstados(slug, perfil), útil en tests y herramientas. */
  if (typeof perfil === 'string') {
    return { mapa: slug, nombre: perfil };
  }
  return {
    mapa: perfil?.posePorEstado || perfil?.poses || perfil,
    nombre: typeof slug === 'string' && slug.trim() ? slug.trim() : perfil?.slug || 'perfil',
  };
}

/**
 * Valida que un mapa de poses cubra los 10 estados y `caminando`.
 * @param {object|string} perfil mapa, perfil con `posePorEstado`, o slug
 * @param {object|string} [slug] slug o mapa cuando se usa la firma invertida
 * @returns {true}
 * @throws {Error} con el slug y el primer estado que falta
 */
export function validarPerfilDeEstados(perfil, slug) {
  const { mapa, nombre } = argumentosDeValidacion(perfil, slug);
  const faltante = ESTADOS_DE_PERFIL.find((estado) => (
    !mapa || typeof mapa[estado] !== 'string' || !mapa[estado].trim()
  ));
  if (faltante) {
    throw new Error(`Perfil ${nombre} incompleto: falta el estado ${faltante}`);
  }
  return true;
}

export const validarMapaDePoses = validarPerfilDeEstados;
export const validarPerfil = validarPerfilDeEstados;

/* Cuando Angelita NO SABE, el globo (BurbujaAngelita) debe decirlo CLARO: "No
   sé" a secas, nunca una evasiva ni un rodeo — decir "no sé" es la conducta
   correcta (política anti-alucinación de Chagra), no una falla que disimular.
   Los hosts que compongan el mensaje del estado 'no-se' parten de aquí. */
export const TEXTO_NO_SE = 'No sé.';

/* ── EL REPERTORIO DEL IDLE VIVO (estado acompana) ───────────────────────────
   Una vecina de verdad EXISTE aunque nadie le hable: entre ratos de vuelo
   sereno ('flota') se distrae con una mota que pasa, mira alrededor, se
   acicala las antenas, se rasca, saluda, se pone las gafas o la ruana… La
   CADENCIA de cada momento vive en angelita-agente.css bajo [data-agt-idle=…].

   FUENTE ÚNICA (2026-09-23): el repertorio vive en el núcleo portable
   `compai/nucleo/gestos.js` y aquí SOLO se re-exporta. Hasta hoy esto era una
   copia que se había quedado atrás (15 momentos contra 17: sin `mirausted` ni
   `cuenta`, aunque su CSS ya existía), y la PWA nunca los hacía. */
export {
  MOMENTOS_IDLE,
  elegirMomentoIdle,
  duracionDeMomento,
  elegirMomentoReposo,
  pausaDeReposo,
  ritmoDeReposo,
  contextoDeReposo,
  intervaloExcursionPorHora,
  excursionDeHorario,
  TECHO_INACTIVIDAD_MS,
} from '../../compai/nucleo/gestos.js';

/* ── CONFIANZA (modo científico) ─────────────────────────────────────────────
   Chagra valora la honestidad sobre la alucinación: cuando el agente responde
   con evidencia firme se NOTA, y cuando duda TAMBIÉN se nota. El cuerpo lo
   dibuja como un anillo de certeza (halo): firme si está segura, punteado si
   es regular, titilante y con puntos suspensivos si duda. */
export const NIVELES_CONFIANZA = ['alta', 'media', 'baja'];

/**
 * Normaliza la confianza que entrega el host: acepta número 0..1 (score del
 * modo científico) o etiqueta directa. null/undefined = sin marca (el halo no
 * se dibuja; consumidores que no manejan confianza no ven nada nuevo).
 * @param {number|string|null|undefined} confianza
 * @returns {'alta'|'media'|'baja'|null}
 */
export function nivelDeConfianza(confianza) {
  if (confianza === null || confianza === undefined || confianza === '') return null;
  if (typeof confianza === 'string') {
    const c = confianza.toLowerCase().trim();
    if (c === 'segura') return 'alta';
    if (c === 'duda' || c === 'dudosa') return 'baja';
    return NIVELES_CONFIANZA.includes(/** @type {any} */ (c)) ? /** @type {any} */ (c) : null;
  }
  const n = Number(confianza);
  if (Number.isNaN(n)) return null;
  if (n >= 0.75) return 'alta';
  if (n >= 0.4) return 'media';
  return 'baja';
}
