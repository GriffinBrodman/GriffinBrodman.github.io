/* Every dish's close-up for the meal replays: the bits (chunks, roots, grains, shells, crusts), the liquids and the vessels, composed per plate and coloured per dish; adds to FoodArt. */
/*
  A dish is a set of objects, each a height field with its own colours, composited by height: the top surface wins and is lit from
  the combined heights, so a chunk half-sunk in broth gets its waterline for free. Plates (PLATES[plate]) give
  piece(spec).draw(img, o) for the food at a stage of the cook and serve(spec, o) for the served close-up; LOOKS[pal] colour them and
  DISH[id] adds what makes one dish itself.
*/
(function (root) {
  "use strict";
  const FA = root.FoodArt, K = FA.kit, B = FA.bits;
  const { W, H, Img, C, mix, R, pick, rng, fbm, h2, clamp, lerp, TAU, hrender, ell, glow, light, vignette, bokeh, steam, star, outline, rimShade, shadow, norm3, KEY, P, BURNT, taken, item, geo } = K;

  // ---------- composite height fields ----------
  // obj: { x0, y0, x1, y1, hf(x, y) -> height | null, cf(x, y, info) -> colour, k (shine) }
  const AOK = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const d = Math.hypot(dx, dy); if (d > 0 && d <= 3.2) AOK.push([dx, dy, 0.12 / d]); }
  const INFO = { ao: 0, h: 0, nx: 0, ny: 0, nz: 1, diff: 0, spec: 0, edge: 0, rim: 0, fire: 0, local: 0, id: 0 };
  function scene(img, objs, o) {
    o = o || {};
    if (!objs.length) return;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const ob of objs) { x0 = Math.min(x0, Math.floor(ob.x0)); y0 = Math.min(y0, Math.floor(ob.y0)); x1 = Math.max(x1, Math.ceil(ob.x1)); y1 = Math.max(y1, Math.ceil(ob.y1)); }
    x0 = Math.max(-1, x0 - 1); y0 = Math.max(-1, y0 - 1); x1 = Math.min(W, x1 + 1); y1 = Math.min(H, y1 + 1);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, hs = new Float32Array(bw * bh).fill(-1e9), ids = new Int16Array(bw * bh).fill(-1), loc = new Float32Array(bw * bh);
    objs.forEach((ob, k) => {
      for (let y = Math.max(y0, Math.floor(ob.y0)); y <= Math.min(y1, Math.ceil(ob.y1)); y++) for (let x = Math.max(x0, Math.floor(ob.x0)); x <= Math.min(x1, Math.ceil(ob.x1)); x++) {
        const v = ob.hf(x + 0.5, y + 0.5);
        if (v === null || v === undefined) continue;
        const i = (y - y0) * bw + (x - x0), z = v + (ob.base || 0);
        if (z > hs[i]) { hs[i] = z; ids[i] = k; loc[i] = v; }
      }
    });
    const light = o.light || KEY, fireL = norm3(0.35, 0.9, 0.35);
    for (let y = Math.max(0, y0 + 1); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0 + 1); x < Math.min(W, x1); x++) {
      const i = (y - y0) * bw + (x - x0), k = ids[i];
      if (k < 0) continue;
      const h = hs[i], ob = objs[k];
      const g = (j) => (ids[j] < 0 ? h : hs[j]);
      let l = g(i - 1), r = g(i + 1), u = g(i - bw), d = g(i + bw);
      let edge = 0;
      if (ids[i - 1] < 0) edge++; if (ids[i + 1] < 0) edge++; if (ids[i - bw] < 0) edge++; if (ids[i + bw] < 0) edge++;
      const cl = ob.clampN || 6;
      l = clamp(l - h, -cl, cl); r = clamp(r - h, -cl, cl); u = clamp(u - h, -cl, cl); d = clamp(d - h, -cl, cl);
      const n = norm3(-(r - l) / 2, -(d - u) / 2, 1);
      const hv = norm3(light[0], light[1], light[2] + 1);
      INFO.h = h; INFO.local = loc[i]; INFO.nx = n[0]; INFO.ny = n[1]; INFO.nz = n[2]; INFO.edge = edge; INFO.id = k;
      INFO.diff = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
      INFO.spec = Math.pow(Math.max(0, n[0] * hv[0] + n[1] * hv[1] + n[2] * hv[2]), ob.k || 18);
      INFO.rim = Math.max(0, n[0] * 0.6 + n[1] * 0.75);
      INFO.fire = Math.max(0, n[0] * fireL[0] + n[1] * fireL[1] + n[2] * fireL[2]);
      INFO.under = ids[i + bw] >= 0 && ids[i + bw] !== k && hs[i + bw] < h - 0.5;
      let ao = 0;
      if (ob.ao !== false) for (const [dx, dy, wgt] of AOK) { const j = i + dy * bw + dx; if (j >= 0 && j < hs.length && ids[j] >= 0 && hs[j] > h + 1.2) ao += wgt; }
      INFO.ao = Math.min(1, ao);
      INFO.over = ids[i - bw] >= 0 && ids[i - bw] !== k && hs[i - bw] > h + 0.5;
      const c = ob.cf(x, y, INFO);
      if (c) img.px(x, y, c);
    }
  }
  function blob(cx, cy, rx, ry, ht, cf, o) {
    o = o || {};
    const E = ell(cx, cy, rx, ry, o.wob, o.seed || 0), pw = o.pow === undefined ? 0.5 : o.pow, rough = o.rough || 0, sc = o.scale || 3, sd = o.seed || 0;
    return { x0: cx - rx * 1.4 - 1, y0: cy - ry * 1.4 - 1, x1: cx + rx * 1.4 + 1, y1: cy + ry * 1.4 + 1, base: o.base || 0, k: o.k, clampN: o.clampN,
      hf: (x, y) => { const d = E(x, y); if (d > 1) return null; return Math.pow(1 - d * d, pw) * ht + (rough ? (fbm(x / sc, y / sc, sd) - 0.5) * rough : 0); }, cf };
  }
  const ramp = (r, t, x, y, d) => pick(r, t, x, y, d);
  // colour helpers for the common food surfaces
  const shade = (rp, o) => {
    o = o || {};
    const base = o.base === undefined ? 0.08 : o.base, k = o.k === undefined ? 0.85 : o.k, glint = o.glint === undefined ? 0.55 : o.glint, n = o.noise || 0, sd = o.seed || 0;
    return (x, y, i) => {
      let t = base + i.diff * k + (n ? (fbm(x / (o.ns || 2.5), y / (o.ns || 2.5), sd) - 0.5) * n : 0) - (i.under ? 0.25 : 0) - i.ao * 0.5;
      if (i.spec > glint && !i.edge) return i.spec > glint + 0.25 ? o.hi || "#fff6e8" : mix(ramp(rp, 1, x, y), "#ffffff", 0.35);
      return ramp(rp, t, x, y, o.dither);
    };
  };

  // ---------- palettes for food ----------
  const RP = {
    brown: R(["#1c0a04", "#341508", "#52230e", "#743618", "#984e24", "#ba6c34", "#d8904e"]),
    beef: R(["#1e0806", "#36100a", "#521a10", "#6e2a18", "#8c3e22", "#aa5830", "#c87842"]),
    carrot: R(["#5a1a04", "#8a3008", "#c0500e", "#e07418", "#f4a040", "#ffc878"]),
    potato: R(["#6a4416", "#9a6a26", "#c4923a", "#e0b45a", "#f2d084", "#fff0c0"]),
    turnip: R(["#6a5a3a", "#9a8a62", "#c4b68a", "#e4d8b0", "#f8f0d8", "#ffffff"]),
    mushroom: R(["#3a2210", "#5e3a1a", "#86562a", "#ac7a40", "#cca064", "#ecca94"]),
    pale: R(["#5a5040", "#8a7e66", "#b4a88c", "#d8ceb2", "#f2ead6", "#ffffff"]),
    bean: R(["#2a0a08", "#4a1410", "#6e2018", "#902e22", "#b0442e", "#cc6444"]),
    green: R(["#0e1c08", "#1c3410", "#2e5018", "#467024", "#629436", "#8cbc52", "#b8dc80"]),
    red: R(["#3a0404", "#6a0a08", "#9a160e", "#c82a16", "#e8502a", "#ff8a50"]),
    yolk: R(["#8a4a04", "#c07408", "#e89a14", "#f8c030", "#ffe070", "#fff6c0"]),
    white: R(["#8a8070", "#b4aa98", "#d8d0c0", "#efe8dc", "#fffaf2", "#ffffff"]),
    rice: R(["#8a7448", "#b49c68", "#d4c08c", "#ecdcac", "#faf0d0", "#ffffff"]),
    saffron: R(["#7a3e04", "#a85c08", "#d0820e", "#eca420", "#fcc844", "#ffe48a"]),
    sausage: R(["#2a0c06", "#4a160a", "#6e2410", "#90381a", "#b05228", "#cc7038"]),
    pink: R(["#5a1a1c", "#8a2e2e", "#b04a44", "#cc6a5c", "#e48c7a", "#f6b09c"]),
    shellR: R(["#3a0804", "#6a1206", "#9a220a", "#c8380e", "#e85a1c", "#ff8a3a", "#ffc080"]),
    crumb: R(["#4a2208", "#7a3c10", "#a85e1e", "#cc8434", "#e8aa54", "#f8d08a"]),
    crust: R(["#3a1a06", "#5e2e0c", "#8a4a16", "#b06a24", "#d08c3a", "#eab060", "#f8d08e"]),
    berry: R(["#0a0410", "#1a0a1a", "#2e1020", "#4a1428", "#6a1e30", "#8a3040"]),
    bramble: R(["#08040a", "#140a12", "#22101a", "#341824", "#4a2230", "#663040"]),
    honey: R(["#5a2a04", "#8a4806", "#b8700c", "#e09a1c", "#f8c038", "#ffe48a"]),
    cream: R(["#a8906a", "#cbb48a", "#e6d4ae", "#f6ead0", "#fff8ea", "#ffffff"]),
    custard: R(["#9a6a14", "#c8921e", "#e8b432", "#f8d050", "#ffe88a", "#fff6c8"]),
    jelly: R(["#0a2a14", "#14482a", "#226a3e", "#36905a", "#58b878", "#90dca0", "#d0fad8"]),
    ice: R(["#2a4a6a", "#4a7a9e", "#7aa8c8", "#a8cce2", "#d4ecf8", "#ffffff"]),
    fish: R(["#6a4a3a", "#9a7258", "#c49a7a", "#e2bea0", "#f4dcc4", "#fff4e4"]),
    salmon: R(["#6a1e0e", "#a03a1a", "#cc5a2a", "#e8803e", "#f8a462", "#ffc890"]),
    gold: R(["#4a2804", "#7a4808", "#b07414", "#d89c2a", "#f2c454", "#ffe490"]),
    choc: R(["#120604", "#24100a", "#3a1c10", "#523018", "#6e4626"]),
  };

  // ---------- the bits ----------
  const BIT = {
    meat: (x, y, r, look, sd) => {
      const ang = sd * 0.7, ca = Math.cos(ang), sa = Math.sin(ang), rp = look.chunk || RP.brown;
      return blob(x, y, r, r * 0.78, r * 0.7, (xx, yy, i) => {
        const along = (xx - x) * ca + (yy - y) * sa, across = -(xx - x) * sa + (yy - y) * ca;
        const fib = Math.sin(across * 1.9 + fbm(along / 3, across / 2, sd) * 3) > 0.55 ? -0.16 : 0;
        if (i.spec > 0.5 && !i.edge) return i.spec > 0.75 ? "#ffe4c0" : ramp(rp, 0.95, xx, yy);
        return ramp(rp, 0.2 + i.diff * 0.75 + fib - i.ao * 0.5 - (i.under ? 0.2 : 0), xx, yy, 0.5);
      }, { wob: [[3, 0.14, sd], [4, 0.08, sd * 2]], seed: sd, rough: r * 0.12, scale: 3, k: 14, pow: 0.45 });
    },
    carrot: (x, y, r, look, sd) => blob(x, y, r * 0.8, r * 0.6, r * 0.45, (xx, yy, i) => {
      const d = Math.hypot((xx - x) / (r * 0.8), (yy - y) / (r * 0.6));
      if (i.spec > 0.6) return "#fff0d0";
      return ramp(RP.carrot, 0.25 + i.diff * 0.7 + (Math.abs(d - 0.55) < 0.12 ? 0.18 : 0), xx, yy);
    }, { pow: 0.25, k: 22 }),
    potato: (x, y, r, look, sd) => blob(x, y, r, r * 0.8, r * 0.7, shade(look.potato || RP.potato, { noise: 0.25, seed: sd }), { wob: [[4, 0.12, sd]], pow: 0.3, seed: sd }),
    mushroom: (x, y, r, look, sd) => {
      const half = sd % 3 === 0, cap = look.cap || RP.mushroom;
      if (half) return blob(x, y, r, r * 0.9, r * 0.5, (xx, yy, i) => {
        const u = (xx - x) / r, v = (yy - y) / (r * 0.9), capPart = v < 0.05 && Math.hypot(u, v * 1.6) < 1, stem = Math.abs(u) < 0.28 && v >= -0.1;
        if (!capPart && !stem) return null;
        if (capPart && Math.hypot(u, v * 1.6) > 0.78) return ramp(cap, 0.25 + i.diff * 0.6, xx, yy);
        return ramp(R(["#8a7458", "#b49a78", "#d4bea0", "#ece0c8", "#fbf4e6"]), 0.3 + i.diff * 0.6 - (capPart && v > -0.25 ? 0.25 : 0), xx, yy);
      }, { pow: 0.15, k: 20 });
      return blob(x, y, r, r * 0.78, r * 0.75, (xx, yy, i) => {
        if (i.spec > 0.55) return "#fbe8c8";
        const d = Math.hypot((xx - x) / r, (yy - y) / (r * 0.78));
        return ramp(cap, 0.08 + i.diff * 0.72 + (d > 0.82 ? 0.25 : 0) + (fbm(xx / 2, yy / 2, sd) - 0.5) * 0.2 - i.ao * 0.4, xx, yy);
      }, { pow: 0.7, seed: sd, k: 16, wob: [[3, 0.06, sd]] });
    },
    bean: (x, y, r, look, sd) => blob(x, y, r, r * 0.6, r * 0.6, shade(look.bean || RP.bean, { glint: 0.45 }), { wob: [[2, 0.15, sd]], k: 24 }),
    sausage: (x, y, r, look, sd) => blob(x, y, r, r * 0.75, r * 0.4, (xx, yy, i) => {
      const d = Math.hypot((xx - x) / r, (yy - y) / (r * 0.75));
      if (d > 0.78) return ramp(RP.sausage, 0.2 + i.diff * 0.7, xx, yy);
      if (i.spec > 0.6) return "#ffe0d0";
      return ramp(RP.pink, 0.3 + i.diff * 0.5 + (h2(xx, yy, sd) > 0.85 ? 0.3 : 0), xx, yy);
    }, { pow: 0.2, k: 20 }),
    onion: (x, y, r, look, sd) => blob(x, y, r, r * 0.6, r * 0.3, (xx, yy, i) => {
      const d = Math.hypot((xx - x) / r, (yy - y) / (r * 0.6));
      if (d < 0.55) return null;
      return i.spec > 0.5 ? "#ffffff" : ramp(R(["#8a7a50", "#b8a878", "#dcd0a4", "#f2ead0", "#fffcf0"]), 0.15 + i.diff * 0.7 + (d > 0.85 ? 0.2 : 0), xx, yy);
    }, { wob: [[2, 0.1, sd]], k: 30, base: 1.5 }),
    pepper: (x, y, r, look, sd) => blob(x, y, r, r * 0.45, r * 0.4, shade(look.pepperC || RP.red, { glint: 0.4, hi: "#ffe8d8" }), { wob: [[2, 0.25, sd]], k: 30 }),
    leafy: (x, y, r, look, sd) => blob(x, y, r, r * 0.6, r * 0.25, (xx, yy, i) => (Math.abs((yy - y) - (xx - x) * 0.3) < 0.5 ? "#c8e090" : ramp(look.leaf || RP.green, 0.25 + i.diff * 0.7, xx, yy)), { wob: [[2, 0.3, sd], [5, 0.12, sd]], seed: sd, k: 30 }),
    pea: (x, y, r, look, sd) => blob(x, y, r, r, r, shade(look.pea || RP.green, { base: 0.2, glint: 0.4 }), { k: 30 }),
    berry: (x, y, r, look, sd) => blob(x, y, r, r * 0.9, r, shade(look.berryC || RP.berry, { base: 0.15, k: 0.9, glint: 0.35, hi: "#f0e0ff" }), { k: 40 }),
    egg: (x, y, r, look, sd) => blob(x, y, r * 0.55, r * 0.45, r * 0.6, shade(RP.yolk, { base: 0.25, glint: 0.4 }), { k: 30 }),
    crouton: (x, y, r, look, sd) => blob(x, y, r, r * 0.8, r * 0.6, shade(RP.crumb, { noise: 0.4, seed: sd }), { wob: [[4, 0.1, sd]], pow: 0.2, seed: sd }),
    juniper: (x, y, r, look, sd) => blob(x, y, r, r, r, (xx, yy, i) => (i.spec > 0.4 ? "#c8d4e0" : ramp(R(["#06080e", "#0e1420", "#1a2434", "#2e3a4e", "#4a5a70"]), 0.15 + i.diff * 0.8, xx, yy)), { k: 30 }),
    barley: (x, y, r, look, sd) => blob(x, y, r * 1.2, r * 0.7, r * 0.6, shade(RP.rice, { base: 0.3 }), { k: 20 }),
    shrimp: (x, y, r, look, sd) => blob(x, y, r, r * 0.6, r * 0.6, (xx, yy, i) => ramp(RP.salmon, 0.2 + i.diff * 0.7 + ((xx + yy) % 3 === 0 ? 0.15 : 0), xx, yy), { wob: [[1, 0.3, sd]], k: 20 }),
    fishflake: (x, y, r, look, sd) => blob(x, y, r, r * 0.7, r * 0.5, shade(RP.white, { base: 0.15, noise: 0.3, seed: sd }), { wob: [[3, 0.2, sd]], seed: sd }),
  };
  // scatter n bits of the given kinds inside an ellipse, deterministic per seed, larger ones first so the small ones sit on top
  function scatter(cx, cy, rx, ry, list, look, seed, base) {
    const r = rng(seed), out = [];
    for (const [kind, n, size] of list) for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.9, sz = size * (0.75 + r() * 0.5);
      const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d, ob = BIT[kind](x, y, sz, look, Math.floor(r() * 999));
      ob.base = (base || 0) - sz * 0.35 + r() * 0.6;
      item("bit" + out.length + "_" + Math.round(x) + "_" + Math.round(y), x, y, sz, "bit", { bit: kind });
      if (!taken(null, x, y)) out.push(ob);
    }
    return out;
  }

  // ---------- liquids and beds ----------
  // a broth or sauce surface: gentle ripples, a fat sheen, darker where it meets a chunk
  function liquid(cx, cy, rx, ry, level, rp, o) {
    o = o || {};
    const E = ell(cx, cy, rx, ry), sd = o.seed || 0, rip = o.ripple === undefined ? 0.35 : o.ripple, oil = o.oil === undefined ? 0.5 : o.oil;
    return { x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry, k: o.shine || 40, clampN: 1.2,
      hf: (x, y) => (E(x, y) > 1 ? null : level + (fbm(x / 6, y / 3, sd) - 0.5) * rip + Math.sin(x * 0.5 + y * 0.9) * rip * 0.2),
      cf: (x, y, i) => {
        const d = E(x, y), n = fbm(x / 9, y / 5, sd + 3);
        let t = 0.32 + n * 0.32 + (1 - d) * 0.12 - (d > 0.93 ? 0.3 : 0) + i.diff * 0.15 - i.ao * 0.7;
        if (oil && fbm(x / 3.5, y / 2.2, sd + 7) > 1 - oil * 0.32) t += 0.3;
        if (i.spec > 0.55 && i.ao < 0.2) return o.hi || "#fff2d8";
        if (oil) { const bx = Math.floor(x / 7) * 7 + 3.5 + (h2(Math.floor(x / 7), Math.floor(y / 5), sd) - 0.5) * 4, by = Math.floor(y / 5) * 5 + 2.5; if (h2(Math.floor(x / 7), Math.floor(y / 5), sd + 1) < oil * 0.16 && Math.hypot(x - bx, (y - by) * 1.4) < 1.6) return x < bx && y < by ? o.dot || "#ffe0a0" : ramp(rp, 0.85, x, y); }
        return ramp(rp, t, x, y);
      } };
  }
  // a bed of small grains (rice, barley, oats), each a tiny lit oval
  function grains(img, cx, cy, rx, ry, rp, seed, o) {
    o = o || {};
    const r = rng(seed), E = ell(cx, cy, rx, ry), n = Math.floor(rx * ry * (o.density || 1.25));
    const pts = [];
    for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()); pts.push([cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, r() * Math.PI, r()]); }
    pts.sort((a, b) => a[1] - b[1]);
    for (const [x, y, ang, v] of pts) {
      const mound = 1 - E(x, y), tint = o.tint ? o.tint(x, y, v) : null, rr = tint || rp;
      const len = o.len || 2.2, dx = Math.cos(ang), dy = Math.sin(ang) * 0.5;
      for (let k = -len; k <= len; k += 0.5) {
        const px = x + dx * k, py = y + dy * k, edge = Math.abs(k) > len - 0.6;
        img.px(px, py, ramp(rr, 0.35 + mound * 0.25 + (edge ? -0.15 : 0.1) + (v - 0.5) * 0.3 - (py - y) * 0.2, Math.floor(px), Math.floor(py)));
      }
      img.px(x - dx * 0.5, y - 1, ramp(rr, 0.95, Math.floor(x), Math.floor(y)));
    }
  }

  // ---------- vessels ----------
  const WOODB = R(["#1a0c06", "#2e180c", "#462614", "#5e3820", "#7a4e2e", "#9a6a40", "#b88a58"]);
  const CLAY = R(["#2a0e06", "#4a1c0c", "#6e3016", "#904422", "#b05e32", "#cc7c48", "#e4a06a"]);
  const PEWTER = R(["#141418", "#26262c", "#3c3c44", "#56565e", "#76767e", "#9a9aa2", "#c8c8ce"]);
  const IRONV = R(["#060608", "#0e0e12", "#18181e", "#24242c", "#34343e", "#4e4e58", "#6e6e78"]);
  const WARE = { wood: WOODB, clay: CLAY, pewter: PEWTER, iron: IRONV, glaze: R(["#0e1a1e", "#18303a", "#244a56", "#346472", "#4a808c", "#6aa0a8", "#98c4c4"]), bone: R(["#4a4232", "#7a6e56", "#a89a7c", "#cec0a0", "#ece0c4", "#fffaea"]) };
  // a bowl in three-quarter view: the outside below the rim, the rim's lip, the inner wall; returns the ellipse the food fills
  function bowl(img, cx, cy, rx, ry, depth, ware, o) {
    o = o || {};
    const rp = WARE[ware] || WARE.clay, E = ell(cx, cy, rx, ry), lay = new Img(W, H);
    for (let y = Math.floor(cy); y < cy + ry + depth + 2; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const nx = (x - cx) / rx, w = Math.sqrt(Math.max(0, 1 - nx * nx)), bottom = cy + w * ry + depth * Math.pow(w, 0.6) * (o.foot ? 0.85 : 1);
      if (y < cy + w * ry - 1 || y > bottom || Math.abs(nx) > 1) continue;
      const v = (y - (cy + w * ry)) / Math.max(1, bottom - (cy + w * ry));
      let t = 0.5 - nx * 0.38 - v * 0.35 + (fbm(x / 4, y / 6, 3) - 0.5) * 0.15;
      if (o.band && Math.abs(v - 0.3) < 0.08) t += 0.25;
      if (ware === "wood" && (x * 3 + Math.floor(y / 2)) % 7 === 0) t -= 0.15;
      lay.px(x, y, ramp(rp, t, x, y));
    }
    if (o.foot) for (let x = Math.floor(cx - rx * 0.5); x <= cx + rx * 0.5; x++) for (let j = 0; j < 4; j++) { const nx = (x - cx) / (rx * 0.5); if (Math.abs(nx) <= 1) lay.px(x, cy + ry + depth * 0.85 + j, ramp(rp, 0.3 - nx * 0.3 - j * 0.08, x, cy + ry + depth + j)); }
    hrender(lay, [cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1], (x, y) => { const d = E(x, y); return d > 1 ? null : d < 0.88 ? 0 : (1 - Math.abs(d - 0.94) / 0.06) * 2; }, (x, y, i) => {
      const d = E(x, y), ang = Math.atan2((y - cy) / ry, (x - cx) / rx);
      if (d >= 0.88) return ramp(rp, 0.45 + i.diff * 0.5 + (i.spec > 0.5 ? 0.3 : 0), x, y);
      return ramp(rp, 0.12 + (Math.sin(ang) < 0 ? 0.25 - (0.88 - d) * 0.6 : 0.05) + 0.15 * Math.cos(ang + 2.3), x, y);
    });
    outline(lay, "#0a0604");
    img.paste(lay, 0, 0);
    return { cx, cy: cy + ry * 0.06, rx: rx * 0.86, ry: ry * 0.8 };
  }
  // a flat plate or platter with a lip
  function platter(img, cx, cy, rx, ry, ware, o) {
    o = o || {};
    const rp = WARE[ware] || WARE.pewter, E = ell(cx, cy, rx, ry), lay = new Img(W, H);
    for (let y = Math.floor(cy); y < cy + ry + 6; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (E(x + 0.5, y + 0.5) > 1 && ell(cx, cy + 4, rx * 0.98, ry)(x + 0.5, y + 0.5) <= 1) lay.px(x, y, ramp(rp, 0.2 - (x - cx) / rx * 0.2, x, y));
    hrender(lay, [cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1], (x, y) => { const d = E(x, y); return d > 1 ? null : d > 0.78 ? (1 - d) * 6 + 1 : 0.3; }, (x, y, i) => {
      const d = E(x, y);
      if (d > 0.78) return ramp(rp, 0.3 + i.diff * 0.55 + (i.spec > 0.6 ? 0.3 : 0), x, y);
      return ramp(rp, 0.4 + (fbm(x / 20, y / 10, 2) - 0.5) * 0.2 - (y - cy) / ry * 0.08 + (o.rim && d > 0.74 ? 0.3 : 0), x, y);
    }, { k: 30 });
    outline(lay, "#0a0604");
    img.paste(lay, 0, 0);
  }
  // the dark table under the close-ups: planks, a warm light from the upper left, bokeh above
  function tableBack(seed, o) {
    o = o || {};
    const img = new Img(W, H, "#0a0605"), tr = o.wood || R(["#0e0805", "#180e08", "#24160c", "#322012", "#422a18"]);
    img.fill((x, y) => {
      const plank = Math.floor((y + 3) / 22), seam = (y + 3) % 22 === 0, g = Math.sin(x * 0.05 + plank * 3 + fbm(x / 30, y / 4, plank) * 5) * 0.12;
      const lt = Math.max(0, 1 - Math.hypot((x - 80) / 220, (y - 30) / 160));
      if (seam) return tr[0];
      return pick(tr, 0.1 + lt * 0.8 + g + (fbm(x / 12, y / 3, seed) - 0.5) * 0.2, x, y);
    });
    if (o.cloth) {
      const cr = R(o.cloth);
      img.fill((x, y) => { const d = Math.hypot((x - 120) / 150, (y - 100) / 80); if (d > 1) return null; const ch = ((Math.floor(x / 10) + Math.floor(y / 6)) % 2) ? 0.15 : 0; return pick(cr, 0.25 + (1 - d) * 0.45 + ch, x, y); });
    }
    bokeh(img, seed, 18, ["#ff9a3a", "#ffc060", "#e0602a"], [0, 0, W, 40], [2, 7], [0.06, 0.16]);
    return img;
  }

  // ---------- the pot plates: stew, soup, porridge, pilaf ----------
  function potServe(spec, o, fill) {
    const look = spec.look, img = tableBack(o.seed || 3, { cloth: look.cloth });
    shadow(img, 122, 128, 112, 18, 0.55, "#000000");
    const v = look.vessel || "bowl";
    let f;
    if (v === "bucket") f = bucket(img, 120, 66, 74, 26, 52);
    else if (v === "cauldron") f = cauldron(img, 120, 70, 88, 32, 50);
    else if (v === "skillet") { B.skilletWide(img, 120, 82, 92, 34, 0); f = { cx: 120, cy: 82, rx: 82, ry: 28 }; }
    else if (v === "platter") { platter(img, 120, 90, 116, 50, look.ware || "pewter", { rim: true }); f = { cx: 120, cy: 86, rx: 92, ry: 36 }; }
    else f = bowl(img, 120, 76, look.bowlRx || 114, look.bowlRy || 48, look.depth || 26, look.ware || "clay", { foot: look.foot, band: look.band });
    geo("f", f); geo("vessel", v);
    // each spoonful taken drops the level a little: the top band of the stew gives way to the pot's wet inside, cutting off whatever
    // floated there, and nothing else in the pot moves
    const eat = K.eating(), dz = eat ? eat.zones.length : 0, pot = dz ? img.copy() : null;
    fill(img, f, o.burnt);
    if (dz) {
      const L = ell(f.cx, f.cy + dz * 2.2, f.rx * (1 - dz * 0.04), f.ry * (1 - dz * 0.04)), O = ell(f.cx, f.cy - 4, f.rx + 6, f.ry + 6);
      for (let y = Math.floor(f.cy - f.ry - 10); y <= f.cy + f.ry; y++) for (let x = Math.floor(f.cx - f.rx - 6); x <= f.cx + f.rx + 6; x++) {
        if (O(x + 0.5, y + 0.5) > 1 || L(x + 0.5, y + 0.5) <= 1) continue;
        const q = pot.get(x, y);
        if (q) img.px(x, y, mix(q, "#1a0c06", L(x + 0.5, y + 1.5) <= 1 ? 0.45 : 0.15));
      }
    }
    if (!o.burnt) potExtras(img, f, look, o.seed || 1);
    if (look.spoon) spoon(img, f.cx + f.rx * 0.55, f.cy - f.ry * 0.2);
    return img;
  }
  function bucket(img, cx, cy, rx, ry, depth) {
    const lay = new Img(W, H);
    for (let y = Math.floor(cy); y < cy + depth + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x - cx) / rx, w = Math.sqrt(Math.max(0, 1 - nx * nx)), taper = 1 - (y - cy) / (depth + ry) * 0.12;
      if (Math.abs(nx) > taper || y < cy + w * ry - 1 || y > cy + depth + w * ry * 0.9) continue;
      const stave = Math.floor((nx + 1) * 9), hoop = Math.abs(y - cy - depth * 0.3) < 2 || Math.abs(y - cy - depth * 0.8) < 2;
      lay.px(x, y, hoop ? ramp(IRONV, 0.4 - nx * 0.3, x, y) : ramp(WOODB, 0.45 - nx * 0.35 + (stave % 2 ? 0.08 : -0.05) + (Math.abs((nx + 1) * 9 - stave - 0.5) > 0.42 ? -0.25 : 0), x, y));
    }
    const E = ell(cx, cy, rx, ry);
    lay.fill((x, y) => { const d = E(x + 0.5, y + 0.5); return d <= 1 && d > 0.9 ? ramp(WOODB, 0.6 - (x - cx) / rx * 0.3, x, y) : d <= 0.9 ? ramp(WOODB, 0.1, x, y) : null; }, cx - rx, cy - ry, cx + rx + 1, cy + ry + 1);
    for (let k = 0; k <= 40; k++) { const a = Math.PI + (k / 40) * Math.PI, x = cx + Math.cos(a) * rx * 1.02, y = cy - 26 + Math.sin(a) * -1 * 0 - Math.sin((k / 40) * Math.PI) * 20; lay.px(x, y, "#3a3a42"); lay.px(x, y + 1, "#18181e"); }
    outline(lay, "#060403");
    img.paste(lay, 0, 0);
    return { cx, cy: cy + 2, rx: rx * 0.88, ry: ry * 0.8 };
  }
  function cauldron(img, cx, cy, rx, ry, depth) {
    const lay = new Img(W, H);
    for (let y = Math.floor(cy); y < cy + ry + depth; y++) for (let x = Math.floor(cx - rx * 1.08); x <= cx + rx * 1.08; x++) {
      const v = (y - cy) / (ry + depth), bulge = 1 + Math.sin(Math.min(1, v * 1.3) * Math.PI) * 0.08, nx = (x - cx) / (rx * bulge);
      if (Math.abs(nx) > 1 || y < cy + Math.sqrt(1 - Math.min(1, ((x - cx) / rx) ** 2)) * ry - 1) continue;
      const bot = cy + ry + depth - (1 - Math.sqrt(1 - nx * nx)) * depth * 0.6;
      if (y > bot) continue;
      lay.px(x, y, ramp(IRONV, 0.45 - nx * 0.4 - v * 0.2 + (h2(x, y, 4) > 0.93 ? 0.2 : 0), x, y));
    }
    const E = ell(cx, cy, rx, ry);
    lay.fill((x, y) => { const d = E(x + 0.5, y + 0.5); return d <= 1 && d > 0.9 ? ramp(IRONV, 0.75 - (x - cx) / rx * 0.3, x, y) : d <= 0.9 ? IRONV[0] : null; }, cx - rx, cy - ry, cx + rx + 1, cy + ry + 1);
    outline(lay, "#020202");
    img.paste(lay, 0, 0);
    return { cx, cy: cy + 2, rx: rx * 0.88, ry: ry * 0.82 };
  }
  function spoon(img, x, y) {
    const lay = new Img(W, H);
    for (let k = 0; k < 46; k++) { const px = x + k * 0.9, py = y - k * 0.55; lay.rect(px, py, 2, 2, ramp(WOODB, 0.5 + (k % 7 === 0 ? 0.15 : 0) - (k > 40 ? 0.2 : 0), Math.floor(px), Math.floor(py))); lay.px(px, py, ramp(WOODB, 0.8, 0, 0)); }
    outline(lay, "#0a0604");
    img.paste(lay, 0, 0);
  }
  const garnishes = (img, f, look, seed) => {
    const r = rng(seed + 31);
    if (look.herbs !== false) for (let i = 0; i < (look.herbN || 30); i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.8, x = f.cx + Math.cos(a) * f.rx * d, y = f.cy + Math.sin(a) * f.ry * d;
      img.px(x, y, look.herbC || "#5a9a34"); if (r() < 0.5) img.px(x + 1, y, "#3a6a24");
    }
    if (look.sprig) herb(img, f.cx + f.rx * 0.25, f.cy - f.ry * 0.3, 1.6, seed);
  };
  function herb(img, x, y, s, seed) {
    const r = rng(seed);
    img.line(x - 8 * s, y + 6 * s, x + 2 * s, y - 2 * s, "#2e5a1c");
    for (let k = 0; k < 6; k++) {
      const t = k / 6, bx = lerp(x - 8 * s, x + 2 * s, t), by = lerp(y + 6 * s, y - 2 * s, t);
      const lf = blob(bx + (k % 2 ? 2 : -2) * s, by - s, 2.2 * s, 1.2 * s, 1.2, shade(RP.green, { base: 0.3 }), { k: 30 });
      scene(img, [lf]);
    }
  }

  // what sits on or beside a pot dish to make it that dish
  function potExtras(img, f, look, seed) {
    const r = rng(seed + 13);
    // the one firepepper: a kobold peppercorn the size of a thumbnail, wrinkled and glowing, not a chilli
    if (look.onePepper) { glow(img, f.cx + 6, f.cy - 6, 16, "#ff6a1a", 0.3); scene(img, [blob(f.cx + 6, f.cy - 6, 8, 7, 7, (x, y, i) => (i.spec > 0.6 ? "#ffd8c0" : ramp(R(["#2a0402", "#4a0804", "#7a1006", "#b0220c", "#e04a1a", "#ff8a4a"]), 0.15 + i.diff * 0.8, x, y)), { wob: [[5, 0.12, 0.4], [9, 0.06, 1]], k: 30, base: 20 })]); img.px(f.cx + 6, f.cy - 13, "#1a0402"); img.px(f.cx + 7, f.cy - 13, "#3a0a04"); }
    if (look.legs) for (let k = 0; k < 6; k++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.6, x = f.cx + Math.cos(a) * f.rx * d, y = f.cy + Math.sin(a) * f.ry * d; for (const dx of [-4, 3]) for (let j = 0; j < 7; j++) { const lx = x + dx + (j > 5 ? (dx < 0 ? -1 : 1) : 0) + Math.sin(j + k) * 0.5; img.px(lx - 1, y + 6 + j, "#2a1a0e"); img.px(lx, y + 6 + j, j > 5 ? "#6a4a2a" : "#f0e2c4"); img.px(lx + 1, y + 6 + j, "#2a1a0e"); } }
    if (look.bone) { scene(img, [blob(f.cx - f.rx * 0.45, f.cy - f.ry * 0.35, 18, 4, 4, shade(R(["#8a7a5a", "#b4a47e", "#d8caa4", "#efe6cc", "#fffaec"]), { base: 0.3 }), { wob: [[2, 0.12, 1]], k: 20, base: 20 }), blob(f.cx - f.rx * 0.45 - 17, f.cy - f.ry * 0.35 - 2, 5, 4.5, 5, shade(R(["#8a7a5a", "#b4a47e", "#d8caa4", "#efe6cc", "#fffaec"]), { base: 0.3 }), { k: 20, base: 22 })]); }
    if (look.ladle) { const lay = new Img(W, H); for (let k = 0; k < 60; k++) lay.rect(f.cx + f.rx * 0.3 + k * 1.1, f.cy - 10 - k * 0.9, 3, 2, ramp(WOODB, 0.6 - (k % 9 === 0 ? 0.2 : 0), 0, 0)); outline(lay, "#0a0604"); img.paste(lay, 0, 0); }
    if (look.bottle) { const lay = new Img(W, H); scene(lay, [blob(212, 96, 13, 22, 12, (x, y, i) => (y < 80 ? (y < 76 ? "#a01418" : ramp(R(["#0a0a06", "#141a10", "#20281a", "#2e3a26"]), i.diff, x, y)) : i.spec > 0.5 ? "#c8d8c0" : ramp(R(["#060806", "#0e140c", "#18221a", "#243226", "#38483a"]), 0.15 + i.diff * 0.8, x, y)), { pow: 0.8, k: 40 })]); lay.rect(208, 66, 8, 12, "#1a2418"); lay.rect(207, 62, 10, 5, "#a01418"); lay.rect(205, 96, 14, 9, "#e8dcc0"); outline(lay, "#020302"); img.paste(lay, 0, 0); }
    if (look.heel) { const lay = new Img(W, H); scene(lay, [blob(30, 128, 26, 13, 12, (x, y, i) => { const d = Math.hypot((x - 30) / 26, (y - 128) / 13); return d < 0.7 && x > 34 ? ramp(R(["#9a8a6a", "#c4b48e", "#e2d4b0", "#f6ecd2"]), 0.3 + i.diff * 0.5 + (h2(x, y, 2) > 0.85 ? -0.3 : 0), x, y) : ramp(BREADS.spice.crust, 0.2 + i.diff * 0.7, x, y); }, { pow: 0.6, k: 16 })]); outline(lay, "#0e0804"); img.paste(lay, 0, 0); }
    if (look.mist) for (let k = 0; k < 5; k++) { const x = f.cx - f.rx * 0.8 + k * f.rx * 0.4, y = f.cy - 4 - (k % 2) * 6; glow(img, x, y, 30, "#dfe8e4", 0.3, 9, 5); }
  }
  function hashCake(img, f, burnt, seed) {
    geo("mound", { cx: f.cx, cy: f.cy, rx: f.rx * 0.92, ry: f.ry * 0.9, h: 9 });
    const crust = burnt ? BURNT : R(["#2a1206", "#4a220c", "#703614", "#985020", "#bc6e30", "#d89048", "#f0b468"]);
    scene(img, [blob(f.cx, f.cy, f.rx * 0.92, f.ry * 0.9, 9, (x, y, i) => {
      const n = fbm(x / 3, y / 2.5, seed), bit = h2(Math.floor(x / 4), Math.floor(y / 3), seed);
      if (!burnt && bit > 0.86) return ramp(RP.potato, 0.4 + i.diff * 0.6, x, y);
      if (!burnt && bit < 0.05) return ramp(RP.red, 0.4, x, y);
      if (i.spec > 0.6 && !burnt) return "#ffe8b0";
      return ramp(crust, 0.1 + i.diff * 0.7 + (n - 0.5) * 0.6 - i.ao * 0.3, x, y);
    }, { wob: [[5, 0.05, 1], [9, 0.03, 2]], rough: 4, scale: 2, seed, pow: 0.25, k: 20 })]);
    if (!burnt) for (let i = 0; i < 40; i++) { const r = rng(seed + i); img.px(f.cx + (r() - 0.5) * f.rx * 1.6, f.cy + (r() - 0.5) * f.ry * 1.4, "#4a8a2a"); }
  }
  function liarSoup(img, f, burnt, seed) {
    const E = ell(f.cx, f.cy, f.rx, f.ry);
    const hot = burnt ? BURNT : R(["#3a0604", "#620e06", "#8e1e0c", "#b83818", "#d85a28", "#f08840"]), cold = burnt ? BURNT : R(["#0e2236", "#1a3a56", "#2e5a7c", "#4a80a0", "#7aaac4", "#b8d8e8"]);
    scene(img, [{ x0: f.cx - f.rx, y0: f.cy - f.ry, x1: f.cx + f.rx, y1: f.cy + f.ry, k: 40, clampN: 1.2,
      hf: (x, y) => (E(x, y) > 1 ? null : (fbm(x / 6, y / 3, seed) - 0.5) * 0.4),
      cf: (x, y, i) => {
        const side = (x - f.cx) + Math.sin((y - f.cy) * 0.18) * 22 - (y - f.cy) * 0.6, edge = Math.abs(side) < 2.5;
        if (edge) return "#f0e0c8";
        if (i.spec > 0.6) return "#ffffff";
        const rp = side > 0 ? hot : cold, d = E(x, y);
        if (side < 0 && h2(x, y, seed) > 0.97) return "#ffffff";
        if (side > 0 && h2(x, y, seed + 1) > 0.97) return "#ffd27a";
        return ramp(rp, 0.3 + fbm(x / 8, y / 4, seed + 2) * 0.35 + (1 - d) * 0.15 - (d > 0.93 ? 0.3 : 0), x, y);
      } }]);
    if (!burnt) { for (let i = 0; i < 6; i++) star(img, f.cx - f.rx * 0.6 + (i % 3) * 14, f.cy - 8 + Math.floor(i / 3) * 12, "#e8f6ff", 1); scene(img, [blob(f.cx + f.rx * 0.45, f.cy, 10, 4, 5, (x, y, i) => (i.spec > 0.5 ? "#ffe0d0" : ramp(RP.red, 0.2 + i.diff * 0.8, x, y)), { wob: [[1, 0.35, 0.4]], k: 30, base: 10 })]); }
  }
  const STEW_BITS = {
    wolf: [["meat", 13, 13], ["carrot", 9, 9], ["mushroom", 6, 8], ["potato", 5, 10]],
    beef: [["meat", 14, 13], ["carrot", 8, 9], ["potato", 8, 10], ["onion", 5, 8]],
    pepper: [["meat", 10, 12], ["pepper", 14, 11], ["onion", 6, 8], ["bean", 12, 5]],
    hotpot: [["meat", 8, 12], ["onion", 6, 8]],
    mushroom: [["mushroom", 22, 10], ["potato", 5, 9], ["leafy", 6, 7]],
    sausage: [["sausage", 14, 10], ["bean", 40, 5], ["onion", 5, 7]],
    chili: [["bean", 70, 5.2], ["meat", 8, 9], ["pepper", 5, 7]],
    wine: [["meat", 14, 14], ["mushroom", 7, 8], ["onion", 8, 7]],
    hash: [["potato", 26, 9], ["meat", 9, 7], ["onion", 8, 7]],
  };
  PLATES_ADD();
  function PLATES_ADD() {
    const PL = FA.PLATES;
    PL.stew = {
      piece: (spec) => ({ draw(img, o) { stewContents(img, o.f, spec, o.stage, o.seed); } }),
      serve: (spec, o) => potServe(spec, o, (img, f, burnt) => stewContents(img, f, spec, burnt ? "burnt" : "cook", o.seed || 1)),
    };
    PL.soup = {
      piece: (spec) => ({ draw(img, o) { soupContents(img, o.f, spec, o.stage, o.seed); } }),
      serve: (spec, o) => potServe(spec, o, (img, f, burnt) => soupContents(img, f, spec, burnt ? "burnt" : "cook", o.seed || 1)),
    };
    PL.porridge = {
      piece: (spec) => ({ draw(img, o) { porridgeContents(img, o.f, spec, o.stage, o.seed); } }),
      serve: (spec, o) => potServe(spec, o, (img, f, burnt) => porridgeContents(img, f, spec, burnt ? "burnt" : "cook", o.seed || 1)),
    };
    PL.pilaf = {
      piece: (spec) => ({ draw(img, o) { pilafContents(img, o.f, spec, o.stage, o.seed); } }),
      serve: (spec, o) => potServe(Object.assign({}, spec, { look: Object.assign({ vessel: "platter" }, spec.look) }), o, (img, f, burnt) => pilafContents(img, f, spec, burnt ? "burnt" : "cook", o.seed || 1)),
    };
  }
  function stewContents(img, f, spec, stage, seed) {
    if (spec.look.hash && stage !== "raw") return hashCake(img, f, stage === "burnt", seed);
    const look = spec.look, bits = look.bits || STEW_BITS[spec.pal] || STEW_BITS.beef, burnt = stage === "burnt", raw = stage === "raw";
    const brothR = burnt ? R(["#0a0c06", "#141a0c", "#1e2a12", "#2c3e18", "#3e5420"]) : look.broth || RP.brown;
    if (look.broth && !look.chunk) look.chunk = mix3(look.broth);
    const sear = stage === "sear", lv = raw ? -4 : sear ? -5 : 2;
    const objs = [liquid(f.cx, f.cy, f.rx, f.ry, lv, sear ? R(["#1a0c04", "#2e1608", "#46240e", "#603616", "#7a4a1e"]) : brothR, { seed, oil: raw ? 0.1 : sear ? 1 : 0.55 })];
    const L = burnt ? Object.assign({}, look, { chunk: BURNT, cap: BURNT }) : raw ? Object.assign({}, look, { chunk: R(["#3a0a12", "#5e1220", "#86202e", "#a8323c", "#c84a4e"]) }) : look;
    const sz = f.rx / 90;
    objs.push(...scatter(f.cx, f.cy, f.rx, f.ry, bits.map(([k, n, s]) => [k, n, s * sz]), L, seed + 1, lv));
    if (look.roof && !raw) objs.push(...roof(f, look, seed, burnt));
    scene(img, objs);
    if (!burnt && !raw) garnishes(img, f, look, seed);
    if (look.topper && !raw) look.topper(img, f, burnt, seed);
    if (burnt) for (let i = 0; i < 60; i++) { const r = rng(seed + i); img.px(f.cx + (r() - 0.5) * f.rx * 1.6, f.cy + (r() - 0.5) * f.ry * 1.6, r() < 0.5 ? "#5a8a3a" : "#0a0a06"); }
  }
  // the rampart hotpot's roof of thin turnip slices, laid like shingles, the edges crisped
  function mix3(rp) { return rp.map((c, i) => mix(c, RP.brown[Math.min(RP.brown.length - 1, i + 1)], 0.6)); }
  function roof(f, look, seed, burnt) {
    const out = [], r = rng(seed + 9), rows = 7;
    for (let row = 0; row < rows; row++) {
      const v = -0.82 + row * 0.27, w = Math.sqrt(Math.max(0, 1 - v * v)), n = Math.max(2, Math.round(w * 7));
      for (let k = 0; k < n; k++) {
        const x = f.cx + (k - (n - 1) / 2) * f.rx * 0.24 + (row % 2 ? f.rx * 0.06 : 0) + (r() - 0.5) * 2, y = f.cy + v * f.ry, rx = f.rx * 0.17, ry = f.ry * 0.24;
        if (taken(null, x, y)) continue;
        out.push(blob(x, y, rx, ry, 2, (xx, yy, i) => {
          const d = Math.hypot((xx - x) / rx, (yy - y) / ry);
          if (burnt) return ramp(BURNT, 0.2 + i.diff * 0.6, xx, yy);
          if (d > 0.8) return ramp(R(["#3a1806", "#5e2a0c", "#8a4616", "#b06424", "#d08a3c"]), 0.25 + i.diff * 0.6 + (h2(xx, yy, k) > 0.7 ? -0.2 : 0), xx, yy);
          if (Math.abs(d - 0.5) < 0.05) return ramp(RP.turnip, 0.2, xx, yy);
          return ramp(RP.turnip, 0.25 + i.diff * 0.65 - (yy - y) / ry * 0.15, xx, yy);
        }, { pow: 0.15, base: 6 + row * 1.2 + k * 0.05, k: 20, ao: false }));
      }
    }
    return out;
  }
  function soupContents(img, f, spec, stage, seed) {
    if (spec.look.liar && stage !== "raw") return liarSoup(img, f, stage === "burnt", seed);
    const look = spec.look, burnt = stage === "burnt", raw = stage === "raw";
    const rp = burnt ? R(["#0a0c06", "#141a0c", "#22301a", "#34482a", "#4a6238"]) : look.broth || R(["#5a3a14", "#7a5220", "#9a6c30", "#b88a44", "#d4a85e", "#ecc882"]);
    const objs = [liquid(f.cx, f.cy, f.rx, f.ry, 1, rp, { seed, oil: look.oil === undefined ? 0.3 : look.oil, ripple: 0.25, hi: look.hi, dot: look.dot })];
    const bits = look.bits || [["potato", 6, 5], ["fishflake", 6, 5], ["leafy", 3, 3]];
    const sz = f.rx / 90;
    if (!raw || look.rawBits) objs.push(...scatter(f.cx, f.cy, f.rx * 0.9, f.ry * 0.9, bits.map(([k, n, s]) => [k, n, s * sz]), burnt ? Object.assign({}, look, { chunk: BURNT }) : look, seed + 1, 0.5));
    scene(img, objs);
    if (!burnt) garnishes(img, f, Object.assign({ herbN: 40 }, look), seed);
    if (look.topper) look.topper(img, f, burnt, seed, stage);
  }
  function porridgeContents(img, f, spec, stage, seed) {
    const look = spec.look, burnt = stage === "burnt", raw = stage === "raw";
    geo("mound", { cx: f.cx, cy: f.cy, rx: f.rx, ry: f.ry, h: 5 });
    if (raw) { scene(img, [liquid(f.cx, f.cy, f.rx, f.ry, 0, R(["#5a5040", "#7a705c", "#9a907a", "#b8ae96"]), { seed, oil: 0 })]); grains(img, f.cx, f.cy, f.rx * 0.8, f.ry * 0.7, RP.rice, seed, { density: 0.5, len: 1.5 }); return; }
    const rp = burnt ? BURNT : R(["#7a6040", "#9c8258", "#bca274", "#d6be92", "#eadab4", "#f8f0dc"]);
    const E = ell(f.cx, f.cy, f.rx, f.ry);
    scene(img, [{ x0: f.cx - f.rx, y0: f.cy - f.ry, x1: f.cx + f.rx, y1: f.cy + f.ry, k: 14, hf: (x, y) => (E(x, y) > 1 ? null : (fbm(x / 7, y / 4, seed) - 0.5) * 6 + (1 - E(x, y)) * 4),
      cf: (x, y, i) => (i.spec > 0.75 ? "#fffaf0" : h2(Math.floor(x / 2), y, seed) > 0.8 ? ramp(rp, 0.35 + i.diff * 0.6, x, y) : ramp(rp, 0.2 + i.diff * 0.6 + (fbm(x / 2.5, y / 1.8, seed) - 0.5) * 0.4, x, y)) }]);
    if (!burnt) {
      const hx = f.cx + 6, hy = f.cy - 2, HE = ell(hx, hy, f.rx * 0.32, f.ry * 0.3, [[3, 0.15, 1], [5, 0.08, 2]], 1);
      scene(img, [{ x0: hx - f.rx * 0.45, y0: hy - f.ry * 0.45, x1: hx + f.rx * 0.45, y1: hy + f.ry * 0.45, k: 50, base: 8, hf: (x, y) => (HE(x, y) > 1 ? null : 1.5 + (1 - HE(x, y)) * 0.8), cf: (x, y, i) => (i.spec > 0.5 ? "#fffbe8" : ramp(RP.honey, 0.35 + (1 - HE(x, y)) * 0.5 + i.diff * 0.2, x, y)) }]);
      scene(img, scatter(f.cx - f.rx * 0.2, f.cy + 2, f.rx * 0.6, f.ry * 0.6, [["berry", 9, 3.6]], { berryC: R(["#1a0a20", "#2e1438", "#3e2a5a", "#5a4a86", "#8a7ab0"]) }, seed + 4, 10));
      for (let i = 0; i < 30; i++) { const r2 = rng(seed + 50 + i), a = r2() * TAU, d = Math.sqrt(r2()) * 0.8; img.px(f.cx + Math.cos(a) * f.rx * d, f.cy + Math.sin(a) * f.ry * d, i % 2 ? "#c8964a" : "#8a5a24"); }
      if (look.topper) look.topper(img, f, burnt, seed);
    }
  }
  // a mound of rice: saffron gold with streaks of plain white, the grains lit one by one, studded and topped
  function pilafContents(img, f, spec, stage, seed) {
    const look = spec.look, burnt = stage === "burnt", raw = stage === "raw", toast = stage === "sear";
    const E = ell(f.cx, f.cy, f.rx, f.ry), hmax = raw ? 3 : look.mound || 18;
    geo("mound", { cx: f.cx, cy: f.cy - hmax * 0.35, rx: f.rx * 0.8, ry: f.ry * 0.75, h: hmax });
    const mh = (x, y) => { const d = E(x, y); return d > 1 ? null : Math.pow(1 - d * d, 0.7) * hmax; };
    const gold = burnt ? BURNT : raw || toast ? (toast ? R(["#6a5030", "#9a7c4e", "#c4a46e", "#e0c690", "#f4e2b4", "#fffae8"]) : RP.rice) : look.rice || RP.saffron;
    scene(img, [{ x0: f.cx - f.rx, y0: f.cy - f.ry, x1: f.cx + f.rx, y1: f.cy + f.ry, k: 10, hf: mh, cf: (x, y, i) => ramp(gold, 0.05 + i.diff * 0.55, x, y) }]);
    if (raw) { scene(img, [liquid(f.cx, f.cy, f.rx, f.ry, 2, R(["#4a3a20", "#6a5430", "#8a7044", "#a88c5a"]), { seed, oil: 0.1 })]); grains(img, f.cx, f.cy, f.rx * 0.7, f.ry * 0.6, RP.rice, seed, { density: 0.6 }); return; }
    const r = rng(seed + 11), pts = [], n = Math.floor(f.rx * f.ry * 1.5);
    for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()); pts.push([f.cx + Math.cos(a) * f.rx * d, f.cy + Math.sin(a) * f.ry * d, r() * Math.PI, r()]); }
    pts.sort((a, b) => a[1] - b[1]);
    const white = (x, y) => !burnt && !toast && fbm(x / 13, y / 7, seed + 5) > 0.6;
    for (const [x, y, ang, v] of pts) {
      const h = mh(x, y);
      if (h === null) continue;
      const lift = h * 0.45, gx = ((mh(x + 2, y) || 0) - (mh(x - 2, y) || 0)) / 4, gy = ((mh(x, y + 2) || 0) - (mh(x, y - 2) || 0)) / 4;
      const nn = norm3(-gx, -gy * 1.6, 1), slope = (nn[0] * KEY[0] + nn[1] * KEY[1] + nn[2] * KEY[2]) * 5 - 2.6;
      const rp = burnt ? BURNT : white(x, y) ? RP.rice : v > 0.94 && !toast ? R(["#7a2a08", "#a8400e", "#d05a18", "#f07a2a", "#ff9a4a"]) : gold;
      const dx = Math.cos(ang) * 1.3, dy = Math.sin(ang) * 0.6, lt = 0.42 + slope * 0.14 + (v - 0.5) * 0.25;
      for (let k = -1; k <= 1; k++) img.px(x + dx * k, y - lift + dy * k, ramp(rp, lt + (k === -1 ? 0.18 : k === 1 ? -0.12 : 0), Math.floor(x + k), Math.floor(y)));
      if (v > 0.6) img.px(x - dx, y - lift - 1 + dy * -1, ramp(rp, lt + 0.45, 0, 0));
    }
    if (burnt || toast) return;
    const objs = [];
    for (const [kind, nn, s] of look.pilafBits || [["raisin", 24, 3.2], ["almond", 18, 3.6], ["pea", 14, 2.2]]) for (let i = 0; i < nn; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.85, x = f.cx + Math.cos(a) * f.rx * d, y = f.cy + Math.sin(a) * f.ry * d, h = (mh(x, y) || 0) * 0.45;
      const yy = y - h;
      if (taken(null, x, yy)) { if (kind === "almond") r(); continue; }
      if (kind === "raisin") objs.push(blob(x, yy, s, s * 0.8, s * 0.7, shade(R(["#1a0604", "#2e0e08", "#48180c", "#6a2a14", "#8a3e1e"]), { glint: 0.4, hi: "#e8b890" }), { wob: [[3, 0.2, i]], base: 30, k: 30 }));
      else if (kind === "almond") { const ang = r() * Math.PI; objs.push(blob(x, yy, s * 1.4, s * 0.55, s * 0.5, shade(R(["#7a4e26", "#a46e3c", "#c8945c", "#e6bc86", "#f8e0b0"]), { base: 0.3 }), { wob: [[2, 0.2, ang]], base: 30, k: 20 })); }
      else objs.push(Object.assign(BIT[kind](x, yy, s, look, i), { base: 30 }));
    }
    scene(img, objs);
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.45, x = f.cx + Math.cos(a) * f.rx * d, y = f.cy + Math.sin(a) * f.ry * d - hmax * 0.45, len = 7 + r() * 8, ang = r() * Math.PI;
      for (let k = 0; k < len; k++) { const px = x + Math.cos(ang) * k, py = y + Math.sin(ang) * k * 0.5 + Math.sin(k * 0.8) * 0.8; img.px(px, py, k % 3 ? "#8a4a14" : "#d48a3a"); img.px(px, py + 1, "#4a2008"); }
    }
    const cx = f.cx + 6, cy = f.cy - hmax * 0.55;
    scene(img, [blob(cx + 16, cy - 2, 18, 4.4, 4, (x, y, i) => (Math.abs(y - (cy - 2) - (x - cx - 14) * 0.08) < 0.6 ? "#3a1806" : ramp(R(["#3a1604", "#5e2a0c", "#843e16", "#a85a26", "#c8783a"]), 0.2 + i.diff * 0.7, x, y)), { pow: 0.3, k: 20 })]);
    scene(img, [blob(cx - 12, cy - 1, 14, 5.5, 7, (x, y, i) => (i.spec > 0.5 ? "#ffd8c8" : ramp(RP.red, 0.15 + i.diff * 0.8, x, y)), { wob: [[1, 0.35, 0.3], [2, 0.12, 1]], k: 26 })]);
    for (let k = 0; k < 4; k++) img.px(cx - 20 + k, cy - 2 - k * 0.5, k < 2 ? "#3a5a1a" : "#5a8a2a");
    if (look.topper) look.topper(img, f, burnt, seed);
  }

  // the Hammerhand mixed grill: whatever the butcher had, seared and served on a shield
  function mixedGrill(spec, o) {
    const img = tableBack(o.seed || 21), burnt = o.burnt, look = spec.look;
    shieldDish(img, 120, 92, 114, 50);
    B.slab(img, { cx: 150, cy: 78, rx: 50, ry: 22, thick: 9, s: 1.1, seed: 4, done: 1, glaze: 0.4, burnt, look });
    geo("mound", { cx: 150, cy: 78, rx: 50, ry: 22, h: 9, cut: true }); geo("inside", look.pink || P.pink);
    const objs = [];
    for (let k = 0; k < 2; k++) if (item("g" + k, 70 + k * 4, 70 + k * 18, 22, "sausage", { z: k }), !taken("g" + k)) objs.push(blob(70 + k * 4, 70 + k * 18, 30, 7, 7, (x, y, i) => (burnt ? ramp(BURNT, i.diff, x, y) : i.spec > 0.6 ? "#fff0d8" : ramp(RP.sausage, 0.2 + i.diff * 0.8 + (Math.abs(((x + y * 2) % 10)) < 1 ? -0.4 : 0), x, y)), { wob: [[1, 0.1, k]], k: 30, base: 10 + k }));
    objs.push(...scatter(118, 112, 40, 10, [["mushroom", 6, 8]], look, 5, 6));
    scene(img, objs);
    for (let i = 0; i < 4; i++) steam(img, 70 + i * 30, 70, 40, i * 1.7, 0.4, 4, 3);
    return img;
  }

  // ---------- more vessels and props ----------
  function board2(img, cx, cy, rx, ry, seed, wood) { B.board(img, cx, cy, rx, ry, seed, wood); }
  function stick(img, x0, y0, x1, y1, o) {
    o = o || {};
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)), w = o.w || 2, rp = o.ramp || R(["#2a1606", "#4a2a10", "#6e4420", "#946036", "#b88050"]);
    for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t); for (let k = 0; k < w; k++) img.px(x, y + k, ramp(rp, (k === 0 ? 0.75 : 0.35) - (o.charEnd && t > 0.85 ? 0.5 : 0), Math.floor(x), Math.floor(y))); img.px(x, y + w, "#0a0402", 0.6); }
  }
  // a woven basket in three-quarter view, lined with a cloth
  function basket(img, cx, cy, rx, ry, depth, cloth) {
    const lay = new Img(W, H), rp = R(["#2a1606", "#4a2a10", "#7a4c22", "#a87036", "#cc9a58", "#e8c088"]);
    for (let y = Math.floor(cy); y < cy + ry + depth; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x - cx) / rx, w = Math.sqrt(Math.max(0, 1 - nx * nx)), top = cy + w * ry, bot = top + depth * Math.pow(w, 0.4);
      if (Math.abs(nx) > 1 || y < top - 1 || y > bot) continue;
      const weave = ((Math.floor(x / 3) + Math.floor(y / 3)) % 2) ? 0.15 : -0.1;
      lay.px(x, y, ramp(rp, 0.45 - nx * 0.3 + weave - (y - top) / depth * 0.25 + ((y % 3) === 0 ? -0.15 : 0), x, y));
    }
    const E = ell(cx, cy, rx, ry);
    lay.fill((x, y) => { const d = E(x + 0.5, y + 0.5); if (d > 1) return null; if (d > 0.88) return ramp(rp, 0.7 - (x - cx) / rx * 0.25 + (x % 3 ? 0 : -0.2), x, y); const cr = R(cloth || ["#8a7a64", "#b4a488", "#d8cbb0", "#efe4cc", "#a0281e"]); return (Math.abs(((x - y * 0.5) % 14 + 14) % 14 - 7) < 0.8) ? cr[cr.length - 1] : ramp(cr.slice(0, -1), 0.2 + (1 - d) * 0.6, x, y); }, cx - rx, cy - ry, cx + rx + 1, cy + ry + 1);
    outline(lay, "#0a0402");
    img.paste(lay, 0, 0);
    return { cx, cy: cy + 2, rx: rx * 0.86, ry: ry * 0.8 };
  }
  function mallet(img, x, y) {
    const lay = new Img(W, H);
    stick(lay, x, y, x + 46, y + 18, { w: 3 });
    const E = ell(x - 4, y - 2, 9, 7);
    hrender(lay, [x - 14, y - 10, x + 6, y + 6], (xx, yy) => { const d = E(xx, yy); return d > 1 ? null : Math.sqrt(1 - d * d) * 6; }, (xx, yy, i) => ramp(WOODB, 0.2 + i.diff * 0.8 + (xx % 4 === 0 ? -0.1 : 0), xx, yy));
    outline(lay, "#0a0402");
    img.paste(lay, 0, 0);
  }
  function butterPot(img, x, y) {
    const f = bowl(img, x, y, 16, 7, 9, "pewter");
    scene(img, [liquid(f.cx, f.cy, f.rx, f.ry, 0, R(["#a8742a", "#d8a440", "#f0c858", "#fae088", "#fff6c8"]), { seed: 4, oil: 0.4, ripple: 0.1, hi: "#ffffff" })]);
  }
  function lemon(img, x, y, s) {
    s = s || 1;
    scene(img, [blob(x, y, 7 * s, 4.5 * s, 3 * s, (xx, yy, i) => {
      const d = Math.hypot((xx - x) / (7 * s), (yy - y) / (4.5 * s)), ang = Math.atan2(yy - y, xx - x);
      if (yy > y + 1 && d > 0.15) return Math.abs(Math.sin(ang * 4)) < 0.15 ? "#fff8d8" : d > 0.85 ? "#e8b020" : ramp(R(["#c8a020", "#e8c840", "#f8e070", "#fff4b0"]), 0.3 + i.diff * 0.6, xx, yy);
      return ramp(R(["#8a6a04", "#c09a10", "#e8c22a", "#f8de50", "#fff4a0"]), 0.15 + i.diff * 0.8, xx, yy);
    }, { k: 30 })]);
  }
  function slate(img, cx, cy, w, h) {
    const lay = new Img(W, H);
    for (let y = Math.floor(cy - h / 2); y < cy + h / 2 + 4; y++) for (let x = Math.floor(cx - w / 2 + (y - cy) * 0.2); x < cx + w / 2 + (y - cy) * 0.2; x++) {
      const side = y >= cy + h / 2;
      lay.px(x, y, side ? "#0e1014" : ramp(R(["#14161c", "#1e2128", "#282c34", "#343a44", "#444a56"]), 0.3 + (fbm(x / 9, y / 3, 3) - 0.5) * 0.6 + (h2(x, y, 2) > 0.95 ? 0.3 : 0), x, y));
    }
    outline(lay, "#030304");
    img.paste(lay, 0, 0);
  }
  function plank(img, cx, cy, w, h) {
    const lay = new Img(W, H), rp = R(["#2a2018", "#4a3a2a", "#6e5a44", "#927c60", "#b4a080", "#d4c4a4"]);
    for (let y = Math.floor(cy - h / 2); y < cy + h / 2 + 5; y++) for (let x = Math.floor(cx - w / 2); x < cx + w / 2; x++) {
      const side = y >= cy + h / 2, grain = Math.sin(y * 0.9 + fbm(x / 20, y / 3, 5) * 6) * 0.15;
      lay.px(x, y, side ? ramp(rp, 0.15, x, y) : ramp(rp, 0.45 + grain + (fbm(x / 6, y / 6, 8) - 0.5) * 0.3, x, y));
    }
    outline(lay, "#0a0604");
    img.paste(lay, 0, 0);
  }

  // ---------- roast: a joint, scored and crackled, or on the spit ----------
  const ROASTS = {
    pork: { crust: R(["#2a1004", "#5a2608", "#8a4210", "#b4621e", "#d68a34", "#eeb45a", "#fcdc94"]), inner: R(["#9a5250", "#b4605e", "#c8726c", "#da867e", "#e89c92", "#f4b4a8"]), band: R(["#5e4640", "#786058", "#927870", "#a88e84", "#bca296"]), seams: true, score: true, shape: "shoulder", bone: true },
    boar: { crust: R(["#1e0a04", "#3e1606", "#682a0c", "#924218", "#b86226", "#d88a3e", "#f0b464"]), inner: R(["#5a2418", "#743222", "#8e4230", "#a8563e", "#c06c50", "#d48462"]), band: R(["#3a2418", "#523424", "#6a4434", "#825644", "#986854"]), score: true, apple: true, shape: "rump", bone: true },
    venison: { crust: R(["#140604", "#2a0c06", "#4a1a0a", "#6a2c12", "#8c421c", "#ac5c2a", "#c87a3c"]), inner: R(["#4a0810", "#6a1018", "#8a1a22", "#a82830", "#c43c40", "#d85450"]), band: R(["#3a1a18", "#522824", "#6a3832", "#824a42"]), herbs: true, shape: "leg", bone: true },
    troll: { crust: R(["#1a120c", "#30221a", "#4a3626", "#644a34", "#7e6244", "#987a56", "#b4966e"]), warts: true, inner: R(["#3a0c0c", "#561814", "#722420", "#8c342c", "#a4463a", "#b85a48"]), band: R(["#2a2018", "#3e3024", "#524030", "#66523c"]), moss: true, knots: true, shape: "club", bone: true },
    ham: { crust: R(["#2a0604", "#4e0e06", "#78200c", "#a03414", "#c4501e", "#e07a36", "#f8b060"]), ring: R(["#7a2a06", "#b04a0e", "#d8701a", "#f09a30", "#ffc860"]), inner: R(["#c0505a", "#d0646a", "#de7a7c", "#ea9290", "#f4aaa6", "#fcc4be"]), band: R(["#a0505a", "#b8646a", "#cc787c", "#dc8c8e"]), score: true, cloves: true, glaze: 0.9, shape: "ham", bone: true, frill: true },
    mead: { crust: R(["#2a1406", "#4e280c", "#7a4414", "#a4641e", "#c8882c", "#e4ae44", "#f8d478"]), ring: R(["#4a2806", "#74440c", "#9a6214", "#b88024", "#cc9a3a"]), inner: R(["#7a4c3a", "#8e5c48", "#a26e58", "#b48068", "#c29278", "#cea288"]), band: R(["#6a4a32", "#82603e", "#987250", "#aa8462"]), frost: true, glaze: 0.8, drips: true, shape: "round" },
    dragon: { crust: R(["#1a0402", "#3a0a04", "#6a1408", "#9a240c", "#c83c14", "#e8642a", "#ffa050"]), inner: R(["#8a3a24", "#a85034", "#c66a46", "#dc865e", "#eca478", "#f8c09a"]), scales: true, gold: true, shape: "tail" },
    nest: { crust: R(["#2a1004", "#5a2608", "#8a4210", "#b4621e", "#d68a34", "#eeb45a"]), inner: R(["#8a5648", "#a86c5a", "#c4846e", "#da9c84", "#eab49c", "#f6ccb6"]), string: true, layers: true, shape: "rolled" },
    roots: { roots: true },
  };
  // each joint's spine (from the carved end on the left to the far end) and its radius along it
  const SPINES = {
    // a blocky shoulder, humped; a long leg narrowing to a thin shank; a troll's club, swelling toward the far end; a pear of a ham
    shoulder: { a: [104, 86], b: [180, 78], arch: 8, r: (t) => 33 * (1 - 0.3 * t * t * t) * (1 + 0.08 * Math.sin(t * Math.PI)) },
    leg: { a: [96, 88], b: [198, 70], arch: 3, r: (t) => (t < 0.45 ? 27 - t * 6 : t < 0.8 ? 24.3 - (t - 0.45) / 0.35 * 14 : 10.3 - (t - 0.8) * 10) },
    club: { a: [100, 90], b: [194, 70], arch: 9, r: (t) => 24 + t * 16 - Math.pow(t, 5) * 22 },
    ham: { a: [100, 88], b: [194, 70], arch: 2, r: (t) => (t < 0.3 ? 36 : 36 - Math.pow((t - 0.3) / 0.7, 1.2) * 27) },
    tail: { a: [90, 88], b: [232, 56], arch: -10, sway: 8, r: (t) => 30 * Math.pow(1 - t, 0.85) + 2 },
    // a boar's rump, short and round; Snowmead a round roast; the nesting roast a long, even roll
    rump: { a: [108, 88], b: [170, 80], arch: 12, r: (t) => 37 * (1 - 0.25 * t * t) },
    round: { a: [112, 86], b: [164, 82], arch: 6, r: (t) => 34 * Math.sqrt(Math.max(0.15, 1 - t * t * 0.7)) },
    rolled: { a: [104, 86], b: [204, 76], arch: 2, r: (t) => 27 - Math.pow(Math.abs(t - 0.5) * 2, 4) * 6 },
  };
  // o (for the cooking beats): cx, cy, len, rmax place the same silhouette anywhere at any size
  function spineOf(rl, o) {
    const sp = SPINES[rl.shape] || SPINES.shoulder, n = o ? 24 : 48, pts = [];
    let a = sp.a, b = sp.b, k = 1, rs = sp.r;
    if (o) { const L0 = Math.hypot(b[0] - a[0], b[1] - a[1]); k = o.len / L0; a = [o.cx - o.len / 2, o.cy]; b = [o.cx + o.len / 2, o.cy - (sp.b[1] - sp.a[1]) * k * 0.3]; let mr = 0; for (let i = 0; i <= 20; i++) mr = Math.max(mr, sp.r(i / 20)); rs = (t) => sp.r(t) * o.rmax / mr; }
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t) - (Math.sin(t * Math.PI) * sp.arch + Math.sin(t * Math.PI * 2) * (sp.sway || 0)) * k, t]); }
    let L = 0; pts[0][3] = 0;
    for (let i = 1; i <= n; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); pts[i][3] = L; }
    return { pts, L, r: rs };
  }
  // where a pixel sits against the spine: its along-length, its offset across (squashed: the joint rests on the board), the radius there
  function spineAt(S, x, y) {
    let best = null;
    for (let i = 0; i < S.pts.length - 1; i++) {
      const [ax, ay, at, al] = S.pts[i], [bx, by, bt, bl] = S.pts[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      const q = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1), px = x - (ax + dx * q), py = y - (ay + dy * q), d2 = px * px + py * py;
      if (!best || d2 < best.d2) best = { d2, px, py, t: lerp(at, bt, q), l: lerp(al, bl, q) };
    }
    const r = S.r(best.t), d = Math.hypot(best.px, best.py < 0 ? best.py : best.py / 0.6);
    return { t: best.t, l: best.l, d, r, py: best.py };
  }
  // the joint as a height field: rounded, resting on the board, its crackling scored across the spine, glazed or scaled or warty by kind;
  // everything before cut (along the spine) has been carved off
  // o (the cooking beats): stage raw shows raw meat, done 0..1 browns it patch by patch, rot turns its scoring round as it turns on the spit
  function jointTube(S, rl, burnt, cut, seed, o) {
    o = o || {};
    const rawC = R(["#5a2a24", "#8a4a40", "#b0685a", "#cc8a78", "#e8aa98", "#f8ccbc"]), cooked = burnt ? BURNT : rl.crust, rot = o.rot || 0;
    const crustOf = (x, y) => (o.stage === "raw" ? rawC : o.done === undefined ? cooked : K.vnoise(x / 7, y / 5, seed + 1) * 0.6 + 0.2 < o.done ? cooked : rawC);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const [x, y, t] of S.pts) { const r = S.r(t); x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r * 0.6); }
    const at = o.memo || new Map(), key = (x, y) => Math.floor(x) * 1000 + Math.floor(y);
    const sa = (x, y) => { const k = key(x, y); if (!at.has(k)) at.set(k, spineAt(S, x, y)); return at.get(k); };
    const lump = (x, y) => (rl.knots ? (fbm(x / 6, y / 5, seed + 4) - 0.5) * 6 : (fbm(x / 9, y / 7, seed + 4) - 0.5) * 2.5);
    return { x0: x0 - 4, y0: y0 - 4, x1: x1 + 4, y1: y1 + 4, k: 34, hf: (x, y) => {
      const q = sa(x, y), R0 = q.r + lump(x, y);
      if (q.d > R0 || q.l < cut) return null;
      return Math.sqrt(R0 * R0 - q.d * q.d) * 0.9 + (rl.warts && h2(Math.floor(x / 3), Math.floor(y / 3), seed) > 0.85 ? 1.5 : 0);
    }, cf: (x, y, i) => {
      const q0 = sa(x + 0.5, y + 0.5), q = rot ? Object.assign({}, q0, { py: q0.py + rot * 9 }) : q0, crust = crustOf(x, y);
      let t = 0.1 + i.diff * 0.78 + (fbm(x / 3, y / 2, seed) - 0.5) * 0.3 - i.ao * 0.4;
      if (crust === rawC) return i.spec > 0.6 ? "#ffd8d0" : ramp(rawC, t, x, y, 0.45);
      if (rl.score && !burnt && rl.shape === "ham") { const a = ((q.l + q.py) % 9 + 9) % 9, b = ((q.l - q.py) % 9 + 9) % 9; if (a < 1 || b < 1) t -= 0.45; else if (a < 2 || b < 2) t += 0.12; }
      else if (rl.score && !burnt) { const a = ((q.l * 0.5 + q.py * 0.45) % 5 + 5) % 5; if (a < 0.9) t -= 0.4; else if (a < 1.8) t += 0.14; if (a > 2.2 && h2(x, y, seed + 5) > 0.86) t += 0.3; }
      if (rl.scales && !burnt) { const row = Math.floor(q.py / 3.2 + 20), u = q.l / 4.5 + (row % 2) * 0.5, f = u - Math.floor(u); if (f < 0.18) t -= 0.35; else if (f > 0.7) t += 0.12; }
      if (rl.string && Math.abs(((q.l + 4) % 15) - 7.5) < 0.8 && q.l > cut + 3) return i.diff > 0.5 ? "#f0e4c8" : "#b8a888";
      if (rl.herbs && !burnt && h2(Math.floor(x / 2), Math.floor(y / 2), seed + 8) > 0.84) return h2(x, y, 3) > 0.5 ? "#3a5a1c" : "#5e7e2a";
      if (rl.knots && !burnt && fbm(x / 4, y / 4, seed + 4) > 0.66) t -= 0.25;
      if (rl.knots && !burnt && h2(Math.floor(x / 5), Math.floor(y / 4), seed + 9) > 0.93) return i.diff > 0.4 ? "#7a8a4a" : "#4a5a2a";
      const g = rl.glaze || 0;
      if (i.spec > 0.6 - g * 0.25 && !i.edge && !burnt && fbm(x / 2.2, y / 1.8, seed + 3) > 0.45) return i.spec > 0.82 ? "#fff4dc" : ramp(crust, 1, x, y);
      if (rl.gold && !burnt && h2(x, y, seed + 2) > 0.95) return h2(x, y, seed) > 0.5 ? "#ffe890" : "#e8b440";
      if (rl.frost && !burnt && q.py < -q.r * 0.3 && h2(Math.floor(x / 2), Math.floor(y / 2), seed + 9) > 0.8) return i.diff > 0.3 ? "#f4fbff" : "#b8d0e0";
      if (rl.cloves && !burnt && rl.score && ((Math.floor(q.l / 5) + Math.floor((q.py + 30) / 5)) % 4 === 0) && Math.abs(((q.l * 0.55 + q.py * 0.25) % 5 + 5) % 5 - 2.5) < 0.6 && h2(Math.floor(q.l / 5), Math.floor(q.py / 5), 7) > 0.5) return "#1a0804";
      return ramp(crust, t, x, y, 0.45);
    } };
  }
  // the spit turns the same joint every frame: its shape against the spine is worked out once and kept
  const JOINTS = new Map();
  function jointAt(img, rl, cx, cy, len, rmax, stage, seed, rot, done) {
    const key = [rl.shape, cx, cy, len, rmax].join("|");
    if (!JOINTS.has(key)) { if (JOINTS.size > 8) JOINTS.clear(); JOINTS.set(key, { S: spineOf(rl, { cx, cy, len, rmax }), memo: new Map() }); }
    const { S, memo } = JOINTS.get(key), end = S.pts[S.pts.length - 1];
    scene(img, [Object.assign(jointTube(S, rl, stage === "burnt", 0, seed || 3, { stage, rot, done, memo }), { ao: false })]);
    if (rl.bone && rl.shape !== "tail" && stage !== "burnt") { const p4 = S.pts[S.pts.length - 3]; boneEnd(img, end[0] - 2, end[1] - 2, Math.atan2(end[1] - p4[1], end[0] - p4[0]), rmax / 30, rl.shape === "club"); }
  }
  // a cut through the meat, in pixels from the crusted edge (e) and how far up it sits (v, -1 bottom .. 1 top): crackling over a line of
  // fat on top, a thin crust round the rest, a cooked band, then the meat, rosier toward the middle, with its grain
  function meatAt(rl, e, v, d, x, y, seed, lit, slice) {
    const ring = rl.ring || rl.crust, rim = slice ? (v > 0.15 ? 1.6 + v * 1.8 : 1) : 2.4 + (v > 0 ? v * 1.6 : 0) + (h2(Math.floor(x / 3), Math.floor(y / 3), seed + 2) - 0.5) * 1.2;
    if (slice && e < rim && v <= 0.15) return ramp(rl.band || rl.crust, 0.1 + lit * 0.2, x, y, 0.3);
    // the skin seen in section is dark and thin, catching the light only along the top where the crackling or glaze is
    if (e < rim) { const top = Math.max(0, v); if (rl.ring && v < -0.2) return ramp(rl.crust, 0.12 + lit * 0.2, x, y, 0.3); if (rl.ring) return ramp(ring, 0.15 + top * 0.45 + lit * 0.2 + (h2(x, y, seed) > 0.75 ? 0.15 : 0), x, y, 0.3); return ramp(ring, 0.06 + top * 0.4 + lit * 0.15 + (h2(Math.floor(x / 2), Math.floor(y / 2), seed) > 0.6 ? 0.15 : 0) + (fbm(x / 2, y, seed) - 0.5) * 0.25, x, y, 0.35); }
    // nested meats: an off-centre core of pale bird, a darker meat round it, a fat seam between, all a little irregular
    if (rl.layers) {
      const dd = d + (fbm(x / 5, y / 5, seed + 3) - 0.5) * 0.45 + (v > 0 ? 0.12 : -0.06);
      const stuffing = () => (h2(x, y, seed + 9) > 0.7 ? (h2(x, y, seed) > 0.5 ? "#4a6a24" : "#2a1a0c") : ramp(R(["#4a3418", "#6a4c24", "#8a6630", "#a8803e"]), 0.3 + lit * 0.4, x, y));
      if (dd < 0.26) return ramp(R(["#a86a5a", "#c07e6c", "#d49480", "#e2a894"]), 0.25 + lit * 0.4 + (fbm(x / 2, y / 2, seed) - 0.5) * 0.4, x, y);
      if (dd < 0.33) return stuffing();
      if (dd < 0.55) return ramp(R(["#4a1410", "#661e18", "#822c22", "#9c3c2e"]), 0.25 + lit * 0.45 + (fbm(x / 2, y / 2, seed + 1) - 0.5) * 0.4, x, y);
      if (dd < 0.62) return stuffing();
    }
    const band = rl.band || R(["#5a4038", "#7a5a50", "#987468", "#b08a7c", "#c4a092"]), mot = fbm(x / 2.5, y / 2.5, seed + 21) - 0.5;
    if (rl.moss && d > 0.66 && h2(Math.floor(x / 2), Math.floor(y / 2), seed + 4) > 0.82) return h2(x, y, 2) > 0.5 ? "#4a6a24" : "#6a8a34";
    if (d > 0.66) return ramp(band, 0.25 + lit * 0.4 + mot * 0.9 - (d - 0.66) * 0.8, x, y, 0.3);
    let t = 0.12 + lit * 0.15 + Math.pow(1 - d / 0.66, 0.7) * 0.68 + mot * 0.6;
    if (d > 0.54) return h2(x, y, seed + 3) < (d - 0.54) * 8 ? ramp(band, 0.55 + mot, x, y) : ramp(rl.inner, t, x, y, 0.25);
    if (Math.sin(x * 0.85 - y * 0.55 + fbm(x / 5, y / 4, seed) * 3) > 0.78) t -= 0.12;
    if (rl.seams && fbm(x / 4, y / 4, seed + 13) > 0.66 && Math.abs(d - 0.4) < 0.05) return ramp(R(["#c8ac98", "#e2ccb8", "#f2e4d6"]), 0.4 + lit * 0.5, x, y);
    if (lit > 0.6 && d < 0.4 && h2(x, y, seed + 7) > 0.96) return mix(ramp(rl.inner, 1, x, y), "#ffffff", 0.35);
    return ramp(rl.inner, t, x, y, 0.25);
  }
  // a slice: the joint's cross-section, flat where it sat on the board and domed over the top. Placed by its centre, its width w and
  // height h on the board, turned by a; squash k < 1 lays it flat (seen from above at three-quarters), its cut edge showing under it
  function slicePiece(img, cx, cy, w, h, a, k, rl, seed, o) {
    o = o || {};
    const lay = new Img(W, H), ca = Math.cos(a), sa = Math.sin(a), hw = w / 2, th = k < 1 ? 2 : 0;
    const local0 = (x, y) => { const bx = x - cx, by = (cy - y) / k; return [bx * ca + by * sa, -bx * sa + by * ca]; };
    const rag = (lx, ly) => 1 + (fbm(Math.atan2(ly / h, lx / hw) * 2.4 + 7, 0.5, seed) - 0.5) * 0.3 + (h2(Math.floor((Math.atan2(ly, lx) + 4) * 7), 2, seed) - 0.5) * 0.05;
    const local = (x, y) => { const [lx, ly] = local0(x, y), r = rag(lx, ly); return [lx / r, ly / r]; };
    if (k < 1 && !o.dome) o.oval = true;
    // a dome (flat where it sat on the board) or, for the joint's own end, an oval with just its foot flattened
    const inside = o.oval ? (x, y) => { const [lx, ly] = local(x, y); if (ly < -h * 0.42) return null; const nx = lx / hw, ny = ly / (h / 2), dd = nx * nx + ny * ny; if (dd > 1) return null; return { nx, ny: (ny + 1) / 2, e: Math.min((1 - Math.sqrt(dd)) * Math.min(hw, h / 2), (ly + h * 0.42) + 0.6) }; }
      : (x, y) => { const [lx, ly] = local(x, y); if (ly < -h * 0.5) return null; const nx = lx / hw, ny = (ly + h * 0.5) / h; const dd = nx * nx + ny * ny; if (dd > 1) return null; return { nx, ny, e: Math.min((1 - Math.sqrt(dd)) * Math.min(hw, h), (ly + h * 0.5) * k + 0.6) }; };
    const R0 = Math.max(hw, h) + 3;
    if (th) for (let y = Math.floor(cy - R0); y <= cy + R0 + th; y++) for (let x = Math.floor(cx - R0); x <= cx + R0; x++) {
      if (inside(x + 0.5, y + 0.5)) continue;
      const tj = th + (h2(Math.floor(x / 5), 4, seed) > 0.5 ? 1 : 0);
      for (let j = 1; j <= tj; j++) if (inside(x + 0.5, y + 0.5 - j)) { lay.px(x, y, j === tj ? ramp(rl.band || rl.crust, 0.15, x, y) : ramp(rl.inner, 0.12 + (fbm(x / 3, y, seed) - 0.5) * 0.3, x, y)); break; }
    }
    if (o.side) for (let y = Math.floor(cy - R0); y <= cy + R0; y++) for (let x = Math.floor(cx - R0); x <= cx + R0 + 3; x++) {
      if (inside(x + 0.5, y + 0.5)) continue;
      for (let j = 1; j <= 3; j++) if (inside(x + 0.5 - j, y + 0.5 + j * 0.5)) { const q = inside(x + 0.5 - j, y + 0.5 + j * 0.5); lay.px(x, y, q.e < 3 && q.ny > 0.4 ? ramp(rl.crust, 0.2, x, y) : ramp(rl.inner, 0.12, x, y)); break; }
    }
    hrender(lay, [cx - R0, cy - R0, cx + R0, cy + R0], (x, y) => { const q = inside(x, y); return q ? Math.min(2, q.e * 0.5) : null; }, (x, y, i) => {
      const q = inside(x + 0.5, y + 0.5);
      if (!q) return null;
      return meatAt(rl, q.e, q.ny * 2 - 1, Math.min(1, Math.hypot(q.nx, (q.ny - (o.oval ? 0.5 : 0.35)) * 1.5)), x, y, seed, 0.35 + i.diff * 0.45, k < 1);
    }, { k: 30 });
    rimShade(lay, 0.4);
    if (!o.noShadow) shadow(img, cx + 3, cy + 4, hw * 1.05, Math.max(3, h * k * 0.5), 0.4, "#140604");
    img.paste(lay, 0, 0);
  }
  function boneEnd(img, x, y, ang, s, big) {
    const ca = Math.cos(ang), sa = Math.sin(ang), BONE = R(["#6a5a42", "#9a8a6a", "#c8b894", "#e8dcbc", "#fff8e6"]), k = big ? 1.6 : 1;
    scene(img, [blob(x + ca * 10 * s, y + sa * 5 * s, 12 * s, 4 * s * k, 4 * s * k, shade(BONE, { base: 0.3 }), { wob: [[2, 0.1, ang]], k: 24, base: 30 }),
      blob(x + ca * 22 * s, y + sa * 10 * s - 2 * s * k, 5 * s * k, 4 * s * k, 5 * s * k, shade(BONE, { base: 0.3 }), { k: 24, base: 32 }), blob(x + ca * 22 * s + 2 * s, y + sa * 10 * s + 2 * s * k, 5 * s * k, 4 * s * k, 5 * s * k, shade(BONE, { base: 0.3 }), { k: 24, base: 31 })]);
  }
  // a paper frill on the ham's bone
  function frill(img, x, y) {
    for (let j = -6; j <= 6; j++) for (let i = 0; i < 6; i++) { const zig = Math.abs(((j + 20) % 3) - 1); if (i > 4 + zig) continue; img.px(x + i, y + j, i === 0 || i === 4 + zig ? "#8a8070" : j % 2 ? "#f4eee0" : "#d8d0c0"); }
  }
  // the fan of slices: each its own size and turn, overlapping by different amounts, the way they fell off the knife
  const CARVE = 11, FAN = [[33, 110, 40, 27, -0.5], [50, 115, 47, 31, -0.16], [70, 112, 38, 25, 0.12], [86, 120, 44, 30, 0.34]];
  function roastServe(spec, o) {
    const look = spec.look, rl = roastLook(spec), burnt = o.burnt, eat = K.eating();
    const img = tableBack(o.seed || 5);
    if (rl.roots) return rootsServe(spec, img, burnt);
    if (look.shield) shieldDish(img, 120, 90, 112, 50, false); else if (look.boardServe !== false) B.board(img, 120, 96, 116, 46, 7);
    const S = spineOf(rl), carved = (eat && eat.carved) || 0, cut = burnt ? 0 : 10 + carved * CARVE, end = S.pts[S.pts.length - 1];
    // the joint's shadow and its juices on the board
    shadow(img, (S.pts[0][0] + end[0]) / 2 + 4, (S.pts[0][1] + end[1]) / 2 + 18, (end[0] - S.pts[0][0]) * 0.55, 12, 0.55, "#0e0402");
    if (!burnt) { const J = ell(70, 120, 46, 9, [[3, 0.15, 1], [5, 0.08, 2]], 4); img.fill((x, y) => { const d = J(x + 0.5, y + 0.5); if (d > 1) return null; if (d < 0.5 && h2(x, y, 3) > 0.94) return "#f8c890"; return pick(R(["#2a0a04", "#46140a", "#642210", "#86341a"]), 0.15 + (1 - d) * 0.7, x, y, 0.3); }, 20, 108, 120, 132); }
    scene(img, [jointTube(S, rl, burnt, cut, o.seed || 3)]);
    if (rl.bone && rl.shape !== "tail") { const ang = Math.atan2(end[1] - S.pts[S.pts.length - 4][1], end[0] - S.pts[S.pts.length - 4][0]); boneEnd(img, end[0] - 2, end[1] - 2, ang, 1.15, rl.shape === "club"); if (rl.frill && !burnt) frill(img, end[0] + 18, end[1] + 2); }
    if (rl.shape === "tail" && !burnt) for (let i = 4; i < S.pts.length - 4; i += 3) { const [x, y, t] = S.pts[i], r = S.r(t); if (S.pts[i][3] < cut) continue; for (let j = 0; j < 3 + r * 0.25; j++) for (let q = -1; q <= 1; q++) img.px(x + q * (1 - j / (3 + r * 0.25)), y - r * 0.95 - j, j < 2 ? "#6a1408" : "#c83c14"); }
    if (rl.drips && !burnt) for (let i = 10; i < S.pts.length - 6; i += 6) { const [x, y, t] = S.pts[i], r = S.r(t), len = 5 + (i * 7) % 7; if (S.pts[i][3] < cut + 4) continue; for (let j = 0; j < len; j++) { img.px(x + 2, y + r * 0.1 + j, j < len - 1 ? "#e8a838" : "#fff0b0"); img.px(x + 3, y + r * 0.1 + j, "#b8761c"); } }
    if (rl.knots && !burnt) for (let i = 8; i < S.pts.length - 8; i += 7) { const [x, y, t] = S.pts[i], r = S.r(t); if (S.pts[i][3] < cut + 6) continue; for (let q = 0; q < 7; q++) img.px(x - 3 + q, y - r * 0.85 - (q % 2), q % 3 ? "#5e7a2a" : "#86a43c"); }
    if (burnt) { for (let i = 0; i < 50; i++) { const r = rng(i + 70); img.px(40 + r() * 170, 100 + r() * 30, r() < 0.5 ? "#2a2622" : "#4a4440"); } return img; }
    // the carved end: the cross-section at the cut, a dome resting on the board
    const c0 = S.pts.find((p) => p[3] >= cut) || S.pts[0], rC = S.r(c0[2]), fw = rC * 0.72, fh = rC * 1.6;
    const face = { x: c0[0] - 1, y: c0[1] - rC * 0.2, w: fw, h: fh, r: rC };
    slicePiece(img, face.x, c0[1] + rC * 0.6 - fh * 0.42 + 1, fw * 2, fh * 1.08, 0, 1, rl, 3, { noShadow: true, oval: true });
    geo("joint", { x: face.x, y: face.y, h: fh / 2, next: cut + CARVE });
    geo("inside", rl.inner);
    if (rl.apple) { scene(img, [blob(end[0] - 8, end[1] - 22, 10, 9, 9, shade(R(["#3a0604", "#6a0e08", "#9a1e10", "#c83a1e", "#e8683a", "#ffa070"]), { glint: 0.5 }), { k: 30, base: 40 })]); img.rect(end[0] - 8, end[1] - 32, 1, 4, "#4a2a10"); }
    if (rl.herbs) { herb(img, 200, 112, 1.6, 2); herb(img, 118, 50, 1.3, 3); }
    if (look.regrow) { scene(img, [blob(130, 56, 7, 5, 6, shade(R(["#2a3a14", "#46581e", "#62782a", "#82983c", "#a8bc5a"]), { base: 0.3 }), { k: 20, base: 40 })]); for (const [x, y] of [[122, 46], [138, 44], [130, 40]]) star(img, x, y, "#d8f8a0", 1); }
    for (const [x, y] of [[178, 118], [204, 108], [150, 126]]) scene(img, [BIT.carrot(x, y, 8, look, 1), BIT.onion(x + 10, y + 3, 7, look, 2)]);
    FAN.forEach(([x, y, w, h, a], i) => { item("s" + i, x, y, 20, "slice", { z: i, box: [x - 26, y - 16, x + 26, y + 14] }); if (!taken("s" + i)) { slicePiece(img, x, y, w, h, a, 0.5, rl, i + 3); if (look.attention) pennant(img, x + 2, y - 2); } });
    if (rl.gold) for (let i = 0; i < 26; i++) { const r = rng(i + 40); star(img, 110 + r() * 100, 46 + r() * 40, "#ffe890", 1, 0.8); }
    return img;
  }
  // a toothpick with a red pennant, stuck upright in a slice: the Sergeant's slices stand to attention
  function pennant(img, x, y) {
    for (let j = 0; j < 11; j++) img.px(x, y - j, j < 10 ? "#e0c89c" : "#a08060");
    for (let j = 0; j < 4; j++) for (let i = 1; i <= 6 - j; i++) img.px(x + i, y - 10 + j, j === 0 || i === 6 - j ? "#7a1a12" : "#c8382a");
  }
  function roastLook(spec) { return Object.assign({}, ROASTS[spec.pal] || ROASTS.pork, spec.look.roast || {}); }
  // a slice as the fork takes it: lying (just carved and tipped over) or standing (as it comes off the joint)
  function roastSlice(spec, standing) {
    const rl = roastLook(spec), lay = new Img(W, H);
    if (standing) slicePiece(lay, 120, 75, 40, 30, 0, 1, rl, 9, { noShadow: true, side: true });
    else slicePiece(lay, 120, 75, 44, 30, -0.1, 0.5, rl, 9, { noShadow: true });
    return crop(lay, 80, 40, 80, 70);
  }
  function crop(src, x0, y0, w, h) {
    const out = new Img(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = src.get(x0 + x, y0 + y); if (p) out.px(x, y, p, p[3] / 255); }
    return out;
  }
  // the joint: a crackled loaf of meat, its skin scored in parallel grooves (pork, boar, ham), dark and herby (venison), knobbly (troll),
  // scaled (dragon); cut > 0 clips it there, so the carved end can be drawn on as a face
  function jointObj(cx, cy, rx, ry, rl, stage, seed, cut) {
    const burnt = stage === "burnt", raw = stage === "raw", crust = burnt ? BURNT : raw ? rl.raw || R(["#5a2a24", "#8a4a40", "#b0685a", "#cc8a78", "#e8aa98", "#f8ccbc"]) : rl.crust;
    const ob = blob(cx, cy, rx, ry, ry * 1.1, (x, y, i) => {
      let t = 0.12 + i.diff * 0.8 + (fbm(x / 3, y / 2, seed) - 0.5) * 0.3 - i.ao * 0.4;
      if (rl.score && !raw) {
        const a = ((x * 0.7 + y * 1.5) % 7 + 7) % 7;
        if (a < 1.1) t -= 0.5; else if (a < 2.2) t += 0.22;
        if (!burnt && a > 2.6 && h2(x, y, seed + 5) > 0.9) t += 0.3;
      }
      if (rl.string && Math.abs(((x - cx) % 16 + 16) % 16 - 8) < 0.8) return i.diff > 0.5 ? "#f0e4c8" : "#b8a888";
      if (rl.scales && !raw) { const row = Math.floor(y / 4), cxs = Math.floor((x + (row % 2) * 3) / 6) * 6 + 3 - (row % 2) * 3, d = Math.hypot(x - cxs, (y - row * 4) * 1.4); if (d > 3.6 && d < 4.8) t -= 0.35; else if (d < 2) t += 0.15; }
      if (rl.knots && !raw && fbm(x / 5, y / 5, seed + 4) > 0.7) t -= 0.25;
      if (rl.herbs && !raw && !burnt && h2(Math.floor(x / 2), Math.floor(y / 2), seed + 8) > 0.86) return h2(x, y, 3) > 0.5 ? "#3a5a1c" : "#5a7a2a";
      const g = (rl.glaze || 0) * (raw ? 0 : 1);
      if (i.spec > 0.62 - g * 0.25 && !i.edge && !burnt && fbm(x / 2.2, y / 1.8, seed + 3) > 0.48) return i.spec > 0.85 ? "#fff4dc" : ramp(crust, 1, x, y);
      if (rl.gold && !raw && !burnt && h2(x, y, seed + 2) > 0.94) return h2(x, y, seed) > 0.5 ? "#ffe890" : "#e8b440";
      if (rl.frost && !raw && !burnt && fbm(x / 2, y / 2, seed + 9) > 0.66) return i.diff > 0.4 ? "#f4fbff" : "#b8d0e0";
      if (rl.cloves && !raw && ((x * 7 + y * 13) % 41 === 0)) return "#1a0804";
      return ramp(crust, t, x, y, 0.45);
    }, { pow: 0.6, k: 34, wob: [[2, 0.05, seed], [3, 0.05, seed * 2], [5, 0.025, seed]], seed, rough: ry * (rl.score ? 0.03 : 0.12), scale: 2.2 });
    if (cut) { const hf = ob.hf; ob.hf = (x, y) => (x < cut ? null : hf(x, y)); }
    return ob;
  }
  function shieldDish(img, cx, cy, rx, ry, goblin) {
    const lay = new Img(W, H), E = ell(cx, cy, rx, ry);
    for (let y = Math.floor(cy); y < cy + ry + 6; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (E(x + 0.5, y + 0.5) > 1 && ell(cx, cy + 5, rx, ry)(x + 0.5, y + 0.5) <= 1) lay.px(x, y, ramp(IRONV, 0.3 - (x - cx) / rx * 0.2, x, y));
    hrender(lay, [cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1], (x, y) => { const d = E(x, y); return d > 1 ? null : (1 - d * d) * 6; }, (x, y, i) => {
      const d = E(x, y), boss = Math.hypot((x - cx) / (rx * 0.18), (y - cy) / (ry * 0.18)) < 1;
      if (d > 0.9) return ramp(IRONV, 0.4 + i.diff * 0.6 + (Math.floor(Math.atan2(y - cy, x - cx) * 10) % 2 === 0 ? 0.25 : 0), x, y);
      if (boss) return ramp(IRONV, 0.5 + i.diff * 0.5, x, y);
      const plank = Math.floor((x - cx + rx) / 14);
      if (goblin) { const u = (x - cx) / rx, v = (y - cy) / ry; if (Math.abs(Math.abs(u) - 0.5) < 0.05 && Math.abs(v) < 0.6 || (Math.abs(v - 0.35) < 0.06 && Math.abs(u) < 0.45 && Math.floor(u * 12) % 2 === 0)) return ramp(R(["#4a0a06", "#7a1408", "#a82410", "#c8381a"]), 0.4 + i.diff * 0.5, x, y); }
      return ramp(R(["#1e0e06", "#3a1c0c", "#5a2e16", "#7a4220", "#9a5a2e"]), 0.3 + i.diff * 0.4 + (plank % 2 ? 0.1 : -0.05) + ((x - cx + rx) % 14 < 1 ? -0.3 : 0), x, y);
    });
    outline(lay, "#050302");
    img.paste(lay, 0, 0);
  }
  // roots buried with a living coal: carrots, parsnips and beets, charred at the tips, and the coal itself, smug
  function rootsServe(spec, img, burnt) {
    B.skilletWide(img, 120, 86, 100, 40, 0);
    const objs = [], tops = [], r = rng(9), cx = 120, cy = 80;
    const KINDS = [["carrot", RP.carrot], ["parsnip", R(["#6a5a3a", "#988458", "#c0ac7e", "#dccaa0", "#f2e6c4"])], ["beet", R(["#1a0410", "#3a0a1e", "#5e1030", "#86203e", "#a83a50"])]];
    for (let i = 0; i < 10; i++) {
      const [kind, rp] = KINDS[i % 3], a = (i / 10) * TAU + (r() - 0.5) * 0.3, out = [cx + Math.cos(a) * 74, cy + Math.sin(a) * 28 + 4], inn = [cx + Math.cos(a) * 24, cy + Math.sin(a) * 10 + 2];
      const mid = [(out[0] + inn[0]) / 2, (out[1] + inn[1]) / 2];
      item("r" + i, mid[0], mid[1], 14, "root", { z: mid[1], box: [Math.min(out[0], inn[0]) - 10, Math.min(out[1], inn[1]) - 10, Math.max(out[0], inn[0]) + 10, Math.max(out[1], inn[1]) + 10] });
      if (taken("r" + i)) { r(); continue; }
      const char = (q) => !burnt && q.t > 0.82;
      if (kind === "beet") {
        objs.push(blob(out[0] + (inn[0] - out[0]) * 0.25, out[1] + (inn[1] - out[1]) * 0.25, 9, 8, 8, (x, y, ii) => (burnt ? ramp(BURNT, ii.diff, x, y) : ii.spec > 0.55 ? "#f0b0c0" : ramp(rp, 0.15 + ii.diff * 0.8 + (h2(x, y, i) > 0.92 ? -0.2 : 0), x, y)), { k: 30, base: 3 }));
        objs.push(tube([[out[0] + (inn[0] - out[0]) * 0.35, out[1] + (inn[1] - out[1]) * 0.35], inn], (t) => 2.5 - t * 1.8, (x, y, ii, q) => (burnt || char(q) ? ramp(BURNT, ii.diff, x, y) : ramp(rp, 0.3 + ii.diff * 0.6, x, y)), { base: 2 }));
      } else objs.push(tube([out, [lerp(out[0], inn[0], 0.5) + Math.sin(a) * 3, lerp(out[1], inn[1], 0.5)], inn], (t) => 7 - t * 5.6, (x, y, ii, q) => {
        if (burnt || char(q)) return ramp(BURNT, 0.1 + ii.diff * 0.6 + (q.t > 0.9 && !burnt ? 0.2 : 0), x, y);
        if (ii.spec > 0.6) return "#fff0d8";
        return ramp(rp, 0.12 + ii.diff * 0.8 - (Math.sin(q.l * 1.7) > 0.8 ? 0.25 : 0) - (q.t > 0.65 ? (q.t - 0.65) * 1.4 : 0), x, y);
      }, { base: 2, k: 24 }));
      if (!burnt) tops.push([out[0], out[1], a]);
    }
    scene(img, objs);
    for (const [x, y, a] of tops) for (let k = -1; k <= 1; k++) for (let j = 1; j <= 6; j++) img.px(x + Math.cos(a + k * 0.5) * j, y + Math.sin(a + k * 0.5) * j * 0.6 - j * 0.3, j < 3 ? "#3a6a1c" : "#62a03a");
    livingCoal(img, cx, cy - 2, 1.4, false);
    if (!burnt) for (let i = 0; i < 30; i++) img.px(70 + r() * 100, 64 + r() * 34, r() < 0.5 ? "#ff8a3a" : "#ffd27a");
    return img;
  }
  function livingCoal(img, x, y, s, sad) {
    glow(img, x, y, 22 * s, "#ff7a2a", 0.4);
    scene(img, [blob(x, y, 11 * s, 9 * s, 8 * s, (xx, yy, i) => {
      const crack = fbm(xx / 3, yy / 3, 5) > 0.62;
      return crack ? (i.diff > 0.4 ? "#ffd27a" : "#ff8a2a") : ramp(R(["#0a0605", "#1a100c", "#2a1a14", "#3e2a20"]), 0.2 + i.diff * 0.8, xx, yy);
    }, { wob: [[3, 0.12, 1], [5, 0.06, 2]], k: 20 })]);
    const ex = Math.round(x), ey = Math.round(y - 1 * s);
    for (const dx of [-4, 3]) { img.rect(ex + dx * s, ey, 2, 2, "#fff6c8"); img.px(ex + dx * s + 1, ey + 1, "#2a1a10"); }
    for (let k = -3; k <= 3; k++) img.px(ex + k * s * 0.8, ey + 4 * s + (sad ? -Math.abs(k) * 0.3 : Math.abs(k) * 0.35) * -1 + (sad ? 1 : 0), "#ffd27a");
  }

  // ---------- tubes: anything long and round (a tentacle, a root, a frog's leg) as a height field along a path ----------
  // pts: [[x, y], ...]; rad(t) its radius at t (0..1 along it); cf(x, y, info, q) gets q = { t, l (length along), side (-1..1 across) }
  function tube(pts, rad, cf, o) {
    o = o || {};
    const P = [[pts[0][0], pts[0][1], 0]];
    for (let i = 1; i < pts.length; i++) P.push([pts[i][0], pts[i][1], P[i - 1][2] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])]);
    const L = P[P.length - 1][2] || 1, Rm = Math.max(...P.map((q) => rad(q[2] / L))) + 1;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const near = (x, y) => {
      let best = null;
      for (let i = 0; i < P.length - 1; i++) {
        const [ax, ay, al] = P[i], [bx, by, bl] = P[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
        const q = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1), px = x - ax - dx * q, py = y - ay - dy * q, d2 = px * px + py * py;
        if (!best || d2 < best.d2) best = { d2, l: lerp(al, bl, q), cross: (dx * py - dy * px) / Math.sqrt(L2) };
      }
      const t = best.l / L, r = rad(t), d = Math.sqrt(best.d2);
      return d > r ? null : { t, l: best.l, d, r, side: best.cross / r };
    };
    return { x0: x0 - Rm, y0: y0 - Rm, x1: x1 + Rm, y1: y1 + Rm, k: o.k || 22, base: o.base || 0,
      hf: (x, y) => { const q = near(x, y); return q ? Math.sqrt(q.r * q.r - q.d * q.d) * (o.flat || 1) : null; },
      cf: (x, y, i) => { const q = near(x + 0.5, y + 0.5); return q ? cf(x, y, i, q) : null; } };
  }
  // a kraken tentacle threaded on a skewer: it waves along the stick and curls at the tip, suckers down its underside, charred in places
  function tentacleOn(img, x0, y0, x1, y1, stage, seed, bitten) {
    const burnt = stage === "burnt", raw = stage === "raw", pts = [], L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
    for (let i = 0; i <= (bitten ? 32 : 40); i++) { const t = i / 40, w = Math.sin(t * Math.PI * 3 + seed) * 6; pts.push([lerp(x0, x1, t) + nx * w, lerp(y0, y1, t) + ny * w * 0.7]); }
    const [tx, ty] = pts[pts.length - 1];
    if (!bitten) for (let i = 1; i <= 16; i++) { const a = i * 0.42, r = 7 * (1 - i / 20); pts.push([tx + Math.sin(a) * r * 1.3, ty - (1 - Math.cos(a)) * r]); }
    const skin = burnt ? BURNT : raw ? R(["#3a2a3a", "#5a4256", "#7e6276", "#a48aa0", "#c8b4c4"]) : R(["#2a0a14", "#4a1424", "#702030", "#963440", "#b8504e", "#d47a6a"]);
    const full = bitten ? 0.75 : 1;
    scene(img, [tube(pts, (t) => 7.5 * (1 - t * full * 0.72) + 1, (x, y, i, q) => {
      if (bitten && q.t > 0.97) return ramp(R(["#c89088", "#e4b4a8", "#f6d4c8", "#fff0e8"]), 0.4 + i.diff * 0.5, x, y);
      const su = Math.hypot(((q.l % 7) + 7) % 7 - 3.5, (q.side - 0.55) * q.r);
      if (!burnt && q.side > 0.1 && su < 2.6) return su < 1 ? "#7a2a30" : ramp(R(["#c89088", "#e4b4a8", "#f6d4c8", "#fff0e8"]), 0.35 + i.diff * 0.55, x, y);
      if (!raw && !burnt && h2(Math.floor(x / 2), Math.floor(y / 2), seed + 3) > 0.9) return "#1a0808";
      if (i.spec > 0.6 && !burnt) return "#ffe8e0";
      return ramp(skin, 0.15 + i.diff * 0.75 - i.ao * 0.4 - q.side * 0.1, x, y);
    }, { base: 4, k: 30 })]);
  }
  // twist-bread: two strands of dough plaited along the stick, over and under in turn, tapering at both ends, scored across, golden
  // where the fire caught it, dusted with flour; skip leaves off the first part of it (torn off and eaten)
  function braid(img, x0, y0, x1, y1, stage, skip) {
    const burnt = stage === "burnt", raw = stage === "raw", len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
    const rp = burnt ? BURNT : raw ? R(["#9a8a6a", "#c4b48e", "#e2d4b0", "#f6ecd2", "#fffaf0"]) : R(["#4a2208", "#7a3e12", "#a8601e", "#cc8434", "#e6a852", "#f6cc80", "#fff0c0"]);
    const objs = [], period = 18, seg2 = Math.ceil(len / (period / 2));
    for (let si = 0; si < 2; si++) for (let k = 0; k < seg2; k++) {
      const a0 = k * period / 2, a1 = Math.min(len, a0 + period / 2 + 1.5);
      if (a1 < (skip || 0)) continue;
      const pts = [];
      for (let q = 0; q <= 6; q++) { const a = lerp(Math.max(a0, skip || 0), a1, q / 6), w = Math.sin((a / period) * TAU + si * Math.PI) * 4.5; pts.push([x0 + ux * a + nx * w, y0 + uy * a + ny * w * 0.8]); }
      const over = (k + si) % 2 === 0, taper = (a) => Math.min(1, Math.min(a - (skip || 0) + 4, len - a) / 22);
      objs.push(tube(pts, (t) => 5.6 * (0.45 + 0.55 * taper(lerp(Math.max(a0, skip || 0), a1, t))), (x, y, ii, q) => {
        if (!raw && !burnt && h2(x, y, si * 7 + k) > 0.93) return "#fffaf0";
        if (!raw && !burnt && Math.abs(q.side) < 0.25 && Math.abs(((q.l + k * 3) % 7) - 3.5) < 0.6) return ramp(rp, 0.15, x, y);
        if (ii.spec > 0.6 && !burnt) return "#fff4d8";
        return ramp(rp, 0.15 + ii.diff * 0.75 - ii.ao * 0.6 + (q.side < -0.3 ? 0.1 : 0), x, y);
      }, { base: over ? 3 : 1, k: 20 }));
    }
    scene(img, objs);
    if (skip && !raw && !burnt) { const ex = x0 + ux * skip, ey = y0 + uy * skip; for (let j = -4; j <= 4; j++) for (let i = 0; i < 2; i++) img.px(ex + i, ey + j, ramp(R(["#c8b088", "#e2cca4", "#f2e2c2"]), 0.6, 0, 0)); }
  }
  // ---------- skewers and sausages ----------
  const SKEWERS = {
    rat: { chunk: R(["#2a0e06", "#4a1c0c", "#723014", "#9a4a22", "#c06c36", "#dc9050"]), n: 4, size: 11 },
    salamander: { chunk: R(["#3a0a04", "#6a1408", "#a02a0c", "#d04a16", "#f07a28", "#ffb050"]), n: 4, size: 11, glow: true },
    kraken: { rounds: true, chunk: R(["#2a0a0c", "#4a1416", "#6e2222", "#924036", "#b4604e", "#d48a70"]), n: 3, size: 14 },
    trout: { fish: true },
    twist: { twist: true },
  };
  function skewerChunks(cx0, cy0, cx1, cy1, sk, stage, seed, skip) {
    const objs = [], n = sk.n || 5, burnt = stage === "burnt", raw = stage === "raw";
    for (let i = skip || 0; i < n; i++) {
      const t = (i + 0.5) / n, x = lerp(cx0, cx1, t), y = lerp(cy0, cy1, t), sz = sk.size * (0.9 + h2(i, seed, 3) * 0.25);
      const rp = burnt ? BURNT : raw ? R(["#4a1418", "#7a2a2e", "#a84446", "#cc6464", "#e88a84"]) : sk.chunk;
      if (sk.rounds) objs.push(blob(x, y, sz, sz * 0.9, sz * 0.4, (xx, yy, ii) => {
        const d = Math.hypot((xx - x) / sz, (yy - y) / (sz * 0.9));
        if (!raw && !burnt && d > 0.72 && d < 0.95 && Math.floor(Math.atan2(yy - y, xx - x) * 4) % 2 === 0) return ramp(R(["#c8a088", "#e4c4ac", "#f6e0cc"]), ii.diff, xx, yy);
        if (!raw && !burnt && Math.abs(((xx - yy) % 7 + 7) % 7) < 1.2) return ramp(rp, 0.05, xx, yy);
        return ramp(rp, 0.15 + ii.diff * 0.8, xx, yy);
      }, { pow: 0.3, k: 20, base: 4 }));
      else objs.push(blob(x, y, sz, sz * 0.85, sz * 0.8, (xx, yy, ii) => {
        if (!raw && !burnt && Math.abs(((xx - yy * 1.5) % 6 + 6) % 6) < 1.1) return ramp(rp, 0.02, xx, yy);
        if (ii.spec > 0.5 && !burnt) return "#ffe8c8";
        return ramp(rp, 0.12 + ii.diff * 0.8 - ii.ao * 0.4 + (fbm(xx / 2, yy / 2, seed + i) - 0.5) * 0.3, xx, yy);
      }, { wob: [[3, 0.15, i + seed], [5, 0.08, i]], seed: i + seed, k: 18, base: 4 }));
    }
    return objs;
  }
  function trout(img, x, y, len, ang, stage, seed) {
    const lay = new Img(W, H), ca = Math.cos(ang), sa = Math.sin(ang), burnt = stage === "burnt", raw = stage === "raw";
    const skin = burnt ? BURNT : raw ? R(["#3a4a4a", "#5a6e6a", "#7e948c", "#a8bcb0", "#d4e0d4"]) : R(["#3a2410", "#5e3c1a", "#8a5c2a", "#b48040", "#d8a85e", "#f4d08c"]);
    hrender(lay, [x - len, y - len, x + len, y + len], (xx, yy) => {
      const u = ((xx - x) * ca + (yy - y) * sa) / len, v = (-(xx - x) * sa + (yy - y) * ca);
      if (u < -1 || u > 1) return null;
      const half = u > 0.75 ? (1 - u) * 18 + (u > 0.88 ? 4 : 0) : (1 - u * u) * len * 0.22 + (u < -0.85 ? 3 * (1 + (u + 0.85) * 6) : 0);
      if (Math.abs(v) > Math.max(0.5, half * (u < -0.85 ? 1.2 : 1))) return null;
      return Math.sqrt(Math.max(0, 1 - (v * v) / (half * half + 0.01))) * 4;
    }, (xx, yy, i) => {
      const u = ((xx - x) * ca + (yy - y) * sa) / len, v = (-(xx - x) * sa + (yy - y) * ca);
      if (Math.abs(u - 0.62) < 0.02 && Math.abs(v + 1) < 1.2) return "#140804";
      if (!raw && !burnt && Math.abs(((u * 40) % 4)) < 0.6 && Math.abs(v) < 3) return ramp(skin, 0.05, xx, yy);
      if (i.spec > 0.6) return "#fff4e0";
      return ramp(skin, 0.15 + i.diff * 0.8 + (v > 0 ? -0.15 : 0.05) + (h2(xx, yy, seed) > 0.92 ? 0.15 : 0), xx, yy);
    }, { k: 26 });
    outline(lay, "#0a0604");
    img.paste(lay, 0, 0);
  }
  // dough wound round a stick: a band of tilted coils, the back of each turn shadowed, toasted darker on the side nearest the fire
  function twistDough(img, x0, y0, x1, y1, stage) {
    const burnt = stage === "burnt", raw = stage === "raw", n = Math.max(6, Math.round(Math.hypot(x1 - x0, y1 - y0) / 11)), len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
    const rp = burnt ? BURNT : raw ? R(["#9a8a6a", "#c4b48e", "#e2d4b0", "#f6ecd2", "#fffaf0"]) : R(["#5a2e0e", "#8a4a18", "#b8702a", "#d8984a", "#ecc078", "#fae4ac"]);
    const objs = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, cx = lerp(x0, x1, t), cy = lerp(y0, y1, t), tilt = ang + 0.5, ca = Math.cos(tilt), sa = Math.sin(tilt), a = 22, b = 5.5;
      objs.push({ x0: cx - a - 2, y0: cy - a - 2, x1: cx + a + 2, y1: cy + a + 2, k: 20, base: 2, hf: (x, y) => {
        const u = ((x - cx) * ca + (y - cy) * sa) / b, v = (-(x - cx) * sa + (y - cy) * ca) / (a * 0.55);
        const d = u * u + v * v;
        return d > 1 ? null : Math.sqrt(1 - d) * 6;
      }, cf: (x, y, ii) => (ii.spec > 0.6 && !burnt ? "#fff4d8" : ramp(rp, 0.15 + ii.diff * 0.75 - ii.ao * 0.5 + (h2(x, y, i) > 0.92 && !raw ? -0.3 : 0), x, y)) });
    }
    scene(img, objs);
  }
  // a whole haunch on its stick, grilled, the bone end showing
  function drumstick(img, x, y, stage, seed, s) {
    const burnt = stage === "burnt", raw = stage === "raw";
    const crust = burnt ? BURNT : raw ? R(["#4a1418", "#7a2a2e", "#a84446", "#cc6464", "#e88a84"]) : SKEWERS.rat.chunk;
    scene(img, [blob(x, y, 22 * s, 13 * s, 12 * s, (xx, yy, i) => {
      if (!raw && !burnt && Math.abs(((xx - yy * 1.4) % 8 + 8) % 8) < 1.2) return ramp(crust, 0.02, xx, yy);
      if (i.spec > 0.6 && !burnt) return "#ffe8c8";
      return ramp(crust, 0.12 + i.diff * 0.8 - i.ao * 0.4 + (fbm(xx / 2, yy / 2, seed) - 0.5) * 0.3, xx, yy);
    }, { wob: [[1, 0.25, 0.3], [3, 0.08, seed]], k: 20, base: 6, pow: 0.6 })]);
    boneEnd(img, x + 18 * s, y - 3 * s, -0.15, 0.8 * s);
  }
  function skewerServe(spec, o) {
    const look = spec.look, sk = Object.assign({}, SKEWERS[spec.pal] || SKEWERS.rat, look.skewer || {}), burnt = o.burnt, st = burnt ? "burnt" : "cook";
    const img = tableBack(o.seed || 6);
    if (sk.rounds) shieldDish(img, 120, 90, 110, 48); else B.board(img, 120, 96, 114, 44, 9);
    const rows = sk.rounds || sk.twist ? 2 : 3;
    for (let k = 0; k < rows; k++) {
      const y0 = rows === 2 ? 70 + k * 30 : 64 + k * 22, x0 = 24 + k * 6, x1 = 214 - k * 4, key = "k" + k + "e", gone = taken(key), sy = (x) => y0 + 8 - (x - x0 + 10) / (x1 - x0 + 22) * 16;
      stick(img, x0 - 10, y0 + 8, x1 + 12, y0 - 8, { w: 2, charEnd: true });
      if (sk.fish) { const fx = (x0 + x1) / 2; geo("fish" + k, { cx: fx, cy: y0, rx: 52, ry: 9, h: 6 }); item(key, fx - 20, y0, 12, "fish", { z: k, m: { cx: fx, cy: y0, rx: 52, ry: 9, h: 6 } }); trout(img, fx, y0, 62, -0.08, st, k); }
      else if (sk.drums) { const dx = (x0 + x1) / 2 - 10 + k * 8; item(key, dx + 4, y0 - 2, 16, "drum", { z: k, box: [dx - 26, y0 - 18, dx + 44, y0 + 14] }); if (!gone) drumstick(img, dx, y0 - 2, st, k + 1, 1); }
      else if (sk.twist) { item(key, x0 + 30, sy(x0 + 30) - 2, 12, "coil", { z: k, box: [x0 + 6, y0 - 14, x0 + 50, y0 + 14] }); braid(img, x0 + 14, y0 + 5, x1 - 14, y0 - 5, st, gone ? 34 : 0); }
      else if (sk.rounds) { item(key, x1 - 28, y0 - 6, 12, "tip", { z: k, box: [x1 - 50, y0 - 22, x1, y0 + 12] }); tentacleOn(img, x0 + 8, y0 + 5, x1 - 22, y0 - 3, st, k * 2 + 1, gone); }
      else { const n = sk.n || 5, cx0 = x0 + 6, cx1 = x1 - 6, fx = lerp(cx0, cx1, 0.5 / n), fy = lerp(y0 + 5, y0 - 5, 0.5 / n); item(key, fx, fy, sk.size, "chunk", { z: k, box: [fx - sk.size * 1.4, fy - sk.size * 1.2, fx + sk.size * 1.4, fy + sk.size * 1.2] }); scene(img, skewerChunks(cx0, y0 + 5, cx1, y0 - 5, sk, st, k + 1, gone ? 1 : 0)); }
    }
    if (sk.glow && !burnt) for (let i = 0; i < 6; i++) glow(img, 60 + i * 24, 70 + (i % 3) * 20, 10, "#ff8a3a", 0.2);
    if (!burnt) { herb(img, 200, 120, 1.4, 2); if (sk.fish) lemon(img, 40, 124, 1.3); }
    return img;
  }
  function sausageCoil(img, cx, cy, R0, stage, seed) {
    const burnt = stage === "burnt", raw = stage === "raw", objs = [];
    const rp = burnt ? BURNT : raw ? R(["#5a2a24", "#8a4a40", "#b0685a", "#cc8a78", "#e8aa98"]) : R(["#2a0c04", "#4a1606", "#702408", "#98380e", "#be561c", "#dc7c34", "#f4a456"]);
    for (let t = 0; t < 1; t += 0.006) {
      const a = t * TAU * 3.2, r = R0 * (0.15 + t * 0.85), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.45;
      objs.push(blob(x, y, 7, 5, 6, (xx, yy, i) => {
        if (i.spec > 0.55 && !burnt) return i.spec > 0.8 ? "#fff0d8" : ramp(rp, 1, xx, yy);
        return ramp(rp, 0.15 + i.diff * 0.8 - i.ao * 0.4 + (h2(xx, yy, 3) > 0.93 ? -0.3 : 0), xx, yy);
      }, { k: 26, base: t * 0.5 }));
    }
    scene(img, objs);
  }
  function sausageServe(spec, o) {
    const img = tableBack(o.seed || 7);
    B.board(img, 120, 92, 112, 48, 4);
    geo("coil", { cx: 116, cy: 84, R: 82, end: [116 + Math.cos(TAU * 3.2) * 82, 84 + Math.sin(TAU * 3.2) * 82 * 0.45] }); geo("inside", RP.pink);
    sausageCoil(img, 116, 84, 82, o.burnt ? "burnt" : "cook", 3);
    stick(img, 30, 60, 210, 112, { w: 2 }); stick(img, 40, 112, 200, 56, { w: 2 });
    if (!o.burnt) { const f = bowl(img, 206, 60, 16, 7, 9, "clay"); geo("dip", [f.cx, f.cy]); scene(img, [liquid(f.cx, f.cy, f.rx, f.ry, 0, R(["#7a5004", "#a87008", "#d09a14", "#e8bc30", "#f8d860"]), { seed: 2, oil: 0, ripple: 0.4 })]); }
    return img;
  }

  // ---------- fried things ----------
  const BATTER = R(["#4a2006", "#7a3a0c", "#a85c18", "#cc8228", "#e8a840", "#f8cc6c", "#fff0b0"]);
  const FRY = {
    spider: { kind: "legs", vessel: "basket", batter: R(["#2a1006", "#4a1e08", "#6e3210", "#945020", "#b87030", "#d89448", "#f0bc70"]) },
    cod: { kind: "cod", vessel: "paper" },
    bat: { kind: "wings", vessel: "basket", spice: true },
    fish: { kind: "fillets", vessel: "cone", batter: R(["#3a1604", "#6a2c08", "#9a4a12", "#c4681e", "#de8a30", "#f0ae52", "#fcd890"]) },
    fritter: { kind: "balls", vessel: "plate", sugar: true, batter: R(["#3a1a08", "#5e2e10", "#86461a", "#a86228", "#c6823c", "#dea45a", "#f2c886"]) },
    frog: { kind: "frogs", vessel: "basket" },
  };
  function crispBits(cx, cy, rx, ry, fr, stage, seed, look) {
    const burnt = stage === "burnt", raw = stage === "raw", r = rng(seed), objs = [];
    const rp = burnt ? BURNT : raw ? R(["#8a7a5a", "#b4a47e", "#d8c8a0", "#efe2c2", "#fffaea"]) : look.batter || fr.batter || BATTER;
    const crisp = (xx, yy, i, k) => {
      if (fr.spice && !raw && !burnt && h2(xx, yy, k) > 0.86) return h2(xx, yy, k + 1) > 0.5 ? "#c8200c" : "#8a1006";
      if (fr.sugar && !raw && !burnt && h2(xx, yy, k) > 0.8 && i.diff > 0.4) return "#fffaf2";
      if (i.spec > 0.6 && !burnt) return "#fff6d8";
      let t = 0.12 + i.diff * 0.75 - i.ao * 0.45;
      if (raw || burnt) t += (fbm(xx / 1.6, yy / 1.6, k) - 0.5) * 0.45;
      else if (fr.kind === "fillets") t += (h2(xx, yy, k) > 0.72 ? 0.22 : h2(xx, yy, k) < 0.16 ? -0.28 : 0) + (fbm(xx / 3, yy / 3, k) - 0.5) * 0.15;
      else if (fr.kind === "cod") t += 0.12 + (fbm(xx / 4, yy / 3, k) - 0.5) * 0.5 + (i.spec > 0.3 ? 0.15 : 0);
      else if (fr.kind === "balls") t += (fbm(xx / 4, yy / 4, k) - 0.5) * 0.18 - (Math.abs(fbm(xx / 3, yy / 6, k + 4) - 0.5) < 0.03 ? 0.3 : 0);
      else t += (fbm(xx / 1.6, yy / 1.6, k) - 0.5) * 0.45;
      return ramp(rp, t, xx, yy, 0.5);
    };
    const N = { legs: 8, wings: 4, fillets: 7, balls: 15, frogs: 4, cod: 1 }[fr.kind] || 8;
    for (let i = 0; i < N; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.7, x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d, ang = r() * Math.PI, base = i * 0.9;
      if (fr.kind === "frogs") { const fx = cx - rx * 0.66 + i * (rx * 1.32 / 3), fy = cy - 6 + (i % 2) * 6; item("c" + i, fx, fy, 14, "frogs", { z: base, box: [fx - 20, fy - 20, fx + 20, fy + 24] }); if (taken("c" + i)) continue; }
      else if (fr.kind === "wings") { const wx = cx + (i % 2 ? 42 : -42), wy = cy - 13 + (i > 1 ? 26 : 0); item("c" + i, wx, wy + 8, 16, "wings", { z: base, box: [wx - 40, wy - 10, wx + 40, wy + 28] }); if (taken("c" + i)) continue; }
      else if (fr.kind === "legs") { const L0 = spiderLeg(cx, cy, i); item("c" + i, L0.mid[0], L0.mid[1], 14, "legs", { z: base, box: L0.box }); if (taken("c" + i)) continue; }
      else if (fr.kind !== "cod") { const bw = { legs: 52, fillets: 25, balls: 14 }[fr.kind] || 20; item("c" + i, x, y, 14, fr.kind, { z: base, ang, box: [x - bw, y - bw * 0.6 - 4, x + bw, y + bw * 0.6 + 4] }); if (taken("c" + i)) continue; }
      if (fr.kind === "legs") {
        const L0 = spiderLeg(cx, cy, i), leg = crabLeg(L0.x, L0.y, L0.ang, 56, 1.35, rp, raw ? "cook" : stage, i, { bends: L0.bends, rad: [3.6, 3, 2.2], base: base + 2 });
        const cf0 = leg.cf; leg.cf = (xx, yy, ii) => { const c0 = cf0(xx, yy, ii); if (!c0) return null; const c1 = C(c0); if (c1[0] + c1[1] + c1[2] < 120) return c0; return h2(xx, yy, i + 5) > 0.9 ? "#140804" : crisp(xx, yy, ii, i); };
        objs.push(leg);
        for (const [jx, jy] of L0.joints) objs.push(blob(jx, jy, 4.2, 3.6, 4, (xx, yy, ii) => (raw || burnt ? crisp(xx, yy, ii, i) : ramp(R(["#1a0804", "#3a1806", "#5a2a0c", "#7a4018"]), 0.2 + ii.diff * 0.7, xx, yy)), { k: 20, base: base + 3 }));
        if (i % 4 === 0) objs.push(blob(L0.x, L0.y, 13, 10, 10, (xx, yy, ii) => (!raw && !burnt && h2(Math.floor(xx / 2), Math.floor(yy / 2), i) > 0.82 ? "#2a1206" : crisp(xx, yy, ii, i + 9)), { wob: [[3, 0.12, i], [5, 0.06, i]], rough: 1.5, scale: 1.4, seed: i, k: 18, base: base + 8 }));
      } else if (fr.kind === "frogs") {
        // a pair of frog legs joined at the hip, in a row across the basket: fat thighs out to the knees, shins in, webbed feet splayed
        const px0 = cx - rx * 0.66 + i * (rx * 1.32 / 3), py0 = cy - 6 + (i % 2) * 6, rp2 = rp;
        for (const sd2 of [-1, 1]) {
          const hip = [px0 + sd2 * 2, py0 - 12], knee = [px0 + sd2 * 12, py0], ank = [px0 + sd2 * 7, py0 + 13];
          const fcf = (xx, yy, ii) => crisp(xx, yy, ii, i);
          objs.push(tube([hip, knee], (t) => 5.5 - t * 1.6, (xx, yy, ii) => fcf(xx, yy, ii), { base: base + 1 }));
          objs.push(tube([knee, ank], (t) => 3.6 - t * 1.4, (xx, yy, ii) => fcf(xx, yy, ii), { base: base + 0.5 }));
          for (const tq of [-1, 0, 1]) objs.push(tube([ank, [ank[0] + sd2 * 3 + tq * 4, ank[1] + 7]], (t) => 1.6 - t * 0.6, (xx, yy, ii) => fcf(xx, yy, ii), { base: base + 0.2 }));
          objs.push(blob(ank[0] + sd2 * 2, ank[1] + 4, 5, 3, 1.2, (xx, yy, ii) => ramp(rp2, 0.25 + ii.diff * 0.4, xx, yy), { base: base }));
        }
        continue;
      } else if (fr.kind === "frogsOld") {
        for (const sd2 of [-1, 1]) {
          const a0 = ang + sd2 * 0.5, leg = crabLeg(x, y, a0, 66, 1.1, rp, raw ? "cook" : stage, i * 2 + (sd2 > 0 ? 1 : 0), { bends: [0, sd2 * 1.25, -sd2 * 0.9], rad: [5.2, 3, 2.4], base: base + (sd2 > 0 ? 0.4 : 0) });
          const cf0 = leg.cf; leg.cf = (xx, yy, ii) => (cf0(xx, yy, ii) ? crisp(xx, yy, ii, i) : null);
          objs.push(leg);
        }
      } else if (fr.kind === "wings") {
        // a bat wing: the arm bone along the leading edge to the wrist, a hooked thumb claw there, three finger bones fanning out to the points
        // of the scalloped trailing edge, the thin dark membrane stretched between them
        const wx = cx + (i % 2 ? 42 : -42), wy = cy - 13 + (i > 1 ? 26 : 0), d2 = i % 2 ? 1 : -1, L = 36, D = 24, base2 = i > 1 ? 4 : 0, x = wx, y = wy;
        const MEM = raw || burnt ? rp : R(["#1e0604", "#3a0e06", "#5a180a", "#7a2410", "#9a3418", "#b84a24"]);
        const TIPS = [[-1, 0.62], [0.08, 1.0], [0.56, 0.82], [1, 0.05]], WR = [-0.05, 0.06];
        const edge = (u) => { for (let k2 = 0; k2 < 3; k2++) { const [ua, va] = TIPS[k2], [ub, vb] = TIPS[k2 + 1]; if (u <= ub) { const t = (u - ua) / (ub - ua); return lerp(va, vb, t) - Math.sin(t * Math.PI) * 0.42 * Math.min(va, vb + 0.4); } } return 0; };
        const segD = (u, v, a0, a1) => { const px2 = (u - a0[0]) * L, py2 = (v - a0[1]) * D, dx2 = (a1[0] - a0[0]) * L, dy2 = (a1[1] - a0[1]) * D, t = clamp((px2 * dx2 + py2 * dy2) / (dx2 * dx2 + dy2 * dy2), 0, 1); return Math.hypot(px2 - dx2 * t, py2 - dy2 * t); };
        const bone = (u, v) => Math.min(segD(u, v, [-1, 0.04], WR), ...TIPS.slice(1).map((tp) => segD(u, v, WR, tp)));
        const tilt = -0.38, ct = Math.cos(tilt), st2 = Math.sin(tilt), loc = (xx, yy) => { const ax = (xx - x) * d2, ay = yy - y; return [(ax * ct - ay * st2) / L, (ax * st2 + ay * ct) / D]; };
        objs.push({ x0: x - L - 3, y0: y - 22, x1: x + L + 3, y1: y + D + 14, k: 20, base: base + base2, hf: (xx, yy) => {
          const [u, v] = loc(xx, yy), bd = bone(u, v);
          if (u < -1 || u > 1) return null;
          if (bd < 2) return 3 + (2 - bd);
          if (v < 0.02 || v > edge(u)) return null;
          return 1.5;
        }, cf: (xx, yy, ii) => {
          const [u, v] = loc(xx, yy), bd = bone(u, v);
          if (bd < 2 || raw || burnt) return crisp(xx, yy, ii, i);
          if (h2(xx, yy, i) > 0.92) return h2(xx, yy, i + 1) > 0.5 ? "#e8301a" : "#8a1006";
          return ramp(MEM, 0.25 + ii.diff * 0.4 + (v > edge(u) - 0.08 ? 0.2 : 0) + (bd < 3.5 ? -0.1 : 0), xx, yy);
        } });
        const wrX = x + WR[0] * L * d2 * ct + 0, wrY = y + WR[0] * L * -st2 * 1;
        if (!raw && !burnt) objs.push(tube([[wrX, wrY + 1], [wrX + 2 * d2, wrY - 5], [wrX + 5 * d2, wrY - 6]], (t) => 1.8 - t, (xx, yy, ii) => crisp(xx, yy, ii, i), { base: base + base2 + 2 }));
      } else if (fr.kind === "fillets") {
        objs.push(blob(x, y, 22, 10, 7, (xx, yy, ii) => crisp(xx, yy, ii, i), { wob: [[2, 0.14, ang], [5, 0.06, i]], k: 18, rough: 2.5, scale: 1.3, seed: i, base }));
      } else if (fr.kind === "cod") {
        if (i > 0) continue;
        geo("mound", { cx, cy, rx: rx * 0.8, ry: ry * 0.7, h: 12, cut: true });
        objs.push(blob(cx, cy, rx * 0.8, ry * 0.7, 12, (xx, yy, ii) => (!raw && !burnt && h2(Math.floor(xx / 2), Math.floor(yy / 2), 5) > 0.975 ? "#2e5a1c" : crisp(xx, yy, ii, i)), { wob: [[1, 0.12, 0.5], [2, 0.08, 1], [6, 0.04, 2]], k: 14, rough: 7, scale: 4, seed: 3, base: 2 }));
      } else if (fr.kind === "balls") {
        objs.push(blob(x, y, 13, 11.5, 12, (xx, yy, ii) => crisp(xx, yy, ii, i), { wob: [[5, 0.05, ang]], k: 18, rough: 1.4, scale: 1.2, seed: i, base, pow: 0.6 }));
      }
    }
    return objs;
  }
  // where spider leg i sits: two clusters, each fanned out from its knuckle, the knees bent up
  function spiderLeg(cx, cy, i) {
    const c = i < 4 ? 0 : 1, kx = cx + (c ? 44 : -44), ky = cy - 2 + c * 4, A = [-2.35, 2.55, 0.6, -0.8][i % 4], sg = Math.cos(A) < 0 ? 1 : -1, bends = [0, sg * -0.75, sg * -0.45];
    const pts = [[kx, ky]];
    let a = A, x = kx, y = ky;
    [0.44, 0.34, 0.22].forEach((f, k) => { a += bends[k]; x += Math.cos(a) * 56 * f; y += Math.sin(a) * 56 * f * 0.8; pts.push([x, y]); });
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    return { x: kx, y: ky, ang: A, bends, joints: [pts[1], pts[2]], mid: pts[2], box: [Math.min(...xs) - 6, Math.min(...ys) - 6, Math.max(...xs) + 6, Math.max(...ys) + 6] };
  }
  // a cone of last week's tariff notices lying on its side, the mouth to the left, the fish spilling out
  function paperCone(img, cx, cy) {
    const lay = new Img(W, H), mx = cx - 70, my = cy - 6, tx = cx + 96, ty = cy + 14;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = tx - mx, dy = ty - my, L = Math.hypot(dx, dy), u = ((x - mx) * dx + (y - my) * dy) / (L * L), v = (-(x - mx) * dy + (y - my) * dx) / L;
      if (u < 0 || u > 1) continue;
      const half = (1 - u) * 34 + 1;
      if (Math.abs(v) > half) continue;
      const fold = Math.abs(v - (u - 0.5) * 20) < 0.7, print = (Math.floor(u * 40) % 3 === 0 && Math.abs(v) < half - 4 && h2(Math.floor(u * 60), Math.floor(v / 2), 4) > 0.35);
      lay.px(x, y, fold ? "#a89272" : print ? "#5a4a3a" : ramp(P.paper, 0.6 - v / half * 0.35 - u * 0.15, x, y));
    }
    const E = ell(mx, my, 10, 34);
    lay.fill((x, y) => (E(x + 0.5, y + 0.5) <= 1 ? (E(x + 0.5, y + 0.5) > 0.82 ? "#e6d4ae" : "#1e140c") : null), mx - 11, my - 35, mx + 11, my + 35);
    outline(lay, "#1a0e06");
    img.paste(lay, 0, 0);
    return { cx: mx - 4, cy: my + 4, rx: 46, ry: 26 };
  }
  function crispsServe(spec, o) {
    const look = spec.look, fr = Object.assign({}, FRY[spec.pal] || FRY.fish, look.fry || {}), img = tableBack(o.seed || 8);
    let f;
    if (fr.vessel === "cone") f = paperCone(img, 120, 90);
    else if (fr.vessel === "paper") { const lay = new Img(W, H); lay.fill((x, y) => { const u = (x - 120) * 0.95 + (y - 90) * 0.3, v = (y - 90) - (x - 120) * 0.12; return Math.abs(u) < 100 && Math.abs(v) < 44 ? ramp(P.paper, 0.6 + (h2(Math.floor(x / 3), y, 2) > 0.8 && Math.floor(y) % 4 === 0 ? -0.3 : 0), x, y) : null; }); outline(lay, "#1a0e06"); img.paste(lay, 0, 0); f = { cx: 120, cy: 88, rx: 92, ry: 36 }; }
    else if (fr.vessel === "plate") { platter(img, 120, 92, 112, 48, "clay", { rim: true }); f = { cx: 120, cy: 86, rx: 86, ry: 32 }; }
    else f = basket(img, 120, 80, 104, 42, 26, look.cloth || ["#8a7a64", "#b4a488", "#d8cbb0", "#efe4cc", "#a0281e"]);
    scene(img, crispBits(f.cx, f.cy - 6, f.rx, f.ry, fr, o.burnt ? "burnt" : "cook", 4, look));
    if (!o.burnt) {
      if (fr.vessel !== "plate") { const g = bowl(img, 210, 120, 18, 8, 10, "pewter"); geo("dip", [g.cx, g.cy]); scene(img, [liquid(g.cx, g.cy, g.rx, g.ry, 0, R(["#a89a7a", "#c8bc9a", "#e2d8bc", "#f4eedc"]), { seed: 2, oil: 0, ripple: 0.3 })]); for (let i = 0; i < 12; i++) img.px(g.cx - 6 + (i * 5) % 13, g.cy - 2 + (i % 3), "#4a7a2a"); }
      lemon(img, 32, 122, 1.4);
    }
    return img;
  }

  // ---------- breads ----------
  const BREADS = {
    spice: { kind: "buns", crust: R(["#3a1606", "#62280c", "#8e4214", "#b8621e", "#d8862e", "#f0ae4e", "#ffd88a"]), glaze: 0.6, swirl: true, n: 5 },
    yeti: { kind: "steamed", crust: R(["#8a8478", "#b4ae9e", "#d4cebe", "#ebe6da", "#f8f4ec", "#ffffff"]), n: 3 },
    grey: { kind: "loaf", crust: R(["#2a1c12", "#463224", "#644a34", "#806448", "#9c805e", "#b89c78"]), crumb: R(["#7a7466", "#9a9484", "#b8b2a0", "#d0cab8", "#e6e0d0"]) },
    flat: { kind: "flat", crust: R(["#6a4a22", "#9a7036", "#c4984e", "#e0bc72", "#f2d89c", "#fff2cc"]) },
    cheese: { kind: "toast", crust: R(["#3a1a06", "#6a320e", "#9a5420", "#c47c36", "#e0a456", "#f4c884"]) },
  };
  function breadServe(spec, o) {
    const look = spec.look, br = Object.assign({}, BREADS[spec.pal] || BREADS.spice, look.bread || {}, look.hair ? { hair: true } : {}), burnt = o.burnt, img = tableBack(o.seed || 9);
    B.board(img, 120, 96, 114, 46, 3);
    scene(img, breadObjs(br, burnt ? "burnt" : "cook", 120, 84, 1));
    breadAfter(img, br, burnt ? "burnt" : "cook", 120, 84, 1);
    return img;
  }
  function breadObjs(br, stage, cx, cy, s) {
    const burnt = stage === "burnt", raw = stage === "raw", objs = [];
    const crust = burnt ? BURNT : raw ? R(["#9a8a6a", "#c4b48e", "#e2d4b0", "#f6ecd2", "#fffaf0"]) : br.crust;
    const sh = (k) => (x, y, i) => {
      if (i.spec > 0.6 - (br.glaze || 0) * 0.2 && !burnt && !raw) return i.spec > 0.85 ? "#fff6e0" : ramp(crust, 1, x, y);
      return ramp(crust, 0.12 + i.diff * 0.8 - i.ao * 0.4 + (fbm(x / 3, y / 3, k) - 0.5) * 0.2, x, y);
    };
    if (br.kind === "buns" || br.kind === "steamed") {
      const pos = br.kind === "steamed" ? [[-40, 4, 30], [34, -4, 30], [0, 14, 32]] : [[-54, 0, 22], [-14, -10, 22], [26, -6, 22], [62, 4, 22], [6, 18, 24]];
      pos.forEach(([dx, dy, r], k) => item("b" + k, cx + dx * s, cy + dy * s, r * s, br.kind, { z: dy }) || taken("b" + k) || objs.push(blob(cx + dx * s, cy + dy * s, r * s, r * 0.8 * s, r * 0.75 * s, sh(k), { wob: [[3, 0.05, k]], k: 18, base: dy * 0.1 })));
    } else if (br.kind === "loaf") {
      geo("mound", { cx: cx + 10 * s, cy: cy - 4 * s, rx: 64 * s, ry: 30 * s, h: 26, cut: true });
      objs.push(blob(cx + 10 * s, cy - 4 * s, 64 * s, 30 * s, 18 * s, (x, y, i) => {
        const sl = ((x - y * 0.6) % 22 + 22) % 22;
        if (!raw && !burnt && sl < 2.4 && Math.abs(y - cy + 4 * s) < 22 * s) return ramp(br.crust, 0.05 + i.diff * 0.3, x, y);
        if (!raw && !burnt && sl < 4 && Math.abs(y - cy + 4 * s) < 22 * s) return ramp(br.crust, 0.75 + i.diff * 0.25, x, y);
        if (!raw && !burnt && i.diff > 0.62 && h2(x, y, 3) > 0.88) return "#e0d8c6";
        return sh(1)(x, y, i);
      }, { pow: 0.6, wob: [[2, 0.06, 1], [5, 0.03, 2]], k: 14 }));
    } else if (br.kind === "flat") {
      for (let k = 0; k < 2; k++) geo("flat" + k, { cx: cx + (k ? 28 : -24) * s, cy: cy + (k ? 6 : -6) * s, rx: 58 * s, ry: 26 * s, h: 4 });
      for (let k = 0; k < 2; k++) objs.push(blob(cx + (k ? 28 : -24) * s, cy + (k ? 6 : -6) * s, 58 * s, 26 * s, 4 * s, (x, y, i) => (!raw && !burnt && fbm(x / 4, y / 3, k + 6) > 0.68 ? "#3a1a08" : sh(k)(x, y, i)), { wob: [[3, 0.06, k], [7, 0.03, k]], pow: 0.25, k: 14, base: k * 4 }));
    } else if (br.kind === "toast") {
      for (let k = 0; k < 2; k++) {
        const bx = cx + (k ? 36 : -36) * s, by = cy + (k ? 6 : -6) * s, w = 34 * s, h = 22 * s, th = 9 * s;
        item("t" + k, bx, by, w, "toast", { z: k });
        if (taken("t" + k)) continue;
        objs.push({ x0: bx - w - 4, y0: by - h - 4, x1: bx + w + 4, y1: by + h + th + 4, base: k * 3, k: 20, hf: (x, y) => {
          const u = Math.abs(x - bx) / w, v = (y - by) / h;
          if (u > 1 || v < -1 || v > 1 + th / h) return null;
          return v > 1 ? th - (v - 1) * h : th + (raw ? 0 : Math.max(0, 1 - Math.max(u, Math.abs(v))) * 6);
        }, cf: (x, y, i) => {
          const u = Math.abs(x - bx) / w, v = (y - by) / h, drip = !raw && v > 1 && Math.sin(x * 0.7 + k) > 0.3 && v < 1 + (Math.sin(x * 0.31 + k * 2) * 0.5 + 0.5) * th / h;
          if (v > 1 && !drip) return ramp(br.crust, 0.15 + (h2(x, y, k) > 0.7 ? 0.1 : 0), x, y);
          if (u > 0.9 || v < -0.88) return ramp(br.crust, 0.3 + i.diff * 0.5, x, y);
          if (raw) return ramp(R(["#c8b48e", "#e2d4b0", "#f6ecd2"]), i.diff, x, y);
          if (burnt) return ramp(BURNT, i.diff, x, y);
          if (fbm(x / 4, y / 3, k + 2) > 0.66) return ramp(R(["#7a3a08", "#a85c14", "#d08424"]), i.diff, x, y);
          return i.spec > 0.5 ? "#fffbe0" : ramp(R(["#c8901a", "#e8b030", "#f8cc4a", "#ffe478", "#fff4b0"]), 0.2 + i.diff * 0.8, x, y);
        } });
      }
    }
    return objs;
  }
  function breadAfter(img, br, stage, cx, cy, s) {
    if (stage === "raw" || stage === "burnt") return;
    if (br.swirl) [[-54, 0], [-14, -10], [26, -6], [62, 4], [6, 18]].forEach(([dx, dy], q) => { if (taken("b" + q)) return; const dir = br.feud && q % 2 ? -1 : 1; for (let k = 0; k < 34; k++) { const a = k * 0.42 * dir, r = k * 0.42 * s; img.px(cx + dx * s + Math.cos(a) * r, cy + dy * s - 6 * s + Math.sin(a) * r * 0.6, k % 3 ? "#5a2208" : "#ffe8c0"); } for (let k = 0; k < 8; k++) img.px(cx + dx * s + (h2(k, q, 1) - 0.5) * 24 * s, cy + dy * s - 6 * s + (h2(q, k, 2) - 0.5) * 12 * s, "#ffffff"); });
    if (br.hair && stage !== "burnt" && !taken("b1")) { for (let k = 0; k < 40; k++) { const t = k / 40; img.px(cx + 30 * s + Math.sin(t * 5) * 6 * s + t * 20 * s, cy - 30 * s - t * 26 * s, "#fbfbfb"); img.px(cx + 30 * s + Math.sin(t * 5) * 6 * s + t * 20 * s + 1, cy - 30 * s - t * 26 * s, "#b8b8c0", 0.6); } }
    if (br.kind === "steamed") for (const [q, [dx, dy]] of [[-40, 4], [34, -4], [0, 14]].entries()) for (let k = 0; k < 7 && !taken("b" + q); k++) { const a = (k / 7) * TAU; img.line(cx + dx * s, cy + dy * s - 14 * s, cx + dx * s + Math.cos(a) * 9 * s, cy + dy * s - 14 * s + Math.sin(a) * 5 * s, "#c8c2b4"); }
    if (br.kind === "loaf") {
      for (let k = 0; k < 3; k++) { const lay = new Img(W, H), sx = cx - 70 * s + k * 10 * s, sy = cy + 14 * s + k * 3 * s; item("l" + k, sx, sy, 16 * s, "breadslice", { z: k, box: [sx - 18 * s, sy - 22 * s, sx + 18 * s, sy + 22 * s] }); if (taken("l" + k)) continue; scene(lay, [blob(sx, sy, 16 * s, 20 * s, 4, (x, y, i) => { const d = Math.hypot((x - sx) / (16 * s), (y - sy) / (20 * s)); return d > 0.82 ? ramp(br.crust, 0.25 + i.diff * 0.6, x, y) : ramp(br.crumb, 0.45 + i.diff * 0.45 + (h2(x, y, k) > 0.9 ? -0.2 : 0) - d * 0.15, x, y); }, { pow: 0.1, k: 10, base: k })]); outline(lay, "#0a0806"); img.paste(lay, 0, 0); }
      const f = bowl(img, 196, 112, 22, 9, 12, "clay"); geo("dip", [f.cx, f.cy]); scene(img, [blob(f.cx, f.cy, f.rx, f.ry, 3, shade(R(["#a89a7a", "#c8bc9a", "#e2d8bc", "#f4eedc", "#ffffff"]), { base: 0.3 }), { k: 10 })]);
      for (let i = 0; i < 20; i++) { const r = rng(i); img.px(cx + (r() - 0.5) * 120 * s, cy - 20 * s + (r() - 0.5) * 30 * s, "#f0e8d8"); }
    }
  }

  // ---------- pies and pasties ----------
  const PASTRY = R(["#4a2208", "#7a3c10", "#a8601e", "#cc8434", "#e6a852", "#f6cc80", "#fff0c0"]);
  const PIES = {
    pie: { kind: "round", filling: RP.brown, vent: true },
    pasty: { kind: "pasty", filling: RP.potato },
    eel: { kind: "round", filling: R(["#3a3a2a", "#5a5a42", "#7a7a5a", "#9a9a76", "#bcbc96"]), eels: 4 },
    crab: { kind: "chest", filling: R(["#8a4a3a", "#b06a54", "#d08a70", "#e8ae94", "#f8d0bc"]) },
    stargazy: { kind: "round", filling: R(["#6a4a3a", "#9a7258", "#c49a7a", "#e2bea0", "#f4dcc4"]), stargazy: 7 },
  };
  function pieServe(spec, o) {
    const look = spec.look, pi = Object.assign({}, PIES[spec.pal] || PIES.pie, look.pie || {}), burnt = o.burnt, img = tableBack(o.seed || 10);
    if (pi.kind === "pasty") B.board(img, 120, 98, 112, 44, 5); else platter(img, 120, 94, 114, 48, pi.kind === "chest" ? "pewter" : "clay", { rim: true });
    pieTop(img, pi, burnt ? "burnt" : "cook", 120, 84, 1, look);
    if (!burnt && pi.knob) scene(img, [blob(196, 118, 9, 5, 5, shade(PASTRY, { base: 0.2, noise: 0.3, seed: 2 }), { wob: [[3, 0.2, 1]], k: 16 })]);
    if (!burnt && pi.emblem) for (const dx of [-38, 40]) { const ex = 120 + dx, ey = 74 + (dx > 0 ? 8 : -6); scene(img, [blob(ex, ey - 3, 9, 5, 5, shade(PASTRY, { base: 0.35 }), { k: 16, base: 20 }), blob(ex, ey + 3, 3, 4, 4, shade(PASTRY, { base: 0.45 }), { k: 16, base: 18 })]); }
    return img;
  }
  function pieTop(img, pi, stage, cx, cy, s, look) {
    const burnt = stage === "burnt", raw = stage === "raw", objs = [];
    const crust = burnt ? BURNT : raw ? R(["#9a8a6a", "#c4b48e", "#e2d4b0", "#f6ecd2", "#fffaf0"]) : look.pastry || PASTRY;
    const sh = (k) => (x, y, i) => {
      if (i.spec > 0.6 && !burnt && !raw) return i.spec > 0.85 ? "#fff6e0" : ramp(crust, 1, x, y);
      return ramp(crust, 0.12 + i.diff * 0.8 - i.ao * 0.4 + (fbm(x / 2.5, y / 2.5, k) - 0.5) * 0.25, x, y);
    };
    if (pi.kind === "round") {
      const rx = 82 * s, ry = 36 * s, E = ell(cx, cy, rx, ry);
      geo("pie", { cx, cy, rx, ry, h: 10 * s }); geo("inside", pi.filling);
      const wedge = () => false;
      const tower = (x, y) => { const u = x - cx, v = cy + 4 * s - y; if (Math.abs(u) > 9 * s || v < 0 || v > 22 * s) return 0; if (v > 18 * s && Math.floor((u + 9 * s) / (3.6 * s)) % 2) return 0; return Math.abs(u) < 2.5 * s && v < 6 * s ? 2 : 1; };
      const gaze = pi.stargazy && !raw ? stargazyCrust(cx, cy, s) : null;
      objs.push({ x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry, k: 16, hf: (x, y) => { const d = E(x, y); if (d > 1) return null; if (wedge(x, y)) return 3; const crimp = d > 0.86 ? Math.abs(Math.sin(Math.atan2(y - cy, x - cx) * 22)) * 2.5 + 2 : 0; const crest = pi.crest && !raw ? [0, 2.5, 0.5][tower(x, y)] : 0; return Math.pow(1 - d * d, 0.35) * 10 * s + crimp + crest + (gaze && d <= 0.86 ? gaze.h(x, y) : 0); }, cf: (x, y, i) => {
        const d = E(x, y);
        if (wedge(x, y)) return ramp(pi.filling, 0.25 + i.diff * 0.4 + (fbm(x / 3, y / 3, 6) - 0.5) * 0.7, x, y);
        if (gaze && d <= 0.86) { const c = gaze.c(x, y, i, crust, burnt); if (c) return c; }
        if (pi.crest && !raw && tower(x, y)) return tower(x, y) === 2 ? "#3a1806" : ramp(crust, 0.45 + i.diff * 0.5, x, y);
        if (pi.vent && !pi.crest && [-0.35, 0, 0.35].some((o) => Math.abs((x - cx) / rx - o) < 0.03 && Math.abs((y - cy) / ry - o * 0.3) < 0.18)) return "#3a1806";
        return sh(1)(x, y, i);
      } });
    } else if (pi.kind === "pasty") {
      for (let k = 0; k < 2; k++) {
        const px = cx + (k ? 40 : -38) * s, py = cy + (k ? 8 : -6) * s, rx = 46 * s, ry = 24 * s;
        item("p" + k, px, py, rx * 0.8, "pasty", { z: k, box: [px - rx - 2, py - ry - 2, px + rx + 2, py + ry * 0.6 + 3] });
        if (taken("p" + k)) continue;
        objs.push({ x0: px - rx, y0: py - ry, x1: px + rx, y1: py + ry, k: 16, base: k * 2, hf: (x, y) => { const u = (x - px) / rx, v = (y - py) / ry; if (v > 0.55 || Math.hypot(u, v * 0.9 + 0.1) > 1) return null; const ridge = v < -0.1 && v > -0.35 && Math.hypot(u, v * 0.9 + 0.1) < 0.98 ? 0 : 0; const crimp = Math.hypot(u, v * 0.9 + 0.1) > 0.82 ? 2 + Math.abs(Math.sin(Math.atan2(v, u) * 16)) * 3 : 0; return (0.55 - v) * 14 * s * (1 - Math.abs(u) * 0.5) + crimp + ridge; }, cf: sh(k + 2) });
      }
    } else if (pi.kind === "chest") {
      // the Mimic King's treasure bake: a pastry chest, its lid thrown back (a row of pastry teeth along its edge: someone always checks),
      // heaped with white crab meat, a claw poking out, a few gold coins
      const w = 64 * s, fh = 28 * s, top = cy + 2 * s, depth = 15 * s, back = top - depth, lh = 34 * s, lay = new Img(W, H);
      lay.fill((x, y) => { const fx = (x - cx) / w, ly = back - y; if (ly < 0 || ly > lh) return null; const wd = 1 - (ly / lh) * 0.06; if (Math.abs(fx) > wd) return null; const edge = Math.abs(fx) > wd - 0.05 || ly > lh - 3; return ramp(crust, edge ? 0.5 : 0.78 - (ly / lh) * 0.25 + (Math.abs(Math.abs(fx) - 0.6) < 0.06 ? -0.25 : 0) + (fbm(x / 3, y / 3, 5) - 0.5) * 0.2, x, y); });
      lay.fill((x, y) => { const fx = (x - cx) / w; if (Math.abs(fx) > 1 || y < back || y >= top) return null; return Math.abs(fx) > 0.94 || y < back + 2 ? ramp(crust, 0.45, x, y) : "#2a1006"; });
      lay.fill((x, y) => { const fx = (x - cx) / w, fy = (y - top) / fh; if (Math.abs(fx) > 1 || fy < 0 || fy > 1) return null; const strap = Math.abs(Math.abs(fx) - 0.6) < 0.07, rim = fy < 0.12; return ramp(crust, (strap ? 0.28 : 0.62) - fx * 0.22 - fy * 0.35 + (rim ? 0.2 : 0) + (fbm(x / 3, y / 3, 3) - 0.5) * 0.2, x, y); });
      if (!raw && !burnt) {
        for (let k = -7; k <= 7; k++) { const tx = cx + k * w * 0.13; for (let j = 0; j < 5; j++) for (let i = -2; i <= 2; i++) if (Math.abs(i) <= 2 - j * 0.45) lay.px(tx + i, back - lh + 3 + j, j < 1 ? "#fff6e0" : "#efe2c6"); }
        lay.rect(cx - 6, top + 6, 12, 11, "#e8b84a"); lay.rect(cx - 5, top + 7, 10, 1, "#fff0a0"); lay.rect(cx - 1, top + 9, 2, 5, "#4a2a06");
      }
      outline(lay, "#1a0a04");
      img.paste(lay, 0, 0);
      if (!raw && !burnt) {
        const CRAB = R(["#a88878", "#ccac9c", "#e8cebe", "#f8eadc", "#ffffff"]);
        geo("mound", { cx: cx + 10, cy: top - depth * 0.55, rx: w * 0.55, ry: depth * 0.4, h: 8, scoop: true }); geo("inside", CRAB);
        objs.push(blob(cx, top - depth * 0.55, w * 0.9, depth * 0.85, 10, (x, y, i) => (i.spec > 0.55 ? "#ffffff" : h2(Math.floor(x / 2), Math.floor(y / 2), 4) > 0.82 ? ramp(R(["#c8604a", "#e88a6a", "#f8b090"]), 0.3 + i.diff * 0.6, x, y) : ramp(CRAB, 0.25 + i.diff * 0.65 + (Math.sin(x * 0.9 + fbm(x / 4, y / 3, 2) * 4) > 0.65 ? -0.2 : 0), x, y)), { wob: [[5, 0.08, 1], [9, 0.05, 2]], rough: 2, scale: 2, k: 24, base: 2 }));
        objs.push(crabClaw(cx - w * 0.5, top - depth - 4, 0.75, -1.2, RP.shellR, "cook", 3, { base: 16, short: true }));
        for (const [dx, dy] of [[0.45, -0.9], [0.62, -0.6], [0.3, -0.5]]) objs.push(blob(cx + w * dx, top + depth * dy, 4, 2.5, 2, (x, y, i) => (i.spec > 0.4 ? "#fff6c8" : ramp(RP.gold, 0.3 + i.diff * 0.6, x, y)), { k: 30, base: 14 }));
      }
    }
    scene(img, objs);
    if (burnt && pi.stargazy) stargazyTop(img, pi.stargazy, cx, cy, s, true);
    if (raw || burnt) return;
    if (pi.kind === "round") {
      const lay = new Img(W, H);
      if (pi.moat) { const E2 = ell(cx, cy, 82 * s, 36 * s), E3 = ell(cx, cy + 2, 96 * s, 42 * s); lay.fill((x, y) => (E2(x + 0.5, y + 0.5) > 1 && E3(x + 0.5, y + 0.5) <= 1 ? (h2(x, y, 3) > 0.96 ? "#ffd8a0" : ramp(RP.brown, 0.35 + Math.sin(x * 0.3) * 0.08, x, y)) : null)); }
      img.paste(lay, 0, 0);
      for (let k = 0; k < (pi.eels || 0); k++) { const a = (k / pi.eels) * TAU + 0.4, x = cx + Math.cos(a) * 40 * s, y = cy + Math.sin(a) * 16 * s; eelHead(img, x, y - 6, a, s); }
      for (let k = 0; k < (pi.tails || 0); k++) { const a = (k / pi.tails) * TAU + 0.2, x = cx + Math.cos(a) * 44 * s, y = cy + Math.sin(a) * 17 * s; serpentTail(img, x, y - 4, s, k); }
      if (pi.stargazy) stargazyTop(img, pi.stargazy, cx, cy, s);
    }
  }
  // Stargazy: an egg-washed crust laid in fish-scale rows, three star-shaped vents, serpent heads round the rim gazing up and a tail-tip curling out of the middle
  const SERP = R(["#081816", "#0e2a28", "#184440", "#26605a", "#3a8076", "#5aa494", "#8ccab8", "#c8f0e0"]);
  const STAR_VENTS = [[-36, -6, 11], [34, -8, 10], [-6, 14, 12]];
  function starIn(x, y, sx, sy, r) {
    const dx = x - sx, dy = (y - sy) * 2.1, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
    return d < r * (0.5 + 0.5 * Math.pow(Math.abs(Math.cos(a * 2.5)), 3));
  }
  function stargazyCrust(cx, cy, s) {
    const vents = STAR_VENTS.map(([dx, dy, r]) => [cx + dx * s, cy + dy * s * 0.9, r * s]);
    const scale = (x, y) => {
      const v = (y - cy) / (5.2 * s) + 20, row = Math.floor(v), u = (x - cx) / (9 * s) + (row % 2 ? 0.5 : 0) + 20;
      const fx = u - Math.floor(u) - 0.5, fy = v - row;
      return { r: Math.hypot(fx, fy * 0.9), fy };
    };
    return {
      h: (x, y) => { if (vents.some(([vx, vy, r]) => starIn(x, y, vx, vy, r))) return -6 * s; const q = scale(x, y); return (q.r < 0.5 ? (0.5 - q.r) * 2.6 : 0) * s; },
      c: (x, y, i, crust, burnt) => {
        for (const [vx, vy, r] of vents) if (starIn(x, y, vx, vy, r)) { if (burnt) return "#0a0402"; const t = 0.15 + (y - vy) / r * 0.5 + (fbm(x / 2, y / 2, 4) - 0.5) * 0.4; return h2(x, y, 7) > 0.9 && t > 0.3 ? "#ffe8c0" : ramp(R(["#1a0804", "#3a1608", "#5e2a10", "#8a4a22", "#b8743a"]), t, x, y); }
        for (const [vx, vy, r] of vents) if (starIn(x, y, vx, vy, r + 1.6 * s)) return ramp(crust, 0.85 + i.diff * 0.2, x, y);
        const q = scale(x, y), edge = Math.abs(q.r - 0.5) < 0.07;
        if (edge) return ramp(crust, 0.08 + i.diff * 0.35, x, y);
        if (!burnt && i.spec > 0.5 && q.fy < 0.45) return i.spec > 0.75 ? "#fff6e0" : mix(ramp(crust, 1, x, y), "#ffffff", 0.3);
        return ramp(crust, 0.2 + i.diff * 0.75 - i.ao * 0.4 + (0.45 - q.fy) * 0.3 + (fbm(x / 2.5, y / 2.5, 1) - 0.5) * 0.18, x, y);
      },
    };
  }
  function stargazyTop(img, n, cx, cy, s, burnt) {
    const col = burnt ? BURNT : SERP, heads = [];
    for (let k = 0; k < n; k++) { const a = (k / n) * TAU - TAU / 4 + 0.3, x = cx + Math.cos(a) * 66 * s, y = cy + Math.sin(a) * 27 * s; heads.push({ a, x, y, k }); }
    heads.sort((p, q) => p.y - q.y);
    tailTip(img, cx + 10 * s, cy + 6 * s, s, col, burnt);
    for (const hd of heads) serpentHead(img, hd.x, hd.y, s * (0.85 + 0.25 * (hd.y - cy + 27 * s) / (54 * s)), hd.k, Math.cos(hd.a), col, burnt);
    if (!burnt) for (const [dx, dy] of STAR_VENTS) steam(img, cx + dx * s, cy + dy * s * 0.9 - 3, 26 * s, dx * 0.1, 0.28, 2.5, 2);
  }
  function serpentHead(img, x, y, s, k, lean, col, burnt) {
    const lay = new Img(W, H), dir = lean >= 0 ? 1 : -1, fire = R(["#7a2a10", "#b0461a", "#d8702a", "#f0a050"]);
    const tone = (t, X, Y) => (burnt ? ramp(BURNT, t * 0.6, X, Y) : ramp(col, t, X, Y));
    shadow(img, x, y + 1, 7 * s, 3 * s, 0.6);
    for (let j = 0; j < 3 * s; j++) for (let q = -5 * s; q <= 5 * s; q++) if (Math.hypot(q / (5.5 * s), j / (3 * s)) < 1) img.px(x + q, y + j - 1, "#1a0a04", 0.85);
    let px = x, py = y, th = -Math.PI / 2 - dir * 0.15;
    const L = 12 * s;
    for (let j = 0; j < L; j++) {
      const t = j / L, w = 2.8 * s - t * 0.6 * s, nx = -Math.sin(th), ny = Math.cos(th);
      th += dir * 0.035 / s;
      px += Math.cos(th); py += Math.sin(th);
      for (let q = -w; q <= w; q += 0.5) lay.px(px + nx * q, py + ny * q, tone(0.42 + (q / w) * dir * 0.28 + (j % 3 === 0 ? -0.08 : 0) + (Math.abs(q) < w * 0.3 ? 0.12 : 0), Math.floor(px + nx * q), Math.floor(py + ny * q)));
    }
    const ang = -Math.PI / 2 + dir * 0.75, ax = Math.cos(ang), ay = Math.sin(ang), bx = -ay, by = ax, hl = 6.5 * s, hw = 3.8 * s, hcx = px + ax * 2 * s, hcy = py + ay * 2 * s;
    for (let yy = Math.floor(hcy - 10 * s); yy <= hcy + 10 * s; yy++) for (let xx = Math.floor(hcx - 10 * s); xx <= hcx + 10 * s; xx++) {
      const dx = xx + 0.5 - hcx, dy = yy + 0.5 - hcy, u = (dx * ax + dy * ay) / hl, v = (dx * bx + dy * by) / hw;
      const wid = u < -0.4 ? Math.sqrt(Math.max(0, 1 - Math.pow((u + 0.4) / 0.6, 2))) : 1 - Math.pow((u + 0.4) / 1.4, 2) * 0.55;
      if (u < -1 || u > 1 || Math.abs(v) > wid) continue;
      const vv = v / Math.max(0.01, wid), lit = -vv * dir * (dir > 0 ? 1 : -1);
      lay.px(xx, yy, tone(0.5 + vv * -0.3 * dir * Math.sign(by || 1) + (u > 0.6 ? 0.08 : 0) + (Math.abs(vv) < 0.3 && u < 0.5 ? 0.14 : 0) + lit * 0, xx, yy));
    }
    if (!burnt) for (let f = 0; f < 3; f++) { const fx = hcx - ax * (4 + f * 1.8) * s - bx * 2.5 * s * dir, fy = hcy - ay * (4 + f * 1.8) * s - by * 2.5 * s * dir; for (let q = 0; q < (4 - f) * 1.3 * s; q++) lay.px(fx - bx * q * dir * 0.6 - ax * q * 0.5, fy - by * q * dir * 0.6 - ay * q * 0.5, ramp(fire, 0.85 - q * 0.1, Math.floor(fx), Math.floor(fy))); }
    outline(lay, "#061210");
    img.paste(lay, 0, 0);
    if (burnt) return;
    const sx = hcx + ax * hl * 0.15, sy = hcy + ay * hl * 0.15;
    for (let q = 0; q < hl * 0.85; q++) { const mx = sx + ax * q + bx * hw * 0.35 * dir, my = sy + ay * q + by * hw * 0.35 * dir; img.px(mx, my, "#2a0606"); if (q > 1 && q < hl * 0.7) img.px(mx + bx * dir, my + by * dir, "#c84a3a", 0.85); }
    const ex = Math.round(hcx - bx * hw * 0.25 * dir), ey = Math.round(hcy - by * hw * 0.25 * dir);
    img.rect(ex - 1, ey - 1, 3, 3, "#fff8d8"); img.px(ex + Math.round(ax), ey + Math.round(ay) - 1, "#0a0a06"); img.px(ex + Math.round(ax), ey + Math.round(ay), "#0a0a06");
    star(img, hcx + ax * 14 * s + (k % 2 ? 3 : -2), hcy + ay * 14 * s - (k % 3) * 2, "#fffbe8", k % 2 ? 1 : 2, 0.85);
  }
  function tailTip(img, x, y, s, col, burnt) {
    const lay = new Img(W, H), L = 34 * s;
    let px = x, py = y, th = -Math.PI / 2 + 0.25;
    for (let j = 0; j < L; j++) {
      const t = j / L, w = (1 - t * 0.9) * 3.6 * s + 0.5;
      th += t > 0.4 ? 0.3 * (t - 0.4) / 0.6 / s : -0.01;
      px += Math.cos(th); py += Math.sin(th);
      const nx = -Math.sin(th), ny = Math.cos(th);
      for (let q = -w; q <= w; q += 0.5) lay.px(px + nx * q, py + ny * q, burnt ? ramp(BURNT, 0.3, Math.floor(px), Math.floor(py)) : ramp(col, 0.34 - (q / w) * 0.3 + (j % 3 === 0 ? 0.1 : 0) + (Math.abs(q) < w * 0.3 ? 0.16 : 0), Math.floor(px + nx * q), Math.floor(py + ny * q)));
      if (!burnt && t > 0.15 && t < 0.6 && j % 2 === 0) { const fl = (1 - Math.abs(t - 0.38) * 4) * 5 * s; for (let f = 1; f < fl; f++) lay.px(px - nx * (w + f), py - ny * (w + f) - f * 0.3, ramp(R(["#7a2a10", "#b0461a", "#d8702a", "#f0a050"]), 0.9 - f * 0.1, Math.floor(px), Math.floor(py)), 0.95); }
    }
    outline(lay, "#061210");
    for (let j = 0; j < 3 * s; j++) for (let q = -6 * s; q <= 6 * s; q++) if (Math.hypot(q / (6.5 * s), j / (3 * s)) < 1) img.px(x + q, y + j - 1, "#1a0a04", 0.85);
    img.paste(lay, 0, 0);
  }

  function eelHead(img, x, y, a, s) {
    s *= 1.5;
    scene(img, [blob(x, y, 5 * s, 4 * s, 6 * s, shade(R(["#141a10", "#24301c", "#384a2a", "#50663c", "#6c8450"]), { base: 0.15, glint: 0.5 }), { k: 30, base: 20 })]);
    img.rect(x - 2 * s, y - 2 * s, 2, 2, "#fffbe8"); img.px(x - 2 * s + 1, y - 2 * s + 1, "#101008");
    img.rect(x + 1 * s, y - 2 * s, 2, 2, "#fffbe8"); img.px(x + 1 * s, y - 2 * s + 1, "#101008");
  }
  function serpentTail(img, x, y, s, k) {
    for (let j = 0; j < 16 * s; j++) { const t = j / (16 * s), px = x + Math.sin(t * 3 + k) * 3 * s * t, py = y - j, w = (1 - t) * 3.5 * s + 0.6; for (let q = -w; q <= w; q++) img.px(px + q, py, ramp(R(["#0e2a2a", "#184440", "#26605a", "#3a8076", "#5aa494", "#8ccab8"]), 0.3 + (q / w) * -0.3 + (j % 3 === 0 ? 0.15 : 0), Math.floor(px + q), Math.floor(py))); }
    star(img, x, y - 16 * s, "#fffbe8", 1, 0.7);
  }

  // ---------- sweets ----------
  function sweetServe(spec, o) {
    const look = spec.look, kind = look.sweet || { trifle: "trifle", berry: "tart", honey: "cake", toffee: "toffee" }[spec.pal] || "tart", burnt = o.burnt, img = tableBack(o.seed || 11);
    SWEETS[kind](img, spec, burnt ? "burnt" : "cook", 120, 84, 1);
    return img;
  }
  const SWEETS = {
    trifle(img, spec, stage, cx, cy, s) {
      const layers = [[R(["#6a3a10", "#9a5a1e", "#c47e34", "#e0a454", "#f0c47c"]), 0.18], [R(["#3a0610", "#6a0e1c", "#9a1e2a", "#c8303a", "#e85a5a"]), 0.14], [RP.custard, 0.2], [R(["#6a3a10", "#9a5a1e", "#c47e34", "#e0a454", "#f0c47c"]), 0.14], [RP.cream, 0.22]];
      const top = cy - 44 * s, bot = cy + 44 * s, lay = new Img(W, H);
      shadow(img, cx, bot + 4, 60 * s, 8 * s, 0.5);
      for (let y = Math.floor(top); y < bot; y++) {
        const v = (y - top) / (bot - top), w = (60 - Math.pow(v, 2) * 22) * s;
        let acc = 0, rp = layers[0][0];
        for (const [r2, h] of layers.slice().reverse()) { acc += h; if (v < acc) { rp = r2; break; } }
        if (stage === "burnt") rp = BURNT;
        for (let x = Math.floor(cx - w); x <= cx + w; x++) { const u = (x - cx) / w, glass = Math.abs(u) > 0.9; lay.px(x, y, glass ? mix(ramp(rp, 0.6, x, y), "#d8f0ff", 0.4) : ramp(rp, 0.55 - u * 0.25 + (fbm(x / 4, y / 3, 3) - 0.5) * 0.3, x, y)); }
        if (y % 1 === 0) { lay.px(cx - w * 0.82, y, "#ffffff", 0.35); }
      }
      for (let y = Math.floor(bot); y < bot + 14 * s; y++) for (let x = Math.floor(cx - 18 * s); x <= cx + 18 * s; x++) lay.px(x, y, mix("#a8c8d8", "#ffffff", 0.3 - (x - cx) / (18 * s) * 0.3));
      outline(lay, "#0a1014");
      img.paste(lay, 0, 0);
      scene(img, [blob(cx, top, 60 * s, 14 * s, 6 * s, shade(RP.cream, { base: 0.35 }), { wob: [[6, 0.06, 1]], k: 12 })]);
      geo("mound", { cx, cy: top, rx: 54 * s, ry: 12 * s, h: 6, layers: layers.map((l) => l[0]) });
      if (stage !== "burnt" && spec.look.flag) { for (let j = 0; j < 30 * s; j++) img.px(cx + 30 * s, top - 4 - j, "#d8c8a0"); img.rect(cx + 30 * s + 1, top - 30 * s, 12, 8, "#f4ead0"); K.text(img, "+", cx + 30 * s + 4, top - 30 * s + 7, "#7a1a10"); }
      if (stage !== "burnt") { scene(img, scatter(cx, top - 2, 44 * s, 9 * s, [["berry", 9, 4.5 * s]], { berryC: R(["#2a0408", "#5a0a14", "#8a1622", "#b82a30", "#e04a48"]) }, 5, 8)); for (let k = 0; k < 5; k++) { const px = cx - 30 * s + k * 15 * s; img.rect(px, top - 6 * s - (k % 2) * 3, 2, 2, "#2a1a10"); img.px(px + 2, top - 7 * s - (k % 2) * 3, "#2a1a10"); } }
    },
    tart(img, spec, stage, cx, cy, s) {
      platter(img, cx, cy + 10, 110 * s, 46 * s, "clay", { rim: true });
      const E = ell(cx, cy, 84 * s, 34 * s), burnt = stage === "burnt";
      if (spec.look.crumble) geo("mound", { cx, cy, rx: 70 * s, ry: 28 * s, h: 6 }); else { geo("pie", { cx, cy, rx: 84 * s, ry: 34 * s, h: 6 }); geo("inside", RP.bramble); }
      scene(img, [{ x0: cx - 84 * s, y0: cy - 34 * s, x1: cx + 84 * s, y1: cy + 34 * s, k: 16, hf: (x, y) => { const d = E(x, y); return d > 1 ? null : d > 0.84 ? 6 + Math.abs(Math.sin(Math.atan2(y - cy, x - cx) * 26)) * 2 : 3; }, cf: (x, y, i) => (E(x, y) > 0.84 ? ramp(burnt ? BURNT : PASTRY, 0.15 + i.diff * 0.8, x, y) : ramp(burnt ? BURNT : RP.bramble, 0.2 + i.diff * 0.6, x, y)) }]);
      if (burnt) return;
      const look = spec.look;
      if (look.crumble) { const r = rng(4); const objs = []; for (let i = 0; i < 70; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.8; objs.push(blob(cx + Math.cos(a) * 70 * s * d, cy + Math.sin(a) * 28 * s * d, 4 + r() * 3, 3 + r() * 2, 3, shade(RP.crumb, { base: 0.2 }), { wob: [[3, 0.2, i]], k: 14, base: 4 })); } scene(img, objs);
        scene(img, [blob(cx, cy - 8, 12 * s, 9 * s, 10 * s, (x, y, i) => (h2(x, y, 3) > 0.9 ? "#8aa8c8" : ramp(R(["#9aa8b0", "#c4ccd0", "#e2e6e6", "#f6f8f6", "#ffffff"]), 0.2 + i.diff * 0.8, x, y)), { k: 20, base: 14 })]); return; }
      scene(img, scatter(cx, cy, 70 * s, 28 * s, [["berry", 46, 5 * s]], { berryC: RP.bramble }, 6, 4));
      for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU, x = cx + Math.cos(a) * 76 * s, y = cy + Math.sin(a) * 30 * s; for (let j = 0; j < 6; j++) img.px(x + j * Math.cos(a + 1.2) * 0.7, y - j, ramp(PASTRY, 0.8 - j * 0.08, 0, 0)); }
      for (let i = 0; i < 40; i++) { const r = rng(i); img.px(cx + (r() - 0.5) * 130 * s, cy + (r() - 0.5) * 50 * s, "#fffaf4"); }
    },
    cake(img, spec, stage, cx, cy, s) {
      B.board(img, cx, cy + 12, 112 * s, 44 * s, 6);
      const burnt = stage === "burnt", crust = burnt ? BURNT : R(["#4a2006", "#7a3a0c", "#a8601a", "#cc862e", "#e6aa4c", "#f6cc78"]), objs = [];
      [[-48, 4], [0, -8], [48, 4], [-20, 18], [26, 20]].forEach(([dx, dy], k) => item("c" + k, cx + dx * s, cy + dy * s, 20 * s, "cake", { z: dy }) || taken("c" + k) || objs.push(blob(cx + dx * s, cy + dy * s, 20 * s, 14 * s, 14 * s, (x, y, i) => {
        if (!burnt && y < cy + dy * s - 4 && fbm(x / 3, y / 2, k) > 0.42) return i.spec > 0.4 ? "#fff6c0" : ramp(RP.honey, 0.4 + i.diff * 0.6, x, y);
        return ramp(crust, 0.15 + i.diff * 0.8 - i.ao * 0.4, x, y);
      }, { pow: 0.15, k: 24, wob: [[4, 0.06, k]], base: dy * 0.1 })));
      scene(img, objs);
      if (burnt) return;
      const hc = new Img(W, H);
      hc.fill((x, y) => { const u = (x - cx - 70 * s) / (20 * s), v = (y - cy + 22 * s) / (12 * s); if (Math.abs(u) > 1 || Math.abs(v) > 1) return null; const hx = Math.floor(x / 4 + (Math.floor(y / 3) % 2) * 0.5), cxx = x - (hx - (Math.floor(y / 3) % 2) * 0.5) * 4 - 2, cyy = y % 3 - 1; return Math.abs(cxx) > 1.4 || Math.abs(cyy) > 1 ? "#c8841c" : ramp(RP.honey, 0.6 + (h2(x, y, 3) - 0.5) * 0.5, x, y); });
      outline(hc, "#3a1a04");
      img.paste(hc, 0, 0);
      for (let k = 0; k < 4; k++) for (let j = 0; j < 8; j++) img.px(cx - 48 * s + k * 30 * s, cy + 8 * s + j, j < 6 ? "#f8c038" : "#ffe48a", 0.9);
      if (spec.look.weight) { const wx = cx - 86 * s, wy = cy + 22 * s; scene(img, [blob(wx, wy, 10 * s, 6 * s, 9 * s, (x, y, i) => (i.spec > 0.5 ? "#fff4c0" : ramp(R(["#4a2c08", "#7a4c10", "#a8741e", "#d09e34", "#ecc458"]), 0.15 + i.diff * 0.85, x, y)), { pow: 0.25, k: 30, base: 10 })]); K.text(img, "1", wx - 2, wy + 2, "#4a2c08"); }
    },
    // a sheet of toffee set in the tin and broken up with the back of a spoon: pieces that still fit together with thin cracks
    // between, glassy amber with pale wisps swirled through, bubbles caught in it, a wet shine along each piece's upper edge
    toffee(img, spec, stage, cx, cy, s) {
      B.skilletWide(img, cx, cy, 100 * s, 38 * s, 0);
      const burnt = stage === "burnt", r = rng(7), rx = 82 * s, ry = 30 * s, N = 16, sites = [];
      const AMB = burnt ? BURNT : R(["#3a1404", "#6a2a06", "#9a4a0c", "#c8701a", "#e89a2c", "#f8c45a", "#fff0b4"]);
      [4, 6, 6].forEach((n, row) => { for (let j = 0; j < n; j++) { const v = (row - 1) * 0.62 + (r() - 0.5) * 0.2, w = Math.sqrt(1 - v * v) * 0.92, u = ((j + 0.5) / n * 2 - 1) * w + (r() - 0.5) * (w / n) * 0.7; sites.push([cx + u * rx, cy + v * ry]); } });
      sites.forEach(([x, y], i) => item("f" + i, x, y, 16 * s, "shard", { z: i }));
      const gone = sites.map((_, i) => !!taken("f" + i)), lay = new Img(W, H), lift = sites.map((_, i) => [0, 2, 0, 1, 3][Math.floor(h2(i, 5, 7) * 5)]);
      // which piece a point of the unbroken sheet belongs to; the cracks between are wide and uneven
      const owner = (x, y) => {
        const ed = Math.hypot((x - cx) / rx, (y - cy) / ry) / (1 + (fbm(Math.atan2(y - cy, x - cx) * 2, 0.5, 3) - 0.5) * 0.12);
        if (ed > 1) return null;
        let k = -1, d1 = 1e9, d2 = 1e9;
        for (let i = 0; i < N; i++) { const d = Math.hypot(x - sites[i][0], (y - sites[i][1]) * 1.6); if (d < d1) { d2 = d1; d1 = d; k = i; } else if (d < d2) d2 = d; }
        const gap = 1.6 + fbm(x / 6, y / 6, 11) * 2.2;
        return d2 - d1 < gap ? null : { k, edge: Math.min(d2 - d1 - gap, (1 - ed) * rx) };
      };
      // back pieces first, each raised by its lift with its broken side showing under its front edge; each piece shades dark to
      // light amber across itself, with one bright line of light along its upper edge
      const order = sites.map((_, i) => i).sort((p0, q0) => sites[p0][1] - sites[q0][1]);
      for (const k of order) {
        if (gone[k]) continue;
        const [sx, sy] = sites[k], L = lift[k];
        for (let y = Math.floor(sy - ry * 0.9 - L); y <= sy + ry * 0.9; y++) for (let x = Math.floor(sx - 30 * s); x <= sx + 30 * s; x++) {
          const q = owner(x + 0.5, y + 0.5 + L);
          if (q && q.k === k) {
            if (burnt) { lay.px(x, y, ramp(AMB, 0.15 + (q.edge < 1.5 ? 0.25 : 0) + (h2(x, y, k) - 0.5) * 0.2, x, y)); continue; }
            const t = 0.2 + clamp(((sx - x) * 0.35 + (sy - y) * 0.9) / 22, -0.18, 0.42) + L * 0.05 + (x - sx > 6 && y - sy > 2 ? 0.12 : 0);
            lay.px(x, y, q.edge < 1.3 && y < sy - 2 && x < sx + 10 ? "#fff2c0" : q.edge < 1 ? ramp(AMB, 0.12, x, y) : h2(x, y, k + 3) > 0.992 ? "#ffe8a8" : ramp(AMB, t, x, y));
            continue;
          }
          for (let j = 1; j <= L + 1; j++) { const q2 = owner(x + 0.5, y + 0.5 + L - j); if (q2 && q2.k === k) { lay.px(x, y, ramp(AMB, burnt ? 0.05 : 0.1 + (j === 1 ? 0.08 : 0), x, y)); break; } }
        }
      }
      outline(lay, burnt ? "#020101" : "#1e0a02");
      img.paste(lay, 0, 0);
      if (!burnt) glow(img, cx - rx * 0.3, cy - ry * 0.4, 30 * s, "#ffe890", 0.12);
    },
    cobbler(img, spec, stage, cx, cy, s) {
      B.skilletWide(img, cx, cy, 104 * s, 40 * s, 0);
      const burnt = stage === "burnt";
      geo("mound", { cx, cy, rx: 80 * s, ry: 28 * s, h: 8 });
      scene(img, [liquid(cx, cy, 92 * s, 33 * s, 1, burnt ? BURNT : R(["#1a0208", "#360614", "#5a0c20", "#80182c", "#a42a3a", "#c84a50"]), { seed: 3, oil: 0.3, hi: "#ffd0d8", dot: "#e86070" })]);
      const objs = [], r = rng(5);
      for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + r(), d = i ? 0.55 : 0, x = cx + Math.cos(a) * 70 * s * d, y = cy + Math.sin(a) * 26 * s * d; objs.push(blob(x, y, 20 * s, 13 * s, 10 * s, shade(burnt ? BURNT : R(["#6a3a10", "#9a5a1e", "#c88434", "#e4ac58", "#f6d08a", "#fff0c4"]), { base: 0.15, noise: 0.3, seed: i }), { wob: [[4, 0.15, i], [7, 0.06, i]], rough: 2, scale: 2, seed: i, k: 14, base: 3 })); }
      scene(img, objs);
      if (!burnt) for (let i = 0; i < 50; i++) img.px(cx + (r() - 0.5) * 160 * s, cy + (r() - 0.5) * 56 * s, "#fffaf2");
    },
    honeycakes(img, spec, stage, cx, cy, s) {
      const burnt = stage === "burnt", crust = burnt ? BURNT : R(["#4a2006", "#7a3a0c", "#a8601a", "#cc862e", "#e6aa4c", "#f6cc78"]);
      platter(img, cx, cy + 22 * s, 96 * s, 32 * s, "pewter", { rim: true });
      const tiers = [[0, 22, 62, 16], [0, 4, 46, 13], [0, -12, 30, 11]];
      geo("mound", { cx, cy: cy + 26 * s, rx: 54 * s, ry: 12 * s, h: 14, cut: true }); geo("inside", R(["#7a4a14", "#a8701e", "#d09a34", "#ecc060", "#fadc90"]));
      tiers.forEach(([dx, dy, rx, h], k) => scene(img, [blob(cx + dx * s, cy + dy * s, rx * s, rx * 0.34 * s, h * s, (x, y, i) => {
        if (!burnt && (y < cy + dy * s - rx * 0.1 * s || fbm(x / 3, y / 2, k) > 0.62)) return i.spec > 0.45 ? "#fff8d0" : ramp(RP.honey, 0.35 + i.diff * 0.6, x, y);
        return ramp(crust, 0.15 + i.diff * 0.8 - i.ao * 0.4, x, y);
      }, { pow: 0.12, k: 30, base: k * 16 })]));
      if (burnt) return;
      for (let k = 0; k < 9; k++) { const x = cx - 50 * s + k * 12 * s + (k % 2) * 3, y0 = cy + 22 * s, len = 6 + (k * 7) % 10; for (let j = 0; j < len; j++) img.px(x, y0 + j, j < len - 2 ? "#f0a820" : "#ffd860"); img.px(x, y0 + len, "#fff0a0"); }
      glow(img, cx, cy - 6 * s, 80 * s, "#ffd060", 0.22, 50 * s);
      for (const [x, y] of [[cx - 70 * s, cy - 30 * s], [cx + 62 * s, cy - 22 * s], [cx + 4 * s, cy - 40 * s]]) star(img, x, y, "#fff6c8", 2);
      const hc = new Img(W, H), hx = cx + 76 * s, hy = cy + 30 * s;
      hc.fill((x, y) => { const u = (x - hx) / (18 * s), v = (y - hy) / (10 * s); if (Math.abs(u) > 1 || Math.abs(v) > 1 || Math.abs(u) + Math.abs(v) * 0.5 > 1.2) return null; const row = Math.floor(y / 3), cxx = ((x + (row % 2) * 2) % 4) - 2, cyy = y % 3 - 1; return Math.abs(cxx) > 1.2 || Math.abs(cyy) > 0.8 ? "#c8841c" : ramp(RP.honey, 0.6 + (h2(x, y, 3) - 0.5) * 0.5, x, y); });
      outline(hc, "#3a1a04");
      img.paste(hc, 0, 0);
    },
  };

  // ---------- jellies and ices ----------
  function jellyServe(spec, o) {
    const look = spec.look, burnt = o.burnt, img = tableBack(o.seed || 12);
    platter(img, 120, 104, 106, 40, look.ware || "pewter", { rim: true });
    if (spec.pal === "cathedral") cathedral(img, 120, 104, burnt, 0); else jellyDome(img, 120, 96, 58, 40, burnt, 0, look);
    return img;
  }
  // translucent: the plate shows through, darker toward the thick middle, with a few suspended specks and bubbles, a soft wet
  // highlight and a rim of light along the far edge where it is thin
  function jellyCf(rp, cx, cy, rx, ry, o) {
    o = o || {};
    return (x, y, i) => {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry), inner = Math.max(0, 1 - d), bg = o.bg && o.bg.get(x, y);
      const hl = o.hl && Math.hypot((x - o.hl[0]) / o.hl[2], (y - o.hl[1]) / o.hl[3]);
      if (hl != null && hl < 1) return hl < 0.45 ? "#f6fff2" : ramp(rp, 0.92 + (h2(x, y, 4) > 0.5 ? 0.08 : 0), x, y);
      if (o.cres) { const q = Math.hypot((x - o.cres[0]) / o.cres[2], (y - o.cres[1]) / o.cres[3]), a = Math.atan2(y - o.cres[1], x - o.cres[0]); if (q > 0.86 && q < 0.93 + (a > -2.4 && a < -1.9 ? 0.04 : 0) && a > -2.55 && a < -1.95) return ramp(rp, 0.97, x, y); }
      if (i.nx > 0.72 && i.diff > 0.2) return ramp(rp, 0.8 + i.nx * 0.2, x, y);
      if (o.lip && i.edge && y > cy) return ramp(rp, 0.9, x, y);
      if (o.incl && inner > 0.25) { const q = o.incl(x, y); if (q) return q; }
      if (!o.incl && inner > 0.3 && fbm(x / 4, y / 4, 17) > 0.76) return mix(bg || "#000000", C(ramp(rp, 0.08 + i.diff * 0.1, x, y)), 0.85);
      if (inner > 0.15 && h2(x, y, 9) > 0.985) return h2(x, y + 1, 9) > 0.5 ? ramp(rp, 1, x, y) : ramp(rp, 0.05, x, y);
      const c = ramp(rp, 0.1 + i.diff * 0.3 + inner * 0.18 - (y > cy + ry * 0.6 ? 0.06 : 0), x, y);
      return bg ? mix(bg, C(c), 0.72 + inner * 0.2) : c;
    };
  }
  // a slime jelly turned out of its mould: slumped, shoulders sagging, the foot spreading onto the plate in a glossy puddle; wob
  // sways the top and squashes it
  function jellyDome(img, cx, cy, rx, ry, burnt, wob, look) {
    const rp = burnt ? R(["#0a0c06", "#141a0c", "#22301a", "#34482a", "#4a6238"]) : look.jelly || RP.jelly;
    wob = wob || 0;
    shadow(img, cx, cy + 6, rx * 1.15, ry * 0.32, 0.35, "#0a2a14");
    const top = ry * 1.2 * (1 - wob * 0.6);
    geo("mound", { cx, cy: cy - ry * 0.6, rx: rx * 0.7, ry: ry * 0.55, h: 20, rimCut: true, wobble: [cx - rx * 1.25, cy - top - 6, cx + rx * 1.25, cy + ry * 0.45] }); geo("inside", rp);
    const eat = K.eating(), bites = eat ? eat.bites : [];
    const bg = burnt ? null : img.copy();
    const lip = (a) => 1 + (fbm(a * 1.7 + 3, 0.5, 5) - 0.5) * 0.18;
    const foot = { x0: cx - rx * 1.3, y0: cy - ry * 0.5, x1: cx + rx * 1.3, y1: cy + ry * 0.5, k: 30, hf: (x, y) => {
      const a = Math.atan2(y - cy, x - cx), d = Math.hypot((x - cx) / (rx * 1.26), (y - cy) / (ry * 0.42)) / lip(a);
      return d > 1 ? null : Math.pow(1 - d, 0.5) * 5;
    }, cf: jellyCf(rp, cx, cy, rx * 1.1, ry * 0.4, { bg, lip: true }) };
    const dome = { x0: cx - rx * 1.2, y0: cy - top - 6, x1: cx + rx * 1.2, y1: cy + 4, k: 34, base: 2, hf: (x, y) => {
      if (bites.some((b) => K.notchAt(x, y, b))) return null;
      const v = (cy - y) / top;
      if (v < -0.05 || v > 1) return null;
      const sway = wob * rx * 0.5 * Math.pow(Math.max(0, v), 1.4), vv = Math.max(0, v);
      const w = Math.pow(Math.max(0, 1 - Math.pow(vv, 5)), 0.5) * (1 + 0.1 * Math.sin(Math.min(1, vv * 1.4) * Math.PI)) * (1 + 0.28 * Math.pow(1 - vv, 6)) * (1 + wob * 0.25 * (1 - vv)) * (1 + Math.sin(vv * 7 + 1) * 0.02);
      const u = (x - cx - sway) / rx;
      if (Math.abs(u) > w) return null;
      const dd = Math.min(1, Math.hypot(u / Math.max(0.05, w), Math.pow(vv, 1.6)));
      return Math.sqrt(Math.max(0.02, 1 - dd * dd)) * rx * 0.5 + 3;
    }, cf: jellyCf(rp, cx, cy - top * 0.45, rx, top * 0.6, { bg, hl: burnt ? null : [cx - rx * 0.3 + wob * rx * 0.3, cy - top * 0.74, rx * 0.09, top * 0.05], cres: burnt ? null : [cx + wob * rx * 0.25, cy - top * 0.2, rx * 0.86, top * 0.82] }) };
    scene(img, [foot, dome]);
  }
  // the Wobbling Cathedral: a jelly church, a gabled nave between two towers with pointed spires and a taller one in the middle, slumping
  // at the foot onto the plate; its windows are berries and citrus set in the jelly, the rose window a slice of each; wob sways it,
  // more the higher up
  const BERRY = R(["#2a0410", "#5a0a1e", "#8e1430", "#c42848", "#ec5a6e", "#ffa0a8"]), CITRUS = R(["#5a2a04", "#9a5408", "#d88a14", "#f8b830", "#ffe07a"]);
  function cathedral(img, cx, base, burnt, wob) {
    const rp = burnt ? R(["#0a0c06", "#141a0c", "#22301a", "#34482a", "#4a6238"]) : RP.jelly;
    if (!burnt) shadow(img, cx, base + 2, 66, 9, 0.3, "#0a2a14");
    if (!burnt) { const sp = new Img(W, H); sp.fill((x, y) => { const a = Math.atan2(y - base, x - cx), d = Math.hypot((x - cx) / 62, (y - base) / 6) / (1 + (fbm(a * 2 + 1, 0.5, 8) - 0.5) * 0.25); return d < 1 ? (d > 0.85 && y < base ? ramp(rp, 0.85, x, y) : mix(img.get(x, y) || "#000000", C(ramp(rp, 0.3, x, y)), 0.55)) : null; }); img.paste(sp, 0, 0); }
    geo("mound", { cx: cx + 18, cy: base - 10, rx: 12, ry: 6, h: 10, wobble: [cx - 60, base - 90, cx + 60, base + 4] }); geo("inside", rp);
    const sway = (y) => (wob || 0) * 40 * Math.sin((base - y) * 0.08) * ((base - y) / 90);
    const parts = [
      { b: 0, at: (u, v) => { u /= 1 + Math.pow(Math.max(0, 14 - v) / 14, 2) * 0.3; const roof = 30 + (34 - Math.abs(u)) * 0.35; return Math.abs(u) <= 34 && v >= 0 && v <= roof ? Math.min(34 - Math.abs(u), v + 2, roof - v) : null; } },
      ...[-40, 40].map((tx) => ({ b: 8, at: (u, v) => { const du = Math.abs(u - tx), wd = (v <= 54 ? 9 : 9 * Math.pow(Math.max(0, (74 - v) / 20), 0.6)) + Math.pow(Math.max(0, 16 - v) / 16, 2) * 8 + Math.sin(v * 0.35 + tx) * 0.5; return v >= 0 && v <= 74 && du <= wd ? Math.min(wd - du, v + 2, v <= 54 ? 54 - v + 3 : 74 - v) : null; } })),
      { b: 14, at: (u, v) => { const wd = v <= 50 ? 5 : 5 * (84 - v) / 34; return v >= 26 && v <= 84 && Math.abs(u) <= wd ? Math.min(wd - Math.abs(u), 84 - v) : null; } },
    ];
    const win = (u, v) => {
      if (burnt) return 0;
      const berries = [[-24, 11, 4.8], [-12, 12.5, 4.3], [12, 11.5, 4.8], [24, 13, 4.3], [-40, 40, 5], [-39, 49.5, 4], [40, 41, 5], [41, 50, 3.8]];
      for (const [bu, bv, br] of berries) { const d = Math.hypot(u - bu, v - bv) / br, hl = Math.hypot(u - bu + br * 0.35, v - bv - br * 0.35) / br; if (d <= 1) return 1 + (hl < 0.22 ? 0.5 : 0) + (1 - d) * 0.49; }
      if (Math.hypot(u, v - 24) <= 6) return Math.hypot(u, v - 24) < 1.5 || Math.abs(Math.sin(Math.atan2(v - 24, u) * 4)) < 0.25 ? 3 : 2;
      if (Math.abs(u) <= 4.5 && v <= 11 - Math.abs(u) * 0.4) return 4;
      return 0;
    };
    const eat = K.eating(), bites = eat ? eat.bites : [];
    scene(img, parts.map((P0) => ({ x0: cx - 64, y0: base - 90, x1: cx + 64, y1: base + 2, k: 34, base: P0.b, hf: (x, y) => { if (bites.some((b) => K.notchAt(x, y, b))) return null; const e = P0.at(x - cx - sway(y), base - y); return e === null ? null : Math.min(4, e) * 1.6 + 2; },
      cf: (x, y, i) => {
        const u = x - cx - sway(y), v = base - y, w = win(u, v);
        const bg = burnt ? null : img.get(x, y), see = (c, k) => (bg ? mix(bg, C(c), k) : c);
        if (w >= 1 && w < 2) return w >= 1.5 ? "#ffd0d4" : see(ramp(BERRY, 0.15 + (w - 1) * 1.3, x, y), 0.9);
        if (w === 2) return see(ramp(Math.floor(Math.atan2(v - 24, u) * 2.6) % 2 ? BERRY : CITRUS, 0.3 + (1 - Math.hypot(u, v - 24) / 6) * 0.5, x, y), 0.85);
        if (w === 3) return see(ramp(CITRUS, 0.85, x, y), 0.9);
        if (w === 4) return see(ramp(rp, 0.05, x, y), 0.85);
        const e = P0.at(u, v);
        if (i.spec > 0.7 && e > 1.2 && e < 3.6) return "#f0fce8";
        if (e < 1.2) return see(ramp(rp, 0.12 + i.diff * 0.2, x, y), 0.85);
        if (!burnt && h2(x, y, 6) > 0.985) return h2(x, y + 1, 6) > 0.5 ? ramp(rp, 1, x, y) : ramp(rp, 0.05, x, y);
        const c = ramp(rp, 0.06 + i.diff * 0.22 + Math.min(1, e / 6) * 0.12 + Math.sin(u * 0.5 + v * 0.15) * 0.05, x, y);
        return see(c, 0.45 + Math.min(1, e / 6) * 0.35);
      } })));
    if (!burnt) { const tip = base - 84; star(img, cx + sway(tip), tip - 2, "#f0fce8", 1); }
  }
  function iceServe(spec, o) {
    const look = spec.look, burnt = o.burnt, img = tableBack(o.seed || 13, { wood: R(["#080a0e", "#0e1218", "#141a22", "#1c242e", "#26303c"]) });
    const kind = spec.pal === "fireice" ? "tower" : spec.pal === "frost" ? "sorbet" : "drift";
    if (kind === "tower") {
      platter(img, 120, 112, 100, 34, "pewter", { rim: true });
      geo("mound", { cx: 120, cy: 104, rx: 36, ry: 8, h: 14 }); geo("inside", RP.ice);
      const objs = [];
      for (let k = 0; k < 5; k++) objs.push(blob(120, 106 - k * 15, 46 - k * 7, 11, 22, (x, y, i) => (burnt ? ramp(BURNT, i.diff, x, y) : h2(x, y, k) > 0.9 ? "#ffffff" : i.spec > 0.5 ? "#ffffff" : ramp(RP.ice, 0.2 + i.diff * 0.7 + (fbm(x / 2, y / 2, k) > 0.6 ? 0.2 : 0), x, y)), { wob: [[5, 0.1, k], [9, 0.05, k]], k: 30, base: k * 22 }));
      scene(img, objs);
      for (let j = 0; j < 30; j++) img.px(120 + Math.sin(j * 0.5) * 18, 50 + j * 2, ramp(RP.honey, 0.7, 0, 0));
      stick(img, 84, 34, 156, 30, { w: 4, ramp: R(["#3a0a04", "#6a1408", "#a02a0c", "#d04a16", "#f07a28"]) });
      if (!burnt) { glow(img, 120, 24, 50, "#ff8a2a", 0.35, 28); for (let k = 0; k < 7; k++) { const fx = 90 + k * 10, fh = 10 + (k * 13) % 9; for (let j = 0; j < fh; j++) for (let q = -2; q <= 2; q++) if (Math.abs(q) < (1 - j / fh) * 3) img.px(fx + q + Math.sin(j * 0.6 + k) * 1.2, 30 - j, j < fh * 0.3 ? "#fff0a0" : j < fh * 0.65 ? "#ffb030" : "#e8501a"); } }
      return img;
    }
    if (kind === "sorbet") {
      const f = bowl(img, 120, 80, 70, 26, 34, "pewter", { foot: true });
      const objs = [];
      geo("inside", R(["#5a1e2c", "#8a3444", "#b8586a", "#dc8494", "#f4b8c4"]));
      [[-26, 0], [24, -2], [0, -14]].forEach(([dx, dy], k) => item("sc" + k, f.cx + dx, f.cy + dy - 6, 20, "scoop", { z: -dy, mound: { cx: f.cx + dx, cy: f.cy + dy - 8, rx: 14, ry: 9, h: 10 } }) || objs.push(blob(f.cx + dx, f.cy + dy - 6, 24, 18, 18, (x, y, i) => (burnt ? ramp(BURNT, i.diff, x, y) : fbm(x / 1.5, y / 1.5, k) > 0.58 ? ramp(RP.ice, 0.85, x, y) : ramp(R(["#2a1018", "#5a1e2c", "#8a3444", "#b8586a", "#dc8494", "#f4b8c4"]), 0.2 + i.diff * 0.8, x, y)), { rough: 2, scale: 1.4, seed: k, k: 20, base: k * 4 })));
      scene(img, objs);
      if (!burnt) scene(img, scatter(f.cx, f.cy - 18, 40, 10, [["berry", 7, 3.5]], { berryC: R(["#1a0a20", "#2e1438", "#3e2a5a", "#5a4a86", "#8a7ab0"]) }, 3, 30));
      return img;
    }
    platter(img, 120, 100, 106, 40, "glaze", { rim: true });
    geo("mound", { cx: 120, cy: 84, rx: 60, ry: 20, h: 20 }); geo("inside", R(["#5a7898", "#86a2c0", "#b4cae0", "#dce8f4", "#ffffff"]));
    const objs = [blob(120, 90, 74, 30, 34, (x, y, i) => (burnt ? ramp(BURNT, i.diff, x, y) : i.spec > 0.6 ? "#ffffff" : ramp(R(["#7a8ca0", "#a8bccc", "#cedce6", "#e8f0f6", "#f8fbff", "#ffffff"]), 0.25 + i.diff * 0.75 + (h2(x, y, 3) > 0.9 ? 0.2 : 0), x, y)), { wob: [[3, 0.08, 1], [6, 0.06, 2]], rough: 4, scale: 3, seed: 2, k: 14, pow: 0.7 })];
    scene(img, objs);
    if (!burnt) scene(img, scatter(120, 80, 60, 18, [["berry", 16, 3.6]], { berryC: R(["#3a0204", "#6a0808", "#9a140e", "#c8261a", "#ee4a30"]) }, 4, 30));
    return img;
  }

  // ---------- fish fillets ----------
  function filletServe(spec, o) {
    const look = spec.look, burnt = o.burnt, img = tableBack(o.seed || 14);
    if (spec.pal === "sardine") {
      plank(img, 120, 86, 190, 70);
      for (let k = 0; k < 6; k++) { const x = k % 2 ? 160 : 82, y = 66 + Math.floor(k / 2) * 20, dir = k % 2 ? -1 : 1; item("d" + k, x, y, 12, "sardine", { z: k, box: [x - 34, y - 10, x + 34, y + 10], m: { cx: x, cy: y, rx: 28, ry: 6.5, h: 5 } }); if (taken("d" + k)) continue; sardine(img, x, y, burnt ? "burnt" : "cook", k, dir); }
      return img;
    }
    if (spec.pal === "salmon") {
      slate(img, 120, 86, 200, 64);
      for (let k = 0; k < 7; k++) { const x = 46 + k * 24, y = 86 + Math.sin(k) * 4; item("m" + k, x, y, 16, "slice", { z: k }); if (taken("m" + k)) continue; scene(img, [blob(x, y, 20, 13, 3, (xx, yy, i) => { if (burnt) return ramp(BURNT, i.diff, xx, yy); const band = Math.sin((xx - yy * 0.6) * 0.7) > 0.7; return band ? "#fbd8c0" : i.spec > 0.5 ? "#fff0e8" : ramp(RP.salmon, 0.25 + i.diff * 0.7, xx, yy); }, { wob: [[2, 0.2, k], [3, 0.1, k]], pow: 0.3, k: 30, base: k * 1.5 })]); }
      if (!burnt) { for (let i = 0; i < 60; i++) { const r = rng(i); const x = 40 + r() * 170, y = 70 + r() * 34; img.px(x, y, "#5a8a3a"); img.px(x + 1, y - 1, "#7ab04a"); } lemon(img, 206, 112, 1.3); }
      return img;
    }
    B.board(img, 120, 98, 114, 44, 8);
    geo("mound", { cx: 120, cy: 86, rx: 80, ry: 20, h: 14, cut: true }); geo("inside", R(["#a89a88", "#cfc2ae", "#e8dccb", "#f6efe4", "#fffaf2"]));
    serpentFillet(img, 120, 82, burnt ? "burnt" : "cook", 1);
    if (!burnt) { lemon(img, 40, 116, 1.4); herb(img, 196, 116, 1.4, 4); }
    return img;
  }
  function sardine(img, x, y, stage, k, dir) {
    const lay = new Img(W, H), burnt = stage === "burnt", d = dir || 1, L = 30;
    hrender(lay, [x - L - 6, y - 10, x + L + 6, y + 10], (xx, yy) => {
      const u = (xx - x) / L * d, v = yy - y;
      if (u < -1.12 || u > 1) return null;
      const half = u > 0.62 ? (1 - u) * 13 + 1.2 : u > -0.75 ? 5.6 * (1 - Math.pow((u - 0.1) / 0.9, 2) * 0.55) : u > -0.88 ? 1.4 : (Math.abs(v) > 1 ? (u + 1.12) * 22 : 0);
      if (u <= -0.88 && Math.abs(v) < 1) return null;
      if (Math.abs(v) > half) return null;
      return Math.sqrt(Math.max(0, half * half - v * v)) * 0.8;
    }, (xx, yy, i) => {
      if (burnt) return ramp(BURNT, i.diff, xx, yy);
      const u = (xx - x) / L * d, v = yy - y;
      if (Math.abs(u - 0.78) < 0.04 && Math.abs(v + 1.5) < 1.2) return "#0a0a10";
      if (Math.abs(u - 0.6) < 0.025 && Math.abs(v) < 4) return "#2a3440";
      if (i.spec > 0.5) return "#ffffff";
      if (Math.abs((((xx + yy * 0.8) % 7) + 7) % 7) < 1 && u > -0.7 && u < 0.55) return "#3a2410";
      return ramp(R(["#1a2430", "#34465a", "#5a7088", "#8aa0b4", "#c4d2dc", "#f4f8fa"]), 0.2 + i.diff * 0.6 + (v > 1 ? 0.3 : -0.1) + (h2(xx, yy, k) > 0.9 ? 0.2 : 0), xx, yy);
    }, { k: 30 });
    outline(lay, "#060808");
    img.paste(lay, 0, 0);
  }
  function serpentFillet(img, cx, cy, stage, seed) {
    const burnt = stage === "burnt", raw = stage === "raw";
    scene(img, [blob(cx, cy, 92, 28, 14, (x, y, i) => {
      if (burnt) return ramp(BURNT, 0.1 + i.diff * 0.7, x, y);
      const v = (y - cy) / 28;
      if (v < -0.55) { const sx = Math.floor(x / 5), on = ((x + (Math.floor(y / 4) % 2) * 2.5) % 5) < 1 || y % 4 < 1; return on ? "#0e2a2a" : raw || h2(sx, Math.floor(y / 4), seed) > 0.4 ? ramp(R(["#0e2a2a", "#184440", "#26605a", "#3a8076", "#5aa494", "#8ccab8"]), 0.3 + i.diff * 0.7, x, y) : ramp(R(["#4a2a14", "#7a4a24", "#a87038", "#d09a54"]), 0.3 + i.diff * 0.6, x, y); }
      if (i.spec > 0.55) return "#fff4e8";
      const flake = Math.sin(x * 0.45 + Math.sin(y * 0.3) * 2) > 0.85;
      return ramp(raw ? RP.salmon : R(["#6a4a3a", "#9a7258", "#c49a7a", "#e2bea0", "#f4dcc4", "#fff4e4"]), 0.2 + i.diff * 0.7 + (flake ? -0.25 : 0), x, y);
    }, { wob: [[2, 0.08, 1], [3, 0.05, 2]], pow: 0.5, k: 20 })]);
    if (!raw && !burnt) for (let k = 0; k < 9; k++) { const x = cx - 70 + k * 18 + (k % 2) * 5, y = cy - 30 - (k % 3) * 4; scene(img, [blob(x, y, 3, 2.5, 2, shade(R(["#0e2a2a", "#184440", "#26605a", "#3a8076", "#8ccab8"]), { glint: 0.4 }), { k: 30 })]); }
  }

  // ---------- claws and legs ----------
  const CLAWS = {
    crab: { shell: RP.shellR, vessel: "board", props: ["mallet", "butter", "lemon", "sorry"] },
    crawler: { shell: R(["#141208", "#26220e", "#3e3816", "#5a5220", "#7a6e2c", "#9a8c3e", "#bcae5e"]), vessel: "pot", oysters: true },
    spider: { shell: R(["#0a0606", "#1a100c", "#2e1c14", "#4a2e1e", "#6a442c", "#8a5e3c"]), vessel: "board", legend: true, props: ["butter"] },
  };
  // a crab claw in its own frame: u runs from the wrist to the pincer tips, v across; a swollen palm, the movable finger over the
  // fixed one with a gap between, dark tips, a pale underside, knobbly shell; cracked shows the white meat in the palm
  function crabClaw(cx, cy, s, ang, rp, stage, seed, o) {
    o = o || {};
    const ca = Math.cos(ang), sa = Math.sin(ang), burnt = stage === "burnt", raw = stage === "raw";
    const shell = burnt ? BURNT : raw ? R(["#141810", "#24281c", "#363c2a", "#4c5440", "#667058", "#868e74"]) : rp;
    const local = (x, y) => [((x - cx) * ca + (y - cy) * sa) / s, (-(x - cx) * sa + (y - cy) * ca) / s];
    const finger = (u, v, u0, u1, v0, v1, w0, bend) => {
      if (u < u0 || u > u1) return null;
      const t = (u - u0) / (u1 - u0), vc = lerp(v0, v1, t) + Math.sin(t * Math.PI) * bend, w = w0 * (1 - t * 0.85) + 0.6;
      const d = Math.abs(v - vc);
      return d > w ? null : { h: Math.sqrt(w * w - d * d), t };
    };
    const part = (x, y) => {
      const [u, v] = local(x, y);
      let best = null;
      const palm = Math.hypot(u / 15, v / 10.5);
      if (palm < 1) best = { h: Math.sqrt(1 - palm * palm) * 9, k: "palm", u, v };
      const f1 = finger(u, v, 9, 36, -4.5, -1.2, 5, -2.2), f2 = finger(u, v, 10, 31, 4.5, 1.6, 4.2, 1.6);
      for (const [f, k] of [[f1, "dactyl"], [f2, "pollex"]]) if (f && (!best || f.h > best.h)) best = { h: f.h, k, t: f.t, u, v };
      const wr = Math.hypot((u + 17) / 8, v / 6.5);
      if (wr < 1 && (!best || Math.sqrt(1 - wr * wr) * 6 > best.h)) best = { h: Math.sqrt(1 - wr * wr) * 6, k: "wrist", u, v };
      const mr = Math.hypot((u + 29) / 7, (v + 1) / 5);
      if (mr < 1 && !o.short && (!best || Math.sqrt(1 - mr * mr) * 5 > best.h)) best = { h: Math.sqrt(1 - mr * mr) * 5, k: "wrist", u, v };
      return best;
    };
    const R0 = 42 * s;
    return { x0: cx - R0, y0: cy - R0, x1: cx + R0, y1: cy + R0, k: 26, base: o.base || 0,
      hf: (x, y) => { const p2 = part(x, y); return p2 ? p2.h * s : null; },
      cf: (x, y, i) => {
        const p2 = part(x, y);
        if (!p2) return null;
        if (o.cracked && !raw && !burnt && p2.k === "palm" && Math.hypot(p2.u / 11, (p2.v + 2) / 6) < 1) {
          const fib = Math.sin(p2.u * 1.3 + Math.sin(p2.v * 0.8) * 2) > 0.6;
          return i.spec > 0.5 ? "#ffffff" : ramp(R(["#a89a88", "#cfc2ae", "#e8dccb", "#f6efe4", "#fffaf2"]), 0.3 + i.diff * 0.6 + (fib ? -0.2 : 0), x, y);
        }
        if ((p2.k === "dactyl" || p2.k === "pollex") && p2.t > 0.72) return ramp(burnt ? BURNT : R(["#0e0604", "#1e0e08", "#2e1a10", "#46281a"]), 0.2 + i.diff * 0.7, x, y);
        if (i.spec > 0.6 && !burnt) return i.spec > 0.85 ? "#fff8f0" : ramp(shell, 1, x, y);
        let t = 0.15 + i.diff * 0.75 - i.ao * 0.4;
        const under = p2.v > (p2.k === "palm" ? 6 : 3) && !raw && !burnt;
        if (h2(Math.floor(x / 2), Math.floor(y / 2), seed) > 0.86) t += 0.18;
        if ((p2.k === "dactyl" || p2.k === "pollex") && Math.abs(p2.v) < 2.5 && h2(x, y, seed + 1) > 0.7 && !burnt) return "#f4e2c8";
        const c = ramp(shell, t, x, y);
        return under ? mix(c, "#f2d6b2", 0.45) : c;
      } };
  }
  // a walking leg: three tapering segments with dark joints, the last ending in a point; cracked shows the white meat in the long one
  function crabLeg(x0, y0, ang, len, s, rp, stage, seed, o) {
    o = o || {};
    const burnt = stage === "burnt", raw = stage === "raw";
    const shell = burnt ? BURNT : raw ? R(["#141810", "#24281c", "#363c2a", "#4c5440", "#667058", "#868e74"]) : rp;
    const pts = [[x0, y0]], fr = [0.44, 0.34, 0.22], bend = o.bend === undefined ? 0.35 : o.bend, bends = o.bends || [0, bend, bend * 1.4], rad = o.rad ? o.rad.map((v) => v * s) : [4.6 * s, 3.8 * s, 2.6 * s];
    let a = ang, x = x0, y = y0;
    fr.forEach((f, k) => { a += bends[k]; x += Math.cos(a) * len * f; y += Math.sin(a) * len * f * 0.55; pts.push([x, y]); });
    const near = (px, py) => {
      let best = null;
      for (let k = 0; k < 3; k++) {
        const [ax, ay] = pts[k], [bx, by] = pts[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
        const t = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1), qx = ax + dx * t, qy = ay + dy * t, d = Math.hypot(px - qx, py - qy);
        const r = rad[k] * (k === 2 ? 1 - t * 0.8 : 1 - t * 0.15) + (t < 0.06 || t > 0.94 ? -0.6 : 0);
        if (d < r && (!best || Math.sqrt(r * r - d * d) > best.h)) best = { h: Math.sqrt(r * r - d * d), k, t, side: ((px - qx) * -dy + (py - qy) * dx) / Math.sqrt(L2) };
      }
      return best;
    };
    let x0b = Infinity, y0b = Infinity, x1b = -Infinity, y1b = -Infinity;
    for (const [px, py] of pts) { x0b = Math.min(x0b, px); y0b = Math.min(y0b, py); x1b = Math.max(x1b, px); y1b = Math.max(y1b, py); }
    return { x0: x0b - 6 * s, y0: y0b - 6 * s, x1: x1b + 6 * s, y1: y1b + 6 * s, k: 24, base: o.base || 0,
      hf: (px, py) => { const n = near(px, py); return n ? n.h : null; },
      cf: (px, py, i) => {
        const n = near(px, py);
        if (!n) return null;
        if (o.cracked && n.k === 0 && n.t > 0.15 && n.t < 0.85 && n.side < 1.2 * s && !raw && !burnt) return i.spec > 0.5 ? "#ffffff" : ramp(R(["#a89a88", "#cfc2ae", "#e8dccb", "#f6efe4", "#fffaf2"]), 0.3 + i.diff * 0.6 + (Math.sin(n.t * 40) > 0.7 ? -0.2 : 0), px, py);
        if (n.t < 0.07 || n.t > 0.93) return ramp(shell, 0.05, px, py);
        if (n.k === 2 && n.t > 0.75) return ramp(burnt ? BURNT : R(["#1e0e08", "#2e1a10", "#46281a"]), 0.3 + i.diff * 0.6, px, py);
        if (i.spec > 0.6 && !burnt) return "#fff4ea";
        const c = ramp(shell, 0.15 + i.diff * 0.75 - i.ao * 0.4 + (h2(Math.floor(px / 2), Math.floor(py / 2), seed) > 0.88 ? 0.15 : 0), px, py);
        return n.side > 2 * s && !raw && !burnt ? mix(c, "#f2d6b2", 0.4) : c;
      } };
  }
  function clawHeap(cx, cy, rx, ry, cl, stage, seed, s) {
    s = s || 1;
    const r = rng(seed), objs = [];
    for (let i = 0; i < 11; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.7, dir = (i % 2 ? 0.15 : Math.PI - 0.15) + (r() - 0.5) * 1.1;
      const len = (50 + r() * 22) * s, x = cx + Math.cos(a) * rx * d - Math.cos(dir) * len * 0.45, y = cy + Math.sin(a) * ry * d - Math.sin(dir) * len * 0.25, bend = (r() < 0.5 ? -1 : 1) * (0.15 + r() * 0.2), base = r() * 4;
      item("lg" + i, x + Math.cos(dir) * len * 0.45, y + Math.sin(dir) * len * 0.25, len * 0.4, "leg", { z: base, box: [Math.min(x, x + Math.cos(dir) * len) - 8, Math.min(y, y + Math.sin(dir) * len * 0.55) - 10, Math.max(x, x + Math.cos(dir) * len) + 8, Math.max(y, y + Math.sin(dir) * len * 0.55) + 10] });
      if (taken("lg" + i)) continue;
      objs.push(crabLeg(x, y, dir, len, s, cl.shell, stage, i, { bend, cracked: i % 4 === 1, base }));
    }
    const claws = [[-0.62, 0.1, Math.PI + 0.35], [0.62, -0.15, -0.25], [0.02, 0.62, 1.35]];
    claws.forEach(([dx, dy, ang], i) => item("cl" + i, cx + dx * rx, cy + dy * ry, 20 * s, "claw", { z: 12 + i * 2, box: [cx + dx * rx - 42 * s, cy + dy * ry - 30 * s, cx + dx * rx + 42 * s, cy + dy * ry + 30 * s] }) || taken("cl" + i) || objs.push(crabClaw(cx + dx * rx, cy + dy * ry, 1.05 * s, ang + (r() - 0.5) * 0.2, cl.shell, stage, i + seed, { base: 12 + i * 2, cracked: i === 2 })));
    return objs;
  }
  function sorryNote(img, x, y) {
    const lay = new Img(W, H);
    lay.rect(x, y, 34, 13, "#efe0bc");
    for (let i = 0; i < 34; i++) lay.px(x + i, y + 12, "#c8b48a");
    K.text(lay, "sorry.", x + 3, y + 10, "#3a2010");
    outline(lay, "#2a1a0c");
    img.paste(lay, 0, 0);
  }
  function clawsServe(spec, o) {
    const look = spec.look, cl = Object.assign({}, CLAWS[spec.pal] || CLAWS.crab, look.claws || {}), burnt = o.burnt, stage = burnt ? "burnt" : "cook", img = tableBack(o.seed || 15, look.slab ? { wood: R(["#0a0a0c", "#121216", "#1a1a20", "#24242a", "#2e2e36"]) } : {});
    if (cl.legend) return matriarch(img, stage);
    if (cl.vessel === "pot") {
      const f = bowl(img, 120, 74, 112, 46, 26, "iron");
      scene(img, [liquid(f.cx, f.cy, f.rx, f.ry, 1, burnt ? BURNT : R(["#1a1a0a", "#2a2a14", "#3e3e20", "#56562e", "#70703e"]), { seed: 3, oil: 0.2 })]);
      scene(img, clawHeap(f.cx, f.cy - 4, f.rx * 0.7, f.ry * 0.6, cl, stage, 5, 0.85));
      if (cl.oysters) for (let k = 0; k < 5; k++) { item("o" + k, f.cx - 70 + k * 34, f.cy + 14 + (k % 2) * 6, 12, "oyster", { z: 20 }); if (!taken("o" + k)) oyster(img, f.cx - 70 + k * 34, f.cy + 14 + (k % 2) * 6, burnt); }
      return img;
    }
    if (look.rock) rockSlab(img, 120, 98, 118, 46); else B.board(img, 120, 98, 118, 46, 4);
    kelpBed(img, 120, 90, 96, 34, burnt);
    scene(img, clawHeap(118, 84, 70, 26, cl, stage, look.heapSeed || 3, 1));
    if (!burnt) for (const p of cl.props || []) { if (p === "mallet") mallet(img, 22, 116); if (p === "butter") { butterPot(img, 210, 118); geo("dip", [210, 118]); } if (p === "lemon") { lemon(img, 200, 56, 1.4); lemon(img, 214, 64, 1.2); } if (p === "sorry") sorryNote(img, 6, 30); }
    if (!burnt) for (let i = 0; i < 6; i++) steam(img, 60 + i * 26, 70, 40, i * 1.3, 0.3, 4, 3);
    if (look.shieldEdge) { const lay = new Img(W, H); for (let y = 100; y < H; y++) for (let x = 170; x < W; x++) { const d = Math.hypot((x - 250) / 80, (y - 170) / 70); if (d < 1) lay.px(x, y, d > 0.9 ? ramp(IRONV, 0.6, x, y) : ramp(R(["#1e0e06", "#3a1c0c", "#5a2e16", "#7a4220"]), 0.5 - d * 0.3, x, y)); } outline(lay, "#050302"); img.paste(lay, 0, 0); }
    return img;
  }
  function kelpBed(img, cx, cy, rx, ry, burnt) {
    const r = rng(8);
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, x0 = cx + Math.cos(a) * rx * 0.3, y0 = cy + Math.sin(a) * ry * 0.3, ang = r() * TAU, len = 50 + r() * 30;
      for (let k = 0; k < len; k++) { const t = k / len, x = x0 + Math.cos(ang) * k + Math.sin(k * 0.2) * 3, y = y0 + Math.sin(ang) * k * 0.4; for (let w = -3; w <= 3; w++) img.px(x, y + w * 0.6, ramp(burnt ? BURNT : R(["#0a1408", "#142410", "#20381a", "#2e4e22", "#40682e"]), 0.4 + w * 0.08 + (k % 7 === 0 ? 0.2 : 0), Math.floor(x), Math.floor(y + w))); }
    }
  }
  function rockSlab(img, cx, cy, rx, ry) {
    scene(img, [blob(cx, cy, rx, ry, 10, (x, y, i) => ramp(R(["#0e1014", "#1a1e24", "#262c34", "#343c46", "#46505c", "#5c6876"]), 0.15 + i.diff * 0.7 + (fbm(x / 6, y / 4, 3) - 0.5) * 0.4 + (h2(x, y, 4) > 0.95 ? 0.3 : 0), x, y), { wob: [[3, 0.08, 1], [7, 0.04, 2]], pow: 0.2, k: 10 })]);
    for (let i = 0; i < 12; i++) { const r = rng(i + 3); const x = cx + (r() - 0.5) * rx * 1.6, y = cy + ry * 0.4 + r() * 10; scene(img, [blob(x, y, 3, 2.2, 2, shade(R(["#5a5a5a", "#8a8a84", "#bab4a8", "#e0dccf"]), { base: 0.2 }), { k: 20, base: 10 })]); }
  }
  function oyster(img, x, y, burnt) {
    scene(img, [blob(x, y, 14, 7, 5, (xx, yy, i) => {
      const d = Math.hypot((xx - x) / 14, (yy - y) / 7);
      if (d < 0.6 && !burnt) return i.spec > 0.5 ? "#ffffff" : ramp(R(["#8a8a7a", "#b4b4a0", "#d8d4c0", "#efeadc", "#fffcf0"]), 0.3 + i.diff * 0.6, xx, yy);
      return ramp(burnt ? BURNT : R(["#2a2620", "#4a443a", "#6e6656", "#968c78", "#bcb29c"]), 0.2 + i.diff * 0.7 + (h2(xx, yy, 7) > 0.8 ? -0.2 : 0), xx, yy);
    }, { wob: [[5, 0.12, x], [9, 0.06, y]], k: 26, base: 8 })]);
  }
  // one leg of the Silk Matriarch, steamed whole and cracked: the shell split, the white meat pulled out in ropes
  // one leg of the Silk Matriarch: three segments of dark banded chitin, bristled, bent at the knee, the long one cracked open along its
  // top to the white meat; ropes of meat pulled out and heaped on the board by the butter
  function matriarch(img, stage) {
    const burnt = stage === "burnt", CH = burnt ? BURNT : R(["#2a0e04", "#4a1a08", "#6e2c0e", "#944216", "#b85c22", "#d47e3a", "#ecaa64"]), BAND = R(["#1a0804", "#2e1006", "#4a1c0a", "#6a2c12"]);
    const MEAT = R(["#a89a88", "#cfc2ae", "#e8dccb", "#f6efe4", "#fffaf2"]);
    B.board(img, 120, 100, 118, 44, 2);
    const chitin = (crack) => (x, y, i, q) => {
      const lo = -0.08 + (h2(Math.floor(q.l / 3), 7, 4) - 0.5) * 0.3, hi = 0.42 + (h2(Math.floor(q.l / 4), 9, 4) - 0.5) * 0.3;
      if (crack && !burnt && q.t > 0.12 && q.t < 0.88 && (Math.abs(q.side - lo) < 0.09 || Math.abs(q.side - hi) < 0.09)) return "#f6d8a8";
      if (crack && !burnt && q.t > 0.12 && q.t < 0.88 && q.side > lo && q.side < hi) return i.spec > 0.5 ? "#ffffff" : ramp(MEAT, 0.35 + i.diff * 0.5 + (Math.sin(q.l * 1.4) > 0.75 ? -0.2 : 0), x, y);
      if (!burnt && (q.t < 0.08 || q.t > 0.92 || (q.l % 24) < 2.2)) return ramp(BAND, 0.2 + i.diff * 0.7, x, y);
      if (i.spec > 0.55 && !burnt) return "#ffe0b0";
      return ramp(CH, 0.1 + i.diff * 0.8 - i.ao * 0.3 + (h2(Math.floor(q.l / 2), 3, 5) > 0.85 ? 0.15 : 0), x, y);
    };
    const femur = [[12, 112], [62, 88], [110, 64]], tibia = [[118, 62], [162, 82], [194, 106]], tarsus = [[194, 106], [212, 118], [222, 126], [226, 122]];
    // bristles along the outside of each segment
    if (!burnt) for (const [seg2, r0] of [[femur, 14], [tibia, 10]]) for (let i = 0; i < 16; i++) { const t = (i + 0.5) / 16, k2 = Math.min(seg2.length - 2, Math.floor(t * (seg2.length - 1))), f = t * (seg2.length - 1) - k2, dx = seg2[k2 + 1][0] - seg2[k2][0], dy = seg2[k2 + 1][1] - seg2[k2][1], L = Math.hypot(dx, dy), nx = dy / L, ny = -dx / L, x = lerp(seg2[k2][0], seg2[k2 + 1][0], f) + nx * (r0 - 2), y = lerp(seg2[k2][1], seg2[k2 + 1][1], f) + ny * (r0 - 2); for (let j = 0; j < 7; j++) img.px(x + nx * j + dx / L * j * 0.4, y + ny * j + dy / L * j * 0.4, j < 4 ? "#1a0e18" : "#3a2232"); }
    scene(img, [tube(femur, (t) => 8 + 7 * Math.sin(Math.PI * (0.1 + 0.8 * t)), chitin(true), { base: 2, k: 26 }), blob(115, 62, 13, 12, 12, (x, y, i) => (burnt ? ramp(BURNT, i.diff, x, y) : ramp(BAND, 0.15 + i.diff * 0.75, x, y)), { k: 30, base: 4 }),
      tube(tibia, (t) => 5.5 + 5 * Math.sin(Math.PI * (0.1 + 0.8 * t)) - t * 2, chitin(false), { base: 2, k: 26 }), tube(tarsus, (t) => 5.5 - t * 4, (x, y, i, q) => (q.t > 0.75 && !burnt ? ramp(R(["#0a0406", "#2a1a10", "#5a4028"]), i.diff, x, y) : chitin(false)(x, y, i, q)), { base: 2, k: 26 })]);
    if (!burnt) for (let k = 0; k < 7; k++) { const t = 0.2 + k * 0.1, x = lerp(femur[0][0], femur[2][0], t), y = lerp(femur[0][1], femur[2][1], t) - 4; for (let j = 0; j < 3; j++) img.px(x + j - 1, y - 9 - (k % 2) - (j === 1 ? 1 : 0), j === 1 ? "#f6d8a8" : "#c88a48"); }
    if (burnt) return img;
    // where a fork can dig the meat out of the cracked leg
    geo("meat", [[40, 95], [64, 83], [88, 71]].map(([x, y]) => ({ cx: x, cy: y, rx: 9, ry: 5, h: 6 })));
    const objs = [];
    const r2 = rng(17);
    for (let k = 0; k < 6; k++) {
      const x0 = 66 + k * 18 + (k % 2) * 3, y0 = 114 + (k % 2) * 7, rx = 7 + r2() * 2, ry = 4.5 + r2() * 1.5;
      item("r" + k, x0, y0, 9, "rope", { z: k, box: [x0 - rx - 3, y0 - ry - 3, x0 + rx + 3, y0 + ry + 3] });
      if (taken("r" + k)) continue;
      objs.push(blob(x0, y0, rx, ry, 5, (x, y, i) => (i.spec > 0.55 ? "#ffffff" : ramp(MEAT, 0.3 + i.diff * 0.6 + (Math.sin((x - x0) * 1.3 + (y - y0) * 0.4 + k) > 0.6 ? -0.25 : 0), x, y)), { wob: [[3, 0.18, k], [5, 0.1, k * 2]], rough: 1.6, scale: 1.5, seed: k, k: 26, base: 6 + k * 0.1 }));
    }
    scene(img, objs);
    butterPot(img, 206, 122); geo("dip", [206, 122]);
    glow(img, 120, 80, 70, "#ffe8b0", 0.1, 30);
    return img;
  }

  // ---------- salads ----------
  const SALADS = {
    marsh: { leaves: [["samphire", 80], ["leafy", 22]], dress: "#c8c070" },
    forest: { leaves: [["leafy", 34], ["flower", 14], ["pea", 8]] },
    egg: { leaves: [["leafy", 26]], eggs: 3, skillet: true },
    sea: { leaves: [["leafy", 14], ["samphire", 46], ["grapes", 18]], lemon: true },
  };
  function saladServe(spec, o) {
    const look = spec.look, sd = Object.assign({}, SALADS[spec.pal] || SALADS.forest, look.salad || {}), burnt = o.burnt, img = tableBack(o.seed || 16);
    let f;
    if (sd.skillet) { B.skilletWide(img, 120, 82, 100, 38, 0); f = { cx: 120, cy: 82, rx: 86, ry: 30 }; }
    else f = bowl(img, 120, 74, 110, 46, 24, look.ware || "wood");
    saladBits(img, f, sd, burnt ? "burnt" : "cook", 3);
    return img;
  }
  function saladBits(img, f, sd, stage, seed) {
    const burnt = stage === "burnt", raw = stage === "raw", r = rng(seed), objs = [];
    geo("leaves", f);
    const GREENS = [R(["#0e1c08", "#1c3410", "#2e5018", "#467024", "#629436", "#8cbc52"]), R(["#1a2a0a", "#2e4614", "#4a6a20", "#6a8e2e", "#90b444", "#b8d870"]), R(["#2a0a10", "#4a1420", "#6a2030", "#8a3444", "#aa4e5a"])];
    for (const [kind, n] of sd.leaves) for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.88, x = f.cx + Math.cos(a) * f.rx * d, y = f.cy + Math.sin(a) * f.ry * d, base = r() * 6, gone = taken(null, x, y), o0 = objs.length;
      if (kind === "samphire") { const ang = r() * TAU, rp = burnt ? BURNT : GREENS[1]; for (let k = 0; k < 3; k++) objs.push(blob(x + Math.cos(ang) * k * 5, y + Math.sin(ang) * k * 2.4, 3.6, 2.2, 3, (xx, yy, ii) => (ii.spec > 0.5 ? "#e8ffc8" : ramp(rp, 0.2 + ii.diff * 0.75, xx, yy)), { k: 30, base: base + k * 0.3 })); }
      else if (kind === "flower") { const c = [["#f4d03a", "#fff4a0"], ["#e8e4dc", "#ffffff"], ["#e05a3a", "#ffa070"]][i % 3]; objs.push(blob(x, y, 3.5, 2.6, 2, (xx, yy, ii) => (Math.hypot(xx - x, yy - y) < 1 ? "#c87a10" : ii.diff > 0.5 ? c[1] : c[0]), { k: 20, base: base + 4 })); }
      else if (kind === "grapes") { for (let k = 0; k < 7; k++) objs.push(blob(x + (k % 3) * 4 - 4, y + Math.floor(k / 3) * 3.4, 2.6, 2.4, 2.6, (xx, yy, ii) => (ii.spec > 0.4 ? "#f4ffe0" : ramp(R(["#1a3a10", "#2e6020", "#4a8a34", "#72b04e", "#a8d880"]), 0.2 + ii.diff * 0.8, xx, yy)), { k: 40, base: base + 3 + k * 0.1 })); }
      else if (kind === "pea") objs.push(Object.assign(BIT.pea(x, y, 2.6, {}, i), { base: base + 3 }));
      else objs.push(blob(x, y, 10 + r() * 6, 5 + r() * 3, 3, ((rp) => (xx, yy, ii) => (Math.abs((yy - y) - (xx - x) * 0.3) < 0.5 && !burnt ? "#c8e090" : ii.spec > 0.6 && !burnt ? "#f0ffe0" : ramp(burnt ? BURNT : rp, 0.2 + ii.diff * 0.7 - ii.ao * 0.4, xx, yy)))(GREENS[i % 3 === 2 && sd.leaves.length > 2 ? 2 : i % 2]), { wob: [[2, 0.3, i], [5, 0.12, i]], seed: i, k: 26, base }));
      if (gone) objs.length = o0;
    }
    scene(img, objs);
    if (sd.eggs && !raw) for (let k = 0; k < sd.eggs; k++) { const x = f.cx - 44 + k * 44, y = f.cy - 4 + (k % 2) * 8; item("e" + k, x, y, 14, "egg", { z: k % 2 }); if (taken("e" + k)) continue; scene(img, [blob(x, y, 15, 10, 2, shade(burnt ? BURNT : RP.white, { base: 0.3 }), { wob: [[3, 0.2, k], [5, 0.1, k]], k: 20, base: 12 }), blob(x - 2, y - 2, 6, 5, 5, shade(burnt ? BURNT : RP.yolk, { base: 0.3, glint: 0.4 }), { k: 40, base: 16 })]); }
    if (sd.lemon && !burnt) { lemon(img, f.cx + f.rx * 0.6, f.cy - f.ry * 0.3, 1.2); lemon(img, f.cx - f.rx * 0.5, f.cy + f.ry * 0.2, 1.1); }
    if (sd.dress && !burnt) for (let i = 0; i < 80; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.8; img.px(f.cx + Math.cos(a) * f.rx * d, f.cy + Math.sin(a) * f.ry * d, i % 3 ? sd.dress : "#fffbe0", 0.8); }
  }

  // ---------- cookware for the cooking beats ----------
  // the cauldron's mouth filling the frame, seen from above: a thick iron lip, fire-lit on the near side
  function cauldronRim(img, cx, cy, rx, ry) {
    const E = ell(cx, cy, rx, ry), E2 = ell(cx, cy, rx * 0.86, ry * 0.8);
    img.fill((x, y) => {
      const d = E(x + 0.5, y + 0.5), d2 = E2(x + 0.5, y + 0.5);
      if (d2 <= 1) return null;
      const ang = Math.atan2((y - cy) / ry, (x - cx) / rx);
      if (d > 1) return null;
      const lip = 1 - Math.abs((d - 0.93) / 0.07);
      return ramp(IRONV, 0.25 + lip * 0.4 + Math.cos(ang + 2.3) * 0.15 + (Math.sin(ang) > 0.6 ? 0.25 : 0) + (h2(x, y, 4) > 0.95 ? 0.15 : 0), x, y);
    });
    for (let k = 0; k < 80; k++) { const a = Math.PI * (0.15 + (k / 80) * 0.7); img.px(cx + Math.cos(a) * rx * 0.995, cy + Math.sin(a) * ry * 0.99, "#ff8a3a", 0.5); }
  }
  const WICKER = R(["#2a1606", "#4a2a10", "#6e4420", "#946436", "#b88850", "#d8ac72"]);
  // the steamer seen from the side: woven bands round a short drum
  function basketSide(img, cx, cy, rx, ry, depth) {
    const lay = new Img(W, H);
    for (let y = Math.floor(cy - ry); y < cy + depth + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x - cx) / rx, w = Math.sqrt(Math.max(0, 1 - nx * nx)), top = cy + w * ry * 0.2, bot = cy + depth + w * ry;
      if (Math.abs(nx) > 1 || y < top || y > bot) continue;
      const band = Math.floor((y - cy) / 4), weave = ((Math.floor(x / 4) + band) % 2) ? 0.12 : -0.08, rim = y - top < 3 || bot - y < 3;
      lay.px(x, y, ramp(WICKER, 0.5 - nx * 0.35 + weave + (rim ? 0.2 : 0) + ((y - cy) % 4 === 0 ? -0.2 : 0), x, y));
    }
    outline(lay, "#0a0402");
    img.paste(lay, 0, 0);
  }
  // looking down into the steamer: a woven rim, a bed of leaves inside
  function basketTop(img, cx, cy, rx, ry) {
    const E = ell(cx, cy, rx, ry), E2 = ell(cx, cy, rx * 0.9, ry * 0.86);
    img.fill((x, y) => {
      const d = E(x + 0.5, y + 0.5), d2 = E2(x + 0.5, y + 0.5);
      if (d > 1) return null;
      if (d2 > 1) return ramp(WICKER, 0.45 + Math.cos(Math.atan2(y - cy, x - cx) + 2.3) * 0.2 + ((Math.floor(Math.atan2(y - cy, x - cx) * 20)) % 2 ? 0.12 : -0.1), x, y);
      const lf = fbm(x / 10, y / 6, 3);
      return ramp(R(["#0c1606", "#16260c", "#223a14", "#30501c", "#426a28"]), 0.2 + lf * 0.6 + (Math.abs(Math.sin((x - y * 2) * 0.12)) < 0.05 ? 0.3 : 0), x, y);
    });
  }
  // a lid: woven (the steamer's) or iron (the camp oven's), a knob or loop on top; tilt leans it as it lifts
  function lidDraw(img, cx, cy, rx, ry, tilt, woven) {
    const lay = new Img(W, H), E = ell(cx, cy, rx, ry);
    hrender(lay, [cx - rx - 1, cy - ry * 2 - 1, cx + rx + 1, cy + ry + 3], (x, y) => { const d = E(x, y + (x - cx) * (tilt || 0)); return d > 1 ? null : Math.pow(1 - d * d, 0.6) * ry * 0.9; }, (x, y, i) => {
      if (woven) return ramp(WICKER, 0.2 + i.diff * 0.75 + ((Math.floor(Math.hypot((x - cx) / rx, (y - cy) / ry) * 8)) % 2 ? 0.1 : -0.1), x, y);
      return i.spec > 0.6 ? "#8a8a96" : ramp(IRONV, 0.2 + i.diff * 0.7, x, y);
    }, { k: 20 });
    const kx = cx, ky = cy - ry * 0.9;
    if (woven) for (let k = -4; k <= 4; k++) lay.px(kx + k, ky - Math.sqrt(16 - k * k) * 0.8, "#6e4420");
    else lay.rect(kx - 3, ky - 3, 7, 4, "#3a3a44");
    outline(lay, "#050302");
    img.paste(lay, 0, 0);
  }
  function stickDraw(img, x0, y0, x1, y1, w) { stick(img, x0, y0, x1, y1, { w }); }
  function leafDraw(img, x, y, rx, ry, ang, burnt) {
    const ca = Math.cos(ang), sa = Math.sin(ang), lay = new Img(W, H);
    hrender(lay, [x - rx - 2, y - rx - 2, x + rx + 2, y + rx + 2], (xx, yy) => { const u = ((xx - x) * ca + (yy - y) * sa) / rx, v = (-(xx - x) * sa + (yy - y) * ca) / ry; const w = 1 - u * u; return w <= 0 || Math.abs(v) > w ? null : (w - Math.abs(v)) * 3; }, (xx, yy, i) => {
      const v = (-(xx - x) * sa + (yy - y) * ca) / ry;
      if (Math.abs(v) < 0.08 && !burnt) return "#a8c878";
      return ramp(burnt ? BURNT : R(["#0e1c08", "#1c3410", "#2e5018", "#467024", "#629436", "#8cbc52"]), 0.2 + i.diff * 0.7, xx, yy);
    });
    outline(lay, "#060a04");
    img.paste(lay, 0, 0);
  }
  function leafBed(img, cx, cy, rx, ry) { for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; leafDraw(img, cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.55, rx * 0.55, ry * 0.4, a, false); } }
  function clayHalves(img, cx, cy, rx, ry) {
    for (const s of [-1, 1]) scene(img, [blob(cx + s * rx * 0.85, cy + 4, rx * 0.4, ry * 0.7, 10, (x, y, i) => (Math.abs(x - cx - s * rx * 0.55) < 3 ? "#1a0e06" : pick(R(["#2a160c", "#4a2a18", "#6e4228", "#94603c", "#b88256"]), 0.15 + i.diff * 0.8, x, y)), { wob: [[3, 0.12, s + 2]], k: 10 })]);
  }
  // a joint turning on the spit: a lit capsule whose crust and scoring travel round with the turn
  function rotJoint(img, spec, cx, cy, rx, rr, rot, stage, seed, done) { jointAt(img, roastLook(spec), cx, cy + rr * 0.15, rx * 1.9, rr * 1.1, stage, seed, rot, done); }
  const vn = (x, y, s) => K.vnoise(x, y, s);

  Object.assign(FA.PLATES, {
    pie: { piece: (spec) => ({ draw(img, o) { const pi = Object.assign({}, PIES[spec.pal] || PIES.pie, spec.look.pie || {}); pieTop(img, pi, o.stage, o.cx, o.cy, o.s * 0.7, spec.look); } }), serve: pieServe },
    sweet: { piece: (spec) => ({ draw(img, o) { const kind = spec.look.sweet || { trifle: "trifle", berry: "tart", honey: "cake", toffee: "toffee" }[spec.pal] || "tart"; SWEETS[kind](img, spec, o.stage, o.cx, o.cy, o.s * 0.7); } }), serve: sweetServe },
    jelly: { piece: (spec) => ({ draw(img, o) { if (spec.pal === "cathedral") cathedral(img, o.cx, o.cy + 30 * o.s, o.stage === "burnt", o.wob || 0); else jellyDome(img, o.cx, o.cy + 20 * o.s, 40 * o.s, 28 * o.s, o.stage === "burnt", o.wob || 0, spec.look); } }), serve: jellyServe },
    ice: { piece: (spec) => ({ draw(img, o) { const im = iceServe(spec, { burnt: o.stage === "burnt" }); img.paste(im, 0, 0); } }), serve: iceServe },
    fillet: { piece: (spec) => ({ draw(img, o) { if (spec.pal === "sardine") { for (let k = 0; k < 4; k++) sardine(img, o.cx - 34 + (k % 2) * 68, o.cy - 12 + Math.floor(k / 2) * 22, o.stage, k, k % 2 ? -1 : 1); } else serpentFillet(img, o.cx, o.cy, o.stage, 1); } }), serve: filletServe },
    claws: { piece: (spec) => ({ draw(img, o) { const cl = Object.assign({}, CLAWS[spec.pal] || CLAWS.crab, spec.look.claws || {}); if (cl.legend) { scene(img, [crabLeg(o.cx - 110 * o.s, o.cy + 14 * o.s, -0.2, 220 * o.s, 2.4 * o.s, cl.shell, o.stage, 1, { bend: 0.2 })]); return; } scene(img, clawHeap(o.cx, o.cy, 54 * o.s, 20 * o.s, cl, o.stage, 3, o.s * 0.75)); } }), serve: clawsServe },
    salad: { piece: (spec) => ({ draw(img, o) { const sd = Object.assign({}, SALADS[spec.pal] || SALADS.forest, spec.look.salad || {}); saladBits(img, { cx: o.cx, cy: o.cy, rx: 70 * o.s, ry: 26 * o.s }, sd, o.stage, 3); } }), serve: saladServe },
  });

  Object.assign(FA.PLATES, {
    roast: { piece: (spec) => ({ draw(img, o) { const rl = Object.assign({}, ROASTS[spec.pal] || ROASTS.pork, spec.look.roast || {}); if (rl.roots) return scene(img, [jointObj(o.cx, o.cy, 40 * o.s, 18 * o.s, ROASTS.pork, o.stage, o.seed)]); jointAt(img, rl, o.cx, o.cy, 92 * o.s, 24 * o.s, o.stage, o.seed); } }), serve: roastServe },
    skewer: { piece: (spec) => ({ draw(img, o) { const sk = Object.assign({}, SKEWERS[spec.pal] || SKEWERS.rat, spec.look.skewer || {}); const x0 = o.cx - 70 * o.s, x1 = o.cx + 70 * o.s; stick(img, x0 - 12, o.cy, x1 + 12, o.cy, { w: Math.max(2, Math.round(2 * o.s)) }); if (sk.fish) trout(img, o.cx, o.cy, 58 * o.s, 0, o.stage, 1); else if (sk.twist) braid(img, x0, o.cy, x1, o.cy, o.stage, 0); else if (sk.rounds) tentacleOn(img, x0, o.cy, x1 - 14, o.cy, o.stage, 1); else if (sk.drums) drumstick(img, o.cx, o.cy, o.stage, 2, o.s); else scene(img, skewerChunks(x0, o.cy, x1, o.cy, Object.assign({}, sk, { size: sk.size * o.s }), o.stage, 2)); } }), serve: skewerServe },
    sausage: { piece: () => ({ draw(img, o) { sausageCoil(img, o.cx, o.cy, 60 * o.s, o.stage, 1); } }), serve: sausageServe },
    crisps: { piece: (spec) => ({ draw(img, o) { const fr = Object.assign({}, FRY[spec.pal] || FRY.fish, spec.look.fry || {}); scene(img, crispBits(o.cx, o.cy, 70 * o.s, 26 * o.s, fr, o.stage, 4, spec.look)); } }), serve: crispsServe },
    bun: { piece: (spec) => ({ draw(img, o) { const br = Object.assign({}, BREADS[spec.pal] || BREADS.spice, spec.look.bread || {}); scene(img, breadObjs(br, o.stage, o.cx, o.cy, o.s * 0.75)); breadAfter(img, br, o.stage, o.cx, o.cy, o.s * 0.75); } }), serve: breadServe },
  });

  // ---------- each dish as itself: what sets it apart from the others on its plate (league/content/food.py desc is the brief) ----------
  const BROTH = {
    pepper: R(["#3a0804", "#621208", "#8a220c", "#b23a16", "#d45a26", "#ec8040"]),
    chili: R(["#2a0604", "#4a0e06", "#701a0a", "#962c12", "#b8441c", "#d6642c"]),
    wine: R(["#1a0406", "#30080c", "#4a1012", "#661c1a", "#842e24", "#a04432"]),
    elk: R(["#160a04", "#28140a", "#3e2212", "#56341c", "#704828", "#8c6038"]),
    chowder: R(["#6a6050", "#8a806c", "#aaa08a", "#c6bea8", "#ddd6c2", "#f0ecdc"]),
    onion: R(["#5a3a0a", "#7e5414", "#a07020", "#c08c34", "#d8a84e", "#ecc670"]),
    stock: R(["#1a2008", "#2a3410", "#3e4a18", "#566222", "#6e7a30", "#8a9440"]),
    liar: R(["#2a1006", "#4a1e0c", "#6e3014", "#94481e", "#b8642c", "#d4843e"]),
  };
  const DISH_LOOKS = {
    varro_bun: { bread: { feud: true } },
    hammerhand_grill: { shield: true, mixed: true },
    collegium_trifle: { flag: true },
    bellows_pepperpot: { broth: BROTH.pepper, vessel: "cauldron", herbs: false },
    thornwall_pie: { pie: { crest: true, moat: true } },
    sergeants_roast: { attention: true },
    rampart_hotpot: { roof: true, ware: "iron" },
    bramble_tart: { sweet: "tart" },
    grey_bread: {},
    miners_pasty: { pie: { knob: true } },
    sausage_coil: {},
    pitshaft_stew: { vessel: "bucket" },
    river_cone: {},
    spice_pilaf: { vessel: "platter", ware: "glaze", mound: 22 },
    toll_fritters: {},
    honest_honeycake: { sweet: "cake", weight: true },
    eel_pie: {},
    frogleg_fry: {},
    fenmist_chowder: { broth: BROTH.chowder, oil: 0.15, hi: "#ffffff", bits: [["potato", 7, 7], ["fishflake", 8, 6], ["leafy", 3, 4]], mist: true, ware: "glaze" },
    marsh_greens: {},
    mushroom_pasty: { pie: { emblem: true } },
    venison_haunch: { bone: true },
    forest_floor: {},
    owls_nest: { sweet: "tart", crumble: true },
    harbour_chowder: { broth: BROTH.chowder, oil: 0.15, hi: "#ffffff", bits: [["potato", 6, 7], ["shrimp", 7, 6], ["fishflake", 6, 5], ["leafy", 3, 4]], heel: true, ware: "pewter" },
    pinching_pot: {},
    plank_sardines: {},
    kelp_cod: { fry: { kind: "cod", vessel: "paper" } },
    yeti_bun: { hair: true },
    elk_stew: { broth: BROTH.elk, bits: [["meat", 12, 12], ["barley", 40, 3.2], ["juniper", 12, 3], ["carrot", 5, 8]], ware: "wood" },
    ice_salmon: {},
    snowdrift: {},
    ration_hash: { vessel: "skillet", hash: true },
    flatbread: {},
    forager_stew: { bits: [["mushroom", 22, 10], ["crouton", 5, 9], ["leafy", 6, 7]], ware: "wood" },
    trail_porridge: { ware: "wood" },
    hedge_eggs: {},
    fish_sticks: {},
    toasted_cheese: {},
    skillet_cobbler: { sweet: "cobbler" },
    onion_broth: { broth: BROTH.onion, oil: 0.25, bits: [["onion", 14, 9], ["leafy", 3, 4]], bone: true, ware: "clay" },
    twist_bread: {},
    drake_steak: {},
    wolf_stew: { ware: "wood" },
    spider_crisps: { fry: { kind: "legs", vessel: "basket" } },
    roast_boar: { bone: true },
    rat_stick: { skewer: { drums: true } },
    slime_jelly: {},
    troll_haunch: { regrow: true },
    devilled_wings: {},
    cap_ragout: { bits: [["mushroom", 18, 11], ["onion", 6, 7]], legs: true, ware: "iron" },
    ransom_hotpot: { ware: "iron" },
    crawler_boil: {},
    clifftop_clatter: { rock: true, shieldEdge: true, heapSeed: 7, claws: { props: ["lemon"] }, spray: true },
    yeti_steak: {},
    serpent_coals: {},
    salamander_skewers: {},
    chill_sorbet: {},
    wisp_toffee: { sweet: "toffee" },
    // broad beans and meat in a peppery brown stew (beans from the Old World; the red kidney bean and the chilli are not)
    kobold_chili: { broth: R(["#200a04", "#3a1608", "#58240e", "#783616", "#984c22", "#b46630"]), onePepper: true, ware: "clay",
      bean: R(["#24300e", "#3e4c18", "#5a6a24", "#7a8a34", "#9aa84c", "#bcc46e"]), bits: [["bean", 46, 5.6], ["meat", 8, 9], ["onion", 5, 7]] },
    sea_grape_salad: {},
    coal_roots: {},
    victory_ham: { shield: true, goblin: true },
    honey_cakes: { sweet: "honeycakes" },
    matriarch_crack: {},
    treasure_crab: {},
    undying_braise: { broth: BROTH.wine, bits: [["meat", 12, 15], ["mushroom", 6, 8], ["onion", 8, 7]], bottle: true, ware: "iron" },
    bottomless_broth: { broth: BROTH.stock, vessel: "cauldron", bits: [["onion", 6, 7], ["mushroom", 5, 7], ["leafy", 5, 5]], ladle: true },
    snowmead_roast: {},
    kraken_coals: {},
    hoardmother_roast: {},
    nesting_roast: {},
    wobbling_cathedral: {},
    fire_ice_tower: {},
    liars_soup: { liar: true, bits: [], ware: "glaze" },
    stargazy_serpent: {},
  };
  for (const [id, look] of Object.entries(DISH_LOOKS)) FA.DISH[id] = Object.assign({}, FA.DISH[id] || {}, { look: Object.assign({}, (FA.DISH[id] || {}).look || {}, look) });

  // ---------- the haul: every cookable part (goods ids in league/content/goods.py PARTS), the camp-supper supplies and each method's sides ----------
  const RAWR = {
    rat: R(["#3a1012", "#5a1c1e", "#7e2e2c", "#a0463e", "#c06258", "#d88274"]),
    wolf: R(["#2e080c", "#4e1016", "#701c22", "#92302e", "#b0483e", "#c86052"]),
    boar: R(["#4a1418", "#702428", "#963a3a", "#b8564e", "#d4766a", "#ea9c8c"]),
    troll: R(["#2a1a14", "#44281e", "#5e3a2a", "#7a4e38", "#966648", "#b08060"]),
    yeti: R(["#40121a", "#661a26", "#8e2c36", "#b04048", "#cc5a5c", "#e47a76"]),
  };
  const BONE = R(["#6a5a42", "#9a8a6a", "#c8b894", "#e8dcbc", "#fff8e6"]);
  function haunch(img, x, y, s, rp, seed, o) {
    o = o || {};
    B.slab(img, { cx: x, cy: y, rx: (o.rx || 40) * s, ry: (o.ry || 20) * s, thick: 8 * s, s: s * 1.1, seed, done: 0, look: { raw: rp, fat: o.fat, scales: o.scales } });
    if (o.bone) scene(img, [blob(x + (o.rx || 40) * s * 0.95, y - 2 * s, 9 * s, 3.5 * s, 4 * s, shade(BONE, { base: 0.3 }), { k: 24, base: 30 }), blob(x + (o.rx || 40) * s * 0.95 + 9 * s, y - 4 * s, 4 * s, 3.5 * s, 4 * s, shade(BONE, { base: 0.3 }), { k: 24, base: 31 }), blob(x + (o.rx || 40) * s * 0.95 + 9 * s, y + 1 * s, 4 * s, 3.5 * s, 4 * s, shade(BONE, { base: 0.3 }), { k: 24, base: 31 })]);
    if (o.rind) { const E = ell(x, y, (o.rx || 40) * s, (o.ry || 20) * s); img.fill((xx, yy) => { const d = E(xx + 0.5, yy + 0.5); return d > 0.86 && d <= 1 && yy < y ? ramp(R(["#a88a70", "#c8aa8c", "#e2c8aa", "#f4e2c8"]), 0.5 + (xx % 3 === 0 ? -0.2 : 0), xx, yy) : null; }, x - 50 * s, y - 30 * s, x + 50 * s, y); }
    if (o.skin) { const E = ell(x, y, (o.rx || 40) * s, (o.ry || 20) * s); img.fill((xx, yy) => { const d = E(xx + 0.5, yy + 0.5); return d > 0.8 && d <= 1 && yy < y + 4 ? ramp(o.skin, 0.4 + (h2(xx, yy, 2) > 0.8 ? 0.3 : 0), xx, yy) : null; }, x - 60 * s, y - 30 * s, x + 60 * s, y + 10); }
  }
  function jar(img, x, y, s, fill, o) {
    o = o || {};
    const lay = new Img(W, H);
    scene(lay, [blob(x, y, 11 * s, 14 * s, 9 * s, (xx, yy, i) => {
      if (yy < y - 9 * s) return ramp(R(["#3a2a1a", "#5a4430", "#7a6046", "#9a7c5c"]), 0.3 + i.diff * 0.6, xx, yy);
      if (i.spec > 0.5) return "#ffffff";
      const c = ramp(fill, 0.2 + i.diff * 0.5 + (1 - Math.abs(xx - x) / (11 * s)) * 0.3, xx, yy);
      return o.glowc && h2(xx, yy, 4) > 0.9 ? o.glowc : c;
    }, { pow: 0.9, k: 40 })]);
    for (let k = -8; k <= 8; k++) lay.px(x + k * s, y - 9 * s, "#c8b48a");
    outline(lay, "#0e0a08");
    if (o.glowc) glow(img, x, y, 22 * s, o.glowc, 0.35);
    img.paste(lay, 0, 0);
    if (o.mist) for (let k = 0; k < 3; k++) steam(img, x - 4 + k * 4, y - 12 * s, 16, k * 2, 0.4, 2, 2, "#d8ecff");
  }
  function mushroomPart(img, x, y, s, cap, legs, seed) {
    if (legs) for (const dx of [-4, 3]) for (let j = 0; j < 8 * s; j++) { img.px(x + dx * s - 1, y + 4 * s + j, "#2a1a0e"); img.px(x + dx * s, y + 4 * s + j, "#f0e2c4"); img.px(x + dx * s + 1, y + 4 * s + j, "#2a1a0e"); }
    scene(img, [blob(x, y + 3 * s, 4 * s, 6 * s, 4 * s, shade(R(["#a8987a", "#ccbc9c", "#e8dcc0", "#fbf4e6"]), { base: 0.3 }), { k: 16 }), blob(x, y - 3 * s, 12 * s, 8 * s, 8 * s, (xx, yy, i) => (i.spec > 0.55 ? "#fbe8c8" : h2(Math.floor(xx / 3), Math.floor(yy / 3), seed) > 0.85 ? ramp(cap, 0.9, xx, yy) : ramp(cap, 0.1 + i.diff * 0.8, xx, yy)), { pow: 0.7, k: 16, base: 6 })]);
    if (legs) { img.rect(x - 4 * s, y - 4 * s, 2, 2, "#ffffff"); img.rect(x + 2 * s, y - 4 * s, 2, 2, "#ffffff"); img.px(x - 3 * s, y - 3 * s, "#1a1010"); img.px(x + 3 * s, y - 3 * s, "#1a1010"); }
  }
  function tentacle(img, x, y, s, burnt) {
    const pts = [];
    for (let k = 0; k <= 40; k++) { const t = k / 40, a = t * 4.2; pts.push([x - 40 * s + t * 60 * s + Math.cos(a) * t * 16 * s, y + Math.sin(a) * t * 14 * s, (1 - t * 0.8) * 9 * s]); }
    const objs = pts.map(([px, py, r], k) => blob(px, py, r, r * 0.8, r * 0.8, (xx, yy, i) => {
      if (!burnt && yy > py + r * 0.3 && h2(Math.floor(xx / 3), Math.floor(yy / 2), k) > 0.4) return ramp(R(["#a88a7a", "#cfb4a0", "#ead6c4", "#fff0e4"]), 0.3 + i.diff * 0.6, xx, yy);
      return ramp(R(["#2a0a0c", "#4a1416", "#6e2222", "#924036", "#b4604e"]), 0.15 + i.diff * 0.8, xx, yy);
    }, { k: 20, base: 40 - k }));
    scene(img, objs);
  }
  function wings(img, x, y, s) {
    for (const sx of [-1, 1]) scene(img, [{ x0: x - 30 * s, y0: y - 18 * s, x1: x + 30 * s, y1: y + 10 * s, k: 18, hf: (xx, yy) => {
      const u = (xx - x) * sx / (26 * s), v = (y - yy) / (16 * s);
      if (u < 0.05 || u > 1 || v < -0.3) return null;
      const top = 0.95 - u * 0.3, scal = Math.abs(Math.sin(u * Math.PI * 2.5)) * 0.3;
      return v > top || v < -0.3 + scal ? null : 2 + (Math.abs(u * 6 - Math.round(u * 6)) < 0.08 ? 1.5 : 0);
    }, cf: (xx, yy, i) => ramp(R(["#2a1a18", "#46302c", "#664840", "#866456", "#a8846e"]), 0.25 + i.diff * 0.7 + (Math.abs(((xx - x) / s) % 8) < 1 ? -0.3 : 0), xx, yy) }]);
  }
  function sausageString(img, x, y, s) {
    const objs = [];
    for (let k = 0; k < 5; k++) { const a = k * 0.7, px = x - 36 * s + k * 17 * s, py = y + Math.sin(a) * 6 * s; objs.push(blob(px, py, 9 * s, 5 * s, 5 * s, (xx, yy, i) => (i.spec > 0.55 ? "#ffe8d8" : ramp(R(["#3a1410", "#5e2420", "#843a32", "#a8564a", "#c87868"]), 0.2 + i.diff * 0.8, xx, yy)), { wob: [[1, 0.12, a]], k: 30 })); }
    scene(img, objs);
    for (let k = 0; k < 4; k++) img.rect(x - 28 * s + k * 17 * s, y + Math.sin(k * 0.7 + 0.35) * 6 * s - 1, 2, 3, "#d8c8a0");
  }
  function iceBlock(img, x, y, s) {
    const lay = new Img(W, H), w = 18 * s, h = 14 * s, d = 8 * s;
    lay.fill((xx, yy) => { const u = xx - x, v = yy - y; if (u > -w && u < w && v > -h + d && v < h) return ramp(RP.ice, 0.35 + (u < -w + 3 ? 0.3 : 0) + (h2(xx, yy, 2) > 0.9 ? 0.3 : 0) - (v / h) * 0.15, xx, yy); if (u > -w + (v + h) * 0 && u < w && v > -h && v <= -h + d && u - (v + h) < w) return ramp(RP.ice, 0.75 + (h2(xx, yy, 3) > 0.9 ? 0.2 : 0), xx, yy); return null; });
    outline(lay, "#1a2a3a");
    img.paste(lay, 0, 0);
    star(img, x - w + 5, y - h + 4, "#ffffff", 2);
  }
  function honeycomb(img, x, y, s) {
    const hc = new Img(W, H);
    hc.fill((xx, yy) => { const u = (xx - x) / (26 * s), v = (yy - y) / (16 * s); if (Math.abs(u) > 1 || Math.abs(v) > 1 || Math.abs(u) + Math.abs(v) * 0.5 > 1.2) return null; const row = Math.floor(yy / 3), cxx = ((xx + (row % 2) * 2) % 4) - 2, cyy = yy % 3 - 1; return Math.abs(cxx) > 1.2 || Math.abs(cyy) > 0.8 ? "#c8841c" : ramp(RP.honey, 0.6 + (h2(xx, yy, 3) - 0.5) * 0.5, xx, yy); });
    outline(hc, "#3a1a04");
    img.paste(hc, 0, 0);
    glow(img, x, y, 30 * s, "#ffd060", 0.18);
  }
  function bottle(img, x, y, s) {
    const lay = new Img(W, H);
    scene(lay, [blob(x, y + 6 * s, 10 * s, 16 * s, 10 * s, (xx, yy, i) => (i.spec > 0.5 ? "#c8d8c0" : ramp(R(["#060806", "#0e140c", "#18221a", "#243226", "#38483a"]), 0.15 + i.diff * 0.8, xx, yy)), { pow: 0.8, k: 40 })]);
    lay.rect(x - 3 * s, y - 16 * s, 6 * s, 10 * s, "#1a2418"); lay.rect(x - 4 * s, y - 20 * s, 8 * s, 5 * s, "#a01418"); lay.rect(x - 6 * s, y + 4 * s, 12 * s, 7 * s, "#e8dcc0");
    outline(lay, "#020302");
    img.paste(lay, 0, 0);
  }
  function cask(img, x, y, s, frost) {
    const lay = new Img(W, H);
    scene(lay, [blob(x, y, 16 * s, 11 * s, 10 * s, (xx, yy, i) => { const hoop = Math.abs(Math.abs(xx - x) - 9 * s) < 1.2; if (hoop) return ramp(IRONV, 0.4 + i.diff * 0.5, xx, yy); if (frost && i.diff > 0.5 && h2(xx, yy, 5) > 0.6) return "#e8f4ff"; return ramp(WOODB, 0.2 + i.diff * 0.7 + (Math.floor(yy / 3) % 2 ? 0.05 : -0.05), xx, yy); }, { pow: 0.5, k: 20 })]);
    outline(lay, "#0a0604");
    img.paste(lay, 0, 0);
  }
  function stockpot(img, x, y, s) {
    const f = cauldron(img, x, y - 4 * s, 16 * s, 6 * s, 14 * s);
    scene(img, [liquid(f.cx, f.cy, f.rx, f.ry, 0, R(["#1a2008", "#2a3410", "#3e4a18", "#566222", "#6e7a30"]), { seed: 2, oil: 0.4 })]);
    glow(img, x, y - 8 * s, 18 * s, "#8ac840", 0.25);
  }
  function salamander(img, x, y, s, burnt) {
    const objs = [];
    for (let k = 0; k < 14; k++) { const t = k / 14, px = x - 30 * s + t * 60 * s, py = y + Math.sin(t * 3) * 4 * s, r = (1 - t * 0.8) * 9 * s; objs.push(blob(px, py, r, r * 0.8, r * 0.8, (xx, yy, i) => (h2(Math.floor(xx / 2), Math.floor(yy / 2), k) > 0.85 && !burnt ? "#ffd27a" : ramp(R(["#3a0a04", "#6a1408", "#a02a0c", "#d04a16", "#f07a28", "#ffb050"]), 0.15 + i.diff * 0.8, xx, yy)), { k: 20, base: k * 0.2 })); }
    glow(img, x, y, 40 * s, "#ff7a2a", 0.25);
    scene(img, objs);
  }
  function dragonTail(img, x, y, s) {
    const objs = [];
    for (let k = 0; k < 18; k++) { const t = k / 18, px = x - 46 * s + t * 92 * s, py = y + Math.sin(t * 2.5) * 6 * s, r = (1 - t * 0.85) * 14 * s; objs.push(blob(px, py, r, r * 0.8, r * 0.8, (xx, yy, i) => { const row = Math.floor(yy / 3), cx2 = Math.floor((xx + (row % 2) * 2) / 4) * 4 + 2 - (row % 2) * 2, d = Math.hypot(xx - cx2, (yy - row * 3) * 1.3); if (d > 2.5 && d < 3.3) return ramp(R(["#1a0402", "#3a0a04"]), 0.5, xx, yy); if (h2(xx, yy, k) > 0.96) return "#ffe890"; return ramp(R(["#3a0a04", "#6a1408", "#9a240c", "#c83c14", "#e8642a", "#ffa050"]), 0.15 + i.diff * 0.8, xx, yy); }, { k: 24, base: k * 0.3 })); }
    glow(img, x, y, 60 * s, "#ff8a2a", 0.22, 30 * s);
    scene(img, objs);
  }
  function oysters3(img, x, y, s) { for (let k = 0; k < 3; k++) oyster(img, x - 16 * s + k * 16 * s, y + (k % 2) * 6 * s, false); }
  function herbBundle(img, x, y, s) { for (let k = 0; k < 4; k++) herb(img, x - 4 * s + k * 3 * s, y + k * s, 1.1 * s, k + 3); for (let j = 0; j < 3; j++) img.px(x - 6 * s + j, y + 6 * s, "#c8a860"); }
  function rationBag(img, x, y, s) {
    saltPouchLike(img, x - 8 * s, y, s);
    for (let k = 0; k < 3; k++) scene(img, [blob(x + 10 * s + k * 8 * s, y + 6 * s - k * 2 * s, 6 * s, 5 * s, 3 * s, (xx, yy, i) => (h2(xx, yy, k) > 0.85 ? "#6a4a24" : ramp(R(["#6a4a24", "#8e6a3a", "#b08c54", "#ccaa70", "#e2c690"]), 0.2 + i.diff * 0.7, xx, yy)), { pow: 0.2, k: 12, base: k })]);
  }
  function saltPouchLike(img, x, y, s) { B.saltPouch(img, x, y, 3, s); }
  function forageNest(img, x, y, s) {
    for (let k = 0; k < 60; k++) { const a = k * 0.6, r = 14 * s + (k % 4) * s; img.line(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, x + Math.cos(a + 0.8) * r, y + Math.sin(a + 0.8) * r * 0.5, k % 2 ? "#6a4a24" : "#9a7a44"); }
    for (let k = 0; k < 3; k++) scene(img, [blob(x - 6 * s + k * 6 * s, y - 2 * s + (k % 2) * 2 * s, 4.5 * s, 3.5 * s, 4 * s, shade(R(["#8a8070", "#b4aa98", "#d8d0c0", "#efe8dc", "#fffaf2"]), { base: 0.3 }), { k: 30, base: 4 })]);
    leafy(img, x + 20 * s, y + 4 * s, s);
  }
  function leafy(img, x, y, s) { for (let k = 0; k < 3; k++) leafDraw(img, x + k * 4 * s, y + k * 2 * s, 12 * s, 5 * s, 0.3 + k * 0.5, 0); }
  function rootsPart(img, x, y, s) { scene(img, [blob(x, y, 18 * s, 4 * s, 4 * s, shade(RP.carrot, { base: 0.2 }), { wob: [[1, 0.3, 0.2]], k: 20 }), blob(x + 4 * s, y + 7 * s, 16 * s, 4 * s, 4 * s, shade(R(["#6a5a3a", "#9a8a62", "#c4b68a", "#e4d8b0", "#f8f0d8"]), { base: 0.2 }), { wob: [[1, 0.3, 0.4]], k: 20 })]); for (let k = 0; k < 5; k++) img.px(x - 18 * s - k, y - k * 0.6, "#4a8a2a"); }
  function kelpPart(img, x, y, s) { for (let k = 0; k < 3; k++) for (let j = 0; j < 30 * s; j++) for (let w = -2; w <= 2; w++) img.px(x - 14 * s + j + w * 0.3, y - 6 * s + k * 5 * s + Math.sin(j * 0.25 + k) * 2 + w * 0.5, ramp(R(["#0a1408", "#142410", "#20381a", "#2e4e22", "#40682e"]), 0.4 + w * 0.1, j, k)); }
  function fatJar(img, x, y, s) { const f = bowl(img, x, y, 12 * s, 5 * s, 9 * s, "clay"); scene(img, [blob(f.cx, f.cy, f.rx, f.ry, 2, shade(R(["#a89a7a", "#c8bc9a", "#e2d8bc", "#f4eedc", "#ffffff"]), { base: 0.3 }), { k: 10 })]); }
  function clayLump(img, x, y, s) { scene(img, [blob(x, y, 14 * s, 9 * s, 8 * s, (xx, yy, i) => ramp(R(["#3a2010", "#5e3a20", "#845a34", "#a87a4c", "#c8986a"]), 0.15 + i.diff * 0.8 + (fbm(xx / 2, yy / 2, 3) - 0.5) * 0.2, xx, yy), { wob: [[3, 0.1, 1], [5, 0.06, 2]], k: 10 })]); }
  function knifePart(img, x, y, s) { for (let k = -18; k < 16; k++) for (let w = 0; w < (k < 0 ? 4 : 3); w++) img.px(x + k * s, y + w - k * 0.15, k < 0 ? (w === 0 ? "#e8eef4" : w === 3 ? "#5a626c" : "#a8b2bc") : k % 7 === 0 ? "#c8a050" : w === 0 ? "#8a5a30" : "#5a3418"); }
  function berriesPart(img, x, y, s) { scene(img, scatter(x, y, 12 * s, 6 * s, [["berry", 9, 3.4 * s]], { berryC: R(["#2a0408", "#5a0a14", "#8a1622", "#b82a30", "#e04a48"]) }, 4, 2)); }
  function lidPart(img, x, y, s) { lidDraw(img, x, y, 16 * s, 6 * s, 0, true); }
  function seaGrapes(img, x, y, s) { const objs = []; for (let k = 0; k < 16; k++) objs.push(blob(x + ((k * 37) % 13 - 6) * 1.6 * s, y + Math.floor(k / 4) * 3.2 * s - 6 * s, 2.8 * s, 2.6 * s, 2.8 * s, (xx, yy, i) => (i.spec > 0.4 ? "#f4ffe0" : ramp(R(["#1a3a10", "#2e6020", "#4a8a34", "#72b04e", "#a8d880"]), 0.2 + i.diff * 0.8, xx, yy)), { k: 40, base: k * 0.2 })); scene(img, objs); }
  function firepepper(img, x, y, s) { glow(img, x, y, 20 * s, "#ff6a1a", 0.3); scene(img, [blob(x, y, 15 * s, 6 * s, 6 * s, (xx, yy, i) => (i.spec > 0.5 ? "#ffe0d0" : ramp(R(["#4a0402", "#7a0804", "#b01408", "#e02a10", "#ff5a24", "#ff9a5a"]), 0.2 + i.diff * 0.8, xx, yy)), { wob: [[1, 0.35, 0.4], [2, 0.1, 1]], k: 30 })]); for (let k = 0; k < 5; k++) img.px(x - 15 * s - k, y - 3 * s - k * 0.6, k < 2 ? "#3a6a1a" : "#5a9a2a"); }
  function wispTwist(img, x, y, s) { const lay = new Img(W, H); lay.fill((xx, yy) => { const u = (xx - x) / (10 * s), v = (yy - y) / (12 * s); return Math.abs(u) < 1 - Math.abs(v) * 0.4 && Math.abs(v) < 1 ? ramp(P.paper, 0.5 - u * 0.3, xx, yy) : null; }); outline(lay, "#2a1a0c"); img.paste(lay, 0, 0); glow(img, x, y - 12 * s, 16 * s, "#e8f8ff", 0.5); for (let k = 0; k < 8; k++) star(img, x - 6 * s + (k * 5) % 13, y - 12 * s - (k * 3) % 6, "#f4fbff", 1); }
  function lavaSalt(img, x, y, s) { const f = bowl(img, x, y, 12 * s, 5 * s, 6 * s, "iron"); for (let k = 0; k < 30; k++) { const r = rng(k + 3); img.px(f.cx + (r() - 0.5) * f.rx * 1.6, f.cy + (r() - 0.5) * f.ry * 1.6 - 1, r() < 0.5 ? "#ff8a2a" : "#ffd27a"); } glow(img, x, y, 14 * s, "#ff6a1a", 0.25); }
  function smokedHam(img, x, y, s) { scene(img, [jointObj(x, y, 34 * s, 20 * s, ROASTS.ham, "cook", 3)]); for (const dx of [-12, 0, 12]) for (let j = -20; j <= 20; j++) img.px(x + dx * s + j * 0.1, y + j * 0.5 * s, "#e8dcc0"); boneEnd(img, x + 30 * s, y - 6 * s, -0.2, 0.8 * s); }
  function mimicSlab(img, x, y, s) { B.slab(img, { cx: x, cy: y, rx: 34 * s, ry: 18 * s, thick: 10 * s, s, seed: 2, done: 0, look: { raw: R(["#8a6a60", "#b08c80", "#d0ae9e", "#e8ccbc", "#f8e6d8", "#ffffff"]), fat: R(["#c83c14", "#e85a1c", "#ff8a3a", "#ffc080"]) } }); }
  Object.assign(FA.PARTS, {
    rat_haunch: (img, x, y, s, sd) => haunch(img, x, y, s, RAWR.rat, sd, { rx: 26, ry: 13, bone: true }),
    wolf_haunch: (img, x, y, s, sd) => haunch(img, x, y, s, RAWR.wolf, sd, { rx: 42, ry: 20, bone: true }),
    boar_shoulder: (img, x, y, s, sd) => haunch(img, x, y, s, RAWR.boar, sd, { rx: 44, ry: 22, rind: true }),
    troll_haunch: (img, x, y, s, sd) => haunch(img, x, y, s, RAWR.troll, sd, { rx: 50, ry: 24, bone: true, skin: R(["#1e2410", "#2e3a1a", "#425226", "#5a6c34"]) }),
    yeti_steak: (img, x, y, s, sd) => haunch(img, x, y, s, RAWR.yeti, sd, { rx: 40, ry: 19, fat: R(["#c8b8ac", "#e0d4ca", "#f2eae2", "#ffffff"]) }),
    serpent_fillet: (img, x, y, s) => serpentFillet(img, x, y, "raw", 1),
    salamander_tail: (img, x, y, s) => salamander(img, x, y, s, false),
    warchief_ham: (img, x, y, s) => smokedHam(img, x, y, s),
    cindervast_tail: (img, x, y, s) => dragonTail(img, x, y, s),
    kraken_tentacle: (img, x, y, s) => tentacle(img, x, y, s, false),
    matriarch_leg: (img, x, y, s) => scene(img, [crabLeg(x - 60 * s, y + 10 * s, -0.25, 140 * s, 1.6 * s, CLAWS.spider.shell, "cook", 1, { bend: 0.2 })]),
    mimic_meat: (img, x, y, s) => mimicSlab(img, x, y, s),
    crab_claw: (img, x, y, s) => scene(img, [crabClaw(x, y, 1.1 * s, 0.3, RP.shellR, "raw", 2)]),
    crawler_claw: (img, x, y, s) => scene(img, [crabClaw(x, y, 1.1 * s, -0.4, CLAWS.crawler.shell, "raw", 3)]),
    oysters: (img, x, y, s) => oysters3(img, x, y, s),
    spider_leg: (img, x, y, s) => scene(img, [crabLeg(x - 40 * s, y + 6 * s, -0.15, 96 * s, 1.1 * s, CLAWS.spider.shell, "cook", 4, { bend: 0.3 })]),
    bat_wing: (img, x, y, s) => wings(img, x, y, s * 1.5),
    bandit_sausage: (img, x, y, s) => sausageString(img, x, y, s),
    walking_cap: (img, x, y, s, sd) => mushroomPart(img, x, y, s * 1.4, RP.mushroom, true, sd),
    crypt_cap: (img, x, y, s, sd) => mushroomPart(img, x, y, s * 1.4, R(["#2a3038", "#46505c", "#66727e", "#8c98a2", "#b4bec4", "#dde2e4"]), false, sd),
    firepepper: (img, x, y, s) => firepepper(img, x, y, s),
    slime_jelly: (img, x, y, s) => jar(img, x, y, s * 1.4, RP.jelly, { glowc: "#90dca0" }),
    wraith_frost: (img, x, y, s) => jar(img, x, y, s * 1.4, RP.ice, { mist: true }),
    wisp_sugar: (img, x, y, s) => wispTwist(img, x, y, s * 1.3),
    sea_grapes: (img, x, y, s) => seaGrapes(img, x, y, s * 1.4),
    glacier_ice: (img, x, y, s) => iceBlock(img, x, y, s * 1.3),
    living_coal: (img, x, y, s) => livingCoal(img, x, y, s * 1.2, false),
    lava_salt: (img, x, y, s) => lavaSalt(img, x, y, s * 1.4),
    grizzlemaw_honey: (img, x, y, s) => honeycomb(img, x, y, s),
    vessimir_wine: (img, x, y, s) => bottle(img, x, y, s * 1.3),
    thornmere_stock: (img, x, y, s) => stockpot(img, x, y, s * 1.4),
    hrimnir_mead: (img, x, y, s) => cask(img, x, y, s * 1.4, true),
    ration: (img, x, y, s) => rationBag(img, x, y, s * 1.2),
    herbs: (img, x, y, s) => herbBundle(img, x, y, s),
    fish: (img, x, y, s) => trout(img, x, y, 40 * s, -0.1, "raw", 2),
    forage: (img, x, y, s) => forageNest(img, x, y, s),
    roots: (img, x, y, s) => rootsPart(img, x, y, s),
    kelp: (img, x, y, s) => kelpPart(img, x, y, s),
    lid: (img, x, y, s) => lidPart(img, x, y, s),
    fat: (img, x, y, s) => fatJar(img, x, y, s),
    leaves: (img, x, y, s) => leafy(img, x, y, s),
    clay: (img, x, y, s) => clayLump(img, x, y, s),
    knife: (img, x, y, s) => knifePart(img, x, y, s),
    berries: (img, x, y, s) => berriesPart(img, x, y, s),
  });

  Object.assign(FA, { RP, BIT, scene, blob, shade, scatter, liquid, grains, bowl, platter, tableBack, bucket, cauldron, spoon, herb, WARE, cauldronRim, basketSide, basketTop, lidDraw, stickDraw, leafDraw, leafBed, clayHalves, rotJoint, mixedGrill, roastSlice });
})(typeof window !== "undefined" ? window : globalThis);
