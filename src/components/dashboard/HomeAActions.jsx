import { activarEscucha } from '../../services/escuchaService';
import { MSG } from '../../config/messages';
import './home-a-actions.css';

/** @param {{ onNavigate?: (view: string, data?: { focusInput: boolean }) => void }} props */
export default function HomeAActions({ onNavigate }) {
  return (
    <nav className="hia-acciones" aria-label="Acciones principales">
      <button type="button" onClick={() => onNavigate?.('juegos')}>Jugar</button>
      <button type="button" onClick={() => activarEscucha({ fuente: 'home_a' })}>Hábleme</button>
      <button type="button" onClick={() => onNavigate?.('sembrar')}>Anotar una siembra</button>
      <button type="button" onClick={() => onNavigate?.('cosechar')}>Anotar una cosecha</button>
      <button type="button" onClick={() => onNavigate?.('task_log')}>{MSG.nav.tareas}</button>
      <button type="button" onClick={() => onNavigate?.('agente', { focusInput: true })}>Preguntar por escrito</button>
    </nav>
  );
}
