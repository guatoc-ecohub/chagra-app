/**
 * Señales de sesión que comparten apiService, tenantContext y SyncManager.
 *
 * Viven aparte de authService para que la cola sepa si la sesión existe sin
 * depender del módulo de login (muchas pruebas lo reemplazan entero).
 */
// Código de error de una petición que no salió porque no hay token.
export const AUTH_MISSING = 'AUTH_MISSING';

// Se emite cada vez que queda guardada la cuenta activa (login o cambio de finca).
export const TENANT_READY_EVENT = 'chagra:tenant-ready';

/**
 * ¿Queda un access token guardado? `false` = la sesión ya no existe;
 * `null` = no se pudo leer el almacenamiento (no se concluye nada).
 *
 * @returns {Promise<boolean|null>}
 */
export async function hasStoredAccessToken() {
  try {
    // Import diferido: tenantContext usa este módulo y no necesita el almacén.
    const { readToken } = await import('./tokenStore');
    return !!(await readToken('farmos_access_token'));
  } catch (_) {
    return null;
  }
}
