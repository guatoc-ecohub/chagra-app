# Contribuir a Chagra

## Antes de contribuir: CLA requerido

Toda contribución de código, documentación, traducciones o entradas de catálogo a este repositorio requiere la firma previa del **Contributor License Agreement (CLA)** ([`CLA.md`](./CLA.md)), basado en el Apache ICLA v2.0.

La firma se registra en el propio Pull Request: un comentario de una línea basta.

Lea primero [`CLA.md`](./CLA.md) y luego comente en el PR:

> `I have read the CLA Document and I hereby sign the CLA`

Una vez firmado, el CLA aplica a todas sus contribuciones futuras bajo el mismo login de GitHub; no hace falta refirmar PR por PR.

## Reglas anti-leak (innegociables)

Chagra es un repositorio público. Las siguientes reglas son **absolutas e innegociables**:

1. **Prohibido hardcodear URLs** de infraestructura privada (hostnames, puertos internos, dominios operativos).
2. **Prohibido hardcodear IPs** de red interna (rangos RFC 1918 — `10.*`, `172.16-31.*`, `192.168.*`).
3. **Prohibido hardcodear tokens, claves API, credenciales, bearer tokens o secretos** de cualquier tipo.
4. **Toda configuración de entorno** pasa exclusivamente por `import.meta.env.VITE_*` (Vite env vars) y se proxyea vía Nginx mediante rutas relativas (`/api/...`, `/oauth/...`).
5. **`.env` y `.env.local`** están en `.gitignore` y deben permanecer así. Nunca comitear variantes.
6. **Revisión previa a commit**: ejecutar
   ```bash
   git diff --staged | grep -iE "(token|bearer|password|secret|api[_-]?key|\b10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)"
   ```
   antes de cada commit. Si hay hits, abortar y limpiar.
7. **Tokens OAuth2 de FarmOS** viven en `localStorage` del cliente únicamente — nunca loguearlos, nunca enviarlos a endpoints de telemetría o analítica.

## Antes de abrir un Pull Request

Verifique que el build de producción termina sin errores:

```bash
npm ci
npm run build
```

Cambios sobre `src/db/dbCore.js`, `src/services/syncManager.js`, `src/services/payloadService.js` o `public/sw.js` tocan el contrato sin conexión: describa en el PR cómo probó el guardado offline y la sincronización al volver la red.

## Setup local

Tras clonar:

```bash
npm ci
npm run dev
```

Las variables opcionales están documentadas en `.env.example`; ninguna es necesaria para compilar.

## Boundary con módulos opcionales

Este repositorio es autocontenido: compila y funciona completo sin ningún módulo externo. Existen módulos opcionales adicionales que no son parte de este repo público. Este repo público **nunca** importa estáticamente de esos módulos. La integración se hace vía `src/core/moduleRegistry.js`: los módulos opcionales se registran en runtime si están presentes; la UI consulta `registry.byCapability(...)` y renderiza la variante enriquecida solo cuando existe.

Para desarrollar con esos módulos presentes, definir la variable de entorno `VITE_PRO_MODULES_PATH` apuntando a su instalación local:

```bash
VITE_PRO_MODULES_PATH=<path-local> npm run dev
```

Sin esa variable de entorno el build arranca puro OSS y la UI degrada elegantemente.

Ver:
- `src/core/moduleRegistry.js` — interfaz ChagraModule + registry singleton.
- `src/core/bootstrap-oss.js` — registra módulos OSS en bootstrap.
- `src/core/loadProModules.js` — carga dinámica de módulos opcionales vía env var.

## Para revisores externos: cómo participar

Valoramos contribuciones de la comunidad. Si es nuevo en Chagra, este flujo guía su primer aporte:

1. **Encuentre un issue**: explore los issues abiertos con label `good-first-issue` o `help-wanted`. También puede reportar bugs o sugerir mejoras abriendo un issue nuevo.
2. **Comente que lo toma**: así evitamos duplicación de trabajo. Un mantenedor asignará el issue y responderá dudas.
3. **Lea el CLA**: toda contribución requiere firmar el CLA (`CLA.md`). Un comentario "I have read the CLA Document and I hereby sign the CLA" en su primer PR basta.
4. **Cree su rama desde `origin/main`**: asegúrese de que su fork esté actualizado antes de crear la rama.
5. **Siga el estilo del proyecto**: conventional commits, sin em dashes en texto de interfaz, y respete las reglas anti-leak de arriba.
6. **Abra un Pull Request draft**: titúlelo con el prefijo del tipo de cambio (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
7. **Espere la revisión**: un mantenedor revisará en máximo 5 días hábiles. Si pasa más tiempo sin respuesta, ping en el PR.

**Criterios de merge**: build verde, sin secretos filtrados, CLA firmado y aprobación de al menos un mantenedor.

## Reporte responsable de vulnerabilidades

Si detecta un problema de seguridad, por favor no abra un issue público. Usa el canal privado de GitHub Security Advisories sobre este repositorio, o contacta al mantenedor directamente.

## Asset and Task Status Enums

Para mantener consistencia en la UI y FarmOS, usamos un sistema de enums contextuales por tipo de entidad. Evite usar estados genéricos como "active" o "done" directamente si existe una opción más descriptiva en `src/constants/assetStatuses.js`.

- **Plantas**: seedling, growing, flowering, fruiting, harvested, dormant, dead.
- **Tareas**: pending, in_progress, completed, urgent, cancelled, blocked.
- **Plagas/Invasoras**: reported, inspecting, treating, resolved, escalated.

El componente `StatusBadge.jsx` maneja el mapeo visual (colores/etiquetas) y el fallback para registros legacy.

## Violación de reglas

Cualquier violación de las reglas 1–7 requiere `git reset` antes del push y rotación inmediata del secreto expuesto si alcanzó origen. No hay excepciones.
