import { useState } from 'react';
import { queueMarketplaceInterest } from '../services/marketplaceInterestService.js';
import { syncManager } from '../services/syncManager.js';

export default function MarketplaceInterestForm({ offer }) {
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (saving || !consent) return;
    setSaving(true);
    try {
      await queueMarketplaceInterest(offer, { consent, name, phone });
      setNotice('Su interés quedó en cola. Se enviará al productor cuando haya conexión. Puede continuar por WhatsApp.');
      void syncManager.syncAll({ rerunIfBusy: true });
    } catch (error) { setNotice(error.message); }
    finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="rounded-xl border border-slate-600 p-3 space-y-3 text-sm text-slate-200">
    <p>Si acepta, el productor recibirá su nombre, teléfono y la oferta que consultó en su lista de contactos de Chagra. Compartir estos datos es opcional; puede usar WhatsApp sin hacerlo.</p>
    <label className="flex gap-2 items-start"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1" />Acepto compartir mi nombre y teléfono con este productor.</label>
    {consent && <>
      <label className="block">Nombre para compartir<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} className="block w-full rounded bg-slate-800 p-2 mt-1" autoComplete="name" /></label>
      <label className="block">Teléfono para compartir<input required type="tel" maxLength={25} value={phone} onChange={event => setPhone(event.target.value)} className="block w-full rounded bg-slate-800 p-2 mt-1" autoComplete="tel" /></label>
      <button type="submit" disabled={saving} className="w-full rounded-lg bg-emerald-700 p-3 font-semibold disabled:opacity-50">{saving ? 'Guardando...' : 'Compartir interés con el productor'}</button>
    </>}
    {notice && <p role="status">{notice}</p>}
  </form>;
}
