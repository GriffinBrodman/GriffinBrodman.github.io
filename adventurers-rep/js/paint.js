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
    // optional design-space transform: X = ox + (x - cx) * s; a tilts it (radians), so a head can be drawn natively tilted on a pillow
    T(x, y) {
      const t = this.tf;
      if (this.bend) y += this.bend(x);
      let X = x, Y = y;
      if (t && !t.a) { X = t.ox + (x - t.cx) * t.s; Y = t.oy + (y - t.cy) * t.s; }
      else if (t) { const u = x - t.cx, v = y - t.cy, c = Math.cos(t.a), n = Math.sin(t.a); X = t.ox + (u * c - v * n) * t.s; Y = t.oy + (u * n + v * c) * t.s; }
      return this.post ? this.postT(X, Y) : [X, Y];
    }
    // a whole-figure transform applied after tf: turn about (cx, cy) by a and land that point at (ox, oy); a fallen or tilted
    // pose is painted natively at its angle this way instead of rotating a finished sprite
    postT(x, y) {
      const p = this.post, u = x - p.cx, v = y - p.cy, c = Math.cos(p.a || 0), n = Math.sin(p.a || 0);
      return [p.ox + u * c - v * n, p.oy + u * n + v * c];
    }
    postInv(X, Y) {
      const p = this.post, u = X - p.ox, v = Y - p.oy, c = Math.cos(p.a || 0), n = Math.sin(p.a || 0);
      return [p.cx + u * c + v * n, p.cy - u * n + v * c];
    }
    invF(X, Y, t) {
      if (this.post) [X, Y] = this.postInv(X, Y);
      t = t || this.tf;
      let x = X, y = Y;
      if (t) { const c = Math.cos(t.a || 0), n = Math.sin(t.a || 0), p = (X - t.ox) / t.s, q = (Y - t.oy) / t.s; x = t.cx + p * c + q * n; y = t.cy - p * n + q * c; }
      return this.bend ? [x, y - this.bend(x)] : [x, y];
    }
    inv(X, Y) {
      const t = this.tf;
      if (this.warped()) { const [a, b] = this.invF(X + 0.5, Y + 0.5); return [Math.floor(a), Math.floor(b)]; }
      return t ? [Math.round(t.cx + (X + 0.5 - t.ox) / t.s - 0.5), Math.round(t.cy + (Y + 0.5 - t.oy) / t.s - 0.5)] : [X, Y];
    }
    warped() { const t = this.tf; return !!(t && t.a) || !!this.post || !!this.bend; }
    // under a tilted transform every shape is filled screen pixel by screen pixel, tested back in design space;
    // at(x, y) gives the shade there or false, and a shape too small to cover any pixel centre still marks its own
    fillWarped(x0, y0, x1, y1, m, at) {
      const tf = this.tf, post = this.post, cs = [];
      for (const a of [0, 0.5, 1]) for (const b of [0, 0.5, 1]) cs.push(this.T(x0 + (x1 - x0) * a, y0 + (y1 - y0) * b));
      const xs = cs.map((p) => p[0]), ys = cs.map((p) => p[1]);
      let hit = false;
      for (let Y = Math.floor(Math.min(...ys)) - 1; Y <= Math.ceil(Math.max(...ys)); Y++) for (let X = Math.floor(Math.min(...xs)) - 1; X <= Math.ceil(Math.max(...xs)); X++) {
        const [lx, ly] = this.invF(X + 0.5, Y + 0.5, tf), s = at(lx, ly);
        if (s === false) continue;
        const bend = this.bend;
        this.tf = null; this.post = null; this.bend = null;
        this.px(X, Y, m, s); hit = true;
        this.tf = tf; this.post = post; this.bend = bend;
      }
      if (!hit) { const [lx, ly] = [(x0 + x1) / 2, (y0 + y1) / 2], s = at(lx, ly, true); this.px(lx - 0.5, ly - 0.5, m, s === false ? 0 : s); }
    }
    // a posed figure lit from the screen's upper left, not its own: the design-space normal turned by the whole angle
    lit(nx, ny) {
      if (!this.screenLight) return [nx, ny];
      const a = ((this.tf && this.tf.a) || 0) + ((this.post && this.post.a) || 0), c = Math.cos(a), n = Math.sin(a);
      return [nx * c - ny * n, nx * n + ny * c];
    }
    px(x, y, m, s) {
      if (this.tf || this.post || this.bend) { [x, y] = this.T(x + 0.5, y + 0.5); }
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = y * this.w + x;
      this.mat[i] = m; this.sh[i] = (s || 0) + this.bias; this.lay[i] = this.layer;
    }
    has(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.mat[y * this.w + x] !== null; }
    matAt(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.mat[y * this.w + x] : null; }
    // posed sprites erase in design space; the old sprites erase raw pixels, and keep doing so
    erase(x, y) { if (this.post || this.bend || this.eraseT) { [x, y] = this.T(x + 0.5, y + 0.5); x = Math.floor(x); y = Math.floor(y); } if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.mat[y * this.w + x] = null; }
    // lit volume: light from the upper left; fn(x, y, s) may return false to skip or a number to adjust shade
    ell(cx, cy, rx, ry, m, o) {
      o = o || {};
      const k = o.k == null ? 1 : o.k, s0 = o.s || 0, tf = this.tf;
      if (this.warped()) return this.fillWarped(cx - rx, cy - ry, cx + rx, cy + ry, m, (x, y, any) => {
        const nx = (x - cx) / rx, ny = (y - cy) / ry, d = nx * nx + ny * ny;
        if (d > 1 && !any) return false;
        const [lx, ly] = this.lit(nx, ny), s = s0 + k * (0.15 - lx * 0.55 - ly * 0.6 + (1 - Math.min(1, d)) * 0.25);
        if (!o.fn) return s;
        const r = o.fn(Math.floor(x), Math.floor(y), s, nx, ny);
        return r === false ? false : typeof r === "number" ? r : s;
      });
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
      if (this.warped()) {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        return this.fillWarped(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), m, (x, y, any) => {
          let inside = !!any;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [xi, yi] = pts[i], [xj, yj] = pts[j];
            if ((yi > y) !== (yj > y) && x < xi + ((y - yi) / (yj - yi)) * (xj - xi)) inside = !inside;
          }
          if (!inside) return false;
          return typeof sfn === "function" ? sfn(Math.floor(x), Math.floor(y)) : sfn || 0;
        });
      }
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
      if (this.warped()) return this.fillWarped(x, y, x + w, y + h, m, (a, b, any) => (any || (a >= x && a < x + w && b >= y && b < y + h) ? (typeof s === "function" ? s(Math.floor(a), Math.floor(b)) : s || 0) : false));
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
      if (this.tf && !this.warped()) {
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
        const s = this.sh[i] + (o.flat && o.flat.has(m) ? 0 : (BAYER[(x & 1) + (y & 1) * 2] - 0.375) * 0.22);
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


  // ---------- kit: what a hero wears, normalised; without a kit (old data, monsters) the class look stands in ----------
  const PW = 40, PH = 40;
  const EYES = ["#5a3a22", "#3a6a9a", "#4a7a3a", "#6a6a72", "#9a6a22", "#2a2a30"];
  const METAL = { 1: "#6e665e", 2: "#7a828c", 3: "#8e9aa6", 4: "#a2acb8", 5: "#86b4cc" };
  const TMETAL = ["#66605a", "#7a828c", "#949eaa", "#b2bac6"];
  const LEATHER = { 1: "#8e6a48", 2: "#7a5034", 3: "#6c4630", 4: "#5e3a2a", 5: "#3a3240" };
  const RUNE = { cloth: "#fff0b0", leather: "#8ae0c8", chain: "#c8f0ff", plate: "#ffb850" };
  const AURA = Art.AURA;
  // marks of a calling (league/content/gear.py CLASS_MARKS): crowns ride the head and scale with it; face and floating marks are
  // drawn natively at each size (FINE); body marks are carried at the hip or the off hand
  const CROWNS = new Set(["flame_crown", "ice_crown", "leaf_crown", "elemental_crown", "storm_crown"]);
  const FINE = new Set(["rune_crown", "star_orbit", "spectacles", "domino", "veil", "triad", "raincloud", "goggles", "warpaint", "rose", "claw_scars", "eyepatch", "thundercloud", "spirits"]);
  const BODY_MARKS = new Set(["ward_sigil", "pendulum", "trap_belt", "rope_coil", "spellhand", "whip", "trophy_cord", "hunting_horn", "wanted_poster", "satchel", "mortar", "poison_vial", "ladle",
    "tabard", "pauldrons", "spare_blades", "slung_lute", "wolf_mantle", "bedroll", "stag_trophy", "trail_scarf", "woad"]);
  // body marks carried on the back are drawn behind the figure first (part "back"); a tabard goes over the armour, under the arms
  const BEHIND = new Set(["spare_blades", "slung_lute", "stag_trophy"]);
  const MARKS = new Set(["halo", "antlers", ...CROWNS, ...FINE, ...BODY_MARKS]);
  const OUTFIT_MAT = { robe: "cloth", robe_dark: "cloth", vestments: "cloth", fancy: "cloth", vest: "cloth", motley: "cloth", leather: "leather", fur: "leather", cloak: "leather", chain: "chain", plate: "plate", plate_dark: "plate" };
  const BASE = { robe: "robe", robe_dark: "robed", vestments: "shirt", fancy: "robe", vest: "shirt", motley: "robe", leather: "hide", fur: "hide", cloak: "cloth", chain: "metal", plate: "metal" };
  const COVERS = new Set(["great_helm", "skull_helm", "hood", "skull_hood", "beast_hood", "helm", "top_hat", "mitre", "tricorn", "bandana", "feather_cap", "leather_cap", "fur_cap", "slouch_hat"]);
  const HAIRY = new Set(["helm", "bandana", "feather_cap", "leather_cap", "fur_cap"]);
  const FULL = new Set(["great_helm", "skull_helm"]);
  const HOODS = new Set(["hood", "skull_hood", "beast_hood"]);
  const FRINGE = ["thin", "full", "thin", "mohawk", null, "full", "full", "thin", "full", "full", "thin", "sweep", "thin", "full", "thin", "full", "full", "full", "thin", "sweep", "full", "thin"];
  const FRINGE_LOCKS = new Set([1, 5, 6, 8, 9, 16, 17, 20]);
  // where a crown sits on top of each kind of headgear (portrait space)
  const CROWN_Y = { none: 10, hood: 7.2, skull_hood: 7.2, beast_hood: 7.2, leather_cap: 8.2, helm: 7.2, horns: 8.6, great_helm: 6.6, skull_helm: 6.6, wizard_hat: 9.4,
    mitre: 10.4, wide_hat: 7.6, top_hat: 6.8, tricorn: 8.2, bandana: 8.6, feather_cap: 8.2, circlet: 10.6, crown: 10.6, mask: 10, fur_cap: 7.4, herb_wreath: 10, slouch_hat: 7.2 };
  // players picked these colours in the quiz, so the hue stays; only the loudest saturation is reined in toward the earthy palette
  const softCache = {};
  function soften(hex) {
    if (!hex || hex[0] !== "#") return hex;
    if (!softCache[hex]) { const [h, s, v] = toHsv(hex); softCache[hex] = mix(hsv(h, Math.min(s, 0.65), v), "#7a6a58", 0.15); }
    return softCache[hex];
  }
  // faces and hair are drawn in flat ramps; dither is for cloth and backdrops
  const FLAT = new Set(["skin", "hair", "lip", "stub", "hd"]);
  const HEAD_TOP = { none: 5.5, hood: 5.5, skull_hood: 5.5, beast_hood: 3, leather_cap: 5.5, helm: 4.5, great_helm: 4.5, skull_helm: 4.5, horns: 4.5, wizard_hat: -1,
    mitre: -1, wide_hat: 2.5, top_hat: 0, tricorn: 4, bandana: 6, feather_cap: 6, circlet: 5, crown: 5, mask: 5.5, fur_cap: 5, herb_wreath: 5, slouch_hat: 0.5 };
  const tierOf = (x, d) => Math.max(0, Math.min(3, x && x.tier != null ? x.tier : x && x.glow ? 3 : d));

  function kitView(h, cl) {
    const k = h.kit, at0 = Math.max(1, Math.min(5, h.armor_tier || h.weapon_tier || 1));
    if (!k) {
      const head = cl.head || "none", off = cl.offhand || "none", slung = off === "quiver" || off === "banner";
      return { legacy: true, outfit: cl.outfit || "leather", mat: OUTFIT_MAT[cl.outfit] || "leather", at: at0, aglow: null,
        w: { family: h.weapon, tier: h.weapon_tier || 1, glow: null },
        head: head === "none" || MARKS.has(head) ? null : { art: head, tier: 1 }, mark: cl.mark || (MARKS.has(head) ? head : null),
        off: off === "none" || slung ? null : { art: off, tier: 1 }, back: slung ? { art: off, tier: 1 } : null, neck: null, rings: [], pocket: null };
    }
    const w = k.weapon || { family: h.weapon, tier: h.weapon_tier || 1 }, a = k.armor || {};
    return { legacy: false, outfit: a.outfit || cl.outfit || "leather", mat: a.material || OUTFIT_MAT[a.outfit] || "leather", at: Math.max(1, Math.min(5, a.tier || at0)), aglow: a.glow || null,
      w: { family: w.family || h.weapon, tier: Math.max(1, Math.min(5, w.tier || 1)), two: w.two !== false && !!(w.two || w.family === "daggers"), glow: w.glow || null },
      head: k.head && k.head.art ? k.head : null, mark: k.mark || null, off: w.two ? null : k.offhand || null, back: k.back || null,
      neck: k.neck || null, rings: (k.rings || []).slice(0, 2), pocket: k.pocket || null, belt: k.belt || null, boots: k.boots || null, gloves: k.gloves || null };
  }
  // belt, boots and gloves found underground: leather darkening with the piece's tier, and the grade as a small glow
  const DELVE_COL = { belt: ["#a08058", "#6e4a30", "#4e3626", "#3e2a22"], boots: ["#74523a", "#5a3a26", "#463830", "#2e2a30"], gloves: ["#c8a878", "#8e5c3a", "#5a3c28", "#3c3238"] };
  const GRADE_GLOW = { great: "#ffd060", unique: "#6ee0c8" };
  const delveCol = (it, slot) => DELVE_COL[slot][Math.max(0, Math.min(3, it.tier || 0))];
  const gradeGlow = (it) => (it && GRADE_GLOW[it.grade]) || null;

  const HEAD_COL = {
    hood: (t, f) => ["#7a6a58", mix(f, "#3a3440", 0.55), mix(f, "#2e3a2a", 0.5), "#34303e"][t],
    skull_hood: (t) => ["#7a7680", "#4a4656", "#3a3646", "#26222e"][t],
    beast_hood: (t) => ["#a88a64", "#a88a64", "#76727a", "#dcd6c8"][t],
    leather_cap: (t) => ["#8e6c4c", "#7a5638", "#5a3c28", "#6a4630"][t],
    fur_cap: (t) => ["#9a8a74", "#6a4a30", "#a85c34", "#66646e"][t],
    herb_wreath: (t) => ["#6a9a4a", "#5a8a3a", "#4e7448", "#4a7a3a"][t],
    horns: (t) => ["#7a5638", "#7a828c", "#7a828c", "#949eaa"][t],
    wizard_hat: (t, f) => ["#7a6044", f, f, mix(f, "#1a1630", 0.3)][t],
    wide_hat: (t) => ["#d8b45a", "#7a5034", "#6a4a30", "#3a3444"][t],
    top_hat: (t) => ["#5e4c40", "#4a4656", "#3a3644", "#2e2a36"][t],
    slouch_hat: (t) => ["#7a6450", "#5e3230", "#4e2a2c", "#2e2630"][t],
    tricorn: (t) => ["#6a4e34", "#3a3444", "#2e2a3a", "#26263a"][t],
    bandana: (t, f) => ["#8a7a64", f, f, "#8e3a3e"][t],
    feather_cap: (t, f) => ["#6a5a48", mix(f, "#1a1622", 0.45), mix(f, "#1a1622", 0.3), mix(f, "#1a1622", 0.15)][t],
    mitre: (t) => (t ? "#e8dec8" : "#d4c8b0"),
    circlet: (t) => ["#b87440", "#c4cad4", "#d8a838", "#e0b040"][t],
    crown: () => "#d8a838",
    mask: () => "#c4cad4",
  };
  const BACK_COL = {
    cloak: (t, f) => ["#6e6250", mix(f, "#3a3440", 0.5), "#465048", mix(f, "#1a1622", 0.35)][t],
    cape: (t, f) => [mix(f, "#8a8478", 0.45), f, f, mix(f, "#1a1028", 0.3)][t],
    fur_mantle: (t) => ["#8a7258", "#a88a64", "#8e8e96", "#5a4232"][t],
    quiver: (t) => ["#9a7a56", "#7a5034", "#5e3a2a", "#5a3424"][t],
    backpack: (t) => ["#a8946a", "#7a5a3a", "#6a4a30", "#5a4a3c"][t],
    banner: (t, f) => (t ? f : "#b8a888"),
  };

  function makeMats(look, k) {
    const fav = look.fav, skinHex = look.skinHex || look.skin, at = k.at || 1;
    const cloth = at === 1 ? mix(fav, "#8a8478", 0.45) : at === 5 ? mix(fav, "#141228", 0.18) : fav;
    const ht = k.ht == null ? 1 : k.ht, ot = k.ot == null ? 1 : k.ot, bt = k.bt == null ? 1 : k.bt;
    const head = k.head && HEAD_COL[k.head] ? HEAD_COL[k.head](ht, fav) : "#7a5638";
    const back = k.back && BACK_COL[k.back] ? BACK_COL[k.back](bt, fav) : mix(fav, "#3a3440", 0.5);
    return {
      skin: ramp(skinHex), hair: ramp(look.hair || "#2a1c14"), fav: ramp(fav), favd: ramp(mix(fav, "#1a1622", 0.45)),
      metal: ramp(k.dark ? mix(METAL[at], "#2a2430", 0.5) : METAL[at]), dmetal: ramp("#4a4656"),
      leather: ramp("#7a5034"), dleather: ramp("#4e3424"), fur: ramp("#a88a64"), cream: ramp("#e4dac4"), gold: ramp("#d8a838"),
      wood: ramp("#7a5232"), dwood: ramp("#4a3020"), bone: ramp("#d8d0bc"), cloth: ramp(mix(fav, "#3a3440", 0.55)), lip: ramp(mix(skinHex, "#a0403a", 0.35)),
      stub: ramp(mix(skinHex, mix(look.hair || "#2a1c14", "#2a1c14", 0.4), 0.5)),
      leaf: ramp("#5a9a3a"), ice: ramp("#9ad8f0"), flame: ramp("#f08a2a"), horn: ramp("#d8ccb0"), antler: ramp("#8a6a48"), feather: ramp("#ece6d6"),
      wmetal: ramp(METAL[Math.max(1, Math.min(5, k.wt || 1))]), boot: ramp("#5a3a26"), pants: ramp("#4e4250"),
      robe: ramp(cloth), robed: ramp(mix(cloth, "#1a1622", 0.45)), shirt: ramp(at === 1 ? "#cdc2aa" : "#e4dac4"), hide: ramp(LEATHER[at]),
      patch: ramp(k.mat === "leather" ? "#a8845a" : mix(fav, "#d8c8a0", 0.55)),
      hd: ramp(["circlet", "crown", "mask"].includes(k.head) ? head : soften(head)), pale: ramp("#b4844e"), hmet: ramp(TMETAL[ht]), omet: ramp(TMETAL[ot]), bk: ramp(back), silver: ramp("#c4cad4"), copper: ramp("#b87440"),
      mana: ramp("#3ab8b8"), illus: ramp("#e07aa8"), mint: ramp("#8ad8c4"), brass: ramp("#c8963a"), cloud: ramp("#a4aebc"), warp: ramp("#b4302a"), woad: ramp("#3a62a8"),
      rosec: ramp("#c82a44"), rope: ramp("#c4a26a"),
      parch: ramp("#e0cea0"), stone: ramp("#8e887c"), tox: ramp("#86cc4a"), herb: ramp("#58784a"), sage: ramp("#8e9e6a"), lav: ramp("#8e7ab8"), berry: ramp("#a8303a"),
      scarp: ramp("#e4a8a0"), fox: ramp("#b0643a"), storm: ramp("#5c6478"), ghost: ramp("#bfe8cc"), blanket: ramp("#8e4a3a"),
      glass: ramp("#b8d0e0"), night: ramp("#2a3470"), crim: ramp("#8e2a2a"), straw: ramp("#d8b45a"), moon: ramp("#e4e2dc"), peacock: ramp("#2a8a8a"),
      blt: ramp(k.belt || "#6e4a30"), bts: ramp(k.boots || "#5a3a26"), glv: ramp(k.gloves || "#7e5436"),
      ngem: ramp(k.neckGem || "#c83a3a"), strap: ramp("#b48a56"), pearl: ramp("#ece6da"), pk: ramp(k.tint || "#6a4a3a"), wolf: ramp("#8e8e96"), rust: ramp("#8a5a3a"),
    };
  }

  function setup(h, clsLook) {
    const look = Object.assign({}, h.look, { fav: soften(h.look.fav), hair: soften(h.look.hair || "#2a1c14") }), r = rng(hash(h.id || h.name || "x") + 17), cx = 20, K = kitView(h, clsLook || {});
    const scars = look.scars || [], head = K.head ? K.head.art : "none";
    let outfit = K.outfit;
    const dark = outfit === "plate_dark";
    if (dark) outfit = "plate";
    const pale = scars.includes("pale"), skinHex = pale ? mix(look.skin, "#c8ccd8", 0.35) : look.skin;
    if (head === "hood" || head === "skull_hood" || head === "beast_hood") look.hair = mix(look.hair, "#241c1a", 0.45);
    const mats = makeMats(Object.assign({}, look, { skinHex }), { at: K.at, mat: K.mat, dark, wt: K.w.tier, ht: tierOf(K.head, 1), ot: tierOf(K.off, 1), bt: tierOf(K.back, 1),
      head, back: K.back && K.back.art, neckGem: K.neck && soften(K.neck.gem || (K.neck.art === "scarf" ? look.fav : null)), tint: K.pocket && soften(K.pocket.tint),
      belt: K.belt && delveCol(K.belt, "belt"), boots: K.boots && delveCol(K.boots, "boots"), gloves: K.gloves && delveCol(K.gloves, "gloves") });
    const c = { h, look, r, cx, scars, head, outfit, pale, mats, st: look.style, k: K, ht: tierOf(K.head, 1), mark: K.mark };
    c.faceW = 6.5 + r() * 1.1; c.jawW = c.faceW - 0.9 - r() * 0.7; c.chin = 24.6 + r() * 0.8;
    c.pointy = r() < 0.28; c.freckles = r() < 0.2 && toHsv(look.skin)[2] > 0.8; c.eye = EYES[Math.floor(r() * EYES.length)];
    c.gaze = r() < 0.5 ? 1 : -1; c.bigNose = r() < 0.35; c.browUp = r() < 0.3; c.tusks = look.skin === "#9cc48a" && r() < 0.7;
    c.covered = COVERS.has(head); c.full = FULL.has(head);
    c.v = hash((clsLook.cn || "") + outfit + (clsLook.aura || "") + (clsLook.offhand || "") + (K.legacy ? "" : head + c.ht));
    c.aura = clsLook.aura;
    c.glint = head === "skull_helm" || clsLook.aura === "death" ? "#8af09a" : clsLook.aura === "holy" ? "#fff2a0" : clsLook.aura === "fire" || clsLook.aura === "rage" ? "#ffb04a" : null;
    if (K.head && K.head.glow && FULL.has(head)) c.glint = K.head.glow;
    c.inHead = (x, y) => ((x + 0.5 - cx) / c.faceW) ** 2 + ((y + 0.5 - 15.5) / 8) ** 2 <= 1 || ((x + 0.5 - cx) / c.jawW) ** 2 + ((y + 0.5 - 19.5) / (c.chin - 19.5)) ** 2 <= 1;
    c.hairTex = (x, y) => ((x * 2 + y * 3 + (x >> 2)) % 5 === 0 ? -0.35 : 0);
    return c;
  }

  // records which pixels a drawing step touched, so magic pieces can be lit afterwards
  function track(P, fn) {
    const before = P.mat.slice(), lay = P.lay.slice(), out = [];
    fn();
    for (let i = 0; i < P.mat.length; i++) if (P.mat[i] !== null && (P.mat[i] !== before[i] || P.lay[i] !== lay[i])) out.push(i);
    return out;
  }
  // a magic piece keeps its own colours: the outline on its lit (upper-left) side takes the glow, and one outline pixel sparkles,
  // moving between the two frames
  function glowUp(g, P, px, glow, frame, o) {
    if (!glow || !px.length) return;
    o = o || {};
    const W = P.w, set = new Set(px), outline = o.outline || "#16121a", rim = [];
    for (const i of px) {
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[-1, 0], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (nx < 0 || ny < 0 || set.has(j) || P.mat[j] !== null || g.px[j] !== outline || rim.includes(j)) continue;
        rim.push(j);
      }
    }
    for (const j of rim) g.px[j] = mix(outline, glow, o.amt || 0.75);
    if (!rim.length) return;
    rim.sort((a, b) => ((a / W) | 0) - ((b / W) | 0) || (a % W) - (b % W));
    g.px[rim[frame ? Math.floor(rim.length / 2) : 0]] = mix(glow, "#ffffff", 0.6);
  }

  function headBack(P, c) {
    const { cx, covered, st, hairTex } = c;
    P.layer = 1;
    if (c.mark === "star_orbit") fineMark(P, c, "back");
    if (c.mark === "halo") {
      const hy = (HEAD_TOP[c.head] == null ? 6 : HEAD_TOP[c.head]) - (c.head === "none" && HAIR_LIFT[st] ? HAIR_LIFT[st] : c.head === "circlet" ? 4.5 : 2);
      // a gold band, not a wire: two rings so it holds at sprite size, the near rim lit and the far rim in shade
      for (const [rx, ry] of [[7.6, 2.3], [6.9, 1.7]]) for (let a = 0; a < 64; a++) {
        const t = (a / 64) * Math.PI * 2;
        P.px(cx + Math.cos(t) * rx, hy + Math.sin(t) * ry, "gold", Math.sin(t) > 0 ? 0.75 - Math.cos(t) * 0.15 : 0.15 - Math.cos(t) * 0.15);
      }
      P.px(cx - 5, hy + 1.5, "#fffbe0");
    }
    if (!covered && (st === 1 || st === 6)) P.poly([[cx - 8, 10], [cx + 8, 10], [cx + 10, st === 1 ? 33 : 26], [cx - 10, st === 1 ? 33 : 26]], "hair", (x, y) => -0.3 + hairTex(x, y) - (y - 10) * 0.02);
    if (!covered && st === 2) P.ell(cx + 8.5, 19, 2.6, 6.5, "hair", { s: -0.25, fn: (x, y, s) => s + hairTex(x, y) });
    if (!covered && st >= 8) hairBackNew(P, st, cx, hairTex);
  }

  // layers 3-7: neck, ears, head, facial hair, hair, headgear; features=false skips the 1px face details (drawn natively when scaled)
  function headFront(P, c, features) {
    const { cx, faceW, jawW, look, scars, head, inHead, hairTex, gaze, pale, full, covered, st } = c;
    P.layer = 3;
    P.rect(cx - 3, 22, 6, 7, "skin", (x, y) => (y < 25 ? -0.7 : -0.25) - (x - cx) * 0.08);
    for (const side of [-1, 1]) {
      const ex = cx + side * (faceW + 0.4);
      if (c.pointy) P.poly([[ex - side * 1.2, 14.5], [ex + side * 3.8, 11.5], [ex + side * 0.8, 19.5], [ex - side * 1.2, 19]], "skin", side < 0 ? 0.1 : -0.35);
      else if (!HOODS.has(c.head)) P.ell(ex, 17, 1.6, 2.4, "skin", { s: side < 0 ? 0 : -0.3, k: 0.5 });
      if (features && (c.pointy || !HOODS.has(c.head))) P.px(ex + side * 0.2, 17, "skin", -0.8);
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
    if (!covered || HAIRY.has(head)) hairTop(P, st, cx, faceW, c.r, hairTex, covered);
    if (c.mark === "antlers" && (head === "none" || head === "circlet")) markArt(P, "antlers", c);
    P.layer = 7;
    headgear(P, head, cx, faceW, look, inHead, c);
    if (head === "helm" || full || (head === "horns" && c.ht)) rimLight(P, 7);
    if (head === "hood" || head === "skull_hood" || head === "beast_hood") P.shadeWhere((x, y, m, l) => l <= 6 && l >= 3 && y < 15, (x, y) => (y < 13 ? -0.3 : -0.12));
    if (head === "skull_hood" && c.ht >= 2 && features) { P.px(lx + (gaze > 0 ? 1 : 0), ey, "#8af09a"); P.px(rx2 + (gaze > 0 ? 1 : 0), ey, "#8af09a"); }
    if ((c.mark === "antlers" && !(head === "none" || head === "circlet")) || CROWNS.has(c.mark)) { P.layer = 8; markArt(P, c.mark, c); }
    else if (FINE.has(c.mark) && !c.sprite) { P.layer = 8; fineMark(P, c, "front"); }
  }

  const BRIM = { wizard_hat: [10.6, 10], wide_hat: [10, 12], top_hat: [10, 9], tricorn: [10, 10], mitre: [11, 5], feather_cap: [12, 7.5] };
  function markArt(P, mark, c) {
    const cx = c.cx, brim = BRIM[c.head];
    if (brim && mark !== "antlers") {
      const [by, half] = brim;
      for (let i = 0; i <= 8; i++) {
        const x = cx - half + (i * half * 2) / 8, hgt = i % 2 ? 1.6 : 2.6;
        if (mark === "flame_crown") P.poly([[x - 1, by + 0.5], [x + 0.3, by - hgt], [x + 1.2, by + 0.5]], "flame", 0.45 - (i % 3) * 0.2);
        if (mark === "elemental_crown") P.poly([[x - 0.9, by + 0.5], [x + 0.2, by - hgt - (i % 3 === 0 ? 0.6 : 0)], [x + 1, by + 0.5]], ELEM[i % 3], 0.45 - (i % 2) * 0.25);
        if (mark === "ice_crown") P.poly([[x - 0.7, by + 0.5], [x, by - hgt], [x + 0.7, by + 0.5]], "ice", i % 2 ? 0.1 : 0.5);
        if (mark === "leaf_crown") P.ell(x, by, 1.3, 0.9, "leaf", { s: i % 2 ? 0.3 : -0.1, k: 0.6 });
        if (mark === "storm_crown") P.poly([[x - 0.8, by + 0.5], [x + 0.4, by - hgt * 0.55], [x - 0.3, by - hgt * 0.5], [x + 0.6, by - hgt - 0.4], [x + 0.9, by - hgt * 0.4], [x + 0.2, by - hgt * 0.45], [x + 0.9, by + 0.5]], i % 2 ? "#a8dcff" : "#e8f6ff", 0.3);
      }
      return;
    }
    const y0 = CROWN_Y[c.head] || 10, wide = c.head === "none" || c.head === "circlet" || c.head === "crown" || c.head === "mask" ? 6 : 6.8;
    switch (mark) {
      case "antlers": {
        // over headgear the antlers grow from the brim's edges instead of the scalp
        const bare = c.head === "none" || c.head === "circlet", bx = bare ? 4 : c.faceW + 1, by = bare ? 9 : Math.min(10, y0 + 1.5);
        for (const side of [-1, 1]) {
          P.line(cx + side * bx, by, cx + side * (bx + 5), by - 8, "antler", 0.1);
          P.line(cx + side * (bx + 2.5), by - 4, cx + side * (bx + 7), by - 5, "antler", -0.1);
          P.line(cx + side * (bx + 4), by - 6.5, cx + side * (bx + 3), by - 10, "antler", 0.2);
        }
        break;
      }
      case "leaf_crown":
        for (let i = 0; i < 9; i++) P.ell(cx - wide - 1 + i * (wide * 2 + 2) / 8, y0 - 0.5 + Math.abs(i - 4) * 0.5, 1.4, 1, "leaf", { s: i % 2 ? 0.3 : -0.1, k: 0.6 });
        break;
      case "ice_crown":
        P.rect(cx - wide, y0, wide * 2, 1, "ice", 0.1);
        for (const [x, hgt] of [[-5, 2], [-2.5, 4], [0, 6], [2.5, 4], [5, 2]]) P.poly([[cx + x - 1, y0], [cx + x, y0 - hgt], [cx + x + 1, y0]], "ice", x < 0 ? 0.5 : 0.1);
        break;
      case "elemental_crown":
        P.rect(cx - wide, y0, wide * 2, 1, "gold", 0.2);
        for (const [x, hgt, i] of [[-5.5, 4, 1], [-2.7, 6.5, 0], [0, 8.5, 2], [2.7, 6.5, 0], [5.5, 4, 1]]) P.poly([[cx + x - 1.1, y0], [cx + x + 0.2, y0 - hgt], [cx + x + 1.3, y0]], ELEM[i], x < 0 ? 0.45 : 0.1);
        P.px(cx - 0.5, y0, "#fff8d0");
        break;
      case "storm_crown":
        // a band of dark iron with lightning forking up from it, the tallest bolt at the brow
        P.rect(cx - wide, y0, wide * 2, 1, "storm", 0.3);
        for (const [x, hgt, m] of [[-5.2, 4.5, "#a8dcff"], [-2.4, 6.5, "#fff35a"], [0.5, 8.5, "#e8f6ff"], [3.4, 6.5, "#fff35a"], [6, 4.5, "#a8dcff"]])
          P.poly([[cx + x - 1.4, y0], [cx + x + 0.8, y0 - hgt * 0.58], [cx + x - 0.5, y0 - hgt * 0.5], [cx + x + 1.1, y0 - hgt], [cx + x + 1.7, y0 - hgt * 0.4], [cx + x + 0.4, y0 - hgt * 0.46], [cx + x + 1.4, y0]], m, 0.35);
        P.px(cx + 0.5, y0, "#a0d8ff");
        break;
      case "flame_crown":
        P.rect(cx - wide, y0, wide * 2, 1, "gold", 0.2);
        for (const [x, hgt] of [[-5, 3], [-2, 5], [1, 6], [4, 4]]) P.poly([[cx + x - 1.2, y0], [cx + x + 0.4, y0 - hgt], [cx + x + 1.6, y0]], "flame", 0.4);
        break;
    }
  }

  const ELEM = ["flame", "ice", "#f8e050"];
  // the finer marks, drawn natively at each size: portrait in head space (eyes at y 17, x 16-17 and 22-23), sprite in its own
  // pixels (eyes at y 10, x 12 and 15; the head spans about x 9-19, its top near y 3). part "back" goes behind the head.
  const GLYPHS = [["01110", "10101", "11111", "00100", "01010"], ["10001", "11011", "00100", "01110", "00100"], ["00100", "01110", "10101", "00100", "11111"]];
  const GLYPH_S = [["010", "111", "010", "101"], ["101", "010", "111", "010"]];
  function bitsAt(P, rows, x0, y0, m, s, hot) {
    rows.forEach((r, j) => [...r].forEach((b, i) => { if (b === "1") P.px(x0 + i, y0 + j, hot && hot(i, j) ? "#e8fff8" : m, s - j * 0.12 - i * 0.05); }));
  }
  function ringAt(P, x0, y0, rx, ry, m, s, pick) {
    for (let a = 0; a < 72; a++) { const t = (a / 72) * Math.PI * 2; if (!pick || pick(t)) P.px(x0 + Math.cos(t) * rx - 0.5, y0 + Math.sin(t) * ry - 0.5, m, s(t)); }
  }
  function starAt(P, x, y, big, m) {
    P.px(x, y, "#fff8d0");
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) P.px(x + dx, y + dy, m, 0.4);
    if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, -2], [0, 2]]) P.px(x + dx, y + dy, m, -0.1);
  }
  function fineMark(P, c, part) {
    const tf = P.tf, sp = !!c.sprite, f = c.frame || 0;
    if (sp) P.tf = null;
    switch (c.mark) {
      case "rune_crown":
        if (sp) { bitsAt(P, GLYPH_S[0], 21, 1 + f, "mana", 0.4, (i, j) => i === 1 && j === 1); bitsAt(P, GLYPH_S[1], 23, 8 - f, "mana", 0.3, (i, j) => i === 1 && j === 2); P.px(21, 13, "#b8fff0"); }
        else { bitsAt(P, GLYPHS[0], 2, 1, "mana", 0.45, (i, j) => i === 2 && j === 2); bitsAt(P, GLYPHS[1], 3, 10, "mana", 0.35, (i, j) => i === 2 && j === 3); bitsAt(P, ["010", "111", "010"], 9, 5, "mana", 0.2, (i, j) => i === 1 && j === 1); }
        break;
      case "star_orbit": {
        const [x0, y0, rx, ry] = sp ? [14, 4.6, 10, 2.2] : [20, 8.5, 15, 3.4], front = part !== "back";
        if (sp && !front) break;
        ringAt(P, x0, y0, rx, ry, "mana", (t) => 0.5 - Math.cos(t) * 0.35, (t) => (sp || (Math.sin(t) > 0) === front) && Math.floor(t * 9) % 4 !== 3);
        if (front) { starAt(P, Math.round(x0 - rx * 0.92), Math.round(y0 + ry * 0.4), !sp, "gold"); starAt(P, Math.round(x0 + rx * 0.6), Math.round(y0 + ry * 0.8), false, "gold"); }
        else starAt(P, Math.round(x0 + rx * 0.5), Math.round(y0 - ry * 0.9), true, "gold");
        break;
      }
      case "spectacles":
        if (sp) { P.px(11, 10, "brass", 0.3); P.px(13, 10, "brass", 0.1); P.px(14, 10, "brass", 0.1); P.px(16, 10, "brass", -0.2); P.px(12, 9, "#f4fcff"); P.px(15, 9, "#dceef8"); }
        else {
          for (const ex of [17, 23]) ringAt(P, ex, 17.3, 2.5, 2.2, "brass", (t) => 0.35 - Math.cos(t + 0.8) * 0.4);
          P.px(19, 16.5, "brass", 0.3); P.px(20, 16.5, "brass", 0.1);
          P.line(14.6, 16.6, 12.6, 15.8, "brass", -0.2); P.line(25.4, 16.6, 27.4, 15.8, "brass", -0.4);
          P.px(15.6, 15.6, "#f4fcff"); P.px(21.6, 15.6, "#f4fcff");
        }
        break;
      case "domino":
        if (sp) {
          for (let x = 10; x <= 17; x++) for (const y of [9, 10]) if (!(y === 10 && (x === 12 || x === 15))) P.px(x, y, "illus", (y === 9 ? 0.45 : 0) - (x - 10) * 0.06);
          P.px(10, 8, "illus", 0.6); P.px(17, 8, "illus", 0.2); P.px(13, 9, "#fff0fa");
        } else {
          const hole = (x, y) => ((x + 0.5 - 17) / 1.7) ** 2 + ((y + 0.5 - 17.3) / 1.3) ** 2 < 1 || ((x + 0.5 - 23) / 1.7) ** 2 + ((y + 0.5 - 17.3) / 1.3) ** 2 < 1;
          P.poly([[12.2, 13.4], [15, 15], [20, 15.6], [25, 15], [27.8, 13.4], [27, 17.6], [24, 19.6], [21, 19.2], [20, 18.2], [19, 19.2], [16, 19.6], [13, 17.6]], "illus", (x, y) => (hole(x, y) ? false : 0.3 - (y - 15) * 0.12 - (x - 20) * 0.03));
          for (const [x, y] of [[13, 14], [26, 14], [20, 16]]) P.px(x, y, "#fff0fa");
        }
        break;
      case "veil":
        // a dancer's veil: sheer rose silk hooked at the cheeks, falling to a point with a coin at the tip
        if (sp) {
          for (const [y, x0, x1] of [[11, 10, 17], [12, 11, 16], [13, 12, 15], [14, 13, 14]]) for (let x = x0; x <= x1; x++) if (y < 12 || y > 12 || (x + y) % 2 === 0 || x === x0 || x === x1) P.px(x, y, "illus", (y === 11 ? 0.45 : 0.05) - (x - 10) * 0.05);
          P.px(10, 10, "gold", 0.4); P.px(17, 10, "gold", 0); P.px(13, 15, "gold", 0.5); P.px(14, 15, "gold", 0);
        } else {
          P.poly([[12.6, 18.6], [27.4, 18.6], [26, 23.4], [20.6, 29], [19.4, 29], [14, 23.4]], "illus", (x, y) => (y > 19 && (x + y) % 2 && Math.abs(x + 0.5 - 20) < 5.5 - (y - 19) * 0.4 ? false : 0.35 - (x - 20) * 0.03 - (y - 19) * 0.05));
          for (const x of [13, 27]) P.ell(x, 18.6, 1, 1, "gold", { s: 0.4 });
          for (let x = 14; x <= 26; x += 2) P.px(x, 19, "gold", 0.1 + (x % 4 ? 0 : 0.4));
          P.ell(20, 30, 1.2, 1.2, "gold", { s: 0.45 });
        }
        break;
      case "triad": {
        const flame = (x, y, k) => { P.poly([[x - 1.4 * k, y + 1], [x, y - 3 * k], [x + 1.4 * k, y + 1]], "flame", 0.5); P.px(x - 0.5, y, "#fff2b0"); };
        const ice = (x, y, k) => { P.poly([[x, y - 2.5 * k], [x + 1.3 * k, y], [x, y + 2.5 * k], [x - 1.3 * k, y]], "ice", 0.45); P.px(x - 0.5, y - 1, "#ffffff"); };
        const spark = (x, y, k) => { P.line(x - k, y - 2 * k, x + 0.3, y - 0.2, "#f8e050"); P.line(x + 0.3, y - 0.2, x - 0.5, y + 0.4, "#f8e050"); P.line(x - 0.5, y + 0.4, x + k, y + 2 * k, "#fff8c0"); };
        if (sp) { flame(21.5, 4 + f, 1); ice(24.5, 9 - f, 1); spark(21.5, 13, 1); }
        else { ice(4.5, 3.5, 1.6); flame(9, 6.5, 1.6); spark(4.5, 13, 1.5); }
        break;
      }
      case "raincloud": {
        const [x0, y0, k] = sp ? [20.5, 1.2, 0.6] : [8, 2.5, 1];
        for (const [dx, dy, r] of [[-3.6, 0.8, 2.4], [0, -0.6, 3.2], [3.8, 0.6, 2.6]]) P.ell(x0 + dx * k * 1.15, y0 + dy * k, r * k + 0.3, r * k * 0.8 + 0.3, "cloud", { s: 0.2 });
        const drops = sp ? [[18, 4], [20, 5], [22, 4], [24, 5]] : [[4, 6.5], [7, 8.5], [10, 6.5], [13, 8.5], [5.5, 11.5], [11.5, 11.5]];
        drops.forEach(([x, y], i) => { const yy = y + ((f + i) % 2) * (sp ? 1 : 2); P.px(x, yy, "#9ad0f4"); P.px(x, yy + 1, "#5a98d8"); });
        break;
      }
      case "thundercloud": {
        // a squall that follows the hero about: a dark cloud beside the head with a bolt forking out of it
        const [x0, y0, k] = sp ? [21.6, 2, 0.78] : [8, 2.5, 1];
        for (const [dx, dy, r] of [[-3.6, 0.8, 2.4], [0, -0.6, 3.2], [3.8, 0.6, 2.6]]) P.ell(x0 + dx * k * 1.15, y0 + dy * k, r * k + 0.3, r * k * 0.8 + 0.3, "storm", { s: 0.15, fn: (x, y, s, nx, ny) => s + (ny < -0.4 ? 0.45 : ny > 0.45 ? -0.35 : 0) });
        if (sp) {
          for (const [x, y] of f ? [[22, 4], [21, 5], [21, 6], [22, 7], [21, 8], [20, 9]] : [[21, 4], [22, 5], [22, 6], [21, 7], [22, 8], [23, 9]]) P.px(x, y, y === 6 || y === 7 ? "#fff8c0" : "#f8e050");
          P.px(19, 0, "cloud", 0.5); P.px(20, 0, "cloud", 0.3); P.px(23, 0, "cloud", 0.2);
        }
        else {
          P.poly(f ? [[9, 5], [11, 5], [9.5, 8], [11.5, 8], [7, 14], [8, 9.4], [6.2, 9.4]] : [[7.5, 5], [9.5, 5], [8, 8], [10, 8], [5.5, 14], [6.5, 9.4], [4.8, 9.4]], "#f8e050", 0.4);
          P.px(f ? 9 : 7.5, 8, "#fff8c0"); P.ell(6, 0.8, 1.6, 1, "cloud", { s: 0.4 });
        }
        break;
      }
      case "eyepatch": {
        // a black patch over the eye that isn't needed: the strap shows only on skin and hair, never over a hat
        const bare = (x, y) => { const [X, Y] = P.tf ? P.T(x + 0.5, y + 0.5) : [x + 0.5, y + 0.5], m = P.matAt(Math.floor(X), Math.floor(Y)); return m === "skin" || m === "hair"; };
        if (sp) { for (let x = 9; x <= 18; x++) { const y = Math.round(7.6 + (x - 9) * 0.25); if (bare(x, y) && x !== 15) P.px(x, y, "#2a2224"); } P.px(15, 10, "#1e1a1c"); P.px(16, 10, "#2a2224"); P.px(15, 9, "#2a2224"); }
        else {
          for (let x = 11; x <= 29; x++) { const y = 12.6 + (x - 11) * 0.16; if (bare(x, y)) P.px(x, y, "#2a2224", 0); }
          P.ell(22.8, 17.2, 2.4, 2.1, "#1e1a1c"); P.px(22, 16, "#4a4048");
        }
        break;
      }
      case "spirits": {
        // the dead who answer: two pale wisps hanging about the head, a dark eye each, their tails trailing off
        const wisp = (x, y, r, tail) => {
          P.ell(x, y, r, r * 1.1, "ghost", { s: 0.35 });
          P.poly([[x - r, y + r * 0.3], [x + r, y + r * 0.3], [x + tail, y + r * 3]], "ghost", (xx, yy) => -0.1 - (yy - y) * 0.06);
          P.px(x - r * 0.45, y - r * 0.1, "#2a4a3a"); P.px(x + r * 0.35, y - r * 0.1, "#2a4a3a");
        };
        if (sp) {
          for (const [x, y, t] of [[22, 3 + f, 1], [5, 8 - f, -1]]) { P.px(x, y, "ghost", 0.5); P.px(x + 1, y, "ghost", 0.2); P.px(x, y + 1, "ghost", 0.1); P.px(x + 1, y + 1, "ghost", -0.1); P.px(x + (t > 0 ? 1 : 0), y + 2, "ghost", -0.3); P.px(x + (t > 0 ? 2 : -1), y + 3, "ghost", -0.5); }
          P.px(22, 4 + f, "#2a4a3a");
        } else { wisp(5.5, 6 + f, 2.6, -2); wisp(34.5, 3.5 - f, 2, 2.2); }
        break;
      }
      case "goggles":
        if (sp) { for (const x of [9, 10, 13, 14, 17, 18]) P.px(x, 7, "dleather", -0.2); for (const x0 of [11, 15]) { P.px(x0, 6, "#e8fbff"); P.px(x0 + 1, 6, "#78c0d8"); P.px(x0, 7, "#5aa8c8"); P.px(x0 + 1, 7, "#3a7aa0"); } }
        else {
          P.rect(12.5, 11.5, 15, 1.6, "dleather", -0.1);
          for (const ex of [16.5, 23.5]) { P.ell(ex, 12, 2.9, 2.6, "brass", { s: 0.3 }); P.ell(ex, 12, 1.8, 1.6, "#6ab4d0"); P.px(ex - 1.5, 11, "#e8fbff"); P.px(ex, 12.5, "#3a7aa0"); }
        }
        break;
      case "warpaint":
        if (sp) { for (const [x, y] of [[11, 11], [11, 12], [16, 11], [16, 12], [13, 8], [14, 8]]) P.px(x, y, "warp", y === 11 ? 0.4 : 0.1); }
        else { for (const [x0, x1] of [[15.6, 15], [17.6, 17], [22.4, 23], [24.4, 25]]) P.line(x0, 19, x1, 22.4, "warp", 0.2); P.rect(19.5, 11.5, 1, 3, "warp", 0.1); }
        break;
      case "rose":
        if (sp) { P.px(11, 13, "leaf", 0); P.px(12, 13, "leaf", -0.2); for (const [x, y, s] of [[15, 12, 0.5], [16, 12, 0.1], [15, 13, 0], [16, 13, -0.4]]) P.px(x, y, "rosec", s); P.px(15, 14, "leaf", 0.2); }
        else { P.line(14.5, 23.5, 22, 22.6, "leaf", 0.1); P.ell(15.6, 24.4, 1.3, 0.8, "leaf", { s: 0.3 }); P.ell(24, 22.2, 2.1, 2, "rosec", { s: 0.25 }); P.px(23.5, 21.5, "rosec", -0.6); P.px(24, 22, "#ffd0d8"); }
        break;
      case "claw_scars": {
        // three healed rakes from brow to cheek, only on bare skin (a cap's brim hides their tops) and skipping the eye
        const onSkin = (x, y) => { const [X, Y] = P.tf ? P.T(x + 0.5, y + 0.5) : [x + 0.5, y + 0.5]; return P.matAt(Math.floor(X), Math.floor(Y)) === "skin"; };
        if (sp) { for (const [x, y] of [[13, 6], [14, 7], [15, 6], [16, 7], [16, 9], [16, 10], [16, 11], [17, 12], [17, 6], [18, 7], [18, 8], [18, 9], [18, 10], [18, 11]]) if (onSkin(x, y)) P.px(x, y, "scarp", 0.25 - (y - 7) * 0.04); }
        else for (const [x0, x1] of [[21, 23.6], [23.2, 25.8], [25.4, 27.4]]) for (let y = 10; y <= 23; y++) {
          const x = x0 + ((x1 - x0) * (y - 10)) / 13;
          if (y >= 15.5 && y <= 18 && x > 21 && x < 24.5) continue;
          if (!onSkin(x, y)) continue;
          P.px(x, y, "scarp", 0.35 - Math.abs(y - 16) * 0.03);
          if (onSkin(x + 1, y)) P.px(x + 1, y, "skin", -0.55);
        }
        break;
      }
    }
    P.tf = tf;
  }
  // body marks: sprite in its own pixels (off hand at 20-21, 24-25; belt at y 24), portrait in head space below the chin
  // the bust ends just under the chest, so what hangs at the hip is raised into frame there
  const HIP_LIFT = { wanted_poster: 1.5, satchel: 2.5, mortar: 3, poison_vial: 3.2, ladle: 3 };
  function bodyMark(P, c, sp, part) {
    const f = c.frame || 0, tf0 = P.tf;
    if (part === "back" && !BEHIND.has(c.mark)) return;
    if ((part === "torso") !== (c.mark === "tabard")) return;
    if (!sp && tf0 && HIP_LIFT[c.mark]) P.tf = Object.assign({}, tf0, { oy: tf0.oy - HIP_LIFT[c.mark] });
    switch (c.mark) {
      case "ward_sigil": {
        const [x0, y0, r] = sp ? [24, 19, 3.4] : [34, 25, 5.2];
        const pts = [0, 1, 2, 3, 4, 5].map((i) => [x0 + Math.cos(i * Math.PI / 3 + Math.PI / 6) * r, y0 + Math.sin(i * Math.PI / 3 + Math.PI / 6) * r]);
        for (let i = 0; i < 6; i++) P.line(pts[i][0], pts[i][1], pts[(i + 1) % 6][0], pts[(i + 1) % 6][1], "mana", i < 3 ? -0.2 : 0.5);
        if (sp) { P.px(x0 - 0.5, y0 - 1.5, "#b8fff0"); P.px(x0 - 0.5, y0 - 0.5, "mana", 0.6); P.px(x0 - 0.5, y0 + 0.5, "mana", 0.2); P.px(x0 - 1.5, y0 - 0.5, "mana", 0.3); P.px(x0 + 0.5, y0 - 0.5, "mana", 0.1); }
        else { bitsAt(P, GLYPHS[2], x0 - 2.5, y0 - 2.5, "mana", 0.5); P.px(x0 - 0.5, y0 - 0.5, "#e8fff8"); }
        break;
      }
      case "pendulum": {
        // a hypnotist's watch held out on its chain from the free hand: a broad gold face with a rose spiral, swinging between
        // the frames, the far end of its arc left as a faint trail
        const sw = f ? 1 : -1;
        if (sp) {
          P.px(21, 26, "silver", 0.4); P.px(21, 27, "silver", 0.1); P.px(21 + (sw > 0 ? 1 : 0), 28, "silver", -0.1);
          const x0 = 21.5 + sw * 1.2, y0 = 30.2;
          P.ell(x0, y0, 2.2, 2.2, "gold", { s: 0.2, fn: (x, y, s, nx, ny) => s + (nx * nx + ny * ny > 0.55 ? -0.35 : 0.25) - nx * 0.2 - ny * 0.2 });
          P.px(x0 - 0.5, y0 - 0.5, "illus", 0.1); P.px(x0 + 0.5, y0 - 0.5, "illus", -0.3); P.px(x0 - 0.5, y0 + 0.5, "illus", -0.4);
          P.px(x0 - 1.5, y0 - 1.5, "#fff8d0");
          P.px(21.5 - sw * 2.4, 29.5, "illus", 0.5);
        } else {
          const x0 = 32 + sw * 1.6, y0 = 36;
          P.line(30.5, 27, x0, y0 - 3.4, "silver", 0.3, 0.45);
          P.ell(x0, y0 - 3.6, 0.9, 0.9, "gold", { s: 0.4 });
          P.ell(x0, y0, 3.4, 3.4, "gold", { s: 0.25, fn: (x, y, s, nx, ny) => s + (nx * nx + ny * ny > 0.62 ? -0.4 : 0.15) - nx * 0.15 - ny * 0.15 });
          ringAt(P, x0 + 0.5, y0 + 0.5, 1.9, 1.9, "illus", (t) => 0.3 - Math.cos(t + 0.8) * 0.3, (t) => Math.floor(t * 2.2) % 3 !== 2);
          P.px(x0, y0, "illus", 0.6); P.px(x0 - 2, y0 - 2, "#fff8d0");
          for (let i = 0; i < 4; i++) P.px(32 - sw * (2.5 + i * 0.9), 35.4 - i * 0.7, "illus", 0.4 - i * 0.25);
        }
        break;
      }
      case "trap_belt": {
        // closed steel jaws with the teeth interlocked, hung by a short chain: S light jaw, s dark jaw, t tooth, g the gap
        const map = [".SSSSS.", "StgtgtS", "sgtgtgs", ".sssss."], [x0, y0, k] = sp ? [19, 27, 1] : [5, 34, 2];
        if (sp) { P.px(20, 25, "dmetal", 0.4); P.px(21, 26, "dmetal", 0); }
        else for (let i = 0; i < 3; i++) P.rect(12 - i * 1.6, 30 + i * 1.3, 1.4, 1.4, "dmetal", 0.4 - i * 0.2);
        map.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") P.rect(x0 + i * k, y0 + j * k, k, k, ch === "t" ? "#ece8de" : ch === "g" ? "#1e1a20" : "omet", ch === "S" ? 0.55 - i * 0.05 : -0.35); }));
        break;
      }
      case "rope_coil":
        if (sp) {
          P.line(19, 17.5, 9.5, 24.5, "rope", (t) => (Math.floor(t * 14) % 2 ? 0.45 : -0.1));
          P.ell(8.5, 26, 2.2, 1.8, "rope", { s: 0.2, fn: (x, y, s, nx, ny) => (nx * nx + ny * ny < 0.3 ? false : s + ((x + y) % 2 ? 0.3 : -0.2)) });
          P.px(19, 16, "leaf", 0.4); P.px(20, 16, "leaf", 0);
        } else {
          for (const o of [0, 1]) P.line(32 + o, 28, 10 + o, 40, "rope", (t) => (Math.floor(t * 30) % 2 ? 0.45 : -0.15));
          for (const [dx, dy] of [[0, 0], [1.2, 1.2]]) P.ell(30.5 + dx, 31 + dy, 3.4, 2.6, "rope", { s: 0.2, fn: (x, y, s, nx, ny) => (nx * nx + ny * ny < 0.45 ? false : s + ((x + y) % 3 ? 0.2 : -0.35)) });
          P.ell(34.5, 28.5, 1.6, 1, "leaf", { s: 0.3 }); P.ell(35.5, 29.8, 1.4, 0.9, "leaf", { s: -0.1 });
        }
        break;
      case "spellhand": {
        // a spell held ready in the off hand: a bright core, and a flame, an ice shard and a spark circling it
        const [x0, y0, r] = sp ? [21.5, 21.5, 4] : [31, 29.5, 5.6], a0 = f * 1.05;
        if (sp) {
          for (const [x, y, m] of [[21, 19, "#f8e050"], [19, 21, "#f8e050"], [23, 21, "#ffd070"], [21, 23, "#ffd070"]]) P.px(x, y, m);
          P.rect(20, 20, 3, 3, "#ffe8a0"); P.px(20, 20, "#ffffff"); P.px(21, 20, "#fffbe8"); P.px(20, 21, "#fffbe8");
        } else {
          P.ell(x0, y0, 3.2, 3.2, "#f8d870"); P.ell(x0, y0, 2.3, 2.3, "#ffe8a0"); P.ell(x0 - 0.5, y0 - 0.5, 1.2, 1.2, "#fffbe8"); P.px(x0 - 1, y0 - 1, "#ffffff");
        }
        ELEM.forEach((m, i) => {
          const t = a0 + i * 2.094 - 1.9, x = x0 + Math.cos(t) * r, y = y0 + Math.sin(t) * r * 0.8;
          if (sp) { P.rect(Math.round(x - 1), Math.round(y - 1), 2, 2, m, (xx, yy) => (xx + yy) % 2 ? 0.55 : -0.1); }
          else { P.ell(x, y, 1.8, 1.8, m, { s: 0.4 }); P.px(x - 0.5, y - 0.5, "#fffbe8"); }
        });
        break;
      }
      case "whip": {
        // a driver's whip coiled on the hip: a tan braided loop, the handle in the belt, the lash's tail hanging free
        const [x0, y0, rx, ry] = sp ? [20.5, 28.5, 2.6, 2] : [9, 35.5, 4.4, 3.2];
        for (const d of [0, sp ? 1 : 1.4]) P.ell(x0 + d * 0.4, y0 + d * 0.6, rx, ry, "rope", { s: 0.25 - d * 0.25, fn: (x, y, s, nx, ny) => (nx * nx + ny * ny < 0.35 ? false : s + ((x + y) % 2 ? 0.25 : -0.2)) });
        if (sp) { P.px(18, 25, "dwood", 0.3); P.px(18, 26, "dwood", 0); P.px(23, 30, "rope", -0.2); P.px(23, 31, "rope", -0.3); P.px(24, 32, "rope", -0.4); }
        else { P.line(12, 31.5, 9.5, 28.5, "dwood", 0.3, 0.7); P.px(9, 28, "gold", 0.4); P.line(6, 38, 4, 41, "rope", -0.3); }
        break;
      }
      case "woad": {
        // blue war paint on the face and the bare arms (the clothes stay on: owner, 2026-10-19); anything worn over the skin hides it
        const at = (x, y) => { const [X, Y] = P.tf ? P.T(x + 0.5, y + 0.5) : [x + 0.5, y + 0.5]; return P.matAt(Math.floor(X), Math.floor(Y)); };
        const paint = (pts, s) => { for (const [x, y, d] of pts) if (at(x, y) === "skin") P.px(x, y, "woad", s + (d || 0)); };
        if (sp) {
          // the near half of the face, ragged at the nose and the jaw
          const half = [];
          for (const [y, x0, x1] of [[8, 10, 12], [9, 10, 13], [10, 10, 13], [11, 10, 14], [12, 10, 12], [13, 11, 11]]) for (let x = x0; x <= x1; x++) half.push([x, y, 0.3 - (x - 10) * 0.12 - (y - 8) * 0.06]);
          paint(half, 0);
          paint([[6, 19, 0.3], [7, 19], [20, 19, -0.1], [21, 19, -0.3], [6, 21, 0.1], [7, 21, -0.2]], 0);
          for (const x of [12, 15]) { const m = at(x, 10); if (m && m[0] === "#" && (at(x - 1, 10) === "woad" || at(x + 1, 10) === "woad")) P.px(x, 10, "#f2e6cc"); }
          // the war cry: the mouth thrown open
          for (const [x, y] of [[13, 13], [14, 13], [13, 14], [14, 14]]) if (["skin", "lip", "stub"].includes(at(x, y))) P.px(x, y, y === 13 ? "#3a1a1c" : "#2a1216");
        } else {
          const cx = c.cx;
          const half = [];
          for (let y = 12; y <= 25; y++) for (let x = cx - 9; x <= cx; x++) {
            const edge = cx - 1 + ((y * 7) % 3 === 0 ? 1 : 0) - (y > 20 ? 1 : 0), foot = 21 + ((x * 5) % 4 === 0 ? 3 : (x * 3) % 4 === 1 ? 1 : 0);
            if (x <= edge && y <= foot) half.push([x, y, 0.3 - (x - cx + 9) * 0.05 - (y - 12) * 0.03]);
          }
          paint(half, 0);
          // the war cry: the mouth thrown open on a row of teeth
          for (let y = 21; y <= 24; y++) for (let x = cx - 2; x <= cx + 1; x++) {
            if (!["skin", "lip", "stub", "woad"].includes(at(x, y)) || ((y === 21 || y === 24) && (x === cx - 2 || x === cx + 1))) continue;
            P.px(x, y, y === 21 ? "#ece4d0" : y === 24 ? "lip" : "#2a1216", y === 24 ? -0.4 : 0);
          }
        }
        break;
      }
      case "trophy_cord":
        // a thong strung with fangs and dark claws, worn shoulder to hip
        if (sp) {
          P.line(19, 17.5, 9.5, 24.5, "strap", -0.1);
          for (const [x, y, m] of [[17, 20, "bone"], [15, 21, "antler"], [13, 23, "bone"], [11, 24, "antler"]]) P.px(x, y, m, 0.5);
          P.px(14, 23, "bone", 0.2); P.px(14, 24, "bone", -0.2);
        } else {
          P.line(31.5, 26, 11, 37.5, "strap", -0.15, 0.6);
          [0.1, 0.24, 0.38, 0.52, 0.66, 0.8].forEach((q, i) => {
            const x = 31.5 - q * 20.5, y = 26 + q * 11.5 + 0.8, big = i === 2;
            if (i % 2 === 0) P.poly([[x - 1.1, y], [x + 1.1, y], [x + 0.2, y + (big ? 4.2 : 3)]], "bone", (xx) => 0.45 - (xx - x) * 0.25);
            else P.poly([[x - 0.9, y], [x + 0.9, y], [x - 0.6, y + 2.6]], "antler", -0.15);
          });
        }
        break;
      case "hunting_horn": {
        // a curled horn slung on a strap from the far shoulder, its brass bell at the hip
        if (sp) {
          P.line(9, 17.5, 18.5, 25, "strap", -0.05);
          const map = ["b.....", "hh...B", ".hh.hB", "..hhhB"];
          map.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") P.px(19 + i, 26 + j, ch === "h" ? "horn" : "brass", ch === "h" ? 0.45 - j * 0.25 : 0.3 - j * 0.2); }));
        } else {
          P.line(9, 27, 27, 35.4, "strap", -0.05, 0.7);
          const pts = [];
          for (let i = 0; i <= 12; i++) { const q = i / 12; pts.push([26.5 + q * 9.5, 31.6 + Math.sin(q * Math.PI * 0.95) * 3.6 - q * 1.8]); }
          for (let i = 0; i < pts.length; i++) { const r = 0.7 + (i / 12) * 1.4; P.ell(pts[i][0], pts[i][1], r, r, "horn", { s: 0.2, k: 0.8 }); }
          for (const q of [0.3, 0.62]) { const p = pts[Math.round(q * 12)], r = 0.9 + q * 1.5; P.rect(p[0] - 0.5, p[1] - r, 1, r * 2, "brass", 0.35); }
          const e = pts[12];
          P.ell(e[0] + 0.6, e[1], 1.3, 2.6, "brass", { s: 0.3 }); P.ell(e[0] + 0.9, e[1], 0.6, 1.6, "dwood", { s: -0.4 });
          P.ell(pts[0][0] - 0.4, pts[0][1], 0.7, 0.7, "brass", { s: 0.4 });
        }
        break;
      }
      case "wanted_poster":
        // a bounty notice folded into the belt: parchment, a scrawled face and a red wax seal
        if (sp) {
          for (const [y, x0, x1] of [[21, 18, 19], [22, 18, 20], [23, 18, 20], [24, 18, 20], [25, 18, 20]]) for (let x = x0; x <= x1; x++) P.px(x, y, "parch", 0.4 - (x - 18) * 0.2 - (y - 21) * 0.06);
          P.px(19, 22, "dwood", 0.1); P.px(19, 25, "crim", 0.4); P.px(20, 21, "parch", -0.5);
        } else {
          P.poly([[27.4, 28.6], [35.6, 29.6], [34.8, 39.6], [26.4, 38.8]], "parch", (x, y) => 0.4 - (x - 27) * 0.05 - (y - 29) * 0.03 + ((x * 3 + y * 2) % 11 === 0 ? -0.25 : 0));
          P.poly([[34, 29.4], [35.6, 29.6], [35.4, 31.4]], "parch", -0.6);
          P.line(28.6, 30.4, 33.6, 31, "dwood", 0.1, 0.45);
          ringAt(P, 31, 34, 1.9, 2, "dwood", () => 0.1, (a) => Math.floor(a * 3) % 3 !== 2);
          P.px(30, 33.5, "dwood", 0); P.px(31.6, 33.5, "dwood", 0);
          P.line(28.4, 37, 31.6, 37.3, "dwood", 0.2, 0.4);
          P.ell(33.4, 37.6, 1.3, 1.2, "crim", { s: 0.35 });
        }
        break;
      case "satchel":
        // an herb satchel on a strap from the far shoulder, sprigs and a flower poking out under the flap
        if (sp) {
          P.line(9, 17.5, 19, 25.5, "strap", -0.05);
          for (const [x, y, m, s] of [[19, 24, "leaf", 0.4], [20, 23, "leaf", 0.2], [21, 24, "herb", 0.3], [22, 24, "leaf", -0.1], [20, 22, "feather", 0.3]]) P.px(x, y, m, s);
          P.rect(19, 25, 4, 4, "leather", (x, y) => 0.3 - (x - 19) * 0.15 - (y - 25) * 0.08);
          P.rect(19, 25, 4, 2, "dleather", (x, y) => (y === 25 ? 0.35 : 0) - (x - 19) * 0.1);
          P.px(20, 26, "gold", 0.3);
        } else {
          P.line(9, 28, 29, 37, "strap", -0.05, 0.7);
          for (const [x0, y0, x1, y1, m] of [[30, 32, 29, 27.6, "leaf"], [32, 32, 32.6, 27, "herb"], [34, 32, 36, 28, "leaf"], [35.5, 32.5, 38, 30, "sage"]]) {
            P.line(x0, y0, x1, y1, m, 0.2, 0.45);
            P.ell(x1, y1, 1.2, 0.8, m, { s: 0.35, k: 0.6 });
          }
          for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) P.px(32.6 + a, 26.2 + b, "feather", 0.3 - a * 0.15);
          P.px(32.6, 26.2, "gold", 0.4);
          P.poly([[28, 32.5], [37.5, 32.5], [38, 40], [27.5, 40]], "leather", (x, y) => 0.3 - (x - 28) * 0.05 - (y - 32) * 0.04);
          P.poly([[27.6, 31.6], [37.8, 31.6], [37.2, 35.6], [32.6, 36.6], [28.2, 35.6]], "dleather", (x, y) => (y < 32.6 ? 0.35 : 0.05) - (x - 28) * 0.04);
          P.rect(32, 35.4, 1.4, 1.6, "gold", 0.35);
        }
        break;
      case "mortar":
        // a small stone mortar on a cord at the hip, its wooden pestle standing in it
        if (sp) {
          P.px(20, 25, "rope", 0.2); P.px(21, 26, "rope", 0);
          P.line(21, 27, 23.5, 23.5, "wood", 0.3);
          P.rect(19, 27, 5, 1, "stone", (x) => 0.5 - (x - 19) * 0.12); P.px(21, 27, "stone", -0.7);
          P.rect(19, 28, 5, 1, "stone", (x) => 0.1 - (x - 19) * 0.12);
          P.rect(20, 29, 3, 1, "stone", (x) => -0.2 - (x - 20) * 0.15);
          P.px(23.5, 23, "wood", 0.5);
        } else {
          P.line(29, 31.4, 31, 34, "rope", 0.2, 0.45); P.line(36.5, 31.4, 35, 34, "rope", -0.1, 0.45);
          P.line(32.4, 34.4, 36.8, 27.2, "wood", 0.25, 0.75);
          P.ell(37, 26.8, 1.2, 1.2, "wood", { s: 0.3 });
          P.ell(33, 36.2, 4.2, 3.2, "stone", { s: 0.15, fn: (x, y, s) => (y < 35 ? false : s + ((x * 5 + y * 3) % 9 === 0 ? -0.35 : 0)) });
          P.ell(33, 35.2, 4.2, 1.2, "stone", { s: 0.45 }); P.ell(33, 35.3, 3, 0.7, "stone", { s: -0.6 });
          P.rect(31, 39, 4, 1, "stone", -0.3);
        }
        break;
      case "poison_vial": {
        // a green glass vial corked and hung on the belt; the brew catches the light, a bubble rising between the frames
        if (sp) {
          P.px(19, 22, "wood", 0.3);
          P.px(19, 23, "glass", 0.4);
          P.rect(18, 24, 3, 2, "tox", (x, y) => 0.55 - (x - 18) * 0.2 - (y - 24) * 0.15);
          P.px(18, 24, "#eaffd0"); P.px(19 + f, 26, "tox", -0.35);
        } else {
          P.line(29, 31.6, 31, 33, "dleather", 0, 0.45);
          P.rect(31.4, 30.6, 2, 1.6, "wood", 0.3);
          P.rect(31.6, 32, 1.6, 2, "glass", (x) => 0.4 - (x - 31.6) * 0.3);
          P.ell(32.4, 36.4, 3, 3, "glass", { s: 0.3 });
          P.ell(32.4, 36.8, 2.6, 2.4, "tox", { s: 0.45, fn: (x, y, s) => (y < 35.6 ? false : s) });
          P.px(31.2, 34.8, "#f4fff0"); P.px(30.6, 35.8, "#eaffd0");
          P.px(33 + f * 0.6, 37.2 - f * 1.4, "#dcffb8");
        }
        break;
      }
      case "tabard": {
        // a cream surcoat over the armour with a cross in the hero's colour and a gold hem
        if (sp) {
          P.rect(11, 18, 6, 9, "moon", (x, y) => 0.35 - (x - 11) * 0.08 - (y - 18) * 0.02);
          P.rect(11, 18, 6, 1, "gold", (x) => 0.35 - (x - 11) * 0.1);
          P.rect(13, 19, 2, 5, "fav", 0.25); P.rect(12, 20, 4, 1, "fav", 0.25);
          P.rect(10, 24, 8, 1, "dleather", -0.1); P.px(13, 24, "gold", 0.3);
          P.rect(11, 26, 6, 1, "gold", (x) => 0.3 - (x - 11) * 0.1);
        } else {
          const free = (x, y) => { const [X, Y] = P.tf ? P.T(x + 0.5, y + 0.5) : [x + 0.5, y + 0.5]; return P.lay[Math.floor(Y) * P.w + Math.floor(X)] !== 3; };
          P.poly([[c.cx - 5.5, 30], [c.cx + 5.5, 30], [c.cx + 7, 41], [c.cx - 7, 41]], "moon", (x, y) => (free(x, y) ? 0.35 - (x - c.cx) * 0.04 : false));
          P.rect(c.cx - 1, 31.5, 2, 7, "fav", (x) => 0.25 - (x - c.cx) * 0.1); P.rect(c.cx - 3.5, 33.5, 7, 2, "fav", (x) => 0.25 - (x - c.cx) * 0.05);
          P.line(c.cx - 5.5, 30, c.cx + 5.5, 30, "gold", 0.2);
        }
        break;
      }
      case "pauldrons":
        // a fortress's shoulders: great rounded spaulders, two lames under each, a gold rivet and a short spike
        for (const side of [-1, 1]) {
          if (sp) {
            const x0 = side < 0 ? 7 : 21;
            P.poly([[x0 - 1, 15], [x0 + 1, 15], [x0 - side * 0.2, 12.6]], "metal", 0.6);
            P.ell(x0, 16.8, 3.7, 2.6, "metal", { s: side < 0 ? 0.35 : -0.05 });
            P.ell(x0, 19, 3.3, 1.3, "metal", { s: side < 0 ? -0.15 : -0.45 });
            for (let dx = -2; dx <= 2; dx++) P.px(x0 + dx, 18, "gold", 0.25 - dx * side * 0.08);
            P.px(x0 - side, 16, "#f4f6fa");
          } else {
            const x0 = c.cx + side * 12.5;
            P.poly([[x0 - 1.6, 26], [x0 + 1.6, 26], [x0 + side * 0.8, 21]], "metal", 0.55);
            P.ell(x0, 30.5, 8, 5.6, "metal", { s: side < 0 ? 0.3 : -0.05 });
            for (let dx = -7; dx <= 7; dx++) { const t = (dx / 7.5) ** 2; P.px(x0 + dx, 33.6 + t * 1.4, "metal", -0.8); P.px(x0 + dx, 35.8 + t * 1.2, "metal", -0.8); }
            for (let dx = -7; dx <= 7; dx++) P.px(x0 + dx, 33 + (dx / 7.5) ** 2 * 1.4, "gold", 0.25 - dx * side * 0.02);
            P.ell(x0 - side * 4, 29.4, 1, 1, "gold", { s: 0.4 });
          }
        }
        break;
      case "trail_scarf": {
        // a long red scarf knotted at the throat, both tails streaming out to one side as they do on someone who never stops moving
        const wave = (q, ph) => Math.sin(q * 4.2 + ph + f * 1.4) * (0.3 + q * 1.1);
        if (sp) {
          P.rect(11, 15, 6, 1, "warp", (x) => 0.4 - (x - 11) * 0.06);
          P.rect(12, 16, 5, 1, "warp", -0.3);
          P.px(17, 15, "warp", 0.55); P.px(17, 16, "warp", 0.2); P.px(18, 16, "warp", -0.1);
          for (const [y0, len, ph, sh] of [[15, 9, 0, 0.35], [16.6, 7, 1.6, -0.25]]) {
            for (let i = 1; i <= len; i++) { const q = i / len; P.px(18 + i, Math.round(y0 - q * 1.6 + wave(q, ph)), "warp", sh - q * 0.25); }
          }
          P.px(27, 13, "cream", -0.1);
        } else {
          const cx = c.cx;
          P.ell(cx, 27.4, 7, 2.3, "warp", { s: 0.1, fn: (x, y, s, nx, ny) => s + (ny < -0.2 ? 0.3 : ny > 0.4 ? -0.35 : 0) + ((x + y) % 5 === 0 ? -0.15 : 0) });
          P.ell(cx + 6, 28.4, 2.1, 1.9, "warp", { s: 0.35 });
          P.ell(cx + 6.2, 28.2, 0.8, 0.7, "warp", { s: 0.7 });
          for (const [y0, len, ph, w, sh] of [[27.2, 13, 0, 2.6, 0.3], [29.8, 10.5, 1.7, 2.2, -0.2]]) {
            for (let i = 0; i <= 24; i++) {
              const q = i / 24, x = cx + 7.6 + q * len, y = y0 - q * 3.4 + wave(q, ph) * 1.6, r = w * (1 - q * 0.45);
              P.ell(x, y, 1.2, r / 2, "warp", { s: sh - q * 0.2 + (i % 6 === 0 ? -0.2 : 0) });
            }
            const ex = cx + 7.6 + len, ey = y0 - 3.4 + wave(1, ph) * 1.6;
            for (const d of [-0.6, 0.6]) P.line(ex, ey + d, ex + 1.6, ey + d * 1.8, "cream", -0.1);
          }
        }
        break;
      }
      case "wolf_mantle":
        // a whole grey wolfskin over the shoulders, its forepaws hanging on the chest
        if (sp) {
          for (let x = 5; x <= 22; x++) P.ell(x + 0.5, 16.6 + ((x + 0.5 - 14) / 8) ** 2 * 1.6 + (x % 2) * 0.4, 1.4, 1.2, "wolf", { s: 0.35 - (x - 13) * 0.05 + (x % 3 === 0 ? 0.3 : 0), k: 0.6 });
          for (const x of [10, 16]) { P.rect(x, 18, 2, 3, "wolf", (xx, y) => 0.2 - (xx - x) * 0.3 - (y - 18) * 0.1); P.px(x, 21, "bone", 0.3); P.px(x + 1, 21, "bone", 0); }
        } else {
          for (let a = 0; a < 26; a++) {
            const q = (a / 25) * Math.PI, x = c.cx - Math.cos(q) * 16.5, y = 31 - Math.sin(q) * 3.6 + (a % 2) * 0.8;
            P.ell(x, y, 2.9, 2.6, "wolf", { s: (a % 3 === 0 ? 0.35 : 0) - (x - c.cx) * 0.03, k: 0.7 });
          }
          for (const s of [-1, 1]) { const x = c.cx + s * 6.5; P.rect(x - 1.5, 32, 3, 5, "wolf", (xx, y) => 0.25 - (xx - x) * 0.12 - (y - 32) * 0.05); for (const dx of [-1, 0, 1]) P.px(x + dx - 0.5, 37, "bone", 0.3 - dx * 0.1); }
        }
        break;
      case "spare_blades":
        // two more swords sheathed crossways on the back, hilts over each shoulder
        if (part !== "back") break;
        for (const side of [-1, 1]) {
          if (sp) {
            const hx = side < 0 ? 6 : 22, tx = side < 0 ? 21 : 7;
            P.line(hx, 12, tx, 29, "silver", 0.2);
            P.line(hx, 12, hx + side * 1.5, 9.5, "dleather", 0.1);
            P.px(hx + side * 2, 9, "gold", 0.4);
            P.line(hx - 1.2, 12.6 + side * 0.9, hx + 1.2, 11.4 - side * 0.9, "gold", 0.3);
          } else {
            const hx = side < 0 ? 5 : 35, tx = side < 0 ? 30 : 10;
            P.line(hx, 24, tx, 44, "silver", 0.25, 0.7);
            P.line(hx, 24, hx + side * 2.5, 19.5, "dleather", 0.1, 0.7);
            P.ell(hx + side * 2.8, 19, 1.1, 1.1, "gold", { s: 0.4 });
            P.line(hx - 2.4, 25.6 + side * 1.6, hx + 2.4, 22.4 - side * 1.6, "gold", 0.3, 0.6);
          }
        }
        break;
      case "slung_lute":
        // the bard's own lute slung on the back belly up, its round body over the far shoulder, unless it's in the hand
        if (c.k.w.family === "lute") break;
        if (part === "back") {
          if (sp) {
            P.line(20, 13, 9, 27, "dwood", 0.1);
            P.ell(21.6, 9.6, 3.2, 3.8, "wood", { s: 0.3 }); P.ell(21.4, 9.4, 1, 1, "dwood", { s: -0.6 }); P.rect(20, 12, 3, 1, "dwood", 0.2); P.px(20, 7, "wood", 0.8);
          } else {
            P.line(31, 26, 14, 42, "dwood", 0.1, 1.1);
            P.ell(33, 20.5, 5.6, 6.8, "wood", { s: 0.25 }); P.ell(32.6, 20, 1.7, 1.7, "dwood", { s: -0.6 });
            ringAt(P, 32.6, 20, 2.6, 2.6, "gold", (t) => 0.3 - Math.cos(t + 0.8) * 0.3, (t) => Math.floor(t * 4) % 2 === 0);
            P.rect(30, 24.5, 6, 1.2, "dwood", 0.2); for (const x of [31.4, 32.6, 33.8]) P.line(x, 14, x, 24.5, "#e8e0c8", 0.1);
          }
        } else if (sp) P.line(19.5, 16.6, 9, 25, "strap", -0.05);
        else P.line(c.cx + 12, 28.5, c.cx - 8, 40, "strap", -0.05, 0.6);
        break;
      case "bedroll": {
        // a blanket roll worn horseshoe-fashion over the near shoulder and across to the far hip, tied off in two places:
        // on the back it hid behind the hood and the quiver, across the chest it reads at a glance
        const roll = (x0, y0, x1, y1, r, n) => {
          for (let i = 0; i <= n; i++) {
            const q = i / n, x = x0 + (x1 - x0) * q, y = y0 + (y1 - y0) * q;
            P.ell(x, y, r, r, q < 0.06 || q > 0.94 || Math.abs(q - 0.4) < 0.05 ? "blanket" : "parch", { s: -0.1, fn: (xx, yy, s, nx, ny) => s + (ny < -0.35 ? 0.35 : ny > 0.35 ? -0.45 : 0) + ((xx * 2 + yy) % 7 === 0 ? -0.15 : 0) });
          }
        };
        if (sp) {
          roll(8, 16.5, 19.5, 24.5, 1.2, 12);
          for (const q of [0.12, 0.62]) { const x = 8 + 11.5 * q, y = 16.5 + 8 * q; P.line(x - 0.6, y + 1.2, x + 0.8, y - 1.2, "strap", 0.1); }
          P.px(20, 26, "blanket", -0.3); P.px(21, 26, "cream", 0);
        } else {
          roll(c.cx - 13, 28.4, c.cx + 9, 42, 2.4, 30);
          for (const x of [c.cx - 13.5, c.cx - 12.5]) P.px(x, 27, "blanket", 0.5);
          for (const q of [0.18, 0.6]) {
            const x = c.cx - 13 + 22 * q, y = 28.4 + 13.6 * q;
            P.line(x - 1.4, y + 2.4, x + 1.6, y - 2.4, "strap", 0.15, 0.6);
            P.px(x + 0.2, y, "gold", 0.35);
          }
          P.line(c.cx - 11, 27.6, c.cx + 6, 38.2, "cream", -0.15, 0.4);
        }
        break;
      }
      case "stag_trophy": {
        // the skull of a great stag strapped on the back, its antlers rising over the far shoulder; on the bust it rides the near
        // shoulder in front, where the quiver and the hat can't hide it
        if ((part === "back") !== sp) break;
        const beam = (x0, y0, x1, y1, w) => (sp ? P.line(x0, y0, x1, y1, "antler", 0.15) : P.line(x0, y0, x1, y1, "horn", -0.1, w * 1.35));
        if (sp) {
          beam(22, 11, 18, 1); beam(24.5, 11, 27.4, 0.6); beam(20.6, 7, 17.4, 6.2); beam(19.4, 4.6, 21.2, 0.6); beam(25.8, 7.4, 27.6, 7); beam(26.4, 4.4, 24.6, 0.4);
          for (const [x, y] of [[18, 1], [27, 1], [21, 1], [25, 1], [17, 6]]) P.px(x, y, "bone", 0.4);
          P.ell(23.3, 12.6, 1.8, 2.2, "bone", { s: 0.3 }); P.px(22, 12, "#2a2224"); P.px(24, 12, "#2a2224"); P.px(23, 14, "bone", -0.3);
        } else {
          beam(4.6, 22, 1.2, 4, 0.8); beam(8, 22, 11.5, 4.5, 0.8); beam(2.6, 12, 0.2, 10.5, 0.6); beam(2, 8, 4.4, 2.5, 0.6); beam(10, 13, 12.8, 11.8, 0.6); beam(10.8, 9, 8.6, 3, 0.6);
          for (const [x, y] of [[1, 4], [11.5, 4.5], [4.4, 2.5], [8.6, 3]]) P.ell(x, y, 0.7, 0.7, "bone", { s: 0.4 });
          P.ell(6.3, 25.5, 2.8, 3.6, "bone", { s: 0.3 }); P.ell(6.3, 29.5, 1.6, 1.8, "bone", { s: 0 }); P.ell(5.1, 25, 0.8, 0.9, "#2a2224"); P.ell(7.5, 25, 0.8, 0.9, "#2a2224");
        }
        break;
      }
      case "ladle":
        // a long ladle stood in a small dented pot that hangs at the hip
        if (sp) {
          P.line(21.5, 26.5, 24.5, 19.5, "silver", 0.35); P.px(24, 19, "silver", 0.6);
          P.rect(19, 26, 4, 3, "dmetal", (x, y) => (y === 26 ? 0.55 : 0.05) - (x - 19) * 0.12);
          P.px(23, 27, "dmetal", -0.2); P.px(21, 28, "dmetal", -0.55);
        } else {
          P.line(32.6, 34, 38.4, 24.6, "silver", 0.4, 0.6);
          P.line(38.4, 24.6, 37.4, 23.6, "silver", 0.3, 0.6);
          P.ell(32.4, 36.6, 4.4, 3.2, "dmetal", { s: 0.1, fn: (x, y, s) => (y < 34.6 ? false : s + ((x - 34) ** 2 + (y - 37.5) ** 2 < 1.6 ? -0.45 : 0)) });
          P.rect(27.8, 34, 9.2, 1.4, "dmetal", (x) => 0.55 - (x - 28) * 0.06);
          P.rect(26.8, 34.6, 1.2, 1, "dmetal", -0.2); P.rect(36.8, 34.6, 1.2, 1, "dmetal", -0.4);
          P.line(28, 32.4, 30, 34, "dleather", 0, 0.4);
        }
        break;
    }
    P.tf = tf0;
  }

  // ---------- off-hands, drawn in sprite space around the left hand (20-21, 24-25); the portrait reuses them scaled ----------
  const dot = (P, x, y, m, s) => P.rect(x, y, 1, 1, m, s);
  const OFF_C = { shield: [21.5, 22.5], tower_shield: [22, 22], tome: [21.5, 24.5], orb: [21.5, 22.5], holy_symbol: [21.5, 21], totem: [21.5, 20], skull: [21.5, 23],
    parrying_dagger: [21.5, 21], lantern: [21.5, 26.5], ledger: [21.5, 24.5], shovel: [22, 20], hammer: [21.5, 19], horn: [22, 22], lute: [22, 21] };
  function offhand(P, art, t, c) {
    const v = (c && c.v) || 0, lit = (x0, y0) => (x, y) => 0.3 - (x - x0) * 0.09 - (y - y0) * 0.03;
    switch (art) {
      case "shield":
        if (t <= 1) {
          P.ell(21.5, 22.5, t ? 3.9 : 3.5, t ? 4.7 : 4.3, t ? "omet" : "wood", { s: 0.1 });
          P.ell(21.5, 22.5, t ? 2.6 : 3.6, t ? 3.4 : 4.4, t ? "fav" : "wood", { s: 0.05, fn: (x, y, s) => s + (!t && (x === 20 || x === 22) ? -0.45 : 0) });
          if (!t) { dot(P, 18, 21, "wood", -0.5); dot(P, 24, 24, "wood", -0.7); }
          P.ell(21.5, 22.5, 1.1, 1.1, t ? "omet" : "dmetal", { s: 0.4 });
        } else {
          const top = t === 3 ? 17 : 17.5, w0 = t === 3 ? 17.5 : 18, w1 = t === 3 ? 25.5 : 25, tip = t === 3 ? 28.5 : 29.5, mid = t === 3 ? 23 : 22;
          P.poly([[w0, top], [w1, top], [w1, mid], [21.5, tip], [w0, mid]], t === 3 ? "gold" : "omet", lit(w0, top));
          P.poly([[w0 + 1, top + 1], [w1 - 1, top + 1], [w1 - 1, mid], [21.5, tip - 1.6], [w0 + 1, mid]], t === 3 ? "shirt" : "fav", lit(w0, top));
          if (t === 2) { P.ell(21.5, 21.5, 1, 1, "omet", { s: 0.4 }); dot(P, w0 + 1, top + 1, "fav", 0.6); }
          else if (v % 3 === 0) { P.rect(21, top + 1, 1, 8.5, "fav", 0); P.rect(w0 + 1, 20, w1 - w0 - 2, 1, "fav", -0.1); }
          else if (v % 3 === 1) { for (let i = 0; i < 4; i++) { dot(P, 21 - i, 19 + i, "fav", 0.1); dot(P, 21 + i, 19 + i, "fav", -0.2); dot(P, 21 - i, 20 + i, "fav", 0); dot(P, 21 + i, 20 + i, "fav", -0.3); } }
          else { P.rect(w0 + 1, top + 1, w1 - w0 - 2, 2, "fav", 0); P.ell(21.5, 23, 1.3, 1.5, "fav", { s: 0 }); }
        }
        break;
      case "tower_shield":
        if (t === 0) {
          P.rect(19, 17, 6, 11, "wood", (x, y) => 0.25 - (x - 19) * 0.1 + (x === 21 || x === 23 ? -0.45 : 0));
          P.rect(19, 18, 6, 1, "leather", -0.1); P.rect(19, 25, 6, 1, "leather", -0.2);
        } else {
          P.rect(19, t === 3 ? 15 : 16, 6, t === 3 ? 13 : 12, t === 3 ? "gold" : "omet", (x) => 0.3 - (x - 19) * 0.12);
          if (t === 1) { P.rect(20, 17, 4, 10, "fav", (x) => 0.2 - (x - 20) * 0.12); P.rect(20, 15, 4, 1, "omet", 0.3); }
          if (t === 2) { P.rect(21, 17, 2, 10, "fav", (x) => 0.1 - (x - 21) * 0.2); for (const [x, y] of [[19, 16], [24, 16], [19, 27], [24, 27], [19, 21], [24, 21]]) dot(P, x, y, "omet", 0.8); P.rect(21, 28, 2, 1, "omet", -0.2); dot(P, 18, 21, "omet", 0.5); }
          if (t === 3) { P.rect(20, 16, 4, 11, "fav", (x) => 0.2 - (x - 20) * 0.12); P.rect(21, 17, 2, 8, "shirt", 0.15); P.rect(20, 19, 4, 2, "shirt", 0.1); P.rect(21, 14, 2, 1, "gold", 0.4); }
        }
        break;
      case "tome": {
        const b = [[20, 23, 4, 4], [20, 22, 4, 5], [19, 22, 5, 6], [19, 21, 5, 7]][t], m = ["favd", "favd", "favd", "night"][t];
        P.rect(b[0], b[1], b[2], b[3], m, (x) => 0.25 - (x - b[0]) * 0.15);
        P.rect(b[0] + b[2] - 1, b[1] + 1, 1, b[3] - 2, "cream", 0);
        P.rect(b[0] + b[2] - 2, b[1] + 1, 2, 1, t === 3 ? "gold" : "omet", 0.4);
        if (t === 1) dot(P, b[0] + 1, b[1] + 2, "gold", 0.4);
        if (t >= 2) for (const [x, y] of [[b[0], b[1]], [b[0], b[1] + b[3] - 1]]) dot(P, x, y, t === 3 ? "gold" : "omet", 0.4);
        if (t === 2) { P.rect(b[0] + 1, b[1] + 2, 2, 1, "omet", 0.2); P.rect(b[0] + 2, b[1] + b[3], 1, 2, "fav", 0); }
        if (t === 3) { dot(P, b[0] + 1, b[1] + 3, "gold", 0.3); dot(P, b[0] + 2, b[1] + 3, "fav", 0.6); dot(P, b[0] + 2, b[1] + 2, "gold", 0.4); dot(P, b[0] + 2, b[1] + 4, "gold", -0.2); P.rect(b[0] + 1, b[1] + b[3], 1, 2, "gold", 0); }
        break;
      }
      case "orb":
        if (t === 0) { P.ell(21.5, 23, 1.8, 1.8, "glass", { s: 0.2 }); dot(P, 21, 22, "#ffffff"); }
        else if (t === 1) { P.ell(21.5, 22.5, 2.2, 2.2, "fav", { s: 0.4 }); dot(P, 21, 21, "#ffffff"); }
        else {
          P.rect(20, 25, 3, 1, t === 3 ? "gold" : "wood", 0.1); dot(P, 19, 24, t === 3 ? "gold" : "wood", 0.2); dot(P, 23, 24, t === 3 ? "gold" : "wood", -0.2);
          P.ell(21.5, 22, t === 3 ? 2.6 : 2.4, t === 3 ? 2.6 : 2.4, t === 3 ? "night" : "glass", { s: 0.25 });
          if (t === 2) { dot(P, 21, 22, "fav", 0.5); dot(P, 22, 23, "fav", 0); }
          else { dot(P, 21, 21, "#fff2c0"); dot(P, 22, 23, "#d8e0ff"); }
          dot(P, 20, 20, "#ffffff");
        }
        break;
      case "holy_symbol": {
        const m = ["wood", "silver", "gold", "gold"][t];
        P.rect(21, 22, 1, 3, t ? "dleather" : "wood", 0);
        if (t <= 1) {
          const rr = t ? 1 : 0;
          for (const [x, y] of [[21, 16.5 - rr], [21, 22.5], [18 - rr, 19.5], [24 + rr, 19.5], [19, 17.5], [23, 17.5], [19, 21.5], [23, 21.5]]) dot(P, x, y, m, 0.2 - (x - 18) * 0.1);
          P.ell(21.5, 20, 2, 2, m, { s: 0.25 });
          dot(P, 21, 19, m, 0.8);
        } else {
          P.rect(19, t === 3 ? 16 : 17, 5, t === 3 ? 6 : 5, m, (x) => 0.3 - (x - 19) * 0.12);
          P.rect(21, t === 3 ? 17 : 18, 1, 3, t === 3 ? "#ffffff" : "shirt", 0.2);
          P.rect(20, t === 3 ? 18 : 19, 3, 1, t === 3 ? "#ffffff" : "shirt", 0.2);
          dot(P, 21, t === 3 ? 15 : 16, m, 0.5);
          if (t === 3) { dot(P, 21, 21, "crim", 0.5); for (const [x, y] of [[18, 15], [24, 15], [17, 18], [25, 18]]) dot(P, x, y, "#fff2a0"); }
        }
        break;
      }
      case "totem":
        if (t === 0) {
          P.rect(21, 19, 1, 8, "bone", (x, y) => 0.3 - (y - 19) * 0.04);
          P.ell(21.5, 18, 1.5, 1.3, "bone", { s: 0.2 }); dot(P, 21, 18, "#16121a"); dot(P, 22, 18, "#16121a");
          dot(P, 22, 20, "feather", 0.2); dot(P, 23, 21, "feather", -0.1); dot(P, 23, 22, "fav", 0);
        } else {
          const top = t === 3 ? 12 : 15;
          P.rect(20, top, 3, 28 - top, t === 3 ? "dwood" : "wood", (x) => 0.3 - (x - 20) * 0.25);
          dot(P, 20, top + 2, t === 3 ? (c && c.ofg) || "#8af09a" : "#16121a"); dot(P, 22, top + 2, t === 3 ? (c && c.ofg) || "#8af09a" : "#16121a"); P.rect(20, top + 4, 3, 1, "dwood", -0.4);
          if (t >= 2) { P.rect(20, top + 6, 3, 1, "fav", 0.1); P.rect(20, top + 9, 3, 1, "fav", -0.1); dot(P, 19, top + 1, "feather", 0.2); dot(P, 23, top + 1, "feather", -0.1); dot(P, 19, top + 2, "fav", 0); }
          if (t === 3) { P.line(20, top, 18, top - 3, "antler", 0.2); P.line(22.5, top, 24.5, top - 3, "antler", -0.1); dot(P, 17, top - 3, "antler", 0.3); dot(P, 25, top - 3, "antler", 0); }
        }
        break;
      case "skull":
        P.ell(21.5, 23, 2.3, 2.1, "bone", { s: t === 0 ? -0.05 : 0.25 });
        P.rect(20.5, 24.5, 2, t >= 2 ? 3 : 1, "bone", -0.2);
        if (t === 0) P.erase(23, 22);
        if (t >= 1) dot(P, 19, 22, "bone", 0.2);
        dot(P, 20, 23, t >= 2 ? "#8af09a" : "#16121a"); dot(P, 22, 23, t >= 2 ? "#8af09a" : "#16121a");
        if (t === 0) { dot(P, 21, 21, "bone", -0.8); dot(P, 22, 22, "bone", -0.8); }
        if (t === 1) dot(P, 20, 21, "#ffffff");
        if (t === 3) { P.rect(19.5, 21, 4, 1, "gold", 0.3); dot(P, 19, 20, "gold", 0.4); dot(P, 21, 20, "gold", 0.4); dot(P, 23, 20, "gold", 0); }
        break;
      case "parrying_dagger": {
        const len = [4, 6, 7, 7][t], top = 24 - len;
        P.rect(21, 24, 1, 2, t ? "dleather" : "wood", 0);
        P.rect(21, top, t === 3 ? 2 : 1, len, "omet", (x) => (x === 21 ? 0.55 : -0.2));
        dot(P, 21, top - 1, "omet", 0.7);
        if (t === 1) P.rect(19, 23, 5, 1, "omet", 0.2);
        if (t === 2) { P.ell(21.5, 23.6, 2.3, 1.2, "omet", { s: 0.1 }); }
        if (t === 3) { P.rect(19, 23, 6, 1, "gold", 0.2); for (const y of [top + 1, top + 3, top + 5]) dot(P, 22, y, "omet", -0.9); }
        break;
      }
      case "lantern": {
        const m = ["omet", "dmetal", "gold", "gold"][t];
        P.line(20, 24.5, 22, 24.5, "dmetal", 0); dot(P, 21, 24, "dmetal", 0);
        if (t >= 2) dot(P, 21, 23, m, 0.4);
        if (t === 1) P.rect(19, 25, 5, 1, "dmetal", 0.2);
        if (t === 0) { dot(P, 21, 25, "#ffd25a"); dot(P, 21, 24.6, "#fff2b0"); }
        P.rect(20, 25.5, 3, 4, m, (x) => 0.3 - (x - 20) * 0.25);
        P.rect(21, 26.5, 1, 2, t === 3 ? "#fff2b0" : "#ffd25a");
        if (t >= 2) dot(P, 20, 27, "#ffe8a0");
        if (t === 3) { for (const y of [25.5, 29.5]) P.rect(19, y, 5, 1, "omet", 0.3); P.rect(20, 30, 3, 1, "omet", -0.2); }
        else P.rect(20.5, 29.5, 2, 1, m, -0.3);
        break;
      }
      case "ledger": {
        const b = [[20, 23, 4, 4], [20, 22, 4, 5], [19, 22, 5, 6], [19, 21, 5, 7]][t], m = ["shirt", "leather", "dleather", "crim"][t];
        P.rect(b[0], b[1], b[2], b[3], m, (x, y) => 0.25 - (x - b[0]) * 0.15 + (t === 0 && (y - b[1]) % 2 ? -0.35 : 0));
        if (t === 0) P.line(b[0], b[1] + 2, b[0] + 3, b[1] + 1, "leather", 0);
        else { P.rect(b[0], b[1] - 1, b[2], 1, "cream", 0.3); for (let y = b[1] + 1; y < b[1] + b[3] - 1; y += 2) dot(P, b[0], y, m, -0.9); }
        if (t === 2) { P.rect(b[0], b[1] + 3, b[2], 1, "leather", 0.1); dot(P, b[0] + 2, b[1] + 3, "gold", 0.4); }
        if (t === 3) { P.ell(b[0] + 2, b[1] + 3.5, 1.2, 1.2, "gold", { s: 0.3 }); for (const [x, y] of [[b[0], b[1]], [b[0], b[1] + b[3] - 1]]) dot(P, x, y, "gold", 0.3); }
        break;
      }
      case "shovel": {
        const m = t >= 2 ? "omet" : "dmetal";
        P.rect(22, t ? 10 : 13, 1, t ? 16 : 13, "wood", 0);
        if (t) { P.rect(21, 9, 3, 1, "wood", 0.2); dot(P, 21, 10, "wood", 0); dot(P, 23, 10, "wood", -0.3); }
        P.poly(t ? [[20.5, 25], [24.5, 25], [24.5, 28], [22.5, 30.5], [20.5, 28]] : [[21, 26], [24, 26], [24, 29], [21, 29]], m, lit(20.5, 25));
        if (t === 3) { P.rect(21.5, 24, 2, 1, "gold", 0.3); dot(P, 22, 27, (c && c.ofg) || "#ffb850"); }
        if (t >= 2) { P.rect(20.5, 25, 4, 1, m, 0.6); dot(P, 25, 25, m, 0.2); }
        if (t === 3) P.rect(20, 8, 5, 1, "gold", 0.3);
        break;
      }
      case "hammer": {
        const hb = [[20, 16, 3, 2], [19, 14, 5, 3], [19, 14, 5, 3], [18, 13, 7, 4]][t];
        P.rect(21, hb[1] + hb[3], 1, 27 - hb[1] - hb[3] - (t ? 0 : 2), "wood", 0);
        P.rect(hb[0], hb[1], hb[2], hb[3], "omet", (x, y) => 0.4 - (x - hb[0]) * 0.12 - (y - hb[1]) * 0.1);
        if (t === 2) { dot(P, 20, 15, (c && c.ofg) || "#9ad8ff"); dot(P, 22, 15, (c && c.ofg) || "#9ad8ff"); P.poly([[24, 14], [26, 13], [24, 16]], "omet", -0.1); }
        if (t === 3) { P.rect(19, 13, 1, 4, "gold", 0.2); P.rect(23, 13, 1, 4, "gold", -0.2); dot(P, 21, 14, (c && c.ofg) || "#ffb850"); }
        break;
      }
      case "horn":
        P.tube([[20, 25], [21, 24], [22.4, 22.6], [23.4, 20.8], [24, 19]], 0.7, 1.7, "horn", 0.1);
        P.rect(21, 23, 2, 1, "gold", 0.2); P.rect(23, 20, 2, 1, "gold", 0.1);
        break;
      case "lute": P.rect(22, 15, 1, 6, "dleather", 0); P.ell(22, 23, 2.4, 2.8, "wood", { s: 0.1 }); break;
    }
  }

  // ---------- weapons along an axis: u runs from the grip up the weapon, v across it (to the right when upright) ----------
  function axis(P, ox, oy, ang, sc) {
    const ux = Math.sin(ang), uy = -Math.cos(ang), vx = Math.cos(ang), vy = Math.sin(ang);
    const at = (u, v) => [ox + (u * ux + v * vx) * sc, oy + (u * uy + v * vy) * sc];
    const uv = (x, y) => { const dx = x + 0.5 - ox, dy = y + 0.5 - oy; return [(dx * ux + dy * uy) / sc, (dx * vx + dy * vy) / sc]; };
    const sh = (s) => (typeof s === "function" ? (x, y) => { const [u, v] = uv(x, y); return s(u, v); } : s || 0);
    return {
      at,
      poly: (pts, m, s) => P.poly(pts.map(([u, v]) => at(u, v)), m, sh(s)),
      bar: (u0, u1, w0, w1, m, s) => P.poly([at(u0, -w0), at(u1, -w1), at(u1, w1), at(u0, w0)], m, sh(s)),
      ell: (u, v, r, m, o) => { const [x, y] = at(u, v); P.ell(x, y, r * sc, r * sc, m, o); },
      dot: (u, v, m, s) => { const [x, y] = at(u, v); P.rect(Math.floor(x), Math.floor(y), 1, 1, m, s); },
      line: (u0, v0, u1, v1, m, s) => { const a = at(u0, v0), b = at(u1, v1); P.line(a[0], a[1], b[0], b[1], m, s); },
    };
  }
  const EDGE = (u, v) => (v < 0 ? 0.55 : -0.15);
  function weapon(P, fam, t, A, o) {
    o = o || {};
    const rune = o.glow || "#9ad8ff";
    switch (fam) {
      case "sword": {
        const L = [0, 8, 10, 11, 12, 13][t], gw = [0, 1.5, 2, 2.5, 2.5, 3][t];
        A.bar(0, 2, 1, 1, "dleather", 0);
        if (t >= 2) A.dot(-0.6, 0, t >= 4 ? "gold" : "wmetal", 0.4);
        A.bar(3, 3 + L, 1, t >= 4 ? 0.9 : 1, "wmetal", EDGE);
        A.poly([[3 + L, -1], [3 + L + 1.7, -0.2], [3 + L, 1]], "wmetal", 0.5);
        A.bar(2, 3, gw, gw, t >= 4 ? "gold" : "wmetal", 0.2);
        if (t === 3) { A.dot(3.2, -gw, "wmetal", 0.4); A.dot(3.2, gw - 0.5, "wmetal", -0.2); }
        if (t === 1) { A.dot(3 + L - 3, 0.4, "wmetal", -0.85); A.dot(5, -0.6, "rust", 0); }
        if (t >= 4) A.dot(2.4, -0.1, t === 5 ? rune : "crim", 0.5);
        if (t === 5) for (const u of [6, 9, 12]) A.dot(u, 0.3, rune);
        break;
      }
      case "axe": {
        const H = [0, 9, 10, 11, 14, 15][t], sh = (u, v) => (Math.abs(v) > 2.6 ? 0.6 : 0.1) - (H - u) * 0.02;
        A.bar(t >= 4 ? -5 : -1, H + 0.6, 0.5, 0.5, t >= 4 ? "dwood" : "wood", 0);
        if (t === 1) A.poly([[H - 3.5, -0.4], [H, -0.4], [H + 0.4, -3], [H - 4, -3]], "wmetal", sh);
        if (t === 2) A.poly([[H - 4, -0.4], [H, -0.4], [H + 1, -3.6], [H - 5, -3.6]], "wmetal", sh);
        if (t === 3) A.poly([[H - 3, -0.4], [H, -0.4], [H + 1, -3.8], [H - 6.5, -3.8]], "wmetal", sh);
        if (t === 4) for (const s of [-1, 1]) A.poly([[H - 5, 0.4 * s], [H, 0.4 * s], [H + 1.5, 4 * s], [H - 6.5, 4 * s]], "wmetal", sh);
        if (t === 5) { A.poly([[H - 7, -0.4], [H, -0.4], [H + 1.5, -5], [H - 2.5, -5.4], [H - 8.5, -5]], "wmetal", sh); A.poly([[H - 3, 0.4], [H - 1, 0.4], [H - 2, 2.6]], "wmetal", -0.2); }
        if (t >= 4) A.poly([[H, -0.5], [H + 2, 0], [H, 0.5]], "wmetal", 0.5);
        if (t >= 3) A.bar(H - 7, H - 6, 0.5, 0.5, t === 5 ? "gold" : "wmetal", 0.3);
        if (t === 5) A.dot(H - 4, -3, rune);
        break;
      }
      case "mace":
        if (t === 1) { A.bar(-0.5, 11, 0.5, 1.5, "wood", (u, v) => (v < 0 ? 0.3 : -0.25)); A.dot(6, 0.6, "wood", -0.8); A.dot(9, -1, "wood", -0.7); }
        else {
          A.bar(t === 5 ? -5 : -1, t === 5 ? 15 : 9.5, 0.5, 0.5, "wood", 0);
          if (t === 2) A.ell(10.6, 0, 2, "wmetal", { s: 0.1 });
          if (t === 3) { A.bar(9, 13, 2, 2, "wmetal", (u, v) => (Math.abs(v) < 0.6 ? -0.45 : v < 0 ? 0.55 : 0)); A.dot(13.2, 0, "wmetal", 0.5); }
          if (t === 4) { A.ell(11, 0, 2.3, "wmetal", { s: 0.1 }); for (const [u, v] of [[14, 0], [11, -3.2], [11, 2.7], [13, -2.4], [13, 2], [9, -2.4], [9, 2]]) A.dot(u, v, "wmetal", 0.5); A.bar(3, 4, 0.5, 0.5, "wmetal", 0.3); }
          if (t === 5) { A.bar(13, 17, 3.5, 3.5, "wmetal", (u, v) => 0.4 - v * 0.15 - (u - 13) * 0.05); A.bar(14.6, 15.4, 3.6, 3.6, "gold", 0.3); A.bar(4, 5, 0.6, 0.6, "gold", 0.2); A.dot(15, 0, rune); }
        }
        break;
      case "daggers": {
        const one = (B) => {
          const L = [0, 3, 4, 5, 6, 6][t];
          B.bar(0, 1.6, 0.5, 0.5, t === 1 ? "wood" : "dleather", 0);
          if (t >= 2) B.bar(1.6, 2.4, 1.5, 1.5, t >= 4 ? "gold" : "wmetal", 0.2);
          B.bar(2.2, 2.2 + L, t >= 3 ? 1 : 0.5, 0.5, t === 5 ? "night" : "wmetal", EDGE);
          B.dot(2.2 + L, 0, t === 5 ? "night" : "wmetal", 0.6);
          if (t === 5) B.dot(4, -0.5, rune);
        };
        one(A);
        if (o.second) one(o.second);
        break;
      }
      case "spear": {
        const top = t === 1 ? 22 : 20;
        A.bar(-6, top, 0.5, 0.5, t >= 4 ? "dwood" : "wood", (u) => (u > 12 ? 0.15 : 0));
        if (t === 1) A.poly([[22, -0.5], [24.5, 0], [22, 0.5]], "wood", 0.4);
        if (t === 2 || t === 3) A.poly([[19.5, -0.9], [21, -1.4], [24.5, -0.1], [21, 1.4], [19.5, 0.9]], "wmetal", (u, v) => (v < 0 ? 0.55 : -0.1));
        if (t === 3) A.bar(19, 20, 2.5, 2.5, "wmetal", 0.2);
        if (t === 4) { A.poly([[18, 0.6], [18, -1], [22, -2.4], [26, -1.2], [24, 0.6]], "wmetal", (u, v) => (v < -0.5 ? 0.6 : 0)); A.dot(19.5, 1.2, "wmetal", 0.2); }
        if (t === 5) {
          A.poly([[19, -1.5], [27, -0.1], [19, 1.5]], "wmetal", (u, v) => (v < 0 ? 0.6 : -0.1));
          A.bar(18, 19, 1.6, 1.6, "gold", 0.3); A.bar(9.5, 10.5, 0.6, 0.6, "gold", 0.2); A.bar(1, 2, 0.6, 0.6, "gold", 0.2);
          A.poly([[17, 0.6], [17, 4.5], [15.6, 3.4], [14.2, 4.5], [14.2, 0.6]], "fav", (u) => 0.3 - (17 - u) * 0.15);
          A.dot(23, -0.4, rune);
        }
        break;
      }
      case "bow": {
        const Lh = [0, 7, 8, 10, 10, 11][t], b = [0, 2.6, 3, 3.2, 3.4, 3.6][t], m = t === 4 ? "dwood" : t === 5 ? "moon" : "wood", N = 40;
        let e0 = null, e1 = null;
        for (let i = 0; i <= N; i++) {
          const s = i / N, u = 1 - Lh + 2 * Lh * s;
          let vv = -b * Math.sin(Math.PI * s);
          if (t >= 4) vv += s < 0.14 ? (0.14 - s) * 10 : s > 0.86 ? (s - 0.86) * 10 : 0;
          A.dot(u, vv, m, 0.25 - s * 0.6);
          if (i === 0) e0 = [u, vv]; if (i === N) e1 = [u, vv];
        }
        A.line(e0[0] + 0.3, e0[1], e1[0] - 0.3, e1[1], "#e8e0d0", 0);
        A.dot(1, -b, t === 5 ? "gold" : "dleather", 0.2); A.dot(1.8, -b + 0.1, t === 5 ? "gold" : "dleather", -0.1);
        if (t >= 4) { A.dot(e0[0], e0[1], "gold", 0.4); A.dot(e1[0], e1[1], "gold", 0.4); }
        if (t === 5) A.dot(1 + Lh * 0.5, -b * 0.8, rune);
        break;
      }
      case "crossbow": {
        const pr = [0, 2.5, 3, 3.5, 3.5, 4.2][t], pm = t >= 4 ? "wmetal" : "wood";
        A.bar(-0.5, 7.5, t >= 3 ? 1 : 0.5, 0.5, t >= 4 ? "dwood" : "wood", (u, v) => (v > 0 ? 0.3 : -0.1));
        A.line(6.6, -pr, 7.2, 0, pm, 0.2); A.line(7.2, 0, 6.6, pr, pm, -0.1);
        A.line(6.4, -pr, 4.2, 0, "#e8e0d0", 0); A.line(4.2, 0, 6.4, pr, "#e8e0d0", 0);
        A.dot(1.5, -1, "wmetal", 0);
        if (t >= 4) { A.bar(7.4, 8.6, 0.6, 0.6, "gold", 0.4); A.bar(2.5, 3.2, 0.6, 0.6, "gold", 0.3); }
        if (t === 5) { A.dot(0, 1, "wmetal", 0.4); A.dot(0, -1, "wmetal", 0.4); A.dot(5.5, 0.5, rune); }
        break;
      }
      case "staff":
        A.bar(-6, 19.5, 0.5, 0.5, t === 5 ? "dwood" : "wood", (u) => (u < 6 ? -0.2 : 0.1));
        if (t === 1) for (const [u, v] of [[19.6, 0.5], [20.2, 1.5], [19.8, 2.5], [18.8, 2.8]]) A.dot(u, v, "wood", 0.2);
        if (t === 2) { A.ell(20.6, 0, 1.4, "wood", { s: 0.2 }); A.dot(19, 1, "leaf", 0.3); }
        if (t === 3) { A.poly([[19.4, -1.1], [23, 0], [19.4, 1.1]], "ice", 0.4); for (const u of [5, 9, 13]) A.dot(u, 0, rune); }
        if (t >= 4) {
          const r = t === 5 ? 2.6 : 2.2;
          for (const s of [-1, 1]) { A.dot(19.6, 1.6 * s - 0.5, "gold", 0.3); if (t === 5) { A.dot(21, 3 * s - 0.5, "gold", 0.2); A.dot(22.5, 3.2 * s - 0.5, "gold", 0.4); } }
          A.ell(21.4 + (t === 5 ? 0.5 : 0), 0, r, "fav", { s: 0.3 });
          A.dot(22.3 + (t === 5 ? 0.5 : 0), -1.2, "#ffffff");
          if (t === 5) { A.bar(8, 9, 0.6, 0.6, "gold", 0.2); A.bar(14, 15, 0.6, 0.6, "gold", 0.2); }
        }
        break;
      case "wand": {
        const L = [0, 5, 6, 6, 6, 7][t];
        if (t === 4) { A.bar(0, 3.2, 0.5, 0.5, "wood", 0); A.bar(3, 7, 1, 0.4, "ice", (u, v) => (v < 0 ? 0.6 : 0)); A.dot(7.2, 0, "#ffffff"); }
        else A.bar(0, L, 0.5, 0.5, ["", "wood", "wood", "bone", "", "night"][t], 0.1);
        if (t === 1) A.dot(3, -1, "wood", 0);
        if (t === 2) { A.dot(L - 1, -1, "leaf", 0.3); A.dot(L - 2, 1, "leaf", 0); }
        if (t === 3) { A.dot(L, 0, "bone", 0.5); A.dot(L + 1, 0, "fav", 0.6); }
        if (t === 5) for (const [u, v] of [[L + 1, 0], [L, -1], [L, 1], [L + 2, 0]]) A.dot(u, v, u === L + 1 ? "#ffffff" : rune);
        if (t <= 2) A.dot(L + 1, 0, "fav", 0.8);
        break;
      }
      case "lute":
        if (t === 4) {
          A.poly([[-1, 0.4], [11, 0.4], [9, 4.6], [0, 1.6]], "wood", (u, v) => 0.35 - v * 0.12);
          A.poly([[1.5, 1], [9.5, 1], [8.2, 3.4], [1.5, 1.6]], "dwood", -0.4);
          for (const v of [1.1, 1.8, 2.5]) A.line(1.8, v, 8.6 - (v - 1.1) * 1.4, v, "#9a8a6a", 0);
          A.bar(-1, 11.5, 0.5, 0.5, "gold", 0.3);
        } else {
          A.bar(3, t === 1 ? 9 : 11, 0.5, 0.5, t === 5 ? "gold" : "dleather", 0);
          if (t >= 2) A.bar(10.5, 12.5, 1, 1, t === 5 ? "gold" : "wood", 0.2);
          A.ell(1.5, 0, t >= 3 ? 3.5 : 3, t === 3 ? "pale" : t === 5 ? "gold" : t === 1 ? "dwood" : "wood", { s: 0.15 });
          A.dot(1, 0, "#2a1a10"); if (t >= 3) { A.dot(1, 1, "#2a1a10"); A.dot(2, 0, "#2a1a10"); A.dot(2, 1, "#2a1a10"); } if (t >= 2) A.dot(0, -1, t === 5 ? "fav" : "#2a1a10", 0.3);
          if (t === 1) A.dot(0, 1, "dwood", -0.9);
          if (t === 5) A.dot(-0.5, -1.5, rune);
        }
        break;
      case "frying_pan":
        A.bar(0, t === 1 ? 6.5 : 7.5, 0.5, 0.5, "dleather", 0);
        if (t >= 2) A.dot(-0.6, 0, "dleather", 0.3);
        if (t === 4) A.poly([[7.5, -3.8], [12.5, -2.6], [13.5, 0], [12.5, 2.6], [7.5, 3.8]], "dmetal", (u, v) => (v < 0 ? 0.3 : -0.3));
        else { A.ell(10.6 + (t >= 3 ? 0.4 : 0), 0, t >= 3 ? 3.4 : 3, t === 2 ? "dmetal" : "dmetal", { s: t === 1 ? 0.2 : 0 }); A.ell(10.6 + (t >= 3 ? 0.4 : 0), 0, t >= 3 ? 2.2 : 1.9, "dmetal", { s: -0.45 }); }
        if (t === 5) { A.ell(11, 0, 3.4, "copper", { s: 0.25 }); A.ell(11, 0, 2.3, "copper", { s: -0.3 }); A.dot(9.5, -2, "copper", 0.9); }
        if (t === 1) A.dot(10, 1, "rust", 0);
        break;
    }
  }

  // ---------- back pieces in sprite space; front=true draws only what crosses the chest ----------
  function backSprite(P, c, art, t, front) {
    const R = (x, y, w, h, m, s) => P.rect(x, y, w, h, m, s);
    switch (art) {
      case "cloak":
        if (!front) {
          const yb = [28.5, 30.5, 32.5, 32.5][t], wx = t === 3 ? 1.5 : 0;
          P.poly([[7.5, 16], [20.5, 16], [23 + wx, yb], [5 - wx, yb]], "bk", (x, y) => 0.05 - (x - 14) * 0.06 + (t === 2 && (x + y) % 5 === 0 ? 0.5 : 0));
          if (t === 0) { R(6, 26, 2, 2, "patch", 0); dot(P, 22, 27, "bk", -0.8); }
          if (t === 3) R(4, 32, 20, 1, "gold", 0);
        } else {
          for (const s of [-1, 1]) P.poly(s < 0 ? [[5.5, 16.5], [10, 16], [9, 19], [5.5, 21]] : [[18, 16], [22.5, 16.5], [22.5, 21], [19, 19]], "bk", s < 0 ? 0.25 : -0.25);
          R(9, 16, 10, 1, "bk", 0.35);
          if (t) { dot(P, 10, 17, t === 3 ? "gold" : "omet", 0.4); dot(P, 17, 17, t === 3 ? "gold" : "omet", 0.2); }
        }
        break;
      case "cape":
        if (!front) {
          const yb = [24, 26, 28, 30][t];
          P.poly([[7.5, 16], [20.5, 16], [22, yb], [6, yb]], "bk", (x, y) => 0.25 - (x - 14) * 0.05 + (t === 2 && x % 3 === 0 ? 0.45 : 0));
          R(21, 18, 1, yb - 18, t >= 2 ? "gold" : "shirt", -0.1);
          if (t === 3) R(6, yb - 1, 16, 1, "gold", 0.1);
        } else {
          P.poly([[5.5, 16.5], [10, 16], [9.5, 18.5], [5.5, 19.5]], "bk", 0.3);
          P.poly([[18, 16], [22.5, 16.5], [22.5, 19.5], [18.5, 18.5]], "bk", -0.2);
          dot(P, 10, 17, t >= 2 ? "gold" : "omet", 0.4);
          if (t === 3) dot(P, 10, 18, "crim", 0.5);
        }
        break;
      case "fur_mantle":
        if (!front) P.poly([[7, 17], [21, 17], [22, 24], [6, 24]], "bk", -0.35);
        else {
          for (let x = 6; x <= 21; x++) {
            if (t === 0 && x % 4 === 1) continue;
            const y = 16.6 + ((x + 0.5 - 14) / 7.5) ** 2 * 2.2 + (x % 2) * 0.4;
            P.ell(x + 0.5, y, t === 3 ? 1.5 : 1.25, t === 3 ? 1.4 : 1.15, "bk", { s: 0.3 - (x - 13) * 0.05 + (x % 3 === 0 ? 0.3 : 0), k: 0.6 });
          }
          if (t === 2) { P.ell(7, 16, 2, 1.7, "bk", { s: 0.3 }); P.poly([[5, 15], [5.5, 12.5], [7, 14.6]], "bk", 0.3); P.poly([[7.5, 14.6], [8.5, 12.5], [9, 15]], "bk", 0); dot(P, 7, 16, "#16121a"); }
          if (t === 3) for (const x of [7, 20]) { dot(P, x, 20, "cream", 0.3); dot(P, x + 1, 20, "cream", 0); }
        }
        break;
      case "quiver":
        // the arrows sit behind the head too, so a hat brim or a hood stays in front of them
        if (!front) { quiverBody(P, QS, t); quiverArrows(P, QS, t); }
        else {
          P.line(19.5, 16.6, 9, 25, t ? "dleather" : "strap", 0.15);
          if (t >= 2) { P.px(14, 21, t === 3 ? "gold" : "omet", 0.4); P.px(15, 20, t === 3 ? "gold" : "omet", 0); }
        }
        break;
      case "backpack":
        if (!front) {
          if (t === 0) { P.ell(21.5, 14.5, 3.2, 3.8, "bk", { s: 0.15 }); dot(P, 21, 10, "strap", 0); }
          else {
            if (t >= 2) { R(5, 8, 1, 17, "wood", 0.1); R(22, 8, 1, 17, "wood", -0.2); R(5, 8, 18, 1, "wood", 0.2); }
            R(4, 13, 20, 11, "bk", (x) => 0.15 - (x - 4) * 0.05);
            if (t >= 2) P.ell(14, 12.6, 9.5, 1.7, t === 3 ? "fav" : "cream", { s: 0.1 });
            if (t === 3) { R(4, 17, 20, 1, "omet", 0.3); P.ell(24, 21.5, 1.6, 1.6, "dmetal", { s: 0.1 }); dot(P, 24, 19, "dmetal", 0); }
          }
        } else if (t) { R(10, 17, 1, 7, "strap", 0.1); R(17, 17, 1, 7, "strap", -0.15); if (t === 3) { dot(P, 10, 20, "gold", 0.4); dot(P, 17, 20, "gold", 0.2); } }
        else P.line(20, 16.5, 11, 24, "strap", 0);
        break;
      case "banner":
        if (!front) {
          R(23, t >= 2 ? 0 : 1, 1, 32, "wood", 0);
          if (t >= 2) dot(P, 23, 0, "gold", 0.4);
          if (t === 0) P.poly([[24, 2], [27.5, 2], [26.5, 4], [27.5, 5.5], [24, 7]], "bk", (x, y) => 0.25 - (y - 2) * 0.08);
          else if (t === 1) P.poly([[24, 2], [28, 2], [28, 10], [26, 8.5], [24, 10]], "bk", (x, y) => 0.25 - (y - 2) * 0.06);
          else {
            const yb = t === 3 ? 13 : 11;
            P.poly([[24, 1.5], [28, 1.5], [28, yb], [26, yb - 1.5], [24, yb]], "bk", (x, y) => 0.25 - (y - 2) * 0.05);
            R(24, 1.5, 4, 1, "gold", 0.2);
            dot(P, 25, 5, t === 3 ? "shirt" : "gold", 0.3); dot(P, 26, 5, t === 3 ? "shirt" : "gold", 0); dot(P, 25, 6, t === 3 ? "shirt" : "gold", 0); dot(P, 26, 6, t === 3 ? "shirt" : "gold", -0.2);
            if (t === 3) for (let x = 24; x < 28; x += 2) dot(P, x, yb, "gold", 0.2);
          }
        }
        break;
    }
  }

  // the quiver is slung across the back: the strap runs over the right shoulder to the left hip, so the mouth rides up behind
  // the right shoulder with the fletchings showing past it, and the tip peeks out low on the left; QS = sprite, QP = portrait
  const QS = { b: [7.6, 27.6], m: [21.6, 10.6], hw: 1.75, arrow: 3.6, fl: 1.6 };
  const QP = { b: [24, 42], m: [33.6, 15], hw: 3.1, arrow: 6, fl: 3 };
  function quiverFrame(q) {
    const [bx, by] = q.b, [mx, my] = q.m, L = Math.hypot(mx - bx, my - by), dx = (mx - bx) / L, dy = (my - by) / L;
    const at = (u, v) => [bx + dx * u - dy * v, by + dy * u + dx * v];
    const side = (x, y) => (x - bx) * -dy + (y - by) * dx;
    return { L, dx, dy, at, side };
  }
  function quiverBody(P, q, t) {
    const F = quiverFrame(q), { L, at, side } = F, w = q.hw;
    const shade = (x, y) => 0.3 - (side(x + 0.5, y + 0.5) / w + 1) * 0.28;
    P.poly([at(0.8, -w * 0.7), at(L, -w), at(L, w), at(0.8, w * 0.7), at(0, 0)], "bk", shade);
    const band = (u, m, s) => P.poly([at(u, -w - 0.15), at(u + (q.hw > 2 ? 1.2 : 0.9), -w - 0.15), at(u + (q.hw > 2 ? 1.2 : 0.9), w + 0.15), at(u, w + 0.15)], m, (x, y) => s - (side(x + 0.5, y + 0.5) / w) * 0.25);
    band(L - (q.hw > 2 ? 1.2 : 0.9), t === 3 ? "gold" : t ? "dleather" : "bk", t ? 0.25 : -0.35);
    if (t >= 1) band(L * 0.62, t === 3 ? "gold" : "dleather", 0.1);
    if (t === 3) band(L * 0.25, "gold", 0);
  }
  function quiverArrows(P, q, t) {
    const F = quiverFrame(q), { L, dx, dy, at } = F, n = [2, 3, 4, 5][t], w = q.hw * 0.75;
    for (let i = 0; i < n; i++) {
      const v = n === 1 ? 0 : -w + (2 * w * i) / (n - 1), up = (i % 2 ? 0.5 : 1.3) * (q.hw > 2 ? 1.4 : 1);
      const [x0, y0] = at(L - 0.4, v), [x1, y1] = at(L + q.arrow - q.fl + up, v + (q.hw > 2 ? 0.6 : 0.3));
      P.line(x0, y0, x1, y1, "dwood", 0);
      const m = i % 2 && t >= 2 ? "fav" : "feather";
      for (let k = 0; k <= q.fl * 2; k++) {
        const u = L + q.arrow - q.fl + up + k * 0.5, vv = v + (q.hw > 2 ? 0.6 : 0.3) + (k / (q.fl * 2)) * (q.hw > 2 ? 0.4 : 0.2);
        const [x, y] = at(u, vv);
        P.px(x, y, m, 0.35 - (k / (q.fl * 2)) * 0.3 - (i % 2 ? 0.15 : 0));
        if (q.hw > 2) { const [x2, y2] = at(u, vv + 0.9); P.px(x2, y2, m, -0.15); }
      }
    }
  }
  function backTop(P, art, t) {
    if (art !== "quiver" && t >= 1) {
      for (const [x, sh] of [[4.5, 0.3], [21.5, -0.2]]) P.rect(x, 13, 2, 3, "bk", sh);
      if (t >= 2) for (const [x, sh] of [[5.5, 0.35], [22.5, 0]]) P.ell(x, 12.6, 1.5, 1.5, t === 3 ? "fav" : "cream", { s: sh });
    }
  }

  // ---------- armor tiers on the sprite body: dents and patches, studs and rivets, trims, gilding and runes ----------
  function armorSprite(P, c) {
    const { at, mat } = c.k, o = c.outfit, robe = ROBES.has(o), metal = mat === "chain" || mat === "plate";
    const hem = robe ? 32 : 25, base = BASE[o] || "hide";
    if (at === 1) {
      if (metal) { for (const [x, y] of [[11, 19], [17, 22], [10, 23], [16, 18]]) P.px(x, y, "metal", -0.9); P.px(12, 22, "rust", -0.1); }
      else { P.rect(16, robe ? 27 : 20, 2, 2, "patch", (x, y) => 0.2 - (x - 16) * 0.3); P.px(15, robe ? 27 : 20, "patch", -0.6); }
    }
    if (at === 3) {
      if (mat === "plate") for (const [x, y] of [[9, 18], [18, 18], [10, 21], [17, 21]]) P.px(x, y, "metal", 0.9);
      if (mat === "chain") { P.rect(9, hem - 1, 10, 1, "metal", 0.6); }
      if (mat === "leather") for (const [x, y] of [[10, 19], [12, 21], [10, 23], [17, 19], [15, 21], [17, 23]]) if (P.matAt(x, y) === base) P.px(x, y, "omet", 0.7);
      if (mat === "cloth") { P.rect(robe ? 7 : 9, hem, robe ? 14 : 10, 1, "shirt", 0.1); P.rect(6, 23, 2, 1, "shirt", 0.1); P.rect(20, 23, 2, 1, "shirt", -0.2); }
    }
    if (at >= 4) {
      for (let x = 9; x <= 18; x++) if (x < 12 || x > 15) P.px(x, 17, "gold", 0.3 - (x - 9) * 0.05);
      if (robe) P.rect(7, 32, 14, 1, "gold", 0.1); else P.rect(9, 25, 10, 1, "gold", 0);
      if (mat === "plate") { P.px(7, 17, "gold", 0.4); P.px(21, 17, "gold", 0); }
      if (mat === "cloth") { P.rect(6, 23, 2, 1, "gold", 0.2); P.rect(20, 23, 2, 1, "gold", -0.1); }
    }
    if (at === 5) {
      const rc = RUNE[mat];
      P.px(13, 20, "gold", 0.5); P.px(14, 20, "gold", 0.1); P.px(13, 21, rc); P.px(14, 21, mix(rc, "#16121a", 0.3)); P.px(13, 22, "gold", 0); P.px(14, 22, "gold", -0.3);
    }
  }
  // the silhouette steps with tier: flared cuffs (2), shoulder pieces (3), hem flare or tassets (4), a raised collar (5)
  function armorShape(P, c, sleeve) {
    const { at, mat } = c.k, robe = ROBES.has(c.outfit), metal = mat === "chain" || mat === "plate", base = BASE[c.outfit] || "hide";
    const piece = metal ? "metal" : mat === "leather" ? "hide" : sleeve, edge = at >= 4 ? "gold" : piece;
    if (mat === "plate") {
      const r = [0, 2.2, 2.6, 3, 3.2, 3.4][at];
      for (const sx of [8, 19.5]) P.ell(sx, 17.6 - (at >= 4 ? 0.3 : 0), r, r * 0.68, "metal", { s: sx < 14 ? 0.25 : -0.1 });
      if (at >= 4) { P.px(6, 17, "gold", 0.4); P.px(21, 17, "gold", 0); }
    }
    if (at >= 2) { P.rect(5, 22, 1, 2, sleeve, 0.1); if (!c.both) P.rect(22, 22, 1, 2, sleeve, -0.35); if (at >= 4) { P.px(5, 23, "gold", 0.2); if (!c.both) P.px(22, 23, "gold", -0.1); } }
    if (at >= 3 && mat !== "plate") for (const [sx, sh] of c.both ? [[7, 0.3]] : [[7, 0.3], [20.5, -0.15]]) {
      P.ell(sx, 16.8, metal ? 2.4 : 2, 1.4, piece, { s: sh });
      if (at >= 4) P.px(sx < 14 ? 5 : 22, 17, edge, 0.2);
    }
    if (at >= 4) {
      if (robe) { P.rect(6, 30, 1, 3, base, 0.1); P.rect(21, 30, 1, 3, base, -0.4); }
      else for (const [x0, sh] of [[8, 0.2], [18, -0.3]]) P.poly([[x0, 25], [x0 + 2.5, 25], [x0 + 2 + (x0 < 14 ? 0 : 0.5), 28], [x0 + (x0 < 14 ? -0.5 : 0.5), 27.5]], metal ? "metal" : base, sh);
    }
    if (at === 5) for (const [x, sh] of [[9.5, 0.3], [17.5, -0.2]]) P.poly([[x - 0.5, 17.5], [x + 1.5, 17.5], [x + (x < 14 ? 0 : 1), 14.6]], edge, sh);
  }

  function armorPortrait(P, c) {
    const { at, mat } = c.k, cx = c.cx, metal = mat === "chain" || mat === "plate", base = BASE[c.outfit] || "hide";
    const onBase = (x, y) => { const m = P.matAt(x, y); return m === base || m === "metal" || m === "hide" || m === "robe" || m === "robed" || m === "shirt" || m === "cloth"; };
    if (at === 1) {
      if (metal) for (const [x, y] of [[cx - 9, 35], [cx + 7, 37], [cx - 3, 39], [cx + 12, 33]]) { P.px(x, y, "metal", -0.9); P.px(x + 1, y, "metal", -0.6); P.px(x, y - 1, "metal", 0.7); }
      else { P.rect(cx + 6, 34, 4, 3, "patch", (x, y) => 0.25 - (x - cx - 6) * 0.15); for (const [x, y] of [[cx + 5, 34], [cx + 5, 36], [cx + 10, 35], [cx + 7, 37]]) P.px(x, y, "cream", -0.2); }
      if (metal) P.px(cx - 8, 37, "rust", 0);
    }
    if (at === 3) {
      if (metal) for (let x = cx - 14; x <= cx + 14; x += 3) for (const y of [33, 38]) if (onBase(x, y) && Math.abs(x - cx) > 4) P.px(x, y, "metal", 0.95);
      if (mat === "leather") for (let y = 32; y < 40; y += 3) for (let x = cx - 14 + (y % 2) * 1; x <= cx + 14; x += 4) if (onBase(x, y) && Math.abs(x - cx) > 3) P.px(x, y, "omet", 0.75);
      if (mat === "cloth") neckTrim(P, cx, "shirt");
    }
    if (at >= 4) neckTrim(P, cx, "gold");
    if (at === 5) {
      const rc = RUNE[mat];
      P.ell(cx, 36, 2, 2, "gold", { s: 0.3 }); P.ell(cx, 36, 1, 1, rc); P.px(cx - 1, 35, mix(rc, "#ffffff", 0.5));
    }
  }
  function neckTrim(P, cx, m) {
    for (let x = cx - 9; x <= cx + 9; x++) {
      for (let y = 26; y < 36; y++) {
        const mm = P.matAt(x, y);
        if (mm === null || mm === "skin") continue;
        if (P.lay[y * P.w + x] !== 2) break;
        P.px(x, y, m, 0.3 - (x - cx) * 0.04);
        break;
      }
    }
  }

  // ---------- neck pieces: sprite (a few pixels at the collar) and portrait ----------
  function neckSprite(P, art) {
    const g = "ngem", chain = (m, s) => { for (const [x, y] of [[11, 17], [12, 18], [15, 18], [16, 17]]) P.px(x, y, m, (s || 0.3) - (x - 11) * 0.08); };
    switch (art) {
      case "amulet": chain("gold"); P.px(13, 18, g, 0.6); P.px(14, 18, g, 0.1); P.px(13, 19, g, -0.1); P.px(14, 19, g, -0.5); break;
      case "pendant": chain("dmetal", 0.6); P.px(13, 18, "gold", 0.3); P.px(14, 18, "gold", 0); P.px(13, 19, g, 0.4); P.px(14, 19, g, -0.2); break;
      case "locket": chain("gold"); P.px(13, 18, "gold", 0.7); P.px(14, 18, "gold", 0.3); P.px(13, 19, "gold", 0); P.px(14, 19, "gold", -0.5); break;
      case "torc": for (let x = 10; x <= 17; x++) P.px(x, 17, "gold", 0.5 - (x - 10) * 0.1); P.px(12, 18, "gold", 0.2); P.px(15, 18, "gold", -0.3); break;
      case "beads": [[11, 17], [12, 18], [13, 18], [14, 18], [15, 18], [16, 17]].forEach(([x, y], i) => P.px(x, y, i % 2 ? g : "cream", 0.3)); break;
      case "brooch": P.px(10, 18, "gold", 0.5); P.px(11, 18, g, 0.4); P.px(10, 19, g, 0); P.px(11, 19, "gold", -0.3); break;
      case "chain_neck": [[11, 17], [12, 18], [13, 19], [14, 19], [15, 18], [16, 17]].forEach(([x, y], i) => P.px(x, y, "gold", i % 2 ? -0.1 : 0.6)); break;
      case "holy_pendant": chain("gold"); P.px(13, 18, "gold", 0.6); P.px(12, 19, "gold", 0.3); P.px(13, 19, g, 0.5); P.px(14, 19, "gold", -0.2); P.px(13, 20, "gold", -0.1); break;
      case "fang_necklace": chain("dleather", -0.1); for (const x of [12, 14, 16]) { P.px(x, 18, "bone", 0.5); P.px(x, 19, "bone", -0.1); } break;
      case "scarf": P.rect(10, 16, 8, 2, g, (x) => 0.35 - (x - 10) * 0.1); P.rect(16, 18, 2, 3, g, (x, y) => -0.1 - (y - 18) * 0.1); break;
      case "pearl": for (const [x, y] of [[11, 17], [12, 18], [13, 18], [14, 18], [15, 18], [16, 17]]) P.px(x, y, "pearl", 0.3); break;
    }
  }
  function neckPortrait(P, art, cx) {
    const g = "ngem", arc = (dx) => 27.6 + (1 - (dx / 5.2) ** 2) * 3.6;
    const chain = (m, step, s) => { for (let dx = -5; dx <= 5; dx += step) P.px(cx + dx - 0.5, arc(dx), m, (s || 0.2) - dx * 0.04 + (Math.round(dx) % 2 ? -0.3 : 0)); };
    switch (art) {
      case "amulet": chain("gold", 0.5); P.ell(cx, 32.6, 2.1, 2.1, "gold", { s: 0.2 }); P.ell(cx, 32.6, 1.3, 1.3, g, { s: 0.35 }); break;
      case "pendant": chain("dmetal", 0.5, 0.5); P.ell(cx, 32.3, 1.1, 1.5, g, { s: 0.4 }); P.px(cx - 1, 31, "gold", 0.4); break;
      case "locket": chain("gold", 0.5); P.ell(cx, 33, 1.8, 2.2, "gold", { s: 0.15 }); P.px(cx - 1, 32, "gold", 0.9); P.rect(cx - 1, 33, 2, 1, "gold", -0.6); break;
      case "torc": for (let dx = -6; dx <= 6; dx += 0.5) { P.px(cx + dx - 0.5, arc(dx) - 1.2, "gold", 0.45 - dx * 0.06); P.px(cx + dx - 0.5, arc(dx) - 0.2, "gold", -0.2 - dx * 0.05); }
        P.ell(cx - 2.6, 30.8, 1.2, 1.2, "gold", { s: 0.3 }); P.ell(cx + 2.6, 30.8, 1.2, 1.2, "gold", { s: 0 }); break;
      case "beads": for (let dx = -5; dx <= 5; dx += 1.6) P.ell(cx + dx, arc(dx) + 0.3, 0.9, 0.9, Math.round(dx * 10) % 3 === 0 ? "cream" : g, { s: 0.2 }); break;
      case "brooch": P.ell(cx - 7, 31.5, 2, 2, "gold", { s: 0.2 }); P.ell(cx - 7, 31.5, 1.2, 1.2, g, { s: 0.4 }); break;
      case "chain_neck": for (let dx = -6; dx <= 6; dx += 1) { P.px(cx + dx, arc(dx) - 0.6, "gold", dx % 2 ? -0.3 : 0.6); P.px(cx + dx, arc(dx) + 0.4, "gold", dx % 2 ? 0.4 : -0.4); } break;
      case "holy_pendant": chain("gold", 0.5); P.rect(cx - 0.5, 31, 1, 5, "gold", 0.3); P.rect(cx - 2, 32.5, 4, 1, "gold", 0.1); P.px(cx - 0.5, 32.5, g, 0.5); break;
      case "fang_necklace": chain("dleather", 0.5, -0.2); for (const dx of [-3.5, 0, 3.5]) P.poly([[cx + dx - 1, arc(dx)], [cx + dx + 1, arc(dx)], [cx + dx, arc(dx) + 3]], "bone", 0.3 - dx * 0.05); break;
      case "scarf": P.ell(cx, 28, 6.6, 2.6, g, { s: 0.1, fn: (x, y, s) => s + ((x + y) % 4 === 0 ? -0.35 : 0) }); P.poly([[cx + 2, 29], [cx + 5.5, 29], [cx + 6, 38], [cx + 3, 38.5]], g, (x) => -0.05 - (x - cx - 2) * 0.08); P.rect(cx + 3, 37, 3, 1, g, -0.6); break;
      case "pearl": for (let dx = -5; dx <= 5; dx += 1.25) P.ell(cx + dx, arc(dx) + 0.2, 0.75, 0.75, "#f4f0e6", { s: 0.2 }); break;
    }
  }

  // ---------- headgear (portrait space; the sprite scales the whole head down), tier 0..3 ----------
  function headgear(P, head, cx, fw, look, inHead, c) {
    c = c || { v: 0, ht: 1 };
    const t = c.ht == null ? 1 : c.ht, v = c.v || 0;
    const at = (x, y) => { const [X, Y] = P.T(x + 0.5, y + 0.5); return P.matAt(Math.floor(X), Math.floor(Y)); };
    // hair peeking under a hood's front edge, so hooded heroes aren't all shaved; kept above the brows
    const fringe = () => {
      const st = c.st, kind = FRINGE[st];
      if (st == null || !kind) return;
      const small = P.tf && P.tf.s < 1, maxY = c.browUp ? 12 : 13, tex = c.hairTex || (() => 0);
      for (let x = cx - 8; x <= cx + 8; x++) {
        let top = -1;
        for (let y = 7; y < 16; y++) if (open(x, y)) { top = y; break; }
        if (top < 0) continue;
        const dx = x - cx, jag = (x * 7 + (v >> 2)) % 3 === 0;
        let d = kind === "full" ? 2 + (jag ? 1 : 0) : kind === "sweep" ? (dx < 0 ? 3 : 1) - (jag ? 1 : 0) : kind === "mohawk" ? (dx >= -1 && dx <= 0 ? 2 : 0) : jag ? 0 : 1 + ((x + v) % 4 === 0 ? 1 : 0);
        if (small) { if (top + 1 > 11 || Math.abs(dx + 0.5) > (kind === "full" || kind === "sweep" ? 4 : 2) || d < 1 || (kind === "thin" && x % 2)) continue; d = 1; }
        for (let y = top + 1; y <= Math.min(maxY, top + d); y++) P.px(x, y, "hair", -0.12 + tex(x, y) - (y - top) * 0.1);
      }
      if (FRINGE_LOCKS.has(st) && !small) for (const side of [-1, 1]) for (let y = 11; y <= maxY + 1; y++) {
        let x = side < 0 ? cx - 9 : cx + 8;
        while (x !== cx && !open(x, y)) x -= side;
        P.px(x - side, y, "hair", -0.2 + tex(x, y) - (y % 2) * 0.12);
      }
    };
    const open = (x, y) => ((x + 0.5 - cx) / (fw - 0.2)) ** 2 + ((y + 0.5 - 17.6) / 9) ** 2 <= 1 || (y >= 25 && Math.abs(x + 0.5 - cx) < 3.2 - (y - 26) * 0.75);
    const hoodShape = (m, s0, peak) => {
      const sh = (x, y) => (open(x, y) ? false : s0 + 0.04 - Math.max(-0.1, (x + 0.5 - cx) / 10 - 0.15) * 0.5 - (y - 24) * 0.03);
      P.poly([[cx - 5, 26.4], [cx - 9.4, 29.6], [cx - 10.6, 31.6], [cx - 9.4, 32], [cx - 5, 30], [cx, 30.6], [cx + 5, 30], [cx + 9.4, 32], [cx + 10.6, 31.6], [cx + 9.4, 29.6], [cx + 5, 26.4]], m, sh);
      P.poly([[cx - fw - 1.3, 15], [cx - fw - 0.9, 23], [cx - 5.4, 27.6], [cx + 5.4, 27.6], [cx + fw + 0.9, 23], [cx + fw + 1.3, 15]], m, sh);
      P.ell(cx, 15.2, fw + 1.3, 9, m, { s: s0 + 0.08, k: 0.8, fn: (x, y, s) => (open(x, y) || y > 22 ? false : s) });
      if (peak) P.poly([[cx - 2.2, 6.8], [cx - 0.4, peak], [cx + 1.6, 6.8]], m, (x) => s0 + 0.1 - (x - cx) * 0.08);
      for (let x = cx - 9; x <= cx + 9; x++) for (let y = 8; y < 26; y++) if (open(x, y) && !open(x, y - 1)) P.px(x, y, m, s0 - 0.45);
      for (let x = cx - 11; x <= cx + 11; x++) for (let y = 33; y > 26; y--) if (at(x, y) === m) { P.px(x, y, m, s0 - 0.5 - (x + 0.5 - cx) * 0.03); break; }
    };
    const hoodRing = () => {
      const ring = [];
      for (let y = 9; y < 31; y++) for (let x = cx - 10; x <= cx + 10; x++) {
        if (open(x, y) || at(x, y) !== "hd") continue;
        if (open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1)) ring.push([x, y]);
      }
      return ring;
    };
    const dome = (m, ry, sfn) => P.ell(cx, 13, fw + 1.4, ry, m, { s: 0.1, fn: (x, y, s) => (y > 13 ? false : sfn ? sfn(x, y, s) : s) });
    const band = (y, m, s) => P.rect(cx - fw - 1.5, y, fw * 2 + 3, 1, m, (x) => (s || 0.2) - (x - cx) * 0.05);
    const plume = (m, big) => { const pts = []; for (let i = 0; i <= 8; i++) { const q = i / 8; pts.push([cx + q * (big ? 8 : 6.5), 4.5 - Math.sin(q * 2.6) * 3 + q * 4]); } P.tube(pts, big ? 1.9 : 1.5, 0.8, m, 0.1); };
    switch (head) {
      case "helm":
        dome("hmet", 7.6, (x, y, s) => s + (t === 0 && (x * 5 + y * 3) % 11 === 0 ? -0.55 : 0));
        P.rect(cx - fw - 1.5, 13, fw * 2 + 3, 2, "hmet", (x) => 0.15 - (x - cx) * 0.06);
        if (t >= 1) P.rect(cx - 1, 15, 2, 5, "hmet", 0.3);
        if (t >= 2) for (const s of [-1, 1]) P.poly([[cx + s * (fw + 1.5), 14], [cx + s * (fw - 1.2), 14], [cx + s * (fw - 1.8), 22], [cx + s * (fw + 0.8), 21.5]], "hmet", s < 0 ? 0.15 : -0.35);
        if (t === 1) { P.rect(cx - 0.5, 3.5, 1, 2.5, "fav", 0.3); }
        if (t === 2) P.rect(cx - 1, 3, 2, 10, "hmet", (x) => (x < cx ? 0.7 : 0.1));
        if (t === 3) { band(13, "gold", 0.3); P.rect(cx - 0.5, 5.6, 1, 7.4, "gold", 0.3); plume("fav", true); }
        break;
      case "great_helm": case "skull_helm": {
        const m = head === "great_helm" ? "hmet" : "dmetal";
        P.ell(cx, 15, fw + 1.6, 10, m, { s: 0.05, fn: (x, y, s) => (y > 25 || (head === "great_helm" && t === 0 && y < 7) ? false : s + (y >= 18 && Math.abs(x + 0.5 - cx) > 2.5 ? -0.2 : 0)) });
        if (head === "great_helm" && t === 0) P.rect(cx - fw + 0.5, 7, fw * 2 - 1, 1, m, 0.5);
        P.rect(cx - fw - 0.5, 14, fw * 2 + 1, 1, head === "great_helm" && t === 3 ? "gold" : m, (x) => 0.55 - (x - cx) * 0.05);
        P.rect(cx - fw + 0.5, 15, fw * 2 - 1, 3, "#100c12");
        for (const ex of [cx - 4, cx + 2]) {
          if (c.empty) continue;
          if (c.glint) { P.px(ex, 16, c.glint); P.px(ex + 1, 16, mix(c.glint, "#100c12", 0.4)); }
          else { P.px(ex, 16, "#d8cfc0"); P.px(ex + (c.gaze > 0 ? 1 : 0), 16, c.eye || "#3a3a40"); P.px(ex, 15, "#2a2228"); }
        }
        P.rect(cx - 0.5, 18, 1, 7, head === "great_helm" && t === 3 ? "gold" : m, 0.55);
        P.rect(cx - fw + 1, 25, fw * 2 - 2, 1, m, -0.6);
        if (head === "skull_helm") {
          if (t === 0) { P.ell(cx, 19, 4.6, 4.4, "bone", { s: 0.1 }); P.rect(cx - 3, 16, 2, 2, "#100c12"); P.rect(cx + 1, 16, 2, 2, "#100c12"); }
          else P.ell(cx, 20, 4.5, 3.4, "bone", { s: 0.1 });
          P.px(cx - 2, 20, "#100c12"); P.px(cx + 1, 20, "#100c12");
          if (t >= 2) for (let x = cx - 2; x <= cx + 1; x++) { P.px(x, 22, "#100c12"); if (x % 2 === 0) P.px(x, 23, "bone", 0.2); }
          else P.rect(cx - 2, 22, 4, 1, "#100c12");
          if (t >= 2) for (const s of [-1, 1]) P.poly([[cx + s * 4, 8], [cx + s * 9, 3], [cx + s * 7, 10]], "bone", s < 0 ? 0.3 : -0.1);
          if (t === 1) P.poly([[cx - 2.2, 7], [cx, 1.5], [cx + 2.2, 7]], "dmetal", 0.4);
          if (t === 3) { for (const x of [-4, -1.5, 1, 3.5]) P.poly([[cx + x - 1, 7], [cx + x, 2.5], [cx + x + 1, 7]], "dmetal", 0.4); P.rect(cx - fw, 7, fw * 2, 1, "gold", 0.2); }
        } else {
          for (const y of [20, 22]) for (let x = cx + 2; x < cx + 5; x += 2) P.px(x, y, "#100c12");
          if (t === 0) P.rect(cx - fw + 0.5, 9, fw * 2 - 1, 2, "fav", (x) => 0.2 - (x - cx) * 0.05);
          if (t === 1) P.rect(cx - 1, 2.5, 2, 11, "fav", (x) => (x < cx ? 0.35 : -0.1));
          if (t === 2) plume("fav", false);
          if (t === 3) { plume("fav", true); P.rect(cx - fw + 0.5, 19, fw * 2 - 1, 1, "gold", 0.1); }
        }
        break;
      }
      case "hood": case "skull_hood": {
        const isS = head === "skull_hood";
        if (t >= 1) { const L = [0, 2, 4.5, 9][t]; P.poly([[cx + fw - 1, 14], [cx + fw + 1.6, 16], [cx + fw + 2.2, 21 + L], [cx + fw + 0.4, 20 + L * 0.8]], "hd", -0.3); }
        hoodShape("hd", isS ? -0.1 : 0.05, t === 3 ? 3.8 : 5.4);
        const trim = isS ? (t >= 1 ? "bone" : null) : [null, "leather", ["gold", "fav", "leather", "metal", "fur"][v % 5], "silver"][t];
        if (trim) hoodRing().forEach(([x, y], k) => { if (y < 31) P.px(x, y, trim, (v >> 3) % 2 && k % 2 ? -0.4 : 0.15 - (x - cx) * 0.04); });
        if (t === 0 && !isS) for (const [x, y, m2, s2] of [[cx + 6, 29, "patch", 0], [cx + 7, 29, "patch", 0], [cx + 6, 30, "patch", -0.2], [cx - 8, 30, "hd", -0.8]]) if (at(x, y) === "hd") P.px(x, y, m2, s2);
        if (!isS && t === 2) {
          const pat = (v >> 6) % 3;
          if (pat === 0) for (let y = 6; y < 35; y++) for (let x = cx - 12; x <= cx + 12; x++) { if (!open(x, y) && at(x, y) === "hd" && ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0)) P.px(x, y, "hd", -0.45); }
          if (pat === 1) for (const sx of [cx - fw - 1, cx + fw]) for (let y = 11; y < 24; y += 2) if (at(sx, y) === "hd") P.px(sx, y, trim, -0.1);
          if (pat === 2) for (let x = cx - 10; x <= cx + 10; x += 2) if (at(x, 29) === "hd") P.px(x, 29, trim, 0.1 - (x - cx) * 0.03);
        }
        if (!isS && t === 3) for (let y = 9; y < 22; y += 3) if (at(cx - fw - 1, y) === "hd") P.px(cx - fw - 1, y, "hd", 0.9);
        fringe();
        for (let y = 11; y < 24; y++) for (let x = cx - 9; x <= cx + 9; x++) {
          if (open(x, y) && (!open(x - 1, y) || !open(x + 1, y)) && y < 16) P.px(x, y, "favd", -0.3);
        }
        if (c.aura === "shadow" && c.k && c.k.legacy) for (let y = 20; y < 27; y++) for (let x = cx - 9; x <= cx + 9; x++) if (open(x, y)) P.px(x, y, "favd", (y === 20 ? 0.3 : -0.1) - (x - cx) * 0.05);
        if (isS && t >= 2) { const sy = t === 3 ? 5.2 : 6.2; P.ell(cx, sy, t === 3 ? 3 : 2.6, t === 3 ? 2.9 : 2.4, "bone", { s: 0.2 }); P.px(cx - 1, Math.round(sy), "#16121a"); P.px(cx + 1, Math.round(sy), "#16121a"); }
        if (t >= 1) P.ell(cx, 30.4, 1.4, 1.1, t === 3 || (v >> 8) % 2 ? "gold" : "metal", { s: 0.3 });
        break;
      }
      case "beast_hood": {
        hoodShape("hd", 0.05, 0);
        fringe();
        const ear = [0.6, 1, 1.6, 2.1][t];
        for (const s of [-1, 1]) P.poly([[cx + s * 3, 7], [cx + s * (5 + 3 * ear), 1 + (1 - ear) * 3], [cx + s * (5.5 + 3 * ear), 9]], "hd", s < 0 ? 0.3 : -0.2);
        if (t >= 1) { P.px(cx - 3, 8, t === 3 ? "#e04a3a" : "#f0d040"); P.px(cx + 2, 8, t === 3 ? "#e04a3a" : "#f0d040"); }
        if (t >= 2) for (const x of [cx - 4, cx - 1, cx + 2]) P.poly([[x, 10], [x + 1.6, 10], [x + 0.8, 12.6]], "bone", 0.4);
        if (t === 3) P.rect(cx - fw - 1, 10, fw * 2 + 2, 1, "gold", 0.2);
        break;
      }
      case "leather_cap":
        dome("hd", 7, (x, y, s) => s + (t === 1 && (y === 9 || y === 11) ? -0.35 : 0) + (t === 1 && x === cx ? -0.3 : 0));
        P.rect(cx - fw - 1.5, 12.5, fw * 2 + 3, 1.6, t >= 2 ? "dleather" : "hd", (x) => (t >= 2 ? 0.1 : 0.55) - (x - cx) * 0.06);
        if (t === 1) P.ell(cx, 5.6, 1.5, 1.3, "hd", { s: 0.3 });
        if (t >= 2) for (const x of [cx - 5, cx - 1, cx + 3]) P.px(x, 13, "omet", 0.6);
        if (t >= 2) for (const s of [-1, 1]) P.poly([[cx + s * (fw + 1.8), 13], [cx + s * (fw - 1), 13], [cx + s * (fw - 0.6), t === 3 ? 22 : 18], [cx + s * (fw + 2), t === 3 ? 21 : 17.5]], "hd", s < 0 ? 0.1 : -0.35);
        if (t === 3) { for (const [x, y] of [[cx - 3, 9], [cx + 2, 9], [cx, 7], [cx - 5, 11], [cx + 4, 11]]) P.px(x, y, "omet", 0.7); P.rect(cx - 1, 14, 2, 4, "omet", 0.4); }
        if (t === 0) P.px(cx + 3, 9, "hd", -0.8);
        break;
      case "wizard_hat": {
        const tall = [2, 3, 2, 1][t], floppy = t === 0;
        P.poly(floppy ? [[cx - 6.5, 10], [cx + 6.5, 10], [cx + 4, 3], [cx + 8, 3.5], [cx + 1, 1]] : [[cx - 6.5, 10], [cx + 6.5, 10], [cx + 6, 3 + tall * 0.3], [cx + 9, -1 + tall], [cx + 2, 2 + tall * 0.5]],
          "hd", (x, y) => 0.25 - (x - cx) * 0.06 - (y < 3 ? 0.2 : 0));
        P.ell(cx, 10.5, fw + [4, 5, 6.2, 7.6][t], 2.2, "hd", { s: -0.1 });
        if (t >= 2) P.rect(cx - 6, 8, 12, 1, "gold", 0.2);
        if (t === 1 || t === 3) for (const [x, y] of [[cx - 3, 5], [cx + 2, 3], [cx + 1, 7], [cx - 4, 8]]) if (at(x, y) === "hd") P.px(x, y, t === 3 ? "gold" : "cream", 0.6);
        if (t === 3) { P.px(cx, 8, "ice", 0.6); P.px(cx - 1, 8, "ice", 0.2); }
        break;
      }
      case "wide_hat":
        P.ell(cx, 7, 6, 4.6, "hd", { s: 0.1, fn: (x, y, s) => (y > 9 ? false : s + (t === 0 && (x + y) % 3 === 0 ? -0.3 : 0)) });
        P.rect(cx - 6, 8, 12, 1, t === 3 ? "gold" : t === 0 ? "hd" : "fav", t === 0 ? -0.4 : 0);
        P.ell(cx, 10, fw + [5.2, 6.2, 7, 7.6][t], 2.2, "hd", { s: -0.05, fn: (x, y, s) => s + (t === 0 && (x * 2 + y) % 4 === 0 ? -0.35 : 0) });
        if (t >= 2) P.line(cx + 4, 8, cx + 9, 2, t === 3 ? "fav" : "feather", 0.3, 0.7);
        break;
      case "top_hat": {
        const top = [3, 2, 1, 0][t];
        P.rect(cx - 5, top, 10, 10 - top, "hd", (x, y) => 0.1 - (x - cx) * 0.08 + (t === 0 && x > cx + 2 && y < 3 ? -0.5 : 0) + (t === 2 && x === cx - 3 ? 0.7 : 0));
        if (t === 0) P.rect(cx + 3, top, 2, 1, "#100c12");
        P.rect(cx - 5, 7, 10, 1, t === 3 ? "gold" : t === 0 ? "hd" : "fav", t === 0 ? -0.5 : 0);
        if (t === 3) P.px(cx - 2, 7, "crim", 0.6);
        P.ell(cx, 10, fw + [2, 3, 4.2, 5.4][t], 1.8, "hd", { s: -0.1 });
        break;
      }
      case "slouch_hat": {
        // a fence's hat: a soft crown, the brim pinned up on one side by a brooch and drooping on the other, a plume swept back over it
        const reach = fw + [5, 6, 6.5, 7][t];
        P.ell(cx + 0.5, 7.6, 5.4, 4.2, "hd", { s: 0.1, fn: (x, y, s) => (y > 10 ? false : s - (x - cx) * 0.05 + (Math.abs(x + 0.5 - cx) < 1 && y < 5 ? -0.4 : 0) + (t === 0 && (x + y) % 3 === 0 ? -0.3 : 0)) });
        P.rect(cx - 4.5, 8.4, 10, 1.6, t === 0 ? "hd" : t === 3 ? "gold" : "fav", t === 0 ? -0.4 : 0.05);
        P.poly([[cx - 4, 10.2], [cx + reach - 1, 9.4], [cx + reach + 0.8, 12.8], [cx + reach - 2.5, 12.4], [cx - 1, 11.8], [cx - 4, 11.8]], "hd", (x, y) => -0.05 - (x - cx) * 0.03 + (y > 11.5 ? -0.3 : 0));
        P.poly([[cx - 3, 11.8], [cx - fw - 3, 11.4], [cx - fw - 5, 2.6], [cx - fw - 2.6, 1.4], [cx - 4.6, 6], [cx - 3, 9.6]], "hd", (x, y) => (x < cx - fw - 3 ? 0.5 : -0.3) - (y - 2) * 0.02);
        if (t >= 1) {
          const tip = [[cx + 5, 3], [cx + 10.5, 5.5], [cx + 12, 9]][Math.min(2, t - 1)], pts = [], bx = cx - fw - 2.8;
          for (let i = 0; i <= 10; i++) { const q = i / 10; pts.push([bx + (tip[0] - bx) * q, 4.6 - Math.sin(q * 2.8) * (t === 1 ? 2 : 3) + (tip[1] - 4.6) * q * q]); }
          const plume = "feather";
          P.tube(pts, t === 1 ? 1.1 : 1.6, t === 1 ? 1.5 : 2.3, plume, 0.3);
          if (t >= 2) for (let i = 3; i < 10; i += 2) P.px(pts[i][0], pts[i][1] + 1.4, plume, -0.2);
        }
        P.ell(cx - fw - 2.8, 5, 1.3, 1.3, t === 0 ? "dleather" : t === 1 ? "metal" : "gold", { s: 0.35 });
        if (t === 3) P.px(cx - fw - 3, 5, "crim", 0.5);
        break;
      }
      case "tricorn": {
        const wv = [3, 4, 5, 5][t];
        P.poly([[cx - fw - wv, 10], [cx, 4], [cx + fw + wv, 10], [cx, 12]], "hd", (x, y) => 0.1 - (x - cx) * 0.05);
        if (t >= 2) { P.line(cx - fw - wv, 10, cx, 4, "gold", 0.3); P.line(cx, 4, cx + fw + wv, 10, "gold", 0); }
        if (t >= 1) P.px(cx + 3, 8, "gold", 0.4);
        if (t === 3) { P.ell(cx - 4, 4.4, 2.2, 1.6, "feather", { s: 0.3 }); P.ell(cx - 6, 5, 1.6, 1.2, "feather", { s: 0 }); }
        break;
      }
      case "mitre": {
        const mt = [3, 1.5, 0.6, 0][t];
        if (t >= 2) for (const sx of [-5.5, 4.5]) P.rect(cx + sx, 10, 1, t === 3 ? 9 : 7, "gold", sx < 0 ? 0.3 : -0.2);
        const mw = t === 3 ? 6.5 : 5;
        P.poly([[cx - mw, 11], [cx - 4, mt + 4], [cx, mt], [cx + 4, mt + 4], [cx + mw, 11]], "hd", (x) => 0.2 - (x - cx) * 0.06);
        if (t >= 1) P.rect(cx - 0.5, mt + 1, 1, 10 - mt, "gold", 0.2);
        if (t >= 2) { P.rect(cx - 5, 10, 10, 1, "gold", 0.1); P.line(cx - 4.5, 10, cx - 3.6, 2.5, "gold", 0.3); P.line(cx + 4.5, 10, cx + 3.6, 2.5, "gold", -0.1); }
        if (t === 3) { P.rect(cx - 2, 3, 4, 1, "gold", 0.3); P.px(cx - 0.5, 3, "crim", 0.5); }
        break;
      }
      case "horns":
        if (t === 0) { dome("hd", 6.6); P.rect(cx - fw - 1, 12.5, fw * 2 + 2, 1, "dleather", 0); }
        else { dome("hd", 7.4); P.rect(cx - fw - 1.5, 12.5, fw * 2 + 3, 1.5, t === 3 ? "gold" : "hd", (x) => 0.2 - (x - cx) * 0.06); if (t === 3) P.rect(cx - 1, 14, 2, 5, "hd", 0.3); }
        for (const side of [-1, 1]) {
          const pts = [], big = [0.55, 1, 1.05, 1.35][t];
          for (let i = 0; i <= 10; i++) {
            const q = i / 10;
            if (t === 2) pts.push([cx + side * (fw - 1 + Math.sin(q * 3.6) * 4.4), 9.5 - Math.sin(q * 2.2) * 6 + q * 6]);
            else pts.push([cx + side * (fw - 1 + (q * 5 + Math.sin(q * 2.4) * 1.5) * big), 11 - (q * 9 - q * q * 2) * big]);
          }
          P.tube(pts, t === 3 ? 2.1 : 1.8, 0.6, "horn", side < 0 ? 0.1 : -0.2);
        }
        break;
      case "circlet":
      case "crown": {
        const m = head === "crown" ? "gold" : "hd", y = 11;
        P.rect(cx - 6, y, 12, head === "crown" ? 2 : 1, m, (x) => 0.3 - (x - cx) * 0.06);
        if (head === "crown") {
          for (const x of [-5, -2.5, 0, 2.5, 5]) P.poly([[cx + x - 1, y], [cx + x, y - (x === 0 ? 5 : 3.5)], [cx + x + 1, y]], "gold", x < 0 ? 0.4 : 0);
          for (const x of [-3, 0, 3]) P.px(cx + x - 0.5, y + 1, x ? "fav" : "crim", 0.5);
        } else {
          const gem = c.hglow || (t === 3 ? "#c83a3a" : look.fav), ph = [1.5, 7.5, 8.5, 9.5][t];
          P.poly([[cx - 2.4, y + 0.5], [cx - 0.6, y - ph], [cx + 0.9, y - ph], [cx + 2.4, y + 0.5]], m, (x) => (x < cx ? 0.55 : 0.1));
          P.ell(cx, y - 0.2, 1.2, 1.2, m, { s: 0.3 });
          P.px(cx, y, gem); P.px(cx - 1, y, gem);
          if (t >= 2) for (const sx of [-4, 4]) P.poly([[cx + sx - 1, y + 0.5], [cx + sx, y - ph * 0.5], [cx + sx + 1, y + 0.5]], m, sx < 0 ? 0.4 : 0);
          if (t === 3) { P.px(cx - 4, y, "fav", 0.5); P.px(cx + 4, y, "fav", 0.2); }
        }
        break;
      }
      case "mask":
        P.poly([[cx - fw + 0.3, 13.5], [cx + fw - 0.3, 13.5], [cx + fw - 1, 19], [cx + 1, 20.5], [cx - 1, 20.5], [cx - fw + 1, 19]], "hd", (x, y) => {
          const ex = (x >= cx - 4 && x <= cx - 3) || (x >= cx + 2 && x <= cx + 3);
          return ex && y === 17 ? false : 0.3 - (x - cx) * 0.05 - (y - 13) * 0.04;
        });
        for (const ex of [cx - 4, cx + 2]) { P.px(ex - 1, 17, "hd", -0.7); P.px(ex + 2, 17, "hd", -0.7); }
        P.rect(cx - fw + 0.5, 13.5, fw * 2 - 1, 1, "gold", 0.2);
        break;
      case "bandana":
        P.ell(cx, 12.5, fw + 1, 6, "hd", { s: 0.05, fn: (x, y, s) => (y > 12 ? false : s + (t === 2 && (x + y * 2) % 4 === 0 ? 0.6 : 0) + (t === 0 && (x * 3 + y) % 7 === 0 ? -0.5 : 0)) });
        if (t >= 1) P.line(cx + fw, 12, cx + fw + 3, 17, "hd", -0.2, 0.7);
        if (t >= 2) P.line(cx + fw + 0.6, 12, cx + fw + 4.5, 15, "hd", -0.4, 0.7);
        if (t === 3) P.ell(cx + fw + 4, 18.5, 1.3, 1.3, "gold", { s: 0.3 });
        if (t === 3) for (const x of [cx - 5, cx - 2, cx + 1, cx + 4]) P.px(x, 12, "gold", 0.5);
        if (t === 0) P.rect(cx - 4, 8, 3, 2, "patch", 0);
        break;
      case "fur_cap": {
        // a trapper's cap: a shaggy dome over a turned-up brim and ear flaps of paler pelt; the fox's (or wolf's) tail hangs behind a flap
        const brim = ["cream", "fur", "cream", "cream"][t], shag = (x, y) => ((x * 3 + y * 5) % 7 === 0 ? -0.4 : (x * 5 + y) % 6 === 0 ? 0.3 : 0);
        if (t >= 2) {
          const pts = [];
          for (let i = 0; i <= 8; i++) { const q = i / 8; pts.push([cx + fw + 2 + Math.sin(q * 2.6) * 2, 12 + q * 13]); }
          P.tube(pts, 1.6, 2.4, t === 3 ? "wolf" : "fox", -0.05);
          P.ell(pts[8][0] - 0.2, pts[8][1] + 1.6, 2.1, 1.9, t === 3 ? "dmetal" : "cream", { s: 0.25 });
        }
        if (t === 3) for (const s of [-1, 1]) {
          P.poly([[cx + s * 1.6, 8], [cx + s * 5, 0.8], [cx + s * 6.6, 9]], "hd", s < 0 ? 0.35 : -0.15);
          P.poly([[cx + s * 3.2, 7.6], [cx + s * 4.9, 3.4], [cx + s * 5.6, 8]], "scarp", s < 0 ? -0.2 : -0.45);
        }
        dome("hd", 7.4, (x, y, s) => s + shag(x, y));
        for (const dx of [-5, -2, 1, 4]) { const x = cx + dx, y = Math.floor(13 - 7.4 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / (fw + 1.4)) ** 2))); P.px(x, y - 1, "hd", 0.35); }
        const fl = [18.5, 20.5, 21.5, 21.5][t];
        for (const s of [-1, 1]) P.poly([[cx + s * (fw + 2.1), 13], [cx + s * (fw - 0.8), 13], [cx + s * (fw - 0.5), fl - 1.4], [cx + s * (fw + 0.7), fl], [cx + s * (fw + 2.2), fl - 1.6]], brim,
          (x, y) => (s < 0 ? 0.25 : -0.2) + shag(x, y) * 0.6 - (y - 13) * 0.03);
        P.rect(cx - fw - 2, 10.5, fw * 2 + 4, 3.2, brim, (x, y) => (y <= 10 ? 0.5 : y >= 13 ? -0.3 : 0.12) - (x - cx) * 0.05 + shag(x, y) * 0.7);
        if (t === 0) for (const [x, y] of [[cx - 3, 8], [cx - 2, 9], [cx + 3, 7]]) P.px(x, y, "hd", -0.55);
        if (t === 1) for (const s of [-1, 1]) P.line(cx + s * (fw + 0.8), fl, cx + s * (fw + 0.2), fl + 3, "dleather", -0.1, 0.5);
        break;
      }
      case "herb_wreath": {
        // herbs twisted into a ring that sits on the hair like a circlet: the front dips, the sides run down to the temples
        const w = fw + 1.2, arc = (x) => 10.4 + ((x + 0.5 - cx) / w) ** 2 * 1.8, n = t === 0 ? 8 : 12;
        const greens = [["leaf", "leaf"], ["leaf", "herb"], ["herb", "sage"], ["leaf", "herb", "sage"]][t];
        if (t === 0) for (let x = cx - w; x <= cx + w; x += 0.5) P.px(x, arc(x), "leaf", -0.15);
        for (let i = 0; i <= n; i++) {
          const x = cx - w + (i * 2 * w) / n, up = i % 2 ? -0.45 : 0.45;
          P.ell(x, arc(x) + up, t === 0 ? 1.1 : 1.6, t === 0 ? 0.7 : 1, greens[i % greens.length], { s: up < 0 ? 0.35 : -0.05, k: 0.6 });
        }
        const bloom = (dx, petal, eye) => { const x = cx + dx, y = arc(x) - 0.4; for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) P.px(x + a, y + b, petal, 0.35 - a * 0.15); P.px(x, y, eye, 0.4); };
        if (t === 0) for (const dx of [-5.5, -2, 1.5, 5]) bloom(dx, "feather", "gold");
        if (t === 1) for (const dx of [-3.5, 3]) { const x = cx + dx; P.ell(x, arc(x) - 0.5, 1, 1, "gold", { s: 0.45 }); }
        if (t === 2) {
          for (let x = cx - w + 1; x <= cx + w - 1; x += 2) P.line(x, arc(x) - 0.4, x + (x < cx ? -0.8 : 0.8), arc(x) - (Math.abs(x - cx) > 4 ? 4.2 : 3), "herb", 0.35, 0.45);
          for (const dx of [-5, -1, 3, 6]) { const x = cx + dx; P.px(x, arc(x) - 2.6, "lav", 0.45); P.px(x + 1, arc(x) - 1.8, "lav", 0); }
        }
        if (t === 3) {
          for (const [dx, h] of [[-6, 3], [-1.5, 4.8], [4, 3.2]]) P.line(cx + dx, arc(cx + dx) - 0.4, cx + dx - 0.8, arc(cx + dx) - h, "herb", 0.35, 0.5);
          const ex = cx + w - 0.5, ey = arc(ex);
          P.line(ex, ey, ex + 1.6, ey + 6, "leaf", 0.1, 0.5);
          for (const [dx, dy] of [[0.6, 2.4], [1.4, 4.6]]) P.ell(ex + dx + 0.8, ey + dy, 1, 0.7, "leaf", { s: 0.25, k: 0.6 });
          P.px(ex + 1.4, ey + 6.4, "berry", 0.4); P.px(ex + 2.2, ey + 6, "berry", 0);
          bloom(-4, "feather", "gold");
          bloom(2, "gold", "rust");
          for (const dx of [-1, 6]) { const x = cx + dx; P.px(x, arc(x) - 1.6, "lav", 0.45); P.px(x, arc(x) - 2.4, "lav", 0.1); }
          for (const [dx, dy] of [[-6.5, 0.6], [-5.6, 1.3], [4.6, 0.6], [5.5, 1.3]]) { const x = cx + dx; P.px(x, arc(x) + dy, "berry", 0.35); }
        }
        break;
      }
      case "feather_cap":
        P.ell(cx, 12, fw + 1, 5.6, "hd", { s: 0.1, fn: (x, y, s) => (y > 12 ? false : s) });
        if (t === 3) P.rect(cx - fw - 0.5, 11, fw * 2 + 1, 1, "gold", 0.2);
        if (t === 3) { P.line(cx + 3, 8, cx + 11, -1, "peacock", 0.1, 0.9); P.ell(cx + 10.5, -0.5, 1.7, 1.7, "peacock", { s: 0 }); P.px(cx + 10, -1, "gold", 0.5); P.px(cx + 10, 0, "night", 0.2); }
        else P.line(cx + 3, 8, cx + (t === 0 ? 7 : 10), t === 0 ? 3 : 0, t === 2 ? "fav" : "feather", 0.3, t === 0 ? 0.6 : 0.9);
        if (t === 2) P.line(cx + 2, 8, cx + 6, -1, "feather", 0.3, 0.7);
        break;
    }
    if (c.hglow) {
      const spot = { helm: [cx, 13], great_helm: [cx, 14], skull_helm: [cx, 9], hood: [cx, 30], skull_hood: [cx, 9], beast_hood: [cx - 3, 8], wizard_hat: [cx, 8], mitre: [cx, 4], wide_hat: [cx, 8],
        top_hat: [cx, 7], tricorn: [cx + 3, 8], circlet: [cx, 12], crown: [cx, 6], mask: [cx, 14], bandana: [cx, 10], feather_cap: [cx, 10], leather_cap: [cx, 13], horns: [cx, 13], fur_cap: [cx, 12], herb_wreath: [cx, 11], slouch_hat: [cx - 5, 7] }[head];
      if (spot) { P.px(spot[0], spot[1], c.hglow); P.px(spot[0] - 1, spot[1], mix(c.hglow, "#ffffff", 0.5)); }
    }
  }

  // ---------- portrait ----------
  function portrait(h, clsLook, opts) {
    opts = opts || {};
    const c = setup(h, clsLook), P = new Paint(PW, PH), { cx, look, mats } = c, K = c.k;
    c.hglow = K.head && K.head.glow;
    P.tf = { ox: 20, oy: 17.5, cx: 20, cy: 15.5, s: 1 };
    headBack(P, c);
    P.layer = 1;
    const glows = [];
    const back = K.back && K.back.art, bt = tierOf(K.back, 1);
    if (back) glows.push([track(P, () => backPortrait(P, c, back, bt, false)), K.back.glow]);
    if (BEHIND.has(c.mark)) bodyMark(P, c, false, "back");
    const wpx = track(P, () => portraitWeapon(P, K.w));
    if (K.off) {
      const [ax, ay] = OFF_C[K.off.art] || [21.5, 22.5], tf0 = P.tf;
      P.tf = { ox: 33, oy: 27, cx: ax, cy: ay, s: 2 };
      c.ofg = K.off.glow;
      glows.push([track(P, () => offhand(P, K.off.art, tierOf(K.off, 1), c)), K.off.glow]);
      P.tf = tf0;
    }
    P.layer = 2;
    const tpx = track(P, () => torso(P, c.outfit, cx, c.r, c));
    armorPortrait(P, c);
    if (c.mark === "tabard") bodyMark(P, c, false, "torso");
    if (K.aglow) glows.push([tpx, K.aglow]);
    if (K.belt) glows.push([track(P, () => { P.rect(cx - 15, 35.5, 30, 2, "blt", (x, y) => (y < 36 ? 0.35 : -0.1) - (x - cx) * 0.03); P.rect(cx - 2, 35, 4, 3, K.belt.tier >= 2 ? "gold" : "omet", (x) => 0.45 - (x - cx) * 0.2); P.rect(cx - 1, 36, 2, 1, "blt", -0.4); }), gradeGlow(K.belt)]);
    else if (K.pocket && K.pocket.art === "belt") glows.push([track(P, () => { P.rect(cx - 15, 35.5, 30, 2, "pk", (x, y) => (y < 36 ? 0.35 : -0.1) - (x - cx) * 0.03); P.rect(cx - 2, 35, 4, 3, "gold", (x) => 0.45 - (x - cx) * 0.2); P.rect(cx - 1, 36, 2, 1, "pk", -0.4); }), K.pocket.glow]);
    P.layer = 3;
    if (back) glows.push([track(P, () => backPortrait(P, c, back, bt, true)), K.back.glow]);
    headFront(P, c, true);
    P.layer = 8;
    if (K.neck) glows.push([track(P, () => neckPortrait(P, K.neck.art, cx)), K.neck.glow]);
    if (BODY_MARKS.has(c.mark)) { c.frame = opts.frame || 0; P.layer = 9; bodyMark(P, c, false); }
    const aura = clsLook.aura || (h.legend ? "gold" : null);
    const ac = aura ? AURA[aura] || AURA.arcane : null;
    const fav = toHsv(look.fav);
    const bgBase = hsv(fav[0], 0.25, 0.16), bgGlow = ac ? mix(ac[0], "#1a1620", 0.72) : hsv(fav[0], 0.3, 0.22);
    const bg = opts.bg === false ? null : (x, y) => {
      const d = Math.hypot((x - cx) / 20, (y - 15) / 18);
      const t = Math.max(0, 1 - d);
      return t > 0.55 ? bgGlow : t > 0.3 ? mix(bgBase, bgGlow, 0.5) : bgBase;
    };
    P.tf = null;
    const g = P.render(mats, { bg, outline: "#120e14", flat: FLAT });
    if (K.w.glow) glowUp(g, P, wpx, K.w.glow, opts.frame, { outline: "#120e14", edgeAmt: 0.6 });
    for (const [px, gl] of glows) glowUp(g, P, px, gl, opts.frame, { outline: "#120e14", edge: "none" });
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
        if (near(x, y, 2)) g.px[i] = mix(g.px[i] || bgBase, ac[0], 0.26);
        else if (near(x, y, 3)) g.px[i] = mix(g.px[i] || bgBase, ac[0], 0.12);
      }
      if (h.legend) for (const [sx, sy] of [[5 + (rr() * 3 | 0), 6], [33 - (rr() * 3 | 0), 4]]) {
        g.set(sx, sy, ac[1]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.set(sx + dx, sy + dy, mix(ac[0], bgBase, 0.3));
      }
    }
    return g;
  }

  // the weapon slung behind the shoulders: one-handers on the left, staves and lutes on the right
  const SLING = { sword: [10, 34, -0.36], axe: [10, 35, -0.3], mace: [10, 35, -0.3], daggers: [8, 33, -0.3], spear: [6, 41, -0.14], bow: [5, 20, -0.05], crossbow: [6, 32, -0.2],
    staff: [33, 41, 0.06], wand: [8, 32, -0.42], lute: [31, 38, 0.18], frying_pan: [9, 35, -0.36] };
  function portraitWeapon(P, w) {
    const p = SLING[w.family];
    if (!p) return;
    const tf = P.tf;
    P.tf = null;
    const A = axis(P, p[0], p[1], p[2], 1.6);
    weapon(P, w.family, w.tier, A, { glow: w.glow });
    P.tf = tf;
  }

  function backPortrait(P, c, art, t, front) {
    const cx = c.cx;
    switch (art) {
      case "cloak": case "cape": {
        const cape = art === "cape";
        if (!front) {
          P.ell(cx, 43, 19.2, 16.4, "bk", { s: 0.1, fn: (x, y, s) => s + (t === 2 && !cape && (x + y) % 5 === 0 ? 0.5 : 0) + (t === 2 && cape && x % 3 === 0 ? 0.4 : 0) });
          if (!cape) P.ell(cx, 26.5, 7.5, 3.2, "bk", { s: -0.2 });
          if (cape) for (let y = 30; y < 40; y++) P.px(cx + 18 - (y - 30) * 0.15, y, t >= 2 ? "gold" : "shirt", -0.1);
        } else {
          for (const s of [-1, 1]) P.poly(s < 0 ? [[cx - 18, 36], [cx - 9, 28.5], [cx - 5, 29.5], [cx - 11, 40], [cx - 18, 40]] : [[cx + 18, 36], [cx + 9, 28.5], [cx + 5, 29.5], [cx + 11, 40], [cx + 18, 40]], "bk", s < 0 ? 0.25 : -0.2);
          if (t === 0 && !cape) P.rect(cx + 12, 36, 3, 3, "patch", 0);
          if (t === 3) { for (let y = 29; y < 40; y++) { P.px(cx - 9 - (y - 29) * 0.18, y, "gold", 0.2); P.px(cx + 9 + (y - 29) * 0.18, y, "gold", -0.1); } }
          if (t >= 1 || cape) {
            const m = t === 3 || (cape && t >= 2) ? "gold" : "omet";
            for (const s of cape ? [-1] : [-1, 1]) P.ell(cx + s * 6.5, 30.5, 1.8, 1.7, m, { s: s < 0 ? 0.35 : 0 });
            if (!cape) P.line(cx - 5, 30.5, cx + 5, 30.5, m, -0.1);
            if (t === 3) P.px(cx - 7, 30, "crim", 0.5);
          }
        }
        break;
      }
      case "fur_mantle":
        if (!front) P.ell(cx, 43, 18.5, 15.6, "bk", { s: -0.3 });
        else {
          const r = t === 3 ? 2.8 : 2.4;
          for (let a = 0; a < 24; a++) {
            if (t === 0 && a % 5 === 2) continue;
            const q = (a / 23) * Math.PI, x = cx - Math.cos(q) * 14, y = 31 - Math.sin(q) * 3.2 + (a % 2) * 0.8;
            P.ell(x, y, r, r - 0.2, "bk", { s: (a % 3 === 0 ? 0.35 : 0) - (x - cx) * 0.03, k: 0.7 });
          }
          if (t === 2) { P.ell(cx - 12, 29, 3, 2.6, "bk", { s: 0.2 }); P.poly([[cx - 15, 27.5], [cx - 14, 24.5], [cx - 12.5, 27]], "bk", 0.3); P.poly([[cx - 11.5, 27], [cx - 10, 24.5], [cx - 9.5, 27.5]], "bk", 0); P.px(cx - 13, 29, "#16121a"); P.px(cx - 10, 30, "#16121a"); }
          if (t === 3) for (const x of [cx - 11, cx - 9, cx + 9, cx + 11]) P.poly([[x - 0.6, 33], [x + 0.6, 33], [x, 35]], "cream", 0.3);
        }
        break;
      case "quiver":
        if (!front) { quiverBody(P, QP, t); quiverArrows(P, QP, t); }
        else { const m = t ? "dleather" : "strap"; P.line(cx + 12, 28.5, cx - 8, 40, m, 0.1); P.line(cx + 13, 29, cx - 7, 40.5, m, -0.3); if (t >= 2) P.rect(cx + 1, 34, 2, 2, t === 3 ? "gold" : "omet", (x) => 0.4 - (x - cx - 1) * 0.3); }
        break;
      case "backpack":
        if (!front) {
          if (t === 0) { P.ell(33, 27, 5, 5.5, "bk", { s: 0.15 }); P.line(31, 22, 33, 21, "leather", 0); }
          else {
            if (t === 2) { P.rect(4, 12, 1, 22, "wood", 0.1); P.rect(35, 12, 1, 22, "wood", -0.2); P.rect(4, 13, 32, 1, "wood", 0.2); }
            P.rect(5, 22, 30, 12, "bk", (x) => 0.15 - (x - 5) * 0.025);
            P.ell(20, 22, 15, 2.4, t === 3 ? "fav" : "cream", { s: 0.1 });
            if (t === 3) { P.rect(5, 26, 30, 1, "omet", 0.3); P.ell(36, 30, 2, 2, "dmetal", { s: 0 }); }
          }
        } else if (t) { for (const s of [-1, 1]) P.rect(cx + s * 7 - 1, 29, 2, 11, "dleather", s < 0 ? 0 : -0.2); if (t === 3) for (const s of [-1, 1]) P.rect(cx + s * 7 - 1, 34, 2, 1, "gold", 0.3); }
        else P.line(cx + 12, 29, cx - 6, 40, "leather", 0);
        break;
      case "banner":
        if (!front) {
          P.line(35, 0, 35, 40, "wood", 0);
          if (t >= 2) P.ell(35.5, 0.5, 1.2, 1.2, "gold", { s: 0.3 });
          if (t === 0) P.poly([[36, 2], [40, 2], [38.5, 5], [40, 8], [36, 9]], "bk", (x, y) => 0.2 - (y - 2) * 0.06);
          else P.poly([[36, 1.5], [40, 1.5], [40, t === 3 ? 14 : 11], [38, t === 3 ? 12 : 9], [36, t === 3 ? 14 : 11]], "bk", (x, y) => 0.2 - (y - 1) * 0.05);
          if (t >= 2) P.rect(36, 1.5, 4, 1, "gold", 0.2);
          if (t === 3) P.rect(37, 5, 2, 3, "shirt", 0.2);
        }
        break;
    }
  }

  // ---------- full-body sprites (28x34): native body, the portrait head scaled down, native face dots ----------
  const ROBES = new Set(["robe", "robe_dark", "vestments"]);
  // short one-handers lean out from the body so their heads read against the sleeve
  const TWO_GRIP = (f, t) => (f === "axe" && t >= 4) || (f === "mace" && t === 5) || f === "spear";
  const HOLD_TILT = { axe: -0.22, mace: -0.26, frying_pan: -0.3, wand: -0.45, daggers: -0.55, lute: -0.35 };
  function fullBody(o) {
    if (o.look && o.look.child) return childBody(o);
    const h = { id: o.id, name: o.name, look: o.look, weapon: o.weapon, weapon_tier: o.weaponTier, armor_tier: o.armorTier, legend: o.legend, kit: o.kit };
    const BH = o.seated ? Math.max(34, o.seated + 2) : 34;
    // o.pose (deaths): the figure on a canvas padded by pad, its standing place at (pad, pad); kneel drops it onto its knees,
    // tilt turns it about pivot, painted natively at that angle
    const q = o.pose || null, pad = q ? 34 : 0, kn = q ? q.kneel || 0 : 0;
    const cl = o.clsLook || {}, c = setup(h, cl), P = new Paint(28 + pad * 2, BH + pad * 2), M = c.mats, outfit = c.outfit, K = c.k;
    c.sprite = true; c.frame = o.frame || 0;
    const base = BASE[outfit] || "hide";
    c.hglow = K.head && K.head.glow;
    const HT = { ox: 14, oy: 9.6, cx: 20, cy: 15.5, s: 0.66 };
    let upper = null, lower = null;
    if (q) {
      const pv = q.pivot || [0.5, 1], cx = pv[0] * 28, cy = pv[1] * BH;
      lower = { a: q.tilt || 0, cx, cy, ox: pad + cx, oy: pad + cy };
      upper = Object.assign({}, lower, { cy: cy - 4 * kn });
      P.post = upper; P.eraseT = true; P.screenLight = true;
    }
    const glows = [], jewels = [], torsoPx = [];
    P.tf = HT; headBack(P, c); P.tf = null;
    P.layer = 1;
    const back = K.back && K.back.art, bt = tierOf(K.back, 1);
    if (outfit === "cloak" || outfit === "robe_dark" || (K.legacy && back === "banner")) {
      // in the saddle the cloak falls back over the mount's rump instead of hanging to the heels
      if (o.seated) P.poly([[8, 17], [20, 17], [19, 26], [3.5, 28.5], [5, 23]], "favd", (x, y) => -0.2 - (x - 14) * 0.05 - (y - 17) * 0.02);
      else P.poly([[8, 17], [20, 17], [22.5, 32], [5.5, 32]], "favd", (x) => -0.2 - (x - 14) * 0.05);
    }
    if (back) glows.push([track(P, () => backSprite(P, c, back, bt, false)), K.back.glow]);
    if (BEHIND.has(c.mark)) bodyMark(P, c, true, "back");
    P.layer = 2;
    const peg = c.scars.includes("peg"), boots = !!K.boots || !!(K.pocket && K.pocket.art === "boots");
    const bootM = K.boots ? "bts" : boots ? "pk" : "boot", bootTop = boots ? 28 : 30;
    if (q) P.post = lower;
    const bootPx = track(P, () => {
      if (q && kn) kneelLegs(P, outfit, base, bootM, peg, kn);
      else if (o.seated) seatedLegs(P, outfit, base, bootM, peg, boots, o.seated);
      else if (!ROBES.has(outfit)) {
        const pm = outfit === "plate" ? "metal" : outfit === "fur" ? "hide" : "pants";
        P.rect(10, 25, 3, 6, pm, (x) => 0.15 - (x - 10) * 0.12);
        if (peg) P.rect(16, 25, 1, 7, "wood", 0); else P.rect(15, 25, 3, 6, pm, (x) => -0.2 - (x - 15) * 0.12);
        P.rect(9, bootTop, 4, 33 - bootTop, bootM, (x, y) => (y === bootTop ? 0.3 : -0.1) - (x - 9) * 0.08);
        if (!peg) P.rect(15, bootTop, 4, 33 - bootTop, bootM, (x, y) => (y === bootTop ? 0.1 : -0.3) - (x - 15) * 0.08);
        if (boots) { P.rect(9, bootTop, 4, 1, bootM, 0.6); if (!peg) P.rect(15, bootTop, 4, 1, bootM, 0.3); }
      } else {
        P.poly([[9, 23], [19, 23], [21.5, 32.5], [6.5, 32.5]], base, (x, y) => 0.15 - (x - 14) * 0.07 + ((x === 13 || x === 16) && y > 26 ? -0.45 : 0));
        P.rect(8, 32, 4, 1, bootM, -0.2); P.rect(16, 32, 4, 1, bootM, -0.4);
        if (boots) { P.rect(8, 31, 4, 1, bootM, 0.3); P.rect(16, 31, 4, 1, bootM, 0); }
      }
    }).filter((i) => P.mat[i] === bootM);
    if (q) P.post = upper;
    if (K.boots) {
      if (!q && !o.seated && !ROBES.has(outfit) && K.boots.tier >= 2) { P.px(10, 29, "gold", 0.3); if (!peg) P.px(16, 29, "gold", 0); }
      glows.push([bootPx, gradeGlow(K.boots)]);
    } else if (boots) glows.push([bootPx, K.pocket.glow]);
    torsoPx.push(...track(P, () => P.poly([[8.5, 17], [19.5, 17], [19, 25.5], [9, 25.5]], base, (x, y) => 0.25 - (x - 13) * 0.08 - (y - 17) * 0.025 + (outfit === "chain" && (x + y * 2) % 3 === 0 ? -0.45 : 0))));
    switch (outfit) {
      case "robe": case "robe_dark": P.poly([[12, 17], [16, 17], [14, 20]], "skin", -0.5); P.rect(9, 22, 10, 1, K.at >= 4 ? "gold" : K.at === 1 ? "dleather" : "gold", 0.2); break;
      case "vestments": P.rect(11, 17, 1, 13, "fav", 0.1); P.rect(16, 17, 1, 13, "fav", -0.2); P.rect(9, 22, 10, 1, K.at === 1 ? "dleather" : "gold", 0); break;
      case "plate": P.rect(11, 20, 6, 7, "fav", (x) => 0.1 - (x - 11) * 0.08); P.rect(9, 24, 10, 1, "dleather", -0.1); P.px(13, 24, "gold", 0.3); P.rect(10, 18, 8, 1, "metal", 0.7); break;
      case "chain": P.rect(11, 19, 6, 8, "fav", (x) => 0.1 - (x - 11) * 0.08); P.rect(9, 24, 10, 1, "dleather", 0); for (let x = 10; x <= 17; x++) P.px(x, 17, "metal", (x % 2 ? 0.6 : -0.2)); break;
      case "leather": P.line(9, 17, 18, 25, "dleather", -0.1); P.rect(9, 24, 10, 1, "dleather", -0.2); P.px(13, 24, "gold", 0.3); break;
      case "fur": for (let x = 8; x <= 19; x++) P.ell(x + 0.5, 17.6 + (x % 2) * 0.5, 1.2, 1.1, "fur", { s: 0.25 - (x - 13) * 0.05, k: 0.6 }); P.rect(9, 24, 10, 1, "fav", 0); break;
      case "cloak": P.rect(13, 18, 2, 7, "favd", -0.4); P.ell(13.5, 17.6, 1.4, 1.2, "gold", { s: 0.3 }); break;
      case "fancy": P.rect(12, 17, 4, 2, "shirt", 0.2); for (const y of [20, 22, 24]) P.px(14, y, "gold", 0.4); P.rect(9, 25, 10, 1, "gold", 0); break;
      case "vest": P.poly([[8.5, 17], [12, 17], [12, 25.5], [9, 25.5]], "fav", 0.15); P.poly([[16, 17], [19.5, 17], [19, 25.5], [16, 25.5]], "fav", -0.3); P.px(12, 21, "gold", 0.3); break;
      case "motley":
        // harlequin diamonds in the hero's colour and cream, a points-down hem over the hose
        for (let y = 17; y <= 25; y++) for (let x = 8; x <= 19; x++) if (P.matAt(x, y) === base && harlequin(x + 1, y - 17, 2, 3)) P.px(x, y, "shirt", 0.15 - (x - 13) * 0.06);
        for (const x of [9, 11, 13, 15, 17]) P.px(x + (x > 13 ? 1 : 0), 26, x % 4 === 1 ? "shirt" : base, -0.2);
        P.rect(11, 17, 6, 1, "gold", (x) => 0.4 - (x - 11) * 0.1);
        break;
    }
    armorSprite(P, c);
    if (c.mark === "tabard") bodyMark(P, c, true, "torso");
    if (K.belt) {
      const by = ROBES.has(outfit) ? 22 : 24;
      glows.push([track(P, () => { P.rect(9, by, 10, 2, "blt", (x, y) => (y === by ? 0.3 : -0.2) - (x - 9) * 0.04); P.rect(13, by, 2, 2, K.belt.tier >= 2 ? "gold" : "silver", (x) => (x === 13 ? 0.5 : 0)); P.px(K.belt.tier ? 18 : 15, by + 2, "blt", -0.3); }), gradeGlow(K.belt)]);
    } else if (K.pocket && K.pocket.art === "belt") glows.push([track(P, () => { P.rect(9, 24, 10, 2, "pk", (x, y) => (y === 24 ? 0.3 : -0.2) - (x - 9) * 0.04); P.rect(13, 24, 2, 2, "gold", (x) => (x === 13 ? 0.5 : 0)); P.px(18, 26, "pk", -0.3); }), K.pocket.glow]);
    else if (K.pocket && !["boots", "gauntlet", "belt"].includes(K.pocket.art)) P.rect(17, 24, 2, 2, "leather", (x) => 0.2 - (x - 17) * 0.3);
    P.layer = 3;
    const sleeve = outfit === "plate" || outfit === "chain" ? "metal" : outfit === "fur" ? "skin" : outfit === "vestments" ? "shirt" : outfit === "robe_dark" ? "robed" : outfit === "leather" ? "hide" : outfit === "cloak" ? "cloth" : base;
    const wf = K.w.family, wt = K.w.tier, both = TWO_GRIP(wf, wt);
    c.both = both;
    torsoPx.push(...track(P, () => {
      P.rect(6, 17, 2, 7, sleeve, (x, y) => 0.35 - (y - 17) * 0.05 - (x - 6) * 0.25);
      if (!both) P.rect(20, 17, 2, 7, sleeve, (x, y) => -0.15 - (y - 17) * 0.05 - (x - 20) * 0.25);
      armorShape(P, c, sleeve);
      if (outfit === "motley" && !both) for (let y = 17; y < 24; y++) for (const x of [20, 21, 22]) if (P.matAt(x, y) === sleeve) P.px(x, y, "shirt", -0.1 - (x - 20) * 0.2);
    }));
    const gaunt = K.pocket && K.pocket.art === "gauntlet", gl = K.gloves, hand = gl ? "glv" : "skin", glovePx = [];
    const cuff = (x0, s0) => track(P, () => { P.rect(x0, 22, 2, 4, "glv", (x, y) => (y === 22 ? 0.55 : 0.15) + s0 - (x - x0) * 0.3); if (gl.tier >= 2) P.rect(x0, 22, 2, 1, "gold", 0.2 + s0); });
    if (gl) glovePx.push(...cuff(6, 0));
    else if (gaunt) glows.push([track(P, () => { P.rect(6, 22, 2, 4, "pk", (x, y) => 0.4 - (x - 6) * 0.3 - (y - 22) * 0.1); P.rect(5, 21, 4, 2, "pk", (x, y) => (y === 21 ? 0.6 : 0) - (x - 5) * 0.15); }), K.pocket.glow]);
    else P.rect(6, 24, 2, 2, "skin", (x) => 0.2 - (x - 6) * 0.3);
    if (both) P.layer = 3;
    else if (c.scars.includes("hook")) { P.px(21, 24, "#a8a8b0"); P.px(21, 25, "#c8c8d0"); P.px(20, 26, "#a8a8b0"); }
    else if (gl) glovePx.push(...cuff(20, -0.25));
    else P.rect(20, 24, 2, 2, "skin", (x) => -0.2 - (x - 20) * 0.3);
    if (back) glows.push([track(P, () => backSprite(P, c, back, bt, true)), K.back.glow]);
    const hpx = track(P, () => { P.tf = HT; headFront(P, c, false); P.tf = null; });
    if (K.neck) {
      P.layer = 7;
      neckSprite(P, K.neck.art);
      if (K.neck.glow) jewels.push([K.neck.art === "brooch" ? [10, 18] : [13, 18], K.neck.glow]);
    }
    P.layer = 7;
    if (!c.full) {
      const hooded = c.head === "hood" || c.head === "skull_hood" || c.head === "beast_hood";
      const ec = c.head === "skull_hood" && c.ht >= 2 ? "#8af09a" : c.pale ? "#b8c8e8" : hooded ? mix(c.eye, "#e6dccf", 0.55) : mix(c.eye, "#100c10", 0.55);
      if (q && q.eyes > 0.5) { P.px(12, 10, "skin", -0.75); P.px(15, 10, "skin", -0.75); }
      else {
        P.px(12, 10, ec);
        if (!c.scars.includes("eyepatch")) P.px(15, 10, ec);
      }
      if (!c.covered || HAIRY.has(c.head)) for (const x of [11, 12, 15, 16]) if (c.head !== "mask") P.px(x, 8, "hair", -0.6);
      P.px(14, 12, "skin", -0.6);
      if (c.look.face !== 2) { P.px(13, 13, "lip", -0.6); P.px(14, 13, "lip", -0.75); }
      // the scaled head skips 1px detail, so stubble is drawn here at sprite size: a shadow along the jaw
      if (c.look.face === 1) for (const [x, y, s] of [[12, 13, 0], [15, 13, -0.3], [12, 14, -0.1], [13, 14, 0], [14, 14, -0.2], [15, 14, -0.35]]) P.px(x, y, "stub", s);
    } else { P.px(12, 10, c.glint || "#e6dccf"); P.px(15, 10, c.glint || "#e6dccf"); }
    if (FINE.has(c.mark)) { P.layer = 8; fineMark(P, c, "front"); }
    if (K.head && K.head.glow) glows.push([hpx.filter((i) => P.lay[i] === 7 && P.mat[i] !== "skin" && P.mat[i] !== "hair"), K.head.glow]);
    if (back === "quiver" || back === "backpack") glows.push([track(P, () => backTop(P, back, bt)), K.back.glow]);
    P.layer = 8;
    if (K.off) {
      c.ofg = K.off.glow;
      const art = K.off.art;
      glows.push([track(P, () => offhand(P, art, tierOf(K.off, 1), c)), K.off.glow]);
      if (art !== "shield" && art !== "tower_shield" && art !== "lute") glovePx.push(...track(P, () => P.rect(art === "shovel" ? 21 : 20, 24, 2, 2, hand, (x) => 0.2 - (x - 20) * 0.3)));
    }
    if (BODY_MARKS.has(c.mark)) { P.layer = 8; bodyMark(P, c, true); }
    P.layer = 9;
    const second = wf === "daggers" && !K.off && (K.legacy || K.w.two !== false) ? axis(P, 21.5, 25.5, 0.55, 1) : null;
    const A = wf === "crossbow" ? axis(P, 9, 23, -Math.PI / 2, 1) : axis(P, wf === "daggers" ? 6.5 : 7, wf === "daggers" ? 25.5 : 26, both ? -0.36 : HOLD_TILT[wf] || 0, 1);
    // a fallen figure's weapon falls on its own: without ["weapon"] leaves it out, part "weapon" is the weapon alone
    const noW = q && q.without && q.without.includes("weapon");
    const wpx = noW ? [] : track(P, () => weapon(P, wf, wt, A, { glow: K.w.glow, second }));
    if (both) {
      // the free hand reaches across to grip the haft above the main hand
      const [fx, fy] = A.at(4.8, 0);
      P.layer = 3;
      P.line(17.5, 19.5, fx + 1.6, fy + 0.2, sleeve, -0.15, 1);
      P.layer = 10;
      glovePx.push(...track(P, () => { P.rect(Math.round(fx - 1), Math.round(fy - 1), 2, 2, hand, (x) => 0.3 - (x - fx) * 0.3); P.rect(6, 24, 2, 2, gl ? "glv" : gaunt ? "pk" : "skin", (x) => 0.2 - (x - 6) * 0.3); }));
    }
    if (o.seated) { P.layer = 10; saddleTop(P); }
    P.layer = 11;
    (K.rings || []).forEach((rg, i) => {
      const x = i === 0 ? 7 : 19, band = rg.art === "band" ? "copper" : "gold", gem = rg.glow ? null : rg.gem, bx = i === 0 ? x : x + 1, gx = i === 0 ? x + 1 : x;
      P.px(bx, 24, band, 0.4); P.px(bx, 25, band, -0.3);
      if (rg.glow) jewels.push([[gx, 24], rg.glow, true]);
      else { P.px(gx, 24, gem || band, gem ? undefined : 0.7); P.px(gx, 25, gem ? mix(gem, "#16121a", 0.35) : band, gem ? undefined : 0.1); }
    });
    if (q && q.part === "weapon") { const keep = new Set(wpx); for (let i = 0; i < P.mat.length; i++) if (!keep.has(i)) P.mat[i] = null; }
    let g = P.render(M, { outline: o.legend ? "#5a3a08" : "#16121a", flat: FLAT });
    const outline = o.legend ? "#5a3a08" : "#16121a";
    if (K.w.glow) glowUp(g, P, wpx, K.w.glow, o.frame, { outline });
    if (K.aglow) glowUp(g, P, torsoPx, K.aglow, o.frame, { outline, amt: 0.6 });
    for (const [px, gw] of glows) glowUp(g, P, px, gw, o.frame, { outline });
    if (gl && gradeGlow(gl)) glowUp(g, P, glovePx.filter((i) => P.mat[i] === "glv"), gradeGlow(gl), o.frame, { outline });
    // jewellery is too small for a rim: a stone in the glow colour, with a highlight that blinks
    for (const [[x, y], gl, half] of jewels) {
      for (let j = 0; j < 2; j++) for (let i = 0; i < (half ? 1 : 2); i++) g.set(x + i, y + j, j ? mix(gl, "#16121a", 0.3) : gl);
      g.set(x, y, mix(gl, "#ffffff", o.frame ? 0.3 : 0.65));
    }
    const aura = cl.aura || (o.legend ? "gold" : null);
    if (q) { g.pad = pad; g.stand = [28, BH]; return g; }
    if (aura) {
      const ac = AURA[aura] || AURA.arcane, rr = rng(hash(aura) + (o.frame || 0) * 7919), edge = [];
      for (let y = 0; y < BH; y++) for (let x = 0; x < 28; x++) if (P.mat[y * 28 + x] === null && g.px[y * 28 + x]) edge.push([x, y]);
      for (let k = 0; k < (o.legend ? 5 : 3); k++) {
        const [x, y] = edge[Math.floor(rr() * edge.length)] || [0, 0];
        const nx = x + (rr() < 0.5 ? -1 : 1) * (1 + Math.floor(rr() * 2)), ny = y + (aura === "fire" || aura === "holy" ? -1 : rr() < 0.5 ? -1 : 1) * (1 + Math.floor(rr() * 2));
        if (!g.get(nx, ny)) g.set(nx, ny, ac[Math.floor(rr() * ac.length)]);
      }
    }
    if (o.frame === 1) { const n = new Grid(28, BH); for (let y = 0; y < BH - 1; y++) for (let x = 0; x < 28; x++) n.px[(y + 1) * 28 + x] = g.px[y * 28 + x]; g = n; }
    return g;
  }

  // on both knees: the thighs drop straight to knees on the floor and the shins and boots lie back behind them
  function kneelLegs(P, outfit, base, bootM, peg, kn) {
    const D = 4 * kn, top = 25 + D;
    if (ROBES.has(outfit)) {
      P.poly([[9, 23 + D], [19, 23 + D], [21.5, 32.5], [6.5, 32.5]], base, (x, y) => 0.15 - (x - 14) * 0.07 + ((x === 13 || x === 16) && y > 28 ? -0.45 : 0));
      P.rect(5, 32, 4, 1, bootM, -0.3);
      return;
    }
    const pm = outfit === "plate" ? "metal" : outfit === "fur" ? "hide" : "pants";
    P.rect(5, 31, 5, 2, bootM, (x, y) => (y === 31 ? 0.1 : -0.35) - (x - 5) * 0.04);
    P.rect(10, top, 3, 33 - top, pm, (x, y) => 0.15 - (x - 10) * 0.12 - (y > 31 ? 0.25 : 0));
    if (peg) P.rect(16, top, 1, 33 - top, "wood", 0);
    else {
      P.rect(14, 32, 4, 1, bootM, -0.4);
      P.rect(15, top, 3, 33 - top, pm, (x, y) => -0.2 - (x - 15) * 0.12 - (y > 31 ? 0.25 : 0));
    }
  }

  // the saddle's raised cantle behind the rider and its small pommel ahead of the hip, drawn over everything held low (a
  // weapon hanging at the side passes behind it) so the seat reads even at sprite size
  function saddleTop(P) {
    P.poly([[2.5, 23], [4.5, 23], [5.5, 25.5], [9, 26], [9, 28.5], [3, 28.5]], "leather", (x, y) => (y <= 23 || (y === 26 && x > 5) ? 0.6 : y >= 28 ? -0.35 : 0.1 - (y - 24) * 0.05) - (x - 3) * 0.04);
    P.rect(19, 26, 2, 2, "leather", (x, y) => (y === 26 ? 0.55 : 0.05) - (x - 19) * 0.2);
  }

  // in the saddle, facing right: the near thigh drops steeply from the hip to a knee a little ahead of it, and the shin
  // and boot hang straight down the flank to the sole row `sole` (about the mount's belly line), heel down and toe forward; the far
  // leg is hidden behind the mount
  function seatedLegs(P, outfit, base, bootM, peg, boots, sole) {
    sole = Math.max(33, sole | 0);
    // under the seat: a short drape in the hero's colour and the saddle's leather flap; the cantle and pommel go on later,
    // over the torso's edge (saddleTop)
    P.poly([[6.5, 28], [16, 28], [15.5, 31], [7, 31]], "favd", (x, y) => (y === 28 ? 0.3 : y === 30 ? -0.45 : 0) - (x - 7) * 0.02);
    P.rect(5, 26, 15, 2, "leather", (x, y) => (y === 26 ? 0.35 : -0.15) - (x - 5) * 0.02);
    P.poly([[5, 27], [11, 27], [10.5, 29.5], [5.5, 29.5]], "leather", (x, y) => -0.05 - (y - 27) * 0.1 - (x - 5) * 0.02);
    if (ROBES.has(outfit)) {
      P.poly([[9, 23], [19, 23], [21, 27], [20.5, sole - 1], [16, sole - 1], [15, 28.5], [9, 27.5]], base, (x, y) => 0.2 - (x - 14) * 0.04 - (y - 23) * 0.03 + (x === 17 && y > 28 ? -0.4 : 0));
      P.rect(17, sole - 1, 4, 1, bootM, 0.1); P.rect(17, sole, 5, 1, bootM, -0.2);
      if (boots) P.rect(17, sole - 1, 4, 1, bootM, 0.5);
      return;
    }
    const pm = outfit === "plate" ? "metal" : outfit === "fur" ? "hide" : "pants";
    // the thigh drops steeply from the hip to a knee only a little ahead of it; the shin hangs straight down under the knee
    P.poly([[9, 25], [16, 25], [20.5, 28], [20.5, 31], [17, 31], [9, 28]], pm, (x, y) => 0.35 - (y - 25 - (x - 9) * 0.3) * 0.12 - (x - 9) * 0.01);
    if (peg) { P.rect(18, 31, 1, sole - 30, "wood", 0.1); return; }
    const top = Math.max(31, sole - (boots ? 3 : 2));
    if (top > 31) P.rect(17, 31, 3, top - 31, pm, (x, y) => 0.05 - (x - 17) * 0.2 - (y - 31) * 0.03);
    P.rect(17, top, 3, sole - top, bootM, (x, y) => (y === top ? 0.4 : 0.05) - (x - 17) * 0.15);
    P.rect(17, sole, 5, 1, bootM, (x) => -0.05 - (x - 17) * 0.05);
    if (boots) P.rect(17, top, 3, 1, bootM, 0.6);
  }

  // a child (look.child) is painted natively on a body two-thirds of an adult's; the head shrinks less than the body, as a child's does
  function childBody(o) {
    const h = { id: o.id, name: o.name, look: o.look, weapon: o.weapon, weapon_tier: o.weaponTier, armor_tier: o.armorTier, legend: o.legend, kit: o.kit };
    const c = setup(h, o.clsLook || {}), P = new Paint(28, 34), outfit = c.outfit, base = BASE[outfit] || "hide";
    const HT = { ox: 14, oy: 18.4, cx: 20, cy: 15.5, s: 0.56 };
    P.tf = HT; headBack(P, c); P.tf = null;
    P.layer = 2;
    if (!ROBES.has(outfit)) {
      P.rect(11, 27, 2, 4, "pants", (x) => 0.15 - (x - 11) * 0.15);
      P.rect(15, 27, 2, 4, "pants", (x) => -0.2 - (x - 15) * 0.15);
      P.rect(10, 31, 3, 2, "boot", (x, y) => (y === 31 ? 0.3 : -0.1) - (x - 10) * 0.08);
      P.rect(15, 31, 3, 2, "boot", (x, y) => (y === 31 ? 0.1 : -0.3) - (x - 15) * 0.08);
    } else {
      P.poly([[10, 26], [18, 26], [19.5, 32.5], [8.5, 32.5]], base, (x) => 0.15 - (x - 14) * 0.07);
      P.rect(9, 32, 3, 1, "boot", -0.2); P.rect(16, 32, 3, 1, "boot", -0.4);
    }
    P.rect(10, 22, 8, 6, base, (x, y) => 0.25 - (x - 13) * 0.09 - (y - 22) * 0.03);
    if (outfit === "vest") { P.rect(10, 22, 3, 6, "fav", 0.15); P.rect(15, 22, 3, 6, "fav", -0.3); }
    else if (!ROBES.has(outfit)) P.rect(10, 27, 8, 1, outfit === "fancy" ? "gold" : "dleather", -0.1);
    P.layer = 3;
    const sleeve = outfit === "vest" || outfit === "fancy" ? "shirt" : base;
    P.rect(8, 22, 2, 5, sleeve, (x, y) => 0.35 - (y - 22) * 0.05 - (x - 8) * 0.25);
    P.rect(18, 22, 2, 5, sleeve, (x, y) => -0.15 - (y - 22) * 0.05 - (x - 18) * 0.25);
    P.rect(8, 27, 2, 1, "skin", (x) => 0.2 - (x - 8) * 0.3);
    P.rect(18, 27, 2, 1, "skin", (x) => -0.2 - (x - 18) * 0.3);
    P.tf = HT; headFront(P, c, false); P.tf = null;
    // the head's neck is an adult's length, so below the chin the shirt takes it back
    for (let y = 23; y < 28; y++) for (let x = 10; x < 18; x++) {
      const i = y * 28 + x;
      if (P.lay[i] === 3 && P.mat[i] === "skin") { P.mat[i] = outfit === "vest" && (x < 13 || x > 14) ? "fav" : base; P.sh[i] = 0.1 - (x - 13) * 0.09; }
    }
    P.layer = 7;
    if (!c.full) {
      const ec = c.pale ? "#b8c8e8" : mix(c.eye, "#100c10", 0.55);
      P.px(12, 20, ec); P.px(15, 20, ec);
      if (c.look.face !== 2) P.px(13, 22, "lip", -0.6);
    }
    let g = P.render(c.mats, { outline: "#16121a", flat: FLAT });
    if (o.frame === 1) { const n = new Grid(28, 34); for (let y = 0; y < 33; y++) for (let x = 0; x < 28; x++) n.px[(y + 1) * 28 + x] = g.px[y * 28 + x]; g = n; }
    return g;
  }

  // asleep in bed, three-quarter: the head rolled toward us on the pillow (drawn natively tilted, see Paint.T), the shoulders
  // above the fold of the covers, the near arm out over the blanket, and the body a mound under the quilt that rises on frame 1.
  // q: { quilt: [base, alt, trim], len: tiles from the chin to the toes, patch, roll, pillow, awake }. The floor spot lands at (18, 24), at quilt height.
  // roll: on a bedroll on the ground, its rolled end for a pillow; awake: the same pose with the eyes open.
  // Every hat, hood, helm and crown is off for the night; marks like a halo stay.
  const PATCHES = ["#a84a32", "#d8b860", "#5a7a4a", "#c88a5a", "#4a6a8a", "#e0d4b8", "#8a3a2a"];
  // the head on the pillow, drawn at the lying angle in screen pixels: x runs across the face, y down it to the chin, tilted so the crown
  // points up the bed and turned toward us, so the face sits low on the near side and the back of the head shows above and behind it
  const LIE_TILT = -0.5;
  // hair that spreads on the pillow, grouped from the old lying table: [past the crown, past the back, falling down the far side, wave, texture: 0 straight, 1 curls, 2 locs, 3 waves]
  const LIE_HAIR = { 1: [2.4, 3.6, 7, 0.5, 0], 5: [1.4, 1.8, 2.5, 0.5, 1], 8: [2.4, 2.8, 3, 0.6, 1], 9: [2.2, 3.4, 7, 0, 2], 13: [0.3, 2.4, 6, 0.3, 0], 15: [0.6, 1.4, 3.5, 0.2, 0],
    16: [2.8, 4, 7.5, 0.5, 3], 20: [1.6, 2.8, 6, 0.4, 0] };
  const BARE_EARS = new Set([0, 2, 3, 4, 6, 7, 10, 11, 12, 14, 17, 18, 19, 21]);
  function lyingHead(P, c, X, Y, awake, after) {
    const { st, look, scars } = c, tex = c.hairTex, tf = { ox: X, oy: Y, cx: 0, cy: 0, s: 1, a: LIE_TILT };
    const field = (x0, y0, x1, y1, m, fn) => { P.tf = tf; P.fillWarped(x0, y0, x1, y1, m, fn); P.tf = null; };
    const draw = (fn) => { P.tf = tf; fn(); P.tf = null; };
    const skull = (x, y, g) => ((x - 0.5) / (5.1 + (g || 0))) ** 2 + ((y + 0.3) / (5.3 + (g || 0))) ** 2 <= 1;
    const face = (x, y) => ((x + 0.9) / 3.9) ** 2 + ((y - 0.5) / 3.9) ** 2 <= 1 || ((x + 0.9) / 3.2) ** 2 + ((y - 2.3) / 3.1) ** 2 <= 1;
    const fr = FRINGE[st], bald = st === 4 || st === 3;
    const hairline = (x) => (fr === "full" ? -1.5 : fr === "sweep" ? -1.3 - (x + 4) * 0.25 : -2.2) + Math.abs(x + 0.9) * 0.12;
    const curl = (x, y, s) => s + ((x * 3 + y * 5) % 7 === 0 ? -0.45 : (x * 5 + y * 3) % 9 === 0 ? 0.35 : 0);
    const lit = (x, y, rx, ry) => 0.2 - (x / rx) * 0.25 - (y / ry) * 0.5;
    const f = LIE_HAIR[st];
    P.layer = 1;
    const hy = st === 18 || st === 12 ? -9.6 : -7.6;
    if (c.mark === "halo") draw(() => { for (let a = 0; a < 40; a++) { const t = (a / 40) * Math.PI * 2; P.px(0.2 + Math.cos(t) * 3.6 - 0.5, hy + Math.sin(t) * 1.1 - 0.5, "#ffe88a", 0); } });
    if (f) {
      const [top, back, fall, wav, kind] = f;
      field(-9, -12, 16, 14, "hair", (x, y) => {
        const dx = x - 0.5, dy = y + 0.3, t = Math.atan2(dy, dx), d = Math.hypot(dx / 5.1, dy / 5.3) * 5.2;
        const up = Math.max(0, -Math.sin(t)), bk = Math.max(0, Math.cos(t)), dn = Math.max(0, Math.sin(t));
        let e = Math.max(top * up * (1 - 0.35 * Math.max(0, -Math.cos(t))), back * bk * (1 - dn) ** 0.5, fall * Math.min(1, dn * 1.6) * bk ** 0.7);
        if (dx < -1.5 && dy > -1) e = 0;
        e += wav * Math.sin(t * 9 + d * 0.4) * Math.min(1, e);
        if (d > 5.2 + e || e < 0.6) return false;
        const k = Math.max(0, (d - 5.2) / Math.max(1, e));
        let s = 0.05 - k * 0.35 + up * 0.15;
        if (kind === 0) s += 0.2 * Math.sin(t * 8) + tex(Math.floor(x), Math.floor(y)) * 0.5;
        if (kind === 1) s = curl(Math.floor(x), Math.floor(y), s);
        if (kind === 2) { const rope = Math.sin(t * 11); if (rope < -0.7 && k > 0.3) return false; s += rope * 0.3 - (rope < -0.3 ? 0.3 : 0); }
        if (kind === 3) s += 0.22 * Math.sin(t * 8 + d * 0.9);
        return s;
      });
    }
    if (st === 8) field(-8, -10, 10, 7, "hair", (x, y) => (Math.hypot((x - 0.8) / 6.6, (y + 1.2) / 6.3) + 0.06 * Math.sin(Math.atan2(y + 1.2, x - 0.8) * 9) > 1 ? false : curl(Math.floor(x), Math.floor(y), lit(x - 0.8, y + 1.2, 6.6, 6.3))));
    if (st === 5) field(-7, -9, 9, 5, "hair", (x, y) => (Math.hypot((x - 0.6) / 5.9, (y + 0.9) / 5.9) + 0.08 * Math.sin(Math.atan2(y + 0.9, x - 0.6) * 8) > 1 ? false : curl(Math.floor(x), Math.floor(y), lit(x, y, 6, 6))));
    const along = (x0, y0, x1, y1, n, bend) => Array.from({ length: n + 1 }, (_, i) => { const q = i / n; return [x0 + (x1 - x0) * q, y0 + (y1 - y0) * q + bend * Math.sin(q * Math.PI)]; });
    const bun = (bx, by, rx, ry, sh) => draw(() => P.ell(bx, by, rx, ry, "hair", { s: sh, fn: (x, y, v) => v + ((Math.round(Math.hypot(x + 0.5 - bx, (y + 0.5 - by) * 1.4) * 1.4) % 3 === 0) ? -0.35 : 0) }));
    const tie = (x, y) => draw(() => P.ell(x, y, 0.8, 0.8, "fav", { s: 0.25, k: 0.5 }));
    if (st === 2) { const t = along(4.6, -1.2, 9.5, 3.5, 6, -1.4); draw(() => P.tube(t, 1.7, 1.2, "hair", -0.1)); tie(4.8, -1.5); }
    if (st === 6 || st === 10) { const t = along(4.8, -0.5, 8.6, 4.5, 6, -1); draw(() => (st === 6 ? plait(P, t, 1.2, true) : P.tube(t, 1.5, 0.8, "hair", -0.2))); if (st === 10) tie(5, -0.5); }
    if (st === 10) { const t = along(-4.2, -2.4, -8, 0.6, 5, -0.8); draw(() => P.tube(t, 1.5, 0.8, "hair", 0.1)); tie(-4.2, -2.4); }
    if (st === 7) bun(5.4, -2.2, 2.4, 2.0, -0.1);
    if (st === 12) { bun(1.2, -6.4, 2.0, 1.6, 0.1); draw(() => P.rect(0.6, -5, 1.4, 1, "fav", 0.2)); }
    if (st === 20) bun(3.6, -4.4, 1.7, 1.4, 0);
    // the head itself: the back of the skull in hair, the face in skin, the fringe, an ear where the two meet
    P.layer = 4;
    const shaved = (x, y) => (st === 3 || st === 11) && (x + y * 0.3 > 1.5 || y > -1.5 || st === 3) && !(st === 3 && Math.abs(x + 0.7) < 1.3 && y < -1.8);
    field(-6, -7, 7, 6, "skin", (x, y) => {
      if (!skull(x, y) && !face(x, y)) return false;
      if (face(x, y)) { const nx = (x + 0.9) / 3.9, ny = (y - 1.2) / 4.4; return 0.2 - nx * 0.3 - ny * 0.4 - Math.max(0, nx - 0.6) * 1.2 - Math.max(0, ny - 0.85) * 0.6; }
      return bald ? lit(x - 0.5, y + 0.3, 5.1, 5.3) : false;
    });
    if (st === 3 || st === 11) field(-6, -7, 7, 6, "stub", (x, y) => (skull(x, y) && !face(x, y) && shaved(x, y) && (Math.floor(x) + Math.floor(y)) % 2 === 0 ? -0.2 : false));
    if (!bald || st === 3) field(-6.5, -7.5, 7.5, 6.5, "hair", (x, y) => {
      const sk = skull(x, y, st === 19 ? -0.2 : st === 14 ? 0.3 : 0.2), fc = face(x, y);
      if (st === 3) return Math.abs(x + 0.7) < 1.3 && skull(x, y, 0.6) && y < -1.8 ? lit(x + 0.7, y, 2, 6) + tex(Math.floor(x), Math.floor(y)) : false;
      if (!sk || shaved(x, y)) return false;
      if (fc && y > hairline(x)) return false;
      if (st === 15 && fc && x > 0.4 && y > 3.2) return false;
      return lit(x - 0.5, y + 0.3, 5.3, 5.5) + tex(Math.floor(x), Math.floor(y)) + (st === 19 && (Math.floor(x) * 3 + Math.floor(y)) % 5 === 0 ? -0.3 : 0);
    });
    if (st === 15) field(1, -2, 6, 5, "hair", (x, y) => (skull(x, y, 0.4) && !face(x, y) && y < 4.4 ? -0.25 + tex(Math.floor(x), Math.floor(y)) : false));
    if (st === 14) draw(() => {
      // curved locks of uneven length swept toward the pillow, a few jutting over the brow and off the back, so the points never read as a crown
      const tuft = (a, r, l, w, b, sh) => {
        const ex = 0.5 + Math.cos(a) * r, ey = -0.3 + Math.sin(a) * r * 1.04, ma = a + b * 0.35, ta = a + b, mx = ex + Math.cos(ma) * l * 0.55, my = ey + Math.sin(ma) * l * 0.55;
        P.poly([[ex - Math.sin(a) * w, ey + Math.cos(a) * w], [mx - Math.sin(ma) * w * 0.6, my + Math.cos(ma) * w * 0.6], [mx + Math.cos(ta) * l * 0.45, my + Math.sin(ta) * l * 0.45],
          [mx + Math.sin(ma) * w * 0.6, my - Math.cos(ma) * w * 0.6], [ex + Math.sin(a) * w, ey - Math.cos(a) * w]], "hair", (x, y) => sh + tex(x, y));
        if (l > 3.5) P.line(ex, ey, mx, my, "hair", -0.45);
      };
      for (const [a, l, w, b, sh] of [[-2.5, 2.6, 1.3, 0.6, 0.1], [-1.95, 4.6, 1.6, 0.75, 0.15], [-1.35, 2.2, 1.0, 0.5, -0.15], [-0.85, 3.7, 1.4, 0.7, -0.05], [-0.2, 2.8, 1.2, 0.6, -0.25], [0.5, 2.3, 1.1, 0.5, -0.35]]) tuft(a, 5.0, l, w, b, sh);
      for (const [a, l, b] of [[-2.85, 2.6, -0.9], [-3.15, 2.0, -1.0]]) tuft(a, 4.8, l, 1.0, b, 0.2);
    });
    if (st === 3) draw(() => { for (const a of [-2.0, -1.75, -1.5]) { const ex = 0.5 + Math.cos(a) * 5.4, ey = -0.3 + Math.sin(a) * 5.6; P.poly([[ex - Math.sin(a) * 1.1, ey + Math.cos(a) * 1.1], [ex + Math.cos(a) * 2.4, ey + Math.sin(a) * 2.4], [ex + Math.sin(a) * 1.1, ey - Math.cos(a) * 1.1]], "hair", 0.2); } });
    if (st === 18) for (const [bx, by, sh] of [[-3.5, -5.2, 0.15], [5.0, -4.4, -0.15]]) { draw(() => P.ell(bx, by, 2.8, 2.5, "hair", { s: -0.75, k: 0.4 })); bun(bx, by, 2.2, 1.9, sh); }
    if (st === 21) draw(() => { const pts = []; for (let a = -2.9; a <= 0.1; a += 0.32) pts.push([0.5 + Math.cos(a) * 4.4, -0.3 + Math.sin(a) * 4.6]); plait(P, pts, 1.1, false); });
    P.layer = 5;
    if (c.pointy) draw(() => P.poly([[2.4, 0.2], [6.6, -2.6], [3.6, 2.6]], "skin", -0.15));
    else if (BARE_EARS.has(st)) draw(() => P.ell(3.3, 1.1, 0.9, 1.4, "skin", { s: -0.2, k: 0.5 }));
    if (look.face === 2) field(-5, 1.5, 3, 7, "hair", (x, y) => {
      if (!face(x, y) && ((x + 0.9) / 3.4) ** 2 + ((y - 2.8) / 3.4) ** 2 > 1) return false;
      if (y < 2.6 || (y < 3.6 && Math.abs(x + 1.2) < 1.6)) return false;
      return 0.05 - (y - 3) * 0.12 + tex(Math.floor(x), Math.floor(y));
    });
    // a braid laid forward over the near shoulder, and the face's 1px features, go on last, over the covers
    after.push(() => {
      P.layer = 8;
      if (st === 6 || st === 17) { const t = along(-4.2, 2.2, -6.5, 10.5, 7, st === 17 ? -1.2 : -0.8); draw(() => plait(P, t, st === 17 ? 1.4 : 1.15, true)); }
      P.layer = 7;
      const at = (x, y) => { P.tf = tf; const p = P.T(x, y); P.tf = null; return [Math.round(p[0] - 0.5), Math.round(p[1] - 0.5)]; };
      const dot = (x, y, m, s) => { const [a, b] = at(x, y); P.px(a, b, m, s); };
      const dim = !c.pale && toHsv(look.skinHex || look.skin)[2] < 0.6;
      const shut = c.pale ? "#8a98b0" : mix(look.skinHex || look.skin, "#140c0c", dim ? 0.8 : 0.66), ec = c.pale ? "#b8c8e8" : mix(c.eye, "#100c10", 0.45);
      [[-2.7, 0.7], [0.7, 0.7]].forEach(([ex, ey], i) => {
        const [x, y] = at(ex, ey);
        if ((scars.includes("eyepatch") || c.mark === "eyepatch") && i === 1) { for (const [a, b] of [[-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [0, -1], [-1, -1]]) P.px(x + a, y + b, "#16121a"); P.px(x, y, "#3a3036"); return; }
        if (awake) { P.px(x - 1, y, c.gaze > 0 ? "#ece6da" : ec); P.px(x, y, c.gaze > 0 ? ec : "#ece6da"); }
        else { P.px(x - 1, y, shut); P.px(x, y, shut); if (dim) { P.px(x - 1, y - 1, "skin", 0.6); P.px(x, y - 1, "skin", 0.6); } }
      });
      if (scars.includes("eyepatch") || c.mark === "eyepatch") draw(() => P.line(-4.6, -1.8, 4.4, -1.0, "#16121a"));
      dot(-1.0, 2.6, "skin", -0.7);
      if (look.face !== 2) { dot(-1.6, 3.9, "lip", -0.6); dot(-0.6, 3.9, "lip", -0.6); }
      else dot(-1.1, 3.9, "lip", -0.75);
      if (look.face === 3) for (const [x, y] of [[-2.6, 3.4], [-1.6, 3.4], [-0.6, 3.4], [0.4, 3.4]]) dot(x, y, "hair", x < -1 ? 0.1 : -0.25);
      if (look.face === 1) for (const [x, y] of [[-3.6, 3.6], [-2.6, 4.8], [-1.6, 5.4], [-0.4, 5.4], [0.6, 4.8], [1.6, 3.8]]) dot(x, y, "stub", 0);
      if (c.tusks) { dot(-2.6, 4.0, "#efe8d4"); dot(0.4, 4.0, "#efe8d4"); }
      if (c.freckles) for (const [x, y] of [[-3.2, 2.2], [-2.2, 2.6], [0.4, 2.2], [1.2, 2.0]]) dot(x, y, "skin", -0.6);
      if (scars.includes("scar")) for (let i = 0; i < 4; i++) dot(-3.4 + i * 0.5, -1 + i * 1.1, "#a85048");
      if (scars.includes("burn")) for (const [x, y] of [[1.0, 2.2], [1.8, 2.4], [1.4, 3.2], [2.2, 3.0]]) dot(x, y, (Math.round(x * 2) + Math.round(y)) % 2 ? "#b8685a" : "#9a4a44");
      if (c.mark === "antlers" || CROWNS.has(c.mark)) {
        P.layer = 8;
        const rim = (a, r) => [0.5 + Math.cos(a) * r * 5.1 / 5.2, -0.3 + Math.sin(a) * r];
        if (c.mark === "antlers") draw(() => { for (const a of [-2.3, -1.2]) { const [x0, y0] = rim(a, 5), [x1, y1] = rim(a, 10), [x2, y2] = rim(a + (a < -2 ? -0.35 : 0.35), 8.4); P.line(x0, y0, x1, y1, "antler", 0.1); P.line((x0 + x1) / 2, (y0 + y1) / 2, x2, y2, "antler", -0.1); } });
        else draw(() => { for (let i = 0; i < 7; i++) { const a = -2.7 + i * 0.4, [x, y] = rim(a, 5.4), [x1, y1] = rim(a, i % 2 ? 6.8 : 7.8);
          if (c.mark === "leaf_crown") P.ell(x, y, 1.2, 0.9, "leaf", { s: i % 2 ? 0.3 : -0.1, k: 0.6 });
          else P.poly([[x - Math.sin(a) * 0.9, y + Math.cos(a) * 0.9], [x1, y1], [x + Math.sin(a) * 0.9, y - Math.cos(a) * 0.9]], c.mark === "ice_crown" ? "ice" : c.mark === "elemental_crown" ? ELEM[i % 3] : c.mark === "storm_crown" ? "#a8dcff" : "flame", i % 2 ? 0.1 : 0.45); } });
      }
    });
  }
  function sleeper(o, q) {
    const h = { id: o.id, name: o.name, look: o.look, weapon: o.weapon, weapon_tier: o.weaponTier, armor_tier: o.armorTier, legend: o.legend, kit: o.kit && Object.assign({}, o.kit) };
    const cl = Object.assign({}, o.clsLook || {});
    if (h.kit) h.kit.head = null;
    if (cl.head && !MARKS.has(cl.head)) cl.head = "none";
    const c = setup(h, cl), P = new Paint(44, 36), M = Object.assign({}, c.mats), [q0, q1] = q.quilt, len = q.len || 1.6, AX = 18, AY = 24;
    M.bl = ramp(q0); M.bl2 = ramp(q1 || q0); M.sheet = ramp(q.roll && q.pillow ? mix(q.pillow, "#e8dcc0", 0.2) : q.pillow || "#ece2cc");
    PATCHES.forEach((p, i) => { M["bp" + i] = ramp(p); });
    c.hglow = null;
    const coat = c.outfit === "chain" || c.outfit === "plate" ? "cloth" : BASE[c.outfit] || "cloth";
    const iso = (u, v, z) => [AX + (u - v) * 8, AY + (u + v) * 4 - z];
    const bump = (u, at, w) => Math.max(0, 1 - ((u - at) / w) ** 2), u0 = -0.24, FOLD = q.roll ? 0.3 : 0.24;
    const breath = (u) => (o.frame ? 1.5 * bump(u, 0.22, 0.34) : 0);
    const top = q.roll ? (u) => (u < FOLD ? 2.4 + 0.9 * bump(u, 0.1, 0.3) + breath(u) : 1.6 + 0.5 * bump(u, 0.75, 0.25) + 1.0 * bump(u, len - 0.15, 0.17) + (u < FOLD + 0.08 ? 0.5 : 0))
      : (u) => 3.0 + 1.4 * bump(u, 0.3, 0.55) + 1.1 * bump(u, len - 0.18, 0.2) + breath(u) + (u >= FOLD && u < FOLD + 0.08 ? 0.5 : 0);
    const half = (u) => (u < FOLD ? 0.3 + 0.08 * Math.min(1, (u - u0) / 0.12) : q.roll ? 0.37 - 0.08 * Math.min(1, (u - FOLD) / 0.8) : 0.4 - 0.12 * Math.min(1, Math.max(0, (u - 0.5) / 0.8)));
    const mat = (u, v) => {
      if (u < FOLD) return coat;
      if (u < FOLD + 0.08) return q.roll ? "bl2" : "sheet";
      if (q.roll) return Math.abs(u - len + 0.3) < 0.04 ? "bl2" : "bl";
      if (q.patch) {
        const a = u * 2.6 + 0.5, b = v * 2.6 + 0.5;
        if (Math.abs(a - Math.round(a)) < 0.08 || Math.abs(b - Math.round(b)) < 0.08) return "bp5";
        return "bp" + ((Math.floor(a) * 5 + Math.floor(b) * 3 + 70) % 7);
      }
      const da = u * 3 - Math.floor(u * 3) - 0.5, db = v * 3 - Math.floor(v * 3) - 0.5;
      return Math.abs(Math.abs(da) + Math.abs(db) - 0.45) < 0.08 ? "bl2" : "bl";
    };
    const height = (u, v) => {
      const w = half(u), t = v / w;
      if (Math.abs(t) > 1 || u < u0 || u > len) return null;
      return top(u) * Math.sqrt(1 - t * t) * Math.min(1, (len - u) / 0.12 + 0.35) * Math.min(1, (u - u0) / 0.1 + 0.55);
    };
    const mound = (pts, shade, side) => {
      pts.sort((p, r) => p[0] + p[1] - r[0] - r[1]);
      for (const [u, v, t, hh, m] of pts) {
        const [sx, base] = iso(u, v, 0), sy = base - hh;
        for (let y = Math.floor(sy) + 1; y <= Math.floor(base); y++) P.px(sx, y, m, side ? side(y - sy, t) : t > 0 ? -0.15 : -0.45);
        P.px(sx, sy, m, shade(u, t));
      }
    };
    // the rolled end of a bedroll under the head; in a bed the bed's own pillow is there already
    if (q.roll) {
      P.layer = 0;
      const pts = [];
      // big enough to show past the cheek, softly shaded down its sides so it reads as cloth, not a stone
      for (let u = -0.92; u <= -0.24; u += 0.04) for (let v = -0.3; v <= 0.86; v += 0.04) { const t = (u + 0.58) / 0.34; pts.push([u, v, -(v - 0.28) / 0.58, 3.0 * Math.sqrt(Math.max(0, 1 - t * t)) + 0.5, "sheet"]); }
      mound(pts, (u, t) => 0.3 - (u + 0.58) * 0.9 + t * 0.15, (d, t) => (t > 0 ? 0.05 : -0.1) - d * 0.12);
    }
    const after = [];
    lyingHead(P, c, q.roll ? 11 : 12, 17, q.awake, after);
    P.layer = 2;
    const body = [];
    for (let u = u0; u <= len; u += 0.04) for (let v = -0.42; v <= 0.42; v += 0.04) {
      const hh = height(u, v);
      if (hh != null) body.push([u, v, v / half(u), hh, mat(u, v)]);
    }
    mound(body, (u, t) => 0.2 + 0.35 * t - (u > len - 0.25 ? 0.2 : 0) + (u >= FOLD && u < FOLD + 0.08 ? 0.3 : 0) + (u < u0 + 0.06 ? 0.2 : 0));
    // the near arm, out over the covers: the sleeve from under the chin along the flank, the hand resting on the quilt
    P.layer = 9;
    const arm = (u) => { const v = 0.33 - u * 0.04; return iso(u, v, (height(u, v) || 1.5) + 1.1); };
    const [sx0, sy0] = arm(0.04), [sx1, sy1] = arm(0.7), [hx, hy] = arm(0.84);
    P.line(sx0, sy0, sx1, sy1, coat, (t) => -0.05 - t * 0.1, 1.15);
    P.ell(hx, hy + 0.3, 1.5, 1.1, "skin", { s: 0.05, k: 0.6 });
    for (const fn of after) fn();
    const g = P.render(M, { outline: "#16121a", flat: FLAT }), soft = mix(q0, "#16121a", 0.6);
    // where the quilt meets the bed's own quilt, a soft crease instead of the hard ink line
    for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
      if (P.mat[y * P.w + x] !== null) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => (P.has(x + a, y + b) ? P.lay[(y + b) * P.w + x + a] : 0)).filter((l) => l);
      if (near.length && near.every((l) => l === 2) && y > AY - 6) g.px[y * P.w + x] = soft;
    }
    return g;
  }
  // a helm taken off for the night, to stand by the bed; null for anything else (hats just come off, hoods stay up)
  function setAside(o) {
    const h = { id: o.id, name: o.name, look: o.look, weapon: o.weapon, weapon_tier: o.weaponTier, armor_tier: o.armorTier, legend: o.legend, kit: o.kit };
    const c = setup(h, o.clsLook || {});
    if (!["helm", "great_helm", "skull_helm", "horns"].includes(c.head)) return null;
    const P = new Paint(26, 22);
    c.empty = true; c.glint = null; c.hglow = null;
    P.tf = { ox: 13, oy: 13, cx: 20, cy: 15.5, s: 0.66 }; P.layer = 7;
    headgear(P, c.head, c.cx, c.faceW, c.look, () => false, c);
    P.tf = null;
    return P.render(c.mats, { flat: FLAT });
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
    if (st >= 8) return hairNew(P, st, cx, fw, part, tex, covered);
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

  const HAIR_LIFT = { 5: 3.5, 7: 3.5, 8: 5.5, 12: 5, 14: 5, 18: 4 };
  function hairBackNew(P, st, cx, tex) {
    const sheet = (top, w0, w1, bot, sfn) => P.poly([[cx - w0, top], [cx + w0, top], [cx + w1, bot], [cx - w1, bot]], "hair", sfn);
    const dark = (x, y) => -0.35 + tex(x, y) - (y - 10) * 0.02;
    if (st === 9) for (let i = -4; i <= 4; i++) P.rect(cx + i * 2.1 - 0.8, 10, 1.6, 30 - Math.abs(i) * 0.8, "hair", (x, y) => (i % 2 ? -0.6 : -0.25) + ((y + i) % 3 === 0 ? -0.3 : 0));
    if (st === 13) sheet(13, 8, 9.5, 28, (x, y) => dark(x, y) - (y > 26 ? 0.2 : 0));
    if (st === 15) sheet(12, 9, 9.3, 23.6, (x, y) => dark(x, y) - (y > 22.5 ? 0.25 : 0));
    if (st === 16) {
      const pts = [[cx - 9, 10], [cx + 9, 10]];
      for (let y = 12; y <= 37; y += 1.5) pts.push([cx + 10 + (y - 12) * 0.1 + Math.sin(y * 0.7) * 1.3, y]);
      for (let y = 37; y >= 12; y -= 1.5) pts.push([cx - 10 - (y - 12) * 0.1 - Math.sin(y * 0.7 + 1) * 1.3, y]);
      P.poly(pts, "hair", (x, y) => dark(x, y) + Math.sin((y + x * 0.5) * 0.7) * 0.2);
    }
    if (st === 20) sheet(10, 8, 10.5, 33, dark);
  }

  function plait(P, pts, rad, tie) {
    pts.forEach(([x, y], i) => {
      const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(pts.length - 1, i + 1)], d = Math.hypot(bx - ax, by - ay) || 1, o = i % 2 ? 0.45 : -0.45;
      P.ell(x - ((by - ay) / d) * o, y + ((bx - ax) / d) * o, rad, rad * 0.8, "hair", { s: i % 2 ? -0.4 : 0.15, k: 0.5 });
    });
    if (tie) { const [x, y] = pts[pts.length - 1]; P.rect(x - 1, y + 0.8, 2, 1, "fav", 0.2); P.ell(x, y + 2.8, rad * 0.75, 1.5, "hair", { s: -0.15, k: 0.6 }); }
  }

  function hairNew(P, st, cx, fw, part, tex, covered) {
    const lineAt = (pt, side, top) => (x) => {
      const dx = x + 0.5 - cx;
      if (Math.abs(dx) > fw - 1.6) return side;
      return top + (pt == null ? 0 : (Math.abs(dx - pt) < 1.2 ? -1 : 0) + (dx > pt ? 0.6 : 0)) + Math.abs(dx) * 0.12;
    };
    const cap = (puff, line, fn) => P.ell(cx, 13, fw + puff, 7.4 + puff * 0.6, "hair", { fn: (x, y, s) => (y + 0.5 > line(x) || y > 19 ? false : fn ? fn(x, y, s) : s + tex(x, y)) });
    const comb = (x, y, s) => s + ((x - cx + 40) % 3 === 0 && y < 12 ? -0.3 : 0);
    const curl = (x, y, s) => s + ((x * 3 + y * 5) % 7 === 0 ? -0.45 : (x * 5 + y * 3) % 9 === 0 ? 0.35 : 0);
    switch (st) {
      case 8:
        if (covered) {
          cap(1, lineAt(part, 18.5, 11.6));
          for (const side of [-1, 1]) P.ell(cx + side * (fw + 1.8), 16, 2.6, 3.4, "hair", { s: side < 0 ? 0 : -0.35, fn: curl });
          break;
        }
        P.ell(cx, 11.2, fw + 4.2, 9.2, "hair", { fn: (x, y, s) => ((y + 0.5 > 11.2 + Math.abs(x + 0.5 - cx) * 0.15 && Math.abs(x + 0.5 - cx) < fw - 1.2) || y > 18.5 ? false : curl(x, y, s)) });
        for (let a = 0; a < 20; a++) {
          const t = Math.PI * 0.92 + (a / 19) * Math.PI * 1.16;
          P.ell(cx + Math.cos(t) * (fw + 4), 11.6 + Math.sin(t) * 9, 1.6, 1.6, "hair", { s: -0.1 + (a % 3 === 0 ? 0.3 : 0) - Math.cos(t) * 0.25, k: 0.6 });
        }
        break;
      case 9: {
        cap(0.9, lineAt(part, 18.5, 11.6), curl);
        for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
          const x0 = cx + side * (fw - 0.8 + k * 2.2) - (side > 0 ? 1 : 0), end = 26 + k * 2;
          for (let y = 12; y < end; y++) for (let j = 0; j < 2; j++) P.px(x0 + j + side * (y - 12) * 0.03, y, "hair", ((y + k) % 3 === 0 ? -0.55 : 0.1) - (side > 0 ? 0.3 : 0) - k * 0.12 - (j === (side > 0 ? 1 : 0) ? 0.3 : 0));
          if (k === 1) P.rect(x0, end - 3, 2, 1, "gold", 0.3);
        }
        break;
      }
      case 10:
        cap(0.8, lineAt(0, 18.5, 11.6));
        for (const side of [-1, 1]) {
          const pts = [];
          for (let i = 0; i <= 9; i++) { const q = i / 9; pts.push([cx + side * (fw + 2 + q * 1.6 + Math.sin(q * 3) * 0.7), 14 + q * 12]); }
          P.tube(pts, 2.3, 1, "hair", side < 0 ? 0.05 : -0.35);
          P.ell(cx + side * (fw + 1.5), 13.4, 1.4, 1.4, "fav", { s: 0.2, k: 0.6 });
        }
        break;
      case 11:
        for (let y = 10; y < 17; y++) for (let x = cx - fw - 1; x <= cx + fw + 1; x++) if ((x + y) % 2 === 0 && Math.abs(x + 0.5 - cx) > fw - 2.6 && P.matAt(x, y) === "skin") P.px(x, y, "hair", -0.55);
        P.ell(cx + 0.5, 9.6, fw - 0.2, 4.4, "hair", { s: 0.1, fn: (x, y, s) => (y > 11 ? false : s + tex(x, y)) });
        P.poly([[cx - fw + 1.2, 9], [cx + 1, 5.6], [cx + fw + 0.8, 8.6], [cx + fw + 0.6, 14.6], [cx + fw - 1.6, 13], [cx + 1.5, 11.8], [cx - fw + 1.2, 11.6]], "hair",
          (x, y) => 0.15 - (x - cx) * 0.06 + (Math.floor(x - y * 0.8 + 40) % 3 === 0 ? -0.4 : 0));
        break;
      case 12:
        cap(0.2, lineAt(null, 17.5, 10.8), comb);
        if (!covered) {
          P.rect(cx - 1, 4.6, 2, 2.4, "hair", (x) => (x < cx ? 0 : -0.4));
          P.ell(cx, 3.2, 2.4, 2.1, "hair", { s: 0.15, fn: curl });
          P.rect(cx - 1.5, 5.4, 3, 1, "fav", (x) => 0.3 - (x - cx) * 0.2);
        }
        break;
      case 13:
        cap(0.6, lineAt(part, 15, 11.6));
        for (const side of [-1, 1]) P.poly([[cx + side * (fw - 0.4), 20], [cx + side * (fw + 1.6), 19.2], [cx + side * (fw + 3), 27.6], [cx + side * (fw + 1.4), 26.4], [cx + side * (fw + 0.2), 27.8], [cx + side * (fw - 0.6), 23]], "hair",
          (x, y) => (side < 0 ? -0.1 : -0.45) + tex(x, y) - (y > 25 ? 0.2 : 0));
        break;
      case 14:
        cap(0.4, lineAt(null, 17.5, 11.4));
        for (const x of [-3.5, -0.5, 2.5]) P.poly([[cx + x - 1.4, 11], [cx + x + 1.4, 11], [cx + x + 0.6, 14]], "hair", 0.05 - x * 0.06);
        if (!covered) for (let i = 0; i < 9; i++) {
          const t = Math.PI * 1.08 + (i / 8) * Math.PI * 0.84, ux = Math.cos(t), uy = Math.sin(t);
          const bx = cx + ux * (fw - 0.2), by = 13 + uy * 7, len = 3.6 + (i % 2) * 1.6;
          P.poly([[bx - uy * 1.7, by + ux * 1.7], [bx + ux * len, by + uy * len * 1.1], [bx + uy * 1.7, by - ux * 1.7]], "hair", (i % 2 ? 0.35 : 0.05) - ux * 0.3);
        }
        break;
      case 15: {
        cap(0.9, (x) => (Math.abs(x + 0.5 - cx) > fw - 1.6 ? 19 : 12.6));
        for (const side of [-1, 1]) P.poly([[cx + side * (fw - 1.8), 11], [cx + side * (fw + 1.8), 11], [cx + side * (fw + 2.3), 22.6], [cx + side * (fw + 1.4), 23.6], [cx + side * (fw - 1.2), 23.6], [cx + side * (fw - 1.6), 20]], "hair",
          (x, y) => (side < 0 ? 0 : -0.4) + tex(x, y) - (y > 22.5 ? 0.3 : 0));
        P.rect(cx - fw + 1.4, 12, (fw - 1.4) * 2, 1, "hair", (x) => -0.3 - (x - cx) * 0.03);
        break;
      }
      case 16:
        cap(1.2, lineAt(part, 18.5, 11.6));
        for (const side of [-1, 1]) {
          const pts = [[cx + side * (fw - 1.6), 12], [cx + side * (fw + 1.8), 12]];
          for (let y = 14; y <= 37; y += 1.5) pts.push([cx + side * (fw + 2.4 + (y - 12) * 0.12 + Math.sin(y * 0.7 + (side > 0 ? 1 : 0)) * 1.3), y]);
          pts.push([cx + side * (fw + 1.2), 36], [cx + side * (fw - 0.2), 37]);
          for (let y = 34; y >= 16; y -= 2) pts.push([cx + side * (fw - 1.2 + Math.sin(y * 0.7 + (side > 0 ? 1 : 0)) * 0.6), y]);
          P.poly(pts, "hair", (x, y) => (side < 0 ? -0.05 : -0.4) + tex(x, y) + Math.sin((y - side * x * 0.4) * 0.7) * 0.3 - (y > 33 ? 0.2 : 0));
        }
        break;
      case 17: {
        cap(0.9, lineAt(-2, 18.5, 11.6));
        const pts = [];
        for (let i = 0; i <= 11; i++) { const q = i / 11; pts.push([cx + fw + 1.4 - q * 3 + Math.sin(q * 3) * 1.2, 14.5 + q * 19]); }
        plait(P, pts, 2.1, true);
        break;
      }
      case 18:
        cap(0.7, lineAt(0, 18.5, 11.6));
        if (!covered) for (const side of [-1, 1]) {
          const bx = cx + side * 4.4;
          P.ell(bx, 5, 3.1, 2.9, "hair", { s: side < 0 ? 0.15 : -0.1, fn: (x, y, s) => s + ((Math.round(Math.hypot(x + 0.5 - bx, y + 0.5 - 5) * 1.4 + Math.atan2(y + 0.5 - 5, x + 0.5 - bx) * side) % 3 === 0) ? -0.35 : 0) });
        }
        break;
      case 19: {
        cap(0.2, (x) => (Math.abs(x + 0.5 - cx) > fw - 1.6 ? 15 : 11 + Math.abs(x + 0.5 - cx) * 0.1));
        for (let k = 0; k < 5; k++) { const x = cx - 4.5 + k * 2.2; P.poly([[x - 1.2, 10.6], [x + 1.4, 10.6], [x - 0.6 + (k % 2) * 0.4, 13.6 + (k % 2)]], "hair", (k % 2 ? -0.2 : 0.2) - (x - cx) * 0.04); }
        for (const side of [-1, 1]) P.poly([[cx + side * (fw - 1.8), 12.5], [cx + side * (fw + 0.6), 12.5], [cx + side * (fw - 1.4), 17.6]], "hair", side < 0 ? 0 : -0.4);
        for (let a = 0; a < 7; a++) { const t = Math.PI * 1.15 + (a / 6) * Math.PI * 0.7; P.ell(cx + Math.cos(t) * (fw + 0.2), 13 + Math.sin(t) * 7.4, 1.2, 1.2, "hair", { s: (a % 2 ? 0.35 : 0) - Math.cos(t) * 0.25, k: 0.6 }); }
        break;
      }
      case 20:
        cap(0.5, lineAt(null, 18.5, 10.9), comb);
        for (const side of [-1, 1]) P.poly([[cx + side * (fw + 0.4), 18], [cx + side * (fw + 2.2), 16.8], [cx + side * (fw + 3.4), 31], [cx + side * (fw + 1.8), 31.5], [cx + side * (fw + 0.6), 21]], "hair",
          (x, y) => (side < 0 ? -0.05 : -0.4) + tex(x, y) - (y > 28 ? 0.2 : 0));
        if (!covered) {
          P.ell(cx, 6.2, 2.1, 1.7, "hair", { s: 0.1, k: 0.6 });
          for (const side of [-1, 1]) P.poly([[cx + side * 1.2, 6.2], [cx + side * 5, 3.6], [cx + side * 5, 8.8]], "fav", side < 0 ? 0.3 : -0.1);
          P.rect(cx - 1, 5.6, 2, 2, "fav", 0.4);
        }
        break;
      case 21: {
        cap(0.3, lineAt(null, 18.5, 11.8), (x, y) => comb(x, y, -0.3 - (x - cx) * 0.04));
        const rx = fw + 0.5, ry = 5.2, by = 15;
        for (let y = 6; y < 16; y++) for (let x = cx - fw - 3; x <= cx + fw + 3; x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - by, v = (Math.hypot(dx / rx, dy / ry) - 1) * rx;
          if (Math.abs(v) <= 1.5 && dy <= 0.5) P.px(x, y, "hair", -0.75);
        }
        for (let i = 0; i < 11; i++) {
          const t = Math.PI * 1.04 + (i / 10) * Math.PI * 0.92, c = Math.cos(t), sn = Math.sin(t);
          const tl = Math.hypot(sn * rx, c * ry), Tx = (-sn * rx) / tl, Ty = (c * ry) / tl, Nx = Ty, Ny = -Tx;
          const px0 = cx + c * rx, py0 = by + sn * ry, o = i % 2 ? 0.7 : -0.7;
          P.ell(px0 + Nx * o * 0.6, py0 + Ny * o * 0.6, 1.3, 1, "hair", { s: 0.55 - c * 0.2 - (i % 2 ? 0.3 : 0), k: 0.3 });
        }
        break;
      }
    }
  }

  // lozenges hw wide and hh tall each way from their centres, alternating with the ground colour
  const harlequin = (x, y, hw, hh) => (Math.floor((x + 0.5) / hw / 2 + (y + 0.5) / hh / 2) + Math.floor((x + 0.5) / hw / 2 - (y + 0.5) / hh / 2)) % 2 === 0;
  function torso(P, outfit, cx, r, c) {
    const base = BASE[outfit] || "hide", at = c ? c.k.at : 2;
    P.ell(cx, 43, 17.5, 14.6, base, { s: 0.05, fn: (x, y, s, nx) => s + (outfit === "chain" && (x + y * 2) % 3 === 0 ? -0.45 : 0) });
    const neckline = (x, y) => Math.abs(x + 0.5 - cx) < 4.2 - (y - 28) * 0.9;
    switch (outfit) {
      case "robe": case "robe_dark":
        P.poly([[cx - 4, 28], [cx + 4, 28], [cx, 34]], "skin", -0.6);
        P.line(cx - 4.5, 28, cx, 34.5, at === 1 ? "dleather" : "gold", 0.2); P.line(cx + 4.5, 28, cx, 34.5, at === 1 ? "dleather" : "gold", -0.2);
        P.rect(cx - 0.5, 34, 1, 6, base, -0.6);
        break;
      case "vestments":
        P.rect(cx - 6, 29, 2, 11, "fav", 0.1); P.rect(cx + 4, 29, 2, 11, "fav", -0.2);
        if (at > 1) { P.px(cx - 5, 34, "gold", 0.3); P.px(cx + 5, 34, "gold", 0.3); }
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
            if (Math.abs(dx) <= 5) P.px(px0 + dx, 37 + t * 1.6, at >= 4 ? (dx % 2 ? "gold" : "fav") : at === 3 ? "metal" : "fav", at === 3 ? 0.8 : 0.1);
          }
          if (at >= 4) for (let dx = -5; dx <= 5; dx++) P.px(px0 + dx, 28.2 + (dx / 6.6) ** 2 * 3.4, "gold", 0.3 - side * 0.2);
          if (at > 1) { P.px(px0 - 3, 30, "#f4f6fa"); P.px(px0 - 2, 30, "metal", 0.9); P.px(px0 - 3, 31, "metal", 0.9); }
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
        for (let x = cx - 6; x <= cx + 6; x++) P.ell(x, 29 + (x % 2) * 0.6, 1.3, 1.3, "shirt", { s: 0.2 - (x - cx) * 0.06, k: 0.6 });
        for (let y = 32; y < 40; y += 2) P.px(cx, y, "gold", 0.3);
        break;
      case "motley":
        for (let y = 28; y < 44; y++) for (let x = cx - 18; x <= cx + 18; x++) if (P.matAt(x, y) === base && harlequin(x - cx + 40, y - 28, 3.5, 5)) P.px(x, y, "shirt", 0.12 - (x - cx) * 0.03);
        for (let i = 0; i < 7; i++) { const x = cx - 7.5 + i * 2.5; P.poly([[x - 1.4, 28.4], [x + 1.4, 28.4], [x, 31.2]], i % 2 ? "shirt" : "gold", 0.35 - i * 0.06); }
        break;
      case "vest":
        P.poly([[cx - 16, 32], [cx - 5, 28], [cx - 2, 40], [cx - 16, 40]], "fav", 0.1);
        P.poly([[cx + 16, 32], [cx + 5, 28], [cx + 2, 40], [cx + 16, 40]], "fav", -0.25);
        P.px(cx - 3, 34, "gold", 0.4); P.px(cx - 3, 37, "gold", 0.4);
        break;
    }
    if (outfit !== "robe" && outfit !== "robe_dark") P.shadeWhere((x, y, m, l) => l === 2 && y >= 27 && y <= 29 && neckline(x, y) && m === base, -0.4);
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

  const cache = new Map();
  function portraitGrid(h, cls, opts) {
    const look = (cls || {}).look || { outfit: "leather", head: "none" };
    const key = JSON.stringify([h.id, h.look, look, h.weapon, h.weapon_tier, h.armor_tier, h.legend, h.kit || null, opts && opts.frame, opts && opts.bg]);
    if (!cache.has(key)) cache.set(key, portrait(h, Object.assign({ cn: (cls || {}).name || "" }, look), opts));
    return cache.get(key);
  }

  // shared with Art.gearIcon: the same pieces, drawn alone
  const Gear = { soften, makeMats, headgear, offhand, OFF_C, axis, weapon, backSprite, neckSprite, track, glowUp, TMETAL, METAL, CROWN_Y, DELVE_COL, GRADE_GLOW };
  window.Paint = { Paint, ramp, hsv, toHsv, portraitGrid, fullBody, sleeper, setAside, MARKS, PW, PH, Gear };
})();
