/* eslint-disable chagra-i18n/no-hardcoded-spanish */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getActiveTenantId } from '../../services/tenantContext.js';
import { syncCrm } from '../../services/crmSyncService.js';
import ContactosPanel from './ContactosPanel.jsx';
import InteractionHistory from './InteractionHistory.jsx';
import RedView from './RedView.jsx';
import {
  createContact,
  createInteraction,
  getAllInteractions,
  getContacts,
  getNetworkStats,
} from '../../services/crmService.js';
import {
  CONTACT_TYPE,
  CONTACT_TYPE_LABELS,
  INTERACTION_TYPE,
  INTERACTION_TYPE_LABELS,
} from '../../constants/crmConstants.js';

const EMPTY_CONTACT_FORM = { name: '', contact_type: CONTACT_TYPE.CAMPESINO, phone: '' };
const EMPTY_INTERACTION_FORM = { interaction_type: INTERACTION_TYPE.VISITA, notes: '' };

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
      {label}
      {children}
    </label>
  );
}

const inputClass = 'rounded-lg border border-stone-300 px-3 py-2 text-stone-900';

export default function CrmScreen({ onBack }) {
  const [contacts, setContacts] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [networkStats, setNetworkStats] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT_FORM);
  const [interactionForm, setInteractionForm] = useState(EMPTY_INTERACTION_FORM);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async (preferredContactId = null) => {
    const tenant = getActiveTenantId();
    setLoading(true);
    try {
      const [nextContacts, nextInteractions, nextStats] = await Promise.all([
        getContacts(),
        getAllInteractions(),
        getNetworkStats(),
      ]);
      if (tenant !== getActiveTenantId()) return;
      setContacts(nextContacts);
      setInteractions(nextInteractions);
      setNetworkStats(nextStats);
      setSelectedContact((current) => {
        const id = preferredContactId || current?.id;
        return nextContacts.find((contact) => contact.id === id) || nextContacts[0] || null;
      });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el CRM.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const sync = async () => {
      try {
        await syncCrm();
        if (mounted) await refresh();
      } catch {
        if (mounted) setError('Los cambios siguen guardados en este dispositivo. No se pudo sincronizar el CRM.');
      }
    };
    const timer = setTimeout(() => { refresh(); sync(); }, 0);
    const interval = setInterval(sync, 30000);
    window.addEventListener('online', sync);
    const accountChanged = () => {
      setContacts([]);
      setInteractions([]);
      setNetworkStats(null);
      setSelectedContact(null);
      sync();
    };
    window.addEventListener('tenantChanged', accountChanged);
    window.addEventListener('crmChanged', sync);
    return () => {
      mounted = false;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('online', sync);
      window.removeEventListener('tenantChanged', accountChanged);
      window.removeEventListener('crmChanged', sync);
    };
  }, [refresh]);

  const selectedHistory = useMemo(
    () => interactions.filter((interaction) => (
      interaction.asset_id === selectedContact?.id
      || interaction.relationships?.asset?.data?.id === selectedContact?.id
    )),
    [interactions, selectedContact],
  );

  const saveContact = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const contact = await createContact(contactForm);
      setContactForm(EMPTY_CONTACT_FORM);
      setShowContactForm(false);
      setNotice('Contacto guardado en esta finca.');
      await refresh(contact.id);
      window.dispatchEvent(new Event('crmChanged'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el contacto.');
    } finally {
      setSaving(false);
    }
  };

  const saveInteraction = async (event) => {
    event.preventDefault();
    if (!selectedContact) return;
    setSaving(true);
    setNotice('');
    try {
      await createInteraction({
        contact_id: selectedContact.id,
        ...interactionForm,
      });
      setInteractionForm(EMPTY_INTERACTION_FORM);
      setShowInteractionForm(false);
      setNotice('Interacción guardada en la hoja de vida del contacto.');
      await refresh(selectedContact.id);
      window.dispatchEvent(new Event('crmChanged'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la interacción.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main data-piel-propia="clara" className="min-h-screen bg-stone-50 p-4 text-stone-900 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-start gap-4">
          {onBack && <button type="button" onClick={onBack} className="rounded p-2 text-green-800 hover:bg-green-100">Volver</button>}
          <div>
            <p className="text-sm font-semibold text-green-800">Mi finca</p>
            <h1 className="text-3xl font-bold">Red de finca</h1>
            <p className="mt-1 text-stone-600">Contactos e interacciones guardados en su finca.</p>
          </div>
        </header>

        {error && <p role="alert" className="rounded-lg bg-red-100 p-3 text-red-900">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-100 p-3 text-green-900">{notice}</p>}

        <section className="grid gap-6 lg:grid-cols-2" aria-label="Contactos e historial">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <ContactosPanel
              contacts={contacts}
              onContactSelect={setSelectedContact}
              onNewContact={() => setShowContactForm((open) => !open)}
            />
            {showContactForm && (
              <form onSubmit={saveContact} className="mt-4 space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <h2 className="font-semibold">Nuevo contacto</h2>
                <Field label="Nombre">
                  <input className={inputClass} required value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} />
                </Field>
                <Field label="Tipo">
                  <select className={inputClass} value={contactForm.contact_type} onChange={(event) => setContactForm({ ...contactForm, contact_type: /** @type {typeof CONTACT_TYPE.CAMPESINO} */ (event.target.value) })}>
                    {Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Teléfono">
                  <input className={inputClass} value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} />
                </Field>
                <button type="submit" disabled={saving} className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar contacto'}</button>
              </form>
            )}
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <InteractionHistory
              interactions={selectedHistory}
              contactName={selectedContact?.attributes?.name}
              onNewInteraction={selectedContact ? () => setShowInteractionForm((open) => !open) : null}
            />
            {showInteractionForm && selectedContact && (
              <form onSubmit={saveInteraction} className="mt-4 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h2 className="font-semibold">Nueva interacción</h2>
                <Field label="Tipo">
                  <select className={inputClass} value={interactionForm.interaction_type} onChange={(event) => setInteractionForm({ ...interactionForm, interaction_type: /** @type {typeof INTERACTION_TYPE.VISITA} */ (event.target.value) })}>
                    {Object.entries(INTERACTION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Notas">
                  <textarea className={inputClass} rows={3} value={interactionForm.notes} onChange={(event) => setInteractionForm({ ...interactionForm, notes: event.target.value })} />
                </Field>
                <button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar interacción'}</button>
              </form>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm" aria-label="Resumen de la red">
          <RedView networkStats={networkStats} loading={loading} />
        </section>
      </div>
    </main>
  );
}
