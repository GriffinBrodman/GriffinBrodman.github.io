/* Shaded pixel painter (Dragon Aquarium technique: material + shade + layer buffers, hue-shifted ramps,
   ordered dither at ramp boundaries, internal outlines between layers) and the hero bust portraits. */
(function () {
  "use strict";
  const { Grid, mix, hash, rng } = Art;

  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function toHsv(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, mx ? d / mx : 0, mx];
  }
  function hsv(h, s, v) {
    h = ((h % 1) + 1) % 1; s = Math.max(0, Math.min(1, s)); v = Math.max(0, Math.min(1, v));
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    const c = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
    return "#" + c(r) + c(g) + c(b);
  }
  // shadows drift toward violet, highlights toward warm yellow
  function toward(h, target, amt) { let d = target - h; if (d > 0.5) d -= 1; if (d < -0.5) d += 1; return h + Math.sign(d) * Math.min(Math.abs(d), amt); }
  const rcache = {};
  function ramp(hex) {
    if (rcache[hex]) return rcache[hex];
    const [h, s, v] = toHsv(hex);
    const lowSat = s < 0.12;
    const r = [
      hsv(toward(h, 0.72, 0.06), lowSat ? s + 0.08 : s * 1.08, v * 0.5),
      hsv(toward(h, 0.72, 0.025), lowSat ? s + 0.04 : s * 1.02, v * 0.74),
      hex,
      hsv(toward(h, 0.13, 0.03), s * 0.78, v * 1.18 + 0.06),
    ];
    rcache[hex] = r;
    return r;
  }
  const BAYER = [0, 0.5, 0.75, 0.25];

  class Paint {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.mat = new Array(w * h).fill(null);
      this.sh = new Float32Array(w * h);
      this.lay = new Uint8Array(w * h);
      this.layer = 1; this.bias = 0; this.tf = null;
    }
    // optional design-space transform: X = ox + (x - cx) * s
    T(x, y) { const t = this.tf; return t ? [t.ox + (x - t.cx) * t.s, t.oy + (y - t.cy) * t.s] : [x, y]; }
    inv(X, Y) { const t = this.tf; return t ? [Math.round(t.cx + (X + 0.5 - t.ox) / t.s - 0.5), Math.round(t.cy + (Y + 0.5 - t.oy) / t.s - 0.5)] : [X, Y]; }
    px(x, y, m, s) {
      if (this.tf) { [x, y] = this.T(x + 0.5, y + 0.5); }
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = y * this.w + x;
      this.mat[i] = m; this.sh[i] = (s || 0) + this.bias; this.lay[i] = this.layer;
    }
    has(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.mat[y * this.w + x] !== null; }
    matAt(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.mat[y * this.w + x] : null; }
    erase(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.mat[y * this.w + x] = null; }
    // lit volume: light from the upper left; fn(x, y, s) may return false to skip or a number to adjust shade
    ell(cx, cy, rx, ry, m, o) {
      o = o || {};
      const k = o.k == null ? 1 : o.k, s0 = o.s || 0, tf = this.tf;
      if (tf) { [cx, cy] = this.T(cx, cy); rx *= tf.s; ry *= tf.s; this.tf = null; }
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
        if (d > 1) continue;
        let s = s0 + k * (0.15 - nx * 0.55 - ny * 0.6 + (1 - d) * 0.25);
        if (o.fn) {
          this.tf = tf; const [dx, dy] = this.inv(x, y); this.tf = null;
          const r = o.fn(dx, dy, s, nx, ny); if (r === false) continue; if (typeof r === "number") s = r;
        }
        this.px(x, y, m, s);
      }
      this.tf = tf;
    }
    poly(pts, m, sfn) {
      const tf = this.tf;
      if (tf) {
        pts = pts.map((p) => this.T(p[0], p[1]));
        if (typeof sfn === "function") { const f = sfn; sfn = (x, y) => { this.tf = tf; const [a, b] = this.inv(x, y); this.tf = null; return f(a, b); }; }
        this.tf = null;
        try { return this.poly(pts, m, sfn); } finally { this.tf = tf; }
      }
      const ys = pts.map((p) => p[1]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
        const xs = [], yc = y + 0.5;
        for (let i = 0; i < pts.length; i++) {
          const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
          if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
          const s = typeof sfn === "function" ? sfn(x, y) : sfn || 0;
          if (s !== false) this.px(x, y, m, s);
        }
      }
    }
    rect(x, y, w, h, m, s) {
      if (this.tf) {
        const tf = this.tf, [x0, y0] = this.T(x, y), [x1, y1] = this.T(x + w, y + h);
        this.tf = null;
        for (let Y = Math.round(y0); Y < Math.max(Math.round(y0) + 1, Math.round(y1)); Y++) for (let X = Math.round(x0); X < Math.max(Math.round(x0) + 1, Math.round(x1)); X++) {
          this.tf = tf; const [a, b] = this.inv(X, Y); this.tf = null;
          this.px(X, Y, m, typeof s === "function" ? s(a, b) : s || 0);
        }
        this.tf = tf;
        return;
      }
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, m, typeof s === "function" ? s(x + i, y + j) : s || 0);
    }
    line(x0, y0, x1, y1, m, s, r) {
      if (this.tf) {
        const tf = this.tf;
        [x0, y0] = this.T(x0, y0); [x1, y1] = this.T(x1, y1);
        this.tf = null;
        try { return this.line(x0, y0, x1, y1, m, s, r ? r * tf.s : r); } finally { this.tf = tf; }
      }
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        if (r) this.ell(x, y, r, r, m, { s: s || 0, k: 0.6 }); else this.px(x, y, m, typeof s === "function" ? s(t) : s || 0);
      }
    }
    tube(pts, r0, r1, m, s) {
      for (let i = 0; i < pts.length; i++) { const t = i / Math.max(1, pts.length - 1); this.ell(pts[i][0], pts[i][1], r0 + (r1 - r0) * t, r0 + (r1 - r0) * t, m, { s: s || 0, k: 0.8 }); }
    }
    shadeWhere(test, ds) {
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (this.mat[i] === null) continue;
        const [a, b] = this.inv(x, y);
        if (test(a, b, this.mat[i], this.lay[i])) this.sh[i] += typeof ds === "function" ? ds(a, b) : ds;
      }
    }
    // mats: key -> 4-step ramp, or a literal "#rrggbb" colour
    render(mats, o) {
      o = o || {};
      const g = new Grid(this.w, this.h), W = this.w, outline = o.outline || "#16121a";
      const col = (m) => (m[0] === "#" ? null : mats[m] || ramp("#ff00ff"));
      for (let y = 0; y < this.h; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, m = this.mat[i];
        if (m === null) {
          if (o.outer !== false && (this.has(x - 1, y) || this.has(x + 1, y) || this.has(x, y - 1) || this.has(x, y + 1))) g.px[i] = outline;
          else if (o.bg) g.px[i] = o.bg(x, y);
          continue;
        }
        const r = col(m);
        if (!r) { g.px[i] = m; continue; }
        const s = this.sh[i] + (BAYER[(x & 1) + (y & 1) * 2] - 0.375) * 0.22;
        const idx = s < -0.55 ? 0 : s < -0.1 ? 1 : s < 0.5 ? 2 : 3;
        let c = r[idx];
        const l = this.lay[i];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= this.h) continue;
          const j = ny * W + nx;
          if (this.mat[j] !== null && this.lay[j] > l + (o.gap || 0) && this.mat[j] !== m && this.mat[j][0] !== "#") { c = mix(r[0], outline, 0.4); break; }
        }
        g.px[i] = c;
      }
      if (o.outer !== false && o.bg) for (let y = 0; y < this.h; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (g.px[i] === outline && (x === 0 || y === 0 || x === W - 1)) g.px[i] = o.bg(x, y);
      }
      return g;
    }
  }

  // ---------- bust portraits ----------
  const PW = 40, PH = 40;
  const EYES = ["#5a3a22", "#3a6a9a", "#4a7a3a", "#6a6a72", "#9a6a22", "#2a2a30"];
  const METAL = { 1: "#6e665e", 2: "#7a828c", 3: "#8e9aa6", 4: "#a2acb8", 5: "#86b4cc" };
  const AURA = Art.AURA;
  const COVERS = new Set(["great_helm", "skull_helm", "hood", "skull_hood", "beast_hood", "helm", "top_hat", "mitre", "tricorn", "bandana", "feather_cap"]);
  const FULL = new Set(["great_helm", "skull_helm"]);

  function setup(h, clsLook) {
    const look = h.look, r = rng(hash(h.id || h.name || "x") + 17), cx = 20;
    const scars = look.scars || [], head = clsLook.head || "none", outfit = clsLook.outfit || "leather";
    const pale = scars.includes("pale"), skinHex = pale ? mix(look.skin, "#c8ccd8", 0.35) : look.skin;
    const metal = METAL[Math.max(1, Math.min(5, h.armor_tier || h.weapon_tier || 1))];
    const mats = {
      skin: ramp(skinHex), hair: ramp(look.hair), fav: ramp(look.fav), favd: ramp(mix(look.fav, "#1a1622", 0.45)), metal: ramp(metal), dmetal: ramp("#4a4656"),
      leather: ramp("#7a5034"), dleather: ramp("#4e3424"), fur: ramp("#a88a64"), cream: ramp("#e4dac4"), gold: ramp("#d8a838"),
      wood: ramp("#7a5232"), bone: ramp("#d8d0bc"), cloth: ramp(mix(look.fav, "#3a3440", 0.55)), lip: ramp(mix(skinHex, "#a0403a", 0.35)), stub: ramp(mix(skinHex, look.hair, 0.45)),
      leaf: ramp("#5a9a3a"), ice: ramp("#9ad8f0"), flame: ramp("#f08a2a"), horn: ramp("#d8ccb0"), antler: ramp("#8a6a48"), feather: ramp("#ece6d6"),
      wmetal: ramp(METAL[Math.max(1, Math.min(5, h.weapon_tier || 1))]), boot: ramp("#5a3a26"), pants: ramp("#4e4250"),
    };
    const c = { h, look, r, cx, scars, head, outfit, pale, mats, st: look.style };
    c.faceW = 6.5 + r() * 1.1; c.jawW = c.faceW - 0.9 - r() * 0.7; c.chin = 24.6 + r() * 0.8;
    c.pointy = r() < 0.28; c.freckles = r() < 0.2 && toHsv(look.skin)[2] > 0.8; c.eye = EYES[Math.floor(r() * EYES.length)];
    c.gaze = r() < 0.5 ? 1 : -1; c.bigNose = r() < 0.35; c.browUp = r() < 0.3; c.tusks = look.skin === "#9cc48a" && r() < 0.7;
    c.covered = COVERS.has(head); c.full = FULL.has(head);
    c.v = hash((clsLook.cn || "") + outfit + (clsLook.aura || "") + (clsLook.offhand || ""));
    c.aura = clsLook.aura;
    c.glint = head === "skull_helm" || clsLook.aura === "death" ? "#8af09a" : clsLook.aura === "holy" ? "#fff2a0" : clsLook.aura === "fire" || clsLook.aura === "rage" ? "#ffb04a" : null;
    c.inHead = (x, y) => ((x + 0.5 - cx) / c.faceW) ** 2 + ((y + 0.5 - 15.5) / 8) ** 2 <= 1 || ((x + 0.5 - cx) / c.jawW) ** 2 + ((y + 0.5 - 19.5) / (c.chin - 19.5)) ** 2 <= 1;
    c.hairTex = (x, y) => ((x * 2 + y * 3 + (x >> 2)) % 5 === 0 ? -0.35 : 0);
    return c;
  }

  function headBack(P, c) {
    const { cx, head, covered, st, hairTex } = c;
    P.layer = 1;
    if (head === "halo") for (let a = 0; a < 40; a++) { const t = (a / 40) * Math.PI * 2; P.px(cx + Math.cos(t) * 9.5, 9 + Math.sin(t) * 3, "#ffe88a", 0); }
    if (!covered && (st === 1 || st === 6)) P.poly([[cx - 8, 10], [cx + 8, 10], [cx + 10, st === 1 ? 33 : 26], [cx - 10, st === 1 ? 33 : 26]], "hair", (x, y) => -0.3 + hairTex(x, y) - (y - 10) * 0.02);
    if (!covered && st === 2) P.ell(cx + 8.5, 19, 2.6, 6.5, "hair", { s: -0.25, fn: (x, y, s) => s + hairTex(x, y) });
  }

  // layers 3-7: neck, ears, head, facial hair, hair, headgear; features=false skips the 1px face details (drawn natively when scaled)
  function headFront(P, c, features) {
    const { cx, faceW, jawW, look, scars, head, inHead, hairTex, gaze, pale, full, covered, st } = c;
    P.layer = 3;
    P.rect(cx - 3, 22, 6, 7, "skin", (x, y) => (y < 25 ? -0.7 : -0.25) - (x - cx) * 0.08);
    for (const side of [-1, 1]) {
      const ex = cx + side * (faceW + 0.4);
      if (c.pointy) P.poly([[ex - side * 1.2, 14.5], [ex + side * 3.8, 11.5], [ex + side * 0.8, 19.5], [ex - side * 1.2, 19]], "skin", side < 0 ? 0.1 : -0.35);
      else P.ell(ex, 17, 1.6, 2.4, "skin", { s: side < 0 ? 0 : -0.3, k: 0.5 });
      if (features) P.px(ex + side * 0.2, 17, "skin", -0.8);
    }
    P.layer = 4;
    for (let y = 6; y < 28; y++) for (let x = 10; x < 30; x++) {
      if (!inHead(x, y)) continue;
      const nx = (x + 0.5 - cx) / faceW, ny = (y + 0.5 - 16) / 9.5;
      P.px(x, y, "skin", 0.25 - nx * 0.6 - ny * 0.35 - Math.max(0, Math.abs(nx) - 0.7) * 1.2 - Math.max(0, ny - 0.75) * 1.4);
    }
    const ey = 17, lx = cx - 4, rx2 = cx + 2;
    if (features) {
      for (const ex of [lx, rx2]) {
        P.px(ex, ey - 1, "skin", -0.45); P.px(ex + 1, ey - 1, "skin", -0.45);
        const iris = gaze > 0 ? ex + 1 : ex;
        P.px(iris === ex ? ex + 1 : ex, ey, "#e6dccf");
        P.px(iris, ey, pale ? "#b8c8e8" : c.eye);
        P.px(ex, ey + 1, "skin", -0.15); P.px(ex + 1, ey + 1, "skin", -0.15);
      }
      if (pale) { P.px(lx, ey + 1, "skin", -0.7); P.px(rx2 + 1, ey + 1, "skin", -0.7); }
      const by = c.browUp ? ey - 3 : ey - 2;
      for (const [bx, dir] of [[lx - 1, 1], [rx2, -1]]) for (let i = 0; i < 3; i++) P.px(bx + i, by + (dir > 0 ? (i === 0 ? 1 : 0) : (i === 2 ? 1 : 0)), "hair", -0.6);
      P.px(cx - 1, 18, "skin", 0.55); P.px(cx, 18, "skin", -0.2); P.px(cx, 19, "skin", -0.45);
      P.px(cx - 1, 20, "skin", 0.25); P.px(cx, 20, "skin", -0.65); P.px(cx + 1, 20, "skin", -0.75);
      if (c.bigNose) { P.px(cx - 1, 19, "skin", 0.5); P.px(cx - 2, 20, "skin", -0.3); }
      for (let x = cx - 2; x <= cx + 1; x++) P.px(x, 22, "lip", x === cx + 1 ? -0.7 : -0.6);
      P.px(cx - 1, 23, "lip", 0.3); P.px(cx, 23, "lip", 0.05);
      if (c.tusks) { P.px(cx - 3, 22, "#efe8d4"); P.px(cx + 2, 22, "#efe8d4"); P.px(cx - 3, 21, "#d8d0bc"); P.px(cx + 2, 21, "#d8d0bc"); }
      if (c.freckles) for (const [x, y] of [[lx - 1, 19], [lx + 1, 19], [lx, 20], [rx2 + 1, 19], [rx2 + 2, 20], [rx2, 20]]) P.px(x, y, "skin", -0.6);
      if (scars.includes("scar")) for (let i = 0; i < 5; i++) P.px(lx - 1 + i * 0.6, 14 + i * 1.4, "#a85048");
      if (scars.includes("burn")) for (const [x, y] of [[rx2 + 1, 19], [rx2 + 2, 19], [rx2 + 2, 20], [rx2 + 3, 20], [rx2 + 1, 21], [rx2 + 3, 18]]) P.px(x, y, (x + y) % 2 ? "#b8685a" : "#9a4a44");
    }
    if (scars.includes("eyepatch")) { P.line(cx - faceW, 13, cx + faceW, 15.5, "#2a2224"); P.rect(rx2, ey - 1, 2, 3, "#1e1a1c"); }
    if (!full) {
      if (look.face === 1 && features) for (let y = 20; y < 27; y++) for (let x = 12; x < 29; x++) {
        const edge = !inHead(x, y + 2) || !inHead(x - 2, y) || !inHead(x + 2, y) || (y === 21 && x >= cx - 3 && x <= cx + 2);
        if (inHead(x, y) && edge && (x + y) % 2 === 0 && !(y >= 22 && y <= 23 && x >= cx - 2 && x <= cx + 1)) P.px(x, y, "stub", x > cx ? -0.3 : 0);
      }
      P.layer = 5;
      if (look.face === 2) {
        P.ell(cx, 23.2, jawW + 0.9, 5.6, "hair", { s: -0.05, fn: (x, y, s) => (y < 20.5 || (y === 21 && x > cx - 4 && x < cx + 3) ? false : s + hairTex(x, y) + (y > 25 ? 0 : 0.1)) });
        if (features) { for (let x = cx - 2; x <= cx + 1; x++) P.px(x, 22, "lip", -0.75); P.px(cx - 3, 21, "hair", 0.2); P.px(cx + 2, 21, "hair", -0.2); }
      }
      if (look.face === 3) { for (let x = cx - 3; x <= cx + 2; x++) P.px(x, 21, "hair", x < cx ? 0.1 : -0.3); P.px(cx - 4, 22, "hair", -0.2); P.px(cx + 3, 22, "hair", -0.4); }
    }
    P.layer = 6;
    if (!covered || head === "helm" || head === "bandana" || head === "feather_cap") hairTop(P, st, cx, faceW, c.r, hairTex, covered);
    P.layer = 7;
    headgear(P, head, cx, faceW, look, inHead, c);
    if (head === "helm" || full) rimLight(P, 7);
    if (head === "hood" || head === "skull_hood" || head === "beast_hood") P.shadeWhere((x, y, m, l) => l <= 6 && l >= 3 && y < 17, (x, y) => (y < 14 ? -0.45 : -0.2));
    if (head === "skull_hood" && features) { P.px(lx + (gaze > 0 ? 1 : 0), ey, "#8af09a"); P.px(rx2 + (gaze > 0 ? 1 : 0), ey, "#8af09a"); }
  }

  function portrait(h, clsLook, opts) {
    opts = opts || {};
    const c = setup(h, clsLook), P = new Paint(PW, PH), { cx, look, mats } = c;
    P.tf = { ox: 20, oy: 17.5, cx: 20, cy: 15.5, s: 1 };
    headBack(P, c);
    P.layer = 1;
    backGear(P, h.weapon, clsLook.offhand);
    P.layer = 2;
    torso(P, c.outfit, cx, c.r);
    headFront(P, c, true);
    const aura = clsLook.aura || (h.legend ? "gold" : null);
    const ac = aura ? AURA[aura] || AURA.arcane : null;
    const fav = toHsv(look.fav);
    const bgBase = hsv(fav[0], 0.25, 0.16), bgGlow = ac ? mix(ac[0], "#1a1620", 0.72) : hsv(fav[0], 0.3, 0.22);
    const bg = opts.bg === false ? null : (x, y) => {
      const d = Math.hypot((x - cx) / 20, (y - 15) / 18);
      const t = Math.max(0, 1 - d) + (BAYER[(x & 1) + (y & 1) * 2] - 0.375) * 0.25;
      return t > 0.55 ? bgGlow : t > 0.3 ? mix(bgBase, bgGlow, 0.5) : bgBase;
    };
    P.tf = null;
    const g = P.render(mats, { bg, outline: "#120e14" });
    if (ac) {
      const rr = rng(hash(h.id || "a") + (opts.frame || 0) * 31);
      for (let y = 1; y < PH; y++) for (let x = 1; x < PW - 1; x++) {
        const i = y * PW + x;
        if (P.mat[i] !== null && P.mat[i - 1] === null && x > cx) continue;
        if (P.mat[i] !== null && x > cx + 2 && P.mat[i + 1] === null) g.px[i] = mix(g.px[i], ac[1], 0.55);
      }
      const near = (x, y, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (P.has(x + i, y + j)) return true; return false; };
      for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
        const i = y * PW + x;
        if (P.mat[i] !== null || near(x, y, 1)) continue;
        if (y > 30) continue;
        if (near(x, y, 2) && (x + y) % 2 === 0) g.px[i] = mix(g.px[i] || bgBase, ac[0], 0.3);
        else if (near(x, y, 3) && (x * 3 + y) % 4 === 0) g.px[i] = mix(g.px[i] || bgBase, ac[0], 0.18);
      }
      if (h.legend) for (const [sx, sy] of [[5 + (rr() * 3 | 0), 6], [33 - (rr() * 3 | 0), 4]]) {
        g.set(sx, sy, ac[1]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.set(sx + dx, sy + dy, mix(ac[0], bgBase, 0.3));
      }
    }
    return g;
  }

  // ---------- full-body sprites (28x34): native body, the portrait head scaled down, native face dots ----------
  const ROBES = new Set(["robe", "robe_dark", "vestments"]);
  function fullBody(o) {
    const h = { id: o.id, name: o.name, look: o.look, weapon: o.weapon, weapon_tier: o.weaponTier, armor_tier: o.armorTier, legend: o.legend };
    const cl = o.clsLook || {}, c = setup(h, cl), P = new Paint(28, 34), M = c.mats, outfit = c.outfit;
    const base = { robe: "fav", robe_dark: "favd", vestments: "cream", plate: "metal", chain: "metal", leather: "leather", fur: "leather", cloak: "cloth", fancy: "fav", vest: "cream" }[outfit] || "leather";
    const HT = { ox: 14, oy: 9.6, cx: 20, cy: 15.5, s: 0.66 };
    P.tf = HT; headBack(P, c); P.tf = null;
    P.layer = 1;
    if (outfit === "cloak" || outfit === "robe_dark" || cl.offhand === "banner") P.poly([[8, 17], [20, 17], [22.5, 32], [5.5, 32]], "favd", (x) => -0.2 - (x - 14) * 0.05);
    if (cl.offhand === "quiver") { P.rect(19, 11, 3, 9, "leather", (x) => 0.1 - (x - 19) * 0.2); for (const x of [19, 20, 21]) P.px(x, 10 - (x % 2), x === 20 ? "fav" : "feather", 0.2); }
    if (cl.offhand === "banner") { P.rect(23, 1, 1, 31, "wood", 0); P.poly([[24, 2], [28, 2], [28, 10], [26, 8.5], [24, 10]], "fav", (x, y) => 0.25 - (y - 2) * 0.06); }
    P.layer = 2;
    const peg = c.scars.includes("peg");
    if (!ROBES.has(outfit)) {
      const pm = outfit === "plate" ? "metal" : outfit === "fur" ? "leather" : "pants";
      P.rect(10, 25, 3, 6, pm, (x) => 0.15 - (x - 10) * 0.12);
      if (peg) P.rect(16, 25, 1, 7, "wood", 0); else P.rect(15, 25, 3, 6, pm, (x) => -0.2 - (x - 15) * 0.12);
      P.rect(9, 30, 4, 3, "boot", (x, y) => (y === 30 ? 0.3 : -0.1) - (x - 9) * 0.08);
      if (!peg) P.rect(15, 30, 4, 3, "boot", (x, y) => (y === 30 ? 0.1 : -0.3) - (x - 15) * 0.08);
    } else {
      P.poly([[9, 23], [19, 23], [21.5, 32.5], [6.5, 32.5]], base, (x, y) => 0.15 - (x - 14) * 0.07 + ((x === 13 || x === 16) && y > 26 ? -0.45 : 0));
      P.rect(8, 32, 4, 1, "boot", -0.2); P.rect(16, 32, 4, 1, "boot", -0.4);
    }
    P.poly([[8.5, 17], [19.5, 17], [19, 25.5], [9, 25.5]], base, (x, y) => 0.25 - (x - 13) * 0.08 - (y - 17) * 0.025 + (outfit === "chain" && (x + y * 2) % 3 === 0 ? -0.45 : 0));
    switch (outfit) {
      case "robe": case "robe_dark": P.poly([[12, 17], [16, 17], [14, 20]], "skin", -0.5); P.rect(9, 22, 10, 1, "gold", 0.2); break;
      case "vestments": P.rect(11, 17, 1, 13, "fav", 0.1); P.rect(16, 17, 1, 13, "fav", -0.2); P.rect(9, 22, 10, 1, "gold", 0); break;
      case "plate": P.rect(11, 20, 6, 7, "fav", (x) => 0.1 - (x - 11) * 0.08); P.rect(9, 24, 10, 1, "dleather", -0.1); P.px(13, 24, "gold", 0.3); break;
      case "chain": P.rect(10, 19, 8, 8, "fav", (x) => 0.1 - (x - 10) * 0.07); P.rect(9, 24, 10, 1, "dleather", 0); break;
      case "leather": P.line(9, 17, 18, 25, "dleather", -0.1); P.rect(9, 24, 10, 1, "dleather", -0.2); P.px(13, 24, "gold", 0.3); break;
      case "fur": for (let x = 8; x <= 19; x++) P.ell(x + 0.5, 17.6 + (x % 2) * 0.5, 1.2, 1.1, "fur", { s: 0.25 - (x - 13) * 0.05, k: 0.6 }); P.rect(9, 24, 10, 1, "fav", 0); break;
      case "cloak": P.rect(13, 18, 2, 7, "favd", -0.4); P.ell(13.5, 17.6, 1.4, 1.2, "gold", { s: 0.3 }); break;
      case "fancy": P.rect(12, 17, 4, 2, "cream", 0.2); for (const y of [20, 22, 24]) P.px(14, y, "gold", 0.4); P.rect(9, 25, 10, 1, "gold", 0); break;
      case "vest": P.poly([[8.5, 17], [12, 17], [12, 25.5], [9, 25.5]], "fav", 0.15); P.poly([[16, 17], [19.5, 17], [19, 25.5], [16, 25.5]], "fav", -0.3); P.px(12, 21, "gold", 0.3); break;
    }
    P.layer = 3;
    const sleeve = outfit === "plate" || outfit === "chain" ? "metal" : outfit === "fur" ? "skin" : outfit === "vestments" ? "cream" : outfit === "robe_dark" ? "favd" : outfit === "leather" ? "leather" : outfit === "cloak" ? "cloth" : base;
    P.rect(6, 17, 2, 7, sleeve, (x, y) => 0.35 - (y - 17) * 0.05 - (x - 6) * 0.25);
    P.rect(20, 17, 2, 7, sleeve, (x, y) => -0.15 - (y - 17) * 0.05 - (x - 20) * 0.25);
    if (outfit === "plate") for (const sx of [8, 19.5]) P.ell(sx, 17.6, 2.8, 2, "metal", { s: sx < 14 ? 0.25 : -0.1 });
    P.rect(6, 24, 2, 2, "skin", (x) => 0.2 - (x - 6) * 0.3);
    if (c.scars.includes("hook")) { P.px(21, 24, "#a8a8b0"); P.px(21, 25, "#c8c8d0"); P.px(20, 26, "#a8a8b0"); }
    else P.rect(20, 24, 2, 2, "skin", (x) => -0.2 - (x - 20) * 0.3);
    P.tf = HT; headFront(P, c, false); P.tf = null;
    P.layer = 7;
    if (!c.full) {
      const ec = c.head === "skull_hood" ? "#8af09a" : c.pale ? "#b8c8e8" : mix(c.eye, "#100c10", 0.55);
      P.px(12, 10, ec);
      if (!c.scars.includes("eyepatch")) P.px(15, 10, ec);
      if (!c.covered || c.head === "helm" || c.head === "bandana" || c.head === "feather_cap") for (const x of [11, 12, 15, 16]) P.px(x, 8, "hair", -0.6);
      P.px(14, 12, "skin", -0.6);
      if (c.look.face !== 2) { P.px(13, 13, "lip", -0.6); P.px(14, 13, "lip", -0.75); }
    } else { P.px(12, 10, c.glint || "#e6dccf"); P.px(15, 10, c.glint || "#e6dccf"); }
    P.layer = 8;
    heldWeapon(P, o.weapon, o.weaponTier || 1);
    heldOffhand(P, cl.offhand);
    let g = P.render(M, { outline: o.legend ? "#5a3a08" : "#16121a" });
    const aura = cl.aura || (o.legend ? "gold" : null);
    if (aura) {
      const ac = AURA[aura] || AURA.arcane, rr = rng(hash(aura) + (o.frame || 0) * 7919), edge = [];
      for (let y = 0; y < 34; y++) for (let x = 0; x < 28; x++) if (P.mat[y * 28 + x] === null && g.px[y * 28 + x]) edge.push([x, y]);
      for (let k = 0; k < (o.legend ? 5 : 3); k++) {
        const [x, y] = edge[Math.floor(rr() * edge.length)] || [0, 0];
        const nx = x + (rr() < 0.5 ? -1 : 1) * (1 + Math.floor(rr() * 2)), ny = y + (aura === "fire" || aura === "holy" ? -1 : rr() < 0.5 ? -1 : 1) * (1 + Math.floor(rr() * 2));
        if (!g.get(nx, ny)) g.set(nx, ny, ac[Math.floor(rr() * ac.length)]);
      }
    }
    if (o.frame === 1) { const n = new Grid(28, 34); for (let y = 0; y < 33; y++) for (let x = 0; x < 28; x++) n.px[(y + 1) * 28 + x] = g.px[y * 28 + x]; g = n; }
    return g;
  }

  function heldWeapon(P, w, tier) {
    switch (w) {
      case "sword": P.rect(6, 11, 1, 12, "wmetal", 0.6); P.rect(7, 11, 1, 12, "wmetal", -0.1); P.px(6, 10, "wmetal", 0.7); P.rect(4, 23, 5, 1, "gold", 0.2); P.rect(6, 24, 2, 2, "dleather", 0); P.px(6, 26, "gold", 0.3); break;
      case "axe": P.rect(6, 11, 1, 17, "wood", 0); P.poly([[2.5, 11], [6, 10], [6, 17], [2.5, 16]], "wmetal", (x, y) => 0.5 - (y - 10) * 0.12); break;
      case "mace": P.rect(6, 15, 1, 12, "wood", 0); P.ell(6.5, 13.2, 2.3, 2.3, "wmetal", { s: 0.1 }); P.px(6, 10, "wmetal", 0.5); P.px(3, 13, "wmetal", 0.3); P.px(9, 13, "wmetal", -0.2); break;
      case "daggers": P.rect(6, 19, 1, 5, "wmetal", 0.5); P.px(5, 23, "gold", 0.2); P.rect(21, 19, 1, 5, "wmetal", 0.1); P.px(22, 23, "gold", 0); break;
      case "spear": P.rect(6, 4, 1, 28, "wood", 0); P.poly([[5, 5], [6.5, 0], [8, 5], [6.5, 7]], "wmetal", 0.4); break;
      case "bow": for (let i = 0; i <= 18; i++) { const t = i / 18; P.px(5 - Math.round(Math.sin(t * Math.PI) * 3), 12 + i, tier >= 4 ? "fav" : "wood", 0.2 - t * 0.5); } P.line(5, 12, 5, 30, "#e8e0d0"); break;
      case "crossbow": P.rect(2, 22, 9, 1, "wood", 0.1); P.rect(6, 20, 1, 5, "wmetal", 0.2); P.line(2, 19, 2, 25, "wood", 0); break;
      case "staff": P.rect(6, 6, 1, 26, "wood", (x, y) => (y > 18 ? -0.2 : 0.1)); P.ell(6.5, 4.6, 2.2, 2.2, tier >= 3 ? "fav" : "ice", { s: 0.3 }); P.px(5, 3, "#ffffff"); break;
      case "wand": P.rect(6, 19, 1, 6, tier >= 3 ? "bone" : "wood", 0.1); P.px(6, 18, "fav", 0.8); P.px(5, 17, "#ffffff"); break;
      case "lute": P.rect(6, 16, 1, 7, "dleather", 0); P.ell(6, 25, 2.6, 3, "wood", { s: 0.1 }); P.px(6, 25, "#2a1a10"); break;
      case "frying_pan": P.rect(6, 17, 1, 8, "dleather", 0); P.ell(6.5, 13.5, 3, 3, "dmetal", { s: 0 }); break;
    }
  }
  function heldOffhand(P, off) {
    switch (off) {
      case "shield": P.ell(21.5, 22, 3.4, 4.2, "fav", { s: 0.05, fn: (x, y, s, nx, ny) => s + (nx * nx + ny * ny > 0.6 ? 0.5 : 0) }); P.px(21, 22, "gold", 0.4); break;
      case "tower_shield": P.rect(19, 16, 6, 12, "metal", (x) => 0.3 - (x - 19) * 0.12); P.rect(20, 17, 4, 10, "fav", (x) => 0.2 - (x - 20) * 0.12); break;
      case "tome": case "ledger": P.rect(20, 22, 4, 5, "favd", (x) => 0.2 - (x - 20) * 0.15); P.rect(21, 23, 2, 3, "cream", 0.2); break;
      case "orb": P.ell(21.5, 22.5, 2.2, 2.2, "fav", { s: 0.4 }); P.px(21, 21, "#ffffff"); break;
      case "skull": P.ell(21.5, 23, 2.2, 2, "bone", { s: 0.2 }); P.px(21, 23, "#16121a"); P.px(22, 23, "#16121a"); break;
      case "shovel": P.rect(22, 10, 1, 16, "wood", 0); P.rect(21, 25, 3, 4, "metal", 0.2); break;
      case "hammer": P.rect(21, 17, 1, 9, "wood", 0); P.rect(19, 14, 5, 3, "metal", (x) => 0.4 - (x - 19) * 0.15); break;
      case "lute": P.rect(22, 15, 1, 6, "dleather", 0); P.ell(22, 23, 2.4, 2.8, "wood", { s: 0.1 }); break;
    }
  }

  function hairTop(P, st, cx, fw, r, tex, covered) {
    const part = r() < 0.5 ? -2 : 2;
    const line = (x) => {
      const dx = x + 0.5 - cx;
      if (Math.abs(dx) > fw - 1.6) return 18.5;
      return 11.6 + (Math.abs(dx - part) < 1.2 ? -1 : 0) + (dx > part ? 0.6 : 0) + Math.abs(dx) * 0.12;
    };
    const capS = (x, y, s) => s + tex(x, y);
    if (st === 4) return;
    if (st === 3) {
      P.ell(cx, 11, 1.8, 7.8, "hair", { s: 0.1, fn: (x, y, s) => (y > 12 ? false : capS(x, y, s)) });
      for (let y = 8; y < 14; y++) for (let x = cx - 6; x <= cx + 6; x++) if ((x + y) % 2 === 0 && Math.abs(x + 0.5 - cx) > 2 && P.matAt(x, y) === "skin") P.px(x, y, "hair", -0.55);
      return;
    }
    const puff = st === 5 ? 1.6 : 0.8;
    P.ell(cx, 13, fw + puff, 7.4 + puff * 0.6, "hair", { fn: (x, y, s) => (y + 0.5 > line(x) + (st === 5 ? 0.6 : 0) || y > 19 ? false : capS(x, y, s)) });
    if (st === 5) {
      for (let a = 0; a < 16; a++) {
        const t = Math.PI + (a / 15) * Math.PI;
        P.ell(cx + Math.cos(t) * (fw + 1.6), 13.5 + Math.sin(t) * 8.2, 1.7, 1.7, "hair", { s: -0.1 + (a % 3 === 0 ? 0.3 : 0), k: 0.7 });
      }
      for (const side of [-1, 1]) for (let y = 13; y < 21; y += 2) P.ell(cx + side * (fw + 1.2), y, 1.5, 1.5, "hair", { s: side < 0 ? 0 : -0.35, k: 0.6 });
    }
    if (st === 1) for (const side of [-1, 1]) P.poly([[cx + side * (fw - 1.5), 12], [cx + side * (fw + 1.6), 12], [cx + side * (fw + 3.2), 32], [cx + side * (fw - 0.2), 32]], "hair", (x, y) => (side < 0 ? -0.05 : -0.4) + tex(x, y) - (y > 27 ? 0.25 : 0));
    if (st === 6) for (const side of [-1, 1]) {
      const bx = cx + side * (fw + 0.6);
      for (let y = 15; y < 33; y++) P.px(bx + (y % 4 < 2 ? 0 : side * 0.6), y, "hair", ((y >> 1) % 2 ? 0.35 : -0.35) + (side > 0 ? -0.2 : 0));
      for (let y = 15; y < 33; y++) P.px(bx + side, y, "hair", -0.5);
      P.rect(bx - 0.5, 33, 2, 1, "fav", 0.1);
    }
    if (st === 2) P.rect(cx + 6, 11, 2, 2, "fav", 0.2);
    if (st === 7) P.ell(cx + 0.5, 5.6, 3.4, 2.8, "hair", { s: 0.1, fn: (x, y, s) => s + tex(x, y) });
  }

  function torso(P, outfit, cx, r) {
    const base = { robe: "fav", robe_dark: "favd", vestments: "cream", plate: "metal", chain: "metal", leather: "leather", fur: "leather", cloak: "cloth", fancy: "fav", vest: "cream" }[outfit] || "leather";
    P.ell(cx, 43, 17.5, 14.6, base, { s: 0.05, fn: (x, y, s, nx) => s + (outfit === "chain" && (x + y * 2) % 3 === 0 ? -0.45 : 0) });
    const neckline = (x, y) => Math.abs(x + 0.5 - cx) < 4.2 - (y - 28) * 0.9;
    switch (outfit) {
      case "robe": case "robe_dark":
        P.poly([[cx - 4, 28], [cx + 4, 28], [cx, 34]], "skin", -0.6);
        P.line(cx - 4.5, 28, cx, 34.5, "gold", 0.2); P.line(cx + 4.5, 28, cx, 34.5, "gold", -0.2);
        P.rect(cx - 0.5, 34, 1, 6, base, -0.6);
        break;
      case "vestments":
        P.rect(cx - 6, 29, 2, 11, "fav", 0.1); P.rect(cx + 4, 29, 2, 11, "fav", -0.2);
        P.px(cx - 5, 34, "gold", 0.3); P.px(cx + 5, 34, "gold", 0.3);
        break;
      case "plate":
        P.rect(cx - 4, 27, 8, 3, "metal", (x) => 0.3 - (x - cx) * 0.12);
        P.poly([[cx - 6, 33], [cx + 6, 33], [cx + 5, 40], [cx - 5, 40]], "fav", (x) => 0.1 - (x - cx) * 0.06);
        P.layer = 3;
        for (const side of [-1, 1]) {
          const px0 = cx + side * 11.5;
          P.ell(px0, 32.5, 6.6, 4.8, "metal", { s: side < 0 ? 0.15 : -0.1 });
          for (let dx = -6; dx <= 6; dx++) {
            const t = (dx / 6.6) ** 2;
            P.px(px0 + dx, 34.2 + t * 1.6, "metal", -0.8);
            P.px(px0 + dx, 36.2 + t * 1.2, "metal", -0.8);
            if (Math.abs(dx) <= 5) P.px(px0 + dx, 37 + t * 1.6, dx % 2 ? "gold" : "fav", 0.1);
          }
          P.px(px0 - 3, 30, "#f4f6fa"); P.px(px0 - 2, 30, "metal", 0.9); P.px(px0 - 3, 31, "metal", 0.9);
        }
        P.layer = 2;
        break;
      case "chain":
        P.poly([[cx - 7, 32], [cx + 7, 32], [cx + 6, 40], [cx - 6, 40]], "fav", (x) => 0.05 - (x - cx) * 0.05);
        P.rect(cx - 7, 37, 14, 1, "dleather", -0.2);
        P.ell(cx, 29.5, 5.5, 2.2, "dleather", { s: -0.1 });
        break;
      case "leather":
        P.line(cx - 11, 29, cx + 8, 40, "dleather", -0.1);
        P.line(cx - 10, 29, cx + 9, 40, "dleather", -0.3);
        P.rect(cx - 1, 34, 2, 2, "gold", 0.3);
        P.ell(cx, 28.6, 4.2, 1.6, "fav", { s: 0, k: 0.5 });
        break;
      case "fur":
        for (let a = 0; a < 22; a++) {
          const t = (a / 21) * Math.PI;
          const x = cx - Math.cos(t) * 13, y = 31.5 - Math.sin(t) * 3.4 + (a % 2) * 0.8;
          P.ell(x, y, 2.4, 2.2, "fur", { s: (a % 3 === 0 ? 0.35 : 0) - (x - cx) * 0.03, k: 0.7 });
        }
        P.ell(cx, 37, 3, 1.4, "fav", { s: 0 });
        break;
      case "cloak":
        P.rect(cx - 2, 28, 4, 12, "favd", -0.4);
        P.ell(cx - 6.5, 30.5, 2.2, 2, "gold", { s: 0.2 });
        P.ell(cx + 6.5, 30.5, 2.2, 2, "gold", { s: 0 });
        P.line(cx - 6, 30.5, cx + 6, 30.5, "gold", -0.2);
        break;
      case "fancy":
        for (let x = cx - 6; x <= cx + 6; x++) P.ell(x, 29 + (x % 2) * 0.6, 1.3, 1.3, "cream", { s: 0.2 - (x - cx) * 0.06, k: 0.6 });
        for (let y = 32; y < 40; y += 2) P.px(cx, y, "gold", 0.3);
        break;
      case "vest":
        P.poly([[cx - 16, 32], [cx - 5, 28], [cx - 2, 40], [cx - 16, 40]], "fav", 0.1);
        P.poly([[cx + 16, 32], [cx + 5, 28], [cx + 2, 40], [cx + 16, 40]], "fav", -0.25);
        P.px(cx - 3, 34, "gold", 0.4); P.px(cx - 3, 37, "gold", 0.4);
        break;
    }
    if (outfit !== "robe" && outfit !== "robe_dark") P.shadeWhere((x, y, m, l) => l === 2 && y >= 27 && y <= 29 && neckline(x, y) && m === base, -0.4);
  }

  function backGear(P, weapon, off) {
    switch (weapon) {
      case "sword": P.line(7, 15, 12, 30, "metal", (t) => 0.4 - t * 0.3); P.line(4, 23, 11, 19, "gold", 0.1); P.line(6, 13, 7, 15, "dleather", 0); P.px(5.5, 11.5, "gold", 0.4); break;
      case "axe": P.line(6, 12, 11, 32, "wood", 0); P.poly([[3, 10], [9, 8], [9, 16], [3, 17]], "metal", (x, y) => 0.3 - (y - 10) * 0.08); break;
      case "spear": P.line(5, 2, 12, 34, "wood", 0); P.poly([[4, 0], [6.5, 0.5], [6, 6], [4.5, 5.5]], "metal", 0.3); break;
      case "staff": P.line(33, 6, 33, 40, "wood", (t) => (t > 0.5 ? -0.3 : 0.1)); P.line(34, 6, 34, 40, "wood", -0.5); P.ell(33.5, 4, 2.4, 2.4, "fav", { s: 0.2 }); P.px(33, 3, "#ffffff"); break;
      case "wand": P.line(32, 26, 35, 18, "bone", 0.1); P.px(35, 17, "#ffffff"); break;
      case "bow": for (let i = 0; i < 26; i++) { const t = i / 25; P.px(5 + Math.sin(t * Math.PI) * 4, 8 + t * 30, "wood", 0.15 - t * 0.4); P.px(5.8 + Math.sin(t * Math.PI) * 4, 8 + t * 30, "wood", -0.4); } P.line(5, 8, 5, 38, "#d8d0bc"); break;
      case "crossbow": P.line(4, 14, 12, 30, "wood", 0); P.line(2, 18, 9, 13, "metal", 0.2); break;
      case "mace": P.line(31, 14, 28, 32, "wood", 0); P.ell(32, 12, 2.8, 2.8, "metal", { s: 0.1 }); for (const [x, y] of [[32, 8.5], [35.5, 12], [28.5, 12]]) P.px(x, y, "metal", 0.5); break;
      case "daggers": P.line(33, 22, 31, 30, "dleather", 0); P.line(34, 17, 33, 22, "metal", 0.4); break;
      case "lute": P.line(30, 4, 27, 30, "dleather", 0); P.rect(29, 2, 3, 3, "wood", 0.1); break;
      case "frying_pan": P.line(31, 22, 28, 32, "dleather", 0); P.ell(33, 16, 4.6, 4.6, "dmetal", { s: 0 }); break;
    }
    if (off === "quiver") { P.rect(29, 14, 4, 16, "leather", (x) => 0.1 - (x - 29) * 0.15); for (const x of [29, 31, 33]) P.line(x, 9, x - 0.5, 14, "feather", 0.2); P.px(30, 9, "fav", 0.2); P.px(32, 10, "fav", 0); }
    if (off === "banner") { P.line(35, 0, 35, 40, "wood", 0); P.poly([[36, 1], [40, 1], [40, 11], [38, 9], [36, 11]], "fav", (x, y) => 0.2 - (y - 1) * 0.05); }
    if (off === "shield" || off === "tower_shield") P.ell(32.5, 32, 6.5, 8, "fav", { s: 0, fn: (x, y, s, nx, ny) => s + (nx * nx + ny * ny > 0.62 ? 0.4 : 0) });
    if (off === "tome") P.rect(30, 30, 7, 9, "favd", (x) => 0.2 - (x - 30) * 0.08);
    if (off === "orb") { P.ell(33, 30, 3.4, 3.4, "fav", { s: 0.3 }); P.px(32, 28, "#ffffff"); }
    if (off === "skull") { P.ell(33, 31, 3.4, 3.2, "bone", { s: 0.1 }); P.px(32, 31, "#16121a"); P.px(34, 31, "#16121a"); }
  }

  // a 1px light edge where a shape meets the upper left
  function rimLight(P, layer) {
    const W = P.w;
    for (let y = 1; y < P.h; y++) for (let x = 1; x < W; x++) {
      const i = y * W + x;
      if (P.mat[i] === null || P.lay[i] !== layer || P.mat[i][0] === "#") continue;
      const up = P.mat[i - W], left = P.mat[i - 1];
      if (up === null || left === null || P.lay[i - W] < layer) P.sh[i] += 0.6;
    }
  }

  function headgear(P, head, cx, fw, look, inHead, c) {
    c = c || { v: 0 };
    const open = (x, y) => ((x + 0.5 - cx) / (fw - 0.2)) ** 2 + ((y + 0.5 - 18.6) / 7.9) ** 2 <= 1;
    const hoodShape = (m, s0) => {
      P.poly([[cx - fw - 2.6, 15], [cx - fw - 7, 34], [cx + fw + 7, 34], [cx + fw + 2.6, 15]], m, (x, y) => (open(x, y) ? false : s0 - (x + 0.5 - cx) * 0.05 - (y - 15) * 0.015));
      P.ell(cx, 15.5, fw + 2.6, 9.6, m, { s: s0, fn: (x, y, s) => (open(x, y) ? false : s) });
      for (let x = cx - 9; x <= cx + 9; x++) for (let y = 9; y < 26; y++) if (open(x, y) && !open(x, y - 1)) P.px(x, y, m, s0 - 0.45);
    };
    switch (head) {
      case "helm":
        P.ell(cx, 13, fw + 1.4, 7.6, "metal", { s: 0.1, fn: (x, y, s) => (y > 13 ? false : s) });
        P.rect(cx - fw - 1.5, 13, fw * 2 + 3, 2, "metal", (x) => 0.15 - (x - cx) * 0.06);
        P.rect(cx - 1, 15, 2, 5, "metal", 0.3);
        P.px(cx, 5.5, "fav", 0.2); P.px(cx, 4.5, "fav", 0.4);
        break;
      case "great_helm": case "skull_helm": {
        const m = head === "great_helm" ? "metal" : "dmetal";
        P.ell(cx, 15, fw + 1.6, 10, m, { s: 0.05, fn: (x, y, s) => (y > 25 ? false : s + (y >= 18 && Math.abs(x + 0.5 - cx) > 2.5 ? -0.2 : 0)) });
        P.rect(cx - fw - 0.5, 14, fw * 2 + 1, 1, m, (x) => 0.55 - (x - cx) * 0.05);
        P.rect(cx - fw + 0.5, 15, fw * 2 - 1, 3, "#100c12");
        for (const ex of [cx - 4, cx + 2]) {
          if (c.glint) { P.px(ex, 16, c.glint); P.px(ex + 1, 16, mix(c.glint, "#100c12", 0.4)); }
          else { P.px(ex, 16, "#d8cfc0"); P.px(ex + (c.gaze > 0 ? 1 : 0), 16, c.eye || "#3a3a40"); P.px(ex, 15, "#2a2228"); }
        }
        P.rect(cx - 0.5, 18, 1, 7, m, 0.55);
        P.rect(cx - fw + 1, 25, fw * 2 - 2, 1, m, -0.6);
        if (head === "skull_helm") { P.ell(cx, 20, 4.5, 3.4, "bone", { s: 0.1 }); P.px(cx - 2, 20, "#100c12"); P.px(cx + 1, 20, "#100c12"); P.rect(cx - 2, 22, 4, 1, "#100c12"); }
        else {
          for (const y of [20, 22]) for (let x = cx + 2; x < cx + 5; x += 2) P.px(x, y, "#100c12");
          if (c.v % 2) { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([cx + t * 7, 4.5 - Math.sin(t * 2.6) * 3 + t * 4]); } P.tube(pts, 1.6, 0.8, "fav", 0.1); }
          else P.rect(cx - 0.5, 5, 1, 9, "gold", 0.3);
        }
        break;
      }
      case "hood": case "skull_hood": {
        const m = head === "hood" ? "cloth" : "dmetal", v = c.v;
        if ((v >> 4) % 3 === 0) P.poly([[cx + 1, 8], [cx + fw + 6, 3], [cx + fw + 4.5, 6], [cx + fw + 1.5, 12]], m, -0.15);
        hoodShape(m, head === "hood" ? 0.05 : -0.1);
        const ring = [];
        for (let y = 9; y < 28; y++) for (let x = cx - 10; x <= cx + 10; x++) {
          if (open(x, y)) continue;
          if (open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1)) ring.push([x, y]);
        }
        const trim = head === "skull_hood" ? "bone" : ["gold", "fav", "leather", "metal", "fur"][v % 5];
        ring.forEach(([x, y], k) => { if (y < 27) P.px(x, y, trim, (v >> 3) % 2 && k % 2 ? -0.4 : 0.15 - (x - cx) * 0.04); });
        const pat = (v >> 6) % 4;
        if (pat === 1) for (let y = 10; y < 34; y++) for (let x = cx - fw - 7; x <= cx + fw + 7; x++) {
          if (!open(x, y) && P.matAt(x, y) === m && ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0)) P.px(x, y, m, -0.45);
        }
        if (pat === 2) for (const sx of [cx - fw - 3, cx + fw + 2]) for (let y = 12; y < 34; y += 2) P.px(sx, y, trim, -0.1);
        if (pat === 3) for (let x = cx - fw - 6; x <= cx + fw + 6; x += 2) P.px(x, 31, trim, 0.1 - (x - cx) * 0.03);
        for (let y = 11; y < 24; y++) for (let x = cx - 9; x <= cx + 9; x++) {
          if (open(x, y) && (!open(x - 1, y) || !open(x + 1, y)) && y < 21) P.px(x, y, "favd", -0.3);
        }
        if (c.aura === "shadow") for (let y = 20; y < 27; y++) for (let x = cx - 9; x <= cx + 9; x++) if (open(x, y)) P.px(x, y, "favd", (y === 20 ? 0.3 : -0.1) - (x - cx) * 0.05);
        P.ell(cx, 28.6, 1.6, 1.4, (v >> 8) % 2 ? "gold" : "metal", { s: 0.3 });
        break;
      }
      case "beast_hood":
        hoodShape("fur", 0.05);
        for (const side of [-1, 1]) P.poly([[cx + side * 3, 7], [cx + side * 8, 1], [cx + side * 8.5, 9]], "fur", side < 0 ? 0.3 : -0.2);
        P.px(cx - 3, 8, "#f0d040"); P.px(cx + 2, 8, "#f0d040");
        break;
      case "wizard_hat":
        P.poly([[cx - 6.5, 10], [cx + 6.5, 10], [cx + 6, 3], [cx + 9, -1], [cx + 2, 2]], "fav", (x, y) => 0.25 - (x - cx) * 0.06 - (y < 3 ? 0.2 : 0));
        P.ell(cx, 10.5, fw + 5, 2.2, "fav", { s: -0.1 });
        P.rect(cx - 6, 8, 12, 1, "gold", 0.2);
        break;
      case "wide_hat":
        P.ell(cx, 7, 6, 4.6, "leather", { s: 0.1, fn: (x, y, s) => (y > 9 ? false : s) });
        P.rect(cx - 6, 8, 12, 1, "fav", 0);
        P.ell(cx, 10, fw + 6.5, 2.2, "leather", { s: -0.05 });
        break;
      case "top_hat":
        P.rect(cx - 5, 1, 10, 9, "dmetal", (x) => 0.1 - (x - cx) * 0.08);
        P.rect(cx - 5, 7, 10, 1, "fav", 0);
        P.ell(cx, 10, fw + 3, 1.8, "dmetal", { s: -0.1 });
        break;
      case "tricorn":
        P.poly([[cx - fw - 4, 10], [cx, 4], [cx + fw + 4, 10], [cx, 12]], "dmetal", (x, y) => 0.1 - (x - cx) * 0.05);
        P.px(cx + 3, 8, "gold", 0.4);
        break;
      case "mitre":
        P.poly([[cx - 5, 11], [cx - 4, 3], [cx, -1], [cx + 4, 3], [cx + 5, 11]], "cream", (x) => 0.2 - (x - cx) * 0.06);
        P.rect(cx - 0.5, 0, 1, 11, "gold", 0.2);
        break;
      case "horns":
        for (const side of [-1, 1]) {
          const pts = [];
          for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([cx + side * (fw - 1 + t * 5 + Math.sin(t * 2.4) * 1.5), 11 - t * 9 + t * t * 2]); }
          P.tube(pts, 1.8, 0.6, "horn", side < 0 ? 0.1 : -0.2);
        }
        break;
      case "antlers":
        for (const side of [-1, 1]) {
          P.line(cx + side * 4, 9, cx + side * 9, 1, "antler", 0.1);
          P.line(cx + side * 6.5, 5, cx + side * 11, 4, "antler", -0.1);
          P.line(cx + side * 8, 2.5, cx + side * 7, -1, "antler", 0.2);
        }
        break;
      case "leaf_crown":
        for (let i = 0; i < 9; i++) P.ell(cx - 7 + i * 1.75, 9.5 + Math.abs(i - 4) * 0.5, 1.4, 1, "leaf", { s: i % 2 ? 0.3 : -0.1, k: 0.6 });
        break;
      case "ice_crown":
        P.rect(cx - 6, 10, 12, 1, "ice", 0.1);
        for (const [x, hgt] of [[-5, 2], [-2.5, 4], [0, 6], [2.5, 4], [5, 2]]) P.poly([[cx + x - 1, 10], [cx + x, 10 - hgt], [cx + x + 1, 10]], "ice", x < 0 ? 0.5 : 0.1);
        break;
      case "flame_crown":
        P.rect(cx - 6, 10, 12, 1, "gold", 0.2);
        for (const [x, hgt] of [[-5, 3], [-2, 5], [1, 6], [4, 4]]) P.poly([[cx + x - 1.2, 10], [cx + x + 0.4, 10 - hgt], [cx + x + 1.6, 10]], "flame", 0.4);
        break;
      case "circlet":
        P.rect(cx - 6, 12, 12, 1, "gold", (x) => 0.3 - (x - cx) * 0.06);
        P.px(cx, 12, look.fav); P.px(cx - 1, 12, "gold", 0.6);
        break;
      case "bandana":
        P.ell(cx, 12.5, fw + 1, 6, "fav", { s: 0.05, fn: (x, y, s) => (y > 12 ? false : s) });
        P.line(cx + fw, 12, cx + fw + 3, 17, "fav", -0.2);
        break;
      case "feather_cap":
        P.ell(cx, 12, fw + 1, 5.6, "favd", { s: 0.1, fn: (x, y, s) => (y > 12 ? false : s) });
        P.line(cx + 3, 8, cx + 10, 0, "feather", 0.3, 0.9);
        break;
    }
  }

  const cache = new Map();
  function portraitGrid(h, cls, opts) {
    const look = (cls || {}).look || { outfit: "leather", head: "none" };
    const key = JSON.stringify([h.id, h.look, look, h.weapon, h.weapon_tier, h.armor_tier, h.legend, opts && opts.frame, opts && opts.bg]);
    if (!cache.has(key)) cache.set(key, portrait(h, Object.assign({ cn: (cls || {}).name || "" }, look), opts));
    return cache.get(key);
  }

  window.Paint = { Paint, ramp, hsv, toHsv, portraitGrid, fullBody, PW, PH };
})();
