// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';
import L from 'leaflet';
import { iconUrl, iconRetinaUrl, shadowUrl } from './leafletIconoDefecto.js';

describe('leafletIconoDefecto', () => {
  it('un marcador sin icono propio usa las imágenes empaquetadas, no rutas relativas', () => {
    const icono = new L.Icon.Default();
    const img = icono.createIcon();
    const sombra = icono.createShadow();

    expect(iconUrl).toBeTruthy();
    expect(img.getAttribute('src')).toBe(iconUrl);
    expect(sombra.getAttribute('src')).toBe(shadowUrl);
    expect(L.Icon.Default.prototype.options.iconRetinaUrl).toBe(iconRetinaUrl);
    // El defecto que corrige: sin el módulo, Leaflet pedía «marker-icon.png»
    // relativo a la página y el build lo servía como 404.
    expect(img.getAttribute('src')).not.toBe('marker-icon.png');
  });
});
