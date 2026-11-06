/* eslint-disable chagra-i18n/no-hardcoded-spanish */
import { localDateInputValue, localDateTimestamp } from '../utils/dateFormatter';
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, AlertCircle, TrendingUp, CheckCircle, Apple } from 'lucide-react';
import DateField from './DateField';
import { savePayload } from '../services/payloadService';
import { cosechaGuardadaConExito } from '../visual/agente/angelitaFinca.js';
import { logCache } from '../db/logCache';
import { fincaVivaHomePerfilActivo } from '../config/fincaVivaHomeFlag';
import RegistroShell from './registro/RegistroShell';
import { TextField, NumberField, SelectField, TextAreaField } from './registro/RegistroFields';
import useAngelitaStore from '../store/useAngelitaStore';
import HojaHomeA from './esquema/HojaHomeA';
import './registro/registro-home-a.css';
import { useTheme, resolveAutoTheme, BASE_SKIN_THEMES } from '../hooks/useTheme';
import useAssetStore from '../store/useAssetStore';
import { normalizeUnit, readHarvestQuantity, resolveHarvestLote } from '../services/cosechaService';
import { newId } from '../utils/id';
import useLogUploadStatus from '../hooks/useLogUploadStatus';

// Bug 069.10 — sanity caps para evitar typos absurdos (ej. "100kg" → 100000)
// que rompan analítica downstream sin que el operador lo note.
const MAX_QTY_KG = 50000;     // 50 toneladas en una sola cosecha → ya implausible
const MAX_QTY_UNITS = 1000000; // 1 millón de unidades / huevos / manojos
const MIN_PRODUCT_LEN = 2;

// Autopilot #7 (2026-05-03): mediana de cosechas pasadas como sugerencia
// de cantidad. Reduce friction en cosechas repetitivas (fresa cada semana,
// huevo diario) sin imponer, operador siempre puede sobreescribir.
function median(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Normaliza el nombre del producto para matching fuzzy (lowercase + sin tildes).
function normProduct(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

async function computeMedianForProduct(productName, unit) {
  if (!productName || productName.trim().length < 3) return null;
  try {
    const allHarvests = await logCache.getByType('log--harvest');
    const target = normProduct(productName);
    const matching = allHarvests.filter((log) => {
      const name = log.name || log.attributes?.name || '';
      return normProduct(name).includes(target)
        && normalizeUnit(readHarvestQuantity(log).unit) === normalizeUnit(unit);
    });
    if (matching.length === 0) return null;
    const quantities = matching
      .map((log) => {
        const qty = log.quantity?.[0] || log.attributes?.quantity?.[0];
        const val = parseFloat(qty?.value?.decimal ?? qty?.value);
        return Number.isFinite(val) ? val : null;
      })
      .filter((v) => v !== null && v > 0);
    if (quantities.length === 0) return null;
    return { median: median(quantities), count: quantities.length };
  } catch (err) {
    console.warn('[HarvestLog] median lookup failed:', err);
    return null;
  }
}

function HarvestLoteField({ resolution, lands, value, onChange }) {
  const options = resolution.candidates.length > 0
    ? resolution.candidates
    : (lands || []).filter((land) => land?.id).map((land) => ({
      id: land.id,
      name: land.attributes?.name || land.name || 'Lote',
    }));

  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-bold text-slate-300">Lote de la cosecha</span>
      <select
        aria-label="Lote de la cosecha"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-white min-h-[48px]"
      >
        <option value="">
          {resolution.status === 'multiple' ? 'Elija un lote o deje sin asociar' : 'Sin lote asociado'}
        </option>
        {options.map((lote) => <option key={lote.id} value={lote.id}>{lote.name}</option>)}
      </select>
      {resolution.status === 'single' && (
        <span className="text-xs text-emerald-300">Se asociará a {resolution.candidates[0].name} por ser el único lote con este cultivo.</span>
      )}
      {resolution.status === 'multiple' && (
        <span className="text-xs text-amber-200">Este cultivo aparece en varios lotes. Elija dónde cosechó; no se asignará uno sin confirmación.</span>
      )}
      {resolution.status === 'none' && (
        <span className="text-xs text-slate-400">No encontré este cultivo en un lote. Puede elegir uno o guardar sin asociar.</span>
      )}
    </label>
  );
}

/**
 * Registro de cosecha con lugar opcional y sugerencia de mediana histórica.
 *
 * Al indicar el producto se dispara una búsqueda en logs de cosecha anteriores para calcular la mediana de cantidad por producto. El resultado
 * se muestra como hint opcional al operador para orientar el valor esperado
 * de la cosecha actual.
 *
 * @param {Object} props
 * @param {Function} [props.onBack] - Callback invocado al cancelar o navegar hacia atrás.
 * @param {Function} [props.onSave] - Callback invocado tras guardado exitoso del log de cosecha.
 * @returns {React.JSX.Element}
 */
function HarvestLogContenido({ onBack, onSave }) {
  const [formData, setFormData] = useState(/** @type {{date: string, mainArea: string, product: string, quantity: string, unit: string, notes: string}} */({
    date: localDateInputValue(),
    mainArea: '',
    product: '',
    quantity: '',
    unit: 'Kilogramos',
    notes: ''
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [medianHint, setMedianHint] = useState(null); // { median, count } | null
  const [loteSelection, setLoteSelection] = useState({ key: '', id: '' });
  const { status: uploadStatus, beginUpload, confirmUpload, resetUpload, currentStatus } = useLogUploadStatus();
  const [view, setView] = useState('form'); // 'form' | 'success'
  const [touched, setTouched] = useState(/** @type {Record<string, boolean>} */ ({}));
  const celebrar = useAngelitaStore((s) => s.celebrar);
  const plants = useAssetStore((s) => s.plants);
  const lands = useAssetStore((s) => s.lands);
  const cropResolution = useMemo(
    () => resolveHarvestLote(formData.product, plants, lands),
    [formData.product, plants, lands],
  );
  const cropSelectionKey = normProduct(formData.product);
  const selectedLoteId = loteSelection.key === cropSelectionKey
    ? loteSelection.id
    : (cropResolution.loteId || '');

  // Bug 069.10 — validación inline (product, quantity, date)
  const errors = useMemo(() => {
    /** @type {Record<string, string>} */
    const e = {};
    const today = localDateInputValue();
    if (!formData.product.trim()) e.product = 'Indica el producto';
    else if (formData.product.trim().length < MIN_PRODUCT_LEN) e.product = `Mínimo ${MIN_PRODUCT_LEN} caracteres`;
    const qty = Number(formData.quantity);
    const cap = formData.unit === 'Gramos' ? MAX_QTY_KG * 1000
              : formData.unit === 'Kilogramos' ? MAX_QTY_KG
              : MAX_QTY_UNITS;
    if (formData.quantity === '' || formData.quantity === null) e.quantity = 'Indica la cantidad';
    else if (!Number.isFinite(qty)) e.quantity = 'Cantidad inválida';
    else if (qty <= 0) e.quantity = 'Debe ser mayor que cero';
    else if (qty > cap) e.quantity = `Máximo ${cap.toLocaleString()} ${formData.unit.toLowerCase()}`;
    if (!formData.date) e.date = 'Indica la fecha';
    else if (formData.date > today) e.date = 'La fecha no puede ser futura';
    return e;
  }, [formData]);

  const hasErrors = Object.keys(errors).length > 0;
  const markTouched = (field) => setTouched((t) => ({ ...t, [field]: true }));

  const handleInput = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Lookup mediana cuando product cambia. Sugerencia, no override forzoso —
  // solo pre-fillea quantity si el operador NO ha escrito nada todavía.
  useEffect(() => {
    let alive = true;
    if (!formData.product) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMedianHint(null);
      return;
    }
    computeMedianForProduct(formData.product, formData.unit).then((result) => {
      if (!alive) return;
      setMedianHint(result);
      if (result && !formData.quantity) {
        setFormData((prev) => ({ ...prev, quantity: String(result.median) }));
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional: no incluir formData.quantity para evitar loop (sólo queremos disparar al cambiar product, no en cada keystroke de cantidad)
  }, [formData.product, formData.unit]);

  useEffect(() => {
    if (view !== 'success' || uploadStatus === 'syncing' || uploadStatus === 'pending') return;
    const timer = setTimeout(() => {
      setView('form');
      onBack();
    }, 1500);
    return () => clearTimeout(timer);
  }, [view, onBack, uploadStatus]);

  const handleSave = async (draft = false) => {
    if (isSaving) return;
    // Bug 069.10 — re-validar antes de enviar
    if (draft ? !!(errors.product || errors.date) : hasErrors) {
      setTouched({ product: true, quantity: true, date: true });
      onSave('Revise los campos marcados', true);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        data: {
          type: "log--harvest",
          id: newId('log--harvest'),
          attributes: {
            name: `Cosecha de ${formData.product}`,
            timestamp: localDateTimestamp(formData.date),
            status: draft ? 'pending' : 'done',
            notes: { value: [formData.notes, formData.mainArea && `Lugar: ${formData.mainArea}`, draft && errors.quantity && 'Falta indicar la cantidad para completar la cosecha.'].filter(Boolean).join('\n'), format: 'plain_text' }
          },
          relationships: {
            quantity: {
              data: [{
                type: "quantity--standard",
                attributes: {
                  measure: "weight",
                  value: { decimal: String(formData.quantity) },
                  label: formData.unit
                }
              }]
            }
          }
        }
      };

      if (!formData.quantity || (draft && errors.quantity)) delete payload.data.relationships.quantity;
      if (selectedLoteId) {
        payload.data.relationships.location = {
          data: [{ type: 'asset--land', id: selectedLoteId }],
        };
      }
      if (!draft) beginUpload(payload.data.id, navigator.onLine);
      const result = await savePayload('harvest', payload);
      if (!result.success && !result.savedLocally) { resetUpload(); onSave(result.message, true); return; }
      if (draft) {
        onSave(errors.quantity
          ? 'La cosecha quedó anotada como borrador. Falta la cantidad para completarla.'
          : 'La cosecha quedó anotada como borrador. Puede completarla después.', false);
        return;
      }
      if (result.success) confirmUpload(payload.data.id);
      const statusAfterSave = result.success ? 'synced' : currentStatus();
      onSave(result.success
        ? 'Cosecha guardada en su finca.'
        : statusAfterSave === 'syncing'
          ? 'Guardado en este teléfono. La subida sigue en curso.'
          : statusAfterSave === 'synced'
            ? 'Cosecha guardada en su finca.'
            : 'La subida quedó pendiente. Puede revisar el Cuaderno de labores y reintentar sin volver a anotarla.', false);

      // Celebrar cosecha registrada (task #hc-motor2)
      if (cosechaGuardadaConExito({ success: result.success, offline: !!result.savedLocally })) {
        window.dispatchEvent(new CustomEvent('chagra:cosecha-guardada'));
        const product = formData.product || 'cosecha';
        const quantity = formData.quantity;
        const unit = formData.unit;
        const logroId = `harvest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        celebrar({
          id: logroId,
          texto: `¡Bien! Registró ${quantity} ${unit.toLowerCase()} de ${product}.`
        });
      }

      setFormData(prev => ({ ...prev, quantity: '', notes: '' }));
      setView('success');
    } catch (error) {
      resetUpload();
      console.error('Error en HarvestLog handleSave:', error);
      onSave('Error al guardar registro', true);
    } finally {
      setIsSaving(false);
    }
  };

  const redesign = fincaVivaHomePerfilActivo();

  if (view === 'success') {
    return (
      <div className={`h-[100dvh] w-full ${redesign ? 'registro-shell' : 'bg-slate-950'} text-slate-100 flex flex-col p-6 items-center justify-center gap-6`}>
        <div className="text-center animate-in fade-in zoom-in duration-300">
          <CheckCircle size={64} className="text-emerald-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold">Cosecha registrada</h3>
          <p role="status" className="text-sm text-slate-400 mt-2">
            {uploadStatus === 'syncing' ? (
              <>Guardado en este teléfono. La subida sigue en curso. La confirmación aparecerá aquí.</>
            ) : uploadStatus === 'pending' ? (
              <>La subida no se completó. La cosecha sigue guardada en este teléfono. Puede revisarla en el <strong className="text-slate-200">Cuaderno de labores</strong> y reintentar sin volver a anotarla.</>
            ) : (
              <>Quedó guardada. Todo al día.</>
            )}
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {uploadStatus === 'pending' && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('chagraNavigate', { detail: { view: 'historial' } }))}
              className="p-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center gap-2"
            >
              Ver el Cuaderno de labores
            </button>
          )}
          <button
            onClick={() => { setView('form'); resetUpload(); }}
            className={redesign ? 'registro-cta' : 'p-4 rounded-xl bg-orange-700 hover:bg-orange-600 text-white font-bold flex items-center justify-center gap-2'}
          >
            Nueva cosecha
          </button>
        </div>
      </div>
    );
  }

  // ── REDISEÑO (gated): caparazón Chagra theme-aware ──────────────────────
  if (redesign) {
    return (
      <RegistroShell
        title="Cosechar"
        subtitle="Anote lo que recogió hoy de la chagra"
        Icon={Apple}
        onBack={onBack}
        footer={
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving}
            aria-busy={isSaving}
            title={hasErrors ? 'Completa los campos correctamente' : undefined}
            className="registro-cta"
          >
            {isSaving ? 'Guardando…' : 'Guardar cosecha'}
          </button>
        }
      >
        <div className="registro-tip">
          <Apple size={18} className="registro-tip__icon" aria-hidden="true" />
          <span>Registre cada cosecha apenas la recoja: así el Cuaderno de labores arma su historial y el agente aprende cuánto produce su finca.</span>
        </div>

        <DateField
          label="¿Qué día cosechó?"
          value={formData.date}
          onChange={(val) => { setFormData(p => ({ ...p, date: val })); markTouched('date'); }}
          required
        />
        {touched.date && errors.date && (
          <p className="registro-error -mt-3" role="alert"><AlertCircle size={14} aria-hidden="true" /> {errors.date}</p>
        )}

        <TextField
          label="¿Qué cosechó? (obligatorio)"
          ariaLabel="¿Qué cosechó?"
          required
          name="product"
          value={formData.product}
          onChange={handleInput}
          onBlur={() => markTouched('product')}
          placeholder="Ej: Fresa Monterrey"
          error={touched.product ? errors.product : ''}
        />
        {formData.product.trim() && (
          <HarvestLoteField
            resolution={cropResolution}
            lands={lands}
            value={selectedLoteId}
            onChange={(id) => setLoteSelection({ key: cropSelectionKey, id })}
          />
        )}

        <div className="grid grid-cols-2 gap-3 items-start">
          <div className="flex flex-col gap-1">
            <NumberField
              label="Cantidad (obligatorio)"
              ariaLabel="Cantidad"
              step="0.01"
              min="0"
              required
            name="quantity"
              value={formData.quantity}
              onChange={handleInput}
              onBlur={() => markTouched('quantity')}
              placeholder="0.00"
              error={touched.quantity ? errors.quantity : ''}
            />
            {medianHint && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 px-1">
                <TrendingUp size={12} aria-hidden="true" />
                Sueles cosechar {medianHint.median} {formData.unit.toLowerCase()} ({medianHint.count}× antes)
              </span>
            )}
          </div>
          <SelectField
            label="Unidad"
            name="unit"
            value={formData.unit}
            onChange={handleInput}
            options={[
              { value: 'Kilogramos', label: 'Kilogramos' },
              { value: 'Gramos', label: 'Gramos' },
              { value: 'Arrobas', label: 'Arrobas' },
              { value: 'Bultos', label: 'Bultos' },
              { value: 'Cargas', label: 'Cargas' },
              { value: 'Libras', label: 'Libras' },
              { value: 'Toneladas', label: 'Toneladas' },
              { value: 'Unidades', label: 'Unidades' },
              { value: 'Manojos', label: 'Manojos' },
            ]}
          />
        </div>

        <details>
          <summary className="min-h-[44px] py-3 cursor-pointer">Lugar y notas (opcional)</summary>
          <div className="flex flex-col gap-4 pt-3">
          <TextField label="Lugar (opcional)" name="mainArea" value={formData.mainArea} onChange={handleInput} placeholder="Ej: lote de arriba" />
          <TextAreaField
          label="Observaciones"
          hint="opcional"
          name="notes"
          rows={3}
          value={formData.notes}
          onChange={handleInput}
          // @ts-ignore placeholder not in strict prop types
          placeholder="Ej: fruta pequeña, algo picada por pájaros…"
          />
          </div>
        </details>
        <button type="button" onClick={() => handleSave(true)} disabled={isSaving || !!(errors.product || errors.date)} className="min-h-[44px] px-3 py-2 border rounded-xl">Guardar borrador para completar después</button>
      </RegistroShell>
    );
  }

  // ── LEGACY (flag OFF): markup 0.1 sin cambios visuales ──────────────────
  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
      <header className="p-4 sticky top-0 bg-slate-950 border-b border-slate-800 flex items-center gap-4 z-10 shrink-0 shadow-md">
        <button onClick={/** @type {React.MouseEventHandler<HTMLButtonElement>} */ (onBack)} aria-label="Volver" className="p-3 bg-slate-800 rounded-full active:bg-slate-700 min-h-[56px] min-w-[56px] flex justify-center items-center shrink-0">
          <ArrowLeft size={32} aria-hidden="true" />
        </button>
        <h2 className="text-3xl font-bold truncate">Cosechar</h2>
      </header>

      <div className="flex-1 p-5 flex flex-col gap-6 pb-24">
        <DateField
          label="Fecha"
          value={formData.date}
          onChange={(val) => { setFormData(p => ({ ...p, date: val })); markTouched('date'); }}
          required
        />
        {touched.date && errors.date && (
          <p className="text-sm text-red-400 -mt-4 flex items-center gap-1.5">
            <AlertCircle size={14} aria-hidden="true" /> {errors.date}
          </p>
        )}

        <label className="flex flex-col gap-2">Lugar (opcional)
          <input name="mainArea" value={formData.mainArea} onChange={handleInput} className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-xl" />
        </label>

        <button type="button" onClick={() => handleSave(true)} disabled={isSaving || !!(errors.product || errors.date)} className="p-4 bg-slate-800 rounded-xl">Guardar borrador</button>

        <label className="flex flex-col gap-2">
          <span className="text-xl font-bold">Producto (obligatorio)</span>
          <input
            type="text"
            required
            name="product"
            value={formData.product}
            onChange={handleInput}
            onBlur={() => markTouched('product')}
            aria-invalid={touched.product && !!errors.product}
            placeholder="Ej: Fresa Monterrey"
            className={`p-4 rounded-xl bg-slate-900 border text-2xl text-white min-h-[64px] placeholder-slate-500 ${
              touched.product && errors.product ? 'border-red-700' : 'border-slate-700'
            }`}
          />
          {touched.product && errors.product && (
            <p className="text-sm text-red-400 flex items-center gap-1.5">
              <AlertCircle size={14} aria-hidden="true" /> {errors.product}
            </p>
          )}
        </label>

        {formData.product.trim() && (
          <HarvestLoteField
            resolution={cropResolution}
            lands={lands}
            value={selectedLoteId}
            onChange={(id) => setLoteSelection({ key: cropSelectionKey, id })}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-xl font-bold">Cantidad (obligatorio)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              required
            name="quantity"
              value={formData.quantity}
              onChange={handleInput}
              onBlur={() => markTouched('quantity')}
              aria-invalid={touched.quantity && !!errors.quantity}
              className={`p-4 rounded-xl bg-slate-900 border text-2xl text-white min-h-[64px] ${
                touched.quantity && errors.quantity ? 'border-red-700' : 'border-slate-700'
              }`}
              placeholder="0.00"
            />
            {touched.quantity && errors.quantity && (
              <p className="text-sm text-red-400 flex items-center gap-1.5">
                <AlertCircle size={14} aria-hidden="true" /> {errors.quantity}
              </p>
            )}
            {medianHint && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 px-1">
                <TrendingUp size={12} />
                Mediana de {medianHint.count} cosecha{medianHint.count > 1 ? 's' : ''} pasada{medianHint.count > 1 ? 's' : ''}: {medianHint.median} {formData.unit.toLowerCase()}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xl font-bold">Unidad</span>
            <select name="unit" value={formData.unit} onChange={handleInput} className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-xl text-white min-h-[64px] appearance-none">
              <option value="Kilogramos">Kilogramos</option>
              <option value="Gramos">Gramos</option>
              <option value="Arrobas">Arrobas</option>
              <option value="Bultos">Bultos</option>
              <option value="Cargas">Cargas</option>
              <option value="Libras">Libras</option>
              <option value="Toneladas">Toneladas</option>
              <option value="Unidades">Unidades</option>
              <option value="Manojos">Manojos</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-xl font-bold">Observaciones (Opcional)</span>
          <textarea name="notes" rows={Number("3")} value={formData.notes} onChange={handleInput} className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-xl text-white min-h-[80px] placeholder-slate-500" placeholder="Ej: Fruta de tamaño pequeño o picada..." />
        </label>

        <button
          onClick={() => handleSave(false)}
          disabled={isSaving}
          aria-busy={isSaving}
          aria-disabled={isSaving || undefined}
          title={hasErrors ? 'Completa los campos correctamente' : undefined}
          className="mt-4 p-6 rounded-xl bg-orange-600 active:bg-orange-500 text-2xl lg:text-3xl font-black shadow-xl min-h-[80px] border-b-4 border-orange-800 disabled:opacity-60 disabled:active:bg-orange-600 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Guardando…' : 'Guardar cosecha'}
        </button>
      </div>
    </div>
  );
}

export default function HarvestLog(props) {
  const { theme } = useTheme();
  if (BASE_SKIN_THEMES.includes(resolveAutoTheme(theme))) return <HarvestLogContenido {...props} />;
  return <HojaHomeA title="" onBack={props.onBack}><div className="registro-home-a"><HarvestLogContenido {...props} /></div></HojaHomeA>;
}
