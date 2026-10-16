/* Music: the campfire and tavern songs' engine. `plan(spec)` turns a song (a folk tune's notes, or a song's lines and chorus) and its
   performers into a timeline of sung syllables, instrument notes, claps and pot-knocks, deterministic from the record id; `perform(plan)`
   plays it on audio.js's context and Music bus with chiptune voices synthesised in WebAudio (no files). Scenes read the same plan to time
   the lyrics and the joiners. Good and bad singing come from the lead's skill and the night's outcome: bad is funny, never painful. */
(function (root) {
  "use strict";
  // ---------- small deterministic helpers ----------
  const hash = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function syllables(line) {
    const out = [];
    for (const w of String(line).split(/\s+/).filter(Boolean)) {
      const parts = w.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$|[^aeiouy](?=[^aeiouy]))?/gi);
      (parts && parts.join("").length === w.length ? parts : [w]).forEach((p, i, arr) => out.push({ txt: p, end: i === arr.length - 1 }));
    }
    return out;
  }

  // ---------- keys, modes and progressions by tone (chords are scale-degree roots) ----------
  const MODES = {
    tender: { scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 3, 4, 0], [0, 5, 3, 4]], swing: 0 },
    funny: { scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 4, 0, 4], [0, 3, 4, 0]], swing: 0.35 },
    dark: { scale: [0, 2, 3, 5, 7, 8, 10], prog: [[0, 5, 6, 4], [0, 3, 0, 4]], swing: 0 },
    rowdy: { scale: [0, 2, 4, 5, 7, 9, 10], prog: [[0, 6, 3, 0], [0, 3, 6, 0]], swing: 0.2 },
    sad: { scale: [0, 2, 3, 5, 7, 8, 10], prog: [[0, 3, 5, 4], [0, 5, 3, 4]], swing: 0 },
    heroic: { scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 4, 5, 3], [0, 3, 4, 4]], swing: 0 },
    odd: { scale: [0, 2, 3, 5, 7, 9, 10], prog: [[0, 3, 0, 6], [0, 6, 3, 4]], swing: 0.1 },
  };
  const UNITS = { "3/4": 6, "4/4": 8, "6/8": 6 };
  const BEAT_UNITS = { "3/4": 2, "4/4": 2, "6/8": 3 };
  // the night's result pulls the heard skill toward it: a sim "sore" sounds sore even from a decent singer
  const OUTCOME_SKILL = { soaring: 0.95, sweet: 0.75, rough: 0.45, mess: 0.22, sore: 0.08 };
  const INSTS = ["lute", "fiddle", "flute", "drum", "horn", "bagpipes"];

  function degMidi(mode, root, d) {
    const n = mode.scale.length, o = Math.floor(d / n), i = ((d % n) + n) % n;
    return root + o * 12 + mode.scale[i];
  }
  const chordTones = (c) => [c, c + 2, c + 4];
  function nearestChordTone(d, c) {
    let best = d, bd = 99;
    for (const t of chordTones(c)) for (const o of [-7, 0, 7]) { const x = t + o; if (Math.abs(x - d) < bd) { bd = Math.abs(x - d); best = x; } }
    return best;
  }

  // ---------- folk tunes: ABC-lite (league/content/folk_tunes.py) ----------
  const TOKEN = /^(z|[_^=]?[A-Ga-g][',]*)(\d+)$/;
  function folkMidi(p) {
    const acc = { "^": 1, _: -1, "=": 0 }[p[0]] || 0, q = p.replace(/^[_^=]/, ""), letter = q[0];
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter.toUpperCase()];
    const octave = (letter === letter.toLowerCase() ? 5 : 4) + (q.match(/'/g) || []).length - (q.match(/,/g) || []).length;
    return 12 * (octave + 1) + base + acc;
  }
  function parseFolk(notes) {
    return notes.split("|").map((bar) => bar.trim().split(/\s+/).filter(Boolean).map((tok) => {
      const m = TOKEN.exec(tok);
      if (!m) return [null, 1];
      return [m[1] === "z" ? null : folkMidi(m[1]), +m[2]];
    }));
  }

  // ---------- the plan ----------
  // spec: { id, meter, bpm, tone, diff, outcome, part: "short" | "full", folk?: {notes}, lines?, chorus?, resp? (call-and-response: the lines the crew sing back),
  //         lead: {id, skill, inst?, voice?}, joiners: [{id, how, inst?, skill, voice?}], pets: [{kind}] }
  // returns { len, unit, bar, notes: [{t, d, m, who, part, inst?, syl?, line?, w?, vol, crack?, vib?}], hits: [{t, kind, who, vol}],
  //           chords: [{t, d, m: [midi]}], lines: [{t0, t1, text, chorus, words: [{t, txt, held, sour}]}], cues: [{t, kind, who?}] }
  function plan(spec) {
    const r = rngOf(hash("music:" + spec.id)), tone = MODES[spec.tone] ? spec.tone : "tender", mode = MODES[tone];
    const meter = UNITS[spec.meter] ? spec.meter : "4/4", U = UNITS[meter], BU = BEAT_UNITS[meter];
    const bpm = clamp(spec.bpm || 96, 56, 140) * (meter === "6/8" && !spec.folk ? 0.85 : 1);
    const unit = meter === "6/8" ? 60 / bpm / 3 : 60 / bpm / 2, bar = U * unit;
    const lead = spec.lead || {}, joiners = (spec.joiners || []).slice(0, 6);
    const sk = clamp((lead.skill || 0.3) * 0.65 + (OUTCOME_SKILL[spec.outcome] == null ? 0.45 : OUTCOME_SKILL[spec.outcome]) * 0.35, 0, 1), bad = 1 - sk;
    const voice = lead.voice || { pitch: 62 };
    const P = { len: 0, unit, bar, bpm, meter, tone, notes: [], hits: [], chords: [], lines: [], cues: [], lead: lead.id, skill: sk, inst: lead.inst || null };
    const ROOT = spec.folk ? 0 : 55 + (hash(spec.id + "key") % 7);
    // the melody's register follows the singer's speaking voice, so a hero sings in the voice they talk in
    const shiftFor = (mids) => { const s = mids.slice().sort((a, b) => a - b), med = s[Math.floor(s.length / 2)] || 62; return Math.round((voice.pitch + 4) - med); };
    let t = 0;
    const intro = spec.folk ? 1 : 2;
    const prog = mode.prog[hash(spec.id + "prog") % mode.prog.length];

    // sections: [{line idx, chorus}] in performance order
    const sections = [];
    let melodies = [];
    if (spec.folk) {
      const bars = parseFolk(spec.folk.notes);
      const want = spec.part === "full" ? bars.length : Math.min(bars.length, Math.max(8, Math.round(24 / bar)));
      const use = bars.slice(0, want);
      // phrase the tune into four-bar "lines" so a hummed tune breathes and the scene has beats to hang on
      for (let i = 0; i < use.length; i += 4) melodies.push({ text: null, chorus: false, notes: [].concat(...use.slice(i, i + 4).map((b, k) => b.map((n) => n.concat([i + k])))) });
      melodies.forEach((m, i) => sections.push({ i, chorus: i % 2 === 1 }));
    } else {
      const lines = spec.lines || [], ch = new Set(spec.chorus || []);
      const verse = lines.map((_, i) => i).filter((i) => !ch.has(i)), chorus = lines.map((_, i) => i).filter((i) => ch.has(i));
      const verses = [];
      for (let i = 0; i < verse.length; i += 2) verses.push(verse.slice(i, i + 2));
      if (!verses.length) verses.push([]);
      const order = spec.part === "full" ? verses.flatMap((v, k) => v.map((i) => ({ i, chorus: false })).concat(chorus.map((i) => ({ i, chorus: true, last: k === verses.length - 1 }))))
        .concat(chorus.map((i) => ({ i, chorus: true, last: true, reprise: true }))) : verses[0].map((i) => ({ i, chorus: false })).concat(chorus.map((i) => ({ i, chorus: true, last: true })));
      sections.push(...order);
      // call and response: the lines in resp are the crew's answer to the lead's call
      const rs = new Set(spec.resp || []);
      melodies = lines.map((text, i) => ({ text, chorus: ch.has(i), resp: rs.has(i) }));
    }

    // ---- melody for a song line: one syllable per note, the last held; verse lines alternate a question and an answer ----
    const memo = {};
    function lineTune(i, sec) {
      if (memo[i]) return memo[i];
      const m = melodies[i], lr = rngOf(hash(spec.id + ":line:" + i)), syl = syllables(m.text || "la");
      let barsN = 2;
      while (syl.length > barsN * U - 2) barsN++;
      const total = barsN * U, rest = total - syl.length >= 3 ? 1 : 0;
      const dur = syl.map(() => 1);
      let extra = total - rest - syl.length;
      const hold = Math.min(extra, Math.ceil(U / 2) + (lr() < 0.4 ? 1 : 0));
      dur[dur.length - 1] += hold; extra -= hold;
      // stretch the stressed syllables first: on the beat, then every other
      for (let pass = 0; extra > 0 && pass < 8; pass++) {
        let pos = 0;
        for (let k = 0; k < dur.length - 1 && extra > 0; k++) {
          if (pos % BU === 0 && (lr() < 0.55 + pass * 0.1)) { dur[k]++; extra--; }
          pos += dur[k];
        }
      }
      if (extra > 0) dur[dur.length - 1] += extra;
      const answer = sections.findIndex((s) => s.i === i) % 2 === 1 || m.chorus;
      let d = [0, 2, 4][Math.floor(lr() * 3)] + (m.chorus ? 2 : 0);
      const degs = [];
      let pos = 0;
      dur.forEach((u, k) => {
        const barIx = Math.floor(pos / U), c = prog[(barIx + (m.chorus ? 2 : 0)) % prog.length];
        if (k === dur.length - 1) d = answer ? (Math.abs(d - 7) < Math.abs(d) ? 7 : 0) : nearestChordTone(4, prog[3 % prog.length]) === 4 ? 4 : 1;
        else {
          d += [-1, 1, 1, -1, 2, -2, 0, 1, -1][Math.floor(lr() * 9)];
          if (pos % BU === 0) d = nearestChordTone(d, c);
          d = clamp(d, -2, 9);
        }
        degs.push(d);
        pos += u;
      });
      return (memo[i] = { syl, dur, degs, bars: barsN, total });
    }

    // ---- the lead's voice: drift, wobble, cracks (bad singers); steadiness and vibrato (good ones) ----
    const ln = rngOf(hash(spec.id + ":sing"));
    const leadSings = !spec.folk || !lead.inst;
    const leadPlays = !!lead.inst;
    let lastShift = null;
    const joinAt = {};
    // the sim's joining order: the first joiner comes in on the second verse line, the rest on the chorus
    joiners.forEach((j, k) => { joinAt[j.id] = k === 0 ? 1 : 2; });
    let lineNo = 0;

    // intro: the lead's instrument (or the first player) plays the opening, everyone else waits
    // a slow song gets one bar in, so the verse and chorus still fit about half a minute
    const introBars = (leadPlays || joiners.some((j) => j.how === "inst")) && bar < 2.6 ? intro : 1;
    for (let b = 0; b < introBars; b++) {
      const c = prog[b % prog.length];
      P.chords.push({ t: t + b * bar, d: bar, deg: c, m: chordTones(c).map((x) => degMidi(mode, ROOT || 57, x) - 12) });
    }
    if (!leadPlays && !joiners.some((j) => j.how === "inst")) P.hits.push({ t: t + bar * 0.5, kind: "count", who: lead.id, vol: 0.4 }, { t: t + bar * 0.75, kind: "count", who: lead.id, vol: 0.4 });
    t += introBars * bar;
    P.cues.push({ t: 0, kind: "start" });

    sections.forEach((sec, si) => {
      const m = melodies[sec.i], start = t;
      if (sec.chorus && (si === 0 || !sections[si - 1].chorus)) P.cues.push({ t, kind: "chorus" });
      lineNo++;
      for (const j of joiners) if (joinAt[j.id] && ((joinAt[j.id] === 1 && lineNo === 2) || (joinAt[j.id] === 2 && sec.chorus))) { P.cues.push({ t, kind: "join", who: j.id, how: j.how }); joinAt[j.id] = 0; }
      const L = { t0: t, t1: t, text: m.text, chorus: !!sec.chorus, resp: !!m.resp, idx: sec.i, words: [],
        along: sec.chorus || m.resp ? joiners.filter((j) => j.how === "sing" || j.how === "over" || j.how === "inst").map((j) => j.id) : [] };
      let notes;
      if (spec.folk) {
        const mids = m.notes.filter((n) => n[0] != null).map((n) => n[0]);
        const sh = lastShift == null ? (lastShift = leadSings ? shiftFor(mids) : 0) : lastShift;
        notes = [];
        let u = 0;
        const barT = {};
        for (const [mm, n, b] of m.notes) {
          if (barT[b] == null) barT[b] = u;
          if (mm != null) notes.push({ u, n, m: mm + sh, syl: ["loo", "la", "dee", "da"][notes.length % 4] });
          u += n;
        }
        for (const b of Object.keys(barT)) {
          const bt = start + barT[b] * unit, inBar = notes.filter((x) => x.u >= barT[b] && x.u < barT[b] + U);
          // the bar's chord: the scale triad whose tones best cover its notes (folk tunes come without chords)
          const pcs = inBar.map((x) => ((x.m - sh) % 12 + 12) % 12);
          const tonic = ((m.notes.filter((x) => x[0] != null).slice(-1)[0] || [57])[0]) % 12;
          let best = [tonic, tonic + 4, tonic + 7], bs = -1;
          for (const off of [0, 5, 7, 9, 2]) for (const q of [4, 3]) {
            const tri = [tonic + off, tonic + off + q, tonic + off + 7].map((x) => x % 12), sc = pcs.filter((p) => tri.includes(p)).length - (q === 3 && off === 0 ? 0.1 : 0);
            if (sc > bs) { bs = sc; best = tri; }
          }
          P.chords.push({ t: bt, d: U * unit, m: best.map((pc) => 48 + pc) });
        }
        L.t1 = start + u * unit;
        notes.forEach((x, k) => {
          const at = start + x.u * unit, d = x.n * unit;
          if (leadPlays) P.notes.push({ t: at, d, m: x.m - (leadSings ? sh : 0) + (lead.inst === "flute" ? 12 : 0), who: lead.id, part: "inst", inst: lead.inst, vol: 0.2 });
          if (leadSings) P.notes.push({ t: at + (ln() - 0.5) * 0.06 * bad, d: d * 0.92, m: x.m + wobble(k, notes.length, sec), who: lead.id, part: "hum", syl: x.syl, line: si, vol: 0.3, vib: sk > 0.6 && d > 0.4 });
        });
        t = L.t1;
      } else {
        const tune = lineTune(sec.i, sec);
        const mids = tune.degs.map((d) => degMidi(mode, ROOT, d));
        const sh = lastShift == null ? (lastShift = shiftFor(mids)) : lastShift;
        let u = 0, word = -1;
        const rush = (ln() - 0.5) * 0.1 * bad;
        tune.syl.forEach((s, k) => {
          if (k === 0 || tune.syl[k - 1].end) word++;
          const at = start + u * unit + rush * (u / tune.total) + (ln() - 0.5) * 0.08 * bad, d = tune.dur[k] * unit;
          const mm = mids[k] + sh, high = tune.degs[k] >= Math.max(...tune.degs) - 1;
          const crack = high && ln() < 0.4 * bad * (0.5 + (spec.diff || 3) / 6);
          const off = wobble(k, tune.syl.length, sec);
          P.notes.push({ t: at, d: d * 0.94, m: mm + off, who: lead.id, part: "voice", syl: s.txt, line: si, w: word, vol: sec.chorus ? 0.26 : m.resp && L.along.length ? 0.2 : 0.3, crack, vib: sk > 0.55 && tune.dur[k] >= 2 });
          if (s.end) {
            const txt = m.text.split(/\s+/)[word] || s.txt;
            L.words.push({ t: at, txt, held: tune.dur[k] >= Math.ceil(U / 2) + 1, sour: Math.abs(off) > 0.7 || crack });
          }
          if (leadPlays && (lead.inst !== "drum")) P.notes.push({ t: start + u * unit, d: d * 0.9, m: mm - sh + (lead.inst === "flute" ? 12 : lead.inst === "horn" ? -12 : 0), who: lead.id, part: "inst", inst: lead.inst, vol: 0.11 });
          u += tune.dur[k];
        });
        // a word lands when its first syllable is sung
        const firstOf = [];
        tune.syl.forEach((s, k) => { if (k === 0 || tune.syl[k - 1].end) firstOf.push(k); });
        const vnotes = P.notes.filter((n) => n.part === "voice" && n.line === si);
        L.words.forEach((w, k) => { const n = vnotes[firstOf[k]]; if (n) w.t = n.t; });
        for (let b = 0; b < tune.bars; b++) {
          const n = Math.round((start - introBars * bar) / bar) + b, c = prog[((n % prog.length) + prog.length) % prog.length];
          P.chords.push({ t: start + b * bar, d: bar, deg: c, m: chordTones(c).map((x) => degMidi(mode, ROOT, x) + sh - 12) });
        }
        t = start + tune.total * unit;
        L.t1 = t;
      }
      P.lines.push(L);
    });
    // the last chord rings out
    const endC = P.chords.length ? P.chords[P.chords.length - 1] : null;
    P.chords.push({ t, d: bar * 1.5, deg: 0, m: endC ? (spec.folk ? endC.m : chordTones(0).map((x) => degMidi(mode, ROOT, x) + (lastShift || 0) - 12)) : [48, 52, 55], last: true });
    P.cues.push({ t, kind: "end" });
    P.len = t + bar * 1.5;

    // ---- accompaniment: the lead's instrument, then each joiner in their own way from the moment they come in ----
    const joinT = {};
    for (const c of P.cues) if (c.kind === "join") joinT[c.who] = c.t;
    const accomp = (who, inst, from, vol, sk2) => {
      const ar = rngOf(hash(spec.id + ":acc:" + who));
      for (const c of P.chords) {
        if (c.t + 0.01 < from) continue;
        const beats = Math.round(c.d / (BU * unit)), bt = BU * unit;
        const jit = () => (ar() - 0.5) * 0.05 * (1 - sk2);
        if (inst === "lute") for (let b = 0; b < Math.max(1, beats); b++) P.notes.push({ t: c.t + b * bt + jit(), d: bt * 1.6, m: c.m[(b % 3)] + (b === 0 ? -12 : 0), who, part: "acc", inst, vol: vol * (b === 0 ? 1.2 : 0.8) });
        else if (inst === "fiddle") P.notes.push({ t: c.t + jit(), d: c.d * 0.96, m: c.m[0] + 12, who, part: "acc", inst, vol: vol * 0.7 }, { t: c.t + jit(), d: c.d * 0.96, m: c.m[2] + 12, who, part: "acc", inst, vol: vol * 0.5 });
        else if (inst === "flute") { for (let b = 0; b < beats; b += 1) P.notes.push({ t: c.t + b * bt + bt * 0.5 + jit(), d: bt * 0.45, m: c.m[(b + 1) % 3] + 24, who, part: "acc", inst, vol: vol * 0.6 }); }
        else if (inst === "horn") P.notes.push({ t: c.t + jit(), d: c.d * 0.9, m: c.m[0], who, part: "acc", inst, vol: vol * 0.8 });
        else if (inst === "bagpipes") P.notes.push({ t: c.t, d: c.d, m: c.m[0] - 12, who, part: "drone", inst, vol: vol * 0.45 }, { t: c.t + jit(), d: c.d * 0.5, m: c.m[2] + 12, who, part: "acc", inst, vol: vol * 0.5 });
        else if (inst === "drum") for (let b = 0; b < Math.max(1, beats); b++) P.hits.push({ t: c.t + b * bt + jit(), kind: b === 0 ? "drum" : "slap", who, vol: vol * (b === 0 ? 1.4 : 0.9) });
      }
    };
    if (leadPlays) accomp(lead.id, lead.inst, 0, 0.16, sk);
    for (const j of joiners) {
      const from = joinT[j.id] == null ? P.len : joinT[j.id], js = clamp(j.skill || 0.3, 0, 1);
      if (j.how === "inst" && j.inst) accomp(j.id, j.inst, from, 0.12, js);
      else if (j.how === "clap" || j.how === "pot") {
        const jr = rngOf(hash(spec.id + ":hit:" + j.id)), bt = BU * unit;
        for (let x = from; x < t; x += bt) {
          const beat = Math.round((x - from) / bt);
          if (j.how === "clap" && (meter === "3/4" ? beat % 3 !== 0 : beat % 2 === 1)) P.hits.push({ t: x + (jr() - 0.5) * 0.07 * (1 - js), kind: "clap", who: j.id, vol: 0.5 });
          if (j.how === "pot") P.hits.push({ t: x + (beat % 2 ? bt * 0.5 : 0) + (jr() - 0.5) * 0.06 * (1 - js), kind: "pot", who: j.id, vol: beat % 2 ? 0.35 : 0.5 });
        }
      }
      if (j.how === "sing" || j.how === "over" || j.how === "inst") {
        // sing-alongs double the chorus in their own voice; a good one finds the third above, a rival sings it louder and a hair early
        const jr = rngOf(hash(spec.id + ":along:" + j.id));
        const harm = j.how === "sing" && js > 0.55 && jr() < 0.6;
        for (const n of P.notes.filter((x) => (x.part === "voice" || x.part === "hum") && x.who === lead.id && x.t >= from - 0.01 && P.lines[x.line] && (P.lines[x.line].chorus || P.lines[x.line].resp))) {
          P.notes.push({ t: n.t + (j.how === "over" ? -0.04 : (jr() - 0.5) * 0.06 * (1 - js)), d: n.d, m: n.m + (harm ? 4 : 0) + (jr() - 0.5) * (1 - js) * 0.8,
            who: j.id, part: "along", syl: n.syl, line: n.line, vol: j.how === "over" ? 0.3 : 0.11, over: j.how === "over" });
        }
      }
    }
    for (const p of (spec.pets || []).slice(0, 1)) {
      const lastCh = P.lines.filter((l) => l.chorus).slice(-1)[0];
      if (lastCh && /howl/.test(p.does || "")) P.hits.push({ t: lastCh.t1 - bar * 0.5, kind: "howl", who: p.owner, vol: 0.6 });
    }
    P.notes.sort((a, b) => a.t - b.t);
    P.hits.sort((a, b) => a.t - b.t);
    return P;

    // pitch error in semitones: a bad singer drifts flat across a verse line and snaps back at the chorus; capped so it's funny, not painful
    function wobble(k, n, sec) {
      const drift = -Math.min(1.5, 1.7 * Math.pow(bad, 1.6)) * (k / Math.max(1, n - 1)) * (sec.chorus ? 0.45 : 1);
      const jitter = (ln() - 0.5) * 1.3 * Math.pow(bad, 1.2);
      return clamp(drift + jitter, -1.5, 1.5);
    }
  }

  // ---------- the league's event ballads (the Songs page's bard) ----------
  // the bard's tunes are kept note for note from before the ballads moved onto this engine, so a ballad the league already knows
  // still goes the way it always went; one syllable per step, the line's last held, a lute arpeggio and a hat on the off-beats
  const BALLAD = { glory: { scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 7, 9, 5], bpm: 112, root: 60 }, sad: { scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 8, 3, 10], bpm: 76, root: 57 },
    shame: { scale: [0, 2, 4, 5, 7, 9, 10], prog: [0, 10, 5, 0], bpm: 132, root: 62 } };
  const BARD = { pitch: 60, timbre: "buzzy", formant: 1, vib: 0.5 };
  function ballad(song) {
    const mode = BALLAD[song.mood] || BALLAD.glory, r = rngOf(song.seed || 7), beat = 60 / mode.bpm;
    const P = { len: 0, unit: beat / 2, bar: beat * 4, bpm: mode.bpm, notes: [], hits: [], chords: [], lines: [], cues: [], lead: "bard", skill: 0.85, inst: "lute" };
    const motif = {}, stepLen = beat * (song.mood === "sad" ? 1 : 0.5);
    let t = 0, deg = 2;
    (song.lyrics || []).forEach((line, li) => {
      // each chorus line keeps its own tune every time it comes back; a ballad that only repeats its title has one, as it always did
      const syls = syllables(line), chorus = isChorus(song, line);
      if (chorus && !motif[line]) motif[line] = syls.map(() => (deg = clamp(deg + [-1, 1, 1, 2, -2, 0][Math.floor(r() * 6)], 0, 9)));
      const notes = chorus && motif[line] ? motif[line] : syls.map((_, i) => (i === syls.length - 1 ? [0, 2, 4][Math.floor(r() * 3)] : (deg = clamp(deg + [-1, 1, -1, 2, -2, 1, 0][Math.floor(r() * 7)], 0, 9))));
      const L = { t0: t, t1: t, text: line, chorus, idx: li, words: [], along: [] };
      syls.forEach((syl, si) => {
        const d = notes[si] % 7, oct = Math.floor(notes[si] / 7) * 12, len = si === syls.length - 1 ? stepLen * 2 : stepLen;
        P.notes.push({ t, d: Math.max(0.09, len * 0.85), m: mode.root + mode.scale[d] + oct, who: "bard", part: "voice", syl: syl.txt, line: li, si, vol: 0.24, cue: true, vib: len > 0.5 });
        t += len;
      });
      L.t1 = t;
      P.lines.push(L);
      t += beat;
    });
    const end = t + beat * 2;
    for (let bt = 0, i = 0; bt < end; bt += beat, i++) {
      const base = mode.root - 12 + mode.prog[Math.floor(i / 4) % mode.prog.length];
      if (i % 4 === 0) P.notes.push({ t: bt, d: beat, m: base - 12, who: "bard", part: "acc", inst: "lute", vol: 0.5 / 2.6 });
      P.notes.push({ t: bt + (song.mood === "shame" ? beat * 0.5 : 0), d: beat, m: base + [0, 4, 7, 12][i % 4] + (mode.scale[2] === 3 && i % 4 === 1 ? -1 : 0), who: "bard", part: "acc", inst: "lute", vol: 0.22 / 2.6 });
      if (song.mood !== "sad" && i % 2 === 1) P.hits.push({ t: bt, kind: "hat", who: "bard", vol: 0.08 });
    }
    P.notes.sort((a, b) => a.t - b.t);
    P.cues.push({ t: 0, kind: "start" }, { t: end, kind: "end" });
    P.len = end;
    return P;
  }

  // a ballad's chorus: its title as a line of its own, or any line that comes back word for word
  function isChorus(song, line) {
    return line === song.title || (song.lyrics || []).filter((x) => x === line).length > 1;
  }

  // ---------- voices (WebAudio, on audio.js's context) ----------
  const VOWELS = { a: [760, 1180], e: [480, 1850], i: [330, 2250], o: [520, 880], u: [380, 820], y: [330, 2150] };
  function env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, hold));
    g.gain.linearRampToValueAtTime(0.0001, t + Math.max(a, hold) + rel);
  }
  function osc(E, type, f, t, end) { const o = E.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(end); return o; }
  function noise(E, t, dur, vol, type, freq, q, dest) {
    const c = E.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = E.noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, (t * 7.31) % 1.5); s.stop(t + dur + 0.05);
  }
  const ksCache = new WeakMap();
  function pluck(E, midi, t, vol, dest) {
    const c = E.ctx, m = Math.round(midi);
    let cache = ksCache.get(c);
    if (!cache) ksCache.set(c, (cache = {}));
    if (!cache[m]) {
      const sr = c.sampleRate, n = Math.floor(sr * 1.6), b = c.createBuffer(1, n, sr), x = b.getChannelData(0);
      const period = Math.max(2, Math.round(sr / mtof(m))), ring = new Float32Array(period), r = rngOf(m * 7919);
      for (let i = 0; i < period; i++) ring[i] = r() * 2 - 1;
      for (let i = 0, p = 0; i < n; i++) { const nx = (p + 1) % period, v = (ring[p] + ring[nx]) * 0.4985; x[i] = ring[p]; ring[p] = v; p = nx; }
      cache[m] = b;
    }
    const s = c.createBufferSource(), g = c.createGain(), lp = c.createBiquadFilter();
    s.buffer = cache[m]; lp.type = "lowpass"; lp.frequency.value = 3200;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    s.connect(lp); lp.connect(g); g.connect(dest); s.start(t); s.stop(t + 1.6);
  }
  function drum(E, t, vol, dest) {
    const o = osc(E, "sine", 120, t, t + 0.32), g = E.ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(dest);
    noise(E, t, 0.08, vol * 0.4, "lowpass", 1800, 0, dest);
  }
  function vibrato(E, o, t, end, rate, depth, delay) {
    const l = E.ctx.createOscillator(), lg = E.ctx.createGain();
    l.frequency.value = rate; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(depth, t + delay);
    l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(end);
  }
  // a sung syllable in a hero's own voice: their pitch, timbre and formant colour from the talking text (Speech.voiceOf)
  function sung(E, v, n, t, dest, quiet) {
    const c = E.ctx, vw = (String(n.syl || "a").toLowerCase().match(/[aeiouy]/) || ["a"])[0], [fa, fb] = VOWELS[vw], k = (v && v.formant) || 1;
    const len = Math.max(0.09, n.d), f0 = mtof(n.m), end = t + len + 0.08, vol = n.vol * (quiet || 1);
    const o = osc(E, v && v.timbre === "soft" ? "triangle" : v && v.timbre === "chirpy" ? "square" : "sawtooth", f0 * 0.97, t, end);
    o.frequency.exponentialRampToValueAtTime(f0, t + 0.05);
    if (n.crack) {
      // the high note cracks up an octave for a blink, then slides back down a little flat: a laugh, not a wince
      o.frequency.setValueAtTime(f0 * 1.9, t + len * 0.35); o.frequency.exponentialRampToValueAtTime(f0 * 0.96, t + len * 0.5);
    }
    if (n.vib) vibrato(E, o, t, end, 5.4 + ((v && v.vib) || 0) * 2, f0 * 0.012, Math.min(0.25, len * 0.4));
    const g = c.createGain(), mix = c.createGain(), lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = v && v.timbre === "chirpy" ? 2600 * k : 3200;
    mix.gain.value = v && v.timbre === "soft" ? 0.6 : 1;
    for (const [f, q, a] of [[fa * k, 6, 1.6], [fb * k, 8, 1.1]]) {
      const bp = c.createBiquadFilter(), ga = c.createGain();
      bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q; ga.gain.value = a;
      o.connect(bp); bp.connect(ga); ga.connect(mix);
    }
    if (v && v.timbre === "soft") { const dg = c.createGain(); dg.gain.value = 0.5; o.connect(dg); dg.connect(mix); }
    mix.connect(lp); lp.connect(g); g.connect(dest);
    env(g, t, 0.025, vol * (n.crack ? 0.7 : 1), len * 0.75, len * 0.25 + 0.05);
    if (n.syl && /^[^aeiouy]/i.test(n.syl) && n.part !== "hum") noise(E, t, 0.03, vol * 0.25, "highpass", 3200, 0, dest);
  }
  const INST = {
    lute(E, n, t, dest) { pluck(E, n.m, t, n.vol * 2.6, dest); },
    fiddle(E, n, t, dest) {
      const c = E.ctx, end = t + n.d + 0.1, f = mtof(n.m), o = osc(E, "sawtooth", f, t, end), bp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain();
      bp.type = "peaking"; bp.frequency.value = 900; bp.gain.value = 6; bp.Q.value = 1.2; lp.type = "lowpass"; lp.frequency.value = 3600;
      vibrato(E, o, t, end, 5.6, f * 0.006, Math.min(0.3, n.d * 0.5));
      o.connect(bp); bp.connect(lp); lp.connect(g); g.connect(dest);
      env(g, t, 0.07, n.vol, n.d * 0.85, 0.08);
      noise(E, t, Math.min(0.12, n.d), n.vol * 0.12, "bandpass", 2800, 2, dest);
    },
    flute(E, n, t, dest) {
      const end = t + n.d + 0.1, f = mtof(n.m), o = osc(E, "triangle", f, t, end), g = E.ctx.createGain();
      vibrato(E, o, t, end, 5, f * 0.005, 0.2);
      o.connect(g); g.connect(dest);
      env(g, t, 0.05, n.vol * 1.3, n.d * 0.8, 0.07);
      noise(E, t, n.d * 0.9, n.vol * 0.18, "bandpass", f * 2, 1.5, dest);
    },
    horn(E, n, t, dest) {
      const c = E.ctx, end = t + n.d + 0.15, o = osc(E, "square", mtof(n.m), t, end), lp = c.createBiquadFilter(), g = c.createGain();
      lp.type = "lowpass"; lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(1700, t + Math.min(0.35, n.d * 0.6)); lp.frequency.linearRampToValueAtTime(900, t + n.d);
      o.connect(lp); lp.connect(g); g.connect(dest);
      env(g, t, 0.09, n.vol * 0.7, n.d * 0.85, 0.12);
    },
    bagpipes(E, n, t, dest) {
      const c = E.ctx, end = t + n.d + 0.06, g = c.createGain(), bp = c.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 1400; bp.Q.value = 2.5;
      if (n.part === "drone") {
        for (const [m, det] of [[n.m, -4], [n.m + 7, 3]]) { const o = osc(E, "sawtooth", mtof(m), t, end); o.detune.value = det; o.connect(g); }
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; g.connect(lp); lp.connect(dest);
        env(g, t, 0.05, n.vol * 0.55, n.d, 0.05);
        return;
      }
      // the chanter, with a grace note flicked in above each melody note
      const o = osc(E, "square", mtof(n.m + 5), t, end);
      o.frequency.setValueAtTime(mtof(n.m), t + 0.035);
      o.connect(bp); bp.connect(g); g.connect(dest);
      env(g, t, 0.01, n.vol * 1.2, n.d * 0.9, 0.04);
    },
    drum(E, n, t, dest) { drum(E, t, n.vol * 1.6, dest); },
  };
  const HIT = {
    drum(E, h, t, dest) { drum(E, t, h.vol * 0.9, dest); },
    slap(E, h, t, dest) { noise(E, t, 0.06, h.vol * 0.5, "bandpass", 1200, 1.4, dest); },
    clap(E, h, t, dest) { for (let k = 0; k < 3; k++) noise(E, t + k * 0.009, 0.03, h.vol * 0.45, "bandpass", 1500, 1.1, dest); },
    pot(E, h, t, dest) {
      for (const [m, a] of [[1, 1], [2.71, 0.5], [5.13, 0.25]]) {
        const o = osc(E, "sine", 1050 * m, t, t + 0.2), g = E.ctx.createGain();
        g.gain.setValueAtTime(h.vol * 0.16 * a, t); g.gain.exponentialRampToValueAtTime(0.0006, t + 0.16 / m + 0.02);
        o.connect(g); g.connect(dest);
      }
      noise(E, t, 0.015, h.vol * 0.3, "highpass", 4000, 0, dest);
    },
    hat(E, h, t, dest) { noise(E, t, 0.05, h.vol, "highpass", 6000, 0, dest); },
    count(E, h, t, dest) { noise(E, t, 0.03, h.vol * 0.3, "bandpass", 1800, 2, dest); },
    howl(E, h, t, dest) {
      const o = osc(E, "sine", 420, t, t + 1.3), g = E.ctx.createGain();
      o.frequency.linearRampToValueAtTime(700, t + 0.5); o.frequency.linearRampToValueAtTime(520, t + 1.2);
      vibrato(E, o, t, t + 1.3, 5, 9, 0.2);
      o.connect(g); g.connect(dest); env(g, t, 0.1, h.vol * 0.12, 0.9, 0.3);
    },
  };

  // ---------- playing a plan ----------
  // schedules what falls in [st.from, until) of song time onto context time t0; st carries the cursors between slices
  function schedule(E, P, t0, until, st, out) {
    const voices = st.voices || {};
    for (; st.n < P.notes.length && P.notes[st.n].t < until; st.n++) {
      const n = P.notes[st.n];
      if (n.t < st.from - 0.02) continue;
      if (n.part === "voice" || n.part === "hum" || n.part === "along") sung(E, voices[n.who], n, t0 + n.t, out);
      else if (INST[n.inst]) INST[n.inst](E, n, t0 + n.t, out);
      if (n.cue && st.cue) st.cue(n, t0 + n.t);
    }
    for (; st.h < P.hits.length && P.hits[st.h].t < until; st.h++) {
      const x = P.hits[st.h];
      if (x.t >= st.from - 0.02 && HIT[x.kind]) HIT[x.kind](E, x, t0 + x.t, out);
    }
    // a lone singer's last note gets a strummed chord under it so the song lands
    const last = P.chords[P.chords.length - 1];
    if (!st.last && last && last.t < until && !P.inst) { st.last = true; for (const m of last.m) pluck(E, m, t0 + last.t, 0.16, out); }
  }
  let current = null;
  function perform(P, opts) {
    const o = opts || {}, E = root.Sound && Sound.engine && Sound.engine();
    stop();
    if (!E) return null;
    const c = E.ctx;
    if (c.state === "suspended") c.resume();
    const out = c.createGain(), comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    out.gain.value = o.vol == null ? 1 : o.vol;
    out.connect(comp); comp.connect(E.out);
    // o.now joins a song already under way: what plays next is heard exactly where the scene has got to
    const lag = (c.outputLatency || 0) + (c.baseLatency || 0), from = o.now != null ? o.now + lag + 0.12 : o.from || 0;
    const t0 = o.now != null ? c.currentTime - lag - o.now : c.currentTime + 0.12 - from, st = { n: 0, h: 0, from, voices: o.voices || {} }, timers = [];
    // a note marked cue calls onNote as it is sung, for a karaoke line that follows the voice
    if (o.onNote) st.cue = (n, at) => timers.push(setTimeout(() => { if (current === h) o.onNote(n); }, Math.max(0, (at + lag - c.currentTime) * 1000)));
    E.duck(true);
    // scheduled in slices, so a long song doesn't build every node up front and Stop is instant
    let timer = 0;
    function pump() {
      if (current !== h) return;
      schedule(E, P, t0, c.currentTime - t0 + 1.2, st, out);
      if (c.currentTime - t0 > P.len + 0.5) { end(); return; }
      timer = setTimeout(pump, 250);
    }
    function end() { if (current === h) { current = null; clearTimeout(timer); E.duck(false); setTimeout(() => out.disconnect(), 2500); if (o.done) o.done(); } }
    // t is the song time reaching the speakers, which trail the context clock by the output latency (most on Bluetooth)
    const h = { t0, ctx: c, get t() { return c.currentTime - lag - t0; }, stop() { clearTimeout(timer); timers.forEach(clearTimeout); out.gain.setTargetAtTime(0, c.currentTime, 0.05); setTimeout(() => out.disconnect(), 400); if (current === h) { current = null; E.duck(false); } } };
    current = h;
    pump();
    return h;
  }
  // offline, for the preview page's level check: resolves to the rendered AudioBuffer
  function render(P, voices, secs) {
    const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext, sr = 44100, len = Math.min(secs || P.len, P.len + 1);
    const c = new OAC(1, Math.ceil(sr * len), sr), nb = c.createBuffer(1, sr * 2, sr), d = nb.getChannelData(0), r = rngOf(99);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    const out = c.createGain(), comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    out.connect(comp); comp.connect(c.destination);
    schedule({ ctx: c, noiseBuf: nb }, P, 0.05, len, { n: 0, h: 0, from: 0, voices: voices || {} }, out);
    return c.startRendering();
  }
  function stop() { if (current) current.stop(); }

  // a record (league/music.py) and the song's words as a spec for plan()
  function specFor(rec, words, part) {
    const S = (root.LD && LD.static && LD.static.music) || {}, sg = rec.song || {};
    const folk = sg.src === "folk" ? (S.folk || []).find((x) => x.id === sg.id) : null;
    const voiceOf = (id) => { const h = root.App && App.heroes ? App.heroes[id] : null; return root.Speech && h ? Speech.voiceOf({ h, name: h.name }) : { pitch: 58 + (hash(id) % 12), timbre: "buzzy", formant: 1 }; };
    return {
      id: rec.id + (part === "full" ? ":full" : ""), meter: sg.meter, bpm: folk ? folk.bpm : sg.bpm, tone: sg.tone, diff: sg.diff, outcome: rec.outcome, part: part || "short",
      folk: folk ? { notes: folk.notes } : null, lines: words ? words.lines : null, chorus: words ? words.chorus : null, resp: words ? words.resp || null : null,
      lead: { id: rec.lead.id, skill: rec.lead.skill, inst: rec.lead.inst || null, voice: voiceOf(rec.lead.id) },
      joiners: (rec.joiners || []).map((j) => ({ id: j.id, how: j.how, inst: j.inst || null, skill: j.skill, voice: voiceOf(j.id) })),
      pets: rec.pets || [],
    };
  }
  function voices(spec) {
    const v = {};
    if (spec.lead) v[spec.lead.id] = spec.lead.voice;
    for (const j of spec.joiners || []) v[j.id] = j.voice;
    return v;
  }
  // the words of a book song or a hero's own song, by id
  function words(sg) {
    if (!sg) return null;
    const S = (root.LD && LD.static && LD.static.music) || {}, L = (root.LD && LD.league) || {};
    if (sg.src === "book") { const s = (S.songbook || []).find((x) => x.id === sg.id); return s ? { title: s.title, lines: s.lines, chorus: s.chorus, resp: s.resp || null } : null; }
    if (sg.src === "hero") { const s = (L.hero_songs || []).find((x) => x.id === sg.id); return s && s.lines ? { title: s.title, lines: s.lines, chorus: s.chorus || [0, 1] } : null; }
    return null;
  }

  // the Songs page's bard: plays a ballad, onSyl(line, syllable) as each syllable is sung, onEnd when it finishes on its own
  function playBallad(song, onSyl, onEnd) {
    return perform(ballad(song), { voices: { bard: BARD }, onNote: (n) => onSyl && onSyl(n.line, n.si), done: onEnd });
  }

  root.Music = { plan, ballad, playBallad, isChorus, BARD, perform, render, stop, specFor, voices, words, syllables, parseFolk, INSTS, MODES, get playing() { return !!current; } };
})(typeof window !== "undefined" ? window : globalThis);
