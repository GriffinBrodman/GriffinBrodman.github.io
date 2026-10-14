/* Sound, all synthesised with WebAudio (no files): page ambience, UI and fight effects, and the bard,
   who sings the league's songs in a K.K.-style syllable voice over a plucked lute. */
(function () {
  "use strict";
  const KEY = "al.sound";
  const prefs = (() => { try { return Object.assign({ on: true, master: 0.7, amb: 0.5, music: 0.7, sfx: 0.6 }, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return { on: true, master: 0.7, amb: 0.5, music: 0.7, sfx: 0.6 }; } })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* storage unavailable */ } };

  let ctx = null, master, bus = {}, noiseBuf = null, ambTimer = null, ambNodes = [], page = "", started = false, scenery = null;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master = ctx.createGain();
    master.connect(comp); comp.connect(ctx.destination);
    for (const k of ["amb", "music", "sfx"]) { bus[k] = ctx.createGain(); bus[k].connect(master); }
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    levels();
    return ctx;
  }
  function levels() {
    if (!ctx) return;
    master.gain.value = prefs.on ? prefs.master : 0;
    bus.amb.gain.value = prefs.amb * 0.5;
    bus.music.gain.value = prefs.music;
    bus.sfx.gain.value = prefs.sfx * 0.8;
  }
  function now() { return ctx.currentTime; }

  // ---------- instruments ----------
  const ksCache = {};
  function ksBuffer(midi) {
    if (ksCache[midi]) return ksCache[midi];
    const sr = ctx.sampleRate, n = Math.floor(sr * 1.6), out = ctx.createBuffer(1, n, sr), x = out.getChannelData(0);
    const period = Math.max(2, Math.round(sr / mtof(midi))), ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
    let p = 0;
    for (let i = 0; i < n; i++) {
      const nx = (p + 1) % period, v = (ring[p] + ring[nx]) * 0.4985;
      x[i] = ring[p]; ring[p] = v; p = nx;
    }
    return (ksCache[midi] = out);
  }
  function pluck(midi, t, vol, dest) {
    const src = ctx.createBufferSource(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    src.buffer = ksBuffer(Math.round(midi));
    lp.type = "lowpass"; lp.frequency.value = 3200;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    src.connect(lp); lp.connect(g); g.connect(dest || bus.music);
    src.start(t); src.stop(t + 1.6);
  }
  function bell(midi, t, vol, dest) {
    for (const [mult, a] of [[1, 1], [2.76, 0.45], [5.4, 0.2]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = mtof(midi) * mult;
      g.gain.setValueAtTime(vol * a, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 1.8 / mult);
      o.connect(g); g.connect(dest || bus.music);
      o.start(t); o.stop(t + 2);
    }
  }
  function pad(midi, t, dur, vol, dest) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    for (const det of [-7, 6]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = mtof(midi); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
    }
    lp.connect(g); g.connect(dest || bus.amb);
  }
  function noise(t, dur, vol, type, freq, dest, q) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = type || "lowpass"; f.frequency.value = freq || 800; if (q) f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || bus.sfx);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  function drum(t, vol, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(dest || bus.music); o.start(t); o.stop(t + 0.32);
    noise(t, 0.08, vol * 0.4, "lowpass", 1800, dest || bus.music);
  }
  // the bard's voice: a buzzy source through two vowel formants, with a little chirp up into each note
  const VOWELS = { a: [800, 1200], e: [450, 1950], i: [320, 2300], o: [520, 900], u: [360, 800], y: [320, 2300] };
  function sing(syl, midi, t, dur, vol, dest) {
    const v = (syl.toLowerCase().match(/[aeiouy]/) || ["a"])[0], [f1, f2] = VOWELS[v];
    const o = ctx.createOscillator(), g = ctx.createGain(), b1 = ctx.createBiquadFilter(), b2 = ctx.createBiquadFilter(), mix = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(mtof(midi - 1.2), t);
    o.frequency.exponentialRampToValueAtTime(mtof(midi), t + 0.04);
    b1.type = "bandpass"; b1.frequency.value = f1; b1.Q.value = 7;
    b2.type = "bandpass"; b2.frequency.value = f2; b2.Q.value = 9;
    mix.gain.value = 1;
    const len = Math.max(0.09, dur * 0.85);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.018);
    g.gain.setValueAtTime(vol * 0.8, t + len * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    o.connect(b1); o.connect(b2); b1.connect(mix); b2.connect(mix); mix.connect(g); g.connect(dest || bus.music);
    o.start(t); o.stop(t + len + 0.02);
    if (/^[^aeiouy]/i.test(syl)) noise(t, 0.03, vol * 0.25, "highpass", 3000, dest || bus.music);
  }

  // ---------- effects ----------
  const SFX = {
    click: () => { const t = now(); noise(t, 0.04, 0.35, "bandpass", 1900, bus.sfx, 4); },
    page: () => { const t = now(); const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf; f.type = "bandpass"; f.Q.value = 1.2; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.25);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + 0.08); g.gain.linearRampToValueAtTime(0.0001, t + 0.3);
      src.connect(f); f.connect(g); g.connect(bus.sfx); src.start(t); src.stop(t + 0.35); },
    hit: () => { const t = now(); noise(t, 0.12, 0.5, "lowpass", 1400); drum(t, 0.35, bus.sfx); },
    crit: () => { const t = now(); noise(t, 0.2, 0.6, "lowpass", 2600); bell(84, t, 0.2, bus.sfx); },
    miss: () => { const t = now(); noise(t, 0.15, 0.2, "highpass", 2500); },
    heal: () => { const t = now(); [72, 76, 79].forEach((m, i) => bell(m, t + i * 0.07, 0.12, bus.sfx)); },
    down: () => { const t = now(); drum(t, 0.7, bus.sfx); noise(t, 0.4, 0.3, "lowpass", 500); },
    win: () => { const t = now(); [60, 64, 67, 72].forEach((m, i) => pluck(m, t + i * 0.12, 0.5, bus.sfx)); },
    coin: () => { const t = now(); bell(88, t, 0.15, bus.sfx); bell(91, t + 0.06, 0.12, bus.sfx); },
  };
  function sfx(name) { if (!ctx || !prefs.on || !SFX[name]) return; SFX[name](); }

  // ---------- ambience per page ----------
  const PENTA = [0, 2, 4, 7, 9];
  function stopAmb() { clearInterval(ambTimer); ambTimer = null; for (const n of ambNodes) { try { n.stop(); } catch (e) { /* already stopped */ } } ambNodes = []; }
  function bed(type, freq, vol, lfo) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = type; f.frequency.value = freq; g.gain.value = vol;
    if (lfo) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = lfo; lg.gain.value = freq * 0.4;
      l.connect(lg); lg.connect(f.frequency); l.start(); ambNodes.push(l);
    }
    src.connect(f); f.connect(g); g.connect(bus.amb); src.start(); ambNodes.push(src);
  }
  // ---------- scene ambience: the hero page's "tonight" scene, while it is on screen ----------
  function crackle(t, vol) {
    const n = 1 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) noise(t + Math.random() * 0.22, 0.012 + Math.random() * 0.03, vol * (0.4 + Math.random()), "bandpass", 1800 + Math.random() * 3200, bus.amb, 1.5);
  }
  function cricket(t, vol) {
    const f = 4200 + Math.random() * 900;
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), at = t + k * 0.075;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, at + 0.05);
      o.connect(g); g.connect(bus.amb); o.start(at); o.stop(at + 0.06);
    }
  }
  function owl(t) {
    for (const [dt, len] of [[0, 0.35], [0.5, 0.18], [0.75, 0.5]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), at = t + dt;
      o.frequency.setValueAtTime(410, at); o.frequency.linearRampToValueAtTime(370, at + len);
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.05, at + 0.05); g.gain.linearRampToValueAtTime(0.0001, at + len);
      o.connect(g); g.connect(bus.amb); o.start(at); o.stop(at + len + 0.05);
    }
  }
  function plink(t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f0 = 900 + Math.random() * 900;
    o.frequency.setValueAtTime(f0 * 1.8, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.06);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.25);
    const d = ctx.createDelay(), fb = ctx.createGain();
    d.delayTime.value = 0.19; fb.gain.value = 0.35;
    o.connect(g); g.connect(bus.amb); g.connect(d); d.connect(fb); fb.connect(d); d.connect(bus.amb);
    o.start(t); o.stop(t + 0.3);
  }
  function snort(t) { noise(t, 0.35, 0.12, "bandpass", 500 + Math.random() * 300, bus.amb, 2); noise(t + 0.08, 0.2, 0.06, "lowpass", 300, bus.amb); }
  function footstep(t, vol) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 70; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.12); o.connect(g); g.connect(bus.amb); o.start(t); o.stop(t + 0.14); noise(t, 0.05, vol * 0.5, "lowpass", 900, bus.amb); }
  const SCENES = {
    camp: { beds: [["lowpass", 260, 0.1, 0.3], ["bandpass", 1400, 0.012, 0.05]], tick: 260, step(t, n) {
      crackle(t, 0.12); if (Math.random() < 0.18) noise(t, 0.4, 0.04, "lowpass", 500, bus.amb);
      if (n % 3 === 0 && Math.random() < 0.7) cricket(t + Math.random() * 0.2, 0.012);
      if (Math.random() < 0.006) owl(t); } },
    inn: { beds: [["bandpass", 520, 0.1, 0.4], ["bandpass", 900, 0.05, 0.23], ["lowpass", 240, 0.05, 0.3]], tick: 420, step(t, n, root) {
      if (Math.random() < 0.5) crackle(t, 0.05);
      if (Math.random() < 0.09) { bell(95 + Math.floor(Math.random() * 6), t, 0.03, bus.amb); if (Math.random() < 0.5) bell(98 + Math.floor(Math.random() * 4), t + 0.07, 0.02, bus.amb); }
      if (n % 2 === 0 && Math.random() < 0.55) pluck(root + PENTA[Math.floor(Math.random() * 5)] + (Math.random() < 0.3 ? 12 : 0), t + Math.random() * 0.2, 0.16, bus.amb);
      if (Math.random() < 0.02) noise(t, 0.5, 0.05, "bandpass", 700, bus.amb, 0.8); } },
    room: { beds: [["lowpass", 200, 0.06, 0.2]], tick: 380, step(t, n, root) {
      if (Math.random() < 0.55) crackle(t, 0.05);
      if (n % 9 === 0 && Math.random() < 0.6) { const d = ctx.createBiquadFilter(); d.type = "lowpass"; d.frequency.value = 600; d.connect(bus.amb); pluck(root + PENTA[Math.floor(Math.random() * 5)], t, 0.14, d); }
      if (n % 4 === 0 && Math.random() < 0.4) cricket(t, 0.005); } },
    stable: { beds: [["lowpass", 300, 0.05, 0.15]], tick: 400, step(t, n) {
      if (n % 3 === 0 && Math.random() < 0.7) cricket(t + Math.random() * 0.2, 0.01);
      if (Math.random() < 0.03) snort(t);
      if (Math.random() < 0.05) noise(t, 0.25, 0.04, "highpass", 2500, bus.amb); } },
    dungeon: { beds: [["bandpass", 140, 0.16, 0.06], ["lowpass", 90, 0.12, 0.03]], tick: 450, step(t) {
      if (Math.random() < 0.35) crackle(t, 0.04);
      if (Math.random() < 0.16) plink(t, 0.06);
      if (Math.random() < 0.03) noise(t, 1.6, 0.06, "lowpass", 120, bus.amb); } },
    cell: { beds: [["bandpass", 160, 0.1, 0.05]], tick: 500, step(t) {
      if (Math.random() < 0.12) plink(t, 0.06);
      if (Math.random() < 0.025) { for (let k = 0; k < 4; k++) footstep(t + k * 0.55, 0.08 - k * 0.012); }
      if (Math.random() < 0.015) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(3000, t); o.frequency.linearRampToValueAtTime(3600, t + 0.06); g.gain.setValueAtTime(0.015, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.08); o.connect(g); g.connect(bus.amb); o.start(t); o.stop(t + 0.1); } } },
  };
  function sceneAmbience(kind) {
    const sc = SCENES[kind], root = 50 + Math.floor(Math.random() * 5);
    for (const [type, f, vol, lfo] of sc.beds) bed(type, f, vol, lfo);
    let n = 0;
    ambTimer = setInterval(() => sc.step(now() + 0.05, n++, root), sc.tick);
  }

  // while a town's own tune plays on the Map (town_music.js), the map's generic wind and lute step aside
  let townOn = false, lastKind = null;
  function townAmbience(on) {
    townOn = on;
    if (on && lastKind === "map") stopAmb();
    else if (!on && lastKind === "map") ambience("map");
  }
  function ambience(kind) {
    lastKind = kind;
    stopAmb();
    if (!ctx || !prefs.on) return;
    if (kind === "map" && townOn) return;
    if (SCENES[kind]) { sceneAmbience(kind); return; }
    const root = 50 + Math.floor(Math.random() * 5);
    if (kind === "map") {
      bed("bandpass", 500, 0.22, 0.07);
      ambTimer = setInterval(() => {
        const t = now();
        if (Math.random() < 0.35) { const o = ctx.createOscillator(), g = ctx.createGain(), f0 = 2400 + Math.random() * 1600;
          o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.4, t + 0.08);
          g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(g); g.connect(bus.amb); o.start(t); o.stop(t + 0.14); }
        if (Math.random() < 0.3) pluck(root + 12 + PENTA[Math.floor(Math.random() * 5)], t, 0.18, bus.amb);
      }, 1100);
    } else if (kind === "fight") {
      bed("lowpass", 300, 0.12);
      let beat = 0;
      ambTimer = setInterval(() => { const t = now(); drum(t, beat % 4 === 0 ? 0.45 : 0.22, bus.amb); if (beat % 8 === 6) drum(t + 0.15, 0.2, bus.amb); beat++; }, 420);
    } else if (kind === "finale") {
      const t = now();
      [60, 64, 67, 72, 67, 72, 76].forEach((m, i) => { pluck(m, t + i * 0.16, 0.45, bus.amb); if (i % 2 === 0) bell(m + 12, t + i * 0.16, 0.08, bus.amb); });
      pad(48, t + 1, 8, 0.05);
      ambTimer = setInterval(() => { const t2 = now(); pad([48, 53, 55, 50][Math.floor(Math.random() * 4)], t2, 7, 0.04); if (Math.random() < 0.6) bell(72 + PENTA[Math.floor(Math.random() * 5)], t2 + 0.5, 0.06, bus.amb); }, 6000);
    } else {
      bed("lowpass", 380, 0.16, 0.13);
      ambTimer = setInterval(() => {
        const t = now();
        if (Math.random() < 0.18) bell(88 + Math.floor(Math.random() * 4), t, 0.03, bus.amb);
        if (Math.random() < 0.45) pluck(root + PENTA[Math.floor(Math.random() * 5)] + (Math.random() < 0.3 ? 12 : 0), t + Math.random() * 0.4, 0.2, bus.amb);
        if (Math.random() < 0.12) pad(root - 12 + [0, 5, 7][Math.floor(Math.random() * 3)], t, 5, 0.03);
      }, 1500);
    }
  }
  function setPage(route) {
    const kind = /^\/fight\//.test(route) ? "fight" : /^\/map/.test(route) ? "map" : /^\/finale/.test(route) ? "finale" : "town";
    const was = scenery;
    scenery = null;
    if (kind === page && ambTimer && !was) return;
    page = kind;
    if (started) { sfx("page"); ambience(kind); }
  }
  // a scene on the page asks for its own ambience while visible, and hands back the page's when it leaves the screen
  // owner is the scene's element, so a scene leaving the page can't silence the one that replaced it
  let sceneOwner = null;
  function scene(kind, owner) {
    const next = kind && SCENES[kind] ? kind : null;
    if (!next && owner && owner !== sceneOwner) return;
    if (next) sceneOwner = owner || null;
    if (next === scenery) return;
    scenery = next;
    if (started) ambience(scenery || page);
  }

  // ---------- the bard ----------
  const MODES = { glory: { scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 7, 9, 5], bpm: 112, root: 60 }, sad: { scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 8, 3, 10], bpm: 76, root: 57 },
    shame: { scale: [0, 2, 4, 5, 7, 9, 10], prog: [0, 10, 5, 0], bpm: 132, root: 62 } };
  function syllables(line) {
    const out = [];
    for (const w of line.split(/\s+/).filter(Boolean)) {
      const parts = w.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$|[^aeiouy](?=[^aeiouy]))?/gi);
      (parts && parts.join("").length === w.length ? parts : [w]).forEach((p, i, arr) => out.push(i === arr.length - 1 ? p + " " : p));
    }
    return out;
  }
  function rngFrom(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  // returns a schedule: [{t, syl, line, idx}] and plays it; onSyl(lineIdx, sylIdx) drives the karaoke highlight
  let perf = null;
  function playSong(song, onSyl, onEnd) {
    if (!init()) return null;
    stopSong();
    if (ctx.state === "suspended") ctx.resume();
    const mode = MODES[song.mood] || MODES.glory, r = rngFrom(song.seed || 7), beat = 60 / mode.bpm, t0 = now() + 0.3;
    const motif = {}, timers = [], out = ctx.createGain();
    out.connect(bus.music);
    let t = t0, deg = 2;
    const chordAt = (i) => mode.prog[i % mode.prog.length];
    song.lyrics.forEach((line, li) => {
      const syls = syllables(line), chorus = line === song.title;
      if (chorus && !motif.notes) motif.notes = syls.map(() => (deg = Math.max(0, Math.min(9, deg + [-1, 1, 1, 2, -2, 0][Math.floor(r() * 6)]))));
      const notes = chorus && motif.notes ? motif.notes : syls.map((_, i) => (i === syls.length - 1 ? [0, 2, 4][Math.floor(r() * 3)] : (deg = Math.max(0, Math.min(9, deg + [-1, 1, -1, 2, -2, 1, 0][Math.floor(r() * 7)])))));
      const stepLen = beat * (song.mood === "sad" ? 1 : 0.5);
      syls.forEach((syl, si) => {
        const d = notes[si] % 7, oct = Math.floor(notes[si] / 7) * 12, midi = mode.root + mode.scale[d] + oct;
        const len = si === syls.length - 1 ? stepLen * 2 : stepLen;
        sing(syl, midi, t, len, 0.32, out);
        const at = t;
        timers.push(setTimeout(() => onSyl && onSyl(li, si), Math.max(0, (at - now()) * 1000)));
        t += len;
      });
      t += beat;
    });
    const end = t + beat * 2;
    for (let bt = t0, i = 0; bt < end; bt += beat, i++) {
      const ch = chordAt(Math.floor(i / 4)), base = mode.root - 12 + ch;
      if (i % 4 === 0) pluck(base - 12, bt, 0.5, out);
      pluck(base + [0, 4, 7, 12][i % 4] + (mode.scale[2] === 3 && i % 4 === 1 ? -1 : 0), bt + (song.mood === "shame" ? beat * 0.5 : 0), 0.22, out);
      if (song.mood !== "sad" && i % 2 === 1) noise(bt, 0.05, 0.08, "highpass", 6000, out);
    }
    timers.push(setTimeout(() => { perf = null; onEnd && onEnd(); }, (end - now()) * 1000 + 300));
    perf = { timers, end, out };
    return perf;
  }
  function stopSong() {
    if (!perf) return;
    perf.timers.forEach(clearTimeout);
    perf.out.disconnect();
    perf = null;
  }

  // ---------- controls ----------
  function controls() {
    const top = document.querySelector(".top");
    if (!top || document.getElementById("snd")) return;
    const btn = document.createElement("button");
    btn.id = "snd"; btn.className = "snd-btn"; btn.title = "Sound";
    const icon = () => (btn.textContent = prefs.on ? "🔊" : "🔇");
    icon();
    const panel = document.createElement("div");
    panel.className = "snd-panel"; panel.hidden = true;
    const row = (label, key) => {
      const r = document.createElement("label"), inp = document.createElement("input");
      inp.type = "range"; inp.min = 0; inp.max = 1; inp.step = 0.05; inp.value = prefs[key];
      inp.oninput = () => { prefs[key] = +inp.value; save(); levels(); };
      r.append(label, inp); return r;
    };
    const tog = document.createElement("button");
    tog.className = "btn small";
    const togTxt = () => (tog.textContent = prefs.on ? "Mute" : "Unmute");
    togTxt();
    tog.onclick = () => { prefs.on = !prefs.on; save(); levels(); icon(); togTxt(); if (prefs.on) { start(); ambience(scenery || page); } else stopAmb(); };
    panel.append(tog, row("Volume", "master"), row("Ambience", "amb"), row("Music", "music"), row("Effects", "sfx"));
    btn.onclick = (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; start(); };
    document.addEventListener("click", (e) => { if (!panel.contains(e.target) && e.target !== btn) panel.hidden = true; });
    const wrap = document.createElement("div");
    wrap.className = "snd-wrap"; wrap.append(btn, panel);
    top.appendChild(wrap);
  }
  function start() {
    if (started || !prefs.on) return;
    if (!init()) return;
    if (ctx.state === "suspended") ctx.resume();
    started = true;
    ambience(scenery || page || "town");
  }
  document.addEventListener("pointerdown", (e) => {
    start();
    if (e.target.closest && e.target.closest(".btn, nav a, .tabs button, .choices button")) sfx("click");
  }, { capture: true });
  document.addEventListener("DOMContentLoaded", controls);
  if (document.readyState !== "loading") setTimeout(controls, 0);

  window.Sound = { sfx, setPage, scene, playSong, stopSong, syllables, townAmbience, get on() { return prefs.on; } };
})();
