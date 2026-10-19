/* Eating in the meal replays: every dish eaten the way it would be (carved, forked, spooned, scooped, cut in wedges, cracked, or picked up
   whole), planned from where the served dish says its pieces sit, with cutlery floating over the dish; the food loses its parts in place. */
/*
  FoodArt.eat.plan(spec, o) -> the mouthfuls for one meal: o.n takes, o.seed, o.legendary.
    plan.steps: thunks that draw the part-eaten dish ahead of the beat; plan.dur; plan.sfx: [[t, name, v]], one bite sound per take.
  FoodArt.eat.draw(img, plan, t) paints the dish as eaten so far and the cutlery at work, and returns { shake, word: [text, x, y, age],
    tools: [{ k, tool, x, y, ux, uy, L }] } (each utensil's tip, the way its handle runs and its length).
  FoodArt.eat.state(plan, k) is the dish after k takes (a town scene shrinks it onto the table).
  How a dish is eaten comes from its plate and what its serve reported (food_art.js item/geo), so a new dish gets sensible eating on its own.
*/
(function (root) {
  "use strict";
  const FA = root.FoodArt;
  if (!FA || !FA.kit) return;
  const K = FA.kit;
  const { W, H, Img, C, mix, R, pick, rng, fbm, h2, bay, clamp, lerp, TAU, outline } = K;
  const ease = (t) => 1 - (1 - t) * (1 - t), ease3 = (t) => 1 - Math.pow(1 - t, 3), inout = (t) => t * t * (3 - 2 * t);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const WEDGE = 0.42, CARVE_PX = 11;

  // ---------- what's inside things, for cut faces and bites ----------
  const IN = {
    crumb: R(["#a8906a", "#c8b088", "#e2cca4", "#f2e2c2", "#fcf4e0"]), white: R(["#a89a88", "#cfc2ae", "#e8dccb", "#f6efe4", "#fffaf2"]),
    meat: R(["#5a2a1c", "#7e3e28", "#a05638", "#c0724c", "#d89068"]), pink: R(["#7a2a2e", "#a04448", "#c06462", "#d8847e", "#eca69c"]),
    potato: R(["#8a6a2a", "#b48c40", "#d8b060", "#ecce88", "#f8e6b4"]), sponge: R(["#a06a1e", "#c88c30", "#e4ae4c", "#f4cc72", "#fce4a4"]),
    cheese: R(["#a87010", "#d09a1e", "#ecc030", "#f8dc60", "#fff2a0"]), yolk: R(["#a85a04", "#d8840a", "#f0aa1a", "#fcd040", "#fff09a"]),
    toffee: R(["#8a4a08", "#b8700e", "#e09a20", "#f8c448", "#fff0a8"]), root: R(["#a85010", "#d07420", "#ec9a3a", "#f8c070", "#ffe0a8"]),
    grey: R(["#6a6458", "#8a8476", "#a8a292", "#c4beae", "#ddd8c8"]),
  };
  const KIND_IN = { buns: "crumb", steamed: "white", breadslice: "grey", toast: "cheese", pasty: "potato", cake: "sponge", shard: "toffee", sardine: "white",
    fillets: "white", cod: "white", legs: "white", frogs: "white", wings: "meat", balls: "crumb", claw: "white", leg: "white", rope: "white", oyster: "white",
    skewer: "meat", sausage: "pink", root: "root", egg: "yolk", chunk: "meat", drum: "meat", coil: "crumb", tip: "white", fish: "white", minnows: "white" };
  const WORD = { carve: "CHOMP", forkslice: "CHOMP", spoon: "SLURP", scoop: "NOM", wedge: "MMMF", cut: "CHOMP", flake: "NOM", tear: "MMMF", tearoff: "CHOMP",
    pick: "CHOMP", dunk: "CHOMP", crack: "CRACK", stab: "CRUNCH", skewer: "CHOMP", portion: "CHOMP" };
  const KIND_WORD = { cake: "MMMF", shard: "CRACK", legs: "CRUNCH", wings: "CRUNCH", frogs: "CRUNCH", balls: "CRUNCH", fillets: "CRUNCH", root: "CRUNCH", egg: "MMMF", minnows: "CRUNCH" };

  // ---------- how each dish is eaten ----------
  // a style is its tools ("fingers": no utensil, the piece just goes) and the action at the plate (saw, dip, dig, wedge, grab, tear, stab, crack)
  const STYLE = {
    carve: { tools: ["fork", "knife"], act: "carve", ACT: 1.7 },
    forkslice: { tools: ["fork"], act: "pin", ACT: 0.4 },
    spoon: { tools: ["spoon"], act: "dip", ACT: 0.65 },
    scoop: { tools: ["spoon"], act: "dig", ACT: 0.6 },
    wedge: { tools: ["server", "knife"], act: "wedge", ACT: 1.3 },
    cut: { tools: ["fork", "knife"], act: "saw", ACT: 1.1 },
    flake: { tools: ["fork"], act: "dig", ACT: 0.55 },
    tear: { tools: ["fingers"], act: "grab", ACT: 0.4 },
    tearoff: { tools: ["fingers"], act: "tear", ACT: 0.6 },
    pick: { tools: ["fingers"], act: "grab", ACT: 0.4 },
    dunk: { tools: ["fingers"], act: "grab", ACT: 0.4 },
    crack: { tools: ["mallet"], act: "crack", ACT: 1.1 },
    stab: { tools: ["fork"], act: "stab", ACT: 0.45 },
    skewer: { tools: ["fingers"], act: "grab", ACT: 0.4 },
    portion: { tools: ["fork", "knife"], act: "saw", ACT: 1.1 },
  };
  const byZ = (a, b) => (b.z || 0) - (a.z || 0) || b.y - a.y;
  // the takes for a plate, in order: from the items and shapes the serve reported
  function choose(spec, info, n, crew) {
    const it = (info.items || []).slice().sort(byZ), G = info.geo || {}, out = [];
    const items = (style, list, o) => list.forEach((q) => out.push(Object.assign({ style, x: q.x, y: q.y, key: q.key, kind: q.kind, r: q.r, item: q }, o || {})));
    const ofKind = (...ks) => it.filter((q) => ks.includes(q.kind));
    const mound = (m, style, k, o) => {
      // a jelly is scooped off-centre and staggered, never in mirrored pairs; one scoop takes a bite out of its outline
      const pts = m.wobble ? [[-0.42, 0.08], [0.34, -1.0, 1], [0.6, 0.66]] : [[-0.42, 0.32], [0.4, 0.28], [-0.02, 0.0], [0.5, -0.3], [-0.55, -0.25]];
      // a knife or a tear takes from the edge, a spoon or fork digs into the top
      const rim = [[2.25, 0.86], [0.85, 0.86], [2.8, 0.86], [0.35, 0.86], [1.6, 0.9]];
      for (let i = 0; i < k; i++) { const [u, v, edge] = style === "cut" || style === "tearoff" ? [Math.cos(rim[i % 5][0]) * rim[i % 5][1], Math.sin(rim[i % 5][0]) * rim[i % 5][1]] : pts[i % pts.length]; out.push(Object.assign({ style, x: m.cx + u * m.rx, y: m.cy + v * m.ry, m, edge: !!(edge && m.rimCut) }, o || {})); }
    };
    const plate = spec.plate;
    if (plate === "roast" && G.joint && crew) { out.push({ style: "carve", x: G.joint.x + 2, y: G.joint.y + G.joint.h + 10, j: G.joint, kind: "slice", carver: true }); const fan = ofKind("slice").sort((a, b) => b.x - a.x); items("forkslice", [fan[0], fan[fan.length - 1], ...fan.slice(1, -1)].filter(Boolean)); }
    else if (plate === "roast" && G.joint) { out.push({ style: "carve", x: G.joint.x - 16, y: G.joint.y + G.joint.h * 0.62, j: G.joint, kind: "slice" }); items("forkslice", ofKind("slice", "stand")); }
    else if (plate === "roast") items("forkslice", ofKind("root"));
    else if (plate === "slab") { if (G.mound && G.mound.cut) out.push({ style: "cut", x: G.mound.cx - G.mound.rx * 0.7, y: G.mound.cy + G.mound.ry * 0.1, m: G.mound, straight: true }); items("forkslice", ofKind("slice", "sausage")); }
    else if ((plate === "stew" || plate === "soup") && G.mound) mound(G.mound, "scoop", n, { fork: true });
    else if ((plate === "stew" || plate === "soup") && G.f) {
      // the spoon goes for something in the broth: the chunk nearest each spot it aims at
      mound(Object.assign({}, G.f, { rx: G.f.rx * 0.8, ry: G.f.ry * 0.8 }), "spoon", n);
      const bits = it.filter((q) => q.kind === "bit" && q.bit !== "bean" && q.bit !== "leafy"), used = new Set();
      for (const tk of out) { let best = null, bd = 1e9; for (const q of bits) { const d = Math.hypot(q.x - tk.x, (q.y - tk.y) * 1.5); if (!used.has(q) && d < bd && (d < 26 || spec.look.clear)) { bd = d; best = q; } } if (best) { used.add(best); tk.x = best.x; tk.y = best.y; } }
    }
    else if (plate === "bun") {
      if (ofKind("breadslice").length) items(G.dip ? "dunk" : "pick", ofKind("breadslice"), { dip: G.dip });
      else if (ofKind("toast").length) items("pick", ofKind("toast"), { strings: true });
      else if (G.flat1) for (let i = 0; i < n; i++) { const f = i % 2 ? G.flat0 : G.flat1, a = [1.25, 2.3, 0.45, 3.0][i % 4]; out.push({ style: "tearoff", x: f.cx + Math.cos(a) * f.rx * 0.82, y: f.cy + Math.sin(a) * f.ry * 0.82, m: f, kind: "buns" }); }
      items("tear", ofKind("buns", "steamed"));
      if (G.mound && !out.length) mound(G.mound, "cut", n);
    } else if (plate === "wholefish" || plate === "clayfish" || plate === "plankfish") items("forkslice", ofKind("flake"));
    // a fish too big for one fork: each portion held with a fork and cut free with a knife, the crew round it
    else if (plate === "bigfish") items("portion", ofKind("flake"));
    else if (plate === "pie" || plate === "eelpie" || (plate === "sweet" && G.pie)) {
      if (G.pie) for (let i = 0; i < n; i++) { const a = [1.95, 1.2, 2.7, 0.55][i % 4]; out.push({ style: "wedge", x: G.pie.cx + Math.cos(a) * G.pie.rx * 0.5, y: G.pie.cy + Math.sin(a) * G.pie.ry * 0.5, m: G.pie, a }); }
      items("pick", ofKind("pasty"));
      if (G.mound && !out.length) mound(G.mound, G.mound.scoop ? "scoop" : "cut", n, G.mound.scoop ? { fork: true } : {});
    } else if (plate === "claws") { (G.meat || []).forEach((q) => out.push({ style: "scoop", fork: true, x: q.cx, y: q.cy, kind: "leg", m: q })); items("crack", ofKind("claw", "leg")); items(G.dip ? "dunk" : "pick", ofKind("rope"), { dip: G.dip, fork: true }); items("pick", ofKind("oyster")); }
    else if (plate === "crisps") { items(G.dip ? "dunk" : it.some((q) => q.kind === "minnows") ? "forkslice" : "pick", it.filter((q) => q.kind !== "cod"), { dip: G.dip }); if (G.mound) mound(G.mound, "tearoff", n, { kind: "cod" }); }
    else if (plate === "skewer") { ofKind("fish").forEach((q) => out.push({ style: "flake", x: q.x, y: q.y - 1, kind: "fish", m: q.m })); items("pick", ofKind("chunk", "drum", "coil", "tip")); }
    else if (plate === "sausage" && G.coil) for (let i = 0; i < n; i++) { const a = TAU * (3.2 - i * 0.1), r0 = G.coil.R * (0.15 + (1 - i * 0.031) * 0.85); out.push({ style: "cut", x: G.coil.cx + Math.cos(a) * r0 - 3, y: G.coil.cy + Math.sin(a) * r0 * 0.45, disc: 9, kind: "sausage" }); }
    else if (plate === "salad" && G.leaves) { items("forkslice", ofKind("egg")); mound(Object.assign({}, G.leaves, { rx: G.leaves.rx * 0.75, ry: G.leaves.ry * 0.75 }), "stab", n); }
    else if (plate === "fillet") {
      // a fork flakes a piece off a fish on the plank; it doesn't carry off the whole fish
      ofKind("sardine").forEach((q) => out.push({ style: "flake", x: q.x + (q.m ? q.m.rx * 0.15 : 0), y: q.y - 1, kind: "sardine", m: q.m || { cx: q.x, cy: q.y, rx: 7.5, ry: 27, h: 6 } }));
      ofKind("steak").forEach((q) => out.push({ style: "flake", x: q.x - 3, y: q.y + 2, kind: "steak", m: q.m }));
      items("forkslice", ofKind("slice")); if (G.mound) mound(G.mound, "flake", n);
    }
    else if (plate === "ice" && ofKind("scoop").length) ofKind("scoop").forEach((q) => out.push({ style: "scoop", x: q.mound.cx - 2, y: q.mound.cy - 1, m: q.mound }));
    else if (plate === "sweet" && G.mound && G.mound.cut) mound(G.mound, "cut", n);
    items("pick", ofKind("cake", "shard"));
    if (!out.length) {
      if (G.mound) mound(G.mound, "scoop", n);
      else if (G.f) mound(G.f, "spoon", n);
      else if (it.length) items("pick", it);
      else mound({ cx: 120, cy: 84, rx: 40, ry: 16, h: 8 }, "scoop", n);
    }
    return out.slice(0, n);
  }

  // ---------- the part-eaten dish ----------
  // gone and zones are redrawn by the serve; dents (a spoon's hollow) and cuts (a slice or wedge lifted out, its faces showing) are painted on
  function eatOf(plan, k) {
    const e = { gone: [], zones: [], carved: 0, bites: [] };
    for (const tk of plan.takes.slice(0, k)) {
      if (tk.style === "carve") e.carved++;
      else if (tk.edge) e.bites.push(tk.notch);
      else if (tk.key && !tk.again) e.gone.push(tk.key);
      else if (tk.style === "spoon" || tk.style === "stab") e.zones.push([tk.x, tk.y, tk.style === "stab" ? 14 : 12]);
    }
    return e;
  }
  function state(plan, k) {
    if (plan.states[k]) return plan.states[k];
    const img = FA.plate(plan.spec, "done", { seed: plan.seed, legendary: plan.legendary, eat: eatOf(plan, k) });
    const done = [];
    for (const tk of plan.takes.slice(0, k)) { if (tk.mask) paintHole(img, tk, plan, done); if (tk.mask) done.push(tk.mask); }
    // what finger food leaves behind: a pasty's crust heel, a drumstick's bone
    for (const tk of plan.takes.slice(0, k)) { const g = finger(plan, tk); if (g) for (const [x, y, c] of g.heel) img.px(x, y, c); }
    return (plan.states[k] = img);
  }
  // finger food goes in two bites: a ragged piece off one end, the board showing where it was, then the rest. Worked out from the pixels
  // that change when the piece goes (its long axis and ends), so any piece of any dish gets it
  const HEEL = { pasty: 0.22, drum: 0.3, wings: 0.2 };
  function finger(plan, tk) {
    if (tk.tool || !tk.key || tk.again) return null;
    if (tk.fing !== undefined) return tk.fing;
    const before = state(plan, tk.k), after = FA.plate(plan.spec, "done", { seed: plan.seed, legendary: plan.legendary, eat: eatOf(plan, tk.k + 1) });
    const it = tk.item || {}, r = Math.max(8, tk.r || 10), box = it.box || [tk.x - r * 1.6, tk.y - r * 1.2, tk.x + r * 1.6, tk.y + r * 1.2];
    const pts = [];
    for (let y = Math.max(0, Math.floor(box[1])); y <= Math.min(H - 1, box[3]); y++) for (let x = Math.max(0, Math.floor(box[0])); x <= Math.min(W - 1, box[2]); x++) {
      const a = before.get(x, y), b = after.get(x, y);
      if (a && b && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 30) pts.push([x, y]);
    }
    if (pts.length < 12) return (tk.fing = null);
    let mx = 0, my = 0; for (const [x, y] of pts) { mx += x; my += y; } mx /= pts.length; my /= pts.length;
    let sxx = 0, sxy = 0, syy = 0; for (const [x, y] of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    let dx = Math.cos(ang), dy = Math.sin(ang);
    if (dx < 0) { dx = -dx; dy = -dy; }
    const proj = pts.map(([x, y]) => (x - mx) * dx + (y - my) * dy), t0 = Math.min(...proj), t1 = Math.max(...proj), len = t1 - t0;
    // the bite: from the left-hand end, its edge a row of small scallops, the board showing through; the heel at the other end
    const edgeAt = (x, y) => { const sp = -(x - mx) * dy + (y - my) * dx; return t0 + len * 0.36 + Math.abs(Math.sin(sp * 0.55 + tk.seed)) * 2.6 + (h2(Math.floor(sp), 3, tk.seed) - 0.5) * 1.6; };
    const bite = [], heel = [], hk = HEEL[tk.kind] || 0;
    pts.forEach(([x, y], i) => { if (proj[i] < edgeAt(x, y)) bite.push([x, y, after.get(x, y)]); else if (hk && proj[i] > t1 - len * hk) heel.push([x, y, before.get(x, y)]); });
    return (tk.fing = { bite, heel, x: mx + dx * (t0 + len * 0.18), y: my + dy * (t0 + len * 0.18) });
  }
  // where a point sits in a scoop's hollow: null outside, else v from 0 at its far (upper) edge to 1 at its near lip, and u across it.
  // Seen from above at an angle the far wall is a deep curve and the near lip a shallow one, so the opening is never round
  function scoopAt(x, y, cx, cy, rx, ry, seed) {
    const wob = 1 + (fbm(y / 3 + 4, 0.5, seed) - 0.5) * 0.2, u = (x - cx + (cy - y) * 0.15) / (rx * wob);
    if (Math.abs(u) >= 1) return null;
    const top = cy - ry * 0.85 * Math.pow(1 - u * u, 0.55) + (h2(Math.floor(x / 2), 1, seed) - 0.5) * 0.8, bot = cy + ry * (0.1 + 0.28 * Math.sqrt(1 - u * u));
    return y < top || y > bot ? null : { v: (y - top) / Math.max(1, bot - top), u };
  }
  function holeMask(tk) {
    if (tk.mask) return tk.mask;
    const m = tk.m || {}, sd = (tk.seed || 0) + 5;
    if (tk.style === "scoop" || tk.style === "flake" || tk.thick || (tk.style === "cut" && tk.fork)) {
      const big = tk.style === "scoop" && !tk.fork, jelly = !!m.wobble, rx = jelly ? (m.rimCut ? 17 : 9) : big ? 13 : 10, ry = jelly ? (m.rimCut ? 13 : 7) : big ? 8 : 6;
      const onIt = tk.style === "flake" && m.rx ? (x, y) => Math.hypot((x - m.cx) / m.rx, (y - m.cy) / m.ry) <= 1 : () => true;
      const q = (x, y) => scoopAt(x, y, tk.x, tk.y, rx, ry, sd);
      if (tk.edge) tk.notch = [tk.x + rx * 0.15, tk.y - 4, rx * 1.15, ry * 0.85, sd];
      tk.mask = { kind: tk.style === "flake" || tk.style === "cut" ? "cut" : "dent", x0: tk.x - rx - 2, y0: tk.y - ry - 2, x1: tk.x + rx + 2, y1: tk.y + ry + 2, rx, ry, food: tk.style === "flake" && m.rx ? onIt : undefined,
        at: (x, y) => onIt(x, y) && q(x, y) !== null, q };
    } else if (tk.style === "wedge") {
      const ang = tk.a, hw = WEDGE, inE = (x, y) => Math.hypot((x - m.cx) / m.rx, (y - m.cy) / m.ry) <= 0.985;
      tk.mask = { kind: "cut", x0: m.cx - m.rx, y0: m.cy - m.ry, x1: m.cx + m.rx, y1: m.cy + m.ry + 1, food: inE, at: (x, y) => {
        if (!inE(x, y)) return false;
        const u = (x - m.cx) / m.rx, v = (y - m.cy) / m.ry;
        let da = Math.atan2(v, u) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        return Math.hypot(u, v) > 0.03 && Math.abs(da) < hw;
      } };
    } else if (tk.style === "tearoff" && m.rx) {
      const nx = (tk.x - m.cx) / m.rx, ny = (tk.y - m.cy) / m.ry, nl = Math.hypot(nx, ny) || 1, inE = (x, y) => Math.hypot((x - m.cx) / m.rx, (y - m.cy) / m.ry) <= 1;
      tk.mask = { kind: "cut", tear: true, x0: m.cx - m.rx, y0: m.cy - m.ry, x1: m.cx + m.rx, y1: m.cy + m.ry + 1, food: inE, at: (x, y) => {
        if (!inE(x, y)) return false;
        const u = (x - m.cx) / m.rx, v = (y - m.cy) / m.ry, along = (-u * ny + v * nx) / nl, d = (u * nx + v * ny) / nl;
        return d > 0.58 + (fbm(along * 6 + 3, 0.5, sd) - 0.5) * 0.22 + (h2(Math.floor(along * 40), 2, sd) - 0.5) * 0.07;
      } };
    } else if (tk.style === "tearoff" || tk.style === "cut") {
      const tear = tk.style === "tearoff", r0 = tk.disc || (tear ? 15 : 13), cx = tk.x, cy = tk.y;
      const inE = m.rx ? (x, y) => Math.hypot((x - m.cx) / m.rx, (y - m.cy) / m.ry) <= 1 : () => true;
      // a knife takes the end off with one straight cut
      if (tk.straight) return (tk.mask = { kind: "cut", x0: m.cx - m.rx - 1, y0: m.cy - m.ry - 1, x1: m.cx - m.rx * 0.2, y1: m.cy + m.ry + 1, food: inE, at: (x, y) => inE(x, y) && x - (m.cx - m.rx * 0.45) + (y - m.cy) * 0.3 < 0 });
      tk.mask = { kind: "cut", x0: cx - r0 * 1.35, y0: cy - r0 * 1.35, x1: cx + r0 * 1.35, y1: cy + r0 * 1.35, food: inE, at: (x, y) => {
        const a = Math.atan2(y - cy, x - cx), wob = 1 + (fbm(a * 2.2 + 1, 0.5, sd) - 0.5) * (tear ? 0.45 : 0.1) + (tear ? (h2(Math.floor(a * 9 + 20), 1, sd) - 0.5) * 0.14 : 0);
        return inE(x, y) && Math.hypot(x - cx, (y - cy) * 1.5) < r0 * wob;
      } };
    }
    return tk.mask;
  }
  function insideOf(tk, plan) {
    const G = plan.info.geo || {};
    if (["wedge", "carve", "flake"].includes(tk.style) || (tk.style === "cut" && !tk.kind)) return G.inside || IN[KIND_IN[tk.kind] || "meat"];
    if (tk.style === "forkslice" && (tk.kind === "slice" || tk.kind === "stand")) return G.inside || IN.pink;
    return IN[KIND_IN[tk.kind]] || G.inside || IN.meat;
  }
  // a colour scaled by k, stepped and dithered so painted shading keeps to the pixel-art look
  function tone(c, k, x, y) { const q = Math.floor(k * 8 + bay(x, y) * 0.9) / 8; return [c[0] * q, c[1] * q, c[2] * q]; }
  function paintHole(img, tk, plan, done) {
    const m = tk.mask, src = img.copy();
    if (m.kind === "dent") {
      // in the food's own colours: a dark crescent down the far wall under its edge, the wall lightening below it, a band of shadow under
      // the near lip, and the near lip catching the light; a wet food gets one glint, on its first scoop only. A scoop that took a bite out
      // of the outline paints only what's still food
      const wet = !!(tk.m && tk.m.wobble), rp = insideOf(tk, plan), N = tk.notch && FA.kit.notchAt;
      for (let y = Math.floor(m.y0) - 2; y <= m.y1 + 2; y++) for (let x = Math.floor(m.x0) - 7; x <= m.x1 + 7; x++) {
        const p = src.get(x, y);
        if (!p || (N && N(x + 0.5, y + 0.5, tk.notch))) continue;
        // under a bite out of the outline, its cut face: dark just under the edge, lighter below
        if (N && N(x + 0.5, y - 3.5, tk.notch)) { const d = N(x + 0.5, y - 0.5, tk.notch) ? 0 : N(x + 0.5, y - 1.5, tk.notch) ? 1 : N(x + 0.5, y - 2.5, tk.notch) ? 2 : 3; img.px(x, y, mix(p, C(pick(rp, d === 0 ? 0.9 : 0.04 + d * 0.06, x, y)), 0.85)); continue; }
        const q = m.q(x + 0.5, y + 0.5);
        if (q) {
          const cres = q.v < 0.15 + 0.35 * Math.sqrt(Math.max(0, 1 - q.u * q.u)), glint = wet && tk.k === 0 && q.u > -0.45 && q.u < -0.3 && !cres && q.v < 0.62;
          img.px(x, y, glint ? "#e8fce0" : tone(mix(p, C(pick(rp, cres ? 0.02 : 0.16 + (q.v - 0.4) * 0.45, x, y)), 0.88), cres ? 0.55 : 0.78 + q.v * 0.2, x, y));
        } else if (Math.abs((x + 0.5 - tk.x) / m.rx) < 0.75 && m.q(x + 0.5, y - 0.5)) img.px(x, y, mix(p, C(pick(rp, 0.85, x, y)), 0.7));
        else if (m.q(x + 0.5, y + 1.5) || m.q(x - 0.5, y + 0.5) || m.q(x + 1.5, y + 0.5)) img.px(x, y, tone(p, 0.7, x, y));
      }
      return;
    }
    // food is what's still there: inside the dish and not already cut away by an earlier take, so no cut wall is drawn across an old hole
    // the hole is this cut and every earlier one together, so cut walls stand only where food is left beside the hole: no wall from an old
    // cut is left across a newer one, and none is drawn across an old hole
    const prior = (done || []).filter((d) => d.kind === "cut"), U = (x, y) => m.at(x, y) || prior.some((d) => d.at(x, y));
    const bx0 = Math.min(m.x0, ...prior.map((d) => d.x0)), by0 = Math.min(m.y0, ...prior.map((d) => d.y0)), bx1 = Math.max(m.x1, ...prior.map((d) => d.x1)), by1 = Math.max(m.y1, ...prior.map((d) => d.y1));
    const inside = insideOf(tk, plan), f0 = m.food || (() => true), food = (x, y) => f0(x, y) && !U(x, y) && !(done || []).some((d) => d.at(x, y)), thick = m.tear ? 2 : Math.max(3, Math.round(((tk.m && tk.m.h) || 8) * 0.8));
    const fl = floorOf(src, tk), crust = tk.style === "wedge" ? 2 : 0, crustC = src.get(Math.round(tk.x + (tk.style === "wedge" ? Math.cos(tk.a) * 10 : 0)), Math.round(tk.y - (tk.style === "wedge" ? 0 : 6))) || [120, 70, 30];
    for (let x = Math.floor(bx0); x <= bx1; x++) {
      let face = -1;
      for (let y = Math.floor(by0); y <= by1; y++) {
        // a tear only touches the food itself, not the paper or board around it that its oval happens to cover
        const sp = m.tear && src.get(x, y), bare = sp && Math.abs(sp[0] - fl.c[0]) + Math.abs(sp[1] - fl.c[1]) + Math.abs(sp[2] - fl.c[2]) < 90;
        if (!U(x + 0.5, y + 0.5) || bare) { face = -1; continue; }
        if (face < 0) face = food(x + 0.5, y - 0.5) ? 0 : 99;
        if (face < thick) {
          const chunk = h2(Math.floor(x / 2), Math.floor((y - face) / 2), 7) > 0.78;
          img.px(x, y, face < crust ? tone(crustC, face === 0 ? 1.15 : 0.95, x, y) : pick(inside, 0.8 - ((face - crust) / thick) * 0.6 + (chunk ? -0.25 : 0) + (fbm(x / 2, y, 7) - 0.5) * 0.25, x, y));
          face++; continue;
        }
        img.px(x, y, m.tear ? fl(x, y, 6 + face) : fl(x, y, face - thick));
        face++;
      }
    }
    for (let y = Math.floor(by0) - 1; y <= by1 + 1; y++) for (let x = Math.floor(bx0) - 1; x <= bx1 + 1; x++) {
      if (U(x + 0.5, y + 0.5) || !food(x + 0.5, y + 0.5)) continue;
      const l = U(x - 0.5, y + 0.5), r = U(x + 1.5, y + 0.5), u = U(x + 0.5, y - 0.5);
      if (l || r) img.px(x, y, pick(inside, 0.55 + (fbm(x, y / 2, 3) - 0.5) * 0.4, x, y));
      else if (u) img.px(x, y, mix(src.get(x, y) || [0, 0, 0], "#000000", 0.5));
    }
    const r = rng(tk.seed + 31);
    for (let i = 0; i < 10; i++) { const x = lerp(m.x0, m.x1, r()), y = lerp(m.y0, m.y1, r()); if (m.at(x, y) && !m.at(x, y - thick)) img.px(x, y, pick(inside, 0.4 + r() * 0.5, 0, 0)); }
  }
  // what shows through a hole cut down to the plate: the plate's own colour, sampled just outside the food, in shadow under the cut face
  function floorOf(src, tk) {
    const g = tk.m;
    let sx = tk.x, sy = tk.y + 16;
    if (g && g.rx) { const a = tk.style === "wedge" ? tk.a : Math.atan2((tk.y - g.cy) / g.ry, (tk.x - g.cx) / g.rx); sx = g.cx + Math.cos(a) * g.rx * 1.08; sy = g.cy + Math.sin(a) * g.ry * 1.08 + 2; }
    let c = src.get(Math.round(clamp(sx, 1, W - 2)), Math.round(clamp(sy, 1, H - 2))) || [60, 40, 30];
    // under a torn piece, the paper or board all round it: the middle of a ring of samples, so one dark speck or shadow doesn't decide it
    if (tk.style === "tearoff" && g && g.rx) {
      const ring = [];
      for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, q = src.get(Math.round(clamp(g.cx + Math.cos(a) * g.rx * 1.25, 1, W - 2)), Math.round(clamp(g.cy + Math.sin(a) * g.ry * 1.25, 1, H - 2))); if (q) ring.push(q); }
      ring.sort((p0, q0) => p0[0] + p0[1] + p0[2] - q0[0] - q0[1] - q0[2]);
      if (ring.length) c = ring[Math.floor(ring.length * 0.6)];
    }
    const f = (x, y, k) => tone(c, clamp(0.3 + k * 0.07, 0.3, 0.95), x, y);
    f.c = c;
    return f;
  }

  // ---------- drawing: cutlery floating over the dish, about the size of the food ----------
  const PEWTER = R(["#1e1e26", "#3a3a46", "#5e5e6c", "#8a8a98", "#b8b8c4", "#e6e6ee"]);
  const WOOD = R(["#2a1606", "#4a2a10", "#6e4420", "#946036", "#b88050"]);
  const LIGHT = [-0.6, -0.8];
  // a rod of width wa..wb from a to b, shaded as a cylinder lit from the upper left
  function rod(lay, ax, ay, bx, by, wa, wb, rp, o) {
    o = o || {};
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, L = Math.sqrt(L2), nx = -dy / L, ny = dx / L, side = nx * LIGHT[0] + ny * LIGHT[1] > 0 ? 1 : -1;
    const pad = Math.max(wa, wb) / 2 + 1, x0 = Math.max(0, Math.floor(Math.min(ax, bx) - pad)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + pad)), y0 = Math.max(0, Math.floor(Math.min(ay, by) - pad)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + pad));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, t = clamp((px * dx + py * dy) / L2, 0, 1), qx = px - dx * t, qy = py - dy * t, w = Math.max(0.5, lerp(wa, wb, t) / 2);
      if (Math.hypot(qx, qy) > w) continue;
      const across = (qx * nx + qy * ny) / w * side;
      lay.px(x, y, pick(rp, clamp(0.5 + across * 0.42 + (o.shine && across > 0.25 && across < 0.65 ? 0.3 : 0) + (o.dark || 0), 0, 1), x, y, 0.4));
    }
  }
  function ellipse(lay, cx, cy, rx, ry, ang, fn) {
    const ca = Math.cos(ang), sa = Math.sin(ang), r = Math.max(rx, ry) + 1;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const px = x + 0.5 - cx, py = y + 0.5 - cy, u = (px * ca + py * sa) / rx, v = (-px * sa + py * ca) / ry, d = Math.hypot(u, v);
      if (d <= 1) { const c = fn(u, v, d, x, y); if (c) lay.px(x, y, c); }
    }
  }
  function poly(lay, pts, fn) {
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, x1); x++) {
      let inn = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inn = !inn; }
      if (inn) lay.px(x, y, fn(x, y));
    }
  }
  // each utensil is held at its tip and runs back along u for its own length, a little longer than a slice is wide; it sits on its own
  // layer with a dark outline so it reads over any dish; it shows once it has come a third of the way in (a: 0..1), drifting down from
  // above, so it never shows through the food
  const LEN = { fork: 30, knife: 34, spoon: 28, server: 32, mallet: 26 };
  function onLayer(img, fn, a) {
    const lay = new Img(W, H);
    if (a < 0.35) return;
    fn(lay);
    outline(lay, "#0c080a", 100);
    img.paste(lay, 0, 0);
  }
  function seg2(tool, x, y, ux, uy) { if (SEGS) SEGS.push({ k: CUR, tool, x, y, ux, uy, L: LEN[tool] }); }
  function fork(img, x, y, ux, uy, a) {
    seg2("fork", x, y, ux, uy);
    const px = -uy, py = ux, L = LEN.fork;
    onLayer(img, (lay) => {
      rod(lay, x + ux * 11, y + uy * 11, x + ux * L, y + uy * L, 3, 3.8, PEWTER, { shine: true });
      rod(lay, x + ux * 6, y + uy * 6, x + ux * 12, y + uy * 12, 6, 3, PEWTER, { shine: true });
      for (const k of [-1, 1]) rod(lay, x + px * k * 1.6, y + py * k * 1.6, x + px * k * 1.6 + ux * 7, y + py * k * 1.6 + uy * 7, 1.6, 1.8, PEWTER);
    }, a);
  }
  function knife(img, x, y, ux, uy, a) {
    seg2("knife", x, y, ux, uy);
    const px = -uy, py = ux, Lb = 19, L = LEN.knife;
    // a carving knife: a broad bright blade, straight along its spine and curving to the point on its edge, a steel bolster, a dark
    // handle with two rivets
    onLayer(img, (lay) => {
      rod(lay, x + ux * (Lb + 3), y + uy * (Lb + 3), x + ux * L, y + uy * L, 4, 4.6, WOOD, { dark: 0.15 });
      for (const k of [Lb + 6, Lb + 11]) lay.px(x + ux * k, y + uy * k, "#e8e8f0");
      rod(lay, x + ux * Lb, y + uy * Lb, x + ux * (Lb + 3), y + uy * (Lb + 3), 6, 6, PEWTER, { dark: -0.05 });
      const blade = [[x, y], [x + ux * Lb + px * 1.6, y + uy * Lb + py * 1.6], [x + ux * Lb - px * 4.2, y + uy * Lb - py * 4.2], [x + ux * (Lb * 0.55) - px * 4, y + uy * (Lb * 0.55) - py * 4], [x + ux * 5 - px * 2.4, y + uy * 5 - py * 2.4]];
      poly(lay, blade, (xx, yy) => { const across = ((xx + 0.5 - x) * px + (yy + 0.5 - y) * py), d = across + 4.2; return d < 1 ? "#ffffff" : across > 0.6 ? pick(PEWTER, 0.6, xx, yy) : pick(PEWTER, 0.98 - (d / 6) * 0.3, xx, yy); });
    }, a);
  }
  function spoon(img, x, y, ux, uy, a, fill) {
    seg2("spoon", x, y, ux, uy);
    const ang = Math.atan2(uy, ux), L = LEN.spoon;
    onLayer(img, (lay) => {
      rod(lay, x + ux * 7, y + uy * 7, x + ux * L, y + uy * L, 3, 3.6, PEWTER, { shine: true });
      ellipse(lay, x + ux * 1.5, y + uy * 1.5, 5.6, 3.9, ang, (u, v, d, xx, yy) => (d > 0.72 || !fill ? pick(PEWTER, 0.5 - v * 0.35 + (u < -0.3 ? 0.25 : 0) - (d < 0.72 ? 0.15 : 0), xx, yy) : fill(u, v, d, xx, yy)));
    }, a);
  }
  function server(img, x, y, ux, uy, a) {
    seg2("server", x, y, ux, uy);
    const px = -uy, py = ux, L = LEN.server;
    onLayer(img, (lay) => {
      rod(lay, x + ux * 15, y + uy * 15, x + ux * L, y + uy * L, 3, 3.8, WOOD);
      rod(lay, x + ux * 11, y + uy * 11, x + ux * 16, y + uy * 16, 2.4, 2.4, PEWTER);
      const blade = [[x - px, y - py], [x + px, y + py], [x + ux * 10 + px * 5.5, y + uy * 10 + py * 5.5], [x + ux * 12 + px * 2, y + uy * 12 + py * 2], [x + ux * 12 - px * 2, y + uy * 12 - py * 2], [x + ux * 10 - px * 5.5, y + uy * 10 - py * 5.5]];
      poly(lay, blade, (xx, yy) => { const across = ((xx + 0.5 - x) * px + (yy + 0.5 - y) * py) / 5.5; return pick(PEWTER, 0.62 - across * 0.3, xx, yy); });
    }, a);
  }
  function mallet(img, x, y, ux, uy, a) {
    seg2("mallet", x, y, ux, uy);
    const px = -uy, py = ux, L = LEN.mallet;
    onLayer(img, (lay) => {
      rod(lay, x + ux * 3, y + uy * 3, x + ux * L, y + uy * L, 3, 3.6, WOOD);
      rod(lay, x - px * 5.5, y - py * 5.5, x + px * 5.5, y + py * 5.5, 7, 7, WOOD, { dark: 0.08 });
      rod(lay, x - px * 6, y - py * 6, x - px * 4.4, y - py * 4.4, 7.4, 7.4, WOOD, { dark: 0.3 });
    }, a);
  }
  const TOOLS = { fork, knife, spoon, server, mallet };
  // a sprite drawn at its anchor, faded by dithering like the cutlery
  function sprite(img, spr, x, y, a) {
    if (!spr || !spr.w) return;
    img.paste(spr, Math.round(x - spr.ax), Math.round(y - spr.ay), 1, a === undefined || a >= 1 ? null : (c, xx, yy) => (bay(xx + Math.round(x), yy + Math.round(y)) < a ? c : null));
  }
  function trim(im) {
    let x0 = im.w, y0 = im.h, x1 = -1, y1 = -1;
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (im.alpha(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < 0) { const e = new Img(1, 1); e.ax = 0; e.ay = 0; return e; }
    const out = new Img(x1 - x0 + 3, y1 - y0 + 3);
    out.paste(im, 1 - x0, 1 - y0);
    out.ax = out.w / 2; out.ay = out.h / 2;
    return out;
  }
  // which way a utensil's handle runs from its tip: out to its eater's side and down, turned up as far as it must be to stay clear of the
  // frame's edges
  const EDGE = 4;
  const DOWN = [0.95, 0.75, 0.55, 0.35, 0.15, -0.05, -0.25, -0.45];
  function aim(x, y, side, tool, angs) {
    const L = LEN[tool] || 30;
    for (const ang of angs || DOWN) {
      const ux = side * Math.cos(ang), uy = Math.sin(ang), ex = x + ux * L, ey = y + uy * L;
      if (ex >= EDGE && ex <= W - 1 - EDGE && ey >= EDGE && ey <= H - 1 - EDGE) return [ux, uy];
    }
    return [side * Math.cos(-0.45), Math.sin(-0.45)];
  }
  // a utensil kept wholly inside the frame: its tip pulled in from the edges so neither end touches one
  function keepIn(x, y, ux, uy, tool) {
    const L = LEN[tool] || 30, ex = x + ux * L, ey = y + uy * L;
    const dx = Math.max(0, EDGE - Math.min(x, ex)) - Math.max(0, Math.max(x, ex) - (W - 1 - EDGE)), dy = Math.max(0, EDGE - Math.min(y, ey)) - Math.max(0, Math.max(y, ey) - (H - 1 - EDGE));
    return [x + dx, y + dy];
  }
  function tool(img, name, x, y, side, a, angs) {
    if (a <= 0) return;
    const [ux, uy] = aim(x, y, side, name, angs), [tx, ty] = keepIn(x, y, ux, uy, name);
    TOOLS[name](img, tx, ty, ux, uy, a);
  }
  // a carving knife saws point down, its handle up and back
  const UP = [-1.15, -0.95, -0.75, -0.5, -0.25];

  // ---------- the plan and its timeline ----------
  // a take: its utensil drifts down onto the food and fades in (IN_T), does its work there (ACT: saws, stabs, scoops, scores, cracks), the
  // part it took is gone at tk.gone with its bite's sound, and the utensil lifts away and fades (OUT_T). Finger food has no utensil: the
  // piece is just gone. A carved slice tips onto the board at tk.sw and is gone a moment later
  const IN_T = 0.35, OUT_T = 0.4, LIE_T = 0.45;
  function plan(spec, o) {
    o = o || {};
    const n = Math.max(1, o.n || 1), info = {};
    const p = { spec, seed: o.seed || 1, legendary: !!o.legendary, info, states: [], takes: [], sfx: [], dur: 0 };
    p.states[0] = FA.plate(spec, "done", { seed: p.seed, legendary: p.legendary, info });
    choose(spec, info, n, n > 1).forEach((tk, k) => {
      const st = STYLE[tk.style] || STYLE.pick;
      // each of the crew works from the side of the dish they take from, so no two utensils cross
      const side = tk.style === "carve" || (k && p.takes[0].carver) ? (k % 2 ? 1 : -1) : tk.x < 112 ? -1 : tk.x > 128 ? 1 : k % 2 ? -1 : 1;
      Object.assign(tk, { k, side, seed: p.seed + k * 7, st });
      // a spoon in a thick stew leaves a hollow where the spoonful went, as well as taking what floated there
      tk.thick = tk.style === "spoon" && spec.plate === "stew";
      if (["scoop", "flake", "wedge", "tearoff", "cut"].includes(tk.style) || tk.thick) holeMask(tk);
      tk.tool = st.tools[0] === "fingers" ? null : tk.fork ? "fork" : st.tools[0];
      tk.sw = IN_T + st.ACT * (st.act === "carve" ? 0.62 : 1);
      tk.gone = st.act === "carve" ? tk.sw + LIE_T : tk.sw;
      tk.dur = tk.gone + OUT_T;
      // the next carve starts once the last slice is gone, so there is only ever one knife; one side's crew take turns
      const pv = p.takes[k - 1], knives = ["carve", "wedge", "cut", "portion"];
      tk.t0 = k === 0 ? 0 : p.takes[0].carver ? p.takes[0].gone - 0.2 + (k - 1) * 0.3 : pv.t0 + (tk.style === "carve" ? pv.dur - IN_T * 0.5 : knives.includes(tk.style) && knives.includes(pv.style) ? pv.gone : Math.min(pv.dur, o.gap || 0.75));
      if (k) for (const q of p.takes) if (q.side === tk.side) tk.t0 = Math.max(tk.t0, q.t0 + q.dur - 0.05);
      tk.word = tk.m && tk.m.wobble ? "SQUISH" : KIND_WORD[tk.kind] || WORD[tk.style] || "CHOMP";
      if (!tk.tool && tk.key && !tk.again) tk.bite1 = IN_T * 0.6 + st.ACT * 0.3;
      p.takes.push(tk);
      p.sfx.push(...sounds(tk).map(([t, nm, v]) => [tk.t0 + t, nm, v]));
    });
    p.dur = Math.max(...p.takes.map((tk) => tk.t0 + tk.dur));
    p.steps = p.takes.map((_, k) => () => state(p, k + 1));
    return p;
  }
  // the work's own sounds, then one sound for the bite, when the part goes: what it sounds like to eat that food
  function biteSound(tk) {
    if (tk.m && tk.m.wobble) return "squish";
    if (tk.style === "spoon") return "slurp";
    if (tk.style === "scoop") return "squish";
    if (tk.style === "crack" || tk.word === "CRACK") return "crack";
    if (tk.word === "CRUNCH") return "crunch";
    if (tk.style === "tear" || tk.style === "tearoff") return "tear";
    return "chomp";
  }
  function sounds(tk) {
    const a = tk.st.act, A = tk.st.ACT, out = [];
    if (tk.tool) out.push([0.05, "swish", 0.6]);
    if (a === "carve") out.push([IN_T + A * 0.2, "saw", 1], [IN_T + A * 0.36, "saw", 1], [IN_T + A * 0.52, "saw", 1], [tk.sw + 0.12, "thud", 0.4]);
    if (a === "saw") out.push([IN_T + A * 0.3, "saw", 1], [IN_T + A * 0.55, "saw", 1]);
    if (a === "wedge") out.push([IN_T + A * 0.25, "saw", 1], [IN_T + A * 0.55, "saw", 1]);
    if (a === "dip") out.push([IN_T + 0.2, "plop", 0.6]);
    if (a === "crack") out.push([IN_T + A * 0.3, "clink", 0.8]);
    if (a === "pin" || a === "stab") out.push([IN_T + A * 0.5, "clink", 0.7]);
    if (tk.bite1 !== undefined) out.push([tk.bite1, biteSound(tk), 0.8]);
    out.push([tk.gone, biteSound(tk), 1]);
    return out;
  }
  function k0(plan, t) { let k = 0; for (const tk of plan.takes) if (t >= tk.t0 + tk.sw) k++; return k; }

  // ---------- one frame ----------
  // the utensils drawn this frame (draw's res.tools): each one's tip, the way its handle runs and its length
  let SEGS = null, CUR = -1;
  function draw(img, plan, t) {
    img.paste(state(plan, k0(plan, t)), 0, 0);
    // a jelly squashes and wobbles as a scoop comes out of it
    for (const tk of plan.takes) { const m = tk.m, a = t - tk.t0 - tk.gone; if (m && m.wobble && a > -0.05 && a < 1.6) wobble(img, plan, m.wobble, Math.max(0, a)); }
    const res = { shake: null, word: null, tools: [] }, front = new Img(W, H);
    SEGS = res.tools;
    // a piece of finger food between its two bites: its first bite gone, the board showing there
    for (const tk of plan.takes) { const lt = t - tk.t0; if (tk.bite1 !== undefined && lt >= tk.bite1 && lt < tk.sw) { const g = finger(plan, tk); if (g) for (const [x, y, c] of g.bite) if (c) img.px(x, y, c); } }
    for (const tk of plan.takes) if (t >= tk.t0 && t < tk.t0 + tk.dur) drawTake(img, front, plan, tk, t - tk.t0, res);
    img.paste(front, 0, 0);
    SEGS = null;
    return res;
  }
  // the same dish with its jelly gone (a bite that takes the whole of it), to tell jelly from what's behind it when it moves
  function jellyless(spec, stage, seed, legendary) { return FA.plate(spec, stage, { seed, legendary, eat: { gone: [], zones: [], carved: 0, bites: [[W / 2, -1e4, 1e4, 1e5, 0]] } }); }
  // move a jelly's pixels: only what differs from the jelly-less dish behind it moves, and what it leaves uncovers that dish
  function moveJelly(img, ref, box, map) {
    const src = img.copy(), x0 = Math.max(0, Math.floor(box[0] - 20)), x1 = Math.min(W, Math.ceil(box[2] + 20)), y0 = Math.max(0, Math.floor(box[1])), y1 = Math.min(H, Math.ceil(box[3] + 12));
    const isJ = (x, y) => { const a = src.get(x, y), b = ref.get(x, y); return a && b && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 6; };
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const b = ref.get(x, y); if (b && isJ(x, y)) img.px(x, y, b); }
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const [sx, sy] = map(x, y), X = Math.round(sx), Y = Math.round(sy); if (isJ(X, Y)) img.px(x, y, src.get(X, Y)); }
  }
  // the scoop comes out and the jelly squashes down and spreads, springs up tall and thin, and settles over about six frames, then
  // shivers a little from side to side
  function wobble(img, plan, box, a) {
    const ph = a / 0.5, k = ph < 1 ? Math.sin(ph * TAU) * (1 - ph) * 0.18 : 0, sy = 1 - k, sx = 1 + k * 0.6;
    const amp = 1.6 * Math.exp(-a * 2.4), bot = box[3] - 2, cx = (box[0] + box[2]) / 2;
    if (!k && amp < 0.5) return;
    const ref = plan.jref || (plan.jref = jellyless(plan.spec, "done", plan.seed, plan.legendary));
    moveJelly(img, ref, box, (x, y) => { const up = clamp((bot - y) / (bot - box[1]), 0, 1); return [cx + (x - cx) / sx - (ph >= 1 ? Math.sin(a * 22 + y * 0.18) * amp * up : 0), bot - (bot - y) / sy]; });
  }
  function particles(img, x, y, age, seed, cols, n, sp, grav) {
    if (age < 0 || age > 0.9) return;
    const r = rng(seed);
    for (let i = 0; i < n; i++) { const a = -Math.PI * (0.1 + r() * 0.8), v = (sp || 40) * (0.4 + r() * 0.8), dir = r() < 0.5 ? -1 : 1, sz = r() < 0.4 ? 2 : 1; img.rect(x + Math.cos(a) * v * age * dir, y + Math.sin(a) * v * age + (grav || 90) * age * age, sz, sz, cols[i % cols.length]); }
  }
  function ripple(img, x, y, age) {
    if (age < 0 || age > 1) return;
    for (const d of [0, 0.25]) { const a = age - d; if (a < 0) continue; const rx = 4 + a * 16, ry = rx * 0.45; for (let k = 0; k < 44; k++) { const q = (k / 44) * TAU; img.px(x + Math.cos(q) * rx, y + Math.sin(q) * ry, "#fff4dc", 0.55 * (1 - a)); } }
  }
  // how far the utensil has come in (0..1) and gone away (0..1) at local time lt: it drifts down onto the food fading in, and lifts off
  // fading out
  function fadeOf(tk, lt) { return { inn: ease3(seg(lt, 0, IN_T)), out: inout(seg(lt, tk.gone, tk.gone + OUT_T)) }; }
  function drawTake(img, front, plan, tk, lt, res) {
    const st = tk.st, { inn, out } = fadeOf(tk, lt), a = inn * (1 - out), lift = (1 - inn) * -10 + out * -12, u = seg(lt, IN_T, tk.sw), side = tk.side;
    const inside = insideOf(tk, plan);
    CUR = tk.k;
    const age = lt - tk.gone;
    // finger food's first bite: crumbs off the end and the word
    const a1 = tk.bite1 !== undefined ? lt - tk.bite1 : -1;
    if (a1 >= 0 && lt < tk.sw) { res.word = [tk.word, 120, 30, a1]; const g = finger(plan, tk); if (g) particles(front, g.x, g.y, a1, tk.seed + 4, [pick(inside, 0.85, 0, 0), pick(inside, 0.5, 0, 0)], 6, 25, 90); }
    // the bite: the part is gone, a few crumbs or drops where it was, and the word
    if (age >= 0 && age < 0.7) { res.word = [tk.word, 120, 30, age]; if (!(tk.m && tk.m.wobble) && tk.style !== "spoon") particles(front, tk.x, tk.y - 2, age, tk.seed + 9, [pick(inside, 0.85, 0, 0), pick(inside, 0.5, 0, 0)], 8, 30, 90); }
    if (st.act === "carve") return carveAt(img, front, plan, tk, lt, a, lift);
    if (st.act === "wedge") {
      const m = tk.m, ph = seg(u, 0.05, 0.7), sd = ph < 0.5 ? -1 : 1, q = ph < 0.5 ? ph * 2 : (ph - 0.5) * 2, c = tk.a + sd * WEDGE;
      const cut = (x, y) => plan.takes.some((q) => q.k < tk.k && q.mask && q.mask.at(x + 0.5, y + 0.5));
      if (lt < tk.sw) for (const [c0, q0] of [[tk.a - WEDGE, seg(ph, 0, 0.5)], [tk.a + WEDGE, seg(ph, 0.5, 1)]]) for (let qq = 0.04; qq < Math.min(q0, 0.9); qq += 0.012) { const x = Math.floor(m.cx + Math.cos(c0) * m.rx * qq), y = Math.floor(m.cy + Math.sin(c0) * m.ry * qq); if (!cut(x, y)) img.px(x, y, "#1e0e06"); }
      // the knife scores both sides of the wedge from the middle out, then the server slides under it, and it's gone
      if (u < 0.72) tool(front, "knife", m.cx + Math.cos(c) * m.rx * lerp(0.05, 0.95, q), m.cy + Math.sin(c) * m.ry * lerp(0.05, 0.95, q) + lift, side, inn * (1 - seg(u, 0.62, 0.72)));
      else { const sl = seg(u, 0.72, 1); tool(front, "server", lerp(m.cx + Math.cos(tk.a) * m.rx * 1.1, tk.x, sl), lerp(m.cy + Math.sin(tk.a) * m.ry * 1.1, tk.y, sl) + lift, side, seg(u, 0.72, 0.85) * (1 - out)); }
      return;
    }
    if (st.act === "saw") {
      // a fork holds the piece and a knife saws beside it, from the other side
      const saw = lt < tk.sw ? Math.sin(u * Math.PI * 6) * 3 : 0;
      tool(front, "fork", tk.x + side * 4, tk.y - 3 + lift, side, a);
      if (lt < tk.sw) tool(front, "knife", tk.x - side * 6 + saw * 0.6, tk.y - 2 + lift + saw * 0.8, -side, a, UP);
      return;
    }
    if (st.act === "crack") {
      const hits = [0.3, 0.62], up = 1 - Math.max(...hits.map((h) => Math.max(0, 1 - Math.abs(u - h) / 0.12)));
      if (lt < tk.sw) tool(front, "mallet", tk.x + side * 2, tk.y - 6 - up * 14 + lift, side, a);
      else tool(front, "mallet", tk.x + side * 2, tk.y - 20 + lift, side, a);
      hits.forEach((h, i) => { const ag = u - h; if (ag > 0 && lt < tk.sw + 0.3) { particles(front, tk.x, tk.y - 3, ag * 0.9, tk.seed + i, ["#e85a1c", "#ff9a4a", "#fff4e0", "#a8320a"], 10, 55, 130); if (ag < 0.05) res.shake = [1, 0]; } });
      if (u > 0.3 && lt < tk.sw) for (let jj = 0; jj < 5; jj++) { const an = jj * 1.3 + tk.seed, l = u > 0.62 ? 9 : 5; img.line(tk.x, tk.y, tk.x + Math.cos(an) * l, tk.y + Math.sin(an) * l * 0.5, "#1a0804"); }
      return;
    }
    if (!tk.tool) return;
    if (tk.tool === "spoon") {
      // into the broth or the mound, a ripple, and out again empty: the spoonful is gone from the dish, not carried anywhere
      const dip = st.act === "dip" || st.act === "dig" ? Math.sin(seg(u, 0.1, 0.9) * Math.PI) * 3 : 0;
      if (st.act === "dip" && lt > IN_T + 0.2) ripple(img, tk.x, tk.y, lt - IN_T - 0.2);
      tool(front, "spoon", tk.x, tk.y - 2 + dip + lift, side, a);
      return;
    }
    // a fork: down onto the piece, a stab, and the piece is gone
    const stab = Math.sin(seg(u, 0.3, 0.8) * Math.PI) * 3;
    tool(front, tk.tool, tk.x, tk.y - 4 + stab + lift, side, a);
  }
  // carving: the fork pins the joint, the knife saws down through the end, the slice tips over onto the board; the fork moves onto it,
  // and the slice is gone
  function carveAt(img, front, plan, tk, lt, a, lift) {
    const j = tk.j, u = seg(lt, IN_T, tk.sw), saw = lt < tk.sw ? Math.sin(seg(u, 0.08, 1) * Math.PI * 6) * 4 : 0;
    const kph = seg(u, 0.08, 1), kx = j.x - 1, ky = j.y - j.h * 0.85 + kph * j.h * 1.4;
    if (lt < tk.sw + 0.2) tool(front, "knife", kx + saw * 0.5, ky + saw * 0.8 + lift, -1, lt < tk.sw ? a : 1 - seg(lt, tk.sw, tk.sw + 0.2), UP);
    if (lt >= tk.sw && lt < tk.gone) {
      const q = ease(seg(lt, tk.sw, tk.sw + 0.2)), sl = tk.lying || (tk.lying = trim(FA.roastSlice(plan.spec)));
      sprite(img, sl, lerp(j.x - sl.w * 0.3, tk.x, q), lerp(j.y + j.h * 0.4, tk.y, q) - Math.sin(q * Math.PI) * 4, 1);
      if (u > 0.05 && lt < tk.sw + 0.1) particles(img, kx - 2, ky + 3, (lt - tk.sw) * 3, tk.seed, [pick(insideOf(tk, plan), 0.85, 0, 0), "#fff0d8"], 3, 20, 60);
    }
    const onSlice = seg(lt, tk.sw + 0.15, tk.sw + 0.35), fx = lerp(j.x + 22, tk.x + 4, onSlice), fy = lerp(j.y - 4, tk.y - 5, onSlice);
    tool(front, "fork", fx, fy + lift, 1, a);
  }

  FA.eat = { plan, draw, state, choose, STYLE, LEN, EDGE, jellyless, moveJelly, tools: { fork, knife, spoon, server, mallet } };
})(typeof window !== "undefined" ? window : globalThis);
