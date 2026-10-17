/* Chess replays: the deciding moments of a game (or the whole game, fast-forwarded) on a camp crate, a stump, a tavern table, a guild hall table or the Yeti Society's lodge table, with a zoom on every mate, a big king tip-over, the rare board flip and the Yeti correspondence board, drawn in pixel art with synthesised sound. */
/*
  INPUT: one chess record (the engine writes one per game it wants replayed):
    { id: string, unique; it seeds the little choices (where props sit, how the pieces fly when a board is flipped),
      day, season,
      game: "chess",
      setting: "camp" | "stump" | "tavern" | "hall" | "lodge"
               camp: the crate by the fire; stump: a big stump by the fire; tavern: a tavern table; hall: a guild hall table with
               an ivory inlay round the board; lodge: the Yeti Society's lodge table in Frosthold,
      town?: town id; dresses a tavern, hall or lodge (thornwall's pie, saltmarrow's shells, veldrock's lampstone lantern...),
      biome?: "plains" | "forest" | "hills" | "marsh" | "coast" | "snow" | "volcanic"; the ground round a camp or stump,
      set: { id: "chess_bone", tier: 0..3 }   the pieces and board come from the set id in league/content/night_games.py SETS
               (chess_peg, chess_drift, chess_bone, chess_ivory); an unknown id falls back to its tier,
      players: [ { id, name, hot?: true, yeti?: true }, { ... } ]
               players[0] plays white from the near edge, players[1] black from the far edge. hot marks a hot temper (see flip);
               yeti marks the Yeti Society's unseen side (shown as FOOTPRINT),
      moves: ["e2e4", "e7e5", "g1f3", "e1g1", "e7e8q", ...]
               every ply from the standard start in coordinate form: from square, to square and an optional promotion letter
               (q r b n). Castling is the king's two-square move and en passant the pawn's diagonal step; both are recognised by rule.
               A move whose from square is empty ends the list there,
      san?: ["e4", "e5", ...]   the engine's own notation per ply for the move counter (computed when missing),
      key: [18, 24, 30, 32]   the 3 or 4 deciding plies (only the last 4 are played), as 0-based indices into moves, ascending: a big capture, a check, the
               turning point. They usually end on the last ply. Missing or empty: the biggest captures and checks plus the last ply,
      result: "mate" | "resign" | "draw",
      winner: 0 | 1 | null   who mated, or whose opponent resigned; null for a draw,
      why?: "stalemate" | "repetition" | "fifty" | "bare kings" | "move cap"   a draw's reason, for its stamp,
      flip?: true   the hot-tempered loser flips the board instead of the king tipping. The engine rolls the rarity; it is ignored
               unless the loser has hot: true and the game was not drawn,
      legend?: "THE OPERA GAME, AS THE DUKE'S BANE PLAYED IT AT IRONHAVEN HALL"
               a famous game told as an in-world legend, on a parchment above the board (never over it). No real names here,
      real?: "Paul Morphy vs. the Duke of Brunswick..."   the real game behind a legend, in small print under the figure,
      stake?, stake_cp?: as in night_replay.js: the loser's token after the result,
      yeti?: { day: 7, ply: 12 }
               the Yeti Society correspondence board: the position before moves[ply] waits on the lodge table, today's slip arrives
               under a footprint slam ("DAY 7" and the move), moves[ply] is played, then "NEXT: TOMORROW". On the last ply the game
               ends as usual (a mate still zooms in and tips the king). Key moments and the full game don't apply in this mode
    }

  ChessReplay.player(rec, opts) -> <figure> that plays the key moments while on screen, holds on the result and replays on click,
    with a "▸ Watch the full game" button (fast-forward with ghost streaks and a counter, slowing for the last moves) that toggles
    back to the key moments. Under reduced motion it shows the final frame. opts.scale (CSS px per pixel, default fluid);
    opts.mode "key" | "full" to start in.
  ChessReplay.frame(rec, t, opts) -> { w, h, data: RGBA bytes }: any moment as pixels (no DOM); opts.mode as above.
  ChessReplay.length(rec, opts) -> seconds of action before the hold. ChessReplay.events(rec, opts) -> the sound cues.
  ChessReplay.game(rec) -> the parsed plies (from, to, piece, capture, check, san). ChessReplay.SETTINGS lists the settings.
*/
(function (root) {
  "use strict";
  const W = 192, H = 144;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const sc = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const ease = (t) => 1 - (1 - t) * (1 - t);
  const ease3 = (t) => 1 - Math.pow(1 - t, 3);
  const smooth = (t) => t * t * (3 - 2 * t);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const dith = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const h2 = (x, y, s) => (hash(x + "," + y + "," + (s || 0)) % 1000) / 1000;
  function vnoise(seed) {
    const r = rng(seed), p = new Float32Array(64 * 64);
    for (let i = 0; i < p.length; i++) p[i] = r();
    const at = (x, y) => p[((y & 63) << 6) | (x & 63)];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
      return lerp(lerp(at(xi, yi), at(xi + 1, yi), xf), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), xf), yf);
    };
  }

  // ---------- 3D maths and the 70-degree camera ----------
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const mv = (A, v) => [dot(A[0], v), dot(A[1], v), dot(A[2], v)];
  const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
  const Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };

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
    ray(sx, sy) {
      const dx = (sx - this.cx - this.sx) / this.focal, dy = (sy - this.cy - this.sy) / this.focal;
      return [this.f[0] + dx - this.u[0] * dy, this.f[1] - this.u[1] * dy, this.f[2] - this.u[2] * dy];
    }
    unproject(sx, sy, k, v) {
      const D = this.ray(sx, sy), s = (v - this.pos[k]) / D[k];
      return [this.pos[0] + D[0] * s, this.pos[1] + D[1] * s, this.pos[2] + D[2] * s];
    }
  }

  // ---------- the raster: float RGB plus an emissive mask the lighting pass leaves alone ----------
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
      this.c[i] *= f; this.c[i + 1] *= f; this.c[i + 2] *= f;
    }
    add(x, y, col, a) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 3;
      this.c[i] += col[0] * a; this.c[i + 1] += col[1] * a; this.c[i + 2] += col[2] * a;
    }
    blend(x, y, col, a, emit) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 3;
      this.c[i] = lerp(this.c[i], col[0], a); this.c[i + 1] = lerp(this.c[i + 1], col[1], a); this.c[i + 2] = lerp(this.c[i + 2], col[2], a);
      if (emit) this.e[y * W + x] = 1;
    }
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
      for (let n = 0; n < 600; n++) {
        this.px(x0, y0, col, emit);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    rect(x, y, w, h, col, emit) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, col, emit); }
    ell(cx, cy, rx, ry, fn) {
      const xa = Math.floor(cx - rx), xb = Math.ceil(cx + rx), ya = Math.floor(cy - ry), yb = Math.ceil(cy + ry);
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) fn(nx, ny, x, y);
      }
    }
    shadow(cx, cy, rx, ry, f, soft) {
      soft = soft === undefined ? 0.35 : soft;
      this.ell(cx, cy, rx, ry, (nx, ny, x, y) => {
        const d = Math.sqrt(nx * nx + ny * ny), k = d < 1 - soft ? 1 : (1 - d) / soft;
        if (k >= 1 || k > dith(x, y)) this.mul(x, y, f);
      });
    }
  }

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
  function light(b, lamps, amb, levels) {
    levels = levels || 9;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (b.e[i]) continue;
      const th = dith(x, y);
      let r = amb[0], g = amb[1], bl = amb[2];
      for (const L of lamps) {
        if (L.kind === "win") {
          const u = (x + 0.5 - L.x - (y + 0.5 - L.y) * L.skew) / L.w, v = (y + 0.5 - L.y) / L.h;
          const e = Math.max(Math.abs(u), Math.abs(v));
          if (e >= 1) continue;
          const bar = Math.abs(u) < 0.05 || Math.abs(v) < 0.06 ? 0.3 : 1;
          const k = Math.floor(Math.min(1, (1 - e) * 3) * bar * L.i * levels + th) / levels;
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
      const k = Math.floor((1 - Math.sqrt(nx * nx + ny * ny)) * a * 5 + dith(px, py)) / 5;
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
    "!": "11101", "?": "110001010000010", ".": "00001", ",": "00011", ":": "01010", "-": "000000111000000",
    "+": "000010111010000", "=": "000111000111000", "'": "11000", "/": "001001010100100", "#": "101111101111101", "x": "000101010101000",
    ">": "100010001010100", "(": "010100100100010", ")": "010001001001010", " ": "0000000000",
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
    if (o.right) x = Math.round(x - textWidth(s, k));
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
  // the pixel font has no accents: é is drawn as E rather than dropped
  const plain = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
  function wrap(s, maxW) {
    const words = plain(s).toUpperCase().replace(/[^A-Z0-9 '!.,:?()-]/g, "").split(/\s+/).filter(Boolean), lines = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? cur + " " + w : w;
      if (textWidth(next) > maxW && cur) { lines.push(cur); cur = w; } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function money(cp) {
    cp = Math.abs(Math.round(cp));
    const s = Math.floor(cp / 10), c = cp % 10;
    if (!s) return `${c} COPPER`;
    if (c && s < 10) return `${s}S ${c}C`;
    return `${Math.round(cp / 10)} SILVER`;
  }

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
    k(x, y, z) { return this.cam.scale(x, y, z || 0); }
    lit(col, n) { return this.shade(col, this.amb + this.dif * Math.max(0, dot(n, this.key))); }
    poly3(pts, col, emit) { this.b.poly(pts.map((p) => this.P(p[0], p[1], p[2])), col, emit); }
    // an axis-aligned world plane textured pixel by pixel: fn(x, y, z, sx, sy) -> colour
    plane(pts, k, v, fn) {
      const cam = this.cam;
      this.b.poly(pts.map((p) => this.P(p[0], p[1], p[2])), null, false, (sx, sy) => {
        const w = cam.unproject(sx + 0.5, sy + 0.5, k, v);
        return fn(w[0], w[1], w[2], sx, sy);
      });
    }
    // any flat quad (origin o, edge vectors ex, ey) textured exactly through the camera: fn(u, v) with u, v in 0..1
    quad(o, ex, ey, fn) {
      const cam = this.cam, n = cross(ex, ey), corners = [o, [o[0] + ex[0], o[1] + ex[1], o[2] + ex[2]], [o[0] + ex[0] + ey[0], o[1] + ex[1] + ey[1], o[2] + ex[2] + ey[2]], [o[0] + ey[0], o[1] + ey[1], o[2] + ey[2]]];
      const ee = dot(ex, ex), ff = dot(ey, ey), on = dot([o[0] - cam.pos[0], o[1] - cam.pos[1], o[2] - cam.pos[2]], n);
      this.b.poly(corners.map((p) => this.P(p[0], p[1], p[2])), null, false, (sx, sy) => {
        const D = cam.ray(sx + 0.5, sy + 0.5), den = dot(D, n);
        if (Math.abs(den) < 1e-9) return null;
        const s = on / den, r = [cam.pos[0] + D[0] * s - o[0], cam.pos[1] + D[1] * s - o[1], cam.pos[2] + D[2] * s - o[2]];
        return fn(clamp(dot(r, ex) / ee, 0, 0.9999), clamp(dot(r, ey) / ff, 0, 0.9999));
      });
    }
    drop(x, y, z, r, f, g) {
      g = g || 0;
      const spread = 1 + (z - g) / 80, fade = clamp(1 - (z - g) / 100, 0.12, 1);
      const c = this.P(x, y, g), s = this.k(x, y, g) * r * spread;
      this.b.shadow(c[0], c[1], s, s * 0.9, 1 - (1 - f) * fade);
    }
    box(c, h, R, col, o) {
      o = o || {};
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
        const lc = this.lit(fcol, wn);
        this.b.poly(q, lc, false);
        if (o.edge !== false) for (let i = 0; i < 4; i++) { const a = q[i], bq = q[(i + 1) % 4]; this.b.line(a[0], a[1], bq[0], bq[1], o.edgeCol || sc(lc, 0.72)); }
      }
    }
    cyl(c, r, hgt, col, o) {
      o = o || {};
      const n = o.n || Math.max(10, Math.round(r * this.k(c[0], c[1], c[2]) * 2.2));
      const R = o.R || I3;
      const ring = (z) => { const out = []; for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n, w = mv(R, [r * Math.cos(a), r * Math.sin(a), z]); out.push([c[0] + w[0], c[1] + w[1], c[2] + w[2]]); } return out; };
      const lo = ring(0), hi = ring(hgt);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, a = 2 * Math.PI * (i + 0.5) / n, nn = mv(R, [Math.cos(a), Math.sin(a), 0]);
        const mid = [(lo[i][0] + hi[j][0]) / 2, (lo[i][1] + hi[j][1]) / 2, (lo[i][2] + hi[j][2]) / 2];
        if (!this.cam.facing(mid, nn)) continue;
        const lc = this.lit(o.side || col, nn);
        this.poly3([lo[i], lo[j], hi[j], hi[i]], o.sideFn ? o.sideFn(i, n, lc) : lc, o.emit);
      }
      const up = mv(R, [0, 0, 1]), top = [c[0] + up[0] * hgt, c[1] + up[1] * hgt, c[2] + up[2] * hgt];
      const face = this.cam.facing(top, up), capN = face ? up : sc(up, -1), cap = face ? hi : lo;
      const capc = this.lit(o.capCol || col, capN);
      if (o.capFn) this.b.poly(cap.map((p) => this.P(p[0], p[1], p[2])), null, o.emit, o.capFn(capc, capN, face));
      else this.poly3(cap, capc, o.emit);
      if (o.rim && face) { const pts = cap.map((p) => this.P(p[0], p[1], p[2])), tp = this.P(top[0], top[1], top[2]); for (let i = 0; i < n; i++) { const a = pts[i], bq = pts[(i + 1) % n]; if (a[1] + bq[1] > 2 * tp[1]) this.b.line(a[0], a[1], bq[0], bq[1], o.rim); } }
      return cap;
    }
  }

  // ---------- effects ----------
  function stamp(b, s, x, y, col, t, k, outline) {
    if (t <= 0) return;
    k = k || 2;
    const pop = t < 0.14 ? 1 + (0.14 - t) * 5 : 1;
    const kk = Math.max(1, Math.round(k * pop));
    text(b, s, x, y - Math.round((kk - k) * 2.5), col, { k: kk, center: true, outline: outline || [24, 14, 10] });
  }
  function sparkle(b, x, y, s, col) {
    x = Math.round(x); y = Math.round(y);
    b.px(x, y, [255, 255, 236], true);
    for (let i = 1; i <= s; i++) { const cc = i === s ? sc(col, 0.8) : col; b.px(x + i, y, cc, true); b.px(x - i, y, cc, true); b.px(x, y + i, cc, true); b.px(x, y - i, cc, true); }
  }
  function slate(b, x, y, w, h, frame) {
    b.rect(x + 1, y + 1, w, h, [10, 8, 6], true);
    b.rect(x, y, w, h, frame || [96, 66, 40], true);
    b.rect(x + 1, y + 1, w - 2, h - 2, [36, 38, 36], true);
  }
  function rays(b, cx, cy, u, n, r0, r1, colA, colB, seed) {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + (seed || 0.2), a0 = r0 + ease(u) * r1, a1 = a0 + (1 - u) * r1 * 0.45;
      for (let s = a0; s < a1; s += 0.7) b.px(cx + Math.cos(a) * s, cy + Math.sin(a) * s * 0.8, u < 0.35 ? colA : colB, true);
    }
  }
  function flame(b, x, y, k, t, tint) {
    const fl = Math.sin(t * 17 + x) * 0.5 + Math.sin(t * 7.3 + y) * 0.5;
    const h = Math.max(2, Math.round(5 * k + fl * 0.8)), lean = Math.round(fl * 0.6);
    const outer = tint || [255, 170, 60];
    for (let j = 0; j < h; j++) {
      const w = j < h * 0.4 ? Math.max(1, Math.round(k * 0.8)) : 0, yy = Math.round(y) - j, xx = Math.round(x) + (j > h * 0.6 ? lean : 0);
      for (let i = -w; i <= w; i++) b.px(xx + i, yy, outer, true);
      if (j < h * 0.6 && j > 0) b.px(xx, yy, [255, 246, 200], true);
    }
  }
  function campfire(b, x, y, wall, k) {
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

  // ---------- chess rules: just enough to replay a move list (castling, en passant, promotion, check) ----------
  const VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
  const sqi = (s) => { if (!s || s.length < 2) return -1; const f = s.charCodeAt(0) - 97, r = s.charCodeAt(1) - 49; return f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1; };
  const sqName = (i) => "ABCDEFGH"[i % 8] + (Math.floor(i / 8) + 1);
  function startBoard() {
    const b = new Array(64).fill(null);
    let id = 0;
    "RNBQKBNR".split("").forEach((t, f) => { b[f] = { id: id++, t, c: 0 }; b[8 + f] = { id: id++, t: "P", c: 0 }; b[48 + f] = { id: id++, t: "P", c: 1 }; b[56 + f] = { id: id++, t, c: 1 }; });
    return b;
  }
  function attacked(b, s, by) {
    const f = s % 8, r = Math.floor(s / 8);
    const at = (ff, rr) => (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 ? b[rr * 8 + ff] : undefined);
    const pr = by === 0 ? r - 1 : r + 1;
    for (const df of [-1, 1]) { const p = at(f + df, pr); if (p && p.c === by && p.t === "P") return true; }
    for (const [df, dr] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) { const p = at(f + df, r + dr); if (p && p.c === by && p.t === "N") return true; }
    for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) { if (!df && !dr) continue; const p = at(f + df, r + dr); if (p && p.c === by && p.t === "K") return true; }
    for (const [df, dr, ts] of [[1, 0, "RQ"], [-1, 0, "RQ"], [0, 1, "RQ"], [0, -1, "RQ"], [1, 1, "BQ"], [1, -1, "BQ"], [-1, 1, "BQ"], [-1, -1, "BQ"]]) {
      for (let k = 1; k < 8; k++) {
        const p = at(f + df * k, r + dr * k);
        if (p === undefined) break;
        if (p) { if (p.c === by && ts.includes(p.t)) return true; break; }
      }
    }
    return false;
  }
  function sanOf(ply) {
    let s;
    if (ply.castle) s = ply.to > ply.from ? "O-O" : "O-O-O";
    else {
      s = ply.t === "P" ? (ply.cap ? "ABCDEFGH"[ply.from % 8] : "") : ply.t;
      s += (ply.cap ? "x" : "") + sqName(ply.to) + (ply.promo ? "=" + ply.promo : "");
    }
    return s + (ply.mate ? "#" : ply.check ? "+" : "");
  }
  function parseGame(moves, sans, mateEnd) {
    const b = startBoard(), plies = [];
    const snap = () => { const m = new Map(); b.forEach((p, i) => { if (p) m.set(p.id, { sq: i, t: p.t, c: p.c }); }); return m; };
    const states = [snap()];
    for (const raw of moves || []) {
      const m = String(raw).trim().toLowerCase();
      const from = sqi(m.slice(0, 2)), to = sqi(m.slice(2, 4));
      const pc = from >= 0 ? b[from] : null;
      if (!pc || to < 0 || from === to) break;
      const ply = { i: plies.length, from, to, id: pc.id, t: pc.t, c: pc.c, cap: null, castle: null, promo: null, check: false, mate: false };
      let vsq = to, victim = b[to];
      if (pc.t === "P" && !victim && from % 8 !== to % 8) { vsq = to + (pc.c === 0 ? -8 : 8); victim = b[vsq]; }
      if (victim && victim.c !== pc.c) ply.cap = { id: victim.id, t: victim.t, c: victim.c, sq: vsq };
      if (victim) b[vsq] = null;
      b[to] = pc; b[from] = null;
      if (pc.t === "K" && Math.abs(to - from) === 2) {
        const rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1, rk = b[rf];
        if (rk) { b[rt] = rk; b[rf] = null; ply.castle = { id: rk.id, from: rf, to: rt }; }
      }
      if (pc.t === "P" && (to >> 3 === 7 || to >> 3 === 0)) {
        const pt = (m[4] || "q").toUpperCase(), nt = "QRBN".includes(pt) ? pt : "Q";
        b[to] = { id: pc.id, t: nt, c: pc.c };
        ply.promo = nt;
      }
      const ks = b.findIndex((p) => p && p.t === "K" && p.c !== pc.c);
      ply.kingSq = ks;
      ply.check = ks >= 0 && attacked(b, ks, pc.c);
      plies.push(ply);
      states.push(snap());
    }
    if (mateEnd && plies.length) { const last = plies[plies.length - 1]; last.mate = true; last.check = true; }
    plies.forEach((ply, i) => { ply.san = sans && sans[i] ? String(sans[i]).replace(/[^A-Za-z0-9+#=x-]/g, "").toUpperCase().replace(/X/g, "x") : sanOf(ply); });
    return { plies, states };
  }
  function autoKeys(G) {
    const N = G.plies.length;
    if (!N) return [];
    const sc0 = G.plies.map((p, i) => ({ i, s: (p.cap ? VAL[p.cap.t] * 2 : 0) + (p.check ? 3 : 0) + (p.promo ? 8 : 0) + i / N }));
    const pick = sc0.slice(0, N - 1).sort((a, b) => b.s - a.s).slice(0, 3).filter((q) => q.s >= 2).map((q) => q.i);
    return [...new Set(pick.concat([N - 1]))].sort((a, b) => a - b);
  }

  // ---------- the sets: palettes and quirks, keyed by the set ids in league/content/night_games.py ----------
  const LOOKS = {
    chess_peg: { tier: 0, style: "peg", mat: "peg", board: "leather",
      pal: [{ hi: [242, 216, 170], li: [222, 190, 140], mid: [198, 162, 112], sh: [160, 122, 80], dk: [120, 88, 56], ol: [60, 38, 22] },
            { hi: [170, 120, 80], li: [136, 92, 60], mid: [108, 70, 46], sh: [82, 52, 34], dk: [58, 36, 24], ol: [24, 14, 8] }] },
    chess_drift: { tier: 1, style: "drift", mat: "drift", board: "planks",
      pal: [{ hi: [246, 242, 228], li: [224, 218, 200], mid: [202, 194, 174], sh: [162, 154, 138], dk: [122, 114, 102], ol: [58, 52, 46] },
            { hi: [148, 132, 114], li: [108, 94, 80], mid: [80, 68, 58], sh: [58, 48, 42], dk: [40, 33, 28], ol: [12, 10, 8] }] },
    chess_bone: { tier: 2, style: "bone", mat: "bone", board: "antler",
      pal: [{ hi: [254, 248, 230], li: [238, 228, 200], mid: [220, 206, 174], sh: [178, 160, 130], dk: [136, 118, 94], ol: [68, 54, 40] },
            { hi: [184, 148, 110], li: [152, 116, 84], mid: [124, 92, 66], sh: [96, 70, 50], dk: [70, 50, 36], ol: [30, 20, 14] }] },
    chess_ivory: { tier: 3, style: "ivory", mat: "ivory", board: "rosewood",
      pal: [{ hi: [255, 255, 250], li: [248, 242, 228], mid: [230, 222, 202], sh: [192, 182, 162], dk: [150, 140, 122], ol: [70, 60, 50] },
            { hi: [190, 196, 220], li: [96, 94, 110], mid: [60, 56, 68], sh: [40, 38, 46], dk: [26, 24, 30], ol: [6, 6, 8] }] },
  };
  const GOLD = { hi: [255, 240, 160], li: [246, 206, 96], mid: [222, 172, 64], sh: [168, 118, 40], dk: [118, 78, 26] };
  function lookOf(rec) {
    const set = rec.set || {}, id = typeof set === "string" ? set : set.id;
    if (LOOKS[id]) return Object.assign({ id }, LOOKS[id]);
    const tier = clamp(Math.round(set.tier || 0), 0, 3), k = Object.keys(LOOKS).find((x) => LOOKS[x].tier === tier) || "chess_peg";
    return Object.assign({ id: k }, LOOKS[k]);
  }

  // ---------- the pieces: turned profiles in "unit" pixels (one unit is one pixel at the board's normal size) ----------
  // each segment: [kind, height, half-width at top, half-width at bottom]; kinds with their own shapes: ball, mitre, cross, head, crown, crenel
  const PROF = {
    P: [["ball", 4, 2.2], ["line", 1, 2.8, 2.8], ["line", 3, 1.6, 2.7], ["line", 2, 3.5, 3.9]],
    R: [["crenel", 3, 3.5, 3.5], ["line", 1, 2.7, 2.7], ["line", 5, 2.4, 2.9], ["line", 1, 3.5, 3.5], ["line", 2, 3.9, 4.2]],
    B: [["ball", 2, 1.1], ["mitre", 6, 2.8], ["line", 1, 3.1, 3.1], ["line", 4, 1.7, 2.8], ["line", 2, 3.6, 4.0]],
    Q: [["ball", 2, 1.3], ["crown", 3, 3.6, 2.2], ["line", 1, 2.8, 2.8], ["line", 7, 1.7, 3.0], ["line", 1, 3.7, 3.7], ["line", 3, 3.9, 4.4]],
    K: [["cross", 4], ["line", 3, 2.4, 3.4], ["line", 1, 2.7, 2.7], ["line", 7, 1.7, 3.0], ["line", 1, 3.7, 3.7], ["line", 3, 3.9, 4.4]],
    N: [["head", 10], ["line", 1, 3.3, 3.3], ["line", 3, 3.8, 4.1]],
  };
  // Academy ivory: tall crowned kings
  const KING_TALL = [["cross", 4], ["crown", 2, 3.2, 2.6], ["line", 2, 2.6, 3.4], ["line", 1, 2.6, 2.6], ["line", 8, 1.7, 3.1], ["line", 1, 3.8, 3.8], ["line", 3, 4.0, 4.5]];
  // the knight's head, facing left: x from the centre line, y down from the top of the segment
  const HEAD = [[0.3, 0], [1.4, 0.9], [2.6, 2.4], [3.3, 4.8], [3.5, 7.4], [3.4, 10], [-2.6, 10], [-1.7, 8.4], [-0.6, 7.0], [-1.7, 6.6], [-3.4, 6.2],
    [-4.1, 5.2], [-3.9, 4.2], [-2.8, 2.8], [-1.6, 1.7], [-0.7, 0.9]];
  const PONY = [[0.3, 0.6], [1.4, 1.3], [2.6, 2.6], [3.3, 4.8], [3.5, 7.4], [3.4, 10], [-2.6, 10], [-1.8, 8.6], [-0.8, 7.2], [-1.8, 6.8], [-3.3, 6.4],
    [-3.7, 5.4], [-3.4, 4.4], [-2.4, 3.2], [-1.4, 2.0], [-0.6, 1.3]];
  function inPoly(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  const sprites = new Map();
  // a piece sprite at scale k: an outlined, lathe-shaded silhouette with its set's quirks; px holds colours or null
  function pieceSprite(look, type, side, k) {
    k = Math.max(0.6, Math.round(k * 10) / 10);
    const key = look.id + type + side + k;
    let spr = sprites.get(key);
    if (spr) return spr;
    const style = look.style, pal = look.pal[side];
    let prof = PROF[type];
    if (type === "K" && style === "ivory") prof = KING_TALL;
    const hy = style === "peg" ? 0.92 : 1, hwK = style === "peg" ? 0.9 : 1;
    const segs = [];
    let v0 = 0;
    for (const s of prof) { segs.push({ kind: s[0], v0, len: s[1], a: s[2], b: s[3] === undefined ? s[2] : s[3] }); v0 += s[1]; }
    const units = v0, h = Math.max(4, Math.round(units * hy * k)), ku = h / units;
    const lean = style === "drift" ? (type === "B" ? 1.7 : (h2(type, side, 7) - 0.5) * 1.2) : 0;
    const head = style === "bone" ? PONY : HEAD;
    const hwAt = (sg, s) => {
      if (sg.kind === "ball") return sg.a * Math.sqrt(Math.max(0, 1 - Math.pow(s * 2 - 1, 2)));
      if (sg.kind === "mitre") return sg.a * Math.pow(Math.sin(Math.PI * clamp(0.1 + s * 0.82, 0, 1)), 0.75);
      if (sg.kind === "cross") return s >= 0.25 && s < 0.5 ? 1.6 : 0.55;
      return lerp(sg.a, sg.b, s);
    };
    const maxHw = 5.2 + Math.abs(lean);
    const w = 2 * Math.ceil(maxHw * k * hwK) + 5, cx = w / 2;
    const inside = new Uint8Array(w * h), tone = new Float32Array(w * h), mark = new Uint8Array(w * h);
    const segOf = (v) => { for (const sg of segs) if (v < sg.v0 + sg.len) return sg; return segs[segs.length - 1]; };
    const rowHw = new Float32Array(h), rowOff = new Float32Array(h);
    for (let j = 0; j < h; j++) {
      const v = (j + 0.5) / ku, sg = segOf(v), s = clamp((v - sg.v0) / sg.len, 0, 1);
      let hw = hwAt(sg, s) * hwK;
      if (style === "peg" && sg.v0 > 3 && sg.kind === "line") hw = Math.min(hw, 2.9);
      if (style === "drift") hw += (h2(type + side, Math.floor(v), 3) - 0.5) * 0.6;
      rowHw[j] = hw * ku;
      rowOff[j] = lean * (1 - j / h) * Math.min(1.6, ku);
      for (let i = 0; i < w; i++) {
        const ux = (i + 0.5 - cx - rowOff[j]) / ku;
        let on;
        if (sg.kind === "head") {
          const hx = side === 1 ? -ux : ux;
          on = inPoly(head, hx / hwK, v - sg.v0);
          if (!on && style === "bone" && v - sg.v0 > 1.4 && v - sg.v0 < 9 && hx > 0) {
            const edge = inPoly(head, (hx - 0.9) / hwK, v - sg.v0);
            if (edge && (Math.floor(v * 1.6) + Math.floor(hx * 2)) % 2 === 0) { on = true; mark[j * w + i] = 3; }
          }
        } else on = Math.abs(ux) <= hw + 0.02;
        if (!on) continue;
        if (sg.kind === "crenel" && s < 0.36 && Math.abs(ux) > 0.6 * hwK && Math.abs(ux) < 1.6 * hwK) on = false;
        if (sg.kind === "crown" && s < 0.36) { const a = Math.abs(ux) / hwK; if ((a > 0.55 && a < 1.45) || (a > 2.45 && a < 3.0)) on = false; }
        if (!on) continue;
        inside[j * w + i] = 1;
        if (sg.kind === "mitre") {
          const px0 = 1.5, py0 = 0.15, px1 = -0.5, py1 = 0.66, dx = px1 - px0, dy = (py1 - py0) * sg.len;
          const t = clamp(((ux - px0) * dx + (s - py0) * sg.len * dy) / (dx * dx + dy * dy), 0, 1);
          if (Math.hypot(ux - (px0 + dx * t), (s - py0) * sg.len - dy * t) < 0.42) mark[j * w + i] = 1;
        }
        if ((sg.kind === "cross" || sg.kind === "crown") && style === "ivory" && (type === "K" || type === "Q")) mark[j * w + i] = 2;
        if (sg.kind === "head") {
          const hx = side === 1 ? -ux : ux, hv = v - sg.v0;
          if (Math.hypot(hx + 1.3, hv - 3.4) < 0.62) mark[j * w + i] = 1;
          if (Math.hypot(hx + 3.5, hv - 5.4) < 0.45 && ku > 1.4) mark[j * w + i] = 1;
          if (hx > 2.1 && hv > 1.6 && hv < 9.2 && !mark[j * w + i]) mark[j * w + i] = 4;
        }
        if (style === "peg" && sg.v0 > 3 && (Math.abs((j + 0.5) / h - 0.62) < 0.55 / h || Math.abs((j + 0.5) / h - 0.8) < 0.55 / h)) mark[j * w + i] = 1;
        if (style === "bone" && type === "P" && sg.v0 === 4) mark[j * w + i] = 5;
        if (style === "bone" && type === "K" && Math.abs(v - (prof === KING_TALL ? 7.5 : 7.5)) < 1.0) mark[j * w + i] = 6;
      }
    }
    // the bone king's fur ruff and the bone pawn's scarf tail sit just outside the silhouette
    if (style === "bone" && (type === "K" || type === "P")) {
      const v1 = type === "K" ? 7.5 : 4.5;
      const add = [], was = inside.slice();
      for (let j = 0; j < h; j++) {
        const v = (j + 0.5) / ku;
        if (Math.abs(v - v1) > (type === "K" ? 1.3 : 0.5)) continue;
        for (let i = 1; i < w - 1; i++) {
          if (was[j * w + i]) continue;
          if (type === "K" && (was[j * w + i - 1] || was[j * w + i + 1]) && (i + j) % 2 === 0) add.push([i, j, 6]);
          if (type === "P" && was[j * w + i - 1]) for (let q = 0; q < Math.max(3, Math.round(3 * ku)); q++) if (j + q < h - 1) add.push([i, j + q, 5]);
        }
      }
      for (const [i, j, m] of add) { inside[j * w + i] = 1; mark[j * w + i] = m; }
    }
    // lathe light from the upper left: brightness from each row's span, a lift on ledges that catch the light, a dip under overhangs
    for (let j = 0; j < h; j++) {
      let i = 0;
      while (i < w) {
        if (!inside[j * w + i]) { i++; continue; }
        let e = i;
        while (e < w && inside[j * w + e]) e++;
        const mid = (i + e) / 2, half = Math.max(0.6, (e - i) / 2);
        for (let x = i; x < e; x++) {
          const nx = clamp((x + 0.5 - mid) / half, -1, 1);
          let br = -0.6 * nx + 0.8 * Math.sqrt(Math.max(0, 1 - nx * nx));
          const above = j > 0 && inside[(j - 1) * w + x];
          if (!above) br += 0.3;
          else if (j > 1 && rowHw[j - 1] > rowHw[j] + 0.7 && Math.abs(x + 0.5 - cx - rowOff[j]) > rowHw[j] - 1.2) br -= 0.25;
          tone[j * w + x] = br;
        }
        i = e;
      }
    }
    const px = new Array(w * h).fill(null);
    const T = [pal.hi, pal.li, pal.mid, pal.sh, pal.dk];
    const pick = (br, x, y, tset) => {
      const b2 = br + (dith(x, y) - 0.5) * 0.1;
      const i = b2 > (style === "ivory" ? 0.985 : 0.95) ? 0 : b2 > 0.74 ? 1 : b2 > 0.47 ? 2 : b2 > 0.2 ? 3 : 4;
      return { i, c: (tset || T)[i] };
    };
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const q = j * w + i;
      if (!inside[q]) continue;
      const m = mark[q];
      let br = tone[q];
      if (m === 1) { px[q] = sc(pal.dk, side === 1 ? 0.6 : 0.85); continue; }
      if (m === 3 || m === 4) br -= 0.32;
      if (style === "drift" && h2(i, Math.floor(j / 3), 11) > 0.78) br -= 0.24;
      if (style === "bone" && h2(i, j, 5) > 0.93) br -= 0.3;
      let tset = T;
      if (m === 2) tset = [GOLD.hi, GOLD.li, GOLD.mid, GOLD.sh, GOLD.dk];
      if (m === 5) tset = side === 0 ? [[238, 120, 96], [212, 74, 56], [184, 52, 40], [140, 36, 30], [100, 24, 22]] : [[150, 186, 226], [104, 146, 200], [74, 112, 168], [54, 82, 128], [38, 58, 92]];
      if (m === 6) tset = side === 0 ? [[255, 255, 250], [246, 242, 232], [228, 222, 208], [196, 188, 172], [160, 150, 134]] : [[226, 212, 190], [204, 186, 160], [176, 156, 128], [140, 120, 96], [104, 88, 70]];
      const pk = pick(br, i, j, tset);
      let col = pk.c;
      if (style === "ivory" && pk.i === 0 && m !== 2) col = side === 0 ? [255, 255, 255] : [200, 210, 236];
      px[q] = col;
    }
    // outline: every empty pixel touching the silhouette
    for (let j = -1; j <= h; j++) for (let i = 0; i < w; i++) {
      if (j >= 0 && j < h && inside[j * w + i]) continue;
      const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && inside[y * w + x];
      if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) { if (j >= 0 && j < h) px[j * w + i] = pal.ol; }
    }
    // a top outline row may fall above the sprite: grow it by one row so the crown keeps its outline
    const out = new Array(w * (h + 1)).fill(null);
    for (let i = 0; i < w; i++) if (inside[i]) out[i] = pal.ol;
    for (let q = 0; q < w * h; q++) out[w + q] = px[q];
    let baseHw = 0;
    for (let i = 0; i < w; i++) if (inside[(h - 1) * w + i]) baseHw = Math.max(baseHw, Math.abs(i + 0.5 - cx));
    spr = { w, h: h + 1, px: out, baseHw: baseHw + 0.5 };
    sprites.set(key, spr);
    if (sprites.size > 600) sprites.delete(sprites.keys().next().value);
    return spr;
  }
  // a sprite drawn with its base centre at (bx, by), turned by a about a pivot piv pixels along its base; alpha < 1 dithers it
  function drawSprite(b, spr, bx, by, o) {
    o = o || {};
    const a = o.a || 0, piv = o.piv || 0, alpha = o.alpha === undefined ? 1 : o.alpha, flash = o.flash || 0, lift = o.center ? spr.h / 2 : 0;
    const put = (x, y, col) => {
      if (alpha < 1 && dith(x, y) >= alpha) return;
      b.px(x, y, flash ? mixc(col, [255, 250, 230], flash) : o.tint ? sc(col, o.tint) : col, !!o.emit);
    };
    if (Math.abs(a) < 0.02 && !lift) {
      const x0 = Math.round(bx - spr.w / 2), y0 = Math.round(by) - spr.h;
      for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) { const c = spr.px[j * spr.w + i]; if (c) put(x0 + i, y0 + j, c); }
      return;
    }
    const c = Math.cos(a), s = Math.sin(a), Px = bx + piv, Py = by - lift, R = Math.hypot(spr.w, spr.h) + Math.abs(piv) + 2;
    for (let y = Math.floor(Py - R); y <= Py + R; y++) for (let x = Math.floor(Px - R); x <= Px + R; x++) {
      const rx = x + 0.5 - Px, ry = y + 0.5 - Py, lx = c * rx + s * ry, ly = -s * rx + c * ry;
      const u = lx + piv + spr.w / 2, v = spr.h - lift + ly;
      const i = Math.floor(u), j = Math.floor(v);
      if (i < 0 || j < 0 || i >= spr.w || j >= spr.h) continue;
      const col = spr.px[j * spr.w + i];
      if (col) put(x, y, col);
    }
  }

  // ---------- boards: one per set, a slab whose top is textured square by square ----------
  const SQ = 12, BZ = 2.4, F0 = 455, DIST = 420;
  const sqW = (s) => [((s % 8) - 3.5) * SQ, ((s >> 3) - 3.5) * SQ];
  const FRAME = { leather: 4, planks: 5, antler: 5, rosewood: 6 };
  const BOARDS = {
    leather: { frame: [92, 56, 34], side: [70, 42, 26] },
    planks: { frame: [118, 100, 80], side: [86, 72, 58] },
    antler: { frame: [112, 88, 66], side: [84, 64, 48] },
    rosewood: { frame: [112, 46, 34], side: [80, 32, 24] },
  };
  function boardTex(style) {
    const n = vnoise(hash(style) % 1000), g = vnoise(77 + style.length), B = 4 * SQ, BO = B + FRAME[style];
    return (u, v) => {
      const x = (u - 0.5) * 2 * BO, y = (v - 0.5) * 2 * BO, ax = Math.abs(x), ay = Math.abs(y), inSq = ax < B && ay < B;
      const f = Math.floor(x / SQ + 4), r = Math.floor(y / SQ + 4), dark = (f + r) % 2 === 0, fx = (x / SQ + 4) % 1, fy = (y / SQ + 4) % 1;
      if (style === "leather") {
        const grain = n(x * 0.5, y * 0.5) * 0.18 + g(x * 1.7, y * 1.7) * 0.08;
        if (!inSq) {
          let c = sc([92, 56, 34], 0.86 + grain);
          const e = Math.max(ax, ay);
          if (Math.abs(e - (B + 1.8)) < 0.45 && Math.floor((ax > ay ? y : x) * 0.7) % 2 === 0) c = [196, 160, 112];
          return c;
        }
        let c = dark ? sc([96, 58, 36], 0.86 + grain) : sc([222, 192, 144], 0.88 + grain);
        if (Math.abs(y) < 0.7) c = sc(c, 0.55);
        else if (Math.abs(y - 0.9) < 0.5) c = sc(c, 1.12);
        if (Math.abs(y) < 3.2 && n(x * 1.3, y * 3 + 40) > 0.74) c = sc(c, 0.72);
        return c;
      }
      if (style === "planks") {
        const plank = Math.floor((y + BO) / 6), streak = n(x * 0.12 + plank * 9.1, y * 1.6) * 0.3;
        if (!inSq) { let c = sc([118, 100, 80], 0.82 + streak); if (n(x * 0.6, y * 0.6) > 0.8) c = sc(c, 0.6); return c; }
        let c = dark ? sc([74, 60, 48], 0.86 + streak * 0.8) : sc([210, 200, 176], 0.86 + streak * 0.6);
        if ((y + BO) % 6 < 0.55) c = sc(c, 0.62);
        if (dark && n(x * 0.9 + 50, y * 0.9) > 0.72) c = sc(c, 1.25);
        return c;
      }
      if (style === "antler") {
        const pore = g(x * 2.3, y * 2.3);
        if (!inSq) {
          let c = sc([112, 88, 66], 0.88 + pore * 0.16);
          const e = Math.max(ax, ay), along = ax > ay ? y : x;
          if (e > B + 1 && e < BO - 1 && ((along + BO) % 6) < 1.1) c = [190, 168, 136];
          return c;
        }
        let c = dark ? sc([140, 106, 78], 0.84 + pore * 0.22) : sc([228, 216, 186], 0.9 + pore * 0.14);
        if (pore > 0.82) c = sc(c, dark ? 0.72 : 0.86);
        if (fx < 0.05 || fy < 0.05) c = [96, 76, 58];
        return c;
      }
      const wood = n(x * 0.08, y * 0.9) * 0.3;
      if (!inSq) {
        const e = Math.max(ax, ay);
        if (e < B + 1.1) return [210, 168, 74];
        let c = sc([112, 46, 34], 0.8 + wood);
        if (ax > B + 2 && ax > ay && Math.abs(y) < 5) c = Math.abs(y) < 0.6 ? [140, 100, 40] : [214, 174, 82];
        if (ax > BO - 3.2 && ay > BO - 3.2) c = [210, 168, 74];
        return c;
      }
      if (dark) return sc([78, 36, 30], 0.82 + wood);
      let c = sc([242, 234, 212], 0.92 + n(x * 0.3, y * 0.3) * 0.1);
      if (n(x * 0.15 + 30, y * 1.2) > 0.7) c = sc(c, 0.95);
      return c;
    };
  }
  // the board slab at rotation R about c: sides in the frame colour, the top textured (a flipped board shows its plain underside)
  function drawBoard(S, look, c, R) {
    const st = look.board, BO = 4 * SQ + FRAME[st], bd = BOARDS[st];
    S.box(c, [BO, BO, BZ / 2], R, bd.side, { edgeCol: sc(bd.side, 0.6) });
    const up = mv(R, [0, 0, 1]), top = [c[0] + up[0] * BZ / 2, c[1] + up[1] * BZ / 2, c[2] + up[2] * BZ / 2];
    if (!S.cam.facing(top, up)) return;
    const ex = mv(R, [2 * BO, 0, 0]), ey = mv(R, [0, 2 * BO, 0]), o0 = mv(R, [-BO, -BO, BZ / 2]);
    const tex = boardTex(st);
    S.quad([c[0] + o0[0], c[1] + o0[1], c[2] + o0[2]], ex, ey, (u, v) => S.shade(tex(u, v), 0.94 + 0.12 * clamp(1 - u - v * 0.5, 0, 1)));
  }

  // ---------- the settings: what the board sits on and what is round it ----------
  const BIOME = {
    plains: { a: [80, 96, 52], b: [100, 82, 56], s1: [124, 146, 72], s2: [206, 186, 96] },
    forest: { a: [52, 70, 40], b: [72, 54, 38], s1: [112, 72, 40], s2: [84, 116, 52] },
    hills: { a: [104, 98, 84], b: [86, 80, 66], s1: [150, 144, 130], s2: [70, 66, 58] },
    marsh: { a: [58, 66, 52], b: [44, 52, 46], s1: [72, 96, 104], s2: [100, 114, 60] },
    coast: { a: [196, 178, 136], b: [178, 160, 120], s1: [234, 226, 206], s2: [120, 110, 96] },
    snow: { a: [212, 222, 236], b: [190, 202, 220], s1: [244, 248, 252], s2: [150, 162, 178] },
    volcanic: { a: [56, 48, 48], b: [40, 36, 38], s1: [150, 60, 30], s2: [86, 80, 78] },
  };
  const TOWN_WOOD = { thornwall: [130, 84, 50], ironhaven: [96, 60, 42], carrbridge: [128, 92, 58], veldrock: [104, 84, 64], ashfen: [74, 60, 52],
    hollowood: [118, 96, 58], saltmarrow: [138, 118, 94], frosthold: [146, 128, 106] };
  const GZ = -26;
  function ground(S, biome) {
    const bm = BIOME[biome] || BIOME.plains, n = vnoise(201), g = vnoise(203);
    S.plane([[-500, 500, GZ], [500, 500, GZ], [500, -500, GZ], [-500, -500, GZ]], 2, GZ, (x, y) => {
      const v = g(x * 0.1, y * 0.1), m = n(x * 0.04, y * 0.04);
      let col = m > 0.52 ? bm.a : bm.b;
      if (n(x * 0.5 + 30, y * 0.5) > 0.8) col = bm.s1;
      if (n(x * 0.3 + 90, y * 0.3) > 0.85) col = bm.s2;
      return sc(col, 0.8 + v * 0.32);
    });
  }
  function firePit(S, F) {
    const n = vnoise(209), c = S.P(F[0], F[1], GZ), r = S.k(F[0], F[1], GZ);
    S.b.ell(c[0], c[1], 13 * r, 10 * r, (nx, ny, x, y) => S.b.px(x, y, sc([44, 38, 34], 0.8 + n(x, y) * 0.3)));
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2, q = S.P(F[0] + Math.cos(a) * 14, F[1] + Math.sin(a) * 11, GZ + 1);
      S.b.ell(q[0], q[1], 4 * r, 3 * r, (nx, ny, x, y) => S.b.px(x, y, S.shade([118, 112, 104], 0.7 + 0.5 * clamp(-nx * 0.3 - ny * 0.8, 0, 1))));
    }
    S.box([F[0], F[1], GZ + 2.5], [11, 2.4, 2.4], Rz(0.45), [86, 56, 34], { edgeCol: [34, 22, 14] });
    S.box([F[0], F[1] + 1, GZ + 5], [11, 2.4, 2.4], Rz(-0.6), [96, 64, 38], { edgeCol: [34, 22, 14] });
  }
  // small flat things lying on a table, drawn in screen space at a world spot (scaled with the camera)
  function decal(S, x, y, z, fn) { const c = S.P(x, y, z), k = S.k(x, y, z); fn(S.b, c[0], c[1], k); }
  const PROPS = {
    pie: (b, x, y, k) => {
      b.ell(x, y, 13 * k, 9 * k, (nx, ny, px, py) => b.px(px, py, nx * nx + ny * ny > 0.8 ? [210, 210, 214] : [236, 236, 238]));
      b.ell(x, y - k, 9 * k, 6 * k, (nx, ny, px, py) => { if (Math.atan2(ny, nx) > -0.4 && Math.atan2(ny, nx) < 0.9) return; b.px(px, py, nx * nx + ny * ny > 0.7 ? [178, 112, 52] : (px + py) % 3 === 0 ? [214, 152, 80] : [196, 132, 64]); });
    },
    book: (b, x, y, k) => { b.rect(x - 10 * k, y - 7 * k, 20 * k, 13 * k, [86, 38, 30]); b.rect(x - 9 * k, y - 6 * k, 18 * k, 11 * k, [116, 50, 38]); b.rect(x - 9 * k, y + 4 * k, 18 * k, 1.5 * k, [230, 220, 196]); b.rect(x - 2 * k, y - 6 * k, 1.5 * k, 11 * k, [206, 164, 70]); },
    tickets: (b, x, y, k) => { for (const [dx, dy, c] of [[-5, -2, [226, 204, 156]], [1, 1, [216, 192, 140]], [-1, 4, [232, 210, 162]]]) { b.rect(x + dx * k - 4 * k, y + dy * k - 2.5 * k, 8 * k, 5 * k, c); b.rect(x + dx * k - 3 * k, y + dy * k - 1 * k, 3 * k, 2 * k, [176, 52, 36]); } },
    shells: (b, x, y, k) => { for (const [dx, dy] of [[-6, -2], [4, 1], [-1, 5]]) b.ell(x + dx * k, y + dy * k, 3.4 * k, 2.6 * k, (nx, ny, px, py) => b.px(px, py, ny < -0.2 && Math.abs(nx) < 0.3 ? [246, 214, 206] : (px % 2 ? [240, 226, 214] : [226, 196, 184]))); },
    rope: (b, x, y, k) => { for (let r = 7; r > 1; r -= 1.6) b.ell(x, y, r * k, r * 0.8 * k, (nx, ny, px, py) => { if (nx * nx + ny * ny > 0.62) b.px(px, py, (px + py) % 2 ? [176, 146, 98] : [146, 116, 74]); }); },
    leaves: (b, x, y, k) => { for (const [dx, dy, c] of [[-5, -3, [176, 112, 44]], [3, 2, [120, 148, 60]], [6, -4, [196, 140, 52]]]) b.ell(x + dx * k, y + dy * k, 3.5 * k, 1.8 * k, (nx, ny, px, py) => b.px(px, py, Math.abs(ny) < 0.2 ? sc(c, 0.7) : c)); },
    mushrooms: (b, x, y, k) => { for (const [dx, dy, r] of [[-3, 0, 3.2], [3, 2, 2.4]]) b.ell(x + dx * k, y + dy * k, r * k, r * 0.75 * k, (nx, ny, px, py) => b.px(px, py, (nx + 0.3) * (nx + 0.3) + (ny + 0.3) * (ny + 0.3) < 0.08 ? [246, 236, 220] : [190, 60, 46])); },
    reed: (b, x, y, k) => { for (let i = 0; i < 16 * k; i++) b.px(x - 8 * k + i, y + i * 0.3, [150, 140, 90]); b.ell(x + 8 * k, y + 5 * k, 1.6 * k, 3 * k, (nx, ny, px, py) => b.px(px, py, [96, 64, 40])); },
    quill: (b, x, y, k) => { b.ell(x, y, 3 * k, 3 * k, (nx, ny, px, py) => b.px(px, py, nx * nx + ny * ny > 0.5 ? [30, 30, 40] : [12, 12, 20])); for (let i = 0; i < 14 * k; i++) { b.px(x + 2 * k + i * 0.7, y - 2 * k - i * 0.6, [236, 232, 220]); b.px(x + 2 * k + i * 0.7 + 1, y - 2 * k - i * 0.6, [200, 196, 186]); } },
    fur: (b, x, y, k) => { const n = vnoise(91); b.ell(x, y, 30 * k, 16 * k, (nx, ny, px, py) => { if (nx * nx + ny * ny > 0.86 + (n(px * 0.6, py * 0.6) - 0.5) * 0.4) return; b.px(px, py, sc([110, 84, 60], 0.8 + n(px * 0.8, py * 0.3) * 0.4)); }); },
    coins: (b, x, y, k) => { for (const [dx, dy] of [[0, 0], [5, 2], [2, -3]]) b.ell(x + dx * k, y + dy * k, 2.6 * k, 2.1 * k, (nx, ny, px, py) => b.px(px, py, nx * nx + ny * ny > 0.6 ? [150, 154, 164] : [210, 214, 222])); },
  };
  const TOWN_PROPS = { thornwall: ["pie"], ironhaven: ["book", "coins"], carrbridge: ["tickets", "coins"], veldrock: ["coins"], ashfen: ["reed"],
    hollowood: ["leaves", "mushrooms"], saltmarrow: ["shells", "rope"], frosthold: ["coins"] };

  const SETTINGS = {
    camp: {
      lamp: "fire", fire: [-84, 80], mug: "tin", bed: "fire",
      env(S, p) {
        ground(S, p.rec.biome || "plains");
        firePit(S, this.fire);
        const n = vnoise(301), hw = 84, hd = 66;
        S.drop(0, -4, GZ + 2, 80, 0.55, GZ);
        const plank = (2 * hd) / 7;
        S.plane([[-hw, -hd, 0], [hw, -hd, 0], [hw, -hd, GZ], [-hw, -hd, GZ]], 1, -hd, (x, y, z) => sc([132, 92, 56], 0.8 + n(x * 0.15, z * 0.5) * 0.3));
        S.plane([[-hw, -hd, 0], [hw, -hd, 0], [hw, hd, 0], [-hw, hd, 0]], 2, 0, (x, y) => {
          const pl = Math.floor((y + hd) / plank), py = (y + hd) % plank;
          let f = 0.78 + n(x * 0.05 + pl * 31.7, py * 0.45) * 0.4 + ((pl * 5) % 3) * 0.04;
          if (py < 1.1) f *= 0.42;
          if (Math.abs(Math.abs(x) - (hw - 3)) < 1 && Math.abs(py - plank / 2) < 1.2) f = 1.4;
          return sc([150, 108, 66], f);
        });
        const e = [S.P(-hw, hd, 0), S.P(hw, hd, 0)];
        S.b.line(e[0][0], e[0][1], e[1][0], e[1][1], [184, 140, 92]);
        S.cyl([-70, 70, GZ + 7], 7, 34, [120, 64, 50], { R: Ry(Math.PI / 2), n: 18, sideFn: (i, nn, c) => (i % 5 === 0 ? sc(c, 0.7) : c), capCol: [150, 84, 64] });
      },
    },
    stump: {
      lamp: "fire", fire: [-86, 78], mug: "tin", bed: "fire",
      env(S, p) {
        ground(S, p.rec.biome || "forest");
        firePit(S, this.fire);
        const n = vnoise(401), R0 = 94;
        S.drop(-6, -2, GZ + 10, R0 * 1.02, 0.5, GZ);
        S.cyl([0, 0, GZ], R0, -GZ, [100, 72, 46], { n: 72, sideFn: (i, nn, c) => sc(c, (i % 4 === 0 ? 0.62 : i % 4 === 2 ? 1.08 : 0.88) * (0.9 + n(i, 3) * 0.2)), capFn: () => (sx, sy) => {
          const w = S.cam.unproject(sx + 0.5, sy + 0.5, 2, 0), x = w[0], y = w[1], rad = Math.hypot(x, y);
          if (rad > R0 - 3) return sc([150, 108, 66], 0.82 + n(x * 0.3, y * 0.3) * 0.2);
          const d = Math.hypot(x - 6, y + 4) + (n(x * 0.12, y * 0.12) - 0.5) * 5, ring = d % 5.2 < 1.0;
          let wood = sc([206, 164, 108], (ring ? 0.82 : 1) * (0.9 + n(x * 0.8, y * 0.8) * 0.14));
          if (Math.abs(Math.atan2(y + 4, x - 6) + 2.1) < 0.02 && d > 14) wood = [120, 82, 50];
          if (Math.abs(Math.atan2(y + 4, x - 6) - 0.7) < 0.015 && d > 30) wood = [128, 88, 54];
          return wood;
        } });
        for (const a of [-2.5, -1.3, 0.2, 2.6]) S.box([Math.cos(a) * R0 * 1.06, Math.sin(a) * R0 * 1.06, GZ + 4], [7, 4, 4], Rz(a), [96, 68, 44], { edgeCol: [44, 30, 18] });
      },
    },
    tavern: {
      lamp: "candle", candle: [-78, 54], mug: "pewter", bed: "tavern",
      env(S, p) {
        const town = p.rec.town, wood = TOWN_WOOD[town] || [104, 64, 38], n = vnoise(311);
        S.plane([[-400, -200, 0], [400, -200, 0], [400, 200, 0], [-400, 200, 0]], 2, 0, (x, y) => {
          const pl = Math.floor((y + 200) / 16), py = (y + 200) % 16;
          let f = 0.74 + n(x * 0.04 + pl * 41.3, py * 0.3) * 0.42 + ((pl * 7) % 3) * 0.04;
          if (py < 1) f *= 0.45;
          if (Math.hypot((x - ((pl * 67) % 160) + 80) * 0.4, py - 8) < 1.6) f *= 0.62;
          if (Math.abs(Math.hypot(x + 70, y + 30) - 8.5) < 0.7) f *= 0.8;
          if (town === "hollowood" && n(x * 0.2 + 70, y * 0.2) > 0.78) return sc([86, 112, 54], f);
          if (town === "frosthold" && n(x * 0.3, y * 0.3 + 40) > 0.8) return mixc(sc(wood, f), [220, 230, 240], 0.5);
          return sc(wood, f);
        });
        this.props(S, p);
        S.cyl([this.candle[0], this.candle[1], 0], 6, 1.2, [176, 136, 60], { capCol: [200, 160, 76], rim: [110, 80, 30] });
        S.cyl([this.candle[0], this.candle[1], 1.2], 2.4, 8, town === "ashfen" ? [44, 40, 46] : [236, 226, 196], { capCol: town === "ashfen" ? [60, 56, 62] : [246, 238, 210] });
      },
      props(S, p) {
        const list = TOWN_PROPS[p.rec.town] || ["coins"];
        const spots = [[74, 56], [-76, -2]];
        list.slice(0, 2).forEach((k, i) => decal(S, spots[i][0], spots[i][1], 0.2, PROPS[k]));
        if (p.rec.town === "frosthold") decal(S, -66, -50, 0.2, PROPS.fur);
      },
    },
    hall: {
      lamp: "hall", lampAt: [76, 56], mug: "goblet", bed: "hall",
      env(S, p) {
        const n = vnoise(511), B = 4 * SQ + FRAME[p.look.board];
        S.plane([[-400, -200, 0], [400, -200, 0], [400, 200, 0], [-400, 200, 0]], 2, 0, (x, y) => {
          const ax = Math.abs(x), ay = Math.abs(y), e = Math.max(ax, ay);
          if (e > B + 4 && e < B + 7.5) {
            if (e < B + 4.8 || e > B + 6.7) return [206, 164, 72];
            return (Math.floor((ax > ay ? y : x) / 3) % 2 === 0) ? [238, 230, 210] : [214, 204, 182];
          }
          if (ax > B + 4 && ay > B + 4 && Math.hypot(ax - B - 5.7, ay - B - 5.7) < 3.4) return [238, 230, 210];
          const streak = n(x * 0.02, y * 0.6) * 0.3, shine = Math.abs(((x - y * 0.4) % 60 + 60) % 60 - 30) < 2.5 ? 1.18 : 1;
          return sc([84, 50, 34], (0.78 + streak) * shine);
        });
        decal(S, -76, 54, 0.2, PROPS.book);
        decal(S, -78, -6, 0.2, PROPS.quill);
        const L = this.lampAt;
        S.cyl([L[0], L[1], 0], 5, 1.5, [176, 136, 60], { capCol: [212, 172, 80] });
        S.cyl([L[0], L[1], 1.5], 1.2, 16, [190, 150, 64]);
        S.cyl([L[0], L[1], 14], 7, 5, [46, 104, 70], { capCol: [62, 132, 90], rim: [24, 60, 40] });
      },
    },
    lodge: {
      lamp: "lodge", candle: [-80, 56], mug: "horn", bed: "lodge",
      env(S, p) {
        const n = vnoise(611), g = vnoise(613);
        S.plane([[-400, -200, 0], [400, -200, 0], [400, 200, 0], [-400, 200, 0]], 2, 0, (x, y) => {
          const pl = Math.floor((x + 400) / 18), px0 = (x + 400) % 18;
          let f = 0.76 + n(px0 * 0.3 + pl * 13, y * 0.05) * 0.36;
          if (px0 < 1.1) f *= 0.5;
          let c = sc([150, 132, 112], f);
          const fr = g(x * 0.5, y * 0.5) * 0.5 + Math.max(0, Math.abs(y) - 58) * 0.03 + Math.max(0, Math.abs(x) - 100) * 0.03;
          if (fr > 0.62) c = mixc(c, [226, 236, 246], clamp((fr - 0.62) * 2.5, 0, 0.75));
          return c;
        });
        decal(S, -70, -52, 0.2, PROPS.fur);
        S.cyl([this.candle[0], this.candle[1], 0], 5, 1.2, [120, 120, 130], { capCol: [150, 150, 160] });
        S.cyl([this.candle[0], this.candle[1], 1.2], 2.2, 7, [232, 228, 214], { capCol: [244, 240, 228] });
      },
    },
  };
  const MUG = { tin: { col: [126, 130, 136], drink: [150, 104, 50], r: 3.8, h: 8 }, pewter: { col: [168, 172, 180], drink: [236, 226, 196], r: 5.4, h: 11, spill: [196, 140, 50] },
    goblet: { col: [196, 198, 206], drink: [120, 24, 36], r: 4.2, h: 7, stem: true }, horn: { col: [214, 196, 160], drink: [210, 160, 60], r: 4.4, h: 10 } };
  const MUG_AT = [76, -26];

  function lampsFor(p, cam, wall) {
    const set = SETTINGS[p.setting], P = (x, y, z) => cam.p(x, y, z), k = cam.scale(0, 0, 0) / (F0 / DIST);
    if (set.lamp === "fire") {
      const fl = 1 + Math.sin(wall * 11) * 0.05 + Math.sin(wall * 4.7) * 0.05 + Math.sin(wall * 27) * 0.025, c = P(set.fire[0], set.fire[1], GZ + 12);
      return { amb: [0.22, 0.24, 0.32], lamps: [{ x: c[0], y: c[1], r: 250 * fl * k, i: 1.2, c: [1.12, 0.8, 0.5], p: 1.1, sy: 1.0 }], glows: [[c[0], c[1] + 4, 22 * fl * k, [255, 140, 50], 0.35]] };
    }
    if (set.lamp === "candle") {
      const fl = 1 + Math.sin(wall * 13) * 0.02 + Math.sin(wall * 5.3) * 0.03, c = P(set.candle[0], set.candle[1], 12);
      const lantern = p.rec.town === "veldrock";
      return { amb: [0.32, 0.29, 0.28], lamps: [{ x: c[0], y: c[1], r: 260 * fl * k, i: 1.15, c: lantern ? [1.16, 0.82, 0.46] : [1.06, 0.92, 0.74], p: 1.05 }], glows: [[c[0], c[1] - 3, 7 * fl * k, lantern ? [255, 160, 60] : [255, 190, 100], 0.4]] };
    }
    if (set.lamp === "hall") {
      const c = P(set.lampAt[0], set.lampAt[1], 12);
      return { amb: [0.34, 0.32, 0.3], lamps: [{ x: c[0], y: c[1] + 6, r: 230 * k, i: 1.0, c: [1.05, 0.9, 0.62], p: 1.1 }, { kind: "win", x: 40, y: 64, w: 70, h: 56, skew: 0.5, i: 0.28, c: [0.5, 0.6, 0.74] }], glows: [[c[0], c[1] + 4, 10 * k, [255, 220, 140], 0.3]] };
    }
    const fl = 1 + Math.sin(wall * 13) * 0.03, c = P(set.candle[0], set.candle[1], 10);
    return { amb: [0.38, 0.42, 0.52], lamps: [{ x: c[0], y: c[1], r: 220 * fl * k, i: 0.95, c: [1.0, 0.82, 0.6], p: 1.2 }, { kind: "win", x: 150, y: 50, w: 90, h: 70, skew: -0.4, i: 0.22, c: [0.5, 0.6, 0.78] }], glows: [[c[0], c[1] - 3, 6 * fl * k, [255, 200, 130], 0.35]] };
  }

  // ---------- the stake token, as night_replay.js draws it ----------
  const ICONS = {
    first_watch: { rows: [".ooooooooo.", "oWWWWWWWWWo", "owwwwwwwwwo", ".ooooooooo.", ".w.ogggo.w.", ".wogggggow.", ".wosssssow.", ".w.ossso.w.", ".w..oso..w.",
      ".w...s...w.", ".w..ogo..w.", ".w.ogsgo.w.", ".wogggggow.", ".wogsssgow.", ".wosssssow.", ".w.ooooo.w.", ".ooooooooo.", "oWWWWWWWWWo", "owwwwwwwwwo", ".ooooooooo."],
      pal: { o: [58, 36, 20], W: [214, 160, 92], w: [156, 104, 56], g: [150, 196, 214], s: [240, 200, 106] } },
    cooks_tomorrow: { rows: ["....oooooo........", "..ooIIIIIIoo......", ".oIiieeeeiiIo.....", ".oieeeYYeeeio.....", "oIieeYYYYeeiIohhhh", "oIieeeYYeeeiIohhhh",
      ".oiieeeeeeiio.....", ".oIiiiiiiiiIo.....", "..ooIIIIIIoo......", "....oooooo........"],
      pal: { o: [30, 30, 34], I: [120, 120, 130], i: [70, 70, 78], e: [248, 244, 232], Y: [252, 186, 36], h: [140, 90, 48] } },
    carries_pack: { rows: ["...rrrrrrr...", "..rRRRRRRRr..", "..rrrrrrrrr..", ".bbbbbbbbbbb.", ".bBBBBBBBBBb.", ".bBffffffBBb.", ".bffffffffBb.", ".bfffkkfffBb.",
      ".bBBBkkBBBBb.", "sbBBBBBBBBBbs", "sbBBBBBBBBBbs", "sbBppppppBBbs", ".bBppppppBBb.", ".bbbbbbbbbbb."],
      pal: { b: [96, 60, 32], B: [162, 108, 60], f: [128, 82, 44], k: [236, 196, 84], r: [150, 70, 54], R: [198, 108, 84], s: [74, 48, 28], p: [140, 92, 52] } },
    names_pet: { rows: ["......o......", ".....o.o.....", "....ttttt....", "..ttTTTTTtt..", ".tTTpTTTpTTt.", ".tTTpTTTpTTt.", "tTpTTTTTTTpTt", "tTppTpppTppTt",
      "tTTTpppppTTTt", "tTTpppppppTTt", ".tTpppppppTt.", ".tTTpppppTTt.", "..ttTTTTTtt..", "....ttttt...."],
      pal: { o: [150, 150, 156], t: [168, 120, 40], T: [234, 186, 80], p: [84, 52, 26] } },
    washes_pots: { rows: ["...U.....u.....", "..U.U...u.u....", "...U.....u..U..", "...........U.U.", "..FFF.FFFF..U..", ".FFFFFFFFFFFF..", "oIIIIIIIIIIIIIo",
      "ooiiiiiiiiiiioo", ".oiWiiiiiiiiio.", ".oiWiiiiiiiiio.", ".oiiiiiiiiiiio.", "..oiiiiiiiiio..", "...ooooooooo..."],
      pal: { o: [70, 36, 20], I: [232, 150, 88], i: [184, 100, 54], W: [246, 196, 140], F: [244, 248, 250], u: [170, 210, 234], U: [226, 242, 250] } },
    keepsake: { rows: ["o.........o", ".o.......o.", "..o.....o..", "...o...o...", "....ooo....", "...ggggg...", "..gGGGGGg..", ".gGGWrGGGg.", ".gGGrrrGGg.", ".gGGrrrGGg.", ".gGGGrGGGg.", "..gGGGGGg..", "...ggggg..."],
      pal: { o: [196, 176, 124], g: [150, 104, 30], G: [238, 190, 74], W: [255, 244, 200], r: [190, 40, 52] } },
    silver: { rows: ["..oooooo..", ".oWWSSSSo.", "oSSSssSSSo", "oSSsSSsSSo", ".oSSSSSSo.", "oeeeeeeeeo", "oEEEEEEEEo", "oeeeeeeeeo", "oEEEEEEEEo", "oeeeeeeeeo", ".oooooooo."],
      pal: { o: [60, 62, 70], S: [206, 210, 218], s: [150, 154, 164], W: [252, 252, 255], e: [150, 154, 164], E: [196, 200, 208] } },
  };
  function setIcon(look) {
    const pl = look.pal;
    return { rows: ["oooooooooooo", "oLDLDLDLDLDo", "oDLDLDLDLDLo", "oLDLDkLDLDLo", "oDLDLkkDLDLo", "oLDLkkkkDLDo", "oDLDLkkDLDLo", "oLDLkkkkDLDo", "oDLkkkkkkDLo", "oLDLDLDLDLDo", "oooooooooooo"],
      pal: { o: [40, 26, 16], L: [220, 196, 150], D: [120, 82, 52], k: pl[1].mid } };
  }
  function drawIcon(b, ic, x, y) {
    const rows = ic.rows, h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const at = (i, j) => (j >= 0 && j < h && i >= 0 && i < rows[j].length && rows[j][i] !== "." && ic.pal[rows[j][i]]) ? ic.pal[rows[j][i]] : null;
    x = Math.round(x - w / 2); y = Math.round(y - h);
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) { if (at(i, j)) continue; if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) b.px(x + i, y + j, [24, 16, 10], true); }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = at(i, j); if (c) b.px(x + i, y + j, c, true); }
    return { x, y, w, h };
  }
  const STAKE_WORDS = { first_watch: "FIRST WATCH", cooks_tomorrow: "COOKS TOMORROW", carries_pack: "CARRIES THE PACK", names_pet: "NAMES THE NEXT PET",
    washes_pots: "WASHES THE POTS", set: "HANDS OVER THE SET", keepsake: "GIVES THE KEEPSAKE", silver: "PAYS" };
  function stakeToken(b, rec, look, t, lo) {
    const kind = rec.stake;
    if (!kind || t < 0 || lo === null) return;
    const ic = kind === "set" ? setIcon(look) : ICONS[kind];
    if (!ic) return;
    const x = W - 12, y = H - 4;
    const u = clamp(t / 0.32, 0, 1), drop = u < 1 ? -26 * (1 - u * u) : -Math.abs(Math.sin(Math.min(1, (t - 0.32) / 0.3) * Math.PI)) * 4 * (1 - Math.min(1, (t - 0.32) / 0.3));
    const box = drawIcon(b, ic, x, y + drop);
    if (t > 0.45) {
      const lines = [nameOf(rec.players[lo]), kind === "silver" ? `PAYS ${money(rec.stake_cp || 10)}` : STAKE_WORDS[kind]], tw = Math.max(textWidth(lines[0]), textWidth(lines[1])) + 6;
      const tx = Math.round(box.x - tw - 4), ty = Math.round(y - 16), slide = Math.round((1 - ease3(clamp((t - 0.45) / 0.25, 0, 1))) * 6);
      b.rect(tx + 1, ty + 1 + slide, tw, 16, [16, 10, 6], true);
      b.rect(tx, ty + slide, tw, 16, [232, 214, 170], true);
      for (let i = 0; i < tw; i += 3) b.px(tx + i, ty + 15 + slide, [206, 186, 142], true);
      text(b, lines[0], tx + 3, ty + 2 + slide, [70, 46, 28]);
      text(b, lines[1], tx + 3, ty + 9 + slide, [150, 44, 30]);
    }
  }
  const nameOf = (pl, n) => (pl && pl.yeti ? "FOOTPRINT" : plain((pl && (pl.name || pl.id)) || "SOMEONE").toUpperCase().replace(/[^A-Z0-9 '!.,-]/g, "").split(" ")[0].slice(0, n || 8) || "SOMEONE");

  // ---------- the plan: the game parsed, then laid out as timed steps ----------
  // a replay runs about 6-9 seconds before it holds (key moments); the full game is a little longer, never shorter (QA3 P3-11)
  const PLAY = 0.6, HOLD = 0.35, JUMP = 0.42;
  function normRec(rec0) {
    const rec = Object.assign({}, rec0);
    rec.players = (rec.players || []).slice(0, 2);
    while (rec.players.length < 2) rec.players.push({ id: "p" + rec.players.length, name: rec.players.length ? "Rival" : "Hero" });
    rec.setting = SETTINGS[rec.setting] ? rec.setting : rec.yeti ? "lodge" : "camp";
    // a Yeti game still being played by letter has no result yet; it must not end in a draw's bow
    if (rec.yeti && !rec.result) { rec.result = "ongoing"; rec.winner = null; return rec; }
    rec.result = ["mate", "resign", "draw"].includes(rec.result) ? rec.result : rec.winner === 0 || rec.winner === 1 ? "resign" : "draw";
    rec.winner = rec.result === "draw" ? null : rec.winner === 0 || rec.winner === 1 ? rec.winner : null;
    if (rec.winner === null && rec.result !== "draw") rec.result = "draw";
    return rec;
  }
  function makePlan(rec0, mode) {
    const rec = normRec(rec0), look = lookOf(rec), N0 = (rec.moves || []).length;
    const G = parseGame(rec.moves, rec.san, rec.result === "mate");
    const N = G.plies.length;
    if (N < N0 && rec.result === "mate" && N) { G.plies[N - 1].mate = false; G.plies[N - 1].san = sanOf(G.plies[N - 1]); }
    const p = { rec, look, G, N, mode, setting: rec.setting, steps: [], ev: [], trails: [], bursts: [], checks: [], caps: new Map(), promos: [], stamps: [], shakes: [], flashes: [], seed: hash(String(rec.id || "chess")) };
    p.loser = rec.winner === null ? null : 1 - rec.winner;
    p.flip = !!rec.flip && p.loser !== null && !!(rec.players[p.loser] || {}).hot;
    p.yeti = rec.yeti && N ? { day: Math.max(1, rec.yeti.day | 0), ply: clamp(rec.yeti.ply | 0, 0, N - 1) } : null;
    p.mate = rec.result === "mate" && N > 0 && G.plies[N - 1].mate;
    const mat = look.mat, ev = (t, name, v, x) => p.ev.push([t, name, v === undefined ? 1 : v, x]);
    p.slot = new Map();
    const count = [0, 0];
    G.plies.forEach((ply) => { if (ply.cap) p.slot.set(ply.cap.id, count[ply.cap.c]++); });
    let t = 0;
    const capture = (ply, tc, fd, v) => {
      if (!ply.cap || p.caps.has(ply.cap.id)) return;
      p.caps.set(ply.cap.id, { t: tc, dur: fd, sq: ply.cap.sq, c: ply.cap.c, type: ply.cap.t, slot: p.slot.get(ply.cap.id) });
      ev(tc + 0.02, "take", v, mat);
      ev(tc + fd, "land", v * 0.55, mat);
    };
    const play = (i, dur, o) => {
      o = o || {};
      const ply = G.plies[i], t0 = t, tI = t0 + dur * (ply.castle ? 0.5 : 0.78), st = { kind: "play", i, a: i, b: i + 1, t0, t1: t0 + dur, tI };
      if (ply.castle) { st.tR0 = tI + 0.05; st.tR1 = t0 + dur * 0.95; ev(st.tR0, "lift", 0.4); ev(st.tR1, "clack", 0.75, mat); }
      ev(t0, "lift", 0.5);
      ev(tI, "clack", o.loud ? 1.15 : 0.95, mat);
      capture(ply, tI, 0.6, 1);
      p.trails.push({ t: tI, t0, from: ply.from, to: ply.to, knight: ply.t === "N", col: o.frost ? [170, 220, 255] : ply.mate ? [255, 226, 130] : [255, 206, 110] });
      if (ply.cap || ply.check) p.bursts.push({ t: tI, sq: ply.to, big: (ply.cap && VAL[ply.cap.t] >= 5) || ply.check, frost: o.frost });
      if (ply.check) { p.checks.push({ t: tI, sq: ply.kingSq, mate: ply.mate }); if (!ply.mate) ev(tI + 0.04, "check", 0.75); }
      if (ply.promo) { p.promos.push({ t: tI, sq: ply.to, type: ply.promo }); ev(tI + 0.05, "promote"); }
      p.steps.push(st);
      t += dur;
      return st;
    };
    const ff = (i, dur) => {
      const ply = G.plies[i], st = { kind: "ff", i, a: i, b: i + 1, t0: t, t1: t + dur, tI: t + dur };
      ev(st.tI, "tick", 0.5, mat);
      capture(ply, st.tI, 0.32, 0.5);
      if (ply.check) p.checks.push({ t: st.tI, sq: ply.kingSq, small: true });
      if (ply.promo) p.promos.push({ t: st.tI, sq: ply.to, type: ply.promo });
      p.steps.push(st);
      t += dur;
    };
    const jump = (a, b) => {
      if (b <= a) return;
      const st = { kind: "jump", a, b, t0: t, t1: t + JUMP, tI: t + JUMP };
      ev(t, "slide", 0.8);
      let k = 0;
      for (let i = a; i < b; i++) if (G.plies[i].cap) capture(G.plies[i], t + 0.06 + 0.05 * k++, 0.42, 0.45);
      ev(t + JUMP * 0.85, "settle", 0.7, mat);
      p.steps.push(st);
      t += JUMP;
    };
    p.k0 = 0;
    const zoomIn = (lastPly) => {
      const ply = G.plies[lastPly], ks = sqW(ply.kingSq), ms = sqW(ply.to);
      p.zoom = { t0: t, t1: t + 0.8, target: [lerp(ks[0], ms[0], 0.3), lerp(ks[1], ms[1], 0.3) + 4, BZ], k: 2.0, king: [ks[0], ks[1] + 6] };
      ev(t, "zoom", 0.8);
      t += 0.95;
    };
    if (p.yeti) {
      const yi = p.yeti.ply;
      p.k0 = yi;
      for (let i = 0; i < yi; i++) if (G.plies[i].cap) p.caps.set(G.plies[i].cap.id, { t: -10, dur: 0.1, sq: G.plies[i].cap.sq, c: G.plies[i].cap.c, type: G.plies[i].cap.t, slot: p.slot.get(G.plies[i].cap.id) });
      p.foot = { t0: 0.7, tS: 1.12, tUp: 1.65, tGone: 2.05 };
      p.card = { t0: 2.15, t1: 3.85 };
      ev(0.7, "whoosh", 0.7); ev(p.foot.tS, "slam", 1); ev(p.foot.tS + 0.03, "puff", 1); ev(p.foot.tUp, "whoosh", 0.4); ev(p.card.t0, "paper", 1); ev(p.card.t1 - 0.2, "paper", 0.6);
      p.shakes.push({ t: p.foot.tS, dur: 0.28, amp: 3 });
      t = 4.05;
      const last = yi === N - 1;
      if (last && p.mate) zoomIn(yi);
      const st = play(yi, last ? 1.05 : 0.85, { frost: true, loud: last });
      p.tLast = st.tI;
      if (!last) {
        p.tNext = st.tI + 0.55;
        ev(p.tNext, "chime", 1);
        p.tEnd = p.tNext;
        p.dur = p.tNext + 1.6;
        ev(0, "lodge", p.dur + 3);
        p.ev.sort((a, b) => a[0] - b[0]);
        return p;
      }
    } else if (mode === "full") {
      t = 0.55;
      const slowN = Math.min(N, 4), fastN = N - slowN, d = fastN ? clamp(6 / fastN, 0.05, 0.14) : 0;
      p.speed = d ? Math.max(2, Math.round(PLAY / d)) : 1;
      p.fast = [t, t + fastN * d];
      for (let i = 0; i < fastN; i++) ff(i, d);
      if (fastN) { t += 0.35; ev(t - 0.3, "slow", 0.7); }
      for (let i = fastN; i < N; i++) {
        if (i === N - 1 && p.mate) zoomIn(i);
        const st = play(i, i === N - 1 ? 1.0 : PLAY, { loud: i === N - 1 });
        if (i === N - 1) p.tLast = st.tI;
        else t += 0.28;
      }
      if (!N) p.tLast = t;
    } else {
      t = 0.5;
      const keys = (Array.isArray(rec.key) && rec.key.length ? rec.key : autoKeys(G)).map((v) => v | 0).filter((v, i, a) => v >= 0 && v < N && a.indexOf(v) === i).sort((a, b) => a - b).slice(-4);
      if (!keys.length && N) keys.push(N - 1);
      p.keys = keys;
      p.keyT = [];
      let at = 0;
      keys.forEach((ki, n) => {
        if (ki > at) { jump(at, ki); t += 0.12; }
        const last = ki === N - 1;
        if (last && p.mate) zoomIn(ki);
        p.keyT.push(t);
        const st = play(ki, last ? 1.0 : PLAY + 0.1, { loud: last });
        at = ki + 1;
        if (last) p.tLast = st.tI;
        else if (n < keys.length - 1) t += HOLD;
      });
      if (at < N) { t += HOLD; jump(at, N); p.tLast = t; }
      if (!N) p.tLast = t;
    }
    ending(p, ev, mat);
    const bed = SETTINGS[p.setting].bed;
    ev(0, bed, p.dur + 3);
    p.ev.sort((a, b) => a[0] - b[0]);
    return p;
  }
  // the endings: the mated king's big tip-over, a resignation's gentle one, a draw's bow, or the board going over
  function ending(p, ev, mat) {
    const G = p.G, N = p.N, rec = p.rec, tI = p.tLast, last = G.plies[N - 1];
    const end = p.end = { kind: rec.result };
    if (rec.result === "ongoing") {
      p.tEnd = p.tResult = tI + 0.6;
      p.dur = p.tEnd + 1.2;
      return;
    }
    const kingOf = (c) => { const st = p.G.states[N]; for (const [id, q] of st) if (q.t === "K" && q.c === c) return { id, sq: q.sq }; return null; };
    if (p.flip) {
      const k = kingOf(p.loser);
      end.flip = true;
      end.king = k;
      const tR = tI + (p.mate ? 0.55 : 0.5);
      end.tremble = [tR, tR + 0.55];
      if (p.zoom) { p.zoom.out0 = tR + 0.3; p.zoom.out1 = tR + 0.62; ev(p.zoom.out0, "whoosh", 0.6); }
      end.tF = tR + 0.68;
      end.tMug = end.tF + 0.24;
      ev(tR, "rattle", 1, mat);
      ev(end.tF, "flip", 1);
      ev(end.tMug, "spill", 1);
      p.stamps.push({ t: end.tF + 0.22, word: "FLIP!", col: [255, 170, 60], k: 3, burst: true });
      ev(end.tF + 0.22, "stamp", 1);
      p.shakes.push({ t: end.tF, dur: 0.35, amp: 3 });
      end.fly = flyPlan(p, end.tF);
      const lands = end.fly.filter((f) => f.land < 99).sort((a, b) => a.land - b.land).slice(0, 9);
      lands.forEach((f) => ev(f.land, "clatter", 0.6, mat));
      p.tEnd = end.tF + 0.22;
      p.tResult = end.tF + 1.0;
      ev(p.tResult, "win", 1);
      p.dur = p.tResult + 1.6;
      return;
    }
    if (rec.result === "mate" && last) {
      const k = { id: [...G.states[N]].find(([, q]) => q.t === "K" && q.c !== last.c)[0], sq: last.kingSq };
      const ks = sqW(k.sq), ms = sqW(last.to);
      end.king = k;
      end.dir = ks[0] === ms[0] ? (ks[0] > 0 ? -1 : 1) : Math.sign(ks[0] - ms[0]);
      end.tremble = [tI + 0.35, tI + 0.85];
      end.tip = [tI + 0.85, tI + 1.35];
      if (p.zoom) p.zoom.push = [tI + 0.3, tI + 0.85];
      p.flashes.push({ t: tI, dur: 0.22 });
      p.shakes.push({ t: tI, dur: 0.12, amp: 1 }, { t: end.tip[1], dur: 0.34, amp: 3 });
      ev(tI + 0.02, "check", 1.2);
      ev(end.tremble[0], "rattle", 0.7, mat);
      ev(end.tip[0], "creak", 0.8);
      ev(end.tip[1], "thud", 1.2, mat);
      p.tEnd = end.tip[1] + 0.32;
      p.stamps.push({ t: p.tEnd, word: "CHECKMATE!", col: [255, 214, 100], k: 2 });
      ev(p.tEnd, "mate", 1);
      p.tResult = p.tEnd + 0.3;
      p.dur = p.tEnd + 1.4;
      return;
    }
    if (rec.result === "resign") {
      const k = kingOf(p.loser);
      end.king = k;
      end.dir = k && sqW(k.sq)[0] > 0 ? -1 : 1;
      end.tip = [tI + 0.5, tI + 1.1];
      end.gentle = true;
      ev(end.tip[0], "creak", 0.5);
      ev(end.tip[1], "thud", 0.5, mat);
      p.shakes.push({ t: end.tip[1], dur: 0.12, amp: 1 });
      p.tEnd = end.tip[1] + 0.2;
      p.stamps.push({ t: p.tEnd, word: `${nameOf(rec.players[p.loser])} RESIGNS`, col: [236, 226, 200], k: 1, small: true });
      p.tResult = p.tEnd + 0.35;
      ev(p.tResult, "win", 1);
      p.dur = p.tResult + 1.3;
      return;
    }
    end.kings = [kingOf(0), kingOf(1)].filter(Boolean);
    end.bow = [tI + 0.4, tI + 1.1];
    p.tEnd = tI + 1.15;
    const why = { stalemate: "STALEMATE!", repetition: "A DRAW!", fifty: "A DRAW!", "bare kings": "A DRAW!", "move cap": "A DRAW!" }[rec.why] || "A DRAW!";
    p.stamps.push({ t: p.tEnd, word: why, col: [236, 226, 200], k: 2 });
    ev(p.tEnd, "draw", 1);
    p.tResult = p.tEnd + 0.3;
    p.dur = p.tEnd + 1.4;
  }
  // a flipped board throws every piece: each gets a launch, a spin and (if it comes down in view) a landing
  function flyPlan(p, tF) {
    const r = rng(p.seed ^ 0x51f), out = [], st = p.G.states[p.N], g = 300;
    for (const [id, q] of st) {
      const [x, y] = sqW(q.sq), delay = 0.04 + (1 - (x + 48) / 96) * 0.1;
      const vx = 20 + r() * 110 - (r() < 0.25 ? 90 : 0), vy = (r() - 0.5) * 80, vz = 80 + r() * 100, w = (r() - 0.5) * 26;
      const z0 = BZ + 4, tl = tF + delay, dtl = (vz + Math.sqrt(vz * vz + 2 * g * z0)) / g;
      const lx = x + vx * dtl, ly = y + vy * dtl, inView = Math.abs(lx) < 92 && ly > -62 && ly < 80;
      out.push({ id, t: q.t, c: q.c, x, y, vx, vy, vz, w, z0, tl, land: inView ? tl + dtl : 99, lx, ly, rest: w > 0 ? Math.PI / 2 : -Math.PI / 2, g });
    }
    return out;
  }

  // ---------- where each piece is at time t ----------
  const BO_OF = (look) => 4 * SQ + FRAME[look.board];
  function pileXY(p, c, slot) {
    const BO = BO_OF(p.look);
    if (p.yeti) return [(c === 0 ? -50 : 4) + (slot % 8) * 6, BO + 8 + Math.floor(slot / 8) * 7];
    const side = c === 1 ? 1 : -1;
    return [side * (BO + 10 + (slot % 3) * 8), 38 - Math.floor(slot / 3) * 10];
  }
  function stepAt(p, t) {
    let s = null;
    for (const st of p.steps) { if (st.t0 <= t) s = st; else break; }
    return s;
  }
  function poses(p, t) {
    const G = p.G, st = stepAt(p, t), inStep = st && t < st.t1;
    const k = st ? (inStep ? st.a : st.b) : p.k0, A = G.states[k], B = inStep ? G.states[st.b] : null;
    const out = [];
    const ids = new Set([...A.keys()]);
    for (const id of p.caps.keys()) ids.add(id);
    for (const id of ids) {
      const cap = p.caps.get(id);
      if (cap && t >= cap.t) {
        const pile = pileXY(p, cap.c, cap.slot), from = sqW(cap.sq), u = (t - cap.t) / cap.dur;
        if (u >= 1) { out.push({ id, x: pile[0], y: pile[1], z: 0, t: cap.type, c: cap.c, a: 0, pile: true }); continue; }
        const e = ease(u);
        out.push({ id, x: lerp(from[0], pile[0], e), y: lerp(from[1], pile[1], e), z: lerp(BZ, 0, u) + Math.sin(u * Math.PI) * 26, t: cap.type, c: cap.c, a: u * Math.PI * 2 * (cap.c ? 1 : -1), fly: true });
        continue;
      }
      const qa = A.get(id);
      if (!qa) continue;
      const [ax, ay] = sqW(qa.sq);
      const base = { id, x: ax, y: ay, z: BZ, t: qa.t, c: qa.c, a: 0 };
      if (!inStep) { out.push(base); continue; }
      const qb = B.get(id);
      if (!qb || qb.sq === qa.sq) { if (qb && t >= st.tI) base.t = qb.t; out.push(base); continue; }
      const [bx, by] = sqW(qb.sq);
      let x, y, z = BZ, ghost = false;
      if (st.kind === "play") {
        const ply = G.plies[st.i], rook = ply.castle && ply.castle.id === id;
        const t0 = rook ? st.tR0 : st.t0, t1 = rook ? st.tR1 : st.tI, lift = rook ? 0.06 : Math.min(0.12, (t1 - t0) * 0.2), dropT = Math.min(0.07, (t1 - t0) * 0.15);
        const u = smooth(seg(t, t0 + lift, t1 - dropT)), hop = rook || ply.t === "N" ? 11 : 3;
        x = lerp(ax, bx, u); y = lerp(ay, by, u);
        if (t < t0 + lift) z = BZ + 5 * ease(seg(t, t0, t0 + lift));
        else if (t < t1 - dropT) z = BZ + 5 + Math.sin(u * Math.PI) * hop;
        else z = BZ + 5 * (1 - Math.pow(seg(t, t1 - dropT, t1), 2));
        if (t >= t1) z = BZ;
        if (t >= st.tI) base.t = qb.t;
      } else {
        const u = st.kind === "ff" ? seg(t, st.t0, st.t1) : smooth(seg(t, st.t0 + 0.04, st.t1 - 0.04));
        x = lerp(ax, bx, u); y = lerp(ay, by, u);
        z = BZ + (st.kind === "jump" ? Math.sin(u * Math.PI) * 4 : 0);
        ghost = u > 0 && u < 1;
      }
      out.push(Object.assign(base, { x, y, z, moving: true, ghost, ax, ay, kind: st.kind }));
    }
    return out;
  }

  // ---------- the camera at time t: the normal 70-degree view, or zoomed into the mating corner ----------
  function zoomU(p, t) {
    const z = p.zoom;
    if (!z) return 0;
    let u = smooth(seg(t, z.t0, z.t1));
    if (z.out0 !== undefined) u *= 1 - smooth(seg(t, z.out0, z.out1));
    if (z.push && u >= 1) u += smooth(seg(t, z.push[0], z.push[1])) * 0.5;
    return u;
  }
  function camAt(p, u) {
    const tx = p.yeti ? 34 : 0, z = p.zoom || { target: [0, 0, 0], k: 1 };
    const v = clamp(u, 0, 1), w = clamp((u - 1) * 2, 0, 1), kt = z.king || z.target;
    const target = [lerp(lerp(tx, z.target[0], v), kt[0], w), lerp(lerp(0, z.target[1], v), kt[1], w), lerp(0, z.target[2], v)];
    return new Cam({ pitch: 70, dist: DIST, focal: F0 * lerp(1, z.k, v) * lerp(1, 1.35, w), target, cy: lerp(lerp(86, 80, v), 84, w) });
  }
  function baseFor(p, u, withBoard) {
    const key = Math.round(u * 64) + (withBoard ? "b" : "n");
    let e = p.bases.get(key);
    if (e) return e;
    const cam = camAt(p, Math.round(u * 64) / 64), S = new Scene(cam, { key: [-0.5, -0.4, 0.78], lo: [0.86, 0.86, 0.94], hi: [1.08, 1.0, 0.86] });
    S.b.fill([14, 14, 14]);
    SETTINGS[p.setting].env(S, p);
    if (withBoard) {
      const BO = BO_OF(p.look);
      shadowRect(S, -BO + 3, -BO - 2, BO + 3, BO - 2, 0.55);
      drawBoard(S, p.look, [0, 0, BZ / 2], I3);
    }
    e = { buf: S.b.clone(), cam };
    if (p.bases.size > 40) p.bases.delete(p.bases.keys().next().value);
    p.bases.set(key, e);
    return e;
  }
  function shadowRect(S, x0, y0, x1, y1, f) {
    const q = [S.P(x0, y0, 0), S.P(x1, y0, 0), S.P(x1, y1, 0), S.P(x0, y1, 0)];
    let ya = Infinity, yb = -Infinity, xa = Infinity, xb = -Infinity;
    for (const c of q) { ya = Math.min(ya, c[1]); yb = Math.max(yb, c[1]); xa = Math.min(xa, c[0]); xb = Math.max(xb, c[0]); }
    S.b.poly(q, null, false, (x, y) => {
      const d = Math.min(x - xa, xb - x, y - ya, yb - y);
      if (d > 3 || (d > 0.5 && dith(x, y) < d / 3)) S.b.mul(x, y, f);
      return null;
    });
  }

  // ---------- drawing a frame ----------
  function pieceScale(cam) { return Math.max(1, Math.round(cam.scale(0, 0, 0) / (F0 / DIST) * 10) / 10); }
  function drawPieces(S, p, t, list, kz) {
    const b = S.b, look = p.look, end = p.end || {}, items = [];
    for (const q of list) items.push(q);
    items.sort((a, c) => (a.lying ? 1 : 0) - (c.lying ? 1 : 0) || c.y - a.y || a.z - c.z);
    // shadows first so a lifted piece never shades its neighbour's head
    for (const q of items) {
      if (q.hidden) continue;
      const spr = pieceSprite(look, q.t, q.c, kz), c = S.P(q.x, q.y, q.pile ? 0 : BZ), lift = Math.max(0, q.z - (q.pile ? 0 : BZ));
      const r = (spr.baseHw + 1) * Math.max(0.5, 1 - lift / 40);
      if (lift < 40 && !q.lying) b.shadow(c[0], c[1] + 1, r, r * 0.55, 1 - 0.42 * clamp(1 - lift / 40, 0.3, 1));
    }
    for (const q of items) {
      if (q.hidden) continue;
      const spr = pieceSprite(look, q.t, q.c, kz), c = S.P(q.x, q.y, q.z);
      const by = c[1] + 2 * kz;
      if (q.ghost) {
        for (const [dt, al] of q.kind === "jump" ? [[0.05, 0.3]] : [[0.07, 0.25], [0.035, 0.5]]) {
          const gx = lerp(q.x, q.ax, dt * 9), gy = lerp(q.y, q.ay, dt * 9), gc = S.P(gx, gy, q.z);
          drawSprite(b, spr, gc[0], gc[1] + 2 * kz, { alpha: al });
        }
      }
      drawSprite(b, spr, c[0], by, { a: q.a, piv: q.piv || 0, center: q.spin, flash: q.flash });
    }
    void end; void t;
  }
  function kingTip(p, q, t, kz) {
    const end = p.end;
    if (!end || !end.king || q.id !== end.king.id) return;
    const spr = pieceSprite(p.look, q.t, q.c, kz), dir = end.dir || 1;
    if (end.tremble && t >= end.tremble[0] && (!end.tip || t < end.tip[0])) {
      const u = seg(t, end.tremble[0], end.tremble[1]);
      q.a = Math.sin(t * 70) * 0.05 * u + (end.flip ? 0 : dir * 0.04 * u);
      q.piv = dir * spr.baseHw;
    }
    if (end.tip && t >= end.tip[0]) {
      const u = seg(t, end.tip[0], end.tip[1]), lean = end.gentle ? 0 : 0.04;
      let a = lean + (Math.PI / 2 - lean) * (end.gentle ? smooth(u) : Math.pow(u, 2.3));
      if (t > end.tip[1]) { const v = t - end.tip[1]; a = Math.PI / 2 - (end.gentle ? 0.06 : 0.2) * Math.abs(Math.sin(v * 13)) * Math.exp(-v * 7); }
      q.a = dir * a;
      q.piv = dir * spr.baseHw;
      q.lying = u >= 1;
    }
    if (end.bow) { const u = seg(t, end.bow[0], end.bow[1]); q.a = Math.sin(u * Math.PI) * 0.24 * (q.c === 0 ? 1 : -1); }
  }

  function render(rec0, t, opts) {
    const p = planFor(rec0, opts);
    if (!p) return null;
    const at = Math.min(t, p.dur), u = zoomU(p, at), end = p.end || {};
    const flipping = end.flip && at >= end.tF;
    const base = baseFor(p, u, !flipping), S = new Scene(base.cam, { key: [-0.5, -0.4, 0.78], lo: [0.86, 0.86, 0.94], hi: [1.08, 1.0, 0.86] });
    S.b = p.work.copy(base.buf);
    const kz = pieceScale(base.cam);
    let list = poses(p, at);
    if (end.bow) for (const k of end.kings) { const q = list.find((x) => x.id === k.id); if (q) q.bowing = true; }
    for (const q of list) {
      if (end.king || end.bow) kingTip(p, q, at, kz);
      if (end.tremble && at >= end.tremble[0] && at < (end.tF || 99) && end.flip) q.x += Math.round(Math.sin(at * 90 + q.id) * 0.8);
      if (end.king && end.tip && !end.gentle && at > end.tip[1] && at < end.tip[1] + 0.3 && q.id !== end.king.id && !q.pile) {
        const d = Math.hypot(q.x - sqW(end.king.sq)[0], q.y - sqW(end.king.sq)[1]);
        if (d < 30) q.z += Math.sin(seg(at, end.tip[1], end.tip[1] + 0.25) * Math.PI) * 3 * (1 - d / 30);
      }
    }
    for (const c of p.checks) if (c.mate && at >= c.t && at < c.t + 0.12) { const q = list.find((x) => x.t === "K" && x.id === (end.king || {}).id); if (q) q.flash = 0.8; }
    let boardR = null, boardC = null;
    if (flipping) {
      const fu = seg(at, end.tF, end.tF + 0.6), th = 2.4 * Math.pow(fu, 1.4), BO = BO_OF(p.look);
      const hinge = [BO + 80 * fu * fu, 0, 34 * fu * fu];
      boardR = Ry(th);
      const off = mv(boardR, [-BO, 0, BZ / 2]);
      boardC = [hinge[0] + off[0], hinge[1] + off[1], hinge[2] + off[2]];
      list = list.filter((q) => q.pile).concat(flyPoses(p, at, boardR, hinge));
    }
    const mugItem = mugState(p, at);
    if (flipping && boardC) drawBoard(S, p.look, boardC, boardR);
    if (mugItem.puddle) puddle(S, p, mugItem, at);
    drawMug(S, p, mugItem);
    if (p.yeti) yetiTable(S, p, at);
    drawPieces(S, p, at, list, kz);
    const wall = t;
    const L = lampsFor(p, base.cam, wall);
    light(S.b, L.lamps, L.amb);
    for (const gl of L.glows || []) glow(S.b, gl[0], gl[1], gl[2], gl[3], gl[4]);
    flames(S, p, wall);
    effects(S, p, at, kz, list);
    if (p.yeti) yetiOver(S, p, at, base.cam);
    ui(S.b, p, at, u);
    if (p.yeti) yetiCard(S.b, p, at);
    if (p.setting === "lodge") snow(S.b, wall, p.seed);
    let shake = [0, 0];
    for (const s of p.shakes) if (at >= s.t && at < s.t + s.dur) { const k = (1 - (at - s.t) / s.dur) * s.amp; shake = [Math.round(Math.sin((at - s.t) * 95) * k), Math.round(Math.cos((at - s.t) * 70) * k * 0.7)]; }
    let flash = 0;
    for (const f of p.flashes) if (at >= f.t && at < f.t + f.dur) flash = Math.max(flash, 1 - (at - f.t) / f.dur);
    const out = new Uint8ClampedArray(W * H * 4), c = S.b.c;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sx = clamp(x - shake[0], 0, W - 1), sy = clamp(y - shake[1], 0, H - 1), i = (sy * W + sx) * 3, o = (y * W + x) * 4;
      let r = c[i], g = c[i + 1], bl = c[i + 2];
      if (flash > 0 && (flash > 0.55 || dith(x, y) < flash * 1.4)) { r = lerp(r, 255, flash * 0.6); g = lerp(g, 236, flash * 0.55); bl = lerp(bl, 200, flash * 0.5); }
      out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = 255;
    }
    return { w: W, h: H, data: out };
  }
  function flyPoses(p, t, R, hinge) {
    const out = [], BO = BO_OF(p.look);
    for (const f of p.end.fly) {
      if (t < f.tl) {
        const w = mv(R, [f.x - BO, f.y, BZ]);
        out.push({ id: f.id, x: hinge[0] + w[0], y: hinge[1] + w[1], z: hinge[2] + w[2], t: f.t, c: f.c, a: 0 });
        continue;
      }
      const dt = t - f.tl, fly = f.land < 99 ? Math.min(dt, f.land - f.tl) : dt;
      let x = f.x + f.vx * fly, y = f.y + f.vy * fly, z = f.z0 + f.vz * fly - 0.5 * f.g * fly * fly, a = f.w * fly;
      if (f.land < 99 && t >= f.land) {
        const v = t - f.land, hop = Math.max(0, Math.sin(Math.min(1, v / 0.18) * Math.PI)) * 3 * (v < 0.18 ? 1 : 0);
        x = f.lx + Math.min(v, 0.2) * f.vx * 0.2; y = f.ly; z = hop;
        a = f.rest;
        out.push({ id: f.id, x, y, z, t: f.t, c: f.c, a, spin: false, lying: true, pile: true, piv: 0 });
        continue;
      }
      if (z < -60) continue;
      out.push({ id: f.id, x, y, z, t: f.t, c: f.c, a, spin: true });
    }
    return out;
  }

  // ---------- the mug by the board (it only moves when the board goes over) ----------
  function mugState(p, t) {
    const end = p.end || {}, m = { x: MUG_AT[0], y: MUG_AT[1], a: 0, kind: MUG[SETTINGS[p.setting].mug] ? SETTINGS[p.setting].mug : "tin" };
    if (p.yeti) { m.x = -78; m.y = -26; }
    if (end.flip && t >= end.tMug) {
      const u = seg(t, end.tMug, end.tMug + 0.28);
      m.a = Math.PI / 2 * Math.pow(u, 1.6);
      m.x += 7 * ease(u);
      if (u >= 1) m.a = Math.PI / 2 - 0.08 * Math.abs(Math.sin((t - end.tMug - 0.28) * 14)) * Math.exp(-(t - end.tMug - 0.28) * 6);
      m.puddle = seg(t, end.tMug + 0.12, end.tMug + 1.1);
    }
    return m;
  }
  function drawMug(S, p, m) {
    const M = MUG[m.kind], R = Ry(m.a);
    const lift = Math.sin(m.a) * M.r;
    if (m.a < 0.05) S.drop(m.x + 2, m.y + 2, 4, M.r + 1, 0.55);
    const base = [m.x + Math.sin(m.a) * 0, m.y, lift];
    if (M.stem && m.a < 0.05) {
      S.cyl([m.x, m.y, 0], M.r * 0.8, 1, M.col, { capCol: sc(M.col, 1.1) });
      S.cyl([m.x, m.y, 1], 0.9, 4, M.col);
      S.cyl([m.x, m.y, 5], M.r, M.h, M.col, { capCol: M.drink, rim: sc(M.col, 0.7) });
      return;
    }
    const z0 = m.a < 0.05 ? 0 : lift;
    S.cyl([base[0] - Math.sin(m.a) * M.h * 0.5 * 0, base[1], z0], M.r, M.h, M.col, { R, capCol: m.a > 0.7 ? sc(M.col, 0.5) : M.drink, rim: sc(M.col, 0.7) });
    if (m.a < 0.05) S.box([m.x + M.r + 1.2, m.y, M.h * 0.55], [1.4, 0.9, M.h * 0.3], I3, sc(M.col, 0.9), { edgeCol: sc(M.col, 0.55) });
  }
  function puddle(S, p, m, t) {
    const M = MUG[m.kind], col = M.spill || M.drink, n = vnoise(717), u = ease(m.puddle);
    const cx = m.x + M.h + 4, cy = m.y - 2, r = 3 + 15 * u;
    const c = S.P(cx, cy, 0.1), k = S.k(cx, cy, 0);
    S.b.ell(c[0], c[1], r * k * 1.3, r * k, (nx, ny, x, y) => {
      const d = nx * nx + ny * ny + (n(x * 0.3, y * 0.3) - 0.5) * 0.7;
      if (d > 0.9) return;
      S.b.px(x, y, d < 0.25 && (x + y) % 5 === 0 ? [236, 226, 200] : d > 0.7 ? sc(col, 0.8) : (x * 3 + y) % 7 === 0 ? sc(col, 1.25) : col);
    });
    void t;
  }

  function flames(S, p, wall) {
    const set = SETTINGS[p.setting], b = S.b;
    if (set.lamp === "fire") { const c = S.P(set.fire[0], set.fire[1], GZ + 4); campfire(b, c[0], c[1], wall, 1.25 * S.k(0, 0, 0) / (F0 / DIST)); }
    if (set.lamp === "candle") {
      const c = S.P(set.candle[0], set.candle[1], 9.6), k = S.k(0, 0, 0) / (F0 / DIST);
      if (p.rec.town === "veldrock") glow(b, c[0], c[1] - 1, 5 * k, [255, 170, 70], 0.7);
      flame(b, c[0], c[1], 1.3 * k, wall, p.rec.town === "ashfen" ? [170, 220, 140] : null);
    }
    if (set.lamp === "lodge") { const c = S.P(set.candle[0], set.candle[1], 8.4), k = S.k(0, 0, 0) / (F0 / DIST); flame(b, c[0], c[1], 1.1 * k, wall); }
  }
  function snow(b, wall, seed) {
    for (let i = 0; i < 26; i++) {
      const r = h2(i, seed % 97, 1), sp = 8 + r * 10, x = (h2(i, 3, 2) * W + Math.sin(wall * 0.8 + i) * 6 + wall * 3) % W, y = (h2(i, 5, 3) * H + wall * sp) % H;
      b.blend(x, y, [236, 244, 255], 0.55 + r * 0.35, true);
    }
  }

  // ---------- effects drawn over the lit scene: trails, bursts, check rings, the promotion sparkle, dust ----------
  function effects(S, p, t, kz, list) {
    const b = S.b;
    for (const tr of p.trails) {
      if (t < tr.t0 + 0.1 || t > tr.t + 1.1) continue;
      const grow = seg(t, tr.t0 + 0.1, tr.t), fade = 1 - seg(t, tr.t + 0.25, tr.t + 1.1);
      const a = sqW(tr.from), z = sqW(tr.to), pts = tr.knight ? (Math.abs(z[0] - a[0]) > Math.abs(z[1] - a[1]) ? [a, [z[0], a[1]], z] : [a, [a[0], z[1]], z]) : [a, z];
      let total = 0;
      for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      let done = 0;
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1], p1 = pts[i], L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        for (let s = 0; s <= L; s += 0.5) {
          const f = (done + s) / total;
          if (f > grow) break;
          const c = S.P(lerp(p0[0], p1[0], s / L), lerp(p0[1], p1[1], s / L), BZ + 0.2);
          const pulse = 0.55 + 0.45 * Math.sin(f * 18 - t * 14);
          b.add(c[0], c[1], tr.col, 0.7 * fade * pulse);
          b.add(c[0], c[1] + 1, tr.col, 0.25 * fade);
        }
        done += L;
      }
      for (const sq of [tr.from, tr.to]) {
        const w = sqW(sq), hs = SQ / 2 - 0.6, cs = [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]].map((d) => S.P(w[0] + d[0], w[1] + d[1], BZ + 0.1));
        if (sq === tr.to && t < tr.t) continue;
        for (let i = 0; i < 4; i++) { const a0 = cs[i], a1 = cs[(i + 1) % 4], n = Math.ceil(Math.hypot(a1[0] - a0[0], a1[1] - a0[1])); for (let k = 0; k <= n; k++) if (k % 2 === 0 || sq === tr.to) b.add(lerp(a0[0], a1[0], k / n), lerp(a0[1], a1[1], k / n), tr.col, 0.55 * fade); }
      }
    }
    for (const bu of p.bursts) {
      const u = (t - bu.t) / (bu.big ? 0.45 : 0.32);
      if (u < 0 || u > 1) continue;
      const w = sqW(bu.sq), c = S.P(w[0], w[1], BZ + 3), K = kz;
      rays(b, c[0], c[1], u, bu.big ? 12 : 8, 5 * K, (bu.big ? 16 : 10) * K, [255, 252, 226], bu.frost ? [170, 220, 255] : [255, 210, 110], 0.2);
      if (u < 0.2) b.ell(c[0], c[1], 8 * K, 6 * K, (nx, ny, x, y) => { if (nx * nx + ny * ny > 0.55) b.px(x, y, [255, 248, 214], true); });
    }
    for (const ck of p.checks) {
      const dur = ck.mate ? 99 : ck.small ? 0.3 : 0.9;
      if (t < ck.t || t > ck.t + dur) continue;
      if (p.end && p.end.flip && p.end.tF && t > p.end.tF) continue;
      const kq = list.find((q) => q.t === "K" && sqW(ck.sq)[0] === q.x && sqW(ck.sq)[1] === q.y);
      const w = sqW(ck.sq), c = S.P(w[0], w[1], BZ), u = t - ck.t, hs = SQ / 2;
      const pulse = ck.mate ? 0.6 + 0.4 * Math.sin(u * 9) : 1 - u / dur;
      const col = [255, 70, 50];
      const cs = [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]].map((d) => S.P(w[0] + d[0], w[1] + d[1], BZ + 0.1));
      for (let i = 0; i < 4; i++) { const a0 = cs[i], a1 = cs[(i + 1) % 4]; b.line(a0[0], a0[1], a1[0], a1[1], sc(col, 0.5 + 0.5 * pulse), true); }
      if (ck.mate && u < 0.28) { const v = u / 0.28, r = (5 + v * 22) * kz; b.ell(c[0], c[1], r, r * 0.55, (nx, ny, x, y) => { const d = nx * nx + ny * ny; if (d > 0.72 && dith(x, y) > v * 0.9) b.px(x, y, v < 0.4 ? [255, 255, 236] : [255, 214, 120], true); }); }
      if (!ck.small && !ck.mate && u < 0.9) text(b, "CHECK", c[0], c[1] - 24 * kz - 4, [255, 120, 90], { center: true, outline: [40, 10, 6] });
      void kq;
    }
    for (const pr of p.promos) {
      const u = t - pr.t;
      if (u < 0 || u > 1.1) continue;
      const w = sqW(pr.sq), c = S.P(w[0], w[1], BZ + 10);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + u * 3, rr = (6 + u * 10) * kz; if (u < 0.9) sparkle(b, c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr * 0.7, u < 0.3 ? 2 : 1, [255, 222, 110]); }
      if (u < 0.9) text(b, ({ Q: "QUEEN!", R: "ROOK!", B: "BISHOP!", N: "KNIGHT!" })[pr.type] || "QUEEN!", c[0], c[1] - 22 * kz, [255, 226, 130], { center: true, outline: [40, 24, 10] });
    }
    const end = p.end || {};
    if (end.tip && end.king && !end.flip) {
      const u = (t - end.tip[1]) / (end.gentle ? 0.4 : 0.6);
      if (u >= 0 && u <= 1) {
        const w = sqW(end.king.sq), dir = end.dir || 1, spr = pieceSprite(p.look, "K", 0, kz), reach = spr.h * 0.7;
        const c = S.P(w[0], w[1], BZ), cx = c[0] + dir * reach, cy = c[1], r = rng(91), n = end.gentle ? 8 : 18;
        for (let i = 0; i < n; i++) {
          const a = r() * Math.PI * 2, d = (3 + r() * 9 * ease(u) + u * 6) * kz * (end.gentle ? 0.6 : 1);
          if (r() > u * 1.1) b.px(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.5 - Math.sin(u * Math.PI) * 3 * kz, [226, 206, 170], true);
        }
        if (!end.gentle && u < 0.25) b.ell(cx, cy, 10 * kz, 5 * kz, (nx, ny, x, y) => { if (nx * nx + ny * ny > 0.7) b.px(x, y, [255, 240, 200], true); });
      }
    }
    if (end.flip && t >= end.tF) {
      const m = mugState(p, t);
      if (t > end.tMug && t < end.tMug + 0.5) {
        const r = rng(13), c = S.P(m.x + 6, m.y, 6), u = (t - end.tMug) / 0.5, M = MUG[m.kind];
        for (let i = 0; i < 9; i++) { const vx = 10 + r() * 22, vy = -18 - r() * 16; b.px(c[0] + vx * u, c[1] + vy * u + 40 * u * u, i % 3 ? (M.spill || M.drink) : [240, 232, 210], true); }
      }
    }
  }

  // ---------- the Yeti Society's slip: a footprint slams it down, it is read, and the move is made ----------
  function footShape(nx, ny) {
    // a broad sole that narrows to the heel, and four round toes set apart above it; nx across, ny down the foot, both in -1..1
    const rx = 0.6 - 0.16 * Math.max(0, ny - 0.2);
    if (Math.pow(nx / rx, 2) + Math.pow((ny - 0.26) / 0.7, 2) <= 1) return 1;
    for (const [tx, ty, tr] of [[-0.46, -0.6, 0.15], [-0.16, -0.78, 0.16], [0.16, -0.8, 0.16], [0.46, -0.62, 0.14]]) if (Math.hypot(nx - tx, ny - ty) < tr) return 2;
    return 0;
  }
  function yetiTable(S, p, t) {
    const F = p.foot, x = 90, y = -4, k = S.k(x, y, 0), c = S.P(x, y, 0.1), b = S.b;
    if (t >= F.tS) {
      const sl = [S.P(x - 26, y - 24, 0.2), S.P(x + 12, y - 21, 0.2), S.P(x + 10, y + 6, 0.2), S.P(x - 28, y + 3, 0.2)];
      b.poly(sl.map((q) => [q[0] + 1, q[1] + 1]), [70, 60, 50]);
      b.poly(sl, null, false, (px, py) => ((py + px * 0.06) % 4 < 0.7 && px > sl[0][0] + 3 && px < sl[1][0] - 4 ? [120, 100, 80] : (px * 7 + py * 3) % 11 === 0 ? [212, 196, 162] : [232, 218, 184]));
    } else if (t >= F.t0) {
      const u = seg(t, F.t0, F.tS), r = (8 + 16 * u) * k;
      b.shadow(c[0], c[1], r * 1.2, r * 0.8, 1 - 0.5 * u);
    }
  }
  function yetiOver(S, p, t, cam) {
    const F = p.foot, b = S.b, x = 90, y = -4;
    if (t >= F.tS) {
      const c = cam.p(x, y, 0.1), k = cam.scale(x, y, 0), n = vnoise(805), rx = 17 * k, ry = 24 * k, fade = 0.7 + 0.3 * (1 - seg(t, F.tS, F.tS + 2));
      b.ell(c[0], c[1], rx, ry, (nx, ny, px, py) => {
        const j = (n(px * 0.7, py * 0.7) - 0.5) * 0.1, s = footShape(nx + j, ny + j);
        if (!s) return;
        const rim = !footShape(nx + j + 0.09, ny + j) || !footShape(nx + j - 0.09, ny + j) || !footShape(nx + j, ny + j + 0.07) || !footShape(nx + j, ny + j - 0.07);
        b.blend(px, py, rim ? [176, 196, 226] : (px + py * 3) % 9 === 0 ? [214, 228, 246] : [240, 246, 255], rim ? 0.9 : fade, true);
      });
    }
    if (t >= F.t0 && t < F.tGone) {
      const z = t < F.tS ? lerp(240, 2, Math.pow(seg(t, F.t0, F.tS), 2.2)) : t < F.tUp ? 2 : lerp(2, 260, Math.pow(seg(t, F.tUp, F.tGone), 1.6));
      const c = cam.p(x, y, z), k = cam.scale(x, y, z), n = vnoise(811), rx = 19 * k, ry = 27 * k;
      // the top of the foot: white fur, toes ending in grey claws, a fringe that breaks the outline
      b.ell(c[0], c[1], rx * 1.1, ry * 1.08, (nx, ny, px, py) => {
        const fz = (n(px * 0.45, py * 0.45) - 0.5) * 0.16, s = footShape(nx * 1.1 + fz, ny * 1.08 + fz);
        if (!s) { if (footShape(nx * 1.1 + fz * 2.4, ny * 1.08 + fz * 2.4) && (px + py) % 2 === 0) b.px(px, py, [200, 212, 230], true); return; }
        const lit = 0.84 + 0.22 * clamp(-nx * 0.6 - ny * 0.5 + 0.2, 0, 1) + (n(px * 1.1, py * 0.5) - 0.5) * 0.16;
        let col = sc([236, 242, 250], lit);
        if (s === 2 && !footShape(nx * 1.1 + fz, ny * 1.08 + fz - 0.1)) col = [120, 126, 142];
        else if (!footShape(nx * 1.1 + fz + 0.07, ny * 1.08 + fz) || !footShape(nx * 1.1 + fz - 0.07, ny * 1.08 + fz)) col = [168, 184, 208];
        b.px(px, py, col, true);
      });
    }
    if (t >= F.tS && t < F.tS + 0.9) {
      const u = (t - F.tS) / 0.9, c = cam.p(x, y, 2), k = cam.scale(x, y, 0), r = rng(77);
      for (let i = 0; i < 40; i++) {
        const a = r() * Math.PI * 2, sp = (18 + r() * 34) * k, d = sp * ease(u), up = (8 + r() * 14) * k * Math.sin(u * Math.PI);
        const px = c[0] + Math.cos(a) * d, py = c[1] + Math.sin(a) * d * 0.55 - up + u * u * 8;
        if (r() > u * 0.9) { b.px(px, py, [246, 250, 255], true); if (i % 3 === 0) b.px(px + 1, py, [220, 232, 246], true); }
      }
      if (u < 0.2) rays(b, c[0], c[1], u * 5, 12, 20 * k, 16 * k, [255, 255, 255], [200, 226, 255], 0.1);
    }
  }
  function yetiCard(b, p, t) {
    const C = p.card, ply = p.G.plies[p.yeti.ply];
    if (t >= C.t0 && t < C.t1 + 0.3) {
      const uin = ease3(seg(t, C.t0, C.t0 + 0.3)), uout = smooth(seg(t, C.t1, C.t1 + 0.3)), w = 104, h = 46;
      const cx = lerp(150, W / 2, uin), cy = lerp(H + 30, H / 2 - 2, uin) + uout * 110;
      const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
      b.rect(x0 + 2, y0 + 2, w, h, [10, 8, 8], true);
      b.rect(x0, y0, w, h, [236, 222, 188], true);
      b.rect(x0 + 2, y0 + 2, w - 4, h - 4, [242, 230, 198], true);
      for (let i = 0; i < w; i += 2) { b.px(x0 + i, y0, [214, 196, 158], true); b.px(x0 + i + 1, y0 + h - 1, [200, 180, 140], true); }
      const n = Math.floor(ply.i / 2) + 1, mvTxt = `${n}${ply.c ? "..." : "."} ${ply.san}`;
      text(b, `DAY ${p.yeti.day}:`, x0 + 6, y0 + 6, [120, 80, 46]);
      text(b, mvTxt, x0 + w / 2, y0 + 18, [40, 30, 60], { k: 2, center: true });
      // the print of a big toe in the slip's corner, the Society's only signature
      b.ell(x0 + w - 12, y0 + 11, 7, 9, (nx, ny, px, py) => { if (footShape(nx, ny)) b.px(px, py, [150, 176, 214], true); });
    }
  }

  // ---------- the panels: names, the move counter, the legend, the result ----------
  function pawnIcon(b, x, y, pal) {
    const rows = [".ooo.", "ohmmo", "ommdo", ".odo.", "ohmdo", "ommmdo"];
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const ch = r[i]; if (ch === ".") continue; b.px(x + i, y + j, ch === "o" ? pal.ol : ch === "h" ? pal.hi : ch === "m" ? pal.mid : pal.sh, true); } });
  }
  function parchment(b, lines, y, u) {
    const tw = Math.max(...lines.map((l) => textWidth(l))) + 12, th = lines.length * 7 + 7, x0 = Math.round(W / 2 - tw / 2), y0 = Math.round(y - u * (th + 6));
    b.rect(x0 + 2, y0 + 2, tw, th, [16, 10, 6], true);
    b.rect(x0, y0, tw, th, [222, 200, 152], true);
    b.rect(x0 + 1, y0 + 1, tw - 2, th - 2, [236, 218, 172], true);
    for (let i = 0; i < tw; i += 4) { b.px(x0 + i, y0, [190, 164, 116], true); b.px(x0 + i + 2, y0 + th - 1, [180, 152, 104], true); }
    for (const [cx, cy] of [[x0, y0], [x0 + tw - 3, y0], [x0, y0 + th - 3], [x0 + tw - 3, y0 + th - 3]]) b.rect(cx, cy, 3, 3, [196, 168, 118], true);
    lines.forEach((l, i) => text(b, l, W / 2, y0 + 4 + i * 7, [86, 54, 30], { center: true }));
  }
  function ui(b, p, t, u) {
    const rec = p.rec, end = p.end || {};
    if (rec.legend && !p.yeti) parchment(b, wrap(rec.legend, 168).slice(0, 3), 2, u);
    // names: black (far side) on the top row, white (near side) below, the winner in gold at the end
    const names = [nameOf(rec.players[0], p.yeti ? 10 : 8), nameOf(rec.players[1], p.yeti ? 10 : 8)], nw = Math.max(textWidth(names[0]), textWidth(names[1])) + 12, sy = H - 21;
    const sx = p.yeti ? W - nw - 3 : 2;
    slate(b, sx, sy, nw, 18, [104, 74, 44]);
    [1, 0].forEach((who, i) => {
      pawnIcon(b, sx + 3, sy + 3 + i * 7, p.look.pal[who]);
      let col = [214, 220, 206];
      if (t >= (p.tResult || 99) && rec.winner === who) col = [255, 220, 120];
      if (end.flip && t >= end.tF && p.loser === who) col = [255, 120, 90];
      text(b, names[who], sx + 10, sy + 3 + i * 7, col);
    });
    if (p.yeti) {
      text(b, "YETI SOCIETY", W - 4, 4, [236, 244, 252], { right: true, shadow: [30, 34, 44] });
      text(b, "BY POST", W - 4, 11, [196, 210, 226], { right: true, shadow: [30, 34, 44] });
      if (p.tNext && t >= p.tNext) {
        const s = "NEXT: TOMORROW", w = textWidth(s) + 8, slide = Math.round((1 - ease3(seg(t, p.tNext, p.tNext + 0.3))) * 8);
        slate(b, W - w - 3, H - 35 + slide, w, 11, [150, 170, 196]);
        text(b, s, W - w + 1, H - 32 + slide, [236, 244, 252]);
      }
    } else if (!(rec.stake && t > p.tEnd + 0.3)) counter(b, p, t);
    for (const s of p.stamps) {
      if (t < s.t) continue;
      if (s.burst && t < s.t + 0.35 && u <= 0.5) rays(b, W / 2, 58, (t - s.t) / 0.35, 14, 14, 30, [255, 250, 220], [255, 170, 70], 0.1);
      stamp(b, s.word, W / 2, u > 0.5 ? 14 : s.small ? 60 : 50, s.col, t - s.t, s.k, s.burst ? [70, 20, 6] : undefined);
    }
    if (p.tResult && t >= p.tResult && rec.winner !== null && !(end.kind === "resign" && !end.flip && false)) {
      const word = `${nameOf(rec.players[rec.winner])} WINS!`, y = u > 0.5 ? 30 : end.flip ? 74 : 69;
      text(b, word, W / 2, y, [255, 226, 140], { center: true, outline: [24, 14, 10] });
    }
    if (rec.stake && t > p.tEnd) stakeToken(b, rec, p.look, t - p.tEnd - 0.3, p.loser);
  }
  function counter(b, p, t) {
    const G = p.G, N = p.N, M = Math.ceil(N / 2);
    let done = p.k0;
    for (const st of p.steps) {
      if (t >= st.tI) done = st.b;
      else if (st.kind === "jump" && t >= st.t0) done = Math.round(lerp(st.a, st.b, smooth(seg(t, st.t0, st.t1))));
    }
    const ply = done > 0 ? G.plies[done - 1] : null, mvNo = ply ? Math.floor(ply.i / 2) + 1 : 0;
    const top = `${mvNo}/${M}`, san = ply ? (ply.c ? ".." : "") + ply.san : "START";
    const w = Math.max(textWidth(top), textWidth(san), 26) + 8, x0 = W - w - 3, y0 = H - 21;
    slate(b, x0, y0, w, 18, [104, 74, 44]);
    text(b, top, x0 + w - 4, y0 + 3, [236, 240, 230], { right: true });
    text(b, san, x0 + w - 4, y0 + 10, ply && ply.mate ? [255, 214, 100] : ply && ply.check ? [255, 130, 100] : [214, 220, 206], { right: true });
    if (p.mode === "full" && p.fast && p.fast[1] > p.fast[0]) {
      const fast = t >= p.fast[0] && t < p.fast[1];
      text(b, fast ? `>>X${p.speed}` : t >= p.fast[1] ? "1X" : "", W - 4, y0 - 7, fast ? [255, 196, 90] : [200, 200, 180], { right: true, shadow: [20, 14, 10] });
    } else if (p.keys && p.keys.length > 1) {
      const n = p.keyT.filter((kt) => t >= kt).length;
      p.keys.forEach((_, i) => { const x = W - 4 - (p.keys.length - 1 - i) * 5 - 3; b.rect(x, y0 - 5, 3, 3, i < n ? [255, 210, 100] : [80, 70, 60], true); b.rect(x + 1, y0 - 2, 3, 1, [16, 10, 6], true); });
    }
  }

  // ---------- plans, cached per record and mode ----------
  const plans = new Map();
  function planFor(rec0, opts) {
    const mode = (opts && opts.mode) === "full" ? "full" : "key", key = (rec0.id || "chess") + ":" + mode;
    let p = plans.get(key);
    if (p && p.src === rec0) return p;
    p = makePlan(rec0, mode);
    p.src = rec0;
    p.bases = new Map();
    p.work = new Buf();
    if (plans.size > 16) plans.delete(plans.keys().next().value);
    plans.set(key, p);
    return p;
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
    function brass(t, f, dur, vol) {
      const o = ctx.createOscillator(), f1 = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(f, t);
      f1.type = "lowpass"; f1.frequency.setValueAtTime(f * 1.5, t); f1.frequency.linearRampToValueAtTime(f * 5, t + 0.06); f1.frequency.exponentialRampToValueAtTime(f * 2, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      o.connect(f1); f1.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
    // each set has its own knock: hollow pegs, soft driftwood, crisp bone, ivory that rings
    const MAT = { peg: { f: 980, n: 2100, body: 220, ring: 0 }, drift: { f: 420, n: 950, body: 150, ring: 0 }, bone: { f: 1500, n: 3200, body: 260, ring: 0.02 }, ivory: { f: 1850, n: 4200, body: 240, ring: 0.05 } };
    const FX = {
      fire: (t, secs) => {
        secs = Math.min(18, secs || 8);
        noise(t, secs, 0.05, "lowpass", 260, 0.7);
        noise(t, secs, 0.012, "highpass", 5200);
        let at = t + 0.05;
        while (at < t + secs - 0.2) {
          const big = Math.random() < 0.12;
          noise(at, big ? 0.03 : 0.012, big ? 0.3 : 0.08 + Math.random() * 0.12, "bandpass", big ? 1800 : 2500 + Math.random() * 3000, big ? 1.2 : 2.5);
          at += 0.04 + Math.random() * Math.random() * 0.35;
        }
      },
      tavern: (t, secs) => {
        secs = Math.min(18, secs || 8);
        noise(t, secs, 0.04, "bandpass", 520, 0.7);
        for (let i = 0; i < secs * 2.2; i++) noise(t + Math.random() * secs, 0.2 + Math.random() * 0.2, 0.016, "bandpass", 500 + Math.random() * 700, 5);
        for (let i = 0; i < 3; i++) ring(t + 0.8 + Math.random() * (secs - 1), 2200 + Math.random() * 600, 0.4, 0.025);
      },
      // the guild hall: a hush and a slow clock
      hall: (t, secs) => {
        secs = Math.min(18, secs || 8);
        noise(t, secs, 0.022, "lowpass", 400, 0.5);
        for (let at = t + 0.3; at < t + secs - 0.2; at += 1.0) { tone(at, 1900, 1700, 0.03, 0.05, "triangle"); noise(at, 0.015, 0.05, "highpass", 3000); }
      },
      // the lodge: wind round the eaves, rising and falling
      lodge: (t, secs) => {
        secs = Math.min(18, secs || 8);
        noise(t, secs, 0.03, "lowpass", 300, 0.6);
        for (let i = 0; i < Math.ceil(secs / 2.5); i++) { const at = t + i * 2.5 + Math.random(); noise(at, 2.2, 0.03, "bandpass", 500 + Math.random() * 300, 6, 900 + Math.random() * 400); }
      },
      lift: (t, v) => { noise(t, 0.07, 0.06 * (v || 1), "bandpass", 1500, 1.5, 2400); },
      clack: (t, v, m) => {
        v = v || 1; const M = MAT[m] || MAT.peg, f = M.f * (0.94 + Math.random() * 0.12);
        tone(t, f, f * 0.72, 0.05, 0.26 * v, "triangle");
        noise(t, 0.03, 0.42 * v, "bandpass", M.n + Math.random() * 600, 2.5);
        tone(t, M.body, M.body * 0.6, 0.07, 0.24 * v);
        if (M.ring) ring(t + 0.002, f * 1.6, 0.25, M.ring * v);
      },
      tick: (t, v, m) => { const M = MAT[m] || MAT.peg; tone(t, M.f * 1.1, M.f * 0.9, 0.025, 0.1 * (v || 1), "triangle"); noise(t, 0.015, 0.12 * (v || 1), "bandpass", M.n, 3); },
      slide: (t, v) => { v = v || 1; noise(t, 0.5, 0.12 * v, "bandpass", 700, 1.2, 2600); noise(t + 0.05, 0.4, 0.05 * v, "highpass", 4000); },
      settle: (t, v, m) => { for (let i = 0; i < 4; i++) FX.tick(t + i * 0.035 + Math.random() * 0.02, (v || 1) * (1 - i * 0.15) * 1.5, m); },
      take: (t, v, m) => { v = v || 1; FX.clack(t, v * 0.9, m); noise(t + 0.03, 0.14, 0.1 * v, "bandpass", 1300, 1.5, 2600); },
      land: (t, v, m) => { FX.clack(t, (v || 1) * 0.7, m); FX.tick(t + 0.06, (v || 1) * 0.8, m); },
      clatter: (t, v, m) => { FX.clack(t, v || 0.6, m); FX.tick(t + 0.05 + Math.random() * 0.03, 0.7, m); FX.tick(t + 0.11 + Math.random() * 0.04, 0.4, m); },
      // check: a sharp sting, two notes a semitone apart, shivering
      check: (t, v) => {
        v = v || 1;
        for (const [f, d] of [[880, 0], [932, 0.01]]) {
          const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
          o.type = "triangle"; o.frequency.value = f; lfo.frequency.value = 18; lg.gain.value = 0.04 * v;
          lfo.connect(lg); lg.connect(g.gain);
          g.gain.setValueAtTime(0.0001, t + d); g.gain.linearRampToValueAtTime(0.08 * v, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0006, t + d + 0.55);
          o.connect(g); g.connect(out); o.start(t + d); lfo.start(t + d); o.stop(t + d + 0.6); lfo.stop(t + d + 0.6);
        }
        noise(t, 0.04, 0.2 * v, "highpass", 3000);
      },
      zoom: (t, v) => { noise(t, 0.75, 0.1 * (v || 1), "bandpass", 300, 1.4, 2400); tone(t, 110, 220, 0.75, 0.05 * (v || 1), "sine", 0.3); },
      whoosh: (t, v) => { noise(t, 0.4, 0.12 * (v || 1), "bandpass", 2400, 1.2, 500); },
      rattle: (t, v, m) => { for (let i = 0; i < 9; i++) FX.tick(t + i * 0.06 + Math.random() * 0.02, (v || 1) * (0.5 + 0.5 * Math.sin(i)), m); },
      creak: (t, v) => { const o = tone(t, 140, 90, 0.5, 0.05 * (v || 1), "sawtooth", 0.1); void o; noise(t, 0.45, 0.04 * (v || 1), "bandpass", 700, 6, 400); },
      // the king coming down: a low body thump under a woody knock, and a short roll
      thud: (t, v, m) => {
        v = v || 1;
        tone(t, 95, 38, 0.45, 0.5 * v); tone(t, 180, 70, 0.18, 0.3 * v, "triangle");
        noise(t, 0.2, 0.32 * v, "lowpass", 500); FX.clack(t, 0.9 * v, m);
        FX.clack(t + 0.16, 0.35 * v, m); FX.tick(t + 0.25, 0.4 * v, m);
      },
      mate: (t) => { [[392, 0], [523, 0.13], [659, 0.26], [784, 0.39]].forEach(([f, d]) => brass(t + d, f, d === 0.39 ? 0.9 : 0.22, 0.06)); brass(t + 0.39, 523, 0.9, 0.04); brass(t + 0.39, 659, 0.9, 0.035); },
      win: (t) => { tone(t, 523, 523, 0.22, 0.06, "triangle"); tone(t + 0.12, 659, 659, 0.22, 0.06, "triangle"); tone(t + 0.24, 784, 784, 0.45, 0.07, "triangle"); },
      draw: (t) => { tone(t, 440, 440, 0.3, 0.06, "triangle"); tone(t + 0.16, 440, 440, 0.4, 0.05, "triangle"); },
      stamp: (t) => { tone(t, 120, 60, 0.18, 0.35); noise(t, 0.08, 0.3, "lowpass", 800); },
      promote: (t) => { [1046, 1318, 1568, 2093].forEach((f, i) => ring(t + i * 0.08, f, 0.9 - i * 0.1, 0.07)); },
      slow: (t) => { tone(t, 900, 300, 0.4, 0.05, "sine", 0.05); },
      // the board going over: a heave, a crack on the table edge, then everything raining down
      flip: (t) => {
        noise(t - 0.05, 0.25, 0.2, "bandpass", 400, 1, 1200);
        tone(t + 0.12, 120, 50, 0.3, 0.4); noise(t + 0.12, 0.3, 0.45, "lowpass", 900);
        for (let i = 0; i < 14; i++) FX.tick(t + 0.15 + Math.random() * 0.5, 0.6 + Math.random() * 0.6, "drift");
      },
      spill: (t) => { tone(t, 600, 300, 0.12, 0.1, "triangle"); ring(t, 700, 0.4, 0.04); noise(t + 0.08, 0.7, 0.14, "bandpass", 900, 2, 400); for (let i = 0; i < 6; i++) tone(t + 0.15 + i * 0.07 + Math.random() * 0.04, 500 + Math.random() * 400, 900 + Math.random() * 500, 0.05, 0.05); },
      // the Yeti Society's post: a footfall like a dropped boulder, and a breath of snow
      slam: (t) => { tone(t, 70, 30, 0.6, 0.6); tone(t, 140, 60, 0.25, 0.3, "triangle"); noise(t, 0.35, 0.5, "lowpass", 400); noise(t, 0.05, 0.3, "highpass", 2000); },
      puff: (t) => { noise(t, 0.6, 0.16, "highpass", 3000, 0.7, 6000); noise(t, 0.4, 0.1, "bandpass", 1200, 1); },
      paper: (t, v) => { for (let i = 0; i < 6; i++) noise(t + i * 0.035 + Math.random() * 0.02, 0.04, 0.09 * (v || 1), "bandpass", 3200 + Math.random() * 2000, 2); },
      chime: (t) => { ring(t, 1568, 1.2, 0.06); ring(t + 0.18, 2093, 1.0, 0.05); },
      token: (t) => { tone(t, 150, 80, 0.09, 0.28); noise(t, 0.05, 0.22, "lowpass", 900); },
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
      try { for (const [t, name, v, x] of evs) if (FX[name]) FX[name](t + 0.01, v === undefined ? 1 : v, x); } finally { [ctx, out, noiseBuf] = saved; }
      return off.startRendering();
    }
    function play(name, v, x, late) { const c = ok(); if (!c || !FX[name]) return; try { FX[name](c.currentTime + 0.01, late ? Math.max(0.5, v - late) : v, x); } catch (e) { /* audio node limits */ } }
    if (root.document) {
      root.document.addEventListener("pointerdown", () => { unlocked = true; }, { capture: true });
      root.document.addEventListener("visibilitychange", () => { if (ctx && root.document.hidden) ctx.suspend(); });
    }
    return { play, render, FX, get ready() { return open() && prefs().on; } };
  })();

  // ---------- the player ----------
  const LONG = { fire: 1, tavern: 1, hall: 1, lodge: 1 };
  const reduced = () => !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function player(rec, opts) {
    opts = opts || {};
    const doc = root.document, fig = doc.createElement("figure"), cv = doc.createElement("canvas");
    fig.className = "chess-replay";
    cv.width = W; cv.height = H;
    cv.style.cssText = `image-rendering:pixelated;image-rendering:crisp-edges;display:block;cursor:pointer;${opts.scale ? `width:${W * opts.scale}px;height:${H * opts.scale}px` : "width:100%;height:auto"}`;
    cv.title = "Click to watch again";
    fig.appendChild(cv);
    let mode = opts.mode === "full" ? "full" : "key";
    const yeti = !!rec.yeti;
    let btn = null;
    if (!yeti) {
      btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "btn small chess-replay-mode";
      fig.appendChild(btn);
    }
    if (rec.line) { const cap = doc.createElement("figcaption"); cap.textContent = rec.line; fig.appendChild(cap); }
    if (rec.real) { const sm = doc.createElement("figcaption"); sm.className = "chess-real tiny dim"; sm.textContent = "The real game: " + rec.real; fig.appendChild(sm); }
    const g = cv.getContext("2d"), img = g.createImageData(W, H);
    let p = planFor(rec, { mode });
    if (!p) return fig;
    let t = reduced() ? p.dur + 1 : 0, raf = 0, last = 0, onscreen = false, fired = 0, lastDraw = -1, rate = 1, held = false, forced = false, heard = Snd.ready;
    let evs = p.ev.slice().sort((a, b) => a[0] - b[0]);
    const label = () => { if (btn) btn.textContent = mode === "key" ? "▸ Watch the full game" : "▸ Back to the key moments"; };
    label();
    const paint = () => { const f = render(rec, t, { mode }); img.data.set(f.data); g.putImageData(img, 0, 0); };
    const live = () => !held && fig.isConnected && onscreen && !doc.hidden;
    function frame(ms) {
      raf = 0;
      if (!live()) { last = 0; return; }
      const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
      last = ms;
      t += dt * rate;
      // sound unlocked mid-replay (the first tap on the page): the beds that should be running come in where they are
      const ready = Snd.ready;
      if (ready && !heard) for (let i = 0; i < fired; i++) { const e = evs[i], late = t - e[0]; if (LONG[e[1]] && late < e[2] - 1) Snd.play(e[1], e[2], e[3], late); }
      heard = ready;
      while (fired < evs.length && evs[fired][0] <= t) {
        const e = evs[fired], late = t - e[0];
        if (late < 0.25) Snd.play(e[1], e[2], e[3]);
        else if (LONG[e[1]] && late < e[2] - 1) Snd.play(e[1], e[2], e[3], late);
        fired++;
      }
      if (t < p.dur + 0.3 || t - lastDraw > 1 / 12) { paint(); lastDraw = t; }
      raf = root.requestAnimationFrame(frame);
    }
    const wake = () => { if ((forced || !reduced()) && !raf && live()) { last = 0; raf = root.requestAnimationFrame(frame); } };
    const restart = () => { held = false; t = reduced() && !forced ? p.dur + 1 : 0; fired = 0; lastDraw = -1; paint(); wake(); };
    cv.addEventListener("click", restart);
    if (btn) btn.addEventListener("click", () => { mode = mode === "key" ? "full" : "key"; p = planFor(rec, { mode }); evs = p.ev.slice().sort((a, b) => a[0] - b[0]); label(); restart(); });
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
      restart() { forced = true; restart(); },
      skip() { t = p.dur; fired = evs.length; lastDraw = -1; paint(); wake(); },
      rate(s) { rate = s; },
    };
    paint();
    wake();
    return fig;
  }

  root.ChessReplay = {
    player, W, H, SETTINGS: Object.keys(SETTINGS),
    frame: render,
    length: (rec, opts) => { const p = planFor(rec, opts); return p ? p.dur : 0; },
    events: (rec, opts) => { const p = planFor(rec, opts); return p ? p.ev.slice() : []; },
    game: (rec) => parseGame(rec.moves, rec.san, rec.result === "mate").plies.map((q) => ({ i: q.i, from: sqName(q.from), to: sqName(q.to), piece: q.t, side: q.c, capture: q.cap ? q.cap.t : null, check: q.check, mate: q.mate, san: q.san })),
    sprite: pieceSprite, looks: LOOKS,
    sound: Snd,
  };
})(typeof window !== "undefined" ? window : globalThis);
