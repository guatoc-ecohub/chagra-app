# Política de seguridad

## Cómo reportar una vulnerabilidad

Use el **reporte privado de vulnerabilidades de GitHub**:

<https://github.com/guatoc-ecohub/chagra-app/security/advisories/new>

También se llega desde la pestaña **Security** del repositorio, con el botón **Report a vulnerability**.

**No abra un issue público ni un Pull Request** para describir una vulnerabilidad: ambos son visibles para todo el mundo antes de que exista un arreglo.

## Qué incluir

- La versión o el commit afectado.
- Qué ocurre y qué impacto tiene (por ejemplo, exposición de datos de una finca o ejecución de código en el navegador).
- Pasos mínimos para reproducirlo.
- Si ya tiene una propuesta de arreglo, adjúntela.

## Qué esperar

- Acusamos recibo del reporte y lo evaluamos con prioridad; nos fijamos como meta responder en un plazo de 7 días hábiles.
- Le informamos del avance y coordinamos con usted la fecha de divulgación pública una vez exista el arreglo.
- Si lo desea, le reconocemos el hallazgo en el aviso de seguridad.

## Versiones con soporte

Solo se corrigen vulnerabilidades en la rama `main` y en la versión desplegada a partir de ella.

## Alcance

Entra en alcance el código de este repositorio: la aplicación web (PWA), su service worker, el almacenamiento local y la sincronización.

Quedan fuera las vulnerabilidades de dependencias de terceros que no sean alcanzables desde Chagra (repórtelas a su proyecto de origen) y los ataques que requieran acceso físico al dispositivo desbloqueado.

## Pruebas de seguridad

Pruebe únicamente con sus propias instalaciones y datos. No acceda a datos de otras personas, no degrade el servicio de otros y no haga ingeniería social sobre quienes mantienen el proyecto.
