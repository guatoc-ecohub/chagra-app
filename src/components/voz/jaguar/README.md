# El jaguar en la orilla

Entrada: `/src/components/voz/jaguar.html` (entrada `vozJaguar` del build, emitida como `dist/src/components/voz/jaguar.html`), sin sesión. La guacamaya permanece en `/src/components/voz/voz.html` (entrada `vozChagra`).

El cuerpo es `src/visual/creatures/JaguarCompai.jsx`, con curvas escritas a mano. Se importa directamente, sin pasar por el registro que todavía asigna el auto-trazado al valle. No encontré una razón para sustituir este cuerpo: ya dispone de columna, atlas, orejas, pupilas, mandíbula y cola articuladas. El dibujo compartido permanece intacto.

La conducta sigue `src/compai/jaguarConducta.js`: presencia silenciosa, atención contenida y parpadeo lento de ambos ojos. No hay guiño ni voz espontánea. La escena importa el identificador de su gesto de confianza y dirige el cuerpo mediante CSS local; no ejecuta la fachada de conducta con datos de finca inventados.

## Para recorrer y capturar

- Al entrar: vigilancia baja, respiración lenta, cola con pausas y parpadeo de confianza. Bosque, río y roca ocupan el espacio entre planos de vegetación.
- **Seguir un rastro**: el jaguar se inclina hacia la hoja; luz y fondo acercan la atención.
- **Escucho**: cabeza y orejas arriba, cola quieta, ondas sobre el agua.
- **Pienso**: mirada baja, cabeza inclinada, respiración más lenta; el fondo pierde luz mientras se unen las pistas.
- **Hablo**: aparece la respuesta escrita. **Oír el ejemplo** inicia la lectura local. La mandíbula y el énfasis de cabeza solo se activan al comenzar el audio, y se apagan con su finalización o cancelación.
- Los cuatro momentos se eligen directamente o con **Siguiente momento**. El recorrido es manual.
- El sol cambia a luz de amanecer. La pausa y la preferencia de movimiento reducido detienen el movimiento ambiental, conservando las posturas.

## Capacidades conservadas

Comparte `useMediosVoz` con la guacamaya: cámara local, medidor de micrófono, voz instalada en español, errores de permiso, cancelación de solicitudes tardías y liberación de recursos al ocultar o desmontar la página. No solicita permisos al entrar.

La amplitud real del micrófono actualiza una variable de la escena, sin renders por muestra. Modula luz y extensión de las ondas. El medidor sigue mostrando el nivel cuando se pausa la ambientación. Las ondas del ejemplo guiado son ilustrativas y están identificadas como ejemplo.

No graba, transcribe, guarda ni envía imagen o sonido. No hay inferencia de IA conectada; la hoja, el pensamiento y la respuesta son un guion visible. No se modifica persistencia ni estado de Assets/Logs.

## Verificación y defectos pendientes

Pruebas locales sin navegador:

```sh
npx vitest run src/components/voz/VentanaVoz.test.jsx src/components/voz/jaguar/VentanaJaguar.test.jsx src/visual/creatures/__tests__/JaguarCompai.test.jsx src/compai/__tests__/jaguarConducta.test.js --maxWorkers=1
npx eslint src/components/voz/jaguar src/components/voz/useMediosVoz.js src/App.jsx --max-warnings=0
npx vite build
npm run audit:bundle
```

La profundidad es una composición de planos con oclusión y atmósfera, sin geometría 3D ni cámara libre. La mandíbula lleva una cadencia expresiva, sin sincronización fonética. La voz depende del dispositivo y puede no estar disponible. En teléfonos la escena usa desplazamiento vertical para conservar el tamaño del cuerpo y los controles.

No se ha abierto navegador ni se han generado capturas. Falta verificar a ojo el apoyo de las patas sobre la roca, los solapes de vegetación y el contraste de amanecer en pantallas reales. Las pruebas de DOM no certifican esos aspectos.

La compilación completa pasó. La auditoría del bundle señala tres coincidencias preexistentes fuera de esta ventana: dos secuencias de coordenadas de un SVG que coinciden con el patrón de IP y una referencia en un comentario del service worker. Sus archivos de origen no difieren de `origin/main`; no se modificaron para esta entrega.
