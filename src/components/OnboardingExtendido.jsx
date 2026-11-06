import React, { useMemo, useState } from 'react';
import OnboardingDescenso from './onboardingDescenso/OnboardingDescenso';
import LotesAnimales from './animales/LotesAnimales';
import SpeciesSelect from './SpeciesSelect';
import useAssetStore from '../store/useAssetStore';
import { newId } from '../utils/id';
import { buildPlantMeta, formatPlantMetaFallbackLine } from '../utils/plantMeta';
import { MSG } from '../config/messages.js';
import {
  cambiarPasoExtendido,
  completarPasoExtendido,
  iniciarRecorridoExtendido,
  leerRecorridoExtendido,
  limpiarRecorridoExtendido,
  posponerRecorridoExtendido,
} from '../services/onboardingExtendidoService';
import './onboardingExtendido.css';

const fechaLocal = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

function PlantaEnRecorrido({ initialData, onSaved }) {
  const addAsset = useAssetStore((state) => state.addAsset);
  const lands = useAssetStore((state) => state.lands);
  const [name, setName] = useState('');
  const [speciesId, setSpeciesId] = useState(null);
  const [landId, setLandId] = useState('');
  const [date, setDate] = useState(initialData?.fechaGerminacion || fechaLocal());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const landOptions = useMemo(() => lands.filter((land) => land?.id), [lands]);

  const guardar = async (event) => {
    event.preventDefault();
    if (busy || !name.trim() || !date) return;
    setBusy(true);
    setError('');
    const id = newId();
    const logId = newId();
    const land = landOptions.find((item) => item.id === landId);
    const relationships = land ? {
      location: { data: [{ type: 'asset--land', id: land.id }] },
      parent: { data: [{ type: 'asset--land', id: land.id }] },
    } : undefined;
    const meta = buildPlantMeta({ fechaGerminacion: date });
    /** @type {Record<string, unknown>} */
    const attributes = {
      name: name.trim(),
      status: 'active',
      ...(speciesId ? { _speciesSlug: speciesId } : {}),
      ...(meta ? { _chagra_plant_meta: meta } : {}),
    };
    const notes = formatPlantMetaFallbackLine(meta);
    if (notes) attributes.notes = notes;
    const asset = {
      id,
      type: 'asset--plant',
      attributes,
      ...(relationships ? { relationships } : {}),
      _pending: true,
    _pendingReason: navigator.onLine ? 'sync_error' : 'no_network',
      _createdAt: Date.now(),
    };
    const seedingPayload = {
      data: {
        type: 'log--seeding',
        id: logId,
        attributes: {
          name: `Siembra: ${name.trim()}`,
          timestamp: Math.floor(Date.now() / 1000),
          status: 'done',
          notes: { value: `Registro de siembra para ${name.trim()}` },
        },
        relationships: {
          asset: { data: [{ type: 'asset--plant', id }] },
          ...(land ? { location: { data: [{ type: 'asset--land', id: land.id }] } } : {}),
          quantity: {
            data: [{
              type: 'quantity--standard',
              // Rótulo guardado en el log de farmOS, no copia de UI; mismo literal en AssetsDashboard.jsx.
              // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish
              attributes: { measure: 'count', value: { decimal: '1' }, label: 'Plantas sembradas' },
            }],
          },
        },
      },
    };
    try {
      await addAsset('plant', asset, [
        { id, type: 'asset_plant', endpoint: '/api/asset/plant', payload: { data: { type: 'asset--plant', id, attributes, ...(relationships ? { relationships } : {}) } }, method: 'POST' },
        { id: logId, type: 'seeding', endpoint: '/api/log/seeding', payload: seedingPayload, method: 'POST' },
      ]);
      onSaved();
    } catch (_) {
      setError('No pudimos guardar la planta en este equipo. Intente de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="onbe-planta-form" onSubmit={guardar} data-testid="onbe-form-planta">
      <div className="onbe-campo-planta">
        <span>Especie</span>
        <SpeciesSelect
          onboardingExtendido
          value={name}
          onChange={(nextName, nextSpeciesId) => { setName(nextName); setSpeciesId(nextSpeciesId || null); }}
        />
      </div>
      <label className="onbe-campo-planta" htmlFor="onbe-lugar-planta">Lugar</label>
      <select id="onbe-lugar-planta" value={landId} onChange={(event) => setLandId(event.target.value)} data-testid="onbe-lugar">
        <option value="">Sin zona por ahora</option>
        {landOptions.map((land) => <option key={land.id} value={land.id}>{land.attributes?.name || land.name || 'Zona'}</option>)}
      </select>
      <label className="onbe-campo-planta" htmlFor="onbe-fecha-planta">Fecha de siembra</label>
      <input id="onbe-fecha-planta" type="date" value={date} onChange={(event) => setDate(event.target.value)} required data-testid="onbe-fecha" />
      {error ? <p role="alert" className="onbe-error">{error}</p> : null}
      <button className="onbj-btn onbj-primario" type="submit" disabled={busy || !name.trim()} data-testid="onbe-guardar-planta">
        {busy ? MSG.ui.guardando : MSG.ui.guardarPlanta}
      </button>
    </form>
  );
}

export default function OnboardingExtendido({ onNavigate, onHome }) {
  const [recorrido, setRecorrido] = useState(leerRecorridoExtendido);
  const pasos = useMemo(() => [
    'offer',
    ...(recorrido?.pasos?.animal ?? Boolean(recorrido?.animal) ? ['animal'] : []),
    ...(recorrido?.pasos?.planta ?? Boolean(recorrido?.planta) ? ['planta'] : []),
    'close',
  ], [recorrido]);
  const currentIndex = Math.max(0, pasos.indexOf(recorrido?.current || 'offer'));

  const salir = () => {
    if (onHome) onHome();
    else onNavigate?.('dashboard');
  };
  const posponer = () => {
    setRecorrido(posponerRecorridoExtendido());
    salir();
  };
  const comenzar = () => setRecorrido(iniciarRecorridoExtendido());
  const cambiar = (step) => setRecorrido(cambiarPasoExtendido(step));
  const retroceder = () => {
    if (currentIndex === 0) {
      salir();
      return;
    }
    cambiar(pasos[currentIndex - 1]);
  };
  const terminarAnimal = () => setRecorrido(completarPasoExtendido('animal', { keepOpen: true }));
  const terminarPlanta = () => setRecorrido(completarPasoExtendido('planta', { keepOpen: true }));
  const cerrar = () => {
    limpiarRecorridoExtendido();
    setRecorrido(null);
    salir();
  };

  if (!recorrido) {
    return <main className="onbj"><section className="onbj-panel"><p>No hay un primer registro pendiente.</p><button type="button" className="onbj-btn onbj-primario" onClick={salir}>Ir al inicio</button></section></main>;
  }

  const textByStep = {
    offer: 'Le acompaño a dejar listos sus primeros registros. Seguimos en el mismo descenso.',
    animal: 'Empecemos con los datos que ya nos contó. Puede corregirlos antes de guardar.',
    planta: recorrido.planta
      ? 'Ahora dejemos registrada una planta con su especie, el lugar y la fecha de siembra.'
      : 'La planta ya quedó registrada. Si quiere, puede volver a revisar el cierre.',
    close: 'Ya quedó el primer tramo de su finca. Su compai le acompaña a dar el siguiente paso.',
  };
  const titles = { offer: 'Su primer registro', animal: 'Primer lote', planta: 'Primera planta', close: 'Recorrido listo' };
  // C11 (auditoría de producto, 2026-10-31): la numeración va por lo que SÍ se ofrece,
  // nunca por el slot fijo ('animal'=01, 'planta'=02); sin animales la lista
  // arrancaba en «02».
  const pasosOfrecimiento = [
    recorrido.animal ? { key: 'animal', titulo: 'Un lote de animales', detalle: `${recorrido.animal.species || 'Especie por elegir'}${recorrido.animal.count ? ` · ${recorrido.animal.count} animales` : ''}` } : null,
    recorrido.planta ? { key: 'planta', titulo: 'Una planta', detalle: 'Con su especie, lugar y fecha de siembra' } : null,
  ].filter(Boolean);

  return (
    <OnboardingDescenso
      extendido={{
        recorrido,
        current: recorrido.current,
        texto: textByStep[recorrido.current],
        titulo: titles[recorrido.current],
        pasos,
        index: currentIndex,
        total: pasos.length,
        onBack: retroceder,
        onAhoraNo: posponer,
      }}
    >
      {recorrido.current === 'offer' ? (
        <section data-testid="onbe-ofrecimiento">
          <h1 className="onbe-titulo-paso">¿Lo hacemos juntos?</h1>
          <p className="onbe-intro-descenso">Estos son los registros para que su finca empiece con historia:</p>
          <ul className="onbe-pasos-lista">
            {pasosOfrecimiento.map((item, i) => (
              <li key={item.key}><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><div><strong>{item.titulo}</strong><small>{item.detalle}</small></div></li>
            ))}
          </ul>
          <div className="onbe-cta-descenso">
            <button type="button" className="onbj-btn onbj-primario" onClick={comenzar} data-testid="onbe-comenzar">Continuar con el recorrido</button>
          </div>
        </section>
      ) : null}

      {recorrido.current === 'animal' ? (
        recorrido.animal ? (
          <section data-testid="onbe-formulario-animal">
            <LotesAnimales initialLot={recorrido.animal} onLotCreated={terminarAnimal} onboardingExtendido />
          </section>
        ) : (
          <section data-testid="onbe-resumen-animal">
            <p role="status">El lote ya quedó guardado.</p>
            <button type="button" className="onbj-btn onbj-primario" onClick={() => cambiar(recorrido.planta ? 'planta' : 'close')}>Continuar</button>
          </section>
        )
      ) : null}

      {recorrido.current === 'planta' ? (
        recorrido.planta ? (
          <section data-testid="onbe-formulario-planta"><PlantaEnRecorrido initialData={{ fechaGerminacion: fechaLocal() }} onSaved={terminarPlanta} /></section>
        ) : (
          <section data-testid="onbe-resumen-planta">
            <p role="status">La planta ya quedó registrada.</p>
            <button type="button" className="onbj-btn onbj-primario" onClick={() => cambiar('close')}>Ver cierre</button>
          </section>
        )
      ) : null}

      {recorrido.current === 'close' ? (
        <section className="onbe-cierre-descenso" data-testid="onbe-cierre">
          <h1 className="onbe-titulo-paso">¡Listo, ya comenzó!</h1>
          <p>Sus registros quedaron guardados en este equipo. Su compai sigue con usted en la finca.</p>
          <button type="button" className="onbj-btn onbj-primario" onClick={cerrar} data-testid="onbe-entrar-finca">Entrar a mi finca</button>
        </section>
      ) : null}
    </OnboardingDescenso>
  );
}
