import { useEffect, useRef, useState } from 'react';
import usePrefsStore from '../../store/usePrefsStore';
import { getFullHistory } from '../../services/conversationMemory';
import { CONVERSACION as C } from './conversacion.copy';

const SIN_TURNOS = [];
const operadorActual = () => usePrefsStore.getState().operatorId || 'default-operator';

// Lectura explícita de la memoria existente. No crea otra copia persistida.
export function useConversacionGuardada() {
  const operatorId = usePrefsStore(s => s.operatorId) || 'default-operator';
  const [resultado, setResultado] = useState(null);
  const solicitud = useRef(0);
  useEffect(() => () => { solicitud.current += 1; }, [operatorId]);

  async function recuperar() {
    const numero = ++solicitud.current;
    setResultado({ operatorId, cargando: true, messages: SIN_TURNOS });
    try {
      const messages = await getFullHistory(operatorId, 100);
      if (numero !== solicitud.current || operadorActual() !== operatorId) return;
      setResultado({ operatorId, cargando: false, messages, aviso: messages.length ? '' : C.sinHistorial });
    } catch {
      if (numero !== solicitud.current || operadorActual() !== operatorId) return;
      setResultado({ operatorId, cargando: false, messages: SIN_TURNOS, aviso: C.errorHistorial });
    }
  }

  const actual = resultado?.operatorId === operatorId ? resultado : null;
  return { messages: actual?.messages || SIN_TURNOS, cargando: actual?.cargando || false, aviso: actual?.aviso || '', recuperar };
}
