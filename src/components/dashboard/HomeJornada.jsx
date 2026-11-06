import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Mic, Sprout } from 'lucide-react';
import { PlantasCard, BitacoraCard, HoyCard } from './FincaCards';
import { logCache } from '../../db/logCache';
import { registroSyncLabel } from '../../utils/registroSyncLabel';
import './home-jornada.css';

/** Resumen de lectura. Nunca proyecta sugerencias de IA como trabajo realizado. */
export default function HomeJornada({ onNavigate }) {
    const [recent, setRecent] = useState({ loading: true, failed: false, log: null });
    const [today, setToday] = useState(() => new Date());
    useEffect(() => {
        let alive = true;
        let revision = 0;
        const refresh = async () => {
            const request = ++revision;
            setToday(new Date());
            try {
                const logs = await logCache.getAll();
                const now = Date.now() / 1000;
                const latest = logs.filter((log) => {
                    const needsReview = log.metadata?.ai?.needs_human_review || log.attributes?.metadata?.ai?.needs_human_review;
                    return !needsReview && (log.status || log.attributes?.status) === 'done'
                        && Number(log.timestamp) > 0 && Number(log.timestamp) <= now;
                }).reduce((last, log) => !last || Number(log.timestamp) > Number(last.timestamp) ? log : last, null);
                if (alive && request === revision) setRecent({ loading: false, failed: false, log: latest });
            } catch {
                if (alive && request === revision) setRecent({ loading: false, failed: true, log: null });
            }
        };
        refresh();
        window.addEventListener('syncCompleted', refresh);
        window.addEventListener('taskAdded', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            alive = false;
            window.removeEventListener('syncCompleted', refresh);
            window.removeEventListener('taskAdded', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, []);

    const last = recent.log;
    const lastDate = last ? new Date(Number(last.timestamp) * 1000).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    return (
        <section className="fj-home" aria-labelledby="fj-title">
            <header className="fj-heading">
                <p className="fj-date">{today.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                <h2 id="fj-title">Su finca, hoy</h2>
                <p>Revise lo sembrado. Anote lo que hizo.</p>
                <nav className="fj-record-actions" aria-label="Anotar labores">
                    <button type="button" onClick={() => onNavigate('sembrar')}>Anotar una siembra</button>
                    <button type="button" onClick={() => onNavigate('cosechar')}>Anotar una cosecha</button>
                </nav>
            </header>
            <div className="fj-daily">
                <div className="fj-crops">
                    <p className="fj-kicker">PRIMERO, LO QUE ESTÁ CULTIVANDO</p>
                    <PlantasCard onNavigate={onNavigate} variant="campo" />
                    <button type="button" className="fj-calendar" onClick={() => onNavigate('calendario_finca')}>
                        <CalendarDays size={19} aria-hidden="true" /> Consultar el calendario <ArrowRight size={18} aria-hidden="true" />
                    </button>
                </div>
                <button type="button" className="fj-register" onClick={() => onNavigate('registro_unificado')}>
                    <Mic size={25} aria-hidden="true" />
                    <span><strong>Anotar lo de hoy</strong><span>Siembra, labor o cosecha. Por voz o a mano.</span></span>
                    <ArrowRight size={20} aria-hidden="true" />
                </button>
                <button type="button" className="fj-health" onClick={() => onNavigate('sanidad_sintoma')}>
                    <Sprout size={22} aria-hidden="true" /><span><strong>¿Una mata se ve mal?</strong><span>Cuente qué le ve</span></span><ArrowRight size={18} aria-hidden="true" />
                </button>
            </div>
            <div className="fj-context">
                <HoyCard onNavigate={onNavigate} variant="campo" />
                <div className="fj-notebook">
                    <BitacoraCard onNavigate={onNavigate} variant="campo" />
                    <p className="fj-last" role="status">
                        {recent.loading ? 'Leyendo la última anotación…'
                            : recent.failed ? 'No se pudieron leer las anotaciones. Abra el cuaderno de labores para revisar.'
                                : last ? <>Última anotación, {lastDate}: <strong>{last.name || last.attributes?.name || 'Registro de campo'}</strong>. {registroSyncLabel(last)}</>
                                    : 'No hay anotaciones realizadas en este teléfono. Esto no indica cómo está la finca.'}
                    </p>
                </div>
            </div>
        </section>
    );
}
