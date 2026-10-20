// map.js – Projektion, Ansicht (Zoom/Verschieben) und Hintergrundschicht. Kein WebGL, nur Canvas 2D.
//
// Die Geometrie (Länder, Kabel, Route) wird einmal in "Basiskoordinaten" (feste Projektion)
// als Path2D erzeugt. Zoomen und Verschieben ändern nur die Zeichen-Transformation
// (view = {k, x, y}); Linienbreiten und Punktgrößen werden durch k geteilt, damit sie
// auf dem Bildschirm gleich bleiben.
(function () {
  const MAX_DPR = 2;
  const LABEL_MIN_WIDTH = 1000;   // ab dieser Breite erscheinen Städtenamen früher
  const LABEL_MIN_ZOOM = 2.5;
  const LABEL_MIN_ZOOM_WIDE = 1.6;
  const LANDING_MIN_ZOOM = 2;     // Landepunkte erst beim Hineinzoomen (sonst nur Rauschen)
  const LONG_CABLE_KM = 4000;     // Hauptnetz: nur Kabel ab dieser Länge sind von Anfang an sichtbar
  const SHORT_CABLE_ZOOM = 1.8;   // kürzere Kabel erscheinen erst beim Hineinzoomen
  const CABLE_ALPHA = 0.45;       // Kabel im Ruhezustand
  const CABLE_ALPHA_ROUTE = 0.18;  // Kabel, solange eine Route hervorgehoben ist
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 40;
  const PORTRAIT_ASPECT = 1.2;    // Fläche schmaler als 1,2:1 (Hochformat): Karte füllt sie aus und lässt sich verschieben
  const FIT_MARGIN = 48;          // Rand beim Einpassen einer Route (Pixel)
  const FIT_MAX_ZOOM = 6;         // beim Einpassen nicht weiter als bis hierhin hineinzoomen

  const land = topojson.feature(window.COUNTRIES, window.COUNTRIES.objects.countries);
  const borders = topojson.mesh(window.COUNTRIES, window.COUNTRIES.objects.countries, (a, b) => a !== b);
  const sphere = { type: "Sphere" };
  const graticule = d3.geoGraticule10();

  const projection = d3.geoEquirectangular();   // Basisprojektion (ohne Zoom)
  let width = 0;
  let height = 0;
  let dpr = 1;
  const view = { k: 1, x: 0, y: 0 };
  let onViewChange = () => {};
  let box = { x0: 0, y0: 0, x1: 1, y1: 1 };   // Ausdehnung der Karte in Basiskoordinaten (Zoom 1)
  let defaultK = 1;                            // Grundzoom: 1 = ganze Welt, im Hochformat größer (Karte füllt die Fläche)
  let atDefault = true;                        // Ansicht wurde noch nicht vom Nutzer verändert

  let spherePath = null;
  let landPath = null;
  let borderPath = null;
  let gratPath = null;
  let cablePath = null;
  let cablePathShort = null;

  const cables = window.CABLES || { features: [] };
  const landings = window.LANDINGS || { features: [] };

  function pathFor(obj) {
    const p = new Path2D();
    d3.geoPath(projection, p)(obj);
    return p;
  }

  // ---- Koordinaten: Länge/Breite <-> Bildschirm (mit Zoom) ----
  function project(lonlat) {
    const p = projection(lonlat);
    return p ? [p[0] * view.k + view.x, p[1] * view.k + view.y] : null;
  }

  function invert(x, y) {
    return projection.invert([(x - view.x) / view.k, (y - view.y) / view.k]);
  }

  // Zeichenfläche in Basiskoordinaten (für Path2D) bzw. in Bildschirmpixeln
  function useViewTransform(ctx) {
    ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.x, dpr * view.y);
  }
  function useScreenTransform(ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- Zoom / Verschieben ----
  // Karte darf den Rand nicht verlassen; ist sie kleiner als die Fläche, wird sie zentriert.
  function clampView() {
    view.k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.k));
    const mw = (box.x1 - box.x0) * view.k;
    const mh = (box.y1 - box.y0) * view.k;
    const left = box.x0 * view.k;
    const top = box.y0 * view.k;
    view.x = mw <= width ? (width - mw) / 2 - left : Math.min(-left, Math.max(width - mw - left, view.x));
    view.y = mh <= height ? (height - mh) / 2 - top : Math.min(-top, Math.max(height - mh - top, view.y));
  }

  // Detailstufe für Beschriftungen, Landepunkte usw.: 1 = Grundansicht, egal wie groß der Grundzoom ist
  const zoomRel = () => view.k / defaultK;

  function changeView(fn, byUser) {
    fn();
    if (byUser !== false) atDefault = false;
    clampView();
    onViewChange();
  }

  function zoomAt(factor, cx, cy) {
    changeView(() => {
      const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.k * factor));
      const f = k / view.k;
      // Punkt unter (cx, cy) bleibt an Ort und Stelle
      view.x = cx - (cx - view.x) * f;
      view.y = cy - (cy - view.y) * f;
      view.k = k;
    });
  }

  function panBy(dx, dy) {
    changeView(() => { view.x += dx; view.y += dy; });
  }

  // Grundansicht: ganze Welt; im Hochformat füllt die Karte die Fläche (Mitte = Längengrad 0)
  function setDefaultView() {
    const mw = box.x1 - box.x0;
    const mh = box.y1 - box.y0;
    defaultK = width / height < PORTRAIT_ASPECT ? Math.max(1, width / mw, height / mh) : 1;
    view.k = defaultK;
    view.x = width / 2 - ((box.x0 + box.x1) / 2) * defaultK;
    view.y = height / 2 - ((box.y0 + box.y1) / 2) * defaultK;
    atDefault = true;
    clampView();
  }

  function resetView() {
    setDefaultView();
    onViewChange();
  }

  function resize(canvases, w, h) {
    // Ansicht beibehalten: gleicher Zoom, gleicher Kartenmittelpunkt (z. B. wenn sich das Panel ändert)
    const keepZoom = view.k;
    const keepCenter = width && !atDefault ? invert(width / 2, height / 2) : null;
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = w;
    height = h;
    for (const c of canvases) {
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
    }
    view.k = 1; view.x = 0; view.y = 0;

    // Karte (2:1) mit etwas Rand in die Fläche einpassen
    const pad = 8;
    projection.fitExtent([[pad, pad], [w - pad, h - pad]], sphere);
    const [[bx0, by0], [bx1, by1]] = d3.geoPath(projection).bounds(sphere);
    box = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
    spherePath = pathFor(sphere);
    landPath = pathFor(land);
    borderPath = pathFor(borders);
    gratPath = pathFor(graticule);

    // d3-geo schneidet Linien an der Datumsgrenze (180°) automatisch in Teile,
    // dadurch entstehen keine waagerechten Streifen quer über die Karte.
    cablePath = new Path2D();
    cablePathShort = new Path2D();
    const toLong = d3.geoPath(projection, cablePath);
    const toShort = d3.geoPath(projection, cablePathShort);
    for (const f of cables.features) (isLongCable(f) ? toLong : toShort)(f);

    setDefaultView();
    if (keepCenter) {
      const c = projection(keepCenter);
      view.k = Math.max(keepZoom, MIN_ZOOM);
      view.x = w / 2 - c[0] * view.k;
      view.y = h / 2 - c[1] * view.k;
      atDefault = false;
      clampView();
    }
  }

  // Route ins Bild holen, falls sie nicht ganz sichtbar ist (z. B. auf schmalen Bildschirmen)
  function fitRoute() {
    if (!route || !width) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const piece of route.pieces) {
      for (const c of piece.coords) {
        const p = projection(c);
        if (!p) continue;
        x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
    }
    if (!isFinite(x0)) return;
    const visible = x0 * view.k + view.x >= FIT_MARGIN && x1 * view.k + view.x <= width - FIT_MARGIN &&
      y0 * view.k + view.y >= FIT_MARGIN && y1 * view.k + view.y <= height - FIT_MARGIN;
    if (visible) return;
    const k = Math.min((width - 2 * FIT_MARGIN) / Math.max(x1 - x0, 1), (height - 2 * FIT_MARGIN) / Math.max(y1 - y0, 1), FIT_MAX_ZOOM);
    changeView(() => {
      view.k = Math.max(MIN_ZOOM, k);
      view.x = width / 2 - ((x0 + x1) / 2) * view.k;
      view.y = height / 2 - ((y0 + y1) / 2) * view.k;
    });
  }

  const showShortCables = () => zoomRel() >= SHORT_CABLE_ZOOM;

  // Länge laut Daten; fehlt sie, aus der Geometrie berechnen (Großkreis, Erdradius 6371 km)
  const longCache = new WeakMap();
  function isLongCable(f) {
    let v = longCache.get(f);
    if (v === undefined) {
      const km = f.properties.lengthKm != null ? f.properties.lengthKm : d3.geoLength(f) * 6371;
      v = km >= LONG_CABLE_KM;
      longCache.set(f, v);
    }
    return v;
  }

  const showLabels = () => zoomRel() >= (width >= LABEL_MIN_WIDTH ? LABEL_MIN_ZOOM_WIDE : LABEL_MIN_ZOOM);

  // ---- Route: eigene Zwischenschicht (nur bei neuer Route oder geänderter Ansicht neu gezeichnet) ----
  let route = null;
  let routeLayer = null;

  function newLayer() {
    const c = document.createElement("canvas");
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    return c;
  }

  function renderRouteLayer() {
    routeLayer = null;
    if (!route || !width) return;
    routeLayer = newLayer();
    const ctx = routeLayer.getContext("2d");
    const k = view.k;

    const solid = new Path2D();
    const dashed = new Path2D();
    for (const piece of route.pieces) {
      const target = piece.type === "land" ? dashed : solid;
      d3.geoPath(projection, target)({ type: "LineString", coordinates: piece.coords });
    }
    useViewTransform(ctx);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#22d3ee";
    ctx.shadowColor = "rgba(34, 211, 238, 0.9)";
    ctx.shadowBlur = 8;

    ctx.lineWidth = 2.5 / k;
    ctx.stroke(solid);

    ctx.setLineDash([5 / k, 4 / k]);
    ctx.lineWidth = 1.8 / k;
    ctx.stroke(dashed);
    ctx.setLineDash([]);

    // Start und Ziel (Bildschirmpixel)
    useScreenTransform(ctx);
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffffff";
    const ends = [route.from, route.to].map((id) => window.LFGraph.nodes.get(id));
    for (const n of ends) {
      const p = project([n.lon, n.lat]);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Wenn nicht ohnehin alle Städtenamen stehen, tragen Start und Ziel ein Namensschild
    if (!showLabels()) {
      ctx.shadowBlur = 0;
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      for (const n of ends) {
        const p = project([n.lon, n.lat]);
        const w = ctx.measureText(n.name).width;
        const x = p[0] + 8 + w > width ? p[0] - 8 - w : p[0] + 8;
        ctx.fillStyle = "#e6fbff";
        ctx.fillText(n.name, x, p[1] - 9);
      }
    }
  }

  function setRoute(r) {
    route = r;
    renderRouteLayer();
  }

  function drawRoute(ctx) {
    if (routeLayer) ctx.drawImage(routeLayer, 0, 0, width, height);
  }

  // ---- Gewähltes Kabel (hervorgehoben) ----
  let selectedId = null;
  let overlayLayer = null;

  function renderOverlayLayer() {
    overlayLayer = null;
    if (!width || !selectedId) return;
    overlayLayer = newLayer();
    const ctx = overlayLayer.getContext("2d");
    useViewTransform(ctx);
    ctx.lineJoin = "round";
    const p = new Path2D();
    const toPath = d3.geoPath(projection, p);
    for (const f of cables.features) if (f.properties.id === selectedId) toPath(f);
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 3 / view.k;
    ctx.shadowColor = "rgba(253, 230, 138, 0.8)";
    ctx.shadowBlur = 6;
    ctx.stroke(p);
  }

  function setSelectedCable(id) {
    selectedId = id;
    renderOverlayLayer();
  }

  function drawOverlay(ctx) {
    if (overlayLayer) ctx.drawImage(overlayLayer, 0, 0, width, height);
  }

  // ---- Treffer: Kabel und Städte unter dem Mauszeiger (nur bei Klick/Bewegung) ----
  function pickCable(x, y, maxPx) {
    const limit = maxPx || 8;
    let best = null;
    let bestD = limit;
    const shortVisible = showShortCables();
    for (const f of cables.features) {
      if (!shortVisible && !isLongCable(f)) continue;   // unsichtbare Kabel nicht anklickbar
      for (const ln of f.geometry.coordinates) {
        let prev = null;
        let prevLon = 0;
        for (const c of ln) {
          const p = project(c);
          if (p && prev && Math.abs(c[0] - prevLon) <= 180) {
            const d = distToSegment(x, y, prev, p);
            if (d < bestD) { bestD = d; best = f.properties.id; }
          }
          prev = p;
          prevLon = c[0];
        }
      }
    }
    return best;
  }

  function pickCity(x, y, maxPx) {
    let best = null;
    let bestD = maxPx || 10;
    for (const c of window.CITIES) {
      const p = project([c.lon, c.lat]);
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function distToSegment(px, py, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }

  // ---- Zeichnen ----
  function drawCities(ctx) {
    const labels = showLabels();
    ctx.font = "11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const r = width >= LABEL_MIN_WIDTH ? 2.5 : 1.8;
    for (const c of window.CITIES) {
      const p = project([c.lon, c.lat]);
      if (p[0] < -20 || p[0] > width + 20 || p[1] < -20 || p[1] > height + 20) continue;
      ctx.fillStyle = labels ? "#f5c26b" : "rgba(250, 205, 125, 0.9)";
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.fill();
      if (labels) {
        ctx.fillStyle = "rgba(255, 236, 200, 0.98)";
        ctx.fillText(c.name, p[0] + 6, p[1] - 6);
      }
    }
  }

  function drawLandings(ctx) {
    if (zoomRel() < LANDING_MIN_ZOOM) return;
    // Landepunkte als kleine Kreise gleicher Bildschirmgröße; nur die im Bild sichtbaren
    const r = width < 700 ? 1 : 1.4;
    ctx.beginPath();
    for (const f of landings.features) {
      const p = project(f.geometry.coordinates);
      if (!p || p[0] < -5 || p[0] > width + 5 || p[1] < -5 || p[1] > height + 5) continue;
      ctx.moveTo(p[0] + r, p[1]);
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    }
    ctx.fillStyle = "rgba(240, 246, 255, 0.8)";
    ctx.fill();
  }

  function drawBackground(ctx) {
    const k = view.k;
    useScreenTransform(ctx);
    ctx.clearRect(0, 0, width, height);

    useViewTransform(ctx);
    ctx.fillStyle = "#17284d";            // Ozean
    ctx.fill(spherePath);

    ctx.lineWidth = 0.5 / k;              // Gradnetz
    ctx.strokeStyle = "rgba(150, 180, 230, 0.14)";
    ctx.stroke(gratPath);

    ctx.fillStyle = "#2f4676";            // Länder
    ctx.fill(landPath);
    ctx.lineWidth = 0.5 / k;
    ctx.strokeStyle = "rgba(170, 200, 245, 0.45)";
    ctx.stroke(borderPath);

    ctx.lineWidth = 1 / k;                // Unterseekabel (gedämpft, 1 px; mit Route noch leiser)
    ctx.lineJoin = "round";
    ctx.strokeStyle = `rgba(70, 225, 248, ${route ? CABLE_ALPHA_ROUTE : CABLE_ALPHA})`;
    ctx.stroke(cablePath);
    if (showShortCables()) ctx.stroke(cablePathShort);

    useScreenTransform(ctx);              // Punkte und Beschriftung in Bildschirmpixeln
    if (window.LFLabels) LFLabels.draw(ctx, { project, k: zoomRel(), width, height });   // Meere, Länder
    drawLandings(ctx);
    drawCities(ctx);

    renderRouteLayer();
    renderOverlayLayer();
  }

  window.LFMap = {
    resize,
    drawBackground,
    project,
    invert,
    zoomAt,
    panBy,
    resetView,
    fitRoute,
    set onViewChange(fn) { onViewChange = fn; },
    get zoom() { return view.k; },
    get zoomRel() { return zoomRel(); },
    setRoute,
    drawRoute,
    setSelectedCable,
    drawOverlay,
    pickCable,
    pickCity,
    get dpr() { return dpr; },
    get width() { return width; },
    get height() { return height; },
  };
})();
