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
    gold: ["#ffd84a", "#fff2a0", "#e8a02a"],
  };

  const drawHero = (o) => Paint.fullBody(o);

  // ---------- pets ----------
  function drawPet(kind, name, frame) {
    const r = rng(hash(name || "pet"));
    const g = new Grid(14, 10);
    const oy = frame === 1 ? 1 : 0;
    if (kind === "dog") {
      const c = ramp(["#a0703a", "#d8b078", "#3a2a22", "#f0e8d8", "#7a4a2a"][Math.floor(r() * 5)]);
      g.blob(6, 5 + oy, 4, 2.2, c); g.blob(10.5, 3 + oy, 2.2, 2, c);
      g.set(12, 3 + oy, "#1a1220"); g.set(10, 2 + oy, "#1a1220"); g.set(9, 1 + oy, c[1]); g.set(9, 2 + oy, c[1]);
      g.rect(3, 7, 1, 2, c[1]); g.rect(5, 7, 1, 2, c[2]); g.rect(8, 7, 1, 2, c[1]); g.rect(9, 7, 1, 2, c[2]);
      g.set(1, 3 + oy, c[2]); g.set(2, 4 + oy, c[2]);
    } else if (kind === "cat") {
      const c = ramp(["#9a9aa8", "#e8903a", "#2a2430", "#f0ece0", "#7a6a5a"][Math.floor(r() * 5)]);
      g.blob(6, 6 + oy * 0, 3.5, 2, c); g.blob(10, 4, 2, 2, c);
      g.set(9, 2, c[2]); g.set(11, 2, c[2]); g.set(9, 4, "#5ac85a"); g.set(11, 4, "#5ac85a");
      g.rect(4, 8, 1, 1, c[1]); g.rect(8, 8, 1, 1, c[1]);
      g.set(2, 5 - oy, c[2]); g.set(1, 4 - oy, c[2]); g.set(1, 3 - oy, c[3]);
    } else if (kind === "horse") {
      const c = ramp(["#8a5a3a", "#3a2a22", "#d8c8a8", "#a8a8b0", "#c8803a"][Math.floor(r() * 5)]);
      const mane = c[2];
      g.blob(6, 4.5 + oy, 4, 2, c); g.rect(9, 1 + oy, 2, 4, c[1]); g.blob(11.5, 1.5 + oy, 1.8, 1.2, c);
      g.set(12, 1 + oy, "#1a1220"); g.set(10, 0 + oy, c[1]);
      g.rect(9, 1 + oy, 1, 3, mane); g.set(1, 4 + oy, mane); g.set(1, 5 + oy, mane); g.set(2, 4 + oy, mane);
      g.rect(3, 6 + oy, 1, 4 - oy, c[1]); g.rect(5, 6 + oy, 1, 4 - oy, c[2]); g.rect(8, 6 + oy, 1, 4 - oy, c[1]); g.rect(9, 6 + oy, 1, 4 - oy, c[2]);
    } else {
      const c = ramp(["#5ab04a", "#e8823a", "#4a8ac8"][Math.floor(r() * 3)]);
      g.blob(6, 6, 4, 1.5, c); g.blob(11, 5.5, 1.8, 1.4, c); g.set(12, 5, "#1a1220");
      g.set(1, 7, c[1]); g.set(0, 7, c[1]); g.set(4, 8, c[1]); g.set(8, 8, c[1]);
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

  function drawMonster(body, pal, frame, boss) {
    const p = MPAL[pal] || MPAL.grey;
    const A = ramp(p[0]), B = ramp(p[1]), E = p[2];
    let g;
    const f = frame || 0;
    const humanoid = (skin, cloth, opts) => drawHero({
      look: { skin, hair: opts.hair || "#2a2020", style: opts.style == null ? 4 : opts.style, face: opts.face || 0, fav: cloth, scars: opts.scars || [] },
      clsLook: { outfit: opts.outfit || "leather", head: opts.head || "none", aura: opts.aura || null, offhand: opts.off || "none" },
      weapon: opts.weapon || "sword", weaponTier: opts.tier || 1, armorTier: 1, frame: f,
    });
    switch (body) {
      case "goblin": case "goblin_big": case "kobold": {
        const big = body === "goblin_big";
        g = humanoid(p[0], p[1], { style: 4, outfit: big ? "fur" : "leather", head: pal === "green_shaman" ? "antlers" : big ? "horns" : "none",
          weapon: pal.includes("archer") || pal.includes("sling") ? "bow" : pal === "green_shaman" ? "staff" : big ? "axe" : "daggers", off: big ? "banner" : "none" });
        for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
          if (g.get(x, y) === "#1a1220" && y > 8 && y < 12 && x > 9 && x < 16) g.set(x, y, E);
        }
        g.set(8, 8, A[2]); g.set(7, 7, A[2]); g.set(6, 6, A[3]); g.set(19, 8, A[1]); g.set(20, 7, A[1]); g.set(21, 6, A[2]);
        if (body === "kobold") { g.set(12, 14, A[3]); g.set(13, 14, A[3]); g.set(14, 15, A[1]); }
        g = shrink(g, big ? 1.0 : 0.82);
        break;
      }
      case "human": {
        if (boss && pal === "necromancer") return Beasts.draw("lich", pal, f, false, p);
        const map = { bandit: ["hood", "leather", "sword"], bandit_archer: ["hood", "leather", "bow"], bandit_captain: ["tricorn", "fancy", "sword"],
          necromancer: ["skull_hood", "robe_dark", "staff"] };
        const [head, outfit, weapon] = map[pal] || ["none", "leather", "sword"];
        g = humanoid(p[0], p[1], { style: 0, head, outfit, weapon, face: pal === "bandit_captain" ? 2 : 1, aura: pal === "necromancer" ? "death" : null, off: pal === "necromancer" ? "skull" : "none", tier: pal === "bandit_captain" ? 3 : 1 });
        break;
      }
      case "hag": if (boss) return Beasts.draw("crone", pal, f, false, p); g = humanoid(p[0], p[1], { style: 1, hair: "#d8d8d0", head: "none", outfit: "robe_dark", weapon: "staff", aura: "nature", scars: ["pale"] }); break;
      case "siren": g = humanoid("#a8d8d0", "#3a8a9a", { style: 1, hair: "#2a6a8a", outfit: "fancy", weapon: "lute" }); break;
      case "skeleton": case "zombie": {
        const isS = body === "skeleton";
        g = humanoid(isS ? "#e8e0d0" : p[0], isS ? "#a89880" : p[1], { style: 4, outfit: isS ? "leather" : "cloak", weapon: pal === "bone_archer" ? "bow" : isS ? "sword" : "none", scars: isS ? [] : ["scar", "pale"] });
        for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === "#1a1220" && y > 8 && y < 12 && x > 9 && x < 17) g.set(x, y, E);
        if (isS) for (let y = 15; y < 24; y += 2) g.hline(9, 16, y, "#5a5040");
        break;
      }
      default: return Beasts.draw(body, pal, f, boss, p);
    }
    if (boss) g = scaleGrid(g, 1.35);
    return g;
  }

  function shrink(g, f) { return f === 1 ? g : scaleGrid(g, f); }
  function scaleGrid(g, f) {
    const w = Math.round(g.w * f), h = Math.round(g.h * f);
    const n = new Grid(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) n.px[y * w + x] = g.get(Math.floor(x / f), Math.floor(y / f));
    return n;
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
      const warm = ["flame", "coin", "crown", "star"].includes(b.emblem), cold = ["moon", "skull", "sword", "eye"].includes(b.emblem);
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

  const ITEM = {
    ration: ["#c89a5a", "loaf"], potion: ["#e84a5a", "flask"], bandage: ["#f0e8d8", "roll"], rope: ["#b08a5a", "coil"], herbs: ["#5ab04a", "leaf"],
    rare_herb: ["#b8a0f0", "leaf"], fish: ["#8ab0c8", "fish"], pelt: ["#9a6a42", "hide"], fang: ["#f0e8d0", "fang"], goblin_ear: ["#6aa04a", "ear"],
    chitin: ["#3a3440", "shard"], bones: ["#e8e0d0", "bone"], remains: ["#7a6a5a", "sack"], grave_dust: ["#9a9aa0", "pile"], ectoplasm: ["#7af08a", "flask"],
    wisp_light: ["#c8f0ff", "flask"], troll_hide: ["#6a7a6a", "hide"], ore: ["#8a7a6a", "rock"], gem: ["#5ad0f0", "gem"], trinket: ["#e8b84a", "ring"],
    stolen_goods: ["#7a5a8a", "sack"], drake_scale: ["#c84a3a", "shard"], frost_crystal: ["#9ae8ff", "gem"], ember_core: ["#ff8a2a", "gem"],
    relic: ["#c88aff", "gem"], dragon_scale: ["#e8b84a", "shard"], gold: ["#ffd84a", "coin"],
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
    const key = "h:" + JSON.stringify([h.look, clsLook, h.weapon, h.weapon_tier, h.armor_tier || h.weapon_tier, h.legend, frame || 0]);
    return cached(key + (h.id || h.name || ""), () => drawHero({ id: h.id, name: h.name, look: h.look, clsLook, weapon: h.weapon, weaponTier: h.weapon_tier || 1,
      armorTier: h.armor_tier || h.weapon_tier || 1, legend: h.legend, frame: frame || 0 }));
  }
  function heroCanvas(h, scale, frame, cls) { return heroGrid(h, frame, cls).toCanvas(scale); }
  function monsterGrid(m, frame) { return cached("m:" + m.body + m.pal + (frame || 0) + (m.boss ? "b" : ""), () => drawMonster(m.body, m.pal, frame, m.boss)); }
  function petGrid(pet, frame) { return cached("p:" + pet.kind + pet.name + (frame || 0), () => drawPet(pet.kind, pet.name, frame)); }
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
  function graveGrid() { return cached("grave", () => drawGrave()); }
  function classEmblem(path) { return cached("c:" + path, () => drawClassEmblem(path)); }

  window.Art = { Grid, ramp, mix, hash, rng, heroGrid, heroCanvas, monsterGrid, petGrid, bannerGrid, classEmblem, itemGrid, laurelGrid, graveGrid, OUTLINE, AURA };
})();
