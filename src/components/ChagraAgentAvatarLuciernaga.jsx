import { useEffect, useMemo } from 'react';
import { conductaLuciernaga } from '../compai/luciernagaConducta.js';
import { LuciernagaRig } from '../visual/creatures/Luciernaga.jsx';
import { COMPAI_ESPECIES } from '../visual/agente/compaiEspecies.js';
import { useAngelitaPresencia, esPasivo } from '../visual/agente/useAngelitaPresencia';

/**
 * Conserva el contrato del avatar y la presencia del agente sobre el cuerpo
 * compartido. Usamos el rig directamente: el dispatcher ya monta CompaiAgente.
 * La linterna fuerte usa eco=sano; preocupada activa el azul de eco=degradado.
 */
const ESTADO_DE_STATE = {
    idle: 'acompana',
    // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish
    thinking: 'pensando',
    // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish
    speaking: 'respondiendo',
    listening: 'escuchando',
    caminando: 'caminando',
};

/* eslint-disable chagra-i18n/no-hardcoded-spanish */
const ESTADOS_LINTERNA_FUERTE = new Set([
    'thinking', 'pensando', 'speaking', 'respondiendo', 'hablando', 'actuando',
]);
/* eslint-enable chagra-i18n/no-hardcoded-spanish */

export default function ChagraAgentAvatarLuciernaga({
    state = 'idle',
    estado = undefined,
    visema: visemaRecibido = null,
    size = 48,
    withLabel = false,
    onClick = undefined,
    onDoubleClick = undefined,
    glow = false,
    className = '',
    style = undefined,
    ariaLabel = 'Chagra IA',
    confianza = null,
    animated = true,
    tier = undefined,
    clima = null,
    enso = 'neutro',
    direccion = 'derecha',
    reducedMotion = false,
    'data-agt-estado': dataEstado = undefined,
    'data-pose': dataPose = undefined,
    'data-visema': dataVisema = undefined,
    // Contrato DOM del elenco (CompaiP1.contract): el rig debe exponer
    // data-agt-especie y data-creature para TODAS las especies. CompaiAgente
    // los entrega por propsDelAdaptador; sin reenviarlos aquí la luciérnaga
    // queda sin especie en su nodo raíz (regresión detectada en dev rojo).
    'data-agt-especie': dataEspecie = undefined,
    'data-creature': dataCreature = undefined,
    reaccionaPresencia = true,
    mundoId = null,
    mostrarAvisoConducta = true,
    conductaContexto = undefined,
    onConducta = undefined,
    ...atributosConducta
}) {
    const { despierta, handlers: handlersPresencia } = useAngelitaPresencia({ activo: reaccionaPresencia });
    const estadoAgente = estado || ESTADO_DE_STATE[state] || 'acompana';
    const estadoEfectivo = despierta && esPasivo(estadoAgente) ? 'acompana' : estadoAgente;
    const conductaCalculada = useMemo(() => (mundoId
        ? conductaLuciernaga({ ...(conductaContexto || {}), mundo: mundoId })
        : null), [mundoId, conductaContexto]);
    useEffect(() => {
        if (conductaCalculada && typeof onConducta === 'function') onConducta(conductaCalculada);
    }, [conductaCalculada, onConducta]);
    const linterna = ESTADOS_LINTERNA_FUERTE.has(estadoEfectivo) ? 'fuerte' : 'normal';
    const visema = visemaRecibido || (ESTADOS_LINTERNA_FUERTE.has(estadoEfectivo) ? 'V2' : undefined);

    const eco = estadoEfectivo === 'preocupada' ? 'degradado' : linterna === 'fuerte' ? 'sano' : null;
    const pose = dataPose || COMPAI_ESPECIES.luciernaga.posePorEstado[estadoEfectivo] || 'vuela';

    const bicho = (
        <span style={{ display: 'inline-flex', width: size, height: size, lineHeight: 0,
            filter: glow ? `drop-shadow(0 0 10px ${eco === 'degradado' ? 'rgba(80,198,255,0.65)' : 'rgba(255,217,74,0.65)'})` : undefined,
            ...style,
        }}>
            <LuciernagaRig
                animated={animated && !reducedMotion}
                size={size}
                title={ariaLabel}
                className={className}
                estado={estadoEfectivo}
                eco={eco}
                visema={dataVisema || visema}
                pose={pose}
                clima={clima}
                enso={enso}
                tier={tier}
                data-conducta-mundo={conductaCalculada ? mundoId : undefined}
                data-conducta-nocturno={conductaCalculada ? String(conductaCalculada.nocturno) : undefined}
                data-linterna={linterna}
                data-agt-estado={dataEstado || estadoAgente}
                data-estado={estadoEfectivo}
                data-pose={pose}
                data-visema={dataVisema || visema}
                data-confianza={confianza || undefined}
                data-clima={clima || undefined}
                data-tier={tier || undefined}
                data-enso={enso}
                data-direccion={direccion}
                // Spread CONDICIONAL: si llegan undefined (montado directo, sin
                // CompaiAgente) NO deben pisar el data-creature fijo del rig
                // (un spread undefined en JSX borra el atributo explícito previo).
                {...(dataEspecie ? { 'data-agt-especie': dataEspecie } : {})}
                {...(dataCreature ? { 'data-creature': dataCreature } : {})}
                {...atributosConducta}
            />
        </span>
    );

    const contenido = withLabel ? (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {bicho}
            <span style={{ font: '600 0.7rem/1 system-ui, sans-serif', color: '#94a3b8' }}>
                Luciérnaga
            </span>
        </span>
    ) : bicho;

    const contenidoConVoz = mostrarAvisoConducta && conductaCalculada?.comentario ? (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {contenido}
            <span className="luciernaga-conducta" role="status" aria-live="polite">
                {conductaCalculada.comentario}
            </span>
        </span>
    ) : contenido;

    // Paridad con los avatares hermanos: con handlers, botón real (teclado +
    // lector de pantalla); sin handlers, solo el dibujo.
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
