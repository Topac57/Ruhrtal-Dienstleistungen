/**
 * Einmaliger, verifizierender Patch der aus Claude Design exportierten index.html.
 * Jede Ersetzung muss exakt einmal greifen – sonst bricht das Skript ab und
 * die Datei bleibt unveraendert. Rein technische Aenderungen, kein Redesign.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../index.html', import.meta.url);
let html = readFileSync(FILE, 'utf8');
const log = [];

function replaceOnce(label, find, repl) {
  const parts = html.split(find);
  if (parts.length !== 2) {
    throw new Error(`[${label}] erwartete 1 Treffer, gefunden: ${parts.length - 1}`);
  }
  html = parts[0] + repl + parts[1];
  log.push(`ok  ${label}`);
}

function replaceAll(label, find, repl, expected) {
  const n = html.split(find).length - 1;
  if (n !== expected) throw new Error(`[${label}] erwartete ${expected} Treffer, gefunden: ${n}`);
  html = html.split(find).join(repl);
  log.push(`ok  ${label} (${n}x)`);
}

/* ---------------------------------------------------------------- 1. Fonts
   Google-CDN raus, lokal gehostete Webfonts rein (DSGVO). */
replaceOnce('fonts: preconnect+stylesheet -> lokal',
`<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;display=swap" rel="stylesheet">`,
`<link rel="preload" as="font" type="font/woff2" href="/fonts/plus-jakarta-sans-latin.woff2" crossorigin="">
<link rel="preload" as="font" type="font/woff2" href="/fonts/ibm-plex-sans-latin.woff2" crossorigin="">
<link rel="stylesheet" href="/fonts/fonts.css">`);

/* ------------------------------------------------------- 2. React lokal
   support.js laedt React sonst von unpkg.com. Liegt React bereits auf
   window, ueberspringt die Runtime den CDN-Pfad vollstaendig. */
replaceOnce('react: lokal vor support.js',
`<script src="./support.js"></script>`,
`<script src="/vendor/react.production.min.js"></script>
<script src="/vendor/react-dom.production.min.js"></script>
<script src="/support.js"></script>`);

/* --------------------------------------- 3. image-slot (Editor-Werkzeug)
   Der leere Slot rendert in Produktion englische Editor-UI
   ("or browse files", "Replace / Edit"). Beide Slots entfernen,
   damit das Skript komplett entfallen kann. */
replaceOnce('image-slot: Karten-Container auf /kontakt/ entfernt',
`        <div style="border:1px solid #E4EAE3;border-radius:24px;overflow:hidden;background:#F5F8F4;aspect-ratio:16/11;position:relative">
          <image-slot id="anfahrt" shape="rect" fit="cover" placeholder="Kartenausschnitt oder Foto vom Standort"></image-slot>
        </div>
`, '');

replaceOnce('image-slot: ungenutzter noImg-Zweig entfernt',
`            <sc-if value="{{ s.noImg }}" hint-placeholder-val="{{ false }}">
              <image-slot id="{{ s.slot }}" shape="rect" fit="cover" placeholder="Foto ergänzen"></image-slot>
            </sc-if>
`, '');

replaceOnce('image-slot.js: Script-Tag entfernt',
`<script src="./image-slot.js"></script>\n`, '');

/* ------------------------------------------------- 4. Absolute Asset-Pfade
   Notwendig, sobald echte Pfade (/glasreinigung/) statt Hash-Routing
   verwendet werden: relative Pfade wuerden sonst ins Leere zeigen. */
{
  const before = (html.match(/(?<![\/\w.-])assets\//g) || []).length;
  html = html.replace(/(?<![\/\w.-])assets\//g, '/assets/');
  log.push(`ok  asset-pfade absolut (${before}x)`);
}

/* --------------------------------------------------- 5. Echte URLs statt Hash
   sitemap.xml und alle Canonicals verweisen auf echte Pfade. Mit
   Hash-Routing liefern diese URLs die Startseite bzw. 404. */
replaceOnce('router: hrefFor liefert echten Pfad',
`  hrefFor(page, svc){ return '#' + this.routeFor(page, svc).path; }`,
`  hrefFor(page, svc){ return this.routeFor(page, svc).path; }`);

replaceOnce('router: Route aus pathname (Hash bleibt als Fallback)',
`  routeFromHash(){
    const h = (location.hash || '').replace(/^#/, '');
    if (!h) return null;
    const p = h.charAt(h.length - 1) === '/' ? h : h + '/';
    const R = this.seoRoutes();
    const k = Object.keys(R).filter(x => R[x].path === p)[0];
    if (!k) return null;
    return k.indexOf('d-') === 0 ? { page:'detail', svc:k.slice(2) } : { page:k };
  }`,
`  routeFromHash(){
    // Primaer der echte Pfad; '#/pfad/' wird weiter unterstuetzt, damit
    // bereits geteilte Hash-Links nicht brechen.
    const hash = (location.hash || '').replace(/^#/, '');
    const raw = hash || location.pathname || '/';
    if (!raw) return null;
    const p = raw.charAt(raw.length - 1) === '/' ? raw : raw + '/';
    const R = this.seoRoutes();
    const k = Object.keys(R).filter(x => R[x].path === p)[0];
    if (!k) return null;
    return k.indexOf('d-') === 0 ? { page:'detail', svc:k.slice(2) } : { page:k };
  }`);

replaceOnce('router: pushState vergleicht pathname',
`      try { if (location.hash !== href) history.pushState(null, '', href); } catch(_) {}`,
`      try { if (location.pathname !== href) history.pushState(null, '', href); } catch(_) {}`);

/* Alte Hash-URL beim Start auf den echten Pfad normalisieren. */
replaceOnce('router: Hash-URL wird auf echten Pfad normalisiert',
`    const initial = this.routeFromHash();
    this.setState({ wide: window.innerWidth >= 980, page: initial ? initial.page : this.state.page, svc: (initial && initial.svc) || this.state.svc }, () => this.scheduleSeo());`,
`    const initial = this.routeFromHash();
    if (location.hash && initial) {
      try { history.replaceState(null, '', this.hrefFor(initial.page, initial.svc)); } catch(_) {}
    }
    this.setState({ wide: window.innerWidth >= 980, page: initial ? initial.page : this.state.page, svc: (initial && initial.svc) || this.state.svc }, () => this.scheduleSeo());`);

writeFileSync(FILE, html);
console.log(log.join('\n'));
console.log('\nindex.html gepatcht.');
