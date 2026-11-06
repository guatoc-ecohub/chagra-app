/**
 * Utilidades puras para EscuchaOverlay.
 * Se mantienen fuera del archivo del componente para no romper react-refresh.
 */
export function esIOSLike(userAgent = '') {
  return /iPad|iPhone|iPod/i.test(userAgent);
}

export function mensajeErrorMicrofono(err, userAgent = (typeof navigator !== 'undefined' ? navigator.userAgent : '')) {
  const porNombre = {
    NotFoundError: 'No encuentro un micrófono. Revise que su teléfono tenga uno conectado o escriba su pregunta en el chat.',
    NotAllowedError: 'No tengo permiso para usar el micrófono. Permítalo en los ajustes del navegador o escriba su pregunta en el chat.',
    SecurityError: 'El navegador no me deja usar el micrófono. Revise el permiso de este sitio o escriba su pregunta en el chat.',
    NotReadableError: 'El micrófono está ocupado. Cierre la otra aplicación que lo esté usando e intente de nuevo, o escriba en el chat.',
    OverconstrainedError: 'No pude configurar el micrófono. Revise que funcione y vuelva a intentarlo, o escriba su pregunta en el chat.',
    MediaDevicesUnavailableError: 'Este navegador no puede abrir el micrófono. Pruebe con un navegador actualizado y seguro, o escriba su pregunta en el chat.',
  };
  if (porNombre[err?.name]) {
    if (err.name === 'NotAllowedError' && esIOSLike(userAgent)) {
      return 'No tengo permiso para usar el micrófono. En iPhone, abra Ajustes, Safari, Micrófono y permita este sitio. También puede escribir en el chat.';
    }
    return porNombre[err.name];
  }
  return 'No pude iniciar el micrófono. Revise el permiso y que otra aplicación no lo esté usando, o escriba su pregunta en el chat.';
}
