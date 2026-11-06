import React, { useEffect, useState } from 'react';
import { Sprout } from 'lucide-react';
import { handleOAuthCallback } from '../services/authService';
import { setCurrentOperator } from '../services/operatorIdentityService';
import { getActiveTenantId } from '../services/tenantContext';
import { activateFincaForUser, getFincasDeUsuario } from '../services/fincaGroupService';
import useOllamaWarmStore from '../store/useOllamaWarmStore';
import ChagraGrowLoader from './ChagraGrowLoader';
import FincaGroupSelector from './FincaGroupSelector';
import { MSG } from '../config/messages';

async function completeOAuthSession(tenantId, onSuccess, setStatus) {
  try { await setCurrentOperator(tenantId); } catch (err) { console.warn('[OAuthCallback] setCurrentOperator failed:', err); }
  import('../services/operatorPhotoService.js').then((m) => m.loadFromFarmOS()).catch(() => {});
  try { useOllamaWarmStore.getState().startWarmup(); } catch (err) { console.warn('[OAuthCallback] ollama warm-up dispatch failed:', err); }
  try { window.history.replaceState({}, document.title, window.location.origin + '/'); } catch (_) { /* no-op */ }
  setStatus('ok');
  onSuccess();
}

/**
 * OAuthCallback — pantalla puente del flujo Authorization Code + PKCE.
 *
 * Se monta cuando la app detecta la ruta /callback (o #callback) con los
 * params `code` + `state` que farmOS devuelve tras el redirect de
 * /oauth/authorize. Intercambia el code por tokens (PKCE), persiste la sesión
 * y delega al caller (App) la navegación al dashboard o de vuelta al login.
 *
 * IMPORTANTE: este flujo SOLO completa si el backend farmOS tiene:
 *   - el redirect_uri de la PWA registrado en el cliente OAuth, y
 *   - PKCE habilitado en ese cliente.
 * Mientras eso no esté listo en producción, el camino vivo sigue siendo el
 * password grant del LoginScreen (ver authService PASSWORD_GRANT_*).
 *
 * @param {object} props
 * @param {() => void} props.onSuccess - callback tras login PKCE exitoso.
 * @param {(error: string) => void} props.onError - callback si el intercambio falla.
 */
export default function OAuthCallback({ onSuccess, onError }) {
  const [status, setStatus] = useState(MSG.auth.callbackProcessing);
  const [fincasPendientes, setFincasPendientes] = useState(null);
  const [seleccionandoFinca, setSeleccionandoFinca] = useState(false);

  const seleccionarFinca = async (groupId) => {
    const tenantId = getActiveTenantId();
    if (!tenantId) return onError(MSG.auth.callbackIdentityMissing);
    setSeleccionandoFinca(true);
    try {
      await activateFincaForUser(tenantId, { groupId });
      setFincasPendientes(null);
      await completeOAuthSession(tenantId, onSuccess, setStatus);
    } catch (_) {
      setSeleccionandoFinca(false);
      onError(MSG.auth.callbackFincaFailed);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Los params del code/state pueden venir en query (?code=...&state=...)
      // o, si la PWA enruta por hash, en el fragmento (#callback?code=...).
      // Soportamos ambos para no acoplarnos al modo de routing del deploy.
      let params = new URLSearchParams(window.location.search);
      if (!params.get('code')) {
        const hash = window.location.hash || '';
        const qIndex = hash.indexOf('?');
        if (qIndex !== -1) {
          params = new URLSearchParams(hash.slice(qIndex + 1));
        }
      }

      const result = await handleOAuthCallback(params);
      if (cancelled) return;

      if (result.success) {
        // 2026-09-17 (hard-test T3-SIEMBRA): el `state` de OAuth NO es una
        // identidad. Es un nonce CSRF de 16 bytes que `generateOAuthState()`
        // vuelve a sortear en CADA intento de login. Usarlo como semilla de
        // operador/tenant estampaba un dueno distinto sobre los mismos datos
        // en cada entrada, y eso los escondia por dos caminos a la vez:
        //   · `filterByActiveTenant` (db/assetCache) descarta en lectura todo
        //     asset cuyo `_tenant_id` no sea el activo → la siembra quedaba en
        //     IndexedDB y la pantalla contaba 0 plantas.
        //   · `apiService` pide al servidor `filter[uid.name]=<tenant>`, que
        //     con un nonce no matchea a ningun usuario → 0 assets remotos.
        // Sintoma que producia: «Su chagra esta vacia» con la siembra intacta.
        //
        // La identidad real la fija LoginScreen con el usuario que el operador
        // escribio, ANTES de salir hacia /oauth/authorize (al volver ya no hay
        // input que leer). Aqui solo se comprueba que exista: sin scope no se
        // entra, porque el backend farmOS es compartido entre operadores y
        // leer sin filtro mostraria datos ajenos.
        const tenantId = getActiveTenantId();
        if (!tenantId) {
          console.warn('[OAuthCallback] callback sin identidad de operador; no se entra sin scope de tenant.');
          setStatus('error');
          onError(MSG.auth.callbackIdentityMissing);
          return;
        }
        let finca;
        try {
          const groups = await getFincasDeUsuario(tenantId);
          if (groups.length) finca = await activateFincaForUser(tenantId, { knownGroups: groups });
        } catch (err) {
          console.warn('[OAuthCallback] finca resolution failed; keeping user tenant:', err);
        }
        if (finca?.selectionRequired) {
          setFincasPendientes(finca.groups);
          setStatus('seleccion');
          return;
        }
        // El corpus RAG se precarga desde App después de montar el dashboard.
        // Mantenerlo fuera de este callback evita competir con la navegación
        // inicial del flujo OAuth.
        // Limpiar los params OAuth de la URL para que un refresh no reintente
        // el intercambio con un code ya consumido (one-time use).
        await completeOAuthSession(tenantId, onSuccess, setStatus);
      } else {
        setStatus('error');
        onError(result.error || MSG.auth.callbackFailed);
      }
    };

    run().catch((err) => {
      if (cancelled) return;
      setStatus('error');
      onError(err?.message || MSG.auth.callbackUnexpectedError);
    });

    return () => { cancelled = true; };
  }, [onSuccess, onError]);

  return (
    <div className="relative min-h-[100dvh] w-full bg-slate-950 bg-biopunk-pattern flex flex-col justify-center items-center p-6 text-slate-100">
      <div className="w-24 h-24 bg-muzo/20 rounded-full flex items-center justify-center shadow-neon-muzo mb-6">
        <Sprout size={56} className="text-muzo-glow" />
      </div>
      <ChagraGrowLoader size={64} showLabel labelText={MSG.auth.callbackVerifying} />
      {status === 'seleccion' && fincasPendientes && (
        <FincaGroupSelector groups={fincasPendientes} onSelect={seleccionarFinca} loading={seleccionandoFinca} />
      )}
      {status === 'error' && (
        <p role="alert" className="mt-6 text-amber-400 font-bold text-center max-w-sm">
          {MSG.auth.callbackReturn}
        </p>
      )}
    </div>
  );
}
