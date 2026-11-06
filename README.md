# Chagra

Chagra es una aplicación web progresiva (PWA) de software libre para la agroecología campesina en Colombia. Sirve para llevar el registro de una finca —plantas, siembras, cosechas, insumos y observaciones— y para consultar un catálogo agroecológico de especies, biopreparados y prácticas por piso térmico. Funciona sin conexión: guarda todo en el dispositivo y sincroniza con un servidor [farmOS](https://farmos.org) cuando vuelve la señal.

Más información: [chagra.bio](https://chagra.bio)

## Cómo correrlo

Requisitos: Node.js `^20.19.0` o `>=22.12.0`, y npm.

```sh
npm ci
npm run dev      # servidor de desarrollo en http://localhost:5173
npm run build    # build de producción en dist/
npm run preview  # sirve dist/ localmente
```

No hace falta ninguna credencial ni servicio externo para compilar ni para usar la aplicación con datos locales. Si quiere sincronizar con su propia instancia de farmOS u otras integraciones opcionales, copie `.env.example` a `.env.local` y complete solo las variables que necesite.

Notas del build:

- `npm run build` ejecuta antes `prebuild`, que regenera el catálogo SQLite (`public/catalog.sqlite`), el manifiesto de fichas de cultivo y las estadísticas públicas a partir de `catalog/`. Si el módulo opcional `better-sqlite3` no compila en su máquina, el build usa el `catalog.sqlite` ya incluido.
- El valle 3D opcional se sincroniza desde una fuente externa (`VALLE_SRC_DIR`). Si no existe, ese paso no hace nada y el resto de la aplicación funciona igual.

## Estructura

- `src/` — código de la aplicación (React + Vite).
- `public/` — recursos estáticos, fichas de cultivo, catálogo compilado y service worker.
- `catalog/` — catálogo agroecológico (semillas JSON, esquemas y atribuciones de fotos).
- `lib3d/` — utilidades 3D compartidas (three.js).
- `scripts/` — pasos de build.

## Contribuir

Lea [CONTRIBUTING.md](CONTRIBUTING.md) y el acuerdo de licencia de colaborador [CLA.md](CLA.md) antes de abrir un Pull Request.

## Contacto

Para notificaciones del CLA, reporte responsable de vulnerabilidades o cualquier otra consulta sobre el proyecto: kortux@gmail.com (temporal).

## Licencia

Chagra se distribuye bajo la GNU Affero General Public License, versión 3 (`AGPL-3.0-only`). Consulte [LICENSE](LICENSE). Las fotografías y el código de terceros conservan sus licencias originales; vea `catalog/LICENSE.md`, `catalog/fotos/` y `public/vendor-notices/`.
