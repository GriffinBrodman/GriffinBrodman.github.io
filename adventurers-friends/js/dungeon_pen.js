/* Shared by the dungeon maps: a fast pixel surface, the 3x5 and Pixelify pixel letters, each hero's pixel hand, crew inks, and the floor plan carved into cells from the exported room layout. */
(function () {
  "use strict";

  // ---------- colour and noise ----------
  const rgbCache = new Map();
  function rgb(c) {
    let v = rgbCache.get(c);
    if (v) return v;
    if (c[0] === "#" && c.length === 7) { const n = parseInt(c.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]; }
    else if (c[0] === "#" && c.length === 4) v = [parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16), parseInt(c[3] + c[3], 16), 255];
    else { const m = c.match(/[\d.]+/g) || [0, 0, 0]; v = [+m[0], +m[1], +m[2], m[3] != null ? Math.round(+m[3] * 255) : 255]; }
    rgbCache.set(c, v);
    return v;
  }
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  function mix(a, b, t) { const x = rgb(a), y = rgb(b); return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
  function lum(c) { const [r, g, b] = rgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
  function h2(x, y, s) { let n = (x * 374761393 + y * 668265263 + (s || 0) * 2246822519) >>> 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function hashStr(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  function ramp(c) { return [mix(c, "#000000", 0.55), mix(c, "#000000", 0.28), c, mix(c, "#ffffff", 0.25), mix(c, "#ffffff", 0.5)]; }

  // ---------- a pixel surface over an ImageData ----------
  function surface(W, H) {
    const data = new Uint8ClampedArray(W * H * 4);
    const px = (x, y, c, a) => {
      x |= 0; y |= 0;
      if (!c || x < 0 || y < 0 || x >= W || y >= H) return;
      const v = rgb(c), i = (y * W + x) * 4, al = (a == null ? 1 : a) * v[3] / 255;
      if (al >= 1) { data[i] = v[0]; data[i + 1] = v[1]; data[i + 2] = v[2]; data[i + 3] = 255; return; }
      data[i] = data[i] + (v[0] - data[i]) * al; data[i + 1] = data[i + 1] + (v[1] - data[i + 1]) * al; data[i + 2] = data[i + 2] + (v[2] - data[i + 2]) * al;
      data[i + 3] = Math.max(data[i + 3], Math.round(al * 255));
    };
    const get = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return null; const i = (y * W + x) * 4; return data[i + 3] ? hex(data[i], data[i + 1], data[i + 2]) : null; };
    const rect = (x, y, w, h, c, a) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c, a); };
    const grid = (g, x, y, o) => {
      o = o || {};
      const sx = o.sx || 0, sy = o.sy || 0, w = o.w || g.w, h = o.h || g.h;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = g.get(sx + i, sy + j); if (c) px(x + i, y + j, o.tint ? mix(c, o.tint, o.tt || 0.5) : c, o.a); }
    };
    const canvas = (cv) => {
      cv = cv || document.createElement("canvas");
      cv.width = W; cv.height = H;
      cv.getContext("2d").putImageData(new ImageData(data, W, H), 0, 0);
      return cv;
    };
    return { W, H, data, px, get, rect, grid, canvas };
  }

  // ---------- letters ----------
  const G3 = {
    A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111",
    F: "111100110100100", G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010",
    K: "101110100110101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010",
    P: "110101110100100", Q: "010101101111011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
    U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101", Y: "101101010010010",
    Z: "111001010100111", 0: "010101101101010", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110",
    4: "101101111001001", 5: "111100110001110", 6: "011100110101010", 7: "111001010010010", 8: "010101010101010",
    9: "010101011001110", "?": "110001010000010", "!": "010010010000010", ".": "000000000000010", "-": "000000111000000",
    ":": "000010000010000", "'": "010010000000000", "/": "001001010100100", "+": "000010111010000", ",": "000000000010100",
    "(": "001010010010001", ")": "100010010010100", ">": "100010001010100", "<": "001010100010001", "&": "010101010101011",
  };
  const Font3 = {
    text(px, s, x, y, c, k) {
      k = k || 1;
      let cx = x;
      for (const ch of String(s).toUpperCase()) {
        if (ch === " ") { cx += 3 * k; continue; }
        const g = G3[ch];
        if (g) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === "1") for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) px(cx + i * k + a, y + j * k + b, c);
        cx += 4 * k;
      }
      return cx - x - k;
    },
    width(s, k) { k = k || 1; let w = 0; for (const ch of String(s)) w += (ch === " " ? 3 : 4) * k; return Math.max(0, w - k); },
  };
  // the site's Pixelify bitmap (from food_art.js): [width, rows of bits], cap top at row 2, descenders below
  const PF = {" ":[2,[]],"!":[1,[0,0,1,1,1,1,1,0,1]],"\"":[3,[0,0,5,5]],"#":[6,[0,0,18,18,63,18,18,63,18]],"$":[5,[0,4,14,17,1,14,16,17,14,4]],"%":[8,[0,0,66,39,18,8,68,226,65]],"&":[6,[0,0,14,17,10,4,10,17,46]],"'":[1,[0,0,1,1]],"(":[3,[4,2,1,1,1,1,1,1,2,4]],")":[3,[1,2,4,4,4,4,4,4,2,1]],"*":[1,[0,0,1,1]],"+":[5,[0,0,4,4,31,4,4]],",":[1,[0,0,0,0,0,0,0,1,1]],"-":[3,[0,0,0,0,0,7]],".":[1,[0,0,0,0,0,0,0,1]],"/":[4,[0,0,8,4,4,2,2,1,1]],"0":[5,[0,0,14,17,17,17,17,17,14]],"1":[3,[0,0,2,5,4,4,4,4,4]],"2":[5,[0,0,14,17,16,14,1,17,14]],"3":[5,[0,0,14,17,16,14,16,17,14]],"4":[5,[0,0,24,20,18,17,31,16,16]],"5":[5,[0,0,31,1,15,16,16,17,14]],"6":[5,[0,0,14,17,1,15,17,17,14]],"7":[5,[0,0,14,17,16,16,16,16,16]],"8":[5,[0,0,14,17,17,14,17,17,14]],"9":[5,[0,0,14,17,17,30,16,17,14]],":":[1,[0,0,0,0,0,1,0,1]],";":[1,[0,0,0,0,0,1,0,1,1]],"<":[5,[0,16,8,4,2,1,2,4,8,16]],"=":[4,[0,0,0,0,15,15,15]],">":[5,[0,1,2,4,8,16,8,4,2,1]],"?":[5,[0,0,14,17,17,12,4,0,4]],"@":[5,[0,0,0,15,23,9,7]],"A":[5,[0,0,4,10,17,17,31,17,17]],"B":[5,[0,0,14,17,17,13,17,17,14]],"C":[5,[0,0,14,17,17,1,17,17,14]],"D":[5,[0,0,7,9,17,17,17,9,7]],"E":[5,[0,0,14,17,1,7,1,17,14]],"F":[5,[0,0,15,17,1,7,1,1,1]],"G":[5,[0,0,14,17,17,5,25,17,14]],"H":[5,[0,0,17,17,21,31,17,17,17]],"I":[3,[0,0,7,2,2,2,2,2,7]],"J":[5,[0,0,14,16,16,16,17,17,14]],"K":[5,[0,0,18,9,5,3,5,9,17]],"L":[5,[0,0,1,1,1,1,1,17,14]],"M":[7,[0,0,34,85,85,73,73,73,65]],"N":[5,[0,0,17,19,21,21,21,25,17]],"O":[5,[0,0,14,17,17,17,17,17,14]],"P":[5,[0,0,14,17,17,17,15,1,1]],"Q":[5,[0,0,14,17,17,17,17,17,14,4,8]],"R":[5,[0,0,14,17,17,17,15,5,9]],"S":[5,[0,0,14,17,1,14,16,17,14]],"T":[5,[0,0,14,21,4,4,4,4,4]],"U":[5,[0,0,17,17,17,17,17,17,14]],"V":[5,[0,0,17,17,17,17,10,10,4]],"W":[7,[0,0,65,73,73,73,85,85,34]],"X":[5,[0,0,17,10,10,4,10,10,17]],"Y":[5,[0,0,17,17,10,4,4,4,4]],"Z":[5,[0,0,15,17,16,14,1,17,30]],"[":[3,[0,6,1,1,1,1,1,1,6]],"\\":[4,[0,0,1,1,2,2,4,4,8]],"]":[3,[0,3,4,4,4,4,4,4,3]],"^":[1,[0,0,1]],"_":[3,[0,0,0,0,0,0,0,7]],"`":[1,[0,1]],"a":[6,[0,0,0,0,14,17,17,17,46]],"b":[5,[0,0,1,1,15,17,17,17,14]],"c":[5,[0,0,0,0,14,17,1,17,14]],"d":[5,[0,0,16,16,30,17,17,17,14]],"e":[5,[0,0,0,0,14,17,7,17,14]],"f":[5,[0,0,14,17,1,7,1,1,1]],"g":[5,[0,0,0,0,14,17,17,30,16,17,14]],"h":[5,[0,0,1,1,13,19,17,17,17]],"i":[1,[0,0,1,0,1,1,1,1,1]],"j":[4,[0,0,0,0,8,8,8,9,6]],"k":[5,[0,0,1,1,17,13,3,13,17]],"l":[1,[0,0,1,1,1,1,1,1,1]],"m":[7,[0,0,0,0,55,73,73,73,73]],"n":[5,[0,0,0,0,15,17,17,17,17]],"o":[5,[0,0,0,0,14,17,17,17,14]],"p":[5,[0,0,0,0,14,17,17,17,15,1,1]],"q":[5,[0,0,0,0,14,17,17,17,30,16,16]],"r":[5,[0,0,0,0,14,17,1,1,1]],"s":[5,[0,0,0,0,30,1,14,16,15]],"t":[6,[0,0,2,2,31,2,2,34,28]],"u":[5,[0,0,0,0,17,17,17,17,14]],"v":[5,[0,0,0,0,17,17,10,10,4]],"w":[7,[0,0,0,0,73,73,73,73,55]],"x":[5,[0,0,0,0,17,10,4,10,17]],"y":[5,[0,0,0,0,17,17,17,30,16,17,14]],"z":[5,[0,0,0,0,31,8,4,2,31]],"{":[4,[0,4,10,2,2,1,2,2,10,4]],"|":[1,[0,0,1,1,1,1,1,1,1]],"}":[4,[0,2,5,4,4,8,4,4,5,2]],"~":[3,[0,0,0,0,0,7]]};
  const glyph = (ch) => PF[ch] || PF[ch.normalize("NFD")[0]] || PF["?"];
  const FontP = {
    text(px, s, x, y, c, o) {
      o = o || {};
      const b = o.bold ? 1 : 0;
      let cx = x;
      for (const ch of String(s)) {
        const [w, rows] = glyph(ch);
        for (let r = 0; r < rows.length; r++) for (let i = 0; i < w; i++) if ((rows[r] >> i) & 1) for (let bb = 0; bb <= b; bb++) px(cx + i + bb, y + r - 2, c);
        cx += w + 1 + b;
      }
      return cx - x - 1;
    },
    width(s, o) { const b = o && o.bold ? 1 : 0; let w = 0; for (const ch of String(s)) w += glyph(ch)[0] + 1 + b; return Math.max(0, w - 1); },
  };

  // ---------- hands: the export's hand (class or strongest trait) picks lettering, ink and pressure ----------
  const HANDS = {
    big: { font: "3", k: 2, col: "#2a2320", jit: 1, tilt: 1, caps: true, grain: 0.12, light: "#7a6e62", word: "charcoal capitals" },
    jagged: { font: "P", col: "#7a2e16", jit: 1, caps: true, word: "jittery capitals" },
    neat: { font: "P", col: "#4a2a16", word: "a steady round hand" },
    upright: { font: "P", col: "#1e1a16", sp: 1, word: "an upright hand" },
    scrawl: { font: "P", col: "#5e2430", slant: 3, jit: 0.5, word: "a slanted scrawl" },
    looping: { font: "P", col: "#22324e", slant: 4, word: "a looping hand" },
    block: { font: "P", col: "#2a2a2e", bold: true, caps: true, word: "blunt block letters" },
    cramped: { font: "P", col: "#6a625a", grain: 0.35, light: "#9a9084", jit: 0.5, word: "faint pencil" },
    flourish: { font: "P", col: "#2a4a2a", flourish: true, word: "a flourishing hand" },
    map: { font: "P", col: "#2e2116" },
  };
  const hand = (h) => (typeof h === "string" ? HANDS[h] || HANDS.neat : h);
  const lineH = (H) => (H.font === "3" ? 6 * (H.k || 1) + 1 : 10);
  const capH = (H) => (H.font === "3" ? 5 * (H.k || 1) : 7);
  const prep = (H, s) => (H.caps ? String(s).toUpperCase() : String(s));
  function charW(H, ch, first) {
    const k = H.k || 1, b = H.bold || (H.flourish && first) ? 1 : 0;
    if (H.font === "3") return (ch === " " ? 3 * k : 3 * k) + b;
    return FontP.width(ch) + b;
  }
  const gapW = (H) => (H.font === "3" ? (H.k || 1) : 1) + (H.sp || 0);
  function width(h, s) {
    const H = hand(h);
    let w = 0, i = 0;
    for (const ch of prep(H, s)) { w += charW(H, ch, i === 0) + gapW(H); i++; }
    return Math.max(0, w - gapW(H)) + (H.slant ? Math.ceil(capH(H) / H.slant) : 0);
  }
  // y is the cap top; returns the width written
  function write(px, h, s, x, y, o) {
    const H = Object.assign({}, hand(h), o || {}), seed = H.seed != null ? H.seed : hashStr(s) % 997;
    const ch0 = capH(H);
    let cx = x, i = 0;
    for (const ch of prep(H, s)) {
      const dy = H.jit ? Math.round((h2(i, seed, 11) - 0.5) * 2 * H.jit) : 0;
      const lean = H.tilt ? (h2(i, seed, 13) - 0.5) * 2 * H.tilt : 0;
      const bold = H.bold || (H.flourish && i === 0);
      const plot = (X, Y) => {
        const sh = (H.slant ? Math.floor((y + ch0 - Y) / H.slant) : 0) + (lean ? Math.round((lean * (y + ch0 - Y)) / ch0) : 0);
        const c = H.grain && h2(X * 3 + 1, Y * 5 + 2, seed) < H.grain ? H.light : H.col;
        px(X + sh, Y + dy, c);
        if (bold) px(X + sh + 1, Y + dy, c);
      };
      if (H.font === "3") Font3.text(plot, ch, cx, y, H.col, H.k || 1);
      else FontP.text(plot, ch, cx, y, H.col);
      cx += charW(H, ch, i === 0) + gapW(H);
      i++;
    }
    return cx - x;
  }
  function wrap(h, text, maxW) {
    const words = String(text).split(/\s+/).filter(Boolean), out = [];
    let cur = "";
    for (const wd of words) {
      const t = cur ? cur + " " + wd : wd;
      if (cur && width(h, t) > maxW) { out.push(cur); cur = wd; } else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  }
  function line(px, x0, y0, x1, y1, col, dash) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    if (![x0, y0, x1, y1].every(Number.isFinite)) return;
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy, n = 0;
    for (;;) {
      if (!dash || n % (dash * 2) < dash) px(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
      n++;
    }
  }
  function arrow(px, pts, col, head) {
    for (let i = 0; i < pts.length - 1; i++) line(px, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col);
    const [ax, ay] = pts[pts.length - 1], [bx, by] = pts[pts.length - 2], a = Math.atan2(ay - by, ax - bx), L = head || 4;
    for (const s of [-0.6, 0.6]) line(px, ax, ay, ax - Math.cos(a + s) * L, ay - Math.sin(a + s) * L, col);
  }
  function tick(px, x, y, col) {
    [[0, 2], [1, 3], [2, 4], [3, 3], [4, 2], [5, 1], [6, 0]].forEach(([i, j]) => { px(x + i, y + j, col); px(x + i, y + j + 1, mix(col, "#000000", 0.25)); });
  }
  function ring(px, cx, cy, rx, ry, col, o) {
    o = o || {};
    const N = Math.ceil((rx + ry) * 4);
    for (let a = 0; a < N * (o.over || 1.08); a++) {
      if (o.gap && a % o.gap === o.gap - 1) continue;
      const t = (a / N) * Math.PI * 2 + (o.rot || 0), wob = o.wob ? (h2(a >> 2, 1, o.seed || 3) - 0.5) * o.wob : 0;
      px(Math.round(cx + Math.cos(t) * (rx + wob + a * (o.drift || 0))), Math.round(cy + Math.sin(t) * (ry + wob)), col);
    }
  }

  // ---------- crews ----------
  const crewCache = {};
  function crewInk(id) {
    if (crewCache[id]) return crewCache[id];
    const A = window.App || {}, p = (A.parties || {})[id], hh = (A.heroes || {})[id];
    const cands = p && p.banner ? [p.banner.c1, p.banner.c2] : hh && hh.look ? [hh.look.fav] : ["#3c64c8"];
    let c = cands.filter(Boolean).sort((a, b) => lum(a) - lum(b))[0] || "#3c64c8";
    const l = lum(c);
    if (l > 0.42) c = mix(c, "#2e2116", Math.min(0.75, (l - 0.3) * 1.3));
    return (crewCache[id] = c);
  }
  function crewBanner(id) {
    const A = window.App || {}, p = (A.parties || {})[id];
    if (p && p.banner) return p.banner;
    const hh = (A.heroes || {})[id], c = hh && hh.look && hh.look.fav ? hh.look.fav : "#3c64c8";
    return { c1: c, c2: "#e8dcc0", emblem: null };
  }
  function crewShort(id) {
    const A = window.App || {}, p = (A.parties || {})[id], hh = (A.heroes || {})[id];
    if (p) { const w = p.name.replace(/^the\s+/i, "").split(/\s+/); return w.length > 1 && /'s$/.test(w[0]) ? w[0].replace(/'s$/, "") : w[w.length - 1]; }
    return hh ? hh.name.split(" ")[0] : "?";
  }
  // a hero's head and shoulders, cut from the top of their standing sprite
  function bust(h, rows) {
    const A = window.App || {};
    const g = Art.heroGrid(h, 0, A.S && A.S.classes ? A.S.classes[h.cls] || A.S.classes.warrior : undefined);
    let x0 = g.w, y0 = g.h, x1 = -1;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); }
    const r = rows || 16, out = new Art.Grid(x1 - x0 + 1, r);
    for (let y = 0; y < r; y++) for (let x = x0; x <= x1; x++) out.set(x - x0, y, g.get(x, y0 + y));
    return out;
  }

  // ---------- the floor carved into cells ----------
  // every room sits where the exported plan put it (league/floorplan.py: a box, and a cave's own cells), then passages are routed cell
  // by cell round other rooms, so the inked sheet and the replay's token walk the same plan
  const MARGIN = 3;
  const planCache = new Map();
  const key = (n) => String(n);
  function carve(did, floor) {
    const ck = did + ":" + floor.floor + ":" + floor.rooms.map((r) => r.n + "@" + r.box).join(",");
    if (planCache.has(ck)) return planCache.get(ck);
    const once = new Set(), rooms = floor.rooms.filter((r) => r.box && !once.has(key(r.n)) && once.add(key(r.n)));
    const W = Math.max(1, ...rooms.map((r) => r.box[0] + r.box[2])) + MARGIN * 2, H = Math.max(1, ...rooms.map((r) => r.box[1] + r.box[3])) + MARGIN * 2;
    const own = new Int16Array(W * H), I = (x, y) => y * W + x;
    const out = rooms.map((r, i) => {
      const v = hashStr(did + ":" + floor.floor + ":" + r.n);
      const [bx, by, w, h] = r.box, x0 = bx + MARGIN, y0 = by + MARGIN, cells = [];
      if (r.cells) for (const [x, y] of r.cells) { own[I(x + MARGIN, y + MARGIN)] = i + 1; cells.push([x + MARGIN, y + MARGIN]); }
      else {
        // a few shapes for a built room: square, L, cut corners, T, a bitten corner
        const shape = r.lair ? 2 : w >= 4 && h >= 3 ? (v >>> 12) % 6 : 0, half = Math.ceil(w / 2);
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
          const i0 = x - x0, j0 = y - y0, L = i0 === 0, R = i0 === w - 1, T = j0 === 0, B = j0 === h - 1;
          if (shape === 1 && T && i0 >= half) continue;
          if (shape === 2 && (L || R) && (T || B)) continue;
          if (shape === 3 && B && (i0 < 1 || i0 >= w - 1)) continue;
          if (shape === 4 && B && R) continue;
          if (shape === 5 && T && L) continue;
          own[I(x, y)] = i + 1;
          cells.push([x, y]);
        }
      }
      return { r, i, n: key(r.n), x0, y0, w, h, cells, cx: x0 + w / 2, cy: y0 + h / 2, secret: r.kind === "secret" };
    });
    const byN = {};
    for (const b of out) byN[b.n] = b;
    // passages: cheapest path from one room to the other, round any third room, liking straight runs and old passages
    const corrs = [], seen = new Set();
    for (const [a, b] of floor.edges || []) {
      const A0 = byN[key(a)], B0 = byN[key(b)], ek = key(a) + ">" + key(b);
      if (!A0 || !B0 || seen.has(ek)) continue;
      seen.add(ek);
      const path = route(own, W, H, A0, B0);
      const k = corrs.length + 1;
      for (const [x, y] of path) if (own[I(x, y)] <= 0) own[I(x, y)] = -k;
      corrs.push({ a: A0.n, b: B0.n, cells: path, secret: B0.secret || A0.secret, k });
    }
    const plan = { did, floor: floor.floor, W, H, own, I, rooms: out, byN, corrs };
    plan.label = (b) => labelCell(plan, b);
    if (planCache.size > 40) planCache.clear();
    planCache.set(ck, plan);
    return plan;
  }
  // what the sheet shows of a floor: every walked room inked (1), every room one passage from a walked room pencilled (2), nothing else;
  // a floor nobody has walked shows its way in and the rooms off it, once the way down to it is known
  function visible(D, floor, plan, inked) {
    const cls = new Map();
    for (const b of plan.rooms) if (inked.has(b.n)) cls.set(b.n, 1);
    if (!cls.size) {
      const prev = (D.floors || []).find((f) => f.floor === floor.floor - 1);
      const door = plan.byN[key((floor.rooms[0] || {}).n)];
      if (door && (floor.floor === 1 || (prev && prev.rooms.some((r) => r.stair && r.state)))) {
        cls.set(door.n, 2);
        for (const c of plan.corrs) if (c.a === door.n || c.b === door.n) cls.set(c.a === door.n ? c.b : c.a, 2);
      }
      return cls;
    }
    for (const c of plan.corrs) {
      if (cls.get(c.a) === 1 && !cls.has(c.b)) cls.set(c.b, 2);
      else if (cls.get(c.b) === 1 && !cls.has(c.a)) cls.set(c.a, 2);
    }
    return cls;
  }
  function labelCell(plan, b) {
    // the room's top-left-most whole cell, so numbers sit where the eye starts reading the room
    const set = new Set(b.cells.map(([x, y]) => x + "," + y));
    for (const [x, y] of b.cells.slice().sort((p, q) => p[1] - q[1] || p[0] - q[0])) if (set.has(x + 1 + "," + y)) return [x, y];
    return b.cells[0];
  }
  function route(own, W, H, A0, B0) {
    const I = (x, y) => y * W + x, N = W * H * 4, dist = new Float64Array(N).fill(1e9), prev = new Int32Array(N).fill(-1);
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]], heap = [];
    const push = (d, s) => { heap.push([d, s]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const ai = A0.i + 1, bi = B0.i + 1;
    const near = (x, y) => { for (const [dx, dy] of DIRS) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) { const o = own[I(X, Y)]; if (o > 0 && o !== ai && o !== bi) return true; } } return false; };
    // start from the cell of A nearest B's centre, to keep doors facing each other
    for (const [x, y] of A0.cells) for (let d = 0; d < 4; d++) { const s = I(x, y) * 4 + d; dist[s] = Math.abs(x + 0.5 - B0.cx) * 0.01 + Math.abs(y + 0.5 - B0.cy) * 0.01; push(dist[s], s); }
    let end = -1;
    while (heap.length) {
      const [d, s] = pop();
      if (d > dist[s]) continue;
      const c = (s / 4) | 0, dir = s % 4, x = c % W, y = (c / W) | 0;
      if (own[c] === bi) { end = s; break; }
      for (let nd = 0; nd < 4; nd++) {
        const X = x + DIRS[nd][0], Y = y + DIRS[nd][1];
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const o = own[I(X, Y)];
        if (o > 0 && o !== bi && o !== ai) continue;
        let cost = o === ai ? 0.05 : o < 0 ? 0.6 : 1;
        if (nd !== dir && own[c] !== ai) cost += 1.6;
        if (o === 0 && near(X, Y)) cost += 2.5;
        const t = I(X, Y) * 4 + nd, nd2 = d + cost;
        if (nd2 < dist[t]) { dist[t] = nd2; prev[t] = s; push(nd2, t); }
      }
    }
    const path = [];
    for (let s = end; s >= 0; s = prev[s]) { const c = (s / 4) | 0; if (own[c] !== ai && own[c] !== bi) path.push([c % W, (c / W) | 0]); }
    return path.reverse();
  }

  // ---------- what is known of a floor ----------
  // walked rooms, the rooms a door away from them (pencil), sprung traps and the slain lair, as of now or the start of a replayed day
  function known(D, floor, before) {
    const inked = new Map();
    for (const r of floor.rooms) if (r.state && (before == null || r.state.d < before)) inked.set(key(r.n), { crew: r.state.crew, d: r.state.d, s: r.state.s });
    const sprung = new Set();
    for (const d of D.days || []) if (before == null || d.day < before) for (const rm of d.rooms) if (rm.floor === floor.floor && rm.sprung) sprung.add(key(rm.n));
    const slain = !!(D.boss && D.boss.alive === false && (before == null || (D.boss.kills || []).some((k) => k.day < before)));
    return { inked, sprung, crews: [], slain, rumour: !!(D.boss && D.boss.rumoured) };
  }

  window.DungeonPen = { rgb, hex, mix, lum, h2, vnoise, hashStr, ramp, surface, Font3, FontP, HANDS, hand, width, write, wrap, lineH, capH, line, arrow, tick, ring,
    crewInk, crewBanner, crewShort, bust, carve, visible, known, key };
})();
