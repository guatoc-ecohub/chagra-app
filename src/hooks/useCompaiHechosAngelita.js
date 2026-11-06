import { useEffect } from 'react';
import useAngelitaStore from '../store/useAngelitaStore';
import { logCache } from '../db/logCache';
import {
  inquietudPorFumigacion,
  medirFloresVisitadas,
  noticiaColmena,
  senalarFlor,
} from '../compai/nucleo/angelitaUnicos.js';
import { estaOcupado } from '../services/compaiOcupado.js';
import { syncManager } from '../services/syncManager.js';

const AVISO_TAREAS_KEY = 'chagra:angelita:tareas-vistas';
const TREINTA_MINUTOS = 30 * 60 * 1000;

function fechaLocal(ahora = new Date()) {
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
}

/** Decide si el regreso debe mostrar el resumen de tareas, sin mutar estado. */
export function debeMostrarTareasAlVolver({ ocultoDesde, ahoraMs, pendientes, vistoHoy }) {
  return debeConsultarTareasAlVolver({ ocultoDesde, ahoraMs, vistoHoy })
    && Number.isFinite(pendientes)
    && pendientes > 0;
}

export function debeConsultarTareasAlVolver({ ocultoDesde, ahoraMs, vistoHoy }) {
  return Number.isFinite(ocultoDesde)
    && ahoraMs - ocultoDesde >= TREINTA_MINUTOS
    && !vistoHoy;
}

function confirmado(log) {
  const ai = log?.metadata?.ai || log?.attributes?.metadata?.ai;
  const status = log?.status ?? log?.attributes?.status;
  return !ai?.needs_human_review
    && !['cancelled', 'canceled'].includes(status)
    && !(log?.type === 'log--task' && status === 'pending');
}

function registroDe(log) {
  const metadata = log?.metadata || log?.attributes?.metadata || {};
  return {
    ...log,
    metadata,
    event_type: metadata.event_type,
    florecio: metadata.florecio,
    timestamp: log?.timestamp ?? log?.attributes?.timestamp,
  };
}

function fechaMs(registro) {
  const raw = registro?.timestamp;
  if (Number.isFinite(raw)) return raw > 1e12 ? raw : raw * 1000;
  const parsed = Date.parse(raw || '');
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Resume los hechos confirmados que pueden activar a Angelita.
 * Una lectura incompleta o una fecha inválida devuelve silencio, no ausencia.
 */
export function resumenHechosAngelita(logs, ahoraMs = Date.now()) {
  if (!Array.isArray(logs)) return null;
  const registros = logs.filter(confirmado).map(registroDe);
  const visitas = medirFloresVisitadas({ registros });
  const floraciones = noticiaColmena({
    flores: registros,
    semanaInicioMs: ahoraMs - 7 * 86400000,
    semanaFinMs: ahoraMs,
  });
  const fumigacionCerca = inquietudPorFumigacion({ registros, cerca: true });
  const ultimaVisita = [...registros]
    .filter((r) => r.event_type === 'visita_flor' && Number.isFinite(fechaMs(r)))
    .sort((a, b) => fechaMs(b) - fechaMs(a))[0];
  const visita = ultimaVisita
    ? senalarFlor({ flor: ultimaVisita.metadata.flor, polinizador: ultimaVisita.metadata.polinizador })
    : null;

  if (visita && visitas > 0) {
    return {
      clave: `visita-flor-${ultimaVisita.id || ultimaVisita.timestamp}`,
      lead: `Registró ${visitas} visita${visitas === 1 ? '' : 's'} de ${visita.polinizador} en ${visita.flor}.`,
      prioridad: 55,
    };
  }
  if (fumigacionCerca) {
    return {
      clave: 'fumigacion-cerca-confirmada',
      lead: 'Registró una fumigación cerca de una floración. Conviene revisar el lote y los polinizadores.',
      prioridad: 70,
    };
  }
  if (floraciones.length > 0) {
    return {
      // El id viene del spread del log real; el typedef RegistroAngelita
      // (angelitaUnicos.js) no lo declara, por eso el acceso indexado.
      clave: `floracion-${floraciones[floraciones.length - 1]['id'] || floraciones.length}`,
      lead: `Hay ${floraciones.length === 1 ? 'una floración registrada' : `${floraciones.length} floraciones registradas`} esta semana.`,
      prioridad: 45,
    };
  }
  return null;
}

/** Conecta los logs confirmados con la salida observable del store de Angelita. */
export function useCompaiHechosAngelita({ activo = true } = {}) {
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    let revision = 0;
    const revisar = async () => {
      const actual = ++revision;
      try {
        const logs = await logCache.getAll();
        if (!vivo || actual !== revision) return;
        const hecho = resumenHechosAngelita(logs);
        if (!hecho || useAngelitaStore.getState().estado !== 'calma') return;
        useAngelitaStore.getState().evaluar({
          notificaciones: {
            hay: true,
            severidad: hecho.prioridad >= 70 ? 'media' : 'baja',
            lead: hecho.lead,
            prioridad: hecho.prioridad,
            prompt: null,
          },
          ocupado: estaOcupado(),
        });
      } catch {
        // No leer no demuestra que no haya fauna ni floración.
      }
    };
    revisar();
    const eventos = ['farmosLog', 'syncCompleted', 'puertaLogSaved'];
    eventos.forEach((evento) => window.addEventListener(evento, revisar));
    return () => {
      vivo = false;
      revision += 1;
      eventos.forEach((evento) => window.removeEventListener(evento, revisar));
    };
  }, [activo]);
}

/** Al volver tras una ausencia larga, Angelita resume pendientes una vez al día. */
export function useAngelitaTareasAlVolver({ activo = true } = {}) {
  useEffect(() => {
    if (!activo) return undefined;
    let ocultoDesde = null;
    let vivo = true;

    const alCambiarVisibilidad = async () => {
      if (document.visibilityState === 'hidden') {
        ocultoDesde = Date.now();
        return;
      }
      if (document.visibilityState !== 'visible') return;
      const regreso = ocultoDesde;
      ocultoDesde = null;
      let vistoHoy = false;
      try { vistoHoy = localStorage.getItem(AVISO_TAREAS_KEY) === fechaLocal(); } catch { /* continuar sin dedup persistente */ }
      if (!debeConsultarTareasAlVolver({ ocultoDesde: regreso, ahoraMs: Date.now(), vistoHoy })) return;

      try {
        const tareas = await syncManager.getPendingTasks();
        if (!vivo || !Array.isArray(tareas) || !debeMostrarTareasAlVolver({
          ocultoDesde: regreso,
          ahoraMs: Date.now(),
          pendientes: tareas.length,
          vistoHoy,
        })) return;
        const store = useAngelitaStore.getState();
        if (store.estado !== 'calma' || estaOcupado()) return;
        store.evaluar({
          notificaciones: {
            hay: true,
            severidad: 'baja',
            lead: `Tiene ${tareas.length} tarea${tareas.length === 1 ? '' : 's'} pendiente${tareas.length === 1 ? '' : 's'} en su finca.`,
            prioridad: 45,
            prompt: null,
          },
          ocupado: false,
        });
        try { localStorage.setItem(AVISO_TAREAS_KEY, fechaLocal()); } catch { /* aviso de esta sesión ya ocurrió */ }
      } catch {
        // Una lectura fallida no demuestra que no haya tareas.
      }
    };

    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [activo]);
}

export default useCompaiHechosAngelita;
