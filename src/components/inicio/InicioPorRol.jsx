// SPDX-License-Identifier: AGPL-3.0-only
/**
 * InicioPorRol — el inicio según el rol de la finca (C16, C17).
 *
 * - Niña o niño: la sala de juegos y el Valle 3D van primero; el tablero de
 *   la finca no es su inicio.
 * - Persona mayor: pocas acciones grandes y la opción de ver el tablero
 *   completo cuando lo necesite.
 * - El resto: el tablero de siempre (`children`).
 *
 * Solo enruta a vistas que ya existen (`juegos`, `valle3d`, `agente`,
 * `aprende`, `hoy_finca`, `bitacora`).
 */
import { useState } from 'react';
import { BookOpen, Gamepad2, LayoutGrid, MessageCircle, Mountain, Sun } from 'lucide-react';
import useSecurityRole from '../../hooks/useSecurityRole.js';
import { interfazParaRol } from '../../config/interfazPorRol.js';

const ACCIONES_NINA = [
  { view: 'juegos', label: 'La sala de juegos', desc: 'Juegue y aprenda de la finca.', Icon: Gamepad2, principal: true },
  { view: 'valle3d', label: 'El Valle 3D', desc: 'Camine por el valle y sus mundos.', Icon: Mountain, principal: true },
  { view: 'agente', label: 'Preguntarle a Angelita', desc: 'Pregunte lo que quiera saber.', Icon: MessageCircle },
  { view: 'aprende', label: 'Aprender', desc: 'Lecciones cortas y cuentos.', Icon: BookOpen },
];

const ACCIONES_MAYOR = [
  { view: 'agente', label: 'Hablar con Angelita', desc: 'Pregunte o cuente qué hizo hoy.', Icon: MessageCircle, principal: true },
  { view: 'hoy_finca', label: 'Hoy en la finca', desc: 'El tiempo y lo pendiente del día.', Icon: Sun, principal: true },
  { view: 'bitacora', label: 'La bitácora', desc: 'Lo que se ha anotado en la finca.', Icon: BookOpen, principal: true },
];

const TITULOS = {
  nina: { titulo: '¿A qué quiere jugar hoy?', sub: 'Escoja por dónde empezar.' },
  mayor: { titulo: '¿Qué quiere hacer hoy?', sub: 'Escoja una opción.' },
};

function InicioSencillo({ tipo, acciones, onNavigate, extra = null }) {
  const { titulo, sub } = TITULOS[tipo];
  return (
    <main className="min-h-[100dvh] bg-slate-950 px-4 pb-10 pt-8 text-white" data-testid={`inicio-${tipo}`}>
      <h1 className="text-2xl font-black leading-tight">{titulo}</h1>
      <p className="mt-1 text-base text-slate-300">{sub}</p>
      <nav aria-label={titulo} className="mt-6 grid gap-3">
        {acciones.map((accion) => {
          const { view, label, desc, principal } = accion;
          const Icon = accion.Icon;
          return (
            <button
              key={view}
              type="button"
              onClick={() => onNavigate?.(view)}
              data-testid={`inicio-${tipo}-${view}`}
              className={`flex min-h-[72px] items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                principal
                  ? 'border-emerald-500/60 bg-emerald-900/30 hover:bg-emerald-900/50'
                  : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'
              }`}
            >
              <Icon size={32} aria-hidden="true" className="shrink-0 text-emerald-300" />
              <span className="min-w-0">
                <span className="block text-lg font-bold">{label}</span>
                <span className="block text-sm text-slate-300">{desc}</span>
              </span>
            </button>
          );
        })}
      </nav>
      {extra}
    </main>
  );
}

export default function InicioPorRol({ onNavigate, children }) {
  const { role } = useSecurityRole();
  const [tableroCompleto, setTableroCompleto] = useState(false);
  const { inicio } = interfazParaRol(role);

  if (inicio === 'nina') {
    return <InicioSencillo tipo="nina" acciones={ACCIONES_NINA} onNavigate={onNavigate} />;
  }
  if (inicio === 'mayor' && !tableroCompleto) {
    return (
      <InicioSencillo
        tipo="mayor"
        acciones={ACCIONES_MAYOR}
        onNavigate={onNavigate}
        extra={(
          <button
            type="button"
            onClick={() => setTableroCompleto(true)}
            data-testid="inicio-mayor-tablero"
            className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-xl px-3 text-base font-semibold text-emerald-300 hover:text-emerald-200"
          >
            <LayoutGrid size={20} aria-hidden="true" />
            Ver el tablero completo
          </button>
        )}
      />
    );
  }
  return children;
}
