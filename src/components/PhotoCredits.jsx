// SPDX-License-Identifier: AGPL-3.0-only
import catalogPhotos from '../../catalog/fotos/fotos-atribucion.json';
import pestPhotos from '../../catalog/fotos/plagas-atribucion.json';

const photos = [
  ...catalogPhotos.map(photo => ({
    file: photo.archivo,
    title: photo.titulo,
    author: photo.autor,
    license: photo.licencia,
    licenseUrl: photo.licencia_url,
    sourceUrl: photo.url_fuente,
    changes: 'Redimensionada y convertida a WebP.',
  })),
  ...pestPhotos.photos.map(photo => ({
    file: photo.file,
    title: photo.title || photo.binomio,
    author: photo.creator,
    license: photo.license,
    licenseUrl: photo.licenseUrl,
    sourceUrl: photo.sourceUrl,
    changes: 'Copia adaptada para la app (tamaño o formato).',
  })),
];

/** Credits also cover the redistributable photos not selected for a card. */
export default function PhotoCredits() {
  return (
    <details className="mt-4 text-xs text-slate-300" data-testid="photo-credits">
      <summary className="cursor-pointer font-semibold">Créditos de las fotos</summary>
      <ul className="mt-3 space-y-3 max-h-80 overflow-auto">
        {photos.map(photo => (
          <li key={photo.file} data-photo-file={photo.file}>
            <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {photo.title || photo.file}
            </a>
            <span> · {photo.author} · </span>
            <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {photo.license}
            </a>
            <p className="text-slate-400">{photo.changes}</p>
            <p className="break-all text-slate-400">{photo.file}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
