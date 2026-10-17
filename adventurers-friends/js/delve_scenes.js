/* Delve scenes: the kit the day replay's room vignettes are drawn with (theme-by-depth rooms, room dressing, light, sprites, the 3x5 hand, sound) and the player. */
(function (root) {
  "use strict";
  const W = 180, H = 100, FL = 64;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const ease = (x) => 1 - (1 - clamp(x, 0, 1)) ** 3;
  const easeIn = (x) => clamp(x, 0, 1) ** 2;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  function hash(a, b, c) {
    let n = (a * 374761393 + b * 668265263 + (c || 0) * 1274126177) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function hashStr(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  const RGB = {};
  function rgb(h) {
    if (Array.isArray(h)) return h;
    let v = RGB[h];
    if (!v) { const n = parseInt(h.slice(1), 16); v = RGB[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    return v;
  }
  const hex = (c) => "#" + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  function mix(a, b, t) { const x = rgb(a), y = rgb(b); return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hash(xi, yi, s), hash(xi + 1, yi, s), u), lerp(hash(xi, yi + 1, s), hash(xi + 1, yi + 1, s), u), v);
  }
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.62 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.26 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.12;
  function pick(ramp, v, x, y) { const n = ramp.length; return ramp[clamp(Math.floor(clamp(v, 0, 1) * (n - 1) + bay(x, y)), 0, n - 1)]; }

  // ---------- a pixel buffer for the painters ----------
  class PB {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
    set(x, y, c, a) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
      const i = (y * this.w + x) * 4, v = rgb(c), d = this.d;
      if (a == null || a >= 1) { d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = 255; return; }
      d[i] = d[i] + (v[0] - d[i]) * a; d[i + 1] = d[i + 1] + (v[1] - d[i + 1]) * a; d[i + 2] = d[i + 2] + (v[2] - d[i + 2]) * a; d[i + 3] = Math.max(d[i + 3], 255 * a);
    }
    get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null; const i = (y * this.w + x) * 4; return this.d[i + 3] ? hex([this.d[i], this.d[i + 1], this.d[i + 2]]) : null; }
    rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
    dark(x, y, k) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = (y * this.w + x) * 4; this.d[i] *= k; this.d[i + 1] *= k; this.d[i + 2] *= k; }
    line(x0, y0, x1, y1, c, a) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c, a);
    }
    canvas() {
      const cv = mk(this.w, this.h), g = cv.getContext("2d"), im = g.createImageData(this.w, this.h);
      im.data.set(this.d); g.putImageData(im, 0, 0);
      return cv;
    }
  }
  function mk(w, h) { const cv = root.document.createElement("canvas"); cv.width = w; cv.height = h; return cv; }

  // ---------- the eight themes ----------
  // wall: rock (stacked boulders), blocks (dressed masonry), ice (facets) or basalt (columns over a glow); floor: dirt, flags, snow or ash
  const THEMES = {
    goblin: { wall: "rock", ramp: ["#1a140d", "#2b2115", "#3f311f", "#56442b", "#71603e"], floor: "dirt", framp: ["#1e170e", "#2e2416", "#413421", "#56462d"],
      amb: [1.0, 0.9, 0.74], rock: 13, accent: ["#9a3020", "#c89a3a", "#3e6a2a", "#3a5a8a"] },
    beast: { wall: "rock", ramp: ["#1b140e", "#2d2217", "#43331f", "#5c4629", "#7a6040"], floor: "dirt", framp: ["#22180e", "#342614", "#4a371f", "#62492c"],
      amb: [1.0, 0.88, 0.72], rock: 16, accent: ["#b0904a", "#d8ccaa", "#4a3420"] },
    cave: { wall: "rock", ramp: ["#17151a", "#26232a", "#38343a", "#4d4847", "#686059"], floor: "dirt", framp: ["#1a181a", "#29262a", "#3a3637", "#4d4846"],
      amb: [0.95, 0.9, 0.82], rock: 12, accent: ["#c8a050", "#7a5232", "#cfc8bc"] },
    undead: { wall: "blocks", ramp: ["#141719", "#22272a", "#323a3c", "#475053", "#626b6a"], floor: "flags", framp: ["#15181a", "#222729", "#30373a", "#40494b"],
      amb: [0.82, 0.92, 0.94], rock: 10, accent: ["#e8dcc0", "#d8d0bc", "#6a8a7a"] },
    swamp: { wall: "blocks", ramp: ["#121810", "#1f2a1a", "#2e3c25", "#435432", "#5c6e42"], floor: "flags", framp: ["#141a10", "#20291a", "#2e3a24", "#3d4b2f"],
      amb: [0.84, 0.96, 0.78], rock: 11, accent: ["#6a8a3a", "#9ae070", "#3a5a2a"] },
    ice: { wall: "ice", ramp: ["#152030", "#203246", "#2d465c", "#41627c", "#62869e"], floor: "snow", framp: ["#4a6680", "#62809a", "#86a2b8", "#b4ccdc"],
      amb: [0.8, 0.88, 1.0], rock: 20, accent: ["#d8f0fa", "#ffffff", "#9ad0ec"] },
    sea: { wall: "rock", ramp: ["#0c1822", "#162c3c", "#224458", "#346074", "#548696"], floor: "flags", framp: ["#0e1c26", "#182c38", "#243e4c", "#345462"],
      amb: [0.74, 0.92, 1.04], rock: 15, accent: ["#c8c0a8", "#3a6a3a", "#5a8a8a"] },
    fire: { wall: "basalt", ramp: ["#120b09", "#1f130e", "#301c14", "#45281b", "#5c3522"], floor: "ash", framp: ["#140c0a", "#22140f", "#321d15", "#43281c"],
      amb: [1.1, 0.78, 0.62], rock: 9, accent: ["#ff9a2a", "#ffcf5a", "#e04a1a"] },
  };
  const themeOf = (t) => THEMES[t] || THEMES.cave;

  // ---------- walls ----------
  function voronoi(x, y, cw, ch, s) {
    const gx = Math.floor(x / cw), gy = Math.floor(y / ch);
    let d1 = 1e9, d2 = 1e9, id = 0, px = 0, py = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j, ox = (cx + 0.15 + hash(cx, cy, s) * 0.7) * cw, oy = (cy + 0.15 + hash(cx, cy, s + 1) * 0.7) * ch;
      const d = ((x - ox) / cw) ** 2 + ((y - oy) / ch) ** 2;
      if (d < d1) { d2 = d1; d1 = d; id = cx * 7919 + cy; px = ox; py = oy; } else if (d < d2) d2 = d;
    }
    return { d1: Math.sqrt(d1), d2: Math.sqrt(d2), id, px, py };
  }
  function rockWall(pb, T, x0, x1, y0, y1, s, ox) {
    const r = T.ramp, cw = T.rock * 1.15, ch = T.rock * 0.78;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const X = x + (ox || 0), v = voronoi(X, y, cw, ch, s), edge = v.d2 - v.d1;
      const base = 0.3 + hash(v.id, 3, s) * 0.42, face = -((X - v.px) / cw) * 0.32 - ((y - v.py) / ch) * 0.55;
      let sh = base + face + (fbm(X / 5, y / 4, s + 3) - 0.5) * 0.35;
      sh *= 0.62 + 0.38 * (y / FL);
      if (edge < 0.07) { pb.set(x, y, r[0]); continue; }
      if (edge < 0.13) sh -= 0.22;
      pb.set(x, y, pick(r, sh, x, y));
    }
  }
  function blockWall(pb, T, x0, x1, y0, y1, s, ox) {
    const r = T.ramp, mortar = mix(r[0], "#000000", 0.25);
    let y = y0, row = 0;
    while (y < y1) {
      const hgt = 7 + Math.floor(hash(row, 1, s) * 3);
      let x = x0 - Math.floor(hash(row, 2, s) * 16) - (ox || 0) % 16;
      let k = 0;
      while (x < x1) {
        const w = 12 + Math.floor(hash(row, k, s + 5) * 11), base = 0.38 + hash(row, k, s + 9) * 0.32;
        for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) {
          const X = x + i, Y = y + j;
          if (X < x0 || X >= x1 || Y >= y1) continue;
          if (i === 0 || j === hgt - 1) { pb.set(X, Y, mortar); continue; }
          let sh = base + (fbm((X + (ox || 0)) / 4, Y / 3, s) - 0.5) * 0.3;
          if (j === 0) sh += 0.24; else if (i === 1) sh += 0.1; else if (j === hgt - 2 || i === w - 1) sh -= 0.22;
          sh *= 0.64 + 0.36 * (Y / FL);
          pb.set(X, Y, pick(r, sh, X, Y));
        }
        if (hash(row, k, s + 21) < 0.18) {
          let cx = x + 3 + Math.floor(hash(row, k, s + 22) * (w - 6)), cy = y + 1;
          for (let q = 0; q < hgt - 2; q++) { if (cx >= x0 && cx < x1) pb.set(cx, cy + q, r[0]); cx += hash(q, k, s) < 0.5 ? 1 : -1; }
        }
        x += w; k++;
      }
      y += hgt; row++;
    }
  }
  function iceWall(pb, T, x0, x1, y0, y1, s, ox) {
    const r = T.ramp;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const X = x + (ox || 0), v = voronoi(X, y, 22, 16, s), edge = v.d2 - v.d1;
      const nx = hash(v.id, 5, s) - 0.5, ny = hash(v.id, 6, s) - 0.5;
      let sh = 0.45 + nx * ((X - v.px) / 22) * 1.6 + ny * ((y - v.py) / 16) * 1.6 + (hash(v.id, 7, s) - 0.5) * 0.3;
      sh += (fbm(X / 9, y / 3, s + 4) - 0.5) * 0.25;
      sh *= 0.7 + 0.3 * (y / FL);
      if (edge < 0.05) { pb.set(x, y, mix(T.ramp[4], T.accent[0], 0.35)); continue; }
      if (edge < 0.11) sh += 0.12;
      pb.set(x, y, pick(r, sh, x, y));
    }
    for (let k = 0; k < 7; k++) {
      let cx = x0 + hash(k, 8, s) * (x1 - x0), cy = y0 + 4 + hash(k, 9, s) * (y1 - y0 - 10);
      for (let q = 0; q < 10; q++) { pb.set(cx, cy, "#e8f8ff", 0.6); cx += hash(k, q, s) < 0.5 ? 1 : 0; cy += 1; }
    }
  }
  function basaltWall(pb, glow, T, x0, x1, y0, y1, s, ox) {
    const r = T.ramp;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const X = x + (ox || 0), v = voronoi(X, y, 9, 24, s), edge = v.d2 - v.d1;
      let sh = 0.34 + hash(v.id, 3, s) * 0.3 - ((X - v.px) / 9) * 0.45 + (fbm(X / 4, y / 6, s) - 0.5) * 0.2;
      sh *= 0.65 + 0.35 * (y / FL);
      if (edge < 0.06) {
        const hot = (y / y1) * 0.8 + (fbm(X / 13, y / 7, s + 9) - 0.5) * 1.1;
        if (hot > 0.86 && glow) { glow.set(x, y, hot > 1.0 ? T.accent[1] : T.accent[0]); continue; }
        if (hot > 0.7) { pb.set(x, y, "#5a2412"); continue; }
        pb.set(x, y, r[0]);
        continue;
      }
      pb.set(x, y, pick(r, sh, x, y));
    }
  }
  function paintWall(pb, glow, T, x0, x1, y0, y1, s, ox) {
    if (T.wall === "blocks") blockWall(pb, T, x0, x1, y0, y1, s, ox);
    else if (T.wall === "ice") iceWall(pb, T, x0, x1, y0, y1, s, ox);
    else if (T.wall === "basalt") basaltWall(pb, glow, T, x0, x1, y0, y1, s, ox);
    else rockWall(pb, T, x0, x1, y0, y1, s, ox);
  }

  // ---------- floors ----------
  function paintFloor(pb, glow, T, s, ox) {
    const r = T.framp, vx = W / 2 - (ox || 0) * 0.3;
    for (let y = FL; y < H; y++) for (let x = 0; x < W; x++) {
      const X = x + (ox || 0), depth = (y - FL) / (H - FL);
      let sh = 0.35 + depth * 0.35 + (fbm(X / 7, y / 3, s + 31) - 0.5) * 0.5;
      if (T.floor === "flags") {
        const yy = Math.log(1 + (y - FL) * 0.4) * 4.2, row = Math.floor(yy), t = (y - FL + 6) / (H - FL + 6);
        const col = Math.floor(((x - vx) / t + 400 + (row % 2) * 9 + (ox || 0) * 0) / 18);
        const fy = yy - row, fx = (((x - vx) / t + 400 + (row % 2) * 9) / 18) - col;
        sh = 0.42 + hash(row, col, s) * 0.3 + depth * 0.15 + (fbm(X / 5, y / 2, s) - 0.5) * 0.25;
        if (fy < 0.12 || fx < 0.05) { pb.set(x, y, mix(r[0], "#000000", 0.2)); continue; }
        if (fy < 0.3) sh += 0.12;
      } else if (T.floor === "snow") {
        sh = 0.55 + depth * 0.3 + (fbm(X / 11, y / 4, s + 5) - 0.5) * 0.6;
        if (fbm(X / 6, y / 2, s + 8) > 0.7) sh -= 0.25;
      } else if (T.floor === "ash") {
        const v = voronoi(X, y * 2.4, 13, 13, s + 40), e = v.d2 - v.d1;
        if (e < 0.06 && glow && depth > 0.35 && fbm(X / 15, y / 5, s + 2) > 0.6) { glow.set(x, y, depth > 0.6 ? T.accent[1] : T.accent[0]); continue; }
        if (e < 0.08) sh -= 0.3;
      } else if (hash(X >> 1, y, s + 50) < 0.025) {
        pb.set(x, y, r[3]); pb.set(x, y - 1, mix(r[3], "#ffffff", 0.15)); continue;
      }
      pb.set(x, y, pick(r, sh, x, y));
    }
    for (let x = 0; x < W; x++) { pb.set(x, FL, mix(r[0], "#000000", 0.4)); pb.set(x, FL + 1, mix(r[1], "#000000", 0.25), 0.7); }
  }

  // ---------- props: small painters on the buffer ----------
  const WOOD = ["#2a1a0e", "#4a2e18", "#6a4426", "#8a5c34", "#a8784a"], IRON = ["#1e1e22", "#3a3a40", "#5a5a62", "#8a8a92", "#c0c0c6"];
  const BONE = ["#5a5244", "#8a8070", "#b8ae98", "#d8d0bc", "#f0ead8"], GOLD = ["#5a3a08", "#8a5a10", "#c08a20", "#e8b84a", "#fff0a0"];
  function crate(pb, x, y, w, h) {
    pb.rect(x, y - h, w, h, WOOD[2]);
    for (let j = 0; j < h; j += 4) pb.rect(x, y - h + j, w, 1, WOOD[1]);
    pb.rect(x, y - h, w, 1, WOOD[4]); pb.rect(x, y - h, 1, h, WOOD[3]); pb.rect(x + w - 1, y - h, 1, h, WOOD[0]); pb.rect(x, y - 1, w, 1, WOOD[0]);
    pb.line(x + 1, y - 2, x + w - 2, y - h + 1, WOOD[3]);
  }
  function barrel(pb, x, y, w, h) {
    for (let j = 0; j < h; j++) {
      const bulge = Math.round(Math.sin((j / (h - 1)) * Math.PI) * 1.5), x0 = x - bulge, x1 = x + w + bulge;
      for (let i = x0; i < x1; i++) { const t = (i - x0) / (x1 - x0); pb.set(i, y - h + j, t < 0.2 ? WOOD[3] : t > 0.75 ? WOOD[1] : WOOD[2]); }
      if (j === 2 || j === h - 3) for (let i = x0; i < x1; i++) pb.set(i, y - h + j, IRON[2]);
    }
    pb.rect(x, y - h, w, 1, WOOD[4]);
  }
  function sack(pb, x, y) {
    const S = ["#4a3a22", "#6e5a36", "#8e7646", "#ab9460"];
    for (let j = 0; j < 7; j++) for (let i = -4; i <= 4; i++) if (i * i / 16 + (j - 4) ** 2 / 14 <= 1) pb.set(x + i, y - 7 + j, S[clamp(2 - Math.round(i / 3) - (j > 4 ? 1 : 0), 0, 3)]);
    pb.rect(x - 1, y - 9, 3, 2, S[1]); pb.set(x, y - 9, S[3]);
  }
  function skull(pb, x, y) {
    pb.rect(x, y - 4, 4, 3, BONE[3]); pb.rect(x + 1, y - 5, 2, 1, BONE[3]); pb.rect(x + 1, y - 1, 2, 1, BONE[2]);
    pb.set(x + 1, y - 3, "#1a1410"); pb.set(x + 3, y - 3, "#1a1410"); pb.set(x, y - 4, BONE[4]);
  }
  function bones(pb, x, y, n, s) {
    for (let k = 0; k < n; k++) {
      const bx = x + Math.floor(hash(k, 1, s) * 14) - 7, by = y - Math.floor(hash(k, 2, s) * 3), len = 3 + Math.floor(hash(k, 3, s) * 4), d = hash(k, 4, s) < 0.5 ? 1 : -1;
      for (let i = 0; i < len; i++) pb.set(bx + i, by - (d > 0 ? Math.floor(i / 3) : 0), BONE[2 + (i === 0 || i === len - 1 ? 1 : 0)]);
    }
    skull(pb, x - 2, y);
  }
  function banner(pb, x, y, w, h, c, mark, s) {
    pb.rect(x - 1, y, w + 2, 1, WOOD[2]);
    for (let j = 1; j < h; j++) for (let i = 0; i < w; i++) {
      const torn = j > h - 4 && hash(i, j, s) < (j - (h - 4)) * 0.3;
      if (torn) continue;
      pb.set(x + i, y + j, i === 0 ? mix(c, "#ffffff", 0.12) : i === w - 1 || j === h - 1 ? mix(c, "#000000", 0.35) : c);
    }
    const mx = x + (w >> 1), my = y + (h >> 1) - 1;
    if (mark === "sun") { pb.rect(mx - 1, my - 1, 3, 3, "#e8c050"); pb.set(mx, my - 3, "#e8c050"); pb.set(mx, my + 3, "#e8c050"); pb.set(mx - 3, my, "#e8c050"); pb.set(mx + 3, my, "#e8c050"); }
    else if (mark === "fish") { pb.rect(mx - 2, my, 4, 2, "#e0e0d8"); pb.set(mx + 2, my - 1, "#e0e0d8"); pb.set(mx + 2, my + 2, "#e0e0d8"); }
    else { pb.rect(mx - 2, my - 1, 5, 4, "#d8ccaa"); pb.set(mx - 1, my, "#1a1410"); pb.set(mx + 1, my, "#1a1410"); pb.rect(mx - 1, my + 2, 3, 1, "#1a1410"); }
  }
  function timber(pb, x0, x1, y0, y1) {
    for (const x of [x0, x1 - 3]) { pb.rect(x, y0, 3, y1 - y0, WOOD[2]); pb.rect(x, y0, 1, y1 - y0, WOOD[3]); pb.rect(x + 2, y0, 1, y1 - y0, WOOD[0]); }
    pb.rect(x0 - 2, y0, x1 - x0 + 4, 3, WOOD[2]); pb.rect(x0 - 2, y0, x1 - x0 + 4, 1, WOOD[4]); pb.rect(x0 - 2, y0 + 2, x1 - x0 + 4, 1, WOOD[0]);
  }
  function cobweb(pb, x, y, dir, n) {
    for (let k = 0; k < 4; k++) { const a = (k / 3) * (Math.PI / 2); pb.line(x, y, x + dir * Math.cos(a) * n, y + Math.sin(a) * n, "#c8c4bc", 0.45); }
    for (let r = 3; r < n; r += 3) for (let k = 0; k <= 8; k++) { const a = (k / 8) * (Math.PI / 2); pb.set(x + dir * Math.cos(a) * r, y + Math.sin(a) * r, "#d8d4cc", 0.4); }
  }
  function stalactites(pb, T, s, icicle) {
    for (let k = 0; k < 9; k++) {
      const x = Math.floor(hash(k, 11, s) * W), len = 3 + Math.floor(hash(k, 12, s) * (icicle ? 10 : 7));
      for (let j = 0; j < len; j++) {
        const w = Math.max(1, Math.round((1 - j / len) * (icicle ? 2 : 3)));
        for (let i = -w + 1; i < w; i++) pb.set(x + i, j, icicle ? (i < 0 ? T.accent[0] : i > 0 ? T.ramp[3] : T.accent[2]) : i < 0 ? T.ramp[3] : T.ramp[1]);
      }
      if (icicle) pb.set(x, len, T.accent[1]);
    }
  }
  function candles(pb, x, y, n, s) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const cx = x + k * 3 + Math.floor(hash(k, 1, s) * 2), h = 3 + Math.floor(hash(k, 2, s) * 4);
      pb.rect(cx, y - h, 2, h, "#e8dcc0"); pb.set(cx + 1, y - h, "#c8bca0"); pb.set(cx, y - 1, "#b8a888");
      out.push([cx, y - h - 1]);
    }
    return out;
  }
  function sarcophagus(pb, x, y) {
    const R = ["#2a2e30", "#3e4446", "#565e5e", "#727a78", "#929a96"];
    pb.rect(x, y - 9, 28, 9, R[2]); pb.rect(x, y - 9, 28, 1, R[4]); pb.rect(x, y - 1, 28, 1, R[0]);
    pb.rect(x - 1, y - 12, 30, 3, R[3]); pb.rect(x - 1, y - 12, 30, 1, R[4]);
    for (let i = 4; i < 26; i += 6) pb.rect(x + i, y - 7, 3, 5, R[1]);
  }
  function niche(pb, T, x, y) {
    for (let j = 0; j < 12; j++) for (let i = 0; i < 10; i++) {
      if (j < 4 && (i - 4.5) ** 2 / 25 + (j - 4) ** 2 / 16 > 1) continue;
      pb.set(x + i, y + j, i === 0 || j === 0 ? T.ramp[4] : mix(T.ramp[0], "#000000", 0.3));
    }
    skull(pb, x + 3, y + 11);
  }
  function vines(pb, x, len, s) {
    let cx = x;
    for (let j = 0; j < len; j++) {
      pb.set(cx, j, j % 5 === 0 ? "#5a7a2a" : "#3a5a22");
      if (j % 4 === 2) pb.set(cx + (hash(j, x, s) < 0.5 ? 1 : -1), j, "#6a8a3a");
      if (hash(j, x, s + 1) < 0.2) cx += hash(j, x, s + 2) < 0.5 ? 1 : -1;
    }
  }
  function clawMarks(pb, T, x, y) { for (let k = 0; k < 3; k++) for (let j = 0; j < 9; j++) { pb.set(x + k * 3 + j * 0.5, y + j, T.ramp[0]); pb.set(x + k * 3 + j * 0.5 + 1, y + j, T.ramp[4]); } }
  function puddle(pb, x, y, w, c) {
    for (let i = -w; i <= w; i++) { const hh = Math.round(Math.sqrt(1 - (i / w) ** 2) * 2); for (let j = -hh; j <= hh; j++) pb.set(x + i, y + j, j === -hh ? mix(c, "#ffffff", 0.25) : c); }
  }
  function mushrooms(pb, glow, x, y, s) {
    for (let k = 0; k < 4; k++) {
      const mx = x + k * 3 + Math.floor(hash(k, 1, s) * 2), h = 2 + Math.floor(hash(k, 2, s) * 3);
      pb.rect(mx, y - h, 1, h, "#c8d8a8");
      glow.set(mx - 1, y - h - 1, "#7ad0a0"); glow.set(mx, y - h - 1, "#b0f0c0"); glow.set(mx + 1, y - h - 1, "#7ad0a0");
    }
  }
  function sconce(pb, x, y) { pb.rect(x - 1, y, 3, 2, IRON[2]); pb.rect(x, y - 4, 1, 5, WOOD[2]); pb.set(x, y - 5, WOOD[1]); pb.rect(x - 2, y + 2, 5, 1, IRON[1]); }
  function snowDrift(pb, x, y, w) { for (let i = 0; i < w; i++) { const hh = Math.round(Math.sin((i / w) * Math.PI) * 4); for (let j = 0; j < hh; j++) pb.set(x + i, y - j, j === hh - 1 ? "#f4faff" : "#d4e6f0"); } }
  function rubble(pb, T, x, y, n, s) {
    for (let k = 0; k < n; k++) {
      const rx = x + Math.floor(hash(k, 1, s) * 20) - 10, ry = y - Math.floor(hash(k, 2, s) * 3), w = 2 + Math.floor(hash(k, 3, s) * 3);
      pb.rect(rx, ry - w + 1, w, w - 1, T.ramp[2]); pb.rect(rx, ry - w + 1, w, 1, T.ramp[4]); pb.set(rx + w - 1, ry - 1, T.ramp[0]);
    }
  }
  function frameEdges(pb, T, s) {
    const d = mix(T.ramp[0], "#000000", 0.55), m = mix(T.ramp[1], "#000000", 0.4);
    for (let y = 0; y < H; y++) {
      const l = 4 + Math.round(vnoise(y / 6, 1, s) * 7 + (y > 70 ? (y - 70) * 0.3 : 0)), r = 4 + Math.round(vnoise(y / 6, 2, s) * 7 + (y > 70 ? (y - 70) * 0.25 : 0));
      for (let x = 0; x < l; x++) pb.set(x, y, x === l - 1 ? m : d);
      for (let x = 0; x < r; x++) pb.set(W - 1 - x, y, x === r - 1 ? m : d);
    }
    for (let x = 0; x < W; x++) { const c = 2 + Math.round(vnoise(x / 9, 3, s) * 4); for (let y = 0; y < c; y++) pb.set(x, y, y === c - 1 ? m : d); }
  }

  // what lies at the bottom of a drop: embers under Emberdeep, black water in the Vault, blue cold under the ice, plain dark elsewhere
  const ABYSS = { fire: ["#140604", "#3a1206", "#7a2a0c"], sea: ["#04090c", "#0a1a22", "#163440"], ice: ["#060a12", "#0e1c2c", "#1e3650"] };
  const abyssOf = (theme) => ABYSS[theme] || ["#050404", "#0e0c0a", "#1c1814"];
  // a drop across the floor: the far wall's strata going down into the dark, a lit near lip, loose stones at the edges
  function chasm(pb, T, theme, s) {
    const ab = abyssOf(theme);
    for (let y = FL + 1; y < H; y++) {
      const a = Math.floor(92 - (y - FL) * 0.2), b = Math.ceil(120 + (y - FL) * 0.25), k = (y - FL) / (H - FL), face = Math.round(3 + k * 7);
      for (let x = a; x <= b; x++) {
        const u = (x - a) / (b - a), deep = Math.min(1, (y - FL) / 6);
        let c;
        if (x - a < face) { const v = 0.55 - (x - a) / face * 0.4 - k * 0.2 + ((y + (x >> 1)) % 4 === 0 ? -0.18 : 0); c = mix(pick(T.ramp, v, x, y), "#000000", 0.35 + k * 0.3); }
        else if (b - x < 2) c = mix(T.ramp[0], "#000000", 0.5);
        else { const m = vnoise(x / 7, y / 3, s + 90) * 0.5 + (1 - Math.abs(u - 0.5) * 2) * 0.5; c = pick(ab, (1 - deep) * 0.2 + m * (theme in ABYSS ? 0.85 : 0.45), x, y); }
        pb.set(x, y, c);
      }
      pb.set(a - 1, y, T.framp[3]); pb.set(a - 2, y, mix(T.framp[3], "#ffffff", 0.15)); pb.set(b + 1, y, mix(T.framp[0], "#000000", 0.4));
    }
    for (let x = 92; x <= 120; x++) { pb.set(x, FL + 1, mix(T.ramp[2], "#000000", 0.3)); if (hash(x, 3, s) < 0.3) pb.set(x, FL, T.ramp[3]); }
    if (theme === "fire") for (let k = 0; k < 18; k++) { const x = 98 + hash(k, 1, s) * 20, y = FL + 14 + hash(k, 2, s) * 20; pb.set(x, y, k % 3 ? "#e0601a" : "#ffb040"); }
    for (const [rx, ry] of [[86, FL + 12], [88, H - 6], [124, FL + 8], [128, H - 10]]) { pb.rect(rx, ry, 3, 2, T.framp[2]); pb.rect(rx, ry, 3, 1, T.framp[3]); }
  }
  // a hole in the floor at the wall's foot: a stone rim, the inside lighter at the lip and dark only at its heart
  function hole(pb, T, theme, cx, cy, rx, ry, s) {
    const ab = abyssOf(theme);
    oval(pb, cx, cy, rx + 2, ry + 2, (X, Y, d, i, j) => pb.set(X, Y, d > 0.72 ? (j < 0 ? mix(T.framp[0], "#000000", 0.25) : mix(T.framp[3], "#ffffff", 0.3)) : null));
    oval(pb, cx, cy, rx, ry, (X, Y, d, i, j) => {
      const lipBack = j < 0 && d > 0.35;
      pb.set(X, Y, lipBack ? pick(T.ramp, 0.5 - (1 - d) * 0.6 + (Y % 3 === 0 ? -0.15 : 0), X, Y) : pick(ab, d * 0.9 + (vnoise(X / 4, Y / 2, s) - 0.5) * 0.3, X, Y));
    });
    for (let k = 0; k < 9; k++) { const a = Math.PI + (k / 8) * Math.PI, x = Math.round(cx + Math.cos(a) * (rx + 2)), y = Math.round(cy + Math.sin(a) * (ry + 2)); pb.rect(x - 1, y - 1, 3, 2, T.ramp[2]); pb.rect(x - 1, y - 1, 3, 1, T.ramp[4]); }
    if (theme === "sea") for (let i = -4; i <= 4; i++) pb.set(cx + i, cy + 2, i % 3 ? "#3a7888" : "#7ab8c8");
  }

  // ---------- props a room's name calls for ----------
  // the first keyword that matches a room's name picks its prop (a fourth field is the painter's variant); "wall" props hang on the back wall, "floor" props stand behind the crew
  const PROPS = [
    [/salamander/, "salpools", "floor"], [/silt/, "silt", "floor"], [/crack|foundation|fault\b|split|cleft|fissure/, "crack", "floor"],
    [/fish pond/, "fishpond", "floor"], [/lens/, "lenses", "wall"], [/reef|coral/, "reef", "floor"], [/(ice|frozen) stair|ice step|spiral of ice/, "icesteps", "floor"],
    [/pearl/, "clams", "floor"], [/kelp/, "kelp", "floor"], [/air pocket|diving/, "bubbles", "wall"], [/swallowed ship|wreck|captain/, "ship", "wall"],
    [/waterfall|behind the falls/, "waterfall", "wall"], [/trough|wash ?house/, "trough", "floor"], [/stream|brook|ford\b/, "stream", "floor"], [/causeway/, "causeway", "floor"],
    [/steam|vents?\b|smok|breathing wall|heat wall/, "vents", "floor"],
    [/pond|pool|cistern|font|well\b|wellhead|bath|spring|seep|sump|wallow|slop/, "pool", "floor"],
    [/forge|anvil|smith|casting|crucible|bellows|works\b/, "forge", "wall"], [/organ/, "organ", "wall"], [/icicle/, "icicles", "wall"], [/bell/, "bell", "wall"], [/clock/, "clock", "wall"],
    [/weigh|scales|assay room|exchange/, "scales", "floor"], [/still room|embalm|alchem|workroom|stitching|workshop|tinkers' bench|potion/, "alembic", "floor"],
    [/herb|drying|carcass/, "racks", "wall"], [/powder|blast|magazine|keg/, "powder", "floor"], [/lean-to|tent\b|hut\b|shed\b|booth|lodge|confession|windbreak|hide\b/, "shed", "wall"],
    [/library|archive|scriptor|ledger|register|scrivener|clerk|office|overseer|desk|alcove|notice|claim board|wanted|tally|story wall|weather room/, "shelves", "wall"],
    [/kitchen|mess|cook|larder|refectory|feast|smokehouse|granary|brew|beer|buttery|meat hall|wake cellar|pot\b/, "kitchen", "floor"],
    [/bunk|dormitory|sleeping|cells\b|barracks|quarters|lodging|loft|nursery|sick bay/, "bunks", "wall"], [/throne/, "throne", "floor"],
    [/mushroom|glowcap|glowworm|physic garden/, "glowshrooms", "floor"], [/web|silk|egg gallery|brood/, "webs", "wall"], [/bat roost|\bbats\b/, "bats", "wall"],
    [/giant's table/, "giantleg", "wall"], [/slipper/, "slipper", "floor"], [/dice|card|game room|stone-game|tribute/, "table", "floor"],
    [/locker|wardrobe|deposit|strongbox|strongroom|vault corridor|stamp room|keyhole/, "lockers", "wall"],
    [/coin|mint|gilded|bullion|tithe|treasury|hoard|pay window|counting|teller|ingot|crowns|poor box|golden/, "coins", "floor"], [/statue|figures|old kings|saint|carving|golem|sentinel|mason|plinth/, "statues", "wall"],
    [/quay|harbour|tide/, "quay", "floor"], [/lava|magma|slag|furnace|cinder|ember sanctum/, "lava", "floor"],
    [/wagon/, "wagon", "floor"], [/cart|ore[ -]|track|rails|siding|drift|stope|seam|gem vein|sorting|crosscut/, "cart", "floor"], [/engine|pump|sluice|ventilation/, "engine", "wall"],
    [/ladder|winze|adit|landing/, "ladder", "wall"], [/winch|hoist|lift|shaft|pithead|chute|chimney/, "winch", "wall"],
    [/trap line|snapjaw/, "oldtraps", "floor"], [/\brats?\b/, "rats", "floor"], [/nest|hollow|whelp|pups|wolf's rest|winter chamber|\bdens?\b|fox earth|drake/, "nest", "floor"],
    [/flock/, "flock", "floor"], [/ossuary|midden|bone|cairn|articulator|last stand|cut-off|last watch|unclaimed/, "bonepile", "floor"], [/heap|pile|stolen|loot\b|goods|graveyard|wrack|stranded|diggings|breach|spoil|siren's rock/, "heap", "floor"],
    [/burrow|warren|\bruns?\b|sett\b|tunnel|\bdig\b|hole\b|gap\b|crawl|squeeze|drain/, "burrows", "wall"], [/stake|fence|palisade|ditch/, "stakes", "floor"], [/trail|lane\b|drag|marks|ground\b/, "tracks", "floor"],
    [/root|trunk|marked trees|antler/, "roots", "wall"], [/reed|eel/, "reeds", "floor"], [/trophy|collar/, "trophies", "wall"], [/cage/, "cages", "wall"],
    [/armoury|axes|tong|sharpening|boot rack|archery|harness|guard|sentry|drill|shift room|watch-room/, "weapons", "wall"], [/lookout/, "lookout", "wall"],
    [/lamp|lantern|harbour-light|candle|chandlery/, "lanterns", "wall"], [/ice cellar|\bice\b|frozen|cold room|clear-ice/, "iceblocks", "floor"],
    [/barrel|cask|cellar|wine|grog|dry store|warehouse/, "barrels", "floor"], [/timber|charcoal|wood store/, "logs", "floor"], [/kennel|dog pen|pens\b|stalls/, "kennel", "floor"],
    [/laundry|washing|cloth/, "laundry", "wall"], [/charm|hair|shaman|totem/, "totems", "wall"],
    [/coffin|bier|cortege|\bvault\b|sarcoph|tomb|niches|last dig|weeping/, "coffins", "wall"], [/grave\b|graves|crypt\b/, "graves", "floor"],
    [/chapel|shrine|temple|cross\b|idol|reliquar|sacrist|chantry|chaplain|vestry|choir/, "altar", "wall"],
    [/hearth|fireplace/, "hearth", "wall"], [/glass|obsidian|mirror/, "glass", "floor"], [/drowned|flooded|sunken|undertow|black water|green to the waterline/, "flooded", "floor"],
    [/wind|snow|draught|balcony|scoured|cold porch/, "wind", "wall"],
    [/gate|portcullis|front door|bear's door|toothed door|\barch\b|threshold/, "gate", "wall"],
    [/nave|colonnade|arches|cloister|galler|walk\b|aisle|crossing|junction/, "arches", "wall"],
    [/great hall|chief's hall|honour|pilgrims' hall|guest|echo|song|singing|hall\b|chamber|room\b/, "banners", "wall"],
    [/stair|steps|ramp|slope|plank|ledge/, "steps", "wall"],
  ];
  // a room whose name calls for nothing gets its lair's own deliberate filler
  const GENERIC = { goblin: "heap", beast: "tracks", cave: "logs", undead: "coffins", swamp: "reeds", ice: "icicles", sea: "kelp", fire: "vents" };
  function propsOf(name, theme, kind) {
    const s = String(name || "").toLowerCase();
    if (!s) return [];
    for (const [re, id, slot, v] of PROPS) if (re.test(s)) return kind === "stair" && id === "steps" ? [] : [{ id, slot, v }];
    if (theme && GENERIC[theme] && kind !== "lair" && kind !== "stair") return [{ id: GENERIC[theme], slot: ["coffins", "icicles"].includes(GENERIC[theme]) ? "wall" : "floor", generic: true }];
    return [];
  }
  // where a prop goes: clear of the room kind's own furniture (the door, the shrine, the mural, the stair, the chasm)
  function propSpot(kind, slot, sub) {
    if (slot === "wall") return { x: kind === "lore" ? 0 : ["puzzle", "shrine", "camp_spot", "fear", "lair", "stair"].includes(kind) || (kind === "obstacle" && sub === "stuck_door") ? 30 : 92, y: 10 };
    return { x: kind === "stair" ? 100 : kind === "obstacle" ? 150 : kind === "lair" ? 60 : kind === "camp_spot" ? 36 : 128, y: FL + 6 };
  }
  const P8 = (pb, x, y, c, a) => pb.set(Math.round(x), Math.round(y), c, a);
  function oval(pb, cx, cy, rx, ry, fn) { for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) { const d = (i / rx) ** 2 + (j / ry) ** 2; if (d <= 1) fn(cx + i, cy + j, d, i, j); } }
  const PAINT = {
    fishpond(pb, glow, T, x, y, s, A) {
      oval(pb, x, y + 4, 30, 7, (X, Y, d, i, j) => pb.set(X, Y, d > 0.78 ? (j < 0 ? T.ramp[4] : T.ramp[2]) : d > 0.62 ? "#1a2a2a" : j < -3 ? "#3a6a6a" : "#24484a"));
      for (const [lx, ly] of [[-14, 1], [10, 4], [18, 0]]) { oval(pb, x + lx, y + 4 + ly, 3, 1, (X, Y) => pb.set(X, Y, "#4a7a2a")); pb.set(x + lx + 1, y + 3 + ly, "#7aa04a"); }
      pb.set(x + 10, y + 3, "#e8d8e8"); pb.set(x + 11, y + 2, "#f8e8f0");
      A.anim.push({ id: "fish", x, y: y + 4, rx: 22, ry: 4 }, { id: "ripple", x, y: y + 4, rx: 26, ry: 5 });
    },
    pool(pb, glow, T, x, y, s, A) {
      const w = A.theme === "swamp" ? ["#1a2a14", "#2a3e20", "#3e5a2e"] : A.theme === "fire" ? ["#3a1408", "#8a3010", "#e0701a"] : ["#0e2228", "#1a3a44", "#3a6a74"];
      oval(pb, x, y + 4, 20, 5, (X, Y, d, i, j) => pb.set(X, Y, d > 0.74 ? (j < 0 ? T.ramp[4] : T.ramp[1]) : j < -2 ? w[2] : d > 0.5 ? w[0] : w[1]));
      A.anim.push({ id: "ripple", x, y: y + 4, rx: 16, ry: 3 });
    },
    lenses(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 3; k++) {
        const cx = x + 4 + k * 26, cy = y + 22 + (k % 2) * 4;
        pb.rect(cx, cy + 8, 1, FL - cy - 8, GOLD[1]); pb.rect(cx - 3, FL - 1, 7, 1, GOLD[0]);
        oval(pb, cx, cy, 7, 7, (X, Y, d, i, j) => pb.set(X, Y, d > 0.7 ? (i + j < 0 ? GOLD[4] : GOLD[2]) : i + j < -4 ? "#f4fbff" : i + j < 2 ? "#a8d8ec" : "#5a8aa8"));
        glow.set(cx - 2, cy - 3, "#ffffff"); glow.set(cx - 3, cy - 2, "#dff4ff");
      }
      A.anim.push({ id: "lensbeam", x: x + 4, y: y + 22 });
    },
    reef(pb, glow, T, x, y, s, A) {
      const C = [["#c84a6a", "#ff8aa8"], ["#e0803a", "#ffc070"], ["#3aa8a0", "#8af0e0"], ["#8a5ad0", "#c8a0ff"]];
      for (let k = 0; k < 9; k++) {
        const bx = x - 34 + k * 9 + Math.floor(hash(k, 1, s) * 4), [c, tip] = C[k % 4], h = 7 + Math.floor(hash(k, 2, s) * 10);
        for (let j = 0; j < h; j++) { const sw = Math.round(Math.sin(j * 0.7 + k) * 1.2); pb.set(bx + sw, y + 8 - j, c); if (j > 2 && j % 3 === 0) { pb.set(bx + sw - 2, y + 8 - j, c); pb.set(bx + sw + 2, y + 7 - j, c); glow.set(bx + sw - 3, y + 7 - j, tip); glow.set(bx + sw + 3, y + 6 - j, tip); } }
        glow.set(bx, y + 7 - h, tip);
        A.lights.push({ x: bx, y: y + 4 - h / 2, r: 18, col: [0.3 + (k % 4 === 0 ? 0.5 : 0), 0.7, 0.8], k: 0.35 });
      }
      for (let k = 0; k < 4; k++) oval(pb, x - 26 + k * 18, y + 9, 5, 2, (X, Y, d) => pb.set(X, Y, d > 0.6 ? "#6a7a70" : "#8a9a88"));
      A.anim.push({ id: "reefglow", x, y, s }, { id: "fish", x, y: y - 6, rx: 30, ry: 6, small: true });
    },
    icesteps(pb, glow, T, x, y, s, A) {
      const cx = x + 22, top = 4;
      const step = (k, front) => {
        const a = k * 0.75, sx = cx + Math.cos(a) * 20, sy = FL + 26 - k * 7;
        if ((Math.sin(a) > 0) !== front) return;
        pb.rect(sx - 7, sy - 2, 14, 3, front ? "#b4ccdc" : "#7a98b0"); pb.rect(sx - 7, sy - 3, 14, 1, front ? "#f4faff" : "#a8c0d4"); pb.rect(sx - 7, sy + 1, 14, 1, "#4a6680");
      };
      for (let k = 0; k < 13; k++) step(k, false);
      for (let yy = top; yy < FL + 30; yy++) for (let i = -5; i <= 5; i++) pb.set(cx + i, yy, i < -3 ? "#d8f0fa" : i > 3 ? "#5a7a98" : (yy + i * 3) % 11 === 0 ? "#e8f8ff" : "#9ab8d0");
      for (let k = 0; k < 13; k++) step(k, true);
      for (let k = 0; k < 4; k++) glow.set(cx - 4, top + 8 + k * 14, "#ffffff");
    },
    clams(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 4; k++) {
        const cx = x - 30 + k * 18, cy = y + 6 + (k % 2) * 3;
        oval(pb, cx, cy, 6, 3, (X, Y, d, i, j) => pb.set(X, Y, j < 0 ? (i % 2 ? "#b8a8c8" : "#d8c8e0") : "#8a7a9a"));
        pb.rect(cx - 5, cy, 11, 1, "#3a2a3a"); glow.set(cx, cy - 1, "#fff8f0"); glow.set(cx + 1, cy - 1, "#e8e0f0");
      }
      A.anim.push({ id: "glint", pts: [[x - 30, y + 5], [x + 6, y + 5], [x + 24, y + 8]] });
    },
    kelp(pb, glow, T, x, y, s, A) { A.anim.push({ id: "kelp", x: x - 30, y: y + 10, n: 7, h: 34 }); },
    bubbles(pb, glow, T, x, y, s, A) {
      for (let i = 0; i < 70; i++) { const yy = y + 2 + Math.round(Math.sin(i * 0.2) * 1.5); pb.set(x - 10 + i, yy, "#a8d8e0", 0.6); pb.set(x - 10 + i, yy + 1, "#6aa0b0", 0.4); }
      A.anim.push({ id: "bubbles", x: x + 25, y: FL + 20, w: 60 });
    },
    ship(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 5; k++) { const rx = x - 6 + k * 13; for (let j = 0; j < 46; j++) { const bend = Math.round(Math.sin((j / 46) * Math.PI) * 5); pb.rect(rx + bend, y + 4 + j, 3, 1, j % 9 === 0 ? WOOD[1] : WOOD[2]); pb.set(rx + bend, y + 4 + j, WOOD[3]); } }
      for (let i = 0; i < 64; i++) pb.set(x - 8 + i, y + 6 + Math.round(Math.sin(i / 10)), WOOD[3]);
      const wx = x + 66, wy = y + 30;
      for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; pb.line(wx, wy, Math.round(wx + Math.cos(t) * 9), Math.round(wy + Math.sin(t) * 9), WOOD[2]); }
      for (let a = 0; a < 40; a++) { const t = (a / 40) * Math.PI * 2; P8(pb, wx + Math.cos(t) * 6, wy + Math.sin(t) * 6, WOOD[3]); }
      pb.rect(wx - 1, wy - 1, 3, 3, GOLD[2]);
    },
    waterfall(pb, glow, T, x, y, s, A) {
      const ice = A.theme === "ice";
      for (let yy = y; yy < FL + 4; yy++) for (let i = 0; i < 16; i++) pb.set(x + 20 + i + Math.round(Math.sin(yy * 0.15)), yy, ice ? (i % 4 === 0 ? "#f4faff" : i < 3 ? "#d8f0fa" : "#9ac0d8") : i % 5 === 0 ? "#b8e0f0" : "#4a8aa8");
      oval(pb, x + 28, FL + 6, 22, 4, (X, Y, d) => pb.set(X, Y, d > 0.7 ? T.ramp[3] : ice ? "#c8e0f0" : "#2a5a70"));
      if (!ice) A.anim.push({ id: "falls", x: x + 20, y, w: 16 });
    },
    forge(pb, glow, T, x, y, s, A) {
      const hx = x + 6, hy = y + 26;
      pb.rect(hx - 2, hy - 2, 34, 26, T.ramp[3]); pb.rect(hx, hy, 30, 22, "#120806");
      for (let i = 0; i < 30; i++) for (let j = 14; j < 22; j++) if (hash(i, j, s) < 0.6) glow.set(hx + i, hy + j, j > 18 ? "#ff9a30" : hash(i, j, s + 1) < 0.4 ? "#ffcf5a" : "#e04a1a");
      pb.rect(hx + 8, 0, 14, hy - 2, T.ramp[2]); pb.rect(hx + 8, 0, 1, hy - 2, T.ramp[4]);
      A.lights.push({ x: hx + 15, y: hy + 16, r: 46, col: [1, 0.55, 0.2], k: 0.9, flick: hx });
      const ax = x + 50, ay = FL + 14;
      pb.rect(ax - 2, ay - 4, 5, 4, IRON[1]); pb.rect(ax - 7, ay - 9, 16, 5, IRON[2]); pb.rect(ax - 7, ay - 9, 16, 1, IRON[4]); pb.rect(ax + 9, ay - 8, 4, 2, IRON[2]);
      A.anim.push({ id: "embers", x: hx + 15, y: hy + 14 });
    },
    organ(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 11; k++) { const h = 18 + Math.round(Math.sin((k / 10) * Math.PI) * 24), px = x + k * 5; pb.rect(px, y + 44 - h, 4, h, GOLD[2]); pb.rect(px, y + 44 - h, 1, h, GOLD[4]); pb.rect(px + 3, y + 44 - h, 1, h, GOLD[0]); pb.rect(px + 1, y + 46 - h, 2, 2, "#1a1008"); }
      pb.rect(x - 3, y + 44, 60, FL - y - 44, WOOD[2]); pb.rect(x - 3, y + 44, 60, 1, WOOD[4]);
      for (let i = 0; i < 26; i++) pb.set(x + 2 + i * 2, y + 47, i % 3 ? "#e8e0d0" : "#1a1410");
    },
    bell(pb, glow, T, x, y, s, A) { pb.rect(x, y + 2, 50, 3, WOOD[2]); pb.rect(x, y + 2, 50, 1, WOOD[4]); A.anim.push({ id: "bell", x: x + 25, y: y + 5 }); },
    clock(pb, glow, T, x, y, s, A) {
      const cx = x + 26, cy = y + 24;
      oval(pb, cx, cy, 15, 15, (X, Y, d) => pb.set(X, Y, d > 0.82 ? GOLD[2] : d > 0.72 ? GOLD[0] : "#e8dcc0"));
      for (let k = 0; k < 12; k++) { const t = (k / 12) * Math.PI * 2; P8(pb, cx + Math.cos(t) * 11, cy + Math.sin(t) * 11, "#2a1a10"); }
      pb.rect(cx - 1, cy + 15, 3, FL - cy - 15, WOOD[2]);
      A.anim.push({ id: "hands", x: cx, y: cy });
    },
    shelves(pb, glow, T, x, y, s, A) {
      const BK = ["#7a2a20", "#2a4a6a", "#3e5a2a", "#8a6a2a", "#5a3a5a", "#a87a3a"];
      for (let r = 0; r < 4; r++) {
        const yy = y + 8 + r * 12;
        pb.rect(x - 2, yy + 10, 58, 2, WOOD[2]); pb.rect(x - 2, yy + 10, 58, 1, WOOD[4]);
        for (let i = 0, bx = x; bx < x + 52; i++) { const bw = 2 + Math.floor(hash(i, r, s) * 3), bh = 6 + Math.floor(hash(i, r + 9, s) * 4); if (hash(i, r + 3, s) < 0.85) { pb.rect(bx, yy + 10 - bh, bw, bh, BK[(i + r * 2) % 6]); pb.set(bx, yy + 10 - bh, mix(BK[(i + r * 2) % 6], "#ffffff", 0.3)); } bx += bw + (hash(i, r + 5, s) < 0.15 ? 3 : 0); }
      }
      pb.rect(x - 4, y + 4, 2, FL - y - 4, WOOD[1]); pb.rect(x + 56, y + 4, 2, FL - y - 4, WOOD[1]);
    },
    kitchen(pb, glow, T, x, y, s, A) {
      pb.rect(x - 34, y - 2, 46, 3, WOOD[3]); pb.rect(x - 34, y - 2, 46, 1, WOOD[4]); pb.rect(x - 32, y + 1, 2, 9, WOOD[1]); pb.rect(x + 8, y + 1, 2, 9, WOOD[1]);
      for (let k = 0; k < 4; k++) oval(pb, x - 30 + k * 11, y - 5, 3, 2, (X, Y, d, i, j) => pb.set(X, Y, j < 0 ? IRON[3] : IRON[1]));
      oval(pb, x + 26, y + 6, 8, 5, (X, Y, d, i, j) => pb.set(X, Y, j < -3 ? IRON[3] : d > 0.7 ? IRON[0] : IRON[1]));
      for (let k = 0; k < 4; k++) { const hx = x - 26 + k * 14; pb.line(hx, 2, hx, 10 + (k % 2) * 4, "#8a7a5a"); oval(pb, hx, 14 + (k % 2) * 4, 2, 4, (X, Y, d, i) => pb.set(X, Y, k % 2 ? "#5a7a2a" : i < 0 ? "#a85a3a" : "#7a3a22")); }
      A.anim.push({ id: "steam", x: x + 26, y });
    },
    bunks(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 2; k++) {
        const bx = x + k * 30;
        pb.rect(bx, y + 14, 2, FL - y - 14, WOOD[1]); pb.rect(bx + 24, y + 14, 2, FL - y - 14, WOOD[1]);
        for (const by of [y + 26, FL - 8]) { pb.rect(bx, by, 26, 3, WOOD[2]); pb.rect(bx + 2, by - 3, 22, 3, k ? "#5a3a3a" : "#3a4a5a"); pb.rect(bx + 2, by - 3, 6, 2, "#d8d0bc"); }
      }
    },
    throne(pb, glow, T, x, y, s, A) {
      const ice = A.theme === "ice", c = ice ? ["#5a7a98", "#9ab8d0", "#d8f0fa"] : [T.ramp[1], T.ramp[3], T.ramp[4]];
      pb.rect(x - 14, y - 34, 28, 40, c[0]); pb.rect(x - 12, y - 32, 24, 36, c[1]); pb.rect(x - 12, y - 32, 24, 1, c[2]);
      pb.rect(x - 18, y - 8, 36, 6, c[1]); pb.rect(x - 18, y - 8, 36, 1, c[2]); pb.rect(x - 20, y - 2, 40, 8, c[0]);
      for (let k = 0; k < 3; k++) pb.rect(x - 9 + k * 8, y - 40, 3, 6, ice ? c[2] : GOLD[2]);
    },
    glowshrooms(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 7; k++) {
        const mx = x - 30 + k * 10 + Math.floor(hash(k, 1, s) * 4), h = 3 + Math.floor(hash(k, 2, s) * 6), r = 2 + (k % 3);
        pb.rect(mx, y + 8 - h, 1, h, "#c8d8a8");
        for (let i = -r; i <= r; i++) { glow.set(mx + i, y + 8 - h, Math.abs(i) < r ? "#b0f0c0" : "#5ac090"); if (Math.abs(i) < r - 1) glow.set(mx + i, y + 7 - h, "#e0fff0"); }
        A.lights.push({ x: mx, y: y + 6 - h, r: 16, col: [0.35, 0.95, 0.6], k: 0.35 });
      }
      A.anim.push({ id: "spores", x, y });
    },
    webs(pb, glow, T, x, y, s, A) {
      for (const [cx, cy, d, n] of [[6, 2, 1, 26], [W - 7, 2, -1, 22], [x + 30, 2, 1, 14]]) {
        for (let k = 0; k < 6; k++) { const a = (k / 5) * (Math.PI / 2); pb.line(cx, cy, Math.round(cx + d * Math.cos(a) * n), Math.round(cy + Math.sin(a) * n), "#d8d4cc", 0.55); }
        for (let r = 4; r < n; r += 4) for (let k = 0; k <= 12; k++) { const a = (k / 12) * (Math.PI / 2); P8(pb, cx + d * Math.cos(a) * r, cy + Math.sin(a) * r, "#e8e4dc", 0.5); }
      }
      for (let k = 0; k < 3; k++) oval(pb, x + 10 + k * 7, y + 30 + (k % 2) * 3, 2, 3, (X, Y, d, i) => pb.set(X, Y, i < 0 ? "#f0ece0" : "#c8c0b0"));
    },
    coins(pb, glow, T, x, y, s, A) {
      for (const [cx, w] of [[x - 18, 14], [x + 14, 10]]) for (let j = 0; j < 7; j++) for (let i = -w + j * 2; i <= w - j * 2; i++) pb.set(cx + i, y + 8 - j, (i + j) % 3 === 0 ? GOLD[4] : (i + j) % 2 ? GOLD[3] : GOLD[2]);
      A.anim.push({ id: "glint", pts: [[x - 26, y + 2], [x + 22, y + 2], [x - 6, y + 6]] });
    },
    statues(pb, glow, T, x, y, s, A) {
      const R = [T.ramp[1], T.ramp[2], T.ramp[3], T.ramp[4]];
      for (let k = 0; k < 2; k++) {
        const sx = x + 6 + k * 40;
        pb.rect(sx - 7, FL - 8, 14, 8, R[1]); pb.rect(sx - 7, FL - 8, 14, 1, R[3]);
        for (let j = 0; j < 34; j++) { const hw = j < 7 ? 3 : j < 10 ? 2 : 3 + Math.floor((j - 10) / 6); for (let i = -hw; i <= hw; i++) pb.set(sx + i, FL - 42 + j, i < -hw + 1 ? R[3] : i > hw - 2 ? R[0] : R[2]); }
        pb.set(sx - 1, FL - 38, R[0]); pb.set(sx + 1, FL - 38, R[0]);
      }
    },
    quay(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 3; k++) { const px = x - 30 + k * 24; pb.rect(px, y - 8, 5, 14, WOOD[2]); pb.rect(px, y - 8, 5, 1, WOOD[4]); pb.rect(px + 4, y - 7, 1, 13, WOOD[0]); for (let q = 0; q < 3; q++) pb.set(px + 1 + q, y - 2, "#c8c0a8"); }
      for (let i = 0; i < 48; i++) pb.set(x - 28 + i, y - 4 + Math.round(Math.sin((i / 24) * Math.PI) * 3), "#b89a6a");
    },
    lava(pb, glow, T, x, y, s, A) {
      for (let i = -40; i <= 40; i++) for (let j = 0; j < 5; j++) { const yy = y + 2 + j + Math.round(Math.sin(i * 0.12) * 1.5); glow.set(x + i, yy, j === 0 || j === 4 ? "#a83010" : hash(i, j, s) < 0.3 ? "#ffcf5a" : "#ff8a20"); }
      A.lights.push({ x, y: y + 4, r: 60, col: [1, 0.45, 0.15], k: 0.8, flat: 2 });
      A.anim.push({ id: "lava", x, y: y + 2 });
    },
    cart(pb, glow, T, x, y, s, A) {
      for (let i = -50; i <= 50; i++) { pb.set(x + i, y + 8, IRON[3]); pb.set(x + i, y + 11, IRON[3]); if (i % 6 === 0) pb.rect(x + i - 1, y + 7, 3, 6, WOOD[1]); }
      pb.rect(x - 10, y - 3, 20, 9, IRON[1]); pb.rect(x - 10, y - 3, 20, 1, IRON[3]); pb.rect(x - 11, y - 4, 22, 1, IRON[2]);
      for (let i = 0; i < 16; i++) pb.set(x - 8 + i, y - 4 - Math.round(Math.sin((i / 15) * Math.PI) * 3), i % 3 ? "#5a5050" : "#c8a050");
      for (const wx of [x - 6, x + 6]) oval(pb, wx, y + 7, 2, 2, (X, Y, d) => pb.set(X, Y, d > 0.4 ? IRON[0] : IRON[3]));
    },
    winch(pb, glow, T, x, y, s, A) {
      pb.rect(x + 4, y, 3, FL - y, WOOD[2]); pb.rect(x + 44, y, 3, FL - y, WOOD[2]); pb.rect(x + 2, y, 48, 3, WOOD[3]); pb.rect(x + 2, y, 48, 1, WOOD[4]);
      oval(pb, x + 25, y + 8, 6, 4, (X, Y, d) => pb.set(X, Y, d > 0.6 ? WOOD[1] : WOOD[3]));
      pb.line(x + 25, y + 12, x + 25, y + 36, "#a88a5a"); pb.rect(x + 21, y + 36, 9, 7, WOOD[2]); pb.rect(x + 21, y + 36, 9, 1, IRON[3]);
    },
    bonepile(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 40; k++) { const bx = x - 22 + hash(k, 1, s) * 44, by = y + 8 - hash(k, 2, s) * 10 * (1 - Math.abs(bx - x) / 26); pb.rect(Math.round(bx), Math.round(by), 3 + (k % 3), 1, BONE[2 + (k % 3)]); }
      for (let k = 0; k < 4; k++) skull(pb, x - 14 + k * 8, y + 4 - (k % 2) * 3);
    },
    roots(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 7; k++) { let cx = x + k * 9 + Math.floor(hash(k, 1, s) * 5); const len = 14 + Math.floor(hash(k, 2, s) * 30); for (let j = 0; j < len; j++) { const w = Math.max(1, 3 - Math.floor(j / 10)); pb.rect(cx, j, w, 1, j % 6 ? "#4a3220" : "#6a4a2e"); if (hash(j, k, s) < 0.2) cx += hash(j, k, s + 1) < 0.5 ? 1 : -1; } }
    },
    reeds(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 22; k++) { const rx = x - 34 + k * 3 + Math.floor(hash(k, 1, s) * 2), h = 10 + Math.floor(hash(k, 2, s) * 14); for (let j = 0; j < h; j++) pb.set(rx + Math.round(j * 0.08 * ((k % 3) - 1)), y + 8 - j, j > h - 4 && k % 4 === 0 ? "#6a4a22" : j % 4 ? "#4a6a2a" : "#6a8a3a"); }
    },
    trophies(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 3; k++) { const tx = x + 6 + k * 20, ty = y + 18 + (k % 2) * 6; pb.rect(tx - 4, ty, 9, 7, WOOD[2]); skull(pb, tx - 2, ty + 5); for (const d of [-1, 1]) { pb.line(tx + d * 2, ty, tx + d * 7, ty - 6, BONE[3]); pb.line(tx + d * 6, ty - 4, tx + d * 6, ty - 8, BONE[3]); } }
    },
    cages(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 2; k++) { const cx = x + k * 30; pb.rect(cx, y + 18, 26, 2, IRON[3]); pb.rect(cx, FL - 16, 26, 16, WOOD[2]); pb.rect(cx, FL - 16, 26, 1, WOOD[4]); for (let i = 0; i < 26; i += 3) pb.rect(cx + i, y + 18, 1, FL - 16 - y - 18, IRON[2]); }
    },
    weapons(pb, glow, T, x, y, s, A) {
      pb.rect(x, y + 34, 56, 2, WOOD[2]); pb.rect(x, y + 14, 56, 2, WOOD[2]);
      for (let k = 0; k < 7; k++) { const wx = x + 4 + k * 8; pb.rect(wx, y + 12, 1, 28, k % 2 ? WOOD[3] : IRON[3]); if (k % 2) { pb.rect(wx - 2, y + 10, 5, 4, IRON[3]); pb.set(wx - 2, y + 10, IRON[4]); } else { pb.rect(wx - 1, y + 36, 3, 1, GOLD[2]); pb.set(wx, y + 11, IRON[4]); } }
    },
    lanterns(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 3; k++) { const lx = x + 6 + k * 22, ly = y + 6 + (k % 2) * 6; pb.line(lx, 0, lx, ly, IRON[2]); A.anim.push({ id: "lantern", x: lx, y: ly }); }
    },
    iceblocks(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 5; k++) { const bx = x - 26 + (k % 3) * 16 + (k > 2 ? 8 : 0), by = y + 8 - (k > 2 ? 9 : 0); pb.rect(bx, by - 9, 14, 9, "#9ac0d8"); pb.rect(bx, by - 9, 14, 1, "#f4faff"); pb.rect(bx, by - 9, 1, 9, "#d8f0fa"); pb.rect(bx + 13, by - 9, 1, 9, "#4a6a88"); pb.line(bx + 3, by - 7, bx + 8, by - 3, "#e8f8ff"); }
      for (let i = 0; i < 40; i++) P8(pb, x - 30 + hash(i, 1, s) * 60, 4 + hash(i, 2, s) * 50, "#e8f8ff", 0.7);
    },
    barrels(pb, glow, T, x, y, s, A) { for (let k = 0; k < 4; k++) barrel(pb, x - 24 + k * 11, y + 8, 9, 13); barrel(pb, x - 18, y - 5, 9, 12); barrel(pb, x - 7, y - 5, 9, 12); },
    kennel(pb, glow, T, x, y, s, A) { for (let k = 0; k < 2; k++) { const kx = x - 26 + k * 28; pb.rect(kx, y - 6, 22, 14, WOOD[2]); pb.rect(kx - 2, y - 8, 26, 3, WOOD[3]); pb.rect(kx + 7, y, 8, 8, "#0a0806"); } for (let k = 0; k < 6; k++) pb.rect(x - 30 + k * 10, y + 9, 4, 1, BONE[3]); },
    altar(pb, glow, T, x, y, s, A) {
      pb.rect(x + 8, y + 30, 36, 14, T.ramp[3]); pb.rect(x + 8, y + 30, 36, 1, T.ramp[4]); pb.rect(x + 12, y + 44, 28, FL - y - 44, T.ramp[2]);
      pb.rect(x + 24, y + 8, 4, 22, GOLD[2]); pb.rect(x + 18, y + 14, 16, 3, GOLD[2]); pb.set(x + 24, y + 8, GOLD[4]);
      for (let k = 0; k < 3; k++) { pb.rect(x + 12 + k * 12, y + 26, 2, 4, "#e8dcc0"); A.flames.push([x + 12 + k * 12, y + 22, 0]); }
    },
  };
  // liquids are painted on the world layer and lit, never on the glow layer, which would wash over anyone standing in front
  const SILT = ["#2c302c", "#3e443e", "#545a52", "#6c7268", "#868a7e", "#a4a696"];
  const HOT = ["#7a200a", "#b8400e", "#e8701c", "#ffa83a", "#ffd870", "#fff4c0"];
  function clearGlow(glow, x0, y0, x1, y1) { for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) glow.d[(y * W + x) * 4 + 3] = 0; }
  function postW(pb, x, y0, y1, c) { c = c || WOOD; pb.rect(x, y0, 3, y1 - y0, c[2]); pb.rect(x, y0, 1, y1 - y0, c[3]); pb.rect(x + 2, y0, 1, y1 - y0, c[0]); }
  Object.assign(PAINT, {
    salpools(pb, glow, T, x, y, s, A) {
      // shallow basins in a stepped stone floor: a raised lip of basalt, a black crust ring, then the glowing water, hottest at the heart
      const pools = [[40, FL + 10, 22, 5], [112, FL + 7, 26, 5], [166, FL + 13, 13, 4], [150, H - 4, 15, 2]];
      for (const [cx, cy, rx, ry] of pools) {
        clearGlow(glow, cx - rx - 5, cy - ry - 4, cx + rx + 5, cy + ry + 4);
        oval(pb, cx, cy + 1, rx + 4, ry + 3, (X, Y, d, i, j) => pb.set(X, Y, d > 0.86 ? (j < 0 ? mix(T.ramp[4], "#ffb060", 0.25) : "#0e0604") : j < 0 ? (Y % 2 ? T.ramp[3] : T.ramp[4]) : T.ramp[1]));
        oval(pb, cx, cy, rx + 1, ry + 1, (X, Y, d) => pb.set(X, Y, d > 0.8 ? "#1a0806" : null));
        oval(pb, cx, cy, rx, ry, (X, Y, d, i, j) => {
          const crust = vnoise(X / 5, Y / 1.5, s + cx) > 0.7 && d > 0.25;
          pb.set(X, Y, crust ? (j < 0 ? "#5a2410" : "#3a1408") : pick(HOT, 0.98 - d * 0.75 + (vnoise(X / 4, Y, s) - 0.5) * 0.25, X, Y));
        });
        for (let k = 2; k < rx * 2 - 2; k += 5) pb.set(cx - rx + k, cy - ry + 1, HOT[5]);
        A.lights.push({ x: cx, y: cy - 4, r: rx * 2 + 30, col: [1, 0.5, 0.18], k: 1.1, flat: 1.6 });
      }
      for (const [ax, ay] of [[70, FL + 20], [140, FL + 2], [8, H - 10]]) for (let k = 0; k < 5; k++) pb.set(ax + k * 2, ay + (k % 2), k % 2 ? "#5a2a14" : "#8a3a16");
      A.anim.push({ id: "salpools", pools });
    },
    silt(pb, glow, T, x, y, s, A) {
      clearGlow(glow, 0, FL - 12, W, H);
      const bank = (xx) => FL - 7 + Math.sin(xx * 0.045 + s) * 3.5 + Math.sin(xx * 0.17 + 2) * 1.2;
      for (let yy = FL - 12; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
        const top = bank(xx);
        if (yy < top) continue;
        const k = (yy - FL) / (H - FL), vo = voronoi(xx, yy * 2.8, 17, 17, s + 70), e = vo.d2 - vo.d1;
        let v = 0.42 + Math.sin(xx * 0.05 + yy * 0.3 + s) * 0.1 + (fbm(xx / 9, yy / 3, s + 60) - 0.5) * 0.3 + k * 0.18;
        if (yy - top < 2) v += 0.3;
        if (yy > FL + 1 && e < 0.045) v -= 0.32; else if (yy > FL + 1 && e < 0.09) v += 0.1;
        if (A.sink) { const d = ((xx - 106) / 18) ** 2 + ((yy - 84) / 7) ** 2; if (d < 1) { v = 0.2 + d * 0.3 + (Math.floor(d * 5) % 2 ? 0.08 : 0); if (d < 0.35) v = 0.12; } else if (d < 1.25) v += 0.16; }
        pb.set(xx, yy, pick(SILT, v, xx, yy));
      }
      for (let k = 0; k < 9; k++) { const fx = 14 + k * 17, fy = 92 - k * 2.2 + (k % 2) * 3; pb.rect(fx, fy, 3, 1, SILT[1]); pb.set(fx + 1, fy - 1, SILT[0]); }
      for (let j = 0; j < 16; j++) for (let i = 0; i < 9; i++) { const top = FL - 9 + (i < 3 ? 2 : i < 6 ? 0 : 3); if (FL - 9 + j < top) continue; pb.set(156 + i, FL - 9 + j, i === 0 ? T.ramp[4] : i % 3 === 2 ? T.ramp[1] : i > 6 ? T.ramp[2] : T.ramp[3]); }
      for (let i = 0; i < 9; i++) pb.set(156 + i, FL - 9 + (i < 3 ? 2 : i < 6 ? 0 : 3), mix(T.ramp[4], "#ffffff", 0.2));
      oval(pb, 40, FL + 8, 4, 3, (X, Y, d, i) => pb.set(X, Y, i < 0 ? "#a8683a" : "#7a4a2a")); pb.rect(39, FL + 3, 3, 2, "#8a5a32");
      for (const [gx, gy] of [[70, 80], [132, 92], [24, 76]]) { pb.set(gx, gy, GOLD[4]); pb.set(gx + 1, gy, GOLD[2]); }
      A.anim.push({ id: "glint", pts: [[70, 80], [132, 92], [24, 76]] });
    },
    crack(pb, glow, T, x, y, s, A) {
      const ab = abyssOf(A.theme), end = A.mouth || [100, 88];
      const pts = [[18, FL + 4]];
      for (let k = 1; k <= 8; k++) pts.push([lerp(18, end[0] - 10, k / 8) + (hash(k, 1, s) - 0.5) * 6, lerp(FL + 4, end[1] - 1, k / 8) + (hash(k, 2, s) - 0.5) * 5]);
      // one column at a time along the line, the lit lip and the dark lip first and the gap over them, so the edges never break up
      const cols = [];
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
        for (let cx = Math.round(x0); cx < Math.round(x1); cx++) { const u = (cx - x0) / (x1 - x0), w = 1 + Math.floor(((k + u) / (pts.length - 1)) * 4); cols.push([cx, Math.round(lerp(y0, y1, u)), w]); }
        if (hash(k, 4, s) < 0.6) { let bx = x0, by = y0; const d = hash(k, 5, s) < 0.5 ? -1 : 1; for (let q = 0; q < 9; q++) { bx += 1; by += d * (hash(q, k, s) < 0.5 ? 1 : 0); pb.set(bx, by, ab[1]); pb.set(bx, by - 1, T.framp[3], 0.5); } }
      }
      for (const [cx, cy, w] of cols) { pb.set(cx, cy - w - 1, mix(T.framp[3], "#ffffff", 0.5)); pb.set(cx, cy - w - 2, T.framp[3], 0.7); pb.set(cx, cy + w + 1, mix(T.framp[0], "#000000", 0.5)); }
      for (const [cx, cy, w] of cols) for (let j = -w; j <= w; j++) pb.set(cx, cy + j, Math.abs(j) === w ? ab[2] : Math.abs(j) === w - 1 ? ab[1] : ab[0]);
      if (A.theme === "sea") for (const [cx, cy, w] of cols) if (w > 1 && cx % 6 < 2) pb.set(cx, cy, "#4a90a0");
      for (const [sx, sy, w] of [[40, FL + 13, 12], [76, FL + 21, 14], [118, H - 6, 13]]) { pb.rect(sx, sy, w, 4, T.framp[3]); pb.rect(sx, sy, w, 1, mix(T.framp[3], "#ffffff", 0.4)); pb.rect(sx + w, sy + 1, 1, 3, T.framp[0]); pb.rect(sx, sy + 4, w + 1, 2, mix(T.framp[0], "#000000", 0.6)); }
      rubble(pb, T, end[0] - 22, end[1] + 6, 7, s + 5); rubble(pb, T, 30, FL + 10, 4, s + 6);
      if (A.mouth) A.anim.push({ id: "breath", x: end[0], y: end[1], sea: A.theme === "sea" });
    },
    gate(pb, glow, T, x, y, s, A) {
      const x0 = x, x1 = x + 50, top = y + 6, mid = (x0 + x1) / 2, bars = /gold/.test(A.name) ? GOLD : IRON;
      for (let yy = top - 6; yy < FL; yy++) for (let xx = x0 - 6; xx < x1 + 6; xx++) {
        const inside = xx >= x0 && xx < x1 && (yy >= top + 12 || ((xx - mid) / 25) ** 2 + ((yy - top - 12) / 12) ** 2 <= 1);
        const ring = !inside && (yy >= top + 12 ? xx >= x0 - 6 && xx < x1 + 6 : ((xx - mid) / 31) ** 2 + ((yy - top - 12) / 18) ** 2 <= 1);
        if (inside) pb.set(xx, yy, mix(T.ramp[1], "#000000", 0.55 - (yy - top) / 120 + (vnoise(xx / 5, yy / 5, s) - 0.5) * 0.2));
        else if (ring) { const blk = Math.floor(Math.atan2(yy - top - 12, xx - mid) * 4); pb.set(xx, yy, (yy >= top + 12 ? (yy % 8 === 0 || (xx - x0 + 6) % 6 === 0) : blk % 2 === 0 && hash(blk, 1, s) < 0.3) ? T.ramp[0] : pick(T.ramp, 0.6 + (hash(blk, yy >> 3, s) - 0.5) * 0.3, xx, yy)); }
      }
      for (let bx = x0 + 3; bx < x1; bx += 6) { const by = top + 12 - Math.round(Math.sqrt(Math.max(0, 1 - ((bx - mid) / 25) ** 2)) * 12); pb.rect(bx, by, 2, FL - 6 - by, bars[2]); pb.rect(bx, by, 1, FL - 6 - by, bars[4]); pb.rect(bx, FL - 6, 2, 3, bars[3]); pb.set(bx, FL - 3, bars[4]); }
      for (const hy of [top + 20, top + 36]) { pb.rect(x0 + 1, hy, x1 - x0 - 2, 2, bars[2]); pb.rect(x0 + 1, hy, x1 - x0 - 2, 1, bars[3]); }
      pb.rect(x1 + 2, top + 16, 2, 22, IRON[1]); pb.rect(x1 + 1, top + 38, 4, 3, IRON[3]);
    },
    arches(pb, glow, T, x, y, s, A) {
      const cols = [x - 18, x + 16, x + 50, x + 84].filter((c) => c > 4 && c < W - 8);
      for (let k = 0; k < cols.length - 1; k++) {
        const a = cols[k] + 6, b = cols[k + 1], mid = (a + b) / 2, rx = (b - a) / 2;
        for (let yy = y + 4; yy < FL; yy++) for (let xx = a; xx < b; xx++) {
          const spring = y + 18, inArch = yy >= spring || ((xx - mid) / rx) ** 2 + ((yy - spring) / 12) ** 2 <= 1;
          if (inArch) pb.set(xx, yy, mix(pb.get(xx, yy) || T.ramp[1], "#000000", 0.42 - (yy - spring) * 0.004));
          else if (((xx - mid) / (rx + 3)) ** 2 + ((yy - spring) / 15) ** 2 <= 1) pb.set(xx, yy, yy % 4 === 0 ? T.ramp[1] : T.ramp[3]);
        }
      }
      for (const cx of cols) { pb.rect(cx, y + 12, 6, FL - y - 12, T.ramp[3]); pb.rect(cx, y + 12, 1, FL - y - 12, T.ramp[4]); pb.rect(cx + 5, y + 12, 1, FL - y - 12, T.ramp[0]); pb.rect(cx - 2, y + 10, 10, 3, T.ramp[4]); pb.rect(cx - 2, FL - 4, 10, 4, T.ramp[2]); pb.rect(cx - 2, FL - 4, 10, 1, T.ramp[4]); }
    },
    stakes(pb, glow, T, x, y, s, A) {
      for (let i = -44; i <= 44; i++) pb.set(x + i, y + 7, mix(T.framp[2], "#000000", 0.2));
      for (let k = 0; k < 10; k++) {
        const sx = x - 42 + k * 9 + Math.floor(hash(k, 1, s) * 3), h = 14 + Math.floor(hash(k, 2, s) * 8), lean = hash(k, 3, s) < 0.5 ? 0 : 1;
        for (let j = 0; j < h; j++) { const w = j > h - 4 ? Math.max(1, 3 - (j - (h - 4))) : 3, ox = Math.round(j * 0.08 * lean); pb.rect(sx + ox, y + 6 - j, w, 1, WOOD[2]); pb.set(sx + ox, y + 6 - j, WOOD[3]); if (j > h - 3) pb.set(sx + ox, y + 6 - j, "#d8c8a0"); }
        pb.rect(sx - 1, y + 1, 5, 1, "#8a7a5a");
      }
    },
    shed(pb, glow, T, x, y, s, A) {
      if (["goblin", "beast", "swamp"].includes(A.theme)) {
        const H2 = ["#5a4228", "#7a5a36", "#9a7a4a", "#b89a62"], cx = x + 26;
        for (let yy = y + 6; yy < FL; yy++) { const hw = Math.round((yy - y - 6) * 0.62); for (let xx = cx - hw; xx <= cx + hw; xx++) { const patch = (Math.floor((xx + 40) / 9) + Math.floor(yy / 11)) % 3; pb.set(xx, yy, xx === cx - hw || xx === cx + hw ? H2[0] : (xx - cx + 40) % 9 === 0 && yy % 2 ? "#3a2a18" : H2[1 + patch]); } }
        for (let yy = y + 26; yy < FL; yy++) { const hw = Math.round((yy - y - 26) * 0.32); for (let xx = cx - hw; xx <= cx + hw; xx++) pb.set(xx, yy, mix("#2a1a0e", "#5a3a20", (cx + hw - xx) / (2 * hw + 1) * 0.5)); }
        pb.line(cx - 4, y, cx + 4, y + 10, WOOD[2]); pb.line(cx + 4, y, cx - 4, y + 10, WOOD[3]);
        pb.line(cx - 30, FL - 1, cx - 22, FL - 14, "#a88a5a"); pb.line(cx + 30, FL - 1, cx + 22, FL - 14, "#a88a5a");
        return;
      }
      pb.rect(x, y + 14, 3, FL - y - 14, WOOD[1]); pb.rect(x + 50, y + 20, 3, FL - y - 20, WOOD[1]);
      for (let k = 0; k < 8; k++) { const yy = y + 12 + k * 2; pb.line(x - 4, yy - 4, x + 56, yy + 4, k === 0 ? WOOD[4] : k % 2 ? WOOD[2] : WOOD[3]); }
      for (let xx = x + 3; xx < x + 50; xx++) for (let yy = y + 24; yy < FL; yy++) pb.set(xx, yy, (xx - x) % 7 === 0 ? WOOD[1] : yy % 13 === 0 ? WOOD[1] : (xx - x) % 7 === 1 ? WOOD[3] : WOOD[2]);
      pb.rect(x + 18, y + 34, 14, FL - y - 34, WOOD[1]); pb.rect(x + 19, y + 35, 12, FL - y - 35, mix(WOOD[2], "#000000", 0.2)); pb.rect(x + 28, y + 46, 2, 2, IRON[3]);
      pb.rect(x + 38, y + 30, 8, 6, "#2a2018"); pb.rect(x + 39, y + 31, 6, 4, "#e8b860"); pb.rect(x + 41, y + 31, 1, 4, WOOD[1]);
      A.lights.push({ x: x + 42, y: y + 33, r: 18, col: [1, 0.75, 0.4], k: 0.4 });
    },
    laundry(pb, glow, T, x, y, s, A) {
      const C = ["#c8b8a0", "#8a5a4a", "#5a6a7a", "#a89a6a", "#e0d8c8", "#6a7a4a"], sag = (xx) => y + 10 + Math.round(Math.sin(((xx - x + 4) / 76) * Math.PI) * 6);
      postW(pb, x - 6, y + 6, FL); postW(pb, x + 70, y + 6, FL);
      for (let xx = x - 4; xx < x + 70; xx++) pb.set(xx, sag(xx), "#a88a5a");
      for (let k = 0; k < 6; k++) {
        const gx = x + 2 + k * 11, gy = sag(gx + 3), c = C[(k + s) % 6], w = k % 3 === 2 ? 6 : 9, h = k % 3 === 2 ? 8 : 14;
        pb.rect(gx, gy, w, h, c); pb.rect(gx, gy, w, 1, mix(c, "#ffffff", 0.25)); pb.rect(gx + w - 1, gy, 1, h, mix(c, "#000000", 0.3));
        if (k % 3 === 0) { pb.rect(gx - 2, gy, 2, 5, c); pb.rect(gx + w, gy, 2, 5, c); }
        pb.set(gx + 1, gy - 1, WOOD[3]); pb.set(gx + w - 2, gy - 1, WOOD[3]);
      }
    },
    totems(pb, glow, T, x, y, s, A) {
      const hair = /hair/.test(A.name);
      for (let k = 0; k < (hair ? 22 : 6); k++) {
        const sx = x + (hair ? k * 3 : k * 10) + Math.floor(hash(k, 1, s) * 3), len = hair ? 30 + Math.floor(hash(k, 2, s) * 20) : 12 + Math.floor(hash(k, 2, s) * 18);
        let cx = sx;
        for (let j = 0; j < len; j++) { pb.set(cx, j, hair ? ["#5a4a38", "#8a7a62", "#b8a888"][k % 3] : "#8a7a5a"); if (hair && k % 2) pb.set(cx + 1, j, "#3a2e22"); if (hash(j, k, s) < 0.12) cx += hash(j, k, s + 1) < 0.5 ? 1 : -1; }
        if (!hair) { const ty = len; if (k % 3 === 0) skull(pb, cx - 2, ty + 5); else if (k % 3 === 1) { pb.rect(cx - 1, ty, 2, 6, BONE[3]); pb.rect(cx - 2, ty, 4, 1, BONE[4]); } else { pb.line(cx, ty, cx - 2, ty + 7, "#c86a3a"); pb.line(cx, ty, cx + 1, ty + 7, "#e8c050"); } for (let q = 0; q < 3; q++) pb.set(cx, ty - 3 - q * 3, ["#c84a3a", "#3a8a7a", "#e8c050"][q]); }
      }
      if (!hair) { const px = x + 64; postW(pb, px, y + 14, FL); skull(pb, px - 1, y + 14); skull(pb, px - 1, y + 22); pb.rect(px - 3, y + 10, 9, 2, "#c84a3a"); }
    },
    alembic(pb, glow, T, x, y, s, A) {
      pb.rect(x - 30, y - 2, 56, 3, WOOD[3]); pb.rect(x - 30, y - 2, 56, 1, WOOD[4]); pb.rect(x - 28, y + 1, 2, 9, WOOD[1]); pb.rect(x + 22, y + 1, 2, 9, WOOD[1]);
      const L = [["#3a8a3a", "#8ae070"], ["#a85a1a", "#f0b050"], ["#8a2a2a", "#e06050"]];
      [[x - 20, 6, 0], [x - 2, 9, 1], [x + 14, 5, 2]].forEach(([cx, r, k]) => {
        oval(pb, cx, y - 2 - r, r, r, (X, Y, d, i, j) => pb.set(X, Y, d > 0.8 ? "#c8d8d8" : j > -r * 0.2 ? L[k][0] : "#2a3436"));
        pb.rect(cx - 1, y - 4 - r * 2 - 5, 3, 6, "#a8b8b8"); pb.set(cx - r + 2, y - 2 - r - 2, "#ffffff"); pb.set(cx - 1, y - 1 - r, L[k][1]);
        A.lights.push({ x: cx, y: y - r, r: 14, col: D3(L[k][1]), k: 0.25 });
      });
      pb.line(x - 1, y - 24, x + 14, y - 18, "#a8b8b8"); pb.line(x + 14, y - 18, x + 14, y - 12, "#a8b8b8");
      for (let k = 0; k < 4; k++) { pb.rect(x - 34 + k * 5, y - 7, 3, 5, ["#5a6a6a", "#7a5a3a", "#6a7a4a", "#8a6a5a"][k]); pb.rect(x - 34 + k * 5, y - 8, 3, 1, "#c8b8a0"); }
      A.anim.push({ id: "steam", x: x - 2, y: y - 30 });
    },
    racks(pb, glow, T, x, y, s, A) {
      const what = /herb/.test(A.name) ? "herb" : /carcass/.test(A.name) ? "meat" : "hide";
      if (what === "hide") {
        // hides laced into stick frames and leant on the wall to dry
        for (let k = 0; k < 3; k++) {
          const fx0 = x + k * 22, fy0 = y + 14 + (k % 2) * 4, fw = 18, fh = FL - fy0 - 2, c = ["#9a7448", "#b88c5a", "#7a5a38"][k];
          pb.line(fx0, fy0, fx0 + 2, FL, WOOD[2]); pb.line(fx0 + fw, fy0, fx0 + fw + 2, FL, WOOD[1]); pb.rect(fx0 - 2, fy0, fw + 5, 1, WOOD[3]); pb.rect(fx0, FL - 4, fw + 3, 1, WOOD[2]);
          oval(pb, fx0 + fw / 2 + 1, fy0 + fh / 2, fw / 2 - 2, fh / 2 - 3, (X, Y, d, i, j) => pb.set(X, Y, d > 0.85 ? mix(c, "#000000", 0.35) : i < -2 && j < 0 ? mix(c, "#ffffff", 0.2) : (X + Y) % 7 === 0 ? mix(c, "#000000", 0.12) : c));
          for (let q = 0; q < 4; q++) { const ly = fy0 + 3 + q * Math.floor(fh / 4); pb.line(fx0 + 1, ly, fx0 + 4, ly + 1, "#d8c8a0"); pb.line(fx0 + fw - 3, ly + 1, fx0 + fw, ly, "#d8c8a0"); }
        }
        return;
      }
      for (const bx of [x, x + 36]) { pb.line(bx, FL, bx + 8, y + 10, WOOD[2]); pb.line(bx + 16, FL, bx + 8, y + 10, WOOD[1]); pb.line(bx + 20, FL, bx + 28, y + 10, WOOD[2]); pb.line(bx + 36, FL, bx + 28, y + 10, WOOD[1]); }
      pb.rect(x + 4, y + 10, 66, 2, WOOD[3]); pb.rect(x + 4, y + 10, 66, 1, WOOD[4]);
      for (let k = 0; k < 6; k++) {
        const hx = x + 8 + k * 10;
        if (what === "herb") { pb.line(hx, y + 12, hx, y + 16, "#8a7a5a"); oval(pb, hx, y + 22, 3, 6, (X, Y, d, i) => pb.set(X, Y, hash(X, Y, s) < 0.3 ? "#8aa04a" : i < 0 ? "#5a7a2a" : "#3e5a22")); }
        else if (what === "meat") { pb.line(hx, y + 12, hx, y + 15, IRON[3]); oval(pb, hx, y + 24, 4, 9, (X, Y, d, i) => pb.set(X, Y, d > 0.7 ? "#e8d0b8" : i < 0 ? "#a84a3a" : "#7a2e22")); }
        else { pb.rect(hx - 4, y + 12, 9, 18, k % 2 ? "#8a6a42" : "#a8845a"); pb.rect(hx - 4, y + 12, 9, 1, "#c8a878"); for (let j = 0; j < 18; j += 3) { pb.set(hx - 5, y + 12 + j, "#5a4028"); pb.set(hx + 5, y + 12 + j, "#5a4028"); } }
      }
    },
    bats(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 9; k++) { const bx = x + k * 7 + Math.floor(hash(k, 1, s) * 4), by = 2 + Math.floor(hash(k, 2, s) * 5); pb.rect(bx - 1, by, 5, 6, "#1a1414"); pb.rect(bx - 2, by + 1, 1, 4, "#2a2020"); pb.rect(bx + 4, by + 1, 1, 4, "#2a2020"); pb.rect(bx - 1, by, 1, 6, "#6a5a52"); pb.set(bx + 1, by - 1, "#4a3a34"); pb.set(bx, by + 4, "#ffb040"); pb.set(bx + 2, by + 4, "#ffb040"); for (let j = 0; j < 12 + k % 4 * 6; j += 2) pb.set(bx + 1, by + 8 + j + hash(j, k, s) * 2, "#b8b0a0", 0.5); }
      for (let i = 0; i < 60; i++) pb.set(x - 4 + hash(i, 3, s) * 70, FL + 2 + hash(i, 4, s) * 8, "#a8a090", 0.6);
      A.anim.push({ id: "bat", x: x + 30, y: 18 });
    },
    giantleg(pb, glow, T, x, y, s, A) {
      for (let xx = 0; xx < W; xx++) for (let yy = 0; yy < 16; yy++) pb.set(xx, yy, yy === 15 ? WOOD[0] : yy === 11 ? WOOD[4] : yy > 11 ? WOOD[2] : (xx * 2 + yy * 5) % 23 === 0 ? WOOD[1] : WOOD[3]);
      for (let xx = 4; xx < W; xx += 30) pb.rect(xx, 11, 2, 4, WOOD[1]);
      for (let yy = 16; yy < FL + 4; yy++) for (let xx = x + 10; xx < x + 32; xx++) { const t = (xx - x - 10) / 22; pb.set(xx, yy, t < 0.15 ? WOOD[4] : t > 0.82 ? WOOD[0] : (yy + Math.round(Math.sin(xx * 0.5) * 2)) % 9 === 0 ? WOOD[1] : WOOD[2]); }
      for (let k = 0; k < 7; k++) { pb.rect(x - 20 + k * 13, FL + 6 + (k % 3), 3, 2, "#c8a050"); pb.set(x - 20 + k * 13, FL + 6 + (k % 3), "#e8c878"); }
    },
    slipper(pb, glow, T, x, y, s, A) {
      oval(pb, x, y + 2, 34, 7, (X, Y, d, i, j) => pb.set(X, Y, d > 0.82 ? "#4a1a14" : j < -2 && i > -10 ? "#a84a3a" : i < -12 ? "#d8c8b0" : "#8a3a2c"));
      oval(pb, x + 8, y - 1, 16, 3, (X, Y, d) => pb.set(X, Y, "#2a0e0a"));
      for (let i = -24; i < -10; i++) pb.set(x + i, y - 3 + (i % 2), "#f0e8d8");
    },
    table(pb, glow, T, x, y, s, A) {
      pb.rect(x - 22, y - 4, 44, 4, WOOD[3]); pb.rect(x - 22, y - 4, 44, 1, WOOD[4]); pb.rect(x - 22, y, 44, 1, WOOD[0]); pb.rect(x - 20, y + 1, 2, 8, WOOD[1]); pb.rect(x + 18, y + 1, 2, 8, WOOD[1]);
      for (let k = 0; k < 5; k++) { const cx = x - 16 + k * 6 + Math.floor(hash(k, 1, s) * 2); pb.rect(cx, y - 5, 3, 1, k === 2 ? "#c83a2a" : "#f0e8d8"); }
      for (const dx of [x + 8, x + 12]) { pb.rect(dx, y - 7, 3, 3, "#f0e8d8"); pb.set(dx + 1, y - 6, "#2a1a10"); }
      pb.rect(x - 20, y - 9, 4, 5, IRON[2]); pb.rect(x - 20, y - 9, 4, 1, IRON[4]); pb.rect(x + 16, y - 8, 2, 4, "#e8dcc0"); A.flames.push([x + 16, y - 12, 0]);
      for (const sx of [x - 32, x + 28]) { pb.rect(sx, y + 2, 7, 2, WOOD[3]); pb.rect(sx + 1, y + 4, 1, 5, WOOD[1]); pb.rect(sx + 5, y + 4, 1, 5, WOOD[1]); }
      A.lights.push({ x: x + 16, y: y - 10, r: 22, col: [1, 0.75, 0.4], k: 0.5 });
    },
    lockers(pb, glow, T, x, y, s, A) {
      const wood = /wardrobe|tool/.test(A.name), C = wood ? WOOD : IRON;
      pb.rect(x - 2, y + 8, 62, FL - y - 8, C[0]);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
        const bx = x + c * 12, by = y + 10 + r * 11, open = hash(r, c, s) < 0.15;
        pb.rect(bx, by, 11, 10, open ? mix(C[0], "#000000", 0.4) : C[2]); if (open) { pb.rect(bx, by, 2, 10, C[3]); continue; }
        pb.rect(bx, by, 11, 1, C[4]); pb.rect(bx, by, 1, 10, C[3]); pb.rect(bx + 10, by, 1, 10, C[1]); pb.rect(bx + 5, by + 4, 1, 2, "#0a0806"); pb.set(bx + 2, by + 2, C[4]); pb.set(bx + 8, by + 7, C[4]);
      }
    },
    powder(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 3; k++) { barrel(pb, x - 22 + k * 12, y + 8, 9, 12); pb.rect(x - 19 + k * 12, y + 1, 3, 1, "#c83a2a"); pb.rect(x - 18 + k * 12, y, 1, 3, "#c83a2a"); }
      barrel(pb, x - 16, y - 4, 9, 11);
      let fx = x + 14, fy = y + 6;
      for (let q = 0; q < 26; q++) { pb.set(fx, fy, "#2a2420"); fx += 1; fy += Math.round(Math.sin(q * 0.5)); }
      for (let i = 0; i < 30; i++) pb.set(x - 28 + hash(i, 1, s) * 50, y + 9 + hash(i, 2, s) * 4, "#1a1614");
    },
    wagon(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 6; k++) pb.line(x - 26, y - 4 + k * 2 - Math.round(k * 0.3), x + 18, y - 10 + k * 2, k % 2 ? WOOD[2] : WOOD[3]);
      pb.line(x - 28, y - 6, x + 20, y - 12, WOOD[4]);
      const wheel = (cx, cy, r) => { for (let a = 0; a < 48; a++) { const t = (a / 48) * Math.PI * 2; P8(pb, cx + Math.cos(t) * r, cy + Math.sin(t) * r, WOOD[1]); P8(pb, cx + Math.cos(t) * (r - 1), cy + Math.sin(t) * (r - 1), WOOD[3]); } for (let k = 0; k < 6; k++) { const t = (k / 6) * Math.PI; pb.line(Math.round(cx - Math.cos(t) * r), Math.round(cy - Math.sin(t) * r), Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), WOOD[2]); } pb.rect(cx - 1, cy - 1, 3, 3, IRON[3]); };
      wheel(x - 18, y + 2, 7); wheel(x + 30, y + 4, 6);
      pb.line(x + 18, y - 10, x + 40, y - 4, WOOD[2]); sack(pb, x - 4, y - 8);
    },
    trough(pb, glow, T, x, y, s, A) {
      const stone = A.theme !== "goblin" && A.theme !== "beast", C = stone ? [T.ramp[0], T.ramp[2], T.ramp[3], T.ramp[4]] : [WOOD[0], WOOD[2], WOOD[3], WOOD[4]];
      pb.rect(x - 28, y - 6, 56, 10, C[1]); pb.rect(x - 28, y - 6, 56, 1, C[3]); pb.rect(x - 28, y + 3, 56, 1, C[0]); pb.rect(x - 28, y - 6, 2, 10, C[2]); pb.rect(x + 26, y - 6, 2, 10, C[0]);
      for (let i = -25; i < 25; i++) { pb.set(x + i, y - 5, A.theme === "fire" ? "#3a4a4a" : "#3a6a74"); pb.set(x + i, y - 4, (i + 30) % 7 < 2 ? "#8ac0c8" : "#24484e"); }
      if (A.theme === "fire") A.anim.push({ id: "steam", x: x - 8, y: y - 6 }, { id: "steam", x: x + 12, y: y - 6 });
      pb.rect(x + 32, y - 2, 6, 6, WOOD[2]); pb.rect(x + 32, y - 2, 6, 1, IRON[3]); pb.rect(x + 32, y + 2, 6, 1, IRON[2]);
    },
    stream(pb, glow, T, x, y, s, A) {
      for (let xx = 0; xx < W; xx++) { const c = Math.round(Math.sin(xx * 0.06 + s) * 2); for (let j = 0; j < 7; j++) pb.set(xx, y + c + j, j === 0 ? "#6a9aa0" : j === 6 ? mix(T.framp[0], "#000000", 0.3) : (xx + j * 5) % 11 < 2 ? "#4a8090" : "#1e4450"); }
      for (const sx of [40, 68, 96, 124]) { oval(pb, sx, y + 3, 4, 2, (X, Y, d, i, j) => pb.set(X, Y, j < 0 ? T.ramp[4] : T.ramp[2])); }
      A.anim.push({ id: "flow", y, s });
    },
    causeway(pb, glow, T, x, y, s, A) {
      const water = (yy) => { for (let xx = 0; xx < W; xx++) { const c = pb.get(xx, yy); pb.set(xx, yy, mix(c || T.framp[0], (xx + yy * 3) % 13 < 2 ? "#3a5a52" : "#0e1a18", 0.75)); } };
      for (let yy = FL + 1; yy < FL + 14; yy++) water(yy);
      for (let yy = H - 4; yy < H; yy++) water(yy);
      for (let xx = 0; xx < W; xx++) { pb.set(xx, FL + 14, T.framp[3]); pb.set(xx, FL + 15, mix(T.framp[3], "#ffffff", 0.2)); pb.set(xx, H - 5, mix(T.framp[0], "#000000", 0.3)); }
      for (let k = 0; k < 6; k++) pb.rect(10 + k * 30 + hash(k, 1, s) * 8, FL + 3 + hash(k, 2, s) * 8, 5, 1, "#5a8a7a");
      A.anim.push({ id: "ripple", x: 60, y: FL + 7, rx: 40, ry: 4 });
    },
    vents(pb, glow, T, x, y, s, A) {
      const hot = A.theme === "fire", pts = [[x - 30, y + 2], [x + 4, y + 6], [x + 34, y]];
      for (const [vx, vy] of pts) {
        oval(pb, vx, vy, 6, 2, (X, Y, d, i, j) => pb.set(X, Y, d > 0.6 ? (j < 0 ? T.ramp[4] : T.ramp[1]) : hot ? (d < 0.3 ? "#ffb040" : "#c04a14") : mix(T.ramp[0], "#000000", 0.4)));
        for (let k = 0; k < 4; k++) pb.line(vx + 6, vy, vx + 10 + k * 2, vy + (k % 2 ? 2 : -1), T.ramp[0]);
        if (hot) A.lights.push({ x: vx, y: vy - 2, r: 18, col: [1, 0.5, 0.2], k: 0.6 });
      }
      A.anim.push({ id: "vents", pts, hot });
    },
    icicles(pb, glow, T, x, y, s, A) {
      const ice = ["#4a6a88", "#7a9ab8", "#a8c8e0", "#d8f0fa", "#ffffff"];
      for (let k = 0; k < 14; k++) {
        const ix = x - 10 + k * 6 + Math.floor(hash(k, 1, s) * 3), len = 8 + Math.floor(hash(k, 2, s) * (k % 3 ? 16 : 30));
        for (let j = 0; j < len; j++) { const w = Math.max(0, Math.round((1 - j / len) * 3)); for (let i = -w; i <= w; i++) pb.set(ix + i, j, i < 0 ? ice[3] : i > 0 ? ice[1] : ice[2]); }
        pb.set(ix, len, ice[4]);
      }
      A.anim.push({ id: "drip", x: x - 10, w: 84, s });
    },
    wind(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 40; k++) { const wx = hash(k, 1, s) * W, wy = 6 + hash(k, 2, s) * (FL - 10); for (let i = 0; i < 6 + k % 5; i++) pb.set(wx + i, wy - i * 0.15, "#f4fbff", 0.6 - i * 0.04); }
      snowDrift(pb, x - 40, FL + 2, 40); snowDrift(pb, x + 30, FL + 1, 34);
      A.anim.push({ id: "gust" });
    },
    glass(pb, glow, T, x, y, s, A) {
      clearGlow(glow, 0, FL + 1, W, H);
      const fire = A.theme === "fire", G2 = fire ? ["#0c0808", "#1a1210", "#2e2420", "#5a4a40"] : ["#0e1a2a", "#1e3448", "#3a5a78", "#8ab0d0"];
      for (let yy = FL + 1; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
        const vo = voronoi(xx, yy * 2.2, 24, 24, s + 80), e = vo.d2 - vo.d1, refl = ((xx + (yy - FL) * 0.6) % 37) < 3;
        pb.set(xx, yy, e < 0.04 ? G2[3] : refl ? G2[2] : pick(G2, 0.25 + hash(vo.id, 1, s) * 0.25 + (yy - FL) * 0.005, xx, yy));
      }
      A.anim.push({ id: "glassglint", s });
    },
    flooded(pb, glow, T, x, y, s, A) {
      clearGlow(glow, 0, FL + 1, W, H - 4);
      const deep = A.theme === "swamp" ? "#0e1a12" : "#0a1c24", lite = A.theme === "swamp" ? "#4a6a4a" : "#5a98a8";
      for (let yy = FL + 1; yy < H; yy++) for (let xx = 0; xx < W; xx++) { const c = pb.get(xx, yy); if (!c) continue; pb.set(xx, yy, mix(c, deep, 0.55)); if (vnoise(xx / 10, yy / 2, s + 9) > 0.62 && (xx + yy) % 3 === 0) pb.set(xx, yy, mix(lite, deep, 0.4)); }
      for (let xx = 0; xx < W; xx++) pb.set(xx, FL + 1, lite);
      A.anim.push({ id: "ripple", x: 70, y: FL + 10, rx: 40, ry: 4 }, { id: "ripple", x: 140, y: FL + 22, rx: 30, ry: 3 });
    },
    steps(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 7; k++) { const sx = x - 6 + k * 9, sy = FL - 6 - k * 6; pb.rect(sx, sy, W, FL - sy, T.ramp[2]); pb.rect(sx, sy, 72 - k * 9, 1, T.ramp[4]); pb.rect(sx, sy + 1, 1, 5, T.ramp[3]); pb.rect(sx, sy + 5, 9, 1, T.ramp[0]); }
      for (let k = 0; k < 6; k++) pb.line(x + k * 9, FL - 18 - k * 6, x + 9 + k * 9, FL - 24 - k * 6, GOLD[2]);
    },
    hearth(pb, glow, T, x, y, s, A) {
      pb.rect(x, y + 16, 54, FL - y - 16, T.ramp[3]); pb.rect(x - 3, y + 14, 60, 4, T.ramp[4]); pb.rect(x - 3, y + 17, 60, 1, T.ramp[0]);
      for (let yy = y + 24; yy < FL; yy++) for (let xx = x + 8; xx < x + 46; xx++) pb.set(xx, yy, mix("#1a0e08", "#3a2014", (yy - y - 24) / 40));
      for (let k = 0; k < 3; k++) { pb.rect(x + 14 + k * 9, FL - 5, 10, 3, WOOD[1]); pb.rect(x + 14 + k * 9, FL - 5, 10, 1, "#e0702a"); }
      for (let k = 0; k < 3; k++) A.flames.push([x + 18 + k * 9, FL - 11, 1]);
      A.lights.push({ x: x + 27, y: FL - 8, r: 54, col: [1, 0.6, 0.3], k: 1.0, flick: x });
      for (let yy = y + 18; yy < y + 24; yy++) for (let xx = x + 4; xx < x + 50; xx += 6) pb.set(xx, yy, T.ramp[1]);
    },
    banners(pb, glow, T, x, y, s, A) {
      const col = { goblin: ["#9a3020", "#3a5a8a"], beast: ["#7a5a32", "#4a3420"], fire: ["#8a1e14", "#6a4a14"], undead: ["#3a4a4a", "#5a2a2a"], sea: ["#2a5a5a", "#5a4a2a"], ice: ["#2a4a6a", "#5a6a7a"], swamp: ["#3a5a2a", "#5a3a2a"], cave: ["#6a4a2a", "#3a4a5a"] }[A.theme] || ["#7a2a20", "#2a4a6a"];
      const marks = ["sun", "face", "fish"];
      for (let k = 0; k < 3; k++) banner(pb, x - 4 + k * 26, y + 2, 13, 26 + (k % 2) * 4, col[k % 2], marks[(k + s) % 3], s + k);
      if (A.theme === "sea") for (let k = 0; k < 3; k++) vines(pb, x + 2 + k * 26, 30, s + k);
    },
    graves(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 3; k++) {
        const gx = x - 26 + k * 22, gy = y + 4 + (k % 2) * 2;
        oval(pb, gx, gy + 3, 9, 2, (X, Y, d, i, j) => pb.set(X, Y, j < 0 ? T.framp[3] : T.framp[2]));
        pb.rect(gx - 3, gy - 10, 7, 11, T.ramp[3]); pb.rect(gx - 2, gy - 12, 5, 2, T.ramp[3]); pb.rect(gx - 3, gy - 10, 1, 11, T.ramp[4]); pb.rect(gx + 1, gy - 7, 1, 3, T.ramp[1]); pb.rect(gx, gy - 6, 3, 1, T.ramp[1]);
      }
      pb.line(x + 34, y - 10, x + 30, y + 6, WOOD[3]); pb.rect(x + 28, y + 4, 5, 3, IRON[3]);
    },
    coffins(pb, glow, T, x, y, s, A) {
      for (let r = 0; r < 2; r++) {
        pb.rect(x - 2, y + 26 + r * 18, 64, 2, T.ramp[4]); pb.rect(x - 2, y + 28 + r * 18, 64, 1, T.ramp[0]);
        for (let k = 0; k < 3; k++) {
          const cx = x + 2 + k * 20, cy = y + 12 + r * 18, ajar = hash(r, k, s) < 0.2;
          for (let j = 0; j < 14; j++) { const hw = j < 4 ? 4 + j : 8 - Math.floor((j - 4) / 3); pb.rect(cx + 9 - hw, cy + j, hw * 2, 1, j === 0 ? WOOD[3] : WOOD[2]); pb.set(cx + 9 - hw, cy + j, WOOD[3]); pb.set(cx + 8 + hw, cy + j, WOOD[0]); }
          if (ajar) { pb.line(cx + 2, cy + 1, cx + 16, cy - 3, WOOD[4]); pb.rect(cx + 5, cy + 2, 8, 2, "#0e0a08"); } else { pb.rect(cx + 8, cy + 3, 2, 7, WOOD[1]); pb.rect(cx + 6, cy + 5, 6, 1, WOOD[1]); }
        }
      }
    },
    nest(pb, glow, T, x, y, s, A) {
      oval(pb, x, y + 4, 30, 6, (X, Y, d, i, j) => pb.set(X, Y, d > 0.8 ? "#5a4020" : hash(X, Y, s) < 0.3 ? "#c8a858" : (X + Y * 2) % 5 === 0 ? "#6a5028" : j < 0 ? "#a8884a" : "#8a6c38"));
      for (let k = 0; k < 18; k++) { const sx = x - 30 + hash(k, 1, s) * 60, sy = y + 1 + hash(k, 2, s) * 7; pb.line(sx, sy, sx + 4, sy - 2 + (k % 3), "#d8c070"); }
      for (let k = 0; k < 5; k++) pb.rect(x - 22 + k * 11, y + 2 + (k % 2) * 3, 3 + (k % 2), 1, BONE[3]);
      if (/shin/.test(A.name)) { for (const [gx, gy] of [[x - 10, y + 1], [x + 6, y + 3], [x + 16, y]]) { pb.set(gx, gy, GOLD[4]); pb.set(gx + 1, gy, "#8ae0f0"); } A.anim.push({ id: "glint", pts: [[x - 10, y + 1], [x + 6, y + 3], [x + 16, y]] }); }
      else for (let k = 0; k < 6; k++) pb.rect(x - 14 + k * 6, y - 1 + (k % 2), 3, 2, A.theme === "ice" ? "#e8f0f4" : "#5a4a3a");
    },
    flock(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 4; k++) {
        const sx = x - 30 + k * 16 + (k % 2) * 3, sy = y + 4 - (k % 2) * 3;
        for (const lx of [-4, -1, 2, 5]) pb.rect(sx + lx, sy, 1, 4, "#2a2420");
        oval(pb, sx, sy - 3, 7, 4, (X, Y, d, i, j) => pb.set(X, Y, (X * 3 + Y * 5) % 7 === 0 ? "#c8c0b0" : j < -1 ? "#f4f0e6" : "#e0d8c8"));
        pb.rect(sx - 10, sy - 6, 4, 4, "#2a2420"); pb.set(sx - 9, sy - 5, "#e8e0d0"); pb.set(sx - 7, sy - 7, "#2a2420");
      }
      A.anim.push({ id: "baa", x: x - 40, y: y - 2 });
    },
    lookout(pb, glow, T, x, y, s, A) {
      postW(pb, x + 4, y + 12, FL); postW(pb, x + 40, y + 12, FL);
      pb.rect(x, y + 10, 48, 3, WOOD[3]); pb.rect(x, y + 10, 48, 1, WOOD[4]); pb.rect(x, y + 4, 2, 7, WOOD[2]); pb.rect(x + 46, y + 4, 2, 7, WOOD[2]); pb.rect(x, y + 4, 48, 1, WOOD[3]);
      for (let k = 0; k < 7; k++) pb.rect(x + 18, y + 16 + k * 7, 8, 1, WOOD[3]); pb.rect(x + 18, y + 13, 1, FL - y - 13, WOOD[2]); pb.rect(x + 25, y + 13, 1, FL - y - 13, WOOD[2]);
      pb.line(x + 32, y + 2, x + 40, y - 2, "#c8b890"); pb.rect(x + 8, y - 4, 1, 8, WOOD[2]); pb.rect(x + 9, y - 4, 6, 4, "#9a3020");
    },
    burrows(pb, glow, T, x, y, s, A) {
      for (const [hx, r] of [[x - 4, 7], [x + 26, 9], [x + 58, 6]]) {
        const hy = FL - 2;
        oval(pb, hx, hy + 4, r + 6, 3, (X, Y, d, i, j) => pb.set(X, Y, j < 0 ? T.framp[3] : T.framp[2]));
        hole(pb, T, A.theme, hx, hy, r, Math.round(r * 0.8), s + hx);
        for (let k = 0; k < 3; k++) { let rx = hx - r + k * r; for (let j = 0; j < 5 + k * 2; j++) { pb.set(rx, hy - r - 2 + j, "#4a3220"); if (j % 3 === 2) rx += k % 2 ? 1 : -1; } }
      }
    },
    tracks(pb, glow, T, x, y, s, A) {
      const dk = mix(T.framp[0], "#000000", 0.55), lt = mix(T.framp[3], "#ffffff", 0.2);
      const paw = (px, py) => { pb.rect(px, py, 3, 2, dk); pb.rect(px, py - 1, 3, 1, lt); for (let q = 0; q < 4; q++) { pb.set(px - 1 + q * 1.4, py - 3, dk); pb.set(px - 1 + q * 1.4, py - 4, lt); } };
      for (let k = 0; k < 10; k++) paw(14 + k * 16, FL + 5 + k * 2.2 + (k % 2) * 4);
      for (let k = 0; k < 2; k++) for (let i = 0; i < 90; i++) { const yy = y + 12 + k * 4 + Math.sin(i * 0.08) * 2; pb.set(x - 60 + i, yy, dk); pb.set(x - 60 + i, yy - 1, lt, 0.6); }
      for (let k = 0; k < 6; k++) pb.rect(x - 40 + hash(k, 1, s) * 80, y + 2 + hash(k, 2, s) * 18, 2, 1, A.theme === "beast" ? "#8a6a42" : "#6a6058");
    },
    oldtraps(pb, glow, T, x, y, s, A) {
      for (let k = 0; k < 4; k++) {
        const tx = x - 36 + k * 22, ty = y + 2 + (k % 2) * 3, rust = ["#5a2a14", "#7a3a1a", "#9a5028", "#b8683a"];
        for (let a = 0; a < 36; a++) { const t = (a / 36) * Math.PI * 2; P8(pb, tx + Math.cos(t) * 7, ty + Math.sin(t) * 2, rust[Math.sin(t) < 0 ? 3 : 1]); }
        for (let q = 0; q < 6; q++) { const t = Math.PI + ((q + 0.5) / 6) * Math.PI; pb.set(tx + Math.cos(t) * 7, ty + Math.sin(t) * 2 - 1, rust[2]); }
        pb.rect(tx - 1, ty, 3, 1, rust[0]); pb.line(tx + 7, ty, tx + 12, ty + 1, IRON[1]); pb.rect(tx + 12, ty - 2, 1, 4, WOOD[2]);
        if (k === 2) pb.line(tx - 8, ty - 1, tx + 8, ty - 1, WOOD[3]);
      }
    },
    rats(pb, glow, T, x, y, s, A) {
      for (const hx of [x - 30, x + 6, x + 38]) { oval(pb, hx, FL + 5, 9, 2, (X, Y, d, i, j) => pb.set(X, Y, j < 0 ? T.framp[3] : T.framp[2])); hole(pb, T, A.theme, hx, FL + 1, 6, 4, s + hx); }
      for (let i = 0; i < 40; i++) pb.set(x - 40 + hash(i, 1, s) * 90, y + hash(i, 2, s) * 14, "#2a2018");
      A.anim.push({ id: "rats", x0: x - 30, x1: x + 38, y: FL + 4 });
    },
    heap(pb, glow, T, x, y, s, A) {
      const C = ["#5a3e22", "#8a6a42", "#3a4a5a", "#7a2a20", "#6a6a6a", "#a8884a", "#4a5a3a"];
      for (let k = 0; k < 46; k++) {
        const hx = x - 26 + hash(k, 1, s) * 52, top = y + 8 - Math.cos(((hx - x) / 30) * (Math.PI / 2)) * 14, hy = top + hash(k, 2, s) * (y + 8 - top), c = C[Math.floor(hash(k, 3, s) * 7)];
        const shape = k % 4;
        if (shape === 0) { pb.rect(hx, hy, 4, 2, c); pb.rect(hx + 2, hy - 3, 2, 3, c); }
        else if (shape === 1) oval(pb, Math.round(hx), Math.round(hy), 2, 1, (X, Y, d, i, j) => pb.set(X, Y, j < 0 ? IRON[3] : IRON[1]));
        else { pb.rect(hx, hy, 5, 3, c); pb.rect(hx, hy, 5, 1, mix(c, "#ffffff", 0.25)); }
      }
      oval(pb, x + 14, y - 2, 4, 4, (X, Y, d) => pb.set(X, Y, d > 0.6 ? IRON[3] : "#7a2a20")); pb.set(x + 14, y - 2, GOLD[3]);
      A.anim.push({ id: "glint", pts: [[x - 8, y - 2], [x + 14, y - 3], [x + 4, y + 4]] });
    },
    logs(pb, glow, T, x, y, s, A) {
      const char = /charcoal/.test(A.name), C = char ? ["#121010", "#221e1c", "#363230", "#4a4644"] : [WOOD[1], WOOD[2], WOOD[3], WOOD[4]];
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) {
        const lx = x - 22 + k * 12 + r * 6, ly = y + 6 - r * 7;
        pb.rect(lx - 6, ly - 3, 12, 6, C[1]); pb.rect(lx - 6, ly - 3, 12, 1, C[3]);
        oval(pb, lx + 6, ly, 3, 3, (X, Y, d) => pb.set(X, Y, d > 0.7 ? C[0] : d > 0.3 ? (char ? "#5a5250" : "#c8a070") : (char ? "#3a3432" : "#a87a4a")));
      }
    },
    scales(pb, glow, T, x, y, s, A) {
      pb.rect(x - 1, y - 30, 3, 36, GOLD[2]); pb.rect(x - 1, y - 30, 1, 36, GOLD[4]); pb.rect(x - 6, y + 4, 13, 3, GOLD[1]); pb.rect(x - 6, y + 4, 13, 1, GOLD[3]);
      pb.line(x - 20, y - 26, x + 20, y - 30, GOLD[3]); pb.rect(x - 2, y - 31, 5, 3, GOLD[4]);
      for (const [px, py] of [[x - 20, y - 26], [x + 20, y - 30]]) { pb.line(px, py, px - 5, py + 12, IRON[3]); pb.line(px, py, px + 5, py + 12, IRON[3]); pb.rect(px - 7, py + 12, 15, 2, GOLD[2]); pb.rect(px - 7, py + 12, 15, 1, GOLD[4]); }
      pb.rect(x - 22, y - 16, 4, 2, GOLD[4]); pb.rect(x + 17, y - 21, 3, 3, IRON[3]);
      A.anim.push({ id: "glint", pts: [[x, y - 30], [x - 20, y - 14], [x + 20, y - 18]] });
    },
    engine(pb, glow, T, x, y, s, A) {
      pb.rect(x + 22, y + 6, 8, FL - y - 6, T.ramp[3]); pb.rect(x + 22, y + 6, 1, FL - y - 6, T.ramp[4]);
      pb.line(x - 4, y + 10, x + 56, y + 2, IRON[2]); pb.line(x - 4, y + 11, x + 56, y + 3, IRON[1]); pb.rect(x + 24, y + 3, 4, 4, IRON[4]);
      pb.rect(x - 6, y + 11, 2, 28, IRON[3]); pb.rect(x - 10, y + 38, 10, FL - y - 38, IRON[1]); pb.rect(x - 10, y + 38, 10, 1, IRON[4]);
      const cx = x + 46, cy = y + 32;
      for (let a = 0; a < 60; a++) { const t = (a / 60) * Math.PI * 2, r = a % 5 < 2 ? 12 : 10; P8(pb, cx + Math.cos(t) * r, cy + Math.sin(t) * r, IRON[a % 5 < 2 ? 3 : 2]); }
      oval(pb, cx, cy, 8, 8, (X, Y, d) => pb.set(X, Y, d > 0.6 ? IRON[2] : d > 0.2 ? IRON[1] : IRON[3]));
      for (let k = 0; k < 12; k++) pb.set(x + hash(k, 1, s) * 56, y + 12 + hash(k, 2, s) * 40, "#8a4a22");
      pb.rect(x, FL - 8, 56, 3, IRON[2]); pb.rect(x, FL - 8, 56, 1, IRON[3]);
      A.anim.push({ id: "cog", x: cx, y: cy });
    },
    ladder(pb, glow, T, x, y, s, A) {
      hole(pb, T, A.theme, x + 30, FL + 6, 12, 4, s);
      pb.rect(x + 22, 0, 2, FL + 6, WOOD[2]); pb.rect(x + 36, 0, 2, FL + 6, WOOD[2]); pb.rect(x + 22, 0, 1, FL + 6, WOOD[3]);
      for (let k = 0; k < 11; k++) pb.rect(x + 22, 4 + k * 6, 16, 1, WOOD[3]);
      for (let k = 0; k < 4; k++) pb.rect(x + 20, 6 + k * 16, 2, 2, IRON[3]);
    },
  });
  const D3 = (h) => rgb(h).map((v) => v / 255);
  // what moves on a prop, drawn each frame by the vignette (st: the stage, T: seconds)
  const ANIM = {
    fish(st, p) { for (let k = 0; k < (p.small ? 3 : 2); k++) { const a = st.T * (0.6 + k * 0.25) + k * 2.4, x = p.x + Math.cos(a) * p.rx, y = p.y + Math.sin(a) * p.ry, dir = -Math.sin(a) >= 0 ? 1 : -1, c = p.small ? ["#ffd070", "#8af0e0", "#ff8aa8"][k] : k ? "#f0f0e8" : "#e8702a"; st.px(x, y, c); st.px(x - dir, y, c); if (!p.small) { st.px(x + dir, y, c); st.px(x - dir * 2, y - 1, c); st.px(x - dir * 2, y + 1, c); } } },
    ripple(st, p) { for (let k = 0; k < 2; k++) { const u = (st.T * 0.45 + k * 0.5) % 1, cx = p.x + (k ? 9 : -7), r = 2 + u * p.rx * 0.4; for (let q = 0; q < 16; q++) { const t = (q / 16) * Math.PI * 2; if (bay(q, Math.round(u * 8)) < 1 - u) st.px(cx + Math.cos(t) * r, p.y + Math.sin(t) * r * 0.3, "#a8d8d8", true); } } },
    lensbeam(st, p) {
      const u = (Math.sin(st.T * 0.8) + 1) / 2, pts = [[p.x, p.y], [p.x + 26, p.y + 4], [p.x + 52, p.y]];
      for (let k = 0; k < 2; k++) { const [a, b] = [pts[k], pts[k + 1]]; for (let q = 0; q <= 24; q++) { const t = q / 24; if (bay(q, k) < 0.5 + u * 0.4) st.px(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, "#fff8d8", true); } }
      const fx = p.x + 52 + 10 + u * 16, fy = FL + 14;
      st.line(p.x + 52, p.y, fx, fy, "#fff0b0", true);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) st.px(fx + dx, fy + dy, dx || dy ? "#ffe080" : "#ffffff", true);
      st.light(fx, fy, 22, [1, 0.95, 0.75], 0.7); st.light(p.x + 26, p.y + 4, 30, [0.8, 0.9, 1], 0.5);
    },
    reefglow(st, p) { const k = 0.5 + Math.sin(st.T * 1.7) * 0.3; st.light(p.x, p.y, 54, [0.35, 0.85, 0.95], 0.4 * k); for (let q = 0; q < 6; q++) { const u = (st.T * 0.3 + q / 6) % 1; st.px(p.x - 30 + q * 11 + Math.sin(st.T + q) * 2, p.y + 6 - u * 40, u < 0.7 ? "#bff8ff" : null, true); } },
    kelp(st, p) { for (let k = 0; k < p.n; k++) { let x = p.x + k * 9 + (k % 2) * 3; const h = p.h - (k % 3) * 8; for (let j = 0; j < h; j++) { const sw = Math.sin(st.T * 1.6 + j * 0.18 + k) * (j / h) * 4; st.px(x + sw, p.y - j, j % 4 ? "#2e6a3a" : "#4a8a4a"); if (j % 6 === 3) st.px(x + sw + (k % 2 ? 1 : -1), p.y - j, "#5aa05a"); } } },
    bubbles(st, p) { for (let k = 0; k < 9; k++) { const u = (st.T * (0.25 + (k % 3) * 0.08) + k * 0.37) % 1, x = p.x - p.w / 2 + ((k * 23) % p.w) + Math.sin(st.T * 3 + k) * 1.5, y = p.y - u * (p.y - 12); st.px(x, y, "#d8f4ff", true); if (k % 3 === 0) { st.px(x + 1, y, "#a8d8e8", true); st.px(x, y - 1, "#a8d8e8", true); } } },
    falls(st, p) { for (let k = 0; k < 10; k++) { const u = (st.T * 1.6 + k * 0.1) % 1, x = p.x + ((k * 5) % p.w); st.line(x, p.y + u * (FL - p.y), x, p.y + u * (FL - p.y) + 4, "#e8f8ff", true); } },
    embers(st, p) { for (let k = 0; k < 6; k++) { const u = (st.T * 0.5 + k / 6) % 1; st.px(p.x - 10 + ((k * 7) % 20) + Math.sin(st.T * 3 + k) * 2, p.y - u * 30, u < 0.6 ? "#ffcf5a" : "#c05020", true); } },
    bell(st, p) { const a = Math.sin(st.T * 1.3) * 0.12, bx = Math.round(p.x + Math.sin(a) * 16); st.line(p.x, p.y, bx, p.y + 14, IRON[2]); for (let j = 0; j < 16; j++) { const w = 3 + Math.floor(j * 0.5); for (let i = -w; i <= w; i++) st.px(bx + i + Math.round(a * j), p.y + 14 + j, i < -w + 2 ? GOLD[4] : i > w - 2 ? GOLD[1] : GOLD[2]); } st.px(bx + Math.round(a * 16), p.y + 31, IRON[1]); },
    hands(st, p) { const a = st.T * 0.4, b = st.T * 0.033; st.line(p.x, p.y, Math.round(p.x + Math.sin(a) * 10), Math.round(p.y - Math.cos(a) * 10), "#2a1a10"); st.line(p.x, p.y, Math.round(p.x + Math.sin(b) * 6), Math.round(p.y - Math.cos(b) * 6), "#2a1a10"); },
    steam(st, p) { for (let k = 0; k < 5; k++) { const u = (st.T * 0.35 + k / 5) % 1; if (bay(k, Math.round(u * 6)) < 1 - u) st.px(p.x - 3 + k * 1.5 + Math.sin(st.T * 2 + k) * 2, p.y - u * 22, "#e8e4dc", true); } },
    spores(st, p) { for (let k = 0; k < 7; k++) { const u = (st.T * 0.18 + k / 7) % 1; st.px(p.x - 30 + k * 10 + Math.sin(st.T + k) * 3, p.y + 2 - u * 30, u < 0.8 ? "#c8ffd8" : null, true); } },
    glint(st, p) { const k = Math.floor(st.T * 1.5) % p.pts.length, u = (st.T * 1.5) % 1, [x, y] = p.pts[k]; if (u < 0.5) { const r = u < 0.25 ? 1 : 2; st.px(x, y, "#ffffff", true); for (let q = 1; q <= r; q++) { st.px(x - q, y, "#fff4b0", true); st.px(x + q, y, "#fff4b0", true); st.px(x, y - q, "#fff4b0", true); st.px(x, y + q, "#fff4b0", true); } } },
    lava(st, p) { for (let k = 0; k < 5; k++) { const u = (st.T * 0.7 + k / 5) % 1; if (u < 0.3) st.px(p.x - 36 + k * 17, p.y - u * 6, "#fff0a0", true); } st.light(p.x, p.y, 50 + Math.sin(st.T * 3) * 3, [1, 0.5, 0.2], 0.25); },
    lantern(st, p) { const sw = Math.round(Math.sin(st.T * 1.2 + p.x) * 1); st.rect(p.x - 2 + sw, p.y, 5, 1, IRON[2]); st.rect(p.x - 2 + sw, p.y + 1, 5, 5, IRON[1]); st.rect(p.x - 1 + sw, p.y + 2, 3, 3, "#ffd070", true); st.light(p.x + sw, p.y + 3, 34 + Math.sin(st.T * 7 + p.x) * 2, [1, 0.75, 0.4], 0.9); },
  };
  Object.assign(ANIM, {
    salpools(st, p) {
      const T = st.T;
      p.pools.forEach(([cx, cy, rx], k) => {
        for (let q = 0; q < 2; q++) { const u = (T * 0.55 + k * 0.31 + q * 0.5) % 1, bx = cx - rx + 4 + ((k * 13 + q * 17) % (rx * 2 - 6)); if (u < 0.25) st.px(bx, cy - 1, "#fff4c0"); else if (u < 0.4) { st.px(bx - 1, cy - 1, "#ffd870"); st.px(bx + 1, cy - 1, "#ffd870"); } }
        for (let q = 0; q < 3; q++) { const u = (T * 0.35 + q / 3 + k * 0.2) % 1; if (bay(q, k) < 1 - u) st.px(cx - 6 + q * 6 + Math.sin(T * 2 + q + k) * 1.5, cy - 3 - u * 14, "#ffd8a0"); }
      });
      // a salamander basks in the near-left pool and the middle one, rising and sinking in turn
      for (const [k, ph] of [[0, 0], [1, 2.2]]) {
        const [cx, cy] = p.pools[k], up = Math.max(0, Math.sin(T * 0.7 + ph)), hx = cx + 4 - Math.round(Math.cos(T * 0.3 + ph) * 4), hy = cy - Math.round(up * 3);
        if (up < 0.15) continue;
        st.rect(hx - 6, hy + 1, 10, 1, "#c8501a"); st.rect(hx - 3, hy - 1, 6, 2, "#e8702a"); st.rect(hx + 3, hy - 1, 3, 2, "#e8702a"); st.px(hx + 5, hy, "#ffcf5a");
        st.px(hx + 4, hy - 1, "#1a0806"); for (let q = 0; q < 3; q++) st.px(hx - 5 + q * 3, hy, "#7a2a10");
      }
    },
    breath(st, p) {
      const T = st.T, inh = (Math.sin(T * 0.9) + 1) / 2;
      for (let k = 0; k < 10; k++) { const u = (T * 0.25 + k / 10) % 1, r = u * 14 * inh; if (bay(k, Math.round(u * 6)) < (1 - u) * inh) st.px(p.x - 6 + (k % 5) * 3 + Math.cos(k) * r, p.y - 2 - u * 18, "#c8d4d4"); }
      if (p.sea) { const g = (Math.sin(T * 0.9) + 1) / 2; for (let i = -3; i <= 3; i++) if ((i + Math.round(T * 4)) % 3 === 0) st.px(p.x + i, p.y + 2 - Math.round(g), "#a8e0e8"); }
    },
    bat(st, p) { const u = (st.T * 0.12) % 1; if (u > 0.4) return; const x = p.x - 40 + u * 300, y = p.y + Math.sin(u * 40) * 4, f = Math.floor(st.T * 12) % 2; st.px(x, y, "#140e0e"); st.line(x - 3, y - f * 2, x, y, "#140e0e"); st.line(x + 3, y - f * 2, x, y, "#140e0e"); },
    flow(st, p) { for (let k = 0; k < 14; k++) { const x = ((st.T * 22 + k * 41) % (W + 20)) - 10, y = p.y + 2 + (k % 4) + Math.round(Math.sin(x * 0.06 + p.s) * 2); st.px(x, y, "#a8d8e0"); st.px(x + 1, y, "#6aa8b8"); } },
    vents(st, p) { for (const [vx, vy] of p.pts) for (let k = 0; k < 6; k++) { const u = (st.T * 0.4 + k / 6 + vx * 0.01) % 1; if (bay(k, Math.round(u * 8)) < 1 - u) st.px(vx - 2 + (k % 3) * 2 + Math.sin(st.T * 1.5 + k) * (1 + u * 4), vy - 2 - u * 26, p.hot ? (u < 0.3 ? "#ffb060" : "#8a7a70") : "#e8eef0"); } },
    drip(st, p) { for (let k = 0; k < 3; k++) { const u = (st.T * 0.5 + k * 0.37) % 1, x = p.x + ((k * 29 + p.s) % p.w); if (u < 0.5) st.px(x, 22 + easeIn(u * 2) * (FL + 20), "#e8f8ff"); } },
    gust(st) { for (let k = 0; k < 40; k++) { const x = ((st.T * (60 + (k % 4) * 15) + k * 37) % (W + 30)) - 15, y = 6 + ((k * 23) % 86) + Math.sin(st.T * 3 + k) * 2; st.px(x, y, "#f4fbff"); if (k % 3 === 0) st.px(x - 1, y, "#c8dce8"); } },
    glassglint(st) { const u = (st.T * 0.3) % 1; for (let yy = FL + 2; yy < H; yy += 2) { const x = (u * 260 - 40) + (yy - FL) * 0.6; for (let i = 0; i < 3; i++) st.px(x + i, yy, "#fff4dc"); } },
    baa(st, p) { const u = (st.T * 0.4) % 3; if (u < 0.5) st.text("BAA", p.x, p.y - 10 - u * 4, "#f4f0e6", { outline: "#2a2420" }); },
    rats(st, p) { for (let q = 0; q < 2; q++) { const u = (st.T * 0.22 + q * 0.5) % 1; if (u > 0.6) continue; const x = lerp(p.x0, p.x1, u / 0.6), dir = q ? -1 : 1, X = q ? p.x1 - (x - p.x0) : x, f = Math.floor(st.T * 10) % 2; st.rect(X - 2, p.y - 2, 4, 2, "#3a3028"); st.px(X + 2 * dir, p.y - 2, "#3a3028"); st.px(X - 3 * dir, p.y - 1 - f, "#6a5a4a"); st.px(X + 2 * dir, p.y - 3, "#ff5a40"); } },
    cog(st, p) { const a = st.T * 0.8; for (let k = 0; k < 4; k++) { const t = a + (k / 4) * Math.PI * 2; st.line(p.x, p.y, Math.round(p.x + Math.cos(t) * 7), Math.round(p.y + Math.sin(t) * 7), IRON[3]); } st.rect(p.x - 1, p.y - 1, 3, 3, IRON[4]); },
  });
  function sceneAnim(st) { for (const p of st.env.bg.A.anim || []) if (ANIM[p.id]) ANIM[p.id](st, p); }

  // ---------- the sea: wet stone, a tide line, weed and barnacles, standing water that catches the light ----------
  function seaDress(pb, glow, T, s, A) {
    const tide = 26 + Math.floor(hash(1, 9, s) * 8);
    for (let x = 0; x < W; x++) {
      const wav = Math.round(Math.sin(x * 0.11 + s) * 1.5);
      for (let y = 0; y < FL; y++) {
        const c = pb.get(x, y);
        if (!c) continue;
        if (y > tide + wav) { const k = Math.min(1, (y - tide) / 26); pb.set(x, y, mix(c, k > 0.55 && hash(x >> 1, y >> 1, s) < 0.35 ? "#1e4a2e" : "#0e2a2a", 0.25 + k * 0.25)); }
        else if (hash(x, y, s + 3) < 0.04) pb.set(x, y, mix(c, "#e8f0f0", 0.4));
      }
      for (let j = -1; j <= 1; j++) pb.set(x, tide + wav + j, j ? "#7a9a90" : "#c8d8cc", j ? 0.5 : 0.85);
      if (hash(x, 4, s) < 0.12) for (let j = 0; j < 3 + hash(x, 5, s) * 10; j++) pb.set(x, tide + wav + 2 + j, j < 4 ? "#3e6a4a" : "#2a5040", 0.7);
      if (hash(x >> 2, 6, s) < 0.18) for (let j = 0; j < 14; j++) if (hash(x, j, s + 7) < 0.25) pb.set(x, 6 + j * 3, "#a8c8d0", 0.35);
    }
    for (const [bx, by] of [[18, tide + 6], [64, tide + 10], [118, tide + 4], [150, tide + 12], [96, tide + 18]]) for (let k = 0; k < 14; k++) { const x = bx + hash(k, 1, bx) * 14, y = by + hash(k, 2, bx) * 7; P8(pb, x, y, "#d8d0b8"); P8(pb, x + 1, y, "#8a8270"); P8(pb, x, y + 1, "#5a5448"); }
    for (const [sx, sy, c] of [[40, 92, "#d8603a"], [158, 84, "#e8904a"]]) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1], [2, 1], [-2, 1], [0, -2]]) pb.set(sx + dx, sy + dy, (dx || dy) && Math.abs(dx) + Math.abs(dy) > 1 ? mix(c, "#000000", 0.25) : c);
    for (let y = FL + 2; y < H; y++) for (let x = 0; x < W; x++) {
      const c = pb.get(x, y), wv = vnoise(x / 14, y / 3, s + 17);
      if (!c) continue;
      if (wv > 0.36) pb.set(x, y, mix(c, "#1a4a5e", 0.55));
      if (wv > 0.36 && wv < 0.41) pb.set(x, y, mix(c, "#7ab8c8", 0.4));
      else if (wv > 0.5 && hash(x >> 2, y, s + 21) < 0.06) { pb.set(x, y, "#5a98a8"); pb.set(x + 1, y, "#3a7888"); }
    }
    A.anim.push({ id: "seakelp", x: 8, y: H - 2 }, { id: "caustics", tide }, { id: "seashine" }, { id: "crab", s });
  }
  Object.assign(ANIM, {
    seakelp(st) { for (const [x, h] of [[8, 30], [14, 22], [168, 26], [174, 18]]) for (let j = 0; j < h; j++) { const sw = Math.sin(st.T * 1.3 + j * 0.2 + x) * (j / h) * 3; st.px(x + sw, H - 2 - j, j % 4 ? "#2e5a32" : "#4a7a3e"); if (j % 5 === 2) st.px(x + sw + 1, H - 2 - j, "#5a8a4a"); } },
    caustics(st, p) {
      // light off the water below, wandering over the wet wall just under the tide line; lit with the room, so it fades where the room is dark
      const T = st.T;
      for (let k = 0; k < 34; k++) { const x = (k * 53) % W, y = p.tide + 4 + ((k * 13) % 20); const v = Math.sin(x * 0.21 + T * 1.7 + Math.sin(y * 0.3 + T)) + Math.sin(y * 0.37 - T * 1.3 + k); if (v > 1.25) { st.px(x, y, "#7ac0cc"); st.px(x + 1, y, "#5aa0b0"); } }
    },
    seashine(st) { for (let k = 0; k < 8; k++) { const u = (st.T * 0.15 + k / 8) % 1, x = 10 + ((k * 41) % 160), y = FL + 8 + ((k * 7) % 28); if (u < 0.5) { st.px(x + u * 6, y, "#cfeef4"); st.px(x + u * 6 + 1, y, "#8ac8d8"); } } },
    crab(st, p) { const u = (st.T * 0.08 + p.s * 0.01) % 1; if (u > 0.55) return; const x = 150 - u * 40 * 3, y = 96, f = Math.floor(st.T * 8) % 2; st.rect(x - 2, y - 2, 5, 2, "#c8502a"); st.px(x - 3, y - 3 + f, "#c8502a"); st.px(x + 3, y - 3 + (1 - f), "#c8502a"); st.px(x - 2, y, "#8a3018"); st.px(x + 2, y, "#8a3018"); st.px(x - 1, y - 3, "#1a0a06"); st.px(x + 1, y - 3, "#1a0a06"); },
  });

  // ---------- the room: theme x depth x kind ----------
  // the deep floors stay dark and moody but never so dark that the room's furniture is lost
  const DEPTH_AMB = [0, 0.62, 0.34, 0.27, 0.23];
  const BG = {};
  // focus: where the room's object stands (the chest, the altar, the door); crew walk in from the left
  const FOCUS = { chest: [128, 90], secret: [128, 90], trap: [108, 92], famous: [108, 92], puzzle: [126, 64], obstacle: [106, 92], shrine: [130, 84], remains: [134, 86],
    lore: [112, 46], supplies: [134, 90], cache: [134, 90], camp_spot: [112, 90], lair: [134, 88], stair: [148, 90], fight: [134, 90], fear: [120, 88] };
  function background(theme, depth, kind, opts) {
    opts = opts || {};
    const props = propsOf(opts.name, theme, kind);
    opts = Object.assign({}, opts, { props });
    const key = [theme, depth, kind, opts.sub || "", opts.seed || 0, props.map((p) => p.id).join("+")].join("|");
    if (BG[key]) return BG[key];
    const T = themeOf(theme), s = (hashStr(theme) + (opts.seed || 0) * 31) % 9973, pb = new PB(W, H), glow = new PB(W, H);
    const A = { name: String(opts.name || "").toLowerCase(), focus: (FOCUS[kind] || [128, 90]).slice(), lights: [], beams: [], flames: [], embers: theme === "fire", drips: theme === "sea" || theme === "ice" || theme === "cave", depth, theme, anim: [] };
    paintWall(pb, glow, T, 0, W, 0, FL, s, 0);
    paintFloor(pb, glow, T, s, 0);
    if (theme === "cave" || theme === "beast" || theme === "goblin") stalactites(pb, T, s, false);
    if (theme === "ice") stalactites(pb, T, s, true);
    if (theme === "fire") stalactites(pb, T, s, false);
    // depth: daylight through cracks, torches on the wall, or nothing but the crew's own light
    if (depth <= 1) {
      for (const cx of [38 + Math.floor(hash(1, 1, s) * 30), 112 + Math.floor(hash(2, 1, s) * 34)]) {
        for (let j = 0; j < 7; j++) for (let i = -2 + Math.floor(j / 3); i <= 2 - Math.floor(j / 3); i++) pb.set(cx + i + (j % 2), j, j < 2 ? "#f8f0d8" : mix("#f8f0d8", T.ramp[1], j / 7));
        for (let k = 0; k < 4; k++) { const rx = cx - 3 + k * 2; for (let j = 0; j < 3 + hash(k, cx, s) * 6; j++) pb.set(rx + (j % 3 === 2 ? 1 : 0), j + 2, k % 2 ? "#4a6a2a" : "#6a8a3a"); }
        A.beams.push({ x0: cx, y0: 0, x1: cx + 16, y1: H, w: 10, k: 0.8 });
      }
    } else if (depth === 2) {
      for (const sx of [30 + Math.floor(hash(3, 1, s) * 12), 150 - Math.floor(hash(4, 1, s) * 12)]) { sconce(pb, sx, 30); A.flames.push([sx, 24, 1]); A.lights.push({ x: sx, y: 24, r: 64, col: [1.0, 0.66, 0.36], k: 1.1, flick: sx }); }
    } else {
      cobweb(pb, 6, 4, 1, 12); cobweb(pb, W - 7, 4, -1, 10);
      bones(pb, 22, 72, 3, s + 9);
    }
    // the theme's own dressing
    if (theme === "goblin") {
      const cols = [["#9a3020", "sun"], ["#3a5a8a", "fish"], ["#3e6a2a", "face"]];
      for (let k = 0; k < 2; k++) { const [c, m] = cols[(s + k) % 3]; banner(pb, 26 + k * 104 + Math.floor(hash(k, 5, s) * 12), 10, 11, 18, c, m, s + k); }
      bones(pb, 160, 70, 6, s + 2);
      for (let k = 0; k < 3; k++) pb.line(84 + k * 4, 40, 86 + k * 4, 62, WOOD[2]);
    } else if (theme === "beast") {
      clawMarks(pb, T, 44, 26); clawMarks(pb, T, 140, 34);
      vines(pb, 70, 14, s); vines(pb, 98, 9, s + 1); vines(pb, 152, 12, s + 2);
      for (let k = 0; k < 40; k++) pb.set(10 + hash(k, 1, s) * 160, 66 + hash(k, 2, s) * 32, hash(k, 3, s) < 0.5 ? "#b0904a" : "#8a6a32");
      bones(pb, 160, 72, 5, s + 3);
    } else if (theme === "cave") {
      timber(pb, 18, 46, 18, FL); timber(pb, 138, 166, 16, FL);
      for (let k = 0; k < 10; k++) { const ox = 52 + hash(k, 1, s) * 80, oy = 8 + hash(k, 2, s) * 40; pb.set(ox, oy, "#c8a050"); pb.set(ox + 1, oy, "#8a6a30"); }
      cobweb(pb, 21, 21, 1, 8);
    } else if (theme === "undead") {
      niche(pb, T, 30, 18); niche(pb, T, 150, 20); niche(pb, T, 62, 14);
      if (kind !== "lair" && kind !== "puzzle") sarcophagus(pb, 136, 70);
      for (const [cx, cy] of candles(pb, 14, 94, 3, s)) A.flames.push([cx, cy, 0]);
      cobweb(pb, 6, 2, 1, 9);
    } else if (theme === "swamp") {
      for (let k = 0; k < 6; k++) vines(pb, 14 + Math.floor(hash(k, 7, s) * 150), 10 + Math.floor(hash(k, 8, s) * 22), s + k);
      puddle(pb, 40, 80, 9, "#2e4a32"); puddle(pb, 160, 94, 7, "#2e4a32");
      mushrooms(pb, glow, 8, 98, s); mushrooms(pb, glow, 158, 76, s + 3);
      A.lights.push({ x: 13, y: 94, r: 18, col: [0.4, 0.9, 0.55], k: 0.5 }, { x: 163, y: 72, r: 16, col: [0.4, 0.9, 0.55], k: 0.45 });
    } else if (theme === "ice") {
      snowDrift(pb, 4, 98, 26); snowDrift(pb, 150, 98, 28); snowDrift(pb, 70, 66, 16);
    } else if (theme === "sea") {
      seaDress(pb, glow, T, s, A);
    } else if (theme === "fire") {
      for (let x = 0; x < W; x++) for (let y = H - 4; y < H; y++) glow.set(x, y, (y === H - 4 ? T.accent[0] : hash(x >> 1, y, s) < 0.3 ? T.accent[1] : "#ff7a1a"));
      for (let x = 0; x < W; x++) pb.set(x, H - 5, "#2a120a");
      A.lights.push({ x: 40, y: H + 8, r: 60, col: [1.0, 0.42, 0.16], k: 0.8 }, { x: 140, y: H + 8, r: 60, col: [1.0, 0.42, 0.16], k: 0.8 });
    }
    dress(pb, glow, T, theme, kind, A, s, opts);
    for (const pr of props) { const sp = propSpot(kind, pr.slot, opts.sub); PAINT[pr.id](pb, glow, T, sp.x, sp.y, s, A, pr.v); }
    frameEdges(pb, T, s);
    const out = { cv: pb.canvas(), glow: glow.canvas(), A, T, theme, depth };
    BG[key] = out;
    return out;
  }
  // the room kind's own furniture (whatever moves is drawn by the vignette itself)
  function dress(pb, glow, T, theme, kind, A, s, opts) {
    const [fx, fy] = A.focus;
    if (kind === "chest" || kind === "secret") {
      for (let i = -14; i <= 14; i++) for (let j = -3; j <= 3; j++) if ((i / 14) ** 2 + (j / 3) ** 2 <= 1) pb.set(fx + i, fy + j, (i + j) % 4 === 0 ? "#6a2a1e" : "#7e3424");
      for (let k = 0; k < 4; k++) pb.set(fx - 18 + k * 9, fy + 2 + (k % 2), GOLD[3]);
      if (kind === "secret") { cobweb(pb, 6, 2, 1, 14); cobweb(pb, W - 7, 2, -1, 14); }
    } else if (kind === "trap" || kind === "famous") {
      for (let k = 0; k < 4; k++) pb.rect(fx - 12 + k * 7, fy - 2 + (k % 2), 5, 2, mix(T.framp[2], "#000000", 0.25));
      for (let k = 0; k < 5; k++) { pb.rect(168, 68 + k * 5, 2, 2, "#0a0806"); pb.set(168, 68 + k * 5, mix(T.ramp[1], "#000000", 0.5)); }
      if (kind === "famous") { pb.rect(70, 24, 22, 10, T.ramp[1]); pb.rect(71, 25, 20, 8, T.ramp[3]); for (let k = 0; k < 4; k++) pb.rect(73, 26 + k * 2, 10 + (k * 5) % 7, 1, T.ramp[0]); }
    } else if (kind === "puzzle" || (kind === "obstacle" && opts.sub === "stuck_door")) {
      const x0 = 106, x1 = 148;
      for (let y = 10; y < FL; y++) for (let x = x0 - 4; x < x1 + 4; x++) if (x < x0 || x >= x1 || y < 14) pb.set(x, y, (x + y) % 5 === 0 ? T.ramp[2] : T.ramp[3]);
      for (let x = x0 - 4; x < x1 + 4; x++) pb.set(x, 10, T.ramp[4]);
      pb.rect(x0, 14, x1 - x0, FL - 14, "#050404");
    } else if (kind === "obstacle" && (opts.sub === "chasm" || !opts.sub)) {
      A.chasm = [92, 120];
      if ((opts.props || []).some((p) => p.id === "silt")) A.sink = "silt";
      else chasm(pb, T, theme, s);
    } else if (kind === "obstacle" && opts.sub === "crawl") {
      hole(pb, T, theme, 149, 86, 14, 5, s);
      A.mouth = [149, 86];
    } else if (kind === "obstacle" && opts.sub === "slope") {
      for (let x = 96; x < 176; x++) { const top = Math.round(lerp(92, 58, (x - 96) / 80)); for (let y = top; y < H; y++) pb.set(x, y, pick(theme === "ice" ? T.framp : T.ramp, 0.65 - (y - top) * 0.02 + (y === top ? 0.3 : 0), x, y)); }
    } else if (kind === "shrine") {
      for (let j = 0; j < 22; j++) for (let i = 0; i < 18; i++) if ((i - 8.5) ** 2 / 81 + Math.max(0, 8 - j) ** 2 / 64 <= 1) pb.set(fx - 9 + i, 26 + j, mix(T.ramp[0], "#000000", 0.4));
      const I = ["#5a5244", "#7a7060", "#9a9080", "#bab0a0"];
      pb.rect(fx - 3, 32, 6, 14, I[2]); pb.rect(fx - 2, 29, 4, 4, I[3]); pb.rect(fx - 3, 32, 1, 14, I[3]); pb.rect(fx + 2, 32, 1, 14, I[1]); pb.rect(fx - 5, 36, 10, 2, I[2]);
      pb.rect(fx - 13, fy - 10, 26, 10, I[1]); pb.rect(fx - 13, fy - 10, 26, 1, I[3]); pb.rect(fx - 14, fy - 12, 28, 2, I[2]);
      pb.rect(fx - 10, fy - 12, 20, 2, "#7a2a20"); pb.rect(fx - 3, fy - 10, 6, 6, "#7a2a20");
      A.candles = []; for (let k = 0; k < 5; k++) { const cx = fx - 11 + k * 5 + (k % 2), h = 3 + (k * 7) % 3; pb.rect(cx, fy - 12 - h, 1, h, "#e8dcc0"); A.candles.push([cx, fy - 13 - h]); }
    } else if (kind === "lore") {
      pb.rect(48, 10, 120, 42, mix(T.ramp[1], "#000000", 0.2));
      pb.rect(48, 10, 120, 1, T.ramp[4]); pb.rect(48, 51, 120, 1, T.ramp[0]);
      A.mural = [50, 12, 116, 38];
    } else if (kind === "supplies" || kind === "cache") {
      crate(pb, 146, 92, 14, 11); crate(pb, 160, 94, 12, 10); crate(pb, 150, 81, 12, 9); barrel(pb, 120, 88, 9, 14); sack(pb, 166, 82);
      if (kind === "cache") { barrel(pb, 24, 74, 8, 12); crate(pb, 160, 70, 10, 8); }
    } else if (kind === "camp_spot") {
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, x = fx + Math.cos(a) * 9, y = fy + Math.sin(a) * 3; pb.rect(x - 1, y - 1, 3, 2, T.ramp[3]); pb.set(x - 1, y - 1, T.ramp[4]); }
      for (let y = 22; y < FL; y++) for (let x = 150; x < 168; x++) pb.set(x, y, y < 25 || x < 152 || x > 165 ? WOOD[1] : "#060504");
    } else if (kind === "stair") {
      for (let y = 68; y < H; y++) for (let x = 132; x < W; x++) pb.set(x, y, "#060504");
      for (let k = 0; k < 6; k++) { const y = 70 + k * 5, x0 = 136 + k * 5; pb.rect(x0, y, W - x0, 4, mix(T.ramp[2], "#000000", k * 0.14)); pb.rect(x0, y, W - x0, 1, mix(T.ramp[4], "#000000", k * 0.14)); pb.rect(x0, y, 1, 4, mix(T.ramp[3], "#000000", k * 0.14)); }
      for (let x = 132; x < W; x++) pb.set(x, 68, T.ramp[4]);
      for (let y = 68; y < H; y++) pb.set(132, y, T.ramp[3]);
    } else if (kind === "lair") lairDress(pb, glow, T, theme, A, s);
    else if (kind === "fear") {
      for (let j = 0; j < 30; j++) for (let i = 0; i < 20; i++) if ((i - 9.5) ** 2 / 100 + Math.max(0, 10 - j) ** 2 / 100 <= 1) pb.set(110 + i, FL - 30 + j, "#040303");
      clawMarks(pb, T, 74, 20); clawMarks(pb, T, 150, 30);
    } else if (kind === "fight") {
      rubble(pb, T, 150, 96, 6, s); barrel(pb, 20, 70, 8, 10);
    } else if (kind === "remains") {
      for (let k = 0; k < 3; k++) pb.line(fx + 10 + k * 3, fy - 30, fx + 6 + k * 3, fy - 18, T.ramp[0]);
    }
  }
  function lairDress(pb, glow, T, theme, A, s) {
    const fx = A.focus[0];
    if (theme === "goblin") {
      for (let k = 0; k < 14; k++) { const x = fx - 22 + hash(k, 1, s) * 44, y = 90 - hash(k, 2, s) * 10; crate(pb, x, y, 6 + (k % 3) * 2, 4 + (k % 4)); }
      banner(pb, 100, 6, 14, 24, "#9a3020", "face", s); banner(pb, 150, 6, 12, 22, "#3e6a2a", "sun", s + 1);
    } else if (theme === "beast") {
      for (let k = 0; k < 90; k++) pb.set(fx - 26 + hash(k, 1, s) * 52, 84 + hash(k, 2, s) * 12, hash(k, 3, s) < 0.6 ? "#b0904a" : "#7a5a2a");
      bones(pb, fx - 30, 96, 8, s); bones(pb, fx + 26, 94, 7, s + 1);
    } else if (theme === "cave") {
      for (let k = 0; k < 6; k++) cobweb(pb, 100 + k * 13, 2, k % 2 ? -1 : 1, 16);
      for (let k = 0; k < 30; k++) pb.set(fx - 20 + hash(k, 1, s) * 40, 88 + hash(k, 2, s) * 8, k % 3 ? GOLD[3] : GOLD[2]);
    } else if (theme === "undead") {
      pb.rect(fx - 18, 66, 36, 14, "#3e4446"); pb.rect(fx - 18, 66, 36, 1, "#727a78");
      for (let k = 0; k < 5; k++) glow.set(fx - 14 + k * 7, 64, "#7ad0b0");
    } else if (theme === "swamp") {
      for (let i = -10; i <= 10; i++) for (let j = 0; j < 9; j++) if (i * i / 100 + (j - 4) ** 2 / 20 <= 1) pb.set(fx - 30 + i, 86 + j, j < 2 ? "#2a2a2a" : "#151515");
      for (let i = -8; i <= 8; i++) glow.set(fx - 30 + i, 86, i % 3 ? "#7ad050" : "#b0f070");
      A.lights.push({ x: fx - 30, y: 84, r: 30, col: [0.4, 0.95, 0.35], k: 0.7 });
    } else if (theme === "ice") {
      for (let j = 0; j < 40; j++) for (let i = -12; i <= 12; i++) if (Math.abs(i) < 12 - j * 0.1) pb.set(fx + 10 + i, 90 - j, Math.abs(i) > 9 || j > 36 ? "#d8f0fa" : "#8ab0c8");
    } else if (theme === "sea") {
      for (let y = 80; y < H; y++) for (let x = 90; x < 176; x++) pb.set(x, y, (x + y * 3) % 11 === 0 ? "#3a7a8a" : y === 80 ? "#6ab0c0" : "#1a3e4a");
    } else if (theme === "fire") {
      for (let k = 0; k < 60; k++) { const x = fx - 26 + hash(k, 1, s) * 52, y = 96 - hash(k, 2, s) * 12 * (1 - Math.abs(x - fx) / 30); pb.set(x, y, k % 4 ? GOLD[3] : GOLD[4]); pb.set(x + 1, y, GOLD[2]); }
    }
  }

  // a corridor strip for the walk in: the same wall and floor, wider, with side doors
  function corridor(theme, depth, seed) {
    const key = ["corr", theme, depth, seed || 0].join("|");
    if (BG[key]) return BG[key];
    const T = themeOf(theme), s = (hashStr(theme) + (seed || 0) * 31) % 9973, CW = W * 3, pb = new PB(CW, H), glow = new PB(CW, H);
    for (let part = 0; part < 3; part++) {
      const sub = new PB(W, H), sg = new PB(W, H);
      paintWall(sub, sg, T, 0, W, 0, FL, s, part * W);
      paintFloor(sub, sg, T, s, part * W);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, o = (y * CW + x + part * W) * 4;
        for (let c = 0; c < 4; c++) { pb.d[o + c] = sub.d[i + c]; glow.d[o + c] = sg.d[i + c]; }
      }
    }
    const doors = [], lights = [];
    for (let x = 40; x < CW - 30; x += 70 + Math.floor(hash(x, 1, s) * 30)) {
      doors.push(x);
      for (let y = 30; y < FL; y++) for (let i = -1; i < 17; i++) pb.set(x + i, y, i < 0 || i === 16 || y === 30 ? WOOD[1] : (i % 5 === 0 ? WOOD[1] : y % 9 === 0 ? WOOD[1] : WOOD[2]));
      pb.rect(x + 12, 46, 2, 2, IRON[3]);
    }
    if (depth === 2) for (let x = 20; x < CW; x += 90) { sconce(pb, x, 30); lights.push(x); }
    const out = { cv: pb.canvas(), glow: glow.canvas(), w: CW, doors, lights, T };
    BG[key] = out;
    return out;
  }

  // ---------- sprites ----------
  const SPR = new Map();
  const statics = () => (root.LD && root.LD.static) || {};
  function heroCanvas(h, frame, pose) {
    const k = "h:" + (h.id || h.name) + ":" + (frame || 0) + ":" + (pose || "");
    let c = SPR.get(k);
    if (c) return c;
    const cls = (statics().classes || {})[h.cls] || (statics().classes || {}).warrior || null;
    try {
      const g = pose === "seated" ? root.Art.heroSeated(h, frame || 0, cls, 32) : root.Art.heroGrid(h, frame || 0, cls);
      c = g.toCanvas(1);
    } catch (e) { c = mk(16, 30); const x = c.getContext("2d"); x.fillStyle = (h.look && h.look.fav) || "#5a7ab8"; x.fillRect(4, 8, 8, 20); x.fillStyle = (h.look && h.look.skin) || "#d8a880"; x.fillRect(5, 2, 6, 6); }
    SPR.set(k, c);
    return c;
  }
  function monCanvas(id, frame) {
    const k = "m:" + id + ":" + (frame || 0);
    let c = SPR.get(k);
    if (c) return c;
    const m = (statics().monsters || {})[id];
    try { c = root.Art.monsterGrid(m || { body: "goblin", pal: "green" }, frame || 0).toCanvas(1); } catch (e) { c = mk(16, 16); const x = c.getContext("2d"); x.fillStyle = "#5a7a3a"; x.fillRect(2, 2, 12, 14); }
    SPR.set(k, c);
    return c;
  }
  function tinted(cv, col, a) {
    const k = cv.__tk || (cv.__tk = Math.random().toString(36).slice(2));
    const key = "t:" + k + col + Math.round(a * 8);
    let c = SPR.get(key);
    if (c) return c;
    c = mk(cv.width, cv.height);
    const x = c.getContext("2d");
    x.drawImage(cv, 0, 0);
    x.globalCompositeOperation = "source-atop"; x.globalAlpha = Math.round(a * 8) / 8; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    SPR.set(key, c);
    return c;
  }
  // the bottom row of a sprite's opaque pixels, so feet stand on the floor line
  function footRow(cv) {
    if (cv.__foot != null) return cv.__foot;
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let y = cv.height - 1;
    outer: for (; y > 0; y--) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 0) break outer;
    return (cv.__foot = y + 1);
  }

  // loot: the item as the site's own gear icon (the same reading of name, slot and tier the dungeon page uses)
  const WEAPON_WORDS = [[/crossbow/i, "crossbow"], [/bow\b/i, "bow"], [/axe/i, "axe"], [/mace|hammer|club|maul/i, "mace"], [/spear|pike|glaive|halberd/i, "spear"], [/dagger|knife|dirk/i, "daggers"],
    [/staff/i, "staff"], [/wand/i, "wand"], [/lute/i, "lute"], [/pan\b/i, "frying_pan"], [/./, "sword"]];
  function lootItem(l) {
    const gear = statics().gear || {}, slot = l.slot === "ring" ? "ring1" : l.slot;
    const it = { slot, name: l.name, grade: { great: "great", unique: "unique", common: "common", cosmetic: "plain" }[l.tier] || "common", tier: l.tier === "unique" ? 3 : l.tier === "great" ? 2 : l.tier === "cosmetic" ? 0 : 1 };
    const fam = Object.values(gear.families || {}).find((f) => (f.slot === l.slot || (l.slot === "ring" && f.slot === "ring")) && (f.names || []).some((n) => l.name.endsWith(n)));
    if (fam) { it.art = fam.art; it.tier = Math.max(0, fam.names.findIndex((n) => l.name.endsWith(n))); if (slot === "back" || slot === "head" || slot === "offhand") it.tier = Math.max(it.tier, 1); }
    const jw = (gear.jewelry || []).concat(gear.magic || []).find((x) => x.name === l.name);
    if (jw) Object.assign(it, { art: jw.art, gem: jw.gem, tint: jw.tint, glow: jw.glow });
    if (!it.art) {
      if (slot === "weapon") it.art = WEAPON_WORDS.find(([re]) => re.test(l.name))[1];
      else if (slot === "armor") it.art = /robe|vest|coat/i.test(l.name) ? "cloth" : /chain|mail/i.test(l.name) ? "chain" : /plate/i.test(l.name) ? "plate" : "leather";
      else it.art = { head: "leather_cap", back: "cloak", offhand: "shield", ring1: "ring", neck: "amulet", belt: "belt", boots: "boots", gloves: "gloves", pocket: "coin" }[slot] || "coin";
    }
    if (slot === "weapon") it.tier = Math.max(1, it.tier + 1);
    return it;
  }
  function itemCanvas(l) {
    const k = "i:" + l.name + l.tier + l.slot;
    let c = SPR.get(k);
    if (c) return c;
    try { c = root.Art.gearIcon(lootItem(l), null).toCanvas(1); } catch (e) { c = mk(10, 10); const x = c.getContext("2d"); x.fillStyle = GOLD[3]; x.fillRect(2, 2, 6, 6); }
    SPR.set(k, c);
    return c;
  }
  const UNIQUE_AURA = ["#4ec8b0", "#e0604a", "#5ab0e8", "#7ad05a", "#e8a03a"];
  const auraOf = (l) => (l.tier === "unique" ? UNIQUE_AURA[hashStr(l.name) % UNIQUE_AURA.length] : l.tier === "great" ? "#f2c450" : l.tier === "common" ? "#d8e2ea" : "#e8c8a0");

  // ---------- the 3x5 hand ----------
  const GLYPHS = {
    A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100", G: "011100101101011",
    H: "101101111101101", I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111", M: "1000111011101011000110001",
    N: "10011101101110011001", O: "010101101101010", P: "110101110100100", Q: "010101101110011", R: "110101110101101", S: "011100010001110",
    T: "111010010010010", U: "101101101101111", V: "101101101101010", W: "1000110001101011101110001", X: "101101010101101", Y: "101101010010010",
    Z: "111001010100111", 0: "111101101101111", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110", 4: "101101111001001",
    5: "111100110001110", 6: "011100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001110", "!": "11101", "?": "110001010000010",
    ".": "00001", ",": "0001010", ":": "01010", "-": "000000111000000", "'": "11000", "&": "010101010101011", " ": "0000000000",
  };
  const glyph = (ch) => { const g = GLYPHS[ch] || GLYPHS[ch.toUpperCase()] || GLYPHS["?"]; return { g, w: g.length / 5 }; };
  function textWidth(s, k) { k = k || 1; let w = 0; for (const ch of String(s)) w += (glyph(ch).w + 1) * k; return Math.max(0, w - k); }
  function text(ctx, s, x, y, col, o) {
    o = o || {};
    const k = o.k || 1;
    if (o.center) x = Math.round(x - textWidth(s, k) / 2);
    const draw = (ox, oy, c) => {
      ctx.fillStyle = c;
      let cx = x + ox;
      for (const ch of String(s)) {
        const { g, w } = glyph(ch);
        for (let j = 0; j < 5; j++) for (let i = 0; i < w; i++) if (g[j * w + i] === "1") ctx.fillRect(cx + i * k, y + oy + j * k, k, k);
        cx += (w + 1) * k;
      }
    };
    if (o.outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) draw(dx, dy, o.outline);
    if (o.shadow) draw(0, 1, o.shadow);
    draw(0, 0, col);
  }

  // ---------- light ----------
  // each pixel takes the room's ambient plus every light that reaches it, stepped in eighths and dithered so pools of light keep a pixel edge
  function lightPass(img, env, lights, beams) {
    const d = img.data, amb = env.amb, edge = env.depth >= 3 ? 1 : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let r = amb[0], g = amb[1], b = amb[2];
      for (const s of lights) {
        const dx = x - s.x, dy = (y - s.y) * (s.flat || 1), d2 = dx * dx + dy * dy;
        if (d2 >= s.r * s.r) continue;
        let f = 1 - Math.sqrt(d2) / s.r;
        f = f * f * s.k;
        r += s.col[0] * f; g += s.col[1] * f; b += s.col[2] * f;
      }
      for (const bm of beams) {
        const vx = bm.x1 - bm.x0, vy = bm.y1 - bm.y0, L2 = vx * vx + vy * vy, u = clamp(((x - bm.x0) * vx + (y - bm.y0) * vy) / L2, 0, 1);
        const px = bm.x0 + vx * u, py = bm.y0 + vy * u, dd = Math.hypot(x - px, y - py);
        if (dd >= bm.w) continue;
        const f = (1 - dd / bm.w) * bm.k * (0.55 + 0.45 * (1 - u)) * (y > FL ? 1.2 : 0.8);
        r += f; g += f * 0.95; b += f * 0.8;
      }
      if (edge) { const e = Math.min(x, W - 1 - x, y * 1.6, (H - 1 - y) * 2.5); if (e < 22) { const k = 0.35 + 0.65 * (e / 22); r *= k; g *= k; b *= k; } }
      const t = bay(x, y) - 0.5, q = (v) => Math.max(0, Math.floor(v * 14 + t) / 14);
      const i = (y * W + x) * 4;
      d[i] = d[i] * Math.min(1.35, q(r)); d[i + 1] = d[i + 1] * Math.min(1.35, q(g)); d[i + 2] = d[i + 2] * Math.min(1.35, q(b));
    }
  }
  // no light left: everything outside one flickering circle round the crew goes black
  function mask(img, darkness) {
    const d = img.data, { x: cx, y: cy, r: R } = darkness;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dd = Math.hypot(x - cx, (y - cy) * 1.15);
      if (dd < R - 3) continue;
      const i = (y * W + x) * 4;
      if (dd > R || bay(x, y) < (dd - (R - 3)) / 3) d[i] = d[i + 1] = d[i + 2] = 0;
    }
  }
  function flame(g, x, y, t, big) {
    const f = Math.floor(t * 12 + x * 3) % 3, h = big ? 5 : 3;
    const C = ["#fff4c0", "#ffd060", "#ff9a30", "#e05a18"];
    for (let j = 0; j < h; j++) {
      const w = j === 0 ? 0 : j < 2 ? 1 : big ? 1 : 0;
      for (let i = -w; i <= w; i++) { g.fillStyle = C[clamp(j - (i === 0 ? 1 : 0), 0, 3)]; g.fillRect(x + i + (j === h - 1 && f === 1 ? 1 : 0) - (j === h - 1 && f === 2 ? 1 : 0), y - j + (h - 1), 1, 1); }
    }
    g.fillStyle = C[0]; g.fillRect(x, y + h - 2, 1, 1);
  }

  // ---------- the stage a vignette draws on ----------
  function envOf(rec) {
    // the basalt store rooms of a fire lair had almost no light of their own (the sealed casks read as black): lift them like the deep sea
    const T = themeOf(rec.theme), depth = clamp(rec.floor || 1, 1, 4), base = DEPTH_AMB[depth] * (rec.theme === "sea" && depth >= 3 ? 1.3 : 1)
      * (rec.theme === "fire" && ["supplies", "cache", "camp_spot", "lore", "remains"].includes(rec.kind) ? 1.4 : 1);
    const crew = (rec.crew || []).filter(Boolean);
    return { rec, T, theme: rec.theme in THEMES ? rec.theme : "cave", depth, kind: rec.kind, dark: !!rec.dark, pace: rec.pace || "steady", crew,
      byId: Object.fromEntries(crew.map((h, i) => [h.id, i])), seed: hashStr((rec.theme || "") + (rec.name || "") + rec.n) % 997,
      amb: [base * T.amb[0], base * T.amb[1], base * T.amb[2]] };
  }
  // the crew's home marks: the lead in front (right), each one back a step, alternating rows for depth
  function home(env, i) {
    const n = Math.max(1, env.crew.length), gap = n > 4 ? 15 : 19;
    return { x: (n > 4 ? 80 : 76) - i * gap, y: 93 - (i % 2) * 4 };
  }
  function Stage(env, wctx, gctx, T) {
    this.env = env; this.ctx = wctx; this.g = gctx; this.T = T;
    this.lights = []; this.beams = []; this.ui = []; this.post = {};
    this.cam = { x: 0, y: 0, z: 1, cx: W / 2, cy: H / 2 };
  }
  Stage.prototype = {
    W, H, FL,
    put(cv, x, y, o) {
      o = o || {};
      const c = o.tint ? tinted(cv, o.tint, o.ta == null ? 0.6 : o.ta) : cv, w = c.width, h = c.height, foot = o.raw ? h : footRow(cv);
      const ctx = o.glow ? this.g : this.ctx;
      ctx.save();
      if (o.alpha != null) ctx.globalAlpha = clamp(o.alpha, 0, 1);
      ctx.translate(Math.round(x), Math.round(y));
      if (o.clipY != null) { ctx.beginPath(); ctx.rect(-80, -80, 160, Math.round(o.clipY - y) + 80); ctx.clip(); }
      const rot = o.rot || 0;
      if (rot) { ctx.translate(0, -Math.round(foot / 2)); ctx.rotate((rot * Math.PI) / 2); ctx.translate(0, Math.round(foot / 2)); }
      // a lean (skew) pivots on the feet, so a stagger tips the head and leaves the feet planted
      if (o.skew && !rot) ctx.transform(1, 0, -o.skew, 1, 0, 0);
      if (o.flip) ctx.scale(-1, 1);
      ctx.drawImage(c, -Math.floor(w / 2), -foot);
      ctx.restore();
    },
    shadow(x, y, w) { const c = this.ctx; c.fillStyle = "rgba(0,0,0,0.38)"; c.fillRect(Math.round(x - w / 2), Math.round(y) - 1, Math.round(w), 2); c.fillRect(Math.round(x - w / 2) + 2, Math.round(y), Math.round(w) - 4, 1); },
    hero(i, x, y, o) {
      const h = this.env.crew[i];
      if (!h) return;
      o = o || {};
      const cv = heroCanvas(h, o.frame || 0, o.pose);
      if (!o.noShadow && !o.rot) this.shadow(x, y, 12);
      this.put(cv, x, y + (o.dy || 0), o);
    },
    mon(id, x, y, o) { o = o || {}; const cv = monCanvas(id, o.frame || 0); if (!o.noShadow) this.shadow(x, y, Math.min(30, cv.width * 0.7)); this.put(cv, x, y + (o.dy || 0), o); return cv; },
    item(l, x, y, o) { this.put(itemCanvas(l), x, y, Object.assign({ raw: true }, o || {})); },
    px(x, y, c, glow) { const g = glow ? this.g : this.ctx; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); },
    rect(x, y, w, h, c, glow) { const g = glow ? this.g : this.ctx; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); },
    line(x0, y0, x1, y1, c, glow) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, glow); },
    light(x, y, r, col, k, flat) { this.lights.push({ x, y, r, col: col || [1, 0.7, 0.4], k: k == null ? 1 : k, flat }); },
    beam(b) { this.beams.push(b); },
    flame(x, y, big) { flame(this.g, Math.round(x), Math.round(y), this.T, big); },
    torch(x, y) {
      this.rect(x, y, 1, 6, WOOD[2]); this.px(x, y + 1, WOOD[3]);
      this.flame(x, y - 4, false);
      const fl = 1 + Math.sin(this.T * 17 + x) * 0.04 + Math.sin(this.T * 7.3) * 0.05;
      this.light(x, y - 2, (this.env.depth >= 3 ? 84 : 70) * fl, [1.0, 0.7, 0.42], 1.3);
    },
    lantern(x, y) {
      this.rect(x - 1, y - 1, 3, 1, IRON[2]); this.rect(x - 1, y, 3, 4, IRON[1]); this.rect(x, y + 1, 1, 2, "#ffe08a", true); this.px(x, y - 2, IRON[3]);
      this.light(x, y + 2, 60 + Math.sin(this.T * 5) * 1.5, [1.0, 0.8, 0.5], 1.2);
    },
    text(s, x, y, c, o) { this.ui.push(() => text(this.outCtx, s, x, y, c, o)); },
    uiDraw(fn) { this.ui.push(() => fn(this.outCtx)); },
    shake(a) { this.cam.x += Math.round(Math.sin(this.T * 61) * a); this.cam.y += Math.round(Math.cos(this.T * 47) * a * 0.6); },
  };

  // ---------- one frame ----------
  let SCRATCH = null;
  function scratch() {
    if (!SCRATCH) {
      const w = mk(W, H), g = mk(W, H);
      SCRATCH = { w, g, wc: w.getContext("2d"), gc: g.getContext("2d") };
      SCRATCH.wc.imageSmoothingEnabled = false; SCRATCH.gc.imageSmoothingEnabled = false;
    }
    return SCRATCH;
  }
  // rec: a room record as exported (league/delve.py scene_of) plus theme, floor, pace, crew (hero objects) and boss { mon, name }
  function frame(rec, t, cv, amb) {
    const P = plan(rec), env = P.env, sc = scratch(), out = cv.getContext("2d");
    out.imageSmoothingEnabled = false;
    sc.wc.setTransform(1, 0, 0, 1, 0, 0); sc.gc.setTransform(1, 0, 0, 1, 0, 0);
    sc.wc.clearRect(0, 0, W, H); sc.gc.clearRect(0, 0, W, H);
    const T = Math.min(t, P.len), A = amb == null ? t : amb;
    const st = new Stage(env, sc.wc, sc.gc, A);
    st.t = T; st.P = P;
    const clip = P.clips.find((c) => T >= c.t0 && T < c.t0 + c.dur) || P.clips[P.clips.length - 1];
    st.clip = clip;
    clip.draw(st, clamp(T - clip.t0, 0, clip.dur), T);
    if (!st.noLight) {
      const im = sc.wc.getImageData(0, 0, W, H);
      lightPass(im, st.ambOverride ? Object.assign({}, env, { amb: st.ambOverride }) : env, st.lights, st.beams);
      sc.wc.putImageData(im, 0, 0);
    }
    sc.wc.drawImage(sc.g, 0, 0);
    if (st.darkness) { const im = sc.wc.getImageData(0, 0, W, H); mask(im, st.darkness); sc.wc.putImageData(im, 0, 0); }
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.fillStyle = "#000"; out.fillRect(0, 0, W, H);
    const c = st.cam;
    if (c.z !== 1) {
      const sw = W / c.z, sh = H / c.z, sx = clamp(c.cx - sw / 2, 0, W - sw), sy = clamp(c.cy - sh / 2, 0, H - sh);
      out.drawImage(sc.w, sx, sy, sw, sh, c.x, c.y, W, H);
    } else out.drawImage(sc.w, c.x, c.y);
    if (st.post.fear || st.post.grey || st.post.warp) post(out, st.post, A);
    st.outCtx = out;
    for (const fn of st.ui) fn();
    return cv;
  }
  function post(out, p, t) {
    const im = out.getImageData(0, 0, W, H), d = im.data;
    if (p.warp) {
      const src = new Uint8ClampedArray(d);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const e = Math.min(x, W - 1 - x) / 40;
          if (e >= 1) continue;
          const sx = clamp(Math.round(x + Math.sin(y * 0.22 + t * 3.1) * (1 - e) * 3 * p.warp), 0, W - 1), i = (y * W + x) * 4, j = (y * W + sx) * 4;
          d[i] = src[j]; d[i + 1] = src[j + 1]; d[i + 2] = src[j + 2];
        }
      }
    }
    for (let i = 0; i < d.length; i += 4) {
      const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      if (p.grey) { const k = p.grey; d[i] += (l - d[i]) * k; d[i + 1] += (l - d[i + 1]) * k; d[i + 2] += (l - d[i + 2]) * k; }
      if (p.fear) { const k = p.fear; d[i] = lerp(d[i], l * 0.6, k); d[i + 1] = lerp(d[i + 1], l * 0.82, k); d[i + 2] = lerp(d[i + 2], l * 1.15 + 10, k); }
    }
    out.putImageData(im, 0, 0);
  }

  // ---------- the plan: built by delve_fx.js from the record's beats ----------
  const PLANS = new WeakMap();
  function plan(rec) {
    let P = PLANS.get(rec);
    if (!P) { P = root.DelveScenes.build(rec, envOf(rec)); PLANS.set(rec, P); }
    return P;
  }
  const length = (rec) => plan(rec).len;
  const events = (rec) => plan(rec).events;

  // ---------- sound: its own context, following audio.js's settings and first-click unlock ----------
  const Snd = (() => {
    let ctx = null, out = null, noiseBuf = null, unlocked = false;
    const prefs = () => {
      if (root.Sound && root.Sound.fxPrefs) return root.Sound.fxPrefs();
      try { return Object.assign({ on: true, master: 0.7, sfx: 0.6 }, JSON.parse(root.localStorage.getItem("al.sound") || "{}")); } catch (e) { return { on: true, master: 0.7, sfx: 0.6 }; }
    };
    const open = () => unlocked || !!(root.Sound && root.Sound.unlocked);
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
      if (!open() || !pr.on || !init()) return null;
      if (ctx.state === "suspended") ctx.resume();
      out.gain.value = pr.master * pr.sfx * 0.8;
      return ctx;
    }
    function noise(t, dur, vol, type, freq, q, f2) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; s.loop = true;
      f.type = type; f.frequency.setValueAtTime(freq, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.006, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    }
    function tone(t, f0, f1, dur, vol, type, attack) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
    const FX = {
      step: (t, v) => noise(t, 0.05, 0.05 * v, "lowpass", 500, 0.7),
      click: (t, v) => { noise(t, 0.03, 0.3 * v, "bandpass", 3200, 8); tone(t, 1800, 1500, 0.04, 0.08 * v, "square"); },
      clunk: (t, v) => { noise(t, 0.12, 0.3 * v, "lowpass", 400, 1.2); tone(t, 110, 80, 0.2, 0.2 * v, "triangle"); },
      creak: (t, v) => { tone(t, 180, 260, 0.5, 0.05 * v, "sawtooth", 0.1); noise(t, 0.5, 0.05 * v, "bandpass", 700, 4, 1100); },
      crack: (t, v) => { noise(t, 0.18, 0.5 * v, "highpass", 900); noise(t + 0.03, 0.25, 0.3 * v, "lowpass", 600); },
      thud: (t, v) => { tone(t, 90, 45, 0.25, 0.35 * v, "sine"); noise(t, 0.15, 0.2 * v, "lowpass", 300); },
      whoosh: (t, v) => noise(t, 0.28, 0.16 * v, "bandpass", 600, 1.5, 2600),
      hiss: (t, v) => noise(t, 0.7, 0.12 * v, "highpass", 3000),
      hit: (t, v) => { noise(t, 0.08, 0.35 * v, "bandpass", 1400, 1.5); tone(t, 220, 120, 0.1, 0.12 * v, "square"); },
      boing: (t, v) => tone(t, 220, 660, 0.35, 0.12 * v, "triangle"),
      splash: (t, v) => { noise(t, 0.5, 0.25 * v, "bandpass", 900, 0.8, 300); noise(t + 0.05, 0.3, 0.12 * v, "highpass", 2500); },
      rumble: (t, v) => { noise(t, 1.0, 0.3 * v, "lowpass", 120, 0.8); tone(t, 50, 40, 1.0, 0.12 * v, "sine", 0.2); },
      drip: (t, v) => tone(t, 1400, 700, 0.09, 0.06 * v, "sine"),
      dread: (t, v) => { tone(t, 55, 52, 2.2, 0.12 * v, "sine", 0.6); tone(t, 82, 80, 2.0, 0.05 * v, "triangle", 0.8); },
      beat: (t, v) => { tone(t, 60, 40, 0.15, 0.25 * v, "sine"); tone(t + 0.18, 55, 38, 0.15, 0.18 * v, "sine"); },
      pop: (t, v) => { tone(t, 600, 300, 0.06, 0.08 * v, "sine"); noise(t, 0.05, 0.05 * v, "bandpass", 1800, 3); },
      // what each find sounds like, by how good it is: copper, silver, gold, and a bell for a unique
      clink: (t, v) => { for (const [m, a] of [[1, 1], [2.4, 0.4]]) tone(t, 1250 * m, 1250 * m, 0.25, 0.06 * a * v); },
      shimmer: (t, v) => { for (let k = 0; k < 5; k++) tone(t + k * 0.05, 2200 + k * 330, 2200 + k * 330, 0.3, 0.035 * v); },
      flare: (t, v) => { for (const [f, a] of [[880, 1], [1320, 0.6], [1760, 0.4]]) tone(t, f, f, 0.9, 0.06 * a * v, "triangle", 0.01); noise(t, 0.4, 0.05 * v, "highpass", 5000); },
      bell: (t, v) => { for (const [m, a] of [[1, 1], [2.76, 0.45], [5.4, 0.25], [0.5, 0.5]]) tone(t, 196 * m, 196 * m, 2.6 / Math.sqrt(m), 0.12 * a * v, "sine", 0.005); },
      coins: (t, v) => { for (let k = 0; k < 6; k++) tone(t + k * 0.045, 2400 + (k % 3) * 400, 2300, 0.12, 0.04 * v); },
      chime: (t, v) => { for (let k = 0; k < 4; k++) tone(t + k * 0.11, 660 * 2 ** (k * 4 / 12), 660 * 2 ** (k * 4 / 12), 0.6, 0.05 * v, "sine"); },
      glow: (t, v) => { tone(t, 440, 440, 1.2, 0.05 * v, "sine", 0.3); tone(t, 660, 660, 1.2, 0.03 * v, "sine", 0.4); },
      cold: (t, v) => { tone(t, 300, 200, 1.0, 0.05 * v, "triangle", 0.2); noise(t, 0.9, 0.05 * v, "bandpass", 2400, 6); },
      slam: (t, v) => { noise(t, 0.12, 0.4 * v, "lowpass", 1200); tone(t, 140, 60, 0.3, 0.3 * v, "square"); },
      stamp: (t, v) => { tone(t, 80, 40, 0.4, 0.45 * v, "sine"); noise(t, 0.2, 0.35 * v, "lowpass", 500); },
      roar: (t, v) => { noise(t, 1.0, 0.25 * v, "bandpass", 220, 1.2, 140); tone(t, 90, 60, 1.0, 0.15 * v, "sawtooth", 0.1); },
      alarm: (t, v) => { for (let k = 0; k < 6; k++) tone(t + k * 0.12, k % 2 ? 1700 : 1500, 1500, 0.1, 0.06 * v, "square"); },
      cough: (t, v) => { for (let k = 0; k < 3; k++) noise(t + k * 0.22, 0.12, 0.15 * v, "bandpass", 500, 2); },
      scrape: (t, v) => noise(t, 0.9, 0.12 * v, "bandpass", 250, 2, 180),
      scribble: (t, v) => { for (let k = 0; k < 4; k++) noise(t + k * 0.09, 0.06, 0.04 * v, "bandpass", 4200, 3); },
    };
    function play(name, v) { const c = ok(); if (!c || !FX[name]) return; try { FX[name](c.currentTime + 0.01, v == null ? 1 : v); } catch (e) { /* audio node limits */ } }
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
    const doc = root.document, fig = doc.createElement("figure"), cv = mk(W, H);
    fig.className = "delve-scene";
    fig.style.cssText = "margin:0;position:relative";
    cv.style.cssText = "image-rendering:pixelated;image-rendering:crisp-edges;display:block;width:100%;height:auto;cursor:pointer;background:#000";
    cv.title = "Click to watch again";
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", opts.label || rec.name || "A room below");
    fig.appendChild(cv);
    const dur = length(rec), evs = events(rec);
    let t = reduced() ? dur : 0, amb = 0, raf = 0, last = 0, onscreen = false, fired = reduced() ? evs.length : 0, held = false, rate = 1, drawn = -1;
    const live = () => !held && fig.isConnected && onscreen && !doc.hidden;
    const paint = () => { frame(rec, t, cv, amb); drawn = amb; };
    function step(ms) {
      raf = 0;
      if (!live()) { last = 0; return; }
      const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
      last = ms;
      if (t < dur) t = Math.min(dur, t + dt * rate);
      amb += dt;
      while (fired < evs.length && evs[fired][0] <= t) {
        const e = evs[fired++];
        if (e[0] > t - 0.3) Snd.play(e[1], e[2]);
        if (opts.onEvent && e[3]) opts.onEvent(e[3]);
      }
      // the hold only flickers flames and drifts motes, so it redraws a few times a second
      if (t < dur || amb - drawn > 1 / 8) paint();
      if (t < dur || !reduced()) raf = root.requestAnimationFrame(step);
    }
    const wake = () => { if (!raf && live()) { last = 0; raf = root.requestAnimationFrame(step); } };
    const restart = (ev) => {
      if (ev && opts.ownClick) ev.stopPropagation();
      held = false; t = 0; amb = 0; fired = 0;
      if (opts.onRestart) opts.onRestart();
      paint(); wake();
    };
    cv.addEventListener("click", restart);
    if ("IntersectionObserver" in root) {
      const io = new root.IntersectionObserver((es) => { onscreen = es[es.length - 1].isIntersecting; wake(); });
      io.observe(fig);
    } else onscreen = true;
    doc.addEventListener("visibilitychange", wake);
    if (reduced() && opts.onEvent) for (const e of evs) if (e[3]) opts.onEvent(e[3]);
    paint();
    fig.replay = {
      get t() { return t; }, get dur() { return dur; }, get playing() { return !held && t < dur; },
      play() { held = false; wake(); }, pause() { held = true; }, restart() { restart(); },
      skip() { t = dur; while (fired < evs.length) { const e = evs[fired++]; if (opts.onEvent && e[3]) opts.onEvent(e[3]); } paint(); wake(); }, rate(s) { rate = s; },
    };
    return fig;
  }

  root.DelveScenes = {
    W, H, FL, THEMES, FOCUS, PROPS, propsOf, sceneAnim, background, corridor, player, frame, length, events, plan, envOf, home, lootItem, itemCanvas, heroCanvas, monCanvas, auraOf, footRow,
    text, textWidth, flame, hash, hashStr, mix, rgb, clamp, lerp, seg, ease, easeIn, bay, WOOD, IRON, BONE, GOLD, sound: Snd, reduced,
    build: null,
  };
})(typeof window !== "undefined" ? window : globalThis);
