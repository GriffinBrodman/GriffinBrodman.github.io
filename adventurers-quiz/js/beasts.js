/* Shaded monster sprites (non-humanoid bodies) painted with the Paint engine; all face right. */
(function () {
  "use strict";
  const { mix } = Art;
  const { Paint, ramp } = window.Paint;

  const INK = "#14101a", TOOTH = "#f4ecd8";
  const SIZES = {
    rat: [20, 12], wolf: [26, 18], boar: [26, 18], bear: [30, 26], spider: [24, 16], spider_big: [24, 16], bat: [26, 16], slime: [22, 16],
    troll: [30, 36], drake: [30, 22], dragon: [48, 36], chest: [24, 20], wraith: [22, 30], golem: [30, 34], crab: [26, 16], wisp: [16, 16],
    elemental: [24, 30], serpent: [30, 26], kraken: [44, 38], blob: [16, 16], lich: [34, 44], crone: [36, 36],
  };
  // threat read: beasts that fight heroes toe to toe are drawn closer to hero height
  const BODYK = { rat: 1.1, wolf: 1.2, boar: 1.15, drake: 1.25, serpent: 1.4, spider: 1.2, crab: 1.1, bat: 1.1, bear: 1.1 };
  const NATIVE_BOSS = new Set(["dragon", "kraken", "lich", "crone"]);

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

  function mats(p) {
    const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255; };
    if (lum(p[0]) < 0.28) p = [mix(p[0], "#9a9aaa", 0.2), p[1], p[2]];
    const dk = (h, t) => mix(h, "#14101c", t);
    return {
      a: ramp(p[0]), ad: ramp(dk(p[0], 0.38)), b: ramp(p[1]), bd: ramp(dk(p[1], 0.38)), horn: ramp("#e8dcc0"), dhorn: ramp("#a8987c"),
      n: ramp(mix(p[0], "#ffffff", 0.08)), wm: ramp(dk(mix(p[0], p[1], 0.15), 0.3)), wmd: ramp(dk(p[0], 0.55)), wb: ramp(mix(p[0], p[1], 0.4)),
      cloth: ramp("#6a4430"), void: ramp("#0c0a16"), pink: ramp("#d88a8a"), glow: ramp(p[1]), gold: ramp("#d8a838"), iron: ramp("#4a4656"),
    };
  }

  function rat(P, c, f) {
    const E = c.E;
    P.layer = 1;
    limb(P, [[3.5, 8], [1.8, 8.6], [0.8, 7.2 - f], [0.6, 5.5 - f]], 1, 0.5, "b");
    P.rect(5, 9, 2, 2, "ad", -0.2); P.rect(12, 9, 2, 2, "ad", -0.2);
    P.layer = 2;
    P.ell(9, 7 + f * 0.4, 5.6, 3, "a", { fn: fur });
    P.ell(6.5, 7.4, 3.6, 3, "a", { fn: fur });
    P.ell(10, 9, 4, 1.2, "b", { fn: from(8.6) });
    P.layer = 3;
    P.rect(7, 9, 2, 2, "n", 0); P.rect(11, 9, 2, 2, "n", 0);
    P.px(7, 11, "b", 0.2); P.px(8, 11, "b", 0.2); P.px(11, 11, "b", 0.2); P.px(12, 11, "b", 0.2);
    P.layer = 4;
    P.ell(14.2, 6.4 + f * 0.4, 2.8, 2.3, "n", { fn: fur });
    P.ell(16.8, 7.1 + f * 0.4, 1.9, 1.3, "n", { fn: fur });
    P.ell(12.6, 3.8 + f * 0.4, 1.9, 1.9, "n");
    P.ell(12.8, 4.1 + f * 0.4, 1, 1.1, "pink", { k: 0.5 });
    P.px(18, 7 + f * 0.4, "pink", 0.4);
    P.px(17, 8.6 + f * 0.4, TOOTH);
    eye(P, 15, 5.4 + f * 0.4, E);
    P.px(18.4, 5.6, "#d8d0c4"); P.px(19, 6.4, "#d8d0c4");
  }

  function wolf(P, c, f) {
    const E = c.E, dy = f - 1.4;
    P.layer = 1;
    limb(P, [[5, 8], [3, 9.4], [1.6, 11.5 + f * 1.2], [1.4, 13.5 + f * 1.2]], 1.9, 1, "ad");
    for (const x of [8.5, 16.5]) { limb(P, [[x, 10], [x, 13], [x, 16]], 1.5, 1.2, "ad"); P.ell(x + 0.6, 16.6, 1.8, 0.9, "ad"); }
    P.layer = 2;
    P.ell(11, 9 + dy, 8, 4.3, "a", { fn: fur });
    P.ell(6.5, 9.4 + dy, 4.3, 4.3, "a", { fn: fur });
    P.ell(16.5, 9 + dy, 4.4, 4.6, "a", { fn: fur });
    P.ell(11, 12 + dy, 6.5, 1.8, "b", { fn: from(11.4 + dy) });
    for (let i = 0; i < 6; i++) P.poly([[7 + i * 2, 5.2 + dy], [8 + i * 2, 3.4 + dy + (i % 2) * 0.6], [9.4 + i * 2, 5.6 + dy]], "a", -0.1);
    P.layer = 3;
    limb(P, [[6.2, 10 + dy], [4.6, 12.6], [6, 15.2]], 2.2, 1.2, "n"); P.ell(7, 16.6, 2, 1, "n", { s: 0.1 });
    limb(P, [[18.8, 10 + dy], [19, 13], [19.2, 15.8]], 1.7, 1.2, "n"); P.ell(19.8, 16.6, 2, 1, "n", { s: 0.1 });
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
    eye(P, 21, 5.6 + dy, E);
  }

  function boar(P, c, f) {
    const E = c.E, dy = f - 1;
    P.layer = 1;
    for (const x of [8, 16.5]) { limb(P, [[x, 11], [x, 14], [x, 16]], 1.8, 1.4, "ad"); P.rect(x - 1, 16, 3, 1, "dhorn", -0.3); }
    P.layer = 2;
    P.ell(12.5, 9 + dy, 8.4, 5.4, "a", { fn: fur });
    P.ell(18, 9.2 + dy, 5, 4.8, "a", { fn: fur });
    P.ell(12.5, 12.8 + dy, 6.5, 1.6, "b", { fn: from(12 + dy) });
    for (let i = 0; i < 8; i++) P.poly([[7 + i * 1.5, 5 + dy], [8 + i * 1.5, 2.4 + dy + (i % 2)], [9.2 + i * 1.5, 5.2 + dy]], "ad", -0.1);
    P.layer = 3;
    limb(P, [[6.5, 11 + dy], [6, 14], [6.5, 16]], 2.4, 1.6, "n"); P.rect(5, 16, 3, 1, "dhorn", 0);
    limb(P, [[19.4, 11 + dy], [19.4, 14], [19.4, 16]], 2, 1.5, "n"); P.rect(18, 16, 3, 1, "dhorn", 0);
    P.layer = 4;
    P.ell(21, 9.2 + dy, 3.6, 3.3, "n", { fn: fur });
    P.ell(23.4, 10.4 + dy, 2, 2, "b");
    P.px(24, 10 + dy, INK); P.px(24, 11 + dy, INK);
    P.poly([[19, 6.4 + dy], [19.8, 3.2 + dy], [22.2, 6 + dy]], "n", 0.1);
    P.poly([[22, 12 + dy], [22.8, 12.6 + dy], [24.4, 8.4 + dy], [23.4, 9 + dy]], "horn", 0.4);
    P.poly([[20.4, 12 + dy], [21, 12.8 + dy], [21.6, 14.4 + dy], [20.4, 13.8 + dy]], "horn", 0.1);
    eye(P, 21.4, 7.6 + dy, E);
    limb(P, [[3.6, 7.4 + dy], [2, 6.6 + dy], [2.4, 5 + dy]], 0.8, 0.5, "ad");
  }

  function bear(P, c, f) {
    const E = c.E, dy = f;
    P.layer = 1;
    for (const x of [10, 22]) { limb(P, [[x, 17], [x, 20], [x, 23]], 3, 2.6, "ad"); P.ell(x + 1, 24, 3.2, 1.3, "ad"); }
    P.layer = 2;
    P.ell(14, 15 + dy, 10.4, 7.6, "a", { fn: fur });
    P.ell(19.6, 11.6 + dy, 6.2, 5.6, "a", { fn: fur });
    P.ell(13, 20.2 + dy, 7.6, 2.4, "b", { fn: from(19.4 + dy) });
    P.layer = 3;
    limb(P, [[6.5, 17 + dy], [6, 20.4], [6.4, 23]], 3.8, 3, "n"); P.ell(7.2, 24.2, 3.6, 1.4, "n", { s: 0.1 });
    limb(P, [[19, 18 + dy], [19.4, 21], [19.4, 23]], 3.4, 2.8, "n"); P.ell(20.2, 24.2, 3.4, 1.4, "n", { s: 0.1 });
    for (const x of [5.5, 7, 8.5, 18.6, 20.2, 21.8]) P.px(x, 25, TOOTH);
    P.layer = 4;
    P.ell(23.2, 9 + dy, 4.8, 4.2, "n", { fn: fur });
    P.ell(21.2, 4.6 + dy, 1.9, 1.9, "n"); P.ell(21.4, 4.9 + dy, 1, 1, "bd", { k: 0.4 });
    P.ell(26, 4.8 + dy, 1.9, 1.9, "n"); P.ell(26, 5 + dy, 1, 1, "bd", { k: 0.4 });
    P.ell(26.4, 10.8 + dy, 2.9, 2.3, "b");
    P.px(28, 9.6 + dy, INK); P.px(27, 9.6 + dy, INK); P.px(27, 12.6 + dy, INK); P.px(26, 12.6 + dy, INK);
    P.px(28, 12 + dy, TOOTH);
    eye(P, 23.2, 7.6 + dy, E, true);
    P.px(22, 6.4 + dy, "ad", -0.2); P.px(23, 6.4 + dy, "ad", -0.2);
  }

  function spider(P, c, f, big) {
    const E = c.E, abd = c.p1;
    const legs = [[[12, 9], [5.5, 3], [0.8, 12.6]], [[13.4, 9], [9.6, 1.8], [7, 14.6]], [[15.4, 9], [20, 1.8], [19.4, 14.8]], [[16.4, 8.6], [22.4, 3.4], [23, 12.4]]];
    const draw = (set, m, dx, layer, r) => {
      P.layer = layer;
      set.forEach((l, i) => {
        const dk = (i % 2 ? f : -f);
        const k = [l[1][0] + dx, l[1][1] + dk * 0.9];
        ln(P, l[0][0] + dx, l[0][1], k[0], k[1], m, 0, r);
        ln(P, k[0], k[1], l[2][0] + dx, l[2][1], m, -0.15, r * 0.85);
      });
    };
    draw(legs, "ad", 1.2, 1, 0.45);
    P.layer = 2;
    P.ell(7.6, 7.2 + f * 0.5, 5.4, 4.4, "a");
    P.ell(14.8, 8.2, 3.4, 2.8, "a");
    P.ell(8, 8.6 + f * 0.5, 3.2, 1.6, "b", { s: -0.1, k: 0.6, fn: from(8.4) });
    P.layer = 3;
    for (const [x, y] of [[6, 4.8], [9, 4.6], [7.4, 8.4], [10.4, 7.4]]) P.px(x, y + f * 0.5, abd, 0);
    ln(P, 7, 5.6, 7.6, 9.4, "b", 0.2);
    draw(legs, "n", 0, 3, 0.5);
    P.layer = 4;
    P.ell(17, 8, 2, 2, "n", { s: 0.1 });
    P.px(17, 6.5, E); P.px(18, 7, E); P.px(16, 6.4, E); P.px(18.6, 8.4, E);
    P.px(16.4, 7.2, "#ffffff");
    P.poly([[17.4, 9.4], [18.4, 9.4], [18, 11.6]], "horn", 0.2);
  }

  function bat(P, c, f) {
    const E = c.E;
    const wing = (side) => {
      const X = (x) => (side < 0 ? x : 26 - x);
      const S = [11.5, 7], Wr = [5, 3.6 - 2.4 * f], F = [[0.4, 7.4 - 3.6 * f], [3, 11.6 - 3.4 * f], [7, 12.4 - 2.4 * f]], R = [11.5, 10.4];
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
    P.ell(13, 9.4, 3, 3.9, "n", { fn: fur });
    P.ell(13, 10, 1.8, 2.4, "b", { k: 0.5 });
    P.px(12, 13.4, "horn", 0); P.px(14, 13.4, "horn", 0);
    P.layer = 4;
    P.ell(13, 5.6, 3.2, 2.7, "n", { fn: fur });
    P.poly([[10.4, 4.6], [9.8, 0.8], [12.2, 3.4]], "n", 0.15);
    P.poly([[15.6, 4.6], [16.2, 0.8], [13.8, 3.4]], "n", -0.2);
    P.px(10.6, 3, "b", 0.2); P.px(15.4, 3, "b", -0.2);
    P.px(11.4, 5.2, E); P.px(14.6, 5.2, E); P.px(11.4, 4.6, "#ffffff");
    P.px(13, 6.4, "pink", 0); P.px(12, 7.6, TOOTH); P.px(14, 7.6, TOOTH);
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

  function troll(P, c, f, ice) {
    const E = c.E, dy = f;
    P.layer = 1;
    limb(P, [[21.4, 12.6 + dy], [24, 19], [23.4, 26]], 3.2, 2.8, "ad"); P.ell(23.2, 27.6, 3.2, 2.8, "ad");
    limb(P, [[17.4, 25], [18, 29], [18, 32.4]], 3.6, 3.2, "ad"); P.ell(19, 33, 4, 1.7, "ad");
    P.layer = 2;
    P.ell(14.6, 16 + dy, 8.6, 9.4, "a");
    P.ell(12.4, 11.6 + dy, 8.2, 5, "a");
    P.ell(14, 20.4 + dy, 5.8, 5.4, "b", { k: 0.8, fn: (x, y, s) => s + ((x + y * 3) % 7 === 0 ? -0.3 : 0) });
    P.layer = 3;
    P.rect(8, 24 + dy, 13, 3, "cloth", (x, y) => 0.2 - (x - 8) * 0.04 - (y - 24) * 0.2);
    P.poly([[10, 27 + dy], [12.4, 27 + dy], [11.4, 30 + dy]], "cloth", -0.2);
    P.poly([[15, 27 + dy], [17.4, 27 + dy], [16.4, 30.4 + dy]], "cloth", -0.3);
    limb(P, [[9.6, 28], [9, 31], [9, 33.2]], 4, 3.4, "n"); P.ell(9.6, 34, 4.4, 1.8, "n", { s: 0.1 });
    P.layer = 4;
    limb(P, [[8.4, 12.6 + dy], [5.6, 19], [6.6, 26 + dy * 0.5]], 3.6, 3.2, "n");
    P.ell(6.6, 28.4 + dy * 0.5, 3.4, 3, "n", { s: 0.1 });
    P.rect(5, 30 + dy * 0.5, 1, 1, "horn", 0.2); P.rect(8, 30 + dy * 0.5, 1, 1, "horn", 0.2);
    for (const [x, y] of [[10, 14], [17, 18], [13, 12], [7, 22]]) P.px(x, y + dy, "bd", 0);
    P.layer = 5;
    P.ell(20, 8 + dy, 4.8, 4.2, "n", { s: 0.15 });
    P.ell(21.2, 10.8 + dy, 3.6, 2.2, "n", { fn: from(10 + dy) });
    P.ell(24.4, 8.6 + dy, 1.7, 1.5, "bd", { k: 0.6 });
    P.poly([[16.2, 8 + dy], [13, 5.6 + dy], [16.4, 10.6 + dy]], "n", -0.1);
    P.poly([[17.8, 7.6 + dy], [14.6, 6.4 + dy], [17.4, 9.4 + dy]], "bd", -0.2);
    P.rect(19, 6.4 + dy, 5, 1, "ad", -0.5);
    P.px(20.4, 7.8 + dy, E); P.px(23, 7.8 + dy, E); P.px(20.4, 7.2 + dy, "#ffffff");
    P.poly([[19.6, 10.4 + dy], [20.6, 10.4 + dy], [20.2, 7.8 + dy + 3.6]], "horn", 0.4);
    P.poly([[23.2, 10.4 + dy], [24.2, 10.4 + dy], [23.6, 13.6 + dy]], "horn", 0.2);
    P.rect(21, 10 + dy, 2, 1, "void", 0);
    if (ice) {
      P.layer = 6;
      P.rect(15.4, 2.4 + dy, 10, 1, "b", 0.4);
      for (const [x, h] of [[16, 3], [19, 5], [22, 4], [24.4, 2.6]]) P.poly([[x - 0.8, 3.4 + dy], [x + 0.2, 3.4 - h + dy], [x + 1.4, 3.4 + dy]], "b", 0.5);
    }
  }

  function dragon(P, c, f, big) {
    const E = c.E, W = P.w / P.s, H = P.h / P.s, sc = big ? 1.5 : 1, flap = f ? -2.6 * sc : 0;
    const x = (v) => W * v, y = (v) => H * v;
    const sh = [x(0.46), y(0.5)], wr = [x(0.37), y(0.15) + flap];
    const tips = [[x(0.03), y(0.2) + flap * 0.7], [x(0.1), y(0.38) + flap * 0.35], [x(0.22), y(0.52)]];
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
    limb(P, tail, 3 * sc, 0.5 * sc, "a");
    const tt = tail[11];
    P.poly([[tt[0] + 0.6, tt[1]], [tt[0] - 2.4 * sc, tt[1] - 1.8 * sc], [tt[0] - 1.8 * sc, tt[1] + 1 * sc]], "b", 0.2);
    for (const lx of [0.33, 0.56]) {
      limb(P, [[x(lx + 0.08), y(0.68)], [x(lx + 0.09), y(0.82)], [x(lx + 0.06), y(0.9)]], 2 * sc, 1 * sc, "ad");
      P.ell(x(lx + 0.08), y(0.93), 2.2 * sc, 0.9 * sc, "ad");
    }
    P.layer = 2;
    const bx = x(0.46), by = y(0.64), brx = 8.6 * sc, bry = 4.6 * sc;
    P.ell(bx, by, brx, bry, "a", { fn: (px, py, s) => s + ((px + (py & 1) * 2) % 4 === 0 ? -0.18 : 0) });
    P.ell(x(0.57), y(0.6), 5.6 * sc, 5 * sc, "a");
    const hx = x(0.76), hy = y(0.22);
    const neck = [];
    for (let i = 0; i < 6; i++) { const t = i / 5; neck.push([x(0.55) + (hx - 1.5 * sc - x(0.55)) * t, y(0.56) + (hy + 1.5 * sc - y(0.56)) * t + Math.sin(t * Math.PI) * 1.2 * sc]); }
    limb(P, neck, 3.2 * sc, 2 * sc, "a");
    neck.forEach((n, i) => { const r = 3.2 * sc - i * 0.24 * sc; P.ell(n[0] + r * 0.4, n[1] + r * 0.55, r * 0.5, r * 0.65, "b", { k: 0.7, fn: (px, py, s) => s + ((py | 0) % 2 ? -0.2 : 0.05) }); });
    P.ell(bx + 0.5 * sc, by + 3 * sc, 7.6 * sc, 2.3 * sc, "b", { s: -0.05, fn: (px, py, s) => (py < by + 2.2 * sc ? false : s + ((py | 0) % 2 ? -0.28 : 0.08)) });
    P.layer = 3;
    for (let i = 0; i < 7; i++) {
      const px = bx - 5 * sc + i * 2.3 * sc, nx = (px - bx) / brx, py = Math.abs(nx) < 1 ? by - bry * Math.sqrt(1 - nx * nx) : by;
      P.poly([[px - 1, py + 1], [px - 0.3 * sc, py - 1.6 * sc], [px + 1, py + 1]], "bd", -0.1);
    }
    neck.forEach((n, i) => { if (i % 2 === 0 && i < 5) P.poly([[n[0] - 1.2, n[1] - 1.8 * sc], [n[0] - 0.8, n[1] - 3.4 * sc], [n[0] + 0.4, n[1] - 2.2 * sc]], "bd", -0.1); });
    limb(P, [[x(0.37), y(0.68)], [x(0.4), y(0.82)], [x(0.36), y(0.91)]], 2.8 * sc, 1.2 * sc, "n");
    P.ell(x(0.38), y(0.7), 4 * sc, 3.7 * sc, "n");
    P.ell(x(0.36), y(0.93), 2.6 * sc, 1 * sc, "n", { s: 0.1 });
    limb(P, [[x(0.6), y(0.68)], [x(0.65), y(0.8)], [x(0.64), y(0.91)]], 2.1 * sc, 1.1 * sc, "n");
    P.ell(x(0.65), y(0.93), 2.4 * sc, 0.9 * sc, "n", { s: 0.1 });
    for (const lx of [0.31, 0.34, 0.37, 0.61, 0.64, 0.67]) P.px(x(lx), H - 1, "horn", 0.2);
    P.layer = 4;
    P.ell(hx, hy, 3.7 * sc, 2.9 * sc, "n");
    P.ell(hx + 3.3 * sc, hy + 0.9 * sc, 3 * sc, 1.7 * sc, "n");
    P.ell(hx + 2.8 * sc, hy + 2.5 * sc, 2.8 * sc, 0.9 * sc, "b", { fn: (px, py, s) => (py < hy + 2.2 * sc ? false : s) });
    P.layer = 5;
    limb(P, [[hx - 1 * sc, hy - 1.8 * sc], [hx - 3.4 * sc, hy - 2.6 * sc], [hx - 6.4 * sc, hy - 1.6 * sc]], 1.2 * sc, 0.4 * sc, "horn");
    limb(P, [[hx + 0.2 * sc, hy - 2.3 * sc], [hx - 2 * sc, hy - 3.8 * sc], [hx - 4.6 * sc, hy - 3.8 * sc]], 0.9 * sc, 0.4 * sc, "dhorn");
    P.px(hx + 5.8 * sc, hy + 0.2 * sc, INK); P.px(hx + 5.8 * sc, hy + 1.2 * sc, INK);
    for (let i = 0; i < 3; i++) P.px(hx + (2 + i * 1.4) * sc, hy + 2.2 * sc, TOOTH);
    P.px(hx + 1.2 * sc, hy - 0.8 * sc, E); P.px(hx + 2.2 * sc, hy - 0.8 * sc, INK); P.px(hx + 1.2 * sc, hy - 1.8 * sc, "#ffffff");
    P.rect(hx - 0.2 * sc, hy - 1.6 * sc, 3.4 * sc, 1, "ad", -0.4);
    if (big && f) { P.px(hx + 7.2 * sc, hy + 1.4 * sc, "#ffd84a"); P.px(hx + 7.8 * sc, hy + 2 * sc, "#ff8a2a"); }
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

  function lich(P, c, f) {
    const E = c.E;
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
    P.layer = 3;
    P.ell(17, 9.5, 4.6, 5, "a", { s: 0.1 });
    P.rect(15, 13, 5, 2, "a", -0.15);
    for (let x = 15; x < 20; x += 2) P.px(x, 14, "void");
    for (const ex of [15.2, 19]) P.ell(ex, 10, 1.3, 1.3, "void", { k: 0 });
    P.px(15, 10, E); P.px(19, 10, E); P.px(17, 12, "void");
    P.rect(12.5, 4, 9, 2, "gold", 0.2);
    for (const x of [13, 15, 17, 19, 21]) { P.px(x, 3, "gold", 0.4); if (x % 4 === 1) P.px(x, 2, "gold", 0.6); }
    P.px(17, 4, E);
    for (const [x, y] of [[5, 1 - f], [4, 0], [6, -1 + f], [5, -1]]) P.px(x, y + 1, E);
    P.px(5, 0, "#ffffff");
    for (const [x, y] of [[2, 16 + f], [31, 12 - f], [30, 33 + f], [1, 30 - f]]) P.px(x, y, E);
  }

  function crone(P, c, f) {
    const E = c.E;
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
    P.layer = 4;
    P.poly([[14, 10.5], [28, 9], [23, 4], [27, -1], [19, 3]], "bd", (x) => 0.2 - (x - 14) * 0.05);
    P.ell(21, 9.8, 8.2, 1.6, "bd", { s: -0.1 });
    P.rect(18, 7, 6, 1, "gold", 0.1);
    P.layer = 5;
    P.ell(9, 30.5, 6.6, 4.4, "iron", { s: 0.1 });
    P.ell(9, 26.6, 6.4, 1.3, "iron", { s: 0.4 });
    for (let x = 4; x <= 14; x++) P.px(x, 26.6, (x + f) % 3 ? "#5ab83a" : "#a8f07a");
    for (const [x, y] of [[6, 24 - f], [11, 23 + f], [8, 21 - f]]) P.px(x, y, "#a8f07a");
    for (const x of [4, 13]) P.rect(x, 34, 1, 2, "iron", -0.3);
    for (const [x, y] of [[7, 35], [9, 34], [11, 35]]) P.px(x, y + (f ? 0 : 0), x === 9 ? "#ffd04a" : "#ff7a2a");
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

  function crab(P, c, f) {
    const E = c.E, o = f ? 1 : 0;
    P.layer = 1;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const bx = 13 + s * (3 + i * 1.7), fx = 13 + s * (6.6 + i * 2.4);
      ln(P, bx, 11, 13 + s * (6 + i * 2), 12.6 - o * (i % 2), "ad", 0, 0.6);
      ln(P, 13 + s * (6 + i * 2), 12.6 - o * (i % 2), fx, 15.2, "ad", -0.2, 0.55);
    }
    P.layer = 2;
    P.ell(13, 9, 8, 4.4, "a", { k: 1.1 });
    P.ell(13, 11, 6, 2, "b", { k: 0.5, fn: from(10.6) });
    for (const [x, y] of [[9, 7], [13, 6], [16.4, 8], [11, 9.4]]) P.ell(x, y, 1, 0.8, "b", { k: 0.4 });
    P.layer = 3;
    for (const s of [-1, 1]) {
      const sx = s < 0 ? 4.6 : 21.4, ex = s < 0 ? 4 : 22;
      limb(P, [[13 + s * 6, 8.4], [13 + s * 8, 6.4 - o], [ex, 5.4 - o]], 1.6, 1.3, s < 0 ? "a" : "ad");
      P.ell(sx, 4 - o, 3.2, 2.7, s < 0 ? "a" : "ad", { s: s < 0 ? 0.05 : -0.05 });
      P.poly([[sx + s * 0.4, 2.4 - o], [sx + s * 2.6, 0.2 - o * 1.5], [sx + s * 3.4, 3 - o]], s < 0 ? "a" : "ad", 0.15);
      P.px(sx + s * 2, 1.2 - o * 1.5, "horn", 0.3);
    }
    P.layer = 4;
    for (const s of [-1, 1]) { const ex = 13 + s * 2.6; ln(P, ex, 6, ex + s * 0.6, 4, "a", 0, 0); P.ell(ex + s * 0.6, 3.6, 1.3, 1.3, "b", { s: 0.2 }); P.px(ex + s * 0.6, 3.4, E); P.px(ex + s * 0.6 - 0.4, 3, "#ffffff"); }
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

  function serpent(P, c, f) {
    const E = c.E, pts = [];
    for (let i = 0; i < 22; i++) {
      const t = i / 21;
      pts.push([2 + t * 22, 20.2 + Math.sin(t * 8 - f * 1.1) * 3 * (1 - t * 0.5) - Math.max(0, t - 0.62) * 24]);
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
    ln(P, hx + 5, hy + 1.6, hx + 6.4 - 0, hy + 3.4 + f * 0.4, "pink", 0.2);
    P.px(hx + 6.4, hy + 3.6 + f * 0.4, "pink", 0.3); P.px(hx + 4.8, hy + 3.4 + f * 0.4, "pink", 0.3);
    eye(P, hx + 1.8, hy - 1.4, E, true);
    P.px(hx + 5, hy - 0.4, INK);
    P.px(hx + 4.4, hy + 1.2, TOOTH);
  }

  function kraken(P, c, f) {
    const E = c.E;
    const tent = (bx, side, near) => {
      const pts = [];
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        pts.push([bx + side * t * 5 * (near ? 1 : 0.6) + Math.sin(t * 5 + bx * 0.3 + f * 1.4) * 2.2 * t, 20 + t * 17]);
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
      P.ell(ex, 13.4, 3.6, 3.2, "horn", { s: 0.4, k: 0.5 });
      P.ell(ex + 0.8, 13.6, 2, 2, E);
      P.rect(ex + 0.4, 12.2, 1, 3, INK);
      P.px(ex - 0.2, 12.4, "#ffffff");
      P.rect(ex - 3, 10, 6, 1, "ad", -0.5);
    }
  }

  function blob(P, c, f) {
    P.layer = 2;
    P.ell(8, 8.4 + f * 0.3, 6.4, 6.4, "a");
    P.ell(8, 10.6, 4, 2.6, "b", { fn: from(10) });
    P.px(6, 6.4, c.E); P.px(10, 6.4, c.E); P.px(6, 5.6, "#ffffff"); P.px(10, 5.6, "#ffffff");
  }

  const DRAW = { rat, wolf, boar, bear, bat, slime, chest, wraith, crab, wisp, elemental, serpent, kraken, lich, crone };

  function draw(body, pal, frame, boss, palette) {
    const f = frame || 0, size = SIZES[body] || SIZES.blob;
    const k = (boss && !NATIVE_BOSS.has(body) ? 1.35 : 1) * (BODYK[body] || 1);
    const w = body === "spider_big" ? 34 : size[0], h = body === "spider_big" ? 24 : size[1];
    const s = (body === "spider_big" ? 34 / 24 : 1) * k;
    const W = Math.round(w * k), H = Math.round(h * k);
    const P = new Paint(W, H);
    if (s !== 1) P.tf = { ox: 0, oy: 0, cx: 0, cy: 0, s };
    P.s = s;
    const p = palette;
    const c = { E: p[2], p0: p[0], p1: p[1], p2: p[2] };
    const m = mats(p);
    let outline = "#16121a";
    switch (body) {
      case "spider": case "spider_big": spider(P, c, f, body === "spider_big"); break;
      case "troll": troll(P, c, f, pal === "frost_giant"); break;
      case "drake": case "dragon": dragon(P, c, f, body === "dragon"); break;
      case "golem": golem(P, c, f); break;
      default: (DRAW[body] || blob)(P, c, f);
    }
    if (body === "wisp") outline = mix(p[0], "#10182a", 0.75);
    return P.render(m, { outline });
  }

  window.Beasts = { draw: (body, pal, frame, boss, palette) => draw(body, pal, frame, boss, palette) };
})();
