import { FRASE_MUERTA } from '../compai/nucleo/zariguyaGestos.js';
import ZariguyaCompai from '../visual/creatures/ZariguyaCompai';
import { useAngelitaPresencia, esPasivo } from '../visual/agente/useAngelitaPresencia';
import { useEffect, useMemo } from 'react';
import { conductaZariguya } from '../compai/zariguyaConducta.js';
import { escribirCooldowns, estaEnCooldown, registrarCooldown } from '../compai/nucleo/cooldowns.js';

/**
 * ChagraAgentAvatarZariguya — la zarigüeya como CARA del agente de Chagra,
 * 3ra opción junto a Angelita y el maíz (operador 2026-07-25).
 *
 * Arte: `ZariguyaCompai` (2026-09-14) — la zarigüeya DIBUJADA A MANO como
 * vector de la familia de los compais que sí funcionaron (OsoBaston,
 * Guacamaya, Angelita): ~150 formas con nombre de anatomía sobre el kit
 * `_rubberhose.jsx` + `useVidaIdle.js`, ~60 KB entre JSX y CSS. Reemplaza
 * en el AGENTE al trazado automático (`ZariguyaTrazado`, 68.580 piezas /
 * 10,43 MB con sus poses), que sigue registrado en `CREATURES.zariguya` y en
 * el valle hasta que el operador decida el repoint. Estados: acompana /
 * escuchando / pensando / respondiendo / contenta / caminando + los ricos
 * (preocupada, no-se, senala, invita, husmea) y la vida propia de la especie
 * (tanatosis, crías, husmeo, cola que enrosca, lava-cara, mira-a-usted).
 *
 * Adaptador puro (mismo contrato que ChagraAgentAvatarJaguar/OsoBaston):
 * traduce la API histórica del avatar del agente (state 'idle'|'thinking'|
 * 'speaking'|'listening'|'caminando', glow, withLabel, onClick/onDoubleClick)
 * al contrato común Compai de `ZariguyaCompai` (CompaiAgente canoniza el
 * estado y le da su pose; el rig pone la cadencia en `zariguyaCompai.css`).
 * `state` viaja como `estado` y queda expuesto en `data-agt-estado`
 * (paridad de API / accesibilidad).
 *
 * PRESENCIA (pedido operador 2026-08-24, transversal al elenco — mismo
 * contrato que ChagraAgentAvatarJaguar/Angelita): con `reaccionaPresencia` la
 * chucha DESPIERTA a su estado natural (idle vivo: su idle-cerebro husmea/
 * tanatosis/reposo) cuando la persona hace mouse over o toca la pantalla, SIN
 * pisar un estado activo real (thinking/speaking/listening/caminando).
 * ADITIVA: `reaccionaPresencia=false` (el default) deja el adaptador idéntico.
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

const TURNO_UNICOS = Object.freeze([
    { key: 'resumenAnochecer', id: 'resumen-anochecer', ventana: 30_000, mensaje: 'Resumen del anochecer disponible.' },
    { key: 'alertaNocturna', id: 'plaga-nocturna', ventana: 30_000, mensaje: 'Hay una alerta nocturna para revisar.' },
    { key: 'rastros', id: 'lectura-rastros', ventana: 30_000, mensaje: 'Leí unos rastros de la finca.' },
    { key: 'tanatosis', id: 'tanatosis', ventana: 45_000, mensaje: FRASE_MUERTA },
    { key: 'cuidadoPlantulas', id: 'cuidado-plantulas', ventana: 30_000, mensaje: 'Estoy cuidando lo pequeño.' },
    { key: 'aprendizajeCrias', id: 'aprendizaje-crias', ventana: 30_000, mensaje: 'Las crías pueden repetir este paso.' },
]);

function elegirTurnoUnico(unicos, cooldowns = {}, ahoraMs = Date.now()) {
    for (const regla of TURNO_UNICOS) {
        const señal = unicos?.[regla.key];
        const tieneSeñal = regla.key === 'resumenAnochecer'
            ? señal?.entradas?.length > 0
            : regla.key === 'rastros'
                ? señal?.lecturas?.length > 0
                : regla.key === 'alertaNocturna'
                    ? señal?.plagas?.length > 0
                    : Boolean(señal);
        if (!tieneSeñal) continue;
        const llave = `zariguya:${regla.id}`;
        if (estaEnCooldown(llave, { ahoraMs, cooldownMs: regla.ventana, cooldowns })) continue;
        return { ...regla, llave };
    }
    return null;
}

export default function ChagraAgentAvatarZariguya({
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
    // Paridad con el cuerpo canónico (mismos controles que el adaptador del
    // jaguar): la chucha honra reduced-motion (animated) y la gama baja
    // (tier), y no debe descartarlos donde el host los cablee.
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
    // reaccionaPresencia la zarigüeya DESPIERTA a su idle vivo al detectar
    // presencia, sin pisar una actuación conversacional real. Mismo contrato
    // que ChagraAgentAvatarAngelita/Jaguar.
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
    // interrumpe una actuación conversacional ni la caminata. La zarigüeya ya
    // vive en idle (idle-cerebro), así que despertar = garantizar su idle.
    const estadoAgente = estado || ESTADO_DE_STATE[state] || 'acompana';
    const despiertaNatural = despierta && esPasivo(estadoAgente);
    const estadoEfectivo = despiertaNatural ? 'acompana' : estadoAgente;
    const visema = visemaRecibido ?? VISEMA_DE_STATE[estadoEfectivo] ?? null;
    const conductaCalculada = useMemo(() => (mundoId
        ? conductaZariguya({ mundo: mundoId, ...(conductaContexto || {}), estado: estadoEfectivo })
        : null), [mundoId, conductaContexto, estadoEfectivo]);
    const turnoUnico = useMemo(() => elegirTurnoUnico(
        conductaCalculada?.unicos,
        conductaCalculada?.cooldowns,
    ), [conductaCalculada]);
    useEffect(() => {
        if (!conductaCalculada) return;
        if (turnoUnico && conductaContexto?.storage) {
            const cooldownsActualizados = registrarCooldown(
                turnoUnico.llave,
                Date.now(),
                conductaCalculada.cooldowns || {},
            );
            escribirCooldowns(cooldownsActualizados, conductaContexto.storage);
        }
        if (typeof onConducta === 'function') {
            onConducta({ ...conductaCalculada, turnoUnico: turnoUnico?.id || null });
        }
    }, [conductaCalculada, conductaContexto, onConducta, turnoUnico]);

    const tanatosis = turnoUnico?.key === 'tanatosis';
    const husmea = turnoUnico?.key === 'rastros';
    const crias = turnoUnico?.key === 'cuidadoPlantulas' || turnoUnico?.key === 'aprendizajeCrias';

    const bicho = (
        <ZariguyaCompai
            estado={estadoEfectivo}
            visema={visema}
            size={size}
            animated={animated}
            clima={clima}
            enso={enso}
            direccion={direccion}
            reducedMotion={reducedMotion}
            tier={tier}
            mundoId={mundoId}
            tanatosis={tanatosis}
            husmea={husmea}
            crias={crias}
            title={ariaLabel}
            className={className}
            style={glow ? { filter: 'drop-shadow(0 0 10px rgba(255,158,203,0.65))' } : undefined}
            data-conducta-mundo={conductaCalculada ? mundoId : undefined}
            data-agt-estado={dataEstado || estadoAgente}
            data-pose={dataPose}
            data-visema={dataVisema || visema || undefined}
            data-zariguya-conducta={turnoUnico?.id || undefined}
            data-zariguya-turno={turnoUnico ? 'unico' : undefined}
            data-confianza={confianza || undefined}
            {...atributosConducta}
        />
    );

    const contenido = withLabel ? (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {bicho}
            <span style={{ font: '600 0.7rem/1 system-ui, sans-serif', color: '#94a3b8' }}>
                Zarigüeya
            </span>
        </span>
        ) : bicho;

    const mensaje = turnoUnico?.mensaje || conductaCalculada?.comentario || conductaCalculada?.susurro?.mensaje || null;
    const conVoz = mostrarAvisoConducta && mensaje ? (
        <span className="zariguya-conducta" role="status" aria-live="polite">
            <span className="zariguya-conducta__nombre">Zarigüeya</span>
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
    // lector de pantalla) que además capta la presencia por hover directo;
    // sin handlers, solo el dibujo (la presencia sigue viva por los listeners
    // de ventana de useAngelitaPresencia).
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
