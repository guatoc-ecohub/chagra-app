// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Cerrar sesión en un teléfono compartido (C37, 2026-10-31).
 *
 * Además de los tokens (logoutUser), borra lo que de esta cuenta queda en el
 * aparato y otra persona de la familia podría leer al tomar el teléfono: la
 * conversación guardada con Chagra, los borradores del chat y la identidad
 * del operador. NO toca la cola de sincronización: un registro hecho sin
 * señal y todavía sin enviar no se pierde por cerrar sesión.
 */
import { logoutUser } from './authService';
import { clearCurrentOperator } from './operatorIdentityService';
import { clearMemory } from './conversationMemory';

const DRAFT_PREFIX = 'chagra:agent-draft:';

function borrarBorradores() {
  try {
    const claves = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(DRAFT_PREFIX)) claves.push(k);
    }
    claves.forEach((k) => sessionStorage.removeItem(k));
  } catch (_) { /* sin sessionStorage: no hay borradores que borrar */ }
}

/**
 * @param {{ operatorId?: string }} [opts] operador cuya conversación se borra.
 * @returns {Promise<void>} nunca rechaza: cada limpieza es independiente.
 */
export async function cerrarSesionEnEsteTelefono({ operatorId } = {}) {
  await logoutUser();
  borrarBorradores();
  try { clearCurrentOperator(); } catch (_) { /* best effort */ }
  if (operatorId) {
    try { await clearMemory(operatorId); } catch (_) { /* best effort */ }
  }
}
