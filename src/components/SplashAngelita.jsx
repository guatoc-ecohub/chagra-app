import AbejaLamina from '../visual/creatures/AbejaLamina.jsx';

/**
 * SplashAngelita.jsx — Angelita en vuelo dentro del estado de carga.
 *
 * Dibuja la pose de vuelo en SVG y deja que el contenedor decida el fondo y
 * el espacio disponible. El rebote se apaga cuando se prefiere movimiento
 * reducido.
 */
export default function SplashAngelita() {
  return (
    <div className="flex flex-col items-center" data-testid="splash-angelita">
      <div className="motion-safe:animate-bounce" aria-hidden="true">
        {/* visema/tier en undefined: AbejaLamina los exige en su contrato pero
            aquí vuela sin hablar ni LOD — mismos valores que su default. */}
        <AbejaLamina size={64} animated pose="volar" title="" visema={undefined} tier={undefined} />
      </div>
      <div className="mt-4 text-emerald-400 text-xs font-bold tracking-[0.2em] uppercase">Chagra</div>
    </div>
  );
}
