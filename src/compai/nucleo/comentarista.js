/**
 * comentarista — LOS 8 COMENTARISTAS DE MUNDO. Núcleo portable.
 *
 * Extraído de `services/angelitaInteligencia.js` (donde vivía) al núcleo, sin
 * cambiarle una coma al texto: es LA fuente única de qué dice el compAI al
 * husmear un mundo, y ahora la comparten la PWA y el valle de `3d.guatoc.co`.
 * `angelitaInteligencia.js` re-exporta desde aquí — no copia. Ver MANIFIESTO.md.
 *
 * LA REGLA DE LA CASA: cada comentarista sabe hablar CON los datos que tenga y
 * sabe CALLAR HONESTO cuando no los tiene. Ningún builder inventa una cifra —
 * un precio o una dosis inventada le cuesta plata real a un campesino.
 *
 * Los datos se los construye `datosFinca.js` (mismo núcleo).
 *
 * @module compai/nucleo/comentarista
 */

import { MSG } from '../../config/messages.js';

/** Los mundos que este módulo sabe comentar. */
export const MUNDOS_COMENTABLES = /** @type {const} */ ([
  'mis_matas', 'mis_animales', 'clima', 'vender',
  'aprender', 'bosque', 'paramo', 'finca',
]);

/** Un dato "real" de inventario: array no vacío de { name, count>0 }. */
function inventarioReal(lista) {
  return Array.isArray(lista) && lista.some((x) => x && x.name && Number(x.count) > 0);
}

/** El ítem de inventario más numeroso (para aterrizar el comentario). */
function masNumeroso(lista) {
  if (!inventarioReal(lista)) return null;
  return [...lista]
    .filter((x) => x && x.name && Number(x.count) > 0)
    .sort((a, b) => Number(b.count) - Number(a.count))[0];
}

/** Limpia el "#03" del nombre y lo deja en minúscula amable. */
function nombreLimpio(name) {
  return String(name || '').replace(/\s*#\d+\s*$/, '').trim().toLowerCase();
}

/* Cada mundo sabe comentar CON los datos que tenga, y sabe callar honesto
   cuando no los tiene. `datos` es lo que el shell alcanzó a reunir localmente;
   ningún builder inventa cifras — sólo lee lo que le pasan. */
export const COMENTARISTA_MUNDO = {
  mis_matas(datos = {}, perfil = {}) {
    const top = masNumeroso(datos.cultivos);
    const esTecnico = perfil.vocacion === 'tecnico' || perfil.rol === 'tecnico';
    const esCampesino = perfil.vocacion === 'campesino' || perfil.rol === 'campesino';

    if (top) {
      const n = Number(top.count);
      const nombre = nombreLimpio(top.name);
      // #80/#81: dato agroecológico REAL de esa especie (catálogo Chagra),
      // no un inventario genérico — cuando lo hay, se teje en el mismo
      // comentario; sin match no cambia una coma del texto de siempre.
      const agro = typeof datos.agro === 'string' && datos.agro.trim() ? datos.agro.trim() : null;
      const cola = agro ? ` Y ojo: ${nombre} ${agro}.` : '';

      if (esTecnico) {
        return n > 1
          ? `De sus cultivos, predomina ${nombre} con ${n} unidades registradas. ¿Revisamos su manejo técnico?${cola}`
          : `Tiene ${nombre} registrado. ¿Desea analizar su fenología y manejo?${cola}`;
      }

      if (esCampesino) {
        return n > 1
          ? `De sus matas, la que más tiene es ${nombre} — ${n} registradas. ¿Le hacemos seguimiento?${cola}`
          : `Tiene ${nombre} registrado en su finca. ¿Le echamos un ojo a cómo va?${cola}`;
      }

      // Default (curioso, urbano, etc.)
      return n > 1
        ? `De sus matas, la que más tiene es ${nombre} — ${n} registradas. ¿Le hacemos seguimiento?${cola}`
        : `Tiene ${nombre} registrado en su finca. ¿Le echamos un ojo a cómo va?${cola}`;
    }

    if (esTecnico) {
      return 'Sin registro de cultivos. Puede comenzar con el inventario técnico para análisis fenológico.';
    }

    return 'Todavía no me ha contado qué tiene sembrado. Cuando registre sus matas, le sigo el rastro a cada una.';
  },

  mis_animales(datos = {}, perfil = {}) {
    const top = masNumeroso(datos.especies);
    const total = Number(datos.total);
    const esTecnico = perfil.vocacion === 'tecnico' || perfil.rol === 'tecnico';

    if (top) {
      const nombre = nombreLimpio(top.name);
      if (esTecnico) {
        return `Su inventario pecuario está liderado por ${nombre}. ¿Revisamos los parámetros de manejo?`;
      }
      return `De sus animales, lo que más tiene es ${nombre}. ¿Revisamos cómo van?`;
    }

    if (Number.isFinite(total) && total > 0) {
      if (esTecnico) {
        return `Registra ${total} ${total === 1 ? 'especie pecuaria' : 'especies pecuarias'}. ¿Analizamos su manejo?`;
      }
      return `Tiene ${total} ${total === 1 ? 'animal anotado' : 'animales anotados'}. ¿Los repasamos?`;
    }

    if (esTecnico) {
      return 'Módulo de gestión pecuaria. Registre sus animales para análisis de sanidad y producción.';
    }
    return 'Aquí llevamos sus animales. Cuando anote los suyos, le ayudo con la cría, el alimento y la sanidad.';
  },

  clima(datos = {}, perfil = {}) {
    const snap = datos.snapshot;
    const alertas = Array.isArray(snap?.alertas_locales) ? snap.alertas_locales.length : 0;
    const esTecnico = perfil.vocacion === 'tecnico' || perfil.rol === 'tecnico';

    // En la pantalla de clima la explicación debe leer el mismo parte que el
    // panel. No se inventa un pronóstico: si falta una lectura, se omite.
    const piso = datos.pisoTermico?.nombre || datos.pisoTermico?.id || null;
    const dia = snap?.openmeteo?.forecast_7d?.[0] || null;
    const minima = datos.minima ?? snap?.clima?.minimaNocturna_c ?? dia?.temp_min_c ?? dia?.temperature_2m_min ?? null;
    const lluvia = datos.lluvia ?? snap?.clima?.lluviaCantidad_mm ?? dia?.precip_mm ?? dia?.precipitation_sum ?? null;
    const umbral = datos.umbralHelada ?? null;
    const cieloDespejado = datos.cieloDespejado ?? snap?.clima?.condicion === 'despejado';
    const tieneLectura = piso || minima != null || lluvia != null;

    if (tieneLectura) {
      const partes = [];
      if (piso) partes.push(`Está mirando el piso ${String(piso).toLowerCase()}`);
      if (minima != null) {
        const umbralTexto = umbral != null ? `, con umbral operativo de alerta en ${umbral} °C (no es temperatura de daño del cultivo)` : '';
        partes.push(`la mínima del aire que aparece es ${minima} °C${umbralTexto}`);
        partes.push('confirma la fuente, la fecha y la altura de referencia de esa mínima antes de usarla para proteger el cultivo');
      }
      if (cieloDespejado && minima != null) {
        partes.push('el cielo despejado favorece el enfriamiento nocturno; la mínima del aire no determina por sí sola la temperatura de la superficie ni confirma escarcha');
      }
      if (lluvia != null) partes.push(`la lluvia del día marca ${lluvia} mm`);
      const texto = `${partes.join('. ')}.`;
      return esTecnico ? `${texto} Esa lectura orienta la decisión de hoy.` : `${texto} Así se lee el riesgo antes de decidir qué hacer hoy.`;
    }

    if (alertas > 0) {
      if (esTecnico) {
        return `El monitoreo climático registra ${alertas} ${alertas === 1 ? 'alerta crítica' : 'alertas críticas'} para su zona. ¿Desea ver el análisis?`;
      }
      return `El parte del clima trae ${alertas} ${alertas === 1 ? 'aviso' : 'avisos'} para su zona. ¿Se los muestro?`;
    }

    const fase = snap?.enso_status?.phase;
    if (fase && typeof datos.describirFase === 'function') {
      const desc = datos.describirFase(fase);
      if (desc && desc !== 'Estado del clima desconocido') {
        if (esTecnico) {
          return `Fase ENSO actual: ${String(desc).toLowerCase()}. ¿Requiere análisis de tendencias para su zona?`;
        }
        return `Por temporada, ${String(desc).toLowerCase()}. El clima del día en su finca manda; ¿le ayudo a leerlo?`;
      }
    }

    if (esTecnico) {
      return 'Sin datos climáticos disponibles. El monitoreo continuará actualizando.';
    }
    return 'No tengo el parte del clima a la mano ahora. Cuando haya señal se lo traigo — y el cielo de su finca siempre manda.';
  },

  vender(datos = {}, perfil = {}) {
    // NUNCA inventamos precios. Sólo ofrecemos acompañar la venta.
    const top = masNumeroso(datos.cultivos);
    const esTecnico = perfil.vocacion === 'tecnico' || perfil.rol === 'tecnico';

    if (top) {
      const nombre = nombreLimpio(top.name);
      if (esTecnico) {
        return `Para comercializar su ${nombre}, le asisto en análisis de costos y presentación de producto. ¿Iniciamos con el estudio de mercado?`;
      }
      return `Cuando quiera vender, le ayudo a sacar cuentas y a presentar bien su ${nombre}. ¿Empezamos por ahí?`;
    }

    if (esTecnico) {
      return 'Módulo de comercialización. Registre sus productos para análisis de costos y mercado.';
    }
    return 'Cuando tenga algo para vender, le ayudo a sacar cuentas y a presentarlo bien. Sin afán.';
  },

  aprender(_datos = {}, perfil = {}) {
    const esTecnico = perfil.vocacion === 'tecnico' || perfil.rol === 'tecnico';
    if (esTecnico) {
      return '¿Qué aspecto técnico desea profundizar? Cuento con bibliografía agroecológica actualizada.';
    }
    return '¿Qué quiere aprender hoy? Aquí estoy sin afán — pregúnteme sin pena.';
  },

  bosque(_datos = {}, perfil = {}) {
    const esRestaurador = perfil.rol === 'restaurador';
    const esTecnico = perfil.vocacion === 'tecnico' || perfil.rol === 'tecnico';

    if (esRestaurador) {
      return 'La restauración ecológica requiere procesos graduales. ¿Revisamos protocolos de enriquecimiento con nativas?';
    }

    if (esTecnico) {
      return 'Sucesión forestal y restauración ecológica. ¿Desea revisar marcos conceptuales y métodos de intervención?';
    }

    // Verdad general, en pregunta (no es un dato de SU finca).
    return 'El bosque se recupera con paciencia. ¿Le muestro cómo un rastrojo vuelve a ser monte?';
  },

  paramo(_datos = {}, perfil = {}) {
    const esGuia = perfil.rol === 'guia_glaciar';
    const esTecnico = perfil.vocacion === 'tecnico' || perfil.rol === 'tecnico';

    if (esGuia) {
      return 'Los páramos son estratégas hídricas de montaña. ¿Revisamos los servicios ecosistémicos que provienen de este nacimiento?';
    }

    if (esTecnico) {
      return 'Páramo: ecosistema de alta montaña y regulador hídrico. ¿Requiere información sobre su funcionamiento y conservación?';
    }

    // La regulación de cuencas no identifica la captación de una finca.
    return 'El páramo contribuye a regular el agua de muchas cuencas. Para saber de dónde viene la de tu finca necesitamos identificar su fuente y cuenca.';
  },

  finca(datos = {}, perfil = {}) {
    const top = masNumeroso(datos.cultivos);
    const esTecnico = perfil.vocacion === 'tecnico' || perfil.rol === 'tecnico';

    if (top) {
      if (esTecnico) {
        return 'Sede operativa registrada. Seleccione el módulo técnico que desea analizar.';
      }
      return 'Aquí está su finca. Toque el mundo que quiera revisar y yo le acompaño.';
    }

    if (esTecnico) {
      return MSG.comentarista.fincaSinInventarioTecnico;
    }
    return 'Aquí está su finca. Empecemos por registrar lo que tiene sembrado, y yo le sigo el rastro.';
  },
};

/**
 * Comentario de Angelita al entrar/pasar por un mundo. GROUNDED: usa sólo los
 * datos reales que le pasen; si faltan, cae a un acompañamiento honesto (nunca
 * inventa una cifra ni un dato agronómico).
 *
 * @param {string} mundo: uno de MUNDOS.
 * @param {Object} [datos]: datos reales locales del mundo:
 *   - mis_matas / vender / finca: { cultivos: Array<{name,count}> }
 *   - mis_animales: { especies: Array<{name,count}>, total?: number }
 *   - clima: { snapshot, describirFase?: (phase)=>string }
 * @param {Object} [perfil]: perfil del usuario (vocacion, rol) para ramificar copy.
 * @returns {string|null} el comentario en usted, o null si el mundo no existe.
 */
export function comentarioDeMundo(mundo, datos = {}, perfil = {}) {
  const piso = String(datos?.pisoTermico ?? datos?.pisoId ?? '').toLowerCase();
  if (piso === 'superparamo') {
    return 'Parece que está en el superpáramo. Aquí no se siembra: observemos la vida rasante, conservemos el suelo y cuidemos el agua que nace más abajo.';
  }
  if (piso === 'nival') {
    return 'Está en el nival, donde mandan la nieve y la roca. Aquí no se siembra: observemos el retroceso del hielo y el agua que baja de la montaña.';
  }
  const fn = COMENTARISTA_MUNDO[mundo];
  if (!fn) return null;
  return fn(datos, perfil);
}

export default { comentarioDeMundo, COMENTARISTA_MUNDO, MUNDOS_COMENTABLES };
