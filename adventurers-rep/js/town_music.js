/* TownMusic: each town's own looping theme and ambience bed on its Map panel, synthesised with WebAudio (no files). */
(function () {
  "use strict";
  // audio.js keeps its context private, so this file follows the same rules on its own: the shared Settings
  // (mute and the Volume/Ambience/Music sliders), nothing before the first pointerdown, modest levels
  const FADE = 2.2, AHEAD = 1.2, TICK = 150, AMB_STEP = 0.25;
  const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10], DORIAN = [0, 2, 3, 5, 7, 9, 10], PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const R = Math.random, pick = (a) => a[Math.floor(R() * a.length)];

  let ctx = null, master = null, musBus = null, ambBus = null, noiseBuf = null, prefs = readPrefs(), unlocked = false, want = null, cur = null, timer = null;

  function readPrefs() {
    const S = window.Settings;
    return S ? { on: S.get("sound"), master: S.get("master"), amb: S.get("amb"), music: S.get("music") } : { on: true, master: 0.7, amb: 0.5, music: 0.7 };
  }
  function levels() {
    prefs = readPrefs();
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(prefs.on ? prefs.master : 0, t, 0.05);
    musBus.gain.setTargetAtTime(prefs.music * 0.5, t, 0.05);
    ambBus.gain.setTargetAtTime(prefs.amb * 0.5, t, 0.05);
  }
  function makeNoise(c) {
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1;
    return b;
  }
  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master = ctx.createGain(); musBus = ctx.createGain(); ambBus = ctx.createGain();
    musBus.connect(master); ambBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = makeNoise(ctx);
    levels();
    return ctx;
  }

  // ---------- building blocks ----------
  function osc(type, f, t, end, dest) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (dest) o.connect(dest);
    o.start(t); o.stop(end);
    return o;
  }
  function env(dest, t, a, peak, hold, rel) {
    const g = ctx.createGain(), h = Math.max(a, hold);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + h);
    g.gain.linearRampToValueAtTime(0, t + h + rel);
    g.connect(dest);
    return g;
  }
  function perc(dest, t, peak, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    g.connect(dest);
    return g;
  }
  function filt(type, f, q, dest) {
    const b = ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f;
    if (q) b.Q.value = q;
    b.connect(dest);
    return b;
  }
  function nz(t, end, dest) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    s.connect(dest); s.start(t, R() * 1.5); s.stop(end);
    return s;
  }
  function vib(o, t, rate, cents, delay, end) {
    const l = osc("sine", rate, t, end, null), lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(cents, t + delay);
    l.connect(lg); lg.connect(o.detune);
  }
  function echo(dest, time, fb, wet, lp) {
    const inp = ctx.createGain(), d = ctx.createDelay(2), f = ctx.createGain(), w = ctx.createGain(), l = ctx.createBiquadFilter();
    d.delayTime.value = time; f.gain.value = fb; w.gain.value = wet; l.type = "lowpass"; l.frequency.value = lp || 2500;
    inp.connect(dest); inp.connect(d); d.connect(l); l.connect(f); f.connect(d); l.connect(w); w.connect(dest);
    return inp;
  }

  // ---------- instruments ----------
  function brass(m, t, dur, vol, dest) {
    const end = t + dur + 0.25, g = env(dest, t, 0.04, vol, dur * 0.9, 0.15), lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 2;
    lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(2600, t + 0.05); lp.frequency.exponentialRampToValueAtTime(1300, t + 0.3);
    lp.connect(g);
    for (const d of [-6, 5]) { const o = osc("sawtooth", mtof(m), t, end, lp); o.detune.setValueAtTime(d - 30, t); o.detune.linearRampToValueAtTime(d, t + 0.05); }
  }
  function fiddle(m, t, dur, vol, dest) {
    const end = t + dur + 0.3, g = env(dest, t, 0.06, vol, dur * 0.92, 0.18), pk = ctx.createBiquadFilter();
    pk.type = "peaking"; pk.frequency.value = 1100; pk.Q.value = 1.4; pk.gain.value = 7; pk.connect(g);
    const o = osc("sawtooth", mtof(m), t, end, filt("lowpass", 3400, 0.8, pk));
    vib(o, t, 5.6, 14, Math.min(0.25, dur * 0.5), end);
  }
  function wind(m, t, dur, vol, dest, o) {
    const end = t + dur + 0.35, g = env(dest, t, o.attack, vol, dur * 0.9, 0.2), f = mtof(m);
    const a = osc(o.wave, f, t, end, g);
    vib(a, t, o.vibRate || 5, o.vib, Math.min(0.35, dur * 0.6), end);
    const g2 = ctx.createGain(); g2.gain.value = 0.15; g2.connect(g);
    vib(osc("sine", f * 2, t, end, g2), t, o.vibRate || 5, o.vib, Math.min(0.35, dur * 0.6), end);
    nz(t, end, filt("bandpass", f * 1.5, 2.5, env(dest, t, o.attack * 0.6, vol * o.breath, dur * 0.85, 0.2)));
  }
  const flute = (m, t, dur, vol, dest) => wind(m, t, dur, vol, dest, { wave: "sine", attack: 0.03, vib: 12, breath: 0.35, vibRate: 5.5 });
  const pipe = (m, t, dur, vol, dest) => wind(m, t, dur, vol, dest, { wave: "triangle", attack: 0.12, vib: 22, breath: 0.7, vibRate: 4.3 });
  function squeeze(m, t, dur, vol, dest) {
    const end = t + dur + 0.15, g = env(dest, t, 0.03, vol, dur * 0.92, 0.08), tr = ctx.createGain(), lg = ctx.createGain();
    tr.gain.value = 0.8; tr.connect(g); lg.gain.value = 0.2;
    osc("sine", 5.5, t, end, lg); lg.connect(tr.gain);
    const lp = filt("lowpass", 2300, 1, tr);
    osc("square", mtof(m), t, end, lp).detune.value = -7;
    osc("sawtooth", mtof(m), t, end, lp).detune.value = 8;
  }
  const ksCache = {};
  function ksBuffer(midi) {
    if (ksCache[midi]) return ksCache[midi];
    const sr = 44100, n = Math.floor(sr * 2), out = ctx.createBuffer(1, n, sr), x = out.getChannelData(0);
    const period = Math.max(2, Math.round(sr / mtof(midi))), ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = R() * 2 - 1;
    let p = 0;
    for (let i = 0; i < n; i++) { const nx = (p + 1) % period, v = (ring[p] + ring[nx]) * 0.4985; x[i] = ring[p]; ring[p] = v; p = nx; }
    return (ksCache[midi] = out);
  }
  function pluck(m, t, vol, dest, bright, len) {
    const src = ctx.createBufferSource(), g = ctx.createGain(), l = len || 1.5;
    src.buffer = ksBuffer(Math.round(m));
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + l);
    src.connect(filt("lowpass", bright || 3200, 0, g)); g.connect(dest);
    src.start(t); src.stop(t + l + 0.05);
  }
  function bell(m, t, vol, dest, len) {
    const L = len || 2.2;
    for (const [mult, a] of [[1, 1], [2.76, 0.4], [5.4, 0.18], [0.5, 0.25]]) osc("sine", mtof(m) * mult, t, t + L + 0.1, perc(dest, t, vol * a, L / Math.max(1, mult * 0.8)));
  }
  const VOWELS = { a: [800, 1200], o: [480, 860], u: [340, 760] };
  function choir(m, t, dur, vol, dest, vowel, att) {
    const end = t + dur + 0.1, a = att || dur * 0.35, g = env(dest, t, a, vol, dur - a - dur * 0.25, dur * 0.25), mix = ctx.createGain(), [f1, f2] = VOWELS[vowel || "a"];
    mix.gain.value = 1; mix.connect(g);
    const b1 = filt("bandpass", f1, 6, mix), b2 = filt("bandpass", f2, 8, mix), lp = filt("lowpass", 2400, 0, b1);
    lp.connect(b2);
    for (const d of [-9, 0, 8]) { const o = osc("sawtooth", mtof(m), t, end, lp); o.detune.value = d; vib(o, t, 4.6 + d * 0.03, 8, a, end); }
  }
  function drone(m, t, dur, vol, dest, att) {
    const end = t + dur + 0.1, a = att || dur * 0.3, g = env(dest, t, a, vol, dur - a * 2, a), lp = filt("lowpass", 700, 0, g);
    osc("sine", mtof(m), t, end, lp);
    const g2 = ctx.createGain(); g2.gain.value = 0.35; g2.connect(lp);
    osc("triangle", mtof(m + 12), t, end, g2).detune.value = 4;
  }
  function padSaw(m, t, dur, vol, dest) {
    const end = t + dur + 0.1, g = env(dest, t, dur * 0.3, vol, dur * 0.7, dur * 0.3), lp = filt("lowpass", 900, 0, g);
    for (const d of [-7, 6]) osc("sawtooth", mtof(m), t, end, lp).detune.value = d;
  }
  function bass(m, t, dur, vol, dest) {
    const g = env(dest, t, 0.01, vol, dur * 0.6, dur * 0.4), lp = filt("lowpass", 600, 0, g);
    osc("triangle", mtof(m), t, t + dur + 0.05, lp);
    osc("sine", mtof(m), t, t + dur + 0.05, lp);
  }
  function kick(t, vol, dest, f) {
    const o = osc("sine", f || 110, t, t + 0.35, perc(dest, t, vol, 0.3));
    o.frequency.exponentialRampToValueAtTime((f || 110) * 0.42, t + 0.18);
  }
  function snare(t, vol, dest) {
    nz(t, t + 0.16, filt("highpass", 1300, 0, perc(dest, t, vol, 0.14)));
    osc("triangle", 190, t, t + 0.08, perc(dest, t, vol * 0.5, 0.07));
  }
  function shaker(t, vol, dest, len) { nz(t, t + (len || 0.07) + 0.02, filt("highpass", 6000, 0, perc(dest, t, vol, len || 0.07))); }
  function wood(t, vol, dest, f) {
    osc("sine", f, t, t + 0.1, perc(dest, t, vol, 0.07));
    nz(t, t + 0.02, filt("bandpass", f * 2.5, 3, perc(dest, t, vol * 0.4, 0.015)));
  }
  function anvil(t, vol, dest) {
    [[1, 1], [2.32, 0.6], [3.86, 0.35], [5.1, 0.2]].forEach(([k, a]) => osc("sine", 1650 * k, t, t + 1.2, perc(dest, t, vol * a, 1.1 / k)));
    nz(t, t + 0.03, filt("highpass", 3000, 0, perc(dest, t, vol * 0.6, 0.02)));
  }

  // ---------- ambience ----------
  function bed(v, type, f, vol, lfo, depth, q, am) {
    const t = ctx.currentTime, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; g.gain.value = vol;
    s.connect(fl); fl.connect(g); g.connect(v.amb); s.start(t, R()); v.nodes.push(s);
    if (lfo) { const l = osc("sine", lfo, t, t + 1e5, null), lg = ctx.createGain(); lg.gain.value = f * (depth || 0.4); l.connect(lg); lg.connect(fl.frequency); v.nodes.push(l); }
    if (am) { const l = osc("sine", am, t, t + 1e5, null), lg = ctx.createGain(); lg.gain.value = vol * 0.8; l.connect(lg); lg.connect(g.gain); v.nodes.push(l); }
  }
  function bird(t, vol, dest) {
    const f = 2600 + R() * 2400, n = 2 + Math.floor(R() * 5), gap = 0.06 + R() * 0.08, up = R() < 0.5;
    for (let k = 0; k < n; k++) {
      const at = t + k * gap, o = osc("sine", f * (k % 2 ? 1.08 : 1), at, at + 0.09, perc(dest, at, vol, 0.07));
      o.frequency.exponentialRampToValueAtTime(f * (up ? 1.35 : 0.72), at + 0.05);
    }
  }
  function gull(t, vol, dest) {
    const n = 2 + Math.floor(R() * 2);
    for (let k = 0; k < n; k++) {
      const at = t + k * 0.42, f = 1250 + R() * 300, g = env(filt("bandpass", 1800, 1, dest), at, 0.03, vol * (1 - k * 0.2), 0.12, 0.22);
      const o = osc("triangle", f, at, at + 0.4, g);
      o.frequency.linearRampToValueAtTime(f * 1.5, at + 0.08); o.frequency.linearRampToValueAtTime(f * 0.8, at + 0.37);
    }
  }
  function frog(t, vol, dest) {
    const f = 70 + R() * 60, n = 3 + Math.floor(R() * 5), bp = filt("bandpass", 420 + R() * 300, 3, dest);
    for (let k = 0; k < n; k++) { const at = t + k * 0.05; osc("square", f, at, at + 0.04, env(bp, at, 0.006, vol, 0.012, 0.02)); }
  }
  function drip(t, vol, dest) {
    const f0 = 900 + R() * 900, o = osc("sine", f0 * 1.8, t, t + 0.3, perc(dest, t, vol, 0.25));
    o.frequency.exponentialRampToValueAtTime(f0, t + 0.06);
  }
  function bubble(t, vol, dest) {
    const f = 250 + R() * 500, o = osc("sine", f, t, t + 0.1, perc(dest, t, vol, 0.07));
    o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.05);
  }
  function swell(t, vol, dest, type, f0, f1, att, dec, q) {
    const fl = filt(type, f0, q || 0, env(dest, t, att, vol, att, dec));
    fl.frequency.setValueAtTime(f0, t); fl.frequency.linearRampToValueAtTime(f1, t + att); fl.frequency.linearRampToValueAtTime(f0, t + att + dec);
    nz(t, t + att * 2 + dec + 0.1, fl);
  }
  function creak(t, vol, dest, base, len) {
    const l = len || 0.5 + R() * 0.6, o = osc("sawtooth", base, t, t + l + 0.1, filt("bandpass", 700 + R() * 400, 5, env(dest, t, 0.08, vol, l * 0.7, l * 0.3)));
    o.frequency.linearRampToValueAtTime(base * (1.5 + R() * 0.6), t + l);
  }
  function clatter(t, vol, dest) {
    const n = 4 + Math.floor(R() * 5);
    let at = t;
    for (let k = 0; k < n; k++) { nz(at, at + 0.05, filt("bandpass", 700 + R() * 900, 3, perc(dest, at, vol * (0.5 + R() * 0.5), 0.04))); at += 0.06 + R() * 0.07; }
    kick(t, vol * 0.5, dest, 80);
  }
  function step(t, vol, dest) { kick(t, vol, dest, 70); nz(t, t + 0.06, filt("lowpass", 900, 0, perc(dest, t, vol * 0.5, 0.05))); }
  function call(t, vol, dest) {
    const f0 = 170 + R() * 130, end = t + 0.75, g = env(filt("lowpass", 1300, 0, dest), t, 0.06, vol, 0.4, 0.25), mix = ctx.createGain();
    mix.connect(g);
    const b1 = filt("bandpass", 800, 6, mix), b2 = filt("bandpass", 1200, 8, mix);
    b1.frequency.setValueAtTime(800, t); b1.frequency.linearRampToValueAtTime(500, t + 0.6);
    b2.frequency.setValueAtTime(1200, t); b2.frequency.linearRampToValueAtTime(880, t + 0.6);
    for (const b of [b1, b2]) { const o = osc("sawtooth", f0 * 1.15, t, end, b); o.frequency.linearRampToValueAtTime(f0, t + 0.5); }
  }
  function cart(t, vol, dest) {
    swell(t, vol, dest, "lowpass", 120, 260, 1.2, 1.8);
    for (let k = 0; k < 5; k++) {
      const at = t + 0.3 + k * 0.48 + R() * 0.05, o = osc("sine", 850 + R() * 250, at, at + 0.2, env(dest, at, 0.02, vol * 0.18, 0.08, 0.08));
      vib(o, at, 22, 60, 0.02, at + 0.2);
      if (R() < 0.5) nz(at, at + 0.05, filt("bandpass", 1000, 3, perc(dest, at, vol * 0.3, 0.04)));
    }
  }
  function rockfall(t, vol, dest) {
    swell(t, vol, dest, "lowpass", 90, 200, 0.2, 1.4);
    for (let k = 0; k < 6; k++) { const at = t + 0.1 + R() * 1.2; kick(at, vol * 0.4 * R(), dest, 90 + R() * 60); }
  }
  function woodpecker(t, vol, dest) { const n = 8 + Math.floor(R() * 7); for (let k = 0; k < n; k++) wood(t + k * 0.055, vol * (1 - k / n * 0.6), dest, 1400); }
  function heron(t, vol, dest) { const o = osc("sawtooth", 300, t, t + 0.4, filt("bandpass", 900, 3, env(dest, t, 0.02, vol, 0.15, 0.15))); o.frequency.linearRampToValueAtTime(230, t + 0.3); }
  const p = (rate) => R() < rate * AMB_STEP;

  // ---------- scores ----------
  // melody bars are scale degrees per step: 1-7, ' up an octave, , down, #/b sharp/flat, - holds, . rests
  function deg(tok, root, scale) {
    const m = /^([#b]?)([1-7])(['",]*)$/.exec(tok);
    if (!m) throw new Error("bad note " + tok);
    let up = 0;
    for (const c of m[3]) up += c === "'" ? 1 : -1;
    return root + scale[+m[2] - 1] + 12 * up + (m[1] === "#" ? 1 : m[1] === "b" ? -1 : 0);
  }
  function line(bars, root, scale) {
    const toks = bars.join(" ").split(/\s+/).filter(Boolean), out = new Array(toks.length).fill(null);
    toks.forEach((tk, i) => { if (tk === "." || tk === "-") return; let n = 1; while (toks[i + n] === "-") n++; out[i] = { m: deg(tk, root, scale), n }; });
    return out;
  }
  const triad = (d, root, scale) => [0, 2, 4].map((k) => root + scale[(d - 1 + k) % 7] + 12 * Math.floor((d - 1 + k) / 7));

  const TOWNS = {
    // C major march: brass lead and oom-pah stabs, snare and bass drum, bells opening each phrase
    ironhaven: { root: 60, scale: MAJOR, sd: 60 / 112 / 2, bar: 8, mix: [0.55, 2.3],
      lead: ["1 - 1 2 3 - 1 -", "5 - 5 - 3 - 1 -", "4 - 4 5 6 - 4 -", "5 - - - - - . .",
        "1 - 1 2 3 - 5 -", "6 - 5 4 3 - 1 -", "2 - 2 3 4 - 7, -", "1 - - - - - . .",
        "5 - 5 6 5 - 3 -", "4 - 4 5 4 - 2 -", "3 - 3 4 5 - 1' -", "7 - 6 - 5 - - .",
        "1' - 1' 7 6 - 5 -", "4 - 6 - 5 - 3 -", "2 - 5 - 7, - 2 -", "1 - - - 1 . 5, ."],
      chords: [1, 1, 4, 5, 1, 4, 5, 1, 1, 2, 1, 5, 4, 4, 5, 1],
      play(v, s, i, t) {
        const pos = i % 8, bar = Math.floor(i / 8), ch = s.ch[bar], e = s.lead[i], sd = s.sd;
        if (e) brass(e.m, t, e.n * sd * 0.92, 0.1, v.mus);
        if (pos === 0 || pos === 4) { bass((pos ? ch[2] : ch[0]) - 24, t, sd * 1.6, 0.26, v.mus); kick(t, 0.2, v.mus); }
        if (pos === 2 || pos === 6) { ch.forEach((m) => brass(m - 12, t, sd * 0.7, 0.028, v.mus)); snare(t, 0.07, v.mus); }
        if (bar % 4 === 3 && pos >= 5) { snare(t, 0.035, v.mus); snare(t + sd / 2, 0.045, v.mus); }
        if (pos === 0 && bar % 4 === 0) { bell(s.root + 24, t, 0.05, v.mus, 3); bell(s.root + 19, t + sd, 0.03, v.mus, 3); }
        if (pos === 0 && bar >= 8 && bar < 12) bell(ch[0] + 24, t, 0.025, v.mus);
      },
      beds(v) { bed(v, "bandpass", 480, 0.08, 0.3, 0.3, 0.8); bed(v, "bandpass", 1000, 0.03, 0.21, 0.3, 1); bed(v, "lowpass", 170, 0.05, 0.1, 0.2); },
      amb(v, t) {
        if (p(0.12)) clatter(t, 0.06, v.amb);
        if (p(0.09)) { const n = 3 + Math.floor(R() * 4); for (let k = 0; k < n; k++) step(t + k * 0.4, 0.07, v.amb); }
        if (p(0.07)) { const lp = filt("lowpass", 1400, 0, v.amb); anvil(t, 0.025, lp); if (R() < 0.6) anvil(t + 0.5, 0.02, lp); }
        if (p(0.05)) call(t, 0.04, v.amb);
        if (p(0.012)) bell(48 + Math.floor(R() * 3) * 5, t, 0.04, v.amb, 4);
      } },
    // G major market reel with a swing: fiddle lead, strummed lute, tambourine
    thornwall: { root: 67, scale: MAJOR, sd: 60 / 104 / 2, bar: 8, mix: [1.4, 3.5],
      lead: ["5, - 1 2 3 2 1 2", "3 - 5 - 5 4 3 -", "4 - 6 - 6 5 4 -", "3 2 1 2 3 - . 5,",
        "5, - 1 2 3 2 1 2", "3 - 5 - 6 5 4 3", "2 - 4 3 2 1 7, 2", "1 - - - - - . .",
        "5 - 6 5 4 - 3 -", "4 - 5 4 3 - 2 -", "3 - 4 3 2 - 1 -", "2 3 4 5 6 - 5 -",
        "5 - 1' - 7 6 5 4", "3 - 5 - 4 3 2 -", "1 2 3 4 5 - 7, -", "1 - - - 1 . . ."],
      chords: [1, 1, 4, 1, 1, 1, 5, 1, 1, 5, 1, 5, 1, 4, 5, 1],
      play(v, s, i, t0) {
        const pos = i % 8, bar = Math.floor(i / 8), ch = s.ch[bar], e = s.lead[i], sd = s.sd, t = t0 + (i % 2 ? sd * 0.17 : 0);
        if (e) fiddle(e.m, t, e.n * sd * 0.95, 0.075, v.mus);
        if (pos === 0 || pos === 4) { pluck((pos ? ch[2] : ch[0]) - 24, t, 0.34, v.mus, 1400); kick(t, 0.1, v.mus, 90); }
        if (pos === 2 || pos === 6) { ch.forEach((m, k) => pluck(m - 12, t + k * 0.018, 0.12, v.mus, 2600, 0.9)); shaker(t, 0.05, v.mus, 0.14); }
        else if (i % 2) shaker(t, 0.025, v.mus);
      },
      beds(v) { bed(v, "bandpass", 600, 0.055, 0.25, 0.3, 0.8); bed(v, "lowpass", 220, 0.04, 0.12, 0.2); },
      amb(v, t) {
        if (p(0.06)) cart(t, 0.07, v.amb);
        if (p(0.06)) call(t, 0.035, v.amb);
        if (p(0.05)) bird(t, 0.012, v.amb);
        if (p(0.04)) clatter(t, 0.03, v.amb);
      } },
    // D minor work song: a low hummed tune over a heavy stomp, anvils on the off-beats
    veldrock: { root: 50, scale: MINOR, sd: 60 / 70 / 2, bar: 8, mix: [0.5, 3.5],
      lead: ["1 - - 3 2 - 1 -", "7, - - 1 5, - - -", "1 - - 3 4 - 3 2", "1 - - - . . . .",
        "3 - - 5 4 - 3 -", "2 - - 3 1 - 7, -", "6, - - 7, 1 - 2 -", "1 - - - . . . ."],
      chords: [1, 7, 1, 1, 3, 7, 6, 1],
      play(v, s, i, t) {
        const pos = i % 8, bar = Math.floor(i / 8), ch = s.ch[bar], e = s.lead[i], sd = s.sd;
        if (e) choir(e.m, t, e.n * sd * 0.95, 0.06, v.mus, "o", 0.08);
        if (pos === 0) { ch.forEach((m) => choir(m - 12, t, sd * 9, 0.012, v.mus, "u")); bass(ch[0] - 12, t, sd * 4, 0.24, v.mus); }
        if (pos === 0 || pos === 4) { kick(t, 0.3, v.mus, 80); nz(t, t + 0.12, filt("lowpass", 500, 0, perc(v.mus, t, 0.06, 0.1))); }
        if (pos === 2 || pos === 6) anvil(t, 0.04, v.mus);
        if (pos === 7 && bar % 2 === 1) anvil(t, 0.02, v.mus);
      },
      beds(v) { bed(v, "bandpass", 350, 0.11, 0.07, 0.5, 1); bed(v, "bandpass", 1400, 0.018, 0.05, 0.3, 6); },
      amb(v, t) {
        if (p(0.05)) swell(t, 0.1, v.amb, "bandpass", 300, 900, 1.5 + R(), 2.5, 1);
        if (p(0.008)) rockfall(t, 0.08, v.amb);
        if (p(0.05)) { const lp = filt("lowpass", 1000, 0, v.amb); anvil(t, 0.02, lp); }
      } },
    // F major in three: harp arpeggios like running water, a plucked lead with an echo
    carrbridge: { root: 65, scale: MAJOR, sd: 60 / 84 / 2, bar: 6, mix: [3, 2.3],
      lead: ["5 - - - 6 5", "3 - - - 2 1", "2 - - 3 4 -", "3 - - - - -",
        "5 - - - 6 5", "1' - - - 7 6", "5 - 4 - 2 -", "1 - - - - -",
        "6 - - - 5 4", "5 - - - 4 3", "4 - - - 3 2", "3 - - - - -",
        "6 - 7 - 1' -", "2' - 1' - 6 -", "5 - 3 - 2 -", "1 - - - - -"],
      chords: [1, 6, 2, 1, 1, 4, 5, 1, 4, 1, 2, 1, 4, 2, 5, 1],
      setup(v, s) { v.echo = echo(v.mus, s.sd * 3, 0.3, 0.35, 2200); },
      play(v, s, i, t) {
        const pos = i % 6, bar = Math.floor(i / 6), ch = s.ch[bar], e = s.lead[i], sd = s.sd;
        if (e) pluck(e.m + 12, t, 0.26, v.echo, 4200, 1.8);
        const arp = [ch[0] - 24, ch[2] - 24, ch[0] - 12, ch[1] - 12, ch[2] - 12, ch[1] - 12];
        pluck(arp[pos], t, pos ? 0.11 : 0.18, v.mus, 1800, 1.2);
        if (pos === 0) ch.forEach((m) => padSaw(m - 12, t, sd * 7, 0.01, v.mus));
      },
      beds(v) { bed(v, "lowpass", 500, 0.09, 0.5, 0.4); bed(v, "bandpass", 1500, 0.028, 0.9, 0.5, 1.5); },
      amb(v, t) {
        for (let k = 0; k < 2; k++) if (p(2)) bubble(t + R() * AMB_STEP, 0.02, v.amb);
        if (p(0.15)) swell(t, 0.05, v.amb, "lowpass", 400, 900, 0.25, 0.6);
        if (p(0.04)) bird(t, 0.01, v.amb);
      } },
    // E phrygian: a lone breathy pipe in the mist over a fifth drone, with a far-off choir
    ashfen: { root: 64, scale: PHRYGIAN, sd: 60 / 60 / 2, bar: 8, mix: [1.2, 3.5],
      lead: [". . . . 1 - - -", "2 - 1 - - - - -", ". . 3 - 4 - 5 -", "4 - - - 3 - - -",
        ". . . . 5 - 6 -", "5 - 4 - 3 - 2 -", "1 - - - - - 7, -", "1 - - - - - . ."],
      chords: [1, 1, 1, 1, 1, 1, 1, 1],
      setup(v, s) { v.echo = echo(v.mus, s.sd * 1.5, 0.45, 0.5, 1600); },
      play(v, s, i, t) {
        const pos = i % 8, bar = Math.floor(i / 8), e = s.lead[i], sd = s.sd;
        if (e) pipe(e.m, t, e.n * sd * 0.95, 0.06, v.echo);
        if (pos === 0 && bar % 2 === 0) { drone(40, t, sd * 16 + 3, 0.09, v.mus, 3); drone(47, t, sd * 16 + 3, 0.05, v.mus, 3); }
        if (pos === 0 && bar % 4 === 2) { choir(76, t, sd * 14, 0.008, v.mus, "u"); choir(83, t + sd * 2, sd * 12, 0.006, v.mus, "u"); }
      },
      beds(v) { bed(v, "lowpass", 220, 0.08, 0.04, 0.3); bed(v, "bandpass", 700, 0.018, 0.08, 0.4, 1); },
      amb(v, t) {
        if (p(0.12)) frog(t, 0.035, v.amb);
        if (p(0.25)) drip(t, 0.025, v.amb);
        if (p(0.012)) heron(t, 0.03, v.amb);
      } },
    // A major woodland jig: a bright flute over wood blocks, a log drum and plucked strings
    hollowood: { root: 69, scale: MAJOR, sd: 60 / 126 / 2, bar: 8, mix: [1.7, 5],
      lead: ["1 2 3 5 6 - 5 3", "5 - - 3 2 - 1 -", "2 3 5 - 3 2 1 2", "3 - - - - - . .",
        "1 2 3 5 6 - 1' 6", "5 - - 6 5 3 2 -", "3 - 2 - 1 - 6, -", "1 - - - - - . .",
        "6 - 5 6 1' - 6 5", "3 - 5 - 6 - - -", "1' - 6 5 3 - 5 6", "5 - - - - - . .",
        "3 5 6 1' 2' - 1' 6", "5 - 6 - 3 - - -", "2 3 5 3 2 - 6, -", "1 - - - - . . ."],
      chords: [1, 1, 5, 1, 1, 1, 5, 1, 4, 1, 4, 5, 1, 1, 5, 1],
      play(v, s, i, t) {
        const pos = i % 8, bar = Math.floor(i / 8), ch = s.ch[bar], e = s.lead[i], sd = s.sd;
        if (e) flute(e.m, t, e.n * sd * 0.9, 0.06, v.mus);
        if ([0, 2, 3, 5, 6].includes(pos)) wood(t, pos === 0 ? 0.08 : 0.05, v.mus, pos % 3 ? 760 : 1020);
        if (pos === 0 || pos === 4) kick(t, 0.14, v.mus, 160);
        if (pos % 2 === 0) pluck([ch[0], ch[1], ch[2], ch[1]][pos / 2] - 12, t, 0.1, v.mus, 2400, 0.8);
        if (pos === 0) pluck(ch[0] - 24, t, 0.26, v.mus, 1200);
      },
      beds(v) { bed(v, "bandpass", 2600, 0.016, 0.15, 0.3, 0.7); bed(v, "lowpass", 300, 0.03, 0.08, 0.2); },
      amb(v, t) {
        if (p(0.55)) bird(t, 0.012 + R() * 0.01, v.amb);
        if (p(0.02)) woodpecker(t, 0.03, v.amb);
      } },
    // D dorian shanty in six-eight: squeezebox lead, oom-pah bass and a stomp
    saltmarrow: { root: 62, scale: DORIAN, sd: 0.3, bar: 6, mix: [1.7, 2.3],
      lead: ["1 - 1 3 - 5", "4 - 3 2 - -", "7, - 7, 2 - 4", "3 - 2 1 - -",
        "1 - 1 3 - 5", "6 - 5 4 - 3", "2 - 3 4 - 2", "1 - - - - .",
        "5 - 5 6 - 5", "4 - 3 4 - 5", "3 - 2 1 - 3", "2 - - - - .",
        "5 - 5 6 - 7", "1' - 7 6 - 5", "4 - 3 2 - 7,", "1 - - - - ."],
      chords: [1, 7, 7, 1, 1, 4, 7, 1, 1, 7, 1, 5, 1, 4, 7, 1],
      play(v, s, i, t) {
        const pos = i % 6, bar = Math.floor(i / 6), ch = s.ch[bar], e = s.lead[i], sd = s.sd;
        if (e) squeeze(e.m, t, e.n * sd * 0.92, 0.05, v.mus);
        if (pos === 0 || pos === 3) { pluck((pos ? ch[2] : ch[0]) - 24, t, pos ? 0.3 : 0.4, v.mus, 1200); kick(t, pos ? 0.12 : 0.2, v.mus, 95); }
        if (pos === 1 || pos === 4) ch.forEach((m) => squeeze(m - 12, t, sd * 0.5, 0.012, v.mus));
        if (pos === 3 && bar % 2 === 1) nz(t, t + 0.1, filt("bandpass", 1500, 1, perc(v.mus, t, 0.05, 0.08)));
      },
      setup(v) { v.wave = 0; },
      beds(v) { bed(v, "lowpass", 600, 0.05, 0.12, 0.3, 0, 0.13); bed(v, "highpass", 4000, 0.01, 0.1, 0.2); },
      amb(v, t) {
        if (t >= v.wave) { swell(t, 0.12, v.amb, "lowpass", 300, 1500, 1.4, 3.2); swell(t + 0.6, 0.03, v.amb, "highpass", 3000, 5000, 1.2, 2.5); v.wave = t + 6 + R() * 3; }
        if (p(0.07)) gull(t, 0.03, v.amb);
        if (p(0.04)) creak(t, 0.025, v.amb, 30);
        if (p(0.012)) bell(74, t, 0.02, filt("lowpass", 2000, 0, v.amb), 3);
      } },
    // B minor, very slow: a choral pad, a low hum, and sparse cold bells far apart
    frosthold: { root: 59, scale: MINOR, sd: 60 / 50, bar: 4, mix: [1.3, 2.3],
      lead: ["5' . . .", ". 3' . .", "2' . . 1'", ". . 7 .", "5' . . 3'", ". 4' . .", "3' . 2' .", ". . . 7"],
      chords: [1, 6, 3, 7, 1, 4, 6, 7],
      setup(v, s) { v.echo = echo(v.mus, s.sd * 0.75, 0.42, 0.45, 3000); },
      play(v, s, i, t) {
        const pos = i % 4, bar = Math.floor(i / 4), ch = s.ch[bar], e = s.lead[i], sd = s.sd;
        if (e) bell(e.m + 12, t, 0.03, v.echo, 3.5);
        if (pos === 0) ch.forEach((m) => choir(m, t, sd * 4 + 2, 0.018, v.mus, "o", 1.6));
        if (pos === 0 && bar % 2 === 0) { drone(35, t, sd * 8 + 3, 0.08, v.mus, 3); drone(42, t, sd * 8 + 3, 0.04, v.mus, 3); }
      },
      beds(v) { bed(v, "bandpass", 700, 0.09, 0.06, 0.6, 1.5); bed(v, "bandpass", 1800, 0.022, 0.09, 0.3, 8); bed(v, "lowpass", 120, 0.05, 0.05, 0.2); },
      amb(v, t) {
        if (p(0.07)) creak(t, 0.035, v.amb, 25 + R() * 20, 0.7 + R() * 0.8);
        if (p(0.05)) swell(t, 0.08, v.amb, "bandpass", 500, 1300, 1.5 + R(), 3, 1.2);
        if (p(0.05)) bell(100 + Math.floor(R() * 6), t, 0.008, v.amb, 1);
      } },
  };
  for (const tw of Object.values(TOWNS)) {
    tw.s = { root: tw.root, sd: tw.sd, lead: line(tw.lead, tw.root, tw.scale), ch: tw.chords.map((d) => triad(d, tw.root, tw.scale)) };
    tw.len = tw.lead.length * tw.bar;
  }

  // ---------- playback ----------
  function voice(id, t, fade) {
    const tw = TOWNS[id], v = { id, tw, mus: ctx.createGain(), amb: ctx.createGain(), nodes: [], step: 0, next: t, ambNext: t };
    v.mus.connect(musBus); v.amb.connect(ambBus);
    // per-town trims even out how loud the eight themes and beds land
    [v.mus, v.amb].forEach((g, k) => {
      if (fade) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(tw.mix[k], t + FADE); } else g.gain.value = tw.mix[k];
    });
    if (tw.setup) tw.setup(v, tw.s);
    tw.beds(v);
    return v;
  }
  function schedule(v, horizon) {
    const tw = v.tw;
    while (v.next < horizon) { tw.play(v, tw.s, v.step % tw.len, v.next); v.next += tw.sd; v.step++; }
    while (v.ambNext < horizon) { tw.amb(v, v.ambNext + R() * AMB_STEP); v.ambNext += AMB_STEP; }
  }
  function tick() {
    if (!cur || !ctx || !prefs.on || ctx.state !== "running") return;
    const t = ctx.currentTime;
    if (cur.next < t) { cur.next = t + 0.05; cur.ambNext = t + 0.05; }
    schedule(cur, t + AHEAD);
  }
  function release(v) {
    if (!v) return;
    const t = ctx.currentTime;
    for (const g of [v.mus, v.amb]) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + FADE);
    }
    setTimeout(() => {
      for (const n of v.nodes) { try { n.stop(); } catch (e) { /* already stopped */ } }
      v.mus.disconnect(); v.amb.disconnect();
    }, (FADE + AHEAD + 0.3) * 1000);
  }
  function play(id) {
    if (!TOWNS[id]) { stop(); return; }
    want = id;
    prefs = readPrefs();
    if (!unlocked || !prefs.on || !init()) return;
    if (ctx.state === "suspended" && !document.hidden) ctx.resume();
    levels();
    if (cur && cur.id === id) return;
    release(cur);
    cur = voice(id, ctx.currentTime + 0.1, true);
    if (window.Sound && Sound.townAmbience) Sound.townAmbience(true);
    if (!timer) timer = setInterval(tick, TICK);
    tick();
  }
  function stop() {
    want = null;
    if (cur && window.Sound && Sound.townAmbience) Sound.townAmbience(false);
    if (cur) { release(cur); cur = null; }
    if (timer) { clearInterval(timer); timer = null; }
  }
  function refresh() {
    levels();
    if (!prefs.on && cur) { const w = want; release(cur); cur = null; want = w; }
    else if (prefs.on && want && !cur && unlocked) play(want);
  }

  // renders a town offline (no unlock or settings involved) for the preview page's checks
  function render(id, secs, sr, mix) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, rate = sr || 22050;
    if (!OAC || !TOWNS[id]) return Promise.reject(new Error("no offline audio or unknown town"));
    const off = new OAC(1, Math.ceil(rate * secs), rate), saved = [ctx, master, musBus, ambBus, noiseBuf];
    try {
      ctx = off; noiseBuf = makeNoise(off); master = off.createGain(); musBus = off.createGain(); ambBus = off.createGain();
      master.gain.value = 0.7; musBus.gain.value = mix ? mix.music : 0.35; ambBus.gain.value = mix ? mix.amb : 0.25;
      musBus.connect(master); ambBus.connect(master); master.connect(off.destination);
      const v = voice(id, 0, false);
      schedule(v, secs);
      for (const n of v.nodes) n.stop(secs);
    } finally { [ctx, master, musBus, ambBus, noiseBuf] = saved; }
    return off.startRendering();
  }

  document.addEventListener("pointerdown", () => {
    if (unlocked) return;
    unlocked = true;
    if (want) play(want);
  }, { capture: true });
  if (window.Settings) Settings.watch(refresh);
  window.addEventListener("hashchange", () => { if (!/^#\/map/.test(location.hash)) stop(); });
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (cur) ctx.resume();
  });

  window.TownMusic = { play, stop, render, get current() { return cur ? cur.id : null; },
    towns: Object.keys(TOWNS), loopSeconds: (id) => (TOWNS[id] ? TOWNS[id].len * TOWNS[id].sd : 0) };
})();
