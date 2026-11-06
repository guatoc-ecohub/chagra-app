import { MSG } from '../config/messages';

export const SOIL_LAB_MEASUREMENTS = [
  { key: 'ph', label: 'pH', unit: 'pH', kind: 'ph' },
  { key: 'organicMatter', label: 'Materia orgánica', unit: '%', kind: 'percent' },
  { key: 'phosphorus', label: 'Fósforo (P)', unit: 'mg/kg', kind: 'amount', alternatives: ['mg/dm³', 'ppm'] },
  { key: 'potassium', label: 'Potasio (K)', unit: 'cmol(+)/kg', kind: 'amount', alternatives: ['meq/100g', 'mg/kg'] },
  { key: 'calcium', label: 'Calcio (Ca)', unit: 'cmol(+)/kg', kind: 'amount', alternatives: ['meq/100g', 'mg/kg'] },
  { key: 'magnesium', label: 'Magnesio (Mg)', unit: 'cmol(+)/kg', kind: 'amount', alternatives: ['meq/100g', 'mg/kg'] },
  { key: 'aluminium', label: 'Aluminio (Al)', unit: 'cmol(+)/kg', kind: 'amount', alternatives: ['meq/100g', 'mg/kg'] },
  { key: 'effectiveCec', label: 'CICE', unit: 'cmol(+)/kg', kind: 'amount', alternatives: ['meq/100g'] },
  { key: 'sand', label: 'Arena', unit: '%', kind: 'percent' },
  { key: 'silt', label: 'Limo', unit: '%', kind: 'percent' },
  { key: 'clay', label: 'Arcilla', unit: '%', kind: 'percent' },
];

export const createEmptySoilLabForm = () => ({
  reportDate: new Date().toISOString().slice(0, 10),
  laboratory: '',
  sampleDepth: '',
  method: '',
  values: Object.fromEntries(SOIL_LAB_MEASUREMENTS.map(({ key }) => [key, ''])),
  units: Object.fromEntries(SOIL_LAB_MEASUREMENTS.map(({ key, unit }) => [key, unit])),
});

const parseDecimal = (raw) => {
  const text = String(raw ?? '').trim();
  if (!text || !/^-?\d+(?:[.,]\d+)?$/.test(text)) return null;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
};

const isValidReportDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/**
 * @param {ReturnType<typeof createEmptySoilLabForm>} form
 * @returns {Record<string, string>}
 */
export function validateSoilLabForm(form) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!isValidReportDate(form.reportDate)) {
    errors.reportDate = MSG.sueloLab.fechaRequerida;
  }
  if (!String(form.laboratory || '').trim()) errors.laboratory = MSG.sueloLab.laboratorioRequerido;

  let entered = 0;
  let textureTotal = 0;
  for (const field of SOIL_LAB_MEASUREMENTS) {
    const raw = form.values?.[field.key] ?? '';
    if (!String(raw).trim()) continue;
    entered += 1;
    const value = parseDecimal(raw);
    if (value === null) {
      errors[field.key] = MSG.sueloLab.numeroInvalido;
    } else if (field.kind === 'ph' && (value < 0 || value > 14)) {
      errors[field.key] = MSG.sueloLab.phFueraDeRango;
    } else if (field.kind === 'percent' && (value < 0 || value > 100)) {
      errors[field.key] = MSG.sueloLab.porcentajeFueraDeRango;
    } else if (field.kind === 'amount' && value < 0) {
      errors[field.key] = MSG.sueloLab.valorNegativo;
    }
    if (!String(form.units?.[field.key] || '').trim()) {
      errors[field.key] = MSG.sueloLab.unidadRequerida;
    }
    if (['sand', 'silt', 'clay'].includes(field.key) && value !== null) textureTotal += value;
  }
  if (!entered) errors.values = MSG.sueloLab.resultadoRequerido;
  if (textureTotal > 100) errors.texture = MSG.sueloLab.texturaFueraDeRango;
  return errors;
}

export function buildSoilLabLog(assetId, form) {
  const measurements = Object.fromEntries(SOIL_LAB_MEASUREMENTS
    .filter(({ key }) => String(form.values?.[key] ?? '').trim())
    .map(({ key, label }) => [key, {
      label,
      value: String(form.values[key]).trim(),
      unit: String(form.units?.[key] || '').trim(),
    }]));
  const timestamp = Math.floor(Date.parse(`${form.reportDate}T12:00:00Z`) / 1000);
  return {
    type: 'log--lab_test',
    attributes: {
      name: `Análisis de suelo, ${form.reportDate}`,
      timestamp,
      status: 'done',
      test_type: 'soil',
      data: JSON.stringify({
        schema: 'chagra.soil-lab-report.v1',
        source: { kind: 'laboratory', name: String(form.laboratory).trim() },
        report_date: form.reportDate,
        sample_depth: String(form.sampleDepth || '').trim() || null,
        method: String(form.method || '').trim() || null,
        measurements,
      }),
    },
    relationships: {
      asset: { data: [{ type: 'asset--land', id: assetId }] },
    },
  };
}
