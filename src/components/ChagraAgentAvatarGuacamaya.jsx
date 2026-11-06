import GuacamayaCompai from '../visual/creatures/GuacamayaCompai';
import { useAngelitaPresencia, esPasivo } from '../visual/agente/useAngelitaPresencia';
import { useEffect, useMemo } from 'react';
import { conductaGuacamaya } from '../compai/guacamayaConducta.js';
import { ESTADO_A_GESTO } from '../compai/nucleo/guacamayaGestos.js';

/**
 * ChagraAgentAvatarGuacamaya — la guacamaya bandera (Ara macao) como CARA del
 * agente de Chagra, 7ma opción del elenco unificado (2026-08-14).
 *
 * Cierra el ítem #8 del GAP compAI: la guacamaya no tenía cuerpo en la PWA
 * (`ELENCO.guacamaya.enPWA` seguía `false`); ahora lo tiene reusando el rig
 * F24 del valle (`visual/creatures/GuacamayaCompai.jsx`, ver ese archivo para
 * el detalle — rig+defs+css inlineados, NO redibujado a mano; el nombre NO
 * es `Guacamaya.jsx` porque ese archivo ya existía: el billboard decorativo
 * de `FaunaCalido.jsx`, otro dibujo, otro propósito).
 *
 * Adaptador puro (mismo contrato que los hermanos ChagraAgentAvatar*): traduce
 * la API histórica del avatar del agente (state 'idle'|'thinking'|'speaking'|
 * 'listening', glow, withLabel, onClick/onDoubleClick) al `state` que
 * `GuacamayaCompai.jsx` ya entiende directo (no necesita traducción de pose —
 * el rig reusado solo distingue idle/hablar por ahora, ver nota en ese
 * archivo).
 *
 * VISEMA (2026-08-21, "guacamaya = compai de agente completo"):
 * `GuacamayaCompai.jsx` dejó de hardcodear `data-visema` a partir de `state`
 * — ahora acepta un `visema` real (para el vocabulario rico, ver
 * `ChagraAgentAvatar.jsx`). Este adaptador angosto sigue produciendo un
 * visema razonable a partir de `state`, mismo patrón que
 * `ChagraAgentAvatarOsoBaston.jsx`/`ChagraAgentAvatarLuciernaga.jsx`
 * (`VISEMA_DE_STATE`): así el contrato observable narrow (state="speaking"
 * → data-visema) no cambia para quien ya lo usaba.
 */
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
    // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish -- identificador técnico del contrato de conducta
    hablar: 'respondiendo',
    senalar: 'senala',
    dispersar: 'husmea',
    sana: 'contenta',
    amenaza: 'preocupada',
    pacto: 'invita',
};

// Una sola intervención propia por turno. La prioridad es estable para que
// una finca con varias señales no dispare siete mensajes a la vez.
const PRIORIDAD_UNICOS = [
    'resumenFinca', 'lotePendiente', 'confirmacion', 'plagaVecina',
    'frutoMaduro', 'llamadaBandada', 'corredorBosque',
];
const CLAVE_UNICO = {
    resumenFinca: 'resumen',
    lotePendiente: 'lotePendiente',
    confirmacion: 'confirmacion',
    plagaVecina: 'plagaVecina',
    frutoMaduro: 'frutoMaduro',
    llamadaBandada: 'llamadaBandada',
    corredorBosque: 'corredorBosque',
};

function mensajeDeUnico(id, unico) {
    if (!unico) return null;
    if (id === 'confirmacion') return unico.confirmacion || null;
    if (id === 'plagaVecina') {
        const lotes = unico.lotes?.filter(Boolean).join(', ');
        return lotes ? `La plaga ${unico.plaga} aparece en ${lotes}; conviene revisar los lotes vecinos.` : null;
    }
    if (id === 'corredorBosque') {
        return `Hay ${unico.corredores.length} corredor${unico.corredores.length === 1 ? '' : 'es'} declarado${unico.corredores.length === 1 ? '' : 's'} entre parches de bosque.`;
    }
    return unico.mensaje || null;
}

function elegirUnico(conducta, senal) {
    if (!conducta?.unicos) return null;
    const solicitado = senal && CLAVE_UNICO[senal] && conducta.unicos[CLAVE_UNICO[senal]] ? senal : null;
    const id = solicitado || PRIORIDAD_UNICOS.find((clave) => conducta.unicos[CLAVE_UNICO[clave]]);
    const dato = id ? conducta.unicos[CLAVE_UNICO[id]] : null;
    return id ? { id, dato, mensaje: mensajeDeUnico(id, dato) } : null;
}

export default function ChagraAgentAvatarGuacamaya({
    state = 'idle',
    estado = undefined,
    visema: visemaProp = null,
    size = 48,
    withLabel = false,
    onClick = undefined,
    onDoubleClick = undefined,
    glow = false,
    className = '',
    ariaLabel = 'Chagra IA',
    confianza = null,
    animated = true,
    tier = undefined,
    clima = null,
    enso = 'neutro',
    direccion = 'derecha',
    reducedMotion = false,
    reaccionaPresencia = true,
    mundoId = null,
    mostrarAvisoConducta = true,
    conductaContexto = undefined,
    onConducta = undefined,
    'data-agt-estado': dataEstado = undefined,
    'data-pose': dataPose = undefined,
    'data-visema': dataVisema = undefined,
    'data-clima': dataClima = undefined,
    'data-tier': dataTier = undefined,
    comportamiento: comportamientoProp = undefined,
    ...atributosConducta
}) {
    const { despierta, handlers: handlersPresencia } = useAngelitaPresencia({ activo: reaccionaPresencia });
    const estadoBase = estado || ESTADO_DE_STATE[state] || 'acompana';
    const estadoEfectivo = despierta && esPasivo(estadoBase) ? 'idle' : estadoBase;
    const visema = visemaProp ?? VISEMA_DE_STATE[estadoEfectivo] ?? null;
    const gesto = ESTADO_A_GESTO[estadoEfectivo] || ({
        respondiendo: 'hablar',
        contenta: 'sana',
        preocupada: 'amenaza',
        invita: 'pacto',
        husmea: 'dispersar',
        senala: 'senalar',
    }[estadoEfectivo] || 'idle');

    const conductaCalculada = useMemo(() => (mundoId
        ? conductaGuacamaya({ mundo: mundoId, ...(conductaContexto || {}), estado: estadoEfectivo })
        : null), [mundoId, conductaContexto, estadoEfectivo]);
    const conductaConGesto = useMemo(() => (conductaCalculada
        ? { ...conductaCalculada, gesto: conductaCalculada.gesto || gesto }
        : null), [conductaCalculada, gesto]);
    const comportamiento = useMemo(() => elegirUnico(
        conductaConGesto,
        comportamientoProp || conductaContexto?.comportamiento,
    ), [conductaConGesto, comportamientoProp, conductaContexto]);
    const estadoRig = mundoId
        ? ESTADO_RICO_DE_GESTO[conductaConGesto?.gesto || gesto] || 'acompana'
        : gesto;

    useEffect(() => {
        if (!conductaConGesto) return;
        if (typeof onConducta === 'function') {
            onConducta({ ...conductaConGesto, comportamientoActivo: comportamiento });
        }
    }, [conductaConGesto, comportamiento, onConducta]);

    const mensajeBase = conductaConGesto?.comentario || null;
    const mensajeUnico = comportamiento?.mensaje || null;
    const bicho = (
        <GuacamayaCompai
            state={state}
            estado={mundoId ? estadoRig : (despierta && esPasivo(estadoBase) ? undefined : estadoBase)}
            visema={visema}
            animated={animated}
            reducedMotion={reducedMotion}
            tier={dataTier || tier}
            clima={clima}
            enso={enso}
            direccion={direccion}
            size={size}
            title={ariaLabel}
            className={className}
            style={glow ? { filter: 'drop-shadow(0 0 10px rgba(224,36,32,0.65))' } : undefined}
            data-conducta-mundo={conductaCalculada ? mundoId : undefined}
            data-agt-estado={dataEstado || estadoBase}
            data-pose={dataPose}
            data-visema={dataVisema || visema || undefined}
            data-confianza={confianza || undefined}
            data-clima={dataClima}
            data-gesto={gesto}
            {...atributosConducta}
        />
    );

    const contenido = withLabel ? (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {bicho}
            <span style={{ font: '600 0.7rem/1 system-ui, sans-serif', color: '#94a3b8' }}>
                Guacamaya
            </span>
        </span>
    ) : bicho;

    const conVoz = mostrarAvisoConducta && (mensajeBase || mensajeUnico) ? (
        <span
            className="guacamaya-conducta"
            role="status"
            aria-live="polite"
            data-guacamaya-comportamiento={comportamiento?.id || undefined}
        >
            <span className="guacamaya-conducta__nombre">Guacamaya</span>
            {mensajeBase ? <span className="guacamaya-conducta__base">{mensajeBase}</span> : null}
            {mensajeUnico ? <span className="guacamaya-conducta__unico">{mensajeUnico}</span> : null}
        </span>
    ) : null;
    const contenidoConVoz = conVoz ? (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {contenido}
            {conVoz}
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
