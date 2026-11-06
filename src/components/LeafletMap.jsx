// SPDX-License-Identifier: AGPL-3.0-only
import { createContext, useContext, useEffect, useImperativeHandle, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** @type {import('react').Context<any>} */
const MapContext = createContext(null);
/** @type {import('react').Context<any>} */
const MarkerContext = createContext(null);

// The hook shares the imperative instance with the layer components.
// eslint-disable-next-line react-refresh/only-export-components
export function useLeafletMap() {
  return useContext(MapContext);
}

/** Leaflet owns the map DOM; React owns the popup content and callbacks. */
/** @param {{ center: number[], zoom: number, children?: import('react').ReactNode, className?: string, style?: import('react').CSSProperties, scrollWheelZoom?: boolean, attributionControl?: boolean }} props */
export function LeafletMap({ center, zoom, children, ...options }) {
  const [node, setNode] = useState(/** @type {HTMLDivElement | null} */ (null));
  const [map, setMap] = useState(/** @type {any} */ (null));
  // Leaflet's initial view/options stay fixed across parent renders.
  const [initial] = useState(() => ({ center, zoom, ...options }));
  useEffect(() => {
    if (!node) return;
    const { className: _class, style: _style, ...mapOptions } = initial;
    const instance = L.map(node, mapOptions);
    // Publish the imperative instance to child layers after mounting its DOM.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMap(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(node);
    return () => {
      observer.disconnect();
      instance.remove();
    };
  }, [node, initial]);
  return (
    <div ref={setNode} className={options.className} style={options.style}>
      <MapContext.Provider value={map}>{map ? children : null}</MapContext.Provider>
    </div>
  );
}

export function LeafletTileLayer({ url, ...options }) {
  const map = useLeafletMap();
  const [initial] = useState(() => options);
  useEffect(() => {
    const layer = L.tileLayer(url, initial).addTo(map);
    return () => { layer.remove(); };
  }, [map, url, initial]);
  return null;
}

/** @param {{ position: number[], icon?: any, draggable?: boolean, eventHandlers?: Record<string, any>, ref?: import('react').Ref<any>, children?: import('react').ReactNode }} props */
export function LeafletMarker({ position, icon, draggable = false, eventHandlers, ref, children }) {
  const map = useLeafletMap();
  const [marker] = useState(() => L.marker(position, { ...(icon ? { icon } : {}), draggable }));
  useImperativeHandle(ref, () => marker, [marker]);
  useEffect(() => {
    marker.addTo(map);
    return () => { marker.remove(); };
  }, [map, marker]);
  const [lat, lng] = position;
  useEffect(() => { marker.setLatLng([lat, lng]); }, [marker, lat, lng]);
  useEffect(() => { if (icon) marker.setIcon(icon); }, [marker, icon]);
  useEffect(() => {
    if (draggable) marker.dragging.enable();
    else marker.dragging.disable();
  }, [marker, draggable]);
  useEffect(() => {
    if (!eventHandlers) return;
    marker.on(eventHandlers);
    return () => { marker.off(eventHandlers); };
  }, [marker, eventHandlers]);
  return <MarkerContext.Provider value={marker}>{children}</MarkerContext.Provider>;
}

export function LeafletPopup({ children, ...options }) {
  const marker = useContext(MarkerContext);
  const [node] = useState(() => document.createElement('div'));
  const [initial] = useState(() => options);
  useEffect(() => {
    marker.bindPopup(node, initial);
    return () => { marker.unbindPopup(); };
  }, [marker, node, initial]);
  return createPortal(children, node);
}
