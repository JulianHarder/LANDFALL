// Räumt die Kabeldaten auf (einmalig ausführen): node tools/prune-data.js [Projektordner]
//  1. sehr kurze Kabel (< MIN_KM) fliegen raus, sofern dadurch keine Stadt vom Netz getrennt wird
//  2. Kabel, die nach 1. nirgends zum Hauptnetz führen (Inselnetze, Seen), fliegen raus
//  3. Landepunkte, die zu keinem verbleibenden Kabel gehören, fliegen raus
// Die ungekürzten Daten liegen in data/_voll/ (nicht geladen).
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const MIN_KM = Number(process.env.MIN_KM) || 50;
const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// Immer von den ungekürzten Daten ausgehen, damit der Lauf wiederholbar ist
const src = fs.existsSync(path.join(root, "data/_voll/cables.js")) ? "data/_voll/" : "data/";
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of [src + "cables.js", src + "landings.js", "data/cities.js", "data/landlinks.js", "js/graph.js"]) vm.runInContext(read(f), ctx);
const G = ctx.window.LFGraph;
const cables = ctx.window.CABLES.features;
const landings = ctx.window.LANDINGS.features;
const cityIds = ctx.window.CITIES.map((c) => "city:" + c.id);

const length = new Map();
for (const e of G.edges) if (e.cable) length.set(e.cable, (length.get(e.cable) || 0) + e.km);

function reachableSet(from, removed) {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const e of G.adj.get(cur)) {
      if (e.cable && removed.has(e.cable)) continue;
      const nx = G.otherEnd(e, cur);
      if (!seen.has(nx)) { seen.add(nx); queue.push(nx); }
    }
  }
  return seen;
}
const allCitiesConnected = (removed) => {
  const seen = reachableSet(cityIds[0], removed);
  return cityIds.every((c) => seen.has(c));
};

const removed = new Set();
const shortKept = [];
for (const c of cables.map((f) => f.properties.id).filter((id) => (length.get(id) || 0) < MIN_KM)
  .sort((a, b) => length.get(a) - length.get(b))) {
  removed.add(c);
  if (!allCitiesConnected(removed)) { removed.delete(c); shortKept.push(c); }
}
const shortRemoved = removed.size;

const main = reachableSet(cityIds[0], removed);
let dead = 0;
for (const f of cables) {
  const id = f.properties.id;
  if (removed.has(id)) continue;
  const es = G.edges.filter((e) => e.cable === id);
  if (!es.some((e) => main.has(e.a))) { removed.add(id); dead++; }
}

const keptCables = cables.filter((f) => !removed.has(f.properties.id));
const keptIds = new Set(keptCables.map((f) => f.properties.id));
const keptLandings = landings
  .filter((f) => f.properties.cables.some((c) => keptIds.has(c)))
  .map((f) => ({ ...f, properties: { ...f.properties, cables: f.properties.cables.filter((c) => keptIds.has(c)) } }));

const header = "// Quelle: TeleGeography Submarine Cable Map (submarinecablemap.com), Karten oeffentlich unter CC BY-SA 4.0 (Namensnennung noetig). Nur fuer privates Lernprojekt.\n// Aufgeraeumt mit tools/prune-data.js (kurze Kabel < " + MIN_KM + " km und Inselnetze ohne Anschluss entfernt); Original in data/_voll/.\n";
fs.writeFileSync(path.join(root, "data/cables.js"), header + "window.CABLES = " + JSON.stringify({ type: "FeatureCollection", features: keptCables }) + ";\n");
fs.writeFileSync(path.join(root, "data/landings.js"), header + "window.LANDINGS = " + JSON.stringify({ type: "FeatureCollection", features: keptLandings }) + ";\n");

console.log(`Kabel: ${cables.length} -> ${keptCables.length} (kurz entfernt: ${shortRemoved}, ohne Anschluss entfernt: ${dead}, kurz aber nötig behalten: ${shortKept.length})`);
console.log(`Landepunkte: ${landings.length} -> ${keptLandings.length}`);
