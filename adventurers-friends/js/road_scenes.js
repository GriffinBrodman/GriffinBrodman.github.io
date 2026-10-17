/* Road backdrops: a road in each biome (and the last mile to each kind of dungeon) as a pure function of hour and weather, roadside set pieces, a walking band and a small loop (rain, snow, fog, smoke, gulls...), drawn into pixel buffers. */
/*
  RoadScenes.scene(spec, w, h)   -> { base: Buf (the still), info, loops } cached; spec = { biome, hour | tod, weather, theme?, place_kind?, seed? }
                                    biome: plains forest marsh hills snow coast volcanic dungeon (dungeon takes theme: goblin beast cave undead
                                    swamp ice sea fire); hour 0-24 or tod (dawn morning noon afternoon dusk evening night); weather: clear cloudy
                                    rain storm fog snow heat. info: { hz, roadTop, roadBot, feet, place: anchors of the set piece, light }.
  RoadScenes.frame(spec, t, w, h, o) -> { w, h, data } the still plus the loop at t seconds (o.band: hero objects or grids walking the road).
  RoadScenes.strip(spec, opts)   -> <div class="road-strip"> with a live canvas (default 320x80): the still and its loop, the band walking
                                    across (spec.heroes or opts.heroes); holds one frame under reduced motion or Static scenes.
                                    spec also takes place_variant (crossroads: gallows | stones; milestone: lean), extra: [[piece, x, variant]]
                                    (town far|near|street, camp, milestone, crow, fingerpost, haycart, log, boat), band_x (where the front
                                    walker starts, a fraction of the width), band_speed, band_still, traveller (stands ahead of the band).
  RoadScenes.dress(block)        -> the spec additions for a daybook stretch { stretch, biome, place_kind?, traveller?, line? }: each stretch
                                    kind its own roadside thing and band placing, the line's cart, signpost or milestone when it names one.
  RoadScenes.walker(grid, k)     -> the grid in walk-cycle step k (0-3): legs scissored, body bobbed.
  RoadScenes.kit                 -> { Buf, blit, grade, C, mix, rng, hash, clamp, lerp, bay, hourOf, piece } for road_replay.js.
  Everything is deterministic in (spec, t); nothing touches the DOM except strip().
*/
(function (root) {
  "use strict";
  const A = root.Art;
  const W0 = 240, H0 = 136;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  const HEX = new Map();
  function C(c) {
    if (typeof c !== "string") return c;
    let v = HEX.get(c);
    if (!v) { v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; HEX.set(c, v); }
    return v;
  }
  const mix = (a, b, t) => { a = C(a); b = C(b); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const h2 = (x, y, s) => { let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  function vn(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi); const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s); return lerp(lerp(a, b, xf), lerp(c, d, xf), yf); }
  const fbm = (x, y, s, o) => { let v = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < (o || 3); i++) { v += vn(x * f, y * f, s + i * 31) * a; n += a; a *= 0.5; f *= 2.03; } return v / n; };

  // ---------- the buffer (the same shape as FoodArt's Img, so either can take the other's pixels) ----------
  class Buf {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
    px(x, y, c, a) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
      c = C(c);
      const o = (y * this.w + x) * 4, d = this.d;
      if (a === undefined || a >= 1) { d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; return; }
      if (a <= 0) return;
      d[o] = d[o] + (c[0] - d[o]) * a; d[o + 1] = d[o + 1] + (c[1] - d[o + 1]) * a; d[o + 2] = d[o + 2] + (c[2] - d[o + 2]) * a; d[o + 3] = Math.max(d[o + 3], a * 255);
    }
    get(x, y) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null; const o = (y * this.w + x) * 4; return [this.d[o], this.d[o + 1], this.d[o + 2]]; }
    rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a); }
    line(x0, y0, x1, y1, c, a) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let i = 0; i <= n; i++) this.px(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n)), c, a); }
    copy() { const o = new Buf(this.w, this.h); o.d.set(this.d); return o; }
    paste(src, dx, dy, a) { dx = Math.round(dx || 0); dy = Math.round(dy || 0); for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const o = (y * src.w + x) * 4; if (src.d[o + 3]) this.px(x + dx, y + dy, [src.d[o], src.d[o + 1], src.d[o + 2]], (src.d[o + 3] / 255) * (a === undefined ? 1 : a)); } return this; }
  }

  // ---------- time and weather ----------
  const TOD = { dawn: 6, morning: 9, noon: 12, midday: 12, afternoon: 15, dusk: 18, evening: 19.5, night: 22, midnight: 0 };
  function hourOf(s) {
    const v = s && (s.hour !== undefined ? s.hour : s.tod);
    if (typeof v === "number") return ((v % 24) + 24) % 24;
    return TOD[v] !== undefined ? TOD[v] : 12;
  }
  const isNight = (hr) => hr >= 20.5 || hr < 4.8;
  // sky [top, middle, horizon] through the day
  const SKY = [
    [0, "#060a1c", "#0e1634", "#1a2648"], [4.8, "#0a1028", "#1a2246", "#2c3458"], [6, "#4e5c84", "#c48c7c", "#f2c08c"], [7.5, "#6a94c0", "#b4c8d4", "#f0e0c0"],
    [12, "#5a96ca", "#94c2e0", "#d4e8ea"], [15.5, "#6a98c2", "#aac6d4", "#e8dcbc"], [17.6, "#4a5a84", "#c47c64", "#f2b06a"], [18.8, "#2c3460", "#8a5a5c", "#d88a5a"],
    [20.5, "#0c1230", "#1a2246", "#2e3658"], [24, "#060a1c", "#0e1634", "#1a2648"],
  ];
  function skyAt(hr) {
    let i = 0;
    while (i < SKY.length - 2 && SKY[i + 1][0] <= hr) i++;
    const a = SKY[i], b = SKY[i + 1], t = clamp((hr - a[0]) / (b[0] - a[0]), 0, 1);
    return [mix(a[1], b[1], t), mix(a[2], b[2], t), mix(a[3], b[3], t)];
  }
  // the light on the land: a tint toward a colour, a darkening, a loss of colour
  function lightAt(hr, weather) {
    let tint = [255, 255, 255], amt = 0, dark = 0, sat = 1;
    if (isNight(hr)) { tint = [70, 92, 150]; amt = 0.5; dark = 0.52; sat = 0.55; }
    else if (hr < 7.5) { const k = clamp((7.5 - hr) / 2.7, 0, 1); tint = [255, 196, 170]; amt = 0.3 * k; dark = 0.16 * k; }
    else if (hr > 16.2) { const k = clamp((hr - 16.2) / 4.3, 0, 1); tint = hr > 19 ? [130, 120, 160] : [255, 168, 104]; amt = 0.12 + 0.24 * k; dark = 0.05 + 0.4 * k * k; sat = 1 - 0.3 * k; }
    const W = { cloudy: [0.85, 0.06], rain: [0.68, 0.16], storm: [0.55, 0.3], fog: [0.62, 0.02], snow: [0.75, 0.0], heat: [1.05, 0] }[weather];
    if (W) { sat *= W[0]; dark += W[1]; }
    if (weather === "heat") { tint = mix(tint, [255, 226, 160], 0.6); amt = Math.max(amt, 0.16); }
    if (weather === "rain" || weather === "storm") { tint = mix(tint, [110, 128, 146], 0.5); amt = Math.max(amt, 0.18); }
    return { tint, amt, dark: clamp(dark, 0, 0.6), sat };
  }
  // a colour graded by the light and by distance (depth 0 near, 1 at the horizon: hazed toward the sky)
  function grader(L, haze, fogK) {
    const cache = new Map();
    return (c, depth) => {
      const key = (typeof c === "string" ? c : c.join(",")) + "|" + Math.round((depth || 0) * 20);
      let v = cache.get(key);
      if (v) return v;
      c = C(c);
      let r = c[0], g = c[1], b = c[2];
      const l = r * 0.3 + g * 0.55 + b * 0.15;
      r = l + (r - l) * L.sat; g = l + (g - l) * L.sat; b = l + (b - l) * L.sat;
      r = lerp(r, r * L.tint[0] / 255, L.amt * 2) ; g = lerp(g, g * L.tint[1] / 255, L.amt * 2); b = lerp(b, b * L.tint[2] / 255, L.amt * 2);
      r *= 1 - L.dark; g *= 1 - L.dark; b *= 1 - L.dark;
      const d = clamp((depth || 0) * (0.3 + fogK), 0, 0.95);
      v = [lerp(r, haze[0], d), lerp(g, haze[1], d), lerp(b, haze[2], d)].map((x) => clamp(Math.round(x), 0, 255));
      cache.set(key, v);
      return v;
    };
  }

  // ---------- biomes ----------
  const BIOME = {
    plains: { far: "#7a9e5c", far2: "#93ad6a", ground: "#6a9a44", ground2: "#5a8a3a", road: "#b89a6a", road2: "#9a7e54", verge: "#5c8c38", tuft: "#7ab04a", flower: ["#f0e070", "#f4f0e8", "#e07a6a"] },
    forest: { far: "#3e6a40", far2: "#2e5434", ground: "#4a7a34", ground2: "#3a6a2c", road: "#9a7a52", road2: "#7a5e3c", verge: "#3e6a2c", tuft: "#5a8a3a", flower: ["#f4f0e8", "#e8c860"] },
    marsh: { far: "#6a7a58", far2: "#58684a", ground: "#6a7a48", ground2: "#5a6a3e", road: "#8a6a44", road2: "#5e4630", verge: "#56683a", tuft: "#8a9a52", flower: ["#e8d870"] },
    hills: { far: "#8a8ea0", far2: "#a49a62", ground: "#9a9a58", ground2: "#86864a", road: "#b8a07a", road2: "#988060", verge: "#8a8a4a", tuft: "#aaa860", flower: ["#e8d870", "#f4f0e8"] },
    snow: { far: "#e2e8f4", far2: "#2e4a48", ground: "#e8eef6", ground2: "#cfd8e8", road: "#c4c8d2", road2: "#9aa2b4", verge: "#dce4f0", tuft: "#b8c4d4", flower: [] },
    coast: { far: "#3e78a8", far2: "#6a8a5a", ground: "#7aa84a", ground2: "#6a9840", road: "#c8b080", road2: "#a89060", verge: "#86a850", tuft: "#a8b860", flower: ["#f4f0e8", "#f0b0c0"] },
    volcanic: { far: "#3a2c2e", far2: "#4a3a36", ground: "#4a3c36", ground2: "#3a302c", road: "#5e5046", road2: "#463a34", verge: "#40342e", tuft: "#5a4a3a", flower: [] },
  };
  const THEME_BIOME = { goblin: "plains", beast: "forest", cave: "hills", undead: "marsh", swamp: "marsh", ice: "snow", sea: "coast", fire: "volcanic" };

  // ---------- the scene ----------
  const scenes = new Map();
  function layout(w, h) {
    const hz = Math.round(h * 0.44), roadTop = Math.round(h * 0.68), roadBot = roadTop + Math.max(6, Math.round(h * 0.13));
    return { w, h, hz, roadTop, roadBot, feet: roadTop + Math.round((roadBot - roadTop) * 0.62) };
  }
  function scene(spec, w, h) {
    w = w || W0; h = h || H0;
    const hr = hourOf(spec), weather = spec.weather || "clear", dungeon = spec.biome === "dungeon", theme = spec.theme || (dungeon ? "undead" : null);
    const biome = dungeon ? THEME_BIOME[theme] || "marsh" : BIOME[spec.biome] ? spec.biome : "plains";
    const key = [biome, dungeon ? theme : "", Math.round(hr * 4), weather, spec.place_kind || "", spec.place_variant || "", spec.place_x || "", JSON.stringify(spec.extra || []), spec.seed || "", w, h].join("|");
    if (scenes.has(key)) return scenes.get(key);
    const seed = hash(spec.seed || biome + (theme || "")), r = rng(seed);
    const lay = layout(w, h), { hz, roadTop, roadBot } = lay;
    const P = BIOME[biome], sky = skyAt(hr), L = lightAt(hr, weather);
    if (dungeon) { L.sat *= 0.7; L.dark = clamp(L.dark + 0.12, 0, 0.8); }
    const fogK = weather === "fog" ? 0.75 : weather === "snow" ? 0.25 : weather === "rain" || weather === "storm" ? 0.3 : weather === "heat" ? 0.2 : 0;
    const over = { cloudy: ["#9aa4ae", 0.55], rain: ["#7a8590", 0.72], storm: ["#3e4652", 0.84], fog: ["#c2c6c2", 0.8], snow: ["#c4cad4", 0.7], heat: ["#f0e0b0", 0.25] }[weather];
    const skyC = over ? sky.map((c) => mix(c, isNight(hr) ? mix(over[0], "#0a0e1e", 0.8) : over[0], over[1] * (isNight(hr) ? 0.6 : 1))) : sky;
    const haze = skyC[2];
    const G = grader(L, haze, fogK);
    // people on the road stay readable after dark: the same light, half the darkness and less haze
    const Gf = grader(Object.assign({}, L, { dark: L.dark * 0.45, amt: L.amt * 0.7 }), haze, fogK * 0.5);
    const img = new Buf(w, h);
    const put = (x, y, c, depth, a) => { if (c) img.px(x, y, G(c, depth), a); };
    const info = Object.assign({}, lay, { hr, weather, biome, theme, dungeon, light: L, night: isNight(hr), sky: skyC, haze, G, Gf, seed });

    // sky
    // flat bands, each boundary broken by a short staggered step: an ordered dither between bands read as a checkerboard at 4x
    const STEPS = 12;
    for (let y = 0; y < hz + 2; y++) for (let x = 0; x < w; x++) {
      const t = clamp(y / (hz + 2), 0, 1) * STEPS, f = t - Math.floor(t), up = f > 0.84 && h2(x >> 2, Math.floor(t), seed) > 0.5 ? 1 : 0;
      const q = Math.min(STEPS, Math.floor(t) + up) / STEPS * 2;
      img.px(x, y, q < 1 ? mix(skyC[0], skyC[1], q) : mix(skyC[1], skyC[2], q - 1));
    }
    const dayArc = clamp((hr - 5.6) / 13.2, 0, 1);
    const sunX = Math.round(lerp(w * 0.08, w * 0.92, dayArc)), sunY = Math.round(hz - 4 - Math.sin(dayArc * Math.PI) * (hz - 10));
    const heavy = weather === "rain" || weather === "storm" || weather === "fog" || weather === "snow";
    if (info.night) {
      if (weather !== "storm" && weather !== "fog") {
        for (let i = 0; i < w * hz / 55; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * (hz - 4)), b = r(); img.px(x, y, b > 0.8 ? "#f4ecd0" : "#8a96c0", heavy ? 0.4 : 1); }
        const mx = Math.round(w * 0.78), my = Math.round(hz * 0.3);
        disc(img, mx, my, 5, "#f0e8c8", "#c8c0a0", heavy ? 0.45 : 1, (x, y) => (x - mx + 2.5) ** 2 + (y - my - 1.5) ** 2 > 16);
        info.moon = [mx, my];
      }
    } else if (!heavy) {
      const glowR = weather === "heat" ? 16 : 11;
      for (let y = sunY - glowR; y <= sunY + glowR; y++) for (let x = sunX - glowR; x <= sunX + glowR; x++) { const d = Math.hypot(x - sunX, y - sunY) / glowR; if (d < 1 && y < hz) img.px(x, y, "#fff4d0", Math.round((1 - d) * 3) * 0.07); }
      disc(img, sunX, sunY, hr < 7 || hr > 17 ? 5 : 4, hr < 7 || hr > 17 ? "#ffd890" : "#fff6d8", hr < 7 || hr > 17 ? "#f0a060" : "#ffe8a0", weather === "cloudy" ? 0.6 : 1);
      info.sun = [sunX, sunY];
    }
    clouds(img, info, w, hz, weather, seed, sunX);

    // the far distance, the middle, the road and the near verge, over a ground that leaves no gaps
    for (let y = hz; y < h; y++) for (let x = 0; x < w; x++) put(x, y, y < roadTop ? P.far2 : P.verge, y < roadTop ? 0.5 : 0);
    FAR[biome](put, info, P, r, seed);
    if (dungeon) LANDMARK[theme] && LANDMARK[theme](put, info, r, img);
    MID[biome](put, info, P, r, seed);
    road(put, info, P, r, seed, img);
    verge(put, info, P, r, seed);
    // the stretch's own dressing (a town gate, a milestone, a fire...), behind the place's set piece
    info.extras = (spec.extra || []).map(([k, px, variant]) => piece(img, k, Math.round(w * px), info, { seed: spec.seed, variant }));
    if (spec.place_kind) info.place = piece(img, spec.place_kind, Math.round(w * (spec.place_x || 0.62)), info, { seed: spec.seed, variant: spec.place_variant });
    if (weather === "fog") for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = fbm(x / 40, y / 9, seed + 5, 2); const a = clamp((n - 0.42) * 1.2, 0, 0.5) * (y > hz - 6 && y < roadBot + 6 ? 1 : 0.4); if (a > 0) img.px(x, y, "#d8dcd6", a); }
    const out = { base: img, info, loops: loops(info, spec) };
    if (scenes.size > 40) scenes.delete(scenes.keys().next().value);
    scenes.set(key, out);
    return out;
  }
  function disc(img, cx, cy, rad, c, rim, a, keep) {
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
      const d = x * x + y * y;
      if (d > rad * rad + 1) continue;
      if (keep && !keep(cx + x, cy + y)) continue;
      img.px(cx + x, cy + y, d > (rad - 1.2) ** 2 ? rim : c, a);
    }
  }
  function clouds(img, info, w, hz, weather, seed, sunX) {
    const thr = { clear: 0.66, heat: 0.74, cloudy: 0.46, rain: 0.38, storm: 0.34, snow: 0.4, fog: 0.9 }[weather] || 0.6;
    const dark = weather === "storm" ? 0.55 : weather === "rain" ? 0.35 : 0;
    const base = info.night ? "#2a3250" : info.hr < 7.2 || info.hr > 17 ? "#f0b890" : "#f4f6f4";
    const shadeC = info.night ? "#141a30" : info.hr < 7.2 || info.hr > 17 ? "#8a5a6a" : "#a8b4c4";
    for (let y = 2; y < hz - 3; y++) for (let x = 0; x < w; x++) {
      const n = fbm(x / 46, y / 11, seed + 77, 3) - (y / hz) * 0.12;
      if (n < thr) continue;
      const k = clamp((n - thr) * 6, 0, 1), lit = fbm((x + (x < sunX ? 3 : -3)) / 46, (y - 2) / 11, seed + 77, 3) > n ? 0.25 : 0;
      const c = mix(mix(shadeC, base, clamp(0.35 + lit + (1 - y / hz) * 0.4, 0, 1)), "#3a4250", dark);
      // a hard edge with a sparse fringe: a full ordered dither at the cloud edges reads as a checkerboard at 1x
      if (k > 0.22) img.px(x, y, c, 0.85);
    }
  }
  // a silhouette band: top(x) to bottom, coloured by fn(x, y, top)
  function sil(put, w, top, bot, depth, fn) {
    for (let x = 0; x < w; x++) { const t = Math.round(top(x)); for (let y = t; y < bot; y++) { const c = fn(x, y, t); if (c) put(x, y, c, depth); } }
  }
  const FAR = {
    plains: (put, I, P, r, s) => {
      sil(put, I.w, (x) => I.hz - 2 - fbm(x / 70, 0, s, 3) * 9, I.hz + 6, 0.9, (x, y, t) => (y - t < 1 ? "#9ab878" : "#6e9466"));
      for (let x = 3; x < I.w; x += 7 + Math.floor(h2(x, 7, s) * 15)) { const t = Math.round(I.hz - 2 - fbm(x / 70, 0, s, 3) * 9); for (let j = 0; j < 3; j++) for (let i = -1; i <= 1; i++) if (j < 2 || i === 0) put(x + i, t - 3 + j, "#4e7450", 0.8); }
      // a patchwork of fields with hedgerows between them, nearer rows taller
      const rows = [I.hz + 2, I.hz + 5, I.hz + 9, I.hz + 14, I.roadTop];
      for (let k = 0; k < rows.length - 1; k++) {
        const crop = ["#a4b85e", "#c8b85a", "#8aac52", "#b4a454", "#96b45a"];
        sil(put, I.w, (x) => rows[k] + Math.sin(x / (30 + k * 9) + k * 2) * (k + 1) * 0.6, rows[k + 1] + 4, 0.7 - k * 0.12, (x, y, t) => {
          const f = Math.floor(x / (38 + k * 14) + fbm(x / 60, k, s, 2) * 2), c = crop[(f * 7 + k * 3) % crop.length];
          if (y - t < 1 + (k > 1 ? 1 : 0)) return h2(x >> 1, k, s) > 0.3 ? "#3e6a32" : "#567a3a";
          return (y + (f % 2 ? x : 0)) % 3 === 0 && c === "#c8b85a" ? "#b8a44a" : c;
        });
      }
    },
    forest: (put, I, P, r, s) => {
      const crowns = (x, f, a) => { let m = 0; for (let k = -1; k <= 1; k++) { const cx = (Math.floor(x / f) + k) * f + h2(Math.floor(x / f) + k, 0, s) * f * 0.6; const rr = f * (0.55 + h2(Math.floor(x / f) + k, 1, s) * 0.35); const d = rr * rr - (x - cx) ** 2; if (d > 0) m = Math.max(m, Math.sqrt(d) * a); } return m; };
      sil(put, I.w, (x) => I.hz - 2 - crowns(x, 9, 0.9), I.hz + 8, 0.8, () => P.far);
      sil(put, I.w, (x) => I.hz + 5 - crowns(x + 400, 13, 0.85), I.roadTop, 0.5, (x, y, t) => (y - t < 2 && (x + y) % 3 === 0 ? "#4e8448" : P.far2));
    },
    marsh: (put, I, P, r, s) => {
      sil(put, I.w, (x) => I.hz - 1 - fbm(x / 70, 0, s, 2) * 3, I.hz + 4, 0.85, () => P.far);
      for (let i = 0; i < 4; i++) { const x = Math.floor(r() * I.w), hh = 6 + r() * 5; for (let y = 0; y < hh; y++) put(x, I.hz - y, "#3e4636", 0.8); put(x - 1, I.hz - hh + 2, "#3e4636", 0.8); put(x + 1, I.hz - hh + 3, "#3e4636", 0.8); put(x + 2, I.hz - hh + 2, "#3e4636", 0.8); }
      sil(put, I.w, () => I.hz + 3, I.roadTop, 0.5, (x, y) => { const n = fbm(x / 26, y / 4, s + 3, 2); if (n > 0.57) { const above = fbm(x / 26, (y - 1) / 4, s + 3, 2) <= 0.57; return above ? "#a8c0c0" : mix(mix(I.sky[1], "#6a8a9a", 0.5), "#34484e", 0.45); } return n > 0.53 ? "#4a5a3a" : P.far2; });
    },
    hills: (put, I, P, r, s) => {
      peaks(put, I, s, 22, 0.92, { lit: "#a6aabc", base: P.far, deep: "#6e7284", cap: "#c4c8d6", capK: 0.12 });
      sil(put, I.w, (x) => I.hz + 2 - fbm(x / 30, 4, s + 2, 2) * 9, I.roadTop, 0.55, (x, y, t) => { const n = fbm(x / 14, y / 5, s + 6, 2); return y - t < 2 ? "#c4b878" : n > 0.62 ? "#7a7a40" : n < 0.34 ? "#b4ac6a" : P.far2; });
    },
    snow: (put, I, P, r, s) => {
      peaks(put, I, s, 28, 0.9, { lit: "#f0f4fa", base: "#c4cee2", deep: "#94a2c0", cap: "#ffffff", capK: 0.5 });
      for (let x = -4; x < I.w + 4; x += 5 + Math.floor(h2(x, 2, s) * 5)) pine(put, x, I.hz + 6 + Math.floor(h2(x, 3, s) * 4), 8 + Math.floor(h2(x, 4, s) * 6), 0.6, true);
      sil(put, I.w, () => I.hz + 8, I.roadTop, 0.4, (x, y) => ((x * 5 + y * 3) % 17 === 0 ? "#c8d2e4" : "#dfe6f2"));
    },
    coast: (put, I, P, r, s) => {
      const sea = I.hz + Math.round((I.roadTop - I.hz) * 0.55);
      sil(put, I.w, () => I.hz, sea, 0.7, (x, y) => (y === I.hz ? "#a8c8dc" : (y - I.hz) % 3 === 0 && h2(x >> 2, y, s) > 0.7 ? "#7ab0d0" : mix(P.far, "#2a5a88", (y - I.hz) / (sea - I.hz))));
      const hx = I.w * 0.74;
      sil(put, I.w, (x) => (x > hx ? I.hz - 2 - Math.min(14, (x - hx) * 0.55) - fbm(x / 9, 2, s, 2) * 3 : I.hz + 99), sea, 0.7, (x, y, t) => (y - t < 2 ? "#8aa06a" : (x + y) % 5 === 0 || y - t > 9 && bay(x, y) < 0.5 ? "#5e5248" : "#7a6a5a"));
      for (let k = 0; k < 6; k++) put(Math.round(hx + 18), I.hz - 12 - k, k > 3 ? "#e8e0c8" : "#c8402c", 0.7);
      const sx = Math.round(I.w * (0.2 + h2(1, 1, s) * 0.3));
      for (let k = 0; k < 4; k++) for (let i = 0; i <= k; i++) put(sx + i, I.hz + 1 - 4 + k, "#f0ece0", 0.6);
      for (let i = -2; i < 4; i++) put(sx + i, I.hz + 2, "#5a3a22", 0.6);
      sil(put, I.w, (x) => sea - 1 - fbm(x / 20, 0, s, 2) * 2, I.roadTop, 0.4, (x, y, t) => (y - t < 1 ? "#f0f4f4" : y - t < 4 ? (h2(x, y, s) > 0.8 ? "#c8b480" : "#e0cc96") : P.far2));
      I.sea = [I.hz, sea];
    },
    volcanic: (put, I, P, r, s) => {
      const cx = I.w * 0.7;
      sil(put, I.w, (x) => I.hz - 4 - Math.max(0, 30 - Math.abs(x - cx) * 0.55) - fbm(x / 20, 0, s, 2) * 4, I.hz + 6, 0.8, (x, y, t) => (Math.abs(x - cx) < 6 && y - t < 3 ? "#e86a2a" : (x + y) % 7 === 0 ? "#2e2224" : P.far));
      sil(put, I.w, (x) => I.hz + 3 - fbm(x / 24, 2, s, 2) * 8, I.roadTop, 0.5, (x, y, t) => (y - t < 2 ? "#5a4a40" : h2(x, y, s) > 0.997 ? "#e86a2a" : fbm(x / 12, y / 4, s, 2) > 0.62 ? "#2e2624" : P.far2));
      I.crater = [Math.round(cx), I.hz - 34];
    },
  };
  // a mountain range lit from the left: the slope, smoothed over a few pixels, picks the lit or the shaded face; snow caps the peaks
  // a mountain range of overlapping peaks lit from the left: each peak's sunward face, its shaded face, a ragged snow cap and a
  // shadowed foot; the nearer, lower peaks overlap the far ones
  function peaks(put, I, s, amp, depth, c) {
    const r = rng(s + 71), list = [];
    for (let x = -20; x < I.w + 30; x += 18 + r() * 26) list.push({ cx: x, h: amp * (0.45 + r() * 0.55), k: 0.55 + r() * 0.5, far: r() });
    list.sort((a, b) => b.far - a.far);
    const base = I.hz + 6;
    for (const pk of list) {
      const top = I.hz - 4 - pk.h, fade = pk.far * 0.15;
      for (let x = Math.floor(pk.cx - pk.h / pk.k - 2); x <= pk.cx + pk.h / pk.k + 2; x++) {
        const jag = (h2(x, 3, s) - 0.5) * 1.6 + Math.sin(x * 0.9 + pk.cx) * 0.6, t = Math.round(top + Math.abs(x - pk.cx) * pk.k + jag);
        for (let y = Math.max(t, 0); y < base; y++) {
          const left = x < pk.cx + (y - top) * 0.12 * (h2(y, 5, s) - 0.5), dy = y - t;
          const capLine = top + pk.h * c.capK + Math.round(Math.sin(x * 1.3 + pk.cx) * 1.5 + h2(x, 9, s) * 2);
          let col = left ? c.lit : c.deep;
          if (left && x > pk.cx - 2) col = c.base;
          if (y < capLine) col = left ? c.cap : c.base;
          if (y > base - 4 - Math.round(h2(x >> 2, 11, s) * 4)) col = c.deep;
          if (dy === 0 && left) col = y < capLine ? c.cap : c.lit;
          put(x, y, col, depth + fade);
        }
      }
    }
  }
  function pine(put, x, base, hh, depth, snowy) {
    put(x, base, "#3a2a1e", depth); put(x, base - 1, "#3a2a1e", depth);
    for (let j = 0; j < hh; j++) {
      const half = Math.floor((hh - j) * 0.42 * (1 - ((j % 4) === 3 ? 0.25 : 0)));
      for (let i = -half; i <= half; i++) put(x + i, base - 2 - j, snowy && (j % 4 === 0 || i === -half) && i < 1 ? "#e8eef6" : i > 0 ? "#22403c" : "#2e524a", depth);
    }
  }
  function tree(put, x, base, rad, depth, cols, s) {
    for (let y = base - rad * 1.2; y < base; y++) for (let i = -1; i <= 1; i++) put(x + i, y, i === 1 ? "#3a2a1e" : "#5a4028", depth);
    for (let k = 0; k < 4; k++) {
      const cx = x + (h2(k, x, s) - 0.5) * rad * 1.2, cy = base - rad * 1.5 - h2(x, k, s) * rad * 0.8, rr = rad * (0.6 + h2(k, k + x, s) * 0.3);
      for (let y = -rr; y <= rr; y++) for (let i = -rr; i <= rr; i++) {
        const d = (i * i + y * y) / (rr * rr);
        if (d > 1) continue;
        const l = -i / rr * 0.5 - y / rr * 0.6 + (1 - d) * 0.3;
        const px = Math.round(cx + i), py = Math.round(cy + y);
        put(px, py, cols[l > 0.45 ? 2 : l + bay(px, py) * 0.3 > 0.05 ? 1 : 0], depth);
      }
    }
  }
  const MID = {
    plains: (put, I, P, r, s) => {
      for (let x = 0; x < I.w; x++) if (h2(x >> 3, 9, s) > 0.3) for (let y = I.roadTop - 6; y < I.roadTop - 1; y++) { const n = fbm(x / 5, y / 3, s + 4, 2); if (n > 0.42 + (y - I.roadTop + 6) * 0.02) put(x, y, n > 0.6 ? "#4e7a34" : "#3e6a2c", 0.3); }
      const tx = Math.round(I.w * (0.15 + r() * 0.2));
      tree(put, tx, I.roadTop - 3, 7, 0.32, ["#2e5428", "#4a7a34", "#7aa04a"], s);
      for (let x = 4; x < I.w; x += 13) { for (let y = I.roadTop - 5; y < I.roadTop; y++) put(x, y, "#6a5038", 0.2); put(x - 1, I.roadTop - 4, "#6a5038", 0.2); }
    },
    forest: (put, I, P, r, s) => {
      for (let x = 10 + r() * 20; x < I.w + 20; x += 34 + r() * 26) tree(put, Math.round(x), I.roadTop, 9 + Math.round(r() * 4), 0.25, ["#1e3a22", "#2e5a2e", "#4e8040"], s);
    },
    marsh: (put, I, P, r, s) => {
      for (let i = 0; i < I.w / 14; i++) { const x = Math.floor(r() * I.w), hh = 3 + Math.floor(r() * 5); for (let k = 0; k < 4; k++) for (let y = 0; y < hh - (k & 1); y++) put(x + k - 1, I.roadTop - 1 - y, y === hh - 1 && k === 1 ? "#6a4a2a" : "#7a8a4a", 0.25); }
      const dx = Math.round(I.w * (0.2 + r() * 0.15));
      for (let y = 0; y < 18; y++) put(dx, I.roadTop - 2 - y, "#3a3028", 0.3);
      for (let i = 0; i < 6; i++) put(dx + i, I.roadTop - 14 - Math.floor(i * 0.6), "#3a3028", 0.3);
      for (let i = 0; i < 4; i++) put(dx - i, I.roadTop - 12 - i, "#3a3028", 0.3);
    },
    hills: (put, I, P, r, s) => {
      for (let i = 0; i < 4; i++) { const x = Math.floor(r() * I.w), rw = 5 + Math.floor(r() * 7), rh = 3 + Math.floor(r() * 4); for (let y = 0; y < rh; y++) for (let k = -rw + y; k <= rw - y; k++) put(x + k, I.roadTop - 1 - y, k > rw / 2 - y ? "#6e6a62" : y === rh - 1 || k < -rw / 2 ? "#b4b0a4" : "#8e8a80", 0.3); }
      for (let x = 0; x < I.w; x++) { const n = fbm(x / 9, 1, s + 8, 2); if (n > 0.55) for (let y = 0; y < Math.round((n - 0.55) * 14); y++) put(x, I.roadTop - 1 - y, (x + y) % 3 === 0 ? "#c48a4a" : y ? "#9a6a38" : "#7a5a30", 0.25); }
    },
    snow: (put, I, P, r, s) => { for (let x = 6 + r() * 20; x < I.w; x += 26 + r() * 30) pine(put, Math.round(x), I.roadTop, 16 + Math.round(r() * 8), 0.2, true); },
    coast: (put, I, P, r, s) => {
      for (let i = 0; i < I.w / 10; i++) { const x = Math.floor(r() * I.w); for (let k = 0; k < 3; k++) put(x + k, I.roadTop - 2 - (k === 1 ? 2 : 1), "#b8b870", 0.2); }
      for (let x = 0; x < I.w; x += 9) { put(x, I.roadTop - 3, "#8a6a48", 0.15); put(x, I.roadTop - 2, "#8a6a48", 0.15); }
      for (let x = 0; x < I.w; x++) put(x, I.roadTop - 3, (x % 9) ? (x % 2 ? "#b8a888" : null) : null, 0.15);
    },
    volcanic: (put, I, P, r, s) => {
      for (let i = 0; i < 5; i++) { const x = Math.floor(r() * I.w), rw = 4 + Math.floor(r() * 6); for (let y = 0; y < rw - 1; y++) for (let k = -rw + y; k <= rw - y; k++) put(x + k, I.roadTop - 1 - y, k === 0 && y < 2 ? "#e86a2a" : k > 0 ? "#1e1618" : "#3a2e2c", 0.3); }
    },
  };
  // the last mile before a dungeon: its silhouette on the horizon, dead trees and old signs
  const LANDMARK = {
    goblin: (put, I) => { const x0 = Math.round(I.w * 0.66); for (let x = x0; x < x0 + 40; x += 3) { const hh = 10 + ((x * 7) % 5); for (let y = 0; y < hh; y++) put(x, I.hz + 4 - y, y === hh - 1 ? "#2a1e16" : "#4a3624", 0.5); put(x + 1, I.hz + 4 - hh + 1, "#2a1e16", 0.5); } for (let y = 0; y < 18; y++) put(x0 - 6, I.hz + 4 - y, "#3a2a1e", 0.4); disc2(put, x0 - 6, I.hz - 15, 2, "#e8dcc0", 0.4); },
    beast: (put, I) => { const x0 = Math.round(I.w * 0.7); for (let y = 0; y < 26; y++) for (let k = -10 + (y >> 2); k <= 10 - (y >> 2); k++) put(x0 + k, I.hz + 6 - y, Math.abs(k) < 4 && y < 9 ? "#0e0c0c" : "#3a2e22", 0.5); for (let i = 0; i < 4; i++) { put(x0 - 14 + i * 9, I.roadTop - 2, "#e8dcc0", 0.3); put(x0 - 13 + i * 9, I.roadTop - 2, "#e8dcc0", 0.3); } },
    cave: (put, I) => { const x0 = Math.round(I.w * 0.72); for (let k = -40; k <= 40; k++) { const top = Math.round(24 - Math.abs(k) * 0.45 - fbm((x0 + k) / 7, 3, 9, 2) * 6); for (let y = 0; y < top; y++) put(x0 + k, I.hz + 6 - y, (k + y) % 6 === 0 ? "#4e4846" : y > top - 2 ? "#8a827c" : k > 6 ? "#5e5654" : "#6e6662", 0.5); } for (let y = 0; y < 10; y++) for (let k = -5; k <= 5; k++) put(x0 + k, I.hz + 5 - y, Math.abs(k) === 5 || y === 9 ? "#6a4a2a" : "#0c0a0c", 0.4); },
    undead: (put, I) => {
      const x0 = Math.round(I.w * 0.7);
      for (let y = 0; y < 16; y++) for (let k = -11; k <= 11; k++) put(x0 + k, I.hz + 4 - y, y > 12 ? "#5a5a62" : Math.abs(k) < 3 && y < 8 ? "#0c0c10" : "#7a7a84", 0.5);
      for (let y = 0; y < 7; y++) for (let k = -12 + y * 2; k <= 12 - y * 2; k++) put(x0 + k, I.hz - 12 - y, "#5a5a62", 0.5);
      for (const gx of [x0 - 24, x0 - 18, x0 + 18, x0 + 26]) { for (let y = 0; y < 5; y++) for (let k = 0; k < 3; k++) put(gx + k, I.roadTop - 2 - y, "#8a8a90", 0.3); }
      for (let y = 0; y < 22; y++) put(Math.round(I.w * 0.18), I.roadTop - 2 - y, "#2a2420", 0.3);
      for (let i = 0; i < 7; i++) { put(Math.round(I.w * 0.18) + i, I.roadTop - 18 - (i >> 1), "#2a2420", 0.3); put(Math.round(I.w * 0.18) - i, I.roadTop - 14 - i, "#2a2420", 0.3); }
    },
    swamp: (put, I) => { const x0 = Math.round(I.w * 0.68); for (const [k, hh] of [[-14, 18], [-6, 12], [4, 20], [13, 9]]) for (let y = 0; y < hh; y++) for (let j = 0; j < 3; j++) put(x0 + k + j, I.hz + 6 - y, j === 2 ? "#4a5450" : "#7a8680", 0.5); for (let k = -16; k < 8; k++) put(x0 + k, I.hz + 6 - 18, "#6a7670", 0.5); },
    ice: (put, I) => { const x0 = Math.round(I.w * 0.72); for (let y = 0; y < 44; y++) { const half = Math.max(0, Math.round(6 - y * 0.13)); for (let k = -half; k <= half; k++) put(x0 + k, I.hz + 4 - y, k > 0 ? "#6a9ac8" : "#c8e4f8", 0.5); } },
    sea: (put, I) => { const x0 = Math.round(I.w * 0.74); for (let y = 0; y < 20; y++) for (let k = -12; k <= 12; k++) if (!(Math.abs(k) < 6 && y < 13)) put(x0 + k, I.hz + 2 - y, k > 0 ? "#3a3e46" : "#5a606a", 0.5); },
    fire: () => {},
  };
  function disc2(put, cx, cy, rad, c, depth) { for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad) put(cx + x, cy + y, c, depth); }

  function road(put, I, P, r, s, img) {
    const { w, roadTop, roadBot, biome, weather } = I;
    const snowy = biome === "snow" || weather === "snow";
    const plank = biome === "marsh";
    for (let x = 0; x < w; x++) {
      const t0 = roadTop + Math.round(fbm(x / 13, 0, s + 9, 2) * 2 - 1), b0 = roadBot + Math.round(fbm(x / 11, 1, s + 9, 2) * 2 - 1);
      for (let y = t0; y < b0; y++) {
        const k = (y - t0) / (b0 - t0);
        let c = P.road;
        if (plank) {
          const wet = fbm(x / 34, 7, s, 2) > 0.52, board = Math.abs(k - 0.32) < 0.13 || Math.abs(k - 0.7) < 0.13;
          c = wet ? (board ? (x % 9 === 0 ? "#4a3624" : y === Math.round(t0 + (b0 - t0) * (k < 0.5 ? 0.2 : 0.58)) ? "#b08a5a" : "#8a6a44") : (x + y * 2) % 7 === 0 ? "#7a9aa4" : mix(mix(I.sky[1], "#6a8a9a", 0.5), "#2e4048", 0.5))
            : h2(x, y, s) > 0.92 ? "#7a6448" : fbm(x / 9, y / 3, s + 2, 2) > 0.62 ? "#4e463a" : "#6a5840";
        }
        else {
          const rut = Math.abs(k - 0.3) < 0.07 || Math.abs(k - 0.72) < 0.07;
          const n = h2(x, y, s);
          c = rut ? P.road2 : n > 0.93 ? mix(P.road, "#ffffff", 0.18) : n < 0.06 ? P.road2 : y === t0 ? mix(P.road, P.verge, 0.5) : P.road;
          if (snowy && !rut) c = n > 0.9 ? "#b4bccc" : "#e4eaf4";
          if (snowy && rut) c = "#a8b0c0";
        }
        put(x, y, c, 0.06);
      }
    }
    // puddles in the ruts after rain, holding a little sky
    if ((weather === "rain" || weather === "storm") && !plank && !snowy) for (let i = 0; i < w / 40; i++) {
      const x = Math.floor(r() * w), y = roadTop + Math.round((roadBot - roadTop) * (r() < 0.5 ? 0.3 : 0.72)), pw = 4 + Math.floor(r() * 6);
      for (let k = 0; k < pw; k++) put(x + k, y, k === 1 ? I.sky[2] : mix(I.sky[1], "#3a4048", 0.4), 0);
    }
  }
  function verge(put, I, P, r, s) {
    const { w, h, roadBot } = I, snowy = I.biome === "snow" || I.weather === "snow";
    for (let x = 0; x < w; x++) for (let y = roadBot - 1; y < h; y++) {
      const n = fbm(x / 7, y / 3, s + 13, 2);
      let c = n > 0.62 ? P.tuft : n < 0.36 ? P.ground2 : P.verge;
      if (snowy) c = n > 0.6 ? "#f4f8ff" : n < 0.35 ? "#c8d2e2" : "#e2e8f2";
      if (y === roadBot - 1 && h2(x, 1, s) < 0.5) c = mix(P.road2, c, 0.5);
      put(x, y, c, 0);
    }
    if (!snowy) for (let x = 0; x < w; x++) { const hh = Math.floor(h2(x, 5, s) * 3); for (let k = 0; k < hh; k++) put(x, roadBot - 2 - k, k ? P.tuft : P.verge, 0); }
    for (let i = 0; i < w / 6; i++) {
      const x = Math.floor(r() * w), y = roadBot + 2 + Math.floor(r() * (h - roadBot - 3));
      if (snowy) { put(x, y, "#ffffff", 0); continue; }
      put(x, y, P.tuft, 0); put(x, y - 1, P.tuft, 0); put(x - 1, y - 1, P.verge, 0); put(x + 1, y - 2, P.tuft, 0);
      if (P.flower.length && r() < 0.3 && !I.night) put(x + 1, y - 3, P.flower[Math.floor(r() * P.flower.length)], 0);
    }
  }

  // ---------- set pieces: a place kind at people scale, drawn into the still; returns its anchors ----------
  const pieceCache = new Map();
  function painted(w, h, pal, fn) {
    const P = new root.Paint.Paint(w, h);
    fn(P);
    const mats = {};
    for (const k in pal) mats[k] = root.Paint.ramp(pal[k]);
    return P.render(mats, { outline: "#16121a" });
  }
  function blit(img, g, x, y, o) {
    o = o || {};
    if (!g) return;
    const G = o.G, depth = o.depth || 0, a = o.alpha === undefined ? 1 : o.alpha, flip = !!o.flip;
    for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
      const c = g.px[j * g.w + i];
      if (!c) continue;
      const xx = Math.round(x) + (flip ? g.w - 1 - i : i), yy = Math.round(y) + j;
      if (o.clip && !o.clip(xx, yy)) continue;
      let col = o.map ? o.map(c, i, j) : c;
      if (!col) continue;
      if (G && !(o.lit && o.lit(c))) col = G(col, depth);
      img.px(xx, yy, col, a);
    }
  }
  const DIGIT = [["###", "#.#", "#.#", "#.#", "###"], [".#.", "##.", ".#.", ".#.", "###"], ["##.", "..#", ".#.", "#..", "###"], ["##.", "..#", ".#.", "..#", "##."], ["#.#", "#.#", "###", "..#", "..#"],
    ["###", "#..", "##.", "..#", "##."], [".##", "#..", "###", "#.#", "###"], ["###", "..#", ".#.", ".#.", ".#."], ["###", "#.#", "###", "#.#", "###"], ["###", "#.#", "###", "..#", "##."]];
  const PIECE_PAL = {
    plaster: "#e8dcc0", beam: "#5a3a22", roof: "#a8483a", thatch: "#c8a050", stone: "#9a968e", sand: "#c4b08a", stoned: "#6a6660", door: "#5a3a22", glass: "#4a5a6a", lit: "#ffd070",
    wood: "#8a5a32", woodd: "#5a3a20", iron: "#4a4650", sign: "#c89a52", red: "#b8402c", white: "#efe6d4", moss: "#5a7a3a", slate: "#5a6070", gold: "#d8a838",
    candle: "#efe2c2", flame: "#ffc850", water: "#4a7aa8", rope: "#c4a26a", bell: "#c8963a", bone: "#d8d0bc", hen: "#f0e8d8", comb: "#c8302a",
  };
  function pieceGrid(kind, lit, seed) {
    const key = kind + (lit ? ":lit" : "") + ":" + seed;
    if (pieceCache.has(key)) return pieceCache.get(key);
    const L = (on, off) => (lit ? on : off);
    let out;
    if (kind === "inn") out = painted(70, 52, PIECE_PAL, (P) => {
      P.layer = 1;
      P.rect(48, 2, 6, 14, "stone", (x, y) => (x > 51 ? -0.4 : 0.2) + ((x + y * 3) % 5 === 0 ? -0.3 : 0));
      P.layer = 2;
      P.rect(4, 22, 54, 30, "plaster", (x, y) => 0.15 - (x - 4) * 0.004 + ((x * 3 + y * 5) % 13 === 0 ? -0.2 : 0));
      for (const x of [4, 17, 30, 44, 57]) P.rect(x, 22, 2, 30, "beam", 0);
      P.rect(4, 34, 55, 2, "beam", 0); P.rect(4, 22, 55, 2, "beam", -0.2);
      for (let k = 0; k < 2; k++) P.line(6 + k * 26, 24, 16 + k * 26, 33, "beam", 0);
      P.layer = 3;
      P.poly([[0, 23], [31, 4], [62, 23]], "roof", (x, y) => 0.3 - (x - 31) * 0.02 + ((Math.round(y) % 3 === 0) ? -0.25 : 0));
      P.layer = 4;
      P.rect(26, 39, 9, 13, "door", (x) => (x === 30 ? -0.4 : 0.1)); P.px(33, 45, "gold", 0.4);
      for (const x of [9, 44]) { P.rect(x, 38, 9, 7, L("lit", "glass"), (xx, yy) => (lit ? 0.3 - Math.abs(xx - x - 4) * 0.06 : 0.2 - (yy - 38) * 0.1)); P.rect(x + 4, 38, 1, 7, "beam", 0); P.rect(x, 41, 9, 1, "beam", 0); }
      P.rect(10, 26, 7, 6, L("lit", "glass"), lit ? 0.2 : 0); P.rect(13, 26, 1, 6, "beam", 0);
      P.rect(58, 28, 11, 1, "iron", 0.2); P.px(68, 29, "iron", 0);
    });
    else if (kind === "waystation") out = painted(66, 40, PIECE_PAL, (P) => {
      P.layer = 1;
      P.rect(4, 14, 58, 26, "wood", (x, y) => ((x % 5) === 0 ? -0.35 : 0.1) - (y - 14) * 0.01);
      P.rect(10, 22, 22, 18, "woodd", -0.6);
      P.layer = 2;
      P.poly([[0, 16], [8, 4], [58, 4], [66, 16]], "thatch", (x, y) => 0.3 - (y - 4) * 0.03 + ((Math.round(x) + Math.round(y)) % 4 === 0 ? -0.3 : 0));
      for (const x of [9, 32]) P.rect(x, 16, 2, 24, "beam", 0.1);
      P.rect(40, 20, 16, 12, "sign", (x, y) => 0.2 - (y - 20) * 0.03);
      for (const [x, y] of [[42, 22], [49, 21], [44, 27], [51, 26]]) P.rect(x, y, 5, 4, "white", 0.2);
      P.px(43, 23, "red"); P.px(50, 22, "red");
      P.rect(36, 34, 16, 4, "woodd", 0.1); P.rect(37, 34, 14, 1, "water", 0.3);
    });
    else if (kind === "shrine") out = painted(24, 36, PIECE_PAL, (P) => {
      P.layer = 1;
      P.rect(3, 30, 18, 6, "stone", (x, y) => 0.2 - (y - 30) * 0.08 + ((x + y) % 4 === 0 ? -0.3 : 0));
      P.rect(5, 10, 14, 20, "stone", (x, y) => 0.2 - (x - 5) * 0.03 + ((x * 3 + y) % 7 === 0 ? -0.3 : 0));
      P.rect(8, 14, 8, 13, "stoned", -0.5);
      P.layer = 2;
      P.poly([[2, 11], [12, 2], [22, 11]], "slate", (x) => 0.3 - (x - 12) * 0.04);
      P.rect(11, 0, 2, 3, "gold", 0.3); P.px(10, 1, "gold", 0.2); P.px(13, 1, "gold", 0);
      P.ell(12, 19, 2.4, 3, "bone", { s: 0.2 }); P.ell(12, 24, 3, 3.2, "bone", { s: 0 });
      P.rect(6, 28, 12, 2, "wood", 0.2);
      for (const x of [7, 15]) { P.rect(x, 26, 2, 2, "candle", 0.3); }
      P.px(3, 33, "moss", 0.2); P.px(4, 32, "moss", 0); P.px(20, 33, "moss", -0.1);
    });
    else if (kind === "milestone") out = painted(18, 30, PIECE_PAL, (P) => {
      // a dressed post with a square shoulder and a cap stone, its lit face and its shadowed side, the miles cut deep with a lit
      // lower lip to each stroke and an arrow under them
      P.rect(0, 3, 18, 3, "sand", (x, y) => (y === 3 ? 0.5 : y === 5 ? -0.1 : 0.25) - (x > 15 ? 0.35 : 0));
      P.rect(1, 2, 16, 1, "sand", 0.6);
      P.rect(2, 6, 14, 21, "sand", (x, y) => (x > 12 ? -0.38 : 0.2 - (x - 2) * 0.02) + ((x * 3 + y * 5) % 13 === 0 ? -0.22 : 0) + (y === 6 ? -0.55 : y === 7 ? -0.25 : 0));
      const n = 2 + (seed % 18), digits = String(n).split("").map(Number), dw = digits.length * 4 - 1;
      digits.forEach((d, i) => { const x0 = Math.round(8 - dw / 2) + i * 4; DIGIT[d].forEach((row, j) => { for (let k = 0; k < 3; k++) if (row[k] === "#") { P.px(x0 + k, 9 + j, "stoned", -0.8); if (DIGIT[d][j + 1] === undefined || DIGIT[d][j + 1][k] !== "#") P.px(x0 + k, 10 + j, "sand", 0.5); } }); });
      P.rect(5, 17, 6, 1, "stoned", -0.8); P.px(10, 16, "stoned", -0.8); P.px(10, 18, "stoned", -0.8); P.px(11, 17, "stoned", -0.8); P.rect(5, 18, 5, 1, "sand", 0.5);
      P.rect(0, 26, 18, 4, "moss", (x) => (x % 3 === 0 ? -0.3 : 0.1));
      P.px(2, 24, "moss", 0.2); P.px(3, 25, "moss", 0); P.px(14, 23, "moss", -0.1); P.px(15, 24, "moss", 0);
    });
    else if (kind === "milestone_lean") {
      // the Leaning Mile: the same stone sheared over row by row, so its number stays crisp instead of being resampled by a turn
      const up = pieceGrid("milestone", lit, seed);
      out = new A.Grid(30, 30);
      for (let y = 0; y < up.h; y++) { const dx = y >= 26 ? 0 : Math.round((26 - y) * 0.46); for (let x = 0; x < up.w; x++) { const c = up.px[y * up.w + x]; if (c) out.set(x + dx, y, c); } }
    }
    else if (kind === "cairn") out = painted(36, 36, Object.assign({ granite: "#8e8a84", flint: "#aaa498", slab: "#76726c", snow: "#f2f6fc", blue: "#3a6ab8" }, PIECE_PAL), (P) => {
      // a cairn: a heap of fieldstones stacked smaller and smaller to a single stone on top, each one shaded on its own
      const snowy = /snow/.test(String(seed));
      const rocks = [[5.5, 30, 5.5, 4, "granite"], [16, 30.5, 5.8, 3.8, "slab"], [27.5, 30, 6, 4, "flint"], [10.5, 24, 5.6, 3.4, "flint"], [21.5, 24.2, 5.4, 3.4, "granite"],
        [31, 26, 3, 2.4, "slab"], [16, 18.2, 5.4, 3.2, "slab"], [17, 12.6, 4.2, 2.8, "flint"], [16.5, 7.8, 3.2, 2.2, "granite"], [17, 4, 2, 1.6, "slab"]];
      rocks.forEach(([x, y, rx, ry, m], i) => {
        P.layer = 1 + i;
        P.ell(x, y, rx, ry, m, { s: 0.15, fn: (px, py, s) => s + ((Math.round(px) * 7 + Math.round(py) * 3 + i) % 11 === 0 ? -0.3 : 0) });
        if (snowy && i >= 3) P.ell(x - 0.5, y - ry + 0.8, rx * 0.7, 1, "snow", { s: 0.3 });
      });
      P.layer = 20;
      P.ell(21, 23.4, 1.4, 1, "blue", { s: 0.3 });
      P.rect(0, 34, 36, 2, snowy ? "snow" : "moss", (x) => (x % 3 === 0 ? -0.3 : 0.1));
    });
    else if (kind === "fingerpost") out = painted(36, 46, PIECE_PAL, (P) => {
      // a fingerpost: three arms pointing three ways, a cap on top, a heap of stones at the foot
      P.layer = 1;
      P.rect(16, 4, 4, 40, "wood", (x) => (x === 16 ? 0.3 : x === 19 ? -0.35 : 0));
      P.poly([[15, 4], [18, 0], [21, 4]], "woodd", 0.2);
      P.layer = 2;
      P.poly([[18, 7], [33, 7], [36, 10.5], [33, 14], [18, 14]], "white", (x, y) => 0.2 - (y - 7) * 0.05);
      P.poly([[19, 17], [3, 17], [0, 20.5], [3, 24], [19, 24]], "white", (x, y) => 0.1 - (y - 17) * 0.05);
      P.poly([[17, 27], [30, 27], [33, 30.5], [30, 34], [17, 34]], "sign", (x, y) => 0.15 - (y - 27) * 0.05);
      for (const [x, y, n] of [[21, 10, 10], [5, 20, 11], [20, 30, 9]]) for (let i = 0; i < n; i += 2) P.px(x + i, y + (i % 4 ? 0 : 1), "woodd", -0.6);
      P.layer = 3;
      for (const [x, y, r] of [[12, 43, 3], [23, 43.5, 2.6], [17, 42, 2.4], [8, 44.5, 2], [27, 44.6, 1.6]]) P.ell(x, y, r, r * 0.7, "stone", { s: 0.2 });
    });
    else if (kind === "pillar") out = painted(10, 26, PIECE_PAL, (P) => {
      P.poly([[1, 26], [2, 4], [5, 0], [8, 3], [9, 26]], "stone", (x, y) => 0.25 - (x - 2) * 0.09 + ((x + y * 3) % 7 === 0 ? -0.3 : 0));
      P.px(3, 9, "moss", 0); P.px(4, 10, "moss", 0.2); P.px(2, 20, "moss", -0.1);
    });
    else if (kind === "haycart") out = painted(44, 28, Object.assign({ hay: "#e0bc5a" }, PIECE_PAL), (P) => {
      P.layer = 1;
      P.ell(22, 9, 19, 9, "hay", { s: 0.2, fn: (x, y, s) => (y > 15 ? false : s + ((Math.round(x) * 3 + Math.round(y)) % 5 === 0 ? -0.35 : 0)) });
      P.layer = 2;
      P.rect(2, 13, 40, 7, "wood", (x, y) => (y === 13 ? 0.35 : x % 7 === 0 ? -0.35 : 0));
      P.line(0, 20, 42, 20, "woodd", 0); P.line(40, 17, 44, 22, "woodd", 0);
      for (const cx of [10, 32]) { P.ell(cx, 21.5, 5.5, 5.5, "woodd", { s: 0, fn: (x, y, s) => ((x - cx) ** 2 + (y - 21.5) ** 2 < 12 ? (Math.abs(x - cx) < 0.8 || Math.abs(y - 21.5) < 0.8 ? -0.2 : false) : s) }); P.ell(cx, 21.5, 1.4, 1.4, "wood", { s: 0.3 }); }
    });
    else if (kind === "log") out = painted(40, 14, Object.assign({ cap: "#c8402c", bark: "#6a4a30" }, PIECE_PAL), (P) => {
      P.ell(19, 8, 18, 5, "bark", { s: 0.1, fn: (x, y, s) => s + (Math.round(x) % 5 === 0 ? -0.3 : 0) - (y - 8) * 0.06 });
      P.ell(36, 8, 3, 5, "wood", { s: 0.3 }); P.ell(36, 8, 1.4, 2.4, "woodd", { s: 0 });
      for (const x of [8, 14, 25]) { P.ell(x, 3.4, 2, 1.3, "cap", { s: 0.3 }); P.px(x, 4.5, "white", 0.2); }
      P.px(9, 2.4, "white"); P.px(25, 2.4, "white");
      P.rect(2, 12, 30, 2, "moss", (x) => (x % 4 === 0 ? -0.3 : 0));
    });
    else if (kind === "boat") out = painted(40, 16, PIECE_PAL, (P) => {
      // a rowing boat drawn up and turned over on the verge, its oars across it
      P.poly([[1, 13], [5, 3], [35, 3], [39, 13]], "red", (x, y) => 0.35 - (y - 3) * 0.06 + (y % 3 === 0 ? -0.3 : 0));
      P.rect(4, 12, 32, 2, "woodd", 0);
      P.line(6, 1, 30, 6, "wood", 0.3); P.line(10, 7, 36, 0, "wood", 0.1);
      P.rect(0, 14, 40, 2, "moss", (x) => (x % 3 === 0 ? -0.3 : 0.1));
    });
    else if (kind === "turtle") out = painted(15, 8, { shell: "#6a7a3a", plate: "#a8a050", skin: "#8aa05a" }, (P) => {
      // a grey-green dome the size of a stepping stone, plates picked out in ochre
      P.ell(7, 5, 6.5, 4.6, "shell", { s: 0.25, fn: (x, y, s) => (y > 6.5 ? false : s) });
      for (const [x, y] of [[4, 3], [7, 2], [10, 3], [5.5, 5], [8.5, 5]]) P.ell(x, y, 1.2, 0.9, "plate", { s: 0.3 });
      P.rect(1, 6, 12, 1, "skin", -0.2); P.ell(13.4, 5.6, 1.4, 1.1, "skin", { s: 0.2 });
    });
    else if (kind === "crossroads") out = painted(44, 60, PIECE_PAL, (P) => {
      P.layer = 1;
      P.rect(32, 6, 3, 54, "woodd", (x) => (x === 32 ? 0.2 : -0.3));
      P.rect(18, 6, 17, 3, "woodd", (x, y) => (y === 6 ? 0.2 : -0.2));
      P.line(28, 9, 33, 14, "woodd", 0);
      P.rect(20, 9, 1, 8, "rope", 0); P.ell(20.5, 18, 1.6, 2, "rope", { s: 0, fn: (x, y, s) => ((x - 20.5) ** 2 + (y - 18) ** 2 < 1.4 ? false : s) });
      P.layer = 2;
      P.rect(10, 18, 3, 42, "wood", (x) => (x === 10 ? 0.25 : -0.15));
      P.poly([[0, 22], [3, 19], [22, 19], [22, 25], [3, 25]], "sign", (x, y) => 0.25 - (y - 19) * 0.06 + (x % 6 === 0 ? -0.2 : 0));
      P.poly([[3, 29], [24, 29], [27, 32], [24, 35], [3, 35]], "sign", (x, y) => 0.15 - (y - 29) * 0.06 + (x % 7 === 0 ? -0.2 : 0));
      P.poly([[1, 39], [20, 39], [20, 44], [1, 44], [-1, 41.5]], "sign", (x, y) => 0.05 - (y - 39) * 0.06);
      for (const [x, y, n] of [[6, 22, 10], [7, 32, 12], [4, 41, 9]]) for (let i = 0; i < n; i += 2) P.px(x + i, y, "woodd", -0.5);
    });
    else if (kind === "ruin") out = painted(36, 64, PIECE_PAL, (P) => {
      P.poly([[4, 64], [6, 14], [10, 8], [13, 12], [17, 4], [21, 10], [24, 7], [28, 18], [30, 64]], "stone", (x, y) => 0.25 - (x - 6) * 0.025 + ((Math.floor(y / 4) + Math.floor((x + (Math.floor(y / 4) % 2) * 3) / 6)) % 5 === 0 ? -0.35 : 0) + (y % 4 === 0 ? -0.2 : 0));
      P.rect(14, 22, 5, 9, "stoned", -0.7); P.ell(16.5, 22, 2.5, 2.5, "stoned", { s: -0.7 });
      P.rect(12, 44, 7, 20, "stoned", -0.75);
      for (let i = 0; i < 18; i++) P.px(26 - (i % 5), 30 + i * 1.6, "moss", (i % 3) * 0.2 - 0.1);
      for (const [x, y] of [[31, 62], [33, 61], [1, 62], [2, 60]]) P.rect(x, y, 3, 2, "stone", 0);
    });
    else if (kind === "bridge") out = painted(84, 26, PIECE_PAL, (P) => {
      P.poly([[0, 6], [84, 6], [84, 26], [72, 26], [66, 14], [42, 9], [18, 14], [12, 26], [0, 26]], "stone", (x, y) => 0.2 - (y - 6) * 0.015 + ((Math.floor(y / 3) + Math.floor((x + (Math.floor(y / 3) % 2) * 4) / 8)) % 4 === 0 ? -0.3 : 0) + (y % 3 === 0 ? -0.15 : 0));
      P.rect(0, 3, 84, 3, "stone", 0.35);
      for (let x = 2; x < 84; x += 8) P.rect(x, 0, 4, 3, "stone", 0.3);
    });
    else if (kind === "tollbooth") out = painted(26, 34, PIECE_PAL, (P) => {
      P.rect(2, 12, 20, 22, "wood", (x, y) => ((x % 4) === 0 ? -0.3 : 0.1));
      P.poly([[0, 13], [12, 3], [24, 13]], "slate", (x) => 0.3 - (x - 12) * 0.04);
      P.rect(7, 17, 10, 7, L("lit", "glass"), 0.1); P.rect(6, 24, 12, 2, "woodd", 0.2);
      P.rect(10, 27, 4, 7, "door", 0);
    });
    else if (kind === "bellpost") out = painted(16, 40, PIECE_PAL, (P) => {
      P.rect(3, 4, 3, 36, "wood", (x) => (x === 3 ? 0.2 : -0.2)); P.rect(3, 4, 11, 2, "wood", 0.1);
      P.ell(11, 11, 3, 3.6, "bell", { s: 0.2 }); P.rect(8, 13, 7, 2, "bell", -0.2); P.px(11, 16, "iron");
    });
    else if (kind === "raft") out = painted(40, 10, PIECE_PAL, (P) => {
      P.rect(0, 2, 40, 5, "wood", (x, y) => (x % 6 === 0 ? -0.4 : 0.15 - (y - 2) * 0.1));
      P.rect(1, 7, 38, 2, "woodd", -0.3);
      for (const x of [2, 37]) P.rect(x, 0, 1, 3, "woodd", 0);
    });
    else if (kind === "sign") out = painted(14, 12, PIECE_PAL, (P) => {
      P.rect(1, 1, 12, 9, "sign", (x, y) => 0.25 - (y - 1) * 0.05 + (x % 5 === 0 ? -0.15 : 0));
      P.ell(7, 5.5, 2.8, 2.2, "hen", { s: 0.2 }); P.ell(9.5, 3.5, 1.4, 1.4, "hen", { s: 0.3 }); P.px(9, 2, "comb"); P.px(11, 4, "gold");
      P.px(5, 8, "gold"); P.px(8, 8, "gold");
    });
    else if (kind === "balcony") out = painted(64, 84, Object.assign({ awn: "#8a3a5a", rail: "#3a2a24", pot: "#a8583a", leaf: "#5a8a3a" }, PIECE_PAL), (P) => {
      // a tall town house: plaster over a stone ground floor, a long window above opening onto a railed balcony, a hipped roof
      P.layer = 1;
      P.rect(4, 14, 56, 70, "plaster", (x, y) => 0.18 - (x - 4) * 0.005 + ((x * 3 + y * 7) % 17 === 0 ? -0.18 : 0));
      P.rect(4, 58, 56, 26, "stone", (x, y) => 0.15 + ((Math.floor(y / 4) + Math.floor((x + (Math.floor(y / 4) % 2) * 3) / 6)) % 3 === 0 ? -0.25 : 0) + (y % 4 === 0 ? -0.2 : 0));
      for (const x of [4, 58]) P.rect(x, 14, 2, 70, "beam", -0.1);
      P.rect(4, 56, 56, 2, "beam", 0);
      P.layer = 2;
      P.poly([[0, 16], [12, 2], [52, 2], [64, 16]], "roof", (x, y) => 0.3 - y * 0.02 + (Math.round(y) % 3 === 0 ? -0.25 : 0) + (x > 40 ? -0.15 : 0));
      P.rect(44, 0, 6, 6, "stone", (x) => (x > 47 ? -0.4 : 0.2));
      P.rect(20, 18, 24, 18, L("lit", "glass"), (x, y) => (lit ? 0.3 - Math.abs(x - 32) * 0.03 : 0.25 - (y - 18) * 0.04)); P.rect(31, 18, 2, 18, "beam", 0); P.rect(18, 17, 28, 2, "beam", 0.1);
      for (const [x, w] of [[16, 4], [44, 4]]) P.rect(x, 18, w, 18, "awn", (xx, yy) => 0.15 - (yy - 18) * 0.02 + (xx % 2 ? -0.15 : 0));
      P.rect(12, 36, 40, 3, "stone", 0.3); P.rect(12, 39, 40, 2, "stoned", -0.2);
      P.layer = 3;
      P.rect(12, 28, 40, 1, "rail", 0.2);
      for (let x = 12; x < 52; x += 3) P.rect(x, 29, 1, 7, "rail", 0);
      for (const x of [14, 46]) { P.ell(x + 2, 26, 3, 2.5, "leaf", { s: 0.25 }); P.rect(x, 27, 4, 2, "pot", 0.1); }
      P.layer = 2;
      P.rect(10, 66, 10, 18, "door", (x) => (x === 15 ? -0.4 : 0.1)); P.px(18, 75, "gold", 0.4);
      for (const x of [28, 44]) { P.rect(x, 64, 10, 9, L("lit", "glass"), lit ? 0.25 : 0.1); P.rect(x + 4, 64, 1, 9, "beam", 0); P.rect(x - 1, 73, 12, 1, "beam", 0.2); }
    });
    else if (kind === "stall") out = painted(54, 52, Object.assign({ awn: "#b8402c", awn2: "#efe6d4", goods: "#d8a838", cloth: "#3a6a8a" }, PIECE_PAL), (P) => {
      // a market stall: striped awning on two poles, a counter of goods, a cart wheel peeking out behind
      P.layer = 1;
      for (const x of [3, 49]) P.rect(x, 6, 2, 46, "wood", (xx) => (xx === x ? 0.2 : -0.2));
      P.layer = 2;
      P.poly([[0, 4], [54, 4], [52, 14], [2, 14]], "awn", (x, y) => (Math.floor(x / 6) % 2 ? 0.05 - (y - 4) * 0.02 : null));
      for (let x = 2; x < 52; x++) if (Math.floor(x / 6) % 2 === 0) for (let y = 4; y < 14; y++) P.px(x, y, "awn2", 0.2 - (y - 4) * 0.02);
      for (let x = 2; x < 52; x += 6) P.ell(x + 3, 14, 3, 1.6, Math.floor(x / 6) % 2 ? "awn" : "awn2", { s: -0.1 });
      P.layer = 3;
      P.rect(0, 38, 54, 14, "wood", (x, y) => (y === 38 ? 0.4 : x % 9 === 0 ? -0.3 : 0.05));
      P.rect(2, 36, 50, 3, "cloth", (x) => (x % 4 === 0 ? -0.2 : 0.15));
      for (let k = 0; k < 8; k++) P.ell(6 + k * 6, 34, 2.4, 2, k % 3 === 0 ? "red" : k % 3 === 1 ? "goods" : "white", { s: 0.25 });
    });
    else if (kind === "lamppost") out = painted(16, 56, PIECE_PAL, (P) => {
      P.rect(6, 10, 3, 46, "iron", (x) => (x === 6 ? 0.3 : -0.2)); P.rect(4, 54, 7, 2, "iron", 0);
      P.rect(6, 8, 9, 2, "iron", 0.1); P.rect(12, 10, 1, 3, "iron", 0);
      P.rect(10, 13, 5, 7, L("lit", "glass"), lit ? 0.35 : 0.1); P.rect(10, 12, 5, 1, "iron", 0.2); P.rect(10, 20, 5, 1, "iron", 0);
    });
    else if (kind === "tent") out = painted(104, 70, Object.assign({ canvas: "#efe2c8", stripe: "#b8402c", flag: "#d8a838" }, PIECE_PAL), (P) => {
      // the big top: a striped canvas cone over a drum, its flap open on the ring, a pennant on the king pole
      P.layer = 1;
      P.rect(51, 0, 2, 12, "woodd", 0); P.poly([[53, 1], [62, 4], [53, 7]], "flag", 0.2);
      P.poly([[52, 10], [100, 38], [4, 38]], "canvas", (x, y) => { const a = Math.atan2(x - 52, y - 10); return (Math.floor((a + 2) * 7) % 2 ? null : 0.15 - (y - 10) * 0.005); });
      for (let y = 10; y < 38; y++) for (let x = 4; x < 100; x++) { const a = Math.atan2(x - 52, y - 10), inside = Math.abs(x - 52) <= (y - 10) * 48 / 28; if (inside && Math.floor((a + 2) * 7) % 2) P.px(x, y, "stripe", 0.1 - (x - 52) * 0.004); }
      P.rect(6, 38, 92, 32, "canvas", (x, y) => (Math.floor((x - 6) / 8) % 2 ? null : 0.05 - (x - 52) * 0.003));
      for (let x = 6; x < 98; x++) if (Math.floor((x - 6) / 8) % 2) for (let y = 38; y < 70; y++) P.px(x, y, "stripe", -0.05 - (x - 52) * 0.003);
      for (let x = 4; x < 100; x += 8) P.ell(x + 4, 38, 4, 2, "stripe", { s: 0 });
      P.layer = 2;
      P.poly([[36, 70], [52, 42], [68, 70]], "door", (x) => -0.5 + Math.abs(x - 52) * 0.01);
      P.poly([[30, 70], [52, 40], [40, 70]], "canvas", 0.3); P.poly([[64, 70], [52, 40], [74, 70]], "canvas", -0.1);
    });
    else if (kind === "stage") out = painted(96, 56, Object.assign({ curtain: "#8a2a34", curtain2: "#5a1a24", boards: "#a87a4a", gilt: "#d8a838" }, PIECE_PAL), (P) => {
      // the players' fold-out stage: a wagon bed of boards, a painted proscenium, red curtains drawn back, footlights
      P.layer = 1;
      P.rect(6, 8, 84, 32, "slate", (x, y) => -0.4 + ((x + y) % 7 === 0 ? 0.1 : 0));
      P.layer = 2;
      for (const [x0, d] of [[6, 1], [90, -1]]) for (let y = 8; y < 40; y++) { const w = 10 + Math.round(Math.sin((y - 8) / 32 * Math.PI) * 8); for (let i = 0; i < w; i++) P.px(x0 + d * i - (d < 0 ? 1 : 0), y, (i % 4) < 2 ? "curtain" : "curtain2", 0.15 - i * 0.02); }
      P.rect(2, 2, 92, 7, "curtain", (x, y) => (y === 8 ? -0.3 : 0.1 + (x % 8 < 4 ? 0.1 : -0.1)));
      P.rect(0, 0, 96, 3, "gilt", 0.2); P.rect(0, 0, 3, 42, "gilt", 0.1); P.rect(93, 0, 3, 42, "gilt", -0.2);
      P.rect(0, 40, 96, 4, "boards", 0.35); P.rect(2, 44, 92, 12, "wood", (x) => (x % 10 === 0 ? -0.4 : -0.05));
      for (let x = 8; x < 92; x += 12) P.px(x, 41, "flame", 0.4);
      for (const x of [6, 86]) P.rect(x, 50, 4, 6, "woodd", -0.2);
    });
    pieceCache.set(key, out);
    return out;
  }
  // a river across the road: [x0, x1) from just above the road to the bottom, with muddy banks
  function river(img, I, x0, x1, seed) {
    for (let y = I.roadTop - 3; y < I.h; y++) {
      const wob = Math.round(fbm(y / 6, 0, seed, 2) * 3), a = x0 + wob - Math.round((y - I.roadTop) * 0.06), b = x1 - wob + Math.round((y - I.roadTop) * 0.06);
      for (let x = a - 2; x < b + 2; x++) {
        const edge = x < a || x >= b;
        // glints as short, scattered dashes along the current (a regular lattice of them reads as a screen-door grid)
        const glint = h2(Math.floor((x + y * 2) / 3), y, seed) > 0.9 && y % 2 === 0;
        const c = edge ? "#6a5238" : glint ? "#7aa8cc" : y < I.roadTop ? "#3a6a94" : mix("#3e6e98", "#244a72", (y - I.roadTop) / (I.h - I.roadTop));
        img.px(x, y, I.G(c, edge ? 0.05 : 0.1));
      }
    }
  }
  // a town round x: "far" is roofs and a spire on the horizon ahead, "near" its wall and gate at the roadside, "street" the houses of its edge
  function town(img, I, x, mode, seed) {
    const s = hash("town" + (seed || "") + mode), G = I.G, near = mode !== "far";
    const base = mode === "far" ? I.hz + 9 : I.roadTop - 1, sc = mode === "far" ? 0.7 : mode === "street" ? 1.6 : 1.2, depth = mode === "far" ? 0.55 : 0.18;
    const span = Math.round((mode === "street" ? 110 : 54) * (mode === "far" ? 1 : 1));
    const walls = ["#e8dcc0", "#d8c8a0", "#cbb894", "#e2d4b4"], roofs = ["#a8483a", "#8a5a3a", "#5a6070", "#b8683a", "#7a3a2e"];
    const P = (px, py, c) => img.px(px, py, G(c, depth));
    let hx = Math.round(x - span / 2), i = 0;
    const spireAt = Math.floor(h2(1, 2, s) * 3) + 1;
    while (hx < x + span / 2) {
      const w = Math.round((7 + Math.floor(h2(i, 1, s) * 6)) * sc), wh = Math.round((5 + Math.floor(h2(i, 2, s) * 4)) * sc), wall = walls[Math.floor(h2(i, 3, s) * walls.length)], roof = roofs[Math.floor(h2(i, 4, s) * roofs.length)];
      const top = base - wh;
      for (let yy = top; yy <= base; yy++) for (let xx = hx; xx < hx + w; xx++) P(xx, yy, xx === hx || xx === hx + w - 1 ? "#5a3a22" : xx > hx + w * 0.7 ? mix(wall, "#6a5a48", 0.25) : wall);
      if (near) { P(hx + Math.floor(w / 2), base, "#3a2416"); P(hx + Math.floor(w / 2), base - 1, "#3a2416"); P(hx + Math.floor(w / 2), base - 2, "#3a2416"); for (const wx of [hx + 2, hx + w - 3]) if (w > 8) { P(wx, top + 2, I.night || I.hr > 18 ? "#ffd070" : "#4a5a6a"); P(wx, top + 3, I.night || I.hr > 18 ? "#f0b040" : "#3a4a5a"); } }
      const rh = Math.ceil(w / 2) + 1;
      for (let k = 0; k < rh; k++) for (let xx = hx - 1 + k; xx <= hx + w - k; xx++) P(xx, top - 1 - k, xx > hx + w / 2 ? mix(roof, "#2a1a14", 0.3) : k === 0 ? mix(roof, "#2a1a14", 0.2) : roof);
      if (i === spireAt) { const cx = hx + Math.floor(w / 2), sh = Math.round(12 * sc); for (let k = 0; k < sh; k++) { const half = Math.max(0, Math.round((sh - k) / sh * 2.5 * sc)); for (let d = -half; d <= half; d++) P(cx + d, top - rh - k, d > 0 ? "#3e4450" : "#5a6070"); } P(cx, top - rh - sh, "#d8a838"); }
      else if (h2(i, 5, s) > 0.5) { P(hx + w - 3, top - rh + 1, "#6a5a50"); P(hx + w - 3, top - rh, "#6a5a50"); }
      hx += w + (near ? 1 : 0); i++;
    }
    if (mode === "near") {
      // the town wall runs off the left edge, its gate open onto the road
      for (let xx = 0; xx < x + 10; xx++) for (let yy = I.roadTop - 9; yy < I.roadTop + 1; yy++) { if (yy === I.roadTop - 9 && xx % 4 > 1) continue; img.px(xx, yy, G((xx + (yy % 3 === 0 ? 2 : 0)) % 6 === 0 || yy % 3 === 0 ? "#7a766e" : "#a6a298", 0.12)); }
      const gx = x + 10;
      for (let yy = I.roadTop - 18; yy < I.roadTop + 1; yy++) for (let xx = gx; xx < gx + 12; xx++) img.px(xx, yy, G(xx === gx + 11 ? "#6a6660" : (xx + yy) % 5 === 0 ? "#8a867e" : "#b4b0a6", 0.1));
      for (let xx = gx; xx < gx + 12; xx += 3) img.px(xx, I.roadTop - 19, G("#b4b0a6", 0.1));
      for (let yy = I.roadTop - 9; yy < I.roadTop + 1; yy++) for (let xx = gx + 3; xx < gx + 9; xx++) if (yy > I.roadTop - 8 || (xx > gx + 3 && xx < gx + 8)) img.px(xx, yy, G("#2a1e18", 0.1));
      img.rect(gx + 4, I.roadTop - 16, 4, 3, G("#b8402c", 0.1));
    }
  }
  function piece(img, kind, x, I, o) {
    o = o || {};
    kind = KIND_ALIAS[kind] || kind;
    const lit = I.night || I.hr >= 17.4 || I.hr < 6.4 || I.weather === "storm";
    const G = I.G, feet = I.feet, rt = I.roadTop;
    const B = (g, gx, gy, depth, litMat) => blit(img, g, gx, gy, { G, depth: depth || 0.15, lit: litMat });
    const warm = (c) => c === PIECE_PAL.lit || c === PIECE_PAL.flame || C(c)[0] > 240 && C(c)[1] > 180 && C(c)[2] < 120;
    const A0 = { kind, x };
    if (kind === "inn") {
      const g = pieceGrid("inn", lit, 0), gx = x - 32, gy = rt - g.h + 1;
      B(g, gx, gy, 0.2, lit ? warm : null);
      return Object.assign(A0, { door: [gx + 30, rt], sign: [gx + 66, gy + 30], chimney: [gx + 51, gy + 1], windows: [[gx + 13, gy + 41], [gx + 48, gy + 41], [gx + 13, gy + 29]], lit, w: g.w, gy });
    }
    if (kind === "waystation") {
      const g = pieceGrid("waystation", lit, 0), gx = x - 33, gy = rt - g.h + 1;
      B(g, gx, gy, 0.2);
      return Object.assign(A0, { board: [gx + 48, gy + 26], door: [gx + 20, rt], chimney: [gx + 50, gy + 4], lit });
    }
    if (kind === "shrine") {
      const g = pieceGrid("shrine", false, 0), gx = x - 12, gy = rt - g.h + 2;
      B(g, gx, gy, 0.15);
      return Object.assign(A0, { candle: [gx + 12, gy + 25], candles: [[gx + 8, gy + 25], [gx + 16, gy + 25]], bowl: [gx + 12, gy + 29], top: [gx + 12, gy] });
    }
    if (kind === "milestone" && o.variant === "cairn" || kind === "cairn") {
      const g = pieceGrid("cairn", false, I.biome === "snow" || I.weather === "snow" ? "snow" : "x"), gx = x - 18, gy = rt - g.h + 3;
      B(g, gx, gy, 0.1);
      return Object.assign(A0, { top: [gx + 17, gy + 2], foot: [gx + 18, rt] });
    }
    if (kind === "milestone") {
      const lean = o.variant === "lean", g = pieceGrid(lean ? "milestone_lean" : "milestone", false, hash(String(o.seed || "")) % 997), gx = x - 9, gy = rt - g.h + 3;
      B(g, gx, gy, 0.1);
      return Object.assign(A0, { top: [gx + (lean ? 21 : 9), gy + 2], foot: [gx + 9, rt] });
    }
    if (kind === "crossroads") {
      // a side road crossing the high road, then what marks the place: a fingerpost, the four standing stones, or Gallows Cross
      for (let y = I.hz + 8; y < rt + 1; y++) { const k = (y - I.hz - 8) / (rt - I.hz - 8), half = 1 + k * 7, cx = x + (1 - k) * 18; for (let xx = Math.round(cx - half); xx <= cx + half; xx++) img.px(xx, y, G(Math.abs(xx - cx) > half - 1 ? "#8a7a54" : "#b09a6c", 0.4 - k * 0.3)); }
      for (let y = I.roadBot - 1; y < I.h; y++) { const k = (y - I.roadBot) / (I.h - I.roadBot), half = 8 + k * 6, cx = x - k * 10; for (let xx = Math.round(cx - half); xx <= cx + half; xx++) img.px(xx, y, G(Math.abs(xx - cx) > half - 1 ? "#8a7a54" : "#b09a6c", 0)); }
      if (o.variant === "gallows") {
        const g = pieceGrid("crossroads", false, 0), gx = x - 12, gy = rt - g.h + 2;
        B(g, gx, gy, 0.12);
        return Object.assign(A0, { post: [gx + 11, gy + 18], gallows: [gx + 20, gy + 18] });
      }
      if (o.variant === "stones") {
        const pg = pieceGrid("pillar", false, 0);
        for (const [dx, dy, d] of [[-30, -10, 0.35], [26, -9, 0.35], [-20, 0, 0.12], [18, 1, 0.12]]) {
          B(pg, x + dx - 5, rt + dy - pg.h + 2, d);
          for (let k = 0; k < 4; k++) for (let i = -2 + (k >> 1); i <= 2 - (k >> 1); i++) img.px(x + dx + i + 3, rt + dy + 1 - (k >> 1), G(k % 2 ? "#b8b4ac" : "#8a867e", d));
        }
        return Object.assign(A0, { post: [x - 20, rt - 20], heap: [x + 21, rt] });
      }
      const g = pieceGrid("fingerpost", false, 0), gx = x - 18, gy = rt - g.h + 3;
      B(g, gx, gy, 0.12);
      return Object.assign(A0, { post: [gx + 18, gy + 10], arms: [[gx + 34, gy + 10], [gx + 1, gy + 20]] });
    }
    if (kind === "town") {
      town(img, I, x, o.variant || "far", o.seed);
      return Object.assign(A0, { gate: [x, rt] });
    }
    if (kind === "camp") {
      // the midday halt: packs down, a small fire in a ring of stones, a kettle on it
      for (const [dx, c] of [[-5, "#8a867e"], [-3, "#b8b4ac"], [3, "#8a867e"], [5, "#b8b4ac"]]) { img.px(x + dx, feet, G(c, 0)); img.px(x + dx, feet - 1, G(c, 0)); }
      img.line(x - 4, feet - 1, x + 4, feet - 3, G("#5a3a20", 0)); img.line(x - 4, feet - 3, x + 4, feet - 1, G("#6a4a2a", 0));
      img.rect(x - 2, feet - 9, 5, 4, G("#3a3a40", 0)); img.rect(x - 2, feet - 9, 5, 1, G("#6a6a72", 0)); img.px(x + 3, feet - 8, G("#3a3a40", 0));
      for (const [dx, w, h, c] of [[-16, 7, 6, "#8a5a32"], [12, 6, 5, "#6a7a4a"], [17, 5, 4, "#a06a3a"]]) { img.rect(x + dx, feet - h + 1, w, h, G(c, 0)); img.rect(x + dx, feet - h + 1, w, 1, G("#2a1a12", 0)); img.rect(x + dx + 1, feet - h + 2, w - 2, 1, G("#e8d8b0", 0)); }
      return Object.assign(A0, { fire: [x, feet - 3] });
    }
    if (kind === "fingerpost") {
      const g = pieceGrid("fingerpost", false, 0), gx = x - 18, gy = rt - g.h + 3;
      B(g, gx, gy, 0.12);
      return Object.assign(A0, { post: [gx + 18, gy + 10], top: [gx + 18, gy] });
    }
    if (kind === "haycart" || kind === "log" || kind === "boat") {
      const g = pieceGrid(kind, false, 0), gx = x - g.w / 2, gy = kind === "haycart" ? rt - g.h + 4 : I.roadBot - g.h + 6;
      B(g, gx, gy, 0.1);
      return Object.assign(A0, { top: [x, gy] });
    }
    if (kind === "crow") {
      // on a milestone's head when it stands on one, else on a fence post
      const y = rt - (o.variant === "post" ? 7 : 24);
      const rows = ["....kk.", "...kkkb", ".kkkkkk", "kkkkkk.", ".kkkk..", "..d.d.."];
      rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== ".") img.px(x - 3 + i, y - 5 + j, G(row[i] === "b" ? "#d8a838" : row[i] === "d" ? "#3a3030" : (i + j) % 4 === 0 ? "#2e2a3a" : "#16121a", 0.1)); });
      return Object.assign(A0, { perch: [x, y] });
    }
    if (kind === "ruin") {
      const g = pieceGrid("ruin", false, 0), gx = x - 18, gy = rt - g.h + 1;
      B(g, gx, gy, 0.3);
      return Object.assign(A0, { top: [gx + 17, gy + 4], door: [gx + 15, rt] });
    }
    if (kind === "toll") {
      const x0 = x - 30, x1 = x + 40;
      river(img, I, x0, x1, I.seed + 1);
      const br = pieceGrid("bridge", false, 0);
      B(br, x - 37, rt - 9, 0.12);
      const booth = pieceGrid("tollbooth", lit, 0);
      B(booth, x - 64, rt - booth.h + 1, 0.12, lit ? warm : null);
      for (let y = 0; y < 14; y++) img.px(x - 39, rt - 13 + y, G("#5a3a22", 0.1));
      return Object.assign(A0, { river: [x0, x1], pole: [x - 39, rt - 12], keeper: [x - 52, rt], deck: rt - 9, window: [x - 52, rt - 16], ford: [x0 + 6, x1 - 6] });
    }
    if (kind === "ford") {
      // a broad shallow river over the road, a line of flat stepping stones along the walking line, reeds on both banks
      const x0 = x - 30, x1 = x + 30;
      river(img, I, x0, x1, I.seed + 2);
      const stones = [];
      for (let k = 0; k < 6; k++) {
        const sx = Math.round(x0 + 6 + k * ((x1 - x0 - 12) / 5)), sy = feet + 1 + (k % 2);
        // each stone its own rounded boulder with water between: a lit cap, a shaded flank going dark to the right, a wet dark
        // waterline and a fleck of foam either side, so the row reads as stones and not as a plank
        const rx = 3 + Math.round(h2(k, 5, I.seed) * 1.4), top = 4 + (k % 2 ? 0 : 1), lean = h2(k, 6, I.seed) > 0.5 ? 1 : 0;
        for (let j = 0; j <= top; j++) {
          const half = j === top ? rx - 2 : j === top - 1 ? rx - 1 : rx, y = sy - j;
          for (let i = -half; i <= half; i++) {
            const u = (i + half) / (2 * half + 0.01), edge = Math.abs(i) === half;
            let c = j === top ? (u < 0.6 ? "#e2ddd0" : "#c4beb0") : j === top - 1 ? (u < 0.3 ? "#d0cabc" : u < 0.75 ? "#aaa496" : "#86807a") : j === 0 ? "#3a3632" : u < 0.25 ? "#a29c90" : u < 0.7 ? "#7e7870" : "#5a5550";
            if (edge && j > 0) c = "#34302c";
            img.px(sx + i + (j > top - 2 ? lean : 0), y, G(c, 0.05));
          }
        }
        img.px(sx - 1 + lean, sy - top + 1, G("#f2eee4", 0.05));
        for (const i of [-rx - 1, -rx - 2, rx + 1, rx + 2]) img.px(sx + i, sy + (Math.abs(i) > rx + 1 ? 1 : 0), G("#e4f2f8", 0.05), Math.abs(i) > rx + 1 ? 0.5 : 0.85);
        for (let i = -rx + 1; i < rx; i++) img.px(sx + i, sy + 1, G("#2a4a68", 0.05), 0.6);
        stones.push([sx, sy - top]);
      }
      for (const bx of [x0 - 3, x0 - 7, x1 + 2, x1 + 6, x1 + 9]) { const hh = 6 + Math.floor(h2(bx, 3, I.seed) * 6); for (let j = 0; j < hh; j++) img.px(bx + (j > hh - 3 ? 1 : 0), rt - 1 - j, G(j === hh - 1 ? "#6a4a2a" : "#7a8a4a", 0.12)); img.rect(bx, rt - hh + 1, 1, 3, G("#5a3a20", 0.12)); }
      return Object.assign(A0, { river: [x0, x1], stones });
    }
    if (kind === "ferry") {
      const x0 = Math.round(I.w * 0.28), x1 = Math.round(I.w * 0.86);
      river(img, I, x0, x1, I.seed + 3);
      const bell = pieceGrid("bellpost", false, 0);
      B(bell, x0 - 18, rt - bell.h + 3, 0.1);
      for (let xx = x0 - 4; xx < x1 + 4; xx++) img.px(xx, rt - 6 + Math.round(Math.sin((xx - x0) / (x1 - x0) * Math.PI) * 3), G(PIECE_PAL.rope, 0.1));
      for (const xx of [x0 - 4, x1 + 3]) for (let y = 0; y < 12; y++) img.px(xx, rt - 7 + y, G("#5a3a22", 0.1));
      return Object.assign(A0, { river: [x0, x1], bell: [x0 - 7, rt - 31], rope: rt - 6, landing: [x0 - 2, x1 + 2] });
    }
    if (kind === "balcony") {
      const g = pieceGrid("balcony", lit, 0), gx = x - 32, gy = rt - g.h + 3;
      B(g, gx, gy, 0.12, lit ? warm : null);
      return Object.assign(A0, { floor: [gx + 32, gy + 36], door: [gx + 15, rt], w: g.w, gy });
    }
    if (kind === "stall") {
      const g = pieceGrid("stall", false, 0), gx = x - 27, gy = rt - g.h + 3;
      B(g, gx, gy, 0.12);
      return Object.assign(A0, { front: g, gx, gy, cut: gy + 32, counter: [x, gy + 34], behind: rt - 3 });
    }
    if (kind === "lamppost") {
      const g = pieceGrid("lamppost", lit, 0), gx = x - 7, gy = rt - g.h + 2;
      B(g, gx, gy, 0.1, lit ? warm : null);
      return Object.assign(A0, { lamp: [gx + 12, gy + 16], base: [gx + 7, rt] });
    }
    if (kind === "tent") {
      const g = pieceGrid("tent", false, 0), gx = x - 52, gy = rt - g.h + 4;
      B(g, gx, gy, 0.25);
      return Object.assign(A0, { flap: [x, rt], top: [x, gy] });
    }
    if (kind === "stage") {
      const g = pieceGrid("stage", lit, 0), gx = x - 48, gy = rt - g.h + 6;
      B(g, gx, gy, 0.15, lit ? warm : null);
      return Object.assign(A0, { floor: [x, gy + 41], left: gx + 18, right: gx + 78 });
    }
    return A0;
  }
  const KIND_ALIAS = { gallows: "crossroads", cross: "crossroads", tavern: "inn", caravanserai: "waystation", bridge_toll: "toll", toll_bridge: "toll", stone: "milestone", chapel: "shrine", tower: "ruin", shelter: "ruin", hut: "waystation" };

  // ---------- the loop: things that move over the still, each a pure function of t ----------
  function loops(I, spec) {
    const out = [], { w, h, hz, weather, biome } = I, s = I.seed;
    const G = I.G;
    if (weather === "rain" || weather === "storm") {
      const n = Math.round(w * h / (weather === "storm" ? 90 : 160));
      out.push((img, t) => {
        for (let i = 0; i < n; i++) {
          const sp = 90 + h2(i, 1, s) * 40, x0 = h2(i, 2, s) * (w + 40), y = ((h2(i, 3, s) * (h + 20) + t * sp) % (h + 20)) - 10, x = x0 - (y + 10) * 0.35 - 20;
          img.px(x, y, "#b4c4d4", 0.55); img.px(x - 0.35, y - 1, "#b4c4d4", 0.4); img.px(x - 0.7, y - 2, "#b4c4d4", 0.25);
          if (y > I.roadTop && y < I.roadBot && h2(i, Math.floor(t * 3), s) > 0.93) img.px(x, I.roadTop + (i % (I.roadBot - I.roadTop)), "#d8e4ee", 0.6);
        }
      });
      if (weather === "storm") out.push((img, t) => {
        const ph = (t % 6.3) / 6.3;
        if (ph > 0.06) return;
        const a = ph < 0.02 || (ph > 0.035 && ph < 0.05) ? 0.4 : 0.15;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.px(x, y, "#e8ecf4", a * (y < hz ? 1 : 0.5));
        const bx = Math.round(w * (0.2 + h2(Math.floor(t / 6.3), 4, s) * 0.6));
        let x = bx;
        for (let y = 0; y < hz - 2; y++) { x += h2(y, Math.floor(t / 6.3), s) > 0.5 ? 1 : -1; img.px(x, y, "#ffffff"); }
      });
    }
    if (weather === "snow" || (biome === "snow" && weather === "storm")) {
      const n = Math.round(w * h / 110);
      out.push((img, t) => {
        for (let i = 0; i < n; i++) {
          const sp = 9 + h2(i, 1, s) * 10, y = ((h2(i, 3, s) * (h + 10) + t * sp) % (h + 10)) - 5, x = (h2(i, 2, s) * w + Math.sin(t * 0.8 + i) * 4 + t * 3) % w;
          img.px(x, y, "#ffffff", h2(i, 5, s) > 0.6 ? 0.95 : 0.6);
          if (h2(i, 6, s) > 0.8) img.px(x + 1, y, "#ffffff", 0.5);
        }
      });
    }
    // drifting fog banks, a smooth veil under the people (under: drawn before the band and the act, so nobody is screened by it)
    if (weather === "fog") out.push(Object.assign((img, t) => {
      for (let y = hz - 6; y < I.roadBot + 8; y++) for (let x = 0; x < w; x++) {
        const n = fbm((x + t * 4) / 34, y / 7, s + 21, 2);
        if (n > 0.55) img.px(x, y, "#dcdfda", Math.min(0.42, (n - 0.55) * 2.4));
      }
    }, { under: true }));
    if (weather === "heat" && !I.night) out.push((img, t) => {
      const y0 = I.roadTop - 2;
      for (let x = 0; x < w; x++) { const dy = Math.round(Math.sin(x / 5 + t * 6) * 0.8); if (dy) { const c = img.get(x, y0 + dy); if (c) img.px(x, y0, c, 0.7); } }
    });
    if (biome === "coast" && !I.night && weather !== "storm") out.push(gulls(I, 3));
    if (I.sea) out.push((img, t) => { for (let i = 0; i < w / 18; i++) { const x = (h2(i, 9, s) * w + t * 3) % w, y = I.sea[0] + 2 + Math.floor(h2(i, 8, s) * (I.sea[1] - I.sea[0] - 3)); if (Math.sin(t * 2 + i) > 0.4) { img.px(x, y, "#e8f4fa", 0.8); img.px(x + 1, y, "#e8f4fa", 0.5); } } });
    if ((biome === "forest" || biome === "plains") && I.night && weather !== "rain" && weather !== "storm") out.push(motes(I, "#e8f070", 10));
    if (biome === "marsh" && (I.night || I.dungeon) && weather !== "storm") out.push(motes(I, "#9af0e0", 5));
    if (biome === "forest" && !I.night && weather === "clear") out.push(leaves(I));
    if ((biome === "plains" || biome === "hills") && !I.night && (weather === "clear" || weather === "heat")) out.push(birds(I));
    if (biome === "volcanic" && I.crater) out.push(smoke(I.crater[0], I.crater[1] + 4, "#5a4a4a", 1.6, s));
    if (I.dungeon) out.push(crows(I));
    for (const ex of I.extras || []) if (ex.fire) {
      const [fx, fy] = ex.fire;
      out.push(smoke(fx + 1, fy - 8, I.night ? "#6a6a7a" : "#d8d8dc", 0.8, s));
      out.push((img, t) => { for (let i = -2; i <= 2; i++) { const hh = 3 + Math.round((Math.sin(t * 11 + i * 2.1) + 1) * 1.6) - Math.abs(i); for (let j = 0; j < hh; j++) img.px(fx + i, fy - j + 1, j === 0 ? "#ff8a2a" : j < 2 ? "#ffc850" : "#fff0a0"); } });
    }
    if (I.place && I.place.chimney) out.push(smoke(I.place.chimney[0], I.place.chimney[1], I.night ? "#6a6a7a" : "#c8c8cc", 1, s));
    if (I.place && I.place.river) out.push(ripples(I, I.place.river));
    if (I.place && I.place.windows && I.place.lit) out.push((img, t) => { for (const [x, y] of I.place.windows) { const f = 0.12 + Math.sin(t * 9 + x) * 0.05; for (let j = -3; j < 4; j++) for (let i = -5; i < 6; i++) img.px(x + i, y + j, "#ffc860", f * (1 - Math.abs(i) / 6)); } });
    if (I.place && I.place.sign) out.push((img, t) => {
      const sg = pieceGrid("sign", false, 0), sw = Math.sin(t * 1.7) * (weather === "storm" || weather === "rain" ? 2 : 1);
      const [sx, sy] = I.place.sign;
      img.line(sx - 4, sy - 1, sx - 4 + Math.round(sw), sy + 1, G("#3a3a40", 0.1)); img.line(sx + 4, sy - 1, sx + 4 + Math.round(sw), sy + 1, G("#3a3a40", 0.1));
      blit(img, sg, sx - 7 + Math.round(sw), sy + 1, { G, depth: 0.15 });
    });
    return out;
  }
  function gulls(I, n) {
    const s = I.seed;
    return (img, t) => {
      for (let i = 0; i < n; i++) {
        const x = ((h2(i, 1, s) * I.w + t * (8 + i * 3)) % (I.w + 20)) - 10, y = 6 + h2(i, 2, s) * (I.hz - 14) + Math.sin(t * 0.7 + i) * 3, f = Math.sin(t * 6 + i * 2) > 0;
        const c = "#f4f6f8", d = "#5a6470";
        img.px(x, y, c); img.px(x - 1, y - (f ? 1 : 0), c); img.px(x + 1, y - (f ? 1 : 0), c); img.px(x - 2, y - (f ? 2 : -1), d); img.px(x + 2, y - (f ? 2 : -1), d);
      }
    };
  }
  function birds(I) {
    const s = I.seed;
    return (img, t) => { for (let i = 0; i < 3; i++) { const x = ((h2(i, 4, s) * I.w + t * 12) % (I.w + 30)) - 15 + i * 6, y = 10 + i * 3 + Math.sin(t + i) * 2, f = Math.sin(t * 8 + i) > 0, c = "#2a2a34"; img.px(x, y, c); img.px(x - 1, y - (f ? 1 : 0), c); img.px(x + 1, y - (f ? 1 : 0), c); } };
  }
  function crows(I) {
    const s = I.seed, cx = I.w * 0.7, cy = I.hz - 22;
    return (img, t) => { for (let i = 0; i < 3; i++) { const a = t * 0.6 + i * 2.1, x = cx + Math.cos(a) * (14 + i * 4), y = cy + Math.sin(a) * 5, f = Math.sin(t * 7 + i) > 0, c = "#141016"; img.px(x, y, c); img.px(x + 1, y, c); img.px(x - 1, y - (f ? 1 : 0), c); img.px(x + 2, y - (f ? 1 : 0), c); } };
  }
  function motes(I, col, n) {
    const s = I.seed;
    return (img, t) => { for (let i = 0; i < n; i++) { const x = h2(i, 1, s) * I.w + Math.sin(t * 0.5 + i) * 8, y = I.hz + 4 + h2(i, 2, s) * (I.roadTop - I.hz) + Math.cos(t * 0.7 + i * 1.3) * 4, b = 0.5 + 0.5 * Math.sin(t * 2.3 + i * 4); if (b > 0.3) { img.px(x, y, col, b); img.px(x + 1, y, col, b * 0.3); img.px(x - 1, y, col, b * 0.3); img.px(x, y - 1, col, b * 0.3); } } };
  }
  function leaves(I) {
    const s = I.seed;
    return (img, t) => { for (let i = 0; i < 6; i++) { const ph = (t * 0.12 + h2(i, 1, s)) % 1, x = h2(i, 2, s) * I.w + Math.sin(ph * 12 + i) * 6, y = I.hz - 10 + ph * (I.roadBot - I.hz + 10); img.px(x, y, i % 2 ? "#c8a040" : "#8ab04a"); } };
  }
  function smoke(x, y, col, k, s) {
    return (img, t) => {
      for (let i = 0; i < 7; i++) {
        const ph = (t * 0.22 * k + i / 7) % 1, px = x + Math.sin(ph * 5 + i) * 2 + ph * 9, py = y - ph * 26, r = 1 + ph * 2.6, a = (1 - ph) * 0.5;
        for (let j = -r; j <= r; j++) for (let q = -r; q <= r; q++) if (q * q + j * j <= r * r) img.px(px + q, py + j, col, a * 0.8);
      }
    };
  }
  function ripples(I, rv) {
    const s = I.seed;
    return (img, t) => {
      for (let i = 0; i < 14; i++) {
        const y = I.roadTop + 1 + Math.floor(h2(i, 1, s) * (I.h - I.roadTop - 2)), x = rv[0] + 3 + ((h2(i, 2, s) * (rv[1] - rv[0] - 6) + t * 6) % (rv[1] - rv[0] - 6)), l = 2 + (i % 3);
        for (let k = 0; k < l; k++) img.px(x + k, y, "#a8d0e8", 0.55);
      }
    };
  }

  // ---------- walking: a standing sprite's legs scissored, the body bobbed ----------
  const walkCache = new Map();
  function walker(g, k) {
    k = ((k % 4) + 4) % 4;
    if (!g || !k) return g;
    let m = walkCache.get(g);
    if (!m) { m = {}; walkCache.set(g, m); }
    if (m[k]) return m[k];
    const out = new A.Grid(g.w, g.h + 1);
    let top = g.h, x0 = g.w, x1 = 0, bottom = 0;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.px[y * g.w + x]) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    const legTop = bottom - Math.max(4, Math.round((bottom - top) * 0.2));
    for (let y = legTop; y <= bottom; y++) for (let x = 0; x < g.w; x++) if (g.px[y * g.w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    const mid = (x0 + x1) / 2, sw = k === 2 ? 0 : k === 1 ? 1 : -1, bob = k === 2 ? 0 : 1;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const c = g.px[y * g.w + x];
      if (!c) continue;
      if (y >= legTop) {
        const leg = x < mid ? -1 : 1, lift = y > legTop + 1 ? Math.round(((y - legTop) / (bottom - legTop)) * sw * leg * 1.6) : 0;
        out.set(x + lift, y + 1, c);
      } else out.set(x, y + 1 - bob, c);
    }
    if (k === 2) for (let y = legTop; y <= bottom; y++) for (let x = 0; x < g.w; x++) if (!g.px[y * g.w + x] && (g.px[y * g.w + x - 1] && g.px[y * g.w + x + 1])) out.set(x, y + 1, g.px[y * g.w + x - 1]);
    m[k] = out;
    return out;
  }
  // a hero or a grid as walking frames
  function gridOf(x) {
    if (!x) return null;
    if (x.px && x.w) return x;
    const S = (root.App && root.App.S) || (root.LD && root.LD.static) || {};
    const cls = (S.classes || {})[x.cls] || { look: { outfit: "leather", head: "none" } };
    try { return x.look ? A.heroGrid(x, 0, (root.App && root.App.heroLook && root.App.heroLook(x)) || cls) : null; } catch (e) { return null; }
  }
  function band(img, I, list, t, o) {
    o = o || {};
    const gs = (list || []).map(gridOf).filter(Boolean).slice(0, 5);
    if (!gs.length) return;
    // lead0: where the leader stands at t = 0 (a fraction of the width); still: the band stands about there instead of walking
    // (lead0 places the front walker; the rest trail behind to the left)
    const speed = o.speed || 9, span = I.w + 40 + gs.length * 18, x0 = o.lead0 !== undefined ? I.w * o.lead0 : I.w * 0.45;
    const tail0 = o.lead0 !== undefined ? x0 - (gs.length - 1) * 17 : x0;
    const lead = o.still ? x0 : ((t * speed + tail0 + 20 + gs.length * 18) % span) - 20 - gs.length * 18;
    gs.forEach((g, i) => {
      if (o.still) {
        // gathered round the spot, each facing it
        const dx = o.traveller ? -i * 15 : [-30, 30, -48, 48, -66][i], fx = Math.round(lead + dx);
        blit(img, g, fx - g.w / 2, I.feet - g.h + 1 + (i % 2), { G: I.Gf, depth: 0, flip: dx > 0 });
        return;
      }
      const x = lead + (gs.length - 1 - i) * 17, k = Math.floor(t * 6 + i * 1.7);
      const fr = walker(g, k);
      blit(img, fr, x - fr.w / 2, I.feet - fr.h + 1 + (i % 2), { G: I.Gf, depth: 0 });
    });
  }

  // ---------- rendering ----------
  function compose(spec, t, w, h, o) {
    const sc = scene(spec, w, h), img = sc.base.copy();
    o = o || {};
    for (const f of sc.loops) if (f.under) f(img, t);
    if (o.under) o.under(img, sc.info, t);
    // a traveller met on this stretch stands by the road ahead of the band, facing them
    if (spec.traveller && root.RoadArt) {
      try { const g = root.RoadArt.figure(spec.traveller, 0), tx = Math.round(w * Math.min(0.9, (spec.band_x || 0.45) + 0.2)); blit(img, g, tx - g.w / 2, sc.info.feet - g.h + 1, { G: sc.info.Gf, flip: true }); } catch (e) { /* an unknown traveller is simply not drawn */ }
    }
    const band0 = o.band || spec.heroes;
    if (band0 && band0.length) band(img, sc.info, band0, t, Object.assign({ lead0: spec.band_x, speed: spec.band_speed, still: spec.band_still || !!spec.traveller, traveller: !!spec.traveller }, o));
    if (o.over) o.over(img, sc.info, t);
    for (const f of sc.loops) if (!f.under) f(img, t);
    return { img, info: sc.info };
  }
  function frame(spec, t, w, h, o) {
    const { img } = compose(spec, t || 0, w || W0, h || H0, o);
    const out = new Uint8ClampedArray(img.w * img.h * 4);
    for (let i = 0; i < img.w * img.h; i++) { out[i * 4] = img.d[i * 4]; out[i * 4 + 1] = img.d[i * 4 + 1]; out[i * 4 + 2] = img.d[i * 4 + 2]; out[i * 4 + 3] = 255; }
    return { w: img.w, h: img.h, data: out };
  }
  // the daybook strip is 38px tall behind text: each biome gets its own cast (warm wheat on the plains, cold blue on the snow, ember on
  // the burnt road) and the frame is pushed harder in contrast and colour than a replay, so a snow leg and a marsh leg differ at a glance
  const STRIP_TINT = { plains: "#e8c060", forest: "#3a8a3a", marsh: "#7a9a3a", hills: "#d09a48", snow: "#9ac0f0", coast: "#2a8ac8", volcanic: "#e0582a", dungeon: "#6a7080" };
  function punch(d, biome, weather) {
    const t = C(STRIP_TINT[biome] || STRIP_TINT.plains), con = weather === "fog" || weather === "snow" ? 1.42 : 1.26, sat = 1.22, a = 0.2, m = 112;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      const l = r * 0.3 + g * 0.55 + b * 0.15;
      r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
      r = (r - m) * con + m; g = (g - m) * con + m; b = (b - m) * con + m;
      d[i] = r + (r * t[0] / 170 - r) * a; d[i + 1] = g + (g * t[1] / 170 - g) * a; d[i + 2] = b + (b * t[2] / 170 - b) * a;
    }
    return d;
  }
  const calm = () => (root.Settings && root.Settings.calm ? root.Settings.calm() : !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches));
  function strip(spec, opts) {
    opts = opts || {};
    const doc = root.document, w = opts.w || 320, h = opts.h || 80, wrap = doc.createElement("div"), cv = doc.createElement("canvas");
    wrap.className = "road-strip" + (opts.className ? " " + opts.className : "");
    wrap.dataset.biome = spec.biome === "dungeon" ? "dungeon" : BIOME[spec.biome] ? spec.biome : "plains";
    cv.width = w; cv.height = h;
    cv.setAttribute("aria-hidden", "true");
    wrap.appendChild(cv);
    const sp = Object.assign({}, spec, { heroes: spec.heroes || opts.heroes || [] });
    const g = cv.getContext("2d"), im = g.createImageData(w, h);
    let t = opts.t0 || (sp.band_x !== undefined ? 0 : 3.2 + (hash([sp.biome, sp.hour, sp.tod, sp.weather].join("|")) % 97) / 7), raf = 0, last = 0, onscreen = false, lastDraw = -1;
    const paint = () => { const f = frame(sp, t, w, h); im.data.set(opts.punch === false ? f.data : punch(f.data, wrap.dataset.biome, sp.weather)); g.putImageData(im, 0, 0); };
    function tick(ms) {
      raf = 0;
      if (!wrap.isConnected || !onscreen || doc.hidden || calm()) { last = 0; return; }
      const dt = last ? Math.min(0.2, (ms - last) / 1000) : 0;
      last = ms; t += dt;
      // a slow loop: ten frames a second is plenty for rain and a walk, and keeps phones cool
      if (t - lastDraw >= 0.1) { paint(); lastDraw = t; }
      raf = root.requestAnimationFrame(tick);
    }
    const wake = () => { if (!raf && onscreen && !calm()) raf = root.requestAnimationFrame(tick); };
    if ("IntersectionObserver" in root) new root.IntersectionObserver((es) => { onscreen = es[es.length - 1].isIntersecting; wake(); }).observe(wrap);
    else onscreen = true;
    doc.addEventListener("visibilitychange", wake);
    if (root.Settings && root.Settings.watch) root.Settings.watch(() => { if (wrap.isConnected) { paint(); wake(); } });
    paint();
    return wrap;
  }

  // a daybook stretch's strip: what stands by the road, where the band is and whether it walks, by the stretch and the biome, so the
  // stretches of one day differ (leaving the gate, a milestone, a fingerpost, the halt's fire, a cart on the verge, roofs ahead)
  const VERGE = { forest: "log", coast: "boat", marsh: "boat", volcanic: "log", snow: "log" };
  function dress(b) {
    // band_x is where the front walker starts: short of the stretch's thing, so it stays in view while they amble up to it
    const st = b.stretch, out = { stretch: st, seed: [b.biome, st, b.seed || ""].join(":"), band_speed: 4 };
    const D = {
      set_out: { extra: [["town", 0.1, "near"]], band_x: 0.66 },
      morning: { extra: [["milestone", 0.7], ["crow", 0.7]], band_x: 0.5 },
      pull: { extra: [["fingerpost", 0.76]], band_x: 0.52 },
      halt: { extra: [["camp", 0.5]], band_x: 0.5, band_still: true },
      afternoon: { extra: [[VERGE[b.biome] || "haycart", 0.2]], band_x: 0.86 },
      end: { extra: [["town", 0.84, "far"]], band_x: 0.6 },
      town: { extra: [["town", 0.5, "street"]], band_x: 0.5, band_still: true },
    }[st] || { band_x: 0.5 };
    Object.assign(out, D, { extra: (D.extra || []).slice() });
    // what the stretch's own line names takes the place of the stock dressing: the stuck cart, the signpost, the milestone
    const L = String(b.line || ""), named = /\b(cart|wagon)\b/i.test(L) ? "haycart" : /\b(signpost|fingerpost)\b/i.test(L) ? "fingerpost" : /\b(milestone|mile post|mile-post)\b/i.test(L) ? "milestone" : null;
    if (named && !b.place_kind && st !== "halt" && st !== "town") { out.extra = out.extra.filter((e) => e[0] === "town"); out.extra.push([named, st === "afternoon" ? 0.2 : 0.74]); }
    if (b.place_kind) {
      // a place takes the stretch's dressing over, except the town at either end of the day
      out.extra = out.extra.filter((e) => e[0] === "town");
      out.place_kind = b.place_kind; out.place_x = st === "set_out" ? 0.64 : 0.55; out.band_x = st === "set_out" ? 0.38 : 0.3; out.band_still = false;
      const pn = String(b.place || "") + " " + String(b.place_name || "");
      if (b.place_kind === "milestone") out.place_variant = /cairn/i.test(pn) ? "cairn" : /lean/i.test(pn) ? "lean" : undefined;
      if (b.place_kind === "crossroads") out.place_variant = /gallows/i.test(pn) ? "gallows" : /stone/i.test(pn) ? "stones" : undefined;
    }
    if (b.traveller) { out.traveller = b.traveller; out.band_x = 0.4; }
    return out;
  }

  root.RoadScenes = {
    W: W0, H: H0, scene, frame, compose, strip, walker, piece, hourOf, isNight, dress, BIOMES: Object.keys(BIOME).concat(["dungeon"]), THEMES: Object.keys(THEME_BIOME),
    kit: { Buf, blit, C, mix, rng, hash, h2, fbm, clamp, lerp, bay, smooth, hourOf, pieceGrid, river, gridOf, band, smoke, painted, disc },
  };
})(typeof window !== "undefined" ? window : globalThis);
