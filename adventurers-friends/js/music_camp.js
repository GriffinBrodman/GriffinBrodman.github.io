/* A camp music night (concept C, the fire circle): the camp ground seen from 66 degrees (the dice tables' camera), the crew's own upright
   sprites billboarded round the fire and sorted by depth, lit by the fire with long thrown shadows and a hot rim on the backlit side.
   Each player's ring of light switches on in the order they joined, notes spiral up the smoke in ring colours, and the lyrics rise
   with the smoke. A good night links the rings into one gold oval; a rough one greys the smoke, flattens the notes, lets a ring
   flicker out and sends a crow off. Registers itself as MusicReplay's "camp" scene. */
(function () {
  "use strict";
  if (!window.MusicReplay) return;
  const W = 192, H = 144;
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
  const bay = (x, y) => BAY[(y & 3) * 4 + (x & 3)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const sc = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const toHex = (c) => "#" + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  const smooth = (t) => t * t * (3 - 2 * t);
  const frac = (v) => ((v % 1) + 1) % 1;
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function vnoise(seed) {
    const r = rng(seed), p = new Float32Array(64 * 64);
    for (let i = 0; i < p.length; i++) p[i] = r();
    const at = (x, y) => p[((y & 63) << 6) | (x & 63)];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
      return lerp(lerp(at(xi, yi), at(xi + 1, yi), xf), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), xf), yf);
    };
  }
  const hash = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

  // ---------- the dice tables' camera (tables_replay.js), aimed at the fire ----------
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  class Cam {
    constructor(o) {
      const a = o.pitch * Math.PI / 180, tg = o.target;
      this.f = [0, Math.cos(a), -Math.sin(a)]; this.u = [0, Math.sin(a), Math.cos(a)];
      this.pos = [tg[0] - this.f[0] * o.dist, tg[1] - this.f[1] * o.dist, tg[2] - this.f[2] * o.dist];
      this.focal = o.focal; this.cx = W / 2; this.cy = o.cy;
    }
    p(x, y, z) { const r = [x - this.pos[0], y - this.pos[1], z - this.pos[2]], d = dot(r, this.f); return [this.cx + r[0] * this.focal / d, this.cy - dot(r, this.u) * this.focal / d, d]; }
    unproject(sx, sy) {
      const dx = (sx - this.cx) / this.focal, dy = (sy - this.cy) / this.focal;
      const D = [this.f[0] + dx - this.u[0] * dy, this.f[1] - this.u[1] * dy, this.f[2] - this.u[2] * dy], s = -this.pos[2] / D[2];
      return [this.pos[0] + D[0] * s, this.pos[1] + D[1] * s];
    }
  }
  const CAM = new Cam({ pitch: 66, dist: 420, focal: 420, target: [0, 0, 0], cy: 96 });
  const [FX, FY] = CAM.p(0, 0, 0);
  let WX = null, WY = null;
  function world() {
    if (WX) return;
    WX = new Float32Array(W * H); WY = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = CAM.unproject(x + 0.5, y + 0.5); WX[y * W + x] = q[0]; WY[y * W + x] = q[1]; }
  }

  // ---------- float RGB raster with an emissive mask the lamp pass leaves alone ----------
  class Buf {
    constructor() { this.c = new Float32Array(W * H * 3); this.e = new Uint8Array(W * H); }
    clone() { const b = new Buf(); b.c.set(this.c); b.e.set(this.e); return b; }
    px(x, y, col, emit) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; this.c[i * 3] = col[0]; this.c[i * 3 + 1] = col[1]; this.c[i * 3 + 2] = col[2]; this.e[i] = emit ? 1 : 0; }
    mul(x, y, f) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; if (typeof f === "number") f = [f, f, f]; this.c[i] *= f[0]; this.c[i + 1] *= f[1]; this.c[i + 2] *= f[2]; }
    add(x, y, col, a) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; this.c[i] += col[0] * a; this.c[i + 1] += col[1] * a; this.c[i + 2] += col[2] * a; }
    blend(x, y, col, a) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; this.c[i] = lerp(this.c[i], col[0], a); this.c[i + 1] = lerp(this.c[i + 1], col[1], a); this.c[i + 2] = lerp(this.c[i + 2], col[2], a); }
    ell(cx, cy, rx, ry, fn) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) fn(nx, ny, x, y);
      }
    }
    paint(img) { const d = img.data; for (let i = 0; i < W * H; i++) { d[i * 4] = clamp(this.c[i * 3], 0, 255); d[i * 4 + 1] = clamp(this.c[i * 3 + 1], 0, 255); d[i * 4 + 2] = clamp(this.c[i * 3 + 2], 0, 255); d[i * 4 + 3] = 255; } }
  }

  // ---------- the ground: trodden earth round the pit, grass beyond (snow, sand or ash by biome), tufts; stones round the fire ----------
  const RX = 66, RY = 42;
  const ell = (wx, wy) => Math.hypot(wx / RX, wy / RY);
  const GRASS = { plains: [[56, 80, 42], [64, 88, 46], [80, 106, 54], [40, 60, 34], [98, 128, 62]], forest: [[40, 64, 36], [48, 72, 40], [64, 90, 48], [30, 48, 28], [80, 112, 56]],
    hills: [[70, 80, 50], [80, 88, 56], [96, 104, 64], [52, 60, 40], [110, 120, 72]], marsh: [[50, 70, 46], [58, 76, 52], [72, 92, 60], [36, 52, 40], [86, 110, 66]],
    coast: [[150, 136, 100], [160, 146, 108], [176, 162, 120], [124, 112, 84], [120, 136, 80]], snow: [[176, 186, 204], [188, 196, 214], [206, 214, 230], [146, 156, 180], [140, 160, 150]],
    volcanic: [[66, 54, 50], [74, 60, 54], [90, 74, 62], [48, 38, 36], [96, 84, 60]] };
  const grounds = {};
  function ground(biome) {
    const key = GRASS[biome] ? biome : "plains";
    if (grounds[key]) return grounds[key];
    world();
    const G = GRASS[key], N1 = vnoise(11), N2 = vnoise(12), N3 = vnoise(13), b = new Buf();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, wx = WX[i], wy = WY[i], r = Math.hypot(wx, wy);
      const m = N1(wx * 0.05 + 40, wy * 0.05), d = N2(wx * 0.22, wy * 0.22), f = N3(wx * 0.8, wy * 0.8), th = bay(x, y);
      const e = ell(wx, wy), edge = 1.42 + (m - 0.5) * 0.5;
      let col;
      if (r < 13) col = mixc([46, 40, 38], [78, 70, 64], f);
      else if (e < edge - (th - 0.5) * 0.14) {
        col = [96, 74, 52];
        if (Math.abs(e - 1) < 0.15 + (d - 0.5) * 0.12) col = [84, 64, 46];
        if (r < 20) col = mixc([70, 60, 52], col, (r - 13) / 7);
        if (f > 0.82) col = [116, 92, 64];
        if (f < 0.16) col = [72, 54, 40];
        if (hash(x, y, 3) > 0.985) col = [134, 126, 112];
      } else {
        col = m > 0.5 ? G[0] : G[1];
        if (f > 0.68) col = G[2];
        if (f < 0.24) col = G[3];
        if (key !== "snow" && key !== "volcanic" && hash(x, y, 4) > 0.996) col = [214, 200, 120];
      }
      b.px(x, y, sc(col, 0.84 + d * 0.32));
    }
    for (let k = 0; k < 340; k++) {
      const x = Math.floor(hash(k, 1, 7) * W), y = Math.floor(hash(k, 2, 7) * H), i = y * W + x;
      if (ell(WX[i], WY[i]) < 1.34 + (N1(WX[i] * 0.05 + 40, WY[i] * 0.05) - 0.5) * 0.5) continue;
      const hi = hash(k, 3, 7) > 0.5 ? G[4] : sc(G[4], 0.88);
      b.px(x, y + 1, sc(G[3], 0.7)); b.px(x, y, hi); b.px(x, y - 1, sc(hi, 1.12)); if (hash(k, 4, 7) > 0.4) { b.px(x + 1, y, sc(hi, 0.9)); b.px(x - 1, y - 1, sc(hi, 0.95)); }
    }
    for (let k = 0; k < 11; k++) {
      const a = k / 11 * Math.PI * 2 + 0.2, [x, y] = CAM.p(Math.cos(a) * 12.5, Math.sin(a) * 12.5, 0);
      const rx = 2.6 + hash(k, 1, 9) * 1.2, ry = 2 + hash(k, 2, 9) * 0.8, base = hash(k, 3, 9) > 0.5 ? [124, 118, 112] : [108, 106, 112], tx = -Math.cos(a), ty = Math.sin(a);
      b.ell(x, y - 0.5, rx + 0.8, ry + 0.8, (nx, ny, px, py) => b.px(px, py, [30, 24, 26]));
      b.ell(x, y - 0.5, rx, ry, (nx, ny, px, py) => { const lit = nx * tx + ny * ty * 0.8 - ny * 0.6; b.px(px, py, sc(base, lit > 0.45 ? 1.35 : lit > -0.1 ? 1.0 : 0.66)); });
    }
    log(b, -78, -34, 0.45, 9, ROLL, 3.2);
    for (const [ox, oy, a] of [[0, 0, -0.15], [1.5, 4.5, -0.1], [0.8, 2.2, -0.12]]) log(b, 82 + ox, 4 + oy, a, 5.5, null, 2.2);
    return (grounds[key] = b);
  }
  const N4 = vnoise(14);
  const BARK = { lit: [122, 84, 50], mid: [92, 60, 34], dark: [62, 40, 24], end: [176, 140, 96], core: [150, 118, 78], ol: [34, 20, 12] };
  const ROLL = { lit: [150, 92, 70], mid: [120, 64, 50], dark: [84, 42, 34], end: [176, 120, 92], core: [120, 70, 56], ol: [32, 18, 14], strap: [0.3, 0.7] };
  function log(b, wx, wy, ang, len, pal, w) {
    const P = pal || BARK;
    const tx = Math.cos(ang), ty = Math.sin(ang), A = CAM.p(wx - tx * len, wy - ty * len, 2), B = CAM.p(wx + tx * len, wy + ty * len, 2);
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux, RW = w || 2.6;
    const x0 = Math.floor(Math.min(A[0], B[0]) - 4), x1 = Math.ceil(Math.max(A[0], B[0]) + 4), y0 = Math.floor(Math.min(A[1], B[1]) - 4), y1 = Math.ceil(Math.max(A[1], B[1]) + 4);
    const toFire = Math.sign(nx * (FX - (A[0] + B[0]) / 2) + ny * (FY - (A[1] + B[1]) / 2)) || 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - A[0], py = y + 0.5 - A[1], s = px * ux + py * uy, q = px * nx + py * ny;
      if (s < -0.5 || s > L + 0.5 || Math.abs(q) > RW + 0.6) continue;
      if (Math.abs(q) > RW - 0.4) { b.px(x, y, P.ol); continue; }
      const side = q * toFire / RW, grain = N4(s * 0.6, q * 2.2);
      let col = side > 0.35 ? P.lit : side > -0.4 ? P.mid : P.dark;
      if (P.strap && P.strap.some((v) => Math.abs(s - L * v) < 0.8)) col = side > 0 ? [96, 66, 36] : [70, 46, 26];
      else if (grain > 0.68) col = sc(col, P.strap ? 0.92 : 0.78);
      if ((s < 1.6 || s > L - 1.6)) col = Math.abs(q) < 1 ? P.core : P.end;
      b.px(x, y, col);
    }
  }

  // ---------- the lamp pass, in world space so every pool lies flat on the ground ----------
  function light(b, L) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (b.e[i]) continue;
      const th = bay(x, y), wx = WX[i], wy = WY[i];
      let r = L.amb[0], g = L.amb[1], bl = L.amb[2];
      for (const p of L.pools) {
        const d = p.ring ? Math.abs(ell(wx, wy) - 1) * (RX + RY) / 2 / p.r : Math.hypot(wx - p.x, wy - p.y) / p.r;
        if (d >= 1) continue;
        const k = Math.floor(Math.pow(1 - d, p.p || 1.4) * p.i * 8 + th) / 8;
        r += k * p.c[0]; g += k * p.c[1]; bl += k * p.c[2];
      }
      b.c[i * 3] *= r; b.c[i * 3 + 1] *= g; b.c[i * 3 + 2] *= bl;
    }
  }
  function glow(b, x, y, rx, ry, col, a) {
    b.ell(x, y, rx, ry, (nx, ny, px, py) => { const k = Math.floor((1 - Math.sqrt(nx * nx + ny * ny)) * a * 6 + bay(px, py)) / 6; if (k > 0) b.add(px, py, col, k); });
  }
  function shade(b, x, y, rx, ry, f) {
    b.ell(x, y, rx, ry, (nx, ny, px, py) => { const d = Math.sqrt(nx * nx + ny * ny); if ((1 - d) * 2.2 > bay(px, py)) b.mul(px, py, f); });
  }

  // ---------- sprites: the real hero art (weapons put away), lit by where the fire is ----------
  const grabs = new WeakMap();
  function grab(cv) { let g = grabs.get(cv); if (!g) { g = { w: cv.width, h: cv.height, d: cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data }; grabs.set(cv, g); } return g; }
  function bbox(cv) {
    const s = grab(cv);
    if (s.bb) return s.bb;
    let x0 = s.w, x1 = -1, y0 = s.h, y1 = -1;
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.d[(y * s.w + x) * 4 + 3] > 127) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return (s.bb = { x0, x1, y0, y1 });
  }
  // fire in front (a far seat) lifts the whole body warm; fire behind (a near seat) leaves a cool silhouette with a hot rim
  function litSprite(cv, o) {
    const s = grab(cv), w = s.w, h = s.h, d = s.d, out = [];
    const isOl = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return true; const k = (y * w + x) * 4; return d[k + 3] < 128 || (d[k] + d[k + 1] + d[k + 2] < 80); };
    let [dx, dy] = o.dir;
    if (o.behind) dx *= 0.75; else dy *= 0.3;
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const k = o.k, AMB = [0.46, 0.5, 0.72];
    const body = o.behind ? mixc(AMB, [0.78, 0.64, 0.58], k * 0.6) : mixc(AMB, [1.22, 0.98, 0.76], k);
    const rimA = o.behind ? 0.45 + k * 0.5 : 0.2 + k * 0.4, RIM = [255, 206, 128], MOON = [126, 146, 210];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const kk = (y * w + x) * 4;
      if (d[kk + 3] < 128) continue;
      const src = [d[kk], d[kk + 1], d[kk + 2]];
      if (src[0] + src[1] + src[2] < 80) { out.push([x, y, src]); continue; }
      let col = [src[0] * body[0], src[1] * body[1], src[2] * body[2]];
      if (o.tint) { const t = clamp((y - h * 0.62) / (h * 0.38), 0, 1) * 0.22; col = mixc(col, o.tint, t); }
      if (isOl(Math.round(x + dx), Math.round(y + dy))) col = mixc(col, RIM, rimA);
      else if (o.behind && isOl(Math.round(x + dx * 2), Math.round(y + dy * 2))) col = mixc(col, RIM, rimA * 0.45);
      else if (isOl(Math.round(x - dx), Math.round(y - dy)) && !o.pet) col = mixc(col, MOON, 0.22);
      out.push([x, y, col]);
    }
    return { w, h, px: out };
  }
  const litCache = new Map();
  function litCached(key, cv, o) {
    const k = key + "|" + Math.round(o.k * 20) + "|" + (o.tint ? o.tint.join() : "") + "|" + Math.round(o.dir[0] * 4) + Math.round(o.dir[1] * 4);
    let v = litCache.get(k);
    if (!v) { v = litSprite(cv, o); if (litCache.size > 600) litCache.clear(); litCache.set(k, v); }
    return v;
  }
  function blit(b, sp, x, y, alpha) { for (const [i, j, c] of sp.px) { if (alpha == null) b.px(x + i, y + j, c); else b.blend(x + i, y + j, c, alpha); } }
  function spriteOf(cv) { const s = grab(cv), out = []; for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const k = (y * s.w + x) * 4; if (s.d[k + 3] > 127) out.push([x, y, [s.d[k], s.d[k + 1], s.d[k + 2]]]); } return { w: s.w, h: s.h, px: out }; }
  const bare = (h) => {
    const kit = h.kit ? JSON.parse(JSON.stringify(h.kit)) : null;
    if (kit) { kit.weapon = null; kit.offhand = null; if (kit.back && kit.back.art === "quiver") kit.back = null; }
    return Object.assign({}, h, { alive: true, weapon: "none", weapon_tier: 1 }, kit ? { kit } : {});
  };
  const heroOf = (id, name) => (App.heroes && App.heroes[id]) || { id, name: name || "A hero", look: { skin: "#e0b088", hair: "#5a3a20", style: 1, face: 1, fav: "#8a6a3a", scars: [] }, cls: "warrior", weapon: "none", weapon_tier: 1, armor_tier: 1 };
  const sprites = new Map();
  function heroCanvas(h, pose, left) {
    const key = h.id + pose + left;
    if (!sprites.has(key)) {
      const look = App.heroLook(h), g = pose === "stand" ? Art.heroGrid(bare(h), 0, look) : Art.heroSeated(bare(h), 0, look);
      sprites.set(key, (left ? g.flipX() : g).toCanvas(1));
    }
    return sprites.get(key);
  }
  function petCanvas(pet, frame, left) {
    const key = "pet" + pet.kind + pet.name + frame + left;
    if (!sprites.has(key)) { const g = Art.petGrid(pet, frame); sprites.set(key, (left ? g.flipX() : g).toCanvas(1)); }
    return sprites.get(key);
  }

  // ---------- floating instruments (no hands: each one plays itself), the crow, notes ----------
  const spr = (rows, pal) => Anim.sprite(rows, pal, "#160d07");
  const ART = {};
  const art = (name) => ART[name] || (ART[name] = spriteOf(MAKE[name]()));
  const MAKE = {
    drum: () => spr(["..xxxxx..", ".xsssssx.", "xsssSsssx", "xssssssBx", "xrrrrrrrx", ".xrRrRrx.", "..xxxxx.."], { s: "#e8d4a4", S: "#fff0c8", B: "#c8b080", r: "#8a4a22", R: "#c88a3a", x: "#160d07" }),
    whistle: () => spr(["xxxxxxxx", "xmmhmhmx", "xxxxxxxx"], { m: "#b8bcc4", h: "#2a2a30", x: "#160d07" }),
    lute: () => spr(["..........xx", ".........xpx", "........xpx.", ".......xnx..", "......xnx...", ".....xnx....", "..xxxnx.....", ".xbbbnbx....", "xbbsnsbbx...", "xbsoosbBx...", "xbsoosbBx...", "xbbssbBBx...", ".xbbbBBx....", "..xxxxx....."],
      { b: "#d8a060", B: "#a86c34", s: "#f0d098", o: "#3a2010", n: "#7a4a24", p: "#4a2a14", x: "#160d07" }),
    fiddle: () => spr(["..xxx..", "..xpx..", "..xnx..", "..xnx..", ".xxnxx.", "xbbnbBx", "xbfnfBx", ".xbnBx.", "xbbnbBx", "xbfnfBx", "xsbnbBx", ".xbbBx.", "..xxx.."],
      { b: "#c8642c", B: "#8a3a18", s: "#f0a060", f: "#2a100a", n: "#2a1810", p: "#e8d8b0", x: "#160d07" }),
    horn: () => spr(["......bb", ".....bBb", "....bBb.", "ccbbBb..", "cBBbb...", "cc......"], { b: "#d8b04a", B: "#a87a22", c: "#f0d890" }),
    bagpipes: () => spr([".d..d...", ".d..d...", ".d..d.c.", "ttttttc.", "tTtTttt.", "tttttt..", ".tttt...", "..c....."], { d: "#3a2a1a", t: "#3a7a4a", T: "#c8463a", c: "#2a1a10" }),
    pot: () => spr([".xxxxxxx.", "xkkkkkkkx", "xgggggggx", ".xgggggx.", "..xxxxx.."], { k: "#8a8a96", g: "#3a3a44", x: "#160d07" }),
    spoon: () => spr(["oo...", "oos..", "..s..", "...s.", "....s"], { o: "#d8d0c0", s: "#a8a090" }),
  };
  function line(b, x0, y0, x1, y1, c, emit) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; b.px(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), c, emit); } }
  function spark(b, x, y, c, s) { b.px(x, y, [255, 252, 232], true); for (let d = 1; d <= s; d++) for (const [ox, oy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) b.px(x + ox, y + oy, d === s ? sc(c, 0.85) : c, true); }
  // an instrument beside a hero: hx, hy the sprite's top-left, bb its box, side +1 to the hero's right; hit: when it last sounded
  function instrument(b, kind, hx, hy, bb, side, t, hit, warm, calm) {
    const on = !!hit && hit.since < 0.16 && !calm, held = !!hit && hit.since < hit.d, midY = hy + bb.y0 + Math.round((bb.y1 - bb.y0) * 0.45), bob = on ? 1 : 0;
    const ex = side > 0 ? hx + bb.x1 + 2 : hx + bb.x0 - 2;
    const put = (sp, x, y, flip) => { for (const [i, j, c] of sp.px) b.px(x + (flip ? sp.w - 1 - i : i), y + j, c[0] + c[1] + c[2] < 90 ? c : mixc(sc(c, 0.8), [c[0] * 1.1, c[1] * 0.95, c[2] * 0.8], warm)); };
    if (kind === "lute") {
      const s = art("lute"), lx = side > 0 ? ex - 2 : ex - s.w + 2, ly = midY - 6 + bob; put(s, lx, ly, side < 0);
      if (on) { const sx = lx + (side > 0 ? 4 : s.w - 5), sy = ly + 9, ph = Math.floor(t * 8) % 3; b.px(sx - 1 + ph, sy - 1, [255, 244, 200], true); b.px(sx + ph, sy - 2, [255, 230, 160], true);
        for (let k = 0; k < 3; k++) if ((Math.floor(t * 8) + k) % 3 === 0) b.px(sx + side * (6 + k), sy - 2 - k * 2, [255, 236, 170], true); }
    } else if (kind === "fiddle") {
      const s = art("fiddle"), fx = side > 0 ? ex + 1 : ex - s.w - 1, fy = midY - 7 + bob; put(s, fx, fy);
      // the bow saws on its own, a stroke per note, crossing the strings at the waist
      const ph = calm ? 0 : held ? Math.round((clamp(hit.since / Math.max(0.15, hit.d), 0, 1) - 0.5) * 5) : 0;
      const cx = fx + 3 + ph * side, cy = fy + 8, x0 = cx - 2 * side, y0 = cy + 4, x1 = cx + 9 * side, y1 = cy - 5;
      line(b, x0, y0 + 1, x1, y1 + 1, [22, 13, 7]); line(b, x0, y0, x1, y1, [240, 230, 204]); b.px(x0, y0, [90, 50, 24]); b.px(x1, y1, [90, 50, 24]);
      if (on) { b.px(fx + 3, fy + 9, [255, 236, 190], true); b.px(fx + 3 + side * 9, fy + 3, [255, 220, 160], true); }
    } else if (kind === "pot") {
      const s = art("pot"), px = side > 0 ? ex : ex - s.w; put(s, px, midY + 2);
      put(art("spoon"), px + 3, midY - 5 - (on ? 0 : 2));
      if (on) spark(b, px + 4, midY + 1, [255, 236, 150], 1);
    } else if (kind === "drum") {
      const s = art("drum"), px = side > 0 ? ex : ex - s.w; put(s, px, midY - 1 + bob);
      const up = on ? 0 : 2;
      line(b, px + (side > 0 ? 8 : 0), midY - 7 - up, px + 4, midY - 2 - up, [200, 160, 110]);
      if (on) spark(b, px + 4, midY - 1, [255, 232, 170], 1);
    } else if (kind === "whistle") {
      const s = art("whistle"), mouthY = hy + bb.y0 + 12, px = side > 0 ? hx + bb.x1 - 4 : hx + bb.x0 - 4;
      put(s, px, mouthY);
      if (held && !calm) for (let k = 0; k < 3; k++) b.px(px + (side > 0 ? 9 + k : -2 - k), mouthY + 1 - k, [220, 240, 255], true);
    } else if (kind === "horn") {
      const s = art("horn"); put(s, side > 0 ? ex : ex - s.w, midY - 6 - (held && !calm ? 2 : 0), side < 0);
    } else if (kind === "bagpipes") {
      const s = art("bagpipes"); put(s, side > 0 ? ex : ex - s.w, midY - 3 + (on ? 1 : 0), side < 0);
    } else if (kind === "claps") {
      if (!on) return;
      // claps without hands: a pair of sparks that meet in front of the chest on the beat
      const x = hx + Math.round((bb.x0 + bb.x1) / 2) + side * 2, y = midY + 1;
      spark(b, x, y, [190, 214, 255], 2); b.px(x - 3, y - 3, [230, 240, 255], true); b.px(x + 3, y - 3, [230, 240, 255], true);
    }
  }
  // the crow, side-on, two wingbeats: dark body, a cool moonlit edge on top, the beak catching the fire
  const CROW = [["hh..............", ".hxh............", "..hxxh......hh..", "...xxxxh...hxxh.", "....xxxxxhhxxxx.", "...wxxxxxxxxxxb.", "..wxxxxxxxxxxx..", ".wwxxxx.xxx.....", "wwx.....x.x....."],
    ["................", "................", "............hh..", "...........hxxh.", "....hhxxxhhxxxx.", "..hxxxxxxxxxxxb.", ".hxxxxxxxxxxxx..", "hxxwwwx.xxx.....", "xw..ww..x.x....."]];
  function crow(b, x, y, frame) {
    CROW[frame].forEach((r, j) => [...r].forEach((ch, i) => {
      const col = ch === "x" ? [20, 18, 28] : ch === "h" ? [92, 100, 136] : ch === "w" ? [40, 36, 52] : ch === "b" ? [226, 170, 52] : null;
      if (col) b.px(x + i, y + j, col, true);
    }));
  }
  const NOTE = ["...xx", "...xxx", "...x.x", "...x..", ".xxx..", "xxxx..", ".xx..."], NOTE2 = ["..xxxx", "..x..x", "..x..x", ".xx.xx", "xxxxxx", ".x.xx."];
  const SOUR = ["....xx", "...x.x", "...x..", "..x...", ".xxx..", "xxx...", ".x...."];
  const noteArt = {};
  const noteOf = (c, two, sour) => { const key = c + two + sour; return noteArt[key] || (noteArt[key] = spriteOf(spr((sour ? SOUR : two ? NOTE2 : NOTE).map((r) => r.replace(/x/g, "c")), { c }))); };

  // ---------- fire, embers, smoke, notes ----------
  function flames(b, x, y, wall, k) {
    for (const [ox, hh, ph] of [[-7, 0.5, 5.2], [-4.5, 0.85, 0.0], [-2, 1.1, 1.3], [1, 1.25, 2.1], [3.6, 0.95, 3.3], [6.4, 0.62, 4.4]]) {
      const h = Math.round((12 + Math.sin(wall * 9 + ph * 3) * 3 + Math.sin(wall * 23 + ph) * 1.5) * hh * k), sway = Math.sin(wall * 5.5 + ph) * 1.6;
      for (let j = 0; j < h; j++) {
        const u = j / h, wd = Math.max(0, Math.round((1 - u) * 2.3 * k * hh + 0.2)), xx = Math.round(x + ox * k + sway * u * u * 2), yy = Math.round(y - j);
        const col = u < 0.22 ? [255, 246, 196] : u < 0.48 ? [255, 208, 92] : u < 0.76 ? [246, 134, 42] : [198, 68, 30];
        for (let i = -wd; i <= wd; i++) b.px(xx + i, yy, Math.abs(i) === wd && wd > 0 ? (u < 0.48 ? [250, 160, 52] : [186, 62, 28]) : col, true);
      }
    }
  }
  function pit(b, wall) {
    log(b, -1, 0.5, 0.5, 6.5); log(b, 1, -0.5, -0.6, 6.5);
    for (let i = 0; i < 18; i++) { const a = hash(i, 1, 21) * 6.28, r = hash(i, 2, 21) * 7, [x, y] = CAM.p(Math.cos(a) * r, Math.sin(a) * r, 0); b.px(x, y, (Math.floor(wall * 5) + i) % 4 ? [255, 120, 40] : [255, 200, 90], true); }
    glow(b, FX, FY - 4, 26, 20, [255, 150, 60], 0.32);
  }
  function embers(b, t, k, n) {
    for (let i = 0; i < n; i++) {
      const life = 1.6 + (i % 4) * 0.4, ph = ((t + i * 0.377) % life) / life;
      const x = FX + Math.sin(i * 12.9) * 5 + Math.sin(t * 2.6 + i) * 3 * ph + ph * ph * 16, y = FY - 8 - ph * 70 * k;
      if (ph > 0.9 || (Math.floor(t * 9 + i) % 5 === 0)) continue;
      b.px(x, y, ph < 0.3 ? [255, 236, 160] : ph < 0.6 ? [250, 150, 50] : [190, 70, 30], true);
    }
  }
  const smokeAt = (u) => [FX + 2 + Math.sin(u * 5.2 + 0.4) * 3 * u + u * u * 30, FY - 12 - u * (FY - 6)];
  function smoke(b, t, grey) {
    for (let i = 0; i < 30; i++) {
      const u = ((i / 30) + t * 0.05) % 1, [cx, cy] = smokeAt(u), r = 2 + u * 9;
      const col = mixc(grey ? [92, 90, 98] : [178, 172, 196], [255, 170, 100], Math.pow(1 - u, 3) * 0.6), a = (grey ? 0.6 : 0.42) * Math.min(1, u * 8) * (1 - u * 0.8);
      b.ell(cx + Math.sin(i * 3.1) * 2 * u, cy, r, r * 0.8, (nx, ny, px, py) => { const k = a * (1 - (nx * nx + ny * ny)); if (k * 3 > bay(px, py) * 0.9 + 0.12) b.blend(px, py, col, Math.min(0.55, k * 1.6)); });
    }
  }
  function notes(b, t, cols, n, o) {
    if (!cols.length) return;
    for (let k = 0; k < n; k++) {
      const u = ((k / n) + t * 0.06) % 1, rise = o.high ? u : u * 0.82, [cx, cy] = smokeAt(rise), ang = rise * Math.PI * 4.4 + k * 0.4;
      const r = 5 + rise * 13, x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r * 0.42 + (o.sour ? u * u * 26 : 0), back = Math.sin(ang) < 0, c = cols[k % cols.length];
      if (u < 0.04) continue;
      const s = o.sour ? noteOf("#a8a070", 0, 1) : noteOf(toHex(mixc(hex(c), [255, 255, 255], back ? 0.05 : 0.35)), k % 2, 0);
      const a = (1 - Math.max(0, u - 0.75) * 4) * (back ? 0.75 : 1);
      blit(b, s, Math.round(x - 3), Math.round(y - 3), a >= 0.98 ? null : Math.max(0, a));
    }
  }
  function burst(b, t, cols) {
    const [cx, cy] = smokeAt(0.86);
    for (let k = 0; k < 48; k++) {
      const a = k / 48 * Math.PI * 2 + 0.2, rr = 10 + (k % 3) * 4 + ((t * 7) % 3), c = cols[k % cols.length], x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.55;
      if (k % 6 === 0) spark(b, Math.round(x), Math.round(y), mixc(c, [255, 255, 255], 0.4), 1); else b.px(x, y, mixc(c, [255, 255, 255], 0.3), true);
    }
  }
  // canopies close the corners: drawn after the lamp pass so they stay dark, with a faint fire-side edge
  let CANOPY = null;
  function canopies(b) {
    if (!CANOPY) {
      CANOPY = [];
      const n = vnoise(77), ramp = [[10, 16, 20], [14, 24, 26], [20, 34, 32], [30, 46, 38], [52, 54, 40]];
      for (const [cx, cy, r, s] of [[4, 4, 24, 1], [62, -14, 22, 2], [118, -16, 20, 3], [184, 2, 24, 4], [198, 70, 16, 5], [-8, 84, 14, 6], [-6, 140, 22, 7], [196, 142, 24, 8]]) {
        for (let y = Math.floor(cy - r); y < cy + r; y++) for (let x = Math.floor(cx - r); x < cx + r; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const dx = (x - cx) / r, dy = (y - cy) / r, q = n(x * 0.25 + s * 9, y * 0.25), rr = Math.hypot(dx, dy) + (q - 0.5) * 0.5;
          if (rr > 1) { if (rr < 1.18) CANOPY.push([x, y, null]); continue; }
          const fx = FX - x, fy = FY - y, side = (dx * fx + dy * fy) / Math.hypot(fx, fy);
          const v = 0.45 + side * 0.25 - rr * 0.25 + (q - 0.5) * 0.7 + (n(x * 0.9, y * 0.9 + s) - 0.5) * 0.35, idx = clamp(Math.round(v * 4 + (bay(x, y) - 0.5) * 0.9), 0, 4);
          CANOPY.push([x, y, idx === 4 && side < 0.2 ? ramp[3] : ramp[idx]]);
        }
      }
    }
    for (const [x, y, c] of CANOPY) { if (c) b.px(x, y, c); else b.mul(x, y, 0.72); }
  }

  // ---------- ring colours: each player's own colour, nudged apart so a crew never shares one ----------
  const FALLBACK = ["#e8b04a", "#5ac8d8", "#e86a5a", "#a8e070", "#b890f0", "#f090c0", "#f0e070"];
  const cdist = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 1.3, a[2] - b[2]);
  function brighten(c) { let x = c; for (let i = 0; i < 6 && (0.3 * x[0] + 0.59 * x[1] + 0.11 * x[2]) < 120; i++) x = mixc(x, [255, 255, 255], 0.18); return x; }
  function ringColours(favs) {
    const used = [];
    return favs.map((fav) => {
      let c = fav && /^#[0-9a-f]{6}$/i.test(fav) ? brighten(hex(fav)) : null;
      if (!c || used.some((u) => cdist(u, c) < 90)) c = FALLBACK.map(hex).sort((a, b) => Math.min(...used.map((u) => cdist(u, b)), 999) - Math.min(...used.map((u) => cdist(u, a)), 999))[0];
      used.push(c);
      return c;
    });
  }
  function ring(b, s, st, t) {
    const R = s.pet ? 7 : 10, n = 90;
    const pts = [];
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, [x, y] = CAM.p(s.wx + Math.cos(a) * R, s.wy + Math.sin(a) * R, 0); pts.push([Math.round(x), Math.round(y), k]); }
    if (!s.on) { for (const [x, y, k] of pts) if (k % 6 < 3) b.blend(x, y, [176, 166, 146], 0.6); return; }
    const hi = mixc(s.col, [255, 255, 255], 0.35), lo = sc(s.col, 0.45);
    for (const [x, y, k] of pts) {
      if (s.flicker && (hash(k, Math.floor(t * 7), 3) > 1 - s.flicker * 0.6 || k % 5 === 0)) { if (k % 3 === 0) b.blend(x, y + 1, sc(s.col, 0.6), 0.5); continue; }
      b.blend(x, y + 1, lo, 0.7);
      b.px(x, y, !st.calm && (k + Math.floor(t * 20)) % 30 < 2 ? [255, 255, 240] : hi, true);
    }
    if (s.fresh > 0) {
      // switching on: a second ring kicks out and fades, with a spark at each quarter
      const R2 = R + 4 * (1 - s.fresh) + 2;
      for (let k = 0; k < n; k += 2) { const a = k / n * Math.PI * 2, [x, y] = CAM.p(s.wx + Math.cos(a) * R2, s.wy + Math.sin(a) * R2, 0); b.blend(x, y, hi, 0.55 * s.fresh); }
      for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2 + 0.4, [x, y] = CAM.p(s.wx + Math.cos(a) * R2, s.wy + Math.sin(a) * R2, 0); spark(b, Math.round(x), Math.round(y), hi, 1); }
    }
  }

  // ---------- the scene for a record ----------
  // seats round the fire: the lead stands on the far side, the joiners sit in join order round the circle, a pet near its owner
  const ANG = [126, 176, 52, 232, 300, 84, 266];
  function campScene(rec, P, words) {
    world();
    const joinT = {};
    for (const c of P.cues) if (c.kind === "join") joinT[c.who] = c.t;
    const startT = P.lines.length ? P.lines[0].t0 : 0, endT = (P.cues.find((c) => c.kind === "end") || { t: P.len }).t;
    const chorusT = (P.cues.find((c) => c.kind === "chorus") || { t: endT }).t;
    const good = rec.outcome === "soaring" || rec.outcome === "sweet", rough = rec.outcome === "mess" || rec.outcome === "sore";
    const instOf = (inst, how) => (inst === "flute" ? "whistle" : inst || (how === "clap" ? "claps" : how === "pot" ? "pot" : null));
    const cast = [{ id: rec.lead.id, name: rec.lead.name, pose: "stand", inst: instOf(rec.lead.inst), how: "lead" }]
      .concat((rec.joiners || []).slice(0, 5).map((j) => ({ id: j.id, name: j.name, pose: "seat", inst: instOf(j.how === "inst" ? j.inst : null, j.how), how: j.how })));
    const pet = (rec.pets || []).find((p) => App.heroes && App.heroes[p.owner] && App.heroes[p.owner].pet && /howl|bask/.test(p.does || ""));
    cast.forEach((m, i) => { m.ang = ANG[i]; m.h = heroOf(m.id, m.name); m.fav = (m.h.look || {}).fav; });
    if (pet) cast.push({ id: "pet:" + pet.owner, pet: App.heroes[pet.owner].pet, owner: pet.owner, ang: 322, r: 0.86, how: "pet", fav: null });
    const cols = ringColours(cast.map((m) => m.fav));
    const seats = cast.map((m, i) => {
      const a = m.ang * Math.PI / 180, wx = Math.cos(a) * RX * (m.r || 1), wy = Math.sin(a) * RY * (m.r || 1), [sx, sy] = CAM.p(wx, wy, 0);
      return Object.assign(m, { i, wx, wy, sx, sy, a, col: cols[i] });
    });
    const stage = ground(rec.biome).clone();
    for (const s of seats) if (!s.pet && s.pose !== "stand") log(stage, s.wx * 1.04, s.wy * 1.04, s.a + Math.PI / 2, 8);
    const hit = MusicReplay.strikes(P);
    // the rough night: the last to join goes quiet in the final chorus, and a crow gives up on it
    const quietId = rough && cast.length > 1 ? cast[cast.length - (cast[cast.length - 1].pet ? 2 : 1)].id : null;
    const lastCh = P.lines.filter((l) => l.chorus).slice(-1)[0], quietT = lastCh ? (lastCh.t0 + lastCh.t1) / 2 : endT;
    const crowT = rough ? chorusT + 0.5 : Infinity;
    const lit = (s, t) => (s.how === "lead" ? t >= startT - 0.6 : s.pet ? t >= chorusT : joinT[s.id] != null && t >= joinT[s.id]);
    const cv = canvas(W, H), ctx = cv.getContext("2d"), img = ctx.createImageData(W, H);
    const anchors = {};
    const head = (s) => {
      const c = s.pet ? petCanvas(s.pet, 0, s.sx > FX + 4) : heroCanvas(s.h, s.pose, s.sx > FX + 4), bb = bbox(c);
      return [s.sx, s.sy - (bb.y1 - bb.y0) - 3];
    };
    for (const s of seats) anchors[s.id] = head(s);
    function draw(t, o) {
      const calm = !!(o && o.calm), tv = calm ? 0.6 : t;
      const linked = good && t >= endT, big = linked;
      const roughNow = rough && t >= chorusT;
      const b = stage.clone();
      pit(b, tv);
      for (const s of seats) {
        s.on = lit(s, t);
        s.fresh = !calm && s.on && joinT[s.id] != null ? clamp(1 - (t - joinT[s.id]) / 0.7, 0, 1) : 0;
        s.flicker = s.id === quietId && t >= quietT ? clamp((t - quietT) / 2, 0.3, 1) : 0;
      }
      const fl = calm ? 1 : 1 + Math.sin(t * 11) * 0.04 + Math.sin(t * 4.7) * 0.05;
      const fk = roughNow ? 0.78 : big ? 1.12 : 1;
      const pools = [{ x: 0, y: 0, r: 92 * fl * fk, i: 1.3 * (roughNow ? 0.85 : 1), c: [1.1, 0.74, 0.42], p: 1.25 }];
      for (const s of seats) if (s.on) pools.push({ x: s.wx, y: s.wy, r: 13, i: s.flicker ? 0.6 * (1 - s.flicker) : 0.6 + 0.3 * s.fresh, c: s.col.map((v) => v / 255), p: 1.1 });
      if (linked) pools.push({ x: 0, y: 0, ring: 1, r: 9, i: 0.55, c: [1, 0.86, 0.5], p: 1.2 });
      light(b, { amb: roughNow ? [0.2, 0.22, 0.34] : [0.22, 0.26, 0.42], pools });
      canopies(b);
      const st = { calm };
      for (const s of seats) ring(b, s, st, tv);
      if (linked) {
        const grow = calm ? 1 : clamp((t - endT) / 1.2, 0, 1);
        for (let k = 0; k < 260 * grow; k++) { const a = k / 260 * Math.PI * 2 + Math.PI / 2, [x, y] = CAM.p(Math.cos(a) * RX, Math.sin(a) * RY, 0); b.px(x, y + 1, [110, 80, 30]); b.px(x, y, !calm && (k + Math.floor(t * 40)) % 26 < 3 ? [255, 255, 230] : [255, 226, 140], true); }
      }
      for (const s of seats) {
        const dx = s.sx - FX, dy = s.sy - FY, l = Math.hypot(dx, dy) || 1, w = s.pet ? 5 : 7;
        for (let k = 1; k <= 7; k++) shade(b, s.sx + dx / l * k * 1.6, s.sy + dy / l * k * 1.1, w - k * 0.4, 2.2, 0.82);
        shade(b, s.sx, s.sy, w, 2.4, 0.55);
      }
      const items = seats.map((s) => ({ y: s.sy, s }));
      items.push({ y: FY + 1, fire: true });
      items.sort((a, c) => a.y - c.y);
      for (const it of items) {
        if (it.fire) { flames(b, FX, FY - 1, tv, roughNow ? 0.78 : big ? 1.3 : 1.05); continue; }
        const s = it.s, left = s.sx > FX + 4, playing = s.on && t < endT + 0.6;
        const frame = s.pet && playing && !calm && Math.floor(t * 4) % 2 ? 1 : 0;
        const c = s.pet ? petCanvas(s.pet, frame, left) : heroCanvas(s.h, s.pose, left);
        const bb = bbox(c), dx = FX - s.sx, dy = FY - 6 - (s.sy - (bb.y1 - bb.y0) / 2), l = Math.hypot(dx, dy) || 1;
        const k = clamp(1 - (Math.hypot(s.wx, s.wy) - 18) / (roughNow ? 70 : 84), 0.15, 1) * fl;
        const tint = s.on && !s.flicker ? s.col : null;
        const sp = litCached(s.id + s.pose + left + frame, c, { dir: [dx / l, dy / l], behind: s.sy > FY && !s.pet, k: s.pet ? Math.max(k, 0.6) : k, pet: !!s.pet, tint });
        const bob = playing && !roughNow && !s.pet && !calm ? Math.round((Math.sin(t * Math.PI * 2 / (P.unit * 4) + s.i * 1.7) + 1) / 2) : 0;
        const x = Math.round(s.sx - (bb.x0 + bb.x1 + 1) / 2), y = Math.round(s.sy - bb.y1 - (s.pet ? 0 : 1)) - bob;
        blit(b, sp, x, y);
        s.box = { x, y, bb };
        if (s.inst && (s.on || s.how !== "claps")) instrument(b, s.inst, x, y, bb, s.sx <= FX ? 1 : -1, tv, playing && !s.flicker ? hit(s.id, t) : null, k, calm);
      }
      if (!calm) embers(b, t, roughNow ? 0.7 : big ? 1.4 : 1, roughNow ? 8 : big ? 26 : 16);
      smoke(b, tv, roughNow);
      const players = seats.filter((s) => s.on && !s.pet && !s.flicker && t < endT + 2).map((s) => toHex(s.col));
      if (!calm || t > startT) notes(b, tv, players, 3 + players.length * 3, { high: linked, sour: roughNow });
      if (linked && !calm && t - endT < 2.5) burst(b, t, seats.filter((s) => s.on).map((s) => s.col));
      if (t >= crowT) {
        // the crow sits on the canopy's edge, then gives up and flaps off over the trees
        const go = Math.max(crowT + 2, endT - 1.5), k = calm ? 0 : clamp((t - go) / 2.4, 0, 1), cx = 160 + k * 50, cy = 50 - k * 52;
        if (cx < W + 2) crow(b, Math.round(cx), Math.round(cy), k > 0 && Math.floor(t * 6) % 2 ? 1 : 0);
      }
      for (const s of seats) if (s.pet && s.on && s.how === "pet" && t > (lastCh ? lastCh.t0 : endT) && t < endT && !calm && s.box) {
        const x = s.box.x + (s.sx > FX ? s.box.bb.x0 - 1 : s.box.bb.x1 + 1), y = s.box.y + s.box.bb.y0 + 1, dir = s.sx > FX ? -1 : 1;
        for (let q = 0; q < 3; q++) for (let j = -1 - q; j <= 1 + q; j++) b.px(x + dir * (2 + q * 2 + (Math.abs(j) > q ? -1 : 0)), y - 2 - q + j, mixc(s.col, [255, 255, 255], 0.4), true);
      }
      b.paint(img);
      ctx.putImageData(img, 0, 0);
    }
    // lyrics climb the smoke: the line being sung sits low on the column, older lines drift up it
    const LINE_Y = [33, 22, 12];
    const lyricAt = (n) => { const y = LINE_Y[Math.min(2, n)], u = (FY - 12 - y) / (FY - 6), [x] = smokeAt(u); return [Math.round(x + 10), y]; };
    return { cv, W, H, anchors, crowd: null, along: "crew", draw, lyricAt, sour: rough };
  }

  MusicReplay.register("camp", campScene);
  window.MusicCamp = { scene: campScene, W, H, ringColours };
})();
