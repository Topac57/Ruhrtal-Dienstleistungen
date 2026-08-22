# Ruhrtal Dienstleistungen – Website

Website der **Ruhrtal Dienstleistungen**, Am Schloss Broich 31, 45479 Mülheim an
der Ruhr. Baustellenservice, Containerreinigung, Glasreinigung, Bauabschluss-
reinigung, Grünflächenpflege, Entrümpelung sowie Montage- und Aufbauarbeiten in
Nordrhein-Westfalen.

> **RD Baustellenservice** ist ein hervorgehobener Geschäftsbereich von Ruhrtal
> Dienstleistungen – kein eigenes Unternehmen. Anfragen, Angebote, Verträge und
> Rechnungen laufen ausschließlich über Ruhrtal Dienstleistungen.

## Technik

Statische Website ohne Framework. Die Seite stammt aus Claude Design und wird
von der mitgelieferten Runtime (`support.js`) im Browser gerendert. React liegt
lokal unter `vendor/`, die Schriften unter `fonts/` – es werden **keine externen
Server** kontaktiert.

Der Build erzeugt für jede der elf Routen eine eigene HTML-Datei, in der Titel,
Description, Canonical und OpenGraph bereits im `<head>` stehen. Dadurch sehen
Suchmaschinen und geteilte Links die richtigen Angaben, auch ohne ausgeführtes
JavaScript.

```
index.html          Quelldokument (alle Seiten, Client-Router)
assets/             Bilder und Logos
fonts/              lokal gehostete Webfonts (DSGVO)
vendor/             React 18.3.1 (UMD)
support.js          Runtime aus dem Design-Export
scripts/build.mjs   Build: erzeugt dist/
scripts/check.mjs   Qualitätsprüfung des Build-Ergebnisses
scripts/serve.mjs   lokaler Server, bildet das Vercel-Verhalten nach
```

## Entwicklung

```bash
npm run build     # erzeugt dist/
npm run check     # prüft dist/ auf fehlende Assets, SEO und tote Verweise
npm run preview   # baut und startet http://localhost:4174
```

Es gibt keine Abhängigkeiten – `npm install` legt nichts an.

## Umgebungsvariablen

| Name | Beschreibung |
|---|---|
| `FORMSPREE_FORM_ID` | Formspree-Formular für das Kontaktformular auf `/kontakt/`. Reine Form-ID (`xdkogqvp`) oder vollständige URL (`https://formspree.io/f/xdkogqvp`). **Ohne diesen Wert sendet das Formular nicht**, sondern zeigt Telefonnummer und E-Mail-Adresse an. |

Einzutragen unter *Vercel → Project → Settings → Environment Variables* für
Production, Preview und Development. Siehe `.env.example`.

## Deployment

Vercel baut mit `npm run build` und liefert `dist/` aus (siehe `vercel.json`).
Jeder Push auf `main` erzeugt ein Production-Deployment.

## Rohmaterial

Originalfotos, Logo-Quelldateien (`.ai`, `.pdf`), die Editor-Uploads des
Design-Exports und ungenutzte Bildvarianten liegen lokal unter `_quellen/` und
sind bewusst **nicht** versioniert – sie werden für den Betrieb der Website
nicht benötigt.

## Offene inhaltliche Punkte

Die Seite `/impressum-datenschutz/` ist unvollständig. Es fehlen die
vertretungsberechtigte Person, die Umsatzsteuer-Identifikationsnummer und der
vollständige Text der Datenschutzerklärung. Diese Angaben sind in Deutschland
verpflichtend (§ 5 DDG, Art. 13 DSGVO) und sollten vor dem Umschalten der
Domain rechtlich geprüft ergänzt werden.
