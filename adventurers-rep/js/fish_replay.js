/* Catch replays: a fishing session in eight beats at its own water, either side on with the water hidden (framing A) or as a tank you can see into (framing D), drawn from a catch record with synthesised sound. */
/*
  INPUT: one catch record (league/fishing.py; world["catches"][id], exported as data/catch/<id>.js under key "catch/<id>"):
    { id, day, season, hero: hero id, name: hero name, crew: [{ id, name }] watching from the bank (may be empty),
      where: "camp" | "town" | "hunt" | "contest", water: content.fish WATERS id or null (a roadside stream),
      kind: "river" | "lake" | "sea" | "ice" | "swamp" | "cave", perch, place, at: where as words, sky: weather key, night: bool,
      rod: { set, name, tier } | null (a hand line), lure: lure id | null,
      outcome: "catch" | "nothing" | "away" | "junk" | "stolen" | "strange" | "legend_away" | "legend_caught",
      species?, size?, rank?, rare?, first?, best?, junk?, thief?: { kind, name? }, strange?: "whiskers" | "letter" | "key",
      letter?: { from, name, text }, key?: { dungeon, name }, secret?, legend?: { id, name, size, told },
      legend_here?: bool (the water's legend is still in it), framing?: "A" | "D",
      kept, line: the bubble, text: the diary sentence, seed: int (the gags and pacing) }

  FishReplay.framing(rec) -> "A" (side on, the water hidden: bridges, the sea, swamps, roadside streams) or "D" (the tank: lake jetties,
    underground pools, ice holes); rec.framing wins when present.
  FishReplay.player(rec, opts) -> <figure> that plays while on screen, holds on the last beat, replays on click; under reduced motion it
    shows the last beat. opts.scale (CSS px per pixel, default fluid to 100% width), opts.heroes (id -> hero, default App.heroes).
    fig.replay drives it from the page's shared control bar (replay.js).
  FishReplay.frame(rec, t, opts) -> { w, h, data: RGBA bytes } (no DOM; tools capture with it). frame(rec, 0) is already the scene.
  FishReplay.length(rec) -> seconds before the hold. FishReplay.beats(rec) -> [{ id, t0, t1 }]. FishReplay.events(rec) -> the sound cues.
  The replay never decides anything: every ending, species and size comes from the record; the seed only paces and dresses it.
*/
(function (root) {
  "use strict";
  const FA = root.FishArt, K = root.FoodArt.kit;
  const { Img, C, mix, rng, hash, fbm, h2, bay, clamp, lerp, text, textWidth, glow, star } = K;
  const W = FA.W, H = FA.H, R = Math.round, TAU = Math.PI * 2;
  const ease = (t) => 1 - (1 - t) * (1 - t);
  const ease3 = (t) => 1 - Math.pow(1 - t, 3);
  const inout = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const back = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const SF = () => ((root.App && root.App.S) || (root.LD && root.LD.static) || {}).fish || {};
  const OUTCOMES = ["catch", "nothing", "away", "junk", "stolen", "strange", "legend_away", "legend_caught"];

  // ---------- the record, filled in ----------
  function norm(rec) {
    const r = Object.assign({}, rec), F = SF(), wat = (F.waters || {})[r.water] || null;
    r.outcome = OUTCOMES.includes(r.outcome) ? r.outcome : "catch";
    r.kind = r.kind || (wat && wat.kind) || "river";
    r.seed = (r.seed >>> 0) || hash(String(r.id || "catch") + (r.day || 0));
    r.framing = FA.framing(r);
    r.legendLive = r.outcome.startsWith("legend") || !!r.legend_here;
    if (r.legendLive) {
      const lg = r.legend && r.legend.id ? r.legend : (wat && (F.legends || {})[wat.legend]) ? Object.assign({ told: "" }, F.legends[wat.legend]) : null;
      r.lg = lg ? Object.assign({}, (F.legends || {})[lg.id] || {}, lg) : null;
      if (!r.lg) r.legendLive = false;
    }
    if (r.outcome.startsWith("legend") && r.lg) { r.species = r.species || r.lg.species; r.size = r.size || r.lg.size; }
    if (r.outcome === "strange" && r.strange === "whiskers") r.species = "catfish";
    r.sp = FA.species(r.species || (Object.values(F.species || {}).find((s) => s.kind === r.kind) || {}).id);
    r.size = r.size || r.sp.mid;
    r.crew = (r.crew || []).filter((c) => c && c.id !== r.hero).slice(0, 2);
    r.tier = r.rod ? r.rod.tier || 0 : -1;
    r.thief = r.thief || { kind: "heron" };
    r.junk = r.junk || "boot";
    r.strange = r.strange || "letter";
    return r;
  }

  // ---------- heroes: the real sprite, sat or stood, its arms free for the reveal ----------
  function gridImg(g) {
    if (!g) return null;
    const im = new Img(g.w, g.h);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const c = g.px[y * g.w + x]; if (c) im.px(x, y, c); }
    return im;
  }
  function blocky(i, seated) {
    const im = new Img(28, 34), coats = ["#9a2a20", "#2f5a7a", "#3f6a2c", "#9a6a14"], coat = coats[i % coats.length];
    im.rect(9, 6, 10, 2, "#5c3c24"); im.rect(11, 3, 6, 3, "#5c3c24");
    im.rect(10, 8, 8, 7, "#d9a27a"); im.px(15, 11, "#120e0b"); im.px(12, 11, "#120e0b");
    im.rect(8, 15, 12, 10, coat); im.rect(6, 16, 2, 8, coat); im.rect(20, 16, 2, 8, coat); im.rect(6, 24, 2, 2, "#d9a27a"); im.rect(20, 24, 2, 2, "#d9a27a");
    if (seated) { im.rect(4, 25, 16, 4, "#2a1b11"); im.rect(3, 29, 4, 4, "#2a1b11"); }
    else { im.rect(9, 25, 4, 8, "#2a1b11"); im.rect(15, 25, 4, 8, "#2a1b11"); }
    K.outline(im, "#120e0b");
    return im;
  }
  function castOf(r, opts) {
    const A = root.App || {}, heroes = (opts && opts.heroes) || A.heroes || {}, S = A.S || (root.LD && root.LD.static) || {};
    const one = (id, name, i) => {
      const h = Object.assign({ id, name }, heroes[id] || {});
      const cls0 = (S.classes || {})[h.cls] || (S.classes || {}).warrior || { look: { outfit: "leather", head: "none" } };
      const cls = Object.assign({}, cls0, { look: Object.assign({}, cls0.look || {}, { offhand: "none" }) });
      const bare = Object.assign({}, h, { alive: true, weapon: "none" });
      if (h.kit) { const kit = JSON.parse(JSON.stringify(h.kit)); kit.weapon = null; kit.offhand = null; if (kit.back && kit.back.art === "quiver") kit.back = null; bare.kit = kit; }
      let stand = null, seat = null, portrait = null;
      try { if (root.Art && h.look) stand = gridImg(root.Art.heroGrid(bare, 0, cls)); } catch (e) { stand = null; }
      try { if (root.Art && root.Art.heroSeated && h.look) seat = gridImg(root.Art.heroSeated(bare, 0, cls)); } catch (e) { seat = null; }
      try { if (root.Paint && h.look) portrait = gridImg(root.Paint.portraitGrid(h, cls0, { bg: false })); } catch (e) { portrait = null; }
      const skin = (h.look && h.look.skin) || "#d9a27a";
      stand = stand || blocky(i, false); seat = seat || blocky(i, true);
      return { id, name: name || h.name || "", stand, seat, portrait, skin, pet: h.pet || null, arms: armless(stand) };
    };
    return { hero: one(r.hero, r.name, 0), crew: r.crew.map((c, i) => one(c.id, c.name, i + 1)) };
  }
  // the sprite with its hanging arms taken off, so the reveal can raise them
  function armless(spr) {
    const o = spr.copy();
    const solid = (x, y) => x >= 0 && y >= 0 && x < spr.w && y < spr.h && spr.d[(y * spr.w + x) * 4 + 3] > 0;
    let x0 = 99, x1 = -1;
    for (let x = 0; x < spr.w; x++) if (solid(x, 14)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    if (x1 < 0) return o;
    const sleeve = spr.get(R((x0 + x1) / 2), 18) || [90, 60, 40];
    for (let y = 15; y < 28; y++) for (let x = 0; x < spr.w; x++) if (x < x0 + 1 || x > x1 - 1) { if (solid(x, y)) o.d[(y * spr.w + x) * 4 + 3] = 0; }
    o.sleeve = sleeve; o.x0 = x0; o.x1 = x1;
    return o;
  }

  // ---------- small things drawn over the scene ----------
  function blit(dst, src, x, y, a, flip) {
    x = R(x); y = R(y);
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
      const u = flip ? src.w - 1 - i : i, o = (j * src.w + u) * 4, al = src.d[o + 3];
      if (al) dst.px(x + i, y + j, [src.d[o], src.d[o + 1], src.d[o + 2]], (al / 255) * (a === undefined ? 1 : a));
    }
  }
  function label(img, s, x, y, a) {
    // pixel type is either there or not: a half-faded outline smears into the sky
    if (a < 0.5) return;
    const lay = new Img(W, H);
    text(lay, s, x, y, "#f6ead0", { outline: "#1a0e08" });
    img.paste(lay, 0, 0, 1);
  }
  function bubble(img, say, x, y, t, side) {
    if (t <= 0) return;
    const lines = FA.wrap(say, 132), u = clamp(t / 0.22, 0, 1), sc = Math.max(0.2, back(u));
    const w0 = Math.max(...lines.map((l) => textWidth(l))) + 10, h0 = lines.length * 10 + 5;
    const bw = Math.max(5, R(w0 * sc)), bh = Math.max(4, R(h0 * sc));
    const bx = clamp(R(x - bw / 2), 2, W - bw - 2), by = clamp(R(y - bh), 2, H - bh - 2);
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      const cnr = (i + j < 2) || (bw - 1 - i + j < 2) || (i + bh - 1 - j < 2) || (bw - 1 - i + bh - 1 - j < 2);
      if (cnr) continue;
      const edge = i === 0 || j === 0 || i === bw - 1 || j === bh - 1;
      img.px(bx + i, by + j, edge ? "#1a1010" : j > bh - 4 ? "#e8dcc4" : "#fff8ea");
    }
    const tx = clamp(R(x), bx + 3, bx + bw - 5), sd = side || 0;
    if (by + bh < y + 4) for (let k = 0; k < 4; k++) { img.px(tx - 1 + sd * k, by + bh - 1 + k, "#1a1010"); img.px(tx + 2 + sd * k, by + bh - 1 + k, "#1a1010"); img.px(tx + sd * k, by + bh - 1 + k, k < 3 ? "#e8dcc4" : "#1a1010"); img.px(tx + 1 + sd * k, by + bh - 1 + k, k < 3 ? "#e8dcc4" : "#1a1010"); }
    if (u < 0.8) return;
    const red = /^[!?]+$/.test(say);
    lines.forEach((l, i) => text(img, l, bx + 5, by + 12 + i * 10, red ? "#c0281e" : "#2a1810", { bold: red }));
  }
  function mark(img, ch, x, y, t) {
    if (t <= 0) return;
    const s = t < 0.15 ? 1 + (0.15 - t) * 3 : 1, w = 7, h = 11, yy = R(y - (s - 1) * 8);
    img.rect(x - 1, yy - 1, w + 2, h + 2, "#1a1010"); img.rect(x, yy, w, h, "#fff8ea"); img.rect(x, yy + h - 2, w, 2, "#e8dcc4");
    text(img, ch, x + 2 + (ch === "!" ? 1 : 0), yy + 9, ch === "!" ? "#c0281e" : "#2a1810", { bold: true });
  }
  function rings(img, x, y, u, col, n) {
    for (let k = 0; k < (n || 2); k++) {
      const v = u - k * 0.25;
      if (v <= 0 || v >= 1) continue;
      const rx = 2 + v * 12, ry = 1 + v * 2.4, a = (1 - v) * 0.85;
      for (let i = 0; i < 40; i++) { const an = (i / 40) * TAU; img.px(x + Math.cos(an) * rx, y + Math.sin(an) * ry, col || "#eef6f4", a); }
    }
  }
  function splash(img, x, y, u, n, size, seed) {
    if (u <= 0 || u >= 1) return;
    const r = rng(seed || 3);
    for (let i = 0; i < n; i++) {
      const vx = (r() - 0.5) * 2.2 * size, vy = -(0.8 + r()) * size * 1.6, tt = u * 1.1;
      const px = x + vx * tt * 10, py = y + vy * tt * 10 + 40 * tt * tt * size;
      if (py > y + 1) continue;
      img.px(px, py, r() < 0.5 ? "#ffffff" : "#cfe4e8", 1 - u * 0.6);
    }
  }
  function drops(img, x, y, t, n, seed) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) { const ph = (t * 1.6 + r()) % 1, dx = (r() - 0.5) * 12; img.px(x + dx, y + ph * 24, "#d8eef0", 1 - ph); }
  }

  // ---------- the rod, the line, the float ----------
  const ROD = [{ col: "#6e5a3a", len: 20 }, { col: "#8a6a3a", len: 32 }, { col: "#a8783e", len: 36 }];
  function rodTip(p, st) {
    const hd = p.hand, L = ROD[p.r.tier + 1].len, a = (st.angle || 52) * (Math.PI / 180);
    return [hd[0] + Math.cos(a) * L, hd[1] - Math.sin(a) * L];
  }
  function drawRod(img, p, st) {
    const hd = p.hand, rod = ROD[p.r.tier + 1], tip = rodTip(p, st), bend = st.bend || 0;
    const butt = [hd[0] - (tip[0] - hd[0]) * 0.12, hd[1] - (tip[1] - hd[1]) * 0.12];
    const mx = (butt[0] + tip[0]) / 2, my = (butt[1] + tip[1]) / 2, len = Math.hypot(tip[0] - butt[0], tip[1] - butt[1]) || 1;
    const nx = (tip[1] - butt[1]) / len, ny = -(tip[0] - butt[0]) / len;
    const cx = mx - nx * bend * len * 0.5, cy = my - ny * bend * len * 0.5;
    const pts = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40, x = (1 - t) * (1 - t) * butt[0] + 2 * (1 - t) * t * cx + t * t * tip[0], y = (1 - t) * (1 - t) * butt[1] + 2 * (1 - t) * t * cy + t * t * tip[1]; pts.push([x, y]); }
    const tip2 = pts[40], dark = mix(rod.col, "#000000", 0.45);
    pts.forEach(([x, y], i) => { img.px(x, y, i < 8 ? dark : rod.col); if (i < 6) img.px(x + 1, y, dark); });
    if (p.r.tier === 1) { for (const k of [14, 26]) img.px(pts[k][0], pts[k][1], "#ecc56a"); img.rect(R(pts[5][0]), R(pts[5][1]) + 1, 2, 2, "#c8963e"); }
    return tip2;
  }
  function drawLine(img, from, to, slack, a, col) {
    const n = Math.max(2, R(Math.hypot(to[0] - from[0], to[1] - from[1])));
    for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(from[0], to[0], t), y = lerp(from[1], to[1], t) + (slack || 0) * 4 * t * (1 - t); img.px(x, y, col || "#f4ecda", a === undefined ? 0.8 : a); }
  }
  function bobber(img, x, y, dip) {
    x = R(x); y = R(y + (dip || 0));
    img.rect(x - 1, y - 3, 3, 2, "#c8321e"); img.px(x, y - 4, "#e8e0d0"); img.rect(x - 1, y - 1, 3, 1, "#f4efe2"); img.px(x - 1, y - 3, "#e85a3a");
  }
  function lure(img, p, x, y, t) {
    const l = p.r.lure;
    if (l === "lure_spinner") { img.px(x, y, (t * 8) % 2 < 1 ? "#ffe08a" : "#c8963e"); img.px(x + 1, y, "#c8963e"); img.px(x, y + 1, "#8a6a2a"); }
    else if (l === "lure_fly") { img.px(x, y, "#3a6ab0"); img.px(x - 1, y - 1, "#d8c8a0"); img.px(x + 1, y - 1, "#a0583a"); }
    else { img.px(x, y, "#d86a7a"); img.px(x, y + 1, "#c85a6a"); img.px(x + 1, y + 1, "#d86a7a"); }
  }

  // ---------- passers-by, thieves and odd things ----------
  function duck(img, x, y, s, t, young) {
    const b = young ? "#c8a84a" : "#7a5434", hd = young ? "#d8b84a" : "#3f6a2c", k = young ? 0 : 1;
    img.rect(x, y - 2 - k, 5 + k * 2, 2 + k, b); img.px(x + (s > 0 ? 5 + k * 2 : -1), y - 4 - k, hd); img.px(x + (s > 0 ? 4 + k * 2 : 0), y - 4 - k, hd);
    img.px(x + (s > 0 ? 6 + k * 2 : -2), y - 3 - k, "#e0a030"); img.px(x + (s > 0 ? 0 : 4 + k * 2), y - 3 - k + (R(t * 4) % 2), b);
  }
  function gull(img, x, y, t, sit) {
    if (sit) { img.rect(x, y - 4, 5, 3, "#f0f0ea"); img.rect(x + 4, y - 6, 3, 3, "#f0f0ea"); img.px(x + 7, y - 5, "#e0a030"); img.px(x + 5, y - 5, "#1a1a1a"); img.rect(x, y - 4, 3, 1, "#8a9098"); img.px(x + 2, y - 1, "#e0a030"); img.px(x + 4, y - 1, "#e0a030"); return; }
    const f = Math.sin(t * 14) > 0;
    img.px(x, y, "#f4f4ee"); img.px(x - 1, y - (f ? 1 : 0), "#f4f4ee"); img.px(x + 1, y - (f ? 1 : 0), "#f4f4ee"); img.px(x - 2, y - (f ? 2 : 0), "#d8d8d0"); img.px(x + 2, y - (f ? 2 : 0), "#d8d8d0");
  }
  function heron(img, x, y, t, stab, flip) {
    const s = flip ? -1 : 1, g = "#8a949c", d = "#5a646c";
    for (let j = 0; j < 7; j++) img.px(x + s * 1, y - j, "#4a4a42");
    img.rect(x - 3, y - 13, 8, 6, g); img.rect(x - 3, y - 13, 3, 6, d);
    const nx = x + s * (stab ? 7 : 3), ny = y - (stab ? 10 : 18);
    img.line(x + s * 3, y - 12, nx, ny, "#d8dcdc"); img.rect(nx - 1, ny - 2, 3, 3, "#e8ecec"); img.px(nx, ny - 2, "#1a1a1a");
    img.line(nx + s * 1, ny, nx + s * (stab ? 6 : 5), ny + (stab ? 4 : 1), "#d8a030");
  }
  function otter(img, x, y, up) {
    const c = "#5a3a22", l = "#8a6a4a";
    img.rect(x - 2, y - up, 5, up + 1, c); img.rect(x - 3, y - up - 3, 7, 4, c); img.px(x - 1, y - up - 2, "#120a06"); img.px(x + 2, y - up - 2, "#120a06"); img.rect(x - 1, y - up, 3, 1, l); img.px(x - 3, y - up - 3, l); img.px(x + 3, y - up - 3, l);
  }
  function fox(img, x, y, t, sit, flip) {
    const s = flip ? -1 : 1, c = "#c8662a", w = "#f0e8d8";
    if (sit) { img.rect(x - 3, y - 8, 6, 8, c); img.rect(x - 2, y - 4, 3, 4, w); img.rect(x - 3 + s, y - 12, 6, 4, c); img.px(x - 3 + s, y - 13, c); img.px(x + 2 + s, y - 13, c); img.px(x + s * 3, y - 10, "#1a1010"); img.px(x - 1, y - 10, "#1a1010"); img.px(x + 1, y - 10, "#1a1010"); for (let k = 0; k < 6; k++) img.px(x - s * (4 + k), y - 1 - R(Math.sin(t * 3 + k * 0.5) * 1), k > 3 ? w : c); return; }
    const leg = R(t * 10) % 2;
    img.rect(x - 5, y - 6, 10, 4, c); img.rect(x + s * 4, y - 9, 5, 4, c); img.px(x + s * 8, y - 7, "#1a1010"); img.px(x + s * 5, y - 10, c);
    for (let k = 0; k < 6; k++) img.px(x - s * (6 + k), y - 5 + (k > 2 ? -1 : 0), k > 3 ? w : c);
    img.px(x - 4, y - 2 + leg, "#2a1a10"); img.px(x + 3, y - 2 + (1 - leg), "#2a1a10"); img.px(x - 3, y - 2 + (1 - leg), "#2a1a10"); img.px(x + 2, y - 2 + leg, "#2a1a10");
  }
  function crab(img, x, y, t) {
    const c = "#e8d4c8", d = "#b89a8a", o = R(t * 6) % 2;
    img.rect(x - 4, y - 4, 9, 3, c); img.rect(x - 3, y - 5, 7, 1, c); img.rect(x - 4, y - 2, 9, 1, d);
    img.px(x - 6, y - 6 - o, c); img.px(x - 5, y - 6 - o, c); img.px(x + 5, y - 6 - (1 - o), c); img.px(x + 6, y - 6 - (1 - o), c);
    for (const k of [-3, -1, 2, 4]) img.px(x + k, y - 1, d);
    img.px(x - 1, y - 6, "#1a1010"); img.px(x + 2, y - 6, "#1a1010");
  }
  function hare(img, x, y, t) { img.rect(x - 3, y - 5, 7, 5, "#f0f2f0"); img.rect(x + 2, y - 8, 3, 3, "#f0f2f0"); img.px(x + 2, y - 11, "#e0e4e4"); img.px(x + 2, y - 10, "#e0e4e4"); img.px(x + 3, y - 10 - (R(t * 2) % 2), "#e0e4e4"); img.px(x + 4, y - 7, "#1a1010"); }
  const PETS = {};
  function pet(img, kind, name, x, y, t, flip) {
    let spr = null;
    try { if (root.Art && root.Art.petGrid) spr = gridImg(root.Art.petGrid({ kind, name: name || kind }, R(t * 8) % 2)); } catch (e) { spr = null; }
    if (!spr) { spr = PETS[kind] || (PETS[kind] = (() => { const im = new Img(14, 10), c = kind === "dog" ? "#a8784a" : "#c87a3a"; im.rect(2, 4, 9, 4, c); im.rect(9, 1, 4, 4, c); im.px(9, 0, c); im.px(12, 0, c); im.px(1, 3, c); im.px(0, 2, c); im.rect(3, 8, 1, 2, c); im.rect(9, 8, 1, 2, c); im.px(11, 2, "#120a06"); K.outline(im, "#120a06"); return im; })()); }
    blit(img, spr, x - spr.w / 2, y - spr.h, 1, flip);
  }
  function junkArt(img, kind, x, y, frog, t) {
    if (kind === "kettle") { img.rect(x - 4, y - 6, 9, 6, "#4a4e52"); img.rect(x - 3, y - 7, 7, 1, "#5a5e62"); img.line(x + 5, y - 4, x + 8, y - 7, "#4a4e52"); for (let i = -3; i <= 3; i++) img.px(x + i, y - 10 + Math.abs(i) * 0.6, "#3a3e42"); img.rect(x - 3, y - 5, 2, 3, "#6a6e72"); img.px(x + 2, y - 2, "#8a5a2a"); }
    else if (kind === "hat") { img.rect(x - 6, y - 2, 13, 2, "#3a2a20"); img.rect(x - 3, y - 7, 7, 5, "#4a3628"); img.rect(x - 3, y - 4, 7, 1, "#8a2a20"); img.px(x + 2, y - 8, "#5a7a3a"); img.px(x + 3, y - 9, "#5a7a3a"); }
    else if (kind === "horseshoe") { for (let a = 0; a <= 20; a++) { const an = Math.PI * (a / 20), xx = x + Math.cos(an) * 4, yy = y - 2 - Math.sin(an) * 5; img.px(xx, yy, "#6a5a4a"); img.px(xx, yy + 1, "#8a7a68"); } img.px(x - 4, y - 1, "#7a4a2a"); img.px(x + 4, y - 1, "#7a4a2a"); }
    else {
      img.rect(x - 2, y - 9, 5, 7, "#4a3420"); img.rect(x - 2, y - 3, 9, 3, "#4a3420"); img.rect(x - 2, y, 9, 1, "#2a1b11"); img.rect(x - 2, y - 9, 5, 1, "#2a1b11"); img.px(x, y - 6, "#6a4a30"); img.px(x + 4, y - 2, "#6a4a30");
      if (frog) { const up = R(frog * 3); img.rect(x - 2, y - 10 - up, 5, 2 + up, "#5a8a3a"); img.px(x - 2, y - 11 - up, "#5a8a3a"); img.px(x + 2, y - 11 - up, "#5a8a3a"); img.px(x - 2, y - 12 - up, "#e8e0a0"); img.px(x + 2, y - 12 - up, "#e8e0a0"); img.px(x - 1, y - 10 - up + (t % 0.8 < 0.3 ? 1 : 0), "#c8d870"); }
    }
  }
  function bottle(img, x, y, ang) {
    for (let i = -6; i <= 6; i++) for (let k = -2; k <= 2; k++) { const nk = i > 3 ? Math.min(Math.abs(k), 1) === Math.abs(k) : true; if (!nk) continue; img.px(x + i * Math.cos(ang || 0) - k * Math.sin(ang || 0), y + i * Math.sin(ang || 0) + k * Math.cos(ang || 0), Math.abs(k) === 2 ? "#2a5a3a" : k === -1 ? "#7ab890" : "#3a7a52", 0.9); }
    img.px(x + 7 * Math.cos(ang || 0), y + 7 * Math.sin(ang || 0), "#8a6a3a");
    img.px(x - 1, y, "#e8dcc0"); img.px(x, y, "#e8dcc0"); img.px(x + 1, y, "#e8dcc0");
  }
  function key(img, x, y, glint) {
    for (let a = 0; a < 16; a++) { const an = (a / 16) * TAU; img.px(x - 4 + Math.cos(an) * 3, y + Math.sin(an) * 3, "#c8963e"); }
    img.rect(x - 1, y, 9, 1, "#c8963e"); img.rect(x - 1, y + 1, 9, 1, "#7a5420"); img.rect(x + 5, y + 2, 1, 2, "#c8963e"); img.rect(x + 7, y + 2, 1, 3, "#c8963e"); img.px(x - 4, y, "#5a8a7a");
    if (glint) star(img, x + 1, y - 1, "#fff6c8", 2, glint);
  }

  // ---------- the scene each frame: the backdrop, what moves in it, the weather ----------
  function shimmer(img, sc, t, x0, x1) {
    const y0 = sc.wl + 1, n = 26;
    for (let i = 0; i < n; i++) {
      const r = h2(i, 1, 77), y = y0 + 1 + Math.floor(Math.pow(h2(i, 2, 77), 1.6) * (sc.tank ? 6 : H - y0 - 3));
      const sp = sc.kind === "river" || sc.id === "stream" ? 9 : 2.5, x = ((r * W + t * sp * (0.5 + r)) % (W + 20)) - 10, l = 2 + R(h2(i, 3, 77) * 5);
      if (x < (x0 || 0) || x > (x1 || W)) continue;
      const ph = (t * 0.7 + r * 5) % 2;
      if (ph > 1.4) continue;
      for (let k = 0; k < l; k++) img.px(x + k, y, "#ffffff", 0.22);
    }
  }
  function shafts(img, sc, t) {
    if (!sc.tank) return;
    const bed = H - 10, cave = sc.kind === "cave", a = sc.tod === "night" ? 0.04 : cave ? 0.06 : 0.09;
    for (let k = 0; k < 4; k++) {
      const x0 = 40 + k * 55 + Math.sin(t * 0.4 + k) * 10, w = 8 + (k % 2) * 5;
      for (let y = sc.wl + 2; y < bed; y++) { const f = 1 - (y - sc.wl) / (bed - sc.wl), xs = x0 + (y - sc.wl) * 0.35; for (let i = 0; i < w; i++) if (bay(R(xs + i), y) < f * 0.6) img.px(xs + i, y, "#ffffff", a); }
    }
    if (sc.glowWater) for (let i = 0; i < 18; i++) { const ph = (t * 0.25 + h2(i, 4, 9)) % 1, x = h2(i, 5, 9) * W, y = H - 12 - ph * (H - 12 - sc.wl); img.px(x + Math.sin(ph * 9 + i) * 2, y, "#bfffe8", 0.6 * (1 - ph)); }
  }
  function weather(img, p, t) {
    const sc = p.sc, wx = sc.wx, r = p.r;
    if (sc.kind === "cave") {
      for (let i = 0; i < 10; i++) { const ph = (t * 0.6 + h2(i, 1, 5)) % 1, x = h2(i, 2, 5) * W, y = h2(i, 3, 5) * sc.wl; img.px(x, y + ph * 4, "#c8e8e0", 0.25 * (1 - ph)); }
      return;
    }
    if (wx === "rain" || wx === "storm") {
      const n = wx === "storm" ? 90 : 55, c = sc.tod === "night" ? "#8898a8" : "#c8d4dc";
      for (let i = 0; i < n; i++) { const sp = 140 + h2(i, 1, 3) * 60, x = (h2(i, 2, 3) * (W + 40) - (t * sp * 0.25)) % (W + 40), y = (h2(i, 4, 3) * H + t * sp) % H; const xx = ((x % (W + 40)) + W + 40) % (W + 40) - 20; img.px(xx, y, c, 0.55); img.px(xx - 1, y + 2, c, 0.4); if (y > sc.wl && y < sc.wl + 3 && !sc.tank) rings(img, xx, sc.wl + 2 + h2(i, 6, 3) * 20, (t * 1.5 + h2(i, 5, 3)) % 1, c, 1); }
      if (wx === "storm") { const f = (t + (r.seed % 7)) % 5.3; if (f < 0.09 || (f > 0.16 && f < 0.21)) for (let i = 0; i < img.d.length; i += 4) { img.d[i] = Math.min(255, img.d[i] * 1.5 + 30); img.d[i + 1] = Math.min(255, img.d[i + 1] * 1.5 + 34); img.d[i + 2] = Math.min(255, img.d[i + 2] * 1.5 + 40); } }
    } else if (wx === "snow") {
      for (let i = 0; i < 60; i++) { const sp = 10 + h2(i, 1, 4) * 10, y = (h2(i, 2, 4) * H + t * sp) % H, x = (h2(i, 3, 4) * W + Math.sin(t + i) * 4 + W) % W; img.px(x, y, "#ffffff", 0.85); if (h2(i, 5, 4) > 0.7) img.px(x + 1, y, "#ffffff", 0.5); }
    } else if (wx === "fog") {
      for (let b = 0; b < 4; b++) { const y0 = 30 + b * 26, off = t * (3 + b) + b * 40; for (let y = y0; y < y0 + 12; y++) for (let x = 0; x < W; x++) { const v = fbm((x + off) / 30, y / 8, 31 + b, 2); if (v > 0.52) img.px(x, y, "#d8dad0", (v - 0.52) * 1.4 * (1 - Math.abs(y - y0 - 6) / 7)); } }
    } else if (wx === "heat") {
      for (let i = 0; i < 6; i++) { const y = sc.wl - 4 - i * 3; for (let x = 0; x < W; x += 2) if (Math.sin(x * 0.3 + t * 4 + i) > 0.85) img.px(x, y, "#fff4d0", 0.18); }
    }
    if (sc.tod === "night" && (sc.kind === "swamp" || sc.kind === "lake" || sc.id === "stream")) for (let i = 0; i < 8; i++) { const ph = (t * 0.3 + h2(i, 1, 8)) % 1, x = 110 + h2(i, 2, 8) * 120 + Math.sin(t + i) * 6, y = sc.wl - 8 - h2(i, 3, 8) * 30 + Math.sin(t * 1.3 + i) * 3; if (ph < 0.6) { img.px(x, y, "#f0ff9a", Math.sin((ph / 0.6) * Math.PI)); } }
  }
  function ambient(img, p, t) {
    const sc = p.sc;
    if (p.r.where === "contest") {
      const cols = ["#c8321e", "#ecc56a", "#2f5a7a", "#f4efe2", "#3f6a2c"];
      for (let x = 0; x < W; x++) { const y = 8 + Math.sin((x / W) * Math.PI) * 10; img.px(x, y, "#2a1a10"); if (x % 12 === 2) for (let j = 0; j < 6; j++) for (let i = 0; i < 6 - j; i++) img.px(x + i + R(Math.sin(t * 3 + x) * (j / 6)), y + 1 + j, cols[(x / 12 | 0) % cols.length]); }
      img.rect(4, 22, 54, 12, "#5a3a1c"); img.rect(5, 23, 52, 10, "#e8d6ae"); text(img, "CONTEST", 31, 31, "#8a2a20", { bold: true, center: true });
    }
    if (sc.flag) { const [fx, fy] = sc.flag; img.rect(fx, fy, 1, 9, "#3a2412"); for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) img.px(fx + 1 + i, fy + j + R(Math.sin(t * 6 + i * 0.9) * 0.8 * (i / 6)), j < 2 ? "#9a2a20" : "#c8963e"); }
    if (sc.foam) for (const [x, y] of sc.foam) for (let i = 0; i < 9; i++) { const ph = (t * 0.8 + i * 0.13 + x) % 1; img.px(x + i * 1.6 - 6, y - Math.sin(ph * Math.PI) * 4, "#f4f8f4", 0.8 * (1 - ph)); }
    if (sc.boat) { const [bx, by] = sc.boat, dy = R(Math.sin(t * 1.4) * 1); for (let i = 0; i < 34; i++) { const d = i < 4 ? 4 - i : i > 29 ? i - 29 : 0; for (let j = d; j < 6; j++) img.px(bx + i, by + j + dy, j === d ? "#c8b48a" : j < 3 ? "#2f5a7a" : "#3a2412"); } img.rect(bx + 16, by - 22 + dy, 1, 22, "#5a3a20"); for (let j = 0; j < 14; j++) for (let i = 0; i < R(j * 0.7); i++) img.px(bx + 17 + i, by - 20 + j + dy, "#e8dcc4"); }
    if (sc.oldmen) sc.oldmen.forEach(([x, y], i) => { const c = i ? "#4a4a5a" : "#5a4a3a"; img.rect(x - 3, y - 8, 7, 6, c); img.rect(x - 4, y - 3, 10, 3, "#2a2420"); img.rect(x - 2, y - 13, 5, 5, "#c8986a"); img.rect(x - 3, y - 14, 7, 2, "#2a2a2a"); img.px(x + 1, y - 11, "#1a1010"); if (!i) { img.px(x + 3, y - 10, "#5a3a20"); img.px(x + 4, y - 10, "#5a3a20"); for (let k = 0; k < 5; k++) { const ph = (t * 0.5 + k * 0.2) % 1; img.px(x + 5 + Math.sin(ph * 6) * 1.5, y - 12 - ph * 10, "#d8d8d0", 0.5 * (1 - ph)); } } });
    if (sc.wheel) {
      const [cx, cy, rr] = sc.wheel, a0 = -t * 0.9;
      for (let k = 0; k < 10; k++) { const a = a0 + (k / 10) * TAU; for (let s = 3; s <= rr; s++) img.px(cx + Math.cos(a) * s, cy + Math.sin(a) * s, "#4a3018"); const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; img.rect(R(px) - 1, R(py) - 1, 3, 3, "#6e4a28"); }
      for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU; img.px(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, "#3a2410"); img.px(cx + Math.cos(a) * (rr - 1), cy + Math.sin(a) * (rr - 1), "#54361c"); }
      img.rect(cx - 2, cy - 2, 5, 5, "#2a1a0c");
      for (let i = 0; i < 6; i++) { const ph = (t * 1.2 + i / 6) % 1; img.px(cx - rr + 2 + i * 2, sc.wl - ph * 8, "#e8f4f4", 0.7 * (1 - ph)); }
    }
    if (sc.lantern) { const [lx, ly] = sc.lantern, f = 0.25 + 0.06 * Math.sin(t * 9) + 0.04 * Math.sin(t * 23); K.light(img, lx, ly, 26, "#ffb048", f * 0.4); }
  }
  // the legend: a cruising shadow in the tank, or a pass under the surface side on
  function legendShadow(img, p, x, y, face, a, phase) {
    const lg = p.r.lg;
    if (!lg) return;
    const sc = p.sc, col = mix(FA.WATERS_PAL[sc.id] ? FA.WATERS_PAL[sc.id][3] : FA.WATERS_PAL[p.r.kind][3], "#000000", 0.55);
    const sh = FA.species(lg.species).shape, len = sc.tank ? (sh === "deep" || sh === "round" ? 64 : 84) : 70;
    const f = FA.fish(lg.species, { len, shadow: col, face, phase, legend: lg.id });
    const x0 = R(x - f.w / 2), y0 = R(y - f.h / 2), wx0 = sc.wx0 || 0;
    // side on, the shadow is only seen through the water, never over a bank or a wall
    for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) { const X = x0 + i, Y = y0 + j; if (!f.d[(j * f.w + i) * 4 + 3] || (!sc.tank && (X < wx0 || Y <= sc.wl + 1))) continue; img.px(X, Y, col, a * (sc.tank ? 0.75 : 1)); }
    if (p.sc.tank && a > 0.5) img.px(R(x + face * (f.w / 2 - 8)), R(y - 3), "#e8d070", a);
  }

  // ---------- the tank's fish (D): every species of the water, swimming their lanes ----------
  function tankFish(r, sc) {
    const F = SF(), list = Object.values(F.species || {}).filter((s) => s.kind === r.kind);
    if (!list.length) list.push(r.sp);
    if (r.outcome !== "nothing" && !r.outcome.startsWith("legend") && r.outcome !== "junk" && !(r.outcome === "strange" && r.strange !== "whiskers") && !list.find((s) => s.id === r.sp.id)) list.push(r.sp);
    const rr = rng(r.seed + 11), x0 = sc.tx0 || 10, x1 = 230, out = [];
    list.sort((a, b) => b.weight - a.weight);
    list.forEach((s, i) => { const n = i === 0 ? 2 : 1; for (let k = 0; k < n; k++) out.push({ sp: s, y: sc.wl + 14 + rr() * (H - sc.wl - 30), cx: lerp(x0 + 30, x1 - 30, rr()), amp: 20 + rr() * 50, w: 0.25 + rr() * 0.35, ph: rr() * TAU, len: clamp(R(FA.heldLen(s.mid) * 0.72), 7, 26) }); });
    for (const f of out) f.amp = Math.max(4, Math.min(f.amp, f.cx - x0 - 12, x1 - f.cx));
    const hooked = out.findIndex((f) => f.sp.id === r.sp.id);
    return { list: out, hooked };
  }
  function fishAt(f, t) {
    const x = f.cx + Math.sin(t * f.w + f.ph) * f.amp, vx = Math.cos(t * f.w + f.ph), y = f.y + Math.sin(t * 0.7 + f.ph * 2) * 2;
    return { x, y, face: vx >= 0 ? 1 : -1 };
  }
  function drawFish(img, sp, x, y, face, t, len, o) {
    const f = FA.fish(sp, Object.assign({ len, face, phase: t * 7 }, o || {}));
    if (sp.pattern === "glow") glow(img, x, y, len * 0.7, sp.pal.fin, 0.25);
    blit(img, f, x - f.w / 2, y - f.h / 2);
    return f;
  }

  // ---------- the plan: beats from the record ----------
  function plan(rec, opts) {
    const r = norm(rec), rr = rng(r.seed);
    const sc = FA.scene(r), dusk = r.outcome === "nothing" ? FA.scene(r, { tod: r.night ? "night" : "dusk" }) : null;
    const cast = castOf(r, opts), seat = !!sc.perch.seat;
    const spr = seat ? cast.hero.seat : cast.hero.stand, sx = R(sc.perch.x - spr.w / 2), sy = sc.perch.y - spr.h;
    const p = { r, sc, dusk, cast, seat, sx, sy, hand: [sx + 21, sy + 20], tf: sc.tank ? tankFish(r, sc) : null, ev: [] };
    const big = clamp(Math.log(r.size / 8) / Math.log(150 / 8), 0, 1);
    p.big = big;
    p.hookY = sc.tank ? R(sc.wl + 24 + rr() * 22) : sc.bob[1];
    p.nibbles = 1 + Math.floor(rr() * 3);
    p.gagOn = rr();
    const o = r.outcome, leg = o.startsWith("legend");
    const fight = leg ? 4.8 : o === "junk" ? 1.5 : o === "strange" ? (r.strange === "whiskers" ? 2.4 : 1.4) : o === "nothing" ? 0 : (o === "away" ? 0.8 : 1) * (1.1 + 3.4 * big);
    const B = [];
    const add = (id, dur, sfx) => B.push({ id, dur, sfx: sfx || [] });
    add("place", 2.4, [[0.05, sc.kind === "sea" ? "waves" : sc.kind === "cave" ? "cave" : "water", 30]]);
    add("cast", 1.8, [[0.4, "swish"], [1.05, "plop"]]);
    const wait = o === "nothing" ? 4.6 : 2.6 + rr() * 1.8;
    add("wait", wait, gagSfx(p, wait));
    if (o === "nothing") { add("ignore", 2.6, [[0.6, "tick"], [1.6, "tick"]]); add("nap", 4.2, [[0.4, "snore"], [2.2, "snore"]]); }
    else {
      const nb = [];
      for (let i = 0; i < p.nibbles; i++) nb.push([0.5 + i * 0.5, "tick"]);
      add("nibble", 0.9 + p.nibbles * 0.5, nb);
      add("strike", 0.9, [[0.05, leg ? "bigsplash" : "splash"], [0.1, "zing"]]);
      add("fight", fight, [[0, "reel", fight]]);
      if (o === "away") add("away", 4.2, [[0.3, "splash"], [0.5, "ping"], [1.4, "sad"]]);
      else if (o === "legend_away") add("snap", 4.6, [[0.05, "snap"], [0.4, "bigsplash"], [1.6, "sad"]]);
      else {
        add("out", leg ? 2.2 : 1.7, [[0.05, leg ? "bigsplash" : "splash"]]);
        if (o === "catch" || o === "legend_caught") add("ruler", 4.6, [[0.2, "thud"], [0.9, "count"], [2.0, leg ? "fanfare" : r.rare ? "sparkle" : "reveal"]]);
        else if (o === "junk") add("junk", 4.0, r.junk === "boot" ? [[0.9, "croak"], [2.2, "croak"]] : [[0.4, "clink"]]);
        else if (o === "stolen") add("stolen", 4.2, [[0.6, thiefCry(r.thief.kind)], [1.3, "gasp"]]);
        else if (r.strange === "whiskers") add("whiskers", 4.6, [[0.3, "blub"], [3.6, "splash"]]);
        else if (r.strange === "key") add("key", 4.0, [[0.4, "chime"]]);
        else add("letter", 4.6, [[0.2, "cork"], [0.6, "unroll"]]);
      }
    }
    let t0 = 0;
    for (const b of B) { b.t0 = t0; b.t1 = t0 + b.dur; for (const [at, name, v] of b.sfx) p.ev.push([t0 + at, name, v]); t0 += b.dur; }
    p.ev.sort((a, b) => a[0] - b[0]);
    p.beats = B; p.dur = t0;
    return p;
  }
  const thiefCry = (k) => ({ cat: "meow", dog: "bark", gull: "caw", heron: "caw", otter: "chitter", fox: "yip", crab: "clack" })[k] || "caw";
  function gagSfx(p, wait) {
    const id = p.sc.id;
    if (id === "greenwood" || id === "kingsroad" || id === "thornwall") return [[wait * 0.35, "quack"]];
    if (id === "saltcliffs" || id === "saltmarrow") return [[wait * 0.3, "caw"]];
    if (id === "collapsed_mine") return [[wait * 0.3, "drip"], [wait * 0.7, "drip"]];
    if (id === "bleakmarsh") return [[wait * 0.5, "croak"]];
    if (id === "carrbridge") return [[wait * 0.2, "creak"]];
    return [];
  }

  // ---------- drawing one moment ----------
  // st: what the beat sets: pose ("rod" | "lift" | "wide" | "high" | "sleep" | "back"), angle, bend, line ("slack" | "taut" | "none"),
  // to (where the line ends), bob ({ x, y, dip, under }), hook ([x, y] in a tank), fish (drawn in the tank), held, mark, bubble
  function stage(img, p, t, st) {
    const r = p.r, sc = p.sc;
    shafts(img, sc, t);
    shimmer(img, sc, t, 0, W);
    ambient(img, p, t);
    if (st.gag) st.gag(img);
    if (sc.tank && p.tf) p.tf.list.forEach((f, i) => { if (st.skipFish === i) return; const q = fishAt(f, t), dx = st.flee ? Math.sign(q.x - sc.bob[0]) * st.flee * 60 : 0; drawFish(img, f.sp, q.x + dx, q.y, q.face, t, f.len); });
    if (sc.tank && st.items !== false) items(img, p, t, st);
    if (r.legendLive && st.legend !== false) {
      if (sc.tank && !st.legendGone) { const lx = 120 + Math.sin(t * 0.18 + 1) * 70, face = Math.cos(t * 0.18 + 1) >= 0 ? 1 : -1; legendShadow(img, p, st.legendX !== undefined ? st.legendX : lx, st.legendY !== undefined ? st.legendY : H - 26, st.legendFace || face, st.legendA === undefined ? 0.75 : st.legendA, t * 3); }
      else if (!sc.tank && st.legendPass !== undefined) { const u = st.legendPass; if (u > 0 && u < 1) legendShadow(img, p, lerp(W + 50, (sc.wx0 || 0) - 50, u), sc.passY || sc.wl + 16, -1, 0.42 * Math.sin(u * Math.PI), t * 3); }
    }
    if (st.under) st.under(img);
    crewDraw(img, p, t, st);
    heroDraw(img, p, t, st);
    if (st.over) st.over(img);
    weather(img, p, t);
    if (st.mark) mark(img, st.mark[0], R(p.sc.perch.x + 6), p.sy - 14, st.mark[1]);
    if (st.bubble) bubble(img, st.bubble[0], st.bubble[2] || p.sc.perch.x, st.bubble[3] || p.sy - 4, st.bubble[1], st.bubble[4]);
  }
  function items(img, p, t, st) {
    const r = p.r, sc = p.sc, bx = sc.bob[0];
    const oi = p.beats.findIndex((b) => b.id === "out");
    if (st.itemHidden || (oi >= 0 && p.bi >= oi)) return;
    if (r.outcome === "junk") junkArt(img, r.junk, bx + 6, H - 10, 0, t);
    if (r.outcome === "strange" && r.strange === "key") key(img, bx + 4, H - 12, (t % 2.2) < 0.4 ? 1 : 0);
    if (r.outcome === "strange" && r.strange === "letter") bottle(img, bx + 18 + Math.sin(t * 0.6) * 12, sc.wl + 20 + Math.sin(t * 0.9) * 3, Math.sin(t * 0.7) * 0.4);
  }
  function crewDraw(img, p, t, st) {
    p.cast.crew.forEach((c, i) => {
      const pos = p.sc.crew[i];
      if (!pos) return;
      const spr = p.seat ? c.seat : c.stand, hop = st.cheer ? R(Math.abs(Math.sin(t * 9 + i)) * 2) : 0;
      blit(img, spr, pos[0] - spr.w / 2, pos[1] - spr.h - hop);
    });
  }
  function heroDraw(img, p, t, st) {
    const hero = p.cast.hero, pose = st.pose || "rod";
    const dx = st.lean ? R(st.lean) : 0, x = p.sx + dx, y = p.sy;
    if (p.seat && (pose === "rod" || pose === "lift" || pose === "back")) { img.rect(x + 4, y + 22, 12, 12, "#4a2e18"); img.rect(x + 4, y + 22, 12, 1, "#7a5434"); }
    if (pose === "sleep") {
      const s = hero.seat;
      img.rect(x + 4, y + 22, 12, 12, "#4a2e18");
      blit(img, s, x, y + 1);
      const tip = [x + 34, y + 12];
      drawLine(img, [x + 20, y + 22], tip, 0, 1, "#8a6a3a");
      drawLine(img, tip, [p.sc.bob[0], p.sc.bob[1] - 2], 6, 0.6);
      bobber(img, p.sc.bob[0], p.sc.bob[1], Math.sin(t * 1.5) * 0.6);
      const zt = t % 2.4;
      for (let k = 0; k < 2; k++) { const u = (zt / 2.4 + k * 0.5) % 1; text(img, "z", x + 16 + u * 10, y + 4 - u * 16, "#f6ead0", { outline: "#1a0e08" }); }
      return;
    }
    if (pose === "wide" || pose === "high") {
      const a = hero.arms, sl = a.sleeve || [90, 60, 40], skin = C(hero.skin);
      blit(img, a, x, y);
      const sh = [[x + a.x0 + 2, y + 16], [x + a.x1 - 2, y + 16]];
      const ends = pose === "wide" ? [[x - 9 - R(st.spread || 0), y + 13], [x + 37 + R(st.spread || 0), y + 13]] : [[x + 6, y - 3], [x + 22, y - 3]];
      sh.forEach((s, i) => { const e = ends[i]; for (let k = 0; k <= 1; k++) img.line(s[0], s[1] + k, e[0], e[1] + k, sl); img.line(s[0], s[1] - 1, e[0], e[1] - 1, "#120e0b"); img.line(s[0], s[1] + 2, e[0], e[1] + 2, "#120e0b"); img.rect(e[0] - 1, e[1] - 1, 3, 3, skin); });
      if (st.held) st.held(img, x, y);
      return;
    }
    const spr = p.seat ? hero.seat : hero.stand;
    blit(img, spr, x, y);
    if (pose === "none") return;
    const angle = pose === "lift" ? 82 : pose === "back" ? 118 : st.angle || 52;
    const hd = p.hand;
    p.hand = [hd[0] + dx, hd[1]];
    const tip = drawRod(img, p, { angle, bend: st.bend || 0 });
    p.hand = hd;
    if (st.line === "none") return;
    const to = st.to || [p.sc.bob[0], p.sc.bob[1] - 2];
    drawLine(img, tip, to, st.line === "taut" ? 0 : st.slack === undefined ? 10 : st.slack, 0.85);
    if (st.bob !== false) {
      const b = st.bob || {};
      if (!b.under) bobber(img, b.x !== undefined ? b.x : p.sc.bob[0], b.y !== undefined ? b.y : p.sc.bob[1], b.dip || 0);
      if (p.sc.tank && st.hook !== false) { const hk = st.hook || [p.sc.bob[0], p.hookY]; drawLine(img, [b.x !== undefined ? b.x : p.sc.bob[0], p.sc.bob[1] + 1], hk, 0, 0.35, "#e8f0f0"); lure(img, p, R(hk[0]), R(hk[1]), t); }
    }
  }

  // ---------- the beats ----------
  function placeLabel(p) {
    const r = p.r, F = SF(), w = (F.waters || {})[r.water];
    let s = (r.at || (w ? w.name : "a stream by the road")).replace(/^the /i, "");
    const wx = { rain: "drizzle", storm: "a storm", fog: "fog", snow: "snow", heat: "a hot day", cloudy: "grey skies" }[r.sky] || ({ night: "night", dusk: "dusk", morning: "morning", day: "midday" })[p.sc.tod];
    return `${s}, ${r.night && wx !== "night" ? wx + ", night" : wx}`.toUpperCase();
  }
  function waitLabel(p) {
    const r = p.r;
    if (r.outcome === "nothing") return "THREE HOURS LATER";
    return { rain: "AN HOUR. MORE DRIZZLE.", storm: "AN HOUR. STILL THUNDER.", snow: "AN HOUR. MORE SNOW.", fog: "AN HOUR IN THE FOG", heat: "AN HOUR. HOT." }[r.sky] || (r.night ? "AN HOUR. THE MOON MOVES." : "AN HOUR LATER");
  }
  function gag(p, u, t) {
    const sc = p.sc, id = sc.id, wl = sc.wl;
    return (img) => {
      if (id === "carrbridge") { const bx = lerp(W + 10, -60, u); for (let i = 0; i < 46; i++) { const d = i < 4 ? 4 - i : i > 41 ? i - 41 : 0; for (let j = d; j < 6; j++) img.px(bx + i, wl - 2 + j, j === d ? "#a8885a" : "#4a2e18"); } img.rect(bx + 26, wl - 9, 12, 7, "#6e4a28"); img.rect(bx + 27, wl - 10, 10, 1, "#8a6236"); img.rect(bx + 12, wl - 12, 5, 6, "#3a5a7a"); img.rect(bx + 12, wl - 15, 5, 3, "#c8986a"); img.line(bx + 18, wl - 10, bx + 30, wl - 30, "#5a3a20"); }
      else if (id === "greenwood" || id === "kingsroad" || id === "thornwall" || id === "stream") {
        if (id === "stream" && p.r.kind !== "swamp") { const dx = sc.bob[0] + lerp(40, 0, seg(u, 0, 0.5)) + (u > 0.75 ? (u - 0.75) * 160 : 0), dy = sc.bob[1] - 6 - (u < 0.5 ? (1 - u * 2) * 12 : u > 0.75 ? (u - 0.75) * 60 : 0); img.rect(dx - 3, dy, 6, 1, "#2f6a8a"); img.px(dx - 1, dy - 1, "#d8f0f0"); img.px(dx + 1, dy - 1, "#d8f0f0"); img.px(dx - 1, dy + 1, "#d8f0f0"); img.px(dx + 1, dy + 1, "#d8f0f0"); return; }
        const x = lerp(W + 20, sc.bob[0] - 70, u);
        duck(img, x, wl + 1, -1, t, false);
        if (id === "greenwood") for (let k = 1; k <= 3; k++) duck(img, x + k * 9, wl + 1, -1, t + k, true);
        if (id === "greenwood" && sc.tank) { const g = (t * 0.7) % 3; if (g < 0.5) star(img, 200, wl + 30, "#ffe08a", 2, Math.sin((g / 0.5) * Math.PI)); }
      } else if (id === "saltcliffs") { const lx = lerp(W + 10, sc.perch.x + 22, ease(seg(u, 0, 0.45))), ly = lerp(20, sc.perch.y, ease(seg(u, 0, 0.45))); if (u < 0.45) gull(img, lx, ly, t, false); else gull(img, sc.perch.x + 20, sc.perch.y, t, true); for (let i = 0; i < 12; i++) { const ph = (u * 2 + i * 0.07) % 1; if (u > 0.5 && ph < 0.4) img.px(150 + i * 5 + Math.sin(i) * 3, 110 + Math.sin(i * 2) * 6, "#e8f0f4", 1 - ph * 2); } }
      else if (id === "saltmarrow") { if (u < 0.4) gull(img, lerp(W, 120, u / 0.4), lerp(30, 86, u / 0.4), t, false); else gull(img, 116, sc.perch.y - 5, t, true); }
      else if (id === "frosthold" || id === "streamD") { const x = lerp(W + 14, sc.bob[0] + 30, ease(seg(u, 0, 0.6))); fox(img, x, sc.perch.y, t, u > 0.6, true); }
      else if (id === "whitepeak") { const x = lerp(W + 10, 196, ease(seg(u, 0, 0.5))); hare(img, x, sc.perch.y, t); }
      else if (id === "bleakmarsh") { const [ex, ey] = sc.eyes, open = (t % 2.2) > 0.25 && u > 0.2; if (open) { img.rect(ex, ey, 2, 2, "#e8d040"); img.rect(ex + 5, ey, 2, 2, "#e8d040"); img.px(ex + 1, ey + 1, "#1a1a08"); img.px(ex + 6, ey + 1, "#1a1a08"); } else if (u > 0.2) { img.rect(ex, ey + 1, 2, 1, "#5a5020"); img.rect(ex + 5, ey + 1, 2, 1, "#5a5020"); } }
      else if (id === "ashfen") { for (let k = 0; k < 4; k++) { const x = lerp(W + 10, 60, u) + k * 10, y = 96; img.rect(x, y - 8, 4, 8, "#141010"); img.rect(x + 1, y - 10, 2, 2, "#141010"); if (k === 0) { img.px(x - 1, y - 7, "#ffcf6a"); K.light(img, x - 1, y - 7, 6, "#ffb048", 0.5); } } }
      else if (id === "collapsed_mine") { for (const [d0] of [[0.3], [0.7]]) { const v = (u - d0) / 0.15; if (v > 0 && v < 1) img.px(sc.bob[0] + 30, lerp(10, wl, v), "#bfe8e8"); const w2 = (u - d0 - 0.15) / 0.3; if (w2 > 0 && w2 < 1) rings(img, sc.bob[0] + 30, wl + 1, w2, "#bfe8e8", 1); } if (u > 0.45) { const o = Math.min(1, (u - 0.45) * 4) * ((t % 3) > 0.2 ? 1 : 0.2); img.rect(206, H - 32, 7, R(3 * o) + 1, "#d8c040"); img.px(209, H - 31, "#120a06"); glow(img, 209, H - 31, 7, "#c8b040", 0.25 * o); } }
      else if (id === "sunken_vault") { for (let i = 0; i < 8; i++) { const ph = (u * 2 + i / 8) % 1; img.px(180 + i * 4 + Math.sin(ph * 8 + i) * 1.5, H - 12 - ph * (H - 12 - wl), "#d8fff0", 0.8 * (1 - ph)); } }
    };
  }
  const BEATS = {
    place(img, p, lt, T) {
      stage(img, p, T, { pose: "rod", angle: 70, line: "none", bob: false, hook: false });
      label(img, placeLabel(p), 6, 12, seg(lt, 0, 0.3));
    },
    cast(img, p, lt, T) {
      const u = lt / 1.8, sc = p.sc;
      if (u < 0.22) return stage(img, p, T, { pose: "back", line: "none", bob: false, hook: false });
      const v = seg(u, 0.22, 0.58), ang = lerp(118, 28, ease(seg(u, 0.22, 0.35)));
      const st = { pose: "rod", angle: u > 0.58 ? lerp(28, 50, seg(u, 0.58, 1)) : ang, line: "none", bob: false, hook: false };
      stage(img, p, T, Object.assign(st, {
        over(im) {
          const tip = rodTip(p, { angle: st.angle }), end = [sc.bob[0], sc.bob[1] - 2];
          if (u < 0.58) { const x = lerp(tip[0], end[0], v), y = lerp(tip[1], end[1], v) - Math.sin(v * Math.PI) * 30; for (let k = 0; k < 18; k++) { const w = Math.max(0, v - k * 0.02), xx = lerp(tip[0], end[0], w), yy = lerp(tip[1], end[1], w) - Math.sin(w * Math.PI) * 30; if (k % 2 === 0) im.px(xx, yy, "#f4ecda", 0.8); } drawLine(im, tip, [x, y], 6, 0.5); bobber(im, x, y + 3, 0); }
          else { drawLine(im, tip, end, lerp(18, 10, seg(u, 0.58, 1)), 0.85); bobber(im, end[0], end[1] + 2, Math.sin(seg(u, 0.58, 0.8) * 9) * 1.4 * (1 - seg(u, 0.58, 0.9))); rings(im, end[0], sc.bob[1] + 1, seg(u, 0.58, 1)); if (sc.tank) { const hy = lerp(sc.wl + 2, p.hookY, ease(seg(u, 0.62, 1))); drawLine(im, [end[0], sc.bob[1] + 1], [end[0], hy], 0, 0.35, "#e8f0f0"); lure(im, p, end[0], R(hy), T); } }
        },
      }));
    },
    wait(img, p, lt, T, b) {
      const u = lt / b.dur, sc = p.sc;
      const lift = sc.id === "carrbridge" && u > 0.55 && u < 0.85;
      stage(img, p, T, { pose: lift ? "lift" : "rod", line: lift ? "taut" : "slack", slack: lift ? 0 : 10, bob: { dip: Math.sin(T * 1.7) * 0.6 }, gag: gag(p, u, T), legendPass: seg(u, 0.15, 0.85) });
      label(img, waitLabel(p), 6, 12, seg(lt, 0, 0.3) * (1 - seg(lt, b.dur - 0.4, b.dur)));
    },
    ignore(img, p, lt, T) {
      const u = lt / 2.6, sc = p.sc;
      const st = { pose: "rod", bob: { dip: Math.sin(T * 1.7) * 0.5 } };
      if (sc.tank && p.tf) {
        const f = p.tf.list[0], q0 = fishAt(f, T), hk = [sc.bob[0], p.hookY], v = Math.sin(seg(u, 0.05, 0.95) * Math.PI);
        st.skipFish = 0;
        st.under = (im) => { const x = lerp(q0.x, hk[0] + 8, v), y = lerp(q0.y, hk[1] + 1, v); drawFish(im, f.sp, x, y, u < 0.5 ? (hk[0] >= q0.x ? 1 : -1) : (hk[0] >= q0.x ? -1 : 1), T, f.len); if (u > 0.35 && u < 0.6) mark(im, "?", R(x) - 3, R(y) - 18, (u - 0.35) * 4); };
      } else st.gag = (im) => { const x = lerp(W + 5, sc.bob[0] - 40, u); im.rect(x, sc.wl, 3, 1, "#8a6a2a"); im.px(x + 1, sc.wl - 1, "#6a8a2a"); };
      stage(img, p, T, st);
    },
    nap(img, p, lt, T) {
      const base = p.dusk.img;
      img.d.set(base.d);
      const sc = p.sc;
      p.sc = Object.assign({}, sc, { tod: p.dusk.tod, img: base });
      stage(img, p, T, { pose: "sleep" });
      p.sc = sc;
      const line = "the fish were elsewhere";
      label(img, line, 6, H - 6, seg(lt, 0.8, 1.4));
    },
    nibble(img, p, lt, T, b) {
      const u = lt / b.dur, sc = p.sc, n = p.nibbles, k = Math.floor((lt - 0.5) / 0.5), ph = ((lt - 0.5) % 0.5) / 0.5;
      const dip = lt > 0.5 && k < n && ph < 0.35 ? 2 : 0;
      const st = { pose: "rod", bob: { dip }, mark: u > 0.15 ? ["?", (u - 0.15) * 3] : null };
      if (dip) st.over = (im) => rings(im, sc.bob[0], sc.bob[1] + 1, ph / 0.35, null, 1);
      const leg = p.r.outcome.startsWith("legend"), hk = [sc.bob[0], p.hookY];
      if (sc.tank) {
        if (leg) { st.legendX = lerp(120 + Math.sin(T * 0.18 + 1) * 70, hk[0] + 34, ease(u)); st.legendY = lerp(H - 26, hk[1] + 4, ease(u)); st.legendFace = -1; st.legendA = 0.85; }
        else if (p.tf && p.tf.hooked >= 0 && p.r.outcome !== "junk" && !(p.r.outcome === "strange" && p.r.strange !== "whiskers")) {
          const f = p.tf.list[p.tf.hooked], q0 = fishAt(f, b.t0);
          st.skipFish = p.tf.hooked;
          st.under = (im) => { const v = ease(seg(u, 0, 0.5)), x = lerp(q0.x, hk[0] + 9, v) + (dip ? -2 : 0), y = lerp(q0.y, hk[1] + 1, v); drawFish(im, f.sp, x, y, hk[0] >= q0.x ? (v < 1 ? 1 : -1) : -1, T, f.len); if (u > 0.3 && u < 0.7) mark(im, "?", R(x) - 3, R(y) - 18, u - 0.3); };
        } else if (p.r.outcome === "strange" && p.r.strange === "whiskers") {
          st.under = (im) => { const x = lerp(W + 30, hk[0] + 14, ease(u)), y = hk[1] + 3; drawFish(im, FA.species("catfish"), x, y, -1, T, 34); };
        } else if (p.r.outcome === "junk" || p.r.outcome === "strange") {
          st.hook = [hk[0] + 6 * ease(u), lerp(hk[1], H - 14, ease(u))];
        }
      } else if (leg) st.legendPass = 0.5;
      stage(img, p, T, st);
    },
    strike(img, p, lt, T) {
      const u = lt / 0.9, sc = p.sc, leg = p.r.outcome.startsWith("legend");
      const st = { pose: "rod", angle: lerp(52, 30, ease(seg(u, 0, 0.3))), bend: 0.25 * ease(seg(u, 0, 0.3)), line: "taut", bob: { under: true }, mark: ["!", u], hook: false, lean: leg ? 2 : 0 };
      st.over = (im) => { rings(im, sc.bob[0], sc.bob[1] + 1, u, null, 3); splash(im, sc.bob[0], sc.bob[1], u, leg ? 30 : 14, leg ? 1.6 : 1, 4); };
      st.to = [sc.bob[0], sc.bob[1] + (sc.tank ? 0 : 2)];
      underHooked(p, st, T, 0, u);
      stage(img, p, T, st);
    },
    fight(img, p, lt, T, b) {
      const u = lt / b.dur, sc = p.sc, o = p.r.outcome, leg = o.startsWith("legend"), dead = o === "junk" || (o === "strange" && p.r.strange !== "whiskers");
      const sway = dead ? 0 : Math.sin(lt * (leg ? 5 : 7)) * (6 + p.big * 14), rise = ease(u);
      const st = { pose: "rod", angle: 40 + (dead ? 0 : Math.sin(lt * 9) * 4), bend: (dead ? 0.22 : 0.3 + p.big * 0.2 + (leg ? 0.15 : 0)) + Math.sin(lt * 11) * 0.03, line: "taut", bob: { under: true }, hook: false, lean: leg ? R(2 + Math.sin(lt * 6) * 2) : 0, cheer: !dead && u > 0.4, flee: sc.tank && !dead ? 1 : 0 };
      const x = sc.bob[0] + sway;
      st.to = sc.tank ? [x, sc.wl + 1] : [x, sc.wl + 2];
      st.over = (im) => {
        if (!dead) { const sp = (lt * (2 + p.big * 3)) % 1; splash(im, x, sc.wl, sp, 6 + R(p.big * 10) + (leg ? 14 : 0), 0.6 + p.big * 0.6, R(lt * 3)); rings(im, x, sc.wl + 1, (lt * 1.3) % 1, null, 2); }
        else rings(im, x, sc.wl + 1, (lt * 0.8) % 1, null, 1);
      };
      underHooked(p, st, T, rise, 1, sway);
      stage(img, p, T, st);
    },
    out(img, p, lt, T, b) {
      const u = lt / b.dur, sc = p.sc, o = p.r.outcome, leg = o === "legend_caught";
      const keepOnLine = o === "stolen" || o === "junk" || o === "strange";
      const from = [sc.bob[0], sc.wl], arc = ease3(seg(u, 0, 0.6));
      if (!keepOnLine && u > 0.6) {
        const v = seg(u, 0.6, 1);
        return stage(img, p, T, { pose: "high", held: heldFish(p, T, v), cheer: true, over: (im) => drops(im, p.sx + 14, p.sy - 12, T, 6, 2) });
      }
      const tipA = 70;
      const tip = rodTip(p, { angle: tipA });
      const dangle = keepOnLine ? [lerp(from[0], tip[0] + 12, arc), lerp(from[1], tip[1] + 18, arc) - Math.sin(arc * Math.PI) * 20] : [lerp(from[0], p.sx + 14, arc), lerp(from[1], p.sy - 10, arc) - Math.sin(arc * Math.PI) * 26];
      const st = { pose: "rod", angle: lerp(40, tipA, arc), bend: 0.2, line: "taut", bob: false, hook: false, to: [dangle[0], dangle[1] - 6], cheer: true, lean: leg ? -2 : 0 };
      st.over = (im) => { splash(im, from[0], from[1], seg(u, 0, 0.5), leg ? 40 : 18, leg ? 1.8 : 1.1, 8); rings(im, from[0], from[1] + 1, seg(u, 0, 0.8), null, 3); dangling(im, p, dangle[0], dangle[1], T); drops(im, dangle[0], dangle[1], T, 5, 3); };
      stage(img, p, T, st);
    },
    ruler(img, p, lt, T) { ruler(img, p, lt, T); },
    away(img, p, lt, T) {
      const sc = p.sc, u = lt / 4.2, lx = sc.bob[0] + 10, f = FA.fish(p.r.sp, { size: "held", cm: p.r.size, phase: T * 9, face: 1 });
      if (u < 0.32) {
        const v = u / 0.32, x = lx + v * 26, y = sc.wl - Math.sin(v * Math.PI) * 30;
        return stage(img, p, T, { pose: "rod", angle: lerp(40, 60, v), bend: v < 0.3 ? 0.3 : 0, line: v < 0.3 ? "taut" : "slack", slack: 14, to: v < 0.3 ? [x, y] : [sc.bob[0] + 6, sc.wl], bob: false, hook: false, mark: v > 0.3 ? ["!", v - 0.3] : null, over: (im) => { blit(im, f, x - f.w / 2, y - f.h / 2); splash(im, lx, sc.wl, v, 14, 1, 5); if (v > 0.85) splash(im, lx + 26, sc.wl, (v - 0.85) * 5, 16, 1, 6); } });
      }
      const v = seg(u, 0.32, 0.5);
      stage(img, p, T, { pose: "wide", spread: ease(v) * 4 + Math.sin(T * 3) * 0.5, bubble: [p.r.line || "IT WAS THIS BIG", seg(u, 0.38, 1), p.sc.perch.x, p.sy - 8], over: (im) => rings(im, lx + 26, sc.wl + 1, seg(u, 0.32, 0.7), null, 3) });
    },
    snap(img, p, lt, T) {
      const sc = p.sc, u = lt / 4.6, lg = p.r.lg || {};
      const st = { pose: "rod", angle: lerp(30, 66, ease(seg(u, 0, 0.15))), bend: lerp(0.5, 0, seg(u, 0, 0.08)), line: u < 0.06 ? "taut" : "none", bob: false, hook: false, lean: u < 0.1 ? 3 : 0 };
      if (sc.tank) { st.legendX = lerp(sc.bob[0] + 10, -60, ease(seg(u, 0.05, 0.9))); st.legendY = lerp(sc.wl + 26, H - 24, ease(seg(u, 0.05, 0.6))); st.legendFace = -1; st.legendA = 0.9 * (1 - seg(u, 0.75, 1)); }
      else st.legendPass = lerp(0.42, 1, seg(u, 0.05, 0.9));
      st.over = (im) => {
        if (u > 0.04 && u < 0.3) { const tip = rodTip(p, { angle: st.angle }), w = seg(u, 0.04, 0.3); for (let i = 0; i < 24; i++) { const k = i / 24; im.px(lerp(tip[0], tip[0] + 30, k), tip[1] + Math.sin(k * 9 + w * 12) * 6 * (1 - w) + k * 20 * w, "#f4ecda", 0.8 * (1 - w)); } }
        splash(im, sc.bob[0], sc.wl, seg(u, 0, 0.4), 34, 1.8, 9); rings(im, sc.bob[0], sc.wl + 1, seg(u, 0, 0.6), null, 3);
      };
      st.bubble = ["SNAP.", seg(u, 0.02, 0.4), sc.bob[0] - 20, sc.wl - 30];
      stage(img, p, T, st);
      if (u > 0.4) { const told = lg.told ? `${lg.name}: ${lg.told}` : `${lg.name || "the legend"} got away`; plate(img, told.toUpperCase(), seg(u, 0.4, 0.6)); }
    },
    junk(img, p, lt, T) {
      const sc = p.sc, u = lt / 4.0, tip = rodTip(p, { angle: 70 }), jx = tip[0] + 10, jy = tip[1] + 26 + Math.sin(T * 2) * 1;
      stage(img, p, T, { pose: "rod", angle: 70, bend: 0.12, line: "taut", to: [jx, jy - 10], bob: false, hook: false, over: (im) => { junkArt(im, p.r.junk, jx, jy, p.r.junk === "boot" ? seg(u, 0.18, 0.3) : 0, T); drops(im, jx, jy, T, 4, 7); }, bubble: [p.r.line || (p.r.junk === "boot" ? "...one boot" : `...${({ kettle: "a kettle", hat: "a hat", horseshoe: "a horseshoe" })[p.r.junk] || "something"}`), seg(u, 0.35, 1), sc.perch.x - 6, p.sy - 6] });
      if (p.r.junk === "boot" && u > 0.22 && (lt % 1.3) < 0.4) text(img, "croak", R(jx) + 6, R(jy) - 14, "#c8e070", { outline: "#1a1a08" });
    },
    stolen(img, p, lt, T) {
      const sc = p.sc, u = lt / 4.2, tip = rodTip(p, { angle: 70 }), fx = tip[0] + 10, fy = tip[1] + 24, k = p.r.thief.kind;
      const gone = u > 0.3;
      const st = { pose: "rod", angle: 70, bend: gone ? 0 : 0.12, line: "taut", to: gone ? [fx, fy - 8] : [fx, fy - 6], bob: false, hook: false };
      st.over = (im) => {
        const grab = seg(u, 0, 0.3), away = seg(u, 0.3, 1);
        let tx, ty, carry = gone;
        if (k === "cat" || k === "dog") { tx = gone ? lerp(fx, -30, away) : lerp(-20, fx, ease(grab)); ty = sc.perch.y - (grab > 0.8 && !gone ? Math.sin((grab - 0.8) * 5 * Math.PI) * 12 : 0); pet(im, k, p.r.thief.name, tx, ty, T, gone); if (carry) dangleSmall(im, p, tx + (gone ? -6 : 6), ty - 6, T); }
        else if (k === "heron" || k === "gull") { tx = gone ? lerp(fx + 6, W + 30, away) : lerp(W + 30, fx + 6, ease(grab)); ty = gone ? lerp(fy, 10, away) : lerp(10, fy + 8, ease(grab)); if (k === "heron") heron(im, tx, ty + 14, T, grab > 0.85 && !gone, true); else gull(im, tx, ty, T, false); if (carry) dangleSmall(im, p, tx, ty + (k === "heron" ? 6 : 3), T); }
        else if (k === "otter") { const up = gone ? R(lerp(16, 0, away)) : R(lerp(0, 16, ease(grab))); otter(im, fx, sc.wl + 2, up); if (gone && away > 0.4) rings(im, fx, sc.wl + 1, away, null, 2); else if (carry) dangleSmall(im, p, fx, sc.wl - up - 2, T); }
        else if (k === "fox") { tx = gone ? lerp(fx, W + 30, away) : lerp(W + 20, fx, ease(grab)); fox(im, tx, sc.perch.y, T, false, !gone); if (carry) dangleSmall(im, p, tx + (gone ? 6 : -6), sc.perch.y - 9, T); }
        else { tx = fx; ty = gone ? lerp(fy + 4, sc.wl + 20, away) : lerp(sc.wl + 10, fy + 6, ease(grab)); crab(im, tx, ty, T); if (carry) dangleSmall(im, p, tx, ty - 6, T); }
        if (!gone) dangling(im, p, fx, fy, T);
      };
      st.bubble = [p.r.line || "OI!", seg(u, 0.32, 0.6), sc.perch.x, p.sy - 6];
      stage(img, p, T, st);
    },
    whiskers(img, p, lt, T) {
      const sc = p.sc, u = lt / 4.6, tip = rodTip(p, { angle: 66 }), back2 = seg(u, 0.78, 1);
      const fx = tip[0] + 12, fy = lerp(tip[1] + 26, sc.wl + 10, ease(back2));
      stage(img, p, T, { pose: "rod", angle: 66, bend: 0.1, line: back2 > 0.6 ? "slack" : "taut", slack: 6, to: back2 > 0.6 ? [sc.bob[0], sc.wl] : [fx + 4, fy - 4], bob: back2 > 0.6 ? {} : false, hook: false, over: (im) => {
        if (back2 < 0.7) { const f = FA.fish(FA.species("catfish"), { len: 40, face: -1, phase: back2 > 0 ? T * 9 : T * 2 }); blit(im, f, fx - f.w / 2 + 6, fy - f.h / 2 + 8); if (u > 0.2 && u < 0.78 && (T % 1.8) < 0.15) im.px(fx - 12, fy + 6, "#120a06"); }
        if (back2 > 0.5) { splash(im, sc.bob[0], sc.wl, seg(back2, 0.5, 1), 18, 1, 11); rings(im, sc.bob[0], sc.wl + 1, seg(back2, 0.5, 1), null, 3); }
      }, bubble: [p.r.line || "PUT ME BACK. I KNOW THINGS.", seg(u, 0.12, 0.78) * (u < 0.8 ? 1 : 0), clamp(fx - 30, 70, 200), fy - 14] });
    },
    key(img, p, lt, T) {
      const u = lt / 4.0, v = seg(u, 0, 0.35);
      stage(img, p, T, { pose: "high", cheer: true, held: (im, x, y) => { key(im, x + 11, y - 9 - R(ease(v) * 2), 1); K.light(im, x + 14, y - 9, 16, "#ffe08a", 0.25 * Math.sin(T * 3) + 0.25); } });
      const nm = p.r.key && p.r.key.name ? p.r.key.name : "a drowned key";
      plate(img, nm.toUpperCase(), seg(u, 0.3, 0.5));
    },
    letter(img, p, lt, T) {
      const u = lt / 4.6;
      stage(img, p, T, { pose: "rod", angle: 60, line: "none", bob: false, hook: false });
      letterPanel(img, p, seg(u, 0.08, 0.3), T);
    },
  };
  // the hooked thing below the surface (D) during the strike and the fight
  function underHooked(p, st, T, rise, u, sway) {
    const sc = p.sc, o = p.r.outcome, hk = [sc.bob[0], p.hookY];
    if (!sc.tank) { if (o.startsWith("legend")) st.legendPass = 0.5; else if (o !== "junk" && o !== "strange" && rise !== undefined) st.under = (im) => { const f = FA.fish(p.r.sp, { size: "held", cm: p.r.size, shadow: mix(FA.WATERS_PAL[p.r.kind] ? FA.WATERS_PAL[p.r.kind][2] : "#203040", "#000000", 0.5), phase: T * 10, face: (sway || 0) > 0 ? 1 : -1 }); blit(im, f, sc.bob[0] + (sway || 0) - f.w / 2, sc.wl + 4 + R((1 - rise) * 4), 0.55); }; return; }
    const y = lerp(hk[1], sc.wl + 8, rise), x = hk[0] + (sway || 0);
    if (o.startsWith("legend")) { st.legendX = x + 30; st.legendY = y + 4; st.legendFace = -1; st.legendA = 0.92; st.to = [x, sc.wl + 1]; st.under = (im) => drawLine(im, [x, sc.wl + 1], [x + 2, y], 0, 0.45, "#e8f0f0"); return; }
    if (o === "junk" || (o === "strange" && p.r.strange !== "whiskers")) {
      st.itemHidden = true;
      st.under = (im) => { const jy = lerp(H - 10, sc.wl + 10, rise); drawLine(im, [x, sc.wl + 1], [x + 6, jy - 8], 0, 0.45, "#e8f0f0"); if (o === "junk") junkArt(im, p.r.junk, x + 6, jy, 0, T); else if (p.r.strange === "key") key(im, x + 4, jy - 2, 0); else bottle(im, x + 6, jy - 4, 1.2); };
      return;
    }
    if (o === "strange") { st.under = (im) => { drawLine(im, [x, sc.wl + 1], [x, y], 0, 0.45, "#e8f0f0"); drawFish(im, FA.species("catfish"), x + 14, y + 2, -1, T * 2, 34); }; return; }
    if (p.tf && p.tf.hooked >= 0) st.skipFish = p.tf.hooked;
    const f = p.tf && p.tf.hooked >= 0 ? p.tf.list[p.tf.hooked] : { sp: p.r.sp, len: 16 };
    const len = clamp(R(f.len * (0.9 + p.big * 0.5)), 8, 34);
    st.under = (im) => { drawLine(im, [x, sc.wl + 1], [x, y], 0, 0.45, "#e8f0f0"); drawFish(im, f.sp, x + (Math.sin(T * 13) > 0 ? 1 : -1) * len * 0.45, y + 1, Math.sin(T * 13) > 0 ? -1 : 1, T * 2, len); };
  }
  function dangling(img, p, x, y, T) {
    const o = p.r.outcome;
    if (o === "strange" && p.r.strange === "whiskers") return;
    if (o === "junk") return junkArt(img, p.r.junk, x, y + 10, 0, T);
    if (o === "strange") return p.r.strange === "key" ? key(img, x, y + 4, 1) : bottle(img, x, y + 6, 1.4);
    const f = FA.fish(p.r.sp, { size: "held", cm: p.r.size, phase: T * 8, legend: o === "legend_caught" && p.r.lg ? p.r.lg.id : undefined, len: o === "legend_caught" ? 64 : undefined });
    const rot = rotate90(f);
    blit(img, rot, x - rot.w / 2, y - 4);
  }
  function dangleSmall(img, p, x, y, T) {
    const f = FA.fish(p.r.sp, { len: clamp(FA.heldLen(p.r.size) - 4, 8, 26), phase: T * 10 });
    blit(img, f, x - f.w / 2, y - f.h / 2);
  }
  // a fish hung by the lip: snout up
  const rots = new Map();
  function rotate90(f) {
    if (rots.has(f)) return rots.get(f);
    const o = new Img(f.h, f.w);
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) { const s = (y * f.w + x) * 4, d = ((f.w - 1 - x) * o.w + y) * 4; for (let k = 0; k < 4; k++) o.d[d + k] = f.d[s + k]; }
    if (rots.size > 60) rots.delete(rots.keys().next().value);
    rots.set(f, o);
    return o;
  }
  function heldFish(p, T, v) {
    const leg = p.r.outcome === "legend_caught";
    const f = FA.fish(p.r.sp, { len: leg ? 72 : FA.heldLen(p.r.size), phase: T * (leg ? 3 : 6) * (1 - v * 0.6), legend: leg && p.r.lg ? p.r.lg.id : undefined });
    return (im, x, y) => { blit(im, f, x + 14 - f.w / 2, y - f.h + 1); };
  }
  function plate(img, s, u) {
    if (u <= 0) return;
    const lines = FA.wrap(s, W - 40, { bold: true }).slice(0, 2), h = lines.length * 11 + 6, y = H - h - 4 + R((1 - ease3(u)) * 10);
    for (let j = 0; j < h; j++) for (let i = 0; i < W; i++) img.px(i, y + j, "#0a0604", 0.62 * (1 - Math.abs(j - h / 2) / (h / 2 + 2)) * ease(u));
    lines.forEach((l, i) => text(img, l, W / 2, y + 12 + i * 11, "#ffe08a", { bold: true, center: true, outline: "#1a0c06" }));
  }
  function letterPanel(img, p, u, T) {
    if (u <= 0) return;
    const L = p.r.letter || {}, pw = 150, ph = 104, x = R((W - pw) / 2), y = R(22 + (1 - ease3(u)) * 60);
    FA.frame(img, x, y, pw, ph, false);
    FA.paper(img, x, y, pw, ph, 5, false);
    text(img, "A LETTER IN A BOTTLE", x + pw / 2, y + 12, "#2a1810", { bold: true, center: true });
    const lines = FA.wrap(L.text || "If you find this, the river kept it safe.", pw - 16).slice(0, 7);
    const shown = Math.floor(clamp((u - 0.2) * 2.4, 0, 1) * lines.join(" ").length);
    let k = 0;
    lines.forEach((l, i) => { const part = l.slice(0, Math.max(0, shown - k)); k += l.length + 1; if (part) text(img, part, x + 8, y + 26 + i * 10, "#3a2a1a"); });
    if (u >= 1) text(img, `- ${L.name || "someone"}`, x + pw - 10 - textWidth(`- ${L.name || "someone"}`), y + ph - 6, "#6b543c");
  }

  // ---------- the reveal: held against the ruler, with the gold tag for a rare fish or a legend ----------
  const PLANK = K.R(["#2a1608", "#3e2412", "#54341c", "#6a4426", "#7e5632"]);
  function ruler(img, p, lt, T) {
    const r = p.r, leg = r.outcome === "legend_caught", gold = leg || r.rare, sp = r.sp, size = r.size;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const row = Math.floor(y / 15), seam = y % 15 === 0, knot = fbm(x / 7, y / 3, row + 3);
      img.px(x, y, seam ? "#1a0c04" : K.pick(PLANK, 0.55 + Math.sin(x * 0.08 + knot * 5 + row) * 0.1 + (h2(row, 1, 4) - 0.5) * 0.25 - (y % 15 === 1 ? -0.2 : 0), x, y));
    }
    if (gold) { for (let k = 0; k < 14; k++) { const a0 = (k / 14) * TAU + lt * 0.15, a1 = a0 + TAU / 30; for (let rr = 10; rr < 190; rr += 1) for (const a of [a0, a1]) img.px(W / 2 + Math.cos(a) * rr, 70 + Math.sin(a) * rr, leg ? "#ffe08a" : "#f0c860", 0.16); } }
    const rx = 18, rw = 204, ry = 86, room = 60;
    const probe = FA.trim(FA.fish(sp, { len: 100, still: true })), maxLen = (room / probe.h) * 100;
    const need = Math.max(size * 1.12, (size * rw) / maxLen), max = [20, 30, 50, 80, 100, 150, 200, 300, 400, 600].find((m) => m >= need) || 600, ppc = rw / max;
    for (let y = ry; y < ry + 14; y++) for (let x = rx - 4; x < rx + rw + 4; x++) img.px(x, y, y === ry ? "#fff0a8" : y > ry + 11 ? "#b88a2a" : K.pick(K.R(["#d8a840", "#e8c060", "#f0d070"]), 0.6 + (h2(x, y, 3) - 0.5) * 0.2, x, y));
    const step = max <= 30 ? 1 : max <= 100 ? 5 : max <= 300 ? 10 : 50;
    const every = [1, 2, 5, 10, 20, 25, 50, 100].map((k) => k * step).find((k) => k * ppc >= 26) || max;
    for (let c = 0; c <= max; c += step) { const x = R(rx + c * ppc), big = c % every === 0; img.rect(x, ry, 1, big ? 6 : 3, "#3a2410"); if (big && c > 0 && c < max) { const s = String(c); text(img, s, x - R(textWidth(s) / 2), ry + 13, "#5a3a14"); } }
    const flen = Math.max(10, R(size * ppc)), u = ease3(seg(lt, 0.05, 0.7));
    const f = FA.fish(sp, { len: flen, still: true, legend: leg && r.lg ? r.lg.id : undefined });
    // a fish too deep for the space above the ruler lies across it, as it would on the planks
    const fx = R(lerp(W + 10, rx, u)), fy = Math.max(38, ry - f.h + 3);
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.d[(y * f.w + x) * 4 + 3]) img.px(fx + x + 2, fy + y + 3, "#0a0402", 0.4);
    blit(img, f, fx - 1, fy);
    const m = seg(lt, 0.8, 1.6), cm = R(size * ease(m));
    if (m > 0) { const mx = R(rx + size * ppc * ease(m)); for (let y = ry - 6; y < ry + 16; y++) img.px(mx, y, "#c0281e"); img.rect(mx - 1, ry - 7, 3, 2, "#c0281e"); }
    if (gold) FA.tag(img, leg ? "LEGEND" : "RARE", W / 2, 3, leg ? "legend" : "rare");
    const name = (leg && r.lg ? r.lg.name : sp.name).toUpperCase(), k2 = textWidth(name, { bold: true, k: 2 }) < W - 20 ? 2 : 1;
    text(img, name, W / 2, gold ? 33 : 27, gold ? "#ffe08a" : "#f6ead0", { bold: true, center: true, k: k2, outline: "#1a0c06" });
    const port = p.cast.hero.portrait, cx = port ? 140 : W / 2;
    if (m > 0) text(img, `${cm} cm`, cx, ry + 33, "#fff4d8", { bold: true, center: true, k: 2, outline: "#1a0c06" });
    const sub = leg ? `${sp.name}, landed at last` : r.first ? "first in the league" : r.rank !== undefined && r.rank !== null ? `bigger than ${R(r.rank)}% caught` : r.best ? "a personal best" : "";
    const x0 = port ? 52 : 4;
    const subs = sub ? FA.wrap(sub, W - x0 - 6) : [];
    if (lt > 1.7) subs.forEach((l, i) => label(img, l, clamp(R(cx - textWidth(l) / 2), x0, W - 4 - textWidth(l)), ry + 46 + i * 10, seg(lt, 1.7, 2.1)));
    const who = `${r.name || ""}${r.day ? ", day " + r.day : ""}`;
    if (lt > 2.0) label(img, who, R(cx - textWidth(who) / 2), Math.min(H - 3, ry + 58 + (subs.length > 1 ? 9 : 0)), seg(lt, 2.0, 2.4));
    if (port && lt > 1.0) { const a = seg(lt, 1.0, 1.4), px = 8, py = H - port.h - 6; img.rect(px - 2, py - 2, port.w + 4, port.h + 4, "#1a0c04"); img.rect(px - 1, py - 1, port.w + 2, port.h + 2, gold ? "#e8b84a" : "#8a6236"); img.rect(px, py, port.w, port.h, "#3e2412"); blit(img, port, px, py, a); }
    if (gold) for (const [x, y, ph] of [[30, 40, 0], [210, 30, 0.5], [200, 70, 1.1], [44, 70, 0.8]]) { const v = ((lt + ph) % 1.6) / 1.6; if (v < 0.5) star(img, x, y, "#fff6c8", Math.max(1, R(3 * Math.sin(v * 2 * Math.PI))), 1); }
  }

  // ---------- plan and render ----------
  const plans = new Map();
  function planFor(rec, opts) {
    const key = JSON.stringify(rec);
    if (plans.has(key)) return plans.get(key);
    const p = plan(rec, opts);
    if (plans.size > 12) plans.delete(plans.keys().next().value);
    plans.set(key, p);
    return p;
  }
  function render(rec, t, opts) {
    const p = planFor(rec, opts);
    t = Math.max(0, t);
    let i = p.beats.findIndex((b) => t < b.t1);
    if (i < 0) i = p.beats.length - 1;
    const b = p.beats[i], lt = Math.min(t - b.t0, b.dur + 60);
    const img = p.sc.img.copy();
    p.bi = i;
    BEATS[b.id](img, p, lt, t, b);
    const out = new Uint8ClampedArray(W * H * 4);
    for (let k = 0; k < W * H; k++) { out[k * 4] = img.d[k * 4]; out[k * 4 + 1] = img.d[k * 4 + 1]; out[k * 4 + 2] = img.d[k * 4 + 2]; out[k * 4 + 3] = 255; }
    return { w: W, h: H, data: out };
  }

  // ---------- sound: its own WebAudio context, following audio.js's "al.sound" settings and first-click unlock ----------
  const Snd = (() => {
    let ctx = null, out = null, noiseBuf = null, unlocked = false;
    const prefs = () => { try { return Object.assign({ on: true, master: 0.7, sfx: 0.6 }, JSON.parse(root.localStorage.getItem("al.sound") || "{}")); } catch (e) { return { on: true, master: 0.7, sfx: 0.6 }; } };
    function init() {
      if (ctx) return ctx;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      out = ctx.createGain(); out.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }
    function ok() {
      const pr = prefs();
      if (!unlocked || !pr.on || !init()) return null;
      if (ctx.state === "suspended") ctx.resume();
      out.gain.value = pr.master * pr.sfx * 0.9;
      return ctx;
    }
    function noise(t, dur, vol, type, freq, q, f2, attack) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; s.loop = true;
      f.type = type || "lowpass"; f.frequency.setValueAtTime(freq || 800, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (attack || Math.min(0.004, dur / 4))); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    }
    function tone(t, f0, f1, dur, vol, type, attack) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.003)); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
    function ring(t, f, dur, vol) { for (const [m, a] of [[1, 1], [2.71, 0.5], [4.16, 0.3]]) tone(t, f * m, f * m * 0.998, dur / Math.sqrt(m), vol * a); }
    const FX = {
      water: (t, secs) => { secs = Math.min(30, secs || 10); noise(t, secs, 0.03, "lowpass", 420, 0.6, null, 0.6); for (let i = 0; i < secs * 1.2; i++) noise(t + Math.random() * secs, 0.12, 0.02, "bandpass", 900 + Math.random() * 900, 4); },
      waves: (t, secs) => { secs = Math.min(30, secs || 10); for (let k = 0; k < secs / 3.2; k++) noise(t + k * 3.2, 2.6, 0.05, "lowpass", 700, 0.5, 260, 1.0); },
      cave: (t, secs) => { secs = Math.min(30, secs || 10); noise(t, secs, 0.02, "lowpass", 220, 0.5, null, 0.6); for (let i = 0; i < secs / 2; i++) FX.drip(t + 0.5 + Math.random() * secs); },
      swish: (t) => noise(t, 0.32, 0.14, "bandpass", 700, 1.2, 3000, 0.06),
      plop: (t) => { tone(t, 520, 180, 0.09, 0.18); noise(t, 0.05, 0.12, "lowpass", 1400); },
      tick: (t) => { tone(t, 700, 380, 0.05, 0.08); },
      drip: (t) => { tone(t, 1400, 600, 0.08, 0.07); tone(t + 0.02, 900, 1800, 0.05, 0.04); },
      splash: (t) => { noise(t, 0.35, 0.22, "lowpass", 2600, 0.8, 500, 0.01); tone(t, 300, 120, 0.12, 0.12); },
      bigsplash: (t) => { noise(t, 0.7, 0.3, "lowpass", 2200, 0.6, 300, 0.01); tone(t, 160, 60, 0.3, 0.2); noise(t + 0.2, 0.5, 0.12, "highpass", 3000, 0.7, 1200, 0.05); },
      zing: (t) => noise(t, 0.25, 0.1, "bandpass", 4200, 3, 2200, 0.01),
      reel: (t, secs) => { secs = Math.min(8, secs || 2); for (let a = 0; a < secs; a += 0.045 + Math.random() * 0.02) noise(t + a, 0.012, 0.06 + Math.random() * 0.04, "bandpass", 3600, 6); },
      ping: (t) => { ring(t, 1760, 0.4, 0.04); },
      snap: (t) => { noise(t, 0.06, 0.45, "highpass", 2500, 0.8); tone(t, 1800, 300, 0.12, 0.12, "triangle"); },
      thud: (t) => { tone(t, 110, 50, 0.18, 0.3); noise(t, 0.1, 0.18, "lowpass", 500); },
      count: (t) => { for (let i = 0; i < 6; i++) tone(t + i * 0.1, 900 + i * 80, 900 + i * 80, 0.04, 0.05, "square"); },
      reveal: (t) => { [784, 988, 1175, 1568].forEach((f, i) => ring(t + i * 0.07, f, 0.9, 0.05)); },
      sparkle: (t) => { const n = [2093, 2637, 3136, 3520]; for (let i = 0; i < 6; i++) ring(t + i * 0.08, n[i % 4], 0.5, 0.035); FX.reveal(t + 0.1); },
      fanfare: (t) => { [523, 659, 784, 1046].forEach((f, i) => { tone(t + i * 0.12, f, f, 0.5, 0.06, "triangle", 0.02); ring(t + i * 0.12, f * 2, 0.6, 0.02); }); tone(t + 0.5, 1046, 1046, 1.2, 0.07, "triangle", 0.03); },
      sad: (t) => { tone(t, 330, 311, 0.4, 0.06, "triangle"); tone(t + 0.35, 294, 262, 0.7, 0.06, "triangle"); },
      croak: (t) => { for (let i = 0; i < 3; i++) tone(t + i * 0.07, 140, 110, 0.06, 0.12, "sawtooth"); },
      quack: (t) => { tone(t, 520, 380, 0.12, 0.06, "sawtooth"); tone(t + 0.18, 500, 360, 0.12, 0.05, "sawtooth"); },
      caw: (t) => { noise(t, 0.22, 0.08, "bandpass", 1500, 3, 1100, 0.02); tone(t, 900, 700, 0.2, 0.03, "sawtooth"); },
      meow: (t) => tone(t, 600, 900, 0.3, 0.05, "triangle", 0.05),
      bark: (t) => { tone(t, 320, 220, 0.1, 0.1, "sawtooth"); tone(t + 0.16, 320, 220, 0.1, 0.08, "sawtooth"); },
      chitter: (t) => { for (let i = 0; i < 5; i++) tone(t + i * 0.05, 1600, 1300, 0.03, 0.04, "square"); },
      yip: (t) => tone(t, 800, 1300, 0.12, 0.06, "triangle"),
      clack: (t) => { for (let i = 0; i < 3; i++) noise(t + i * 0.08, 0.02, 0.15, "bandpass", 2600, 3); },
      creak: (t) => noise(t, 0.6, 0.05, "bandpass", 300, 8, 420, 0.1),
      gasp: (t) => noise(t, 0.25, 0.08, "bandpass", 1400, 2, 2400, 0.05),
      snore: (t) => { noise(t, 0.9, 0.06, "lowpass", 260, 2, 180, 0.3); noise(t + 1.0, 0.6, 0.03, "bandpass", 1200, 2, null, 0.2); },
      blub: (t) => { for (let i = 0; i < 4; i++) { const at = t + i * 0.14, f = 180 + Math.random() * 140; tone(at, f, f * 2.2, 0.07, 0.12); } },
      chime: (t) => { ring(t, 1568, 0.8, 0.05); ring(t + 0.1, 2093, 0.7, 0.04); },
      clink: (t) => ring(t, 2400, 0.3, 0.05),
      cork: (t) => { tone(t, 900, 300, 0.05, 0.14); noise(t, 0.03, 0.1, "highpass", 3000); },
      unroll: (t) => noise(t, 0.5, 0.05, "bandpass", 2400, 1.5, 1600, 0.1),
    };
    function render(evs, secs, sr) {
      const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext, rate = sr || 22050;
      const saved = [ctx, out, noiseBuf];
      ctx = new OAC(1, Math.ceil(rate * secs), rate);
      out = ctx.createGain(); out.gain.value = 0.7 * 0.6 * 0.9; out.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, rate * 2, rate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const off = ctx;
      try { for (const [t, name, v] of evs) if (FX[name]) FX[name](t + 0.01, v); } finally { [ctx, out, noiseBuf] = saved; }
      return off.startRendering();
    }
    function play(name, v) { const c = ok(); if (!c || !FX[name]) return; try { FX[name](c.currentTime + 0.01, v); } catch (e) { /* audio node limits */ } }
    if (root.document) {
      root.document.addEventListener("pointerdown", () => { unlocked = true; }, { capture: true });
      root.document.addEventListener("visibilitychange", () => { if (ctx && root.document.hidden) ctx.suspend(); });
    }
    return { play, render, FX };
  })();

  // ---------- the player ----------
  const reduced = () => (root.Settings && root.Settings.calm ? root.Settings.calm() : !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches));
  function player(rec, opts) {
    opts = opts || {};
    const doc = root.document, fig = doc.createElement("figure"), cv = doc.createElement("canvas");
    fig.className = "catch-replay night-replay";
    cv.width = W; cv.height = H;
    cv.style.cssText = `image-rendering:pixelated;image-rendering:crisp-edges;display:block;cursor:pointer;${opts.scale ? `width:${W * opts.scale}px;height:${H * opts.scale}px` : "width:100%;height:auto"}`;
    cv.title = "Click to watch again";
    fig.appendChild(cv);
    // the pixels stay whole: the largest integer scale that fits the page's width and most of the screen's height
    if (!opts.scale && root.ResizeObserver) {
      const fit = () => {
        const box = fig.parentNode, pw = box ? box.clientWidth : 0;
        if (!pw) return;
        const vh = (root.innerHeight || H * 4) * 0.8, k = Math.max(1, Math.min(Math.floor(pw / W), Math.floor(vh / H)));
        cv.style.width = W * k + "px"; cv.style.height = H * k + "px"; cv.style.margin = "0 auto";
      };
      new root.ResizeObserver(fit).observe(fig);
    }
    const g = cv.getContext("2d"), img = g.createImageData(W, H);
    const p = planFor(rec, opts), last = p.beats[p.beats.length - 1];
    let t = reduced() ? last.t0 + Math.min(2.6, last.dur - 0.01) : 0, raf = 0, prev = 0, onscreen = false, fired = 0, lastDraw = -1, rate = 1, held = false, forced = false;
    const paint = () => { const f = render(rec, t, opts); img.data.set(f.data); g.putImageData(img, 0, 0); };
    const live = () => !held && fig.isConnected && onscreen && !doc.hidden;
    const LONG = { water: 1, waves: 1, cave: 1, reel: 1 };
    function frame(ms) {
      raf = 0;
      if (!live()) { prev = 0; return; }
      const dt = prev ? Math.min(0.1, (ms - prev) / 1000) : 0;
      prev = ms;
      t += dt * rate;
      while (fired < p.ev.length && p.ev[fired][0] <= t) {
        const e = p.ev[fired], late = t - e[0];
        if (late < 0.25 || (LONG[e[1]] && late < 1)) Snd.play(e[1], e[2]);
        fired++;
      }
      // after the last beat the water keeps moving at a low rate for a while, then holds
      const end = t >= p.dur;
      if (!end || t - lastDraw > 1 / 12) { paint(); lastDraw = t; }
      if (t < p.dur + 40) raf = root.requestAnimationFrame(frame);
    }
    const wake = () => { if ((forced || !reduced()) && !raf && live()) { prev = 0; raf = root.requestAnimationFrame(frame); } };
    const restart = () => { held = false; t = 0; fired = 0; lastDraw = -1; paint(); wake(); };
    cv.addEventListener("click", restart);
    if ("IntersectionObserver" in root) {
      const io = new root.IntersectionObserver((es) => {
        onscreen = es[es.length - 1].isIntersecting;
        if (!fig.isConnected && t > 0) { io.disconnect(); return; }
        wake();
      });
      io.observe(fig);
    } else onscreen = true;
    doc.addEventListener("visibilitychange", wake);
    fig.replay = {
      get t() { return t; }, get dur() { return p.dur; }, get playing() { return !held && t < p.dur && (forced || !reduced()); },
      play() { held = false; forced = true; wake(); },
      pause() { held = true; },
      restart() { forced = true; restart(); },
      skip() { t = p.dur; fired = p.ev.length; lastDraw = -1; paint(); wake(); },
      rate(s) { rate = s; },
    };
    paint();
    wake();
    return fig;
  }

  root.FishReplay = {
    player, W, H, OUTCOMES,
    framing: (rec) => FA.framing(rec || {}),
    frame: render,
    length: (rec, opts) => planFor(rec, opts).dur,
    beats: (rec, opts) => planFor(rec, opts).beats.map((b) => ({ id: b.id, t0: b.t0, t1: b.t1 })),
    events: (rec, opts) => planFor(rec, opts).ev.slice(),
    sound: Snd,
  };
})(typeof window !== "undefined" ? window : globalThis);
