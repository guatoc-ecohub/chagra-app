import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, MapPin, RefreshCw } from 'lucide-react';
import { HojaHomeA } from './esquema/HojaHomeA';
import './homea-data-screens.css';
import { groupPhotosByLocation, listGeotaggedTimelinePhotos } from '../services/fenologiaTimelineService';

const formatDate = (timestamp) => timestamp
  ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(timestamp))
  : 'Fecha no registrada';

function TimelineStrip({ photos }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2" aria-label="Fotos ordenadas en el tiempo">
      {photos.map((photo) => (
        <figure key={photo.id} className="min-w-[130px] w-[130px] shrink-0">
          <img src={photo.url} alt={photo.speciesSlug ? `Foto de ${photo.speciesSlug}` : 'Foto de la finca'} className="h-28 w-full rounded-xl object-cover border border-slate-700" />
          <figcaption className="mt-1 text-xs text-slate-300">{formatDate(photo.timestamp)}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export default function FenologiaLapsoScreen({ onBack }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const photoUrls = useRef([]);
  const groups = useMemo(() => groupPhotosByLocation(photos), [photos]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await listGeotaggedTimelinePhotos();
      photoUrls.current.forEach((photo) => photo.revoke?.());
      photoUrls.current = next;
      setPhotos(next);
    } catch (loadError) {
      setError(loadError?.message || 'No pude leer las fotos locales.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect -- la carga es asíncrona y sincroniza IndexedDB
    return () => photoUrls.current.forEach((photo) => photo.revoke?.());
  }, []);

  return (
    <HojaHomeA title="Fenología por lapso" eyebrow="Memoria visual" onBack={onBack}>
      <div className="ha-data-screen ha-fenologia mx-auto flex max-w-3xl flex-col gap-5">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">La misma mata, en el tiempo</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Compare sus recorridos</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
            Agrupamos fotos cercanas por GPS y las ordenamos por fecha. Así puede ver cómo cambia un punto de la finca entre recorridos.
          </p>
        </header>

        {loading && <p className="ha-data-card rounded-2xl border border-slate-700 bg-slate-900/70 p-6 text-sm text-slate-300">Buscando fotos georreferenciadas...</p>}
        {!loading && error && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-6 text-sm text-amber-100">
            <p>{error}</p>
            <button type="button" onClick={load} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-4 font-bold text-slate-950"><RefreshCw size={16} /> Reintentar</button>
          </div>
        )}
        {!loading && !error && groups.length === 0 && (
          <div className="ha-data-card rounded-2xl border border-dashed border-emerald-500/40 bg-emerald-950/20 p-8 text-center">
            <Camera className="mx-auto text-emerald-300" size={34} />
            <h3 className="mt-4 text-lg font-bold text-white">Todavía no hay una línea temporal</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-300">Registre dos o más fotos con GPS desde lugares parecidos. Al guardar una foto de la finca, active su ubicación para comparar los cambios en el tiempo.</p>
            <a href="#activos" className="ha-data-action mt-5 min-h-11 rounded-full px-5 font-bold">Ir a mis activos</a>
          </div>
        )}
        {!loading && !error && groups.length > 0 && (
          <div className="flex flex-col gap-4" aria-live="polite">
            <p className="text-sm text-slate-300"><span className="font-bold text-white">{groups.length}</span> {groups.length === 1 ? 'punto observado' : 'puntos observados'} con GPS</p>
            {groups.map((group) => (
              <article key={group.id} className="ha-data-card rounded-2xl border border-slate-700 bg-slate-900/80 p-4 shadow-xl shadow-black/10">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 font-bold text-white"><MapPin size={17} className="text-emerald-300" /> Punto de la finca</h3>
                    <p className="mt-1 text-xs text-slate-400">{group.photos.length} {group.photos.length === 1 ? 'foto' : 'fotos'} · {formatDate(group.firstTimestamp)} a {formatDate(group.lastTimestamp)}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-200">{group.photos.length > 1 ? 'Comparar' : 'Una foto'}</span>
                </div>
                <TimelineStrip photos={group.photos} />
              </article>
            ))}
          </div>
        )}
      </div>
    </HojaHomeA>
  );
}
