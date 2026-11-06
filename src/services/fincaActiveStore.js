import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getActiveFincaId, getActiveTenantId, setActiveFincaTenant } from './tenantContext.js';

function mergePersistedFincaState(persistedState, currentState) {
    const state = { ...currentState, ...(persistedState || {}) };
    const fincas = Array.isArray(state.fincas) ? state.fincas : [];
    const tenantId = getActiveTenantId();
    const tenantFincaId = tenantId ? getActiveFincaId() : null;
    const ownedFincas = fincas.filter((finca) => finca?.isOwnedFinca);
    const tenantFinca = tenantFincaId
        ? ownedFincas.find((finca) => finca.id === tenantFincaId || finca.slug === tenantFincaId)
        : null;

    if (tenantFinca) {
        return {
            ...state,
            fincas: ownedFincas,
            activeFincaSlug: tenantFinca.slug,
        };
    }

    return {
        ...state,
        fincas: fincas.filter((finca) => !finca?.isOwnedFinca),
        activeFincaSlug: null,
        gpsOverride: false,
    };
}

/**
 * fincaActiveStore
 * ================================================================
 * Gestiona qué finca está "activa" en la sesión del usuario.
 * Persiste en localStorage para mantener el contexto entre recargas.
 *
 * Extendido en 062 (GPS context-aware multi-finca):
 *   - gpsOverride: boolean — true cuando el operador eligió finca manual;
 *     el banner GPS deja de consultar Geolocation hasta que se vuelva auto.
 *   - indoorZone: string|null — última zona indoor (invernadero) recordada
 *     cuando GPS pierde fix (062.7).
 *   - gpsHistoryEnabled: boolean — opt-in para sincronizar GPS history al
 *     server (default false, privacy-first 062.8).
 * ================================================================
 */
const useFincaActiveStore = create(
    persist(
        (set, get) => ({
            activeFincaSlug: null,
            fincas: [], // Cache local de fincas-publicas.json
            gpsOverride: false,
            indoorZone: null,
            gpsHistoryEnabled: false,

            setActiveFinca: (slug) => {
                set({ activeFincaSlug: slug });
                const finca = get().fincas.find((item) => item.slug === slug);
                const username = getActiveTenantId();
                if (finca?.isOwnedFinca && username) setActiveFincaTenant(username, finca.id, finca.members || [username], finca.landId);
            },

            setFincas: (fincas) => set({ fincas }),

            // 062.3: GPS detectó match → cambiar finca activa sin marcar override
            // (operador queda en modo auto-detect, el banner sigue activo).
            setActiveFincaFromGps: (slug) => {
                set({ activeFincaSlug: slug, gpsOverride: false });
                const finca = get().fincas.find((item) => item.slug === slug);
                const username = getActiveTenantId();
                if (finca?.isOwnedFinca && username) setActiveFincaTenant(username, finca.id, finca.members || [username], finca.landId);
            },

            // 062.3: operador eligió manualmente → marcar override para que
            // el banner deje de consultar GPS hasta clearGpsOverride.
            setActiveFincaManual: (slug) => {
                set({ activeFincaSlug: slug, gpsOverride: true });
                const finca = get().fincas.find((item) => item.slug === slug);
                const username = getActiveTenantId();
                if (finca?.isOwnedFinca && username) setActiveFincaTenant(username, finca.id, finca.members || [username], finca.landId);
            },

            // 062.3: volver a modo auto-detect.
            clearGpsOverride: () => set({ gpsOverride: false }),

            // 062.7: registrar/limpiar zona indoor para fallback cuando GPS
            // pierde fix bajo techo invernadero.
            setIndoorZone: (zone) => set({ indoorZone: zone }),

            // 062.8: opt-in privacy para sync GPS history al server.
            setGpsHistoryEnabled: (enabled) => set({ gpsHistoryEnabled: !!enabled }),

            // Resolver el endpoint de FarmOS para la finca activa.
            //
            // Bug 2026-05-18 (operator: 100+ registros stuck pendientes con WiFi):
            // si retorna URL absoluta cross-origin (ej. 'https://farm.example.co'
            // desde 'https://app.example.co'), Cloudflare Access devuelve 302
            // redirect a login → sync falla. Solución: si la URL absoluta del
            // farmos_endpoint comparte hostname o es el "farmos." pair del
            // origin actual de la PWA, usar relative '' → fetch same-origin
            // pasa por Nginx local que inyecta service token CF Access
            // server-side (ver PR #91).
            getActiveEndpoint: () => {
                const state = get();
                const finca = state.fincas.find(f => f.slug === state.activeFincaSlug);
                if (finca?.isOwnedFinca) return finca.farmos_endpoint || '';
                // Sin endpoint en el registro público, se usa el del despliegue
                // (VITE_PUBLIC_FINCA_FARMOS_URL, vacío por omisión = sin sync).
                const candidate = finca?.farmos_endpoint || import.meta.env?.VITE_PUBLIC_FINCA_FARMOS_URL || '';
                if (!candidate) return '';
                if (typeof window !== 'undefined' && window.location?.origin) {
                    try {
                        const candidateUrl = new URL(candidate);
                        const currentHost = window.location.hostname;
                        // dev (2026-08-24): host de dev 'chagra-dev.<apex>' ↔ 'farmos.<apex>'.
                        // El regex /^chagra\./ NO cubría 'chagra-dev.' → dev salía
                        // cross-origin al host farmOS (tras CF Access = 403 =
                        // "Failed to fetch"). Ampliado: si el origen empieza por
                        // 'chagra' y el candidato es 'farmos.' del MISMO apex,
                        // colapsar a same-origin (el proxy nginx inyecta el token).
                        const apexOf = (h) => h.split('.').slice(-2).join('.');
                        const cousinDevHost =
                            currentHost.startsWith('chagra') &&
                            candidateUrl.hostname.startsWith('farmos.') &&
                            apexOf(currentHost) === apexOf(candidateUrl.hostname);
                        const sameOrCousinHost =
                            candidateUrl.hostname === currentHost ||
                            candidateUrl.hostname === currentHost.replace(/^chagra\./, 'farmos.') ||
                            currentHost === candidateUrl.hostname.replace(/^farmos\./, 'chagra.') ||
                            cousinDevHost;
                        if (sameOrCousinHost) return '';
                    } catch (_) { /* candidate no es URL válida, retornarlo como está */ }
                }
                return candidate;
            },

            getActiveFinca: () => {
                const state = get();
                return state.fincas.find(f => f.slug === state.activeFincaSlug) || null;
            }
        }),
        {
            name: 'chagra:active-finca',
            storage: createJSONStorage(() => localStorage),
            merge: mergePersistedFincaState,
        }
    )
);

export { useFincaActiveStore };
export default useFincaActiveStore;
