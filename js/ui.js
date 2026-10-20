// ui.js – Auswahl Von/Nach, Infoleiste mit Etappen, Kabel-Infokarte.
// Texte aus den Daten werden nur per textContent eingesetzt.
(function () {
  const fromSel = document.getElementById("from");
  const toSel = document.getElementById("to");
  const form = document.getElementById("controls");
  const hint = document.getElementById("hint");
  const result = document.getElementById("result");
  const totKm = document.getElementById("totKm");
  const totMs = document.getElementById("totMs");
  const stepsEl = document.getElementById("steps");
  const replayBtn = document.getElementById("replay");
  const disconnectBtn = document.getElementById("disconnect");
  const cableCard = document.getElementById("cableCard");
  const cableName = document.getElementById("cableName");
  const cableFacts = document.getElementById("cableFacts");

  const fmt = (n, d = 0) => n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
  let handlers = {};

  function fillSelect(sel, selectedId) {
    // alphabetisch nach Namen (deutsche Sortierung: Umlaute und Akzente beachtet)
    const sorted = [...window.CITIES].sort((a, b) => a.name.localeCompare(b.name, "de"));
    for (const c of sorted) {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.name;
      if (c.id === selectedId) o.selected = true;
      sel.appendChild(o);
    }
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function showRoute(route) {
    stepsEl.textContent = "";
    if (!route) {
      result.hidden = true;
      hint.hidden = false;
      hint.className = "hint error";
      hint.textContent = "Keine Verbindung.";
      return;
    }
    hint.hidden = true;
    result.hidden = false;
    totKm.textContent = fmt(route.km) + " km";
    totMs.textContent = fmt(route.ms, 1) + " ms";

    for (const s of route.steps) {
      const li = el("li", s.type === "land" ? "land" : "cable");
      if (s.type === "land") {
        li.appendChild(el("span", "kind", "Landweg (vereinfacht)"));
      } else {
        const kind = el("span", "kind", "Kabel ");
        const b = el("button", "link", s.cableName);
        b.type = "button";
        b.addEventListener("click", () => handlers.onSelectCable(s.cable));
        kind.appendChild(b);
        li.appendChild(kind);
      }
      li.appendChild(document.createTextNode(s.from + " → " + s.to + " "));
      li.appendChild(el("span", "km", "· " + fmt(s.km) + " km"));
      if (s.via && s.via.length) li.appendChild(el("div", "via", "über " + s.via.join(", ")));
      stepsEl.appendChild(li);
    }
  }

  function showNotice(text) {
    result.hidden = true;
    hint.hidden = false;
    hint.className = "hint";
    hint.textContent = text;
  }

  function fact(label, value) {
    cableFacts.appendChild(el("dt", null, label));
    cableFacts.appendChild(el("dd", null, value));
  }

  function showCable(feature) {
    if (!feature) { cableCard.hidden = true; return; }
    const p = feature.properties;
    cableCard.hidden = false;
    cableName.textContent = p.name;
    cableFacts.textContent = "";
    fact("Länge", p.length || "–");
    fact("Betrieb seit", p.rfs || "–");
    fact("Betreiber", p.owners || "–");
    const lpName = new Map(window.LANDINGS.features.map((f) => [f.properties.id, f.properties.name]));
    const names = p.landings.map((id) => lpName.get(id) || id);
    const shown = names.slice(0, 8).join("; ");
    fact("Landepunkte", names.length + (names.length ? ": " + shown + (names.length > 8 ? " … (+" + (names.length - 8) + ")" : "") : ""));
  }

  // Auswahl von außen setzen (Klick auf die Karte); null = unverändert lassen
  function setSelection(fromId, toId) {
    if (fromId) fromSel.value = fromId;
    if (toId) toSel.value = toId;
  }

  function setReplayEnabled(on) { replayBtn.disabled = !on; }
  function setDisconnectEnabled(on) { disconnectBtn.disabled = !on; }

  // Zurück in den Ausgangszustand: keine Verbindung, Panel zeigt wieder den Starthinweis
  const IDLE_HINT = hint.textContent;
  function showIdle() {
    stepsEl.textContent = "";
    result.hidden = true;
    hint.hidden = false;
    hint.className = "hint";
    hint.textContent = IDLE_HINT;
  }

  function init(h) {
    handlers = h;
    replayBtn.addEventListener("click", h.onReplay);
    fromSel.addEventListener("change", h.onSelectChange);
    toSel.addEventListener("change", h.onSelectChange);
    disconnectBtn.addEventListener("click", h.onDisconnect);
    fillSelect(fromSel, "new-york");
    fillSelect(toSel, "frankfurt");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (fromSel.value === toSel.value) {
        h.onConnect(null);
        showNotice("Start und Ziel sind gleich.");
        return;
      }
      h.onConnect("city:" + fromSel.value, "city:" + toSel.value);
    });
  }

  window.LFUI = { init, showRoute, showNotice, showIdle, setSelection, showCable, setReplayEnabled, setDisconnectEnabled };
})();
