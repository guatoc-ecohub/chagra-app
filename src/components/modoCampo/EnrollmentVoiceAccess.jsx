/**
 * EnrollmentVoiceAccess — acceso al enrolamiento de voz sin habilitar todo
 * el modo campo. El enrolamiento y el detector tienen ciclos de despliegue
 * distintos: el primero es una personalización local, el segundo sigue
 * protegido por VITE_MODO_CAMPO hasta completar su validación de campo.
 */
import React, { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { hasPersonalVoiceMarker } from '../../services/wakeWordService';
import EnrollmentModoCampo from './EnrollmentModoCampo';

export default function EnrollmentVoiceAccess() {
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [personalVoice, setPersonalVoice] = useState(() => hasPersonalVoiceMarker());

  const closeEnrollment = () => {
    setShowEnrollment(false);
    setPersonalVoice(hasPersonalVoiceMarker());
  };

  return (
    <div className="space-y-3 bg-slate-900/40 border border-slate-800 rounded-2xl p-5" data-testid="enrollment-voice-access">
      <div className="flex items-center gap-2 px-1">
        <GraduationCap size={18} className="text-violet-400" aria-hidden="true" />
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Reconocimiento de voz</h3>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed px-1">
        Enséñele a Chagra cómo suena usted. Las muestras se procesan y se guardan en este dispositivo.
      </p>
      <button
        type="button"
        onClick={() => setShowEnrollment(true)}
        data-testid="modo-campo-ensename"
        className="w-full p-3 rounded-xl flex items-center justify-center gap-2 bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 text-violet-400 min-h-[48px]"
      >
        <GraduationCap size={18} />
        {personalVoice ? 'Volver a enseñarle tu voz' : 'Enséñale tu voz'}
      </button>
      {showEnrollment && <EnrollmentModoCampo onClose={closeEnrollment} />}
    </div>
  );
}
