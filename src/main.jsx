/* eslint-disable react-refresh/only-export-components -- Entry owns the single React root. */
import React, { Suspense, lazy, useState } from 'react';
import { createRoot } from 'react-dom/client';
import localforage from 'localforage';
import './index.css';
import './styles/themes.css';
import './styles/piel-home-a.css';
import { isAuthenticated } from './services/authService';
import { registerServiceWorker } from './services/swRegistration';
import { runCanonicalHostRedirectGuard } from './services/canonicalHostRedirect';
import { ErrorBoundary } from './components/ErrorBoundary';
import ChagraGrowLoader from './components/ChagraGrowLoader';

const LoginScreen = lazy(() => import('./components/LoginScreen'));

// Same namespace as existing installations, before the first session read.
localforage.config({ name: 'Chagra', storeName: 'syncQueue' });

function EntryLogin({ onLoginSuccess }) {
  const [notice, setNotice] = useState(null);
  return <>
    <LoginScreen onLoginSuccess={onLoginSuccess} onSave={(message, isError) => setNotice({ message, isError })} />
    {notice && <div role={notice.isError ? 'alert' : 'status'} className="fixed bottom-6 left-4 right-4 z-[100] rounded-xl bg-slate-800 p-4 text-white">{notice.message}</div>}
  </>;
}

// Registrar independientemente del runtime autenticado. Incluso si el usuario
// corta la señal en el ingreso, el origen conserva su shell navegable.
if (!runCanonicalHostRedirectGuard().redirected) {
  registerServiceWorker();
  const root = createRoot(document.getElementById('root'));
  let mounting = null;
  const loadAuthenticatedRuntime = () => import('./appRuntime').then(
    runtime => ({ runtime }),
    error => ({ error }),
  );
  const mountAuthenticatedApp = (runtimePromise = null) => {
    if (!mounting) {
      const runtime = runtimePromise || loadAuthenticatedRuntime();
      const theme = localStorage.getItem('chagra:theme');
      // Legacy homes retain the complete conversation at startup.
      // Home A can accept a draft while its conversation downloads.
      const conversation = theme && theme !== 'home-a'
        ? import('./components/AgentScreen/AgentScreen').catch(() => {})
        : Promise.resolve();
      mounting = conversation.then(() => runtime).then(({ runtime: loadedRuntime, error }) => {
        if (error) throw error;
        return loadedRuntime.mountApp(root);
      });
    }
    return mounting;
  };
  const applyPostLoginDestination = async () => {
    try {
      // Load the shared decision only after authentication so the isolated
      // login shell does not pull profile data or the app runtime at startup.
      const { resolveDestinoPostLogin } = await import('./services/userProfileService.js');
      // C04 2026-10-31: a fresh browser/device never saw the onboarding
      // locally, so resolveDestinoPostLogin() always sent it back to
      // 'onboarding-perfil' — even when this same account already finished
      // onboarding elsewhere. Give farmOS a chance to restore that state
      // FIRST; the destination decision below then sees the restored flags.
      const { restoreOnboardingProfileIfMissing } = await import('./services/onboardingProfileSync.js');
      await restoreOnboardingProfileIfMissing();
      const destination = resolveDestinoPostLogin();
      const nextUrl = `${window.location.pathname}${window.location.search}#/${destination}`;
      window.history.replaceState(window.history.state, '', nextUrl);
    } catch (error) {
      // A storage or chunk failure must not strand an authenticated user on
      // the login screen; App's existing initial-route fallback is dashboard.
      console.warn('[entry] Post-login destination could not be resolved:', error?.message);
    }
  };
  const handleLoginSuccess = async () => {
    const runtime = loadAuthenticatedRuntime();
    await applyPostLoginDestination();
    return mountAuthenticatedApp(runtime);
  };
  const showLogin = () => root.render(
    <ErrorBoundary>
      <Suspense fallback={<ChagraGrowLoader />}>
        <EntryLogin onLoginSuccess={handleLoginSuccess} />
      </Suspense>
    </ErrorBoundary>,
  );
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  const isDefaultAppRoute = window.location.pathname === '/' && (!hash || hash === 'dashboard') &&
    !new URLSearchParams(window.location.search).has('onboarding');
  const isAppRoute = window.location.pathname !== '/' ||
    (hash && !['login', 'dashboard'].includes(hash)) ||
    new URLSearchParams(window.location.search).has('onboarding');
  if (isAppRoute) mountAuthenticatedApp();
  else isAuthenticated().then(async active => {
    if (!active) return showLogin();
    if (!isDefaultAppRoute) return mountAuthenticatedApp();
    const runtime = loadAuthenticatedRuntime();
    await applyPostLoginDestination();
    return mountAuthenticatedApp(runtime);
  }).catch(showLogin);
}
