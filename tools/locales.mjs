// Descarga de la BDNS el árbol de entidades locales (provincia → municipio, diputación o mancomunidad) y guarda
// src/content/locales.json: nombre normalizado → código INE de la provincia. Sirve para situar en su provincia las
// convocatorias de ayuntamientos que en la BDNS aparecen con ámbito «España». Si la descarga falla, se queda el fichero anterior.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clave } from '../src/datos.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'content', 'locales.json');
try {
  const r = await fetch('https://www.infosubvenciones.es/bdnstrans/api/organos/agrupacion?vpd=GE&idAdmon=L', { headers: { 'User-Agent': 'CuantoGasta-Ayudas/1.0', Accept: 'application/json' }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const arbol = await r.json();
  const m = {};
  for (const p of arbol) for (const e of p.children || []) {
    const k = clave(e.descripcion);
    m[k] = m[k] && m[k] !== p.id ? 'X' : p.id; // «X»: el mismo nombre en dos provincias
  }
  if (Object.keys(m).length < 1000) throw new Error(`solo ${Object.keys(m).length} entidades`);
  fs.writeFileSync(OUT, JSON.stringify(m));
  console.log(`Entidades locales: ${Object.keys(m).length}`);
} catch (e) {
  console.warn(`::warning::No se pudo actualizar la lista de entidades locales (${e.message}); se usa la guardada.`);
}
