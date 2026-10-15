/* Talking text: lines float over a scene as outlined pixel text, revealed word by word with a voice blip per syllable,
   inline effects ({slam}WHAT{/}, {whisper}, {shake}, {wave}, {drawl}, {em}, {fast}, {beat}, {heart}, {!}, {?}, {note}),
   and animals that answer in their own sounds. Scenes stage it through Tavern.talk; the sound itself is Sound.blip/critter. */
(function () {
  "use strict";
  const pref = (k, d) => (window.Settings ? Settings.get(k) : d);
  const calm = () => (window.Settings ? Settings.calm() : !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches));
  const reduced = () => (window.Settings ? Settings.reduced() : calm());
  const SPEED = { slow: 1.6, normal: 1, fast: 0.55, instant: 0 };
  const SYL = 0.085, GAP = 0.04;
  const PAUSE = { ",": 0.17, ";": 0.22, ":": 0.22, ".": 0.34, "!": 0.32, "?": 0.36, "-": 0.18, "—": 0.24, "…": 0.62 };
  const TAGS = new Set(["slam", "whisper", "shake", "wave", "drawl", "em", "fast", "act"]);
  const MARKS = new Set(["beat", "heart", "!", "?", "note"]);
  const VOWEL_SEMI = { i: 2, e: 1, y: 1, a: 0, o: -1, u: -2 };

  // ---------- markup: {tag}words{/} spans, {mark} singles, *stage directions*, and the obvious effects applied for you ----------
  function parse(text, fxOn) {
    const words = [], stack = [];
    let glue = false;
    const src = String(text || "").replace(/\*([^*]+)\*/g, "{act}$1{/}");
    const addText = (str) => {
      for (const b of str.split(/(\s+)/)) {
        if (!b) continue;
        if (/^\s+$/.test(b)) { glue = false; continue; }
        const part = { t: b, fx: stack.slice() }, w = words[words.length - 1];
        if (glue && w && w.parts) w.parts.push(part); else words.push({ parts: [part] });
        glue = true;
      }
    };
    const re = /\{(\/?)([a-z!?]*)\}/g;
    let last = 0, m;
    while ((m = re.exec(src))) {
      addText(src.slice(last, m.index));
      last = re.lastIndex;
      const [, close, name] = m;
      if (close) { stack.pop(); continue; }
      if (TAGS.has(name)) stack.push(name);
      else if (name === "beat") { words.push({ beat: true }); glue = false; }
      else if (MARKS.has(name)) { words.push({ icon: name }); glue = false; }
    }
    addText(src.slice(last));
    for (const w of words) if (w.parts) {
      for (const p of w.parts) if (!fxOn) p.fx = p.fx.filter((f) => f === "act");
      w.text = w.parts.map((p) => p.t).join("");
    }
    if (fxOn) auto(words);
    return words;
  }
  // an ALL-CAPS word in a sentence that ends in "!" slams; "Sooo" and "Hmmm" drawl
  function auto(words) {
    words.forEach((w, i) => {
      if (!w.parts || w.parts.length !== 1 || w.parts[0].fx.length) return;
      const letters = w.text.replace(/[^A-Za-z]/g, "");
      if (letters.length >= 2 && letters === letters.toUpperCase()) {
        let j = i;
        while (j < words.length - 1 && !(words[j].text && /[.!?…]$/.test(words[j].text))) j++;
        if (words[j].text && /!+$/.test(words[j].text)) { w.parts[0].fx = ["slam"]; return; }
      }
      if (letters.length >= 4 && /([a-z])\1\1/i.test(letters)) w.parts[0].fx = ["drawl"];
    });
  }
  function strip(text) { return String(text || "").replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim(); }
  const fxOf = (w) => new Set((w.parts || []).flatMap((p) => p.fx));
  function sylls(word) {
    const groups = word.toLowerCase().replace(/[^a-z0-9]/g, "").match(/[aeiouy]+|[0-9]{1,2}/g) || [];
    const v = groups.map((g) => (/[0-9]/.test(g) ? "e" : g[0]));
    return v.length ? v.slice(0, 5) : ["a"];
  }

  // ---------- voices: fixed per speaker, from their id; boldness and way of talking shade it ----------
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rngOf(seed) { let s = seed || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const STYLE = { anxious: { jit: 1.4, rate: 1.08, pitch: 1 }, curt: { rate: 1.15, pitch: -0.5 }, pompous: { pitch: -2, rate: 0.86, vib: 0.4 }, poetic: { rate: 0.9, vib: 0.5 },
    bubbly: { pitch: 2, rate: 1.06 }, cruel: { pitch: -1.5, rate: 0.95 }, esoteric: { rate: 0.92, vib: 0.8 }, mercenary: { rate: 1.05 }, direct: { rate: 1.04 }, earnest: {} };
  const TIMBRES = ["soft", "buzzy", "chirpy"];
  function voiceOf(a) {
    if (a.voice) return a.voice;
    const h = a.h || {}, id = h.id && h.id !== "barkeep" && !/^local/.test(h.id) ? h.id : a.name || "someone", r = rngOf(hash("voice:" + id));
    const v = { timbre: TIMBRES[hash("timbre:" + id) % 3], pitch: 56 + r() * 15, rate: 0.88 + r() * 0.3, formant: 0.88 + r() * 0.3, jit: 0.3 + r() * 0.5, vib: 0 };
    if (h.look && h.look.child) v.pitch += 6;
    const vox = h.vox || {}, bold = typeof vox.bold === "number" ? vox.bold : 0, sty = STYLE[vox.style] || {};
    v.pitch += -bold * 3.5 + (sty.pitch || 0);
    v.rate *= (1 + bold * 0.12) * (sty.rate || 1);
    v.jit = Math.min(2.4, v.jit + Math.max(0, -bold) * 1.2 + (sty.jit || 0));
    v.vib += sty.vib || 0;
    if (a.keeper && !h.vox) v.pitch -= 3;
    a.voice = v;
    return v;
  }

  // ---------- animals: the sound first, what they're doing after it in small type ----------
  const HORSE = { acts: [[/snort/, "Hrrmf!"], [/whinn|moon/, "Hii-hi-hi!"], [/stamp|hoof/, "{!}"], [/sigh/, "Hhhuff..."], [/apple|steal|mouthful|ration|munch|hay|eat/, "nom nom"], [/roll|nap/, "hrrm~"]],
    pat: "Hrrmf! {heart}", say: "Hrrmf.", calls: [[/hrr|huff|hmf/, "snort"], [/hii|hi-/, "whinny"], [/nom/, "chew"]], call: "snort" };
  const BEASTS = {
    dog: { acts: [[/snore/, "zzz..."], [/sniff/, "snf snf {?}"], [/tail|wag/, "Wuf! {heart}"], [/growl/, "grrr..."]], pat: "Wuf! {heart}", say: "Wuf!",
      calls: [[/wuf|woof|arf|bark/, "bark"], [/snf/, "sniff"], [/zzz/, "snore"], [/grr/, "growl"]], call: "bark" },
    wolf: { acts: [[/growl/, "grrr..."], [/howl/, "{drawl}Awooo{/}!"], [/ears/, "{!}"], [/circle|lies down/, "hmf."]], pat: "rrf. {heart}", say: "Rrf.",
      calls: [[/awoo/, "howl"], [/grr/, "growl"], [/rrf|hmf/, "bark"]], call: "growl", pitch: 0.7 },
    cat: { acts: [[/purr/, "prrrr {heart}"], [/ignore/, "..."], [/knead/, "mrrp {heart}"]], pat: "Mrrp? {heart}", say: "Mrrp.",
      calls: [[/prr/, "purr"], [/mrr/, "mrrp"], [/mew|meow|mrow/, "mew"]], call: "mrrp" },
    lizard: { acts: [[/blink/, "... {beat}tk."], [/tongue/, "tsk. tsk."], [/bask/, "{whisper}hhh...{/}"], [/still/, "..."]], pat: "... tk. {heart}", say: "tk... tk.",
      calls: [[/tk|tsk|\.\.\./, "click"], [/hhh/, "lick"]], call: "click", slow: 2.2 },
    falcon: { acts: [[/kek/, "Kek-kek!"], [/rustle/, "fff..."], [/preen/, "krr."], [/eye/, "{?}"]], pat: "Kek! {heart}", say: "Kek!",
      calls: [[/kek/, "kek"], [/fff|krr/, "rustle"], [/skree/, "skree"]], call: "kek" },
    eagle: { acts: [[/screech/, "SKREE!"], [/preen/, "krr."], [/watch/, "{?}"]], pat: "Krr. {heart}", say: "Skree!", calls: [[/skree/, "skree"], [/krr/, "rustle"]], call: "skree", pitch: 0.8 },
    horse: HORSE, pony: HORSE, courser: HORSE, destrier: HORSE,
    donkey: { acts: [[/haw/, "Hee-HAW!"], [/refuse/, "Hmf."], [/thistle|eat/, "nom."]], pat: "Hee-haw! {heart}", say: "Hee-haw!", calls: [[/hee|haw/, "heehaw"], [/hmf/, "snort"], [/nom/, "chew"]], call: "heehaw" },
    ox: { acts: [[/chew/, "nom... nom..."], [/lies|hill/, "{drawl}Mrrooo{/}..."]], pat: "Mrrooo. {heart}", say: "Mrrooo.", calls: [[/mrr|moo/, "moo"], [/nom/, "chew"]], call: "moo" },
    camel: { acts: [[/spit/, "Ptoo!"], [/rain/, "Hrrrnn..."], [/groan/, "{drawl}Hrrrnnn{/}..."]], pat: "Hrrnn. {heart}", say: "Hrrnn.", calls: [[/hrr/, "groan"], [/ptoo/, "snort"]], call: "groan" },
    unicorn: { acts: [[/glow|horn|star/, "{wave}hmmm~{/}"]], pat: "{wave}hmm~{/} {heart}", say: "{wave}hmm~{/}", calls: [[/hm/, "chime"]], call: "chime" },
    skeleton: { acts: [[/rattle/, "clk-clk..."], [/still/, "..."], [/glow/, "{shake}clk{/}"]], pat: "clk. {heart}", say: "clk-clk.", calls: [[/clk|\.\.\./, "rattle"]], call: "rattle" },
  };
  function beastOf(a) {
    const kind = a.pet === true ? a.kind : a.beast;
    return kind ? Object.assign({ kind }, BEASTS[kind] || BEASTS.dog) : null;
  }
  function beastLine(b, text) {
    const t = String(text || "");
    if (!/^\s*\*/.test(t)) return t;
    const low = t.toLowerCase(), hit = b.acts.find(([re]) => re.test(low));
    return `${hit ? hit[1] : b.say} ${t}`;
  }
  function pat(a) { const b = beastOf(a); return b ? b.pat : "{heart}"; }

  // ---------- pixel icons that pop inside a line ----------
  const ICON_ROWS = {
    heart: [".rr.rr.", "rwrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."],
    note: ["...gg", "..ggg", "..g.g", "..g..", "ggg..", "ggg..", ".g..."],
  };
  const ICON_PAL = { r: "#e8566a", w: "#ffd0d0", g: "#ffe08a" };
  const iconCache = {};
  function iconUrl(name) {
    if (iconCache[name]) return iconCache[name];
    const rows = ICON_ROWS[name], cv = document.createElement("canvas");
    cv.width = rows[0].length + 2; cv.height = rows.length + 2;
    const c = cv.getContext("2d");
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== ".") { c.fillStyle = "#1a0f08"; c.fillRect(x + 1 + dx, y + 1 + dy, 1, 1); } });
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== ".") { c.fillStyle = ICON_PAL[row[x]]; c.fillRect(x + 1, y + 1, 1, 1); } });
    return (iconCache[name] = cv.toDataURL());
  }

  // ---------- timing: when each word lands and what it sounds like ----------
  function plan(words, v, beast) {
    const k = SPEED[pref("speed", "normal")] == null ? 1 : SPEED[pref("speed", "normal")], slow = beast ? beast.slow || 1 : 1;
    const rate = beast ? 1 / slow : v.rate;
    const ends = words.map((w) => (w.text && /[!?]+$/.test(w.text) ? w.text.slice(-1) : null));
    const lineEnd = [...ends].reverse().find((e) => e) || null;
    let t = 0;
    return words.map((w, i) => {
      const at = t;
      let dur, pause = 0;
      if (w.beat) dur = 0.5;
      else if (w.icon) dur = 0.28;
      else {
        const fx = fxOf(w), letters = w.text.replace(/[^A-Za-z0-9]/g, "").length, n = sylls(w.text).length;
        dur = (n * SYL) / rate;
        if (fx.has("fast")) dur *= 0.55;
        if (fx.has("whisper")) dur *= 1.3;
        if (fx.has("drawl")) dur = Math.max(0.45, letters * 0.09) * slow;
        if (fx.has("slam")) dur = 0.42;
        if (fx.has("act")) dur = Math.max(0.08, dur * 0.6);
        const tail = w.text.match(/(\.\.\.|…|[,;:.!?—-])["')\]]*$/);
        if (tail) pause = PAUSE[tail[1] === "..." ? "…" : tail[1]] || 0;
        if (fx.has("fast")) pause *= 0.4;
        pause *= slow;
      }
      t += (dur + pause + GAP) * k;
      return { at, dur: dur * k, end: t, q: i === words.length - 1 ? lineEnd : null };
    });
  }
  function voice(w, p, i, n, v, beast, line) {
    if (!window.Sound || !Sound.talking || !w.parts) return;
    const fx = fxOf(w), instant = p.dur === 0;
    if (beast) {
      if (fx.has("act")) return;
      const low = w.text.toLowerCase(), hit = beast.calls.find(([re]) => re.test(low));
      Sound.critter(hit ? hit[1] : beast.call, { vol: fx.has("slam") ? 1.6 : fx.has("whisper") ? 0.5 : 1, pitch: (beast.pitch || 1) * line.pitch });
      return;
    }
    const vs = sylls(w.text), loud = fx.has("slam") ? 1.9 : fx.has("whisper") ? 0.42 : fx.has("act") ? 0.5 : fx.has("em") ? 1.15 : 1;
    const contour = -1.6 * (i / Math.max(1, n - 1)) + (line.bang ? 1.2 : 0);
    if (fx.has("drawl")) { Sound.blip(v, { len: Math.max(0.2, p.dur * 0.85), vowel: vs[0], semi: contour + 1, bend: -3, vol: loud }); return; }
    const each = instant ? 0.07 : Math.max(0.045, p.dur / vs.length);
    const count = instant ? 1 : vs.length;
    for (let s = 0; s < count; s++) {
      const last = p.q === "?" && s === count - 1;
      const swing = fx.has("wave") ? (s % 2 ? 2 : -1) : 0, shaky = fx.has("shake") ? (Math.random() - 0.5) * 4 : 0;
      Sound.blip(v, { at: s * each, len: each * (fx.has("slam") ? 1.4 : 0.72), vowel: vs[s], cons: s === 0 && /^[^aeiouy]/i.test(w.text.replace(/[^A-Za-z]/g, "")),
        semi: VOWEL_SEMI[vs[s]] + contour + swing + shaky + (Math.random() - 0.5) * 2 * v.jit + (fx.has("slam") ? -1.5 : 0) + (last ? 2 : 0),
        bend: last ? 4 : fx.has("shake") ? 1 : 0, vol: loud, whisper: fx.has("whisper") });
    }
  }

  // ---------- the lines on screen ----------
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  const rgb = (c) => (/^#[0-9a-f]{6}$/i.test(c || "") ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : null);
  // a speaker's colour, lifted toward cream so it reads on a dark outline
  function tint(a) {
    if (a.keeper) return "#ecc56a";
    if (a.pet === true || a.beast) return "#e8d6ae";
    const c = rgb(((a.h || {}).look || {}).fav);
    if (!c) return "#ecc56a";
    return "#" + c.map((v) => Math.round(v + (255 - v) * 0.5).toString(16).padStart(2, "0")).join("");
  }
  function wordEl(w) {
    if (w.beat) return null;
    if (w.icon) {
      const s = el("span", "sw sw-icon");
      if (ICON_ROWS[w.icon]) { const img = el("img"); img.src = iconUrl(w.icon); img.alt = w.icon; s.append(img); }
      else { s.textContent = w.icon; s.classList.add(w.icon === "!" ? "bang" : "huh"); }
      return s;
    }
    const s = el("span", "sw");
    for (const p of w.parts) {
      const ps = el("span", p.fx.map((f) => "fx-" + f).join(" ") || null);
      if (p.fx.some((f) => f === "shake" || f === "wave" || f === "drawl")) [...p.t].forEach((ch, i) => { const c = el("i", null, ch); c.style.setProperty("--i", i); ps.append(c); });
      else ps.textContent = p.t;
      s.append(ps);
    }
    return s;
  }

  // wrap: the scene's box (position: relative); anchor(a) -> [x, y] in CSS px, the top of the speaker's head
  function layer(wrap, anchor) {
    const box = el("div", "speech");
    wrap.appendChild(box);
    const lines = [];
    let raf = 0, onscreen = true;
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => { onscreen = es[es.length - 1].isIntersecting; if (!wrap.isConnected) io.disconnect(); });
      io.observe(wrap);
    }
    const mood = () => { box.classList.toggle("still", reduced()); box.classList.toggle("calm", calm()); };
    mood();
    const unwatch = window.Settings ? Settings.watch((keys) => {
      if (!wrap.isConnected) { unwatch(); return; }
      mood();
      // leaving static mode lets lines that were pinned for good fade like any other
      if (!calm()) for (const l of lines) if (l.hold === Infinity) { l.hold = 2.5; l.t0 = clock() - l.plan[l.plan.length - 1].end; wake(); }
    }) : null;
    const clock = () => performance.now() / 1000;
    function drop(l) { const i = lines.indexOf(l); if (i >= 0) lines.splice(i, 1); l.node.remove(); if (l.done) { const d = l.done; l.done = null; d(); } }
    // frames only while words are landing; waits between (the line's hold, the pause before done) are plain timeouts
    let timer = 0, placed = false, tries = 0;
    function frame() {
      raf = 0;
      if (timer) { clearTimeout(timer); timer = 0; }
      // a scene says its first line before it is on the page; wait for it, but let go of one that has left
      if (!wrap.isConnected) { if (placed || ++tries > 50) lines.length = 0; else timer = setTimeout(frame, 120); return; }
      if (!placed) { placed = true; T.place(); }
      const now = clock();
      let soon = Infinity;
      for (const l of lines.slice()) {
        const el2 = now - l.t0, audible = onscreen && !document.hidden;
        while (l.next < l.words.length && l.plan[l.next].at <= el2) {
          const i = l.next++, w = l.words[i], node = l.nodes[i];
          if (node) node.classList.add("on");
          if (audible && !l.mute) voice(w, l.plan[i], i, l.words.length, l.v, l.beast, l);
          if (node && fxOf(w).has("slam") && !reduced()) { l.node.classList.remove("thud"); void l.node.offsetWidth; l.node.classList.add("thud"); }
        }
        const end = l.plan.length ? l.plan[l.plan.length - 1].end : 0;
        if (l.next >= l.words.length && l.done && el2 >= end + 0.35) { const d = l.done; l.done = null; d(); }
        if (el2 >= end + l.hold) {
          if (!l.out) { l.out = el2; l.node.classList.add("out"); }
          if (el2 - l.out > 0.3) { drop(l); continue; }
        }
        if (l.next < l.words.length) soon = Math.min(soon, Math.max(0, l.plan[l.next].at - el2));
        else {
          if (l.done) soon = Math.min(soon, end + 0.35 - el2);
          soon = Math.min(soon, l.out ? l.out + 0.32 - el2 : end + l.hold - el2);
        }
      }
      if (soon <= 0.02) raf = requestAnimationFrame(frame);
      else if (soon < Infinity) timer = setTimeout(wake, soon * 1000);
    }
    function wake() { if (!raf) raf = requestAnimationFrame(frame); }
    const T = {
      now: 0,
      // secs >= 999 pins the line until the next one (a still scene); done() runs once it has finished being said
      say(a, text, secs, done) {
        if (!text) { if (done) done(); return; }
        for (const l of lines.slice()) if (l.a === a) drop(l);
        while (lines.length >= 3) drop(lines[0]);
        const beast = beastOf(a), v = voiceOf(a), fxOn = pref("effects", true);
        const words = parse(beast ? beastLine(beast, text) : text, fxOn);
        const node = el("div", "say" + (a.keeper ? " keeper" : "") + (beast ? " pet" : "") + (a.focus ? " focus" : ""));
        node.style.setProperty("--c", tint(a));
        const who = el("b", "say-who", a.name || "");
        const txt = el("span", "say-txt"), nodes = words.map(wordEl);
        nodes.forEach((n, i) => { if (n) { if (txt.childNodes.length) txt.append(" "); txt.append(n); } else nodes[i] = null; });
        node.append(who, txt);
        box.append(node);
        const p = plan(words, v, beast), n = words.filter((w) => w.parts).length;
        const pinned = secs >= 999 || (secs == null && calm());
        const l = { a, node, words, nodes, plan: p, v, beast, next: 0, t0: clock(), done: done || null, pitch: beast ? 0.85 + (hash(a.name || "") % 40) / 100 : 1,
          bang: /!\s*$/.test(strip(text)), hold: pinned ? Infinity : Math.min(4.8, Math.max(1.8, 1.1 + n * 0.14)) };
        lines.push(l);
        T.place();
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        frame();
      },
      // a sung line: each word lands at its time in seconds from now (the song's own timing, music.js), with no talking blips;
      // o: { cls (a second outline colour for sing-alongs), color, hold (secs after the last word), from (secs already elapsed), who }
      sing(a, text, times, o) {
        const op = o || {};
        if (!text) return;
        for (const l of lines.slice()) if (l.a === a) drop(l);
        while (lines.length >= 3) drop(lines[0]);
        const words = parse(text, pref("effects", true));
        const node = el("div", "say sung" + (op.cls ? " " + op.cls : ""));
        node.style.setProperty("--c", op.color || tint(a));
        const txt = el("span", "say-txt"), nodes = words.map(wordEl);
        nodes.forEach((n, i) => { if (n) { if (txt.childNodes.length) txt.append(" "); txt.append(n); } else nodes[i] = null; });
        node.append(el("b", "say-who", op.who === false ? "" : a.name || ""), txt);
        box.append(node);
        let k = 0, last = 0;
        const p = words.map((w) => { const at = w.parts ? (last = times[Math.min(k++, times.length - 1)] || last) : last; return { at, dur: 0.12, end: at + 0.12 }; });
        const pinned = op.hold >= 999 || (op.hold == null && calm());
        lines.push({ a, node, words, nodes, plan: p, v: null, beast: null, next: 0, t0: clock() - (op.from || 0), done: null, pitch: 1, bang: false, mute: true,
          hold: pinned ? Infinity : op.hold == null ? 2.5 : op.hold });
        T.place();
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        frame();
      },
      speaking(a) { return lines.some((l) => l.a === a && !l.out); },
      get count() { return lines.length; },
      prune() {},
      clear() { for (const l of lines.slice()) drop(l); },
      place() {
        const cw = wrap.clientWidth, rects = [];
        for (const l of lines) {
          const [x, y] = anchor(l.a), w = l.node.offsetWidth, h = l.node.offsetHeight;
          const left = Math.max(w / 2 + 3, Math.min(cw - w / 2 - 3, x));
          rects.push({ l, x: left, b: Math.max(h + 3, y), w, h, px: x });
        }
        // a newer line keeps its place; older ones step up out of its way
        for (let i = rects.length - 2; i >= 0; i--) for (let j = i + 1; j < rects.length; j++) {
          const A = rects[i], B = rects[j];
          if (Math.abs(A.x - B.x) < (A.w + B.w) / 2 && A.b > B.b - B.h - 2 && A.b - A.h < B.b) A.b = Math.max(A.h + 3, B.b - B.h - 2);
        }
        for (const r of rects) {
          r.l.node.style.left = `${Math.round(r.x)}px`;
          r.l.node.style.top = `${Math.round(r.b)}px`;
          r.l.node.style.setProperty("--tip", `${Math.round(Math.max(-r.w / 2 + 6, Math.min(r.w / 2 - 6, r.px - r.x)))}px`);
        }
      },
    };
    const onResize = () => { if (wrap.isConnected) T.place(); else window.removeEventListener("resize", onResize); };
    window.addEventListener("resize", onResize);
    return T;
  }

  window.Speech = { layer, parse, strip, voiceOf, beastOf, pat, plan, BEASTS };
})();
