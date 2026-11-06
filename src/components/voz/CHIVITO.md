# Ventana del chivito de páramo

Entrada independiente: `src/components/voz/VentanaChivito.jsx`.
No modifica `AgentScreen.jsx` ni registra rutas de la aplicación.

Para verla con el servidor de desarrollo existente, abrir
`/src/components/voz/chivito.html`. No solicita permisos al entrar.

La ventana recibe `messages`, `isStreaming`, `streamingContent` y `lamina`.
El cuaderno comienza plegado. La cámara muestra video local y el micrófono
mide amplitud real; no hay grabación, transcripción ni análisis conectado.
La lectura usa una voz local en español, si el dispositivo dispone de ella.

Los cuatro momentos son un ejemplo explícito. La respuesta sobre el páramo
procede de `comentarioDeMundoChivito`. El cuerpo es `ChivitoPunkRig`, con
sus 116 nodos originales y sus grupos de montaje intactos. El CSS de esta
ventana aplica las poses en light DOM, con alcance `.paramo-chivito`.

La ruta tarda 40 segundos: descansa abajo, sube por un apoyo intermedio,
descansa arriba y baja por el mismo recorrido. Los puntos de apoyo son
coordenadas del mismo SVG que dibuja las rocas; no dependen del ancho de
la pantalla. Los pies canónicos están en y=143, a escala .48.

Pausa congela las animaciones CSS, el reloj SMIL y la pose del cuerpo;
reanudar no reinicia la trayectoria. Movimiento reducido también detiene
la escena. Ocultar la página cierra dispositivos y detiene el movimiento.

Verificación sin navegador:

```sh
npx vitest run src/components/voz/VentanaChivito.test.jsx --maxWorkers=1
npx eslint src/components/voz/*.jsx src/components/voz/*.js --max-warnings=0
```

Límites conocidos: la ruta se repite con cadencia fija, la niebla tiene un
costo de filtros SVG, y falta revisión visual en dispositivos reales.
Las pruebas de componentes verifican contratos y recursos; no miden
fotogramas, fluidez, contraste sobre niebla ni permisos de hardware reales.
