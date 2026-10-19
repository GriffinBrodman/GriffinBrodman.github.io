/* Shaded monster sprites (non-humanoid bodies) painted with the Paint engine; all face right. */
(function () {
  "use strict";
  const { mix } = Art;
  const { Paint, ramp } = window.Paint;

  const INK = "#14101a", TOOTH = "#f4ecd8";
  const SIZES = {
    rat: [20, 12], wolf: [26, 18], boar: [26, 18], bear: [30, 26], spider: [24, 16], spider_big: [24, 16], bat: [26, 16], slime: [22, 16],
    troll: [30, 36], drake: [30, 22], dragon: [48, 36], chest: [24, 20], wraith: [22, 30], golem: [30, 34], crab: [26, 16], wisp: [16, 16],
    elemental: [24, 30], serpent: [30, 26], kraken: [44, 38], blob: [16, 16], lich: [34, 44], crone: [36, 36], warchief: [50, 50],
    goblin: [26, 30], kobold: [28, 26],
    shroom: [18, 20], stump: [24, 22], bugbear: [28, 36], ettercap: [26, 30], rats: [30, 15], wolfrider: [32, 32], batswarm: [30, 22], jelly: [22, 24],
    wyvern: [36, 32], croaker: [27, 25], strider: [35, 16], peatman: [24, 32], candle: [16, 28], hermit: [29, 20], wrack: [26, 33], imp: [20, 21], snowman: [23, 31],
  };
  // threat read: beasts that fight heroes toe to toe are drawn closer to hero height
  const BODYK = { rat: 1.1, wolf: 1.2, boar: 1.15, drake: 1.25, serpent: 1.4, spider: 1.2, crab: 1.1, bat: 1.1, bear: 1.1, rats: 1.1, strider: 1.15, hermit: 1.1,
    wyvern: 1.15, wolfrider: 1.1 };
  const NATIVE_BOSS = new Set(["dragon", "kraken", "lich", "crone", "warchief"]);

  const fur = (x, y, s) => s + ((x * 7 + y * 13) % 5 === 0 ? -0.28 : 0);
  const from = (y0) => (x, y, s) => (y < y0 ? false : s);
  const eye = (P, x, y, E, glint) => { P.px(x, y, E); P.px(x + 1, y, INK); if (glint) P.px(x, y - 1, "#ffffff"); };
  const limb = (P, pts, r0, r1, m, s) => {
    const seg = [];
    let tot = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); tot += d; }
    const n = Math.max(1, Math.ceil(tot / 0.7));
    for (let k = 0; k <= n; k++) {
      let d = (k / n) * tot, i = 0;
      while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
      const u = seg[i] ? Math.min(1, d / seg[i]) : 0, r = r0 + (r1 - r0) * (k / n);
      P.ell(pts[i][0] + (pts[i + 1] ? (pts[i + 1][0] - pts[i][0]) * u : 0), pts[i][1] + (pts[i + 1] ? (pts[i + 1][1] - pts[i][1]) * u : 0), r, r, m, { s: s || 0, k: 0.8 });
    }
  };
  const ln = (P, x0, y0, x1, y1, m, s, r) => P.line(x0, y0, x1, y1, m, s, r >= 1 ? r : 0);
  const mid = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // ---------- poses (deaths): every pose is painted natively; q is the pose, null for the standing sprite ----------
  const lerp = (a, b, t) => a + (b - a) * t, c01 = (v) => Math.max(0, Math.min(1, v)), rmp = (x, a, b) => c01((x - a) / (b - a));
  const lerpPts = (A, B, t) => A.map((p, i) => [lerp(p[0], B[i][0], t), lerp(p[1], B[i][1], t)]);
  // a shut eye is the lid's dark line where the eye was
  const shut = (P, x, y) => { P.px(x, y, INK); P.px(x + 1, y, INK); };
  const look = (P, x, y, E, glint, q) => (q && q.eyes > 0.5 ? shut(P, x, y) : eye(P, x, y, E, glint));
  // a body sinking onto the floor: back and front settle separately (fb, ff from 0 to 1, by up to D), the head drops after them
  const sink = (P, q, D, xb, xf, hx0, hx1, HD) => { P.bend = (x) => lerp(q.fb || 0, q.ff || 0, rmp(x, xb, xf)) * D + (q.head || 0) * HD * rmp(x, hx0, hx1); };
  const flat = (P, fn) => { const b = P.bend; P.bend = null; fn(); P.bend = b; };

  function mats(p) {
    const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255; };
    if (lum(p[0]) < 0.28) p = [mix(p[0], "#9a9aaa", 0.2), p[1], p[2]];
    const dk = (h, t) => mix(h, "#14101c", t);
    return {
      a: ramp(p[0]), ad: ramp(dk(p[0], 0.38)), b: ramp(p[1]), bd: ramp(dk(p[1], 0.38)), horn: ramp("#e8dcc0"), dhorn: ramp("#a8987c"),
      n: ramp(mix(p[0], "#ffffff", 0.08)), wm: ramp(dk(mix(p[0], p[1], 0.15), 0.3)), wmd: ramp(dk(p[0], 0.55)), wb: ramp(mix(p[0], p[1], 0.4)),
      cloth: ramp("#6a4430"), void: ramp("#0c0a16"), pink: ramp("#d88a8a"), glow: ramp(p[1]), gold: ramp("#d8a838"), iron: ramp("#4a4656"),
      arm: ramp(p[0]), wood: ramp("#7a5232"), fur: ramp("#8a7458"), steel: ramp("#9aa2aa"), rust: ramp("#9a5a34"),
      belly: ramp(mix(p[0], "#f0d8a0", 0.55)), clay: ramp("#a8643a"), paint: ramp("#a03a2a"),
      spot: ramp("#f0e8d4"), cap: ramp("#c4402c"), moss: ramp("#5e7e30"), gob: ramp("#6aa04a"), reed: ramp("#a8904c"), claw: ramp("#d0602c"),
      water: ramp("#6aa0b0"), snow: ramp("#eef4fa"), coal: ramp("#34323a"), carrot: ramp("#e8742a"), scarf: ramp("#b8362c"), wax: ramp("#e4d8b4"),
      shell: ramp("#e0d0b0"), inr: ramp(mix("#6a6a72", p[0], 0.45)), inb: ramp(mix("#5a3a24", p[0], 0.4)), ing: ramp(mix("#ffd84a", p[0], 0.3)),
    };
  }

  function rat(P, c, f) {
    const E = c.E, q = c.q, ff = q ? q.ff || 0 : 0, fb = q ? q.fb || 0 : 0;
    if (q) sink(P, q, 1.4, 5, 13, 11, 14, 1.8);
    P.layer = 1;
    const tl = [[3.5, 8], [1.8, 8.6], [0.8, 7.2 - f], [0.6, 5.5 - f]];
    if (q) flat(P, () => limb(P, lerpPts(tl, [[3.5, 9.2], [1.6, 10.2], [-0.4, 10.6], [-2, 10.4]], fb), 1, 0.5, "b"));
    else limb(P, tl, 1, 0.5, "b");
    if (q) flat(P, () => { P.rect(5, 9, 2, 2, "ad", -0.2); P.rect(12, 9, 2, 2, "ad", -0.2); });
    else { P.rect(5, 9, 2, 2, "ad", -0.2); P.rect(12, 9, 2, 2, "ad", -0.2); }
    P.layer = 2;
    P.ell(9, 7 + f * 0.4, 5.6, 3, "a", { fn: fur });
    P.ell(6.5, 7.4, 3.6, 3, "a", { fn: fur });
    P.ell(10, 9, 4, 1.2, "b", { fn: from(8.6) });
    P.layer = 3;
    if (q) flat(P, () => { P.rect(7 + ff * 6, 10, 2, 1, "n", 0); P.rect(11 + ff * 4, 10, 2, 1, "n", 0); P.px(8 + ff * 6, 11, "b", 0.2); P.px(12 + ff * 4, 11, "b", 0.2); });
    else { P.rect(7, 9, 2, 2, "n", 0); P.rect(11, 9, 2, 2, "n", 0); P.px(7, 11, "b", 0.2); P.px(8, 11, "b", 0.2); P.px(11, 11, "b", 0.2); P.px(12, 11, "b", 0.2); }
    P.layer = 4;
    P.ell(14.2, 6.4 + f * 0.4, 2.8, 2.3, "n", { fn: fur });
    P.ell(16.8, 7.1 + f * 0.4, 1.9, 1.3, "n", { fn: fur });
    P.ell(12.6, 3.8 + f * 0.4, 1.9, 1.9, "n");
    P.ell(12.8, 4.1 + f * 0.4, 1, 1.1, "pink", { k: 0.5 });
    P.px(18, 7 + f * 0.4, "pink", 0.4);
    P.px(17, 8.6 + f * 0.4, TOOTH);
    look(P, 15, 5.4 + f * 0.4, E, false, q);
    P.px(18.4, 5.6, "#d8d0c4"); P.px(19, 6.4, "#d8d0c4");
  }

  function wolf(P, c, f) {
    const E = c.E, dy = f - 1.4, q = c.q, ff = q ? q.ff || 0 : 0, fb = q ? q.fb || 0 : 0, D = 3.6;
    if (q) sink(P, q, D, 7, 18, 17, 22, 3.4);
    P.layer = 1;
    const tl = [[5, 8], [3, 9.4], [1.6, 11.5 + f * 1.2], [1.4, 13.5 + f * 1.2]];
    if (q) flat(P, () => limb(P, lerpPts(tl, [[5, 8 + D], [2.6, 14.4], [0, 16], [-2.6, 16.6]], fb), 1.9, 1, "ad"));
    else limb(P, tl, 1.9, 1, "ad");
    const legs = (x, k, front) => {
      const dn = front ? [[x, 10 + D], [x + 2, 15.2], [x + 5.4, 16]] : [[x, 10 + D], [x + 2.6, 15.4], [x - 1.6, 16]];
      limb(P, lerpPts([[x, 10], [x, 13], [x, 16]], dn, k), 1.5, 1.2, "ad"); P.ell(lerp(x + 0.6, front ? x + 6 : x - 1.4, k), 16.6, 1.8, 0.9, "ad");
    };
    if (q) flat(P, () => { legs(8.5, fb, false); legs(16.5, ff, true); });
    else for (const x of [8.5, 16.5]) { limb(P, [[x, 10], [x, 13], [x, 16]], 1.5, 1.2, "ad"); P.ell(x + 0.6, 16.6, 1.8, 0.9, "ad"); }
    P.layer = 2;
    P.ell(11, 9 + dy, 8, 4.3, "a", { fn: fur });
    P.ell(6.5, 9.4 + dy, 4.3, 4.3, "a", { fn: fur });
    P.ell(16.5, 9 + dy, 4.4, 4.6, "a", { fn: fur });
    P.ell(11, 12 + dy, 6.5, 1.8, "b", { fn: from(11.4 + dy) });
    for (let i = 0; i < 6; i++) P.poly([[7 + i * 2, 5.2 + dy], [8 + i * 2, 3.4 + dy + (i % 2) * 0.6], [9.4 + i * 2, 5.6 + dy]], "a", -0.1);
    P.layer = 3;
    if (q) flat(P, () => {
      limb(P, lerpPts([[6.2, 10 + dy], [4.6, 12.6], [6, 15.2]], [[6.2, 10 + dy + D], [9.6, 14.8], [5.6, 16]], fb), 2.2, 1.2, "n"); P.ell(lerp(7, 5.4, fb), 16.6, 2, 1, "n", { s: 0.1 });
      limb(P, lerpPts([[18.8, 10 + dy], [19, 13], [19.2, 15.8]], [[18.8, 10 + dy + D], [19.6, 15.4], [24.4, 16]], ff), 1.7, 1.2, "n"); P.ell(lerp(19.8, 25, ff), 16.6, 2, 1, "n", { s: 0.1 });
    });
    else {
      limb(P, [[6.2, 10 + dy], [4.6, 12.6], [6, 15.2]], 2.2, 1.2, "n"); P.ell(7, 16.6, 2, 1, "n", { s: 0.1 });
      limb(P, [[18.8, 10 + dy], [19, 13], [19.2, 15.8]], 1.7, 1.2, "n"); P.ell(19.8, 16.6, 2, 1, "n", { s: 0.1 });
    }
    P.layer = 4;
    limb(P, [[16.5, 8.5 + dy], [19, 6.8 + dy]], 3.2, 2.8, "n");
    P.ell(18.5, 8.4 + dy, 2.2, 2, "b", { fn: from(8 + dy) });
    P.ell(20, 6.6 + dy, 3.1, 2.7, "n", { fn: fur });
    P.ell(22.8, 7.7 + dy, 2.3, 1.4, "n", { fn: fur });
    P.ell(22.4, 9, 2, 0.8, "b", { fn: from(9 + dy) });
    P.poly([[17.2, 4.6 + dy], [17.8, 0.8 + dy], [20.4, 4 + dy]], "n", (x, y) => 0.1 - (y - 1) * 0.04);
    P.poly([[18.2, 4 + dy], [18.4, 2.2 + dy], [19.6, 3.8 + dy]], "dhorn", 0.1);
    P.px(24, 7 + dy, INK); P.px(25, 7.4 + dy, INK);
    P.px(23, 9.2 + dy, TOOTH); P.px(24, 9.2 + dy, TOOTH);
    look(P, 21, 5.6 + dy, E, false, q);
  }

  function boar(P, c, f) {
    const E = c.E, dy = f - 1, q = c.q, ff = q ? q.ff || 0 : 0, fb = q ? q.fb || 0 : 0, D = 3;
    if (q) sink(P, q, D, 7, 19, 19, 24, 2.2);
    P.layer = 1;
    const far = (x, k, front) => { limb(P, lerpPts([[x, 11], [x, 14], [x, 16]], [[x, 11 + D], [x + (front ? 2 : 2.4), 15.4], [x + (front ? 4.6 : -1.4), 16]], k), 1.8, 1.4, "ad"); P.rect(lerp(x - 1, front ? x + 3.6 : x - 2.4, k), 16, 3, 1, "dhorn", -0.3); };
    if (q) flat(P, () => { far(8, fb, false); far(16.5, ff, true); });
    else for (const x of [8, 16.5]) { limb(P, [[x, 11], [x, 14], [x, 16]], 1.8, 1.4, "ad"); P.rect(x - 1, 16, 3, 1, "dhorn", -0.3); }
    P.layer = 2;
    P.ell(12.5, 9 + dy, 8.4, 5.4, "a", { fn: fur });
    P.ell(18, 9.2 + dy, 5, 4.8, "a", { fn: fur });
    P.ell(12.5, 12.8 + dy, 6.5, 1.6, "b", { fn: from(12 + dy) });
    for (let i = 0; i < 8; i++) P.poly([[7 + i * 1.5, 5 + dy], [8 + i * 1.5, 2.4 + dy + (i % 2)], [9.2 + i * 1.5, 5.2 + dy]], "ad", -0.1);
    P.layer = 3;
    if (q) flat(P, () => {
      limb(P, lerpPts([[6.5, 11 + dy], [6, 14], [6.5, 16]], [[6.5, 11 + dy + D], [9.4, 15.2], [5, 16]], fb), 2.4, 1.6, "n"); P.rect(lerp(5, 3.6, fb), 16, 3, 1, "dhorn", 0);
      limb(P, lerpPts([[19.4, 11 + dy], [19.4, 14], [19.4, 16]], [[19.4, 11 + dy + D], [20.6, 15.2], [23.4, 16]], ff), 2, 1.5, "n"); P.rect(lerp(18, 22.4, ff), 16, 3, 1, "dhorn", 0);
    });
    else {
      limb(P, [[6.5, 11 + dy], [6, 14], [6.5, 16]], 2.4, 1.6, "n"); P.rect(5, 16, 3, 1, "dhorn", 0);
      limb(P, [[19.4, 11 + dy], [19.4, 14], [19.4, 16]], 2, 1.5, "n"); P.rect(18, 16, 3, 1, "dhorn", 0);
    }
    P.layer = 4;
    P.ell(21, 9.2 + dy, 3.6, 3.3, "n", { fn: fur });
    P.ell(23.4, 10.4 + dy, 2, 2, "b");
    P.px(24, 10 + dy, INK); P.px(24, 11 + dy, INK);
    P.poly([[19, 6.4 + dy], [19.8, 3.2 + dy], [22.2, 6 + dy]], "n", 0.1);
    P.poly([[22, 12 + dy], [22.8, 12.6 + dy], [24.4, 8.4 + dy], [23.4, 9 + dy]], "horn", 0.4);
    P.poly([[20.4, 12 + dy], [21, 12.8 + dy], [21.6, 14.4 + dy], [20.4, 13.8 + dy]], "horn", 0.1);
    look(P, 21.4, 7.6 + dy, E, false, q);
    const tl = [[3.6, 7.4 + dy], [2, 6.6 + dy], [2.4, 5 + dy]];
    limb(P, q ? lerpPts(tl, [[3.6, 7.4 + dy], [2.2, 9.4 + dy], [1.6, 11 + dy]], fb) : tl, 0.8, 0.5, "ad");
  }

  function bear(P, c, f) {
    const E = c.E, dy = f, q = c.q, ff = q ? q.ff || 0 : 0, fb = q ? q.fb || 0 : 0, D = 3;
    if (q) sink(P, q, D, 8, 20, 19, 25, 4.6);
    P.layer = 1;
    const far = (x, k, front) => { limb(P, lerpPts([[x, 17], [x, 20], [x, 23]], [[x, 17 + D], [x + (front ? 2.4 : 3), 22.4], [x + (front ? 5.4 : -1.6), 23.2]], k), 3, 2.6, "ad"); P.ell(lerp(x + 1, front ? x + 6.6 : x - 1.6, k), 24, 3.2, 1.3, "ad"); };
    if (q) flat(P, () => { far(10, fb, false); far(22, ff, true); });
    else for (const x of [10, 22]) { limb(P, [[x, 17], [x, 20], [x, 23]], 3, 2.6, "ad"); P.ell(x + 1, 24, 3.2, 1.3, "ad"); }
    P.layer = 2;
    P.ell(14, 15 + dy, 10.4, 7.6, "a", { fn: fur });
    P.ell(19.6, 11.6 + dy, 6.2, 5.6, "a", { fn: fur });
    P.ell(13, 20.2 + dy, 7.6, 2.4, "b", { fn: from(19.4 + dy) });
    P.layer = 3;
    if (q) flat(P, () => {
      limb(P, lerpPts([[6.5, 17 + dy], [6, 20.4], [6.4, 23]], [[6.5, 17 + dy + D], [10.4, 22.6], [5, 23.4]], fb), 3.8, 3, "n"); P.ell(lerp(7.2, 4.4, fb), 24.2, 3.6, 1.4, "n", { s: 0.1 });
      limb(P, lerpPts([[19, 18 + dy], [19.4, 21], [19.4, 23]], [[19, 18 + dy + D], [21, 22.8], [25.4, 23.4]], ff), 3.4, 2.8, "n"); P.ell(lerp(20.2, 26.6, ff), 24.2, 3.4, 1.4, "n", { s: 0.1 });
      for (const x of [5.5, 7, 8.5]) P.px(x + (4.4 - 7.2) * fb, 25, TOOTH);
      for (const x of [18.6, 20.2, 21.8]) P.px(x + (26.6 - 20.2) * ff, 25, TOOTH);
    });
    else {
      limb(P, [[6.5, 17 + dy], [6, 20.4], [6.4, 23]], 3.8, 3, "n"); P.ell(7.2, 24.2, 3.6, 1.4, "n", { s: 0.1 });
      limb(P, [[19, 18 + dy], [19.4, 21], [19.4, 23]], 3.4, 2.8, "n"); P.ell(20.2, 24.2, 3.4, 1.4, "n", { s: 0.1 });
      for (const x of [5.5, 7, 8.5, 18.6, 20.2, 21.8]) P.px(x, 25, TOOTH);
    }
    P.layer = 4;
    P.ell(23.2, 9 + dy, 4.8, 4.2, "n", { fn: fur });
    P.ell(21.2, 4.6 + dy, 1.9, 1.9, "n"); P.ell(21.4, 4.9 + dy, 1, 1, "bd", { k: 0.4 });
    P.ell(26, 4.8 + dy, 1.9, 1.9, "n"); P.ell(26, 5 + dy, 1, 1, "bd", { k: 0.4 });
    P.ell(26.4, 10.8 + dy, 2.9, 2.3, "b");
    P.px(28, 9.6 + dy, INK); P.px(27, 9.6 + dy, INK); P.px(27, 12.6 + dy, INK); P.px(26, 12.6 + dy, INK);
    P.px(28, 12 + dy, TOOTH);
    look(P, 23.2, 7.6 + dy, E, true, q);
    P.px(22, 6.4 + dy, "ad", -0.2); P.px(23, 6.4 + dy, "ad", -0.2);
  }

  // posed: lift (body up), drop (body down onto the floor), splay (feet out), squash, head (the head sags), curl[i] per leg pair
  // (0 standing, 1 folded up over the back), eyes (0 lit, 1 dark)
  function spider(P, c, f, big) {
    const q = c.q, E = q && q.eyes ? mix(c.E, "#2a1a2a", q.eyes) : c.E, abd = c.p1;
    const legs = [[[12, 9], [5.5, 3], [0.8, 12.6]], [[13.4, 9], [9.6, 1.8], [7, 14.6]], [[15.4, 9], [20, 1.8], [19.4, 14.8]], [[16.4, 8.6], [22.4, 3.4], [23, 12.4]]];
    const by = q ? (q.drop || 0) - (q.lift || 0) : 0, sq = q ? q.squash || 0 : 0, hy = by + (q ? q.head || 0 : 0), fb = f * 0.5;
    const KC = [[4.4, 0.8], [9.0, 0.0], [16.2, 0.6], [20.0, 2.2]], FC = [[1.4, 4.6], [6.6, 3.6], [18.6, 3.8], [22.8, 5.8]];
    const pose = (l, i) => {
      if (!q) return null;
      const sp = q.splay || 0, cl = c01(((q.curl || [])[i] || 0)), out = l[2][0] < 11 ? -1 : 1;
      let kn = [l[1][0] + out * sp * 1.6, l[1][1] + sp * 2.2 + by * 0.35], ft = [l[2][0] + out * sp * 2.4, Math.min(14.8, l[2][1] + by * 0.1)];
      kn = [lerp(kn[0], KC[i][0], cl), lerp(kn[1], KC[i][1] + by, cl)]; ft = [lerp(ft[0], FC[i][0], cl), lerp(ft[1], FC[i][1] + by, cl)];
      return [[l[0][0], l[0][1] + by], kn, ft];
    };
    const draw = (set, m, dx, layer, r) => {
      P.layer = layer;
      set.forEach((l, i) => {
        const pz = pose(l, i);
        if (pz) { ln(P, pz[0][0] + dx, pz[0][1], pz[1][0] + dx, pz[1][1], m, 0, r); ln(P, pz[1][0] + dx, pz[1][1], pz[2][0] + dx, pz[2][1], m, -0.15, r * 0.85); return; }
        const dk = (i % 2 ? f : -f);
        const k = [l[1][0] + dx, l[1][1] + dk * 0.9];
        ln(P, l[0][0] + dx, l[0][1], k[0], k[1], m, 0, r);
        ln(P, k[0], k[1], l[2][0] + dx, l[2][1], m, -0.15, r * 0.85);
      });
    };
    draw(legs, "ad", 1.2, 1, 0.45);
    P.layer = 2;
    P.ell(7.6, 7.2 + fb + by + sq * 0.6, 5.4 + sq * 0.5, 4.4 - sq * 0.6, "a");
    P.ell(14.8, 8.2 + hy, 3.4, 2.8, "a");
    P.ell(8, 8.6 + fb + by + sq * 0.6, 3.2, 1.6, "b", { s: -0.1, k: 0.6, fn: from(8.4 + by) });
    P.layer = 3;
    for (const [x, y] of [[6, 4.8], [9, 4.6], [7.4, 8.4], [10.4, 7.4]]) P.px(x, y + fb + by + sq * 0.6, abd, 0);
    ln(P, 7, 5.6 + by, 7.6, 9.4 + by, "b", 0.2);
    draw(legs, "n", 0, 3, 0.5);
    P.layer = 4;
    P.ell(17, 8 + hy, 2, 2, "n", { s: 0.1 });
    P.px(17, 6.5 + hy, E); P.px(18, 7 + hy, E); P.px(16, 6.4 + hy, E); P.px(18.6, 8.4 + hy, E);
    if (!q || !q.eyes || q.eyes < 0.5) P.px(16.4, 7.2 + hy, "#ffffff");
    P.poly([[17.4, 9.4 + hy], [18.4, 9.4 + hy], [18, 11.6 + hy]], "horn", 0.2);
  }

  function bat(P, c, f) {
    const E = c.E, q = c.q, dn = q ? q.down || 0 : 0, hd = dn * 3.6;
    const wing = (side) => {
      const X = (x) => (side < 0 ? x : 26 - x);
      let S = [11.5, 7], Wr = [5, 3.6 - 2.4 * f], F = [[0.4, 7.4 - 3.6 * f], [3, 11.6 - 3.4 * f], [7, 12.4 - 2.4 * f]], R = [11.5, 10.4];
      // dead: the wings fall open flat on the floor either side of the body
      if (q) { S = mid(S, [11.4, 10.6], dn); Wr = mid(Wr, [4.6, 10.4], dn); F = lerpPts(F, [[-0.8, 14.2], [2.8, 14.8], [7.4, 14.8]], dn); R = mid(R, [11.4, 13.4], dn); }
      const pts = [S, Wr, F[0], mid(F[0], F[1], 0.5), F[1], mid(F[1], F[2], 0.5), F[2], R];
      pts[3] = mid(pts[3], Wr, 0.3); pts[5] = mid(pts[5], Wr, 0.3); pts[3] = mid(pts[3], S, 0.12); pts[5] = mid(pts[5], S, 0.12);
      P.layer = 1;
      P.poly(pts.map((p) => [X(p[0]), p[1]]), "wm", (x, y) => 0.25 - Math.hypot(x - X(Wr[0]), y - Wr[1]) * 0.07 + (side > 0 ? -0.25 : 0));
      P.layer = 2;
      ln(P, X(S[0]), S[1], X(Wr[0]), Wr[1], "wb", 0.2, 0.55);
      for (const t of F) ln(P, X(Wr[0]), Wr[1], X(t[0]), t[1], "wb", side < 0 ? 0.2 : -0.2);
      P.px(X(Wr[0]), Wr[1] - 1, "wb", 0.3);
    };
    wing(-1); wing(1);
    P.layer = 3;
    P.ell(13, 9.4 + dn * 2.6, 3, 3.9 - dn * 0.8, "n", { fn: fur });
    P.ell(13, 10 + dn * 2.6, 1.8, 2.4 - dn * 0.6, "b", { k: 0.5 });
    if (!q || dn < 0.5) { P.px(12, 13.4, "horn", 0); P.px(14, 13.4, "horn", 0); }
    P.layer = 4;
    P.ell(13, 5.6 + hd, 3.2, 2.7, "n", { fn: fur });
    P.poly([[10.4, 4.6 + hd], [9.8, 0.8 + hd + dn * 1.6], [12.2, 3.4 + hd]], "n", 0.15);
    P.poly([[15.6, 4.6 + hd], [16.2, 0.8 + hd + dn * 1.6], [13.8, 3.4 + hd]], "n", -0.2);
    P.px(10.6, 3 + hd, "b", 0.2); P.px(15.4, 3 + hd, "b", -0.2);
    if (q && q.eyes > 0.5) { P.px(11, 5.2 + hd, INK); P.px(14.4, 5.2 + hd, INK); }
    else { P.px(11.4, 5.2 + hd, E); P.px(14.6, 5.2 + hd, E); P.px(11.4, 4.6 + hd, "#ffffff"); }
    P.px(13, 6.4 + hd, "pink", 0); P.px(12, 7.6 + hd, TOOTH); P.px(14, 7.6 + hd, TOOTH);
  }

  function slime(P, c, f) {
    const E = c.E;
    P.layer = 1;
    P.ell(11, 14.2, 10, 1.7, "ad", { s: -0.2 });
    P.layer = 2;
    P.ell(11, 10.4 - f * 0.4, 9, 5.4 + f * 0.6, "a", { k: 1.1, fn: (x, y, s) => (y > 14.4 ? false : s) });
    P.layer = 3;
    P.ell(12.6, 11.6, 3.6, 2.8, "ad", { k: 0.5, s: -0.35 });
    P.ell(12.4, 11.2, 1.6, 1.3, "bd", { k: 0.5, s: -0.2 });
    P.px(6, 12.5, "ad", -0.2); P.px(17, 8.6, "ad", -0.2); P.px(16, 12.6, "ad", -0.3);
    P.layer = 4;
    P.ell(7.4, 7.4 - f * 0.3, 2.7, 1.5, "b", { s: 0.3, k: 0.5 });
    P.px(6, 7, "#ffffff"); P.px(7, 6.6, "#ffffff"); P.px(5.4, 8.4, "#ffffff");
    for (const x of [8.6, 14]) { P.px(x, 9.4 - f * 0.4, "#f4fff0"); P.px(x + 1, 9.4 - f * 0.4, "#f4fff0"); P.px(x, 10.4 - f * 0.4, "#f4fff0"); P.px(x + 1, 10.4 - f * 0.4, E); }
    P.px(11, 12.4, E, 0); P.px(12, 12.4, E, 0);
  }

  // posed: arm (the near arm swings across the body as he goes over), eyes, crown: false leaves the ice crown off, part "crown" is only the crown
  function troll(P, c, f, ice, bridge) {
    const E = c.E, dy = f, q = c.q, am = q ? q.arm || 0 : 0;
    if (!(q && q.part === "crown")) {
      P.layer = 1;
      if (bridge && !(q && am > 0.3)) {
        // a plank off his own bridge, nails and all, held up in the far fist
        P.poly([[22.4, 30 + dy], [25, 30.6 + dy], [29.6, 12.6 + dy], [27, 11.8 + dy]], "wood", (x, y) => 0.4 - (x - 22) * 0.05 + (Math.round(y * 0.5 - x * 0.2) % 4 === 0 ? -0.3 : 0));
        ln(P, 27.2, 12, 23, 29.6 + dy, "wood", -0.35);
        for (const [x, y] of [[27.6, 14.6], [26.6, 18.6], [25.4, 23]]) { P.px(x, y + dy, "steel", 0.6); P.px(x + 1, y + dy, "iron", 0); }
      }
      const fa = [[21.4, 12.6 + dy], [24, 19], [23.4, 26]];
      limb(P, q ? lerpPts(fa, [[21.4, 12.6], [21.6, 19.4], [19.6, 25.4]], am) : fa, 3.2, 2.8, "ad"); if (q) P.ell(lerp(23.2, 19.4, am), lerp(27.6, 27.2, am), 3.2, 2.8, "ad"); else P.ell(23.2, 27.6, 3.2, 2.8, "ad");
      limb(P, [[17.4, 25], [18, 29], [18, 32.4]], 3.6, 3.2, "ad"); P.ell(19, 33, 4, 1.7, "ad");
      P.layer = 2;
      P.ell(14.6, 16 + dy, 8.6, 9.4, "a");
      P.ell(12.4, 11.6 + dy, 8.2, 5, "a");
      P.ell(14, 20.4 + dy, 5.8, 5.4, "b", { k: 0.8, fn: (x, y, s) => s + ((x + y * 3) % 7 === 0 ? -0.3 : 0) });
      P.layer = 3;
      P.rect(8, 24 + dy, 13, 3, "cloth", (x, y) => 0.2 - (x - 8) * 0.04 - (y - 24) * 0.2);
      if (bridge) {
        P.ell(17.6, 27.6 + dy, 1.8, 2, "cloth", { s: -0.1 }); P.px(17, 29 + dy, "gold", 0.4); P.px(18, 29.4 + dy, "gold", 0.1);
        for (const [x, y, rx] of [[9.4, 8.6, 3.2], [15.6, 7.6, 2.6], [7.4, 13, 1.8], [19.6, 17.6, 1.6]]) P.ell(x, y + dy, rx, rx * 0.55, "moss", { k: 0.5, fn: fur });
      }
      P.poly([[10, 27 + dy], [12.4, 27 + dy], [11.4, 30 + dy]], "cloth", -0.2);
      P.poly([[15, 27 + dy], [17.4, 27 + dy], [16.4, 30.4 + dy]], "cloth", -0.3);
      limb(P, [[9.6, 28], [9, 31], [9, 33.2]], 4, 3.4, "n"); P.ell(9.6, 34, 4.4, 1.8, "n", { s: 0.1 });
      P.layer = 4;
      const na = [[8.4, 12.6 + dy], [5.6, 19], [6.6, 26 + dy * 0.5]], hx = lerp(6.6, 15.4, am), hy = lerp(28.4 + dy * 0.5, 22.6, am);
      limb(P, q ? lerpPts(na, [[8.4, 12.6], [10.4, 19.4], [14.6, 21.6]], am) : na, 3.6, 3.2, "n");
      if (q) { P.ell(hx, hy, 3.4, 3, "n", { s: 0.1 }); P.rect(hx - 1.6, hy + 1.6, 1, 1, "horn", 0.2); P.rect(hx + 1.4, hy + 1.6, 1, 1, "horn", 0.2); }
      else { P.ell(6.6, 28.4 + dy * 0.5, 3.4, 3, "n", { s: 0.1 }); P.rect(5, 30 + dy * 0.5, 1, 1, "horn", 0.2); P.rect(8, 30 + dy * 0.5, 1, 1, "horn", 0.2); }
      for (const [x, y] of [[10, 14], [17, 18], [13, 12], [7, 22]]) P.px(x, y + dy, "bd", 0);
      P.layer = 5;
      P.ell(20, 8 + dy, 4.8, 4.2, "n", { s: 0.15 });
      P.ell(21.2, 10.8 + dy, 3.6, 2.2, "n", { fn: from(10 + dy) });
      P.ell(24.4, 8.6 + dy, 1.7, 1.5, "bd", { k: 0.6 });
      P.poly([[16.2, 8 + dy], [13, 5.6 + dy], [16.4, 10.6 + dy]], "n", -0.1);
      P.poly([[17.8, 7.6 + dy], [14.6, 6.4 + dy], [17.4, 9.4 + dy]], "bd", -0.2);
      P.rect(19, 6.4 + dy, 5, 1, "ad", -0.5);
      if (q && q.eyes > 0.5) { shut(P, 20, 7.8 + dy); shut(P, 22.4, 7.8 + dy); }
      else { P.px(20.4, 7.8 + dy, E); P.px(23, 7.8 + dy, E); P.px(20.4, 7.2 + dy, "#ffffff"); }
      P.poly([[19.6, 10.4 + dy], [20.6, 10.4 + dy], [20.2, 7.8 + dy + 3.6]], "horn", 0.4);
      P.poly([[23.2, 10.4 + dy], [24.2, 10.4 + dy], [23.6, 13.6 + dy]], "horn", 0.2);
      P.rect(21, 10 + dy, 2, 1, "void", 0);
      if (bridge) {
        P.ell(25.4, 9.2 + dy, 2, 1.3, "n", { s: 0.2 });
        P.px(26, 8.4 + dy, "bd", 0); P.px(24.6, 10 + dy, "bd", -0.2);
        P.layer = 6;
        P.ell(20, 4.6 + dy, 4.8, 2.6, "iron", { s: 0.25, fn: (x, y, s) => (y > 5.2 + dy ? false : s + (x === 18 ? -0.3 : 0)) });
        P.rect(14.6, 5 + dy, 11, 1, "iron", (x) => 0.2 - (x - 15) * 0.05);
        P.px(17, 3 + dy, "rust", 0); P.px(22, 4 + dy, "rust", -0.1);
      }
    }
    if (ice && !(q && q.crown === false)) {
      P.layer = 6;
      P.rect(15.4, 2.4 + dy, 10, 1, "b", 0.4);
      for (const [x, h] of [[16, 3], [19, 5], [22, 4], [24.4, 2.6]]) P.poly([[x - 0.8, 3.4 + dy], [x + 0.2, 3.4 - h + dy], [x + 1.4, 3.4 + dy]], "b", 0.5);
    }
  }

  // posed: ff, fb (forelegs and haunches folded, 0 to 1), neck (the head lowered to the floor), wings (drooped), tail (laid flat), eyes
  function dragon(P, c, f, big) {
    const E = c.E, q = c.q, W = (P.dw || P.w) / P.s, H = (P.dh || P.h) / P.s, sc = big ? 1.5 : 1, flap = f ? -2.6 * sc : 0;
    const x = (v) => W * v, y = (v) => H * v;
    const ff = q ? q.ff || 0 : 0, fb = q ? q.fb || 0 : 0, nk = q ? q.neck || 0 : 0, wg = q ? q.wings || 0 : 0, tl = q ? q.tail || 0 : 0, D = H * 0.12;
    if (q) P.bend = (px) => lerp(fb, ff, rmp(px, x(0.36), x(0.62))) * D;
    const sh = [x(0.46), y(0.5)], wr = [x(0.37) - wg * x(0.03), y(0.15) + flap + wg * y(0.24)];
    const tips = q ? [[x(0.03) - wg * x(0.04), y(0.2) + wg * y(0.52)], [x(0.1) - wg * x(0.03), y(0.38) + wg * y(0.4)], [x(0.22), y(0.52) + wg * y(0.2)]]
      : [[x(0.03), y(0.2) + flap * 0.7], [x(0.1), y(0.38) + flap * 0.35], [x(0.22), y(0.52)]];
    const root = [x(0.3), y(0.62)];
    const sc2 = (a, b) => mid(mid(a, b, 0.5), wr, 0.24);
    const wingPts = (dx, dy) => [sh, wr, tips[0], sc2(tips[0], tips[1]), tips[1], sc2(tips[1], tips[2]), tips[2], root].map((p) => [p[0] + dx, p[1] + dy]);
    const wsh = (dx, dy, k) => (px, py) => 0.35 - Math.hypot(px - wr[0] - dx, py - wr[1] - dy) / (W * 0.4) * 1.1 + k;
    P.layer = 0;
    P.poly(wingPts(x(0.08), -y(0.03)), "wmd", wsh(x(0.08), -y(0.03), -0.3));
    P.layer = 1;
    P.poly(wingPts(0, 0), "wm", wsh(0, 0, 0));
    ln(P, sh[0], sh[1], wr[0], wr[1], "wb", 0.4, 0.55 * sc);
    for (const t of tips) ln(P, wr[0], wr[1], t[0], t[1], "wb", 0.15, 0.4 * sc);
    P.ell(wr[0], wr[1], 1.3 * sc, 1.3 * sc, "wb", { s: 0.3 });
    ln(P, wr[0], wr[1], wr[0] - 1.2 * sc, wr[1] - 1.8 * sc, "horn", 0.4);
    const tail = [];
    for (let i = 0; i < 12; i++) { const t = i / 11; tail.push([x(0.34 - t * 0.31), y(0.64 + Math.sin(t * 3 + f * 0.7) * 0.1 + t * 0.08)]); }
    const tailDraw = () => {
      // laid flat, the tail runs along the floor from the haunch
      const tp = q ? tail.map((p, i) => { const t = i / 11; return [p[0] - tl * t * x(0.05), lerp(p[1] + fb * D * (1 - t), y(0.9) - (1 - t) * y(0.1) * (1 - fb), tl * Math.min(1, t * 1.6))]; }) : tail;
      limb(P, tp, 3 * sc, 0.5 * sc, "a");
      const tt = tp[11];
      P.poly([[tt[0] + 0.6, tt[1]], [tt[0] - 2.4 * sc, tt[1] - 1.8 * sc * (1 - tl * 0.6)], [tt[0] - 1.8 * sc, tt[1] + 1 * sc * (1 - tl * 0.6)]], "b", 0.2);
    };
    if (q) flat(P, tailDraw); else tailDraw();
    const legsFar = () => {
      for (const [lx, k, front] of [[0.33, fb, false], [0.56, ff, true]]) {
        const st = [[x(lx + 0.08), y(0.68)], [x(lx + 0.09), y(0.82)], [x(lx + 0.06), y(0.9)]];
        const dn = front ? [[x(lx + 0.08), y(0.68) + D], [x(lx + 0.1), y(0.88)], [x(lx + 0.18), y(0.92)]] : [[x(lx + 0.08), y(0.68) + D], [x(lx + 0.15), y(0.88)], [x(lx + 0.02), y(0.92)]];
        limb(P, q ? lerpPts(st, dn, k) : st, 2 * sc, 1 * sc, "ad");
        P.ell(q ? lerp(x(lx + 0.08), x(lx + (front ? 0.2 : 0.02)), k) : x(lx + 0.08), y(0.93), 2.2 * sc, 0.9 * sc, "ad");
      }
    };
    if (q) flat(P, legsFar); else legsFar();
    P.layer = 2;
    const bx = x(0.46), by = y(0.64), brx = 8.6 * sc, bry = 4.6 * sc;
    P.ell(bx, by, brx, bry, "a", { fn: (px, py, s) => s + ((px + (py & 1) * 2) % 4 === 0 ? -0.18 : 0) });
    P.ell(x(0.57), y(0.6), 5.6 * sc, 5 * sc, "a");
    const hx = x(0.76) + nk * x(0.07), hy = q ? lerp(y(0.22), H - 1.6 - 3.4 * sc - ff * D, nk) : y(0.22);
    const neck = [];
    for (let i = 0; i < 6; i++) { const t = i / 5; neck.push([x(0.55) + (hx - 1.5 * sc - x(0.55)) * t, y(0.56) + (hy + 1.5 * sc - y(0.56)) * t + Math.sin(t * Math.PI) * 1.2 * sc * (1 - nk * 2.2)]); }
    limb(P, neck, 3.2 * sc, 2 * sc, "a");
    neck.forEach((n, i) => { const r = 3.2 * sc - i * 0.24 * sc; P.ell(n[0] + r * 0.4, n[1] + r * 0.55, r * 0.5, r * 0.65, "b", { k: 0.7, fn: (px, py, s) => s + ((py | 0) % 2 ? -0.2 : 0.05) }); });
    P.ell(bx + 0.5 * sc, by + 3 * sc, 7.6 * sc, 2.3 * sc, "b", { s: -0.05, fn: (px, py, s) => (py < by + 2.2 * sc ? false : s + ((py | 0) % 2 ? -0.28 : 0.08)) });
    P.layer = 3;
    for (let i = 0; i < 7; i++) {
      const px = bx - 5 * sc + i * 2.3 * sc, nx = (px - bx) / brx, py = Math.abs(nx) < 1 ? by - bry * Math.sqrt(1 - nx * nx) : by;
      P.poly([[px - 1, py + 1], [px - 0.3 * sc, py - 1.6 * sc], [px + 1, py + 1]], "bd", -0.1);
    }
    neck.forEach((n, i) => { if (i % 2 === 0 && i < 5) P.poly([[n[0] - 1.2, n[1] - 1.8 * sc], [n[0] - 0.8, n[1] - 3.4 * sc], [n[0] + 0.4, n[1] - 2.2 * sc]], "bd", -0.1); });
    const legsNear = () => {
      limb(P, q ? lerpPts([[x(0.37), y(0.68)], [x(0.4), y(0.82)], [x(0.36), y(0.91)]], [[x(0.37), y(0.68) + D], [x(0.46), y(0.88)], [x(0.3), y(0.92)]], fb) : [[x(0.37), y(0.68)], [x(0.4), y(0.82)], [x(0.36), y(0.91)]], 2.8 * sc, 1.2 * sc, "n");
      if (!q) P.ell(x(0.38), y(0.7), 4 * sc, 3.7 * sc, "n");
      P.ell(q ? lerp(x(0.36), x(0.29), fb) : x(0.36), y(0.93), 2.6 * sc, 1 * sc, "n", { s: 0.1 });
      limb(P, q ? lerpPts([[x(0.6), y(0.68)], [x(0.65), y(0.8)], [x(0.64), y(0.91)]], [[x(0.6), y(0.68) + D], [x(0.63), y(0.88)], [x(0.74), y(0.92)]], ff) : [[x(0.6), y(0.68)], [x(0.65), y(0.8)], [x(0.64), y(0.91)]], 2.1 * sc, 1.1 * sc, "n");
      P.ell(q ? lerp(x(0.65), x(0.76), ff) : x(0.65), y(0.93), 2.4 * sc, 0.9 * sc, "n", { s: 0.1 });
      for (const [lx, k, d] of [[0.31, fb, -0.07], [0.34, fb, -0.07], [0.37, fb, -0.07], [0.61, ff, 0.11], [0.64, ff, 0.11], [0.67, ff, 0.11]]) P.px(x(lx + (q ? d * k : 0)), H - 1, "horn", 0.2);
    };
    if (q) { flat(P, legsNear); P.ell(x(0.38), y(0.7), 4 * sc, 3.7 * sc, "n"); } else legsNear();
    P.layer = 4;
    P.ell(hx, hy, 3.7 * sc, 2.9 * sc, "n");
    P.ell(hx + 3.3 * sc, hy + 0.9 * sc, 3 * sc, 1.7 * sc, "n");
    P.ell(hx + 2.8 * sc, hy + 2.5 * sc, 2.8 * sc, 0.9 * sc, "b", { fn: (px, py, s) => (py < hy + 2.2 * sc ? false : s) });
    P.layer = 5;
    limb(P, [[hx - 1 * sc, hy - 1.8 * sc], [hx - 3.4 * sc, hy - 2.6 * sc], [hx - 6.4 * sc, hy - 1.6 * sc]], 1.2 * sc, 0.4 * sc, "horn");
    limb(P, [[hx + 0.2 * sc, hy - 2.3 * sc], [hx - 2 * sc, hy - 3.8 * sc], [hx - 4.6 * sc, hy - 3.8 * sc]], 0.9 * sc, 0.4 * sc, "dhorn");
    P.px(hx + 5.8 * sc, hy + 0.2 * sc, INK); P.px(hx + 5.8 * sc, hy + 1.2 * sc, INK);
    for (let i = 0; i < 3; i++) P.px(hx + (2 + i * 1.4) * sc, hy + 2.2 * sc, TOOTH);
    if (q && q.eyes > 0.5) shut(P, hx + 1 * sc, hy - 0.6 * sc);
    else { P.px(hx + 1.2 * sc, hy - 0.8 * sc, E); P.px(hx + 2.2 * sc, hy - 0.8 * sc, INK); P.px(hx + 1.2 * sc, hy - 1.8 * sc, "#ffffff"); }
    P.rect(hx - 0.2 * sc, hy - 1.6 * sc, 3.4 * sc, 1, "ad", -0.4);
    if (big && f && !q) { P.px(hx + 7.2 * sc, hy + 1.4 * sc, "#ffd84a"); P.px(hx + 7.8 * sc, hy + 2 * sc, "#ff8a2a"); }
  }

  function chest(P, c, f) {
    const E = c.E, ly = 6 - f * 2;
    P.layer = 1;
    P.rect(2, 8, 20, 10, "void", 0);
    P.layer = 2;
    P.rect(2, 9, 20, 9, "a", (x, y) => 0.3 - (x - 2) * 0.03 - (y - 9) * 0.08 + ((x - 2) % 5 === 4 ? -0.35 : 0));
    P.rect(2, 9, 20, 1, "b", 0.4);
    P.rect(2, 15, 20, 1, "b", 0.1);
    P.rect(2, 13, 2, 5, "b", 0.2); P.rect(20, 13, 2, 5, "b", -0.3);
    P.rect(2, 17, 20, 1, "ad", -0.5);
    P.px(1, 18, "ad", -0.2); P.px(22, 18, "ad", -0.2);
    P.ell(12, 13, 2.1, 2.4, "b", { s: 0.1 });
    P.px(12, 13, INK); P.px(12, 14, INK);
    P.layer = 3;
    P.ell(12, ly - 0.5, 10.5, 4.4, "a", { fn: (x, y, s) => (y > ly + 0.5 ? false : s) });
    P.rect(2, ly - 3, 20, 1, "ad", 0);
    P.rect(5, ly - 3, 2, 4, "b", 0.2); P.rect(17, ly - 3, 2, 4, "b", -0.3);
    P.layer = 4;
    P.rect(3, ly + 0.5, 18, 1, "void", 0);
    P.rect(3, ly + 1, 18, 1, "#8a1a2a", 0);
    P.ell(14, 8.3, 3.2, 1, "pink", { k: 0.6, s: -0.1 });
    for (let x = 3; x < 21; x += 2) { P.px(x, ly + 1, TOOTH); P.px(x, ly + 2 > 8 ? 8 : ly + 2, TOOTH); P.px(x + 1, 8, TOOTH); P.px(x + 1, 7, "#d8d0bc"); }
    P.px(7, ly - 1.5, E); P.px(8, ly - 1.5, INK); P.px(7, ly - 2.5, "#ffffff");
    P.px(15, ly - 1.5, E); P.px(16, ly - 1.5, INK); P.px(15, ly - 2.5, "#ffffff");
    P.rect(6, ly - 3, 4, 1, "ad", -0.5); P.rect(14, ly - 3, 4, 1, "ad", -0.5);
  }

  function wraith(P, c, f) {
    const E = c.E;
    P.layer = 1;
    const hem = [[7, 11], [15, 11], [19.4, 21], [19, 26], [17, 25 + f], [16.4, 28.6 + f], [14, 26], [12, 29.4 - f], [10, 26.4], [8, 28.6], [6.4, 25 - f], [3.4, 26.6], [3, 21]];
    P.poly(hem, "a", (x, y) => 0.4 - (x - 3) * 0.075 - (y - 11) * 0.015 + (Math.sin(x * 1.5 + f) > 0.55 ? -0.35 : 0));
    ln(P, 10, 15, 9, 26 + f, "ad", -0.2); ln(P, 14, 15, 15, 25 - f, "ad", -0.4);
    P.layer = 2;
    limb(P, [[16, 14], [19, 16.4], [20.4, 19 + f]], 1.5, 0.9, "ad");
    limb(P, [[6.5, 14], [3.6, 16.6], [1.6, 19 - f]], 1.5, 0.9, "a");
    for (const [hx, hy, d] of [[20.6, 20 + f, 1], [1.6, 20 - f, -1]]) { ln(P, hx, hy, hx + d * 1, hy + 2.6, "horn", 0.2); ln(P, hx + d, hy - 0.5, hx + d * 2.2, hy + 1.8, "horn", 0); ln(P, hx - d, hy, hx - d * 0.6, hy + 2.4, "horn", -0.1); }
    P.layer = 3;
    P.poly([[7.2, 10.6], [10.8, 0.6 + f * 0.6], [15.2, 10.6]], "a", (x) => 0.35 - (x - 7) * 0.08);
    P.ell(11, 8, 5.4, 5.6, "a");
    P.layer = 4;
    P.ell(12, 8.6, 3.2, 3.5, "void", { k: 0 });
    P.px(10.6, 8.4, E); P.px(14, 8.4, E); P.px(10.6, 7.6, "#ffffff"); P.px(14, 7.6, "#ffffff");
    P.px(11, 8.4, E); P.px(14.6, 8.4, E);
    P.rect(11, 11, 3, 1, "void", 0);
  }

  // part "skull" is only the crowned skull; part "body" is everything else
  function lich(P, c, f) {
    const E = c.E, q = c.q, part = q && q.part;
    const skull = () => {
      P.layer = 3;
      P.ell(17, 9.5, 4.6, 5, "a", { s: 0.1 });
      P.rect(15, 13, 5, 2, "a", -0.15);
      for (let x = 15; x < 20; x += 2) P.px(x, 14, "void");
      for (const ex of [15.2, 19]) P.ell(ex, 10, 1.3, 1.3, "void", { k: 0 });
      if (!(q && q.eyes > 0.5)) { P.px(15, 10, E); P.px(19, 10, E); }
      P.px(17, 12, "void");
      P.rect(12.5, 4, 9, 2, "gold", 0.2);
      for (const x of [13, 15, 17, 19, 21]) { P.px(x, 3, "gold", 0.4); if (x % 4 === 1) P.px(x, 2, "gold", 0.6); }
      P.px(17, 4, E);
    };
    if (part === "skull") return skull();
    P.layer = 1;
    P.poly([[9, 9], [11.5, 1], [14, 9]], "bd", 0.1); P.poly([[20, 9], [22.5, 1], [25, 9]], "bd", -0.3);
    const hem = [[11, 13], [23, 13], [28, 30], [29, 39 + f], [26, 36], [24, 41 - f], [21, 37], [18, 42 + f], [15, 37], [12, 41 - f], [9, 36], [6, 39], [7, 30]];
    P.poly(hem, "b", (x, y) => 0.35 - (x - 6) * 0.05 - (y - 13) * 0.012 + (Math.sin(x * 1.3 + f) > 0.6 ? -0.4 : 0));
    P.rect(17, 15, 1, 22, "gold", 0.1); P.rect(11, 24, 13, 1, "gold", -0.1); P.px(17, 24, E);
    P.layer = 2;
    P.rect(5, 6, 1, 37, "wm", (x, y) => (y > 30 ? -0.3 : 0.15));
    limb(P, [[12, 15], [8, 19], [6, 23]], 2.4, 1.8, "b", 0.15);
    limb(P, [[22, 15], [26.5, 20], [28, 25]], 2.4, 1.8, "b", -0.25);
    P.ell(6, 23.5, 1.4, 1.4, "a", { s: 0.2 });
    for (const dx of [-1, 0, 1]) ln(P, 28 + dx, 26, 28 + dx * 1.5, 28.5, "a", -0.1);
    P.ell(5.5, 4.2, 2.6, 2.4, "a", { s: 0.2 }); P.px(4, 4, "void"); P.px(6, 4, "void"); P.rect(4, 6, 3, 1, "void", 0);
    if (part !== "body") skull();
    P.layer = 3;
    for (const [x, y] of [[5, 1 - f], [4, 0], [6, -1 + f], [5, -1]]) P.px(x, y + 1, E);
    P.px(5, 0, "#ffffff");
    for (const [x, y] of [[2, 16 + f], [31, 12 - f], [30, 33 + f], [1, 30 - f]]) P.px(x, y, E);
  }

  // part "hat" / "pot" paints only the hat or the cauldron; part "body" is the crone without either
  function crone(P, c, f) {
    const E = c.E, q = c.q, part = q && q.part;
    const hat = () => {
      P.layer = 4;
      P.poly([[14, 10.5], [28, 9], [23, 4], [27, -1], [19, 3]], "bd", (x) => 0.2 - (x - 14) * 0.05);
      P.ell(21, 9.8, 8.2, 1.6, "bd", { s: -0.1 });
      P.rect(18, 7, 6, 1, "gold", 0.1);
    };
    const pot = () => {
      P.layer = 5;
      P.ell(9, 30.5, 6.6, 4.4, "iron", { s: 0.1 });
      P.ell(9, 26.6, 6.4, 1.3, "iron", { s: 0.4 });
      for (let x = 4; x <= 14; x++) P.px(x, 26.6, (x + f) % 3 ? "#5ab83a" : "#a8f07a");
      for (const [x, y] of [[6, 24 - f], [11, 23 + f], [8, 21 - f]]) P.px(x, y, "#a8f07a");
      for (const x of [4, 13]) P.rect(x, 34, 1, 2, "iron", -0.3);
      for (const [x, y] of [[7, 35], [9, 34], [11, 35]]) P.px(x, y + (f ? 0 : 0), x === 9 ? "#ffd04a" : "#ff7a2a");
    };
    if (part === "hat") return hat();
    if (part === "pot") return pot();
    P.layer = 1;
    P.rect(31, 9, 1, 26, "wm", 0.05); P.px(31, 8, "wm", 0.4);
    P.poly([[7, 24], [25, 24], [27, 35], [5, 35]], "bd", (x, y) => 0.15 - (x - 5) * 0.04 + ((x + y * 3) % 7 === 0 ? -0.35 : 0));
    P.ell(16, 21, 10, 8.4, "b", { fn: fur });
    P.ell(12.5, 16.5, 7, 6, "b", { fn: fur });
    P.layer = 2;
    limb(P, [[20, 20], [26, 18], [30, 17]], 1.7, 1.2, "b", -0.1);
    P.ell(31, 17, 1.5, 1.5, "a", { s: 0.1 });
    P.ell(19, 11.5, 5.4, 4.4, "horn", { fn: (x, y, s) => s + ((x + y) % 3 === 0 ? -0.35 : 0) });
    for (let k = 0; k < 4; k++) ln(P, 15 + k, 13, 13 + k * 0.7, 20 + k, "horn", -0.2 - k * 0.1);
    P.layer = 3;
    P.ell(23, 14, 3.8, 4, "a", { s: 0.05 });
    P.poly([[25.5, 13], [29.6, 15.8], [26, 16.4]], "a", 0.2);
    P.px(28, 14, "ad"); P.px(23, 13, E); P.px(24, 13, INK); P.px(25, 17, INK); P.px(26, 17, TOOTH);
    if (part === "body") return;
    hat();
    pot();
  }

  function golem(P, c, f, big) {
    const E = c.E, dy = f;
    const block = (x, y, w, h, m, s0, ch) => {
      P.rect(x, y, w, h, m, (px, py) => s0 + 0.4 - (px - x) / w * 0.9 - (py - y) / h * 0.55 + (((px * 5 + py * 3) % 9) === 0 ? -0.3 : 0));
      if (ch) for (const [cx, cy] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) P.erase(cx, cy);
    };
    P.layer = 1;
    block(16, 23, 6, 10, "ad", 0, true);
    block(21.6, 13 + dy, 4.4, 11, "ad", 0, true);
    P.layer = 2;
    block(8, 10 + dy, 14, 13, "a", 0, true);
    block(6, 22, 18, 3, "ad", 0.1, true);
    P.layer = 3;
    block(9, 23, 6, 10, "n", 0, true);
    P.rect(8, 31, 8, 3, "ad", -0.1);
    P.rect(16, 31, 6, 3, "ad", -0.3);
    P.ell(7, 12 + dy, 4.8, 4, "n", { fn: fur });
    P.ell(23, 12 + dy, 4.4, 3.8, "n", { fn: fur });
    P.layer = 4;
    block(2.6, 13 + dy, 5, 11, "n", 0, true);
    P.ell(5, 26 + dy, 3.6, 3.2, "n", { s: 0.1 });
    for (const x of [3, 4.6, 6.2]) P.rect(x, 28 + dy, 1, 1, "ad", -0.2);
    P.layer = 5;
    block(11, 2 + dy, 8, 7, "n", 0.1, true);
    P.rect(11, 5 + dy, 8, 1, "ad", -0.5);
    P.layer = 6;
    P.px(12.4, 6.4 + dy, E); P.px(13.4, 6.4 + dy, E); P.px(16, 6.4 + dy, E); P.px(17, 6.4 + dy, E);
    P.rect(13, 8 + dy, 4, 1, "void", 0);
    for (const [x, y] of [[11, 14], [12, 15], [12, 16], [13, 17]]) P.px(x, y + dy, "bd", 0.2);
    P.px(15, 14 + dy, "b", 0.5); P.px(15, 15 + dy, "b", 0.5); P.px(14, 15 + dy, "b", 0.5); P.px(16, 15 + dy, "b", 0.5); P.px(15, 16 + dy, "b", 0.5);
    ln(P, 17, 12 + dy, 19, 15 + dy, "void", 0); ln(P, 19, 15 + dy, 18, 19 + dy, "void", 0);
    ln(P, 10, 25, 12, 28, "void", 0); ln(P, 5, 15 + dy, 4, 18 + dy, "void", 0);
    P.px(19, 16 + dy, "b", 0.4); P.px(12, 27, "b", 0.4);
  }

  // posed: drop, curl (legs folded in under the belly), claws (dropped open to the sides), eyes (stalks droop, eyes go dark); deaths.js turns it
  // over onto its back with tilt
  function crab(P, c, f) {
    const q = c.q, E = q && q.eyes ? mix(c.E, "#2a1a2a", q.eyes) : c.E, o = f ? 1 : 0, by = q ? q.drop || 0 : 0, cu = q ? c01(q.curl || 0) : 0, cl = q ? q.claws || 0 : 0, ey = q ? q.eyes || 0 : 0;
    P.layer = 1;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const bx = 13 + s * (3 + i * 1.7), fx = 13 + s * (6.6 + i * 2.4);
      if (q) {
        // folded in under the belly; a crab dies on its back, so these end up curled in the air
        const kn = mid([13 + s * (6 + i * 2), 12.6 + by * 0.5], [13 + s * (5.2 + i * 1.7), 17.6 + by - i * 0.4], cu), ft = mid([fx, 15.2], [13 + s * (2.8 + i * 1.3), 12.4 + by], cu);
        ln(P, bx, 11 + by, kn[0], kn[1], "ad", 0, 0.6); ln(P, kn[0], kn[1], ft[0], ft[1], "ad", -0.2, 0.55);
        continue;
      }
      ln(P, bx, 11, 13 + s * (6 + i * 2), 12.6 - o * (i % 2), "ad", 0, 0.6);
      ln(P, 13 + s * (6 + i * 2), 12.6 - o * (i % 2), fx, 15.2, "ad", -0.2, 0.55);
    }
    P.layer = 2;
    P.ell(13, 9 + by, 8, 4.4, "a", { k: 1.1 });
    P.ell(13, 11 + by, 6, 2, "b", { k: 0.5, fn: from(10.6 + by) });
    for (const [x, y] of [[9, 7], [13, 6], [16.4, 8], [11, 9.4]]) P.ell(x, y + by, 1, 0.8, "b", { k: 0.4 });
    P.layer = 3;
    for (const s of [-1, 1]) {
      const sx = s < 0 ? 4.6 : 21.4, ex = s < 0 ? 4 : 22, cy = cl * 4.4;
      if (!q) {
        limb(P, [[13 + s * 6, 8.4], [13 + s * 8, 6.4 - o], [ex, 5.4 - o]], 1.6, 1.3, s < 0 ? "a" : "ad");
        P.ell(sx, 4 - o, 3.2, 2.7, s < 0 ? "a" : "ad", { s: s < 0 ? 0.05 : -0.05 });
        P.poly([[sx + s * 0.4, 2.4 - o], [sx + s * 2.6, 0.2 - o * 1.5], [sx + s * 3.4, 3 - o]], s < 0 ? "a" : "ad", 0.15);
        P.px(sx + s * 2, 1.2 - o * 1.5, "horn", 0.3);
        continue;
      }
      const dx = s * cl * 2.6;
      limb(P, [[13 + s * 6, 8.4 + by], [13 + s * 8 + dx * 0.5, 6.4 + cy * 0.7], [ex + dx, 5.4 + cy]], 1.6, 1.3, s < 0 ? "a" : "ad");
      P.ell(sx + dx, 4 + cy, 3.2, 2.7, s < 0 ? "a" : "ad", { s: s < 0 ? 0.05 : -0.05 });
      P.poly([[sx + s * 0.4 + dx, 2.4 + cy], [sx + s * 2.6 + dx, 0.2 + cy], [sx + s * 3.4 + dx, 3 + cy]], s < 0 ? "a" : "ad", 0.15);
      P.px(sx + s * 2 + dx, 1.2 + cy, "horn", 0.3);
    }
    P.layer = 4;
    if (!q) for (const s of [-1, 1]) { const ex = 13 + s * 2.6; ln(P, ex, 6, ex + s * 0.6, 4, "a", 0, 0); P.ell(ex + s * 0.6, 3.6, 1.3, 1.3, "b", { s: 0.2 }); P.px(ex + s * 0.6, 3.4, E); P.px(ex + s * 0.6 - 0.4, 3, "#ffffff"); }
    else for (const s of [-1, 1]) {
      const ex = 13 + s * 2.6, tx = ex + s * (0.6 + ey * 1.6), ty = 4 + by + ey * 2.4;
      ln(P, ex, 6 + by, tx, ty, "a", 0, 0); P.ell(tx, ty - 0.4, 1.3, 1.3, "b", { s: 0.2 });
      if (ey > 0.5) P.px(tx, ty - 0.2, INK);
      else { P.px(tx, ty - 0.6, E); P.px(tx - 0.4, ty - 1, "#ffffff"); }
    }
  }

  function wisp(P, c, f) {
    const E = c.E, y0 = 9 - f;
    P.layer = 1;
    P.poly([[5, y0 + 1], [8, y0 - 6.4 - f], [11, y0 + 1]], "a", (x, y) => 0.3 - Math.abs(x - 8) * 0.12 + (y0 - y) * 0.03);
    P.layer = 2;
    P.ell(8, y0 + 0.4, 4.6, 4.6, "a", { k: 0.9 });
    P.layer = 3;
    P.ell(7.6, y0 - 0.2, 3, 3, "b", { k: 0.8, s: 0.3 });
    P.layer = 4;
    P.ell(7.2, y0 - 0.6, 1.5, 1.5, "#ffffff");
    P.px(6, y0 + 1, E); P.px(10, y0 + 1, E);
    P.px(4, 13, c.p2); P.px(12, 3 + f * 2, c.p2); P.px(2, 7 - f, c.p0); P.px(13, 9 + f, c.p0);
  }

  function elemental(P, c, f) {
    const col = (cx, w) => (x, y) => 0.75 - Math.abs(x - cx) / w * 1.3 - (y - 4) * 0.012;
    P.layer = 1;
    P.poly([[4, 8 - f * 2], [6, 12], [5.4, 18], [3.6, 14 + f]], "ad", -0.1);
    P.poly([[20, 7 + f * 2], [18.6, 12], [18.6, 18], [20.6, 14 - f]], "ad", -0.1);
    P.layer = 2;
    const g = (a, b) => (f ? b : a);
    const outer = [[12, 0.6 - f], [13.6, 3.6], [15.6, 1.8 + f], [15.8, 6.4], [18.4, 4.6 + f], [18, 9.4], [20, 9 - f], [18.8, 14], [19.4, 19], [17.6, 23], [g(18.4, 17.6), 27], [15, 25.4], [14, 29.4 - f], [12, 26], [10, 29.4 + f - 1], [9, 25.4], [g(5.6, 6.4), 27], [6.4, 23], [4.6, 19], [5.2, 14], [4, 9 - f], [6, 9.4], [5.6, 4.6 + f], [8.4, 6.4], [8.4, 1.8 + f], [10.4, 3.6]];
    P.poly(outer, "a", col(12, 8));
    P.layer = 3;
    P.poly([[12, 5.4 - f], [14.6, 9], [15.6, 14], [15, 19], [13.4, 23.4], [12, 25.4 - f], [10.6, 23.4], [9, 19], [8.4, 14], [9.4, 9]], "b", col(12, 6.4));
    P.layer = 4;
    P.poly([[12, 14], [13.6, 17.4], [12.8, 21], [12, 22.6], [11.2, 21], [10.4, 17.4]], "#fffbe8");
    P.rect(9, 8, 2, 3, "void", 0); P.rect(13, 8, 2, 3, "void", 0);
    P.px(9, 8, c.E); P.px(13, 8, c.E);
    P.px(3, 5 - f, c.p1); P.px(20, 6 + f, c.p1); P.px(5, 25 + f, c.p1); P.px(19, 21 - f, c.p1);
  }

  // posed: slack (the coils drop and the raised head comes down to the floor), eyes
  function serpent(P, c, f) {
    const E = c.E, pts = [], q = c.q, sl = q ? q.slack || 0 : 0;
    for (let i = 0; i < 22; i++) {
      const t = i / 21;
      pts.push(q ? [2 + t * 22, 20.2 + sl * 3.2 + Math.sin(t * 8 - f * 1.1) * 3 * (1 - t * 0.5) * (1 - sl * 0.75) - Math.max(0, t - 0.62) * 24 * (1 - sl)]
        : [2 + t * 22, 20.2 + Math.sin(t * 8 - f * 1.1) * 3 * (1 - t * 0.5) - Math.max(0, t - 0.62) * 24]);
    }
    const rad = (i) => (i < 4 ? 0.8 + i * 0.5 : i > 17 ? 2.6 - (i - 17) * 0.1 : 2.8);
    P.layer = 1;
    for (let i = 6; i < 18; i += 3) { const [px, py] = pts[i], r = rad(i); P.poly([[px - 1.8, py - r + 0.8], [px + 0.6, py - r - 3.6], [px + 2, py - r + 0.8]], "bd", 0.1); }
    P.layer = 2;
    pts.forEach((p, i) => P.ell(p[0], p[1], rad(i), rad(i), "a", { k: 0.9, fn: (x, y, s) => s + ((i + (x > p[0] ? 1 : 0)) % 3 === 0 ? -0.18 : 0) }));
    pts.forEach((p, i) => { if (i > 1 && i < 20) P.ell(p[0] + 0.3, p[1] + rad(i) * 0.55, rad(i) * 0.62, rad(i) * 0.45, "b", { k: 0.5, fn: (x, y, s) => (y < p[1] + rad(i) * 0.25 ? false : s + (i % 2 ? -0.2 : 0.05)) }); });
    P.layer = 3;
    const [hx, hy] = pts[21];
    P.ell(hx + 1.6, hy - 0.8, 3.6, 2.6, "a", { s: 0.1 });
    P.ell(hx + 3.6, hy - 0.2, 2.4, 1.5, "a");
    P.ell(hx + 3, hy + 1.2, 2.6, 0.9, "b", { fn: from(hy + 0.8) });
    P.poly([[hx + 0.4, hy - 3], [hx - 1.6, hy - 5.6], [hx + 1.4, hy - 2.4]], "bd", 0.2);
    P.poly([[hx + 1.4, hy - 3], [hx + 0.2, hy - 5.4], [hx + 2.4, hy - 2.4]], "bd", -0.1);
    if (!q) {
      ln(P, hx + 5, hy + 1.6, hx + 6.4 - 0, hy + 3.4 + f * 0.4, "pink", 0.2);
      P.px(hx + 6.4, hy + 3.6 + f * 0.4, "pink", 0.3); P.px(hx + 4.8, hy + 3.4 + f * 0.4, "pink", 0.3);
    }
    look(P, hx + 1.8, hy - 1.4, E, true, q);
    P.px(hx + 5, hy - 0.4, INK);
    P.px(hx + 4.4, hy + 1.2, TOOTH);
  }

  // posed: slack (the tentacles go limp and spread over the floor, the mantle sags), eyes
  function kraken(P, c, f) {
    const E = c.E, q = c.q, sl = q ? q.slack || 0 : 0;
    if (q) P.bend = () => sl * 3;
    const tent = (bx, side, near) => {
      const pts = [];
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        if (q) pts.push([bx + side * t * (5 * (near ? 1 : 0.6) + 9 * sl) + Math.sin(t * 5 + bx * 0.3 + f * 1.4) * 2.2 * t * (1 - sl), lerp(20 + t * 17, 21 + t * 12.6, sl)]);
        else pts.push([bx + side * t * 5 * (near ? 1 : 0.6) + Math.sin(t * 5 + bx * 0.3 + f * 1.4) * 2.2 * t, 20 + t * 17]);
      }
      pts.forEach((p, i) => { const r = 2.7 - i * 0.2; P.ell(p[0], p[1], r, r, near ? "a" : "ad", { k: 0.8 }); });
      pts.forEach((p, i) => { if (i > 1 && i < 10 && i % 2) P.px(p[0] + 0.6, p[1] + 0.8, near ? "b" : "bd", 0.3); });
    };
    P.layer = 1;
    [[6, -1], [12, -1], [32, 1], [38, 1]].forEach(([bx, s]) => tent(bx, s, false));
    P.layer = 2;
    P.ell(22, 12, 12.4, 10.4, "a", { k: 0.95 });
    P.ell(17, 5.6, 6, 3.2, "b", { s: -0.1, k: 0.5, fn: (x, y, s) => (((x * 3 + y * 5) % 4 === 0) ? s - 0.25 : s) });
    for (const [x, y, r] of [[27, 6, 1.4], [30, 10, 1.1], [14, 9, 1], [25, 3.6, 0.9], [31, 14, 1]]) P.ell(x, y, r, r, "ad", { k: 0.5 });
    P.layer = 3;
    [[9, -1], [18, -1], [26, 1], [35, 1]].forEach(([bx, s]) => tent(bx + (s < 0 ? 0 : 0), s, true));
    P.layer = 4;
    P.ell(22, 17.4, 7, 3, "b", { s: -0.2, fn: from(16.4) });
    P.poly([[20.4, 19], [23.6, 19], [22, 22.4]], "horn", 0.1);
    for (const [ex, s] of [[16.6, 1], [27, 0.5]]) {
      if (q && q.eyes > 0.5) {
        // shut: the heavy lid down over the eye, a dark crease along its edge
        P.ell(ex, 13.4, 3.6, 3.2, "a", { s: 0.15, k: 0.6 });
        P.rect(ex - 2.6, 14.6, 6, 1, "ad", -0.6);
        P.rect(ex - 3, 10, 6, 1, "ad", -0.5);
        continue;
      }
      P.ell(ex, 13.4, 3.6, 3.2, "horn", { s: 0.4, k: 0.5 });
      P.ell(ex + 0.8, 13.6, 2, 2, E);
      P.rect(ex + 0.4, 12.2, 1, 3, INK);
      P.px(ex - 0.2, 12.4, "#ffffff");
      P.rect(ex - 3, 10, 6, 1, "ad", -0.5);
    }
  }

  // posed: kneel (0 to 1, onto the rear knee), head (the head's own roll on the neck), eyes; part "banner" / "cleaver" / "crown" paints only that piece, without lists pieces
  // left off (they fall on their own)
  function warchief(P, c, f) {
    const E = c.E, d = f, q = c.q, kn = q ? q.kneel || 0 : 0, D = 6 * kn;
    const has = (k) => !(q && q.part ? q.part !== k : q && q.without && q.without.includes(k));
    const flut = (k) => (f ? 1 : -1) * Math.sin(k * 1.7) * 0.9;
    if (q && D) P.bend = () => D;
    const banner = () => {
    P.layer = 1;
    P.rect(9, 5, 2, 43, "wood", (x) => (x === 9 ? 0.35 : -0.25));
    P.rect(2, 6, 9, 1, "wood", -0.1);
    P.poly([[2, 7], [9, 7], [9, 21 + flut(1)], [7.6, 19.6 + flut(2)], [6.2, 23 + flut(3)], [4.8, 20 + flut(4)], [3.4, 22.4 + flut(5)], [2, 20 + flut(6)]], "b",
      (x, y) => 0.3 - (y - 7) * 0.025 + (Math.sin(x * 1.6 + f * 1.4) > 0.55 ? -0.45 : 0));
    P.layer = 2;
    P.rect(3, 10, 5, 3, "horn", 0.3); P.rect(4, 13, 3, 1, "horn", 0);
    P.px(4, 11, "void"); P.px(6, 11, "void"); P.px(5, 13, "void");
    for (let i = 0; i < 4; i++) { P.px(3 + i * 1.34, 15 + i, "horn", -0.1); P.px(7 - i * 1.34, 15 + i, "horn", -0.1); }
    P.ell(10, 2.6, 2.1, 1.9, "horn", { s: 0.2 });
    P.px(9, 2, "void"); P.px(11, 2, "void"); P.rect(9, 4, 3, 1, "horn", -0.3);
    };
    if (has("banner")) { if (q) flat(P, banner); else banner(); }
    if (q && q.part && q.part !== "body") { if (q.part === "cleaver") flat(P, () => cleaver(P, d)); if (q.part === "crown") crown(P, d); P.bend = null; return; }
    P.layer = 3;
    const legs = () => {
      for (const [sx, s] of [[20, -1], [30, 1]]) {
        if (!q) {
          limb(P, [[sx, 38 + d], [sx + s * 1.6, 42.4], [sx + s * 1.2, 45.6]], 2.9, 2.4, "a");
          P.rect(sx + s * 1.2 - 2.4, 44, 5, 2, "cloth", -0.15);
          P.ell(sx + s * 1.8, 47, 3.4, 1.4, "a", { s: -0.2 });
          P.px(sx + s * 1.8 + 2.6 * s, 47, "horn", 0.3); P.px(sx + s * 1.8 + 1 * s, 48, "horn", 0);
          continue;
        }
        // kneeling: the rear knee goes to the floor with the shin flat behind it; the front thigh comes level and the shin stands
        const st = [[sx, 38 + d], [sx + s * 1.6, 42.4], [sx + s * 1.2, 45.6]];
        const dn = s < 0 ? [[sx, 38 + D], [sx - 1.2, 46.2], [sx - 6.6, 46.6]] : [[sx, 38 + D], [sx + 5, 43.6], [sx + 5.2, 45.8]];
        const L = lerpPts(st, dn, kn), ft = s < 0 ? [lerp(sx + s * 1.8, sx - 8.6, kn), 47] : [lerp(sx + s * 1.8, sx + 6.6, kn), 47];
        limb(P, L, 2.9, 2.4, "a");
        P.rect(lerp(sx + s * 1.2 - 2.4, s < 0 ? sx - 5.4 : sx + 2.8, kn), lerp(44, s < 0 ? 45.4 : 43.6, kn), 5, 2, "cloth", -0.15);
        P.ell(ft[0], ft[1], 3.4, 1.4, "a", { s: -0.2 });
        P.px(ft[0] + 2.6 * (s < 0 ? lerp(-1, 1, kn) : 1), 47, "horn", 0.3); P.px(ft[0] + (s < 0 ? lerp(-1, 1, kn) : 1), 48, "horn", 0);
      }
    };
    if (q) flat(P, legs); else legs();
    P.layer = 4;
    P.ell(25, 29.4 + d, 10, 8.2, "a", { s: -0.12, k: 0.9 });
    P.ell(25.4, 32 + d, 6.8, 4.8, "n", { s: 0.05, k: 0.7 });
    for (const x of [21, 22, 23, 27, 28, 29]) P.px(x, 27.6 + d + (x === 23 || x === 27 ? 0.6 : 0), "a", -0.75);
    P.px(25, 31 + d, "ad", -0.4);
    P.layer = 5;
    P.poly([[15.6, 36 + d], [34.4, 36 + d], [35, 40.4 + d], [32, 39.2 + d], [29.6, 41 + d], [27, 39.4 + d], [24, 41 + d], [21, 39.4 + d], [18.4, 41 + d], [15, 40.4 + d]], "fur",
      (x, y) => 0.2 - (y - 36 - d) * 0.13 + ((x * 7 + y * 3) % 5 === 0 ? -0.35 : 0));
    P.layer = 6;
    P.poly([[22, 37 + d], [28.4, 37 + d], [28, 44 + d], [25.2, 42.6 + d], [22.4, 44 + d]], "b", (x) => 0.25 - (x - 22) * 0.08);
    P.rect(15.6, 35 + d, 19, 2, "cloth", (x) => 0.3 - (x - 16) * 0.04);
    P.rect(23, 34.6 + d, 4, 3, "gold", 0.25); P.rect(24, 35.6 + d, 2, 1, "gold", -0.5);
    ln(P, 17, 24 + d, 33, 35 + d, "cloth", -0.05, 1);
    P.px(25, 29.6 + d, "iron", 0.3); P.px(29, 32.4 + d, "iron", 0.3);
    for (const x of [18, 31]) { P.px(x, 37 + d, "horn", 0.3); P.px(x, 38 + d, "horn", 0); P.px(x, 39 + d, "horn", -0.3); }
    P.layer = 7;
    limb(P, [[16.4, 25 + d], [13.8, 28.4 + d], [11.6, 31 + d]], 3, 2.4, "arm", 0.05);
    P.rect(11.4, 27.6 + d, 4, 2, "cloth", 0.1); P.px(12, 28 + d, "iron", 0.5); P.px(14, 28 + d, "iron", 0.5);
    limb(P, [[33.6, 25 + d], [36.6, 28.6 + d], [38.6, 31.6 + d]], 3, 2.5, "arm", -0.15);
    P.rect(35.4, 28 + d, 4, 2, "cloth", -0.1); P.px(36, 28.4 + d, "iron", 0.4); P.px(38, 28.4 + d, "iron", 0.4);
    P.layer = 8;
    P.ell(25, 23.6 + d, 12.4, 3.6, "fur", { fn: fur, k: 0.8, s: 0.1 });
    for (let x = 14; x <= 36; x++) if ((x * 5) % 3 !== 0) P.px(x, 26.8 + d + (x % 2), "fur", -0.5);
    for (let i = 0; i < 7; i++) { const x = 19.8 + i * 1.75, y = 27.4 + d + Math.sin((i / 6) * Math.PI) * 1.4; P.px(x, y, i === 3 ? E : "horn", i === 3 ? 0 : 0.35); }
    P.layer = 9;
    P.ell(15.2, 22.8 + d, 4, 3, "steel", { s: -0.15 });
    P.rect(11.6, 24.6 + d, 8, 1, "iron", 0);
    P.px(13, 22 + d, "iron", -0.3); P.px(16, 21.4 + d, "iron", -0.3); P.px(14.6, 23.6 + d, "iron", -0.3);
    P.ell(35, 22 + d, 3.3, 2.9, "horn", { s: 0.2 });
    P.px(34, 21.6 + d, "void"); P.px(36, 21.6 + d, "void"); P.px(35, 23 + d, "void");
    P.rect(34, 24.4 + d, 3, 1, "horn", -0.3); P.px(35, 24.4 + d, "void");
    if (has("cleaver")) cleaver(P, d);
    P.layer = 10;
    P.ell(39, 32.4 + d, 2.5, 2.3, "arm", { s: 0.1 });
    P.rect(37.6, 31.4 + d, 3, 1, "ad", -0.4);
    P.ell(11, 32 + d, 2.4, 2.2, "arm", { s: 0.2 });
    P.rect(9.6, 31 + d, 3, 1, "ad", -0.4);
    // head (radians): the head rolls on the neck against the body's fall, so a fallen Gruk still shows his face and ears
    const tf0 = P.tf;
    if (q && q.head) P.tf = { ox: (tf0 ? tf0.ox : 0) + 25 * P.s, oy: (tf0 ? tf0.oy : 0) + 21 * P.s, cx: 25, cy: 21, s: P.s, a: q.head };
    P.layer = 11;
    P.poly([[19.6, 12.6 + d], [11.4, 8.2 + d], [13, 11.6 + d], [19.6, 16.4 + d]], "a", 0.3);
    P.poly([[19, 13.4 + d], [14.4, 10.8 + d], [19, 15.4 + d]], "pink", -0.25);
    P.poly([[30.4, 12.6 + d], [38.6, 8.2 + d], [37, 11.6 + d], [30.4, 16.4 + d]], "a", -0.1);
    P.poly([[31, 13.4 + d], [35.6, 10.8 + d], [31, 15.4 + d]], "pink", -0.4);
    P.px(35, 12.6 + d, "gold", 0.5); P.px(35, 13.6 + d, "gold", 0);
    P.ell(25, 14.4 + d, 7, 5.8, "a", { s: 0.1 });
    P.ell(25, 18.4 + d, 6.8, 3, "a", { s: -0.08, k: 0.7 });
    if (has("crown")) crown(P, d);
    P.layer = 12;
    ln(P, 20, 12 + d, 23.6, 13.4 + d, "ad", -0.7); ln(P, 30, 12 + d, 26.4, 13.4 + d, "ad", -0.7);
    if (q && q.eyes > 0.5) { P.rect(21.6, 14 + d, 2, 1, INK); P.rect(26.4, 14 + d, 2, 1, INK); }
    else { P.rect(21.6, 14 + d, 2, 1, E); P.px(23, 14 + d, INK); P.rect(26.4, 14 + d, 2, 1, E); P.px(26.4, 14 + d, INK); }
    P.px(21.6, 15 + d, "ad", -0.4); P.px(22.6, 15 + d, "ad", -0.4); P.px(27.4, 15 + d, "ad", -0.4); P.px(28.4, 15 + d, "ad", -0.4);
    P.ell(25, 16.6 + d, 1.7, 1.5, "n", { s: 0.35 });
    P.px(24, 17.4 + d, "ad", -0.6); P.px(26, 17.4 + d, "ad", -0.6);
    P.rect(21.6, 19 + d, 7, 1, "void", 0);
    P.px(21, 18 + d, TOOTH); P.px(21, 17 + d, TOOTH); P.px(29, 18 + d, TOOTH); P.px(29, 17 + d, TOOTH);
    P.px(23.4, 19 + d, TOOTH); P.px(26.6, 19 + d, TOOTH);
    P.tf = tf0;
    P.bend = null;
  }
  function cleaver(P, d) {
    P.layer = 10;
    P.rect(38.4, 26.4 + d, 2, 4, "wood", (x) => (x < 39 ? 0.4 : -0.1)); P.rect(38.4, 25.6 + d, 2, 1, "iron", 0.4);
    const bx = 36, by = 34.4 + d;
    P.poly([[bx, by], [bx + 9, by - 0.8], [bx + 10, by + 11], [bx + 1, by + 11.8]], "steel", (x, y) => 0.4 - (x - bx) * 0.03 - (y - by) * 0.045);
    ln(P, bx + 0.4, by + 0.2, bx + 9.2, by - 0.6, "iron", 0.1);
    ln(P, bx + 9.2, by + 0.4, bx + 10.1, by + 10.8, "steel", 1);
    ln(P, bx + 1.4, by + 11.6, bx + 9.8, by + 10.8, "steel", 0.7);
    P.ell(bx + 2.6, by + 2.4, 0.8, 0.8, "void", { k: 0 });
    for (const [x, y] of [[bx + 3, by + 7], [bx + 4, by + 8], [bx + 2, by + 9], [bx + 6, by + 4]]) P.px(x, y, "rust", 0.1);
    P.erase(Math.floor(bx + 10.2), Math.floor(by + 5.4));
  }
  function crown(P, d) {
    P.layer = 12;
    P.rect(18.6, 8.6 + d, 13, 2, "gold", (x) => 0.35 - (x - 18) * 0.05);
    for (const [x, h] of [[19, 2.4], [22, 4.2], [25, 5.6], [28, 3.6], [31, 2.6]]) P.poly([[x - 1.1, 8.8 + d], [x + 0.2 - (x === 28 ? 1 : 0), 8.8 - h + d], [x + 1.2, 8.8 + d]], "gold", 0.3 - (x - 19) * 0.04);
    P.px(25, 9.4 + d, "b", 0.6); P.px(21, 9.4 + d, "void"); P.px(29, 9.4 + d, "void");
  }

  // goblins stand about a head under a hero and kobolds lower again; both share Gruk's materials so a camp reads as one tribe
  function goblin(P, c, f, pal) {
    const E = c.E, d = f, q = c.q, kn = q ? q.kneel || 0 : 0, D = 3 * kn;
    const kit = pal === "green_archer" ? "archer" : pal === "green_shaman" ? "shaman" : pal === "hob" ? "hob" : "grunt";
    const spear = () => {
      P.rect(23, 3 + d, 1, 25 - d, "wood", (x, y) => (y % 5 === 0 ? -0.15 : 0.15));
      P.poly([[23.5, -0.6 + d], [25.4, 3.4 + d], [23.5, 6 + d], [21.6, 3.4 + d]], "steel", (x) => (x < 23.5 ? 0.6 : -0.1));
      P.rect(22.6, 6 + d, 2, 1, "paint", 0.1);
    };
    const bow = () => {
      const pts = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([21.6 + Math.sin(t * Math.PI) * 2.8, 11.4 + t * 16.4 + d * 0.5]); }
      ln(P, 21.6, 11.6 + d * 0.5, 21.6, 27.6 + d * 0.5, "#d8ccb0");
      for (let i = 0; i < pts.length - 1; i++) ln(P, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], "wood", 0.35 - Math.abs(i - 6) * 0.07);
    };
    const staff = () => {
      P.rect(23, 6 + d, 1, 22 - d, "wood", (x, y) => (y % 4 === 0 ? -0.2 : 0.15));
      P.ell(23.4, 3.6 + d, 2, 1.8, "horn", { s: 0.3, k: 0.5 });
      P.rect(22.6, 5.4 + d, 2, 1, "horn", -0.1);
      P.px(22, 3 + d, "void"); P.px(24, 3 + d, "void"); P.px(23, 5 + d, "void");
      P.px(f ? 24 : 22, 3 + d, E);
      ln(P, 21.6, 6.6 + d, 20.6, 9.4 + d, "b", 0.2); P.px(20.4, 10 + d, E);
      P.px(25, 7 + d, "fur", 0.2); P.px(25, 8 + d, "fur", -0.1);
    };
    // part "weapon" is the spear, bow or staff alone; without ["weapon"] leaves it out (it falls on its own)
    const weapon = { grunt: spear, archer: bow, shaman: staff, hob: spear }[kit], noW = q && q.without && q.without.includes("weapon");
    if (q && q.part === "weapon") { P.layer = 10; weapon(); return; }
    const held = () => { if (noW) return; if (q) flat(P, weapon); else weapon(); };
    if (q && D) P.bend = () => D;
    P.layer = 1;
    if (kit === "archer") {
      P.poly([[6.6, 15 + d], [9.2, 14 + d], [11.6, 23 + d], [9, 24 + d]], "cloth", (x) => 0.3 - (x - 6) * 0.1);
      for (const [x, y] of [[6, 12], [7.4, 11.4], [8.8, 12.4]]) { P.px(x, y + d, "#e8dcc0"); P.px(x, y + 1 + d, "#e8dcc0"); P.px(x, y + 2 + d, "wood", 0); }
    }
    limb(P, [[10.6, 17.8 + d], [9.6, 20.6 + d], [10.4, 22.6 + d]], 1.1, 0.9, "ad");
    if (kit === "grunt") {
      P.ell(8.4, 20.8 + d, 2.8, 3.4, "fur", { s: 0.1 });
      P.rect(8, 18 + d, 1, 6, "paint", 0.1);
      P.px(8, 21 + d, "iron", 0.5);
    }
    P.layer = 2;
    if (q) flat(P, () => {
      for (const [x, s] of [[11.6, -0.3], [15, 0]]) {
        const dn = s ? [[x, 23 + D], [x - 1, 27.6], [x - 4.2, 27.8]] : [[x, 23 + D], [x + 3.4, 25.8], [x + 3.4, 27.4]];
        limb(P, lerpPts([[x, 23 + d * 0.5], [x - 0.8, 25.4], [x + 0.2, 27.2]], dn, kn), 1.3, 1.1, s ? "ad" : "a", s);
        P.ell(lerp(x + 1.4, s ? x - 5.2 : x + 4.4, kn), 28, 2.1, 1, s ? "ad" : "a", { s: s - 0.1 });
      }
    });
    else for (const [x, s] of [[11.6, -0.3], [15, 0]]) {
      limb(P, [[x, 23 + d * 0.5], [x - 0.8, 25.4], [x + 0.2, 27.2]], 1.3, 1.1, s ? "ad" : "a", s);
      P.ell(x + 1.4, 28, 2.1, 1, s ? "ad" : "a", { s: s - 0.1 });
    }
    P.layer = 3;
    if (kit === "shaman") {
      P.poly([[10.6, 16.8 + d], [16.4, 16.8 + d], [18.4, 26.6], [15.6, 27.2], [13.4, 26.4], [11, 27.2], [8.8, 26.6]], "b", (x, y) => 0.3 - (x - 9) * 0.07 - (y - 17) * 0.02);
      P.rect(10, 21 + d, 7, 1, "fur", (x) => 0.2 - (x - 10) * 0.07);
      P.poly([[8.8, 26.6], [18.4, 26.6], [18.6, 27.6], [8.6, 27.6]], "fur", (x) => 0.1 - (x - 9) * 0.05 + (Math.round(x) % 2 ? -0.3 : 0));
    } else {
      const m = kit === "archer" ? "b" : kit === "hob" ? "iron" : "cloth";
      P.ell(13.4, 20.6 + d, 3.9, 3.9, m, { s: 0.05, fn: kit === "hob" ? (x, y, s) => s + ((x + y) % 2 ? -0.25 : 0.1) : null });
      P.poly([[9.6, 21 + d], [17.2, 21 + d], [17.4, 24.4 + d], [15.8, 23.6 + d], [14.4, 24.8 + d], [12.8, 23.6 + d], [11.2, 24.8 + d], [9.4, 24 + d]], m,
        (x, y) => 0.1 - (x - 10) * 0.05 - (y - 21 - d) * 0.12);
      P.rect(10, 21 + d, 7, 1, "wood", (x) => 0.35 - (x - 10) * 0.08);
      P.px(14, 21 + d, "gold", 0.3);
    }
    P.layer = 4;
    if (kit === "shaman") {
      P.ell(13.4, 17 + d, 4.2, 1.6, "fur", { fn: fur, k: 0.7 });
      for (let i = 0; i < 4; i++) P.px(12 + i * 1.3, 18.6 + d + Math.sin(((i + 0.5) / 4) * Math.PI) * 0.8, "horn", 0.4);
    }
    if (kit === "archer") P.poly([[9.4, 16.2 + d], [17.6, 16.2 + d], [16.8, 19.2 + d], [13, 20 + d], [9.6, 19.4 + d]], "bd", (x) => 0.5 - (x - 9) * 0.08);
    P.layer = 5;
    P.poly([[17.6, 9.8 + d], [22.2, 6.6 + d], [20.6, 9.8 + d], [18.6, 11.4 + d]], "ad", 0.1);
    P.layer = 6;
    P.ell(14, 12 + d, 4.6, 3.8, "a", { s: 0.1 });
    P.ell(15.4, 14.6 + d, 3.4, 1.7, "a", { s: -0.05, k: 0.6 });
    P.layer = 7;
    if (kit === "grunt") {
      P.ell(13.6, 9.6 + d, 4.8, 2.6, "iron", { s: 0.2, fn: (x, y, s) => (y > 10 + d ? false : s) });
      P.rect(8.6, 10 + d, 10, 1, "iron", (x) => 0.1 - (x - 9) * 0.06);
      P.px(15, 8 + d, "rust", 0);
    }
    if (kit === "hob") {
      P.poly([[10.6, 7.6 + d], [16.4, 5.2 + d], [14.6, 8 + d]], "b", (x) => 0.4 - (x - 10) * 0.06);
      P.ell(13.6, 9.6 + d, 5.2, 3, "iron", { s: 0.25, fn: (x, y, s) => (y > 10.4 + d ? false : s) });
      P.rect(8.4, 10 + d, 10.6, 1, "iron", (x) => 0.2 - (x - 9) * 0.06);
      P.rect(18, 10.4 + d, 1, 3, "iron", 0.3);
    }
    if (kit === "archer") {
      P.ell(13.2, 10.6 + d, 5, 3.4, "b", { s: 0.15, fn: (x, y, s) => (y > 10.6 + d && x > 12 ? false : s) });
      P.poly([[9.4, 9.4 + d], [5.6, 11.6 + d], [6.4, 12.4 + d], [9.6, 13.4 + d]], "b", -0.1);
    }
    P.layer = 8;
    P.poly([[10.6, 11 + d], [3.4, 7.4 + d], [5.2, 10.6 + d], [10.4, 14 + d]], "a", 0.3);
    P.poly([[10, 11.6 + d], [6, 9.4 + d], [10, 13.2 + d]], "pink", -0.2);
    P.layer = 9;
    if (kit === "shaman") {
      P.poly([[19, 9.4 + d], [19.6, 6.6 + d], [21.4, 5.6 + d], [23, 6.6 + d], [21.4, 7.4 + d], [20.6, 9.4 + d]], "dhorn", -0.4);
      P.poly([[15.4, 9.4 + d], [14.6, 6.8 + d], [12.6, 5.4 + d], [10, 6 + d], [9.2, 8.2 + d], [10.8, 7.6 + d], [12.4, 7.6 + d], [13.2, 9.6 + d]], "dhorn",
        (x, y) => 0.5 - (y - 5) * 0.12 + (Math.round(x) === 12 ? -0.35 : 0));
      P.poly([[12.6, 9 + d], [19.4, 9 + d], [20.4, 10.4 + d], [23.6, 13 + d], [19.4, 13 + d], [18.4, 13.8 + d], [14.4, 13.6 + d], [12.4, 12 + d]], "horn",
        (x, y) => 0.45 - (x - 12) * 0.05 - (y - 9 - d) * 0.1);
      P.rect(15, 11 + d, 2, 1, "void", 0);
      if (q && q.eyes > 0.5) { P.px(15, 11 + d, INK); P.px(19, 11 + d, INK); } else { P.px(15, 11 + d, E); P.px(19, 11 + d, E); }
      P.px(20, 12 + d, "dhorn", -0.2); P.px(21, 12 + d, "dhorn", -0.2);
    } else {
      P.rect(14.6, 11 + d, 5, 1, "a", -0.7);
      if (q && q.eyes > 0.5) { shut(P, 15, 12 + d); shut(P, 19, 12 + d); }
      else { P.px(15, 12 + d, E); P.px(16, 12 + d, INK); P.px(19, 12 + d, E); P.px(20, 12 + d, INK); }
      P.poly([[18, 12.8 + d], [22.4, 14.2 + d], [18.4, 14.8 + d]], "a", (x, y) => (y < 13.6 + d ? 0.7 : 0.2) - (x - 18) * 0.08);
    }
    P.rect(15, 15 + d, 4, 1, "void", 0);
    P.px(16, 14 + d, TOOTH);
    P.layer = 10;
    if (kit === "hob") {
      // a round shield on the far arm, carried across the body
      const sy = 20.4 + d;
      P.ell(12.2, sy, 4.8, 5.6, "wood", { s: 0.25, fn: (x, y, s, nx) => s + (nx > 0 ? -0.1 : 0.1) + (Math.round(x) % 3 === 0 ? -0.2 : 0) });
      P.ell(12.2, sy, 4.8, 5.6, "b", { s: 0.15, fn: (x, y, s, nx, ny) => (nx * nx + ny * ny > 0.62 || nx < -0.15 ? false : s) });
      P.ell(12.2, sy, 4.8, 5.6, "steel", { s: 0, fn: (x, y, s, nx, ny) => (nx * nx + ny * ny < 0.68 ? false : s + 0.2 - ny * 0.2) });
      P.ell(12.2, sy, 1.4, 1.4, "steel", { s: 0.5 });
      held();
      limb(P, [[16.4, 17.8 + d], [19, 20.6 + d], [22.2, 19.8 + d]], 1.2, 1, "a");
      P.ell(23.4, 19.6 + d, 1.4, 1.3, "a", { s: 0.2 });
    }
    if (kit === "grunt") {
      held();
      limb(P, [[16.4, 17.8 + d], [19, 20.6 + d], [22.2, 19.8 + d]], 1.2, 1, "a");
      P.ell(23.4, 19.6 + d, 1.4, 1.3, "a", { s: 0.2 });
    }
    if (kit === "archer") {
      limb(P, [[16.4, 17.8 + d], [19, 20 + d], [22, 19.6 + d]], 1.2, 1, "a");
      held();
      P.ell(22.8, 19.6 + d, 1.3, 1.3, "a", { s: 0.2 });
    }
    if (kit === "shaman") {
      limb(P, [[16.2, 17.8 + d], [19, 20.6 + d], [22, 19.8 + d]], 1.3, 1.1, "b");
      held();
      P.ell(23.2, 19.6 + d, 1.3, 1.2, "a", { s: 0.2 });
    }
    P.bend = null;
  }

  function kobold(P, c, f, pal) {
    const E = c.E, d = f, sling = pal === "rust_sling", sapper = pal === "rust_sapper", q = c.q, kn = q ? q.kneel || 0 : 0, D = 2.6 * kn;
    const pick = () => {
      ln(P, 22.8, 5.4 + d, 20.6, 22.4 + d, "wood", (t) => 0.3 - t * 0.4);
      const ph = [[17.4, 6.4], [19.8, 4.8], [22.8, 4.6], [25.4, 5.8], [27.2, 8]];
      for (let i = 0; i < ph.length - 1; i++) ln(P, ph[i][0], ph[i][1] + d, ph[i + 1][0], ph[i + 1][1] + d, "iron", 0.5 - i * 0.2, i === 1 || i === 2 ? 1 : 0);
    };
    const noW = q && q.without && q.without.includes("weapon");
    if (q && q.part === "weapon") {
      P.layer = 8;
      if (!sling) pick();
      else { const sx = 24.8, sy = 4.2; ln(P, 21.4, 6.6, sx - 0.6, sy + 0.6, "cloth", 0.3); ln(P, 22.2, 6.6, sx + 0.6, sy + 0.6, "cloth", -0.2); P.ell(sx, sy, 1.5, 1.3, "steel", { s: 0.2 }); }
      return;
    }
    P.layer = 1;
    const tail = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; tail.push([8.4 - t * 6.8, 19.4 + t * 4 - Math.sin(t * Math.PI) * 0.6 - (t > 0.7 ? (t - 0.7) * (f ? 7 : 3) : 0)]); }
    // kneeling, the tail lies along the floor behind
    // going over backwards, the tail swings up along the back, so it ends up lying along the floor behind the body
    const fl = q ? q.fall || 0 : 0;
    const tl = q ? tail.map(([x, y], i) => { const t = i / 8, kx = x - kn * t * 1.6, ky = Math.min(24.2, y + D * (1 - t) + kn * t * 2.6); return [lerp(kx, 8.4 - t * 2.2, fl), lerp(ky, 19.4 - t * 12, fl)]; }) : tail;
    limb(P, tl, 2, 0.5, "a");
    for (const i of [2, 4]) P.px(tl[i][0], tl[i][1] - 2, "ad", -0.1);
    if (q && D) P.bend = () => D;
    if (sapper) {
      // a powder keg on his back, the fuse already lit
      P.ell(7, 14.2 + d, 3.6, 4.2, "wood", { s: 0.15, fn: (x, y, s) => s + (Math.round(x) % 2 ? -0.25 : 0.05) });
      P.rect(3.6, 11.6 + d, 7, 1, "iron", 0.2); P.rect(3.6, 16.4 + d, 7, 1, "iron", -0.1);
      P.ell(7, 10.4 + d, 2.4, 0.8, "wood", { s: 0.4, k: 0.4 });
      ln(P, 6.4, 10 + d, 4.6, 7.4 + d, "cloth", 0.1);
      if (!(q && q.eyes > 0.5)) { P.px(4.4, 7 + d, f ? "#ffe27a" : "#ff8a2a"); P.px(f ? 3.4 : 5.4, 6 + d, "#fff6c8"); }
    }
    limb(P, [[10.6, 16 + d], [10, 18.6 + d], [11.2, 20.2 + d]], 0.9, 0.8, "ad");
    P.layer = 2;
    if (q) flat(P, () => {
      for (const [x, s] of [[10.4, -0.3], [13.4, 0]]) {
        const dn = s ? [[x, 19.6 + D], [x - 0.8, 23.6], [x - 3.4, 23.8], [x - 4.4, 24]] : [[x, 19.6 + D], [x + 2.6, 21.6 + D * 0.4], [x + 2.8, 23.2], [x + 2.8, 24]];
        limb(P, lerpPts([[x, 19.6 + d * 0.5], [x - 1.2, 21.4], [x + 0.2, 23], [x - 0.2, 24]], dn, kn), 1.4, 0.8, s ? "ad" : "a", s);
        const fx = lerp(x + 1, s ? x - 5 : x + 3.8, kn);
        P.ell(fx, 24.4, 1.8, 0.8, s ? "ad" : "a", { s: s - 0.1 });
        P.px(fx + 1.6 * (s ? lerp(1, -1, kn) : 1), 24, "horn", 0.2);
      }
    });
    else for (const [x, s] of [[10.4, -0.3], [13.4, 0]]) {
      limb(P, [[x, 19.6 + d * 0.5], [x - 1.2, 21.4], [x + 0.2, 23], [x - 0.2, 24]], 1.4, 0.8, s ? "ad" : "a", s);
      P.ell(x + 1, 24.4, 1.8, 0.8, s ? "ad" : "a", { s: s - 0.1 });
      P.px(x + 2.6, 24, "horn", 0.2);
    }
    P.layer = 3;
    P.ell(12, 17.6 + d, 3, 3.4, "a", { s: 0.05 });
    P.ell(13.9, 18.2 + d, 1.2, 2.3, "belly", { fn: (x, y, s) => s + (Math.round(y) % 2 ? -0.3 : 0.1) });
    P.layer = 4;
    P.poly([[9.6, 20 + d], [15.2, 20 + d], [14.6, 22.6 + d], [12.6, 22 + d], [10.6, 22.6 + d]], "b", (x, y) => 0.2 - (x - 9.6) * 0.05 - (y - 20 - d) * 0.15);
    if (sling) {
      for (const x of [11, 14]) { P.ell(x + 0.5, 21.6 + d, 1.4, 1.3, "clay", { s: 0.15 }); P.px(x, 20 + d, "cloth", 0); }
      P.px(14, 19 + d, f ? "#ffe27a" : "#ff8a2a");
    } else if (sapper) {
      for (const x of [11.4, 14.6]) { P.ell(x, 21.8 + d, 1.4, 1.4, "coal", { s: 0.2 }); P.px(x, 20 + d, "cloth", 0); }
    } else {
      P.rect(14.6, 20 + d, 2, 1, "iron", 0.2);
      P.rect(14.6, 21 + d, 2, 2, "#ffd860"); P.px(15, 21 + d, "#fff6c8");
      P.rect(14.6, 23 + d, 2, 1, "iron", -0.2);
    }
    P.layer = 5;
    P.poly([[12, 8.6 + d], [9.4, 6.2 + d], [7, 6.2 + d], [9, 7.6 + d], [10, 9.6 + d]], "dhorn", -0.6);
    P.layer = 6;
    P.ell(11.2, 10.6 + d, 3, 2.8, "a", { s: 0.15 });
    P.poly([[12.4, 8.6 + d], [17.6, 9.4 + d], [19.4, 10.4 + d], [19.4, 11.6 + d], [12.4, 12.2 + d]], "a", (x, y) => 0.6 - (y - 8.6 - d) * 0.12);
    P.poly([[12.4, 12.4 + d], [18.2, 12.4 + d], [16.8, 13.6 + d], [12.4, 14.2 + d]], "a", 0);
    P.ell(12.4, 14 + d, 1.8, 1.4, "belly", { s: -0.1, fn: (x, y, s) => (y < 13 + d ? false : s) });
    P.layer = 7;
    P.poly([[12.8, 9 + d], [10.6, 6.6 + d], [7.6, 5.6 + d], [5.6, 6 + d], [8.4, 7.2 + d], [9.6, 9 + d], [10.6, 10.4 + d]], "dhorn", (x, y) => 0.6 - (12 - x) * 0.08 - (y - 6) * 0.12);
    if (q && q.eyes > 0.5) shut(P, 14, 10 + d); else { P.px(14, 10 + d, E); P.px(15, 10 + d, INK); }
    P.rect(13.4, 9 + d, 3, 1, "a", -0.4);
    if (sapper) {
      // a miner's helmet with a candle stuck on the front
      P.ell(12, 8.4 + d, 3.6, 2.2, "iron", { s: 0.25, fn: (x, y, s) => (y > 8.8 + d ? false : s) });
      P.rect(8.6, 8.6 + d, 8, 1, "iron", (x) => 0.2 - (x - 9) * 0.07);
      P.rect(14, 5.6 + d, 1, 2.4, "wax", 0.2);
      if (!(q && q.eyes > 0.5)) { P.px(14, 4.6 + d, f ? "#fff6c8" : "#ffd860"); P.px(14, 3.8 + d, f ? "#ff8a2a" : "#ffe27a"); }
    }
    P.px(18, 10 + d, INK);
    P.rect(14, 12 + d, 5, 1, "a", -0.8);
    P.px(16, 12 + d, TOOTH);
    P.layer = 8;
    if (!sling) {
      limb(P, [[14.4, 15.6 + d], [17.6, 18.4 + d], [20.6, 17.4 + d]], 1, 0.8, "a");
      if (!noW) { if (q) flat(P, pick); else pick(); }
      P.ell(21.2, 17.4 + d, 1.2, 1.1, "a", { s: 0.2 });
    } else {
      const hx = 21.8, hy = 7.4 + d, sx = f ? 18.6 : 24.8, sy = f ? 3.6 : 4.2;
      limb(P, [[14.4, 15.6 + d], [18.8, 14.8 + d], [hx, hy + 1]], 1.1, 0.9, "a");
      P.ell(hx, hy, 1.2, 1.2, "a", { s: 0.2 });
      if (!noW) {
        ln(P, hx - 0.4, hy - 0.8, sx - 0.6, sy + 0.6, "cloth", 0.3);
        ln(P, hx + 0.4, hy - 0.8, sx + 0.6, sy + 0.6, "cloth", -0.2);
        P.ell(sx, sy, 1.5, 1.3, "steel", { s: 0.2 });
      }
    }
    P.bend = null;
  }

  function blob(P, c, f) {
    P.layer = 2;
    P.ell(8, 8.4 + f * 0.3, 6.4, 6.4, "a");
    P.ell(8, 10.6, 4, 2.6, "b", { fn: from(10) });
    P.px(6, 6.4, c.E); P.px(10, 6.4, c.E); P.px(6, 5.6, "#ffffff"); P.px(10, 5.6, "#ffffff");
  }

  // ---------- the rarer residents of the wilds ----------
  // draw fn in coordinates shifted by (dx, dy): a rider's mount, a body inside another body
  const shift = (P, dx, dy, fn) => {
    const t0 = P.tf, s = t0 ? t0.s : 1;
    P.tf = t0 ? Object.assign({}, t0, { ox: t0.ox + dx * s, oy: t0.oy + dy * s }) : { ox: dx, oy: dy, cx: 0, cy: 0, s: 1 };
    try { fn(); } finally { P.tf = t0; }
  };

  // the Walking Toadstool: a fly-agaric cap on a pale stalk with a grumpy face, stubby feet and arms; puffs spores
  function shroom(P, c, f) {
    const q = c.q, d = f * 0.6;
    P.layer = 1;
    P.ell(6.2, 18.6, 2.3, 1.1, "bd", { s: -0.1 });
    limb(P, [[5.6, 13], [3.6, 14.8], [3.2, 16.6 - f]], 0.8, 0.7, "bd");
    P.layer = 2;
    P.ell(9, 13.8 + d * 0.4, 4.6, 5, "b", { k: 0.7, s: 0.15, fn: (x, y, s) => s + ((x * 3 + y * 5) % 11 === 0 ? -0.25 : 0) });
    P.ell(11.2, 18.6, 2.5, 1.2, "b", { s: 0.05 });
    P.ell(9, 10.4 + d * 0.6, 4.4, 1.1, "spot", { k: 0.4, s: 0.1, fn: (x, y, s) => s + (x % 2 ? -0.2 : 0.05) });
    P.layer = 3;
    P.ell(9, 8.8 + d, 7.2, 1.6, "bd", { k: 0.3, s: -0.35, fn: (x, y, s) => s + (x % 2 ? -0.25 : 0.05) });
    P.layer = 4;
    P.ell(9, 6.8 + d, 8.6, 5.6, "a", { k: 1.1, fn: (x, y, s) => (y > 8.4 + d ? false : s) });
    for (const [x, y, r] of [[4.6, 4.4, 1.3], [9.6, 2.8, 1.1], [13.6, 5.2, 1.2], [7.4, 6.8, 0.9], [2.4, 7.2, 0.7], [15.6, 7.4, 0.7]]) P.ell(x, y + d, r, r * 0.8, "spot", { k: 0.3, s: 0.35 });
    P.layer = 5;
    const fy = 12.6 + d * 0.4;
    if (q && q.eyes > 0.5) { shut(P, 9, fy); shut(P, 11.6, fy); }
    else { for (const ex of [9.2, 11.8]) { P.px(ex, fy, INK); P.px(ex, fy + 1, INK); } P.px(9.2, fy, "#ffffff"); }
    P.px(8.4, fy - 1.2, "bd", -0.6); P.px(9.4, fy - 1, "bd", -0.6); P.px(12.6, fy - 1.2, "bd", -0.6); P.px(11.6, fy - 1, "bd", -0.6);
    P.rect(10, fy + 2.4, 2, 1, "void", 0);
    limb(P, [[12.6, 14], [14.6, 15.4], [15, 17 + f]], 0.8, 0.7, "b");
    for (const [x, y] of [[16, 4 - f], [1, 3 + f], [17, 10 + f], [3, 11 - f]]) P.px(x, y, "spot", 0.2);
  }

  // the Stumpwalker: a cut stump on its roots, rings on top, moss and two red caps, a knothole face and one twiggy arm
  function stump(P, c, f) {
    const E = c.E, q = c.q, d = f * 0.5;
    P.layer = 1;
    limb(P, [[7, 17], [4, 19.4], [1.4, 20.6]], 1.4, 0.7, "ad");
    limb(P, [[15.6, 17], [19.4, 19.4], [22.4, 20.6]], 1.4, 0.7, "ad");
    limb(P, [[7.2, 10 + d], [4.4, 6.6 + d], [3.2, 2.6 + d]], 1.1, 0.5, "ad");
    ln(P, 3.8, 4.8 + d, 1.2, 3.6 + d, "ad", -0.2); ln(P, 3.4, 3.4 + d, 4.6, 0.8 + d, "ad", -0.2);
    P.ell(1.2, 3.2 + d, 1.3, 1, "moss", { s: 0.1, k: 0.5 });
    P.layer = 2;
    P.poly([[5, 6.6 + d], [17, 6.6 + d], [18.6, 19.4], [3.4, 19.4]], "a", (x, y) => 0.4 - (x - 4) * 0.05 + (Math.round(x * 1.3) % 3 === 0 ? -0.28 : 0) + ((x * 7 + y * 3) % 13 === 0 ? 0.3 : 0));
    P.ell(11, 6.4 + d, 6.2, 2.6, "b", { k: 0.3, s: 0.45, fn: (x, y, s) => { const r = Math.hypot((x + 0.5 - 11) / 6.2, (y + 0.5 - 6.4 - d) / 2.6); return s + (Math.round(r * 3.4) % 2 ? -0.35 : 0.05); } });
    P.layer = 3;
    for (const [x, y, r] of [[5.2, 7.8, 1.7], [7.2, 6.4, 1.1], [16.6, 8.6, 1.3], [4.2, 12.4, 1.1], [17.6, 15.2, 1]]) P.ell(x, y + (y < 10 ? d : 0), r, r * 0.8, "moss", { k: 0.5, fn: fur });
    P.ell(14.2, 5.2 + d, 1.5, 1, "cap", { s: 0.3, k: 0.5 }); P.px(13.6, 4.6 + d, "spot", 0.2); P.rect(14, 6 + d, 1, 1, "spot", -0.1);
    P.ell(16.2, 4.8 + d, 1.1, 0.8, "cap", { s: 0.2, k: 0.5 }); P.px(16.2, 5.6 + d, "spot", -0.1);
    limb(P, [[9, 18], [7, 20.2], [5, 21.2]], 1.6, 0.8, "n"); limb(P, [[13.4, 18], [15.4, 20.4], [17.8, 21.2]], 1.6, 0.8, "n");
    P.layer = 4;
    for (const ex of [11.6, 15]) {
      P.ell(ex, 11 + d, 1.6, 1.4, "void", { k: 0 });
      if (q && q.eyes > 0.5) P.rect(ex - 1, 11 + d, 2, 1, "ad", -0.6);
      else { P.px(ex, 11 + d, E); P.px(ex - 1, 11 + d, E); P.px(ex - 1, 10 + d, "#fff6c8"); }
    }
    P.ell(13.4, 14.8 + d, 2, 1.3, "void", { k: 0 });
    P.px(12.6, 14 + d, "b", 0); P.px(14.4, 15.6 + d, "b", -0.2);
    limb(P, [[16.4, 10.4 + d], [19.6, 12.2 + d], [22.6, 9.6 - f]], 1.2, 0.6, "n");
    ln(P, 21.8, 10.4 - f, 23.2, 8 - f, "n", 0.1); ln(P, 22.2, 10.8 - f, 23.6, 11.4 - f, "n", 0);
    P.ell(23.2, 7.4 - f, 1.3, 1, "moss", { s: 0.3, k: 0.5 });
  }

  // the Bugbear: a big hairy goblin with a bear's nose and ears, a loot sack over one shoulder and a nail-studded club
  function bugbear(P, c, f) {
    const E = c.E, q = c.q, d = f, am = q ? q.arm || 0 : 0;
    P.layer = 1;
    P.ell(6.2, 10 + d, 4.8, 5.4, "cloth", { fn: (x, y, s) => s + ((x + y * 2) % 5 === 0 ? -0.3 : 0) });
    P.poly([[8.8, 5.6 + d], [11.2, 4 + d], [10.8, 7 + d]], "cloth", -0.2);
    P.rect(8.6, 5.6 + d, 2, 1, "wood", 0.2);
    for (const [x, y] of [[4.6, 8.4], [7, 12.6]]) P.px(x, y + d, "gold", 0.5);
    limb(P, [[11.6, 13.6 + d], [9.6, 9.6 + d], [9.8, 6.6 + d]], 1.9, 1.5, "ad");
    limb(P, [[15.4, 25], [16.2, 29.4], [16.6, 33]], 2.5, 2.1, "ad"); P.ell(17.8, 34, 3.2, 1.3, "ad");
    P.layer = 2;
    P.ell(13.6, 19 + d, 7.6, 8.6, "a", { fn: fur });
    P.ell(13.4, 13.6 + d, 7, 5, "a", { fn: fur });
    for (let i = 0; i < 6; i++) P.poly([[7 + i * 1.6, 11.6 + d - i * 0.3], [7.6 + i * 1.6, 8.4 + d - i * 0.4 + (i % 2)], [9 + i * 1.6, 11.4 + d - i * 0.3]], "ad", -0.1);
    P.ell(16.6, 20.4 + d, 3.6, 5, "b", { k: 0.6, s: -0.15, fn: (x, y, s) => s + ((x + y * 3) % 7 === 0 ? -0.3 : 0) });
    P.rect(7, 23.4 + d, 14, 2, "wood", (x) => 0.3 - (x - 7) * 0.05);
    P.px(15, 23.4 + d, "gold", 0.4); P.px(15, 24.4 + d, "gold", 0);
    P.poly([[8, 25.4 + d], [19.6, 25.4 + d], [18.6, 28.6], [14, 27.4], [9, 28.6]], "cloth", (x, y) => 0.1 - (x - 8) * 0.04 - (y - 25) * 0.1);
    P.layer = 3;
    limb(P, [[11.4, 26], [10.6, 29.6], [10.8, 33]], 2.7, 2.3, "n"); P.ell(12, 34, 3.4, 1.4, "n", { s: 0.1 });
    for (const x of [13.4, 14.6]) P.px(x, 34.6, TOOTH);
    P.layer = 4;
    P.poly([[16, 7.4 + d], [10.4, 2 + d], [12.4, 7.4 + d], [15.6, 10 + d]], "n", 0.15);
    P.poly([[15.4, 7.8 + d], [12, 4 + d], [14, 8.4 + d]], "pink", -0.2);
    P.ell(19, 9.4 + d, 4.7, 4.3, "n", { fn: fur });
    P.ell(23, 11 + d, 2.6, 1.9, "b", { s: 0.1 });
    P.px(25, 10 + d, INK); P.px(24.6, 10.6 + d, INK);
    P.rect(21, 12.6 + d, 4, 1, "void", 0); P.px(22, 12.6 + d, TOOTH); P.px(24, 12.6 + d, TOOTH); P.px(21, 11.6 + d, TOOTH);
    P.rect(18, 7 + d, 4, 1, "ad", -0.5);
    look(P, 19.6, 8.2 + d, E, true, q);
    for (const [x, y] of [[16.4, 5], [18.4, 4.6], [20.4, 5]]) { P.px(x, y + d, "ad", -0.1); P.px(x, y - 1 + d, "ad", -0.3); }
    P.layer = 5;
    const na = [[17.4, 14.6 + d], [22.4, 15.6 + d], [24.4, 11.4 + d]];
    limb(P, q ? lerpPts(na, [[17.4, 14.4], [17.6, 19.4], [16.4, 23]], am) : na, 2.1, 1.7, "n");
    const hx = lerp(24.6, 16.6, am), hy = lerp(10.8 + d, 24, am);
    if (!(q && am > 0.3)) {
      // the club over his shoulder, nails out
      ln(P, hx - 0.6, hy + 2.4, hx + 0.8, hy - 6, "wood", (t) => 0.35 - t * 0.2, 1.1);
      P.ell(hx + 1, hy - 7.6, 2.8, 3.2, "wood", { s: 0.2, fn: (x, y, s) => s + ((x + y) % 3 === 0 ? -0.25 : 0) });
      for (const [x, y] of [[-1.8, -9.4], [3.6, -8.6], [-1.6, -6.4], [3.4, -6], [0.8, -10.8]]) P.px(hx + x, hy + y, "steel", 0.6);
    }
    P.ell(hx, hy, 2, 1.8, "n", { s: 0.15 });
  }

  // the Ettercap: a hunched spider-man with a bloated, banded abdomen behind, spinnerets trailing silk, long clawed arms and a mandibled head
  function ettercap(P, c, f) {
    const E = c.E, q = c.q, d = f * 0.8;
    P.layer = 1;
    limb(P, [[11, 19 + d], [7.6, 22.6], [9.4, 26], [8, 28]], 1, 0.7, "ad");
    P.ell(7.4, 28.2, 1.6, 0.6, "ad");
    limb(P, [[11.6, 13 + d], [8.4, 17 + d], [8.4, 21 + d]], 0.8, 0.6, "ad");
    for (const s of [-1, 1]) ln(P, 8.4, 21 + d, 8.4 + s * 0.8, 22.4 + d, "dhorn", -0.3);
    P.layer = 2;
    P.ell(6.6, 14.6 + d, 6, 6.4, "a", { k: 1 });
    for (let i = 0; i < 3; i++) P.ell(6.8 - i * 0.6, 11.4 + i * 3 + d, 3.6 - i * 0.4, 0.8, "b", { k: 0.3, s: 0.1 });
    P.ell(3, 19.4 + d, 1.4, 1, "ad", { s: -0.2 });
    P.layer = 3;
    P.ell(13.4, 14.4 + d, 4.4, 5.8, "n", { k: 0.9 });
    P.ell(14.4, 16 + d, 2.4, 3.6, "b", { k: 0.4, s: -0.2, fn: (x, y, s) => s + (Math.round(y) % 2 ? -0.3 : 0.05) });
    limb(P, [[13.4, 19.4 + d], [16.4, 22.6], [14.4, 26], [16.2, 28]], 1.1, 0.8, "n");
    P.ell(16.8, 28.2, 1.7, 0.7, "n", { s: 0.1 });
    P.layer = 4;
    P.ell(18.6, 8.4 + d, 3.4, 3, "n", { k: 0.9 });
    P.ell(16.4, 6.2 + d, 2.2, 1.6, "n", { s: 0.2 });
    P.poly([[20.4, 9.6 + d], [24.4, 10.6 + d], [23.4, 11.6 + d], [21.4, 13.6 + d]], "horn", (x) => 0.4 - (x - 20) * 0.08);
    P.poly([[19.2, 10.4 + d], [21.6, 11.8 + d], [19.6, 13.8 + d]], "dhorn", 0);
    if (q && q.eyes > 0.5) { P.px(19, 7.4 + d, INK); P.px(21, 7.6 + d, INK); }
    else {
      for (const [x, y] of [[19.4, 7.2], [21.4, 7.6], [20.4, 6], [17.8, 6.4], [21.2, 9]]) P.px(x, y + d, E);
      P.px(19.4, 6.6 + d, "#ffffff");
    }
    P.layer = 5;
    limb(P, [[15.6, 11.6 + d], [19.6, 13.6 + d], [22.4, 17.6 + d], [24.6, 15.6 - f]], 0.9, 0.6, "n");
    for (const [ax, ay] of [[1.2, -1.6], [1.6, 0.2], [0.6, 1.4]]) ln(P, 24.6, 15.6 - f, 24.6 + ax, 15.6 - f + ay, "horn", 0.2);
  }

  // the Rat Swarm: a heap of rats on the move, eyes in the dark, tails everywhere
  function rats(P, c, f) {
    const E = c.E, q = c.q;
    if (q) sink(P, q, 3.4, 3, 26, 22, 30, 1);
    const one = (x, y, s, m, bob, back, climb) => {
      const k = back ? -1 : 1, Y = y + bob, tilt = climb ? -0.35 : 0;
      const tl = [[x - k * 3.4 * s, Y + 0.8], [x - k * 6 * s, Y + 1.8], [x - k * 8 * s, Y + 0.2 + bob], [x - k * 8.6 * s, Y - 1.4]];
      limb(P, tl, 0.55 * s, 0.35, "pink", -0.1);
      P.ell(x, Y, 4.2 * s, 2.5 * s, m, { fn: fur });
      P.ell(x - k * 0.6, Y - 1.2 * s, 2.6 * s, 0.8 * s, m, { s: 0.35, k: 0.4 });
      P.ell(x + k * 3.6 * s, Y - 0.6 + tilt * 3, 2.4 * s, 2 * s, m, { fn: fur });
      P.ell(x + k * 5.6 * s, Y + 0.2 + tilt * 4, 1.5 * s, 1.1 * s, "b", { s: 0.1 });
      P.ell(x + k * 2.4 * s, Y - 2.4 * s + tilt * 3, 1.2 * s, 1.2 * s, m, { s: 0.25 }); P.px(x + k * 2.4 * s, Y - 2.2 * s + tilt * 3, "pink", -0.1);
      P.px(x + k * 6.8 * s, Y + tilt * 4, "pink", 0.3);
      const ex = x + k * 4 * s, ey = Y - 1.2 + tilt * 3.4;
      if (q && q.eyes > 0.5) P.px(ex, ey, INK); else { P.px(ex, ey, E); P.px(ex - k, ey - 1, "#ffffff"); }
      P.px(x - 2, Y + 2.2 * s, "ad", -0.3); P.px(x + k * 2, Y + 2.2 * s, "ad", -0.3);
    };
    P.layer = 1;
    one(8.4, 8.6, 0.9, "ad", 0, true);
    one(21.4, 8.4, 0.9, "ad", f ? -0.6 : 0, false);
    P.layer = 2;
    one(14.6, 5.6, 0.95, "n", f ? 0 : -0.8, false, true);
    P.layer = 3;
    one(6.4, 11.2, 1, "a", f ? -0.5 : 0, false);
    one(17.6, 11.6, 1.05, "a", 0, false);
    P.layer = 4;
    one(11.2, 12.4, 0.95, "n", f ? -0.4 : 0, true);
  }

  // the Goblin Wolfrider: a goblin in a pot helm on a lean wolf, a long spear couched forward
  function wolfrider(P, c, f) {
    const E = c.E, q = c.q, d = f - 1.4;
    shift(P, 2, 13, () => wolf(P, c, f));
    const sl = q ? (q.ff || 0) * 0.5 + (q.fb || 0) * 0.5 : 0, D = sl * 4;
    if (q) P.bend = null;
    const y0 = 13 + d + D;
    P.layer = 5;
    limb(P, [[12, 6.8 + y0], [12.8, 9.6 + y0], [12.2, 11.6 + y0]], 1.1, 0.9, "gob");
    P.ell(12.8, 12 + y0, 1.5, 0.9, "wood", { s: -0.1 });
    P.layer = 6;
    P.ell(11.6, 2.6 + y0, 3, 3.4, "cloth", { s: 0.05 });
    P.rect(9, 4.8 + y0, 6, 1, "wood", (x) => 0.3 - (x - 9) * 0.06);
    P.ell(13.4, -2.6 + y0, 3.2, 2.7, "gob", { s: 0.1 });
    P.poly([[10.6, -2.2 + y0], [5.6, -4.8 + y0], [7.2, -2.4 + y0], [10.4, -0.6 + y0]], "gob", 0.25);
    P.poly([[10.2, -1.8 + y0], [7.6, -3.4 + y0], [10.2, -0.8 + y0]], "pink", -0.2);
    P.ell(13.2, -4.2 + y0, 3.4, 1.8, "iron", { s: 0.25, fn: (x, y, s) => (y > -3.8 + y0 ? false : s) });
    P.rect(9.6, -4 + y0, 7, 1, "iron", (x) => 0.1 - (x - 9.6) * 0.06);
    P.poly([[16, -2.4 + y0], [19, -1.4 + y0], [16.2, -0.6 + y0]], "gob", (x) => 0.5 - (x - 16) * 0.1);
    if (q && q.eyes > 0.5) shut(P, 14.6, -2.4 + y0); else { P.px(14.6, -2.4 + y0, E); P.px(15.6, -2.4 + y0, INK); }
    P.rect(14.4, -0.4 + y0, 3, 1, "void", 0); P.px(15, -0.4 + y0, TOOTH);
    P.layer = 7;
    if (!(q && sl > 0.5)) {
      ln(P, 3, 7 + y0, 29.4, -2 + y0, "wood", (t) => 0.25 - t * 0.2);
      P.poly([[29, -3.4 + y0], [31.6, -2.8 + y0], [29.4, -0.8 + y0]], "steel", 0.4);
      P.rect(27.6, -2.6 + y0, 1, 2, "paint", 0.1);
    }
    limb(P, [[13.6, 2 + y0], [16, 3.6 + y0], [18.4, 2.6 + y0]], 1, 0.8, "gob");
    P.ell(18.6, 2.4 + y0, 1.2, 1.1, "gob", { s: 0.2 });
  }

  // the Bat Swarm: a cloud of small bats, wings at all angles, a few red eyes
  function batswarm(P, c, f) {
    const q = c.q;
    const B = [[0, 1, 0.6, 0], [14.4, 0, 0.6, 1], [6, 8.6, 0.68, 1], [16, 12, 0.5, 0]];
    B.forEach(([x, y, k, ph], i) => {
      const t0 = P.tf, s0 = t0 ? t0.s : 1;
      P.tf = t0 ? Object.assign({}, t0, { ox: t0.ox + x * s0, oy: t0.oy + y * s0, cx: 0, cy: 0, s: s0 * k }) : { ox: x, oy: y, cx: 0, cy: 0, s: k };
      try { P.layer = 0; bat(P, Object.assign({}, c, { q: q ? { eyes: q.eyes } : null }), (ph + f) % 2, i); } finally { P.tf = t0; }
    });
  }

  // the Rock Jelly: a tall wobbling block of amber jelly with a boot, coins and pebbles stuck inside, and two eyes it grew somewhere
  function jelly(P, c, f) {
    const E = c.E, q = c.q, sl = q ? q.slack || 0 : 0, k = 1 - 0.38 * sl;
    const Y = (y) => 23.6 - (23.6 - y) * k, X = (x) => 11 + (x - 11) * (1 + 0.25 * sl);
    const top = 3 + f * 0.8;
    P.layer = 1;
    P.ell(X(11), 23, 10.4 * (1 + 0.25 * sl), 1.4, "ad", { s: -0.3, k: 0.4 });
    P.layer = 2;
    const pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([X(2 + t * 18), Y(top + 1.2 + Math.sin(t * Math.PI * 2 + f * 2) * 0.5 - Math.sin(t * Math.PI) * 1.2)]); }
    pts.push([X(20.6), Y(8)], [X(21), Y(20)], [X(20), Y(23.2)], [X(2), Y(23.2)], [X(1), Y(20)], [X(1.4), Y(8)]);
    // a jelly is lit through: bright at the rim, deeper in the middle
    P.poly(pts, "a", (x, y) => { const ex = Math.min(x - X(1), X(21) - x), ey = Math.min(y - Y(top), Y(23.2) - y); return 0.55 - Math.min(1, Math.min(ex, ey) / 4) * 0.55 - (x - 1) * 0.02 + ((x * 5 + y * 7) % 17 === 0 ? 0.3 : 0); });
    P.layer = 3;
    P.poly([[X(2.4), Y(top + 1.6)], [X(19.6), Y(top + 1.6)], [X(18), Y(top + 4)], [X(4), Y(top + 4)]], "b", (x) => 0.35 - (x - 2) * 0.03);
    for (const [x, y, rx, ry] of [[6, 19.6, 2, 1.4], [15.4, 20.4, 1.6, 1.2], [10, 21.6, 1.4, 0.9], [17.4, 13.6, 1.2, 1]]) P.ell(X(x), Y(y), rx, ry * k, "inr", { k: 0.6 });
    P.poly([[X(5), Y(12)], [X(8), Y(12)], [X(8.4), Y(15.6)], [X(11.4), Y(16.6)], [X(11.4), Y(18)], [X(5), Y(18)]], "inb", (x, y) => 0.2 - (x - 5) * 0.05);
    P.rect(X(5), Y(17.6), 6.4 * (1 + 0.25 * sl), 1, "inr", -0.3);
    for (const [x, y] of [[14, 9.6], [15.6, 10.6], [9, 8.4]]) P.ell(X(x), Y(y), 1, 0.8 * k, "ing", { k: 0.4, s: 0.2 });
    P.layer = 4;
    ln(P, X(3), Y(top + 5), X(3), Y(10), "#fff6d8"); P.px(X(4), Y(top + 2.4), "#fff6d8"); P.px(X(4), Y(12), "#fff6d8"); P.px(X(19), Y(18), "#fff6d8");
    if (q && q.eyes > 0.5) { shut(P, X(13.4), Y(7.4)); shut(P, X(17), Y(7.4)); }
    else for (const ex of [13.4, 17]) { P.ell(X(ex + 0.5), Y(7.4), 1.3, 1.3 * k, "#f8f0d8", { k: 0 }); P.px(X(ex + 0.8), Y(7.4), E); }
    for (const [x, y] of [[19, 4.6 + f], [1.8, 15 - f]]) P.px(X(x), Y(y), "b", 0.3);
    if (!q) { P.ell(X(7), 23.6, 1, 0.8, "a", { s: 0.2 }); P.px(X(15), 23.8, "a", 0.3); }
  }

  // the Wyvern: a two-legged dragon on its haunches, bat wings up, a long neck and a barbed sting on the tail
  // posed: ff, fb (the legs fold, the body settles), wings (they droop open over the floor), neck (the head comes down), tail (laid flat), eyes
  function wyvern(P, c, f) {
    const E = c.E, q = c.q, flap = f ? -1.6 : 0, Y0 = 4;
    const ff = q ? q.ff || 0 : 0, fb = q ? q.fb || 0 : 0, wg = q ? q.wings || 0 : 0, nk = q ? q.neck || 0 : 0, tl = q ? q.tail || 0 : 0, D = 4;
    if (q) P.bend = (x) => lerp(fb, ff, rmp(x, 8, 22)) * D;
    const wing = (sh, wr, tips, root, m, bone, s0) => {
      // a bat's wing: the trailing edge scalloped in toward the wrist between the fingers
      const pts = [sh, wr, tips[0]];
      for (let i = 1; i < tips.length; i++) { pts.push(mid(mid(tips[i - 1], tips[i], 0.5), wr, 0.22)); pts.push(tips[i]); }
      pts.push(mid(mid(tips[tips.length - 1], root, 0.5), wr, 0.15), root);
      P.poly(pts, m, (x, y) => s0 - Math.hypot(x - wr[0], y - wr[1]) * 0.05);
      ln(P, sh[0], sh[1], wr[0], wr[1], bone, 0.15, 0.6);
      for (const t of tips) ln(P, wr[0], wr[1], t[0], t[1], bone, -0.1);
      P.poly([[wr[0] - 0.2, wr[1]], [wr[0] + 1, wr[1] - 1.8], [wr[0] + 1, wr[1] + 0.4]], "horn", 0.3);
    };
    shift(P, 0, Y0, () => {
      P.layer = 1;
      wing([16.4, 11.4], [11.6 - wg * 2, 1.4 + flap + wg * 14], [[1.6 - wg * 2, 5 + flap * 0.6 + wg * 15], [4.6 - wg, 10.6 + wg * 9], [9.4, 13.4 + wg * 6]], [14, 14.4], "wmd", "ad", 0.1);
      const tail = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; tail.push([lerp(9.6 - t * 8.4, 9.6 - t * 9.4, tl), lerp(20.4 + Math.sin(t * Math.PI) * 2.2 - t * t * 5.6 + f * t * 0.6, 22.2 + t * 1, tl)]); }
      limb(P, tail, 2.2, 0.6, "a");
      const tp = tail[10];
      P.poly([[tp[0] + 1, tp[1] + 0.4], [tp[0] - 1.4 + tl * 3, tp[1] - 3.6 + tl * 3], [tp[0] + 1.8, tp[1] - 0.8]], "horn", 0.3);
      P.poly([[tp[0] + 0.4, tp[1] + 0.6], [tp[0] - 2, tp[1] + 1.8], [tp[0] + 0.6, tp[1] + 1.6]], "horn", -0.1);
      const leg = (x, m, s) => { limb(P, lerpPts([[x, 17], [x + 2.6, 21.4], [x + 0.6, 26]], [[x, 17 + D], [x + 4, 24.4], [x + 6, 26]], q ? (x < 14 ? fb : ff) : 0), 2.2, 1.1, m, s); P.ell(lerp(x + 2, x + 7, q ? (x < 14 ? fb : ff) : 0), 26.6, 2.4, 0.9, m, { s }); };
      if (q) flat(P, () => leg(11, "ad", -0.1)); else leg(11, "ad", -0.1);
      P.layer = 2;
      P.ell(15.4, 16.4, 7, 5, "a", { fn: (x, y, s) => s + ((x * 3 + y * 5) % 7 === 0 ? -0.25 : 0) });
      P.ell(16.6, 19.4, 5, 1.8, "b", { k: 0.5, fn: (x, y, s) => (y < 18.8 ? false : s + (Math.round(x) % 2 ? -0.2 : 0.05)) });
      for (let i = 0; i < 5; i++) P.poly([[10 + i * 2.2, 12.2 - i * 0.2], [11 + i * 2.2, 10.2 - i * 0.2], [12 + i * 2.2, 12.4 - i * 0.2]], "ad", 0);
      P.layer = 3;
      if (q) flat(P, () => leg(15.6, "n", 0.1)); else leg(15.6, "n", 0.1);
      for (const dx of [0, 1.6, 3.2]) P.px(lerp(16.6, 21.6, q ? ff : 0) + dx, 27, "horn", 0.1);
      P.layer = 4;
      const hx = lerp(28.4, 29, nk), hy = lerp(5.6 + f * 0.4, 22.6, nk);
      const neck = [[19.6, 14.2], [23.4, lerp(11.4, 18.6, nk)], [25.4, lerp(8.4, 21.4, nk)], [hx - 1, hy + 0.6]];
      limb(P, neck, 2.8, 1.9, "a");
      for (let i = 1; i < 4; i++) P.ell(neck[i][0] + 0.6, neck[i][1] + 1.4, 1.2, 0.7, "b", { k: 0.4 });
      P.ell(hx, hy, 3.4, 2.4, "n", { s: 0.1 });
      P.ell(hx + 3, hy + 0.8, 2.6, 1.5, "n");
      P.ell(hx + 2.6, hy + 2.2, 2.4, 0.8, "b", { fn: from(hy + 1.8) });
      P.poly([[hx - 1.6, hy - 1.4], [hx - 5.4, hy - 3.6], [hx - 1, hy - 0.2]], "dhorn", 0.2);
      P.poly([[hx - 0.4, hy - 2], [hx - 3, hy - 5], [hx + 0.6, hy - 1.4]], "horn", 0.1);
      P.px(hx + 5, hy + 0.2, INK); P.px(hx + 4, hy + 2, TOOTH); P.px(hx + 2, hy + 2, TOOTH);
      look(P, hx + 0.6, hy - 0.6, E, true, q);
      P.layer = 5;
      wing([18.6, 12.4], [19.4 - wg * 1.6, 0 + flap + wg * 13], [[8.4 - wg * 1.4, 2 + flap * 0.6 + wg * 14], [10.4 - wg, 8.2 + wg * 10], [14.6, 11.4 + wg * 5]], [16.6, 13.4], "wb", "n", 0.35);
    });
  }

  // the Croaker: a squat frogfolk raider, throat puffing, swinging a bog crawler's claw on a stick
  function croaker(P, c, f) {
    const E = c.E, q = c.q;
    if (q) sink(P, q, 3, 6, 18, 12, 22, 2);
    const puff = f ? 1 : 0;
    P.layer = 1;
    P.ell(8.6, 19.6, 4.2, 3.2, "ad", { fn: fur });
    P.poly([[6, 22.4], [2, 23.6], [1.6, 24.4], [8, 24.4]], "ad", -0.1);
    limb(P, [[9.6, 13.6], [7, 15.6], [6.4, 18.4]], 1.2, 0.9, "ad");
    P.layer = 2;
    P.ell(12, 15.4, 5.2, 6.4, "a", { fn: (x, y, s) => s + ((x * 7 + y * 3) % 9 === 0 ? -0.4 : 0) });
    P.ell(13.8, 17, 3.2, 4.6, "b", { k: 0.6, s: -0.05 });
    for (let i = 0; i < 7; i++) ln(P, 7.6 + i * 1.3, 19.6, 7.2 + i * 1.4, 22.6 + (i % 2), "reed", 0.2 - i * 0.06);
    P.rect(7.4, 19.2, 10, 1, "reed", -0.1);
    P.layer = 3;
    P.ell(14.4, 20.4, 4.6, 3.4, "a", { fn: (x, y, s) => s + ((x * 7 + y * 3) % 9 === 0 ? -0.4 : 0) });
    P.poly([[15, 23.4], [21.6, 23.6], [22.4, 24.6], [14, 24.6]], "a", 0.1);
    for (const x of [19.4, 21, 22.4]) P.px(x, 24.6, "b", 0.2);
    P.layer = 4;
    P.ell(15.6, 9, 6.2, 3.8, "a", { s: 0.1 });
    P.ell(13, 5.6, 2, 2, "a", { s: 0.2 });
    P.ell(18.2, 5.6, 2.6, 2.6, "a", { s: 0.15 });
    P.ell(18.4, 5.4, 1.8, 1.7, "gold", { s: 0.3, k: 0.4 });
    if (q && q.eyes > 0.5) { shut(P, 17.6, 5.4); shut(P, 12.6, 5.4); }
    else { P.rect(17.4, 5.4, 3, 1, INK); P.px(12.8, 5.2, INK); P.px(17.6, 4.4, "#ffffff"); }
    ln(P, 11.6, 10.6, 21.6, 9.8, "void", 0); P.px(21.4, 9.2, INK); P.px(11.4, 10, INK);
    P.ell(17.2, 12.6 + puff * 0.3, 2 + puff * 1.2, 1.4 + puff * 1, "b", { s: 0.3 + puff * 0.1, k: 0.6 });
    for (const [x, y] of [[13, 8], [16, 7.4], [11, 9.6], [20, 8]]) P.px(x, y, "ad", -0.2);
    P.layer = 5;
    limb(P, [[14, 14], [17.6, 16.4], [19.6, 15.4]], 1.2, 1, "a");
    ln(P, 20.4, 19.6, 21.4, 7.4 - f, "wood", (t) => 0.3 - t * 0.3, 0.5);
    P.ell(20, 15.2, 1.3, 1.2, "a", { s: 0.2 });
    // the club: a bog crawler's claw lashed to a stick, open
    const cx = 21.6, cy = 5.2 - f;
    P.ell(cx, cy + 1.4, 2.2, 2, "claw", { s: 0.1 });
    P.poly([[cx - 0.6, cy], [cx + 0.6, cy - 4.6], [cx + 2.2, cy - 4], [cx + 1.6, cy + 0.4]], "claw", 0.35);
    P.poly([[cx + 1.4, cy + 1], [cx + 5, cy - 1.6], [cx + 4.6, cy + 0.2], [cx + 2.2, cy + 2.4]], "claw", 0);
    P.px(cx + 1, cy - 4.6, "horn", 0.4); P.px(cx + 4.8, cy - 1.4, "horn", 0.2);
    P.rect(cx - 1.2, cy + 3, 2, 1, "reed", 0.1);
  }

  // the Bog Strider: a long-legged water spider skating on the pools; posed: drop, curl (legs fold up over the back), eyes
  function strider(P, c, f) {
    const E = c.E, q = c.q, cu = q ? c01(Math.max(...(q.curl || [0]))) : 0, by = q ? (q.drop || 0) * 0.6 : 0, bob = f * 0.5 + by;
    const legs = [[[18, 7.6], [24.6, 2.4], [33.4, 13.6]], [[15.4, 7.8], [9.6, 2.6], [1.4, 13.6]], [[14, 8], [8.4, 5.6], [0.4, 9.6]], [[20, 7.4], [23.4, 8.2], [26.6, 11.2]]];
    const FOLD = [[[18, 7.6], [22, 2], [17.6, 1.4]], [[15.4, 7.8], [11, 2], [15, 1]], [[14, 8], [10, 3.4], [13, 2.4]], [[20, 7.4], [22.4, 4.4], [20, 3.6]]];
    const draw = (m, dx, dy, r, layer) => {
      P.layer = layer;
      legs.forEach((l, i) => {
        const L = q ? lerpPts(l, FOLD[i], cu).map(([x, y], j) => [x, y + (j ? by * (1 - cu) : by)]) : l;
        const kb = q ? 0 : (i % 2 ? f : -f) * 0.6;
        ln(P, L[0][0] + dx, L[0][1] + bob * 0.5 + dy, L[1][0] + dx, L[1][1] + kb + dy, m, 0.1, r);
        ln(P, L[1][0] + dx, L[1][1] + kb + dy, L[2][0] + dx, L[2][1] + dy, m, -0.15, r * 0.8);
      });
    };
    draw("ad", -1.4, -0.8, 0.4, 1);
    P.layer = 2;
    if (!q) for (const x of [1.4, 33.4, 0.4]) { P.px(x - 1, 14.6, "water", 0.2); P.px(x + 1, 14.6, "water", 0.2); P.px(x, 14.8, "water", -0.2); }
    P.ell(13.4, 7.6 + bob, 5.4, 1.9, "a", { k: 0.8 });
    P.ell(8.4, 8 + bob, 2.4, 1.3, "a", { s: -0.1 });
    ln(P, 9, 6.6 + bob, 18, 6.4 + bob, "b", 0.3);
    P.ell(20.6, 7 + bob, 2, 1.5, "n", { s: 0.15 });
    P.layer = 3;
    if (q && q.eyes > 0.5) P.px(21.4, 6.2 + bob, INK); else { P.px(21.4, 6.2 + bob, E); P.px(20.4, 6 + bob, E); P.px(21, 5.6 + bob, "#ffffff"); }
    P.px(22.6, 7.6 + bob, "horn", 0.2);
    draw("n", 0, 0, 0.45, 4);
  }

  // the Peat Man: a leathery bog body walking out of the fen, reed hair, a gold torc still at his throat, peat falling off him
  function peatman(P, c, f) {
    const E = c.E, q = c.q, d = f * 0.6, am = q ? q.arm || 0 : 0;
    P.layer = 1;
    limb(P, [[10, 13 + d], [6.6, 18 + d], [6, 23.6 + d]], 1.4, 1, "ad");
    for (const dx of [-0.8, 0.4, 1.4]) ln(P, 6 + dx * 0.4, 23.6 + d, 5.4 + dx, 26 + d, "ad", -0.2);
    limb(P, [[12.6, 22], [14.4, 26.6], [13.4, 30.6]], 1.6, 1.2, "ad"); P.ell(14.6, 31, 2.2, 0.9, "ad");
    P.layer = 2;
    P.ell(12.4, 16.6 + d, 5.6, 7.2, "a", { fn: (x, y, s) => s + ((x * 5 + y * 3) % 7 === 0 ? -0.35 : 0) });
    for (let i = 0; i < 4; i++) ln(P, 10.4 + i * 0.4, 13.4 + i * 2 + d, 15.6 + i * 0.3, 13.8 + i * 2 + d, "ad", -0.2);
    P.poly([[6.4, 11 + d], [15.6, 9.6 + d], [17.6, 14.4 + d], [14, 15.6 + d], [11.4, 14 + d], [8, 17.6 + d], [6.2, 15 + d]], "moss", (x, y) => 0.25 - (x - 6) * 0.04 + ((x + y) % 3 === 0 ? -0.3 : 0));
    P.rect(8, 21.6 + d, 9, 1, "reed", (x) => 0.2 - (x - 8) * 0.05);
    P.poly([[8.4, 22.4 + d], [16.4, 22.4 + d], [15.6, 25.4 + d], [12.4, 24.4 + d], [9.4, 25.6 + d]], "b", (x, y) => 0.1 - (y - 22) * 0.1);
    P.layer = 3;
    limb(P, [[10.6, 22], [9.4, 26.6], [10.4, 30.6]], 1.7, 1.3, "n"); P.ell(11.6, 31, 2.4, 1, "n", { s: 0.1 });
    P.layer = 4;
    P.ell(17.6, 9.6 + d, 3.6, 3.8, "n", { s: 0.05 });
    P.ell(19.6, 11.6 + d, 1.8, 1.3, "n", { s: -0.05 });
    for (const [x0, y0, x1, y1] of [[14.6, 7, 12.6, 13.4], [15.6, 6.2, 13.4, 11.6], [17, 5.8, 15.6, 9.6], [18.6, 5.8, 18.6, 7.4], [14, 8.2, 11.4, 15]]) ln(P, x0, y0 + d, x1, y1 + d, "reed", 0.1);
    P.ell(18.6, 9.8 + d, 1.4, 1.3, "void", { k: 0 });
    if (q && q.eyes > 0.5) shut(P, 18.4, 9.8 + d); else { P.px(19, 9.8 + d, E); P.px(18.6, 9.2 + d, E); }
    P.rect(18.6, 12.8 + d, 2, 1, "void", 0);
    P.layer = 5;
    ln(P, 14.4, 13.6 + d, 18.6, 13.4 + d, "gold", 0.4, 0.5); P.px(19, 13 + d, "gold", 0.6); P.px(14, 13 + d, "gold", 0.6);
    const na = [[14.6, 15.4 + d], [18, 18.6 + d], [21.6, 18 + f]];
    limb(P, q ? lerpPts(na, [[14.6, 15.4], [14, 20], [12, 24]], am) : na, 1.4, 1, "n");
    const hx = lerp(21.6, 12, am), hy = lerp(18 + f, 24, am);
    for (const [ax, ay] of [[1.6, -0.6], [2, 0.6], [1.4, 1.6]]) ln(P, hx, hy, hx + ax, hy + ay, "n", 0.1);
    for (const [x, y] of [[9, 26 + f * 2], [15, 28 - f], [7, 30]]) P.px(x, y, "b", -0.1);
  }

  // the Corpse Candle: a guttering stub of grave-wax floating over the fen, its pale green flame wearing a face
  function candle(P, c, f) {
    const E = c.E, b = f ? 0.8 : 0;
    P.layer = 1;
    P.poly([[5, 23.6 - b], [11, 23.6 - b], [9 + f, 26], [7.4 - f, 28]], "glow", (x, y) => 0.2 - (y - 23) * 0.15);
    P.layer = 2;
    P.poly([[4.6, 15.4 - b], [8, 14.2 - b], [11.6, 15.8 - b], [11.6, 23.4 - b], [4.6, 23.4 - b]], "wax", (x, y) => 0.4 - (x - 4.6) * 0.11 + (y > 21.6 - b ? -0.25 : 0));
    for (const [x, y0, n] of [[4.6, 15.2, 4], [7, 14.6, 2], [11, 15.6, 6], [9.2, 15, 3]]) { P.rect(x, y0 - b, 1, n, "wax", 0.6); P.px(x, y0 + n - b, "wax", 0.45); P.px(x + 1, y0 + n - 1 - b, "wax", -0.35); }
    P.ell(4.4, 23.4 - b, 1.8, 0.7, "wax", { s: -0.1 }); P.ell(11.6, 23 - b, 1.2, 0.6, "wax", { s: -0.2 });
    P.rect(7.6, 12.4 - b, 1, 2.4, INK);
    P.layer = 3;
    const fl = [[8.2, 13.2 - b], [12.4, 10.4 - b], [13, 6.4], [11, 2.6 + f], [9.4 - f, -0.4], [8.6 + f, 1.4], [6.6, 0.6 - f], [4.6, 3.6], [3.2, 7], [3.8, 10.6 - b]];
    P.poly(fl, "glow", (x, y) => 0.5 - Math.hypot(x - 8, (y - 8) * 0.6) * 0.1);
    P.ell(8.2, 9.6 - b, 3, 3.6, "#d8fff0", { k: 0 });
    P.layer = 4;
    P.ell(6.8, 8.2 - b, 0.9, 1.3, E, { k: 0 }); P.ell(9.8, 8.2 - b, 0.9, 1.3, E, { k: 0 });
    P.ell(8.4, 11 - b, 0.9, 0.7 + f * 0.4, E, { k: 0 });
    for (const [x, y] of [[1.4, 5 + f], [14.6, 11 - f], [1.4, 17 - f], [14, 20 + f], [12, 1 + f]]) P.px(x, y, "glow", 0.4);
  }

  // the Barrel Crab: a hermit crab that has moved into a washed-up barrel, one claw much bigger than the other
  function hermit(P, c, f) {
    const E = c.E, o = f ? 1 : 0;
    P.layer = 1;
    for (let i = 0; i < 3; i++) { const bx = 15 + i * 2, fx = 15.6 + i * 3.4; ln(P, bx, 13.6, bx + 1.6, 15.6 - o * (i % 2), "ad", 0, 0.5); ln(P, bx + 1.6, 15.6 - o * (i % 2), fx, 18.4, "ad", -0.2, 0.45); }
    P.layer = 2;
    P.poly([[2.6, 4.4], [16.4, 3], [17.6, 16.2], [3.4, 17.6]], "wood", (x, y) => 0.3 - (y - 3) * 0.04 + (Math.round(y * 0.75) % 2 ? -0.25 : 0.05) - (x - 2) * 0.01);
    P.ell(3, 11, 2.2, 6.6, "wood", { s: -0.35, k: 0.6, fn: (x, y, s) => s + (Math.round(y) % 3 === 0 ? -0.3 : 0) });
    for (const x of [5.4, 13.6]) P.poly([[x, 3.6 - (x - 2) * 0.1], [x + 1.4, 3.4 - (x - 2) * 0.1], [x + 1.6, 17 - (x - 2) * 0.1], [x + 0.2, 17.2 - (x - 2) * 0.1]], "iron", (xx, y) => 0.3 - (y - 4) * 0.05);
    for (const [x, y] of [[8, 5.6], [9.4, 4.8], [11, 15.6], [4.6, 14.6]]) P.ell(x, y, 0.9, 0.7, "shell", { s: 0.3, k: 0.4 });
    P.ell(17, 10, 2.6, 6.8, "void", { k: 0 });
    P.ell(17.6, 10, 1.4, 6.2, "wood", { s: 0.25, k: 0.4, fn: (x, y, s) => (x < 17.6 ? false : s) });
    P.layer = 3;
    P.ell(18.6, 11, 2.6, 3, "a", { s: 0.05 });
    limb(P, [[20, 13.4], [22.6, 14.8], [24.4, 13.8]], 1, 0.8, "ad");
    P.ell(25.2, 13.6, 1.6, 1.2, "ad", { s: 0 });
    P.layer = 4;
    limb(P, [[19.6, 11], [22.4, 10.4 - o * 0.5], [23.6, 9 - o]], 1.4, 1.2, "a");
    P.ell(24.8, 7.6 - o, 3.6, 2.8, "a", { s: 0.1, k: 1.1 });
    P.poly([[25.2, 5.2 - o], [28.4, 3.4 - o * 1.4], [27.8, 6.6 - o]], "a", 0.3);
    P.poly([[25.8, 8.8 - o], [28.2, 9.4 - o * 0.4], [26.2, 10.4 - o]], "ad", -0.1);
    P.px(27.6, 4 - o * 1.4, "horn", 0.4); P.px(24.2, 6.4 - o, "b", 0.5);
    P.layer = 5;
    for (const [ex, top] of [[18.2, 2.2], [20.4, 3]]) {
      ln(P, ex - 0.2, 9, ex + 0.4, top + 1.2 - o * 0.4, "a", 0.1);
      P.ell(ex + 0.4, top + 0.6 - o * 0.4, 1.2, 1.2, "b", { s: 0.2 }); P.px(ex + 0.6, top + 0.6 - o * 0.4, E); P.px(ex, top - o * 0.4, "#ffffff");
    }
  }

  // the Wrack Shambler: a man-high heap of kelp and bladderwrack that walks up the shingle at low tide, a starfish stuck on, eyes deep inside
  function wrack(P, c, f) {
    const E = c.E, q = c.q, sl = q ? q.slack || 0 : 0;
    if (q) P.bend = (x) => sl * (6 + Math.abs(x - 13) * 0.3);
    const str = (x, y0, y1, m, s) => ln(P, x, y0, x + Math.sin(x + f) * 0.8, y1, m, s);
    P.layer = 1;
    limb(P, [[9, 13 + f * 0.4], [5, 18], [3.6, 25 + f]], 1.6, 0.8, "ad");
    for (const dx of [-1, 0, 1]) str(3.6 + dx, 25 + f, 29 + f + dx, "ad", -0.2);
    P.layer = 2;
    for (const [x, y, rx, ry] of [[13, 22, 8.6, 9.4], [12.4, 13, 7, 7.2], [14, 7, 4.8, 4.8]]) P.ell(x, y + f * 0.3, rx, ry, "a", { fn: (xx, yy, s) => s + (Math.round(xx * 1.4 + Math.sin(yy * 0.5) * 1.5) % 3 === 0 ? -0.4 : 0.05) });
    for (let i = 0; i < 9; i++) str(5.6 + i * 1.9, 27 + (i % 3), 31.6 + (i % 2), i % 2 ? "a" : "ad", -0.1);
    P.layer = 3;
    for (const [x, y, r] of [[8.4, 18, 1.2], [16.6, 15.6, 1], [11, 25.6, 1.3], [18, 23, 1.1], [7.4, 11.6, 0.9], [15.4, 28, 0.9]]) P.ell(x, y, r, r, "b", { s: 0.3, k: 0.6 });
    const sx = 16.6, sy = 19.6;
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * (Math.PI * 2 / 5); ln(P, sx, sy, sx + Math.cos(a) * 2.6, sy + Math.sin(a) * 2.6, "claw", 0.25, 0.5); }
    P.px(sx, sy, "claw", 0.5);
    P.ell(9.6, 22.4, 1.4, 1, "shell", { s: 0.3, k: 0.5 }); P.px(9, 22.4, "shell", -0.3);
    P.layer = 4;
    P.ell(15.4, 8.4 + f * 0.3, 3.4, 2.4, "void", { k: 0 });
    if (q && q.eyes > 0.5) { P.px(14.6, 8.4, INK); P.px(17, 8.4, INK); }
    else { P.px(14.4, 8.2 + f * 0.3, E); P.px(17.2, 8.4 + f * 0.3, E); }
    for (const [x0, y0] of [[11, 3.6], [14, 2.4], [17, 3.4]]) str(x0, y0, y0 + 6, "a", 0.15);
    P.layer = 5;
    limb(P, [[17.4, 12.4 + f * 0.4], [21.4, 15], [23.6, 19.6 - f]], 1.7, 0.9, "n");
    for (const dx of [-0.8, 0.2, 1.2]) str(23.4 + dx, 19.6 - f, 23.6 + dx * 1.6 - f, "n", 0);
    if (!q) for (const [x, y] of [[4, 30 + f], [21, 31 - f], [12, 32]]) P.px(x, y, "water", 0.3);
  }

  // the Frost Imp: a grinning little ice devil on frosty wings, icicle horns, a snowball ready
  function imp(P, c, f) {
    const E = c.E, b = f ? -1 : 0;
    P.layer = 1;
    for (const [sx, sy, m] of [[3.6, 1.6 + f, "wm"], [6.6, 0.4 + f, "wb"]]) {
      const w = [[10, 9.6 + b], [sx, sy + b], [sx - 3.4, sy + 3.6 + b], [sx - 2, sy + 5.4 + b], [sx - 2.4, sy + 7.6 + b], [8.4, 11.4 + b]];
      P.poly(w, m, (x, y) => 0.3 - Math.hypot(x - sx, y - sy - b) * 0.06);
      for (const t of [w[2], w[4]]) ln(P, sx, sy + b, t[0], t[1], "ad", -0.1);
      ln(P, 10, 9.6 + b, sx, sy + b, "ad", 0.1);
    }
    P.layer = 2;
    limb(P, [[8.6, 14.6 + b], [5.6, 16.6 + b], [4, 18.6], [5.6, 20]], 0.9, 0.5, "a");
    P.poly([[5.2, 19.4], [8, 19.4], [6.4, 21.4]], "b", 0.4);
    P.ell(10.8, 12.8 + b, 3.8, 4, "a", { s: 0.05 });
    P.ell(12, 13.8 + b, 2, 2.6, "b", { k: 0.5, s: -0.1 });
    limb(P, [[9.6, 15.8 + b], [9, 17.8 + b], [10, 19 + b]], 1, 0.7, "ad");
    limb(P, [[11.8, 16 + b], [12.6, 17.8 + b], [13.8, 18.4 + b]], 1, 0.7, "a");
    P.layer = 3;
    P.ell(13, 7.4 + b, 4.2, 3.8, "a", { s: 0.15 });
    P.poly([[10.4, 5 + b], [8.6, -0.4 + b], [12, 3.8 + b]], "b", 0.4);
    P.poly([[14, 4 + b], [16, -1 + b], [15.8, 4.8 + b]], "b", 0.3);
    P.poly([[16.2, 7 + b], [19.6, 8 + b], [16.4, 9.2 + b]], "a", 0.2);
    P.rect(12.6, 6.6 + b, 2, 1, E); P.rect(15.4, 6.6 + b, 1, 1, E); P.px(12.6, 6 + b, "#ffffff");
    P.rect(12.4, 5.6 + b, 2, 1, "ad", -0.5); P.px(15.6, 5.6 + b, "ad", -0.5);
    P.rect(12, 9.6 + b, 6, 1, "void", 0); for (const x of [12.4, 14.4, 16.4]) P.px(x, 9.6 + b, TOOTH); P.px(18, 9 + b, "void");
    P.layer = 4;
    limb(P, [[12.4, 11.6 + b], [15.4, 13.4 + b], [17.4, 12.2 + b]], 1, 0.8, "a");
    P.ell(18.4, 11.6 + b, 1.8, 1.8, "snow", { s: 0.3 });
    for (const [x, y] of [[1.6, 15 - f], [18.4, 17 + f], [6.4, 0.4 + f], [19.4, 3]]) P.px(x, y, "b", 0.4);
  }

  // the Snowman: three snowballs, a top hat, a red scarf, a carrot nose and a coal grin that is not friendly; a snowball in the hand
  function snowman(P, c, f) {
    const sw = f ? 1 : 0;
    P.layer = 1;
    limb(P, [[7, 15.6], [3.6, 14], [1.4, 11.6]], 0.6, 0.4, "wood"); ln(P, 2.6, 12.8, 0.4, 13.6, "wood", 0); ln(P, 2, 12.4, 1.4, 9.8, "wood", 0);
    P.poly([[9.4, 13.4], [6, 15.2 + sw], [4.2, 18.6 + sw], [6.4, 18.2 + sw], [7.4, 16.2]], "scarf", (x, y) => 0.2 - (y - 13) * 0.08 + (Math.round(y) % 3 === 0 ? -0.35 : 0));
    P.layer = 2;
    P.ell(11, 24.8, 8.4, 6.2, "a", { k: 0.6, s: 0.25, fn: (x, y, s) => s + ((x * 7 + y * 5) % 13 === 0 ? -0.2 : 0) });
    P.ell(11.2, 16.2, 6, 4.8, "a", { k: 0.6, s: 0.25 });
    P.ell(11.8, 9.2, 4.4, 4, "a", { k: 0.6, s: 0.4 });
    P.ell(11, 30, 8.4, 1.2, "b", { k: 0.3, s: -0.3, fn: from(29.8) });
    P.ell(11.2, 20.6, 5.4, 0.9, "b", { k: 0.3, s: -0.1 });
    P.layer = 3;
    P.rect(7.6, 12.6, 8.6, 2, "scarf", (x) => 0.3 - (x - 7) * 0.06);
    for (const y of [15.8, 18.4]) P.rect(14.8, y, 1, 1, "coal", 0.2);
    P.rect(12.6, 8, 1, 1, "coal", 0.3); P.rect(15.4, 8, 1, 1, "coal", 0.3);
    P.px(12.4, 7, "coal", 0); P.px(15.8, 7, "coal", 0);
    for (const [x, y] of [[12.4, 10.6], [13.6, 11], [14.8, 11], [16, 10.6]]) P.px(x, y, "coal", 0.2);
    P.poly([[15.6, 8.8], [22, 9.8], [15.6, 10.2]], "carrot", (x) => 0.4 - (x - 15) * 0.06);
    P.px(17, 9.6, "carrot", -0.4); P.px(19, 9.8, "carrot", -0.4);
    P.layer = 4;
    P.rect(6.6, 4.6, 11, 1, "coal", 0.1);
    P.rect(8.2, -0.4, 7.4, 5, "coal", (x) => 0.35 - (x - 8) * 0.1);
    P.rect(8.2, 3, 7.4, 1, "scarf", 0.2);
    P.layer = 5;
    limb(P, [[16, 15.6], [19.4, 14.2 - sw * 1.6], [21, 11.6 - sw * 2.6]], 0.6, 0.4, "wood");
    ln(P, 20.4, 12.6 - sw * 2.4, 22.4, 12.2 - sw * 2.4, "wood", 0);
    P.ell(21.4, 10.2 - sw * 2.8, 1.8, 1.7, "a", { s: 0.3, k: 0.6 });
  }

  const DRAW = { rat, wolf, boar, bear, bat, slime, chest, wraith, crab, wisp, elemental, serpent, kraken, lich, crone, warchief,
    shroom, stump, bugbear, ettercap, rats, wolfrider, batswarm, jelly, wyvern, croaker, strider, peatman, candle, hermit, wrack, imp, snowman };

  // pose (deaths): the same body painted in another pose on a canvas padded by pad on every side, the standing sprite's place
  // at (pad, pad); tilt turns the whole figure about pivot (fractions of the standing sprite) and is painted natively at that angle
  function draw(body, pal, frame, boss, palette, pose) {
    const f = frame || 0, size = SIZES[body] || SIZES.blob;
    const k = (boss && !NATIVE_BOSS.has(body) ? 1.35 : 1) * (BODYK[body] || 1);
    const w = body === "spider_big" ? 34 : size[0], h = body === "spider_big" ? 24 : size[1];
    const s = (body === "spider_big" ? 34 / 24 : 1) * k;
    const W = Math.round(w * k), H = Math.round(h * k);
    const pad = pose ? Math.max(W, H) : 0;
    const P = new Paint(W + pad * 2, H + pad * 2);
    if (s !== 1 || pad) P.tf = { ox: pad, oy: pad, cx: 0, cy: 0, s };
    if (pose) {
      P.dw = W; P.dh = H; P.eraseT = true; P.screenLight = true;
      const pv = pose.pivot || [0.5, 1];
      if (pose.tilt) P.post = { a: pose.tilt, cx: pad + pv[0] * W, cy: pad + pv[1] * H, ox: pad + pv[0] * W, oy: pad + pv[1] * H };
    }
    P.s = s;
    const p = palette;
    const c = { E: p[2], p0: p[0], p1: p[1], p2: p[2], q: pose || null };
    const m = mats(p);
    let outline = "#16121a";
    switch (body) {
      case "spider": case "spider_big": spider(P, c, f, body === "spider_big"); break;
      case "troll": troll(P, c, f, pal === "frost_giant", pal === "bridge"); break;
      case "drake": case "dragon": dragon(P, c, f, body === "dragon"); break;
      case "golem": golem(P, c, f); break;
      case "goblin": goblin(P, c, f, pal); break;
      case "kobold": kobold(P, c, f, pal); break;
      default: (DRAW[body] || blob)(P, c, f);
    }
    if (body === "wisp") outline = mix(p[0], "#10182a", 0.75);
    const g = P.render(m, { outline });
    if (pose) { g.pad = pad; g.stand = [W, H]; }
    return g;
  }

  window.Beasts = { draw: (body, pal, frame, boss, palette, pose) => draw(body, pal, frame, boss, palette, pose) };
})();
