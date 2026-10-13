// CuántoGasta Ayudas: buscador de convocatorias abiertas con filtros. Sin dependencias.
const BASE = '__BASE__';
const ICO = __ICONS__;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nf = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1, useGrouping: 'always' });
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const corta = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MESES[m - 1]}${String(y) !== hoy.slice(0, 4) ? ` ${y}` : ''}`; };
const dias = (iso) => Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 864e5);
const eurosCorto = (n) => (n >= 1e6 ? `${nf.format(n / 1e6)} M€` : n >= 1e4 ? `${nf.format(Math.round(n / 1e3))} mil €` : `${nf.format(n)} €`);
const POR_PAGINA = 30;

let datosP = null;
const cargar = () => (datosP ||= fetch(`${BASE}/datos/indice.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((d) => {
  // [id, título, organismo, estado, hasta, presupuesto, nacional, ccaa, provincias, públicos, tema, registro, ruta, desde, zona]
  d.items = d.i.map((x) => ({ id: x[0], t: x[1], o: x[2], k: x[3], hasta: x[4], p: x[5], nac: x[6] === 1, ccaa: x[7] ? x[7].split(',') : [], prov: x[8] ? x[8].split(',') : [], pub: x[9], tema: x[10], f: x[11], path: x[12], desde: x[13], zona: x[14], n: norm(`${x[1]} ${x[2]} ${x[14]}`) }));
  return d;
}).catch((e) => { datosP = null; throw e; }));

function badge(it) {
  let t = { abierta: 'Abierta', estimada: 'Abierta (plazo estimado)', consultar: 'Plazo por confirmar', proxima: 'Próximamente', cerrada: 'Cerrada' }[it.k];
  let k = it.k;
  if (k === 'abierta' && it.hasta) { const d = dias(it.hasta); if (d < 0) { k = 'cerrada'; t = 'Plazo cerrado'; } else t = d === 0 ? 'Cierra hoy' : d === 1 ? 'Cierra mañana' : d <= 30 ? `Quedan ${d} días` : `Hasta el ${corta(it.hasta)}`; }
  if (k === 'estimada') t = `Plazo estimado: ${corta(it.hasta)}`;
  if (k === 'proxima') t = `Se abre el ${corta(it.desde)}`;
  return { k, html: `<li class="bd bd-${k}">${ICO[k === 'cerrada' ? 'clock' : 'hourglass']}${esc(t)}</li>` };
}
function card(it, pubs) {
  const b = badge(it);
  const ps = pubs.filter((p, i) => it.pub & (1 << i));
  return `<li class="ay-card k-${b.k}"><h3><a href="${BASE}${it.path}">${esc(it.t)}</a></h3><p class="ay-org">${esc(it.o)}</p><ul class="ay-meta">${b.html}<li>${ICO.pin}${esc(it.zona)}</li>${ps.length ? `<li>${ICO[ps[0][2]] || ''}${esc(ps.map((p) => p[1]).join(' · '))}</li>` : ''}${it.p ? `<li>${ICO.coin}${esc(eurosCorto(it.p))}</li>` : ''}</ul></li>`;
}

function iniciar(box) {
  const fijo = JSON.parse(box.dataset.finder || '{}');
  const $ = (s) => box.querySelector(s);
  const f = Object.fromEntries([...box.querySelectorAll('[data-f]')].map((el) => [el.dataset.f, el]));
  const chips = [...box.querySelectorAll('[data-pub]')];
  const out = $('.finder-out');
  const count = $('.finder-count');
  const servidor = document.querySelector('[data-server-list]');
  const esPortada = !Object.keys(fijo).length;
  let mostradas = esPortada ? 10 : POR_PAGINA;
  let tocado = false;

  // estado inicial desde la dirección (?q=…&ccaa=…), solo en la portada
  const qs = new URLSearchParams(location.search);
  if (esPortada) {
    for (const k of ['q', 'ccaa', 'prov', 'tema', 'orden', 'nac']) if (qs.get(k) && f[k]) f[k].value = qs.get(k);
    const pq = (qs.get('pub') || '').split(',');
    for (const c of chips) if (pq.includes(c.dataset.pub)) c.setAttribute('aria-pressed', 'true');
  }
  const provOpts = [...f.prov.options].slice(1).map((o) => ({ v: o.value, t: o.textContent, ccaa: o.dataset.ccaa }));
  const pintarProv = () => {
    const a = f.ccaa.value, actual = f.prov.value;
    const lista = provOpts.filter((o) => !a || o.ccaa === a);
    f.prov.innerHTML = `<option value="">Todas las provincias</option>${lista.map((o) => `<option value="${o.v}" data-ccaa="${o.ccaa}">${esc(o.t)}</option>`).join('')}`;
    f.prov.value = lista.some((o) => o.v === actual) ? actual : '';
    f.prov.disabled = !lista.length;
  };
  pintarProv();

  async function pintar() {
    let d;
    try { d = await cargar(); } catch { out.innerHTML = '<p class="ay-empty">No se ha podido cargar el buscador. Recarga la página.</p>'; return; }
    const q = norm(f.q.value).split(/\s+/).filter((w) => w.length > 1);
    const ccaa = f.ccaa.value, prov = f.prov.value, tema = f.tema.value, nac = f.nac.value !== '0';
    const provCcaa = provOpts.find((o) => o.v === prov)?.ccaa || '';
    const pubs = chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => d.pub.findIndex((p) => p[0] === c.dataset.pub));
    let r = d.items.filter((it) => {
      if (q.length && !q.every((w) => it.n.includes(w))) return false;
      if (tema && it.tema !== tema) return false;
      if (pubs.length && !pubs.some((i) => it.pub & (1 << i))) return false;
      if (prov) return it.prov.includes(prov) || it.prov.includes(`*${provCcaa}`) || (nac && it.nac);
      if (ccaa) return it.ccaa.includes(ccaa) || (nac && it.nac);
      if (!nac) return !it.nac;
      return true;
    });
    const orden = f.orden.value;
    const clave = (it) => (it.k === 'proxima' ? `2${it.desde}` : it.hasta ? `0${it.hasta}` : `1${it.f}`);
    if (orden === 'recientes') r.sort((a, b) => b.f.localeCompare(a.f));
    else if (orden === 'importe') r.sort((a, b) => b.p - a.p);
    else r.sort((a, b) => (clave(a) < clave(b) ? -1 : clave(a) > clave(b) ? 1 : b.f.localeCompare(a.f)));
    r = r.filter((it) => badge(it).k !== 'cerrada');
    count.innerHTML = `<b>${nf.format(r.length)}</b> ${r.length === 1 ? 'ayuda abierta' : 'ayudas abiertas'}`;
    out.innerHTML = r.length
      ? `<ul class="ay-list">${r.slice(0, mostradas).map((it) => card(it, d.pub)).join('')}</ul>${r.length > mostradas ? `<div class="finder-more"><button type="button" class="btn btn-ghost" data-mas>Ver ${nf.format(Math.min(POR_PAGINA, r.length - mostradas))} más</button></div>` : ''}`
      : '<p class="ay-empty">No hay ayudas abiertas con estos filtros. Prueba con menos filtros o con otras palabras.</p>';
    if (servidor && (tocado || !esPortada)) servidor.hidden = true;
    if (esPortada && tocado) {
      const p = new URLSearchParams();
      for (const k of ['q', 'ccaa', 'prov', 'tema']) if (f[k].value) p.set(k, f[k].value);
      if (f.orden.value !== 'cierre') p.set('orden', f.orden.value);
      if (f.nac.value === '0') p.set('nac', '0');
      const pq = chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.pub);
      if (pq.length) p.set('pub', pq.join(','));
      history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}${location.hash}`);
    }
  }
  let t;
  const cambio = () => { tocado = true; mostradas = POR_PAGINA; clearTimeout(t); t = setTimeout(pintar, 120); };
  f.q.addEventListener('input', cambio);
  f.ccaa.addEventListener('change', () => { pintarProv(); cambio(); });
  for (const k of ['prov', 'tema', 'orden', 'nac']) f[k].addEventListener('change', cambio);
  for (const c of chips) c.addEventListener('click', () => { c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); cambio(); });
  out.addEventListener('click', (e) => { if (e.target.closest('[data-mas]')) { mostradas += POR_PAGINA; pintar(); } });
  box.addEventListener('submit', (e) => e.preventDefault());
  // carga perezosa: cuando el buscador entra en pantalla
  const io = new IntersectionObserver((ents) => { if (ents.some((x) => x.isIntersecting)) { io.disconnect(); pintar(); } }, { rootMargin: '300px' });
  io.observe(box);
}
document.querySelectorAll('[data-finder]').forEach(iniciar);
