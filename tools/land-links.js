// Erzeugt ein einfaches Landnetz zwischen Städten: node tools/land-links.js [Projektordner]
//  1. Kandidaten: Städtepaare bis MAX_KM, deren Luftlinie (fast) ganz über Land verläuft
//     (Ländergrenzen: world-atlas 110m; die ersten/letzten END_KM und höchstens MAX_SEA_SAMPLES
//     Stützpunkte dürfen im Wasser liegen, weil 110m an der Küste grob ist)
//  2. Ausdünnen: Eine Strecke A–B entfällt, wenn eine Stadt C fast „dazwischen“ liegt
//     und A–C sowie C–B ebenfalls Landstrecken sind (dann läuft die Route über C).
// Ergebnis: data/landlinks.js (window.LAND_LINKS), wird von index.html geladen.
// Die handgesetzten Verbindungen (CITY_LINKS in data/cities.js) bleiben unberührt.
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const MAX_KM = Number(process.env.MAX_KM) || 2000;
const STEP_KM = 25;           // Abstand der Stützpunkte entlang der Luftlinie
const END_KM = 80;            // an den Enden darf die Küste ungenau sein
const MAX_SEA_SAMPLES = Number(process.env.MAX_SEA) || 2;    // so viel „Wasser“ unterwegs ist erlaubt (z. B. Ärmelkanal)
// Paare, bei denen die grobe 110m-Küste fälschlich „Land“ meldet (Meer dazwischen)
const EXCLUDE = new Set(["dublin,london"]);
const DETOUR = 1.2;           // C liegt „dazwischen“, wenn A–C + C–B <= DETOUR * A–B

const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

const ctx = { console };
ctx.self = ctx;
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["lib/d3-array.min.js", "lib/d3-geo.min.js", "lib/topojson-client.min.js", "data/countries.js", "data/cities.js"]) {
  vm.runInContext(read(f), ctx);
}
const { d3, topojson } = ctx;
const cities = ctx.CITIES;
const R = 6371;

// Landtest pro 0,25°-Zelle, erst bei Bedarf berechnet und gemerkt (nur Länder, deren Rahmen den Punkt enthält)
const land = topojson.feature(ctx.COUNTRIES, ctx.COUNTRIES.objects.countries);
const CELL = 0.25;
const COLS = Math.round(360 / CELL);
const ROWS = Math.round(180 / CELL);
const cache = new Int8Array(COLS * ROWS); // 0 = unbekannt, 1 = Land, -1 = Wasser
const feats = land.features
  .map((f) => ({ f, b: d3.geoBounds(f) }))
  .filter(({ b }) => b[0][0] <= b[1][0]); // Antimeridian-Fälle (Russland/Fidschi) sind für Landwege unwichtig
function isLand(lon, lat) {
  const x = Math.min(COLS - 1, Math.max(0, Math.floor((lon + 180) / CELL)));
  const y = Math.min(ROWS - 1, Math.max(0, Math.floor((lat + 90) / CELL)));
  const i = y * COLS + x;
  if (cache[i]) return cache[i] === 1;
  const p = [-180 + (x + 0.5) * CELL, -90 + (y + 0.5) * CELL];
  let hit = false;
  for (const { f, b } of feats) {
    if (p[0] < b[0][0] || p[0] > b[1][0] || p[1] < b[0][1] || p[1] > b[1][1]) continue;
    if (d3.geoContains(f, p)) { hit = true; break; }
  }
  cache[i] = hit ? 1 : -1;
  return hit;
}

const km = (a, b) => d3.geoDistance([a.lon, a.lat], [b.lon, b.lat]) * R;

function overLand(a, b, dist) {
  const interp = d3.geoInterpolate([a.lon, a.lat], [b.lon, b.lat]);
  const n = Math.max(2, Math.ceil(dist / STEP_KM));
  let sea = 0;
  for (let i = 1; i < n; i++) {
    const d = (i / n) * dist;
    if (d < END_KM || dist - d < END_KM) continue;
    const [lon, lat] = interp(i / n);
    if (!isLand(lon, lat) && ++sea > MAX_SEA_SAMPLES) return false;
  }
  return true;
}

// 1. Kandidaten
const dist = new Map();
const key = (i, j) => (i < j ? i + "," + j : j + "," + i);
const cand = [];
for (let i = 0; i < cities.length; i++) {
  for (let j = i + 1; j < cities.length; j++) {
    const d = km(cities[i], cities[j]);
    if (d > MAX_KM) continue;
    if (EXCLUDE.has([cities[i].id, cities[j].id].sort().join(","))) continue;
    if (overLand(cities[i], cities[j], d)) { cand.push([i, j]); dist.set(key(i, j), d); }
  }
}

// 2. Ausdünnen
const isCand = (i, j) => dist.has(key(i, j));
const keep = cand.filter(([i, j]) => {
  const dij = dist.get(key(i, j));
  for (let k = 0; k < cities.length; k++) {
    if (k === i || k === j || !isCand(i, k) || !isCand(k, j)) continue;
    if (dist.get(key(i, k)) + dist.get(key(k, j)) <= DETOUR * dij) return false;
  }
  return true;
});

const links = keep.map(([i, j]) => [cities[i].id, cities[j].id]);
links.sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));

const lines = links.map((l) => `  ${JSON.stringify(l)},`).join("\n");
fs.writeFileSync(
  path.join(root, "data/landlinks.js"),
  "// Erzeugt mit tools/land-links.js (Landstrecken zwischen Nachbarstädten, Luftlinie, vereinfacht).\n" +
    "// Nicht von Hand ändern; handgesetzte Verbindungen stehen in data/cities.js (CITY_LINKS).\n" +
    "window.LAND_LINKS = [\n" + lines + "\n];\n",
);

console.log(`Kandidaten: ${cand.length}, nach dem Ausdünnen: ${links.length} (MAX_KM=${MAX_KM})`);
const degree = new Map(cities.map((c) => [c.id, 0]));
for (const [a, b] of links) { degree.set(a, degree.get(a) + 1); degree.set(b, degree.get(b) + 1); }
console.log("Städte ohne Landverbindung:", cities.filter((c) => !degree.get(c.id)).map((c) => c.name).join(", ") || "–");
