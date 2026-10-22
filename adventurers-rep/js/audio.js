/* Sound, all synthesised with WebAudio (no files): page ambience, UI and fight effects, the talking text's voices and animal
   calls, and the shared context and Music bus that music.js plays every song on (the event ballads included). */
(function () {
  "use strict";
  // every level and switch lives in Settings (settings.js); these defaults only cover a page that loads audio.js alone
  const FALLBACK = { sound: true, master: 0.7, amb: 0.5, music: 0.7, sfx: 0.6, voices: true, voice: 0.7 };
  const pref = (k) => (window.Settings ? Settings.get(k) : FALLBACK[k]);
  const prefs = { get on() { return pref("sound"); } };

  let ctx = null, master, bus = {}, duckG = {}, noiseBuf = null, ambTimer = null, ambNodes = [], page = "", started = false, scenery = null;
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
    for (const k of ["amb", "music", "sfx", "voice"]) { bus[k] = ctx.createGain(); bus[k].connect(master); }
    // a song fades the outdoor ambience right out and lets a tavern's room murmur sit under it (bus.room is on the Ambience slider)
    bus.room = ctx.createGain();
    for (const k of ["amb", "room"]) { duckG[k] = ctx.createGain(); bus[k].disconnect(); bus[k].connect(duckG[k]); duckG[k].connect(master); }
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    levels();
    return ctx;
  }
  function levels() {
    if (!ctx) return;
    master.gain.value = prefs.on ? pref("master") : 0;
    bus.amb.gain.value = pref("amb") * 0.5;
    bus.room.gain.value = pref("amb") * 0.5;
    bus.music.gain.value = pref("music");
    bus.sfx.gain.value = pref("sfx") * 0.8;
    bus.voice.gain.value = pref("voices") ? pref("voice") : 0;
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
  // a short brass note for the ceremony's fanfares: two detuned saws through a lowpass that opens on the attack
  function brass(midi, t, dur, vol, dest) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 2;
    lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2600, t + 0.05); lp.frequency.exponentialRampToValueAtTime(1300, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol * 0.8, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.08);
    for (const det of [-6, 5]) { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = mtof(midi); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.12); }
    lp.connect(g); g.connect(dest || bus.sfx);
  }
  function roll(t, len, vol) { for (let k = 0; k < len / 0.045; k++) noise(t + k * 0.045, 0.04, vol * (0.4 + (k * 0.045) / len * 0.6), "bandpass", 900, bus.sfx, 1.2); }
  // ---------- effects ----------
  const SFX = {
    // the ceremony: a card turning over, an honour's fanfare, a tease's lighter sting, and the crown's full flourish
    envelope: () => { const t = now(); noise(t, 0.09, 0.22, "bandpass", 2600, bus.sfx, 1.5); noise(t + 0.06, 0.05, 0.12, "highpass", 3800); },
    fanfare: () => { const t = now(); [[67, 0, 0.12], [72, 0.13, 0.12], [76, 0.26, 0.12], [79, 0.39, 0.42]].forEach(([m, d, l]) => { brass(m, t + d, l, 0.16); brass(m - 12, t + d, l, 0.08); }); drum(t + 0.39, 0.3, bus.sfx); },
    sting: () => { const t = now(); pluck(72, t, 0.4, bus.sfx); pluck(79, t + 0.1, 0.4, bus.sfx); brass(70, t + 0.24, 0.16, 0.12); bell(91, t + 0.42, 0.08, bus.sfx); },
    crown: () => {
      const t = now();
      roll(t, 0.9, 0.18);
      [[60, 0.95, 0.16], [64, 1.12, 0.16], [67, 1.29, 0.16], [72, 1.46, 0.3], [67, 1.8, 0.14], [72, 1.96, 0.9]].forEach(([m, d, l]) => { brass(m + 7, t + d, l, 0.15); brass(m, t + d, l, 0.1); brass(m - 12, t + d, l, 0.07); });
      drum(t + 1.46, 0.45, bus.sfx); drum(t + 1.96, 0.55, bus.sfx);
      [84, 88, 91, 96].forEach((m, i) => bell(m, t + 2.0 + i * 0.07, 0.07, bus.sfx));
    },
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
  function bed(type, freq, vol, lfo, dest) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = type; f.frequency.value = freq; g.gain.value = vol;
    if (lfo) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = lfo; lg.gain.value = freq * 0.4;
      l.connect(lg); lg.connect(f.frequency); l.start(); ambNodes.push(l);
    }
    src.connect(f); f.connect(g); g.connect(dest || bus.amb); src.start(); ambNodes.push(src);
  }
  // ---------- scene ambience: the hero page's "tonight" scene, while it is on screen ----------
  function crackle(t, vol, dest) {
    const n = 1 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) noise(t + Math.random() * 0.22, 0.012 + Math.random() * 0.03, vol * (0.4 + Math.random()), "bandpass", 1800 + Math.random() * 3200, dest || bus.amb, 1.5);
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
  function footstep(t, vol, dest) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 70; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.12); o.connect(g); g.connect(dest || bus.amb); o.start(t); o.stop(t + 0.14); noise(t, 0.05, vol * 0.5, "lowpass", 900, dest || bus.amb); }
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
    tavern: { room: true, beds: [["bandpass", 420, 0.07, 0.31], ["bandpass", 1050, 0.025, 0.17], ["lowpass", 200, 0.04, 0.4]], tick: 240, step(t, n, root, dest) {
      const busy = 0.5 + 0.5 * Math.sin(n * 0.045) * Math.sin(n * 0.017 + 1);
      for (let k = 0; k < 2; k++) if (Math.random() < 0.35 + busy * 0.4) murmur(dest, t + Math.random() * 0.2, 0.012 + Math.random() * 0.014);
      if (Math.random() < 0.05) { clink(dest, t + Math.random() * 0.2, 0.012); if (Math.random() < 0.35) clink(dest, t + 0.12 + Math.random() * 0.05, 0.01); }
      if (Math.random() < 0.012 + busy * 0.01) laugh(dest, t + Math.random() * 0.3);
      if (Math.random() < 0.3) crackle(t, 0.03, dest);
      if (Math.random() < 0.01) { for (let k = 0; k < 3; k++) footstep(t + k * 0.5, 0.05 - k * 0.01, dest); } } },
  };
  // the song scene's tavern: a crowd's murmur heard through the room, cups clinking and the odd laugh, all on bus.room
  function murmur(dest, t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(), [f1, f2] = Object.values(FORMANT)[Math.floor(Math.random() * 6)];
    const f0 = 95 + Math.random() * 130, len = 0.1 + Math.random() * 0.28;
    o.type = "sawtooth"; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (0.85 + Math.random() * 0.3), t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.linearRampToValueAtTime(0.0001, t + len);
    for (const [f, a] of [[f1, 1], [f2, 0.5]]) { const bp = ctx.createBiquadFilter(), ga = ctx.createGain(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = 6; ga.gain.value = a; o.connect(bp); bp.connect(ga); ga.connect(g); }
    g.connect(dest); o.start(t); o.stop(t + len + 0.05);
  }
  function clink(dest, t, vol) {
    const f = 2400 + Math.random() * 1400;
    for (const [m, a] of [[1, 1], [2.76, 0.4], [5.4, 0.15]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f * m; g.gain.setValueAtTime(vol * a, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.3 / m);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.35);
    }
  }
  function laugh(dest, t) {
    const n = 3 + Math.floor(Math.random() * 4), f0 = 180 + Math.random() * 160;
    for (let k = 0; k < n; k++) {
      const at = t + k * (0.12 + Math.random() * 0.03), o = ctx.createOscillator(), g = ctx.createGain(), len = 0.08;
      o.type = "sawtooth"; o.frequency.setValueAtTime(f0 * (1 - k * 0.04), at);
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.05, at + 0.015); g.gain.linearRampToValueAtTime(0.0001, at + len);
      for (const [f, a] of [[FORMANT.a[0], 1], [FORMANT.a[1], 0.5]]) { const bp = ctx.createBiquadFilter(), ga = ctx.createGain(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = 5; ga.gain.value = a; o.connect(bp); bp.connect(ga); ga.connect(g); }
      g.connect(dest); o.start(at); o.stop(at + len + 0.05);
    }
  }
  function sceneAmbience(kind) {
    const sc = SCENES[kind], root = 50 + Math.floor(Math.random() * 5);
    let dest = bus.amb;
    if (sc.room) { dest = ctx.createBiquadFilter(); dest.type = "lowpass"; dest.frequency.value = 2400; dest.connect(bus.room); }
    for (const [type, f, vol, lfo] of sc.beds) bed(type, f, vol, lfo, dest);
    let n = 0;
    ambTimer = setInterval(() => sc.step(now() + 0.05, n++, root, dest), sc.tick);
  }
  function duck(on) {
    if (!ctx) return;
    const t = now();
    for (const [k, v] of [["amb", on ? 0 : 1], ["room", on ? 0.3 : 1]]) {
      const g = duckG[k].gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + (on ? 1.2 : 2.5));
    }
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

  // ---------- talking: one short blip per syllable in a speaker's own voice, Animal Crossing style ----------
  // v: { pitch (midi), timbre: "soft" | "buzzy" | "chirpy", formant, vib }; o: { at, semi, len, vol, bend, vowel, cons, whisper }
  const FORMANT = { a: [760, 1180], e: [480, 1850], i: [330, 2250], o: [520, 880], u: [380, 820], y: [330, 2150] };
  const voiceOn = () => !!(ctx && started && prefs.on && pref("voices") && ctx.state === "running");
  function blip(v, o) {
    if (!voiceOn()) return;
    const t = now() + 0.02 + (o.at || 0), len = Math.max(0.03, o.len || 0.07), vol = 0.2 * (o.vol == null ? 1 : o.vol), out = bus.voice;
    const f0 = mtof(v.pitch + (o.semi || 0)), f1 = f0 * Math.pow(2, (o.bend || 0) / 12), [fa, fb] = FORMANT[o.vowel] || FORMANT.a, k = v.formant || 1;
    if (o.whisper) {
      noise(t, len * 1.2, vol * 0.9, "bandpass", fb * k, out, 3);
      noise(t, len, vol * 0.5, "bandpass", fa * k * 1.4, out, 2);
      return;
    }
    const g = ctx.createGain(), lvl = v.timbre === "chirpy" ? vol * 0.55 : vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(lvl, t + Math.min(0.012, len * 0.3));
    g.gain.setValueAtTime(lvl * 0.85, t + len * 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    g.connect(out);
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(v.timbre === "chirpy" ? f0 * 0.82 : f0, t);
    if (v.timbre === "chirpy") osc.frequency.exponentialRampToValueAtTime(f0, t + 0.022);
    osc.frequency.linearRampToValueAtTime(f1, t + len);
    if (v.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 6 + v.vib * 3; lg.gain.value = f0 * 0.02 * v.vib;
      l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + len + 0.02);
    }
    if (v.timbre === "buzzy") {
      osc.type = "sawtooth";
      for (const [f, q, a] of [[fa * k, 6, 1], [fb * k, 8, 0.7]]) {
        const bp = ctx.createBiquadFilter(), ga = ctx.createGain();
        bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q; ga.gain.value = a * 2.2;
        osc.connect(bp); bp.connect(ga); ga.connect(g);
      }
    } else {
      osc.type = v.timbre === "chirpy" ? "square" : "triangle";
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = v.timbre === "chirpy" ? 2400 * k : 1500 * k + fb * 0.25;
      osc.connect(lp); lp.connect(g);
    }
    osc.start(t); osc.stop(t + len + 0.03);
    if (o.cons) noise(t, 0.018, vol * 0.3, "highpass", 3200, out);
  }
  // animals: one call per sound word; vol scales it, pitch shifts the voiced ones
  function tone(type, f0, f1, t, len, vol, filt) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, len * 0.2)); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    let n = o;
    if (filt) { const f = ctx.createBiquadFilter(); f.type = filt[0]; f.frequency.value = filt[1]; if (filt[2]) f.Q.value = filt[2]; o.connect(f); n = f; }
    n.connect(g); g.connect(bus.voice); o.start(t); o.stop(t + len + 0.03);
    return o;
  }
  function trill(o, t, len, rate, depth) {
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = rate; lg.gain.value = depth;
    l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + len + 0.03);
  }
  function glide(o, t, pts) { for (const [dt, f] of pts) o.frequency.linearRampToValueAtTime(f, t + dt); }
  const CALLS = {
    bark: (t, v, p) => { tone("sawtooth", 520 * p, 300 * p, t, 0.11, v, ["bandpass", 900, 1.4]); noise(t, 0.06, v * 0.6, "bandpass", 1300, bus.voice, 1.2); },
    yip: (t, v, p) => tone("square", 900 * p, 700 * p, t, 0.07, v * 0.5, ["lowpass", 2400]),
    sniff: (t, v) => { noise(t, 0.05, v * 0.5, "highpass", 2600, bus.voice); noise(t + 0.09, 0.05, v * 0.45, "highpass", 2800, bus.voice); },
    snore: (t, v) => noise(t, 0.6, v * 0.35, "lowpass", 380, bus.voice),
    growl: (t, v) => trill(tone("sawtooth", 95, 80, t, 0.55, v * 0.9, ["lowpass", 520]), t, 0.55, 26, 14),
    howl: (t, v, p) => { const o = tone("sine", 420 * p, 520 * p, t, 1.0, v * 0.8); glide(o, t, [[0.45, 700 * p], [1.0, 520 * p]]); trill(o, t, 1.0, 5, 9); },
    mrrp: (t, v, p) => trill(tone("triangle", 380 * p, 620 * p, t, 0.24, v * 0.9, ["lowpass", 2200]), t, 0.1, 32, 40),
    mew: (t, v, p) => glide(tone("triangle", 600 * p, 560 * p, t, 0.3, v * 0.8, ["lowpass", 2600]), t, [[0.1, 900 * p], [0.3, 560 * p]]),
    purr: (t, v) => trill(tone("sawtooth", 46, 42, t, 0.8, v * 0.7, ["lowpass", 260]), t, 0.8, 24, 10),
    click: (t, v) => noise(t, 0.012, v * 0.9, "bandpass", 3400, bus.voice, 3),
    lick: (t, v) => noise(t, 0.04, v * 0.5, "bandpass", 5200, bus.voice, 2),
    kek: (t, v, p) => { tone("square", 2100 * p, 1800 * p, t, 0.05, v * 0.35, ["lowpass", 4200]); tone("square", 2100 * p, 1800 * p, t + 0.09, 0.05, v * 0.32, ["lowpass", 4200]); },
    skree: (t, v, p) => tone("sawtooth", 2600 * p, 1500 * p, t, 0.32, v * 0.45, ["bandpass", 2400, 2]),
    rustle: (t, v) => { for (let i = 0; i < 4; i++) noise(t + i * 0.035, 0.03, v * 0.35, "highpass", 4000, bus.voice); },
    snort: (t, v) => { noise(t, 0.28, v * 0.9, "bandpass", 520, bus.voice, 2); noise(t + 0.05, 0.18, v * 0.5, "lowpass", 300, bus.voice); },
    whinny: (t, v, p) => trill(tone("sawtooth", 950 * p, 520 * p, t, 0.65, v * 0.55, ["bandpass", 1400, 1.5]), t, 0.65, 11, 60),
    sigh: (t, v) => noise(t, 0.7, v * 0.5, "bandpass", 700, bus.voice, 0.8),
    heehaw: (t, v) => { tone("sawtooth", 640, 600, t, 0.26, v * 0.6, ["bandpass", 1100, 2]); tone("sawtooth", 280, 250, t + 0.3, 0.32, v * 0.7, ["bandpass", 700, 2]); },
    moo: (t, v) => tone("sawtooth", 118, 92, t, 0.9, v * 0.8, ["lowpass", 520]),
    groan: (t, v) => trill(tone("sawtooth", 140, 105, t, 0.8, v * 0.7, ["bandpass", 600, 1.4]), t, 0.8, 7, 8),
    chime: (t, v) => { bell(88, t, v * 0.25, bus.voice); bell(93, t + 0.09, v * 0.2, bus.voice); bell(97, t + 0.18, v * 0.16, bus.voice); },
    rattle: (t, v) => { for (let i = 0; i < 5; i++) noise(t + i * 0.05 + Math.random() * 0.02, 0.015, v * 0.7, "bandpass", 2000 + Math.random() * 1500, bus.voice, 4); },
    chew: (t, v) => { for (let i = 0; i < 3; i++) noise(t + i * 0.2, 0.08, v * 0.4, "lowpass", 600, bus.voice); },
    thump: (t, v) => { tone("sine", 140, 60, t, 0.14, v * 0.9); tone("sine", 140, 60, t + 0.22, 0.14, v * 0.7); },
  };
  function critter(call, o) {
    if (!voiceOn() || !CALLS[call]) return;
    const opt = o || {};
    CALLS[call](now() + 0.02 + (opt.at || 0), 0.3 * (opt.vol == null ? 1 : opt.vol), opt.pitch || 1);
  }

  // ---------- controls: the header's quick panel; it edits the same Settings as the Settings page ----------
  function controls() {
    const top = document.querySelector(".top");
    if (!top || document.getElementById("snd")) return;
    const btn = document.createElement("button");
    btn.id = "snd"; btn.className = "snd-btn"; btn.title = "Sound";
    const panel = document.createElement("div");
    panel.className = "snd-panel"; panel.hidden = true;
    const sliders = [];
    const row = (label, key) => {
      const r = document.createElement("label"), inp = document.createElement("input");
      inp.type = "range"; inp.min = 0; inp.max = 1; inp.step = 0.05; inp.value = pref(key);
      inp.oninput = () => { if (window.Settings) Settings.set(key, +inp.value); };
      sliders.push(() => { if (+inp.value !== pref(key)) inp.value = pref(key); });
      r.append(label, inp); return r;
    };
    const tog = document.createElement("button");
    tog.className = "btn small";
    tog.onclick = () => { if (window.Settings) Settings.set("sound", !prefs.on); };
    const more = document.createElement("a");
    more.href = "#/settings"; more.className = "snd-more"; more.textContent = "All settings";
    more.onclick = () => { panel.hidden = true; };
    const show = () => { btn.textContent = prefs.on ? "🔊" : "🔇"; tog.textContent = prefs.on ? "Mute" : "Unmute"; for (const f of sliders) f(); };
    panel.append(tog, row("Volume", "master"), row("Ambience", "amb"), row("Music", "music"), row("Effects", "sfx"), row("Voices", "voice"), more);
    show();
    if (window.Settings) Settings.watch(show);
    btn.onclick = (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; start(); };
    document.addEventListener("click", (e) => { if (!panel.contains(e.target) && e.target !== btn) panel.hidden = true; });
    const gear = document.createElement("a");
    gear.href = "#/settings"; gear.className = "snd-btn set-btn"; gear.title = "Settings"; gear.textContent = "⚙";
    const wrap = document.createElement("div");
    wrap.className = "snd-wrap"; wrap.append(gear, btn, panel);
    top.appendChild(wrap);
  }
  if (window.Settings) Settings.watch((keys) => {
    levels();
    if (!keys.includes("sound")) return;
    if (prefs.on) { const was = started; start(); if (was) ambience(scenery || page); wake(); } else stopAmb();
  });
  // browsers keep audio locked until the page's first gesture, and a touch's pointerdown isn't one, so every gesture event retries
  let gestured = false;
  const waiting = new Set();
  const live = () => !!(ctx && started && prefs.on && ctx.state === "running");
  function wake() { if (!live()) return; for (const fn of Array.from(waiting)) { waiting.delete(fn); try { fn(); } catch (e) { console.error(e); } } }
  function start() {
    if (!prefs.on || !init()) return;
    if (!ctx.onstatechange) ctx.onstatechange = wake;
    if (ctx.state === "suspended" && unlocked()) { const r = ctx.resume(); if (r && r.then) r.then(wake, () => {}); }
    if (started) return;
    started = true;
    ambience(scenery || page || "town");
  }
  function gesture() { gestured = true; start(); wake(); }
  document.addEventListener("pointerdown", (e) => {
    gesture();
    if (e.target.closest && e.target.closest(".btn, nav a, .tabs button, .choices button")) sfx("click");
  }, { capture: true });
  for (const k of ["pointerup", "touchend", "click", "keydown"]) document.addEventListener(k, gesture, { capture: true });
  document.addEventListener("DOMContentLoaded", controls);
  if (document.readyState !== "loading") setTimeout(controls, 0);
  // a page shown after a gesture elsewhere on the site is already unlocked (the replay players load on first use, after the click)
  const unlocked = () => gestured || !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
  // fn runs once sound really plays: now if it does, else on the gesture that unlocks it or when sound is turned back on
  function whenLive(fn) { if (live()) { fn(); return () => {}; } waiting.add(fn); return () => waiting.delete(fn); }

  // music.js plays on this context: the Music bus, the shared ducking, and whether a first click has unlocked sound
  function engine() {
    if (!init()) return null;
    if (prefs.on && unlocked()) start();
    return { ctx, out: bus.music, noiseBuf, duck, get live() { return live(); } };
  }
  // the replays' own contexts (night games, meals, catches, tables, tarot, chess) take their switch and levels from here
  const fxPrefs = () => ({ on: !!prefs.on, master: pref("master"), sfx: pref("sfx") });
  window.Sound = { sfx, setPage, scene, townAmbience, blip, critter, engine, whenLive, fxPrefs, get on() { return prefs.on; }, get talking() { return voiceOn(); },
    get unlocked() { return unlocked(); }, get locked() { return !!prefs.on && !unlocked(); } };
})();
