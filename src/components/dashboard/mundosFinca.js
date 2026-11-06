/*
 * i18n (ADR-050): igual que DashboardLive.jsx, este manifiesto contiene el copy
 * de navegación del home en español Colombia, pendiente de migrar a
 * src/config/messages.js. La regla chagra-i18n es soft (warn); se desactiva a
 * nivel de archivo para no bloquear el pre-commit con deuda preexistente.
 */
/* eslint-disable chagra-i18n/no-hardcoded-spanish */
import { pisoDeFinca } from '../../visual/mundo3d/pisosTermicos.js';
import { pisoTermicoDePerfil } from '../../visual/mundo3d/useFincaViva.js';

/**
 * mundosFinca — LOS MUNDOS DE MI FINCA (reestructuración 2.0 del home, V4).
 *
 * ANTES: el home F2 era ~15 tiles planas + 5 tarjetas de inventario + mercado +
 * seguimiento — una caja de herramientas regada. AHORA: las mismas funciones,
 * agrupadas en 9 MUNDOS coherentes y aprendibles, cada uno un LUGAR de la finca
 * con su ilustración, su color de tierra y sus funciones adentro.
 *
 * FUENTE ÚNICA: la grilla del home (MundosDeMiFinca), la pantalla de mundo
 * (MundoScreen) y el test de alcanzabilidad leen de aquí. NO duplicar rutas.
 *
 * REGLA DE ORO (reachability): TODO lo que era alcanzable desde el home F2
 * sigue siéndolo — cada tile vieja vive ahora DENTRO de su mundo. El test
 * MundosDeMiFinca.reachability.test.jsx congela ese contrato.
 *
 * Esquema de cada mundo:
 *   id       — clave estable (ruta 'mundo' + data { mundo: id }).
 *   titulo   — nombre campesino del mundo (Baloo 2 en la tarjeta).
 *   emoji    — glifo del mundo (acompaña a la viñeta SVG, no la reemplaza).
 *   lema     — una línea: qué se hace en este mundo (voz activa, concreta).
 *   tinte    — [acento fuerte, acento suave] (hex) — la paleta de tierra propia.
 *   featured — true = tarjeta grande (ancho completo) en la grilla.
 *   directo  — {view, data}: el mundo ES una sola pantalla → la tarjeta navega
 *              directo (sin pantalla intermedia de mundo).
 *   portada  — view de una PORTADA de mundo a medida (hub ilustrado) que
 *              reemplaza a la MundoScreen genérica: la tarjeta y el índice
 *              navegan ahí. Convive con `entradas` (que siguen congelando la
 *              reachability y sirven de fallback genérico si hiciera falta).
 *   entradas — funciones del mundo: {view, label, desc, emoji, data?}.
 *              `view` SIEMPRE es un case real de App.jsx.
 *   pisos    — pisos de finca donde aplica. `transversal` aplica a los cuatro.
 */

export const MUNDOS_FINCA = [
    {
        id: 'cultivos',
        pisos: ['transversal'],
        titulo: 'Cultivos y semillas',
        emoji: '🌾',
        lema: 'Qué sembrar, cuándo, y cómo van sus plantas',
        tinte: ['#3f8f4e', '#dcedc9'],
        featured: true,
        // Portada a medida (hub del mundo cultivos): orienta por región/clima,
        // agrupa las funciones existentes y suma la calculadora de grados-día.
        portada: 'mundo_cultivos',
        entradas: [
            { view: 'milpa_cultivo', label: 'La milpa', desc: 'Maíz, fríjol y calabaza sembrados juntos (las tres hermanas)', emoji: '🌽', pisos: ['calido', 'templado'] },
            { view: 'directorio', label: 'Qué puedo sembrar', desc: 'Especies para su clima, con qué se llevan y sus plagas', emoji: '🌱', pisos: ['transversal'] },
            { view: 'platano', label: 'Plátano y banano', desc: 'El pancoger de la casa: variedades, siembra, la planta madre-hijo-nieto, sigatoka y picudo, y aprovechar el pseudotallo', emoji: '🍌', pisos: ['calido', 'templado'] },
            { view: 'cacao', label: 'El cacao', desc: 'Cultivo bandera de la paz: clones, sombra, monilia y escoba, y el beneficio que hace el precio', emoji: '🍫', pisos: ['calido', 'templado'] },
            { view: 'frutales', label: 'Frutales de tierra caliente y media', desc: 'Mango, cítricos, aguacate, guayaba y papaya: cómo se propagan e injertan, siembra y distancias, piso térmico, plagas sin veneno, poda y cosecha', emoji: '🍊', pisos: ['calido', 'templado'] },
            { id: 'frutales_montana', view: 'frutales', label: 'Frutales de montaña', desc: 'Mora, lulo, tomate de árbol y curuba: cómo se propagan, siembra y distancias, piso térmico, plagas sin veneno, poda y cosecha', emoji: '🫐', pisos: ['frio', 'paramo'] },
            { view: 'uchuva', label: 'La uchuva', desc: 'La fruta andina de exportación, de tierra fría de altura: por qué pide frío, semilla y siembra, tutorado y poda, plagas sin veneno (pulgón, polilla, minador, Fusarium), el punto de cosecha por el color del capacho y la poscosecha de exportación', emoji: '🏮', pisos: ['frio', 'paramo'] },
            { view: 'hortalizas', label: 'Hortalizas de la huerta', desc: 'La comida diaria de la casa: siembra, agua, vecinas, plagas y cosecha de tomate, cebolla, zanahoria y más', emoji: '🥕', pisos: ['transversal'] },
            { view: 'tuberculos', label: 'Tubérculos y raíces', desc: 'El pancoger de raíz: papa y criolla, yuca, arracacha, ñame, batata, oca, cubio y ulluco, siembra, aporque, plagas y curado', emoji: '🥔', pisos: ['frio', 'paramo'] },
            { view: 'quinua', label: 'Quinua y granos andinos', desc: 'Granos ancestrales del frío alto-andino: quinua, amaranto, cañihua, chía y tarwi; siembra, el desaponificado (lavar el amargo), mildiú sin veneno, cosecha y su valor nutricional (proteína completa, sin gluten)', emoji: '🌾', pisos: ['frio', 'paramo'] },
            { view: 'fique', label: 'El fique y las fibras', desc: 'El cultivo de ladera que cuida el suelo: la cabuya, cómo se cría, el desfibrado de la penca, empaques y artesanía, y aprovechar el bagazo y el jugo sin contaminar el agua', emoji: '🪢', pisos: ['calido', 'templado'] },
            { view: 'calendario_finca', label: 'Calendario de la finca', desc: 'Cuándo sembrar, abonar y cosechar, todo junto', emoji: '🗓️', pisos: ['transversal'] },
            { view: 'almanaque', label: 'Almanaque campesino', desc: 'El año a lo grande: aguas y secas, qué da su piso térmico y el saber lunar', emoji: '🌙', pisos: ['transversal'] },
            { view: 'ano_finca', label: 'El año de la finca', desc: 'La línea de tiempo de SU año: qué sembró, cosechó y trabajó, y lo que viene en camino', emoji: '🛤️', pisos: ['transversal'] },
            { view: 'activos', label: 'Mis plantas', desc: 'Las plantas que tiene sembradas y cómo van', emoji: '🪴', pisos: ['transversal'] },
            { view: 'mapa', label: 'Zonas de la finca', desc: 'Sus lotes, eras y potreros en el mapa', emoji: '🗺️', pisos: ['transversal'] },
            { view: 'semilla', label: 'Semilla propia', desc: 'Seleccione, guarde y pruebe su semilla criolla', emoji: '🌾', pisos: ['transversal'] },
            { view: 'germinacion', label: 'Semilleros', desc: 'Pruebe sus semillas y vea cuáles nacen', emoji: '🫘', pisos: ['transversal'] },
            { view: 'aromaticas', label: 'Huerta de aromáticas', desc: 'Cilantro, cebolla larga, orégano y más: para qué sirven en la cocina y cómo sembrarlas', emoji: '🌿', pisos: ['transversal'] },
            { view: 'sembrar', label: 'Registrar una siembra', desc: 'Anote lo que sembró y arranca su ciclo', emoji: '🌽', pisos: ['transversal'] },
            { view: 'cosechar', label: 'Cosechar', desc: 'Anote lo que recogió', emoji: '🧺', pisos: ['transversal'] },
            { view: 'mi_cosecha', label: 'Mi cosecha', desc: 'Cuánto ha producido su finca: por cultivo, mes a mes y por lote', emoji: '📊', pisos: ['transversal'] },
            { view: 'ciclo', label: 'Seguimiento por etapas', desc: 'La vida de la planta etapa por etapa', emoji: '🔄', pisos: ['transversal'] },
        ],
    },
    {
        id: 'cafe',
        pisos: ['templado'],
        titulo: 'El café',
        emoji: '☕',
        lema: 'El cultivo bandera: variedad y roya, sombra, broca, cosecha y beneficio',
        tinte: ['#7a4a24', '#efe0cf'],
        // Mundo de una sola pantalla (photo-forward, 5 estaciones del ciclo
        // cafetero). La tarjeta navega directo, sin pantalla intermedia.
        directo: { view: 'cafe' },
    },
    {
        id: 'aguacate',
        pisos: ['templado'],
        titulo: 'El aguacate',
        emoji: '🥑',
        lema: 'El cultivo bandera de alto valor: piso térmico e injerto, drenaje contra la pudrición, flor tipo A/B y cosecha',
        tinte: ['#5b7f2a', '#e4efd0'],
        // Mundo de una sola pantalla (photo-forward, 5 estaciones: variedad y
        // siembra / suelo y agua / plagas / flor y polinización A/B / cosecha).
        // Profundización dedicada del Hass y los criollos de montaña; el
        // aguacate conserva su ficha rápida dentro del mundo Frutales (no la
        // duplica). La tarjeta navega directo, sin pantalla intermedia.
        directo: { view: 'aguacate' },
    },
    {
        id: 'cana',
        pisos: ['calido', 'templado'],
        titulo: 'La caña y la panela',
        emoji: '🥮',
        lema: 'De la caña al bloque: variedad, siembra, barrenador, corte y la panela en el trapiche',
        tinte: ['#8a5a1f', '#f3e3c2'],
        // Mundo de una sola pantalla (photo-forward, 5 estaciones: la caña /
        // siembra y manejo / plagas / corte / la panela). Cultura panelera
        // colombiana. La tarjeta navega directo, sin pantalla intermedia.
        directo: { view: 'cana' },
    },
    {
        id: 'mango',
        pisos: ['calido'],
        titulo: 'El mango',
        emoji: '🥭',
        lema: 'El rey de la tierra cálida: variedad e injerto, piso térmico, floración, antracnosis y mosca, cosecha y despensa',
        tinte: ['#c9791f', '#f7e6c9'],
        // Mundo de una sola pantalla (photo-forward, 5 estaciones del ciclo del
        // mango). Profundización dedicada (como el café o la caña), más allá de
        // la ficha corta que vive en "Frutales de la finca". La tarjeta navega
        // directo, sin pantalla intermedia.
        directo: { view: 'mango' },
    },
    {
        id: 'citricos',
        pisos: ['calido', 'templado'],
        titulo: 'Los cítricos',
        emoji: '🍊',
        // Sin siglas de ingeniero en el home (#1): HLB se nombra como lo conoce
        // el campo — "el dragón amarillo" (la pantalla del mundo ya lo explica).
        lema: 'Naranja, mandarina, limón y lima: variedad e injerto, piso térmico, plagas como el dragón amarillo, y cosecha',
        tinte: ['#c9791f', '#f7e6c8'],
        // Mundo de una sola pantalla (photo-forward, 5 estaciones del ciclo
        // cítrico). Profundización dedicada del frutal cítrico que refuerza el
        // grounding térmico (cálido-templado, NO frío alto). La tarjeta navega
        // directo, sin pantalla intermedia.
        directo: { view: 'citricos' },
    },
    {
        id: 'botica',
        pisos: ['transversal'],
        titulo: 'La botica campesina',
        emoji: '🌿',
        lema: 'Las plantas que curan de la casa: para qué se usan (uso tradicional) y cómo se cultivan',
        tinte: ['#3f7d4e', '#dcecd0'],
        // Mundo de una sola pantalla (photo-forward, 5 estaciones: barriga y
        // nervios / piel y heridas / gripa y tónico / cultivar la botica / con
        // cuidado). La huerta MEDICINAL de la finca andina (caléndula, manzanilla,
        // toronjil, cidrón, saúco, ortiga, llantén, y la ruda como planta de
        // respeto). Complementa —no duplica— la huerta de aromáticas de la cocina.
        // Dominio de salud: todo enmarcado como USO TRADICIONAL (saber popular),
        // nunca medicina/cura; cultivo groundeado en el catálogo Chagra. La
        // tarjeta navega directo, sin pantalla intermedia.
        directo: { view: 'botica' },
    },
    {
        id: 'suelo',
        pisos: ['transversal'],
        titulo: 'El suelo vivo',
        emoji: '🌱',
        lema: 'Conozca su tierra, corríjala y aliméntela',
        tinte: ['#8a5a38', '#f0e2c8'],
        entradas: [
            { view: 'salud_suelo', label: 'Cuaderno del suelo', desc: 'Lea su análisis, corrija la acidez y mejore la tierra', emoji: '📓' },
            { view: 'suelo', label: 'Cómo está mi tierra', desc: 'Diagnóstico sin laboratorio: color, olor y tacto', emoji: '🤲' },
            { view: 'cromatografia', label: 'Cromatografía', desc: 'El retrato del suelo en un papel de filtro', emoji: '🎯' },
            { view: 'ciclo_nutrientes', label: 'Ciclo de nutrientes', desc: 'Del animal al suelo y de vuelta a la planta', emoji: '♻️' },
        ],
    },
    {
        id: 'agua',
        pisos: ['transversal'],
        titulo: 'El agua',
        emoji: '💧',
        lema: 'Coseche la lluvia, riegue con medida y cuide su nacimiento',
        tinte: ['#2f7fa3', '#d7ecf3'],
        directo: { view: 'agua' },
    },
    {
        id: 'abono',
        pisos: ['transversal'],
        titulo: 'Estiércol y compost',
        emoji: '🐄',
        lema: 'Quítele el olor al estiércol, sáquele gas y hágalo tierra negra',
        tinte: ['#6d7a2e', '#e9ecc9'],
        // El mundo ganó su segunda sala (compost paso a paso, photo-forward):
        // pasó de `directo` a hub con entradas, igual que el clima cuando ganó
        // su mini-app. La sala vieja ('estiercol') sigue alcanzable como antes.
        entradas: [
            { view: 'compost', label: 'El compost, paso a paso', desc: 'De la recolección a la tierra negra: mezcla café/verde, volteo, madurez y aplicación', emoji: '🍂' },
            { view: 'estiercol', label: 'Del corral al abono', desc: 'Quítele el olor a la gallinaza, sáquele gas con el biodigestor y saque cuentas', emoji: '🐄' },
        ],
    },
    {
        id: 'sanidad',
        pisos: ['transversal'],
        titulo: 'Sanidad de la planta',
        emoji: '🐞',
        lema: 'Plagas, remedios caseros y los bichos que lo ayudan',
        tinte: ['#b0532f', '#f6ded1'],
        entradas: [
            { view: 'sanidad_sintoma', label: 'Mi planta está enferma', desc: 'Diga qué le ve ("gota", "polvillo", "amarilla") y sepa qué es y cómo manejarla sin veneno', emoji: '🩺' },
            { view: 'plagas', label: 'Directorio de plagas', desc: 'Reconozca el bicho o la enfermedad por foto: a qué le pega, cómo se ve y su manejo sin veneno', emoji: '🐛' },
            { view: 'biopreparados', label: 'Biopreparados', desc: 'Recetas caseras paso a paso para proteger la planta', emoji: '🧪', data: { back: 'dashboard' } },
            { view: 'reportar_invasora', label: 'Reportar una plaga', desc: 'Vio algo raro en una planta: repórtelo con foto', emoji: '🔍' },
            { view: 'casos', label: 'Casos reales', desc: 'Problemas de otras fincas y cómo los resolvieron', emoji: '📋' },
            { view: 'defensores', label: 'Defensores de la finca', desc: 'Conozca jugando los bichos buenos que controlan plagas', emoji: '🐞' },
            { view: 'toxicologia', label: 'Seguridad con insumos', desc: 'Qué es peligroso y cómo cuidarse', emoji: '⚠️' },
        ],
    },
    {
        id: 'clima',
        pisos: ['transversal'],
        titulo: 'El clima',
        emoji: '⛅',
        lema: 'Lo que viene y qué hacer: los boletines del IDEAM en campesino',
        tinte: ['#4c7fa0', '#dce9f2'],
        // Acceso prioritario a la pantalla 2D canónica: en el home F2 la
        // grilla está plegada y el mundo genérico agregaba un tercer toque.
        directo: { view: 'clima_boletin' },
        entradas: [
            { view: 'clima_boletin', label: 'El clima que viene', desc: 'Qué trae El Niño o La Niña y qué hacer, leído del IDEAM', emoji: '⛅' },
            { view: 'hoy_finca', label: 'Su día en la finca', desc: 'Lluvia, heladas y avisos para hoy', emoji: '🌤️' },
        ],
    },
    {
        id: 'animales',
        pisos: ['transversal'],
        titulo: 'Los animales',
        emoji: '🐔',
        lema: 'Cría campesina: gallinas, cerdos, conejos, cabras y más',
        tinte: ['#a86a3a', '#f3e3cf'],
        // Gate por perfil: un urbano de balcón no ve este mundo (mismo criterio
        // `mostrarAnimales` del home). El filtro lo aplica MundosDeMiFinca.
        gate: 'animales',
        entradas: [
            { view: 'animales', label: 'Todos los animales', desc: 'Su corral completo y el ciclo cerrado', emoji: '🐮' },
            { view: 'animales_gallinas', label: 'Gallinas', desc: 'Ponedoras, engorde, sanidad y gallinaza', emoji: '🐔' },
            { view: 'seguimiento_cerdos', label: 'Cerdos', desc: 'Ciclo de manejo porcino y cama profunda', emoji: '🐖' },
            { view: 'animales_conejos', label: 'Conejos', desc: 'Cría en poco espacio, forraje y conejaza', emoji: '🐇' },
            { view: 'animales_caprinos', label: 'Cabras y ovejas', desc: 'Leche, carne, lana y majada para el abono', emoji: '🐐' },
            { view: 'animales_vacas', label: 'Vacas', desc: 'Manejo, pastoreo y ordeño', emoji: '🐄' },
            { view: 'animales_abejas', label: 'Abejas y polinización', desc: 'Nativas sin aguijón, colmenas y una finca amiga de polinizadores', emoji: '🐝' },
        ],
    },
    {
        id: 'mercado',
        pisos: ['transversal'],
        titulo: 'Mercado y despensa',
        emoji: '🧺',
        lema: 'Venda directo, saque cuentas y transforme su cosecha',
        tinte: ['#b98a2f', '#f7ecd2'],
        entradas: [
            { view: 'mercado', label: 'Vender y comprar', desc: 'Directo entre fincas, sin intermediarios', emoji: '🤝' },
            { view: 'poscosecha', label: 'Después de cosechar: guardar y despensa', desc: 'Cosechar en punto, guardar sin que se dañe y transformar', emoji: '🥕' },
            { view: 'almacenamiento', label: 'Almacenamiento y conservación', desc: 'Troja y silo, secar/salar/fermentar sin botulismo, plagas de almacén y micotoxinas', emoji: '📦' },
            { view: 'nutricion', label: 'La comida que alimenta', desc: 'Qué te da comer cada cultivo: fuerza, cuerpo, sangre y defensas (ICBF)', emoji: '🍽️' },
            { view: 'bodega', label: 'Bodega de insumos', desc: 'Lo que tiene guardado y lo que se acaba', emoji: '🏚️' },
            { view: 'informes', label: 'Sacar reportes', desc: 'Para imprimir o llevar al banco o la cooperativa', emoji: '🖨️' },
            { view: 'fermentos', label: 'Fermentos de la cocina', desc: 'Chucrut, kombucha, yogur y masato: recetas con fotos y su seguridad', emoji: '🫙' },
        ],
    },
    {
        id: 'disenio',
        pisos: ['transversal'],
        titulo: 'Diseño de la finca',
        emoji: '🌳',
        lema: 'Buenas vecinas, monte vivo y proyectos de restauración',
        tinte: ['#2f6b3a', '#d8e9d2'],
        entradas: [
            { view: 'asociaciones', label: 'Buenas vecinas', desc: 'Qué cultivos se ayudan sembrados juntos', emoji: '🌻' },
            { view: 'restauracion', label: 'Restauración y bosque de alimentos', desc: 'Los 7 estratos del bosque comestible, la sucesión ecológica y cómo restaurar un suelo herido — con especies nativas y multipropósito del catálogo', emoji: '🌳' },
            { view: 'biodiversidad', label: 'El monte de la finca', desc: 'Plantas y animales silvestres que la acompañan', emoji: '🦜' },
            { view: 'seguimiento_reforestacion', label: 'Reforestación', desc: 'Restauración con árboles nativos', emoji: '🌳' },
            { view: 'seguimiento_silvopastoreo', label: 'Silvopastoreo', desc: 'Árboles + pasto + ganado en el mismo lote', emoji: '🐂' },
            { view: 'seguimiento_paramo', label: 'Páramo', desc: 'Conservación del páramo y su agua', emoji: '🏔️', pisos: ['paramo'] },
        ],
    },
    {
        id: 'semillero',
        pisos: ['transversal'],
        titulo: 'Semillero y vivero',
        emoji: '🌱',
        lema: 'Del grano a la plántula: germine, repique y endurezca antes de llevar al campo',
        // Verde tierno de vivero (distinto del verde de trabajo de Cultivos).
        tinte: ['#4f9d5b', '#e6f0cf'],
        entradas: [
            { view: 'germinacion', label: 'Semilleros: qué nace', desc: 'Ponga a germinar en bandeja, con sustrato suelto y humedad, y vea cuáles semillas prenden', emoji: '🫘' },
            { view: 'semilla', label: 'Semilla propia', desc: 'Seleccione, guarde y pruebe su semilla criolla — cuándo le sale mejor que la comprada', emoji: '🌾' },
            { view: 'sembrar', label: 'Repicar y llevar al campo', desc: 'Anote el trasplante de la bandeja a la bolsa o la era, y de ahí al lote', emoji: '🌱' },
            { view: 'ciclo', label: 'Seguimiento por etapas', desc: 'La vida de la plántula etapa por etapa, del brote al endurecimiento', emoji: '🔄' },
            { view: 'calendario_finca', label: 'Cuándo sembrar', desc: 'Las fechas de semillero y trasplante para su clima', emoji: '🗓️' },
        ],
    },
    {
        id: 'micorrizas',
        pisos: ['transversal'],
        titulo: 'La red del suelo',
        emoji: '🍄',
        lema: 'Hongos socios de la raíz: le traen fósforo y agua',
        // Turquesa de micelio + mint clarito (fondo de tarjeta).
        tinte: ['#1f9e86', '#d6f2ea'],
        // Mundo 3D flagship (la red micorrízica bajo tierra, con pulsos de
        // nutrientes y el Ent asomando). La tarjeta abre el mundo directo.
        directo: { view: 'mundo3d_micorrizas' },
    },
];

/**
 * Ordena y filtra una colección de mundos según el piso confirmado.
 *
 * Sólo se conservan los transversales y los propios del piso del usuario.
 * Sin piso declarado ni altitud conocida se conserva exactamente el catálogo
 * completo y no se fabrica ninguna marca.
 *
 * @param {Array<object>} mundos
 * @param {object|null|undefined} profile
 * @returns {Array<object>} copias anotadas con `esSuyo`, sin mutar el catálogo
 */
export function ordenarMundosPorPiso(mundos, profile) {
    const pisoPerfil = pisoTermicoDePerfil(profile);
    const pisoUsuario = pisoDeFinca(pisoPerfil);
    const pisoSinSiembra = pisoPerfil === 'superparamo' || pisoPerfil === 'nival';
    if (pisoSinSiembra) {
        const observacion = new Set(['agua', 'clima', 'suelo']);
        return mundos
            .filter((mundo) => observacion.has(mundo.id))
            .map((mundo) => ({ ...mundo, esSuyo: false }));
    }
    if (!pisoUsuario) return mundos.map((mundo) => ({ ...mundo, esSuyo: false }));

    return mundos
        .map((mundo, index) => {
            const transversal = !Array.isArray(mundo.pisos) || mundo.pisos.includes('transversal');
            const esSuyo = !transversal && mundo.pisos?.includes(pisoUsuario);
            return esSuyo || transversal ? { mundo: { ...mundo, esSuyo }, index } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.index - b.index)
        .map(({ mundo }) => mundo);
}

/**
 * Devuelve las entradas que aplican al piso confirmado del perfil.
 *
 * Una entrada sin declaración de `pisos` se trata como transversal por
 * compatibilidad y por la regla anti-invención: la ausencia de evidencia no
 * puede ocultar una herramienta. Con perfil sin piso se devuelve el catálogo
 * completo, sin alterar su orden.
 */
export function filtrarEntradasPorPiso(entradas, profile) {
    const pisoPerfil = pisoTermicoDePerfil(profile);
    if (pisoPerfil === 'superparamo' || pisoPerfil === 'nival') return [];
    const pisoUsuario = pisoDeFinca(pisoPerfil);
    if (!pisoUsuario) return entradas;

    return entradas.filter((entrada) => {
        const pisos = entrada.pisos;
        return !Array.isArray(pisos) || pisos.includes('transversal') || pisos.includes(pisoUsuario);
    });
}

/** Mapa id → mundo, para resolver desde la ruta 'mundo'. */
export const MUNDO_BY_ID = Object.fromEntries(MUNDOS_FINCA.map((m) => [m.id, m]));

/** Resuelve un mundo desde su id (null si no existe). */
export const getMundo = (id) => MUNDO_BY_ID[id] || null;

/**
 * TODAS las vistas alcanzables vía mundos (directas + entradas), para el test
 * de reachability y auditorías de huérfanos.
 * @returns {string[]} views únicas.
 */
export function mundosViews() {
    const out = new Set();
    for (const m of MUNDOS_FINCA) {
        if (m.directo) out.add(m.directo.view);
        // La portada a medida del mundo también es una vista real de App.jsx:
        // incluirla congela su reachability (antes se colaba sin validar).
        if (m.portada) out.add(m.portada);
        for (const e of m.entradas || []) out.add(e.view);
    }
    return [...out];
}
