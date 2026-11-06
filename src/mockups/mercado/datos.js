/*
 * Catálogo real de Milpa, tomado de /es/catalogo/.
 *
 * Este archivo contiene únicamente los campos publicados por el catálogo:
 * nombre, precio, unidad y la foto correspondiente. No agrega productos,
 * precios, procedencias ni historias que la fuente no publica.
 */

export const ALTITUD_MIN = 1400;
export const ALTITUD_MAX = 3200;

export const PRODUCTOS = [
  { id: 'acelga-amarilla', nombre: 'Acelga amarilla', precio: 5000, unidad: 'atado', foto: null },
  { id: 'acelga-blanca', nombre: 'Acelga blanca', precio: 5000, unidad: 'atado', foto: null },
  { id: 'acelga-morada', nombre: 'Acelga morada', precio: 5000, unidad: 'atado', foto: null },
  { id: 'albahaca', nombre: 'Albahaca', precio: 4000, unidad: 'atado', foto: null },
  { id: 'anis', nombre: 'Anís', precio: 4000, unidad: 'atado', foto: null },
  { id: 'apio', nombre: 'Apio', precio: 3500, unidad: 'libra', foto: null },
  { id: 'cebollin', nombre: 'Cebollín', precio: 3000, unidad: 'atado', foto: null },
  { id: 'espinaca', nombre: 'Espinaca', precio: 4500, unidad: 'atado', foto: null },
  { id: 'hinojo', nombre: 'Hinojo', precio: 4000, unidad: 'atado', foto: null },
  { id: 'kale-crespo-morado', nombre: 'Kale crespo morado', precio: 5000, unidad: 'atado', foto: null },
  { id: 'kale-crespo-verde', nombre: 'Kale crespo verde', precio: 5000, unidad: 'atado', foto: null },
  { id: 'kale-toscano', nombre: 'Kale toscano', precio: 5000, unidad: 'atado', foto: null },
  { id: 'lechuga-crespa-morada', nombre: 'Lechuga crespa morada', precio: 3500, unidad: 'unidad', foto: null },
  { id: 'lechuga-crespa-verde', nombre: 'Lechuga crespa verde', precio: 3500, unidad: 'unidad', foto: null },
  { id: 'lechuga-hoja-de-roble-morada', nombre: 'Lechuga hoja de roble morada', precio: 3500, unidad: 'unidad', foto: null },
  { id: 'lechuga-hoja-de-roble-verde', nombre: 'Lechuga hoja de roble verde', precio: 3500, unidad: 'unidad', foto: null },
  { id: 'lechuga-romana-verde', nombre: 'Lechuga romana verde', precio: 3500, unidad: 'unidad', foto: null },
  { id: 'limonaria', nombre: 'Limonaria', precio: 3500, unidad: 'atado', foto: null },
  { id: 'repollo-crespo-verde', nombre: 'Repollo crespo verde', precio: 5000, unidad: 'unidad', foto: null },
  { id: 'salvia', nombre: 'Salvia', precio: 4000, unidad: 'atado', foto: null },
  { id: 'tomate-cherry', nombre: 'Tomate cherry', precio: 8000, unidad: 'libra', foto: null },
  { id: 'tomate-san-marzano', nombre: 'Tomate san marzano', precio: 7000, unidad: 'libra', foto: null },
  { id: 'brocoli', nombre: 'Brócoli', precio: 5000, unidad: 'unidad', foto: null },
  { id: 'calabacin-redondo', nombre: 'Calabacín redondo', precio: 5000, unidad: 'unidad', foto: null },
  { id: 'calabacin-redondo-amarillo', nombre: 'Calabacín redondo amarillo', precio: 5000, unidad: 'unidad', foto: null },
  { id: 'calabacin-redondo-verde', nombre: 'Calabacín redondo verde', precio: 5000, unidad: 'unidad', foto: null },
  { id: 'cebolla-cabezona-roja', nombre: 'Cebolla cabezona roja', precio: 3500, unidad: 'libra', foto: null },
  { id: 'cebolla-larga', nombre: 'Cebolla larga', precio: 3000, unidad: 'atado', foto: null },
  { id: 'cebolla-puerro', nombre: 'Cebolla puerro', precio: 3500, unidad: 'atado', foto: null },
  { id: 'coliflor', nombre: 'Coliflor', precio: 5500, unidad: 'unidad', foto: null },
  { id: 'esparragos', nombre: 'Espárragos', precio: 6000, unidad: 'atado', foto: null },
  { id: 'lechuga-cogollo-morado', nombre: 'Lechuga cogollo morado', precio: 4000, unidad: 'unidad', foto: null },
  { id: 'perejil-crespo', nombre: 'Perejil crespo', precio: 3000, unidad: 'atado', foto: null },
  { id: 'perejil-liso', nombre: 'Perejil liso', precio: 3000, unidad: 'atado', foto: null },
  { id: 'rabano', nombre: 'Rábano', precio: 3500, unidad: 'atado', foto: null },
  { id: 'remolacha', nombre: 'Remolacha', precio: 4500, unidad: 'libra', foto: null },
  { id: 'repollo-liso-morado', nombre: 'Repollo liso morado', precio: 5000, unidad: 'unidad', foto: null },
  { id: 'rucula', nombre: 'Rúcula', precio: 4000, unidad: 'atado', foto: null },
  { id: 'ruda', nombre: 'Ruda', precio: 3000, unidad: 'atado', foto: null },
  { id: 'zucchini-amarillo', nombre: 'Zucchini amarillo', precio: 5000, unidad: 'unidad', foto: null },
  { id: 'zucchini-verde', nombre: 'Zucchini verde', precio: 5000, unidad: 'unidad', foto: null },
];

/* Compatibilidad con la cinta antigua: el catálogo real no publica altitud. */
export function pisoDeAltitud(altitud) {
  if (altitud >= 3000) return { slug: 'paramo', nombre: 'Páramo', hex: '#3f7f9e', rango: 'sobre 3.000 m' };
  if (altitud >= 2000) return { slug: 'frio', nombre: 'Frío', hex: '#5f8f80', rango: '2.000 a 3.000 m' };
  return { slug: 'templado', nombre: 'Templado', hex: '#c1902f', rango: '1.000 a 2.000 m' };
}

export function fincasUnicas(productos = PRODUCTOS) {
  return productos.filter((producto) => producto.finca).reduce((fincas, producto) => {
    if (!fincas.some((finca) => finca.id === producto.finca.nombre)) {
      fincas.push({
        id: producto.finca.nombre,
        productoId: producto.id,
        ...producto.finca,
      });
    }
    return fincas;
  }, []);
}

/* Formatea un precio entero en pesos colombianos: 5000 → "$ 5.000". */
export function pesos(valor) {
  const entero = Math.round(valor);
  const conMiles = String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${conMiles}`;
}
