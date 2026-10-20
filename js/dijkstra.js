// dijkstra.js – kürzester Weg im Graphen (Binary Heap als Prioritätswarteschlange).
// Gewicht = Kantenlänge in km.
(function () {
  const US_PER_KM = 5; // Licht im Glasfaserkabel: ca. 200.000 km/s = 5 µs pro km

  class MinHeap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    push(item) {
      const a = this.a;
      a.push(item);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p][0] <= a[i][0]) break;
        [a[p], a[i]] = [a[i], a[p]];
        i = p;
      }
    }
    pop() {
      const a = this.a;
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < a.length && a[l][0] < a[m][0]) m = l;
          if (r < a.length && a[r][0] < a[m][0]) m = r;
          if (m === i) break;
          [a[m], a[i]] = [a[i], a[m]];
          i = m;
        }
      }
      return top;
    }
  }

  const cableName = (id) => {
    const c = window.CABLES.features.find((f) => f.properties.id === id);
    return c ? c.properties.name : id;
  };

  // Etappen: Städte und Landepunkte sind Stationen; dazwischen Landweg oder ein Kabel.
  function buildSteps(nodeIds, edges) {
    const steps = [];
    let cur = null;
    let stationFrom = nodeIds[0];
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const kind = e.type === "land" ? "land" : e.cable;
      if (!cur || cur.kind !== kind) {
        cur = { kind, type: e.type, cable: e.cable, from: stationFrom, to: null, km: 0 };
        steps.push(cur);
      }
      cur.km += e.km;
      const next = nodeIds[i + 1];
      const nt = LFGraph.nodes.get(next).type;
      if (nt === "landing" || nt === "city") {
        cur.to = next;
        stationFrom = next;
        cur = null;
      }
    }
    // aufeinanderfolgende Landwege (z. B. Stadt -> Küste -> Nachbarstation) zu einer Etappe zusammenfassen
    const merged = [];
    for (const s of steps.filter((x) => x.to)) {
      const last = merged[merged.length - 1];
      if (last && last.type === "land" && s.type === "land") {
        // Zwischenstädte merken ("über …"); Landepunkte sind keine Städte und bleiben unerwähnt
        if (LFGraph.nodes.get(last.to).type === "city") last.via.push(last.to);
        last.to = s.to;
        last.km += s.km;
      } else {
        merged.push({ ...s, via: [] });
      }
    }
    // Wechsel zwischen Landepunkten an derselben Stelle (0 km, z. B. Changi North -> Changi South) nicht als Etappe zeigen
    const shown = [];
    let carryFrom = null;
    for (const s of merged) {
      const from = carryFrom || s.from;
      carryFrom = null;
      if (s.type === "land" && s.km < 1 && LFGraph.nodes.get(s.from).type === "landing" && LFGraph.nodes.get(s.to).type === "landing") {
        carryFrom = from;
        continue;
      }
      shown.push({ ...s, from });
    }
    return shown.map((s) => ({
      type: s.type,
      cable: s.cable,
      cableName: s.cable ? cableName(s.cable) : null,
      from: LFGraph.nodes.get(s.from).name,
      to: LFGraph.nodes.get(s.to).name,
      via: s.via.map((id) => LFGraph.nodes.get(id).name),
      km: s.km,
    }));
  }

  // Alle Kantenstücke der Route in Laufrichtung zu einer Koordinatenfolge ordnen
  function orientedPieces(nodeIds, edges) {
    return edges.map((e, i) => {
      const forward = e.a === nodeIds[i];
      return { type: e.type, cable: e.cable, coords: forward ? e.coords : e.coords.slice().reverse(), km: e.km };
    });
  }

  function route(fromId, toId) {
    const dist = new Map([[fromId, 0]]);
    const prev = new Map();
    const heap = new MinHeap();
    const done = new Set();
    heap.push([0, fromId]);

    while (heap.size) {
      const [d, id] = heap.pop();
      if (done.has(id)) continue;
      done.add(id);
      if (id === toId) break;
      for (const e of LFGraph.adj.get(id)) {
        const nx = LFGraph.otherEnd(e, id);
        const nd = d + e.km;
        if (nd < (dist.has(nx) ? dist.get(nx) : Infinity)) {
          dist.set(nx, nd);
          prev.set(nx, { id, edge: e });
          heap.push([nd, nx]);
        }
      }
    }
    if (!dist.has(toId)) return null;

    const nodeIds = [toId];
    const edges = [];
    for (let id = toId; id !== fromId;) {
      const p = prev.get(id);
      edges.push(p.edge);
      nodeIds.push(p.id);
      id = p.id;
    }
    nodeIds.reverse();
    edges.reverse();

    const km = dist.get(toId);
    return {
      from: fromId,
      to: toId,
      nodeIds,
      edges,
      km,
      ms: km * US_PER_KM / 1000,
      steps: buildSteps(nodeIds, edges),
      pieces: orientedPieces(nodeIds, edges),
    };
  }

  window.LFRouting = { route, MinHeap, US_PER_KM };
})();
