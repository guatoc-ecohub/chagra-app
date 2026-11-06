import DescensoLaunch from '../DescensoLaunch.jsx';
import React, { useEffect, useState } from 'react';
import { MSG } from '../../config/messages';
import SeccionAnimal from './SeccionAnimal';
import { createAnimalLot, recordAnimalMovement, createAnimalProduct, loadAnimalLots, pullAnimalLots } from '../../services/animalLotService';
import { LOT_MARKER, EVENT_MARKER, PRODUCT_MARKER, SPECIES, HOUSING, EVENTS, readRecord, animalCount } from '../../services/animalLotModel';

const tonoNormal = { border: 'border-amber-700/50', bg: 'bg-amber-950/20', text: 'text-amber-200' };
const inputClass = 'mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-white';
const buttonClass = 'min-h-[48px] rounded-xl bg-lime-700 px-4 py-2 font-bold text-white disabled:opacity-50';
const inputOnboardingClass = 'mt-1 block w-full rounded-xl border border-[#d7d9c8] bg-[#fbf9ef] px-3 py-2.5 text-[#26392f] focus:border-[#315e40] focus:outline-none focus:ring-2 focus:ring-[#315e40]/20';
const buttonOnboardingClass = 'min-h-[50px] rounded-full bg-[#315e40] px-4 py-2 font-bold text-[#fff9e9] hover:bg-[#244c34] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315e40] disabled:opacity-50';
const today = () => new Date().toLocaleDateString('en-CA');

export default function LotesAnimales({ initialLot = null, onLotCreated = null, onboardingExtendido = false }) {
  const [data, setData] = useState({ lots: [], products: [], logs: [] });
  const [mode, setMode] = useState(() => (initialLot ? 'lot' : ''));
  const [lotId, setLotId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const tono = onboardingExtendido
    ? { border: 'border-transparent', bg: 'bg-transparent', text: 'text-[#243d2e]' }
    : initialLot
      ? { border: 'border-emerald-700', bg: 'bg-emerald-950', text: 'text-emerald-100' }
      : tonoNormal;
  const inputClassName = onboardingExtendido ? inputOnboardingClass : inputClass;
  const buttonClassName = onboardingExtendido ? buttonOnboardingClass : buttonClass;
  const housingDefault = initialLot?.housing || (onboardingExtendido && initialLot?.species === 'Cerdos' ? HOUSING[0] : '');
  useEffect(() => {
    let active = true;
    const reload = () => loadAnimalLots().then(value => { if (active) setData(value); }).catch(() => { if (active) setError('No pudimos leer sus lotes. Intente de nuevo.'); });
    const pull = () => pullAnimalLots().catch(() => { if (active) setError('No pudimos traer los lotes de la cuenta. Lo guardado en este equipo sigue disponible.'); });
    const synced = async (event) => {
      if (!event.detail?.type?.startsWith('animal_lot_')) return;
      await pull();
    };
    reload();
    pull();
    window.addEventListener('animalLotsChanged', reload);
    window.addEventListener('online', pull);
    window.addEventListener('syncCompleted', synced);
    window.addEventListener('tenantChanged', reload);
    return () => {
      active = false;
      window.removeEventListener('animalLotsChanged', reload);
      window.removeEventListener('online', pull);
      window.removeEventListener('syncCompleted', synced);
      window.removeEventListener('tenantChanged', reload);
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setMessage('');
    try {
      let createdLot = null;
      if (mode === 'lot') createdLot = await createAnimalLot({ name: String(form.get('name')), species: String(form.get('species')), housing: String(form.get('housing')), count: form.get('count') });
      if (mode === 'event') await recordAnimalMovement(lotId, String(form.get('kind')), form.get('count'));
      if (mode === 'product') await createAnimalProduct({ lotId: String(form.get('lotId')), date: String(form.get('date')), weight: form.get('weight'), batch: String(form.get('batch')) });
      setData(await loadAnimalLots());
      setMode('');
      setMessage('Guardado en este equipo. Se envía a su cuenta cuando haya conexión.');
      if (createdLot && onLotCreated) await onLotCreated(createdLot);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  return (
    <div className={`${initialLot || onboardingExtendido ? '' : 'mb-6'} ${onboardingExtendido ? 'onbe-animal-form' : ''}`} data-testid="animal-lots">
        {!initialLot ? <DescensoLaunch slug="ovinos-carne" /> : null}
      <SeccionAnimal
        tono={tono}
        titulo={onboardingExtendido && initialLot ? 'Su primer lote' : 'Mis lotes de animales'}
        className={onboardingExtendido ? '!rounded-none !border-0 !bg-transparent !p-0' : ''}
        contentClassName={onboardingExtendido ? '!text-[#526255]' : ''}
      >
        {!initialLot ? <p>Cuente su cochera o su rebaño como un solo lote. Aquí puede anotar nacimientos, ventas y salidas a sacrificio, aun sin señal.</p> : null}
        <div className="flex flex-wrap gap-2 pt-2">
          {!initialLot ? <button type="button" className={buttonClassName} onClick={() => { setMode('lot'); setError(''); }}>{MSG.animalesLotes.registrar}</button> : null}
          {data.lots.length > 0 && <button type="button" className={buttonClassName} onClick={() => { setMode('product'); setError(''); }}>{MSG.animalesLotes.producto}</button>}
        </div>
        {message && <p role="status" className={onboardingExtendido ? 'text-[#526255]' : 'text-slate-200'}>{message}</p>}
        {error && <p role="alert" className={onboardingExtendido ? 'text-red-800' : 'text-amber-200'}>{error}</p>}
        {mode && <form onSubmit={submit} className={`space-y-3 border-t ${onboardingExtendido ? 'border-[#d7d9c8]' : 'border-amber-800'} pt-3`} aria-label={mode === 'lot' ? MSG.animalesLotes.registrar : mode === 'event' ? 'Anotar movimiento' : MSG.animalesLotes.producto}>
          {mode === 'lot' && <>
            <label className="block">Nombre del lote<input name="name" className={inputClassName} defaultValue={initialLot?.name || ''} required maxLength={120} /></label>
            <label className="block">Especie<select name="species" className={inputClassName} defaultValue={initialLot ? initialLot.species || '' : SPECIES[0]} required>
              {initialLot && !initialLot.species ? <option value="">Elija una especie</option> : null}
              {SPECIES.map(value => <option key={value}>{value}</option>)}
            </select></label>
            <label className="block">Cómo viven<select name="housing" className={inputClassName} defaultValue={initialLot ? housingDefault : HOUSING[0]} required={!onboardingExtendido}>
              {initialLot && !housingDefault ? <option value="">{onboardingExtendido ? 'Sin especificar' : 'Elija una opción'}</option> : null}
              {HOUSING.map(value => <option key={value}>{value}</option>)}
            </select></label>
            <label className="block">Cuántos animales<input name="count" type="number" min="1" step="1" inputMode="numeric" className={inputClassName} defaultValue={initialLot?.count || ''} required /></label>
          </>}
          {mode === 'event' && <>
            <p className="font-bold">{data.lots.find(lot => lot.id === lotId)?.attributes.name}</p>
            <label className="block">Qué pasó<select name="kind" className={inputClassName}>{['birth', 'sale', 'slaughter'].map(kind => <option key={kind} value={kind}>{EVENTS[kind]}</option>)}</select></label>
            <label className="block">Cuántos animales<input name="count" type="number" min="1" step="1" inputMode="numeric" className={inputClassName} required /></label>
          </>}
          {mode === 'product' && <>
            <label className="block">Lote de animales de origen<select name="lotId" className={inputClassName} required>{data.lots.map(lot => <option key={lot.id} value={lot.id}>{lot.attributes.name}</option>)}</select></label>
            <label className="block">Fecha de elaboración<input name="date" type="date" defaultValue={today()} className={inputClassName} required /></label>
            <label className="block">Peso en kilos<input name="weight" type="number" min="0.001" step="0.001" inputMode="decimal" className={inputClassName} required /></label>
            <label className="block">Número de lote del producto<input name="batch" className={inputClassName} required maxLength={120} /></label>
          </>}
          <div className="flex gap-2"><button className={buttonClassName} disabled={busy} type="submit">{busy ? 'Guardando…' : MSG.action.guardar}</button>{!onboardingExtendido && <button className="min-h-[48px] px-3 underline" disabled={busy} type="button" onClick={() => setMode('')}>{MSG.action.cancelar}</button>}</div>
        </form>}
        {!initialLot && !data.lots.length && !mode && <p className="pt-2">Todavía no ha registrado lotes.</p>}
        {!initialLot && data.lots.map(lot => {
          const details = readRecord(lot, LOT_MARKER);
          return <article key={lot.id} data-testid={`lot-${lot.id}`} className="mt-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <h3 className="font-bold text-white">{lot.attributes.name}</h3>
            <p>{details.species}{details.housing ? ` · ${details.housing}` : ''}</p>
            <p className="text-xl font-bold text-slate-100">{animalCount(lot.id, data.logs)} animales</p>
            <ul className="mt-2 space-y-1 text-sm">
              {data.logs.flatMap(log => {
                if (log.metadata?.ai?.needs_human_review || log.attributes?.metadata?.ai?.needs_human_review) return [];
                const event = readRecord(log, EVENT_MARKER);
                return event?.lotId === lot.id && EVENTS[event.kind] ? [<li key={log.id}>{EVENTS[event.kind]}: {event.count}</li>] : [];
              })}
            </ul>
            <button type="button" className="min-h-[48px] underline text-lime-100" onClick={() => { setLotId(lot.id); setMode('event'); setError(''); }}>Anotar lo que pasó</button>
          </article>;
        })}
        {!initialLot && data.products.map(product => {
          const details = readRecord(product, PRODUCT_MARKER);
          const origin = data.lots.find(lot => lot.id === details.sourceLotId);
          return <article key={product.id} className="mt-3 rounded-xl border border-amber-700 p-3" data-testid={`product-${product.id}`}>
            <h3 className="font-bold text-amber-100">{product.attributes.name}</h3>
            <p>{details.weight} kg · {details.date}</p>
            <p>Salió de: {origin?.attributes.name || details.sourceLotId}</p>
          </article>;
        })}
      </SeccionAnimal>
    </div>
  );
}
