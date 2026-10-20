# LANDFALL – Fortschritt

Stand: 19.10.2026 · Plan: [LANDFALL-Plan.md](LANDFALL-Plan.md)

Flache 2D-Weltkarte, auf der ein Datenpaket (z. B. Anruf New York → Frankfurt) über echte
Unterseekabel läuft. Canvas 2D, kein WebGL, keine Build-Tools. Start: `index.html` im Browser öffnen.

## Etappen laut Plan

| Etappe | Inhalt | Stand |
|---|---|---|
| 1 | Weltkarte, zwei Canvas-Schichten, 30-FPS-Limit, Pause im Hintergrund-Tab | fertig |
| 2 | Kabel und Landepunkte zeichnen, Datumsgrenze (d3-geo schneidet automatisch) | fertig |
| 3 | Graph aus Kabeln, Landwegen und Städten, Haversine | fertig |
| 4 | Dijkstra (Binary Heap), Route hervorheben, Etappenliste mit km und ms | fertig |
| 5 | Paket läuft in 6 s die Route entlang, Schweif, mitlaufende ms-Anzeige | fertig |
| 6 | Kabel kappen und Szenarien (Rotes Meer, Atlantik) | fertig, **später wieder entfernt** (Wunsch) |
| 7 | Feinschliff: Infokarte, Quellenangabe, mobile Ansicht, alle Kabel | fertig |

## Was die Seite heute kann

- **101 Städte** (Von/Nach, alphabetisch nach deutscher Sortierung), **467 Kabel**, **1.438 Landepunkte**.
- **Verbinden / Nochmal / Trennen:** Route berechnen und animieren, noch einmal abspielen, Verbindung ganz ausblenden.
- **Karte zoomen und verschieben:** Mausrad (Zoom auf Mauszeiger), Ziehen, Pinch per Touch, Buttons + / − / ⌂, Zoom bis 40-fach. Die Ansicht bleibt bei Größenänderung erhalten.
- **Städte auf der Karte anklicken:** erster Klick = Start, zweiter Klick = Ziel, dann verbindet sich die Route. Klick auf die Startstadt oder Wechsel im Dropdown bricht ab.
- **Kabel anklicken:** Infokarte (Länge, Betrieb seit, Betreiber, Landepunkte), Kabel leuchtet gelb. Die Kabelnamen in der Etappenliste sind ebenfalls anklickbar.
- **Anzeige:** Strecke in km, Laufzeit in ms (5 µs pro km, einfache Strecke), Etappen mit Kabelnamen, Landwege gestrichelt und als „vereinfacht“ gekennzeichnet.
- **Städtenamen:** bei breiter Karte (ab 1000 px) ab Zoom 1,6, sonst ab Zoom 2,5; davor nur Start und Ziel.
- **Ruhigere Karte (20.10.2026):** Kabel dezenter (Alpha 0,24), mit aktiver Route noch leiser (0,10); Landepunkte erst ab Zoom 2. Alle Werte sind Konstanten oben in `js/map.js` (`CABLE_ALPHA`, `CABLE_ALPHA_ROUTE`, `LANDING_MIN_ZOOM`, `LABEL_MIN_ZOOM_WIDE`).
- **Schmale Bildschirme (20.10.2026):** Vorher schrumpfte die ganze Weltkarte auf einen kleinen Streifen mit viel leerer Fläche. Jetzt: Ist die Kartenfläche schmaler als 1,2:1 (Hochformat, `PORTRAIT_ASPECT` in `js/map.js`), füllt die Karte die Fläche aus (Grundzoom `defaultK`, Mitte = Länge 0) und lässt sich verschieben; sonst bleibt die ganze Welt sichtbar wie bisher. Beschriftungen, Landepunkte und kurze Kabel richten sich nach der relativen Zoomstufe (`zoomRel = k / defaultK`), damit die Grundansicht auf dem Handy so ruhig ist wie am Desktop. Nach „Verbinden“ holt `fitRoute()` die Route ins Bild, wenn sie nicht ganz sichtbar ist (Rand 48 px, höchstens Zoom 6). ⌂ stellt die Grundansicht wieder her. Karte kleiner als die Fläche wird zentriert. Getestet in schmalen Fenstern und breit; echtes Handy/Touch weiter ungetestet.
- **Gesamttest aller Städtepaare (20.10.2026):** `node tools/test-routes.js` (ca. 85 s) rechnet alle 5.050 Paare in beiden Richtungen und prüft: Route vorhanden, Start/Ziel, keine Knoten doppelt, Strecke ≥ Luftlinie, ms = km·5 µs, Hin = Rück, Etappen ergeben die Gesamtstrecke und bilden eine Kette, Linie ohne Lücken (≤ 20 km) und mit passender Länge, Datenprüfung (doppelte IDs, Städte ohne Verbindung, ein zusammenhängendes Netz). Ergebnis: **0 harte Fehler**. Nebenbei gefunden und behoben: (1) Etappe „Landweg · 0 km“ zwischen zwei Landepunkten an derselben Stelle (Changi North/South) wird nicht mehr angezeigt (`buildSteps`); (2) Tokio/Seoul/Chennai erreichten die Landepunkte der Kabel KJCN bzw. Bharat Lanka nicht (Radius zu klein): Radien 900/350/550 km in `data/cities.js`, Tokio–Seoul 2.989 → 1.378 km, Chennai–Colombo 2.507 → 863 km.
  Verbleibende Umwege > 2,5× Luftlinie (7 Paare, bewusst so gelassen, weil es dort real kaum Kabel gibt): Havanna–Miami (kein Kabel), Seoul–Wladiwostok (Korea–Russland-Kabel fehlt in den Daten), Mauritius (Port Louis) zu Malé/Mogadischu/Daressalam/Colombo, Lagos–Dschidda (Westafrika→Arabien läuft über Europa). Umweg-Grenze: `UMWEG=1.8 node tools/test-routes.js`.
- **Kuba (20.10.2026):** Havanna war nur mit Cienfuegos (Arimao-Kabel) verbunden, das ALBA-1-Kabel liegt aber bei Santiago de Cuba/Siboney im Osten. Dadurch lief Havanna→Mexiko-Stadt über Martinique und Puerto Rico (7.595 km). `radius` für Havanna in `data/cities.js` von 400 auf 800 km: Route jetzt über ALBA-1 → Jamaika → Cayman → Honduras → Tulum (4.199 km, 21 ms). Guantánamo Bay (US-Basis, 825 km) bleibt bewusst außerhalb. Havanna–Miami bleibt lang (2.100 km): zwischen Kuba und den USA gibt es kein Kabel für den Normalverkehr.
- **Paket auf dem Bogen (20.10.2026):** d3 zeichnet lange Landwege als Großkreis (gebogen), das Paket lief vorher linear in Länge/Breite (gerade) darunter. `positionAt` in `js/animation.js` interpoliert jetzt mit `d3.geoInterpolate` auf dem Großkreis, auch über die Datumsgrenze.
- **Namen für Meere und Länder (20.10.2026):** `js/labels.js` + `data/names.js`. Ozeane (Pazifik, Atlantik, Indischer/Arktischer/Südlicher Ozean) schon in der Übersicht, Meere und Golfe (36 Stück, Lage von Hand gesetzt) je nach Zoom (1,6 bis 3,5). Ländernamen (deutsch) ab Zoom 1,5, aber nur, wenn das ganze Textfeld im größten Landesteil liegt und keine Stadt (Punkt/Name) verdeckt – geprüft in Bildschirmpixeln mit Punkt-im-Polygon. Namen, die über den Kartenrand ragen würden, entfallen. Neuzeichnen dauert 4–6 ms. Konstanten oben in `labels.js` (`COUNTRY_MIN_ZOOM` usw.). Neue Meere: Zeile in `SEA_LABELS` ergänzen.
- **Landnetz (20.10.2026):** Vorher gab es über Land nur Kurzstrecken und New York–Los Angeles, dadurch liefen z. B. Seattle→Halifax über den Atlantik (16.069 km, 80 ms). Jetzt verbindet `tools/land-links.js` Nachbarstädte, deren Luftlinie bis 2.000 km (fast) ganz über Land verläuft (110m-Ländergrenzen, Gabriel-ähnliches Ausdünnen), und schreibt `data/landlinks.js` (72 Strecken). Dazu kommen 16 handgesetzte Strecken in `CITY_LINKS` (`data/cities.js`: Ostküste USA, Nordafrika, Ostsee, Perth–Melbourne …). Seattle→Halifax jetzt 6.547 km / 32,7 ms; Paare mit Umweg > 2,5× Luftlinie (unter 6.000 km): 128 → 17, übrig sind v. a. Inseln (Kuba) und Zentralafrika. Die Etappenliste nennt Zwischenstädte („über …“). Neu erzeugen: `node tools/land-links.js` (`MAX_KM`, `MAX_SEA` einstellbar).
- **Hellere Palette (20.10.2026):** Wegen Spiegelungen/hellem Raum Hintergrund, Panel, Ozean (`#17284d`) und Land (`#2f4676`) aufgehellt, Text, Kabel (Alpha 0,45), Landepunkte und Städtenamen kräftiger. Farben stehen als CSS-Variablen oben in `style.css` und in `drawBackground`/`drawCities` in `js/map.js`.
- **Nur Fernkabel zuerst (20.10.2026, Versuch):** Im Ruhezustand nur Kabel ab `LONG_CABLE_KM` = 4000 km (105 von 467); kürzere erscheinen ab Zoom `SHORT_CABLE_ZOOM` = 1,8 und sind vorher nicht anklickbar. Fehlt die Länge in den Daten, wird sie aus der Geometrie berechnet. Routen zeichnen ihre Kabel immer vollständig. Der Unterschied ist optisch klein, weil die dichten Bündel meist aus langen Kabeln bestehen; zum Abschalten `LONG_CABLE_KM = 0` setzen, für strengere Auswahl einen höheren Wert.

## Dateien

```
LANDFALL/
  index.html, style.css
  FORTSCHRITT.md, LANDFALL-Plan.md
  js/
    graph.js      Graph, Haversine, Landverbindungen (Hubs, Städte)
    dijkstra.js   Routing (Binary Heap), Etappenliste
    labels.js     Namen von Meeren und Ländern
    map.js        Projektion, Zoom/Verschieben, Zeichnen, Route-Schicht, Treffer (Kabel/Städte)
    animation.js  Zeichenschleife (30 FPS, Pause bei Tab-Wechsel), Paket
    ui.js         Dropdowns, Infoleiste, Kabel-Infokarte
    main.js       Start, Events (Zeiger, Rad, Klicks), Verbindung
  data/
    cables.js, landings.js   TeleGeography-Daten (aufgeräumt)
    cities.js                101 Städte, Landregeln (Umkreis, Länder), feste Landverbindung NY–LA
    countries.js             Länder (world-atlas 110m)
    _voll/                   ungekürzte Kabeldaten (werden nicht geladen)
  lib/   d3-array, d3-geo, topojson-client (lokal, kein CDN)
  data/names.js              deutsche Ländernamen, Meeresliste
  data/landlinks.js          Landstrecken zwischen Nachbarstädten (erzeugt)
  tools/prune-data.js        Aufräum-Skript für die Kabeldaten
  tools/test-routes.js       Gesamttest aller Städtepaare
  tools/land-links.js        erzeugt data/landlinks.js aus den Ländergrenzen
```

## Wichtige Entscheidungen

- **Daten als `.js`** (`window.CABLES = …`), damit es per Doppelklick (`file://`) läuft.
- **Zwei Canvas-Schichten:** Hintergrund (Länder, Kabel, Städte) wird nur bei Größen- oder Ansichtsänderung neu gezeichnet, Vordergrund (Route, Paket, Hover) läuft mit 30 FPS und nur bei Bedarf. Route und Auswahl liegen als gecachte Zwischenschicht (billiger Glow).
- **Zoom über Zeichen-Transformation:** Geometrie wird einmal als `Path2D` erzeugt, Linienbreiten werden durch den Zoomfaktor geteilt.
- **Graph:** Kabelkanten über die Endpunkte der Linienstücke gebildet (nicht über die Reihenfolge der Landepunkte). Kabelwechsel nur an Landepunkten. Landepunkte desselben Landes bis 60 km Abstand gelten als landverbunden. Städte hängen per Luftlinie an allen Landepunkten im Umkreis (je nach Stadt 100–1600 km, nur in erreichbaren Ländern).
- **Aufräumen der Daten (`tools/prune-data.js`):** Kabel unter 100 km und Kabel ohne Anschluss ans Hauptnetz entfernt (607 → 467 Kabel). Alle 101 Städte bleiben verbunden, Stichprobenrouten ändern sich kaum. Anderer Grenzwert: `MIN_KM=50 node tools/prune-data.js` (rechnet von `data/_voll/` neu).
- **Entfernt auf Wunsch:** Kappen, „Rotes Meer sperren“, „Atlantik kappen“, Umweg-Anzeige.

## Lizenz und Quellen (wichtig)

- Karten von **TeleGeography** stehen laut deren Seite unter **CC BY-SA 4.0**, Namensnennung ist Pflicht (steht in der Fußzeile mit Link).
- Die **Rohdaten** (Kabel-Datenbank) sind ein kostenpflichtiges Produkt. Das GitHub-Repo, das der Plan nennt, ist nicht mehr erreichbar. Geladen wurde aus der öffentlichen Karten-API von submarinecablemap.com.
- **Entscheidung vom 20.10.2026:** Das Projekt wurde trotzdem öffentlich gemacht (GitHub-Repo `JulianHarder/LANDFALL` und Kopie im Portfolio), mit Quellenangabe in Fußzeile und README. Das Risiko einer Beanstandung durch TeleGeography trägt Julian. Die ungekürzten Daten (`data/_voll/`) liegen bewusst nicht im Repo. Sollte TeleGeography widersprechen: Kabeldaten ersetzen oder entfernen.
- Länder: Natural Earth über `world-atlas` (Public Domain).

## Getestet / nicht getestet

- Getestet im Browser-Fenster über einen lokalen Server (schmale Ansicht): Karte, Zoom, Ziehen, Städteklick, Routen, Animation (30 FPS, keine Zeichnung im Ruhezustand), keine Konsolenfehler.
- 20.10.2026: Breite Ansicht (Karte 1580 px, Städtenamen sichtbar) ohne Konsolenfehler getestet. Die ms-Anzeige steht jetzt unter dem Paket und überdeckt „Ziel“ nicht mehr.
- 20.10.2026: Laden per `file://` (Doppelklick) in Chrome getestet (Screenshots für die README stammen daraus).
- **Nicht getestet:** Pinch/Touch auf echtem Gerät, Firefox/Safari, Last im Task-Manager. Hinweis: Im Browser-Fenster der Entwicklungsumgebung läuft die Seite nur mit ca. 1 FPS, die Animation dauert dort deutlich länger als 6 s (liegt an der Testumgebung, nicht am Code).

## Offene Punkte / Ideen

- Mehrere Pakete gleichzeitig, Lernmodus mit Erklärtexten („Warum geht ein Anruf nicht direkt?“), Deutschland-Detail (Landstrecke bis DE-CIX) – aus dem Plan, noch nicht umgesetzt.
- Landwege sind Luftlinie; die Laufzeit zeigt nur die einfache Strecke ohne Gerätezeiten.
- Lizenz der Kabeldaten ist weiter ungeklärt (siehe Abschnitt „Lizenz und Quellen“); veröffentlicht wurde auf eigenes Risiko.
