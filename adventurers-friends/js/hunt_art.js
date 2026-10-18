/* Hunting art: each wild's own ground on the road backdrop (Greenwood oaks and ferns, Bleakmarsh reeds and pools, Redcrag red scree, Whitepeak drifts and pines, the Salt Cliffs' turf and thrift, the King's Road hedgerows), the game in the shaded pixel style (each standing, walking, grazing, alert, bolting and down) and the hunt's props. */
/*
  HuntArt.set(spec, w, h)      -> { base: Buf, info, loops } cached; spec = { biome, hour, weather, seed }: the road backdrop with the road
                                  turned to the wild's own ground, its dressing behind the people and info.feet the ground line.
                                  info.front(img) paints what stands in front of the people (fern fronds, reed stems, a drift's lip).
  HuntArt.beast(id, pose, f)   -> a Grid facing right at people scale; ids in HuntArt.GAME (deer stag doe boar hare snowhare goat
                                  pheasant ptarmigan duck crab fox), pose: stand walk graze alert bolt down (birds: fly for bolt),
                                  f: 0/1 the step or the wingbeat. HuntArt.feet(id) -> the row its hooves stand on (its height - 1).
  HuntArt.prop(id, o)          -> a Grid: blind (o.biome), pelt, frame, basket, herbs, mushrooms, berries, nest, leanto, log, spit, hive.
  HuntArt.prints(img, I, x0, x1, kind, G) -> a trail of hoof, paw, bird or boot marks pressed into the ground between x0 and x1.
  Needs road_scenes.js (RoadScenes.scene and kit) and paint.js; scene_kits.js for the fox.
*/
(function (root) {
  "use strict";
  const RS = root.RoadScenes, K = RS.kit, { h2, fbm, mix, clamp } = K;
  const memo = new Map();
  const P = (key, w, h, pal, fn) => { if (!memo.has(key)) memo.set(key, K.painted(w, h, pal, fn)); return memo.get(key); };

  // ---------- the ground of each wild ----------
  // g/g2/g3: the ground's three tones; tuft: grass blades; dark: shadow under things
  const WILD = {
    forest: { g: "#4e6e30", g2: "#3e5c28", g3: "#6a6232", tuft: "#6a9a42", dark: "#24361c", litter: ["#8a6a3a", "#a87a3e", "#6a4e2a"] },
    marsh: { g: "#626c3e", g2: "#4e5832", g3: "#5a4a32", tuft: "#8a9450", dark: "#2a3024", water: "#3e5656", water2: "#5a7a78" },
    hills: { g: "#9a6640", g2: "#80502e", g3: "#b07a50", tuft: "#8a8a42", dark: "#4a2a1a", rock: "#a8603e" },
    snow: { g: "#e6ecf4", g2: "#c8d2e4", g3: "#f6f8fc", tuft: "#b4c0d0", dark: "#8a96ac" },
    coast: { g: "#76a248", g2: "#5e8a3a", g3: "#9ab85c", tuft: "#a8c060", dark: "#34502a", thrift: "#e88aaa" },
    plains: { g: "#6a9842", g2: "#5a883a", g3: "#86ae4e", tuft: "#9ac05a", dark: "#2e4a24", hedge: "#3a6430" },
  };
  const sets = new Map();
  function set(spec, w, h) {
    const biome = WILD[spec.biome] ? spec.biome : "plains";
    const key = [biome, Math.round(RS.hourOf(spec) * 4), spec.weather || "clear", spec.seed || "", w, h].join("|");
    if (sets.has(key)) return sets.get(key);
    const sc = RS.scene({ biome, hour: RS.hourOf(spec), weather: spec.weather, seed: "wild:" + biome + ":" + (spec.seed || "") }, w, h);
    const img = sc.base.copy(), I = Object.assign({}, sc.info), G = I.G, W = WILD[biome], s = I.seed;
    const snowy = biome === "snow" || I.weather === "snow";
    const put = (x, y, c, d, a) => { if (c) img.px(x, y, G(c, d || 0), a); };
    const top = I.roadTop - 3;
    I.feet = I.roadTop + Math.round((I.roadBot - I.roadTop) * 0.62);
    // the wild's own middle distance over the backdrop's: Redcrag's red crags, the Greenwood's oak trunks, reeds, hedges
    MIDDLE[biome](put, I, W, s, img);
    // the ground from the old road down: no ruts, the wild's own floor, lighter toward the people's ground line
    for (let x = 0; x < w; x++) {
      const t0 = top + Math.round(fbm(x / 17, 2, s + 4, 2) * 3 - 1);
      for (let y = t0; y < h; y++) {
        const n = fbm(x / 9, y / 3.2, s + 11, 3), k = (y - t0) / Math.max(1, h - t0);
        let c = n > 0.6 ? W.g3 : n < 0.38 ? W.g2 : W.g;
        if (y === t0) c = mix(W.g2, W.dark, 0.3);
        if (snowy) c = n > 0.62 ? "#f8faff" : n < 0.36 ? "#cdd6e6" : "#e4eaf4";
        put(x, y, c, 0.05 * (1 - k));
      }
    }
    GROUND[biome](put, I, W, s, img, snowy);
    I.front = (out) => FRONT[biome](out, I, W, s, snowy);
    I.wild = W;
    const res = { base: img, info: I, loops: sc.loops };
    if (sets.size > 30) sets.delete(sets.keys().next().value);
    sets.set(key, res);
    return res;
  }
  // a reed: a stem bent by the wind and its brown head
  function reed(put, x, base, hh, lean, d, head) {
    for (let j = 0; j < hh; j++) put(Math.round(x + lean * (j / hh) ** 2), base - j, j > hh - 4 && head ? "#5a3a22" : j % 5 === 0 ? "#6a7038" : "#8a9048", d);
    if (head) put(Math.round(x + lean) + 1, base - hh + 2, "#4a2e1a", d);
  }
  // flat-topped red sandstone: buttes with their strata, the sunward face lit
  function butte(put, x, base, bw, bh, d, s) {
    for (let j = 0; j < bh; j++) {
      const half = bw / 2 + (j < 4 ? (4 - j) * 1.5 : 0) + (h2(x, j >> 1, s) - 0.5) * 2.4;
      for (let i = -Math.round(half); i <= Math.round(half); i++) {
        const band = ((j + (h2(x + i >> 3, 3, s) > 0.5 ? 1 : 0)) >> 1) % 3;
        put(x + i, base - j, j === bh - 1 ? "#d8946a" : i < -half * 0.5 ? ["#d08458", "#c87a4e", "#b86a44"][band] : i > half * 0.45 ? "#7a3424" : ["#b05a3a", "#a04e32", "#c0683e"][band], d);
      }
    }
  }
  function oak(put, I, x, base, trunkW, d, s) {
    // a broad trunk with root flare and bark furrows, lit from the left; its crown is out of frame
    for (let y = 0; y < base; y++) {
      const flare = y > base - 8 ? Math.round((y - (base - 8)) * 0.7) : 0, half = trunkW / 2 + flare;
      for (let i = -Math.ceil(half); i <= Math.ceil(half); i++) {
        const k = (i + half) / (2 * half), furrow = h2(x + i, y >> 2, s) > 0.82 || (i + Math.round(y / 7)) % 4 === 0;
        put(x + i, y, k < 0.22 ? "#7a6a4a" : furrow ? "#2e2418" : k > 0.7 ? "#3a2c1e" : "#544230", d);
      }
    }
    // the low canopy overhead: leaf masses hanging into the top of the frame from the trunk's crown
    for (let k = 0; k < 9; k++) {
      const cx = x + (h2(k, x, s) - 0.5) * 70, cy = h2(x, k, s) * I.hz * 0.35, r = 6 + h2(k, k, s) * 6;
      for (let yy = -r; yy <= r; yy++) for (let xx = -r * 1.4; xx <= r * 1.4; xx++) {
        const dd = (xx / 1.4) ** 2 + yy * yy;
        if (dd > r * r || cy + yy < 0) continue;
        const l = -xx / (r * 1.4) * 0.5 - yy / r * 0.6 + K.bay(R0(cx + xx), R0(cy + yy)) * 0.3;
        put(cx + xx, cy + yy, l > 0.5 ? "#4e8040" : l > 0 ? "#2e5a2e" : "#1e3a22", d);
      }
    }
  }
  const R0 = Math.round;
  function crag(put, x, base, cw, ch, d, s, cols) {
    for (let j = 0; j < ch; j++) {
      const half = cw * (1 - (j / ch) ** 1.6) * (0.8 + h2(x, j >> 1, s) * 0.3);
      for (let i = -Math.round(half); i <= Math.round(half); i++) put(x + i, base - j, i < -half * 0.3 ? cols[0] : i > half * 0.4 ? cols[2] : (j + (i >> 1)) % 6 === 0 ? cols[2] : cols[1], d);
    }
  }
  const MIDDLE = {
    forest: (put, I, W, s) => {
      // the near wood: ferny floor in front of the treeline and two great oak trunks, one at each side
      for (let x = 0; x < I.w; x++) { const hh = Math.round(fbm(x / 6, 3, s, 2) * 7); for (let k = 0; k < hh; k++) put(x, I.roadTop - 2 - k, k === hh - 1 ? "#5e9a44" : (x + k) % 3 ? "#3e6e30" : "#2e5426", 0.18); }
      oak(put, I, Math.round(I.w * 0.05), I.roadTop + 1, 10, 0.06, s);
      oak(put, I, Math.round(I.w * 0.94), I.roadTop, 8, 0.1, s + 3);
    },
    marsh: (put, I, W, s) => {
      // open water behind a reed bed, its surface holding the sky
      const y0 = I.roadTop - 9;
      for (let y = y0; y < I.roadTop - 1; y++) for (let x = 0; x < I.w; x++) { const n = fbm(x / 30, y / 3, s + 9, 2); if (n > 0.45) put(x, y, y === y0 || (x + y * 3) % 11 === 0 ? mix(I.sky[2], "#ffffff", 0.2) : mix(I.sky[1], W.water, 0.55), 0.3); }
      for (let x = 2; x < I.w; x += 2 + Math.floor(h2(x, 1, s) * 3)) if (h2(x >> 3, 2, s) > 0.35) reed(put, x, I.roadTop - 1, 7 + Math.floor(h2(x, 3, s) * 7), (h2(x, 4, s) - 0.3) * 3, 0.2, h2(x, 5, s) > 0.6);
    },
    hills: (put, I, W, s, img) => {
      // the red scree of Redcrag: the backdrop's ochre slopes reddened, then sandstone crags and boulders
      for (let y = I.hz - 4; y < I.roadTop; y++) for (let x = 0; x < I.w; x++) { const c = img.get(x, y); if (c && !(c[2] > c[0] + 10)) img.px(x, y, mix(c, "#b0563a", 0.32 * clamp((y - I.hz + 6) / 14, 0, 1))); }
      // a range of red buttes in front of the far peaks, and two near stacks
      for (let x = -10, k = 0; x < I.w + 20; k++) { const bw = 16 + h2(k, 1, s) * 26, bh = 8 + h2(k, 2, s) * 12; butte(put, Math.round(x + bw / 2), I.hz + 5, bw, bh, 0.55, s + k); x += bw * (0.8 + h2(k, 3, s) * 0.8); }
      butte(put, Math.round(I.w * 0.14), I.roadTop - 2, 12, 20, 0.25, s);
      butte(put, Math.round(I.w * 0.87), I.roadTop - 2, 16, 26, 0.2, s + 1);
      for (let x = 0; x < I.w; x++) if (fbm(x / 8, 6, s, 2) > 0.55) put(x, I.roadTop - 2 - (h2(x, 6, s) > 0.6 ? 1 : 0), h2(x, 7, s) > 0.5 ? "#b8805a" : "#8a4a30", 0.15);
    },
    snow: (put, I, W, s) => {
      for (let x = Math.round(I.w * 0.04); x < I.w; x += Math.round(I.w * 0.85)) {
        const base = I.roadTop + 2, hh = 30;
        put(x, base, "#3a2a1e", 0.1); put(x, base - 1, "#3a2a1e", 0.1);
        for (let j = 0; j < hh; j++) { const half = Math.floor((hh - j) * 0.36 * (1 - ((j % 5) === 4 ? 0.3 : 0))); for (let i = -half; i <= half; i++) put(x + i, base - 2 - j, (j % 5 === 0 || i === -half) && i < 2 ? "#eef2f8" : i > 0 ? "#1e3a36" : "#2a4c44", 0.1); }
      }
      crag(put, Math.round(I.w * 0.7), I.roadTop - 1, 7, 9, 0.2, s, ["#8a94a8", "#5a6478", "#3a4254"]);
      for (let i = -6; i <= 6; i++) put(Math.round(I.w * 0.7) + i, I.roadTop - 9 + Math.abs(i) * 0.6, "#f4f8ff", 0.2);
    },
    coast: (put, I, W, s) => {
      // the cliff top: turf and sea pinks to the brink, the sea below beyond it
      for (let x = 0; x < I.w; x++) if (h2(x >> 1, 9, s) > 0.55) put(x, I.roadTop - 3, h2(x, 8, s) > 0.5 ? W.thrift : "#a8c060", 0.1);
    },
    plains: (put, I, W, s) => {
      // a hawthorn hedgerow along the back of the field: a dense wall of leaf with blossom (or haws in autumn light) and a gap
      const y1 = I.roadTop - 1, gap = Math.round(I.w * 0.58);
      for (let x = 0; x < I.w; x++) {
        if (Math.abs(x - gap) < 5) continue;
        const hh = 9 + Math.round(fbm(x / 7, 1, s + 2, 2) * 6);
        for (let k = 0; k < hh; k++) {
          const n = fbm(x / 3, k / 2, s + 5, 2), y = y1 - k;
          put(x, y, k === hh - 1 && n > 0.45 ? "#5a8a3e" : n > 0.6 ? "#4a7a36" : n < 0.35 ? "#22401e" : W.hedge, 0.2);
          if (h2(x, y, s) > 0.94 && k > 2) put(x, y, I.hr > 15 ? "#b8382a" : "#f4f0e2", 0.2);
        }
      }
      for (const px of [gap - 6, gap + 6]) for (let k = 0; k < 9; k++) put(px, y1 - k, "#6a4e30", 0.15);
      for (let i = -5; i <= 5; i++) { put(gap + i, y1 - 6, "#8a6a42", 0.15); put(gap + i, y1 - 3, "#8a6a42", 0.15); }
    },
  };
  const GROUND = {
    forest: (put, I, W, s, img) => {
      for (let i = 0; i < I.w / 4; i++) { const x = Math.floor(h2(i, 1, s) * I.w), y = I.roadTop + Math.floor(h2(i, 2, s) * (I.h - I.roadTop)); put(x, y, W.litter[i % 3], 0); if (i % 2) put(x + 1, y, W.litter[(i + 1) % 3], 0); }
      // dappled light through the canopy
      if (!I.night) for (let y = I.roadTop; y < I.h; y++) for (let x = 0; x < I.w; x++) if (fbm(x / 7, y / 3, s + 31, 2) > 0.66) img.px(x, y, "#f0e8a0", 0.16);
      root4(put, Math.round(I.w * 0.06), I.roadTop + 1);
    },
    marsh: (put, I, W, s) => {
      // pools of black water in the peat, and tussocks
      for (let i = 0; i < 3; i++) {
        const cx = Math.floor(I.w * (0.15 + i * 0.33 + h2(i, 3, s) * 0.1)), cy = I.h - 4 - Math.floor(h2(i, 4, s) * 4), rx = 10 + Math.floor(h2(i, 5, s) * 10);
        for (let y = -3; y <= 3; y++) for (let x = -rx; x <= rx; x++) if ((x / rx) ** 2 + (y / 3) ** 2 < 1) put(cx + x, cy + y, y === -3 || (x + y) % 7 === 0 ? W.water2 : W.water, 0);
      }
      for (let i = 0; i < I.w / 9; i++) { const x = Math.floor(h2(i, 6, s) * I.w), y = I.feet + 2 + Math.floor(h2(i, 7, s) * 8); for (let k = 0; k < 4; k++) put(x + k - 1, y - (k === 1 || k === 2 ? 1 : 0), W.tuft, 0); }
    },
    hills: (put, I, W, s) => {
      for (let i = 0; i < I.w / 3; i++) { const x = Math.floor(h2(i, 1, s) * I.w), y = I.roadTop + Math.floor(h2(i, 2, s) * (I.h - I.roadTop)); put(x, y, h2(i, 3, s) > 0.5 ? "#c8906a" : "#6a3a24", 0); }
      for (const [fx, r] of [[0.03, 5], [0.95, 4], [0.24, 2]]) boulder(put, Math.round(I.w * fx), I.feet + 3, r);
      for (let x = 0; x < I.w; x += 23) if (h2(x, 9, s) > 0.4) gorse(put, x + Math.floor(h2(x, 8, s) * 10), I.roadTop - 1);
    },
    snow: (put, I, W, s) => {
      for (let i = 0; i < I.w / 14; i++) { const x = Math.floor(h2(i, 1, s) * I.w), y = I.roadTop + 2 + Math.floor(h2(i, 2, s) * (I.h - I.roadTop - 3)); for (let k = -3; k <= 3; k++) put(x + k, y, "#c4cede", 0); }
      for (let x = 0; x < I.w; x++) { const hh = Math.round(fbm(x / 12, 4, s, 2) * 4); for (let k = 0; k < hh; k++) put(x, I.roadTop - 1 - k, k === hh - 1 ? "#ffffff" : "#e8eef8", 0.1); }
    },
    coast: (put, I, W, s) => {
      for (let i = 0; i < I.w / 6; i++) { const x = Math.floor(h2(i, 1, s) * I.w), y = I.roadTop + 1 + Math.floor(h2(i, 2, s) * (I.h - I.roadTop - 2)); put(x, y, W.thrift, 0); put(x, y + 1, "#4a7a2e", 0); }
      for (const [fx, r] of [[0.04, 4], [0.9, 5]]) boulder(put, Math.round(I.w * fx), I.feet + 4, r, ["#c4beb2", "#9a948a", "#6a665e"]);
    },
    plains: (put, I, W, s) => {
      // long grass with seed heads, and a few field poppies
      for (let x = 0; x < I.w; x++) if (h2(x, 3, s) > 0.4) { const y = I.roadTop + 2 + Math.floor(h2(x, 4, s) * (I.h - I.roadTop - 3)), hh = 2 + Math.floor(h2(x, 5, s) * 3); for (let k = 0; k < hh; k++) put(x, y - k, k === hh - 1 && h2(x, 6, s) > 0.6 ? "#d8c878" : W.tuft, 0); }
      for (let i = 0; i < I.w / 30; i++) put(Math.floor(h2(i, 9, s) * I.w), I.roadTop + 4 + Math.floor(h2(i, 8, s) * 10), "#d83a2a", 0);
    },
  };
  function root4(put, x, base) { for (const [dx, len] of [[-5, 6], [4, 7], [-8, 3]]) for (let k = 0; k < len; k++) put(x + dx + Math.sign(dx) * k, base + Math.floor(k / 3), k < 2 ? "#544230" : "#3a2c1e", 0); }
  function boulder(put, x, base, r, cols) {
    cols = cols || ["#c8805a", "#a0583a", "#6a3424"];
    for (let y = -r; y <= 0; y++) for (let i = -r - 2; i <= r + 2; i++) if ((i / (r + 2)) ** 2 + (y / r) ** 2 <= 1) put(x + i, base + y, y === -r || i < -r * 0.4 ? cols[0] : i > r * 0.5 || y > -1 ? cols[2] : cols[1], 0);
  }
  function gorse(put, x, base) { for (let k = 0; k < 9; k++) { const dx = (k % 3) - 1, dy = Math.floor(k / 3); put(x + dx * 2, base - dy - 1, "#4a5a26", 0.15); if (k % 2) put(x + dx * 2 + 1, base - dy - 2, "#e8c838", 0.15); } }
  // what stands nearest the eye, painted over the people's feet at the very edges of the frame
  const FRONT = {
    forest: (img, I) => fronds(img, I, [[0.02, 1], [0.97, -1]], "#3e7a32", "#5e9a44"),
    marsh: (img, I) => { for (const fx of [0.01, 0.04, 0.95, 0.985]) for (let k = 0; k < 3; k++) reedFront(img, I, Math.round(I.w * fx) + k * 2, 14 + k * 3); },
    hills: () => {},
    snow: (img, I) => { for (let x = 0; x < I.w; x++) { const hh = Math.max(0, Math.round(5 - Math.min(x, I.w - x) / 4)); for (let k = 0; k < hh; k++) img.px(x, I.h - 1 - k, k === hh - 1 ? I.G("#ffffff", 0) : I.G("#dfe6f2", 0)); } },
    coast: (img, I) => fronds(img, I, [[0.015, 1], [0.985, -1]], "#8aa84a", "#b4c86a"),
    plains: (img, I) => fronds(img, I, [[0.02, 1], [0.975, -1]], "#5e8a3a", "#9ac05a"),
  };
  function fronds(img, I, at, c0, c1) {
    for (const [fx, dir] of at) {
      const x0 = Math.round(I.w * fx);
      for (let f = 0; f < 4; f++) {
        const len = 9 + f * 3, ang = -1.1 + f * 0.35;
        for (let k = 0; k < len; k++) {
          const x = x0 + dir * Math.round(Math.cos(ang) * k * 0.6 + (k * k) / 40), y = I.h - 1 - Math.round(-Math.sin(ang) * k * 0.9 - (k * k) / 30);
          img.px(x, y, I.G(k % 2 ? c0 : c1, 0)); if (k > 2 && k % 2 === 0) img.px(x + dir, y + 1, I.G(c0, 0));
        }
      }
    }
  }
  function reedFront(img, I, x, hh) {
    for (let j = 0; j < hh; j++) img.px(x + Math.round((j / hh) ** 2 * 2), I.h - 1 - j, I.G(j > hh - 4 ? "#5a3a22" : "#7a8040", 0));
  }

  // ---------- the game: shaded sprites facing right; frame 1 is the other step ----------
  // a four-legged body from one shape: torso, neck to head, legs per pose (stand walk graze alert bolt down) and its own extras
  function quad(o, pose, f) {
    const pal = o.pal;
    return P(o.id + ":" + pose + f, o.w, o.h, pal, (p) => {
      const F = o.h - 1, down = pose === "down", bolt = pose === "bolt", up = bolt ? 3 : 0;
      const [bx, by, brx, bry] = o.body, legTop = by + bry * 0.4 - up, L = F - legTop;
      const legs = o.legs;
      // far legs first, darker
      p.layer = 1;
      if (down) {
        for (const [x0, k] of [[legs[0], -1], [legs[2], 1]]) p.line(x0, F - 2, x0 + k * o.legLen * 0.7, F - 1, "coatd", -0.3, 0.6);
      } else legs.forEach((x, i) => {
        if (i % 2) return;
        const fr = i >= 2, sw = pose === "walk" ? (f ? 1 : -1) * (fr ? 1 : -1) : 0;
        if (bolt) p.line(x, legTop, x + (fr ? 6 : -6), legTop + L * 0.7, "coatd", -0.3, o.legR);
        else p.line(x, legTop, x + sw, F - (pose === "walk" && f === (fr ? 1 : 0) ? 1 : 0), "coatd", -0.35, o.legR);
        if (!bolt && o.hoof) p.rect(x + sw - 1, F, 2, 1, "hoof", -0.2);
      });
      p.layer = 2;
      const cy = down ? F - bry * 0.75 : by - up;
      p.ell(bx, cy, brx * (down ? 1.08 : 1), bry * (down ? 0.82 : 1), "coat", { s: 0.1, fn: o.coatFn });
      if (o.belly && !down) p.ell(bx + 1, cy + bry * 0.55, brx * 0.6, bry * 0.32, "belly", { s: 0.2 });
      if (o.rump) p.ell(bx - brx + 1.6, cy - 0.5, 1.6, bry * 0.5, "belly", { s: 0.3 });
      // neck and head by pose
      const nk = o.neck[pose === "graze" ? "graze" : pose === "alert" ? "alert" : down ? "down" : bolt ? "bolt" : "stand"];
      const ny = (y) => (down ? y : y - up);
      if (nk.n) p.line(nk.n[0], ny(nk.n[1]), nk.n[2], ny(nk.n[3]), "coat", 0.1, o.neckR);
      const [hx, hy] = [nk.h[0], ny(nk.h[1])];
      o.head(p, hx, hy, pose, f);
      if (o.extra) o.extra(p, { hx, hy, bx, by: cy, brx, bry, F, pose, f, down, bolt });
      // near legs, over the body
      p.layer = 3;
      if (down) {
        for (const [x0, k] of [[legs[1], -1], [legs[3], 1]]) p.line(x0, F - 1, x0 + k * o.legLen * 0.8, F, "coat", -0.1, 0.7);
      } else legs.forEach((x, i) => {
        if (!(i % 2)) return;
        const fr = i >= 2, sw = pose === "walk" ? (f ? -1 : 1) * (fr ? 1 : -1) : 0;
        if (bolt) p.line(x, legTop, x + (fr ? 7 : -7), legTop + L * (fr ? 0.5 : 0.8), "coat", -0.1, o.legR);
        else p.line(x, legTop, x + sw, F - (pose === "walk" && f !== (fr ? 1 : 0) ? 1 : 0), "coat", -0.15, o.legR);
        if (!bolt && o.hoof) p.rect(x + sw - 1, F, 2, 1, "hoof", -0.1);
      });
    });
  }
  const eye = (p, x, y, shut) => (shut ? p.rect(x - 1, y, 2, 1, "#1a1210", 0) : p.px(x, y, "#120c0a"));
  // the deer, drawn on its own frame (u is height above the hooves, x runs rump to nose): slim legs with a hock and a knee, a deep
  // chest, a neck that carries the head up, down to the grass or forward in the leap. A stag carries antlers; the royal stag is bigger
  // and darker with a mane; the white stag is bigger still, pale as frost, with antlers that branch like a tree in winter.
  const DEER_KIND = {
    doe: { sc: 0.86, ant: 0, pal: { coat: "#ae7442", coatd: "#6e4626", belly: "#ead8b8", rump: "#f4ecdc", hoof: "#2a2018", nose: "#2a1e18", ear: "#c48a5a", earin: "#7a4a30", mane: "#8a5a32", antler: "#e0cfa4" } },
    stag: { sc: 0.94, ant: 12, pal: { coat: "#9c5c30", coatd: "#5e3218", belly: "#e2cca8", rump: "#f0e4cc", hoof: "#2a2018", nose: "#2a1e18", ear: "#b47a4a", earin: "#6a3a24", mane: "#6a4024", antler: "#e6d6ae" } },
    royal: { sc: 1.06, ant: 17, pal: { coat: "#8a5230", coatd: "#4e2c18", belly: "#d8c09c", rump: "#eadcc2", hoof: "#241a14", nose: "#241a14", ear: "#a46c42", earin: "#5a321e", mane: "#4e3220", antler: "#ecdcb4" } },
    whitestag: { sc: 1.12, ant: 24, pal: { coat: "#e2e6ee", coatd: "#98a4bc", belly: "#f8f8fc", rump: "#ffffff", hoof: "#5a5a6a", nose: "#4a4a5a", ear: "#e4e8f2", earin: "#c8a8b0", mane: "#d8dee8", antler: "#f8f4e6" } },
  };
  function deer(kind, pose, f) {
    const D = DEER_KIND[kind] || DEER_KIND.doe, sc = D.sc;
    const W = Math.ceil(46 * sc) + 2, H = Math.ceil((38 + D.ant) * sc) + 2, F = H - 1, ox = 3;
    return P("deer:" + kind + ":" + pose + f, W, H, D.pal, (p) => {
      const X = (x) => ox + x * sc, Y = (u) => F - u * sc;
      const tube = (pts, r0, r1, m, s) => {
        for (let i = 0; i + 1 < pts.length; i++) {
          const a = pts[i], b = pts[i + 1], n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * sc * 2));
          for (let k = 0; k <= n; k++) {
            const q = (i + k / n) / (pts.length - 1), r = (r0 + (r1 - r0) * q) * sc;
            p.ell(X(a[0] + (b[0] - a[0]) * k / n), Y(a[1] + (b[1] - a[1]) * k / n), Math.max(0.5, r), Math.max(0.5, r), m, { s: typeof s === "function" ? s(q) : s || 0, k: 0.7 });
          }
        }
      };
      const down = pose === "down", bolt = pose === "bolt", walk = pose === "walk", graze = pose === "graze", alert = pose === "alert";
      const lift = bolt ? (f ? 6 : 3) : 0, bob = graze && f % 2 ? -0.6 : 0;
      // legs: a hind leg runs hip, hock (behind), hoof; a fore leg elbow, knee, hoof. ph swings each pair on the walk
      const ph = walk ? (f % 4) / 4 * Math.PI * 2 : 0;
      const hind = (x0, sw) => {
        if (bolt) return f ? [[x0, 15 + lift], [x0 - 7, 10 + lift], [x0 - 13, 7 + lift]] : [[x0, 15 + lift], [x0 - 3, 8 + lift], [x0 + 2, 3 + lift]];
        const s = Math.sin(ph + sw) * 3.4, up = walk ? Math.max(0, Math.cos(ph + sw)) * 1.6 : 0;
        return [[x0, 15], [x0 - 3 + s * 0.4, 6.5 + up], [x0 - 1.5 + s, up]];
      };
      const fore = (x0, sw) => {
        if (bolt) return f ? [[x0, 13 + lift], [x0 + 6, 9 + lift], [x0 + 12, 8 + lift]] : [[x0, 13 + lift], [x0 + 4, 8 + lift], [x0 + 1, 5 + lift]];
        const s = Math.sin(ph + sw) * 3.4, up = walk ? Math.max(0, Math.cos(ph + sw)) * 1.8 : 0;
        return [[x0, 13], [x0 + 0.4 + s * 0.5, 6 + up], [x0 + s, up]];
      };
      const leg = (pts, m, s, top) => {
        tube(pts.slice(0, 2), top, 0.75, m, s);
        tube(pts.slice(1), 0.62, 0.5, m, (q) => s + (q < 0.15 ? 0.35 : 0));
        const e = pts[pts.length - 1];
        if (!bolt || !f) p.rect(Math.round(X(e[0]) - 1), Math.round(Y(e[1])) - 1, 2, 2, "hoof", -0.1);
      };
      if (down) {
        // fallen on its side: the legs out straight toward us, the head down on the ground
        p.layer = 1;
        tube([[23, 4], [31, 2.2], [36, 1.2]], 0.9, 0.5, "coatd", -0.3); tube([[11, 4], [3, 2], [-1, 1]], 1.2, 0.5, "coatd", -0.3);
        p.layer = 2;
        p.ell(X(17), Y(5), 11.5 * sc, 4.6 * sc, "coat", { s: 0.1 });
        p.ell(X(17), Y(2.2), 8 * sc, 1.6 * sc, "belly", { s: 0.2 });
        tube([[26, 6], [31, 3.5]], 2.4, 1.8, "coat", 0.1);
        p.ell(X(34), Y(2.6), 2.6 * sc, 2 * sc, "coat", { s: 0.2 }); p.ell(X(37), Y(1.8), 1.6 * sc, 1.3 * sc, "coat", { s: 0.1 });
        p.px(Math.round(X(38.4)), Math.round(Y(1.6)), "nose"); p.rect(Math.round(X(34)) - 1, Math.round(Y(3)), 2, 1, "#1a1210", 0);
        p.layer = 3;
        tube([[22, 3], [30, 0.8], [35, 0.4]], 1, 0.55, "coat", 0); tube([[12, 3], [5, 0.8], [0, 0.4]], 1.4, 0.55, "coat", 0);
        if (D.ant) antlers(p, X, Y, D, [33, 4.6], -1.25, kind);
        return;
      }
      // far legs, darker
      p.layer = 1;
      leg(hind(12, Math.PI), "coatd", -0.3, 2);
      leg(fore(24, 0), "coatd", -0.3, 1.5);
      // the body: chest, barrel, haunch; the pale belly, the white rump patch and the flicking tail
      p.layer = 2;
      const bu = 17 + lift;
      p.ell(X(17), Y(bu), 10.5 * sc, 5 * sc, "coat", { s: 0.1 });
      p.ell(X(24.5), Y(bu - 0.5), 5 * sc, 5.6 * sc, "coat", { s: 0.15 });
      p.ell(X(9.5), Y(bu + 0.6), 5.4 * sc, 5.2 * sc, "coat", { s: 0.18 });
      p.ell(X(17.5), Y(bu - 4), 7.5 * sc, 1.4 * sc, "belly", { s: 0.15 });
      p.ell(X(5.6), Y(bu + 0.5), 1.7 * sc, 3.4 * sc, "rump", { s: 0.3 });
      const tailUp = alert || bolt || (graze && f % 2);
      p.ell(X(4.6), Y(bu + (tailUp ? 4 : 2.6)), 1.1 * sc, (tailUp ? 1.8 : 1.5) * sc, tailUp ? "rump" : "coat", { s: 0.2 });
      // neck and head: [neck base, head, pitch]; pitch tips the head (nose down positive)
      const NK = { stand: [[25, bu + 3], [31, bu + 12], 0.15], walk: [[25, bu + 3], [32, bu + 10.5], 0.25], alert: [[25, bu + 3], [30, bu + 14.5], -0.05],
        graze: [[25, bu + 1], [34, 4 + bob], 1.35], bolt: [[25, bu + 2], [35, bu + 8], 0.55] }[pose] || [[25, bu + 3], [31, bu + 13], 0.15];
      const n0 = NK[0], hd = NK[1], pitch = NK[2];
      p.layer = 3;
      const mid = [(n0[0] + hd[0]) / 2 + (graze ? 1.5 : -0.5), (n0[1] + hd[1]) / 2 + (graze ? 2 : 0)];
      tube([n0, mid, hd], kind === "doe" ? 3.2 : 3.8, 1.9, "coat", 0.12);
      if (kind !== "doe") for (let k = 0; k < 4; k++) p.ell(X(n0[0] + (mid[0] - n0[0]) * k / 3 + 0.6), Y(n0[1] + (mid[1] - n0[1]) * k / 3 - 2.2), 1.6 * sc, 1.4 * sc, "mane", { s: -0.1 });
      const fx = Math.cos(pitch), fu = -Math.sin(pitch);
      p.ell(X(hd[0]), Y(hd[1]), 2.7 * sc, 2.3 * sc, "coat", { s: 0.25 });
      p.ell(X(hd[0] + fx * 3), Y(hd[1] + fu * 3 - 0.4), 1.8 * sc, 1.4 * sc, "coat", { s: 0.12 });
      p.rect(Math.round(X(hd[0] + fx * 4.6)), Math.round(Y(hd[1] + fu * 4.6 - 0.2)), 1, 1, "nose", 0);
      p.px(Math.round(X(hd[0] + fx * 0.6)), Math.round(Y(hd[1] + fu * 0.6 + 0.6)), "#120c0a");
      // the ears: big and cupped on a doe, pricked when alert, back on the leap, one flicking on its own when f says so
      const ea = alert ? -0.15 : bolt ? -1.2 : graze ? -0.9 + pitch : -0.5, ln = kind === "doe" ? 3.2 : 2.6;
      [["earin", 0], ["ear", 1]].forEach(([m, k]) => {
        const a = ea - k * 0.35 - (alert && f % 2 && k ? 0.4 : 0), bx = hd[0] - 1 - k * 0.6, bu2 = hd[1] + 1.4;
        p.ell(X(bx + Math.sin(a) * ln * 0.6), Y(bu2 + Math.cos(a) * ln * 0.6), 1 * sc, ln * 0.55 * sc, m, { s: 0.2 });
      });
      // near legs, over the body
      p.layer = 4;
      leg(hind(9.5, 0), "coat", 0, 2.4);
      leg(fore(22.5, Math.PI), "coat", 0, 1.7);
      if (D.ant) antlers(p, X, Y, D, [hd[0] - 0.6, hd[1] + 1.8], -0.35 + pitch, kind);
    });
  }
  // antlers from the pedicle at b, leaning by a (0 straight up, negative back): a beam with tines for a stag, a crown of them for the
  // royal, and for the white stag a whole bare tree of branches
  function antlers(p, X, Y, D, b, a, kind) {
    const line = (x0, u0, x1, u1, s) => p.line(X(x0), Y(u0), X(x1), Y(u1), "antler", s);
    const white = kind === "whitestag";
    const grow = (x, u, ang, len, depth, s) => {
      const x1 = x + Math.sin(ang) * len, u1 = u + Math.cos(ang) * len;
      line(x, u, x1, u1, s);
      if (white && len > 4) line(x + 0.4, u, x1 + 0.4, u1, s - 0.2);
      if (depth <= 0 || len < 1.6) return;
      grow(x1, u1, ang + (white ? -0.5 : 0.14), len * (white ? 0.72 : 0.74), depth - 1, s + 0.1);
      grow(x1, u1, ang + (white ? 0.6 : 1.05), len * (white ? 0.66 : 0.46), depth - (white ? 1 : 2), s + 0.2);
    };
    p.layer = 5;
    const L = D.ant, deep = white ? 3 : kind === "royal" ? 3 : 2;
    // the far antler a little behind and shaded, then the near one; each with its brow tine forward over the face
    for (const [dx, s, fan] of [[-1.4, -0.4, -0.3], [0, 0.2, 0.08]]) {
      const x0 = b[0] + dx, u0 = b[1];
      line(x0, u0, x0 + Math.sin(a + 1.4) * 3.2, u0 + Math.cos(a + 1.4) * 3.2, s);
      grow(x0, u0, a + fan - (white ? 0 : 0.3), L * (white ? 0.4 : 0.4), deep, s);
    }
  }
  const GOAT = {
    id: "goat", w: 32, h: 32, legR: 0.6, neckR: 1.6, hoof: true, legLen: 8,
    pal: { coat: "#8e7c62", coatd: "#5a4c3a", belly: "#d8ccb4", hoof: "#2a2420", nose: "#2a2420", horn: "#6e5e48", beard: "#4a3e30" },
    body: [15, 19, 8.5, 4.6], legs: [9, 11, 19, 21],
    neck: { stand: { n: [21, 17, 23, 11], h: [25, 10] }, alert: { n: [21, 17, 22, 9], h: [24, 8] }, graze: { n: [21, 18, 25, 25], h: [26, 27] },
      bolt: { n: [21, 17, 24, 12], h: [26, 11] }, down: { n: [20, 26, 25, 28], h: [27, 28] } },
    head(p, x, y, pose) {
      const g = pose === "graze", d = pose === "down";
      p.ell(x, y, 2.4, 2, "coat", { s: 0.25 });
      p.ell(x + (g ? 0.8 : 2.2), y + (g ? 2.2 : 1), 1.3, 1.2, "coat", { s: 0.1 });
      eye(p, Math.round(x), Math.round(y - 0.4), d);
      if (!d) p.line(x + (g ? 0.5 : 1.5), y + (g ? 3 : 2), x + (g ? 0 : 1), y + (g ? 5 : 4.5), "beard", 0);
      // the wild goat's long horns sweep back in a ridged arc
      for (let k = 0; k <= 9; k++) { const a = -1.9 + k * (d ? 0.12 : 0.2), r = 4 + k * 0.5; p.ell(x - 1 + Math.cos(a) * r * 0.9 - (d ? 2 : 0), y - 1 + Math.sin(a) * r * 0.8 + (d ? 1 : 0) + k * 0.25, 0.8, 0.8, "horn", { s: k % 2 ? 0.4 : -0.1, k: 0.4 }); }
    },
    extra(p, g) { if (!g.down) p.line(g.bx - g.brx, g.by - 1, g.bx - g.brx - 1, g.by - 3, "coatd", 0); },
    belly: true,
  };
  // the Whitepeak ibex: a heavier, greyer wild goat with a dark beard and great ridged horns that sweep back over its shoulders
  const IBEX = Object.assign({}, GOAT, {
    id: "ibex", w: 34, h: 32,
    pal: { coat: "#86704e", coatd: "#4e3e2a", belly: "#d6c8ac", hoof: "#2a2420", nose: "#2a2420", horn: "#6a5a44", hornl: "#a8946e", beard: "#2e261c" },
    body: [16, 19, 9, 4.8], legs: [10, 12, 20, 22],
    neck: { stand: { n: [22, 17, 24, 11], h: [26, 10] }, alert: { n: [22, 17, 23, 9], h: [25, 8] }, graze: { n: [22, 18, 26, 25], h: [27, 27] },
      bolt: { n: [22, 17, 25, 12], h: [27, 11] }, down: { n: [21, 26, 26, 28], h: [28, 28] } },
    head(p, x, y, pose) {
      const g = pose === "graze", d = pose === "down";
      p.ell(x, y, 2.6, 2.1, "coat", { s: 0.25 });
      p.ell(x + (g ? 0.8 : 2.4), y + (g ? 2.3 : 1.1), 1.4, 1.2, "coat", { s: 0.1 });
      eye(p, Math.round(x), Math.round(y - 0.4), d);
      if (!d) { p.line(x + (g ? 0.4 : 1.4), y + (g ? 3 : 2), x + (g ? -0.4 : 0.6), y + (g ? 5.5 : 5), "beard", 0); p.line(x + (g ? 1 : 2), y + (g ? 3 : 2), x + (g ? 0.6 : 1.6), y + (g ? 5 : 4.5), "beard", 0); }
      // the horns: thick at the root, ridged with knots, curving up and back in a scimitar arc
      for (let k = 0; k <= 14; k++) {
        const q = k / 14, a = (d ? -2.6 : -1.75) - q * 1.35, r = 1.5 + q * 9.5;
        p.ell(x - 0.6 + Math.cos(a) * r, y - 1.6 + Math.sin(a) * r * (d ? 0.6 : 0.95), 1.6 - q * 0.95, 1.6 - q * 0.95, k % 3 === 1 ? "hornl" : "horn", { s: 0.15, k: 0.4 });
      }
    },
  });
  const BOAR = {
    id: "boar", w: 32, h: 20, legR: 0.7, neckR: 2.6, hoof: true, legLen: 6,
    pal: { coat: "#4e3e32", coatd: "#2e241c", bristle: "#2a1e16", belly: "#6a584a", hoof: "#1e1610", snout: "#8a6a5a", tusk: "#efe6cc" },
    body: [14, 10, 10, 5.4], legs: [7, 10, 18, 21],
    neck: { stand: { n: null, h: [24, 9] }, alert: { n: null, h: [24, 7.5] }, graze: { n: null, h: [24.5, 13] }, bolt: { n: null, h: [25, 8] }, down: { n: null, h: [25, 16] } },
    coatFn: (x, y, s) => s + (((x * 3 + y * 5) % 7 === 0) ? -0.3 : 0),
    head(p, x, y, pose) {
      const d = pose === "down";
      p.poly([[x - 4, y - 4], [x + 2, y - 2], [x + 6, y + 1.5], [x + 6, y + 3.5], [x - 2, y + 4], [x - 5, y + 2]], "coat", (px, py) => 0.25 - (py - y) * 0.12);
      p.ell(x + 6, y + 2.5, 1.2, 1.5, "snout", { s: 0.1 });
      p.line(x + 3, y + 3, x + 4, y + 0.5, "tusk", 0.4);
      p.ell(x - 3, y - 4.6, 1.2, 1.6, "coatd", { s: 0.1 });
      eye(p, Math.round(x + 0.5), Math.round(y - 0.5), d);
    },
    extra(p, g) {
      // the bristled ridge along the spine, and a thin tail with its tuft
      if (!g.down) for (let x = g.bx - 6; x <= g.bx + 7; x += 2) p.line(x, g.by - g.bry + 0.5, x - 1, g.by - g.bry - 1.5 - (x > g.bx ? 1 : 0), "bristle", 0);
      p.line(g.bx - g.brx, g.by - 1, g.bx - g.brx - 2, g.by + 2, "coatd", 0);
    },
  };
  // the hare: a crouched body, long black-tipped ears, the big hind foot; bolt is the full stretch of a leap
  function hare(white) {
    const id = white ? "snowhare" : "hare", pal = white ? { fur: "#eef2f6", furd: "#a2aec2", tail: "#ffffff", tip: "#2a2a30", eye: "#3a1a10" } : { fur: "#9a7650", furd: "#6a4e32", tail: "#f0e8d8", tip: "#2a2018", eye: "#1a1008" };
    return (pose, f) => P(id + ":" + pose + f, 22, 16, pal, (p) => {
      p.layer = 2;
      if (pose === "down") {
        p.ell(10, 13, 6.5, 2.4, "fur", { s: 0.15 }); p.ell(17, 13.5, 2.4, 1.8, "fur", { s: 0.25 });
        p.line(15, 12, 9, 11, "furd", 0.1); p.px(8, 11, "tip"); p.rect(16, 13, 2, 1, "eye", 0); p.ell(4, 13, 1.3, 1.2, "tail", { s: 0.3 });
        return;
      }
      const leap = pose === "bolt" || (pose === "walk" && f);
      if (leap) {
        p.ell(10, 9, 7, 3, "fur", { s: 0.2 }); p.ell(17.5, 7, 2.6, 2.2, "fur", { s: 0.3 });
        p.line(4, 10, 0, 13, "furd", 0); p.line(14, 11, 19, 14, "furd", 0);
        p.line(16, 5, 11, 3, "fur", 0.2); p.line(17, 5, 13, 2, "furd", 0.1); p.px(11, 3, "tip"); p.px(13, 2, "tip");
        p.px(18, 6, "eye"); p.ell(3, 8, 1.3, 1.3, "tail", { s: 0.3 });
        return;
      }
      const g = pose === "graze", a = pose === "alert";
      p.ell(9, 11, 5.4, 4, "fur", { s: 0.2 }); p.ell(7, 14, 4.2, 1.5, "furd", { s: 0 });
      p.ell(15.5, g ? 12 : 8, 2.5, 2.3, "fur", { s: 0.3 });
      p.rect(13, 14, 3, 1, "furd", 0);
      const ey = g ? 12 : 8, eh = a ? 7 : 6;
      p.line(15, ey - 2, a ? 15 : 12, ey - 2 - eh, "fur", 0.2); p.line(16, ey - 2, a ? 17 : 14, ey - 2 - eh, "furd", 0.1);
      p.px(a ? 15 : 12, ey - 2 - eh, "tip"); p.px(a ? 17 : 14, ey - 2 - eh, "tip");
      p.px(16, ey - 0.5, "eye"); p.ell(3.5, 10, 1.4, 1.4, "tail", { s: 0.3 });
    });
  }
  // game birds: a body, a head, a tail; fly is the flush (wings up, legs tucked, off the ground)
  function bird(id, o) {
    return (pose, f) => P(id + ":" + pose + f, o.w, o.h, o.pal, (p) => {
      const F = o.h - 1, fly = pose === "bolt" || pose === "fly";
      p.layer = 2;
      if (pose === "down") {
        p.ell(o.w / 2, F - 2, o.rx * 1.05, o.ry * 0.7, "body", { s: 0.1 });
        if (o.tail) p.line(o.w / 2 - o.rx, F - 2, o.w / 2 - o.rx - o.tail, F - 1, "tail", 0, 0.6);
        p.ell(o.w / 2 + o.rx + 1.5, F - 1, 1.6, 1.4, "head", { s: 0.2 }); p.px(Math.round(o.w / 2 + o.rx + 3), F - 1, "beak");
        p.line(o.w / 2 - 1, F - 4, o.w / 2 + 3, F - 6, "wing", 0.1);
        return;
      }
      const cx = o.w / 2 - 1, cy = fly ? F - o.ry - 5 : F - o.ry - o.leg, hy = pose === "graze" ? cy + o.ry - 1 : cy - o.ry - (pose === "alert" ? 2 : 1);
      if (o.tail) p.line(cx - o.rx + 1, cy - 0.5, cx - o.rx - o.tail, cy - (fly ? 1 : o.tail * 0.45), "tail", (t) => (Math.floor(t * 8) % 2 ? 0.3 : -0.2), 0.8);
      if (!fly && o.leg) { p.line(cx, cy + o.ry - 1, cx - (pose === "walk" && f ? 1 : 0), F, "leg", 0); p.line(cx + 2, cy + o.ry - 1, cx + 2 + (pose === "walk" && !f ? 1 : 0), F, "leg", 0); }
      p.ell(cx, cy, o.rx, o.ry, "body", { s: 0.15, fn: o.bodyFn });
      p.ell(cx + o.rx - 0.5, (cy + hy) / 2 + 0.5, 1.4, Math.max(1.2, Math.abs(hy - cy) / 2), o.neck || "head", { s: 0.2 });
      p.ell(cx + o.rx + 0.5, hy, 1.8, 1.6, "head", { s: 0.3 });
      p.px(Math.round(cx + o.rx + 2.3), Math.round(hy + 0.4), "beak");
      p.px(Math.round(cx + o.rx + 0.8), Math.round(hy - 0.4), "eye");
      if (o.wattle) p.px(Math.round(cx + o.rx + 1), Math.round(hy + 0.6), "wattle");
      if (o.ring) p.px(Math.round(cx + o.rx - 0.5), Math.round(hy + 1.6), "ring");
      p.layer = 3;
      if (fly) {
        const upw = f ? -1 : 1;
        p.poly([[cx - 2, cy - 1], [cx + 3, cy - 1], [cx - 1 - upw * 2, cy - 5 - upw * 2], [cx - 5, cy - 4 - upw]], "wing", (x, y) => 0.4 - (cy - y) * 0.06);
      } else p.ell(cx - 1, cy, o.rx * 0.65, o.ry * 0.6, "wing", { s: 0.05, fn: (x, y, s) => s + ((x + y) % 3 === 0 ? -0.3 : 0) });
    });
  }
  const PHEASANT = bird("pheasant", { w: 26, h: 14, rx: 4.6, ry: 2.8, leg: 3, tail: 8, wattle: true, ring: true,
    pal: { body: "#b8642a", wing: "#8a5a2e", tail: "#9a6a3a", head: "#2a4a52", neck: "head", beak: "#e8dca8", eye: "#e8b030", wattle: "#d02a22", ring: "#f4f0e8", leg: "#6a5a4a" },
    bodyFn: (x, y, s) => s + ((x * 2 + y) % 5 === 0 ? -0.35 : 0) });
  const PTARMIGAN = bird("ptarmigan", { w: 16, h: 12, rx: 3.6, ry: 3, leg: 1, tail: 1,
    pal: { body: "#f2f4f8", wing: "#e4e8f0", tail: "#2a2a30", head: "#eef0f4", beak: "#2a2a30", eye: "#1a1a20", leg: "#e8ecf0", wattle: "#d83a2a" }, wattle: true });
  const DUCK = bird("duck", { w: 18, h: 12, rx: 4.6, ry: 2.6, leg: 1, tail: 1,
    pal: { body: "#8a8478", wing: "#6a5a4a", tail: "#2a2a2a", head: "#2a6a4a", beak: "#e8c040", eye: "#1a1a1a", ring: "#f4f4f0", leg: "#e8902a" }, ring: true,
    bodyFn: (x, y, s) => s + (y < 7 && x > 9 ? 0.2 : 0) });
  function crab(pose, f) {
    return P("crab:" + pose + f, 18, 11, { shell: "#cc5034", shelld: "#8a2a1e", eye: "#1a1414", leg: "#a83a26" }, (p) => {
      const dn = pose === "down";
      p.layer = 1;
      for (const x of [3, 5, 12, 14]) p.line(x, dn ? 5 : 7, x + (x < 9 ? -2 : 2) + (pose === "walk" && f ? 1 : 0), dn ? 1 : 10, "leg", 0);
      p.layer = 2;
      p.ell(9, dn ? 7 : 6, 5.6, 3, "shell", { s: 0.2, fn: (x, y, s) => (dn ? s - 0.4 : s) });
      if (!dn) {
        p.ell(2.2, 4 - (pose === "alert" || f ? 1 : 0), 2, 1.6, "shell", { s: 0.3 }); p.ell(15.8, 4 - (pose === "alert" || !f ? 1 : 0), 2, 1.6, "shell", { s: 0.3 });
        p.px(7, 2, "eye"); p.px(10, 2, "eye");
      }
    });
  }
  const QUAD = { goat: GOAT, ibex: IBEX, boar: BOAR };
  // a fish out of the water (an eel is the same, longer): a silver-brown body, a darker back, the tail; down is lying still, else it flips
  function fish(pose, f) {
    return P("fish:" + pose + f, 18, 9, { scale: "#9aa08a", back: "#4e5a48", belly: "#e8e8dc", fin: "#6a6a58" }, (p) => {
      p.layer = 2;
      const bend = pose === "down" ? 0 : f ? 1.5 : -1.5;
      p.ell(9, 5, 6.5, 2.3, "scale", { s: 0.2 }); p.rect(4, 3, 10, 1, "back", 0); p.ell(9.5, 6.4, 4.5, 0.8, "belly", { s: 0.3 });
      p.poly([[3, 5], [0, 3 + bend], [0, 7 + bend]], "fin", 0.1); p.px(14, 4, "#120c0a");
    });
  }
  // the wildcat: a stocky grey-brown tabby, broad head with tufted ears, dark stripes over the back and a thick blunt tail ringed in black
  function wildcat(pose, f) {
    return P("wildcat:" + pose + f, 30, 18, { fur: "#8a7a62", furd: "#4e4234", stripe: "#3a2e24", belly: "#d8ccb0", tip: "#1e1814", eye: "#c8d040", nose: "#a86a5a" }, (p) => {
      const F = 17, bolt = pose === "bolt", down = pose === "down", sniff = pose === "graze", up = pose === "alert";
      const stripes = (x, y, s) => s + ((x + (y >> 1)) % 4 === 0 && y < 10 ? -0.45 : 0);
      if (down) {
        p.layer = 1; p.line(18, 15, 24, 16, "furd", -0.2, 0.7); p.line(8, 15, 2, 16, "furd", -0.2, 0.7);
        p.layer = 2; p.ell(14, 13.5, 9, 3.2, "fur", { s: 0.12, fn: stripes }); p.ell(14, 15.5, 6, 1, "belly", { s: 0.2 });
        p.ell(24.5, 14.5, 3.2, 2.6, "fur", { s: 0.2 }); p.px(26, 14, "#1a1210"); p.px(27, 15, "nose");
        p.line(5, 14, 1, 16, "fur", 0, 1.3); p.px(1, 16, "tip"); p.px(3, 15, "stripe");
        return;
      }
      const lift = bolt ? 3 : 0, by = 9 - lift;
      // far legs, then the body, then the near legs over it
      p.layer = 1;
      const legs = (xs, m, s, ph) => xs.forEach((x, i) => {
        const fr = i === 1, sw = pose === "walk" ? ((f ^ ph) ? 1.4 : -1.4) * (fr ? 1 : -1) : 0;
        if (bolt) p.line(x, by + 2, x + (fr ? 6 : -6), by + 6, m, s, 1);
        else { p.line(x, by + 2, x + sw, F - 1, m, s, 1); p.rect(Math.round(x + sw) - 1, F, 3, 1, m, s - 0.2); }
      });
      legs([8, 19], "furd", -0.2, 1);
      p.layer = 2;
      p.ell(14, by, 8.4, 3.8, "fur", { s: 0.15, fn: stripes });
      p.ell(14.5, by + 2.6, 6, 1.3, "belly", { s: 0.2 });
      // the tail: thick to the end, banded, the blunt tip black
      const tail = bolt ? [[6, by - 1], [3, by - 2], [0, by - 2]] : up ? [[6, by - 1], [3, by - 4], [2, by - 7]] : [[6, by], [3, by + 2], [1, by + 5]];
      for (let k = 0; k < tail.length - 1; k++) p.line(tail[k][0], tail[k][1], tail[k + 1][0], tail[k + 1][1], "fur", 0.1, 1.3);
      const tp = tail[tail.length - 1], tm = tail[1];
      p.ell(tp[0], tp[1], 1.3, 1.3, "tip", { s: 0 }); p.ell(tm[0], tm[1], 1.2, 1.2, "stripe", { s: 0 });
      // the head: broad, low on a short neck; down to the scent, up and pricked when alert
      const hx = bolt ? 24 : 23, hy = sniff ? by + 4 : up ? by - 5 : by - 3;
      p.ell(hx, hy, 3.6, 3.1, "fur", { s: 0.25 });
      p.ell(hx + 2.4, hy + 1.2, 1.8, 1.4, "belly", { s: 0.2 });
      p.px(Math.round(hx + 3.8), Math.round(hy + 0.6), "nose");
      p.px(Math.round(hx + 1.2), Math.round(hy - 0.6), "eye"); p.px(Math.round(hx + 1.2), Math.round(hy - 0.6) + 1, "#1a1210");
      for (const [dx, m] of [[-2, "furd"], [0.6, "fur"]]) { p.ell(hx + dx, hy - 3, 1.1, 1.6, m, { s: 0.2 }); p.px(Math.round(hx + dx), Math.round(hy - 5), "tip"); }
      p.px(Math.round(hx - 1), Math.round(hy - 1), "stripe"); p.px(Math.round(hx), Math.round(hy - 2), "stripe");
      p.layer = 3;
      legs([10, 21], "fur", 0, 0);
    });
  }
  // the red squirrel: a small body, the bushy tail curled up over its back, tufted ears
  function squirrel(pose, f) {
    return P("squirrel:" + pose + f, 16, 14, { fur: "#b4582a", furd: "#7a3418", belly: "#f0e2c8", eye: "#120c0a" }, (p) => {
      p.layer = 2;
      if (pose === "down") { p.ell(8, 12, 4.5, 1.8, "fur", { s: 0.2 }); p.ell(3, 12, 2.6, 1.4, "furd", { s: 0.2 }); p.px(12, 12, "eye"); return; }
      const run = pose === "bolt" || (pose === "walk" && f), sit = !run;
      if (run) { p.ell(8, 10, 4.4, 2.2, "fur", { s: 0.2 }); p.ell(13, 9, 2, 1.8, "fur", { s: 0.3 }); p.ell(3, 7, 2.6, 2.2, "fur", { s: 0.15 }); p.ell(1.5, 4.5, 1.8, 1.6, "furd", { s: 0.1 }); p.px(14, 8, "eye"); p.line(6, 12, 4, 13, "furd", 0); p.line(10, 12, 12, 13, "furd", 0); return; }
      p.ell(9, 10, 3, 3.4, "fur", { s: 0.2 }); p.ell(10, 11, 1.4, 2, "belly", { s: 0.2 });
      p.ell(4, 8, 2.8, 4.2, "fur", { s: 0.1, fn: (x, y, s) => s + ((x + y) % 3 === 0 ? -0.25 : 0) }); p.ell(5, 3, 2.6, 2.2, "fur", { s: 0.15 });
      const hy = pose === "graze" ? 9 : 6;
      p.ell(11, hy, 2, 1.8, "fur", { s: 0.3 }); p.px(12, hy - 1, "eye"); p.px(10, hy - 3, "furd"); p.px(10, hy - 2, "fur");
      p.rect(8, 13, 4, 1, "furd", 0);
      if (sit && pose === "alert") p.px(13, hy, "furd");
    });
  }
  const KIT_BIRD = (id) => (pose, f) => {
    const g = root.SceneKits ? root.SceneKits.sprite(id, pose === "fly" || pose === "bolt" || pose === "graze" ? 1 : f) : null;
    return pose === "down" ? lay(g) : g;
  };
  const OTHER = { fish, hare: hare(false), snowhare: hare(true), pheasant: PHEASANT, ptarmigan: PTARMIGAN, duck: DUCK, crab, wildcat, squirrel,
    heron: KIT_BIRD("heron"), owl: KIT_BIRD("owl"), magpie: KIT_BIRD("magpie"), gull: KIT_BIRD("gull") };
  function beast(id, pose, f) {
    pose = pose || "stand"; f = f | 0;
    if (id === "deer") id = "doe";
    if (DEER_KIND[id]) return deer(id, pose, pose === "walk" ? f & 3 : f & 1);
    f &= 1;
    if (QUAD[id]) return quad(QUAD[id], pose, f);
    if (OTHER[id]) return OTHER[id](pose, f);
    if (id === "fox" && root.SceneKits) {
      const g = root.SceneKits.sprite("fox", pose === "walk" || pose === "bolt" ? f : 0);
      return pose === "down" ? lay(g) : g;
    }
    return deer("doe", pose, f);
  }
  // a small body laid on its side: the grid squashed onto the ground (for kits drawn standing only)
  function lay(g) {
    if (!g) return g;
    const out = new root.Art.Grid(g.w + 2, g.h);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const c = g.px[y * g.w + x]; if (c) out.set(x + 1, g.h - 1 - Math.floor((g.h - 1 - y) * 0.45), c); }
    return out;
  }
  const BIRDS = new Set(["pheasant", "ptarmigan", "duck", "heron", "owl", "magpie", "gull"]);
  const SMALL = new Set(["fish", "hare", "snowhare", "pheasant", "ptarmigan", "duck", "crab", "fox", "wildcat", "squirrel", "heron", "owl", "magpie", "gull"]);

  // ---------- props ----------
  const BLIND = {
    forest: { leaf: "#4a6a30", leafd: "#2c4420", stick: "#4a3a24", frond: "#5e7a36" }, marsh: { leaf: "#8a9048", leafd: "#5a6032", stick: "#5a3a22" },
    hills: { leaf: "#6a7a32", leafd: "#3a4220", stick: "#8a4a30" }, snow: { leaf: "#2e4e46", leafd: "#1e3430", stick: "#3a2a1e" },
    coast: { leaf: "#6a8a3a", leafd: "#3e5a26", stick: "#6a5a48" }, plains: { leaf: "#4e7a38", leafd: "#2a4a22", stick: "#6a4e30" },
  };
  function prop(id, o) {
    o = o || {};
    switch (id) {
      case "blind": {
        // a hunter's screen: a dense thicket mound (bracken and holly in the wood, hawthorn on the road, gorse on the cliff, snow-laden pine
        // in the pass), a reed clump in the marsh, a heaped cairn of red stone on the crag; solid masses lit along the top, never stripes
        const b = o.biome || "forest", pal = Object.assign({ snow: "#f0f4fa", rock: "#a8603e", seam: "#4a2418", reed: "#9a8a4a", head: "#5a3a22", flower: "#e8c838" }, BLIND[b] || BLIND.forest);
        return P("blind:" + b, 26, 20, pal, (p) => {
          p.layer = 1;
          p.line(9, 19, 8, 13, "stick", -0.1); p.line(17, 19, 18, 12, "stick", -0.1);
          p.layer = 2;
          if (b === "hills") {
            // a cairn of red stones, each its own lit block with a dark seam round it
            for (const [x, y, r, k] of [[6, 16, 4.6, 0], [15, 16, 5.4, 1], [22, 17, 3.4, 2], [10, 9.5, 3.8, 3], [18, 9, 3.2, 4]]) {
              p.ell(x, y, r + 0.8, r * 0.8 + 0.6, "seam", { s: 0 });
              p.ell(x - 0.3, y - 0.3, r, r * 0.8, "rock", { s: 0.1, fn: (xx, yy, sh) => sh + (yy < y - r * 0.4 ? 0.3 : xx > x + r * 0.4 ? -0.3 : 0) + ((xx * 3 + yy + k) % 7 === 0 ? -0.2 : 0) });
            }
            return;
          }
          if (b === "marsh") {
            // a reed clump: single stems of different heights leaning apart, long blades arching off them, a few bulrush heads, the
            // sky between the stems so it never reads as a block
            p.ell(13, 18.5, 10, 1.8, "leafd", { s: -0.2 });
            for (let i = 0; i < 15; i++) {
              const x = 2 + i * 1.55 + (i % 3 === 1 ? 0.6 : 0), hh = 10 + ((i * 7) % 9), lean = ((i * 5) % 7 - 3) * 0.55;
              for (let j = 0; j < hh; j++) p.px(Math.round(x + lean * (j / hh) ** 1.6), 19 - j, j > hh - 3 ? "reed" : (i + (j >> 2)) % 3 ? "leaf" : "leafd", 0.2 - (i % 3) * 0.12);
              if (i % 4 === 2) { const dir = i % 8 === 2 ? 1 : -1; for (let k = 0; k < 7; k++) p.px(Math.round(x + dir * k * 0.9), Math.round(19 - hh * 0.55 - k * 0.7 + (k * k) / 9), "leaf", 0.3 - k * 0.04); }
            }
            for (const [x, y] of [[5, 5], [12, 1], [20, 4]]) { p.rect(x, y, 2, 3, "head", 0.1); p.px(x, y, "head", 0.4); p.px(x, y - 1, "reed", 0); }
            return;
          }
          const tall = b === "forest" ? 10 : b === "snow" ? 7 : 9;
          for (let i = 0; i < 22; i++) {
            const x = 3 + (i * 7) % 20, y = tall + (i * 5) % (19 - tall), r = 2.6 + (i % 3) * 0.6;
            p.ell(x, y, r * 1.2, r, i % 4 ? "leafd" : "leaf", { s: 0.12 - (y - tall) * 0.04, fn: (xx, yy, sh) => sh + (h2(xx, yy, 11) > 0.84 ? -0.3 : (xx + yy) % 5 === 0 ? 0.12 : 0) });
          }
          if (b === "forest") for (const [x, y] of [[6, 11], [13, 10], [19, 12], [10, 14]]) { p.ell(x, y, 2.2, 0.9, "frond", { s: 0.3 }); p.ell(x + 1, y + 1, 1.6, 0.7, "frond", { s: 0 }); }
          if (b === "snow") for (const [x, y] of [[5, 8], [11, 7], [17, 8], [21, 11], [8, 12], [15, 12]]) p.ell(x, y, 2.6, 1.1, "snow", { s: 0.4 });
          if (b === "coast") for (const [x, y] of [[6, 11], [12, 9], [18, 12], [9, 15], [20, 15]]) p.px(x, y, "flower");
          if (b === "plains") for (const [x, y] of [[7, 12], [14, 10], [19, 14]]) p.px(x, y, "#f4f0e2");
        });
      }
      case "pelt": return P("pelt:" + (o.kind || "brown"), 16, 12, { hide: o.kind === "white" ? "#e8ecf2" : o.kind === "grey" ? "#7a7470" : "#9a6a3e", flesh: "#d8b49a" }, (p) => {
        p.layer = 2;
        p.poly([[2, 2], [6, 1], [10, 1], [14, 2], [15, 6], [14, 10], [10, 11], [6, 11], [2, 10], [1, 6]], "hide", (x, y) => 0.2 - Math.abs(x - 8) * 0.04 - Math.abs(y - 6) * 0.05);
        p.ell(8, 6, 3.6, 2.6, "flesh", { s: 0.1 });
      });
      case "frame": return P("frame", 22, 24, { pole: "#6a4a2a", cord: "#d8c8a0" }, (p) => {
        p.layer = 2;
        p.line(2, 23, 8, 0, "pole", 0.2, 0.6); p.line(20, 23, 14, 0, "pole", -0.2, 0.6); p.line(4, 5, 18, 5, "pole", 0.1); p.line(3, 19, 19, 19, "pole", 0);
      });
      case "basket": return P("basket", 16, 12, { weave: "#b8884a", weaved: "#7a5428", rim: "#d8a860" }, (p) => {
        // a gathering basket side on: a woven body, a bound rim, and the bent-hazel handle over it
        p.layer = 1; for (let k = 0; k <= 12; k++) { const a = Math.PI * k / 12; p.px(Math.round(8 - Math.cos(a) * 6), Math.round(5 - Math.sin(a) * 5), "weaved", 0.2); }
        p.layer = 2; p.poly([[1, 5], [15, 5], [13, 12], [3, 12]], "weave", (x, y) => (y % 2 ? -0.18 : 0.18) - (x - 2) * 0.04);
        p.rect(1, 5, 14, 1, "rim", 0.3); p.rect(3, 9, 11, 1, "weaved", 0);
      });
      case "herbs": return P("herbs:" + (o.red ? "r" : "w"), 18, 16, { leaf: "#6aa040", leafd: "#3a6a26", flower: o.red ? "#d8402a" : "#efe8f4", stem: "#4a7a2e" }, (p) => {
        // a few herb sprigs standing apart: a thin stem, small leaves in pairs up it, a flat head of flowers (red pods for the pepper)
        p.layer = 2;
        for (const [x, h, l] of [[3, 9, -1], [8, 13, 0], [14, 10, 1]]) {
          p.line(x, 15, x + l, 15 - h, "stem", 0);
          for (let k = 3; k < h - 1; k += 3) { p.px(x + l * k / h - 1, 15 - k, "leaf"); p.px(x + l * k / h - 2, 15 - k + 1, "leafd"); p.px(x + l * k / h + 1, 15 - k - 1, "leaf"); p.px(x + l * k / h + 2, 15 - k, "leafd"); }
          p.ell(x + l, 15 - h, 2, 1, "flower", { s: 0.3 }); p.px(x + l, 15 - h - 1, "flower", 0.5);
        }
      });
      case "mushrooms": { const n = o.n == null ? 4 : o.n; return P("mushrooms:" + (o.red ? "r" : "b") + n, 18, 12, { cap: o.red ? "#c83a2a" : "#b07a3e", gill: "#e8d8b8", stalk: "#efe4cc", spot: "#f8f4ec", moss: "#4a6a2a" }, (p) => {
        // a ring of caps in the leaf litter: broad and shaded, their gills dark under the brim
        p.layer = 1; p.ell(9, 11, 8.5, 1.4, "moss", { s: -0.2 });
        p.layer = 2;
        [[4, 6, 3.4], [10, 4, 4.2], [14.5, 8, 2.6], [7.5, 9, 2]].slice(0, n).forEach(([x, y, r]) => {
          p.rect(Math.round(x) - 1, Math.round(y), 2, 11 - Math.round(y), "stalk", (xx) => (xx < x ? 0.3 : -0.2));
          p.ell(x, y, r, r * 0.62, "cap", { s: 0.25 });
          p.rect(Math.round(x - r + 1), Math.round(y + r * 0.45), Math.round(r * 2 - 1), 1, "gill", -0.3);
          if (o.red) { p.px(Math.round(x - 1), Math.round(y - 1), "spot"); p.px(Math.round(x + 1), Math.round(y), "spot"); }
        });
      }); }
      case "berries": return P("berries:" + (o.red ? "r" : "b"), 28, 20, { leaf: "#3e6a2c", leafd: "#24401c", berry: o.red ? "#c8302a" : "#2e1838", berryl: o.red ? "#f06048" : "#6a4a8a", cane: "#7a3a2a" }, (p) => {
        // a bramble: arching canes, a mound of leaf, the fruit hanging in clusters where the light gets in
        p.layer = 1; for (let i = 0; i < 5; i++) { const x0 = 3 + i * 5; for (let k = 0; k <= 10; k++) { const a = Math.PI * k / 10; p.px(Math.round(x0 + k * 0.9), Math.round(19 - Math.sin(a) * (12 + (i % 2) * 4)), "cane", 0); } }
        p.layer = 2; for (let i = 0; i < 26; i++) p.ell(2 + (i * 7) % 24, 6 + (i * 5) % 13, 2.4, 1.6, i % 3 ? "leaf" : "leafd", { s: 0.12, fn: (x, y, s) => s + ((x + y) % 4 === 0 ? -0.3 : 0) });
        p.layer = 3; for (let i = 0; i < 9; i++) { const x = 4 + (i * 9) % 21, y = 7 + (i * 5) % 10; p.rect(x, y, 2, 2, "berry", 0); p.px(x, y, "berryl"); p.px(x + 1, y + 2, "berry", -0.3); }
      });
      case "nest": { const n = o.n == null ? 3 : o.n; return P("nest" + n, 20, 12, { twig: "#8a6a3a", grass: "#7a8a42", egg: "#e8e0c8", speck: "#8a6a4a" }, (p) => {
        // a nest down in a grass tussock, the eggs showing over its rim
        p.layer = 1; for (let i = 0; i < 14; i++) p.line(2 + i * 1.2, 11, 1 + i * 1.3 + (i % 3) - 1, 2 + (i % 4), "grass", 0.1);
        p.layer = 2; p.ell(10, 8, 7.5, 3, "twig", { s: 0, fn: (x, y, s) => s + ((x + y) % 2 ? -0.35 : 0.15) });
        p.layer = 3; for (const x of [7, 10, 13].slice(0, n)) { p.ell(x, 6, 1.6, 2, "egg", { s: 0.35 }); p.px(x, 6, "speck"); }
      }); }
      case "moss": return P("moss:" + (o.biome || ""), 22, 13, { stone: o.biome === "snow" ? "#8a94a8" : "#8a8478", moss: o.biome === "marsh" || o.biome === "snow" ? "#9aa868" : "#5e8a34", lichen: "#c8c8a0", crust: "#f0f4fa" }, (p) => {
        // a boulder under a thick cushion of moss, pale crusts of lichen on its bare side
        p.layer = 1; p.ell(11, 9, 10, 4.5, "stone", { s: 0.1 });
        p.layer = 2; p.ell(9, 6.5, 8, 3.4, "moss", { s: 0.2, fn: (x, y, s) => s + ((x * 3 + y) % 5 === 0 ? -0.35 : (x + y) % 7 === 0 ? 0.3 : 0) });
        for (const [x, y] of [[16, 9], [18, 8], [17, 11], [5, 11]]) p.ell(x, y, 1.2, 0.8, "lichen", { s: 0.2 });
        if (o.biome === "snow") for (let x = 4; x < 16; x += 3) p.ell(x, 4, 2, 0.8, "crust", { s: 0.4 });
      });
      case "roots": return P("roots:" + (o.biome || ""), 22, 14, { earth: o.biome === "hills" ? "#8a4a30" : "#5a4430", hole: "#1e1610", root: "#d8c49a", leaf: o.biome === "marsh" ? "#8a9048" : "#5e9a3a", stick: "#6a4a2a" }, (p) => {
        // a spot dug out: the earth heaped beside a dark hole, roots and tubers lifted out with the soil still on them, the tops wilting
        p.layer = 1; p.ell(16, 11, 5, 2.6, "earth", { s: 0.15, fn: (x, y, s) => s + ((x + y) % 3 === 0 ? -0.3 : 0) });
        p.ell(8, 12, 5, 1.6, "hole", { s: -0.4 });
        p.layer = 2;
        for (const [x, y, a] of [[4, 9, 0.5], [9, 8, -0.3], [13, 9, 0.2]]) {
          p.ell(x, y, 1.8, 1.2, "root", { s: 0.2 }); p.line(x + 1.5, y, x + 4, y + 2 + a, "root", -0.1);
          p.line(x - 0.5, y - 1, x - 1.5 + a * 3, y - 6, "leaf", 0.1); p.line(x + 0.5, y - 1, x + 2 + a * 2, y - 5, "leaf", -0.1);
        }
        p.line(19, 13, 21, 2, "stick", 0.2);
      });
      case "greens": return P("greens:" + (o.flower ? "f" : ""), 20, 12, { leaf: "#4e8a34", leafd: "#2e5a24", vein: "#7ab04a", flower: "#f4f4ee" }, (p) => {
        // a patch of broad leaves (sorrel, ramsons, nettles, cress) fanned out on the ground, a few starry flowers over it
        p.layer = 2;
        for (let i = 0; i < 7; i++) {
          // each leaf a broad blade from the crown: a pointed oval with its midrib lit
          const x = 10, a = -1.25 + i * 0.42, l = 8 + (i % 2) * 2, ux = Math.sin(a), uy = -Math.cos(a) * 0.8, wx = -uy, wy = ux;
          const pt = (u, v) => [x + ux * u + wx * v, 11.5 + uy * u + wy * v];
          p.poly([pt(0, 0), pt(l * 0.35, 2.2), pt(l * 0.75, 1.6), pt(l, 0), pt(l * 0.75, -1.6), pt(l * 0.35, -2.2)], i % 2 ? "leaf" : "leafd", (xx, yy) => 0.25 - (yy - 4) * 0.04);
          p.line(x, 11.5, x + ux * l * 0.85, 11.5 + uy * l * 0.85, "vein", 0.1);
        }
        if (o.flower) for (const [x, y] of [[5, 2], [10, 1], [15, 3]]) { p.px(x, y, "flower"); p.px(x - 1, y, "flower", -0.2); p.px(x + 1, y, "flower", -0.2); p.px(x, y - 1, "flower", 0.2); p.line(x, y + 1, x, y + 5, "leafd", 0); }
      });
      case "nuts": return P("nuts", 26, 22, { leaf: "#5a8a34", leafd: "#2e5222", nut: "#a8743a", husk: "#9ab84a", stem: "#6a4a2a" }, (p) => {
        // a hazel: thin stems up from the stool, round leaves, nuts in their green frilled husks in pairs and threes
        p.layer = 1; for (const [x, a] of [[8, -0.4], [12, 0], [16, 0.35], [10, -0.15]]) p.line(x, 21, x + Math.sin(a) * 16, 21 - Math.cos(a) * 18, "stem", 0);
        p.layer = 2; for (let i = 0; i < 22; i++) p.ell(3 + (i * 7) % 21, 3 + (i * 5) % 13, 2.6, 2, i % 3 ? "leaf" : "leafd", { s: 0.12 });
        p.layer = 3; for (const [x, y] of [[6, 10], [14, 7], [19, 12], [10, 14]]) { p.ell(x, y, 1.4, 1.4, "nut", { s: 0.3 }); p.ell(x + 2, y + 0.5, 1.3, 1.3, "nut", { s: 0.2 }); p.line(x - 1, y - 1.5, x + 3, y - 1.5, "husk", 0.2); }
      });
      case "skull": return P("skull:" + (o.antlers ? "a" : o.tusk ? "t" : ""), 22, 18, { bone: "#ece2c8", hole: "#2a1e16", antler: "#e0cfa4", stone: "#8a8478" }, (p) => {
        // a cleaned skull drying on a flat stone, the rack or the tusks still on it
        p.layer = 1; p.ell(11, 15.5, 9, 2.4, "stone", { s: 0.1 });
        p.layer = 2; p.poly([[6, 13], [8, 8], [14, 8.5], [19, 12], [18, 14], [9, 14.5]], "bone", (x, y) => 0.3 - (y - 8) * 0.08 - (x - 6) * 0.02);
        p.ell(10.5, 10.5, 1.2, 1, "hole", { s: -0.5 }); p.px(18, 12, "hole");
        if (o.antlers) for (const [dx, s] of [[0, 0.2], [2, -0.2]]) { p.line(8 + dx, 8, 4 + dx, 1, "antler", s); p.line(6 + dx, 5, 9 + dx, 1, "antler", s); p.line(5 + dx, 3, 2 + dx, 0, "antler", s); }
        if (o.tusk) { p.line(16, 13, 18, 9, "bone", 0.4); }
      });
      case "sack": return P("sack", 12, 13, { cloth: "#b8a27a", tie: "#6a4a2a" }, (p) => {
        // a cloth sack sat on the ground, its neck tied off
        p.layer = 2; p.ell(6, 8.5, 5.2, 4.4, "cloth", { s: 0.15, fn: (x, y, sh) => sh + (x === 6 && y > 6 ? -0.25 : 0) }); p.poly([[4, 4], [8, 4], [7, 1], [5, 1]], "cloth", 0.1); p.rect(4, 3, 4, 1, "tie", 0);
      });
      case "kerchief": return P("kerchief" + (o.red ? "r" : ""), 22, 7, { cloth: o.red ? "#a8402e" : "#8a3a2e", hem: "#e8c878" }, (p) => {
        // a kerchief spread on the ground for what is picked, seen low: its far corners knotted up, a yellow hem
        p.layer = 2; p.poly([[4, 2], [18, 2], [21, 6], [0, 6]], "cloth", (x, y) => 0.25 - (y - 2) * 0.1); p.rect(1, 5, 20, 1, "hem", -0.1);
        p.ell(4, 1.5, 1.4, 1.4, "cloth", { s: 0.3 }); p.ell(18, 1.5, 1.4, 1.4, "cloth", { s: 0.3 });
      });
      case "ferns": return P("ferns", 28, 20, { frond: "#3e6a2c", frondd: "#26461e", rach: "#2e4e22", coil: "#8ec04c", coill: "#c8e47a", coild: "#4e7e2a", scale: "#a07a48", stem: "#78a040", earth: "#3e3020" }, (p) => {
        // a fern crown: a few open fronds arching out low behind (a stalk with its leaflets in pairs), and standing up in front of them
        // the young shoots, each a pale stem bent over at the top into a tight green curl, a fleck of brown fuzz still on it
        p.layer = 1; p.ell(14, 19, 9, 1.4, "earth", { s: -0.1 });
        for (const [x0, dir, len, up] of [[11, -1, 11, 0.8], [17, 1, 10, 0.75], [13, -1, 7, 1.3]]) {
          for (let k = 0; k <= len; k++) {
            const q = k / len, x = x0 + dir * k, y = 18 - k * up + q * q * len * 0.7;
            p.px(Math.round(x), Math.round(y), "rach", 0);
            if (k > 1 && k < len) for (const sd of [-1, 1]) { const l = Math.max(1, Math.round((1 - q) * 2.6)); for (let m = 1; m <= l; m++) p.px(Math.round(x + dir * m * 0.4), Math.round(y + sd * m), (k + m) % 2 ? "frond" : "frondd", 0.1 - q * 0.2); }
          }
        }
        p.layer = 2;
        for (const [x, top, dir] of [[8, 6, 1], [14, 3, -1], [19, 7, 1]]) {
          for (let y = top + 2; y <= 18; y++) p.px(Math.round(x - dir * (y - top) * 0.08), y, "stem", y < top + 5 ? 0.25 : 0);
          const cx = x + dir * 1.6, cy = top;
          p.ell(cx, cy, 2.4, 2.2, "coil", { s: 0.25 });
          p.ell(cx + dir * 0.5, cy + 0.4, 1, 0.9, "coild", { s: 0 });
          p.px(Math.round(cx - dir), Math.round(cy - 1.6), "coill"); p.px(Math.round(cx), Math.round(cy - 1.8), "coill");
          p.px(Math.round(cx + dir * 1.6), Math.round(cy + 1.2), "scale");
        }
      });
      case "samphire": return P("samphire", 26, 16, { rock: "#76726a", rockd: "#4a4640", wet: "#34322e", salt: "#eef2ee", stem: "#5aa83a", steml: "#a4dc66", joint: "#3e7a2a" }, (p) => {
        // marsh samphire on a wet ledge of the cliff: a low bushy clump of bright, plump, jointed stems, each forking upward like a
        // little candelabrum, the tips lit, a crust of salt on the stone round them
        p.layer = 1; p.ell(13, 13.6, 12.5, 2.6, "rock", { s: 0.15, fn: (x, y, sh) => sh + (y > 14 ? -0.45 : 0) + ((x * 3 + y) % 7 === 0 ? -0.2 : 0) });
        p.ell(13, 15.3, 11, 0.8, "wet", { s: 0 });
        for (const [x, y] of [[2, 13], [23, 13], [6, 12], [20, 12]]) p.px(x, y, "salt", 0.2);
        p.layer = 2;
        const bead = (x, y, top) => p.ell(x, y, 0.9, 0.8, top ? "steml" : "stem", { s: top ? 0.3 : 0.12 });
        const shoot = (x, y, len, a, depth) => {
          let px = x, py = y;
          for (let k = 0; k < len; k++) { px += Math.sin(a) * 1.3; py -= Math.cos(a) * 1.3; bead(px, py, k === len - 1 && depth === 0); if (k % 2 === 1) p.px(Math.round(px), Math.round(py) + 1, "joint", 0); }
          if (depth > 0) { shoot(px, py, len - 1, a - 0.55, depth - 1); shoot(px, py, len - 1, a + 0.5, depth - 1); }
        };
        for (const [x, len, a] of [[5, 3, -0.25], [9, 4, -0.05], [13, 4, 0.1], [17, 3, 0.2], [21, 3, 0.35]]) shoot(x, 12.5, len, a, 1);
      });
      case "apples": return P("apples:" + (o.n == null ? 6 : o.n), 30, 34, { bark: "#5a4430", leaf: "#4e7a34", leafd: "#2e5224", apple: "#c8a838", blush: "#c8502e", grass: "#6a8a3a" }, (p) => {
        // a crab-apple tree alone in the grass, bent with small yellow-red fruit
        p.layer = 1; p.line(15, 33, 15, 18, "bark", 0.1, 1.6); p.line(15, 22, 9, 15, "bark", 0, 1); p.line(15, 20, 21, 14, "bark", 0, 1);
        p.layer = 2; for (let i = 0; i < 26; i++) p.ell(4 + (i * 7) % 23, 3 + (i * 5) % 15, 3.4, 2.6, i % 3 ? "leaf" : "leafd", { s: 0.15 - ((i * 5) % 15) * 0.02 });
        p.layer = 3; [[7, 9], [12, 13], [19, 7], [23, 12], [16, 4], [9, 15]].slice(0, o.n == null ? 6 : o.n).forEach(([x, y]) => { p.ell(x, y, 1.2, 1.2, "apple", { s: 0.3 }); p.px(x + 1, y + 1, "blush"); });
      });
      case "flowers": return P("flowers:" + (o.pale ? "p" : ""), 18, 12, { stem: "#4a7a2e", leaf: "#3e6a2a", petal: o.pale ? "#e8eef8" : "#e8c040", eye: o.pale ? "#b8c8e8" : "#c86a2a" }, (p) => {
        // a few flowers in a hollow, open faces turned to the light
        p.layer = 2; for (const [x, h] of [[4, 7], [9, 9], [14, 6]]) { p.line(x, 11, x, 11 - h, "stem", 0); p.ell(x - 1.5, 11 - h * 0.4, 1.4, 0.7, "leaf", { s: 0.1 }); p.ell(x, 11 - h, 2, 1.6, "petal", { s: 0.35 }); p.px(x, 11 - h, "eye"); }
      });
      case "pool": return P("pool", 34, 9, { water: "#3e6a80", lit: "#8ab8cc", rim: "#5a5a50", stone: "#8a8478" }, (p) => {
        // a clear pool under a flat stone, the sky in it
        p.layer = 1; p.ell(17, 5, 16, 3.6, "rim", { s: -0.2 });
        p.layer = 2; p.ell(17, 5, 14, 2.8, "water", { s: 0.1, fn: (x, y, sh) => sh + ((x * 2 + y * 5) % 9 === 0 ? 0.5 : 0) }); p.ell(6, 4, 5, 2, "stone", { s: 0.2 });
      });
      case "stone": return P("stone:" + (o.biome || ""), 20, 6, { stone: o.biome === "hills" ? "#a8603e" : "#8a8478" }, (p) => { p.layer = 2; p.ell(10, 3.5, 9.5, 2.6, "stone", { s: 0.15 }); });
      case "leanto": return P("leanto:" + (o.biome || ""), 34, 22, { pole: "#5a3e24", tarp: "#8a7a5a", leaf: o.biome === "snow" ? "#2a4c44" : o.biome === "marsh" ? "#8a9048" : "#3e6a2c", snow: "#f0f4fa" }, (p) => {
        // side on: a ridge pole on two forked uprights, the tarp pegged from it down to the ground behind, boughs laid over it
        p.layer = 1; p.line(26, 21, 26, 2, "pole", 0.1); p.line(24, 0, 26, 3, "pole", 0.2); p.line(28, 0, 26, 3, "pole", 0);
        p.layer = 2; p.poly([[27, 2], [27, 22], [0, 22]], "tarp", (x, y) => (y < 3 + (27 - x) * 0.7 + 2.2 ? 0.35 : -0.55) + ((x * 3 + y) % 7 === 0 ? -0.2 : 0));
        for (let k = 0; k < 7; k++) { const x = 25 - k * 3.6, y = 3 + k * 2.7; p.ell(x, y - 0.5, 2.4, 1.2, "leaf", { s: 0.15 }); if (o.biome === "snow") p.ell(x, y - 1.4, 1.6, 0.7, "snow", { s: 0.4 }); }
        p.layer = 3; p.line(31, 21, 31, 6, "pole", -0.1);
      });
      case "log": return P("log", 26, 7, { bark: "#5a4028", barkd: "#3a2a1a", cut: "#c8a46a" }, (p) => {
        p.layer = 2; p.ell(13, 3.5, 12, 3, "bark", { s: 0.1, fn: (x, y, s) => s + (x % 4 === 0 ? -0.35 : 0) }); p.ell(24, 3.5, 1.6, 2.8, "cut", { s: 0.3 });
      });
      case "spit": return P("spit", 30, 16, { stick: "#5a3e24" }, (p) => {
        p.layer = 2; p.line(3, 15, 3, 2, "stick", 0.2); p.line(1, 0, 3, 3, "stick", 0.2); p.line(5, 0, 3, 3, "stick", 0);
        p.line(27, 15, 27, 2, "stick", -0.1); p.line(25, 0, 27, 3, "stick", 0.1); p.line(29, 0, 27, 3, "stick", -0.1); p.line(1, 2, 29, 2, "stick", 0.3);
      });
      case "hive": return P("hive", 14, 30, { bark: "#5a4430", barkd: "#33261a", hole: "#140e0a", comb: "#e8b040" }, (p) => {
        p.layer = 2; p.rect(2, 0, 10, 30, "bark", (x, y) => 0.3 - (x - 2) * 0.09 + (y % 5 === 0 && x % 3 === 0 ? -0.4 : 0));
        p.ell(7, 11, 2.4, 3.6, "hole", { s: -0.5 }); p.px(7, 13, "comb"); p.px(6, 12, "comb");
      });
    }
    return null;
  }
  // marks pressed into the ground along a trail that wanders the way the animal went (to the right): each print seen low and
  // foreshortened, darker than the ground with a lit rim of mud (or of snow) on its far edge. Cloven slots for deer, square splayed
  // toes for goats, broad toes with the dewclaws behind for a boar, a pad and four toes for paws (five round a huge pad for the great
  // pugmark), a hare's bounding group (two small fore feet, the long hind feet landing side by side ahead), three-toed bird feet,
  // webbed feet, a boot's sole and heel; or the drops of a blood trail, a drag furrow, a dark line brushed through the dew
  const PRINT = {
    deer: [".rr..", "dddm.", "....d", "dddm."], goat: ["rr..", "dd..", "....", ".rr.", ".dd."], boar: ["...rr.", "m..ddd", "...rr.", "m..ddd"],
    paw: ["...d.", "rr..d", "dd..d", "...d."], bigpaw: ["....d..", "rrr..dd", "dddd..d", "dddd..d", "....dd."], hare: ["......rrr", "dd....ddd", "......rrr", "...dd.ddd"],
    bird: ["...d", "dddd", "...d"], webbed: ["..md", "dddd", "..md"], boot: ["rr.rrrr.", "dd.ddddm", "dd.dddd."], crab: ["d.d", "...", "d.d"],
  };
  const SCUFF = [[".rr.", "dddd", ".dm."], ["rr..", "ddd.", ".mdd"], [".rrr", "ddm."], ["rr", "dd", "m."]];
  const GAIT = { deer: [9, 2], goat: [7, 3], boar: [8, 2], paw: [8, 2], bigpaw: [13, 2], hare: [16, 0], bird: [5, 1], webbed: [6, 1], boot: [9, 2], crab: [5, 2], scuff: [8, 2] };
  function prints(img, I, x0, x1, kind, G) {
    const snowy = I.biome === "snow" || I.weather === "snow", W0 = I.wild || {}, marsh = I.biome === "marsh";
    const g = (col) => (G ? G(col, 0) : col);
    const dark = g(snowy ? "#6a7aa0" : marsh ? "#1c1e14" : mix(W0.g2 || "#3a5a2a", "#120a06", 0.66));
    const mid = g(snowy ? "#a4b2d0" : mix(W0.g2 || "#3a5a2a", "#120a06", 0.38));
    const rim = g(snowy ? "#ffffff" : mix(W0.g3 || "#8a9a5a", "#f4ead0", 0.5));
    const parts = String(kind || "scuff").split("+"), base = parts[0], seed = (I.seed || 0) + (x0 | 0);
    const ph = h2(x0 | 0, 5, seed) * 6.28, y0 = I.feet + 4, ymax = I.h - 4;
    const yAt = (x) => clamp(y0 + Math.sin(x * 0.05 + ph) * 2.2 + Math.sin(x * 0.17 + ph * 3) * 0.8 - (x - x0) * 0.012, I.feet + 2, ymax);
    const stamp = (pat, x, y) => pat.forEach((row, j) => {
      // the trodden patch round the print first, so it stands off the ground's own speckle
      if (j === 0) { const w = row.length, h = pat.length; for (let yy = -1; yy <= h; yy++) for (let xx = -1; xx <= w; xx++) if (((xx + 0.5 - w / 2) / (w / 2 + 1)) ** 2 + ((yy + 0.5 - h / 2) / (h / 2 + 1)) ** 2 < 1) img.px(Math.round(x) + xx, Math.round(y) + yy - 1, mid, snowy ? 0.35 : 0.3); }
      for (let k = 0; k < row.length; k++) {
        const ch = row[k], X = Math.round(x) + k, Y = Math.round(y) + j - 1;
        if (ch === "d") img.px(X, Y, dark, 0.9); else if (ch === "m") img.px(X, Y, mid, 0.85); else if (ch === "r") img.px(X, Y, rim, snowy ? 0.9 : 0.6);
      }
    });
    if (base === "dew") {
      // the dew silver on every blade but the one dark line where something brushed through
      for (let x = 0; x < I.w; x++) for (let y = I.feet - 2; y < I.h - 1; y++) {
        const d = Math.abs(y - yAt(x)), on = x >= x0 - 40 && x < x1;
        if (on && d < 1.4) img.px(x, y, dark, 0.45); else if (on && d < 2.4) img.px(x, y, mid, 0.3);
        else if (h2(x, y, seed) > 0.8) img.px(x, y, g("#eef4f8"), 0.75 - Math.min(0.45, Math.abs(y - I.feet - 4) * 0.04));
      }
      return;
    }
    if (base === "blood") {
      // dark drops, here and there a smear, further apart as the trail goes on
      for (let x = x0, i = 0; x < x1; i++) {
        const y = Math.round(yAt(x) + (h2(i, 2, seed) - 0.5) * 3), X = Math.round(x), big = h2(i, 4, seed) > 0.55 && x - x0 < 50;
        img.px(X, y, g("#7a1810"), 0.95); img.px(X, y - 1, g("#d8402c"), 0.9);
        if (big) { img.px(X + 1, y, g("#9a2016"), 0.9); img.px(X + 1, y - 1, g("#c03022"), 0.8); }
        x += 3 + h2(i, 1, seed) * 6 + (x - x0) * 0.04;
      }
      return;
    }
    if (parts.includes("drag") || base === "drag") {
      // the furrow a heavy tail or a dragged carcass leaves, wavering, its far lip catching the light
      for (let x = x0; x < x1; x++) { const y = Math.round(yAt(x) + 1); img.px(x, y, dark, 0.55); img.px(x, y - 1, rim, 0.35); }
      if (base === "drag") return;
    }
    const pat = PRINT[base], [step, sway] = GAIT[base] || GAIT.scuff;
    for (let x = x0 + h2(1, 1, seed) * 4, i = 0; x < x1; i++) {
      const side = sway ? (i % 2 ? sway : -sway) : 0, y = yAt(x) + side - 1;
      stamp(pat || SCUFF[Math.floor(h2(i, 6, seed) * SCUFF.length)], x, y);
      // a print in the marsh holds a little water, the sky's grey in it
      if (marsh && pat && h2(i, 7, seed) > 0.5) img.px(Math.round(x) + 1, Math.round(y) + 1, g(W0.water2 || "#5a7a78"), 0.8);
      x += step + (h2(i, 8, seed) - 0.5) * 3;
    }
  }
  // the small birds a line can name: a jay in the glade, a crow on the kill
  const JAY = bird("jay", { w: 14, h: 11, rx: 3.4, ry: 2.4, leg: 1, tail: 4,
    pal: { body: "#c8987a", wing: "#3a6ab0", tail: "#1e1a1e", head: "#d8b8a0", beak: "#2a2420", eye: "#120c0a", leg: "#8a7a6a", ring: "#f4f0ec" }, ring: true });
  const CROW = bird("crow", { w: 15, h: 11, rx: 3.8, ry: 2.6, leg: 1, tail: 4,
    pal: { body: "#2a2a34", wing: "#1e1e26", tail: "#1a1a20", head: "#30303a", beak: "#3a3a40", eye: "#d8d8e0", leg: "#3a3a40" } });
  OTHER.jay = JAY; OTHER.crow = CROW;
  BIRDS.add("jay"); BIRDS.add("crow"); SMALL.add("jay"); SMALL.add("crow");

  root.HuntArt = { set, beast, prop, prints, lay, WILD, GAME: Object.keys(DEER_KIND).concat(Object.keys(QUAD), Object.keys(OTHER), ["fox"]), BIRDS, SMALL, PROPS: ["blind", "pelt", "frame", "basket", "sack", "kerchief", "herbs", "ferns", "samphire", "apples", "flowers", "pool", "mushrooms", "berries", "nest", "moss", "roots", "greens", "nuts", "skull", "stone", "leanto", "log", "spit", "hive"] };
})(typeof window !== "undefined" ? window : globalThis);
