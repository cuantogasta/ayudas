// Comprueba dist/ antes de publicar: enlaces internos, metadatos, datos vacíos y sitemap. Falla si algo está roto.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const BASE = CFG.base;
const errores = [];

const html = [];
(function rec(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) rec(p); else if (f.name.endsWith('.html')) html.push(p);
  }
})(DIST);

const existe = (url) => {
  const limpio = url.split('#')[0].split('?')[0];
  if (!limpio.startsWith(BASE + '/')) return true; // otras webs o la web principal
  const rel = decodeURIComponent(limpio.slice(BASE.length));
  const f = path.join(DIST, rel);
  return rel.endsWith('/') ? fs.existsSync(path.join(f, 'index.html')) : fs.existsSync(f);
};

const vistos = new Set();
for (const f of html) {
  const t = fs.readFileSync(f, 'utf8');
  const rel = path.relative(DIST, f);
  if (!/<title>[^<]{10,}<\/title>/.test(t)) errores.push(`${rel}: sin <title>`);
  if (!/<meta name="description" content="[^"]{50,}">/.test(t)) errores.push(`${rel}: descripción ausente o corta`);
  if (!/<link rel="canonical" href="https:\/\//.test(t)) errores.push(`${rel}: sin canonical`);
  if ((t.match(/<h1[\s>]/g) || []).length !== 1) errores.push(`${rel}: debe tener un solo <h1>`);
  const texto = t.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  for (const malo of ['NaN', 'undefined', 'null €', 'Infinity', '[object Object]', 'null de']) {
    if (texto.includes(malo)) errores.push(`${rel}: contiene «${malo}»`);
  }
  for (const m of t.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (!url.startsWith('/') || vistos.has(url)) continue;
    vistos.add(url);
    if (!existe(url)) errores.push(`${rel}: enlace roto ${url}`);
  }
}

const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length < 300) errores.push(`El sitemap solo tiene ${urls.length} URLs`);
const datos = JSON.parse(fs.readFileSync(path.join(DIST, 'datos', 'indice.json'), 'utf8'));
if (datos.i.length < 300) errores.push(`Solo ${datos.i.length} convocatorias abiertas en el buscador`);
for (const f of ['rss.xml', 'datos/cache.json', 'datos/resumen.json']) if (!fs.existsSync(path.join(DIST, f))) errores.push(`Falta ${f}`);

if (errores.length) {
  console.error(`✗ ${errores.length} problemas:\n` + errores.slice(0, 40).map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✓ ${html.length} páginas revisadas, ${vistos.size} enlaces internos distintos, ${urls.length} URLs en el sitemap, ${datos.i.length} convocatorias abiertas.`);
