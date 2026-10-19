/* The flat, side-on tavern behind a town's story vignettes: each town's own room (wall, floor, hearth, bar and a signature piece), that day's weather through the window, and the fire, candles and quiet regulars that move. */
(function () {
  "use strict";
  const R = Math.round;
  const memo = new Map();
  const mix = (a, b, t) => { const k = a + b + t; let v = memo.get(k); if (!v) { v = Art.mix(a, b, t); memo.set(k, v); } return v; };
  const sh = (c, k) => (k > 0 ? mix(c, "#ffffff", k) : mix(c, "#000000", -k));
  const h01 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const frac = (v) => ((v % 1) + 1) % 1;

  // each town's room, in the colours of its song-scene tavern (ballad.js LOOKS, which loads only with the song pages)
  const LOOKS = {
    ironhaven: { wall: "brick", cols: ["#8a4a3a", "#7e4234", "#965240"], mortar: "#4a3430", wains: ["#4a2a1c", "#42261a"], rail: "#c8a040",
      floor: ["#6e3e22", "#663a20", "#743f22"], seam: "#3a2010", stone: ["#8a8076", "#7a7068", "#948a7e"], smortar: "#4e4640", mantel: "#7a5a2a",
      curtain: ["#b83a32", "#8a2a24"], frame: "#7a5a2a", rug: ["#b83a32", "#e8b84a", "#5a1a16"], sky: "roofs", emblem: "flagon", mid: "notices", over: "hammers", metal: "#d8a838" },
    thornwall: { wall: "plaster", cols: ["#d8c8a4", "#cbb994"], timber: "#4a2e1a", wains: ["#5e3a1e", "#54341c"], rail: "#8a5a30",
      floor: ["#8e5c34", "#83542f", "#895830"], seam: "#5a3820", stone: ["#9a8a76", "#8a7a68", "#a4947e"], smortar: "#54483c", mantel: "#5e3a1e",
      curtain: ["#a8743a", "#7e5428"], frame: "#4a2e1a", rug: ["#a8743a", "#f4e4c0", "#5e3a1e"], sky: "mill", emblem: "sheaf", mid: "wheel", over: "sheaf", sag: true, metal: "#b0a490" },
    carrbridge: { wall: "boards", cols: ["#4e6e8a", "#486680", "#52728e"], seam: "#2a3a4a", wains: ["#6e4a2c", "#644226"], rail: "#e0eef4",
      floor: ["#8a6a44", "#82623e", "#866642"], fseam: "#4e3a24", stone: ["#8a8a90", "#7a7a80", "#94949a"], smortar: "#4a4a50", mantel: "#5e3a1e",
      curtain: ["#6a9a3a", "#4e7a2a"], frame: "#3a2a1c", rug: ["#3a7ab8", "#e0eef4", "#24486e"], sky: "bridge", emblem: "scale", mid: "toll", over: "oars", metal: "#c8a040" },
    hollowood: { wall: "logs", cols: ["#7a5232", "#6a4628", "#3e2814"], wains: null, rail: null,
      floor: ["#9a6e44", "#926840", "#a07446"], fseam: "#5e4228", stone: ["#7e7a6a", "#6e6a5c", "#8a8674"], smortar: "#44403a", mantel: "#4a3018",
      curtain: ["#3a6a34", "#2a5028"], frame: "#4a3018", rug: ["#3a6a34", "#d8b45a", "#1e3a1c"], sky: "trees", emblem: "acorn", mid: "oak", over: "antlers", ivy: true, metal: "#b08a4a" },
    frosthold: { wall: "stone", cols: ["#8a94a6", "#7e889a", "#96a0b0"], mortar: "#4a5060", wains: ["#5a3e28", "#4e3622"], rail: "#8a6a44",
      floor: ["#6e4c30", "#66462c", "#72502f"], fseam: "#3a2616", stone: ["#9aa2b0", "#8a92a2", "#a6aebc"], smortar: "#4e5462", mantel: "#4e3622",
      curtain: ["#7a2a24", "#5a1e1a"], frame: "#4e3622", rug: ["#7a2a24", "#e8dcc0", "#3a1210"], sky: "peaks", emblem: "coat", mid: "coats", over: "antlers", frost: true, metal: "#a8b0bc" },
    ashfen: { wall: "boards", cols: ["#545a46", "#4c5240", "#5a604a"], seam: "#262a20", wains: ["#3e4a3c", "#364234"], rail: "#7a8a64",
      floor: ["#5e5038", "#564a34", "#625438"], fseam: "#2e281c", stone: ["#6e7466", "#5e6458", "#7a8070"], smortar: "#3a3e34", mantel: "#3e3424",
      curtain: ["#4a6a62", "#36504a"], frame: "#2e2a1e", rug: ["#4a6a62", "#d8dcc8", "#26383a"], sky: "marsh", emblem: "lantern", mid: "reeds", over: "eels", damp: true, metal: "#8a9a6a" },
    saltmarrow: { wall: "boards", cols: ["#7e766a", "#746c60", "#6a6458"], seam: "#3a3632", wains: ["#3e5a6e", "#365062"], rail: "#d8d0bc",
      floor: ["#7a5e40", "#715638", "#76593c"], fseam: "#4a3826", stone: ["#8e8e88", "#7c7e7a", "#9c988e"], smortar: "#4a4a46", mantel: "#5a4a3a",
      curtain: null, frame: "#e0dccc", rug: ["#2a6aa8", "#d8d0bc", "#1a3a5a"], sky: "sea", emblem: "gull", mid: "net", over: "helm", metal: "#c8a040" },
    veldrock: { wall: "stone", cols: ["#6a6460", "#5e5854", "#726c66"], mortar: "#36302c", wains: null, rail: null, rough: true,
      floor: ["#6a625a", "#625a52", "#70685e"], fseam: "#3a342e", flags: true, stone: ["#7a726a", "#6a625a", "#847a70"], smortar: "#3a342e", mantel: "#4a3020",
      curtain: ["#b8602a", "#8a4620"], frame: "#3a2a1e", rug: ["#b8602a", "#d8d6d0", "#5a2a12"], sky: "peaks", emblem: "pick", mid: "notices", over: "picks", metal: "#a8a8b0" },
  };
  const DEFAULT = { wall: "boards", cols: ["#7e5230", "#744a2a", "#6c4426"], seam: "#4a2e1c", wains: ["#6a4224", "#623c20"], rail: "#9a6436",
    floor: ["#8e5c34", "#83542f", "#895830"], fseam: "#5a3820", stone: ["#8a8076", "#7a7068", "#948a7e"], smortar: "#4e4640", mantel: "#5e3a1e",
    curtain: ["#7a3a24", "#5a2818"], frame: "#3a2414", rug: ["#8a2a24", "#d8c08a", "#4a1410"], sky: "roofs", emblem: "flagon", mid: "notices", over: null, metal: "#c8a040" };

  // where everything stands, shared by the painting and the things that move
  function layout(W, H) {
    const floor = R(H * 0.62) + 2;
    return { W, H, floor, beam: 3, hx: Math.max(3, R(W * 0.025)), hw: 32, wx: R(W * 0.3), wy: 7, ww: 24, wh: 18,
      cx: R(W * 0.5), mx: R(W * 0.565), bx: R(W * 0.69), ctop: floor - 9, cbot: floor + 4 };
  }

  // ---------- walls: colour at (x, y), h px above the floor ----------
  const WALLS = {
    brick: (lk, x, y) => {
      const row = Math.floor(y / 3), k = x + (row % 2 ? 4 : 0), col = Math.floor(k / 8), fy = y % 3, fx = k % 8;
      if (fy === 2 || fx === 7) return lk.mortar;
      const c = lk.cols[Math.floor(h01(row, col) * 3)], v = h01(col * 1.3, row * 2.1) > 0.92 ? sh(c, -0.14) : c;
      return fy === 0 ? sh(v, 0.1) : fx === 6 ? sh(v, -0.1) : v;
    },
    stone: (lk, x, y) => {
      const sz = lk.rough ? 8 : 7, row = Math.floor(y / sz), w = (lk.rough ? 15 : 12) + Math.floor(h01(row, 3) * 4), k = x + h01(row, 7) * w, col = Math.floor(k / w), fy = y - row * sz, fx = k - col * w;
      const wob = lk.rough ? Math.floor(h01(col, row * 3 + Math.floor(fy / 3)) * 2) : 0;
      if (fy === sz - 1 || fx < 1 + wob) return lk.mortar;
      const c = lk.cols[Math.floor(h01(row, col) * lk.cols.length)], n = h01(x * 3.1, y * 1.7);
      let v = fy === 0 ? sh(c, 0.14) : fy === sz - 2 ? sh(c, -0.16) : fx >= w - 1.5 ? sh(c, -0.1) : fx < 2.5 + wob ? sh(c, 0.06) : c;
      if (n > 0.93) v = sh(v, -0.1); else if (n < 0.05) v = sh(v, 0.08);
      return v;
    },
    plaster: (lk, x, y, h, top) => {
      const p = 44, k = (((x - 8) % p) + p) % p, panel = Math.floor((x - 8) / p);
      if (k < 3) return k === 0 ? sh(lk.timber, 0.18) : k === 2 ? sh(lk.timber, -0.2) : lk.timber;
      if (h === 24 || h === 25) return h === 25 ? sh(lk.timber, 0.15) : lk.timber;
      if (h > 25) {
        const span = top - 26, at = panel % 2 ? (k - 3) / (p - 3) : 1 - (k - 3) / (p - 3);
        if (Math.abs(h - 26 - at * span) < 1.4) return Math.abs(h - 26 - at * span) < 0.7 ? lk.timber : sh(lk.timber, -0.15);
      }
      let v = h01(x, y) > 0.82 ? lk.cols[1] : lk.cols[0];
      if (k === 3 || h === 23 || h === 26) v = sh(v, -0.12);
      if (h01(Math.floor(x / 3), Math.floor(y / 4)) > 0.97) v = sh(v, -0.08);
      return v;
    },
    boards: (lk, x, y) => {
      const bw = 6, col = Math.floor(x / bw), fx = x % bw, cut = Math.floor(h01(col, 1) * 40);
      if (fx === 0 || y === cut) return lk.seam;
      const c = lk.cols[Math.floor(h01(col, 3) * lk.cols.length)], g = h01(col * 7 + fx, Math.floor((y + col * 5) / 4));
      let v = fx === 1 ? sh(c, 0.1) : fx === bw - 1 ? sh(c, -0.12) : c;
      if (g > 0.8 && fx > 1 && fx < bw - 1) v = sh(c, -0.1);
      if (h01(col, 5) > 0.7 && Math.abs(y - 6 - h01(col, 6) * 24) < 1 && fx > 1 && fx < 4) v = sh(c, -0.35);
      return v;
    },
    logs: (lk, x, y) => {
      const sz = 6, row = Math.floor(y / sz), f = y - row * sz, c = lk.cols[row % 2 ? 1 : 0];
      if (f === 0) return h01(x, row) > 0.6 ? "#a89a7a" : "#8a7c60";
      let v = f === 1 ? sh(c, 0.16) : f === 2 ? sh(c, 0.05) : f === sz - 1 ? sh(c, -0.3) : c;
      if (h01(row, Math.floor(x / 4)) > 0.75 && (f === 2 || f === 3)) v = sh(v, -0.12);
      return v;
    },
  };

  // ---------- small sprites from rows ----------
  function pix(ctx, x, y, rows, pal) {
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x + i, y + j, 1, 1); } } });
  }
  const EMBLEM = {
    flagon: [["..ggggggg...", ".gyyyyyyyg..", ".gwyyyyyyggg", ".gyyyyyyyg.g", ".gyyoyyyyg.g", ".gyyoyyyyg.g", ".gyyyyyyygg.", ".gyyyyyyyg..", "..ggggggg..."], { g: "#8a5a14", y: "#e8b84a", w: "#fff4c0", o: "#c8902a" }],
    sheaf: [["..y.y.y..", ".yyyyyyy.", "..yyyyy..", "...yyy...", "..bbbbb..", "...yyy...", "..yyyyy..", ".y.y.y.y."], { y: "#e0b04a", b: "#7a4a24" }],
    scale: [["....m....", "mmmmmmmmm", "m...m...m", "m...m...m", "mm..m..mm", "....m....", "...mmm..."], { m: "#e0c060" }],
    acorn: [["...b...", ".ccccc.", "ccccccc", ".aaaaa.", ".aaaaa.", "..aaa..", "...a..."], { b: "#4a3018", c: "#6a4a24", a: "#c89a4a" }],
    coat: [[".f...f.", "fffffff", "fffffff", ".fffff.", ".fffff.", ".fffff.", ".ff.ff."], { f: "#c8b8a0" }],
    lantern: [["...b...", "..bbb..", ".bgggb.", ".bgygb.", ".bgggb.", "..bbb.."], { b: "#2a2a1e", g: "#5a8a6a", y: "#f0d47a" }],
    gull: [["ww....ww", ".ww..ww.", "..wwww..", "...wy...", "........"], { w: "#f4f0e4", y: "#e8b84a" }],
    pick: [["mm.....mm", ".mm...mm.", "..hh.hh..", "...hhh...", "..hh.hh..", ".hh...hh."], { m: "#c8c8d0", h: "#8a5a32" }],
  };

  function paint(cv, info, r) {
    const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, town = info.town, lk = LOOKS[town] || DEFAULT, L = layout(W, H), { floor } = L;
    const F = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(R(x), R(y), w, h); };
    const P = (x, y, c) => F(x, y, 1, 1, c);
    const wx = info.wx || (town === "frosthold" ? "snow" : "clear");
    Object.assign(info, { tavern: L, look: lk, wxShown: wx });

    // the back wall, its panelling and the beam along the top
    const top = floor - L.beam, wallAt = WALLS[lk.wall] || WALLS.boards, panel = lk.wains ? 7 : 0;
    for (let y = 0; y < floor; y++) for (let x = 0; x < W; x++) {
      const h = floor - 1 - y;
      let c;
      if (h === 0) c = "#1e120a";
      else if (h < panel) {
        const k = x % 4, c0 = lk.wains[Math.floor(h01(Math.floor(x / 4), 2) * 2)];
        c = k === 0 ? sh(lk.wains[1], -0.35) : k === 1 ? sh(c0, 0.08) : c0;
        if (lk.damp && h < 6 && h01(x, 9) > 0.55 - h * 0.06) c = mix(c, "#4a6a3a", 0.35);
      } else if (panel && h < panel + 2) c = h === panel + 1 ? sh(lk.rail, 0.15) : sh(lk.rail, -0.25);
      else c = wallAt(lk, x, y, h, top);
      if (lk.damp && h >= panel + 2 && h < panel + 7 && h01(Math.floor(x / 2), 4) > 0.6 + (h - panel) * 0.06) c = mix(c, "#3e5a34", 0.4);
      P(x, y, c);
    }
    if (panel) for (let x = 0; x < W; x++) P(x, floor - panel - 3, "rgba(0,0,0,0.18)");

    // the ceiling beam and the joists' ends; the Sagging Beam's dips in the middle, propped on a post
    const sagAt = (x) => (lk.sag ? R(Math.sin(Math.min(1, Math.max(0, x / W)) * Math.PI) * 3) : 0);
    for (let x = 0; x < W; x++) {
      const s = sagAt(x);
      F(x, 0, 1, L.beam + s, "#2a1a10"); P(x, L.beam + s - 1, "#4a3020"); P(x, L.beam + s, "rgba(0,0,0,0.35)");
      if (h01(x, 2) > 0.8) P(x, 1, "#3a2416");
    }
    for (let x = 14; x < W; x += 38) { F(x, 0, 6, L.beam + sagAt(x) + 2, "#24160c"); F(x, L.beam + sagAt(x) + 1, 6, 1, "#4a3020"); F(x + 5, 0, 1, L.beam + sagAt(x) + 2, "#1a0e08"); }
    if (lk.sag) {
      const px = R(W * 0.655);
      F(px, L.beam + 3, 4, floor - L.beam - 3, lk.timber || "#4a2e1a"); F(px, L.beam + 3, 1, floor - L.beam - 3, sh(lk.timber || "#4a2e1a", 0.2)); F(px + 3, L.beam + 3, 1, floor - L.beam - 3, sh(lk.timber || "#4a2e1a", -0.3));
      F(px - 2, L.beam + 2, 8, 2, sh(lk.timber || "#4a2e1a", 0.1)); F(px - 1, floor - 2, 6, 2, sh(lk.timber || "#4a2e1a", -0.2));
      F(px + 4, L.beam + 4, 3, 1, "#c8a878"); F(px - 2, L.beam + 4, 2, 1, "#c8a878");
    }
    if (lk.ivy) for (let x = 0; x < W; x += 1) {
      const y = L.beam + 1 + R(Math.abs(Math.sin(x * 0.11)) * 3);
      if (h01(x, 11) < 0.55) P(x, y, h01(x, 12) < 0.5 ? "#3a6a34" : "#4e8a3e");
      if (h01(x, 13) > 0.93) { P(x, y + 1, "#3a6a34"); P(x, y + 2, "#2a5028"); }
    }

    windowAt(ctx, L, lk, wx, town, r, F, P);
    hearth(ctx, L, lk, F, P);
    middle(ctx, L, lk, F, P);
    bar(ctx, L, lk, r, F, P);
    wheel(L, F, P);
    floorBand(ctx, L, lk, r, F, P);
    L.counterDraw(ctx);
    counterTop(ctx, L, F, P);
    lighting(ctx, L, lk, wx);
    return cv;
  }

  // ---------- the window: the town by the evening's light and weather ----------
  const SKIES = {
    clear: ["#1a2246", "#3a3e6a", "#c86a5a"], cloudy: ["#2a3040", "#4a5262", "#7a7a80"], rain: ["#1e2430", "#343c4c", "#4e5664"],
    storm: ["#12141e", "#262a38", "#3a3e4c"], snow: ["#3a4866", "#6a7a98", "#a8b4c8"], fog: ["#7a8088", "#9aa0a6", "#b8bcc0"], heat: ["#4a2a3a", "#a85a4a", "#f0a050"],
  };
  function windowAt(ctx, L, lk, wx, town, r, F, P) {
    const { wx: x0, wy: y0, ww, wh } = L, sky = SKIES[wx] || SKIES.clear, gx = x0 + 2, gy = y0 + 2, gw = ww - 4, gh = wh - 4;
    for (let y = 0; y < gh; y++) { const t = y / (gh - 1); F(gx, gy + y, gw, 1, t < 0.6 ? mix(sky[0], sky[1], t / 0.6) : mix(sky[1], sky[2], (t - 0.6) / 0.4)); }
    const dark = wx === "fog" ? "#7e848c" : wx === "snow" ? "#2e3a52" : wx === "heat" ? "#3a1e24" : "#141626", gl = gy + gh;
    if (wx === "clear") for (let k = 0; k < 6; k++) P(gx + 1 + Math.floor(r() * (gw - 2)), gy + Math.floor(r() * gh * 0.45), k % 2 ? "#f0e8c0" : "#a8b8e0");
    if (wx === "clear") { F(gx + gw - 5, gy + 2, 2, 3, "#f4ecc8"); P(gx + gw - 4, gy + 2, sky[0]); P(gx + gw - 4, gy + 3, sky[0]); }
    const kind = lk.sky;
    if (kind === "sea") {
      F(gx, gl - 5, gw, 5, mix(dark, "#2a4a6a", 0.5)); F(gx, gl - 5, gw, 1, mix(sky[2], "#ffffff", 0.2));
      F(gx + gw - 7, gl - 12, 2, 7, "#e8e0d0"); P(gx + gw - 7, gl - 10, "#c84a3a"); P(gx + gw - 6, gl - 8, "#c84a3a"); F(gx + gw - 8, gl - 13, 4, 1, dark); F(gx + gw - 7, gl - 14, 2, 1, "#ffe080");
    } else if (kind === "peaks") {
      for (let x = 0; x < gw; x++) { const hh = 4 + R(Math.abs(Math.sin(x * 0.45 + 1)) * 6); F(gx + x, gl - hh, 1, hh, mix(dark, sky[1], 0.35)); if (hh > 8) P(gx + x, gl - hh, "#e8f0fc"); }
      for (let x = 0; x < gw; x += 5) { F(gx + x, gl - 4, 4, 4, dark); P(gx + x + 1, gl - 5, dark); P(gx + x + 1, gl - 3, "#f0c060"); }
    } else if (kind === "trees") {
      for (let x = 0; x < gw; x++) { const hh = 6 + R(Math.abs(Math.sin(x * 0.7)) * 5 + Math.sin(x * 2.3) * 1.5); F(gx + x, gl - hh, 1, hh, mix(dark, "#1e3220", 0.6)); }
      for (let k = 0; k < 2; k++) P(gx + 3 + k * 9, gl - 3, "#e8e070");
    } else if (kind === "marsh") {
      F(gx, gl - 4, gw, 4, mix(dark, "#2e4440", 0.6));
      for (let x = 0; x < gw; x += 2) F(gx + x, gl - 4 - (x % 3) - 1, 1, 2 + (x % 3), "#16201e");
      F(gx + 5, gl - 9, 1, 5, "#16201e"); P(gx + 6, gl - 9, "#f0c860");
    } else if (kind === "bridge") {
      F(gx, gl - 4, gw, 4, mix(dark, "#24486e", 0.5));
      for (let x = 0; x < gw; x++) { const d = (x - gw / 2) / (gw * 0.36), arch = d * d < 1 ? R(Math.sqrt(1 - d * d) * 3) : 0; F(gx + x, gl - 9, 1, 4 - arch + 1, mix(dark, "#6a6a70", 0.4)); }
      F(gx, gl - 10, gw, 1, mix(dark, "#8a8a90", 0.5));
    } else if (kind === "mill") {
      for (let x = 0; x < gw; x += 6) { F(gx + x, gl - 4, 5, 4, dark); F(gx + x + 1, gl - 5, 3, 1, dark); P(gx + x + 2, gl - 2, "#f0c060"); }
      const mx = gx + gw - 6; F(mx, gl - 9, 3, 6, dark); for (let k = -3; k <= 3; k++) { P(mx + 1 + k, gl - 10 + k, dark); P(mx + 1 + k, gl - 10 - k, dark); }
    } else {
      for (let x = 0; x < gw;) { const bw = 3 + Math.floor(r() * 3), bh = 3 + Math.floor(r() * 5); F(gx + x, gl - bh, bw, bh, dark); P(gx + x + 1, gl - bh - 1, dark); if (r() < 0.6) P(gx + x + 1, gl - bh + 2, "#f0c060"); if (r() < 0.3) F(gx + x + bw - 1, gl - bh - 3, 1, 3, dark); x += bw; }
    }
    if (wx === "fog") for (let y = 0; y < gh; y++) { ctx.fillStyle = `rgba(200,204,210,${0.15 + 0.25 * (y / gh)})`; ctx.fillRect(gx, gy + y, gw, 1); }
    if (wx === "snow") F(gx, gl - 2, gw, 2, "#e8f0fa");
    // reflections on the glass
    for (let k = 0; k < 4; k++) { P(gx + 2 + k, gy + 5 - k, "rgba(255,255,255,0.22)"); P(gx + gw / 2 + 3 + k, gy + gh / 2 + 4 - k, "rgba(255,255,255,0.14)"); }
    // the frame, the cross bar, the sill
    const fr = lk.frame;
    F(x0, y0, ww, 2, fr); F(x0, y0 + wh - 2, ww, 2, fr); F(x0, y0, 2, wh, fr); F(x0 + ww - 2, y0, 2, wh, fr);
    F(x0 + (ww >> 1) - 1, y0, 2, wh, fr); F(x0, y0 + (wh >> 1) - 1, ww, 2, fr);
    F(x0, y0, ww, 1, sh(fr, 0.2)); F(x0 + ww - 1, y0, 1, wh, sh(fr, -0.3));
    F(x0 - 2, y0 + wh, ww + 4, 2, sh(fr, 0.1)); F(x0 - 2, y0 + wh + 2, ww + 4, 1, sh(fr, -0.35)); F(x0 - 1, y0 + wh + 3, ww + 2, 1, "rgba(0,0,0,0.25)");
    if (lk.frost) for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const e = Math.min(x, gw - 1 - x, y, gh - 1 - y, Math.abs(x - (gw >> 1) + 1), Math.abs(y - (gh >> 1) + 1));
      if (e < 2 && h01(x + gx, y) < (e < 1 ? 0.7 : 0.35)) P(gx + x, gy + y, e < 1 ? "rgba(236,244,255,0.8)" : "rgba(210,226,250,0.5)");
    }
    if (wx === "snow" || lk.frost) F(x0 - 2, y0 + wh - 1, ww + 4, 1, "#e8f0fa");
    // curtains tied back
    if (lk.curtain) for (const side of [0, 1]) {
      const cx = side ? x0 + ww - 1 : x0 - 4;
      for (let y = y0 - 2; y < y0 + wh + 4; y++) {
        const tie = y0 + R(wh * 0.55), bulge = y < tie ? 0 : R(Math.min(2, (y - tie) * 0.5));
        for (let i = 0; i < 5 + bulge; i++) { const xx = side ? cx + i - bulge + 1 : cx + i - 1; P(xx, y, (i + y) % 4 === 0 ? lk.curtain[1] : i === 0 || i === 4 + bulge ? sh(lk.curtain[1], -0.2) : lk.curtain[0]); }
        if (y === tie) F(cx, y, 5, 1, "#e8c060");
      }
      F(x0 - 6, y0 - 3, ww + 12, 1, "#2a1a10");
    }
    L.glass = [[gx, gy, (gw >> 1) - 1, (gh >> 1) - 1], [gx + (gw >> 1) + 1, gy, gw - (gw >> 1) - 1, (gh >> 1) - 1], [gx, gy + (gh >> 1) + 1, (gw >> 1) - 1, gh - (gh >> 1) - 1], [gx + (gw >> 1) + 1, gy + (gh >> 1) + 1, gw - (gw >> 1) - 1, gh - (gh >> 1) - 1]];
  }

  // ---------- the hearth: a stone chimney breast with the fire's mouth, the mantel and the town's piece above it ----------
  function hearth(ctx, L, lk, F, P) {
    const { hx, hw, floor } = L, st = lk.stone, stoneLook = { cols: lk.stone, mortar: lk.smortar, rough: lk.rough };
    for (let y = 0; y < floor; y++) for (let x = hx; x < hx + hw; x++) {
      let c = WALLS.stone(stoneLook, x - hx + 40, y + 3);
      if (x === hx) c = sh(c, 0.12); if (x >= hx + hw - 2) c = sh(c, -0.25);
      c = mix(c, "#2a1810", 0.3 + Math.max(0, (floor - 20 - y) / floor) * 0.3);
      const soot = Math.abs(x - hx - hw / 2) < hw * 0.3 && y < floor - 14 && y > floor - 30 ? (y - floor + 30) / 16 : 0;
      if (soot > 0) c = mix(c, "#140c08", soot * 0.35 * (1 - Math.abs(x - hx - hw / 2) / (hw * 0.3)));
      P(x, y, c);
    }
    F(hx + hw, 0, 1, floor, "rgba(0,0,0,0.3)"); F(hx + hw + 1, 0, 1, floor, "rgba(0,0,0,0.14)");
    // the mouth, arched, sooty within
    const m0 = hx + 5, mw = hw - 10, mt = floor - 14;
    for (let y = mt; y < floor; y++) for (let x = m0; x < m0 + mw; x++) {
      const u = (x - m0 + 0.5) / mw - 0.5, arch = mt + R(Math.pow(Math.abs(u) * 2, 3) * 3);
      if (y < arch) continue;
      const d = (y - mt) / 14;
      P(x, y, mix("#0a0605", "#1e120c", d * 0.6 + (h01(x, y) > 0.8 ? 0.2 : 0)));
    }
    for (let x = m0 - 2; x < m0 + mw + 2; x++) {
      const u = (x - m0 + 0.5) / mw - 0.5, y = mt - 1 + R(Math.pow(Math.min(1, Math.abs(u) * 2), 3) * 3), c = mix(st[(Math.floor((x - m0 + 2) / 3)) % st.length], "#2a1810", 0.25);
      F(x, y - 2, 1, 2, (x - m0 + 2) % 3 === 0 ? lk.smortar : x === m0 + (mw >> 1) || x === m0 + (mw >> 1) - 1 ? sh(c, 0.15) : c); P(x, y, "#120a06");
    }
    for (const side of [m0 - 2, m0 + mw]) for (let y = mt + 2; y < floor; y++) P(side + (side < m0 ? 1 : 0), y, "#120a06");
    // andirons, logs, the ember bed
    F(m0 + 3, floor - 4, 1, 4, "#1a1a1e"); F(m0 + mw - 4, floor - 4, 1, 4, "#1a1a1e"); P(m0 + 3, floor - 5, "#4a4a52"); P(m0 + mw - 4, floor - 5, "#4a4a52");
    F(m0 + 2, floor - 3, mw - 4, 2, "#4a2a16"); F(m0 + 2, floor - 3, mw - 4, 1, "#6a3e20"); F(m0 + 4, floor - 5, mw - 9, 2, "#3e2414"); F(m0 + 4, floor - 5, mw - 9, 1, "#5a3a20");
    P(m0 + 2, floor - 3, "#c8a070"); P(m0 + 2, floor - 2, "#a07850"); P(m0 + mw - 6, floor - 5, "#c8a070");
    for (let x = m0 + 1; x < m0 + mw - 1; x++) if (h01(x, 77) > 0.35) P(x, floor - 1, h01(x, 78) > 0.6 ? "#ffb84a" : "#c84a1a");
    // the mantel on two corbels, with what the house keeps there
    const my = floor - 18;
    F(hx - 3, my, hw + 6, 3, lk.mantel); F(hx - 3, my, hw + 6, 1, sh(lk.mantel, 0.25)); F(hx - 3, my + 2, hw + 6, 1, sh(lk.mantel, -0.3));
    F(hx - 1, my + 3, 3, 2, sh(lk.mantel, -0.15)); F(hx + hw - 2, my + 3, 3, 2, sh(lk.mantel, -0.15)); F(hx - 3, my + 3, hw + 6, 1, "rgba(0,0,0,0.25)");
    const t = my - 1;
    F(hx + 2, t - 4, 3, 4, "#c8a040"); F(hx + 2, t - 4, 1, 4, "#f0d070"); P(hx + 3, t - 5, "#f0e8d0");
    F(hx + 7, t - 3, 2, 3, "#8a3a2a"); P(hx + 7, t - 4, "#8a3a2a"); P(hx + 7, t - 2, "#c8604a");
    F(hx + hw - 9, t - 5, 4, 5, "#d8d0c0"); F(hx + hw - 9, t - 5, 1, 5, "#f0ecdc"); F(hx + hw - 5, t - 4, 1, 2, "#d8d0c0"); F(hx + hw - 9, t - 3, 4, 1, "#3a5a8a");
    F(hx + hw - 4, t - 6, 1, 6, "#e8dcc0"); P(hx + hw - 4, t - 7, "#2a1a10");
    overMantel(ctx, L, lk, hx + (hw >> 1), my - 12, F, P);
    L.fire = [m0 + 2, m0 + mw - 2, floor - 3];
    L.candleMantel = [hx + hw - 4, t - 8];
  }
  function overMantel(ctx, L, lk, cx, cy, F, P) {
    const o = lk.over;
    if (o === "hammers") {
      for (let k = 0; k < 10; k++) { F(cx - 4 + k, cy - 3 + k, 1, 2, k % 3 ? "#a8743c" : "#7a4e26"); F(cx + 4 - k, cy - 3 + k, 1, 2, k % 3 ? "#a8743c" : "#7a4e26"); }
      F(cx - 8, cy - 7, 6, 4, "#3a3a42"); F(cx - 7, cy - 6, 4, 2, "#a8a8b4"); F(cx - 7, cy - 6, 4, 1, "#e0e0ea");
      F(cx + 3, cy - 7, 6, 4, "#3a3a42"); F(cx + 4, cy - 6, 4, 2, "#a8a8b4"); F(cx + 4, cy - 6, 4, 1, "#e0e0ea");
    } else if (o === "antlers") {
      pix(ctx, cx - 6, cy - 4, ["a.a.....a.a", ".aa.....aa.", "a.a.....a.a", "..aa...aa..", "...aaaaa...", "....www....", "....www...."], { a: "#e8dcc4", w: lk.mantel });
    } else if (o === "sheaf") {
      pix(ctx, cx - 4, cy - 5, EMBLEM.sheaf[0], EMBLEM.sheaf[1]);
    } else if (o === "oars") {
      for (let k = 0; k < 11; k++) { P(cx - 5 + k, cy - 5 + k, "#a8784a"); P(cx + 5 - k, cy - 5 + k, "#a8784a"); }
      F(cx - 7, cy - 7, 3, 3, "#c89a5a"); F(cx + 5, cy - 7, 3, 3, "#c89a5a");
    } else if (o === "eels") {
      F(cx - 6, cy - 6, 13, 1, "#3a2a1a");
      for (let k = 0; k < 3; k++) { const x = cx - 4 + k * 4; for (let j = 0; j < 8; j++) P(x + (j % 3 === 1 ? 1 : 0), cy - 5 + j, j === 0 ? "#2a2a1e" : "#5a6a4a"); }
    } else if (o === "helm") {
      pix(ctx, cx - 4, cy - 6, ["....w....", ".w..w..w.", "..wbbbw..", "..b...b..", "wwb.h.bww", "..b...b..", "..wbbbw..", ".w..w..w.", "....w...."], { w: "#9a6a3a", b: "#6a4424", h: "#c8a040" });
    } else if (o === "picks") {
      pix(ctx, cx - 5, cy - 5, ["mm.......mm", ".mm.....mm.", "..hh...hh..", "...hh.hh...", "....hhh....", "...hh.hh...", "..hh...hh..", ".hh.....hh."], { m: "#b8b8c0", h: "#7a5232" });
    }
  }

  // ---------- the wall between the window and the bar: notices, or the town's own piece ----------
  function middle(ctx, L, lk, F, P) {
    const x = L.mx, y = 9, o = lk.mid;
    if (o === "oak") {
      // an old oak grows up through the floor and out through the roof; a knot in it keeps an eye on the room
      const ox = x + 2, ow = 13;
      for (let yy = 0; yy < L.floor; yy++) for (let i = 0; i < ow + (yy > L.floor - 6 ? (L.floor - yy < 3 ? 4 : 2) : 0); i++) {
        const xx = ox + i - (yy > L.floor - 6 ? (L.floor - yy < 3 ? 2 : 1) : 0), groove = (i * 3 + Math.floor(yy / 5 + h01(i, 1) * 3)) % 4 === 0;
        P(xx, yy, groove ? "#2e2012" : i < 2 ? "#6a5032" : i > ow - 3 ? "#2a1c10" : h01(i, Math.floor(yy / 3)) > 0.7 ? "#5a4228" : "#4a3620");
      }
      for (let i = 0; i < 26; i++) { const bx = ox + ow + i, by = L.beam + 2 + R(Math.sin(i * 0.25) * 2); F(bx, by, 1, 3, i % 5 ? "#4a3620" : "#2a1c10"); if (h01(i, 3) > 0.5) P(bx, by - 1, "#3a6a34"); if (h01(i, 4) > 0.6) P(bx, by + 3, "#4e8a3e"); }
      F(ox + 3, 17, 7, 5, "#2a1c10"); F(ox + 4, 18, 5, 3, "#3a2814"); F(ox + 4, 19, 5, 1, "#140c06");
      L.eye = [ox + 4, 18];
      return;
    }
    if (o === "coats") {
      // three coats on their pegs, the Third Coat's own
      F(x - 2, y + 1, 26, 2, lk.mantel); F(x - 2, y + 1, 26, 1, sh(lk.mantel, 0.2));
      [["#c8b8a0", "#a89880"], ["#6a5038", "#4a3624"], ["#7a2a24", "#5a1e1a"]].forEach(([c, d], k) => {
        const cx = x + 1 + k * 8;
        F(cx + 2, y + 3, 2, 1, "#2a1a10");
        for (let j = 0; j < 16; j++) { const w = j < 3 ? 4 + j : 7; F(cx + 3 - (w >> 1), y + 4 + j, w, 1, j % 5 === 2 ? d : c); P(cx + 3 - (w >> 1), y + 4 + j, d); }
        F(cx + 1, y + 4, 1, 3, sh(c, 0.25)); F(cx + 3, y + 7, 1, 12, d);
      });
      return;
    }
    if (o === "wheel") {
      // a cartwheel hung on the wall and a sheaf of wheat
      const cx = x + 8, cy = y + 9, rr = 7;
      for (let a = 0; a < 64; a++) { const t = (a / 64) * Math.PI * 2; P(cx + R(Math.cos(t) * rr), cy + R(Math.sin(t) * rr), "#6a4424"); P(cx + R(Math.cos(t) * (rr - 1)), cy + R(Math.sin(t) * (rr - 1)), "#8a5a30"); }
      for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; for (let d = 1; d < rr - 1; d++) P(cx + R(Math.cos(t) * d), cy + R(Math.sin(t) * d), "#7a4e2a"); }
      F(cx - 1, cy - 1, 3, 3, "#4a2e1a"); P(cx, cy, "#b0a490");
      pix(ctx, x + 18, y + 2, EMBLEM.sheaf[0], EMBLEM.sheaf[1]);
      return;
    }
    if (o === "toll") {
      // the toll board: what crossing costs, in coins nailed up
      F(x, y, 22, 15, "#3a2a1c"); F(x + 1, y + 1, 20, 13, "#e0d8c0"); F(x + 1, y + 1, 20, 1, "#f4ecd8");
      for (let k = 0; k < 4; k++) { F(x + 3, y + 3 + k * 3, 8, 1, "#7a6a5a"); F(x + 14, y + 3 + k * 3, 2, 2, "#c8a040"); P(x + 14, y + 3 + k * 3, "#f0d070"); if (k % 2) F(x + 17, y + 3 + k * 3, 2, 2, "#a8a8b0"); }
      // and a little painting of the bridge
      F(x - 1, y + 18, 16, 9, "#3a2a1c"); F(x, y + 19, 14, 7, "#7aa8c8"); F(x, y + 23, 14, 3, "#3a6a8a");
      for (let i = 0; i < 14; i++) { const d = (i - 7) / 5, a = d * d < 1 ? R(Math.sqrt(1 - d * d) * 2) : 0; F(x + i, y + 21, 1, 3 - a, "#8a8a90"); }
      return;
    }
    if (o === "net") {
      // a fishing net swagged along the wall with its cork floats, and a life ring
      for (let i = 0; i < 40; i++) for (let k = 0; k < 6; k++) {
        const sag = Math.sin((i / 39) * Math.PI) * 5, yy = y - 2 + k * 2 + sag * (k / 5);
        if ((i + k) % 2 === 0) P(x - 8 + i, R(yy), k === 0 ? "#8a7a5a" : "#c8b892");
      }
      for (const [i, c] of [[4, "#d84a3a"], [14, "#e8d8b0"], [24, "#d84a3a"], [34, "#e8d8b0"]]) { const yy = R(y + 9 + Math.sin((i / 39) * Math.PI) * 5); F(x - 8 + i, yy, 3, 2, c); P(x - 8 + i, yy, sh(c, 0.4)); }
      pix(ctx, x + 6, y + 15, [".rrww.", "r....w", "w....r", "w....r", "r....w", ".wwrr."], { r: "#d84a3a", w: "#f4f0e4" });
      return;
    }
    if (o === "reeds") {
      // reed bundles drying on the wall, and the damp's bucket on the floor below the leak
      for (let k = 0; k < 3; k++) {
        const bx = x + k * 7;
        for (let i = 0; i < 5; i++) F(bx + i, y + 1 + Math.abs(2 - i), 1, 15 - Math.abs(2 - i) * 2, i % 2 ? "#a89a5a" : "#8a7c44");
        F(bx, y + 7, 5, 1, "#5a3a20"); for (let i = 0; i < 5; i += 2) F(bx + i, y - 1, 1, 2, "#6a5a2a");
      }
      const bx = x + 20, by = L.floor + 2;
      F(bx, by - 6, 7, 6, "#5a4a32"); F(bx, by - 6, 7, 1, "#8a7a5a"); F(bx - 1, by - 6, 9, 1, "#3a3424"); F(bx, by - 3, 7, 1, "#3a3424"); F(bx + 1, by - 5, 5, 1, "#5a7a6a");
      L.leak = [bx + 3, by - 6];
      return;
    }
    // a notice board: bills, a wanted face, a map corner
    F(x, y, 22, 16, "#5a3a1e"); F(x + 1, y + 1, 20, 14, "#a8784a");
    for (let i = 0; i < 20; i++) for (let j = 0; j < 14; j++) if (h01(i + x, j) > 0.8) P(x + 1 + i, y + 1 + j, "#946840");
    F(x, y, 22, 1, "#7a5230"); F(x, y + 15, 22, 1, "#3a2414");
    const note = (nx, ny, w, h, c, pin) => { F(nx, ny, w, h, c); F(nx, ny + h, w, 1, "rgba(0,0,0,0.25)"); for (let k = 1; k < h - 1; k += 2) F(nx + 1, ny + k, w - 2 - (k % 3), 1, sh(c, -0.35)); P(nx + (w >> 1), ny, pin); };
    note(x + 2, y + 2, 7, 8, "#ece0c0", "#c83a2a");
    F(x + 11, y + 3, 8, 10, "#e8d8b0"); F(x + 13, y + 5, 4, 4, "#5a4030"); F(x + 14, y + 6, 2, 1, "#e8d8b0"); F(x + 12, y + 10, 6, 1, "#8a3a2a"); F(x + 12, y + 12, 6, 1, "rgba(0,0,0,0.2)"); P(x + 15, y + 3, "#3a5a8a");
    note(x + 4, y + 10, 6, 4, "#d8e0c8", "#e8c040");
  }

  // ---------- the bar: tankards on hooks, the house sign, bottles, kegs, the counter ----------
  function bar(ctx, L, lk, r, F, P) {
    const { bx, W, floor, ctop } = L;
    // tankards hanging from a rail under the beam
    F(bx - 2, L.beam + 2, W - bx + 2, 1, "#3a2414");
    for (let x = bx + 1; x < W - 4; x += 7) {
      F(x + 1, L.beam + 3, 1, 1, "#1a1a1e");
      const m = (x / 7) % 3 < 1 ? lk.metal : (x / 7) % 3 < 2 ? "#a8b0b8" : "#8a5a34";
      F(x, L.beam + 4, 4, 5, m); F(x, L.beam + 4, 1, 5, sh(m, 0.3)); F(x + 3, L.beam + 4, 1, 5, sh(m, -0.3)); F(x + 4, L.beam + 5, 1, 3, sh(m, -0.2)); F(x, L.beam + 6, 4, 1, sh(m, -0.15));
    }
    // the house's sign over the bar
    const [rows, pal] = EMBLEM[lk.emblem] || EMBLEM.flagon, ew = rows[0].length, eh = rows.length, sx = R(bx + (W - bx) * 0.5 - (ew + 6) / 2), sy = L.beam + 11;
    F(sx, sy, ew + 6, eh + 6, "#2a1a10"); F(sx + 1, sy + 1, ew + 4, eh + 4, lk.rug[0]); F(sx + 1, sy + 1, ew + 4, 1, sh(lk.rug[0], 0.25)); F(sx + 1, sy + eh + 4, ew + 4, 1, sh(lk.rug[0], -0.3));
    F(sx + 2, sy + 2, ew + 2, eh + 2, sh(lk.rug[0], -0.12));
    if (lk.emblem !== "scale") pix(ctx, sx + 3, sy + 3, rows, pal);
    L.sign = [sx + 3, sy + 3, ew, eh];
    // bottles on a shelf either side of it
    const shelfY = sy + eh + 4;
    for (const [a, b] of [[bx + 1, sx - 2], [sx + ew + 8, W - 1]]) {
      if (b - a < 4) continue;
      F(a, shelfY, b - a, 2, "#5a361c"); F(a, shelfY, b - a, 1, "#7a4e2a"); F(a, shelfY + 2, b - a, 1, "rgba(0,0,0,0.3)");
      for (let x = a + 1; x < b - 2; x += 3 + Math.floor(r() * 2)) {
        const col = ["#4e7a34", "#8a3a2a", "#c8a040", "#2e5a7a", "#d8d0c0", "#5a3a20"][Math.floor(r() * 6)], tall = 4 + Math.floor(r() * 3);
        F(x, shelfY - tall, 2, tall, sh(col, -0.3)); F(x, shelfY - tall, 1, tall, col); F(x, shelfY - tall - 2, 1, 2, sh(col, -0.2)); P(x, shelfY - tall + 1, "rgba(255,248,220,0.6)");
      }
    }
    // kegs end-on on their rack, a brass tap in each
    const ky = ctop - 5, kegs = [];
    for (let x = sx + 3 - 22; x <= sx + 3 + 22; x += 11) if (x > bx - 2 && x < W - 10) kegs.push(x);
    F(bx - 2, ky + 5, W - bx + 2, 2, "#2a1a10"); F(bx - 2, ky + 5, W - bx + 2, 1, "#4a3020");
    for (const kx of kegs) {
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
        const d = Math.hypot(i, j);
        if (d > 4.4) continue;
        const ring = d > 3.6 || Math.abs(d - 2) < 0.4, c = j < -1 ? "#8a5e34" : j > 1 ? "#5a3a20" : "#74502c";
        P(kx + 4 + i, ky + j, ring ? (j < 0 ? "#9a9aa4" : "#4a4a54") : h01(i + kx, 5) > 0.85 ? sh(c, -0.15) : c);
      }
      P(kx + 4, ky, "#2a1a10"); F(kx + 4, ky + 1, 1, 3, lk.metal); P(kx + 5, ky + 1, lk.metal); P(kx + 4, ky + 4, "#2a1a10");
    }
    // the counter: a thick top, panelled front, a brass foot rail
    const c0 = bx - 4, cb = L.cbot;
    L.counterDraw = (ctx2) => {
      const G = (x, y, w, h, c) => { ctx2.fillStyle = c; ctx2.fillRect(R(x), R(y), w, h); };
      G(c0 - 1, cb, W - c0 + 1, 2, "rgba(10,6,4,0.45)");
      G(c0, ctop + 4, W - c0, cb - ctop - 4, "#4a2a16");
      for (let x = c0; x < W; x++) {
        const k = (x - c0) % 12;
        if (k === 0) G(x, ctop + 4, 1, cb - ctop - 4, "#24140a");
        else if (k === 1) G(x, ctop + 4, 1, cb - ctop - 4, "#6a4222");
        else if (k > 2 && k < 11) { G(x, ctop + 6, 1, 1, "#24140a"); G(x, cb - 3, 1, 1, "#6a4222"); if (k === 3) G(x, ctop + 6, 1, cb - ctop - 9, "#24140a"); if (k === 10) G(x, ctop + 6, 1, cb - ctop - 9, "#6a4222"); if (k > 3 && k < 10) G(x, ctop + 7, 1, cb - ctop - 10, h01(x, 3) > 0.8 ? "#3e2412" : "#45281a"); }
      }
      G(c0 - 3, ctop, W - c0 + 3, 2, "#8a5630"); G(c0 - 3, ctop, W - c0 + 3, 1, "#c08446"); G(c0 - 3, ctop + 2, W - c0 + 3, 2, "#5a341a"); G(c0 - 3, ctop + 3, W - c0 + 3, 1, "#2a180c"); G(c0, ctop + 4, W - c0, 1, "rgba(0,0,0,0.4)");
      G(c0, cb - 2, W - c0, 1, lk.metal); G(c0, cb - 1, W - c0, 1, sh(lk.metal, -0.4));
      for (let x = c0 + 6; x < W; x += 28) G(x, cb - 2, 1, 3, sh(lk.metal, -0.3));
    };
    L.candleBar = [W - 22, ctop - 9];
    L.c0 = c0;
  }

  // on the counter: a pitcher, mugs, a candle stuck in a bottle
  function counterTop(ctx, L, F, P) {
    const on = L.ctop - 1, c0 = L.c0, [cx] = L.candleBar;
    F(c0 + 8, on - 4, 4, 5, "#d8d0c0"); F(c0 + 8, on - 4, 1, 5, "#f0ecdc"); F(c0 + 12, on - 3, 1, 2, "#d8d0c0"); P(c0 + 7, on - 4, "#d8d0c0");
    for (const mx of [c0 + 22, c0 + 27]) { F(mx, on - 3, 3, 4, "#8a5a34"); F(mx, on - 3, 3, 1, "#f4ecd0"); F(mx + 3, on - 2, 1, 2, "#6a4424"); }
    F(cx, on - 4, 2, 5, "#3a5a2a"); P(cx, on - 3, "#5a8a4a"); F(cx, on - 7, 2, 3, "#e8dcc0"); F(cx - 1, on - 5, 1, 1, "#e8dcc0");
  }

  // a wheel of candles hung on a chain from the beam
  function wheel(L, F, P) {
    const { cx } = L, y = L.beam + 8;
    for (let k = 0; k < 3; k++) { F(cx - 6 + k * 6, L.beam, 1, y - L.beam - 1, "#1a1a1e"); }
    for (let yy = L.beam - 1; yy < y - 1; yy++) if (yy % 2) P(cx, yy, "#3a3a42");
    F(cx - 13, y, 27, 2, "#3a2414"); F(cx - 13, y, 27, 1, "#6a4424"); F(cx - 14, y + 1, 2, 2, "#2a1a10"); F(cx + 13, y + 1, 2, 2, "#2a1a10");
    const cs = [cx - 12, cx - 6, cx, cx + 6, cx + 12];
    for (const x of cs) { F(x, y - 3, 1, 3, "#f0e8d0"); P(x, y - 3, "#ffffff"); if (h01(x, 1) > 0.5) P(x - 1, y, "#f0e8d0"); }
    L.candles = cs.map((x) => [x, y - 4]);
  }

  // ---------- the floor: boards (or flagstones) toward us, the hearthstone, a rug in the town's colours ----------
  function floorBand(ctx, L, lk, r, F, P) {
    const { W, H, floor } = L, seam = lk.fseam || lk.seam;
    let y = floor, row = 0, hgt = 2;
    while (y < H) {
      const off = Math.floor(h01(row, 2) * 40);
      if (lk.flags) {
        let x = -off;
        while (x < W) { const w = 10 + hgt * 3 + Math.floor(h01(row, x) * 10), c = lk.floor[Math.floor(h01(row, x + 1) * 3)];
          F(x + 1, y + 1, w - 1, hgt - 1, c); F(x + 1, y + 1, w - 1, 1, sh(c, 0.1)); F(x, y, 1, hgt, seam); x += w; }
        F(0, y, W, 1, seam);
      } else {
        let x = -off;
        while (x < W) {
          const w = 24 + Math.floor(h01(row, x) * 40), c = lk.floor[Math.floor(h01(row, x + 3) * lk.floor.length)];
          F(x, y, w, hgt, c); F(x, y, w, 1, sh(c, 0.08)); F(x, y, 1, hgt, seam);
          for (let g = 0; g < hgt * 2; g++) { const gx = x + 2 + Math.floor(h01(row * 9 + g, x) * (w - 6)), gl = 3 + Math.floor(h01(g, row + x) * 6); F(gx, y + 1 + (g % Math.max(1, hgt - 1)), gl, 1, sh(c, -0.1)); }
          if (hgt > 2) { P(x + 2, y + (hgt >> 1), sh(c, -0.35)); P(x + w - 3, y + (hgt >> 1), sh(c, -0.35)); }
          x += w;
        }
        F(0, y, W, 1, seam);
      }
      y += hgt; row++; hgt = Math.min(7, hgt + (row % 2 ? 1 : 0));
    }
    const sg = ctx.createLinearGradient(0, floor, 0, floor + 6);
    sg.addColorStop(0, "rgba(10,6,4,0.55)"); sg.addColorStop(1, "rgba(10,6,4,0)");
    ctx.fillStyle = sg; ctx.fillRect(0, floor, W, 6);
    // the hearthstone
    const { hx, hw } = L;
    F(hx - 4, floor, hw + 8, 4, mix(lk.stone[1], "#2a1810", 0.35)); F(hx - 4, floor, hw + 8, 1, mix(lk.stone[0], "#2a1810", 0.15)); F(hx - 4, floor + 4, hw + 8, 1, "rgba(0,0,0,0.35)");
    for (let x = hx; x < hx + hw; x += 9) F(x, floor + 1, 1, 3, lk.smortar);
    // the rug under the crowd, with a border and fringe
    const rx0 = R(W * 0.17), rx1 = R(W * 0.62), ry0 = floor + 6, ry1 = Math.min(H - 3, floor + 18), [c1, c2, c3] = lk.rug;
    for (let yy = ry0; yy < ry1; yy++) for (let xx = rx0; xx < rx1; xx++) {
      const bx = Math.min(xx - rx0, rx1 - 1 - xx), by = Math.min(yy - ry0, ry1 - 1 - yy), b = Math.min(bx, by * 2);
      let c = b < 1 ? c3 : b < 3 ? c2 : b < 4 ? c3 : c1;
      if (b >= 4) { const u = (xx - rx0) % 12 - 6, v = (yy - ry0) - (ry1 - ry0) / 2; if (Math.abs(u) + Math.abs(v) * 1.6 < 3.2) c = c2; else if (Math.abs(u) + Math.abs(v) * 1.6 < 4.2) c = c3; }
      if (h01(xx, yy) > 0.9) c = sh(c, -0.1);
      P(xx, yy, c);
    }
    F(rx0, ry1, rx1 - rx0, 1, "rgba(0,0,0,0.3)");
    for (let yy = ry0; yy < ry1; yy += 2) { P(rx0 - 1, yy, c2); P(rx0 - 2, yy, sh(c2, -0.2)); P(rx1, yy, c2); P(rx1 + 1, yy, sh(c2, -0.2)); }
    L.rug = [rx0, ry0, rx1, ry1];
  }

  // ---------- light: the room in shadow, pooled warm round the fire and the candles, cool by the window ----------
  function lighting(ctx, L, lk, wx) {
    const { W, H, floor } = L, dk = document.createElement("canvas");
    dk.width = W; dk.height = H;
    const d = dk.getContext("2d");
    const g0 = d.createLinearGradient(0, 0, 0, H);
    g0.addColorStop(0, "rgba(14,8,6,0.72)"); g0.addColorStop(0.5, "rgba(14,8,6,0.36)"); g0.addColorStop(0.68, "rgba(14,8,6,0.3)"); g0.addColorStop(1, "rgba(14,8,6,0.5)");
    d.fillStyle = g0; d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = "destination-out";
    const hole = (x, y, r, a, sx) => { d.save(); d.translate(x, y); d.scale(sx || 1, 1); const g = d.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, "rgba(0,0,0,0)"); d.fillStyle = g; d.fillRect(-r, -r, r * 2, r * 2); d.restore(); };
    const fx = (L.fire[0] + L.fire[1]) / 2;
    hole(fx, floor - 4, 60, 0.95, 1.4);
    hole(L.cx, L.beam + 10, 44, 0.8, 1.5);
    hole(L.candleBar[0], L.candleBar[1], 30, 0.7);
    hole(L.wx + L.ww / 2, L.wy + L.wh / 2, 18, 0.5);
    hole(W * 0.4, floor + 10, 50, 0.5, 2.2);
    ctx.drawImage(dk, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const warm = (x, y, r, rgb, a, sx) => { ctx.save(); ctx.translate(x, y); ctx.scale(sx || 1, 1); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore(); };
    warm(fx, floor - 3, 34, "255,130,50", 0.3, 1.5);
    warm(fx, floor + 4, 22, "255,150,60", 0.22, 2.6);
    warm(L.cx, L.beam + 8, 30, "255,190,100", 0.16, 1.4);
    warm(L.candleBar[0], L.candleBar[1], 16, "255,190,100", 0.18);
    const cool = wx === "heat" ? "255,170,90" : wx === "fog" || wx === "snow" ? "200,214,235" : "120,150,210";
    warm(L.wx + L.ww / 2, L.wy + L.wh + 3, 14, cool, 0.1, 1.6);
    ctx.restore();
  }

  // ---------- what moves ----------
  function flame(ctx, x, y, t, s, big) {
    const f = Math.sin(t * 9.1 + s) * 0.5 + Math.sin(t * 23.3 + s * 1.7) * 0.3, h = (big ? 3 : 2) + (f > 0.2 ? 1 : 0), lean = Math.sin(t * 4 + s) > 0.6 ? 1 : 0;
    ctx.fillStyle = "#ff9a30"; ctx.fillRect(x, y - h + 1, 1, h);
    ctx.fillStyle = "#ffe88a"; ctx.fillRect(x, y - h + 2, 1, h - 1);
    ctx.fillStyle = "#fff8d8"; ctx.fillRect(x, y, 1, 1);
    if (lean) { ctx.fillStyle = "#ffb84a"; ctx.fillRect(x + 1, y - h + 1, 1, 1); }
  }
  // patrons and the keeper as dark shapes, rim-lit by the candles
  const SHAPES = {
    sit: ["....hhh....", "...hhhhh...", "..hhhhhhh..", "..hhhhhhh..", "..hhhhhhh..", "...hhhhh...", "..bbbbbbb..", ".bbbbbbbbb.", "bbbbbbbbbbb", "bbbbbbbbbbb",
      "bbbbbbbbbbb", "bbbbbbbbbbb", ".bbbbbbbbb.", ".bbbbbbbbb.", "..bbbbbbb..", ".sssssssss.", "..l.....l..", "..l.....l..", "..l.....l..", ".l.......l.", ".l.......l."],
    stand: ["...hhhhh...", "...hhhhh...", ".hhhhhhhhh.", "...fffff...", "...fffff...", "....fff....", "..bbbbbbb..", ".bbbbbbbbb.", "bbbbbbbbbbb", "bbbbbbbbbbb", "bbbbbbbbbbb",
      "bbbbbbbbbbb", ".bbbbbbbbb.", ".bbbbbbbbb.", "..bbbbbbb..", "..bb...bb..", "..bb...bb..", "..bb...bb..", "..bb...bb..", "..bb...bb..", "..bb...bb..", ".bbb...bbb."],
    keep: ["...hhhhh...", "..hhhhhhh..", "..hfffffh..", "..fffffff..", "..fffffff..", "...fffff...", "....fff....", "..aaaaaaa..", ".aaaaaaaaa.", "aaaawwwaaaa", "aaaawwwaaaa", "aaaawwwaaaa"],
  };
  const shapeCache = {};
  function shape(k, body) {
    const key = k + body;
    if (shapeCache[key]) return shapeCache[key];
    const rows = SHAPES[k], c = document.createElement("canvas");
    c.width = rows[0].length; c.height = rows.length;
    const pal = { h: mix(body, "#000000", 0.3), f: mix(body, "#8a5a40", 0.25), b: body, a: body, s: "#3a2414", l: "#24160e", w: mix(body, "#e8dcc0", 0.3) };
    pix(c.getContext("2d"), 0, 0, rows, pal);
    const g = c.getContext("2d");
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== "." && (i === 0 || row[i - 1] === ".") && "hbaf".includes(row[i])) { g.fillStyle = mix(body, "#e8a060", 0.35); g.fillRect(i, j, 1, 1); } });
    return (shapeCache[key] = c);
  }
  function regular(o) {
    const img = shape(o.kind, o.body), s = o.seed || 0;
    return { z: o.y, draw(ctx, t) {
      const bob = frac(t / 3.6 + s) < 0.45 ? 1 : 0, lift = frac(t / 7.3 + s * 0.37), up = lift > 0.7 && lift < 0.88;
      ctx.drawImage(img, 0, 0, img.width, 6, o.x, o.y - img.height + bob, img.width, 6);
      ctx.drawImage(img, 0, 6, img.width, img.height - 6, o.x, o.y - img.height + 6, img.width, img.height - 6);
      if (o.kind === "keep") {
        const a = t * 2.4 + s * 5, hx = o.x + 5 + R(Math.cos(a) * 1.5), hy = o.y - 3 + R(Math.sin(a) * 0.8);
        ctx.fillStyle = "#c8c0b0"; ctx.fillRect(hx, hy, 2, 2); ctx.fillStyle = "#f0ecdc"; ctx.fillRect(hx, hy, 1, 1);
      } else if (o.mug) {
        const mx = o.x + (o.left ? -1 : img.width - 1), my = o.y - img.height + (up ? 4 : 9);
        ctx.fillStyle = mix(o.body, "#000000", 0.1); ctx.fillRect(mx, my + 1, 1, up ? 4 : 2);
        ctx.fillStyle = "#8a5a34"; ctx.fillRect(mx + (o.left ? -1 : 0), my - 1, 2, 3); ctx.fillStyle = "#c8a070"; ctx.fillRect(mx + (o.left ? -1 : 0), my - 1, 2, 1);
      }
    } };
  }
  function windowLife(L, wx, seed) {
    const panes = L.glass, [gx, gy] = panes[0], gw = L.ww - 4, gh = L.wh - 4;
    return { z: 2, draw(ctx, t) {
      ctx.save(); ctx.beginPath(); for (const [x, y, w, h] of panes) ctx.rect(x, y, w, h); ctx.clip();
      if (wx === "rain" || wx === "storm") {
        ctx.fillStyle = "rgba(150,175,215,0.7)";
        for (let i = 0; i < (wx === "storm" ? 14 : 10); i++) { const x = gx + frac(i * 0.37 + t * 0.15) * (gw + 6) - 3, y = gy + frac(i * 0.61 + t * 1.6) * (gh + 8) - 5; ctx.fillRect(R(x), R(y), 1, 3); ctx.fillRect(R(x) - 1, R(y) + 3, 1, 2); }
        ctx.fillStyle = "rgba(190,210,240,0.5)";
        for (let i = 0; i < 3; i++) { const x = gx + 2 + ((i * 7) % (gw - 4)), y = gy + frac(i * 0.4 + t * 0.12) * gh; ctx.fillRect(x, R(y), 1, 1); ctx.fillRect(x, R(y) - 2, 1, 1); }
        if (wx === "storm" && frac(t / 6.1 + seed) < 0.03) { ctx.fillStyle = "rgba(236,240,255,0.75)"; ctx.fillRect(gx, gy, gw, gh); }
      } else if (wx === "snow") {
        ctx.fillStyle = "#f0f6ff";
        for (let i = 0; i < 10; i++) { const x = gx + frac(i * 0.29 + Math.sin(t * 0.8 + i) * 0.04) * gw, y = gy + frac(i * 0.53 + t * (0.18 + (i % 3) * 0.05)) * gh; ctx.fillRect(R(x), R(y), 1, 1); }
      } else if (wx === "fog") {
        ctx.fillStyle = "rgba(220,224,228,0.35)";
        for (let k = 0; k < 3; k++) { const x = gx - 8 + frac(t * 0.04 * (k + 1) + k * 0.3) * (gw + 16); ctx.fillRect(R(x), gy + gh - 7 + k * 2, 10, 2); }
      } else if (wx === "heat") {
        ctx.fillStyle = "rgba(255,210,150,0.25)";
        const y = gy + gh - 4 + R(Math.sin(t * 2) * 1); ctx.fillRect(gx, y, gw, 1);
      } else {
        const k = Math.floor(t / 1.3 + seed) % 6;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(gx + 2 + ((k * 7) % (gw - 4)), gy + 1 + ((k * 5) % 5), 1, 1);
      }
      ctx.restore();
    } };
  }
  function fire(L, seed) {
    const [x0, x1, base] = L.fire;
    return { z: 3, draw(ctx, t) {
      for (let x = x0; x < x1; x++) {
        const u = (x - x0 + 0.5) / (x1 - x0), env = Math.sin(u * Math.PI);
        const h = R(env * (6 + 2.2 * Math.sin(t * 7.3 + x * 1.3 + seed) + 1.6 * Math.sin(t * 12.7 - x * 0.9)));
        for (let k = 0; k < h; k++) {
          const f = k / h;
          ctx.fillStyle = f < 0.25 ? (env > 0.7 ? "#fff4c0" : "#ffd860") : f < 0.55 ? "#ffb040" : f < 0.85 ? "#ff7a2a" : "#d8401c";
          ctx.fillRect(x, base - k, 1, 1);
        }
        if (h > 4 && frac(t * 1.7 + x * 0.37) < 0.18) { ctx.fillStyle = "#ff7a2a"; ctx.fillRect(x, base - h - 1 - R(frac(t * 3 + x) * 2), 1, 1); }
      }
    } };
  }
  function eye(L, seed) {
    const [x, y] = L.eye;
    return { z: 2, draw(ctx, t) {
      const b = frac(t / 5.3 + seed);
      if (b > 0.94) return;
      ctx.fillStyle = "#e8dcb0"; ctx.fillRect(x, y + 1, 5, 1); ctx.fillRect(x + 1, y, 3, 3);
      const look = R(Math.sin(t * 0.35 + seed * 6) * 1.2);
      ctx.fillStyle = "#1a2a12"; ctx.fillRect(x + 2 + look, y + 1, 1, 1); ctx.fillStyle = "#4e8a3e"; ctx.fillRect(x + 2 + look, y, 1, 1);
    } };
  }
  function scale(L, metal) {
    const [sx, sy, ew] = L.sign, cx = sx + (ew >> 1), y = sy;
    return { z: 2, draw(ctx, t) {
      const tilt = R(Math.sin(t * 0.9) * 1.2);
      ctx.fillStyle = metal; ctx.fillRect(cx, y, 1, 6);
      for (let i = -4; i <= 4; i++) ctx.fillRect(cx + i, y + 1 + R((i / 4) * tilt * 0.5), 1, 1);
      for (const side of [-1, 1]) { const px = cx + side * 4, py = y + 2 + R(side * tilt * 0.5); ctx.fillRect(px, py, 1, 2); ctx.fillRect(px - 1, py + 2, 3, 1); }
      ctx.fillRect(cx - 1, y + 6, 3, 1);
    } };
  }
  function dust(L, seed) {
    const px = R(L.W * 0.5);
    return { z: 2, draw(ctx, t) {
      for (let i = 0; i < 2; i++) {
        const p = frac(t / 4.7 + i * 0.5 + seed);
        if (p > 0.6) continue;
        ctx.fillStyle = "#c8b898"; ctx.fillRect(px - 6 + i * 11 + R(Math.sin(t + i) * 1), L.beam + 4 + R(p * 40), 1, 1);
      }
    } };
  }

  function actors(info, A, s) {
    const L = info.tavern, lk = info.look, out = [], add = (x) => { if (x) out.push(x); };
    if (!L) return out;
    const fx = (L.fire[0] + L.fire[1]) / 2;
    add(fire(L, s() % 100));
    add(A.glow({ x: fx, y: L.floor - 4, r: 46, rgb: "255,140,60", a: 0.1, amp: 0.12, seed: s() }));
    add(A.embers({ x0: L.fire[0] + 2, x1: L.fire[1] - 2, y: L.fire[2] - 2, n: 3, rise: 10, seed: s() }));
    const c0 = s() % 100;
    add({ z: 4, draw(ctx, t) { L.candles.forEach(([x, y], i) => flame(ctx, x, y, t, c0 + i * 1.9)); flame(ctx, L.candleBar[0], L.candleBar[1], t, c0 + 11); flame(ctx, L.candleMantel[0], L.candleMantel[1], t, c0 + 17); } });
    add(A.glow({ x: L.cx, y: L.beam + 6, r: 30, rgb: "255,200,110", a: 0.08, amp: 0.08, seed: s() }));
    add(A.glow({ x: L.candleBar[0], y: L.candleBar[1], r: 14, rgb: "255,200,110", a: 0.08, amp: 0.1, seed: s() }));
    add(windowLife(L, info.wxShown, (s() % 100) / 100));
    add(A.fireflies({ x: L.cx - 30, y: L.beam + 12, w: 60, h: 18, n: 4, glow: false, col: "#e8d0a0", seed: s() }));
    const bodies = ["#2e1e16", "#26201e", "#30221a"];
    const kx = R(L.bx + (L.W - L.bx) * 0.32);
    add(regular({ kind: "keep", x: kx, y: L.ctop, body: "#5a3e2c", seed: 0.3 }));
    add(regular({ kind: "sit", x: L.W - 34, y: L.cbot + 3, body: bodies[s() % 3], mug: true, seed: 0.1 }));
    add(regular({ kind: "stand", x: L.W - 16, y: L.cbot + 4, body: bodies[s() % 3], mug: true, seed: 0.6 }));
    if (L.eye) add(eye(L, (s() % 100) / 100));
    if (L.leak) add(A.drip({ x: L.leak[0], y0: L.beam + 3, y1: L.leak[1], col: "#9ac8b0", seed: s() }));
    if (lk.emblem === "scale") add(scale(L, lk.metal));
    if (lk.emblem === "flagon") add(A.twinkle({ pts: [[L.sign[0] + 2, L.sign[1] + 2], [L.sign[0] + 7, L.sign[1] + 4], [L.sign[0] + 4, L.sign[1] + 7]], col: "#ffffff", arm: "#ffe88a", seed: s() }));
    if (lk.sag) add(dust(L, (s() % 100) / 100));
    if (lk.damp) add(A.glow({ x: L.sign[0] + 3, y: L.sign[1] + 3, r: 12, rgb: "150,230,170", a: 0.08, amp: 0.1, seed: s() }));
    add(A.cat({ x: L.W * 0.6, y: L.floor + 6, range: 8, seed: s() }));
    return out;
  }

  window.TavernFlat = { paint, actors, LOOKS, layout };
})();
