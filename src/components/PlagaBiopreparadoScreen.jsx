import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Camera, ChevronRight, CircleAlert,
  Leaf, LoaderCircle, LockKeyhole, RotateCcw, ShieldCheck, Sparkles,
} from 'lucide-react';
import { MSG } from '../config/messages';
import { analyzeFoliage } from '../services/aiService';
import './plaga-biopreparado.css';

function DemoLeaf() {
  return (
    <div className="pbp-demo-photo" aria-label="Ilustración de una hoja, solo como referencia" role="img">
      <span className="pbp-photo-stamp">ILUSTRACIÓN</span>
      <div className="pbp-leaf" aria-hidden="true">
        <span className="pbp-vein pbp-vein-main" />
        <span className="pbp-vein pbp-vein-one" />
        <span className="pbp-vein pbp-vein-two" />
        <span className="pbp-trail pbp-trail-one" />
        <span className="pbp-trail pbp-trail-two" />
      </div>
      <span className="pbp-photo-caption">Referencia visual, no es un diagnóstico</span>
    </div>
  );
}

export default function PlagaBiopreparadoScreen({ onBack, onNavigate }) {
  const inputRef = useRef(null);
  const photoUrlRef = useRef(null);
  const analysisRequestRef = useRef(0);
  const [photo, setPhoto] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [phase, setPhase] = useState('idle');

  useEffect(() => () => {
    analysisRequestRef.current += 1;
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
  }, []);

  const selectPhoto = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    analysisRequestRef.current += 1;
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    const url = URL.createObjectURL(file);
    photoUrlRef.current = url;
    setPhoto({ url, file, name: file.name });
    setDiagnosis(null);
    setPhase('ready');
  };

  const analyze = async () => {
    if (!photo?.file) return;
    const requestId = analysisRequestRef.current;
    setDiagnosis(null);
    setPhase('analyzing');
    try {
      const result = await analyzeFoliage(photo.file, { skipRag: true });
      if (requestId !== analysisRequestRef.current) return;
      if (!result || !Array.isArray(result.issues)) {
        setPhase('unavailable');
        return;
      }
      setDiagnosis({ issues: result.issues.filter((issue) => typeof issue === 'string' && issue.trim()) });
      setPhase('result');
    } catch {
      if (requestId === analysisRequestRef.current) setPhase('unavailable');
    }
  };

  const reset = () => {
    analysisRequestRef.current += 1;
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = null;
    setPhoto(null);
    setDiagnosis(null);
    setPhase('idle');
  };

  const isAnalyzing = phase === 'analyzing';
  const hasResult = phase === 'result';
  const findings = diagnosis?.issues || [];

  return (
    <main className="pbp-shell">
      <header className="pbp-header">
        <button className="pbp-back" type="button" onClick={onBack} aria-label="Volver">
          <ArrowLeft size={18} />
          <span>Sanidad de la finca</span>
        </button>
        <span className="pbp-header-mark"><Leaf size={16} /> CAMPO / 06</span>
      </header>

      <section className="pbp-intro">
        <p className="pbp-kicker"><span className="pbp-kicker-dot" /> Consulta visual</p>
        <h1>¿Qué se observa<br /><em>en esta hoja?</em></h1>
        <p className="pbp-lead">Suba una foto para obtener hallazgos orientativos de daños visibles. La lectura no confirma una plaga ni selecciona controladores.</p>
      </section>

      <section className="pbp-workbench" aria-label="Lectura visual de una hoja">
        <div className="pbp-photo-column">
          <div className="pbp-section-label"><span>01</span> Evidencia de campo</div>
          {photo ? (
            <div className="pbp-uploaded-photo">
              <img src={photo.url} alt={`Foto seleccionada: ${photo.name}`} />
              <button type="button" className="pbp-replace" onClick={() => inputRef.current?.click()}>
                <Camera size={15} /> Cambiar foto
              </button>
            </div>
          ) : <DemoLeaf />}
          <input ref={inputRef} className="pbp-hidden-input" type="file" accept="image/*" capture="environment" aria-label="Foto de la hoja" onChange={(event) => {
            selectPhoto(event.target.files?.[0]);
            event.target.value = '';
          }} />
          <div className="pbp-photo-actions">
            <button type="button" className="pbp-outline-button" onClick={() => inputRef.current?.click()}>
              <Camera size={17} /> {photo ? 'Cambiar foto' : 'Tomar o elegir foto'}
            </button>
            {photo && <span className="pbp-file-name">{photo.name}</span>}
          </div>
        </div>

        <div className="pbp-reading-column">
          <div className="pbp-section-label"><span>02</span> Lectura visual</div>
          {phase === 'idle' && (
            <div className="pbp-empty-reading">
              <div className="pbp-empty-icon"><Sparkles size={22} /></div>
              <h2>Elija una foto para comenzar</h2>
              <p>La ilustración es solo una referencia. Todavía no se ha analizado ninguna foto.</p>
            </div>
          )}
          {phase === 'ready' && (
            <div className="pbp-empty-reading">
              <div className="pbp-empty-icon"><Sparkles size={22} /></div>
              <h2>Foto lista para revisar</h2>
              <p>El analizador de follaje propone daños visibles. Revise el resultado en campo antes de elegir un controlador.</p>
              <button type="button" className="pbp-primary-button" onClick={analyze}>
                Analizar foto <ChevronRight size={17} />
              </button>
            </div>
          )}
          {isAnalyzing && (
            <div className="pbp-empty-reading pbp-analyzing" aria-live="polite">
              <LoaderCircle className="pbp-spinner" size={27} />
              <h2>Analizando la imagen...</h2>
              <p>El analizador de follaje está buscando daños visibles.</p>
            </div>
          )}
          {phase === 'unavailable' && (
            <div className="pbp-empty-reading" role="status">
              <div className="pbp-empty-icon"><CircleAlert size={22} /></div>
              <h2>{MSG.photoCapture.readError}</h2>
              <p>Intente con otra imagen o describa los síntomas para revisarlos.</p>
            </div>
          )}
          {hasResult && (
            <div className="pbp-result" aria-live="polite">
              <div className="pbp-result-top"><span className="pbp-proposal"><Sparkles size={14} /> LECTURA ORIENTATIVA</span><span className="pbp-result-meta">Analizador de follaje</span></div>
              <h2>Hallazgos sugeridos</h2>
              {findings.length > 0 ? (
                <ul className="pbp-findings">
                  {findings.map((finding, index) => <li key={`${index}-${finding}`}>{finding}</li>)}
                </ul>
              ) : <p className="pbp-result-note">No se distinguieron daños visibles en esta imagen.</p>}
              <div className="pbp-review-note"><CircleAlert size={17} /><span>Confirme los hallazgos en la planta. Esta lectura no confirma una plaga ni define qué controlador aplicar.</span></div>
              <div className="pbp-result-actions">
                <button type="button" className="pbp-primary-button" onClick={() => onNavigate?.('biopreparados', { back: 'plaga_biopreparado' })}>Ver fichas de biopreparados <ChevronRight size={17} /></button>
                <button type="button" className="pbp-reset" onClick={reset}><RotateCcw size={15} /> Revisar otra foto</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="pbp-footer"><LockKeyhole size={14} /><span>La lectura no se guarda y requiere su revisión.</span><span className="pbp-footer-seal"><ShieldCheck size={14} /> Sin auto-escritura</span></footer>
    </main>
  );
}
