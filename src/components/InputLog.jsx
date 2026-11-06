/* eslint-disable chagra-i18n/no-hardcoded-spanish */
import { localDateInputValue, localDateTimestamp } from '../utils/dateFormatter';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Droplets } from 'lucide-react';
import DateField from './DateField';
import { savePayload } from '../services/payloadService';
import useAssetStore from '../store/useAssetStore';
import { fincaVivaHomePerfilActivo } from '../config/fincaVivaHomeFlag';
import RegistroShell from './registro/RegistroShell';
import { SelectField, NumberField, TextAreaField, TextField } from './registro/RegistroFields';
import { avisarCuidadoPorInsumo } from '../visual/agente/angelitaGuardiana.js';
import { getAllBiopreparados } from '../db/catalogDB';
import { newId } from '../utils/id';
import useLogUploadStatus from '../hooks/useLogUploadStatus';

const INPUT_MATERIALS = [
  { id: 'mat-bio', name: 'Bioactivador Lácteo' },
  { id: 'mat-lombri', name: 'Lombricompost' },
  { id: 'mat-agua', name: 'Agua de Riego' },
  { id: 'mat-galli', name: 'Gallinaza' }
];

const APPLICATION_METHODS = [
  "Foliar", "Drench/Al suelo", "Inoculación de semillas", "Incorporación"
];

/**
 * Formulario legacy para registrar aplicaciones de insumos agrícolas.
 * Permite seleccionar ubicación, tipo de insumo, método de aplicación,
 * cantidad y notas. Guarda mediante el servicio de payloads con soporte
 * offline-first.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {() => void} props.onBack - Callback para volver a la pantalla anterior.
 * @param {(mensaje: string, esError: boolean) => void} props.onSave - Callback invocado tras guardar: onSave(mensaje, esError).
 */
export default function InputLog({ onBack, onSave }) {
  const [materials, setMaterials] = useState(INPUT_MATERIALS);
  const [catalogError, setCatalogError] = useState(false);
  useEffect(() => {
    let active = true;
    getAllBiopreparados().then(rows => {
      if (active) setMaterials([...INPUT_MATERIALS, ...rows.map(row => ({ id: row.id, name: row.nombre.replaceAll(' — ', ': ') }))]);
    }).catch(() => { if (active) setCatalogError(true); });
    return () => { active = false; };
  }, []);
  const [formData, setFormData] = useState({
    date: localDateInputValue(),
    locationId: '',
    materialId: '',
    method: 'Foliar',
    quantity: '',
    unit: 'Litros',
    notes: '', crop: '', concentration: '', daysBeforeHarvest: ''
  });

  const lands = useAssetStore(s => s.lands) || [];
  const [errors, setErrors] = useState(/** @type {Record<string,string>} */ ({}));
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const { status: uploadStatus, beginUpload, confirmUpload, resetUpload, currentStatus } = useLogUploadStatus();

  const handleInput = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (isSaving) return;
    /** @type {Record<string,string>} */
    const validation = {};
    if (!formData.materialId) validation.materialId = 'Escoge el insumo';
    if (!formData.quantity) validation.quantity = 'Indica la cantidad';
    else if (!Number.isFinite(Number(formData.quantity)) || Number(formData.quantity) <= 0) validation.quantity = 'Indica una cantidad mayor que cero';
    if (!formData.date) validation.date = 'Indica la fecha';
    else if (formData.date > localDateInputValue()) validation.date = 'La fecha no puede ser futura';
    if (formData.locationId && !lands.some(a => a.id === formData.locationId)) validation.locationId = 'Escoge un lugar de su finca';
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setIsSaving(true);
    try {

      const materialName = materials.find(m => m.id === formData.materialId)?.name;
      const inventoryValue = -Math.abs(parseFloat(formData.quantity));

      const payload = {
        data: {
          type: "log--input",
          id: newId('log--input'),
          attributes: {
            name: `Aplicación de ${materialName}`,
            timestamp: localDateTimestamp(formData.date),
            status: "done",
            notes: { value: [formData.notes, `Cantidad: ${formData.quantity} ${formData.unit}`, `Método: ${formData.method}`, formData.crop && `Cultivo: ${formData.crop}`, formData.concentration && `Concentración: ${formData.concentration}`, formData.daysBeforeHarvest !== '' && `Días antes de cosecha: ${formData.daysBeforeHarvest}`].filter(Boolean).join('\n'), format: 'plain_text' }
          },
          relationships: {
            location: {
              data: [{ type: "asset--land", id: formData.locationId }]
            },
            quantity: {
              data: [{
                type: "quantity--standard",
                attributes: {
                  measure: formData.unit === "Litros" || formData.unit === "Mililitros" ? "volume" : "weight",
                  value: { decimal: String(inventoryValue) },
                  label: `Extracción (${formData.unit})`
                }
              }]
            }
          }
        }
      };

      if (!formData.locationId) delete payload.data.relationships.location;
      beginUpload(payload.data.id, navigator.onLine);
      const result = await savePayload('input', payload);
      if (!result.success && !result.savedLocally) { resetUpload(); onSave(result.message, true); return; }
      if (result.success || result.savedLocally) avisarCuidadoPorInsumo(materialName);
      if (result.success) confirmUpload(payload.data.id);
      const statusAfterSave = result.success ? 'synced' : currentStatus();
      const saveMessage = statusAfterSave === 'synced'
        ? 'La aplicación quedó guardada en su finca.'
        : statusAfterSave === 'syncing'
          ? 'Guardado en este teléfono. La subida sigue en curso.'
          : 'La subida quedó pendiente. Puede revisar el Cuaderno de labores y reintentar sin volver a anotarla.';
      onSave(saveMessage, false);
      setSavedMessage(true);

      setFormData(prev => ({ ...prev, quantity: '', notes: '' }));
    } catch (error) {
      resetUpload();
      console.error('Error en InputLog handleSave:', error);
      onSave('Error al guardar registro', true);
    } finally {
      setIsSaving(false);
    }
  };

  if (savedMessage) {
    return (
      <RegistroShell
        title="Aplicación anotada"
        Icon={Droplets}
        onBack={onBack}
        footer={uploadStatus === 'pending' ? <button type="button" className="registro-cta" onClick={() => window.dispatchEvent(new CustomEvent('chagraNavigate', { detail: { view: 'bitacora' } }))}>Ver el Cuaderno de labores</button> : null}
      >
        <p role="status">
          {uploadStatus === 'syncing' ? 'Guardado en este teléfono. La subida sigue en curso. La confirmación aparecerá aquí.'
            : uploadStatus === 'pending' ? 'La subida no se completó. La aplicación sigue guardada en este teléfono. Puede revisarla en el Cuaderno de labores y reintentar sin volver a anotarla.'
              : 'La aplicación quedó guardada en su finca.'}
        </p>
        <button type="button" className="registro-cta" onClick={() => { setSavedMessage(false); resetUpload(); }}>Anotar otra aplicación</button>
      </RegistroShell>
    );
  }

  const safetyFields = (
    <div className="space-y-4">
      {catalogError && <p role="status">No pudimos abrir el catálogo de preparados. Los insumos básicos siguen disponibles. Vuelva a abrir este formulario cuando tenga señal.</p>}
      {formData.materialId === 'mat-galli' && formData.method === 'Foliar' && (
        <p role="alert" className="p-4 rounded-xl border border-amber-600 text-amber-700 bg-amber-50">
          Advertencia de inocuidad: no aplique gallinaza sobre hojas o partes que se comen. Antes de aplicar, consulte el manejo seguro y el tiempo previo a la cosecha con asistencia técnica.
        </p>
      )}
      <TextField label="Cultivo" name="crop" value={formData.crop} onChange={handleInput} />
      <TextField label="Concentración (cantidad por litro de agua)" name="concentration" value={formData.concentration} onChange={handleInput} />
      <NumberField label="Días antes de cosecha" name="daysBeforeHarvest" min="0" step="1" value={formData.daysBeforeHarvest} onChange={handleInput} />
    </div>
  );

  // ── REDISEÑO (gated): caparazón Chagra theme-aware ──────────────────────
  if (fincaVivaHomePerfilActivo()) {
    return (
      <RegistroShell
        title="Abonos e insumos"
        subtitle="Qué le echaste a la finca y cuánto gastaste"
        Icon={Droplets}
        onBack={onBack}
        footer={
          <button disabled={isSaving} aria-busy={isSaving} onClick={handleSave} className="registro-cta">
            Registrar aplicación
          </button>
        }
      >
        <div className="registro-tip">
          <Droplets size={18} className="registro-tip__icon" aria-hidden="true" />
          <span>Anota cada aplicación de abono, biopreparado o riego. Así controlas la bodega y sabes qué le funciona a cada lote.</span>
        </div>

        {safetyFields}
        <DateField
          label="¿Qué día aplicaste?"
          value={formData.date}
          onChange={(val) => setFormData(p => ({ ...p, date: val }))}
          required
        />
        {errors.date && <p role="alert">{errors.date}</p>}

        <SelectField
          label="Ubicación o lote (opcional)"
          name="locationId"
          value={formData.locationId}
          onChange={handleInput}
          placeholder="Sin lugar"
          error={errors.locationId}
          options={lands.map(a => ({ value: a.id, label: a.name || a.attributes?.name }))}
        />

        <SelectField
          label="¿Qué aplicaste?"
          name="materialId"
          value={formData.materialId}
          onChange={handleInput}
          error={errors.materialId}
          required
          placeholder="Escoge el insumo"
          options={materials.map(m => ({ value: m.id, label: m.name }))}
        />

        <SelectField
          label="¿Cómo lo aplicaste?"
          name="method"
          value={formData.method}
          onChange={handleInput}
          options={APPLICATION_METHODS.map(m => ({ value: m, label: m }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Cantidad"
            required
            error={errors.quantity}
            step="0.01"
            name="quantity"
            value={formData.quantity}
            onChange={handleInput}
            // @ts-ignore placeholder not in strict prop types
            placeholder="0.00"
          />
          <SelectField
            label="Unidad"
            name="unit"
            value={formData.unit}
            onChange={handleInput}
            options={[
              { value: 'Litros', label: 'Litros' },
              { value: 'Kilogramos', label: 'Kilogramos' },
            ]}
          />
        </div>

        <TextAreaField
          label="Notas"
          hint="opcional"
          name="notes"
          rows={3}
          value={formData.notes}
          onChange={handleInput}
          // @ts-ignore placeholder not in strict prop types
          placeholder="Ej: el suelo estaba seco, dosis baja…"
        />
      </RegistroShell>
    );
  }

  // ── LEGACY (flag OFF): markup 0.1 sin cambios visuales ──────────────────
  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
      <header className="p-4 sticky top-0 bg-slate-950 border-b border-slate-800 flex items-center gap-4 z-10 shrink-0 shadow-md">
        <button onClick={onBack} aria-label="Volver" className="p-3 bg-slate-800 rounded-full active:bg-slate-700 min-h-[56px] min-w-[56px] flex justify-center items-center shrink-0">
          <ArrowLeft size={32} aria-hidden="true" />
        </button>
        <h2 className="text-3xl font-bold truncate">Insumos</h2>
      </header>

      <div className="flex-1 p-5 flex flex-col gap-6 pb-24">
        {safetyFields}
        <DateField
          label="Fecha de Aplicación"
          value={formData.date}
          onChange={(val) => setFormData(p => ({ ...p, date: val }))}
          required
        />

        {errors.date && <p role="alert">{errors.date}</p>}
        <label className="flex flex-col gap-2">
          <span className="text-xl font-bold">Lugar (opcional)</span>
          {errors.locationId && <p role="alert">{errors.locationId}</p>}
          <select name="locationId" value={formData.locationId} onChange={handleInput} className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-2xl text-white min-h-[64px] appearance-none">
            <option value="">Sin lugar</option>
            {lands.map(a => <option key={a.id} value={a.id}>{a.name || a.attributes?.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          {errors.materialId && <p role="alert">{errors.materialId}</p>}
          <span className="text-xl font-bold">Tipo de Insumo</span>
          <select name="materialId" value={formData.materialId} onChange={handleInput} className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-xl text-white min-h-[64px] appearance-none">
            <option value="">-- Seleccionar --</option>
            {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xl font-bold">Método de Aplicación</span>
          <select name="method" value={formData.method} onChange={handleInput} className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-xl text-white min-h-[64px] appearance-none">
            {APPLICATION_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-xl font-bold">Cantidad</span>
            {errors.quantity && <p role="alert">{errors.quantity}</p>}
            <input type="number" step="0.01" name="quantity" value={formData.quantity} onChange={handleInput} className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-2xl text-white min-h-[64px]" placeholder="0.00" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xl font-bold">Unidad</span>
            <select name="unit" value={formData.unit} onChange={handleInput} className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-xl text-white min-h-[64px] appearance-none">
              <option value="Litros">Litros</option>
              <option value="Kilogramos">Kilogramos</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-xl font-bold">Notas Adicionales</span>
          <textarea name="notes" rows={3} value={formData.notes} onChange={handleInput} className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-xl text-white min-h-[80px]" placeholder="Ej: Observaciones sobre el estado del suelo..." />
        </label>

        <button disabled={isSaving} aria-busy={isSaving} onClick={handleSave} className="mt-4 p-6 rounded-xl bg-blue-600 active:bg-blue-500 text-2xl lg:text-3xl font-black shadow-xl min-h-[80px] border-b-4 border-blue-800">
          Registrar Aplicación
        </button>
      </div>
    </div>
  );
}
