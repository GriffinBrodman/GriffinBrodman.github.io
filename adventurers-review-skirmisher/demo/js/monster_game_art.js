/* Talking monsters at a game: each one's seated bust (head and shoulders, no hands or arms) in its own colours, painted with the Paint engine, and which staging it plays in. */
(function () {
  "use strict";
  const { Paint, ramp } = window.Paint;
  const mix = Art.mix;
  const INK = "#14101a", TOOTH = "#f4ecd8", WHITE = "#ffffff";

  // A, the stump by the road, for the road folk; B, the bridge rail, for whoever lives under a bridge, in a river or up a gorge
  const STAGE = { kobold: "road", kobold_slinger: "road", bandit: "road", bandit_captain: "road", cave_troll: "bridge", swamp_troll: "bridge", siren: "bridge", yeti: "bridge" };
  const stageOf = (id) => STAGE[id] || (/troll|siren|yeti|serpent|drown|crab|kelp|frog/.test(id || "") ? "bridge" : "road");

  const r4 = (h) => ramp(h);
  // eyes: o.look shifts the pupil (-1 left, 1 right); moods squint (glee), droop (sad) or cock one lid (offer)
  function eyePair(P, pts, o, st) {
    const iris = st.iris, w = st.w || 3, h = st.h || 2;
    pts.forEach(([x, y], k) => {
      const lid = st.lid || "ad";
      if (o.blink) { P.rect(x, y + h - 1, w, 1, INK, 0); return; }
      if (o.mood === "glee") { P.px(x, y + 1, INK, 0); P.rect(x + 1, y, w - 2 || 1, 1, INK, 0); P.px(x + w - 1, y + 1, INK, 0); return; }
      P.rect(x, y, w, h, iris, 0);
      const px = x + Math.floor((w - 1) / 2) + Math.max(-1, Math.min(1, o.look || 0)) * (w > 2 ? 1 : 0);
      const py = o.mood === "sad" ? y + h - 1 : y + (h > 2 ? 1 : 0);
      if (st.slit) P.rect(px, y, 1, h, INK, 0); else P.rect(px, py, st.pw || 1, h > 2 ? 2 : 1, INK, 0);
      if (!st.slit && h > 1 && o.mood !== "sad") P.px(px + (st.pw || 1) - 1, py, mix(iris, WHITE, 0.7), 0);
      if (o.mood === "sad") P.rect(x, y, w, 1, lid, -0.2);
      if (o.mood === "offer" && k === (st.cock || 0)) P.rect(x, y, w, 1, lid, -0.2);
    });
  }

  // ---------- kobolds: a rust-red lizard face, swept horns, a leather vest (the slinger's headband and pebble strap) ----------
  function kobold(P, o, sling) {
    P.layer = 1;
    P.poly([[27, 10], [31, 4], [35, 2], [33, 6], [30, 12]], "dhorn", (x, y) => 0.1 - (y - 2) * 0.03);
    P.ell(21, 38, 16, 8, "a", { s: -0.1 });
    P.layer = 2;
    P.poly([[6, 33], [36, 33], [38, 38], [4, 38]], "vest", (x, y) => 0.3 - (x - 6) * 0.025 - (y - 33) * 0.06);
    P.poly([[16, 31], [27, 31], [22, 38]], "a", (x) => 0.1 - (x - 16) * 0.04);
    P.ell(21.5, 35, 2.6, 2.4, "belly", { s: 0.2, fn: (x, y, s) => (y < 33 ? false : s) });
    if (sling) {
      P.line(9, 33, 30, 38, "strap", 0.2); P.line(9, 34, 30, 39, "strap", -0.3);
      for (const [x, y] of [[14, 35], [19, 36], [25, 37]]) P.ell(x, y, 1.6, 1.4, "clay", { s: 0.25 });
    } else { P.rect(30, 34, 3, 3, "#d8a838", 0.3); P.px(30, 34, "#fff0b0", 0); P.rect(10, 34, 3, 3, "#d8a838", 0.3); }
    P.ell(23, 28, 6, 4, "a", { s: -0.45 });
    P.layer = 3;
    P.ell(24, 18, 9.6, 8.4, "a", { s: 0.15 });
    for (const [x, y, w, h] of [[31, 14, 4, 3], [32, 19, 4, 2], [30, 23, 4, 2]]) P.poly([[x, y], [x + w, y + h - 3], [x + 1, y + h]], "ad", -0.1);
    const gape = o.mood === "glee" ? 2 : 0;
    P.poly([[17, 13], [9, 15], [3, 17.4], [3, 20], [7, 21.4], [18, 22]], "a", (x, y) => 0.55 - (y - 13) * 0.07 + (x < 6 ? 0.1 : 0));
    P.poly([[4, 21 + gape], [18, 21.6], [19, 24.6 + gape * 0.5], [9, 24 + gape]], "belly", (x, y) => 0.05 - (y - 21) * 0.12);
    if (gape) { P.poly([[4, 21], [17, 21.6], [16, 23.4], [6, 23]], "#4a1612", 0); for (const x of [5, 8, 11, 14]) P.px(x, 21, TOOTH, 0); P.rect(9, 23, 3, 1, "#c85048", 0); }
    else if (o.mood === "sad") { P.line(4, 22, 17, 21, "ad", -0.7); P.px(4, 21, "ad", -0.7); }
    else { P.line(3, 21, 17, 21.6, "ad", -0.7); if (o.mood === "offer") { P.px(8, 21, TOOTH, 0); P.px(16, 20, "ad", -0.7); P.px(17, 20, "ad", -0.7); } }
    P.px(5, 17, INK, 0); P.px(6, 17, "ad", -0.5);
    P.layer = 4;
    P.poly([[25, 11], [29, 6], [34, 4], [38, 5], [35, 6], [31, 9], [28, 14]], "horn", (x, y) => 0.6 - (x - 25) * 0.04 - (y - 4) * 0.04);
    if (sling) { P.poly([[16, 11], [30, 10], [31, 13], [17, 14]], "band", (x) => 0.4 - (x - 16) * 0.04); P.poly([[31, 12], [35, 15], [33, 16]], "band", -0.2); }
    P.ell(15.5, 13.4, 4.4, 1.6, "a", { s: 0.6 });
    if (o.mood === "sad") P.poly([[12, 13], [15, 12], [19, 13], [19, 14], [12, 14]], "a", 0.6);
    if (o.mood === "offer") P.rect(12, 12.4, 4, 1, "ad", -0.3);
    eyePair(P, [[13, 14]], o, { iris: "#f0d040", w: 4, h: 3, slit: true });
    return { head: [18, 3], mouth: [6, 21] };
  }

  // ---------- bandits: a hooded footpad with a red scarf, and the captain in a gold-trimmed tricorn with a patch ----------
  function bandit(P, o) {
    P.layer = 1;
    P.ell(20, 39, 15, 9, "coat", { s: 0.05 });
    P.ell(20, 19, 11.5, 13, "hood", { s: 0.15 });
    P.poly([[9, 24], [31, 24], [34, 40], [6, 40]], "hood", (x, y) => 0.15 - (x - 9) * 0.03 - (y - 24) * 0.02);
    P.layer = 2;
    P.ell(19, 20, 7, 8, "skin", { s: 0.1 });
    P.ell(19, 15, 7.6, 4, "hood", { s: -0.55, fn: (x, y, s) => (y > 15 ? false : s) });
    P.poly([[11, 27], [28, 27], [27, 33], [12, 33]], "scarf", (x, y) => 0.3 - (x - 11) * 0.03 - (y - 27) * 0.08);
    P.poly([[24, 31], [29, 31], [31, 38], [26, 37]], "scarf", -0.2);
    for (const [x, y] of [[14, 24], [17, 25], [21, 25], [24, 24], [15, 26], [22, 26]]) P.px(x, y, "skin", -0.6);
    P.layer = 3;
    P.poly([[10, 17], [28, 17], [28, 21], [20, 20.4], [18, 21], [10, 21]], "mask", (x) => 0.3 - (x - 10) * 0.03);
    P.poly([[28, 18], [32, 20], [31, 21], [28, 20]], "mask", -0.2);
    if (o.mood === "offer") P.rect(20, 16, 4, 1, "hood", -0.7);
    eyePair(P, [[13, 18], [20, 18]], o, { iris: "#efe6d2", w: 3, h: 2, lid: "mask" });
    P.px(18, 21, "skin", -0.4); P.px(18, 22, "skin", -0.6);
    if (o.mood === "glee") { P.rect(15, 24, 7, 1, "#5a2018", 0); P.rect(16, 24, 5, 1, TOOTH, 0); P.px(15, 23, "skin", -0.6); P.px(21, 23, "skin", -0.6); }
    else if (o.mood === "sad") { P.rect(16, 25, 5, 1, "skin", -0.8); P.px(15, 26, "skin", -0.8); P.px(21, 26, "skin", -0.8); }
    else { P.rect(15, 24, 6, 1, "skin", -0.8); if (o.mood === "offer") { P.px(21, 23, "skin", -0.8); P.px(20, 24, TOOTH, 0); } }
    P.line(23, 19, 25, 23, "skin", -0.5);
    return { head: [19, 5], mouth: [18, 25] };
  }
  function captain(P, o) {
    P.layer = 1;
    P.ell(22, 42, 18, 9, "coat", { s: 0.05 });
    P.layer = 2;
    P.poly([[6, 38], [38, 38], [40, 46], [4, 46]], "coat", (x, y) => 0.2 - (x - 6) * 0.025);
    P.poly([[16, 34], [28, 34], [25, 46], [19, 46]], "shirt", (x) => 0.35 - (x - 16) * 0.04);
    for (const [x, y] of [[4, 37], [33, 37]]) { P.rect(x, y, 7, 3, "gold", (xx) => 0.4 - (xx - x) * 0.06); for (let i = 0; i < 7; i += 2) P.px(x + i, y + 3, "gold", -0.1); }
    for (const y of [39, 42, 45]) { P.px(15, y, "gold", 0.5); P.px(29, y, "gold", 0.3); }
    P.ell(22, 32, 5, 4, "skin", { s: -0.2 });
    P.layer = 3;
    P.ell(22, 24, 8, 9, "skin", { s: 0.12 });
    P.ell(30, 25, 2, 3, "skin", { s: -0.1 });
    P.px(31, 28, "gold", 0.6); P.px(31, 29, "gold", 0.2);
    P.layer = 4;
    P.poly([[2, 15], [12, 8], [22, 6], [32, 8], [42, 14], [36, 16], [22, 13], [8, 17]], "hat", (x, y) => 0.35 - (y - 6) * 0.05 - Math.abs(x - 22) * 0.012);
    P.poly([[10, 13], [14, 4], [22, 1], [30, 4], [34, 13]], "hat", (x, y) => 0.5 - (y - 1) * 0.06 - (x - 10) * 0.015);
    P.line(2, 15, 12, 8, "gold", 0.4); P.line(32, 8, 42, 14, "gold", 0.2); P.line(8, 17, 22, 13, "gold", 0.1); P.line(22, 13, 36, 16, "gold", -0.1);
    P.ell(30, 8, 2.4, 2.4, "plume", { s: 0.2 });
    P.layer = 5;
    P.line(14, 19, 22, 20, INK, 0);
    P.rect(14, 21, 4, 3, INK, 0);
    P.rect(21, 20, 4, 1, "skin", -0.7);
    if (o.mood === "offer") P.rect(21, 19, 4, 1, "skin", -0.7);
    eyePair(P, [[21, 21]], o, { iris: "#efe6d2", w: 3, h: 2, lid: "skin" });
    P.px(20, 24, "skin", -0.4); P.rect(19, 25, 2, 1, "skin", -0.6);
    const up = o.mood === "glee" ? -1 : o.mood === "sad" ? 1 : 0;
    P.poly([[13, 27 + up], [18, 26], [22, 27], [26, 26], [31, 27 + up], [27, 28.6], [22, 28], [17, 28.6]], "stache", (x) => 0.3 - Math.abs(x - 22) * 0.04);
    if (o.mood === "glee") { P.rect(18, 29, 7, 1, "#5a2018", 0); P.rect(19, 29, 5, 1, TOOTH, 0); }
    else if (o.mood === "sad") P.rect(19, 30, 6, 1, "skin", -0.8);
    else P.rect(19, 29, 6, 1, "skin", -0.7);
    P.ell(22, 31.4, 2.4, 1.2, "stache", { s: -0.1 });
    return { head: [22, 0], mouth: [22, 29] };
  }

  // ---------- trolls: a hunched hill of shoulders with the head slung forward, a drooping nose and two tusks ----------
  function troll(P, o, swamp) {
    const sad = o.mood === "sad", glee = o.mood === "glee";
    const grain = (x, y, s) => s + ((x * 5 + y * 3) % 11 === 0 ? -0.35 : (x * 2 + y * 7) % 17 === 0 ? 0.25 : 0);
    P.layer = 1;
    P.ell(38, 62, 33, 18, "a", { s: -0.05, fn: grain });
    P.ell(47, 46, 20, 13, "a", { s: 0.1, fn: grain });
    if (!swamp) for (const [x, y, r] of [[50, 37, 6], [60, 44, 4], [40, 40, 3], [22, 50, 4]]) P.ell(x, y, r, r * 0.55, "moss", { s: 0.25, fn: (xx, yy, s) => ((xx + yy) % 3 === 0 ? s - 0.45 : s) });
    else for (let i = 0; i < 10; i++) P.line(28 + i * 4, 36 + (i % 3), 27 + i * 4 + (i % 2), 50 + (i % 4) * 2, "weed", -0.1 + (i % 2) * 0.35);
    P.layer = 2;
    P.poly([[43, 28], [56, 20], [52, 24], [47, 35]], "a", (x) => 0.3 - (x - 43) * 0.04);
    P.poly([[17, 30], [8, 25], [11, 30], [15, 35]], "a", 0.2);
    P.ell(31, 33, 15, 13, "a", { s: 0.1, fn: grain });
    P.ell(33, 23, 11, 7, "a", { s: 0.3, fn: grain });
    if (!swamp) { P.line(38, 18, 41, 24, "ad", -0.6); P.line(41, 24, 40, 27, "ad", -0.6); for (const [x, y] of [[29, 18], [36, 17], [32, 16]]) P.ell(x, y, 2, 1, "moss", { s: 0.3 }); }
    else { P.ell(32, 17, 10, 2.6, "pad", { s: 0.35 }); P.poly([[32, 15], [35, 17], [32, 18]], "#26381c", 0); P.ell(38, 15.6, 1.5, 1.2, "#f0e8a0", { k: 0 }); P.px(38, 15, "#ffffff", 0); }
    P.layer = 3;
    P.ell(30, 42, 14, 6, "a", { s: -0.15, fn: grain });
    if (glee) { P.poly([[17, 38], [43, 38], [39, 45], [21, 45]], "#3a1410", 0); for (let x = 20; x < 41; x += 3) P.rect(x, 38, 2, 2, TOOTH, 0); P.rect(25, 43, 8, 2, "#a03a30", 0); }
    else if (sad) P.ell(30, 43, 3.4, 2.6, "#3a1410", { k: 0 });
    else { P.line(18, 40, 42, 39, "ad", -0.8); if (o.mood === "offer") { P.line(38, 39, 42, 37, "ad", -0.8); P.px(36, 40, TOOTH, 0); } }
    P.poly([[18, 43], [17, 34], [21, 41]], "tusk", (x, y) => 0.6 - (y - 34) * 0.06);
    P.poly([[39, 43], [41, 34], [43, 42]], "tusk", (x, y) => 0.4 - (y - 34) * 0.06);
    P.layer = 4;
    P.ell(22, 29, 4, 2.6, "ad", { s: -0.5, k: 0.3 }); P.ell(36, 29, 4, 2.6, "ad", { s: -0.5, k: 0.3 });
    eyePair(P, [[20, 28], [34, 28]], o, { iris: "#f0d040", w: 4, h: 2, cock: 1 });
    P.ell(29, 25.4, 13, 2.4, "a", { s: 0.55, fn: (x, y, s) => (y > 26 ? false : s) });
    if (sad) { P.poly([[17, 26], [24, 23], [26, 25]], "a", 0.6); P.poly([[32, 25], [35, 23], [41, 26]], "a", 0.6); }
    if (o.mood === "offer") P.poly([[32, 26], [38, 23], [41, 26]], "a", 0.6);
    P.ell(28, 34, 5.6, 4.8, "nose", { s: 0.3 });
    P.px(25, 37, INK, 0); P.px(31, 37, INK, 0);
    for (const [x, y] of [[41, 33], [37, 37], [22, 22], [19, 37]]) { P.px(x, y, "a", 0.7); P.px(x + 1, y + 1, "ad", -0.6); }
    if (sad) { P.ell(46, 24, 1.4, 2, "#a8d8f0", { k: 0 }); P.px(46, 23, WHITE, 0); }
    return { head: [32, 12], mouth: [30, 40] };
  }

  // ---------- the siren: a sea-green face under a great mane of foam-coloured hair, fin ears, a scale collar and pearls ----------
  function siren(P, o) {
    P.layer = 1;
    P.ell(22, 22, 16, 18, "hair", { s: 0.1 });
    for (const [x0, x1] of [[7, 5], [10, 8], [33, 36], [36, 39]]) P.line(x0, 26, x1, 46, "hair", 0.1, 2.2);
    P.layer = 2;
    P.ell(22, 47, 14, 8, "a", { s: 0.05 });
    P.poly([[9, 41], [35, 41], [37, 48], [7, 48]], "scale", (x, y) => 0.4 - (x - 9) * 0.03 + (((x >> 1) + (y >> 1)) % 2 ? -0.35 : 0));
    for (let x = 12; x <= 32; x += 3) P.px(x, 40 + (x % 2), "pearl", 0.6);
    P.rect(20, 32, 5, 6, "a", -0.2);
    P.layer = 3;
    P.ell(22, 24, 8.5, 10, "a", { s: 0.12 });
    P.poly([[30, 22], [38, 15], [36, 21], [39, 24], [31, 27]], "fin", (x) => 0.3 - (x - 30) * 0.06);
    P.poly([[14, 22], [7, 17], [9, 22], [6, 25], [14, 26]], "fin", (x) => 0.4 + (x - 14) * 0.03);
    P.layer = 4;
    P.poly([[13, 18], [17, 11], [26, 10], [32, 16], [28, 15], [22, 17], [17, 16]], "hair", (x, y) => 0.5 - (y - 10) * 0.05);
    P.ell(30, 12, 2.4, 2, "shell", { s: 0.3 });
    P.rect(16, 21, 4, 1, "ad", -0.3); P.rect(24, 21, 4, 1, "ad", -0.3);
    if (o.mood === "offer") P.rect(24, 20, 4, 1, "ad", -0.3);
    eyePair(P, [[16, 22], [24, 22]], o, { iris: "#f0f0a0", w: 4, h: 2, cock: 1, pw: 1 });
    P.px(22, 26, "a", -0.4);
    if (o.mood === "glee") { P.rect(19, 29, 6, 1, "lip", 0); P.px(18, 28, "lip", 0); P.px(25, 28, "lip", 0); P.rect(20, 29, 4, 1, TOOTH, 0); }
    else if (o.mood === "sad") { P.rect(20, 30, 4, 1, "lip", -0.2); P.px(19, 31, "lip", -0.2); P.px(24, 31, "lip", -0.2); }
    else { P.rect(20, 29, 5, 1, "lip", 0); if (o.mood === "offer") P.px(25, 28, "lip", 0); }
    return { head: [22, 2], mouth: [22, 29] };
  }

  // ---------- the yeti: a drift of white fur with a slate-blue face, frost on the tips and pale glowing eyes ----------
  function yeti(P, o) {
    const shag = (x, y, s) => s + ((x * 7 + y * 3) % 9 === 0 ? -0.5 : (x * 3 + y) % 13 === 0 ? 0.3 : 0);
    P.layer = 1;
    P.ell(32, 58, 30, 18, "fur", { s: 0.05, fn: shag });
    for (let i = 0; i < 12; i++) { const x = 5 + i * 4.8; P.poly([[x, 44 + (i % 3)], [x + 2.4, 36 + (i % 2) * 3], [x + 4.8, 44 + (i % 3)]], "fur", 0.25); }
    P.layer = 2;
    P.ell(31, 30, 16, 16, "fur", { s: 0.2, fn: shag });
    for (let i = 0; i < 7; i++) { const x = 17 + i * 4; P.poly([[x, 17], [x + 2, 9 + (i % 2) * 3], [x + 4, 17]], "fur", 0.45); }
    for (const sd of [-1, 1]) P.poly([[31 + sd * 14, 26], [31 + sd * 19, 34], [31 + sd * 13, 38]], "fur", sd < 0 ? 0.4 : -0.1);
    P.layer = 3;
    P.poly([[20, 27], [25, 25], [31, 27], [37, 25], [42, 27], [41, 34], [37, 40], [31, 42], [25, 40], [21, 34]], "face", (x, y) => 0.25 - (y - 25) * 0.04 - (x - 20) * 0.02);
    P.layer = 4;
    P.poly([[17, 26], [24, 21], [31, 24], [38, 21], [45, 26], [40, 28], [31, 26], [22, 28]], "fur", (x) => 0.55 - (x - 17) * 0.012);
    for (const sd of [-1, 1]) P.poly([[31 + sd * 11, 30], [31 + sd * 13, 37], [31 + sd * 9, 35]], "fur", 0.2);
    if (o.mood === "offer") P.poly([[32, 26], [40, 22], [43, 26], [38, 27]], "fur", 0.6);
    if (o.mood === "sad") { P.poly([[20, 27], [27, 28], [27, 29], [21, 29]], "fur", 0.5); P.poly([[35, 28], [42, 27], [41, 29], [35, 29]], "fur", 0.5); }
    eyePair(P, [[24, 29], [34, 29]], o, { iris: "#24365a", w: 4, h: 2, lid: "face", cock: 1 });
    P.ell(31, 33.4, 2.6, 1.7, "nose", { s: 0.35 });
    if (o.mood === "glee") { P.poly([[24, 36], [38, 36], [35, 40], [27, 40]], "#2a1e2a", 0); P.rect(26, 36, 2, 2, TOOTH, 0); P.rect(35, 36, 2, 2, TOOTH, 0); P.rect(29, 39, 4, 1, "#a04a4a", 0); }
    else if (o.mood === "sad") { P.rect(27, 38, 8, 1, "face", -0.8); P.px(26, 39, "face", -0.8); P.px(35, 39, "face", -0.8); }
    else { P.rect(25, 37, 12, 1, "face", -0.8); P.rect(26, 35, 1, 2, TOOTH, 0); P.rect(35, 35, 1, 2, TOOTH, 0); }
    for (const [x, y] of [[12, 22], [47, 27], [20, 14], [40, 13], [8, 46], [56, 47], [30, 50]]) P.px(x, y, WHITE, 0);
    return { head: [31, 7], mouth: [31, 37] };
  }

  const LOOKS = {
    kobold: { size: [38, 38], draw: (P, o) => kobold(P, o, false), mats: { a: "#c86a3a", ad: "#8a4a2a", belly: "#e8b07a", horn: "#e8dcc0", dhorn: "#a8987c", vest: "#6a4430", clay: "#a8643a", strap: "#6a5a3a", band: "#6a5a3a" } },
    kobold_slinger: { size: [38, 38], draw: (P, o) => kobold(P, o, true), mats: { a: "#c86a3a", ad: "#8a4a2a", belly: "#e8b07a", horn: "#e8dcc0", dhorn: "#a8987c", vest: "#5a4a32", clay: "#a8643a", strap: "#7a6a4a", band: "#4a6a8a" } },
    bandit: { size: [40, 44], draw: bandit, mats: { skin: "#e0b088", hood: "#5a4a3a", coat: "#4a3a2c", scarf: "#8a2a2a", mask: "#2a2226" } },
    bandit_captain: { size: [44, 48], draw: captain, mats: { skin: "#e0b088", coat: "#7a1a2a", shirt: "#e8dcc4", gold: "#e8b84a", hat: "#3a2a2a", plume: "#c8302a", stache: "#4a2e1c" } },
    cave_troll: { size: [70, 66], draw: (P, o) => troll(P, o, false), mats: { a: "#7a8a7a", ad: "#4a5a4c", nose: "#8a9a86", moss: "#6a8a3a", tusk: "#e8dcc0", weed: "#3a5a2a", pad: "#4a7a2a" } },
    swamp_troll: { size: [70, 66], draw: (P, o) => troll(P, o, true), mats: { a: "#5a7a4a", ad: "#3a5a3a", nose: "#6a8a52", moss: "#6a8a3a", tusk: "#d8ccaa", weed: "#2e4a26", pad: "#4a8a32" } },
    siren: { size: [44, 52], draw: siren, mats: { a: "#4a8a9a", ad: "#2e5a68", hair: "#86c2b8", fin: "#5aa8a0", scale: "#2a6a7a", pearl: "#f0ecdc", lip: "#2a4a5a", shell: "#e8c8b0" } },
    yeti: { size: [64, 66], draw: yeti, mats: { fur: "#e4ecf0", face: "#8c9ab4", nose: "#2a3246" } },
  };
  const fallback = (id) => (stageOf(id) === "bridge" ? "cave_troll" : "bandit");

  const cache = new Map();
  function bust(id, o) {
    o = o || {};
    const kind = LOOKS[id] ? id : fallback(id), L = LOOKS[kind];
    const mood = o.mood || "watch", key = [kind, mood, o.blink ? 1 : 0, o.look || 0].join(":");
    let out = cache.get(key);
    if (out) return out;
    const P = new Paint(L.size[0], L.size[1]);
    const marks = L.draw(P, { mood, blink: !!o.blink, look: o.look || 0 });
    const mats = {};
    for (const [k, v] of Object.entries(L.mats)) mats[k] = r4(v);
    const g = P.render(mats, { outline: INK });
    out = { grid: g, w: g.w, h: g.h, head: marks.head, mouth: marks.mouth, kind };
    cache.set(key, out);
    return out;
  }

  window.MonsterGameArt = { bust, stageOf, STAGE, KINDS: Object.keys(LOOKS) };
})();
