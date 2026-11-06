/* eslint-disable chagra-i18n/no-hardcoded-spanish */
import { useEffect, useState } from 'react';
import { Check, ShieldCheck, UserRound } from 'lucide-react';
import {
  canSwitchSubUser, currentSubUser, ensureOwnerBootstrapped, getRoster, hasAdminPin,
  setAdminPin, setCurrentSubUser, switchRequiresPin, unlockSubUser,
} from '../../services/fincaRosterService.js';
import useFincaActiveStore from '../../services/fincaActiveStore.js';
import useRadioGroupNav from '../../hooks/useRadioGroupNav.js';
import { ROLE_LABELS } from '../../config/roleCatalog.js';

const PIN_ERRORS = Object.freeze({
  'invalid admin pin': 'PIN incorrecto.',
  'invalid admin pin format': 'El PIN debe tener de 4 a 8 números.',
  'admin pin not set': 'No hay PIN fijado. Cierre sesión y entre con la clave de quien administra.',
  'pin unavailable': 'Este navegador no puede verificar el PIN.',
});

export default function SecurityProfileSwitcher() {
  const fincaSlug = useFincaActiveStore((state) => state.activeFincaSlug);
  const [roster, setRoster] = useState(() => ensureOwnerBootstrapped(fincaSlug));
  const [error, setError] = useState('');
  // Cambio pendiente que necesita PIN: { id, mode: 'unlock' | 'create' }.
  const [pending, setPending] = useState(null);
  const [pin, setPin] = useState('');

  useEffect(() => {
    const refresh = () => setRoster(getRoster(fincaSlug));
    refresh();
    window.addEventListener('chagra:roster-changed', refresh);
    return () => window.removeEventListener('chagra:roster-changed', refresh);
  }, [fincaSlug]);

  const activeId = currentSubUser(fincaSlug)?.id || roster.currentSubUserId || '';
  const users = roster.usuarios.filter((user) => user.status !== 'revoked');

  const activeUser = users.find((user) => user.id === activeId) || null;

  const handleChange = (id) => {
    if (id === activeId) return;
    setError('');
    setPin('');
    if (switchRequiresPin(fincaSlug, id)) {
      setPending({ id, mode: 'unlock' });
      return;
    }
    // Quien administra baja a un perfil con menos permisos: sin PIN fijado
    // no podría volver sin cerrar sesión, así que se le pide crearlo antes.
    if (activeUser?.rol === 'dueno' && !hasAdminPin(fincaSlug)) {
      setPending({ id, mode: 'create' });
      return;
    }
    try {
      setCurrentSubUser(fincaSlug, id);
    } catch (_) {
      setError('No se pudo cambiar el perfil activo.');
    }
  };

  const handlePinSubmit = async (event) => {
    event.preventDefault();
    if (!pending) return;
    try {
      if (pending.mode === 'create') {
        await setAdminPin(fincaSlug, pin);
        setCurrentSubUser(fincaSlug, pending.id);
      } else {
        await unlockSubUser(fincaSlug, pending.id, pin);
      }
      setPending(null);
      setPin('');
      setError('');
    } catch (e) {
      setError(PIN_ERRORS[e?.message] || 'No se pudo cambiar el perfil activo.');
    }
  };

  const radioProps = useRadioGroupNav({
    opciones: users.map((user) => user.id),
    seleccionada: activeId,
    onSeleccionar: handleChange,
  });

  if (!canSwitchSubUser(fincaSlug)) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-emerald-700/40 bg-emerald-950/20 p-5" data-testid="security-profile-switcher">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-emerald-400" aria-hidden="true" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Perfil de acceso activo</h3>
      </div>
      <p className="text-xs leading-relaxed text-slate-400">
        Escoja quién usa Chagra en este teléfono. Pasar a un perfil con menos
        permisos es libre; volver a uno con más pide el PIN de quien administra.
      </p>
      <div className="grid gap-2" role="radiogroup" aria-label="Perfil de acceso activo">
        {users.map((user, indice) => {
          const selected = activeId === user.id;
          return (
            <button
              key={user.id}
              type="button"
              role="radio"
              aria-checked={selected}
              {...radioProps(user.id, indice)}
              data-testid={`security-profile-${user.id}`}
              onClick={() => handleChange(user.id)}
              className={`flex min-h-[48px] items-center gap-3 rounded-xl border px-3 py-2 text-left ${selected ? 'border-emerald-500/70 bg-emerald-900/30' : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'}`}
            >
              <UserRound size={17} className="shrink-0 text-slate-300" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{user.nombre || 'Perfil sin nombre'}</span>
                <span className="block text-[11px] text-slate-400">{ROLE_LABELS[user.rol] || user.rol}</span>
              </span>
              {selected && <Check size={16} className="shrink-0 text-emerald-300" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {pending && (
        <form onSubmit={handlePinSubmit} className="space-y-2" data-testid="security-profile-pin-form">
          <label htmlFor="security-profile-pin" className="block text-xs text-slate-300">
            {pending.mode === 'create'
              ? 'Antes de cambiar, fije un PIN de 4 a 8 números. Lo va a necesitar para volver a su perfil.'
              : 'Escriba el PIN de quien administra para pasar a este perfil.'}
          </label>
          <input
            id="security-profile-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            data-testid="security-profile-pin-input"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400 min-h-[44px]"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              data-testid="security-profile-pin-submit"
              className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-2.5 min-h-[44px]"
            >
              {pending.mode === 'create' ? 'Fijar PIN y cambiar' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => { setPending(null); setPin(''); setError(''); }}
              className="rounded-xl border border-slate-700 bg-slate-800/50 text-slate-300 text-sm font-bold px-4 py-2.5 min-h-[44px]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </section>
  );
}
/* eslint-enable chagra-i18n/no-hardcoded-spanish */
