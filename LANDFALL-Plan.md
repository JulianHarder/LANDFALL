# LANDFALL – Die Reise eines Anrufs über echte Internet-Kabel

Flache 2D-Weltkarte, auf der man sieht, wie ein Datenpaket (z. B. ein Anruf New York → Frankfurt) durch echte Unterseekabel und über Land läuft. Kein WebGL, kein Three.js, damit Chrome nicht überlastet wird.

---

## 1. Ziel und Funktionen

**Muss (MVP):**
- Weltkarte (flach, dunkles Tech-Design passend zum Projekt-Hub)
- Echte Unterseekabel als Linien
- Start- und Zielstadt wählen (z. B. New York → Frankfurt)
- Route wird berechnet, Paket (leuchtender Punkt) läuft Stück für Stück entlang
- Anzeige: Strecke in km, Laufzeit in ms, welche Kabel benutzt werden

**Soll:**
- Kabel anklicken und "kappen" -> Route berechnet sich neu (Umweg)
- Szenarien-Buttons: "Rotes Meer sperren", "Atlantik-Kabel kappen"
- Info-Karte pro Kabel (Name, Länge, Inbetriebnahme, Betreiber)
- Landstrecken gestrichelt, Seestrecken durchgezogen

**Kann (später):**
- Mehrere Pakete gleichzeitig
- Zoom und Verschieben der Karte
- Lernmodus mit Erklärtexten ("Warum geht ein Anruf nicht direkt?")
- Deutschland-Detail: Landstrecke Landepunkt -> Frankfurt (DE-CIX)

---

## 2. Warum kein Three.js / WebGL

Der Absturz kam von zu viel Grafiklast. Daher gelten diese Regeln:

- **Rendering mit Canvas 2D** (oder SVG für die statische Karte). Kein WebGL.
- **Zwei Canvas-Schichten übereinander:**
  1. Hintergrund: Länder + Kabel, wird **einmal** gezeichnet und nur bei Änderung neu.
  2. Vordergrund: nur das bewegte Paket und die hervorgehobene Route.
- **Framerate auf 30 FPS begrenzen**, Animation pausieren, wenn der Tab im Hintergrund ist (`document.hidden`).
- `devicePixelRatio` auf maximal 2 begrenzen.
- Nur die Route animieren, nicht alle Kabel. Keine Partikelwolken.
- Geometrie vereinfachen (Länder: 110m-Auflösung, nicht 10m).
- Kein Dauer-Neuzeichnen, wenn nichts passiert (nur bei Interaktion oder laufender Animation).

---

## 3. Technik-Stack

| Zweck | Wahl |
|---|---|
| Sprache | HTML, CSS, Vanilla JavaScript (keine Build-Tools nötig) |
| Karte/Projektion | **d3-geo** (Projektion, Pfade), Projektion: Equirectangular oder Natural Earth |
| Ländergrenzen | `world-atlas` (countries-110m.json) + `topojson-client` |
| Kabeldaten | TeleGeography Submarine Cable Map (GitHub, GeoJSON) |
| Routing | eigener Dijkstra (Verbindung zu TRACE) |
| Zeichnen | Canvas 2D |

**Wichtig – läuft per Doppelklick:** Browser blockieren `fetch()` auf lokale JSON-Dateien (`file://`). Deshalb alle Daten als `.js`-Dateien einbinden, z. B. `window.CABLES = {...};`. Bibliotheken (d3, topojson) lokal in den Ordner kopieren, nicht von einem CDN laden.

---

## 4. Daten

### 4.1 Unterseekabel (echt)
Quelle: GitHub-Repository **telegeography/www.submarinecablemap.com** (Ordner `web/public/api/v3/`):
- `cable/cable-geo.json` – Linien aller Kabel (MultiLineString)
- `landing-point/landing-point-geo.json` – alle Landepunkte (Punkte)
- `cable/<id>.json` – Details je Kabel (Name, Länge, Landepunkte, Betreiber, Jahr)

Vor der Nutzung die **Lizenz prüfen** (meines Wissens CC BY-SA) und eine Quellenangabe in die Fußzeile der Seite schreiben ("Daten: TeleGeography").

### 4.2 Landstrecken (vereinfacht, selbst gebaut)
Genaue Landtrassen sind nicht öffentlich. Lösung: Städte-Knoten (Frankfurt, New York, London, Marseille, Alexandria, Mumbai, Singapur, Hongkong, Shanghai, Lagos, Kapstadt, ...) und Verbindungen zum jeweils nächsten Landepunkt als **gestrichelte Linie**. In der Oberfläche klar kennzeichnen: "Landweg vereinfacht dargestellt".

### 4.3 MVP-Datensatz klein halten
Zuerst nur **10 bis 15 handverlesene Kabel** (z. B. Atlantik: MAREA, Dunant, Grace Hopper; Europa-Asien: SEA-ME-WE 5, AAE-1; Afrika: 2Africa, WACS, Equiano; Pazifik: Jupiter, FASTER). Erst wenn alles läuft, alle Kabel laden.

---

## 5. Graph und Routing

**Knoten:** Landepunkte + Städte.
**Kanten:**
- Kabelabschnitte: Verbindung zweier Landepunkte desselben Kabels. Achtung: In den Daten ist die Reihenfolge der Landepunkte nicht garantiert. Lösung: Kanten über die **Endpunkte der Linienstücke** (MultiLineString-Segmente) bilden, nicht über die Listenreihenfolge.
- Landstrecken: Stadt <-> nächster Landepunkt.

**Gewicht einer Kante:** Entfernung per **Haversine-Formel** (Großkreisstrecke) in km.
**Laufzeit:** Licht im Glasfaserkabel ist etwa 200.000 km/s, also **ca. 5 µs pro km**. Beispiel: 6.000 km ≈ 30 ms einfache Strecke. Diese Zahl in der Oberfläche anzeigen, das ist der Lerneffekt.

**Algorithmus:** Dijkstra mit Prioritätswarteschlange (einfacher Binary Heap). Ergebnis: Liste von Knoten + benutzte Kabel.
**Kabel kappen:** Kabel-ID in eine Menge "defekt" eintragen, alle zugehörigen Kanten beim Routing überspringen, neu berechnen. Wenn kein Weg existiert: Meldung "Keine Verbindung".

Hinweis: Echtes Internet-Routing (BGP) wählt nicht immer den kürzesten Weg, sondern folgt Verträgen und Preisen. Das als Hinweistext in der Seite erwähnen: "Typische Route, vereinfacht".

---

## 6. Karte zeichnen (Details)

- Projektion: `d3.geoEquirectangular()` (einfach, geradlinig) oder `d3.geoNaturalEarth1()` (schöner; braucht `d3-geo-projection`).
- **Datumsgrenze (180°):** Pazifik-Kabel kreuzen sie. Linien dort in zwei Teile zerlegen, sonst entstehen waagerechte Streifen quer über die Karte.
- Kabel als dünne Linien (1 px), Farbe gedämpft; Route heller, mit Glow-Effekt (`shadowBlur` sparsam einsetzen, ist teuer).
- Linien als `Path2D` einmal erzeugen und wiederverwenden.
- Paket: kleiner leuchtender Punkt mit kurzem Schweif (maximal 10 Positionen speichern).
- Paketposition: Fortschritt entlang der Gesamtstrecke (0 bis 1), über die Teilstrecken nach Länge interpoliert. Die Geschwindigkeit nicht realistisch, sondern fest (z. B. 6 Sekunden für die ganze Route), dazu die echte ms-Zahl als Text.

---

## 7. Oberfläche

- Oben: Auswahl **Von** und **Nach** (Dropdown mit ca. 15 Städten), Button "Verbinden".
- Rechts oder unten (mobil): Infoleiste mit Etappen: "New York -> Landepunkt Virginia Beach -> Kabel MAREA -> Bilbao -> Landweg -> Frankfurt", Gesamt-km, Gesamt-ms.
- Klick auf ein Kabel: Info-Karte + Button "Kappen".
- Szenarien-Buttons: "Rotes Meer sperren", "Atlantik reparieren".
- Dunkles Design, Akzentfarbe (z. B. Cyan) für die Route, passend zum Projekt-Hub.

---

## 8. Dateistruktur

```
landfall/
  index.html
  style.css
  js/
    main.js        – Start, Events
    map.js         – Projektion, Zeichnen (Hintergrund)
    graph.js       – Graph aufbauen, Haversine
    dijkstra.js    – Routing
    animation.js   – Paket, Schleife, FPS-Begrenzung
    ui.js          – Dropdowns, Infoleiste, Kabel anklicken
  data/
    cables.js      – window.CABLES = ...
    landings.js    – window.LANDINGS = ...
    countries.js   – window.COUNTRIES = ...
    cities.js      – eigene Städte + Landverbindungen
  lib/
    d3-geo.min.js
    topojson-client.min.js
```

---

## 9. Bauphasen (in Claude Code Etappe für Etappe)

1. **Etappe 1 – Karte:** Leere Weltkarte mit Ländern, zwei Canvas-Schichten, Zoom-fest. Test: Tab-Wechsel, Ressourcenverbrauch im Task-Manager prüfen.
2. **Etappe 2 – Kabel:** 10 bis 15 Kabel + Landepunkte zeichnen, Datumsgrenze behandeln.
3. **Etappe 3 – Graph:** Städte, Landstrecken, Graph bauen, Haversine; Test in der Konsole: Entfernung New York - Frankfurt.
4. **Etappe 4 – Routing:** Dijkstra, Route hervorheben, Etappen-Liste anzeigen.
5. **Etappe 5 – Animation:** Paket läuft entlang der Route, 30-FPS-Limit, Pause bei verstecktem Tab.
6. **Etappe 6 – Kabel kappen:** Klick auf Kabel, Neuberechnung, Szenarien-Buttons.
7. **Etappe 7 – Feinschliff:** Info-Karten, Quellenangabe, mobile Ansicht, alle Kabel laden (Leistung beobachten).

Nach jeder Etappe testen, bevor die nächste beginnt.

---

## 10. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Zu viele Kabel -> langsam | Hintergrund nur einmal zeichnen, Geometrie vereinfachen |
| Datumsgrenze zerreißt Linien | Linien beim Übergang teilen |
| Reihenfolge der Landepunkte falsch | Kanten über Linien-Endpunkte bilden |
| Landstrecken ungenau | Offen als "vereinfacht" kennzeichnen |
| Lizenz | CC BY-SA prüfen, Quelle nennen |
| `file://` blockiert Daten | Daten als `.js` einbinden |

---

## 11. Startprompt für Claude Code

> Baue das Projekt LANDFALL nach dem Plan in LANDFALL-Plan.md. Beginne nur mit Etappe 1 (Weltkarte mit Canvas 2D und d3-geo, kein WebGL, kein Three.js, zwei Schichten, läuft per Doppelklick auf index.html, alle Bibliotheken lokal). Warte nach der Etappe auf mein Feedback.
