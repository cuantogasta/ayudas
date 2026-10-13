// Comprueba la web publicada. Si los datos tienen más de dos días, termina con error para que GitHub envíe un
// correo de aviso al propietario del repositorio (la web sigue funcionando con los últimos datos).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const URL_BASE = CFG.siteUrl.replace(/\/$/, '') + CFG.base;

const res = await fetch(`${URL_BASE}/datos/resumen.json?t=${Date.now()}`);
if (!res.ok) { console.error(`::error::La web no responde (${res.status}) en ${URL_BASE}/`); process.exit(1); }
const r = await res.json();
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dias = (Date.parse(hoy) - Date.parse(r.fecha)) / 864e5;
if (dias > 2) {
  console.error(`::error::Los datos publicados son del ${r.fecha} (hoy es ${hoy}). Puede que la API de la BDNS haya cambiado o esté caída.`);
  process.exit(1);
}
if (r.abiertas < 300) {
  console.error(`::error::Solo hay ${r.abiertas} convocatorias abiertas publicadas: revisa la descarga de datos.`);
  process.exit(1);
}
console.log(`Estado OK: datos del ${r.fecha} a las ${r.hora} · ${r.abiertas} convocatorias abiertas · ${r.nuevas7} nuevas en 7 días`);
