// graph.js – Graph aus Kabeln, Landepunkten und Städten; Haversine-Entfernung.
//
// Knoten:  "lp:<id>"       Landepunkt
//          "<kabel>@<lon,lat>"  Kabelknoten (Endpunkt, Abzweig, Anlandung eines Kabelsegments)
//          "city:<id>"     Stadt
// Kanten:  type "cable" (durchgezogen) oder "land" (gestrichelt, vereinfacht)
//
// Kabelkanten werden über die Endpunkte der Linienstücke (MultiLineString-Segmente)
// gebildet, nicht über die Reihenfolge der Landepunkte in den Daten.
(function () {
  const EARTH_KM = 6371;
  const RAD = Math.PI / 180;
  const JOIN_KM = 15; // Kabelknoten, die näher beieinander liegen, gelten als verbunden (z. B. Datumsgrenze)

  function haversine(a, b) {
    const dLat = (b[1] - a[1]) * RAD;
    const dLon = (b[0] - a[0]) * RAD;
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function polylineKm(coords) {
    let km = 0;
    for (let i = 1; i < coords.length; i++) km += haversine(coords[i - 1], coords[i]);
    return km;
  }

  const key = (p) => p[0].toFixed(3) + "," + p[1].toFixed(3);

  const nodes = new Map(); // id -> {id, type, name, lon, lat}
  const adj = new Map();   // id -> [edge]
  const edges = [];        // {a, b, km, type, cable, coords}

  function addNode(id, type, name, lon, lat) {
    if (!nodes.has(id)) {
      nodes.set(id, { id, type, name, lon, lat });
      adj.set(id, []);
    }
    return nodes.get(id);
  }

  function addEdge(a, b, type, cable, coords) {
    const e = { a, b, type, cable, coords, km: polylineKm(coords) };
    edges.push(e);
    adj.get(a).push(e);
    adj.get(b).push(e);
    return e;
  }

  function otherEnd(e, id) { return e.a === id ? e.b : e.a; }

  function buildCable(cable, landingById) {
    const id = cable.properties.id;
    const lines = cable.geometry.coordinates;
    const marks = new Set();
    const landingAt = new Map(); // Knotenschlüssel -> [Landepunkt]

    // Endpunkte aller Linienstücke sind Knoten
    for (const ln of lines) {
      marks.add(key(ln[0]));
      marks.add(key(ln[ln.length - 1]));
    }

    // Jeder Landepunkt wird an den nächsten Kabelpunkt seines Kabels gehängt
    for (const lpId of cable.properties.landings) {
      const lp = landingById.get(lpId);
      if (!lp) continue;
      let best = null;
      let bestKm = Infinity;
      for (const ln of lines) {
        for (const p of ln) {
          const d = haversine(p, lp.geometry.coordinates);
          if (d < bestKm) { bestKm = d; best = p; }
        }
      }
      if (!best) continue;
      const k = key(best);
      marks.add(k);
      if (!landingAt.has(k)) landingAt.set(k, []);
      landingAt.get(k).push(lp);
    }

    // Linien an allen Knotenpunkten in Kanten zerlegen
    const cableNodes = [];
    for (const ln of lines) {
      let startIdx = 0;
      for (let i = 1; i < ln.length; i++) {
        const isLast = i === ln.length - 1;
        if (!isLast && !marks.has(key(ln[i]))) continue;
        const piece = ln.slice(startIdx, i + 1);
        startIdx = i;
        if (piece.length < 2) continue;
        const a = id + "@" + key(piece[0]);
        const b = id + "@" + key(piece[piece.length - 1]);
        if (a === b) continue;
        const na = addNode(a, "junction", cable.properties.name, piece[0][0], piece[0][1]);
        const nb = addNode(b, "junction", cable.properties.name, piece[piece.length - 1][0], piece[piece.length - 1][1]);
        cableNodes.push(na, nb);
        addEdge(a, b, "cable", id, piece);
      }
    }

    // Anlandungen: Kabelknoten -> Landepunkt (kurzes Stück Seekabel-Ende)
    for (const [k, lps] of landingAt) {
      const kn = nodes.get(id + "@" + k);
      if (!kn) continue;
      for (const lp of lps) {
        const lpNode = addNode("lp:" + lp.properties.id, "landing", lp.properties.name,
          lp.geometry.coordinates[0], lp.geometry.coordinates[1]);
        addEdge(kn.id, lpNode.id, "cable", id, [[kn.lon, kn.lat], [lpNode.lon, lpNode.lat]]);
      }
    }

    // Zusammenhang prüfen: getrennte Teile, die ganz dicht beieinander liegen
    // (Datumsgrenze, Rundungsfehler), werden verbunden.
    const own = [...new Set(cableNodes.map((n) => n.id))].map((nid) => nodes.get(nid));
    const comp = new Map();
    let c = 0;
    for (const n of own) {
      if (comp.has(n.id)) continue;
      const stack = [n.id];
      comp.set(n.id, c);
      while (stack.length) {
        const cur = stack.pop();
        for (const e of adj.get(cur)) {
          if (e.cable !== id) continue;
          const nx = otherEnd(e, cur);
          if (!comp.has(nx)) { comp.set(nx, c); stack.push(nx); }
        }
      }
      c++;
    }
    for (let i = 0; i < own.length; i++) {
      for (let j = i + 1; j < own.length; j++) {
        if (comp.get(own[i].id) === comp.get(own[j].id)) continue;
        if (haversine([own[i].lon, own[i].lat], [own[j].lon, own[j].lat]) > JOIN_KM) continue;
        addEdge(own[i].id, own[j].id, "cable", id, [[own[i].lon, own[i].lat], [own[j].lon, own[j].lat]]);
        const from = comp.get(own[j].id);
        const to = comp.get(own[i].id);
        for (const [nid, cc] of comp) if (cc === from) comp.set(nid, to);
      }
    }
    return new Set(comp.values()).size; // Anzahl getrennter Teile (1 = zusammenhängend)
  }

  function buildLand() {
    const defaults = window.LAND_DEFAULTS || { k: 40, radius: 300, hubKm: 60 };
    const landings = [...nodes.values()].filter((n) => n.type === "landing");
    const countryOf = new Map(window.LANDINGS.features.map((f) => [f.properties.id, f.properties.country]));

    // Landepunkte desselben Landes, die dicht beieinander liegen, sind über Land verbunden
    // (Kabelwechsel zwischen Anlandestationen derselben Küstenregion).
    const hubKm = defaults.hubKm;
    const cell = (n) => Math.floor(n.lon / 1) + "," + Math.floor(n.lat / 1);
    const grid = new Map();
    for (const l of landings) {
      const c = cell(l);
      if (!grid.has(c)) grid.set(c, []);
      grid.get(c).push(l);
    }
    for (const a of landings) {
      const ca = countryOf.get(a.id.slice(3));
      if (!ca) continue;
      const gx = Math.floor(a.lon);
      const gy = Math.floor(a.lat);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const b of grid.get((gx + dx) + "," + (gy + dy)) || []) {
            if (b.id <= a.id || countryOf.get(b.id.slice(3)) !== ca) continue;
            if (haversine([a.lon, a.lat], [b.lon, b.lat]) > hubKm) continue;
            addEdge(a.id, b.id, "land", null, [[a.lon, a.lat], [b.lon, b.lat]]);
          }
        }
      }
    }

    // Städte: Landstrecke (Luftlinie) zu Landepunkten im Umkreis, höchstens `k` nächste
    for (const city of window.CITIES) {
      const cn = addNode("city:" + city.id, "city", city.name, city.lon, city.lat);
      const k = city.k || defaults.k;
      const radius = city.radius || defaults.radius;
      const near = landings
        .filter((l) => city.countries.includes(countryOf.get(l.id.slice(3))))
        .map((l) => ({ l, km: haversine([city.lon, city.lat], [l.lon, l.lat]) }))
        .filter((x) => x.km <= radius)
        .sort((x, y) => x.km - y.km)
        .slice(0, k);
      for (const { l } of near) addEdge(cn.id, l.id, "land", null, [[cn.lon, cn.lat], [l.lon, l.lat]]);
    }

    for (const [idA, idB] of [...(window.LAND_LINKS || []), ...(window.CITY_LINKS || [])]) {
      const a = nodes.get("city:" + idA);
      const b = nodes.get("city:" + idB);
      if (a && b) addEdge(a.id, b.id, "land", null, [[a.lon, a.lat], [b.lon, b.lat]]);
    }
  }

  function build() {
    const landingById = new Map(window.LANDINGS.features.map((f) => [f.properties.id, f]));
    const split = [];
    for (const cable of window.CABLES.features) {
      const parts = buildCable(cable, landingById);
      if (parts > 1) split.push(cable.properties.id + " (" + parts + " Teile)");
    }
    buildLand();
    return split;
  }

  // Einfache Erreichbarkeitsprüfung (Breitensuche), für Tests in der Konsole
  function reachable(fromId, toId) {
    const seen = new Set([fromId]);
    const queue = [fromId];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === toId) return true;
      for (const e of adj.get(cur) || []) {
        const nx = otherEnd(e, cur);
        if (!seen.has(nx)) { seen.add(nx); queue.push(nx); }
      }
    }
    return false;
  }

  function cityDistanceKm(idA, idB) {
    const a = window.CITIES.find((c) => c.id === idA);
    const b = window.CITIES.find((c) => c.id === idB);
    return haversine([a.lon, a.lat], [b.lon, b.lat]);
  }

  const splitCables = build();

  window.LFGraph = {
    haversine,
    polylineKm,
    nodes,
    adj,
    edges,
    otherEnd,
    reachable,
    cityDistanceKm,
    splitCables,
    stats() {
      const by = (t) => [...nodes.values()].filter((n) => n.type === t).length;
      return {
        knoten: nodes.size,
        landepunkte: by("landing"),
        kabelknoten: by("junction"),
        staedte: by("city"),
        kanten: edges.length,
        kabelkanten: edges.filter((e) => e.type === "cable").length,
        landkanten: edges.filter((e) => e.type === "land").length,
        getrennteKabel: splitCables,
      };
    },
  };
})();
