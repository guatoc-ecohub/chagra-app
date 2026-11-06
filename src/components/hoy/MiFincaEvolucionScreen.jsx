import CaminoTransicion from './CaminoTransicion';

/** La ruta histórica se conserva y presenta el mismo camino medido de #hoy. */
export default function MiFincaEvolucionScreen(props) {
  return <CaminoTransicion {...props} standalone />;
}
