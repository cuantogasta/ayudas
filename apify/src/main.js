// Spain Public Grants & Subsidies: every call for applications in Spain's national grants database (BDNS),
// with status, deadline, region, who can apply and official links.
import { readFile } from 'node:fs/promises';
import { Actor, log } from 'apify';
import { REGIONS } from './regions.js';

const DATA_URL = process.env.GRANTS_DATA_URL || 'https://cuantogasta.github.io/ayudas/datos/api/convocatorias.json';

const STATUS = { abierta: 'open', estimada: 'openEstimatedDeadline', consultar: 'checkDeadline', proxima: 'upcoming', cerrada: 'closed' };
const LEVEL = { Estado: 'state', 'Comunidad autónoma': 'region', 'Administración local': 'local', 'Otros organismos públicos': 'otherPublicBody' };
const AUDIENCE = { particulares: 'individuals', entidades: 'nonProfits', autonomos: 'smesAndSelfEmployed', empresas: 'largeCompanies' };
const TOPIC = {
    'Vivienda y edificación': 'housing',
    'Agricultura, pesca y alimentación': 'agriculture',
    'Comercio, turismo y pymes': 'tradeTourismSmes',
    'Cooperación internacional': 'internationalCooperation',
    Cultura: 'culture',
    Defensa: 'defence',
    Deporte: 'sport',
    Desempleo: 'unemployment',
    'Educación y becas': 'education',
    'Empleo y contratación': 'employment',
    'Industria y energía': 'industryEnergy',
    Infraestructuras: 'infrastructure',
    'I+D+i': 'research',
    Justicia: 'justice',
    'Medio ambiente': 'environment',
    Sanidad: 'health',
    'Seguridad ciudadana': 'publicSafety',
    'Servicios sociales': 'socialServices',
    Transporte: 'transport',
    'Otras prestaciones económicas': 'otherBenefits',
    'Otras actuaciones económicas': 'otherEconomic',
};

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const {
    keywords = [],
    excludeKeywords = [],
    statuses = ['open', 'openEstimatedDeadline', 'checkDeadline', 'upcoming'],
    audiences = [],
    regions = [],
    provinces = [],
    includeNationwide = true,
    administrationLevels = [],
    topics = [],
    organization = '',
    publishedFrom = '',
    publishedInLastDays = 0,
    deadlineWithinDays = 0,
    minBudgetEUR = 0,
    euFundedOnly = false,
    sortBy = 'newest',
    maxResults = 0,
    includeDocuments = true,
} = input;

const fail = async (msg) => { log.error(msg); await Actor.fail(msg); };

// ---------------------------------------------------------------- validate input
const checkList = async (name, values, valid) => {
    const bad = values.find((v) => !valid.includes(v));
    if (bad) await fail(`Unknown value "${bad}" in "${name}". Valid values: ${valid.join(', ')}`);
};
await checkList('statuses', statuses, Object.values(STATUS));
await checkList('audiences', audiences, Object.values(AUDIENCE));
await checkList('administrationLevels', administrationLevels, Object.values(LEVEL));
await checkList('topics', topics, Object.values(TOPIC));

const regionByFold = Object.fromEntries(Object.keys(REGIONS).map((r) => [fold(r), r]));
const provinceRegion = Object.fromEntries(Object.entries(REGIONS).flatMap(([r, ps]) => ps.map((p) => [fold(p), r])));
const wantedRegions = regions.map((r) => regionByFold[fold(r)] ?? r);
const badRegion = wantedRegions.find((r) => !REGIONS[r]);
if (badRegion) await fail(`Unknown region "${badRegion}". Valid values: ${Object.keys(REGIONS).join(', ')}`);
const badProvince = provinces.find((p) => !provinceRegion[fold(p)]);
if (badProvince) await fail(`Unknown province "${badProvince}". Valid values: ${Object.values(REGIONS).flat().join(', ')}`);
if (publishedFrom && !/^\d{4}-\d{2}-\d{2}/.test(publishedFrom)) await fail('"publishedFrom" must be YYYY-MM-DD.');

// ---------------------------------------------------------------- download
log.info('Downloading the grants database…');
let data;
for (let attempt = 1; ; attempt++) {
    try {
        if (/^https?:/.test(DATA_URL)) {
            const res = await fetch(DATA_URL, { signal: AbortSignal.timeout(120000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            data = await res.json();
        } else {
            data = JSON.parse(await readFile(DATA_URL, 'utf8'));
        }
        break;
    } catch (err) {
        if (attempt >= 4) { await fail(`Could not download the data: ${err.message}`); break; }
        log.warning(`Download failed (${err.message}), retrying…`);
        await new Promise((r) => setTimeout(r, attempt * 5000));
    }
}
log.info(`${data.convocatorias.length} calls downloaded (data updated ${data.actualizado}).`);

// ---------------------------------------------------------------- map to English records
const statusOf = (c) => {
    let k = c.estado;
    if (k === 'proxima' && c.inicio && c.inicio <= today) k = c.finEstimado ? 'estimada' : 'abierta';
    if (k !== 'cerrada' && c.fin && c.fin < today) k = 'cerrada';
    return STATUS[k] ?? k;
};

const toRecord = (c) => {
    const status = statusOf(c);
    return {
        bdnsCode: c.id,
        title: c.titulo,
        organization: c.organismo,
        administrationLevel: LEVEL[c.nivel] ?? c.nivel,
        procedure: /directa/i.test(c.tipo || '') ? 'directAward' : c.tipo ? 'competitive' : null,
        status,
        applicationStart: c.inicio,
        applicationEnd: c.fin,
        deadlineEstimated: c.finEstimado,
        daysLeft: c.fin && status !== 'closed' ? daysBetween(today, c.fin) : null,
        applicationStartText: c.textoInicio || null,
        applicationEndText: c.textoFin || null,
        publishedAt: c.publicada,
        budgetEUR: c.presupuesto ?? null,
        audiences: c.publicos.map((p) => AUDIENCE[p] ?? p),
        beneficiaryTypes: c.beneficiarios,
        topic: TOPIC[c.tema] ?? null,
        topicEs: c.tema,
        purpose: c.finalidad,
        sectors: c.sectores,
        nationwide: c.nacional,
        regions: c.ccaa,
        provinces: c.provincias,
        nutsRegions: c.regiones,
        euFunds: c.fondosUE,
        recoveryPlanFunded: c.mrr,
        applicationPortalUrl: c.sede,
        regulatoryBasesReference: c.bases || null,
        regulatoryBasesTitle: c.basesTexto,
        officialUrl: c.bdns,
        pageUrl: c.ficha,
        ...(includeDocuments ? { documents: c.documentos.map((d) => ({ name: d.nombre, fileName: d.fichero, publishedAt: d.publicado, url: d.url })) } : {}),
        dataUpdatedAt: data.actualizado,
        source: 'Base de Datos Nacional de Subvenciones (BDNS), Intervención General de la Administración del Estado',
        _search: fold([c.tituloCompleto, c.organismo, c.tema, c.finalidad, ...c.sectores, ...c.beneficiarios].join(' ')),
    };
};

let grants = data.convocatorias.map(toRecord);

// ---------------------------------------------------------------- filter
const phraseMatch = (text, phrase) => fold(phrase).split(' ').filter(Boolean).every((w) => text.includes(w));
if (statuses.length) grants = grants.filter((g) => statuses.includes(g.status));
if (keywords.length) grants = grants.filter((g) => keywords.some((k) => phraseMatch(g._search, k)));
if (excludeKeywords.length) grants = grants.filter((g) => !excludeKeywords.some((k) => phraseMatch(g._search, k)));
if (audiences.length) grants = grants.filter((g) => g.audiences.some((a) => audiences.includes(a)));
if (administrationLevels.length) grants = grants.filter((g) => administrationLevels.includes(g.administrationLevel));
if (topics.length) grants = grants.filter((g) => topics.includes(g.topic));
if (organization) { const q = fold(organization); grants = grants.filter((g) => fold(g.organization).includes(q)); }
if (publishedFrom) grants = grants.filter((g) => g.publishedAt >= publishedFrom.slice(0, 10));
if (Number(publishedInLastDays) > 0) {
    const since = new Date(Date.parse(today) - Number(publishedInLastDays) * 86400000).toISOString().slice(0, 10);
    grants = grants.filter((g) => g.publishedAt >= since);
}
if (Number(deadlineWithinDays) > 0) grants = grants.filter((g) => g.daysLeft !== null && g.daysLeft >= 0 && g.daysLeft <= Number(deadlineWithinDays));
if (Number(minBudgetEUR) > 0) grants = grants.filter((g) => (g.budgetEUR ?? 0) >= Number(minBudgetEUR));
if (euFundedOnly) grants = grants.filter((g) => g.euFunds.length > 0 || g.recoveryPlanFunded);
if (wantedRegions.length || provinces.length) {
    const provs = provinces.map((p) => ({ name: Object.values(REGIONS).flat().find((x) => fold(x) === fold(p)), region: provinceRegion[fold(p)] }));
    grants = grants.filter((g) => (includeNationwide && g.nationwide)
        || g.regions.some((r) => wantedRegions.includes(r))
        || provs.some((p) => g.provinces.includes(p.name) || (g.regions.includes(p.region) && g.provinces.length === 0)));
}

// ---------------------------------------------------------------- sort and limit
const sorters = {
    newest: (a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.bdnsCode.localeCompare(a.bdnsCode),
    deadline: (a, b) => (a.applicationEnd ?? '9999').localeCompare(b.applicationEnd ?? '9999'),
    budget: (a, b) => (b.budgetEUR ?? -1) - (a.budgetEUR ?? -1),
};
if (sorters[sortBy]) grants.sort(sorters[sortBy]);

let limit = Number(maxResults) > 0 ? Number(maxResults) : grants.length;
const maxPaid = Number(process.env.ACTOR_MAX_PAID_DATASET_ITEMS || 0);
if (maxPaid > 0 && maxPaid < limit) { log.info(`Limited to ${maxPaid} results by the run's maximum paid items.`); limit = maxPaid; }
const out = grants.slice(0, limit).map(({ _search, ...g }) => g);

// ---------------------------------------------------------------- save
for (let i = 0; i < out.length; i += 1000) await Actor.pushData(out.slice(i, i + 1000));

const count = (key) => out.reduce((m, g) => { for (const v of [].concat(g[key] ?? 'none')) m[v] = (m[v] || 0) + 1; return m; }, {});
await Actor.setValue('SUMMARY', {
    date: today,
    dataUpdatedAt: data.actualizado,
    grants: out.length,
    totalBudgetEUR: out.reduce((t, g) => t + (g.budgetEUR || 0), 0),
    closingInNext7Days: out.filter((g) => g.daysLeft !== null && g.daysLeft >= 0 && g.daysLeft <= 7).length,
    byStatus: count('status'),
    byAudience: count('audiences'),
    byTopic: count('topic'),
    byAdministrationLevel: count('administrationLevel'),
    byRegion: count('regions'),
});
log.info(`Done: ${out.length} grants saved. Counts by status, audience, topic and region in the key-value store (SUMMARY).`);

await Actor.exit();
