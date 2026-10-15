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
  const { W, H, Img, C, mix, R, pick, rng, fbm, h2, clamp, lerp, TAU, hrender, ell, glow, light, vignette, bokeh, steam, star, outline, shadow, norm3, KEY, P, BURNT } = K;

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
      const ob = BIT[kind](cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, sz, look, Math.floor(r() * 999));
      ob.base = (base || 0) - sz * 0.35 + r() * 0.6;
      out.push(ob);
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
    fill(img, f, o.burnt);
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
    const objs = [];
    for (let k = 0; k < 2; k++) objs.push(blob(70 + k * 4, 70 + k * 18, 30, 7, 7, (x, y, i) => (burnt ? ramp(BURNT, i.diff, x, y) : i.spec > 0.6 ? "#fff0d8" : ramp(RP.sausage, 0.2 + i.diff * 0.8 + (Math.abs(((x + y * 2) % 10)) < 1 ? -0.4 : 0), x, y)), { wob: [[1, 0.1, k]], k: 30, base: 10 + k }));
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
    pork: { crust: R(["#2a0e04", "#4e1c08", "#7a3410", "#a85420", "#cc7a34", "#e8a456", "#fac884"]), inner: R(["#8a5a48", "#b07a64", "#d09a82", "#e8b8a0", "#f8d4c0"]), score: true },
    boar: { crust: R(["#1e0a04", "#3a1406", "#62260c", "#8c3e16", "#b45c24", "#d4803a", "#eca860"]), inner: R(["#6a3226", "#904638", "#b0604e", "#cc7c66", "#e49e86"]), score: true, apple: true },
    venison: { crust: R(["#140604", "#2a0c06", "#48180a", "#6a2a12", "#8a401c", "#a85a2a"]), inner: R(["#4a0c10", "#701820", "#962830", "#b84044", "#d4605c"]), herbs: true },
    troll: { crust: R(["#120e08", "#221c0e", "#342c16", "#48401e", "#5e5428", "#786c38"]), inner: R(["#4a3a2a", "#6a5440", "#8a7058", "#aa8e74", "#c8ae94"]), knots: true },
    ham: { crust: R(["#2a0c04", "#521a06", "#80300c", "#b04c14", "#d87024", "#f0983a", "#ffc46a"]), inner: R(["#9a4a4a", "#c06464", "#d88080", "#eca0a0", "#f8c4c0"]), score: true, cloves: true, glaze: 0.8 },
    mead: { crust: R(["#2a1606", "#4a2a10", "#6e421c", "#94602c", "#b8843e", "#d8aa5a"]), inner: R(["#8a5a48", "#b07a64", "#d09a82", "#e8b8a0", "#f8d4c0"]), frost: true, glaze: 0.6 },
    dragon: { crust: R(["#1a0402", "#3a0a04", "#6a1408", "#9a240c", "#c83c14", "#e8642a", "#ffa050"]), inner: R(["#7a2a1a", "#a8402a", "#cc6040", "#e48460", "#f8ac88"]), scales: true, gold: true },
    nest: { crust: R(["#2a0e04", "#4e1c08", "#7a3410", "#a85420", "#cc7a34", "#e8a456"]), inner: R(["#5a6a3a", "#8a6a4a", "#b08a6a", "#d4aa88", "#f0caa8"]), string: true, layers: true },
    roots: { roots: true },
  };
  function jointObj(cx, cy, rx, ry, rl, stage, seed) {
    const burnt = stage === "burnt", raw = stage === "raw", crust = burnt ? BURNT : raw ? rl.raw || R(["#5a2a24", "#8a4a40", "#b0685a", "#cc8a78", "#e8aa98", "#f8ccbc"]) : rl.crust;
    return blob(cx, cy, rx, ry, ry * 1.1, (x, y, i) => {
      const u = (x - cx) / rx, v = (y - cy) / ry;
      let t = 0.12 + i.diff * 0.8 + (fbm(x / 3, y / 2, seed) - 0.5) * 0.3 - i.ao * 0.4;
      if (rl.score && !raw) { const a = ((x + y * 2) % 10 + 10) % 10, b = ((x - y * 2) % 10 + 10) % 10; if (a < 1.2 || b < 1.2) t -= 0.45; else if (a < 2.4 || b < 2.4) t += 0.2; }
      if (rl.string && Math.abs(((x - cx) % 16 + 16) % 16 - 8) < 0.8) return i.diff > 0.5 ? "#f0e4c8" : "#b8a888";
      if (rl.scales && !raw) { const row = Math.floor(y / 4), cxs = Math.floor((x + (row % 2) * 3) / 6) * 6 + 3 - (row % 2) * 3, d = Math.hypot(x - cxs, (y - row * 4) * 1.4); if (d > 3.6 && d < 4.8) t -= 0.35; else if (d < 2) t += 0.15; }
      if (rl.knots && !raw && fbm(x / 5, y / 5, seed + 4) > 0.7) t -= 0.25;
      const g = (rl.glaze || 0) * (raw ? 0 : 1);
      if (i.spec > 0.62 - g * 0.25 && !i.edge && !burnt && fbm(x / 2.2, y / 1.8, seed + 3) > 0.48) return i.spec > 0.85 ? "#fff4dc" : ramp(crust, 1, x, y);
      if (rl.gold && !raw && !burnt && h2(x, y, seed + 2) > 0.94) return h2(x, y, seed) > 0.5 ? "#ffe890" : "#e8b440";
      if (rl.frost && !raw && !burnt && fbm(x / 2, y / 2, seed + 9) > 0.66) return i.diff > 0.4 ? "#f4fbff" : "#b8d0e0";
      if (rl.cloves && !raw && ((x * 7 + y * 13) % 41 === 0)) return "#1a0804";
      return ramp(crust, t, x, y, 0.45);
    }, { pow: 0.55, k: 34, wob: [[2, 0.07, seed], [3, 0.06, seed * 2], [5, 0.03, seed]], seed, rough: ry * (rl.score ? 0.04 : 0.12), scale: 2.2 });
  }
  function boneEnd(img, x, y, ang, s) {
    const ca = Math.cos(ang), sa = Math.sin(ang), BONE = R(["#6a5a42", "#9a8a6a", "#c8b894", "#e8dcbc", "#fff8e6"]);
    scene(img, [blob(x + ca * 10 * s, y + sa * 5 * s, 12 * s, 4 * s, 4 * s, shade(BONE, { base: 0.3 }), { wob: [[2, 0.1, ang]], k: 24, base: 30 }),
      blob(x + ca * 22 * s, y + sa * 10 * s - 2 * s, 5 * s, 4 * s, 5 * s, shade(BONE, { base: 0.3 }), { k: 24, base: 32 }), blob(x + ca * 22 * s + 2 * s, y + sa * 10 * s + 2 * s, 5 * s, 4 * s, 5 * s, shade(BONE, { base: 0.3 }), { k: 24, base: 31 })]);
  }
  function roastServe(spec, o) {
    const look = spec.look, rl = Object.assign({}, ROASTS[spec.pal] || ROASTS.pork, look.roast || {}), burnt = o.burnt;
    const img = tableBack(o.seed || 5);
    if (rl.roots) return rootsServe(spec, img, burnt);
    if (look.shield) shieldDish(img, 120, 90, 112, 50, look.goblin); else if (look.boardServe !== false) B.board(img, 120, 96, 116, 46, 7);
    if (!look.shield && look.boardServe === false) platter(img, 120, 92, 116, 48, "pewter", { rim: true });
    const objs = [jointObj(146, 78, 62, 30, rl, burnt ? "burnt" : "cook", o.seed || 3)];
    scene(img, objs);
    if (look.bone || rl.bone) boneEnd(img, 196, 70, -0.2, 1.1);
    if (look.regrow && !burnt) { scene(img, [blob(118, 62, 7, 5, 6, shade(R(["#2a3a14", "#46581e", "#62782a", "#82983c", "#a8bc5a"]), { base: 0.3 }), { k: 20, base: 34 })]); for (const [x, y] of [[110, 52], [126, 50], [118, 46]]) star(img, x, y, "#d8f8a0", 1); }
    if (look.attention && !burnt) {
      for (let i = 0; i < 5; i++) { const sx = 26 + i * 18, sy = 102; const lay = new Img(W, H); scene(lay, [blob(sx, sy, 8, 15, 3, (x, y, ii) => { const d = Math.hypot((x - sx) / 8, (y - sy) / 15); return d > 0.8 ? ramp(rl.crust, 0.3 + ii.diff * 0.6, x, y) : d > 0.62 ? ramp(R(["#b8a088", "#d4bca4", "#ead6c0"]), ii.diff, x, y) : ramp(R(["#a8505a", "#c86a6e", "#de8a86", "#eeaaa2", "#f8c8bc"]), 0.3 + ii.diff * 0.6, x, y); }, { pow: 0.2, k: 16 })]); outline(lay, "#1a0806"); img.paste(lay, 0, 0); K.shadow(img, sx + 3, sy + 15, 9, 2, 0.4); }
      return img;
    }
    if (!burnt) {
      for (let i = 0; i < 3; i++) {
        const lay = new Img(W, H), sx = 74 - i * 18, sy = 96 + i * 7;
        shadow(img, sx - 2, sy + 8, 20, 4, 0.35);
        B.sliceFace(lay, sx, sy, 20, 12, i, 0.32, { pink: rl.inner, crust: rl.crust, grey: rl.inner, marbleC: rl.layers ? "#5a6a3a" : null });
        if (rl.layers) lay.fill((x, y) => { const d = Math.hypot((x - sx) / 20, (y - sy) / 12); if (d > 0.62 || !lay.alpha(x, y)) return null; return d < 0.22 ? "#c8b4a0" : d < 0.42 ? "#a86c5a" : null; }, sx - 20, sy - 12, sx + 20, sy + 12);
        outline(lay, "#1a0806");
        img.paste(lay, 0, 0);
      }
      if (rl.apple) { scene(img, [blob(196, 54, 10, 9, 9, shade(R(["#3a0604", "#6a0e08", "#9a1e10", "#c83a1e", "#e8683a", "#ffa070"]), { glint: 0.5 }), { k: 30 })]); img.rect(196, 44, 1, 4, "#4a2a10"); }
      if (rl.herbs) { herb(img, 196, 112, 1.6, 2); herb(img, 40, 70, 1.3, 3); }
      for (const [x, y] of [[34, 116], [204, 112], [60, 128]]) scene(img, [BIT.carrot(x, y, 8, look, 1), BIT.onion(x + 10, y + 3, 7, look, 2)]);
      if (rl.gold) for (let i = 0; i < 30; i++) { const r = rng(i + 40); star(img, 100 + r() * 100, 50 + r() * 50, "#ffe890", 1, 0.8); }
    } else for (let i = 0; i < 50; i++) { const r = rng(i + 70); img.px(40 + r() * 170, 100 + r() * 30, r() < 0.5 ? "#2a2622" : "#4a4440"); }
    return img;
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
    const objs = [], r = rng(9), kinds = [[RP.carrot, 10], [R(["#5a4a2a", "#8a764a", "#b4a070", "#d8c894", "#f2e6c0"]), 9], [R(["#1a0408", "#3a0a10", "#5e1018", "#861a22", "#a82a2e"]), 8]];
    for (let i = 0; i < 18; i++) {
      const [rp, sz] = kinds[i % 3], a = r() * TAU, d = Math.sqrt(r()) * 0.8, x = 120 + Math.cos(a) * 80 * d, y = 84 + Math.sin(a) * 30 * d;
      objs.push(blob(x, y, sz * (i % 3 === 2 ? 1.2 : 2.4), sz * 0.95, sz * 0.9, (xx, yy, ii) => (burnt ? ramp(BURNT, 0.2 + ii.diff * 0.6, xx, yy) : h2(xx, yy, i) > 0.9 ? "#1a0804" : ramp(rp, 0.15 + ii.diff * 0.8, xx, yy)), { wob: [[1, 0.25, a]], k: 20 }));
    }
    scene(img, objs);
    livingCoal(img, 120, 78, 1.4, false);
    for (let i = 0; i < 40; i++) img.px(60 + r() * 120, 60 + r() * 50, r() < 0.5 ? "#ff8a3a" : "#ffd27a");
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

  // ---------- skewers and sausages ----------
  const SKEWERS = {
    rat: { chunk: R(["#2a0e06", "#4a1c0c", "#723014", "#9a4a22", "#c06c36", "#dc9050"]), n: 4, size: 11 },
    salamander: { chunk: R(["#3a0a04", "#6a1408", "#a02a0c", "#d04a16", "#f07a28", "#ffb050"]), n: 4, size: 11, glow: true },
    kraken: { rounds: true, chunk: R(["#2a0a0c", "#4a1416", "#6e2222", "#924036", "#b4604e", "#d48a70"]), n: 3, size: 14 },
    trout: { fish: true },
    twist: { twist: true },
  };
  function skewerChunks(cx0, cy0, cx1, cy1, sk, stage, seed) {
    const objs = [], n = sk.n || 5, burnt = stage === "burnt", raw = stage === "raw";
    for (let i = 0; i < n; i++) {
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
    const look = spec.look, sk = Object.assign({}, SKEWERS[spec.pal] || SKEWERS.rat, look.skewer || {}), burnt = o.burnt;
    const img = tableBack(o.seed || 6);
    if (sk.rounds) shieldDish(img, 120, 90, 110, 48); else B.board(img, 120, 96, 114, 44, 9);
    const rows = sk.fish ? 3 : sk.rounds ? 2 : sk.drums ? 3 : 3;
    for (let k = 0; k < rows; k++) {
      const y0 = 64 + k * 22, x0 = 24 + k * 6, x1 = 214 - k * 4;
      stick(img, x0 - 10, y0 + 8, x1 + 12, y0 - 8, { w: 2, charEnd: true });
      if (sk.fish) trout(img, (x0 + x1) / 2, y0, 62, -0.08, burnt ? "burnt" : "cook", k);
      else if (sk.drums) drumstick(img, (x0 + x1) / 2 - 10 + k * 8, y0 - 2, burnt ? "burnt" : "cook", k + 1, 1);
      else if (sk.twist) twistDough(img, x0 + 10, y0 + 6, x1 - 10, y0 - 6, burnt ? "burnt" : "cook");
      else scene(img, skewerChunks(x0 + 6, y0 + 5, x1 - 6, y0 - 5, sk, burnt ? "burnt" : "cook", k + 1));
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
    sausageCoil(img, 116, 84, 82, o.burnt ? "burnt" : "cook", 3);
    stick(img, 30, 60, 210, 112, { w: 2 }); stick(img, 40, 112, 200, 56, { w: 2 });
    if (!o.burnt) { const f = bowl(img, 206, 60, 16, 7, 9, "clay"); scene(img, [liquid(f.cx, f.cy, f.rx, f.ry, 0, R(["#7a5004", "#a87008", "#d09a14", "#e8bc30", "#f8d860"]), { seed: 2, oil: 0, ripple: 0.4 })]); }
    return img;
  }

  // ---------- fried things ----------
  const BATTER = R(["#4a2006", "#7a3a0c", "#a85c18", "#cc8228", "#e8a840", "#f8cc6c", "#fff0b0"]);
  const FRY = {
    spider: { kind: "legs", vessel: "basket" },
    cod: { kind: "cod", vessel: "paper" },
    bat: { kind: "wings", vessel: "basket", spice: true },
    fish: { kind: "fillets", vessel: "cone" },
    fritter: { kind: "balls", vessel: "plate", sugar: true },
    frog: { kind: "frogs", vessel: "basket" },
  };
  function crispBits(cx, cy, rx, ry, fr, stage, seed, look) {
    const burnt = stage === "burnt", raw = stage === "raw", r = rng(seed), objs = [];
    const rp = burnt ? BURNT : raw ? R(["#8a7a5a", "#b4a47e", "#d8c8a0", "#efe2c2", "#fffaea"]) : look.batter || BATTER;
    const crisp = (xx, yy, i, k) => {
      if (fr.spice && !raw && !burnt && h2(xx, yy, k) > 0.86) return h2(xx, yy, k + 1) > 0.5 ? "#c8200c" : "#8a1006";
      if (fr.sugar && !raw && !burnt && h2(xx, yy, k) > 0.8 && i.diff > 0.4) return "#fffaf2";
      if (i.spec > 0.6 && !burnt) return "#fff6d8";
      return ramp(rp, 0.12 + i.diff * 0.75 - i.ao * 0.45 + (fbm(xx / 1.6, yy / 1.6, k) - 0.5) * 0.45, xx, yy, 0.5);
    };
    const N = { legs: 11, wings: 9, fillets: 7, balls: 11, frogs: 10, cod: 1 }[fr.kind] || 8;
    for (let i = 0; i < N; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.7, x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d, ang = r() * Math.PI, base = i * 0.9;
      if (fr.kind === "legs") {
        const leg = crabLeg(x - Math.cos(ang) * 30, y - Math.sin(ang) * 10, ang, 78, 1.25, rp, raw ? "cook" : stage, i, { bend: (i % 2 ? 1 : -1) * 0.25, base });
        const cf0 = leg.cf; leg.cf = (xx, yy, ii) => (cf0(xx, yy, ii) ? crisp(xx, yy, ii, i) : null);
        objs.push(leg);
      } else if (fr.kind === "frogs") {
        const leg = crabLeg(x - Math.cos(ang) * 14, y - Math.sin(ang) * 6, ang, 40, 1.7, rp, raw ? "cook" : stage, i, { bend: 0.9, base });
        const cf0 = leg.cf; leg.cf = (xx, yy, ii) => (cf0(xx, yy, ii) ? crisp(xx, yy, ii, i) : null);
        objs.push(leg);
      } else if (fr.kind === "wings") {
        const ca = Math.cos(ang), sa = Math.sin(ang);
        objs.push({ x0: x - 24, y0: y - 16, x1: x + 24, y1: y + 16, k: 20, base, hf: (xx, yy) => {
          const u = ((xx - x) * ca + (yy - y) * sa) / 22, v = (-(xx - x) * sa + (yy - y) * ca) / 12;
          if (u < -1 || u > 1 || v < -0.2) return null;
          const top = 0.15 + Math.abs(Math.sin((u + 1) * Math.PI * 1.5)) * 0.55 * (1 - Math.abs(u));
          if (v > top + 0.6) return null;
          return (1 - Math.abs(u)) * 4 + (Math.abs(v - 0.1) < 0.1 ? 2 : 0);
        }, cf: (xx, yy, ii) => crisp(xx, yy, ii, i) });
      } else if (fr.kind === "fillets") {
        objs.push(blob(x, y, 22, 10, 7, (xx, yy, ii) => crisp(xx, yy, ii, i), { wob: [[2, 0.14, ang], [5, 0.06, i]], k: 18, rough: 2.5, scale: 1.3, seed: i, base }));
      } else if (fr.kind === "cod") {
        if (i > 0) continue;
        objs.push(blob(cx, cy, rx * 0.8, ry * 0.7, 12, (xx, yy, ii) => (!raw && !burnt && h2(Math.floor(xx / 2), Math.floor(yy / 2), 5) > 0.88 ? "#2e5a1c" : crisp(xx, yy, ii, i)), { wob: [[1, 0.12, 0.5], [2, 0.08, 1], [6, 0.04, 2]], k: 18, rough: 4, scale: 1.4, seed: 3, base: 2 }));
      } else if (fr.kind === "balls") {
        objs.push(blob(x, y, 12, 10.5, 11, (xx, yy, ii) => crisp(xx, yy, ii, i), { wob: [[5, 0.05, ang]], k: 18, rough: 1.4, scale: 1.2, seed: i, base, pow: 0.6 }));
      }
    }
    return objs;
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
      if (fr.vessel !== "plate") { const g = bowl(img, 210, 120, 18, 8, 10, "pewter"); scene(img, [liquid(g.cx, g.cy, g.rx, g.ry, 0, R(["#a89a7a", "#c8bc9a", "#e2d8bc", "#f4eedc"]), { seed: 2, oil: 0, ripple: 0.3 })]); for (let i = 0; i < 12; i++) img.px(g.cx - 6 + (i * 5) % 13, g.cy - 2 + (i % 3), "#4a7a2a"); }
      lemon(img, 32, 122, 1.4);
    }
    return img;
  }

  // ---------- breads ----------
  const BREADS = {
    spice: { kind: "buns", crust: R(["#3a1606", "#62280c", "#8e4214", "#b8621e", "#d8862e", "#f0ae4e", "#ffd88a"]), glaze: 0.6, swirl: true, n: 5 },
    yeti: { kind: "steamed", crust: R(["#8a8478", "#b4ae9e", "#d4cebe", "#ebe6da", "#f8f4ec", "#ffffff"]), n: 3 },
    grey: { kind: "loaf", crust: R(["#241c14", "#3a2e22", "#544434", "#6e5c48", "#8a785e", "#a69478"]), crumb: R(["#6a6458", "#8a8476", "#a8a292", "#c4beae", "#ddd8c8"]) },
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
      pos.forEach(([dx, dy, r], k) => objs.push(blob(cx + dx * s, cy + dy * s, r * s, r * 0.8 * s, r * 0.75 * s, sh(k), { wob: [[3, 0.05, k]], k: 18, base: dy * 0.1 })));
    } else if (br.kind === "loaf") {
      objs.push(blob(cx + 10 * s, cy - 4 * s, 64 * s, 30 * s, 26 * s, (x, y, i) => {
        const sl = ((x - y * 0.6) % 22 + 22) % 22;
        if (!raw && !burnt && sl < 2.4 && Math.abs(y - cy + 4 * s) < 22 * s) return ramp(br.crumb, 0.5 + i.diff * 0.4, x, y);
        if (!raw && !burnt && i.diff > 0.55 && h2(x, y, 3) > 0.72) return "#e8e2d4";
        return sh(1)(x, y, i);
      }, { pow: 0.6, wob: [[2, 0.06, 1], [5, 0.03, 2]], k: 14 }));
    } else if (br.kind === "flat") {
      for (let k = 0; k < 2; k++) objs.push(blob(cx + (k ? 28 : -24) * s, cy + (k ? 6 : -6) * s, 58 * s, 26 * s, 4 * s, (x, y, i) => (!raw && !burnt && fbm(x / 4, y / 3, k + 6) > 0.68 ? "#3a1a08" : sh(k)(x, y, i)), { wob: [[3, 0.06, k], [7, 0.03, k]], pow: 0.25, k: 14, base: k * 4 }));
    } else if (br.kind === "toast") {
      for (let k = 0; k < 2; k++) {
        const bx = cx + (k ? 36 : -36) * s, by = cy + (k ? 6 : -6) * s, w = 34 * s, h = 22 * s, th = 9 * s;
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
    if (br.swirl) [[-54, 0], [-14, -10], [26, -6], [62, 4], [6, 18]].forEach(([dx, dy], q) => { const dir = br.feud && q % 2 ? -1 : 1; for (let k = 0; k < 34; k++) { const a = k * 0.42 * dir, r = k * 0.42 * s; img.px(cx + dx * s + Math.cos(a) * r, cy + dy * s - 6 * s + Math.sin(a) * r * 0.6, k % 3 ? "#5a2208" : "#ffe8c0"); } for (let k = 0; k < 8; k++) img.px(cx + dx * s + (h2(k, q, 1) - 0.5) * 24 * s, cy + dy * s - 6 * s + (h2(q, k, 2) - 0.5) * 12 * s, "#ffffff"); });
    if (br.hair && stage !== "burnt") { for (let k = 0; k < 40; k++) { const t = k / 40; img.px(cx + 30 * s + Math.sin(t * 5) * 6 * s + t * 20 * s, cy - 30 * s - t * 26 * s, "#fbfbfb"); img.px(cx + 30 * s + Math.sin(t * 5) * 6 * s + t * 20 * s + 1, cy - 30 * s - t * 26 * s, "#b8b8c0", 0.6); } }
    if (br.kind === "steamed") for (const [dx, dy] of [[-40, 4], [34, -4], [0, 14]]) for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; img.line(cx + dx * s, cy + dy * s - 14 * s, cx + dx * s + Math.cos(a) * 9 * s, cy + dy * s - 14 * s + Math.sin(a) * 5 * s, "#c8c2b4"); }
    if (br.kind === "loaf") {
      for (let k = 0; k < 3; k++) { const lay = new Img(W, H), sx = cx - 70 * s + k * 10 * s, sy = cy + 14 * s + k * 3 * s; scene(lay, [blob(sx, sy, 16 * s, 20 * s, 4, (x, y, i) => { const d = Math.hypot((x - sx) / (16 * s), (y - sy) / (20 * s)); return d > 0.86 ? ramp(br.crust, 0.2 + i.diff * 0.6, x, y) : ramp(br.crumb, 0.3 + i.diff * 0.5 + (h2(x, y, k) > 0.8 ? -0.3 : 0), x, y); }, { pow: 0.1, k: 10, base: k })]); outline(lay, "#0a0806"); img.paste(lay, 0, 0); }
      const f = bowl(img, 196, 112, 22, 9, 12, "clay"); scene(img, [blob(f.cx, f.cy, f.rx, f.ry, 3, shade(R(["#a89a7a", "#c8bc9a", "#e2d8bc", "#f4eedc", "#ffffff"]), { base: 0.3 }), { k: 10 })]);
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
      const wedge = (x, y) => !raw && !burnt && !pi.tails && !pi.eels && !pi.stargazy && y > cy && Math.abs(x - cx - 20 * s) < (y - cy) * 1.1 && E(x, y) < 0.9;
      const gaze = pi.stargazy && !raw ? stargazyCrust(cx, cy, s) : null;
      objs.push({ x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry, k: 16, hf: (x, y) => { const d = E(x, y); if (d > 1) return null; if (wedge(x, y)) return 3; const crimp = d > 0.86 ? Math.abs(Math.sin(Math.atan2(y - cy, x - cx) * 22)) * 2.5 + 2 : 0; const crest = pi.crest && !raw && Math.abs(x - cx) < 12 * s && y > cy - 18 * s && y < cy + 2 * s && Math.abs(x - cx) < (cy + 4 * s - y) * 0.6 ? 2.5 : 0; return Math.pow(1 - d * d, 0.35) * 10 * s + crimp + crest + (gaze && d <= 0.86 ? gaze.h(x, y) : 0); }, cf: (x, y, i) => {
        const d = E(x, y);
        if (wedge(x, y)) return ramp(pi.filling, 0.25 + i.diff * 0.4 + (fbm(x / 3, y / 3, 6) - 0.5) * 0.7, x, y);
        if (gaze && d <= 0.86) { const c = gaze.c(x, y, i, crust, burnt); if (c) return c; }
        if (pi.vent && d < 0.12) return "#2a1004";
        if (pi.vent && d < 0.5 && Math.abs(Math.sin(Math.atan2(y - cy, x - cx) * 3)) < 0.08) return ramp(crust, 0.1, x, y);
        return sh(1)(x, y, i);
      } });
    } else if (pi.kind === "pasty") {
      for (let k = 0; k < 2; k++) {
        const px = cx + (k ? 40 : -38) * s, py = cy + (k ? 8 : -6) * s, rx = 46 * s, ry = 24 * s;
        objs.push({ x0: px - rx, y0: py - ry, x1: px + rx, y1: py + ry, k: 16, base: k * 2, hf: (x, y) => { const u = (x - px) / rx, v = (y - py) / ry; if (v > 0.55 || Math.hypot(u, v * 0.9 + 0.1) > 1) return null; const ridge = v < -0.1 && v > -0.35 && Math.hypot(u, v * 0.9 + 0.1) < 0.98 ? 0 : 0; const crimp = Math.hypot(u, v * 0.9 + 0.1) > 0.82 ? 2 + Math.abs(Math.sin(Math.atan2(v, u) * 16)) * 3 : 0; return (0.55 - v) * 14 * s * (1 - Math.abs(u) * 0.5) + crimp + ridge; }, cf: sh(k + 2) });
      }
    } else if (pi.kind === "chest") {
      const w = 74 * s, d = 34 * s, h = 40 * s;
      const lay = new Img(W, H);
      lay.fill((x, y) => { const fx = (x - cx) / w, top = cy - h * 0.2, fy = y - top; if (Math.abs(fx) > 1 || fy < 0 || fy > h) return null; const strap = Math.abs(Math.abs(fx) - 0.55) < 0.06; return ramp(crust, (strap ? 0.25 : 0.55) - fx * 0.25 - fy / h * 0.3 + (fbm(x / 3, y / 3, 3) - 0.5) * 0.2, x, y); });
      lay.fill((x, y) => { const fx = (x - cx) / w, top = cy - h * 0.2, dy = top - y; if (Math.abs(fx) > 1 || dy < 0 || dy > d * (Math.sqrt(1 - fx * fx * 0.5))) return null; const strap = Math.abs(Math.abs(fx) - 0.55) < 0.06; return ramp(crust, (strap ? 0.4 : 0.75) - fx * 0.2 - (dy / d) * 0.15 + (fbm(x / 3, y / 3, 4) - 0.5) * 0.2, x, y); });
      if (!raw && !burnt) { lay.rect(cx - 6, cy - h * 0.2 - 4, 12, 12, "#e8b84a"); lay.rect(cx - 2, cy - h * 0.2, 4, 5, "#5a3a0a"); for (let k = 0; k < 9; k++) star(lay, cx - 60 + k * 15, cy - h * 0.2 - d * 0.6 + (k % 2) * 4, "#fff4c8", 1, 0.8); }
      outline(lay, "#1a0a04");
      img.paste(lay, 0, 0);
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
      if (stage !== "burnt" && spec.look.flag) { for (let j = 0; j < 30 * s; j++) img.px(cx + 30 * s, top - 4 - j, "#d8c8a0"); img.rect(cx + 30 * s + 1, top - 30 * s, 12, 8, "#f4ead0"); K.text(img, "+", cx + 30 * s + 4, top - 30 * s + 7, "#7a1a10"); }
      if (stage !== "burnt") { scene(img, scatter(cx, top - 2, 44 * s, 9 * s, [["berry", 9, 4.5 * s]], { berryC: R(["#2a0408", "#5a0a14", "#8a1622", "#b82a30", "#e04a48"]) }, 5, 8)); for (let k = 0; k < 5; k++) { const px = cx - 30 * s + k * 15 * s; img.rect(px, top - 6 * s - (k % 2) * 3, 2, 2, "#2a1a10"); img.px(px + 2, top - 7 * s - (k % 2) * 3, "#2a1a10"); } }
    },
    tart(img, spec, stage, cx, cy, s) {
      platter(img, cx, cy + 10, 110 * s, 46 * s, "clay", { rim: true });
      const E = ell(cx, cy, 84 * s, 34 * s), burnt = stage === "burnt";
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
      [[-48, 4], [0, -8], [48, 4], [-20, 18], [26, 20]].forEach(([dx, dy], k) => objs.push(blob(cx + dx * s, cy + dy * s, 20 * s, 14 * s, 14 * s, (x, y, i) => {
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
    toffee(img, spec, stage, cx, cy, s) {
      B.skilletWide(img, cx, cy, 100 * s, 38 * s, 0);
      const burnt = stage === "burnt", r = rng(7);
      for (let i = 0; i < 16; i++) {
        const x = cx + (r() - 0.5) * 150 * s, y = cy + (r() - 0.5) * 50 * s, w = 14 + r() * 12, h = 8 + r() * 6, a = r() * Math.PI;
        const lay = new Img(W, H);
        lay.fill((xx, yy) => { const u = ((xx - x) * Math.cos(a) + (yy - y) * Math.sin(a)) / w, v = (-(xx - x) * Math.sin(a) + (yy - y) * Math.cos(a)) / h; if (Math.abs(u) + Math.abs(v) * 0.7 > 1) return null; return burnt ? ramp(BURNT, 0.4 - u * 0.3, xx, yy) : ramp(R(["#5a2a04", "#8a4808", "#c0700e", "#e8a020", "#ffd060", "#fff4c0"]), 0.45 - u * 0.4 + v * 0.2 + (h2(xx, yy, i) > 0.92 ? 0.4 : 0), xx, yy); }, x - w, y - h * 2, x + w, y + h * 2);
        outline(lay, "#2a1004");
        img.paste(lay, 0, 0);
        if (!burnt) glow(img, x, y, 12, "#ffe890", 0.2);
      }
    },
    cobbler(img, spec, stage, cx, cy, s) {
      B.skilletWide(img, cx, cy, 104 * s, 40 * s, 0);
      const burnt = stage === "burnt";
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
  // translucent: lit from inside as well as on the skin, with a bright rim where it's thin
  function jellyCf(rp, cx, cy, rx, ry, o) {
    o = o || {};
    return (x, y, i) => {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry), inner = 1 - d;
      if (i.spec > 0.5) return i.spec > 0.75 ? "#ffffff" : ramp(rp, 1, x, y);
      if (o.window && o.window(x, y)) return (x + y) % 2 ? "#fff0a0" : "#ffd050";
      if (h2(x, y, 9) > 0.985) return ramp(rp, 0.95, x, y);
      return ramp(rp, 0.15 + i.diff * 0.35 + inner * 0.35 + (d > 0.85 ? 0.25 : 0) + Math.sin(y * 0.6) * 0.05, x, y);
    };
  }
  function jellyDome(img, cx, cy, rx, ry, burnt, wob, look) {
    const rp = burnt ? R(["#0a0c06", "#141a0c", "#22301a", "#34482a", "#4a6238"]) : look.jelly || RP.jelly;
    shadow(img, cx, cy + 6, rx * 1.05, ry * 0.3, 0.4, "#0a2a14");
    const obj = { x0: cx - rx - 4, y0: cy - ry * 2 - 4, x1: cx + rx + 4, y1: cy + 6, k: 34, hf: (x, y) => {
      const u = (x - cx) / (rx * (1 + wob * Math.sin((y - cy) * 0.2))), v = (cy - y) / (ry * 1.6);
      if (v < 0 || v > 1) return null;
      const w = Math.sqrt(Math.max(0, 1 - v * v)) * (1 - v * 0.1) + (v < 0.12 ? 0.06 : 0);
      if (Math.abs(u) > w) return null;
      return Math.sqrt(Math.max(0, w * w - u * u)) * rx * 0.8 + (Math.abs(Math.sin(v * 9)) < 0.15 ? 2 : 0);
    }, cf: jellyCf(rp, cx, cy - ry * 0.8, rx, ry * 0.9) };
    scene(img, [obj]);
    if (!burnt) for (let k = 0; k < 30; k++) { const t = k / 30; img.px(cx - 20 + t * 40 + Math.sin(t * 9) * 4, cy - ry * 1.55 + Math.sin(t * Math.PI) * 6, ramp(RP.honey, 0.7, 0, 0)); }
  }
  function cathedral(img, cx, base, burnt, wob) {
    const rp = burnt ? R(["#0a0c06", "#141a0c", "#22301a", "#34482a", "#4a6238"]) : RP.jelly;
    const tiers = 6;
    for (let k = 0; k < tiers; k++) {
      const w = 54 - k * 7.5, h = 13, yb = base - k * 12, sway = wob * Math.sin(k * 0.9) * k;
      scene(img, [{ x0: cx - w - 4 + sway, y0: yb - h - 2, x1: cx + w + 4 + sway, y1: yb + 2, k: 30, base: k * 20, hf: (x, y) => { const u = (x - cx - sway) / w, v = (yb - y) / h; if (v < 0 || v > 1 || Math.abs(u) > 1 - v * 0.08) return null; return Math.sqrt(Math.max(0, 1 - u * u)) * w * 0.6 + (v > 0.85 ? -2 : 0); },
        cf: jellyCf(rp, cx + sway, yb - h / 2, w, h, { window: burnt ? null : (x, y) => { const u = (x - cx - sway) / w, v = (yb - y) / h; return Math.abs(v - 0.5) < 0.22 && Math.abs((u * 4) - Math.round(u * 4)) < 0.12 && Math.abs(u) < 0.8; } }) }]);
      if (!burnt) glow(img, cx + sway, yb - h / 2, w * 0.8, "#ffe080", 0.12, h);
    }
    if (!burnt) { const tip = base - tiers * 12 - 2; for (let j = 0; j < 12; j++) img.px(cx, tip - j, j < 10 ? ramp(RP.jelly, 0.7, 0, 0) : "#fff0a0"); star(img, cx, tip - 13, "#fff6c8", 2); }
  }
  function iceServe(spec, o) {
    const look = spec.look, burnt = o.burnt, img = tableBack(o.seed || 13, { wood: R(["#080a0e", "#0e1218", "#141a22", "#1c242e", "#26303c"]) });
    const kind = spec.pal === "fireice" ? "tower" : spec.pal === "frost" ? "sorbet" : "drift";
    if (kind === "tower") {
      platter(img, 120, 112, 100, 34, "pewter", { rim: true });
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
      [[-26, 0], [24, -2], [0, -14]].forEach(([dx, dy], k) => objs.push(blob(f.cx + dx, f.cy + dy - 6, 24, 18, 18, (x, y, i) => (burnt ? ramp(BURNT, i.diff, x, y) : fbm(x / 1.5, y / 1.5, k) > 0.58 ? ramp(RP.ice, 0.85, x, y) : ramp(R(["#2a1018", "#5a1e2c", "#8a3444", "#b8586a", "#dc8494", "#f4b8c4"]), 0.2 + i.diff * 0.8, x, y)), { rough: 2, scale: 1.4, seed: k, k: 20, base: k * 4 })));
      scene(img, objs);
      if (!burnt) scene(img, scatter(f.cx, f.cy - 18, 40, 10, [["berry", 7, 3.5]], { berryC: R(["#1a0a20", "#2e1438", "#3e2a5a", "#5a4a86", "#8a7ab0"]) }, 3, 30));
      return img;
    }
    platter(img, 120, 100, 106, 40, "glaze", { rim: true });
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
      for (let k = 0; k < 6; k++) { const x = 46 + k * 30, y = 86; sardine(img, x, y, burnt ? "burnt" : "cook", k); img.rect(x - 1, y - 24, 3, 3, "#3a3a40"); img.px(x, y - 24, "#8a8a92"); }
      return img;
    }
    if (spec.pal === "salmon") {
      slate(img, 120, 86, 200, 64);
      for (let k = 0; k < 7; k++) { const x = 46 + k * 24, y = 86 + Math.sin(k) * 4; scene(img, [blob(x, y, 20, 13, 3, (xx, yy, i) => { if (burnt) return ramp(BURNT, i.diff, xx, yy); const band = Math.sin((xx - yy * 0.6) * 0.7) > 0.7; return band ? "#fbd8c0" : i.spec > 0.5 ? "#fff0e8" : ramp(RP.salmon, 0.25 + i.diff * 0.7, xx, yy); }, { wob: [[2, 0.2, k], [3, 0.1, k]], pow: 0.3, k: 30, base: k * 1.5 })]); }
      if (!burnt) { for (let i = 0; i < 60; i++) { const r = rng(i); const x = 40 + r() * 170, y = 70 + r() * 34; img.px(x, y, "#5a8a3a"); img.px(x + 1, y - 1, "#7ab04a"); } lemon(img, 206, 112, 1.3); }
      return img;
    }
    B.board(img, 120, 98, 114, 44, 8);
    serpentFillet(img, 120, 82, burnt ? "burnt" : "cook", 1);
    if (!burnt) { lemon(img, 40, 116, 1.4); herb(img, 196, 116, 1.4, 4); }
    return img;
  }
  function sardine(img, x, y, stage, k) {
    const lay = new Img(W, H), burnt = stage === "burnt";
    hrender(lay, [x - 10, y - 30, x + 10, y + 32], (xx, yy) => {
      const v = (yy - y) / 28, half = v < -0.85 ? (v + 1) * 30 : v > 0.82 ? (1.05 - v) * 14 + (v > 0.95 ? 4 : 0) : (1 - v * v * 0.6) * 7;
      if (v < -1 || v > 1.08 || Math.abs(xx - x) > half) return null;
      return Math.sqrt(Math.max(0, half * half - (xx - x) ** 2)) * 0.8;
    }, (xx, yy, i) => {
      if (burnt) return ramp(BURNT, i.diff, xx, yy);
      const v = (yy - y) / 28;
      if (Math.abs(v + 0.72) < 0.03 && xx < x) return "#0a0a10";
      if (i.spec > 0.5) return "#ffffff";
      if (Math.abs(((yy * 1.0) % 5)) < 0.8 && v > -0.6 && v < 0.75) return "#3a2410";
      return ramp(R(["#1a2430", "#34465a", "#5a7088", "#8aa0b4", "#c4d2dc", "#f4f8fa"]), 0.2 + i.diff * 0.7 + (xx < x ? -0.2 : 0.15) + (h2(xx, yy, k) > 0.9 ? 0.25 : 0), xx, yy);
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
    const pts = [[x0, y0]], fr = [0.44, 0.34, 0.22], bend = o.bend === undefined ? 0.35 : o.bend, bends = [0, bend, bend * 1.4], rad = [4.6 * s, 3.8 * s, 2.6 * s];
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
      const len = (50 + r() * 22) * s, x = cx + Math.cos(a) * rx * d - Math.cos(dir) * len * 0.45, y = cy + Math.sin(a) * ry * d - Math.sin(dir) * len * 0.25;
      objs.push(crabLeg(x, y, dir, len, s, cl.shell, stage, i, { bend: (r() < 0.5 ? -1 : 1) * (0.15 + r() * 0.2), cracked: i % 4 === 1, base: r() * 4 }));
    }
    const claws = [[-0.62, 0.1, Math.PI + 0.35], [0.62, -0.15, -0.25], [0.02, 0.62, 1.35]];
    claws.forEach(([dx, dy, ang], i) => objs.push(crabClaw(cx + dx * rx, cy + dy * ry, 1.05 * s, ang + (r() - 0.5) * 0.2, cl.shell, stage, i + seed, { base: 12 + i * 2, cracked: i === 2 })));
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
      if (cl.oysters) for (let k = 0; k < 5; k++) oyster(img, f.cx - 70 + k * 34, f.cy + 14 + (k % 2) * 6, burnt);
      return img;
    }
    if (look.rock) rockSlab(img, 120, 98, 118, 46); else B.board(img, 120, 98, 118, 46, 4);
    kelpBed(img, 120, 90, 96, 34, burnt);
    scene(img, clawHeap(118, 84, 70, 26, cl, stage, look.heapSeed || 3, 1));
    if (!burnt) for (const p of cl.props || []) { if (p === "mallet") mallet(img, 22, 116); if (p === "butter") butterPot(img, 210, 118); if (p === "lemon") { lemon(img, 200, 56, 1.4); lemon(img, 214, 64, 1.2); } if (p === "sorry") sorryNote(img, 30, 52); }
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
  function matriarch(img, stage) {
    const burnt = stage === "burnt";
    B.board(img, 120, 100, 118, 44, 2);
    const cl = CLAWS.spider;
    scene(img, [crabLeg(4, 112, -0.32, 290, 3.2, cl.shell, stage, 1, { bend: 0.28, cracked: !burnt, base: 2 })]);
    if (burnt) return img;
    const objs = [];
    for (let k = 0; k < 6; k++) { const x0 = 70 + k * 16, y0 = 94 - k * 4; objs.push(crabLeg(x0, y0, 0.9 + (k % 3) * 0.2, 46, 0.7, R(["#a89a88", "#cfc2ae", "#e8dccb", "#f6efe4", "#fffaf2"]), "cook", k, { bend: 0.15, base: 20 + k })); }
    scene(img, objs);
    butterPot(img, 204, 120);
    glow(img, 120, 70, 70, "#ffe8b0", 0.12, 30);
    return img;
  }

  // ---------- salads ----------
  const SALADS = {
    marsh: { leaves: [["samphire", 40], ["leafy", 10]], dress: "#c8c070" },
    forest: { leaves: [["leafy", 34], ["flower", 14], ["pea", 8]] },
    egg: { leaves: [["leafy", 26]], eggs: 3, skillet: true },
    sea: { leaves: [["samphire", 22], ["grapes", 9]], lemon: true },
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
    const GREENS = [R(["#0e1c08", "#1c3410", "#2e5018", "#467024", "#629436", "#8cbc52"]), R(["#1a2a0a", "#2e4614", "#4a6a20", "#6a8e2e", "#90b444", "#b8d870"]), R(["#2a0a10", "#4a1420", "#6a2030", "#8a3444", "#aa4e5a"])];
    for (const [kind, n] of sd.leaves) for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.88, x = f.cx + Math.cos(a) * f.rx * d, y = f.cy + Math.sin(a) * f.ry * d, base = r() * 6;
      if (kind === "samphire") { const ang = r() * TAU, rp = burnt ? BURNT : GREENS[1]; for (let k = 0; k < 3; k++) objs.push(blob(x + Math.cos(ang) * k * 5, y + Math.sin(ang) * k * 2.4, 3.6, 2.2, 3, (xx, yy, ii) => (ii.spec > 0.5 ? "#e8ffc8" : ramp(rp, 0.2 + ii.diff * 0.75, xx, yy)), { k: 30, base: base + k * 0.3 })); }
      else if (kind === "flower") { const c = [["#f4d03a", "#fff4a0"], ["#e8e4dc", "#ffffff"], ["#e05a3a", "#ffa070"]][i % 3]; objs.push(blob(x, y, 3.5, 2.6, 2, (xx, yy, ii) => (Math.hypot(xx - x, yy - y) < 1 ? "#c87a10" : ii.diff > 0.5 ? c[1] : c[0]), { k: 20, base: base + 4 })); }
      else if (kind === "grapes") { for (let k = 0; k < 7; k++) objs.push(blob(x + (k % 3) * 4 - 4, y + Math.floor(k / 3) * 3.4, 2.6, 2.4, 2.6, (xx, yy, ii) => (ii.spec > 0.4 ? "#f4ffe0" : ramp(R(["#1a3a10", "#2e6020", "#4a8a34", "#72b04e", "#a8d880"]), 0.2 + ii.diff * 0.8, xx, yy)), { k: 40, base: base + 3 + k * 0.1 })); }
      else if (kind === "pea") objs.push(Object.assign(BIT.pea(x, y, 2.6, {}, i), { base: base + 3 }));
      else objs.push(blob(x, y, 10 + r() * 6, 5 + r() * 3, 3, ((rp) => (xx, yy, ii) => (Math.abs((yy - y) - (xx - x) * 0.3) < 0.5 && !burnt ? "#c8e090" : ii.spec > 0.6 && !burnt ? "#f0ffe0" : ramp(burnt ? BURNT : rp, 0.2 + ii.diff * 0.7 - ii.ao * 0.4, xx, yy)))(GREENS[i % 3 === 2 && sd.leaves.length > 2 ? 2 : i % 2]), { wob: [[2, 0.3, i], [5, 0.12, i]], seed: i, k: 26, base }));
    }
    scene(img, objs);
    if (sd.eggs && !raw) for (let k = 0; k < sd.eggs; k++) { const x = f.cx - 44 + k * 44, y = f.cy - 4 + (k % 2) * 8; scene(img, [blob(x, y, 15, 10, 2, shade(burnt ? BURNT : RP.white, { base: 0.3 }), { wob: [[3, 0.2, k], [5, 0.1, k]], k: 20, base: 12 }), blob(x - 2, y - 2, 6, 5, 5, shade(burnt ? BURNT : RP.yolk, { base: 0.3, glint: 0.4 }), { k: 40, base: 16 })]); }
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
  function rotJoint(img, spec, cx, cy, rx, rr, rot, stage, seed, done) {
    const rl = Object.assign({}, ROASTS[spec.pal] || ROASTS.pork, spec.look.roast || {});
    const crust = stage === "burnt" ? BURNT : rl.crust || ROASTS.pork.crust, raw = rl.raw || R(["#5a2a24", "#8a4a40", "#b0685a", "#cc8a78", "#e8aa98", "#f8ccbc"]);
    const half = rx - rr, lay = new Img(W, H);
    for (let y = Math.floor(cy - rr); y <= cy + rr; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = Math.max(0, Math.abs(x + 0.5 - cx) - half), v = (y + 0.5 - cy) / rr, bulge = 1 - Math.pow((x - cx) / rx, 4) * 0.25;
      const q = Math.hypot(dx / rr, v / bulge);
      if (q > 1) continue;
      const nz = Math.sqrt(Math.max(0, 1 - q * q)), nx = (x > cx ? 1 : -1) * dx / rr, ny = v / bulge;
      const theta = Math.asin(clamp(ny, -1, 1)) + rot, su = (x * 0.35), sv = theta * rr * 0.6;
      const diff = Math.max(0, nx * KEY[0] + ny * KEY[1] + nz * KEY[2]), spec2 = Math.pow(Math.max(0, nx * 0.0 + ny * -0.5 + nz * 0.86), 70) * (vn(su * 0.5, sv * 0.5, seed + 9) > 0.45 ? 1 : 0.3);
      const tex = vn(su * 0.6, sv * 0.6, seed), local = done === undefined ? 1 : clamp((done - 0.5 + (tex - 0.5) * 0.6) * 4 + 0.5, 0, 1);
      let t = 0.1 + diff * 0.8 + (tex - 0.5) * 0.35;
      if (rl.score && stage !== "burnt") { const a = ((su + sv) % 8 + 8) % 8, b = ((su - sv) % 8 + 8) % 8; if (a < 0.9 || b < 0.9) t -= 0.3; }
      if (rl.string && Math.abs(((x - cx) % 18 + 18) % 18 - 9) < 0.8) { lay.px(x, y, diff > 0.5 ? "#f0e4c8" : "#a89878"); continue; }
      let c = ramp(local > 0.5 ? crust : raw, t, x, y);
      if (spec2 > 0.5 && stage !== "burnt") c = spec2 > 0.8 ? "#fff4dc" : ramp(crust, 1, x, y);
      if (rl.gold && local > 0.5 && h2(x, Math.floor(sv), seed) > 0.95) c = "#ffe890";
      if (rl.frost && local > 0.5 && vn(su, sv, seed + 4) > 0.7) c = diff > 0.4 ? "#f4fbff" : "#b8d0e0";
      lay.px(x, y, c);
    }
    outline(lay, "#0a0402");
    img.paste(lay, 0, 0);
  }
  const vn = (x, y, s) => K.vnoise(x, y, s);

  Object.assign(FA.PLATES, {
    pie: { piece: (spec) => ({ draw(img, o) { const pi = Object.assign({}, PIES[spec.pal] || PIES.pie, spec.look.pie || {}); pieTop(img, pi, o.stage, o.cx, o.cy, o.s * 0.7, spec.look); } }), serve: pieServe },
    sweet: { piece: (spec) => ({ draw(img, o) { const kind = spec.look.sweet || { trifle: "trifle", berry: "tart", honey: "cake", toffee: "toffee" }[spec.pal] || "tart"; SWEETS[kind](img, spec, o.stage, o.cx, o.cy, o.s * 0.7); } }), serve: sweetServe },
    jelly: { piece: (spec) => ({ draw(img, o) { if (spec.pal === "cathedral") cathedral(img, o.cx, o.cy + 30 * o.s, o.stage === "burnt", o.wob || 0); else jellyDome(img, o.cx, o.cy + 20 * o.s, 40 * o.s, 28 * o.s, o.stage === "burnt", o.wob || 0, spec.look); } }), serve: jellyServe },
    ice: { piece: (spec) => ({ draw(img, o) { const im = iceServe(spec, { burnt: o.stage === "burnt" }); img.paste(im, 0, 0); } }), serve: iceServe },
    fillet: { piece: (spec) => ({ draw(img, o) { if (spec.pal === "sardine") { for (let k = 0; k < 4; k++) sardine(img, o.cx - 45 + k * 30, o.cy, o.stage, k); } else serpentFillet(img, o.cx, o.cy, o.stage, 1); } }), serve: filletServe },
    claws: { piece: (spec) => ({ draw(img, o) { const cl = Object.assign({}, CLAWS[spec.pal] || CLAWS.crab, spec.look.claws || {}); if (cl.legend) { scene(img, [crabLeg(o.cx - 110 * o.s, o.cy + 14 * o.s, -0.2, 220 * o.s, 2.4 * o.s, cl.shell, o.stage, 1, { bend: 0.2 })]); return; } scene(img, clawHeap(o.cx, o.cy, 54 * o.s, 20 * o.s, cl, o.stage, 3, o.s * 0.75)); } }), serve: clawsServe },
    salad: { piece: (spec) => ({ draw(img, o) { const sd = Object.assign({}, SALADS[spec.pal] || SALADS.forest, spec.look.salad || {}); saladBits(img, { cx: o.cx, cy: o.cy, rx: 70 * o.s, ry: 26 * o.s }, sd, o.stage, 3); } }), serve: saladServe },
  });

  Object.assign(FA.PLATES, {
    roast: { piece: (spec) => ({ draw(img, o) { const rl = Object.assign({}, ROASTS[spec.pal] || ROASTS.pork, spec.look.roast || {}); if (rl.roots) return scene(img, [jointObj(o.cx, o.cy, 40 * o.s, 18 * o.s, ROASTS.pork, o.stage, o.seed)]); scene(img, [jointObj(o.cx, o.cy, 44 * o.s, 21 * o.s, rl, o.stage, o.seed)]); } }), serve: roastServe },
    skewer: { piece: (spec) => ({ draw(img, o) { const sk = Object.assign({}, SKEWERS[spec.pal] || SKEWERS.rat, spec.look.skewer || {}); const x0 = o.cx - 70 * o.s, x1 = o.cx + 70 * o.s; stick(img, x0 - 12, o.cy, x1 + 12, o.cy, { w: Math.max(2, Math.round(2 * o.s)) }); if (sk.fish) trout(img, o.cx, o.cy, 58 * o.s, 0, o.stage, 1); else if (sk.twist) twistDough(img, x0, o.cy, x1, o.cy, o.stage); else if (sk.drums) drumstick(img, o.cx, o.cy, o.stage, 2, o.s); else scene(img, skewerChunks(x0, o.cy, x1, o.cy, Object.assign({}, sk, { size: sk.size * o.s }), o.stage, 2)); } }), serve: skewerServe },
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

  Object.assign(FA, { RP, BIT, scene, blob, shade, scatter, liquid, grains, bowl, platter, tableBack, bucket, cauldron, spoon, herb, WARE, cauldronRim, basketSide, basketTop, lidDraw, stickDraw, leafDraw, leafBed, clayHalves, rotJoint, mixedGrill });
})(typeof window !== "undefined" ? window : globalThis);
