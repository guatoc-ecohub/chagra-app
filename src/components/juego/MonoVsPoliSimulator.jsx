import { useState } from 'react';
import { BarChart3, FlaskConical, Leaf, ShieldCheck, Sprout, TrendingUp } from 'lucide-react';
import asociaciones from '../../data/asociaciones-comparativa.json';

const confidenceStyles = {
  alta: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  media: 'bg-amber-100 text-amber-950 border-amber-300',
  baja: 'bg-rose-100 text-rose-950 border-rose-300',
};

function formatNumber(value) {
  if (value === null || value === undefined) return null;
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

function formatRange(min, max, suffix = '') {
  if (min === null || min === undefined || max === null || max === undefined) return null;
  return `${formatNumber(min)} a ${formatNumber(max)}${suffix}`;
}

function lerText(ler) {
  if (!ler) return 'Sin dato LER comparable';
  if (ler.valor_aprox) return `Aprox. ${formatNumber(ler.valor_aprox)} LER`;
  if (ler.valor) {
    return ler.error
      ? `${formatNumber(ler.valor)} LER +/- ${formatNumber(ler.error)}`
      : `${formatNumber(ler.valor)} LER`;
  }
  return formatRange(ler.min, ler.max, ' LER') || 'Sin dato LER comparable';
}

function nitrogenText(item) {
  const poli = item.policultivo || {};
  if (item.id === 'milpa-maiz-frijol-ahuyama' && poli.N_fijado_pct) {
    return `${formatRange(poli.N_fijado_pct.min, poli.N_fijado_pct.max, '% del N del grano del fríjol que proviene de fijación')}`;
  }
  if (poli.N_fijado_kg_ha) return `${formatNumber(poli.N_fijado_kg_ha)} kg N/ha`;
  if (typeof poli.N_fijado_pct === 'number') return `${formatNumber(poli.N_fijado_pct)}% de N fijado`;
  if (poli.N_fijado_pct) {
    return formatRange(poli.N_fijado_pct.min, poli.N_fijado_pct.max, '% de N fijado');
  }
  const sustitucion = poli.ahorro_insumos;
  if (sustitucion?.fertilizacion_N_sustituible_kg_ha_max !== undefined) {
    return formatRange(
      sustitucion.fertilizacion_N_sustituible_kg_ha_min,
      sustitucion.fertilizacion_N_sustituible_kg_ha_max,
      ' kg N/ha sustituibles',
    );
  }
  return 'Sin dato directo';
}

function inputSavingsText(ahorro) {
  if (!ahorro) return 'Sin ahorro cuantificado';
  if (ahorro.arvenses_reduccion_pct_min !== undefined) {
    return formatRange(
      ahorro.arvenses_reduccion_pct_min,
      ahorro.arvenses_reduccion_pct_max,
      '% menos arvenses',
    );
  }
  if (ahorro.N_sintesis_reduccion_pct_min !== undefined) {
    return formatRange(
      ahorro.N_sintesis_reduccion_pct_min,
      ahorro.N_sintesis_reduccion_pct_max,
      '% menos N de sintesis',
    );
  }
  if (ahorro.fertilizacion_N_sustituible_kg_ha_max !== undefined) {
    return formatRange(
      ahorro.fertilizacion_N_sustituible_kg_ha_min,
      ahorro.fertilizacion_N_sustituible_kg_ha_max,
      ' kg N/ha sustituibles',
    );
  }
  return 'Ahorro sin formato disponible';
}

function pestControlText(control) {
  if (!control) return 'Sin dato de plaga';
  if (typeof control === 'number') return `${formatNumber(control)}% menos plaga`;
  if (control.infestacion_reduccion_pct_min !== undefined) {
    return formatRange(
      control.infestacion_reduccion_pct_min,
      control.infestacion_reduccion_pct_max,
      '% menos infestacion',
    );
  }
  return 'Control reportado';
}

function extraIndicator(item) {
  const otros = item.policultivo?.otros_indicadores;
  if (!otros) return null;
  if (otros.productividad_total_sistema_factor) {
    return `${formatNumber(otros.productividad_total_sistema_factor)}x productividad total del sistema`;
  }
  if (otros.carbono_biomasa_mg_C_ha) {
    return `${formatNumber(otros.carbono_biomasa_mg_C_ha)} Mg C/ha en biomasa`;
  }
  if (otros.ganancia_t_ha) return `+${formatNumber(otros.ganancia_t_ha)} t/ha reportadas`;
  return null;
}

function MetricCard({ icon, label, mono, poli, emphasis }) {
  const MetricIcon = icon;

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-stone-700">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-lime-100 text-lime-800">
          <MetricIcon size={18} aria-hidden="true" />
        </span>
        <h4 className="text-sm font-black leading-tight">{label}</h4>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-stone-100 p-2">
          <p className="text-[0.68rem] font-bold uppercase tracking-wide text-stone-500">Monocultivo</p>
          <p className="mt-1 text-sm font-extrabold leading-tight text-stone-900">{mono}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-2 ring-1 ring-emerald-200">
          <p className="text-[0.68rem] font-bold uppercase tracking-wide text-emerald-700">Policultivo</p>
          <p className="mt-1 text-sm font-extrabold leading-tight text-emerald-950">{poli}</p>
        </div>
      </div>
      {emphasis && <p className="mt-2 text-xs font-semibold text-lime-900">{emphasis}</p>}
    </article>
  );
}

const APARTE_GENERICO = 'Un solo cultivo por lote. Es la base para comparar: se compra todo el abono y la plaga suele pegar más fuerte.';

function DecisionCard({ item, cultivos }) {
  const [eleccion, setEleccion] = useState(null);
  const d = item.decision || {};
  const pregunta = d.pregunta || `¿Siembra ${cultivos.join(', ')} juntos o cada uno aparte?`;
  const efectos = { juntos: d.juntos || item.diferencia_resumen, aparte: d.aparte || APARTE_GENERICO };
  const opciones = [
    { id: 'juntos', rotulo: 'Juntos', glosa: 'policultivo: varios cultivos en el mismo lote' },
    { id: 'aparte', rotulo: 'Aparte', glosa: 'monocultivo: un solo cultivo por lote' },
  ];

  return (
    <div data-testid={`mpp-decision-${item.id}`} className="border-b border-lime-200 bg-white p-4 sm:p-5">
      <p className="text-lg font-black leading-snug text-stone-950">{pregunta}</p>
      <div role="group" aria-label="Su elección" className="mt-3 grid gap-2 sm:grid-cols-2">
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={eleccion === o.id}
            onClick={() => setEleccion(o.id)}
            className={`min-h-11 rounded-2xl border-2 px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
              eleccion === o.id
                ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                : 'border-stone-300 bg-white text-stone-900 hover:border-emerald-500'
            }`}
          >
            <span className="block text-base font-black">{o.rotulo}</span>
            <span className="block text-sm font-semibold text-stone-600">({o.glosa})</span>
          </button>
        ))}
      </div>
      <p
        data-testid={`mpp-efecto-${item.id}`}
        aria-live="polite"
        className="mt-3 rounded-2xl bg-lime-50 p-3 text-base font-semibold leading-relaxed text-stone-800"
      >
        {eleccion ? efectos[eleccion] : 'Toque una opción y vea qué pasa.'}
      </p>
    </div>
  );
}

function AssociationPanel({ item }) {
  const confidenceClass = confidenceStyles[item.confianza] || confidenceStyles.media;
  const extra = extraIndicator(item);
  // El catálogo admite listas y el formato de texto separado por barras.
  const cultivos = Array.isArray(item.cultivos)
    ? item.cultivos
    : String(item.cultivos || '').split('|').map(c => c.trim()).filter(Boolean);

  return (
    <section
      data-testid={`asociacion-${item.id}`}
      className="overflow-hidden rounded-[1.75rem] border border-lime-200 bg-stone-50 shadow-[0_20px_60px_rgba(63,72,47,0.14)]"
    >
      <div className="bg-[linear-gradient(135deg,#193a2f,#386641_52%,#a7c957)] p-4 text-white sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-100">Usted decide</p>
            <h3 className="mt-1 text-2xl font-black leading-tight">{item.asociacion}</h3>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {cultivos.map((cultivo) => (
            <span key={cultivo} className="rounded-full bg-white/16 px-3 py-1 text-sm font-bold text-white ring-1 ring-white/25">
              {cultivo}
            </span>
          ))}
        </div>
      </div>

      <DecisionCard item={item} cultivos={cultivos} />

      <details data-testid={`mpp-detalle-${item.id}`} className="bg-stone-50">
        <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-black text-stone-900 sm:px-5">
          Ver cifras, fuente y confianza
        </summary>
      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-5">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-stone-200 text-stone-800">
              <BarChart3 size={19} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-stone-500">Escenario</p>
              <h4 className="text-lg font-black text-stone-950">Monocultivo</h4>
            </div>
          </div>
          <p className="text-sm font-semibold leading-relaxed text-stone-700">{item.monocultivo.insumos}</p>
          <p className="mt-3 rounded-xl bg-stone-100 p-3 text-sm font-black text-stone-900">
            Rendimiento base: {item.monocultivo.rendimiento_rel ? `${item.monocultivo.rendimiento_rel}x` : 'linea base'}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-700 text-white">
              <Leaf size={19} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Escenario</p>
              <h4 className="text-lg font-black text-emerald-950">Policultivo</h4>
            </div>
          </div>
          <p className="text-sm font-semibold leading-relaxed text-emerald-950">{item.diferencia_resumen}</p>
          {extra && <p className="mt-3 rounded-xl bg-white/80 p-3 text-sm font-black text-emerald-950">{extra}</p>}
        </div>
      </div>

      <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2 lg:grid-cols-4 sm:px-5 sm:pb-5">
        <MetricCard
          icon={TrendingUp}
          label="Rendimiento y LER"
          mono="1x base"
          poli={lerText(item.policultivo.LER)}
          emphasis="LER mayor que 1 indica mejor uso de tierra."
        />
        <MetricCard
          icon={Sprout}
          label="Nitrogeno fijado"
          mono="Depende del manejo"
          poli={nitrogenText(item)}
          emphasis=""
        />
        <MetricCard
          icon={FlaskConical}
          label="Ahorro de insumos"
          mono="Compra completa"
          poli={inputSavingsText(item.policultivo.ahorro_insumos)}
          emphasis=""
        />
        <MetricCard
          icon={ShieldCheck}
          label="Control de plaga"
          mono="Mayor presion"
          poli={pestControlText(item.policultivo.control_plaga_pct)}
          emphasis=""
        />
      </div>

      <div className="border-t border-lime-200 bg-white px-4 py-3 text-sm text-stone-700 sm:px-5">
        <p className="mb-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${confidenceClass}`}>
            Confianza {item.confianza}
          </span>
        </p>
        <p className="font-black text-stone-900">Fuente usada</p>
        <p className="mt-1 break-words leading-relaxed">{item.fuente}</p>
      </div>
      </details>
    </section>
  );
}

export default function MonoVsPoliSimulator({ data = asociaciones }) {
  return (
    <div data-testid="mono-vs-poli-simulator" className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-5">
      <header className="rounded-[1.75rem] border border-lime-200 bg-[#f7f3e8] p-4 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-800">Juego: juntos o aparte</p>
        <h2 className="mt-2 text-3xl font-black leading-tight text-stone-950 sm:text-4xl">
          Elija cómo sembrar y vea qué pasa
        </h2>
        <p className="mt-3 max-w-3xl text-base font-semibold leading-relaxed text-stone-700">
          En cada tarjeta toque una opción. Las cifras y la fuente están abajo, en «Ver cifras, fuente y confianza».
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {data.map((item) => (
          <AssociationPanel key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
