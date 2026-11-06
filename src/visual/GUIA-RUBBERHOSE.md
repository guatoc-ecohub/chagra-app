# GUIA-RUBBERHOSE — la ley de los personajes de Chagra

> **La regla madre**: un personaje aprobado se ve **igual en todas partes** —
> librería, valle, mundos, UI. Misma tinta, misma cadencia, misma paleta,
> mismos gestos. Eso no se logra con buena intención sino **por construcción**:
> derivando SIEMPRE de la fuente única. Si vas a dibujar un bicho, **no lo
> dibujés**: importalo.

Fuente única como datos: **`src/visual/creatures/rubberhoseSpec.js`**.
Auditoría que originó esta guía: §6 (2026-07-14).

---

## 1. Los dos registros — y no se mezclan

| | **RUBBER-HOSE** (caricatura con alma) | **REALISTA** |
|---|---|---|
| Quiénes | Los PERSONAJES: los 9 bichos (abeja Angelita, colibrí, oso andino, rana andina, perezoso, ardilla, jaguar, morrocoy, borugo), el Ent frailejón, los aliados de escena (lombriz, mariposa, escarabajo), la fauna benéfica del kit (mariquita, abejorro) y el espíritu guardián. | La fauna secundaria del monte, los animales de finca (ganado, gallinas), los cultivos, la flora procedural y los mundos 3D. |
| Rasgos | Ojos de goma con catchlight, tinta gruesa cálida que respira (line-boil), squash&stretch, miembros manguera con mitón, chapetas, sonrisa. | Proporciones naturales, sin contorno de tinta, sin ojos de goma, sin chapetas, sin line-boil. |
| Fuente | `src/visual/creatures/` (componentes + identidades + `creatures.css`). | `faunaAmbiental`/`faunaFuncional`, `mundo3d/` (geometrías), `paleta/paletaMadre`. |

**Test de registro**: un dibujo con ojos-catchlight y contorno de tinta en un
mundo realista, o un personaje sin su cadencia `rh-*`, es un **bug de
registro**. Consultable por código: `esRubberhose(slug)` en `rubberhoseSpec.js`.

Los personajes tienen **nombre y carácter**; la fauna realista es anónima.
Por eso duele cuando el mismo bicho aparece con "tres personalidades": deja de
ser alguien.

## 2. Parámetros canónicos (la física de la goma)

Todos viven en `rubberhoseSpec.js` — acá solo se explican.

### Tinta y blancos (jerarquía fija)
| Token | Hex | Qué es |
|---|---|---|
| `RH_SPEC_TINTA` | `#2a1a0c` | LA línea. Tierra-oscura cálida, jamás negro puro. Única para TODA la familia. |
| `RH_SPEC_PUPILA` | `#20130a` | Pupila (un pelo más clara que la tinta). |
| `RH_SPEC_HUESO` | `#fffaf0` | Esclerótica (el blanco "de ojo"). |
| `RH_SPEC_GUANTE` | `#fff3d8` | Mitón/pie crema (la firma Cuphead). |
| `RH_SPEC_CHISPA` | `#fffdf7` | Catchlight — SIEMPRE el más claro de los blancos. |
| `RH_SPEC_CHAPETA` | `#f2907a` | Rubor coral campesino. |
| `RH_SPEC_BOCA` / `RH_SPEC_LENGUA` | `#8a3b34` / `#d1615a` | Garganta y lengüita de los visemas. |

### Easings por fase (`RH_EASE`) — no se inventan curvas por archivo
| Fase | cubic-bezier | dur |
|---|---|---|
| Anticipación (wind-up) | `(0.34, -0.2, 0.64, 1)` | 150-200ms |
| Impulso/caída | `(0.4, 0, 1, 1)` | 200-300ms |
| Impacto (squash) | `(0.4, 0, 0.2, 1)` | 100-150ms |
| **Overshoot** (el spring de la casa) | `(0.34, 1.56, 0.64, 1)` | 300-400ms |
| Señala/inclina hacia POI | `(0.5, 0, 0.25, 1.4)` | sostenido |

**Squash & stretch preserva volumen**: compresión en un eje ↔ compensación en
el transversal (`scale(1.15, 0.85)`, nunca `scale(0.8)` a secas).

### Line-boil (`RH_LINE_BOIL`)
`feTurbulence baseFrequency 0.025` + `feDisplacementMap scale 4.5`, escalonado
(NUNCA fluido): **0.4s / 3 seeds ≈ 10fps** (rango spec 8-12). Implementación
canónica: `LineBoilFilter.jsx`. Cualquier emulación CSS (jitter de transform)
late a ese MISMO compás y **jamás escala** (el boil es translate+rotate; un
`scale()` en el boil cambia proporciones).

### Períodos co-primos del idle (`RH_PERIODOS`, base Angelita)
boil 1.5s · sway 2.4s · blink 5.6s · travieso 6.3s · mirada 7.9s · antic 9.7s ·
rubor 12.7s. Ninguno divide a otro → la vida nunca cae en el mismo compás (la
cadencia pareja delata al robot). El parpadeo es **irregular**: un golpe suelto
+ un blink-blink doble por ciclo.

### El carácter es TEMPO + AMPLITUD, no otra gramática
Cada especie re-tempoa las MISMAS clases por `[data-creature]` (oso 2.6s
pesado, colibrí 0.9s nervioso, perezoso 6.5s, morrocoy 3.4s…) sin reescribir
keyframes de otra forma. Igual en `creatureIdle.js`: la misma máquina, otro
perfil (`IDLE_PERFILES`). **Un personaje sin perfil cae al de la abeja =
personalidad equivocada por construcción** → todo personaje declara el suyo.

### Lip-sync (4 visemas por RMS)
`lipSyncCore.js`: V1 cerrada <5% · V2 entreabierta 5-30% · V4 fruncida 31-70% ·
V3 abierta >70% (¡por magnitud van V1<V2<V4<V3, no es typo!). Debounce 50ms.
Boca canónica: `BocaVisema` (`_rubberhose.jsx`).

### Gates obligatorios
`prefers-reduced-motion` congela TODO en un fotograma digno;
`data-tier='bajo'` apaga lo continuo (boil, sway, antics) y conserva estados
reactivos. Solo `transform`/`opacity` (GPU, Android gama baja).

## 3. Arquitectura de la fuente única

```
rubberhoseSpec.js        la LEY como datos (tinta, easings, compases, registro)
   ├── _rubberhose.jsx        rasgos SVG (OjosRubber, Miembro, BocaVisema…)
   ├── _faunaRubberTokens.js  tokens fauna benéfica (INK/HUESO ← spec)
   └── LineBoilFilter.jsx     el boil del contorno
creatures.css            LA cadencia (clases rh-*/crt-* + re-tempo por bicho)
creatureIdle.js          la conducta en el tiempo (IDLE_PERFILES por especie)
*Identidad.js / faunaAndina.js   paleta + proporciones DE CADA BICHO como datos
index.js (CREATURES)     el registro slug → componente
```

**Identidad como datos**: la paleta/medidas de un bicho viven en su módulo de
identidad (`abejaIdentidad`, `faunaAndina`, `jaguarIdentidad`…), NUNCA
hard-codeadas en un consumidor. El modelo a imitar es `abejaIdentidad.js`
(paleta + proporción + presencia 3D) y su mejor ciudadano es
`src/visual/agente/Angelita.jsx`: importa `RH_INK`/`ABEJA_PALETA`, compone
`AbejaLaminaRig` y su CSS solo agrega capas `agt-*` sobre las clases canónicas
sin redibujar nada.

## 4. Cómo se monta un personaje nuevo (sin romper la consistencia)

1. **Identidad como datos**: `nuevoIdentidad.js` con `X_PALETA`,
   `X_PROPORCION`, slug y (si aplica) perfil de clima. La tinta NO se declara:
   se importa (`RH_INK`).
2. **Dibujo componiendo el kit**: `OjosRubber`, `Cachetes`, `Sonrisa`/
   `BocaVisema`, `Miembro`, `LineBoilFilter` — cero ojos/bocas/miembros
   propios.
3. **Cadencia heredada**: clases `rh-boil`, `rh-blink`, `rh-mirada`, `rh-sway`
   + `data-pose` para los gestos genéricos (`celebra`/`reposo`/`señala`).
4. **Carácter = re-tempo aditivo** en `creatures.css` por
   `[data-creature='slug']` (duraciones propias, misma forma) + sus 1-2 gestos
   FIRMA (estados `data-*`). Períodos co-primos con el resto.
5. **Perfil idle** en `IDLE_PERFILES` (`creatureIdle.js`) — obligatorio, si no
   se mueve como abeja.
6. **Fundación transversal**: aura en `AURA_POR_BICHO`, ropa en
   `creatureClimaCuerpo.js`, prop en `propsPorMundo.js`, visema vía
   `useLipSync`.
7. **Registro**: entrada en `CREATURES` (`index.js`) + fila en el README + slug
   en `RH_REGISTRO.personajes`.
8. **Gates**: bloque RM + `[data-tier='bajo']` al final de su sección CSS.

## 5. Checklist de revisión (para cualquier PR que toque personajes)

- [ ] ¿Aparece un bicho? → ¿importa el componente de `creatures/` o lo
  redibuja? Redibujar = rechazo.
- [ ] ¿Hay un hex nuevo "parecido" a uno canónico (1 dígito de distancia)? →
  deriva; importar el token.
- [ ] ¿Hay un `cubic-bezier` nuevo? → ¿está en `RH_EASE`? Si no, o se usa uno
  de la paleta o se justifica por escrito.
- [ ] ¿Hay `@keyframes` nuevos que muevan un personaje? → ¿por qué no alcanzan
  las clases `rh-*`/`crt-*` + re-tempo?
- [ ] ¿El boil escala? → prohibido (`translate`/`rotate` only).
- [ ] ¿Parpadeo regular tipo metrónomo? → usar la cadencia irregular canónica.
- [ ] ¿Todo animado nuevo tiene gate RM + tier bajo?
- [ ] ¿El transform del host cambia proporciones del bicho (scale no uniforme,
  filter de color)? → el host posiciona, no re-estiliza.
- [ ] ¿Registro correcto? (rubber-hose no entra a escenas realistas ni al
  revés).

## 6. Consistencia conocida

Las inconsistencias de paleta, cadencia y registro que surgen al revisar un
personaje nuevo contra la ley de este documento se registran y se corrigen en
el módulo correspondiente (`rubberhoseSpec.js`, `creatures.css`,
`creatureIdle.js`), siguiendo el checklist de la sección 5. No hay una lista
abierta pendiente en este README: el estado vigente de cada componente se
verifica directamente en su código.
