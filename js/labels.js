// labels.js – Namen von Ozeanen/Meeren und Ländern auf der Karte.
//  Meere: feste Positionen (data/names.js), je nach Zoom ein- und ausgeblendet.
//  Länder: ein Name erscheint nur, wenn das ganze Textfeld im Landesumriss liegt
//          (größter Landesteil, Test in Bildschirmpixeln) und keine Stadt verdeckt.
(function () {
  const COUNTRY_MIN_ZOOM = 1.5;   // darunter bleibt die Karte ruhig, auch wenn große Länder passen würden
  const OCEAN_MAX_ZOOM = 3;       // Ozeannamen nur in der Übersicht
  const SEA_MAX_ZOOM = 10;
  const COUNTRY_FONT = "600 11px system-ui, sans-serif";
  const PAD = 6;                  // Luft um den Text im Landesumriss (Pixel)
  const TEXT_H = 13;
  const GRID = 5;                 // Kandidatenpunkte pro Achse innerhalb des Landesrahmens

  const names = window.COUNTRY_NAMES_DE || {};
  const land = topojson.feature(window.COUNTRIES, window.COUNTRIES.objects.countries);

  // Pro Land: größter Landesteil (Außenring), ohne Teile über die Datumsgrenze
  const countries = [];
  for (const f of land.features) {
    const name = names[f.properties.name];
    if (!name) continue;
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    let best = null;
    for (const rings of polys) {
      const poly = { type: "Polygon", coordinates: rings };
      const b = d3.geoBounds(poly);
      if (b[0][0] > b[1][0]) continue;
      const area = d3.geoArea(poly);
      if (!best || area > best.area) best = { area, ring: rings[0], bounds: b, centroid: d3.geoCentroid(poly) };
    }
    if (best) countries.push({ name, ...best });
  }

  function inside(ring, x, y) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }

  // Liegt das Rechteck (Mitte cx, cy; Breite w, Höhe h) ganz im Ring? Ecken, Kantenmitten und Mitte prüfen.
  function fits(ring, cx, cy, w, h) {
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const y0 = cy - h / 2;
    const y1 = cy + h / 2;
    const pts = [[x0, y0], [cx, y0], [x1, y0], [x0, cy], [cx, cy], [x1, cy], [x0, y1], [cx, y1], [x1, y1]];
    for (const [x, y] of pts) if (!inside(ring, x, y)) return false;
    return true;
  }

  function drawSeas(ctx, env) {
    const k = env.k;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const [name, lon, lat, minZoom, kind] of window.SEA_LABELS || []) {
      const ocean = kind === "ozean";
      if (k < minZoom || k > (ocean ? OCEAN_MAX_ZOOM : SEA_MAX_ZOOM)) continue;
      const p = env.project([lon, lat]);
      if (!p || p[0] < -80 || p[0] > env.width + 80 || p[1] < -20 || p[1] > env.height + 20) continue;
      if (ocean) {
        ctx.font = "italic 600 14px system-ui, sans-serif";
        ctx.letterSpacing = "5px";
        const text = name.toUpperCase();
        if (p[0] - ctx.measureText(text).width / 2 < 0 || p[0] + ctx.measureText(text).width / 2 > env.width) continue; // nichts abschneiden
        ctx.fillStyle = "rgba(190, 215, 255, 0.5)";
        ctx.fillText(text, p[0], p[1]);
      } else {
        ctx.font = "italic 11px system-ui, sans-serif";
        ctx.letterSpacing = "1px";
        if (p[0] - ctx.measureText(name).width / 2 < 0 || p[0] + ctx.measureText(name).width / 2 > env.width) continue;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(23, 40, 77, 0.85)";
        ctx.strokeText(name, p[0], p[1]);
        ctx.fillStyle = "rgba(195, 220, 255, 0.85)";
        ctx.fillText(name, p[0], p[1]);
      }
    }
    ctx.letterSpacing = "0px";
  }

  function drawCountries(ctx, env) {
    if (env.k < COUNTRY_MIN_ZOOM) return;
    ctx.font = COUNTRY_FONT;
    ctx.letterSpacing = "0.5px";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(225, 235, 255, 0.7)";

    // Städte (Bildschirmposition) – ihr Punkt und Name soll nicht überdeckt werden
    const cityPts = [];
    for (const c of window.CITIES || []) {
      const p = env.project([c.lon, c.lat]);
      if (p) cityPts.push(p);
    }

    for (const c of countries) {
      // Rahmen des Landes auf dem Bildschirm; zu klein oder außerhalb -> überspringen
      const a = env.project([c.bounds[0][0], c.bounds[1][1]]);
      const b = env.project([c.bounds[1][0], c.bounds[0][1]]);
      if (!a || !b) continue;
      const bx0 = a[0];
      const bx1 = b[0];
      const by0 = a[1];
      const by1 = b[1];
      if (bx1 < 0 || bx0 > env.width || by1 < 0 || by0 > env.height) continue;
      const textW = ctx.measureText(c.name).width + PAD * 2;
      if (bx1 - bx0 < textW || by1 - by0 < TEXT_H + PAD * 2) continue;

      const ring = [];
      for (const ll of c.ring) {
        const p = env.project(ll);
        if (p) ring.push(p);
      }
      if (ring.length < 3) continue;

      // Kandidaten: Schwerpunkt zuerst, dann ein Raster im Rahmen, nach Abstand zum Schwerpunkt sortiert
      const cen = env.project(c.centroid);
      const cand = [];
      if (cen) cand.push(cen);
      for (let i = 0; i < GRID; i++) {
        for (let j = 0; j < GRID; j++) {
          cand.push([bx0 + ((i + 0.5) / GRID) * (bx1 - bx0), by0 + ((j + 0.5) / GRID) * (by1 - by0)]);
        }
      }
      if (cen) cand.sort((p, q) => Math.hypot(p[0] - cen[0], p[1] - cen[1]) - Math.hypot(q[0] - cen[0], q[1] - cen[1]));

      for (const [x, y] of cand) {
        if (x - textW / 2 < 0 || x + textW / 2 > env.width || y - TEXT_H / 2 < 0 || y + TEXT_H / 2 > env.height) continue;
        if (!fits(ring, x, y, textW, TEXT_H + PAD)) continue;
        // Stadt = Punkt plus Namensfeld rechts oberhalb (grobes Rechteck)
        const hitCity = cityPts.some(
          (p) => x + textW / 2 > p[0] - 6 && x - textW / 2 < p[0] + 72 && y + TEXT_H / 2 > p[1] - 15 && y - TEXT_H / 2 < p[1] + 6,
        );
        if (hitCity) continue;
        ctx.fillText(c.name, x, y);
        break;
      }
    }
    ctx.letterSpacing = "0px";
  }

  // env: { project, k, width, height } – Zeichnen in Bildschirmpixeln
  function draw(ctx, env) {
    ctx.save();
    drawSeas(ctx, env);
    drawCountries(ctx, env);
    ctx.restore();
  }

  window.LFLabels = { draw, countryCount: countries.length };
})();
