import { MSG } from '../config/messages';
const COPY = MSG.farmSeals;
import React, { useState } from 'react';
import { getProfile, saveProfile } from '../services/userProfileService';
import { normalizeSeals, sealStatus, SEAL_NAMES } from '../services/farmSealService';

export function FarmSealList({ sellos, details = false }) {
  const seals = normalizeSeals(sellos);
  if (!seals.length) return null;
  return <ul className="flex flex-col gap-2 my-3" aria-label="Sellos de la finca">
    {seals.map((seal, index) => {
      const status = sealStatus(seal);
      return <li key={`${seal.nombre}-${index}`} className="rounded-lg border border-slate-600 p-2 text-sm text-slate-200 break-words">
        <strong>{seal.nombre}</strong>{' · '}<span className={status === 'certificado' ? 'text-emerald-300' : 'text-amber-300'}>{status === 'certificado' ? 'Certificado' : status === 'vencido' ? 'Vencido' : 'Declarado'}</span>
        {details && status !== 'declarado' ? <p className="text-xs mt-1">Entidad: {seal.entidad || 'Sin entidad'} · Número: {seal.numero || 'Sin número'} · Vigencia hasta: {seal.vigencia}</p> : null}
        {details && seal.fotoDataUrl ? <img src={seal.fotoDataUrl} alt={`Soporte de ${seal.nombre}`} className="mt-2 max-h-48 max-w-full rounded" /> : null}
      </li>;
    })}
  </ul>;
}

export default function FarmSealsEditor() {
  const [seals, setSeals] = useState(() => normalizeSeals(getProfile().sellos));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const update = (index, field, value) => {
    setSaved(false);
    setSeals(previous => previous.map((seal, i) => i === index ? { ...seal, [field]: value } : seal));
  };
  async function photo(index, file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1_000_000) {
      setError('Use una foto JPG, PNG o WebP de máximo 1 MB.'); return;
    }
    const reader = new FileReader();
    reader.onload = () => update(index, 'fotoDataUrl', reader.result);
    reader.onerror = () => setError(COPY.readPhotoError);
    reader.readAsDataURL(file);
  }
  return <section aria-label="Editar sellos de la finca" className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 text-slate-200">
    <h3 className="font-bold text-lg">Sellos de mi finca</h3>
    <p className="text-sm text-slate-300 my-2">Leemos los sellos que declaró al empezar. Se comparten con sus nuevas ofertas. Certificado significa que usted aporta entidad, número y vigencia; Chagra no verifica el documento.</p>
    {seals.map((seal, index) => <fieldset key={index} className="my-4 border-t border-slate-700 pt-3 flex flex-col gap-3">
      <legend className="font-semibold">{seal.nombre}</legend>
      <label className="text-sm">Nombre del sello<input className="w-full bg-slate-800 border border-slate-600 rounded p-2" value={seal.nombre} onChange={e => update(index, 'nombre', e.target.value)} maxLength={250} /></label>
      <label className="text-sm">Estado<select className="w-full bg-slate-800 border border-slate-600 rounded p-2" value={seal.estado} onChange={e => update(index, 'estado', e.target.value)}><option value="declarado">Declarado</option><option value="certificado">Con datos de certificado</option></select></label>
      {seal.estado === 'certificado' ? <>
        <label>Entidad certificadora<input className="w-full bg-slate-800 border border-slate-600 rounded p-2" value={seal.entidad} onChange={e => update(index, 'entidad', e.target.value)} maxLength={250} /></label>
        <label>Número de certificado<input className="w-full bg-slate-800 border border-slate-600 rounded p-2" value={seal.numero} onChange={e => update(index, 'numero', e.target.value)} maxLength={250} /></label>
        <label>Vigencia hasta<input type="date" className="w-full bg-slate-800 border border-slate-600 rounded p-2" value={seal.vigencia} onChange={e => update(index, 'vigencia', e.target.value)} /></label>
        <label>Foto del certificado (opcional)<input type="file" accept="image/jpeg,image/png,image/webp" className="w-full text-sm" onChange={e => photo(index, e.target.files?.[0])} /></label>
        {seal.fotoDataUrl ? <button type="button" onClick={() => update(index, 'fotoDataUrl', null)}>Quitar soporte</button> : null}
      </> : null}
      <button type="button" className="text-sm text-amber-300 self-start min-h-11" onClick={() => { setSeals(previous => previous.filter((_, i) => i !== index)); setSaved(false); }}>Quitar sello {seal.nombre}</button>
    </fieldset>)}
    <label className="text-sm">{COPY.add}<select className="w-full bg-slate-800 border border-slate-600 rounded p-2 my-2" value="" onChange={e => { const name = e.target.value; if (name) { setSeals(previous => [...previous, { nombre: name, estado: 'declarado', entidad: '', numero: '', vigencia: '', fotoDataUrl: null }]); setSaved(false); } }}><option value="">Seleccione un sello</option>{SEAL_NAMES.filter(name => !seals.some(s => s.nombre === name)).map(name => <option key={name}>{name}</option>)}<option value="Otro sello">Otro sello</option></select></label>
    <FarmSealList sellos={seals} />
    {error ? <p role="alert">{error}</p> : null}
    <button type="button" className="min-h-11 w-full rounded-lg bg-emerald-600 text-white p-2 font-bold" onClick={() => {
      if (seals.some(seal => !seal.nombre.trim() || (seal.estado === 'certificado' && (!seal.entidad.trim() || !seal.numero.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(seal.vigencia))))) { setError('Complete nombre, entidad, número y vigencia. También puede guardarlo como declarado.'); return; }
      const normalized = normalizeSeals(seals);
      saveProfile({ sellos: normalized });
      if (JSON.stringify(normalizeSeals(getProfile().sellos)) !== JSON.stringify(normalized)) { setError(COPY.saveError); return; }
      setError(''); setSaved(true);
    }}>{COPY.save}</button>
    {saved ? <p role="status" className="text-emerald-300 mt-2">Sellos guardados en el perfil de este teléfono.</p> : null}
  </section>;
}
