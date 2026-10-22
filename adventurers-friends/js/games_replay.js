/* The Closing Games' replays: arm-wrestling over a barrel in the hall and archery at the straw butts at dusk, flat side-on, played from a match record and dressed to its precomputed result; and the three trophies as pixel sprites. */
/*
  INPUT: one match of a season's closing_games record (league/closing_games.py documents it), plus its event:
    { id, event: "arm_wrestling" | "archery", a: hero id (left, the front lane at the butts), b: hero id (right, the back lane),
      winner: 0 | 1 (a or b), show: { bout: [positions -1..1, + toward b's side (a winning); the last is +1 or -1] }
                                    | { arrows: [[a's three scores 0-10], [b's]], off: [a, b] | null (the tie's extra arrow each) } }
  The chess simul plays in ChessReplay (chess_replay.js) from the record GamesReplay.chessRecord(m, names) builds.

  GamesReplay.player(m, opts) -> <figure>: plays while on screen, holds on the result, replays on click; under reduced motion or
    still scenes it shows the result. opts.heroes (id -> hero, default App.heroes), opts.names (id -> name).
  GamesReplay.frame(m, t, opts) -> { w, h, data: RGBA bytes } (no DOM). GamesReplay.length(m) -> seconds before the hold.
  GamesReplay.trophy(event, scale) -> a canvas of the event's trophy (the Iron Knuckle, the Straw Heart, the Last King).
*/
(function (root) {
  "use strict";
  const W = 128, H = 72;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const smooth = (t) => t * t * (3 - 2 * t);
  const dith = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const hex = (s) => { s = String(s); if (s[0] === "#") { const n = parseInt(s.length === 4 ? s.slice(1).split("").map((c) => c + c).join("") : s.slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; } const m = s.match(/\d+(\.\d+)?/g) || [0, 0, 0]; return m.slice(0, 3).map(Number); };
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const shade = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; }; }

  function Buf(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  Buf.prototype.px = function (x, y, c, a) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 4, d = this.d;
    if (a == null || a >= 1) { d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; return; }
    d[o] = lerp(d[o], c[0], a); d[o + 1] = lerp(d[o + 1], c[1], a); d[o + 2] = lerp(d[o + 2], c[2], a); d[o + 3] = 255;
  };
  Buf.prototype.rect = function (x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a); };
  Buf.prototype.get = function (x, y) { const o = (y * this.w + x) * 4; return [this.d[o], this.d[o + 1], this.d[o + 2]]; };
  Buf.prototype.add = function (x, y, c, a) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const o = (y * this.w + x) * 4, d = this.d; d[o] += c[0] * a; d[o + 1] += c[1] * a; d[o + 2] += c[2] * a; };
  function disc(b, x, y, r, c) { for (let j = Math.floor(-r); j <= Math.ceil(r); j++) for (let i = Math.floor(-r); i <= Math.ceil(r); i++) if (i * i + j * j <= r * r + 0.3) b.px(x + i, y + j, c); }
  function line(b, x0, y0, x1, y1, r, c) { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2)); for (let k = 0; k <= n; k++) disc(b, lerp(x0, x1, k / n), lerp(y0, y1, k / n), r, c); }
  function thin(b, x0, y0, x1, y1, c) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let k = 0; k <= n; k++) b.px(lerp(x0, x1, k / n), lerp(y0, y1, k / n), c); }

  // ---------- a 3x5 letter for chalk and paint ----------
  const GLYPH = { A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3],
    H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2],
    P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5],
    X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7], 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1],
    5: [7, 4, 6, 1, 6], 6: [3, 4, 6, 5, 2], 7: [7, 1, 2, 2, 2], 8: [2, 5, 2, 5, 2], 9: [2, 5, 3, 1, 6], "-": [0, 0, 7, 0, 0], ".": [0, 0, 0, 0, 2],
    "!": [2, 2, 2, 0, 2], "'": [2, 2, 0, 0, 0], "=": [0, 7, 0, 7, 0], "+": [0, 2, 7, 2, 0] };
  function text(b, s, x, y, c, shadow) {
    for (const ch of String(s).toUpperCase()) {
      const g = GLYPH[ch];
      if (g) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j] >> (2 - i) & 1) { if (shadow) b.px(x + i + 1, y + j + 1, shadow); b.px(x + i, y + j, c); }
      x += 4;
    }
  }
  const textW = (s) => String(s).length * 4 - 1;

  // ---------- the heroes: their own front-facing sprite, the arm nearest the contest taken off to be drawn working ----------
  const NEAR = { left: [20, 22], right: [5, 7] };
  function spriteOf(h, k) {
    const A = root.App || {}, S = A.S || (root.LD && root.LD.static) || {};
    let g = null;
    try {
      if (root.Art && h.look) {
        const cls = (A.heroLook && h.cls ? A.heroLook(h) : null) || (S.classes || {})[h.cls] || (S.classes || {}).warrior || { look: { outfit: "leather", head: "none" } };
        g = root.Art.heroGrid(bare(h), 0, cls);
      }
    } catch (e) { g = null; }
    if (g) return { w: g.w, h: g.h, px: g.px.map((c) => (c ? hex(c) : null)) };
    // nobody to draw (a tool page, an old record): a plain figure in the hero's colour
    const fav = hex((h.look || {}).fav || ["#8a5a3a", "#3a5a7a"][k]), skin = hex((h.look || {}).skin || "#d8a070"), px = [];
    for (let y = 0; y < 34; y++) for (let x = 0; x < 28; x++) {
      const dx = Math.abs(x - 13.5), head = y < 15 && Math.hypot(dx / 5, (y - 8) / 6) < 1, body = y >= 15 && y < 33 && dx < (y < 27 ? 9 : 5);
      px.push(head ? (y < 5 ? hex((h.look || {}).hair || "#4a3020") : skin) : body ? (y >= 27 ? shade(fav, 0.6) : fav) : null);
    }
    return { w: 28, h: 34, px };
  }
  function bare(h) {
    const kit = h.kit ? JSON.parse(JSON.stringify(h.kit)) : null;
    if (kit) { kit.weapon = null; kit.offhand = null; }
    return Object.assign({}, h, { alive: true, weapon: "none", weapon_tier: 1 }, kit ? { kit } : {});
  }
  function blit(b, sp, x, y, skip, tint) {
    for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) {
      const c = sp.px[j * sp.w + i];
      if (!c || (skip && skip(i, j))) continue;
      b.px(x + i, y + j, tint ? mix(c, tint[0], tint[1]) : c);
    }
  }
  function cast(m, opts) {
    const A = root.App || {}, heroes = (opts && opts.heroes) || A.heroes || {}, names = (opts && opts.names) || {};
    return [m.a, m.b].map((id, k) => {
      const h = Object.assign({ id, name: names[id] || id }, heroes[id] || {});
      const sp = spriteOf(h, k), [c0] = NEAR[k ? "right" : "left"];
      const sleeve = sp.px[19 * sp.w + c0 + 1] || hex((h.look || {}).fav || "#7a4a2a");
      return { id, name: h.name || names[id] || "?", sp, skin: hex((h.look || {}).skin || "#d8a070"), sleeve };
    });
  }

  // ---------- the hall: plank wall, the sign, bunting, lanterns, the crowd behind the rail, the barrel ----------
  const BUNT = [[184, 64, 46], [230, 192, 106], [90, 122, 58], [232, 214, 174], [47, 90, 122]];
  function hall(b, seed, t, cheer) {
    const r = rng(seed), WALL = 46;
    const plank = [], wall = [106, 68, 40];
    for (let i = 0; i < 24; i++) plank.push(0.86 + r() * 0.2);
    for (let y = 0; y < WALL; y++) for (let x = 0; x < W; x++) {
      const p = Math.floor(x / 9), seam = x % 9 === 0, grain = ((x * 7 + y * 3 + p * 11) % 13 === 0) ? 0.92 : 1;
      b.px(x, y, seam ? shade(wall, 0.62) : shade(wall, plank[p] * grain * (0.8 + 0.2 * (y / WALL))));
    }
    b.rect(0, 0, W, 3, [52, 32, 18]);
    b.rect(0, 3, W, 1, [84, 54, 30]);
    // lanterns and their light on the wall
    for (const [lx, ly] of [[13, 14], [115, 14]]) {
      const f = 0.85 + 0.1 * Math.sin(t * 9 + lx) + 0.05 * Math.sin(t * 23 + lx);
      for (let y = 0; y < WALL; y++) for (let x = Math.max(0, lx - 24); x < Math.min(W, lx + 25); x++) {
        const d = Math.hypot(x - lx, (y - ly) * 1.15) / 24;
        if (d < 1) { const q = Math.floor((1 - d) * (1 - d) * 4 * f + dith(x, y)) / 4; if (q > 0) b.add(x, y, [70, 44, 12], q); }
      }
      thin(b, lx, 3, lx, ly - 4, [40, 28, 18]);
      b.rect(lx - 2, ly - 4, 5, 1, [122, 84, 32]);
      b.rect(lx - 2, ly - 3, 5, 6, [60, 38, 18]);
      b.rect(lx - 1, ly - 2, 3, 4, f > 0.9 ? [255, 226, 140] : [246, 196, 100]);
      b.rect(lx - 2, ly + 3, 5, 1, [122, 84, 32]);
    }
    // the painted sign on two chains, and bunting from it to the corners
    const s = "THE CLOSING GAMES", sw = textW(s), sx = Math.round(W / 2 - sw / 2) - 4;
    thin(b, sx + 3, 3, sx + 3, 5, [40, 28, 18]); thin(b, sx + sw + 4, 3, sx + sw + 4, 5, [40, 28, 18]);
    b.rect(sx, 5, sw + 8, 11, [44, 26, 14]);
    b.rect(sx + 1, 6, sw + 6, 9, [74, 44, 22]);
    b.rect(sx + 1, 6, sw + 6, 1, [104, 66, 34]);
    text(b, s, sx + 4, 8, [236, 197, 106], [36, 20, 10]);
    for (const [x0, x1, y0, y1] of [[0, sx - 1, 20, 15], [sx + sw + 9, W - 1, 15, 20]]) {
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0) / (x1 - x0 || 1), y = Math.round(lerp(y0, y1, u) + 4 * Math.sin(u * Math.PI));
        b.px(x, y, [58, 40, 26]);
        if ((x - x0) % 6 === 2) { const c = BUNT[((x - x0) / 6 | 0) % BUNT.length]; for (let j = 1; j <= 4; j++) for (let i = -2 + (j >> 1); i <= 2 - (j >> 1); i++) b.px(x + i, y + j, j === 1 ? shade(c, 1.1) : c); }
      }
    }
    // the crowd behind the rail, lit by the lanterns, bobbing, on their toes when the arm goes down
    const TUNIC = [[92, 58, 42], [62, 74, 58], [106, 74, 42], [58, 74, 90], [120, 60, 48], [80, 70, 54]];
    const SKIN = [[150, 104, 74], [196, 146, 104], [112, 76, 54], [176, 128, 90]];
    const HAIR = [[40, 26, 18], [92, 58, 30], [150, 110, 60], [60, 40, 30], [180, 170, 150]];
    for (let i = 0; i < 14; i++) {
      const cx = 4 + i * 9.3 + (r() - 0.5) * 3, base = 30 + Math.round(r() * 3), tunic = TUNIC[Math.floor(r() * TUNIC.length)], skin = SKIN[Math.floor(r() * SKIN.length)], hair = HAIR[Math.floor(r() * HAIR.length)];
      const hop = cheer > 0 ? Math.round(2 * Math.abs(Math.sin((cheer + i * 0.13) * 7)) * clamp(1.6 - cheer, 0, 1)) : 0;
      const bob = Math.round(0.6 * Math.sin(t * 2.2 + i * 1.7)), y = base - hop + bob;
      const dim = 0.6 + 0.3 * Math.max(0, 1 - Math.min(Math.abs(cx - 13), Math.abs(cx - 115)) / 40);
      for (let j = -4; j <= 10; j++) for (let k = -6; k <= 6; k++) if ((k * k) / 36 + (j * j) / 30 <= 1) b.px(cx + k, y + 7 + j, shade(k < -2 ? shade(tunic, 1.12) : tunic, dim));
      for (let j = -3; j <= 3; j++) for (let k = -3; k <= 3; k++) if (k * k + j * j <= 10) b.px(cx + k, y + j, shade(k < -1 && j < 0 ? shade(skin, 1.1) : skin, dim));
      b.rect(Math.round(cx) - 3, y - 4, 7, 2, shade(hair, dim + 0.1));
      b.px(Math.round(cx) - 3, y - 2, shade(hair, dim + 0.1)); b.px(Math.round(cx) + 3, y - 2, shade(hair, dim + 0.1));
      if (hop > 0 && i % 3 === 0) thin(b, cx + 5, y + 4, cx + 7, y - 4, shade(skin, dim));
    }
    b.rect(0, 40, W, 4, [72, 44, 24]);
    b.rect(0, 40, W, 1, [130, 90, 50]);
    b.rect(0, 43, W, 1, [50, 30, 16]);
    for (let x = 6; x < W; x += 15) b.rect(x, 44, 2, 2, [52, 32, 18]);
    for (let y = WALL; y < H; y++) for (let x = 0; x < W; x++) {
      const row = y < 54 ? 0 : y < 62 ? 1 : 2, seam = (y === 54 || y === 62) || (x + row * 23) % 31 === 0;
      const base = mix([118, 84, 52], [156, 114, 70], (y - WALL) / (H - WALL));
      b.px(x, y, seam ? shade(base, 0.72) : (((x * 73856093) ^ (y * 19349663)) >>> 0) % 41 === 0 ? shade(base, 1.14) : base);
    }
  }
  function barrel(b, cx, top, bottom, shake) {
    const half = 8, x0 = cx - half + shake;
    for (let y = bottom - 1; y < bottom + 1; y++) for (let x = x0 - 2; x <= x0 + 2 * half + 2; x++) b.px(x, y, [60, 38, 22], 0.5);
    for (let y = top; y < bottom; y++) {
      const u = (y - top) / (bottom - top - 1), bulge = Math.round(Math.sin(u * Math.PI) * 1.4);
      for (let x = x0 - bulge; x <= x0 + 2 * half + bulge; x++) {
        const v = (x - (x0 - bulge)) / (2 * half + 2 * bulge), stave = (x - x0 + 40) % 4 === 0;
        let c = mix([128, 66, 34], [62, 32, 18], v);
        if (v < 0.22) c = mix([170, 96, 50], c, v / 0.22);
        if (stave) c = shade(c, 0.78);
        const hoop = y === top + 2 || y === top + 3 || y === bottom - 4 || y === bottom - 3;
        b.px(x, y, hoop ? (v < 0.3 ? [200, 194, 178] : v < 0.7 ? [120, 116, 108] : [64, 60, 56]) : c);
      }
    }
    b.rect(x0, top - 1, 2 * half + 1, 2, [140, 80, 42]);
    b.rect(x0, top - 1, 2 * half + 1, 1, [188, 120, 66]);
  }

  // ---------- arm-wrestling ----------
  const AW = { cx: 64, floor: 66, top: 53, R: 7, intro: 1.0, step: 0.9, pin: 0.6, after: 2.6 };
  function bout(m) {
    const pos = (m.show && m.show.bout) || [m.winner === 0 ? 1 : -1];
    const keys = [[AW.intro, 0]];
    let t = AW.intro;
    pos.forEach((p, i) => { t += i === pos.length - 1 ? AW.pin : AW.step; keys.push([t, p]); });
    return { keys, pin: t, len: t + AW.after };
  }
  function posAt(bt, t) {
    const k = bt.keys;
    if (t <= k[0][0]) return 0;
    for (let i = 1; i < k.length; i++) if (t <= k[i][0]) {
      const u = (t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]), last = i === k.length - 1;
      const v = lerp(k[i - 1][1], k[i][1], last ? u * u : smooth(u));
      return last ? v : v + 0.035 * Math.sin(t * 31) + 0.02 * Math.sin(t * 17.3);
    }
    return k[k.length - 1][1];
  }
  function armWrestle(b, m, t, opts) {
    const P = opts._cast || cast(m, opts), bt = bout(m), seed = hash(m.id || "aw");
    const after = t - bt.pin, won = after >= 0, cheer = won ? after : -1;
    hall(b, seed, t, cheer);
    const shake = won && after < 0.18 ? (Math.round(after * 40) % 2 ? 1 : -1) : 0;
    const { cx, floor, top, R } = AW;
    const p = won ? (m.winner === 0 ? 1 : -1) : posAt(bt, t);
    const strain = !won && t > AW.intro;
    const sides = [{ x: cx - 30, near: NEAR.left, sh: 21, el: cx - 4 }, { x: cx + 2, near: NEAR.right, sh: 6, el: cx + 4 }];
    sides.forEach((s, k) => {
      const hp = P[k], winner = won && m.winner === k, loser = won && m.winner !== k;
      const hop = winner ? -Math.round(2 * Math.abs(Math.sin(after * 7.5)) * clamp(1.8 - after, 0, 1)) : 0;
      // the one who is behind leans in
      const lean = !won && Math.sign(p) === (k ? 1 : -1) && Math.abs(p) > 0.3 ? (k ? -1 : 1) : 0;
      s.x += lean;
      s.y = floor - hp.sp.h + hop + (loser ? 1 : 0);
      for (let x = s.x + 6; x < s.x + 22; x++) b.px(x, floor, [40, 26, 16], 0.45);
      blit(b, hp.sp, s.x, s.y, (i, j) => i >= s.near[0] && i <= s.near[1] && j >= 16 && j <= 26);
    });
    barrel(b, cx, top, floor, shake);
    // the clasp: both forearms from elbows planted on the barrel lid to one pair of hands, leaning over toward whoever is losing
    const phi = p * 1.3, hx = cx + R * Math.sin(phi), hy = top - 2 - R * Math.cos(phi) + (won ? 1 : 0);
    sides.forEach((s, k) => {
      const hp = P[k], shx = s.x + s.sh, shy = s.y + 17, ex = s.el + shake, ey = top - 2;
      line(b, shx, shy, ex, ey, 2.0, [34, 22, 14]);
      line(b, ex, ey, hx, hy, 1.9, [34, 22, 14]);
      line(b, shx, shy, ex, ey, 1.2, hp.sleeve);
      line(b, ex, ey, lerp(ex, hx, 0.3), lerp(ey, hy, 0.3), 1.2, hp.sleeve);
      line(b, lerp(ex, hx, 0.3), lerp(ey, hy, 0.3), hx, hy, 1.0, hp.skin);
    });
    const skin = mix(P[0].skin, P[1].skin, 0.5);
    disc(b, hx, hy, 2.8, [34, 22, 14]);
    disc(b, hx, hy, 2.0, skin);
    b.px(hx - 1, hy - 1, shade(skin, 1.15));
    if (strain && Math.floor(t * 2.5) % 3 === 0) { const k = p > 0 ? 1 : 0; b.px(sides[k].x + (k ? 9 : 18), sides[k].y + 5, [214, 232, 250]); b.px(sides[k].x + (k ? 9 : 18), sides[k].y + 6 + Math.floor(t * 6) % 2, [214, 232, 250]); }
    if (won && after < 0.6) {
      const r = rng(seed + 7);
      for (let i = 0; i < 12; i++) {
        const a = r() * Math.PI, d = after * (12 + r() * 14);
        b.px(hx + Math.cos(a) * d * 0.8, top - 1 - Math.sin(a) * d * 0.5, [206, 182, 140], 1 - after / 0.6);
      }
    }
    if (won) confetti(b, seed, after);
  }
  function confetti(b, seed, after) {
    const r = rng(seed + 99);
    for (let i = 0; i < 22; i++) {
      const x0 = r() * W, sp = 12 + r() * 10, ph = r() * 6, c = BUNT[i % BUNT.length], y = -4 + (after - r() * 0.6) * sp;
      if (y < -2 || y > H) continue;
      const x = x0 + 3 * Math.sin(after * 3 + ph);
      b.px(x, y, c);
      if (Math.sin(after * 8 + ph) > 0) b.px(x + 1, y, shade(c, 0.8));
    }
  }

  // ---------- archery at the butts ----------
  const AR = { start: 0.5, shot: 1.35, after: 2.4 };
  const LANES = [{ x: 20, feet: 70, tx: 118, ty: 54, R: 7 }, { x: -1, feet: 61, tx: 103, ty: 45, R: 6 }];
  const RINGS = [[232, 192, 64], [192, 57, 43], [58, 110, 165], [42, 40, 40], [236, 228, 208]];
  function shots(m) {
    const s = m.show || {}, ar = s.arrows || [[], []], out = [];
    for (let i = 0; i < 3; i++) for (const k of [0, 1]) if (ar[k][i] != null) out.push({ k, score: ar[k][i], n: i });
    if (s.off) for (const k of [0, 1]) out.push({ k, score: s.off[k], n: 3 });
    out.forEach((x, i) => { x.t0 = AR.start + i * AR.shot; });
    return out;
  }
  function landing(m, x) {
    const L = LANES[x.k], r = rng(hash((m.id || "ar") + ":" + x.k + ":" + x.n));
    if (!x.score) return { x: L.tx + 11 + Math.round(r() * 5), y: L.ty + L.R + 6 + Math.round(r() * 2), miss: true };
    const rad = ((10 - x.score) + 0.3 + r() * 0.6) / 10 * L.R, a = r() * Math.PI * 2;
    return { x: L.tx + Math.cos(a) * rad, y: L.ty + Math.sin(a) * rad * 0.95 };
  }
  function dusk(b, seed) {
    const SKY = [[68, 98, 124], [104, 120, 132], [168, 136, 110], [214, 158, 104], [238, 188, 116], [246, 214, 150]];
    for (let y = 0; y < 44; y++) for (let x = 0; x < W; x++) {
      const v = clamp(y / 42, 0, 0.999) * (SKY.length - 1), k = clamp(Math.floor(v + dith(x, y) - 0.5), 0, SKY.length - 1);
      b.px(x, y, SKY[k]);
    }
    for (let y = 26; y < 42; y++) for (let x = 66; x < 90; x++) { const d = Math.hypot(x - 77, y - 36); if (d < 5) b.px(x, y, d < 3.5 ? [255, 246, 206] : [252, 226, 160]); }
    const r = rng(seed);
    const far = [], near = [];
    let f = 36 + r() * 3, n = 41 + r() * 3;
    for (let x = 0; x < W; x++) { f = clamp(f + (r() - 0.5) * 1.6, 33, 40); n = clamp(n + (r() - 0.5) * 1.2, 39, 45); far.push(Math.round(f)); near.push(Math.round(n)); }
    for (let x = 0; x < W; x++) {
      for (let y = far[x]; y < 48; y++) b.px(x, y, [112, 116, 92]);
      for (let y = near[x]; y < 48; y++) b.px(x, y, [82, 98, 66]);
    }
    for (const tx of [30, 46, 92, 113, 124]) { const ty = near[tx] - 1; disc(b, tx, ty - 3, 3, [58, 74, 48]); disc(b, tx - 1, ty - 4, 1.5, [76, 94, 58]); b.px(tx, ty, [52, 38, 24]); }
    for (let y = 44; y < H; y++) for (let x = 0; x < W; x++) {
      const band = Math.floor((x + (y - 44) * 0.6) / 10) % 2, base = mix([118, 142, 64], [86, 112, 48], (y - 44) / 28);
      let c = band ? base : shade(base, 0.94);
      if ((x * 31 + y * 17) % 23 === 0) c = shade(c, 1.15);
      b.px(x, y, c);
    }
    for (let y = 50; y < H; y += 2) b.px(52 + Math.round((y - 50) * -0.15), y, [236, 230, 210]);
  }
  function butt(b, L) {
    const by = L.ty + L.R - 1;
    line(b, L.tx - 5, L.ty - 2, L.tx - 8, by + 9, 0.5, [76, 52, 30]);
    line(b, L.tx + 5, L.ty - 2, L.tx + 8, by + 9, 0.5, [76, 52, 30]);
    for (let y = by; y < by + 9; y++) for (let x = L.tx - 9; x <= L.tx + 9; x++) b.px(x, y, (x + y * 3) % 5 === 0 ? [176, 140, 60] : y === by ? [230, 200, 110] : [206, 172, 88]);
    b.rect(L.tx - 9, by + 4, 19, 1, [140, 96, 50]);
    for (let j = -L.R - 1; j <= L.R + 1; j++) for (let i = -L.R - 1; i <= L.R + 1; i++) {
      const d = Math.hypot(i, j / 0.95);
      if (d > L.R + 0.6) continue;
      b.px(L.tx + i, L.ty + j, d > L.R - 0.3 ? [60, 44, 30] : RINGS[clamp(Math.floor(d / (L.R / 5)), 0, 4)]);
    }
  }
  function stuck(b, x, y, miss) {
    if (miss) { thin(b, x, y, x - 3, y - 2, [92, 62, 34]); b.px(x - 3, y - 2, [236, 228, 208]); b.px(x - 4, y - 2, [184, 64, 46]); return; }
    thin(b, x - 1, y, x - 4, y - 1, [92, 62, 34]);
    b.px(x - 4, y - 1, [236, 228, 208]); b.px(x - 5, y - 1, [184, 64, 46]);
    b.px(x, y, [30, 22, 16]);
  }
  function bow(b, x, y, draw) {
    for (let j = -8; j <= 8; j++) b.px(x + Math.round(3 * Math.cos(j / 8 * Math.PI / 2)), y + j, [104, 66, 30]);
    b.px(x, y - 8, [60, 38, 18]); b.px(x, y + 8, [60, 38, 18]);
    const pull = Math.round(draw * 4);
    thin(b, x, y - 8, x - pull, y, [226, 220, 200]); thin(b, x - pull, y, x, y + 8, [226, 220, 200]);
    return x - pull;
  }
  function archery(b, m, t, opts) {
    const P = opts._cast || cast(m, opts), seed = hash(m.id || "ar"), list = shots(m);
    dusk(b, seed);
    butt(b, LANES[1]); butt(b, LANES[0]);
    const end = AR.start + list.length * AR.shot, after = t - end, done = after >= 0;
    for (const x of list) if (t >= x.t0 + 0.95) { const l = landing(m, x); stuck(b, Math.round(l.x), Math.round(l.y), l.miss); }
    const cur = list.find((x) => t >= x.t0 && t < x.t0 + AR.shot);
    // the slate: running totals, and a rosette for the winner at the end
    const sx = 52, sy = 3, SW = 46;
    b.rect(sx - 1, sy - 1, SW + 2, 22, [92, 62, 34]);
    b.rect(sx, sy, SW, 20, [46, 56, 52]);
    for (let i = 0; i < SW; i += 7) b.px(sx + i, sy + 3 + (i % 3), [70, 80, 76]);
    thin(b, sx + 5, sy + 21, sx + 3, 47, [80, 54, 30]); thin(b, sx + SW - 5, sy + 21, sx + SW - 3, 47, [80, 54, 30]);
    [0, 1].forEach((k) => {
      const nm = P[k].name.replace(/[^A-Za-z0-9 '-]/g, "").toUpperCase().slice(0, 7), tot = list.filter((x) => x.k === k && t >= x.t0 + 0.95).reduce((s, x) => s + x.score, 0);
      const y = sy + 3 + k * 10, chalk = [232, 232, 220];
      text(b, nm, sx + 3, y, chalk);
      const ts = String(tot);
      text(b, ts, sx + SW - 3 - textW(ts), y, done && m.winner === k ? [246, 214, 120] : chalk);
      list.filter((x) => x.k === k && t >= x.t0 + 0.95).forEach((x, i) => b.rect(sx + 3 + i * 4, y + 6, 3, 1, x.score ? RINGS[clamp(Math.floor((10 - x.score) / 2), 0, 4)] : [120, 120, 120]));
      if (done && m.winner === k) {
        const rx = sx - 1, ry = y + 2;
        disc(b, rx, ry, 2.5, [184, 52, 40]); disc(b, rx, ry, 1.2, [236, 197, 106]);
        b.px(rx - 1, ry + 3, [150, 40, 30]); b.px(rx - 1, ry + 4, [150, 40, 30]); b.px(rx + 1, ry + 3, [150, 40, 30]); b.px(rx + 1, ry + 4, [150, 40, 30]);
      }
    });
    // the archers, back lane first; whoever is shooting has the bow up
    [1, 0].forEach((k) => {
      const L = LANES[k], hp = P[k], winner = done && m.winner === k;
      const hop = winner ? -Math.round(2 * Math.abs(Math.sin(after * 7.5)) * clamp(1.8 - after, 0, 1)) : 0;
      const y = L.feet - hp.sp.h + hop, x = L.x;
      blit(b, hp.sp, x, y, (i, j) => i >= NEAR.left[0] && i <= NEAR.left[1] && j >= 16 && j <= 26);
      const shooting = cur && cur.k === k, u = shooting ? t - cur.t0 : 1;
      const draw = shooting ? (u < 0.45 ? smooth(u / 0.45) : u < 0.5 ? 1 - (u - 0.45) / 0.05 : 0) : 0;
      const bx = x + 27, by = y + 18, ax = shooting || winner ? bx : x + 24;
      line(b, x + 21, y + 17, ax - 1, by + (shooting ? 0 : 3), 1.0, [34, 22, 14]);
      line(b, x + 21, y + 17, ax - 1, by + (shooting ? 0 : 3), 0.5, hp.sleeve);
      const nock = bow(b, ax, shooting ? by : by + 3, draw);
      if (shooting && u < 0.47) { thin(b, nock, by, nock + 9, by, [140, 100, 56]); b.px(nock + 9, by, [200, 200, 200]); b.px(nock + 1, by, [184, 64, 46]); }
      if (shooting && u >= 0.47 && u < 0.95) {
        const l = landing(m, cur), v = (u - 0.47) / 0.48, X = lerp(bx + 9, l.x, v), Y = lerp(by, l.y, v) - Math.sin(v * Math.PI) * 6;
        const X2 = lerp(bx + 9, l.x, v - 0.06), Y2 = lerp(by, l.y, v - 0.06) - Math.sin((v - 0.06) * Math.PI) * 6;
        thin(b, X2 - (X - X2) * 0.6, Y2 - (Y - Y2) * 0.6, X, Y, [150, 106, 60]);
        b.px(X, Y, [220, 220, 220]);
      }
      if (shooting && u >= 0.95) {
        const l = landing(m, cur), v = (u - 0.95) / 0.4, s = String(cur.score || "MISS");
        text(b, s, Math.round(l.x - textW(s) / 2), Math.round(l.y - 12 - v * 4), cur.score >= 9 ? [252, 226, 120] : [244, 238, 222], [40, 26, 16]);
      }
    });
    if (done) confetti(b, seed, after);
  }

  // ---------- the player ----------
  function length(m) { return m.event === "archery" ? AR.start + shots(m).length * AR.shot : bout(m).pin; }
  function total(m) { return length(m) + (m.event === "archery" ? AR.after : AW.after); }
  function frame(m, t, opts) {
    opts = opts || {};
    const b = new Buf(W, H);
    (m.event === "archery" ? archery : armWrestle)(b, m, t, opts);
    return { w: W, h: H, data: b.d };
  }
  function events(m) {
    if (m.event === "archery") {
      const out = shots(m).map((x) => [x.t0 + 0.95, x.score ? "hit" : "miss"]);
      out.push([length(m) + 0.1, "win"]);
      return out;
    }
    return [[bout(m).pin, "hit"], [bout(m).pin + 0.2, "win"]];
  }
  const calm = () => (root.Settings && root.Settings.calm ? root.Settings.calm() : !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches));
  function player(m, opts) {
    opts = Object.assign({}, opts || {});
    opts._cast = cast(m, opts);
    const doc = root.document, fig = doc.createElement("figure"), cv = doc.createElement("canvas");
    fig.className = "games-replay";
    cv.width = W; cv.height = H;
    cv.style.cssText = "image-rendering:pixelated;image-rendering:crisp-edges;display:block;width:100%;height:auto;cursor:pointer";
    cv.title = "Click to watch again";
    fig.appendChild(cv);
    const g = cv.getContext("2d"), img = g.createImageData(W, H), dur = total(m), cues = events(m);
    let t = calm() ? dur : 0, raf = 0, last = 0, onscreen = !("IntersectionObserver" in root), fired = 0;
    const paint = () => { img.data.set(frame(m, t, opts).data); g.putImageData(img, 0, 0); };
    function tick(ms) {
      raf = 0;
      if (!fig.isConnected || !onscreen || doc.hidden) { last = 0; return; }
      t = Math.min(dur, t + (last ? Math.min(0.1, (ms - last) / 1000) : 0));
      last = ms;
      while (fired < cues.length && cues[fired][0] <= t) { if (root.Sound && root.Sound.sfx) root.Sound.sfx(cues[fired][1]); fired++; }
      paint();
      if (t < dur) raf = root.requestAnimationFrame(tick);
    }
    const wake = () => { if (!raf && t < dur && !calm()) { last = 0; raf = root.requestAnimationFrame(tick); } };
    cv.addEventListener("click", () => { t = 0; fired = 0; paint(); if (calm()) { t = dur; paint(); } else wake(); });
    if (!onscreen) new root.IntersectionObserver((es) => { onscreen = es.some((e) => e.isIntersecting); if (onscreen) wake(); }).observe(cv);
    paint();
    wake();
    return fig;
  }

  // ---------- the chess simul's record for ChessReplay ----------
  function chessRecord(m, names) {
    const s = m.show, ids = s.white === 0 ? [m.a, m.b] : [m.b, m.a];
    return { id: "games-" + (m.id || "c"), game: "chess", setting: "hall", set: { id: "chess_ivory", tier: 3 },
      players: ids.map((id) => ({ id, name: (names || {})[id] || id })), moves: s.moves, san: s.san, key: s.key, result: s.result, winner: s.winner };
  }

  // ---------- the trophies: lit from the top-left like every sprite, outlined in dark ink ----------
  const BRASS = [[255, 236, 160], [236, 197, 106], [200, 150, 62], [150, 104, 36], [96, 64, 24]];
  const OAK = [[176, 118, 66], [140, 90, 48], [104, 64, 32], [70, 42, 20]];
  const TIN = [[236, 238, 240], [196, 200, 206], [150, 154, 162], [104, 108, 116]];
  // a rounded upright roll (a finger, a wrist, a body): ramp across its width, the top corners knocked off
  function roll(b, x, y, w, h, ramp, round) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (round && j === 0 && (i === 0 || i === w - 1)) continue;
      const u = w === 1 ? 0.3 : i / (w - 1), k = u < 0.25 ? 0 : u < 0.55 ? 1 : u < 0.85 ? 2 : 3;
      b.px(x + i, y + j, ramp[Math.min(ramp.length - 1, k + (j > h - 2 ? 1 : 0))]);
    }
  }
  function plinth(b, y, w, plate) {
    const x = 12 - (w >> 1);
    roll(b, x, y, w, 5, OAK);
    b.rect(x, y, w, 1, OAK[0]);
    b.rect(x - 1, y + 4, w + 2, 2, OAK[3]);
    b.rect(x - 1, y + 4, w + 2, 1, OAK[2]);
    if (plate) { b.rect(x + 3, y + 2, w - 6, 2, BRASS[2]); b.rect(x + 3, y + 2, w - 6, 1, BRASS[1]); }
  }
  function trophyGrid(event) {
    const b = new Buf(24, 28), O = [40, 26, 16];
    if (event === "arm_wrestling") {
      plinth(b, 21, 18, true);
      roll(b, 8, 16, 8, 5, BRASS.slice(1));
      b.rect(8, 18, 8, 1, BRASS[3]);
      roll(b, 6, 10, 12, 7, BRASS.slice(1));
      for (let k = 0; k < 4; k++) roll(b, 6 + k * 3, 4, 3, 7, BRASS, true);
      for (let k = 0; k < 4; k++) { b.px(6 + k * 3 + 1, 7, BRASS[3]); b.px(6 + k * 3, 8, BRASS[3]); }
      for (let k = 1; k < 4; k++) for (let j = 5; j < 11; j++) b.px(6 + k * 3, j, j < 7 ? BRASS[2] : BRASS[3]);
      roll(b, 4, 11, 9, 3, BRASS, true);
      b.px(12, 12, BRASS[2]); b.px(4, 11, BRASS[1]);
      b.rect(5, 11, 3, 1, BRASS[0]);
    } else if (event === "archery") {
      for (let y = 2; y < 26; y++) for (let x = 2; x < 22; x++) {
        const edge = y > 19 ? Math.abs(x - 11.5) > 9.5 - (y - 19) * 1.4 : false;
        if (edge) continue;
        const rim = x === 2 || x === 21 || y === 2 || (y > 19 && Math.abs(x - 11.5) > 8.4 - (y - 19) * 1.4);
        b.px(x, y, rim ? OAK[2] : (x + y * 2) % 9 === 0 ? OAK[2] : y < 4 ? OAK[1] : [86, 52, 26]);
      }
      const HEART = ["..##....##..", ".####..####.", "############", "############", "############", ".##########.", "..########..", "...######...", "....####....", ".....##....."];
      const RED = [[220, 96, 72], [184, 64, 46], [140, 40, 30]], STRAW = [236, 206, 120];
      HEART.forEach((row, j) => [...row].forEach((c, i) => {
        if (c !== "#") return;
        const k = i + j < 6 ? 0 : i - j > 4 || j > 6 ? 2 : 1;
        b.px(6 + i, 7 + j, (i * 3 + j * 5) % 7 === 0 ? STRAW : RED[k]);
      }));
      for (let k = 0; k <= 16; k++) { const x = 3 + k, y = 21 - k; b.px(x, y, BRASS[1]); b.px(x + 1, y, BRASS[3]); }
      b.rect(19, 3, 2, 2, BRASS[0]); b.px(21, 3, BRASS[1]); b.px(19, 5, BRASS[2]); b.px(20, 2, BRASS[1]);
      b.px(3, 21, [236, 228, 208]); b.px(2, 22, [236, 228, 208]); b.px(4, 22, [184, 64, 46]); b.px(3, 23, [184, 64, 46]); b.px(2, 20, [184, 64, 46]);
    } else {
      b.rect(6, 24, 12, 2, [60, 92, 52]); b.rect(6, 24, 12, 1, [84, 120, 70]);
      roll(b, 5, 21, 14, 3, OAK);
      roll(b, 7, 19, 10, 2, OAK);
      for (let y = 11; y < 19; y++) { const w = 6 + Math.round((y - 11) * 0.4); roll(b, 12 - (w >> 1), y, w, 1, OAK); }
      roll(b, 6, 10, 12, 2, OAK);
      b.rect(6, 10, 12, 1, OAK[0]);
      roll(b, 8, 6, 8, 4, OAK, true);
      b.px(15, 7, O); b.px(15, 8, O);
      for (const x of [8, 11, 14]) { b.px(x, 4, TIN[1]); b.px(x + 1, 4, TIN[2]); b.px(x, 5, TIN[0]); b.px(x + 1, 5, TIN[2]); }
      b.rect(8, 5, 8, 1, TIN[1]); b.px(8, 5, TIN[0]);
      b.rect(11, 0, 2, 4, TIN[1]); b.rect(10, 1, 4, 1, TIN[1]); b.px(11, 0, TIN[0]); b.px(10, 1, TIN[0]); b.px(13, 1, TIN[3]);
    }
    for (let y = 0; y < 28; y++) for (let x = 0; x < 24; x++) {
      const o = (y * 24 + x) * 4;
      if (b.d[o + 3]) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => { const X = x + i, Y = y + j; return X >= 0 && Y >= 0 && X < 24 && Y < 28 && b.d[(Y * 24 + X) * 4 + 3] === 255; });
      if (near) { b.d[o] = O[0]; b.d[o + 1] = O[1]; b.d[o + 2] = O[2]; b.d[o + 3] = 254; }
    }
    return b;
  }
  function trophy(event, scale) {
    const g = trophyGrid(event), cv = root.document.createElement("canvas");
    cv.width = g.w; cv.height = g.h;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(g.w, g.h);
    img.data.set(g.d);
    ctx.putImageData(img, 0, 0);
    cv.style.cssText = `width:${g.w * (scale || 3)}px;height:${g.h * (scale || 3)}px;image-rendering:pixelated`;
    cv.className = "cg-trophy";
    return cv;
  }

  root.GamesReplay = { player, frame, length, events, chessRecord, trophy, trophyGrid, W, H };
})(typeof window !== "undefined" ? window : globalThis);
