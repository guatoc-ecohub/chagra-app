/**
 * roleCatalog.js - Catalogo de roles y permisos de seguridad.
 *
 * Fuente de verdad para la federacion de usuarios en Fase 1 client-side.
 * Los permisos son atomicos y se expresan como verbo:recurso[:scope].
 */

const PERMISO_LIST = [
  'asset:read',
  'asset:create',
  'asset:update:own',
  'asset:update:any',
  'asset:delete:own',
  'asset:delete:any',
  'log:create',
  'log:read:own',
  'log:read:any',
  'log:update:own',
  'log:update:any',
  'log:delete:own',
  'log:delete:any',
  'user:manage',
  'license:manage',
  'finca:settings',
  'ucan:delegate',
];

export const PERMISOS = Object.freeze(PERMISO_LIST.slice());

export const ROLE_IDS = Object.freeze([
  'dueno',
  'esposa',
  'trabajador',
  'nina',
  'mayor',
  'asesor',
]);

function freezePermissions(list) {
  return Object.freeze(list.slice());
}

const ALL_PERMISOS = freezePermissions(PERMISOS);

export const ROLE_DEFAULTS = Object.freeze({
  dueno: ALL_PERMISOS,
  esposa: freezePermissions([
    'asset:read',
    'asset:create',
    'asset:update:own',
    'asset:update:any',
    'asset:delete:own',
    'asset:delete:any',
    'log:create',
    'log:read:own',
    'log:read:any',
    'log:update:own',
    'log:update:any',
    'log:delete:own',
    'log:delete:any',
    'user:manage',
    'finca:settings',
  ]),
  trabajador: freezePermissions([
    'asset:read',
    'asset:create',
    'asset:update:own',
    'asset:delete:own',
    'log:create',
    'log:read:own',
    'log:read:any',
    'log:update:own',
    'log:delete:own',
  ]),
  nina: freezePermissions([
    'asset:read',
    'log:read:own',
    'log:read:any',
  ]),
  // Persona mayor (C16): perfil básico. Ve la finca, anota y corrige lo
  // suyo; no borra nada ni gestiona usuarios. La interfaz sencilla (letra
  // grande, inicio corto) la decide config/interfazPorRol.js.
  mayor: freezePermissions([
    'asset:read',
    'log:create',
    'log:read:own',
    'log:read:any',
    'log:update:own',
  ]),
  asesor: freezePermissions([
    'asset:read',
    'log:create',
    'log:read:own',
    'log:read:any',
  ]),
});

export const ROLE_CEILING = Object.freeze({
  dueno: ALL_PERMISOS,
  esposa: freezePermissions([
    'asset:read',
    'asset:create',
    'asset:update:own',
    'asset:update:any',
    'asset:delete:own',
    'asset:delete:any',
    'log:create',
    'log:read:own',
    'log:read:any',
    'log:update:own',
    'log:update:any',
    'log:delete:own',
    'log:delete:any',
    'user:manage',
    'finca:settings',
  ]),
  trabajador: freezePermissions([
    'asset:read',
    'asset:create',
    'asset:update:own',
    'asset:delete:own',
    'log:create',
    'log:read:own',
    'log:read:any',
    'log:update:own',
    'log:delete:own',
  ]),
  nina: freezePermissions([
    'asset:read',
    'log:read:own',
    'log:read:any',
  ]),
  // Persona mayor (C16): perfil básico. Ve la finca, anota y corrige lo
  // suyo; no borra nada ni gestiona usuarios. La interfaz sencilla (letra
  // grande, inicio corto) la decide config/interfazPorRol.js.
  mayor: freezePermissions([
    'asset:read',
    'log:create',
    'log:read:own',
    'log:read:any',
    'log:update:own',
  ]),
  asesor: freezePermissions([
    'asset:read',
    'log:create',
    'log:read:own',
    'log:read:any',
  ]),
});

/**
 * Nombre visible de cada rol de seguridad. Es la ÚNICA fuente de etiquetas:
 * gestión de usuarios, selector de perfil activo y cabecera de Perfil leen
 * de aquí, para que una misma cuenta no aparezca con tres nombres distintos.
 */
export const ROLE_LABELS = Object.freeze({
  dueno: 'Dueño/a',
  esposa: 'Esposa/Esposo',
  trabajador: 'Trabajador/a',
  nina: 'Niña o niño',
  mayor: 'Persona mayor',
  asesor: 'Asesor/a externo',
});

/**
 * Roles ordenados de menos a más permisos (por tamaño de ROLE_DEFAULTS).
 * Sirve para elegir el valor por defecto de menor privilegio.
 */
export const ROLE_IDS_BY_PRIVILEGE = Object.freeze(
  ROLE_IDS.slice().sort((a, b) => ROLE_DEFAULTS[a].length - ROLE_DEFAULTS[b].length),
);

/**
 * true si el rol `target` tiene algún permiso que `actual` no tiene: pasar
 * de `actual` a `target` sería subir de privilegio.
 */
export function roleEscalates(actual, target) {
  const base = new Set(ROLE_DEFAULTS[actual] || []);
  return (ROLE_DEFAULTS[target] || []).some((permiso) => !base.has(permiso));
}
