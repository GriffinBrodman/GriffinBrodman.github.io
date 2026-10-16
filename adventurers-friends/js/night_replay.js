/* Night game replays: cards, checkers and crew dice at camp or in a tavern, drawn in pixel art from a night-game record, with synthesised sound. */
/*
  INPUT: one night-game record (the engine writes one per game it wants replayed):
    { id: string, unique; it seeds the little choices (where dice land, which men are pebbles),
      day, season,
      game: "cards" | "checkers" | "dice",
      where: "camp" | "tavern"           cards at a tavern get the close tavern table; everything else plays on the camp crate
                                         or the stump by the fire,
      set: { id: "cards_gilt", tier: 0..3, missing?: men lost from a checkers set (pebbles stand in for them) },
           the look comes from the set id in league/content/night_games.py SETS; an unknown id falls back to its game and tier,
      players: [ { id, name, nick?, goblin?: "nib" | "orm" }, ... ]
           players[0] sits at the near edge (the bottom of the frame), players[1] at the far edge (the top), where a goblin or
           troll peeks over; if players[0] is the goblin the seats are swapped. Dice may have 3 or 4 players (left, right),
      winner: index into players, or null for a draw,
      loser?: index of whoever pays the stake (default: the other player; at crew dice, the lowest total),
      stake: "first_watch" | "cooks_tomorrow" | "carries_pack" | "names_pet" | "washes_pots"   paid by the loser, shown as a token,
             | "set" (the set changes hands) | "keepsake" | "silver" (with stake_cp, in copper) | null,
      stake_cp?: copper, for "silver",
      show: what was played, per game:
        cards at camp    { tricks: [ { cards: [players[0]'s card, players[1]'s card], lead: 0|1, taker: 0|1 }, ... ] }
                         the last three tricks are played out card by card; the earlier ones sit as won piles
        cards at tavern  { hands: [[5 cards of players[0]], [5 cards of players[1]]], tally?: [hands won earlier tonight, per player],
                           label?: "THREE QUEENS" (default: the poker name of the winner's hand) }
                         either venue accepts the other's shape and makes do
        a card           "QH" "10S" "AD" "7C": rank 2-10 J Q K A, then suit S H D C
        checkers         { board: 8 strings of 8 characters, row 0 = players[0]'s home row (nearest), column 0 at the left;
                             "w" "W" players[0]'s man and king, "b" "B" players[1]'s, "." empty; only dark squares ((col + row) even) count,
                           moves: [ [[col, row], [col, row], ...], ... ] }
                         the key moves in order (2 to 5 is right), each the squares one piece visits; whoever owns the piece moves.
                         A two-square diagonal step is a jump and takes the man between; a man ending on the far row is crowned.
                         End on the climax (a double jump plays best). Men missing from the board's 12 a side sit captured beside it
        dice             { rolls: [[faces of players[0]], [faces of players[1]], ...] }  1 to 5 d6 each, thrown in seat order
    }

  NightReplay.player(rec, opts) -> <figure> that plays while on screen, holds on the result, replays on click; under reduced motion
    it shows the final frame. opts.scale (CSS px per pixel, default fluid to 100% width).
  NightReplay.frame(rec, t, opts) -> { w, h, data: RGBA bytes }: any moment as pixels (no DOM; tools capture with it).
  NightReplay.length(rec) -> seconds of action before the hold. NightReplay.events(rec) -> the sound cues. NightReplay.SCENES lists scene ids.
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
    return `${Math.round(cp / 10)} SILVER`;
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

  // ---------- dice as solids: one ray per pixel against the set's own shape (rounded, lumpy, tapered or cut), then its material ----------
  const tmv = (A, v) => [A[0][0] * v[0] + A[1][0] * v[1] + A[2][0] * v[2], A[0][1] * v[0] + A[1][1] * v[1] + A[2][1] * v[2], A[0][2] * v[0] + A[1][2] * v[1] + A[2][2] * v[2]];
  function hash3(x, y, z, s) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + Math.imul(s | 0, 1013904223)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function noise3(x, y, z, s) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
    const c = (i, j, k) => hash3(xi + i, yi + j, zi + k, s);
    return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), xf), lerp(c(0, 1, 0), c(1, 1, 0), xf), yf), lerp(lerp(c(0, 0, 1), c(1, 0, 1), xf), lerp(c(0, 1, 1), c(1, 1, 1), xf), yf), zf);
  }
  function dieShape(sh, h, seed) {
    const e = sh.ext || [1, 1, 1], rr = (sh.round || 0.1) * h, b = [h * e[0] - rr, h * e[1] - rr, h * e[2] - rr];
    // each die's lumps are a few slow waves with its own phases, cheap enough to march every frame
    const ph = [hash3(seed, 1, 0, 9) * 6.3, hash3(seed, 2, 0, 9) * 6.3, hash3(seed, 3, 0, 9) * 6.3], k0 = 2.1 / h, k1 = 2.4 / h, k2 = 1.9 / h;
    return (p0) => {
      const tk = sh.taper ? 1 + sh.taper * p0[2] / h : 1, p = sh.taper ? [p0[0] * tk, p0[1] * tk, p0[2]] : p0;
      const ax = Math.abs(p[0]), ay = Math.abs(p[1]), az = Math.abs(p[2]);
      const qx = ax - b[0], qy = ay - b[1], qz = az - b[2];
      let d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - rr;
      if (sh.corner) d = Math.max(d, (ax + ay + az) / 1.732 - sh.corner * h);
      if (sh.edge) d = Math.max(d, (ax + ay) / 1.414 - sh.edge * h, (ay + az) / 1.414 - sh.edge * h, (ax + az) / 1.414 - sh.edge * h);
      if (sh.worn) d = Math.max(d, (p[0] + p[1] - p[2]) / 1.732 - sh.worn * h);
      if (sh.lump) d += (Math.sin(p[0] * k0 + ph[0]) * Math.sin(p[1] * k1 + ph[1]) + Math.sin(p[2] * k2 + ph[2]) * 0.6) * sh.lump * h * 0.3;
      return d;
    };
  }
  function faceAt(p, h, ext) {
    const a = [Math.abs(p[0]) / ext[0], Math.abs(p[1]) / ext[1], Math.abs(p[2]) / ext[2]];
    const ax = a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2, sg = p[ax] >= 0 ? 1 : -1;
    const o2 = [0, 1, 2].filter((k) => k !== ax), u = p[o2[0]] / (h * ext[o2[0]]), v = p[o2[1]] / (h * ext[o2[1]]);
    let pd = 9;
    for (const [pu, pv] of PIPS[FACEVAL[ax + "," + sg]]) pd = Math.min(pd, Math.hypot(u - pu * 0.52, v - pv * 0.52));
    return { ax, sg, u, v, pd, e: Math.max(Math.abs(u), Math.abs(v)), cn: Math.min(Math.abs(u), Math.abs(v)) };
  }
  // a die at rest draws the same pixels every frame, so its raster is kept and replayed
  const DIE_CACHE = new Map();
  function dieSolid(S, st, size, look, light) {
    const h = size / 2, c = [st.x, st.y, st.z + h], R = st.R, cam = S.cam, seed = (st.seed || 0) * 13 + 3;
    S.drop(st.x, st.y, st.z + h, h * 1.05, look.shadowF || 0.5, light);
    const key = look.id + ":" + seed + ":" + c.map((v) => v.toFixed(2)).join(",") + ":" + R.map((r) => r.map((v) => v.toFixed(3)).join(",")).join(";") + ":" + cam.sx + "," + cam.sy;
    let px = DIE_CACHE.get(key);
    if (!px) {
      px = dieRaster(S, c, h, R, look, seed);
      if (DIE_CACHE.size > 64) DIE_CACHE.delete(DIE_CACHE.keys().next().value);
      DIE_CACHE.set(key, px);
    }
    for (const [x, y, col, emit] of px) S.b.px(x, y, col, emit);
  }
  function dieRaster(S, c, h, R, look, seed) {
    const cam = S.cam, sh = look.shape || {}, ext = sh.ext || [1, 1, 1], sdf = dieShape(sh, h, seed);
    const pc = S.P(c[0], c[1], c[2]), rad = cam.scale(c[0], c[1], c[2]) * h * 2.1;
    const x0 = Math.floor(pc[0] - rad), x1 = Math.ceil(pc[0] + rad), y0 = Math.floor(pc[1] - rad), y1 = Math.ceil(pc[1] + rad);
    const wN = x1 - x0 + 1, hN = y1 - y0 + 1, face = new Int8Array(wN * hN).fill(-1), out = new Map();
    const rel = [cam.pos[0] - c[0], cam.pos[1] - c[1], cam.pos[2] - c[2]], lo = tmv(R, rel);
    // the ray only marches inside the die's bounding sphere
    const rb = h * Math.max(...ext) * (1.74 + (sh.taper || 0)) + (sh.lump || 0) * h, rr2 = dot(rel, rel) - rb * rb;
    const shadeM = (m, nw, V, x, y) => {
      if (m.emit || m.flat) return m.col;
      let col = S.shade(m.col, S.amb + S.dif * Math.max(0, dot(nw, S.key)));
      if (m.spec) {
        const nk = dot(nw, S.key), Rf = [2 * nk * nw[0] - S.key[0], 2 * nk * nw[1] - S.key[1], 2 * nk * nw[2] - S.key[2]];
        const s = Math.pow(Math.max(0, dot(Rf, V)), m.shin || 12) * m.spec;
        const k = Math.floor(clamp(s, 0, 1) * 3 + BAYER[(y & 3) * 4 + (x & 3)] * 0.9) / 3;
        if (k > 0) col = mixc(col, m.specCol || [255, 250, 236], Math.min(1, k));
      }
      return col;
    };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cam.cx - cam.sx) / cam.focal, dy = (y + 0.5 - cam.cy - cam.sy) / cam.focal;
      const D = norm([cam.f[0] + dx - cam.u[0] * dy, cam.f[1] - cam.u[1] * dy, cam.f[2] - cam.u[2] * dy]), ld = tmv(R, D);
      const bq = dot(rel, D), disc = bq * bq - rr2;
      if (disc < 0) continue;
      let t = -bq - Math.sqrt(disc), p = null;
      const tEnd = -bq + Math.sqrt(disc);
      for (let i = 0; i < 40 && t < tEnd; i++) {
        const q = [lo[0] + ld[0] * t, lo[1] + ld[1] * t, lo[2] + ld[2] * t], d = sdf(q);
        if (d < 0.015) { p = q; break; }
        t += Math.max(d * 0.9, 0.015);
      }
      if (!p) continue;
      const e = 0.03, nl = norm([sdf([p[0] + e, p[1], p[2]]) - sdf([p[0] - e, p[1], p[2]]), sdf([p[0], p[1] + e, p[2]]) - sdf([p[0], p[1] - e, p[2]]), sdf([p[0], p[1], p[2] + e]) - sdf([p[0], p[1], p[2] - e])]);
      const nw = norm(mv(R, nl)), V = [-D[0], -D[1], -D[2]], fc = faceAt(p, h, ext);
      const m = DICE_MATS[look.mat](Object.assign(fc, { p, h, nl, nw, V, seed, x, y, S, key: S.key, fr: 1 - Math.abs(dot(nw, V)), isPip: false }));
      const i = (y - y0) * wN + (x - x0);
      out.set(i, [x, y, shadeM(m, nw, V, x, y), m.emit]);
      face[i] = fc.ax * 2 + (fc.sg > 0 ? 1 : 0);
    }
    // pips are stamped where their centres project, one crisp pixel each, on faces turned toward the camera
    const Vc = norm(rel);
    for (let ax = 0; ax < 3; ax++) for (const sg of [1, -1]) {
      const n = [0, 0, 0]; n[ax] = sg;
      const nw = mv(R, n), facing = dot(nw, Vc);
      if (facing < 0.2) continue;
      const o2 = [0, 1, 2].filter((k) => k !== ax), val = FACEVAL[ax + "," + sg], fid = ax * 2 + (sg > 0 ? 1 : 0);
      const at = (pu, pv) => { const l = [0, 0, 0]; l[ax] = sg * h * ext[ax] * 0.98; l[o2[0]] = pu * 0.52 * h * ext[o2[0]]; l[o2[1]] = pv * 0.52 * h * ext[o2[1]]; const w = mv(R, l); return S.P(c[0] + w[0], c[1] + w[1], c[2] + w[2]); };
      const a0 = at(0, 0), a1 = at(1, 0), a2 = at(0, 1), step = Math.min(Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), Math.hypot(a2[0] - a0[0], a2[1] - a0[1]));
      if (step < 1.3) continue;
      const big = val === 1 ? step >= 2.6 : step >= 3.6;
      for (const [pu, pv] of PIPS[val]) {
        const q = at(pu, pv), x = Math.floor(q[0]), y = Math.floor(q[1]), i = (y - y0) * wN + (x - x0);
        if (x < x0 || y < y0 || x > x1 || y > y1 || face[i] !== fid) continue;
        const l = [0, 0, 0]; l[ax] = sg * h; l[o2[0]] = pu * 0.52 * h; l[o2[1]] = pv * 0.52 * h;
        const m = DICE_MATS[look.mat]({ isPip: true, big, p: l, h, nl: n, nw, V: Vc, seed, fr: 1 - facing, e: 0, cn: 0, pd: 0, x, y, S, key: S.key });
        const col = shadeM(m, nw, Vc, x, y);
        out.set(i, [x, y, col, m.emit, true]);
        if (big) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) { const j = i + dy * wN + dx; if (x + dx <= x1 && face[j] === fid) out.set(j, [x + dx, y + dy, col, m.emit, true]); }
        else if (look.pipRing) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = i + dy * wN + dx, o = out.get(j);
          if (x + dx >= x0 && x + dx <= x1 && face[j] === fid && o && !o[4]) o[2] = mixc(o[2], look.pipRing, 0.5);
        }
      }
    }
    const px = [...out.values()];
    if (look.outline) {
      const inside = (i, j) => i >= 0 && j >= 0 && i < wN && j < hN && face[j * wN + i] >= 0;
      for (let j = -1; j <= hN; j++) for (let i = -1; i <= wN; i++) {
        if (inside(i, j)) continue;
        if (inside(i - 1, j) || inside(i + 1, j) || inside(i, j - 1) || inside(i, j + 1)) px.push([x0 + i, y0 + j, look.outline, false]);
      }
    }
    return px;
  }
  // a small four-point star where a polished die catches the fire as it settles
  function glintAt(S, d, t, col) {
    if (!d.st) return;
    const u = (t - d.T.ti[4] + 0.05) / 0.4;
    if (u < 0 || u > 1) return;
    const h = d.size / 2, c = S.P(d.st.x - h * 0.45, d.st.y - h * 0.5, d.st.z + d.size + 0.5), b = S.b, x = Math.round(c[0]), y = Math.round(c[1]);
    const arm = u < 0.25 ? 1 : u < 0.6 ? 2 : 1;
    b.px(x, y, [255, 255, 240], true);
    for (let k = 1; k <= arm; k++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.px(x + dx * k, y + dy * k, k === arm && arm > 1 ? col : [255, 246, 214], true);
  }

  // ---------- dice materials, named by the set looks below; c carries the hit point, its face and the light ----------
  const MIX = (a, b, t) => mixc(a, b, clamp(t, 0, 1));
  const reflectV = (c) => { const k = 2 * dot(c.nw, c.V); return norm([k * c.nw[0] - c.V[0], k * c.nw[1] - c.V[1], k * c.nw[2] - c.V[2]]); };
  const FIRE = norm([-0.55, -0.45, 0.35]);
  // a polished surface shows what its reflection sees: the fire on one side, the dark camp everywhere else
  const env = (c, dark, mid, lit) => { const f = dot(reflectV(c), FIRE); return f > 0.55 ? lit : f > 0.05 ? mid : dark; };
  const N3 = (c, k, s) => noise3(c.p[0] / c.h * k, c.p[1] / c.h * k, c.p[2] / c.h * k, s);
  const flatFace = (c) => Math.abs(c.nl[0]) > 0.95 || Math.abs(c.nl[1]) > 0.95 || Math.abs(c.nl[2]) > 0.95;
  const DICE_MATS = {
    bone: (c) => {
      if (c.isPip) return { col: [56, 28, 14] };
      let col = MIX([240, 228, 190], [214, 188, 132], N3(c, 1.8, c.seed) * 1.5 - 0.35);
      if ((c.p[0] + c.p[1] - c.p[2]) / 1.732 > 1.05 * c.h) col = [246, 238, 210];
      if (N3(c, 3.1, c.seed + 40) > 0.76) col = MIX(col, [168, 128, 78], 0.6);
      return { col, spec: 0.12, shin: 5, specCol: [255, 246, 220] };
    },
    shell: (c) => {
      if (c.isPip) return { col: [92, 140, 206] };
      return { col: c.e > 0.8 ? [244, 204, 210] : [244, 240, 232], spec: 0.45, shin: 14 };
    },
    lampstone: (c) => {
      if (c.isPip) return { col: [34, 22, 12] };
      const core = 1 - c.e, smoke = N3(c, 2, 21);
      if (core > 0.62 + smoke * 0.2) return { col: [255, 204, 116], emit: true };
      if (core > 0.48 + smoke * 0.2) return { col: [244, 150, 56], emit: true };
      if (c.e > 0.9) return { col: [190, 104, 34], spec: 0.8, shin: 26 };
      return { col: MIX([140, 70, 20], [222, 138, 48], core * 1.6 - smoke * 0.4), spec: 0.8, shin: 26, specCol: [255, 244, 210] };
    },
    jet: (c) => {
      if (c.isPip) return { col: [240, 244, 252], flat: true };
      if (!flatFace(c)) return { col: env(c, [58, 58, 70], [112, 112, 128], [236, 222, 206]), flat: true };
      return { col: env(c, [26, 24, 32], [40, 38, 48], [70, 54, 50]), spec: 1.3, shin: 40, specCol: [250, 250, 255] };
    },
    gilt: (c) => {
      if (c.isPip) return { col: [24, 16, 12], flat: true };
      const lit = dot(c.nw, c.key);
      if (c.cn > 0.8 + N3(c, 4, 2) * 0.15) return { col: lit > 0.6 ? [176, 130, 70] : [120, 86, 44], flat: true };
      if (c.e > 0.86) return { col: lit > 0.3 ? [255, 246, 196] : [140, 90, 24], flat: true };
      const f = dot(reflectV(c), FIRE) + N3(c, 2.5, 6) * 0.25;
      return { col: lit > 0.75 ? (f > 0.45 ? [255, 236, 150] : [246, 196, 76]) : lit > 0.3 ? [192, 122, 30] : [100, 60, 18], flat: true };
    },
    garnet: (c) => {
      if (c.isPip) return { col: [250, 204, 92], flat: true };
      if (!flatFace(c)) return { col: env(c, [110, 14, 30], [226, 70, 84], [255, 196, 190]), flat: true };
      return { col: MIX([112, 10, 28], [204, 40, 56], (1 - c.e) * 1.4 + (dot(reflectV(c), FIRE) > 0.6 ? 0.5 : 0)), spec: 1.3, shin: 40, specCol: [255, 236, 236] };
    },
    ivory: (c) => {
      if (c.isPip) return { col: [168, 100, 18], spec: 1, shin: 8, specCol: [255, 226, 120] };
      if (c.e > 0.8) return { col: dot(c.nw, c.key) > 0.55 ? [255, 214, 92] : [196, 136, 30], flat: true };
      const grain = Math.sin((c.p[0] + c.p[2]) / c.h * 9 + noise3(c.p[0], c.p[1], c.p[2], 3) * 2);
      return { col: MIX([250, 244, 228], [236, 226, 200], grain * 0.5 + 0.3), spec: 0.4, shin: 14 };
    },
    crystal: (c) => {
      if (c.isPip) return { col: [34, 70, 170] };
      if (!flatFace(c)) return dot(c.nw, c.key) > 0.3 ? { col: [206, 230, 246], emit: true } : { col: [150, 190, 226] };
      if (N3(c, 3.4, 17) > 0.72) return { col: [176, 204, 226], emit: true };
      const bg = c.S.b.get(c.x - Math.round(c.nw[0] * 3), c.y + Math.round(c.nw[1] * 3));
      return { col: MIX(sc(bg, 0.7), [130, 200, 255], 0.55 + c.fr * 0.3), spec: 1.4, shin: 34, specCol: [255, 255, 255] };
    },
    tooth: (c) => {
      if (c.isPip) return { col: c.big ? [255, 214, 120] : [255, 184, 72], emit: true };
      const root = -c.p[2] / c.h * 0.5 + 0.5;
      let col = MIX([244, 238, 214], [184, 140, 92], root * 1.2 - 0.3);
      if (N3(c, 2.6, 31) > 0.76 && c.pd > 0.45) col = MIX(col, [70, 44, 30], 0.6);
      return { col, spec: 0.5, shin: 14 };
    },
  };

  // dust kicked up where something lands: a few specks thrown outward, fading
  function dust(S, x, y, t0, t, col, n, emit) {
    const u = (t - t0) / 0.35;
    if (u < 0 || u > 1) return;
    const p = S.P(x, y, 0), r = rng(Math.floor(x * 31 + y * 17 + t0 * 100));
    for (let i = 0; i < (n || 5); i++) {
      const a = r() * Math.PI * 2, d = 3 + r() * 5;
      const px = p[0] + Math.cos(a) * d * ease(u), py = p[1] + Math.sin(a) * d * 0.5 * ease(u) - 2 * Math.sin(u * Math.PI);
      if (r() > u) S.b.px(px, py, col, emit);
    }
  }
  // a stamped word across the scene: LIAR!, CAUGHT!, PHOTO!
  function stamp(b, s, x, y, col, t, k) {
    if (t <= 0) return;
    k = k || 2;
    const pop = t < 0.12 ? 1 + (0.12 - t) * 4 : 1;
    const kk = Math.max(1, Math.round(k * pop));
    text(b, s, x, y - Math.round((kk - k) * 2.5), col, { k: kk, center: true, outline: [24, 14, 10] });
  }
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
  function paintItems(items) { items.sort((a, b) => b.y - a.y).forEach((it) => it.draw()); }
  function dieItems(S, list, t, lamp, items) {
    for (const d of list) {
      if (t < d.T.ti[0] - 0.02) continue;
      const st = tumbleAt(d.T, t, d.half || d.size / 2);
      st.seed = list.indexOf(d);
      d.st = st;
      items.push({ y: st.y, draw: () => {
        (d.drawFn || (d.look.mat ? dieSolid : dieDraw))(S, st, d.size, d.look, lamp);
        if (d.dustCol && d.look.sparks) { dust(S, st.x, st.y, d.T.ti[1], t, d.dustCol, 8, true); dust(S, st.x, st.y, d.T.ti[2], t, d.dustCol, 5, true); }
        else if (d.dustCol) dust(S, st.x, st.y, d.T.ti[1], t, d.dustCol, 4);
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


  // ---------- set looks, keyed by the set ids in league/content/night_games.py ----------
  const LOOKS = {
    cards_greasy: { kind: "cards", tier: 0, stock: [208, 178, 132], edge: [120, 86, 56], back: [122, 82, 52], ink: [84, 52, 32], red: [158, 54, 38], black: [58, 40, 28], greasy: true },
    cards_ledger: { kind: "cards", tier: 1, stock: [238, 230, 208], edge: [160, 150, 128], back: [234, 226, 202], ink: [52, 78, 136], red: [164, 40, 36], black: [30, 30, 36], ruled: [176, 198, 228] },
    cards_toll: { kind: "cards", tier: 2, stock: [228, 206, 158], edge: [146, 120, 80], back: [222, 198, 148], ink: [176, 48, 34], red: [174, 78, 36], black: [36, 92, 54] },
    cards_gilt: { kind: "cards", tier: 3, stock: [248, 243, 230], edge: [222, 172, 56], back: [32, 44, 94], ink: [232, 188, 76], red: [184, 28, 48], black: [32, 46, 116], gilt: true },
    // dice: shape and mat drive the solid renderer; col and pip still colour the set's icon; glint, glow, dust and sparks are the throw's effects
    dice_knuckle: { kind: "dice", tier: 0, col: [228, 210, 168], pip: [74, 40, 22], outline: [82, 58, 36], mat: "bone", pipRing: [150, 104, 60],
      shape: { ext: [1.07, 0.95, 0.92], round: 0.36, lump: 0.16, worn: 1.18 } },
    dice_shell: { kind: "dice", tier: 1, col: [242, 238, 230], pip: [92, 140, 206], outline: [124, 112, 114], mat: "shell", shape: { round: 0.16 },
      dust: [170, 150, 126] },
    dice_lamp: { kind: "dice", tier: 2, col: [218, 150, 58], pip: [40, 26, 16], outline: [86, 42, 12], glow: [255, 176, 80], mat: "lampstone", shape: { round: 0.07 } },
    dice_jet: { kind: "dice", tier: 3, col: [40, 38, 46], pip: [222, 226, 234], outline: [6, 6, 8], mat: "jet", shape: { round: 0.04, edge: 1.3 },
      glint: [200, 214, 236], dust: [120, 100, 80] },
    dice_gilt: { kind: "dice", tier: 3, col: [236, 186, 70], pip: [28, 18, 14], outline: [70, 42, 10], mat: "gilt", shape: { round: 0.1 }, glint: [255, 226, 130] },
    dice_garnet: { kind: "dice", tier: 3, col: [178, 28, 46], pip: [250, 204, 92], outline: [48, 4, 12], mat: "garnet", shape: { round: 0.04, corner: 1.42, edge: 1.3 },
      glint: [255, 190, 196] },
    dice_ivory: { kind: "dice", tier: 3, col: [246, 238, 216], pip: [200, 140, 30], outline: [100, 82, 56], mat: "ivory", shape: { round: 0.16 }, glint: [255, 226, 130] },
    dice_rime: { kind: "dice", tier: 3, col: [176, 214, 240], pip: [34, 70, 170], outline: [46, 70, 100], mat: "crystal", shape: { round: 0.05, edge: 1.32 },
      glint: [214, 236, 255], dust: [214, 228, 240] },
    dice_dragon: { kind: "dice", tier: 3, col: [226, 208, 170], pip: [255, 160, 50], outline: [56, 32, 20], mat: "tooth", pipRing: [36, 20, 12],
      shape: { ext: [0.96, 0.96, 1.08], round: 0.26, lump: 0.07, taper: 0.16 }, dust: [255, 150, 60], sparks: true },
    checkers_button: { kind: "checkers", tier: 0, men: [[230, 216, 180], [200, 154, 62]], holes: true, board: "chalk" },
    checkers_slate: { kind: "checkers", tier: 1, men: [[234, 232, 222], [78, 88, 100]], board: "slate", dusty: true },
    checkers_living: { kind: "checkers", tier: 2, men: [[230, 220, 192], [116, 70, 42]], board: "bark", shoots: true },
    checkers_inlay: { kind: "checkers", tier: 3, men: [[240, 230, 206], [44, 38, 36]], board: "pearl", turned: true },
  };
  function lookOf(rec) {
    const set = rec.set || {}, id = typeof set === "string" ? set : set.id;
    if (LOOKS[id]) return Object.assign({ id }, LOOKS[id]);
    const tier = clamp(Math.round(set.tier || 0), 0, 3), ids = Object.keys(LOOKS);
    const k = ids.find((x) => LOOKS[x].kind === rec.game && LOOKS[x].tier === tier) || ids.find((x) => LOOKS[x].kind === rec.game) || ids[0];
    return Object.assign({ id: k }, LOOKS[k]);
  }

  // ---------- the record, made safe: the goblin always takes the far seat ----------
  // Cousin Orm goes by his name, not his title
  const nameOf = (pl) => { const w = String((pl && (pl.name || pl.id)) || "SOMEONE").toUpperCase().replace(/[^A-Z0-9 '!.,-]/g, "").split(" ").filter(Boolean); return ((pl && (pl.goblin === "orm" || pl.goblin === "monster") ? w[w.length - 1] : w[0]) || "SOMEONE").slice(0, 10); };
  function seated(rec) {
    const ps = (rec.players || []).slice();
    while (ps.length < 2) ps.push({ id: "p" + ps.length, name: ps.length ? "Rival" : "Hero" });
    const out = Object.assign({}, rec, { players: ps, show: Object.assign({}, rec.show || {}) });
    if (!ps[0].goblin || ps[1].goblin) return out;
    const sw = (i) => (i === 0 ? 1 : i === 1 ? 0 : i);
    out.players = [ps[1], ps[0]].concat(ps.slice(2));
    if (rec.winner !== undefined && rec.winner !== null) out.winner = sw(rec.winner);
    if (rec.loser !== undefined && rec.loser !== null) out.loser = sw(rec.loser);
    const s = out.show;
    if (s.tricks) s.tricks = s.tricks.map((tr) => ({ cards: [(tr.cards || [])[1], (tr.cards || [])[0]], lead: sw(tr.lead || 0), taker: sw(tr.taker || 0) }));
    if (s.hands) s.hands = [s.hands[1], s.hands[0]];
    if (s.tally) s.tally = [s.tally[1], s.tally[0]];
    if (s.rolls) s.rolls = [s.rolls[1], s.rolls[0]].concat(s.rolls.slice(2));
    if (s.board) s.board = s.board.slice().reverse().map((row) => String(row).split("").reverse().map((ch) => ({ w: "b", W: "B", b: "w", B: "W" })[ch] || ch).join(""));
    if (s.moves) s.moves = s.moves.map((m) => m.map((q) => [7 - q[0], 7 - q[1]]));
    return out;
  }
  const winnerOf = (rec) => (rec.winner === 0 || rec.winner === 1 || rec.winner === 2 || rec.winner === 3 ? rec.winner : null);
  function loserOf(rec, totals) {
    if (rec.loser !== undefined && rec.loser !== null) return rec.loser;
    const w = winnerOf(rec);
    if (w === null) return null;
    if (totals && totals.length > 2) { let lo = -1; totals.forEach((v, i) => { if (i !== w && (lo < 0 || v < totals[lo])) lo = i; }); return lo; }
    return w === 0 ? 1 : 0;
  }

  // ---------- cards: small (camp) and large (tavern) sprites drawn per set ----------
  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  function card(s) {
    s = String(s || "AS").toUpperCase().trim();
    let suit = s.slice(-1), rank = s.slice(0, -1);
    if (rank === "T") rank = "10";
    if (rank === "1") rank = "A";
    if (!"SHDC".includes(suit) || !suit) suit = "S";
    if (!RANKS.includes(rank)) rank = "A";
    return { rank, suit, v: RANKS.indexOf(rank) + 2, red: suit === "H" || suit === "D", key: rank + suit };
  }
  const SUIT7 = {
    H: [".......", ".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."],
    D: ["...#...", "..###..", ".#####.", "#######", ".#####.", "..###..", "...#..."],
    S: ["...#...", "..###..", ".#####.", "#######", "#######", "...#...", "..###.."],
    C: ["..###..", "..###..", "##.#.##", "#######", "##.#.##", "...#...", "..###.."],
  };
  const SUIT5 = {
    H: [".#.#.", "#####", "#####", ".###.", "..#.."],
    D: ["..#..", ".###.", "#####", ".###.", "..#.."],
    S: ["..#..", ".###.", "#####", "..#..", ".###."],
    C: [".###.", "#.#.#", "#####", "..#..", ".###."],
  };
  const SUIT3 = { H: ["#.#", "###", ".#."], D: [".#.", "###", ".#."], S: [".#.", "###", "#.#"], C: [".#.", "#.#", ".#."] };
  // court portraits: c suit ink, g gold, f skin, e eye, h hair
  const COURT = {
    K: [".g.g.g.", ".ggggg.", ".hfffh.", ".hefeh.", "..hhh..", ".cc.cc.", "ccccccc"],
    Q: ["...g...", "..ggg..", ".hfffh.", ".hefeh.", ".hfffh.", ".cc.cc.", "ccccccc"],
    J: ["....gg.", ".cccc..", "..fff..", "..efe..", "..fff..", ".cc.cc.", "ccccccc"],
  };
  const sprites = new Map();
  function cardSprite(look, c, big, up) {
    const key = look.id + (big ? "L" : "s") + (up ? c.key : "~");
    let spr = sprites.get(key);
    if (spr) return spr;
    const w = big ? 17 : 11, h = big ? 23 : 15, px = new Array(w * h).fill(null), n = vnoise(hash(key) % 997);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cx = Math.min(x, w - 1 - x), cy = Math.min(y, h - 1 - y);
      if (cx + cy < (look.greasy ? 2 : 1)) continue;
      const edge = cx === 0 || cy === 0 || (look.greasy && cx + cy === 2);
      let col;
      if (up) {
        col = look.stock;
        if (look.ruled && y % 2 === 0 && cx > 1) col = mixc(col, look.ruled, 0.45);
        if (look.greasy) { const g = n(x * 0.3, y * 0.26); if (g > 0.64) col = mixc(col, [234, 218, 182], 0.55); else if (g < 0.3) col = mixc(col, [170, 124, 76], 0.4); }
        if (look.gilt && big && (cx === 1 || cy === 1)) col = mixc(col, look.edge, 0.35);
      } else {
        col = look.back;
        if (look.greasy) { if (cx === 2 || cy === 2) col = look.ink; else if (cx > 2 && cy > 2 && (x + y) % 2 === 0) col = sc(col, 1.1); const g = Math.hypot(x - w * 0.72, (y - h * 0.3) * 0.8) + n(x * 0.5, y * 0.5) * 3; if (g < 4.5) col = mixc(col, [196, 156, 98], 0.7); }
        else if (look.ruled) { if (y % 2 === 0 && cx > 1) col = mixc(col, look.ruled, 0.6); if (cx === 1 || cy === 1) col = look.ink; }
        else if (look.gilt) { if (cx === 1 || cy === 1) col = [246, 240, 224]; else if (cx === 2 || cy === 2) col = look.ink; else if ((x + y) % 2 === 0) col = sc(col, 1.14); }
        else if (cx === 1 || cy === 1 || ((cx === 3 || cy === 3) && big)) col = look.ink;
      }
      if (edge) col = look.edge;
      px[y * w + x] = col;
    }
    const put = (x, y, col) => { if (x >= 0 && y >= 0 && x < w && y < h && px[y * w + x]) px[y * w + x] = col; };
    const art = (rows, x0, y0, map) => rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const col = map[row[i]]; if (col) put(x0 + i, y0 + j, col); } });
    if (!up) {
      const mx = (w - 1) / 2, my = (h - 1) / 2;
      if (look.gilt) art(["#.#.#", "#####", ".....", ".###.", "#...#", ".###."], mx - 2, my - 3, { "#": look.ink });
      else if (look.ruled) art(["#####", "#.#.#", "#####", "#.#.#", "#####"], mx - 2, my - 2, { "#": look.ink });
      else if (look.greasy) art([".ooooo.", "oPpPpPo", "opPpPpo", ".ooooo."], mx - 3, my - 1, { o: [70, 42, 24], P: [214, 168, 100], p: [176, 124, 70] });
      else art([".###.", "#...#", "#.#.#", "#...#", ".###."], mx - 2, my - 2, { "#": look.ink });
    } else {
      const ink = c.red ? look.red : look.black;
      const rank = (x0, y0) => {
        if (c.rank === "10") { for (let j = 0; j < 5; j++) put(x0, y0 + j, ink); art(["###", "#.#", "#.#", "#.#", "###"], x0 + 2, y0, { "#": ink }); return; }
        const g = glyph(c.rank);
        for (let j = 0; j < 5; j++) for (let i = 0; i < g.w; i++) if (g.on(i, j)) put(x0 + i, y0 + j, ink);
      };
      const courtMap = { c: ink, g: look.gilt ? [236, 184, 60] : [206, 160, 60], f: [236, 196, 156], e: [44, 32, 30], h: c.rank === "Q" ? [196, 120, 50] : [120, 78, 40] };
      const court = COURT[c.rank];
      if (!big) {
        rank(2, 2);
        if (court) { art(SUIT3[c.suit], 7, 2, { "#": ink }); art(court, 2, 7, courtMap); }
        else art(SUIT7[c.suit], 2, 7, { "#": ink });
      } else {
        rank(2, 2);
        rank(w - 2 - (c.rank === "10" ? 5 : glyph(c.rank).w), h - 7);
        if (court) { art(court, 5, 5, courtMap); art(SUIT5[c.suit], 6, 13, { "#": ink }); }
        else {
          art(SUIT7[c.suit], 5, 8, { "#": ink });
          if (c.rank === "A") for (const [dx, dy] of [[-2, -2], [8, -2], [-2, 8], [8, 8]]) put(5 + dx, 8 + dy, look.gilt ? look.edge : ink);
        }
        art(SUIT3[c.suit], 2, 8, { "#": ink });
        art(SUIT3[c.suit], w - 5, h - 11, { "#": ink });
      }
    }
    if (look.greasy) { put(w - 3, 1, sc(px[w + w - 3] || look.stock, 1.2)); put(w - 2, 2, sc(px[2 * w + w - 2] || look.stock, 1.2)); put(w - 3, 2, sc(px[2 * w + w - 3] || look.stock, 0.7)); }
    spr = { w, h, px };
    sprites.set(key, spr);
    return spr;
  }
  // a sprite drawn at a screen centre, turned by a, squeezed across by sx (a flip), scaled by k; tint scales its colours
  function blit(b, spr, x, y, a, sx, k, tint) {
    const c = Math.cos(a), s = Math.sin(a), hw = spr.w / 2, hh = spr.h / 2, R = Math.ceil(Math.hypot(hw * k, hh * k)) + 1;
    x = Math.round(x * 2) / 2; y = Math.round(y * 2) / 2;
    for (let py = Math.floor(y - R); py <= y + R; py++) for (let px = Math.floor(x - R); px <= x + R; px++) {
      const dx = px + 0.5 - x, dy = py + 0.5 - y;
      const u = Math.floor((dx * c + dy * s) / (k * sx) + hw), v = Math.floor((-dx * s + dy * c) / k + hh);
      if (u < 0 || v < 0 || u >= spr.w || v >= spr.h) continue;
      const col = spr.px[v * spr.w + u];
      if (!col) continue;
      if (tint === "shadow") b.mul(px, py, 0.5);
      else b.px(px, py, tint ? sc(col, tint) : col);
    }
  }
  // a card at screen (x, y): f 0 lies face down, 1 face up; z lifts it (bigger, with a shadow cast down and to the side)
  function drawCard(b, look, c, big, x, y, a, f, z, tint) {
    z = z || 0;
    const sx = Math.cos(clamp(f, 0, 1) * Math.PI), k = 1 + z * 0.012, spr = cardSprite(look, c, big, sx < 0);
    const ax = Math.max(0.12, Math.abs(sx));
    if (z > 0.3) blit(b, spr, x + 1 + z * 0.35, y + 1 + z * 0.45, a, ax, 1, "shadow");
    else blit(b, spr, x + 1, y + 1, a, ax, 1, "shadow");
    blit(b, spr, x, y - z * 0.8, a, ax, k, tint);
  }
  // a deck squared up on the table: its depth shows as stacked edges
  function drawDeck(b, look, x, y, count, big) {
    const spr = cardSprite(look, card("AS"), big, false), th = Math.min(6, Math.ceil(count / 5));
    const page = cardSprite(look, card("2S"), big, true);
    blit(b, spr, x + 1, y + 1, 0, 1, 1, "shadow");
    for (let i = th; i >= 1; i--) blit(b, page, x, y - th + i, 0, 1, 1, i % 2 ? 0.62 : 0.78);
    if (count > 0) blit(b, spr, x, y - th, 0, 1, 1);
  }
  function sparkle(b, x, y, s, col) {
    x = Math.round(x); y = Math.round(y);
    b.px(x, y, [255, 255, 236], true);
    for (let i = 1; i <= s; i++) { const cc = i === s ? sc(col, 0.8) : col; b.px(x + i, y, cc, true); b.px(x - i, y, cc, true); b.px(x, y + i, cc, true); b.px(x, y - i, cc, true); }
  }

  // the poker name of five cards, for the tavern's showdown
  function handName(cs) {
    const v = cs.map((c) => c.v).sort((a, b) => b - a), cnt = {};
    v.forEach((x) => (cnt[x] = (cnt[x] || 0) + 1));
    const groups = Object.entries(cnt).map(([k, n]) => [n, +k]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const flush = cs.length === 5 && cs.every((c) => c.suit === cs[0].suit);
    const uniq = [...new Set(v)], wheel = uniq.join() === "14,5,4,3,2";
    const straight = cs.length === 5 && uniq.length === 5 && (v[0] - v[4] === 4 || wheel);
    const NAMES = { 2: "TWOS", 3: "THREES", 4: "FOURS", 5: "FIVES", 6: "SIXES", 7: "SEVENS", 8: "EIGHTS", 9: "NINES", 10: "TENS", 11: "JACKS", 12: "QUEENS", 13: "KINGS", 14: "ACES" };
    if (straight && flush) return "STRAIGHT FLUSH";
    if (groups[0][0] === 4) return "FOUR " + NAMES[groups[0][1]];
    if (groups[0][0] === 3 && groups[1] && groups[1][0] === 2) return "FULL HOUSE";
    if (flush) return "FLUSH";
    if (straight) return "STRAIGHT";
    if (groups[0][0] === 3) return "THREE " + NAMES[groups[0][1]];
    if (groups[0][0] === 2 && groups[1] && groups[1][0] === 2) return "TWO PAIR";
    if (groups[0][0] === 2) return "PAIR OF " + NAMES[groups[0][1]];
    return (RANKS[v[0] - 2] === "A" ? "ACE" : RANKS[v[0] - 2] === "K" ? "KING" : RANKS[v[0] - 2] === "Q" ? "QUEEN" : RANKS[v[0] - 2] === "J" ? "JACK" : RANKS[v[0] - 2]) + " HIGH";
  }
  function tricksOf(rec, r) {
    const s = rec.show || {}, w = winnerOf(rec);
    if (s.tricks && s.tricks.length) return s.tricks.slice(0, 13).map((tr, i) => ({ cards: [card((tr.cards || [])[0]), card((tr.cards || [])[1])], lead: tr.lead === 1 ? 1 : 0, taker: tr.taker === 1 ? 1 : tr.taker === 0 ? 0 : i % 2 }));
    const hs = handsOf(rec, r);
    return hs[0].map((c, i) => ({ cards: [c, hs[1][i]], lead: i % 2, taker: c.v === hs[1][i].v ? (w === null ? i % 2 : w) : c.v > hs[1][i].v ? 0 : 1 }));
  }
  function handsOf(rec, r) {
    const s = rec.show || {}, pick = () => RANKS[Math.floor(r() * 13)] + "SHDC"[Math.floor(r() * 4)];
    let hs = [[], []];
    if (s.hands && s.hands[0] && s.hands[1]) hs = [s.hands[0].slice(0, 5), s.hands[1].slice(0, 5)];
    else if (s.tricks && s.tricks.length) hs = [0, 1].map((k) => s.tricks.slice(0, 5).map((tr) => (tr.cards || [])[k]));
    return hs.map((h) => { h = h.slice(); while (h.length < 5) h.push(pick()); return h.map(card); });
  }

  // ---------- stake tokens: chunky, outlined icons that read at a glance ----------
  const ICONS = {
    first_watch: { rows: [
      ".ooooooooo.", "oWWWWWWWWWo", "owwwwwwwwwo", ".ooooooooo.", ".w.ogggo.w.", ".wogggggow.", ".wosssssow.", ".w.ossso.w.", ".w..oso..w.",
      ".w...s...w.", ".w..ogo..w.", ".w.ogsgo.w.", ".wogggggow.", ".wogsssgow.", ".wosssssow.", ".w.ooooo.w.", ".ooooooooo.", "oWWWWWWWWWo", "owwwwwwwwwo", ".ooooooooo."],
      pal: { o: [58, 36, 20], W: [214, 160, 92], w: [156, 104, 56], g: [150, 196, 214], s: [240, 200, 106] } },
    cooks_tomorrow: { rows: [
      "....oooooo........", "..ooIIIIIIoo......", ".oIiieeeeiiIo.....", ".oieeeYYeeeio.....", "oIieeYYYYeeiIohhhh", "oIieeeYYeeeiIohhhh",
      ".oiieeeeeeiio.....", ".oIiiiiiiiiIo.....", "..ooIIIIIIoo......", "....oooooo........"],
      pal: { o: [30, 30, 34], I: [120, 120, 130], i: [70, 70, 78], e: [248, 244, 232], Y: [252, 186, 36], h: [140, 90, 48] } },
    carries_pack: { rows: [
      "...rrrrrrr...", "..rRRRRRRRr..", "..rrrrrrrrr..", ".bbbbbbbbbbb.", ".bBBBBBBBBBb.", ".bBffffffBBb.", ".bffffffffBb.", ".bfffkkfffBb.",
      ".bBBBkkBBBBb.", "sbBBBBBBBBBbs", "sbBBBBBBBBBbs", "sbBppppppBBbs", ".bBppppppBBb.", ".bbbbbbbbbbb."],
      pal: { b: [96, 60, 32], B: [162, 108, 60], f: [128, 82, 44], k: [236, 196, 84], r: [150, 70, 54], R: [198, 108, 84], s: [74, 48, 28], p: [140, 92, 52] } },
    names_pet: { rows: [
      "......o......", ".....o.o.....", "....ttttt....", "..ttTTTTTtt..", ".tTTpTTTpTTt.", ".tTTpTTTpTTt.", "tTpTTTTTTTpTt", "tTppTpppTppTt",
      "tTTTpppppTTTt", "tTTpppppppTTt", ".tTpppppppTt.", ".tTTpppppTTt.", "..ttTTTTTtt..", "....ttttt...."],
      pal: { o: [150, 150, 156], t: [168, 120, 40], T: [234, 186, 80], p: [84, 52, 26] } },
    washes_pots: { rows: [
      "...U.....u.....", "..U.U...u.u....", "...U.....u..U..", "...........U.U.", "..FFF.FFFF..U..", ".FFFFFFFFFFFF..", "oIIIIIIIIIIIIIo",
      "ooiiiiiiiiiiioo", ".oiWiiiiiiiiio.", ".oiWiiiiiiiiio.", ".oiiiiiiiiiiio.", "..oiiiiiiiiio..", "...ooooooooo..."],
      pal: { o: [70, 36, 20], I: [232, 150, 88], i: [184, 100, 54], W: [246, 196, 140], F: [244, 248, 250], u: [170, 210, 234], U: [226, 242, 250] } },
    keepsake: { rows: [
      "o.........o", ".o.......o.", "..o.....o..", "...o...o...", "....ooo....", "...ggggg...", "..gGGGGGg..", ".gGGWrGGGg.", ".gGGrrrGGg.", ".gGGrrrGGg.", ".gGGGrGGGg.", "..gGGGGGg..", "...ggggg..."],
      pal: { o: [196, 176, 124], g: [150, 104, 30], G: [238, 190, 74], W: [255, 244, 200], r: [190, 40, 52] } },
    silver: { rows: [
      "..oooooo..", ".oWWSSSSo.", "oSSSssSSSo", "oSSsSSsSSo", ".oSSSSSSo.", "oeeeeeeeeo", "oEEEEEEEEo", "oeeeeeeeeo", "oEEEEEEEEo", "oeeeeeeeeo", ".oooooooo."],
      pal: { o: [60, 62, 70], S: [206, 210, 218], s: [150, 154, 164], W: [252, 252, 255], e: [150, 154, 164], E: [196, 200, 208] } },
  };
  function setIcon(look) {
    if (look.kind === "checkers") {
      const rows = [];
      for (let y = 0; y < 14; y++) { let s = ""; for (let x = 0; x < 14; x++) s += x === 0 || y === 0 || x === 13 || y === 13 ? "o" : (Math.floor((x - 1) / 3) + Math.floor((y - 1) / 3)) % 2 ? "d" : "l"; rows.push(s); }
      for (const [x, y, ch] of [[1, 1, "m"], [7, 4, "m"], [4, 7, "n"], [10, 10, "n"]]) for (let j = 0; j < 2; j++) rows[y + j] = rows[y + j].slice(0, x) + ch + ch + rows[y + j].slice(x + 2);
      return { rows, pal: { o: [60, 40, 24], d: [92, 60, 38], l: [214, 176, 120], m: look.men[0], n: look.men[1] } };
    }
    if (look.kind === "dice") return { rows: ["oooooo....", "oCCCCo....", "oCpCCo....", "oCCCCoooooo", "oCCCpoCCCCo", "oooooooCpCo", ".....oCCCCo", ".....oCpCCo", ".....oooooo"], pal: { o: look.outline, C: look.col, p: look.pip } };
    return { rows: ["oooooooo...", "obbbbbbo...", "obiiiibooo.", "obiiibbsso", "obbbbbbsso", "obiiiibsso", "obbbbbbsso", "oooooooosso", "...ossssso", "...oooooo."], pal: { o: look.edge, b: look.back, i: look.ink, s: look.stock } };
  }
  function iconOf(kind, look) {
    const ic = kind === "set" ? setIcon(look) : ICONS[kind];
    return ic || null;
  }
  // an icon at 1x with a dark outline all round and a drop shadow, so it reads on any table
  function drawIcon(b, ic, x, y, k) {
    k = k || 1;
    const rows = ic.rows, h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const at = (i, j) => (j >= 0 && j < h && i >= 0 && i < rows[j].length && rows[j][i] !== "." && ic.pal[rows[j][i]]) ? ic.pal[rows[j][i]] : null;
    x = Math.round(x - (w * k) / 2); y = Math.round(y - h * k);
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
      if (at(i, j)) continue;
      if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) b.rect(x + i * k, y + j * k, k, k, [24, 16, 10], true);
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = at(i, j); if (c) b.rect(x + i * k, y + j * k, k, k, c, true); }
    return { x, y, w: w * k, h: h * k };
  }
  const STAKE_WORDS = { first_watch: "FIRST WATCH", cooks_tomorrow: "COOKS TOMORROW", carries_pack: "CARRIES THE PACK", names_pet: "NAMES THE NEXT PET",
    washes_pots: "WASHES THE POTS", set: "HANDS OVER THE SET", keepsake: "GIVES THE KEEPSAKE", silver: "PAYS" };
  // the loser's stake: the token drops onto the table with a bounce, then a paper tag says who owes what
  function stakeToken(b, rec, look, t, x, y) {
    const kind = rec.stake;
    if (x === undefined) { x = W - 12; y = H - 4; }
    if (!kind || t < 0) return;
    const ic = iconOf(kind, look);
    const lo = loserOf(rec, rec._totals);
    if (!ic || lo === null) return;
    const u = clamp(t / 0.32, 0, 1), drop = u < 1 ? -26 * (1 - u * u) : -Math.abs(Math.sin(Math.min(1, (t - 0.32) / 0.3) * Math.PI)) * 4 * (1 - Math.min(1, (t - 0.32) / 0.3));
    const box = drawIcon(b, ic, x, y + drop, 1);
    if (t > 0.45) {
      const who = nameOf(rec.players[lo]);
      const word = kind === "silver" ? `PAYS ${money(rec.stake_cp || 10)}` : STAKE_WORDS[kind];
      const lines = [who, word], tw = Math.max(textWidth(lines[0]), textWidth(lines[1])) + 6;
      let tx = Math.round(box.x + box.w + 4), ty = Math.round(y - 16);
      if (tx + tw > W - 2) tx = Math.round(box.x - tw - 4);
      const slide = Math.round((1 - ease3(clamp((t - 0.45) / 0.25, 0, 1))) * 6);
      b.rect(tx + 1, ty + 1 + slide, tw, 16, [16, 10, 6], true);
      b.rect(tx, ty + slide, tw, 16, [232, 214, 170], true);
      for (let i = 0; i < tw; i += 3) b.px(tx + i, ty + 15 + slide, [206, 186, 142], true);
      text(b, lines[0], tx + 3, ty + 2 + slide, [70, 46, 28]);
      text(b, lines[1], tx + 3, ty + 9 + slide, [150, 44, 30]);
    }
  }

  // ---------- the goblin and the troll, peeking over the far edge ----------
  // mood: "watch" (eyes follow the play), "glee" (ears up, a hop), "sad" (ears down, eyes down)
  function peek(b, who, ax, ay, o) {
    const mask = o.mask, wall = o.wall, look = clamp(((o.look === undefined ? ax : o.look) - ax) / 50, -1, 1);
    const free = (x, y) => !mask || x < 0 || y < 0 || x >= W || y >= H || !mask[Math.floor(y) * W + Math.floor(x)];
    const put = (x, y, col, always) => { if (always || free(x, y)) b.px(x, y, col); };
    const blink = (wall % 3.7) < 0.12 || (o.mood === "sad" && (wall % 2.2) < 0.4);
    const mood = o.mood || "watch", hop = mood === "glee" ? -Math.abs(Math.sin(wall * 10)) * 3 : 0;
    ay += hop;
    if (who === "orm") {
      const st = vnoise(77);
      b.ell(ax, ay - 6, 30, 20, (nx, ny, x, y) => {
        const f = 0.62 + 0.5 * clamp(nx * 0.5 - ny * 0.6 + 0.2, 0, 1), v = st(x * 0.35, y * 0.35);
        let col = sc([118, 130, 110], f * (0.86 + v * 0.26));
        if (ny < -0.55 + Math.sin(nx * 9) * 0.12) col = sc(v > 0.5 ? [92, 130, 58] : [76, 112, 48], f + 0.1);
        if (Math.abs(st(x * 0.8, y * 0.3) - 0.5) < 0.03 && ny > -0.4) col = sc(col, 0.7);
        put(x, y, col);
      });
      for (const s of [-1, 1]) b.ell(ax + s * 29, ay - 6, 5, 6, (nx, ny, x, y) => put(x, y, sc([110, 122, 102], 0.7 + 0.3 * clamp(-ny, 0, 1))));
      for (let i = -14; i <= 14; i++) put(ax + i, ay - 14 + Math.round(Math.abs(i) * 0.15), [80, 86, 72]);
      for (const s of [-1, 1]) {
        const ex = Math.round(ax + s * 8 + look * 2), ey = Math.round(ay - 11);
        b.rect(ex - 3, ey - 3, 6, 1, [70, 78, 64]);
        if (blink || mood === "sad") { b.rect(ex - 2, ey + 1, 4, 1, [34, 36, 30]); }
        else { b.rect(ex - 2, ey - 1, 4, 3, [236, 232, 200]); b.rect(ex - 1 + Math.round(look * 0.6), ey - 1, 2, 3, [28, 30, 24]); b.px(ex - 1 + Math.round(look * 0.6), ey - 1, [250, 250, 236]); }
      }
      b.ell(ax + look * 2, ay - 2, 7.5, 5.5, (nx, ny, x, y) => b.px(x, y, nx * nx + ny * ny > 0.78 ? [70, 76, 62] : sc([150, 156, 134], 0.72 + 0.45 * clamp(nx * 0.4 - ny * 0.7 + 0.2, 0, 1))));
      b.px(Math.round(ax + look * 2 - 2), Math.round(ay), [50, 52, 44]); b.px(Math.round(ax + look * 2 + 2), Math.round(ay), [50, 52, 44]);
      return;
    }
    const G = [112, 162, 78], DK = [46, 76, 36], ear = mood === "glee" ? -6 : mood === "sad" ? 6 : 1 + Math.sin(wall * 2.3) * 0.8;
    for (const sd of [-1, 1]) {
      const x0 = ax + sd * 9, y0 = ay - 9, x1 = ax + sd * 34, y1 = ay - 4 + ear + (sd > 0 ? Math.sin(wall * 1.7) * 0.6 : 0);
      for (let k = 0; k <= 30; k++) {
        const u = k / 30, x = lerp(x0, x1, u), y = lerp(y0, y1, u) - Math.sin(u * Math.PI) * 2, wd = (1 - u) * 4.2 + 0.6;
        for (let j = -Math.ceil(wd); j <= Math.ceil(wd); j++) {
          if (Math.abs(j) > wd) continue;
          const col = Math.abs(j) > wd - 1 ? DK : j > -0.5 && Math.abs(j) < wd - 1.6 && u < 0.8 ? [204, 140, 118] : sc(G, j < 0 ? 1.1 : 0.95);
          put(x, y + j, col);
        }
      }
    }
    b.ell(ax, ay - 5, 13, 11, (nx, ny, x, y) => put(x, y, nx * nx + ny * ny > 0.84 ? DK : sc(G, 0.72 + 0.48 * clamp(nx * 0.55 - ny * 0.5 + 0.2, 0, 1))));
    for (const sd of [-1, 1]) {
      const ex = Math.round(ax + sd * 5 - 1), ey = Math.round(ay - 10);
      if (blink) { b.rect(ex - 1, ey + 2, 5, 1, DK); continue; }
      b.rect(ex - 1, ey, 5, 4, DK);
      b.rect(ex, ey, 3, 4, [240, 226, 150]);
      b.rect(ex - 1, ey + 1, 5, 2, [240, 226, 150]);
      const pxl = ex + 1 + Math.round(look), pyl = ey + (mood === "sad" ? 2 : 1);
      b.rect(pxl, pyl, 1, 2, [22, 18, 10]);
      b.px(pxl - (look > 0 ? 1 : -1) * 0, pyl - 1 + (mood === "sad" ? 0 : 0), [255, 252, 230]);
    }
    const brimY = ay - 15 + (mood === "glee" ? Math.round(Math.sin(wall * 10)) : 0);
    b.ell(ax + 2, brimY - 5, 10, 6.5, (nx, ny, x, y) => put(x, y, sc(nx > 0.15 && ny < -0.1 ? [150, 116, 72] : [120, 88, 54], 0.8 + 0.3 * clamp(nx, 0, 1))));
    b.rect(ax + 4, brimY - 9, 4, 3, [164, 136, 88]); b.px(ax + 4, brimY - 9, [96, 70, 40]); b.px(ax + 7, brimY - 7, [96, 70, 40]);
    b.ell(ax, brimY, 28, 5.5, (nx, ny, x, y) => put(x, y, ny > 0.5 ? [62, 42, 24] : sc((x * 3 + y) % 7 === 0 ? [136, 102, 62] : [114, 84, 50], 0.85 + 0.25 * clamp(-ny, 0, 1))));
    const nx0 = ax + Math.round(look * 1.5), ny0 = ay - 8;
    const NOSE = [".dGGd.", "dgGGGd", "dgGGGd", "dgGGGd", "dgGGGd", ".dgGGd", ".dgGd.", "..dGd.", "..dd.."];
    NOSE.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch !== ".") b.px(nx0 - 3 + i, ny0 + j, ch === "d" ? DK : ch === "g" ? [100, 146, 66] : [146, 194, 100]); } });
    b.px(nx0, ny0 + 2, [196, 226, 150]);
  }
  // a talking monster from the road borrows Orm's seat until its own art lands (owner picks the concept first)
  const goblinOf = (rec) => { const g = rec.players[1] && rec.players[1].goblin; return g === "orm" || g === "monster" ? "orm" : g ? "nib" : null; };
  function peekMood(rec, p, t) {
    const w = winnerOf(rec);
    if (t > p.tEnd) return w === 1 ? "glee" : w === 0 ? "sad" : "watch";
    for (const m of p.moods || []) if (t >= m[0] && t < m[0] + 0.9) return m[1];
    return "watch";
  }
  const GOBLIN_SND = { glee: "hee", sad: "sniff" };

  // ---------- the camp: a crate by the fire at night ----------
  function campfire(b, x, y, wall, k) {
    k = k || 1;
    for (const [ox, hh, ph] of [[-8, 0.5, 5.2], [-5, 0.8, 0.0], [-2, 1.1, 1.3], [1, 1.25, 2.1], [4, 0.95, 3.3], [7, 0.62, 4.4]]) {
      const h = Math.round((12 + Math.sin(wall * 9 + ph * 3) * 3 + Math.sin(wall * 23 + ph) * 1.5) * hh * k);
      const sway = Math.sin(wall * 5.5 + ph) * 1.6;
      for (let j = 0; j < h; j++) {
        const u = j / h, wd = Math.max(0, Math.round((1 - u) * 2.4 * k * hh + 0.2));
        const xx = Math.round(x + ox * k + sway * u * u * 2), yy = Math.round(y - j);
        const col = u < 0.22 ? [255, 246, 196] : u < 0.48 ? [255, 208, 92] : u < 0.76 ? [246, 134, 42] : [198, 68, 30];
        for (let i = -wd; i <= wd; i++) b.px(xx + i, yy, Math.abs(i) === wd && wd > 0 ? (u < 0.48 ? [250, 160, 52] : [186, 62, 28]) : col, true);
      }
    }
    for (let i = 0; i < 10; i++) {
      const life = 1.3 + (i % 3) * 0.35, ph = ((wall + i * 0.41) % life) / life;
      const sx = x + Math.sin(i * 12.9) * 7 * k + Math.sin(wall * 3 + i) * 3 * ph, sy = y - 9 * k - ph * 44 * k;
      if (ph < 0.85) b.px(sx, sy, ph < 0.4 ? [255, 232, 150] : [236, 120, 40], true);
    }
  }
  const CAMP = { GZ: -24, hw: 50, hd: 32 };
  function campBase(p, o) {
    const S = new Scene(p.cam, { key: [-0.55, -0.5, 0.68], lo: [0.84, 0.86, 0.94], hi: [1.08, 0.98, 0.84] });
    const n = vnoise(201), g = vnoise(203), { GZ, hw, hd } = CAMP, F = o.fire;
    S.b.fill([12, 14, 12]);
    S.plane([[-400, 400, GZ], [400, 400, GZ], [400, -400, GZ], [-400, -400, GZ]], 2, GZ, (x, y) => {
      const v = g(x * 0.1, y * 0.1), m = n(x * 0.04, y * 0.04);
      let col = m > 0.52 ? [62, 76, 44] : [80, 66, 48];
      if (n(x * 0.5 + 30, y * 0.5) > 0.8) col = [92, 112, 58];
      if (n(x * 0.3 + 90, y * 0.3) > 0.85) col = [132, 96, 54];
      return sc(col, 0.78 + v * 0.36);
    });
    S.drop(0, -4, GZ + 2, 62, 0.5, null, GZ);
    // the fire pit: a ring of stones, an ash bed, two logs crossed
    if (F) {
      const c = S.P(F[0], F[1], GZ), r = S.cam.scale(F[0], F[1], GZ);
      S.b.ell(c[0], c[1], 13 * r, 10 * r, (nx, ny, x, y) => S.b.px(x, y, sc([44, 38, 34], 0.8 + n(x, y) * 0.3)));
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2, sx = F[0] + Math.cos(a) * 14, sy = F[1] + Math.sin(a) * 11, q = S.P(sx, sy, GZ + 1);
        S.b.ell(q[0], q[1], 4 * r, 3 * r, (nx, ny, x, y) => S.b.px(x, y, S.shade([118, 112, 104], 0.7 + 0.5 * clamp(-nx * 0.3 - ny * 0.8, 0, 1))));
      }
      S.box([F[0], F[1], GZ + 2.5], [11, 2.4, 2.4], Rz(0.45), [86, 56, 34], { outline: [34, 22, 14] });
      S.box([F[0], F[1] + 1, GZ + 5], [11, 2.4, 2.4], Rz(-0.6), [96, 64, 38], { outline: [34, 22, 14] });
    }
    // the crate: slatted sides with a brace, planked top with nail heads
    const nails = [];
    S.plane([[-hw, -hd, 0], [hw, -hd, 0], [hw, -hd, GZ], [-hw, -hd, GZ]], 1, -hd, (x, y, z) => {
      const zz = z - GZ, sl = Math.floor(zz / 8), sz = zz % 8, post = Math.abs(x) > hw - 5;
      let f = 0.8 + n(x * 0.15 + sl * 7, sz * 0.5) * 0.3;
      if (post) f = 0.92 + n(x, z) * 0.1;
      else if (sz < 1) f *= 0.4;
      const brace = Math.abs((x + hw) / (2 * hw) - zz / -GZ) < 0.06;
      if (brace && !post) f = 1.04 + n(x, z) * 0.1;
      if (Math.abs(Math.abs(x) - (hw - 5)) < 0.6) f *= 0.6;
      return sc([132, 92, 56], f);
    });
    const plank = (2 * hd) / 5;
    S.plane([[-hw, -hd, 0], [hw, -hd, 0], [hw, hd, 0], [-hw, hd, 0]], 2, 0, (x, y) => {
      const pl = Math.floor((y + hd) / plank), py = (y + hd) % plank, off = pl * 31.7;
      let f = 0.78 + n(x * 0.05 + off, py * 0.45) * 0.4 + ((pl * 5) % 3) * 0.04;
      if (py < 1.1) f *= 0.4;
      if (Math.abs(Math.abs(x) - (hw - 3)) < 1 && Math.abs(py - plank / 2) < 1.2) f = 1.4;
      return sc([150, 108, 66], f);
    });
    void nails;
    const a = S.P(-hw, -hd, 0), c2 = S.P(hw, -hd, 0);
    S.b.line(a[0], a[1], c2[0], c2[1], [184, 140, 92]);
    p.mask = new Uint8Array(W * H);
    const top = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map((q) => S.P(q[0], q[1], 0));
    const front = [[-hw, -hd, 0], [hw, -hd, 0], [hw, -hd, GZ], [-hw, -hd, GZ]].map((q) => S.P(q[0], q[1], q[2]));
    for (const poly of [top, front]) { const m = new Buf(); m.poly(poly, [1, 1, 1]); for (let i = 0; i < W * H; i++) if (m.c[i * 3]) p.mask[i] = 1; }
    p.peekY = Math.round(S.P(0, hd, 0)[1]) + 2;
    // a tin mug and a rolled bedroll, so the crate sits in a camp
    if (o.mug) { S.drop(o.mug[0], o.mug[1], 4, 4, 0.5, [-60, -60, 40]); S.cyl([o.mug[0], o.mug[1], 0], 3.4, 7, [126, 130, 136], { capCol: [60, 40, 26], rim: [80, 84, 90] }); }
    if (o.roll) {
      const R = Rz(0.25);
      S.cyl([o.roll[0], o.roll[1], GZ + 7], 7, 30, [120, 64, 50], { R: mm(R, Ry(Math.PI / 2)), n: 18, sideFn: (i, nn, c) => (i % 5 === 0 ? sc(c, 0.7) : c), capCol: [150, 84, 64] });
    }
    return S;
  }
  const campLamps = (p, wall) => {
    const fl = 1 + Math.sin(wall * 11) * 0.05 + Math.sin(wall * 4.7) * 0.05 + Math.sin(wall * 27) * 0.025;
    const c = p.cam.p(p.fire[0], p.fire[1], CAMP.GZ + 10);
    return { c, fl, amb: [0.2, 0.22, 0.3], lamps: [{ x: c[0], y: c[1], r: 230 * fl, i: 1.15, c: [1.12, 0.8, 0.5], p: 1.15, sy: 1.0 }], glows: [[c[0], c[1] + 4, 22 * fl, [255, 140, 50], 0.35]] };
  };

  const SCENES = {};

  // ===== cards at camp: the deck on a crate by the fire; cards slide off the stack, tricks are played and swept =====
  SCENES.cards_camp = {
    cam: { pitch: 62, dist: 420, focal: 420 * 1.42, target: [0, -2, 0], cy: 62 },
    plan(rec, r) {
      const tricks = tricksOf(rec, r), shown = tricks.slice(-3), early = tricks.slice(0, tricks.length - shown.length);
      const won0 = [0, 0];
      early.forEach((tr) => won0[tr.taker]++);
      const T0 = 0.5, DEAL = 0.13, nd = shown.length, deal = [];
      for (let k = 0; k < nd; k++) for (const who of [0, 1]) deal.push({ who, slot: k, t: T0 + (k * 2 + who) * DEAL });
      const tPlay = T0 + nd * 2 * DEAL + 0.4, TR = 1.3;
      const plays = shown.map((tr, k) => { const t0 = tPlay + k * TR; return Object.assign({}, tr, { k, t: [tr.lead === 0 ? t0 : t0 + 0.4, tr.lead === 1 ? t0 : t0 + 0.4], tGlint: t0 + 0.84, tSweep: t0 + 0.98 }); });
      const tEnd = tPlay + nd * TR + 0.15;
      const ev = [[0, "fire", tEnd + 3], [T0 - 0.3, "riffle"]];
      deal.forEach((d) => ev.push([d.t, "slide", 0.5]));
      plays.forEach((pl) => { for (const who of [0, 1]) { ev.push([pl.t[who], "slide", 0.7]); ev.push([pl.t[who] + 0.14, "flip"]); ev.push([pl.t[who] + 0.3, "snap"]); } ev.push([pl.tGlint, "glint"]); ev.push([pl.tSweep, "sweep"]); });
      ev.push([tEnd, winnerOf(rec) === null ? "lose" : "win"]);
      if (rec.stake) ev.push([tEnd + 0.62, "token", rec.stake]);
      return { shown, won0, deal, plays, tEnd, T0, dur: tEnd + 1.4, ev, fire: [-56, -41], deckN: 24 + nd * 2 };
    },
    base(p) { return campBase(p, { fire: p.fire, mug: [44, 22], roll: [70, -10] }); },
    spots: {
      hand: (who, k) => [-14 + k * 14, who === 0 ? -21 : 21],
      mid: (who) => (who === 0 ? [-5, -2] : [6, 3]),
      pile: (who) => (who === 0 ? [36, -14] : [36, 15]),
      deck: [-36, 0],
    },
    draw(S, p, rec, look, t, wall) {
      const b = S.b, sp = SCENES.cards_camp.spots, P = (q, z) => S.P(q[0], q[1], z || 0);
      const dealt = p.deal.filter((d) => t >= d.t).length;
      const dk = P(sp.deck);
      drawDeck(b, look, dk[0], dk[1], p.deckN - dealt, true);
      // the won piles: earlier tricks face down, then each swept trick on top
      for (const who of [0, 1]) {
        const swept = p.plays.filter((pl) => pl.taker === who && t >= pl.tSweep + 0.32);
        const n = p.won0[who] + swept.length;
        if (!n) continue;
        const q = P(sp.pile(who));
        for (let i = 0; i < Math.min(4, p.won0[who]); i++) drawCard(b, look, card("AS"), true, q[0] + i * 0.5, q[1] - i, 0.06 * (i % 2 ? 1 : -1), 0, 0);
        swept.forEach((pl, i) => {
          const off = Math.min(4, p.won0[who]) + i * 2;
          drawCard(b, look, pl.cards[1 - who], true, q[0] - 2, q[1] - off, -0.1, 1, 0);
          drawCard(b, look, pl.cards[who], true, q[0] + 2, q[1] - off - 1, 0.08, 1, 0);
        });
      }
      // hands lying face down, then each card's run: dealt off the stack, played to the middle face up, swept to the taker
      for (const d of p.deal) {
        if (t < d.t) continue;
        const pl = p.plays[d.slot], hand = sp.hand(d.who, d.slot);
        const tPlay = pl.t[d.who];
        if (t >= pl.tSweep + 0.32) continue;
        let pos, a, f = 0, z = 0;
        if (t < d.t + 0.3) {
          const u = ease3(seg(t, d.t, d.t + 0.3));
          pos = [lerp(sp.deck[0], hand[0], u), lerp(sp.deck[1], hand[1], u)]; a = lerp(0, (d.slot - 1) * 0.06, u); z = Math.sin(u * Math.PI) * 2;
        } else if (t < tPlay) { pos = hand; a = (d.slot - 1) * 0.06; }
        else if (t < tPlay + 0.3) {
          const u = ease(seg(t, tPlay, tPlay + 0.3)), m = sp.mid(d.who);
          pos = [lerp(hand[0], m[0], u), lerp(hand[1], m[1], u)]; a = lerp((d.slot - 1) * 0.06, d.who ? 0.14 : -0.1, u); f = smooth(u); z = Math.sin(u * Math.PI) * 7;
        } else if (t < pl.tSweep) { pos = sp.mid(d.who); a = d.who ? 0.14 : -0.1; f = 1; z = d.who === pl.taker && t > pl.tGlint ? Math.sin(seg(t, pl.tGlint, pl.tGlint + 0.14) * Math.PI) * 2 : 0; }
        else {
          const u = smooth(seg(t, pl.tSweep, pl.tSweep + 0.32)), m = sp.mid(d.who), q = sp.pile(pl.taker);
          pos = [lerp(m[0], q[0] + (d.who === pl.taker ? 2 : -2), u), lerp(m[1], q[1], u)]; a = lerp(d.who ? 0.14 : -0.1, d.who === pl.taker ? 0.1 : -0.12, u); f = 1; z = Math.sin(u * Math.PI) * 1.5;
        }
        const s = P(pos);
        drawCard(b, look, pl.cards[d.who], true, s[0], s[1], a, f, z);
      }
      // the second card of a trick lands on top of the first
      return {};
    },
    after(S, p, rec, look, t, wall) {
      const b = S.b, sp = SCENES.cards_camp.spots;
      campfire(b, ...firePx(S, p), wall, 1.25);
      for (const pl of p.plays) if (t > pl.tGlint && t < pl.tSweep + 0.05) {
        const q = S.P(sp.mid(pl.taker)[0], sp.mid(pl.taker)[1], 0), u = seg(t, pl.tGlint, pl.tGlint + 0.3);
        sparkle(b, q[0] + 5 - u * 6, q[1] - 7 + u * 4, u < 0.5 ? 2 : 1, [255, 226, 130]);
      }
      if (look.gilt) giltGlints(S, p, b, wall);
      // the score slate, counting tricks as they're swept
      const n = [0, 1].map((who) => p.won0[who] + p.plays.filter((pl) => pl.taker === who && t >= pl.tSweep + 0.32).length);
      scoreSlate(b, rec, n, "TRICKS");
      const wi = winnerOf(rec) === 1 ? 1 : 0;
      result(b, rec, t, p.tEnd, `${n[wi]} TO ${n[1 - wi]}`);
      if (rec.stake) stakeToken(b, rec, look, t - p.tEnd - 0.3);
      peekAll(S, p, rec, t, wall, rec.players[1] ? 96 : 96);
    },
    lamps(p, t, wall) { return campLamps(p, wall); },
  };
  function firePx(S, p) { const c = S.P(p.fire[0], p.fire[1], CAMP.GZ + 4); return [c[0], c[1]]; }
  function giltGlints(S, p, b, wall) {
    const k = Math.floor(wall * 1.6) % 7, u = (wall * 1.6) % 1;
    if (u < 0.3) { const q = S.P(-30 + k * 9, (k % 2 ? 1 : -1) * 14, 0); sparkle(b, q[0], q[1], 1, [255, 220, 120]); }
  }
  function scoreSlate(b, rec, n, label) {
    const names = [nameOf(rec.players[0]), nameOf(rec.players[1])];
    const w = Math.max(textWidth(names[0]), textWidth(names[1])) + 16;
    slate(b, 4, 4, Math.max(w, textWidth(label) + 8), 26, [104, 74, 44]);
    text(b, label, 7, 6, [150, 160, 150]);
    names.forEach((nm, i) => { text(b, nm, 7, 13 + i * 7, [214, 220, 206]); text(b, String(n[i]), 4 + Math.max(w, textWidth(label) + 8) - 7, 13 + i * 7, [255, 226, 150]); });
  }
  function result(b, rec, t, tEnd, score, y) {
    if (t < tEnd) return;
    y = y || 54;
    const w = winnerOf(rec), word = w === null ? "A DRAW!" : `${nameOf(rec.players[w])} WINS!`;
    stamp(b, word, W / 2, y, [252, 216, 112], t - tEnd);
    if (score && t > tEnd + 0.2) text(b, score, W / 2, y + 15, [236, 226, 200], { center: true, outline: [24, 14, 10] });
  }
  function peekAll(S, p, rec, t, wall, ax, lookX) {
    const g = goblinOf(rec);
    if (!g) return;
    void S;
    const mood = peekMood(rec, p, t), y = p.peekY === undefined ? 20 : p.peekY;
    peek(S.b, g, g === "orm" ? ax - 30 : ax, y, { mask: p.mask, wall, look: lookX, mood });
  }

  // ===== cards at a tavern: close on the table; both hands land face up, the winning hand fans out and sparkles; chalk tally =====
  SCENES.cards_tavern = {
    cam: { pitch: 72, dist: 420, focal: 420 * 1.9, target: [0, 0, 0], cy: 70 },
    plan(rec, r) {
      const hands = handsOf(rec, r), w = winnerOf(rec), show = rec.show || {};
      const order = [];
      for (let i = 0; i < 5; i++) order.push([1, i]);
      for (let i = 0; i < 5; i++) order.push([0, i]);
      const lands = order.map(([who, i], k) => ({ who, i, t: 0.45 + k * 0.24 + (who === 0 ? 0.3 : 0), spin: (r() - 0.5) * 0.12, dx: (r() - 0.5) * 30 }));
      const tShow = lands[lands.length - 1].t + 0.6, tFan = tShow + 0.15, tSpark = tFan + 0.55, tTally = tSpark + 0.45, tEnd = tTally + 0.35;
      const label = (show.label || (w === null ? "EVEN HANDS" : handName(hands[w]))).toUpperCase();
      const ev = [[0, "tavern", tEnd + 3]];
      lands.forEach((l) => { ev.push([l.t - 0.2, "slide", 0.45]); ev.push([l.t, "snap", 0.9]); });
      ev.push([tFan, "sweep"], [tSpark, "sparkle"], [tTally, "chalk"], [tEnd, w === null ? "lose" : "win"]);
      if (rec.stake) ev.push([tEnd + 0.62, "token", rec.stake]);
      const tally = (show.tally || [0, 0]).slice(0, 2).map((v) => clamp(v | 0, 0, 14));
      return { hands, lands, tShow, tFan, tSpark, tTally, tEnd, label, tally, dur: tEnd + 1.4, ev, tw: Array.from({ length: 14 }, () => [r(), r(), r()]) };
    },
    base(p) {
      const S = new Scene(p.cam, { key: [-0.5, 0.3, 0.8], lo: [0.9, 0.8, 0.72] });
      const n = vnoise(311);
      S.b.fill([20, 14, 10]);
      S.plane([[-200, -120, 0], [200, -120, 0], [200, 120, 0], [-200, 120, 0]], 2, 0, (x, y) => {
        const pl = Math.floor((y + 120) / 15), py = (y + 120) % 15, off = pl * 41.3;
        let f = 0.74 + n(x * 0.04 + off, py * 0.3) * 0.42 + ((pl * 7) % 3) * 0.04;
        if (py < 1) f *= 0.45;
        if (Math.hypot((x - ((pl * 67) % 160) + 80) * 0.4, py - 7) < 1.6) f *= 0.62;
        const ring = Math.hypot(x + 56, y - 34);
        if (Math.abs(ring - 8.5) < 0.7) f *= 0.8;
        return sc([96, 58, 34], f);
      });
      // a pewter mug of ale, and a candle in a brass dish that lights the table
      S.drop(-44, -24, 6, 7, 0.5, [-44, 30, 40]);
      S.cyl([-44, -24, 0], 6, 11, [126, 128, 132], { capCol: [236, 226, 196], rim: [84, 86, 92] });
      S.box([-37, -24, 6], [1.6, 1, 3.5], I3, [110, 112, 118], { outline: [60, 62, 68] });
      S.drop(-44, 28, 3, 6, 0.6, [-30, 10, 60]);
      S.cyl([-44, 28, 0], 6, 1.2, [176, 136, 60], { capCol: [200, 160, 76], rim: [110, 80, 30] });
      S.cyl([-44, 28, 1.2], 2.4, 8, [236, 226, 196], { capCol: [246, 238, 210] });
      return S;
    },
    rows: { y: [104, 36], x: (i) => 96 + (i - 2) * 20 },
    pos(p, who, i, t) {
      const R = SCENES.cards_tavern.rows, l = p.lands.find((q) => q.who === who && q.i === i), w = winnerOf(p.rec);
      const home = [R.x(i), R.y[who]];
      if (t < l.t - 0.28) return null;
      if (t < l.t) {
        const u = ease3(seg(t, l.t - 0.28, l.t));
        const from = [96 + l.dx, who === 0 ? H + 26 : -26];
        return { x: lerp(from[0], home[0], u), y: lerp(from[1], home[1], u), a: (1 - u) * (who ? -2.2 : 2.2) + l.spin, f: smooth(u), z: Math.sin(u * Math.PI) * 9 };
      }
      if (w === who && t > p.tFan) {
        const u = smooth(seg(t, p.tFan, p.tFan + 0.42)), ang = (i - 2) * 0.2, rad = 46;
        const piv = [96, R.y[who] + rad - 4];
        const fx = piv[0] + Math.sin(ang) * rad, fy = piv[1] - Math.cos(ang) * rad;
        return { x: lerp(home[0], fx, u), y: lerp(home[1], fy, u), a: lerp(l.spin, ang, u), f: 1, z: Math.sin(u * Math.PI) * 3 };
      }
      const settle = clamp((t - l.t) / 0.12, 0, 1);
      return { x: home[0], y: home[1], a: l.spin, f: 1, z: settle < 1 ? Math.sin(settle * Math.PI) * 1.2 : 0 };
    },
    draw(S, p, rec, look, t) {
      const b = S.b, w = winnerOf(rec);
      for (const who of w === 0 ? [1, 0] : [0, 1]) for (let i = 0; i < 5; i++) {
        const q = SCENES.cards_tavern.pos(p, who, i, t);
        if (!q) continue;
        drawCard(b, look, p.hands[who][i], true, q.x, q.y, q.a, q.f, q.z);
      }
      return {};
    },
    after(S, p, rec, look, t, wall) {
      const b = S.b, w = winnerOf(rec), lamp = S.P(-44, 28, 9.5);
      flame(b, lamp[0], lamp[1], 1.3, wall);
      // the losing hand goes dim once the showdown is read
      if (w !== null && t > p.tShow) {
        const k = 1 - 0.38 * smooth(seg(t, p.tShow, p.tShow + 0.4)), lo = 1 - w;
        for (let i = 0; i < 5; i++) {
          const q = SCENES.cards_tavern.pos(p, lo, i, t);
          if (!q) continue;
          for (let y = -12; y <= 12; y++) for (let x = -9; x <= 9; x++) b.mul(q.x + x, q.y + y, k);
        }
      }
      if (w !== null && t > p.tSpark) {
        const R = SCENES.cards_tavern.rows, cy = R.y[w] - 6;
        p.tw.forEach((s, i) => {
          const ph = (wall * (0.8 + s[2]) + s[0] * 7) % 1.6;
          if (ph > 0.5) return;
          const x = 96 + (s[0] - 0.5) * 96, y = cy + (s[1] - 0.5) * 44, sz = ph < 0.15 ? 1 : ph < 0.35 ? 2 : 1;
          sparkle(b, x, y, sz, i % 3 ? [255, 222, 120] : [255, 250, 220]);
        });
      }
      if (look.gilt) for (let i = 0; i < 2; i++) { const ph = (wall * 0.9 + i * 0.5) % 1; if (ph < 0.2) { const who = i, q = SCENES.cards_tavern.pos(p, who, Math.floor(wall * 1.3 + i * 2) % 5, t); if (q) sparkle(b, q.x - 7, q.y - 10, 1, [255, 230, 140]); } }
      // the chalk slate: tonight's hands, five-bar gates, the new mark drawn in
      const names = [nameOf(rec.players[0]), nameOf(rec.players[1])], nw = Math.max(textWidth(names[0].slice(0, 7)), textWidth(names[1].slice(0, 7)));
      const gates = Math.max(1, Math.ceil((Math.max(p.tally[0], p.tally[1]) + 1) / 5)), sw = nw + 10 + gates * 12, sx = W - sw - 3, sy = 3;
      slate(b, sx, sy, sw, 26, [104, 74, 44]);
      text(b, "HANDS", sx + 3, sy + 2, [150, 160, 150]);
      for (const who of [0, 1]) {
        const y = sy + 9 + (1 - who) * 8;
        text(b, names[who].slice(0, 7), sx + 3, y, [214, 220, 206]);
        let n = p.tally[who], draw = 1;
        if (w === who && t > p.tTally) { n += 1; draw = seg(t, p.tTally, p.tTally + 0.25); }
        for (let k = 0; k < n; k++) {
          const g = Math.floor(k / 5), j = k % 5, x0 = sx + nw + 8 + g * 12, last = k === n - 1 && w === who && t > p.tTally;
          const len = last ? Math.ceil(draw * 5) : 5;
          if (j < 4) for (let yy = 0; yy < len; yy++) b.px(x0 + j * 2, y + yy, [236, 238, 228], true);
          else for (let s = 0; s < len + 3; s++) b.px(x0 - 1 + Math.round(s * 9 / 8), y + 4 - Math.round(s * 4 / 8), [236, 238, 228], true);
        }
      }
      if (t > p.tFan + 0.3 && w !== null) {
        text(b, p.label, W / 2, 73, [255, 226, 130], { center: true, outline: [30, 18, 10] });
      }
      if (t > p.tEnd) {
        const word = w === null ? "A DRAW!" : `${nameOf(rec.players[w])} WINS!`;
        stamp(b, word, W / 2, 57, [252, 216, 112], t - p.tEnd);
      }
      if (rec.stake) stakeToken(b, rec, look, t - p.tEnd - 0.3);
      peekAll(S, p, rec, t, wall, 96);
    },
    lamps(p, t, wall) {
      const fl = 1 + Math.sin(wall * 13) * 0.02 + Math.sin(wall * 5.3) * 0.03;
      const c = p.cam.p(-44, 28, 12);
      return { amb: [0.3, 0.26, 0.23], lamps: [{ x: c[0], y: c[1], r: 250 * fl, i: 1.15, c: [1.1, 0.88, 0.62], p: 1.1 }], glows: [[c[0], c[1] - 3, 7 * fl, [255, 190, 100], 0.4]] };
    },
  };

  // ===== checkers on a stump: a board carved into the top, firelight from the right, key moves, a double jump, a king =====
  const SQ = 10.5, STUMP = 62, GZS = -28;
  const sqXY = (c, r) => [(c - 3.5) * SQ, (r - 3.5) * SQ];
  function parseBoard(rows) {
    const out = [];
    if (!rows || rows.length !== 8) rows = DEFAULT_BOARD;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const ch = String(rows[r] || "")[c] || ".";
      if ((c + r) % 2 !== 0 || !"wWbB".includes(ch)) continue;
      out.push({ side: ch.toLowerCase() === "w" ? 0 : 1, king: ch === "W" || ch === "B", c, r });
    }
    return out;
  }
  const DEFAULT_BOARD = ["w.w.w...", ".w...w.w", "w.w.....", "...w.b..", "..b.....", ".b...b.b", "b.b.b...", ".b.b.b.b"];
  SCENES.checkers = {
    cam: { pitch: 62, dist: 420, focal: 420 * 1.3, target: [0, 6, 0], cy: 80 },
    plan(rec, r, look) {
      const show = rec.show || {}, men = parseBoard(show.board);
      men.forEach((m, i) => { m.id = i; m.segs = []; m.cap = null; m.kingAt = m.king ? -1 : null; });
      const at = (c, r2) => men.find((m) => m.c === c && m.r === r2 && m.cap === null);
      const ev = [[0, "fire", 12]], moods = [], bursts = [], shakes = [], stamps = [];
      const pile = [0, 0];
      const lost = [12 - men.filter((m) => m.side === 0).length, 12 - men.filter((m) => m.side === 1).length].map((v) => clamp(v, 0, 12));
      pile[1] = lost[0]; pile[0] = lost[1];
      let t = 0.55;
      const moves = (show.moves || []).slice(0, 6);
      const gob = goblinOf(rec);
      let tLastMove = null;
      moves.forEach((path, mi) => {
        if (!path || path.length < 2) return;
        const m = at(path[0][0], path[0][1]);
        if (!m) return;
        const hops = path.length - 1, jumps = path.slice(1).filter((q, i) => Math.abs(q[0] - path[i][0]) === 2).length;
        if (jumps >= 2 || (jumps && mi === moves.length - 1)) t += 0.3;
        const HOP = jumps ? 0.46 : 0.5;
        for (let h = 0; h < hops; h++) {
          const a = path[h], z = path[h + 1], t0 = t + h * HOP, t1 = t0 + HOP * 0.78, jump = Math.abs(z[0] - a[0]) === 2;
          m.segs.push({ t0, t1, from: a, to: z, jump });
          ev.push([t0, jump ? "lift" : "scrape", 0.6]);
          ev.push([t1, jump ? "tok" : "clack", jump ? 1 - h * 0.05 + (jumps > 1 ? 0.1 : 0) : 0.8]);
          if (jump) {
            const v = at((a[0] + z[0]) / 2, (a[1] + z[1]) / 2);
            if (v) {
              v.cap = t1; v.pileSide = m.side; v.pileSlot = pile[m.side]++;
              ev.push([t1 + 0.04, "pop", h]);
              bursts.push({ t: t1, sq: z, big: jumps > 1 });
              if (jumps > 1) shakes.push(t1);
              if (gob) moods.push([t1, m.side === 1 ? "glee" : "sad"]);
            }
          }
          m.c = z[0]; m.r = z[1];
        }
        const tEndMove = t + (hops - 1) * HOP + HOP * 0.78;
        if (jumps > 1) { stamps.push({ t: tEndMove + 0.05, word: jumps === 2 ? "DOUBLE JUMP!" : jumps === 3 ? "TRIPLE JUMP!" : "WHAT A RUN!" }); ev.push([tEndMove + 0.05, "cheer"]); }
        if (m.kingAt === null && m.r === (m.side === 0 ? 7 : 0)) { m.kingAt = tEndMove + (jumps > 1 ? 0.8 : 0.35); stamps.push({ t: m.kingAt, word: "KING!" }); ev.push([m.kingAt, "crown"]); t = m.kingAt + 0.5; }
        else t = tEndMove + (jumps > 1 ? 0.55 : 0.18);
        tLastMove = tEndMove;
      });
      men.forEach((m) => { m.c = m.segs.length ? m.segs[0].from[0] : m.c; m.r = m.segs.length ? m.segs[0].from[1] : m.r; });
      // pebbles stand in for the men a worn set has lost
      const missing = clamp(Math.round((rec.set && rec.set.missing) || 0), 0, 8), ids = men.map((m) => m.id).sort((a, b2) => (hash(rec.id + a) % 997) - (hash(rec.id + b2) % 997));
      ids.slice(0, missing).forEach((id) => { men[id].pebble = true; });
      const tEnd = Math.max(t, (tLastMove || 0) + 0.4, 3.2);
      ev[0][2] = tEnd + 3;
      const w = winnerOf(rec);
      ev.push([tEnd, w === null ? "lose" : "win"]);
      if (gob) ev.push([tEnd + 0.25, gob === "orm" ? "rumble" : w === 1 ? "hee" : "sniff"]);
      if (rec.stake) ev.push([tEnd + 0.62, "token", rec.stake]);
      moods.forEach((m) => { if (gob === "nib" && m[1] === "glee") ev.push([m[0] + 0.1, "hee", 0.6]); });
      return { men, lost, bursts, shakes, stamps, moods, tEnd, dur: tEnd + 1.4, ev, fire: [76, -40], peekY: 0 };
    },
    base(p, rec, look) {
      const S = new Scene(p.cam, { key: [0.75, -0.25, 0.62], lo: [0.82, 0.84, 0.92], hi: [1.1, 0.98, 0.82], ambF: 0.5, difF: 0.7 });
      const n = vnoise(401), g = vnoise(403);
      S.b.fill([10, 12, 10]);
      S.plane([[-300, 300, GZS], [300, 300, GZS], [300, -300, GZS], [-300, -300, GZS]], 2, GZS, (x, y) => {
        const v = g(x * 0.12, y * 0.12), m = n(x * 0.05, y * 0.05);
        let col = m > 0.55 ? [58, 74, 42] : [74, 62, 46];
        if (n(x * 0.4 + 40, y * 0.4) > 0.84) col = n(x, y) > 0.5 ? [140, 96, 50] : [118, 108, 56];
        return sc(col, 0.8 + v * 0.3);
      });
      S.drop(-10, -2, GZS + 10, STUMP * 1.02, 0.5, null, GZS);
      const F = p.fire, fr = S.cam.scale(F[0], F[1], GZS);
      const fc = S.P(F[0], F[1], GZS);
      S.b.ell(fc[0], fc[1], 13 * fr, 10 * fr, (nx, ny, x, y) => S.b.px(x, y, sc([44, 38, 34], 0.8 + n(x, y) * 0.3)));
      S.box([F[0], F[1], GZS + 2.5], [11, 2.4, 2.4], Rz(0.4), [86, 56, 34], { outline: [34, 22, 14] });
      S.box([F[0] - 2, F[1] + 1, GZS + 5], [11, 2.4, 2.4], Rz(-0.7), [96, 64, 38], { outline: [34, 22, 14] });
      for (const a of [-2.5, -1.3, 0.1, 1.2, 2.5]) {
        const x0 = Math.cos(a) * (STUMP - 6), y0 = Math.sin(a) * (STUMP - 6);
        S.box([x0 * 1.14, y0 * 1.14, GZS + 4], [6, 3.5, 4], Rz(a), [96, 68, 44], { outline: [44, 30, 18] });
      }
      const B = 4 * SQ, style = look.board;
      const sq = (x, y) => [Math.floor(x / SQ + 4), Math.floor(y / SQ + 4)];
      const cap = S.cyl([0, 0, GZS], STUMP, -GZS, [100, 72, 46], { n: 56, sideFn: (i, nn, c) => sc(c, (i % 4 === 0 ? 0.62 : i % 4 === 2 ? 1.08 : 0.88) * (0.9 + n(i, 3) * 0.2)), capFn: () => (sx, sy) => {
        const wpt = S.cam.unproject(sx + 0.5, sy + 0.5, 2, 0), x = wpt[0], y = wpt[1], rad = Math.hypot(x, y);
        if (rad > STUMP - 2.5) return sc([150, 108, 66], 0.82 + n(x * 0.3, y * 0.3) * 0.2);
        const d = Math.hypot(x - 4, y + 3) + (n(x * 0.15, y * 0.15) - 0.5) * 4, ring = d % 4.6 < 0.9;
        let wood = sc([214, 170, 112], (ring ? 0.84 : 1) * (0.92 + n(x * 0.8, y * 0.8) * 0.12));
        if (Math.abs(Math.atan2(y + 3, x - 4) + 2.1) < 0.025 && d > 10) wood = [128, 88, 52];
        if (Math.abs(x) > B + 2.4 || Math.abs(y) > B + 2.4) return wood;
        if (Math.abs(x) > B + 0.6 || Math.abs(y) > B + 0.6) return style === "pearl" ? [176, 136, 60] : sc(wood, 0.5);
        const [c, r] = sq(x, y), dark = (c + r) % 2 === 0, fx = (x / SQ + 4) % 1, fy = (y / SQ + 4) % 1;
        const groove = fx < 0.06 || fy < 0.06;
        let col;
        if (style === "pearl") {
          col = dark ? sc([82, 50, 32], 0.85 + n(x * 0.2, y * 1.4) * 0.3) : mixc([236, 230, 216], n(x * 0.5, y * 0.5) > 0.6 ? [240, 214, 208] : n(x * 0.5 + 9, y * 0.5) > 0.62 ? [210, 232, 222] : [236, 230, 216], 0.6);
          if (groove) col = [150, 116, 56];
        } else if (style === "bark") {
          col = dark ? sc([96, 66, 44], 0.7 + (Math.sin(x * 1.3 + n(x, y) * 3) > 0.3 ? 0.35 : 0) + n(x * 0.3, y * 0.3) * 0.2) : wood;
          if (groove) col = sc(wood, 0.55);
        } else if (style === "slate") {
          col = dark ? sc([86, 58, 40], 0.8 + n(x * 0.6, y * 0.6) * 0.3) : mixc(wood, [230, 224, 210], n(x * 0.7, y * 0.7) > 0.62 ? 0.4 : 0.1);
          if (groove) col = sc(wood, 0.5);
        } else {
          col = dark ? sc([108, 76, 50], 0.8 + n(x * 0.6, y * 0.6) * 0.3) : mixc(wood, [222, 198, 150], 0.5 + (n(x * 0.9, y * 0.9) > 0.68 ? 0.3 : 0));
          if (groove) col = [224, 218, 196];
        }
        return col;
      } });
      void cap;
      p.mask = new Uint8Array(W * H);
      const m = new Buf(), ring = [];
      for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; ring.push(S.P(Math.cos(a) * STUMP, Math.sin(a) * STUMP, 0)); }
      m.poly(ring, [1, 1, 1]);
      for (let i = 0; i < W * H; i++) if (m.c[i * 3]) p.mask[i] = 1;
      const top = S.P(0, STUMP, 0);
      p.peekY = Math.round(top[1]) + 3;
      return S;
    },
    manAt(p, m, t) {
      if (m.cap !== null && t >= m.cap) {
        const side = m.pileSide, slot = m.pileSlot, pile = pileXY(side, slot), u = seg(t, m.cap, m.cap + 0.5);
        const from = sqXY(m.segs.length ? m.segs[m.segs.length - 1].to[0] : m.c0, m.segs.length ? m.segs[m.segs.length - 1].to[1] : m.r0);
        void from;
        const start = m.capFrom;
        if (u >= 1) return { x: pile[0], y: pile[1], z: pile[2], R: null, king: false };
        return { x: lerp(start[0], pile[0], ease(u)), y: lerp(start[1], pile[1], ease(u)), z: lerp(0, pile[2], u) + Math.sin(u * Math.PI) * 22, R: Raxis([1, 0.4, 0], u * 9), king: false, flying: true };
      }
      let q = sqXY(m.c, m.r), z = 0;
      for (const s of m.segs) {
        if (t >= s.t1) { q = sqXY(s.to[0], s.to[1]); continue; }
        if (t <= s.t0) break;
        const u = seg(t, s.t0, s.t1), a = sqXY(s.from[0], s.from[1]), b2 = sqXY(s.to[0], s.to[1]);
        const e = s.jump ? smooth(u) : ease(u);
        q = [lerp(a[0], b2[0], e), lerp(a[1], b2[1], e)];
        z = s.jump ? Math.sin(u * Math.PI) * 13 : Math.sin(u * Math.PI) * 2.5;
        break;
      }
      return { x: q[0], y: q[1], z, R: null, king: m.kingAt !== null && t >= m.kingAt, kingU: m.kingAt !== null ? seg(t, m.kingAt - 0.3, m.kingAt) : 1, kingAt: m.kingAt };
    },
    draw(S, p, rec, look, t, wall) {
      const items = [], fire = [p.fire[0], p.fire[1], 70];
      let lookX;
      for (const m of p.men) {
        if (m.capFrom === undefined && m.cap !== null) {
          const last = m.segs.length ? m.segs[m.segs.length - 1].to : [m.c, m.r];
          m.capFrom = sqXY(last[0], last[1]);
        }
        const st = SCENES.checkers.manAt(p, m, t);
        if (st.z > 3 && !st.flying) lookX = S.P(st.x, st.y, 0)[0];
        items.push({ y: st.y - st.z * 0.01, draw: () => drawMan(S, look, m, st, fire, t) });
      }
      // men lost before tonight's key moves sit captured beside the board
      for (const side of [0, 1]) for (let k = 0; k < p.lost[side]; k++) {
        const pos = pileXY(1 - side, k);
        items.push({ y: pos[1], draw: () => drawMan(S, look, { side, id: 100 + side * 20 + k, pebble: false }, { x: pos[0], y: pos[1], z: pos[2], king: false }, fire, t) });
      }
      paintItems(items);
      p.lookX = lookX;
      let shake = null;
      for (const s of p.shakes) if (t >= s && t < s + 0.14) shake = [Math.round(Math.sin((t - s) * 90) * 2), Math.round(Math.cos((t - s) * 70))];
      return { shake };
    },
    after(S, p, rec, look, t, wall) {
      const b = S.b, fp = S.P(p.fire[0], p.fire[1], GZS + 4);
      campfire(b, fp[0], fp[1], wall, 1.1);
      for (const bu of p.bursts) burst(S, bu, t);
      for (const m of p.men) if (m.kingAt !== null && m.kingAt > 0 && t > m.kingAt - 0.05 && t < m.kingAt + 1.4) {
        const st = SCENES.checkers.manAt(p, m, t), c = S.P(st.x, st.y, 7), u = t - m.kingAt;
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + u * 3, rr = 6 + u * 10; if (u < 0.9) sparkle(b, c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr * 0.7, u < 0.3 ? 2 : 1, [255, 222, 110]); }
        if (u < 0.8) crownIcon(b, c[0], c[1] - 6 - Math.round(ease(Math.min(1, u * 3)) * 3), [255, 214, 90]);
      }
      for (const [i, s] of p.stamps.entries()) if (t > s.t && t < Math.min(s.t + 0.9, (p.stamps[i + 1] || {}).t || 99) && t < p.tEnd) stamp(b, s.word, W / 2, 62, s.word === "KING!" ? [255, 214, 90] : [255, 236, 170], t - s.t);
      const names = [nameOf(rec.players[0]), nameOf(rec.players[1])];
      const sw = Math.max(textWidth(names[0]), textWidth(names[1])) + 18;
      slate(b, 3, H - 22, sw, 19, [104, 74, 44]);
      [1, 0].forEach((who, i) => { manIcon(b, 8, H - 17 + i * 8, look.men[who]); text(b, names[who], 14, H - 19 + i * 8, [214, 220, 206]); });
      if (t > p.tEnd) {
        const w = winnerOf(rec), word = w === null ? "A DRAW!" : `${nameOf(rec.players[w])} WINS!`;
        stamp(b, word, W / 2, 62, [252, 216, 112], t - p.tEnd);
      }
      if (rec.stake) stakeToken(b, rec, look, t - p.tEnd - 0.3);
      peekAll(S, p, rec, t, wall, 96, p.lookX);
    },
    lamps(p, t, wall) {
      const fl = 1 + Math.sin(wall * 11) * 0.05 + Math.sin(wall * 4.3) * 0.05 + Math.sin(wall * 29) * 0.02;
      const c = p.cam.p(p.fire[0], p.fire[1], GZS + 14);
      const glows = [[c[0], c[1] - 6, 18 * fl, [255, 150, 60], 0.45]];
      return { amb: [0.26, 0.28, 0.36], lamps: [{ x: c[0], y: c[1], r: 240 * fl, i: 1.05, c: [1.1, 0.8, 0.52], p: 1.1, sy: 1 }], glows };
    },
  };
  function pileXY(side, slot) {
    const col = Math.floor(slot / 6), k = slot % 6;
    return [-STUMP + 13 + col * 6, side === 0 ? -20 - col * 2 : 18 + col * 2, k * 2.1];
  }
  function crownIcon(b, x, y, col) {
    const rows = ["#.#.#", "#####", "#####"];
    x = Math.round(x - 2); y = Math.round(y - 1);
    for (let j = -1; j <= 3; j++) for (let i = -1; i <= 5; i++) { const on = (jj, ii) => rows[jj] && rows[jj][ii] === "#"; if (!on(j, i) && (on(j - 1, i) || on(j + 1, i) || on(j, i - 1) || on(j, i + 1))) b.px(x + i, y + j, [40, 24, 10], true); }
    rows.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === "#") b.px(x + i, y + j, j === 0 ? [255, 246, 200] : col, true); });
  }
  function manIcon(b, x, y, col) {
    b.ell(x, y, 2.6, 2.1, (nx, ny, px, py) => b.px(px, py, nx * nx + ny * ny > 0.6 ? sc(col, 0.55) : col, true));
  }
  // a checker man (or the pebble standing in for one): a disc lit from the fire, with its set's own detail on the cap
  function drawMan(S, look, m, st, fire, t) {
    const R = 4.3, h = 2.2, col = look.men[m.side];
    const z = st.z || 0;
    if (!st.flying || z < 30) S.drop(st.x, st.y, z + h, R * 0.95, 0.5, fire);
    if (m.pebble) {
      const c = S.P(st.x, st.y, z + 1.8), k = S.cam.scale(st.x, st.y, z), nn = vnoise(500 + m.id);
      S.b.ell(c[0], c[1], R * k * 0.95, R * k * 0.78, (nx, ny, x, y) => {
        const d = nx * nx + ny * ny + (nn(x * 0.7, y * 0.7) - 0.5) * 0.5;
        if (d > 0.95) return;
        const f = 0.62 + 0.55 * clamp(nx * 0.6 - ny * 0.4 + 0.15, 0, 1);
        S.b.px(x, y, d > 0.7 ? S.shade([96, 94, 88], f) : S.shade(nn(x, y) > 0.7 ? [150, 146, 132] : [128, 126, 118], f));
      });
      return;
    }
    const discs = st.king ? 2 : 1;
    for (let d = 0; d < discs; d++) {
      const zz = z + d * (h + 0.3), Rot = st.R || I3;
      const bump = d === 1 && st.kingU < 1 ? (1 - st.kingU) * 16 : 0;
      const capC = S.P(st.x, st.y, zz + bump + h), rr = R * S.cam.scale(st.x, st.y, zz);
      S.cyl([st.x, st.y, zz + bump], R, h, col, { R: Rot, n: 16, side: sc(col, 0.82), rim: sc(col, look.men[m.side][0] > 150 ? 0.62 : 1.5), capFn: (cc) => (px, py) => {
        const nx = (px + 0.5 - capC[0]) / rr, ny = (py + 0.5 - capC[1]) / (rr * 0.88), dd = nx * nx + ny * ny;
        let c = cc;
        if (look.holes && m.side === 0) {
          if ([[-0.28, -0.26], [0.28, -0.26], [-0.28, 0.26], [0.28, 0.26]].some(([hx, hy]) => Math.hypot(nx - hx, ny - hy) < 0.19)) return sc(col, 0.35);
          if (dd > 0.5 && dd < 0.68) c = sc(cc, 0.82);
        }
        if (look.holes && m.side === 1) {
          if (dd < 0.3 && (Math.abs(nx) < 0.1 || Math.abs(ny) < 0.1) && dd < 0.2) c = S.shade(cc, 1.25);
          else if (dd > 0.62) c = sc(cc, 0.78);
        }
        if (look.turned && Math.abs(dd - 0.42) < 0.08) c = sc(cc, m.side === 0 ? 0.84 : 1.6);
        if (look.dusty && ((px * 7 + py * 3) % 5 === 0)) c = sc(cc, m.side === 0 ? 1.06 : 1.3);
        if (look.board === "bark" && m.side === 0 && Math.abs(ny + 0.1 - Math.sin(nx * 3) * 0.1) < 0.09 && Math.abs(nx) < 0.5) c = [70, 60, 50];
        if (nx > 0.2 && ny < -0.2 && dd < 0.45 && dd > 0.18) c = S.shade(c, 1.18);
        return c;
      } });
      if (d === 1 && st.kingU >= 1) crownIcon(S.b, capC[0], capC[1], [236, 182, 60]);
    }
    if (look.shoots && !st.flying) {
      const c = S.P(st.x + (m.id % 2 ? 3 : -3), st.y + 2, z + h);
      const sway = Math.round(Math.sin(t * 2 + m.id) * 0.6);
      S.b.px(c[0], c[1] - 1, [90, 150, 60]); S.b.px(c[0] + sway, c[1] - 2, [110, 176, 70]); S.b.px(c[0] + sway + (m.id % 2 ? 1 : -1), c[1] - 3, [130, 196, 84]);
    }
  }
  // a jump's landing: a ring of rays and dust kicked off the board
  function burst(S, bu, t) {
    const u = (t - bu.t) / (bu.big ? 0.4 : 0.3);
    if (u < 0 || u > 1) return;
    const q = sqXY(bu.sq[0], bu.sq[1]), c = S.P(q[0], q[1], 1), b = S.b, n = bu.big ? 12 : 8, r = rng(bu.sq[0] * 31 + bu.sq[1] * 7 + 1);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + 0.2, r0 = 5 + ease(u) * (bu.big ? 18 : 12), r1 = r0 + (1 - u) * (bu.big ? 8 : 5);
      for (let s2 = r0; s2 < r1; s2 += 0.7) b.px(c[0] + Math.cos(a) * s2, c[1] + Math.sin(a) * s2 * 0.75, u < 0.35 ? [255, 252, 226] : [255, 210, 110], true);
    }
    for (let i = 0; i < 10; i++) {
      const a = r() * Math.PI * 2, d = 4 + r() * 8 * ease(u) + u * 6;
      if (r() > u * 1.2) b.px(c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d * 0.6 - Math.sin(u * Math.PI) * 3, [214, 186, 140], true);
    }
    if (u < 0.2) b.ell(c[0], c[1], 8, 6, (nx, ny, x, y) => { if (nx * nx + ny * ny > 0.55) b.px(x, y, [255, 248, 214], true); });
  }

  // ===== crew dice at camp: the phase-one dice on the crate by the fire; each player throws in turn, highest total takes it =====
  SCENES.dice_camp = {
    cam: { pitch: 62, dist: 420, focal: 420 * 1.42, target: [0, -2, 0], cy: 62 },
    plan(rec, r, look) {
      const rolls = ((rec.show || {}).rolls || [[3, 5], [4, 2]]).slice(0, 4).map((rl) => (rl || [1]).slice(0, 5).map((v) => clamp(v | 0, 1, 6)));
      while (rolls.length < rec.players.length && rolls.length < 2) rolls.push([1 + Math.floor(r() * 6), 1 + Math.floor(r() * 6)]);
      const np = rolls.length, gap = np <= 2 ? 1.55 : 1.18;
      const ZONES = np <= 2 ? [[0, -12, 34, 6], [0, 13, 34, 6]] : [[-22, -12, 15, 6], [22, 13, 15, 6], [-22, 13, 15, 6], [22, -12, 15, 6]];
      const FROM = [[10, -70, 34], [-10, 70, 34], [-90, 10, 30], [90, -10, 30]];
      const tex = pipTex(null, look.pip, look.rim || null);
      const lk = look.mat ? look : { col: look.col, tex, outline: look.outline };
      const dice = [], throws = [], ev = [[0, "fire", 12]];
      rolls.forEach((rl, i) => {
        const t0 = 0.45 + i * gap, z = ZONES[i], sp = spots(r, z[0], z[1], rl.length, z[2], z[3], 12);
        const ds = rl.map((v, k) => ({ v, who: i, size: 9, look: lk, dustCol: look.dust || [150, 120, 84], T: tumble(r, { t0: t0 + k * 0.07 + r() * 0.04, sx: FROM[i][0] + (r() - 0.5) * 10, sy: FROM[i][1] + (r() - 0.5) * 6, sz: FROM[i][2], ex: sp[k][0], ey: sp[k][1], val: v, air: 0.42 + r() * 0.1, h1: 8 + r() * 4, flips: 2 }) }));
        dice.push(...ds);
        const tSum = Math.max(...ds.map((d) => d.T.end)) + 0.05;
        throws.push({ who: i, t0, tSum, sum: rl.reduce((a, b) => a + b, 0), dice: ds });
        ev.push([t0 - 0.12, "shake"]);
        for (const d of ds) { d.T.impacts.forEach((tt, k) => ev.push([tt, "knock", [1.25, 0.7, 0.4][k]])); ev.push([d.T.ti[3] + 0.05, "rattle", 0.32]); }
        ev.push([tSum, "chalk"]);
      });
      const totals = throws.map((th) => th.sum);
      let w = winnerOf(rec);
      if (w === null && rec.winner === undefined) { const best = Math.max(...totals); w = totals.indexOf(best); }
      const tEnd = Math.max(...throws.map((th) => th.tSum)) + 0.45;
      ev[0][2] = tEnd + 3;
      ev.push([tEnd, w === null ? "lose" : "win"]);
      if (rec.stake) ev.push([tEnd + 0.62, "token", rec.stake]);
      return { dice, throws, totals, w, tEnd, dur: tEnd + 1.4, ev, fire: [-56, -41], zones: ZONES };
    },
    base(p) { return campBase(p, { fire: p.fire, mug: [44, 22], roll: [70, -10] }); },
    draw(S, p, rec, look, t) {
      const items = [], lamp = [p.fire[0], p.fire[1], 20];
      dieItems(S, p.dice, t, lamp, items);
      paintItems(items);
      return {};
    },
    after(S, p, rec, look, t, wall) {
      const b = S.b;
      campfire(b, ...firePx(S, p), wall, 1.25);
      if (look.glow) for (const d of p.dice) if (d.st && t > d.T.ti[0]) { const c = S.P(d.st.x, d.st.y, d.st.z + 4); glow(b, c[0], c[1], 8, look.glow, 0.28); }
      if (look.glint) for (const d of p.dice) glintAt(S, d, t, look.glint);
      if (t > p.tEnd - 0.2 && p.w !== null) p.throws[p.w].dice.forEach((d, i) => ringDie(S, d, t, p.tEnd - 0.2 + i * 0.04, undefined, [255, 210, 100]));
      const names = rec.players.slice(0, p.throws.length).map(nameOf);
      const sw = Math.max(...names.map((s) => textWidth(s))) + 20, sh = 9 + names.length * 7;
      slate(b, 4, 4, Math.max(sw, 40), sh, [104, 74, 44]);
      text(b, "THROWS", 7, 6, [150, 160, 150]);
      p.throws.forEach((th, i) => {
        text(b, names[i], 7, 13 + i * 7, i === p.w && t > p.tEnd ? [255, 226, 150] : [214, 220, 206]);
        if (t > th.tSum) text(b, String(th.sum), 4 + Math.max(sw, 40) - 4 - textWidth(String(th.sum)), 13 + i * 7, i === p.w && t > p.tEnd ? [255, 226, 150] : [236, 240, 230]);
      });
      // the dice lie in two rows across the middle of the board, so the word goes on the board's near edge below them
      result(b, Object.assign({}, rec, { winner: p.w }), t, p.tEnd, null, 108);
      if (rec.stake) stakeToken(b, Object.assign({}, rec, { winner: p.w, _totals: p.totals }), look, t - p.tEnd - 0.3);
      peekAll(S, p, rec, t, wall, 96);
    },
    lamps(p, t, wall) { return campLamps(p, wall); },
  };

  // ---------- rendering a frame ----------
  function sceneOf(rec) {
    if (rec.game === "cards") return rec.where === "tavern" ? "cards_tavern" : "cards_camp";
    if (rec.game === "checkers") return "checkers";
    if (rec.game === "dice") return "dice_camp";
    return null;
  }
  const plans = new Map();
  function planFor(rec0) {
    const key = (rec0.id || "night") + ":" + rec0.game + ":" + rec0.where;
    let p = plans.get(key);
    if (p && p.src === rec0) return p;
    const sid = sceneOf(rec0);
    if (!sid) return null;
    const rec = seated(rec0), look = lookOf(rec), sc0 = SCENES[sid];
    p = { src: rec0, rec, look, sid, scene: sc0 };
    Object.assign(p, sc0.plan(rec, rng(hash(key)), look));
    p.cam = new Cam(sc0.cam);
    const S = sc0.base(p, rec, look);
    p.baseScene = S;
    p.baseBuf = S.b.clone();
    const g = goblinOf(rec);
    if (g) {
      p.ev.push([0.4, g === "orm" ? "rumble" : "hee", 0.5]);
      p.ev.sort((a, b) => a[0] - b[0]);
    }
    if (plans.size > 24) plans.delete(plans.keys().next().value);
    plans.set(key, p);
    return p;
  }
  function render(rec0, t) {
    const p = planFor(rec0);
    if (!p) return null;
    const sc0 = p.scene, S = p.baseScene, rec = p.rec, at = Math.min(t, p.dur);
    S.b.copy(p.baseBuf);
    const info = sc0.draw(S, p, rec, p.look, at, t) || {};
    const L = sc0.lamps(p, at, t);
    const lamps = L.lamps.slice();
    if (goblinOf(rec) && p.peekY !== undefined) lamps.push({ x: 96, y: p.peekY - 6, r: 60, i: 0.45, c: [1.0, 0.8, 0.55], p: 1.4 });
    light(S.b, lamps, L.amb, L.levels);
    for (const gl of L.glows || []) glow(S.b, gl[0], gl[1], gl[2], gl[3], gl[4]);
    sc0.after(S, p, rec, p.look, at, t, info);
    const out = new Uint8ClampedArray(W * H * 4), c = S.b.c, sh = info.shake || [0, 0];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sx = clamp(x - sh[0], 0, W - 1), sy = clamp(y - sh[1], 0, H - 1), i = (sy * W + sx) * 3, o = (y * W + x) * 4;
      out[o] = c[i]; out[o + 1] = c[i + 1]; out[o + 2] = c[i + 2]; out[o + 3] = 255;
    }
    return { w: W, h: H, data: out };
  }

  // ---------- sound: its own WebAudio context, following audio.js's "al.sound" settings and first-click unlock ----------
  const Snd = (() => {
    let ctx = null, out = null, noiseBuf = null, unlocked = false;
    const prefs = () => { try { return Object.assign({ on: true, master: 0.7, sfx: 0.6 }, JSON.parse(localStorage.getItem("al.sound") || "{}")); } catch (e) { return { on: true, master: 0.7, sfx: 0.6 }; } };
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
      if (!unlocked || !pr.on || !init()) return null;
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
      // the fire under everything: a low breath, a hiss, and crackles that bunch up and thin out
      fire: (t, secs) => {
        secs = Math.min(14, secs || 8);
        noise(t, secs, 0.05, "lowpass", 260, 0.7);
        noise(t, secs, 0.012, "highpass", 5200);
        let at = t + 0.05;
        while (at < t + secs - 0.2) {
          const big = Math.random() < 0.12;
          noise(at, big ? 0.03 : 0.012, big ? 0.32 : 0.08 + Math.random() * 0.12, "bandpass", big ? 1800 : 2500 + Math.random() * 3000, big ? 1.2 : 2.5);
          if (big) for (let i = 1; i < 4; i++) noise(at + i * 0.018 + Math.random() * 0.01, 0.008, 0.1, "highpass", 3500);
          at += 0.04 + Math.random() * Math.random() * 0.35;
        }
      },
      tavern: (t, secs) => {
        secs = Math.min(14, secs || 8);
        noise(t, secs, 0.04, "bandpass", 520, 0.7);
        for (let i = 0; i < secs * 2.2; i++) noise(t + Math.random() * secs, 0.2 + Math.random() * 0.2, 0.016, "bandpass", 500 + Math.random() * 700, 5);
        for (let i = 0; i < 3; i++) { const at = t + 0.8 + Math.random() * (secs - 1); ring(at, 2200 + Math.random() * 600, 0.4, 0.025); }
      },
      // cards: the riffle, a slide across wood, the flip, the snap down, a trick swept up
      riffle: (t) => { let at = t; for (let i = 0; i < 16; i++) { noise(at, 0.012, 0.16 - i * 0.004, "bandpass", 2600 + Math.random() * 1600, 2); at += 0.024 - i * 0.0007; } noise(at, 0.06, 0.16, "lowpass", 900); },
      slide: (t, v) => { v = v || 0.6; noise(t, 0.2, 0.28 * v, "bandpass", 2800, 1.4, 1500); noise(t, 0.16, 0.08 * v, "highpass", 5000); },
      flip: (t) => { noise(t, 0.03, 0.22, "bandpass", 3600, 2.5); noise(t + 0.035, 0.025, 0.14, "bandpass", 2800, 2.5); },
      snap: (t, v) => { v = v || 1; noise(t, 0.028, 0.6 * v, "highpass", 2400); tone(t, 210, 95, 0.05, 0.26 * v); noise(t + 0.005, 0.05, 0.16 * v, "lowpass", 700); },
      sweep: (t) => { noise(t, 0.34, 0.24, "bandpass", 1900, 1.2, 900); noise(t + 0.3, 0.05, 0.16, "lowpass", 600); },
      glint: (t) => { ring(t, 2637, 0.5, 0.05); ring(t + 0.07, 3520, 0.4, 0.035); },
      sparkle: (t) => { const notes = [2093, 2637, 3136, 3520, 4186]; for (let i = 0; i < 7; i++) ring(t + i * 0.09 + Math.random() * 0.03, notes[(i * 3) % 5], 0.6, 0.04 - i * 0.003); },
      chalk: (t) => { for (let i = 0; i < 3; i++) noise(t + i * 0.08, 0.06, 0.14, "bandpass", 3800 + Math.random() * 800, 4); },
      // checkers: a light scrape for a step, a woody clack on landing, the jump's hollow tok, the taken man popping off
      scrape: (t, v) => { noise(t, 0.16, 0.06 * (v || 1), "bandpass", 1400, 2, 900); },
      clack: (t, v) => { v = v || 1; const f = 1100 + Math.random() * 300; tone(t, f, f * 0.72, 0.045, 0.24 * v, "triangle"); noise(t, 0.03, 0.4 * v, "bandpass", 2400 + Math.random() * 800, 2.5); tone(t, 170, 110, 0.06, 0.22 * v); },
      lift: (t) => { noise(t, 0.08, 0.07, "bandpass", 900, 1.5, 1600); },
      tok: (t, v) => { v = v || 1; noise(t, 0.09, 0.55 * v, "bandpass", 760, 7); tone(t, 640, 560, 0.11, 0.34 * v, "triangle"); tone(t, 190, 120, 0.09, 0.3 * v); noise(t, 0.02, 0.3 * v, "highpass", 3000); },
      pop: (t, v) => { const f = 700 + (v || 0) * 160; tone(t, f, f * 1.7, 0.07, 0.12, "sine"); noise(t, 0.12, 0.05, "bandpass", 1600, 1.5, 3200); FX.clack(t + 0.42, 0.45); },
      crown: (t) => { [1046, 1318, 1568, 2093].forEach((f, i) => ring(t + i * 0.08, f, 0.9 - i * 0.1, 0.07)); },
      cheer: (t) => { tone(t, 392, 392, 0.14, 0.06, "triangle"); tone(t + 0.1, 523, 523, 0.14, 0.06, "triangle"); tone(t + 0.2, 659, 659, 0.3, 0.06, "triangle"); },
      // dice on the crate, borrowed from the tables
      shake: (t) => { for (let i = 0; i < 7; i++) noise(t - 0.3 + i * 0.045 + Math.random() * 0.01, 0.03, 0.1, "bandpass", 1500 + Math.random() * 900, 3); },
      knock: (t, v) => { const f = 500 + Math.random() * 300; tone(t, f, f * 0.8, 0.07, 0.3 * v, "triangle"); noise(t, 0.03, 0.3 * v, "bandpass", 1600 + Math.random() * 800, 3); tone(t, 120, 80, 0.06, 0.2 * v); },
      rattle: (t, v) => { for (let i = 0; i < 5; i++) { const at = t + i * (0.05 - i * 0.006) + Math.random() * 0.01; FX.knock(at, v * (1 - i * 0.16)); } },
      // the result, and the stake token landing with its own little noise
      win: (t) => { tone(t, 523, 523, 0.22, 0.06, "triangle"); tone(t + 0.12, 659, 659, 0.22, 0.06, "triangle"); tone(t + 0.24, 784, 784, 0.45, 0.07, "triangle"); },
      lose: (t) => { tone(t, 220, 196, 0.35, 0.08, "triangle"); tone(t + 0.18, 175, 147, 0.5, 0.08, "triangle"); },
      token: (t, kind) => {
        tone(t, 150, 80, 0.09, 0.28); noise(t, 0.05, 0.22, "lowpass", 900);
        if (kind === "first_watch") { ring(t + 0.02, 2400, 0.5, 0.05); noise(t + 0.08, 0.6, 0.03, "bandpass", 5000, 1.5); }
        else if (kind === "cooks_tomorrow" || kind === "washes_pots") { ring(t + 0.01, 620, 0.6, 0.06); ring(t + 0.01, 931, 0.5, 0.04); if (kind === "washes_pots") for (let i = 0; i < 5; i++) tone(t + 0.15 + i * 0.07 + Math.random() * 0.03, 700 + Math.random() * 500, 1500 + Math.random() * 600, 0.05, 0.05); }
        else if (kind === "carries_pack") { noise(t, 0.14, 0.2, "lowpass", 400); tone(t + 0.03, 90, 60, 0.15, 0.25); }
        else if (kind === "names_pet") { ring(t + 0.02, 1760, 0.6, 0.06); ring(t + 0.14, 2217, 0.5, 0.04); }
        else if (kind === "silver") { for (let i = 0; i < 4; i++) ring(t + i * 0.06, 2100 + Math.random() * 300, 0.4, 0.06); }
        else FX.tok(t + 0.02, 0.6);
      },
      // the goblin's delighted squeak, his brave little sniff, and his cousin's rumble
      hee: (t, v) => {
        v = v || 1;
        for (const [d, f0, f1] of [[0, 900, 1500], [0.12, 1000, 1700]]) {
          const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
          o.type = "sawtooth"; o.frequency.setValueAtTime(f0, t + d); o.frequency.exponentialRampToValueAtTime(f1, t + d + 0.08); o.frequency.exponentialRampToValueAtTime(f1 * 0.85, t + d + 0.11);
          f.type = "bandpass"; f.frequency.value = 2000; f.Q.value = 3;
          g.gain.setValueAtTime(0.0001, t + d); g.gain.linearRampToValueAtTime(0.06 * v, t + d + 0.015); g.gain.exponentialRampToValueAtTime(0.0006, t + d + 0.12);
          o.connect(f); f.connect(g); g.connect(out); o.start(t + d); o.stop(t + d + 0.15);
        }
      },
      sniff: (t) => { noise(t, 0.09, 0.08, "bandpass", 2600, 2); noise(t + 0.16, 0.12, 0.09, "bandpass", 2300, 2); },
      rumble: (t, v) => { const o = tone(t, 72, 64, 0.6, 0.16 * (v || 1), "sawtooth", 0.08); void o; noise(t, 0.5, 0.08 * (v || 1), "lowpass", 220); },
    };
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
    function play(name, v, late) { const c = ok(); if (!c || !FX[name]) return; try { FX[name](c.currentTime + 0.01, v === undefined ? 1 : typeof v === "number" && late ? Math.max(0.5, v - late) : v); } catch (e) { /* audio node limits */ } }
    if (root.document) {
      root.document.addEventListener("pointerdown", () => { unlocked = true; }, { capture: true });
      root.document.addEventListener("visibilitychange", () => { if (ctx && root.document.hidden) ctx.suspend(); });
    }
    return { play, render, FX, get ready() { return unlocked && prefs().on; } };
  })();

  // ---------- the player ----------
  const LONG = { fire: 1, tavern: 1 };
  const reduced = () => !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function player(rec, opts) {
    opts = opts || {};
    const doc = root.document, fig = doc.createElement("figure"), cv = doc.createElement("canvas");
    fig.className = "night-replay";
    cv.width = W; cv.height = H;
    cv.style.cssText = `image-rendering:pixelated;image-rendering:crisp-edges;display:block;cursor:pointer;${opts.scale ? `width:${W * opts.scale}px;height:${H * opts.scale}px` : "width:100%;height:auto"}`;
    cv.title = "Click to watch again";
    fig.appendChild(cv);
    const g = cv.getContext("2d"), img = g.createImageData(W, H);
    const p = planFor(rec);
    if (!p) return fig;
    let t = reduced() ? p.dur + 1 : 0, raf = 0, last = 0, onscreen = false, fired = 0, lastDraw = -1, rate = 1, held = false, forced = false;
    const evs = p.ev.slice().sort((a, b) => a[0] - b[0]);
    const paint = () => { const f = render(rec, t); img.data.set(f.data); g.putImageData(img, 0, 0); };
    const live = () => !held && fig.isConnected && onscreen && !doc.hidden;
    function frame(ms) {
      raf = 0;
      if (!live()) { last = 0; return; }
      const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
      last = ms;
      t += dt * rate;
      // a bed that should already be running (the fire, the room) starts late rather than not at all
      while (fired < evs.length && evs[fired][0] <= t) {
        const e = evs[fired], late = t - e[0];
        if (late < 0.25) Snd.play(e[1], e[2]);
        else if (LONG[e[1]] && late < e[2] - 1) Snd.play(e[1], e[2], late);
        fired++;
      }
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

  root.NightReplay = {
    player, W, H, SCENES: Object.keys(SCENES),
    frame: render,
    length: (rec) => { const p = planFor(rec); return p ? p.dur : 0; },
    events: (rec) => { const p = planFor(rec); return p ? p.ev.slice() : []; },
    sound: Snd,
  };
})(typeof window !== "undefined" ? window : globalThis);
