import { syncFarmLocation } from '../../services/farmLocationSync.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    MessageCircle, CloudSun, Compass, BookOpenText, MapPin, ExternalLink, Hourglass, Radio,
    Sun, CloudRain, Cloud, Droplets, Wind, Gauge, Sprout, ListChecks, Waves,
    ThermometerSun, Sparkles, CalendarClock, Leaf, RefreshCw,
    AlertTriangle, AlertCircle, Check, Info, HelpCircle, Moon, Volume2, Share2, Printer,
    Flame, Snowflake, Wheat, Mountain, BedDouble, Bug, ChevronRight, Clock,
} from 'lucide-react';
import { ScreenShell } from '../common/ScreenShell';
import { MSG } from '../../config/messages';
import CieloENSO from './CieloENSO';
import EscenaAtmosfera, { Luna } from './EscenaAtmosfera';
import { deriveAtmosphere } from '../../services/atmosphereService';
import GraficoClimaSemanal from './GraficoClimaSemanal';
import CultivoTarjeta from './CultivoTarjeta';
import { QueEsEsto, CompaiAvatar } from './pedagogia';
import { horasJuntas } from './horasJuntas';
import { respuestasDelDia, vistazoTemporada, fechaDelDato as fechaSnapshot } from './respuestasDelDia.js';
import { getEnsoPhase, getEnsoLabel, getEnsoPhaseSource, getEnsoCachedAt } from '../../services/ensoService';
import { ensoFamily, regionFromProfile } from '../../services/ensoContext';
import { getProfile } from '../../services/userProfileService';
import useAssetStore from '../../store/useAssetStore';
import useFincaActiveStore from '../../services/fincaActiveStore.js';
import { fetchClimaSnapshot, getCachedClimaSnapshot, resolveClimaLocation } from '../../services/climaService';
import { isSavedLocationCoarse } from '../../services/locationService.js';
import { fetchAgroMeteo, fetchNormales } from '../../services/agroMeteoService';
import {
    leerGateCielo, condicionAhora, escenaDelCielo, CIELO_ROTULO_PANTALLA, heladaVisible, resolverCielo, claveCielo, tonoCielo,
    frescuraDelSnapshot, vientoAhora,
    uvAhora, arcoDelSol, lunaDeHoy, densidadLluvia, densidadNiebla, cifra, sinPuntoDoble, comaDecimal,
    diasDesdeHoy, horaDeCampo, conArticulo,
    anomaliaLluviaSemana,
    anomaliaLluviaMes,
    probabilidadLluvia,
    totalLluvia24h,
    tormentaSinCantidad,
    TORMENTA_SIN_CANTIDAD,
} from './cieloHoy';
import { Numeral, Brujula, ArcoSol, Franja24h, FranjaDias } from './PiezasCielo';
import { xDelInstante } from './ejeHoras.js';
import { horaEsCO, horaConMinutosEsCO } from '../../utils/fechaEsCO.js';
import './cielo.css';
import {
    parseCultivos, vpdKpa, leerVpd, leerUv, amplitudTermica, anomalia,
} from '../../services/agroIndices';
import {
    BOLETINES_IDEAM,
    MTA_INFO, MTA_POR_REGION, FENALCE_INFO, FENALCE_CULTIVOS_POR_PISO,
    ENSO_CALENDARIO_2026_27, ENSO_TRANSICION, MTA_VENTANA_SIEMBRA,
    FUENTES_VIVAS, ESTADO_GROUNDED_PENDIENTE, faseCalendarioActual, probabilidadesEnsoSnapshot,
    checklistPreparacion, suPisoTexto,
} from '../../data/climaBoletines';
import './clima.css';
import { speak, stop as stopSpeech } from '../../services/ttsService.js';
import AvisoSanitarioPiso from './AvisoSanitarioPiso.jsx';

/*
 * ClimaBoletinScreen. LA PÁGINA DEL TIEMPO de Chagra (rediseño Fase 2, DOSSIER
 * PAGINA-TIEMPO-AGROCLIMA §5). Sobre la base del traductor ENSO ("El clima que
 * viene"), ahora en TRES HORIZONTES:
 *
 *   HOY          → el estado ahora (T, se-siente-como, HR, viento, UV, lluvia,
 *                  ETo, VPD, punto de rocío) + ANOMALÍA de temperatura +
 *                  TARJETAS POR CULTIVO (el diferencial: ETc, "cuánta agua le
 *                  falta", semáforo de enfermedad, acción del día).
 *   7–16 DÍAS    → UNA vista desde hoy + alertas + ventanas de labor (aplicar
 *                  con el mismo motor horario de hoy; secar).
 *   EL NIÑO      → fase ENSO (ONI de la NOAA CPC) + lectura regional + checklist
 *                  de preparación para la temporada fuerte 2026–27.
 *
 * ARQUITECTURA (DOSSIER, híbrido): el DATO CRUDO viene de agroMeteoService
 * (Open-Meteo, ETo FAO-56 nativo) y del snapshot ENSO del sidecar (autoridad
 * IDEAM/NOAA); los ÍNDICES DERIVADOS se calculan en cliente puro (agroIndices).
 * ANTI-ALUCINACIÓN: cada número lleva su fuente; lo que caduca o falta el dato es
 * SlotPendiente, nunca inventado. IDEAM manda para el pronóstico oficial.
 */

const CONDICION_LABEL = CIELO_ROTULO_PANTALLA;
// eslint-disable-next-line chagra-i18n/no-hardcoded-spanish -- opciones locales del formulario
const LABOR_LABELS = { riego: 'Riego', aplicacion: 'Aplicación foliar', siembra: 'Siembra', cosecha: 'Cosecha' };

const HORIZONTES = [
    { id: 'hoy', titulo: 'Hoy', sub: 'Ahora mismo', icon: Sun },
    { id: 'semana', titulo: '7–16 días', sub: 'Lo que viene', icon: CalendarClock },
    { id: 'estacional', titulo: 'El Niño', sub: 'La temporada', icon: Waves },
];

/** Rótulo de la fase cuando no se pudo leer: el mismo del módulo de respuestas (W40, J8 de la v17). */
const FASE_SIN_DATO = vistazoTemporada().rotulo;

const FASE_ACENTO = {
    nino: { text: 'text-amber-300', border: 'border-amber-500/50', bg: 'bg-amber-500/10', chip: 'bg-amber-500/15 text-amber-200' },
    nina: { text: 'text-sky-300', border: 'border-sky-500/50', bg: 'bg-sky-500/10', chip: 'bg-sky-500/15 text-sky-200' },
    neutral: { text: 'text-slate-200', border: 'border-slate-600/60', bg: 'bg-slate-500/10', chip: 'bg-slate-500/15 text-slate-200' },
};

/* La etiqueta de la fuente la da el módulo de respuestas; aquí, el ícono y el color. */
function FuenteFase({ fuente }) {
    const map = {
        live: { icon: Radio, cls: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' },
        cached: { icon: Hourglass, cls: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
        manual: { icon: MapPin, cls: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
        openmeteo: { icon: Radio, cls: 'text-sky-300 border-sky-500/40 bg-sky-500/10' },
        archive: { icon: Radio, cls: 'text-sky-300 border-sky-500/40 bg-sky-500/10' },
        default: { icon: Hourglass, cls: 'text-slate-400 border-slate-600/50 bg-slate-700/20' },
        offline: { icon: Hourglass, cls: 'text-slate-400 border-slate-600/50 bg-slate-700/20' },
    };
    const m = map[fuente.clave] || map.default;
    const Icon = m.icon;
    return (
        <span data-testid="clima-fuente-fase" className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${m.cls}`}>
            <Icon size={11} aria-hidden="true" />
            {fuente.etiqueta}
        </span>
    );
}

/* La sigla y el método de una ficha, plegados: fuera de aquí, palabras del campo (W34). */
function ParaTecnicos({ children }) {
    return (
        <details className="mt-1 text-xs leading-tight text-slate-500">
            <summary className="flex items-center">Para técnicos</summary>
            <p>{children}</p>
        </details>
    );
}

/* Etiqueta de fuente de un dato derivado (anti-alucinación: cada número la lleva). */
function FuenteDato({ children }) {
    return <p className="mt-1 text-xs leading-tight text-slate-500">{horasJuntas(children)}</p>;
}


const MESES_BOLETIN = { ene: 'enero', feb: 'febrero', mar: 'marzo', abr: 'abril', may: 'mayo', jun: 'junio', jul: 'julio', ago: 'agosto', sep: 'septiembre', oct: 'octubre', nov: 'noviembre', dic: 'diciembre' };

function fechaBoletin(texto) {
    return texto
        .replace(/(\d{1,2})-([a-z]{3})-(\d{4})/g, (original, dia, mes, anio) => MESES_BOLETIN[mes] ? `${Number(dia)} de ${MESES_BOLETIN[mes]} de ${anio}` : original)
        .replace(/([a-z]{3})–([a-z]{3}) (\d{4})/g, (original, inicio, fin, anio) => MESES_BOLETIN[inicio] && MESES_BOLETIN[fin] ? `${MESES_BOLETIN[inicio]} a ${MESES_BOLETIN[fin]} de ${anio}` : original)
        .replace(/([a-z]{3})-(\d{4})/g, (original, mes, anio) => MESES_BOLETIN[mes] ? `${MESES_BOLETIN[mes]} de ${anio}` : original);
}

function fechaHoraSnapshot(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const fecha = fechaSnapshot(date);
    const hora = horaEsCO(date);
    return hora && fecha ? `${fecha}, ${hora}` : null;
}

function TrazabilidadClima({ agrometeo, snapshot, location }) {
    const model = agrometeo?.provenance;
    const station = snapshot?.station || snapshot?.estacion || snapshot?.station_observation || null;
    const check = model?.altitude_check;
    const vigencia = vigenciaDesdeHoy(model?.valid_from, model?.valid_until, agrometeo?.today?.date);
    return (
        <section className="cl-sub" data-testid="clima-trazabilidad">
            <div className="flex items-start gap-2">
                <BookOpenText size={16} className="mt-0.5 shrink-0 text-sky-300" aria-hidden="true" />
                <div className="min-w-0">
                    <p className="mt-1 text-xs leading-snug text-slate-400">Abra el producto concreto, revise cuándo se consultó y compruebe qué territorio representa.</p>
                </div>
            </div>
            <div className="mt-3 space-y-2 text-xs text-slate-300">
                <div data-testid="clima-origen-modelo">
                    <p className="font-bold text-sky-200">Modelo</p>
                    <p>{model?.product || 'Pronóstico meteorológico'}{/blend/i.test(model?.model || '') ? ', que junta varios modelos del tiempo' : ''}.</p>
                    {model?.product_url ? (
                        <a className="text-sky-300 underline" href={model.product_url} target="_blank" rel="noopener noreferrer">Abrir producto consultado</a>
                    ) : <p className="text-amber-300">Producto de origen no entregado.</p>}
                    <p className="text-slate-500">{horasJuntas(sinPuntoDoble(`Consultado el ${fechaHoraSnapshot(model?.fetched_at || agrometeo?.fetched_at) || 'sin fecha'}.`))}</p>
                    <details className="mt-1 text-slate-500" data-testid="clima-origen-tecnico">
                        <summary>Para técnicos: modelo, emisión y vigencia</summary>
                        <p className="mt-1">Modelo: {model?.model || 'modelo no especificado'}{/blend/i.test(model?.model || '') ? ' (blend: combinación de modelos)' : ''}.</p>
                        <p>{horasJuntas(sinPuntoDoble(`Emisión (cuándo la fuente publicó el pronóstico): ${model?.issued_at ? fechaHoraSnapshot(model.issued_at) : 'no entregada por la fuente'}.`))}</p>
                        <p>Vigencia (días que cubre el pronóstico): {vigencia ? `${fechaSnapshot(vigencia.desde)}${vigencia.hasta ? ` a ${fechaSnapshot(vigencia.hasta)}` : ''}` : 'no indicada'}.</p>
                    </details>
                </div>
                <div data-testid="clima-origen-estacion">
                    <p className="font-bold text-emerald-200">Estación</p>
                    {station ? <p>{MSG.format(MSG.clima.observacionEstacion, { nombre: station.name || station.id || 'sin nombre' })}</p> : <p className="text-slate-400">No hay observación de estación en este producto. Este valor es de modelo.</p>}
                </div>
                <div data-testid="clima-territorio">
                    <p className="font-bold text-slate-200">Territorio representado</p>
                    <p>{model?.territory?.precision || 'celda de modelo'} (área representada por el modelo) · {Number.isFinite(location?.lat) ? `${cifra(location.lat, 3)}; ${cifra(location.lng, 3)}` : 'ubicación no disponible'}.</p>
                </div>
                {check?.warning && <aside className="cl-sub text-amber-200" data-testid="clima-alerta-altitud">
                    <p className="font-bold">La altura de su finca no coincide con la celda del modelo.</p>
                    <p className="mt-0.5">{MSG.format(MSG.clima.alturaFincaVsCelda, { finca: Math.round(check.farm_elevation ?? model.farm_elevation), celda: Math.round(check.grid_elevation ?? model.grid_elevation), diferencia: Math.round(check.difference) })}</p>
                    <p className="mt-0.5 text-xs">Se avisa desde {check.threshold} m porque el relieve puede cambiar la lectura local. No es una medición del lote.</p>
                </aside>}
            </div>
        </section>
    );
}

/* La vigencia que se muestra empieza hoy: los días ya pasados que trae la
 * serie (lluvia de días anteriores) no son pronóstico (§ 4 punto 3 de la v14). */
function vigenciaDesdeHoy(desde, hasta, hoy) {
    const iso = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
    const [d, h, t] = [iso(desde), iso(hasta), iso(hoy)];
    if (!d) return null;
    if (t && h && h < t) return null;
    return { desde: t && d < t ? t : d, hasta: h };
}

function fechaValidez(dias, hoy) {
    const ultimo = Array.isArray(dias) && dias.length > 0 ? dias[dias.length - 1]?.date : null;
    if (!ultimo || (hoy && ultimo < hoy)) return null;
    return fechaSnapshot(ultimo);
}

function horaLocalFinca(date, timezone) {
    try {
        return Number(new Intl.DateTimeFormat('en-US', {
            timeZone: timezone || 'America/Bogota', hour: '2-digit', hourCycle: 'h23',
        }).format(date));
    } catch {
        return null;
    }
}

function AccionesBoletin({ texto, onRead }) {
    const [copiado, setCopiado] = useState(false);
    const compartir = async () => {
        try {
            if (navigator.share) await navigator.share({ title: 'Boletín del clima', text: texto });
            else await navigator.clipboard.writeText(texto);
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 1800);
        } catch { /* cancelación del diálogo o portapapeles no disponible */ }
    };
    return (
        <div className="clima-acciones" data-testid="clima-acciones">
            <button type="button" onClick={onRead} aria-label="Leer en voz alta"><Volume2 size={16} aria-hidden="true" />Escuchar</button>
            <button type="button" onClick={compartir} aria-label={copiado ? 'Texto copiado' : 'Compartir texto'}><Share2 size={16} aria-hidden="true" />{copiado ? 'Copiado' : 'Compartir'}</button>
            <details className="clima-texto-ligero">
                <summary aria-label="Leer versión de texto">Texto</summary>
                <p data-testid="clima-texto-ligero-contenido">{horasJuntas(texto)}</p>
                <button type="button" onClick={() => window.print()} className="cl-boton cl-boton--suave mt-2"><Printer size={16} aria-hidden="true" />Imprimir</button>
            </details>
        </div>
    );
}


function fechaLocalISO(date) {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    return /** @type {{ year?: string, month?: string, day?: string }} */ (
        partes.reduce((acc, parte) => ({ ...acc, [parte.type]: parte.value }), {})
    );
}

function fechasCercanas(date) {
    const hoy = fechaLocalISO(date);
    const manana = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const siguiente = fechaLocalISO(manana);
    return new Set([
        `${hoy.year}-${hoy.month}-${hoy.day}`,
        `${siguiente.year}-${siguiente.month}-${siguiente.day}`,
    ]);
}

function alertaObservada(alerta) {
    const texto = `${alerta?.tipo || alerta?.type || ''} ${alerta?.estado || alerta?.status || ''}`.toLowerCase();
    return alerta?.observada === true || alerta?.observed === true || alerta?.medida === true
        || alerta?.measured === true || /\b(escarcha|helada negra)\b/.test(texto);
}

function alertaParaEstaMadrugada(alerta, date) {
    if (alertaObservada(alerta)) return false;
    const dias = Array.isArray(alerta?.dias) ? alerta.dias : [];
    const fechas = [
        ...dias,
        alerta?.fecha,
        alerta?.date,
        alerta?.valid_date,
        alerta?.starts_at,
    ].filter(Boolean).map((value) => String(value).slice(0, 10));
    const cercanas = fechasCercanas(date);
    return fechas.some((fecha) => cercanas.has(fecha));
}

function OniObservado({ snapshot }) {
    const enso = snapshot?.enso_status;
    const latest = snapshot?.noaa?.latest;
    const value = typeof latest?.value === 'number' && Number.isFinite(latest.value)
        ? latest.value : null;
    const seasonMonths = ['dic–feb', 'ene–mar', 'feb–abr', 'mar–may', 'abr–jun', 'may–jul', 'jun–ago', 'jul–sep', 'ago–oct', 'sep–nov', 'oct–dic', 'nov–ene'];
    const seasonIndex = Number.isInteger(latest?.monthIndex) && latest.monthIndex >= 0 && latest.monthIndex < 12
        ? latest.monthIndex : null;
    const season = seasonIndex == null || !Number.isInteger(latest?.year)
        ? null : `${seasonMonths[seasonIndex]} ${latest.year}`;
    const date = fechaSnapshot(enso?.nino34_observed_at || enso?.observed_at || enso?.date || enso?.fecha);
    const safeSources = Array.isArray(enso?.sources)
        ? enso.sources.filter((item) => typeof item === 'string' && !/(?:ops\/|\.(?:txt|md)\b|dr-cross|\bDR-)/i.test(item))
        : [];
    const source = value != null ? 'NOAA CPC' : safeSources.join(', ');
    return (
        <div className="mt-3 cl-sub" data-testid="clima-oni">
            <p className="cl-etiqueta">ONI observado (índice oceánico de El Niño)</p>
            {value != null ? (
                <>
                    <p className="mt-1 text-lg font-bold text-slate-100">{value > 0 ? '+' : ''}{value.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C · {season || 'temporada no indicada'}</p>
                    <p className="mt-1 text-xs text-slate-400">
                        Fuente: NOAA CPC. {date ? `Fecha de observación: ${date}.` : 'Fecha de publicación no entregada.'}
                    </p>
                </>
            ) : (
                <p className="mt-1 text-xs text-slate-400">No hay observación ONI disponible (índice oceánico de El Niño). {source ? `Fuente: ${source}.` : ''} {date ? `Fecha de observación: ${date}.` : ''} No se sustituye por probabilidad ni por un número fijo.</p>
            )}
        </div>
    );
}

/* Comparación causal: una sola condición cambia, el resto del escenario se
 * conserva. La persona puede llevar la relación causa-efecto a su finca. */
function ComparacionGuiada({ piso }) {
    const [cieloNublado, setCieloNublado] = useState(false);
    const lectura = cieloNublado
        ? {
            etiqueta: 'Después',
            titulo: 'Noche con nubes',
            texto: 'Las nubes actúan como una cobija: retienen parte del calor que el suelo pierde durante la noche. Por eso baja el riesgo de una helada radiativa, aunque todavía hay que mirar el pronóstico local.',
        }
        : {
            etiqueta: 'Antes',
            titulo: 'Noche despejada',
            texto: 'Sin nubes, el suelo pierde calor con más facilidad hacia el cielo. Si además hay poco viento y la temperatura baja, aumenta el riesgo de escarcha o helada cerca de las plantas.',
        };

    return (
        <section className="clima-comparacion" data-testid="comparacion-guiada">
            <div className="clima-comparacion__kicker">Aprenda mirando una causa</div>
            <h3 className="cl-seccion-titulo clima-comparacion__title">¿Qué cambia cuando cambia el cielo?</h3>
            <p className="clima-comparacion__intro">Mantenga igual la finca y la temperatura. Cambie solo una condición: la nubosidad de la noche.</p>
            <div className="clima-comparacion__choices" role="group" aria-label="Cambiar solo la nubosidad">
                <button type="button" className={!cieloNublado ? 'is-selected' : ''} aria-pressed={!cieloNublado}
                    data-testid="comparacion-estado-despejado" onClick={() => setCieloNublado(false)}>
                    <Moon size={22} aria-hidden="true" />
                    <span><strong>Despejado</strong><small>Antes</small></span>
                </button>
                <span className="clima-comparacion__arrow" aria-hidden="true">→</span>
                <button type="button" className={cieloNublado ? 'is-selected' : ''} aria-pressed={cieloNublado}
                    data-testid="comparacion-estado-nublado" onClick={() => setCieloNublado(true)}>
                    <Cloud size={22} aria-hidden="true" />
                    <span><strong>Con nubes</strong><small>Después</small></span>
                </button>
            </div>
            <div className="clima-comparacion__result" data-testid="comparacion-resultado" aria-live="polite">
                <span className="clima-comparacion__label">{lectura.etiqueta}</span>
                <h4>{lectura.titulo}</h4>
                <p>{lectura.texto}</p>
                {cieloNublado && <p className="clima-comparacion__changed"><strong>Lo único que cambió:</strong> la nubosidad. La finca, la temperatura y la hora siguen iguales.</p>}
            </div>
            <label className="clima-comparacion__prompt" htmlFor="comparacion-finca">
                <span>Ahora relaciónelo con su finca:</span>
                <small>¿En qué cama, cultivo o madrugada ha visto ese cambio?</small>
            </label>
            <textarea id="comparacion-finca" rows={2} placeholder={piso === 'frio' || piso === 'paramo' ? 'Ejemplo: en la papa de la parte alta...' : 'Ejemplo: en la cama junto a la quebrada...'} />
        </section>
    );
}

/* Ficha de un índice del día (tile). */
function IndiceTile({ icon, label, valor, unidad = '', sub, accent = 'slate', testid = undefined, children }) {
    const Icon = icon;
    const tint = {
        sky: 'text-sky-300', amber: 'text-amber-300', emerald: 'text-emerald-300',
        red: 'text-red-300', orange: 'text-orange-300', slate: 'text-slate-200',
    }[accent] || 'text-slate-200';
    return (
        <div data-testid={testid} className="cl-sub">
            <p className="cl-etiqueta">
                <Icon size={13} className={tint} aria-hidden="true" /> {label}
            </p>
            <p className="cl-indice-valor mt-1 leading-none">
                {valor != null ? (
                    <>
                        <span className={`text-2xl font-bold ${tint}`}>{typeof valor === 'number' ? cifra(valor, 2) : valor}</span>
                        {unidad && <span className="text-sm font-bold text-slate-400 ml-0.5">{unidad}</span>}
                    </>
                ) : (
                    <span className="cl-suave">sin dato</span>
                )}
            </p>
            {sub && <p className="mt-0.5 text-xs leading-tight text-slate-400">{sub}</p>}
            {children}
        </div>
    );
}

/* Lo que la pantalla MIDE del agua. La decisión de riego es una sola y vive en
 * el veredicto (fila «¿Riego?»); aquí van las lecturas y lo que falta declarar. */
function LecturasHidricas({ agrometeo, pendiente, onDeclarar }) {
    const capas = agrometeo?.humedadSueloCapas;
    const declarada = typeof pendiente === 'string' && pendiente.trim().length > 0;
    const capa = (profundidad, key) => (
        <div className="cl-sub" data-testid={`humedad-suelo-${key}`}>
            <p className="text-xs font-bold text-slate-300">{profundidad}</p>
            <p className="mt-1 text-lg font-bold text-sky-200">
                {Number.isFinite(capas?.[key]) ? `${cifra(capas[key])} %` : <span className="cl-suave">sin dato</span>}
            </p>
        </div>
    );
    return (
        <section className="cl-sub" data-testid="clima-lecturas-hidricas">
            <div className="flex items-center gap-1.5">
                <Droplets size={15} className="text-sky-300" aria-hidden="true" />
                <h3 className="cl-seccion-titulo">Agua que tiene el suelo</h3>
            </div>
            <p className="mt-1 text-xs leading-tight text-slate-400">Lectura del modelo para la hora vigente, por profundidad. La decisión de riego está arriba, en «¿Riego?».</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
                {capa('0–1 cm', '0_1cm')}
                {capa('1–3 cm', '1_3cm')}
                {capa('3–9 cm', '3_9cm')}
            </div>
            <FuenteDato>Open-Meteo · cada cifra es la parte de la tierra que es agua, en porcentaje del volumen</FuenteDato>
            {!declarada && (
                <div className="mt-3 border-t border-slate-800 pt-2" data-testid="clima-pendiente-faltante">
                    <p className="text-xs leading-snug text-slate-400">Falta declarar la pendiente de la ladera. Chagra no la supone: con ella sabe si la lluvia se queda o se va ladera abajo.</p>
                    {onDeclarar && <button type="button" className="cl-boton mt-2" onClick={onDeclarar} data-testid="clima-declarar-pendiente">Declarar la pendiente</button>}
                </div>
            )}
        </section>
    );
}

function RachaSeca({ dias }) {
    return (
        <IndiceTile testid="clima-indice-racha-seca" icon={CloudRain} label="Racha seca" valor={dias} unidad="días"
            accent={dias == null ? 'slate' : 'amber'}
            sub={dias == null ? 'No se puede acreditar: falta historial de días ocurridos.' : 'Días completos sin lluvia registrada'}>
            <FuenteDato>Solo días ya ocurridos. El pronóstico de hoy no corta la racha.</FuenteDato>
        </IndiceTile>
    );
}

/* Anomalía de hoy frente a lo normal (baja de la portada a «Hoy»). */
/** La anomalía en palabras de campo: «Hoy está más caliente que un día normal de esta época». */
function fraseAnomalia(delta) {
    if (Math.abs(delta) < 0.5) return 'Hoy está como un día normal de esta época.';
    const grados = comaDecimal(String(Math.abs(delta)));
    return delta > 0
        ? `Hoy está más caliente que un día normal de esta época: ${grados}\u00a0°C más.`
        : `Hoy está más frío que un día normal de esta época: ${grados}\u00a0°C menos.`;
}

function AnomaliaHoy({ anom, lluviaSemanaPct = null, lluviaMesPct = null, faseFamily = null }) {
    const desvio = anom && Math.abs(anom.tempDelta) >= 0.5;
    return (
        <div className="cl-sub" data-testid="clima-anomalia-bloque">
            {anom ? (
                <div className="flex items-start gap-2" data-testid="clima-anomalia">
                    <ThermometerSun size={16} className={`shrink-0 mt-0.5 ${desvio ? 'text-amber-300' : 'text-slate-300'}`} aria-hidden="true" />
                    <div>
                        <p className={`text-sm leading-snug ${desvio ? 'font-bold text-amber-200' : 'text-slate-300'}`}>{fraseAnomalia(anom.tempDelta)}</p>
                        <FuenteDato>Lo normal es el promedio de muchos años para estos mismos días.</FuenteDato>
                        {anom.fuente && <details className="mt-1 text-xs text-slate-500" data-testid="clima-anomalia-fuente">
                            <summary>Para técnicos: con qué se compara</summary>
                            <p className="mt-1">{comaDecimal(anom.fuente)}</p>
                            {/ERA5|Kc/.test(anom.fuente) && <p className="mt-1">{[
                                /ERA5/.test(anom.fuente) && 'ERA5: reconstrucción del clima pasado.',
                                /Kc/.test(anom.fuente) && 'Kc: coeficiente de cultivo.',
                            ].filter(Boolean).join(' ')}</p>}
                        </details>}
                    </div>
                </div>
            ) : (
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <ThermometerSun size={12} aria-hidden="true" />
                    Anomalía (hoy vs. lo normal): <span>sin referencia disponible</span>
                </p>
            )}
            {lluviaSemanaPct != null && <p data-testid="clima-anomalia-lluvia" className="mt-1 text-xs text-sky-200">Esta semana llueve {Math.abs(lluviaSemanaPct)} % {lluviaSemanaPct >= 0 ? 'sobre' : 'bajo'} lo normal para esta época.{faseFamily === 'nino' && lluviaSemanaPct > 0 ? ' El Niño suele reducir la lluvia en la temporada, pero esta semana viene más lluviosa de lo normal.' : ''}</p>}
            {lluviaMesPct != null && <p data-testid="clima-anomalia-lluvia-mes" className="mt-1 text-xs text-sky-200">En lo corrido del mes ha llovido {Math.abs(lluviaMesPct)} % {lluviaMesPct >= 0 ? 'sobre' : 'bajo'} lo esperado para estos días.</p>}
            <QueEsEsto titulo="¿Qué es la anomalía?" compai="colibri" testid="que-es-anomalia">
                Imagine que cada día del año tiene una temperatura "de costumbre", como su estatura normal para
                su edad. La <b>anomalía</b> es cuánto se salió el día de esa costumbre: si hace más calor o
                está más seco de lo que suele estar. Un solo día fuera de costumbre dice poco: lo que pesa es
                que se repita semana tras semana.
            </QueEsEsto>
        </div>
    );
}

/* Sin finca, el panel de cada pestaña dice qué mostrará cuando haya finca:
 * el mensaje y el botón siguen solo en la cabecera, una vez (W40), y tocar
 * otra pestaña cambia lo que se ve (W42, Q5 de la v18). */
const LO_QUE_VERA = {
    hoy: {
        titulo: 'Con la finca puesta, aquí verá cada día',
        filas: [
            [CloudRain, 'Si llueve hoy, a qué hora y cuánto.'],
            [Wind, 'Si puede aplicar y en qué horas, con el viento y las rachas.'],
            [Snowflake, 'Si hiela esta noche y qué hacer.'],
            [Clock, 'Las próximas 24 horas: lluvia, viento y temperatura.'],
        ],
    },
    semana: {
        titulo: 'Con la finca puesta, aquí verá los próximos 16 días',
        filas: [
            [CalendarClock, 'La lluvia y la temperatura de cada día.'],
            [ListChecks, 'Los próximos días buenos para aplicar.'],
            [AlertTriangle, 'Los avisos del pronóstico para su finca.'],
        ],
    },
};

function LoQueVera({ pestana }) {
    const v = LO_QUE_VERA[pestana];
    return (
        <section className="ca-carta cl-lo-que-vera" data-testid={`clima-lo-que-vera-${pestana}`}>
            <h3 className="cl-seccion-titulo">{v.titulo}</h3>
            <ul className="cl-lo-que-vera__lista">
                {v.filas.map((fila) => {
                    const [Icono, texto] = fila;
                    return <li key={texto}><Icono size={16} aria-hidden="true" /> <span>{texto}</span></li>;
                })}
            </ul>
        </section>
    );
}

/* ── HORIZONTE 1 · HOY ─────────────────────────────────────────────────────
   Tres respuestas y cuidados del lote, seguidos de cultivos y detalle.
   Las series, fichas, índices y fuentes se conservan dentro del detalle. */
function HorizonteHoy({ agrometeo, anom, lluviaSemanaPct, lluviaMesPct, cultivos, sinFicha, faseFamily, pendiente, onPerfil, arriba = null, detalleTiempo = null, procedencia = null, ubicacionConocida = true, riesgoSanitario = null, decisionAgua = null }) {
    const [etapa, setEtapa] = useState('');
    const [labor, setLabor] = useState('');
    const now = agrometeo?.now;
    const today = agrometeo?.today;
    const vpd = now ? vpdKpa(now.temp, now.rh) : null;
    const vpdL = leerVpd(vpd);
    const amplitud = today ? amplitudTermica(today.temp_max, today.temp_min) : null;
    const horasFrioHoy = Number.isFinite(today?.horas_frio) ? today.horas_frio : null;
    // SPI y SPEI de UN día no son índices de sequía (se definen sobre 1 a 12
    // meses): no se muestran, ni disfrazados.

    return (
        <section className="clima-seccion cl-pila" data-testid="horizonte-hoy">
            {!ubicacionConocida ? <LoQueVera pestana="hoy" /> : <>
            {arriba}
            {cultivos.length === 0 && (onPerfil ? (
                <button type="button" className="ca-carta cl-cultivos-vacio" onClick={onPerfil} data-testid="clima-agregar-cultivos">
                    <span className="cl-carta-enlace__icono"><Sprout size={18} aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1 text-left">
                        <span className="block text-sm font-bold">{MSG.clima.agregarCultivos}</span>
                        <span className="block cl-suave">para ajustar estos cuidados a su siembra</span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                </button>
            ) : <p className="ca-carta cl-cultivos-vacio text-sm">Diga en su perfil qué siembra y verá el clima de cada cultivo.</p>)}
            {/* Los cultivos conservan sus datos sin alargar la lectura inicial. */}
            {cultivos.length > 0 && (
                <details className="ca-carta cl-detalle" data-testid="clima-detalle-cultivos">
                    <summary><span>El clima para sus cultivos</span><span className="cl-suave">etapa y labor</span></summary>
                    <div className="mb-3 cl-sub" data-testid="clima-contexto-labor">
                        <p className="text-xs text-slate-400">Indique la etapa y la labor prevista. La sugerencia solo se confirma con una observación del lote.</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <label className="text-xs font-bold">
                                Etapa
                                <select value={etapa} onChange={(event) => setEtapa(event.target.value)} className="cl-select">
                                    <option value="">Seleccione</option><option value="establecimiento">Establecimiento</option><option value="crecimiento">Crecimiento</option><option value="floracion">Floración</option><option value="cosecha">Cosecha</option>
                                </select>
                            </label>
                            <label className="text-xs font-bold">
                                Labor prevista
                                <select value={labor} onChange={(event) => setLabor(event.target.value)} className="cl-select">
                                    <option value="">Seleccione</option><option value="riego">{LABOR_LABELS.riego}</option><option value="aplicacion">{LABOR_LABELS.aplicacion}</option><option value="siembra">{LABOR_LABELS.siembra}</option><option value="cosecha">{LABOR_LABELS.cosecha}</option>
                                </select>
                            </label>
                        </div>
                    </div>
                    <div className="space-y-3" data-testid="clima-cultivos">
                        {cultivos.map((ficha) => (
                            <CultivoTarjeta key={ficha.key} ficha={ficha} today={today} faseFamily={faseFamily} etapa={etapa} labor={labor} riesgoSanitario={riesgoSanitario} decisionAgua={decisionAgua} />
                        ))}
                        {sinFicha.length > 0 && (
                            <div className="cl-sub text-xs text-slate-400">
                                <p className="flex items-center gap-1.5">
                                    <Hourglass size={12} aria-hidden="true" />
                                    Aún sin ficha agroclimática para: <span className="text-slate-300">{sinFicha.join(', ')}</span>.
                                </p>
                                <p className="mt-1">Chagra no inventa sus números: los agrega cuando tengan fuentes verificadas.</p>
                            </div>
                        )}
                    </div>
                </details>
            )}

            <details className="ca-carta cl-detalle" data-testid="clima-detalle">
                <summary>
                    <span>El pronóstico en detalle</span>
                    <span className="cl-suave">horas, cifras y fuentes</span>
                </summary>
                <div className="cl-pila mt-3">
                    {detalleTiempo}
                    {now && <AnomaliaHoy anom={anom} lluviaSemanaPct={lluviaSemanaPct} lluviaMesPct={lluviaMesPct} faseFamily={faseFamily} />}
                    {now && (
                        <div className="cl-fichas" data-testid="clima-indices-hoy">
                            <IndiceTile icon={Waves} label="Agua que se evapora" valor={Number.isFinite(today?.eto_mm) ? today.eto_mm : null} unidad="mm" accent="emerald"
                                sub="lo que pierden hoy el suelo y las plantas">
                                <FuenteDato>Estimado por Chagra con datos de Open-Meteo.</FuenteDato>
                                <ParaTecnicos>ETo (evapotranspiración de referencia), calculada por Open-Meteo con el método FAO-56.</ParaTecnicos>
                                {/* compai NO-abeja (unificación 2026-08-23): la abeja es
                                    la del FAB. Borugo (cava y guarda agua) encaja con la ETo. */}
                                <QueEsEsto titulo="¿Qué es el agua que se evapora?" compai="borugo" testid="que-es-eto">
                                    Es cuánta agua se sube al cielo en un día de sol y viento, evaporándose del suelo y las plantas.
                                    Entre más sol y más viento, más "sed" tiene el aire. Sirve para saber cuánta agua reponerle a
                                    los cultivos.
                                </QueEsEsto>
                            </IndiceTile>

                            <IndiceTile icon={Gauge} label="Sed del aire" valor={vpd} accent={vpdL?.color || 'slate'}
                                sub={vpdL ? `${vpdL.texto.replace(' — ', ': ')}. Bajo 0,4 el aire está muy húmedo; sobre 1,6, seco.` : undefined}>
                                <FuenteDato>Estimado por Chagra con temperatura y humedad de Open-Meteo.</FuenteDato>
                                <ParaTecnicos>VPD (déficit de presión de vapor), en kPa (kilopascales): cuánto vapor de agua le falta al aire para saturarse.</ParaTecnicos>
                            </IndiceTile>

                            {/* Describe, no alarma: el aviso de helada sale solo de la regla de helada (W29, K6). */}
                            <IndiceTile icon={ThermometerSun} label="Del día a la noche" valor={amplitud} unidad="°C" accent="orange"
                                sub={amplitud != null ? `diferencia ${amplitud >= 12 ? 'grande' : 'moderada'} de hoy` : undefined}>
                                <FuenteDato>Estimado por Chagra · Open-Meteo (máx. − mín.)</FuenteDato>
                            </IndiceTile>

                            <IndiceTile testid="clima-indice-horas-frio" icon={ThermometerSun} label="Horas por debajo de 7 °C" valor={horasFrioHoy} unidad="h" accent="sky"
                                sub="en el día de hoy, de medianoche a medianoche">
                                <FuenteDato>Estimado por Chagra · serie horaria Open-Meteo</FuenteDato>
                            </IndiceTile>

                            <RachaSeca dias={agrometeo?.rachaDiasSecos} />
                        </div>
                    )}
                    <LecturasHidricas agrometeo={agrometeo} pendiente={pendiente} onDeclarar={onPerfil} />
                    {procedencia}
                </div>
            </details>
            </>}
        </section>
    );
}


function PlanRachaHumeda({ plan }) {
    return (
        <section className="ca-carta cl-plan-humedo" data-testid="clima-plan-racha-humeda" aria-label="Plan para días húmedos">
            <h3 className="cl-seccion-titulo">{plan.titulo}</h3>
            {plan.maximo && <p className="mb-2 text-sm font-semibold text-amber-300" data-testid="clima-maximo-lluvia">{plan.maximo}</p>}
            <p className="text-sm">{plan.plan}</p>
            <details className="cl-detalle mt-2">
                <summary>{plan.tituloDetalle}</summary>
                <p className="mt-2 text-sm font-semibold" data-testid="clima-primera-ventana-humeda">{plan.primeraVentana}</p>
                {plan.notas.map((nota) => <p key={nota} className="mt-1 text-xs text-slate-400">{nota}</p>)}
            </details>
        </section>
    );
}

/* ── HORIZONTE 2 · 7–16 DÍAS ───────────────────────────────────────────── */

function VentanaLabor({ ventanas, onCondiciones }) {
    // Las frases salen del módulo de respuestas: el mismo motor horario de «¿Aplico?».
    const { aplicar, secar } = ventanas;
    return (
        <div className="grid grid-cols-2 gap-2.5" data-testid="clima-ventanas-labor">
            <div className="ca-carta" data-testid="clima-ventana-aplicar">
                <p className="cl-etiqueta"><Leaf size={13} aria-hidden="true" /> {aplicar.titulo}</p>
                <p className="mt-1 text-sm font-bold text-slate-100">{aplicar.respuesta}</p>
                <p className="text-xs text-slate-400 leading-tight mt-0.5">
                    {horasJuntas(aplicar.texto)}
                </p>
                <button type="button" className="min-h-11 text-xs underline text-left" onClick={onCondiciones}>
                    Ver condiciones en Hoy
                </button>
            </div>
            <div className="ca-carta">
                <p className="cl-etiqueta"><Sun size={13} aria-hidden="true" /> {secar.titulo}</p>
                <p className="mt-1 text-sm font-bold text-slate-100">{secar.respuesta}</p>
                <p className="text-xs text-slate-400 leading-tight mt-0.5">{secar.texto}</p>
            </div>
        </div>
    );
}

function HorizonteSemana({ agrometeo, alertas, snapshot, vistazo, onCondiciones, ubicacionConocida = true, ubicacionPorConfirmar = false }) {
    // Una sola vista, desde HOY (el servicio trae ayer en el índice 0).
    const dias = useMemo(() => diasDesdeHoy(agrometeo), [agrometeo]);
    const graf = useMemo(() => dias.map((d) => ({
        dia: d.date, tempMax: d.temp_max, tempMin: d.temp_min, lluviaMm: d.precip_mm, prob: d.precip_prob, weathercode: d.weathercode,
    })), [dias]);

    // El resumen, el plan y las ventanas salen del módulo de respuestas (W47).
    const resumen = ubicacionConocida
        ? (vistazo?.resumen ?? '')
        : ubicacionPorConfirmar
            ? 'Confirme el municipio y la altitud de su finca para consultar su pronóstico.'
            : '';
    return (
        <section className="clima-seccion space-y-4" data-testid="horizonte-semana">
            {resumen && <AccionesBoletin texto={resumen} onRead={() => speak(resumen)} />}
            {/* Sin finca lo dice la portada, igual en las tres pestañas (W40, J8 de la v17). */}
            {!ubicacionConocida && ubicacionPorConfirmar ? (
                <div className="ca-carta text-sm" data-testid="clima-ubicacion-pendiente-semana">
                    <p className="font-bold">Aún sin pronóstico de la finca.</p>
                    <p className="mt-1">Confirme el municipio y la altitud de su finca antes de consultar el pronóstico.</p>
                </div>
            ) : !ubicacionConocida ? <LoQueVera pestana="semana" /> : dias.length === 0 ? (
                <div className="ca-carta text-sm">
                    Aún sin pronóstico de la finca.
                </div>
            ) : (
                <>
                    {/* Alertas locales del snapshot */}
                    {alertas && alertas.length > 0 && (
                        <div className="space-y-2" data-testid="clima-alertas">
                            {alertas.slice(0, 4).map((a, i) => (
                                <div key={`${a.tipo}-${i}`} className="ca-carta cl-alerta" data-severidad={a.severity || 'info'}>
                                    <p className="text-sm font-bold leading-snug">{horasJuntas(a.mensaje)}</p>
                                    {Array.isArray(a.dias) && a.dias.length > 0 && (
                                        <p className="text-xs opacity-80 mt-0.5">Días: {a.dias.join(', ')}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {vistazo.planRachaHumeda && <PlanRachaHumeda plan={vistazo.planRachaHumeda} />}
                    {/* Ventanas de labor */}
                    <VentanaLabor ventanas={vistazo.ventanas} onCondiciones={onCondiciones} />

                    {/* LA vista de los próximos días: empieza hoy y lo marca */}
                    <div className="ca-carta" data-testid="clima-semana-vista">
                        <h3 className="cl-seccion-titulo">Desde hoy · {dias.length} días</h3>
                        <GraficoClimaSemanal datos={graf} hoy={agrometeo?.today?.date} />
                        <p className="mt-2 text-xs leading-snug text-slate-400" data-testid="clima-fuente-semana">
                            Open-Meteo.
                            {' '}{snapshot?.station?.name || snapshot?.estacion?.name
                                ? `Estación IDEAM: ${snapshot.station?.name || snapshot.estacion.name}.`
                                : 'Sin observación de estación IDEAM.'}
                            {' '}Probabilidad hasta el día 3; sombreado: menor certeza.
                        </p>
                    </div>

                    {/* Contraste con la fuente oficial: BSA del IDEAM (semanal, lunes) */}
                    <a href={FUENTES_VIVAS.ideam_bsa_semanal} target="_blank" rel="noopener noreferrer" data-testid="clima-bsa-link"
                        className="ca-carta cl-carta-enlace">
                        <span aria-hidden="true" className="shrink-0 w-9 h-9 rounded-xl bg-sky-500/15 grid place-items-center"><Radio size={18} className="text-sky-300" /></span>
                        <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold text-slate-100 leading-tight">Contraste con el IDEAM oficial</span>
                            <span className="block text-xs leading-snug text-slate-300 mt-0.5">Boletín Semanal para el Sector Agrícola (BSA), por departamento. Se publica los lunes.</span>
                        </span>
                        <ExternalLink size={16} className="shrink-0 text-slate-500 mt-0.5" aria-hidden="true" />
                    </a>
                </>
            )}
        </section>
    );
}

/* Los datos de preparación traen un emoji por tarea; la interfaz pinta un
 * ícono de lucide en su lugar (ningún emoji en pantalla). */
const ICONO_TAREA = {
    '💧': Droplets, '🌾': Wheat, '🌱': Sprout, '🔥': Flame, '❄️': Snowflake, '📻': Radio,
    '🚰': Waves, '🛏️': BedDouble, '🍄': Bug, '⛰️': Mountain, '🗓️': CalendarClock,
};
const sinSelector = (texto) => String(texto || '').replace(/\uFE0F/g, '');
const ICONO_TAREA_NORMAL = Object.fromEntries(Object.entries(ICONO_TAREA).map(([k, v]) => [sinSelector(k), v]));
function iconoDeTarea(emoji) {
    return ICONO_TAREA_NORMAL[sinSelector(emoji)] || ListChecks;
}

/* ── HORIZONTE 3 · EL NIÑO (estacional) ────────────────────────────────── */
/* Calendario de referencia, separado de los porcentajes recibidos.
   «Ahora» identifica el mes de consulta, no confirma una fase. */
const CAL_ACENTO = {
    nino: { dot: 'bg-amber-400', text: 'text-amber-200', border: 'border-amber-500/40' },
    neutral: { dot: 'bg-emerald-400', text: 'text-emerald-200', border: 'border-emerald-600/40' },
};

function EnsoTimeline({ snapshot }) {
    const ahora = faseCalendarioActual();
    const actual = probabilidadesEnsoSnapshot(snapshot);
    const fuente = actual?.fuente.replace(/\bsnapshot\b/gi, 'dato recibido');
    const etiquetaFecha = actual?.etiquetaFecha.replace(/\bsnapshot\b/gi, 'dato');
    return (
        <div className="ca-carta" data-testid="clima-enso-timeline">
            <p className="cl-seccion-titulo">
                <CalendarClock size={15} aria-hidden="true" /> El Niño, mes a mes
            </p>
            <p className="mt-1 text-xs leading-snug text-slate-500">
                Calendario de referencia 2026–2027, no un pronóstico actualizado. Las acciones corresponden al piso frío andino; confirme el boletín antes de decidir.
            </p>

            <div className="mt-2 cl-sub" data-testid="clima-enso-probabilidades">
                <p className="text-sm font-bold text-slate-100">Probabilidades ENSO vigentes (El Niño y la Oscilación del Sur)</p>
                {actual ? (
                    <>
                        <p className="mt-1 text-sm text-slate-200">
                            El Niño {actual.probabilidades.nino_pct}% · Neutral {actual.probabilidades.neutral_pct}% · La Niña {actual.probabilidades.nina_pct}%
                        </p>
                        <p className="mt-1 text-xs text-slate-400">{fuente} · {etiquetaFecha} {fechaSnapshot(actual.fecha) || 'fecha no disponible'}</p>
                    </>
                ) : (
                    <p className="mt-1 text-xs text-slate-400">No hay probabilidades ENSO vigentes (El Niño y la Oscilación del Sur). No se muestran cifras anteriores.</p>
                )}
            </div>

            <ol className="mt-3 space-y-3">
                {ENSO_CALENDARIO_2026_27.map((p) => {
                    const ac = CAL_ACENTO[p.fase] || CAL_ACENTO.nino;
                    const esAhora = p.id === ahora;
                    return (
                        <li key={p.id} data-testid={`enso-cal-${p.id}`}
                            className="relative cl-sub pl-5" data-ahora={esAhora ? 'si' : undefined}>
                            <span aria-hidden="true" className={`absolute left-1.5 top-4 h-2 w-2 rounded-full ${ac.dot}`} />
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-bold ${ac.text}`}>{p.periodo}</span>
                                <span className="text-sm font-bold text-slate-100">· {p.titulo}</span>
                                {esAhora && <span data-testid="enso-cal-ahora" className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-200">Ahora</span>}
                            </div>
                            <p className="mt-1 text-sm leading-relaxed text-slate-200">{p.narrativa}</p>

                            {/* Acción por cultivo (piso frío andino) */}
                            <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-emerald-200/90">
                                <Sprout size={13} className="shrink-0 mt-0.5 text-emerald-300" aria-hidden="true" />
                                <span>{p.accionCultivo}</span>
                            </p>
                        </li>
                    );
                })}
            </ol>

            {/* Cuándo se alivia + fuente viva */}
            <div className="mt-3 cl-sub" data-testid="clima-enso-alivio">
                <p className="text-sm leading-relaxed text-slate-200">
                    <b className="text-amber-200">Pico de referencia:</b> {ENSO_TRANSICION.pico}. <b className="text-emerald-200">Alivio planteado:</b> desde {ENSO_TRANSICION.aliviaDesde},
                    con transición a Neutral hacia {ENSO_TRANSICION.transicionNeutral}. Verifique si ese escenario sigue vigente antes de actuar.
                </p>
                <FuenteDato>{ENSO_TRANSICION.fuente}</FuenteDato>
                <a href={FUENTES_VIVAS.noaa_enso_disc} target="_blank" rel="noopener noreferrer" data-testid="clima-enso-live-link"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-sky-300 active:text-sky-200">
                    <ExternalLink size={12} aria-hidden="true" /> Ver el pronóstico ENSO vigente (El Niño y la Oscilación del Sur, NOAA CPC / IDEAM)
                </a>
            </div>
        </div>
    );
}

/* Ventana de siembra MTA región Andina: deflección honesta (patrón SIPSA). la
   ventana vigente se lee del boletín en vivo, no se inventa. */
function MtaVentanaSiembra() {
    const v = MTA_VENTANA_SIEMBRA;
    const pendiente = v.ventanaVigente?.estado === ESTADO_GROUNDED_PENDIENTE;
    return (
        <div className="ca-carta" data-testid="clima-mta-ventana">
            <p className="cl-seccion-titulo">
                <Sprout size={15} aria-hidden="true" /> Ventana de siembra · región Andina
            </p>
            <p className="mt-1 text-xs text-slate-400">{v.zona}</p>

            <p className="mt-2 text-sm leading-relaxed text-slate-200">{v.regimenBimodal}</p>
            <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-relaxed text-amber-200/90">
                <Sparkles size={13} className="shrink-0 mt-0.5 text-amber-300" aria-hidden="true" />
                <span>{v.matizEnso}</span>
            </p>

            {/* Deflección honesta: la ventana vigente NO se inventa */}
            {pendiente && (
                <div className="mt-2.5 flex items-start gap-2 cl-sub" data-testid="clima-mta-ventana-pendiente">
                    <Hourglass size={14} className="shrink-0 mt-0.5 text-amber-300" aria-hidden="true" />
                    <p className="text-xs leading-snug text-slate-300">
                        La fecha exacta de siembra vigente para su zona la fija el <b className="text-slate-100">Boletín MTA región Andina</b>. Revise la fecha de publicación y el período que cubre antes de usarla.
                    </p>
                </div>
            )}

            {/* Enlace al boletín MTA EN VIVO */}
            <a href={v.urlVivo} target="_blank" rel="noopener noreferrer" data-testid="clima-mta-ventana-live"
                className="mt-2.5 cl-enlace">
                <BookOpenText size={15} aria-hidden="true" /> Consultar los boletines MTA región Andina
                <ExternalLink size={14} className="ml-auto shrink-0" aria-hidden="true" />
            </a>

            {/* Fechas conocidas de boletines, con la antigüedad declarada */}
            <details className="mt-2.5 group">
                <summary className="cursor-pointer list-none text-xs font-bold text-slate-400 flex items-center gap-1.5">
                    <BookOpenText size={12} aria-hidden="true" /> Fechas conocidas de los boletines
                </summary>
                <ul className="mt-2 space-y-1.5" data-testid="clima-mta-productos">
                    {v.productos.map((prod) => (
                        <li key={prod.nombre}>
                            <a href={prod.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs leading-snug text-slate-300 active:text-slate-100">
                                <ExternalLink size={11} className="shrink-0 text-slate-500" aria-hidden="true" />
                                <span><span className="text-slate-200">{prod.nombre}</span>. {fechaBoletin(prod.ultima)}</span>
                            </a>
                        </li>
                    ))}
                </ul>
            </details>

            <p className="mt-2 text-xs text-slate-500">Fuente: {v.emisor} · {v.cadencia}</p>
        </div>
    );
}

function HorizonteEstacional({ onPronostico, piso, faseFamily, faseLabel, source, cachedAt, region, mtaRegional, onNavigate, snapshot, tienePapa, condicion }) {
    const faseConocida = faseFamily != null;
    const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        return () => {
            window.removeEventListener('online', update);
            window.removeEventListener('offline', update);
        };
    }, []);
    // La fase, su fuente, qué significa y la regla salen del módulo de respuestas (W47).
    const temporada = vistazoTemporada({
        enso: faseFamily, faseLabel, faseFuente: source, faseCopiaDel: cachedAt, sinConexion: !online,
        piso, region, tienePapa,
    });
    const pisoFrio = piso === 'frio' || piso === 'paramo';
    const suPiso = suPisoTexto(piso);
    const checklist = faseConocida ? checklistPreparacion(faseFamily, piso) : [];
    const acento = FASE_ACENTO[faseFamily] || FASE_ACENTO.neutral;
    // La fase encabeza la lectura; el índice del océano y su fuente
    // se consultan dentro de «Ver más».
    const cultivosFenalce = FENALCE_CULTIVOS_POR_PISO[piso] || [];

    return (
        <section className="clima-seccion space-y-4" data-testid="horizonte-estacional">
            {/* LO PRIMERO, EN TRES LÍNEAS (CLIMA-R7): fase con el ONI, qué significa
                para esta finca y una acción. Todo lo demás se pliega en «Ver más». */}
            <div className="ca-carta" data-testid="clima-elnino-resumen">
                <p className={`text-xl font-bold leading-tight ${acento.text}`} data-testid="clima-linea-fase"><span data-testid="clima-fase-label">{temporada.rotulo}</span></p>
                <div className="mt-2"><FuenteFase fuente={temporada.fuente} /></div>
                <p className="mt-1 text-sm leading-relaxed text-slate-200"
                    data-testid={temporada.lineaRegional ? 'clima-region-linea' : 'clima-linea-significado'}>
                    {temporada.significado.texto}
                </p>
                {temporada.boletin && <div className="mt-3">
                    <a href={temporada.boletin.url}
                        target="_blank" rel="noopener noreferrer" data-testid="clima-boletin-directo"
                        className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-sky-200 underline underline-offset-4">
                        {temporada.boletin.texto}
                        <ExternalLink size={16} aria-hidden="true" />
                    </a>
                    <p className="text-xs text-slate-300">{temporada.boletin.nota}</p>
                </div>}
                <p className={`mt-2 text-base font-bold leading-snug ${acento.text}`} data-testid="clima-regla-insignia">{temporada.regla}</p>
            </div>

            <details className="ca-carta cl-detalle" data-testid="clima-elnino-ver-mas">
                <summary>
                    <span>Entender la temporada</span>
                    <span className="cl-suave">{faseConocida ? 'la lección, el mes a mes, los boletines y las fuentes' : 'los boletines y las fuentes'}</span>
                </summary>
                <div className="mt-3 space-y-4">
                    {faseConocida && <CieloENSO family={faseFamily} piso={piso} onNavigate={onNavigate} onPronostico={onPronostico} />}
                    {/* Procedencia de la selección o del dato recibido. */}
                    <div className="rounded-2xl border p-3.5" style={{ borderColor: 'var(--cl-borde)', background: 'var(--cl-vidrio)' }}>
                        <p className="cl-etiqueta">Procedencia de la fase</p>
                        <OniObservado snapshot={snapshot} />
                        {faseConocida && <p className="mt-3 text-sm font-bold text-slate-100">{temporada.titulo}</p>}
                        <p className="mt-2 text-xs italic text-slate-500" data-testid="clima-fase-fuente">{temporada.procedencia}</p>
                    </div>

                    {faseConocida && <div>
                        {faseFamily === 'nino' && condicion && condicion !== 'despejado' && (
                            <p className="text-xs" data-testid="clima-enso-puente">
                                Hoy está {condicion === 'lluvia' ? 'lloviendo' : condicion === 'niebla' ? 'con niebla' : condicion === 'parcial' ? 'parcialmente nublado' : condicion}. Esta lección es para las noches despejadas de la temporada.
                            </p>
                        )}
                        <details className="cl-detalle">
                            <summary><span>¿Cómo influyen las nubes en una helada?</span></summary>
                            <ComparacionGuiada piso={piso} />
                        </details>
                    </div>}

                    {/* El Niño 2026–27: probabilidades vigentes del snapshot + checklist.
                        UNA sola ventana de pico (CLIMA-R7): la de ENSO_TRANSICION, citada abajo. */}
                    {faseFamily === 'nino' && <div className="ca-carta" data-testid="clima-elnino-2027">
                        <p className="cl-seccion-titulo">
                            <Sparkles size={15} aria-hidden="true" /> Preparación para El Niño
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-200">
                            Las recomendaciones siguientes sirven para prepararse ante esta fase. No confirman cómo será el tiempo en su finca.
                            {probabilidadesEnsoSnapshot(snapshot) && ' Las probabilidades recibidas se muestran en el calendario.'}
                        </p>
                        <div className="mt-2 flex gap-2.5 cl-sub">
                            <CompaiAvatar compai="zariguya" size={40} />
                            <p className="text-xs leading-relaxed text-slate-200">
                                <span className="font-bold text-amber-200/90">Doña Zarigüeya:</span> "El mar Pacífico es como una
                                olla de sopa caliente que cambia el aire que nos llega. {pisoFrio
                                    ? `En ${suPiso}, las nubes son la cobija nocturna del cultivo.`
                                    : suPiso ? `Para ${suPiso}, consulte la lluvia prevista y la reserva de agua de su finca.`
                                        : 'En tierra fría, las nubes son la cobija nocturna del cultivo.'}"
                            </p>
                        </div>
                    </div>}

                    {/* Timeline ENSO mes a mes con probabilidades del snapshot */}
                    {faseConocida && <EnsoTimeline snapshot={snapshot} />}

                    {/* La regla insignia ya está arriba (línea 3); aquí la preparación */}
                    {faseConocida && checklist.length > 0 && <div>
                        <h3 className="cl-seccion-titulo">Para prepararse</h3>
                        <div className="ca-carta cl-pila-apretada" data-testid="clima-checklist">
                            {checklist.map((c) => {
                                const IconoTarea = iconoDeTarea(c.emoji);
                                return (
                                <div key={c.t} className="flex gap-3">
                                    <span aria-hidden="true" className="cl-carta-enlace__icono"><IconoTarea size={18} /></span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-100 leading-tight">{c.t}</p>
                                        <p className="text-xs leading-snug text-slate-300 mt-0.5">{c.d}</p>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>}

                    {/* Boletines oficiales (IDEAM manda) */}
                    <div className="grid gap-2.5">
                        {BOLETINES_IDEAM.map((b) => (
                            <a key={b.id} href={b.url} target="_blank" rel="noopener noreferrer" data-testid={`boletin-${b.id}`}
                                className="ca-carta cl-carta-enlace">
                                <span aria-hidden="true" className="shrink-0 w-9 h-9 rounded-xl bg-sky-500/15 grid place-items-center"><BookOpenText size={18} className="text-sky-300" /></span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-sm font-bold text-slate-100 leading-snug">{b.nombre}</span>
                                    <span className="block text-xs font-bold text-slate-400 mt-0.5">Frecuencia: {b.frecuencia}</span>
                                    <span className="block text-xs leading-snug text-slate-300 mt-0.5">{b.para}</span>
                                    <span className="block text-xs text-slate-500 mt-1">{b.emisor}</span>
                                </span>
                                <ExternalLink size={16} className="shrink-0 text-slate-500 mt-0.5" aria-hidden="true" />
                            </a>
                        ))}
                    </div>

                    {/* MTA regional */}
                    <div className="ca-carta" data-testid="clima-mta">
                        <p className="cl-seccion-titulo"><Compass size={15} aria-hidden="true" /> {MTA_INFO.titulo}</p>
                        <p className="text-sm leading-relaxed text-slate-200">{MTA_INFO.descripcion}</p>
                        {mtaRegional && (
                            <p className="mt-2 text-sm text-emerald-200" data-testid="clima-mta-regional">
                                Busque el <strong>Boletín Agroclimático</strong> de la <strong>{mtaRegional}</strong>: ahí está la ventana de siembra para su zona.
                            </p>
                        )}
                    </div>

                    {/* Ventana de siembra MTA región Andina (deflección honesta + link vivo) */}
                    {faseFamily === 'nino' && <MtaVentanaSiembra />}

                    {/* Fenalce */}
                    <a href={FENALCE_INFO.url} target="_blank" rel="noopener noreferrer" data-testid="clima-fenalce"
                        className="ca-carta cl-carta-enlace">
                        <span aria-hidden="true" className="cl-carta-enlace__icono"><Wheat size={18} /></span>
                        <span className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-slate-100 leading-tight">{FENALCE_INFO.titulo}</span>
                            <span className="block text-xs leading-snug text-slate-300 mt-0.5">{cultivosFenalce.length > 0 ? `Si siembra ${cultivosFenalce.join(' o ')}, consulte el boletín de su región y compruebe su vigencia.` : FENALCE_INFO.descripcion}</span>
                        </span>
                        <ExternalLink size={16} className="shrink-0 text-slate-500 mt-0.5" aria-hidden="true" />
                    </a>

                    {/* Puente al agente */}
                    {typeof onNavigate === 'function' && (
                        <button type="button" data-testid="clima-preguntar-agente"
                            onClick={() => onNavigate('agente', { prefilledPrompt: '¿Qué información necesito para decidir qué sembrar en mi finca?' })}
                            className="ca-carta cl-carta-enlace w-full text-left">
                            <span aria-hidden="true" className="shrink-0 w-10 h-10 rounded-xl bg-sky-500/15 grid place-items-center"><CloudSun size={20} className="text-sky-300" /></span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-sm font-bold text-slate-100 leading-tight">¿Y en su finca?</span>
                                <span className="block text-xs text-slate-400 leading-tight mt-0.5">Pregúntele al agente qué información de su finca falta para planear la siembra.</span>
                            </span>
                        </button>
                    )}
                </div>
            </details>
        </section>
    );
}

/* La Sierra es una salida secundaria, al final: la portada ya dice la altura y
 * el piso. Sin altitud, en cambio, completar la ubicación sí es la acción. */
function ContextoPisoFinca({ piso, onComplete }) {
    if (piso) return null;
    return (
        <aside className="ca-carta clima-piso-contexto--pendiente" data-testid="clima-piso-sin-altitud">
            <h2 className="cl-seccion-titulo">Todavía no conocemos la altitud de su finca</h2>
            <p className="text-sm">
                Complete ese dato para abrir el pronóstico en su piso térmico. No mostraremos una cifra estimada.
            </p>
            <button type="button" className="cl-boton mt-3" onClick={onComplete} data-testid="clima-completar-altitud">
                <MapPin size={16} aria-hidden="true" /> Completar ubicación de la finca
            </button>
        </aside>
    );
}

/* Salidas secundarias, al final: la Sierra (solo con piso conocido) y el 3D.
   El espacio duro ata la última palabra: ni «3D» ni «mapa» quedan solas. */
function SalidasClima({ piso, onExplore, onMundo3d }) {
    return (
        <nav className="cl-salidas" aria-label="Más sobre el clima" data-testid="clima-salidas">
            {piso && (
                <button type="button" className="cl-salida" onClick={onExplore} data-testid="clima-explorar-sierra">
                    Ver el clima de su zona en el{'\u00a0'}mapa
                </button>
            )}
            <button type="button" className="cl-salida" onClick={onMundo3d} data-testid="clima-ver-mundo3d">
                Ver el mundo del clima en{'\u00a0'}3D
            </button>
        </nav>
    );
}

/* ── PORTADA · lo primero que se ve ─────────────────────────────────────
   Cielo, lugar, la cifra de ahora, máxima y mínima de hoy, la frase del día
   y UNA sola frescura (la del pronóstico que rige estas cifras). El resto
   —procedencia y snapshot del servidor— se abre con un toque. Leer en voz
   alta y compartir quedan a la vista, junto al veredicto. */
const PISO_NOMBRE = { calido: 'cálido', templado: 'templado', frio: 'frío', paramo: 'páramo' };
const CONDICION_TEXTO = { ...CONDICION_LABEL, tormenta: 'Tormenta', helada: 'Helada' };
/** Cielos que tapan el disco del sol o de la luna en la portada. */
const CIELO_SIN_ASTRO = new Set(['nublado', 'niebla', 'lluvia', 'tormenta']);

function textoFrescura(f) {
    return sinPuntoDoble(textoFrescuraCrudo(f));
}

function textoFrescuraCrudo(f) {
    if (!f || f.estado === 'sin-dato') return MSG.clima.frescuraSinDato;
    if (f.estado === 'sin-hora') return MSG.clima.frescuraSinHora;
    if (f.estado === 'vencido' && f.motivo === 'sin-red') return MSG.format(MSG.clima.frescuraSinRed, { hora: f.hora || 'sin fecha' });
    if (f.estado === 'vencido') return MSG.format(MSG.clima.frescuraVieja, { hora: f.hora });
    return MSG.format(MSG.clima.frescuraFresca, { hora: f.hora });
}

function Portada({ location, locationConfirmada = true, piso, agrometeo, loading, condicion, frescura, titular, astro, onRefresh, onCompleteLocation, fincaNombre = null }) {
    const now = agrometeo?.now;
    const today = agrometeo?.today;
    // Con dos fincas en el mismo municipio, la vereda (si la hay) no basta
    // para distinguirlas: el nombre de la finca activa manda (STEV-05).
    const lugar = locationConfirmada
        ? ([fincaNombre || location?.vereda, location?.municipio].filter(Boolean).join(' · ') || 'Su finca')
        : location?.municipio ? `Municipio por confirmar: ${location.municipio}` : 'Su finca';
    return (
        <section className="cl-portada" data-testid="clima-ahora">
            <header className="cl-lugar" data-testid="clima-cabecera">
                <p className="cl-lugar__nombre"><MapPin size={14} aria-hidden="true" /> {lugar}{location?.precision === 'centroid' ? ' · aprox.' : ''}</p>
                <p className="cl-lugar__alto">
                    {locationConfirmada && Number.isFinite(location?.elevation)
                        ? `${Math.round(location.elevation)} m s. n. m.${piso ? ` · Piso ${PISO_NOMBRE[piso.id]}` : ''}`
                        : 'Elevación no disponible'}
                </p>
            </header>
            {!now && loading && (
                <p className="cl-portada__espera"><RefreshCw size={16} className="animate-spin" aria-hidden="true" /> Leyendo el cielo de su finca…</p>
            )}
            {!now && !loading && (
                <div className="cl-portada__espera">
                    <p>{location && !locationConfirmada ? 'Aún sin pronóstico de la finca.' : 'Aún no tenemos el tiempo de su finca.'}</p>
                    <p className="cl-suave">
                        {location && !locationConfirmada
                            ? 'Confirme el municipio y la altitud de su finca para consultar el pronóstico.'
                            : 'Complete la ubicación para consultar el pronóstico.'}
                    </p>
                    <button type="button" className="cl-boton mt-3" onClick={onCompleteLocation} data-testid="clima-completar-ubicacion">
                        <MapPin size={16} aria-hidden="true" />
                        {location && !locationConfirmada ? MSG.clima.confirmarMunicipioAltitud : 'Completar ubicación de la finca'}
                    </button>
                </div>
            )}
            {now && (
                <div className="cl-cifra">
                    {Number.isFinite(now.temp) ? <Numeral valor={Math.round(now.temp)} /> : <span className="cl-suave">sin dato</span>}
                    <div className="cl-cifra__lado">
                        <p className="cl-cifra__condicion">{CONDICION_TEXTO[condicion] || 'Cielo sin dato'}</p>
                        <p className="cl-cifra__rango">
                            <span>Máx. {Number.isFinite(today?.temp_max) ? `${cifra(today.temp_max, 0)}°` : 'sin dato'}</span>
                            <span>Mín. hoy {Number.isFinite(today?.temp_min) ? `${cifra(today.temp_min, 1)}°` : 'sin dato'}</span>
                        </p>
                        {Number.isFinite(now.aparente) && Math.round(now.aparente) !== Math.round(now.temp)
                            && <p className="cl-suave" data-testid="clima-sensacion">Se siente como {Math.round(now.aparente)} °C</p>}
                    </div>
                </div>
            )}
            {titular && <h2 className="cl-titular" data-testid="clima-titular">{horasJuntas(titular.texto)}</h2>}
            {/* El astro de ahora (sol o luna de hoy) es de la portada, no del fondo:
                entero, a la izquierda de «Actualizar» y dentro de su caja. Sigue al
                cielo que dice la portada: velado con parcialmente nublado y sin
                disco con nublado, niebla, lluvia o tormenta (W30-r3). */}
            {now && astro?.luz && !CIELO_SIN_ASTRO.has(condicion) && (
                <span className="cl-astro" data-testid="portada-astro" aria-hidden="true"
                    data-astro={astro.luna ? 'luna' : 'sol'} data-luz={astro.luz} data-velo={condicion === 'parcial' ? 'velado' : undefined}>
                    {astro.luna ? <Luna luna={astro.luna} className="cl-astro__luna" testId="portada-luna" /> : <span className="cl-astro__sol" />}
                </span>
            )}
            {now && <p className="cl-frescura" data-testid="clima-frescura" data-estado={frescura?.estado}>
                <span>{textoFrescura(frescura).replace(/(\d+(?::\d+)?) ([ap])\. m\./g, '$1\u00a0$2.\u00a0m.')}</span>
                <button type="button" onClick={onRefresh} aria-label="Actualizar pronóstico" className="cl-frescura__boton">
                    <RefreshCw size={14} aria-hidden="true" />
                </button>
            </p>}
        </section>
    );
}

const NIVEL_ICONO = { peligro: AlertTriangle, aviso: AlertCircle, bien: Check, info: Info, 'sin-dato': HelpCircle };
/* Lo informativo dice su estado, no una «i»: llueve poco, se aplica mañana, hay que regar (W44, Apple de la v19). */
const ICONO_INFO = { lluvia: CloudRain, aplicar: Clock, riego: Droplets };

/* Tres respuestas de lectura inmediata. Las frases salen del módulo de
 * respuestas del día (respuestasDelDia.js); aquí solo se pintan, con la
 * evidencia completa disponible al abrir. */
const CLASE_DETALLE = { estacion: 'cl-veredicto__porque', porque: 'cl-veredicto__porque', margen: 'cl-veredicto__porque', accion: 'cl-veredicto__porque', regla: 'cl-veredicto__porque', contexto: 'cl-veredicto__contexto' };
function FilaDecisionHoy({ frases: f, abrirCondiciones = false }) {
    const Icono = (f.nivel === 'info' && ICONO_INFO[f.id]) || NIVEL_ICONO[f.nivel] || Info;
    const detalle = useRef(null);
    useEffect(() => {
        if (!abrirCondiciones || !detalle.current) return;
        detalle.current.open = true;
        detalle.current.querySelector('summary')?.focus();
        detalle.current.scrollIntoView?.({ block: 'center' });
    }, [abrirCondiciones]);
    return (
        <div className="cl-veredicto__fila" data-nivel={f.nivel} data-testid={`veredicto-${f.id}`}>
            <span className="cl-veredicto__marca" aria-hidden="true"><Icono size={18} /></span>
            <div className="min-w-0">
                <p className="cl-veredicto__cabeza">
                    <span className="cl-veredicto__pregunta">{f.pregunta}</span>
                    <strong className="cl-veredicto__respuesta">{horasJuntas(f.respuesta)}</strong>
                </p>
                {f.confirmar && <p className="cl-veredicto__accion">{f.confirmar}</p>}
                {f.franjaJusta && <p className="cl-veredicto__salvedad">{f.franjaJusta}</p>}
                {f.accion && <p className="cl-veredicto__accion">{horasJuntas(f.accion)}</p>}
                {f.salvedad && <p className="cl-veredicto__salvedad" data-testid={`veredicto-${f.id}-salvedad`}>{horasJuntas(f.salvedad)}</p>}
                <details ref={detalle} className="cl-veredicto__mas">
                    <summary>{f.tituloDetalle}</summary>
                    {f.detalle.map((l, i) => (
                        <p key={l.tipo === 'porque' ? l.texto ?? i : l.tipo} className={CLASE_DETALLE[l.tipo]}
                            data-testid={l.tipo === 'estacion' ? 'clima-estacion-anoche' : l.tipo === 'regla' ? `veredicto-${f.id}-regla` : undefined}>
                            {l.tipo === 'margen' && l.prefijo}{horasJuntas(l.texto)}
                        </p>
                    ))}
                    {f.metodo && (
                        <details className="cl-detalle mt-3">
                            <summary><span>{f.metodo.titulo}</span></summary>
                            <p data-testid="clima-lluvia-metodo" className="mt-3 text-xs cl-suave">{f.metodo.texto}</p>
                        </details>
                    )}
                </details>
            </div>
        </div>
    );
}

function VeredictoDia({ respuestas, piso = null, cultivos = null, children = null, abrirCondiciones = false }) {
    const veredicto = respuestas?.veredicto;
    if (!veredicto) return null;
    const sanitario = veredicto.filas.find((f) => f.id === 'hongos');
    const sanitarioUrgente = sanitario?.nivel === 'peligro';
    const avisoSanitario = sanitario && <AvisoSanitarioPiso riesgo={sanitario.sanitario} piso={piso} cultivos={cultivos} deNoche={sanitario.deNoche} />;
    return (
        <section className="ca-carta cl-veredicto" data-testid="clima-veredicto" aria-label="Decisiones para hoy">
            <div className="cl-hoy-respuestas" data-testid="clima-tres-respuestas">
                {respuestas.principales.map((f) => <FilaDecisionHoy key={f.id} frases={f} abrirCondiciones={f.id === 'aplicar' && abrirCondiciones} />)}
            </div>
            {sanitarioUrgente && avisoSanitario}
            <details className="cl-detalle cl-hoy-cuidados" data-testid="clima-cuidados">
                <summary><span>Cuidados del lote</span><span className="cl-suave">riego y sanidad</span></summary>
                <div className="cl-pila mt-3">
                    {!sanitarioUrgente && avisoSanitario}
                    {respuestas.riego && <FilaDecisionHoy frases={respuestas.riego} />}
                    {children}
                </div>
            </details>
            <FuenteDato>Pronóstico de Open-Meteo. Confírmelo en el lote.</FuenteDato>
        </section>
    );
}

/* Curva de temperatura de las próximas 24 horas, de la serie horaria que
 * agroMeteoService entrega en `temperatura24h` ({ hora, t_c }). Se recorta
 * desde la hora vigente: la serie se calcula al consultar y puede tener horas
 * que ya pasaron. Sin serie no se dibuja nada inventado. */
function CurvaTemperatura24h({ serie, ahoraMs, offsetSeg, eje = null }) {
    const puntos = useMemo(() => {
        if (!Array.isArray(serie) || !Number.isFinite(offsetSeg)) return [];
        return serie.map((p) => ({ ...p, epoch: Date.parse(`${p.hora}:00Z`) - offsetSeg * 1000 }))
            .filter((p) => Number.isFinite(p.epoch) && Number.isFinite(p.t_c) && p.epoch >= ahoraMs && p.epoch < ahoraMs + 86400000)
            .sort((a, b) => a.epoch - b.epoch)
            .slice(0, 24);
    }, [serie, ahoraMs, offsetSeg]);
    if (puntos.length < 2) {
        return <p className="text-xs cl-suave" data-testid="clima-curva-temperatura-sin-dato">Temperatura por hora: sin serie en este pronóstico.</p>;
    }
    const W = 240;
    const H = 44;
    const ts = puntos.map((p) => p.t_c);
    const tMin = Math.min(...ts);
    const tMax = Math.max(...ts);
    const rango = Math.max(1, tMax - tMin);
    const y = (t) => 6 + (1 - (t - tMin) / rango) * (H - 12);
    // La temperatura es instantánea: cada punto cae en su sello sobre el eje
    // de la franja de debajo (mismo ancho), no en el centro de una columna.
    const filasEje = eje?.filas?.length ? eje.filas : null;
    const x = filasEje ? xDelInstante(filasEje, W / filasEje.length)
        : (e) => ((e - puntos[0].epoch) / (puntos.at(-1).epoch - puntos[0].epoch)) * W;
    const dentro = filasEje ? puntos.filter((p) => p.epoch >= filasEje[0].inicioEpoch && p.epoch <= filasEje.at(-1).epoch) : puntos;
    const linea = dentro.map((p) => `${x(p.epoch).toFixed(2)},${y(p.t_c).toFixed(1)}`).join(' ');
    const pMax = puntos.find((p) => p.t_c === tMax);
    const pMin = puntos.find((p) => p.t_c === tMin);
    const hoy = new Date(ahoraMs + offsetSeg * 1000).toISOString().slice(0, 10);
    const hora = (p) => {
        const h = horaDeCampo(p.hora);
        // Las 00:00 de la fecha siguiente son la medianoche de esta noche, no «mañana».
        const manana = p.hora.slice(0, 10) > hoy && h !== 'medianoche';
        return `${manana ? 'mañana ' : ''}${h === 'mediodía' ? 'al mediodía' : `a ${conArticulo(h)}`}`;
    };
    // Nombra su ventana: lo más frío de 24 horas no es la mínima de la
    // madrugada que evalúa la tarjeta de frío, y a las 5:30 pueden diferir.
    const extremos = [
        { punto: pMin, texto: `lo más frío, ${cifra(tMin, 1)} °C ${hora(pMin)}` },
        { punto: pMax, texto: `lo más cálido, ${cifra(tMax, 0)} °C ${hora(pMax)}` },
    ].sort((a, b) => a.punto.epoch - b.punto.epoch);
    const resumen = tMin === tMax ? `Temperatura estable en ${cifra(tMin, 1)} °C en las horas disponibles.`
        : `Próximas 24 h: ${extremos.map((e) => e.texto).join('; luego, ')}.`;
    return (
        <figure className="mb-2" data-testid="clima-curva-temperatura">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="44" aria-hidden="true">
                <polyline points={linea} fill="none" stroke="#fb923c" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <figcaption className="text-xs" data-testid="clima-curva-temperatura-texto">
                {horasJuntas(sinPuntoDoble(resumen))}
            </figcaption>
        </figure>
    );
}

/* Las fichas del día: a lo sumo seis, una sola receta. */
function FichasHoy({ agrometeo, ahoraMs, viento, arco, uv, zona }) {
    // La ayuda del mm va en su propia fila, bajo la de «Lluvia»: dentro de la
    // ficha estiraba la fila y las vecinas quedaban con un hueco debajo (W39,
    // N5 de la v16, en escritorio; W41, P1 de la v17, también en móvil).
    const [filaAyuda, setFilaAyuda] = useState(null);
    const now = agrometeo?.now;
    const today = agrometeo?.today;
    // La misma probabilidad y la misma ventana que el detalle de «¿Llueve?».
    const probabilidad = probabilidadLluvia(agrometeo, ahoraMs);
    // Un solo total de lluvia en la pantalla: con serie horaria, el de las
    // próximas 24 horas que dice «¿Llueve?», con su ventana; sin ella, el del día.
    const total24h = totalLluvia24h(agrometeo, ahoraMs, zona);
    // Con tormenta y sin cantidad, lo que dice «¿Llueve?», no «0 mm» (W40, J6 de la v17).
    const tormenta = tormentaSinCantidad(agrometeo, ahoraMs);
    const uvL = uv.valor == null ? null : leerUv(uv.valor);
    const horaSolar = (d) => horaConMinutosEsCO(d, zona);
    const valor = (v, unidad) => (v == null ? <span className="cl-ficha__valor cl-suave">sin dato</span>
        : <p className="cl-ficha__valor whitespace-nowrap">{v}<span className="cl-ficha__unidad">{unidad}</span></p>);
    return (
        <div className="cl-pila-apretada">
            <div className="cl-fichas cl-fichas--con-ayuda" data-testid="clima-fichas">
                <section className="ca-carta cl-ficha cl-ficha--lluvia" data-testid="clima-indice-lluvia-hoy">
                    <p className="cl-etiqueta"><CloudRain size={14} aria-hidden="true" /> {total24h ? 'Lluvia' : 'Lluvia hoy'}</p>
                    {tormenta ? <p className="cl-ficha__valor cl-ficha__valor--aviso">{TORMENTA_SIN_CANTIDAD}</p>
                        : total24h ? valor(cifra(total24h.mm, 1), 'mm') : valor(Number.isFinite(today?.precip_mm) ? cifra(today.precip_mm, 1) : null, 'mm')}
                    <p className="cl-ficha__sub">{total24h ? `${total24h.ventana.charAt(0).toUpperCase()}${total24h.ventana.slice(1)}.` : tormenta ? 'Para todo el día.' : 'Total previsto para todo el día.'}</p>
                    <p className="cl-ficha__sub">{probabilidad.pct == null ? probabilidad.texto : <>Probabilidad máxima por hora {probabilidad.ventana}: <span className="whitespace-nowrap">{probabilidad.pct}{'\u00a0'}%</span></>}</p>
                    {/* La ayuda va con la ficha que explica y nombra su misma ventana (W36, M2 de la v15). */}
                    {/* Bajo tormenta sin cantidad la ficha no muestra mm: el chip pregunta por lo que se ve
                        (W42, Q4 de la v18), sin la cantidad prevista (W41, resto de J6 de la v17). */}
                    {tormenta ? (
                        <QueEsEsto titulo="¿Por qué no hay cantidad?" compai="borugo" testid="que-es-lluvia-mm" destino={filaAyuda}>
                            {`Esta vez el pronóstico no trae una cantidad en milímetros ${total24h ? total24h.ventana : 'para todo el día'}: el parte trae tormenta, que puede dejar mucha agua en poco rato. No es una orden de riego.`}
                        </QueEsEsto>
                    ) : (
                        <QueEsEsto titulo="¿Qué significa la lluvia en mm?" compai="borugo" testid="que-es-lluvia-mm" destino={filaAyuda}>
                            Un milímetro equivale a un litro de agua repartido sobre cada metro cuadrado. Por ejemplo, 12 mm son aproximadamente 12 litros sobre un metro cuadrado.{' '}
                            {`Es la cantidad prevista ${total24h ? total24h.ventana : 'para todo el día'}, no una orden de riego.`}
                        </QueEsEsto>
                    )}
                </section>
                <div className="cl-fichas__ayuda" ref={setFilaAyuda} data-testid="clima-fichas-ayuda" />
                <section className="ca-carta cl-ficha" data-testid="clima-viento">
                    <p className="cl-etiqueta"><Wind size={14} aria-hidden="true" /> Viento</p>
                    <div className="cl-ficha__fila">
                        {valor(viento?.kmh == null ? null : cifra(viento.kmh, 0), 'km/h')}
                        <Brujula viento={viento} />
                    </div>
                    <p className="cl-ficha__sub">
                        {viento?.rumbo ? `Del ${viento.rumbo.nombre}${viento.fuenteDireccion === 'dominante del día' ? ' (dominante del día)' : ''}` : 'Sin rumbo'}
                        {viento?.racha != null && <>, rachas de {cifra(viento.racha, 0)}{'\u00a0'}km/h</>}
                    </p>
                </section>
                <section className="ca-carta cl-ficha" data-testid="clima-sol">
                    <p className="cl-etiqueta"><Sun size={14} aria-hidden="true" /> Sol</p>
                    <ArcoSol arco={arco} />
                    <p className="cl-ficha__sub">
                        {arco ? <>Sale <span className="cl-unidad">{horaSolar(arco.salida)}</span> · se pone <span className="cl-unidad">{horaSolar(arco.puesta)}</span></> : 'Horas del sol no disponibles en este pronóstico.'}
                    </p>
                </section>
                <section className="ca-carta cl-ficha cl-ficha--breve" data-testid="clima-indice-humedad">
                    <p className="cl-etiqueta"><Droplets size={14} aria-hidden="true" /> Humedad</p>
                    {valor(Number.isFinite(now?.rh) ? Math.round(now.rh) : null, '%')}
                    <p className="cl-ficha__sub">{Number.isFinite(now?.dew) ? `Rocío a ${Math.round(now.dew)} °C` : 'Rocío sin dato'}</p>
                </section>
                <section className="ca-carta cl-ficha cl-ficha--breve" data-testid="clima-indice-uv">
                    <p className="cl-etiqueta"><Sparkles size={14} aria-hidden="true" /> Rayos UV</p>
                    {uv.estado === 'noche' ? <p className="cl-ficha__valor">Noche</p> : valor(uv.valor, '')}
                    <p className="cl-ficha__sub" data-testid="clima-uv-ahora">
                        {uv.estado === 'noche' ? 'Sin sol, sin rayos UV.' : uv.estado === 'dia' ? `Ahora: ${uvL?.texto?.replace(' — ', ', ') || 'índice horario'}` : 'Sin dato ahora.'}
                    </p>
                </section>
                <section className="ca-carta cl-ficha cl-ficha--breve" data-testid="clima-indice-nubes">
                    <p className="cl-etiqueta"><Cloud size={14} aria-hidden="true" /> Nubes</p>
                    {valor(Number.isFinite(now?.cloud) ? Math.round(now.cloud) : null, '%')}
                    <p className="cl-ficha__sub">del cielo con nubes</p>
                </section>
            </div>
            <p className="cl-nota-suelta">Open-Meteo, hora vigente (la lluvia, {total24h ? 'próximas 24 horas' : 'todo el día'}).</p>
        </div>
    );
}

/* ── Pantalla principal ────────────────────────────────────────────────── */
export default function ClimaBoletinScreen({ onBack, onNavigate = undefined, location: locationProp = undefined, initialHorizonte = 'hoy' }) {
    const [horizonte, setHorizonte] = useState(
        ['hoy', 'semana', 'estacional'].includes(initialHorizonte) ? initialHorizonte : 'hoy',
    );
    const [abrirCondiciones, setAbrirCondiciones] = useState(false);
    const [agrometeoRecibido, setAgrometeo] = useState(null);
    const [snapshotRecibido, setSnapshot] = useState(null);
    const [normales, setNormales] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshTick, setRefreshTick] = useState(0);
    const [reloj, setReloj] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setReloj(new Date()), 60_000);
        return () => clearInterval(timer);
    }, []);

    // Fase ENSO EN VIVO (fuente única, ensoService alimentado por el sidecar).
    const source = getEnsoPhaseSource();
    const phaseKnown = source !== 'default';
    const phase = phaseKnown ? getEnsoPhase() : null;
    const faseLabel = phaseKnown ? getEnsoLabel() : FASE_SIN_DATO;
    const cachedAt = source === 'cached' ? getEnsoCachedAt() : null;
    const faseFamily = phaseKnown ? ensoFamily(phase === 'el_nino' ? 'nino' : phase === 'la_nina' ? 'nina' : phase) : null;

    const [profile, setProfile] = useState(() => getProfile());
    const [locationRestoring, setLocationRestoring] = useState(!locationProp);
    useEffect(() => {
        if (locationProp) return;
        const refresh = () => setProfile(getProfile());
        const changeTenant = () => { refresh(); void syncFarmLocation(); };
        window.addEventListener('tenantChanged', changeTenant);
        window.addEventListener('chagra:location-updated', refresh);
        window.addEventListener('chagra:profile-location-edited', refresh);
        let active = true;
        void syncFarmLocation().finally(() => { if (active) setLocationRestoring(false); });
        return () => {
            active = false;
            window.removeEventListener('tenantChanged', changeTenant);
            window.removeEventListener('chagra:location-updated', refresh);
            window.removeEventListener('chagra:profile-location-edited', refresh);
        };
    }, [locationProp]);
    const region = useMemo(() => regionFromProfile(profile), [profile]);
    const mtaRegional = region ? MTA_POR_REGION[region] : null;

    const locationCandidate = useMemo(
        () => locationProp || resolveClimaLocation({ profile }),
        [locationProp, profile],
    );
    const locationConfirmada = Boolean(locationCandidate && (
        locationProp || (
            locationCandidate.municipio
            && Number.isFinite(locationCandidate.elevation)
            && profile?.altitud_source !== 'cabecera'
            && !isSavedLocationCoarse(profile)
        )
    ));
    const ubicacionPorConfirmar = Boolean(locationCandidate && !locationConfirmada);
    const location = locationConfirmada ? locationCandidate : null;
    // No atribuir el pronóstico anterior a una ubicación recién elegida.
    const agrometeo = agrometeoRecibido?.location === location ? agrometeoRecibido.data : null;
    const snapshotGuardado = useMemo(
        () => ubicacionPorConfirmar
            ? null
            : location
                ? getCachedClimaSnapshot(location.lat, location.lng, location.elevation)
                : getCachedClimaSnapshot(),
        [location, ubicacionPorConfirmar],
    );
    const snapshot = ubicacionPorConfirmar ? null : (snapshotRecibido || snapshotGuardado);
    // Sin cultivos en el perfil, el riesgo sanitario se lee de las plantas
    // activas de la finca puesta (STEV-04): decirlo por las siembras
    // registradas, no exigir que el operador las tipee de nuevo a mano.
    const plantasFinca = useAssetStore((state) => state.plants);
    const cultivosDeFincaTexto = useMemo(() => {
        const nombres = (Array.isArray(plantasFinca) ? plantasFinca : [])
            .filter((p) => (p?.attributes?.status || p?.status) !== 'dead')
            .map((p) => String(p?.attributes?.name || p?.name || '').replace(/\s*#\d+\s*$/, '').trim())
            .filter(Boolean);
        return [...new Set(nombres)].join(', ');
    }, [plantasFinca]);
    const { cultivos, sinFicha } = useMemo(
        () => parseCultivos(profile?.cultivos_actuales || cultivosDeFincaTexto),
        [profile, cultivosDeFincaTexto],
    );
    const tienePapa = cultivos.some((c) => c.key === 'papa');
    const fincaActivaNombre = useFincaActiveStore((state) => state.fincas.find((f) => f.slug === state.activeFincaSlug)?.nombre || null);
    const pendiente = profile?.finca_pendiente_aproximada || '';

    // Carga de datos crudos: snapshot ENSO (sidecar, autoridad) + agrometeo (Open-Meteo).
    // `loading` arranca en true (estado inicial) y en refresco lo re-activa el
    // handler onRefresh. no se toca síncrono dentro del efecto (cascading renders).
    useEffect(() => {
        if (locationRestoring && !location) return;
        let alive = true;
        const force = refreshTick > 0;
        const guardado = ubicacionPorConfirmar
            ? null
            : location
                ? getCachedClimaSnapshot(location.lat, location.lng, location.elevation)
                : getCachedClimaSnapshot();
        // Sincroniza la vista con la caché externa antes de esperar la red.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (guardado) setSnapshot((actual) => actual || guardado);
        Promise.allSettled([
            location
                ? fetchClimaSnapshot({ ...location, forceRefresh: force })
                : ubicacionPorConfirmar
                    ? Promise.resolve(null)
                    : fetchClimaSnapshot({ forceRefresh: force }),
            location ? fetchAgroMeteo(location, { forceRefresh: force }) : Promise.resolve(null),
        ]).then(([snapRes, meteoRes]) => {
            if (!alive) return;
            if (snapRes.status === 'fulfilled' && snapRes.value) setSnapshot(snapRes.value);
            if (meteoRes.status === 'fulfilled') setAgrometeo({ location, data: meteoRes.value });
            setLoading(false);
        });
        return () => { alive = false; };
    }, [location, refreshTick, locationRestoring, ubicacionPorConfirmar]);

    // Normales (para la anomalía): lazy, solo cuando hay ubicación.
    useEffect(() => {
        let alive = true;
        if (!loading && location) fetchNormales(location, snapshot?.climatologia).then((n) => { if (alive) setNormales(n); });
        return () => { alive = false; };
    }, [location, snapshot?.climatologia, loading]);

    const anom = useMemo(() => {
        const today = agrometeo?.today;
        if (!today || !normales) return null;
        const tempMedia = (today.temp_max + today.temp_min) / 2;
        // Solo temperatura: «X % más seco» con la lluvia de UN día frente a la
        // media diaria no dice nada de sequía.
        const mesNormal = normales?.normals?.[String(new Date().getMonth() + 1)] || normales?.normals?.[new Date().getMonth() + 1];
        const referencia = mesNormal && Number.isFinite(Number(mesNormal.t_media)) ? {
            temp_media_normal: mesNormal.t_media,
            precip_dia_normal: null,
            source: 'Climatología del snapshot, normal 1991–2020',
        } : normales;
        return anomalia(tempMedia, null, referencia);
    }, [agrometeo, normales]);
    const lluviaSemanaPct = useMemo(() => {
        const mes = String(reloj.getMonth() + 1);
        const normal = normales?.normals?.[mes] || normales?.normals?.[Number(mes)];
        return normal ? anomaliaLluviaSemana(agrometeo?.daily, normal, reloj) : null;
    }, [agrometeo, normales, reloj]);
    const lluviaMesPct = useMemo(() => {
        const mes = String(reloj.getMonth() + 1);
        const normal = normales?.normals?.[mes] || normales?.normals?.[Number(mes)];
        return normal ? anomaliaLluviaMes(agrometeo?.daily, normal, reloj) : null;
    }, [agrometeo, normales, reloj]);

    const alertasLocales = Array.isArray(snapshot?.alertas_locales) ? snapshot.alertas_locales : [];
    const alertasOpenMeteo = Array.isArray(snapshot?.openmeteo?.alertas) ? snapshot.openmeteo.alertas : [];
    const alertas = alertasLocales.length > 0 ? alertasLocales : alertasOpenMeteo;

    // Controles de gate locales: nunca cambian los datos ni el velo global.
    // El gate de la pantalla acepta además tormenta y helada (cieloHoy).
    const atmosfera = deriveAtmosphere({ snapshot: location ? snapshot : null, now: reloj, location });
    const gate = leerGateCielo();
    const heladas = location ? alertas.filter((a) => /helad|escarch|frost/i.test(`${a?.tipo || ''} ${a?.mensaje || ''}`)) : [];
    const heladasObservadas = heladas.filter(alertaObservada);
    const heladasPronosticadas = heladas.filter((a) => alertaParaEstaMadrugada(a, reloj));
    const heladaObservada = heladasObservadas.length > 0;
    const heladaPronosticada = !heladaObservada && heladasPronosticadas.length > 0;
    // Las respuestas del día salen de UN módulo, el mismo que usa el descenso.
    const respuestas = respuestasDelDia({
        agrometeo, ahoraMs: reloj.getTime(), finca: location, pendiente, cultivos: cultivos.map((c) => c.key),
        enso: faseFamily, faseLabel: phaseKnown ? faseLabel : null, sesgoSitio: snapshot?.sesgoSitio,
        estacion: snapshot?.estacion, timeZone: snapshot?.timezone,
        alertasHelada: { observada: heladaObservada, pronosticada: heladaPronosticada },
    });
    const { piso, zona, frescura, granizo, veredicto, banda } = respuestas;
    const horaFinca = horaLocalFinca(reloj, zona);
    const heladasMostrar = heladaObservada ? heladasObservadas : heladasPronosticadas;
    const fuenteHelada = banda?.clave === 'riesgo-alto' ? 'Riesgo calculado con la serie horaria de Open-Meteo (mínima, humedad, nubes, viento y suelo de la noche evaluada)'
        : alertasLocales.length > 0 ? 'Alertas locales del pronóstico' : 'Alertas de Open-Meteo';
    // «2 p. m.» + «.» de cierre = un solo punto.
    const fuenteHoraFinca = sinPuntoDoble(`${fuenteHelada}. Hora de finca: ${horaFinca == null ? 'sin dato' : horaEsCO(reloj, zona)}.`);
    // El cielo de AHORA sale de la lectura horaria de Open-Meteo; el snapshot
    // solo sirve si no está vencido (su respaldo es el primer día guardado).
    const cielo = resolverCielo({
        gate,
        condicionDato: condicionAhora(agrometeo, location?.elevation, reloj.getTime()),
        condicionSnapshot: snapshot?.stale ? null : atmosfera.condicion,
        luzDato: atmosfera.luz,
        helada: heladaVisible({ observada: heladaObservada, alertaMadrugada: heladaPronosticada, hora: horaFinca }),
    });
    const condicion = cielo.clima;
    const luz = cielo.luz;
    // La escena y la paleta pintan sol o techo de nubes; el rótulo dice los tres cielos.
    const condicionEscena = escenaDelCielo(condicion, agrometeo?.now?.cloud);
    const claveDelCielo = claveCielo({ clima: condicionEscena, luz });
    const filaHeladaHoy = veredicto?.filas.find((f) => f.id === 'helada');
    const viento = vientoAhora(agrometeo, reloj.getTime());
    const arco = arcoDelSol(reloj, agrometeo);
    const uv = uvAhora(agrometeo);
    const serie24 = respuestas.franja24h;
    // UN formato de hora en toda «El tiempo» (CLIMA-R7): «6 a. m.», no «6a».
    // Cada barra es la lluvia de la hora que TERMINA en su sello (HH−1 a HH):
    // el eje nombra el comienzo, el mismo «desde las …» de la ficha (W37).
    const etiquetaHora = (f) => horaEsCO(f.inicioEpoch ?? f.epoch - 3600000, zona);
    const luna = luz === 'noche' ? lunaDeHoy(reloj) : null;
    const lluvia = densidadLluvia(agrometeo);
    const niebla = densidadNiebla(agrometeo);
    const hayPronostico = Boolean(agrometeo?.now);
    const frescuraSnap = frescuraDelSnapshot(snapshot, zona);
    frescuraSnap.hora = fechaHoraSnapshot(snapshot?.saved_at || snapshot?.fetched_at) || frescuraSnap.hora;
    useEffect(() => () => stopSpeech(), [location, horizonte]);

    const procedencia = (
        <details className="cl-sub cl-procedencia" data-testid="clima-procedencia">
            <summary>De dónde sale este dato</summary>
            <p className="text-xs mt-2" data-testid="clima-validez">
                Pronóstico válido hasta: {fechaValidez(agrometeo?.daily, agrometeo?.today?.date) || 'periodo no disponible'}.
            </p>
            <div className="mt-3">
                <TrazabilidadClima agrometeo={agrometeo} snapshot={snapshot} location={location} />
            </div>
        </details>
    );

    const diasHoy = Array.isArray(agrometeo?.daily) ? diasDesdeHoy(agrometeo).slice(0, 5) : [];
    // La vista inicial responde; el detalle permite revisar toda la evidencia.
    const arribaHoy = (
        <>
            <div className="cl-decisiones cl-pila">
                <VeredictoDia abrirCondiciones={abrirCondiciones} respuestas={respuestas} piso={piso?.id} cultivos={cultivos.map((c) => c.key)}>
                    {veredicto?.filas.find((f) => f.id === 'hongos')?.sanitario?.peor?.nivel === 'alto'
                        && <button type="button" className="min-h-11 text-sm underline text-left" data-testid="clima-enlace-plan"
                            onClick={() => { setHorizonte('semana'); document.getElementById('clima-tab-semana')?.focus(); }}>
                            Ver el plan de la racha húmeda en 7–16 días
                        </button>}
                </VeredictoDia>
                {hayPronostico && <AccionesBoletin texto={respuestas.textos.boletin} onRead={() => speak(respuestas.textos.voz)} />}
            </div>
        </>
    );
    const detalleTiempoHoy = (
            <div className="cl-prevision cl-pila">
            {(serie24 || diasHoy.length > 0) && (
                <section className="ca-carta cl-horas-dias">
                    {serie24 && (
                        <div data-testid="clima-proximas-24h">
                            <h3 className="cl-seccion-titulo">Próximas 24 horas</h3>
                            <CurvaTemperatura24h serie={agrometeo?.temperatura24h} ahoraMs={reloj.getTime()} offsetSeg={agrometeo?.utc_offset_seconds} eje={serie24} />
                            <Franja24h serie={serie24} etiquetaHora={etiquetaHora} tormenta={Boolean(respuestas.tormenta.sinCantidad)} />
                        </div>
                    )}
                    {diasHoy.length > 0 && (
                        <details className="cl-detalle cl-dias-resumen">
                            <summary><span>Próximos días</span></summary>
                            <FranjaDias dias={diasHoy} testid="clima-dias-hoy" />
                        </details>
                    )}
                    <FuenteDato>Open-Meteo, por hora y por día.</FuenteDato>
                </section>
            )}
            {agrometeo?.now && <FichasHoy agrometeo={agrometeo} ahoraMs={reloj.getTime()} viento={viento} arco={arco} uv={uv} zona={zona} />}
            </div>
    );

    // Pestañas reales: cada una controla su panel; cambiar de pestaña solo
    // cambia el panel, nunca lo de arriba (portada y avisos).
    const alTeclado = (event) => {
        const orden = HORIZONTES.map((h) => h.id);
        const i = orden.indexOf(horizonte);
        const destino = event.key === 'ArrowRight' ? orden[(i + 1) % orden.length]
            : event.key === 'ArrowLeft' ? orden[(i + orden.length - 1) % orden.length]
                : event.key === 'Home' ? orden[0] : event.key === 'End' ? orden[orden.length - 1] : null;
        if (!destino) return;
        event.preventDefault();
        setAbrirCondiciones(false);
        setHorizonte(destino);
        document.getElementById(`clima-tab-${destino}`)?.focus();
    };

    return (
        <ScreenShell title="El tiempo" onBack={onBack} actions={
            <button type="button" className="cl-agente-cabecera" aria-label="Preguntarle al agente sobre el tiempo"
                onClick={() => onNavigate?.('agente', {
                    desdePantalla: 'clima_boletin', spatialContext: { pantalla: 'clima_boletin' },
                })}>
                <MessageCircle size={20} aria-hidden="true" />
                <span>Agente</span>
            </button>
        }>
            <div className="clima-atmosfera-screen" data-testid="clima-boletin-screen" data-horizonte={horizonte}
                data-cielo={claveDelCielo} data-tono={tonoCielo(claveDelCielo)} data-pronostico={hayPronostico ? 'si' : 'no'}
                {...(banda ? { 'data-helada': banda.clave } : {})}>
                <EscenaAtmosfera condicion={condicionEscena} luz={luz} enso={faseFamily} piso={piso?.id}
                    luna={luna} lluvia={lluvia} niebla={niebla} />
                <div className="clima-atmosfera-contenido cl-lienzo">
                    <div className="cl-cabeza">
                        <Portada location={locationCandidate} locationConfirmada={locationConfirmada} piso={piso} agrometeo={agrometeo} loading={loading} condicion={condicion}
                            frescura={{ ...frescura, hora: fechaHoraSnapshot(frescura.cuandoMs) || frescura.hora }} titular={veredicto?.titular}
                            astro={{ luz, luna }} fincaNombre={fincaActivaNombre}
                            onCompleteLocation={() => onNavigate?.(ubicacionPorConfirmar ? 'ubicacion-detectada' : 'perfil')}
                            onRefresh={() => { setLoading(true); setRefreshTick((t) => t + 1); }} />
                        {hayPronostico && frescuraSnap.estado !== 'sin-dato' && <p role="status" className="cl-sub text-xs" data-testid="clima-frescura-snapshot">
                            {horasJuntas(sinPuntoDoble(frescuraSnap.estado === 'vencido' ? `Último pronóstico guardado el ${frescuraSnap.hora || 'sin fecha'}, ya venció.` : `Último pronóstico guardado el ${frescuraSnap.hora || 'sin hora'} desde el servidor.`))}
                        </p>}
                        {banda && <aside role="status" className="ca-carta cl-banda cl-banda--helada" data-testid="clima-alerta-helada">
                            {banda.clave !== 'riesgo-alto' && <p className="cl-banda__titulo">{banda.titulo}</p>}
                            {banda.clave === 'riesgo-alto' && <details className="cl-veredicto__mas">
                                <summary><span className="cl-banda__titulo">{banda.titulo}</span></summary>
                                {filaHeladaHoy && <p className="text-xs">{horasJuntas(filaHeladaHoy.porque)}</p>}
                                <FuenteDato>{fuenteHoraFinca}</FuenteDato>
                            </details>}
                            {banda.clave !== 'riesgo-alto' && <p className="text-xs">{horasJuntas('La ventana de escarcha es de 3 a. m. a 9 a. m. hora local.')}</p>}
                            {heladasMostrar.map((a, i) => <div key={`${a.tipo}-${i}`}>
                                <p className="text-sm">{horasJuntas(a.mensaje)}</p>
                                {Array.isArray(a.dias) && a.dias.length > 0 && <p className="text-xs">Días: {a.dias.join(', ')}</p>}
                            </div>)}
                            {banda.clave !== 'riesgo-alto' && <FuenteDato>{fuenteHoraFinca}</FuenteDato>}
                        </aside>}
                        {granizo && <aside role="status" className="ca-carta cl-banda cl-banda--granizo" data-testid="clima-aviso-granizo">
                            <details className="cl-veredicto__mas">
                                <summary><span className="cl-banda__titulo">{granizo.titulo}</span></summary>
                                <p className="text-xs">{granizo.detalle}</p>
                            </details>
                        </aside>}
                        {hayPronostico && <ContextoPisoFinca piso={piso} onComplete={() => onNavigate?.('perfil')} />}

                        {/* Navegación por horizontes, justo debajo de la portada */}
                        <div className="cl-pestanas" role="tablist" aria-label="Horizontes del tiempo">
                            {HORIZONTES.map((h) => {
                                const activo = horizonte === h.id;
                                const Icon = h.icon;
                                return (
                                    <button key={h.id} type="button" role="tab" id={`clima-tab-${h.id}`}
                                        aria-selected={activo} aria-controls={`clima-panel-${h.id}`} tabIndex={activo ? 0 : -1}
                                        data-testid={`horizonte-tab-${h.id}`} onClick={() => { setAbrirCondiciones(false); setHorizonte(h.id); }} onKeyDown={alTeclado}
                                        className={`cl-pestana${activo ? ' clima-tab-activo' : ''}`}>
                                        <Icon size={16} aria-hidden="true" />
                                        <span className="cl-pestana__titulo">{h.titulo}</span>
                                        <span className="cl-pestana__sub">{h.sub}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="cl-cuerpo">
                        {HORIZONTES.map((h) => (
                            <div key={h.id} role="tabpanel" id={`clima-panel-${h.id}`} aria-labelledby={`clima-tab-${h.id}`}
                                hidden={horizonte !== h.id} className="cl-panel">
                                {horizonte === h.id && h.id === 'hoy' && (
                                    <HorizonteHoy
                                        agrometeo={agrometeo} anom={anom} lluviaSemanaPct={lluviaSemanaPct} lluviaMesPct={lluviaMesPct}
                                        cultivos={cultivos} sinFicha={sinFicha} faseFamily={faseFamily}
                                        pendiente={pendiente}
                                        onPerfil={() => onNavigate?.('perfil')}
                                        arriba={location ? arribaHoy : null}
                                        detalleTiempo={detalleTiempoHoy}
                                        riesgoSanitario={veredicto?.filas.find((f) => f.id === 'hongos')?.sanitario}
                                        decisionAgua={veredicto?.filas.find((f) => f.id === 'riego')}
                                        procedencia={location ? procedencia : null}
                                        ubicacionConocida={Boolean(location)}
                                    />
                                )}
                                {horizonte === h.id && h.id === 'semana' && (
                                    <div className="cl-pila">
                                        <HorizonteSemana onCondiciones={() => { setAbrirCondiciones(true); setHorizonte('hoy'); }} agrometeo={agrometeo} alertas={alertas} snapshot={snapshot} vistazo={respuestas.dias16} ubicacionConocida={Boolean(location)} ubicacionPorConfirmar={ubicacionPorConfirmar} />
                                        {location && procedencia && <div className="ca-carta">{procedencia}</div>}
                                    </div>
                                )}
                                {horizonte === h.id && h.id === 'estacional' && (
                                    <div className="cl-pila">
                                        <HorizonteEstacional onPronostico={() => setHorizonte('semana')}
                                            piso={piso?.id} faseFamily={faseFamily} faseLabel={faseLabel} source={source} cachedAt={cachedAt}
                                            region={region} mtaRegional={mtaRegional} onNavigate={onNavigate} snapshot={snapshot}
                                            tienePapa={tienePapa} condicion={condicion}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                        <SalidasClima piso={piso}
                            onExplore={() => onNavigate?.('mockup_sierra_global')}
                            onMundo3d={() => onNavigate?.('mockup_mundo3d_clima')} />
                    </div>
                </div>
            </div>
        </ScreenShell>
    );
}
