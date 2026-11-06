/* eslint-disable chagra-i18n/no-hardcoded-spanish -- deuda i18n preexistente;
   esta consolidacion solo renombra el modal tecnico que consume. */
import React, { useState, useEffect } from 'react';
import { X, Globe, LayoutGrid, Info, Plus, MapPin } from 'lucide-react';
import MultiFincaGlobe from './MultiFincaGlobe';
import { FincaGrid } from './FincaCard';
import FarmOSSetupModal from './FarmOSSetupModal';
import { useFincaActiveStore } from '../services/fincaActiveStore';
import { getActiveTenantId } from '../services/tenantContext';
import { activateFincaForUser, createFincaForUser, getCachedFincasForUser, getFincasDeUsuario } from '../services/fincaGroupService';

export default function MultiFincaModal({ onClose }) {
    const [viewMode, setViewMode] = useState('globe');
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [selectedFinca, setSelectedFinca] = useState(null);
    const username = getActiveTenantId();
    // STEV-13: el menú se pinta con las fincas en caché y la consulta a farmOS
    // solo refresca; sin caché se espera la consulta como antes.
    const [ownedFincas, setOwnedFincas] = useState(() => (username ? getCachedFincasForUser(username) || [] : []));
    const [loadedOwner, setLoadedOwner] = useState(() => (ownedFincas.length ? username : null));
    const [showAddForm, setShowAddForm] = useState(false);
    const [savingFinca, setSavingFinca] = useState(false);
    const [fincaError, setFincaError] = useState('');
    const [fincaDraft, setFincaDraft] = useState({ name: '', municipio: '', finca_altitud: '', ubicacion_lat: '', ubicacion_lng: '' });
    const { setFincas, fincas, activeFincaSlug, setActiveFincaManual } = useFincaActiveStore();
    const loadingOwned = Boolean(username) && loadedOwner !== username;
    const ownedFincaMode = Boolean(username);
    const visibleOwnedFincas = loadedOwner === username ? ownedFincas : [];

    useEffect(() => {
        if (!username) return undefined;
        let active = true;
        getFincasDeUsuario(username)
            .then((groups) => {
                if (!active) return;
                setOwnedFincas(groups);
                setLoadedOwner(username);
            })
            .catch(() => { if (active) setLoadedOwner(username); });
        return () => { active = false; };
    }, [username]);

    useEffect(() => {
        if (ownedFincaMode || fincas.length > 0) return undefined;
        let active = true;
        fetch('/fincas-publicas.json')
            .then(async (res) => {
                if (res.ok && active) setFincas(await res.json());
            })
            .catch((err) => console.error('Error cargando fincas:', err));
        return () => { active = false; };
    }, [fincas.length, ownedFincaMode, setFincas]);

    const handleSelectOwned = async (finca) => {
        if (!username || savingFinca || loadingOwned) return;
        setFincaError('');
        try {
            await activateFincaForUser(username, { groupId: finca.id, knownGroups: ownedFincas });
            onClose();
        } catch (error) {
            setFincaError(error?.message || 'No fue posible abrir la finca.');
        }
    };

    const handleCreateOwned = async (event) => {
        event.preventDefault();
        if (!username || savingFinca || loadingOwned) return;
        setSavingFinca(true);
        setFincaError('');
        const location = {
            ...(fincaDraft.municipio.trim() ? { municipio: fincaDraft.municipio.trim() } : {}),
            ...(fincaDraft.finca_altitud !== '' ? { finca_altitud: Number(fincaDraft.finca_altitud) } : {}),
            ...(fincaDraft.ubicacion_lat !== '' ? { ubicacion_lat: Number(fincaDraft.ubicacion_lat) } : {}),
            ...(fincaDraft.ubicacion_lng !== '' ? { ubicacion_lng: Number(fincaDraft.ubicacion_lng) } : {}),
        };
        try {
            const created = await createFincaForUser(username, { name: fincaDraft.name, location });
            const groups = [...ownedFincas.filter((item) => item.id !== created.id), created];
            setOwnedFincas(groups);
            await activateFincaForUser(username, { groupId: created.id, knownGroups: groups });
            onClose();
        } catch (error) {
            setFincaError(error?.message || 'No fue posible crear la finca. Revise los datos e intente de nuevo.');
        } finally {
            setSavingFinca(false);
        }
    };

    const handleSelect = (finca) => {
        if (!finca.farmos_endpoint) {
            setSelectedFinca(finca);
            setShowOnboarding(true);
        } else {
            // BUG #10 (2026-06-21): desde la vista de Cards "Entrar a la finca"
            // solo cerraba el modal SIN cambiar la finca activa (el globo sí
            // llamaba setActiveFinca, las cards no). Ahora ambos caminos
            // conmutan la finca activa de forma explícita (manual = override GPS).
            if (finca.slug) setActiveFincaManual(finca.slug);
            onClose();
        }
    };

    const handleConfigure = (finca) => {
        setSelectedFinca(finca);
        setShowOnboarding(true);
    };

    return (
        <>
            <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-[101] isolate flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-300 animate-in fade-in"
                onClick={(e) => e.target === e.currentTarget && onClose()}
                data-testid="multifinca-modal"
            >
                <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none bg-black/80 backdrop-blur-md" />
                <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[95vh] sm:max-h-[85vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 text-white" data-testid="multifinca-panel">
                    <header className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/20 rounded-lg text-primary">
                                <Globe size={22} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white leading-tight">{ownedFincaMode ? 'Mis fincas' : 'Red de Fincas Chagra'}</h2>
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{ownedFincaMode ? 'Ubicación y datos por finca' : 'Soberanía Alimentaria & Datos'}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-slate-800 rounded-full text-slate-400 transition-colors active:scale-90"
                            aria-label="Cerrar selector"
                        >
                            <X size={24} />
                        </button>
                    </header>

                    {!ownedFincaMode && <div className="px-4 pt-3 border-b border-slate-800 bg-slate-900/30">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setViewMode('globe')}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                                    viewMode === 'globe' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                                data-testid="multifinca-view-globe"
                            >
                                <Globe size={14} />
                                Mapa
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                                    viewMode === 'grid' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                                data-testid="multifinca-view-grid"
                            >
                                <LayoutGrid size={14} />
                                Cards
                            </button>
                        </div>
                    </div>}

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
                        {ownedFincaMode ? (
                            <section aria-labelledby="owned-fincas-title" className="space-y-5">
                                <div>
                                    <h3 id="owned-fincas-title" className="text-lg font-bold text-white">Mis fincas</h3>
                                    <p className="mt-1 text-sm text-slate-400">Elija dónde trabajar o agregue otra ubicación. Su cuenta conserva la misma identidad.</p>
                                </div>
                                <ul className="space-y-2" aria-label="Fincas de su cuenta">
                                    {visibleOwnedFincas.map((finca) => {
                                        const active = finca.id === activeFincaSlug;
                                        return <li key={finca.id}>
                                            <button
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => handleSelectOwned(finca)}
                                                className={`flex min-h-16 w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${active ? 'border-emerald-400/70 bg-emerald-300/[0.07]' : 'border-slate-700 bg-slate-900 hover:border-emerald-400/60'}`}
                                                data-testid={`owned-finca-${finca.id}`}
                                            >
                                                <span className="flex min-w-0 items-center gap-3">
                                                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-300/[0.08] text-emerald-200"><MapPin size={17} /></span>
                                                    <span className="min-w-0">
                                                        <span className="block truncate font-semibold text-slate-50">{finca.name}</span>
                                                        <span className="mt-1 block truncate text-xs text-slate-400">{finca.municipio || 'Ubicación pendiente'}{finca.finca_altitud ? ` · ${finca.finca_altitud} msnm` : ''}</span>
                                                    </span>
                                                </span>
                                                {active && <span className="ml-3 shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">Activa</span>}
                                            </button>
                                        </li>;
                                    })}
                                    {loadingOwned && <li className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">Cargando sus fincas…</li>}
                                    {!loadingOwned && visibleOwnedFincas.length === 0 && <li className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm leading-6 text-slate-400">Todavía no hay fincas. Agregue la primera para guardar su ubicación.</li>}
                                </ul>
                                {!showAddForm ? (
                                    <button type="button" disabled={loadingOwned} onClick={() => setShowAddForm(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-300 px-4 font-semibold text-slate-950 hover:bg-emerald-200 disabled:opacity-50" data-testid="add-owned-finca">
                                        <Plus size={18} aria-hidden="true" /> Agregar finca
                                    </button>
                                ) : (
                                    <form onSubmit={handleCreateOwned} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4" data-testid="owned-finca-form">
                                        <h4 className="font-semibold text-white">Nueva finca</h4>
                                        <label className="block text-sm text-slate-300">Nombre
                                            <input required value={fincaDraft.name} onChange={(event) => setFincaDraft({ ...fincaDraft, name: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white" autoComplete="off" />
                                        </label>
                                        <label className="block text-sm text-slate-300">Municipio
                                            <input value={fincaDraft.municipio} onChange={(event) => setFincaDraft({ ...fincaDraft, municipio: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white" autoComplete="address-level2" />
                                        </label>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                            <label className="block text-sm text-slate-300">Altitud (msnm)
                                                <input type="number" min="0" max="9000" value={fincaDraft.finca_altitud} onChange={(event) => setFincaDraft({ ...fincaDraft, finca_altitud: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white" inputMode="numeric" />
                                            </label>
                                            <label className="block text-sm text-slate-300">Latitud
                                                <input type="number" min="-90" max="90" step="any" value={fincaDraft.ubicacion_lat} onChange={(event) => setFincaDraft({ ...fincaDraft, ubicacion_lat: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white" inputMode="decimal" />
                                            </label>
                                            <label className="block text-sm text-slate-300">Longitud
                                                <input type="number" min="-180" max="180" step="any" value={fincaDraft.ubicacion_lng} onChange={(event) => setFincaDraft({ ...fincaDraft, ubicacion_lng: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white" inputMode="decimal" />
                                            </label>
                                        </div>
                                        {fincaError && <p role="alert" className="text-sm text-rose-300">{fincaError}</p>}
                                        <div className="flex justify-end gap-2">
                                            <button type="button" disabled={savingFinca} onClick={() => setShowAddForm(false)} className="min-h-10 rounded-lg px-3 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
                                            <button type="submit" disabled={savingFinca} className="min-h-10 rounded-lg bg-emerald-300 px-4 text-sm font-bold text-slate-950 disabled:opacity-50" data-testid="save-owned-finca">{savingFinca ? 'Guardando…' : 'Guardar finca'}</button>
                                        </div>
                                    </form>
                                )}
                                {fincaError && !showAddForm && <p role="alert" className="text-sm text-rose-300">{fincaError}</p>}
                            </section>
                        ) : viewMode === 'globe' ? (
                            <MultiFincaGlobe onSelect={handleSelect} />
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 p-3 bg-emerald-900/10 rounded-xl border border-emerald-700/20 text-sm text-emerald-400">
                                    <Info size={18} />
                                    <p>Vista de tarjetas con detalles de cada finca.</p>
                                </div>
                                <FincaGrid fincas={fincas} onSelect={handleSelect} onConfigure={handleConfigure} />
                            </div>
                        )}
                    </div>

                    <footer className="p-4 border-t border-slate-900 bg-slate-900/20 shrink-0 flex justify-between items-center" data-testid="multifinca-footer">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                            <span className="text-[10px] text-slate-500 font-mono italic">{ownedFincaMode ? 'Fincas propias' : 'Nodo Central: Guatoc Choachí'}</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full text-xs font-bold transition-all active:scale-95 border border-slate-700/50"
                        >
                            Cerrar
                        </button>
                    </footer>
                </div>
            </div>

            {showOnboarding && selectedFinca && (
                <FarmOSSetupModal
                    finca={selectedFinca}
                    onClose={() => setShowOnboarding(false)}
                    onConfigureLater={() => setShowOnboarding(false)}
                />
            )}
        </>
    );
}
