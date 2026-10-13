// Genera la web estática de CuántoGasta Ayudas en dist/ (se publica en https://cuantogasta.github.io/ayudas/).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CCAA, PROVINCIAS, PUBLICOS, slug, ambito, publicosDe, temaDe, estado, ABIERTOS, organismo, NIVEL, limpia } from './datos.mjs';
import { icon } from './content/iconos.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const SITE = CFG.siteUrl.replace(/\/$/, '');
const BASE = CFG.base; // «/ayudas»
const MAIN = CFG.mainSite.replace(/\/$/, '');
const CACHE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cache.json'), 'utf8'));
const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const ACTUALIZADO = CACHE.actualizado ? new Date(CACHE.actualizado) : new Date();
const HORA = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(ACTUALIZADO);
const FECHA_DATOS = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ACTUALIZADO);

// ---------------------------------------------------------------- utilidades
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nf = (d) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
const fmt = (n, d = 0) => nf(d).format(n);
const euros = (n) => (n >= 1e6 ? `${fmt(n / 1e6, n % 1e6 ? 1 : 0)} millones de €` : `${fmt(n, n % 1 ? 2 : 0)} €`);
const eurosCorto = (n) => (n >= 1e6 ? `${fmt(n / 1e6, 1)} M€` : n >= 1e4 ? `${fmt(Math.round(n / 1e3))} mil €` : `${fmt(n)} €`);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${y}`; };
const fechaCorta = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MESES[m - 1].slice(0, 3)}${y !== Number(HOY.slice(0, 4)) ? ` ${y}` : ''}`; };
const diasHasta = (iso) => Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${HOY}T12:00:00Z`)) / 864e5);
const restaDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) - n * 864e5).toISOString().slice(0, 10);
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
const u = (p) => BASE + p;
const sitemap = [];
const ANIO = HOY.slice(0, 4);

function write(p, content, { sitemapEntry = true, priority, lastmod } = {}) {
  const isFile = /\.[a-z0-9]+$/i.test(p);
  const file = isFile ? path.join(DIST, p) : path.join(DIST, p, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  if (sitemapEntry && !isFile) sitemap.push({ loc: SITE + u(p), priority, lastmod });
}
const amazonUrl = (q) => { const x = new URL('https://www.amazon.es/s'); x.searchParams.set('k', q); if (CFG.amazonTag) x.searchParams.set('tag', CFG.amazonTag); return x.toString(); };
const amazonAttrs = 'rel="sponsored nofollow noopener" target="_blank"';
const BDNS_WEB = (id) => `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${encodeURIComponent(id)}`;
const BDNS_DOC = (id) => `https://www.infosubvenciones.es/bdnstrans/api/convocatorias/documentos?idDocumento=${encodeURIComponent(id)}`;
const urlSegura = (s) => (/^https?:\/\/[^\s"<>]+$/i.test(String(s || '').trim()) ? String(s).trim() : null);

/** Título legible: quita el preámbulo administrativo («Extracto de la Resolución… por la que se convocan…»). */
function tituloCorto(t) {
  let s = limpia(t).replace(/^\s*(BDNS\s*\(?identif\.?\)?:?\s*\d+\.?\s*)/i, '').replace(/^(extracto|anuncio)\s+(de|del)\s+(la|el)?\s*/i, '');
  // «Resolución de… por la que se aprueban las bases… para la concesión de ayudas destinadas a…» → «Ayudas destinadas a…»
  const m = s.match(/\b(?:por (?:la|el) (?:que|cual) se|que aprueba|de aprobaci[oó]n de|relativ[oa] a)\b/i);
  if (m && m.index < 260) {
    const resto = s.slice(m.index + m[0].length);
    let k = resto.search(/\b(ayudas?|subvenci[oó]n(?:es)?|becas?|premios?|incentivos?|bonos?|prestaci[oó]n(?:es)?|cheques?)\b/i);
    if (k < 0 || k > 160) k = resto.search(/\bconvocatoria\b/i);
    if (k >= 0 && k < 160) s = resto.slice(k).replace(/^convocatoria(?:s)?\s+(?:de|para)\s+(?:la\s+concesi[oó]n\s+de\s+)?/i, '');
  }
  s = s.replace(/^(?:la\s+)?concesi[oó]n\s+(?:de\s+)?/i, '');
  s = s.replace(/\s*\(?BDNS[^)]*\)?\.?\s*$/i, '').replace(/[.;,\s]+$/, '');
  if (!/[«“]/.test(s)) s = s.replace(/[»”`]+$/, ''); // comillas de cierre sueltas
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s.length > 8 ? s : limpia(t);
}
const corta = (s, n) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, '')}…`);

// ---------------------------------------------------------------- convocatorias
const DIAS_CERRADAS = 90; // las fichas de convocatorias cerradas se mantienen 90 días
const conv = [];
for (const c of Object.values(CACHE.conv)) {
  const e = estado(c, HOY);
  const fin = e.hasta || null;
  if (e.k === 'cerrada') {
    const ref = fin || c.f;
    if (ref < restaDias(HOY, DIAS_CERRADAS) || c.f < restaDias(HOY, 400)) continue;
  }
  const titulo = tituloCorto(c.t);
  conv.push({
    ...c, e, titulo, org: organismo(c), a: ambito(c), pub: publicosDe(c), tema: temaDe(c),
    path: `/c/${c.id}-${slug(corta(titulo, 70)).slice(0, 70).replace(/-[^-]*$/, '') || 'convocatoria'}/`,
  });
}
const abiertas = conv.filter((c) => ABIERTOS.has(c.e.k));
// orden por defecto: las que cierran antes primero; las de plazo desconocido, por fecha de registro
const claveCierre = (c) => (c.e.k === 'proxima' ? `2${c.e.desde}` : c.e.hasta ? `0${c.e.hasta}` : `1${c.f}`);
const porCierre = (a, b) => (claveCierre(a) < claveCierre(b) ? -1 : claveCierre(a) > claveCierre(b) ? 1 : b.f.localeCompare(a.f));
const porRecientes = (a, b) => b.f.localeCompare(a.f) || porCierre(a, b);
abiertas.sort(porCierre);
const ccaaDe = Object.fromEntries(CCAA.map((a) => [a.c, a]));
const provDe = Object.fromEntries(PROVINCIAS.map((p) => [p.c, p]));
const enCcaa = (c, a) => c.a.ccaa.includes(a.c);
const enProv = (c, p) => c.a.prov.includes(p.c) || c.a.ccaaEntera.includes(p.ccaa);
const esNacional = (c) => c.a.nacional;
const nuevas7 = abiertas.filter((c) => c.f >= restaDias(HOY, 7));
const cierranPronto = abiertas.filter((c) => c.e.hasta && ['abierta'].includes(c.e.k) && diasHasta(c.e.hasta) <= 7);
const temas = (() => { const m = new Map(); for (const c of abiertas) if (c.tema) { if (!m.has(c.tema.slug)) m.set(c.tema.slug, { ...c.tema, n: c.tema.n, lista: [] }); m.get(c.tema.slug).lista.push(c); } return [...m.values()].sort((a, b) => b.lista.length - a.lista.length); })();
console.log(`${conv.length} fichas (${abiertas.length} abiertas o por abrir), ${nuevas7.length} nuevas en 7 días, ${cierranPronto.length} cierran en 7 días`);

// ---------------------------------------------------------------- recursos
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'assets', 'fonts'), { recursive: true });
const ASSET_V = {};
for (const f of ['style.css', 'app.js']) {
  let src = fs.readFileSync(path.join(ROOT, 'src', 'assets', f), 'utf8');
  src = src.replaceAll('/assets/fonts/', `${BASE}/assets/fonts/`).replaceAll('__BASE__', BASE)
    .replace('__ICONS__', () => JSON.stringify(Object.fromEntries(['hourglass', 'clock', 'pin', 'coin', 'briefcase', 'home', 'users', 'factory'].map((k) => [k, icon(k)]))));
  ASSET_V[f] = hash(src);
  fs.writeFileSync(path.join(DIST, 'assets', f), src);
}
fs.copyFileSync(path.join(ROOT, 'src', 'assets', 'fonts', 'jakarta-latin.woff2'), path.join(DIST, 'assets', 'fonts', 'jakarta-latin.woff2'));
for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.ico', 'og.png']) {
  const src = path.join(ROOT, 'src', 'assets', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, f === 'og.png' ? 'assets/og.png' : f));
}
const LOGO = '<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#4338ca"/><circle cx="16" cy="16" r="9.5" fill="#fbbf24"/><circle cx="16" cy="16" r="6.6" fill="none" stroke="#b45309" stroke-width="1.2" opacity=".55"/><path d="M11.6 16.3l3 3 5.8-6.4" fill="none" stroke="#1e1b4b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
fs.writeFileSync(path.join(DIST, 'favicon.svg'), LOGO.replace('<svg class="logo" ', '<svg xmlns="http://www.w3.org/2000/svg" '));
const BRAND = 'Cuánto<b>Gasta</b> <span class="brand-sub">Ayudas</span>';

// ---------------------------------------------------------------- plantilla
const NAV = [['/', 'Buscador'], ['/autonomos-y-pymes/', 'Autónomos'], ['/particulares/', 'Particulares'], ['/asociaciones-y-entidades/', 'Asociaciones'], ['/cierran-pronto/', 'Cierran pronto']];
const ORG = { '@type': 'Organization', name: 'CuántoGasta', url: `${MAIN}/`, logo: { '@type': 'ImageObject', url: `${SITE}${u('/icon-512.png')}` } };

function layout({ title, desc, p, body, crumbs = [], jsonld = [], pageData = null, noindex = false, rss = null }) {
  const url = SITE + u(p);
  const fullTitle = title.length > 58 ? title : `${title} | CuántoGasta Ayudas`;
  const ld = [...jsonld];
  if (crumbs.length) {
    ld.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [['/', 'Ayudas'], ...crumbs].map(([href, name], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + u(href) })) });
  }
  const crumbHtml = crumbs.length ? `<nav class="crumbs" aria-label="Migas de pan"><a href="${u('/')}">Ayudas</a>${crumbs.map(([href, name], i) => (i === crumbs.length - 1 ? `<span aria-current="page">${esc(corta(name, 60))}</span>` : `<a href="${u(href)}">${esc(name)}</a>`)).join('')}</nav>` : '';
  const nav = NAV.map(([href, label]) => `<a href="${u(href)}"${href === p ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="es-ES">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1'}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="CuántoGasta Ayudas">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}${u('/assets/og.png')}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="es_ES">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#4338ca">
<link rel="preload" href="${u('/assets/fonts/jakarta-latin.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${u('/assets/style.css')}?v=${ASSET_V['style.css']}">
<link rel="icon" href="${u('/favicon.svg')}" type="image/svg+xml">
<link rel="icon" href="${u('/favicon.ico')}" sizes="32x32">
<link rel="apple-touch-icon" href="${u('/apple-touch-icon.png')}">
<link rel="alternate" type="application/rss+xml" title="${esc(rss ? rss[1] : 'Ayudas y subvenciones nuevas')}" href="${SITE}${u(rss ? rss[0] : '/rss.xml')}">
${CFG.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(CFG.adsenseClient)}" crossorigin="anonymous"></script>\n` : ''}${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#main">Saltar al contenido</a>
<header class="site-header"><div class="wrap hdr">
<a class="brand" href="${u('/')}" aria-label="CuántoGasta Ayudas: inicio">${LOGO}<span>${BRAND}</span></a>
<nav class="main-nav" aria-label="Principal">${nav}</nav>
</div></header>
<main id="main" class="wrap">
${crumbHtml}
${body}
</main>
${footer()}
${pageData ? `<script type="application/json" id="page-data">${JSON.stringify(pageData).replace(/</g, '\\u003c')}</script>\n` : ''}<script type="module" src="${u('/assets/app.js')}?v=${ASSET_V['app.js']}"></script>
</body>
</html>
`;
}

function footer() {
  return `<footer class="site-footer"><div class="wrap">
<div class="foot-cols">
<div class="foot-brand"><a class="brand" href="${u('/')}">${LOGO}<span>${BRAND}</span></a><p>Las ayudas y subvenciones públicas abiertas en España, con datos oficiales de la Base de Datos Nacional de Subvenciones. Gratis y sin registro.</p>
<ul class="trust-list"><li>${icon('shield')} Datos de la Intervención General de la Administración del Estado</li><li>${icon('clock')} Actualizado el ${fechaCorta(FECHA_DATOS)} a las ${HORA}</li></ul></div>
<div><strong>Para quién</strong><ul>${PUBLICOS.map((p) => `<li><a href="${u(`/${p.slug}/`)}">${p.n}</a></li>`).join('')}<li><a href="${u('/cierran-pronto/')}">Cierran pronto</a></li><li><a href="${u('/nuevas/')}">Nuevas esta semana</a></li></ul></div>
<div><strong>Comunidades</strong><ul>${['andalucia', 'cataluna', 'comunidad-de-madrid', 'comunitat-valenciana', 'galicia', 'castilla-y-leon', 'pais-vasco', 'canarias'].map((s) => CCAA.find((a) => a.slug === s)).filter(Boolean).map((a) => `<li><a href="${u(`/${a.slug}/`)}">${esc(a.n)}</a></li>`).join('')}<li><a href="${u('/comunidades/')}">Todas las comunidades</a></li></ul></div>
<div><strong>Más</strong><ul><li><a href="${u('/como-pedir-una-subvencion/')}">Cómo pedir una subvención</a></li><li><a href="${u('/avisos/')}">Avisos de ayudas nuevas (RSS)</a></li><li><a href="${u('/temas/')}">Ayudas por tema</a></li><li><a href="${MAIN}/">Precio de la luz hoy</a></li><li><a href="${MAIN}/gasolina/">Precio de la gasolina hoy</a></li><li><a href="${u('/sobre/')}">Método y fuentes</a></li><li><a href="${MAIN}/aviso-legal/">Aviso legal</a> · <a href="${MAIN}/privacidad/">Privacidad</a></li></ul></div>
</div>
<p class="legal">Origen de los datos: Intervención General de la Administración del Estado (Base de Datos Nacional de Subvenciones, <a href="https://www.infosubvenciones.es/" rel="noopener">infosubvenciones.es</a>), reutilizados según su aviso legal. CuántoGasta Ayudas es una web independiente: no es una web oficial ni está vinculada a ninguna administración, y la información es orientativa. Antes de pedir una ayuda, consulta siempre las bases y la convocatoria oficiales.${CFG.amazonTag ? ' En calidad de Afiliado de Amazon, obtengo ingresos por las compras adscritas que cumplen los requisitos aplicables.' : ''}</p>
</div></footer>`;
}

// ---------------------------------------------------------------- componentes
const ETIQ = { abierta: 'Abierta', estimada: 'Abierta (plazo estimado)', consultar: 'Plazo por confirmar', proxima: 'Próximamente', cerrada: 'Cerrada' };
function badge(c) {
  const e = c.e;
  let t = ETIQ[e.k];
  if (e.k === 'abierta' && e.hasta) { const d = diasHasta(e.hasta); t = d === 0 ? 'Cierra hoy' : d === 1 ? 'Cierra mañana' : d <= 30 ? `Quedan ${d} días` : `Hasta el ${fechaCorta(e.hasta)}`; }
  if (e.k === 'estimada') t = `Plazo estimado: ${fechaCorta(e.hasta)}`;
  if (e.k === 'proxima') t = `Se abre el ${fechaCorta(e.desde)}`;
  if (e.k === 'cerrada') t = e.hasta && !e.estimado ? `Cerró el ${fechaCorta(e.hasta)}` : 'Plazo cerrado';
  return `<span class="bd bd-${e.k}">${icon(e.k === 'cerrada' ? 'clock' : 'hourglass')}${esc(t)}</span>`;
}
function zonaTexto(c) {
  if (c.a.nacional) return 'Toda España';
  if (c.a.prov.length === 1) return provDe[c.a.prov[0]].n;
  if (c.a.prov.length > 1 && c.a.prov.length <= 3) return c.a.prov.map((p) => provDe[p].n).join(', ');
  if (c.a.ccaa.length === 1) return ccaaDe[c.a.ccaa[0]].n;
  if (c.a.ccaa.length > 1) return `${c.a.ccaa.length} comunidades`;
  return 'Consulta las bases';
}
function card(c) {
  const meta = [badge(c).replace('<span class="bd', '<li class="bd').replace(/<\/span>$/, '</li>'),
    `<li>${icon('pin')}${esc(zonaTexto(c))}</li>`,
    c.pub.length ? `<li>${icon(c.pub[0].ico)}${esc(c.pub.map((p) => p.corto).join(' · '))}</li>` : '',
    c.p ? `<li>${icon('coin')}${esc(eurosCorto(c.p))}</li>` : ''].join('');
  return `<li class="ay-card k-${c.e.k}"><h3><a href="${u(c.path)}">${esc(corta(c.titulo, 170))}</a></h3><p class="ay-org">${esc(c.org)}</p><ul class="ay-meta">${meta}</ul></li>`;
}
const lista = (items, vacio = 'Ahora mismo no hay ayudas abiertas en esta lista. Vuelve mañana: se actualiza cada día.') => (items.length ? `<ul class="ay-list">${items.map(card).join('')}</ul>` : `<p class="ay-empty">${vacio}</p>`);

const pageHead = ({ ico = 'coin', eyebrow, h1, sub }) => `<header class="page-head"><span class="head-ico">${icon(ico)}</span><div>${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h1>${esc(h1)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}<p class="meta">${icon('clock')} Actualizado el ${fechaLarga(FECHA_DATOS)} a las ${HORA} · Fuente: Base de Datos Nacional de Subvenciones</p></div></header>`;

function faqBlock(items, titulo = 'Preguntas frecuentes') {
  return {
    html: `<section class="faq sec"><h2>${titulo}</h2>${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('')}</section>`,
    ld: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })) },
  };
}

/** Buscador con filtros (se rellena en el navegador con datos/indice.json); `fijo` limita la búsqueda a una zona, público o tema. */
let nFinder = 0;
function finder({ fijo = {}, titulo = 'Busca ayudas abiertas', intro = 'Filtra por lo que buscas, tu zona y quién eres. Solo se muestran convocatorias con plazo abierto o próximo.' } = {}) {
  const id = ++nFinder;
  const optsCcaa = `<option value="">Toda España</option>${CCAA.map((a) => `<option value="${a.c}"${fijo.ccaa === a.c ? ' selected' : ''}>${esc(a.n)}</option>`).join('')}`;
  const optsProv = `<option value="">Todas las provincias</option>${PROVINCIAS.filter((p) => !fijo.ccaa || p.ccaa === fijo.ccaa).filter((p) => ccaaDe[p.ccaa].prov.length > 1).map((p) => `<option value="${p.c}" data-ccaa="${p.ccaa}"${fijo.prov === p.c ? ' selected' : ''}>${esc(p.n)}</option>`).join('')}`;
  const optsTema = `<option value="">Cualquier tema</option>${temas.map((t) => `<option value="${t.slug}"${fijo.tema === t.slug ? ' selected' : ''}>${esc(t.n)}</option>`).join('')}`;
  return `<section class="card finder" id="buscar" data-finder='${esc(JSON.stringify(fijo))}'>
<div class="calc-head"><span class="calc-ico">${icon('search')}</span><div><h2>${esc(titulo)}</h2><p>${intro}</p></div></div>
<div class="finder-row"><label>¿Qué buscas?<input type="search" data-f="q" placeholder="Ej.: alquiler, contratación, digitalización, deporte…" autocomplete="off" enterkeyhint="search"></label>
<label>Comunidad<select data-f="ccaa">${optsCcaa}</select></label>
<label>Provincia<select data-f="prov">${optsProv}</select></label></div>
<div class="finder-row"><label>Tema<select data-f="tema">${optsTema}</select></label>
<label>Ordenar<select data-f="orden"><option value="cierre">Cierran antes</option><option value="recientes">Más recientes</option><option value="importe">Mayor presupuesto</option></select></label>
<label>Ayudas estatales<select data-f="nac"><option value="1">Incluir las de toda España</option><option value="0">Solo las de mi zona</option></select></label></div>
<div class="finder-foot"><div class="chips" role="group" aria-label="Para quién">${PUBLICOS.map((p) => `<button type="button" data-pub="${p.id}" aria-pressed="${fijo.pub === p.id}">${p.n}</button>`).join('')}</div><span class="finder-count" aria-live="polite" id="finder-count-${id}"></span></div>
<div class="finder-out"></div>
</section>`;
}

const AMAZON_DNIE = () => `<aside class="callout">${icon('key')} <strong>Para pedirla por internet</strong> necesitas certificado digital, Cl@ve o el DNI electrónico. Si usas el DNIe en el ordenador, hace falta un <a href="${esc(amazonUrl('lector dni electronico'))}" ${amazonAttrs}>lector de DNI electrónico</a> (desde unos 10 €). Lo explicamos en la <a href="${u('/como-pedir-una-subvencion/')}">guía para pedir una subvención</a>.</aside>`;

// ---------------------------------------------------------------- datos para el buscador
const PUB_BIT = Object.fromEntries(PUBLICOS.map((p, i) => [p.id, 1 << i]));
const indice = abiertas.map((c) => [c.id, corta(c.titulo, 170), corta(c.org, 90), c.e.k, c.e.hasta || '', c.p || 0, c.a.nacional ? 1 : 0, c.a.ccaa.join(','), [...c.a.prov, ...c.a.ccaaEntera.map((x) => `*${x}`)].join(','), c.pub.reduce((m, p) => m | PUB_BIT[p.id], 0), c.tema?.slug || '', c.f, c.path, c.e.desde || '', zonaTexto(c)]);
write('/datos/indice.json', JSON.stringify({ hoy: HOY, base: BASE, pub: PUBLICOS.map((p) => [p.id, p.corto, p.ico]), i: indice }));
write('/datos/resumen.json', JSON.stringify({ fecha: FECHA_DATOS, hora: HORA, actualizado: CACHE.actualizado, abiertas: abiertas.length, nuevas7: nuevas7.length, cierran7: cierranPronto.length, fichas: conv.length, enCache: Object.keys(CACHE.conv).length }));
write('/datos/cache.json', JSON.stringify(CACHE)); // copia para la siguiente actualización (ver src/fetch.mjs)
write('/datos/indexnow-diario.json', JSON.stringify([SITE + u('/'), SITE + u('/nuevas/'), SITE + u('/cierran-pronto/'), ...conv.filter((c) => c.f >= restaDias(HOY, 2)).map((c) => SITE + u(c.path))].slice(0, 9000)));

// ---------------------------------------------------------------- portada
const cuenta = (f) => abiertas.filter(f).length;
{
  const porCcaa = CCAA.map((a) => ({ a, n: cuenta((c) => enCcaa(c, a)) }));
  const faq = faqBlock([
    ['¿Qué ayudas y subvenciones hay abiertas ahora?', `Hoy, ${fechaLarga(HOY)}, hay ${fmt(abiertas.length)} convocatorias de ayudas y subvenciones abiertas o a punto de abrirse en España: ${fmt(cuenta((c) => c.pub.some((p) => p.id === 'autonomos')))} para autónomos y pymes, ${fmt(cuenta((c) => c.pub.some((p) => p.id === 'particulares')))} para particulares y familias y ${fmt(cuenta((c) => c.pub.some((p) => p.id === 'entidades')))} para asociaciones y entidades. Esta semana se han publicado ${fmt(nuevas7.length)} nuevas.`],
    ['¿De dónde salen los datos?', 'De la Base de Datos Nacional de Subvenciones (BDNS), donde todas las administraciones —Estado, comunidades autónomas, diputaciones, ayuntamientos y otros organismos— están obligadas a registrar sus convocatorias. La web descarga los datos oficiales cada día.'],
    ['¿Por qué no aparecen todas las subvenciones de la BDNS?', 'Tres de cada cuatro registros de la BDNS son subvenciones nominativas o de concesión directa a una entidad concreta, que nadie más puede pedir. Aquí solo mostramos las convocatorias a las que puede presentarse cualquiera que cumpla los requisitos.'],
    ['¿Qué significa «plazo estimado»?', 'Muchas convocatorias no dan una fecha de fin sino un plazo como «20 días hábiles desde la publicación del extracto en el boletín oficial». En esos casos calculamos una fecha aproximada; confírmala siempre en el boletín o en la sede electrónica del organismo.'],
    ['¿Cómo me entero de las ayudas nuevas?', `Con los <a href="${u('/avisos/')}">avisos RSS</a>: hay uno por comunidad autónoma y por tipo de beneficiario, y se pueden recibir en el móvil o por correo con apps gratuitas. Y la lista de <a href="${u('/nuevas/')}">ayudas nuevas esta semana</a> se actualiza cada día.`],
  ]);
  const body = `<section class="hero-home ay-hero"><div>
<p class="eyebrow">${icon('coin')} Ayudas y subvenciones abiertas · ${fechaLarga(HOY)}</p>
<h1>Ayudas y subvenciones abiertas hoy en España</h1>
<p class="lead">Todas las convocatorias públicas a las que puedes presentarte, del Estado, tu comunidad y tu ayuntamiento, actualizadas cada día con datos oficiales. Para quién son, cuánto dinero reparten y hasta cuándo se pueden pedir.</p>
<div class="hero-actions"><a class="btn btn-sun" href="#buscar">${icon('search')}<span>Buscar ayudas</span></a><a class="btn btn-glass" href="${u('/cierran-pronto/')}">Cierran pronto</a></div>
</div><div class="ay-stats">
<a class="ay-stat" href="#buscar"><span>Abiertas ahora</span><strong>${fmt(abiertas.length)}</strong><small>convocatorias</small></a>
<a class="ay-stat" href="${u('/nuevas/')}"><span>Nuevas</span><strong>${fmt(nuevas7.length)}</strong><small>en los últimos 7 días</small></a>
<a class="ay-stat" href="${u('/cierran-pronto/')}"><span>Cierran pronto</span><strong>${fmt(cierranPronto.length)}</strong><small>en los próximos 7 días</small></a>
<a class="ay-stat" href="${u('/autonomos-y-pymes/')}"><span>Para autónomos</span><strong>${fmt(cuenta((c) => c.pub.some((p) => p.id === 'autonomos')))}</strong><small>y pymes</small></a>
</div></section>
${finder()}
<section class="sec"><div class="sec-head"><p class="eyebrow">${icon('users')} Para quién</p><h2>Ayudas según quién eres</h2></div>
<div class="aud-grid">${PUBLICOS.map((p) => `<a class="aud" href="${u(`/${p.slug}/`)}"><span class="aud-ico">${icon(p.ico)}</span><strong>${p.n}</strong><b>${fmt(cuenta((c) => c.pub.includes(p)))}</b><span>abiertas ahora</span></a>`).join('')}</div></section>
<section class="sec"><div class="sec-head"><p class="eyebrow">${icon('pin')} Por comunidad</p><h2>Ayudas abiertas en tu comunidad</h2><p>Incluye las de la comunidad autónoma, las diputaciones y los ayuntamientos.</p></div>
<ul class="areas">${porCcaa.map(({ a, n }) => `<li><a href="${u(`/${a.slug}/`)}">${esc(a.n)} <b>${fmt(n)}</b></a></li>`).join('')}</ul></section>
<section class="sec"><div class="sec-head"><p class="eyebrow">${icon('hourglass')} Últimos días</p><h2>Ayudas que cierran esta semana</h2></div>${lista(cierranPronto.slice(0, 8), 'Ninguna convocatoria con fecha oficial cierra en los próximos 7 días.')}<p class="more"><a class="link-arrow" href="${u('/cierran-pronto/')}">Ver todas las que cierran pronto ${icon('arrow')}</a></p></section>
<section class="sec"><div class="sec-head"><p class="eyebrow">${icon('sparkle')} Recién publicadas</p><h2>Ayudas nuevas</h2></div>${lista([...nuevas7].sort(porRecientes).slice(0, 8))}<p class="more"><a class="link-arrow" href="${u('/nuevas/')}">Ver todas las nuevas ${icon('arrow')}</a></p></section>
<section class="sec"><div class="sec-head"><p class="eyebrow">${icon('tag')} Por tema</p><h2>Ayudas por tema</h2></div><ul class="pills">${temas.map((t) => `<li><a href="${u(`/tema/${t.slug}/`)}">${icon(t.ico || 'tag')}${esc(t.n)} <b>${fmt(t.lista.length)}</b></a></li>`).join('')}</ul></section>
${AMAZON_DNIE()}
${faq.html}`;
  write('/', layout({
    title: `Ayudas y subvenciones abiertas hoy en España (${fmt(abiertas.length)} convocatorias)`,
    desc: `${fmt(abiertas.length)} ayudas y subvenciones abiertas hoy para autónomos, empresas, particulares y asociaciones. Plazos, cuantías y requisitos con datos oficiales de la BDNS, actualizados cada día.`,
    p: '/', body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'CuántoGasta Ayudas', url: SITE + u('/'), inLanguage: 'es-ES', publisher: ORG }, faq.ld,
      { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Ayudas y subvenciones abiertas en España', description: 'Convocatorias de ayudas y subvenciones públicas abiertas, con plazo, beneficiarios, presupuesto y ámbito geográfico.', url: SITE + u('/'), creator: ORG, isBasedOn: 'https://www.infosubvenciones.es/', spatialCoverage: 'España', dateModified: FECHA_DATOS }],
  }), { priority: '1.0' });
}

// ---------------------------------------------------------------- listados
const SERVIDOR = 60; // fichas que se escriben en el HTML de cada listado (el buscador muestra el resto)
function paginaLista({ p, title, desc, h1, sub, eyebrow, ico, items, fijo, crumbs, extra = '', faq = null, rss = null, intro = '', ordenar = porCierre }) {
  const orden = [...items].sort(ordenar);
  const body = `${pageHead({ ico, eyebrow, h1, sub })}
${intro ? `<p class="lead">${intro}</p>` : ''}
<div class="tiles tiles-4">${[['Abiertas', items.length, 'convocatorias'], ['Nuevas', items.filter((c) => c.f >= restaDias(HOY, 7)).length, 'en 7 días'], ['Cierran pronto', items.filter((c) => c.e.k === 'abierta' && c.e.hasta && diasHasta(c.e.hasta) <= 7).length, 'en 7 días'], ['Presupuesto', null, '']].map(([l, v, s], i) => (i < 3 ? `<div class="tile${i === 0 ? ' tile-main' : ''}"><span>${l}</span><strong>${fmt(v)}</strong><small>${s}</small></div>` : (() => { const tot = items.reduce((m, c) => m + (c.p || 0), 0); return `<div class="tile"><span>Dinero en juego</span><strong>${tot ? eurosCorto(tot) : '—'}</strong><small>suma de presupuestos</small></div>`; })())).join('')}</div>
${rss ? `<p><a class="rss-link" href="${u(rss[0])}">${icon('rss')} Recibe las nuevas: ${esc(rss[1])}</a></p>` : ''}
${finder({ fijo, titulo: 'Filtra esta lista' })}
<section class="sec" data-server-list><div class="sec-head"><h2>${esc(h1)}: ${orden.length > SERVIDOR ? `las ${SERVIDOR} que cierran antes` : 'todas'}</h2></div>${lista(orden.slice(0, SERVIDOR))}${orden.length > SERVIDOR ? `<p class="muted">Hay ${fmt(orden.length - SERVIDOR)} más: usa el buscador de arriba para verlas todas.</p>` : ''}</section>
${extra}
${AMAZON_DNIE()}
${faq ? faq.html : ''}`;
  write(p, layout({ title, desc, p, body, crumbs, jsonld: faq ? [faq.ld] : [], rss }), { priority: '0.8' });
}

const faqPublico = (pub, donde, items) => faqBlock([
  [`¿Qué ayudas hay para ${pub.corto} ${donde}?`, `Hoy hay ${fmt(items.length)} convocatorias abiertas para ${pub.corto} ${donde}. ${items[0] ? `La que cierra antes es «${esc(corta(items.slice().sort(porCierre)[0].titulo, 120))}».` : ''} La lista se actualiza cada día con los datos oficiales de la BDNS.`],
  [`¿Quién cuenta como ${pub.corto}?`, pub.id === 'autonomos' ? 'En la BDNS, «pyme y personas físicas que desarrollan actividad económica»: autónomos, profesionales, microempresas y pequeñas y medianas empresas (menos de 250 trabajadores).' : pub.id === 'particulares' ? 'En la BDNS, «personas físicas que no desarrollan actividad económica»: cualquier persona o familia que pide la ayuda a título particular (vivienda, estudios, natalidad, dependencia, etc.).' : pub.id === 'entidades' ? 'En la BDNS, «personas jurídicas que no desarrollan actividad económica»: asociaciones, fundaciones, ONG, clubes deportivos, AMPAs, comunidades de propietarios, entidades religiosas y también otras administraciones.' : 'Empresas que no son pymes: con 250 trabajadores o más, o con más de 50 millones de facturación.'],
  ['¿Cómo se pide una subvención?', `Casi siempre por internet, en la sede electrónica del organismo que la convoca, con certificado digital, Cl@ve o DNI electrónico. Lo explicamos paso a paso en <a href="${u('/como-pedir-una-subvencion/')}">cómo pedir una subvención</a>.`],
]);

for (const pub of PUBLICOS) {
  const items = abiertas.filter((c) => c.pub.includes(pub));
  const porCcaa = CCAA.map((a) => ({ a, n: items.filter((c) => enCcaa(c, a)).length }));
  paginaLista({
    p: `/${pub.slug}/`, ico: pub.ico, eyebrow: `${icon(pub.ico)} ${pub.n}`,
    title: `Ayudas para ${pub.corto} ${ANIO}: ${fmt(items.length)} abiertas hoy`,
    desc: `${fmt(items.length)} ayudas y subvenciones abiertas para ${pub.corto} en España. ${pub.desc} Plazos y requisitos actualizados cada día.`,
    h1: `Ayudas y subvenciones para ${pub.corto}`, sub: pub.desc, items, fijo: { pub: pub.id }, crumbs: [[`/${pub.slug}/`, pub.n]],
    rss: [`/rss/${pub.slug}.xml`, `ayudas nuevas para ${pub.corto}`],
    extra: `<section class="sec"><div class="sec-head"><h2>Ayudas para ${pub.corto} por comunidad</h2></div><ul class="areas">${porCcaa.map(({ a, n }) => `<li><a href="${u(`/${a.slug}/${pub.slug}/`)}">${esc(a.n)} <b>${fmt(n)}</b></a></li>`).join('')}</ul></section>`,
    faq: faqPublico(pub, 'en España', items),
  });
}

for (const a of CCAA) {
  const items = abiertas.filter((c) => enCcaa(c, a));
  const nac = abiertas.filter((c) => esNacional(c) && !enCcaa(c, a));
  const multi = a.prov.length > 1;
  const extra = `${multi ? `<section class="sec"><div class="sec-head"><h2>Por provincia</h2></div><ul class="areas">${a.prov.map((p) => `<li><a href="${u(`/${a.slug}/${p.slug}/`)}">${esc(p.n)} <b>${fmt(items.filter((c) => enProv(c, p)).length)}</b></a></li>`).join('')}</ul></section>` : ''}
<section class="sec"><div class="sec-head"><h2>Por tipo de beneficiario</h2></div><ul class="pills">${PUBLICOS.map((p) => `<li><a href="${u(`/${a.slug}/${p.slug}/`)}">${icon(p.ico)}${p.n} <b>${fmt(items.filter((c) => c.pub.includes(p)).length)}</b></a></li>`).join('')}</ul></section>
<section class="sec"><div class="sec-head"><h2>Ayudas estatales abiertas (también se pueden pedir desde ${esc(a.n)})</h2></div>${lista(nac.slice(0, 10))}</section>`;
  paginaLista({
    p: `/${a.slug}/`, ico: 'pin', eyebrow: `${icon('pin')} ${esc(a.n)}`,
    title: `Ayudas y subvenciones en ${a.n} ${ANIO}: ${fmt(items.length)} abiertas`,
    desc: `${fmt(items.length)} ayudas y subvenciones abiertas en ${a.n}: de la comunidad autónoma, ${multi ? 'las diputaciones, ' : ''}los ayuntamientos y otros organismos. Para autónomos, particulares, empresas y asociaciones.`,
    h1: `Ayudas y subvenciones abiertas en ${a.n}`, sub: `Convocatorias de la comunidad, ${multi ? 'las diputaciones ' : ''}y los ayuntamientos de ${esc(a.n)}, con su plazo, su presupuesto y para quién son.`,
    items, fijo: { ccaa: a.c }, crumbs: [['/comunidades/', 'Comunidades'], [`/${a.slug}/`, a.n]], extra,
    rss: [`/rss/${a.slug}.xml`, `ayudas nuevas en ${a.n}`],
    faq: faqBlock([
      [`¿Qué ayudas hay abiertas en ${a.n}?`, `Hoy hay ${fmt(items.length)} convocatorias abiertas en ${esc(a.n)}: ${fmt(items.filter((c) => c.o[0] === 'AUTONOMICA').length)} de la comunidad autónoma y ${fmt(items.filter((c) => c.o[0] === 'LOCAL').length)} de ayuntamientos, diputaciones y otras entidades locales. Además, desde ${esc(a.n)} se pueden pedir las ${fmt(nac.length)} ayudas estatales abiertas.`],
      [`¿Dónde se piden las ayudas de ${a.n}?`, 'Cada ayuda se pide en la sede electrónica del organismo que la convoca: la de la comunidad autónoma, la de la diputación o la del ayuntamiento. En la ficha de cada convocatoria tienes el enlace directo y los documentos oficiales.'],
    ]),
  });
  if (multi) for (const p of a.prov) {
    const it = items.filter((c) => enProv(c, p));
    paginaLista({
      p: `/${a.slug}/${p.slug}/`, ico: 'pin', eyebrow: `${icon('pin')} ${esc(p.n)} · ${esc(a.n)}`,
      title: `Ayudas y subvenciones en ${p.n} ${ANIO}: ${fmt(it.length)} abiertas`,
      desc: `${fmt(it.length)} ayudas y subvenciones abiertas en la provincia de ${p.n}: ayuntamientos, diputación y ${a.n}. Plazos, cuantías y para quién son, actualizados cada día.`,
      h1: `Ayudas y subvenciones abiertas en ${p.n}`, sub: `Convocatorias de los ayuntamientos y la diputación de ${esc(p.n)} y de ${esc(a.n)}.`,
      items: it, fijo: { ccaa: a.c, prov: p.c }, crumbs: [['/comunidades/', 'Comunidades'], [`/${a.slug}/`, a.n], [`/${a.slug}/${p.slug}/`, p.n]],
      rss: [`/rss/${a.slug}.xml`, `ayudas nuevas en ${a.n}`],
    });
  }
  for (const pub of PUBLICOS) {
    const it = items.filter((c) => c.pub.includes(pub));
    paginaLista({
      p: `/${a.slug}/${pub.slug}/`, ico: pub.ico, eyebrow: `${icon(pub.ico)} ${pub.n} · ${esc(a.n)}`,
      title: `Ayudas para ${pub.corto} en ${a.n} ${ANIO}: ${fmt(it.length)} abiertas`,
      desc: `${fmt(it.length)} ayudas y subvenciones abiertas para ${pub.corto} en ${a.n}. Plazo, presupuesto, requisitos y dónde pedirlas, con datos oficiales actualizados cada día.`,
      h1: `Ayudas para ${pub.corto} en ${a.n}`, sub: pub.desc, items: it, fijo: { ccaa: a.c, pub: pub.id },
      crumbs: [['/comunidades/', 'Comunidades'], [`/${a.slug}/`, a.n], [`/${a.slug}/${pub.slug}/`, pub.n]],
      rss: [`/rss/${a.slug}.xml`, `ayudas nuevas en ${a.n}`],
      faq: faqPublico(pub, `en ${a.n}`, it),
    });
  }
}

for (const t of temas) {
  paginaLista({
    p: `/tema/${t.slug}/`, ico: t.ico || 'tag', eyebrow: `${icon(t.ico || 'tag')} Ayudas por tema`,
    title: `Ayudas de ${t.n.toLowerCase()} ${ANIO}: ${fmt(t.lista.length)} abiertas`,
    desc: `${fmt(t.lista.length)} ayudas y subvenciones abiertas de ${t.n.toLowerCase()} en España, del Estado, las comunidades y los ayuntamientos. Plazos y requisitos actualizados cada día.`,
    h1: `Ayudas y subvenciones de ${t.n.toLowerCase()}`, sub: 'Según la finalidad que indica cada convocatoria en la Base de Datos Nacional de Subvenciones.',
    items: t.lista, fijo: { tema: t.slug }, crumbs: [['/temas/', 'Temas'], [`/tema/${t.slug}/`, t.n]],
  });
}

paginaLista({
  p: '/cierran-pronto/', ico: 'hourglass', eyebrow: `${icon('hourglass')} Últimos días`,
  title: `Ayudas y subvenciones que cierran pronto (${fmt(cierranPronto.length)} esta semana)`,
  desc: `Las ${fmt(cierranPronto.length)} ayudas y subvenciones cuyo plazo oficial termina en los próximos 7 días, y las que cierran después. Que no se te pase ninguna.`,
  h1: 'Ayudas que cierran pronto', sub: 'Convocatorias abiertas ordenadas por fecha de cierre: primero las que terminan antes.',
  items: abiertas.filter((c) => c.e.k === 'abierta' && c.e.hasta), crumbs: [['/cierran-pronto/', 'Cierran pronto']],
});
paginaLista({
  p: '/nuevas/', ico: 'sparkle', eyebrow: `${icon('sparkle')} Recién publicadas`,
  title: `Ayudas y subvenciones nuevas esta semana (${fmt(nuevas7.length)})`,
  desc: `Las ${fmt(nuevas7.length)} convocatorias de ayudas y subvenciones registradas en los últimos 7 días en la Base de Datos Nacional de Subvenciones, con su plazo y para quién son.`,
  h1: 'Ayudas nuevas esta semana', sub: 'Convocatorias registradas en los últimos 7 días, de la más reciente a la más antigua.',
  items: nuevas7, ordenar: porRecientes, crumbs: [['/nuevas/', 'Nuevas']], rss: ['/rss.xml', 'todas las ayudas nuevas'],
});

// índices de comunidades y temas
write('/comunidades/', layout({
  title: 'Ayudas y subvenciones por comunidad autónoma', p: '/comunidades/',
  desc: 'Ayudas y subvenciones abiertas en cada comunidad autónoma y provincia de España, con las convocatorias de la comunidad, las diputaciones y los ayuntamientos.',
  crumbs: [['/comunidades/', 'Comunidades']],
  body: `${pageHead({ ico: 'pin', h1: 'Ayudas por comunidad autónoma', sub: 'Elige tu comunidad o tu provincia.' })}
${CCAA.map((a) => `<section class="sec"><div class="sec-head"><h2><a href="${u(`/${a.slug}/`)}">${esc(a.n)}</a> <small class="muted">${fmt(cuenta((c) => enCcaa(c, a)))} abiertas</small></h2></div>${a.prov.length > 1 ? `<ul class="pills">${a.prov.map((p) => `<li><a href="${u(`/${a.slug}/${p.slug}/`)}">${esc(p.n)} <b>${fmt(cuenta((c) => enProv(c, p)))}</b></a></li>`).join('')}</ul>` : ''}</section>`).join('')}`,
}), { priority: '0.6' });
write('/temas/', layout({
  title: 'Ayudas y subvenciones por tema', p: '/temas/',
  desc: 'Ayudas y subvenciones abiertas agrupadas por tema: vivienda, empleo, cultura, educación y becas, agricultura, comercio, servicios sociales, I+D+i y más.',
  crumbs: [['/temas/', 'Temas']],
  body: `${pageHead({ ico: 'tag', h1: 'Ayudas por tema', sub: 'Según la finalidad de cada convocatoria.' })}<ul class="areas">${temas.map((t) => `<li><a href="${u(`/tema/${t.slug}/`)}">${esc(t.n)} <b>${fmt(t.lista.length)}</b></a></li>`).join('')}</ul>`,
}), { priority: '0.6' });

// ---------------------------------------------------------------- fichas
const TIPO_TXT = (t) => (/concurrencia/i.test(t) ? 'Concurrencia competitiva: se valoran todas las solicitudes presentadas en plazo y el dinero se reparte entre las mejor puntuadas según los criterios de las bases.' : /directa/i.test(t) ? 'Concesión directa: se concede a quien cumpla los requisitos, normalmente por orden de presentación hasta agotar el presupuesto.' : t);
function similares(c) {
  const misma = (x) => x.id !== c.id && x.tema?.slug === c.tema?.slug;
  const zona = (x) => (c.a.prov.length ? x.a.prov.some((p) => c.a.prov.includes(p)) : x.a.ccaa.some((a) => c.a.ccaa.includes(a)));
  const out = [];
  for (const f of [(x) => misma(x) && zona(x), (x) => x.id !== c.id && zona(x) && x.pub.some((p) => c.pub.includes(p)), (x) => misma(x) && x.pub.some((p) => c.pub.includes(p))]) {
    for (const x of abiertas) { if (out.length >= 6) break; if (f(x) && !out.includes(x)) out.push(x); }
  }
  return out;
}
let nFichas = 0;
for (const c of conv) {
  const e = c.e;
  const sede = urlSegura(c.sede), bases = urlSegura(c.ub);
  const zona = zonaTexto(c);
  const a0 = c.a.ccaa.length === 1 ? ccaaDe[c.a.ccaa[0]] : null;
  const p0 = c.a.prov.length === 1 ? provDe[c.a.prov[0]] : null;
  const crumbs = [...(a0 ? [[`/${a0.slug}/`, a0.n]] : [['/comunidades/', 'España']]), ...(p0 && a0 && a0.prov.length > 1 ? [[`/${a0.slug}/${p0.slug}/`, p0.n]] : []), [c.path, c.titulo]];
  const quienes = c.pub.length ? c.pub.map((p) => p.n).join(', ') : 'Consulta las bases';
  let plazoBig, plazoTxt;
  if (e.k === 'abierta' && e.hasta) { const d = diasHasta(e.hasta); plazoBig = `Hasta el ${fechaLarga(e.hasta)}`; plazoTxt = d === 0 ? 'Último día para presentar la solicitud.' : `Quedan ${d} día${d === 1 ? '' : 's'}. ${e.desde ? `El plazo empezó el ${fechaLarga(e.desde)}.` : ''}`; }
  else if (e.k === 'abierta') { plazoBig = 'Plazo abierto'; plazoTxt = `La BDNS la marca como abierta. ${c.tf ? `Plazo: «${esc(c.tf)}».` : 'El plazo concreto está en las bases.'}`; }
  else if (e.k === 'estimada') { plazoBig = `Hasta el ${fechaLarga(e.hasta)} (aprox.)`; plazoTxt = `Plazo oficial: «${esc(c.tf)}». Se cuenta desde que el extracto se publica en el boletín oficial, así que la fecha es una estimación: confírmala en el boletín o en la sede electrónica.`; }
  else if (e.k === 'consultar') { plazoBig = 'Plazo por confirmar'; plazoTxt = c.tf ? `La convocatoria indica: «${esc(c.tf)}».` : 'La BDNS no indica el plazo: está en las bases y en la convocatoria publicadas en el boletín oficial.'; }
  else if (e.k === 'proxima') { plazoBig = `Se abre el ${fechaLarga(e.desde)}`; plazoTxt = e.hasta ? `Y se podrá pedir hasta el ${fechaLarga(e.hasta)}.` : (c.tf ? `Plazo: «${esc(c.tf)}».` : ''); }
  else { plazoBig = 'Ya no admite solicitudes'; plazoTxt = e.hasta && !e.estimado ? `El plazo terminó el ${fechaLarga(e.hasta)}. Abajo tienes ayudas parecidas que siguen abiertas.` : `El plazo ya ha terminado${c.tf ? ` («${esc(c.tf)}»)` : ''}. Abajo tienes ayudas parecidas que siguen abiertas.`; }
  const facts = [
    ['building', 'Convoca', `${esc(c.org)}<br><small class="muted">${esc(NIVEL[c.o[0]] || '')}</small>`],
    ['users', 'Para quién', esc(quienes)],
    ['pin', 'Dónde', esc(zona)],
    ['coin', 'Presupuesto total', c.p ? esc(euros(c.p)) : 'No indicado'],
    ['list', 'Tipo de concesión', esc(TIPO_TXT(c.tipo))],
    ...(c.tema ? [['tag', 'Tema', esc(c.tema.n)]] : []),
    ...(c.sec.length ? [['briefcase', 'Sectores', esc(c.sec.map(limpia).join(', '))]] : []),
    ...(c.mrr || c.fondos.length ? [['flag', 'Fondos', esc([c.mrr ? 'Plan de Recuperación (Next Generation EU)' : '', ...c.fondos.map(limpia)].filter(Boolean).join(', '))]] : []),
    ['doc', 'Título oficial', esc(c.t)],
    ['info', 'Código BDNS', `${esc(c.id)} · registrada el ${fechaLarga(c.f)}`],
  ];
  const docs = c.docs.slice(0, 12).map(([id, desc, nombre]) => `<li><a href="${BDNS_DOC(id)}" rel="nofollow noopener" target="_blank">${icon('doc')}<span>${esc(desc || 'Documento')}<small>${esc(nombre)}</small></span></a></li>`).join('');
  const sim = similares(c);
  const desc = `${e.k === 'cerrada' ? 'Plazo cerrado' : e.k === 'abierta' && e.hasta ? `Abierta hasta el ${fechaCorta(e.hasta)}` : ETIQ[e.k]}. Convoca: ${c.org}. Para: ${quienes.toLowerCase()}.${c.p ? ` Presupuesto: ${euros(c.p)}.` : ''} Requisitos, documentos y dónde pedirla.`;
  const body = `<header class="ay-head"><p class="eyebrow">${icon(c.tema?.ico || 'coin')} ${esc(c.tema?.n || 'Ayuda o subvención')} · ${esc(zona)}</p>
<h1>${esc(c.titulo)}</h1><p class="ay-org">${icon('building')} ${esc(c.org)}</p></header>
<div class="ay-grid"><div>
<section class="card"><h2 class="h3">Resumen de la convocatoria</h2><dl class="facts">${facts.map(([ic, k, v]) => `<dt>${icon(ic)}${k}</dt><dd>${v}</dd>`).join('')}</dl></section>
${c.db || bases ? `<section class="card sec"><h2 class="h3">Bases reguladoras</h2>${c.db ? `<p>${esc(c.db)}</p>` : ''}${bases ? `<p><a class="link-arrow" href="${esc(bases)}" rel="nofollow noopener" target="_blank">Leer las bases reguladoras ${icon('ext')}</a></p>` : ''}</section>` : ''}
${docs ? `<section class="card sec"><h2 class="h3">Documentos oficiales</h2><ul class="docs">${docs}</ul><p class="muted"><small>Se descargan desde la Base de Datos Nacional de Subvenciones.</small></p></section>` : ''}
<section class="card sec"><h2 class="h3">Cómo solicitarla</h2><ol class="steps">
<li><div><strong>Lee la convocatoria y las bases</strong><p>Ahí están los requisitos exactos, la cuantía por solicitante, los criterios de valoración y la documentación que hay que presentar.</p></div></li>
<li><div><strong>Comprueba que cumples los requisitos</strong><p>Además de los propios de la ayuda, casi siempre hay que estar al corriente con Hacienda y la Seguridad Social.</p></div></li>
<li><div><strong>Prepara la documentación y tu identificación digital</strong><p>Para presentarla por internet necesitas certificado digital, Cl@ve o DNI electrónico.</p></div></li>
<li><div><strong>Preséntala ${e.hasta && e.k !== 'cerrada' ? `antes del ${fechaLarga(e.hasta)}${e.k === 'estimada' ? ' (fecha aproximada)' : ''}` : 'dentro del plazo'}</strong><p>${sede ? `En la <a href="${esc(sede)}" rel="nofollow noopener" target="_blank">sede electrónica de ${esc(c.org)}</a>` : `En la sede electrónica de ${esc(c.org)}`} o en un registro presencial. Guarda el justificante.</p></div></li>
</ol></section>
</div>
<aside><div class="plazo k-${e.k}"><p class="plazo-k">${badge(c)}</p><p class="plazo-big">${esc(plazoBig)}</p><p>${plazoTxt}</p>
${sede && e.k !== 'cerrada' ? `<a class="btn" href="${esc(sede)}" rel="nofollow noopener" target="_blank">${icon('ext')}<span>Ir a la sede electrónica</span></a>` : ''}
<a class="btn btn-ghost" href="${BDNS_WEB(c.id)}" rel="nofollow noopener" target="_blank">${icon('shield')}<span>Ver la ficha oficial (BDNS)</span></a></div>
${AMAZON_DNIE()}</aside>
</div>
<section class="sec"><div class="sec-head"><h2>Ayudas parecidas abiertas</h2></div>${lista(sim, 'Ahora mismo no hay ayudas parecidas abiertas.')}${a0 ? `<p class="more"><a class="link-arrow" href="${u(`/${a0.slug}/`)}">Todas las ayudas abiertas en ${esc(a0.n)} ${icon('arrow')}</a></p>` : ''}</section>
<p class="aviso-fuente">Origen de los datos: Intervención General de la Administración del Estado, Base de Datos Nacional de Subvenciones (convocatoria ${esc(c.id)}, registrada el ${fechaLarga(c.f)}; consultada el ${fechaLarga(FECHA_DATOS)}). Esta web no es oficial: confirma siempre los plazos y requisitos en la convocatoria publicada en el boletín oficial.</p>`;
  const ld = { '@context': 'https://schema.org', '@type': 'GovernmentService', name: c.titulo, description: desc, url: SITE + u(c.path), serviceType: c.tema?.n || 'Subvención',
    provider: { '@type': 'GovernmentOrganization', name: c.org }, areaServed: zona === 'Consulta las bases' ? 'España' : zona,
    ...(c.pub.length ? { audience: { '@type': 'Audience', audienceType: quienes } } : {}) };
  write(c.path, layout({ title: `${corta(c.titulo, 62)}${e.k !== 'cerrada' ? ' — plazo y requisitos' : ''}`, desc: corta(desc, 300), p: c.path, body, crumbs, jsonld: [ld], noindex: e.k === 'cerrada' }),
    { sitemapEntry: e.k !== 'cerrada', priority: '0.6', lastmod: c.f });
  nFichas++;
}

// ---------------------------------------------------------------- guía, avisos y método
{
  const faq = faqBlock([
    ['¿Necesito certificado digital para pedir una subvención?', 'Casi siempre se pide por internet y hace falta identificarse con certificado digital, Cl@ve o DNI electrónico. Algunas ayudas para particulares y casi todas las de ayuntamientos pequeños admiten también la solicitud en papel en el registro del ayuntamiento o en una oficina de asistencia en materia de registros.'],
    ['¿Cuánto tardan en pagar una subvención?', 'Depende de cada convocatoria: primero hay que esperar a la resolución (las bases dicen el plazo máximo, a menudo de 3 a 6 meses) y después al pago, que puede ser anticipado o tras justificar el gasto.'],
    ['¿Hay que declarar las subvenciones en la renta?', 'En general sí: la mayoría de las ayudas públicas cuentan como ganancia patrimonial o rendimiento de la actividad económica y se declaran en el IRPF del año en que se cobran. Hay excepciones (por ejemplo, algunas ayudas por nacimiento o dependencia). La administración que paga lo comunica a Hacienda.'],
    ['¿Qué es la justificación de una subvención?', 'Demostrar que el dinero se ha usado para lo que se concedió: facturas, justificantes de pago, memoria de la actividad… Si no se justifica bien o a tiempo, hay que devolver la ayuda con intereses.'],
  ]);
  write('/como-pedir-una-subvencion/', layout({
    title: 'Cómo pedir una subvención paso a paso (guía práctica)', p: '/como-pedir-una-subvencion/',
    desc: 'Guía práctica para pedir una ayuda o subvención pública en España: encontrar la convocatoria, comprobar los requisitos, identificarse con certificado digital o Cl@ve, presentar la solicitud y justificarla.',
    crumbs: [['/como-pedir-una-subvencion/', 'Cómo pedir una subvención']], jsonld: [faq.ld],
    body: `${pageHead({ ico: 'list', eyebrow: `${icon('list')} Guía`, h1: 'Cómo pedir una subvención paso a paso', sub: 'Lo que hay que hacer, en orden, para no dejarse nada.' })}
<div class="prose card"><ol class="steps">
<li><div><strong>Encuentra una convocatoria abierta para ti</strong><p>Usa el <a href="${u('/#buscar')}">buscador</a> filtrando por tu comunidad y por quién eres (autónomo, particular, asociación…). Fíjate en el plazo: las «estimadas» dependen de la fecha de publicación en el boletín.</p></div></li>
<li><div><strong>Lee las bases reguladoras y la convocatoria</strong><p>Las bases dicen quién puede pedirla, qué gastos cubre, cuánto se da y cómo se valora. La convocatoria abre el plazo de ese año y concreta el presupuesto. Las dos están enlazadas en cada ficha.</p></div></li>
<li><div><strong>Comprueba los requisitos generales</strong><p>Casi todas exigen estar al corriente con Hacienda y la Seguridad Social, no tener deudas con la administración que convoca y no estar en ninguna de las prohibiciones del artículo 13 de la Ley General de Subvenciones.</p></div></li>
<li><div><strong>Consigue tu identificación digital</strong><p>Para presentarla por internet necesitas certificado digital (gratis en la FNMT), Cl@ve o el DNI electrónico con un <a href="${esc(amazonUrl('lector dni electronico'))}" ${amazonAttrs}>lector de DNIe</a>. Las empresas y asociaciones necesitan un certificado de representante.</p></div></li>
<li><div><strong>Reúne la documentación</strong><p>Formulario de solicitud, presupuesto o memoria del proyecto, declaración responsable, certificado de cuenta bancaria y lo que pida cada convocatoria. Mira la lista de documentos de la ficha.</p></div></li>
<li><div><strong>Preséntala dentro del plazo</strong><p>En la sede electrónica del organismo convocante. Descarga y guarda el justificante de registro: es tu prueba de que la presentaste a tiempo.</p></div></li>
<li><div><strong>Atiende los requerimientos</strong><p>Si falta algo, te darán un plazo (normalmente 10 días) para subsanarlo. Revisa tus notificaciones electrónicas.</p></div></li>
<li><div><strong>Justifica la ayuda</strong><p>Cuando te la concedan, guarda todas las facturas y justificantes de pago y preséntalos en plazo. Si no, habrá que devolverla.</p></div></li>
</ol></div>
${faq.html}`,
  }), { priority: '0.7' });
}
{
  const feeds = [['/rss.xml', 'Todas las ayudas nuevas'], ...PUBLICOS.map((p) => [`/rss/${p.slug}.xml`, `Para ${p.corto}`]), ...CCAA.map((a) => [`/rss/${a.slug}.xml`, `En ${a.n}`])];
  write('/avisos/', layout({
    title: 'Avisos de ayudas y subvenciones nuevas (RSS gratis)', p: '/avisos/',
    desc: 'Recibe gratis las ayudas y subvenciones nuevas de tu comunidad o para autónomos, particulares y asociaciones, con un lector RSS en el móvil o por correo. Sin registro.',
    crumbs: [['/avisos/', 'Avisos']],
    body: `${pageHead({ ico: 'bell', eyebrow: `${icon('bell')} Avisos`, h1: 'Avisos de ayudas nuevas', sub: 'Sin registrarte en ningún sitio: cada lista es un canal RSS que puedes seguir con cualquier lector.' })}
<div class="prose card"><p>Copia la dirección del canal que te interese y pégala en un lector de noticias gratuito (por ejemplo Feedly o Inoreader, en el móvil o en el ordenador). Cada día recibirás las convocatorias nuevas de esa lista. Si prefieres recibirlas por correo, servicios gratuitos como Blogtrottr envían por email lo que se publica en un canal RSS.</p></div>
<section class="sec"><ul class="areas">${feeds.map(([f, n]) => `<li><a href="${u(f)}">${icon('rss')} ${esc(n)}</a></li>`).join('')}</ul></section>`,
  }), { priority: '0.5' });
  write('/sobre/', layout({
    title: 'Método y fuentes de CuántoGasta Ayudas', p: '/sobre/',
    desc: 'De dónde salen los datos de CuántoGasta Ayudas, cómo se calcula si una ayuda está abierta y qué convocatorias se muestran. Datos de la Base de Datos Nacional de Subvenciones.',
    crumbs: [['/sobre/', 'Método y fuentes']],
    body: `${pageHead({ ico: 'shield', h1: 'Método y fuentes', sub: 'Cómo funciona esta web.' })}
<div class="prose card">
<h2 class="h3">De dónde salen los datos</h2><p>Del Sistema Nacional de Publicidad de Subvenciones y Ayudas Públicas, la base de datos oficial donde todas las administraciones españolas registran sus convocatorias (<a href="https://www.infosubvenciones.es/" rel="noopener">infosubvenciones.es</a>). Origen de los datos: Intervención General de la Administración del Estado. La web descarga las convocatorias nuevas varias veces al día y las reutiliza según su <a href="https://www.infosubvenciones.es/bdnstrans/GE/es/avisolegal" rel="noopener">aviso legal</a>. Última actualización: ${fechaLarga(FECHA_DATOS)} a las ${HORA}.</p>
<h2 class="h3">Qué convocatorias se muestran</h2><p>Solo las que están abiertas a cualquiera que cumpla los requisitos: las de concurrencia competitiva y las de concesión directa con convocatoria pública. No se muestran las subvenciones nominativas a una entidad concreta, que suponen tres de cada cuatro registros de la base de datos. Tampoco se publica ningún dato personal.</p>
<h2 class="h3">Cómo se calcula el plazo</h2><p>Si la convocatoria tiene fechas de inicio y fin, se usan tal cual. Si el plazo se cuenta desde la publicación en el boletín oficial («20 días hábiles desde el día siguiente a la publicación del extracto…»), calculamos una fecha aproximada suponiendo que el extracto se publica unos ${10} días después de registrarse en la BDNS, y la marcamos como <strong>plazo estimado</strong>. Si no hay ningún plazo legible, la convocatoria aparece como «plazo por confirmar» durante 45 días.</p>
<h2 class="h3">Aviso</h2><p>Esta es una web independiente, no oficial, que no está vinculada a la Intervención General de la Administración del Estado ni a ninguna otra administración, que no participa ni patrocina esta reutilización. La información es orientativa y puede contener errores o haber cambiado: antes de pedir una ayuda, consulta siempre la convocatoria y las bases oficiales.</p>
</div>`,
  }), { priority: '0.3' });
}

// ---------------------------------------------------------------- RSS
const rfc822 = (iso) => new Date(`${iso}T08:00:00Z`).toUTCString();
function rss(p, titulo, items) {
  const its = [...items].sort(porRecientes).slice(0, 60);
  write(p, `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${esc(titulo)} · CuántoGasta Ayudas</title><link>${SITE}${u('/')}</link><description>${esc(titulo)}: convocatorias de ayudas y subvenciones abiertas, con datos de la Base de Datos Nacional de Subvenciones.</description><language>es-es</language>
<atom:link href="${SITE}${u(p)}" rel="self" type="application/rss+xml"/>
${its.map((c) => `<item><title>${esc(c.titulo)}</title><link>${SITE}${u(c.path)}</link><guid isPermaLink="true">${SITE}${u(c.path)}</guid><pubDate>${rfc822(c.f)}</pubDate><description>${esc(`${c.org}. ${zonaTexto(c)}. ${c.pub.length ? `Para ${c.pub.map((x) => x.corto).join(', ')}. ` : ''}${c.e.hasta ? `Plazo hasta el ${fechaLarga(c.e.hasta)}${c.e.k === 'estimada' ? ' (estimado)' : ''}.` : ''}${c.p ? ` Presupuesto: ${euros(c.p)}.` : ''}`)}</description></item>`).join('\n')}
</channel></rss>`);
}
rss('/rss.xml', 'Ayudas y subvenciones nuevas', abiertas);
for (const p of PUBLICOS) rss(`/rss/${p.slug}.xml`, `Ayudas para ${p.corto}`, abiertas.filter((c) => c.pub.includes(p)));
for (const a of CCAA) rss(`/rss/${a.slug}.xml`, `Ayudas en ${a.n}`, abiertas.filter((c) => enCcaa(c, a)));

// ---------------------------------------------------------------- sitemap
write('/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((s) => `<url><loc>${s.loc}</loc><lastmod>${s.lastmod || FECHA_DATOS}</lastmod>${s.priority ? `<priority>${s.priority}</priority>` : ''}</url>`).join('\n')}
</urlset>`);
console.log(`Web generada: ${sitemap.length} páginas en el sitemap, ${nFichas} fichas, ${indice.length} convocatorias en el buscador.`);
