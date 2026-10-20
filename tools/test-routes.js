// Testet alle Städtepaare: node tools/test-routes.js [Projektordner]
// Harte Fehler (Exit-Code 1):
//   - keine Route; Start/Ende stimmen nicht; Hin- und Rückweg verschieden lang
//   - Strecke kürzer als Luftlinie (physikalisch unmöglich) oder ms passt nicht zu km
//   - Etappen ergeben nicht die Gesamtstrecke oder reißen ab (Etappenkette); Etappe ohne Länge
//   - Linie hat Lücken/Sprünge (Kantenstücke schließen nicht aneinander an) oder Länge stimmt nicht
//   - Datenfehler: doppelte Stadt-IDs, Stadt ohne Verbindung, nicht alle Städte im selben Netz
// Hinweise (nur Ausgabe): auffällige Umwege (Route > UMWEG × Luftlinie), sehr lange einzelne Landkanten (Luftlinie)
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const UMWEG = Number(process.env.UMWEG) || 2.5;   // ab diesem Verhältnis Route/Luftlinie auflisten
const NAH_KM = 6000;                              // Umweg-Hinweise nur für Paare bis zu dieser Luftlinie
const LAND_LANG_KM = 2500;                        // einzelne Landstrecken darüber auflisten
const LUECKE_KM = 20;                             // erlaubter Abstand zwischen zwei Kantenstücken (JOIN_KM = 15)

const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["data/cables.js", "data/landings.js", "data/cities.js", "data/landlinks.js", "js/graph.js", "js/dijkstra.js"]) {
  vm.runInContext(read(f), ctx);
}
const { CITIES, LFGraph: G, LFRouting: R } = ctx;
const US_PER_KM = R.US_PER_KM;

const fehler = [];
const hinweise = [];
const err = (msg) => fehler.length < 200 && fehler.push(msg);

// ---- Datenprüfung ----
const ids = new Set();
for (const c of CITIES) {
  if (ids.has(c.id)) err(`Doppelte Stadt-ID: ${c.id}`);
  ids.add(c.id);
  if (!Number.isFinite(c.lon) || !Number.isFinite(c.lat) || Math.abs(c.lon) > 180 || Math.abs(c.lat) > 90) err(`Ungültige Koordinaten: ${c.name}`);
}
for (const [a, b] of [...(ctx.LAND_LINKS || []), ...(ctx.CITY_LINKS || [])]) {
  if (!ids.has(a) || !ids.has(b)) err(`Landverbindung mit unbekannter Stadt: ${a} – ${b}`);
}
for (const c of CITIES) {
  if (!(G.adj.get("city:" + c.id) || []).length) err(`Stadt ohne Verbindung: ${c.name}`);
}
if (new Set(CITIES.map((c) => c.name)).size !== CITIES.length) err("Doppelte Städtenamen");

// ---- Alle Paare ----
const gc = (a, b) => G.haversine([a.lon, a.lat], [b.lon, b.lat]);
let paare = 0;
let ohneRoute = 0;
const umwege = [];
const langeLand = new Map();
const t0 = Date.now();
const cache = new Map();

for (let i = 0; i < CITIES.length; i++) {
  for (let j = i + 1; j < CITIES.length; j++) {
    const a = CITIES[i];
    const b = CITIES[j];
    paare++;
    const tag = `${a.name} → ${b.name}`;
    const r = R.route("city:" + a.id, "city:" + b.id);
    if (!r) { ohneRoute++; err(`Keine Route: ${tag}`); continue; }

    const luft = gc(a, b);
    if (r.from !== "city:" + a.id || r.to !== "city:" + b.id) err(`Start/Ziel stimmen nicht: ${tag}`);
    if (r.nodeIds[0] !== r.from || r.nodeIds[r.nodeIds.length - 1] !== r.to) err(`Knotenfolge beginnt/endet falsch: ${tag}`);
    if (new Set(r.nodeIds).size !== r.nodeIds.length) err(`Route besucht einen Knoten doppelt: ${tag}`);
    if (r.km < luft - 1) err(`Strecke kürzer als Luftlinie (${Math.round(r.km)} < ${Math.round(luft)} km): ${tag}`);
    if (Math.abs(r.ms - (r.km * US_PER_KM) / 1000) > 1e-6) err(`ms passt nicht zu km: ${tag}`);

    // Gegenrichtung
    const rr = R.route("city:" + b.id, "city:" + a.id);
    if (!rr || Math.abs(rr.km - r.km) > 0.01) err(`Hin-/Rückweg verschieden lang (${Math.round(r.km)} / ${rr ? Math.round(rr.km) : "keine"} km): ${tag}`);

    // Etappen: Summe, Kette, Namen
    const sum = r.steps.reduce((s, x) => s + x.km, 0);
    if (Math.abs(sum - r.km) > 0.5) err(`Etappen (${Math.round(sum)} km) ≠ Gesamtstrecke (${Math.round(r.km)} km): ${tag}`);
    if (r.steps[0].from !== a.name || r.steps[r.steps.length - 1].to !== b.name) err(`Etappen beginnen/enden falsch: ${tag}`);
    for (let k = 1; k < r.steps.length; k++) {
      if (r.steps[k].from !== r.steps[k - 1].to) err(`Etappenkette reißt ab bei „${r.steps[k].from}“: ${tag}`);
    }
    for (const s of r.steps) {
      if (s.type === "cable" && !s.cableName) err(`Kabelname fehlt: ${tag}`);
      if (!(s.km > 0) && s.from !== s.to) err(`Etappe ohne Länge: ${tag}`);
    }

    // Linie: Stücke schließen aneinander an, Länge passt
    let polyKm = 0;
    for (let k = 0; k < r.pieces.length; k++) {
      const p = r.pieces[k];
      polyKm += G.polylineKm(p.coords);
      if (k > 0) {
        const prev = r.pieces[k - 1].coords;
        const gap = G.haversine(prev[prev.length - 1], p.coords[0]);
        if (gap > LUECKE_KM) err(`Lücke von ${Math.round(gap)} km in der Linie (Stück ${k}): ${tag}`);
      }
    }
    const first = r.pieces[0].coords[0];
    const last = r.pieces[r.pieces.length - 1].coords.slice(-1)[0];
    if (G.haversine(first, [a.lon, a.lat]) > LUECKE_KM) err(`Linie beginnt nicht bei ${a.name}: ${tag}`);
    if (G.haversine(last, [b.lon, b.lat]) > LUECKE_KM) err(`Linie endet nicht bei ${b.name}: ${tag}`);
    if (Math.abs(polyKm - r.km) > Math.max(1, r.km * 0.001)) err(`Linienlänge (${Math.round(polyKm)} km) ≠ Strecke (${Math.round(r.km)} km): ${tag}`);

    // Hinweise
    if (luft < NAH_KM && r.km / luft > UMWEG) umwege.push({ tag, luft, km: r.km, f: r.km / luft });
    for (const e of r.edges) {
      if (e.type === "land" && e.km > LAND_LANG_KM) {
        const key = [e.a, e.b].map((id) => G.nodes.get(id).name).sort().join(" – ");
        langeLand.set(key, e.km);
      }
    }
  }
}

// Netz zusammenhängend?
const alle = new Set(CITIES.map((c) => "city:" + c.id));
const start = "city:" + CITIES[0].id;
for (const c of CITIES) if (!G.reachable(start, "city:" + c.id)) err(`Nicht im Hauptnetz: ${c.name}`);

// ---- Ausgabe ----
umwege.sort((x, y) => y.f - x.f);
console.log(`Städte: ${CITIES.length}, Paare: ${paare}, Dauer: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`Harte Fehler: ${fehler.length}${fehler.length >= 200 ? " (Liste auf 200 gekürzt)" : ""}`);
for (const f of fehler.slice(0, 40)) console.log("  ✗", f);
console.log(`\nHinweis – Umwege > ${UMWEG}× Luftlinie (Paare unter ${NAH_KM} km): ${umwege.length}`);
for (const u of umwege.slice(0, 30)) console.log(`  ${u.tag}: ${Math.round(u.luft)} km Luftlinie → ${Math.round(u.km)} km (${u.f.toFixed(1)}×)`);
console.log(`\nHinweis – einzelne Landkanten > ${LAND_LANG_KM} km: ${langeLand.size}`);
for (const [k, v] of [...langeLand].sort((x, y) => y[1] - x[1]).slice(0, 15)) console.log(`  ${k}: ${Math.round(v)} km`);
process.exit(fehler.length ? 1 : 0);
