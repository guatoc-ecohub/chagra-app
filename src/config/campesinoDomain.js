/**
 * El inicio de jornada pertenece a la vista pública campesina, no al dominio
 * general de Chagra. Se mantiene separado de la flag porque ambos dominios
 * comparten el mismo build.
 */
export function esDominioCampesino(hostname = typeof window !== 'undefined' ? window.location.hostname : '') {
  return hostname === 'campesino.chagra.app';
}
