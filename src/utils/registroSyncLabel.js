/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Labels shared by the field notebook. */
export const registroSyncLabel = entry => entry?._syncFailed
  ? 'Anotado en el teléfono. No se pudo subir, reintentar'
  : entry?._pending || entry?.payload
    ? 'Anotado en el teléfono, pendiente de subir'
    : 'Subido';
