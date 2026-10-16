/* Food art for the meal replays: a lit height-field painter, the pixel font, ingredients for the haul, cookware, and every dish's close-up, all as plain pixel buffers. */
/*
  FoodArt.kit      the painter: Img (RGBA buffer), hex/rgb colours, ramps picked with ordered dither, value noise, hrender (a height field lit
                   per pixel), glow, light, vignette, bokeh, steam, stars, outlines, text in the baked Pixelify font.
  FoodArt.part(id, seed)          a raw ingredient for the haul (goods ids from league/content/goods.py PARTS, plus the sides), as an Img.
  FoodArt.dish(rec)               the dish's art spec: { plate, pal, method, look, ... } resolved from the record (dish id, plate, pal, family).
  FoodArt.plate(spec, stage, o)   a full-frame close-up at one stage of the cook: "raw" | "cook" | "baste" | "done" (the reveal) | "zoom",
                                  o.burnt for the disaster, o.t for the few things that animate in the plate itself.
  Everything is deterministic per seed; nothing touches the DOM.
*/
(function (root) {
  "use strict";
  const W = 240, H = 150;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const TAU = Math.PI * 2;

  // ---------- colours ----------
  const HEX = new Map();
  function C(h) {
    if (typeof h !== "string") return h;
    let c = HEX.get(h);
    if (!c) { c = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; HEX.set(h, c); }
    return c;
  }
  const mix = (a, b, t) => { a = C(a); b = C(b); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
  const R = (h) => h.map(C);
  function pick(ramp, t, x, y, d) {
    const n = ramp.length - 1, v = t * n + (bay(x, y) - 0.5) * (d === undefined ? 0.6 : d);
    return ramp[clamp(Math.round(v), 0, n)];
  }

  // ---------- noise ----------
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function hash(str) {
    let h = 2166136261;
    str = String(str);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function h2(ix, iy, seed) {
    let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1274126177);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) & 0xffff) / 65535;
  }
  function vnoise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = h2(ix, iy, seed), b = h2(ix + 1, iy, seed), c = h2(ix, iy + 1, seed), d = h2(ix + 1, iy + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  function fbm(x, y, seed, oct) {
    oct = oct || 3;
    let t = 0, amp = 1, tot = 0, f = 1;
    for (let o = 0; o < oct; o++) { t += vnoise(x * f, y * f, seed + o * 17) * amp; tot += amp; amp *= 0.5; f *= 2; }
    return t / tot;
  }

  // ---------- the buffer ----------
  class Img {
    constructor(w, h, bg) {
      this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4);
      if (bg) this.clear(bg);
    }
    clear(bg) { const c = C(bg); for (let i = 0; i < this.w * this.h; i++) { const o = i * 4; this.d[o] = c[0]; this.d[o + 1] = c[1]; this.d[o + 2] = c[2]; this.d[o + 3] = 255; } return this; }
    px(x, y, c, a) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
      c = C(c);
      const o = (y * this.w + x) * 4, d = this.d;
      if (a === undefined || a >= 1) { d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; return; }
      if (a <= 0) return;
      const da = d[o + 3] / 255, na = a + da * (1 - a);
      if (na <= 0) return;
      for (let k = 0; k < 3; k++) d[o + k] = (c[k] * a + d[o + k] * da * (1 - a)) / na;
      d[o + 3] = na * 255;
    }
    add(x, y, c, a) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      c = C(c);
      const o = (y * this.w + x) * 4, d = this.d;
      if (!d[o + 3]) return;
      d[o] += c[0] * a; d[o + 1] += c[1] * a; d[o + 2] += c[2] * a;
    }
    get(x, y) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null; const o = (y * this.w + x) * 4; return this.d[o + 3] ? [this.d[o], this.d[o + 1], this.d[o + 2], this.d[o + 3]] : null; }
    alpha(x, y) { x = Math.floor(x); y = Math.floor(y); return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
    rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a); }
    fill(fn, x0, y0, x1, y1) {
      x0 = Math.max(0, Math.floor(x0 || 0)); y0 = Math.max(0, Math.floor(y0 || 0)); x1 = Math.min(this.w, Math.ceil(x1 === undefined ? this.w : x1)); y1 = Math.min(this.h, Math.ceil(y1 === undefined ? this.h : y1));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const c = fn(x, y); if (c) this.px(x, y, c); }
    }
    line(x0, y0, x1, y1, c, a) {
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let i = 0; i <= n; i++) this.px(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n)), c, a);
    }
    paste(src, dx, dy, a, fn) {
      dx = Math.round(dx || 0); dy = Math.round(dy || 0);
      const al = a === undefined ? 1 : a;
      for (let y = 0; y < src.h; y++) {
        const ty = y + dy;
        if (ty < 0 || ty >= this.h) continue;
        for (let x = 0; x < src.w; x++) {
          const tx = x + dx;
          if (tx < 0 || tx >= this.w) continue;
          const o = (y * src.w + x) * 4, sa = src.d[o + 3];
          if (!sa) continue;
          let c = [src.d[o], src.d[o + 1], src.d[o + 2]];
          if (fn) { c = fn(c, x, y); if (!c) continue; }
          this.px(tx, ty, c, (sa / 255) * al);
        }
      }
      return this;
    }
    copy() { const o = new Img(this.w, this.h); o.d.set(this.d); return o; }
  }

  // ---------- lighting a height field ----------
  const norm3 = (x, y, z) => { const n = Math.hypot(x, y, z) || 1; return [x / n, y / n, z / n]; };
  const KEY = norm3(-0.55, -0.8, 0.5);
  const INFO = { h: 0, nx: 0, ny: 0, nz: 1, diff: 0, spec: 0, edge: 0, rim: 0, fire: 0 };
  // hf(x, y) -> height or null (outside); cf(x, y, info) -> colour or null. info: h, normal, diff (key light), spec, edge (open sides), rim, fire (light from below right)
  function hrender(img, box, hf, cf, o) {
    o = o || {};
    const light = o.light || KEY, k = o.k || 18, fireL = norm3(0.35, 0.9, 0.35);
    const x0 = Math.floor(box[0]), y0 = Math.floor(box[1]), x1 = Math.ceil(box[2]), y1 = Math.ceil(box[3]);
    const bw = x1 - x0 + 3, bh = y1 - y0 + 3, hs = new Float32Array(bw * bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const v = hf(x0 - 1 + x + 0.5, y0 - 1 + y + 0.5); hs[y * bw + x] = v === null || v === undefined ? NaN : v; }
    const hv = norm3(light[0], light[1], light[2] + 1);
    const at = (x, y) => hs[(y - y0 + 1) * bw + (x - x0 + 1)];
    for (let y = Math.max(0, y0); y <= Math.min(img.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(img.w - 1, x1); x++) {
      const h = at(x, y);
      if (h !== h) continue;
      let l = at(x - 1, y), r = at(x + 1, y), u = at(x, y - 1), d = at(x, y + 1), edge = 0;
      if (l !== l) { l = h; edge++; } if (r !== r) { r = h; edge++; } if (u !== u) { u = h; edge++; } if (d !== d) { d = h; edge++; }
      const n = norm3(-(r - l) / 2, -(d - u) / 2, 1);
      INFO.h = h; INFO.nx = n[0]; INFO.ny = n[1]; INFO.nz = n[2]; INFO.edge = edge;
      INFO.diff = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
      INFO.spec = Math.pow(Math.max(0, n[0] * hv[0] + n[1] * hv[1] + n[2] * hv[2]), k);
      INFO.rim = Math.max(0, n[0] * 0.6 + n[1] * 0.75);
      INFO.fire = Math.max(0, n[0] * fireL[0] + n[1] * fireL[1] + n[2] * fireL[2]);
      const c = cf(x, y, INFO);
      if (c) img.px(x, y, c);
    }
  }
  function ell(cx, cy, rx, ry, wob, seed) {
    seed = seed || 0;
    return (x, y) => {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      let r = 1;
      if (wob) { const th = Math.atan2(ny, nx); for (const [kk, a, p] of wob) r += a * Math.sin(kk * th + p + seed); }
      return Math.hypot(nx, ny) / r;
    };
  }
  function dome(cx, cy, rx, ry, height, o) {
    o = o || {};
    const E = ell(cx, cy, rx, ry, o.wob, o.seed);
    const pw = o.pow || 0.5, sd = o.seed || 0, rough = o.rough || 0, sc = o.scale || 6;
    const f = (x, y) => {
      const d = E(x, y);
      if (d > 1) return null;
      return Math.pow(1 - d * d, pw) * height + (rough ? (fbm(x / sc, y / sc, sd) - 0.5) * rough : 0);
    };
    f.E = E;
    return f;
  }

  // ---------- light, air and sparkle ----------
  function glow(img, cx, cy, rx, col, a, ry, steps) {
    ry = ry || rx; steps = steps || 6;
    for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(img.h, cy + ry + 1); y++) for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(img.w, cx + rx + 1); x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d >= 1) continue;
      const t = Math.floor(Math.pow(1 - d, 1.6) * steps + bay(x, y)) / steps;
      if (t > 0) img.px(x, y, col, a * t);
    }
  }
  function light(img, cx, cy, r, col, a, ry, steps) {
    ry = ry || r; steps = steps || 8;
    const c = C(col);
    for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(img.h, cy + ry + 1); y++) for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(img.w, cx + r + 1); x++) {
      const d = Math.hypot((x + 0.5 - cx) / r, (y + 0.5 - cy) / ry);
      if (d >= 1) continue;
      const t = Math.floor(a * (1 - d) * (1 - d) * steps + bay(x, y)) / steps;
      if (t > 0) img.add(x, y, c, t);
    }
  }
  function vignette(img, a, col, r) {
    col = C(col || "#050304"); r = r || 1;
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
      const d = Math.hypot((x - img.w / 2) / (img.w / 2), (y - img.h / 2) / (img.h / 2)) / r;
      const t = Math.floor(Math.min(1, Math.max(0, d - 0.55) / 0.6) * 5 + bay(x, y)) / 5;
      if (t > 0) img.px(x, y, col, a * t);
    }
  }
  function bokeh(img, seed, n, cols, box, rr, aa) {
    const r = rng(seed);
    box = box || [0, 0, img.w, img.h]; rr = rr || [2, 5]; aa = aa || [0.15, 0.4];
    for (let i = 0; i < n; i++) {
      const x = lerp(box[0], box[2], r()), y = lerp(box[1], box[3], r()), rad = lerp(rr[0], rr[1], r()), c = cols[Math.floor(r() * cols.length)], al = lerp(aa[0], aa[1], r());
      for (let yy = Math.floor(y - rad); yy <= y + rad; yy++) for (let xx = Math.floor(x - rad); xx <= x + rad; xx++) {
        const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / rad;
        if (d < 1) img.px(xx, yy, c, al * (d > 0.75 ? 1.25 : 0.85));
      }
    }
  }
  // a column of steam that drifts; phase moves it, so the same call animates
  function steam(img, x, y, h, phase, a, sway, width, col) {
    a = a === undefined ? 0.4 : a; sway = sway || 3; width = width || 2.5; col = col || "#fff6ea";
    for (let j = 0; j < h; j++) {
      const t = j / h, jj = j + phase * 9;
      const cx = x + Math.sin(jj * 0.11 + phase * 0.6) * sway * (0.4 + t) + Math.sin(jj * 0.045 + phase * 1.1) * sway * 0.7;
      const wd = width * (0.5 + t * 1.2);
      for (let dx = -Math.floor(wd) - 2; dx <= wd + 2; dx++) {
        const px = Math.floor(cx) + dx, e = 1 - Math.abs(px + 0.5 - cx) / (wd + 0.5);
        if (e <= 0) continue;
        const al = a * Math.pow(Math.sin(Math.min(1, t * 1.15) * Math.PI), 0.7) * Math.pow(e, 0.8) * (0.7 + 0.3 * Math.sin(jj * 0.21));
        if (al > 0.05) img.px(px, y - j, col, Math.floor(al * 6 + bay(px, y - j) * 0.9) / 6);
      }
    }
  }
  function star(img, x, y, c, s, a) {
    c = c || "#fffbe8"; s = s || 2; a = a === undefined ? 1 : a;
    x = Math.round(x); y = Math.round(y);
    img.px(x, y, c, a);
    for (let d = 1; d <= s; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) img.px(x + dx, y + dy, c, a * (d < s ? 1 : 0.55));
    if (s >= 3) for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) img.px(x + dx, y + dy, c, a * 0.5);
  }
  function outline(img, col, thresh, inner) {
    thresh = thresh === undefined ? 100 : thresh;
    const src = img.d.slice(), w = img.w, h = img.h, A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (A(x, y) >= thresh) continue;
      if (A(x + 1, y) >= thresh || A(x - 1, y) >= thresh || A(x, y + 1) >= thresh || A(x, y - 1) >= thresh) img.px(x, y, col);
    }
    if (inner) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A(x, y) >= thresh && (A(x, y + 1) < thresh)) img.px(x, y, inner, 0.6);
    }
    return img;
  }
  // a softer edge than an outline: the shape's own edge pixels darkened, on the side away from the light only
  function rimShade(img, k) {
    k = k === undefined ? 0.45 : k;
    const src = img.d.slice(), w = img.w, h = img.h, A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (A(x, y) < 100 || (A(x + 1, y) >= 100 && A(x, y + 1) >= 100 && A(x + 1, y + 1) >= 100)) continue;
      const o = (y * w + x) * 4;
      img.d[o] = src[o] * (1 - k); img.d[o + 1] = src[o + 1] * (1 - k); img.d[o + 2] = src[o + 2] * (1 - k);
    }
    return img;
  }
  // a bite taken out of a soft food's outline from above: everything over a ragged curve that dips depth px below ytop at its middle and
  // comes back up to ytop at its ends, so the outline loses a scoop with no stray horns left at its sides; b = [cx, ytop, rx, depth, seed]
  function notchAt(x, y, b) {
    const u = (x - b[0]) / b[2];
    return Math.abs(u) < 1 && y < b[1] + b[3] * Math.sqrt(1 - u * u) * (1 + (fbm(u * 3 + 5, 0.5, b[4]) - 0.5) * 0.35);
  }
  function shadow(img, cx, cy, rx, ry, a, col) {
    const E = ell(cx, cy, rx, ry);
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = E(x + 0.5, y + 0.5);
      if (d < 1) img.px(x, y, col || "#000000", a * Math.floor((1 - d * d) * 4 + bay(x, y)) / 4);
    }
  }

  // ---------- text: Pixelify Sans baked to 1px (tools/meal_font.py); bold is the regular face struck twice ----------
  /* meal-font:start */
  const FONT = {"r":{" ":[2,[]],"!":[1,[0,0,1,1,1,1,1,0,1]],"\"":[3,[0,0,5,5]],"#":[6,[0,0,18,18,63,18,18,63,18]],"$":[5,[0,4,14,17,1,14,16,17,14,4]],"%":[8,[0,0,66,39,18,8,68,226,65]],"&":[6,[0,0,14,17,10,4,10,17,46]],"'":[1,[0,0,1,1]],"(":[3,[4,4,2,2,1,1,2,2,4,4]],")":[3,[1,1,2,2,4,4,2,2,1,1]],"*":[1,[0,0,1,1]],"+":[5,[0,0,4,4,31,4,4]],",":[1,[0,0,0,0,0,0,0,1,1]],"-":[3,[0,0,0,0,0,7]],".":[1,[0,0,0,0,0,0,0,1]],"/":[4,[0,0,8,4,4,2,2,1,1]],"0":[5,[0,0,14,17,17,17,17,17,14]],"1":[3,[0,0,2,5,4,4,4,4,4]],"2":[5,[0,0,14,17,16,14,1,17,14]],"3":[5,[0,0,14,17,16,14,16,17,14]],"4":[5,[0,0,24,20,18,17,31,16,16]],"5":[5,[0,0,31,1,15,16,16,17,14]],"6":[5,[0,0,14,17,1,15,17,17,14]],"7":[5,[0,0,14,17,16,16,16,16,16]],"8":[5,[0,0,14,17,17,14,17,17,14]],"9":[5,[0,0,14,17,17,30,16,17,14]],":":[1,[0,0,0,0,0,1,0,1]],";":[1,[0,0,0,0,0,1,0,1,1]],"<":[5,[0,16,8,4,2,1,2,4,8,16]],"=":[4,[0,0,0,0,15,15,15]],">":[5,[0,1,2,4,8,16,8,4,2,1]],"?":[5,[0,0,14,17,17,12,4,0,4]],"@":[5,[0,0,0,15,23,9,7]],"A":[5,[0,0,4,10,17,17,31,17,17]],"B":[5,[0,0,14,17,17,13,17,17,14]],"C":[5,[0,0,14,17,17,1,17,17,14]],"D":[5,[0,0,7,9,17,17,17,9,7]],"E":[5,[0,0,14,17,1,7,1,17,14]],"F":[5,[0,0,15,17,1,7,1,1,1]],"G":[5,[0,0,14,17,17,5,25,17,14]],"H":[5,[0,0,17,17,21,31,17,17,17]],"I":[3,[0,0,7,2,2,2,2,2,7]],"J":[5,[0,0,14,16,16,16,17,17,14]],"K":[5,[0,0,18,9,5,3,5,9,17]],"L":[5,[0,0,1,1,1,1,1,17,14]],"M":[7,[0,0,34,85,85,73,73,73,65]],"N":[5,[0,0,17,19,21,21,21,25,17]],"O":[5,[0,0,14,17,17,17,17,17,14]],"P":[5,[0,0,14,17,17,17,15,1,1]],"Q":[5,[0,0,14,17,17,17,17,17,14,4,8]],"R":[5,[0,0,14,17,17,17,15,5,9]],"S":[5,[0,0,14,17,1,14,16,17,14]],"T":[5,[0,0,14,21,4,4,4,4,4]],"U":[5,[0,0,17,17,17,17,17,17,14]],"V":[5,[0,0,17,17,17,17,10,10,4]],"W":[7,[0,0,65,73,73,73,85,85,34]],"X":[5,[0,0,17,10,10,4,10,10,17]],"Y":[5,[0,0,17,17,10,4,4,4,4]],"Z":[5,[0,0,15,17,16,14,1,17,30]],"[":[3,[0,6,1,1,1,1,1,1,6]],"\\":[4,[0,0,1,1,2,2,4,4,8]],"]":[3,[0,3,4,4,4,4,4,4,3]],"^":[1,[0,0,1]],"_":[3,[0,0,0,0,0,0,0,7]],"`":[1,[0,1]],"a":[6,[0,0,0,0,14,17,17,17,46]],"b":[5,[0,0,1,1,15,17,17,17,14]],"c":[5,[0,0,0,0,14,17,1,17,14]],"d":[5,[0,0,16,16,30,17,17,17,14]],"e":[5,[0,0,0,0,14,17,7,17,14]],"f":[5,[0,0,14,17,1,7,1,1,1]],"g":[5,[0,0,0,0,14,17,17,30,16,17,14]],"h":[5,[0,0,1,1,13,19,17,17,17]],"i":[1,[0,0,1,0,1,1,1,1,1]],"j":[4,[0,0,0,0,8,8,8,9,6]],"k":[5,[0,0,1,1,17,13,3,13,17]],"l":[1,[0,0,1,1,1,1,1,1,1]],"m":[7,[0,0,0,0,55,73,73,73,73]],"n":[5,[0,0,0,0,15,17,17,17,17]],"o":[5,[0,0,0,0,14,17,17,17,14]],"p":[5,[0,0,0,0,14,17,17,17,15,1,1]],"q":[5,[0,0,0,0,14,17,17,17,30,16,16]],"r":[5,[0,0,0,0,14,17,1,1,1]],"s":[5,[0,0,0,0,30,1,14,16,15]],"t":[6,[0,0,2,2,31,2,2,34,28]],"u":[5,[0,0,0,0,17,17,17,17,14]],"v":[5,[0,0,0,0,17,17,10,10,4]],"w":[7,[0,0,0,0,73,73,73,73,55]],"x":[5,[0,0,0,0,17,10,4,10,17]],"y":[5,[0,0,0,0,17,17,17,30,16,17,14]],"z":[5,[0,0,0,0,31,8,4,2,31]],"{":[4,[0,4,10,2,2,1,2,2,10,4]],"|":[1,[0,0,1,1,1,1,1,1,1]],"}":[4,[0,2,5,4,4,8,4,4,5,2]],"~":[3,[0,0,0,0,0,7]]},"up":9,"rows":13};
  /* meal-font:end */
  const GL = FONT.r || {};
  function glyph(ch) { return GL[ch] || GL["?"] || [3, []]; }
  function textWidth(s, o) {
    o = o || {};
    const k = o.k || 1, b = o.bold ? 1 : 0;
    let w = 0;
    for (const ch of s) w += (glyph(ch)[0] + 1 + b) * k;
    return Math.max(0, w - k);
  }
  // o: k (scale), bold, center, outline (colour), shadow (colour), fill(x, y) -> colour per pixel (a gradient), wave(i) -> dy per letter
  function text(img, s, x, y, col, o) {
    o = o || {};
    const k = o.k || 1, b = o.bold ? 1 : 0, up = FONT.up || 9;
    if (o.center) x = Math.round(x - textWidth(s, o) / 2);
    y = Math.round(y) - up * k;
    const marks = [];
    let cx = Math.round(x), i = 0;
    for (const ch of s) {
      const [w, rows] = glyph(ch), dy = o.wave ? Math.round(o.wave(i)) : 0;
      for (let r = 0; r < rows.length; r++) for (let c = 0; c < w; c++) if ((rows[r] >> c) & 1) for (let bb = 0; bb <= b; bb++) marks.push([cx + (c + bb) * k, y + r * k + dy]);
      cx += (w + 1 + b) * k; i++;
    }
    const put = (ox, oy, colr, fn) => { for (const [mx, my] of marks) for (let j = 0; j < k; j++) for (let ii = 0; ii < k; ii++) img.px(mx + ii + ox, my + j + oy, fn ? fn(mx + ii, my + j) : colr); };
    if (o.shadow) put(o.sk || 1, o.sk || 1, o.shadow);
    if (o.outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) put(dx, dy, o.outline);
    put(0, 0, col, o.fill);
    return cx - x;
  }
  // where a string of text sits: the baseline is y, the cap top is y - CAP
  const CAP = 7;

  // ---------- shared palettes ----------
  const P = {
    raw: R(["#3a0a12", "#5e1220", "#86202e", "#a8323c", "#c84a4e", "#e06a66", "#f29086"]),
    fat: R(["#b89a86", "#d8beaa", "#eedccc", "#fff4ea"]),
    crust: R(["#170703", "#2c1006", "#45190a", "#622610", "#813616", "#a24c1e", "#c2682a", "#de9244"]),
    iron: R(["#08070a", "#121016", "#1e1b22", "#2e2a32", "#46404a", "#6a6068"]),
    oil: R(["#120a06", "#1e1209", "#2c1a0c", "#3e2410", "#5a3414"]),
    pink: R(["#7a1c2a", "#9a2834", "#ba3a44", "#d45258", "#e8706e", "#f6968a"]),
    grey: R(["#6a3a2c", "#865040", "#a06454"]),
    scale: R(["#3a0c06", "#6a1a0a", "#9a2c10", "#c84a18", "#e8782a", "#ffb050"]),
    butter: R(["#a8742a", "#d8a440", "#f0c858", "#fae088", "#fff6c8"]),
    garlic: R(["#6a3a14", "#a8642a", "#d89a4a", "#f4cc80", "#fff0c8"]),
    garlicW: R(["#7a6a5a", "#a89a88", "#d4cab8", "#efe8da", "#fffaf0"]),
    wood: R(["#2a1608", "#4a2810", "#6a3e1a", "#8a5628", "#aa7038", "#c88c4c"]),
    leaf: R(["#16260e", "#24401a", "#3a6026", "#56843a", "#7aa852", "#a8cc78"]),
    cloth: R(["#2a1a12", "#40281a", "#5a3a26", "#785034", "#966a46"]),
    paper: R(["#a8906a", "#cbb48a", "#e6d4ae", "#f6ead0"]),
    ink: C("#2a1a12"),
    gold: R(["#5a3a0a", "#8a5a14", "#c08a24", "#e8b84a", "#ffe08a", "#fff6d0"]),
  };

  // ---------- meat: a slab with its cut side, raw, seared or charred, marbled, the drake's scale strip along one edge ----------
  const BURNT = R(["#050303", "#0c0706", "#160c08", "#22120c", "#301a10", "#3e2414"]);
  function marble(x, y, seed, s) {
    const m = fbm(x / (5 * s), y / (3.5 * s), seed + 9, 3);
    const v = Math.abs(Math.sin(x * 0.18 / s + m * 7 + Math.sin(y * 0.3 / s) * 1.5));
    return v < 0.1 && fbm(x / (9 * s), y / (6 * s), seed + 11) > 0.5;
  }
  function slabHF(cx, cy, rx, ry, thick, seed, rough, s) {
    const E = ell(cx, cy, rx, ry, [[2, 0.07, 0.4], [3, 0.06, 1.3], [5, 0.03, 2.0]], seed);
    const f = (x, y) => {
      const d = E(x, y);
      if (d > 1) return null;
      return Math.pow(1 - Math.pow(d, 4), 0.35) * thick + (fbm(x / (13 * s), y / (7 * s), seed) - 0.5) * 4 * rough * s + (fbm(x / (3.5 * s), y / (3 * s), seed + 1) - 0.5) * 0.9 * rough * s;
    };
    f.E = E;
    return f;
  }
  // o: cx, cy, rx, ry, thick (the cut side, px), seed, s (scale: 1 is the full-frame macro), done (0 raw .. 1 seared), glaze, under (how far up the side the browning has crept), burnt, look
  function slab(img, o) {
    const s = o.s || 1, seed = o.seed || 3, look = o.look || {};
    const RAW = look.raw || P.raw, FAT = look.fat || P.fat, CRUST = o.burnt ? BURNT : look.crust || P.crust;
    const { cx, cy, rx, ry } = o, thick = Math.max(2, Math.round((o.thick || 8) * s));
    const hf = slabHF(cx, cy, rx, ry, 13 * s, seed, o.burnt ? 1.6 : o.done > 0.5 ? 1.15 : 1, s), E = hf.E;
    const lay = new Img(img.w, img.h);
    const under = o.under || (o.done > 0.5 ? 1 : 0);
    for (let y = Math.floor(cy - ry); y < cy + ry + thick + 2; y++) for (let x = Math.floor(cx - rx * 1.15); x < cx + rx * 1.15; x++) {
      if (E(x + 0.5, y + 0.5) <= 1) continue;
      const th = Math.round(thick * (0.75 + 0.45 * fbm(x / (16 * s), 0.5, seed + 21)));
      for (let d = 1; d <= th; d++) {
        if (E(x + 0.5, y + 0.5 - d) > 1) continue;
        const nx = (x - cx) / rx, depth = d / th, f = fbm(x / (2 * s), y / (3 * s), seed);
        const t = 0.62 - nx * 0.3 - depth * 0.35 + (f - 0.5) * 0.3;
        let c;
        if (o.burnt) c = pick(BURNT, t * 0.8, x, y);
        else if (o.done > 0.5) c = depth < 0.22 || depth > 0.85 ? pick(CRUST, 0.15 + t * 0.55, x, y) : depth < 0.4 ? pick(CRUST, 0.35 + t * 0.4, x, y) : pick(look.grey || P.grey, t * 0.8 + (f - 0.5) * 0.4, x, y);
        else if (depth > 1 - under * 0.4) c = pick(CRUST, 0.2 + t * 0.6, x, y);
        else if (depth > 1 - under * 0.7) c = pick(look.grey || P.grey, t, x, y);
        else c = Math.abs(depth - 0.45 - (f - 0.5) * 0.3) < 0.07 ? pick(FAT, 0.2 + t * 0.6, x, y) : pick(RAW, 0.12 + t * 0.55, x, y);
        lay.px(x, y, c);
        break;
      }
    }
    const done = o.done || 0, glaze = o.glaze || 0;
    hrender(lay, [cx - rx - 4, cy - ry - 4, cx + rx + 4, cy + ry + 4], hf, (x, y, i) => {
      const n = fbm(x / (5 * s), y / (3.5 * s), seed + 3), n2 = fbm(x / (1.8 * s), y / (1.6 * s), seed + 4);
      const crustHere = done >= 1 || (done > 0 && n + (1 - E(x + 0.5, y + 0.5)) * -0.4 + 0.3 < done);
      if (o.burnt) {
        let c = pick(BURNT, 0.05 + i.diff * 0.7 + (n - 0.5) * 0.5, x, y, 0.4);
        if (n2 > 0.72) c = mix("#4a4440", "#8a8278", (n2 - 0.72) * 3);
        if (n2 < 0.18 && n > 0.55) c = "#ff7a2a";
        return c;
      }
      if (!crustHere) {
        if (i.h < 4.5 * s && y < cy - ry * 0.15) return pick(FAT, 0.25 + i.diff * 0.8, x, y, 0.3);
        const wet = Math.pow(i.diff, 3) * 0.5 + i.spec * 0.9;
        let c = pick(RAW, 0.05 + i.diff * 0.7 + wet * 0.4 + (fbm(x / (6 * s), y / (4 * s), seed + 2) - 0.5) * 0.3, x, y, 0.4);
        if (marble(x, y, seed, s)) c = pick(FAT, 0.05 + i.diff * 0.75 + wet * 0.3, x, y, 0.3);
        else if (fbm(x / (2.2 * s), y / (1.6 * s), seed + 5) > 0.66) c = mix(c, RAW[0], 0.35);
        if (i.spec > 0.75 && !i.edge && fbm(x / (4 * s), y / (2.5 * s), seed + 7) > 0.45) c = i.spec < 0.9 ? "#ff9e94" : "#fff0ec";
        return c;
      }
      let c = pick(CRUST, 0.0 + i.diff * 0.62 + (n - 0.5) * 0.5 + (n2 - 0.5) * 0.28 - (i.edge ? 0.12 : 0), x, y, 0.35);
      const sp = i.spec * (0.75 + glaze * 0.7);
      if (sp > 0.5 && !i.edge && n2 > 0.35) c = sp < 0.66 ? "#c8783a" : sp < 0.84 ? "#f0b468" : "#fff0d0";
      else if (glaze > 0 && i.spec > 0.2 && n2 > 0.6) c = mix(c, "#f8c060", 0.55);
      else if (n2 < 0.22 && n < 0.5) c = CRUST[0];
      else if (look.pepper && h2(x, y, seed) < look.pepper) c = "#140806";
      return c;
    }, { k: done > 0.5 ? 22 : 9 });
    if (look.scales) scaleStrip(lay, cx, cy, rx, ry, E, seed, o.burnt ? 2 : done);
    outline(lay, o.burnt ? "#020101" : done > 0.5 ? "#140604" : "#14040a");
    img.paste(lay, 0, 0);
    return E;
  }
  function scaleStrip(img, cx, cy, rx, ry, E, seed, cooked) {
    const ramp = cooked >= 2 ? BURNT : cooked < 0.5 ? P.scale : R(["#2a0a04", "#4a1606", "#7a2a0c", "#a8441a", "#e07a2a", "#ffc060"]);
    for (let y = Math.floor(cy - ry - 2); y < cy + ry + 3; y++) for (let x = Math.floor(cx - rx - 2); x < cx + rx + 3; x++) {
      const d = E(x + 0.5, y + 0.5), ang = Math.atan2(y - cy, x - cx);
      if (d > 0.84 && d <= 1 && ang > -2.9 && ang < -1.2) {
        const u = Math.floor((ang + 3) * 14 + (d > 0.92 ? 0.5 : 0));
        const t = 0.35 + 0.5 * ((u % 2) * 0.4 + (1 - (d - 0.84) / 0.16) * 0.5);
        img.px(x, y, pick(ramp, t, x, y));
        if (u % 2 === 0 && d > 0.97) img.px(x, y, ramp[ramp.length - 1]);
      }
    }
  }
  // a slice of steak leaning back on its neighbour: the cut face a rounded oblong turned by ang, seared crust along its top and bottom (the
  // two faces that were in the pan), a grey band inside that, rosy pink in the middle with its grain and a wet shine; its edge below it
  function steakSlice(img, x, y, w, h, ang, look, seed) {
    const lay = new Img(img.w, img.h), ca = Math.cos(ang), sa = Math.sin(ang), PINK = look.pink || P.pink, CRUST = look.crust || P.crust, GREY = look.grey || P.grey;
    const loc = (xx, yy) => [(xx - x) * ca + (yy - y) * sa, -(xx - x) * sa + (yy - y) * ca];
    const inside = (xx, yy) => { const [u, v] = loc(xx, yy), wob = (fbm(u / 4, 3, seed) - 0.5) * 2; if (Math.abs(u) > w / 2 + wob * 0.5 || Math.abs(v) > h / 2 + wob * 0.6) return null; const r = 3, cu = Math.abs(u) - (w / 2 - r), cv = Math.abs(v) - (h / 2 - r); if (cu > 0 && cv > 0 && Math.hypot(cu, cv) > r) return null; return [u, v, h / 2 - Math.abs(v), w / 2 - Math.abs(u)]; };
    const R0 = Math.hypot(w, h) / 2 + 3;
    for (let yy = Math.floor(y - R0); yy <= y + R0 + 3; yy++) for (let xx = Math.floor(x - R0); xx <= x + R0; xx++) { if (inside(xx + 0.5, yy + 0.5)) continue; for (let k = 1; k <= 3; k++) if (inside(xx + 0.5, yy + 0.5 - k)) { lay.px(xx, yy, k === 3 ? CRUST[1] : pick(CRUST, 0.3, xx, yy)); break; } }
    hrender(lay, [x - R0, y - R0, x + R0, y + R0], (xx, yy) => { const q = inside(xx, yy); return q ? Math.min(2, Math.min(q[2], q[3]) * 0.6) : null; }, (xx, yy, i) => {
      const q = inside(xx + 0.5, yy + 0.5);
      if (!q) return null;
      const [u, v, ev, eu] = q, lit = 0.35 + i.diff * 0.5;
      if (ev < 2.6 || eu < 1.2) return pick(CRUST, 0.15 + lit * 0.5 + (fbm(xx / 2, yy, seed) - 0.5) * 0.4, xx, yy, 0.35);
      if (ev < 3.8) return pick(GREY, 0.3 + lit * 0.4, xx, yy, 0.3);
      if (look.marbleC && marble(xx * 1.4, yy * 2, seed, 1)) return look.marbleC;
      let t = 0.2 + lit * 0.3 + Math.min(1, (ev - 3.8) / (h / 2 - 3.8)) * 0.45;
      if (Math.sin(u * 0.9 + v * 0.3 + fbm(xx / 3, yy / 2, seed) * 2) > 0.8) t -= 0.12;
      if (lit > 0.65 && Math.abs(v + 1) < 1.2 && Math.abs(u + w * 0.15) < 4 && h2(xx, yy, seed) > 0.4) return "#ffe8e0";
      return pick(PINK, t, xx, yy, 0.25);
    }, { k: 30 });
    outline(lay, "#1a0806");
    img.paste(lay, 0, 0);
  }
  // a cut slice: the crust rim (thick on top), a thin grey band, a rosy centre
  function sliceFace(img, x, y, w, h, seed, tilt, look) {
    look = look || {};
    const PINK = look.pink || P.pink, CRUST = look.crust || P.crust, GREY = look.grey || P.grey;
    tilt = tilt === undefined ? 0.18 : tilt;
    hrender(img, [x - w - 3, y - h - 3, x + w + 3, y + h + 3], (xx, yy) => {
      let nx = (xx - x) / w; const ny = (yy - y) / h;
      nx += ny * tilt;
      const d = Math.pow(Math.pow(Math.abs(nx), 3) + Math.pow(Math.abs(ny), 2.2), 1 / 2.6);
      return d > 1 ? null : 1 - d;
    }, (xx, yy, i) => {
      const e = i.h, ny = (yy - y) / h, nx = (xx - x) / w, top = ny < -0.45;
      if (e < 0.08 || (top && e < 0.3)) return pick(CRUST, 0.2 + i.diff * 0.4 + (top ? 0.3 : 0) + (fbm(xx / 2, yy, seed) - 0.5) * 0.4, xx, yy, 0.3);
      if (e < 0.18) return pick(GREY, 0.5 + (fbm(xx / 2, yy / 2, seed) - 0.5), xx, yy, 0.3);
      const t = Math.min(1, (e - 0.18) / 0.4);
      let c = pick(PINK, 0.15 + t * 0.7 + (fbm(xx / 4, yy / 2, seed) - 0.5) * 0.25 - ny * 0.15, xx, yy, 0.35);
      if (marble(xx * 1.4, yy * 2, seed, 1) && t > 0.25) c = look.marbleC || "#f2b4a6";
      if (ny < -0.1 && t > 0.4 && Math.abs(nx + 0.3) < 0.18 && ny > -0.45) c = "#ffd4c8";
      return c;
    });
  }

  // ---------- the small things laid beside the meat ----------
  function butter(img, x, y, melt, seed, s) {
    s = s || 1;
    const lay = new Img(img.w, img.h), rx = (7 + melt * 6) * s, ry = (4 + melt * 2) * s;
    const E = ell(x, y, rx, ry, [[3, 0.12, 0.3], [5, 0.08, 1.1]], seed || 2);
    hrender(lay, [x - rx - 2, y - ry - 2, x + rx + 2, y + ry + 2], (xx, yy) => { const d = E(xx, yy); return d > 1 ? null : Math.pow(1 - d, 0.4) * (5 - melt * 3) * s; },
      (xx, yy, i) => (i.spec > 0.5 ? "#ffffff" : pick(P.butter, 0.2 + i.diff * 0.85, xx, yy)), { k: 10 });
    if (melt < 0.3) outline(lay, "#5a3a10");
    img.paste(lay, 0, 0);
    const r = rng(seed || 2);
    for (let i = 0; i < 10 + melt * 30; i++) {
      const a = r() * TAU, d = lerp(1, 1.8 + melt, r());
      img.px(x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, r() < 0.5 ? "#fff0b0" : "#f8d070", 0.85 * Math.min(1, melt * 3));
    }
  }
  function garlic(img, x, y, seed, s) {
    s = s || 1;
    const E = ell(x, y, 4 * s, 3 * s, [[5, 0.06, 0]], seed);
    hrender(img, [x - 6 * s, y - 5 * s, x + 6 * s, y + 5 * s], (xx, yy) => { const d = E(xx, yy); return d > 1 ? null : Math.sqrt(1 - d * d) * 3 * s; },
      (xx, yy, i) => pick(P.garlic, 0.15 + i.diff * 0.9, xx, yy));
  }
  function garlicBulb(img, x, y, seed, s) {
    s = s || 1;
    const lay = new Img(img.w, img.h);
    for (let k = -2; k <= 2; k++) {
      const E = ell(x + k * 3 * s, y, 3.4 * s, 5.5 * s);
      hrender(lay, [x + k * 3 * s - 5 * s, y - 7 * s, x + k * 3 * s + 5 * s, y + 7 * s], (xx, yy) => { const d = E(xx, yy); return d > 1 ? null : Math.sqrt(1 - d * d) * 4 * s + (2 - Math.abs(k)) * s; },
        (xx, yy, i) => { const c = pick(P.garlicW, 0.1 + i.diff * 0.9, xx, yy); return (xx + yy * 3) % 7 === 0 && i.diff < 0.6 ? mix(c, "#b8889a", 0.3) : c; });
    }
    lay.line(x, y - 6 * s, x + s, y - 9 * s, "#8a7a5a");
    outline(lay, "#2a1e14");
    img.paste(lay, 0, 0);
  }
  // a pale blue-white flower with five rounded petals and a gold eye, on a short green stem
  function moonpetal(img, x, y, s, seed, glowy) {
    s = s || 1;
    if (glowy !== false) glow(img, x, y, 11 * s, "#bfe8ff", 0.34);
    const r = rng(seed || 1), lay = new Img(img.w, img.h);
    for (let j = 0; j <= 8 * s; j++) { const t = j / (8 * s); lay.px(x - 6 * s * t + Math.sin(t * 3) * s, y + 2 + 6 * s * t, t < 0.5 ? "#4a7a30" : "#36602a"); }
    for (const [lx, ly, dir] of [[-3.5, 5, -1], [-1.5, 3.5, 1]]) {
      const E = ell(x + lx * s + dir * 2.4 * s, y + ly * s, 2.6 * s, 1.1 * s, [[2, 0.2, dir]], seed);
      hrender(lay, [x + lx * s - 6 * s, y + ly * s - 3 * s, x + lx * s + 6 * s, y + ly * s + 3 * s], (xx, yy) => { const d = E(xx, yy); return d > 1 ? null : (1 - d) * 2; }, (xx, yy, i) => pick(P.leaf, 0.3 + i.diff * 0.6, xx, yy));
    }
    const rot = r() * TAU;
    for (let k = 0; k < 5; k++) {
      const a = rot + (k / 5) * TAU, px = x + Math.cos(a) * 2.9 * s, py = y + Math.sin(a) * 2.3 * s;
      const E = ell(px, py, 1.9 * s, 1.5 * s, [[1, 0.25, a]], 0);
      hrender(lay, [px - 3 * s, py - 3 * s, px + 3 * s, py + 3 * s], (xx, yy) => { const d = E(xx, yy); return d > 1 ? null : Math.sqrt(1 - d * d) * 2 * s; },
        (xx, yy, i) => pick(R(["#5a86b8", "#8ab8e0", "#c4e2f6", "#e8f6ff", "#ffffff"]), 0.25 + i.diff * 0.8 - Math.hypot(xx - x, yy - y) / (9 * s) * 0.4, xx, yy));
    }
    lay.px(x, y, "#ffe27a"); lay.px(x + 1, y, "#e8b84a"); lay.px(x, y - 1, "#fff6c0");
    outline(lay, "#1a2a3a");
    img.paste(lay, 0, 0);
  }
  function flakes(img, seed, n, cx, cy, rx, ry) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.pow(r(), 0.6), x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
      img.px(x, y, "#fffaf2");
      if (r() < 0.4) img.px(x + 1, y, "#d8d0c8");
      img.px(x, y + 1, "#5a2018", 0.5);
    }
  }
  function peppers(img, seed, n, cx, cy, rx, ry, col) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.pow(r(), 0.6); img.px(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, col || "#140806"); }
  }
  // a little linen bag tied with twine, open at the top, salt showing and spilt beside it
  function saltPouch(img, x, y, seed, s) {
    s = s || 1;
    const lay = new Img(img.w, img.h), E = ell(x, y + 2 * s, 10 * s, 7 * s, [[3, 0.07, 1]], seed);
    const LINEN = R(["#3a2e22", "#5e4c38", "#86705a", "#a89074", "#c8b494", "#e2d2b4"]);
    hrender(lay, [x - 11 * s, y - 14 * s, x + 11 * s, y + 11 * s], (xx, yy) => {
      const nx = (xx - x) / (9 * s), top = y - 5 * s;
      if (yy < top) { const w = 0.3 + (top - yy) / (5 * s) * 0.35; if (Math.abs(nx) > w || yy < top - 5 * s) return null; return 5 * s + Math.sin(nx * 9 + (top - yy)) * 0.6; }
      const d = E(xx, yy); return d > 1 ? null : Math.sqrt(1 - d * d) * 8 * s + Math.sin(xx * 1.7 + yy * 0.5) * 0.4;
    }, (xx, yy, i) => {
      const c = pick(LINEN, 0.1 + i.diff * 0.85, xx, yy);
      return (xx + yy) % 3 === 0 && i.diff > 0.3 ? mix(c, "#000000", 0.08) : c;
    });
    for (let k = -4; k <= 4; k++) { lay.px(x + k * s, y - 5 * s + Math.abs(k) * 0.2, k % 2 ? "#6a4a24" : "#9a7038"); lay.px(x + k * s, y - 4 * s + Math.abs(k) * 0.2, "#4a3218"); }
    for (let k = 0; k < 6 * s; k++) lay.px(x + 4 * s + k, y - 5 * s + k * 0.8, k % 2 ? "#9a7038" : "#6a4a24");
    for (let k = -3; k <= 3; k++) for (let j = 0; j < 2; j++) lay.px(x + k * s * 0.8, y - 9 * s + j + Math.abs(k) * 0.3, j ? "#d8d2c8" : "#ffffff");
    outline(lay, "#1a1008");
    img.paste(lay, 0, 0);
    const r = rng(seed + 5);
    for (let i = 0; i < 26; i++) { const xx = x + 8 * s + r() * 12 * s, yy = y + 4 * s + r() * 5 * s; img.px(xx, yy, r() < 0.5 ? "#ffffff" : "#d8d4cc"); img.px(xx, yy + 1, "#2a1a10", 0.4); }
  }
  function drakeScale(img, x, y, s, seed) {
    s = s || 1;
    const lay = new Img(img.w, img.h);
    hrender(lay, [x - 6 * s, y - 8 * s, x + 6 * s, y + 6 * s], (xx, yy) => {
      const nx = (xx - x) / (5 * s), ny = (yy - y + 2 * s) / (6 * s);
      if (ny > 1 || Math.abs(nx) > 1 - Math.max(0, -ny) * 0.6 || ny < -1) return null;
      return (1 - nx * nx) * 2.5 * s;
    }, (xx, yy, i) => (i.spec > 0.4 ? "#ffe0a0" : pick(P.scale, 0.1 + i.diff * 0.85 + ((xx + yy) % 3 === 0 ? 0.1 : 0), xx, yy)), { k: 8 });
    outline(lay, "#1a0604");
    img.paste(lay, 0, 0);
  }

  // ---------- cookware ----------
  // the skillet close up, filling the frame: oil, a lip glowing on the fire side
  function skillet(img, cx, cy, rx, ry, fire, o) {
    o = o || {};
    const E = ell(cx, cy, rx, ry), OIL = o.oil || P.oil;
    hrender(img, [cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1], (x, y) => { const d = E(x, y); return d > 1 ? null : d; }, (x, y, i) => {
      const d = i.h, ang = Math.atan2((y - cy) / ry, (x - cx) / rx);
      if (d > 0.9) {
        let t = 0.35 + 0.35 * Math.cos(ang + 2.3) + (Math.sin(ang) < -0.6 ? 0.25 : 0);
        if (Math.sin(ang) > 0.55) t += fire * 0.5 * (Math.sin(ang) - 0.55);
        return pick(P.iron, t, x, y);
      }
      if (d > 0.86) return P.iron[0];
      const n = fbm(x / 9, y / 4, 4);
      const sd = Math.hypot(((x - cx) / rx - 0.1) / 0.32, ((y - cy) / ry + 0.5) / 0.22), sheen = sd < 1 ? (1 - sd) * 0.45 : 0;
      return pick(OIL, 0.2 + (1 - d) * 0.25 + n * 0.3 + sheen, x, y);
    });
    for (let k = 0; k < 60; k++) {
      const a = Math.PI * (0.1 + (k / 60) * 0.8);
      img.px(cx + Math.cos(a) * rx * 0.995, cy + Math.sin(a) * ry * 0.98, "#ff9a40", 0.35 + 0.4 * fire * Math.sin(a));
    }
  }
  // a skillet on the fire, seen from further off: rim, handle, the oil, the underside lit
  function skilletWide(img, cx, cy, rx, ry, fire) {
    const lay = new Img(img.w, img.h);
    for (let y = Math.floor(cy); y < cy + ry + 6; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (ell(cx, cy + 4, rx * 0.97, ry)(x + 0.5, y + 0.5) <= 1 && ell(cx, cy, rx, ry)(x + 0.5, y + 0.5) > 0.95) lay.px(x, y, pick(P.iron, 0.15 + fire * 0.35 * ((y - cy) / (ry + 6)), x, y));
    }
    skillet(lay, cx, cy, rx, ry, fire);
    for (let k = 0; k < 4; k++) lay.rect(cx + rx - 1 + k * 0, cy - 2 + k, 1, 1, P.iron[2]);
    for (let j = 0; j < 30; j++) { const x = cx + rx + j, y = cy - 1 - j * 0.28; lay.rect(x, y, 1, 3, pick(P.iron, 0.25 + (j % 9 === 0 ? 0.25 : 0), x, y)); lay.px(x, y, P.iron[4]); }
    outline(lay, "#050406");
    img.paste(lay, 0, 0);
  }
  // a board for the reveal, end grain and a lip
  function board(img, cx, cy, rx, ry, seed, ramp) {
    const WOOD = ramp || P.wood, E = ell(cx, cy, rx, ry), E2 = ell(cx, cy + 5, rx, ry);
    for (let y = Math.floor(cy + ry - 3); y < cy + ry + 6; y++) for (let x = Math.floor(cx - rx); x < cx + rx; x++) {
      if (E(x + 0.5, y + 0.5) > 1 && E2(x + 0.5, y + 0.5) <= 1) img.px(x, y, pick(WOOD, 0.12 + (1 - Math.abs(x - cx) / rx) * 0.28, x, y));
    }
    hrender(img, [cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1], (x, y) => { const d = E(x, y); return d > 1 ? null : Math.min(1, (1 - d) * 8); }, (x, y, i) => {
      const g = Math.sin(y * 1.3 + fbm(x / 14, y / 2, seed || 7) * 6) * 0.15;
      return pick(WOOD, 0.3 + i.diff * 0.45 + g + (i.h < 0.4 && y < cy ? 0.18 : i.h < 0.4 ? -0.2 : 0), x, y);
    });
  }
  // the warm dark behind a close-up; heat lifts it and brings up the bokeh
  function macroBack(heat, seed, warm) {
    const img = new Img(W, H, "#0b0706");
    const ramp = R(warm || ["#0b0706", "#140c08", "#1e110a", "#2c180c", "#3e210e", "#552c10"]);
    img.fill((x, y) => {
      const d = Math.hypot((x - 120) / 165, (y - 105) / 90);
      return pick(ramp, Math.max(0, 1 - d) * (0.45 + heat * 0.35) + fbm(x / 45, y / 45, seed) * 0.12, x, y);
    });
    bokeh(img, seed, 26, ["#ff9a3a", "#ffc060", "#e0602a"], [0, 0, W, 60], [2, 8], [0.08, 0.2 + heat * 0.1]);
    return img;
  }

  // ---------- eating: while a plate is drawn for the eating beats, what has been taken and where everything sits ----------
  // EAT = { gone: Set of item keys, zones: [[x, y, r]], carved, items: [], geo: {} }; serves call item() for each thing a hand or fork
  // could take, skip what taken() says is gone, and put their bowls and mounds in geo, so food_eat.js can plan any dish
  let EAT = null;
  function taken(key, x, y) {
    if (!EAT) return false;
    if (EAT.gone.has(key)) return true;
    if (x !== undefined) for (const [zx, zy, zr] of EAT.zones) if (Math.hypot(x - zx, (y - zy) * 1.5) < zr) return true;
    return false;
  }
  function item(key, x, y, r, kind, extra) { if (EAT) EAT.items.push(Object.assign({ key, x, y, r, kind }, extra || {})); }
  function geo(k, v) { if (EAT) EAT.geo[k] = v; }
  const eating = () => EAT;

  // ---------- the plates: how each kind of dish is drawn ----------
  // piece(look) -> { draw(img, cx, cy, s, stage, seed), at }: the thing in the pan at a stage (raw, sear, cook, baste, burnt), s = 1.5 fills the frame
  // serve(spec, o) -> a full-frame Img of the dish served (o.burnt for the disaster)
  const PLATES = {};
  PLATES.slab = {
    piece: (spec) => ({
      draw(img, q) {
        const { cx, cy, s, stage, seed } = q, look = spec.look, k = s / 1.5;
        const o = { cx, cy, rx: 52 * s, ry: 21 * s, thick: 7 * s, s, seed: 3 + (seed % 3), look };
        if (stage === "raw") slab(img, Object.assign(o, { done: 0 }));
        else if (stage === "sear") slab(img, Object.assign(o, { done: 0, under: 0.7 }));
        else if (stage === "cook") slab(img, Object.assign(o, { done: 1 }));
        else if (stage === "baste") slab(img, Object.assign(o, { done: 1, glaze: 0.45 }));
        else slab(img, Object.assign(o, { done: 1, burnt: true }));
        if (look.pepper && stage !== "raw") peppers(img, seed + 9, Math.round(60 * k * k), cx, cy - 4 * s, rx(o) * 0.8, o.ry * 0.7);
        function rx(q) { return q.rx; }
      },
    }),
    serve: (spec, o) => {
      if (spec.look.mixed && FoodArt.mixedGrill) return FoodArt.mixedGrill(spec, o);
      const look = spec.look, img = macroBack(0.6, 6), burnt = o.burnt;
      board(img, 120, 98, 117, 48, 7, look.board);
      if (burnt) {
        slab(img, { cx: 120, cy: 84, rx: 76, ry: 30, thick: 11, s: 1.45, seed: 4, done: 1, burnt: true, look });
        for (let i = 0; i < 40; i++) { const r = rng(i * 7 + 1); img.px(30 + r() * 180, 100 + r() * 36, r() < 0.5 ? "#2a2622" : "#4a4440"); }
        return img;
      }
      const jus = new Img(W, H), J = ell(104, 118, 80, 13, [[4, 0.18, 1], [7, 0.08, 2]], 3);
      jus.fill((x, y) => {
        const d = J(x + 0.5, y + 0.5);
        if (d > 1) return null;
        let c = pick(R(look.jus || ["#3a0c08", "#5a160c", "#7a2410", "#a03a18", "#c85a24"]), 0.15 + (1 - d) * 0.8, x, y, 0.3);
        if (d < 0.7 && (x * 3 + y * 7) % 23 === 0) c = "#ffd0a0";
        return c;
      });
      img.paste(jus, 0, 0);
      const m = new Img(W, H);
      slab(m, { cx: 186, cy: 74, rx: 33, ry: 21, thick: 12, s: 1.5, seed: 5, done: 1, glaze: 1, look });
      img.paste(m, 0, 0);
      geo("inside", look.pink || P.pink);
      // sliced across and fanned out like shingles, each slice leaning on the last: seared top and bottom, a grey band, rosy in the middle
      for (let i = 0; i < 5; i++) {
        const sx = 40 + i * 21, sy = 98 + i * 4 - Math.abs(i - 2) * 2, ang = -0.42 + i * 0.16;
        item("s" + i, sx, sy, 16, "slice", { z: i, box: [sx - 20, sy - 14, sx + 20, sy + 14] });
        if (taken("s" + i)) continue;
        shadow(img, sx + 3, sy + 8, 18, 4, 0.4, "#1a0806");
        steakSlice(img, sx, sy, 30, 15, ang, look, i);
      }
      flakes(img, 4, 50, 93, 69, 69, 21);
      if (look.pepper) peppers(img, 6, 80, 120, 80, 90, 24);
      butter(img, 186, 57, 0.5, 2, 1.5);
      if (spec.garnish === "moonpetal") { moonpetal(img, 207, 51, 1.6, 4); moonpetal(img, 165, 54, 1.2, 5, false); }
      else herbSprig(img, 200, 52, 1.5, 4);
      for (const [x, y, sd] of [[213, 108, 2], [198, 117, 4], [30, 126, 3]]) garlic(img, x, y, sd, 1.5);
      return img;
    },
  };
  function herbSprig(img, x, y, s, seed) {
    const r = rng(seed);
    img.line(x - 8 * s, y + 7 * s, x, y, "#3a5a24");
    for (let k = 0; k < 7; k++) {
      const t = k / 7, bx = lerp(x - 8 * s, x, t), by = lerp(y + 7 * s, y, t), side = k % 2 ? 1 : -1;
      for (let j = 0; j < 3 * s; j++) img.px(bx + side * j * 0.7, by - j * 0.6 - r(), j < 1 ? "#4a7a2a" : j < 2 * s ? "#6aa040" : "#9ac860");
    }
  }

  // ---------- the haul: raw parts and the sides laid next to them ----------
  const PARTS = {};
  PARTS.drake_flank = (img, x, y, s, seed) => { slab(img, { cx: x, cy: y, rx: 50 * s, ry: 22 * s, thick: 9 * s, s: s * 1.2, seed: 3, done: 0, look: { scales: true } }); };
  PARTS.butter = (img, x, y, s, seed) => { leaf(img, x, y + 2 * s, 16 * s, 7 * s, seed); butter(img, x, y, 0, seed, s * 1.6); };
  PARTS.moonpetal = (img, x, y, s, seed) => { moonpetal(img, x, y, s * 1.25, seed); moonpetal(img, x + 9 * s, y + 5 * s, s * 0.9, seed + 1, false); };
  PARTS.salt = (img, x, y, s, seed) => saltPouch(img, x, y, seed, s);
  PARTS.garlic = (img, x, y, s, seed) => garlicBulb(img, x, y, seed, s * 1.3);
  PARTS.scale = (img, x, y, s, seed) => drakeScale(img, x, y, s * 1.5, seed);
  function leaf(img, x, y, rx, ry, seed) {
    const lay = new Img(img.w, img.h), E = ell(x, y, rx, ry, [[2, 0.12, 0]], seed);
    hrender(lay, [x - rx - 1, y - ry - 1, x + rx + 1, y + ry + 1], (xx, yy) => { const d = E(xx, yy); return d > 1 ? null : (1 - d) * 3; },
      (xx, yy, i) => (Math.abs(yy - y - (xx - x) * 0.05) < 0.6 ? "#a8cc78" : pick(P.leaf, 0.2 + i.diff * 0.7, xx, yy)));
    outline(lay, "#0e1a08");
    img.paste(lay, 0, 0);
  }
  function genericPart(img, x, y, s, seed) {
    const lay = new Img(img.w, img.h), E = ell(x, y, 12 * s, 9 * s, [[3, 0.1, 0.5]], seed);
    hrender(lay, [x - 14 * s, y - 11 * s, x + 14 * s, y + 11 * s], (xx, yy) => { const d = E(xx, yy); return d > 1 ? null : Math.sqrt(1 - d * d) * 7 * s; },
      (xx, yy, i) => pick(P.cloth, 0.1 + i.diff * 0.9, xx, yy));
    outline(lay, "#140a06");
    img.paste(lay, 0, 0);
  }
  function part(id, img, x, y, s, seed, spec) { (PARTS[id] || genericPart)(img, x, y, s || 1, seed || 1, spec); }

  // ---------- each dish: its plate, its colours, what's laid beside it ----------
  const LOOKS = {
    drake: { scales: true, garnish: "moonpetal" },
    beef: { jus: ["#2a0c06", "#4a1a0a", "#6a2a10", "#8a4018", "#b05a24"] },
    yeti: { pepper: 0.16, raw: R(["#40121a", "#661a26", "#8e2c36", "#b04048", "#cc5a5c", "#e47a76", "#f49e94"]), fat: R(["#c8b8ac", "#e0d4ca", "#f2eae2", "#ffffff"]) },
    // the fish specials (league/content/food.py CATCH_DISHES): a whole fish's skin raw and cooked, back and belly, its fins and flesh
    pike: { cardK: 1, fish: { rawBack: R(["#101808", "#1c2a0c", "#2c4014", "#3e561c", "#546e26", "#6e8a34"]), rawBelly: R(["#5a5a3a", "#86825a", "#b4ac80", "#dad2a8", "#f2ecd0"]),
      back: R(["#141206", "#26220c", "#3a3414", "#50481c", "#6a5e26", "#867834", "#a49648"]), belly: R(["#6a5a34", "#94804c", "#bca46a", "#dcc690", "#f2e2b8"]),
      spot: R(["#8a8044", "#b8aa5e", "#dccc80", "#f4e4a0"]), fin: R(["#2a1a08", "#4a2e10", "#74481a", "#a06424", "#c88834", "#e8ac50"]) } },
    grayling: { cardK: 1, fish: { rawBack: R(["#16181c", "#2a2e34", "#444a50", "#626a6a", "#86887c", "#aeac90"]), rawBelly: R(["#7a7a70", "#a4a496", "#c8c8b8", "#e4e2d4", "#f8f6ec"]),
      back: R(["#2a1806", "#4a2c0a", "#704412", "#9a641e", "#c48a30", "#e4b04c", "#f8d47a"]), belly: R(["#8a6a30", "#b89048", "#dcb468", "#f2d490", "#fff0c0"]),
      fin: R(["#1c0a12", "#321422", "#4a2032", "#622e44", "#7c3e56", "#96526a"]), finSpot: "#f0a0b4", finEdge: R(["#4a0806", "#7a140c", "#a82216", "#d03a20"]),
      fin2: R(["#2a2008", "#4a3a10", "#6e581c", "#94782a", "#b89a40", "#d8bc60"]), speckN: 0.975 } },
    goldcarp: { cardK: 1, fish: { rawBack: R(["#4a2202", "#7a3c04", "#ac6008", "#d88a12", "#f4b42a", "#ffdc70"]), rawBelly: R(["#b88c40", "#dcb060", "#f2d488", "#fff0bc"]),
      back: R(["#2e1402", "#562804", "#844008", "#b0620e", "#d8881a", "#f0b032", "#fcd868"]), belly: R(["#9a6414", "#c48a24", "#e4b040", "#f6d470", "#fff0b0"]),
      fin: R(["#4a1c04", "#7a3008", "#a84c10", "#d06e1c", "#f09a34", "#ffc464"]), glaze: true } },
    trout: { cardK: 1, fish: { rawBack: R(["#16160c", "#2a2816", "#444022", "#625a30", "#847a44", "#a89c5c"]), rawBelly: R(["#8a8468", "#b0aa8a", "#d0caa8", "#ece6cc", "#fbf8ec"]),
      back: R(["#1e1206", "#36220c", "#523614", "#704c1e", "#90662a", "#b0843c", "#d0a65a"]), belly: R(["#8a6a3a", "#b08c54", "#d0ae74", "#ead098", "#fbecc4"]),
      fin: R(["#24160a", "#3e2812", "#5e3e1c", "#7e5828", "#a07438", "#c0944e"]), speck: "#1a0e06", red: "#d0401e" } },
    mackerel: { cardK: 1, fish: { rawBack: R(["#04121a", "#08222c", "#0e3640", "#164c54", "#20686a", "#348a80"]), rawBelly: R(["#6a7078", "#9aa0a8", "#c4cad0", "#e4e8ec", "#ffffff"]),
      back: R(["#030608", "#08141a", "#0e2428", "#163638", "#224c48", "#346a5c"]), belly: R(["#4a4434", "#7a705a", "#a89c80", "#d0c6aa", "#f0e8d4"]),
      fin: R(["#06080a", "#121a1e", "#1e2c30", "#2e4244", "#465c5a"]), bar: "#020404", char: 0.62, grill: true,
      ash: R(["#2a2826", "#4a4642", "#6a6560", "#8a847c", "#aaa49a"]) } },
    legend: { cardK: 1, fish: { rawBack: R(["#06101a", "#0c1c2a", "#14303e", "#1e4852", "#2c6466", "#428a80"]), rawBelly: R(["#3a4a4a", "#5e7270", "#86a098", "#b4ccc0", "#e0f0e4"]),
      back: R(["#040506", "#0a0c0e", "#121618", "#1c2224", "#283230", "#38463e"]), belly: R(["#160f0a", "#2a1e14", "#42301e", "#5c462c", "#7a603c", "#9a7c4e"]),
      fin: R(["#060404", "#140a08", "#24120c", "#3a1e12", "#56301a", "#784824"]), sheen: "#5ad0b4", char: 0.6, eyeC: "gold" } },
    salmon: { plank: { flesh: R(["#6a1e0e", "#a03a1a", "#cc5a2a", "#e8803e", "#f8a462", "#ffc890"]), fat: "#ffe2c8", pins: "twig" } },
    char: { cardK: 1, fish: { rawBack: R(["#0e1416", "#1a2428", "#2a383a", "#3e4e4c", "#56665e"]), rawBelly: R(["#6a1a0a", "#9a2c10", "#c84a1c", "#e8702e", "#fc9a50"]),
      back: R(["#0e0c08", "#1c1810", "#2e2818", "#443c22", "#5e5230", "#786a40"]), belly: R(["#5a1406", "#8a240c", "#b43c16", "#d85c24", "#f07e3a", "#ffa460"]),
      spot: R(["#c8a888", "#e2c8a8", "#f4e2c8", "#fff4e4"]), fin: R(["#2a0e06", "#4a1a0a", "#7a2c12", "#a8441c", "#d0662c"]), fin2: R(["#3a0e06", "#6a1c0a", "#a03414", "#cc5220", "#ee7a3a"]) } },
    moonfish: { cardK: 1, steak: { skin: R(["#1e2232", "#3a4258", "#62708a", "#94a2b8", "#c8d2e0", "#f4f8ff"]), raw: R(["#8e8c9c", "#b0aebc", "#cecbd6", "#e6e4ec", "#f8f6fc"]),
      flesh: R(["#a49a92", "#c6bab0", "#e2d8cc", "#f4ece4", "#fffaf4", "#ffffff"]), sear: R(["#3a2210", "#64401e", "#906230", "#ba8a4c", "#dcb478"]), glow: "#cfe2ff" } },
    crystal: { broth: R(["#4a6a5e", "#6a8e7c", "#90b49c", "#b8d4b6", "#dcecce", "#f6fff0"]), hi: "#ffffff", dot: "#fffff0", oil: 0.12, ware: "glaze", herbN: 70, herbC: "#4a8a2a", clear: true, glowC: "#b8ffe0", bowlRx: 104, bowlRy: 44,
      bits: [["eelcoil", 6, 13], ["leafy", 7, 4]], sprig: true, cardK: 1, drop: 2.6 },
    lantern: { cardK: 1, fry: { kind: "minnows", vessel: "plate", glow: "#d8ff5a", batter: R(["#3a2604", "#664408", "#946a12", "#c0921e", "#e2b838", "#f6dc6c", "#fff8be"]) } },
  };
  const DISH = {
    spice_pilaf: { look: { vessel: "platter", ware: "glaze", mound: 22 } },
    drake_steak: { parts: ["drake_flank"], sides: ["butter", "moonpetal", "salt", "scale"], hop: ["garlic", "garlic"], garnish: "moonpetal" },
  };
  // league/content/food.py SIDES is the source; the record carries them, these only cover an old record
  const SIDES = { iron: ["butter", "moonpetal", "salt"], pot: ["roots", "herbs", "garlic"], steam: ["kelp", "lid", "salt"], spit: ["salt", "herbs", "fat"], embers: ["leaves", "clay", "salt"], cold: ["knife", "berries", "salt"] };
  const HOP = { iron: ["garlic"], pot: ["roots", "herbs"], steam: ["kelp"], spit: ["salt", "herbs"], embers: [], cold: ["berries"] };
  const FAMILY_PLATE = { steak: "slab", roast: "roast", stew: "stew", fried: "crisps", seafood: "fillet", grain: "pilaf", bread: "bun", sweet: "sweet", soup: "soup", skewer: "skewer", pie: "pie", greens: "salad", legendary: "roast" };
  const METHOD_OF = { slab: "iron", roast: "spit", skewer: "spit", sausage: "iron", crisps: "iron", bun: "iron", fillet: "iron", claws: "steam", pie: "embers", stew: "pot", soup: "pot", pilaf: "pot", porridge: "pot", sweet: "pot", jelly: "cold", ice: "cold", salad: "cold" };
  function dish(rec) {
    const d = DISH[rec.dish] || {};
    let plate = rec.plate || d.plate || FAMILY_PLATE[rec.family] || "stew";
    if (!PLATES[plate]) plate = PLATES[FAMILY_PLATE[rec.family]] ? FAMILY_PLATE[rec.family] : "slab";
    const pal = rec.pal || d.pal || plate;
    const look = Object.assign({}, LOOKS[pal] || {}, d.look || {});
    const method = rec.method || d.method || METHOD_OF[plate] || "pot";
    return Object.assign({ id: rec.dish, name: rec.name, plate, pal, look, method, legendary: !!rec.legendary, garnish: look.garnish, sides: rec.sides || SIDES[method] || SIDES.pot, hop: HOP[method], parts: [] }, d, { look });
  }
  // every plate draws raw, cook and burnt; the ones that sear and baste on their own say so, the rest borrow the nearest stage
  function piece(spec) {
    const p = (PLATES[spec.plate] || PLATES.slab).piece(spec), has = p.stages || (spec.plate === "slab" ? ["raw", "sear", "cook", "baste", "burnt"] : ["raw", "sear", "cook", "burnt"]);
    return Object.assign({}, p, { flip: p.flip !== undefined ? p.flip : ["slab", "bun", "stew"].includes(spec.plate) && spec.method === "iron",
      draw(img, o) { const st = has.includes(o.stage) ? o.stage : { sear: "raw", baste: "cook" }[o.stage] || "cook"; p.draw(img, Object.assign({ f: { cx: o.cx, cy: o.cy, rx: 70 * (o.s || 1), ry: 28 * (o.s || 1) } }, o, { stage: st, real: o.stage })); } });
  }
  // o.eat: { gone: [keys], zones: [[x, y, r]], carved } draws the dish part-eaten; o.info gets { items, geo } back
  function plate(spec, stage, o) {
    o = o || {};
    const P0 = PLATES[spec.plate] || PLATES.slab;
    const was = EAT;
    EAT = o.eat || o.info ? { gone: new Set((o.eat && o.eat.gone) || []), zones: (o.eat && o.eat.zones) || [], carved: (o.eat && o.eat.carved) || 0, bites: (o.eat && o.eat.bites) || [], items: [], geo: {} } : null;
    let img;
    try { img = P0.serve(spec, { burnt: stage === "burnt", seed: o.seed || 1, legendary: o.legendary }); } finally { if (o.info && EAT) { o.info.items = EAT.items; o.info.geo = EAT.geo; } EAT = was; }
    if (o.legendary) showpiece(img);
    vignette(img, o.legendary ? 0.45 : 0.55);
    return img;
  }

  // a legendary meal is a showpiece: a gold halo behind it and gold filigree in the corners of the shot
  function showpiece(img) {
    light(img, 120, 70, 150, "#ffcf6a", 0.2, 90);
    const G = P.gold;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const ox = sx > 0 ? 2 : W - 3, oy = sy > 0 ? 2 : H - 3;
      for (let k = 0; k < 26; k++) { img.px(ox + sx * k, oy, pick(G, 0.7 - k / 60, k, 0)); img.px(ox, oy + sy * k, pick(G, 0.7 - k / 60, 0, k)); }
      for (let a = 0; a < 1.6; a += 0.04) { const r = 9 + a * 3; img.px(ox + sx * (6 + Math.cos(a) * r * 0.6), oy + sy * (6 + Math.sin(a) * r * 0.6), G[4]); }
      img.rect(ox + sx * 4 - (sx < 0 ? 1 : 0), oy + sy * 4 - (sy < 0 ? 1 : 0), 2, 2, G[5]);
    }
  }

  root.FoodArt = root.FoodArt || {};
  Object.assign(root.FoodArt, {
    W, H, dish, piece, plate, part, PLATES, PARTS, DISH, LOOKS,
    kit: { W, H, Img, C, mix, R, pick, rng, hash, h2, vnoise, fbm, bay, clamp, lerp, smooth, TAU, hrender, ell, dome, norm3, KEY, glow, light, vignette, bokeh, steam, star, outline, rimShade, notchAt, shadow, text, textWidth, CAP, P, BURNT, taken, item, geo, eating },
    bits: { slab, sliceFace, scaleStrip, butter, garlic, garlicBulb, moonpetal, flakes, peppers, saltPouch, drakeScale, skillet, skilletWide, board, macroBack },
  });
})(typeof window !== "undefined" ? window : globalThis);
