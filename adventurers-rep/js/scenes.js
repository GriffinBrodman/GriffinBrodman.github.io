/* Backdrops, story vignettes and the world map, all drawn as pixel art at native resolution. */
(function () {
  "use strict";
  const { ramp, mix, rng, hash } = Art;

  function noise2(seed) {
    const r = rng(seed);
    const N = 64, tab = [];
    for (let i = 0; i < N * N; i++) tab.push(r());
    const at = (x, y) => tab[((y % N + N) % N) * N + ((x % N + N) % N)];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const s = (t) => t * t * (3 - 2 * t);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
    };
  }
  function fbm(n, x, y) { return n(x, y) * 0.6 + n(x * 2.1, y * 2.1) * 0.3 + n(x * 4.3, y * 4.3) * 0.1; }

  const BIOME = {
    plains: { ground: ["#5a8a3a", "#6a9a42", "#4a7a32"], sky: ["#2a2050", "#5a3a6a", "#c86a5a"], far: "#3a3054" },
    forest: { ground: ["#3a6a2a", "#2a5a2a", "#4a7a32"], sky: ["#1a2040", "#3a3a5a", "#7a5a6a"], far: "#1a3a2a" },
    marsh: { ground: ["#4a5a3a", "#3a4a32", "#5a6a3a"], sky: ["#2a2a3a", "#4a4a5a", "#7a7a6a"], far: "#2a3a30" },
    hills: { ground: ["#7a7a4a", "#6a6a42", "#8a8a5a"], sky: ["#2a2a50", "#5a4a6a", "#d88a5a"], far: "#4a3a4a" },
    snow: { ground: ["#d8e0e8", "#c0c8d8", "#e8eef4"], sky: ["#1a2a4a", "#3a5a7a", "#9ab8d0"], far: "#6a7a9a" },
    coast: { ground: ["#d8c890", "#c8b880", "#e0d0a0"], sky: ["#1a3050", "#3a6a8a", "#e8a07a"], far: "#2a5a7a" },
    volcanic: { ground: ["#3a2a2a", "#4a3030", "#2a2020"], sky: ["#1a0a10", "#4a1a1a", "#c84a2a"], far: "#2a1418" },
  };
  const SKY = {
    plains: ["#6ab8ec", "#a8daf4", "#e8f4f0"], forest: ["#72b8e0", "#acd8ec", "#e0f0e4"], hills: ["#7ab8e4", "#b8dcf0", "#f4ead0"],
    snow: ["#8cb4e0", "#c4daf0", "#f0f4fa"], coast: ["#5ab0ec", "#9cd6f6", "#e4f4f8"], marsh: ["#8aa4b4", "#b4c8c4", "#d8e0cc"],
    volcanic: ["#3a2028", "#7a3a34", "#d0784e"],
  };
  const CAVE = {
    cave: ["#3a3040", "#2a2230", "#4a4050"], undead: ["#2a3034", "#1e2428", "#3a4248"], swamp: ["#2a3a2a", "#1e2a1e", "#3a4a32"],
    ice: ["#5a7a9a", "#4a6a8a", "#8ab0d0"], fire: ["#4a2020", "#3a1818", "#6a2a20"], sea: ["#1a3a4a", "#12303e", "#2a4a5a"],
    goblin: null, beast: null,
  };

  function interior(kind, W, H, r, info, place) {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const F = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    const floor = Math.round(H * 0.62) + 2;
    if (kind === "jail") {
      F(0, 0, W, floor, "#5a5866");
      for (let y = 0; y < floor; y += 6) for (let x = (y / 6) % 2 ? -5 : 0; x < W; x += 10) { F(x, y, 9, 5, r() < 0.5 ? "#6e6c7a" : "#64626f"); F(x, y, 9, 1, "#7e7c8a"); }
      F(0, floor, W, H - floor, "#3e3c46");
      for (let x = 0; x < W; x += 3) if (r() < 0.3) F(x, floor + Math.floor(r() * (H - floor)), 2, 1, "#4a4854");
      const wx = Math.floor(W * 0.3);
      F(wx, 8, 16, 12, "#2a2834"); F(wx + 1, 9, 14, 10, "#8ab4dc");
      for (let k = 0; k < 4; k++) F(wx + 2 + k * 4, 9, 1, 10, "#2a2834");
      const dx = Math.floor(W * 0.6), dw = Math.floor(W * 0.32);
      F(dx - 2, 2, dw + 4, floor + 2, "#2a2630"); F(dx, 4, dw, floor - 2, "#24222c");
      for (let x = dx + 2; x < dx + dw; x += 6) { F(x, 4, 2, floor - 2, "#3a3844"); F(x, 4, 1, floor - 2, "#8a8898"); }
      F(dx, 12, dw, 2, "#3a3844"); F(dx, 12, dw, 1, "#8a8898"); F(dx + dw - 8, 22, 4, 4, "#c8a040");
      info.window = [wx, 8, 16, 12];
      return cv;
    }
    if (window.TavernFlat) TavernFlat.paint(cv, Object.assign(info, { town: place && place.town, wx: place && place.wx }), r);
    return cv;
  }

  // `night`: false, true (after dark), "blood" (a blood moon), or the name of one of the TONES (dawn, dusk, gloam)
  function paint(kind, W, H, seed, place, night) {
    const tone = TONES[night] ? night : null;
    const info = { kind, W, H, horizon: Math.round(H * 0.62), torches: [], tips: [], tombs: [], houses: [], pools: [], night: !!night && !tone, blood: night === "blood", tone };
    const cv = paintInto(kind, W, H, seed, place, info);
    cv.info = info;
    return cv;
  }
  // ---------- after dark (a theme's dark sky): the sky is painted as night, and the land is drawn on a layer of its own and relit by the moon,
  // colour by colour (the road scenes' moonlight: cool, low and greyed), then lit windows go in
  const NIGHT_SKY = ["#121a28", "#1c2438", "#2a3450"], NIGHT_EMBER = ["#120a10", "#2a1418", "#5a2420"];
  const moonCache = new Map();
  function moonlit(r, g, b) {
    const k = (r << 16) | (g << 8) | b;
    let v = moonCache.get(k);
    if (v) return v;
    const l = r * 0.3 + g * 0.55 + b * 0.15, d = 0.82;
    v = [(l + (r - l) * 0.55) * 104 / 255 * d, (l + (g - l) * 0.55) * 124 / 255 * d, (l + (b - l) * 0.55) * 178 / 255 * d].map((x) => Math.min(255, Math.round(x)));
    moonCache.set(k, v);
    return v;
  }
  function relight(layer, fn) {
    const c = layer.getContext("2d"), im = c.getImageData(0, 0, layer.width, layer.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { const v = (fn || moonlit)(d[i], d[i + 1], d[i + 2]); d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; }
    c.putImageData(im, 0, 0);
  }
  // a low sun or moon: the sky's colours, the clouds lit from below, the far hills, the land graded colour by colour (a flat multiply
  // and lift, so every ramp keeps its steps), and a disc low over the hills with a dithered ring of light
  const tint = (m, a) => (r, g, b) => [r * m[0] + a[0], g * m[1] + a[1], b * m[2] + a[2]].map((x) => Math.max(0, Math.min(255, Math.round(x))));
  const TONES = {
    // first light: deep blue overhead to a rose band and gold at the hills, the sun's top edge just over them on the right
    dawn: { sky: ["#24345a", "#a8737a", "#f4c27a"], cloud: ["#ffe2b4", "#e8a88e", "#9a6e7a"], far: ["#55607e", "#4a5470"], land: tint([0.8, 0.66, 0.58], [22, 10, 6]),
      disc: { x: 0.82, dy: 1, r: 9, c: ["#fffbe0", "#ffe48a", "#f8b850"], ring: "#ffd890" } },
    // the last of the light, with a big low moon coming up orange over the trees (the Hunter's Moon)
    dusk: { sky: ["#18223e", "#5a3e4a", "#d8804a"], cloud: ["#f0a874", "#8a5a5a", "#4a3a44"], far: ["#3a3a50", "#323246"], land: tint([0.56, 0.5, 0.56], [8, 6, 14]),
      disc: { x: 0.76, dy: 19, r: 12, c: ["#fff8e4", "#f4dca0", "#d8b070"], ring: "#b89070", craters: "#d4b47c" } },
    // a sick green-grey evening with a small pale moon: the hour the dead walk (the Restless Dead)
    gloam: { sky: ["#141c24", "#34423e", "#8a9672"], cloud: ["#a8b49a", "#5a6658", "#3a4440"], far: ["#2a3434", "#242e2e"], land: tint([0.34, 0.38, 0.4], [12, 14, 16]),
      disc: { x: 0.8, dy: 26, r: 5, c: ["#f4f8e8", "#d8e0c8", "#a8b098"], ring: "#8a9a80" } },
  };
  function paintInto(kind, W, H, seed, place, info) {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    let ctx = cv.getContext("2d");
    const r = rng(seed || 7);
    const P = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    const F = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    if (kind === "tavern" || kind === "jail") return interior(kind, W, H, r, info, place);
    const cave = CAVE[kind];
    const horizon = Math.round(H * 0.62);
    if (cave) {
      const mortar = mix(cave[1], "#000000", 0.45);
      F(0, 0, W, horizon, mortar);
      for (let y = 0, row = 0; y < horizon; y += 7, row++) for (let x = row % 2 ? -7 : 0; x < W; x += 14) {
        const base = mix(r() < 0.5 ? cave[0] : cave[2], "#000000", 0.25 * (1 - y / horizon));
        F(x + 1, y + 1, 12, 5, base);
        F(x + 1, y + 1, 12, 1, mix(base, "#ffffff", 0.14));
        F(x + 1, y + 1, 1, 5, mix(base, "#ffffff", 0.08));
        F(x + 1, y + 5, 12, 1, mix(base, "#000000", 0.3));
        if (r() < 0.08) { const cx = x + 3 + Math.floor(r() * 7); for (let k = 0; k < 4; k++) P(cx + (k % 2), y + 2 + k, mortar); }
        if (kind === "swamp" && r() < 0.3) F(x + 1, y + 1, 3 + Math.floor(r() * 6), 1, "#5a7a3a");
        if (kind === "ice" && r() < 0.25) F(x + 2, y + 5, 2 + Math.floor(r() * 6), 1, "#e8f8ff");
      }
      for (let i = 0; i < W / 26; i++) {
        const x = Math.floor(r() * W);
        let k = 0;
        for (; k < 4 + r() * 7; k++) F(x - k / 2, k, Math.max(1, 6 - k), 1, mortar);
        info.tips.push([Math.round(x - k / 2 + Math.max(1, 6 - k) / 2), k]);
      }
      const fl = mix(cave[1], "#000000", 0.2), joint = mix(cave[1], "#000000", 0.55), lit = mix(cave[2], "#000000", 0.15);
      F(0, horizon, W, H - horizon, fl);
      const vx = W / 2, vy = horizon - 70;
      let yy = horizon, gap = 3;
      while (yy < H) { F(0, yy, W, 1, joint); yy += gap; gap = Math.round(gap * 1.35) + 1; }
      for (let k = -14; k <= 14; k++) {
        for (let y = horizon; y < H; y++) { const t = (y - vy) / (horizon - vy); P(Math.round(vx + k * 14 * t), y, joint); }
      }
      for (let y = horizon + 1; y < H; y++) for (let x = (y % 2); x < W; x += 2) if (r() < 0.05) P(x, y, lit);
      F(0, horizon, W, 1, mix(cave[2], "#ffffff", 0.1));
      F(0, horizon + 1, W, 2, mix(cave[1], "#000000", 0.6));
      const vg = ctx.createLinearGradient(0, horizon, 0, H);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = vg; ctx.fillRect(0, horizon, W, H - horizon);
      for (const side of [0, 1]) for (let k = 0; k < 9; k++) {
        const x = side ? W - 1 - k * 2 : k * 2, h0 = 14 + Math.floor(r() * 10) - k;
        F(side ? x - 1 : x, H - h0, 2, h0, mix(cave[1], "#000000", 0.7));
      }
      for (let t = 0; t < 2; t++) {
        const tx = Math.floor(W * (0.15 + t * 0.7));
        F(tx, horizon - 22, 2, 6, "#6a4a2a");
        const g = ctx.createRadialGradient(tx + 1, horizon - 24, 0, tx + 1, horizon - 24, 26);
        g.addColorStop(0, "rgba(255,170,80,0.35)"); g.addColorStop(1, "rgba(255,170,80,0)");
        ctx.fillStyle = g; ctx.fillRect(tx - 26, horizon - 50, 54, 54);
        const fg = ctx.createRadialGradient(tx + 1, horizon + 10, 0, tx + 1, horizon + 10, 46);
        fg.addColorStop(0, "rgba(255,160,70,0.22)"); fg.addColorStop(1, "rgba(255,160,70,0)");
        ctx.fillStyle = fg; ctx.fillRect(tx - 46, horizon, 94, H - horizon);
        P(tx, horizon - 24, "#ffd86a"); P(tx + 1, horizon - 25, "#ff9a3a"); P(tx, horizon - 23, "#ff7a2a");
        info.torches.push([tx, horizon - 23]);
      }
      if (kind === "undead") for (let i = 0; i < 4; i++) { const x = Math.floor(r() * W); F(x, horizon - 4, 6, 4, "#5a5a60"); F(x + 1, horizon - 6, 4, 2, "#6a6a70"); info.tombs.push(x); }
      if (kind === "ice") for (let i = 0; i < 10; i++) { const x = Math.floor(r() * W); for (let k = 0; k < 8; k++) F(x - (8 - k) / 3, k, Math.max(1, (8 - k) / 2), 1, "#c8f0ff"); info.tips.push([x, 8]); }
      if (kind === "fire") for (let x = 0; x < W; x++) if (r() < 0.25) F(x, H - 3, 1, 3, r() < 0.5 ? "#ff6a2a" : "#ffb84a");
      if (kind === "sea") for (let x = 0; x < W; x += 1) if (r() < 0.4) P(x, horizon + 2 + Math.floor(r() * 4), "#4a8a9a");
      extras(ctx, kind, place, info, seed);
      return cv;
    }
    const bk = { goblin: "plains", beast: "forest", town: "plains", swamp: "marsh" }[kind] || kind;
    const night = info.night, tone = info.tone && TONES[info.tone], sky = tone ? tone.sky : night ? (bk === "volcanic" ? NIGHT_EMBER : NIGHT_SKY) : SKY[bk] || SKY.plains, n = noise2(seed || 3);
    for (let y = 0; y < horizon; y++) {
      const t = y / horizon;
      F(0, y, W, 1, t < 0.55 ? mix(sky[0], sky[1], t / 0.55) : mix(sky[1], sky[2], (t - 0.55) / 0.45));
    }
    if (night) {
      // the stars gather loosely in a few drifts rather than an even scatter, and keep clear of the moon's glow
      const rs = rng((seed || 7) + 31), mx = Math.round(W * 0.84), my = 9;
      const drifts = [0, 1, 2].map(() => [rs() * W, rs() * horizon * 0.6]);
      for (let i = 0; i < W * horizon / 60; i++) {
        let x = Math.floor(rs() * W), y = Math.floor(rs() * horizon * 0.75);
        if (rs() < 0.55) { const d = drifts[i % 3]; x = Math.round(d[0] + (rs() - 0.5) * W * 0.28); y = Math.round(d[1] + (rs() - 0.5) * horizon * 0.3); }
        if (y < 0 || y >= horizon * 0.8 || (x - mx) ** 2 + (y - my) ** 2 < 110) continue;
        P(x, y, rs() < 0.3 ? "#e8ecff" : "#8a96c0");
      }
      // the moon, high on the right, with a ring of dithered light about it
      // (red in a blood-moon week)
      const M = info.blood ? ["#e8705a", "#c8402a", "#8a1c12", "#b0281c"] : ["#fff8e0", "#f0e8c8", "#c8c0a0", "#8a96c0"];
      for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) { const d = x * x + y * y; if (d > 20 && d <= 42 && (x + y) % 2 === 0) P(mx + x, my + y, mix(sky[0], M[3], 0.35)); }
      for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) { const d = x * x + y * y; if (d <= 18) P(mx + x, my + y, d > 9 && x + y > 1 ? M[2] : x + y < -3 ? M[0] : M[1]); }
      info.moon = [mx, my];
    }
    if (tone) {
      const dc = tone.disc, sx = Math.round(W * dc.x), sy = horizon - dc.dy, rr = dc.r;
      for (let y = -rr - 6; y <= rr + 6; y++) for (let x = -rr - 6; x <= rr + 6; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > rr + 0.5 && d <= rr + 5.5 && (x + y) % 2 === 0) P(sx + x, sy + y, mix(sky[2], dc.ring, d <= rr + 3 ? 0.7 : 0.35));
      }
      for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) {
        const d = x * x + y * y;
        if (d > rr * rr + rr * 0.6) continue;
        P(sx + x, sy + y, x + y < -rr * 0.7 ? dc.c[0] : d > (rr - 1.6) ** 2 && x + y > 0 ? dc.c[2] : dc.c[1]);
      }
      // the moon's seas, so a low moon never reads as the sun
      if (dc.craters) for (const [x, y, w] of [[-5, -2, 3], [-4, -1, 4], [-3, 0, 2], [2, -5, 3], [3, -4, 2], [1, 3, 3], [2, 4, 4], [3, 5, 2], [-2, 5, 1]]) for (let k = 0; k < w; k++) P(sx + x + k, sy + y, dc.craters);
      info.moon = [sx, sy];
      info.disc = rr;
    }
    // clouds: a few round puffs on a flatter base, lit along their lumpy tops (by the moon at night) and shaded underneath
    const CL = tone ? tone.cloud : bk === "volcanic" ? ["#8a6a66", "#6a4a4a", "#4a3434"] : night ? ["#8a96b8", "#3a4660", "#2a3448"] : ["#ffffff", "#f2f6fc", mix(sky[1], "#8aa8d8", 0.5)];
    for (let i = 0; i < Math.max(2, W / 70); i++) {
      const cx = Math.floor(r() * W), cy = Math.floor(4 + r() * horizon * 0.35), cw = 10 + Math.floor(r() * 16), rc = rng((seed || 3) * 7 + i * 131 + 17);
      // a cloud keeps clear of the moon and its ring of light, as the stars do (a blood moon under a cloud reads as a jellyfish)
      const m = info.moon, reach = (info.disc || 4) + 8;
      if (m && cx + cw * 0.5 + 6 >= m[0] - reach && cx - cw * 0.5 - 6 <= m[0] + reach && cy + 5 >= m[1] - reach && cy - 4 <= m[1] + reach) continue;
      const puffs = [], base = cy + 5;
      for (let k = 0, n = 3 + Math.floor(rc() * 3); k < n; k++) { const t = k / (n - 1), rr = cw * (t > 0.2 && t < 0.8 ? 0.22 : 0.15) + 1 + rc() * 1.4; puffs.push([cx + (t - 0.5) * cw * 0.7, base - rr * 0.55 - rc(), rr]); }
      const inC = (x, y) => y <= base && puffs.some(([px, py, pr]) => (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2 <= pr * pr);
      for (let y = Math.floor(base - 9); y <= base; y++) for (let x = Math.floor(cx - cw * 0.5 - 6); x <= cx + cw * 0.5 + 6; x++) {
        if (!inC(x, y)) continue;
        P(x, y, !inC(x, y - 1) ? CL[0] : y >= base - 1 ? CL[2] : CL[1]);
      }
    }
    const farC = tone ? tone.far : night ? (bk === "volcanic" ? ["#2a1a1e", "#22161a"] : ["#2a3a48", "#24323e"]) : bk === "volcanic" ? ["#5a3a3a", "#4a2e30"] : bk === "snow" ? ["#b8c8e8", "#98aad6"] : ["#a8b2dc", "#8e98c8"];
    for (let x = 0; x < W; x++) {
      const hgt = Math.floor(fbm(n, x / 34, 1) * (bk === "snow" || bk === "hills" ? 34 : 22)) + 4;
      F(x, horizon - hgt, 1, hgt, (x >> 2) % 5 === 0 ? farC[1] : farC[0]);
      if ((bk === "snow" || bk === "hills") && hgt > 24) F(x, horizon - hgt, 1, Math.min(4, hgt - 24), night ? "#4a5874" : "#f4f8ff");
    }
    if (bk === "coast") {
      F(0, horizon - 10, W, 10, night ? "#1e3450" : "#3f94d8");
      for (let x = 0; x < W; x++) if (r() < 0.25) P(x, horizon - 9 + Math.floor(r() * 8), night ? (Math.abs(x - W * 0.84) < 12 ? "#c8c0a0" : "#4a6a98") : "#7cc8f0");
    }
    if (bk === "volcanic") for (let k = 0; k < 3; k++) { const vx = Math.floor(r() * W); for (let y = 0; y < horizon - 10; y += 3) F(vx + Math.round(Math.sin(y / 6) * 3), y, 4, 3, mix(night ? "#4a3a3e" : "#8a7a7a", "#4a2a30", y / horizon)); }
    // after dark the land is drawn on its own layer, to be relit by the moon before it goes down over the sky
    const land = night || tone ? document.createElement("canvas") : null;
    if (land) { land.width = W; land.height = H; ctx = land.getContext("2d"); }
    const SG = Isle.SURF[bk === "town" ? "plains" : bk] || Isle.SURF.plains;
    const midC = bk === "snow" ? ["#c4d2ee", "#dce6f6"] : bk === "volcanic" ? ["#4a3436", "#5a4044"] : bk === "marsh" ? ["#5a7a44", "#6a8a4c"] : ["#4a9a3a", "#5aac40"];
    const ridge = [];
    info.bk = bk;
    for (let x = 0; x < W; x++) {
      const hgt = Math.floor(fbm(n, x / 18 + 9, 3) * 14) + 2;
      ridge.push(horizon - hgt);
      F(x, horizon - hgt, 1, hgt, (x + hgt) % 7 === 0 ? midC[0] : midC[1]);
    }
    for (let y = horizon; y < H; y++) for (let x = 0; x < W; x++) {
      const v = fbm(n, x / 9, y / 5) + ([0, 0.5, 0.75, 0.25][(x & 1) + (y & 1) * 2] - 0.375) * 0.1;
      ctx.fillStyle = v > 0.62 ? SG[2] : v < 0.4 ? SG[0] : SG[1];
      ctx.fillRect(x, y, 1, 1);
    }
    const trees = { forest: W / 5, beast: W / 5, plains: W / 22, town: W / 30, hills: W / 40, marsh: W / 30, snow: W / 10, coast: W / 40 }[kind] || W / 30;
    const tl = [];
    for (let i = 0; i < trees; i++) { const x = Math.floor(r() * W); tl.push([x, ridge[x] + 2 + Math.floor(r() * 6)]); }
    tl.sort((a, b) => a[1] - b[1]);
    for (const [x, y] of tl) bk === "snow" ? Isle.pine(ctx, x, y, true) : bk === "volcanic" || bk === "hills" ? Isle.rock(ctx, x, y, bk) : Isle.tree(ctx, x, y, x * 31);
    if (kind === "plains" || kind === "goblin" || kind === "town") {
      const nh = kind === "goblin" ? 0 : 3 + Math.floor(r() * 3);
      for (let i = 0; i < nh; i++) {
        const hx = Math.floor(W * (0.1 + i * 0.19 + r() * 0.06)), hy = horizon + 1 + (i % 2), roof = r() < 0.2 ? "blue" : "red", wide = r() < 0.3;
        Isle.house(ctx, hx, hy, roof, wide);
        info.houses.push([hx, hy, wide ? 9 : 7]);
      }
    }
    if (kind === "plains" || kind === "town" || kind === "goblin") {
      const py = horizon + Math.floor((H - horizon) * 0.55);
      for (let x = 0; x < W; x++) { const w = Math.round(Math.sin(x / 23) * 1.5); F(x, py + w, 1, 4, "#e6cc8a"); P(x, py + w - 1, "#c4a462"); P(x, py + w + 4, "#c4a462"); }
      info.path = py;
    }
    if (kind === "marsh" || kind === "swamp") for (let i = 0; i < W / 25; i++) { const x = Math.floor(r() * W), y = horizon + 4 + Math.floor(r() * (H - horizon - 8)), w = 12 + Math.floor(r() * 10); F(x, y, w, 3, "#6aa0a0"); F(x + 2, y, 6, 1, "#a8d0c8"); info.pools.push([x, y, w]); }
    if (kind === "marsh" || kind === "swamp") for (let i = 0; i < W / 6; i++) { const x = Math.floor(r() * W); F(x, horizon + Math.floor(r() * 6), 1, 4, "#a8b45a"); }
    if (kind === "volcanic") for (let x = 0; x < W; x++) if (r() < 0.05) F(x, horizon + Math.floor(r() * (H - horizon)), 2, 1, "#ff7a2a");
    extras(ctx, kind, place, info, seed);
    if (land) {
      relight(land, tone && tone.land);
      ctx = cv.getContext("2d");
      ctx.drawImage(land, 0, 0);
      // every house has a lamp lit: a warm window, a door left ajar, a little light spilt on the ground
      for (const [hx, hy, w] of info.houses) {
        P(hx + w - 4, hy - 3, "#ffd27a"); P(hx + w - 4, hy - 2, "#e8a040"); P(hx + 2, hy - 2, "#c8783a");
        ctx.fillStyle = "rgba(255,210,122,0.22)"; for (let x = -2; x <= 2; x++) if ((x + hy) % 2 === 0) ctx.fillRect(hx + w - 4 + x, hy, 1, 1);
      }
    }
    if (kind === "snow") for (let i = 0; i < W / 4; i++) P(Math.floor(r() * W), Math.floor(r() * H), night ? "#c8d0e8" : "#ffffff");
    return cv;
  }

  // things the moving actors need to stand on: town houses and lanes off the plains, a beach, a goblin camp, puddles
  const PATH = { snow: ["#aab6cc", "#8e9ab4"], marsh: ["#8a6a3a", "#5a4024"], forest: ["#b89a62", "#8a7044"], hills: ["#d8c08a", "#b09868"], coast: ["#e6d6a0", "#c4b07a"] };
  function extras(ctx, kind, place, info, seed) {
    const { W, H, horizon } = info, r = rng(seed + 991);
    const F = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    if (kind === "swamp") for (let i = 0; i < Math.max(2, W / 70); i++) {
      const x = Math.floor(W * (0.15 + i * 0.3 + r() * 0.1)), y = horizon + 6 + Math.floor(r() * (H - horizon - 12)), w = 12 + Math.floor(r() * 8);
      F(x + 1, y - 1, w - 2, 1, "#2a4a34"); F(x, y, w, 2, "#2e5a40"); F(x + 1, y + 2, w - 2, 1, "#2a4a34"); F(x + 2, y, 4, 1, "#5a8a6a");
      info.pools.push([x, y, w]);
    }
    if (CAVE[kind]) return;
    if (kind === "coast") {
      const top = H - 6;
      for (let x = 0; x < W; x++) { const h = top + Math.round(Math.sin(x / 11 + seed) * 1.5 + Math.sin(x / 4.3) * 0.6); F(x, h, 1, H - h, (x * 7 + h) % 9 === 0 ? "#c8b880" : "#e0d0a0"); F(x, h, 1, 1, "#f0e4bc"); }
      info.sand = top + 3;
    }
    if (kind === "goblin") {
      const cx = Math.round(W * 0.56), cy = horizon + 9;
      for (const [tx, ty] of [[W * 0.3, horizon + 5], [W * 0.78, horizon + 6]]) for (let k = 0; k < 8; k++) {
        F(tx - k, ty - 8 + k, k * 2 + 1, 1, k === 0 ? "#5a3a22" : k % 3 === 0 ? "#7a5a3a" : "#9a7a4a");
        F(tx, ty - 3, 1, 3, "#2a1a10");
      }
      F(cx - 3, cy, 7, 1, "#5a3a22"); F(cx - 2, cy - 1, 5, 1, "#7a4a28"); for (const dx of [-4, 4]) F(cx + dx, cy, 1, 1, "#8a8478");
      info.camp = [cx, cy - 1];
    }
    if (!place || place.group !== "towns") return;
    const d = place.d, big = d.size === "city", bk = info.bk;
    if (big) for (let i = 0; i < 4; i++) {
      const hx = Math.floor(W * (0.19 + i * 0.19 + r() * 0.04)), hy = horizon + 7, wide = r() < 0.5;
      Isle.house(ctx, hx, hy, r() < 0.3 ? "blue" : "red", wide);
      info.houses.push([hx, hy, wide ? 9 : 7]);
    }
    if (place.id === "thornwall") for (const [x0, x1] of [[2, W * 0.08], [W * 0.92, W - 2]]) for (let x = x0; x < x1; x += 2) {
      const h = 7 + ((x * 5) % 3);
      F(x, horizon + 3 - h, 2, h, "#6a4424"); F(x, horizon + 3 - h, 1, h, "#8a5a30"); F(x, horizon + 2 - h, 1, 1, "#4a2c18");
    }
    if (info.houses.length) return;
    const n = d.size === "village" ? 3 : 4, stilts = bk === "marsh";
    for (let i = 0; i < n; i++) {
      const hx = Math.floor(W * (0.1 + i * (0.8 / n) + r() * 0.06)), hy = horizon + 1 + (i % 2) + (stilts ? 3 : 0), wide = r() < 0.3;
      Isle.house(ctx, hx, hy, r() < 0.25 ? "blue" : "red", wide, stilts);
      const w = wide ? 9 : 7, ry = stilts ? hy - 4 : hy;
      if (bk === "snow") { F(hx - 1, ry - 6, w + 2, 1, "#f4f8ff"); F(hx, ry - 8, w, 1, "#f4f8ff"); F(hx + 1, ry - 9, w - 2, 1, "#ffffff"); }
      info.houses.push([hx, ry, w]);
    }
    const pc = PATH[bk] || ["#e6cc8a", "#c4a462"], py = horizon + Math.floor((H - horizon) * 0.55) - (kind === "coast" ? 3 : 0);
    for (let x = 0; x < W; x++) {
      const w = Math.round(Math.sin(x / 23) * 1.5);
      F(x, py + w, 1, 4, pc[0]); F(x, py + w - 1, 1, 1, pc[1]); F(x, py + w + 4, 1, 1, pc[1]);
      if (stilts && x % 4 === 0) F(x, py + w, 1, 4, pc[1]);
    }
    info.path = py;
  }

  // ---------- ambient motion ----------
  let PLACES = null;
  function placeOf(seed) {
    if (!PLACES) {
      const S = window.App && App.S;
      if (!S) return null;
      PLACES = {};
      for (const group of ["towns", "dungeons", "wilds"]) for (const id in S[group] || {}) PLACES[hash(id)] = { id, group, d: S[group][id] };
    }
    return PLACES[seed] || null;
  }
  const placeAt = (loc) => (loc ? placeOf(hash(loc)) : null);
  const GOBLIN = { goblin: true, skin: "#8ac850", hair: "#3a4a1a", shirt: "#8a6a44", legs: "#5a4430", hat: null, carry: null, dress: false };
  const HOODS = ["#8a3a2a", "#3a5a8a", "#6a5a44", "#5a6a3a", "#7a4a3a"];

  // the small lives of a place: what moves, where, keyed off the painting's recorded layout and the place itself
  // ground-dwelling actors; in a fight the fighters own the ground, so these stay far back on the horizon (small because distant)
  const GROUND = new Set(["villager", "wagon", "quad", "rabbit", "crab", "cat", "skeleton", "butterfly"]);
  const DAYLIFE = new Set(["bird", "butterfly", "eagle", "gull", "shade"]);
  function ambient(info, place, seed, vig, battle) {
    const A00 = window.Anim;
    if (!A00) return [];
    // after dark the birds, butterflies and cloud shadows are gone; the fireflies, smoke and townsfolk stay out
    const A0 = !info.night ? A00 : new Proxy(A00, { get(t, k) { return DAYLIFE.has(k) ? () => null : t[k]; } });
    const A = !battle ? A0 : new Proxy(A0, { get(t, k) {
      const f = t[k];
      if (!GROUND.has(k)) return f;
      return (cfg) => (k === "wagon" || cfg.mode === "cross") ? null : f(Object.assign({}, cfg, { y: Math.min(cfg.y, info.horizon + 2), h: cfg.h ? Math.min(cfg.h, 4) : cfg.h }));
    } });
    const { W, H, kind } = info, hz = info.horizon, r = rng((seed ^ 0x2545f491) >>> 0), out = [];
    const s = () => Math.floor(r() * 1e9), pick = (a) => a[Math.floor(r() * a.length)], rx = (a, b) => a + r() * (b - a);
    const d = place && place.d, add = (x) => { if (x) out.push(x); };
    const n = (k) => (vig ? Math.ceil(k / 2) : k);

    if (kind === "tavern") return window.TavernFlat ? TavernFlat.actors(info, A, s) : out;
    if (kind === "jail") {
      const wnd = info.window;
      add(A.fireflies({ x: wnd[0] + 2, y: wnd[1] + wnd[3], w: wnd[2] + 10, h: 18, n: 5, glow: false, col: "#e8d8a8", seed: s() }));
      add(A.quad({ kind: "rat", x0: W * 0.1, x1: W * 0.5, y: H - 3, seed: s() }));
      return out;
    }

    if (CAVE[kind]) {
      const fl = hz + 3;
      for (const [tx, ty] of info.torches) {
        add(A.torch({ x: tx, y: ty, seed: s() }));
        add(A.glow({ x: tx + 1, y: hz + 8, r: 36, rgb: kind === "ice" ? "160,210,255" : "255,150,60", a: 0.05, amp: 0.1, seed: s() }));
      }
      const tips = info.tips.slice().sort(() => r() - 0.5);
      const dripCol = { swamp: "#8ac87a", ice: "#d8f4ff", fire: null, sea: "#7ac0d8" }[kind];
      if (dripCol !== null) for (const [x, len] of tips.slice(0, kind === "sea" || kind === "ice" ? 3 : 2)) add(A.drip({ x, y0: len, y1: Math.floor(rx(fl + 2, H - 6)), col: dripCol || "#8ab8d8", seed: s() }));
      const webs = { undead: 2, cave: 1, swamp: 1 }[kind] || 0;
      for (let i = 0; i < webs; i++) add(A.cobweb({ x: i % 2 ? W : 0, y: 0, size: Math.round(H * 0.22), side: i % 2 ? "r" : "l", thread: 8, seed: s() }));
      const bats = { cave: 3, undead: 2, swamp: 1 }[kind] || 0;
      for (let i = 0; i < n(bats); i++) add(A.bat({ W, y0: 6, y1: hz - 14, speed: rx(18, 28), gap: rx(3, 9), seed: s() }));
      if (kind === "cave") {
        add(A.fireflies({ x: W * 0.1, y: hz - 30, w: W * 0.8, h: 24, n: 6, glow: false, col: "#a89a7a", seed: s() }));
        if (!vig) add(A.quad({ kind: "rat", x0: W * 0.25, x1: W * 0.6, y: H - 4, seed: s() }));
      }
      if (kind === "undead") {
        add(A.mist({ W, y: hz - 3, h: 10, rgb: "170,190,190", a: 0.3, speed: 2, z: hz, seed: s() }));
        add(A.skeleton({ x0: W * 0.28, x1: W * 0.72, y: Math.min(H - 4, fl + 11), seed: s() }));
        for (const x of info.tombs.slice(0, 2)) add(A.wisp({ x: x - 2, y: hz - 14, w: 10, h: 8, rgb: "150,255,170", col: "#d0ffd8", seed: s() }));
      }
      if (kind === "swamp") {
        for (const [x, y, w] of info.pools) add(A.bubbles({ x, y, w, n: 2, col: "#8ac8a0", seed: s() }));
        add(A.wisp({ x: W * 0.2, y: hz - 20, w: W * 0.6, h: 16, seed: s() }));
        add(A.fireflies({ x: W * 0.55, y: hz - 6, w: 10, h: 6, n: 5, glow: false, col: "#1a2018", seed: s() }));
        add(A.mist({ W, y: hz - 4, h: 12, rgb: "150,190,150", a: 0.3, speed: 1.5, seed: s() }));
      }
      if (kind === "ice") {
        add(A.mist({ W, y: hz - 3, h: 12, rgb: "225,240,255", a: 0.45, speed: 2.5, seed: s() }));
        add(A.snow({ W, H, n: Math.round(W / 14), speed: 3, wind: 0.6, col: "#e8f8ff", seed: s() }));
        const pts = info.tips.map(([x, len]) => [x, len - 2]);
        for (let i = 0; i < 5; i++) pts.push([Math.floor(rx(4, W - 4)), Math.floor(rx(fl, H - 4))]);
        add(A.twinkle({ pts, col: "#ffffff", arm: "#a8e0ff", seed: s() }));
      }
      if (kind === "sea") {
        add(A.waves({ x0: 0, x1: W, y: hz + 2, h: H - hz - 6, n: Math.round(W / 9), col: "#6ab8c8", seed: s() }));
        add(A.bubbles({ x: W * 0.2, y: H - 4, w: W * 0.6, n: 4, rise: H - 10, col: "#a8e0f0", seed: s() }));
        if (!vig) add(A.crab({ x: W * 0.62, y: H - 5, range: 14, seed: s() }));
      }
      if (kind === "fire") {
        add(A.embers({ x0: 0, x1: W, y: H, n: Math.round(W / 12), rise: H * 0.8, seed: s() }));
        for (let x = W * 0.15; x < W; x += W * 0.35) add(A.glow({ x, y: H + 4, r: 34, rgb: "255,90,30", a: 0.16, amp: 0.14, speed: 0.9 + r(), seed: s() }));
      }
      return out;
    }

    const bk = info.bk || kind, group = place ? place.group : null;
    if (bk !== "volcanic" && bk !== "snow" && bk !== "coast") for (let i = 0; i < n(r() < 0.6 ? 2 : 1); i++)
      add(A.bird({ W, y: Math.floor(rx(5, hz * 0.45)), flock: pick([1, 2, 3, 3, 5]), speed: rx(9, 15), gap: rx(8, 22), seed: s() }));
    if (["plains", "hills", "coast", "forest"].includes(bk)) add(A.shade({ W, y0: hz, y1: H, speed: 1.6, a: 0.1, seed: s() }));

    if (group === "towns" || kind === "town") {
      const size = d ? d.size : "town", folk = { village: 3, town: 5, city: 9 }[size] || 4, houses = info.houses, snowy = bk === "snow";
      const lookOf = () => (snowy ? { hood: pick(HOODS), hat: null } : undefined);
      houses.forEach(([hx, hy, w], i) => { if (i % 3 !== 2 || size === "village") add(A.smoke({ x: hx + w - 3, y: hy - 12, wind: snowy ? 2 : 4, seed: s() })); });
      const lane = houses.length ? Math.max(...houses.map((h) => h[1])) + 4 : hz + 5;
      for (let i = 0; i < n(Math.ceil(folk * 0.5)); i++) {
        const x = rx(4, W - 30);
        add(A.villager({ x0: x, x1: x + rx(14, 34), y: lane + (i % 2), speed: rx(3, 6), look: lookOf(), seed: s() }));
      }
      if (info.path && !vig) for (let i = 0; i < Math.floor(folk * 0.5); i++) add(A.villager({ mode: "cross", x0: 0, x1: W, y: info.path + 3 + (i % 2), speed: rx(4, 8), gap: rx(4, 20), look: lookOf(), seed: s() }));
      if (size === "city" && info.path && !vig) add(A.wagon({ W, y: info.path + 3, speed: 8, gap: 10, seed: s() }));
      if (size !== "village" && houses.length) for (const [hx, hy] of houses.slice(0, size === "city" ? 2 : 1)) add(A.flag({ x: hx + 1, y: hy - 9, h: 6, c1: pick(["#c8463a", "#3e5ab0", "#e8b84a"]), c2: "#f2ead8", seed: s() }));
      if (houses.length && !snowy) { const [hx, hy] = pick(houses); add(A.cat({ x: hx - 2, y: hy + 3, range: 8, seed: s() })); }
      if (snowy) add(A.snow({ W, H, n: Math.round(W / 5), seed: s() }));
      if (bk === "coast") {
        add(A.waves({ x0: 0, x1: W, y: hz - 10, h: 9, seed: s() }));
        for (let i = 0; i < 2; i++) add(A.gull({ W, y: rx(6, hz * 0.5), seed: s() }));
        if (info.sand) add(A.crab({ x: rx(W * 0.1, W * 0.8), y: H - 2, seed: s() }));
      }
      if (bk === "marsh") for (const [x, y, w] of info.pools) add(A.bubbles({ x, y, w, seed: s() }));
      if (bk === "forest") add(A.rabbit({ x: rx(W * 0.1, W * 0.7), y: H - 4, range: 18, seed: s() }));
      if (bk === "hills") add(A.quad({ kind: "goat", x0: rx(W * 0.6, W * 0.8), x1: W * 0.9, y: hz + 3, seed: s() }));
      return out;
    }

    if (kind === "goblin" && info.camp) {
      const [cx, cy] = info.camp;
      add(A.torch({ x: cx - 1, y: cy, r: 26, seed: s() })); add(A.torch({ x: cx + 1, y: cy, r: 8, seed: s() }));
      add(A.smoke({ x: cx, y: cy - 5, n: 6, rise: 18, seed: s() }));
      for (let i = 0; i < n(3); i++) { const x = rx(W * 0.1, W * 0.7); add(A.villager({ x0: x, x1: x + rx(12, 30), y: (info.path || hz + 12) + 3 - (i % 2) * 8, speed: rx(4, 7), rest: 0.25, look: GOBLIN, seed: s() })); }
      return out;
    }
    if (group === "dungeons" && bk === "forest") {
      for (let i = 0; i < n(2); i++) add(A.quad({ kind: "wolf", x0: rx(W * 0.1, W * 0.5), x1: W * rx(0.6, 0.85), y: Math.floor(rx(hz + 8, H - 4)), period: rx(10, 14), seed: s() }));
      add(A.bird({ W, y: rx(6, 14), flock: 2, col: "#141018", speed: 7, seed: s() }));
      return out;
    }
    if (bk === "forest") {
      for (let i = 0; i < n(2); i++) add(A.rabbit({ x: rx(4, W - 24), y: Math.floor(rx(hz + 10, H - 3)), range: rx(12, 22), seed: s() }));
      for (let i = 0; i < n(2); i++) { const x = rx(W * 0.1, W * 0.7); add(A.quad({ kind: "deer", x0: x, x1: x + rx(10, 24), y: Math.floor(rx(hz + 6, hz + 12)), seed: s() })); }
      for (let i = 0; i < 2; i++) add(A.butterfly({ x: rx(0, W - 30), y: hz + 4, w: 30, h: H - hz - 10, seed: s() }));
      add(A.fireflies({ x: 0, y: hz - 4, w: W, h: 10, n: Math.round(W / 40), blink: 0.7, seed: s() }));
    }
    if (bk === "marsh") {
      for (const [x, y, w] of info.pools) add(A.bubbles({ x, y, w, n: 2, seed: s() }));
      for (let i = 0; i < n(2); i++) add(A.wisp({ x: rx(0, W * 0.6), y: hz - 4, w: W * 0.4, h: H - hz - 4, seed: s() }));
      for (let i = 0; i < 2; i++) add(A.fireflies({ x: rx(10, W - 20), y: rx(hz + 4, H - 14), w: 8, h: 6, n: 5, glow: false, col: "#2a2a22", seed: s() }));
      add(A.mist({ W, y: hz - 2, h: 12, rgb: "200,214,200", a: 0.35, speed: 1.2, seed: s() }));
    }
    if (bk === "plains" && info.path) {
      for (let i = 0; i < n(2); i++) add(A.wagon({ W, y: info.path + 3, speed: rx(6, 9), gap: rx(6, 16), horse: pick(["#8a5a34", "#5a3a22", "#c8b8a0"]), seed: s() }));
      for (let i = 0; i < n(2); i++) add(A.villager({ mode: "cross", x0: 0, x1: W, y: info.path + 2 + (i % 2) * 2, speed: rx(4, 6), gap: rx(6, 20), seed: s() }));
      add(A.butterfly({ x: rx(0, W - 40), y: hz + 4, w: 40, h: 12, seed: s() }));
    }
    if (bk === "hills") {
      add(A.eagle({ x: rx(W * 0.3, W * 0.7), y: hz * 0.35, r: 22, seed: s() }));
      for (let i = 0; i < n(2); i++) { const x = rx(W * 0.05, W * 0.7); add(A.quad({ kind: "goat", x0: x, x1: x + rx(8, 20), y: Math.floor(rx(hz + 5, H - 4)), seed: s() })); }
      add(A.rabbit({ x: rx(4, W - 24), y: H - 4, range: 14, seed: s() }));
    }
    if (bk === "snow") {
      add(A.snow({ W, H, n: Math.round(W / 3.5), speed: 7, wind: 4, seed: s() }));
      add(A.eagle({ x: rx(W * 0.3, W * 0.7), y: hz * 0.3, r: 20, seed: s() }));
      add(A.mist({ W, y: hz - 6, h: 10, rgb: "240,246,255", a: 0.35, speed: 6, seed: s() }));
    }
    if (bk === "coast") {
      add(A.waves({ x0: 0, x1: W, y: hz - 10, h: 9, seed: s() }));
      for (let i = 0; i < n(3); i++) add(A.gull({ W, y: rx(6, hz * 0.55), seed: s() }));
      if (info.sand) for (let i = 0; i < n(2); i++) add(A.crab({ x: rx(W * 0.05, W * 0.85), y: H - 2, range: rx(8, 16), seed: s() }));
    }
    if (bk === "volcanic") {
      add(A.embers({ x0: 0, x1: W, y: H, n: Math.round(W / 16), rise: H * 0.7, seed: s() }));
      add(A.smoke({ x: rx(W * 0.2, W * 0.8), y: hz - 10, n: 7, rise: 24, life: 5, col: "#8a7a7a", seed: s() }));
    }
    return out;
  }
  function copyOf(cv) {
    const c = document.createElement("canvas");
    c.width = cv.width; c.height = cv.height;
    c.getContext("2d").drawImage(cv, 0, 0);
    return c;
  }
  function backdrop(kind, W, H, seed, opts) {
    const place = placeOf(seed);
    const cv = paint(kind, W, H, seed, place);
    if (window.Anim) Anim.stage(cv, copyOf(cv), ambient(cv.info, place, seed, false, !!(opts && opts.battle)));
    return cv;
  }

  function locKind(loc) {
    const S = App.S;
    if (!loc) return "plains";
    if (S.dungeons[loc]) return S.dungeons[loc].theme === "goblin" ? "goblin" : S.dungeons[loc].theme === "beast" ? "forest" : S.dungeons[loc].theme;
    if (S.towns[loc]) return S.towns[loc].biome === "plains" ? "town" : S.towns[loc].biome;
    if (S.wilds[loc]) return S.wilds[loc].biome;
    return "plains";
  }

  // story vignette: background + heroes + a prop that hints at what happened
  const TAVERN_KINDS = new Set(["brawl", "dice", "insult", "arm_wrestle", "drinking_contest", "flirt", "bond", "loan", "repay", "chat", "mentor",
    "party_formed", "party_join", "poached", "argument", "festival", "games", "funeral", "join"]);
  function vignette(e, W, H) {
    W = W || 200; H = H || 84;
    const { heroes, S } = App, A = window.Anim;
    if (e.kind === "song" && S.towns[e.loc] && window.Ballad) return Ballad.vignette(e, W, H);
    // a set piece (season_posters.js): a season's first day dressed in its theme, the Long Night's sunrise; it may set the place's kind,
    // the sky, the weather, or frame a town's own header
    const piece = window.Posters ? Posters.of(e) : null;
    const kind = (piece && piece.kind) || locKind(e.loc), seed = hash(e.id);
    const indoors = S.towns[e.loc] && TAVERN_KINDS.has(e.kind) ? "tavern" : S.towns[e.loc] && e.kind === "crime" ? "jail" : null;
    const place = indoors ? null : placeAt(e.loc);
    const ground = Math.round(H * 0.62) + 14;
    // a story from this season while a theme keeps the sky dark (the Long Night) happened after dark
    const meta = (App.L && App.L.meta) || {}, dark = !indoors && meta.sky === "night" && (e.season == null || e.season === meta.season);
    const wonder = App.L && App.L.wonder, blood = dark && wonder && wonder.kind === "blood_moon" && wonder.region === "*" && e.day >= meta.day - 1;
    const sky = piece && piece.sky != null ? piece.sky : blood ? "blood" : dark, night = sky === true || sky === "blood", wx = (piece && piece.wx) || e.wx;
    // a dungeon is framed from its own map header, cut so its way in stands just behind the heroes; a set piece may frame a town's
    // (a set piece's `frame` names the header itself when it isn't the event's place: Goblin Town for the Goblin Kingdom's first day)
    const TS = window.TownScenes, fid = piece && typeof piece.frame === "string" ? piece.frame : e.loc;
    const framed = !indoors && TS && TS.frame && (S.dungeons[fid] ? TS.DUNGEONS.includes(fid) : piece && piece.frame && (TS.TOWNS.includes(fid) || fid !== e.loc));
    const hdr = framed ? TS.frame(fid, W, H, { y0: (TS.FOOT[fid] || 70) - (ground - 9), night, tone: TONES[sky] ? sky : null }) : null;
    const bg = hdr ? hdr.base : paint(indoors || (kind === "town" ? "plains" : kind), W, H, seed, indoors ? { town: e.loc, wx: e.wx } : place, sky);
    const info = hdr ? { kind, W, H, horizon: ground - 14, bk: (S.dungeons[fid] || S.towns[fid] || {}).biome || "plains", night } : bg.info;
    const open = night && !CAVE[info.kind];
    if (wx && !indoors) weatherOverlay(bg.getContext("2d"), W, H, wx, seed, night, info.horizon);
    // heroes, foes and props sit on their own layer so the place's ambient life can pass behind them
    const over = document.createElement("canvas");
    over.width = W; over.height = H;
    const ctx = over.getContext("2d");
    if (hdr) ctx.drawImage(hdr.over, 0, 0);
    // with heroes in front, the scene's patrols and chickens are moved back to the ground behind their feet
    const back = (a, i) => {
      const z = a.z - hdr.y0, to = ground - 9 - (i % 3) * 2;
      if (!a.walker || !(e.heroes || []).length || z < ground - 8) return a;
      return { z: to + hdr.y0, draw(c, t) { c.save(); c.translate(0, to - z); a.draw(c, t); c.restore(); } };
    };
    const actors = hdr ? hdr.acts.map(back) : A && !(piece && piece.life === false) ? ambient(info, place, seed, true, true) : [];
    const sprite = (a, b, x, y, i) => {
      if (A) actors.push(A.flip({ a: a.toCanvas(1), b: b.toCanvas(1), x, y, z: 5e3, rate: 0.8, seed: i * 3 + 1, front: true }));
      else ctx.drawImage(a.toCanvas(1), x, y);
    };
    const hs = (e.heroes || []).map((id) => heroes[id]).filter(Boolean).slice(0, 4);
    const dead = new Set();
    if (e.kind === "death") dead.add(hs[0] && hs[0].id);
    const startX = Math.round(W * 0.18);
    // after dark a lantern on a post stands at the heroes' left: a pool of its light on the ground, and its warm edge on whoever faces it
    if (open && hs.length) lantern(ctx, startX - 10, ground);
    const lit = (g, i) => (open && i < 2 ? rim(g, i ? "#7a4a2a" : "#b8703a") : g);
    hs.forEach((h, i) => {
      const lk = App.heroLook(h), g = Art.heroGrid(h, 0, lk);
      const x = startX + i * 30, y = ground - g.h;
      if (dead.has(h.id) || (e.kind === "body_sold" && i === 1) || (e.kind === "body_taken" && i === 1) || (e.kind === "funeral" && i === 0)) {
        drawGrave(ctx, x + 6, ground - 16);
        return;
      }
      sprite(lit(g, i), lit(Art.heroGrid(h, 1, lk), i), x, y, i);
    });
    // a wild surge, or any story the Wild Magic wrote (its `th`), leaves the air about the crew fizzing: mint and pink motes drifting up
    // past them, kept below the sky
    const sparks = e.kind === "surge" || (e.th && ((S.theme_signs || {})[e.th] || {}).paper === "sparks");
    if (sparks) {
      const x0 = hs.length ? startX - 6 : Math.round(W * 0.3), x1 = hs.length ? startX + hs.length * 30 + 6 : Math.round(W * 0.7);
      // a surge that names a crowd (midsummer night, the summer's climax) fills the frame: two motes to a hero, some above their heads
      const crowd = (e.heroes || []).length, big = e.climax || crowd > 4;
      const m = motes(big ? 4 : x0, big ? W - 4 : x1, big ? Math.round(H * 0.12) : Math.max(Math.round(H * 0.3), ground - 46), ground - 2, seed,
        big ? Math.min(48, 10 + crowd * 2) : 10);
      if (A) actors.push(m); else m.draw(ctx, 0);
    }
    const px = Math.round(W * 0.66);
    if (piece) piece.draw({ ctx, bg, actors, A, W, H, ground, hz: info.horizon, seed, info, hs, startX, e, key: piece.key, r: rng(seed + 404), framed: !!hdr });
    // the one thing a wonder's line names, drawn where it stands: a ship on a hill among sheep, a shower of frogs, a bottle on a milestone
    const wp = WONDER_PROPS[e.rev || (e.kind === "wonder" && e.wonder) || ""];
    if (wp && !indoors) wp({ ctx, bg, actors, A, W, H, ground, x: Math.max(px, hs.length ? startX + hs.length * 30 + 4 : 0), seed });
    const prop = (grid, sx, sy) => ctx.drawImage(grid.toCanvas(1), sx, sy);
    const lg = e.kind === "legend" && e.legend && App.legendFigure ? App.legendFigure(e.legend) : null;
    if (lg) {
      // the legend stands facing whoever they came to see, a little apart, with a faint shimmer about them
      const g = Art.heroGrid(lg.h, 0, lg.cls), lx = hs.length ? Math.max(px, startX + hs.length * 30 + 8) : Math.round(W * 0.5 - 14), ly = ground - g.h;
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(lx + 8, ground - 1, 12, 2);
      sprite(hs.length ? g.flipX() : g, hs.length ? Art.heroGrid(lg.h, 1, lg.cls).flipX() : Art.heroGrid(lg.h, 1, lg.cls), lx, ly, 7);
      const pts = [];
      for (let i = 0; i < 7; i++) { const q = rng(seed + i * 13); pts.push([lx + 2 + Math.floor(q() * 24), ly + Math.floor(q() * 30)]); }
      if (A) actors.push(A.twinkle({ pts, col: "#fff4c8", arm: "#e8b84a", seed, z: 9e4, front: true }));
    } else if (["boss_kill", "boss"].includes(e.kind) && S.dungeons[e.loc]) {
      const id = S.dungeons[e.loc].boss, m = Art.withLook(Object.assign({}, S.monsters[id], { boss: true }), e.boss_look);
      const g = Art.monsterGrid(m, 0);
      // the boss lies as its own death leaves it (deaths.js, the replay's last frame), facing the heroes who felled it
      // a big body lying down is wider than it stood: it lies past the last of the crew, not on top of them
      const cx = Math.min(W - g.w * 0.6, Math.max(px + (g.w >> 1), startX + hs.length * 30 + g.w * 0.75));
      if (!(window.Deaths && Deaths.draw(ctx, { ref: id, boss: true, look: e.boss_look }, 0, cx, ground, -1, { calm: true }))) {
        // a quarter turn exactly, about a whole pixel: any other angle resamples the sprite off its grid
        ctx.save(); ctx.globalAlpha = 0.9; ctx.imageSmoothingEnabled = false;
        ctx.translate(cx, Math.min(ground - 6, H - 2 - (g.w >> 1))); ctx.rotate(Math.PI / 2); ctx.drawImage(g.toCanvas(1), -(g.w >> 1), -(g.h >> 1)); ctx.restore();
      }
      if (A) actors.push(A.smoke({ x: cx, y: ground - 8, n: 4, rise: 16, life: 4, col: "#b8b0a8", seed: seed + 1 }));
    } else if (["fight", "ambush", "boss"].includes(e.kind) && (e.foes || []).length) {
      e.foes.slice(0, 3).forEach((mid, i) => {
        const m = S.monsters[mid];
        if (!m) return;
        const mm = e.kind === "boss" && i === 0 ? Art.withLook(Object.assign({}, m, { boss: true }), e.boss_look) : Object.assign({}, m, { boss: false });
        const g = Art.monsterGrid(mm, 0).flipX();
        const mx = Math.round(W * 0.62) + i * 26, my = ground - g.h + (i % 2) * 3;
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(mx + 3, ground - 1, g.w - 6, 2);
        sprite(g, Art.monsterGrid(mm, 1).flipX(), mx, my, i + 5);
      });
    } else if (e.kind === "mount" && hs[0] && hs[0].mount && window.MountArt) {
      // the horse the story is about stands beside its rider
      const m = hs[0].mount, g0 = MountArt.mountGrid(m.kind, m.colour, 0, true), g1 = MountArt.mountGrid(m.kind, m.colour, 1, true);
      const mx = startX + 30, my = ground - g0.height;
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(mx + 4, ground - 1, g0.width - 8, 2);
      if (A) actors.push(A.flip({ a: g0, b: g1, x: mx, y: my, z: 5e3, rate: 0.8, seed: 9, front: true }));
      else ctx.drawImage(g0, mx, my);
    } else if (e.kind === "party_formed" || e.kind === "party_join") {
      const p = App.parties[(e.parties || [])[0]];
      if (p) prop(Art.bannerGrid(p.banner), px, ground - 20);
    } else if (e.kind === "bond" || e.kind === "flirt") {
      const heart = e.bond === "rivals" || e.bond === "nemeses" ? "#3a3a3a" : "#e84a6a";
      if (A && !A.reduced) {
        const hc = document.createElement("canvas");
        hc.width = 9; hc.height = 7;
        drawHeart(hc.getContext("2d"), 1, 0, heart);
        for (let k = 0; k < 2; k++) actors.push(A.rise({ x: startX + 21 + k * 4, y: ground - 38 + k * 4, cv: hc, h: 12, period: 3.2, seed: k * 2 }));
      } else drawHeart(ctx, startX + 22, ground - 40, heart);
    } else if (["sale", "body_sold", "trade", "relic", "relic_sold", "gear"].includes(e.kind)) {
      prop(Art.itemGrid(e.kind === "body_sold" ? "remains" : e.kind === "relic" ? "relic" : "gold"), px, ground - 12);
      prop(Art.itemGrid("gem"), px + 12, ground - 10);
      if (A) actors.push(A.twinkle({ pts: [[px + 4, ground - 10], [px + 15, ground - 8], [px + 8, ground - 6]], col: "#ffffff", arm: "#ffe88a", seed, z: 9e4, front: true }));
    } else if (e.kind === "evolve") {
      const pts = [];
      for (let i = 0; i < 18; i++) { const r = rng(i + 3); pts.push([startX - 6 + Math.floor(r() * 36), ground - 40 + Math.floor(r() * 40)]); }
      if (A) actors.push(A.twinkle({ pts, col: "#ffffff", arm: "#ffe88a", seed, z: 9e4, front: true }), A.embers({ x0: startX - 4, x1: startX + 28, y: ground, n: 8, rise: 36, cols: ["#ffffff", "#ffe88a", "#c8a0ff", "#8a6ac8"], front: true, z: 9e4, seed }));
      else pts.forEach(([x, y], i) => { ctx.fillStyle = ["#ffe88a", "#c88aff", "#ffffff"][i % 3]; ctx.fillRect(x, y, 1, 1); });
    } else if (e.kind === "brawl" || e.kind === "pvp" || e.kind === "robbery") {
      const pts = [[0, 0], [2, -2], [-2, -2], [4, 1], [-4, 1]].map(([dx, dy]) => [startX + 28 + dx, ground - 30 + dy]);
      if (A && !A.reduced) actors.push(A.twinkle({ pts: pts.concat(pts.map(([x, y]) => [x + 1, y - 3])), col: "#ffffff", arm: "#ffe88a", seed, z: 9e4, front: true }));
      else { ctx.fillStyle = "#ffffff"; for (const [x, y] of pts) ctx.fillRect(x, y, 1, 1); }
    } else if ((e.kind === "season_start" && !piece) || e.kind === "join") {
      prop(Art.bannerGrid({ c1: "#e8b84a", c2: "#7a2a2a", emblem: "crown" }), px, ground - 20);
    }
    if (A && !indoors && (wx === "rain" || wx === "storm")) actors.push(A.rain({ W, H, n: Math.round(W * (wx === "storm" ? 0.35 : 0.2)), storm: wx === "storm", seed }));
    if (A && !indoors && wx === "snow" && info.bk !== "snow") actors.push(A.snow({ W, H, n: Math.round(W / 5), seed }));
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    if (A) A.stage(cv, bg, actors, { over });
    else { const c = cv.getContext("2d"); c.drawImage(bg, 0, 0); c.drawImage(over, 0, 0); }
    return cv;
  }
  function weatherOverlay(ctx, W, H, wx, seed, night, horizon) {
    const r = rng(seed + 5);
    if (wx === "rain" || wx === "storm") {
      ctx.fillStyle = "rgba(40,50,80,0.25)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = night ? "rgba(140,160,200,0.6)" : "rgba(200,220,255,0.7)";
      for (let i = 0; i < W * (wx === "storm" ? 0.9 : 0.5); i++) { const x = Math.floor(r() * W), y = Math.floor(r() * H); ctx.fillRect(x, y, 1, 3); }
      if (wx === "storm") { ctx.fillStyle = "#fff8c0"; let x = Math.floor(W * (0.2 + r() * 0.6)); for (let y = 0; y < H * 0.5; y += 2) { x += Math.floor(r() * 3) - 1; ctx.fillRect(x, y, 1, 2); } }
    } else if (wx === "snow") {
      ctx.fillStyle = "rgba(230,240,255,0.18)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < W * 0.6; i++) ctx.fillRect(Math.floor(r() * W), Math.floor(r() * H), 1, 1);
    } else if (wx === "fog") {
      // fog lies in a few flat banks at fixed heights, dithered at their edges (the map's fog sign), behind the figures: never a wash
      // over the whole drawing
      const hz = horizon || Math.round(H * 0.62), rgb = night ? "120,134,170" : "232,236,240";
      for (const [y0, h, a, ph] of [[hz - 9, 11, 0.5, 0], [hz + 7, 5, 0.38, 3]]) for (let x = 0; x < W; x++) {
        const top = y0 + Math.round(2 + Math.sin((x + ph * 17 + seed % 50) / 11) * 1.6 + Math.sin(x / 4.7 + ph) * 0.7);
        ctx.fillStyle = `rgba(${rgb},${a * 0.55})`;
        if ((x + top) % 2 === 0) ctx.fillRect(x, top - 1, 1, 1);
        ctx.fillStyle = `rgba(${rgb},${a})`; ctx.fillRect(x, top, 1, y0 + h - top);
        ctx.fillStyle = `rgba(${rgb},${a * 0.55})`; if (x % 2 === 0) ctx.fillRect(x, y0 + h, 1, 1);
      }
    } else if (wx === "heat") {
      ctx.fillStyle = "rgba(255,170,60,0.15)"; ctx.fillRect(0, 0, W, H);
    }
  }
  function drawGrave(ctx, x, y) { ctx.drawImage(Art.graveGrid().toCanvas(1), x, y); }
  // a lamp post: its light as two dithered steps (a pool on the ground and a halo round the lamp), never a soft gradient
  function lantern(ctx, x, ground) {
    const F = (px, py, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(px, py, w, h); }, top = ground - 22;
    for (let y = -6; y <= 6; y++) for (let dx = -26; dx <= 26; dx++) {
      const d = (dx / 26) ** 2 + (y / 4) ** 2;
      if (d <= 1 && (dx + y) % 2 === 0) F(x + dx, ground + y - 1, 1, 1, d < 0.4 ? "rgba(255,210,122,0.32)" : "rgba(255,210,122,0.16)");
    }
    for (let y = -7; y <= 7; y++) for (let dx = -7; dx <= 7; dx++) {
      const d = dx * dx + y * y;
      if (d > 6 && d <= 49 && (dx + y) % 2 === 0) F(x + dx, top + 2 + y, 1, 1, d <= 20 ? "rgba(255,214,130,0.4)" : "rgba(255,214,130,0.18)");
    }
    F(x, top + 5, 2, ground - top - 5, "#2a1c14"); F(x, top + 5, 1, ground - top - 5, "#4a3424"); F(x - 2, ground - 1, 6, 1, "#2a1c14");
    F(x - 2, top, 6, 1, "#2a1c14"); F(x - 1, top + 1, 4, 4, "#2a1c14"); F(x, top + 2, 2, 2, "#ffd27a"); F(x, top + 2, 1, 1, "#fff2c8"); F(x - 1, top + 5, 4, 1, "#2a1c14");
  }
  // a wonder's prop, keyed by the road event (`rev`) or the island wonder (`wonder`) it belongs to; o.x is the left of its free ground
  const px1 = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  // a frog sat facing us (eyes up top, a pale belly, feet splayed), and one on the way down, legs out at every corner
  const FROG = { g: "#4a9a32", e: "#8ad05a", k: "#1a1220", l: "#d0ec98", d: "#2e6a22" };
  const frogSat = () => Anim.sprite([".ek.ke.", "eggggge", "gglllgg", ".glllg.", "dd...dd"], FROG, "#14200e");
  const frogFall = () => Anim.sprite(["..e.e..", "d.ggg.d", ".dgggd.", "..glg..", ".dgggd.", "d.....d", "dd...dd"], FROG, "#14200e");
  const frog = (ctx, x, y) => { if (window.Anim) Anim.put(ctx, frogSat(), x + 2, y + 3); };
  function sheep(ctx, x, y, flip) {
    px1(ctx, x - 1, y - 5, 9, 5, "#2a2620"); px1(ctx, x, y - 4, 7, 3, "#f0ece0"); px1(ctx, x, y - 4, 7, 1, "#ffffff"); px1(ctx, x + 1, y - 2, 5, 1, "#c8c2b4");
    const hx = flip ? x - 2 : x + 6;
    px1(ctx, hx, y - 5, 3, 3, "#2a2620"); px1(ctx, flip ? hx : hx + 2, y - 4, 1, 1, "#4a4438");
    px1(ctx, x + 1, y - 1, 1, 1, "#2a2620"); px1(ctx, x + 5, y - 1, 1, 1, "#2a2620");
  }
  const WONDER_PROPS = {
    // a full-rigged ship on a green hill with her sails furled, and sheep grazing round her
    ship_on_the_hill({ ctx, bg, W, ground, x }) {
      // the hill rises from the grass behind the road, in the grass's own colour
      const base = ground - 4, g = bg.getContext("2d").getImageData(Math.min(W - 1, x + 22), base, 1, 1).data;
      const tone = (f, a) => `rgb(${Math.min(255, g[0] * f + a) | 0},${Math.min(255, g[1] * f + a) | 0},${Math.min(255, g[2] * f + a * 0.6) | 0})`;
      const turf = tone(0.9, 0), lit = tone(1, 16), dark = tone(0.72, 0), hx = x + 22, top = base - 10;
      for (let dx = -30; dx <= 30; dx++) {
        const y = Math.round(top + 10 * (dx / 30) ** 2);
        px1(ctx, hx + dx, y - 1, 1, 1, "#24301a"); px1(ctx, hx + dx, y, 1, base - y + 1, turf);
        for (let yy = y + 1; yy <= base; yy++) if (dx > 6 && (dx > 16 || (dx + yy) % 2)) px1(ctx, hx + dx, yy, 1, 1, dark);
        px1(ctx, hx + dx, y, 1, 1, dx < 10 ? lit : turf);
      }
      const kx = hx - 15, ky = top - 1, OL = "#1a120c", WD = "#7a4a24", wd = "#4e2e16", WL = "#a8743e", SL = "#ece0c0", sl = "#b8a888";
      // the hull: a keel resting on the crown of the hill, a stern castle at the left, a bowsprit to the right
      px1(ctx, kx - 1, ky - 7, 33, 8, OL); px1(ctx, kx + 1, ky, 28, 1, OL);
      px1(ctx, kx, ky - 6, 31, 6, WD); px1(ctx, kx, ky - 6, 31, 1, WL); px1(ctx, kx + 2, ky - 1, 27, 1, wd); px1(ctx, kx, ky - 3, 31, 1, "#c8a040");
      for (let i = 0; i < 5; i++) px1(ctx, kx + 6 + i * 5, ky - 5, 1, 1, "#2a1a10");
      px1(ctx, kx - 1, ky - 11, 9, 5, OL); px1(ctx, kx, ky - 10, 7, 4, WD); px1(ctx, kx, ky - 10, 7, 1, WL); px1(ctx, kx + 2, ky - 8, 1, 1, "#ffd27a");
      for (let i = 0; i < 6; i++) px1(ctx, kx + 31 + i, ky - 7 - (i >> 1), 1, 1, wd);
      // three masts, each with its sails furled on the yards and a pennant at the main
      for (const [mx, mh, yards] of [[kx + 8, 18, 2], [kx + 16, 24, 3], [kx + 24, 16, 2]]) {
        px1(ctx, mx, ky - 6 - mh, 1, mh, wd);
        for (let n = 0; n < yards; n++) {
          const y = ky - 6 - mh + 3 + n * 6, half = 2 + n;
          px1(ctx, mx - half - 1, y - 1, half * 2 + 3, 3, OL); px1(ctx, mx - half, y, half * 2 + 1, 1, SL); px1(ctx, mx - half, y + 1, half * 2 + 1, 1, sl);
        }
      }
      px1(ctx, kx + 16, ky - 31, 4, 1, "#c8302a"); px1(ctx, kx + 16, ky - 30, 2, 1, "#8a1e18");
      sheep(ctx, hx - 26, base + 1, false); sheep(ctx, hx + 20, base - 1, true);
    },
    // a light shower of frogs: a few on the ground looking surprised, more on the way down
    wm_rain_of_frogs: (o) => frogs(o),
    frogs: (o) => frogs(o),
    // a fizzing green bottle on a milestone, saying DRINK ME
    wm_fizzing_bottle({ ctx, actors, A, ground, x, seed }) {
      const mx = x + 6;
      px1(ctx, mx - 1, ground - 12, 9, 12, "#1e1c1a"); px1(ctx, mx, ground - 11, 7, 11, "#8a8680"); px1(ctx, mx, ground - 11, 7, 1, "#b0aca4"); px1(ctx, mx, ground - 11, 1, 11, "#a09c94");
      px1(ctx, mx + 2, ground - 7, 3, 1, "#5a5650"); px1(ctx, mx + 2, ground - 5, 3, 1, "#5a5650");
      px1(ctx, mx + 1, ground - 19, 5, 8, "#0e1a10"); px1(ctx, mx + 2, ground - 18, 3, 6, "#3ac87a"); px1(ctx, mx + 2, ground - 18, 1, 5, "#8af0b8");
      px1(ctx, mx + 3, ground - 21, 1, 3, "#0e1a10"); px1(ctx, mx + 3, ground - 20, 1, 1, "#a8743e");
      if (A) actors.push(A.twinkle({ pts: [[mx + 1, ground - 22], [mx + 6, ground - 20], [mx + 4, ground - 24]], col: "#ffffff", arm: "#8af0c8", seed, z: 9e4, front: true }));
    },
    // the butterflies that crossed the road and wouldn't stop: a river of blue
    wm_road_butterflies({ actors, A, W, ground, seed }) {
      if (!A) return;
      for (let i = 0; i < 9; i++) actors.push(Object.assign(A.butterfly({ x: Math.round(W * 0.15) + i * Math.round(W * 0.07), y: ground - 34 + (i % 3) * 5, w: 26, h: 12, col: i % 3 ? "#5a9af0" : "#a8d0ff", seed: seed + i }), { front: true, z: 9e4 }));
    },
  };
  // the shower falls in one slanting band over where the frogs have landed, not a scatter over the whole sky
  function frogs({ ctx, actors, A, W, ground, x, seed }) {
    const r = rng(seed + 31);
    for (let i = 0; i < 3; i++) frog(ctx, x + 4 + i * 11 + Math.floor(r() * 4), ground - 2 - (i % 2));
    if (!A) return;
    const fall = [], x0 = Math.min(W - 70, x - 10);
    for (let i = 0; i < 9; i++) fall.push([x0 + r() * 64, r(), 2 + r() * 0.9]);
    const draw = (c, t) => {
      for (const [fx, ph, per] of fall) {
        const a = ((t / per + ph) % 1 + 1) % 1, y = Math.round(-6 + a * (ground - 6)), xx = Math.round(fx - 18 + a * 22);
        Anim.put(c, frogFall(), xx, y);
      }
    };
    if (A.reduced) draw(ctx, 0); else actors.push({ z: 9e4, front: true, draw });
  }
  function motes(x0, x1, top, bot, seed, n = 10) {
    const r = rng(seed + 71), ps = [];
    for (let i = 0; i < n; i++) ps.push({ x: x0 + r() * (x1 - x0), y: top + r() * (bot - top), sp: 3 + r() * 4, ph: r() * 6.3, col: i % 2 ? "#ffb8e4" : "#a8ffe0", dk: i % 2 ? "#b0408a" : "#1e8a6a" });
    return { z: 9e4, front: true, draw(ctx, t) {
      for (const p of ps) {
        const span = bot - top, y = Math.round(top + ((p.y - top - t * p.sp) % span + span) % span), x = Math.round(p.x + Math.sin(t * 1.3 + p.ph) * 2);
        // a spark: a bright core in a cross of its own deeper colour, which pulses down to the core and a trailing pixel
        ctx.fillStyle = p.dk;
        if (Math.sin(t * 2.1 + p.ph * 3) > -0.2) { ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1); }
        else ctx.fillRect(x, y + 1, 1, 1);
        ctx.fillStyle = p.col; ctx.fillRect(x, y, 1, 1);
      }
    } };
  }
  // a figure's outline on the side facing a lamp, warmed by it: the one pixel of light that parts dark kit from the night behind it
  function rim(g, col) {
    const out = new Art.Grid(g.w, g.h);
    out.px = g.px.slice();
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) && !g.get(x - 1, y)) out.set(x, y, col);
    return out;
  }
  function drawHeart(ctx, x, y, c) {
    const pts = [[1, 0], [2, 0], [4, 0], [5, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [2, 4], [3, 4], [4, 4], [3, 5]];
    ctx.fillStyle = "#1a1220";
    for (const [px, py] of pts) ctx.fillRect(x + px - 1, y + py, 3, 1);
    ctx.fillStyle = c;
    for (const [px, py] of pts) ctx.fillRect(x + px, y + py, 1, 1);
  }

  // the pieces a set piece (season_posters.js) draws with
  const kit = { motes, sheep, frog, lantern };
  window.Scenes = { backdrop, vignette, locKind, kit, TONES, drawMap: (...a) => Isle.drawMap(...a), nearestNode: (...a) => Isle.nearestNode(...a) };
})();
