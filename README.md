# Flagged – Webspiel

Webumsetzung des Flagged-Regelbuchs: taktisches Kartenspiel auf dem 8×8-Schachbrett, 1 gegen 1 gegen eine KI.

## Starten

`index.html` direkt im Browser öffnen – oder lokal servieren:

```bash
python -m http.server 8765
```

Dann <http://localhost:8765> öffnen. Die Musik startet beim ersten Klick (Autoplay-Regel der Browser).

## Inhalt

- **Schlacht:** Held wählen (Assassine, Ritter, Waldläufer/Jäger, Zauberer/Magier), Gegner wählen, Stufe *Leicht · Medium · Stark · Endboss*.
- **Regeln** nach Regelbuch: Zugablauf (ziehen → bis 2 Felder, 1 Karte, bis 2 Wände), Startspieler ohne Karte, Wände nur in der eigenen Hälfte in Runde 1, Wegregel, Diagonale erst mit 2 Wänden blockiert, Chebyshev-Umkreis, Schnappen mit Aussetzen & Wiedergeburt, Flagge & 2 Punkte, 6× geschnappt, Handlimit 5, Mulligan, Konterketten, verdeckte Fallen, Schattenklon mit geheimer Identität, Portale.
- **Alle 106 Karten** für 1v1 mit Effekten (Teamkarten nur im Kompendium), vier Starterdecks à 40 Karten.
- **Tägliche Rätsel** mit Kalender, Serie und Lösungs-/Tippfunktion (16 Rätsel, jeweils auch gespiegelt).
- **Soundtrack** live per WebAudio synthetisiert (Titel, Schlacht, Endboss) plus Soundeffekte.

## Struktur

| Datei | Inhalt |
|---|---|
| `js/cards.js` | Kartendatenbank, Effekte, Starterdecks |
| `js/engine.js` | Spielregeln, Zugablauf, Konter-System |
| `js/ai.js` | KI (Bewertung, Kartennutzung, Konter, Stufen) |
| `js/ui.js` | Brett, Hand, Dialoge, Effekte, Soundeffekte |
| `js/puzzles.js` | Rätsel & Kalender |
| `js/music.js` | Synthetisierter Soundtrack |
| `js/smoke.js`, `js/boardart.js` | Rauch-/Glutpartikel, prozedurales Spielbrett |
| `assets/` | Cover & Ornamente aus dem Regelbuch |

## Tests (Node ≥ 18)

```bash
node tests/puzzletest.js .
```

```bash
node tests/sim.js . 16 mixed
```

```bash
node tests/duel.js . medium hard 40
```

`puzzletest.js` spielt jede Rätsellösung (normal & gespiegelt) durch, `sim.js` lässt KI gegen KI spielen und prüft Regelverletzungen, `duel.js` vergleicht Schwierigkeitsstufen.

## Auslegungen

Wo Regeltext oder Symbole mehrdeutig sind: Sichtlinie gerade oder diagonal; *Antikonter* = Gegner darf im laufenden Zug nicht mehr kontern; *Wolfmodus* = +1 Wand verschieben pro Zug und Schnappen im Umkreis 1 auch durch Wände; Astralregen in eine gerade Richtung; Blockstellung = 2 Felder angrenzend zur eigenen Figur; Schleierflucht kostet 1 Handkarte.
