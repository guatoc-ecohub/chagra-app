# Ventana de la luciérnaga

Vista independiente: `VentanaLuciernaga.jsx`. No modifica `AgentScreen.jsx`.

Para abrirla con el servidor de desarrollo existente:
`/src/components/voz/luciernaga.html`.

Acepta `messages`, `isStreaming`, `streamingContent` y `lamina`, igual que la
ventana de referencia. La lámina ocupa una superficie separada del cuaderno.
El cuaderno abre por defecto. La recuperación de conversación es una lectura
explícita del historial local del operador actual; esta ventana no escribe
Assets ni Logs.

La cámara es una vista local de hasta 640 × 480 como resolución ideal. El
micrófono mueve un medidor a partir de muestras reales. No hay grabación,
transcripción, análisis de imagen ni envío de preguntas. La lectura requiere
una voz local instalada en español. Los cuatro momentos están rotulados como
un ejemplo. El estado de hablar comienza cuando empieza el audio.

El entorno usa SVG y CSS, sin WebGL ni texturas descargadas. Un único reloj
`requestAnimationFrame` actualiza los atributos del cuerpo, el foco y el reflejo,
sin estado de React por cuadro. El recorrido dura 28 segundos: arranques cortos,
cambios de dirección, suspensiones, posadas en hoja, tallo y borde, y tramos con
el órgano apagado. El cuerpo original permanece montado.

La máscara radial sigue el centro del abdomen incluso al inclinar el cuerpo.
Solo revela las superficies cercanas; el reflejo sigue su posición horizontal
y pierde intensidad con la altura. El órgano, su halo y las superficies reciben
la misma intensidad. Las alas se abren en vuelo y se recogen al posarse.

En pantallas menores de 760 px, las distancias horizontales se reducen al 58%
sin cambiar los tiempos. El saludo y la muestra de medios ocupan filas fuera
del paisaje. En escritorio, el vuelo reserva la franja izquierda para ellos.
Pausar congela posición e iluminación; reanudar conserva el tiempo transcurrido.
La pestaña oculta cancela el reloj. Movimiento reducido mantiene una posada
iluminada y estática, también si la preferencia cambia con la página abierta.

Las piezas compartidas de medios y conversación se recuperaron de la rama de
referencia porque aún no estaban en `origin/main`. No se importó su CSS de
composición. `ConversacionVoz` conserva su nombre por defecto y acepta
`nombreCompai` para esta ventana.

Verificación sin navegador: pruebas unitarias de permisos, cancelación tardía,
liberación de medios, lectura, historial, advertencias, streaming y montaje
estable del cuerpo; ESLint y compilación de la entrada independiente. Las
pruebas del vuelo muestrean los primeros quince segundos en ambos tamaños,
comprueban varios desplazamientos, apagado con traslado, descansos, márgenes y
continuidad. Las pruebas del DOM verifican que cuerpo, foco y reflejo cambien,
que pausa y pestaña oculta congelen la escena, y que no queden cuadros pendientes
al desmontar. No se ha abierto navegador ni ejecutado Playwright.

Límites pendientes de revisión visual: legibilidad del cuerpo pequeño y de las
superficies oscuras en un teléfono real, recorte del paisaje en horizontal y
fluidez en equipos de poca memoria. El cuaderno bajo requiere más desplazamiento
para respuestas largas. La iluminación es una composición artística de capas,
no una simulación física; la boca acompaña la lectura sin sincronizar fonemas.

Limitaciones del vuelo: el recorrido se repite cada 28 segundos y las posadas
usan puntos dibujados, sin detección física de contacto. El brillo, el aspecto
del batido de alas y el encuadre requieren revisión con capturas del dispositivo.
En móvil, separar texto y medios puede aumentar el desplazamiento vertical.
