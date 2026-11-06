import { Droplets } from 'lucide-react';
import { horaEsCO } from '../../utils/fechaEsCO.js';

function fechaHoraSnapshot(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const fecha = date.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' });
    const hora = horaEsCO(date);
    return hora ? `${fecha}, ${hora}` : null;
}

function FuenteDato({ children }) {
    return <p className="mt-1 text-[10px] leading-tight text-slate-500">{children}</p>;
}

/** El mismo consejo se monta en la Página del Tiempo y en el panel de Sierra. */
export default function ConsejoAguaLadera({ agrometeo, pendiente, className = '', onDeclarar = undefined }) {
    const today = agrometeo?.today;
    const lluvia = today?.precip_mm;
    const eto = today?.eto_mm;
    const exceso = Number.isFinite(lluvia) && Number.isFinite(eto) && lluvia > eto;
    const declarada = typeof pendiente === 'string' && pendiente.trim().length > 0;
    const fuerte = pendiente === 'Fuerte';
    const suave = pendiente === 'Suave';
    const franjas = agrometeo?.precipitacionHoy?.franjas;
    const haySerie = agrometeo?.precipitacionHoy?.serie_horaria_disponible === true && Array.isArray(franjas);
    const nombreBalance = exceso ? 'Superávit de balance de referencia' : 'Balance de referencia';

    return (
        <section className={`ca-carta rounded-2xl border border-amber-500/35 bg-amber-950/20 p-3 ${className}`.trim()} data-testid="clima-consejo-agua">
            <div className="flex items-start gap-2">
                <Droplets size={18} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden="true" />
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[.16em] text-amber-200">Decisión de agua para hoy</p>
                    <h3 className="mt-1 text-base font-black text-slate-100">{nombreBalance}</h3>
                </div>
            </div>
            <p className="mt-2 text-sm leading-snug text-slate-200" data-testid="clima-consejo-agua-texto">
                {!Number.isFinite(lluvia) || !Number.isFinite(eto)
                    ? 'No puedo calificar el balance de hoy: falta lluvia o ETo.'
                    : exceso && fuerte
                        ? 'Usted declaró pendiente Fuerte. Parte de este exceso puede irse como escorrentía, así que no lo tome como agua guardada en el suelo.'
                        : exceso && suave
                            ? 'Usted declaró pendiente Suave. El balance luce excedente, pero observe el suelo y los puntos donde se acumula antes de decidir el riego de mañana.'
                            : exceso
                                ? 'Hay un excedente en el balance, pero no hay pendiente declarada. No asumo una pendiente por defecto: declare la ladera para calificar este consejo.'
                                : 'No hay excedente en el balance de referencia. Revise el suelo antes de decidir si riega.'}
            </p>
            {exceso && <p className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-2 text-xs leading-snug text-amber-100">
                El superávit es un <strong>balance de referencia</strong>, no una reserva medida. La pendiente usada aquí es: {declarada ? `declarada por usted como ${pendiente}` : 'sin declarar'}.
            </p>}
            {!declarada && <p className="mt-2 text-[11px] leading-snug text-slate-400" data-testid="clima-pendiente-faltante">Falta declarar la pendiente de la ladera. El panel no la supone.</p>}
            {!declarada && onDeclarar && (
                <button type="button" className="cl-boton mt-2" onClick={onDeclarar} data-testid="clima-declarar-pendiente">Declarar la pendiente</button>
            )}
            <div className="mt-3 border-t border-slate-700/70 pt-2 text-[11px] text-slate-300" data-testid="clima-eto-explicada">
                <strong className="text-emerald-200">ETo:</strong> agua que el suelo y las plantas podrían perder por evaporación y transpiración. Sale de Open-Meteo con FAO-56 (método de cálculo de evaporación), no es una medición de su parcela.
            </div>
            <div className="mt-2 border-t border-slate-700/70 pt-2" data-testid="clima-lluvia-franjas">
                <p className="text-[11px] font-bold text-slate-200">Cómo se reparte la lluvia de hoy</p>
                {haySerie ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {franjas.map((franja) => <div key={franja.id} className="rounded-lg bg-slate-900/60 px-2 py-1.5">
                            <span className="block text-[10px] uppercase tracking-wide text-slate-500">{franja.label}</span>
                            <strong className="text-sky-200">{Number(franja.mm).toLocaleString('es-CO', { maximumFractionDigits: 1 })} mm</strong>
                        </div>)}
                    </div>
                ) : <p className="mt-1 text-xs text-amber-200">No hay serie horaria disponible. No reparto el total de lluvia.</p>}
            </div>
            <FuenteDato>Hora del dato: {agrometeo?.fetched_at ? fechaHoraSnapshot(agrometeo.fetched_at) : 'sin dato'} · Hora de consulta: {fechaHoraSnapshot(new Date()) || 'sin dato'}</FuenteDato>
        </section>
    );
}
