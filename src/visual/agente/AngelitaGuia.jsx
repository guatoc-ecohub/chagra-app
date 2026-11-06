import ChagraAgentAvatar from '../../components/ChagraAgentAvatar.jsx';
import useAgentAvatarType, { AVATAR_NOMBRE, DEFAULT_AVATAR_TYPE } from '../../hooks/useAgentAvatarType.js';
import BurbujaAngelita from './BurbujaAngelita.jsx';
import { useAngelitaGuia } from '../../hooks/useAngelitaGuia.js';
import { useEffect } from 'react';
import './angelita-guia.css';

/*
 * <AngelitaGuia> — la guía histórica conserva su export, pero muestra el
 * compañero elegido hasta un elemento real de la pantalla, lo señala/invita/
 * mira (el gesto que usted declaró, reutiliza angelitaEstados.js, CERO estados
 * nuevos) y explica QUÉ hay ahí, con criterio agroecológico real. Reutilizable
 * en CUALQUIER vista 2D.
 *
 * ADOPCIÓN EN OTRA PANTALLA (las 3 líneas que hacen falta):
 *
 *   const refTanque = useRef(null);
 *   const paradas = [{ id: 'tanque', ref: refTanque, texto: 'El agua de lluvia no trae cloro…', gesto: 'invita' }];
 *   <AngelitaGuia paradas={paradas} />
 *
 * (el elemento en cuestión solo necesita `ref={refTanque}` en su JSX de
 * siempre — nada más cambia en la pantalla).
 *
 * QUÉ HACE, en dos piezas fijas (angelita-guia.css):
 *   1. Un avatarcito flotante (`.ang-guia`) que el hook posiciona junto al
 *      elemento — perchado en su esquina, sin tapar el texto de abajo.
 *   2. Una franja angosta y fija al pie (`.ang-guia__panel`) con su burbuja
 *      (BurbujaAngelita, la misma de siempre) y la navegación del recorrido
 *      — SIEMPRE en el mismo sitio, así el usuario sabe dónde mirar y dónde
 *      cerrarla. Un recorrido de una sola parada oculta la navegación y
 *      cambia "Siguiente" por "Entendido".
 *
 * PRINCIPIO MISS MINUTES: presencia que informa sin invadir — nunca bloquea
 * la interacción (el resto de la pantalla queda 100% operable), nunca exige
 * atención (el usuario avanza a su ritmo, no hay avance automático), y se
 * cierra con un toque. Con `recordarCierreId`, cerrarla la apaga para
 * siempre en este dispositivo — no vuelve a insistir.
 *
 * Reduced-motion: sin vuelo entre paradas ni entrada animada del panel — el
 * mensaje se lee exactamente igual, solo que quieto (el hook decide, aquí
 * solo se refleja con `data-ang-quieta`).
 *
 * @param {Object} props
 * @param {import('../../hooks/useAngelitaGuia').ParadaGuia[]} props.paradas
 * @param {boolean} [props.activo=true]
 * @param {number} [props.tamano=64]
 * @param {string} [props.recordarCierreId] — persistir el cierre en este dispositivo.
 * @param {number} [props.demoraInicialMs] — pisa la espera antes de aparecer
 *   (default del hook: 550ms; útil para tests o para un host que dispara la
 *   guía desde una acción explícita del usuario, sin necesidad de esperar).
 * @param {string} [props.className] — clases extra para el avatarcito flotante.
 * @param {(posicion: object|null, parada: object|null) => void} [props.onPosicionChange]
 *   — avisa al host dónde queda y en qué parada va (también sin `soloPosicion`).
 * @param {boolean} [props.variar] — false = el texto de cada parada tal cual,
 *   sin el ropaje de angelitaVariedad (recorridos que explican botones).
 * @param {(rect: Object, contexto: Object) => Object|null} [props.resolverPuesto]
 *   — estrategia opcional del anfitrión para colocar el compai entre controles y textos.
 * @param {() => void} [props.onCerrar] — el usuario la cerró o terminó.
 */
export function AngelitaGuia({
  paradas = [],
  activo = true,
  tamano = 64,
  recordarCierreId = undefined,
  demoraInicialMs = undefined,
  className = '',
  AvatarComponent = null,
  nombreCompai = undefined,
  soloPosicion = false,
  onPosicionChange = undefined,
  variar = undefined,
  resolverPuesto = undefined,
  onCerrar = undefined,
}) {
  const [avatarType] = useAgentAvatarType();
  const especie = avatarType === 'angelita' ? 'abeja-angelita' : avatarType;
  const nombreElegido = nombreCompai || AVATAR_NOMBRE[avatarType] || AVATAR_NOMBRE[DEFAULT_AVATAR_TYPE];
  const AvatarActivo = AvatarComponent || ChagraAgentAvatar;
  const guia = useAngelitaGuia(paradas, { activo, tamano, recordarCierreId, demoraInicialMs, variar, resolverPuesto });

  useEffect(() => {
    onPosicionChange?.(guia.posicion, guia.parada);
  }, [onPosicionChange, guia.posicion, guia.parada]);

  if (!guia.parada || soloPosicion) return null;

  const estiloFlotador = {
    '--ang-guia-x': `${guia.posicion?.x ?? 0}px`,
    '--ang-guia-y': `${guia.posicion?.y ?? 0}px`,
  };
  const cerrar = () => {
    guia.cerrar();
    onCerrar?.();
  };
  const avanzar = guia.esUltima ? cerrar : guia.siguiente;

  return (
    <>
      <div
        className={`ang-guia ${className}`.trim()}
        style={estiloFlotador}
        data-ang-quieta={guia.quieta ? '1' : undefined}
        data-ang-vista={guia.enVista ? '1' : '0'}
        data-ang-parada={guia.parada.id}
        hidden={!guia.visible}
      >
        <button
          type="button"
          className="ang-guia__cuerpo"
          onClick={avanzar}
            aria-label={guia.esUltima ? `${nombreElegido}: cerrar la guía` : `${nombreElegido}: ver lo siguiente`}
          >
          <AvatarActivo
            estado={guia.parada.gesto}
            direccion={guia.direccion}
            size={guia.tamano}
            ariaLabel={nombreElegido}
            title={nombreElegido}
            especie={avatarType}
            data-creature={especie}
          />
        </button>
      </div>

      {guia.visible && (
        <div className="ang-guia__panel" role="group" aria-label={`Guía de ${nombreElegido}`}>
          <BurbujaAngelita
            mensaje={guia.parada.texto}
            tipo={guia.parada.tipo}
            className="ang-guia__burbuja"
            permiteEscucha
          />
          <div className="ang-guia__nav">
            {guia.total > 1 && (
              <span className="ang-guia__paso" aria-hidden="true">
                {guia.indice + 1}/{guia.total}
              </span>
            )}
            {!guia.esPrimera && (
              <button type="button" className="ang-guia__btn" onClick={guia.anterior}>
                ← Atrás
              </button>
            )}
            <button type="button" className="ang-guia__btn ang-guia__btn--principal" onClick={avanzar}>
              {guia.esUltima ? 'Entendido' : 'Siguiente →'}
            </button>
            <button
              type="button"
              className="ang-guia__cerrar"
              aria-label={`Cerrar la guía de ${nombreElegido}`}
              onClick={cerrar}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default AngelitaGuia;
