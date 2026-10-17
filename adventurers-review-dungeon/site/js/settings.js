/* Site settings kept in localStorage (works from file://): sound, talking text, motion and static scenes, with the panel that edits them. */
(function () {
  "use strict";
  const KEY = "al.settings", OLD = "al.sound";
  const DEFAULTS = { sound: true, master: 0.7, amb: 0.5, music: 0.7, sfx: 0.6, voices: true, voice: 0.7, speed: "normal", effects: true, motion: "auto", still: false };
  const CHOICES = { speed: ["slow", "normal", "fast", "instant"], motion: ["auto", "reduce", "full"] };
  const watchers = new Set();
  const osMotion = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  function clean(raw) {
    const out = Object.assign({}, DEFAULTS);
    for (const k of Object.keys(DEFAULTS)) {
      const v = raw ? raw[k] : undefined, d = DEFAULTS[k];
      if (typeof d === "boolean" && typeof v === "boolean") out[k] = v;
      else if (typeof d === "number" && typeof v === "number" && isFinite(v)) out[k] = Math.max(0, Math.min(1, v));
      else if (CHOICES[k] && CHOICES[k].includes(v)) out[k] = v;
    }
    return out;
  }
  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return clean(JSON.parse(raw));
      // the sound panel used to keep its own store; carry its mute and sliders over once
      const old = JSON.parse(localStorage.getItem(OLD) || "null");
      if (old) return clean({ sound: old.on, master: old.master, amb: old.amb, music: old.music, sfx: old.sfx });
    } catch (e) { /* storage unavailable or corrupt */ }
    return clean(null);
  }
  let prefs = read();
  function write() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* storage unavailable */ } }
  function notify(keys) { for (const fn of Array.from(watchers)) { try { fn(keys, prefs); } catch (e) { console.error(e); } } }

  function get(k) { return prefs[k]; }
  function set(k, v) {
    const patch = typeof k === "object" ? k : { [k]: v }, next = clean(Object.assign({}, prefs, patch));
    const changed = Object.keys(next).filter((x) => next[x] !== prefs[x]);
    if (!changed.length) return;
    prefs = next;
    write();
    notify(changed);
  }
  function reset() { set(Object.assign({}, DEFAULTS)); }
  function watch(fn) { watchers.add(fn); return () => watchers.delete(fn); }
  const reduced = () => prefs.motion === "reduce" || (prefs.motion === "auto" && !!(osMotion && osMotion.matches));
  // nothing ambient moves: static scenes, or reduced motion
  const calm = () => prefs.still || reduced();

  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    const was = prefs;
    prefs = read();
    const changed = Object.keys(prefs).filter((x) => prefs[x] !== was[x]);
    if (changed.length) notify(changed);
  });
  if (osMotion) {
    const os = () => { if (prefs.motion === "auto") notify(["motion"]); };
    if (osMotion.addEventListener) osMotion.addEventListener("change", os); else if (osMotion.addListener) osMotion.addListener(os);
  }

  // ---------- the panel: the Settings page and the demo share it ----------
  function el(tag, cls, ...kids) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    for (const k of kids) if (k != null) n.append(k);
    return n;
  }
  function panel() {
    const box = el("div", "set-box"), sync = [];
    const row = (label, hint, ctl) => el("div", "set-row", el("div", "set-lab", el("b", null, label), hint ? el("span", "set-hint", hint) : null), ctl);
    const toggle = (key) => {
      const b = el("button", "set-tog");
      b.type = "button";
      b.onclick = () => set(key, !prefs[key]);
      sync.push(() => { b.setAttribute("aria-pressed", String(prefs[key])); b.textContent = prefs[key] ? "On" : "Off"; });
      return b;
    };
    const slider = (key, label) => {
      const inp = el("input");
      inp.type = "range"; inp.min = 0; inp.max = 1; inp.step = 0.05;
      inp.setAttribute("aria-label", label);
      inp.oninput = () => set(key, +inp.value);
      sync.push(() => { if (+inp.value !== prefs[key]) inp.value = prefs[key]; });
      return el("span", "set-slide", inp);
    };
    const choice = (key, names) => {
      const g = el("div", "set-seg");
      g.setAttribute("role", "group");
      for (const v of CHOICES[key]) {
        const b = el("button", null, names[v]);
        b.type = "button";
        b.onclick = () => set(key, v);
        sync.push(() => b.setAttribute("aria-pressed", String(prefs[key] === v)));
        g.append(b);
      }
      return g;
    };
    const os = osMotion && osMotion.matches ? "on" : "off";
    box.append(
      el("h3", "set-head", "Sound"),
      row("Sound", "Everything: music, ambience, effects and voices.", toggle("sound")),
      row("Volume", null, slider("master", "Volume")),
      row("Ambience", null, slider("amb", "Ambience")),
      row("Music", null, slider("music", "Music")),
      row("Effects", null, slider("sfx", "Effects")),
      el("h3", "set-head", "Talking"),
      row("Talking sounds", "A little voice for every word, like a game character.", toggle("voices")),
      row("Voice volume", null, slider("voice", "Voice volume")),
      row("Text speed", null, choice("speed", { slow: "Slow", normal: "Normal", fast: "Fast", instant: "Instant" })),
      row("Text effects", "Shouts, whispers, shaking and wavy words.", toggle("effects")),
      el("h3", "set-head", "Motion"),
      row("Reduced motion", `Your device says ${os}.`, choice("motion", { auto: "Device", reduce: "On", full: "Off" })),
      row("Static scenes", "Towns, wilds, camps and taverns hold still as one picture. Easier on old machines and batteries.", toggle("still")),
    );
    const rs = el("button", "btn small set-reset", "Reset to defaults");
    rs.type = "button";
    rs.onclick = reset;
    box.append(el("div", "set-foot", rs));
    const refresh = () => { if (!box.isConnected && box.dataset.shown) { off(); return; } for (const f of sync) f(); };
    const off = watch(refresh);
    refresh();
    requestAnimationFrame(() => { box.dataset.shown = "1"; });
    return box;
  }

  window.Settings = { get, set, reset, watch, reduced, calm, still: () => prefs.still, all: () => Object.assign({}, prefs), panel, DEFAULTS, KEY };
})();
