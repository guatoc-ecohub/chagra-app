/** Contrato de datos cerrado, sin componentes ni arte. */
export const LAMINAS_CATALOGO = {
  siembra: {
    nombre: 'Formas de siembra',
    dim: '2d',
    lock: 'parametrica',
    aplica_a: 'propagacion-vegetativa', // tubérculos/esquejes/colinos
    props: { activo: ['tuberculo', 'esqueje', 'colino'] },
    accesible: 'decorativa',
  },
  aporque: {
    nombre: 'El aporque (en corte)',
    dim: '2d',
    lock: 'parametrica',
    aplica_a: 'tuberculos-y-raices',
    props: {},
    accesible: 'decorativa',
  },
  maiz: {
    nombre: 'La mata de maíz',
    dim: '2d',
    lock: 'especie',
    aplica_a: 'Zea mays',
    props: {},
    accesible: 'enseña',
  },
  cafeto: {
    nombre: 'El cafeto',
    dim: '2d',
    lock: 'especie',
    aplica_a: 'Coffea arabica',
    props: {},
    accesible: 'enseña',
  },
  'mata-etapa': {
    nombre: 'La mata por etapa (viva)',
    dim: '2d',
    lock: 'especie',
    aplica_a: 'Solanum lycopersicum',
    props: { etapa: ['semilla', 'plantula', 'juvenil', 'adulto', 'floracion', 'cosecha'] },
    accesible: 'decorativa',
  },
  milpa: {
    nombre: 'La milpa (las tres hermanas)',
    dim: '2d',
    lock: 'proposicion',
    aplica_a: 'milpa: Zea mays + Phaseolus vulgaris + Cucurbita',
    props: {},
    accesible: 'enseña',
  },
  rotacion: {
    nombre: 'La rotación por eras',
    dim: '2d',
    lock: 'proposicion',
    aplica_a: 'rotacion: hoja → fruto → raíz → leguminosa',
    props: {},
    accesible: 'enseña',
  },
  'piso-termico': {
    nombre: 'El piso térmico (en corte)',
    dim: '2d',
    lock: 'proposicion',
    aplica_a: 'piso-termico: gradiente cálido → páramo',
    props: {},
    accesible: 'enseña',
  },
};

