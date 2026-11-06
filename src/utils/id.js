/**
 * id.js — Gestión de identificadores (ADR-019)
 * AGPL-3.0 © Chagra
 */

import { ulid } from 'ulid';

/**
 * Genera un nuevo ULID (Universally Unique Lexicographically Sortable Identifier).
 * Usado para nuevos tipos de logs según ADR-019.
 * @returns {string} 26 caracteres alfanuméricos en mayúsculas.
 */
export function newUlid() {
    return ulid();
}

/**
 * Genera un UUID v4 usando la API más compatible disponible.
 * @returns {string} UUID v4 en formato canónico.
 */
function newUuidV4() {
    const cryptoApi = globalThis.crypto;
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    if (typeof cryptoApi?.getRandomValues !== 'function') {
        throw new Error('No hay una fuente criptográfica disponible para generar un UUID.');
    }

    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Genera un ID apropiado según el bundle.
 * ADR-019 especifica ULID para logs de IA y tareas; 
 * mantiene UUIDv4 para compatibilidad legacy/FarmOS en otros bundles.
 * @param {string} [bundle=''] - Tipo de entidad (ej: 'log--observation', 'log--task')
 * @returns {string} ULID o UUIDv4
 */
export function newId(bundle = '') {
    const ulidBundles = ['log--task', 'log--ai_inference'];
    if (ulidBundles.includes(bundle)) {
        return newUlid();
    }
    return newUuidV4();
}
