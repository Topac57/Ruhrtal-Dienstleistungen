/**
 * Build der statischen Website.
 *
 * Die Seite ist eine im Browser gerenderte Single-Page-Anwendung (Claude-Design-
 * Runtime). Damit Suchmaschinen und geteilte Links trotzdem echte URLs sehen,
 * erzeugt dieser Build fuer jede Route eine eigene HTML-Datei, in der die
 * SEO-Angaben (Titel, Description, Canonical, OpenGraph) bereits im <head>
 * stehen – auch ohne ausgefuehrtes JavaScript. Der Client-Router uebernimmt
 * danach unveraendert.
 *
 * Ausserdem wird der Formspree-Endpoint aus der Umgebung eingesetzt, damit
 * keine Konfiguration im Repository liegt.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const SRC = join(ROOT, 'index.html');
const BASE = 'https://www.ruhrtal-dienstleistungen.de';

const src = readFileSync(SRC, 'utf8');
const warn = [];

/* --- Routen aus der einzigen Wahrheit lesen: seoRoutes() in der index.html --- */
function readRoutes(html) {
  const m = html.match(/seoRoutes\(\)\{\s*return\s*(\{[\s\S]*?\n\s*\};)/);
  if (!m) throw new Error('seoRoutes() nicht gefunden – Quelldatei unerwartet veraendert.');
  const obj = m[1].replace(/;$/, '');
  return new Function(`return (${obj})`)();
}
const routes = readRoutes(src);
const routeKeys = Object.keys(routes);

/* ------------------------------- Formspree -------------------------------
   Die Form-ID ist kein Geheimnis: Sie steht zwangslaeufig im ausgelieferten
   HTML und ist fuer jeden Besucher im Quelltext lesbar. Der Missbrauchsschutz
   laeuft bei Formspree ueber Domainbindung und Spamfilter im Dashboard, nicht
   ueber Geheimhaltung. Deshalb steht hier ein Standardwert, damit das Formular
   ohne zusaetzliche Konfiguration sendet.
   FORMSPREE_FORM_ID uebersteuert ihn, falls das Formular gewechselt wird –
   dann genuegt ein Eintrag in den Vercel-Projekteinstellungen ohne Codeaenderung. */
const FORMSPREE_STANDARD = 'xljrvoeb';
const formId = (process.env.FORMSPREE_FORM_ID || FORMSPREE_STANDARD).trim();
const formQuelle = process.env.FORMSPREE_FORM_ID ? 'FORMSPREE_FORM_ID' : 'Standardwert im Build';
if (!formId) {
  warn.push(
    'Kein Formspree-Endpoint gesetzt. Das Kontaktformular sendet nicht und zeigt ' +
    'stattdessen Telefonnummer und E-Mail-Adresse an.'
  );
}

/* --------------------------- Head je Route bauen -------------------------- */
function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function headFor(route) {
  const url = BASE + route.path;
  const img = BASE + '/assets/hero-container.webp';
  const robots = route.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1';
  const ogType = route.path === '/' ? 'website' : 'article';
  return [
    `<title>${escapeAttr(route.title)}</title>`,
    `<meta name="description" content="${escapeAttr(route.desc)}">`,
    `<meta name="robots" content="${robots}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="${ogType}">`,
    `<meta property="og:site_name" content="Ruhrtal Dienstleistungen">`,
    `<meta property="og:locale" content="de_DE">`,
    `<meta property="og:title" content="${escapeAttr(route.title)}">`,
    `<meta property="og:description" content="${escapeAttr(route.desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:alt" content="Mitarbeiter von Ruhrtal Dienstleistungen bei der Containerreinigung">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(route.title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(route.desc)}">`,
    `<meta name="twitter:image" content="${img}">`,
    `<meta name="theme-color" content="#0F1A15">`,
    `<meta name="author" content="Ruhrtal Dienstleistungen">`,
    `<meta name="geo.region" content="DE-NW">`,
    `<meta name="geo.placename" content="Mülheim an der Ruhr">`,
    `<link rel="icon" href="/favicon.ico" sizes="32x32">`,
    `<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
    `<link rel="manifest" href="/site.webmanifest">`,
  ].join('\n');
}

/* Entfernt die SEO-Duplikate aus dem <helmet>-Block. Alles andere dort
   (Design-Styles, Schriften, Preloads, strukturierte Daten) bleibt unberuehrt. */
function stripHelmetSeo(html) {
  const start = html.indexOf('<helmet>');
  const end = html.indexOf('</helmet>');
  if (start === -1 || end === -1) throw new Error('<helmet>-Block nicht gefunden.');
  let block = html.slice(start, end);
  const weg = [
    /<title>[\s\S]*?<\/title>\n?/g,
    /<meta name="description"[^>]*>\n?/g,
    /<meta name="robots"[^>]*>\n?/g,
    /<link rel="canonical"[^>]*>\n?/g,
    /<meta property="og:[^"]*"[^>]*>\n?/g,
    /<meta name="twitter:[^"]*"[^>]*>\n?/g
  ];
  for (const re of weg) block = block.replace(re, '');
  return html.slice(0, start) + block + html.slice(end);
}

function pageFor(route) {
  let html = src;
  // Sprache setzen (sonst erst per JavaScript nach dem Rendern).
  html = html.replace('<html>', '<html lang="de">');
  // SEO-Block in den echten <head>; im <helmet> stehende Angaben werden von der
  // Runtime spaeter ohnehin ueberschrieben, hier zaehlt der Zustand ohne JS.
  html = html.replace('<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' + headFor(route));
  // Die SEO-Angaben stehen in der Quelle zusaetzlich im <helmet>-Block im Body
  // und tragen dort die Werte der Startseite. Zwei widerspruechliche <title>-
  // und <canonical>-Angaben im Dokument sind fuer Suchmaschinen schaedlich,
  // deshalb bleibt nur der oben erzeugte <head> stehen. Die Runtime setzt die
  // Angaben beim Seitenwechsel ohnehin selbst.
  html = stripHelmetSeo(html);
  // Formspree-Endpoint einsetzen.
  html = html.replace('"__FORMSPREE_ENDPOINT__"', JSON.stringify(formId));
  return html;
}

/* ------------------------------- Ausgabe -------------------------------- */
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

for (const key of routeKeys) {
  const route = routes[key];
  const outDir = route.path === '/' ? DIST : join(DIST, route.path.replace(/^\/|\/$/g, ''));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), pageFor(route));
}

for (const entry of ['assets', 'fonts', 'vendor', 'support.js', 'robots.txt', 'sitemap.xml',
                     'favicon.ico', 'icon-192.png', 'icon-512.png',
                     'apple-touch-icon.png', 'site.webmanifest', '404.html']) {
  const from = join(ROOT, entry);
  if (existsSync(from)) cpSync(from, join(DIST, entry), { recursive: true });
  else warn.push(`Datei fehlt und wurde nicht kopiert: ${entry}`);
}

/* --------------------- sitemap.xml gegen Routen pruefen ------------------- */
const sitemapPath = join(DIST, 'sitemap.xml');
if (existsSync(sitemapPath)) {
  const urls = [...readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const known = routeKeys.map(k => BASE + routes[k].path);
  for (const u of urls) if (!known.includes(u)) warn.push(`sitemap.xml enthaelt unbekannte URL: ${u}`);
  const indexable = routeKeys.filter(k => !routes[k].noindex).map(k => BASE + routes[k].path);
  for (const u of indexable) if (!urls.includes(u)) warn.push(`sitemap.xml fehlt die indexierbare URL: ${u}`);
}

console.log(`Build fertig: ${routeKeys.length} Seiten nach dist/`);
console.log(routeKeys.map(k => '  ' + routes[k].path).join('\n'));
console.log(formId ? `\nFormspree: Endpoint ${formId} eingesetzt (Quelle: ${formQuelle}).`
                   : '\nFormspree: kein Endpoint gesetzt.');
if (warn.length) console.log('\nHinweise:\n' + warn.map(w => '  - ' + w).join('\n'));
