import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Droplets, Check, Pencil, Trash2, ArrowRight, CloudOff } from 'lucide-react';
import { ScreenShell } from '../common/ScreenShell';
import { MSG } from '../../config/messages.js';
import DescensoLaunch, { DescensoOverlay } from '../DescensoLaunch.jsx';
import RiegoDeHoy from './RiegoDeHoy.jsx';
import useAssetStore from '../../store/useAssetStore';
import {
  CAMPOS_RESUMEN,
  MUNDOS_GOTEO,
  decodificarDiseno,
  guardarPorConfirmar,
  leerParametroEnlace,
  leerPorConfirmar,
  olvidarPorConfirmar,
  rutaCambiarEnMundo,
} from '../../services/goteoDiseno';
import {
  actualizarSistema,
  crearSistema,
  marcarComprado,
  quitarSistema,
  sistemasDeGoteo,
} from '../../services/miGoteoService';

/**
 * MiGoteoScreen — «Mi goteo»: los sistemas de goteo de la finca.
 *
 * Entra un diseño de dos maneras: por el enlace que arma un mundo del goteo
 * (`#mi_goteo?d=…`) o por mensaje desde la pieza abierta dentro de la app.
 * En los dos casos se muestra para confirmar antes de guardar. Nada del
 * enlace se pinta como HTML: todo pasa por goteoDiseno y sale como texto.
 *
 * @param {object} props
 * @param {Function} [props.onBack]
 * @param {Function} [props.onHome]
 */

const fmt = (n, decimales = 1) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: decimales });

function valorResumen(k, v) {
  const campo = CAMPOS_RESUMEN[k];
  if (!campo) return null;
  if (campo.tipo === 'txt') return v.charAt(0).toLocaleUpperCase('es-CO') + v.slice(1);
  // El caudal del gotero se pide con su número exacto (0,85 L/h no es 0,9).
  const n = fmt(v, k === 'caudal_lh' ? 2 : 1);
  return campo.unidad ? `${n} ${campo.unidad}` : n;
}

function Resumen({ resumen }) {
  const filas = Object.keys(CAMPOS_RESUMEN).filter((k) => resumen[k] !== undefined && !(resumen[k] === 0 && k === 'cinta_m'));
  if (!filas.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-2" data-testid="goteo-resumen">
      {filas.map((k) => (
        <div key={k} className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
          <dt className="text-xs text-slate-300">{CAMPOS_RESUMEN[k].etiqueta}</dt>
          <dd className="text-base font-bold text-white">{valorResumen(k, resumen[k])}</dd>
        </div>
      ))}
    </dl>
  );
}

/** @param {{piezas: Array<{n:string, q:string, med?:string}>, comprado?: string[], onMarcar?: (n:string, si:boolean) => void}} props */
function ListaPiezas({ piezas, comprado = [], onMarcar = undefined }) {
  const hechos = new Set(comprado);
  return (
    <ul className="divide-y divide-white/10" data-testid="goteo-piezas">
      {piezas.map((p, i) => {
        const marcado = hechos.has(p.n);
        return (
          <li key={`${p.n}-${i}`} className="flex items-start gap-3 py-2">
            {onMarcar ? (
              <input
                type="checkbox"
                className="mt-1 h-6 w-6 shrink-0 accent-emerald-500"
                checked={marcado}
                onChange={(e) => onMarcar(p.n, e.target.checked)}
                aria-label={`Ya compré: ${p.n}`}
              />
            ) : null}
            <div className="min-w-0">
              <p className={`font-semibold ${marcado ? 'text-slate-400 line-through' : 'text-white'}`}>
                {p.n} <span className="font-normal text-emerald-200">· {p.q}</span>
              </p>
              {p.med ? <p className="text-sm text-slate-300">{p.med}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Recibido({ resultado, sistemas, onGuardar, onDescartar, guardando }) {
  const [nombre, setNombre] = useState(resultado.ok ? resultado.diseno.nombre : '');
  // Llega también al volver del mundo, con la pantalla desplazada hacia abajo:
  // lo que hay por confirmar se trae a la vista (el que se desplaza es el
  // contenedor de ScreenShell, no la ventana).
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollIntoView?.({ block: 'start' }); }, []);
  if (!resultado.ok) {
    return (
      <section ref={ref} role="alert" className="rounded-2xl border border-amber-400/50 bg-amber-950/60 p-4" data-testid="goteo-rechazado">
        <h2 className="text-lg font-bold text-amber-100">Este enlace no se pudo leer</h2>
        <p className="mt-1 text-amber-100/90">{MSG.miGoteo.rechazadoTexto}</p>
        <p className="mt-1 text-sm text-amber-200/80">Motivo: {resultado.motivo}.</p>
        <button type="button" onClick={onDescartar} className="mt-3 min-h-11 rounded-xl border border-amber-300/60 px-4 font-bold text-amber-50">Entendido</button>
      </section>
    );
  }
  const d = resultado.diseno;
  const existente = d.id ? sistemas.find((s) => s.id === d.id) : null;
  return (
    <section ref={ref} className="rounded-2xl border border-emerald-500/50 bg-emerald-950/60 p-4" aria-labelledby="goteo-recibido-t" data-testid="goteo-recibido">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Llegó del mundo del goteo</p>
      <h2 id="goteo-recibido-t" className="text-xl font-bold text-white">{MUNDOS_GOTEO[d.mundo].titulo}</h2>
      <p className="mt-1 text-slate-200">Revíselo antes de guardarlo en su finca.</p>
      <div className="mt-3"><Resumen resumen={d.resumen} /></div>
      <details className="mt-3 rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">
        <summary className="min-h-11 cursor-pointer py-2 font-bold text-white">La lista de compra ({d.piezas.length} piezas)</summary>
        <ListaPiezas piezas={d.piezas} />
      </details>
      <label className="mt-3 block">
        <span className="text-sm text-slate-200">Nombre del sistema</span>
        <input
          type="text"
          value={nombre}
          maxLength={60}
          onChange={(e) => setNombre(e.target.value)}
          className="mt-1 block min-h-11 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 text-white"
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        {existente ? (
          <>
            <button type="button" disabled={guardando} onClick={() => onGuardar(d, nombre, existente.id)} className="min-h-11 rounded-xl bg-emerald-500 px-4 font-bold text-emerald-950">
              Actualizar «{existente.nombre}»
            </button>
            <button type="button" disabled={guardando} onClick={() => onGuardar(d, nombre, null)} className="min-h-11 rounded-xl border border-emerald-300/60 px-4 font-bold text-emerald-50">
              {MSG.miGoteo.guardarOtro}
            </button>
          </>
        ) : (
          <button type="button" disabled={guardando} onClick={() => onGuardar(d, nombre, null)} className="min-h-11 rounded-xl bg-emerald-500 px-4 font-bold text-emerald-950">
            {MSG.miGoteo.guardar}
          </button>
        )}
        <button type="button" disabled={guardando} onClick={onDescartar} className="min-h-11 rounded-xl border border-white/25 px-4 font-bold text-white">
          No guardar
        </button>
      </div>
    </section>
  );
}

function Sistema({ sistema, abierto, onAbrir, onCambiarEnMundo, onAviso }) {
  const [renombrando, setRenombrando] = useState(false);
  const [nombre, setNombre] = useState(sistema.nombre);
  const [quitando, setQuitando] = useState(false);
  const d = sistema.diseno;
  const total = d.piezas.length;
  const hechas = sistema.comprado.length;

  const marcar = async (n, si) => {
    try { await marcarComprado(sistema.id, n, si); } catch { onAviso(MSG.miGoteo.errorMarcar); }
  };
  const renombrar = async (e) => {
    e.preventDefault();
    try { await actualizarSistema(sistema.id, { nombre }); setRenombrando(false); onAviso('Nombre cambiado.'); } catch { onAviso(MSG.miGoteo.errorNombre); }
  };
  const quitar = async () => {
    try { await quitarSistema(sistema.id); onAviso('Sistema quitado de su finca.'); } catch { onAviso(MSG.miGoteo.errorQuitar); }
  };

  return (
    <li className="rounded-2xl border border-white/15 bg-slate-900/70" data-testid="goteo-sistema">
      <button type="button" onClick={onAbrir} aria-expanded={abierto} className="flex min-h-11 w-full items-start gap-3 p-4 text-left">
        <Droplets size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-sky-300" />
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold text-white">{sistema.nombre}</span>
          <span className="block text-sm text-slate-300">{MUNDOS_GOTEO[d.mundo].titulo} · {hechas} de {total} piezas compradas</span>
          {sistema.pendiente ? (
            <span className="mt-1 inline-flex items-center gap-1 text-sm text-amber-200"><CloudOff size={14} aria-hidden="true" /> {MSG.miGoteo.pendiente}</span>
          ) : null}
        </span>
      </button>
      {abierto ? (
        <div className="space-y-4 px-4 pb-4">
          <Resumen resumen={d.resumen} />
          <div>
            <h3 className="text-base font-bold text-white">Lista de compra</h3>
            <p className="text-sm text-slate-300">Marque lo que ya compró.</p>
            <ListaPiezas piezas={d.piezas} comprado={sistema.comprado} onMarcar={marcar} />
          </div>
          {renombrando ? (
            <form onSubmit={renombrar} className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="text-sm text-slate-200">Nombre</span>
                <input type="text" value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 text-white" />
              </label>
              <button type="submit" className="min-h-11 rounded-xl bg-emerald-500 px-4 font-bold text-emerald-950"><Check size={16} aria-hidden="true" className="inline" /> Listo</button>
            </form>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onCambiarEnMundo(sistema)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-500 px-4 font-bold text-sky-950">
              Cambiar en el mundo <ArrowRight size={16} aria-hidden="true" />
            </button>
            {!renombrando ? (
              <button type="button" onClick={() => setRenombrando(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 px-4 font-bold text-white">
                <Pencil size={16} aria-hidden="true" /> Cambiar el nombre
              </button>
            ) : null}
            {quitando ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="text-sm text-amber-100">¿Quitarlo de su finca?</span>
                <button type="button" onClick={quitar} className="min-h-11 rounded-xl bg-amber-500 px-4 font-bold text-amber-950">Sí, quitar</button>
                <button type="button" onClick={() => setQuitando(false)} className="min-h-11 rounded-xl border border-white/25 px-4 font-bold text-white">No</button>
              </span>
            ) : (
              <button type="button" onClick={() => setQuitando(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 px-4 font-bold text-white">
                <Trash2 size={16} aria-hidden="true" /> Quitar
              </button>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** @param {{onBack?: () => void, onHome?: () => void}} props */
export default function MiGoteoScreen({ onBack = undefined, onHome = undefined }) {
  const equipment = useAssetStore((s) => s.equipment);
  const isHydrated = useAssetStore((s) => s.isHydrated);
  const hydrate = useAssetStore((s) => s.hydrate);
  const [porConfirmar, setPorConfirmar] = useState(() => leerPorConfirmar());
  const [abierto, setAbierto] = useState(null);
  const [mundo, setMundo] = useState(null);
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { if (!isHydrated) hydrate?.(); }, [isHydrated, hydrate]);

  // El enlace trae el diseño en la dirección: se deja por confirmar y se
  // limpia la dirección, para que recargar no lo vuelva a preguntar.
  useEffect(() => {
    const leer = () => {
      const d = leerParametroEnlace(window.location.hash);
      if (!d) return;
      guardarPorConfirmar(d);
      setPorConfirmar(d);
      try { window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#mi_goteo`); } catch { /* sin history */ }
    };
    leer();
    window.addEventListener('hashchange', leer);
    return () => window.removeEventListener('hashchange', leer);
  }, []);

  const sistemas = useMemo(() => sistemasDeGoteo(equipment), [equipment]);
  const resultado = useMemo(() => (porConfirmar !== null ? decodificarDiseno(porConfirmar) : null), [porConfirmar]);

  const descartar = useCallback(() => { olvidarPorConfirmar(); setPorConfirmar(null); }, []);

  const guardar = useCallback(async (diseno, nombre, idExistente) => {
    setGuardando(true);
    try {
      if (idExistente) {
        await actualizarSistema(idExistente, { diseno, nombre });
        setAbierto(idExistente);
      } else {
        const asset = await crearSistema(diseno, nombre);
        setAbierto(asset.id);
      }
      olvidarPorConfirmar();
      setPorConfirmar(null);
      setAviso(navigator.onLine === false ? MSG.miGoteo.guardadoSinSenal : MSG.miGoteo.guardado);
    } catch {
      setAviso(MSG.miGoteo.errorGuardar);
    } finally {
      setGuardando(false);
    }
  }, []);

  const recibirDelMundo = useCallback((d) => {
    setMundo(null);
    guardarPorConfirmar(d);
    setPorConfirmar(typeof d === 'string' ? d : '');
  }, []);

  const cambiarEnMundo = useCallback((sistema) => {
    const src = rutaCambiarEnMundo(sistema.diseno, sistema.id);
    if (src) setMundo({ slug: sistema.diseno.mundo, src });
  }, []);

  return (
    <ScreenShell title="Mi goteo" icon={Droplets} onBack={onBack} onHome={onHome}>
      <div className="mx-auto max-w-xl space-y-4 px-4 pb-10 pt-4" data-testid="mi-goteo">
        <p role="status" aria-live="polite" className={aviso ? 'rounded-xl bg-slate-900/80 px-3 py-2 text-emerald-100' : 'sr-only'}>{aviso}</p>
        {resultado ? (
          <Recibido
            key={porConfirmar || 'vacio'}
            resultado={resultado}
            sistemas={sistemas}
            guardando={guardando}
            onGuardar={guardar}
            onDescartar={descartar}
          />
        ) : null}
        {sistemas.length ? <RiegoDeHoy sistemas={sistemas} /> : null}
        {sistemas.length ? (
          <section aria-labelledby="goteo-sistemas-t">
            <h2 id="goteo-sistemas-t" className="mb-2 text-lg font-bold text-white">Los sistemas de su finca</h2>
            <ul className="space-y-3">
              {sistemas.map((s) => (
                <Sistema
                  key={s.id}
                  sistema={s}
                  abierto={abierto === s.id}
                  onAbrir={() => setAbierto(abierto === s.id ? null : s.id)}
                  onCambiarEnMundo={cambiarEnMundo}
                  onAviso={setAviso}
                />
              ))}
            </ul>
          </section>
        ) : !resultado ? (
          <section className="rounded-2xl border border-white/15 bg-slate-900/70 p-4" data-testid="goteo-vacio">
            <h2 className="text-lg font-bold text-white">Todavía no tiene un sistema de goteo guardado</h2>
            <p className="mt-1 text-slate-200">{MSG.miGoteo.vacioTexto}</p>
          </section>
        ) : null}
        <DescensoLaunch slug="riego-goteo" onGoteo={recibirDelMundo} />
      </div>
      {mundo ? (
        <DescensoOverlay slug={mundo.slug} src={mundo.src} onGoteo={recibirDelMundo} onClose={() => setMundo(null)} />
      ) : null}
    </ScreenShell>
  );
}
