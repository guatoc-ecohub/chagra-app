/**
 * src/config/messages.js — Catalogo centralizado de strings de UI (i18n-ready).
 *
 * TAREA 100 — Extraccion completa de strings en espanol hardcodeados.
 *
 * PATRON DE USO (ADR-050):
 *   import { MSG } from '../config/messages.js';
 *   <button>{MSG.cosecha.registrar}</button>
 *   <h1>{MSG.nav.plantas}</h1>
 *
 * CONVENCIONES:
 *   - Keys en camelCase, agrupadas por dominio funcional.
 *   - Valores en espanol (idioma base).
 *   - Strings con interpolacion usan MSG.format (ver abajo).
 *   - NUNCA hardcodear strings directamente en JSX/JS.
 *
 * ESTADO DE MIGRACION: parcial (auditado 2026-06-16, cubre strings comunes).
 * La regla ESLint 'chagra-i18n/no-hardcoded-spanish' (warn) en eslint.config.js
 * ayuda a detectar nuevos hardcodeos durante la migracion progresiva.
 */

function format(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? params[key] : '{' + key + '}',
  );
}

const messages = {
  workerDashboard: {
    titulo: 'Tareas por proximidad',
    cargando: 'Cargando tareas…',
    errorCompletar: 'No se pudo registrar el completado.',
  },
  fincaTools: {
    title: 'Crear planta (add_planta_finca)',
    finca: 'Finca: {value}',
    species: 'Especie: {value}',
    date: 'Fecha de siembra: {value}',
    zone: 'Zona: {value}',
    noZone: 'Sin zona',
    confirm: '¿Confirma usted esta operación?',
    forbidden: 'No tiene permiso: esta finca o zona no es suya. No es un problema de conexión.',
    network: 'No se pudo conectar con el servicio de finca. Revise su conexión e intente de nuevo.',
    unconfirmed: 'No se creó ninguna planta. Debe revisar y confirmar la operación exacta.',
  },
  agentRecord: {
    observation: 'Observación registrada via asistente',
    application: 'Aplicación: {product}',
    harvestDescription: 'Registrar cosecha de {quantity} {unit}{plant}',
    irrigationDescription: 'Registrar riego{quantity}',
    observationDescription: 'Registrar observación: "{notes}"',
    applicationDescription: 'Registrar aplicación: {notes}',
    rejected: 'Operador rechazo',
    adviceOnly: 'La consulta pide orientación, no autoriza un registro.',
    unbackedDelete:
      'No borré nada: sus siembras, zonas y registros siguen como estaban.\n\n' +
      'Borrar datos de la finca no se puede deshacer, así que no lo hago sin su confirmación explícita, aunque me pida no preguntar. ' +
      'Desde esta conversación no borro registros. Si quiere quitar una siembra o una zona, ábrala en Activos y use «Eliminar»: ahí le pedimos confirmar antes de borrar.',
    unbackedWrite:
      'No guardé nada en su finca desde esta conversación. Si quiere que lo anote, dígame qué registrar y le pido confirmar antes de guardarlo.',
  },
  biopreparados: { cargandoRecetas: 'Cargando recetas…' },
  compaiSession: {
    regreso: '¡Qué bueno tenerle de vuelta! Hace unos días que no nos vemos.',
  },
  comentarista: {
    fincaSinInventarioTecnico: 'Finca sin inventario técnico. Comience registrando sus cultivos para análisis integral.',
  },
  territorioSierra: {
    errorGuardar: 'No se pudo guardar. Intente de nuevo.',
    pendiente: 'Pendiente aproximada, según su apreciación',
    guardar: 'Guardar datos de la ladera',
  },
  nav: {
    plantas: 'Plantas',
    mapa: 'Mapa',
    hoyEnFinca: 'Hoy en finca',
    insumos: 'Insumos',
    tareas: 'Tareas',
    bitacora: 'Bitacora',
    biodiversidad: 'Flora y fauna',
    plagas: 'Plagas',
    casos: 'Casos',
    informes: 'Informes',
    perfil: 'Perfil',
    ayuda: 'Ayuda',
    agente: 'Agente',
  },
  photoMap: {
    localAvailable: 'Mapa local, disponible sin señal',
    mapAriaLabel: 'Mapa de fotos georreferenciadas',
  },
  photoCapture: {
    offlineToast: 'Sin conexión: la foto se diagnosticará al reconectar.',
    removePhoto: 'Eliminar foto',
    readError: 'No se pudo leer la foto.',
  },
  syncLog: {
    migradas: '[Migration] Tareas migradas con éxito.',
    storeNoDisponible: '[SyncManager] No se pudo cargar useLogStore:',
    logNoPersistido: '[SyncManager] No se pudo persistir log sincronizado (no crítico):',
    vozNoVerificada: '[SyncManager] No se pudo verificar voice recordings pendientes:',
    tareasOffline: 'Sin conexión, usando tareas caché en IndexedDB',
    pendiente: 'Pendiente',
  },
  animalesLotes: {
    registrar: 'Registrar lote',
    producto: 'Registrar carne curada',
  },
  loteCroquis: {
    mapaCentradoSinPrecision: 'Mapa centrado. La precisión no está disponible todavía.',
    mapaLabel: 'Mapa para dibujar el lote',
    guardar: 'Guardar lote',
    errorGuardar: 'No se pudo guardar el lote',
    errorCrear: 'No se pudo crear el lote',
    errorActualizar: 'No se pudo actualizar el lote',
    errorEliminar: 'No se pudo eliminar el lote',
    errorAsignar: 'No se pudo asignar al lote',
  },
  assetTimeline: {
    aplicacionBiopreparado: 'Aplicación (biopreparado)',
    pendienteRevision: 'Pendiente revisión',
    sincronizando: 'Sincronizando…',
    confirmar: 'Confirmar',
  },
  action: {
    guardar: 'Guardar',
    cancelar: 'Cancelar',
    eliminar: 'Eliminar',
    confirmar: 'Confirmar',
    buscar: 'Buscar',
    cerrar: 'Cerrar',
    editar: 'Editar',
    agregar: 'Agregar',
    crear: 'Crear',
    exportar: 'Exportar',
    sincronizar: 'Sincronizar',
  },
  registro: {
    guardadoSincronizado: 'Guardado y sincronizado',
    guardadoPendiente: 'Guardado aquí. Pendiente de subir',
    guardadoPendienteDetalle: 'Quedó guardado en su finca. Apenas vuelva la señal, se sube solo. Mientras tanto queda en Cuaderno de campo.',
    noGuardado: 'No se guardó',
    noGuardadoDetalle: 'El registro no quedó guardado. Revise los datos e inténtelo otra vez.',
    rechazoDetalle: 'El servidor no pudo guardar el registro. Revise estos datos: {details}',
    rechazoSinDetalle: 'El servidor no pudo guardar el registro. Revise los datos e inténtelo otra vez.',
    reintentar: 'Intentar de nuevo',
  },
  sueloLab: {
    fechaRequerida: 'Ingrese la fecha que aparece en el informe.',
    laboratorioRequerido: 'Ingrese el nombre del laboratorio.',
    numeroInvalido: 'Use un número, con punto o coma decimal.',
    phFueraDeRango: 'El pH debe estar entre 0 y 14.',
    porcentajeFueraDeRango: 'El porcentaje debe estar entre 0 y 100.',
    valorNegativo: 'El valor no puede ser negativo.',
    unidadRequerida: 'Seleccione o escriba la unidad del informe.',
    resultadoRequerido: 'Ingrese al menos un resultado del informe.',
    texturaFueraDeRango: 'Arena, limo y arcilla no pueden sumar más de 100 %.',
    noGuardado: 'No se pudo guardar. El formulario conserva los datos.',
    registrar: 'Registrar análisis',
    guardar: 'Guardar análisis de laboratorio',
  },
  cosecha: {
    registrar: 'Registrar cosecha',
    cantidad: 'Registrar cosecha de {qty} {unit}',
    cantidadConPlanta: 'Registrar cosecha de {qty} {unit} de {plant}',
  },
  riego: {
    registrar: 'Registrar riego',
    conCantidad: 'Registrar riego ({qty} {unit})',
    balance: {
      noCrop: 'No hay un cultivo relacionado con este lote.',
      noSowingDate: 'Falta una fecha de siembra en un log relacionado con la planta.',
      unsupportedCrop: 'No hay un Kc FAO-56 inequívoco para el cultivo registrado.',
      incompleteWeather: 'Falta ET₀ o lluvia para completar los últimos 7 días.',
      staleWeather: 'El dato climático está vencido; se espera una actualización antes de calcular.',
      invalidToday: 'No se pudo establecer la fecha local de la finca.',
      outsideCropCycle: 'La edad supera la duración de referencia; registre la cosecha o una nueva siembra.',
      invalidCropDate: 'La fecha de siembra no es válida para el periodo climático consultado.',
    },
  },
  observacion: {
    registrar: 'Registrar observacion',
    conNotas: 'Registrar observacion: "{notes}"',
  },
  aplicacion: {
    registrar: 'Registrar aplicacion',
    conProducto: 'Aplicacion: {product}',
    defaultNombreInsumo: 'Aplicación de insumo',
    nombreInsumo: 'Aplicación de {product}',
    registroTitulo: 'Registro de Aplicación',
    registradaCuaderno: 'Aplicación registrada en el Cuaderno de labores',
    verCuaderno: 'Ver el Cuaderno de labores',
  },
  status: {
    cargando: 'Cargando...',
    sinConexion: 'Sin señal',
    enLinea: 'Con señal',
    sincronizando: 'Poniendo todo al día...',
    pendientes: 'Pendientes',
    errorGeneral: 'Algo no salió bien. Inténtelo otra vez.',
    errorSincronizar: 'No se pudieron subir los cambios. Chagra vuelve a intentar solo.',
    dataLossCheckFailed: 'No se pudo verificar el estado de pérdida de datos.',
    dataRecoveryFailed: 'No se pudieron recuperar los datos desde FarmOS.',
    backupReadFailed: 'No se pudo leer el archivo.',
    sinConexionPendientes: (count) =>
      `Sin señal. ${count} registro${count !== 1 ? 's' : ''} guardado${count !== 1 ? 's' : ''} en su teléfono.`,
    sinConexionSinPendientes: 'Sin señal. Sus datos quedaron guardados en el teléfono.',
  },
  agente: {
    placeholder: 'Cuéntele a Chagra qué pasa en su finca...',
    pensando: 'Chagra está pensando...',
    respondiendo: 'Respondiendo',
    // Estado "pensando" del chat: el texto visible es solo la palabra (los
    // puntos suspensivos animados van en spans aparte) y el aria describe el
    // estado completo para lectores de pantalla.
    pensandoTexto: 'Pensando',
    pensandoAria: 'Chagra IA está pensando',
    pensandoRespuesta: 'Pensando su respuesta',
    respuestaLentaGuardada: 'Sigo pensando. Esto puede tardar en el campo. Su pregunta está guardada.',
    errorProcesandoItem: 'fallo procesando item',
    // Burbuja de Angelita: estados de pensamiento y respuesta
    angelitaPensando: 'Angelita está pensando, buscando en su memoria de la finca',
    angelitaRespondiendo: 'Angelita le está respondiendo',
    // Fases visibles del "pensando" (perceived performance): el pipeline
    // interno (transcripción → entendimiento → grounding/tools → generación)
    // se asoma a la UI para que la espera larga se sienta viva y con avance,
    // no colgada. Las claves las setea AgentScreen (thinkingPhase).
    fases: {
      transcribiendo: 'Entendiendo tu voz',
      entendiendo: 'Entendiendo tu pregunta',
      consultando: 'Consultando el catálogo y tu chagra',
      escribiendo: 'Escribiendo tu respuesta',
    },
    // Loading contextual (lever de velocidad PERCIBIDA): PASOS visibles dentro
    // de cada fase del "pensando". La fase REAL la marca el pipeline
    // (thinkingPhase en AgentScreen); dentro de 'consultando' — el tramo más
    // largo (grounding: catálogo + grafo AGE + guards/fuentes) — los pasos
    // rotan temporizados (~2s, sin loop: avanzan y se quedan en el último)
    // para que la espera de 22-34s se sienta viva y con avance, no colgada.
    // Ícono + texto corto: legible para baja alfabetización.
    fasesPasos: {
      transcribiendo: [{ icon: '🎙️', texto: 'Escuchando tu voz' }],
      entendiendo: [{ icon: '🌱', texto: 'Entendiendo tu pregunta' }],
      consultando: [
        { icon: '📖', texto: 'Consultando el catálogo' },
        { icon: '🌾', texto: 'Revisando el grafo de tu finca' },
        { icon: '🔍', texto: 'Verificando las fuentes' },
      ],
      escribiendo: [{ icon: '✍️', texto: 'Preparando la respuesta' }],
    },
    confianzaAlta: 'Confianza alta',
    confianzaMedia: 'Confianza media',
    confianzaBaja: 'Confianza baja',
  },
  perfil: {
    nombre: 'Nombre',
    operador: 'Operador',
    finca: 'Finca',
    configuracion: 'Configuracion',
    cerrarSesion: 'Cerrar sesion',
    perfilActivo: 'Perfil activo',
  },
  sesion: {
    vencidaConUnPendiente: 'Su sesión venció y 1 registro no se ha enviado. Está guardado en este teléfono: vuelva a entrar con esta misma cuenta y se envía solo.',
    vencidaConPendientes: 'Su sesión venció y {n} registros no se han enviado. Están guardados en este teléfono: vuelva a entrar con esta misma cuenta y se envían solos.',
  },
  confirm: {
    eliminarItem: '¿Seguro que quiere borrar esto? No se puede deshacer.',
    descartarCambios: '¿Salir sin guardar? Se pierde lo que escribió.',
    salirConPendientes: 'Hay {n} cambios sin enviar a Chagra. Si sale ahora se quedan guardados en este teléfono y se envían cuando vuelva a entrar con esta misma cuenta y tenga señal. ¿Quiere salir?',
  },
  voz: {
    grabando: 'Grabando...',
    grabandoAhora: 'Grabando…',
    procesando: 'Un momento, estoy escuchando...',
    errorMicrofono: 'No pudimos usar el micrófono. Revise el permiso en su teléfono.',
    transcripcion: 'Transcripción',
    ayudaVariaciones: 'Revise la transcripción arriba. Si Chagra escuchó bien pero el cultivo es una variedad nueva o regional (ej. una cepa específica, una variedad local), todavía no la tengo en mi catálogo.',
    opciones: 'Tienes 3 opciones:',
    opcionManual: 'Agregar manual abajo',
    opcionManualDesc: 'toca el botón "+" y escribe el cultivo + cantidad directamente.',
    opcionRegrabar: 'Re-grabar más simple',
    opcionRegrabarDesc: 'cierra esto y vuelve a grabar diciendo solo el nombre común (ej. "5 plantas de tomate") sin variedades.',
    opcionCancelar: 'Cancelar',
    opcionCancelarDesc: 'si era una prueba o no querías registrar nada.',
    eliminarEntrada: 'Eliminar entrada {index}',
  },
  onboarding: {
    bienvenido: 'Bienvenido a Chagra',
    comenzar: 'Comenzar',
    primeraPlanta: 'Bienvenido a Chagra. Empiece registrando su primera planta.',
    zonasListas: (count) =>
      `Tiene ${count} ${count === 1 ? 'zona' : 'zonas'} lista${count === 1 ? '' : 's'}. Falta su primera planta.`,
    fincaConfigurada: 'Su finca está configurada. Sembremos la primera planta.',
    elegirRegistro: 'Elija cómo registrarla. Las tres rutas guardan lo mismo.',
    tipZonas: 'Tip: tras la primera, puede crear zonas (parcelas, camas) para organizarlas.',
  },
  // Instalación de la PWA — strings COMPARTIDOS entre IosInstallBanner,
  // AndroidInstallBanner y el momento "instalar" del recorrido de bienvenida
  // (BienvenidaFinca), para no duplicar el copy de los pasos.
  instalarApp: {
    titulo: 'Instale Chagra',
    subtituloAndroid: 'Téngala en su pantalla de inicio, como una aplicación.',
    cta: 'Instalar Chagra',
    cerrarAria: 'Cerrar',
    iosPaso1: 'Toque el botón Compartir en Safari.',
    iosPaso2: 'Elija “Añadir a pantalla de inicio”.',
  },
  // Bienvenida de PRIMERA VEZ (BienvenidaFinca) — secuencia de 5 momentos.
  // Tono "usted" cordial colombiano, frases cortas (muchos usuarios leen poco).
  bienvenida: {
    eyebrow: 'Bienvenido a Chagra',
    titulo1: 'Esta chagra es suya',
    copy1: 'Un cuaderno de campo que escucha, mira y aprende de su finca.',
    titulo2: 'Cuéntele como a un vecino',
    copy2: 'Sin formularios enredados. Así de simple:',
    capVozTitulo: 'Háblele',
    capVozCopy: 'Con su voz: qué sembró, qué le preocupa.',
    capFotoTitulo: 'Muéstrele la mata',
    capFotoCopy: 'Una foto y le dice qué tiene.',
    capVerifTitulo: 'Respuestas verificadas',
    capVerifCopy: 'Cada consejo va cosido a su fuente.',
    // Herramientas / "juguetes" del campo (voz, cámara, gafas). Mención opcional
    // para el usuario que trae equipo: Chagra lo entiende por voz o por foto.
    capHerramTitulo: 'Sus herramientas del campo',
    capHerramCopy: 'Si tiene micrófono, cámara o gafas, Chagra lo escucha y lo mira igual.',
    // Momento 3 — "Hola Chagra": hablarle con las manos ocupadas (modo campo).
    // HONESTO con el MVP de voz (push-to-talk, D9 de la arquitectura
    // voice-first): se toca el micrófono UNA vez y se habla; la escucha
    // continua siempre-atenta es fase 2 y este copy NO la promete.
    vozTitulo: '¿Manos en la tierra? Háblele',
    vozCopy: 'En el surco, con guantes o con las manos sucias, no tiene que escribir: abra el agente, toque el micrófono y salude.',
    vozEjemplo: '“Hola Chagra, ¿cuándo abono el café?”',
    vozChip1: 'Con guantes puestos',
    vozChip2: 'En pleno surco',
    vozChip3: 'Sin escribir nada',
    vozNota: 'Y Chagra le puede responder con voz, para que no suelte la herramienta.',
    vozFotoAlt: 'Manos campesinas sembrando una plántula en la tierra.',
    // Momento 4 — instalar la app (PWA): el porqué es el campo sin señal.
    instalarTitulo: 'Llévela en el bolsillo',
    instalarCopy: 'Instale Chagra como una app y le sirve hasta donde no llega la señal.',
    instalarPorque1: 'Funciona sin internet, allá arriba en el lote.',
    instalarPorque2: 'Lo que registre queda guardado en su celular, sin gastar datos.',
    instalarPorque3: 'Abre con un toque desde su pantalla, como cualquier app.',
    instalarCta: 'Instalar Chagra ahora',
    instalarListo: 'Listo: Chagra ya está instalada en este equipo.',
    instalarMenuHint: 'En el menú de su navegador (⋮) busque “Instalar aplicación” o “Añadir a pantalla de inicio”.',
    instalarFotoAlt: 'Caficultor cogiendo café en una ladera de Rioblanco, Tolima.',
    titulo3: '¿Dónde está su tierra?',
    copy3: 'Con un toque sabemos su vereda y su altura. Así el consejo llega acertado para su clima.',
    siguiente: 'Siguiente',
    ubicarFinca: 'Ubicar mi finca',
    ahoraNo: 'Ahora no, quiero mirar primero',
    // Explorar con la finca de ejemplo (SKIP rico): puebla Chagra con una finca
    // demostrativa (multi-piso, con historial y problemas) para mirar sin llenar
    // nada. Es el camino del demo público.
    explorarEjemplo: 'Explorar con finca de ejemplo',
    explorarEjemploAria: 'Saltar el registro y explorar con una finca de ejemplo ya poblada',
    explorarEjemploHint: 'Mire una finca completa de una vez — cafetera, papera y de tierra caliente — con sus siembras y problemas reales.',
    saltar: 'Saltar',
    saltarAria: 'Saltar la bienvenida',
    escuchar: 'Escuchar en voz alta',
    pasoDe: (n, total) => `Paso ${n} de ${total}`,
  },
  ui: {
    cargando: 'Cargando...',
    // BUG-08 2026-09-04: puertas al event sourcing desde la Bodega.
    conteoManual: 'Conteo manual',
    bitacora: 'Bitácora',
    bitacoraDeItem: (itemId) => `Bitácora · ${itemId}`,
    cargandoReportes: 'Cargando reportes...',
    cargandoPlan: 'Cargando plan...',
    cargandoCiclos: 'Cargando tus ciclos...',
    cargandoFotos: 'Cargando fotos...',
    cargandoTareas: 'Cargando tareas...',
    cargandoCatalogo: 'Cargando catálogo...',
    cargandoCatalogoInvasoras: 'Cargando catálogo…',
    errorGuardarReporteInvasora: 'Error al guardar reporte',
    errorCatalogoInvasoras: 'No se pudo cargar el catálogo de especies. Verifica conexión y refresca. Si persiste, revisa la consola del navegador.',
    guardarReporte: 'Guardar Reporte',
    verMas: 'Ver más',
    sincronizandoSensores: 'Poniendo los sensores al día...',
    sincronizandoRegistros: (count) =>
      `Subiendo ${count} registro${count !== 1 ? 's' : ''}...`,
    sincronizarSensoresBtn: 'Poner sensores al día',
    sincronizarOffline: 'Guardando...',
    registrarProduccion: 'Registrar Producción',
    guardarGeometria: 'Guardar geometría',
    tareasPendientes: 'Tareas Pendientes',
    configuracionSitio: 'Configuración del sitio',
    confirmarEliminar: '¿Eliminar este reporte? Esta acción no se puede deshacer.',
    eliminarReporte: 'Eliminar reporte',
    cancelarInvestigacion: 'Cancelar investigación',
    guardarPlantas: (count) =>
      `Guardar (${count} ${count === 1 ? 'planta' : 'plantas'})`,
    guardarPlanta: 'Guardar planta',
    guardando: 'Guardando…',
    ingresoBitacora: 'Registrar en el Cuaderno de labores',
    errorMarcarPaso: 'No se pudo marcar el paso como hecho. Intente de nuevo en un momento.',
    errorReporteCsv: 'No se pudo crear el archivo del informe. Inténtelo otra vez.',
    errorAbastecer: 'No se pudo abastecer el insumo. Inténtelo otra vez en un momento.',
    errorGps: 'No pudimos empezar a marcar la ubicación. Inténtelo de nuevo.',
    errorPermisoNegado: 'Permiso de ubicación denegado. En iPhone: Ajustes > Safari > Ubicación.',
    errorPermisoNegadoAndroid: 'Permiso de ubicación denegado. En iPhone: Ajustes > Safari > Ubicación. En Android: toca el candado de la barra de URL.',
    errorGpsNoDisponible: 'GPS no disponible. Sal al exterior y verifica que el GPS esté activo.',
    errorGpsNoDisponibleDetalle: 'GPS no disponible. Verifica que el GPS esté activo y que estés al exterior (no en sótano / lejos de ventana).',
    errorUbicacion: 'No pudimos encontrar tu ubicación. Inténtalo de nuevo.',
    errorTimeout: 'El GPS se demoró más de la cuenta. Al aire libre puede tardar un poco — espera unos segundos y vuelve a tocar "Mi ubicación".',
    // Bug #57 — trazar caminando: warm-up del GPS antes de empezar el trazo.
    gpsAfinando: 'Afinando GPS… espera a que la señal mejore.',
    confirmarAbastecer: 'Confirmar',
    registrando: 'Registrando…',
  },
  // Strings de la pantalla de Perfil (ADR-050 i18n). Extraídos al añadir el
  // selector de perfil + override del operador (2026-06-19) para mantener el
  // archivo libre de hardcodeos (chagra-i18n/no-hardcoded-spanish).
  perfilScreen: {
    // C37 (2026-10-31): salida de la sesión en un teléfono compartido.
    cerrarSesion: 'Cerrar sesión',
    cerrarSesionPregunta: '¿Cerrar sesión en este teléfono? Se borran de aquí su conversación con Chagra y lo que dejó escrito sin enviar. Lo que ya está registrado en la finca no se pierde.',
    cerrarSesionConfirmar: 'Sí, cerrar sesión',
    cerrarSesionCancelar: 'Cancelar',
    rolOperadorCampo: 'Operador de Campo',
    tituloPantalla: 'Perfil de Usuario',
    agregarFotoPerfil: 'Agregar foto de perfil',
    agregarFoto: 'Agregar foto',
    ubicacionDesc: 'Mapa, piso térmico y cultivos de tu zona',
    guardarCambios: 'Guardar cambios',
    telemetriaVozDesc: 'Ayuda a mejorar cómo Chagra escucha su voz',
    telemetriaAgenteDesc: 'Ayuda a mejorar el agente. Desactivado por defecto.',
    fincaActivaLabel: 'Finca activa:',
    guardar: 'Guardar',
  },
  // Hero de bienvenida (WelcomeStatsHero) — etiquetas del mini-grid de stats.
  welcomeStats: {
    cargando: 'Cargando estadísticas',
    plantasRegistradas: 'Plantas registradas',
    plantaTuya: 'Planta tuya',
    plantasTuyas: 'Plantas tuyas',
  },
  // Tipos de eventos de ciclo (farm_process_events) — etiquetas legibles
  // para humanos en hoja de vida por mata (hojaVidaMataService).
  eventTypes: {
    sowing_confirmed: 'Siembra confirmada',
    transplanting: 'Trasplante',
    observation: 'Observación',
    fertilizer_applied: 'Fertilización',
    pesticide_applied: 'Aplicación de insumo',
    harvest: 'Cosecha',
    pruning: 'Poda',
    irrigation: 'Riego',
    stage_change: 'Cambio de etapa',
    health_issue: 'Problema de sanidad',
    weather_event: 'Evento climático',
  },
  // Modo campo / wake-word "hola chagra" (#2088) — ver ModoCampoPanel.jsx,
  // EnrollmentModoCampo.jsx, wakeWordService.js.
  modoCampo: {
    estadoCargando: 'Cargando…',
    estadoCargandoModelo: 'Cargando modelo…',
    estadoCargandoVoz: 'Cargando tu voz…',
    estadoPreparando: 'Preparando el oído de Chagra por primera vez… (unos segundos; después queda listo al instante)',
    estadoEscuchando: 'Escuchando «hola chagra»',
    estadoError: 'Hubo un problema',
    grabandoHableAhora: 'Grabando… hable ahora',
    errorCargaLibs: 'No se pudo cargar {src}',
  },
  // Recorrido de finca por voz (useRecorridoStore / recorridoService).
  recorrido: {
    errorRegistro: 'No se pudo registrar la observación',
  },
  // Login y caminos de autenticación (URGENTE-login-se-apaga-25sep):
  // mensajes del camino PKCE y su fallback (LoginScreen / authService).
  auth: {
    pkceNoConfigurado: 'El acceso seguro (PKCE) no está configurado en esta instalación.',
    accesoSeguroFallido: 'No se pudo iniciar el acceso seguro. Intente de nuevo.',
    accesoSeguroFallidoUsandoClasico: 'No se pudo iniciar el acceso seguro; se usará el acceso clásico.',
    instalacionSinCamino: 'El acceso clásico fue retirado y esta instalación no tiene configurado el acceso seguro (PKCE). Contacte al administrador de Chagra.',
    callbackProcessing: 'procesando',
    callbackVerifying: 'Verificando sesión...',
    callbackFailed: 'No se pudo completar el inicio de sesión.',
    callbackUnexpectedError: 'Error inesperado en el callback de autenticación.',
    callbackReturn: 'No se pudo completar el inicio de sesión. Te llevamos de vuelta al login.',
    callbackIdentityMissing: 'No pudimos confirmar su usuario. Vuelva a ingresar.',
    callbackFincaFailed: 'No pudimos abrir esa finca. Vuelva a intentarlo.',
  },
  // Pantalla del tiempo (ClimaBoletinScreen), bloque de trazabilidad.
  clima: {
    errorConsulta: 'No se pudo consultar la red meteorológica.',
    sinVentanaProteccion: 'No hay ventana que aguante: priorice lo cultural (aporque, sacar focos, no regar por encima).',
    ventanaProteccionSinDatos: 'No se pudo confirmar una ventana de protección: priorice lo cultural (aporque, sacar focos, no regar por encima) y revise con datos horarios completos.',
    observacionEstacion: 'Observación de estación: {nombre}.',
    alturaFincaVsCelda: 'Finca: {finca} m s. n. m. · celda: {celda} m s. n. m. · diferencia: {diferencia} m.',
    frescuraSinDato: 'Todavía no hay pronóstico de su finca.',
    frescuraSinHora: 'Open-Meteo, sin hora de consulta.',
    frescuraSinRed: 'Sin conexión: pronóstico guardado el {hora}. No es de ahora.',
    frescuraVieja: 'Pronóstico consultado el {hora}: tiene 3 horas o más. Actualícelo.',
    frescuraFresca: 'Open-Meteo, consultado el {hora}.',
    agregarCultivos: 'Agregar mis cultivos',
    confirmarMunicipioAltitud: 'Confirmar municipio y altitud',
  },
  visionReview: {
    catalogMatch: 'Nombre encontrado en el catálogo.',
    pending: 'Revisión visual pendiente.',
    positive: 'Veredicto visual positivo: la foto es compatible con la especie.',
    negative: 'Veredicto visual negativo: la foto no coincide con la especie.',
    abstained: 'El juez se abstuvo: no pudo confirmar la especie en esta foto.',
    error: 'No se pudo consultar el veredicto visual.',
    'enqueue-error': 'No se pudo encolar la revisión visual.',
    timeout: 'Se agotó el plazo de revisión visual. La especie sigue sin confirmar.',
  },
  format,
};

messages.farmSeals = {
  readPhotoError: 'No se pudo leer la foto.',
  add: 'Agregar sello',
  saveError: 'No se pudo guardar en este teléfono.',
  save: 'Guardar sellos',
};

messages.miGoteo = {
  rechazadoTexto: 'No es un diseño de goteo válido, así que no se guardó nada. Vuelva al mundo del goteo y toque otra vez «Guardar en mi finca».',
  guardarOtro: 'Guardar como otro sistema',
  guardar: 'Guardar en mi finca',
  pendiente: 'Pendiente de subir',
  errorMarcar: 'No se pudo marcar. Intente de nuevo.',
  errorNombre: 'No se pudo cambiar el nombre.',
  errorQuitar: 'No se pudo quitar. Intente de nuevo.',
  errorGuardar: 'No se pudo guardar. El diseño sigue aquí para intentarlo otra vez.',
  guardadoSinSenal: 'Guardado en este teléfono. Sube a su finca cuando vuelva la señal.',
  guardado: 'Guardado en su finca.',
  vacioTexto: 'En el mundo del goteo calcula el suyo: el campo, el invernadero, la bomba solar o la casa. Al final toque «Guardar en mi finca» y queda aquí, con su lista de compra.',
};

export const MSG = new Proxy(messages, {
  get(target, prop) {
    if (prop === 'format') return target.format;
    return target[prop];
  },
});

export default messages;
