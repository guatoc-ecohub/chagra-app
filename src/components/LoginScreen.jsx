import React, { Suspense, lazy, useState, useEffect, useCallback, useRef } from 'react';
import { User, Lock, Eye, EyeOff, WifiOff, ShieldCheck, Leaf } from 'lucide-react';
import { applyTheme, normalizeTheme, STORAGE_KEY, DEFAULT_THEME } from '../hooks/useTheme';
import { authenticateUser, iniciarLoginPKCE, resolverCaminoLogin } from '../services/authService';
import { setCurrentOperator } from '../services/operatorIdentityService';
import { setActiveTenantId } from '../services/tenantContext';
import { activateFincaForUser } from '../services/fincaGroupService';
import { version as APP_VERSION } from '../../package.json';
import ChagraGrowLoader from './ChagraGrowLoader';
import { CirculoRotoMilpa } from '../visual/effects';
const AngelitaVueloLogin = lazy(() => import('../visual/agente/AngelitaVueloLogin.jsx'));
import { decidirTier } from '../visual/mundo3d/deviceTier.js';
import LaminaMilpa from '../visual/laminas/LaminaMilpa.jsx';
import LegalLinks from './LegalLinks';
import FincaGroupSelector from './FincaGroupSelector';
import OfflineReadiness from './OfflineReadiness';
import './login-screen.css';
const WelcomeStatsHero = lazy(() => import('./WelcomeStatsHero'));
import useThemeBackgroundStore, { getBackgroundSrc, esGradiente } from '../store/useThemeBackgroundStore';
import { friendlyMessage } from '../utils/friendlyErrors';
import { MSG } from '../config/messages';
// MENSAJES_LOGIN_ANGELITA (loginAngelitaMensajes.js) ya NO se importa (2026-09-03,
// feedback_pizarra_unico_aviso_compai): alimentaba la burbuja de bienvenida que
// AngelitaVueloLogin retiró (era un tercer formato de aviso, y de sus 5 mensajes
// solo 1 tenía copy real — los otros 4 eran placeholders sin terminar).

/* Coreografía de Angelita en el login (decisión del operador, 2026-09-28):
   vuela quieta y feliz dentro del círculo, parpadea al segundo 1 y al segundo
   2 sale a volar libre. La ruptura se dispara antes para que el vidrio rompa
   JUSTO cuando ella sale: CirculoRotoMilpa lo rompe 1,62 s después del
   disparo (--crm-rotura en circulo-roto-milpa.css). */
const LOGIN_FASE_MS = {
  ruptura: 380,
  parpadea: 1000,
  sale: 2000,
};

/**
 * LoginScreen — puerta de entrada de Chagra.
 *
 * Es la primera impresión del producto (piloto de campo + demos de
 * convocatorias), así que carga tres trabajos a la vez:
 *   1. Explicar QUÉ es Chagra y POR QUÉ confiarle los datos de la finca
 *      (señales de confianza arriba del formulario: offline, datos propios,
 *      software libre).
 *   2. Dejar entrar rápido a quien ya tiene su usuario (formulario grande,
 *      con objetivos de toque amplios para dedos de campo).
 *   3. Mostrar el impacto real de la red Chagra (WelcomeStatsHero pre-login,
 *      cifras públicas del catálogo — pedido del operador 2026-05-18).
 *
 * Español colombiano en USTED, cálido y campesino (ingrese/escriba/revise).
 * NUNCA voseo argentino.
 *
 * Lógica de autenticación: `handleLogin` consulta
 * authService.resolverCaminoLogin(). El password grant es el camino
 * predeterminado; PKCE se puede activar por configuración.
 * Tras el login exitoso (por cualquiera de los dos caminos) sigue el flujo:
 * operador HMAC → tenant → foto → warm-up Ollama + corpus.
 */
/**
 * Texto del error de ingreso para quien está frente al formulario: en
 * español, sin código HTTP. 400/401/403 (o sin razón) = credenciales; 5xx =
 * servidor; lo demás pasa por friendlyMessage.
 */
function mensajeErrorIngreso(error) {
  const crudo = typeof error === 'string' ? error : (error?.message || '');
  const codigo = Number((crudo.match(/\b(\d{3})\b/) || [])[1]);
  if (!crudo || codigo === 400 || codigo === 401 || codigo === 403) {
    return 'Usuario o contraseña incorrectos. Revíselos e intente de nuevo.';
  }
  if (codigo >= 500) return 'El servidor de Chagra no respondió. Intente de nuevo en un momento.';
  return friendlyMessage(crudo);
}

export default function LoginScreen({ onLoginSuccess, onSave }) {
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(() => !('IntersectionObserver' in window));
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setStatsVisible(true);
        observer.disconnect();
      }
    });
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);
  // Resolver antes del primer JSX evita pintar credenciales que el camino
  // PKCE nunca va a consumir. El resultado solo cambia entre builds/configuraciones.
  const ruta = resolverCaminoLogin();
  const esPKCE = ruta.camino === 'pkce';
  const [creds, setCreds] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [rupturaDisparada, setRupturaDisparada] = useState(false);
  const [angelitaParpadea, setAngelitaParpadea] = useState(false);
  const [fincasPendientes, setFincasPendientes] = useState(null);
  const [angelitaOrigen, setAngelitaOrigen] = useState(null);
  const [triadaPlantada, setTriadaPlantada] = useState(false);
  // Reduced-motion o gama baja: Angelita queda en fotograma digno, sin vuelo.
  const [angelitaQuieta] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
    return decidirTier().tier === 'bajo';
  });
  const orbeRef = useRef(null);
  // Mostrar/ocultar la contraseña ayuda a quien escribe despacio o con poca
  // costumbre del teclado del teléfono a verificar lo que digitó (a11y +
  // baja alfabetización digital). Arranca oculta: el campo sigue siendo
  // type="password" en el primer render.
  const [showPassword, setShowPassword] = useState(false);
  // Error del ingreso junto al formulario (C35, 2026-10-31): el toast salía al
  // pie de la pantalla, lejos de los campos, y con el código HTTP del servidor.
  const [loginError, setLoginError] = useState('');
  // Selector de fondos: en login mostramos el fondo curado como capa de foto.
  // Suscribimos solo el id (string) para evitar React #185. SIEMPRE resolvemos
  // a una foto (getBackgroundSrc); el default universal es "Páramo completo"
  // (DEFAULT_BACKGROUND_SRC), así el login nunca muestra el patrón viejo.
  const selectedBackground = useThemeBackgroundStore((s) => s.selected);
  const loginBgSrc = getBackgroundSrc(selectedBackground);

  /* La coreografía vive aquí, no dentro del asset Fase 1: CirculoRotoMilpa
     solo recibe el flanco de subida de la ruptura, y Angelita sale del círculo
     a su hora aunque la ruptura se atrase. */
  const saleRef = useRef(false);
  const iniciarSalidaAngelita = useCallback(() => {
    if (saleRef.current) return;
    saleRef.current = true;
    const caja = orbeRef.current?.getBoundingClientRect();
    setAngelitaOrigen(caja
      ? { x: caja.left + caja.width / 2 - 42, y: caja.top + caja.height / 2 - 42 }
      : { x: 8, y: 8 });
  }, []);

  const finalizarIngreso = () => {
    // El tier Pro lo decide el servidor (GET /tier); fire-and-forget.
    import('../services/tierService.js')
      .then((m) => m.refreshServerTier())
      .catch(() => {});
    import('../services/operatorPhotoService.js')
      .then((m) => m.loadFromFarmOS())
      .catch(() => {});
    import('../store/useOllamaWarmStore.js')
      .then(({ default: store }) => store.getState().startWarmup())
      .catch((err) => console.warn('[LoginScreen] ollama warm-up dispatch failed:', err));
    setLoading(false);
    onLoginSuccess();
  };

  const seleccionarFinca = async (groupId) => {
    setLoading(true);
    try {
      await activateFincaForUser(creds.username, { groupId });
      setFincasPendientes(null);
      finalizarIngreso();
    } catch (_) {
      setLoading(false);
      onSave('No pudimos abrir esa finca. Intente de nuevo.', true);
    }
  };

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setRupturaDisparada(true), LOGIN_FASE_MS.ruptura),
      window.setTimeout(() => setAngelitaParpadea(true), LOGIN_FASE_MS.parpadea),
      window.setTimeout(iniciarSalidaAngelita, LOGIN_FASE_MS.sale),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [iniciarSalidaAngelita]);

  // The entry can mount without App, so apply the saved skin here too.
  useEffect(() => {
    try { applyTheme(normalizeTheme(localStorage.getItem(STORAGE_KEY))); }
    catch { applyTheme(DEFAULT_THEME); }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!creds.username || (!esPKCE && !creds.password)) {
      onSave(
        esPKCE
          ? 'Escriba su usuario para continuar. Lo usamos para identificar su finca al volver de farmOS.'
          : 'Escriba su usuario y su contraseña para ingresar.',
        true,
      );
      return;
    }

    // PKCE se activa solo mediante configuración y requiere client_id.
    if (ruta.camino === 'bloqueado') {
      onSave(ruta.motivo, true);
      return;
    }

    if (ruta.camino === 'pkce') {
      setLoading(true);
      // La identidad se fija ANTES de salir del dominio. Al regresar por
      // /callback ya no hay input que leer, y el `state` de OAuth es un nonce
      // aleatorio que no identifica a nadie: usarlo como tenant escondia la
      // siembra del login anterior (ver OAuthCallback, hard-test T3-SIEMBRA).
      // Mismo par que el camino password: operador + tenant con el usuario
      // escrito. Es idempotente si luego cae al fallback clasico.
      try {
        await setCurrentOperator(creds.username);
      } catch (err) {
        console.warn('[LoginScreen] setCurrentOperator (pkce) failed:', err);
      }
      try {
        setActiveTenantId(creds.username);
      } catch (err) {
        console.warn('[LoginScreen] setActiveTenantId (pkce) failed:', err);
      }
      let inicio;
      try {
        inicio = await iniciarLoginPKCE({ username: creds.username });
      } catch (err) {
        // Crypto/WebCrypto u otro fallo inesperado construyendo el redirect.
        // NUNCA exponer el mensaje crudo (ver friendlyMessage abajo).
        inicio = { success: false, error: friendlyMessage(err) };
      }
      if (inicio.success) {
        // El navegador ya sale hacia farmOS (/oauth/authorize). Se deja el
        // botón en "Entrando…": si farmOS rechaza (redirect_uri sin
        // registrar, PKCE off en el cliente), el operador vuelve y aterriza
        // de nuevo en esta pantalla.
        return;
      }
      setLoading(false);
      // En PKCE la pantalla no recoge contraseña, así que no puede degradar
      // silenciosamente al grant clásico. Si el acceso seguro falla, informe
      // el problema y deje que el operador reintente o use una build clásica.
      onSave(inicio.error || MSG.auth.accesoSeguroFallido, true);
      return;
    }

    setLoading(true);
    // 2026-05-23 auditoría QA bug #10: si `authenticateUser` throw
    // (network error, JSON parse fail, CORS, AbortError) sin try/catch, el
    // botón quedaba en "Procesando..." infinito sin feedback al usuario.
    // Fix: try/catch + finally garantizan que setLoading(false) corra siempre
    // y que el operador reciba un toast con la razón del fallo.
    let result;
    try {
      result = await authenticateUser(creds.username, creds.password);
    } catch (err) {
      // Errores de red, timeout, CORS, JSON malformado, fetch abortado.
      // NUNCA exponer el mensaje crudo (podía pegar texto técnico de token/HTTP
      // al operador). friendlyMessage mapea a copy claro en español Colombia.
      setLoading(false);
      onSave(friendlyMessage(err), true);
      return;
    }

    if (result.success) {
      // Activar Capa 1 HMAC (ADR-027.v): computa operator_id_hash determinista
      // vía HMAC-SHA256(username, PBKDF2(account_uuid_master, "chagra-salt-v1"))
      // y persiste en localStorage. Los consumidores (InventoryDashboard,
      // RecountDrawer, PlanEditor) dejan de usar 'default-hash-0...' fallback.
      try {
        await setCurrentOperator(creds.username);
      } catch (err) {
        // No bloquear login si falla crypto (browser sin Web Crypto API).
        // Componentes hacen fallback a default-hash. Tracking warning silenciosa.
        console.warn('[LoginScreen] setCurrentOperator failed:', err);
      }
      // ADR-036 MVP multi-finca: persistir el username como tenantId activo.
      // Lo consumen apiService (filter[uid.name]) y useAssetStore (scope IDB).
      // Si el tenantId cambia respecto al previo (re-login con otro usuario),
      // setActiveTenantId emite `tenantChanged` y los stores limpian su caché.
      try {
        const finca = await activateFincaForUser(creds.username);
        if (finca.selectionRequired) {
          setFincasPendientes(finca.groups);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('[LoginScreen] finca resolution failed; keeping user tenant:', err);
        setActiveTenantId(creds.username);
      }
      // Foto de perfil cross-device (2026-06-15): traer del servidor la última
      // foto del operador para este dispositivo. Fire-and-forget — no bloquea
      // el login y es no-throw (degrada al ícono por defecto si falla/offline).
      // NN4 fix 2026-05-23: disparar pre-warm del modelo Ollama configurado ANTES de
      // navegar al dashboard. Esto da ~15-30s de margen humano (el operador
      // mira el dashboard, escoge una tile, abre el agente) durante los
      // cuales el modelo se carga en GPU en background. Sin esto, la
      // primera query al agente caía al cold-start 116s. Fire-and-forget:
      // el store maneja el estado, AgentScreen lo lee y muestra banner si
      // todavía está warming cuando el operador llega al agente.
      // Idempotente: si por alguna razón se llama 2 veces, el store
      // dedupea internamente.
      // PERF arranque (diag documentación interna, orden 1): el
      // pre-warm del corpus RAG ya NO se dispara acá, en el handler de submit
      // antes de navegar. Medido en chagra-dev (build 0afe6f0a): del submit a
      // la primera pantalla autenticada pasaban 48.501 s y 44.879 s, con
      // 1.245 solicitudes post-submit (940 del corpus) compitiendo por la red
      // contra el chunk del dashboard y catalog.sqlite (2,93 MB) + WASM
      // (427 KB). El dueño del pre-warm ahora es el efecto de App.jsx que
      // corre cuando `currentView === 'dashboard'` (ya existía como fallback
      // para sesión persistida): el corpus se calienta DESPUÉS de que el shell
      // autenticado se montó, no antes de navegar. prewarmCorpus sigue siendo
      // idempotente, así que no hay doble trabajo.
      finalizarIngreso();
    } else {
      setLoading(false);
      // El texto va junto al formulario y nunca lleva el código HTTP.
      setLoginError(mensajeErrorIngreso(result.error));
    }
  };

  const plantarTriada = useCallback(() => setTriadaPlantada(true), []);
  const angelitaLibre = angelitaOrigen !== null;

  return (
    <div className="login-screen relative min-h-[100dvh] w-full bg-slate-950 flex flex-col items-center overflow-y-auto text-slate-100 px-5 sm:px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {fincasPendientes && <FincaGroupSelector groups={fincasPendientes} onSelect={seleccionarFinca} loading={loading} />}
      {/* Capa 1 — Foto del páramo curado. Detrás de todo, con un gradiente de
          legibilidad que usa la superficie del tema. Las superficies de
          lectura son opacas para conservar el contraste sobre la foto. */}
      {loginBgSrc && (
        <div
          aria-hidden="true"
          className="login-bg-photo absolute inset-0 pointer-events-none bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgb(var(--c-slate-950) / 0.72), rgb(var(--c-slate-950) / 0.82) 55%, rgb(var(--c-slate-950) / 0.92)), ${esGradiente(loginBgSrc) ? loginBgSrc : `url('${loginBgSrc}')`}`,
          }}
        />
      )}
      {/* Capa 2 — Aurora del páramo: dos resplandores suaves (esmeralda de Muzo
          + cian Morpho) que dan "vida" y profundidad detrás de la marca sin
          restar legibilidad. Puro CSS, sin assets nuevos. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[60vh] pointer-events-none"
        style={{
          opacity: 'var(--fx-glow-opacity)',
          background:
            'radial-gradient(60% 45% at 50% 8%, rgb(var(--c-muzo) / 0.20), transparent 70%), radial-gradient(55% 40% at 78% 22%, rgb(var(--c-morpho) / 0.14), transparent 70%)',
        }}
      />

      <main className="relative z-10 w-full max-w-md flex flex-col items-center gap-4 animate-fadeIn">
        {/* ─────────────────────────────────────────────────────────────
            MARCA — Angelita vuela quieta dentro de la milpa, parpadea, y sale
            a volar libre cuando la raíz rompe el círculo, sin tapar el
            formulario. La animación es liviana y no carga el avatar del
            shell pre-auth.
            ───────────────────────────────────────────────────────────── */}
        <header className="flex flex-col items-center text-center gap-2 p-2 rounded-3xl bg-slate-950">
          <div ref={orbeRef} className="login-abejita-stage">
            <CirculoRotoMilpa
              trigger={rupturaDisparada || angelitaLibre}
              onRupturaCompleta={iniciarSalidaAngelita}
              onAsentado={plantarTriada}
              className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-900/70 backdrop-blur-sm ring-1 ring-muzo/40 shadow-neon-muzo"
            >
              <Suspense fallback={null}><AngelitaVueloLogin
                libre={angelitaLibre}
                origen={angelitaOrigen}
                parpadea={angelitaParpadea}
                quieta={angelitaQuieta}
                invitando={Boolean(creds.username.trim())}
              /></Suspense>
              {triadaPlantada && (
                <div
                  className="login-triada-piso"
                  data-testid="login-triada-piso"
                  aria-hidden="true"
                >
                  <LaminaMilpa aria-hidden="true" />
                </div>
              )}
            </CirculoRotoMilpa>
          </div>

          <div>
            <h1 className="text-5xl font-black tracking-tight text-slate-100">
              Chagra
            </h1>
            <p className="mt-2 text-base text-slate-200 font-medium">
              Su finca, a un toque.
            </p>
          </div>

        </header>

        {/* ─────────────────────────────────────────────────────────────
            FORMULARIO — la acción principal. Tarjeta con superficie propia
            (blur + borde) para que se lea como un panel confiable sobre la
            foto. Campos grandes con ícono guía y objetivos de toque amplios.
            ───────────────────────────────────────────────────────────── */}
        <section
          className="w-full rounded-3xl border border-slate-700/70 bg-slate-900 shadow-2xl p-4 sm:p-5"
          aria-labelledby="login-heading"
        >
          <h2 id="login-heading" className="text-lg font-bold text-slate-100 mb-1">
            Entre a su finca
          </h2>
          <p className="text-base text-slate-300 mb-3">
            {esPKCE
              ? 'Chagra no le pide ni guarda su contraseña.'
              : 'Escriba su usuario y contraseña.'}
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-3" aria-busy={loading}>
            <div className="flex flex-col gap-2">
              <label htmlFor="login-username" className="text-lg font-bold text-slate-100">
                Usuario
              </label>
              <div className="relative">
                <User
                  size={22}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                  aria-hidden="true"
                />
                <input
                  id="login-username"
                  aria-invalid={loginError ? true : undefined}
                  aria-describedby={loginError ? 'login-error' : undefined}
                  type="text"
                  value={creds.username}
                  onChange={e => setCreds(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-lg min-h-[52px] text-slate-100 placeholder-slate-300 transition-colors focus:border-emerald-500 focus:bg-slate-950"
                  placeholder="Su usuario"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
            </div>

            {!esPKCE && (
              <div className="flex flex-col gap-2">
                <label htmlFor="login-password" className="text-lg font-bold text-slate-100">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock
                    size={22}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                    aria-hidden="true"
                  />
                  <input
                    id="login-password"
                  aria-invalid={loginError ? true : undefined}
                  aria-describedby={loginError ? 'login-error' : undefined}
                    type={showPassword ? 'text' : 'password'}
                    value={creds.password}
                    onChange={e => setCreds(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full pl-12 pr-14 py-3 rounded-xl bg-slate-950 border border-slate-700 text-lg min-h-[52px] text-slate-100 placeholder-slate-300 transition-colors focus:border-emerald-500 focus:bg-slate-950"
                    placeholder="Su contraseña"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPassword}
                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 transition-colors"
                  >
                    {showPassword ? <EyeOff size={22} aria-hidden="true" /> : <Eye size={22} aria-hidden="true" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="login-submit mt-1 min-h-[56px] p-3 rounded-2xl text-xl font-black flex justify-center items-center gap-3 border-b-4 transition-all active:translate-y-0.5 active:border-b-2"
            >
              {loading ? (
                <>
                  <ChagraGrowLoader size={48} initialProgress={0.4} />
                  <span className="text-lg font-bold">Entrando…</span>
                </>
              ) : (
                esPKCE ? 'Continuar' : 'Ingresar'
              )}
            </button>
            {loginError && (
              <p id="login-error" role="alert" className="login-error rounded-xl border border-red-400/60 bg-red-950/70 px-3 py-2 text-base font-bold text-red-100">
                {loginError}
              </p>
            )}
          </form>

        </section>

        <a
          href="https://edu.chagra.bio/juego/mundo/"
          className="login-play-link flex w-full min-h-[48px] items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-base font-bold text-slate-100 hover:bg-slate-800 transition-colors"
        >
          Aprender jugando
        </a>
        <ul className="flex flex-wrap justify-center gap-2 text-sm text-slate-200" aria-label="Compromisos de Chagra">
          <li className="flex items-center gap-1"><WifiOff size={16} aria-hidden="true" /> <OfflineReadiness /></li>
          <li className="flex items-center gap-1"><ShieldCheck size={16} aria-hidden="true" /> Sus datos son suyos</li>
          <li className="flex items-center gap-1"><Leaf size={16} aria-hidden="true" /> Software libre</li>
        </ul>

        <LegalLinks />

        {/* ─────────────────────────────────────────────────────────────
            IMPACTO — la red Chagra hoy. Cifras públicas del catálogo, visibles
            antes de entrar (pedido del operador 2026-05-18). Va después del
            formulario: sirve de prueba de confianza y de demo para
            convocatorias, sin estorbarle la entrada al campesino de afán.
            ───────────────────────────────────────────────────────────── */}
        <section ref={statsRef} className="w-full" aria-label="La red Chagra hoy">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 text-center mb-3">
            Lo que Chagra ya cuida
          </p>
          <Suspense fallback={null}>
            {statsVisible && <WelcomeStatsHero mode="pre-login" />}
          </Suspense>
        </section>

        <p className="text-2xs text-slate-300 font-mono -mt-4 mb-2">
          Chagra v{APP_VERSION}
        </p>
      </main>
    </div>
  );
}
