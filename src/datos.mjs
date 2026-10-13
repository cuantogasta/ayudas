// Datos y reglas de CuántoGasta Ayudas: qué convocatorias se publican, cómo se resumen y si están abiertas.
import fs from 'node:fs';

/** Texto en minúsculas y sin acentos, apto para direcciones web. */
export const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------------------------------------------------------------- qué se publica
// En la BDNS el 75 % de los registros son «concesiones directas instrumentales»: subvenciones nominativas a una
// entidad concreta, que nadie más puede pedir. Esta web solo muestra las convocatorias a las que puede presentarse
// cualquiera que cumpla los requisitos (concurrencia competitiva y concesiones directas «canónicas»).
export function esUtil(d) {
  const tipo = d.tipoConvocatoria || '';
  if (/instrumental/i.test(tipo) && !/concurrencia/i.test(tipo)) return false;
  if (/nominativ/i.test(`${d.textFin || ''} ${d.textInicio || ''}`)) return false;
  const regs = (d.regiones || []).map((r) => r.descripcion || '');
  if (regs.length && regs.every((r) => !/^ES/.test(r))) return false; // ayudas para otros países (cooperación)
  return true;
}

/** Guarda solo los campos que usa la web (la caché ocupa unas 5 veces menos). */
export function recorta(d) {
  const o = d.organo || {};
  return {
    id: String(d.codigoBDNS), f: d.fechaRecepcion, t: limpia(d.descripcion), o: [o.nivel1, o.nivel2, o.nivel3].map((x) => x || ''),
    tipo: d.tipoConvocatoria || '', p: Number.isFinite(d.presupuestoTotal) ? d.presupuestoTotal : null,
    b: (d.tiposBeneficiarios || []).map((x) => x.descripcion), fin: d.descripcionFinalidad || '',
    sec: (d.sectores || []).map((x) => x.descripcion), reg: (d.regiones || []).map((x) => x.descripcion),
    ini: d.fechaInicioSolicitud || null, ff: d.fechaFinSolicitud || null, ti: d.textInicio || null, tf: d.textFin || null, ab: !!d.abierto,
    sede: d.sedeElectronica || null, ub: d.urlBasesReguladoras || null, db: limpia(d.descripcionBasesReguladoras || ''),
    mrr: !!d.mrr, fondos: (d.fondos || []).map((x) => x.descripcion).filter(Boolean),
    docs: (d.documentos || []).map((x) => [x.id, limpia(x.descripcion || ''), x.nombreFic || '', x.datPublicacion || '']),
  };
}

/** Quita espacios sobrantes y pasa a minúsculas los textos escritos enteros en mayúsculas. */
const SIGLAS = new Set(['AMPA', 'AMPAS', 'AFA', 'AFAS', 'ONG', 'ONGS', 'BOE', 'BOP', 'BOJA', 'DOGC', 'DOG', 'BOCM', 'IRPF', 'IVA', 'PYME', 'PYMES', 'DANA', 'UE', 'CEIP', 'IES', 'TIC', 'ESO', 'FP', 'I+D', 'I+D+I', 'COVID', 'COVID-19', 'NIF', 'CIF', 'DNI', 'FEDER', 'FSE', 'FSE+', 'FEADER', 'FEMPA', 'PAC', 'MRR', 'PRTR', 'SEPE', 'IMSERSO', 'LGTBI', 'LGTBIQ+', 'TFG', 'TFM', 'EBAU', 'PAU', 'ERTE', 'SL', 'SA', 'S.L.', 'S.A.', 'CCAA']);
/** Quita espacios sobrantes y pasa a minúsculas los textos escritos (casi) enteros en mayúsculas, respetando siglas y números romanos. */
export function limpia(s) {
  let t = String(s || '').replace(/\s+/g, ' ').trim();
  const letras = t.replace(/[^A-Za-zÁÉÍÓÚÜÑÀÈÒÏÇáéíóúüñàèòïç]/g, '');
  const mayus = letras.replace(/[^A-ZÁÉÍÓÚÜÑÀÈÒÏÇ]/g, '').length;
  if (letras.length > 12 && mayus / letras.length > 0.8) {
    t = t.split(' ').map((w, i) => {
      const limpio = w.replace(/^[«"“(¿¡]+|[»"”),.;:!?]+$/g, '');
      if (SIGLAS.has(limpio.toUpperCase()) || /^[IVXLC]{1,6}[ºª]?$/.test(limpio)) return w;
      const l = w.toLowerCase();
      return i === 0 ? l.charAt(0).toUpperCase() + l.slice(1) : l;
    }).join(' ');
  }
  return t;
}

// ---------------------------------------------------------------- zonas
export const CCAA = [
  { c: 'ES61', n: 'Andalucía', p: [['ES611', 'Almería'], ['ES612', 'Cádiz'], ['ES613', 'Córdoba'], ['ES614', 'Granada'], ['ES615', 'Huelva'], ['ES616', 'Jaén'], ['ES617', 'Málaga'], ['ES618', 'Sevilla']] },
  { c: 'ES24', n: 'Aragón', p: [['ES241', 'Huesca'], ['ES242', 'Teruel'], ['ES243', 'Zaragoza']] },
  { c: 'ES12', n: 'Asturias', p: [['ES120', 'Asturias']] },
  { c: 'ES53', n: 'Illes Balears', p: [['ES53X', 'Illes Balears', ['ES531', 'ES532', 'ES533']]] },
  { c: 'ES70', n: 'Canarias', p: [['ES70P', 'Las Palmas', ['ES704', 'ES705', 'ES708']], ['ES70T', 'Santa Cruz de Tenerife', ['ES703', 'ES706', 'ES707', 'ES709']]] },
  { c: 'ES13', n: 'Cantabria', p: [['ES130', 'Cantabria']] },
  { c: 'ES41', n: 'Castilla y León', p: [['ES411', 'Ávila'], ['ES412', 'Burgos'], ['ES413', 'León'], ['ES414', 'Palencia'], ['ES415', 'Salamanca'], ['ES416', 'Segovia'], ['ES417', 'Soria'], ['ES418', 'Valladolid'], ['ES419', 'Zamora']] },
  { c: 'ES42', n: 'Castilla-La Mancha', p: [['ES421', 'Albacete'], ['ES422', 'Ciudad Real'], ['ES423', 'Cuenca'], ['ES424', 'Guadalajara'], ['ES425', 'Toledo']] },
  { c: 'ES51', n: 'Cataluña', p: [['ES511', 'Barcelona'], ['ES512', 'Girona'], ['ES513', 'Lleida'], ['ES514', 'Tarragona']] },
  { c: 'ES52', n: 'Comunitat Valenciana', p: [['ES521', 'Alicante'], ['ES522', 'Castellón'], ['ES523', 'Valencia']] },
  { c: 'ES43', n: 'Extremadura', p: [['ES431', 'Badajoz'], ['ES432', 'Cáceres']] },
  { c: 'ES11', n: 'Galicia', p: [['ES111', 'A Coruña'], ['ES112', 'Lugo'], ['ES113', 'Ourense'], ['ES114', 'Pontevedra']] },
  { c: 'ES30', n: 'Comunidad de Madrid', p: [['ES300', 'Madrid']] },
  { c: 'ES62', n: 'Región de Murcia', p: [['ES620', 'Murcia']] },
  { c: 'ES22', n: 'Navarra', p: [['ES220', 'Navarra']] },
  { c: 'ES21', n: 'País Vasco', p: [['ES211', 'Álava'], ['ES212', 'Gipuzkoa'], ['ES213', 'Bizkaia']] },
  { c: 'ES23', n: 'La Rioja', p: [['ES230', 'La Rioja']] },
  { c: 'ES63', n: 'Ceuta', p: [['ES630', 'Ceuta']] },
  { c: 'ES64', n: 'Melilla', p: [['ES640', 'Melilla']] },
].map((a) => ({ ...a, slug: slug(a.n), prov: a.p.map(([c, n, codigos]) => ({ c, n, slug: slug(n), codigos: codigos || [c], ccaa: a.c })) }));
for (const a of CCAA) if (a.prov.length === 1) a.prov[0].slug = a.slug; // comunidades uniprovinciales: una sola página
export const PROVINCIAS = CCAA.flatMap((a) => a.prov);
const PROV_DE_NUTS3 = Object.fromEntries(PROVINCIAS.flatMap((p) => p.codigos.map((c) => [c, p])));
const CCAA_DE_NUTS2 = Object.fromEntries(CCAA.map((a) => [a.c, a]));
// NUTS 1 que son una sola comunidad
const NUTS1 = { ES3: ['ES30'], ES7: ['ES70'], ES1: ['ES11', 'ES12', 'ES13'], ES2: ['ES21', 'ES22', 'ES23', 'ES24'], ES4: ['ES41', 'ES42', 'ES43'], ES5: ['ES51', 'ES52', 'ES53'], ES6: ['ES61', 'ES62', 'ES63', 'ES64'] };
// por si la convocatoria no indica la región: comunidad del órgano autonómico
const CCAA_POR_NOMBRE = Object.fromEntries(CCAA.map((a) => [slug(a.n).replace(/-/g, ''), a]));
const ALIAS_CCAA = { andalucia: 'ES61', aragon: 'ES24', principadodeasturias: 'ES12', asturias: 'ES12', illesbalears: 'ES53', islasbaleares: 'ES53', canarias: 'ES70', cantabria: 'ES13', castillayleon: 'ES41', castillalamancha: 'ES42', cataluna: 'ES51', catalunya: 'ES51', comunitatvalenciana: 'ES52', comunidadvalenciana: 'ES52', extremadura: 'ES43', galicia: 'ES11', comunidaddemadrid: 'ES30', madrid: 'ES30', regiondemurcia: 'ES62', murcia: 'ES62', navarra: 'ES22', comunidadforaldenavarra: 'ES22', paisvasco: 'ES21', euskadi: 'ES21', larioja: 'ES23', ceuta: 'ES63', melilla: 'ES64', ciudadautonomadeceuta: 'ES63', ciudadautonomademelilla: 'ES64' };

/** Clave para comparar nombres de entidades: sin acentos, en minúsculas y solo letras y números. */
export const clave = (s) => slug(s).replace(/-/g, '');
// código INE de provincia → provincia de esta web
const INE = { '01': 'ES211', '02': 'ES421', '03': 'ES521', '04': 'ES611', '05': 'ES411', '06': 'ES431', '07': 'ES53X', '08': 'ES511', '09': 'ES412', 10: 'ES432', 11: 'ES612', 12: 'ES522', 13: 'ES422', 14: 'ES613', 15: 'ES111', 16: 'ES423', 17: 'ES512', 18: 'ES614', 19: 'ES424', 20: 'ES212', 21: 'ES615', 22: 'ES241', 23: 'ES616', 24: 'ES413', 25: 'ES513', 26: 'ES230', 27: 'ES112', 28: 'ES300', 29: 'ES617', 30: 'ES620', 31: 'ES220', 32: 'ES113', 33: 'ES120', 34: 'ES414', 35: 'ES70P', 36: 'ES114', 37: 'ES415', 38: 'ES70T', 39: 'ES130', 40: 'ES416', 41: 'ES618', 42: 'ES417', 43: 'ES514', 44: 'ES242', 45: 'ES425', 46: 'ES523', 47: 'ES418', 48: 'ES213', 49: 'ES419', 50: 'ES243', 51: 'ES630', 52: 'ES640' };
let LOCALES = {};
try { LOCALES = JSON.parse(fs.readFileSync(new URL('./content/locales.json', import.meta.url), 'utf8')); } catch { /* sin lista: se usa la región que indique la BDNS */ }
/** Provincia de una entidad local (ayuntamiento, diputación, mancomunidad…) según el árbol de la BDNS. */
function provinciaLocal(c) {
  for (const n of [c.o[1], c.o[2]]) {
    const ine = LOCALES[clave(n || '')];
    if (ine && ine !== 'X') return PROV_DE_NUTS3[INE[ine]] || PROVINCIAS.find((p) => p.c === INE[ine]) || null;
  }
  return null;
}

/** Ámbito geográfico: nacional, o las comunidades y provincias donde se puede pedir. */
export function ambito(c) {
  // Las entidades locales convocan para su municipio o provincia, aunque en la BDNS marquen «España» o la comunidad entera.
  if (c.o[0] === 'LOCAL') {
    const p = provinciaLocal(c);
    const nuts3 = c.reg.map((r) => (r.match(/^(ES\w{3})\b/) || [])[1]).filter((x) => x && PROV_DE_NUTS3[x]);
    if (p && !nuts3.length) return { nacional: false, ccaa: [p.ccaa], prov: [p.c], ccaaEntera: [] };
  }
  const ccaa = new Set(), prov = new Set();
  let nacional = false;
  for (const r of c.reg) {
    const code = (r.match(/^(ES[0-9A-Z]*)/) || [])[1];
    if (!code) continue;
    if (code === 'ES') nacional = true;
    else if (code.length === 3 && NUTS1[code]) for (const x of NUTS1[code]) ccaa.add(x);
    else if (code.length === 4 && CCAA_DE_NUTS2[code]) ccaa.add(code);
    else if (code.length === 5 && PROV_DE_NUTS3[code]) { prov.add(PROV_DE_NUTS3[code].c); ccaa.add(PROV_DE_NUTS3[code].ccaa); }
  }
  if (!c.reg.length) {
    if (c.o[0] === 'ESTADO') nacional = true;
    else if (c.o[0] === 'AUTONOMICA') { const a = CCAA_DE_NUTS2[ALIAS_CCAA[slug(c.o[1]).replace(/-/g, '')]] || CCAA_POR_NOMBRE[slug(c.o[1]).replace(/-/g, '')]; if (a) ccaa.add(a.c); }
  }
  // comunidad entera = sin provincias concretas
  const soloCcaa = [...ccaa].filter((a) => !PROVINCIAS.some((p) => p.ccaa === a && prov.has(p.c)));
  return { nacional: nacional || ccaa.size >= 15, ccaa: [...ccaa], prov: [...prov], ccaaEntera: soloCcaa };
}

// ---------------------------------------------------------------- para quién
export const PUBLICOS = [
  { id: 'autonomos', slug: 'autonomos-y-pymes', n: 'Autónomos y pymes', corto: 'autónomos y pymes', bdns: 'PYME Y PERSONAS FÍSICAS QUE DESARROLLAN ACTIVIDAD ECONÓMICA', ico: 'briefcase', desc: 'Ayudas para autónomos, pequeñas y medianas empresas y profesionales: contratación, digitalización, comercio, turismo, inversión y más.' },
  { id: 'particulares', slug: 'particulares', n: 'Particulares y familias', corto: 'particulares', bdns: 'PERSONAS FÍSICAS QUE NO DESARROLLAN ACTIVIDAD ECONÓMICA', ico: 'home', desc: 'Ayudas para personas y familias: vivienda y alquiler, estudios y becas, natalidad, dependencia, rehabilitación, eficiencia energética y más.' },
  { id: 'entidades', slug: 'asociaciones-y-entidades', n: 'Asociaciones y entidades', corto: 'asociaciones y entidades', bdns: 'PERSONAS JURÍDICAS QUE NO DESARROLLAN ACTIVIDAD ECONÓMICA', ico: 'users', desc: 'Subvenciones para asociaciones, fundaciones, ONG, clubes deportivos, AMPAs, entidades culturales y sociales y otras entidades sin ánimo de lucro.' },
  { id: 'empresas', slug: 'grandes-empresas', n: 'Grandes empresas', corto: 'grandes empresas', bdns: 'GRAN EMPRESA', ico: 'factory', desc: 'Ayudas abiertas también a grandes empresas: industria, energía, I+D+i, internacionalización y proyectos estratégicos.' },
];
export const publicosDe = (c) => PUBLICOS.filter((p) => c.b.some((b) => b.toUpperCase().includes(p.bdns)));

// ---------------------------------------------------------------- temas (finalidad de la BDNS)
export const TEMAS = [
  { k: 'acceso a la vivienda', n: 'Vivienda y edificación', slug: 'vivienda', ico: 'home' },
  { k: 'agricultura', n: 'Agricultura, pesca y alimentación', slug: 'agricultura-y-pesca', ico: 'leaf' },
  { k: 'comercio, turismo', n: 'Comercio, turismo y pymes', slug: 'comercio-turismo-y-pymes', ico: 'shop' },
  { k: 'cooperación internacional', n: 'Cooperación internacional', slug: 'cooperacion-internacional', ico: 'globe' },
  { k: 'cultura', n: 'Cultura', slug: 'cultura', ico: 'book' },
  { k: 'defensa', n: 'Defensa', slug: 'defensa', ico: 'shield' },
  { k: 'desempleo', n: 'Desempleo', slug: 'desempleo', ico: 'briefcase' },
  { k: 'educación', n: 'Educación y becas', slug: 'educacion-y-becas', ico: 'cap' },
  { k: 'fomento del empleo', n: 'Empleo y contratación', slug: 'empleo', ico: 'briefcase' },
  { k: 'industria y energía', n: 'Industria y energía', slug: 'industria-y-energia', ico: 'bolt' },
  { k: 'infraestructuras', n: 'Infraestructuras', slug: 'infraestructuras', ico: 'road' },
  { k: 'investigación', n: 'I+D+i', slug: 'investigacion-e-innovacion', ico: 'flask' },
  { k: 'justicia', n: 'Justicia', slug: 'justicia', ico: 'scale' },
  { k: 'medio ambiente', n: 'Medio ambiente', slug: 'medio-ambiente', ico: 'leaf' },
  { k: 'sanidad', n: 'Sanidad', slug: 'sanidad', ico: 'heart' },
  { k: 'seguridad ciudadana', n: 'Seguridad ciudadana', slug: 'seguridad', ico: 'shield' },
  { k: 'servicios sociales', n: 'Servicios sociales', slug: 'servicios-sociales', ico: 'users' },
  { k: 'subvenciones al transporte', n: 'Transporte', slug: 'transporte', ico: 'road' },
  { k: 'transporte', n: 'Transporte', slug: 'transporte', ico: 'road' },
  { k: 'otras prestaciones', n: 'Otras prestaciones económicas', slug: 'otras-prestaciones', ico: 'euro' },
  { k: 'otras actuaciones', n: 'Otras actuaciones económicas', slug: 'otras-actuaciones-economicas', ico: 'euro' },
  { k: 'deporte', n: 'Deporte', slug: 'deporte', ico: 'trophy' },
];
export function temaDe(c) {
  const f = (c.fin || '').toLowerCase();
  return TEMAS.find((t) => f.startsWith(t.k) || f.includes(t.k)) || (f && !/no disponible/.test(f) ? { n: c.fin, slug: slug(c.fin), ico: 'euro' } : null);
}

// ---------------------------------------------------------------- plazo
const sumaDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const NUM = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cuarenta_y_cinco: 45, sesenta: 60 };
/** Duración del plazo escrita en el texto («20 días hábiles», «un mes», «quince días naturales»…), en días naturales. */
export function duracionTexto(t) {
  if (!t) return null;
  const s = t.toLowerCase().replace(/cuarenta y cinco/g, 'cuarenta_y_cinco');
  const m = s.match(/(\d{1,3}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta_y_cinco|cuarenta|sesenta)\s*(?:\(\d+\)\s*)?(d[ií]as?|mes(?:es)?|semanas?)\s*(h[aá]biles|naturales)?/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM[m[1]];
  if (!n || n > 365) return null;
  if (m[2].startsWith('mes')) return n * 30;
  if (m[2].startsWith('semana')) return n * 7;
  return m[3] && m[3].startsWith('n') ? n : Math.ceil(n * 7 / 5) + 2; // días hábiles (y algún festivo)
}

const RETRASO_BOLETIN = 10; // días que suele tardar el extracto en publicarse en el boletín oficial tras registrarse en la BDNS
const VIGENCIA_SIN_PLAZO = 45; // convocatorias sin plazo legible: se muestran como «consulta el plazo» durante 45 días

/**
 * Estado del plazo de solicitud a fecha `hoy`:
 *  abierta  — con fechas oficiales y hoy está dentro del plazo
 *  proxima  — el plazo aún no ha empezado
 *  estimada — el plazo se cuenta desde la publicación en el boletín; fecha de fin calculada (aproximada)
 *  consultar— la BDNS no da un plazo legible; reciente
 *  cerrada
 */
export function estado(c, hoy) {
  if (c.ini && c.ini > hoy && (!c.ff || c.ff >= c.ini)) return { k: 'proxima', desde: c.ini, hasta: c.ff };
  if (c.ff) return c.ff >= hoy ? { k: 'abierta', hasta: c.ff, desde: c.ini } : { k: 'cerrada', hasta: c.ff };
  const dur = duracionTexto(c.tf);
  if (dur) {
    const hasta = sumaDias(c.f, RETRASO_BOLETIN + dur);
    return hasta >= hoy ? { k: 'estimada', hasta } : { k: 'cerrada', hasta, estimado: true };
  }
  const limite = sumaDias(c.f, VIGENCIA_SIN_PLAZO);
  if (c.ab && limite >= hoy) return { k: 'abierta', hasta: null };
  return limite >= hoy ? { k: 'consultar', hasta: null } : { k: 'cerrada', hasta: null };
}
export const ABIERTOS = new Set(['abierta', 'estimada', 'consultar', 'proxima']);

const MENORES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'i', 'a', 'en', 'para', 'por', 'con', 'al', 'o', 'u', 'les', 'dels', 'da', 'do', 'das', 'dos', 'sobre']);
/** Nombre propio en mayúsculas iniciales: «AYUNTAMIENTO DE MONT-ROIG DEL CAMP» → «Ayuntamiento de Mont-Roig del Camp». */
export function nombrePropio(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  const letras = t.replace(/[^A-Za-zÁÉÍÓÚÜÑÀÈÒÏÇáéíóúüñàèòïç]/g, '');
  if (!letras || letras !== letras.toUpperCase()) return t; // ya viene bien escrito
  return t.toLowerCase().split(' ').map((w, i) => {
    if (/^\(?[a-z]{2,6}\)?$/i.test(w) && /^\(/.test(w)) return w.toUpperCase(); // siglas entre paréntesis
    if (i > 0 && MENORES.has(w)) return w;
    return w.replace(/(^|[-/(«"'’])([a-záéíóúüñàèòïç])/g, (m, a, b) => a + b.toUpperCase());
  }).join(' ').replace(/\b(D|L)['’]([a-z])/gi, (m, a, b) => `${a.toLowerCase()}'${b.toUpperCase()}`);
}

/** Organismo convocante legible: «Ayuntamiento de Mont-Roig del Camp», «Consejería de… (Andalucía)». */
export function organismo(c) {
  const [, n2, n3] = c.o.map(nombrePropio);
  const n1 = c.o[0];
  if (n1 === 'LOCAL') return n3 || n2;
  if (n1 === 'ESTADO') return n3 && n2 && !n3.toLowerCase().includes(n2.toLowerCase().slice(0, 12)) ? `${n2} · ${n3}` : (n3 || n2);
  return n3 && n2 ? `${n3} (${n2})` : (n3 || n2 || 'Administración pública');
}
export const NIVEL = { ESTADO: 'Estado', AUTONOMICA: 'Comunidad autónoma', LOCAL: 'Administración local', OTROS: 'Otros organismos públicos' };
