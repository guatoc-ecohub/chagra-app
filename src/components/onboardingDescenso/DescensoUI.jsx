import React, { useEffect, useState } from 'react';
import IconoTinta from './IconosTinta';

/** Diálogo compartido por los pasos del descenso y su continuación extendida. */
export function Dice({ texto, quien, reducir }) {
  const [n, setN] = useState(reducir ? texto.length : 0);
  useEffect(() => {
    if (reducir) return undefined;
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setN(i);
      if (i >= texto.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [texto, reducir]);
  return (
    <p className="onbj-dice" onClick={() => setN(texto.length)} data-testid="onbj-dice">
      {quien ? <span className="onbj-quien">{quien}</span> : null}
      <span aria-hidden="true">{texto.slice(0, n)}</span>
      <span aria-hidden="true" className="onbj-dice-resto">{texto.slice(n)}</span>
      <span className="onbj-sr" aria-live="polite">{texto}</span>
    </p>
  );
}

export function Tarjetas({ opciones, valor, onElegir, testId, iconoDe = (o) => <IconoTinta nombre={o.id} /> }) {
  return (
    <div className="onbj-tarjetas" role="radiogroup" data-testid={testId}>
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valor === o.id}
          className={`onbj-tarjeta ${valor === o.id ? 'es-elegida' : ''}`}
          onClick={() => onElegir(o.id)}
          data-testid={`${testId}-${o.id}`}
        >
          <span className="onbj-tarjeta-icono">{iconoDe(o)}</span>
          <span className="onbj-tarjeta-titulo">{o.titulo}</span>
          {o.copy ? <span className="onbj-tarjeta-copy">{o.copy}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function TarjetasMultiples({ opciones, valores, onCambiar, testId }) {
  return (
    <div className="onbj-tarjetas" data-testid={testId}>
      {opciones.map((o) => (
        <button key={o.id} type="button" aria-pressed={valores.includes(o.id)}
          className={`onbj-tarjeta ${valores.includes(o.id) ? 'es-elegida' : ''}`}
          onClick={() => onCambiar(o.id)} data-testid={`${testId}-${o.id}`}>
          <span className="onbj-tarjeta-icono"><IconoTinta nombre={o.id} /></span>
          <span className="onbj-tarjeta-titulo">{o.titulo}</span>
          {o.copy ? <span className="onbj-tarjeta-copy">{o.copy}</span> : null}
        </button>
      ))}
    </div>
  );
}
