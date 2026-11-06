import { useEffect, useMemo, useState } from 'react';
import { CloudRain, Clock } from 'lucide-react';
import { resolveClimaLocation } from '../../services/climaService';
import { fetchAgroMeteo, leerAgroMeteoGuardado } from '../../services/agroMeteoService';
import { consejoRiegoHoy, deDondeSale, minutosTxt } from '../../services/consejoRiego';
import { horaConMinutosEsCO } from '../../utils/fechaEsCO.js';

/**
 * RiegoDeHoy — «El riego de hoy»: cuántos minutos regar cada sistema de la
 * finca, con el pronóstico de su finca y la cuenta de los mundos del goteo
 * (services/consejoRiego). Usa los datos del clima, no la pantalla del clima.
 *
 * Primero pinta lo que ya está guardado en el teléfono; si hay señal, pide el
 * pronóstico (el mismo de «El tiempo», guardado 3 horas).
 *
 * @param {object} props
 * @param {Array<object>} props.sistemas miGoteoService.sistemasDeGoteo
 * @param {object|null} [props.agrometeo] pronóstico ya normalizado (pruebas)
 * @param {number} [props.ahoraMs] reloj (pruebas)
 */
export default function RiegoDeHoy({ sistemas, agrometeo: dado = undefined, ahoraMs = undefined }) {
  const lugar = useMemo(() => (dado === undefined ? resolveClimaLocation() : null), [dado]);
  // El reloj se toma al abrir y cada vez que llega un pronóstico nuevo.
  const [leido, setLeido] = useState(() => ({ pronostico: dado === undefined ? leerAgroMeteoGuardado(lugar) : null, reloj: Date.now() }));

  useEffect(() => {
    if (dado !== undefined || !lugar || (typeof navigator !== 'undefined' && navigator.onLine === false)) return undefined;
    let vivo = true;
    fetchAgroMeteo(lugar).then((p) => { if (vivo && p) setLeido({ pronostico: p, reloj: Date.now() }); }).catch(() => {});
    return () => { vivo = false; };
  }, [dado, lugar]);

  const pronostico = dado !== undefined ? dado : leido.pronostico;
  const consejo = useMemo(
    () => consejoRiegoHoy({ sistemas, agrometeo: pronostico, ahoraMs: ahoraMs ?? leido.reloj }),
    [sistemas, pronostico, ahoraMs, leido.reloj],
  );
  if (consejo.estado === 'sin-sistema') return null;

  const consultado = consejo.clima?.consultado ? horaConMinutosEsCO(consejo.clima.consultado) : null;
  return (
    <section aria-labelledby="riego-hoy-t" className="rounded-2xl border border-sky-400/40 bg-sky-950/50 p-4" data-testid="riego-hoy">
      <h2 id="riego-hoy-t" className="text-lg font-bold text-white">El riego de hoy</h2>
      {consejo.estado === 'sin-clima' ? (
        <p className="mt-2 text-sky-50" data-testid="riego-hoy-sin-clima">{consejo.texto}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-3">
            {consejo.sectores.map((s) => (
              <li key={s.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-3" data-testid="riego-hoy-sector">
                <p className="font-bold text-white">{s.nombre}</p>
                {s.tipo === 'no-riegue' ? (
                  <p className="mt-1 inline-flex items-center gap-2 text-xl font-black text-sky-200">
                    <CloudRain size={22} aria-hidden="true" /> Hoy no riegue
                  </p>
                ) : s.cuenta ? (
                  <p className="mt-1 inline-flex items-center gap-2 text-xl font-black text-emerald-200">
                    <Clock size={22} aria-hidden="true" /> {minutosTxt(s.cuenta.minutos)}
                    {s.cuenta.turnos > 1 ? <span className="text-base font-bold text-emerald-100">por turno, {s.cuenta.turnos} turnos</span> : null}
                  </p>
                ) : null}
                {s.detalle ? <p className="mt-1 text-sm text-slate-200">{s.detalle}</p> : null}
                {deDondeSale(s.cuenta, consejo.clima) ? (
                  <details className="mt-2">
                    <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-sky-200">¿De dónde sale?</summary>
                    <p className="text-sm text-slate-300">{deDondeSale(s.cuenta, consejo.clima)}</p>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-300">
            Pronóstico de su finca para hoy{consultado ? ` (consultado: ${consultado})` : ''}. Es un cálculo para orientarse: mire la tierra antes de regar.
          </p>
        </>
      )}
    </section>
  );
}
