/* eslint-disable chagra-i18n/no-hardcoded-spanish -- etiqueta de mapa visible al usuario. */
import React from 'react';

const LIMITES = { norte: 13.4, sur: -4.5, oeste: -79.2, este: -66.5 };

function puntoEnMapa(loc) {
  if (!Number.isFinite(loc?.lat) || !Number.isFinite(loc?.lng)) return null;
  const x = 18 + ((loc.lng - LIMITES.oeste) / (LIMITES.este - LIMITES.oeste)) * 164;
  const y = 12 + ((LIMITES.norte - loc.lat) / (LIMITES.norte - LIMITES.sur)) * 176;
  return { x: Math.max(18, Math.min(182, x)), y: Math.max(12, Math.min(188, y)) };
}

export default function MapaColombiaUbicacion({ loc, piso }) {
  const punto = puntoEnMapa(loc);
  return (
    <section className="onba-mapa" aria-label="Ubicación en Colombia" data-testid="onba-mapa">
      <svg viewBox="0 0 200 200" role="img" aria-label="Mapa esquemático de Colombia con su ubicación marcada">
        <path d="M89 8 109 15 119 30 138 36 144 52 161 58 165 75 184 84 177 99 184 111 169 121 167 139 153 148 149 165 136 172 131 189 115 185 105 174 91 178 81 164 69 158 65 143 53 138 52 121 38 113 42 97 31 86 39 71 37 55 53 47 59 31 71 34 77 18Z" className="onba-mapa-tierra" />
        <path d="m58 31 19 9 6 18-13 14 10 17-13 15 10 19-8 20 16 21" className="onba-mapa-rio" />
        {punto && <g transform={`translate(${punto.x} ${punto.y})`} className="onba-mapa-pin"><circle r="9" /><circle r="3" /></g>}
      </svg>
      <div className="onba-mapa-datos">
        <strong>{loc?.departamento || 'Colombia'}</strong>
        <span>{loc?.municipio || 'Seleccione su municipio'}</span>
        <span>{loc?.vereda || 'Vereda por confirmar'}</span>
        <span>{piso?.label ? `Piso ${piso.label.toLowerCase()}` : 'Piso térmico por confirmar'}</span>
      </div>
    </section>
  );
}
