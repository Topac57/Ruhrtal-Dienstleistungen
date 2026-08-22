/**
 * Qualitaetspruefung des Build-Ergebnisses in dist/.
 * Bricht mit Exit-Code 1 ab, wenn ein Fehler gefunden wird.
 * Deckt ab: fehlende Assets, kaputte interne Links, Reste externer Abhaengigkeiten,
 * Konsistenz von sitemap.xml und robots.txt, Pflichtangaben im <head>.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const BASE = 'https://www.ruhrtal-dienstleistungen.de';
const errors = [];
const notes = [];

if (!existsSync(DIST)) {
  console.error('dist/ fehlt – bitte zuerst "npm run build" ausfuehren.');
  process.exit(1);
}

/* Alle erzeugten HTML-Seiten einsammeln. */
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
}
const pages = walk(DIST);
if (pages.length < 11) errors.push(`Nur ${pages.length} HTML-Seiten in dist/ – erwartet mindestens 11.`);

/* Statisch referenzierte lokale Dateien pruefen. */
const localRef = /(?:src|href)="(\/[^"#?]+\.(?:webp|png|jpg|jpeg|svg|ico|css|js|woff2|webmanifest|xml|txt))"/g;
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const rel = page.replace(DIST, '') || '/index.html';

  for (const m of html.matchAll(localRef)) {
    const target = join(DIST, m[1]);
    if (!existsSync(target)) errors.push(`${rel}: verweist auf fehlende Datei ${m[1]}`);
  }

  /* Externe Abhaengigkeiten, die bewusst entfernt wurden. */
  if (html.includes('unpkg.com/react')) errors.push(`${rel}: laedt React noch von unpkg.com`);
  if (html.includes('fonts.googleapis.com') || html.includes('fonts.gstatic.com'))
    errors.push(`${rel}: bindet Google Fonts noch extern ein (DSGVO)`);
  if (html.includes('<image-slot')) errors.push(`${rel}: enthaelt noch einen Editor-Platzhalter <image-slot>`);
  if (html.includes('image-slot.js')) errors.push(`${rel}: laedt das Editor-Skript image-slot.js`);

  /* Pflichtangaben im <head>. Die 404-Seite ist bewusst noindex und braucht
     weder Canonical noch OpenGraph. */
  const head = html.slice(0, html.indexOf('</head>'));
  const seoPflicht = rel !== '/404.html';
  const pruefungen = [
    ['<title>', /<title>[^<]{10,}<\/title>/],
    ['lang-Attribut', /<html lang="de">/]
  ];
  if (seoPflicht) pruefungen.push(
    ['meta description', /<meta name="description" content="[^"]{40,}"/],
    ['canonical', /<link rel="canonical" href="https:\/\/[^"]+"/],
    ['og:title', /<meta property="og:title"/]
  );
  else if (!/<meta name="robots" content="noindex/.test(head))
    errors.push(`${rel}: 404-Seite muss auf noindex stehen`);
  for (const [label, re] of pruefungen)
    if (!re.test(head)) errors.push(`${rel}: ${label} fehlt im <head>`);

  /* Doppelte SEO-Angaben im Dokument verwirren Suchmaschinen. */
  for (const [label, re] of [
    ['<title>', /<title>/g],
    ['canonical', /<link rel="canonical"/g],
    ['meta description', /<meta name="description"/g]
  ]) {
    const n = (html.match(re) || []).length;
    if (n > 1) errors.push(`${rel}: ${label} kommt ${n}x vor – erwartet genau einmal`);
  }

  /* Formspree: unersetzter Platzhalter faellt auf, wenn ENV gesetzt war. */
  if (process.env.FORMSPREE_FORM_ID && html.includes('__FORMSPREE_ENDPOINT__'))
    errors.push(`${rel}: Formspree-Platzhalter wurde nicht ersetzt`);
}

/* Interne Navigationsziele muessen existieren. */
const start = readFileSync(join(DIST, 'index.html'), 'utf8');
const routePaths = [...start.matchAll(/path:'(\/[a-z0-9-]*\/?)'/g)].map(m => m[1]);
for (const p of new Set(routePaths)) {
  const f = p === '/' ? join(DIST, 'index.html') : join(DIST, p, 'index.html');
  if (!existsSync(f)) errors.push(`Route ${p} hat keine erzeugte Seite`);
}

/* sitemap.xml und robots.txt. */
const smPath = join(DIST, 'sitemap.xml');
if (!existsSync(smPath)) errors.push('sitemap.xml fehlt');
else {
  const urls = [...readFileSync(smPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  for (const u of urls) {
    const p = u.replace(BASE, '');
    const f = p === '/' ? join(DIST, 'index.html') : join(DIST, p, 'index.html');
    if (!existsSync(f)) errors.push(`sitemap.xml listet ${u}, die Seite fehlt aber im Build`);
    const html = existsSync(f) ? readFileSync(f, 'utf8') : '';
    if (html.includes('content="noindex')) errors.push(`sitemap.xml listet ${u}, die Seite ist aber auf noindex gesetzt`);
  }
  notes.push(`sitemap.xml: ${urls.length} URLs, alle vorhanden`);
}
const robotsPath = join(DIST, 'robots.txt');
if (!existsSync(robotsPath)) errors.push('robots.txt fehlt');
else {
  const r = readFileSync(robotsPath, 'utf8');
  if (!r.includes('Sitemap:')) errors.push('robots.txt enthaelt keinen Sitemap-Verweis');
  const dis = [...r.matchAll(/Disallow:\s*(\S+)/g)].map(m => m[1]);
  for (const d of dis) {
    const u = BASE + d;
    if (existsSync(smPath) && readFileSync(smPath, 'utf8').includes(u))
      errors.push(`robots.txt sperrt ${d}, die URL steht aber in der sitemap.xml`);
  }
}

/* Pflichtdateien. */
for (const f of ['favicon.ico', 'apple-touch-icon.png', 'site.webmanifest', '404.html',
                 'support.js', 'vendor/react.production.min.js', 'fonts/fonts.css'])
  if (!existsSync(join(DIST, f))) errors.push(`Pflichtdatei fehlt im Build: ${f}`);

/* Ergebnis. */
if (notes.length) console.log(notes.map(n => 'info  ' + n).join('\n'));
if (errors.length) {
  console.error('\nFEHLER:\n' + errors.map(e => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log(`\nAlle Pruefungen bestanden (${pages.length} Seiten geprueft).`);
