import { useEffect, useState } from 'react';
import { getLatestIotReadingForLot } from '../../services/iotTelemetryService.js';

/** @typedef {Awaited<ReturnType<typeof getLatestIotReadingForLot>> | { status: 'loading' }} IotReadingCardResult */

const REFRESH_MS = 60_000;

/** @type {IotReadingCardResult} */
const INITIAL_RESULT = { status: 'loading' };

function formatDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'hora no disponible';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function LoteIotReadingCard({ lotId }) {
  const [result, setResult] = useState(INITIAL_RESULT);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let timer;
    let controller;
    const read = async () => {
      controller = new AbortController();
      const next = await getLatestIotReadingForLot(lotId, { signal: controller.signal });
      if (!active) return;
      setResult(next);
      timer = setTimeout(read, REFRESH_MS);
    };
    read();
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [lotId]);

  const localStatus = (() => {
    if (result.status !== 'fresh') return result.status;
    if (now === 0) return 'loading';
    const age = now - Date.parse(result.reading.sampled_at);
    return age > result.stale_after_hours * 60 * 60 * 1000 ? 'stale' : 'fresh';
  })();

  const lastAt = result.status === 'stale'
    ? result.last_reading_at
    : result.status === 'fresh' ? result.reading.sampled_at : undefined;
  const timeQuality = result.status === 'stale'
    ? result.time_quality
    : result.status === 'fresh' ? result.reading.time_quality : undefined;
  const timeLabel = timeQuality === 'estimated' ? ' · hora estimada' : '';

  return (
    <section className="mt-2 w-full rounded-lg border border-emerald-800/70 bg-emerald-950/45 p-3 text-emerald-50" aria-label="Lectura de sensores del lote">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-black uppercase tracking-wide text-emerald-100">Sensores de campo</h3>
        <span className="rounded-full bg-amber-900/50 px-2 py-0.5 text-[10px] font-bold text-amber-100">Solo alerta</span>
      </div>
      {localStatus === 'loading' && <p className="mt-2 text-xs text-emerald-100/70">Consultando la última lectura…</p>}
      {localStatus === 'empty' && <p className="mt-2 text-xs text-emerald-100/70">Aún no hay lecturas para este lote.</p>}
      {localStatus === 'unavailable' && <p className="mt-2 text-xs text-emerald-100/70">Lectura no disponible en este momento.</p>}
      {localStatus === 'stale' && (
        <p className="mt-2 text-xs font-semibold text-amber-100" role="status">
          Sin datos desde {formatDate(lastAt)}{timeLabel}.
        </p>
      )}
      {localStatus === 'fresh' && result.status === 'fresh' && (
        <>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div><dt className="text-[10px] text-emerald-100/65">Suelo</dt><dd className="text-sm font-black">{result.reading.soil_moisture_pct.toFixed(1)}%</dd></div>
            <div><dt className="text-[10px] text-emerald-100/65">Aire</dt><dd className="text-sm font-black">{result.reading.air_temperature_c.toFixed(1)} °C</dd></div>
            <div><dt className="text-[10px] text-emerald-100/65">Humedad</dt><dd className="text-sm font-black">{result.reading.air_humidity_pct.toFixed(1)}%</dd></div>
            <div><dt className="text-[10px] text-emerald-100/65">Luz</dt><dd className="text-sm font-black">{result.reading.light_lux.toFixed(0)} lux</dd></div>
          </dl>
          <p className="mt-2 text-[10px] text-emerald-100/60">Lectura {formatDate(result.reading.sampled_at)}{timeLabel} · no activa riego.</p>
        </>
      )}
    </section>
  );
}
