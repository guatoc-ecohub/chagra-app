# Máquinas de estado implícitas de chagra-app

Inventario de los sitios donde la app guarda «en qué fase está algo» de forma implícita —booleanos que se excluyen entre sí, cadenas de `status` sueltas, banderas de stores, efectos y temporizadores que encadenan fases— y la decisión tomada en cada uno: **explicitar** o **dejar**.

- Base auditada: `origin/main` en `48aa5ab`.
- Filas: **545** (2 explicitadas, 30 leídas a mano, el resto por familias).
- Cada fila cita `archivo:línea` de la declaración. El apartado 7 dice cómo se sacaron y qué NO se miró.

## 1. Criterio

Una máquina se vuelve explícita solo si eso mejora **a la vez** tres cosas, **sin cambiar ningún comportamiento observable** en los caminos legales:

- **UX** — la persona deja de poder ver un estado roto. Un refactor que no cambia lo que se ve solo puede mejorar la experiencia de una manera: si hoy existe un camino REAL a un estado imposible y la máquina lo cierra. Por eso se exigió demostrar ese camino con una prueba que falla en `main`.
- **DX** — quien mantiene el código lee los estados y las transiciones en un solo sitio.
- **AX** — un agente que lea el fichero puede saber qué estados existen sin reconstruirlos a partir de `setX` dispersos.

Casi todas las candidatas pasan DX y AX y fallan UX: representan estados imposibles, pero ningún camino llega a ellos. Esas quedan **inventariadas con su razón**. Dejar una como está también es una decisión.

Qué cuenta aquí como «cambio de comportamiento»: nada de lo que hace la app en un camino legal (una acción a la vez, sin pisar un aviso anterior) cambia. Lo único que cambia es lo que pasaba DENTRO del estado imposible, que es justamente lo que se quería quitar.

## 2. Resumen

| Decisión | Cuántas | Cuáles |
|---|---|---|
| **Explicitar** | 2 máquinas (4 componentes) | Acción con aviso de los tres botones de descarga · Botón de exportar copia |
| **Dejar, con hallazgo** | 2 | `NetworkStatusBar` (temporizador de error y `syncing` sin salida) · `AgentHero` (`phase` sin retorno a `idle`) |
| **Dejar** | el resto | Ver apartados 4 y 5 |

Los dos hallazgos son defectos alcanzables que NO se tocaron porque arreglarlos cambia lo que se ve: necesitan decisión de producto y captura. Están descritos en el apartado 4.

## 3. Máquinas explicitadas

Las dos comparten una tabla de transiciones, en `src/hooks/useAccionConAviso.js:50` (`transicion`, función pura):

```
          INICIA               TERMINA
 idle ───────────▶ generating ─────────▶ success ──┐
  ▲                    │                           │ VENCE (msExito)
  │                    │ FALLA                     │
  │                    ▼                           │
  └──── VENCE ────── error ◀── (msError) ──────────┘
```

Tres reglas que antes no estaban escritas en ningún sitio: solo hay una acción en vuelo; el mensaje existe solo en `success` y `error`; el temporizador que vuelve a `idle` pertenece al desenlace que lo creó y se cancela si el estado cambia antes (`src/hooks/useAccionConAviso.js:92`).

| Dónde | Antes (en `main`) | Estados | Imposibles que `main` SÍ alcanzaba | Decisión y razón (UX · DX · AX) |
|---|---|---|---|---|
| `src/components/CuadernoPDFButton.jsx:60` · `src/components/RestauracionPlanPDFButton.jsx:38` · `src/components/InformesScreen.jsx:35` | `state` (cadena) + `resultMsg` + un `setTimeout` suelto por desenlace, copiado igual en los tres | `idle` · `generating` · `success` · `error` | Tocar «Reintentar» dentro de los 6 s del aviso de error: el temporizador viejo devolvía el botón a `idle` **con la generación nueva en vuelo** (botón habilitado, sin indicador, se podía lanzar otra). También: mensaje guardado con `state=idle`. | **Explicitar.** UX: se cierra un estado roto alcanzable con el gesto más natural tras un error. DX: tres copias de la misma lógica pasan a una tabla. AX: los estados se leen en un `Object.freeze`, no en doce comparaciones de cadena. Commit `2a1e027`. |
| `src/components/BackupExportButton.jsx:24` | Tres booleanos: `downloading`, `doneFlash`, `error` | exportando · listo (2,5 s) · error (hasta el próximo intento) · reposo | Volver a tocar dentro de los 2,5 s del aviso: «Descarga iniciada» **junto a** un error; «Listo» con una exportación en vuelo; el temporizador del primer aviso recortaba el segundo. | **Explicitar.** UX: el botón deja de poder contradecirse. DX/AX: los tres indicadores se derivan de una fase; 8 combinaciones posibles pasan a 4. Commit `17e46e8`. |

Pruebas, y cómo se comprobó que el comportamiento no cambió:

| Prueba | Qué recorre | En `main` (sin el cambio) | En la rama |
|---|---|---|---|
| `src/components/__tests__/CuadernoPDFButton.comportamiento.test.jsx` | Caminos legales del botón, con temporizadores | 5 de 5 pasan | 5 de 5 pasan |
| `src/components/__tests__/BackupExportButton.comportamiento.test.jsx` | Caminos legales, variante completa y compacta | 4 de 4 pasan | 4 de 4 pasan |
| `src/components/__tests__/CuadernoPDFButton.estadosImposibles.test.jsx` | Reintento dentro del aviso de error | **falla** 1 de 1 (control: el estado era alcanzable) | pasa |
| `src/components/__tests__/BackupExportButton.estadosImposibles.test.jsx` | Las tres contradicciones de arriba | **fallan** 3 de 3 (control) | pasan |
| `src/hooks/__tests__/useAccionConAviso.test.jsx` | Tabla completa estado × evento, secuencias de hasta 5 eventos, vuelo único | no aplica (el módulo no existe) | 8 de 8 pasan |

Las pruebas de comportamiento se corrieron contra un árbol exportado de `origin/main` con solo el fichero de prueba añadido.

Lo que NO cubren estas pruebas: `RestauracionPlanPDFButton` y la tarjeta CSV de `InformesScreen` no tienen prueba de componente propia; comparten hook y el mismo cambio mecánico que `CuadernoPDFButton`, pero su render no se ejecutó en una prueba. Tampoco hay captura de pantalla: el cambio no altera ningún píxel en caminos legales y no se capturó para comprobarlo.

## 4. Máquinas leídas a mano (decisión individual)

Columnas: dónde se declara · variables · estados reales · transiciones · estados imposibles que el código puede representar hoy · decisión y razón.

### Arranque, sesión y navegación

| Dónde | Variables | Estados | Transiciones | Imposibles representables | Decisión y razón (UX · DX · AX) |
|---|---|---|---|---|---|
| `src/App.jsx:1329` | `currentView` + `sinSesion` (L1333), `avisoSesionVencida` (L1335), `sesionVencidaRef` (L1336) | `loading` → `login` / `oauth-callback` / `dashboard` → el resto de vistas (más de 200 ramas `case` en el fichero) | Único escritor: `navigate()` (L1413). Arranque: `isAuthenticated()` decide `login` o `dashboard` (L1546–1655). Sesión vencida → `login` (L1898–1939). Salir → `login` (L1895). | Cualquier cadena es una vista (un nombre mal escrito cae al `default`). `sinSesion=true` con una vista que exige sesión. Aviso de sesión vencida con sesión ya renovada. No verifiqué que haya un camino real a ninguna. | **Dejar.** UX: sin defecto alcanzable demostrado. DX/AX: sí ganaría con un conjunto cerrado de vistas, pero es el enrutador entero (4.7k líneas, tablas de hash, sin pruebas): volverlo explícito es reescribir la navegación, no un cambio pequeño ni reversible. Siguiente paso barato: extraer la lista de vistas válidas a una constante con prueba. |
| `src/prodApp/ProdChagraApp.jsx:317` | `currentView` + `auth` (L316) | `loading` → `login` / `oauth-callback` / `valle3d` / rutas de `RUTAS` | Arranque L423–469; navegación L362. | `auth=null` con una vista autenticada; vista fuera de `RUTAS` (se filtra en L430 y L463, no en L362). | **Dejar.** Mismo razonamiento que `App.jsx`: es el enrutador del bundle de producción. UX sin defecto demostrado; el riesgo de tocar el arranque supera la ganancia de DX/AX. |
| `src/components/OAuthCallback.jsx:40` | `status` + `fincasPendientes` (L41), `seleccionandoFinca` (L42) | procesando (el valor inicial es el TEXTO del mensaje, no un nombre de fase) · `seleccion` · `ok` · `error` | procesando → `error` (L98, L121, L128) / `seleccion` (L111) / `ok` (L17). `seleccion` → `ok` al elegir finca (L51). | `status` mezcla un texto visible con nombres de fase. `seleccion` con `fincasPendientes=null` (ocurre un instante entre L50 y L17; no pinta nada roto). `error` con el selector aún montado si falla L49: lo tapa la navegación de `onError`. | **Dejar.** DX/AX: mejoraría (una unión `{fase, fincas}` en vez de texto-o-fase). UX: no sube: ningún estado roto llega a verse porque el padre navega enseguida. Es la puerta de sesión; sin ganancia para la persona no se toca. |
| `src/components/LoginScreen.jsx:94` | `loading` + `fincasPendientes` (L97), `loginError` (L114) | formulario · autenticando · eligiendo finca · abriendo finca · saliendo a PKCE · error de ingreso | Enviar → autenticando (L197, L237). Varias fincas → eligiendo (L274–275). Elegir → abriendo (L151) → entra (L146). Fallo → formulario con `loginError` (L309). | `fincasPendientes` con `loginError` a la vez; `loading` con el selector abierto es el único indicador de «abriendo finca». Representables; no verifiqué camino real. | **Dejar.** Pantalla de entrada con animaciones propias y sin pruebas de componente. UX: sin defecto demostrado. Candidata razonable para una segunda pasada, con captura antes/después. |
| `src/services/authService.js:386` | `refreshInFlight` + `lastRefreshFailureReason` (L387) | reposo · refrescando; motivo del último fallo: `storage` / `missing` / `rejected` / `unavailable` / `invalid-response` / `network` | Entra L392–394, limpia el motivo en L395, sale en L476. | Motivo viejo leído durante un refresco nuevo: no ocurre, se limpia al empezar. | **Dejar.** Ya es un patrón de vuelo único bien acotado y con pruebas de sesión. Nada que ganar en UX. |
| `src/services/tokenStore.js:46` | `store` + `revokedInMemory` (L47) | sin abrir · abierto · revocado en memoria | Revoca L70, restaura L75, consulta L61. | Ninguno relevante. | **Dejar.** Dos variables con significado independiente y pruebas propias (`tokenStore.sinIndexedDB.test.js`). |

### Sync y offline

| Dónde | Variables | Estados | Transiciones | Imposibles representables | Decisión y razón (UX · DX · AX) |
|---|---|---|---|---|---|
| `src/services/syncManager.js:98` | `isSyncing` + `rerunRequested` (L99), `isOnline` (L97) | reposo · sincronizando · sincronizando con repetición pedida | Entra L439; pide repetición L435; sale y relanza L707–711. `isOnline` cambia en L1115 y L1131. | `rerunRequested=true` con `isSyncing=false` (solo dentro del `finally`, no observable). `isSyncing=true` con `isOnline=false`: alcanzable si la red cae a mitad de lote; el lote sigue y falla por red. | **Dejar.** Es el corazón del offline-first (1.2k líneas) y no tiene pruebas en el repo: sin red de seguridad, cualquier refactor es riesgo de pérdida de datos. UX no sube con un cambio que no altera comportamiento. |
| `src/components/NetworkStatusBar.jsx:26` | `status` + `visible` (L30), `errorMessage` (L29), `offlineRef` (L31) | `online` · `offline` · `syncing` · `synced` · `error`, cada uno visible u oculto | Sondeo cada 1,5 s (L33–52) solo puede poner `syncing` u `offline`. Eventos: `online` → `syncing` (L70); `offline` (L84); `syncError` → `error` y a los 8 s `online`/`offline` (L99–110); `syncComplete` → `synced` 3 s (L118–120). | **Alcanzables:** (1) el temporizador de 8 s del error no se cancela: si antes llega `online` u otro error, lo oculta a destiempo (L103). (2) Nada devuelve `syncing` a `online` si el lote termina con pendientes o fallidos (L116 sale sin tocar el estado). `errorMessage` con `status≠error`: representable, no se pinta. | **Dejar, con hallazgo.** Es la candidata de más valor para UX, pero arreglarla exige decidir qué debe verse en cada cruce (¿qué gana, el sondeo o el evento?): eso es cambiar comportamiento, fuera de este encargo. Requiere decisión de producto y captura. |
| `src/hooks/useLogUploadStatus.js:10` | `status` + `receiptRef` (L11) | `idle` · `syncing` · `pending` · `synced` | `beginUpload` (L36–40), eventos `chagra:log-synced` / `chagra:log-sync-pending` (L20–29), `resetUpload` (L44–47). | El estado vive duplicado en `useState` y en un ref; se escriben siempre juntos. | **Dejar.** Ya es una máquina de una sola variable, pequeña y comentada. Sin ganancia. |
| `src/store/useAssetStore.js:88` | `isLoading` + `isHydrated` (L94), `error` (L95) | sin hidratar · hidratado · sincronizando · con error | Hidrata L115 / L129; sincroniza L138; termina L272 / L308. | `isLoading=true` con `error` viejo: no ocurre (L138 lo limpia). `error` con `isHydrated=false`: representable y legítimo (falla la red antes de leer la base local). | **Dejar.** Store central (1.3k líneas) leído desde 86 ficheros; las tres banderas tienen combinaciones válidas casi todas. Riesgo alto, ganancia nula para la persona. |
| `src/store/useLogStore.js:12` | `isSyncing` | reposo · trayendo | L39–40, L75. | Ninguno: es un candado de un solo booleano. | **Dejar.** No es una máquina. |

### Colas persistidas del agente

| Dónde | Variables | Estados | Transiciones | Imposibles representables | Decisión y razón (UX · DX · AX) |
|---|---|---|---|---|---|
| `src/services/agentRequestQueue.js:99` | `status` del registro en IndexedDB | `queued` · `sending` · `done` · `failed` · `offline` (documentados en L31) | Nace `queued` (L99); el drenaje filtra por `queued` (L389, L398) y por `offline` (L180). | El registro admite `done` con `response=null` o `failed` sin `error`: nada lo impide al escribir. No verifiqué que ocurra. | **Dejar.** Son datos PERSISTIDOS: cambiar la forma exige migración y eso sí es comportamiento observable. La cabecera ya documenta el contrato. |
| `src/services/agentOutboxService.js:99` | `status` del registro en IndexedDB | `queued` · `processing` · `answered` · `error` (L30) | Reclama L179; responde L231; falla L245; reencola L258; rescata `processing` huérfanos L278–280. | `processing` sin `claimedAt`; `answered` reencolado (lo impide L257). | **Dejar.** Misma razón: persistido. El rescate de huérfanos ya cubre el único estado colgado. |
| `src/services/visionQueueService.js:76` | `status` del registro | `pending` · `done` · `error` (L22) | Nace L76; reintenta `pending` y `error` (L151). | Ninguno relevante. | **Dejar.** Persistido y mínimo. |
| `src/store/useOllamaWarmStore.js:63` | `status` + `startedAt` (L64), `completedAt` (L65) | `unknown` · `warming` · `warm` · `failed` | L78–80 (idempotente), L105, L108, L114. | `completedAt` con `warming`: lo limpia L80. | **Dejar.** Ya es explícita: estados y reglas escritos en la cabecera (L36–49). |

### Hooks

| Dónde | Variables | Estados | Transiciones | Imposibles representables | Decisión y razón (UX · DX · AX) |
|---|---|---|---|---|---|
| `src/hooks/useGeolocation.js:18` | `position` + `error` (L19), `loading` (L20) | reposo · ubicando · ubicado · fallido (con la última posición conocida) | Pide L29–30; acierta L55–56; falla L77–78; reintento con baja precisión L68–74. | `position` fresca con `error` viejo: solo con dos `request()` solapados. Todos los botones que lo disparan se deshabilitan con `loading` (`GeolocationButton`, `GlaciarReporteScreen`, `RegistroVozConfirm`), así que no encontré camino real. Por eso los consumidores escriben `position && !error`. | **Dejar.** Fue candidata firme: DX/AX subirían (se acaba el `position && !error` defensivo). Pero sin estado roto alcanzable, UX no sube, y el encargo pide las tres. Primera de la lista si aparece un disparador que no se deshabilite. |
| `src/hooks/useVoiceRecorder.js:39` | `isRecording` + `error` (L43) + `recorderRef` (L46) | reposo · grabando · deteniendo · error | Arranca L184; para L151 / L214; falla L117, L124, L167, L205. | `isRecording=true` con el `MediaRecorder` ya `inactive`: la fuente de verdad es el grabador (L98, L200), el booleano va detrás. | **Dejar.** El estado real lo lleva el `MediaRecorder` del navegador; duplicarlo en una máquina propia no elimina la carrera. Audio: sin aparato real no se verifica. |
| `src/hooks/useFarmProcessConfirm.js:20` | `status` + `result` (L21) | `idle` · `saving` · `recorded_local_pending_sync` · `failed` (cabecera L7–11) | L24, L62, L65, L71. | `failed` con `result` de un guardado anterior (confirmar dos veces: acierta y luego falla). No verifiqué si la pantalla lo permite. | **Dejar.** Una sola variable y ya documentada. Ganancia marginal. |
| `src/hooks/useModoCampo.js:57` | `status` + `active` (L55), `errorMsg` (L59) | `idle` · `loading-libs` · `loading-base` · `loading-personal` · `loading-ready` · `training` · `ready` · `listening` · `error` (tipo en L41) | L106, L116, L125, L135. | `active=false` con `status=listening` durante el apagado; `errorMsg` con `status≠error`. | **Dejar.** Ya tiene tipo de unión declarado. Micrófono y modelo: no verificable sin aparato. |
| `src/hooks/useInsightProactivo.js:125` | `estado` | `idle` · `aceptado` · `rechazado` | L158, L162. | Ninguno. | **Dejar.** Una variable, tres valores. |

### Pantallas con hallazgo o con varias banderas acopladas

| Dónde | Variables | Estados | Transiciones | Imposibles representables | Decisión y razón (UX · DX · AX) |
|---|---|---|---|---|---|
| `src/components/dashboard/AgentHero.jsx:276` | `phase` + `busy` (L274) | reposo · ocupado (foto o guardando) · enviando (transición al agente) | `sending` en L454; `busy` L485/L498 y L666/L676. | **Alcanzable:** `phase` pasa a `sending` y NADA la devuelve a `idle`. Si la navegación no desmonta el héroe (el propio comentario de L469–481 describe ese caso para `busy`, que sí se arregló), el compositor queda brillando y desaparece la pista de desplazamiento (L2141) hasta recargar. | **Dejar, con hallazgo.** Arreglarlo es cambiar lo que se ve tras un envío, en el componente más visible del inicio (2k líneas). Necesita captura antes/después y juicio del operador; no cabe en «sin cambio observable». |
| `src/components/dashboard/AgentHero.jsx:281` | `menuOpen` + `menuClosing` (L282) | cerrado · abierto · cerrando | Abre L551–555; cierra L557–566 (con temporizador que sí se cancela en L551). | `menuClosing=true` con `menuOpen=false`: representable, no alcanzable (se escriben juntos). | **Dejar.** Dos booleanos para tres estados es justo el patrón del encargo, pero aquí no hay camino al cuarto estado: UX no sube. DX/AX sí; va con el hallazgo de arriba si se abre ese fichero. |
| `src/components/AgentScreen/AgentScreen.jsx:392` | `agentTurnStatus` + `composerPhase` (L575), `thinkingPhase` (L437) y ~20 banderas más | turno: `idle` · `pending` · `answered` · `failed`; compositor: `idle` · `sending` | L1725, L1755, L3287, L3537, L3901; compositor L4130, L4134. | Muchas combinaciones representables entre turno, compositor, avisos de lentitud y voz. No las verifiqué una a una: el fichero pasa de 4k líneas. | **Dejar.** Es la conversación entera. Volverla explícita es un proyecto con su propio diseño y pruebas, no un cambio pequeño. |
| `src/components/FieldFeedback.jsx:51` | `submitting` + `submitted` (L52), `errorMsg` (L57) | reposo · enviando · guardado (1,4 s) · error | L161, L186 + temporizador L193, L207 + L213, L218. | `submitted` con `errorMsg` a la vez: **alcanzable por diseño** en L207–211 (guardó el texto pero perdió el audio). Reenviar dentro de 1,4 s: el botón exige texto nuevo, improbable. | **Dejar.** El «guardado con advertencia» es un quinto estado legítimo que `useAccionConAviso` no tiene; forzarlo cambiaría lo que se ve. |
| `src/components/GlaciarReporteScreen.jsx:118` | `saving` + `savedOk` (L119), `hydrated` (L115) | hidratando borrador · editando · guardando · guardado (2,5 s) | L155, L277–278, L329 + temporizador L339, L344. | `saving` con `savedOk`: lo impide L278. Temporizador sin dueño (L339): solo molesta si se guarda dos veces en 2,5 s, y al guardar se borran ubicación y foto (L337–338), así que el botón queda deshabilitado. | **Dejar.** Misma familia que las dos explicitadas, pero sin camino real al estado roto. Candidata a adoptar el hook en otra pasada. |
| `src/components/InvasiveObservationLog.jsx:55` | `isSaving` + `saveSuccess` (L56), `syncedOffline` (L57), `catalogStatus` (L52) | catálogo: `loading` · `ready` · `error`; guardado: reposo · guardando · guardado (en línea / sin conexión) | L71, L79, L125, L163, L167, L173. | `syncedOffline=true` con `saveSuccess=false`: representable; solo se lee dentro de la rama de éxito (L177–192). | **Dejar.** `syncedOffline` es un dato del resultado, no una fase. Sin defecto visible. |
| `src/components/onboardingDescenso/OnboardingDescenso.jsx:106` | `paso` + `fase0` (L107), `viajando` (L112), `subiendo` (L113), `aterrizado` (L121), `geo` (L126) | pasos numerados del descenso (`clampPaso`); dentro del paso 0: `elegir` · `nombre`; viaje entre pasos: quieto · viajando (subiendo o bajando) · aterrizado; GPS: `idle` · `buscando` · `listo` · `negado` · `sin-gps` | Cambio de paso L116–119; llegada L192, L249, L604; `fase0` L270, L313, L649; GPS L346–394. | `viajando` y `aterrizado` a la vez; `fase0` con `paso≠0`; `geo=listo` sin `loc`. Representables; la coreografía las evita por orden de escritura. No las verifiqué por temporizador. | **Dejar.** Es el onboarding: animación 3D por temporizadores, avance guardado en almacenamiento local y sin pruebas. Cualquier cambio exige captura por cada paso y gate humano. Alto valor de DX/AX, pero no es «pequeño y reversible». |
| `src/components/BitacoraEntryDetail.jsx:123` | `photoState` + `photoMsg` (L124); `aiState` (L146) + `aiStream` (L148) | foto: `idle` · `uploading` · `success` · `error`; IA: `idle` · `running` · `done` · `error` | Foto L181–216; IA L189, L227, L238–244. | Mensaje de foto con `photoState=idle`; texto de IA con `aiState=idle`. Dos temporizadores sin dueño. | **Dejar.** Dos máquinas de una variable cada una. Misma familia de avisos; sin defecto demostrado. |
| `src/components/modoCampo/EnrollmentModoCampo.jsx:29` | `fase` + `pasoIdx` (L30), `grabandoAhora` (L31) | `intro` · `grabacion` · `entrenando` · `listo` · `error` (constantes L22–26) | Ver constantes `FASE_*`. | `pasoIdx>0` fuera de `grabacion`. | **Dejar.** Ya usa constantes con nombre. |
| `src/components/escucha/EscuchaOverlay.jsx:313` | `fase` + `faseRef` (L192) | `cerrado` · `oyendo` · `pensando` · `rumbo` · `error` (constantes L54–58) | Ver constantes `FASE_*`. | Estado duplicado en ref y en `useState`. | **Dejar.** Ya usa constantes con nombre. |

## 5. Inventario por familias (decisión por familia)

Estas filas salen de un barrido mecánico (apartado 7) y comparten razón con su familia. La decisión de cada fila es la de su familia, indicada en el encabezado.

### 5.1 Fase en UNA sola variable de cadena — 25 filas — decisión: **dejar (F1)**

**Razón F1.** Ya no hay combinaciones imposibles entre banderas: toda la fase cabe en una variable. Lo único implícito es la tabla de transiciones (cualquier `setX('…')` es legal desde cualquier estado). UX: no sube, no hay estado roto que quitar. DX/AX: subiría poco; el conjunto de valores ya se lee en el propio fichero. Se revisa una a una solo si aparece un defecto.

| Dónde | Variable | Valores | Escrituras |
|---|---|---|---|
| `src/components/agent/FeedbackSutil.jsx:19` | `estado` | pendiente · buena · (+ valores calculados) | L23 |
| `src/components/AgentScreen/ThinkingSteps.jsx:30` | `stepIdx` | inicial: `0` | — |
| `src/components/AssetDetailView.jsx:470` | `status` | inicial: `() => ((speciesSlug ·· assetName) ? 'loading' : 'idle')` | — |
| `src/components/CicloVivo/CicloVivoFullView.jsx:112` | `faseActiva` | inicial: `DEFAULT_PHASE_INDEX` | — |
| `src/components/common/AIStreamPanel.jsx:46` | `closingPhase` | idle · closing · finished | L56, L58, L61 |
| `src/components/CompaiOverlay.jsx:81` | `compaiState` | idle · speaking | L132, L135 |
| `src/components/CromatografiaScreen.jsx:223` | `paso` | guia · comparacion · registro · interpretacion · (+ valores calculados) | L268, L292, L371, L864, L984 |
| `src/components/EspirituProScreen.jsx:31` | `status` | loading · unavailable · ready | L37, L46, L48, L52 |
| `src/components/grafoFoto/GrafoFotoScreen.jsx:66` | `phase` | pick · scanning · card | L86, L111, L115, L126 |
| `src/components/HarvestLog.jsx:130` | `view` | form · success | L195, L276, L314 |
| `src/components/HelpVoiceQuestion.jsx:85` | `phase` | idle · thinking · transcribing | L126, L176, L225, L237, L246 |
| `src/components/LocationDetectedScreen.jsx:291` | `geoState` | idle · unavailable · detecting · denied · (+ valores calculados) | L330, L333, L345, L347, L352 |
| `src/components/lotes/LoteCroquisPlaceholder.jsx:77` | `gpsStatus` | idle · stopped · failed · searching · rejected · recording · located | L221, L229, L236, L258, L266, L277, L285 y 6 más |
| `src/components/MapPicker.jsx:118` | `gpsStatus` | idle · failed · locating · located · low-accuracy | L259, L336, L357, L360, L375, L418, L422 y 3 más |
| `src/components/MultiFincaGlobe.jsx:70` | `entryPhase` | initial · highlighted · faded | L94, L95 |
| `src/components/NutricionHumanaScreen.jsx:247` | `estado` | cargando · listo · error | L260, L261 |
| `src/components/PlagaBiopreparadoScreen.jsx:32` | `phase` | idle · ready · analyzing · unavailable · result | L47, L54, L59, L63, L65, L75 |
| `src/components/PlantaPorVozScreen.jsx:185` | `phase` | capture · loading · dossier | L218, L227, L231, L243 |
| `src/components/SeedingLog.jsx:112` | `view` | form · success | L312, L394 |
| `src/components/SoilDiagnosticScreen.jsx:151` | `paso` | sintomas · diagnostico · resultado · prueba · (+ valores calculados) | L189, L193, L252, L253, L254, L497, L523 y 5 más |
| `src/components/SpeciesSelect.jsx:161` | `aiState` | idle · running · error · done | L192, L195, L205, L228, L232, L259, L276 y 5 más |
| `src/components/SplitFlow.jsx:22` | `step` | inicial: `1` | — |
| `src/components/TelemetryAlerts.jsx:89` | `aiStatus` | idle · thinking · error · done · empty | L305, L547, L554, L618, L621, L626 |
| `src/components/TelemetryAlerts.jsx:91` | `telemetryStatus` | loading · empty · (+ valores calculados) | L299, L317, L375, L391 |
| `src/components/ToxicologiaScreen.jsx:199` | `paso` | cuestionario · resultado | L214, L339 |

### 5.2 Pares «guardando / guardado» con aviso temporizado — 5 filas — decisión: **dejar por ahora (F2)**

**Razón F2.** Es la misma forma que las dos máquinas explicitadas (acción asíncrona + aviso que se apaga solo). Cada una es candidata a adoptar `useAccionConAviso`, pero solo cuando se demuestre en ella un estado roto alcanzable, con su prueba y su captura: adoptarlo a ciegas en 5 pantallas es riesgo sin ganancia medida para la persona. DX/AX: subirían.

| Dónde | Banderas |
|---|---|
| `src/components/AssetDetailView.jsx:89` | `busy` (L89), `success` (L90), `loading` (L263), `saving` (L598), `saved` (L599), `showGeoPicker` (L719), `geoSaving` (L720), `showCemeteryModal` (L721), `assetIdCopied` (L722), `showSplitFlow` (L723), `saving` (L1130) |
| `src/components/InputLog.jsx:39` | `catalogError` (L39), `isSaving` (L59), `savedMessage` (L60) |
| `src/components/ProfileScreen.jsx:144` | `confirmarSalida` (L144), `photoError` (L161), `photoBusy` (L162), `savedFlash` (L210) |
| `src/components/sala/SalaSuelo.jsx:62` | `saving` (L62), `saved` (L63) |
| `src/components/VoiceCapture.jsx:91` | `isSaving` (L91), `syncedOffline` (L96) |

### 5.3 Pares «cargando / error (/ dato)» — 25 filas — decisión: **dejar (F3)**

**Razón F3.** El patrón clásico `loading` + `error` + dato. Representa combinaciones sin sentido (`loading` y `error` a la vez), pero en lo leído cada carga limpia el error al empezar. UX: sin defecto demostrado. Unificarlo pide una primitiva de carga para todo el repo, que es una decisión de arquitectura y no un cambio pequeño. No verifiqué cada fila una a una.

| Dónde | Banderas |
|---|---|
| `src/components/AssetsDashboard.jsx:395` | `showMapPicker` (L395), `showFincaModal` (L396), `isSaving` (L412), `ragLoading` (L437) |
| `src/components/biopreparados/BiopreparadosScreen.jsx:368` | `abierto` (L368), `loading` (L398), `loadError` (L399) |
| `src/components/CalendarioFincaScreen.jsx:79` | `loading` (L79), `usingCatalogFallback` (L82) |
| `src/components/campo/MisionCampoScreen.jsx:30` | `loading` (L30), `error` (L31) |
| `src/components/clima/ClimaBoletinScreen.jsx:226` | `copiado` (L226), `cieloNublado` (L323), `abrirCondiciones` (L1438), `loading` (L1442) |
| `src/components/crm/CrmScreen.jsx:43` | `showContactForm` (L43), `showInteractionForm` (L44), `loading` (L45), `saving` (L46) |
| `src/components/DirectorioEspecies/DirectorioEspeciesScreen.jsx:40` | `searching` (L40), `searchError` (L41), `loadingFicha` (L43), `fichaErrorId` (L44), `touched` (L45), `loadingPlaga` (L51) |
| `src/components/GlaciarHistorialScreen.jsx:51` | `loading` (L51), `deleting` (L53), `exporting` (L55) |
| `src/components/GpsFincaBanner.jsx:35` | `dismissed` (L35), `loading` (L36) |
| `src/components/GuildSuggestions.jsx:61` | `aiLoading` (L61), `aiError` (L62) |
| `src/components/HytaPanel.jsx:47` | `loading` (L47), `error` (L48) |
| `src/components/InventoryAuditDashboard.jsx:20` | `loading` (L20), `isDiffOnly` (L21), `reconciling` (L22) |
| `src/components/InventoryAuditTrail.jsx:55` | `loading` (L55), `error` (L56) |
| `src/components/juego/MiFincaVivaScreen.jsx:63` | `cargando` (L63), `celebracionDescartada` (L106) |
| `src/components/LocationDetectedScreen.jsx:283` | `loading` (L283), `searchError` (L285), `cascadeOpen` (L289) |
| `src/components/MercadosScreen.jsx:75` | `cargando` (L75), `errorCarga` (L76), `mostrarEjemplos` (L78), `cerrandoTrato` (L502), `guardando` (L748) |
| `src/components/NativeSubstituteSuggestion.jsx:50` | `loading` (L50), `error` (L51) |
| `src/components/NotificationsBell.jsx:122` | `open` (L122), `climaLoading` (L129) |
| `src/components/ObservationScreen.jsx:55` | `isSaving` (L55), `_ragLoading` (L95) |
| `src/components/PendingTasksWidget.jsx:27` | `isLoading` (L27), `error` (L28), `expanded` (L30) |
| `src/components/PhotoMap.jsx:72` | `isLoading` (L72), `loadError` (L73) |
| `src/components/SeguimientoProcesoScreen.jsx:105` | `loading` (L105), `creating` (L109), `saving` (L313), `busy` (L525), `pigBusy` (L541), `biopreparationBusy` (L543) |
| `src/components/Settings/ProfileSwitcher.jsx:25` | `flash` (L25), `loading` (L26) |
| `src/components/TelemetryAlerts.jsx:87` | `loading` (L87), `error` (L88), `usingMockSensors` (L92) |
| `src/components/ToxicologiaScreen.jsx:64` | `cargando` (L64), `error` (L65) |

### 5.4 Banderas de stores Zustand no cubiertas arriba — 12 filas — decisión: **dejar (F3)**

Misma razón F3: `isLoading`/`error`/`isSaving` de cada store, con las acciones que los escriben en el mismo fichero.

| Dónde | Bandera |
|---|---|
| `src/store/useAgentNotificationStore.js:23` | `responseReady` |
| `src/store/useAgentOutboxStore.js:31` | `loading` |
| `src/store/useAlertStore.js:38` | `engineStatus` |
| `src/store/useAngelitaStore.js:74` | `estado` |
| `src/store/useCaseStudyStore.js:123` | `status` |
| `src/store/useCosechaStore.js:23` | `isLoading` |
| `src/store/useCosechaStore.js:24` | `error` |
| `src/store/useLoteStore.js:38` | `isSaving` |
| `src/store/useLoteStore.js:39` | `error` |
| `src/store/useRecorridoStore.js:49` | `error` |
| `src/store/useRedStore.js:35` | `isLoading` |
| `src/store/useRedStore.js:36` | `error` |

### 5.5 Booleanos independientes (no son una máquina) — 63 filas — decisión: **dejar (F4)**

**Razón F4.** Dos o más booleanos en el mismo fichero que, por nombre, no forman pareja de fases: «la imagen cargó» junto a «el acordeón está abierto», varios modales, una pausa. En los que abrí, todas las combinaciones son válidas y no hay máquina que explicitar. **No abrí las demás filas:** si alguna esconde una exclusión mutua, el barrido por nombre no la distingue.

| Dónde | Banderas |
|---|---|
| `src/components/ActionConfirmModal.jsx:43` | `isEditing` (L43), `isProcessing` (L45) |
| `src/components/AgentFab.jsx:239` | `hover` (L239), `pressed` (L240), `menuAbierto` (L241), `peekAbierto` (L242), `pizarraVista` (L246), `panelAbierto` (L250), `desplazando` (L271), `vueloColmena` (L505), `cruceroColmena` (L506), `celebraSincronizacion` (L507) |
| `src/components/AgentScreen/AgentEntry.jsx:11` | `hadFocus` (L11), `failed` (L12) |
| `src/components/AgentScreen/LongWaitNotice.jsx:24` | `visible` (L24), `actionVisible` (L25) |
| `src/components/agua/AguaScreen.jsx:116` | `ok` (L116), `abierto` (L1091) |
| `src/components/aguacate/AguacateScreen.jsx:68` | `ok` (L68), `abierto` (L595) |
| `src/components/almanaque/AlmanaqueScreen.jsx:55` | `ok` (L55), `abierto` (L362) |
| `src/components/aromaticas/AromaticasScreen.jsx:39` | `ok` (L39), `abierto` (L250) |
| `src/components/botica/BoticaScreen.jsx:67` | `ok` (L67), `abierto` (L380) |
| `src/components/cacao/CacaoScreen.jsx:70` | `ok` (L70), `abierto` (L599) |
| `src/components/cafe/CafeScreen.jsx:73` | `ok` (L73), `abierto` (L632) |
| `src/components/cana/CanaScreen.jsx:67` | `ok` (L67), `abierto` (L579) |
| `src/components/CaseLinkModal.jsx:70` | `busy` (L70), `error` (L71) |
| `src/components/CaseStudyDetail.jsx:101` | `showCapture` (L101), `busy` (L102), `validationRequired` (L226), `showValidator` (L385), `showAdd` (L461), `showAdd` (L558), `resolved` (L737), `generating` (L740), `genError` (L741), `showCapture` (L838), `busy` (L839), `showTreatment` (L935), `showClose` (L936), `copiedCaseId` (L937) |
| `src/components/CaseStudyScreen.jsx:132` | `showExtractor` (L132), `extracting` (L134), `extractError` (L135), `transcribing` (L136), `showForm` (L509) |
| `src/components/CicloDetalle.jsx:41` | `pickStage` (L41), `busy` (L42) |
| `src/components/CicloObservacion.jsx:27` | `saving` (L27), `recording` (L28) |
| `src/components/citricos/CitricosScreen.jsx:72` | `ok` (L72), `abierto` (L609) |
| `src/components/CompaiOverlay.jsx:79` | `peekAbierto` (L79), `panelAbierto` (L80) |
| `src/components/CompostScreen.jsx:127` | `ok` (L127), `abierto` (L536) |
| `src/components/CromatografiaScreen.jsx:226` | `error` (L226), `procesando` (L227) |
| `src/components/dashboard/HomeCampesinoB.jsx:158` | `speaking` (L158), `alertDismissed` (L159) |
| `src/components/dashboard/ValleHoverConfirm.jsx:57` | `dialogoSolicitado` (L57), `entering` (L58) |
| `src/components/DataLossBanner.jsx:33` | `hidden` (L33), `showImportModal` (L34), `isRecovering` (L35), `error` (L180) |
| `src/components/EstiercolScreen.jsx:70` | `ok` (L70), `abierto` (L484) |
| `src/components/EvidenceCapture.jsx:47` | `processing` (L47), `diagnosing` (L48) |
| `src/components/FeedbackButtons.jsx:25` | `isSending` (L25), `showCommentBox` (L26), `feedbackSent` (L28) |
| `src/components/fique/FiqueScreen.jsx:66` | `ok` (L66), `abierto` (L468) |
| `src/components/frutales/FrutalesScreen.jsx:59` | `ok` (L59), `abierto` (L342) |
| `src/components/GestionUsuariosScreen.jsx:118` | `error` (L118), `confirmandoQuitar` (L233), `mostrandoForm` (L315), `errorAccion` (L317) |
| `src/components/goteo/MiGoteoScreen.jsx:159` | `renombrando` (L159), `quitando` (L161), `guardando` (L243) |
| `src/components/HelpVoiceQuestion.jsx:84` | `corpusError` (L84), `gateError` (L88) |
| `src/components/InventoryDashboard.jsx:182` | `submitting` (L182), `exporting` (L183) |
| `src/components/LandSoilSection.jsx:114` | `showForm` (L114), `saving` (L116) |
| `src/components/lotes/LoteCroquisPlaceholder.jsx:74` | `isWalking` (L74), `isClosed` (L75) |
| `src/components/mango/MangoScreen.jsx:81` | `ok` (L81), `abierto` (L662) |
| `src/components/MapPicker.jsx:108` | `isWalking` (L108), `gpsWarmingUp` (L112), `gpsError` (L120), `isBrave` (L121) |
| `src/components/MarketplaceInterestForm.jsx:6` | `consent` (L6), `saving` (L9) |
| `src/components/milpa/MilpaScreen.jsx:77` | `ok` (L77), `abierto` (L599) |
| `src/components/modoCampo/ModoCampoPanel.jsx:42` | `showConsent` (L42), `showEnrollment` (L43) |
| `src/components/MultiFincaModal.jsx:14` | `showOnboarding` (L14), `showAddForm` (L21), `savingFinca` (L22) |
| `src/components/PhotoCaptureField.jsx:22` | `isProcessing` (L22), `error` (L23) |
| `src/components/quinua/QuinuaScreen.jsx:67` | `ok` (L67), `abierto` (L546) |
| `src/components/RecountDrawer.jsx:23` | `submitting` (L23), `error` (L24) |
| `src/components/red/CierreTratoSheet.jsx:42` | `guardando` (L42), `registrado` (L44) |
| `src/components/red/PreguntarVecinoPanel.jsx:36` | `buscando` (L36), `copiado` (L40) |
| `src/components/restauracion/RestauracionScreen.jsx:83` | `ok` (L83), `abierto` (L604) |
| `src/components/SaludSueloScreen.jsx:268` | `heroOk` (L268), `imgOk` (L432), `imgOk` (L486), `creditos` (L538), `imgOk` (L969), `perfilOk` (L1014), `creditos` (L1015) |
| `src/components/SeedingLog.jsx:107` | `isRecording` (L107), `isSaving` (L110) |
| `src/components/SoilDiagnosticScreen.jsx:158` | `sinMatch` (L158), `recording` (L159) |
| `src/components/SplitFlow.jsx:25` | `isConfirmed` (L25), `isExecuting` (L26), `error` (L27) |
| `src/components/uchuva/UchuvaScreen.jsx:73` | `ok` (L73), `abierto` (L610) |
| `src/components/UpdateAvailableBanner.jsx:18` | `updateAvailable` (L18), `updating` (L20), `pulsing` (L37) |
| `src/components/voz/ConversacionVoz.jsx:71` | `atras` (L71), `nuevos` (L72) |
| `src/components/voz/useMediosVoz.js:8` | `hablando` (L8), `oculta` (L10) |
| `src/components/voz/VentanaChivito.jsx:37` | `quieta` (L37), `cuaderno` (L39) |
| `src/components/voz/VentanaGuacamaya.jsx:52` | `pausada` (L52), `saliendo` (L54) |
| `src/components/voz/VentanaLuciernaga.jsx:22` | `pausada` (L22), `abierta` (L24) |
| `src/components/WelcomeStatsHero.jsx:200` | `hover` (L200), `pressed` (L201), `expanded` (L284), `isHovered` (L285) |
| `src/hooks/useComportamientoCompai.js:154` | `moviendo` (L154), `presencia` (L157), `notificacionVisible` (L158) |
| `src/visual/agente/Angelita.jsx:354` | `celebraCosecha` (L354), `despiertaDeNoche` (L387), `despertarDia` (L388), `aterrizandoNoche` (L389), `carino` (L418), `campoInvalido` (L1156), `cuidadoInsumo` (L1157) |
| `src/visual/mundo3d/sierra/GaleriaSierraArboles.jsx:735` | `viva` (L735), `listo` (L1159) |
| `src/visual/mundo3d/VistaGlobalSierra.jsx:1665` | `listo` (L1665), `mostrarLlegada` (L1666), `llegadaAsentada` (L1667), `cajaAbierta` (L1721) |

### 5.6 Selectores de presentación — 78 filas — decisión: **dejar (F5)**

**Razón F5.** Pestaña, pilar, estación, filtro u orden elegidos por la persona. Cualquier valor es alcanzable desde cualquier otro con un toque: no hay transiciones condicionadas ni estados imposibles.

| Dónde | Variable | Valores |
|---|---|---|
| `src/components/AgentScreen/VoiceStatusStrip.jsx:111` | `helpAudio` | loading · unavailable · playing · idle |
| `src/components/agua/AguaScreen.jsx:1258` | `pilar` | lluvia · riego · cuidar · … |
| `src/components/aguacate/AguacateScreen.jsx:632` | `estacion` | siembra · suelo · sanidad · flor · cosecha · … |
| `src/components/AlmacenamientoScreen.jsx:162` | `pilar` | hub · almacenar · conservar · plagas · micotoxinas |
| `src/components/AlmacenamientoScreen.jsx:509` | `forma` | silo · troja · … |
| `src/components/AlmacenamientoScreen.jsx:510` | `grano` | maiz · … |
| `src/components/almanaque/AlmanaqueScreen.jsx:405` | `seccion` | anio · pisos · luna · … |
| `src/components/AssetsDashboard.jsx:402` | `viewMode` | list · map · croquis |
| `src/components/biopreparados/BiopreparadosScreen.jsx:401` | `filtro` | todos · insectos · … |
| `src/components/botica/BoticaScreen.jsx:417` | `estacion` | barriga · piel · gripa · cultivo · cuidado · … |
| `src/components/cacao/CacaoScreen.jsx:635` | `estacion` | arbol · sombra · manejo · sanidad · beneficio · … |
| `src/components/cafe/CafeScreen.jsx:669` | `estacion` | siembra · sombra · males · cosecha · beneficio · … |
| `src/components/cana/CanaScreen.jsx:616` | `estacion` | cana · siembra · males · corte · panela · … |
| `src/components/CaseStudyDetail.jsx:96` | `eventType` | observation · … |
| `src/components/CaseStudyScreen.jsx:510` | `filter` | all · private · shared · pending |
| `src/components/citricos/CitricosScreen.jsx:646` | `estacion` | variedades · piso · siembra · plagas · cosecha · … |
| `src/components/crm/ContactosPanel.jsx:22` | `filterType` | all · … |
| `src/components/crm/ContactosPanel.jsx:23` | `filterStatus` | all · … |
| `src/components/crm/RedView.jsx:15` | `selectedTab` | overview · contacts · interactions · top · … |
| `src/components/cultivos/CalculadoraGradosDia.jsx:33` | `cultivoId` | maiz · manual · … |
| `src/components/cultivos/CalculadoraGradosDia.jsx:34` | `pisoId` | frio · … |
| `src/components/cultivos/MundoCultivosHub.jsx:42` | `regimenId` | bimodal · … |
| `src/components/escucha/EscuchaOverlay.jsx:314` | `fuente` | tap · wakeword · … |
| `src/components/EstiercolScreen.jsx:238` | `tipoAnimal` | cerdo · … |
| `src/components/EstiercolScreen.jsx:240` | `pisoTermico` | calido · … |
| `src/components/EstiercolScreen.jsx:617` | `pilar` | inicio · olores · biodigestor · abonos · … |
| `src/components/FederatedMarket.jsx:21` | `unidad` | todos · … |
| `src/components/FederatedMarket.jsx:22` | `orden` | nombre · precio · … |
| `src/components/FederatedMarket.jsx:23` | `nodeFilter` | todos · … |
| `src/components/FermentosView.jsx:402` | `filtroTipo` | Todos · … |
| `src/components/fique/FiqueScreen.jsx:505` | `estacion` | planta · manejo · desfibrado · usos · aprovechar · … |
| `src/components/GerminacionScreen.jsx:238` | `sustrato` | papel · … |
| `src/components/GlaciarReporteScreen.jsx:104` | `tab` | nuevo · lista |
| `src/components/HelpManual.jsx:54` | `section` | home · funciones · voz · uso · voz-regional-demo · ciclo · diccionario · agente · datos |
| `src/components/hoy/AgendaCampesina.jsx:18` | `modo` | semana · … |
| `src/components/InventoryEventTimeline.jsx:25` | `filterType` | all · … |
| `src/components/juego/AhorcadoContaminado.jsx:593` | `categoriaId` | mezcla · … |
| `src/components/juego/DoomFincaScreen.jsx:354` | `mensajeTipo` | info · error · acierto · … |
| `src/components/juego/MilpaSimulator.jsx:248` | `modoVista` | simulador · ilustrado |
| `src/components/juego/MundoSubsuelo.jsx:401` | `activeId` | compost-bocashi · … |
| `src/components/lotes/LoteCroquisPlaceholder.jsx:81` | `landType` | field · … |
| `src/components/mango/MangoScreen.jsx:699` | `estacion` | siembra · clima · flor · males · cosecha · … |
| `src/components/MercadosScreen.jsx:73` | `tab` | explorar · publicar · vecinos |
| `src/components/milpa/MilpaScreen.jsx:635` | `seccion` | juntas · sembrar · cuidar · … |
| `src/components/MultiFincaModal.jsx:13` | `viewMode` | globe · grid |
| `src/components/NotificationsBell.jsx:127` | `activeTab` | notif · clima |
| `src/components/NutricionHumanaScreen.jsx:248` | `filtro` | todos · … |
| `src/components/PhotoMap.jsx:74` | `layer` | photos · pests |
| `src/components/PhotoMap.jsx:76` | `pestFilter` | all · … |
| `src/components/PlatanoBananoScreen.jsx:190` | `pilar` | hub · variedades · siembra · amenazas · cosecha |
| `src/components/PoscosechaScreen.jsx:153` | `pilar` | hub · cosecha · guardar · transformar |
| `src/components/PoscosechaScreen.jsx:503` | `grano` | maiz · … |
| `src/components/puertas/PuertaBitacora.jsx:15` | `kind` | all · … |
| `src/components/quinua/QuinuaScreen.jsx:583` | `estacion` | granos · siembra · desaponificado · plagas · cosecha · … |
| `src/components/restauracion/RestauracionScreen.jsx:641` | `estacion` | bosque · estratos · sucesion · suelo · especies · … |
| `src/components/SaludSueloScreen.jsx:217` | `pilar` | hub · lectura · analisis · acidez · vida · mejorar |
| `src/components/semilla/SemillaScreen.jsx:102` | `pilar` | hub · seleccionar · guardar · germinar |
| `src/components/semilla/SemillaScreen.jsx:236` | `cultivoId` | maiz · … |
| `src/components/uchuva/UchuvaScreen.jsx:647` | `estacion` | clima · siembra · tutorado · males · cosecha · poscosecha · … |
| `src/components/voz/jaguar/VentanaJaguar.jsx:23` | `tema` | noche · … |
| `src/components/voz/VentanaAngelita.jsx:37` | `tema` | noche · … |
| `src/components/voz/VentanaChivito.jsx:38` | `tema` | dia · noche · … |
| `src/components/voz/VentanaGuacamaya.jsx:51` | `tema` | noche · … |
| `src/components/voz/VentanaLuciernaga.jsx:23` | `tema` | noche · … |
| `src/components/voz/VentanaLuciernaga.jsx:26` | `origen` | vacio · guardada · ejemplo |
| `src/components/voz/VentanaOso.jsx:32` | `tema` | dia · … |
| `src/components/voz/VentanaVoz.jsx:42` | `tema` | noche · … |
| `src/components/voz/VentanaVoz.jsx:46` | `origen` | ejemplo · guardada |
| `src/components/WorkerDashboard.jsx:58` | `viewMode` | list · map · … |
| `src/components/WorkerHistory.jsx:122` | `activeSection` | todo · completadas |
| `src/components/WorkerHistory.jsx:123` | `filter` | all · … |
| `src/hooks/useComportamientoCompai.js:155` | `direccion` | izquierda |
| `src/pages/InventoryPage.jsx:39` | `viewMode` | dashboard · audit · reconciliation |
| `src/visual/agente/CompaiAgente.jsx:89` | `gestoIdle` | flota · … |
| `src/visual/creatures/GuacamayaCompai.jsx:300` | `momento` | flota · … |
| `src/visual/mundo3d/suelo-comparado/EscenaSueloComparado.jsx:878` | `modo` | medio · apagar · recuperar · … |
| `src/visual/mundo3d/VistaGlobalSierra.jsx:927` | `seccionAbierta` | decisiones · procedencia · … |
| `src/visual/mundo3d/VistaGlobalSierra.jsx:1678` | `horaEnsayo` | dia · … |

### 5.7 Coreografía visual, personajes, voz y juegos — 122 filas — decisión: **dejar (F6)**

**Razón F6.** Fases de animación (entradas y salidas de personajes, túneles entre mundos, fauna, turnos de juego), casi siempre ya nombradas con cadenas y avanzadas por cuadro o por temporizador. Varias ya son explícitas (`useNavegacionMundos`, `useCruceMundo`, `useTunelLamina` guardan `{fase, …}` en un solo objeto). Tocarlas cambia tiempos de animación, que es comportamiento observable, y solo se juzgan con captura y gate humano. UX: no sube sin cambiar lo que se ve.

| Dónde | Variable | Valores | Escrituras |
|---|---|---|---|
| `lib3d/terrain/clima.js:26` | `state` | rain · storm · fog · overcast | — |
| `src/compai/jaguarConducta.js:113` | `estado` | preocupada · respondiendo | — |
| `src/compai/nucleo/climaVivo.js:80` | `estado` | listo · sin-sistema · sin-clima | — |
| `src/compai/nucleo/datosFinca.js:86` | `estado` | dead · archived | — |
| `src/components/hola/viva/paisajeSonoro.js:281` | `state` | running · closed | — |
| `src/components/juego/DefensoresFincaScreen.jsx:232` | `estado` | jugando · gano · (+ valores calculados) | L615, L927 |
| `src/components/juego/DoomFincaScreen.jsx:346` | `fase` | intro · gano · ronda · jugando · perdio · (+ valores calculados) | L538, L542, L829, L841, L842, L861 |
| `src/components/juego/DoomFincaScreen.jsx:377` | `faseRef` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/components/juego/FincaWorldScene.jsx:616` | `fase` | seed · sprout · harvest · flower · fruit | — |
| `src/components/juego/MilpaSimulator.jsx:234` | `fase` | seleccion · final · seleccion-evento · temporada · resultado · siembra | L351, L365, L381, L428, L436, L447, L555 |
| `src/components/voz/angelitaViva/useConversacionAngelita.js:53` | `estado` | inicial: `VOZ_REPOSO` | — |
| `src/components/voz/angelitaViva/useConversacionAngelita.js:59` | `estadoRef` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/components/voz/angelitaViva/useConversacionAngelita.js:172` | `fase` | thinking · idle | — |
| `src/components/voz/EncuentroCompai.jsx:24` | `estado` | inicial: `VOZ_REPOSO` | — |
| `src/components/voz/GuacamayaPresente.jsx:106` | `estado` | escuchando · presente · respuesta · hablando | — |
| `src/components/voz/guacamayaViva/gestosGuacamaya.js:237` | `fase` | elegida · analizando · lista | — |
| `src/components/voz/jaguar/VentanaJaguar.jsx:22` | `paso` | inicial: `-1` | — |
| `src/components/voz/jaguar/VentanaJaguar.jsx:27` | `modo` | camara · microfono | — |
| `src/components/voz/NocheLuciernaga.jsx:12` | `estado` | hablando · mirando · pensando | — |
| `src/components/voz/usePaseoOso.js:11` | `faseRef` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/components/voz/VentanaChivito.jsx:36` | `paso` | inicial: `-1` | — |
| `src/components/voz/VentanaChivito.jsx:46` | `modo` | camara · microfono | — |
| `src/components/voz/VentanaGuacamaya.jsx:62` | `fase` | elegida · analizando · quitada · thinking | — |
| `src/components/voz/VentanaLuciernaga.jsx:25` | `paso` | inicial: `-1` | — |
| `src/components/voz/VentanaLuciernaga.jsx:32` | `modo` | camara · microfono | — |
| `src/components/voz/VentanaOso.jsx:33` | `paso` | inicial: `-1` | — |
| `src/components/voz/VentanaOso.jsx:41` | `modo` | camara · microfono | — |
| `src/components/voz/VentanaOso.jsx:43` | `estado` | escuchando · pensando · respuesta | — |
| `src/components/voz/VentanaVoz.jsx:43` | `paso` | inicial: `-1` | — |
| `src/components/voz/VentanaVoz.jsx:53` | `modo` | camara · microfono | — |
| `src/components/voz/VentanaVoz.jsx:127` | `estado` | mirando · escuchando · pensando | — |
| `src/hooks/useCompaiHechosAngelita.js:152` | `visibilityState` | hidden · visible | — |
| `src/hooks/useCompaiPaseo.js:75` | `fase` | inicial: `/** @type {'puesto'·'cerca'·'pantalla'·'volviendo'} */ ('pue` | — |
| `src/hooks/useCompaiPaseo.js:76` | `estadoRef` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/hooks/useCompaiPaseo.js:147` | `fase` | volviendo · puesto · cerca · pantalla | — |
| `src/hooks/useComportamientoCompai.js:160` | `estadoRef` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/hooks/useComportamientoCompai.js:268` | `fase` | pausa · movimiento | — |
| `src/visual/agente/angelitaAvisoTipos.js:152` | `estado` | calma · aviso · luto · celebra | — |
| `src/visual/agente/angelitaDibujo.js:69` | `estado` | marco · sin-senal | — |
| `src/visual/agente/AngelitaEntrada.jsx:106` | `fase` | inicial: `sinTeatro ? 'lista' : 'espera'` | — |
| `src/visual/agente/AngelitaEntrada.jsx:140` | `fase` | lista · gafas · brillo · crece · quieta · espera | — |
| `src/visual/agente/AngelitaSalida.jsx:87` | `fase` | inicial: `sinTeatro ? 'ido' : 'lista'` | — |
| `src/visual/agente/AngelitaSalida.jsx:111` | `fase` | ido · mistico · encoge | — |
| `src/visual/agente/CompaiEntradaSalida.jsx:71` | `modo` | salida · lista · entrada | — |
| `src/visual/agente/GuacamayaEntrada.jsx:81` | `fase` | inicial: `sinTeatro ? 'lista' : 'espera'` | — |
| `src/visual/agente/GuacamayaEntrada.jsx:110` | `fase` | lista · crece · quieta | — |
| `src/visual/agente/GuacamayaSalida.jsx:60` | `fase` | inicial: `sinTeatro ? 'completo' : 'espera'` | — |
| `src/visual/agente/GuacamayaSalida.jsx:82` | `fase` | completo · aleta · mistico | — |
| `src/visual/creatures/escenaGuardianes.js:152` | `fase` | inicial: `/** @type {string·null} */ (null)` | — |
| `src/visual/creatures/escenaGuardianes.js:153` | `cbFase` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/creatures/EspirituGuardian.jsx:119` | `estado` | alerta · celebrando | — |
| `src/visual/creatures/faunaAmbiental.js:142` | `fase` | descansa · entra · gesto · sale | — |
| `src/visual/creatures/FaunaAmbiental.jsx:149` | `estado` | inicial: `() => crearEstado(cast, limite)` | — |
| `src/visual/creatures/FaunaAmbiental.jsx:150` | `estadoRef` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/creatures/LuciernagaCuerpo.jsx:10` | `estado` | acompana · idle | — |
| `src/visual/creatures/MomentoGuardianes.jsx:74` | `fase` | guardia · paso · alerta · transformacion · despedida | — |
| `src/visual/effects/CirculoRotoMilpa.jsx:315` | `fase` | inicial: `roto ? 'roto' : 'quieta'` | — |
| `src/visual/effects/CirculoRotoMilpa.jsx:353` | `fase` | activa · roto | — |
| `src/visual/mundo3d/agua/DemoCicloAgua.jsx:74` | `fase` | inicial: `/** @type {number·null} */ (null)` | — |
| `src/visual/mundo3d/aguacatal/MundoAguacatal.jsx:88` | `paso` | inicial: `0` | — |
| `src/visual/mundo3d/beneficos/EscenaBeneficos.jsx:559` | `paso` | inicial: `reducedMotion ? Math.round(T_QUIETO * PASOS) : 0` | — |
| `src/visual/mundo3d/bosque/FaunaBosque.jsx:324` | `fase` | liba · dardo · seVa · vuelve · ausente · quieta · oculta · asoma · olfatea · seMete | — |
| `src/visual/mundo3d/cacao/MundoCacao.jsx:106` | `paso` | inicial: `0` | — |
| `src/visual/mundo3d/cafetal/MundoCafetal.jsx:86` | `paso` | inicial: `0` | — |
| `src/visual/mundo3d/cana/MundoCana.jsx:48` | `paso` | inicial: `0` | — |
| `src/visual/mundo3d/cana/trapiche.geom.js:604` | `estado` | humedo · seco | — |
| `src/visual/mundo3d/casa/MundoCasaAdentro.jsx:155` | `paso` | inicial: `0` | — |
| `src/visual/mundo3d/CondorBillboard.jsx:227` | `fase` | termica · planeo · pasada · aterrizaje · posado · despegue | — |
| `src/visual/mundo3d/escenas/AnimalMomento.jsx:88` | `modo` | llega · nace · muerte | — |
| `src/visual/mundo3d/escenas/CorralVivo.jsx:390` | `estado` | nace · muerte · vendido · sano | — |
| `src/visual/mundo3d/escenas/CorralVivo.jsx:1003` | `modo` | oculto · plena · punto | — |
| `src/visual/mundo3d/escenas/JaguarCompaiEscena.jsx:112` | `fase` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/mundo3d/escenas/JaguarCompaiEscena.jsx:116` | `modoRef` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/mundo3d/escenas/LuciernagaCompaiEscena.jsx:108` | `fase` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/mundo3d/escenas/OsoBastonCompaiEscena.jsx:120` | `fase` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/mundo3d/escenas/OsoBastonCompaiEscena.jsx:123` | `modoRef` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/mundo3d/escenas/useEntradaAbeja.jsx:147` | `fase` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/mundo3d/escenas/ZariguyaCompaiEscena.jsx:115` | `fase` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/mundo3d/fauna/JaguarBillboard.jsx:143` | `fase` | anda · acecha · observa | — |
| `src/visual/mundo3d/frutales/MundoFrutales.jsx:88` | `paso` | inicial: `0` | — |
| `src/visual/mundo3d/grafo/NavegadorGrafo.jsx:260` | `estado` | cargando · vacio · listo | L270, L274, L277 |
| `src/visual/mundo3d/invernadero/MundoInvernadero.jsx:109` | `paso` | inicial: `0` | — |
| `src/visual/mundo3d/kit/relieveImagen.js:62` | `alphaMode` | mask · ignore | — |
| `src/visual/mundo3d/laminas2d/LaminaMundo.jsx:332` | `estado` | muerte · nace · vendido | — |
| `src/visual/mundo3d/lecheria/MundoLecheria.jsx:93` | `paso` | inicial: `0` | — |
| `src/visual/mundo3d/Mundo.jsx:168` | `modo` | 3d · ausente · ruta · 2d | — |
| `src/visual/mundo3d/OnboardingDescubrir.jsx:52` | `paso` | inicial: `-1` | — |
| `src/visual/mundo3d/papa/MundoPapa.jsx:86` | `paso` | inicial: `0` | — |
| `src/visual/mundo3d/polinizadores/AmenazaVeneno.jsx:110` | `paso` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/mundo3d/polinizadores/EnjambrePolinizadores.jsx:234` | `estado` | busca · vuelve · liba | — |
| `src/visual/mundo3d/quinua/MundoQuinua.jsx:96` | `paso` | inicial: `0` | — |
| `src/visual/mundo3d/sierra/climaSierra.js:31` | `estado` | fresco · viejo | — |
| `src/visual/mundo3d/sierra/climaSierra.js:177` | `estadoDato` | conocido-cubierto · sin-dato | — |
| `src/visual/mundo3d/sierra/composicionNubesSierra.js:9` | `fase` | el_nino · la_nina | — |
| `src/visual/mundo3d/sierra/descensoSierra.js:197` | `fase` | el_nino · la_nina · nino | — |
| `src/visual/mundo3d/sierra/EscenaDescensoSierra.jsx:845` | `refEstado` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/mundo3d/transiciones/CamaraCruce.jsx:84` | `fase` | entrando · saliendo · umbral | — |
| `src/visual/mundo3d/transiciones/TunelLamina.jsx:80` | `fase` | entrando · saliendo | — |
| `src/visual/mundo3d/transiciones/useCruceMundo.js:31` | `estado` | inicial: `{ fase: 'quieto', destino: null }` | — |
| `src/visual/mundo3d/transiciones/useCruceMundo.js:33` | `estadoRef` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/mundo3d/transiciones/useCruceMundo.js:44` | `fase` | quieto · saliendo | — |
| `src/visual/mundo3d/transiciones/useTunelLamina.js:33` | `estado` | inicial: `{ fase: 'quieto', destino: null, rect: null }` | — |
| `src/visual/mundo3d/transiciones/useTunelLamina.js:37` | `estadoRef` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/mundo3d/transiciones/useTunelLamina.js:45` | `fase` | quieto · saliendo | — |
| `src/visual/mundo3d/transiciones/VeloOdyssey.jsx:98` | `fase` | entrando · saliendo | — |
| `src/visual/mundo3d/TransicionSierraMundo.jsx:659` | `estadoRef` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/mundo3d/TransicionSierraMundo.jsx:688` | `paso` | inicial: `0` | — |
| `src/visual/mundo3d/TunelOdyssey.jsx:61` | `fase` | acercando · saliendo · valle3d · iris-abre · iris-cierra | — |
| `src/visual/mundo3d/useCicloDia.js:58` | `modo` | demo · fijo | — |
| `src/visual/mundo3d/useFincaViva.js:87` | `fase` | el_nino · la_nina | — |
| `src/visual/mundo3d/useNavegacionMundos.js:32` | `modo` | 3d · 2d | — |
| `src/visual/mundo3d/useNavegacionMundos.js:52` | `estado` | inicial: `{ fase: 'valle', mundoId: null }` | — |
| `src/visual/mundo3d/useNavegacionMundos.js:64` | `faseRef` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/mundo3d/useNavegacionMundos.js:105` | `fase` | viajando · regresando · mundo | — |
| `src/visual/mundo3d/useTunelOdyssey.js:10` | `fase` | inicial: `'valle3d'` | — |
| `src/visual/mundo3d/useTunelOdyssey.js:23` | `faseViaje` | acercando · saliendo | — |
| `src/visual/mundo3d/VistaGlobalSierra.jsx:730` | `estadoConocimiento` | medido · pronostico | — |
| `src/visual/mundo3d/VistaGlobalSierra.jsx:780` | `estado` | fresco · viejo · consultando · error · sin_finca | — |
| `src/visual/mundo3d/VistaGlobalSierra.jsx:978` | `ensoFase` | nino · nina · neutral | — |
| `src/visual/mundo3d/yuca/MundoYuca.jsx:94` | `paso` | inicial: `0` | — |
| `src/visual/voz/IrisVoz.jsx:58` | `estadoRef` (ref) | fase guardada en un ref, leída por cuadro o por temporizador | — |
| `src/visual/voz/vozViva.js:57` | `estado` | escuchando · hablando · pensando | — |

### 5.8 Variables de módulo: cachés y promesas en vuelo — 23 filas — decisión: **dejar (F7)**

**Razón F7.** Pares `cache` + `promesaEnVuelo` (o varios `let` de un reproductor) a nivel de módulo. Son memoización de vuelo único, no fases de la aplicación; no las ve la persona. La excepción con más estado es `ttsService.js` (diez variables de reproducción): candidata de DX/AX, pero es audio y no se verifica sin aparato.

| Dónde | Variables |
|---|---|
| `src/components/hola/viva/holaViva.js:81` | `motor` (L81), `bioma` (L82), `arrancado` (L83), `mic` (L84), `temporizadorError` (L85), `personaHabla` (L101), `turnoVoz` (L313) |
| `src/components/onboardingDescenso/descensoMundo.js:419` | `SPR_LUZ` (L419), `SPR_HALO` (L420), `SPR_NUBE` (L421) |
| `src/core/loadProModules.js:84` | `sessionListenerInstalled` (L84), `pending` (L135) |
| `src/db/catalogDB.js:4` | `dbInstance` (L4), `initPromise` (L5) |
| `src/db/dbCore.js:124` | `dbInstance` (L124), `connectionPromise` (L125) |
| `src/hooks/useChagraStats.js:40` | `statsRequest` (L40), `statsFetch` (L41) |
| `src/services/angelitaVariedad.js:68` | `memoria` (L68), `telemetria` (L482) |
| `src/services/climaService.js:55` | `memCache` (L55), `inFlight` (L56) |
| `src/services/glosarioCaucaService.js:41` | `_forwardEntries` (L41), `_reverseEntries` (L42), `_forwardEntriesNarino` (L43), `_reverseEntriesNarino` (L44) |
| `src/services/grafoRelations.js:42` | `relationsCache` (L42), `rootCache` (L44), `relationsLoadPromise` (L46) |
| `src/services/operatorPhotoService.js:81` | `_memoryPhoto` (L81), `_hydratePromise` (L83) |
| `src/services/ragRetriever.js:70` | `corpusCache` (L70), `avgDocLen` (L71), `embeddingsCache` (L75), `embeddingsLoadPromise` (L76), `corpusLoadPromise` (L83), `tierGateBlockCount` (L108), `prewarmController` (L545), `prewarmPromise` (L546) |
| `src/services/segundaOpinionFoto.js:59` | `enVuelo` (L59), `habilitado` (L62) |
| `src/services/skyConditionService.js:299` | `memCache` (L299), `inFlight` (L300) |
| `src/services/ttsService.js:360` | `voicesLoaded` (L360), `kokoroAvailable` (L361), `currentKokoroAudio` (L362), `currentKokoroUrl` (L363), `lastSpoken` (L370), `lastSpokenOptions` (L371), `audioPlaying` (L386), `sentenceQueueCancelled` (L453), `sentenceQueueController` (L454), `generacionFrase` (L673) |
| `src/services/visionWarmService.js:41` | `_warmInFlight` (L41), `_lastWarmAt` (L42) |
| `src/utils/plagaImageResolver.js:46` | `indexCache` (L46), `loadPromise` (L48) |
| `src/utils/speciesImageResolver.js:10` | `imageCache` (L10), `loadPromise` (L11) |
| `src/visual/mundo3d/atmosfera/clima/climaVivoData.js:113` | `_halo` (L113), `_trazo` (L132) |
| `src/visual/mundo3d/grafo/grafoModelo.js:67` | `cacheCrudo` (L67), `cargaEnVuelo` (L68) |
| `src/visual/mundo3d/sierra/EscenaDescensoSierra.jsx:232` | `nieblaRefs` (L232), `nieblaHook` (L233) |
| `src/visual/mundo3d/sonidosAmbientales.js:31` | `ctx` (L31), `osc` (L33), `gain` (L35) |
| `src/visual/mundo3d/usePerformanceMonitor.jsx:237` | `fpsUltimo` (L237), `frioPersistente` (L238), `calientePersistente` (L239) |

### 5.9 Valores de datos comparados, no estado propio — 84 filas — decisión: **dejar (F8)**

**Razón F8.** Comparaciones contra cadenas que vienen de DATOS o de props: estado de un activo (`active`/`archived`/`dead`), fase ENSO, fase lunar, etapa fenológica, etiqueta de un resultado (`ok`/`no_data`). Son enumeraciones de dominio o del contrato con el servidor, no máquinas de la interfaz. Centralizarlas en constantes ayudaría a DX/AX, pero varias están persistidas o vienen del backend.

| Dónde | Campo | Valores vistos |
|---|---|---|
| `src/components/AgentScreen/angelitaConversation.js:22` | `phase` | listening · speaking |
| `src/components/AgentScreen/ChatHistory.jsx:351` | `state` | pending · idea |
| `src/components/AgentScreen/photoAnalysis.js:130` | `groundedStatus` | verified · partial-match |
| `src/components/AgentScreen/VoiceStatusStrip.jsx:127` | `phase` | listening · thinking · speaking · idle |
| `src/components/almanaque/AlmanaqueScreen.jsx:93` | `fase` | llena · creciente · menguante · nueva |
| `src/components/animales/LotesAnimales.jsx:60` | `mode` | lot · event · product |
| `src/components/anofinca/AnoFincaScreen.jsx:425` | `estado` | hoy · pasado · proximo |
| `src/components/AssetDetailView.jsx:526` | `status` | loading · generic · present · error · dead |
| `src/components/AssetsDashboard.jsx:720` | `trackingMode` | individual · aggregate |
| `src/components/AssetsDashboard.jsx:1259` | `mode` | polygon · point |
| `src/components/CalendarioFincaScreen.jsx:181` | `status` | ok · no_data |
| `src/components/CaseStudyDetail.jsx:387` | `status` | certified · rejected · pending |
| `src/components/CaseStudyDetail.jsx:1031` | `state` | in_treatment · escalated |
| `src/components/ChagraAgentAvatarColibri.jsx:289` | `state` | thinking · listening |
| `src/components/CicloVivo/CicloVivoFullView.jsx:167` | `estado` | proximamente · activo |
| `src/components/clima/cieloHoy.js:133` | `estado` | con-cifra · fresco · vencido |
| `src/components/clima/ClimaBoletinScreen.jsx:1140` | `estado` | sin-dato · sin-hora · vencido · noche · dia |
| `src/components/clima/ClimaBoletinScreen.jsx:1456` | `phase` | el_nino · la_nina |
| `src/components/clima/mundo/MundoClima.jsx:54` | `estado` | listo · sin-ubicacion · cargando · sin-dato |
| `src/components/clima/mundo/useFuenteClima.js:17` | `phase` | el_nino · la_nina |
| `src/components/common/AIStreamPanel.jsx:72` | `phase` | finished · closing · streaming · idle |
| `src/components/CromatografiaScreen.jsx:636` | `estado` | vivo · degradado · quimicalizado · incertidumbre_alta |
| `src/components/DeepResearchCard.jsx:131` | `status` | running · submitting · done · error · offline · disabled |
| `src/components/DirectorioEspecies/DirectorioEspeciesScreen.jsx:77` | `mode` | especies · plagas |
| `src/components/DirectorioEspecies/SpeciesAtlas.jsx:68` | `mode` | written · identify · explore |
| `src/components/DirectorioEspecies/SpeciesAtlas.jsx:73` | `stageId` | planta · semilla · brote |
| `src/components/FarmSeals.jsx:14` | `status` | certificado · vencido · declarado |
| `src/components/goteo/RiegoDeHoy.jsx:38` | `estado` | sin-sistema · sin-clima |
| `src/components/HarvestLog.jsx:88` | `status` | multiple · single · none |
| `src/components/HarvestLog.jsx:193` | `uploadStatus` | syncing · pending |
| `src/components/HarvestLog.jsx:256` | `statusAfterSave` | syncing · synced |
| `src/components/hoy/HoyEnFincaScreen.jsx:537` | `pushState` | enabled · unsupported · loading · error · location_required · deactivate_error |
| `src/components/hoy/HoyEnFincaScreen.jsx:586` | `status` | no_calculation · needs_water · rain_sufficient · below_threshold |
| `src/components/InputLog.jsx:121` | `statusAfterSave` | synced · syncing |
| `src/components/InputLog.jsx:145` | `uploadStatus` | pending · syncing |
| `src/components/lotes/LoteCroquisPlaceholder.jsx:132` | `toolMode` | tap · walk |
| `src/components/lotes/LoteIotReadingCard.jsx:47` | `status` | fresh · stale |
| `src/components/lotes/LoteIotReadingCard.jsx:67` | `localStatus` | loading · empty · unavailable · stale · fresh |
| `src/components/MapPicker.jsx:175` | `mode` | point · polygon |
| `src/components/modoCampo/ModoCampoPanel.jsx:115` | `status` | listening · error |
| `src/components/MultiFincaGlobe.jsx:194` | `estado` | activo · piloto |
| `src/components/NotificationsBell.jsx:307` | `phase` | neutral · nino_fuerte · nino_moderado · nina_fuerte · nina_moderada · nino_debil · nina_debil |
| `src/components/PlantasV2Screen.jsx:46` | `status` | ok · no_data |
| `src/components/RegistroVozConfirm.jsx:319` | `status` | multiple · single · none |
| `src/components/SeedingLog.jsx:375` | `uploadStatus` | syncing · pending |
| `src/components/SpeciesImage.jsx:124` | `status` | ready · loading |
| `src/components/SpeciesSelect.jsx:675` | `status` | verified · partial-match · rejected · sidecar-disabled · offline · no-binomial · sidecar-error |
| `src/components/SplitFlow.jsx:34` | `trackingMode` | individual · aggregate |
| `src/components/TaskLogScreen.jsx:185` | `status` | completed · synced |
| `src/components/TelemetryAlerts.jsx:402` | `state` | unavailable · unknown |
| `src/data/climaBoletines.js:177` | `fase` | nino · nina |
| `src/hooks/useTtsAmplitude.js:35` | `state` | closed · suspended |
| `src/services/actionExecutor.js:102` | `status` | rejected · edited · approved · executed |
| `src/services/agentComplexIngest.js:303` | `status` | executed · failed · rejected · rejected_by_farmos |
| `src/services/angelitaInteligencia.js:355` | `estado` | aviso · calma · husmea |
| `src/services/atmosphereService.js:203` | `phase` | string · la_nina · el_nino · neutral |
| `src/services/capabilityHealth.js:109` | `status` | down · ok · soon |
| `src/services/climaCultivoSuggestions.js:70` | `status` | dead · archived |
| `src/services/climaService.js:334` | `phase` | neutral · nino_fuerte · nina_fuerte · nino_moderado · nina_moderada · string |
| `src/services/climateCycleService.js:58` | `ensoPhase` | el_nino · la_nina |
| `src/services/climateCycleService.js:108` | `stageCode` | vegetative · flowering |
| `src/services/compaiPaseoPlanificador.js:128` | `fase` | puesto · pantalla |
| `src/services/consejoRiego.js:236` | `estado` | sin-dato · fresco |
| `src/services/deepResearchClient.js:234` | `status` | done · error |
| `src/services/ensoService.js:50` | `phase` | string · neutral · el_nino · la_nina |
| `src/services/ensoSiembraResponder.js:156` | `fase` | nina · nino |
| `src/services/episodicMemoryService.js:142` | `status` | active · cancelled · computed |
| `src/services/farmCalendarService.js:128` | `status` | computed · no_data |
| `src/services/fincaSceneService.js:261` | `status` | cancelled · active |
| `src/services/fincaSceneService.js:316` | `fase` | harvest · fruit |
| `src/services/hoyEnFincaService.js:149` | `status` | active · computed |
| `src/services/iotMockService.js:63` | `state` | unavailable · unknown · null |
| `src/services/iotTelemetryService.js:56` | `status` | empty · stale · fresh |
| `src/services/llmTelemetryService.js:213` | `status` | success · error · abort |
| `src/services/loteService.js:74` | `mode` | point · polygon |
| `src/services/phenologyCalculator.js:228` | `status` | computed · template_missing |
| `src/services/photoMapService.js:127` | `state` | boundary · inside |
| `src/services/planGeneratorService.js:221` | `lunarPhase` | creciente · llena |
| `src/services/semaforoConfianza.js:372` | `mode` | string · experto · maestro |
| `src/services/visionJudgeReview.js:11` | `status` | async · done · pending · error |
| `src/services/vitalidadEspirituService.js:160` | `status` | cancelled · active · archived |
| `src/store/useAngelitaStore.js:136` | `estado` | husmea · celebra · luto |
| `src/store/useCaseStudyStore.js:488` | `status` | certified · rejected |
| `src/utils/cromatografiaInterpretacion.js:581` | `estado` | vivo · degradado · quimicalizado |

### 5.10 Maquetas (`src/mockups`, `src/components/mockups`) — 76 filas — decisión: **dejar (F9)**

**Razón F9.** Pantallas de exploración de diseño. Una fila por fichero con su primera señal. No son producto: explicitar su estado no mejora nada para quien usa la app.

| Dónde | Variable | Valores |
|---|---|---|
| `src/components/mockups/HojaVidaMataMockup.jsx:88` | `etapaId` | inicial: `MATA_MUESTRA.etapaActual` |
| `src/mockups/AliadosFinca3D.jsx:877` | `listo` | false |
| `src/mockups/AngelitaViva.jsx:55` | `visema` | V3 |
| `src/mockups/applicationFactoryMock.js:63` | `phase` | escuchando · confirmacion · transcribiendo · entendiendo · construyendo · entregando |
| `src/mockups/ArtesaniaAndinaDemo.jsx:236` | `listo` | false |
| `src/mockups/AvatarGameLibre.jsx:378` | `espirituId` | chivito |
| `src/mockups/BosqueTresEstratos3D.jsx:83` | `listo` | false |
| `src/mockups/CaraProd3D.jsx:99` | `fase` | entrada |
| `src/mockups/CatalogoInfraDemo.jsx:246` | `tipo` | invernaderoTunel |
| `src/mockups/ClimaAtmosferaArte.jsx:190` | `clima` | niebla |
| `src/mockups/ColocarInfraestructura.jsx:302` | `ver2d` | false |
| `src/mockups/ConversacionVoz.jsx:137` | `reproduciendo` | false |
| `src/mockups/ConversacionVoz.jsx:138` | `paso` | inicial: `0` |
| `src/mockups/DiaEnFinca.jsx:241` | `franja` | dia |
| `src/mockups/DiagnosticoSobreFoto.jsx:69` | `phase` | pick |
| `src/mockups/EfectosFuncionalesDemo.jsx:650` | `efecto` | invernadero |
| `src/mockups/EnsenaDibujando.jsx:81` | `conceptoId` | asociacion |
| `src/mockups/EntradaValle3D.jsx:151` | `focoId` | null |
| `src/mockups/FabricaAplicacionesVoz.jsx:17` | `phase` | escuchando · confirmacion · agotado |
| `src/mockups/GuacamayaViva.jsx:53` | `visema` | V3 |
| `src/mockups/HomeCampesino.jsx:73` | `modo` | noche · dia |
| `src/mockups/Infraestructura3D.jsx:52` | `enVista` | false |
| `src/mockups/JuegoLaMilpa.jsx:98` | `phase` | play · won · intro |
| `src/mockups/JuegoMiFincaOdyssey.jsx:533` | `activa` | null |
| `src/mockups/Mercado.jsx:18` | `unidad` | todos |
| `src/mockups/metalslug/DuoPerros.jsx:108` | `estado` | recogido · entregado · olido · revelado |
| `src/mockups/MetalSlugCampo.jsx:514` | `pantalla` | intro |
| `src/mockups/MockupGuardianesNarrativos.jsx:216` | `estadoId` | inicial: `ESTADOS[0].id` |
| `src/mockups/MockupGuardianesNarrativos.jsx:217` | `saliendo` | false |
| `src/mockups/MomentoVentaMercado3D.jsx:1120` | `momento` | venta |
| `src/mockups/MontanaMundos.jsx:142` | `dir` | naturalista |
| `src/mockups/MontanaMundosCampesino.jsx:746` | `modo` | finca |
| `src/mockups/MontanaMundosCine.jsx:742` | `dir` | naturalista |
| `src/mockups/Mundo3DClima.jsx:133` | `status` | no-data · pending |
| `src/mockups/MundoAbejas3D.jsx:1300` | `seleccion` | polinizacion |
| `src/mockups/MundoAgua3D.jsx:1305` | `listo` | false |
| `src/mockups/MundoBoticaCana3D.jsx:2344` | `paso` | inicial: `0` |
| `src/mockups/MundoCafe3D.jsx:868` | `listo` | false |
| `src/mockups/MundoCompost3D.jsx:1267` | `listo` | false |
| `src/mockups/MundoFermentos3D.jsx:1066` | `listo` | false |
| `src/mockups/MundoFrutales3D.jsx:712` | `listo` | false |
| `src/mockups/MundoGallinero3D.jsx:507` | `paso` | pastoreo |
| `src/mockups/MundoLecheria3D.jsx:1282` | `listo` | false |
| `src/mockups/MundoLeguminosas3D.jsx:1169` | `listo` | false |
| `src/mockups/MundoMercado3D.jsx:230` | `activa` | origen |
| `src/mockups/MundoMicrofauna3D.jsx:1032` | `listo` | false |
| `src/mockups/MundoPiscicultura3D.jsx:845` | `listo` | false |
| `src/mockups/MundoPolinizadores3D.jsx:70` | `ver2d` | false |
| `src/mockups/MundoSanidad3D.jsx:1262` | `listo` | false |
| `src/mockups/MundoSueloVivo3D.jsx:1090` | `listo` | false |
| `src/mockups/MundoVergelFrutal3D.jsx:380` | `estado` | verde · flor |
| `src/mockups/murales/FichasMural.jsx:108` | `etapaId` | plantula |
| `src/mockups/MuralesNewDonk.jsx:234` | `fase` | valle3d · juego2d · acercando · saliendo |
| `src/mockups/MuralesNewDonk.jsx:423` | `fase` | inicial: `() => (` |
| `src/mockups/NewDonk2Den3D.jsx:386` | `fase` | valle3d · juego2d · acercando · saliendo |
| `src/mockups/NewDonk2Den3D.jsx:547` | `fase` | inicial: `() => (` |
| `src/mockups/ParamoHumboldt3D.jsx:290` | `vista` | nacedero |
| `src/mockups/PrimerCultivo.jsx:250` | `climaId` | templado |
| `src/mockups/PrimerCultivo.jsx:251` | `pasoIx` | inicial: `0` |
| `src/mockups/SaludFinca.jsx:59` | `estado` | sana · obs · mirada |
| `src/mockups/TransicionAgentePlano.jsx:80` | `vista` | valle |
| `src/mockups/TransicionesOdysseyDemo.jsx:61` | `lugar` | casa |
| `src/mockups/TresEntsGradiente3D.jsx:293` | `abierta` | false |
| `src/mockups/valle/AcompananteMundo.jsx:60` | `voz` | true |
| `src/mockups/valle/directorValle.js:108` | `modo` | sobrio · fijo · cine |
| `src/mockups/valle/HatoMovil.jsx:464` | `modo` | camina · cita · arrea · para · camino · corre |
| `src/mockups/valle/MinimapaValle.jsx:161` | `abierto` | true |
| `src/mockups/valle/Valle3D.jsx:1682` | `modo` | plena · oculto |
| `src/mockups/ValleLluvia3D.jsx:887` | `fase` | nubes |
| `src/mockups/ValleNoche3D.jsx:997` | `listo` | false |
| `src/mockups/vitrina3d/VitrinaCriaturas.jsx:172` | `seccion` | criaturas |
| `src/mockups/vitrina3d/VitrinaInfraestructura.jsx:87` | `enVista` | false |
| `src/mockups/vitrina3d/VitrinaMundos.jsx:212` | `tier` | alto |
| `src/mockups/VitrinaMaestraMundos.jsx:1216` | `fase` | galeria |
| `src/mockups/VozConForma.jsx:126` | `manual` | reposo |
| `src/mockups/VozConForma.jsx:128` | `paso` | inicial: `0` |

## 6. Temporizadores sin dueño (familia transversal)

`setTimeout(() => setX(…))` sin `clearTimeout` asociado al estado que lo creó: 80 sitios en 52 ficheros (sin contar maquetas). Es el mecanismo detrás de los dos defectos corregidos y del hallazgo de `NetworkStatusBar`. No todos son defecto: muchos apagan un aviso que nada más puede pisar. Lista para revisarlos uno a uno:

| Fichero (primera aparición) | Líneas |
|---|---|
| `src/App.jsx:1486` | L1486, L1867 |
| `src/components/agent/ColibriTransition.jsx:97` | L97, L100 |
| `src/components/AgentFab.jsx:314` | L314, L518, L519 |
| `src/components/AgentScreen/AgentScreen.jsx:420` | L420, L728, L752, L3948, L4182, L4393 |
| `src/components/AgentScreen/ChatBubble.jsx:79` | L79 |
| `src/components/AgentScreen/LongWaitNotice.jsx:28` | L28, L29 |
| `src/components/AppSuspenseFallback.jsx:45` | L45 |
| `src/components/AssetDetailView.jsx:135` | L135, L616, L862 |
| `src/components/BitacoraEntryDetail.jsx:212` | L212, L388 |
| `src/components/CaseStudyDetail.jsx:1198` | L1198 |
| `src/components/CicloObservacion.jsx:37` | L37 |
| `src/components/CicloVivo/CicloVivoFullView.jsx:125` | L125 |
| `src/components/clima/ClimaBoletinScreen.jsx:232` | L232 |
| `src/components/common/Confetti.jsx:58` | L58 |
| `src/components/common/ExternalAiButton.jsx:94` | L94 |
| `src/components/CompaiOverlay.jsx:135` | L135 |
| `src/components/dashboard/AgentRedMenu.jsx:958` | L958 |
| `src/components/dashboard/AIStatusFooter.jsx:172` | L172 |
| `src/components/dashboard/AnalisisProactivoIA.jsx:208` | L208 |
| `src/components/FarmMap.jsx:190` | L190 |
| `src/components/FarmProcessConfirmCard.jsx:142` | L142 |
| `src/components/FieldFeedback.jsx:193` | L193, L213 |
| `src/components/GlaciarHistorialScreen.jsx:96` | L96 |
| `src/components/GlaciarReporteScreen.jsx:339` | L339 |
| `src/components/hola/EscenaHolaAngelita.jsx:76` | L76 |
| `src/components/hola/viva/CapaViva.jsx:80` | L80 |
| `src/components/LoginScreen.jsx:164` | L164, L165 |
| `src/components/modoCampo/EjemplosVoz.jsx:124` | L124 |
| `src/components/MultiFincaGlobe.jsx:94` | L94, L95 |
| `src/components/NetworkStatusBar.jsx:120` | L120 |
| `src/components/ProfileScreen.jsx:338` | L338 |
| `src/components/Settings/ProfileSwitcher.jsx:40` | L40, L46 |
| `src/components/TelemetryAlerts.jsx:181` | L181 |
| `src/components/UpdateAvailableBanner.jsx:40` | L40 |
| `src/hooks/useAngelitaGuia.js:270` | L270 |
| `src/hooks/useDescensoLeccion.js:95` | L95 |
| `src/hooks/useIdleDetection.js:43` | L43 |
| `src/hooks/useIdleVisibility.js:41` | L41 |
| `src/hooks/useModoCampo.js:94` | L94 |
| `src/prodApp/ProdChagraApp.jsx:337` | L337 |
| `src/visual/agente/Angelita.jsx:413` | L413, L432, L466, L485, L494, L502, L573, L729, L1196 |
| `src/visual/agente/useAngelitaPresencia.js:46` | L46 |
| `src/visual/creatures/MomentoGuardianes.jsx:62` | L62 |
| `src/visual/creatures/PerroTransicion.jsx:91` | L91 |
| `src/visual/creatures/transformacion.js:97` | L97 |
| `src/visual/effects/CirculoRotoMilpa.jsx:331` | L331 |
| `src/visual/mundo3d/escenas/LuciernagaCompaiEscena.jsx:328` | L328 |
| `src/visual/mundo3d/escenas/OsoBastonCompaiEscena.jsx:325` | L325 |
| `src/visual/mundo3d/suelo-comparado/EscenaSueloComparado.jsx:890` | L890 |
| `src/visual/mundo3d/TransicionSierraMundo.jsx:776` | L776, L778 |
| `src/visual/mundo3d/useNavegacionMundos.js:76` | L76 |
| `src/visual/mundo3d/VistaGlobalSierra.jsx:1751` | L1751, L1756, L1795 |

## 7. Cómo se hizo y qué no se miró

**Barrido mecánico** sobre los 1.890 ficheros `.js`/`.jsx` de `src/` y `lib3d/` (sin pruebas), buscando:

1. `useState` inicializado con una cadena literal, o con `true`/`false`/`null` (dos o más por fichero).
2. `useState` cuyo nombre contiene fase, estado, status, paso, step, stage o etapa, con cualquier inicializador.
3. `useRef` con nombre de fase.
4. `let` a nivel de módulo inicializado con literal (dos o más por fichero).
5. Comparaciones `x === 'literal'` sobre nombres de fase con al menos dos valores distintos.
6. Banderas de primer nivel en los stores de `src/store/`.
7. `setTimeout(() => setX(…))`.

**Lectura a mano** de los ficheros del apartado 4, de las dos máquinas explicitadas y de sus consumidores.

**Límites, sin adornos:**

- Las filas del apartado 5 son mecánicas: la línea y los valores salen del código, pero **no leí cada fichero**. La clasificación por familia se hace por nombre de variable y puede estar equivocada en filas sueltas (un `pending` que no sea «guardando», por ejemplo).
- El barrido **no ve**: estado guardado en objetos (`useState({ … })`) salvo que el nombre lo delate; banderas dentro de clases (se añadió `syncManager` a mano; puede haber otras); estado en `sessionStorage`/`localStorage`; fases codificadas en números; máquinas repartidas entre varios ficheros por eventos de `window`.
- «No verifiqué camino real» significa exactamente eso: el estado es representable y no comprobé si se alcanza. No significa que sea inalcanzable.
- No se revisó `public/sw.js` (ciclo de vida del service worker) ni los `.html` sueltos de la raíz.
- El inventario es de una sola pasada y de un solo lector: nadie más revisó la clasificación.

Comprobación hecha sobre la rama con `node scripts/verificar-maquinas-de-estado.mjs`: cada `archivo:línea` de este documento existe, y en las filas de tabla la línea citada contiene la variable nombrada (543 filas y 401 variables secundarias, 0 fallos). El comprobador se probó antes contra una copia con cuatro referencias alteradas a propósito y las detectó todas.
