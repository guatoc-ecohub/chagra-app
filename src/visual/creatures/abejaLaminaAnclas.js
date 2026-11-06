// Coordinates after the approved eye-group transform, in host SVG units.
// Eye, brow and head anchors are local to the head group: AbejaLamina scales
// that group about the neck, so accessories drawn inside it follow the head.
export const LAMINA_ANCLAS = Object.freeze({
  ojoGrande: { cx: -.92, cy: -4.248, rx: 1.02, ry: 1.581 },
  ojoPequeno: { cx: 2.13, cy: -4.5115, rx: .72, ry: 1.116 },
  cabeza: { cx: .15, cy: -4, r: 3.5 },
  tronco: { cx: -.2, cy: 1, rx: 3.2, ry: 3 },
  cejaGrande: 'translate(-.92 -4.248) scale(-.5 .65) translate(-10.1 1.9)',
  cejaPequena: 'translate(2.13 -4.5115) scale(-.5 .65) translate(-7.4 2.2)',
});

// Framing per drawing in the rig's 26.2 square, measured on the body with
// antennas and wings (nothing is cut): the bee fills its square and is centred.
export const ENCUADRE_ABEJA = Object.freeze({
  volar: 'scale(1.18) translate(-1.84 1.53)',
  decir: 'scale(1.03) translate(-.15 .3)',
});
