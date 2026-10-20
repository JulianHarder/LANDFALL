// animation.js – Zeichenschleife mit 30-FPS-Limit.
// Läuft nur, solange etwas animiert wird (start/stop) oder ein einzelnes Neuzeichnen
// angefordert wurde (requestDraw). Pausiert bei verstecktem Tab.
(function () {
  const FRAME_MS = 1000 / 30;

  let drawFn = () => {};
  let running = false;      // Dauer-Animation aktiv
  let rafId = 0;
  let lastFrame = 0;
  let needsDraw = false;    // einmaliges Neuzeichnen angefordert
  let fps = 0;
  let fpsCount = 0;
  let fpsStamp = 0;

  function loop(now) {
    rafId = 0;
    if (document.hidden) return;                  // Tab im Hintergrund: nichts tun
    if (!running && !needsDraw) return;           // nichts zu tun: Schleife endet

    if (now - lastFrame >= FRAME_MS - 1) {
      lastFrame = now;
      needsDraw = false;
      drawFn(now);

      fpsCount++;
      if (now - fpsStamp >= 1000) {
        fps = fpsCount;
        fpsCount = 0;
        fpsStamp = now;
      }
    }
    schedule();
  }

  function schedule() {
    if (!rafId && !document.hidden && (running || needsDraw)) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function start() { running = true; schedule(); }
  function stop() { running = false; }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      lastFrame = 0;
      schedule();
    }
  });

  // ---- Paket: leuchtender Punkt mit kurzem Schweif entlang der Route ----
  const DURATION_MS = 6000;   // feste Dauer für die ganze Route (nicht realistisch)
  const MAX_DT = 100;         // lange Pausen (Tab im Hintergrund) nicht aufholen
  const TAIL_MAX = 10;        // höchstens 10 gemerkte Positionen
  const TAIL_EVERY = 3;       // nur jedes 3. Bild merken -> Schweif ca. 1 s lang

  let route = null;
  let path = [];              // [lon, lat] in Laufrichtung
  let cum = [];               // kumulierte km je Punkt
  let total = 0;
  let progress = 0;           // 0..1
  let lastT = null;
  let frame = 0;
  let tail = [];

  function setRoute(r) {
    route = r;
    path = [];
    cum = [];
    total = 0;
    tail = [];
    progress = 0;
    if (!r) { stop(); return; }   // ohne Route keine Dauer-Schleife
    for (const piece of r.pieces) {
      for (const p of piece.coords) {
        if (path.length) {
          const prev = path[path.length - 1];
          if (prev[0] === p[0] && prev[1] === p[1]) continue;
          total += LFGraph.haversine(prev, p);
        }
        path.push(p);
        cum.push(total);
      }
    }
  }

  function positionAt(km) {
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < km) lo = mid + 1; else hi = mid;
    }
    if (lo === 0) return path[0];
    const span = cum[lo] - cum[lo - 1];
    const t = span > 0 ? (km - cum[lo - 1]) / span : 0;
    const a = path[lo - 1];
    const b = path[lo];
    // Auf dem Großkreis zwischen a und b, genau wie d3.geoPath die Linie zeichnet (sonst läuft der
    // Punkt bei langen Landwegen gerade, die gestrichelte Linie ist aber gebogen). Das umgeht auch
    // die Datumsgrenze: die Länge springt dort von 180 auf -180, ohne quer über die Karte zu laufen.
    return d3.geoInterpolate(a, b)(t);
  }

  function play() {
    if (!route) return;
    progress = 0;
    lastT = null;
    frame = 0;
    tail = [];
    start();
  }

  // Pro Bild: Fortschritt aus der verstrichenen Zeit (nicht aus der Uhr) -> pausiert mit dem Tab
  function step(now) {
    if (!route || !running) return;
    const dt = lastT === null ? 0 : Math.min(now - lastT, MAX_DT);
    lastT = now;
    progress = Math.min(1, progress + dt / DURATION_MS);
    if (frame++ % TAIL_EVERY === 0) {
      tail.push(positionAt(progress * total));
      if (tail.length > TAIL_MAX) tail.shift();
    }
    if (progress >= 1) stop();
  }

  function draw(ctx) {
    if (!route || !path.length) return;
    const proj = (ll) => LFMap.project(ll);

    // Schweif: verblassende Punkte (keine Linie, damit nichts über die Datumsgrenze zieht)
    for (let i = 0; i < tail.length; i++) {
      const p = proj(tail[i]);
      if (!p) continue;
      const f = (i + 1) / (tail.length + 1);
      ctx.fillStyle = `rgba(160, 245, 255, ${(f * 0.6).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 1 + f * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Kopf mit etwas Glow (ein einzelner Punkt, daher billig)
    const head = proj(positionAt(progress * total));
    if (!head) return;
    ctx.save();
    ctx.shadowColor = "rgba(120, 240, 255, 1)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(head[0], head[1], 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Echte Laufzeit bis zu diesem Punkt als Text
    const ms = (progress * route.ms).toFixed(1).replace(".", ",") + " ms";
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e6fbff";
    const w = ctx.measureText(ms).width;
    const x = head[0] + 10 + w > LFMap.width ? head[0] - 10 - w : head[0] + 10;
    // unter dem Paket: Städtenamen (Start/Ziel) stehen darüber und werden nicht überdeckt
    ctx.fillText(ms, x, head[1] + 14);
  }

  window.LFAnim = {
    packet: { setRoute, play, step, draw, get progress() { return progress; } },
    setDraw(fn) { drawFn = fn; },
    start,
    stop,
    requestDraw() { needsDraw = true; schedule(); },
    get fps() { return fps; },
    get running() { return running; },
  };
})();
