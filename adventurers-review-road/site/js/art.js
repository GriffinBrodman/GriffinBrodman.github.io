/* Pixel art engine: procedural paper-doll heroes, monsters, pets, banners, icons. Everything is drawn into
   small pixel grids, auto-outlined and shaded, then cached as canvases. */
(function () {
  "use strict";

  // ---------- colour helpers ----------
  function hexToRgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    return "#" + c(r) + c(g) + c(b);
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    function f(p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    let r, g, b;
    if (s === 0) r = g = b = l;
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3);
    }
    return rgbToHex(r * 255, g * 255, b * 255);
  }
  // ramp: [deep, shade, base, light, highlight]; hue-shifted like hand-made pixel palettes
  const rampCache = {};
  function ramp(hex) {
    if (rampCache[hex]) return rampCache[hex];
    const [h, s, l] = rgbToHsl(...hexToRgb(hex));
    const shift = (dh, dl, ds) => hslToHex((h + dh + 1) % 1, Math.max(0, Math.min(1, s + ds)), Math.max(0.03, Math.min(0.97, l + dl)));
    const r = [shift(0.04, -0.3, 0.05), shift(0.02, -0.15, 0.03), hex, shift(-0.02, 0.12, -0.04), shift(-0.04, 0.24, -0.1)];
    rampCache[hex] = r;
    return r;
  }
  function mix(a, b, t) {
    const x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // ---------- pixel grid ----------
  class Grid {
    constructor(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); }
    set(x, y, c) { x |= 0; y |= 0; if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c; }
    get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : null; }
    clear(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = null; }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
    hline(x0, x1, y, c) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c); }
    vline(x, y0, y1, c) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c); }
    line(x0, y0, x1, y1, c) {
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.set(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    // shaded ellipse lit from the top-left
    blob(cx, cy, rx, ry, rmp, flat) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
          const d = nx * nx + ny * ny;
          if (d > 1) continue;
          if (flat) { this.set(x, y, rmp[2]); continue; }
          const light = -nx * 0.55 - ny * 0.75 + (1 - d) * 0.4;
          const idx = light > 0.75 ? 4 : light > 0.25 ? 3 : light > -0.35 ? 2 : light > -0.8 ? 1 : 0;
          this.set(x, y, rmp[idx]);
        }
      }
    }
    outline(c) {
      const add = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
      }
      for (const [x, y] of add) this.set(x, y, c);
    }
    flipX() {
      const g = new Grid(this.w, this.h);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) g.px[y * this.w + (this.w - 1 - x)] = this.px[y * this.w + x];
      return g;
    }
    tint(c, t) {
      const g = new Grid(this.w, this.h);
      g.px = this.px.map((p) => (p ? mix(p, c, t) : null));
      return g;
    }
    toCanvas(scale) {
      scale = scale || 1;
      const cv = document.createElement("canvas");
      cv.width = this.w * scale; cv.height = this.h * scale;
      const ctx = cv.getContext("2d");
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const c = this.px[y * this.w + x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
      return cv;
    }
  }

  const OUTLINE = "#1a1220";
  const METAL = { 1: "#8a7a6a", 2: "#9aa0a8", 3: "#c0c8d0", 4: "#e2e6ea", 5: "#b8e8ff" };
  const WOOD = "#8a5a32";
  const GOLD = "#e8b84a";
  const AURA = {
    fire: ["#ff9a3a", "#ffd25a", "#ff5a2a"], ice: ["#9ae8ff", "#e8fbff", "#5ab8f0"], holy: ["#ffe88a", "#fff6c8", "#ffd04a"],
    death: ["#7ad08a", "#2a4a3a", "#a0f0b0"], storm: ["#fff35a", "#a0d8ff", "#ffffff"], nature: ["#7ad04a", "#c8f07a", "#3a9a3a"],
    arcane: ["#c88aff", "#f0c8ff", "#8a5aff"], shadow: ["#3a2a4a", "#5a4a6a", "#1a1020"], rage: ["#ff4a4a", "#ff9a7a", "#c81a2a"],
    gold: ["#ffd84a", "#fff2a0", "#e8a02a"], fate: ["#f0d080", "#fff4cc", "#3a5aa8"],
    mana: ["#4ad0c8", "#b8fff0", "#1a8a9a"], illusion: ["#f0a0c8", "#a8f0e0", "#fff0fa"], elements: ["#ff9a3a", "#9ae8ff", "#fff35a"],
    lore: ["#f4e4b0", "#c8a860", "#5a8ad0"],
  };

  const drawHero = (o) => Paint.fullBody(o);

  // ---------- pets ----------
  // Dogs, cats and lizards are hand-mapped bodies, one letter per region, which a named coat paints. Regions:
  // h head, r ear, n neck, m muzzle, j chin, f cheek, c chest, b back, s side, u belly, t tail, q tail tip, d crest,
  // w dewlap, L/l far/near leg, P/p far/near paw; E eye and N nose are not fur. shade is the ramp step each region takes,
  // so a white chest on a black dog is lit like the rest of it. A mark selector is space-separated tokens: a part name,
  // "@regions", or "x,y" (frame-0 pixels); later marks win, and a null colour leaves the pixel bare (a bobbed tail).
  // move(x, y, region) is the vertical step a pixel takes in frame 1.
  const PET_BODY = {
    dog: {
      shade: { h: 2.6, r: 1, n: 2, m: 2.8, j: 1.5, f: 2, c: 3, b: 2.6, s: 2, u: 1.5, t: 2, q: 2, L: 1.3, l: 2, P: 1.3, p: 2 },
      rows: [
        "",
        ".........rhh",
        "........nrEmm",
        ".q.bbbbbncfmN",
        "..tssssssccj",
        "..sssssuc",
        "...uuuuuu",
        "...L.l..Ll",
        "...P.p..Pp",
      ],
      move: (x, y, k) => ("LlPp".includes(k) ? 0 : 1),
      parts: {
        blaze: "11,1 @m", brow: "10,1", socks: "@LlPp", saddle: "@b 3,4 4,4 5,4 6,4 7,4",
        merle: "4,3 5,3 2,4 3,4 6,4 7,4 3,5 6,5 8,2 @r", merleLight: "3,3 6,3 4,4 5,5",
        spots: "4,3 7,3 5,4 3,5 7,5 10,1", brindle: "3,4 3,5 5,3 5,4 5,5 7,3 7,4 7,5", flecks: "4,3 6,3 3,4 7,4 4,5 6,5 11,1",
      },
    },
    cat: {
      shade: { h: 2.6, r: 2, n: 2, f: 2, c: 2.8, b: 2.6, s: 2, u: 1.5, t: 2, q: 2.6, L: 1.3, l: 2, P: 1.3, p: 2 },
      nose: "#e8909a",
      rows: [
        "",
        "",
        ".........r.r",
        ".q......nhhh",
        ".t..bbbbnEhE",
        "..tssssssfNf",
        "...sssuucc",
        "....Luuul",
        "....P...p",
      ],
      move: (x, y, k) => ("qt".includes(k) ? -1 : 0),
      parts: {
        stripes: "4,4 4,5 4,6 6,4 6,5 8,5 10,3 @q 2,5", mackerel: "3,5 5,4 5,5 5,6 7,4 7,5 9,3 11,3 10,3 @q 2,5",
        face: "10,3 10,4 @f",
      },
    },
    lizard: {
      shade: { d: 3, h: 2.6, b: 2.6, u: 1.6, f: 2, m: 3, w: 2, t: 2, q: 2, L: 1.3, l: 2, P: 1.3, p: 2 },
      rows: [
        "",
        "",
        "",
        "..........hh",
        "....d.d.d.hEm",
        ".q..bbbbbbfmm",
        ".tttuuuuuuww",
        "....L...l.w",
        "...PP...pp",
      ],
      move: (x) => (x >= 10 ? -1 : 0),
      parts: {
        tailBands: "1,5 3,6", bands: "6,5 6,6 9,5 9,6", spots: "5,5 8,5 6,6 9,6 2,6 11,3",
      },
    },
  };
  const K = "#2a2630", WH = "#f2eee6", TAN = "#c8783a";
  // a pet with no coat of its own wears one picked by its name, so it keeps its looks from day to day
  const PET_COATS = {
    dog: {
      aussie: { fur: "#8a96a8", marks: [["merleLight", "#aab4c4"], ["merle 11,1", K], ["@f brow socks", TAN], ["@mjc 8,3 @Pp", WH], ["@q", null]] },
      red_merle: { fur: "#c89a7c", marks: [["merleLight", "#e4c4aa"], ["merle 11,1", "#8a3e24"], ["@f brow socks", "#d8904a"], ["@mjc 8,3 @Pp", WH], ["@q", null]] },
      collie: { fur: K, eye: "#b07a3a", marks: [["blaze @jcn @Pp @q", WH]] },
      golden: { fur: "#d8a050", marks: [["@c @q", "#ecc483"]] },
      black_lab: { fur: "#2e2a2e", eye: "#b07a3a" },
      chocolate_lab: { fur: "#6a4232", eye: "#d0a050" },
      beagle: { fur: "#c47a36", marks: [["saddle", K], ["blaze @jcu @Pp @l @q", WH]] },
      husky: { fur: "#7c8492", eye: "#7ac8f0", marks: [["@b", "#4c525e"], ["brow @fmjc @u @LlPp @q", WH]] },
      dalmatian: { fur: WH, marks: [["spots @r", K]] },
      brindle: { fur: "#a06a3a", marks: [["brindle @m", "#3a2a22"], ["@c", "#d8b088"]] },
      shepherd: { fur: "#c8843a", marks: [["saddle @m @r", K], ["@Pp", "#e0a860"]] },
      corgi: { fur: "#d47a34", marks: [["blaze @jcu @Pp", WH], ["@q", null]] },
      terrier: { fur: "#7e7e80", marks: [["flecks @mj", "#b8b6b0"], ["@r", "#56565a"]] },
      mutt: { fur: "#e6d6b2", marks: [["@r 10,1", "#5a3a26"]] },
    },
    cat: {
      orange_tabby: { fur: "#e0883a", eye: "#e8c040", marks: [["stripes", "#a84e1e"]] },
      grey_tabby: { fur: "#9a9aa4", eye: "#8ad05a", marks: [["stripes", "#4a4a56"]] },
      brown_tabby: { fur: "#a07a52", eye: "#c8c040", marks: [["mackerel", "#3a2a1e"], ["@f", "#c8a47a"]] },
      tuxedo: { fur: K, eye: "#a0e050", marks: [["face @c @u @Pp", WH]] },
      calico: { fur: WH, eye: "#e8b030", marks: [["4,4 5,4 3,5 4,5 9,3 @r 2,5", "#d8782e"], ["6,4 7,4 7,5 6,5 11,3 @q", K]] },
      tortie: { fur: "#2e2628", eye: "#e8b030", nose: "#5a3a3a", marks: [["4,4 3,5 6,5 7,4 9,3 2,5 5,6 11,3", "#c8642a"]] },
      siamese: { fur: "#ece0c6", eye: "#5aa8f0", nose: "#4a3428", marks: [["@r @f 10,4 @LlPp @qt", "#4a3428"]] },
      black: { fur: "#262230", eye: "#6ae05a", nose: "#4a3a44" },
      white: { fur: WH, eye: ["#5aa8f0", "#e8b030"] },
      blue: { fur: "#7a8696", eye: "#e8a030", nose: "#8a6a74" },
      cream: { fur: "#ecd2a4", eye: "#e8a040", marks: [["stripes", "#d4aa72"]] },
      ginger_white: { fur: "#d87a32", eye: "#c8d050", marks: [["face @c @u @LlPp", WH]] },
    },
    lizard: {
      green: { fur: "#5aa848", marks: [["bands", "#4a9440"], ["tailBands", "#2e6a2a"], ["@d", "#b0dc7a"]] },
      blue: { fur: "#5a86c0", marks: [["bands", "#4a74ac"], ["tailBands", "#2e4a7a"], ["@d @w", "#a8c8f0"]] },
      banded: { fur: "#e87a2a", marks: [["bands tailBands", "#2a2228"], ["@d", "#f0b050"]] },
      sandy: { fur: "#d8b878", marks: [["spots", "#8a6a3a"], ["@u", "#ead8a8"]] },
      red_throat: { fur: "#7a9248", marks: [["tailBands", "#4a6230"], ["@w", "#d8402a"], ["@d", "#c86a3a"]] },
      gecko: { fur: "#e8c84a", marks: [["@u", "#f2e6c4"], ["spots", "#4a3a34"], ["tailBands", "#f2e6c4"]] },
      black: { fur: "#3a3a42", eye: "#e8c040", marks: [["tailBands", "#9aa0a8"], ["@d", "#6a7078"]] },
      red: { fur: "#c8502a", marks: [["tailBands", "#7a2a1a"], ["@d", "#f0a050"]] },
    },
  };
  const selCache = {};
  function petSel(kind, sel) {
    const key = kind + "|" + sel;
    if (selCache[key]) return selCache[key];
    const B = PET_BODY[kind], out = { re: "", pts: new Set() };
    for (const tok of sel.split(" ").filter(Boolean)) {
      if (B.parts[tok]) { const s = petSel(kind, B.parts[tok]); out.re += s.re; s.pts.forEach((p) => out.pts.add(p)); }
      else if (tok[0] === "@") out.re += tok.slice(1);
      else out.pts.add(tok);
    }
    return (selCache[key] = out);
  }
  function petCoat(kind, name, coat) {
    const list = PET_COATS[kind], keys = Object.keys(list);
    return list[coat] || list[keys[Math.floor(rng(hash(name || "pet"))() * keys.length)]];
  }
  function drawCoatedPet(kind, co, frame) {
    const B = PET_BODY[kind], g = new Grid(14, 10), cells = [];
    let eyes = 0;
    B.rows.forEach((row, y) => [...row].forEach((k, x) => {
      if (k === ".") return;
      let col;
      if (k === "E") { const e = co.eye || OUTLINE; col = Array.isArray(e) ? e[eyes++ % e.length] : e; }
      else if (k === "N") col = co.nose || B.nose || OUTLINE;
      else {
        let fur = co.fur;
        for (const [sel, c] of co.marks || []) { const s = petSel(kind, sel); if (s.re.includes(k) || s.pts.has(x + "," + y)) fur = c; }
        if (!fur) return;
        const R = ramp(fur), sh = B.shade[k], lo = Math.floor(sh);
        col = sh === lo ? R[sh] : mix(R[lo], R[lo + 1], sh - lo);
      }
      cells.push([x, y, col, frame ? B.move(x, y, k) : 0]);
    }));
    // the still pixels go on last, so a dog's planted legs stay in front of its bobbing body
    for (const [x, y, col, dy] of cells) if (dy) g.set(x, y + dy, col);
    for (const [x, y, col, dy] of cells) if (!dy) g.set(x, y, col);
    g.outline(OUTLINE);
    return g;
  }
  function drawPet(kind, name, frame, coat) {
    if (PET_COATS[kind]) return drawCoatedPet(kind, petCoat(kind, name, coat), frame);
    const r = rng(hash(name || "pet"));
    const g = new Grid(14, 10);
    const oy = frame === 1 ? 1 : 0;
    const paint = (rows, pal, dy) => rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") g.set(x, y + dy, pal[ch]); }));
    if (kind === "horse") {
      const c = ramp(["#8a5a3a", "#3a2a22", "#d8c8a8", "#a8a8b0", "#c8803a"][Math.floor(r() * 5)]);
      const mane = c[2];
      g.blob(6, 4.5 + oy, 4, 2, c); g.rect(9, 1 + oy, 2, 4, c[1]); g.blob(11.5, 1.5 + oy, 1.8, 1.2, c);
      g.set(12, 1 + oy, "#1a1220"); g.set(10, 0 + oy, c[1]);
      g.rect(9, 1 + oy, 1, 3, mane); g.set(1, 4 + oy, mane); g.set(1, 5 + oy, mane); g.set(2, 4 + oy, mane);
      g.rect(3, 6 + oy, 1, 4 - oy, c[1]); g.rect(5, 6 + oy, 1, 4 - oy, c[2]); g.rect(8, 6 + oy, 1, 4 - oy, c[1]); g.rect(9, 6 + oy, 1, 4 - oy, c[2]);
    } else if (kind === "wolf") {
      // a wolf stands taller and longer than any dog, so it gets a bigger grid than the other pets
      const c = ramp(["#8a8a96", "#d0ccc4", "#46424c", "#9a6a4a", "#8a7a66"][Math.floor(r() * 5)]);
      const p = ramp(mix(c[4], "#f4f0e6", 0.6));
      const pal = { 0: c[0], 1: c[1], 2: c[2], 3: c[3], 4: c[4], p: p[3], q: p[1], e: "#f0c840", n: OUTLINE };
      const w = new Grid(22, 14), put = (rows, dy) => rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") w.set(x + 1, y + 1 + dy, pal[ch]); }));
      put(["", "", "", "", "", "", "", "", ".....1.2....1.2", ".....1.2....1.2", ".....1.2....1.2", ".....0.p....0.p"], 0);
      put([
        "..............4..4",
        ".............343.43",
        "............3444444",
        "....33333333444e444",
        "..33444444444444444n",
        ".3322222222222pqqqq",
        ".22.2222222222pp",
        ".21..qq222222122",
        "2p...1qqqq.1",
        "p",
      ], oy);
      w.outline(OUTLINE);
      return w;
    } else if (kind === "falcon") {
      const c = ramp(["#5a6a80", "#7a5a3a", "#9a7a52", "#b06a3a"][Math.floor(r() * 4)]);
      const b = ramp("#efe4cc");
      const pal = { 0: c[0], 1: c[1], 2: c[2], 3: c[3], 4: c[4], w: b[3], x: mix(c[0], b[2], 0.3),
        o: OUTLINE, y: "#f0c030", k: "#9098a8", K: "#3a3a48" };
      paint([
        ".........344",
        "........30oyk",
        "........00w0K",
        ".......100w0w",
        ".......11www",
        ".......11xxw",
        "......111www",
        "....3211.xx",
        "..3231...y.y",
        ".323",
      ], pal, 0);
      paint(["", "", "......44", ".....4332", "....43322", "...432221", "...32211", "....211"], pal, -oy);
    }
    g.outline(OUTLINE);
    return g;
  }

  // ---------- monsters ----------
  const MPAL = {
    brown: ["#8a5a3a", "#c8a070", "#f0d040"], green: ["#6aa04a", "#7a5a3a", "#ff4a2a"], green_archer: ["#6aa04a", "#4a6a3a", "#ff4a2a"],
    green_shaman: ["#6aa04a", "#7a4aa0", "#ffd84a"], green_chief: ["#5a904a", "#a03a2a", "#ffd84a"], grey: ["#8a8a96", "#d8d8e0", "#f0d040"],
    dark: ["#4a4450", "#8a8494", "#ff4a4a"], black: ["#3a3440", "#7a2a3a", "#ff4a4a"], purple: ["#6a4a8a", "#c8a0e0", "#ff4a8a"],
    bandit: ["#e0b088", "#5a4a3a", "#7a2a2a"], bandit_archer: ["#c89070", "#4a5a3a", "#3a5a2a"], bandit_captain: ["#e0b088", "#7a1a2a", "#e8b84a"],
    rust: ["#c86a3a", "#8a4a2a", "#f0d040"], rust_sling: ["#c86a3a", "#6a5a3a", "#f0d040"], dusk: ["#5a4a6a", "#8a6a9a", "#ff4a4a"],
    green_slime: ["#6ad06a", "#c8f0a0", "#2a6a2a"], stone: ["#7a8a7a", "#5a6a5a", "#f0d040"], swamp: ["#5a7a4a", "#3a5a3a", "#f0d040"],
    red_drake: ["#c84a3a", "#f0a050", "#ffd84a"], wood: ["#9a6a3a", "#e8b84a", "#ff3a3a"], bone: ["#e8e0d0", "#a89880", "#ff4a2a"],
    bone_archer: ["#e8e0d0", "#6a5a4a", "#ff4a2a"], rot: ["#7a9a6a", "#5a4a3a", "#f0f0a0"], ghost: ["#a8b8d8", "#e8f0ff", "#4af0ff"],
    necromancer: ["#c8c0b0", "#2a2034", "#7af08a"], bog: ["#5a6a4a", "#8a9a5a", "#ff8a2a"], wisp: ["#c8f0ff", "#ffffff", "#5ab8ff"],
    sea: ["#4a8a9a", "#9ad0c8", "#f0f0a0"], hag: ["#7a9a5a", "#3a2a3a", "#f0d040"], frost: ["#c8d8e8", "#f0f8ff", "#5ab8ff"],
    yeti: ["#e8eef0", "#9aa8b8", "#5ab8ff"], ice: ["#9ad8f0", "#e8fbff", "#2a6ab0"], frost_giant: ["#8ab0d0", "#e8f4ff", "#ffffff"],
    crab: ["#d85a3a", "#f0a080", "#1a1220"], drowned: ["#5a8a8a", "#2a4a5a", "#f0f0a0"], kraken: ["#8a3a6a", "#d87aa0", "#ffd84a"],
    salamander: ["#e86a2a", "#ffd04a", "#ffffff"], fire: ["#ff8a2a", "#ffe86a", "#ffffff"], lava: ["#4a3434", "#ff6a2a", "#ffd84a"],
    dragon: ["#a83a3a", "#e8b84a", "#ffd84a"],
  };

  function drawMonster(body, pal, frame, boss, pose) {
    const p = MPAL[pal] || MPAL.grey;
    const E = p[2];
    let g;
    const f = frame || 0;
    const humanoid = (skin, cloth, opts) => drawHero({
      look: { skin, hair: opts.hair || "#2a2020", style: opts.style == null ? 4 : opts.style, face: opts.face || 0, fav: cloth, scars: opts.scars || [] },
      clsLook: { outfit: opts.outfit || "leather", head: opts.head || "none", aura: opts.aura || null, offhand: opts.off || "none" },
      weapon: opts.weapon || "sword", weaponTier: opts.tier || 1, armorTier: 1, frame: f, pose,
    });
    switch (body) {
      case "goblin_big": return Beasts.draw("warchief", pal, f, boss, p, pose);
      case "human": {
        if (boss && pal === "necromancer") return Beasts.draw("lich", pal, f, false, p, pose);
        const map = { bandit: ["hood", "leather", "sword"], bandit_archer: ["hood", "leather", "bow"], bandit_captain: ["tricorn", "fancy", "sword"],
          necromancer: ["skull_hood", "robe_dark", "staff"] };
        const [head, outfit, weapon] = map[pal] || ["none", "leather", "sword"];
        g = humanoid(p[0], p[1], { style: 0, head, outfit, weapon, face: pal === "bandit_captain" ? 2 : 1, aura: pal === "necromancer" ? "death" : null, off: pal === "necromancer" ? "skull" : "none", tier: pal === "bandit_captain" ? 3 : 1 });
        break;
      }
      case "hag": if (boss) return Beasts.draw("crone", pal, f, false, p, pose); g = humanoid(p[0], p[1], { style: 1, hair: "#d8d8d0", head: "none", outfit: "robe_dark", weapon: "staff", aura: "nature", scars: ["pale"] }); break;
      case "siren": g = humanoid("#a8d8d0", "#3a8a9a", { style: 1, hair: "#2a6a8a", outfit: "fancy", weapon: "lute" }); break;
      case "skeleton": case "zombie": {
        const isS = body === "skeleton";
        g = humanoid(isS ? "#e8e0d0" : p[0], isS ? "#a89880" : p[1], { style: 4, outfit: isS ? "leather" : "cloak", weapon: pal === "bone_archer" ? "bow" : isS ? "sword" : "none", scars: isS ? [] : ["scar", "pale"] });
        if (pose) break;
        for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === "#1a1220" && y > 8 && y < 12 && x > 9 && x < 17) g.set(x, y, E);
        if (isS) for (let y = 15; y < 24; y += 2) g.hline(9, 16, y, "#5a5040");
        break;
      }
      default: return Beasts.draw(body, pal, f, boss, p, pose);
    }
    return g;
  }

  // ---------- banners ----------
  // emblem marks: o deep, - shade, # base, + light, * highlight. S is drawn on the 16x20 banner, L on the 24x30 one
  const EMBLEM = {
    sword: {
      S: [".......*", "......+-", ".....+-.", "..#.+-..", "...#....", "..-.#...", ".+......", "#......."],
      L: ["............*", "...........*-", "..........+-.", ".........+-..", "........+-...", ".......+-....", "..#+..+-.....", "...#++-......", "....#+.......", "...-.#+......", "..-...#......", "+#...........", "#-..........."],
    },
    skull: {
      S: [".+++#-.", "+*+###-", "+oo#oo-", "#oo#oo-", ".##o##.", ".#-#-#.", "..-.-.."],
      L: ["...+++##...", ".+*+++###-.", "+*++++####-", "+#ooo#ooo#-", "#+ooo#ooo#-", "#+oo###oo#-", ".##++o+##-.",
        "..#-#o#-#..", "..#o#o#o#..", "...-#-#-...", "..........."],
    },
    star: {
      S: ["...*...", "..+*#..", "++++##-", ".+###-.", "..##-..", ".+#.#-.", "+#...--"],
      L: [".....*.....", ".....+.....", "....+*-....", "....+#-....", "*++++##----", ".++####---.", "..+####--..",
        "..+##.##-..", ".+#-...+#-.", ".#-.....-#.", "..........."],
    },
    paw: {
      S: [".+#.+#.", ".#-.#-.", "+.....+", "#.+#-.-", ".+###-.", ".####-.", "..-.-.."],
      L: ["..+#...+#..", ".+*#-.+*#-.", ".##--.##--.", "..--...--..", "+#.......+#", "*#-.+#-.*#-", "#-.+*##-.#-", "..+*####-..", ".+######--.", ".###-.-##-.", "..--...--.."],
    },
    tree: {
      S: ["...*...", "..+#-..", ".+*#--.", "..+#-..", ".+*##-.", "+*###--", "..o#o.."],
      L: [".....*.....", "....+#-....", "...+*#--...", "....+#-....", "..+*##---..", ".+*###----.", "...+##--...", ".+*####---.", "+*#####----", "....o#o....", "...-###-..."],
    },
    moon: {
      S: ["..*+#..", ".+#-...", "+#-....", "+#-....", "##-....", ".#--...", "..-##.."],
      L: ["...+*++#...", "..+*#-.....", ".+*#-......", "+*#-.......", "+##-.......", "+##-.......", "##--.......",
        ".##--......", ".-##--.....", "..-###--...", "....----..."],
    },
    flame: {
      S: ["...+...", "..+#...", ".+##-.+", "+#+##-#", "#+*+##-", "#+**+#-", ".-###-."],
      L: [".....+.....", "....+#.....", "...+##-....", "...+##-..+.", ".+.#+#-.+-.", ".+##++###-.", "+##+*++##-.", "+##+***+##-", "+##+***+##-", ".###+*+##-.", "..-#####-.."],
    },
    crown: {
      S: ["*..*..*", "#.+#-.#", "#+###-#", "#*#*#*-", "-------"],
      L: ["*....*....*", "+-..+#-..+-", "#+..+#-..#-", "#+-+*##-+#-", "#*###+###--", "+*++####---", "#*##*##*##-", "-----------"],
    },
    eye: {
      S: ["..---..", ".-+oo-.", "-+o*o+-", ".-ooo-.", "..---.."],
      L: ["...-----...", ".--+ooo+--.", "-++ooooo++-", "-+*o*ooo++-", ".-+ooooo+-.", "..--ooo--..", "....---...."],
    },
    coin: {
      S: ["..+##..", ".+ooo-.", "+o*+#o-", "+o+#-o-", "+o#--o-", ".-ooo-.", "..---.."],
      L: ["...+###...", ".+*++##-#..", ".+*#ooo##-.", "+*#o###o#-.", "+#o##+##o#-", "+#o#+#-#o#-", "+#o##-##o#-", ".#-o###o#-.", ".-#-ooo##-.", "..-##-##-..", "....---...."],
    },
    hammer: {
      S: ["...**...", "..**++..", "..+#+++.", "...-#++-", "...#-#--", "..#..-o.", ".#......", "#......."],
      L: [".....**.....", "....**++....", "...++#+++...", "....-##+++..", ".....-##+++.", ".....+-##++-", "....+##-##--", "...+##..-oo.", "..-##....o..", ".+oo........", "-##.........", "oo.........."],
    },
    wave: {
      S: ["..+*...+", ".+*-#.+*", "+#..-##-", "-.....-.", "..+*...+", ".+*-#.+*", "+#..-##-", "-.....-."],
      L: ["..+**....+*", ".+*-#+..+*-", "+#-..-#+#-.", "-.....--...", "..+**....+*", ".+*-#+..+*-", "+#-..-#+#-.", "-.....--...", "..+**....+*", ".+*-#+..+*-", "+#-..-#+#-.", "-.....--..."],
    },
    horseshoe: {
      S: [".+***#-.", "+*#--##-", "+#-..-#-", "+#....#-", "+o....o-", "+#....#-", "*#-..-##", "--....--"],
      L: ["...++**+...", ".+*##o##+-.", "+*o-...-o#-", "+#-.....-#-", "+o-.....-o-", "+#-.....-#-", ".+o-...-o-.", ".+#-...-#-.", "+*#-...-##-", "---.....---"],
    },
    lizard: {
      S: ["..+*-..", "+.+#-.+", ".++#--.", "..+#-..", "..+#-..", ".++#--.", "+.+#-.-", "...#...", "....#..", "...-..."],
      L: ["....+#-....", "...o+##o...", "+...+#-...+", ".+-+*##-+-.", "....+##-...", "....+#--...", "....+##-...", ".+-+###-+-.", "+...+#-...+", ".....##....", "......#-...", "......-#...", ".......-#..", "........-.."],
    },
    snowflake: {
      S: ["..+++..", ".+.+.#.", "+.+*#.-", "++**---", "+.#--.-", ".#.-.-.", "..---.."],
      L: [".....+.....", "....+++....", "..+..+..#..", "...+.+.#...", ".+..+*#..-.", "++++**-----", ".+..#--..-.", "...#.-.-...", "..#..-..-..", "....---....", ".....-....."],
    },
    bolt: {
      S: ["...+**#", "..+*#-.", ".+*#-..", "+*####-", "...+#-.", "..+#-..", "..#-...", ".-....."],
      L: [".....+**#-.", "....+*##-..", "...+*##-...", "..+*##-....", ".+*##-.....", "+*#######-.", ".....+##-..", ".....+#-...", "....+#-....", "....+-.....", "...+-......", "...-.......", "..-........"],
    },
    shield: {
      S: ["+*++##-", "++#o#--", "+ooooo-", "+##o#--", ".+#o#-.", ".-#o--.", "..-o-..", "...-..."],
      L: ["+*+++++##--", "+*++#o###--", "++++#o###--", "+++##o###--", "+ooooooooo-", "++##-o-##--", "+###-o-##--", ".+##-o-#--.", ".-##-o-#--.", "..-##o--...", "...-#o-....", "....---...."],
    },
    arrows: {
      S: ["*+#...#+*", "+#.....#+", "#.+...#.#", "...+.#...", "....*....", "...#.+...", ".+#...+#.", "+#-...-+#", "#-.....-+"],
      L: ["*++#.....#++*", "++#.......#++", "+#+.......##+", "#..+.....#..#", "....+...#....", ".....+.#.....", "......*......", ".....#.+.....", "....#...+....", "..+#.....+#..", ".+#-.....-+#.", "+#-.......-+#", "#-.........-+"],
    },
    lute: {
      S: [".......+", "......+-", ".....+-.", "....+-..", ".+*+#-..", "+*+o##-.", "+#####-.", ".-###--.", "..---..."],
      L: ["..........+.", ".........+*-", "........+#o-", ".......+#-..", "......+#-...", ".....+#-....", "...++*#-....", "..+*++##-...", ".+*+oo###-..", "+*++oo####-.", "+#++####--..", ".+#####--...", "..-###--....", "...---......"],
    },
    lantern: {
      S: ["..-#-..", "..#.#..", ".+##-..", "+o**o-.", "+o*+o-.", "+o++o-.", ".+##-..", "+###--."],
      L: ["....-#-....", "....#.#....", "...+###-...", "..+*###-...", ".+-o-o-o-..", ".+o*+*+o-..", ".#o***+o-..", ".#o*+*+o-..", ".#o+*+*o-..", ".#o+++#o-..", ".+-o-o-o-..", "..+###--...", ".+*####--..", "..-----...."],
    },
  };
  const BANNER_SHAPES = ["flag", "swallow", "point", "tails", "fringe", "notch"];
  const BANNER_FIELDS = ["plain", "chief", "bordure", "end", "bars", "pale", "bend"];
  const METAL_TINCT = { gold: "#e8b84a", silver: "#d4d8e2", sable: "#3a3444", gules: "#b8323a", azure: "#243f8c" };
  const WOOD_R = ["#3e2616", "#5e3a22", "#8a5a32", "#ac7a46", "#cc9a5e"];
  const GOLD_R = ramp(GOLD);
  function dist(a, b) { const x = hexToRgb(a), y = hexToRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }
  function lum(hex) { const [r, g, b] = hexToRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

  function bannerLook(b) {
    const h = hash(String(b.c1) + "|" + String(b.c2) + "|" + b.emblem);
    const c1 = b.c1 || "#c8323c";
    let c2 = b.c2 || GOLD;
    if (c1.toLowerCase() === c2.toLowerCase()) c2 = lum(c1) > 0.5 ? mix(c1, "#1a1220", 0.45) : (h & 1 ? GOLD : METAL_TINCT.silver);
    // the old heraldic rule: a charge needs a light tincture on a dark field or a dark one on a light field
    const reads = (t, f = c1) => lum(t) >= 0.24 && Math.abs(lum(t) - lum(f)) >= 0.33 && Math.max(lum(t), lum(f)) >= 0.58 && dist(t, f) > 120;
    let tinct = c2;
    if (!reads(c2)) {
      const warm = ["flame", "coin", "crown", "star", "bolt", "lantern"].includes(b.emblem), cold = ["moon", "skull", "sword", "eye", "snowflake", "wave", "horseshoe", "shield", "hammer"].includes(b.emblem);
      const pool = lum(c1) > 0.55 ? [METAL_TINCT.gules, METAL_TINCT.azure] : warm ? [METAL_TINCT.gold] : cold ? [METAL_TINCT.silver] : [METAL_TINCT.gold, METAL_TINCT.silver];
      const ok = pool.filter((t) => reads(t));
      tinct = ok.length ? ok[(h >>> 3) % ok.length] : lum(c1) > 0.55 ? METAL_TINCT.sable : pool[(h >>> 3) % pool.length];
    }
    let field = BANNER_FIELDS[(h >>> 8) % BANNER_FIELDS.length];
    if ((field === "pale" || field === "bend") && !reads(tinct, c2)) field = "chief";
    if (tinct !== c2 && field === "plain") field = "bordure";
    if (tinct === c2 && (field === "chief" || field === "end")) field = (h >>> 12) & 1 ? "bordure" : "bars";
    return { h, c1, c2, tinct, field, shape: BANNER_SHAPES[(h >>> 16) % BANNER_SHAPES.length] };
  }

  function drawBanner(b, big) {
    const k = big ? 1.5 : 1, W = big ? 24 : 16, H = big ? 30 : 20, R = (v) => Math.round(v * k);
    const L = bannerLook(b), r1 = ramp(L.c1), r2 = ramp(L.c2), dark = lum(L.tinct) < 0.2, rnd = rng(L.h);
    const rt = dark ? ["#120e16", "#1c1820", L.tinct, mix(L.tinct, "#8a8098", 0.22), mix(L.tinct, "#a89cb8", 0.4)] : ramp(L.tinct);
    const g = new Grid(W, H), cloth = new Grid(W, H), shade = new Float32Array(W * H), zone = new Uint8Array(W * H);
    const flying = L.shape === "flag" || L.shape === "swallow";
    let x0, x1, top = [], bot = [], ex, ey, cy0, cy1;
    if (flying) {
      const px = big ? 2 : 1, pw = big ? 2 : 1;
      x0 = px + pw + 1; x1 = W - 2;
      const y0 = big ? 6 : 4, ch = R(11), phi = rnd() * 6.28, amp = big ? 1.6 : 1.1;
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / (x1 - x0), ph = t * 7 + phi, lift = Math.max(0, (t - 0.5) / 0.5);
        const dy = Math.round(amp * Math.sin(ph) * lift);
        top[x] = y0 + dy; bot[x] = y0 + ch - 1 + dy;
        const s = 0.75 * Math.cos(ph) * (0.35 + 0.65 * Math.min(1, t * 3));
        for (let y = top[x]; y <= bot[x]; y++) {
          if (L.shape === "swallow") {
            const nd = R(3.5), mid = (top[x] + bot[x]) / 2, into = x - (x1 - nd);
            if (into > 0 && Math.abs(y - mid) < into * (ch / 2) / nd - 0.2) continue;
          }
          cloth.set(x, y, 1);
          shade[y * W + x] = s + (y === top[x] ? 0.45 : 0) + (y === bot[x] ? -0.45 : 0) + (x === x0 ? -0.7 : 0);
        }
      }
      for (let y = 1; y < H; y++) for (let i = 0; i < pw; i++) g.set(px + i, y, WOOD_R[pw === 1 ? (y < 8 ? 3 : 2) : i === 0 ? 3 : 1]);
      if (big) {
        [[2, 0, 4], [3, 0, 3], [1, 1, 3], [2, 1, 4], [3, 1, 2], [4, 1, 1], [2, 2, 3], [3, 2, 1], [1, 3, 3], [2, 3, 2], [3, 3, 2], [4, 3, 0]].forEach(([x, y, i]) => g.set(x, y + 1, GOLD_R[i]));
        g.rect(1, 5, 1, 1, GOLD_R[2]); g.rect(4, 5, 1, 1, GOLD_R[1]);
      } else {
        g.set(1, 0, GOLD_R[4]); g.set(1, 1, GOLD_R[3]); g.set(0, 2, GOLD_R[3]); g.set(1, 2, GOLD_R[2]); g.set(2, 2, GOLD_R[1]);
      }
      ex = x0 + Math.round((x1 - x0) * 0.42); ey = y0 + Math.floor(ch / 2); cy0 = y0; cy1 = y0 + ch - 1;
    } else {
      const pc = W / 2 - 1, cb = big ? 5 : 3;
      x0 = big ? 4 : 3; x1 = W - 1 - x0;
      const y0 = cb + (big ? 2 : 1), yb = big ? 22 : 14, pd = R(2.6), w = x1 - x0;
      for (let y = 1; y < H; y++) { g.set(pc, y, WOOD_R[3]); g.set(pc + 1, y, WOOD_R[1]); }
      if (big) {
        [[1, 0, 4], [0, 1, 3], [1, 1, 4], [2, 1, 2], [-1, 2, 3], [0, 2, 2], [1, 2, 2], [2, 2, 1], [0, 3, 1], [1, 3, 0]].forEach(([x, y, i]) => g.set(pc + x, y, GOLD_R[i]));
      } else {
        g.set(pc, 0, GOLD_R[4]); g.set(pc + 1, 0, GOLD_R[2]); g.set(pc, 1, GOLD_R[3]); g.set(pc + 1, 1, GOLD_R[1]);
      }
      for (let x = 2; x <= W - 3; x++) { g.set(x, cb, WOOD_R[3]); if (big) g.set(x, cb + 1, WOOD_R[1]); }
      for (const ax of [1, W - 2]) { g.set(ax, cb, GOLD_R[3]); if (big) g.set(ax, cb + 1, GOLD_R[1]); }
      const tl = big ? 6 : 4;
      // tassels hang a pixel in from the canvas edge so they keep their outline
      for (const tx of big ? [2, W - 3] : [1, W - 2]) {
        for (let y = cb + 1; y < cb + tl; y++) g.set(tx, y, GOLD_R[1]);
        g.set(tx, cb + tl, GOLD_R[3]); g.set(tx, cb + tl + 1, GOLD_R[2]);
        if (big) { g.set(tx + (tx > W / 2 ? 1 : -1), cb + tl + 1, GOLD_R[1]); g.set(tx, cb + tl + 2, GOLD_R[1]); }
      }
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0) / w, c = Math.abs(u - 0.5) * 2;
        let yy = yb;
        if (L.shape === "point") yy = yb + Math.round(pd * (1 - c));
        else if (L.shape === "notch") yy = yb + Math.round(pd * c);
        else if (L.shape === "tails") yy = yb + Math.round(pd * (1 - Math.abs(((u * 3) % 1) - 0.5) * 2));
        top[x] = y0; bot[x] = yy;
        const s = 0.55 * Math.sin(u * 6.28 * 1.5 + 0.8) + (x === x0 ? 0.5 : 0) + (x === x1 ? -0.6 : 0);
        for (let y = y0; y <= yy; y++) {
          cloth.set(x, y, 1);
          shade[y * W + x] = s + (y === y0 ? -0.9 : 0) + (y >= yy - (big ? 1 : 0) ? -0.35 : 0) + (y - y0) / (yb - y0) * -0.25;
        }
      }
      if (L.shape === "fringe") for (let x = x0; x <= x1; x++) { g.set(x, yb + 1, GOLD_R[(x & 1) ? 2 : 3]); if ((x & 1) === 0 || big) g.set(x, yb + 2, GOLD_R[x & 1 ? 1 : 2]); }
      ex = Math.floor((x0 + x1) / 2) + 1; ey = y0 + Math.round((yb - y0) * 0.5); cy0 = y0; cy1 = yb;
    }
    const inC = (x, y) => !!cloth.get(x, y);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!inC(x, y)) continue;
      const u = (x - x0) / (x1 - x0), v = (y - top[x]) / Math.max(1, bot[x] - top[x]);
      let z = 0;
      const edge = !inC(x - 1, y) || !inC(x + 1, y) || !inC(x, y - 1) || !inC(x, y + 1) || (big && (!inC(x - 1, y - 1) || !inC(x + 1, y + 1) || !inC(x + 1, y - 1) || !inC(x - 1, y + 1)));
      switch (L.field) {
        case "chief": z = v < 0.24 ? 1 : 0; break;
        case "bordure": z = edge ? 1 : 0; break;
        case "end": z = flying ? (u > 0.74 ? 1 : 0) : (y > (big ? 19 : 12) ? 1 : 0); break;
        case "bars": { const yy = y - top[x], hh = bot[x] - top[x]; z = flying ? (yy === 1 || yy === hh - 1 || (big && (yy === 2 || yy === hh - 2)) ? 1 : 0) : (x - x0 === 1 || x1 - x === 1 ? 1 : 0); break; }
        case "pale": z = u > 0.5 ? 1 : 0; break;
        case "bend": z = u * 1.2 + v > 1.1 ? 1 : 0; break;
      }
      zone[y * W + x] = z;
    }
    const em = (EMBLEM[b.emblem] || EMBLEM.star)[big ? "L" : "S"];
    const eh = em.length, ew = em[0].length, ox = ex - Math.floor(ew / 2);
    // under a chief the charge drops into the open field below it
    const oy = L.field === "chief" ? Math.max(ey - Math.floor(eh / 2), Math.min(cy0 + Math.ceil((cy1 - cy0) * 0.24) + 1, cy1 - eh)) : ey - Math.floor(eh / 2);
    const emb = new Grid(W, H);
    em.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") emb.set(ox + i, oy + j, ch); }));
    // a light charge gets a dark rim; a dark charge on a light field is crisp enough without one
    const rim = lum(L.tinct) > lum(L.c1) - 0.1;
    const MARK = { o: 0, "-": 1, "#": 2, "+": 3, "*": 4 };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!inC(x, y)) continue;
      const i = y * W + x, s = shade[i] + ((x + y) & 1 ? 0.05 : -0.05) * (big ? 1 : 0);
      const fr = zone[i] ? r2 : r1;
      let idx = s > 0.85 ? 4 : s > 0.32 ? 3 : s < -0.85 ? 0 : s < -0.32 ? 1 : 2;
      if (fr === r1 && idx === 4 && !big) idx = 3;
      const m = emb.get(x, y);
      if (m) {
        let ei = MARK[m];
        if (big && ei > 0) ei = Math.max(1, Math.min(4, ei + (shade[i] > 0.6 ? 1 : shade[i] < -0.6 ? -1 : 0)));
        // a dark charge is voided: its inner marks show the field through
        g.set(x, y, ei ? rt[ei] : dark ? fr[3] : mix(rt[0], OUTLINE, 0.45));
        continue;
      }
      const at = (dx, dy) => !!emb.get(x + dx, y + dy);
      // the charge casts a shadow down and to the right; the large banner also gets a thin rim on every side
      const near = rim && (at(-1, 0) || at(0, -1) || at(-1, -1) || (big && (at(1, 0) || at(0, 1))));
      g.set(x, y, near ? mix(fr[0], OUTLINE, 0.35) : fr[idx]);
    }
    g.outline(OUTLINE);
    return g;
  }

  function drawGrave(name) {
    const g = new Grid(14, 16);
    const st = ramp("#8a8494");
    g.rect(2, 3, 10, 11, st[2]); g.rect(3, 2, 8, 1, st[2]); g.rect(4, 1, 6, 1, st[3]); g.rect(2, 3, 2, 11, st[3]); g.rect(10, 3, 2, 11, st[1]);
    g.rect(6, 4, 2, 6, st[0]); g.rect(4, 6, 6, 2, st[0]); g.rect(0, 14, 14, 2, "#3a5a3a"); g.set(1, 13, "#5a8a4a"); g.set(12, 13, "#5a8a4a");
    g.outline(OUTLINE);
    return g;
  }

  // the target dummy on party pages: a straw-stuffed sack on a post, bullseye on the chest, a dented pot for a helmet
  function drawDummy() {
    const R = Paint.ramp, P = new Paint.Paint(24, 32);
    const M = { wood: R("#7a5232"), sack: R("#b8986a"), straw: R("#d8b450"), rope: R("#8a6a40"), red: R("#b0303a"), cream: R("#ece0c4"),
      pot: R("#5e5c6a"), dirt: R("#6a5034"), grass: R("#5a8a3a") };
    P.layer = 1;
    P.ell(12, 30.6, 6.5, 1.9, "dirt", { s: -0.15 });
    P.rect(11, 20, 2, 11, "wood", (x) => (x === 11 ? 0.3 : -0.35));
    P.rect(1, 12, 22, 2, "wood", (x, y) => (y === 12 ? 0.35 : -0.3) - (x - 12) * 0.02);
    P.layer = 2;
    P.ell(12, 16.5, 5.8, 6.6, "sack", { s: 0.05 });
    P.ell(12, 6.2, 3.6, 3.3, "sack", { s: 0.1 });
    P.rect(11, 9, 2, 1, "sack", -0.25);
    for (const [x, y, s] of [[8, 12, 0.2], [15, 12, -0.1], [9, 20, -0.1], [14, 21, -0.4]]) P.px(x, y, "sack", s - 0.5);
    P.ell(12, 16, 4.3, 4.3, "red", { k: 0.35, s: 0.05 });
    P.ell(12, 16, 3.2, 3.2, "cream", { k: 0.35, s: 0.15 });
    P.ell(12, 16, 2.1, 2.1, "red", { k: 0.3, s: 0.1 });
    P.rect(11, 15, 2, 2, "cream", (x, y) => (x === 11 && y === 15 ? 0.6 : 0.2));
    P.layer = 3;
    P.rect(10, 9, 4, 1, "rope", (x) => 0.25 - (x - 10) * 0.2);
    P.rect(7, 21, 10, 1, "rope", (x) => 0.3 - (x - 7) * 0.08);
    for (const [x, y] of [[10, 6], [13, 6]]) P.px(x, y, "#3a2a1a");
    for (const x of [10, 12, 13]) P.px(x, 8, "#5a4028");
    P.layer = 4;
    P.ell(12, 4, 4.2, 2.6, "pot", { s: 0.15, fn: (x, y) => (y > 4 ? false : undefined) });
    P.rect(7, 4, 10, 1, "pot", (x) => 0.1 - (x - 7) * 0.06);
    P.rect(17, 3, 3, 1, "pot", -0.2);
    P.px(10, 2, "pot", -0.75); P.px(11, 3, "pot", -0.6);
    for (const [x, y, s] of [[0, 11, 0.3], [0, 13, 0.1], [0, 14, -0.2], [1, 15, -0.3], [23, 11, 0], [23, 14, -0.4], [22, 15, -0.5], [23, 12, -0.2]]) P.px(x, y, "straw", s);
    for (const [x, y, s] of [[9, 23, 0.2], [10, 24, 0], [12, 23, -0.1], [14, 24, -0.4], [15, 23, -0.3], [8, 22, 0.1]]) P.px(x, y, "straw", s);
    for (const [x, y, s] of [[7, 29, 0.3], [6, 28, 0.4], [16, 29, 0], [17, 28, 0.2], [14, 29, -0.2]]) P.px(x, y, "grass", s);
    return P.render(M, { outline: OUTLINE });
  }

  const ITEM = {
    ration: ["#c89a5a", "loaf"], potion: ["#e84a5a", "flask"], bandage: ["#f0e8d8", "roll"], rope: ["#b08a5a", "coil"], herbs: ["#5ab04a", "leaf"],
    rare_herb: ["#b8a0f0", "leaf"], fish: ["#8ab0c8", "fish"], pelt: ["#9a6a42", "hide"], fang: ["#f0e8d0", "fang"], goblin_ear: ["#6aa04a", "ear"],
    chitin: ["#3a3440", "shard"], bones: ["#e8e0d0", "bone"], remains: ["#7a6a5a", "sack"], grave_dust: ["#9a9aa0", "pile"], ectoplasm: ["#7af08a", "flask"],
    wisp_light: ["#c8f0ff", "flask"], troll_hide: ["#6a7a6a", "hide"], ore: ["#8a7a6a", "rock"], gem: ["#5ad0f0", "gem"], trinket: ["#e8b84a", "ring"],
    stolen_goods: ["#7a5a8a", "sack"], drake_scale: ["#c84a3a", "shard"], frost_crystal: ["#9ae8ff", "gem"], ember_core: ["#ff8a2a", "gem"],
    relic: ["#5ab8a8", "gem"], dragon_scale: ["#e8b84a", "shard"], gold: ["#ffd84a", "coin"],
  };
  // painted with the shared shader so items share the heroes' top-left light, ramps and outline
  function drawItem(id) {
    const [col, shape] = ITEM[id] || ["#aaaaaa", "rock"];
    const P = new Paint.Paint(12, 12), W = "#ffffff";
    const M = { c: ramp(col), glass: ramp("#c8d8e8"), cork: ramp("#8a6a42"), gold: ramp("#d8a838"), rope: ramp("#c8a070"), gem: ramp("#5ad0f0"), dk: ramp(mix(col, "#14101c", 0.45)) };
    const ring = (cx, cy, r, sh) => { for (let a = 0; a < 24; a++) P.px(cx + Math.cos(a / 24 * 6.283) * r, cy + Math.sin(a / 24 * 6.283) * r, "c", sh); };
    switch (shape) {
      case "flask": P.rect(5, 1, 2, 3, "glass", (x) => 0.3 - (x - 5) * 0.4); P.rect(5, 0, 2, 1, "cork", 0.2); P.ell(6, 7.5, 3.9, 3.7, "c", { s: 0.05 }); P.rect(3, 5, 6, 1, "c", 0.5); P.px(4, 6, W); P.px(4, 7, W); break;
      case "loaf": P.ell(6, 7.4, 5.2, 3.2, "c", { s: 0.1 }); for (const x of [4, 6, 8]) { P.px(x, 6, "c", -0.6); P.px(x + 1, 5, "c", -0.6); } P.px(3, 5, W); break;
      case "leaf": P.poly([[2, 11], [3, 5], [9, 1], [10, 5], [5, 10]], "c", (x, y) => 0.35 - (x + y - 8) * 0.06); P.line(2.5, 10.5, 9, 2, "dk", 0); P.px(4, 5, W); break;
      case "hide": P.poly([[1, 2], [4, 3], [8, 2], [11, 3], [10, 6], [11, 10], [7, 9], [5, 10], [1, 10], [2, 6]], "c", (x, y) => 0.3 - (x + y - 8) * 0.06 + ((x * 3 + y * 5) % 7 === 0 ? -0.4 : 0)); P.px(3, 4, W); break;
      case "fang": P.poly([[3, 1], [9, 1], [8, 5], [6, 11], [4.5, 5]], "c", (x) => 0.4 - (x - 3) * 0.12); P.rect(3, 1, 6, 1, "dk", 0); P.px(5, 3, W); break;
      case "bone": P.line(3, 9, 9, 3, "c", 0.1, 1.1); for (const [x, y] of [[2.5, 8.5], [3.5, 9.5], [8.5, 2.5], [9.5, 3.5]]) P.ell(x, y, 1.4, 1.4, "c", { s: 0.15 }); P.px(7, 3, W); break;
      case "sack": P.ell(6, 8, 4.5, 3.6, "c", { s: 0.05 }); P.poly([[4.5, 4.5], [7.5, 4.5], [8.5, 2], [3.5, 2]], "c", 0.2); P.rect(4, 4, 4, 1, "rope", 0.2); P.px(4, 7, W); break;
      case "rock": P.ell(6, 7.5, 4.8, 3.8, "c", { s: 0.05, fn: (x, y, s) => (x + y * 2) % 9 === 0 ? s - 0.5 : s }); P.px(5, 7, "gold", 0.5); P.px(8, 8, "gold", 0.3); P.px(4, 5, W); break;
      case "gem": P.poly([[6, 1], [11, 5], [6, 11], [1, 5]], "c", (x, y) => (y < 5 ? 0.7 : 0) + (x < 6 ? 0.25 : -0.35)); P.line(1.5, 5, 10.5, 5, "c", 0.9); P.px(4, 3, W); P.px(5, 2, W); break;
      case "ring": P.ell(6, 7.5, 4, 3.6, "c", { s: 0.1, fn: (x, y, s) => (((x + 0.5 - 6) / 2) ** 2 + ((y + 0.5 - 7.5) / 1.8) ** 2 <= 1 ? false : s) }); P.ell(6, 3, 1.7, 1.5, "gem", { s: 0.3 }); P.px(5, 2, W); break;
      case "shard": P.poly([[2, 11], [4, 4], [10, 1], [8, 7], [5, 11]], "c", (x, y) => (x - y > -2 ? -0.35 : 0.35)); P.line(3, 10, 9, 2, "c", 0.8); P.px(5, 4, W); break;
      case "fish": P.ell(6.5, 6.5, 4.3, 2.6, "c", { s: 0.05, fn: (x, y, s) => (y > 7 ? s + 0.4 : s) }); P.poly([[0.5, 4], [3, 6.5], [0.5, 9]], "dk", 0); P.px(9, 6, "#1a1220"); P.px(5, 5, W); break;
      case "ear": P.poly([[3, 10], [3, 4], [10, 1], [8, 6], [6, 10]], "c", (x) => 0.35 - (x - 3) * 0.08); P.poly([[5, 8], [5, 5], [8, 3], [6, 7]], "c", -0.6); P.px(4, 4, W); break;
      case "coil": P.ell(6, 7, 4.8, 4.2, "c", { s: 0.05 }); ring(6, 7, 3, -0.6); ring(6, 7, 1.5, -0.6); P.px(10, 4, "c", 0.2); P.px(11, 3, "c", 0.2); P.px(4, 4, W); break;
      case "pile": P.ell(6, 9, 5.2, 2.4, "c", { s: 0 }); P.ell(6, 7.4, 3.4, 2.2, "c", { s: 0.15 }); P.ell(6, 6, 1.6, 1.2, "c", { s: 0.3 }); P.px(5, 6, W); break;
      case "roll": P.rect(2, 4, 8, 5, "c", (x, y) => 0.3 - (y - 4) * 0.15); P.ell(9.5, 6.5, 1.4, 2.5, "c", { s: -0.3 }); P.px(9, 6, "c", -0.7); P.rect(5, 4, 1, 5, "dk", 0); P.px(3, 5, W); break;
      case "coin": P.ell(6, 9, 4.2, 1.8, "c", { s: -0.3 }); P.ell(6, 6.2, 4.2, 4, "c", { s: 0.15 }); ring(6, 6.2, 2.9, -0.5); P.rect(6, 4, 1, 5, "c", 0.7); P.px(4, 4, W); break;
    }
    return P.render(M, { outline: OUTLINE });
  }

  // ---------- gear icons (16x16): the hero's own pieces drawn alone, plus jewellery, curios and worn magic ----------
  const CURIO_TINT = { shell: "#e8c8b0", figurine: "#c8b08a", jar: "#a8c8b0", coin: "#e0b040", feather: "#e8e0d0", bone: "#e0d8c4", book: "#8a3a2a", stone: "#8a8a90",
    key: "#c8a050", bottle: "#5a9a7a", flower: "#d86a8a", dice: "#ece4d4", toy: "#b0784a", letter: "#ece0c4", globe: "#bfe3ff", thimble: "#c8ccd4", tooth: "#ece4d0",
    map: "#e4d4a8", bell: "#d8a838", candle: "#ece4cc", charm: "#5aa04a", pipe: "#7a5232", spoon: "#c4cad4", button: "#a8443a", acorn: "#a87a44", egg: "#e8dcc4",
    pebble: "#9a9488", whistle: "#c4cad4", compass: "#c8963e", cards: "#ece4d4", comb: "#d8c8a0", mirror: "#d8a838", ribbon: "#c83a4a", skull_small: "#e0d8c4",
    crystal: "#9ad8f0", horn: "#d8ccb0", lens: "#c8963e", doll: "#c86a6a", flute: "#9a6a3a", ink: "#2a2a44", gauntlet: "#8a92a0", belt: "#6a3a2a", boots: "#5a3a26",
    eye: "#4aa0c8", pearl: "#f0ece4", scarf: "#a8443a", rod: "#8a6a3a" };
  const NOGEM = "#d8a838";
  function iconFit(draw, mats, maxS) {
    const T = new Paint.Paint(64, 64);
    T.tf = { ox: 32, oy: 32, cx: 0, cy: 0, s: 1 };
    draw(T);
    let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (T.mat[y * 64 + x] !== null) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, s = Math.min(maxS || 1.5, 14 / w, 14 / h);
    const P = new Paint.Paint(16, 16);
    P.tf = { ox: 8, oy: 8, cx: (x0 + x1 + 1) / 2 - 32, cy: (y0 + y1 + 1) / 2 - 32, s };
    draw(P);
    P.tf = null;
    return P;
  }
  function armorIcon(P, mat, t, glow) {
    const m = mat === "cloth" ? "robe" : mat === "leather" ? "hide" : "metal", metal = mat === "chain" || mat === "plate";
    const body = mat === "cloth" ? [[3, 3], [6, 1.5], [10, 1.5], [13, 3], [14.5, 8], [12.5, 8.5], [13, 15], [3, 15], [3.5, 8.5], [1.5, 8]] : [[3, 3], [6, 1.5], [10, 1.5], [13, 3], [14.5, 7.5], [12.5, 8], [12, 14], [4, 14], [3.5, 8], [1.5, 7.5]];
    P.poly(body, m, (x, y) => 0.35 - (x - 4) * 0.07 - (y - 2) * 0.03 + (mat === "chain" && (x + y * 2) % 3 === 0 ? -0.45 : 0));
    P.ell(8, 2, 2.4, 1.6, "#1e1824");
    if (mat === "plate") { for (const sx of [3.6, 12.4]) P.ell(sx, 4, 2.4, 2, "metal", { s: sx < 8 ? 0.35 : -0.1 }); P.rect(5, 11, 6, 1, "metal", -0.6); P.px(6, 5, "metal", 1); P.px(6, 6, "metal", 0.9); }
    if (mat === "leather") { P.line(4, 4, 11, 13, "dleather", -0.1); P.rect(4, 11, 8, 1, "dleather", -0.2); P.px(7, 11, "gold", 0.3); }
    if (mat === "chain") P.rect(4, 13, 8, 1, "metal", 0.5);
    if (mat === "cloth") { P.rect(4, 9, 9, 1, t === 1 ? "dleather" : "gold", 0.1); P.poly([[6.5, 2.5], [9.5, 2.5], [8, 5]], "#1e1824"); }
    if (t === 1) { if (metal) for (const [x, y] of [[6, 8], [10, 6], [9, 11]]) P.px(x, y, "metal", -0.9); else P.rect(9, 10, 2, 2, "patch", 0.1); }
    if (t === 3) { if (metal) for (const [x, y] of [[4, 6], [11, 6], [4, 10], [11, 10]]) P.px(x, y, "metal", 0.95); else if (mat === "leather") for (const [x, y] of [[5, 6], [10, 6], [6, 9], [10, 10]]) P.px(x, y, "omet", 0.7); else P.rect(3, 14, 10, 1, "shirt", 0.1); }
    if (t >= 4) { for (let x = 4; x <= 12; x++) if (x < 6 || x > 10) P.px(x, 2, "gold", 0.3); P.rect(4, mat === "cloth" ? 14 : 13, 8, 1, "gold", 0.1); }
    const rc = glow || (t === 5 ? { cloth: "#fff0b0", leather: "#8ae0c8", chain: "#c8f0ff", plate: "#ffb850" }[mat] : null);
    if (rc) for (const [x, y] of [[6, 6], [10, 8], [7, 11]]) P.px(x, y, rc);
  }
  function ringIcon(P, art, gem) {
    const band = art === "band";
    P.ell(8, 9.5, 5, 4.4, band ? "copper" : "gold", { s: 0.1, fn: (x, y, s) => (((x + 0.5 - 8) / (band ? 2.8 : 3.2)) ** 2 + ((y + 0.5 - 9.5) / (band ? 2.4 : 2.8)) ** 2 <= 1 ? false : s) });
    if (art === "signet") { P.rect(5, 3, 6, 3, "gold", (x) => 0.4 - (x - 5) * 0.12); P.rect(6, 4, 4, 1, gem ? "gem" : "gold", gem ? 0.2 : -0.5); }
    else if (art === "ring") { P.ell(8, 4.2, 2.3, 2.1, gem ? "gem" : "gold", { s: 0.35 }); P.px(7, 3, "#ffffff"); }
    else { P.px(5, 7, "copper", 0.9); if (gem) P.px(8, 5, "gem", 0.5); }
  }
  function neckIcon(P, art) {
    const arc = (dx) => 2 + (1 - (dx / 6) ** 2) * 6;
    const chain = (m) => { for (let dx = -6; dx <= 6; dx += 0.5) P.px(8 + dx, arc(dx), m, 0.3 - dx * 0.05 + (Math.round(dx) % 2 ? -0.3 : 0)); };
    switch (art) {
      case "amulet": chain("gold"); P.ell(8, 11, 3, 3, "gold", { s: 0.2 }); P.ell(8, 11, 1.8, 1.8, "gem", { s: 0.35 }); P.px(7, 10, "#ffffff"); break;
      case "pendant": chain("dmetal"); P.poly([[8, 8.5], [10, 11.5], [8, 14.5], [6, 11.5]], "gem", (x, y) => 0.4 - (x - 6) * 0.15 - (y - 9) * 0.05); P.px(7, 11, "#ffffff"); break;
      case "locket": chain("gold"); P.ell(8, 11.5, 2.8, 3.2, "gold", { s: 0.15 }); P.rect(6, 11, 4, 1, "gold", -0.6); P.px(7, 10, "gold", 1); break;
      case "torc": for (let a = 1.05; a <= 5.25; a += 0.08) { const x = 8 + Math.sin(a) * 5.2, y = 7 + Math.cos(a) * 5; P.ell(x, y, 1, 1, "gold", { s: 0.45 - (x - 4) * 0.08 - (y - 3) * 0.05, k: 0.4 }); }
        P.ell(12.6, 10.4, 2.2, 2.2, "gold", { s: 0.05 }); P.ell(3.4, 10.4, 2.2, 2.2, "gold", { s: 0.45 }); P.px(3, 9, "#ffffff"); P.px(4, 2, "#ffffff"); break;
      case "beads": for (let dx = -6; dx <= 6; dx += 1.7) P.ell(8 + dx, arc(dx) + 0.5, 1.1, 1.1, Math.round(dx * 10) % 3 === 0 ? "cream" : "gem", { s: 0.2 }); break;
      case "brooch": P.ell(8, 8, 5.5, 5.5, "gold", { s: 0.2 }); P.ell(8, 8, 3.4, 3.4, "gem", { s: 0.35 }); P.px(6, 6, "#ffffff"); P.line(2, 13, 14, 3, "dmetal", 0.4); break;
      case "chain_neck": for (let dx = -6; dx <= 6; dx++) { P.px(8 + dx, arc(dx), "gold", dx % 2 ? -0.3 : 0.7); P.px(8 + dx, arc(dx) + 1, "gold", dx % 2 ? 0.4 : -0.4); } break;
      case "holy_pendant": chain("gold"); P.rect(7.5, 8, 1, 7, "gold", 0.3); P.rect(5, 10, 6, 1, "gold", 0.1); P.px(7.5, 10, "gem", 0.5); break;
      case "fang_necklace": chain("dleather"); for (const dx of [-4, 0, 4]) P.poly([[8 + dx - 1.2, arc(dx)], [8 + dx + 1.2, arc(dx)], [8 + dx, arc(dx) + 4.5]], "bone", 0.35 - dx * 0.04); break;
      case "scarf": {
        const knit = (x, y) => 0.25 - (x - 3) * 0.05 + ((x + y) % 3 === 0 ? -0.55 : 0);
        P.ell(8, 4.5, 6.4, 3.6, "gem", { s: 0.3, fn: (x, y, s) => (((x + 0.5 - 8) / 3.6) ** 2 + ((y + 0.5 - 4.3) / 1.3) ** 2 < 1 ? false : knit(x, y) + s * 0.3) });
        P.poly([[9, 6.5], [11.8, 6.5], [10.6, 14], [7.8, 13.6]], "gem", (x, y) => -0.05 + (y % 3 === 0 ? -0.6 : 0));
        P.poly([[10.5, 7], [13, 7.5], [14, 13], [11.4, 13.4]], "gem", (x, y) => 0.25 + (y % 3 === 1 ? -0.6 : 0));
        for (const [x, y] of [[8, 14.6], [9.5, 14.8], [12, 14], [13.5, 13.8]]) P.px(x, y, "gem", -0.3);
        break;
      }
      case "pearl": for (let dx = -6; dx <= 6; dx += 1.5) P.ell(8 + dx, arc(dx) + 0.5, 0.9, 0.9, "#f4f0e6", { s: 0.2 }); P.ell(8, 10.5, 1.6, 1.6, "#f4f0e6"); P.px(7, 10, "#ffffff"); break;
    }
  }
  function curioIcon(P, art) {
    const W = "#ffffff", px = (x, y, m, s) => P.px(x, y, m, s);
    switch (art) {
      case "shell":
        P.ell(8, 12, 6.8, 9.5, "c", { s: 0.3, fn: (x, y, s) => (y > 11 ? false : s) });
        for (const [x1, y1] of [[2, 9], [3.6, 5.6], [6, 3.2], [8.5, 2.5], [11, 3.4], [13.3, 6], [14.3, 9.4]]) P.line(8, 11.5, x1, y1, "c", -0.7);
        for (let x = 1; x <= 15; x += 2) { const t = (x + 0.5 - 8) / 6.8; if (Math.abs(t) < 1) P.px(x, Math.round(12 - Math.sqrt(1 - t * t) * 9.5), "c", 0.8); }
        P.poly([[5.5, 11], [10.5, 11], [9.5, 14.5], [6.5, 14.5]], "c", -0.1); P.rect(3, 11, 3, 2, "c", 0.2); P.rect(10, 11, 3, 2, "c", -0.35); break;
      case "figurine": P.rect(4, 13, 8, 2, "dk", 0); P.poly([[6, 6], [10, 6], [11, 13], [5, 13]], "c", (x) => 0.3 - (x - 5) * 0.12); P.ell(8, 4, 2.2, 2.2, "c", { s: 0.25 }); P.rect(5, 8, 1, 3, "c", 0.2); px(7, 3, W); break;
      case "jar": P.ell(8, 10, 4.8, 4.6, "c", { s: 0.15 }); P.rect(6, 4, 4, 2, "c", 0.1); P.rect(5, 3, 6, 1, "wood", 0.2); P.rect(4.5, 9, 7, 2, "cream", 0.1); px(5, 7, W); break;
      case "coin": P.ell(8, 10.6, 5.4, 2.4, "coin", { s: -0.45 }); P.ell(8, 7.8, 5.4, 5.2, "coin", { s: 0.25 }); for (let a = 0; a < 28; a++) px(8 + Math.cos(a / 28 * 6.283) * 3.9 - 0.5, 7.8 + Math.sin(a / 28 * 6.283) * 3.7 - 0.5, "coin", -0.55);
        P.rect(7, 5, 2, 6, "coin", (x) => (x === 7 ? 0.8 : 0.2)); px(5, 4, W); px(4, 5, mix("#ffffff", "#e8c060", 0.4)); break;
      case "feather": P.poly([[3.5, 13], [10, 2], [13.5, 3.5], [6, 13.5]], "c", (x, y) => 0.35 - (x - y) * 0.03); P.line(2, 15, 12, 2.5, "cream", 0.5); for (const [x, y] of [[7, 7], [9, 5], [6, 10]]) px(x + 2, y + 1, "c", -0.6); break;
      case "bone": P.line(4, 12, 12, 4, "c", 0.1, 1.4); for (const [x, y] of [[3, 11.5], [4.5, 13], [11.5, 3], [13, 4.5]]) P.ell(x, y, 1.8, 1.8, "c", { s: 0.15 }); px(10, 3, W); break;
      case "book": P.rect(3, 2, 10, 12, "c", (x) => 0.3 - (x - 3) * 0.08); P.rect(12, 3, 1, 10, "cream", 0); P.rect(3, 2, 2, 12, "dk", 0); P.ell(8.5, 7.5, 1.8, 1.8, "gold", { s: 0.3 }); break;
      case "stone": P.ell(8, 9, 6, 5, "c", { s: 0.1, fn: (x, y, s) => s + ((x * 3 + y * 5) % 7 === 0 ? -0.45 : 0) }); px(5, 6, W); break;
      case "key": P.ell(5, 5, 3.4, 3.4, "c", { s: 0.25, fn: (x, y, s) => ((x + 0.5 - 5) ** 2 + (y + 0.5 - 5) ** 2 < 2.2 ? false : s) }); P.line(7, 7, 13.5, 13.5, "c", 0.2, 0.7); P.rect(11, 13, 2, 2, "c", -0.1); P.rect(13, 11, 2, 2, "c", -0.2); break;
      case "bottle": P.rect(7, 1, 2, 4, "glass", 0.3); P.rect(7, 0, 2, 1, "wood", 0.2); P.poly([[5, 6], [11, 6], [12, 15], [4, 15]], "glass", (x) => 0.35 - (x - 4) * 0.08); P.poly([[4.5, 10], [11.5, 10], [12, 15], [4, 15]], "c", (x) => 0.2 - (x - 4) * 0.08); px(6, 7, W); break;
      case "flower": P.line(8, 15, 8, 8, "leaf", 0); P.ell(10.5, 11, 2, 1, "leaf", { s: 0.1 }); for (let a = 0; a < 5; a++) P.ell(8 + Math.cos(a * 1.257) * 2.8, 5.5 + Math.sin(a * 1.257) * 2.8, 1.9, 1.9, "c", { s: 0.25 - a * 0.1 }); P.ell(8, 5.5, 1.3, 1.3, "gold", { s: 0.4 }); break;
      case "dice": P.poly([[3, 5], [8, 2.5], [13, 5], [8, 7.5]], "c", 0.6); P.poly([[3, 5], [8, 7.5], [8, 14], [3, 11.5]], "c", 0.1); P.poly([[8, 7.5], [13, 5], [13, 11.5], [8, 14]], "c", -0.4); for (const [x, y] of [[8, 4.6], [4.5, 7.5], [6.5, 11], [10, 8], [11.5, 10.5]]) px(x, y, "#2a1a22"); break;
      case "toy": P.ell(8, 8, 4.5, 2.6, "c", { s: 0.15 }); P.poly([[11, 7], [13, 3], [15, 4], [13.5, 8]], "c", 0.2); px(14, 4, "#16121a"); for (const x of [5, 10]) { P.rect(x, 10, 1, 3, "c", -0.2); P.ell(x + 0.5, 13.5, 1.3, 1.3, "dk", { s: 0 }); } P.line(3.5, 7, 2, 9, "dk", 0); break;
      case "letter": P.rect(2, 4, 12, 9, "c", (x, y) => 0.25 - (y - 4) * 0.04); P.line(2, 4, 8, 9, "c", -0.5); P.line(14, 4, 8, 9, "c", -0.5); P.ell(8, 9.5, 1.8, 1.8, "crim", { s: 0.3 }); break;
      case "globe": P.rect(4, 12, 8, 3, "wood", (x) => 0.3 - (x - 4) * 0.08); P.ell(8, 7, 5.2, 5.2, "c", { s: 0.25 }); P.rect(7, 6, 2, 5, "dmetal", 0.1); P.px(7.5, 5, "dmetal", 0.3); for (const [x, y] of [[5, 6], [10, 5], [6, 9], [10, 9], [9, 3]]) px(x, y, W); break;
      case "thimble": P.ell(8, 5, 3.6, 2.4, "c", { s: 0.3 }); P.poly([[4.5, 5], [11.5, 5], [12.5, 13], [3.5, 13]], "c", (x) => 0.35 - (x - 3.5) * 0.08); for (let y = 6; y < 12; y += 2) for (let x = 5 + (y % 4 === 0 ? 1 : 0); x < 12; x += 2) px(x, y, "c", -0.6); P.rect(3.5, 12, 9, 1.5, "c", 0.5); break;
      case "tooth": P.poly([[4, 3], [12, 3], [12.5, 8], [10.5, 14], [9, 9.5], [7, 9.5], [5.5, 14], [3.5, 8]], "c", (x) => 0.35 - (x - 4) * 0.08); px(5, 4, W); break;
      case "map": P.poly([[2, 3], [8, 2], [14, 3], [14, 13], [8, 14], [2, 13]], "sheet", (x) => (x < 8 ? 0.35 - (x - 2) * 0.03 : -0.05 - (x - 8) * 0.03)); P.line(8, 2.5, 8, 13.5, "sheet", -0.6);
        for (const [x, y] of [[4, 11], [5, 10], [6, 10], [7, 9], [9, 8], [10, 7]]) px(x, y, "dk", -0.2); for (const [x, y] of [[10, 4], [12, 6], [11, 5], [10, 6], [12, 4]]) px(x, y, "crim", 0.3); break;
      case "bell": P.ell(8, 2.2, 1.6, 1.6, "c", { s: 0, fn: (x, y, s) => ((x + 0.5 - 8) ** 2 + (y + 0.5 - 2.2) ** 2 < 1 ? false : s) }); P.poly([[5, 11], [5.5, 5.5], [8, 3.5], [10.5, 5.5], [11, 11]], "c", (x) => 0.35 - (x - 5) * 0.1); P.rect(3.5, 11, 9, 2, "c", (x) => 0.4 - (x - 3.5) * 0.1); P.ell(8, 13.6, 1.3, 1.3, "dk", { s: 0 }); px(6, 6, W); break;
      case "candle": P.ell(8, 14, 5, 1.6, "omet", { s: 0 }); P.rect(6, 6, 4, 8, "c", (x) => 0.3 - (x - 6) * 0.2); P.rect(10, 7, 1, 3, "c", -0.2); px(8, 5, "#3a2a22"); P.ell(8, 3, 1.2, 2, "flame", { s: 0.5 }); px(8, 3, "#fff2b0"); break;
      case "charm":
        P.line(8, 0.5, 8, 4, "c", 0.3); P.ell(8, 4.4, 1.6, 1.1, "c", { s: 0.3 });
        for (let a = 1.25; a <= 5.03; a += 0.06) { const x = 8 + Math.sin(a) * 4.6, y = 10 - Math.cos(a) * 4.6; P.ell(x, y, 1.35, 1.35, "iron", { s: 0.45 - (x - 4) * 0.08 - (y - 6) * 0.05, k: 0.4 }); }
        P.rect(2.5, 8, 2, 1, "iron", 0.6); P.rect(11.5, 8, 2, 1, "iron", 0.1);
        for (const [x, y] of [[4, 8], [4, 11], [12, 8], [12, 11]]) px(x, y, "#2a2228"); px(5, 13, W); break;
      case "pipe": P.rect(10, 4, 4, 7, "c", (x) => 0.3 - (x - 10) * 0.15); P.rect(10, 4, 4, 1, "#2a1a10"); P.line(2, 11.5, 10, 10, "dk", 0, 0.6); px(11, 2, "#c8c8d0"); px(12, 1, "#a8a8b0"); break;
      case "spoon": P.line(6.5, 7.5, 13.5, 14.5, "spoon", 0.2, 0.55); P.ell(14, 14.5, 1, 1, "spoon", { s: 0 }); P.ell(4.6, 4.6, 2.4, 3.4, "spoon", { s: 0.35 }); P.ell(4.8, 4.8, 1.3, 2.1, "spoon", { s: -0.4 }); px(3, 3, W); break;
      case "button": P.ell(8, 8, 5.5, 5.5, "c", { s: 0.2 }); for (let a = 0; a < 28; a++) px(8 + Math.cos(a / 28 * 6.283) * 4 - 0.5, 8 + Math.sin(a / 28 * 6.283) * 4 - 0.5, "c", -0.4); for (const [x, y] of [[6, 6], [9, 6], [6, 9], [9, 9]]) px(x, y, "#2a1a22"); break;
      case "acorn": P.ell(8, 10, 3.6, 4.2, "c", { s: 0.2 }); P.ell(8, 5.5, 4.8, 2.8, "wood", { s: 0.1, fn: (x, y, s) => s + ((x + y) % 2 ? -0.35 : 0.1) }); P.rect(8, 1, 1, 2, "wood", 0); px(6, 9, W); break;
      case "egg": P.ell(8, 8.8, 4.4, 5.6, "eggc", { s: 0.25, fn: (x, y, s) => s + ((x * 7 + y * 3) % 13 === 0 ? -0.5 : 0) }); px(6, 5, W); px(6, 6, W); px(7, 5, mix("#ffffff", "#e8dcc4", 0.5)); break;
      case "pebble": P.ell(8, 10, 5.6, 3.6, "c", { s: 0.15 }); px(6, 8, W); break;
      case "whistle": P.rect(1, 7, 4, 2, "c", (x, y) => (y === 7 ? 0.5 : 0)); P.ell(9.5, 9, 4.5, 4, "c", { s: 0.25 }); P.rect(5, 6, 5, 3, "c", (x, y) => 0.45 - (y - 6) * 0.2); P.rect(7, 6, 2, 1, "#2a1a22"); P.ell(9.5, 9.5, 1.6, 1.4, "dk", { s: -0.3 }); px(8, 6, W);
        P.ell(13.5, 4, 1.5, 1.5, "c", { s: 0.2, fn: (x, y, s) => ((x + 0.5 - 13.5) ** 2 + (y + 0.5 - 4) ** 2 < 0.7 ? false : s) }); break;
      case "compass": P.ell(8, 8.5, 6, 6, "c", { s: 0.2 }); P.ell(8, 8.5, 4.4, 4.4, "cream", { s: 0.2 }); P.line(6, 11, 8, 8.5, "dk", 0); P.line(8, 8.5, 10.5, 5.5, "crim", 0.2); P.rect(7, 1.5, 2, 1.5, "c", 0.3); break;
      case "cards": P.poly([[3, 4.5], [8.5, 3], [10.5, 12.5], [5, 14]], "cream", (x) => 0.1 - x * 0.02); P.poly([[6.5, 2.5], [12.5, 3], [12, 13], [6, 12.5]], "cream", 0.3); P.ell(9.3, 7.5, 1.4, 1.6, "crim", { s: 0.3 }); px(7, 4, "crim", 0.2); break;
      case "comb": P.rect(2, 4, 12, 3, "c", (y) => 0.3); for (let x = 2; x < 14; x += 2) P.rect(x, 7, 1, 5, "c", -0.1 - x * 0.02); px(3, 4, W); break;
      case "mirror": P.rect(7, 11, 2, 4, "gold", (x) => (x === 7 ? 0.4 : -0.1)); P.rect(6, 14, 4, 1, "gold", 0); P.ell(8, 6, 5.4, 5.6, "gold", { s: 0.2 }); P.ell(8, 6, 4, 4.2, "glass", { s: 0.5, fn: (x, y, s) => s + (x + y < 12 ? 0.4 : 0) - (x - y > 3 ? 0.4 : 0) });
        P.line(5, 7, 8, 3.5, "#ffffff"); px(6, 8, W); break;
      case "ribbon": P.poly([[8, 7], [3, 3], [2, 9]], "c", 0.35); P.poly([[8, 7], [13, 3], [14, 9]], "c", -0.2); P.poly([[7, 8], [5, 14], [7, 13], [8, 15], [8.5, 8]], "c", 0); P.poly([[8.5, 8], [11, 14], [9.5, 14], [9, 8]], "c", -0.3); P.ell(8, 7.5, 1.3, 1.3, "c", { s: 0.5 }); break;
      case "skull_small": P.ell(8, 6.8, 5, 4.8, "c", { s: 0.2 }); P.rect(5.5, 10, 5, 3, "c", 0); P.ell(6, 7, 1.4, 1.4, "#1e1824"); P.ell(10, 7, 1.4, 1.4, "#1e1824"); px(8, 9, "#1e1824"); for (const x of [6, 8, 10]) px(x, 12, "#1e1824"); break;
      case "crystal": P.poly([[6, 15], [5, 6], [8, 1], [10, 6], [9.5, 15]], "cyan", (x) => (x < 8 ? 0.55 : -0.2)); P.line(8, 2, 7, 14, "cyan", 0.9); P.poly([[3, 15], [2.5, 9], [4.5, 7], [6, 15]], "cyan", 0.2); P.poly([[10, 15], [11, 8], [13.5, 10], [13, 15]], "cyan", -0.35); px(6, 5, W); break;
      case "horn": P.tube([[3.5, 4.5], [5, 8], [7.5, 10.5], [10.5, 11.5], [13, 10.5], [14.5, 8.5]], 3.4, 0.9, "ivory", 0.25); P.rect(5, 4, 1, 6, "gold", 0.4); P.rect(6, 5, 1, 6, "gold", 0); P.ell(3.4, 4.2, 2.6, 2.4, "#3a2a1e"); P.px(4, 11, W); break;
      case "lens": P.line(9.5, 9.5, 14, 14, "wood", 0, 0.9); P.ell(6.5, 6.5, 4.8, 4.8, "c", { s: 0.2 }); P.ell(6.5, 6.5, 3.4, 3.4, "glass", { s: 0.45 }); px(5, 4, W); break;
      case "doll": P.poly([[5, 7], [11, 7], [13, 15], [3, 15]], "c", (x) => 0.3 - (x - 3) * 0.06); P.ell(8, 4.5, 3, 3, "cream", { s: 0.2 }); px(7, 4, "#1e1824"); px(9, 4, "#1e1824"); P.rect(3, 8, 2, 1, "cream", 0); P.rect(11, 8, 2, 1, "cream", -0.2); P.rect(5, 1.5, 6, 1.5, "wood", 0); break;
      case "rod": P.line(1.5, 14.5, 13.5, 1.5, "c", 0.2, 1); P.rect(1, 12, 3, 3, "#3a2a1a", 0); P.ell(4.5, 11.5, 1.6, 1.6, "gold", { s: 0.2 });
        for (let y = 2; y < 13; y++) px(14, y, "#e8e0c8", -0.2); px(14, 13, "#c43a30"); px(14, 14, "#f0ece4"); break;
      case "flute": P.line(2, 14, 14, 2, "c", 0.15, 1); for (const k of [0.35, 0.5, 0.65, 0.8]) px(2 + 12 * k, 14 - 12 * k, "#2a1a10"); break;
      case "ink": P.ell(7, 11.5, 4.5, 3.5, "c", { s: 0.1 }); P.rect(5, 7, 4, 2, "c", 0.2); P.line(8, 7, 13, 1, "feather", 0.3, 0.9); P.line(9, 8, 14, 2.5, "feather", -0.2); px(5, 10, W); break;
      case "gauntlet": P.rect(3, 9, 6, 5, "c", (x) => 0.3 - (x - 3) * 0.1); P.poly([[4, 3], [12, 3], [13, 9], [4, 9]], "c", (x, y) => 0.35 - (x - 4) * 0.06 - (y - 3) * 0.03); for (const x of [6, 8, 10]) P.rect(x, 3, 1, 4, "c", -0.5); P.rect(2.5, 9, 7, 1, "c", 0.6); P.ell(13, 6.5, 1.6, 1.8, "c", { s: 0.1 }); break;
      case "belt": P.ell(8, 9, 6.5, 4, "c", { s: 0.15, fn: (x, y, s) => (((x + 0.5 - 8) / 5) ** 2 + ((y + 0.5 - 9) / 2.6) ** 2 < 1 ? false : s) }); P.rect(5, 10, 5, 4, "gold", (x) => 0.4 - (x - 5) * 0.12); P.rect(6, 11, 3, 2, "c", -0.3); px(8, 11, "gold", 0.6); break;
      case "boots": P.poly([[3, 2], [8, 2], [8, 10], [14, 11], [14, 14], [3, 14]], "c", (x, y) => 0.3 - (x - 3) * 0.05 - (y - 2) * 0.02); P.rect(3, 2, 5, 2, "c", 0.6); P.rect(3, 13, 11, 1, "dk", -0.2); break;
      case "eye": P.ell(8, 8, 6, 4, "cream", { s: 0.2 }); P.ell(8, 8, 3, 3, "c", { s: 0.3 }); P.ell(8, 8, 1.3, 1.6, "#120e14"); px(7, 6, W); break;
      case "pearl": P.ell(8, 11.5, 6.4, 3.4, "shellc", { s: -0.35, fn: (x, y, s) => (y < 11 ? false : s + (x % 2 ? -0.3 : 0)) }); P.ell(8, 11, 5.2, 1.6, "#2a2430");
        P.ell(8, 8.2, 3.6, 3.6, "pearlc", { s: 0.35 }); px(6, 6, W); px(7, 6, W); px(6, 7, W); break;
      case "scarf": neckIcon(P, "scarf"); break;
      default: P.ell(8, 8, 5, 5, "c", { s: 0.2 }); px(6, 6, W);
    }
  }
  function backIcon(P, art, t) {
    const gold = t === 3 ? "gold" : "omet";
    switch (art) {
      case "cloak":
        P.poly([[1.5, 5], [5, 2.5], [11, 2.5], [14.5, 5], [14, 15], [2, 15]], "bk", (x, y) => 0.3 - (x - 3) * 0.06 + (t === 2 && (x + y) % 5 === 0 ? 0.5 : 0));
        P.poly([[5.5, 2.5], [10.5, 2.5], [9, 5], [7, 5]], "#1e1824");
        P.line(8, 5, 8, 15, "bk", -0.55); P.line(3, 6, 2.5, 14.5, "bk", 0.6);
        if (t) P.ell(8, 7.5, 1.1, 1.1, gold, { s: 0.4 });
        if (t === 0) P.rect(10, 11, 2, 2, "patch", 0);
        if (t === 3) P.rect(2, 14, 12, 1, "gold", 0.2);
        break;
      case "cape":
        P.poly([[4, 3], [12, 3], [14, 13], [2, 13]], "bk", (x) => 0.3 - (x - 3) * 0.06 + (t === 2 && x % 3 === 0 ? 0.45 : 0));
        P.poly([[12, 3], [13, 3], [14.5, 13], [13.5, 13]], t >= 2 ? "gold" : "shirt", 0);
        P.rect(4, 3, 8, 2, "bk", 0.5);
        P.ell(5, 4, 1.2, 1.2, t >= 2 ? "gold" : "omet", { s: 0.4 }); P.ell(11, 4, 1.2, 1.2, t >= 2 ? "gold" : "omet", { s: 0.1 });
        if (t === 3) P.rect(2, 12, 12, 1, "gold", 0.1);
        break;
      case "fur_mantle":
        for (let x = 1; x <= 14; x++) { if (t === 0 && x % 4 === 1) continue; P.ell(x + 0.5, 6 + ((x + 0.5 - 8) / 7) ** 2 * 5 + (x % 2) * 0.6, 1.9, 1.8, "bk", { s: 0.3 - (x - 7) * 0.05 + (x % 3 === 0 ? 0.3 : 0), k: 0.6 }); }
        if (t === 2) { P.ell(3, 5, 2.3, 2, "bk", { s: 0.3 }); P.poly([[1, 4], [1.5, 1.5], [3, 3.5]], "bk", 0.3); P.px(3, 5, "#16121a"); }
        if (t === 3) for (const x of [3, 5, 11, 13]) P.poly([[x - 0.6, 11], [x + 0.6, 11], [x, 13]], "cream", 0.3);
        break;
      case "quiver": {
        const n = [2, 3, 4, 5][t];
        for (let i = 0; i < n; i++) { const x = 6 + i * (5 / n); P.line(x + 2, 4, x - 1, 1 + (i % 2), "dwood", 0); P.rect(x - 2, (i % 2) + 0, 2, 2, i % 2 && t >= 2 ? "fav" : "feather", 0.3); }
        P.poly([[5, 4], [11, 4], [10, 15], [6, 15]], "bk", (x) => 0.3 - (x - 5) * 0.12);
        if (t) P.rect(5.5, 6, 5, 1, t === 3 ? "gold" : "dleather", 0.2);
        if (t === 3) P.rect(6, 12, 4, 1, "gold", 0);
        break;
      }
      case "backpack":
        if (t === 0) { P.ell(8, 9.5, 5.5, 5, "bk", { s: 0.15 }); P.poly([[6, 5], [10, 5], [11, 2], [5, 2]], "bk", 0.3); P.rect(5.5, 4, 5, 1, "leather", 0.2); break; }
        if (t === 2) { P.rect(2, 1, 1, 14, "wood", 0.1); P.rect(13, 1, 1, 14, "wood", -0.2); P.rect(2, 2, 12, 1, "wood", 0.2); }
        P.rect(3, 5, 10, 10, "bk", (x) => 0.3 - (x - 3) * 0.06);
        if (t >= 2) P.ell(8, 4.2, 5.8, 1.7, t === 3 ? "fav" : "strap", { s: 0.15 });
        P.poly([[3, 5], [13, 5], [12, 10], [4, 10]], "bk", (x) => 0.55 - (x - 3) * 0.05); P.rect(4, 10, 8, 1, "dk", -0.2);
        P.rect(5, 11, 1, 4, "strap", 0.2); P.rect(10, 11, 1, 4, "strap", -0.1);
        P.px(8, 10, t === 3 ? "gold" : "omet", 0.4);
        if (t === 3) { P.rect(3, 12, 10, 1, "omet", 0.3); P.ell(13.5, 12, 1.4, 1.4, "dmetal", { s: 0 }); }
        break;
      case "banner":
        P.rect(3, 0, 1, 16, "wood", 0.1);
        if (t >= 2) P.ell(3.5, 0.5, 1.2, 1.2, "gold", { s: 0.3 });
        if (t === 0) P.poly([[4, 2], [12, 2], [10, 5], [12, 8], [4, 9]], "bk", (x, y) => 0.3 - (y - 2) * 0.06);
        else P.poly([[4, 1.5], [13, 1.5], [13, t === 3 ? 14 : 11], [8.5, t === 3 ? 11.5 : 8.5], [4, t === 3 ? 14 : 11]], "bk", (x, y) => 0.3 - (y - 1) * 0.04 - (x - 4) * 0.03);
        if (t >= 2) P.rect(4, 1.5, 9, 1, "gold", 0.2);
        if (t >= 1) { P.ell(8.5, 5.5, 1.8, 1.8, t === 3 ? "shirt" : "gold", { s: 0.3 }); }
        if (t === 3) for (let x = 4; x < 13; x += 2) P.px(x, 14, "gold", 0.2);
        break;
    }
  }
  function drawGearIcon(it, look) {
    look = Object.assign({ fav: "#a8443a", skin: "#e0b088", hair: "#4a3020" }, look || {});
    const G = Paint.Gear;
    look = Object.assign({}, look, { fav: G.soften(look.fav), hair: G.soften(look.hair) });
    const slot = it.slot === "ring1" || it.slot === "ring2" ? "ring" : it.slot, art = it.art || it.family || it.material;
    const tier = it.tier == null ? (slot === "weapon" || slot === "armor" ? 1 : 1) : it.tier;
    const tint = G.soften(it.tint || it.gem || CURIO_TINT[art] || "#a8a090");
    const k = { at: slot === "armor" ? Math.max(1, Math.min(5, tier)) : 2, mat: art, wt: slot === "weapon" ? Math.max(1, Math.min(5, tier)) : 1, ht: Math.min(3, tier), ot: Math.min(3, tier), bt: Math.min(3, tier),
      head: art, back: art, neckGem: G.soften(it.gem || (art === "scarf" ? it.tint || look.fav : null)), tint };
    const M = Object.assign(G.makeMats(look, k), { c: Paint.ramp(tint), dk: Paint.ramp(mix(tint, "#14101c", 0.45)), gem: Paint.ramp(art === "scarf" ? G.soften(it.gem || it.tint || look.fav) : it.glow || it.gem || NOGEM),
      iron: Paint.ramp("#8a8e98"), eggc: Paint.ramp(mix(tint, "#ece2cc", 0.65)), ivory: Paint.ramp(mix(tint, "#e6dcc0", 0.6)), shellc: Paint.ramp("#7a6e66"), pearlc: Paint.ramp(mix(tint, "#f2eee6", 0.7)), coin: Paint.ramp(mix(tint, "#e0b040", 0.6)),
      spoon: Paint.ramp(mix(tint, "#c4cad4", 0.65)), cyan: Paint.ramp(mix(tint, "#9ad8f0", 0.55)), sheet: Paint.ramp("#e4d6b0") });
    let P;
    const c = { v: hash(String(it.name || art)), ht: Math.min(3, tier), hglow: null, cx: 20, faceW: 7, head: art, gaze: 1, eye: "#3a3a40" };
    if (slot === "weapon") P = art === "daggers" && it.two !== false
      ? iconFit((Q) => G.weapon(Q, art, k.wt, G.axis(Q, 0, 0, Math.PI / 4, 1), { glow: it.glow, second: G.axis(Q, (3.6 + [0, 3, 4, 5, 6, 6][k.wt]) * 0.707, 0, -Math.PI / 4, 1) }), M, 1.8)
      : iconFit((Q) => G.weapon(Q, art, k.wt, G.axis(Q, 0, 0, Math.PI / 4, 1), { glow: it.glow }), M, art === "wand" ? 1.8 : 1.2);
    else if (slot === "armor") { P = new Paint.Paint(16, 16); armorIcon(P, art, k.at, it.glow); }
    else if (slot === "head") P = iconFit((Q) => {
      const holl = ["hood", "skull_hood", "beast_hood", "helm", "great_helm", "skull_helm", "leather_cap", "horns"].includes(art);
      Q.layer = 1;
      if (holl) Q.ell(20, 16, 6.6, 8.4, "#1e1824");
      Q.layer = 7;
      G.headgear(Q, art, 20, 7, look, () => false, c);
    }, M, 1.3);
    else if (slot === "offhand") P = iconFit((Q) => G.offhand(Q, art, k.ot, c), M, 1.6);
    else if (slot === "back") { P = new Paint.Paint(16, 16); backIcon(P, art, k.bt); }
    else { P = new Paint.Paint(16, 16); if (slot === "ring") ringIcon(P, art, it.gem || it.glow); else if (slot === "neck") neckIcon(P, art); else curioIcon(P, art); }
    P.tf = null;
    const g = P.render(M, { outline: OUTLINE });
    if (it.glow) {
      const px = [];
      for (let i = 0; i < 256; i++) if (P.mat[i] !== null) px.push(i);
      G.glowUp(g, P, px, it.glow, 0, { outline: OUTLINE, tint: 0.1, edgeAmt: 0.5 });
    }
    return g;
  }

  // ---------- class path emblems ----------
  const STEEL_R = ["#3a4252", "#6a7486", "#9ca6b4", "#c8d0da", "#f2f5f8"];
  const CRIMSON_R = ["#4a1418", "#7a2228", "#a8343a", "#c85a52", "#e08a74"];
  const ORB_R = ["#0e3a5a", "#1a7898", "#34b8cc", "#86e6ea", "#eaffff"];
  const LEAF_R = ["#1e3a1c", "#2e6a2c", "#4a9a3a", "#7ac25a", "#b8e88a"];
  function drawClassEmblem(path) {
    const g = new Grid(16, 16), put = (x, y, r, i) => g.set(x, y, r[Math.max(0, Math.min(4, i))]);
    if (path === "warrior") {
      const half = (y) => (y <= 8 ? 5 : 5 - (y - 8) * 0.9), inS = (x, y) => y >= 3 && y <= 14 && Math.abs(x + 0.5 - 9.5) <= half(y);
      for (let y = 3; y <= 14; y++) for (let x = 3; x <= 15; x++) {
        if (!inS(x, y)) continue;
        const rim = !inS(x - 1, y) || !inS(x + 1, y) || !inS(x, y - 1) || !inS(x, y + 1);
        if (rim) put(x, y, GOLD_R, y === 3 || (x < 10 && y < 10) ? 3 : 1);
        else put(x, y, CRIMSON_R, x + y < 13 ? 3 : x + y > 20 ? 1 : 2);
      }
      for (const [x, y] of [[6, 5], [6, 6], [7, 5]]) put(x, y, CRIMSON_R, 4);
      // the sword lies across the shield, edged in dark so it reads against the field
      for (let i = 0; i < 9; i++) {
        const x = 14 - i, y = 1 + i;
        if (inS(x - 1, y)) g.set(x - 1, y, OUTLINE);
        if (inS(x + 1, y + 1) && i > 0) g.set(x + 1, y + 1, OUTLINE);
        put(x, y, STEEL_R, i < 3 ? 4 : 3); put(x, y + 1, STEEL_R, 1);
      }
      put(15, 0, STEEL_R, 3);
      for (const [x, y, k] of [[2, 8, 3], [3, 9, 3], [4, 10, 2], [5, 11, 2], [6, 12, 1]]) put(x, y, GOLD_R, k);
      put(4, 11, WOOD_R, 1); put(3, 12, WOOD_R, 2);
      put(2, 13, GOLD_R, 3); put(1, 13, GOLD_R, 4); put(1, 14, GOLD_R, 2); put(2, 14, GOLD_R, 1);
    } else if (path === "ranger") {
      // a recurve bow bellied to the left, string drawn, arrow nocked and pointing left
      for (let y = 1; y <= 14; y++) {
        const t = (y - 1) / 13, x = Math.round(10.5 - 6.5 * Math.sin(Math.PI * t) + (t < 0.08 || t > 0.92 ? 1 : 0));
        const grip = y >= 6 && y <= 9;
        put(x, y, grip ? CRIMSON_R : WOOD_R, grip ? (y === 6 ? 3 : 1) : 3);
        put(x + 1, y, grip ? CRIMSON_R : WOOD_R, grip ? 0 : 1);
      }
      for (let y = 1; y <= 14; y++) if (!g.get(12, y)) g.set(12, y, y === 7 || y === 8 ? "#f4ecd4" : "#d8ccac");
      for (let x = 2; x <= 13; x++) if (x < 4 || x > 6) put(x, 8, WOOD_R, 4);
      for (const [x, y, i] of [[1, 8, 4], [2, 7, 3], [2, 9, 2], [3, 8, 3], [1, 7, 3], [1, 9, 1], [0, 8, 2]]) put(x, y, STEEL_R, i);
      for (const [x, y, i] of [[13, 7, 3], [14, 6, 4], [14, 7, 2], [13, 9, 1], [14, 9, 2], [14, 10, 0], [13, 8, 3], [14, 8, 3]]) put(x, y, LEAF_R, i);
    } else {
      // a staff topped with a glowing orb held in gold prongs
      for (let i = 0; i < 10; i++) { put(1 + i, 14 - i, WOOD_R, 3); put(2 + i, 14 - i, WOOD_R, 1); }
      put(1, 15, WOOD_R, 2);
      for (const [x, y, i] of [[4, 11, 3], [5, 11, 2], [5, 10, 1]]) put(x, y, GOLD_R, i);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const dx = x + 0.5 - 11, dy = y + 0.5 - 5, d = Math.hypot(dx, dy);
        if (d > 3.6) continue;
        const l = -dx * 0.5 - dy * 0.6 + (3.6 - d) * 0.35;
        put(x, y, ORB_R, d < 1.3 ? 4 : l > 1.2 ? 4 : l > 0.4 ? 3 : l > -0.8 ? 2 : 1);
      }
      put(10, 3, ORB_R, 4); put(9, 4, "#ffffff" && ORB_R, 4);
      for (const [x, y, i] of [[8, 7, 3], [8, 8, 2], [9, 8, 2], [13, 8, 1], [12, 9, 1], [11, 9, 2], [10, 9, 2], [7, 4, 3], [7, 5, 2]]) put(x, y, GOLD_R, i);
      for (const [x, y] of [[14, 1], [3, 3], [15, 9]]) g.set(x, y, "#fff6c8");
      for (const [x, y] of [[13, 1], [15, 1], [14, 0], [14, 2], [3, 2], [3, 4], [2, 3], [4, 3]]) g.set(x, y, GOLD_R[3]);
    }
    g.outline(OUTLINE);
    return g;
  }

  // ---------- public API with caching ----------
  const cache = new Map();
  function cached(key, fn) {
    if (!cache.has(key)) cache.set(key, fn());
    return cache.get(key);
  }
  function heroGrid(h, frame, cls) {
    const clsLook = Object.assign({ cn: (cls || {}).name || "" }, (cls || {}).look || { outfit: "leather", head: "none", aura: null, offhand: "none" });
    const key = "h:" + JSON.stringify([h.look, clsLook, h.weapon, h.weapon_tier, h.armor_tier || h.weapon_tier, h.legend, h.kit || null, frame || 0]);
    return cached(key + (h.id || h.name || ""), () => drawHero({ id: h.id, name: h.name, look: h.look, clsLook, weapon: h.weapon, weaponTier: h.weapon_tier || 1,
      armorTier: h.armor_tier || h.weapon_tier || 1, legend: h.legend, kit: h.kit || null, frame: frame || 0 }));
  }
  // the same hero in the saddle: legs bent for riding (Paint.fullBody's seated pose, the boot's sole on row `sole`), everything
  // above the belt unchanged
  function heroSeated(h, frame, cls, sole) {
    const clsLook = Object.assign({ cn: (cls || {}).name || "" }, (cls || {}).look || { outfit: "leather", head: "none", aura: null, offhand: "none" });
    const key = "seat:" + JSON.stringify([h.look, clsLook, h.weapon, h.weapon_tier, h.armor_tier || h.weapon_tier, h.legend, h.kit || null, frame || 0, sole || 32]);
    return cached(key + (h.id || h.name || ""), () => drawHero({ id: h.id, name: h.name, look: h.look, clsLook, weapon: h.weapon, weaponTier: h.weapon_tier || 1,
      armorTier: h.armor_tier || h.weapon_tier || 1, legend: h.legend, kit: h.kit || null, frame: frame || 0, seated: sole || 32 }));
  }
  // the same hero asleep in bed (q: Paint.sleeper's quilt spec), and the helm or hat they took off for the night
  function heroLying(h, frame, cls, q) {
    const clsLook = Object.assign({ cn: (cls || {}).name || "" }, (cls || {}).look || { outfit: "leather", head: "none", aura: null, offhand: "none" });
    const key = "lie:" + JSON.stringify([h.id || h.name, h.look, clsLook, h.kit || null, frame || 0, q]);
    return cached(key, () => Paint.sleeper({ id: h.id, name: h.name, look: h.look, clsLook, weapon: h.weapon, weaponTier: h.weapon_tier || 1,
      armorTier: h.armor_tier || h.weapon_tier || 1, kit: h.kit || null, frame: frame || 0 }, q));
  }
  function heroAside(h, cls) {
    const clsLook = Object.assign({ cn: (cls || {}).name || "" }, (cls || {}).look || { outfit: "leather", head: "none", aura: null, offhand: "none" });
    return cached("aside:" + JSON.stringify([h.id || h.name, h.look, clsLook, h.kit || null]), () => Paint.setAside({ id: h.id, name: h.name, look: h.look, clsLook,
      weapon: h.weapon, weaponTier: h.weapon_tier || 1, armorTier: h.armor_tier || h.weapon_tier || 1, kit: h.kit || null }));
  }
  function heroCanvas(h, scale, frame, cls) { return heroGrid(h, frame, cls).toCanvas(scale); }
  function monsterGrid(m, frame) { return cached("m:" + m.body + m.pal + (frame || 0) + (m.boss ? "b" : ""), () => drawMonster(m.body, m.pal, frame, m.boss)); }
  // a monster in a death pose (see Beasts.draw): the grid carries pad (its standing sprite sits at (pad, pad)) and stand [w, h]
  function monsterPose(m, pose) { return cached("mp:" + m.body + m.pal + (m.boss ? "b" : "") + JSON.stringify(pose), () => drawMonster(m.body, m.pal, 0, m.boss, pose)); }
  function petGrid(pet, frame) { return cached("p:" + pet.kind + pet.name + (pet.coat || "") + (frame || 0), () => drawPet(pet.kind, pet.name, frame, pet.coat)); }
  function bannerGrid(b, big) { return cached("b:" + (big ? "L" : "S") + JSON.stringify(b), () => drawBanner(b, big)); }
  // the champion's medallion: a lit gold pixel ring with laurel sprays and a ribbon
  function laurelGrid() {
    return cached("laurel", () => {
      const N = 56, C = 28, g = new Grid(N, N), leaf = new Set();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = x + 0.5 - C, dy = y + 0.5 - C, d = Math.hypot(dx, dy);
        if (d < 19.4 || d > 23.6) continue;
        const l = (-dx - dy) / (d * 1.414), notch = ((Math.atan2(dy, dx) * 12 / Math.PI) % 2 + 2) % 2 < 0.25;
        g.set(x, y, d > 22.7 || d < 20.3 ? "#4a2e10" : notch ? "#c8963e" : l > 0.65 ? "#fff2a0" : l > 0.05 ? "#f6d77a" : l > -0.55 ? "#c8963e" : "#9a6a28");
      }
      for (const side of [-1, 1]) for (let k = 0; k < 7; k++) {
        const a = (105 + k * 19) * Math.PI / 180, cx = C + side * 24.4 * Math.sin(a), cy = C - 24.4 * Math.cos(a), ang = a + Math.PI / 2;
        for (let j = -3; j <= 3; j++) for (let i = -2; i <= 2; i++) {
          if ((j / 3.2) ** 2 + (i / 1.6) ** 2 > 1) continue;
          const x = Math.floor(cx + side * (j * Math.cos(ang) - i * Math.sin(ang) * 0.6)), y = Math.floor(cy - j * Math.sin(ang) * 0.4 + i * 0.9);
          if (Math.hypot(x + 0.5 - C, y + 0.5 - C) <= 21) continue;
          g.set(x, y, i < 0 && j < 1 ? "#8ac85a" : i <= 0 ? "#5a9a3a" : "#3a6a2a");
          leaf.add(x + "," + y);
        }
      }
      for (const key of [...leaf]) {
        const [x, y] = key.split(",").map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy;
          if (!g.get(X, Y) && Math.hypot(X + 0.5 - C, Y + 0.5 - C) > 21) g.set(X, Y, "#1e3a14");
        }
      }
      for (const [x, y] of [[26, 51], [27, 51], [28, 51], [29, 51], [25, 52], [26, 52], [27, 52], [28, 52], [29, 52], [30, 52], [27, 53], [28, 53], [26, 54], [29, 54], [25, 55], [30, 55]])
        g.set(x, y, y < 53 ? "#c8463a" : "#8e2a22");
      return g;
    });
  }
  function itemGrid(id) { return cached("i:" + id, () => drawItem(id)); }
  function gearIcon(item, look) { return cached("g:" + JSON.stringify([item.slot, item.art, item.family, item.material, item.tier, item.gem, item.tint, item.glow, item.name, item.two, look && look.fav]), () => drawGearIcon(item, look)); }
  // ---------- trophies: the boss's own sprite, cut at the neck and mounted on a walnut shield plaque ----------
  // the head's box [x, y, w, h] in each boss body's standing sprite; a body not listed mounts its upper part around the bulk
  const TROPHY_HEAD = {
    goblin_big: [11, 0, 29, 25], bear: [26, 1, 19, 20], spider_big: [21, 0, 25, 26], chest: [0, 0, 32, 27], human: [9, 0, 17, 18],
    hag: [10, 0, 24, 18], troll: [18, 0, 20, 19], kraken: [3, 0, 38, 25], dragon: [26, 0, 22, 17],
  };
  // a boss whose head crop reads poorly at card size mounts a drawn keepsake instead
  const TROPHY_ART = { spider_big: drawFangs };
  function drawFangs() {
    const W = 26, H = 24, g = new Grid(W, H);
    const ivory = ["#fffaea", "#f2e6c4", "#d8caa4", "#9a8e80", "#4e4250", "#1e1624"];
    const curve = (t, s) => {
      const u = 1 - t, a = u * u, b = 2 * u * t, c = t * t;
      const x = a * 7.5 + b * 2.5 + c * 10, y = a * 3.5 + b * 13 + c * 20;
      return [s < 0 ? x : W - x, y];
    };
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 100; i++) pts.push([i / 100, ...curve(i / 100, s)]);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const px = x + 0.5, py = y + 0.5;
        let best = 1e9, bt = 0, bx = 0;
        for (const [t, qx, qy] of pts) { const d = Math.hypot(px - qx, py - qy); if (d < best) { best = d; bt = t; bx = px - qx; } }
        if (best > 2.4 * Math.pow(1 - bt, 0.7) + 0.4) continue;
        // ivory most of the way down, then darkening fast into the tip; lit from the top-left like every sprite
        let k = bt < 0.5 ? 0 : bt < 0.66 ? 1 : bt < 0.77 ? 2 : bt < 0.86 ? 3 : bt < 0.94 ? 4 : 5;
        if (bx > 0.8 && k < 5) k++;
        else if (bx < -0.8 && k > 0) k--;
        g.set(x, y, ivory[k]);
      }
      // a brass ferrule caps each root, as a taxidermist mounts tusks
      const [rx] = curve(0, s), fx = Math.round(rx) - 3, brass = ramp("#c8963e");
      for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) g.set(fx + x, y, y === 0 ? brass[4] : y === 3 ? brass[0] : x === 0 ? brass[3] : x === 5 ? brass[1] : brass[2]);
      g.set(fx + 2, 1, brass[0]); g.set(fx + 3, 2, brass[4]);
    }
    const [tx, ty] = curve(1, 1), dx = Math.floor(tx) - 1, dy = Math.floor(ty) + 1;
    for (const [x, y, c] of [[1, 0, "#7ae84a"], [0, 1, "#7ae84a"], [1, 1, "#4ab832"], [2, 1, "#3a9a2a"], [0, 2, "#4ab832"], [1, 2, "#3a9a2a"], [2, 2, "#2a7a22"], [1, 3, "#1e5a18"]])
      g.set(dx + x, dy + y, c);
    g.set(dx, dy + 1, "#e0ffc0");
    for (const s of [-1, 1]) { const [x, y] = curve(0.97, s); g.set(Math.floor(x), Math.floor(y), "#5ac83a"); }
    g.outline(OUTLINE);
    g.noSink = true;
    return g;
  }
  function trophyHead(m) {
    if (TROPHY_ART[m.body]) return TROPHY_ART[m.body]();
    const src = monsterGrid(m, 0);
    let r = TROPHY_HEAD[m.body];
    if (!r) {
      const h = Math.min(src.h, 26);
      let sx = 0, n = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < src.w; x++) if (src.get(x, y)) { sx += x; n++; }
      const w = Math.min(src.w, 34), cx = n ? sx / n : src.w / 2;
      r = [Math.max(0, Math.min(src.w - w, Math.round(cx - w / 2))), 0, w, h];
    }
    const [x0, y0, w, h] = r, g = new Grid(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.set(x, y, src.get(x0 + x, y0 + y));
    return g;
  }
  function drawTrophy(m) {
    const head = trophyHead(m);
    const W = 46, H = 48, cx = W / 2, hw = Math.max(13, Math.min(20, Math.ceil(head.w / 2) + 3));
    const top = 7, shoulder = 31, tip = 45, g = new Grid(W, H);
    // the shield's half-width at row y: square shoulders with clipped corners, then a curve to the point
    const half = (y) => {
      if (y < top || y > tip) return -1;
      if (y < top + 2) return hw - (top + 2 - y);
      if (y <= shoulder) return hw;
      const t = (y - shoulder) / (tip - shoulder);
      return hw * Math.sqrt(Math.max(0, 1 - t * t * 0.96)) * (1 - t * 0.25);
    };
    const inside = (x, y) => { const k = half(y); return k >= 0 && Math.abs(x + 0.5 - cx) <= k; };
    const wood = ramp("#7a4a2c"), brass = ramp("#c8963e"), rnd = rng(hash("plaque" + m.name));
    const grain = [];
    for (let i = 0; i < 6; i++) grain.push([4 + rnd() * 38, rnd() * 6.28, 0.6 + rnd() * 1.2]);
    const edge = (x, y) => !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    const near = (x, y, d) => { for (let j = -d; j <= d; j++) for (let i = -d; i <= d; i++) if (!inside(x + i, y + j)) return true; return false; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      const fx = (x + 0.5 - cx) / hw, fy = (y - top) / (tip - top);
      if (edge(x, y)) { g.set(x, y, "#2a1408"); continue; }
      // a bevelled rim lit from the top-left, then a brass inlay line inside it
      if (near(x, y, 2)) { g.set(x, y, (!inside(x - 2, y) || !inside(x, y - 2)) && fy < 0.75 ? wood[3] : fy > 0.6 || fx > 0.5 ? wood[0] : wood[1]); continue; }
      if (near(x, y, 3)) { g.set(x, y, fx < -0.2 || fy < 0.15 ? brass[3] : brass[1]); continue; }
      let v = 2 - (fx * 0.6 + fy * 0.9) * 0.9;
      for (const [gy, ph, a] of grain) if (Math.abs(y - gy - Math.sin(x * 0.35 + ph) * a) < 0.5) v -= 0.9;
      g.set(x, y, wood[Math.max(0, Math.min(4, Math.round(v)))]);
    }
    // the brass nameplate and its two pins
    const py = 37, pw = Math.min(8, hw - 4);
    for (let y = py; y < py + 4; y++) for (let x = Math.round(cx - pw); x < Math.round(cx + pw); x++)
      g.set(x, y, y === py ? brass[4] : y === py + 3 ? brass[0] : x === Math.round(cx - pw) ? brass[3] : x === Math.round(cx + pw) - 1 ? brass[1] : brass[2]);
    for (let x = Math.round(cx - pw) + 2; x < Math.round(cx + pw) - 2; x++) if ((x * 7) % 5 > 1) g.set(x, py + 2, brass[0]);
    g.set(Math.round(cx - pw) + 1, py + 1, brass[0]); g.set(Math.round(cx + pw) - 2, py + 1, brass[0]);
    // the hanging ring on its nail above the shield
    for (const [x, y, c] of [[-1, 1, 1], [0, 0, 3], [1, 1, 1], [-2, 2, 1], [2, 2, 0], [-2, 3, 2], [2, 3, 0], [-1, 4, 1], [1, 4, 0], [0, 5, 2], [0, 6, 0]])
      g.set(Math.floor(cx) + x, top - 6 + y, brass[c]);
    // the head: centred on the board above the nameplate, with a shadow cast down-right onto the wood
    const hx = Math.round(cx - head.w / 2), hy = Math.max(0, Math.min(py - 1 - head.h, Math.round((top + py) / 2 - head.h / 2 + 2)));
    for (let y = 0; y < head.h; y++) for (let x = 0; x < head.w; x++) {
      if (!head.get(x, y)) continue;
      for (const [dx, dy] of [[1, 2], [2, 2], [1, 1]]) {
        const X = hx + x + dx, Y = hy + y + dy;
        if (inside(X, Y) && !edge(X, Y) && !head.get(X - hx, Y - hy) && Y < py) g.set(X, Y, mix(g.get(X, Y), "#140a04", 0.5));
      }
    }
    for (let y = 0; y < head.h; y++) for (let x = 0; x < head.w; x++) {
      const c = head.get(x, y);
      if (!c) continue;
      // the cut sinks into the board: the last rows darken toward the mount
      const sink = head.noSink ? 0 : Math.max(0, y - (head.h - 3)) / 3;
      g.set(hx + x, hy + y, sink && c !== OUTLINE ? mix(c, "#1a0e06", sink * 0.7) : c);
    }
    return g;
  }
  function trophyGrid(m) { return cached("t:" + m.body + m.pal + m.name, () => drawTrophy(m)); }
  function graveGrid() { return cached("grave", () => drawGrave()); }
  function dummyGrid() { return cached("dummy", drawDummy); }
  function classEmblem(path) { return cached("c:" + path, () => drawClassEmblem(path)); }

  window.Art = { Grid, ramp, mix, hash, rng, heroGrid, heroSeated, heroLying, heroAside, heroCanvas, monsterGrid, monsterPose, trophyGrid, MPAL, petGrid, PET_COATS, bannerGrid, classEmblem, itemGrid, gearIcon, laurelGrid, graveGrid, dummyGrid, OUTLINE, AURA };
})();
