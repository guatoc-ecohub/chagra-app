import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getProfile, getProfileMunicipio } from '../services/userProfileService.js';
import useDescensoLeccion from '../hooks/useDescensoLeccion.js';
import DescensoLeccion from './DescensoLeccion.jsx';
import { ArrowLeft, ArrowDown, X } from 'lucide-react';
import { guardarPorConfirmar } from '../services/goteoDiseno.js';

const DESCENSOS = {
  aromaticas: { titulo: 'Las aromáticas', ruta: '/descensos/aromaticas/index.html' },
  'control-biologico': { titulo: 'El control biológico', ruta: '/descensos/control-biologico/index.html' },
  'frijol-nodulo': { titulo: 'El fríjol y el nitrógeno', ruta: '/descensos/frijol-nodulo/index.html' },
  'bayas': { titulo: 'Las bayas', ruta: '/descensos/bayas/index.html' },
  'aguacate': { titulo: 'El aguacate', ruta: '/descensos/aguacate/index.html' },
  'citricos-hlb': { titulo: 'Los cítricos y el HLB', ruta: '/descensos/citricos-hlb/index.html' },
  'pasifloras': { titulo: 'Las pasifloras', ruta: '/descensos/pasifloras/index.html' },
  'platano': { titulo: 'El plátano y el banano', ruta: '/descensos/platano/index.html' },
  'ovinos-carne': { titulo: 'Los ovinos de carne', ruta: '/descensos/ovinos-carne/index.html' },
  'lombricompost': { titulo: 'El lombricompost', ruta: '/descensos/lombricompost/index.html' },
  'biodigestor': { titulo: 'El biodigestor', ruta: '/descensos/biodigestor/index.html' },
  'arvenses': { titulo: 'Las arvenses', ruta: '/descensos/arvenses/index.html' },
  'micorrizas': { titulo: 'Las micorrizas', ruta: '/descensos/micorrizas/index.html' },
  'erosion-ladera': { titulo: 'La erosión en ladera', ruta: '/descensos/erosion-ladera/index.html' },
  'microorganismos': { titulo: 'Los microorganismos de montaña', ruta: '/descensos/microorganismos/index.html' },
  'cuyes-conejos': { titulo: 'Los cuyes y conejos', ruta: '/descensos/cuyes-conejos/index.html' },
  'forrajes': { titulo: 'Los forrajes', ruta: '/descensos/forrajes/index.html' },
  'helada': { titulo: 'La helada', ruta: '/descensos/helada/index.html' },
  'riego-goteo': { titulo: 'El riego por goteo', ruta: '/descensos/riego-goteo/index.html' },
  'goteo-invernadero': { titulo: 'El goteo en el invernadero', ruta: '/descensos/goteo-invernadero/index.html' },
  'goteo-en-casa': { titulo: 'El goteo en la casa', ruta: '/descensos/goteo-en-casa/index.html' },
  'goteo-bomba-solar': { titulo: 'El goteo con bomba solar', ruta: '/descensos/goteo-bomba-solar/index.html' },
  'yuca': { titulo: 'La yuca', ruta: '/descensos/yuca/index.html' },
  'tuberculos-andinos': { titulo: 'Los tubérculos andinos', ruta: '/descensos/tuberculos-andinos/index.html' },
  'maiz-cogollero': { titulo: 'El maíz y el gusano cogollero', ruta: '/descensos/maiz-cogollero/index.html' },

  agua: { titulo: 'El agua de la finca', ruta: '/descensos/agua/index.html' },
  suelo: { titulo: 'La vida del suelo', ruta: '/descensos/suelo/index.html' },
  roya: { titulo: 'La roya del café', ruta: '/descensos/roya/index.html' },
  compost: { titulo: 'El compost', ruta: '/descensos/compost/index.html' },
  leche: { titulo: 'El mundo de la leche', ruta: '/descensos/leche/index.html' },
  silvopastoreo: { titulo: 'El silvopastoreo', ruta: '/descensos/silvopastoreo/index.html' },
  'ciclo-anio': { titulo: 'El año de la finca', ruta: '/descensos/ciclo-anio/index.html' },
  cacao: { titulo: 'El cacao', ruta: '/descensos/cacao/index.html' },
  cana: { titulo: 'La caña y la panela', ruta: '/descensos/cana/index.html' },
  restauracion: { titulo: 'La restauración', ruta: '/descensos/restauracion/index.html' },
  semilla: { titulo: 'La semilla', ruta: '/descensos/semilla/index.html' },
  abejas: { titulo: 'Las abejas', ruta: '/descensos/abejas/index.html' },
  poscosecha: { titulo: 'La poscosecha', ruta: '/descensos/poscosecha/index.html' },
  biopreparados: { titulo: 'Los biopreparados', ruta: '/descensos/biopreparados/index.html' },
  cerdos: { titulo: 'Los cerdos', ruta: '/descensos/cerdos/index.html' },
  gallinas: { titulo: 'Las gallinas', ruta: '/descensos/gallinas/index.html' },
  'tomate-invernadero': { titulo: 'El tomate bajo invernadero', ruta: '/descensos/tomate-invernadero/index.html' },
  papa: { titulo: 'La papa', ruta: '/descensos/papa/index.html' },
  paramo: { titulo: 'El páramo y el agua', ruta: '/descensos/paramo/index.html' },
  'cafe-exportacion': { titulo: 'El café, taza y exportación', ruta: '/descensos/cafe-exportacion/index.html' },
  'olor-corrales': { titulo: 'El olor de los corrales', ruta: '/descensos/olor-corrales/index.html' },
  'peces': { titulo: 'Los peces', ruta: '/descensos/peces/index.html' },
  'hortalizas': { titulo: 'Las hortalizas', ruta: '/descensos/hortalizas/index.html' },
};

const VISTAS_PERMITIDAS = {
  descenso_leche: 'leche',
};

function descensoSrc(slug, ruta) {
  if (slug !== 'silvopastoreo' && slug !== 'leche') return ruta;
  const perfil = getProfile();
  const params = new URLSearchParams();
  for (const [nombre, valor] of [
    ['alt', perfil.finca_altitud], ['municipio', getProfileMunicipio()],
    ['lat', perfil.ubicacion_lat], ['lon', perfil.ubicacion_lng],
  ]) {
    if (valor != null && String(valor).trim() !== '') params.set(nombre, String(valor));
  }
  const query = params.toString();
  return query ? `${ruta}?${query}` : ruta;
}

// Un mundo del goteo pide guardar su diseño: por defecto se deja por
// confirmar y se abre «Mi goteo», que lo valida y lo muestra antes de guardar.
function irAMiGoteo(d) {
  guardarPorConfirmar(d);
  window.dispatchEvent(new CustomEvent('chagra:nav', { detail: 'mi_goteo' }));
}

export function DescensoOverlay({ slug, onClose, src: srcInicial = null, onGoteo = null }) {
  const iframeRef = useRef(null);
  const [activo, setActivo] = useState(slug);
  const leccion = useDescensoLeccion(iframeRef, activo);
  const [src, setSrc] = useState(() => srcInicial || descensoSrc(slug, DESCENSOS[slug]?.ruta));
  const alGoteo = useRef(onGoteo);
  const alCerrar = useRef(onClose);
  useEffect(() => { alGoteo.current = onGoteo; alCerrar.current = onClose; });
  useEffect(() => {
    if (!DESCENSOS[slug]) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [slug]);
  useEffect(() => {
    function recibirNavegacion(event) {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (data && data.tipo === 'chagra:goteo-guardar' && data.v === 1) {
        // Solo un texto: goteoDiseno lo valida entero antes de mostrar nada.
        if (typeof data.d !== 'string' || data.d.length > 16000) return;
        (alGoteo.current || irAMiGoteo)(data.d);
        alCerrar.current?.();
        return;
      }
      if (!data || data.tipo !== 'chagra:navegar' ||
          !Object.hasOwn(VISTAS_PERMITIDAS, data.vista)) return;
      const destino = VISTAS_PERMITIDAS[data.vista];
      setActivo(destino);
      setSrc(descensoSrc(destino, DESCENSOS[destino].ruta));
    }
    window.addEventListener('message', recibirNavegacion);
    return () => window.removeEventListener('message', recibirNavegacion);
  }, []);
  const descenso = DESCENSOS[activo];
  if (!descenso) return null;

  return createPortal(
    <section
      className="fixed inset-0 z-[100] bg-slate-950"
      aria-label={descenso.titulo}
      aria-modal="true"
      role="dialog"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-10 border-b border-white/10 bg-slate-950/95 backdrop-blur"
        style={{ height: 'calc(env(safe-area-inset-top, 0px) + 56px)' }}
      />
      <iframe
        className="absolute inset-x-0 bottom-0 w-full border-0"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 56px)',
          height: 'calc(100% - env(safe-area-inset-top, 0px) - 56px)',
        }}
        onLoad={leccion.cargar}
        ref={iframeRef}
        src={src}
        title={descenso.titulo}
        allow="fullscreen"
      />
      {leccion.pagina && <DescensoLeccion pagina={leccion.pagina} entrada={leccion.entrada}
        enviar={leccion.enviar} iframeRef={iframeRef} />}
      <button
        type="button"
        onClick={onClose}
        aria-label="Volver a la pantalla anterior"
        className="absolute left-[max(12px,env(safe-area-inset-left))] top-[max(6px,env(safe-area-inset-top))] z-20 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-slate-950/85 px-4 text-sm font-bold text-white shadow-lg backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <ArrowLeft size={18} aria-hidden="true" /> Volver
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar la lección"
        className="absolute right-[max(12px,env(safe-area-inset-right))] top-[max(6px,env(safe-area-inset-top))] z-20 grid min-h-11 min-w-11 place-items-center rounded-full border border-white/25 bg-slate-950/85 text-white shadow-lg backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </section>,
    document.body,
  );
}

export default function DescensoLaunch({ slug, compact = false, label: _label = null, onGoteo = null }) {
  const [abierto, setAbierto] = useState(false);
  const descenso = DESCENSOS[slug];
  if (!descenso) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Ver la lección: ${descenso.titulo}`}
        title={`Ver la lección: ${descenso.titulo}`}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-700/60 bg-emerald-950/50 px-4 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-900/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 ${compact ? 'w-auto' : 'w-full'}`}
      >
        <ArrowDown size={17} aria-hidden="true" />
        Ver la lección
      </button>
      {abierto && <DescensoOverlay slug={slug} onGoteo={onGoteo} onClose={() => setAbierto(false)} />}
    </>
  );
}
