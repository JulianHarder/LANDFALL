// main.js – Start und Events
(function () {
  const stage = document.getElementById("stage");
  const bg = document.getElementById("bg");
  const fg = document.getElementById("fg");
  const bgCtx = bg.getContext("2d");
  const fgCtx = fg.getContext("2d");
  const statusEl = document.getElementById("status");

  let mouse = null; // {x, y, lon, lat}
  let hoverCity = null;   // Stadt unter der Maus (Objekt aus CITIES)
  let pickFrom = null;    // per Klick gewählter Start (Stadt-ID), Ziel steht noch aus
  let dragging = false;   // Karte wird gerade verschoben/gezoomt

  let shownFps = -1;

  function drawForeground(now) {
    LFAnim.packet.step(now);

    const dpr = LFMap.dpr;
    fgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fgCtx.clearRect(0, 0, LFMap.width, LFMap.height);

    LFMap.drawOverlay(fgCtx);
    LFMap.drawRoute(fgCtx);
    LFAnim.packet.draw(fgCtx);

    // Per Klick gewählter Start (Ziel fehlt noch)
    if (pickFrom) drawCityMark(pickFrom, "#ffffff", true);

    // Stadt unter der Maus: Ring + Name; sonst ein kleines Fadenkreuz
    if (hoverCity && !dragging) {
      drawCityMark(hoverCity, "#f5c26b", true);
    } else if (mouse && !dragging) {
      fgCtx.strokeStyle = "rgba(34, 211, 238, 0.6)";
      fgCtx.lineWidth = 1;
      fgCtx.beginPath();
      fgCtx.moveTo(mouse.x - 8, mouse.y);
      fgCtx.lineTo(mouse.x + 8, mouse.y);
      fgCtx.moveTo(mouse.x, mouse.y - 8);
      fgCtx.lineTo(mouse.x, mouse.y + 8);
      fgCtx.stroke();
    }

    // Statusanzeige nur aktualisieren, wenn sich FPS oder Laufzustand ändern
    const state = LFAnim.running ? LFAnim.fps : -1;
    if (state !== shownFps) {
      shownFps = state;
      updateStatus();
    }
  }

  function drawCityMark(city, color, withName) {
    if (typeof city === "string") city = CITIES.find((c) => c.id === city);
    const p = LFMap.project([city.lon, city.lat]);
    if (!p) return;
    fgCtx.strokeStyle = color;
    fgCtx.lineWidth = 2;
    fgCtx.beginPath();
    fgCtx.arc(p[0], p[1], 7, 0, Math.PI * 2);
    fgCtx.stroke();
    if (!withName) return;
    fgCtx.font = "600 12px system-ui, sans-serif";
    fgCtx.textBaseline = "middle";
    const w = fgCtx.measureText(city.name).width;
    const x = p[0] + 12 + w > LFMap.width ? p[0] - 12 - w : p[0] + 12;
    fgCtx.fillStyle = "rgba(18, 29, 54, 0.8)";
    fgCtx.fillRect(x - 3, p[1] - 22, w + 6, 16);
    fgCtx.fillStyle = color;
    fgCtx.fillText(city.name, x, p[1] - 14);
  }

  function updateStatus() {
    const pos = mouse ? `${mouse.lat.toFixed(1)}°, ${mouse.lon.toFixed(1)}°` : "–";
    statusEl.textContent = `Position: ${pos} · DPR ${LFMap.dpr} · ${LFAnim.running ? LFAnim.fps + " FPS" : "ruht"}`;
  }

  function relayout() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    LFMap.resize([bg, fg], w, h);
    LFMap.drawBackground(bgCtx);   // Hintergrund: einmal pro Größenänderung
    LFAnim.requestDraw();
  }

  LFAnim.setDraw(drawForeground);

  // Zoomen/Verschieben: Hintergrund höchstens einmal pro Bild neu zeichnen
  let viewQueued = false;
  LFMap.onViewChange = () => {
    if (viewQueued) return;
    viewQueued = true;
    requestAnimationFrame(() => {
      viewQueued = false;
      LFMap.drawBackground(bgCtx);
      LFAnim.requestDraw();
    });
  };

  // Größenänderungen zu einem Neuzeichnen pro Bild zusammenfassen (Fenster ziehen)
  let relayoutQueued = false;
  function queueRelayout() {
    if (relayoutQueued) return;
    relayoutQueued = true;
    requestAnimationFrame(() => { relayoutQueued = false; relayout(); });
  }
  new ResizeObserver(queueRelayout).observe(stage);
  // Zoom/Umzug auf anderen Monitor ändert devicePixelRatio ohne Größenänderung
  window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener("change", queueRelayout, { once: true });

  // ---- Zoomen (Mausrad, Pinch, Buttons) und Verschieben (Ziehen) ----
  const pointers = new Map();     // aktive Zeiger: id -> {x, y}
  let dragMoved = false;          // wurde seit dem Drücken wirklich gezogen?
  let pinchDist = 0;
  const DRAG_THRESHOLD = 4;
  let downAt = null;

  const local = (e) => {
    const r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    const { x, y } = local(e);
    const unit = e.deltaMode === 1 ? 16 : 1;
    const speed = e.ctrlKey ? 0.01 : 0.0015;   // Trackpad-Pinch kommt als ctrl+wheel
    LFMap.zoomAt(Math.exp(-e.deltaY * unit * speed), x, y);
  }, { passive: false });

  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".zoomctl")) return;
    stage.setPointerCapture(e.pointerId);
    const pt = local(e);
    pointers.set(e.pointerId, pt);
    downAt = pt;
    dragMoved = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });

  function movePointer(e) {
    const pt = local(e);
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, pt);

    if (pointers.size === 2) {                       // Pinch: zoomen und mitschieben
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) LFMap.zoomAt(dist / pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinchDist = dist;
      dragMoved = true;
      dragging = true;
    } else if (pointers.size === 1) {                // Ziehen: Karte verschieben
      if (!dragMoved && Math.hypot(pt.x - downAt.x, pt.y - downAt.y) < DRAG_THRESHOLD) return;
      dragMoved = true;
      dragging = true;
      stage.classList.add("dragging");
      LFMap.panBy(pt.x - prev.x, pt.y - prev.y);
    }
  }

  function endPointer(e) {
    pointers.delete(e.pointerId);
    pinchDist = 0;
    if (!pointers.size) {
      dragging = false;
      stage.classList.remove("dragging");
      LFAnim.requestDraw();
    }
  }

  stage.addEventListener("pointermove", (e) => {
    movePointer(e);
    const { x, y } = local(e);
    const ll = LFMap.invert(x, y);
    mouse = ll && isFinite(ll[0]) ? { x, y, lon: ll[0], lat: ll[1] } : null;
    if (e.pointerType !== "touch" && !dragging) {
      const c = LFMap.pickCity(x, y, 10);
      hoverCity = c;
      stage.classList.toggle("over-city", !!c);
    }
    updateStatus();
    LFAnim.requestDraw();
  });
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);

  stage.addEventListener("pointerleave", () => {
    mouse = null;
    hoverCity = null;
    stage.classList.remove("over-city");
    updateStatus();
    LFAnim.requestDraw();
  });

  // Zoom-Buttons
  const zoomCtl = document.querySelector(".zoomctl");
  const center = () => ({ x: LFMap.width / 2, y: LFMap.height / 2 });
  document.getElementById("zoomIn").addEventListener("click", () => LFMap.zoomAt(1.6, center().x, center().y));
  document.getElementById("zoomOut").addEventListener("click", () => LFMap.zoomAt(1 / 1.6, center().x, center().y));
  document.getElementById("zoomReset").addEventListener("click", () => LFMap.resetView());
  zoomCtl.addEventListener("pointermove", (e) => e.stopPropagation());

  relayout();
  updateStatus();

  // ---- Zustand: aktuelle Verbindung, gewähltes Kabel ----
  const cableById = new Map(CABLES.features.map((f) => [f.properties.id, f]));
  let selected = null;              // gewähltes Kabel (Infokarte)
  let current = null;               // {from, to} der letzten Verbindung

  const coarsePointer = window.matchMedia("(pointer: coarse)");   // Touch: größere Trefferfläche

  function refreshCableUI() {
    LFMap.setSelectedCable(selected);
    LFUI.showCable(selected ? cableById.get(selected) : null);
  }

  // Verbindung ganz aus dem Blick nehmen: Route, Paket und Etappenliste verschwinden
  function disconnect() {
    current = null;
    LFMap.setRoute(null);
    LFMap.drawBackground(bgCtx);   // Kabel wieder in normaler Stärke
    LFAnim.packet.setRoute(null);
    LFUI.showIdle();
    LFUI.setReplayEnabled(false);
    LFUI.setDisconnectEnabled(false);
    LFAnim.requestDraw();
  }

  function reroute() {
    if (!current) { LFAnim.requestDraw(); return; }
    LFUI.setDisconnectEnabled(true);
    const route = LFRouting.route(current.from, current.to);
    LFMap.setRoute(route);
    LFMap.fitRoute();              // Route ins Bild holen, falls sie nicht ganz sichtbar ist
    LFMap.drawBackground(bgCtx);   // übrige Kabel zurücknehmen
    LFAnim.packet.setRoute(route);
    LFUI.showRoute(route);
    LFUI.setReplayEnabled(!!route);
    if (route) LFAnim.packet.play(); else LFAnim.requestDraw();
  }

  // Städte per Klick wählen: erster Klick = Start, zweiter Klick = Ziel -> Verbindung
  function pickCityClick(city) {
    if (pickFrom === city.id) {                     // dieselbe Stadt nochmal: Auswahl abbrechen
      pickFrom = null;
      LFUI.showIdle();
    } else if (pickFrom) {                          // zweite Stadt: verbinden
      LFUI.setSelection(pickFrom, city.id);
      current = { from: "city:" + pickFrom, to: "city:" + city.id };
      pickFrom = null;
      reroute();
    } else {                                        // erste Stadt: neuer Start
      disconnect();
      pickFrom = city.id;
      LFUI.setSelection(city.id, null);
      LFUI.showNotice("Start: " + city.name + ". Klicke jetzt auf die Zielstadt (oder nochmal auf den Start, um abzubrechen).");
    }
    LFAnim.requestDraw();
  }

  stage.addEventListener("click", (e) => {
    if (e.target.closest(".zoomctl")) return;
    if (dragMoved) { dragMoved = false; return; }   // war ein Ziehen, kein Klick
    const { x, y } = local(e);
    const city = LFMap.pickCity(x, y, coarsePointer.matches ? 18 : 10);
    if (city) { pickCityClick(city); return; }
    selected = LFMap.pickCable(x, y, coarsePointer.matches ? 16 : 8);
    refreshCableUI();
    LFAnim.requestDraw();
  });

  LFUI.init({
    onSelectChange() { pickFrom = null; },
    onConnect(fromId, toId) {
      pickFrom = null;
      if (!fromId) { disconnect(); return; }
      current = { from: fromId, to: toId };
      reroute();
    },
    onDisconnect: disconnect,
    onReplay: () => LFAnim.packet.play(),
    onSelectCable(id) {
      selected = id;
      refreshCableUI();
      LFAnim.requestDraw();
    },
  });
})();
