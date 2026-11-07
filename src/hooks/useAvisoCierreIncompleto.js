// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Avisa cuando un cierre de sesión no pudo borrar los tokens del aparato.
 * La sesión ya quedó invalidada (authService/tokenStore); esto solo lo muestra.
 */
import { useEffect } from 'react';
import { LOGOUT_INCOMPLETE_EVENT } from '../services/authService';
import { MSG } from '../config/messages';

/**
 * @param {(message: string, isError?: boolean) => void} showToast
 */
export default function useAvisoCierreIncompleto(showToast) {
  useEffect(() => {
    const handler = () => showToast(MSG.auth.cierreSesionIncompleto, true);
    window.addEventListener(LOGOUT_INCOMPLETE_EVENT, handler);
    return () => window.removeEventListener(LOGOUT_INCOMPLETE_EVENT, handler);
  }, [showToast]);
}
