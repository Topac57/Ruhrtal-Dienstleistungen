# Einmalige Migrationsskripte

Diese beiden Skripte wurden **einmalig** auf den Export aus Claude Design
angewendet und sind bereits in `index.html` eingearbeitet. Sie liegen hier
zur Nachvollziehbarkeit, **nicht zur erneuten Ausführung** – ein zweiter Lauf
bricht bewusst ab, weil die gesuchten Textstellen nicht mehr vorhanden sind.

| Skript | Zweck |
|---|---|
| `patch-source.mjs` | Lokale Schriften statt Google-CDN, lokales React statt unpkg, Entfernung der Editor-Platzhalter, absolute Asset-Pfade, echte URLs statt Hash-Routing |
| `patch-formspree.mjs` | Anbindung des Kontaktformulars an Formspree samt Sende- und Fehlerzustand |

Am Design wurde nichts verändert: keine Farben, Texte, Schriftgrößen, Bilder
oder Abstände. Alle Eingriffe waren technisch notwendig, damit die Seite
außerhalb des Design-Editors baut, ausgeliefert wird und Anfragen zustellt.
