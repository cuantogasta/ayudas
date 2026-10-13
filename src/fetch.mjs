// Descarga las convocatorias de ayudas y subvenciones de la Base de Datos Nacional de Subvenciones (BDNS) y las guarda
// en data/cache.json. Es incremental: solo pide el detalle de las convocatorias nuevas (y vuelve a pedir las de los
// últimos días, por si las corrigen). Si no hay caché local, la recupera de la web publicada.
//
// Uso: node src/fetch.mjs            (actualización diaria)
//      node src/fetch.mjs --desde 2026-06-15   (carga inicial desde una fecha)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esUtil, recorta } from './datos.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const CACHE = path.join(ROOT, 'data', 'cache.json');
const API = 'https://www.infosubvenciones.es/bdnstrans/api';
const H = { 'User-Agent': 'CuantoGasta-Ayudas/1.0 (+https://cuantogasta.github.io/ayudas/)', Accept: 'application/json' };
const DIAS_REPASO = 3; // las convocatorias de los últimos días se vuelven a pedir, por si las corrigen
const VENTANA_INICIAL = 120; // días hacia atrás en la primera carga
const HILOS = 2;
const PAUSA = 200; // ms entre peticiones de cada hilo: unas 5-8 peticiones por segundo; la API corta con HTTP 429 si se le pide más

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hoy = new Date().toISOString().slice(0, 10);
const dmy = (iso) => iso.split('-').reverse().join('/');
const restaDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) - n * 864e5).toISOString().slice(0, 10);

async function pedir(url, intentos = 4) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(45000) });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
      if (r.status === 429) { // límite de peticiones de la API: esperar lo que pida y seguir
        const espera = Math.min(60, Number(r.headers.get('retry-after')) || 5 * i);
        await sleep(espera * 1000);
        if (i < intentos + 4) continue;
      }
      throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (i >= intentos) throw new Error(`${url}: ${e.message}`);
      await sleep(2000 * i * i);
    }
  }
}

// ---------------------------------------------------------------- caché
async function cargarCache() {
  // La web publicada guarda la copia más reciente: así GitHub Actions no tiene que descargarlo todo cada vez.
  // data/cache.json es solo la semilla de la primera publicación (o la copia local al trabajar en el ordenador).
  const local = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : null;
  if (!process.argv.includes('--local')) {
    try {
      const r = await fetch(`${CFG.siteUrl}${CFG.base}/datos/cache.json?t=${Date.now()}`, { headers: H, signal: AbortSignal.timeout(60000) });
      if (r.ok) {
        const web = await r.json();
        if (!local || (web.actualizado || '') >= (local.actualizado || '')) { console.log(`Caché recuperada de la web: ${Object.keys(web.conv).length} convocatorias`); return web; }
      }
    } catch { /* primera publicación: se usa la semilla */ }
  }
  if (local) { console.log(`Caché local: ${Object.keys(local.conv).length} convocatorias`); return local; }
  return { actualizado: null, conv: {}, descartadas: [] };
}
const cache = await cargarCache();
const descartadas = new Set(cache.descartadas);
const guardar = () => {
  cache.descartadas = [...descartadas];
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(cache));
};

// ---------------------------------------------------------------- listado
const ultima = Object.values(cache.conv).reduce((m, c) => (c.f > m ? c.f : m), '');
const desde = arg('--desde') || (ultima ? restaDias(ultima < hoy ? ultima : hoy, DIAS_REPASO) : restaDias(hoy, VENTANA_INICIAL));
console.log(`Convocatorias recibidas desde el ${desde}`);
const lista = [];
for (let page = 0; ; page++) {
  const d = await pedir(`${API}/convocatorias/busqueda?vpd=GE&page=${page}&pageSize=200&order=fechaRecepcion&direccion=desc&fechaDesde=${dmy(desde)}&fechaHasta=${dmy(hoy)}`);
  lista.push(...d.content);
  if (d.last || !d.content.length) break;
  await sleep(PAUSA);
}
console.log(`${lista.length} convocatorias en el periodo`);

// ---------------------------------------------------------------- detalle (solo lo nuevo y lo reciente)
const repaso = restaDias(hoy, DIAS_REPASO);
const pendientes = lista.filter((c) => {
  const id = String(c.numeroConvocatoria);
  if (descartadas.has(id)) return false;
  return !cache.conv[id] || c.fechaRecepcion >= repaso;
});
console.log(`${pendientes.length} por descargar`);
let hechas = 0, nuevas = 0, fallos = 0;
async function hilo(cola) {
  while (cola.length) {
    const c = cola.shift();
    const id = String(c.numeroConvocatoria);
    try {
      const d = await pedir(`${API}/convocatorias?numConv=${encodeURIComponent(id)}&vpd=GE`);
      if (d) {
        if (esUtil(d)) { if (!cache.conv[id]) nuevas++; cache.conv[id] = recorta(d); } else { descartadas.add(id); delete cache.conv[id]; }
      }
    } catch (e) { fallos++; if (fallos <= 5) console.warn(e.message); }
    if (++hechas % 500 === 0) { guardar(); console.log(`  ${hechas}/${pendientes.length}`); }
    await sleep(PAUSA);
  }
}
const cola = [...pendientes];
await Promise.all(Array.from({ length: HILOS }, () => hilo(cola)));
if (pendientes.length && fallos > pendientes.length * 0.2) {
  console.error(`Demasiados fallos (${fallos}); no se guarda.`);
  process.exit(1);
}

// ---------------------------------------------------------------- limpieza: se guardan 400 días
const limite = restaDias(hoy, 400);
for (const [id, c] of Object.entries(cache.conv)) if (c.f < limite) delete cache.conv[id];
cache.actualizado = new Date().toISOString();
guardar();
console.log(`Listo: ${Object.keys(cache.conv).length} convocatorias abiertas al público en la caché (${nuevas} nuevas), ${descartadas.size} descartadas, ${fallos} fallos.`);
