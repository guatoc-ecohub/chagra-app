import React, { useEffect, useMemo, useState } from 'react';
import useAssetStore from '../store/useAssetStore';
import { useLogStore } from '../store/useLogStore';
import { getSoilGridsEstimate } from '../services/soilGridsService';
import { MSG } from '../config/messages';
import {
  buildSoilLabLog,
  createEmptySoilLabForm,
  SOIL_LAB_MEASUREMENTS,
  validateSoilLabForm,
} from '../utils/soilLab';
const EMPTY_LOGS = [];

const readLabReport = (log) => {
  const raw = log?.attributes?.data ?? log?.data;
  if (!raw) return null;
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return data?.schema === 'chagra.soil-lab-report.v1' ? data : null;
  } catch {
    return null;
  }
};

const DEPTH_LABELS = { '0-5cm': '0 a 5 cm', '5-15cm': '5 a 15 cm', '15-30cm': '15 a 30 cm' };
const formatDate = (value) => {
  if (!value) return 'Fecha no disponible';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleDateString('es-CO');
};

function MeasurementInput({ field, value, unit, error, onValueChange, onUnitChange }) {
  const options = [field.unit, ...(field.alternatives || [])];
  const selectValue = options.includes(unit) ? unit : 'otra';
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-sm font-semibold text-slate-100">{field.label}</span>
      <span className="flex min-h-11 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 focus-within:border-emerald-500">
        <input
          aria-label={field.label}
          aria-invalid={Boolean(error)}
          inputMode="decimal"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none"
          placeholder="Sin dato"
        />
        {options.length === 1 ? (
          <span className="flex items-center border-l border-slate-800 px-3 text-xs text-emerald-200">{field.unit}</span>
        ) : (
          <select
            aria-label={`Unidad de ${field.label}`}
            value={selectValue}
            onChange={(event) => onUnitChange(event.target.value === 'otra' ? '' : event.target.value)}
            className="max-w-[46%] border-l border-slate-800 bg-slate-900 px-2 text-xs text-emerald-100 outline-none"
          >
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
            <option value="otra">Otra unidad</option>
          </select>
        )}
      </span>
      {selectValue === 'otra' && (
        <input
          aria-label={`Otra unidad de ${field.label}`}
          value={unit}
          onChange={(event) => onUnitChange(event.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
          placeholder="Escriba la unidad del informe"
        />
      )}
      {error && <span role="alert" className="block text-xs text-rose-300">{error}</span>}
    </label>
  );
}

function SoilEstimate({ estimate, loading }) {
  if (loading) return <p className="text-sm text-slate-300" role="status">Consultando SoilGrids para este punto…</p>;
  if (!estimate) return <p className="text-sm text-amber-100" role="status">Sin estimado disponible para este lote.</p>;
  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
        Estimado por satélite y modelo, resolución 250 m, no reemplaza un análisis.
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full min-w-[440px] border-collapse text-left text-xs">
          <thead className="bg-slate-900 text-slate-300">
            <tr><th className="px-3 py-2">Profundidad</th><th className="px-3 py-2">pH</th><th className="px-3 py-2">Carbono orgánico</th><th className="px-3 py-2">Textura, arena / limo / arcilla</th></tr>
          </thead>
          <tbody>
            {estimate.depths.map((row) => (
              <tr key={row.depth} className="border-t border-slate-800 text-slate-100">
                <th scope="row" className="px-3 py-2 font-semibold">{DEPTH_LABELS[row.depth] || row.depth}</th>
                <td className="px-3 py-2 tabular-nums">{row.ph.value} {row.ph.unit}</td>
                <td className="px-3 py-2 tabular-nums">{row.organicCarbon.value} {row.organicCarbon.unit}</td>
                <td className="px-3 py-2 tabular-nums">{row.texture.sand.value} / {row.texture.silt.value} / {row.texture.clay.value} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Fuente: <a className="underline decoration-emerald-500 underline-offset-2" href="https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html" target="_blank" rel="noreferrer">SoilGrids {estimate.modelVersion}</a>. Consultado {new Date(estimate.retrievedAt).toLocaleDateString('es-CO')}. El píxel no informa fecha de muestreo.
      </p>
    </div>
  );
}

export function LandSoilSection({ asset, coordinates }) {
  const addLog = useAssetStore((state) => state.addLog);
  const logs = useLogStore((state) => state.logsByAsset[asset.id] || EMPTY_LOGS);
  const loadLogsForAsset = useLogStore((state) => state.loadLogsForAsset);
  const [estimateRecord, setEstimateRecord] = useState({ key: null, value: null });
  const [form, setForm] = useState(createEmptySoilLabForm);
  const [showForm, setShowForm] = useState(false);
  const [formErrors, setFormErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => { loadLogsForAsset(asset.id); }, [asset.id, loadLogsForAsset]);

  const labLogs = useMemo(() => logs
    .filter((log) => log.type === 'log--lab_test' && (
      log.attributes?.test_type === 'soil' || readLabReport(log)
    ))
    .slice()
    .sort((a, b) => Number(b.timestamp || b.attributes?.timestamp || 0) - Number(a.timestamp || a.attributes?.timestamp || 0)), [logs]);

  const longitude = coordinates?.[0];
  const latitude = coordinates?.[1];
  const coordinateKey = Number.isFinite(longitude) && Number.isFinite(latitude)
    ? `${longitude}:${latitude}`
    : null;
  const estimate = coordinateKey && estimateRecord.key === coordinateKey ? estimateRecord.value : null;
  const estimateLoading = coordinateKey !== null && estimateRecord.key !== coordinateKey;

  useEffect(() => {
    let active = true;
    if (labLogs.length || coordinateKey === null) return () => { active = false; };
    getSoilGridsEstimate([longitude, latitude])
      .then((result) => { if (active) setEstimateRecord({ key: coordinateKey, value: result }); })
      .catch(() => { if (active) setEstimateRecord({ key: coordinateKey, value: null }); });
    return () => { active = false; };
  }, [asset.id, longitude, latitude, coordinateKey, labLogs.length]);

  const updateValue = (key, value) => setForm((current) => ({ ...current, values: { ...current.values, [key]: value } }));
  const updateUnit = (key, value) => setForm((current) => ({ ...current, units: { ...current.units, [key]: value } }));

  const handleSave = async (event) => {
    event.preventDefault();
    const errors = validateSoilLabForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    setSaveMessage('');
    try {
      const result = await addLog(asset.id, buildSoilLabLog(asset.id, form));
      if (result?.success || result?.savedLocally) {
        setSaveMessage(result.savedLocally ? 'Guardado en este teléfono, pendiente de sincronización.' : 'Análisis guardado.');
        setShowForm(false);
        setForm(createEmptySoilLabForm());
        await loadLogsForAsset(asset.id);
      } else {
        setSaveMessage(result?.message || MSG.sueloLab.noGuardado);
      }
    } catch {
      setSaveMessage(MSG.sueloLab.noGuardado);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-900/60 bg-slate-900/70 shadow-lg" aria-labelledby="land-soil-title">
      <div className="border-b border-slate-800 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.12),transparent_70%)] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Registro del lote</p>
            <h3 id="land-soil-title" className="mt-1 text-lg font-bold text-white">Lo que sabemos del suelo</h3>
            <p className="mt-1 text-xs text-slate-400">Cada dato conserva su fuente, unidad y fecha.</p>
          </div>
          <button
            type="button"
            aria-expanded={showForm}
            onClick={() => { setShowForm((value) => !value); setSaveMessage(''); }}
            className="min-h-10 rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-900/60"
          >
            {showForm ? 'Cerrar formulario' : MSG.sueloLab.registrar}
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {saveMessage && <p role="status" className="rounded-lg border border-emerald-700/40 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100">{saveMessage}</p>}

        {labLogs.length ? (
          <div className="space-y-3">
            {labLogs.map((log) => {
              const report = readLabReport(log);
              const date = report?.report_date || (log.timestamp ? new Date(log.timestamp * 1000).toISOString().slice(0, 10) : '');
              return (
                <article key={log.id} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 sm:p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h4 className="font-semibold text-emerald-100">Análisis de laboratorio</h4>
                    <time className="text-xs text-slate-400">{formatDate(date)}</time>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">Laboratorio: {report?.source?.name || 'Nombre no disponible'}</p>
                  {report?.sample_depth && <p className="mt-1 text-xs text-slate-400">Profundidad reportada: {report.sample_depth}</p>}
                  {report?.measurements && (
                    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {Object.entries(report.measurements).map(([key, measurement]) => (
                        <div key={key} className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2">
                          <dt className="text-[10px] uppercase tracking-wide text-slate-400">{measurement.label || key}</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums text-slate-100">{measurement.value} <span className="font-normal text-emerald-200">{measurement.unit}</span></dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {report?.method && <p className="mt-3 text-xs text-slate-400">Método reportado: {report.method}</p>}
                </article>
              );
            })}
          </div>
        ) : <SoilEstimate estimate={estimate} loading={estimateLoading} />}

        {showForm && (
          <form onSubmit={handleSave} noValidate className="space-y-4 border-t border-slate-800 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-100">Fecha del informe</span>
                <input aria-label="Fecha del informe" aria-invalid={Boolean(formErrors.reportDate)} type="date" value={form.reportDate} onChange={(event) => setForm((current) => ({ ...current, reportDate: event.target.value }))} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                {formErrors.reportDate && <span role="alert" className="block text-xs text-rose-300">{formErrors.reportDate}</span>}
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-100">Laboratorio</span>
                <input aria-label="Laboratorio" aria-invalid={Boolean(formErrors.laboratory)} value={form.laboratory} onChange={(event) => setForm((current) => ({ ...current, laboratory: event.target.value }))} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Nombre tal como aparece" />
                {formErrors.laboratory && <span role="alert" className="block text-xs text-rose-300">{formErrors.laboratory}</span>}
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-100">Profundidad reportada</span>
                <input value={form.sampleDepth} onChange={(event) => setForm((current) => ({ ...current, sampleDepth: event.target.value }))} className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Ej. 0 a 20 cm" />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-100">Método reportado</span>
                <input value={form.method} onChange={(event) => setForm((current) => ({ ...current, method: event.target.value }))} className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Tal como aparece en el informe" />
              </label>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Resultados transcritos</h4>
              <p className="mt-1 text-xs text-slate-400">Deje en blanco lo que no figure. No se calcula ni se interpreta ningún valor.</p>
            </div>
            {formErrors.values && <p role="alert" className="text-xs text-rose-300">{formErrors.values}</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SOIL_LAB_MEASUREMENTS.map((field) => (
                <MeasurementInput
                  key={field.key}
                  field={field}
                  value={form.values[field.key]}
                  unit={form.units[field.key]}
                  error={formErrors[field.key]}
                  onValueChange={(value) => updateValue(field.key, value)}
                  onUnitChange={(value) => updateUnit(field.key, value)}
                />
              ))}
            </div>
            {formErrors.texture && <p role="alert" className="text-xs text-rose-300">{formErrors.texture}</p>}
            <button type="submit" disabled={saving} className="min-h-12 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-wait disabled:opacity-60">
              {saving ? 'Guardando…' : MSG.sueloLab.guardar}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default LandSoilSection;
