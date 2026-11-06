/* eslint-disable chagra-i18n/no-hardcoded-spanish */
import { useState } from 'react';
import { BookOpen, Headphones, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { HojaHomeA } from '../esquema/HojaHomeA';
import DescensoLaunch from '../DescensoLaunch.jsx';
import './sala.css';

/* Marco reutilizable para cursos breves que se recorren estación por estación. */
export default function SalaCurso({ title, eyebrow = 'SALA DE CAMPO', onBack, station, index, total, children, words, quiz, sources, onNext, onPrevious, last = false }) {
  const [panel, setPanel] = useState('');
  const listen = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(`${station.title}. ${station.body || ''}`));
  };
  return <HojaHomeA title={title} eyebrow={eyebrow} onBack={onBack}>
    <section className="sala">
      <div className="sala__scene" aria-label="Escena ilustrada de una finca y el suelo" role="img">
        <svg viewBox="0 0 360 150" aria-hidden="true"><rect width="360" height="150" rx="18" fill="var(--ha-papel-2)"/><circle cx="302" cy="32" r="17" fill="var(--ha-oro)"/><path d="M0 92 Q78 30 160 85 T360 63 V150 H0Z" fill="var(--ha-verde-2)"/><path d="M0 112 Q120 82 220 115 T360 100 V150 H0Z" fill="var(--ha-teja)"/><path d="M0 128 Q100 107 210 132 T360 120 V150 H0Z" fill="var(--ha-tinta-2)"/><path d="M181 86v-39m0 17q-20-20-32-10m32 2q18-22 31-12" fill="none" stroke="var(--ha-verde)" strokeWidth="5" strokeLinecap="round"/><path d="M181 88v48m0-27-19 17m19-5 21 12" stroke="var(--ha-papel)" strokeWidth="2" fill="none"/><path d="M76 85V52m0 14q-15-16-25-8m25 3q12-16 23-8" stroke="var(--ha-verde)" strokeWidth="4" fill="none" strokeLinecap="round"/></svg>
        <span>El lote guarda sus señales</span>
      </div>
      <div className="sala__progress"><strong>Estación {index + 1} de {total}</strong><span>{station.title}</span></div>
      <DescensoLaunch slug="suelo" />
      {children}
      <nav className="sala__tools" aria-label="Herramientas de aprendizaje">
        <button onClick={listen}><Headphones size={18}/>Escuchar</button>
        <button onClick={() => setPanel(panel === 'words' ? '' : 'words')}><BookOpen size={18}/>Palabras</button>
        <button onClick={() => setPanel(panel === 'quiz' ? '' : 'quiz')}><HelpCircle size={18}/>Repaso</button>
        <button onClick={() => setPanel(panel === 'sources' ? '' : 'sources')}>Fuentes</button>
      </nav>
      {panel && <aside className="sala__panel"><button className="sala__close" onClick={() => setPanel('')}>Cerrar</button>
        {panel === 'words' && <><h3>Palabras</h3>{words.map(([word, meaning]) => <p key={word}><b>{word}:</b> {meaning}</p>)}</>}
        {panel === 'quiz' && <><h3>Repaso</h3>{quiz.map((q) => <details key={q.question}><summary>{q.question}</summary><p>{q.answer}</p></details>)}</>}
        {panel === 'sources' && <><h3>Fuentes</h3><ul>{sources.map((source) => <li key={source}>{source}</li>)}</ul></>}
      </aside>}
      <div className="sala__pager">
        {index > 0 && <button className="sala__secondary" onClick={onPrevious}><ChevronLeft size={18}/>Anterior</button>}
        <button className="sala__primary" onClick={onNext}>{last ? 'Guardar en mi finca' : 'Seguir'}<ChevronRight size={18}/></button>
      </div>
    </section>
  </HojaHomeA>;
}
