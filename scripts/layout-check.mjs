/**
 * Layoutpruefung im echten Browser: sucht ueberbreite Seiten und – wichtiger –
 * Elemente, die andere ueberdecken. Genau daran krankte das mitlaufende
 * Inhaltsverzeichnis: es war nie zu breit, legte sich aber beim Scrollen
 * ueber den Text. Eine reine Ueberlauf-Pruefung findet so etwas nicht.
 *
 * Braucht Playwright, das bewusst KEINE Projektabhaengigkeit ist:
 *
 *   npx --yes playwright@latest install chromium
 *   npm run build && node scripts/serve.mjs dist 4174 &
 *   node scripts/layout-check.mjs
 *
 * Optional: node scripts/layout-check.mjs https://example.vercel.app
 */
const BASIS = process.argv[2] || 'http://localhost:4174';
const BREITEN = [320, 375, 414, 768, 1280];
const ROUTEN = ['/', '/baustellenservice-containerreinigung/', '/leistungen/',
  '/glasreinigung/', '/bauabschlussreinigung/', '/gruenflaechenpflege/',
  '/entruempelung/', '/montage-aufbau/', '/ueber-uns/', '/kontakt/',
  '/impressum-datenschutz/'];

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.error('Playwright fehlt. Einmalig: npx --yes playwright@latest install chromium'); process.exit(2); }

const pruefeSeite = async (page) => page.evaluate(async () => {
  const probleme = [];
  const vw = innerWidth;
  if (document.documentElement.scrollWidth > vw + 1)
    probleme.push(`ueberbreite: +${document.documentElement.scrollWidth - vw}px`);
  const hoehe = document.body.scrollHeight;
  for (let y = 0; y < hoehe; y += Math.round(innerHeight * 0.75)) {
    window.scrollTo({ top: y, behavior: 'instant' });
    await new Promise(s => setTimeout(s, 90));
    for (const el of document.querySelectorAll('h1,h2,h3,p,li,label,button')) {
      const b = el.getBoundingClientRect();
      if (b.width < 40 || b.height < 12) continue;              // unsichtbar
      if (el.closest('details:not([open])') || !el.offsetParent) continue;
      if (b.top < 115 || b.bottom > innerHeight - 10) continue;  // nur voll im Bild
      const oben = document.elementFromPoint(Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2));
      if (!oben || oben === el || el.contains(oben) || oben.contains(el)) continue;
      if (oben.closest('header')) continue;                      // Kopfzeile darf das
      probleme.push(`verdeckt bei y=${y}: "${el.textContent.replace(/\s+/g, ' ').trim().slice(0, 30)}"`);
      break;
    }
  }
  return probleme;
});

const browser = await chromium.launch();
let fehler = 0;
for (const breite of BREITEN) {
  const page = await browser.newPage({ viewport: { width: breite, height: 850 } });
  for (const route of ROUTEN) {
    await page.goto(BASIS + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const probleme = await pruefeSeite(page);
    if (probleme.length) { fehler += probleme.length; console.log(`${breite}px ${route}\n  ` + probleme.join('\n  ')); }
  }
  await page.close();
  console.log(`${breite}px geprueft`);
}
await browser.close();
console.log(fehler ? `\n${fehler} Befund(e).` : '\nKeine Layoutprobleme gefunden.');
process.exit(fehler ? 1 : 0);
