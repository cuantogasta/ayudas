# CuántoGasta Ayudas

Buscador de **ayudas y subvenciones públicas abiertas en España**, con datos oficiales de la Base de Datos Nacional de Subvenciones (BDNS). Web estática que se actualiza sola tres veces al día con GitHub Actions y se publica en GitHub Pages:

**https://cuantogasta.github.io/ayudas/**

## Qué tiene

- **Buscador** con filtros por texto, comunidad, provincia, tema y tipo de beneficiario (autónomos y pymes, particulares, asociaciones, grandes empresas).
- **Una ficha por convocatoria**: quién convoca, para quién es, dónde, presupuesto, tipo de concesión, plazo (con días restantes), bases reguladoras, documentos oficiales, enlace a la sede electrónica y ayudas parecidas.
- **Listados** por tipo de beneficiario, comunidad autónoma, provincia, comunidad × beneficiario, tema, «cierran pronto» y «nuevas esta semana».
- **Avisos por RSS** (sin registro): todas las nuevas, por comunidad y por tipo de beneficiario.
- Guía «Cómo pedir una subvención», página de método y fuentes, sitemap, datos estructurados y aviso a buscadores (IndexNow).

## Qué convocatorias se muestran

Solo las que puede pedir cualquiera que cumpla los requisitos (concurrencia competitiva y concesiones directas con convocatoria pública). Las subvenciones nominativas («concesión directa instrumental»), que son el 75 % de los registros de la BDNS, se descartan (`esUtil` en `src/datos.mjs`).

Estado del plazo (`estado` en `src/datos.mjs`):
- **Abierta**: con fechas oficiales y hoy dentro del plazo.
- **Plazo estimado**: el plazo se cuenta desde la publicación en el boletín («20 días hábiles…»); se estima suponiendo 10 días entre el registro en la BDNS y la publicación.
- **Plazo por confirmar**: la BDNS no da un plazo legible (se muestra 45 días desde el registro).
- **Próximamente** y **cerrada** (las fichas cerradas se mantienen 90 días, sin indexar).

Las convocatorias de ayuntamientos, diputaciones y mancomunidades se sitúan en su provincia con el árbol de entidades locales de la BDNS (`tools/locales.mjs` → `src/content/locales.json`), aunque en la BDNS figuren con ámbito «España».

## Cómo funciona

```bash
node tools/locales.mjs   # entidades locales → provincia
node src/fetch.mjs       # descarga incremental (la caché se recupera de la web publicada)
node src/build.mjs       # genera dist/
node tools/check.mjs     # comprueba enlaces, metadatos y datos
node tools/serve.mjs     # http://localhost:4321/ayudas/
```

- `src/fetch.mjs` pide a la API de la BDNS el listado de convocatorias de los últimos días y el detalle de las nuevas (2 hilos, pausas y respeto de los HTTP 429). La caché completa se publica en `/ayudas/datos/cache.json` y la siguiente ejecución parte de ella. `data/cache.json` es la semilla de la primera publicación (carga inicial: `node src/fetch.mjs --desde 2026-06-15 --local`).
- `.github/workflows/publicar.yml`: 3 ejecuciones diarias, comprobación y publicación. Si la web publicada tiene datos de más de dos días, el paso final falla y GitHub envía un correo.

## Fuente y condiciones

Origen de los datos: Intervención General de la Administración del Estado (Sistema Nacional de Publicidad de Subvenciones y Ayudas Públicas, https://www.infosubvenciones.es/). Reutilización permitida con fines comerciales según su [aviso legal](https://www.infosubvenciones.es/bdnstrans/GE/es/avisolegal): se cita la fuente y la fecha de actualización en todas las páginas, no se altera el sentido de la información, no se publica ningún dato personal y se indica que la web no es oficial ni está patrocinada por la administración.

Ingresos: Google AdSense (mismo dominio que el resto de CuántoGasta) y enlaces de afiliado de Amazon (lector de DNI electrónico).
