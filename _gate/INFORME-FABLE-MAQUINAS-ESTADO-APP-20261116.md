# INFORME — máquinas de estado implícitas de chagra-app

- Encargo: `FABLE-MAQUINAS-ESTADO-APP-20261116`
- Rama: `audit/maquinas-estado-implicitas-20261116`, cortada de `origin/main` (`48aa5ab`)
- PR en borrador: #24. Sin merge y sin despliegue.

## Qué se entrega

| Commit | Qué |
|---|---|
| `2a1e027` | Máquina explícita para los tres botones de descarga (`useAccionConAviso`) + pruebas |
| `17e46e8` | Una sola fase para el botón de exportar copia + pruebas |
| `2c6c8d4` | `docs/maquinas-de-estado.md` (545 filas) y `scripts/verificar-maquinas-de-estado.mjs` |
| `6d095e8` | Capturas antes/después y salida cruda de `shot3d` |
| `ae2e338` | Arreglo de una prueba propia que expiraba con la máquina cargada |

## Decisiones

- **Explicitadas: 2 máquinas (4 componentes).** Son las únicas donde se demostró, con una prueba que falla en `main`, un camino real a un estado roto que la máquina cierra. Los caminos legales no cambian.
- **Dejadas con hallazgo: 2.** `NetworkStatusBar` (temporizador de error que oculta a destiempo; `syncing` sin salida cuando el lote termina con pendientes) y `AgentHero` (`phase` pasa a `sending` y nada la devuelve a `idle`). Arreglarlas cambia lo que se ve: piden decisión de producto y captura.
- **Dejadas: el resto**, con su razón en el documento.

## Lo que completé por mi cuenta (el encargo no lo decía)

- Interpreté «sin cambiar ningún comportamiento observable» como: los caminos legales quedan idénticos; lo único que cambia es lo que pasaba dentro del estado imposible. Si esa lectura es más amplia de lo querido, las dos explicitaciones se revierten con `git revert` de un commit cada una.
- Exigí un defecto alcanzable para contar «UX sube». Con esa vara `useGeolocation` se quedó fuera aunque mejoraba DX y AX.
- Añadí un script verificador del inventario, que el encargo no pedía.
- Los tres botones de descarga van en UN commit: son la misma máquina copiada tres veces.

## Mediciones

### Pruebas de comportamiento contra `main` (medición)

| Prueba | `main` sin el cambio | rama |
|---|---|---|
| `CuadernoPDFButton.comportamiento` | 5 de 5 | 5 de 5 |
| `BackupExportButton.comportamiento` | 4 de 4 | 4 de 4 |
| `CuadernoPDFButton.estadosImposibles` | falla 1 de 1 | pasa 1 de 1 |
| `BackupExportButton.estadosImposibles` | fallan 3 de 3 | pasan 3 de 3 |
| `useAccionConAviso` | no aplica | 8 de 8 |

Control de los medidores: las pruebas de estados imposibles fallan en `main` con el mensaje esperado (`expected ' Descargar cuaderno (PDF)' to contain 'Generando cuaderno…'`), así que sí distinguen. El verificador del inventario se corrió contra una copia con cuatro referencias alteradas y detectó las cuatro.

### `npm test`, `npm run lint`, `npm run build`

Corridos sobre árboles exportados con `git archive` (uno de `origin/main`, otro de la rama), mismas dependencias.

| | `main` (`48aa5ab`) | rama |
|---|---|---|
| `npm test` | 5 ficheros, 20 pruebas | 10 ficheros, 41 pruebas (las 20 de `main` + 21 nuevas) |
| `npm run lint` | 0 errores, 258 avisos | 0 errores, 258 avisos |
| `npm run build` | termina bien; `OFFLINE_SHELL_ASSETS: 367`, `audit-valle: 0` | termina bien; `OFFLINE_SHELL_ASSETS: 367`, `audit-valle: 0` |

`lint` y `build` de la rama se midieron en `6d095e8`; el commit posterior (`ae2e338`) solo toca un fichero de prueba, que pasa `eslint` por separado.

**`npm test` no es estable con la máquina cargada, en ninguno de los dos lados.** Corridas completas, con la carga del sistema entre 81 y 98 (otros trabajos en la misma máquina):

| Lado | Corridas completas | Verdes | Qué falló |
|---|---|---|---|
| `main` | 4 | 3 | `tokenStore.sinIndexedDB` › «password grant…», timeout de 5 s (1 vez) |
| rama, antes de `ae2e338` | 4 | 2 | la misma de `main` (2 veces) y una prueba NUEVA de este PR, también por timeout (1 vez) |
| rama, en `ae2e338` | 2 | 2 | nada — pero con carga 47–49, no ~90 |

Lectura honesta:
- La prueba `tokenStore.sinIndexedDB` es ajena a este cambio y falla por timeout en `main` también (además, sola: 1 de 3 en `main`, 0 de 3 en la rama). Con tan pocas corridas no se puede dar una tasa ni decir que un lado falle más que el otro.
- **Este PR introdujo una prueba sensible a la carga** (`useAccionConAviso` › «imposible: mensaje fuera de success/error»): hacía 3.905 `expect` en un bucle y expiró una vez. Se corrigió en `ae2e338` (una sola afirmación al final). Tras el arreglo pasó 5 de 5 sola y 2 de 2 en corrida completa, **pero con la carga ya en ~50**: no está demostrado que aguante a ~90.
- Con la máquina en calma (línea base inicial) `main` dio 20 de 20.

CI del PR: `build y audit` pasa, `gitleaks` pasa, `lint (informativo)` seguía en curso al escribir esto. CI no corre `npm test`.


### Capturas

`InformesScreen` y `BackupExportButton` aislados en un arnés (no versionado), en reposo, por `localhost`, contra `main` y contra la rama. Antes de capturar se comprobó por HTTP que cada puerto servía su árbol (la rama respondía con `useAccionConAviso`, `main` con `setResultMsg`).

- `_gate/maquinas-estado/informes-antes-main.png` y `informes-despues-rama.png`: idénticos byte a byte.
- `_gate/maquinas-estado/copia-antes-main.png` y `copia-despues-rama.png`: idénticos byte a byte.

Defectos y límites que veo en las capturas, por regiones:
- Arriba y abajo hay un rótulo del arnés («Arnés de captura…», «Fin del arnés.») que no existe en la app.
- En Informes el botón «Descargar cuaderno (PDF)» se ve sin fondo, mientras «Descargar plan (PDF)» sale verde. Pasa igual en `main` y en la rama; no sé si es así en la app real o es efecto de montar la pantalla sin la piel de la sesión.
- En la de copia, la mitad inferior es fondo vacío.
- Además del reposo hay un par con el desenlace de éxito, tocando el botón desde el arnés: `informes-desenlace-*` («Cuaderno descargado» y «Cuaderno generado (8.7 kB)…»; idénticos byte a byte) y `copia-listo-*` («Descarga iniciada»; difieren en 215 píxeles de 1.824.000, ninguno sobre un 2 % de tolerancia). **No medí el piso** (dos capturas del mismo árbol), así que no sé si esos 215 son la transición de color del botón o algo del cambio.
- No hay captura de «generando» ni de «error».

No digo que se vean bien; juzga el operador.

Envío al operador: cuatro capturas pasadas por `tg-send`. Las cuatro respondieron `captura encolada: N` con salida 0 y **no imprimieron `msg_id`**, así que no puedo confirmar que llegaron.

## Lo que NO pude verificar

- **Captura con `shot3d --headed`: no realizada.** `gate-x-estado.sh` respondió `X saturado/sin respuesta: sonda EGL agotó 15s (Chromium vivos=18)`. `shot3d --headed` se ejecutó igual contra el arnés y salió con código 42: `NO SÉ si el HTML plano vive — falta evidencia positiva de contenido estable: dom=130 visibles/4 hijos, texto=2088`. El arnés no llega a su mínimo de contenido y no lo rellené para pasar. Las imágenes entregadas salieron de otra herramienta de captura y no cuentan como gate con GPU.
- **La pantalla real dentro de la app**: está tras el inicio de sesión y el árbol no trae backend.
- **`RestauracionPlanPDFButton` y la tarjeta CSV de `InformesScreen`** no tienen prueba de componente propia.
- **Las filas mecánicas del inventario** (apartado 5): la línea y los valores salen del código, pero no leí cada fichero; la familia se asigna por nombre de variable.
- **Alcanzabilidad** de los estados imposibles marcados «no verifiqué camino real».
- **Segunda lectura**: se intentó repartir la lectura entre varios agentes y el control de la casa lo denegó; el inventario es de un solo lector.
- `public/sw.js` y los `.html` de la raíz no se revisaron.

## Contradicciones encontradas

- El encargo pide «todas» las máquinas y a la vez un inventario verificable. Resuelto por lo conservador: 30 filas leídas a mano con decisión individual y 515 de barrido mecánico con decisión por familia, diciendo cuáles son cuáles.
- La regla de captura pide `shot3d --headed`; con X saturado y el gate respondiendo «NO SÉ», entregué capturas de otra herramienta marcadas como tales, en vez de no entregar nada o de forzar el gate.
