/* eslint-disable chagra-i18n/no-hardcoded-spanish */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ChevronDown, Leaf, LoaderCircle, MapPin, ShieldCheck, Upload, UserRound, WifiOff, X } from 'lucide-react';
import useAssetStore from '../../store/useAssetStore';
import { getProfile } from '../../services/userProfileService';
import { getActiveTenantId } from '../../services/tenantContext';
import { comprimirFoto, guardarFotoPendiente } from '../../services/fotoOfflineService';
import './herbario.css';

const EMPTY = [];

function plantLabel(plant) {
  return plant?.attributes?.name || plant?.name || plant?.attributes?._speciesSlug || 'Planta sin nombre';
}

function profileName() {
  const profile = getProfile() || {};
  if (profile.nombre?.trim()) return profile.nombre.trim();
  if (typeof window !== 'undefined') return window.localStorage.getItem('chagra:operator:name') || 'su finca';
  return 'su finca';
}

function formatTime(date) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function HerbarioVivoScreen({ onBack }) {
  const plants = useAssetStore((state) => state.plants || EMPTY);
  const hydrated = useAssetStore((state) => state.isHydrated);
  const hydrate = useAssetStore((state) => state.hydrate);
  const [selectedPlant, setSelectedPlant] = useState('');
  const [queuedPhotos, setQueuedPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const photosRef = useRef([]);
  const owner = useMemo(() => profileName(), []);
  const tenant = getActiveTenantId();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview)), []);

  const plant = plants.find((item) => item.id === selectedPlant) || plants[0];

  async function handleFiles(event) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
    event.target.value = '';
    if (!files.length || !plant) return;
    setBusy(true);
    setNotice('Guardando la foto en la cola local...');
    try {
      const entries = [];
      for (const file of files) {
        const blob = await comprimirFoto(file);
        const id = await guardarFotoPendiente({ blob, assetId: plant.id });
        entries.push({ id, name: plantLabel(plant), preview: URL.createObjectURL(blob), createdAt: new Date() });
      }
      setQueuedPhotos((current) => {
        const next = [...entries, ...current];
        photosRef.current = next;
        return next;
      });
      setNotice(`${entries.length === 1 ? 'Foto guardada' : `${entries.length} fotos guardadas`} para revisión.`);
    } catch {
      setNotice('No se pudo guardar la foto. Inténtelo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="hv-screen" data-testid="herbario-vivo-screen">
      <div className="hv-shell">
        <header className="hv-topbar">
          <button type="button" className="hv-back" onClick={onBack} aria-label="Volver al inicio"><X size={19} aria-hidden="true" /> Cerrar</button>
          <span className="hv-kicker">Cuaderno personal</span>
        </header>

        <section className="hv-hero">
          <div className="hv-orbit hv-orbit-one" aria-hidden="true" />
          <div className="hv-orbit hv-orbit-two" aria-hidden="true" />
          <div className="hv-hero-copy">
            <p className="hv-eyebrow"><Leaf size={15} aria-hidden="true" /> Herbario vivo</p>
            <h1>Las plantas de {owner}</h1>
            <p className="hv-intro">Cada recorrido deja memoria. Tome una foto, elija la mata y la dejamos lista para que usted la revise.</p>
          </div>
          <div className="hv-stamp" aria-label="Fotos bajo revisión">
            <span>{queuedPhotos.length}</span>
            <small>en cola</small>
          </div>
        </section>

        <section className="hv-card hv-capture-card" aria-labelledby="hv-capture-title">
          <div className="hv-card-heading">
            <div><p className="hv-eyebrow">Nuevo registro</p><h2 id="hv-capture-title">¿Qué encontró hoy?</h2></div>
            <Camera className="hv-heading-icon" size={27} aria-hidden="true" />
          </div>
          <label className="hv-label" htmlFor="herbario-plant">Atar la foto a una planta</label>
          {plants.length ? (
            <div className="hv-select-wrap">
              <select id="herbario-plant" className="hv-select" value={selectedPlant || plants[0].id} onChange={(event) => setSelectedPlant(event.target.value)}>
                {plants.map((item) => <option key={item.id} value={item.id}>{plantLabel(item)}</option>)}
              </select>
              <ChevronDown size={18} aria-hidden="true" />
            </div>
          ) : (
            <div className="hv-empty-plants"><Leaf size={18} aria-hidden="true" /> Primero registre una planta en Mi finca.</div>
          )}
          <input className="hv-visually-hidden" id="herbario-photo" type="file" accept="image/*" capture="environment" multiple onChange={handleFiles} disabled={!plant || busy} />
          <label className={`hv-capture-button${!plant || busy ? ' hv-disabled' : ''}`} htmlFor="herbario-photo">
            {busy ? <LoaderCircle className="hv-spin" size={22} aria-hidden="true" /> : <Upload size={22} aria-hidden="true" />}
            {busy ? 'Guardando...' : 'Tomar o elegir foto'}
          </label>
          <p className="hv-footnote"><WifiOff size={14} aria-hidden="true" /> Funciona sin señal. La foto queda en este dispositivo.</p>
          {notice && <p className="hv-notice" role="status"><Check size={16} aria-hidden="true" /> {notice}</p>}
        </section>

        <section className="hv-privacy" aria-label="Privacidad del herbario">
          <ShieldCheck size={19} aria-hidden="true" /><span><strong>Usted decide qué queda.</strong> Nada se publica ni escribe en el grafo automáticamente.</span>
        </section>

        <section className="hv-gallery" aria-labelledby="hv-gallery-title">
          <div className="hv-gallery-heading"><div><p className="hv-eyebrow">Su recorrido</p><h2 id="hv-gallery-title">Fotos por revisar</h2></div><span>{queuedPhotos.length} {queuedPhotos.length === 1 ? 'foto' : 'fotos'}</span></div>
          {queuedPhotos.length ? <div className="hv-grid">{queuedPhotos.map((photo) => <article className="hv-photo" key={photo.id}><img src={photo.preview} alt={`Registro de ${photo.name}`} /><div className="hv-photo-meta"><strong>{photo.name}</strong><small><MapPin size={12} aria-hidden="true" /> {formatTime(photo.createdAt)}</small></div><span className="hv-review-pill"><UserRound size={12} aria-hidden="true" /> Revisión suya</span></article>)}</div> : <div className="hv-empty"><div className="hv-empty-icon"><Camera size={25} aria-hidden="true" /></div><div><h3>Su herbario empieza aquí</h3><p>Las fotos que tome en el campo aparecerán aquí antes de cualquier sincronización.</p></div></div>}
        </section>
        <footer className="hv-footer">Perfil local: {tenant || 'sin sesión identificada'} · Curación humana obligatoria</footer>
      </div>
    </main>
  );
}
