/* Gambling table replays: one pixel-art scene per town game, played from a session record, with synthesised sound. */
/*
  INPUT: a game record, as league/gambling.py save_game stores it in world["games"][id]:
    { id, day, season, town, game, dealer, hero, name, nick, where: "day"|"night",
      outcome: "win"|"loss"|"big_win"|"big_loss"|"streak_hot"|"streak_cold"|"chase"|"walk_away"|"cheat_win"|"cheat_caught"|"banned"|"cells",
      net: copper won (+) or lost (-) over the whole sitting, purse: [copper before, copper after],
      rounds: [ { stake: copper, won: bool, net: copper this round paid (+), cost (-) or 0 for the stake back, cheat?: bool, caught?: bool,
                  show: {...per game, below} } ] }
  The replay plays one round (by default a cheat round if any, else the last round that went the night's way) and shows the
  night's net in the hold. Every round was played out with the game's own pieces (league/gambling.py play_round).
  show, per game:
    liars_dice       { mine: [5 faces], theirs: [5 faces], bid: [count, face], called_by: "table"|"hero", bids }  the bidder wins if the bid stood
    crown_anchor     { pick: emblem, dice: [3 emblems], matches }  pays once per matching die; emblems: crown anchor heart diamond spade club
    knucklebones     { mine: [5 of 1|3|4|6], house: [5 of 1|3|4|6], rethrow?, house_rethrow? }  ties go to the house
    undertakers_lots { lot: 2..12, roll: [d6, d6], off }  off 0 pays double, 1 even money, 2 the stake back
    pig_races        { backed: 1..6, order: [six pig numbers, winner first], odds: [[num, den] per pig] }
    candle_stakes    { burn: [3..5 burn lengths], mine: index, pot, tithe }  the longest burn is the last flame and takes the pot
    acorn_shells     { start: 0..2, swaps: [[a, b], ...], acorn: 0..2, guess: 0..2 }  positions left to right
    toll_toss        { call: "heads"|"tails", landed: "heads"|"tails", toll }

  TablesReplay.player(rec, opts) -> <figure> that plays while on screen, holds on the result, replays on click.
    opts.round (index, default last), opts.scale (CSS px per pixel, default fluid to 100% width), opts.caption (bool)
  TablesReplay.frame(rec, t, opts) -> { w, h, data: RGBA bytes }: any moment as pixels (no DOM; tools capture with it).
  TablesReplay.length(rec, opts) -> seconds of action before the hold. TablesReplay.GAMES lists the game ids.
*/
(function (root) {
  "use strict";
  const W = 192, H = 144;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const sc = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const ease = (t) => 1 - (1 - t) * (1 - t);
  const ease3 = (t) => 1 - Math.pow(1 - t, 3);
  const smooth = (t) => t * t * (3 - 2 * t);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function vnoise(seed) {
    const r = rng(seed), p = new Float32Array(64 * 64);
    for (let i = 0; i < p.length; i++) p[i] = r();
    const at = (x, y) => p[((y & 63) << 6) | (x & 63)];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
      return lerp(lerp(at(xi, yi), at(xi + 1, yi), xf), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), xf), yf);
    };
  }

  // ---------- 3D maths ----------
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const mv = (A, v) => [dot(A[0], v), dot(A[1], v), dot(A[2], v)];
  const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const Rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
  const Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
  const Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
  function Raxis(ax, a) {
    const [x, y, z] = norm(ax), c = Math.cos(a), s = Math.sin(a), t = 1 - c;
    return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
  }

  class Cam {
    constructor(o) {
      const a = (o.pitch || 70) * Math.PI / 180, tg = o.target || [0, 0, 0];
      this.f = [0, Math.cos(a), -Math.sin(a)];
      this.u = [0, Math.sin(a), Math.cos(a)];
      this.pos = [tg[0] - this.f[0] * o.dist, tg[1] - this.f[1] * o.dist, tg[2] - this.f[2] * o.dist];
      this.focal = o.focal || o.dist;
      this.cx = W / 2; this.cy = o.cy || H / 2;
      this.sx = 0; this.sy = 0;
    }
    p(x, y, z) {
      const r = [x - this.pos[0], y - this.pos[1], z - this.pos[2]], d = dot(r, this.f);
      return [this.cx + this.sx + r[0] * this.focal / d, this.cy + this.sy - dot(r, this.u) * this.focal / d, d];
    }
    scale(x, y, z) { return this.focal / dot([x - this.pos[0], y - this.pos[1], z - this.pos[2]], this.f); }
    facing(pt, n) { return dot([this.pos[0] - pt[0], this.pos[1] - pt[1], this.pos[2] - pt[2]], n) > 0; }
    // the point on a world plane (axis k = v) seen through a pixel centre
    unproject(sx, sy, k, v) {
      const dx = (sx - this.cx - this.sx) / this.focal, dy = (sy - this.cy - this.sy) / this.focal;
      const D = [this.f[0] + dx - this.u[0] * dy, this.f[1] - this.u[1] * dy, this.f[2] - this.u[2] * dy];
      const s = (v - this.pos[k]) / D[k];
      return [this.pos[0] + D[0] * s, this.pos[1] + D[1] * s, this.pos[2] + D[2] * s];
    }
  }

  // ---------- the raster: float RGB plus an emissive mask that the lighting pass leaves alone ----------
  class Buf {
    constructor() { this.c = new Float32Array(W * H * 3); this.e = new Uint8Array(W * H); }
    copy(o) { this.c.set(o.c); this.e.set(o.e); return this; }
    clone() { return new Buf().copy(this); }
    fill(col) { for (let i = 0; i < W * H; i++) { this.c[i * 3] = col[0]; this.c[i * 3 + 1] = col[1]; this.c[i * 3 + 2] = col[2]; } this.e.fill(0); }
    px(x, y, col, emit) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      this.c[i * 3] = col[0]; this.c[i * 3 + 1] = col[1]; this.c[i * 3 + 2] = col[2];
      this.e[i] = emit ? 1 : 0;
    }
    get(x, y) { const i = (clamp(Math.floor(y), 0, H - 1) * W + clamp(Math.floor(x), 0, W - 1)) * 3; return [this.c[i], this.c[i + 1], this.c[i + 2]]; }
    mul(x, y, f) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 3;
      if (typeof f === "number") { this.c[i] *= f; this.c[i + 1] *= f; this.c[i + 2] *= f; } else { this.c[i] *= f[0]; this.c[i + 1] *= f[1]; this.c[i + 2] *= f[2]; }
    }
    add(x, y, col, a) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 3;
      this.c[i] += col[0] * a; this.c[i + 1] += col[1] * a; this.c[i + 2] += col[2] * a;
    }
    blend(x, y, col, a) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 3;
      this.c[i] = lerp(this.c[i], col[0], a); this.c[i + 1] = lerp(this.c[i + 1], col[1], a); this.c[i + 2] = lerp(this.c[i + 2], col[2], a);
    }
    // scanline fill at pixel centres; fn(x, y) gives a colour, or col is a flat colour
    poly(pts, col, emit, fn) {
      let y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
      const ya = Math.max(0, Math.ceil(y0 - 0.5)), yb = Math.min(H - 1, Math.floor(y1 - 0.5));
      const xs = [];
      for (let y = ya; y <= yb; y++) {
        const cy = y + 0.5;
        xs.length = 0;
        for (let i = 0, n = pts.length; i < n; i++) {
          const a = pts[i], b = pts[(i + 1) % n];
          if ((a[1] <= cy && b[1] > cy) || (b[1] <= cy && a[1] > cy)) xs.push(a[0] + (cy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
          for (let x = xa; x <= xb; x++) {
            const c = fn ? fn(x, y) : col;
            if (!c) continue;
            if (c.mul !== undefined) { this.mul(x, y, c.mul); continue; }
            const i = y * W + x;
            this.c[i * 3] = c[0]; this.c[i * 3 + 1] = c[1]; this.c[i * 3 + 2] = c[2];
            this.e[i] = emit ? 1 : 0;
          }
        }
      }
    }
    line(x0, y0, x1, y1, col, emit) {
      x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (let n = 0; n < 400; n++) {
        this.px(x0, y0, col, emit);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    rect(x, y, w, h, col, emit) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, col, emit); }
    // an ellipse filled pixel by pixel; fn(nx, ny, x, y) with nx, ny in -1..1
    ell(cx, cy, rx, ry, fn) {
      const xa = Math.floor(cx - rx), xb = Math.ceil(cx + rx), ya = Math.floor(cy - ry), yb = Math.ceil(cy + ry);
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) fn(nx, ny, x, y);
      }
    }
    // dithered darkening of an ellipse: f in the core, fading out over the rim
    shadow(cx, cy, rx, ry, f, soft) {
      soft = soft === undefined ? 0.35 : soft;
      this.ell(cx, cy, rx, ry, (nx, ny, x, y) => {
        const d = Math.sqrt(nx * nx + ny * ny), k = d < 1 - soft ? 1 : (1 - d) / soft;
        if (k >= 1 || k > BAYER[(y & 3) * 4 + (x & 3)]) this.mul(x, y, f);
      });
    }
  }

  // lit shading: f < 1 sinks toward the scene's shadow tint, f > 1 lifts toward its highlight tint, in steps
  function shadeOf(scn) {
    const lo = scn.lo || [0.92, 0.82, 0.74], hi = scn.hi || [1.06, 1.0, 0.86];
    return (c, f) => {
      f = Math.round(f * 8) / 8;
      if (f <= 1) { const t = 1 - f; return [c[0] * f * lerp(1, lo[0], t), c[1] * f * lerp(1, lo[1], t), c[2] * f * lerp(1, lo[2], t)]; }
      const t = Math.min(1, f - 1);
      return [Math.min(255, c[0] * f * lerp(1, hi[0], t)), Math.min(255, c[1] * f * lerp(1, hi[1], t)), Math.min(255, c[2] * f * lerp(1, hi[2], t))];
    };
  }

  // the lamp pass: ambient plus each lamp's pool, quantised with an ordered dither for crunchy banding
  const DAP = vnoise(7);
  function light(b, lamps, amb, levels) {
    levels = levels || 9;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (b.e[i]) continue;
      const th = BAYER[(y & 3) * 4 + (x & 3)];
      let r = amb[0], g = amb[1], bl = amb[2];
      for (const L of lamps) {
        if (L.kind === "dapple") {
          // sun through moving leaves: two drifting noise layers, cut hard so the patches have edges
          const v = DAP(x * 0.055 + L.t * 0.12, y * 0.075 - L.t * 0.05) * 0.7 + DAP(x * 0.16 - L.t * 0.3, y * 0.2 + 9) * 0.3;
          const k = Math.floor(clamp((v - 0.42) * 5, 0, 1) * L.i * levels + th) / levels;
          r += k * L.c[0]; g += k * L.c[1]; bl += k * L.c[2];
          continue;
        }
        if (L.kind === "win") {
          const u = (x + 0.5 - L.x - (y + 0.5 - L.y) * L.skew) / L.w, v = (y + 0.5 - L.y) / L.h;
          const e = Math.max(Math.abs(u), Math.abs(v));
          if (e >= 1) continue;
          const bar = Math.abs(u) < 0.06 || Math.abs(v) < 0.07 ? 0.25 : 1;
          const k = Math.floor(Math.min(1, (1 - e) * 4) * bar * L.i * levels + th) / levels;
          r += k * L.c[0]; g += k * L.c[1]; bl += k * L.c[2];
          continue;
        }
        const dx = x + 0.5 - L.x, dy = (y + 0.5 - L.y) * (L.sy || 1.15), d = Math.sqrt(dx * dx + dy * dy);
        if (d >= L.r) continue;
        const k = Math.floor(Math.pow(1 - d / L.r, L.p || 1.4) * L.i * levels + th) / levels;
        r += k * L.c[0]; g += k * L.c[1]; bl += k * L.c[2];
      }
      b.c[i * 3] *= r; b.c[i * 3 + 1] *= g; b.c[i * 3 + 2] *= bl;
    }
  }
  function glow(b, x, y, r, col, a) {
    b.ell(x, y, r, r, (nx, ny, px, py) => {
      const k = Math.floor((1 - Math.sqrt(nx * nx + ny * ny)) * a * 5 + BAYER[(py & 3) * 4 + (px & 3)]) / 5;
      if (k > 0) b.add(px, py, col, k);
    });
  }

  // ---------- the pixel font: 3x5 capitals and figures, M N W wider ----------
  const GLYPHS = {
    A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111",
    F: "111100110100100", G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010",
    K: "101101110101101", L: "100100100100111", M: "1000111011101011000110001", N: "10011101101110011001",
    O: "010101101101010", P: "110101110100100", Q: "010101101110011", R: "110101110101101", S: "011100010001110",
    T: "111010010010010", U: "101101101101111", V: "101101101101010", W: "1000110001101011101110001",
    X: "101101010101101", Y: "101101010010010", Z: "111001010100111",
    0: "111101101101111", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110", 4: "101101111001001",
    5: "111100110001110", 6: "011100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001110",
    "!": "11101", "?": "110001010000010", ".": "00001", ",": "0001010", ":": "01010", "-": "000000111000000",
    "+": "000010111010000", "=": "000111000111000", "'": "11000", "/": "001001010100100", "#": "101111101111101", "x": "000101010101000",
    " ": "0000000000",
  };
  function glyph(ch) {
    const g = GLYPHS[ch] || GLYPHS[ch.toUpperCase()] || GLYPHS["?"];
    const w = g.length / 5;
    return { w, on: (x, y) => g[y * w + x] === "1" };
  }
  function textWidth(s, k) { k = k || 1; let w = 0; for (const ch of s) w += (glyph(ch).w + 1) * k; return Math.max(0, w - k); }
  function text(b, s, x, y, col, o) {
    o = o || {};
    const k = o.k || 1;
    if (o.center) x = Math.round(x - textWidth(s, k) / 2);
    const draw = (ox, oy, c) => {
      let cx = x + ox;
      for (const ch of s) {
        const g = glyph(ch);
        for (let j = 0; j < 5; j++) for (let i = 0; i < g.w; i++) if (g.on(i, j)) b.rect(cx + i * k, y + oy + j * k, k, k, c, true);
        cx += (g.w + 1) * k;
      }
    };
    if (o.outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) draw(dx, dy, o.outline);
    if (o.shadow) draw(0, 1, o.shadow);
    draw(0, 0, col);
  }

  // ---------- money ----------
  function money(cp) {
    cp = Math.abs(Math.round(cp));
    const s = Math.floor(cp / 10), c = cp % 10;
    if (!s) return `${c} COPPER`;
    if (c && s < 10) return `${s}S ${c}C`;
    // the same rule as App.coins and town.gold_words: gold pieces from 100 silver up, whole silver floors, thousands take a comma
    const g = Math.floor(cp / 100), r = Math.floor((cp % 100) / 10);
    if (cp >= 1000) return `${String(g).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} GOLD${r ? ` ${r} SILVER` : ""}`;
    return `${s} SILVER`;
  }
  // a stake as coins: gold for each 10 silver, silver, then copper, at most a dozen
  function coinsFor(cp) {
    const g = Math.floor(cp / 100), s = Math.floor((cp % 100) / 10), c = cp % 10, out = [];
    for (let i = 0; i < Math.min(g, 8); i++) out.push("g");
    for (let i = 0; i < s; i++) out.push("s");
    for (let i = 0; i < Math.min(c, 4); i++) out.push("c");
    if (g > 8) out.splice(8, 0, "g", "g");
    return out.slice(0, 12).reverse();
  }
  const COIN = { g: [236, 186, 72], s: [206, 210, 214], c: [196, 118, 70] };

  // ---------- the scene kit: solids drawn through the camera, shaded by a key light ----------
  class Scene {
    constructor(cam, opts) {
      this.cam = cam;
      this.b = new Buf();
      this.key = norm(opts.key || [-0.45, -0.35, 0.82]);
      this.shade = shadeOf(opts);
      this.amb = opts.ambF === undefined ? 0.55 : opts.ambF;
      this.dif = opts.difF === undefined ? 0.6 : opts.difF;
    }
    P(x, y, z) { return this.cam.p(x, y, z || 0); }
    lit(col, n) { return this.shade(col, this.amb + this.dif * Math.max(0, dot(n, this.key))); }
    poly3(pts, col, emit) { this.b.poly(pts.map((p) => this.P(p[0], p[1], p[2])), col, emit); }
    // a world plane textured pixel by pixel: fn(x, y, z, sx, sy) -> colour
    plane(pts, k, v, fn) {
      const cam = this.cam;
      this.b.poly(pts.map((p) => this.P(p[0], p[1], p[2])), null, false, (sx, sy) => {
        const w = cam.unproject(sx + 0.5, sy + 0.5, k, v);
        return fn(w[0], w[1], w[2], sx, sy);
      });
    }
    line3(a, b, col, emit) { const p = this.P(a[0], a[1], a[2]), q = this.P(b[0], b[1], b[2]); this.b.line(p[0], p[1], q[0], q[1], col, emit); }
    // shadow on the plane z = g from a solid of half-size r at height z, cast away from a light (or straight down)
    drop(x, y, z, r, f, from, g) {
      g = g || 0;
      let ox = 0, oy = 0;
      if (from) { const k = (z - g) / Math.max(4, from[2] - z); ox = (x - from[0]) * k; oy = (y - from[1]) * k; }
      const spread = 1 + (z - g) / 80, fade = clamp(1 - (z - g) / 100, 0.12, 1);
      const c = this.P(x + ox, y + oy, g), s = this.cam.scale(x, y, g) * r * spread;
      this.b.shadow(c[0], c[1], s, s * 0.94, 1 - (1 - f) * fade);
    }
    // a box with rotation R about centre c, half sizes h; tex(faceIndex, u, v) may colour face pixels
    box(c, h, R, col, o) {
      o = o || {};
      const verts = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const w = mv(R, [sx * h[0], sy * h[1], sz * h[2]]);
        verts.push(this.P(c[0] + w[0], c[1] + w[1], c[2] + w[2]));
      }
      const faces = [];
      for (let ax = 0; ax < 3; ax++) for (const sg of [1, -1]) {
        const n = [0, 0, 0]; n[ax] = sg;
        const wn = mv(R, n), fc = [c[0] + wn[0] * h[ax], c[1] + wn[1] * h[ax], c[2] + wn[2] * h[ax]];
        if (!this.cam.facing(fc, wn)) continue;
        const o2 = [0, 1, 2].filter((k) => k !== ax), corner = (su, sv) => {
          const l = [0, 0, 0]; l[ax] = sg * h[ax]; l[o2[0]] = su * h[o2[0]]; l[o2[1]] = sv * h[o2[1]];
          const w = mv(R, l);
          return this.P(c[0] + w[0], c[1] + w[1], c[2] + w[2]);
        };
        const q = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
        const fcol = o.faceCol ? o.faceCol(ax, sg, col) : col;
        const lc = o.flat ? fcol : this.lit(fcol, wn);
        let fn = null;
        if (o.tex) {
          const ex = [q[1][0] - q[0][0], q[1][1] - q[0][1]], ey = [q[3][0] - q[0][0], q[3][1] - q[0][1]];
          const det = ex[0] * ey[1] - ex[1] * ey[0];
          if (Math.abs(det) > 0.01) {
            fn = (x, y) => {
              const dx = x + 0.5 - q[0][0], dy = y + 0.5 - q[0][1];
              const u = (dx * ey[1] - dy * ey[0]) / det, v = (ex[0] * dy - ex[1] * dx) / det;
              const t = o.tex(ax, sg, clamp(u, 0, 0.999), clamp(v, 0, 0.999), wn);
              return t ? (o.flat ? t : this.lit(t, wn)) : lc;
            };
          }
        }
        faces.push({ q, lc, fn, wn });
        this.b.poly(q, lc, o.emit, fn);
      }
      if (o.edge !== false) {
        for (const f of faces) for (let i = 0; i < 4; i++) {
          const a = f.q[i], bq = f.q[(i + 1) % 4];
          if (f.wn[2] > 0.5 && (a[1] + bq[1]) / 2 < (f.q[0][1] + f.q[1][1] + f.q[2][1] + f.q[3][1]) / 4 + 0.1) continue;
          this.b.line(a[0], a[1], bq[0], bq[1], o.edgeCol || sc(f.lc, 0.78));
        }
      }
      if (o.outline) {
        const hull = convexHull(verts.map((v) => [v[0], v[1]]));
        for (let i = 0; i < hull.length; i++) {
          const a = hull[i], bq = hull[(i + 1) % hull.length];
          this.b.line(a[0], a[1], bq[0], bq[1], o.outline);
        }
      }
      return faces;
    }
    // an upright cylinder or disc (axis along z unless R given): ring of side quads, then the cap
    cyl(c, r, hgt, col, o) {
      o = o || {};
      const n = o.n || Math.max(10, Math.round(r * this.cam.scale(c[0], c[1], c[2]) * 2.2));
      const R = o.R || I3, ry = o.ry || r;
      const ring = (z) => { const out = []; for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n, w = mv(R, [r * Math.cos(a), ry * Math.sin(a), z]); out.push([c[0] + w[0], c[1] + w[1], c[2] + w[2]]); } return out; };
      const lo = ring(0), hi = ring(hgt);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, a = 2 * Math.PI * (i + 0.5) / n, nn = mv(R, [Math.cos(a), Math.sin(a), 0]);
        const mid = [(lo[i][0] + hi[j][0]) / 2, (lo[i][1] + hi[j][1]) / 2, (lo[i][2] + hi[j][2]) / 2];
        if (!this.cam.facing(mid, nn)) continue;
        this.poly3([lo[i], lo[j], hi[j], hi[i]], o.sideFn ? o.sideFn(i, n, this.lit(o.side || col, nn)) : this.lit(o.side || col, nn), o.emit);
      }
      const up = mv(R, [0, 0, 1]), top = [c[0] + up[0] * hgt, c[1] + up[1] * hgt, c[2] + up[2] * hgt];
      const capN = this.cam.facing(top, up) ? up : sc(up, -1), cap = this.cam.facing(top, up) ? hi : lo;
      const capc = o.capCol ? this.lit(o.capCol, capN) : this.lit(col, capN);
      if (o.capFn) this.b.poly(cap.map((p) => this.P(p[0], p[1], p[2])), null, o.emit, o.capFn(capc, capN));
      else this.poly3(cap, capc, o.emit);
      if (o.rim) { const pts = cap.map((p) => this.P(p[0], p[1], p[2])); for (let i = 0; i < n; i++) { const a = pts[i], bq = pts[(i + 1) % n]; if (a[1] + bq[1] > 2 * this.P(top[0], top[1], top[2])[1]) this.b.line(a[0], a[1], bq[0], bq[1], o.rim); } }
      return cap;
    }
    coin(x, y, z, kind, R, o) {
      o = o || {};
      const col = COIN[kind] || COIN.s;
      this.cyl([x, y, z], 3.6, 1.1, sc(col, 0.8), { R, n: 12, capCol: col, capFn: (cc, nn) => {
        const p = this.P(x, y, z + 1.1);
        return (px, py) => {
          const d = Math.hypot(px + 0.5 - p[0], (py + 0.5 - p[1]) * 1.1);
          return d < 1.2 && !o.plain ? sc(cc, 0.82) : d > 2.6 && py + 0.5 < p[1] ? this.shade(col, 1.35) : cc;
        };
      } });
    }
    stack(x, y, kinds, z0) {
      z0 = z0 || 0;
      kinds.forEach((k, i) => this.coin(x + ((i * 7) % 3 - 1) * 0.35, y + ((i * 5) % 3 - 1) * 0.3, z0 + i * 1.15, k));
    }
  }

  function convexHull(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of pts.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }

  // ---------- dice: a tumble with weight (arc, spin, bounces, rolling over edges, a rock, then still) ----------
  const ALIGN = { 1: I3, 6: Rx(Math.PI), 3: Ry(-Math.PI / 2), 4: Ry(Math.PI / 2), 5: Rx(Math.PI / 2), 2: Rx(-Math.PI / 2) };
  // which value sits on each face (axis index, sign) of a standard die in its own frame
  const FACEVAL = { "2,1": 1, "2,-1": 6, "0,1": 3, "0,-1": 4, "1,1": 5, "1,-1": 2 };
  const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, 1], [-1, 1], [1, -1]],
    5: [[-1, -1], [1, 1], [-1, 1], [1, -1], [0, 0]], 6: [[-1, -1], [1, 1], [-1, 1], [1, -1], [-1, 0], [1, 0]] };

  // plan one die's flight: from (sx, sy, sz) to rest (ex, ey), landing at t0 + air, settled by t0 + total
  function tumble(r, o) {
    const air = o.air || 0.5, b1 = air * 0.42, b2 = air * 0.22, roll = o.roll || 0.32, rock = 0.42;
    const t0 = o.t0, ti = [t0, t0 + air, t0 + air + b1, t0 + air + b1 + b2, t0 + air + b1 + b2 + roll, t0 + air + b1 + b2 + roll + rock];
    const dir = norm([o.ex - o.sx, o.ey - o.sy, 0]);
    const axis = [-dir[1], dir[0], 0];
    const flips = (o.flips || 3) + Math.floor(r() * 2);
    const yaw = (r() - 0.5) * 1.2, yawSpin = (r() - 0.5) * 9;
    const wob = [r() - 0.5, r() - 0.5, r() - 0.5];
    // where along the path each phase ends: most distance in the air, a little per bounce and roll
    const stops = [0, 0.62, 0.8, 0.9, 1, 1];
    return { o, ti, dir, axis, flips, yaw, yawSpin, wob, stops, h1: o.h1 || 16, end: ti[5], impacts: [ti[1], ti[2], ti[3]] };
  }
  function tumbleAt(T, t, half) {
    const { o, ti, stops } = T;
    let s, z, theta;
    const thetaAt = (k) => [Math.PI / 2 * (T.flips + 1.35), Math.PI / 2 * (T.flips - 0.4), Math.PI / 2 * 2.3, Math.PI / 2 * 1.25, 0, 0][k];
    if (t <= ti[0]) { s = 0; z = o.sz; theta = thetaAt(0); }
    else if (t >= ti[5]) { s = 1; z = 0; theta = 0; }
    else {
      let k = 0;
      while (t > ti[k + 1]) k++;
      const u = (t - ti[k]) / (ti[k + 1] - ti[k]);
      if (k === 0) { s = lerp(stops[0], stops[1], u); z = o.sz * (1 - u * u) + 0 * u; theta = lerp(thetaAt(0), thetaAt(1), u); }
      else if (k === 1) { s = lerp(stops[1], stops[2], u); z = T.h1 * 4 * u * (1 - u); theta = lerp(thetaAt(1), thetaAt(2), u); }
      else if (k === 2) { s = lerp(stops[2], stops[3], u); z = T.h1 * 0.28 * 4 * u * (1 - u); theta = lerp(thetaAt(2), thetaAt(3), u); }
      else if (k === 3) { s = lerp(stops[3], stops[4], ease(u)); z = 0; theta = lerp(thetaAt(3), 0, ease3(u)); }
      else { s = 1; z = 0; theta = 0.32 * Math.exp(-u * 4.2) * Math.sin(u * Math.PI * 4.5) * (1 - u); }
    }
    const x = lerp(o.sx, o.ex, s), y = lerp(o.sy, o.ey, s);
    // resting on an edge lifts the centre: a cube tipped by phi stands at h * (cos phi + sin |phi|)
    const ph = ((theta % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2), fold = ph > Math.PI / 4 ? ph - Math.PI / 2 : ph;
    const lift = half * (Math.cos(fold) + Math.sin(Math.abs(fold)) - 1);
    const air = t < ti[1] ? 1 - seg(t, ti[0], ti[1]) : 0;
    const R = mm(Rz(T.yaw + T.yawSpin * (1 - seg(t, ti[0], ti[4])) * (1 - seg(t, ti[0], ti[4]))), mm(Raxis(T.axis, theta), mm(Raxis(T.wob, air * 2.2), o.R0 || ALIGN[o.val] || I3)));
    return { x, y, z: z + lift, R, moving: t > ti[0] && t < ti[4], speed: t > ti[0] && t < ti[1] ? 1 : 0 };
  }

  function pipTex(face, pipCol, base, k) {
    k = k || 0.5;
    return (ax, sg, u, v) => {
      const val = face ? face(ax, sg) : FACEVAL[ax + "," + sg];
      for (const [pu, pv] of PIPS[val]) {
        const du = (u - 0.5) - pu * 0.27, dv = (v - 0.5) - pv * 0.27;
        if (du * du + dv * dv < 0.0115 * k * 2) return pipCol;
      }
      return base && (u < 0.09 || v < 0.09 || u > 0.91 || v > 0.91) ? base : null;
    };
  }

  function dieDraw(S, st, size, look, light) {
    const h = size / 2;
    S.drop(st.x, st.y, st.z + h, h * 1.05, look.shadowF || 0.5, light);
    S.box([st.x, st.y, st.z + h], [h, h, h], st.R, look.col, { tex: look.tex, outline: look.outline, edgeCol: look.edge });
  }

  // dust kicked up where something lands: a few specks thrown outward, fading
  function dust(S, x, y, t0, t, col, n) {
    const u = (t - t0) / 0.35;
    if (u < 0 || u > 1) return;
    const p = S.P(x, y, 0), r = rng(Math.floor(x * 31 + y * 17 + t0 * 100));
    for (let i = 0; i < (n || 5); i++) {
      const a = r() * Math.PI * 2, d = 3 + r() * 5;
      const px = p[0] + Math.cos(a) * d * ease(u), py = p[1] + Math.sin(a) * d * 0.5 * ease(u) - 2 * Math.sin(u * Math.PI);
      if (r() > u) S.b.px(px, py, col);
    }
  }

  // ---------- tables: a lamp-lit table with real depth (edge, apron, legs, floor shadow) ----------
  function table(S, o) {
    const { hw, hd } = o, T = o.T || 14, floorZ = o.floorZ || -64, b = S.b;
    if (o.floor) S.plane([[-400, 400, floorZ], [400, 400, floorZ], [400, -400, floorZ], [-400, -400, floorZ]], 2, floorZ, o.floor);
    S.drop(0, 0, floorZ + 2, Math.max(hw, hd) * 0.9, 0.6, null, floorZ);
    const legc = o.leg || sc(o.apron, 0.8);
    for (const sx of [-1, 1]) {
      const lx = sx * (hw - 8);
      S.box([lx, -hd + 8, (floorZ - T) / 2], [3.5, 3.5, (-T - floorZ) / 2], I3, legc, { outline: sc(legc, 0.45) });
    }
    if (o.shape) o.shape(S);
    else {
      S.plane([[-hw, -hd, 0], [hw, -hd, 0], [hw, -hd, -T], [-hw, -hd, -T]], 1, -hd, (x, y, z) => o.apronFn ? o.apronFn(x, z) : o.apron);
      S.plane([[-hw, -hd, 0], [hw, -hd, 0], [hw, hd, 0], [-hw, hd, 0]], 2, 0, (x, y) => o.top(x, y));
      const a = S.P(-hw, -hd, 0), c = S.P(hw, -hd, 0);
      b.line(a[0], a[1], c[0], c[1], o.lip || S.shade(o.top(0, -hd + 1), 1.3));
      const a2 = S.P(-hw, -hd, -T), c2 = S.P(hw, -hd, -T);
      b.line(a2[0], a2[1], c2[0], c2[1], sc(o.apron, 0.45));
    }
  }

  // what a round paid: + won, - lost, 0 the stake came back (older records carry no net: even money, a cheat paid double)
  function rnet(rd) {
    if (rd.net !== undefined) return rd.net;
    const k = rd.cheat ? 2 : 1;
    return rd.won ? rd.stake * k : -rd.stake * k;
  }
  // the stake slip tacked to the apron: who bet what, and once settled, how it went
  function slip(S, rec, rd, done, o) {
    o = o || {};
    const b = S.b, lines = [];
    const name = (rec.name || "A hero").toUpperCase();
    lines.push([o.first || `${name}: ${money(rd.stake)}`, [60, 40, 26]]);
    if (done > 0) {
      const n = rnet(rd);
      const when = rec.where === "day" ? "TODAY" : "NIGHT";
      const night = rec.net === undefined ? "" : rec.net === 0 ? `${when}: EVEN` : `${when} ${rec.net > 0 ? "+" : "-"}${money(rec.net)}`;
      lines.push([n > 0 ? `WINS ${money(n)}` : n < 0 ? `LOSES ${money(-n)}` : "STAKE BACK", n > 0 ? [40, 110, 50] : n < 0 ? [150, 40, 30] : [96, 76, 56]]);
      if (night) lines.push([night, [96, 76, 56]]);
    }
    const w = Math.max(...lines.map((l) => textWidth(l[0]))) + 8, hgt = lines.length * 7 + 4;
    const x = o.x === undefined ? Math.round(W / 2 - w / 2) : o.x, y = o.y === undefined ? H - hgt - 3 : o.y;
    const paper = o.paper || [226, 208, 166];
    b.rect(x + 1, y + 1, w, hgt, [20, 14, 10], true);
    b.rect(x, y, w, hgt, paper, true);
    for (let i = 0; i < w; i += 3) b.px(x + i, y + hgt - 1, sc(paper, 0.86), true);
    b.rect(x + Math.floor(w / 2) - 1, y - 1, 2, 2, [120, 120, 126], true);
    lines.forEach((l, i) => text(b, l[0], x + 4, y + 3 + i * 7, l[1]));
    return { x, y, w, h: hgt };
  }
  // a stamped word across the scene: LIAR!, CAUGHT!, PHOTO!
  function stamp(b, s, x, y, col, t, k) {
    if (t <= 0) return;
    k = k || 2;
    const pop = t < 0.12 ? 1 + (0.12 - t) * 4 : 1;
    const kk = Math.max(1, Math.round(k * pop));
    text(b, s, x, y - Math.round((kk - k) * 2.5), col, { k: kk, center: true, outline: [24, 14, 10] });
  }

  // ---------- the scenes ----------
  const SCENES = {};

  // ===== the dice tables: one staging (a lamp-lit table at about 70 degrees), each town with its own dice, top and light =====
  function spots(r, cx, cy, n, sx, sy, gap) {
    const out = [];
    for (let i = 0; i < n; i++) {
      let best = null;
      for (let k = 0; k < 40; k++) {
        const p = [cx + (r() - 0.5) * sx * 2, cy + (r() - 0.5) * sy * 2];
        const d = Math.min(99, ...out.map((q) => Math.hypot(q[0] - p[0], (q[1] - p[1]) * 1.1)));
        if (!best || d > best.d) best = { p, d };
        if (d > gap) break;
      }
      out.push(best.p);
    }
    return out.sort((a, b) => a[0] - b[0]);
  }
  // the stake and the house's matching pile; when the round settles, coins hop from loser to winner
  function piles(p, rd, hero, house) {
    const n = rnet(rd), kinds = coinsFor(Math.max(rd.stake, -n));
    return { hero, house, kinds, houseKinds: coinsFor(Math.max(rd.stake, n)).concat(["s", "s", "g"]).slice(-12), won: n > 0, push: n === 0 };
  }
  function drawPiles(S, pl, t, tEnd, lamp, items) {
    const moving = pl.push ? 0 : Math.min(pl.kinds.length, 8), step = 0.07;
    const from = pl.won ? pl.house : pl.hero, to = pl.won ? pl.hero : pl.house;
    const left = (base) => base.length - (t > tEnd ? moving : 0);
    const heroBase = pl.kinds, houseBase = pl.houseKinds;
    items.push({ y: pl.hero[1], draw: () => {
      const keep = pl.won ? heroBase.length : left(heroBase);
      S.drop(pl.hero[0], pl.hero[1], 2, 4.4, 0.6, lamp);
      S.stack(pl.hero[0], pl.hero[1], heroBase.slice(0, Math.max(0, keep)));
      if (pl.won) for (let i = 0; i < moving; i++) if (t > tEnd + i * step + 0.3) S.coin(pl.hero[0] + 5 + (i % 3) * 1.5 - 1.5, pl.hero[1] + 1 - (i % 2) * 2, Math.floor(i / 3) * 1.15, houseBase[i % houseBase.length]);
    } });
    items.push({ y: pl.house[1], draw: () => {
      const keep = pl.won ? left(houseBase) : houseBase.length;
      S.drop(pl.house[0], pl.house[1], 2, 4.4, 0.6, lamp);
      S.stack(pl.house[0], pl.house[1], houseBase.slice(0, Math.max(0, keep)));
      if (!pl.won) for (let i = 0; i < moving; i++) if (t > tEnd + i * step + 0.3) S.coin(pl.house[0] + 5 + (i % 3) * 1.5 - 1.5, pl.house[1] + 1 - (i % 2) * 2, Math.floor(i / 3) * 1.15, heroBase[heroBase.length - 1 - i] || "s");
    } });
    if (t > tEnd) for (let i = 0; i < moving; i++) {
      const u = seg(t, tEnd + i * step, tEnd + i * step + 0.3);
      if (u <= 0 || u >= 1) continue;
      const x = lerp(from[0], to[0] + 5, ease(u)), y = lerp(from[1], to[1], ease(u)), z = Math.sin(u * Math.PI) * 9;
      const k = (pl.won ? houseBase[i % houseBase.length] : heroBase[heroBase.length - 1 - i]) || "s";
      items.push({ y, draw: () => { S.drop(x, y, z, 3.6, 0.65, lamp); S.coin(x, y, z, k, Raxis([1, 0.3, 0], u * 6)); } });
    }
  }
  function coinEvents(ev, pl, tEnd) {
    const n = pl.push ? 0 : Math.min(pl.kinds.length, 8);
    for (let i = 0; i < n; i++) ev.push([tEnd + i * 0.07 + 0.3, "coin", 0.8 - i * 0.05]);
  }
  function paintItems(items) { items.sort((a, b) => b.y - a.y).forEach((it) => it.draw()); }
  function dieItems(S, list, t, lamp, items) {
    for (const d of list) {
      if (t < d.T.ti[0] - 0.02) continue;
      const st = tumbleAt(d.T, t, d.half || d.size / 2);
      d.st = st;
      items.push({ y: st.y, draw: () => {
        (d.drawFn || dieDraw)(S, st, d.size, d.look, lamp);
        if (d.dustCol) dust(S, st.x, st.y, d.T.ti[1], t, d.dustCol, 4);
      } });
    }
  }
  // a gold ring round a die that counts, and a number over it
  function ringDie(S, d, t, t0, n, col) {
    if (t < t0 || !d.st) return;
    const st = d.st, c = S.P(st.x, st.y, d.size * 0.6), b = S.b, r = d.size * S.cam.scale(st.x, st.y, 0) * 0.62;
    const pulse = t - t0 < 0.18 ? 1.25 : 1;
    b.ell(c[0], c[1] + 1, r + 2, r * 0.95 + 1.5, (nx, ny, x, y) => { if (nx * nx + ny * ny > 0.74) b.px(x, y, sc(col, pulse), true); });
    if (n !== undefined) text(b, String(n), c[0] - 1, c[1] - r - 9, [255, 236, 170], { outline: [40, 24, 10] });
  }
  function slate(b, x, y, w, h, frame) {
    b.rect(x + 1, y + 1, w, h, [10, 8, 6], true);
    b.rect(x, y, w, h, frame || [96, 66, 40], true);
    b.rect(x + 1, y + 1, w - 2, h - 2, [38, 42, 40], true);
  }
  function dieIcon(b, x, y, v, col, pip) {
    b.rect(x, y, 9, 9, col, true);
    b.rect(x, y + 8, 9, 1, sc(col, 0.7), true);
    for (const [pu, pv] of PIPS[v]) b.rect(x + 4 + pu * 3, y + 4 + pv * 3, 1, 1, pip, true);
  }
  function verdict(b, rd, t, tEnd, win, lose, y, x) {
    if (t < tEnd) return;
    const push = !rd.caught && !rd.won && rnet(rd) === 0;
    const word = rd.caught ? "CAUGHT!" : rd.won ? win : push ? "STAKE BACK" : lose;
    x = x === undefined ? W / 2 : x;
    stamp(b, word, x, y === undefined ? 6 : y, rd.caught ? [236, 70, 50] : rd.won ? [252, 216, 112] : push ? [214, 200, 160] : [226, 112, 84], t - tEnd);
    if (rd.cheat && !rd.caught && t > tEnd + 0.6) text(b, "...AND NOBODY SAW", x, (y === undefined ? 6 : y) + 13, [200, 190, 160], { center: true, outline: [20, 14, 10] });
  }
  const DICE_CAM = { pitch: 68, dist: 420, focal: 420 * 1.22, target: [0, 2, 0], cy: 54 };

  function oakTop(n, base) {
    return (x, y) => {
      const pl = Math.floor((y + 60) / 10), py = (y + 60) % 10, off = pl * 37.3;
      const grain = n(x * 0.05 + off, py * 0.4) * 0.55 + n(x * 0.18 + off, py * 1.1 + pl) * 0.25;
      let f = 0.74 + grain * 0.4 + ((pl * 5) % 3) * 0.035;
      if (py < 0.9) f *= 0.48;
      if (py > 9.1) f *= 0.84;
      const kx = (pl * 53) % 120 - 60;
      if (Math.hypot((x - kx) * 0.45, py - 5) < 1.5) f *= 0.6;
      return sc(base, f);
    };
  }
  function boards(n, base, w) {
    return (x, y) => { const pl = Math.floor((y + 400) / (w || 14)), py = (y + 400) % (w || 14); return sc(base, 0.82 + ((pl * 7) % 3) * 0.05 + n(x * 0.04, pl * 3.1) * 0.22 - (py < 1.3 ? 0.3 : 0)); };
  }

  // ----- Saltmarrow: Liar's Dice on dark oak; both cups tip and spill, the table calls the hero a liar, the dice are counted -----
  SCENES.liars_dice = {
    plan(rec, rd, r) {
      const show = rd.show || {}, mine = (show.mine || [3, 5, 2, 5, 6]).slice(0, 5), theirs = (show.theirs || [5, 1, 4, 5, 2]).slice(0, 5);
      const bid = show.bid || [3, 5], face = bid[1], heroCalls = show.called_by === "hero";
      const look = { col: [238, 228, 206], tex: pipTex(null, [34, 22, 16]), outline: [48, 30, 20] };
      const dice = [];
      const ms = spots(r, 0, -12, 5, 40, 9, 16), ts = spots(r, 0, 15, 5, 40, 8, 16);
      const launch = (s, i, t0, x0, y0, v) => tumble(r, { t0: t0 + i * 0.075 + r() * 0.04, sx: x0, sy: y0 + (i - 2) * 2.5, sz: 4 + r() * 12, ex: s[0], ey: s[1], val: v, air: 0.32 + r() * 0.16, h1: 6 + r() * 6, flips: 2 });
      mine.forEach((v, i) => dice.push({ v, size: 12, look, dustCol: [120, 90, 64], T: launch(ms[4 - i], i, 0.46, 40, -14, v) }));
      theirs.forEach((v, i) => dice.push({ v, size: 12, look, dustCol: [120, 90, 64], T: launch(ts[i], i, 1.36, -42, 18, v) }));
      const counted = dice.filter((d) => d.v === face);
      const tBid = 2.7, tLiar = 3.25, tCount = 3.85, step = 0.3, tEnd = tCount + counted.length * step + 0.4;
      const ev = [[0.18, "leather"], [0.48, "spill"], [1.1, "leather"], [1.38, "spill"], [tBid, "chalk"], [tLiar, "slam"]];
      for (const d of dice) { d.T.impacts.forEach((t, k) => ev.push([t, "clack", [0.9, 0.5, 0.3][k] * (0.7 + r() * 0.3)])); ev.push([d.T.ti[3] + 0.06, "rattle", 0.3]); }
      counted.forEach((d, i) => ev.push([tCount + i * step, "tick", i / 5]));
      ev.push([tEnd, rd.won ? "winCoins" : "lose"]);
      const pl = piles(null, rd, [-40, -24], [40, 24]);
      coinEvents(ev, pl, tEnd);
      return { dice, face, bid, heroCalls, counted, tBid, tLiar, tCount, step, tEnd, pl, dur: tEnd + 1.1, ev, cam: new Cam(DICE_CAM) };
    },
    base(p) {
      const S = new Scene(p.cam, { key: [-0.5, -0.1, 0.86], lo: [0.9, 0.78, 0.7] });
      const n = vnoise(11);
      S.b.fill([12, 9, 7]);
      table(S, { hw: 70, hd: 34, T: 12, floor: boards(n, [66, 48, 34]), apron: [56, 33, 21],
        apronFn: (x, z) => sc([60, 36, 23], 0.84 + n(x * 0.2, z * 0.6) * 0.24 - (z < -5.5 && z > -6.8 ? 0.22 : 0)),
        top: oakTop(n, [80, 49, 30]) });
      S.drop(56, 22, 6, 7, 0.55, [-60, 60, 70]);
      S.cyl([56, 22, 0], 5.5, 12, [118, 76, 42], { capCol: [236, 220, 180], rim: [80, 52, 30] });
      S.stack(-58, 20, ["s", "c"]);
      return S;
    },
    draw(S, p, rec, rd, t) {
      const lamp = [-50, 50, 80], items = [];
      // cups lie mouth-down, then tip toward the middle so the dice spill out of the mouth
      const cup = (x, y, side, t0, col) => {
        const tip = smooth(seg(t, t0, t0 + 0.34)), bump = t > t0 + 0.34 ? Math.max(0, 1 - (t - t0 - 0.34) * 8) * Math.sin((t - t0 - 0.34) * 40) * 0.08 : 0;
        const R = Ry(side * (tip * 1.57 + bump)), cx = x - side * tip * 3, ax = mv(R, [0, 0, 1]);
        items.push({ y, draw: () => {
          S.drop(cx + side * tip * 7, y, 6, 8.5, 0.5, lamp);
          const c = [cx, y, tip * 7.5], open = tip > 0.45;
          S.cyl(c, 8, 2.4, [176, 132, 82], { R, capCol: open ? [16, 10, 6] : [150, 110, 70], rim: [70, 44, 24] });
          S.cyl(c, 7.5, 15, col, { R, side: col, capCol: open ? [18, 11, 7] : sc(col, 0.95), rim: sc(col, 0.55) });
          S.cyl([c[0] + ax[0] * 11.5, c[1], c[2] + ax[2] * 11.5], 7.8, 1.6, sc(col, 0.72), { R, capCol: open ? sc(col, 0.72) : sc(col, 0.95) });
        } });
      };
      cup(50, -14, 1, 0.14, [120, 72, 40]);
      cup(-52, 17, -1, 1.04, [92, 58, 36]);
      drawPiles(S, p.pl, t, p.tEnd, lamp, items);
      dieItems(S, p.dice, t, lamp, items);
      paintItems(items);
      if (t > p.tCount) for (const d of p.dice) if (d.v !== p.face && d.st) { const c = S.P(d.st.x, d.st.y, 6); S.b.shadow(c[0], c[1], 9, 9, 0.62, 0.2); }
    },
    after(S, p, rec, rd, t) {
      const b = S.b;
      p.counted.forEach((d, i) => ringDie(S, d, t, p.tCount + i * p.step, i + 1, [255, 206, 96]));
      if (t > p.tBid) {
        const who = p.heroCalls ? "THE TABLE BIDS" : `${(rec.name || "").toUpperCase().slice(0, 9)} BIDS`;
        slate(b, 4, 4, Math.max(44, textWidth(who) + 7), 19);
        text(b, who, 7, 6, [190, 196, 184]);
        text(b, `${p.bid[0]} x`, 8, 13, [240, 242, 232]);
        dieIcon(b, 22, 12, p.face, [236, 228, 208], [30, 20, 16]);
        if (t > p.tCount) text(b, `${Math.min(p.counted.length, Math.floor((t - p.tCount) / p.step) + 1)}`, 38, 13, [255, 214, 110]);
      }
      if (t > p.tLiar && t < p.tEnd) stamp(b, p.heroCalls ? `${(rec.name || "").toUpperCase().slice(0, 9)}: LIAR!` : "LIAR!", 124, 6, [240, 92, 60], t - p.tLiar);
      verdict(b, rd, t, p.tEnd, p.heroCalls ? "LIAR INDEED" : "IT STANDS!", p.heroCalls ? "IT STANDS!" : "LIAR INDEED", 6, 124);
      slip(S, rec, rd, t - p.tEnd);
    },
    lamps(p, t) {
      const fl = 1 + Math.sin(t * 13) * 0.025 + Math.sin(t * 5.3) * 0.03;
      return { amb: [0.17, 0.15, 0.14], lamps: [{ x: 70, y: 30, r: 150 * fl, i: 1.25, c: [1.1, 0.86, 0.58], p: 1.3 }], glows: [] };
    },
  };

  // ----- Ironhaven: Crown and Anchor on a printed felt board with a brass rim; the winning square lights up -----
  const EMBLEMS = ["crown", "anchor", "heart", "diamond", "spade", "club"];
  const EMB = {
    crown: ["#..#..#", "##.#.##", "#######", "#.#.#.#", "#######", "......."],
    anchor: ["...#...", "..#.#..", "...#...", ".#####.", "...#...", "#..#..#", ".#####."],
    heart: [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."],
    diamond: ["...#...", "..###..", ".#####.", "#######", ".#####.", "..###..", "...#..."],
    spade: ["...#...", "..###..", ".#####.", "#######", "#######", ".#.#.#.", "..###.."],
    club: ["..###..", "..###..", "##.#.##", "#######", "##.#.##", "...#...", "..###.."],
  };
  const EMBCOL = { crown: [214, 158, 34], anchor: [36, 62, 120], heart: [196, 36, 36], diamond: [204, 54, 40], spade: [26, 26, 30], club: [26, 54, 34] };
  // die faces in the die's own frame: +z crown, -z anchor, +x heart, -x diamond, +y spade, -y club
  const EMBFACE = { "2,1": "crown", "2,-1": "anchor", "0,1": "heart", "0,-1": "diamond", "1,1": "spade", "1,-1": "club" };
  const EMBALIGN = { crown: I3, anchor: Rx(Math.PI), heart: Ry(-Math.PI / 2), diamond: Ry(Math.PI / 2), spade: Rx(Math.PI / 2), club: Rx(-Math.PI / 2) };
  function embTex(base) {
    return (ax, sg, u, v) => {
      const e = EMBFACE[ax + "," + sg], rows = EMB[e], n = rows.length;
      const gx = Math.floor((u - 0.12) / 0.76 * 7), gy = Math.floor((v - 0.12) / 0.76 * n);
      if (gx >= 0 && gx < 7 && gy >= 0 && gy < n && rows[n - 1 - gy][gx] === "#") return EMBCOL[e];
      return u < 0.07 || v < 0.07 || u > 0.93 || v > 0.93 ? base : null;
    };
  }
  function emblem(b, e, x, y, col, k) {
    const rows = EMB[e];
    k = k || 1;
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === "#") b.rect(x + i * k, y + j * k, k, k, col || EMBCOL[e], true); });
  }
  SCENES.crown_anchor = {
    plan(rec, rd, r) {
      const show = rd.show || {}, pick = show.pick || "crown", faces = (show.dice || ["anchor", "heart", "crown"]).slice(0, 3);
      const look = { col: [240, 234, 218], tex: embTex([210, 200, 180]), outline: [60, 46, 30] };
      const rest = spots(r, 0, 2, 3, 34, 10, 24);
      const dice = faces.map((e, i) => ({ v: e, size: 14, look, T: tumble(r, { t0: 1.05 + i * 0.12, sx: -20 + i * 22 + (r() - 0.5) * 8, sy: 70, sz: 60 + r() * 20, ex: rest[i][0], ey: rest[i][1], R0: EMBALIGN[e], air: 0.62, h1: 12, flips: 3 }) }));
      const matches = dice.filter((d) => d.v === pick);
      const tEnd = Math.max(...dice.map((d) => d.T.end)) + 0.5, tLight = tEnd - 0.15;
      const ev = [[0.3, "coin", 0.7], [0.42, "coin", 0.6], [0.55, "coin", 0.5], [0.95, "whoosh"]];
      for (const d of dice) { d.T.impacts.forEach((t, k) => ev.push([t, "clack", [1, 0.6, 0.35][k]])); ev.push([d.T.ti[3] + 0.05, "rattle", 0.35]); }
      matches.forEach((d, i) => ev.push([tLight + i * 0.25, "chime", i]));
      ev.push([tEnd, rd.won ? "winCoins" : "lose"]);
      const sq = EMBLEMS.indexOf(pick), heroAt = [-45 + 15 + (sq % 3) * 30 - 9, (sq < 3 ? 10.5 : -12.5) - 4];
      const pl = piles(null, rd, heroAt, [52, 26]);
      coinEvents(ev, pl, tEnd);
      return { dice, pick, matches, tEnd, tLight, pl, dur: tEnd + 1.1, ev, cam: new Cam(DICE_CAM) };
    },
    base(p) {
      const S = new Scene(p.cam, { key: [-0.3, -0.3, 0.9], lo: [0.86, 0.84, 0.78] });
      const n = vnoise(23);
      S.b.fill([14, 11, 9]);
      table(S, { hw: 70, hd: 34, T: 12, floor: boards(n, [74, 58, 44], 12), apron: [80, 50, 28],
        apronFn: (x, z) => sc([84, 52, 30], 0.86 + n(x * 0.2, z * 0.5) * 0.2 - (z < -5 && z > -6.2 ? 0.25 : 0) + (z > -1.2 ? 0.2 : 0)),
        top: (x, y) => { const f = 0.86 + n(x * 0.5, y * 0.5) * 0.18; return sc([46, 98, 62], f); } });
      const brass = [196, 150, 64];
      S.box([0, 33, 1.5], [70, 1.6, 1.5], I3, brass, { outline: [92, 64, 24] });
      S.box([-68.4, 0, 1.5], [1.6, 34, 1.5], I3, brass, { outline: [92, 64, 24] });
      S.box([68.4, 0, 1.5], [1.6, 34, 1.5], I3, brass, { outline: [92, 64, 24] });
      S.box([0, -33, 1.5], [70, 1.6, 1.5], I3, brass, { outline: [92, 64, 24] });
      // the printed board: six squares of emblems, ink-ruled
      const bx0 = -45, by0 = -24, bw = 90, bh = 46;
      S.plane([[bx0, by0, 0.2], [bx0 + bw, by0, 0.2], [bx0 + bw, by0 + bh, 0.2], [bx0, by0 + bh, 0.2]], 2, 0.2, (x, y) => {
        const u = x - bx0, v = y - by0;
        if (u < 1.5 || v < 1.5 || u > bw - 1.5 || v > bh - 1.5) return [112, 34, 26];
        if (Math.abs(u - bw / 3) < 0.7 || Math.abs(u - bw * 2 / 3) < 0.7 || Math.abs(v - bh / 2) < 0.7) return [120, 80, 44];
        if (u < 3 || v < 3 || u > bw - 3 || v > bh - 3) return [226, 196, 120];
        return sc([234, 218, 178], 0.94 + n(x, y) * 0.1);
      });
      p.squares = EMBLEMS.map((e, i) => { const cx = bx0 + bw / 6 + (i % 3) * bw / 3, cy = by0 + (i < 3 ? bh * 0.75 : bh * 0.25); return { e, cx, cy, hw: bw / 6, hh: bh / 4, s: S.P(cx, cy, 0.2) }; });
      for (const q of p.squares) emblem(S.b, q.e, Math.round(q.s[0] - 7), Math.round(q.s[1] - 7), null, 2);
      S.b.e.fill(0);
      // the clerk's ledger and inkpot
      S.box([-52, 18, 1.6], [10, 7, 1.6], Rz(0.15), [236, 226, 200], { outline: [90, 70, 50] });
      S.line3([-52 + 1.5, 11, 3.3], [-52 - 0.4, 25, 3.3], [130, 110, 90]);
      S.cyl([-58, -22, 0], 2.6, 4, [30, 30, 36], { capCol: [16, 16, 20] });
      return S;
    },
    draw(S, p, rec, rd, t) {
      const lamp = [0, 30, 110], items = [];
      // the stake slides out from the near rail onto its square before the throw
      const u = ease3(seg(t, 0.15, 0.75)), home = p.pl.hero;
      p.pl.hero = [lerp(home[0] - 6, home[0], u), lerp(-40, home[1], u)];
      drawPiles(S, p.pl, t, p.tEnd, lamp, items);
      p.pl.hero = home;
      dieItems(S, p.dice, t, lamp, items);
      paintItems(items);
    },
    after(S, p, rec, rd, t) {
      const b = S.b, q = p.squares.find((s) => s.e === p.pick);
      if (q && t > p.tLight && p.matches.length) {
        const on = (t - p.tLight) % 0.5 < 0.36 || t > p.tLight + 1.5;
        const c00 = S.P(q.cx - q.hw + 1, q.cy - q.hh + 1, 0.3), c11 = S.P(q.cx + q.hw - 1, q.cy + q.hh - 1, 0.3);
        if (on) for (let x = Math.round(c00[0]); x <= Math.round(c11[0]); x++) for (const y of [Math.round(c11[1]), Math.round(c00[1])]) b.px(x, y, [255, 230, 120], true);
        if (on) for (let y = Math.round(c11[1]); y <= Math.round(c00[1]); y++) for (const x of [Math.round(c00[0]), Math.round(c11[0])]) b.px(x, y, [255, 230, 120], true);
        glow(b, q.s[0], q.s[1], 26, [255, 220, 120], on ? 0.4 : 0.25);
        p.matches.forEach((d, i) => ringDie(S, d, t, p.tLight + i * 0.25, undefined, [255, 220, 110]));
      }
      if (t > 0.1) {
        slate(b, 4, 4, 42, 19, [150, 112, 50]);
        text(b, "STAKED ON", 7, 6, [200, 204, 190]);
        emblem(b, p.pick, 21, 12, [240, 236, 220]);
      }
      verdict(b, rd, t, p.tEnd, p.matches.length > 1 ? `${p.matches.length} ${p.pick.toUpperCase()}S!` : `${p.pick.toUpperCase()}!`, "NO MATCH", 6, 118);
      slip(S, rec, rd, t - p.tEnd);
    },
    lamps(p, t) {
      const fl = 1 + Math.sin(t * 7) * 0.015;
      return { amb: [0.24, 0.22, 0.2], lamps: [{ x: 96, y: 40, r: 140 * fl, i: 1.15, c: [1.05, 0.92, 0.7], p: 1.2 }], glows: [] };
    },
  };

  // ----- Frosthold: knucklebones on frosty pine; window light from the left, the hearth from the right -----
  const BONEFACE = { "2,1": 6, "1,1": 4, "2,-1": 1, "1,-1": 3 };
  const BONEALIGN = { 6: I3, 4: Rx(Math.PI / 2), 1: Rx(Math.PI), 3: Rx(-Math.PI / 2) };
  const BONEPIPS = { 1: [[0, 0]], 3: [[-1, 0], [0, 0], [1, 0]], 4: [[-0.5, -0.6], [0.5, -0.6], [-0.5, 0.6], [0.5, 0.6]], 6: [[-1, -0.6], [0, -0.6], [1, -0.6], [-1, 0.6], [0, 0.6], [1, 0.6]] };
  // a knucklebone: a waisted shaft between two knuckles, its marks carved into the shaft's four long sides
  function boneDraw(S, st, size, look, lamp) {
    const R = st.R, kh = size * 0.28, c = [st.x, st.y, st.z + kh];
    S.drop(st.x, st.y, st.z + kh, size * 0.62, 0.55, lamp);
    const col = look.col;
    const tex = (ax, sg, u, v) => {
      const val = BONEFACE[ax + "," + sg];
      if (!val) return null;
      for (const [pu, pv] of BONEPIPS[val]) { const du = u - 0.5 - pu * 0.24, dv = v - 0.5 - pv * 0.26; if (du * du + dv * dv * 0.5 < 0.011) return look.pip; }
      return null;
    };
    const ends = [-1, 1].map((sg) => { const e = mv(R, [sg * size * 0.33, 0, 0]); return { sg, c: [c[0] + e[0], c[1] + e[1], c[2] + e[2]] }; });
    ends.sort((a, b) => b.c[1] - a.c[1]);
    S.box(ends[0].c, [size * 0.15, kh, kh * 0.95], R, col, { outline: look.outline });
    S.box(c, [size * 0.3, kh * 0.62, kh * 0.6], R, sc(col, 0.97), { tex, outline: look.outline });
    S.box(ends[1].c, [size * 0.15, kh, kh * 0.95], R, col, { outline: look.outline });
  }
  SCENES.knucklebones = {
    plan(rec, rd, r) {
      const show = rd.show || {}, mine = (show.mine || [6, 4, 3, 6, 1]).slice(0, 5), house = (show.house || [3, 1, 4, 3, 6]).slice(0, 5);
      const look = { col: [236, 222, 190], pip: [92, 58, 36], outline: [88, 68, 48] };
      const hs = spots(r, -6, 15, 5, 40, 7, 20), ms = spots(r, 0, -13, 5, 40, 7, 20);
      const mk = (v, s, t0, from) => {
        const T = tumble(r, { t0, sx: from[0] + (r() - 0.5) * 10, sy: from[1] + (r() - 0.5) * 6, sz: from[2], ex: s[0], ey: s[1], R0: BONEALIGN[v], air: 0.5, h1: 10, flips: 2 });
        return { v, size: 17, half: 4.8, look, drawFn: boneDraw, T, dustCol: [236, 244, 250] };
      };
      const houseB = house.map((v, i) => mk(v, hs[i], 0.3 + i * 0.07, [-10, 80, 50]));
      const mineB = mine.map((v, i) => mk(v, ms[i], 2.1 + i * 0.07, [70, -50, 40]));
      const sum = (a) => a.reduce((x, y) => x + y, 0);
      const tHouse = Math.max(...houseB.map((d) => d.T.end)) + 0.1, tMine = Math.max(...mineB.map((d) => d.T.end)) + 0.1, tEnd = tMine + 0.7;
      const ev = [];
      for (const d of houseB.concat(mineB)) { d.T.impacts.forEach((t, k) => ev.push([t, "knock", [1, 0.6, 0.35][k]])); ev.push([d.T.ti[3] + 0.05, "rattle", 0.25]); }
      ev.push([tHouse, "chalk"], [tMine, "chalk"], [tEnd, rd.won ? "winCoins" : "lose"]);
      const pl = piles(null, rd, [-46, -22], [48, 24]);
      coinEvents(ev, pl, tEnd);
      return { bones: houseB.concat(mineB), houseB, mineB, sums: [sum(house), sum(mine)], tHouse, tMine, tEnd, pl, dur: tEnd + 1.1, ev, cam: new Cam(DICE_CAM) };
    },
    base(p) {
      const S = new Scene(p.cam, { key: [-0.7, 0.1, 0.7], lo: [0.8, 0.86, 0.96], hi: [1.0, 1.0, 1.04] });
      const n = vnoise(37), fr = vnoise(41);
      S.b.fill([10, 10, 12]);
      table(S, { hw: 70, hd: 34, T: 12, floor: (x, y) => { const k = Math.floor((x + 400) / 18) + Math.floor((y + 400) / 18); return sc([70, 68, 66], 0.78 + (k % 2) * 0.08 + n(x * 0.1, y * 0.1) * 0.2 - (((x + 400) % 18) < 1 || ((y + 400) % 18) < 1 ? 0.3 : 0)); },
        apron: [120, 96, 70], apronFn: (x, z) => sc([128, 102, 74], 0.84 + n(x * 0.25, z) * 0.2),
        top: (x, y) => {
          const pl = Math.floor((x + 70) / 14), px = (x + 70) % 14;
          let f = 0.8 + n(px * 0.4 + pl * 7, y * 0.06) * 0.3 + ((pl * 3) % 2) * 0.05;
          if (px < 0.9) f *= 0.55;
          const base = sc([178, 150, 112], f);
          // frost creeps in from the edges and the cracks between boards
          const edge = Math.min(70 - Math.abs(x), 34 - Math.abs(y), px * 3, (14 - px) * 3);
          const frost = clamp(1 - edge / 16 + (fr(x * 0.3, y * 0.3) - 0.5) * 0.9, 0, 1);
          return frost > 0.55 ? mixc(base, [226, 236, 242], 0.55 + (fr(x, y) > 0.6 ? 0.25 : 0)) : frost > 0.35 ? mixc(base, [210, 222, 230], 0.25) : base;
        } });
      // a horn cup of mead and a tallow stub on the near side
      S.drop(56, 18, 6, 6, 0.5, [-60, 0, 60]);
      S.cyl([56, 18, 0], 4.5, 11, [150, 120, 80], { capCol: [186, 130, 50], rim: [90, 70, 46] });
      return S;
    },
    draw(S, p, rec, rd, t) {
      const lamp = [-80, 10, 70], items = [];
      drawPiles(S, p.pl, t, p.tEnd, lamp, items);
      dieItems(S, p.bones, t, lamp, items);
      paintItems(items);
    },
    after(S, p, rec, rd, t) {
      const b = S.b, dn = (rec.dealer || "Old Gunnhild").split(" ").pop().toUpperCase();
      if (t > p.tHouse) {
        const y0 = H - 24;
        slate(b, 4, y0, 52, t > p.tMine ? 19 : 12, [110, 92, 70]);
        text(b, dn.slice(0, 9), 7, y0 + 3, [200, 206, 200]);
        text(b, String(p.sums[0]), 53 - textWidth(String(p.sums[0])), y0 + 3, [236, 240, 236]);
        if (t > p.tMine) { text(b, (rec.name || "").toUpperCase().slice(0, 9), 7, y0 + 10, [200, 206, 200]); text(b, String(p.sums[1]), 53 - textWidth(String(p.sums[1])), y0 + 10, [255, 226, 150]); }
      }
      if (t > p.tMine - 0.1) p.mineB.forEach((d, i) => ringDie(S, d, t, p.tMine + 0.02 * i, undefined, rd.won ? [255, 214, 110] : [170, 200, 230]));
      verdict(b, rd, t, p.tEnd, "HIGH BONES!", "THE HOUSE TAKES IT", 6);
      slip(S, rec, rd, t - p.tEnd);
    },
    lamps(p, t) {
      const fl = 1 + Math.sin(t * 9) * 0.05 + Math.sin(t * 3.1) * 0.05 + Math.sin(t * 23) * 0.02;
      return { amb: [0.22, 0.23, 0.28], lamps: [
        { kind: "win", x: 58, y: 54, w: 44, h: 32, skew: 0.35, i: 0.85, c: [0.66, 0.8, 1.0] },
        { x: 200, y: 100, r: 175 * fl, i: 1.15, c: [1.2, 0.7, 0.36], p: 1.25 }], glows: [[194, 120, 34 * fl, [255, 130, 50], 0.45]] };
    },
  };

  // ----- Ashfen: the Undertaker's Lots on a coffin lid in sickly candlelight; a lot from the urn, two bone dice with red pips -----
  SCENES.undertakers_lots = {
    plan(rec, rd, r) {
      const show = rd.show || {}, lot = show.lot || 7, roll = (show.roll || [3, 4]).slice(0, 2);
      const look = { col: [222, 210, 176], tex: pipTex(null, [168, 28, 22], null, 1.15), outline: [70, 56, 40] };
      const rest = [[-4 + r() * 6, -8 + r() * 4], [18 + r() * 6, -2 + r() * 4]];
      const dice = roll.map((v, i) => ({ v, size: 13, look, dustCol: [70, 80, 50], T: tumble(r, { t0: 2.0 + i * 0.1, sx: 90, sy: -18 + i * 8, sz: 30, ex: rest[i][0], ey: rest[i][1], val: v, air: 0.5, h1: 10, flips: 3 }) }));
      const tSum = Math.max(...dice.map((d) => d.T.end)) + 0.15, tEnd = tSum + 0.75;
      const ev = [[0.25, "lid"], [0.62, "whoosh"], [1.2, "knock", 0.8], [1.38, "knock", 0.4], [tSum, "tick", 0.5]];
      for (const d of dice) { d.T.impacts.forEach((t, k) => ev.push([t, "clack", [1, 0.55, 0.3][k]])); ev.push([d.T.ti[3] + 0.05, "rattle", 0.3]); }
      ev.push([tEnd, rd.caught ? "caught" : rd.won ? "winCoins" : "lose"]);
      const pl = piles(null, rd, [-30, -22], [44, 22]);
      coinEvents(ev, pl, tEnd);
      return { dice, lot, roll, sum: roll[0] + roll[1], tSum, tEnd, pl, dur: tEnd + 1.1, ev, cam: new Cam(DICE_CAM) };
    },
    base(p) {
      const S = new Scene(p.cam, { key: [-0.6, 0.3, 0.75], lo: [0.86, 0.9, 0.8], hi: [1.04, 1.06, 0.9] });
      const n = vnoise(53);
      S.b.fill([6, 8, 6]);
      // the coffin: a six-sided lid on trestles, its side deep where a table's apron would be
      const lid = [[-66, -12], [-46, -30], [62, -22], [70, 0], [62, 22], [-46, 30], [-66, 12]];
      S.plane([[-400, 400, -60], [400, 400, -60], [400, -400, -60], [-400, -400, -60]], 2, -60, (x, y) => {
        const k = (Math.floor((x + 400) / 26) + Math.floor((y + 400) / 20)) % 2;
        return sc([44, 46, 40], 0.78 + k * 0.08 + n(x * 0.08, y * 0.08) * 0.24 - (((x + 400) % 26) < 1.2 || ((y + 400) % 20) < 1.2 ? 0.35 : 0));
      });
      S.drop(0, 0, -58, 64, 0.5, null, -60);
      for (const sx of [-40, 40]) {
        S.box([sx, -18, -40], [2.5, 2.5, 20], I3, [60, 46, 34], { outline: [24, 18, 12] });
        S.box([sx, -18, -22], [3, 26, 2], I3, [66, 50, 36], { outline: [24, 18, 12] });
      }
      for (let i = 0; i < lid.length; i++) {
        const a = lid[i], c = lid[(i + 1) % lid.length], nn = norm([c[1] - a[1], -(c[0] - a[0]), 0]);
        if (!S.cam.facing([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, -9], nn)) continue;
        const col = S.lit([70, 50, 36], nn);
        S.b.poly([S.P(a[0], a[1], 0), S.P(c[0], c[1], 0), S.P(c[0], c[1], -18), S.P(a[0], a[1], -18)], null, false, (x, y) => sc(col, 0.85 + n(x * 0.3, y * 0.9) * 0.3 - (y % 6 === 0 ? 0.15 : 0)));
      }
      S.b.poly(lid.map((q) => S.P(q[0], q[1], 0)), null, false, (sx, sy) => {
        const w = S.cam.unproject(sx + 0.5, sy + 0.5, 2, 0), y = w[1], x = w[0];
        const pl = Math.floor((y + 30) / 10), py = (y + 30) % 10;
        let f = 0.8 + n(x * 0.06 + pl * 9, py * 0.4) * 0.35;
        if (py < 0.8) f *= 0.55;
        return sc([88, 62, 42], f);
      });
      for (let i = 0; i < lid.length; i++) { const a = S.P(lid[i][0], lid[i][1], 0), c = S.P(lid[(i + 1) % lid.length][0], lid[(i + 1) % lid.length][1], 0); S.b.line(a[0], a[1], c[0], c[1], [126, 96, 64]); }
      for (const hx of [-30, 0, 30]) { const a = S.P(hx - 4, -27.5, -6), c = S.P(hx + 4, -27.5, -6); S.b.line(a[0], a[1], c[0], c[1], [150, 140, 100]); S.b.px(a[0], a[1] - 1, [150, 140, 100]); S.b.px(c[0], c[1] - 1, [150, 140, 100]); }
      // the brass cross nailed to the lid, the urn, a skull pot and the candle
      S.box([-46, 0, 0.6], [14, 2, 0.6], I3, [150, 120, 60], { outline: [70, 50, 20] });
      S.box([-50, 0, 0.6], [2, 8, 0.6], I3, [150, 120, 60], { outline: [70, 50, 20] });
      return S;
    },
    draw(S, p, rec, rd, t) {
      const lamp = [-58, 16, 40], items = [], b = S.b;
      // the urn rocks, a bone lot hops out, flips and lands face up
      const rock = t > 0.2 && t < 0.7 ? Math.sin((t - 0.2) * 30) * 0.12 * (1 - (t - 0.2) * 2) : 0;
      items.push({ y: 22, draw: () => {
        S.drop(38, 22, 6, 8, 0.5, lamp);
        S.cyl([38, 22, 0], 7, 6, [74, 84, 70], { R: Ry(rock), side: [70, 80, 66] });
        S.cyl([38, 22, 6], 8.5, 7, [80, 92, 74], { R: Ry(rock), capCol: [12, 14, 10], rim: [120, 130, 100] });
      } });
      items.push({ y: 20, draw: () => {
        S.drop(-62, 20, 3, 5, 0.5, lamp);
        const c = S.P(-60, 22, 7);
        b.ell(c[0], c[1], 6, 5.5, (nx, ny, x, y) => {
          const f = 0.6 + 0.6 * clamp(-nx * 0.6 - ny * 0.5 + 0.3, 0, 1);
          let col = S.shade([206, 196, 160], f);
          if ((Math.hypot(nx + 0.38, ny + 0.05) < 0.22) || Math.hypot(nx - 0.38, ny + 0.05) < 0.22) col = [20, 18, 14];
          if (ny > 0.55 && Math.abs(nx) < 0.4 && x % 2 === 0) col = [40, 36, 28];
          b.px(x, y, col);
        });
      } });
      items.push({ y: 14, draw: () => {
        S.drop(-56, 14, 4, 3.5, 0.5);
        S.cyl([-56, 14, 0], 2.6, 9 - t * 0.12, [222, 214, 170], { capCol: [236, 228, 190] });
      } });
      const u = seg(t, 0.6, 1.25), lx = lerp(38, 6, ease(u)), ly = lerp(22, 12, u), lz = u <= 0 ? -10 : u < 1 ? 13 + Math.sin(u * Math.PI) * 26 - u * 12 : 0;
      const hop = seg(t, 1.25, 1.45), hz = Math.sin(hop * Math.PI) * 3;
      if (t > 0.6) items.push({ y: ly, draw: () => {
        S.drop(lx, ly, Math.max(0, lz + hz), 6, 0.55, lamp);
        const R = u < 1 ? Raxis([0.3, 1, 0], u * Math.PI * 4) : Raxis([0.3, 1, 0], hop * 0.4 * (1 - hop));
        S.box([lx, ly, Math.max(0, lz + hz) + 1.4], [8, 5.5, 1.4], R, [214, 200, 164], { outline: [60, 46, 30], tex: (ax, sg, uu, vv) => {
          if (ax !== 2 || sg !== 1) return null;
          const s = String(p.lot), gx = Math.floor(uu * 9), gy = Math.floor((1 - vv) * 7) - 1;
          const x0 = Math.floor(4.5 - textWidth(s) / 2);
          let cx = x0;
          for (const ch of s) { const g = glyph(ch); if (gx >= cx && gx < cx + g.w && gy >= 0 && gy < 5 && g.on(gx - Math.floor(cx), gy)) return [40, 20, 14]; cx += g.w + 1; }
          return null;
        } });
      } });
      drawPiles(S, p.pl, t, p.tEnd, lamp, items);
      dieItems(S, p.dice, t, lamp, items);
      paintItems(items);
      return {};
    },
    after(S, p, rec, rd, t) {
      const b = S.b, c = S.P(-56, 14, 9 - t * 0.12);
      flame(b, c[0], c[1], 1.1, t, [200, 230, 120]);
      if (t > 1.3) {
        slate(b, 4, 4, 30, 17, [70, 60, 50]);
        text(b, "LOT", 7, 6, [190, 196, 170]);
        text(b, String(p.lot), 7, 12, [230, 236, 200]);
      }
      if (t > p.tSum) {
        slate(b, W - 50, 4, 46, 17, [70, 60, 50]);
        text(b, "ROLLED", W - 47, 6, [190, 196, 170]);
        const off = Math.abs(p.sum - p.lot), near = off <= 1;
        text(b, `${p.roll[0]}+${p.roll[1]}=${p.sum}`, W - 47, 12, near ? [250, 230, 140] : [230, 236, 200]);
        p.dice.forEach((d) => ringDie(S, d, t, p.tSum, undefined, near ? [230, 220, 120] : off === 2 ? [190, 180, 140] : [150, 70, 60]));
      }
      verdict(b, rd, t, p.tEnd, Math.abs(p.sum - p.lot) === 0 ? "YOUR LOT! DOUBLE!" : "ONE AWAY!", "NOT YOUR LOT", 6, 92);
      slip(S, rec, rd, t - p.tEnd);
    },
    lamps(p, t) {
      const fl = 1 + Math.sin(t * 11) * 0.06 + Math.sin(t * 4.3) * 0.05 + (Math.sin(t * 31) > 0.9 ? -0.08 : 0);
      const c = p.cam.p(-56, 14, 10);
      return { amb: [0.13, 0.15, 0.11], lamps: [{ x: c[0], y: c[1], r: 175 * fl, i: 1.35, c: [0.9, 1.0, 0.55], p: 1.5 }], glows: [[c[0], c[1] - 3, 14 * fl, [190, 220, 110], 0.5]] };
    },
  };

  // a candle flame drawn on top of the lighting: outer, inner and a bright core, with a flicker
  function flame(b, x, y, k, t, tint, out) {
    if (out >= 1) return;
    const s = (k || 1) * (1 - (out || 0) * 0.7), fl = Math.sin(t * 17 + x) * 0.5 + Math.sin(t * 7.3 + y) * 0.5;
    const h = Math.max(2, Math.round(5 * s + fl * 0.8)), lean = Math.round(fl * 0.6);
    const outer = (out || 0) > 0.55 ? [110, 140, 255] : tint ? mixc([255, 170, 60], tint, 0.4) : [255, 170, 60];
    for (let j = 0; j < h; j++) {
      const w = j < h * 0.4 ? 1 : 0, yy = Math.round(y) - j, xx = Math.round(x) + (j > h * 0.6 ? lean : 0);
      for (let i = -w; i <= w; i++) b.px(xx + i, yy, outer, true);
      if (j < h * 0.6 && j > 0) b.px(xx, yy, [255, 246, 200], true);
    }
    b.px(Math.round(x), Math.round(y) + 1, [90, 60, 40], true);
  }

  // ===== Thornwall: pig racing, side-on lanes between hay bales, a mud puddle, coin stacks per lane, a photo finish =====
  const PIG = [
    "...........kk.....",
    "....ooooooookkko..",
    "..oohhhhhhhhhkkpo.",
    ".ohhppppppppppppo.",
    ".ohppppppppppppepo",
    "tohpppppppppppppnn",
    "t.ospppppppppppnno",
    "..osspppppppppsoo.",
    "...ossssssssssso..",
    "....ooooooooooo...",
  ];
  const PIGPAL = { o: [96, 46, 46], h: [255, 206, 196], p: [240, 160, 150], s: [206, 120, 116], k: [214, 108, 112], e: [24, 14, 14], n: [226, 120, 120], t: [228, 140, 136] };
  const MUDPAL = { o: [52, 34, 22], h: [150, 110, 72], p: [124, 88, 56], s: [96, 66, 42], k: [104, 70, 44], e: [20, 12, 8], n: [120, 84, 56], t: [116, 82, 52] };
  const LANECOL = [[200, 52, 42], [52, 96, 180], [236, 194, 56], [62, 146, 72], [238, 236, 228], [230, 124, 42]];
  function pigSprite(b, x, y, num, phase, pal, sash, o) {
    o = o || {};
    const bob = Math.round(Math.abs(Math.sin(phase)) * 1.4), x0 = Math.round(x) - 9, y0 = Math.round(y) - 13 - bob + (o.dip || 0);
    for (const [lx, ph] of [[4, 0], [6, Math.PI], [12, Math.PI * 0.5], [14, Math.PI * 1.5]]) {
      const sw = Math.round(Math.sin(phase + ph) * 1.6);
      b.rect(x0 + lx + sw, y0 + 9 + bob, 2, 3 - (o.dip ? 1 : 0), sc(pal.s, 0.85));
      b.rect(x0 + lx + sw, y0 + 11 + bob, 2, 1, pal.o);
    }
    PIG.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === ".") continue;
        const xx = o.flip ? x0 + 17 - i : x0 + i;
        let c = pal[ch];
        if (sash && i >= 6 && i <= 10 && ch !== "o" && ch !== "e" && j >= 2 && j <= 8) c = ch === "h" ? mixc(sash, [255, 255, 255], 0.25) : ch === "s" ? sc(sash, 0.8) : sash;
        b.px(xx, y0 + j, c);
      }
    });
    if (num !== undefined && sash) { const lum = sash[0] * 0.3 + sash[1] * 0.6 + sash[2] * 0.1; text(b, String(num), x0 + 7, y0 + 3, lum > 150 ? [40, 30, 24] : [250, 246, 236]); for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (b.e[(y0 + 3 + j) * W + x0 + 7 + i]) b.e[(y0 + 3 + j) * W + x0 + 7 + i] = 0; }
    if (o.splat) for (let k = 0; k < 6; k++) b.px(x0 + 3 + ((k * 5) % 12), y0 + 2 + ((k * 7) % 7), pal.o);
  }
  SCENES.pig_races = {
    plan(rec, rd, r) {
      const show = rd.show || {}, order = (show.order || [3, 1, 5, 2, 6, 4]).slice(0, 6), backed = show.backed || order[0];
      const tGate = 0.9, tWin = 4.7, startX = -86, finX = 64;
      const place = {};
      order.forEach((n, i) => (place[n] = i));
      const gaps = [0, 0.08, 0.32 + r() * 0.15, 0.6 + r() * 0.2, 0.85 + r() * 0.25, 1.15 + r() * 0.3];
      // the mud takes a pig from the back half, the hero's own if it lost badly enough to be funny
      const mud = place[backed] >= 2 ? backed : order[3 + Math.floor(r() * 3)];
      const pigs = [];
      for (let n = 1; n <= 6; n++) {
        const k = place[n], T = tWin + gaps[k];
        pigs.push({ n, lane: n - 1, T, amp: k === 0 ? -0.11 : k === 1 ? 0.06 : (r() - 0.3) * 0.2, wob: r() * 6, mud: n === mud, start: tGate + r() * 0.12 });
      }
      const mudX = -14 + r() * 10;
      const tPhoto = tWin, freeze = 0.85;
      const ev = [[0.1, "crowd"], [tGate - 0.05, "bell"], [tGate + 0.1, "oink"], [tGate + 0.5, "hooves"], [tGate + 1.6, "hooves"], [tGate + 2.7, "hooves"], [tPhoto, "flash"], [tPhoto + 0.05, "cheer"]];
      for (const pg of pigs) if (r() < 0.5) ev.push([tGate + 0.6 + r() * 3, "oink"]);
      const mp = pigs.find((q) => q.mud), tm = mp.start + (mp.T - mp.start) * ((mudX - startX - 10) / (finX - startX));
      ev.push([tm, "splat"], [tm + 0.12, "oink"]);
      const tEnd = tPhoto + freeze + 0.9;
      ev.push([tEnd, rd.won ? "winCoins" : "lose"]);
      return { pigs, order, backed, tGate, tWin, startX, finX, mudX, tPhoto, freeze, tEnd, dur: tEnd + 1.0, ev, place,
        cam: new Cam({ pitch: 60, dist: 420, focal: 420 * 0.97, target: [-6, 2, 0], cy: 70 }) };
    },
    laneY: (k) => 31 - k * 12.6,
    base(p, rec, rd) {
      const S = new Scene(p.cam, { key: [-0.4, -0.5, 0.78], lo: [0.86, 0.86, 0.8], ambF: 0.62, difF: 0.5 });
      const n = vnoise(71), gN = vnoise(73), L = SCENES.pig_races.laneY;
      S.b.fill([90, 120, 50]);
      S.plane([[-300, 300, 0], [300, 300, 0], [300, -300, 0], [-300, -300, 0]], 2, 0, (x, y) => {
        const g = gN(x * 0.08, y * 0.08), tuft = n(x * 0.7, y * 1.4) > 0.8;
        return sc([100, 136, 56], 0.88 + Math.floor(g * 4) * 0.05 + (tuft ? 0.1 : 0));
      });
      const y0 = L(5) - 6.5, y1 = L(0) + 6.5;
      S.plane([[-200, y0, 0.1], [200, y0, 0.1], [200, y1, 0.1], [-200, y1, 0.1]], 2, 0.1, (x, y) => {
        const rut = Math.abs(((y - y0) % 12.6) - 6.3) < 1.3 ? 0.92 : 1;
        return sc([156, 114, 74], (0.86 + Math.floor(n(x * 0.2, y * 0.3) * 4) * 0.06) * rut);
      });
      // the mud puddle in the unlucky lane, glossy where it catches the sky
      const mk = p.pigs.find((q) => q.mud).lane, my = L(mk);
      S.plane([[p.mudX - 12, my - 5, 0.2], [p.mudX + 14, my - 5, 0.2], [p.mudX + 14, my + 5, 0.2], [p.mudX - 12, my + 5, 0.2]], 2, 0.2, (x, y) => {
        const d = Math.hypot((x - p.mudX - 1) / 13, (y - my) / 4.6) + (n(x * 0.5, y) - 0.5) * 0.3;
        if (d > 1) return null;
        return d < 0.55 && n(x * 0.8, y * 2) > 0.62 ? [150, 160, 150] : sc([84, 58, 38], 0.9 + n(x, y) * 0.2);
      });
      // start chalk, finish tape posts, the chalk finish line
      for (const [x, col] of [[p.startX + 4, [236, 232, 220]], [p.finX, [250, 250, 244]]]) S.line3([x, y0, 0.3], [x, y1, 0.3], col);
      S.line3([p.finX + 1, y0, 0.3], [p.finX + 1, y1, 0.3], [210, 206, 196]);
      // hay bales between the lanes, with gaps
      const bale = [222, 186, 92];
      for (let k = 1; k < 6; k++) {
        const y = L(k) + 6.3;
        for (let x = -70 + (k % 2) * 14; x < 64; x += 28) S.box([x, y, 1.9], [6, 1.6, 1.9], I3, bale, { outline: [128, 96, 40], tex: (ax, sg, u, v) => (ax === 2 && Math.floor(u * 12) % 3 === 0) || (ax === 1 && Math.floor(u * 12) % 3 === 0) ? sc(bale, 0.84) : null });
      }
      // the far fence with the bookie's slate, the gate rail
      for (let x = -110; x <= 110; x += 16) S.box([x, y1 + 8, 7], [1, 1, 7], I3, [140, 104, 64], { outline: [70, 50, 30] });
      S.line3([-110, y1 + 8, 12], [110, y1 + 8, 12], [168, 128, 80]);
      S.line3([-110, y1 + 8, 6], [110, y1 + 8, 6], [150, 112, 70]);
      // the bets: a stack of coins at each lane's start, the hero's own the tallest
      for (let k = 0; k < 6; k++) {
        const y = L(k), mine = k === p.backed - 1;
        const kinds = mine ? coinsFor(rd.stake) : ["s", "c", "s", "s", "c"].slice(0, 1 + Math.floor(n(k, 3) * 4));
        S.drop(-100, y, 2, 4, 0.6);
        S.stack(-100, y, kinds);
        S.box([-93, y, 3], [0.5, 0.5, 3], I3, [110, 80, 50]);
        S.box([-91.4, y, 5], [1.6, 0.3, 1.2], I3, LANECOL[k], { flat: true });
      }
      return S;
    },
    pigX(p, pg, t) {
      if (t <= pg.start) return p.startX;
      let u = (t - pg.start) / (pg.T - pg.start);
      if (pg.mud) {
        // the slip: a stall in the puddle, made up after so the finish order holds
        const um = (p.mudX - p.startX - 10) / (p.finX - p.startX);
        if (u > um) u = u < um + 0.12 ? um + (u - um) * 0.15 : um + 0.018 + (u - um - 0.12) * (1 - um - 0.018) / (1 - um - 0.12);
      }
      if (u >= 1) return p.finX + (1 - Math.exp(-(t - pg.T) * 2.2)) * (18 - p.place[pg.n] * 2.4);
      return p.startX + (p.finX - p.startX) * clamp(u + pg.amp * Math.sin(Math.PI * u) + 0.01 * Math.sin(u * 20 + pg.wob) * u * (1 - u), 0, 1);
    },
    draw(S, p, rec, rd, t, wall) {
      const b = S.b, L = SCENES.pig_races.laneY, at = t < p.tPhoto ? t : t < p.tPhoto + p.freeze ? p.tPhoto : t - p.freeze;
      const gate = smooth(seg(at, p.tGate - 0.15, p.tGate + 0.1));
      const y0 = L(5) - 6.5, y1 = L(0) + 6.5;
      const ga = S.P(p.startX + 9, y0, 6 * (1 - gate) + 0.5), gb = S.P(p.startX + 9, y1, 6 * (1 - gate) + 0.5);
      b.line(ga[0], ga[1], gb[0], gb[1], [190, 60, 40]);
      const pigs = p.pigs.slice().sort((a, c) => c.lane - a.lane).reverse();
      for (const pg of pigs) {
        const x = SCENES.pig_races.pigX(p, pg, at), y = L(pg.lane), c = S.P(x - 8.5, y, 0);
        const um = pg.mud ? clamp((at - (pg.start + (pg.T - pg.start) * ((p.mudX - p.startX - 10) / (p.finX - p.startX)))) / 0.6, 0, 1) : 0;
        const muddy = pg.mud && um > 0;
        const running = at > pg.start && x < p.finX + 25;
        const ph = running ? (at - pg.start) * (x > p.finX ? 9 : 17) + pg.wob : 0;
        S.b.shadow(c[0], c[1] - 1, 8, 2.6, 0.62, 0.3);
        if (running && x < p.finX + 10) for (let k = 0; k < 4; k++) {
          const u = ((at * 3 + k * 0.25 + pg.wob) % 1), dx = -9 - u * 10, dy = -Math.sin(u * Math.PI) * 4;
          if (u < 0.85) b.px(c[0] + dx, c[1] - 1 + dy + (k % 2), muddy ? [96, 66, 42] : [196, 160, 112]);
        }
        pigSprite(b, c[0] + (um > 0 && um < 0.5 ? Math.sin(um * 40) * 2 : 0), c[1], pg.n, ph, muddy ? MUDPAL : PIGPAL, muddy ? sc(LANECOL[pg.lane], 0.6) : LANECOL[pg.lane], { dip: um > 0 && um < 0.45 ? 2 : 0, splat: muddy });
        if (pg.mud && um > 0 && um < 1) for (let k = 0; k < 8; k++) {
          const a = k / 8 * Math.PI * 2 + 0.4, d = um * (10 + (k % 3) * 4);
          b.px(c[0] + Math.cos(a) * d, c[1] - 3 + Math.sin(a) * d * 0.5 - Math.sin(um * Math.PI) * 8, [86, 58, 36]);
        }
        if (pg.n === p.backed && (at < p.tGate + 0.8 || t > p.tEnd)) {
          const bob = Math.round(Math.sin(wall * 6)), ax = Math.round(c[0]), ay = Math.round(c[1]) - 22 + bob;
          for (let j = 0; j < 3; j++) b.rect(ax - 2 + j, ay + j, 5 - j * 2, 1, [255, 220, 90], true);
        }
      }
      // the crowd's backs along the near rail, jumping at the finish
      const cheer = t > p.tPhoto + p.freeze ? 1 : 0, r = rng(5);
      for (let i = 0; i < 15; i++) {
        const x = 4 + i * 13 + Math.floor(r() * 5), j = cheer ? Math.max(0, Math.round(Math.sin(wall * 9 + i * 1.7) * 3)) : Math.round(Math.sin(wall * 2 + i) * 0.6);
        const coat = [[130, 64, 44], [64, 96, 62], [76, 84, 112], [150, 122, 64], [110, 80, 52]][i % 5], hair = [[62, 42, 26], [150, 104, 52], [32, 24, 20], [200, 170, 110], [120, 120, 116]][(i * 3) % 5];
        const y = H - 6 - (i % 2) * 3 - j;
        b.ell(x, y + 6, 8, 6, (nx, ny, px, py) => b.px(px, py, S.shade(coat, 0.9 - ny * 0.25)));
        b.ell(x, y - 3, 4.5, 4.5, (nx, ny, px, py) => b.px(px, py, S.shade(hair, 1 - ny * 0.3 + nx * 0.1)));
        if (i % 3 === 1) b.ell(x, y - 5, 5.5, 2.6, (nx, ny, px, py) => b.px(px, py, S.shade([90, 70, 44], 1 - ny * 0.2)));
        if (cheer && i % 4 === 2) b.rect(x - 1, y - 12 - j, 2, 5, S.shade([230, 180, 140], 1));
      }
      const fp = S.P(p.finX, y1 + 8, 15);
      b.rect(fp[0] - 1, fp[1], 2, 6, [120, 90, 56]);
      // the crow on the finish post, judge of the photo
      const hopc = at > p.tPhoto - 0.4 && at < p.tPhoto ? -2 : 0;
      b.ell(fp[0], fp[1] - 3 + hopc, 3, 2.4, (nx, ny, x, y) => b.px(x, y, ny < -0.3 && nx < 0 ? [70, 70, 80] : [30, 28, 34]));
      b.rect(fp[0] + 2, fp[1] - 5 + hopc, 2, 2, [30, 28, 34]);
      b.px(fp[0] + 4, fp[1] - 4 + hopc, [220, 170, 60]);
      b.px(fp[0] + 2, fp[1] - 5 + hopc, [240, 230, 200]);
      return { at };
    },
    after(S, p, rec, rd, t, wall, info) {
      const b = S.b;
      if (t >= p.tPhoto && t < p.tPhoto + p.freeze) {
        const u = (t - p.tPhoto) / p.freeze;
        for (let i = 0; i < W * H; i++) {
          const l = b.c[i * 3] * 0.35 + b.c[i * 3 + 1] * 0.5 + b.c[i * 3 + 2] * 0.15, k = u < 0.12 ? 1 - u / 0.12 : 0;
          b.c[i * 3] = lerp(l * 1.08, 255, k); b.c[i * 3 + 1] = lerp(l * 0.94, 255, k); b.c[i * 3 + 2] = lerp(l * 0.72, 250, k);
        }
        const c = S.P(p.finX, SCENES.pig_races.laneY(p.pigs.find((q) => q.n === p.order[0]).lane), 0);
        b.ell(c[0] - 2, c[1] - 6, 16, 11, (nx, ny, x, y) => { if (nx * nx + ny * ny > 0.8) b.px(x, y, [248, 244, 230], true); });
        stamp(b, "BY A SNOUT!", W / 2, 6, [250, 240, 210], t - p.tPhoto - 0.1);
      }
      if (t >= p.tEnd - 0.3) {
        slate(b, 4, 4, 56, 12, [120, 90, 56]);
        text(b, "1ST", 7, 7, [210, 214, 200]);
        p.order.slice(0, 3).forEach((n, i) => { b.rect(22 + i * 12, 6, 9, 7, LANECOL[n - 1], true); const lum = LANECOL[n - 1][1]; text(b, String(n), 25 + i * 12, 7, lum > 150 ? [30, 24, 20] : [250, 246, 236]); });
      }
      verdict(b, rd, t, p.tEnd, `#${p.backed} WINS!`, `#${p.backed} CAME ${["", "2ND", "3RD", "4TH", "5TH", "LAST"][p.place[p.backed]]}`, 6, 124);
      const od = ((rd.show || {}).odds || [])[p.backed - 1], price = od ? (od[0] === od[1] ? " EVENS" : ` AT ${od[0]}-${od[1]}`) : "";
      slip(S, rec, rd, t - p.tEnd, { first: `${(rec.name || "").toUpperCase()}: ${money(rd.stake)} ON #${p.backed}${price}` });
    },
    lamps(p, t) { return { amb: [1.0, 0.98, 0.9], lamps: [{ x: 30, y: 10, r: 200, i: 0.18, c: [1, 0.9, 0.6] }] }; },
  };

  // ===== Veldrock: Candle Stakes in pitch dark; each stub lights only its own stake, and the last flame wins =====
  SCENES.candle_stakes = {
    plan(rec, rd, r) {
      const show = rd.show || {}, burn = (show.burn || [140, 70, 110, 90]).slice(0, 6), mine = show.mine || 0;
      const n = burn.length, lo = Math.min(...burn), hi = Math.max(...burn);
      const order = burn.map((v, i) => i).sort((a, c) => burn[a] - burn[c]);
      const out = new Array(n).fill(Infinity);
      let last = 0.8;
      order.slice(0, -1).forEach((i) => { last = Math.max(last + 0.75, 1.6 + (burn[i] - lo) / Math.max(1, hi - lo) * 4.4); out[i] = last; });
      const winner = order[n - 1];
      const ring = [];
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + Math.PI * 2 * i / n + (n === 4 ? Math.PI / 4 : 0) + Math.PI * (1 / n);
        ring.push({ i, x: Math.cos(a) * 21, y: Math.sin(a) * 15, px: Math.cos(a) * 33, py: Math.sin(a) * 25, h0: 9 + r() * 3, out: out[i], mine: i === mine });
      }
      const tEnd = Math.max(...out.filter(isFinite)) + 1.0;
      const ev = [[0.05, "cave"], [0.3, "hiss"]];
      for (const c of ring) if (isFinite(c.out)) { ev.push([c.out - 0.55, "sputter"], [c.out, "snuff"]); }
      const two = out.filter(isFinite).sort((a, c) => a - c);
      const tTwo = two.length >= 2 ? two[two.length - 2] : 0;
      for (let k = 0; k < 6; k++) { const at = tTwo + 0.3 + k * (0.5 - k * 0.04); if (at < tEnd - 0.9) ev.push([at, "heart", k]); }
      ev.push([tEnd, rd.won ? "winCoins" : "lose"]);
      return { ring, winner, mine, tEnd, dur: tEnd + 1.2, ev, cam: new Cam({ pitch: 66, dist: 420, focal: 420 * 1.6, target: [0, 0, 0], cy: 66 }) };
    },
    base(p, rec, rd) {
      const S = new Scene(p.cam, { key: [0, -0.3, 0.95], lo: [0.9, 0.82, 0.74] });
      const n = vnoise(91);
      S.b.fill([10, 8, 6]);
      S.plane([[-300, 300, -50], [300, 300, -50], [300, -300, -50], [-300, -300, -50]], 2, -50, (x, y) => sc([60, 54, 48], 0.7 + n(x * 0.06, y * 0.06) * 0.4));
      // the barrel: staves down its side, an iron hoop, and the round head on top
      S.cyl([0, 0, -50], 40, 50, [96, 64, 38], { n: 40, sideFn: (i, nn, c) => sc(c, i % 3 === 0 ? 0.62 : 0.9 + ((i * 7) % 3) * 0.06), capCol: [110, 74, 44] });
      S.cyl([0, 0, -9], 40.6, 3, [70, 66, 62], { n: 40, capCol: [70, 66, 62] });
      S.cyl([0, 0, -36], 40.6, 3, [70, 66, 62], { n: 40, capCol: [70, 66, 62] });
      S.cyl([0, 0, -1], 40.8, 1.4, [80, 74, 68], { n: 40, capFn: () => (x, y) => {
        const w = S.cam.unproject(x + 0.5, y + 0.5, 2, 0.4), d = Math.hypot(w[0], w[1] / 0.98);
        if (d > 38.6) return sc([82, 76, 70], 1);
        const pl = Math.floor((w[0] + 40) / 9.5), px = (w[0] + 40) % 9.5;
        return sc([118, 80, 46], (0.8 + n(px * 0.4 + pl * 5, w[1] * 0.08) * 0.35) * (px < 0.9 ? 0.55 : 1));
      } });
      // each stake under its stub, and the hero's name scratched by theirs
      for (const c of p.ring) {
        const kinds = c.mine ? coinsFor(rd.stake) : ["s", "s", "c", "s", "s", "s"].slice(0, 3 + (c.i % 3));
        S.drop(c.px, c.py, 2, 5, 0.6);
        const r = rng(c.i * 7 + 1);
        kinds.forEach((k, j) => S.coin(c.px + (r() - 0.5) * 6, c.py + (r() - 0.5) * 4, j < 3 ? 0 : 1.15 * (j - 2) * 0.5, k));

      }
      return S;
    },
    draw(S, p, rec, rd, t, wall) {
      const b = S.b, items = [];
      p.lit = [];
      for (const c of p.ring) {
        const life = isFinite(c.out) ? clamp(t / c.out, 0, 1) : clamp(t / (p.tEnd + 4), 0, 1);
        const h = Math.max(1.5, c.h0 * (1 - life * 0.8));
        const gut = isFinite(c.out) ? clamp((t - (c.out - 0.6)) / 0.6, 0, 1) : 0;
        const dead = isFinite(c.out) && t >= c.out;
        items.push({ y: c.y, draw: () => {
          S.drop(c.x, c.y, 1, 3.6, 0.6);
          S.cyl([c.x, c.y, 0], 3.6, 0.9, [70, 60, 50], { n: 12 });
          S.cyl([c.x, c.y, 0.9], 2.4, h, [226, 212, 168], { n: 10, capCol: [238, 226, 186] });
          const drip = S.P(c.x - 1.6, c.y - 2, h * 0.5);
          b.rect(drip[0], drip[1], 1, Math.max(1, Math.round(h * 0.25)), [236, 224, 186]);
          const top = S.P(c.x, c.y, h + 1.4);
          c.top = top;
          b.px(top[0], top[1] + 1, [50, 36, 26]);
        } });
        const fl = dead ? 0 : (1 - gut * 0.75) * (gut > 0 ? 0.6 + 0.4 * Math.abs(Math.sin(wall * 23 + c.i)) : 1);
        if (!dead) p.lit.push({ c, fl, h });
        c.gut = gut; c.dead = dead; c.h = h;
      }
      paintItems(items);
      // the watchers: eyes in the dark around the barrel, catching what light is left
      const left = p.ring.filter((c) => !c.dead).length;
      [[18, 22], [170, 26], [10, 92], [178, 96], [150, 8]].forEach(([x, y], i) => {
        if (((wall * 0.5 + i * 0.37) % 1) < 0.05 || (i > 2 && left > 2)) return;
        const e = left <= 2 ? [200, 150, 90] : [130, 96, 60];
        b.px(x - 2, y, e, true); b.px(x + 2, y, e, true);
      });
      // when the last flame stands, the dark piles slide into its light
      const win = p.ring[p.winner];
      if (t > p.tEnd - 0.2) p.ring.forEach((c, k) => {
        if (k === p.winner) return;
        for (let j = 0; j < 3; j++) {
          const u = seg(t, p.tEnd - 0.2 + j * 0.12 + k * 0.05, p.tEnd + 0.3 + j * 0.12 + k * 0.05);
          if (u <= 0) continue;
          const x = lerp(c.px, win.px + (j - 1) * 3, ease(u)), y = lerp(c.py, win.py - 3, ease(u));
          S.coin(x, y, Math.sin(u * Math.PI) * 4 + (u >= 1 ? 2.3 + j * 1.15 : 0), "s");
        }
      });
      return {};
    },
    after(S, p, rec, rd, t, wall) {
      const b = S.b;
      for (const c of p.ring) {
        if (!c.top) continue;
        if (!c.dead) flame(b, c.top[0], c.top[1], 1.5, wall + c.i, null, c.gut);
        // the hero's name, chalked by their stake, readable only while their own flame lights it
        if (c.mine) {
          const nm = (rec.name || "").toUpperCase().slice(0, 9), tp = S.P(c.px, c.py, 0), k = c.dead ? Math.max(0, 1 - (t - c.out) * 3) : 1 - c.gut * 0.6;
          if (k > 0) text(b, nm, Math.round(tp[0] - textWidth(nm) / 2), Math.round(tp[1]) + 5, sc([236, 214, 170], 0.25 + 0.75 * k));
        }
        else {
          const u = (t - c.out) / 1.6;
          if (u < 1) for (let k = 0; k < 7; k++) { const yy = c.top[1] - k * 2 - u * 10, xx = c.top[0] + Math.sin(k * 0.9 + u * 6) * (1 + k * 0.4); if (k > u * 7 - 1) b.px(xx, yy, [120 - k * 8, 112 - k * 8, 104 - k * 8], true); }
          if (t - c.out < 0.25) b.px(c.top[0], c.top[1] + 1, [255, 120, 40], true);
        }
      }
      verdict(b, rd, t, p.tEnd, "THE LAST FLAME!", "SNUFFED OUT", 6);
      slip(S, rec, rd, t - p.tEnd, { paper: [170, 152, 120] });
    },
    lamps(p, t, at) {
      const lamps = (p.lit || []).map(({ c, fl }) => {
        const pt = p.cam.p(c.x, c.y, (c.h || 8) + 3);
        const flare = isFinite(c.out) ? 1 : 1 + 0.3 * smooth(seg(at, p.tEnd - 0.4, p.tEnd + 0.4));
        return { x: pt[0], y: pt[1] + 4, r: 36 * (0.55 + 0.45 * fl) * flare, i: 1.5 * fl, c: [1.2, 0.86, 0.5], p: 1.25, sy: 1.25 };
      });
      return { amb: [0.03, 0.025, 0.02], lamps, levels: 7 };
    },
  };

  // ===== Hollowood: the acorn shell game on a tree stump, in warm sun through the leaves, with butterflies =====
  function acornCap(S, x, y, z, r, tilt, sun) {
    const R = Rx(-tilt), m = 7, nn = 14, quads = [];
    const pt = (i, j) => {
      const la = Math.PI / 2 * i / m, lo = Math.PI * 2 * j / nn;
      const l = mv(R, [r * Math.cos(la) * Math.cos(lo), r * 0.96 * Math.cos(la) * Math.sin(lo), r * 0.8 * Math.sin(la)]);
      return [x + l[0], y + l[1], z + l[2]];
    };
    for (let i = 0; i < m; i++) for (let j = 0; j < nn; j++) {
      const la = Math.PI / 2 * (i + 0.5) / m, lo = Math.PI * 2 * (j + 0.5) / nn;
      const nrm = mv(R, norm([Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la) * 1.25]));
      const q = [pt(i, j), pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)], mid = q.reduce((a, c) => [a[0] + c[0] / 4, a[1] + c[1] / 4, a[2] + c[2] / 4], [0, 0, 0]);
      if (!S.cam.facing(mid, nrm)) continue;
      const scale = (i + j + (i % 2)) % 2 === 0 ? [150, 102, 56] : [128, 84, 46];
      quads.push([q, i === 0 ? [104, 70, 40] : scale, nrm, S.P(mid[0], mid[1], mid[2])[2]]);
    }
    quads.sort((a, c) => c[3] - a[3]);
    for (const [q, col, nrm] of quads) S.poly3(q, S.lit(col, nrm));
    const tip = mv(R, [0, 0, r * 0.8]);
    S.cyl([x + tip[0], y + tip[1], z + tip[2] - 0.5], 1.3, 3.2, [96, 70, 40], { R, n: 8 });
    if (tilt > 0.15) {
      const lip = [];
      for (let j = 0; j < nn; j++) { const lo = Math.PI * 2 * j / nn, l = mv(R, [r * Math.cos(lo), r * 0.96 * Math.sin(lo), 0]); lip.push(S.P(x + l[0], y + l[1], z + l[2])); }
      S.b.poly(lip, [44, 28, 16]);
    }
  }
  function acorn(S, x, y, z, sun) {
    S.drop(x, y, z + 2, 3.6, 0.55, sun);
    const c = S.P(x, y, z + 5), k = S.cam.scale(x, y, z) * 1.35;
    S.b.ell(c[0], c[1], 3.4 * k, 4.2 * k, (nx, ny, px, py) => {
      const f = 0.62 + 0.62 * clamp(-nx * 0.55 - ny * 0.5 + 0.35, 0, 1);
      S.b.px(px, py, nx * nx + ny * ny < 0.09 && nx < 0 && ny < 0 ? [250, 214, 150] : S.shade([176, 112, 46], f));
    });
    S.b.ell(c[0], c[1] - 3.2 * k, 3.9 * k, 2.2 * k, (nx, ny, px, py) => S.b.px(px, py, (px + py) % 2 ? S.shade([120, 86, 50], 1 - ny * 0.3) : S.shade([100, 70, 40], 1 - ny * 0.3)));
    S.b.rect(c[0], c[1] - 6 * k, 1, 2, [80, 56, 30]);
  }
  SCENES.acorn_shells = {
    plan(rec, rd, r) {
      const show = rd.show || {}, swaps = (show.swaps || [[0, 1], [1, 2], [0, 2]]).slice(0, 9), start = show.start || 0;
      const guess = show.guess === undefined ? 0 : show.guess;
      let pos = start;
      const SW = 0.44, t0 = 1.5, tracks = [];
      swaps.forEach(([a, b2], k) => { tracks.push({ a, b: b2, t: t0 + k * SW, front: k % 2 === 0 }); pos = pos === a ? b2 : pos === b2 ? a : pos; });
      // the acorn is wherever the swaps took it; the guess is made to agree with the round's result
      const acornAt = pos;
      let guess2 = guess;
      if ((guess2 === acornAt) !== !!rd.won) guess2 = rd.won ? acornAt : (acornAt + 1) % 3;
      const tSw = t0 + swaps.length * SW, tCoin = tSw + 0.2, tLift = tCoin + 0.75, tShow = acornAt === guess2 ? tLift : tLift + 0.85, tEnd = tShow + 0.55;
      const ev = [[0.35, "tok"], [1.05, "tok", 0.6]];
      tracks.forEach((s) => ev.push([s.t, "slide", 0.4]));
      ev.push([tCoin, "coin", 0.6], [tCoin + 0.1, "coin", 0.5], [tLift, "lift"]);
      if (acornAt !== guess2) ev.push([tShow, "lift"]);
      ev.push([tEnd, rd.won ? "winCoins" : "lose"]);
      const bf = [0, 1, 2].map((k) => ({ x: r() * 180 + 6, y: [24, 100, 60][k] + r() * 14, ph: r() * 6, col: [[246, 214, 72], [238, 132, 44], [214, 230, 140]][k] }));
      return { start, swaps, tracks, acornAt, guess: guess2, SW, t0, tCoin, tLift, tShow, tEnd, bf, dur: tEnd + 1.2, ev,
        cam: new Cam({ pitch: 64, dist: 420, focal: 420 * 1.5, target: [0, 2, 0], cy: 64 }) };
    },
    base(p) {
      const S = new Scene(p.cam, { key: [-0.55, 0.35, 0.76], lo: [0.82, 0.86, 0.72], hi: [1.08, 1.02, 0.84], ambF: 0.5, difF: 0.7 });
      const n = vnoise(101), g = vnoise(103);
      S.b.fill([60, 90, 40]);
      S.plane([[-300, 300, -26], [300, 300, -26], [300, -300, -26], [-300, -300, -26]], 2, -26, (x, y) => {
        const v = g(x * 0.12, y * 0.12), moss = n(x * 0.05, y * 0.05);
        const leaf = n(x * 0.4 + 40, y * 0.4) > 0.86;
        return leaf ? (n(x, y) > 0.5 ? [176, 120, 50] : [150, 132, 60]) : sc(moss > 0.55 ? [92, 128, 52] : [78, 112, 44], 0.82 + v * 0.3);
      });
      // a cast shadow from the stump, long and off to the lower right, away from the sun
      S.drop(10, -6, -10, 44, 0.55, null, -26);
      // roots, then the stump: furrowed bark down its side, growth rings on its face
      for (const a of [-2.4, -1.1, 0.2, 1.4, 2.6]) {
        const x0 = Math.cos(a) * 38, y0 = Math.sin(a) * 30;
        S.box([x0 * 1.18, y0 * 1.18, -22], [5, 3, 4], Rz(a), [104, 74, 46], { outline: [52, 36, 22] });
      }
      S.cyl([0, 0, -26], 44, 26, [104, 74, 46], { n: 44, sideFn: (i, nn2, c) => sc(c, (i % 4 === 0 ? 0.6 : i % 4 === 2 ? 1.08 : 0.88) * (0.9 + n(i, 3) * 0.2)), capFn: () => (x, y) => {
        const w = S.cam.unproject(x + 0.5, y + 0.5, 2, 0), d = Math.hypot(w[0] - 3, w[1] + 2) + (n(w[0] * 0.2, w[1] * 0.2) - 0.5) * 3;
        if (Math.hypot(w[0], w[1]) > 41.5) return sc([150, 108, 64], 0.86);
        const ring = d % 4.2, crack = Math.abs(Math.atan2(w[1] + 2, w[0] - 3) - 0.8) < 0.03 && d > 8;
        return crack ? [120, 84, 50] : sc([226, 186, 128], (ring < 0.9 ? 0.82 : 1) * (0.94 + n(w[0], w[1]) * 0.1) * (d < 2 ? 0.86 : 1));
      } });
      // ferns and a mushroom at the foot
      const fern = (x, y, s) => { const c = S.P(x, y, -26); for (let k = -3; k <= 3; k++) S.b.line(c[0], c[1], c[0] + k * 3 * s, c[1] - (9 - Math.abs(k)) * s, k % 2 ? [70, 120, 46] : [96, 148, 58]); };
      fern(-70, -20, 1.2); fern(74, -12, 1); fern(-60, 30, 0.9); fern(66, 34, 0.9);
      const m = S.P(54, -36, -26);
      S.b.ell(m[0], m[1] - 6, 4, 2.5, (nx, ny, x, y) => S.b.px(x, y, ny < 0 ? [200, 70, 50] : [170, 56, 40]));
      S.b.rect(m[0] - 1, m[1] - 4, 2, 4, [236, 226, 200]);
      S.b.px(m[0] - 2, m[1] - 7, [250, 240, 220]); S.b.px(m[0] + 1, m[1] - 8, [250, 240, 220]);
      return S;
    },
    shellAt(p, k, t) {
      // shell k starts at slot k; replay its swaps to find where it is at time t
      let slot = k, x = [-22, 0, 22][k], y = 0, z = 0;
      for (const s of p.tracks) {
        if (t < s.t) break;
        if (slot !== s.a && slot !== s.b) continue;
        const to = slot === s.a ? s.b : s.a, u = smooth(seg(t, s.t, s.t + p.SW * 0.92));
        const xa = [-22, 0, 22][slot], xb = [-22, 0, 22][to], side = (slot === s.a) === s.front ? -1 : 1;
        x = lerp(xa, xb, u); y = side * Math.sin(u * Math.PI) * 10;
        if (u >= 1) { slot = to; x = xb; y = 0; }
        else return { x, y, z, slot: -1 };
      }
      return { x, y, z, slot };
    },
    draw(S, p, rec, rd, t, wall) {
      const b = S.b, sun = [-120, 90, 160], items = [];
      // which shell holds the acorn: the one that started over it
      const holder = p.start;
      const shells = [0, 1, 2].map((k) => {
        const st = SCENES.acorn_shells.shellAt(p, k, t);
        let tilt = 0, lift = 0;
        if (t > 0.25 && t < 1.25 && k === holder) { const u = Math.sin(seg(t, 0.25, 1.15) * Math.PI); lift = u * 9; tilt = u * 0.9; }
        const fin = SCENES.acorn_shells.shellAt(p, k, 99).slot;
        if (fin === p.guess && t > p.tLift) { const u = ease(seg(t, p.tLift, p.tLift + 0.3)); lift = u * 11; tilt = u * 1.0; }
        if (fin === p.acornAt && fin !== p.guess && t > p.tShow) { const u = ease(seg(t, p.tShow, p.tShow + 0.3)); lift = u * 11; tilt = u * 1.0; }
        return { k, ...st, lift, tilt, fin };
      });
      const acornShell = shells.find((s) => s.k === holder);
      items.push({ y: acornShell.y - 3, draw: () => { if (acornShell.lift > 1) acorn(S, acornShell.x, acornShell.y - 2, 0, sun); } });
      for (const s of shells) items.push({ y: s.y, draw: () => {
        S.drop(s.x, s.y + s.lift * 0.8, s.lift + 4, 8.5, 0.55, sun);
        acornCap(S, s.x, s.y + s.lift * 0.8, s.lift, 9.5, s.tilt, sun);
      } });
      // the stake goes down in front of the guessed shell; the pot goes to whoever is right
      const gx = [-22, 0, 22][p.guess], u = ease3(seg(t, p.tCoin, p.tCoin + 0.4));
      const kinds = coinsFor(p.rd.stake);
      if (t > p.tCoin) {
        const won = p.rd.won, v = ease(seg(t, p.tEnd, p.tEnd + 0.45));
        const cx = t > p.tEnd ? lerp(gx, won ? gx : 0, v) : gx, cy = t > p.tEnd ? lerp(-22, won ? -22 : 30, v) : lerp(-46, -22, u);
        items.push({ y: cy, draw: () => {
          S.drop(cx, cy, 2, 4, 0.6, sun);
          S.stack(cx, cy, kinds);
          if (won && t > p.tEnd) for (let i = 0; i < Math.min(6, kinds.length); i++) if (t > p.tEnd + 0.3 + i * 0.07) S.coin(cx + 6, cy + (i % 2) * 2 - 1, Math.floor(i / 2) * 1.15, kinds[i]);
        } });
      }
      paintItems(items);
      if (t > p.t0 - 0.1 && t < p.t0 + p.swaps.length * p.SW) {
        for (const s of p.tracks) {
          const u = seg(t, s.t, s.t + p.SW);
          if (u <= 0 || u >= 1) continue;
          for (const [from, to, side] of [[s.a, s.b, s.front ? -1 : 1], [s.b, s.a, s.front ? 1 : -1]]) for (let k = 0; k < 9; k++) {
            const v = k / 8;
            if (v > u + 0.05) continue;
            const x = lerp([-22, 0, 22][from], [-22, 0, 22][to], v), y = side * Math.sin(v * Math.PI) * 10, c = S.P(x, y, 0.3);
            if (k % 2 === 0) b.px(c[0], c[1], [250, 236, 190]);
          }
        }
      }
      return { sun };
    },
    after(S, p, rec, rd, t, wall) {
      const b = S.b;
      // butterflies drifting through, wings beating
      for (const f of p.bf) {
        const x = (f.x + wall * 9 + Math.sin(wall * 0.7 + f.ph) * 20) % (W + 20) - 10, y = f.y + Math.sin(wall * 1.3 + f.ph) * 12 + Math.sin(wall * 5 + f.ph) * 2;
        const open = Math.sin(wall * 14 + f.ph) > -0.2, X = Math.round(x), Y = Math.round(y), d = sc(f.col, 0.7);
        b.rect(X + 2, Y + 8, 3, 1, [40, 60, 30]);
        if (open) {
          b.rect(X - 4, Y - 2, 3, 3, f.col); b.rect(X + 2, Y - 2, 3, 3, f.col); b.rect(X - 3, Y + 1, 2, 2, d); b.rect(X + 2, Y + 1, 2, 2, d);
          b.px(X - 4, Y - 2, [60, 40, 30]); b.px(X + 4, Y - 2, [60, 40, 30]);
        } else { b.rect(X - 2, Y - 3, 2, 3, f.col); b.rect(X + 1, Y - 3, 2, 3, f.col); }
        b.rect(X, Y - 2, 1, 4, [50, 36, 24]); b.px(X - 1, Y - 3, [50, 36, 24]); b.px(X + 1, Y - 3, [50, 36, 24]);
      }
      if (t > p.tLift) {
        const s = SCENES.acorn_shells.shellAt(p, 0, 99);
        void s;
        slate(b, 4, 4, 52, 12, [120, 92, 52]);
        text(b, "PICKS", 7, 7, [210, 214, 200]);
        text(b, ["LEFT", "MIDDLE", "RIGHT"][p.guess], 30, 7, [250, 236, 190]);
      }
      verdict(b, rd, t, p.tEnd, "FOUND IT!", "EMPTY SHELL", 6, 124);
      slip(S, rec, rd, t - p.tEnd);
    },
    lamps(p, t, at) {
      return { amb: [0.62, 0.6, 0.52], lamps: [{ kind: "dapple", seed: 7, t, i: 0.62, c: [1.12, 0.96, 0.7] }, { x: 40, y: 20, r: 190, i: 0.35, c: [1.1, 0.9, 0.55], p: 1.1 }], levels: 8 };
    },
  };

  // ===== Carrbridge: pitch-and-toss onto a chalk square on the bridge cobbles, the river running behind the rail =====
  const BRIDGE = ["...........", "...........", ".#########.", "##.##.##.##", "#..#...#..#", "#.........#", "###########"];
  const CROWN2 = ["#..#..#", "##.#.##", "#######", "#######", ".#####.", "......."];
  function coinFace(S, c, R, rr, face, base, lit, sun) {
    const U = mv(R, [rr, 0, 0]), V = mv(R, [0, rr, 0]), N = mv(R, [0, 0, 1]);
    const top = S.cam.facing(c, N) ? 1 : -1, up = top > 0 ? N : sc(N, -1);
    const cc = [c[0] + N[0] * 0.9 * top, c[1] + N[1] * 0.9 * top, c[2] + N[2] * 0.9 * top];
    const P0 = S.P(cc[0], cc[1], cc[2]), PU = S.P(cc[0] + U[0], cc[1] + U[1], cc[2] + U[2]), PV = S.P(cc[0] + V[0], cc[1] + V[1], cc[2] + V[2]);
    const ex = [PU[0] - P0[0], PU[1] - P0[1]], ey = [PV[0] - P0[0], PV[1] - P0[1]], det = ex[0] * ey[1] - ex[1] * ey[0];
    const pts = [];
    for (let i = 0; i < 18; i++) { const a = Math.PI * 2 * i / 18; pts.push([P0[0] + ex[0] * Math.cos(a) + ey[0] * Math.sin(a), P0[1] + ex[1] * Math.cos(a) + ey[1] * Math.sin(a)]); }
    const showing = top > 0 ? face : face === "heads" ? "tails" : "heads";
    const f0 = S.amb + S.dif * Math.max(0, dot(up, S.key));
    S.b.poly(pts, null, false, Math.abs(det) < 0.05 ? () => S.shade(base, f0) : (x, y) => {
      const dx = x + 0.5 - P0[0], dy = y + 0.5 - P0[1];
      let a = (dx * ey[1] - dy * ey[0]) / det, bb = (ex[0] * dy - ex[1] * dx) / det;
      if (top < 0) a = -a;
      const d = Math.hypot(a, bb);
      if (d > 0.84) return S.shade(base, f0 * (d > 0.92 ? 0.8 : 1.12));
      const rows = showing === "heads" ? CROWN2 : BRIDGE, gx = Math.floor((a + 0.62) / 1.24 * rows[0].length), gy = Math.floor((0.62 - bb) / 1.24 * rows.length);
      const on = gy >= 0 && gy < rows.length && gx >= 0 && gx < rows[0].length && rows[gy][gx] === "#";
      return S.shade(base, f0 * (on ? 1.28 : 0.86));
    });
    return pts;
  }
  SCENES.toll_toss = {
    plan(rec, rd, r) {
      const show = rd.show || {}, call = show.call || "heads", landed = show.landed || call;
      const tIn = 0.45, tApex = 1.3, tLand = 2.2, tB1 = 2.5, tB2 = 2.68, tWob = 4.2, tEnd = tWob + 0.4;
      const ev = [[0.08, "water"], [tIn, "flick"], [tIn + 0.05, "spin"], [tLand, "clink", 1], [tB1, "clink", 0.6], [tB2, "clink", 0.4], [tB2 + 0.05, "euler"], [tEnd, rd.won ? "winCoins" : "lose"]];
      if (r() < 0.8) ev.push([0.8 + r() * 2, "gull"]);
      const pl = { hero: [-42, -6], house: [42, -2], kinds: coinsFor(rd.stake), houseKinds: coinsFor(rd.stake).concat(["s", "s"]).slice(-12), won: rd.won };
      coinEvents(ev, pl, tEnd);
      return { call, landed, tIn, tApex, tLand, tB1, tB2, tWob, tEnd, pl, dur: tEnd + 1.2, ev, boat: r(), spinAxis: norm([1, 0.2 * (r() - 0.5), 0]), yaw: (r() - 0.5) * 1.2,
        cam: new Cam({ pitch: 52, dist: 420, focal: 420 * 1.35, target: [0, 10, 0], cy: 88 }) };
    },
    base(p, rec) {
      const S = new Scene(p.cam, { key: [-0.4, 0.3, 0.86], lo: [0.86, 0.86, 0.84], ambF: 0.58, difF: 0.55 });
      const n = vnoise(121);
      S.b.fill([70, 110, 120]);
      // cobbles: rounded setts in staggered rows, mortar between
      S.plane([[-200, 44, 0], [200, 44, 0], [200, -200, 0], [-200, -200, 0]], 2, 0, (x, y) => {
        const row = Math.floor((y + 400) / 7), off = (row % 2) * 4.5, cx = ((x + 400 + off) % 9) - 4.5, cy = ((y + 400) % 7) - 3.5;
        const e = Math.max(Math.abs(cx) / 4.5, Math.abs(cy) / 3.5);
        const k = n(Math.floor((x + 400 + off) / 9) * 3.3, row * 2.1);
        if (e > 0.86) return [86, 80, 72];
        return sc([150, 140, 124], (0.8 + k * 0.32) * (1.06 - e * 0.22 - (cy > 1.4 ? 0.08 : 0) + (cy < -1.6 && cx < 0 ? 0.08 : 0)));
      });
      // the chalk square, and the call chalked beside it
      const sq = [[-16, -10], [16, -10], [16, 22], [-16, 22]];
      for (let i = 0; i < 4; i++) { const a = sq[i], c = sq[(i + 1) % 4]; S.line3([a[0], a[1], 0.2], [c[0], c[1], 0.2], [236, 232, 218]); }
      S.line3([-16, 6, 0.2], [16, 6, 0.2], [226, 222, 208]);
      const lab = `${(rec.name || "").toUpperCase().slice(0, 9)} CALLS ${p.call.toUpperCase()}`, lp = S.P(0, -20, 0);
      text(S.b, lab, Math.round(lp[0] - textWidth(lab) / 2), Math.round(lp[1]), [232, 228, 214]);
      S.b.e.fill(0);
      // the parapet: dressed stone blocks with a coping along the top
      const n2 = vnoise(131);
      S.plane([[-200, 44, 0], [200, 44, 0], [200, 44, 16], [-200, 44, 16]], 1, 44, (x, y, z) => {
        const row = Math.floor(z / 5.5), off = (row % 2) * 8, bx = (x + 400 + off) % 16;
        if (bx < 0.8 || z % 5.5 < 0.6) return [96, 90, 80];
        return sc([166, 156, 138], 0.84 + n2(Math.floor((x + 400 + off) / 16) * 2.7, row * 1.9) * 0.24 - (z < 2 ? 0.12 : 0));
      });
      S.box([0, 46, 17.2], [200, 3.2, 1.6], I3, [180, 170, 150], { outline: [96, 88, 76] });
      return S;
    },
    river(S, p, wall) {
      const b = S.b, top = S.P(0, 46, 18.8)[1];
      // the far bank, then the water: slow bands, sparkling glints, and a boat or a gull on its way
      for (let y = 0; y < top; y++) for (let x = 0; x < W; x++) {
        let c;
        if (y < 7) c = y < 3 ? [124, 158, 96] : [92, 126, 70];
        else {
          const d = (y - 7) / Math.max(1, top - 7), wv = Math.sin(x * 0.12 + y * 1.3 - wall * 1.6) + Math.sin(x * 0.05 - y * 0.7 + wall * 0.9);
          c = mixc([54, 108, 118], [40, 84, 96], d);
          if (wv > 1.3) c = mixc(c, [120, 170, 170], 0.5);
          const gl = ((x * 7 + y * 13) % 37 === 0) && Math.sin(wall * 5 + x) > 0.6;
          if (gl) c = [236, 246, 236];
        }
        if (y === 7) c = [70, 100, 60];
        b.px(x, y, c);
      }
      for (let i = 0; i < 6; i++) { const hx = (i * 37 + 10) % W, hh = 3 + (i % 3); b.rect(hx, 3 - hh + 3, 7, hh, [170, 150, 120]); b.rect(hx - 1, 2 - hh + 3, 9, 1, [120, 70, 50]); b.px(hx + 3, 5, [60, 46, 36]); }
      const bx = ((wall * 7 + p.boat * 300) % (W + 60)) - 30, by = Math.min(top - 4, 15);
      b.rect(bx, by, 16, 3, [120, 80, 46]); b.rect(bx + 1, by + 3, 14, 1, [80, 52, 30]); b.rect(bx + 2, by - 1, 12, 1, [150, 104, 60]);
      b.rect(bx + 7, by - 10, 1, 9, [90, 64, 40]);
      for (let j = 0; j < 7; j++) b.rect(bx + 8, by - 9 + j, Math.round(6 - j * 0.6), 1, [232, 222, 196]);
      for (let k = 0; k < 4; k++) b.px(bx - 2 - k * 3, by + 3 + (k % 2), [150, 196, 196]);
      const gx = ((wall * 22 + 40) % (W + 80)) - 40, gy = 6 + Math.sin(wall * 1.3) * 3, fl = Math.sin(wall * 9) > 0;
      b.px(gx, gy, [240, 240, 236]); b.px(gx + 1, gy, [240, 240, 236]);
      b.px(gx - 1, gy + (fl ? -1 : 1), [220, 220, 216]); b.px(gx + 2, gy + (fl ? -1 : 1), [220, 220, 216]);
    },
    coinState(p, t) {
      const land = [3, 8];
      let x, y, z, R, wob = 0;
      const final = p.landed === "heads" ? 0 : Math.PI;
      const flips = 9;
      if (t < p.tIn) return null;
      if (t < p.tLand) {
        const u = (t - p.tIn) / (p.tLand - p.tIn), ua = (p.tApex - p.tIn) / (p.tLand - p.tIn);
        x = lerp(-6, land[0], u); y = lerp(-70, land[1], u);
        z = u < ua ? 90 * (1 - Math.pow(1 - u / ua, 2)) + 6 * (1 - u / ua) : 90 * (1 - Math.pow((u - ua) / (1 - ua), 2));
        R = mm(Rz(p.yaw), Raxis(p.spinAxis, final + Math.PI * 2 * flips * (1 - u)));
      } else if (t < p.tB2 + 0.12) {
        const u1 = seg(t, p.tLand, p.tB1), u2 = seg(t, p.tB1, p.tB2);
        x = land[0] + seg(t, p.tLand, p.tB2) * 3; y = land[1] + seg(t, p.tLand, p.tB2) * 2;
        z = t < p.tB1 ? 9 * 4 * u1 * (1 - u1) : 3 * 4 * u2 * (1 - u2);
        R = mm(Rz(p.yaw), Raxis(p.spinAxis, final + (t < p.tB1 ? (1 - u1) * Math.PI * 1.0 : (1 - u2) * 0.6)));
        wob = 0.35;
      } else {
        // Euler's disk: the tilt dies away while the wobble speeds up, then it rattles flat
        const u = seg(t, p.tB2 + 0.12, p.tWob);
        const tilt = 0.45 * Math.pow(1 - u, 1.6);
        const prec = (t - p.tB2) * 10 + Math.pow(u, 2.2) * 40;
        x = land[0] + 3; y = land[1] + 2;
        z = 0;
        R = mm(Rz(p.yaw + prec), mm(Rx(tilt), Raxis(p.spinAxis, final)));
        wob = tilt;
      }
      return { x, y, z, R, wob };
    },
    draw(S, p, rec, rd, t, wall) {
      SCENES.toll_toss.river(S, p, wall);
      const sun = [-60, 60, 420], items = [];
      drawPiles(S, p.pl, t, p.tEnd, sun, items);
      const st = SCENES.toll_toss.coinState(p, t);
      if (st) items.push({ y: st.y, draw: () => {
        const rr = 8, edge = Math.abs(mv(st.R, [0, 0, 1])[2]);
        const zc = st.z + rr * Math.sqrt(Math.max(0, 1 - edge * edge)) + 1;
        S.drop(st.x, st.y, st.z + 1, rr * (0.6 + 0.4 * edge), 0.55, sun);
        S.cyl([st.x, st.y, zc - 0.9], rr, 1.8, [168, 112, 38], { R: st.R, n: 18, capCol: [200, 150, 56] });
        coinFace(S, [st.x, st.y, zc], st.R, rr, p.landed === "heads" ? "heads" : "tails", [214, 164, 62], true, sun);
        if (t < p.tLand && t > p.tIn + 0.05) {
          const c = S.P(st.x, st.y, zc), sp = Math.sin((t - p.tIn) * 60) > 0.2;
          if (sp) { S.b.px(c[0] - 6, c[1] - 6, [255, 255, 240], true); S.b.px(c[0] + 7, c[1] + 5, [255, 255, 240], true); }
        }
      } });
      paintItems(items);
      if (st && t > p.tLand - 0.02) for (const [t0, s] of [[p.tLand, 1], [p.tB1, 0.6]]) dust(S, st.x, st.y, t0, t, [236, 232, 220], 5 * s);
      return {};
    },
    after(S, p, rec, rd, t) {
      const b = S.b;
      if (t >= p.tWob) {
        const word = p.landed === "heads" ? "CROWN!" : "BRIDGE!";
        stamp(b, word, W / 2, 30, [250, 244, 220], t - p.tWob);
      }
      verdict(b, rd, t, p.tEnd, "CALLED IT!", "WRONG CALL", 44);
      slip(S, rec, rd, t - p.tEnd);
    },
    lamps(p) { return { amb: [0.98, 0.98, 0.96], lamps: [{ x: 10, y: 0, r: 220, i: 0.16, c: [1, 0.92, 0.7] }] }; },
  };

  // ---------- rendering a frame ----------
  const plans = new Map();
  // the round to show: the one asked for, else the cheat if there was one, else the last round that went the night's way
  function roundOf(rec, opts) {
    const rs = rec.rounds || [];
    if (opts && opts.round !== undefined) return rs[clamp(opts.round, 0, rs.length - 1)] || { stake: 10, won: true, show: {} };
    const pick = rs.filter((r) => r.cheat).pop() || (rec.net > 0 ? rs.filter((r) => r.won).pop() : rec.net < 0 ? rs.filter((r) => rnet(r) < 0).pop() : null) || rs[rs.length - 1];
    return pick || { stake: 10, won: true, show: {} };
  }
  function planFor(rec, opts) {
    const rd = roundOf(rec, opts), key = rec.id + ":" + (rec.rounds || []).indexOf(rd) + ":" + rec.game;
    let p = plans.get(key);
    if (p && p.rec === rec) return p;
    const sc0 = SCENES[rec.game];
    if (!sc0) return null;
    p = sc0.plan(rec, rd, rng(hash(key)));
    p.rec = rec; p.rd = rd; p.scene = sc0;
    p.baseScene = sc0.base(p, rec, rd);
    p.baseBuf = p.baseScene.b.clone();
    if (plans.size > 24) plans.delete(plans.keys().next().value);
    plans.set(key, p);
    return p;
  }

  function render(rec, t, opts) {
    const p = planFor(rec, opts);
    if (!p) return null;
    const sc0 = p.scene, S = p.baseScene, rd = p.rd;
    const at = Math.min(t, p.dur);
    S.b.copy(p.baseBuf);
    const info = sc0.draw(S, p, rec, rd, at, t) || {};
    const L = sc0.lamps(p, t, at);
    light(S.b, L.lamps, L.amb, L.levels);
    for (const g of L.glows || []) glow(S.b, g[0], g[1], g[2], g[3], g[4]);
    if (sc0.after) sc0.after(S, p, rec, rd, at, t, info);
    const out = new Uint8ClampedArray(W * H * 4), c = S.b.c;
    for (let i = 0; i < W * H; i++) { out[i * 4] = c[i * 3]; out[i * 4 + 1] = c[i * 3 + 1]; out[i * 4 + 2] = c[i * 3 + 2]; out[i * 4 + 3] = 255; }
    return { w: W, h: H, data: out };
  }

  // ---------- sound: its own WebAudio context, following audio.js's "al.sound" settings and first-click unlock ----------
  const Snd = (() => {
    let ctx = null, out = null, noiseBuf = null, unlocked = false;
    // the site keeps the sound switch and levels in Settings (audio.js passes them on); review pages that load this file alone fall back to the old store
    const prefs = () => {
      if (root.Sound && root.Sound.fxPrefs) return root.Sound.fxPrefs();
      try { return Object.assign({ on: true, master: 0.7, sfx: 0.6 }, JSON.parse(root.localStorage.getItem("al.sound") || "{}")); } catch (e) { return { on: true, master: 0.7, sfx: 0.6 }; }
    };
    // a player fetched on first use loads after the click that opened its page, so the page's own unlock counts too
    const open = () => unlocked || !!(root.Sound && root.Sound.unlocked);
    function init() {
      if (ctx) return ctx;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      out = ctx.createGain(); out.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }
    function ok() {
      const pr = prefs();
      if (!open() || !pr.on || !init()) return null;
      if (ctx.state === "suspended") ctx.resume();
      out.gain.value = pr.master * pr.sfx * 0.9;
      return ctx;
    }
    function noise(t, dur, vol, type, freq, q, f2) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; s.loop = true;
      f.type = type || "lowpass"; f.frequency.setValueAtTime(freq || 800, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.004, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
      return g;
    }
    function tone(t, f0, f1, dur, vol, type, attack) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.003)); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
      return o;
    }
    function ring(t, f, dur, vol) { for (const [m, a] of [[1, 1], [2.71, 0.5], [4.16, 0.3], [5.43, 0.18]]) tone(t, f * m, f * m * 0.998, dur / Math.sqrt(m), vol * a); }
    const FX = {
      // a bone/wood die on a table: a short knock with a hard click on top
      clack: (t, v) => { const f = 900 + Math.random() * 700; tone(t, f, f * 0.7, 0.05, 0.28 * v, "triangle"); noise(t, 0.035, 0.45 * v, "bandpass", 2600 + Math.random() * 1800, 2); tone(t, 140, 90, 0.07, 0.25 * v); },
      rattle: (t, v) => { for (let i = 0; i < 6; i++) { const at = t + i * (0.05 - i * 0.005) + Math.random() * 0.01; FX.clack(at, v * (1 - i * 0.14)); } },
      spill: (t) => { for (let i = 0; i < 5; i++) noise(t + i * 0.03 + Math.random() * 0.02, 0.04, 0.12, "bandpass", 1800 + Math.random() * 1500, 3); },
      leather: (t) => { noise(t, 0.12, 0.35, "lowpass", 420, 1, 140); tone(t, 110, 60, 0.12, 0.3); },
      chalk: (t) => { for (let i = 0; i < 3; i++) noise(t + i * 0.09, 0.07, 0.12, "bandpass", 3800 + Math.random() * 800, 4); },
      slam: (t) => { tone(t, 90, 40, 0.25, 0.7); noise(t, 0.18, 0.6, "lowpass", 900, 1, 200); for (let i = 0; i < 4; i++) FX.clack(t + 0.03 + i * 0.03, 0.35); },
      tick: (t, v) => { tone(t, 1200 + v * 900, 1200 + v * 900, 0.08, 0.16, "triangle"); },
      coin: (t, v) => { ring(t, 2100 + Math.random() * 300, 0.45, 0.07 * (v || 1)); noise(t, 0.02, 0.15 * (v || 1), "highpass", 5000); },
      winCoins: (t) => { for (let i = 0; i < 6; i++) FX.coin(t + i * 0.07 + Math.random() * 0.03, 1 - i * 0.08); tone(t + 0.05, 523, 523, 0.3, 0.06, "triangle"); tone(t + 0.15, 784, 784, 0.4, 0.06, "triangle"); },
      whoosh: (t) => { noise(t, 0.3, 0.12, "bandpass", 500, 1.5, 2400); },
      knock: (t, v) => { const f = 500 + Math.random() * 300; tone(t, f, f * 0.8, 0.07, 0.3 * v, "triangle"); noise(t, 0.03, 0.3 * v, "bandpass", 1600 + Math.random() * 800, 3); tone(t, 120, 80, 0.06, 0.2 * v); },
      chime: (t, v) => { ring(t, 1046 * Math.pow(1.26, v || 0), 1.2, 0.08); },
      lid: (t) => { noise(t, 0.4, 0.14, "lowpass", 300, 1, 900); tone(t, 70, 50, 0.4, 0.12); },
      caught: (t) => { tone(t, 90, 40, 0.3, 0.7); noise(t, 0.2, 0.5, "lowpass", 800, 1, 200); tone(t + 0.1, 330, 160, 0.5, 0.1, "square"); },
      crowd: (t) => { noise(t, 5.5, 0.08, "bandpass", 650, 0.8); for (let i = 0; i < 18; i++) noise(t + Math.random() * 5, 0.12 + Math.random() * 0.1, 0.035, "bandpass", 700 + Math.random() * 900, 4); },
      bell: (t) => { ring(t, 1320, 1.4, 0.13); ring(t + 0.22, 1320, 1.0, 0.07); },
      oink: (t) => {
        const sq = Math.random() < 0.45, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = "sawtooth"; f.type = "bandpass"; f.Q.value = 3;
        if (sq) { o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(1500, t + 0.12); o.frequency.exponentialRampToValueAtTime(900, t + 0.38); f.frequency.value = 1700; }
        else { o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.16); f.frequency.value = 520; }
        const d = sq ? 0.4 : 0.17;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(sq ? 0.09 : 0.2, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0006, t + d);
        o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05);
        if (!sq) { const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = "sawtooth"; o2.frequency.setValueAtTime(140, t + 0.2); o2.frequency.exponentialRampToValueAtTime(100, t + 0.32); g2.gain.setValueAtTime(0.0001, t + 0.2); g2.gain.linearRampToValueAtTime(0.14, t + 0.22); g2.gain.exponentialRampToValueAtTime(0.0006, t + 0.34); o2.connect(f); o2.connect(g2); g2.connect(out); o2.start(t + 0.2); o2.stop(t + 0.4); }
      },
      hooves: (t) => { for (let i = 0; i < 26; i++) { const at = t + Math.random() * 1.15; noise(at, 0.03, 0.08, "lowpass", 900); tone(at, 180 + Math.random() * 60, 120, 0.04, 0.05); } },
      splat: (t) => { noise(t, 0.3, 0.4, "lowpass", 900, 1, 160); tone(t, 200, 70, 0.2, 0.2); for (let i = 0; i < 4; i++) noise(t + 0.08 + i * 0.05, 0.05, 0.08, "lowpass", 600); },
      flash: (t) => { noise(t, 0.06, 0.35, "highpass", 3000); tone(t, 2400, 500, 0.12, 0.08, "square"); },
      cheer: (t) => { const g = noise(t, 2.2, 0.0001, "bandpass", 1000, 0.7); g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0006, t + 2.2); for (let i = 0; i < 10; i++) noise(t + 0.1 + Math.random() * 1.2, 0.15, 0.05, "bandpass", 900 + Math.random() * 1400, 6); },
      cave: (t) => { noise(t, 8, 0.07, "lowpass", 140, 0.7); for (let i = 0; i < 5; i++) { const at = t + 0.6 + Math.random() * 7, f = 1300 + Math.random() * 700; tone(at, f * 1.6, f, 0.12, 0.05); } },
      hiss: (t) => { noise(t, 6.5, 0.018, "highpass", 4200); noise(t, 6.5, 0.02, "bandpass", 1800, 0.6); },
      sputter: (t) => { for (let i = 0; i < 7; i++) noise(t + Math.random() * 0.5, 0.015 + Math.random() * 0.02, 0.12 + Math.random() * 0.1, "bandpass", 1500 + Math.random() * 3000, 1.5); },
      snuff: (t) => { noise(t, 0.32, 0.22, "bandpass", 3200, 1.2, 500); tone(t + 0.02, 900, 300, 0.06, 0.04); },
      heart: (t, v) => { const k = 0.3 + (v || 0) * 0.06; tone(t, 62, 40, 0.14, k); tone(t + 0.17, 58, 38, 0.12, k * 0.6); },
      tok: (t, v) => { v = v || 1; noise(t, 0.08, 0.5 * v, "bandpass", 900, 8); tone(t, 720, 640, 0.1, 0.32 * v, "triangle"); tone(t, 240, 180, 0.07, 0.22 * v); },
      slide: (t, v) => { noise(t, 0.4, (v || 0.4) * 0.65, "bandpass", 1100, 2.2, 1500); noise(t + 0.3, 0.06, 0.1, "lowpass", 400); },
      lift: (t) => { noise(t, 0.18, 0.06, "bandpass", 700, 1.2, 1400); FX.tok(t + 0.02, 1.1); },
      water: (t) => { noise(t, 8, 0.07, "lowpass", 520, 0.6); noise(t, 8, 0.03, "bandpass", 1600, 0.8); for (let i = 0; i < 10; i++) noise(t + Math.random() * 7.5, 0.25, 0.025, "bandpass", 500 + Math.random() * 900, 3); },
      flick: (t) => { ring(t, 3300, 0.35, 0.1); noise(t, 0.015, 0.25, "highpass", 4000); },
      spin: (t) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        o.frequency.value = 2650; lfo.frequency.value = 18; lg.gain.value = 0.035;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 0.05); g.gain.linearRampToValueAtTime(0.03, t + 1.6); g.gain.linearRampToValueAtTime(0.0001, t + 1.75);
        lfo.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(out); o.start(t); lfo.start(t); o.stop(t + 1.8); lfo.stop(t + 1.8);
        noise(t, 1.7, 0.03, "bandpass", 600, 1, 900);
      },
      clink: (t, v) => { ring(t, 2300 + Math.random() * 300, 0.6, 0.11 * (v || 1)); noise(t, 0.02, 0.3 * (v || 1), "highpass", 4500); },
      euler: (t) => {
        let at = t, gap = 0.13, f = 1900;
        for (let i = 0; i < 46 && at < t + 1.55; i++) { ring(at, f, 0.16, 0.035 + i * 0.0008); noise(at, 0.012, 0.06, "highpass", 5000); at += gap; gap = Math.max(0.012, gap * 0.92); f *= 1.008; }
        noise(at, 0.08, 0.12, "bandpass", 2600, 2); ring(at + 0.02, f, 0.5, 0.05);
      },
      gull: (t) => { for (const d of [0, 0.3]) { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(1500, t + d); o.frequency.exponentialRampToValueAtTime(950, t + d + 0.24); f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 4; g.gain.setValueAtTime(0.0001, t + d); g.gain.linearRampToValueAtTime(0.03, t + d + 0.03); g.gain.exponentialRampToValueAtTime(0.0006, t + d + 0.26); o.connect(f); f.connect(g); g.connect(out); o.start(t + d); o.stop(t + d + 0.3); } },
      lose: (t) => { tone(t, 220, 196, 0.35, 0.08, "triangle"); tone(t + 0.18, 175, 147, 0.5, 0.08, "triangle"); },
    };
    // the same effects into an OfflineAudioContext, for the gallery's level check
    function render(evs, secs, sr) {
      const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext, rate = sr || 22050;
      const saved = [ctx, out, noiseBuf];
      ctx = new OAC(1, Math.ceil(rate * secs), rate);
      out = ctx.createGain(); out.gain.value = 0.7 * 0.6 * 0.9; out.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, rate * 2, rate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const off = ctx;
      try { for (const [t, name, v] of evs) if (FX[name]) FX[name](t + 0.01, v === undefined ? 1 : v); } finally { [ctx, out, noiseBuf] = saved; }
      return off.startRendering();
    }
    function play(name, v) { const c = ok(); if (!c || !FX[name]) return; try { FX[name](c.currentTime + 0.01, v === undefined ? 1 : v); } catch (e) { /* audio node limits */ } }
    if (root.document) {
      root.document.addEventListener("pointerdown", () => { unlocked = true; }, { capture: true });
      root.document.addEventListener("visibilitychange", () => { if (ctx && root.document.hidden) ctx.suspend(); });
    }
    return { play, render, FX, get ready() { return open() && prefs().on; } };
  })();

  // ---------- the player ----------
  const reduced = () => !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function player(rec, opts) {
    opts = opts || {};
    const doc = root.document, fig = doc.createElement("figure"), cv = doc.createElement("canvas");
    fig.className = "tables-replay";
    cv.width = W; cv.height = H;
    cv.style.cssText = `image-rendering:pixelated;image-rendering:crisp-edges;display:block;cursor:pointer;${opts.scale ? `width:${W * opts.scale}px;height:${H * opts.scale}px` : "width:100%;height:auto"}`;
    cv.title = "Click to watch again";
    fig.appendChild(cv);
    const g = cv.getContext("2d"), img = g.createImageData(W, H);
    const p = planFor(rec, opts);
    if (!p) return fig;
    if (opts.caption) {
      // the round on screen in words, for readers who can't make out the pixel slip on a small screen
      const rs = rec.rounds || [], i = rs.indexOf(p.rd), rd = p.rd, cap = doc.createElement("figcaption");
      const m = (cp) => (root.App && root.App.coins ? root.App.coins(cp) : money(cp).toLowerCase());
      const n = rnet(rd);
      const what = rd.cheat ? (rd.caught ? `is caught cheating and forfeits ${m(-n)}` : `cheats, nobody sees, and wins ${m(n)}`)
        : n > 0 ? `wins ${m(n)}` : n < 0 ? `loses ${m(-n)}` : "gets the stake back";
      cap.className = "small muted";
      cap.textContent = `${rs.length > 1 && i >= 0 ? `Round ${i + 1} of ${rs.length}: ` : ""}${rec.name || "A hero"} ${what}. Click the scene to watch again.`;
      fig.appendChild(cap);
    }
    let t = reduced() ? p.dur + 1 : 0, raf = 0, last = 0, onscreen = false, fired = 0, lastDraw = -1, rate = 1, held = false, forced = false;
    const evs = p.ev.slice().sort((a, b) => a[0] - b[0]);
    const paint = () => { const f = render(rec, t, opts); img.data.set(f.data); g.putImageData(img, 0, 0); };
    const live = () => !held && fig.isConnected && onscreen && !doc.hidden;
    function frame(ms) {
      raf = 0;
      if (!live()) { last = 0; return; }
      const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
      last = ms;
      t += dt * rate;
      while (fired < evs.length && evs[fired][0] <= t) { if (evs[fired][0] > t - 0.25) Snd.play(evs[fired][1], evs[fired][2]); fired++; }
      // the hold only needs the slow flicker of lamps and water, so it repaints a dozen times a second
      if (t < p.dur + 0.3 || t - lastDraw > 1 / 12) { paint(); lastDraw = t; }
      raf = root.requestAnimationFrame(frame);
    }
    const wake = () => { if ((forced || !reduced()) && !raf && live()) { last = 0; raf = root.requestAnimationFrame(frame); } };
    cv.addEventListener("click", () => { t = 0; fired = 0; lastDraw = -1; paint(); wake(); });
    if ("IntersectionObserver" in root) {
      const io = new root.IntersectionObserver((es) => {
        onscreen = es[es.length - 1].isIntersecting;
        if (!fig.isConnected && t > 0) { io.disconnect(); return; }
        wake();
      });
      io.observe(fig);
    } else onscreen = true;
    doc.addEventListener("visibilitychange", wake);
    // the page's shared control bar drives the player through this (replay.js); a press of Play also plays under reduced motion
    fig.replay = {
      get t() { return t; }, get dur() { return p.dur; }, get playing() { return !held && t < p.dur && (forced || !reduced()); },
      play() { held = false; forced = true; wake(); },
      pause() { held = true; },
      restart() { held = false; forced = true; t = 0; fired = 0; lastDraw = -1; paint(); wake(); },
      skip() { t = p.dur; fired = evs.length; lastDraw = -1; paint(); wake(); },
      rate(s) { rate = s; },
    };
    paint();
    wake();
    return fig;
  }

  root.TablesReplay = {
    player, W, H, GAMES: Object.keys(SCENES),
    frame: render,
    length: (rec, opts) => { const p = planFor(rec, opts); return p ? p.dur : 0; },
    events: (rec, opts) => { const p = planFor(rec, opts); return p ? p.ev.slice() : []; },
    sound: Snd,
  };
})(typeof window !== "undefined" ? window : globalThis);
