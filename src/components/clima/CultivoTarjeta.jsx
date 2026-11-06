import React, { useMemo } from 'react';
import { Droplets, Thermometer, ShieldAlert, ShieldCheck, Shield, Sprout, Hourglass, HelpCircle, ClipboardList } from 'lucide-react';
import {
    kcPorEtapa, etcMm,
} from '../../services/agroIndices';
import { riesgosSanitariosDeCultivos } from '../../services/riesgoSanitarioPiso.js';
import { evaluarAlertasAgroclimaticas, FUENTES_AGROCLIMATICAS } from '../../data/fichasAgroclimaticas';
import { gddDia } from '../../services/gradosDiaCalculator';
import { QueEsEsto } from './pedagogia';
import { cifra } from './cieloHoy.js';

/**
 * CultivoTarjeta — LA tarjeta diferencial de la Página del Tiempo: el clima
 * traducido a decisión para UN cultivo de la finca. Ultrapersonalización real
 * (DOSSIER §5, T2.2). Consume el DATO CRUDO del día (agroMeteoService) y lo pasa
 * por los motores puros (agroIndices) — todo etiquetado con su fuente; lo que no
 * se puede calcular es SlotPendiente, nunca inventado.
 *
 * @param {{ficha:object, today:object|null, faseFamily:'nino'|'nina'|'neutral'}} props
 */

const SEMAFORO = {
    alto: { icon: ShieldAlert, chip: 'bg-red-500/15 text-red-300 border-red-500/40', punto: 'bg-red-500', label: 'Alta' },
    medio: { icon: Shield, chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40', punto: 'bg-amber-400', label: 'Media' },
    bajo: { icon: ShieldCheck, chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', punto: 'bg-emerald-500', label: 'Baja' },
    // Sin modelo válido (p. ej. antracnosis en tierra fría): nunca se pinta verde.
    sin_evaluar: { icon: HelpCircle, chip: 'bg-slate-800/60 text-slate-300 border-slate-600/50', punto: 'bg-slate-400', label: 'Sin evaluar' },
};

/** El piso térmico con su nombre, no el identificador (`frio` → «Clima frío»; W41, P4 de la v17). */
const PISO_LEGIBLE = { frio: 'Clima frío', templado: 'Clima templado', calido: 'Clima cálido' };

function accionDelDia({ balance, peores, alertasFicha, ficha, faseFamily, etapa, labor }) {
    const rojo = peores.find((p) => p?.nivel === 'alto');
    if (rojo) return `El veredicto marca riesgo alto de ${rojo.nombre.toLowerCase()}. Recorra el cultivo y confirme síntomas antes de intervenir.`;
    if (balance?.respuesta === 'Solo si la tierra está seca') return 'El veredicto aconseja regar solo si la tierra está seca. Compruébelo antes de decidir; el coeficiente de esta etapa describe cuánta agua pide el cultivo, no cambia esa decisión.';
    if (balance?.respuesta === 'No hace falta') return 'El veredicto no recomienda riego para los próximos días. Compruebe la humedad del suelo si observa estrés en la planta.';
    if (balance?.respuesta === 'Sin cálculo') return 'El veredicto no puede decidir el riego porque faltan datos de lluvia o evaporación.';
    if (alertasFicha?.[0]) return alertasFicha[0].accion;
    const amarillo = peores.find((p) => p?.nivel === 'medio');
    if (amarillo) return `El veredicto marca riesgo medio de ${amarillo.nombre.toLowerCase()}. Revise señales y ventilación antes de escoger una labor.`;
    if (faseFamily === 'nino') return `Si la etapa es ${etapa || 'la que indicó en el lote'} y la labor prevista es ${labor || 'la que planea'}, confirme humedad del suelo y agua disponible antes de decidir. ` + (ficha.aguaNota || 'El pronóstico seco no basta para ordenar riego.');
    return `Para ${etapa || 'la etapa que encuentre'} y ${labor || 'la labor prevista'}, observe humedad del suelo y estado de la planta antes de decidir; el pronóstico no reemplaza esa revisión.`;
}

export default function CultivoTarjeta({ ficha, today, faseFamily = 'neutral', etapa = '', labor = '', riesgoSanitario = null, decisionAgua = null }) {
    const calc = useMemo(() => {
        if (!today) return null;
        const kcEtapa = kcPorEtapa(ficha, etapa);
        const kc = kcEtapa.kc;
        const etc = etcMm(today.eto_mm, kc);
        const enfermedades = riesgosSanitariosDeCultivos(riesgoSanitario, [ficha.key]);
        // Temperatura base y tope del reloj térmico (el maíz con tope de 30 °C).
        const gddBase = ficha.gddId === 'maiz' ? 10 : 5;
        const gddTope = ficha.gddId === 'maiz' ? 30 : null;
        const gdd = ficha.gddId && Number.isFinite(today.temp_min) && Number.isFinite(today.temp_max)
            ? gddDia(today.temp_min, today.temp_max, gddBase, gddTope)
            : null;
        // Las fichas con fuente, cruzadas con la misma función que usa la Sierra.
        const alertasFicha = evaluarAlertasAgroclimaticas(ficha.fichaAgroclimatica, {
            tempMin: today.temp_min, tempMax: today.temp_max, humedad: today.rh_mean,
        });
        return { kc, kcEtapa, etc, enfermedades, alertasFicha, gdd, gddBase, gddTope };
    }, [ficha, today, etapa, riesgoSanitario]);

    const accion = calc ? accionDelDia({ balance: decisionAgua, peores: calc.enfermedades, alertasFicha: calc.alertasFicha, ficha, faseFamily, etapa, labor }) : null;
    const kcBaja = ficha.kcConfianza === 'baja';

    return (
        <article
            className="rounded-2xl border border-slate-700/60 bg-slate-900/60 overflow-hidden"
            data-testid={`cultivo-tarjeta-${ficha.key}`}
        >
            {/* Encabezado del cultivo */}
            <header className="flex items-center gap-3 px-4 pt-3.5 pb-2.5 border-b border-slate-800/80 bg-gradient-to-br from-emerald-950/30 to-transparent">
                <span aria-hidden="true" className="shrink-0 w-11 h-11 rounded-xl bg-slate-800/70 grid place-items-center text-2xl">
                    {ficha.emoji}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-base font-black text-slate-100 leading-tight">{ficha.nombre}</p>
                    <p className="text-[11px] text-slate-400 leading-tight">
                        {PISO_LEGIBLE[ficha.piso] ?? ficha.piso} · el clima para su cultivo hoy
                    </p>
                </div>
            </header>

            {!calc && (
                <div className="px-4 py-4 flex items-center gap-2 text-xs text-slate-400">
                    <Hourglass size={13} aria-hidden="true" />
                    Esperando el pronóstico de su finca para calcular el agua y la presión de enfermedad.
                </div>
            )}

            {calc && (
                <div className="p-4 space-y-3.5">
                    {/* Agua: ETc + balance ("cuánta le falta") */}
                    <div className="rounded-xl bg-slate-950/40 border border-slate-800/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                                <Droplets size={13} className="text-sky-300" aria-hidden="true" /> Agua hoy
                            </p>
                            {calc.etc != null ? (
                                <p className="text-xs text-slate-400">
                                    demanda estimada <span className="font-black text-slate-100">{cifra(calc.etc)} mm</span>
                                </p>
                            ) : (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300" data-testid="slot-grounded-pendiente">
                                    <Hourglass size={10} aria-hidden="true" /> Cálculo de agua en camino
                                </span>
                            )}
                        </div>
                        {decisionAgua && (
                            <>
                                <p className="mt-1.5 text-xs font-semibold text-sky-200">Veredicto de riego: {decisionAgua.respuesta.toLowerCase()}.</p>
                                <p className="mt-1 text-[10px] text-slate-400">{decisionAgua.porque}</p>
                            </>
                        )}
                        <details className="mt-1 text-xs text-slate-500">
                            <summary>Para técnicos: cómo se calcula el agua</summary>
                            <p>Demanda del cultivo = evaporación de referencia × coeficiente de etapa ({cifra(calc.kc, 2) ?? 'sin dato'}) para {calc.kcEtapa.etiqueta} · {ficha.kcFuente}
                            {kcBaja && ' (estimado, confírmelo con su técnico)'}</p>
                        </details>
                    </div>

                    {/* Lo que dice la ficha con fuente del cultivo */}
                    {calc.alertasFicha.length > 0 && (
                        <div className="space-y-2" data-testid="cultivo-alertas-ficha">
                            {calc.alertasFicha.map((a) => (
                                <div key={a.id} className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-amber-200" data-testid={`ficha-alerta-${a.id}`}>
                                    <p className="flex items-center gap-2 text-xs font-black">
                                        <ClipboardList size={14} aria-hidden="true" /> Según la ficha del cultivo
                                    </p>
                                    <p className="mt-1 text-[11px] leading-snug">{a.accion}</p>
                                    <p className="mt-1 text-[10px] opacity-70">
                                        Fuente: {FUENTES_AGROCLIMATICAS[a.umbral.fuente]?.titulo || 'sin fuente'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Semáforo de enfermedad */}
                    {calc.enfermedades.length > 0 && (
                        <div className="space-y-2">
                            {calc.enfermedades.map((e) => {
                                const s = SEMAFORO[e.nivel] || SEMAFORO.sin_evaluar;
                                const Icon = s.icon;
                                return (
                                    <div key={e.enfermedad} className={`rounded-xl border p-2.5 ${s.chip}`} data-testid={`semaforo-${e.nivel}`}>
                                        <div className="flex items-center gap-2">
                                            <Icon size={15} aria-hidden="true" />
                                            <p className="text-xs font-black flex-1 leading-tight">{e.nombre}</p>
                                            <span className="text-[10px] font-bold uppercase tracking-wide">Señal de la app: {s.label}</span>
                                        </div>
                                        {/* El porqué, el origen del aviso y las fuentes van una vez, en «¿Hongos?»:
                                            con tres cultivos salían tres veces seguidas (W44, R6 de la v19). */}
                                        <p className="mt-1 text-[11px] leading-snug" data-testid="semaforo-remite">Por qué y fuentes: en «¿Hongos?», arriba.</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Reloj térmico (GDD) donde hay Tb groundeada */}
                    {calc.gdd != null && (
                        <div className="text-xs text-slate-300" data-testid="cultivo-reloj-termico">
                            <p className="flex items-start gap-2">
                                <Thermometer size={13} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
                                <span>
                                    Calor que suma hoy para crecer: <span className="font-bold text-slate-100">{cifra(calc.gdd)} grados</span>
                                    <span className="text-slate-500"> por encima del mínimo que necesita</span>
                                </span>
                            </p>
                            <details className="mt-1 text-slate-500">
                                <summary>Para técnicos: reloj térmico</summary>
                                <p>+{cifra(calc.gdd)} °D hoy (grados-día): media de la mínima y la máxima menos la temperatura base de {calc.gddBase} °C{calc.gddTope != null ? `, con tope de ${calc.gddTope} °C` : ''}.</p>
                            </details>
                        </div>
                    )}

                    {/* La acción del día */}
                    <div className="flex gap-2.5 rounded-xl border border-emerald-700/40 bg-emerald-950/25 p-3">
                        <Sprout size={16} className="shrink-0 mt-0.5 text-emerald-300" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300/90">La acción de hoy</p>
                            <p className="mt-0.5 text-sm leading-snug text-slate-100">{accion}</p>
                        </div>
                    </div>

                    {/* De usted y sin sigla, como el resto de la pantalla (W41, P5 de la v17). */}
                    <QueEsEsto titulo="¿Qué es la demanda de agua?" compai="abejita" testid="que-es-etc">
                        La planta bebe agua todo el día y la suelta por las hojas, como cuando usted suda. La <b>demanda
                        estimada</b> es cuánta agua usa su cultivo hoy: cada milímetro es un litro por metro cuadrado. Si
                        llueve menos que eso, a la planta le puede faltar agua: el veredicto de riego le dice si hace falta
                        regar. ¡{ficha.nombre} tiene su propia sed, distinta a la de las demás matas!
                    </QueEsEsto>
                </div>
            )}
        </article>
    );
}
