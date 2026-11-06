import ChivitoPunk, { ChivitoPunkRig } from '../visual/creatures/ChivitoPunk.jsx';
import { useAngelitaPresencia, esPasivo } from '../visual/agente/useAngelitaPresencia';
import { useEffect, useMemo } from 'react';
import {
    alertaSobrepastoreo,
    alertaSuelo,
    conductaChivitoPunk,
    protegerBorrado,
    probarLoma,
    sugerirRotacionEntreLotes,
} from '../compai/chivito-punkConducta.js';
import { escribirCooldowns, leerCooldowns } from '../compai/nucleo/cooldowns.js';

const ALERTA_COOLDOWN_MS = 30_000;

function elegirConductaEspecial(contexto = {}, ahora = new Date()) {
    const suelo = alertaSuelo(contexto.huellas || []);
    const borrado = protegerBorrado(contexto.intencionBorrado);
    const loma = probarLoma(contexto.pruebaLoma);
    const pastoreo = alertaSobrepastoreo(contexto.pastoreo);
    const rotacion = sugerirRotacionEntreLotes(contexto.lotes || []);
    const candidatos = [
        borrado,
        suelo[0],
        loma && !loma.aguanta ? loma : null,
        pastoreo,
        rotacion,
    ].filter(Boolean);
    if (!candidatos.length) return null;

    const storage = contexto.storage;
    const ahoraMs = ahora instanceof Date ? ahora.getTime() : Number(ahora);
    if (storage) {
        const cooldowns = leerCooldowns(storage);
        const ultima = Number(cooldowns['chivito-punk:alerta']);
        if (Number.isFinite(ultima) && ahoraMs - ultima < ALERTA_COOLDOWN_MS) return null;
        escribirCooldowns({ ...cooldowns, 'chivito-punk:alerta': ahoraMs }, storage);
    }
    return candidatos[0];
}

/**
 * ChagraAgentAvatarChivitoPunk — el chivito de páramo (Oxypogon guerinii)
 * como CARA del agente de Chagra, 6ta opción del elenco unificado
 * (2026-08-14). Slug canónico `chivito-punk` (colapso `chivito`→`chivito-punk`
 * ya resuelto en `compai/nucleo/elenco.js`, #96 — un solo pájaro, no dos).
 *
 * Cierra el ítem #8 del GAP compAI: el chivito no tenía cuerpo en la PWA
 * (`ELENCO['chivito-punk'].enPWA` seguía `false`); ahora lo tiene reusando el
 * rig de arte a mano (`visual/creatures/ChivitoPunk.jsx`).
 *
 * Adaptador puro (mismo contrato que los hermanos ChagraAgentAvatar*): traduce
 * la API histórica del avatar del agente (state 'idle'|'thinking'|'speaking'|
 * 'listening', glow, withLabel, onClick/onDoubleClick) al `state` que
 * `ChivitoPunk.jsx` usa el rig normal en reposo y activa la cresta punk solo
 * durante la actuación.
 */
export default function ChagraAgentAvatarChivitoPunk({
    state = 'idle',
    estado = undefined,
    visema = null,
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
    perfil = undefined,
    // Contrato DOM del elenco (CompaiP1.contract): el rig debe exponer
    // data-agt-especie y data-creature para TODAS las especies. CompaiAgente
    // los entrega por propsDelAdaptador; sin reenviarlos aquí el chivito
    // queda sin especie en su nodo raíz (regresión detectada en dev rojo).
    'data-agt-especie': dataEspecie = undefined,
    'data-creature': dataCreature = undefined,
    ...atributosConducta
}) {
    const { despierta, handlers: handlersPresencia } = useAngelitaPresencia({ activo: reaccionaPresencia });
    const estadoAgente = estado || state;
    const estadoEfectivo = despierta && esPasivo(estadoAgente) ? 'idle' : estadoAgente;
    // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish
    const estaActuando = ['speaking', 'respondiendo', 'hablando', 'actuando', 'invita', 'celebra'].includes(estadoAgente);
    const visemaEfectivo = dataVisema || visema || (estaActuando ? 'V2' : undefined);
    const conducta = useMemo(() => (mundoId
        ? conductaChivitoPunk({
            mundo: mundoId,
            ...(conductaContexto || {}),
            actuando: estaActuando,
        })
        : null), [mundoId, conductaContexto, estaActuando]);

    const conductaEspecial = useMemo(() => elegirConductaEspecial(
        conductaContexto,
        conductaContexto?.ahora || new Date(),
    ), [conductaContexto]);

    const atributosResultado = conducta ? {
        'data-chivito-alertas': conducta.alertas?.map((alerta) => alerta.tipo).join(',') || undefined,
        'data-chivito-borrado-protegido': conducta.borradoProtegido?.bloqueado ? 'true' : undefined,
        'data-chivito-sobrepastoreo': conducta.sobrepastoreo?.excede ? 'true' : undefined,
    } : {};

    useEffect(() => {
        if (!conducta) return;
        if (typeof onConducta === 'function') onConducta(conducta);
    }, [conducta, onConducta]);

    const actuandoPorConducta = conducta ? conducta.punkActivo : estaActuando;
    // El dispatcher ya monta el CompaiAgente común y entrega `perfil` al
    // adaptador. En ese camino solo debe entrar el rig, como en Guacamaya,
    // para no anidar otra fachada Compai. El montaje directo del adaptador
    // conserva la fachada completa para los selectores y usos aislados.
    const Cuerpo = perfil ? ChivitoPunkRig : ChivitoPunk;
    const bicho = (
        <Cuerpo
            size={size}
            title={ariaLabel}
            className={className}
            style={glow ? { filter: 'drop-shadow(0 0 10px rgba(140,70,232,0.65))' } : undefined}
            animated={animated}
            estado={estadoEfectivo}
            visema={visemaEfectivo}
            clima={dataClima || clima || undefined}
            tier={dataTier || tier}
            data-modo={actuandoPorConducta ? 'actuando' : 'normal'}
            {...(actuandoPorConducta ? { 'data-estado': 'hablar' } : {})}
            data-conducta-mundo={conducta ? mundoId : undefined}
            data-agt-estado={dataEstado || estadoAgente}
            data-pose={dataPose || undefined}
            data-visema={visemaEfectivo}
            data-confianza={confianza || undefined}
            data-clima={dataClima || clima || undefined}
            data-tier={dataTier || tier}
            data-enso={enso}
            data-direccion={direccion}
            data-reduced-motion={reducedMotion ? 'true' : undefined}
            // Spread CONDICIONAL: si llegan undefined (montado directo, sin
            // CompaiAgente) NO deben pisar el data-creature fijo del Trazado
            // (un spread undefined en JSX borra el atributo explícito previo).
            {...(dataEspecie ? { 'data-agt-especie': dataEspecie } : {})}
            {...(dataCreature ? { 'data-creature': dataCreature } : {})}
            {...atributosResultado}
            {...atributosConducta}
        />
    );

    const contenido = withLabel ? (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {bicho}
            <span style={{ font: '600 0.7rem/1 system-ui, sans-serif', color: '#94a3b8' }}>
                Chivito
            </span>
        </span>
        ) : bicho;

    const mensaje = conductaEspecial?.mensaje || conducta?.comentario || conducta?.susurro?.mensaje || null;
    const conVoz = mostrarAvisoConducta && mensaje ? (
        <span className="chivito-punk-conducta" role="status" aria-live="polite">
            <span className="chivito-punk-conducta__nombre">Chivito</span>
            <span data-chivito-conducta-tipo={conductaEspecial?.tipo || 'general'}>{mensaje}</span>
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
