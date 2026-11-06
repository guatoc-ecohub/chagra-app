import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  FileText,
  Leaf,
  LoaderCircle,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { ScreenShell } from '../common/ScreenShell';
import { captureAndCompress, savePhoto } from '../../services/photoService';
import { recognizeSpeciesGrounded } from '../../services/aiService';
import { MSG } from '../../config/messages';
import VisionJudgeReview from '../VisionJudgeReview';
import { callTool } from '../../services/sidecarClient';
import './grafo-foto.css';

const STATUS_COPY = {
  pending: { label: MSG.visionReview.catalogMatch, tone: 'muted' },
  'judge-error': { label: MSG.visionReview.catalogMatch, tone: 'caution' },
  verified: { label: 'Coincide con el catálogo', tone: 'verified' },
  'partial-match': { label: 'La especie base coincide', tone: 'caution' },
  rejected: { label: 'El catálogo no confirma esta especie', tone: 'caution' },
  offline: { label: 'Resultado sin validar por falta de conexión', tone: 'muted' },
  'sidecar-disabled': { label: 'Validación del catálogo no disponible', tone: 'muted' },
  'sidecar-error': { label: 'El catálogo no respondió', tone: 'caution' },
  'no-binomial': { label: 'No hay nombre científico para consultar', tone: 'caution' },
};

function firstValue(source, keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && String(source[key]).trim()) {
      return source[key];
    }
  }
  return '';
}

function listFromResponse(response) {
  if (Array.isArray(response)) return response;
  return response?.items || response?.results || response?.data || [];
}

function GraphPill({ children, tone = 'neutral' }) {
  return <span className={`gf-pill gf-pill--${tone}`}>{children}</span>;
}

function GraphSection({ icon: Icon, title, children }) {
  return (
    <section className="gf-section">
      <div className="gf-section-title">{React.createElement(Icon, { size: 16, 'aria-hidden': true })}<h3>{title}</h3></div>
      {children}
    </section>
  );
}

export default function GrafoFotoScreen({ onBack }) {
  const inputRef = useRef(null);
  const [phase, setPhase] = useState('pick');
  const [photoUrl, setPhotoUrl] = useState('');
  const [result, setResult] = useState(null);
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const processPhoto = useCallback(async (file) => {
    if (!file?.type?.startsWith('image/')) {
      setError('Seleccione una imagen de la cámara o de la galería.');
      return;
    }
    setError('');
    setReviewed(false);
    setResult(null);
    setGraph(null);
    setPhase('scanning');
    let nextUrl = '';
    try {
      const captured = await captureAndCompress(file);
      nextUrl = URL.createObjectURL(captured.blob);
      setPhotoUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });

      const vision = await recognizeSpeciesGrounded(captured.blob);
      setResult(vision);
      const speciesId = vision?._validation?.species_id
        || vision?._grounded?.validation?.species_id
        || vision?.scientific_name?.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');

      if (speciesId && vision?._grounded?.status !== 'rejected') {
        const [profile, companions, controllers] = await Promise.all([
          callTool('get_species', { species_id: speciesId }),
          callTool('get_companions', { species_id: speciesId }),
          callTool('get_biopreparados', { species_id: speciesId }),
        ]);
        setGraph({ profile, companions, controllers, speciesId });
      }
      await savePhoto({ blob: captured.blob, meta: { capturedAt: new Date().toISOString() } }).catch(() => {});
      setPhase('card');
    } catch {
      if (nextUrl) URL.revokeObjectURL(nextUrl);
      setError('No pude leer esa foto. Intente de nuevo con una imagen clara.');
      setPhase('pick');
    }
  }, []);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) processPhoto(file);
  };

  const reset = () => {
    setPhase('pick');
    setResult(null);
    setGraph(null);
    setReviewed(false);
    setError('');
    setPhotoUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });
  };

  const status = STATUS_COPY[result?._grounded?.status] || {
    label: 'Sugerencia de visión pendiente de revisión',
    tone: 'muted',
  };
  const profile = graph?.profile && !graph.profile._error ? graph.profile : null;
  const displayName = firstValue(profile, ['nombre_comun', 'common_name_es', 'name'])
    || firstValue(result, ['nombre_comun', 'common_name_es', 'name'])
    || 'Especie no identificada';
  const scientificName = firstValue(profile, ['nombre_cientifico', 'scientific_name'])
    || firstValue(result, ['nombre_cientifico', 'scientific_name']);
  const family = firstValue(profile || {}, ['familia_botanica', 'family']);
  const floor = firstValue(profile || {}, ['piso_termico', 'thermal_floor']);
  const companions = listFromResponse(graph?.companions).slice(0, 4);
  const controllers = listFromResponse(graph?.controllers).slice(0, 4);

  return (
    <ScreenShell title="Tarjeta del grafo" icon={ScanSearch} onBack={onBack}>
      <div className="gf-page">
        <header className="gf-intro">
          <div className="gf-kicker"><Sparkles size={14} /> Foto → grafo</div>
          <h2>Lo que Chagra reconoce, con sus fuentes a la vista</h2>
          <p>La foto propone una especie. Usted revisa la propuesta antes de convertirla en una observación.</p>
        </header>

        {phase === 'pick' && (
          <section className="gf-dropzone" aria-labelledby="gf-pick-title">
            <div className="gf-drop-icon"><Camera size={28} /></div>
            <h2 id="gf-pick-title">Tome una foto de la planta</h2>
            <p>La imagen se procesa localmente y se consulta el grafo cuando hay conexión.</p>
            <button type="button" className="gf-primary" onClick={() => inputRef.current?.click()}>
              <Camera size={18} /> Tomar o subir foto
            </button>
            <input ref={inputRef} className="gf-hidden" type="file" accept="image/*" capture="environment" onChange={handleFile} aria-label="Tomar o subir foto" />
            {error && <p className="gf-error" role="alert"><AlertTriangle size={15} /> {error}</p>}
          </section>
        )}

        {phase === 'scanning' && (
          <section className="gf-workbench" aria-live="polite">
            <div className="gf-photo-wrap"><img src={photoUrl} alt="Foto en revisión" /><div className="gf-scan-line" /></div>
            <div className="gf-loading"><LoaderCircle className="gf-spin" size={22} /><strong>Mirando la foto y consultando el grafo</strong><span>La GPU local puede tardar unos segundos.</span></div>
          </section>
        )}

        {phase === 'card' && (
          <div className="gf-layout">
            <figure className="gf-photo-card">
              <img src={photoUrl} alt="Foto enviada para identificar la planta" />
              <figcaption><ShieldCheck size={14} /> La foto permanece en este dispositivo</figcaption>
            </figure>
            <article className="gf-card">
              <div className="gf-card-top"><GraphPill tone={status.tone}>{status.label}</GraphPill><span className="gf-confidence">{typeof result?.confidence === 'number' ? `${Math.round(result.confidence * 100)}% de confianza` : 'Sin porcentaje'}</span></div>
              <VisionJudgeReview judge={result?._grounded?.judge} />
              <h2>{displayName}</h2>
              {scientificName && <p className="gf-scientific">{scientificName}</p>}
              <p className="gf-review-note"><CircleHelp size={15} /> Esto es una sugerencia. Revísela antes de registrar cualquier observación.</p>

              {graph ? (
                <>
                  <GraphSection icon={Leaf} title="En el grafo">
                    <div className="gf-facts">
                      {family && <div><span>Familia</span><strong>{family}</strong></div>}
                      {floor && <div><span>Piso térmico</span><strong>{floor}</strong></div>}
                      {!family && !floor && <p className="gf-muted">La ficha no trae estos datos.</p>}
                    </div>
                  </GraphSection>
                  {companions.length > 0 && <GraphSection icon={ChevronRight} title="Relaciones de cultivo"><div className="gf-pills">{companions.map((item, index) => <GraphPill key={`${item?.id || item?.name || index}`}>{firstValue(item, ['name', 'nombre', 'common_name']) || String(item)}</GraphPill>)}</div></GraphSection>}
                  {controllers.length > 0 && <GraphSection icon={FileText} title="Biopreparados relacionados"><div className="gf-pills">{controllers.map((item, index) => <GraphPill key={`${item?.id || item?.name || index}`} tone="source">{firstValue(item, ['name', 'nombre', 'title']) || String(item)}</GraphPill>)}</div></GraphSection>}
                </>
              ) : <div className="gf-empty"><AlertTriangle size={17} /><span>No pude abrir una ficha del grafo para esta sugerencia. No inventé datos.</span></div>}

              <div className="gf-actions">
                <button type="button" className={`gf-review-button ${reviewed ? 'is-reviewed' : ''}`} onClick={() => setReviewed((value) => !value)}>
                  {reviewed ? <Check size={17} /> : <ShieldCheck size={17} />} {reviewed ? 'Revisión marcada' : 'Marcar como revisada'}
                </button>
                <button type="button" className="gf-secondary" onClick={reset}><RefreshCw size={16} /> Otra foto</button>
              </div>
              <p className="gf-footer"><ShieldCheck size={13} /> Nada se escribe en el grafo desde esta tarjeta.</p>
            </article>
          </div>
        )}

        {phase === 'card' && result?._grounded?.status === 'rejected' && <p className="gf-rejected"><X size={15} /> El catálogo no confirmó el nombre sugerido. Use la tarjeta solo como pista.</p>}
      </div>
    </ScreenShell>
  );
}
