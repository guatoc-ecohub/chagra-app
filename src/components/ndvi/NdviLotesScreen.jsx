/* eslint-disable chagra-i18n/no-hardcoded-spanish */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Cloud, Leaf, RefreshCw, WifiOff } from 'lucide-react';
import useLoteStore from '../../store/useLoteStore';
import { loteGeoJson } from '../../services/loteService';
import { readCachedNdviSeries, requestNdviSeries } from '../../services/ndviService';

const fechaLegible = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(date);
};

function ObservationRows({ series }) {
  if (!series?.observaciones?.length) return <p className="text-sm text-slate-400">Todavía no hay fechas de escena para este lote.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[390px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-400">
          <tr><th className="py-2 pr-3">Fecha</th><th className="py-2 pr-3">NDVI medio</th><th className="py-2">Lote visible</th></tr>
        </thead>
        <tbody>
          {series.observaciones.map((row) => (
            <tr key={row.fecha} className="border-t border-slate-700/70">
              <td className="py-2 pr-3">{fechaLegible(row.fecha)}</td>
              <td className="py-2 pr-3 font-mono">{row.ndvi_medio == null ? 'Nublado' : Number(row.ndvi_medio).toFixed(3)}</td>
              <td className="py-2">{Number(row.visible_pct).toFixed(0)} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function NdviLotesScreen({ onBack }) {
  const lotes = useLoteStore((state) => state.lotes);
  const hydrate = useLoteStore((state) => state.hydrate);
  const [seriesById, setSeriesById] = useState({});
  const [loadingById, setLoadingById] = useState({});
  const [errorById, setErrorById] = useState({});
  const [isHydrating, setIsHydrating] = useState(true);

  const conPoligono = useMemo(() => lotes.filter((lote) => {
    const geometry = loteGeoJson(lote);
    return geometry && ['Polygon', 'MultiPolygon'].includes(geometry.type);
  }), [lotes]);

  useEffect(() => {
    let alive = true;
    Promise.resolve(hydrate()).finally(() => {
      if (alive) setIsHydrating(false);
    });
    return () => { alive = false; };
  }, [hydrate]);

  useEffect(() => {
    let alive = true;
    Promise.all(conPoligono.map(async (lote) => [lote.id, await readCachedNdviSeries(lote)]))
      .then((entries) => {
        if (alive) setSeriesById((current) => ({ ...Object.fromEntries(entries.filter(([, value]) => value)), ...current }));
      });
    return () => { alive = false; };
  }, [conPoligono]);

  const consultar = useCallback(async (lote) => {
    setLoadingById((current) => ({ ...current, [lote.id]: true }));
    setErrorById((current) => ({ ...current, [lote.id]: '' }));
    try {
      const series = await requestNdviSeries(lote);
      setSeriesById((current) => ({ ...current, [lote.id]: series }));
    } catch (error) {
      setErrorById((current) => ({
        ...current,
        [lote.id]: error.message === 'ndvi_cache_miss'
          ? 'No hay una serie guardada para este lote en este dispositivo. Conéctese para consultarla.'
          : error.message === 'farm_forbidden'
            ? 'Su cuenta no tiene acceso a la finca asociada a este lote.'
            : 'No fue posible consultar la serie. Intente de nuevo cuando tenga conexión.',
      }));
    } finally {
      setLoadingById((current) => ({ ...current, [lote.id]: false }));
    }
  }, []);

  return (
    <main className="h-full overflow-y-auto bg-slate-950 px-4 pb-8 text-slate-100">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-3 py-4">
        <button type="button" onClick={onBack} aria-label="Volver" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-700">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Sentinel-2 · NDVI</p>
          <h1 className="text-xl font-black">Vigor de mis lotes</h1>
        </div>
      </header>
      <section className="mx-auto max-w-3xl space-y-4" aria-live="polite">
        <p className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
          Cada fecha muestra el promedio de los píxeles visibles dentro del polígono. Las fechas con menos de 30 % visible quedan como nubladas y sin valor NDVI.
        </p>
        {isHydrating && <p className="text-sm text-slate-400">Cargando lotes guardados en este dispositivo…</p>}
        {!isHydrating && conPoligono.length === 0 && (
          <p className="rounded-xl border border-slate-800 p-4 text-sm text-slate-300">Aún no hay lotes con polígono asociado a una finca.</p>
        )}
        {conPoligono.map((lote) => {
          const series = seriesById[lote.id];
          const alert = series?.alerta?.estado === 'revisar_el_lote';
          const offline = series?.cache_origen === 'offline' || series?.cache_origen === 'guardada';
          return (
            <article key={lote.id} className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 shadow-lg">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-lg font-bold"><Leaf size={18} className="text-emerald-300" aria-hidden="true" />{lote.attributes?.name || 'Lote sin nombre'}</h2>
                  {series && <p className="mt-1 text-xs text-slate-400">Serie consultada: {fechaLegible(series.serie_generada_en)} · última observación visible: {fechaLegible(series.ultima_visible)}</p>}
                </div>
                <button type="button" onClick={() => consultar(lote)} disabled={!!loadingById[lote.id]} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-600/70 bg-emerald-950 px-3 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-60">
                  {loadingById[lote.id] ? <RefreshCw size={16} className="animate-spin" aria-hidden="true" /> : offline ? <WifiOff size={16} aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
                  {loadingById[lote.id] ? 'Consultando…' : 'Actualizar serie'}
                </button>
              </div>
              {alert && <p className="mt-3 rounded-lg border border-amber-600/50 bg-amber-950/50 p-2 text-sm font-semibold text-amber-200">Revisar el lote: el NDVI bajó frente a su mediana reciente.</p>}
              {series && <div className="mt-3"><ObservationRows series={series} /></div>}
              {series && <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1"><Cloud size={14} aria-hidden="true" />{series.fechas_nubladas} fechas nubladas</span>
                <span>{offline ? 'Mostrando la última serie guardada en este dispositivo.' : 'Serie recibida del sidecar.'}</span>
              </p>}
              {errorById[lote.id] && <p role="status" className="mt-3 rounded-lg bg-slate-800 p-3 text-sm text-slate-200">{errorById[lote.id]}</p>}
            </article>
          );
        })}
      </section>
    </main>
  );
}
