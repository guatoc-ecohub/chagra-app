# La guacamaya en el corredor

> **Desde 2026-09-24 la entrada `voz.html` ya no monta esta ventana.** Monta `VentanaGuacamaya`, la misma que abre la app para la guacamaya (conversación real, lienzo `GuacamayaViva`). Como esa página no tiene agente, deja la pregunta en el prefill que `AgentScreen` consume y sigue a `/#/agente`. `VentanaVoz` (este README) queda en el repo sin consumidor productivo; retirarla es una decisión aparte.

Entrada independiente original: `/src/components/voz/voz.html` (entrada `vozChagra` del build, emitida como `dist/src/components/voz/voz.html`). No requiere sesión. No cambia la pantalla de conversación existente.

El paisaje, la luz y la muestra responden al estado de atención. El traslado del ave tiene un reloj independiente que los estados no reinician. El dibujo se importa del rig original, sin editar sus archivos. Los identificadores y clases se aíslan por ventana. La actuación usa una hoja propia, sin depender de `:host`.

## Recorrido y capturas

1. Al entrar: presencia tranquila, saludo breve y pausas largas.
2. **Recorrer un ejemplo**: hoja ilustrada, atención hacia la mesa.
3. **Siguiente momento**: escucha de una frase de ejemplo, alas quietas.
4. **Siguiente momento**: pausa para unir pistas, mirada baja y luz recogida.
5. **Siguiente momento**: respuesta escrita. **Oír el ejemplo** intenta leerla con una voz local en español.

Los cuatro momentos también se pueden seleccionar directamente. El recorrido es manual: no hay cambios de escena inesperados mientras se lee o se toma una captura. **Sol / Noche** cambia la luz y el contraste. El control de pausa detiene las animaciones; la preferencia del sistema de movimiento reducido también se respeta.

## Conexiones reales

- **Mostrar una mata** pide permiso para mostrar video local. No reconoce plantas ni analiza imágenes.
- **Hablar con Chagra** pide permiso y mide amplitud del sonido. No graba ni transcribe.
- **Oír el ejemplo** requiere una voz local en español. El estado de habla comienza con el evento de inicio de audio y termina con su finalización, interrupción o error.
- No hay respuesta de IA conectada. El pensamiento y la respuesta del recorrido son un guion identificado en pantalla.

Los dispositivos se apagan al detener, cambiar de momento, ocultar la página o desmontar la ventana. Un permiso tardío no puede reabrir un dispositivo después de cancelar. Cámara y micrófono requieren un contexto seguro y soporte del navegador.

## Verificación y límites

Pruebas de comportamiento: `npx vitest run src/components/voz/VentanaVoz.test.jsx --maxWorkers=1`.

No se usa un motor 3D: la profundidad sale de planos, perspectiva y oclusión. El medidor actualiza el DOM como máximo unas doce veces por segundo y no provoca renders por muestra. El pico tiene una cadencia expresiva durante el audio, no sincronización fonética. La voz depende de lo instalado en el dispositivo y puede no estar disponible.

No se han abierto navegador ni herramientas de capturas para esta entrega. Falta revisar visualmente la composición en teléfonos reales, el sol directo y los permisos propios de cada navegador.

## Conversación dentro de la escena

El horizonte queda abierto entre las palabras a la izquierda, el ave en el centro y la lámina a la derecha. La lectura tiene altura acotada y fondo localizado, sin una página de papel que cubra media escena. La mesa vacía se reduce a una invitación. Hasta 900 px, el ave y la mesa comparten la columna derecha en filas separadas. Hasta 600 px, el corredor del ave ocupa una fila exclusiva de al menos 280 px; siguen la lectura y la lámina en filas distintas. Los turnos largos no hacen crecer el cuaderno.

- El recorrido incorpora progresivamente la pregunta y la respuesta al cuaderno. Volver al inicio no las borra. «Ejemplo con corrección» ofrece dos intercambios identificados como ejemplo.
- «Conversación guardada» lee hasta 100 turnos del operador actual mediante la memoria local existente. Es una acción explícita, sin red ni copia nueva persistida. Cambiar de operador oculta inmediatamente el historial anterior y descarta lecturas tardías. No se mezclan el ejemplo y la memoria.
- El cuaderno conserva todos los turnos recibidos. Tiene scroll propio, acceso al principio y al final, foco de teclado y aviso de palabras nuevas. Si la persona lee atrás, una actualización no desplaza su lectura. Las fuentes se abren en el mismo flujo.
- Cada respuesta terminada puede escucharse mediante un botón explícito, usando la voz local existente. La voz nunca arranca al recuperar mensajes.
- La ruta autónoma todavía no conecta transcripción ni generación de respuestas. La memoria permite releer conversaciones previas; no convierte la prueba de micrófono en una consulta real.

### Contrato de integración

`VentanaVoz` acepta `messages`, `isStreaming`, `streamingContent` y `lamina`. Los tres primeros usan la forma de los turnos de la conversación existente; no hay que transformar sus metadatos. Si se entrega `messages`, ese arreglo es la fuente visible y no aparecen los controles de recuperación ni los intercambios de demostración. La ventana no modifica los mensajes recibidos.

`ConversacionVoz` es presentación: conserva `role`, `content`, `timestamp`, `metadata`, `imageUrl`/`photo` y reconoce streaming y recuperación. Las advertencias no dependen de preferencias que oculten fuentes. Reutiliza el cálculo conservador del semáforo y el renderizador de texto existente. No modifica Assets, Logs ni esquemas de persistencia.

### Espacio reservado para las láminas

Punto de inserción: prop `lamina` (nodo renderizable) dentro de `[data-voz-slot="lamina"] > .voz-lamina-superficie`.

- Proporción **4:3**; ancho completo de la columna. La superficie contiene su propio desbordamiento y no crece encima del ave ni del cuaderno.
- Escritorio: hasta 300 px de ancho. Móvil: hasta 240 px en su fila propia. Son dimensiones orientativas del CSS, pendientes de captura real.
- SVG, imagen o canvas directos se ajustan a la superficie con `contain`. Un componente con envoltorio debe resolver su tamaño dentro del mismo rectángulo, sin portales ni elementos fijos.
- La cámara o el medidor ocupan temporalmente esa mesa al activarse; al detenerlos reaparece la lámina. El cuaderno permanece disponible.
- Una lámina densa requerirá su propio modo de ampliación, dentro del flujo de la página. Esta tarea reserva el espacio y no implementa ni selecciona láminas.

### Selección de salidas

| Salida existente | Tratamiento y motivo |
| --- | --- |
| Texto de la persona y del agente, formato, fecha/hora | En el cuaderno, sin recortar el historial recibido. |
| Incertidumbre, semáforo, confianza baja/media | Siempre visibles antes de la respuesta. No dependen solo del color. |
| Nombre científico inventado o sospechoso | Advertencia visible con los nombres afectados. |
| Dato de otro cultivo | Visible aunque coincida con otros avisos; impide mostrar respaldo verde. |
| Auto-corrección | Visible; explica que el texto mostrado ya incorpora el ajuste. No inventa una versión anterior. |
| Catálogo, consulta sin coincidencia y respuesta generativa | Resumidos en una señal conservadora de respaldo. El nombre técnico de la herramienta se omite porque no ayuda a decidir. |
| Fuente con enlace o referencia textual | Desplegable. Solo enlaces HTTP(S); nunca se inventa un enlace a una portada. |
| Procedencia por afirmación, revisión y coincidencia | Desplegable con un renglón por dato recibido. El porcentaje indica coincidencia, no probabilidad de que toda la respuesta sea cierta. |
| Foto del usuario (`imageUrl` o `photo`) | Miniatura dentro de su turno. Si llegan ambos campos, se usa `imageUrl`. La recuperación solo puede mostrar lo que la memoria existente conserve. |
| Voz | Botón visible para leer cada respuesta. Sin gesto oculto de doble clic ni reproducción automática. |
| Respuesta vacía, streaming y espera | Texto explícito, sin sellos definitivos para fragmentos incompletos. |
| Pregunta huérfana | Aviso conservado. Sin botón de reintento porque esta ventana no tiene envío conectado. |
| Tarjeta de investigación profunda | Aviso de que existe, más el texto del turno si llega. Se omiten informe especializado, progreso y cancelación: necesitan el controlador de investigación. |
| Insight proactivo, saludo con pendientes y enlaces de ayuda | Fuera: abren flujos de navegación y descarte que esta ventana autónoma no controla. El contenido normal de la respuesta se conserva. |
| Pasos de razonamiento/consulta | Fuera: no hay fases reales de consulta conectadas. Se muestra espera y actuación de pensar durante streaming, sin inventar pasos. |
| Feedback, consentimiento y sello beta repetido | Fuera: el feedback necesita su flujo de envío y consentimiento; el estado de respaldo visible aporta la información relevante para interpretar cada respuesta. |
| Avatar por turno, marcas de verificación duplicadas y retorno flotante | Fuera: la guacamaya ya está en la escena; la navegación del cuaderno ocupa su propia fila y no tapa palabras. |
| Láminas del agente | Se reserva la mesa. Su selección y renderizado corresponden a la tarea de dibujo. |

### Verificación y defectos conocidos de esta entrega

`npx vitest run src/components/voz --maxWorkers=1` verifica señales concurrentes, enlaces, texto/foto, streaming, desplazamiento, lectura explícita, recuperación aislada por operador, conservación del recorrido y ubicación estructural de la lámina. `npx eslint src/components/voz --max-warnings=0` valida el código.

Sin navegador ni capturas: falta confirmar contraste bajo sol, densidad del cuaderno, scroll con teclado móvil y separación visual real de mesa y ave. A 320 px la mesa sirve para una ilustración sencilla; el texto pequeño de una lámina compleja no será legible. La página es más larga en móvil. El historial se recupera a petición, no se actualiza en vivo desde otra pestaña, y la memoria existente no distingue fallo de lectura de historial vacío. No se añadió transcripción ni envío al agente.


## Pasada de composición: horizonte abierto

La rama ocupa el lateral alto en escritorio y la abertura izquierda en teléfono. Sus dos grupos de hojas tienen ciclos de 11 y 7,7 segundos, además del movimiento de la rama. La bruma conserva su desplazamiento amplio, con mayor contraste. Son elementos del paisaje, sin partículas añadidas. Las animaciones no dependen de que el cuaderno esté vacío. Pausa, pestaña oculta y movimiento reducido mantienen sus excepciones deliberadas.

### Secuencia visual pendiente

Sin abrir navegador ni herramientas de captura durante la implementación. Las pruebas de componentes validan comportamiento, no percepción de movimiento ni geometría renderizada. El gate visual todavía requiere esta secuencia del operador:

1. Mostrar el ejemplo con corrección y entrar al primer momento para tener conversación y dibujo simultáneos. Mantener ambos en uso durante al menos 60 segundos: desplazar el texto, abrir fuentes y volver al final.
2. Mirar la rama y las hojas fuera de la silueta del ave, y la bruma cruzando el horizonte. Deben seguir siendo perceptibles durante la lectura, sin cerrar la lámina.
3. Recorrer los cuatro momentos y repetir con Sol. Repetir en teléfono de 390 px y en escritorio, manteniendo conversación y lámina dentro del encuadre.
4. Abrir la cámara y luego el micrófono; comprobar que la mesa cambia de contenido, conserva su límite y no desplaza al ave. Pausar y reanudar para distinguir el movimiento del ambiente.

Defectos pendientes de juicio visual: la lámina pequeña exige desplazamiento para textos largos; no hay ampliación para dibujos densos. En teléfonos bajos o con texto ampliado la página puede requerir scroll. La bruma podría seguir siendo demasiado sutil en algunas pantallas. El gate de vida continua no se da por aprobado mediante pruebas unitarias.

## Traslados entre apoyos

Al entrar sin conversación, interacción ni pausa, el ave descansa 6,5 segundos. Sigue un traslado de 4 segundos con impulso, despegue, arco, frenado y aterrizaje. Entre vuelos descansa 7, 8 o 9,5 segundos. Las ramas están al 25 % y 75 % del corredor: su separación equivale a 1,09 anchos del ave (50/46), y se reduce en píxeles con el corredor. Los apoyos, alas y cola tienen una reserva exclusiva, con recorte de seguridad fuera del texto y de los controles. El vuelo no aumenta cámara ni ambiente.

El controlador muestrea el batido `guacaBatido` del rig canónico con el mismo reloj que cuerpo, patas y cola. No se suman `bob`, `cruza` ni los gestos de reposo al vuelo. La pausa, la pestaña oculta y el cambio a movimiento reducido congelan el recorrido, que continúa desde ese punto al reanudar. Con movimiento reducido desde la entrada permanece apoyada.

Conversación visible, escucha, habla, espera de respuesta, foco de escritura, puntero sobre lectura y selección de texto impiden el siguiente despegue. La interacción táctil o el desplazamiento reinician un descanso. Si empiezan durante un vuelo, este termina en su destino antes de quedarse posada, sin inversión ni salto. Se prefiere mantener el reposo mientras haya mensajes visibles porque no es posible detectar si alguien sigue leyendo sin interactuar.

Verificación sin navegador: `npx vitest run src/components/voz --maxWorkers=1`. Incluye cronología de los primeros quince segundos, cambios de estado, pausa en vuelo, preferencia dinámica, lectura/escritura, limpieza y cotas geométricas conservadoras. El juicio visual queda pendiente: grabar los primeros quince segundos a 320, 390 y 1280 px, y pausar durante despegue y frenado. Confirmar contacto de garras, orientación y ausencia de recortes; las pruebas del modelo no certifican esos detalles renderizados.

Defectos conocidos: el rig es frontal y su giro sigue siendo una aproximación bidimensional. El ave es menor para reservar las alas; en móvil la página se alarga y puede desplazar los controles bajo el primer encuadre. Solo hay dos apoyos, por lo que el destino alterna aunque los descansos varían.

### Anatomía durante el traslado

Las alas giran sobre `(0,0)` en sus montajes locales, dentro de `cuerpoRig`, con los hombros en `(-38,18)` y `(38,18)`. Los porcentajes del viewBox completo no representan esos pivotes. La cola conserva una longitud del 72 % del dibujo compartido en todas las fases; sus tres capas giran desde la raíz. El cambio es local a esta escena.

Las ramas ofrecen corteza bajo las garras y salen por los bordes del paisaje. Sus posiciones y el tamaño del ave proceden de las mismas constantes que usa el controlador. Se conservan el reloj, el batido, el arco y las pausas. Las pruebas de límites usan cotas separadas de alas, torso/cabeza y cola, sin contar las esquinas vacías del viewBox como plumaje.

Gate pendiente de captura real a 260 %: durante despegue y vuelo debe haber contacto continuo entre ambas alas y sus hombros. Un renderizado SVG aislado permite revisar la anatomía, pero no certifica la cascada CSS ni el resultado del navegador. Comprobar también garras sobre corteza y ausencia de recortes al aterrizar en ambos sentidos.
