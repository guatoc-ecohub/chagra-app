/**
 * respuestasDelDia.js — las respuestas del día en UN solo lugar, sin React y
 * sin DOM: ¿Llueve?, ¿Aplico?, ¿Hiela?, ¿Hongos? y ¿Riego?, el «Qué hacer»,
 * el granizo o la tormenta, la franja de 24 horas y la lectura en voz alta.
 * Y el vistazo de lo que viene: los próximos 16 días (pestaña «7–16 días») y
 * la temporada (pestaña «El Niño»), con las mismas frases que esas pestañas.
 *
 * Entra el pronóstico de Open-Meteo (crudo, el mismo que pide
 * agroMeteoService, o ya normalizado), el reloj y la finca; sale lo que dice
 * la pestaña «Hoy» de «El tiempo», como datos y como frases. La pantalla solo
 * pinta lo que este módulo devuelve; el descenso (sitio estático aparte) usa
 * el mismo código empaquetado con `npm run respuestas:paquete`.
 *
 * No pide nada a la red ni guarda nada. Las reglas viven en cieloHoy.js y en
 * los servicios; aquí se juntan y se redactan.
 */
import { normalizarAgroMeteo } from '../../services/agroMeteoService.js';
import { clasificarPisoTermico } from '../../services/pisoTermicoClassifier.js';
import {
    accionSanitariaDeCultivos, tituloSanitarioDeCultivos, riesgosSanitariosDeCultivos, ORIGEN_AVISO_SANITARIO,
} from '../../services/riesgoSanitarioPiso.js';
import { ensoRegionalLine } from '../../services/ensoContext.js';
import {
    BOLETINES_IDEAM, LECTURA_ENSO, REGLA_INSIGNIA_POR_PISO, reglaInsigniaNinoFrio, suPisoTexto,
} from '../../data/climaBoletines.js';
import { diaEsCO } from '../../utils/fechaEsCO.js';
import {
    avisoGranizo, bandaHelada, diasDesdeHoy, franjasAplicarSemana, frescuraDelDato, LLUVIA_APRECIABLE_MM,
    lineaEstacionAnoche, lluviaDeAhora, momentoDeLaFinca, paraVoz, primeraVentanaSeca, proximas24h, sinPuntoDoble, textoFranja,
    textoLigero, tormentaPorVenir, tormentaSinCantidad, tramoDeLaNoche, veredictoDelDia,
} from './cieloHoy.js';
import { resumenSemanal } from './resumenSemanal.js';

/**
 * Versión del contrato de `respuestasDelDia` para quien consume el paquete
 * (el descenso): sube cuando cambia la forma de la entrada o de la salida.
 * v2 (W47): `dias16` y `temporada`, y sus funciones `vistazoDias` y
 * `vistazoTemporada`; la entrada suma `faseFuente`, `faseCopiaDel`, `region`
 * y `sinConexion`.
 * v3 (W48): `lluviaAhora` (`{ estado, mm, frase }`: «con-cifra», «sin-cifra»
 * o «no-llueve», la misma regla que «¿Llueve?»), y la función `lluviaDeAhora`.
 */
export const VERSION_API = 3;

/** La lluvia de ahora en tres estados, para quien dibuja la escena (W48). */
export { lluviaDeAhora, FRASE_LLUVIA_AHORA } from './cieloHoy.js';

/** Las tres preguntas que se leen sin abrir nada, en su orden. */
export const PREGUNTAS_PRINCIPALES = Object.freeze(['lluvia', 'aplicar', 'helada']);

/** Cómo se suma la lluvia de «¿Llueve?» (el método, al abrir su detalle). */
export const METODO_LLUVIA = 'La lluvia se suma por intervalos completos de una hora, incluida la hora en curso. '
    + 'La fuente no permite separar los minutos transcurridos. Cada cantidad es la lluvia de la hora que termina: '
    + 'la de las 3 es la que cae de las 2 a las 3. El detalle dice la primera y la última hora de la suma.';

const CONFIRMAR_APLICAR = 'Confirme el pronóstico, la hoja seca y el tiempo de secado de la etiqueta.';
const FRANJA_JUSTA = 'Franja justa: puede cambiar. Revise sus límites.';
const TITULO_DETALLE = { lluvia: 'Cantidad y probabilidad', aplicar: 'Condiciones para aplicar', helada: 'Cómo se estima el frío' };
const SIN_MEMORIA_SANITARIA = 'Sin datos de días anteriores suficientes para completar la memoria de humedad y lluvia.';

/**
 * Las frases de una fila del veredicto, en el orden en que se leen: la
 * cabeza (pregunta y respuesta), lo que va visible debajo y el detalle que
 * se abre. Cada línea del detalle lleva su `tipo` para que quien la pinte le
 * dé su estilo; el texto ya es el definitivo.
 *
 * @param {object} f fila de `veredictoDelDia`
 * @param {{estacion?: object|null}} [opts] observación de estación de anoche (solo la helada la usa)
 */
export function frasesDeFila(f, { estacion = null } = {}) {
    // El «Qué hacer» de la helada se lee sin abrir cuando hay riesgo; entonces
    // no se repite dentro del desplegable.
    const accionArriba = f.id === 'helada' && f.nivel !== 'bien' && Boolean(f.accion);
    const detalle = [];
    const lineaEstacion = f.id === 'helada' ? lineaEstacionAnoche(estacion) : null;
    if (lineaEstacion) detalle.push({ tipo: 'estacion', texto: lineaEstacion });
    if (f.condiciones) f.condiciones.forEach((texto) => detalle.push({ tipo: 'porque', texto: texto.replace(/ Confirme la hoja seca en el lote\.$/, '') }));
    else detalle.push({ tipo: 'porque', texto: f.porque });
    if (f.margen) detalle.push({ tipo: 'margen', prefijo: f.fechaMargen ? `${f.fechaMargen}: ` : '', texto: f.margen });
    if (f.accion && !accionArriba && !(f.id === 'aplicar' && f.accion.startsWith('Confirme la hoja seca'))) detalle.push({ tipo: 'accion', texto: f.accion });
    // El corte que puso el nivel, en su propia línea y no dentro del «Qué hacer» (W44, R6 de la v19).
    if (f.regla) detalle.push({ tipo: 'regla', texto: f.regla });
    if (f.contexto) detalle.push({ tipo: 'contexto', texto: f.contexto });
    return {
        id: f.id,
        nivel: f.nivel,
        pregunta: f.pregunta,
        respuesta: f.respuesta,
        // Solo cuando la respuesta ofrece una franja que se puede usar (v19, § 4 punto 2).
        confirmar: f.id === 'aplicar' && /^(?:Sí|Mañana)\b/.test(f.respuesta ?? '') ? CONFIRMAR_APLICAR : null,
        franjaJusta: f.margen?.startsWith('Franja al borde') ? FRANJA_JUSTA : null,
        accion: accionArriba ? f.accion : null,
        salvedad: f.salvedad || null,
        tituloDetalle: TITULO_DETALLE[f.id] ?? 'Balance de agua',
        detalle,
        metodo: f.id === 'lluvia' ? { titulo: 'Cómo se suma esta lluvia', texto: METODO_LLUVIA } : null,
    };
}

/**
 * La lectura de «¿Hongos?»: la respuesta corta, UNA frase con su acción y,
 * con cultivos declarados, el detalle por enfermedad. Nombra un cultivo solo
 * si está en el perfil; sin cultivos habla del riesgo en el piso.
 *
 * @param {object|null} r salida de `evaluarRiesgoSanitarioPiso` (o la `sanitario` de la fila)
 * @param {{cultivos?: Array<string|object>|null, piso?: string|null, deNoche?: boolean}} [opts]
 */
export function lecturaSanitaria(r, { cultivos = null, piso = null, deNoche = false } = {}) {
    const relevantes = riesgosSanitariosDeCultivos(r, cultivos);
    const perfilDeclarado = Array.isArray(cultivos) && cultivos.length > 0;
    const peor = perfilDeclarado ? (relevantes[0] || null) : (relevantes[0] || r?.peor);
    const nivel = peor?.nivel || 'sin_evaluar';
    const titulo = tituloSanitarioDeCultivos(r, cultivos);
    const opcionesSanitarias = { cultivos, piso };
    // Con cultivos declarados hay plegado: la franja para proteger (la misma
    // de «¿Aplico?») va dentro y la frase visible queda en qué revisar hoy.
    const conDetalle = perfilDeclarado && Boolean(peor);
    const proteccion = conDetalle && r?.proteccionEsFranja ? r.accionProteccion || null : null;
    const sinFranja = accionSanitariaDeCultivos(proteccion ? { ...r, accionProteccion: undefined } : r, opcionesSanitarias);
    // Sin la franja, la frase de un solo riesgo alto no nombra la enfermedad.
    const accion = proteccion && peor?.nombre && !sinFranja.toLowerCase().includes(peor.nombre.split(' ')[0].toLowerCase())
        ? `${peor.nombre}: ${sinFranja.charAt(0).toLowerCase()}${sinFranja.slice(1)}` : sinFranja;
    const deHoy = (texto) => (deNoche ? texto.replace(/\bhoy\b/g, 'mañana') : texto);
    return {
        nivel,
        pregunta: '¿Hongos?',
        respuesta: titulo,
        accion: deHoy(accion),
        sinMemoria: Number(r?.diasAnterioresDisponibles) < 3 ? SIN_MEMORIA_SANITARIA : null,
        detalle: conDetalle ? {
            titulo: proteccion ? 'Cuándo proteger, cada enfermedad y por qué' : 'Qué hacer con cada una y por qué',
            proteccion: proteccion ? deHoy(proteccion) : null,
            // Campos sueltos para pintarlos con su estilo, y la frase entera para quien la lea tal cual.
            enfermedades: relevantes.slice(0, 3).map((item) => ({
                enfermedad: item.enfermedad,
                nombre: item.nombre,
                nivel: item.nivel,
                accion: item.accion,
                porque: item.porque,
                confianza: item.confianza,
                fuente: item.fuente,
                frase: `${item.nombre}, riesgo ${item.nivel}: ${item.accion}`,
            })),
            origen: ORIGEN_AVISO_SANITARIO,
        } : null,
    };
}

/* ── Lo que viene: los próximos 16 días (pestaña «7–16 días») ─────────── */

/** Días que llevan su probabilidad de lluvia; desde el cuarto, solo la tendencia en mm. */
export const DIAS_CON_PROBABILIDAD = 3;

/** Dónde está el detalle de cada vistazo en «El tiempo». */
const DETALLE_SEMANA = Object.freeze({ pantalla: 'El tiempo', pestana: 'semana', titulo: '7–16 días' });
const DETALLE_TEMPORADA = Object.freeze({ pantalla: 'El tiempo', pestana: 'estacional', titulo: 'El Niño' });

const PLAN_HUMEDO = 'Mientras siga lloviendo: despeje las salidas de agua sin arrastrar tierra. Aporque donde haga falta cuando el suelo permita trabajar sin amasar barro. Cada mañana revise debajo de las hojas y en los tallos; retire los focos del lote y evite mojar las hojas al regar.';
const NOTAS_PLAN_HUMEDO = Object.freeze([
    'Secar grano requiere sol y aire seco durante el día. Aplicar un foliar se evalúa por horas y puede tener una franja aunque no haya día de secado.',
    'Si aparecen manchas que avanzan o tallos blandos, retire esos focos y vuelva a evaluar el manejo con asistencia técnica.',
]);

/** Una cifra de la fuente o null: un día sin dato nunca se vuelve 0. */
const cifraONulo = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * El plan para la racha húmeda (solo con riesgo alto de hongos): el día con
 * más lluvia, qué hacer mientras llueva y la primera ventana para secar grano.
 */
function planRachaHumeda(daily, hoy) {
    const pronostico = diasDesdeHoy({ daily, today: { date: hoy } });
    const fecha = primeraVentanaSeca(daily, hoy);
    const fechaCampo = fecha ? diaEsCO(fecha) : null;
    const horizonte = pronostico.slice(0, 16);
    const diasConLluvia = horizonte.filter((d) => Number.isFinite(d.precip_mm));
    const maximo = diasConLluvia.reduce((mayor, d) => !mayor || d.precip_mm > mayor.precip_mm ? d : mayor, null);
    const completos = pronostico.length > 0 && pronostico.every((d) =>
        [d.sol_horas, d.rh_mean, d.precip_mm].every(Number.isFinite));
    return {
        titulo: 'Plan para la racha húmeda',
        maximo: maximo?.precip_mm > 0
            ? `${diaEsCO(maximo.date)}: el día con más lluvia prevista, ${Math.round(maximo.precip_mm)} mm${diasConLluvia.length < horizonte.length ? ' entre los días con dato' : ''}. Es un pronóstico; confirme al acercarse la fecha.`
            : null,
        plan: PLAN_HUMEDO,
        tituloDetalle: 'Ventanas y señales para revisar',
        primeraVentanaSeca: fecha,
        primeraVentana: fechaCampo
            ? `Primera ventana probable para secar grano: ${fechaCampo}, si se cumple el pronóstico.`
            : completos ? `No aparece una ventana probable para secar grano en los ${pronostico.length} días del pronóstico, hasta ${diaEsCO(pronostico.at(-1).date)}. Revise de nuevo cada día.`
                : 'No hay pronóstico suficiente para señalar una ventana seca. Revíselo mañana.',
        notas: NOTAS_PLAN_HUMEDO,
    };
}

/**
 * Las ventanas de labor de la semana. Aplicar: el MISMO motor horario de
 * «¿Aplico?», día por día. Secar: sol > 5 h, humedad media < 75 % y sin lluvia.
 */
function ventanasDeLabor(agrometeo, ahoraMs, dias) {
    const franjas = franjasAplicarSemana(agrometeo, ahoraMs);
    const aplicar = franjas.find((f) => f.franja);
    const evaluables = franjas.some((f) => f.evaluable);
    const hoy = agrometeo?.today?.date;
    const secar = primeraVentanaSeca(dias, hoy);
    // UN formato de día en toda «El tiempo» (CLIMA-R7): «jue 24», no «ju 24».
    const fmt = (iso) => (iso === hoy ? 'Hoy' : diaEsCO(iso) || 'sin fecha');
    const plazo = aplicar ? textoFranja(aplicar.franja, aplicar.date, hoy) : null;
    return {
        aplicar: {
            titulo: 'Aplicar foliar',
            fecha: aplicar?.date ?? null,
            respuesta: aplicar ? fmt(aplicar.date) : evaluables ? 'Sin franja' : 'Sin cálculo',
            texto: aplicar ? plazo === 'revise más cerca' ? 'Revise más cerca.' : `Probable ${plazo}`
                : franjas.some((f) => f.tormenta) ? 'El parte trae tormenta.'
                    : evaluables ? 'No se reúnen las condiciones.' : 'Faltan datos por hora.',
        },
        secar: {
            titulo: 'Secar grano',
            fecha: secar,
            respuesta: secar ? fmt(secar) : 'Sin ventana',
            texto: secar ? 'Sol fuerte y aire seco: buen día de secado.' : 'Poco sol o mucha humedad estos días.',
        },
    };
}

/**
 * El vistazo de los próximos 16 días, con los datos y las frases de la
 * pestaña «7–16 días»: por día, la fecha, la máxima, la mínima, la lluvia y su
 * probabilidad (con el corte de 0,2 mm); el resumen que se lee en voz alta, el
 * plan de la racha húmeda (con riesgo alto de hongos) y las ventanas de labor.
 * Un día sin dato lleva null, nunca 0. null si no hay pronóstico.
 *
 * @param {object} entrada
 * @param {object|null} [entrada.agrometeo] pronóstico normalizado por agroMeteoService
 * @param {number} [entrada.ahoraMs] el reloj (epoch en ms)
 * @param {object|null} [entrada.finca] `{ lat, lng, vereda?, municipio?, departamento?, precision? }`
 * @param {object|null} [entrada.sanitario] salida de `evaluarRiesgoSanitarioPiso` (la de «¿Hongos?»)
 */
export function vistazoDias({ agrometeo = null, ahoraMs = Date.now(), finca = null, sanitario = null } = {}) {
    const dias = diasDesdeHoy(agrometeo);
    if (!agrometeo || dias.length === 0) return null;
    const hoy = agrometeo.today?.date ?? null;
    const resumen = resumenSemanal({ dias, location: finca }) || null;
    return {
        desde: dias[0].date,
        hasta: dias.at(-1).date,
        corteLluviaMm: LLUVIA_APRECIABLE_MM,
        diasConProbabilidad: DIAS_CON_PROBABILIDAD,
        dias: dias.map((d, i) => {
            const maxima = cifraONulo(d.temp_max);
            const minima = cifraONulo(d.temp_min);
            const lluviaMm = cifraONulo(d.precip_mm);
            const probabilidad = cifraONulo(d.precip_prob);
            return {
                fecha: d.date,
                dia: d.date === hoy ? 'Hoy' : diaEsCO(d.date) || 'sin fecha',
                esHoy: d.date === hoy,
                maxima,
                minima,
                lluviaMm,
                // ¿Llueve de forma apreciable? Con el corte de «¿Llueve?»; sin dato, null.
                lluviaApreciable: lluviaMm == null ? null : lluviaMm >= LLUVIA_APRECIABLE_MM,
                probabilidad,
                // Desde el cuarto día la pestaña no dice la probabilidad: solo la tendencia.
                probabilidadSeDice: i < DIAS_CON_PROBABILIDAD,
                sinDato: maxima == null && minima == null && lluviaMm == null,
            };
        }),
        resumen,
        planRachaHumeda: sanitario?.peor?.nivel === 'alto' ? planRachaHumeda(agrometeo.daily, hoy) : null,
        ventanas: ventanasDeLabor(agrometeo, ahoraMs, dias),
        // Lo que dice «Escuchar» en la pestaña.
        textos: { voz: resumen },
        detalleEn: DETALLE_SEMANA,
    };
}

/* ── La temporada (pestaña «El Niño») ────────────────────────────────── */

/** Rótulo de la fase cuando no se pudo leer: sin primera persona (W40, J8 de la v17). */
export const FASE_SIN_DATO = 'Sin dato de la fase de hoy';
const ROTULO_FASE = Object.freeze({ nino: 'El Niño', nina: 'La Niña', neutral: 'Neutral' });

/**
 * Una fecha del dato recibido en palabras («15 de septiembre de 2026»), o
 * null. Acepta `AAAA-MM-DD`, ISO, epoch en ms o Date.
 */
export function fechaDelDato(value) {
    if (!value) return null;
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('es-CO', {
        timeZone: 'America/Bogota', year: 'numeric', month: 'long', day: 'numeric',
    });
}

/** De dónde salió la fase, en palabras. */
function etiquetaFuenteFase(clave, copiaDel) {
    const copia = fechaDelDato(copiaDel);
    const etiquetas = {
        live: 'Fase leída del dato recibido',
        // Copia válida pero ya no fresca: nunca se rotula «En vivo».
        cached: copia ? `Copia guardada del ${copia}` : 'Copia guardada, sin fecha',
        manual: 'Fijada a mano',
        openmeteo: 'Open-Meteo',
        archive: 'Archivo histórico del clima',
        default: 'Fase no disponible',
        // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish -- copy UI es-CO, deuda de i18n (messages.js) pendiente igual que el resto del módulo
        offline: 'Sin conexión',
    };
    return etiquetas[clave] ?? etiquetas.default;
}

/**
 * El vistazo de la temporada, con las frases de la pestaña «El Niño»: la
 * fase con su fuente y frescura (o «sin dato»), qué significa para la finca y
 * la regla de «qué hacer» según el piso. En tierra fría, El Niño se dice como
 * posibilidad que se mira en la mínima, y la protección contra la helada se
 * revisa con un técnico (W45).
 *
 * @param {object} entrada
 * @param {string|null} [entrada.enso] familia de la fase (`nino`, `nina`, `neutral`) o null si no se leyó
 * @param {string|null} [entrada.faseLabel] rótulo de la fase; sin él, el de la familia
 * @param {string|null} [entrada.faseFuente] `live`, `cached`, `manual` o `default`; sin él, `live` con fase y `default` sin ella
 * @param {string|number|Date|null} [entrada.faseCopiaDel] fecha de la copia guardada (con `cached`)
 * @param {boolean} [entrada.sinConexion] sin fase y sin red: la fuente se rotula «Sin conexión»
 * @param {string|null} [entrada.piso] id del piso térmico (`frio`, `paramo`, `templado`, `calido`…)
 * @param {string|null} [entrada.region] región natural (`andina`, `caribe`…) para la lectura regional
 * @param {boolean} [entrada.tienePapa] el perfil declara papa
 */
export function vistazoTemporada({
    enso = null, faseLabel = null, faseFuente = null, faseCopiaDel = null, sinConexion = false,
    piso = null, region = null, tienePapa = false,
} = {}) {
    const conocida = enso != null;
    const fuente = faseFuente || (conocida ? 'live' : 'default');
    const clave = fuente === 'default' && sinConexion ? 'offline' : fuente;
    const pisoFrio = piso === 'frio' || piso === 'paramo';
    const lineaRegional = conocida ? ensoRegionalLine(enso, region) : '';
    const regla = !conocida ? null : enso === 'nino' && pisoFrio
        ? reglaInsigniaNinoFrio(piso)
        : REGLA_INSIGNIA_POR_PISO[enso] || REGLA_INSIGNIA_POR_PISO.neutral;
    const lectura = !conocida
        ? { titulo: 'Fase no disponible', resumen: 'Consulte el boletín oficial antes de decidir según El Niño o La Niña.' }
        : enso === 'nino' && pisoFrio
            ? {
                titulo: 'El Niño: atención a las noches frías',
                // Solo se nombra un cultivo si el perfil lo tiene.
                resumen: tienePapa
                    ? 'Para su papa, las noches despejadas pueden aumentar la exposición al frío.'
                    : `En ${suPisoTexto(piso)}, las noches despejadas pueden aumentar la exposición de los cultivos al frío.`,
            }
            : enso === 'nino' && !piso
                ? { titulo: 'El Niño: el efecto cambia con la altura', resumen: 'Complete la ficha de su finca para recibir la lectura de su piso térmico.' }
                : LECTURA_ENSO[enso] || LECTURA_ENSO.neutral;
    const regional = conocida && !pisoFrio && Boolean(lineaRegional);
    return {
        conocida,
        familia: conocida ? enso : null,
        rotulo: conocida ? faseLabel || ROTULO_FASE[enso] || ROTULO_FASE.neutral : FASE_SIN_DATO,
        fuente: { clave, etiqueta: etiquetaFuenteFase(clave, faseCopiaDel), copiaDel: clave === 'cached' ? fechaDelDato(faseCopiaDel) : null },
        // Qué significa para esta finca: la lectura de su región o la de la fase y el piso.
        significado: { texto: regional ? lineaRegional : lectura.resumen, regional },
        // La lectura de la región, aunque en tierra fría ceda el lugar a la del piso.
        lineaRegional: lineaRegional || null,
        // La regla de «qué hacer» según el piso; sin fase, ninguna.
        regla,
        titulo: lectura.titulo,
        procedencia: fuente === 'manual'
            ? 'Usted fijó esta fase a mano. Es una selección para orientar la lectura, no una confirmación por observaciones.'
            : conocida ? 'La fase se leyó del dato recibido. La observación del océano y el pronóstico de la temporada son datos distintos.'
                : 'Falta un dato de fase para ofrecer la lectura estacional.',
        boletin: conocida ? null : {
            texto: 'Consultar el boletín de El Niño y La Niña del IDEAM',
            url: BOLETINES_IDEAM.find((b) => b.id === 'enso')?.url ?? null,
            nota: 'Abra la publicación más reciente y revise su fecha antes de decidir para su finca. Se abre en otra pestaña.',
        },
        detalleEn: DETALLE_TEMPORADA,
    };
}

/**
 * La lectura del día en una sola cadena, como la dice «Escuchar»: el titular
 * y las tres preguntas principales con su salvedad, y después el boletín
 * corto. En voz, la mínima de la noche se nombra por su tramo.
 */
function lecturaDelDia(veredicto, voz) {
    if (!veredicto) return '';
    return [veredicto.titular.texto,
        ...PREGUNTAS_PRINCIPALES.map((id) => {
            const fila = veredicto.filas.find((f) => f.id === id);
            return fila ? `${fila.pregunta} ${(voz && fila.respuestaVoz) || fila.respuesta}. ${fila.salvedad || ''}` : '';
        }),
    ].join(' ');
}

/**
 * Las respuestas del día para una finca.
 *
 * @param {object} entrada
 * @param {object} [entrada.openMeteo] respuesta cruda de Open-Meteo `/v1/forecast` (la que pide agroMeteoService)
 * @param {object} [entrada.agrometeo] el mismo pronóstico ya normalizado por agroMeteoService (gana sobre `openMeteo`)
 * @param {number} [entrada.ahoraMs] el reloj (epoch en ms)
 * @param {object} [entrada.finca] `{ lat, lng, elevation, vereda?, municipio? }`
 * @param {string} [entrada.pendiente] pendiente declarada de la finca ('' si no la dijo)
 * @param {string[]} [entrada.cultivos] claves de los cultivos del perfil (`papa`, `tomate`…)
 * @param {string|null} [entrada.enso] familia de la fase ENSO (`nino`, `nina`, `neutral`) o null si no se leyó
 * @param {string|null} [entrada.faseLabel] rótulo de la fase para el boletín; null lo omite
 * @param {object|null} [entrada.sesgoSitio] sesgo de la estación cercana (snapshot del servidor), si lo hay
 * @param {object|null} [entrada.estacion] observación de estación de anoche (snapshot), si la hay
 * @param {string|null} [entrada.timeZone] zona de respaldo si el pronóstico no trae la suya
 * @param {{observada?: boolean, pronosticada?: boolean}} [entrada.alertasHelada] alertas de helada del servidor
 * @param {string|null} [entrada.faseFuente] de dónde salió la fase (ver `vistazoTemporada`)
 * @param {string|number|Date|null} [entrada.faseCopiaDel] fecha de la copia guardada de la fase
 * @param {string|null} [entrada.region] región natural de la finca, para la lectura de la temporada
 * @param {boolean} [entrada.sinConexion] sin fase y sin red
 */
export function respuestasDelDia({
    openMeteo = null, agrometeo: normalizado = null, ahoraMs = Date.now(), finca = null, pendiente = '', cultivos = [],
    enso = null, faseLabel = null, sesgoSitio = null, estacion = null, timeZone = null,
    alertasHelada = { observada: false, pronosticada: false },
    faseFuente = null, faseCopiaDel = null, region = null, sinConexion = false,
} = {}) {
    const elevation = Number.isFinite(Number(finca?.elevation)) && finca?.elevation != null ? Number(finca.elevation) : undefined;
    const agrometeo = normalizado || (openMeteo
        ? normalizarAgroMeteo(openMeteo, { lat: Number(finca?.lat), lng: Number(finca?.lng), elevation, ahoraMs })
        : null);
    const piso = clasificarPisoTermico(finca?.elevation);
    const zona = agrometeo?.timezone || timeZone || 'America/Bogota';
    const frescura = frescuraDelDato(agrometeo, ahoraMs, zona);
    const granizo = avisoGranizo(agrometeo?.granizoRiesgo);
    const veredicto = veredictoDelDia({
        agrometeo, ahoraMs, granizo, enso, pisoTermico: piso?.id,
        elevation: finca?.elevation, frescura, timeZone: zona, pendiente, cultivos, sesgoSitio,
    });
    const fila = (id) => veredicto?.filas.find((f) => f.id === id) ?? null;
    const hongos = fila('hongos');
    const tramoNoche = tramoDeLaNoche(momentoDeLaFinca(agrometeo, ahoraMs), agrometeo?.heladaNoche);
    const observada = Boolean(alertasHelada?.observada);
    const banda = bandaHelada({
        observada, alertaMadrugada: !observada && Boolean(alertasHelada?.pronosticada),
        riesgo: agrometeo?.heladaRiesgo, tramo: tramoNoche,
    });
    const ligero = textoLigero({ location: finca, faseLabel, agrometeo, frescura, ahoraMs, timeZone: zona });
    const textoVoz = sinPuntoDoble(`${lecturaDelDia(veredicto, true)} ${ligero}`.trim());
    return {
        agrometeo,
        piso,
        zona,
        frescura,
        veredicto,
        titular: veredicto?.titular ?? null,
        // Las tres que se leen sin abrir, con sus frases.
        principales: PREGUNTAS_PRINCIPALES.map(fila).filter(Boolean).map((f) => frasesDeFila(f, { estacion })),
        riego: fila('riego') ? frasesDeFila(fila('riego')) : null,
        hongos: hongos ? lecturaSanitaria(hongos.sanitario, { cultivos, piso: piso?.id, deNoche: hongos.deNoche }) : null,
        granizo,
        // ¿Llueve ahora?, en tres estados y con su frase corta sin cifras:
        // con código de lluvia y sin cantidad, «sin-cifra», nunca «no-llueve».
        lluviaAhora: lluviaDeAhora(agrometeo, ahoraMs),
        tormenta: { porVenir: veredicto ? tormentaPorVenir(agrometeo, ahoraMs) : false, sinCantidad: tormentaSinCantidad(agrometeo, ahoraMs) },
        banda,
        // Lluvia, viento contra 15 km/h y noche de helada, hora por hora.
        franja24h: proximas24h(agrometeo, ahoraMs),
        textos: {
            boletin: sinPuntoDoble(`${lecturaDelDia(veredicto, false)} ${ligero}`.trim()),
            voz: paraVoz(textoVoz),
        },
        // Lo que viene: los próximos 16 días y la temporada (W47).
        dias16: vistazoDias({ agrometeo, ahoraMs, finca, sanitario: hongos?.sanitario ?? null }),
        temporada: vistazoTemporada({
            enso, faseLabel, faseFuente, faseCopiaDel, sinConexion, piso: piso?.id ?? null, region,
            tienePapa: Array.isArray(cultivos) && cultivos.includes('papa'),
        }),
    };
}
