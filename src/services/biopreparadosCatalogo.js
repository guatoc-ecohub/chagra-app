import biopreparados from '../data/biopreparadosCatalogo.json';

// Keep this view independent of SQLite initialization during startup.
export async function getAllBiopreparados() {
  return biopreparados;
}
