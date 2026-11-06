import JaguarCompai from '../visual/creatures/JaguarCompai';
import { useAngelitaPresencia, esPasivo } from '../visual/agente/useAngelitaPresencia';
import { useEffect, useMemo } from 'react';
import { conductaJaguar } from '../compai/jaguarConducta.js';

// Adaptador del agente al jaguar dibujado a mano, con estados y mandíbula articulada.
const VISEMA_DE_STATE = {
    speaking: 'V2',
    respondiendo: 'V2',
};

const ESTADO_DE_STATE = {
    idle: 'acompana',
    // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish
    thinking: 'pensando',
    // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish
    speaking: 'respondiendo',
    listening: 'escuchando',
    caminando: 'caminando',
};

const ESTADO_RICO_DE_GESTO = {
    idle: 'acompana',
    acecha: 'acompana',
    slowBlink: 'acompana',
    // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish -- identificador técnico del contrato de conducta
    hablar: 'respondiendo',
};

export default function ChagraAgentAvatarJaguar({
    state = 'idle',
    estado = undefined,
    visema: visemaRecibido = null,
    size = 48,
    withLabel = false,
    onClick = undefined,
    onDoubleClick = undefined,
    glow = false,
    className = '',
    ariaLabel = 'Chagra IA',
    confianza = null,
    // Paridad con el cuerpo canónico (mismos controles que el adaptador de
    // Angelita): el felino honra reduced-motion (animated) y la gama baja
    // (tier), y no debe descartarlos donde el host los cablea.
    animated = true,
    tier = undefined,
    clima = null,
    enso = 'neutro',
    direccion = 'derecha',
    reducedMotion = false,
    'data-agt-estado': dataEstado = undefined,
    'data-pose': dataPose = undefined,
    'data-visema': dataVisema = undefined,
    // Presencia (pedido operador 2026-08-24, transversal al elenco): con
    // reaccionaPresencia el jaguar DESPIERTA a su estado natural (idle vivo:
    // useVidaIdle 70/30 — acecha/ruge/reposo) cuando la persona hace mouse
    // over o toca la pantalla, sin pisar un estado activo real (thinking/
    // speaking/listening). Mismo contrato que ChagraAgentAvatarAngelita.
    reaccionaPresencia = true,
    mundoId = null,
    mostrarAvisoConducta = true,
    conductaContexto = undefined,
    onConducta = undefined,
    ...atributosConducta
}) {
    const { despierta, handlers: handlersPresencia } = useAngelitaPresencia({
        activo: reaccionaPresencia,
    });
    // La presencia solo despierta cuando el estado es pasivo (idle): jamás
    // interrumpe una actuación conversacional. El jaguar ya está vivo en idle
    // (idle-cerebro), así que despertar = garantizar animated ON + su idle.
    const estadoAgente = estado || ESTADO_DE_STATE[state] || 'acompana';
    const despiertaNatural = despierta && esPasivo(estadoAgente);
    const estadoEfectivo = despiertaNatural ? 'acompana' : estadoAgente;
    const visema = visemaRecibido ?? VISEMA_DE_STATE[estadoEfectivo] ?? null;

    const conductaCalculada = useMemo(() => (mundoId
        ? conductaJaguar({ mundo: mundoId, ...(conductaContexto || {}), estado: estadoEfectivo })
        : null), [mundoId, conductaContexto, estadoEfectivo]);
    const gesto = conductaCalculada?.gesto || 'idle';
    const estadoRig = mundoId ? ESTADO_RICO_DE_GESTO[gesto] || 'acompana' : estadoEfectivo;
    const atributosResultado = conductaCalculada ? {
        'data-conducta-habla-poco': String(conductaCalculada.hablaPoco),
        'data-conducta-linderos': String(conductaCalculada.linderos?.cantidad || 0),
        'data-conducta-alerta-fauna': conductaCalculada.alertaFauna?.tipo || undefined,
        'data-conducta-rastros': String(conductaCalculada.rastros?.length || 0),
        'data-conducta-rugido': conductaCalculada.rugido?.causa || undefined,
        'data-conducta-aviso-monte': conductaCalculada.avisoMonte?.senal || undefined,
    } : {};

    useEffect(() => {
        if (!conductaCalculada) return;
        if (typeof onConducta === 'function') onConducta(conductaCalculada);
    }, [conductaCalculada, onConducta]);

    const bicho = (
        <JaguarCompai
            estado={estadoRig}
            visema={visema}
            size={size}
            animated={animated}
            clima={clima}
            enso={enso}
            direccion={direccion}
            reducedMotion={reducedMotion}
            tier={tier}
            title={ariaLabel}
            className={className}
            style={glow ? { filter: 'drop-shadow(0 0 10px rgba(168,85,247,0.65))' } : undefined}
            data-conducta-mundo={conductaCalculada ? mundoId : undefined}
            data-agt-estado={dataEstado || estadoAgente}
            data-pose={dataPose}
            data-visema={dataVisema || visema || undefined}
            data-gesto={gesto}
            {...atributosResultado}
            data-confianza={confianza || undefined}
            {...atributosConducta}
        />
    );

    const contenido = withLabel ? (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {bicho}
            <span style={{ font: '600 0.7rem/1 system-ui, sans-serif', color: '#94a3b8' }}>
                Jaguar
            </span>
        </span>
    ) : bicho;

    const mensaje = conductaCalculada?.comentario || null;
    const conVoz = mostrarAvisoConducta && mensaje ? (
        <span className="jaguar-conducta" role="status" aria-live="polite">
            <span className="jaguar-conducta__nombre">Jaguar</span>
            <span>{mensaje}</span>
        </span>
    ) : null;
    const contenidoConVoz = conVoz ? (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {contenido}
            {conVoz}
        </span>
    ) : contenido;

    // Paridad con los avatares hermanos: con handlers, botón real (teclado +
    // lector de pantalla) que envuelve TODO el contenido (dibujo + rótulo);
    // sin handlers, solo el dibujo.
    if (onClick || onDoubleClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                onDoubleClick={onDoubleClick}
                aria-label={ariaLabel}
                title={ariaLabel}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0 }}
                {...handlersPresencia}
            >
                {contenidoConVoz}
            </button>
        );
    }
    return contenidoConVoz;
}
