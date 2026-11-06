import React, { useState, useId, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';
import { COMPAI, COMPAI_RING } from './compaiCast';

const CUERPOS = {
    zariguya: lazy(() => import('../ChagraAgentAvatarZariguya')),
    abejita: lazy(() => import('../ChagraAgentAvatarAngelita')),
    colibri: lazy(() => import('../../visual/creatures/Colibri')),
    barbudito: lazy(() => import('../../visual/creatures/BarbuditoParamo')),
    borugo: lazy(() => import('../../visual/creatures/Borugo')),
};

/**
 * pedagogia.jsx — la capa "para una niña de 11 años" de la Página del Tiempo.
 *
 * Cada índice agroclimático (ETo, VPD, UV, GDD…) puede ser un ladrillo técnico
 * o una historia que una niña entiende. Este módulo aporta:
 *   1. COMPAI — el elenco de Chagra como guías del clima. Cada índice tiene un
 *      compai que lo explica en su voz (reusa a Doña Zarigüeya, la Abejita
 *      Angelita, Don Colibrí, el Barbudito del páramo — el mismo elenco del
 *      valle 3D y el 2D). Avatar liviano (no monta el rubberhose completo, que
 *      es pesado): el objetivo es enseñar, no renderizar arte pesado en una lista.
 *   2. <QueEsEsto> — el chip "¿Qué es esto?" que despliega la explicación de niña
 *      con su compai. Regla: si una niña no lo entiende, está mal contado.
 */

/** El mismo cuerpo del elenco, a escala de tarjeta. */
export function CompaiAvatar({ compai = 'zariguya', size = 40 }) {
    const Cuerpo = CUERPOS[compai] || CUERPOS.zariguya;
    const c = COMPAI[compai] || COMPAI.zariguya;
    return (
        <span
            aria-hidden="true"
            className={`shrink-0 grid place-items-center rounded-full ring-2 ${COMPAI_RING[c.color] || COMPAI_RING.amber}`}
            style={{ width: size, height: size, fontSize: size * 0.55 }}
            data-testid={`compai-${compai}`}
        >
            <Suspense fallback={null}><Cuerpo size={size} animated={false} withLabel={false} /></Suspense>
        </span>
    );
}

/**
 * Chip "¿Qué es esto?" que despliega la explicación en lenguaje de niña con su
 * compai. Colapsado por defecto para no abrumar al campesino experto; abierto es
 * el aula de una niña.
 *
 * Con `destino`, el panel se pinta en ese nodo (portal) y el chip se queda
 * donde está: así una rejilla puede dar al panel su propia fila (W39, N5 de la v16).
 *
 * @param {{titulo:string, compai?:keyof typeof COMPAI, children:React.ReactNode, testid?:string, destino?:Element|null}} props
 */
export function QueEsEsto({ titulo = '¿Qué es esto?', compai = 'zariguya', children, testid, destino = null }) {
    const [open, setOpen] = useState(false);
    const id = useId();
    const c = COMPAI[compai] || COMPAI.zariguya;
    const panel = (
        <div
            id={id}
            className="cl-explicacion-panel mt-2 flex gap-2.5 rounded-2xl border border-sky-500/20 bg-slate-900/70 p-3 clima-pedagogia-entra"
        >
            <CompaiAvatar compai={compai} size={38} />
            <div className="cl-explicacion-panel__texto min-w-0">
                <p className="text-[11px] font-bold text-sky-300/90 leading-tight">
                    {c.nombre} explica:
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-200">{children}</p>
            </div>
            <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar explicación"
                className="min-h-11 min-w-11 grid place-items-center shrink-0 self-start text-slate-500 active:text-slate-300"
            >
                <X size={14} aria-hidden="true" />
            </button>
        </div>
    );
    return (
        <div className="mt-2">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls={id}
                data-testid={testid || 'que-es-esto'}
                className="cl-explicacion-toggle min-h-11 inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-200 active:bg-sky-500/20 transition-colors"
            >
                <HelpCircle size={12} aria-hidden="true" />
                <span className="cl-explicacion-toggle__texto">{open ? 'Cerrar' : titulo}</span>
            </button>
            {open && (destino ? createPortal(panel, destino) : panel)}
        </div>
    );
}
