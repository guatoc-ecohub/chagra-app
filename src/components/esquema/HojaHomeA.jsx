/* eslint-disable chagra-i18n/no-hardcoded-spanish -- copy de interfaz solicitado para el marco común. */
import './HojaHomeA.css';

/** @param {{ title: string, eyebrow?: string, onBack?: () => void, onHelp?: () => void, children: import('react').ReactNode }} props */
export function HojaHomeA({ title, eyebrow, onBack, onHelp, children }) {
  return (
    <div className="hoja-home-a">
      <header className="hoja-home-a__header">
        <button className="hoja-home-a__back" type="button" onClick={onBack}>
          ← Volver
        </button>
        {onHelp && (
          <button className="hoja-home-a__help" type="button" onClick={onHelp}>
            Ayuda
          </button>
        )}
      </header>
      <main className="hoja-home-a__main">
        {eyebrow && <p className="hoja-home-a__eyebrow">{eyebrow}</p>}
        <h1 className="hoja-home-a__title">{title}</h1>
        <div className="hoja-home-a__content">{children}</div>
      </main>
    </div>
  );
}

export default HojaHomeA;
