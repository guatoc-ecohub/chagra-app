import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, CheckCircle, Clock, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { syncManager } from '../services/syncManager';
import HojaHomeA from './esquema/HojaHomeA';
import { AngelitaGuia } from '../visual/agente/AngelitaGuia.jsx';
import { puestoLibreJuntoATarea, tareaDeHoy } from './taskAgendaAngelita.js';
import useAngelitaStore from '../store/useAngelitaStore';
import './registro/registro-home-a.css';
import './taskAgendaAngelita.css';
import { parseDateTimestamp } from '../utils/dateFormatter';

function TaskLogContenido({ onBack, onNewTask }) {
  const [tasks, setTasks] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tareaDestacadaId, setTareaDestacadaId] = useState(null);
  const gestoElegido = useRef(false);
  const tareaDestacadaRef = useRef(null);
  /** @param {{x:number,y:number}|null} posicion @param {object|null} parada */
  const posicionarAngelita = useCallback((posicion, parada) => {
    if (posicion && parada && tareaDestacadaRef.current) {
      const rect = tareaDestacadaRef.current.getBoundingClientRect();
      const ocupado = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (!node.textContent.trim() || !parent || parent.closest('[data-compai-draggable], [hidden]')) continue;
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const caja of range.getClientRects()) {
          if (caja.width && caja.height) ocupado.push(caja);
        }
      }
      for (const node of document.querySelectorAll('button, a, input, select, textarea, [role="button"]')) {
        if (node.closest('[data-compai-draggable], [hidden]')) continue;
        const caja = node.getBoundingClientRect();
        if (caja.width && caja.height) ocupado.push(caja);
      }
      ocupado.push(rect);
      const puesto = puestoLibreJuntoATarea(rect, ocupado);
      if (!puesto) {
        useAngelitaStore.getState().publicarDestinoCompai(null);
        return;
      }
      useAngelitaStore.getState().publicarDestinoCompai({ ...puesto, gesto: parada.gesto || 'senala' });
    }
  }, []);

  const fetchPendingTasks = async () => {
    try {
      const pendingTasks = await syncManager.getPendingTasks();
      setTasks(pendingTasks);
      if (!gestoElegido.current) {
        gestoElegido.current = true;
        setTareaDestacadaId(tareaDeHoy(pendingTasks)?.id || null);
      }
    } catch (error) {
      console.error('Error obteniendo tareas pendientes:', error);
    }
  };

  const toggleTaskStatus = async (taskId) => {
    // Fase 5: completar tarea via useAssetStore.completeTaskLog (inmutable)
    try {
      const useAssetStore = (await import('../store/useAssetStore')).default;
      await useAssetStore.getState().completeTaskLog(taskId);
      // Refrescar lista local
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Error completando tarea:', err);
    }
  };

  const syncTasks = async () => {
    setIsSyncing(true);
    try {
      await syncManager.syncAll();
      await fetchPendingTasks();
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  useEffect(() => () => useAngelitaStore.getState().publicarDestinoCompai(null), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPendingTasks();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="text-amber-400 font-bold text-xs bg-amber-900/30 px-2 py-1 rounded-full">PENDIENTE</span>;
      case 'completed':
        return <span className="text-green-400 font-bold text-xs bg-green-900/30 px-2 py-1 rounded-full">COMPLETADO</span>;
      case 'synced':
        return <span className="text-blue-400 font-bold text-xs bg-blue-900/30 px-2 py-1 rounded-full">SINCRONIZADO</span>;
      default:
        return <span className="text-slate-400 font-bold text-xs bg-slate-900/30 px-2 py-1 rounded-full">DESCONOCIDO</span>;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':
        return <span className="text-red-400 font-bold text-xs bg-red-900/30 px-2 py-1 rounded-full">ALTA</span>;
      case 'medium':
        return <span className="text-amber-400 font-bold text-xs bg-amber-900/30 px-2 py-1 rounded-full">MEDIA</span>;
      case 'low':
        return <span className="text-blue-400 font-bold text-xs bg-blue-900/30 px-2 py-1 rounded-full">BAJA</span>;
      default:
        return null;
    }
  };

  /** @param {{date?: string|number|null,timestamp?: string|number|null,attributes?: {timestamp?: string|number|null}}} task @returns {Date|null} */
  const fechaDeTarea = (task) => {
    const valor = task.date ?? task.timestamp ?? task.attributes?.timestamp;
    return parseDateTimestamp(valor);
  };

  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
      <header className="p-4 sticky top-0 bg-slate-950 border-b border-slate-800 flex items-center justify-between z-10 shrink-0 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={onBack} aria-label="Volver" className="p-3 bg-slate-800 rounded-full active:bg-slate-700 min-h-[56px] min-w-[56px] flex justify-center items-center shrink-0">
            <ArrowLeft size={32} />
          </button>
          {/* eslint-disable-next-line chagra-i18n/no-hardcoded-spanish -- etiqueta existente fuera del cambio de presencia. */}
          <h2 className="text-3xl font-bold">Tareas de la finca</h2>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <div className="flex items-center gap-1 text-green-400">
              <Wifi size={14} />
              <span className="text-sm">Con señal</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-red-400">
              <WifiOff size={14} />
              <span className="text-sm">Sin señal</span>
            </div>
          )}
          <button
            onClick={onNewTask}
            aria-label="Nueva tarea"
            className="p-3 bg-muzo rounded-full active:bg-muzo-glow min-h-[56px] min-w-[56px] flex justify-center items-center shrink-0 border border-slate-700 shadow-neon-muzo"
          >
            <span className="text-3xl font-black text-slate-950" aria-hidden="true">+</span>
          </button>
          <button onClick={syncTasks} disabled={isSyncing} aria-label="Sincronizar tareas" className="p-2 bg-slate-800 rounded-full active:bg-slate-700 min-h-[40px] min-w-[40px] flex justify-center items-center shrink-0 border border-slate-600">
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="flex-1 p-5 flex flex-col gap-6 pb-24">
        {tareaDestacadaId && (
          <AngelitaGuia
            soloPosicion
            tamano={84}
            onPosicionChange={posicionarAngelita}
            demoraInicialMs={0}
            paradas={[{ id: 'tarea-de-hoy', ref: () => tareaDestacadaRef.current, gesto: 'senala', texto: '' }]}
          />
        )}
        <div className="flex justify-between items-center mb-4">
          {/* eslint-disable-next-line chagra-i18n/no-hardcoded-spanish -- etiqueta existente fuera del cambio de presencia. */}
          <h3 className="text-xl font-bold text-slate-300">Tareas Pendientes</h3>
          <span className="text-sm text-slate-500">{tasks.filter(t => t.status !== 'completed').length} pendientes</span>
        </div>

        <div className="space-y-3">
          {tasks.map(task => (
            <div key={task.id} ref={tareaDestacadaId === task.id ? tareaDestacadaRef : undefined} data-task-id={task.id} className={`p-4 rounded-xl border-2 transition-all ${task.status === 'completed' ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-900 border-slate-700'
              }`}>
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getPriorityBadge(task.priority)}
                    <h4 className="text-lg font-bold text-slate-200">{task.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-500" />
                    <span className="text-xs text-slate-500">
                      {fechaDeTarea(task)?.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) || 'Fecha pendiente'}
                    </span>
                  </div>
                  {getStatusBadge(task.status)}
                </div>
                <p className="text-sm text-slate-400 mb-2">{task.description}</p>
                <button
                  onClick={() => toggleTaskStatus(task.id)}
                  disabled={task.status === 'synced' || !isOnline}
                  className={`p-2 rounded-lg flex items-center justify-center gap-2 transition-all ${task.status === 'completed'
                    ? 'bg-green-700 text-white'
                    : 'bg-slate-700 text-slate-300 active:bg-slate-600'
                    } ${task.status === 'synced' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <CheckCircle size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <CheckCircle size={48} className="mb-4 text-slate-600" />
            <p className="text-xl">No hay tareas pendientes</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TaskLogScreen(props) {
  return <HojaHomeA title="" onBack={props.onBack}><div className="registro-home-a"><TaskLogContenido {...props} /></div></HojaHomeA>;
}
