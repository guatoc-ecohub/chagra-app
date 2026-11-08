/* eslint-disable chagra-i18n/no-hardcoded-spanish */
/**
 * llmTools.js — Tool registry para function calling.
 *
 * NOTA i18n: los `description` de las tools y los mensajes de error
 * del corpus son texto de razonamiento que consume el LLM (no UI visible al
 * usuario), por eso viven en español aquí y no en src/config/messages.js.
 *
 * Implementa el patrón de registry paralelo a moduleRegistry.js.
 * Herramientas mínimas para el corpus de ciclos + tool use básico.
 *
 * Pre-requisito: un modelo que soporte function calling.
 * Algunos modelos locales NO soportan function calling.
 */

import useAssetStore from '../store/useAssetStore';
import { persistComplexIngest, confirmComplexIngestAgainstFarmOS } from './agentComplexIngest';
import { farmosTimestamp } from './farmosLogContract';

/**
 * @typedef {Object} ToolDefinition
 * @property {string} name - nombre de la tool (e.g., "agendar_riego")
 * @property {string} description - descripción en lenguaje natural para el LLM
 * @property {Object} parameters - JSON Schema de inputs
 * @property {Function} handler - función async que ejecuta la tool
 * @property {boolean} requiresGate - true para acciones write, false para read-only
 */

/**
 * @type {Object.<string, ToolDefinition>}
 */
const tools = {};

/**
 * Registrar una nueva tool en el registry.
 * @param {ToolDefinition} tool
 */
export function registerTool(tool) {
  if (!tool.name || !tool.handler) {
    throw new Error('Tool must have name and handler');
  }
  tools[tool.name] = tool;
}

/**
 * Obtener una tool por nombre.
 * @param {string} name
 * @returns {ToolDefinition|null}
 */
export function getTool(name) {
  return tools[name] || null;
}

/**
 * Listar todas las tools registradas.
 * @returns {Array<{name: string, description: string, requiresGate: boolean}>}
 */
export function listTools() {
  return Object.values(tools).map((t) => ({
    name: t.name,
    description: t.description,
    requiresGate: t.requiresGate,
  }));
}

/**
 * Obtener tools en formato OpenAI function calling (para LLM).
 * @returns {Array}
 */
export function getToolsForLLM() {
  return Object.values(tools).map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: t.parameters?.properties || {},
        required: t.parameters?.required || [],
      },
    },
  }));
}

// =============================================================================
// Herramientas implementadas
// =============================================================================

/**
 * Tool: crear_log
 * Crear un nuevo registro/log en Chagra para un asset.
 */
registerTool({
  name: 'crear_log',
  description: 'Crear un nuevo registro/log en Chagra para un activo (planta, estructura, etc.)',
  parameters: {
    type: 'object',
    properties: {
      asset_id: {
        type: 'string',
        description: 'ID del activo (asset) al que associate el log',
      },
      location_asset_id: {
        type: 'string',
        description: 'ID del lote confirmado para la cosecha',
      },
      crop_name: {
        type: 'string',
        description: 'Nombre del cultivo cosechado',
      },
      log_type: {
        type: 'string',
        enum: ['log--observation', 'log--harvest', 'log--task', 'log--input', 'log--split'],
        description: 'Tipo de log a crear',
      },
      notes: {
        type: 'string',
        description: 'Notas o descripción del log (opcional)',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'Fecha y hora del log (ISO 8601). Si no se especifica, usa ahora.',
      },
      quantity: {
        type: 'number',
        description: 'Cantidad harvested/aplicada (para log_type=harvest/input)',
      },
      unit: {
        type: 'string',
        description: 'Unidad de la cantidad (kg, g, lb, unidades, ml, L)',
      },
    },
    required: ['asset_id', 'log_type'],
  },
  handler: async (params) => {
    try {
      const { asset_id, location_asset_id, crop_name, log_type, notes, timestamp, quantity, unit } = params;
      const store = useAssetStore.getState();
      const relationships = {};
      if (asset_id) relationships.asset = { data: { type: 'asset', id: asset_id } };
      if (location_asset_id) relationships.location = { data: [{ type: 'asset--land', id: location_asset_id }] };
      const logData = {
        type: log_type,
        attributes: {
          ...(log_type === 'log--harvest' ? { name: `Cosecha de ${crop_name || 'cultivo sin identificar'}` } : {}),
          notes: notes || '',
          timestamp: timestamp ? (farmosTimestamp(timestamp) ?? timestamp) : farmosTimestamp(new Date()),
          ...(quantity && unit && { quantity: { value: quantity, unit } }),
        },
        relationships,
      };

      if (typeof store.addLog === 'function') {
        await store.addLog(asset_id || null, logData);
      }
      
      return { success: true, message: `Log ${log_type} creado para asset ${asset_id}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  requiresGate: true,
});

const fechaObservacion = (value, nombre) => {
  if (!value || !Number.isFinite(Date.parse(value))) throw new Error(`${nombre} debe ser una fecha ISO válida`);
  return farmosTimestamp(value);
};

const registrarHecho = async ({ asset_id, timestamp, metadata, notes = '' }, nombre) => {
  const store = useAssetStore.getState();
  if (typeof store.addLog !== 'function') throw new Error('El registro local de logs no está disponible');
  const result = await store.addLog(asset_id, {
    type: 'log--observation',
    attributes: {
      name: nombre,
      notes,
      timestamp,
      metadata: { ...metadata, confirmed: true },
    },
    relationships: { asset: { data: { type: 'asset--plant', id: asset_id } } },
  });
  return { success: result.success !== false, message: `${nombre} registrado`, data: result.data };
};

registerTool({
  name: 'registrar_floracion',
  description: 'Registrar que una planta floreció, con fecha confirmada',
  parameters: {
    type: 'object',
    properties: {
      asset_id: { type: 'string', description: 'ID de la planta' },
      timestamp: { type: 'string', format: 'date-time', description: 'Fecha ISO en que se verificó la floración' },
      notes: { type: 'string', description: 'Nota opcional' },
    },
    required: ['asset_id', 'timestamp'],
  },
  handler: async ({ asset_id, timestamp, notes }) => registrarHecho({
    asset_id,
    timestamp: fechaObservacion(timestamp, 'timestamp'),
    notes,
    metadata: { event_type: 'floracion', florecio: true },
  }, 'Floración'),
  requiresGate: true,
});

registerTool({
  name: 'registrar_visita_flor',
  description: 'Registrar que se vio un polinizador en una flor, con fecha confirmada',
  parameters: {
    type: 'object',
    properties: {
      asset_id: { type: 'string', description: 'ID de la planta o cultivo' },
      flor: { type: 'string', description: 'Flor observada' },
      polinizador: { type: 'string', description: 'Polinizador observado' },
      timestamp: { type: 'string', format: 'date-time', description: 'Fecha ISO de la observación' },
    },
    required: ['asset_id', 'flor', 'polinizador', 'timestamp'],
  },
  handler: async ({ asset_id, flor, polinizador, timestamp }) => registrarHecho({
    asset_id,
    timestamp: fechaObservacion(timestamp, 'timestamp'),
    metadata: { event_type: 'visita_flor', flor, polinizador },
  }, 'Visita a flor'),
  requiresGate: true,
});

registerTool({
  name: 'registrar_manejo_plagas',
  description: 'Registrar manejo de plagas indicando método y proximidad explícitos',
  parameters: {
    type: 'object',
    properties: {
      asset_id: { type: 'string', description: 'ID de la planta o lote' },
      metodo: { type: 'string', enum: ['fumigacion', 'biopreparado', 'manual', 'trampa'], description: 'Método usado' },
      proximidad: { type: 'string', enum: ['cerca', 'lejos'], description: 'Proximidad respecto a la floración observada' },
      timestamp: { type: 'string', format: 'date-time', description: 'Fecha ISO del manejo' },
      notes: { type: 'string', description: 'Nota opcional' },
    },
    required: ['asset_id', 'metodo', 'proximidad', 'timestamp'],
  },
  handler: async ({ asset_id, metodo, proximidad, timestamp, notes }) => registrarHecho({
    asset_id,
    timestamp: fechaObservacion(timestamp, 'timestamp'),
    notes,
    metadata: { event_type: 'manejo_plagas', metodo, proximidad },
  }, 'Manejo de plagas'),
  requiresGate: true,
});

/**
 * Tool: actualizar_planta
 * Actualizar información de una planta/asset.
 */
registerTool({
  name: 'actualizar_planta',
  description: 'Actualizar información de una planta o activo en Chagra',
  parameters: {
    type: 'object',
    properties: {
      asset_id: {
        type: 'string',
        description: 'ID del activo a actualizar',
      },
      name: {
        type: 'string',
        description: 'Nuevo nombre para el activo (opcional)',
      },
      notes: {
        type: 'string',
        description: 'Nuevas notas (opcional)',
      },
      status: {
        type: 'string',
        enum: ['active', 'archived', 'falling'],
        description: 'Nuevo estado del activo',
      },
    },
    required: ['asset_id'],
  },
  handler: async (params) => {
    try {
      const { asset_id, name, notes, status } = params;
      const store = useAssetStore.getState();
      
      const updates = {};
      if (name) updates.name = name;
      if (notes) updates.notes = notes;
      if (status) updates.status = status;

      if (typeof store.updateAsset === 'function') {
        await store.updateAsset(asset_id, updates);
      }
      
      return { success: true, message: `Asset ${asset_id} actualizado` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  requiresGate: true,
});

/**
 * Tool: agendar_riego
 * Programar riego para un cultivo.
 */
registerTool({
  name: 'agendar_riego',
  description:
    'Crea una TAREA de riego programada (entrada en calendario) SOLO cuando el usuario lo pide EXPLÍCITAMENTE con verbos de agendar: "agéndame el riego", "prográmame riego", "recuérdame regar", "crea una tarea de riego". NO usar para diagnóstico ni manejo de problemas: si el usuario describe una enfermedad o plaga (gota, tizón, roya, mildiu, manchas, "se está muriendo") o pide un "plan", "qué hago" o "cómo resuelvo", NO es esta herramienta — responde con el manejo agroecológico en texto, sin agendar nada.',
  parameters: {
    type: 'object',
    properties: {
      asset_id: {
        type: 'string',
        description: 'ID del activo (cultivo) para programar riego',
      },
      scheduled_time: {
        type: 'string',
        format: 'date-time',
        description: 'Fecha y hora programada para el riego (ISO 8601)',
      },
      duration_minutes: {
        type: 'number',
        description: 'Duración del riego en minutos',
      },
      method: {
        type: 'string',
        enum: ['goteo', 'aspersion', 'manual', 'inundacion'],
        description: 'Método de riego a usar',
      },
      notes: {
        type: 'string',
        description: 'Notas adicionales sobre el riego',
      },
    },
    required: ['asset_id', 'scheduled_time'],
  },
  handler: async (params) => {
    try {
      const { asset_id, scheduled_time, duration_minutes, method, notes } = params;
      const store = useAssetStore.getState();
      
      const logData = {
        type: 'log--task',
        attributes: {
          notes: `Riego programado${method ? ` (${method})` : ''}${duration_minutes ? ` - ${duration_minutes} min` : ''}${notes ? `. ${notes}` : ''}`,
          timestamp: scheduled_time,
          status: 'pending',
        },
        relationships: {
          asset: { data: { type: 'asset', id: asset_id } },
        },
      };

      if (typeof store.addLog === 'function') {
        await store.addLog(asset_id, logData);
      }
      
      return { 
        success: true, 
        message: `Riego programado para ${new Date(scheduled_time).toLocaleString('es-CO')}` 
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  requiresGate: true,
});

/**
 * Tool: query_corpus_dr034
 * Buscar información en el corpus de ciclos de especies.
 */
registerTool({
  name: 'query_corpus_dr034',
  description: 'Buscar información en el corpus DR-034 de ciclo de especies agroecológicas',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Pregunta o búsqueda en lenguaje natural',
      },
      species: {
        type: 'string',
        enum: ['lechuga', 'fresa', 'tomate', 'tomate_chonto', 'cafe', 'aguacate', 'aguacate_hass'],
        description: 'Filtrar por especie específica (opcional)',
      },
    },
    required: ['query'],
  },
  handler: async (params) => {
    try {
      const { query, species } = params;
      
      const speciesMap = {
        'lechuga': 'lechuga',
        'fresa': 'fresa', 
        'tomate': 'tomate_chonto',
        'tomate_chonto': 'tomate_chonto',
        'cafe': null,
        'aguacate': null,
        'aguacate_hass': null,
      };
      
      const fileName = species ? speciesMap[species] : null;
      
      if (!fileName) {
        return { 
          success: false, 
          error: `No hay corpus disponible para ${species || 'ninguna especie'}. Disponibles: lechuga, fresa, tomate` 
        };
      }
      
      const response = await fetch(`${import.meta.env.BASE_URL}cycle-content/${fileName}.json`);
      if (!response.ok) {
        return { 
          success: false, 
          error: `No se pudo cargar el corpus de ${species}` 
        };
      }
      
      const corpusData = await response.json();
      const queryLower = query.toLowerCase();
      const results = [];
      
      const searchInObject = (obj, path = '') => {
        if (typeof obj === 'string') {
          if (obj.toLowerCase().includes(queryLower)) {
            results.push({ path, content: obj.slice(0, 500) });
          }
        } else if (Array.isArray(obj)) {
          obj.forEach((item, i) => searchInObject(item, `${path}[${i}]`));
        } else if (typeof obj === 'object' && obj !== null) {
          Object.entries(obj).forEach(([key, value]) => 
            searchInObject(value, path ? `${path}.${key}` : key)
          );
        }
      };
      
      searchInObject(corpusData);
      
      if (results.length === 0) {
        return { 
          success: true, 
          message: `No se encontró información específica para "${query}" en el corpus de ${species}`,
          results: [],
        };
      }
      
      return {
        success: true,
        species,
        query,
        results: results.slice(0, 10),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  requiresGate: false,
});

/**
 * Tool interna para la ingesta determinista multi-entidad. El plan solo llega
 * desde AgentScreen después de pasar por el parser local. Mantiene un único
 * gate humano para que la aprobación cubra el conjunto completo y delega la
 * escritura en los servicios offline-first de FarmProcess.
 */
registerTool({
  name: 'registrar_ingesta_compleja',
  description: 'Revisar y registrar una siembra histórica con sus cosechas, abonos y observaciones detectadas',
  parameters: {
    type: 'object',
    properties: {
      plan: {
        type: 'object',
        description: 'Plan determinista de operaciones extraído del mensaje del operador',
      },
    },
    required: ['plan'],
  },
  handler: async ({ plan }) => {
    const persisted = await persistComplexIngest(plan);
    // D-11: no basta con que la escritura LOCAL (IndexedDB) haya salido bien —
    // el resumen que el agente le dice al operador solo puede afirmar lo que
    // farmOS de verdad aceptó. confirmComplexIngestAgainstFarmOS intenta el
    // sync real y reclasifica cualquier operación que farmOS haya rechazado.
    const result = await confirmComplexIngestAgainstFarmOS(persisted);
    return {
      success: result.status === 'executed',
      message: result.status === 'executed'
        ? 'Ingesta persistida localmente y encolada para sincronización'
        : 'La ingesta quedó incompleta y no se debe presentar como totalmente registrada',
      summary: result,
    };
  },
  requiresGate: true,
});

export default {
  registerTool,
  getTool,
  listTools,
  getToolsForLLM,
};
