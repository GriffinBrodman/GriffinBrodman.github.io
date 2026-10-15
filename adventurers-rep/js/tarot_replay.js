/* Tarot reading replays: a 70-degree lit table, the cards dealt one by one face down and flipped one by one; a reversed card brings a quiet dread. */
/*
  INPUT: a reading record, as league/tarot.py stores it in world["readings"][id]:
    { id, day, where: "camp"|"tavern"|"town", place, reader: {kind, id?, town?, name}, sitter: {id, name}, self, deck: "witch"|"glass",
      overlay, table: "moss"|"velvet"|"linen", cards: [{card, rev, pos, omen, tier, hit?}] }
  The cards' art comes from TarotCards (js/tarot_cards.js and js/tarot/<deck>.js), loaded on demand.

  TarotReplay.player(rec, opts) -> <figure> that loads the deck, plays while on screen, holds on the spread, replays on click.
  TarotReplay.frame(rec, t, tex) -> { w, h, data: RGBA bytes } for tex = { faces: [RGBA per card], back: RGBA, w, h } (no DOM).
  TarotReplay.length(rec) -> seconds before the hold. TarotReplay.events(rec) -> [[t, sound, v], ...]. TarotReplay.TABLES.
  The scene follows tools/tarot_art/tables.py, the reference the owner approved.
*/
(function (root) {
  "use strict";
  const W = 192, H = 144;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (u) => u * u * (3 - 2 * u);
  const ease = (u) => 1 - Math.pow(1 - u, 3);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const mv = (A, v) => [dot(A[0], v), dot(A[1], v), dot(A[2], v)];
  const Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
  const Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };

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
      const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
  }

  // ---------- camera: pitch 70 degrees, as every table replay ----------
  function cam(o) {
    const a = 70 * Math.PI / 180, f = [0, Math.cos(a), -Math.sin(a)], u = [0, Math.sin(a), Math.cos(a)], tg = o.target;
    const pos = [tg[0] - f[0] * o.dist, tg[1] - f[1] * o.dist, tg[2] - f[2] * o.dist];
    return {
      f, u, pos, focal: o.dist, cx: W / 2, cy: o.cy,
      p(P) { const r = sub(P, pos), d = dot(r, f); return [this.cx + r[0] * this.focal / d, this.cy - dot(r, u) * this.focal / d, d]; },
      scale(P) { return this.focal / dot(sub(P, pos), f); },
      ray(sx, sy) { const dx = (sx - this.cx) / this.focal, dy = (sy - this.cy) / this.focal; return [f[0] + dx, f[1] - u[1] * dy, f[2] - u[2] * dy]; },
      onZ(sx, sy, z) { const D = this.ray(sx, sy), s = (z - pos[2]) / D[2]; return [pos[0] + D[0] * s, pos[1] + D[1] * s, pos[2] + D[2] * s]; },
    };
  }
  const L = (pos, col, i, r, size, p, fill) => ({ pos, col: col.map((v) => v / 255), i, r, size, p, fill: !!fill });

  // ---------- the tables ----------
  const TABLES = {
    moss: () => {
      const n = vnoise(9), cand = [-90, 56], cens = [88, 58];
      return {
        cam: cam({ dist: 430, target: [0, 8, 0], cy: 72 }), amb: [34, 32, 30], edge: [226, 212, 180],
        surface(x, y) {
          const pl = Math.floor((x + 300) / 16), px = (x + 300) % 16;
          let f = 0.72 + (n(y * 0.06 + pl * 7.3, px * 0.4) * 0.5 + n(y * 0.2 + pl * 3, px) * 0.2) * 0.45 + (pl % 3) * 0.03;
          if (px < 1) f *= 0.45;
          let c = [104 * f, 72 * f, 46 * f];
          if (n(x * 0.16 + 40, y * 0.16) > 0.72 && n(x * 0.5, y * 0.5) > 0.4) c = [74 * f, 96 * f, 48 * f];
          if (Math.abs(x) < 92 && y > -46 && y < 44) {
            const k = (0.92 + 0.08 * ((Math.floor(x) + Math.floor(y)) & 1)) * (0.9 + 0.12 * n(x * 0.04, y * 0.04));
            c = Math.abs(x) > 89 || y < -43 || y > 41 ? [150, 120, 64] : [92 * k, 110 * k, 72 * k];
          }
          return c;
        },
        lights: (dim, t) => {
          const fl = 1 + 0.05 * Math.sin(t * 13) + 0.03 * Math.sin(t * 29);
          return [L([cand[0], cand[1], 30], [255, 196, 120], 2.4 * dim * fl, 320, 4, 1.15), L([cens[0], cens[1], 10], [255, 130, 60], 1.2 * (0.6 + 0.4 * dim), 150, 3, 1.3)];
        },
        props(S, t, dim) {
          cyl(S, [cens[0], cens[1], 0], 9, 7, [70, 66, 60], [30, 18, 14], -1, 0.6 + 0.4 * dim);
          const p = S.cam.p([cens[0], cens[1], 7]);
          for (let i = 0; i < 7; i++) S.put(p[0] - 5 + i * 1.6, p[1] + (i % 2) * 0.5, [255, 140 + 20 * ((i + Math.floor(t * 6)) % 3), 50]);
        },
        after(S, t, dim, gut) {
          cyl(S, [cand[0], cand[1], 0], 5, 22, [232, 220, 190], [250, 240, 214], 1, 0.55 + 0.45 * dim);
          const p = S.cam.p([cand[0], cand[1], 22]);
          flame(S, p[0], p[1] - 1, 1.1, t, gut);
          S.bloom(p[0], p[1] - 4, 26, [90, 60, 24], 0.7 * dim);
          smoke(S, plume(cens[0], cens[1], 8, 20, 1, t), cand[0], 0.7 + 0.3 * dim);
        },
      };
    },
    velvet: () => {
      const n = vnoise(5), lamp = [-88, 62, 48];
      return {
        cam: cam({ dist: 430, target: [0, 8, 0], cy: 72 }), amb: [30, 22, 22], edge: [236, 186, 70],
        surface(x, y) {
          const pl = Math.floor((y + 300) / 12), py = (y + 300) % 12;
          let f = 0.74 + n(x * 0.05 + pl * 37.3, py * 0.4) * 0.4 + ((pl * 5) % 3) * 0.035;
          if (py < 0.9) f *= 0.5;
          let c = [74 * f, 44 * f, 26 * f];
          if (Math.abs(x) < 94 && y > -48 && y < 46) {
            const v = 0.82 + 0.18 * n(x * 0.08, y * 0.08) + 0.06 * ((Math.floor(x * 0.7) + Math.floor(y * 0.7)) & 1);
            c = Math.abs(Math.abs(x) - 90) < 1.6 || Math.abs(y + 44) < 1.6 || Math.abs(y - 42) < 1.6 ? [214, 168, 70] : [128 * v, 26 * v, 34 * v];
          } else if (Math.abs(x) < 94 && y > -52 && y <= -48 && Math.floor(x) % 3 !== 0) c = [190, 146, 60];
          return c;
        },
        lights: (dim, t) => [L(lamp, [255, 214, 150], 2.5 * dim * (1 + 0.03 * Math.sin(t * 11)), 270, 5, 1.1)],
        props() {},
        after(S, t, dim, gut) {
          const k = 0.5 + 0.5 * dim;
          cyl(S, [lamp[0], lamp[1], 0], 9, 4, [150, 110, 40], [200, 160, 70], 1, k);
          cyl(S, [lamp[0], lamp[1], 4], 6, 12, [196, 150, 56], [230, 190, 90], 1, k);
          cyl(S, [lamp[0], lamp[1], 16], 4, 14, [240, 210, 160], [255, 236, 200], 1, 0.4 + 0.6 * dim);
          const q = S.cam.p([lamp[0], lamp[1], 30]);
          flame(S, q[0], q[1] + 1, 1.0, t, gut);
          S.bloom(q[0], q[1] - 3, 34, [90, 64, 30], 0.8 * dim);
        },
      };
    },
    linen: () => {
      const n = vnoise(3), lamp = [0, 120, 46], sticks = [[-96, 64], [96, 64]];
      return {
        cam: cam({ dist: 440, target: [0, 10, 0], cy: 70 }), amb: [26, 22, 28], edge: [150, 200, 190],
        surface(x, y) {
          const weave = 0.93 + 0.07 * ((Math.floor(x * 1.2) + Math.floor(y * 1.2)) & 1), fold = 0.94 + 0.06 * n(x * 0.03, y * 0.02);
          if ((Math.abs(Math.abs(x) - 100) < 2 && y > -56) || (Math.abs(y + 56) < 2 && Math.abs(x) < 100)) return [176, 130, 60];
          if (y < -56 && y > -61 && Math.abs(x) < 100 && (Math.floor(x * 0.5) + Math.floor(y * 0.5)) % 3 !== 0) return [236, 228, 210];
          if (Math.abs(x) > 100 || y < -56) { const k = 0.8 + 0.25 * n(x * 0.05, Math.floor(y / 11) * 3.1); return [66 * k, 42 * k, 28 * k]; }
          const k = weave * fold;
          return [224 * k, 214 * k, 192 * k];
        },
        lights: (dim, t) => {
          const fl = 1 + 0.04 * Math.sin(t * 12);
          return [L(lamp, [255, 222, 168], 2.2 * dim * fl, 420, 4, 1.0)].concat(sticks.map(([x, y]) => L([x, y, 34], [255, 200, 130], 0.9 * dim * fl, 200, 3, 1.2, true)));
        },
        props() {},
        after(S, t, dim, gut) {
          for (const [x, y] of sticks) {
            cyl(S, [x, y, 0], 6, 3, [170, 128, 50], [210, 170, 80], 1, 0.5 + 0.5 * dim);
            cyl(S, [x, y, 3], 3, 26, [238, 228, 204], [250, 244, 226], x < 0 ? 1 : -1, 0.5 + 0.5 * dim);
            const q = S.cam.p([x, y, 29]);
            flame(S, q[0], q[1], 0.9, t + x, gut);
            S.bloom(q[0], q[1] - 3, 20, [80, 56, 26], 0.5 * dim);
          }
          S.bloom(W / 2, -16, 80, [60, 44, 24], 0.45 * dim);
        },
      };
    },
    // a reading at camp: a plaid cloak spread on the ground, the fire just off the near corner, night over the trees
    camp: () => {
      const n = vnoise(21), fire = [-80, -50], pot = [-50, -58], mug = [72, -52];
      const cloak = (x, y) => Math.abs(x) < 80 + 3 * (n(y * 0.1, 3) - 0.5) && y > -44 + 2 * (n(x * 0.1, 7) - 0.5) && y < 46 + 2 * (n(x * 0.1, 11) - 0.5)
        && Math.hypot(x - fire[0], y - fire[1]) > 20;
      return {
        cam: cam({ dist: 430, target: [0, 8, 0], cy: 72 }), amb: [24, 24, 40], edge: [226, 212, 180],
        fill: L([40, 400, 260], [130, 150, 210], 0.55, 900, 40, 1.0, true),
        surface(x, y) {
          const g = n(x * 0.07, y * 0.07), g2 = n(x * 0.31 + 50, y * 0.31), g3 = n(x * 0.9, y * 0.9 + 20);
          const k = 0.7 + 0.4 * g2;
          let c = [74 * k, 56 * k, 40 * k];
          if (g > 0.52 && g3 > 0.45) c = g3 > 0.75 ? [96, 112, 52] : [58 * k, 76 * k, 38 * k];
          const cx = Math.floor(x / 9), cy = Math.floor(y / 9), hsh = ((cx * 73856093) ^ (cy * 19349663)) >>> 0;
          if (hsh % 7 === 0 && Math.hypot(x - cx * 9 - 4.5, (y - cy * 9 - 4.5) * 1.3) < 2.2) c = [120 + (hsh % 30), 116 + (hsh % 30), 104 + (hsh % 24)];
          else if (hsh % 23 === 1 && Math.hypot(x - cx * 9 - 4, y - cy * 9 - 5) < 1.8) c = [168, 104, 38];
          const fr = Math.hypot(x - fire[0], (y - fire[1]) * 1.1);
          if (fr < 14) return fr > 10.5 ? (Math.floor(Math.atan2(y - fire[1], x - fire[0]) * 4) % 2 ? [70, 66, 60] : [50, 48, 44]) : [30 + 14 * g3, 22 + 8 * g3, 18];
          if (cloak(x, y)) {
            const sx = ((Math.floor(x) % 16) + 16) % 16, sy = ((Math.floor(y) % 16) + 16) % 16, f = 0.84 + 0.22 * n(x * 0.03, y * 0.05);
            const st = (sx < 2 ? 1 : 0) + (sy < 2 ? 1 : 0), thin = sx === 8 || sy === 8;
            let col = st === 2 ? [78, 52, 42] : st === 1 ? [84, 62, 46] : thin ? [86, 88, 62] : [62, 74, 56];
            if (!cloak(x + 2.5, y) || !cloak(x - 2.5, y) || !cloak(x, y + 2.5) || !cloak(x, y - 2.5)) col = (Math.floor(x + y) & 1) ? [120, 96, 60] : [70, 56, 40];
            const w = 0.94 + 0.06 * ((Math.floor(x * 1.3) + Math.floor(y * 1.3)) & 1);
            return [col[0] * f * w, col[1] * f * w, col[2] * f * w];
          }
          return c;
        },
        lights: (dim, t) => {
          const fl = 1 + 0.1 * Math.sin(t * 9.3) + 0.06 * Math.sin(t * 23.1) + 0.04 * Math.sin(t * 41);
          return [L([fire[0], fire[1], 22], [255, 156, 72], 3.4 * dim * fl, 470, 7, 0.85), L([fire[0] + 6, fire[1] + 4, 6], [255, 96, 40], 1.0 * dim * fl, 110, 3, 1.4)];
        },
        props(S, t, dim) {
          cyl(S, [pot[0], pot[1], 0], 7, 8, [52, 50, 50], [26, 24, 24], 1, 0.6 + 0.4 * dim);
          cyl(S, [mug[0], mug[1], 0], 4, 7, [122, 88, 54], [60, 40, 26], 1, 0.6 + 0.4 * dim);
        },
        after(S, t, dim, gut) { campfire(S, fire, t, dim, gut); sky(S, t, n); },
      };
    },
  };

  // ---------- props ----------
  function cyl(S, b, r, h, col, top, lightx, k) {
    const n = 28;
    for (let kk = 0; kk <= h * 2; kk++) {
      const z = b[2] + kk * 0.5, cx = S.cam.p([b[0], b[1], z]);
      for (let i = 0; i < n; i++) {
        const a = i * 2 * Math.PI / n, q = S.cam.p([b[0] + r * Math.cos(a), b[1] + r * Math.sin(a), z]);
        if (q[1] < cx[1] - 0.2) continue;
        const f = (0.45 + 0.6 * Math.max(0, -Math.cos(a) * lightx) + 0.1 * Math.sin(a)) * k;
        S.put(q[0], q[1], [col[0] * f, col[1] * f, col[2] * f]);
      }
      if (kk === Math.floor(h * 2)) {
        const rr = r * S.cam.scale([b[0], b[1], z]), ry = rr * 0.36;
        for (let y = Math.floor(cx[1] - ry - 1); y <= cx[1] + ry + 1; y++) for (let x = Math.floor(cx[0] - rr - 1); x <= cx[0] + rr + 1; x++) {
          if (((x + 0.5 - cx[0]) / rr) ** 2 + ((y + 0.5 - cx[1]) / ry) ** 2 <= 1) S.put(x, y, [top[0] * k, top[1] * k, top[2] * k]);
        }
      }
    }
  }
  function flame(S, x, y, k, t, gut) {
    k *= 1 - 0.5 * gut;
    const sway = Math.sin(t * 9) * 0.5 + Math.sin(t * 23) * 0.3 * (1 + 3 * gut), n = Math.max(2, Math.floor(7 * k));
    for (let j = 0; j < n; j++) {
      const w = (1 - j / n) * 1.6 * k, sx = x + sway * j / 6;
      for (let i = -Math.floor(w); i <= w; i++) {
        const hot = j < 3 * k && Math.abs(i) < w * 0.5;
        let c = hot ? [255, 250, 210] : j < 5 * k ? [255, 190, 70] : [240, 110, 40];
        if (gut > 0.3 && !hot) c = [c[0] * 0.8, c[1] * 0.6, c[2] * 0.6 + 40];
        S.put(sx + i, y - j, c);
      }
    }
  }
  // the campfire in the near corner: crossed logs, a bed of embers, tongues of flame and sparks going up into the dark
  function campfire(S, at, t, dim, gut) {
    const c = S.cam.p([at[0], at[1], 2]), sc = S.cam.scale([at[0], at[1], 2]);
    for (const [dx, dy, len, a] of [[-6, 1, 15, 0.35], [5, 2, 14, -0.4], [0, -2, 13, 1.45]]) {
      for (let i = -len / 2; i <= len / 2; i += 0.5) for (let w = -1.5; w <= 1.5; w += 0.5) {
        const x = c[0] + (dx + Math.cos(a) * i - Math.sin(a) * w * 0.4) * sc, y = c[1] + (dy * 0.4 + Math.sin(a) * i * 0.4 + Math.cos(a) * w) * sc;
        const lit = 0.55 + 0.45 * Math.max(0, -w / 1.5);
        S.put(x, y, Math.abs(i) > len / 2 - 1.2 ? [196 * lit, 120 * lit, 60 * lit] : [70 * lit, 44 * lit, 30 * lit]);
      }
    }
    const r = rng(77);
    for (let i = 0; i < 26; i++) {
      const ex = c[0] + (r() - 0.5) * 18 * sc, ey = c[1] + (r() - 0.5) * 6 * sc, glow = 0.6 + 0.4 * Math.sin(t * (3 + r() * 4) + i);
      S.put(ex, ey, [255 * glow, 120 * glow * glow, 30]);
    }
    const k = (1 - 0.35 * gut) * (0.85 + 0.15 * dim);
    S.bloom(c[0], c[1] - 10, 54, [100, 52, 18], 0.6 * k);
    for (let j = 0; j < 5; j++) {
      const ph = t * (5 + j) + j * 1.7, hgt = (20 - 3 * Math.abs(j - 2) + 5 * Math.sin(ph) + 3 * Math.sin(ph * 2.3)) * k * sc, x0 = c[0] + (j - 2) * 3.6 * sc;
      for (let y = 0; y < hgt; y++) {
        const f = y / hgt, wd = (1 - f) * (4.4 - Math.abs(j - 2) * 0.7) * sc, sway = Math.sin(t * 7 + j + y * 0.25) * f * 2.6;
        for (let x = -wd; x <= wd; x++) {
          const hot = f < 0.35 && Math.abs(x) < wd * 0.45, rim = Math.abs(x) > wd - 1;
          S.put(x0 + x + sway, c[1] - 1 - y, hot ? [255, 246, 200] : rim ? [190, 54, 22] : f < 0.6 ? [255, 176, 60] : [232, 92, 34], f > 0.8 ? 0.6 : 1);
        }
      }
    }
    for (let i = 0; i < 9; i++) {
      const life = (t * 0.6 + i * 0.137) % 1, sx = c[0] + Math.sin(i * 2.1 + t * 1.3) * 6 * sc + (i - 4) * 1.5, sy = c[1] - 8 * sc - life * 60;
      if (sy > 0) S.put(sx, sy, [255, 200 - 120 * life, 80 - 60 * life], 1 - life);
    }
  }
  // the night over the far side of the camp: a band of sky with stars above a ragged line of pines
  function sky(S, t, n) {
    for (let x = 0; x < W; x++) {
      const tree = 12 + Math.floor(5 * n(x * 0.09, 40) + 4 * Math.abs(((x * 0.37) % 2) - 1) * n(x * 0.3, 41));
      for (let y = 0; y < tree + 6; y++) {
        const i = y * W + x;
        if (S.id[i] >= 0) continue;
        if (y >= tree) {
          const a = (y - tree + 1) / 7;
          S.c[i * 3] *= a; S.c[i * 3 + 1] *= a; S.c[i * 3 + 2] *= a;
          continue;
        }
        const top = y / tree;
        let c = [10 + 14 * top, 14 + 18 * top, 34 + 22 * top];
        if (y > tree - 3 - ((x * 7) % 3)) c = [8, 12, 12];
        const h = ((x * 374761393) ^ (y * 668265263)) >>> 0;
        if (h % 61 === 0 && y < tree - 4) { const tw = 0.6 + 0.4 * Math.sin(t * 2 + (h % 13)); c = [200 * tw, 210 * tw, 230 * tw]; }
        S.c[i * 3] = c[0]; S.c[i * 3 + 1] = c[1]; S.c[i * 3 + 2] = c[2];
      }
    }
  }
  function plume(x0, y0, z0, n, seed, t) {
    const r = rng(seed * 7919), out = [];
    for (let i = 0; i < n; i++) {
      const f = i / n;
      out.push([x0 - 0.4 * i * 2.2 + Math.sin(i * 0.55 + seed + t * 1.3) * 6 * f * 0.8 + (r() - 0.5) * 3, y0, z0 + 1.6 * i * 1.4 + (t * 8) % 2.8, 3 + f * 9 * 0.8, 0.4 * Math.pow(1 - f, 0.8)]);
    }
    return out;
  }
  function smoke(S, puffs, lx, dim) {
    puffs.sort((a, b) => S.cam.p([b[0], b[1], b[2]])[2] - S.cam.p([a[0], a[1], a[2]])[2]);
    for (const [x, y, z, r, a] of puffs) {
      const p = S.cam.p([x, y, z]), rr = r * S.cam.scale([x, y, z]), side = clamp(0.75 - (x - lx) / 200, 0, 1);
      const col = [(150 * (1 - side) + 255 * side) * dim, (160 * (1 - side) + 196 * side) * dim, (150 * (1 - side) + 130 * side) * dim];
      S.dot(p[0], p[1], rr * 1.3, rr, col, a * 0.8, 6);
    }
  }

  // ---------- the scene: float RGB, a card id per pixel, lit planes and cards with cast shadows and light through glass ----------
  function Scene(c, lights, amb) {
    this.cam = c; this.lights = lights; this.amb = amb.map((v) => v / 255);
    this.c = new Float32Array(W * H * 3); this.id = new Int8Array(W * H).fill(-1); this.cards = [];
  }
  Scene.prototype.put = function (x, y, col, a) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    if (a === undefined || a >= 1) { this.c[i] = col[0]; this.c[i + 1] = col[1]; this.c[i + 2] = col[2]; return; }
    for (let k = 0; k < 3; k++) this.c[i + k] = this.c[i + k] * (1 - a) + col[k] * a;
  };
  Scene.prototype.dot = function (x, y, rx, ry, col, a, levels) {
    for (let py = Math.max(0, Math.floor(y - ry - 1)); py < Math.min(H, y + ry + 2); py++) for (let px = Math.max(0, Math.floor(x - rx - 1)); px < Math.min(W, x + rx + 2); px++) {
      const d = Math.hypot((px + 0.5 - x) / rx, (py + 0.5 - y) / ry), k = Math.floor(Math.pow(clamp(1 - d, 0, 1), 1.2) * a * levels + bay(px, py)) / levels;
      if (k > 0) this.put(px, py, col, k);
    }
  };
  Scene.prototype.bloom = function (x, y, r, col, a) {
    const y0 = Math.max(0, Math.floor(y - r / 1.1) - 1), y1 = Math.min(H, Math.ceil(y + r / 1.1) + 1), x0 = Math.max(0, Math.floor(x - r) - 1), x1 = Math.min(W, Math.ceil(x + r) + 1);
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      const d = Math.hypot(px + 0.5 - x, (py + 0.5 - y) * 1.1) / r;
      if (d >= 1) continue;
      const k = Math.floor(Math.pow(1 - d, 1.6) * a * 5 + bay(px, py)) / 5, i = (py * W + px) * 3;
      this.c[i] += k * col[0]; this.c[i + 1] += k * col[1]; this.c[i + 2] += k * col[2];
    }
  };
  Scene.prototype.quant = function (col, x, y, lv) {
    const m = Math.max(col[0], col[1], col[2]);
    if (m <= 0) return col;
    const mq = Math.floor(m / 255 * lv + bay(x, y)) / lv * 255, k = mq / m;
    return [col[0] * k, col[1] * k, col[2] * k];
  };
  // transmit and illum run for every lit pixel of every frame: the arithmetic is the vector helpers' own, written out so nothing is allocated
  const TR = [1, 1, 1];
  Scene.prototype.transmit = function (P, Lp, skip) {
    let T0 = 1, T1 = 1, T2 = 1;
    const P0 = P[0], P1 = P[1], P2 = P[2], D0 = Lp[0] - P0, D1 = Lp[1] - P1, D2 = Lp[2] - P2;
    for (const cd of this.cards) {
      if (cd === skip) continue;
      const n = cd.n, den = D0 * n[0] + D1 * n[1] + D2 * n[2];
      if (Math.abs(den) < 1e-9) continue;
      // a cheap miss first: the card's bounding sphere against the segment to the lamp
      const c = cd.c, cp0 = c[0] - P0, cp1 = c[1] - P1, cp2 = c[2] - P2, dd = D0 * D0 + D1 * D1 + D2 * D2;
      const s0 = clamp((cp0 * D0 + cp1 * D1 + cp2 * D2) / dd, 0, 1);
      const qx = cp0 - D0 * s0, qy = cp1 - D1 * s0, qz = cp2 - D2 * s0;
      if (qx * qx + qy * qy + qz * qz > cd.r2) continue;
      const t = (cp0 * n[0] + cp1 * n[1] + cp2 * n[2]) / den;
      if (!(t > 1e-3 && t < 1)) continue;
      const R = cd.R, d0 = P0 + D0 * t - c[0], d1 = P1 + D1 * t - c[1], d2 = P2 + D2 * t - c[2];
      const l0 = d0 * R[0][0] + d1 * R[1][0] + d2 * R[2][0], l1 = d0 * R[0][1] + d1 * R[1][1] + d2 * R[2][1];
      if (Math.abs(l0) >= cd.w / 2 + cd.th * 0.5 || Math.abs(l1) >= cd.h / 2 + cd.th * 0.5) continue;
      if (cd.kind !== "glass") { TR[0] = TR[1] = TR[2] = 0; return TR; }
      const g = cd.glassAt(l0, l1);
      T0 *= g[0]; T1 *= g[1]; T2 *= g[2];
    }
    TR[0] = T0; TR[1] = T1; TR[2] = T2;
    return TR;
  };
  const LS = [0, 0, 0];
  Scene.prototype.illum = function (P, n, alb, skip, spec, shin, soft) {
    const out = [alb[0] * this.amb[0], alb[1] * this.amb[1], alb[2] * this.amb[2]];
    const P0 = P[0], P1 = P[1], P2 = P[2], n0 = n[0], n1 = n[1], n2 = n[2], cp = this.cam.pos;
    let V0 = cp[0] - P0, V1 = cp[1] - P1, V2 = cp[2] - P2;
    const vl = Math.hypot(V0, V1, V2) || 1;
    V0 /= vl; V1 /= vl; V2 /= vl;
    for (const Lt of this.lights) {
      const D0 = Lt.pos[0] - P0, D1 = Lt.pos[1] - P1, D2 = Lt.pos[2] - P2, d = Math.hypot(D0, D1, D2), l0 = D0 / d, l1 = D1 / d, l2 = D2 / d;
      const lam = Math.max(0, l0 * n0 + l1 * n1 + l2 * n2), fall = Math.pow(clamp(1 - d / Lt.r, 0, 1), Lt.p);
      if (fall <= 0 || (lam <= 0 && !spec)) continue;
      let v0 = 0, v1 = 0, v2 = 0;
      // the fill is broad and far: it lights without casting
      if (Lt.fill) { v0 = v1 = v2 = soft; } else for (let k = 0; k < soft; k++) {
        const rr = soft <= 1 ? 0 : Lt.size * Math.sqrt((k + 0.5) / soft), a = k * 2.4;
        LS[0] = Lt.pos[0] + Math.cos(a) * rr; LS[1] = Lt.pos[1] + Math.sin(a) * rr; LS[2] = Lt.pos[2];
        const T = this.transmit(P, LS, skip);
        v0 += T[0]; v1 += T[1]; v2 += T[2];
      }
      const kk = lam * fall * Lt.i / soft, col = Lt.col;
      out[0] += alb[0] * col[0] * kk * v0; out[1] += alb[1] * col[1] * kk * v1; out[2] += alb[2] * col[2] * kk * v2;
      if (spec) {
        let H0 = l0 + V0, H1 = l1 + V1, H2 = l2 + V2;
        const hl = Math.hypot(H0, H1, H2) || 1;
        H0 /= hl; H1 /= hl; H2 /= hl;
        const s = Math.pow(Math.max(0, H0 * n0 + H1 * n1 + H2 * n2), shin) * spec * fall * Lt.i / soft;
        out[0] += s * col[0] * 255 * v0; out[1] += s * col[1] * 255 * v1; out[2] += s * col[2] * 255 * v2;
      }
    }
    return out;
  };
  const ALB = {};
  // the cloth and the table under it never move: their colours and world positions are worked out once per table, and so is how
  // much of each lamp reaches each pixel (lam x fall); a frame only multiplies in the lamps' flicker and the cards' shadows
  function albedo(name, tb, lights) {
    if (!ALB[name]) {
      const P = new Float32Array(W * H * 2), A = new Float32Array(W * H * 3);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = tb.cam.onZ(x + 0.5, y + 0.5, 0), i = y * W + x, c = tb.surface(p[0], p[1]);
        P[i * 2] = p[0]; P[i * 2 + 1] = p[1]; A[i * 3] = c[0]; A[i * 3 + 1] = c[1]; A[i * 3 + 2] = c[2];
      }
      const LF = lights.map((Lt) => {
        const out = new Float64Array(W * H);
        for (let i = 0; i < W * H; i++) {
          const p = [P[i * 2], P[i * 2 + 1], 0], D = sub(Lt.pos, p), d = Math.hypot(D[0], D[1], D[2]), l = [D[0] / d, D[1] / d, D[2] / d];
          const lam = Math.max(0, dot(l, [0, 0, 1])), fall = Math.pow(clamp(1 - d / Lt.r, 0, 1), Lt.p);
          out[i] = fall <= 0 || lam <= 0 ? -1 : lam * fall;
        }
        return out;
      });
      ALB[name] = { P, A, LF };
    }
    return ALB[name];
  }
  // where a card can shade the cloth from one point of a lamp: the box round its corners thrown onto the table (transmit's own
  // hit rectangle, so nothing it would catch falls outside), or null when a corner is level with the lamp or above it
  function footprint(cd, Lp) {
    const hw = cd.w / 2 + cd.th * 0.5, hh = cd.h / 2 + cd.th * 0.5, R = cd.R, Lz = Lp[2];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [u, v] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
      const qx = cd.c[0] + R[0][0] * u + R[0][1] * v, qy = cd.c[1] + R[1][0] * u + R[1][1] * v, qz = cd.c[2] + R[2][0] * u + R[2][1] * v;
      if (qz >= Lz - 1e-3) return null;
      const k = Lz / (Lz - qz), x = Lp[0] + (qx - Lp[0]) * k, y = Lp[1] + (qy - Lp[1]) * k;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return [x0 - 1, y0 - 1, x1 + 1, y1 + 1];
  }
  Scene.prototype.plane = function* (name, tb) {
    const { P, A, LF } = albedo(name, tb, this.lights), lights = this.lights, amb = this.amb, soft = 2;
    const samples = lights.map((Lt) => (Lt.fill ? null : [0, 1].map((k) => {
      const rr = Lt.size * Math.sqrt((k + 0.5) / soft), a = k * 2.4, Lp = [Lt.pos[0] + Math.cos(a) * rr, Lt.pos[1] + Math.sin(a) * rr, Lt.pos[2]];
      const fp = this.cards.map((cd) => footprint(cd, Lp));
      return { Lp, fp, any: fp.some((f) => f === null) };
    })));
    const p = [0, 0, 0];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (x === 0 && y % 8 === 0) yield;
      const i = y * W + x, px = P[i * 2], py = P[i * 2 + 1], a0 = A[i * 3], a1 = A[i * 3 + 1], a2 = A[i * 3 + 2];
      let o0 = a0 * amb[0], o1 = a1 * amb[1], o2 = a2 * amb[2];
      for (let li = 0; li < lights.length; li++) {
        const lf = LF[li][i];
        if (lf < 0) continue;
        const Lt = lights[li];
        let v0, v1, v2;
        if (Lt.fill) { v0 = v1 = v2 = soft; } else {
          v0 = v1 = v2 = 0;
          for (const sm of samples[li]) {
            let hit = sm.any;
            for (let c = 0; !hit && c < sm.fp.length; c++) { const f = sm.fp[c]; hit = px >= f[0] && px <= f[2] && py >= f[1] && py <= f[3]; }
            if (!hit) { v0 += 1; v1 += 1; v2 += 1; continue; }
            p[0] = px; p[1] = py;
            const T = this.transmit(p, sm.Lp, null);
            v0 += T[0]; v1 += T[1]; v2 += T[2];
          }
        }
        const kk = lf * Lt.i / soft;
        o0 += a0 * Lt.col[0] * kk * v0; o1 += a1 * Lt.col[1] * kk * v1; o2 += a2 * Lt.col[2] * kk * v2;
      }
      const c = this.quant([o0, o1, o2], x, y, 10);
      this.c[i * 3] = c[0]; this.c[i * 3 + 1] = c[1]; this.c[i * 3 + 2] = c[2];
    }
    return P;
  };
  // fill a projected quad, handing each pixel's ray-plane hit to fn
  Scene.prototype.quad = function (corners, cd, fn) {
    const sp = corners.map((q) => this.cam.p(q));
    let y0 = Infinity, y1 = -Infinity;
    for (const p of sp) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const nq = norm(cross3(sub(corners[1], corners[0]), sub(corners[3], corners[0])));
    for (let y = Math.max(0, Math.ceil(y0 - 0.5)); y <= Math.min(H - 1, Math.floor(y1 - 0.5)); y++) {
      const cy = y + 0.5, xs = [];
      for (let i = 0; i < 4; i++) {
        const a = sp[i], b = sp[(i + 1) % 4];
        if ((a[1] <= cy && b[1] > cy) || (b[1] <= cy && a[1] > cy)) xs.push(a[0] + (cy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(W - 1, Math.floor(xs[k + 1] - 0.5)); x++) {
        const D = this.cam.ray(x + 0.5, cy), den = dot(D, nq);
        if (Math.abs(den) < 1e-9) continue;
        const s = dot(sub(corners[0], this.cam.pos), nq) / den, X = [this.cam.pos[0] + D[0] * s, this.cam.pos[1] + D[1] * s, this.cam.pos[2] + D[2] * s];
        const col = fn(X, x, y);
        if (!col) continue;
        const i = y * W + x;
        this.c[i * 3] = col[0]; this.c[i * 3 + 1] = col[1]; this.c[i * 3 + 2] = col[2];
        this.id[i] = cd.ident;
      }
    }
  };
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  function Card(o) {
    Object.assign(this, o);
    this.n = [this.R[0][2], this.R[1][2], this.R[2][2]];
    this.r2 = ((this.w / 2 + this.th) ** 2 + (this.h / 2 + this.th) ** 2 + this.th * this.th) * 1.05;
  }
  Card.prototype.local = function (P) {
    const d = sub(P, this.c), R = this.R;
    return [d[0] * R[0][0] + d[1] * R[1][0] + d[2] * R[2][0], d[0] * R[0][1] + d[1] * R[1][1] + d[2] * R[2][1], d[0] * R[0][2] + d[1] * R[1][2] + d[2] * R[2][2]];
  };
  Card.prototype.texel = function (tex, u, v) {
    const ix = clamp(Math.floor(u * this.tw), 0, this.tw - 1), iy = clamp(Math.floor(v * this.th_), 0, this.th_ - 1), i = (iy * this.tw + ix) * 4;
    return [tex[i], tex[i + 1], tex[i + 2], tex[i + 3]];
  };
  Card.prototype.glassAt = function (lx, ly) {
    let u = lx / this.w + 0.5;
    const v = 0.5 - ly / this.h;
    if (!this.faceCam) u = 1 - u;
    const t = this.texel(this.faceCam ? this.face : this.back, u, v);
    if (t[3] < 255) return [0.04, 0.04, 0.04];
    return [0, 1, 2].map((j) => Math.pow(clamp(t[j] / 255 * 1.6, 0, 1), 1.2));
  };

  function drawCard(S, cd) {
    const toCam = sub(S.cam.pos, cd.c), up = dot(toCam, cd.n) > 0;
    cd.faceCam = up;
    const R = cd.R, hw = cd.w / 2, hh = cd.h / 2, ht = cd.th / 2;
    const C = (x, y, z) => [cd.c[0] + R[0][0] * x + R[0][1] * y + R[0][2] * z, cd.c[1] + R[1][0] * x + R[1][1] * y + R[1][2] * z, cd.c[2] + R[2][0] * x + R[2][1] * y + R[2][2] * z];
    for (const [ax, sg] of [[0, 1], [0, -1], [1, 1], [1, -1]]) {
      const n = ax === 0 ? [R[0][0] * sg, R[1][0] * sg, R[2][0] * sg] : [R[0][1] * sg, R[1][1] * sg, R[2][1] * sg];
      const ctr = [cd.c[0] + n[0] * (ax === 0 ? hw : hh), cd.c[1] + n[1] * (ax === 0 ? hw : hh), cd.c[2] + n[2] * (ax === 0 ? hw : hh)];
      if (dot(sub(S.cam.pos, ctr), n) <= 0) continue;
      const q = ax === 0 ? [C(sg * hw, hh, ht), C(sg * hw, hh, -ht), C(sg * hw, -hh, -ht), C(sg * hw, -hh, ht)] : [C(-hw, sg * hh, ht), C(hw, sg * hh, ht), C(hw, sg * hh, -ht), C(-hw, sg * hh, -ht)];
      S.quad(q, cd, (X, x, y) => {
        let alb = cd.edge;
        if (cd.stack) { const z = cd.local(X)[2]; alb = Math.floor((z + 20) * 1.2) % 2 === 0 ? alb : alb.map((v) => v * 0.72); }
        if (cd.kind === "glass") return alb.map((v, j) => clamp(v * 0.55 + S.lights.filter((l) => !l.fill).reduce((s, l) => s + v * l.col[j] * 160 * l.i / 255, 0), 0, 255));
        return S.quant(S.illum(X, n, alb, cd, cd.spec, 24, 1), x, y, 10);
      });
    }
    const z = up ? ht : -ht, n = up ? cd.n : cd.n.map((v) => -v), tex = up ? cd.face : cd.back;
    const q = up ? [C(-hw, hh, z), C(hw, hh, z), C(hw, -hh, z), C(-hw, -hh, z)] : [C(hw, hh, z), C(-hw, hh, z), C(-hw, -hh, z), C(hw, -hh, z)];
    S.quad(q, cd, (X, x, y) => {
      const l = cd.local(X), u = up ? (l[0] + hw) / cd.w : (hw - l[0]) / cd.w, v = (hh - l[1]) / cd.h, px = cd.texel(tex, u, v);
      if (px[3] <= 100) return null;
      if (cd.kind === "glass") return glassFace(S, cd, X, n, px, u, v, x, y);
      let col = S.illum(X, n, [px[0], px[1], px[2]], cd, cd.spec, 70, 2);
      return S.quant(col, x, y, 10);
    });
  }
  function glassFace(S, cd, P, n, px, u, v, x, y) {
    const a = [px[0] / 255, px[1] / 255, px[2] / 255], tot = [0, 0, 0], V = norm(sub(S.cam.pos, P));
    const lead = px[3] < 255, leadhi = px[3] === 253;
    for (const Lt of S.lights) {
      if (Lt.fill) continue;
      const D = sub(Lt.pos, P), d = Math.hypot(D[0], D[1], D[2]), l = [D[0] / d, D[1] / d, D[2] / d];
      const back = Math.max(0, -dot(l, n)), fall = Math.pow(clamp(1 - d / Lt.r, 0, 1), Lt.p * 0.5);
      const trans = (0.3 + 0.8 * back) * fall * Lt.i * 0.75, front = Math.max(0, dot(l, n)) * fall * Lt.i * (cd.cloth || 0);
      const Hh = norm([l[0] + V[0], l[1] + V[1], l[2] + V[2]]), s = Math.pow(Math.max(0, dot(Hh, n)), 40) * 220 * Lt.i;
      for (let j = 0; j < 3; j++) tot[j] += a[j] * 255 * Lt.col[j] * trans * 1.25 + Math.pow(a[j], 1.3) * 255 * Lt.col[j] * front + s;
    }
    for (let j = 0; j < 3; j++) tot[j] += a[j] * 255 * 0.12;
    if (cd.sheen !== undefined) {
      const band = (u * 0.55 + v) - cd.sheen, k = Math.exp(-band * band / 0.0025) * 110 + Math.exp(-((band - 0.09) ** 2) / 0.0006) * 60;
      for (let j = 0; j < 3; j++) tot[j] += k;
    }
    if (lead) {
      let lc = 0;
      for (const Lt of S.lights) { const l = norm(sub(Lt.pos, P)); lc += (0.25 + 0.75 * Math.max(0, dot(l, n))) * Lt.i; }
      const m = [46, 42, 44].map((v) => v * (0.6 + 0.6 * lc / 3));
      return leadhi ? m.map((v) => clamp(v * 2.4 + 30, 0, 255)) : m;
    }
    return S.quant(tot.map((v) => clamp(v, 0, 255)), x, y, 24);
  }

  // ---------- the title on a card ----------
  // At 192x144 a 56x92 card is drawn at about 0.77 to 1, and nearest sampling drops strokes from 3-pixel letters ("PAGE" read "FAGE").
  // Once a card lies face up, its title band is copied from the card art one texel to a pixel, in the light the card is already in.
  // A band is [first row, last row, first column, last column] of the title in a deck's art.
  const BANDS = { witch: [78, 82, 8, 48], glass: [80, 84, 6, 50], deepwood: [80, 84, 9, 47], gooddog: [80, 84, 12, 45], frost: [80, 84, 9, 47],
    goblin: [74, 87, 8, 48], sailor: [79, 83, 8, 48], ember: [79, 84, 8, 48] };
  function label(S, p, cd, rec, tex) {
    if (!cd || Math.abs(p.theta) > 0.06 || p.c[2] > 1.5) return;
    const c = rec.cards[p.i], B = BANDS[c.card === "drowned" ? "glass" : rec.deck in BANDS ? rec.deck : "witch"];
    const tw = tex.w, th = tex.h, px = tex.faces[p.i], rev = p.rev;
    const ry0 = rev ? th - 1 - B[1] : B[0], ry1 = rev ? th - 1 - B[0] : B[1], rx0 = rev ? tw - 1 - B[3] : B[2], rx1 = rev ? tw - 1 - B[2] : B[3];
    const at = (x, y) => (y * tw + x) * 4, counts = {};
    let best = 0, bn = 0;
    for (let y = ry0; y <= ry1; y++) for (let x = rx0; x <= rx1; x++) {
      const i = at(x, y), q = (px[i] >> 4) * 256 + (px[i + 1] >> 4) * 16 + (px[i + 2] >> 4), m = (counts[q] = (counts[q] || 0) + 1);
      if (m > bn) { bn = m; best = i; }
    }
    const bg = [px[best], px[best + 1], px[best + 2]], ink = (i) => Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 70;
    let cx0 = rx1, cx1 = rx0;
    for (let x = rx0; x <= rx1; x++) for (let y = ry0; y <= ry1; y++) if (ink(at(x, y))) { cx0 = Math.min(cx0, x); cx1 = Math.max(cx1, x); }
    if (cx1 < cx0) return;
    cx0 = Math.max(0, cx0 - 1); cx1 = Math.min(tw - 1, cx1 + 1);
    const y0 = Math.max(0, ry0 - 1), y1 = Math.min(th - 1, ry1 + 1), bw = cx1 - cx0 + 1, bh = y1 - y0 + 1;
    const hw = cd.w / 2, hh = cd.h / 2, R = cd.R, z = cd.th / 2;
    const P = (u, v) => {
      const l0 = u * cd.w - hw, l1 = hh - v * cd.h;
      return S.cam.p([cd.c[0] + R[0][0] * l0 + R[0][1] * l1 + R[0][2] * z, cd.c[1] + R[1][0] * l0 + R[1][1] * l1 + R[1][2] * z, cd.c[2] + R[2][0] * l0 + R[2][1] * l1 + R[2][2] * z]);
    };
    const vm = (y0 + y1 + 1) / 2 / th, mid = P((cx0 + cx1 + 1) / 2 / tw, vm), lft = P(1 / tw, vm), rgt = P(1 - 1 / tw, vm);
    const room = Math.floor(rgt[0] - lft[0]) - 2, skip = Math.max(0, Math.ceil((bw - room) / 2));
    const sx0 = Math.round(mid[0] - bw / 2), sy0 = Math.round(mid[1] - bh / 2), slope = (rgt[1] - lft[1]) / Math.max(1, rgt[0] - lft[0]);
    const spot = (i, j) => {
      const sx = sx0 + i, sy = Math.round(sy0 + j + (sx - mid[0]) * slope);
      return sx < 0 || sy < 0 || sx >= W || sy >= H || S.id[sy * W + sx] !== cd.ident ? -1 : (sy * W + sx) * 3;
    };
    // the light the band is in: the drawn pixels against the art, channel by channel, so the lamp's colour, a gutter and the cold carry over
    const got = [0, 0, 0], src = [0, 0, 0];
    let n = 0;
    for (let j = 0; j < bh; j++) for (let i = skip; i < bw - skip; i++) {
      const k = spot(i, j), t = at(cx0 + i, y0 + j);
      if (k < 0) continue;
      for (let ch = 0; ch < 3; ch++) { got[ch] += S.c[k + ch]; src[ch] += px[t + ch]; }
      n++;
    }
    if (n < bw) return;
    const f = got.map((v, ch) => clamp(v / Math.max(1, src[ch]), 0.12, 2.2));
    for (let j = 0; j < bh; j++) for (let i = skip; i < bw - skip; i++) {
      const k = spot(i, j), t = at(cx0 + i, y0 + j);
      if (k < 0 || px[t + 3] < 100) continue;
      for (let ch = 0; ch < 3; ch++) S.c[k + ch] = clamp(px[t + ch] * f[ch], 0, 255);
    }
  }

  // ---------- the reading's timeline ----------
  const CW = 44, CH = 72.3, TH = 1.0, SLOTS = [-50, 0, 50], DECK = [90, 54];
  const BUDGET = 8;
  const T0 = 0.35, DEAL = 0.55, GAP = 0.4, FLIP = 1.0, SLOW = 0.7, HOLD = 2.4;
  function times(rec) {
    const deals = [0, 1, 2].map((i) => T0 + i * DEAL);
    let t = T0 + 3 * DEAL + GAP;
    const flips = rec.cards.map((c) => { const d = FLIP + (c.rev ? SLOW : 0), f = [t, t + d]; t += d + (c.rev ? 1.1 : 0.25); return f; });
    return { deals, flips, end: t };
  }
  function length(rec) { return times(rec).end; }
  function dread(rec, t) {
    const { flips } = times(rec);
    let v = 0;
    rec.cards.forEach((c, i) => {
      if (!c.rev) return;
      const [a, b] = flips[i], land = a + (b - a) * 0.55;
      // the dread lands hard, then eases to a faint cold so the spread stays readable on the hold (round 31: two reversals went near-black)
      v = Math.max(v, smooth(seg(t, land, land + 0.9)) * (1 - 0.82 * smooth(seg(t, land + 2.2, land + 3.6))));
    });
    return v;
  }
  function poses(rec, t) {
    const { deals, flips } = times(rec), r = rng(hash(rec.id || "r")), yaw = [0, 1, 2].map(() => (r() - 0.5) * 0.12), out = [];
    for (let i = 0; i < 3 && i < rec.cards.length; i++) {
      if (t < deals[i]) continue;
      const u = seg(t, deals[i], deals[i] + DEAL), e = ease(u);
      let x = DECK[0] + (SLOTS[i] - DECK[0]) * e, y = DECK[1] + (-2 - DECK[1]) * e;
      let z = 6.5 * (1 - e) + 0.8 + 16 * Math.sin(Math.PI * u) * (1 - u * 0.3);
      const rz = -0.3 + (yaw[i] + 0.3) * e + 0.25 * Math.sin(Math.PI * u);
      let theta = Math.PI;
      const [a, b] = flips[i], rev = rec.cards[i].rev;
      if (t >= a) {
        const f = seg(t, a, b);
        if (rev) {
          // lifts and turns like the others, then hangs low and comes down too slowly
          const k = seg(f, 0, 0.6);
          theta = Math.PI * (1 - smooth(k));
          z = 0.8 + 14 * Math.pow(Math.sin(Math.PI * Math.min(1, k * 0.85)), 0.8) * (1 - smooth(seg(f, 0.45, 1))) + 3 * (1 - smooth(seg(f, 0.6, 1)));
        } else {
          theta = Math.PI * (1 - smooth(f));
          z = 0.8 + 14 * Math.pow(Math.sin(Math.PI * f), 0.8);
        }
        x = SLOTS[i]; y = -2 + 4 * Math.sin(Math.PI * seg(t, a, b));
      }
      out.push({ i, c: [x, y, z], R: mm(Rz(rz), Ry(theta)), theta, rev });
    }
    return out;
  }
  function events(rec) {
    const { deals, flips } = times(rec), glass = rec.deck === "glass", ev = [];
    deals.forEach((d) => { ev.push([d, "slide", 0.5]); ev.push([d + DEAL * 0.9, "tok", 0.6]); });
    rec.cards.forEach((c, i) => {
      const [a, b] = flips[i];
      ev.push([a, "lift"]);
      ev.push([b - (c.rev ? 0.05 : 0.08), glass ? "clink" : "tok", c.rev ? 0.45 : 0.9]);
      if (c.rev) ev.push([a + (b - a) * 0.55, "dread"]);
    });
    return ev.sort((p, q) => p[0] - q[0]);
  }

  // ---------- one frame ----------
  // drawn in slices so the player can spread a frame over several animation ticks and never hold one up (frame() runs it whole)
  function* frameSteps(rec, t, tex) {
    const tb = (TABLES[rec.table] || TABLES.moss)(), d = dread(rec, t), glass = rec.deck === "glass";
    const dim = 1 - 0.38 * d - 0.1 * d * (0.5 + 0.5 * Math.sin(t * 31));
    const fill = tb.fill ? Object.assign({}, tb.fill, { i: tb.fill.i * (1 - 0.35 * d) }) : L([0, -300, 220], [150, 150, 175], 0.75 * (1 - 0.35 * d), 900, 40, 1.0, true);
    const S = new Scene(tb.cam, tb.lights(dim, t).concat([fill]), tb.amb.map((v) => v * (1 - 0.25 * d)));
    const ps = poses(rec, t), left = 3 - ps.length, kind = glass ? "glass" : "paper";
    const base = { w: CW, h: CH, edge: tb.edge, kind, back: tex.back, tw: tex.w, th_: tex.h };
    const stack = new Card(Object.assign({}, base, { c: [DECK[0], DECK[1], 3 + left * 0.6], R: Rz(-0.3), th: 5 + left * 1.2, face: tex.back, spec: 0, stack: true, ident: 9, cloth: glass ? 0.6 : 0 }));
    S.cards = [stack].concat(ps.map((p) => new Card(Object.assign({}, base, {
      c: p.c, R: p.R, th: TH, face: tex.faces[p.i], spec: glass ? 0 : 0.15, ident: p.i,
      cloth: glass ? 0.75 : 0, sheen: glass ? 0.2 + (p.theta / Math.PI) * 1.2 + p.c[0] / 200 : undefined,
    }))));
    for (const cd of S.cards) cd.faceCam = dot(sub(S.cam.pos, cd.c), cd.n) > 0;
    const P = yield* S.plane(rec.table in TABLES ? rec.table : "moss", tb);
    tb.props(S, t, dim, d);
    const order = S.cards.slice().sort((a, b) => S.cam.p(b.c)[2] - S.cam.p(a.c)[2]);
    for (const cd of order) { yield; drawCard(S, cd); }
    yield;
    ps.forEach((p, k) => label(S, p, S.cards[1 + k], rec, tex));
    for (const p of ps) {
      if (Math.abs(p.theta - Math.PI / 2) < 0.22) {
        const q = S.cam.p([p.c[0], p.c[1] + CH * 0.45, p.c[2]]);
        S.put(q[0], q[1], [255, 250, 220]);
        S.put(q[0], q[1] - 1, [255, 240, 200], 0.6);
      }
    }
    tb.after(S, t, dim, d);
    yield;
    if (d > 0.01) chill(S, P, rec, d, t);
    const data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) { data[i * 4] = S.c[i * 3]; data[i * 4 + 1] = S.c[i * 3 + 1]; data[i * 4 + 2] = S.c[i * 3 + 2]; data[i * 4 + 3] = 255; }
    return { w: W, h: H, data };
  }
  function frame(rec, t, tex) {
    const g = frameSteps(rec, t, tex);
    let r = g.next();
    while (!r.done) r = g.next();
    return r.value;
  }
  const CHILL = vnoise(77);
  // the cold: a shadow creeping in over the cloth from the far side, the other cards' warmth draining, a cool cast on the room
  function chill(S, P, rec, d, t) {
    const front = 70 - 112 * smooth(Math.min(1, d * 1.15)), revs = rec.cards.filter((c) => c.rev).map((c) => c.pos);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, j = i * 3, id = S.id[i];
      let r = S.c[j], g = S.c[j + 1], b = S.c[j + 2];
      if (id < 0) {
        const wx = P[i * 2], wy = P[i * 2 + 1], tendril = CHILL(wx * 0.08 + t * 0.3, wy * 0.05) * 22 - 11, cover = clamp((wy - front - tendril) / 14, 0, 1) * 0.5 * d;
        r = r * (1 - cover) + r * 0.31 * cover; g = g * (1 - cover) + g * 0.35 * cover; b = b * (1 - cover) + b * 0.46 * cover;
      } else if (id < 3 && revs.indexOf(id) < 0) {
        const m = (r + g + b) / 3, k = 0.55 * d;
        r = r * (1 - k) + m * 0.82 * k; g = g * (1 - k) + m * 0.88 * k; b = b * (1 - k) + m * 1.02 * k;
      }
      r = r * (1 - 0.12 * d) + r * 0.62 * 0.12 * d; g = g * (1 - 0.12 * d) + g * 0.7 * 0.12 * d; b = b * (1 - 0.12 * d) + b * 0.92 * 0.12 * d;
      const th = bay(x, y) * 0.9;
      S.c[j] = Math.floor(r / 4 + th) * 4; S.c[j + 1] = Math.floor(g / 4 + th) * 4; S.c[j + 2] = Math.floor(b / 4 + th) * 4;
    }
  }

  // ---------- sound: its own context, following audio.js's "al.sound" settings and first-click unlock ----------
  const Snd = (() => {
    let ctx = null, out = null, noiseBuf = null, unlocked = false;
    const prefs = () => { try { return Object.assign({ on: true, master: 0.7, sfx: 0.6 }, JSON.parse(localStorage.getItem("al.sound") || "{}")); } catch (e) { return { on: true, master: 0.7, sfx: 0.6 }; } };
    function init() {
      if (ctx) return ctx;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      out = ctx.createGain(); out.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const dd = noiseBuf.getChannelData(0);
      for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
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
      f.type = type; f.frequency.setValueAtTime(freq, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.004, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    }
    function tone(t, f0, f1, dur, vol, type, attack) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.003)); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
    const FX = {
      slide: (t, v) => { noise(t, 0.4, (v || 0.4) * 0.6, "bandpass", 1100, 2.2, 1500); },
      tok: (t, v) => { v = v || 1; noise(t, 0.06, 0.35 * v, "bandpass", 1100, 6); tone(t, 520, 420, 0.07, 0.18 * v, "triangle"); },
      lift: (t) => { noise(t, 0.2, 0.08, "bandpass", 800, 1.2, 1800); },
      clink: (t, v) => { for (const [m, a] of [[1, 1], [2.7, 0.5], [4.2, 0.3]]) tone(t, 2300 * m, 2300 * m, 0.6 / Math.sqrt(m), 0.08 * a * (v || 1)); },
      // a reversed card: no sting, a long low drone under the room that thins out slowly
      dread: (t) => { tone(t, 55, 52, 3.6, 0.12, "sine", 0.9); tone(t, 82.4, 80, 3.2, 0.05, "triangle", 1.2); noise(t, 3.0, 0.03, "lowpass", 180, 0.8); },
    };
    function play(name, v) { const c = ok(); if (!c || !FX[name]) return; try { FX[name](c.currentTime + 0.01, v === undefined ? 1 : v); } catch (e) { /* audio node limits */ } }
    if (root.document) {
      root.document.addEventListener("pointerdown", () => { unlocked = true; }, { capture: true });
      root.document.addEventListener("visibilitychange", () => { if (ctx && root.document.hidden) ctx.suspend(); });
    }
    return { play, FX };
  })();

  // ---------- the player ----------
  const reduced = () => (root.Settings && root.Settings.calm ? root.Settings.calm() : !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches));
  function player(rec, opts) {
    opts = opts || {};
    const doc = root.document, fig = doc.createElement("figure"), cv = doc.createElement("canvas");
    fig.className = "tarot-replay night-replay";
    cv.width = W; cv.height = H;
    cv.style.cssText = `image-rendering:pixelated;image-rendering:crisp-edges;display:block;cursor:pointer;${opts.scale ? `width:${W * opts.scale}px;height:${H * opts.scale}px` : "width:100%;height:auto"}`;
    cv.title = "Click to watch again";
    fig.appendChild(cv);
    const g = cv.getContext("2d"), img = g.createImageData(W, H), dur = length(rec), evs = events(rec);
    // a moment on the laid table before the deal, under the page's title plate (opts.pre seconds)
    const pre = opts.pre || 0;
    let tex = null, t = reduced() ? dur + HOLD : -pre, raf = 0, last = 0, onscreen = false, fired = 0, lastDraw = -1, job = null, rate = 1, held = false, forced = false;
    const show = (f) => { img.data.set(f.data); g.putImageData(img, 0, 0); };
    const paint = () => { if (!tex) return; job = null; show(frame(rec, Math.max(0, t), tex)); };
    const now = () => (root.performance ? root.performance.now() : Date.now());
    // a frame costs 10-30 ms to light, so it is worked on a few ms per tick and shown when done: the page keeps its 60 fps
    function work() {
      const end = now() + BUDGET;
      let r;
      do r = job.next(); while (!r.done && now() < end);
      if (r.done) { show(r.value); job = null; }
    }
    const live = () => !held && fig.isConnected && onscreen && !doc.hidden;
    function step(ms) {
      raf = 0;
      if (!live() || !tex) { last = 0; return; }
      const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
      last = ms;
      t += dt * rate;
      while (fired < evs.length && evs[fired][0] <= t) { if (evs[fired][0] > t - 0.25) Snd.play(evs[fired][1], evs[fired][2]); fired++; }
      // twenty frames a second is plenty for cards moving this slowly; the hold only flickers the candles
      if (!job && t >= 0 && t - lastDraw > (t < dur + HOLD ? 1 / 20 : 1 / 6)) { job = frameSteps(rec, t, tex); lastDraw = t; }
      if (job) work();
      raf = root.requestAnimationFrame(step);
    }
    const wake = () => { if ((forced || !reduced()) && !raf && live()) { last = 0; raf = root.requestAnimationFrame(step); } };
    const restart = () => { held = false; t = -pre; fired = 0; lastDraw = -1; paint(); wake(); };
    cv.addEventListener("click", restart);
    if ("IntersectionObserver" in root) {
      const io = new root.IntersectionObserver((es) => { onscreen = es[es.length - 1].isIntersecting; wake(); });
      io.observe(fig);
    } else onscreen = true;
    doc.addEventListener("visibilitychange", wake);
    // the page's shared control bar drives the player through this (replay.js); a press of Play also plays under reduced motion
    fig.replay = {
      get t() { return t; }, get dur() { return dur; }, get playing() { return !held && t < dur && (forced || !reduced()); },
      play() { held = false; forced = true; wake(); },
      pause() { held = true; },
      restart() { forced = true; restart(); },
      skip() { t = dur; fired = evs.length; lastDraw = -1; paint(); wake(); },
      rate(s) { rate = s; },
    };
    if (root.TarotCards) {
      root.TarotCards.load(root.TarotCards.deckFor(rec)).then((d) => {
        tex = { faces: rec.cards.map((c) => (c.rev ? rot180(d.card(c.card), d.w, d.h) : d.card(c.card))), back: d.back(), w: d.w, h: d.h };
        // not on screen yet (a background tab, a link preview, a still screenshot): show the finished spread, not an empty table
        if (!live() && t <= 0) { show(frame(rec, dur + HOLD, tex)); wake(); return; }
        paint();
        wake();
      }).catch(() => { /* the words under the replay still tell it */ });
    }
    return fig;
  }
  function rot180(px, w, h) {
    const out = new Uint8ClampedArray(px.length), n = w * h;
    for (let i = 0; i < n; i++) out.set(px.subarray(i * 4, i * 4 + 4), (n - 1 - i) * 4);
    return out;
  }

  root.TarotReplay = { player, frame, frameSteps, length, events, rot180, W, H, TABLES: Object.keys(TABLES), sound: Snd };
})(typeof window !== "undefined" ? window : globalThis);
