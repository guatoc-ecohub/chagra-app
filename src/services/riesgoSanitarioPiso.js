/**
 * riesgoSanitarioPiso.js — riesgo de gota, mildeo velloso y moho gris por piso
 * térmico, CON MEMORIA de los días mojados y SIN depender de que haya cultivos
 * declarados. Función pura: sin red, sin estado, sin React.
 *
 * Por qué existe: «El tiempo» solo evaluaba enfermedad cuando había cultivos, y
 * mirando un único día. Una semana de 94–100 % de lluvia a 10–20 °C en el
 * altiplano no decía nada. Aquí la ventana es de 3 días pasados + hoy + 2
 * próximos, y un día seco en medio no borra lo acumulado. La lluvia diaria
 * refuerza humedad foliar cuando Open-Meteo la reporta; no sustituye un dato
 * ausente de humedad relativa.
 *
 * Entrada: el `daily` de agroMeteoService (cada día trae `horas_hr_alta`,
 * `rh_max`, `temp_min`, `temp_max`, agregados desde la serie horaria) y la
 * fecha de hoy de la finca.
 *
 * Reglas de honestidad (AC4):
 *   - Cada umbral lleva `fuente` y `estado`: 'verificado' (cotejado contra la
 *     fuente primaria o su ficha institucional) o 'a_verificar'.
 *   - Un umbral 'a_verificar' en juego baja la confianza. Ningún resultado
 *     sale con confianza 'alta': ninguno de estos modelos está validado en
 *     Colombia (se dice en `fuente`).
 *   - Falta de dato ≠ día seco: un día sin `horas_hr_alta` no suma ni resta,
 *     y baja la confianza.
 *   - La acción es preventiva y agroecológica. Los biopreparados salen del
 *     catálogo de la casa (catalog/biopreparados-seed.json), por id, y solo
 *     contra el objetivo que el propio catálogo nombra.
 */

const umbral = (valor, fuente, estado) => Object.freeze({ valor, fuente, estado });

/** Fuentes citables de cada umbral. */
export const FUENTES_SANITARIAS = Object.freeze({
    hutton: 'Criterio Hutton, James Hutton Institute para AHDB (Reino Unido, 2017): 2 días seguidos con mínima de 10 °C y al menos 6 h por día con HR ≥ 90 %. https://potatoes.ahdb.org.uk/development-and-implementation-of-a-new-national-warning-system-for-potato-late-blight-in-great-britain-hutton-criteria',
    gotaRangoChagra: 'Adaptación local del criterio Hutton hecha por Chagra, no parte del criterio: cuando la mínima baja de 10 °C se mira la media entre 10 y 22 °C (MODELOS_ENFERMEDAD.gota_papa de agroIndices). Sin fuente colombiana cotejada',
    bulger1987: 'Bulger, Ellis y Madden (1987), Phytopathology 77:1225-1230: Botrytis cinerea en flor de fresa, óptimo cercano a 20 °C y aumento fuerte de la infección con más de 16 h de mojado',
    hildebrand1982: 'Hildebrand y Sutton (1982), Phytopathology 72:219-224 (mildeo velloso de la cebolla, Peronospora destructor): esporula con HR > 95 % y noches entre 4 y 25 °C; infección óptima 10–18 °C (cifras tomadas de un resumen secundario)',
    memoria: 'Regla de diseño de Chagra: cada día sin condiciones favorables la presión acumulada se reduce a la mitad en vez de volver a cero (no es un parámetro publicado)',
});

/*
 * Umbrales. `estado:'verificado'` solo donde la cifra se cotejó contra la ficha
 * institucional o el resumen del artículo; lo demás es 'a_verificar'.
 */
export const UMBRALES_SANITARIOS = Object.freeze({
    gota: Object.freeze({
        horasHrAlta: umbral(6, 'hutton', 'verificado'),
        tempMinHutton: umbral(10, 'hutton', 'verificado'),
        // En el altiplano la mínima baja de 10 °C casi todas las noches y aun así
        // hay gota: usar solo Hutton daría verde falso en piso frío. Se usa la
        // media como respaldo, marcada a verificar.
        tempMediaMin: umbral(10, 'gotaRangoChagra', 'a_verificar'),
        tempMediaMax: umbral(22, 'gotaRangoChagra', 'a_verificar'),
    }),
    mildeo: Object.freeze({
        rhMaxEsporula: umbral(95, 'hildebrand1982', 'a_verificar'),
        tempMediaOptMin: umbral(10, 'hildebrand1982', 'a_verificar'),
        tempMediaOptMax: umbral(18, 'hildebrand1982', 'a_verificar'),
        tempMin: umbral(4, 'hildebrand1982', 'a_verificar'),
        tempMax: umbral(25, 'hildebrand1982', 'a_verificar'),
        // Horas húmedas mínimas para contar el día: no hay cifra cotejada.
        horasHrAlta: umbral(6, 'hildebrand1982', 'a_verificar'),
    }),
    botrytis: Object.freeze({
        horasMojadoFuerte: umbral(16, 'bulger1987', 'verificado'),
        // Mitad del umbral fuerte como día parcialmente favorable: diseño.
        horasMojadoParcial: umbral(8, 'bulger1987', 'a_verificar'),
        tempOptima: umbral(20, 'bulger1987', 'verificado'),
        tempMediaMin: umbral(10, 'bulger1987', 'a_verificar'),
        tempMediaMax: umbral(25, 'bulger1987', 'a_verificar'),
    }),
    memoria: Object.freeze({
        decaimientoDiaSeco: umbral(0.5, 'memoria', 'a_verificar'),
        pesoLluvia: umbral(0.5, 'memoria', 'a_verificar'),
        // 2 = dos días favorables seguidos, que es lo que pide Hutton.
        presionAlta: umbral(2, 'hutton', 'verificado'),
        presionMedia: umbral(1, 'memoria', 'a_verificar'),
    }),
});

/** Pisos donde cada enfermedad se evalúa. Fuera de ellos: 'sin_evaluar'. */
const PISOS_ENFERMEDAD = Object.freeze({
    gota: new Set(['templado', 'frio', 'paramo']),
    mildeo: new Set(['templado', 'frio', 'paramo']),
    botrytis: new Set(['calido', 'templado', 'frio', 'paramo']),
});

/*
 * Biopreparados del catálogo de la casa (ids de catalog/biopreparados-seed.json).
 * El caldo bordelés: el catálogo lo describe como foliar preventivo contra
 * hongos (Phytophthora, mildius). El Bacillus subtilis foliar: el catálogo lo
 * nombra contra Botrytis. Cero agroquímicos de síntesis.
 */
export const BIOPREPARADO_POR_ENFERMEDAD = Object.freeze({
    gota: 'caldo_bordeles',
    mildeo: 'caldo_bordeles',
    botrytis: 'bacillus_subtilis_foliar',
});

const NOMBRE = Object.freeze({
    gota: 'Gota (tizón tardío)',
    mildeo: 'Mildeo velloso',
    botrytis: 'Moho gris (Botrytis)',
});

const ACCION = Object.freeze({
    gota: {
        alto: 'Si tiene papa o tomate, recorra hoy el lote buscando manchas aceitosas en las hojas bajas, aporque alto para proteger el tubérculo, saque del lote las matas con foco y no riegue por encima. Si decide proteger, el caldo bordelés del catálogo es preventivo: aplíquelo con el follaje seco y solo si el pronóstico deja tiempo para que se seque por completo antes de llover, con equipo de protección, y siga la etiqueta del producto, que dice si se puede usar en floración y cuántos días antes de cosechar hay que dejarlo.',
        medio: 'Revise el envés de las hojas bajas cada mañana, aporque y no riegue por encima mientras siga la humedad.',
        bajo: 'Siga el recorrido de rutina por el lote; la humedad no ha sostenido condiciones de gota.',
    },
    mildeo: {
        alto: 'Al amanecer revise el envés de las hojas (cebolla, arveja, quinua) buscando pelusa gris o violeta, entresaque para que corra el aire, retire las hojas con foco y no riegue por encima. Como preventivo, el caldo bordelés del catálogo, con equipo de protección y siguiendo la etiqueta del producto, que dice si se puede usar en floración.',
        medio: 'Revise el envés de las hojas al amanecer y abra la ventilación del cultivo.',
        bajo: 'Siga el recorrido de rutina; no hay noches húmedas sostenidas.',
    },
    botrytis: {
        alto: 'Retire flores y frutos con moho gris y sáquelos del lote, ventile el invernadero o la cama, y no moje flores al regar. Como preventivo, el Bacillus subtilis foliar del catálogo, que se usa contra Botrytis, según la etiqueta del producto.',
        medio: 'Revise flores y frutos maduros, retire los tocados y ventile.',
        bajo: 'Siga el recorrido de rutina por flores y frutos.',
    },
});

const numero = (v) => (v === null || v === undefined || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

function tempMediaDe(dia) {
    const min = numero(dia?.temp_min);
    const max = numero(dia?.temp_max);
    return min != null && max != null ? (min + max) / 2 : null;
}

const enRango = (v, a, b) => v != null && v >= a && v <= b;

/*
 * Peso de un día para cada enfermedad: 1 favorable, 0.5 parcial, 0 seco,
 * null sin dato. `adaptado` marca que se usó un umbral a verificar.
 */
function pesoGota(dia) {
    const u = UMBRALES_SANITARIOS.gota;
    const horas = numero(dia?.horas_hr_alta);
    const min = numero(dia?.temp_min);
    const media = tempMediaDe(dia);
    if (media == null) return { peso: null };
    if (horas == null) {
        return numero(dia?.precip_mm) > 0 && enRango(media, u.tempMediaMin.valor, u.tempMediaMax.valor)
            ? { peso: UMBRALES_SANITARIOS.memoria.pesoLluvia.valor, adaptado: true }
            : { peso: null };
    }
    if (horas < u.horasHrAlta.valor) {
        return { peso: numero(dia?.precip_mm) > 0 ? UMBRALES_SANITARIOS.memoria.pesoLluvia.valor : 0, adaptado: numero(dia?.precip_mm) > 0 };
    }
    if (min != null && min >= u.tempMinHutton.valor) return { peso: 1, adaptado: false };
    if (enRango(media, u.tempMediaMin.valor, u.tempMediaMax.valor)) return { peso: 1, adaptado: true };
    return { peso: 0 };
}

function pesoMildeo(dia) {
    const u = UMBRALES_SANITARIOS.mildeo;
    const horas = numero(dia?.horas_hr_alta);
    const rhMax = numero(dia?.rh_max);
    const media = tempMediaDe(dia);
    if (horas == null || media == null) return { peso: null };
    if (horas < u.horasHrAlta.valor || (rhMax != null && rhMax <= u.rhMaxEsporula.valor)) {
        return { peso: 0, adaptado: false };
    }
    if (enRango(media, u.tempMediaOptMin.valor, u.tempMediaOptMax.valor)) return { peso: 1, adaptado: true };
    if (enRango(media, u.tempMin.valor, u.tempMax.valor)) return { peso: 0.5, adaptado: true };
    return { peso: 0 };
}

function pesoBotrytis(dia) {
    const u = UMBRALES_SANITARIOS.botrytis;
    const horas = numero(dia?.horas_hr_alta);
    const media = tempMediaDe(dia);
    if (media == null) return { peso: null };
    if (!enRango(media, u.tempMediaMin.valor, u.tempMediaMax.valor)) return { peso: 0 };
    if (horas == null) return numero(dia?.precip_mm) > 0
        ? { peso: UMBRALES_SANITARIOS.memoria.pesoLluvia.valor, adaptado: true }
        : { peso: null };
    if (horas >= u.horasMojadoFuerte.valor) return { peso: 1, adaptado: true };
    if (horas >= u.horasMojadoParcial.valor) return { peso: 0.5, adaptado: true };
    if (numero(dia?.precip_mm) > 0) return { peso: UMBRALES_SANITARIOS.memoria.pesoLluvia.valor, adaptado: true };
    return { peso: 0 };
}

const PESO = Object.freeze({ gota: pesoGota, mildeo: pesoMildeo, botrytis: pesoBotrytis });

/**
 * Ventana de 3 días pasados + hoy + 2 próximos, por fecha. Devuelve también
 * cuántos días pasados trajo realmente la serie.
 */
export function ventanaSanitaria(daily, hoy) {
    const dias = (Array.isArray(daily) ? daily : [])
        .filter((d) => typeof d?.date === 'string')
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date));
    if (!hoy) return { pasados: [], proximos: [] };
    const pasados = dias.filter((d) => d.date < hoy).slice(-3);
    const proximos = dias.filter((d) => d.date >= hoy).slice(0, 3);
    return { pasados, proximos };
}

function nivelDe(presion) {
    const m = UMBRALES_SANITARIOS.memoria;
    if (presion >= m.presionAlta.valor) return 'alto';
    if (presion >= m.presionMedia.valor) return 'medio';
    return 'bajo';
}

const ORDEN_NIVEL = Object.freeze({ sin_evaluar: -1, bajo: 0, medio: 1, alto: 2 });

function fuentesDe(enfermedad) {
    const claves = new Set(Object.values(UMBRALES_SANITARIOS[enfermedad]).map((x) => x.fuente));
    claves.add('memoria');
    // Que ninguna cifra se ha comprobado en campo colombiano lo dice el origen
    // del aviso (ORIGEN_AVISO_SANITARIO), una sola vez por pantalla (W44, R6 de la v19).
    return [...claves].map((k) => FUENTES_SANITARIAS[k]).join(' · ');
}

/**
 * De dónde sale el nivel de los avisos de hongos: un aviso de la app, no una
 * cifra biológica (W43). Se dice UNA vez junto a la lista de enfermedades, no
 * en cada una ni en cada cultivo (W44, R6 de la v19).
 */
export const ORIGEN_AVISO_SANITARIO = 'Chagra avisa cuando se juntan días con estas condiciones; es un aviso de la app, y ninguna de sus cifras se ha comprobado todavía en campo colombiano.';

/**
 * Resultado «sin evaluar»: misma forma que evaluarEnfermedad, con nivel
 * 'sin_evaluar' y sin biopreparado.
 * @param {string} enfermedad
 * @param {string} porque
 * @returns {{enfermedad:string,nombre:string,nivel:'alto'|'medio'|'bajo'|'sin_evaluar',porque:string,accion:string,confianza:'media'|'baja',fuente:string,biopreparado:string|null,trayectoria:object[]}}
 */
function sinEvaluar(enfermedad, porque) {
    return {
        enfermedad,
        nombre: NOMBRE[enfermedad],
        nivel: 'sin_evaluar',
        porque,
        accion: 'Recorra el lote como de costumbre: sin modelo o sin datos no se puede decir que esté sano.',
        confianza: 'baja',
        fuente: FUENTES_SANITARIAS.memoria,
        biopreparado: null,
        trayectoria: [],
    };
}

function frasePorque(enfermedad, favPasados, nPasados, favProximos, nProximos, adaptado) {
    const condicion = {
        gota: 'con humedad alta o lluvia y temperatura fresca',
        mildeo: 'con noches muy húmedas y temperatura fresca',
        botrytis: 'con hoja mojada o lluvia y temperatura templada',
    }[enfermedad];
    const partes = [];
    partes.push(nPasados > 0
        ? `${favPasados} de los últimos ${nPasados} ${nPasados === 1 ? 'día' : 'días'} ${condicion}`
        : 'Sin datos de días anteriores');
    if (nProximos > 0) partes.push(`${favProximos} de ${nProximos} días desde hoy vienen con condiciones parecidas`);
    let texto = `${partes.join('; ')}.`;
    // De dónde sale el nivel lo dice ORIGEN_AVISO_SANITARIO, una vez (W44); aquí
    // solo lo propio de esta enfermedad.
    if (enfermedad === 'gota' && adaptado) {
        texto += ' La mínima bajó de 10 °C, así que la regla inglesa de la gota no aplica tal cual: se usó la temperatura media, un ajuste propio de Chagra que falta comprobar en campo.';
    }
    return texto;
}

/**
 * Evalúa una enfermedad con memoria sobre la ventana.
 * `trayectoria` deja trazable el cálculo: presión y nivel al cerrar cada día.
 * @returns {{enfermedad:string,nombre:string,nivel:'alto'|'medio'|'bajo'|'sin_evaluar',porque:string,accion:string,confianza:'media'|'baja',fuente:string,biopreparado:string|null,trayectoria:object[]}}
 */
function evaluarEnfermedad(enfermedad, piso, pasados, proximos) {
    if (!PISOS_ENFERMEDAD[enfermedad].has(piso)) {
        return sinEvaluar(enfermedad, `En piso ${piso || 'desconocido'} este modelo no está calibrado.`);
    }
    const decae = UMBRALES_SANITARIOS.memoria.decaimientoDiaSeco.valor;
    let presion = 0;
    let adaptado = false;
    let faltantes = 0;
    let favPasados = 0;
    let conDatosPasados = 0;
    let favProximos = 0;
    let conDatos = 0;
    let usoMemoria = false;
    // El nivel mira la presión al cerrar las 48 h pasadas y cada día desde hoy:
    // una infección de anteayer sigue contando aunque hoy amanezca seco.
    let presionDecision = -Infinity;
    const serie = [...pasados.map((d) => ({ d, pasado: true })), ...proximos.map((d) => ({ d, pasado: false }))];
    let presionAlCerrarPasado = 0;
    const trayectoria = [];
    for (const { d, pasado } of serie) {
        if (!pasado && presionDecision === -Infinity) presionAlCerrarPasado = presion;
        const r = PESO[enfermedad](d);
        if (r.peso == null) {
            faltantes += 1;
        } else {
            conDatos += 1;
            if (pasado) conDatosPasados += 1;
            if (r.adaptado) adaptado = true;
            if (r.peso === 0 && presion > 0) usoMemoria = true;
            presion = r.peso > 0 ? presion + r.peso : presion * decae;
            if (r.peso > 0) {
                if (pasado) favPasados += 1; else favProximos += 1;
            }
        }
        if (!pasado) presionDecision = Math.max(presionDecision, presion);
        trayectoria.push({ date: d.date, presion: Math.round(presion * 100) / 100, nivel: r.peso == null && conDatos === 0 ? 'sin_evaluar' : nivelDe(presion) });
    }
    if (proximos.length === 0) presionAlCerrarPasado = presion;
    if (conDatos === 0) {
        return sinEvaluar(enfermedad, 'No llegaron datos de humedad y temperatura para esta ventana.');
    }
    const nivel = nivelDe(Math.max(presionDecision, presionAlCerrarPasado));
    // Nada sale con confianza alta: ninguno de estos modelos está validado en CO.
    /** @type {'media'|'baja'} */
    let confianza = enfermedad === 'gota' && !adaptado ? 'media' : 'baja';
    if (faltantes > 0 || pasados.length < 3 || usoMemoria) confianza = 'baja';
    let porque = frasePorque(enfermedad, favPasados, conDatosPasados, favProximos, proximos.length, adaptado);
    if (conDatosPasados < 3) porque += ` Solo hay datos de ${conDatosPasados} de 3 días anteriores: la memoria está incompleta.`;
    if (faltantes > 0) porque += ` ${faltantes} día(s) sin dato no se contaron como secos.`;
    return {
        enfermedad,
        nombre: NOMBRE[enfermedad],
        nivel,
        porque,
        accion: ACCION[enfermedad][nivel],
        confianza,
        fuente: fuentesDe(enfermedad),
        biopreparado: nivel === 'alto' ? BIOPREPARADO_POR_ENFERMEDAD[enfermedad] : null,
        trayectoria,
    };
}

/**
 * Riesgo sanitario por piso térmico. No necesita cultivos declarados.
 *
 * @param {{piso?:string, daily?:object[], hoy?:string}} [entrada]
 *   piso: 'calido' | 'templado' | 'frio' | 'paramo'
 *   daily: `agrometeo.daily` (con ayer por past_days)
 *   hoy: fecha ISO de la finca (`agrometeo.today.date`)
 *   Todos opcionales: sin entrada se evalúa «sin_evaluar» en vez de lanzar.
 * @returns {{gota:object, mildeo:object, botrytis:object, peor:object|null, diasAnterioresDisponibles:number}}
 */
export function evaluarRiesgoSanitarioPiso({ piso, daily, hoy } = {}) {
    const pisoId = String(piso ?? '').toLowerCase().trim();
    const { pasados, proximos } = ventanaSanitaria(daily, hoy);
    /** @type {{gota:object|null, mildeo:object|null, botrytis:object|null}} */
    const resultado = { gota: null, mildeo: null, botrytis: null };
    for (const enfermedad of ['gota', 'mildeo', 'botrytis']) {
        resultado[enfermedad] = evaluarEnfermedad(enfermedad, pisoId, pasados, proximos);
    }
    const peor = Object.values(resultado)
        .filter((r) => r.nivel !== 'sin_evaluar')
        .sort((a, b) => ORDEN_NIVEL[b.nivel] - ORDEN_NIVEL[a.nivel])[0] ?? null;
    const diasAnterioresDisponibles = pasados.filter((d) =>
        numero(d.horas_hr_alta) != null || numero(d.rh_max) != null || numero(d.precip_mm) != null,
    ).length;
    return { ...resultado, peor, diasAnterioresDisponibles };
}

/** Atajo desde el payload de agroMeteoService. */
export function riesgoSanitarioDesdeAgrometeo(agrometeo, piso) {
    return evaluarRiesgoSanitarioPiso({ piso, daily: agrometeo?.daily, hoy: agrometeo?.today?.date });
}

/*
 * Textos del aviso corto de «El tiempo». Un cultivo solo se nombra si está en
 * el perfil; sin cultivos se habla del riesgo en el piso («en tierra fría, la
 * gota ataca la papa y el tomate: si los tiene, …»). Solo redacción: el nivel
 * sale de evaluarRiesgoSanitarioPiso sin tocarlo.
 */
const HOSPEDEROS = Object.freeze({
    gota: { nombre: 'la gota', claves: ['papa', 'tomate'], lista: 'la papa y el tomate', buscar: 'manchas aceitosas en las hojas bajas' },
    mildeo: { nombre: 'el mildeo', claves: ['cebolla', 'arveja', 'quinua'], lista: 'la cebolla, la arveja y la quinua', buscar: 'pelusa gris o violeta en el envés de las hojas' },
    botrytis: { nombre: 'el moho gris', claves: ['fresa', 'mora'], lista: 'la fresa y la mora', buscar: 'moho gris en flores y frutos' },
});

const EN_EL_PISO = Object.freeze({
    paramo: 'En el páramo',
    frio: 'En tierra fría',
    templado: 'En clima templado',
    calido: 'En tierra caliente',
});

const NOMBRE_CORTO = Object.freeze({ gota: 'gota', mildeo: 'mildeo', botrytis: 'moho gris' });

const claveCultivo = (c) => String((c && typeof c === 'object' ? (c.key || c.nombre) : c) || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/** El titular del aviso, en el tono de las respuestas del veredicto. */
export function tituloAvisoSanitario(riesgo) {
    const peor = riesgo?.peor;
    if (!peor) return 'Sin datos para evaluar';
    if (peor.nivel === 'bajo') return 'Riesgo bajo por ahora';
    return `Riesgo ${peor.nivel} de ${NOMBRE_CORTO[peor.enfermedad] || peor.nombre.toLowerCase()}`;
}

/** Título compartido: una enfermedad solo se nombra con cultivos hospederos. */
export function tituloSanitarioDeCultivos(riesgo, cultivos = null) {
    const relevantes = riesgosSanitariosDeCultivos(riesgo, cultivos);
    if (!Array.isArray(cultivos) || cultivos.length === 0) {
        const nivel = riesgo?.peor?.nivel;
        return ['alto', 'medio', 'bajo'].includes(nivel)
            ? `Riesgo ${nivel} de hongos` : 'Sin datos para evaluar hongos';
    }
    const altos = relevantes.filter((r) => r.nivel === 'alto');
    if (altos.length > 0) return `Riesgo alto de ${altos.map((r) => r.nombre.toLowerCase()).join(', ')}`;
    return relevantes[0] ? tituloAvisoSanitario({ peor: relevantes[0] }) : 'Sin modelo para los cultivos del perfil';
}

/** Acción sin atribuir cultivos que la finca no ha registrado.
 *
 * @param {object} riesgo salida de evaluarRiesgoSanitarioPiso
 * @param {{cultivos?: Array<string|{key?:string,nombre?:string}>|null, piso?: string|null}} [opciones]
 *   `cultivos` = los del perfil (null si no se sabe); `piso` = piso térmico evaluado.
 */
export function accionSanitariaDeCultivos(riesgo, { cultivos = null, piso } = {}) {
    return !Array.isArray(cultivos) || cultivos.length === 0
        ? 'Recorra el lote y observe hojas, flores y frutos. El riesgo es general porque aún no sabemos qué cultiva.'
        : fraseAvisoSanitario(riesgo, { cultivos, piso });
}

/** Riesgos de las enfermedades que corresponden a los cultivos declarados. */
export function riesgosSanitariosDeCultivos(riesgo, cultivos = null) {
    if (!Array.isArray(cultivos) || cultivos.length === 0) return riesgo?.peor ? [riesgo.peor] : [];
    const hospedero = new Set(cultivos.map(claveCultivo));
    return Object.entries(HOSPEDEROS)
        .filter(([, h]) => h.claves.some((k) => hospedero.has(k)))
        .map(([key]) => riesgo?.[key])
        .filter(Boolean)
        .sort((a, b) => (ORDEN_NIVEL[b.nivel] ?? -1) - (ORDEN_NIVEL[a.nivel] ?? -1))
        .slice(0, 3);
}

/**
 * La frase única del aviso con su acción de hoy.
 * @param {object} riesgo salida de evaluarRiesgoSanitarioPiso
 * @param {{cultivos?: Array<string|{key?:string,nombre?:string}>|null, piso?: string|null}} [opciones]
 *   `cultivos` = los del perfil (null si no se sabe: entonces no se nombra ninguno como suyo).
 */
export function fraseAvisoSanitario(riesgo, { cultivos = null, piso = null } = {}) {
    const relevantes = riesgosSanitariosDeCultivos(riesgo, cultivos);
    const perfilDeclarado = Array.isArray(cultivos) && cultivos.length > 0;
    const altos = perfilDeclarado ? relevantes.filter((r) => r.nivel === 'alto') : [];
    const peor = perfilDeclarado ? (relevantes[0] || null) : (relevantes[0] || riesgo?.peor);
    if (!peor && perfilDeclarado) return 'No hay un modelo sanitario disponible para los cultivos declarados; recórralos como de costumbre.';
    if (!peor) return 'Sin datos de humedad y temperatura para evaluar gota, mildeo ni moho gris: recorra el lote como de costumbre.';
    if (perfilDeclarado && altos.length > 1) {
        const listados = altos.map((r) => {
            const h = HOSPEDEROS[r.enfermedad];
            const suyos = h.claves.filter((k) => cultivos.some((c) => claveCultivo(c) === k));
            const cultivo = suyos.map((k) => `su ${k}`).join(' y ');
            return `${h.nombre} en ${cultivo}`;
        });
        const proteccion = riesgo?.accionProteccion ? ` ${riesgo.accionProteccion}` : '';
        return `Riesgo alto: ${listados.join(', ')}. Recorra hoy y revise las hojas, flores y frutos.${proteccion}`;
    }
    if (peor.nivel === 'alto' && riesgo?.accionProteccion) {
        const h = HOSPEDEROS[peor.enfermedad];
        const suyos = perfilDeclarado && h
            ? h.claves.filter((k) => cultivos.some((c) => claveCultivo(c) === k))
            : [];
        const cultivo = suyos.length ? `Riesgo alto en su ${suyos.join(' y su ')}. ` : '';
        return `${cultivo}${riesgo.accionProteccion}`;
    }
    if (peor.nivel === 'bajo') return 'La humedad no ha sostenido gota, mildeo ni moho gris: siga el recorrido de rutina por el lote.';
    const h = HOSPEDEROS[peor.enfermedad];
    if (!h) return `${peor.nombre}, riesgo ${peor.nivel}: recorra el lote hoy.`;
    const cuando = peor.nivel === 'alto' ? 'hoy' : 'cada mañana';
    const suyos = Array.isArray(cultivos)
        ? h.claves.filter((k) => cultivos.some((c) => claveCultivo(c) === k))
        : [];
    if (suyos.length > 0) {
        return `Recorra ${cuando} su ${suyos.join(' y su ')} buscando ${h.buscar}.`;
    }
    const lugar = EN_EL_PISO[String(piso || '').toLowerCase()] || 'En su zona';
    return `${lugar}, ${h.nombre} ataca ${h.lista}: si los tiene, revíselos ${cuando} buscando ${h.buscar}.`;
}
