/* Town day acts: a town stretch acted out on its set (TownSets): the hero walks in, does what the line says to whom with what, and the
   others react; every caption arrives with the beat it tells. */
/*
  TownActs.plan(block, sc, cast) -> plan   block: a daybook block ({ act, line, label, from, to, scene: { set, act, prop, who, with, beats } })
      sc: TownSets.build(...); cast: { hero, mates: [hero], other: hero|null, pet: hero.pet, mount: hero.mount } (hero = the site's hero summary)
    plan = { dur, loop: [t0, t1] (the act itself, for the daybook strip), caps: [{ t, text }], draw(ctx, t, still) }
  TownActs.ACTS: the acts it stages (content/town_stage.py ACTS); TownActs.figure(h) a hero's figure with its walk, seat and kneel frames.
  Needs town_day_sets.js, tavern.js, ballad.js (figures), road_scenes.js (walk frames), stage.js (props and captions), scene_kits.js (animals and carts a line names), mount_art.js.
*/
(function (root) {
  "use strict";
  const R = Math.round;
  const K = () => root.TownSets.kit;
  const Tv = () => root.Tavern;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const io = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const frac = (v) => ((v % 1) + 1) % 1;
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- figures: a hero (or a townsperson) with every way the acts draw them ----------
  const FIGS = new Map();
  function clsOf(h) { const S = (root.App && App.S) || {}; return h.clsLook || (S.classes || {})[h.cls] || { look: { outfit: "leather", head: "none" } }; }
  function figure(h, opt) {
    const key = (h.id || h.name) + ":" + JSON.stringify(h.look) + (opt && opt.look ? JSON.stringify(opt.look) : "");
    if (FIGS.has(key)) return FIGS.get(key);
    const cls = (opt && opt.look) || clsOf(h);
    const a = Tv().actor(h, 0, 0, { look: cls, plain: opt && opt.plain });
    const f = root.Ballad && Ballad.figure ? Ballad.figure(a, 0, 0) : { a, img: { 1: a.right, "-1": a.left }, shut: { 1: a.right, "-1": a.left } };
    let grid = null;
    try { grid = Art.heroGrid(Object.assign({}, h, { alive: true }), 0, cls); } catch (e) { grid = null; }
    const walk = grid && root.RoadScenes ? [0, 1, 2, 3].map((k) => { const g = RoadScenes.walker(grid, k); return { 1: g.toCanvas(1), "-1": g.flipX().toCanvas(1) }; }) : null;
    const fig = { h, a, f, cls, walk, pet: a.pet, w: a.right.width, hh: a.right.height };
    FIGS.set(key, fig);
    return fig;
  }
  // the townsfolk each set has: an outfit and a look of their own, seeded so the same set keeps the same people
  const FOLK = {
    merchant: { outfit: "vest", head: "none", fav: "#8a5a2a" }, priest: { outfit: "vestments", head: "none", fav: "#e8dcc0" }, trainer: { outfit: "chain", head: "none", fav: "#6a3a2a" },
    keeper: { outfit: "vest", head: "none", fav: "#8a3a2a" }, clerk: { outfit: "fancy", head: "none", fav: "#3a4a6a" }, stablehand: { outfit: "leather", head: "none", fav: "#6a5a3a" },
    sailor: { outfit: "cloak", head: "none", fav: "#2a4a6a" }, smith: { outfit: "leather", head: "none", fav: "#4a3a2a" }, healer: { outfit: "robe", head: "none", fav: "#e8e4d8" },
    guard: { outfit: "chain", head: "none", fav: "#5a5a6a" }, attendant: { outfit: "vest", head: "none", fav: "#d8d0c0" }, reader: { outfit: "robe_dark", head: "none", fav: "#7a2a3a" },
    local: null, child: null,
  };
  function folk(kind, seed, name) {
    const r = Art.rng(Art.hash(String(seed) + kind)), p = (xs) => xs[Math.floor(r() * xs.length)], spec = FOLK[kind] || null;
    const look = { skin: p(["#f0c8a0", "#e0b088", "#c48a5e", "#9a6440", "#6e4428"]), hair: p(["#3a2a1a", "#6a4020", "#c8a050", "#9a9aa6", "#2a2228", "#a04a20"]),
      style: Math.floor(r() * 6), face: Math.floor(r() * 3), fav: spec ? spec.fav : p(["#5a6a3a", "#3a5a8a", "#7a5a3a", "#6a3a3a", "#8a7a5a"]), scars: [] };
    const h = { id: "folk:" + kind + ":" + seed, name: name || "A local", look, weapon: "none", weapon_tier: 1, armor_tier: 1 };
    return figure(h, { plain: true, look: { name: kind, look: { outfit: spec ? spec.outfit : p(["vest", "leather", "cloak"]), head: "none", aura: null, offhand: "none" } } });
  }
  function petFig(pet) {
    if (!pet) return null;
    try {
      const g0 = Art.petGrid(pet, 0), g1 = Art.petGrid(pet, 1);
      return { pet, img: [{ 1: g0.toCanvas(1), "-1": g0.flipX().toCanvas(1) }, { 1: g1.toCanvas(1), "-1": g1.flipX().toCanvas(1) }] };
    } catch (e) { return null; }
  }
  function mountFig(m) {
    if (!m || !root.MountArt) return null;
    try {
      const flip = (c) => { const o = document.createElement("canvas"); o.width = c.width; o.height = c.height; const x = o.getContext("2d"); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return o; };
      const fr = [0, 1].map((f) => { const c = MountArt.mountGrid(m.kind || "horse", m.colour || "bay", f, "scene"); return { 1: c, "-1": flip(c) }; });
      return { m, img: fr };
    } catch (e) { return null; }
  }

  // ---------- the animals and things a line names (SceneKits: the road's kits): a goose, a dog, a cart rolling by ----------
  const MOVERS = new Set(["cart", "tinker", "menagerie"]);
  const SLOW = new Set(["ox", "cow", "sheep", "pig", "horse", "mule", "goat", "deer", "cart", "tinker", "menagerie"]);
  function thingFig(id) {
    if (!root.SceneKits || !SceneKits.sprite) return null;
    const flip = (c) => { const o = document.createElement("canvas"); o.width = c.width; o.height = c.height; const x = o.getContext("2d"); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return o; };
    const img = [0, 1].map((f) => { const g = SceneKits.sprite(id, f); if (!g) return null; const c = g.toCanvas(1); return { 1: c, "-1": flip(c) }; });
    return img[0] ? { id, img: img.map((x) => x || img[0]), bird: SceneKits.BIRDS.has(id), slow: SLOW.has(id) } : null;
  }
  // which of them the line names, once each, at most two (a pet of the same kind is the hero's own animal, not another)
  function namedThings(line, petKind) {
    if (!root.Stage || !Stage.NOUNS || !root.SceneKits) return [];
    const ok = new Set(SceneKits.ANIMALS.concat([...MOVERS])), out = [];
    for (const [re, id] of Stage.NOUNS) if (ok.has(id) && id !== petKind && re.test(line || "") && !out.includes(id)) out.push(id);
    return out.slice(0, 2);
  }
  function drawThing(ctx, sc, tf, p, t) {
    const [x0, y0] = sc.st.iso(p.u, p.v), x = R(x0), y = R(y0) - (p.lift || 0), img = tf.img[Math.floor(t * (tf.slow ? 2.5 : 6)) & 1][p.face > 0 ? 1 : "-1"];
    if (!tf.bird || !p.lift) { ctx.fillStyle = "rgba(20,10,4,0.28)"; ctx.fillRect(x - (img.width >> 2), R(y0) - 1, img.width >> 1, 2); }
    ctx.drawImage(img, x - (img.width >> 1), y - img.height + 1);
  }

  // ---------- drawing a figure in a pose ----------
  // p: { u, v, face, mode: stand | walk | sit | kneel | crouch | lie | tub | ride | fallen, dip, lift, dx, shut, alpha, step (walk frame) }
  function drawFig(ctx, sc, fig, p, t) {
    const [x0, y0] = sc.st.iso(p.u, p.v), x = R(x0 + (p.ox || 0)), y = R(y0 + (p.oy || 0));
    const face = p.face > 0 ? 1 : "-1";
    if (p.alpha != null) ctx.globalAlpha = p.alpha;
    const shadow = () => { ctx.fillStyle = "rgba(20,10,4,0.32)"; ctx.fillRect(x - 6, y - 1, 12, 2); ctx.fillRect(x - 4, y - 2, 8, 4); };
    const img = (p.shut ? fig.f.shut : fig.f.img)[face], w = img.width, hh = img.height;
    if (p.mode === "walk" && fig.walk) {
      shadow();
      const k = fig.walk[(p.step || 0) & 3][face];
      ctx.drawImage(k, x - (k.width >> 1), y - k.height + 1 - (p.lift || 0));
    } else if (p.mode === "sit") {
      // seated: the lower legs hidden under the bench or table edge, the body a little lower
      // on a stool: the legs folded out of sight, the body down to the seat, knees showing as a short dark band
      const cut = hh - 11;
      ctx.drawImage(img, 0, 0, w, cut, x - (w >> 1) + (p.dx || 0), y - cut - 6 + (p.dip || 0) - (p.lift || 0), w, cut);
      ctx.drawImage(img, 0, hh - 4, w, 3, x - (w >> 1) + (p.face > 0 ? 2 : -2), y - 7, w, 3);
    } else if (p.mode === "kneel" || p.mode === "crouch") {
      const cut = hh - (p.mode === "kneel" ? 6 : 9);
      shadow();
      ctx.drawImage(img, 0, 0, w, cut, x - (w >> 1), y - cut + 1 + (p.dip || 0), w, cut);
    } else if (p.mode === "tub") {
      const cut = 19;
      ctx.drawImage(img, 0, 0, w, cut, x - (w >> 1), y - cut - 4 + (p.dip || 0), w, cut);
    } else if (p.mode === "lie") {
      const q = p.quilt || ["#8a3a2a", "#c8a080"];
      fig.lie = fig.lie || {};
      const key = q.join();
      if (!fig.lie[key]) fig.lie[key] = [0, 1].map((f) => Art.heroLying(fig.h, f, fig.cls, { quilt: q, len: p.len || 1.3 }).toCanvas(1));
      ctx.drawImage(fig.lie[key][Math.sin(t * 1.7) > 0.35 ? 1 : 0], x - 18, y - (p.z || 6) - 24);
    } else if (p.mode === "fallen") {
      shadow();
      ctx.save(); ctx.translate(x, y - 3); ctx.rotate((p.face > 0 ? 1 : -1) * Math.PI / 2 * (p.tilt == null ? 1 : p.tilt)); ctx.drawImage(img, -(w >> 1), -hh + 3); ctx.restore();
    } else if (p.mode === "ride" && p.mountFig) {
      const mf = p.mountFig.img[Math.floor(t * 3) & 1][face];
      shadow();
      ctx.drawImage(mf, x - (mf.width >> 1), y - mf.height + 1);
      fig.seat = fig.seat || [0, 1].map((f) => { try { const g = Art.heroSeated(fig.h, f, fig.cls); return { 1: g.toCanvas(1), "-1": g.flipX().toCanvas(1) }; } catch (e) { return null; } });
      const s = fig.seat[Math.floor(t * 3) & 1];
      if (s) ctx.drawImage(s[face], x - (s[face].width >> 1), y - mf.height - s[face].height + 16 - (p.lift || 0));
    } else {
      shadow();
      const split = Math.min(hh - 10, 22), xx = x - (w >> 1), yy = y - hh + 1 - (p.lift || 0);
      ctx.drawImage(img, 0, split, w, hh - split, xx, yy + split, w, hh - split);
      ctx.drawImage(img, 0, 0, w, split, xx + (p.dx || 0), yy + (p.dip || 0), w, split);
    }
    ctx.globalAlpha = 1;
    return [x, y];
  }
  function drawPet(ctx, sc, pf, p, t) {
    if (!pf) return;
    const [x0, y0] = sc.st.iso(p.u, p.v), x = R(x0), y = R(y0), img = pf.img[p.still ? 0 : ((Math.floor(t * (p.run ? 8 : 2.5)) % 2) + 2) % 2][p.face > 0 ? 1 : "-1"];
    ctx.fillStyle = "rgba(20,10,4,0.3)"; ctx.fillRect(x - (img.width >> 1) + 2, y - 1, img.width - 4, 2);
    ctx.drawImage(img, x - (img.width >> 1), y - img.height - (p.lift || 0));
  }
  function drawMount(ctx, sc, mf, p, t) {
    if (!mf) return;
    const [x0, y0] = sc.st.iso(p.u, p.v), x = R(x0), y = R(y0), img = mf.img[((Math.floor(t * (p.walk ? 3 : 0.7)) % 2) + 2) % 2][p.face > 0 ? 1 : "-1"];
    ctx.fillStyle = "rgba(20,10,4,0.3)"; ctx.fillRect(x - 12, y - 1, 24, 3);
    ctx.drawImage(img, x - (img.width >> 1), y - img.height + 1);
    if (p.shine) for (let i = 0; i < 3; i++) { const ph = frac(t * 1.2 + i / 3); if (ph < 0.35) star(ctx, x - 10 + i * 9, y - img.height + 8 + i * 3, ph / 0.35); }
  }

  // ---------- little drawn things: glyphs, props, particles ----------
  const GLYPH = {
    "!": ["xx", "xx", "xx", "xx", "..", "xx"], "?": [".xxx.", "x...x", "...x.", "..x..", ".....", "..x.."], heart: ["xx.xx", "xxxxx", ".xxx.", "..x.."],
    note: ["..xx", "..x.", "..x.", "xxx.", "xx.."], z: ["xxxx", "..x.", ".x..", "xxxx"], dots: ["x.x.x"], ha: ["x.x.xxx", "x.x.x.x", "xxx.xxx", "x.x.x.x", "x.x.x.x"],
    star: ["..x..", ".xyx.", "xyyyx", ".xyx.", "..x.."], spark: ["x.x", ".x.", "x.x"], drop: [".x.", "xyx", "xyx", ".x."],
  };
  function glyph(ctx, name, x, y, col, a, outline) {
    const rows = GLYPH[name];
    if (!rows) return;
    if (a != null) ctx.globalAlpha = clamp(a, 0, 1);
    if (outline !== false) for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] !== ".") { ctx.fillStyle = "#2a1a12"; ctx.fillRect(R(x) + i - 1, R(y) + j, 1, 1); ctx.fillRect(R(x) + i + 1, R(y) + j, 1, 1); ctx.fillRect(R(x) + i, R(y) + j - 1, 1, 1); ctx.fillRect(R(x) + i, R(y) + j + 1, 1, 1); }
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const c = rows[j][i]; if (c === ".") continue; ctx.fillStyle = c === "y" ? "#fff8d8" : col; ctx.fillRect(R(x) + i, R(y) + j, 1, 1); }
    ctx.globalAlpha = 1;
  }
  function marker(ctx, x, y, a) {
    ctx.globalAlpha = a;
    K().pix(ctx, R(x) - 3, R(y), ["kkkkkkk", "kyyyyyk", ".kyyyk.", "..kyk..", "...k..."], { k: "#3a2410", y: "#f0c850" });
    ctx.globalAlpha = 1;
  }
  function star(ctx, x, y, ph) { glyph(ctx, "star", x - 2, y - 2, "#ffe08a", ph < 0.5 ? ph * 2 : (1 - ph) * 2, false); }
  // the town's own props on top of the road's (crate, broom, ladder, brush, bandage, towel, hammer, balls, duck, cake, pie, goods)
  const TP = {
    crate: ["kkkkkkk", "kbobobk", "kbbbbbk", "kbobobk", "kkkkkkk"], broom: ["......b", ".....b.", "....b..", "...b...", "..b....", "yyb....", "yyy....", "yy....."],
    ladder: ["b...b", "bbbbb", "b...b", "b...b", "bbbbb", "b...b", "b...b", "bbbbb", "b...b", "b...b", "bbbbb", "b...b", "b...b", "bbbbb", "b...b"],
    brush: ["kkkk", "kbbk", "yyyy", "y.y."], bandage: ["wwwww", "wpwpw", "wwwww"], towel: ["wwwww", "wcwcw", "wwwww", "wcwcw"], hammer: ["kkk.", "kmmk", "kkk.", ".b..", ".b..", ".b.."],
    balls: ["r.y.c"], duck: ["..yy..", ".ykyo.", "yyyy..", "yyyyyy", ".yyyy."], cake: [".pppp.", "pmpmpp", "pppppp", "oooooo"], pie: [".oooo.", "oyoyoo", "oooooo", ".kkkk."],
    goods: ["kkkkk", "kpppk", "kpkpk", "kpppk", "kkkkk"],
  };
  const TPAL = { k: "#2a1a12", b: "#8a5a2a", o: "#c8803a", y: "#e8c050", w: "#f4ecd8", p: "#e2d0a8", c: "#9ac8e8", m: "#8a8a92", r: "#d84a3a", g: "#5e8a3a" };
  const PROPS = new Map();
  function propImg(name) {
    if (PROPS.has(name)) return PROPS.get(name);
    let c = null;
    if (TP[name]) {
      const rows = TP[name]; c = document.createElement("canvas"); c.width = Math.max(...rows.map((r) => r.length)); c.height = rows.length;
      K().pix(c.getContext("2d"), 0, 0, rows, TPAL);
    } else if (root.Stage && name) {
      const g = Stage.prop(name); c = document.createElement("canvas"); c.width = g.w; c.height = g.h;
      const x = c.getContext("2d"); g.px.forEach((col, i) => { if (col) { x.fillStyle = col; x.fillRect(i % g.w, Math.floor(i / g.w), 1, 1); } });
    }
    PROPS.set(name, c);
    return c;
  }
  function drawProp(ctx, name, x, y, flip) {
    const c = propImg(name);
    if (!c) return;
    if (flip) { ctx.save(); ctx.translate(R(x) + c.width, 0); ctx.scale(-1, 1); ctx.drawImage(c, 0, R(y) - c.height); ctx.restore(); }
    else ctx.drawImage(c, R(x), R(y) - c.height);
  }
  function coin(ctx, x, y, ph) { const w = Math.max(0, R(Math.abs(Math.cos(ph)) * 2)); ctx.fillStyle = "#8a5a20"; ctx.fillRect(R(x) - w, R(y) - 2, w * 2 + 1, 5); ctx.fillStyle = "#e8b048"; ctx.fillRect(R(x) - w + (w ? 1 : 0), R(y) - 1, Math.max(1, w * 2 - 1), 3); if (w) { ctx.fillStyle = "#fff0b0"; ctx.fillRect(R(x) - w + 1, R(y) - 1, 1, 1); } }
  function arc(ctx, from, to, ph, h, fn) { const x = lerp(from[0], to[0], ph), y = lerp(from[1], to[1], ph) - Math.sin(ph * Math.PI) * h; fn(x, y); }
  function puff(ctx, x, y, t, col, n, spread) {
    for (let i = 0; i < (n || 5); i++) { const ph = frac(t * 1.3 + i / (n || 5)); ctx.globalAlpha = (1 - ph) * 0.7; ctx.fillStyle = col; ctx.fillRect(R(x + Math.sin(i * 2.3) * (spread || 6) * ph), R(y - ph * 10), 2, 2); }
    ctx.globalAlpha = 1;
  }
  function sparks(ctx, x, y, ph) { for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.4, d = ph * 12; ctx.fillStyle = ph < 0.4 ? "#fff8c0" : "#ffb040"; ctx.fillRect(R(x + Math.cos(a) * d), R(y + Math.sin(a) * d + ph * ph * 10), 1, 1); } }
  function steam(ctx, x, y, t, w) { for (let i = 0; i < 6; i++) { const ph = frac(t * 0.35 + i / 6); ctx.globalAlpha = (1 - ph) * 0.4; ctx.fillStyle = "#f4f8fc"; ctx.fillRect(R(x + (i - 3) * (w || 4) / 3 + Math.sin(ph * 6 + i) * 2), R(y - ph * 22), 3, 3); } ctx.globalAlpha = 1; }

  // ---------- the plan: who is where when, and what the act shows ----------
  class Plan {
    constructor(sc, cast, block) {
      this.sc = sc; this.cast = cast; this.block = block; this.tag = block.scene || {};
      this.t = 0; this.tracks = new Map(); this.fx = []; this.marks = {}; this.actors = []; this.sitters = {}; this.pieces = [];
    }
    spot(...names) { for (const n of names) if (this.sc.spots[n]) return this.sc.spots[n]; return this.sc.spots.act || [6, 6, 1]; }
    actor(id, kind, ref, at) { const a = { id, kind, ref, at: at.slice(0, 2), face: at[2] || 1 }; this.actors.push(a); this.tracks.set(id, []); return a; }
    seg(a, t0, t1, o) { this.tracks.get(a.id).push(Object.assign({ t0, t1 }, o)); }
    // at the table for breakfast or the evening, whoever sits there stays seated whatever the act does with them
    walk(a, from, to, t0, t1, o) {
      if (this.sitters[a.id]) return this.hold(a, from, t0, t1, { face: o && o.faceEnd });
      this.seg(a, t0, t1, Object.assign({ mode: "walk", from, to }, o));
    }
    hold(a, at, t0, t1, o) {
      const seat = this.sitters[a.id];
      if (seat) return this.seg(a, t0, t1, Object.assign({}, o, { mode: seat[3] || "sit", from: seat, to: seat, face: o && o.face != null ? o.face : seat[2] || 1 }));
      this.seg(a, t0, t1, Object.assign({ mode: "stand", from: at, to: at }, o));
    }
    effect(t0, t1, draw, z) { this.fx.push({ t0, t1, draw, z: z || 0 }); }
    mark(name, t) { if (this.marks[name] == null) this.marks[name] = t; }
    // the state of an actor at time t: the latest segment that has started
    at(a, t) {
      const tr = this.tracks.get(a.id), s = tr.filter((x) => x.t0 <= t).pop() || tr[0];
      if (!s) return { u: a.at[0], v: a.at[1], face: a.face, mode: "stand" };
      const k = s.mode === "walk" || s.move ? io(seg(t, s.t0, s.t1)) : 1, from = s.from || a.at, to = s.to || from;
      const p = { u: lerp(from[0], to[0], k), v: lerp(from[1], to[1], k), mode: s.mode, face: s.face != null ? s.face : (to[0] - to[1]) - (from[0] - from[1]) >= 0 ? 1 : -1 };
      if (s.mode === "walk") { if (t >= s.t1) p.mode = s.end || "stand"; else p.step = Math.max(0, Math.floor((t - s.t0) * (s.run ? 9 : 6))); if (t >= s.t1 && s.faceEnd != null) p.face = s.faceEnd; }
      if (s.pose) s.pose(t - s.t0, p, (t - s.t0) / Math.max(0.01, s.t1 - s.t0));
      return p;
    }
  }
  const idle = (ph) => (lt, p) => { p.dip = frac(lt / 3.4 + ph) < 0.42 ? 1 : 0; p.shut = frac(lt / 3.7 + ph * 7) < 0.045; };
  const handOf = (p, sc) => { const [x, y] = sc.st.iso(p.u, p.v); return [x + (p.face > 0 ? 8 : -8), y - 14 - (p.lift || 0) + (p.mode === "sit" ? 5 : p.mode === "kneel" ? 6 : 0)]; };
  const headOf = (p, sc) => { const [x, y] = sc.st.iso(p.u, p.v); return [x, y - 33 - (p.lift || 0) + (p.mode === "sit" ? 5 : p.mode === "kneel" ? 6 : p.mode === "tub" ? 12 : 0)]; };
  const toward = (from, to) => ((to[0] - to[1]) - (from[0] - from[1]) >= 0 ? 1 : -1);
  const near = (at, du, dv) => [at[0] + du, at[1] + dv];
  // a step to the hero's right on screen, far enough apart that two figures never overlap
  const beside = (at, k) => [at[0] + 1.1 * (k || 1), at[1] - 1.0 * (k || 1)];

  // ---------- the acts ----------
  // each act takes the plan with the hero standing at the act's spot at P.t and lays out its beats; it returns its length.
  // marks: act (the act starts), peak (its moment), after (what came of it): the captions land on these.
  const ACT = {};
  const T0 = 0.2;
  function npcAt(P) { return P.npc ? P.npc.at : null; }
  function other(P) { const w = P.tag.who; return w === "mate" ? P.mate || P.other || P.npc : w === "other" ? P.other || P.mate || P.npc : w === "pet" ? P.petA : w === "mount" ? P.mountA : w === "crowd" || w === "child" ? P.crowdA[0] || P.npc : P.npc || P.mate || P.other; }

  ACT.walk = (P, h, t) => {
    const a = P.spot("act"), far = near(a, -3.2, 1.6), m = P.tag.who === "mate" || P.block.act === "crew" ? P.mate : null;
    if (m) { P.walk(m, P.posOf(m), near(a, 0.6, -0.9), t - 0.6, t); P.walk(m, near(a, 0.6, -0.9), near(far, 0.6, -0.9), t + 0.2, t + 2.8, { faceEnd: 1 });
      P.walk(m, near(far, 0.6, -0.9), near(a, 2.0, -2.1), t + 3.8, t + 6.2); talkTo(P, h, m, t + 2.8, 1.0); }
    P.mark("act", t); P.walk(h, a, far, t, t + 2.6, { faceEnd: -1 });
    P.hold(h, far, t + 2.6, t + 3.6, { pose: (lt, p) => { p.face = Math.floor(lt * 1.6) % 2 ? 1 : -1; } });
    P.mark("peak", t + 2.8); P.walk(h, far, near(a, 1.4, -1.2), t + 3.6, t + 6.0); P.mark("after", t + 5.2);
    P.effect(t + 2.6, t + 3.6, (ctx, lt, S) => glyph(ctx, "?", S.head(h)[0] + 6, S.head(h)[1] - 4, "#f4ecd8", seg(lt, 0, 0.2)));
    return 6.2;
  };
  ACT.look = (P, h, t) => {
    const at = P.spot("act"), tgt = P.prop ? null : other(P);
    P.mark("act", t);
    P.hold(h, at, t, t + 3.6, { pose: (lt, p) => { p.dx = lt > 0.6 ? 1 : 0; p.dip = lt > 1.2 && lt < 2.6 ? 1 : 0; if (tgt) p.face = toward(at, P.posOf(tgt)); } });
    P.mark("peak", t + 1.2);
    P.effect(t + 0.6, t + 3.6, (ctx, lt, S) => {
      const [x, y] = S.hand(h);
      if (P.prop) { drawProp(ctx, P.prop, x - 3, y - 2 + R(Math.sin(lt * 2)), S.p(h).face < 0); if (lt > 1) star(ctx, x, y - 8, frac(lt * 0.7)); }
      else glyph(ctx, lt > 1.6 ? "!" : "?", S.head(h)[0] + 6, S.head(h)[1] - 4, "#f4ecd8", seg(lt, 0, 0.2));
    });
    P.mark("after", t + 2.6);
    P.hold(h, at, t + 3.6, t + 4.6, { pose: idle(0.2) });
    return 4.8;
  };
  function talkTo(P, h, b, t, dur, opts) {
    const o = opts || {}, at = P.posOf(h), bt = P.posOf(b);
    P.hold(h, at, t, t + dur, { face: toward(at, bt), pose: (lt, p) => { p.dip = frac(lt * 1.1) < 0.25 ? 1 : 0; if (o.hands) p.lift = frac(lt * 0.9) < 0.12 ? 1 : 0; } });
    if (b && b.kind !== "pet" && b.kind !== "mount") P.hold(b, bt, t, t + dur, { face: toward(bt, at), pose: (lt, p) => { p.dip = frac(lt * 1.1 + 0.5) < 0.25 ? 1 : 0; } });
    P.effect(t, t + dur, (ctx, lt, S) => {
      const turn = Math.floor(lt / 1.1) % 2, who = turn ? b : h;
      if (!who) return;
      const [x, y] = S.head(who), ph = frac(lt / 1.1);
      glyph(ctx, o.mark && turn === 0 ? o.mark : "dots", x - 2, y - 6 - (ph < 0.15 ? 1 : 0), "#f4ecd8", ph < 0.1 ? ph * 10 : ph > 0.85 ? (1 - ph) * 6 : 1);
    });
  }
  ACT.talk = (P, h, t) => {
    const b = other(P), at = P.spot("act");
    if (b && b.kind !== "folk") P.walk(b, P.posOf(b), beside(at), t, t + 1.0, { faceEnd: -1 });
    P.mark("act", t); talkTo(P, h, b, t + 0.6, 4.4, { hands: true }); P.mark("peak", t + 2.4);
    P.effect(t + 4.4, t + 5.6, (ctx, lt, S) => glyph(ctx, "ha", S.head(h)[0] - 3, S.head(h)[1] - 10 - R(lt * 3), "#ffe08a", 1 - lt / 1.2)); P.mark("after", t + 4.4);
    P.hold(h, at, t + 5, t + 6, { pose: idle(0.1) });
    return 6.0;
  };
  ACT.listen = (P, h, t) => {
    const b = other(P), at = P.spot("act");
    P.mark("act", t);
    if (b) P.hold(b, P.posOf(b), t, t + 5.2, { face: toward(P.posOf(b), at), pose: (lt, p) => { p.lift = frac(lt * 0.8) < 0.1 ? 1 : 0; p.dx = frac(lt * 0.6) < 0.3 ? 1 : 0; } });
    P.hold(h, at, t, t + 5.2, { face: b ? toward(at, P.posOf(b)) : -1, pose: (lt, p) => { p.dip = frac(lt / 1.6) < 0.18 ? 1 : 0; } });
    P.effect(t + 0.4, t + 5.2, (ctx, lt, S) => { if (!b) return; const [x, y] = S.head(b), ph = frac(lt / 1.2); glyph(ctx, P.prop === "cards" ? "star" : "dots", x - 2, y - 6, "#f4ecd8", ph < 0.1 ? ph * 10 : ph > 0.85 ? (1 - ph) * 6 : 1); });
    if (P.prop) P.effect(t + 0.4, t + 5.2, (ctx, lt, S) => { const [x, y] = S.hand(b || h); drawProp(ctx, P.prop, x - 3, y + 1, false); });
    P.mark("peak", t + 2.6);
    P.effect(t + 3.6, t + 5.2, (ctx, lt, S) => glyph(ctx, "!", S.head(h)[0] + 5, S.head(h)[1] - 6, "#ffe08a", seg(lt, 0, 0.2))); P.mark("after", t + 3.6);
    return 5.4;
  };
  function handover(P, from, to, t, prop, money) {
    P.effect(t, t + 0.8, (ctx, lt, S) => {
      const a = S.hand(from), b = S.hand(to), ph = io(seg(lt, 0, 0.8));
      if (money) for (let i = 0; i < 3; i++) arc(ctx, a, b, clamp(ph - i * 0.12, 0, 1), 10, (x, y) => coin(ctx, x, y, lt * 9 + i));
      else arc(ctx, a, b, ph, 8, (x, y) => drawProp(ctx, prop || "goods", x - 3, y + 2, false));
    }, 2);
    P.effect(t + 0.8, t + 1.6, (ctx, lt, S) => { const [x, y] = S.hand(to); if (!money) drawProp(ctx, prop || "goods", x - 3, y + 2, false); star(ctx, x, y - 6, lt / 0.8); }, 2);
  }
  ACT.give = (P, h, t) => {
    const b = other(P) || P.npc, at = P.spot("act", "counter");
    P.mark("act", t); talkTo(P, h, b, t, 1.6);
    P.effect(t, t + 2.2, (ctx, lt, S) => { const [x, y] = S.hand(h); drawProp(ctx, P.prop || "goods", x - 3, y + 2, S.p(h).face < 0); });
    handover(P, h, b, t + 2.2, P.prop); P.mark("peak", t + 2.2);
    P.hold(h, at, t + 2.2, t + 4.6, { pose: (lt, p) => { p.dip = lt < 0.4 ? 1 : 0; } });
    if (b) P.hold(b, P.posOf(b), t + 3.0, t + 4.6, { pose: (lt, p) => { p.lift = lt < 0.5 && Math.floor(lt * 8) % 2 ? 1 : 0; } });
    P.effect(t + 3.0, t + 4.4, (ctx, lt, S) => { if (b) glyph(ctx, "heart", S.head(b)[0] - 2, S.head(b)[1] - 8 - R(lt * 4), "#e8566a", 1 - lt / 1.4); }); P.mark("after", t + 3.0);
    return 4.8;
  };
  ACT.get = (P, h, t) => {
    const b = other(P) || P.npc, at = P.spot("act", "counter");
    P.mark("act", t); talkTo(P, h, b, t, 1.6);
    if (b) P.effect(t, t + 2.2, (ctx, lt, S) => { const [x, y] = S.hand(b); drawProp(ctx, P.prop || "goods", x - 3, y + 2, false); });
    handover(P, b || h, h, t + 2.2, P.prop); P.mark("peak", t + 2.2);
    P.hold(h, at, t + 3.0, t + 4.8, { pose: (lt, p) => { p.lift = lt < 0.6 && Math.floor(lt * 6) % 2 ? 1 : 0; } });
    P.effect(t + 3.0, t + 4.8, (ctx, lt, S) => { const [x, y] = S.hand(h); drawProp(ctx, P.prop || "goods", x - 3, y + 2 - R(Math.sin(lt * 3)), S.p(h).face < 0); }); P.mark("after", t + 3.2);
    return 5.0;
  };
  function money(P, h, t, out) {
    const b = other(P) || P.npc;
    P.mark("act", t); talkTo(P, h, b, t, 1.4);
    handover(P, out ? h : b || h, out ? b || h : h, t + 1.6, null, true); P.mark("peak", t + 1.6);
    P.effect(t + 2.6, t + 4.2, (ctx, lt, S) => { const w = out ? b : h; if (w) glyph(ctx, out ? "dots" : "star", S.head(w)[0] - 2, S.head(w)[1] - 8, "#ffe08a", 1 - lt / 1.6); }); P.mark("after", t + 2.6);
    P.hold(h, P.posOf(h), t + 2.6, t + 4.4, { pose: idle(0.3) });
    return 4.6;
  }
  ACT.pay = (P, h, t) => money(P, h, t, true);
  ACT.paid = (P, h, t) => money(P, h, t, false);
  ACT.haggle = (P, h, t) => {
    const b = P.npc || other(P), at = P.spot("counter", "act");
    P.mark("act", t);
    P.hold(h, at, t, t + 4.4, { face: b ? toward(at, P.posOf(b)) : 1, pose: (lt, p) => { const k = Math.floor(lt / 0.55) % 4; p.lift = k === 1 ? 1 : 0; p.dx = k === 3 ? (p.face > 0 ? 1 : -1) : 0; } });
    if (b) P.hold(b, P.posOf(b), t, t + 4.4, { face: toward(P.posOf(b), at), pose: (lt, p) => { const k = Math.floor(lt / 0.55) % 4; p.dip = k === 2 ? 1 : 0; p.face = k === 0 && lt > 2 ? -p.face : p.face; } });
    P.effect(t, t + 4.4, (ctx, lt, S) => {
      if (!b) return;
      const a = S.head(h), c = S.head(b), k = Math.floor(lt / 0.55) % 4, mx = (a[0] + c[0]) / 2, my = Math.min(a[1], c[1]) + 6;
      coin(ctx, mx, my - R(Math.abs(Math.sin(lt * 3)) * 3), lt * 6);
      glyph(ctx, k < 2 ? "?" : "!", (k % 2 ? c : a)[0] - 2, (k % 2 ? c : a)[1] - 8, "#f4ecd8", 1);
    });
    P.mark("peak", t + 2.2);
    handover(P, b || h, h, t + 4.4, P.prop || "goods"); handover(P, h, b || h, t + 4.6, null, true);
    P.effect(t + 5.2, t + 6.4, (ctx, lt, S) => { const [x, y] = S.hand(h); sparks(ctx, x, y - 2, lt / 1.2); }); P.mark("after", t + 4.6);
    P.hold(h, at, t + 4.4, t + 6.4, { pose: idle(0.4) });
    return 6.6;
  };
  function bounce(kind) {
    return (P, h, t) => {
      const at = P.spot("act"), b = other(P);
      P.mark("act", t); if (b && kind !== "bow") talkTo(P, h, b, t, 1.4);
      P.mark("peak", t + 1.4);
      P.hold(h, at, t + 1.4, t + 4.4, { face: b ? toward(at, P.posOf(b)) : -1, pose: (lt, p) => {
        if (kind === "laugh") { p.lift = Math.floor(lt * 6) % 2 && lt < 2.2 ? 1 : 0; p.dip = lt < 2.2 && Math.floor(lt * 6) % 2 === 0 ? 1 : 0; }
        if (kind === "shock") { p.lift = lt < 0.3 ? R(Math.sin((lt / 0.3) * Math.PI) * 5) : 0; p.dx = lt > 0.3 && lt < 1.6 ? -p.face : 0; }
        if (kind === "bow") { p.dip = lt > 0.3 && lt < 1.8 ? 3 : 0; }
        if (kind === "wave") { p.lift = Math.floor(lt * 4) % 2 && lt < 2 ? 1 : 0; }
      } });
      P.effect(t + 1.4, t + 4.0, (ctx, lt, S) => {
        const [x, y] = S.head(h);
        if (kind === "laugh") { glyph(ctx, "ha", x - 3 + (Math.floor(lt * 3) % 2 ? 4 : -2), y - 10 - R(lt * 3), "#ffe08a", 1 - lt / 2.6); }
        if (kind === "shock") glyph(ctx, "!", x + (S.p(h).face > 0 ? 6 : -8), y - 8, "#ff8a6a", lt < 2 ? 1 : 1 - (lt - 2) / 0.6);
        if (kind === "wave") { const w = Math.floor(lt * 5) % 2, hx = x + (S.p(h).face > 0 ? 9 : -10) + (w ? 1 : -1); ctx.fillStyle = "#e8b088"; ctx.fillRect(R(hx), R(y + 6), 2, 3); ctx.fillStyle = "#c98e62"; ctx.fillRect(R(hx), R(y + 8), 2, 1); }
        if (kind === "bow" && b) glyph(ctx, "star", S.head(b)[0] - 2, S.head(b)[1] - 8, "#ffe08a", 1 - lt / 2.6);
      });
      P.mark("after", t + 3.0);
      return 4.6;
    };
  }
  ACT.laugh = bounce("laugh"); ACT.shock = bounce("shock"); ACT.wave = bounce("wave"); ACT.bow = bounce("bow");
  ACT.hug = (P, h, t) => {
    const b = other(P), at = P.spot("act");
    P.mark("act", t);
    if (b) P.walk(b, P.posOf(b), near(at, 0.6, -0.5), t, t + 1.2, { faceEnd: -1 });
    P.hold(h, at, t + 1.2, t + 3.8, { face: 1, pose: (lt, p) => { p.dx = lt < 2 ? 1 : 0; p.dip = lt < 2 ? 1 : 0; } });
    if (b) P.hold(b, near(at, 0.6, -0.5), t + 1.2, t + 3.8, { face: -1, pose: (lt, p) => { p.dx = lt < 2 ? -1 : 0; } });
    P.effect(t + 1.4, t + 3.8, (ctx, lt, S) => { const [x, y] = S.head(h); for (let i = 0; i < 3; i++) { const ph = frac(lt * 0.7 + i / 3); glyph(ctx, "heart", x + 2 + (i - 1) * 5, y - 6 - R(ph * 12), "#e8566a", 1 - ph); } });
    P.mark("peak", t + 1.4); P.mark("after", t + 2.6);
    return 4.0;
  };
  ACT.sit = (P, h, t) => {
    const s = P.sitters.hero || P.spot("bench", "seat", "pew", "bale", "act"), line = String(P.block.line || "");
    const dozes = /\b(asleep|doze|dozes|nap|naps|nods? off|sleeps?)\b/i.test(line), warm = /\b(breaks|thanks|smiles?|grateful|kind|warm|helps|lovely|good)\b/i.test(line);
    if (!P.sitters.hero) P.walk(h, P.posOf(h), s, t, t + 1.2, { end: "sit" });
    P.mark("act", t + 1.2);
    P.hold(h, s, t + 1.2, t + 5.6, { mode: "sit", face: s[2] || -1, pose: (lt, p) => { p.dip = frac(lt / 3) < 0.4 ? 1 : 0; p.shut = dozes && lt > 2.6 && lt < 4.2; } });
    P.mark("peak", t + 2.8);
    if (P.petA && !P.petA.follow) P.walk(P.petA, P.posOf(P.petA), near(s, 0.8, 0.4), t + 1.4, t + 2.6, { pet: true });
    if (dozes) P.effect(t + 2.8, t + 5.6, (ctx, lt, S) => { const [x, y] = S.head(h); if (lt > 1.6) glyph(ctx, "z", x + 6 + R(lt * 2 % 3), y - 4 - R((lt * 3) % 6), "#e8e2d4", 0.9); });
    // whoever they sat with (the patient, the old folk) is the better for it
    if (warm) P.effect(t + 4.0, t + 5.6, (ctx, lt, S) => { const pt = P.sc.spots.patient, [x, y] = pt ? P.sc.st.iso(pt[0], pt[1]) : S.head(h); glyph(ctx, "heart", x - 2, y - (pt ? 16 : 8) - R(lt * 6), "#e8566a", 1 - lt / 1.6); });
    P.mark("after", t + 4.0);
    return 5.8;
  };
  function onTheMove(P, h, t, food) {
    const a = P.posOf(h), b = near(a, -3.6, 2.2);
    P.mark("act", t);
    P.walk(h, a, b, t, t + 4.4, { faceEnd: -1 });
    P.effect(t, t + 5.6, (ctx, lt, S) => {
      const [x, y] = S.hand(h), up = frac(lt / 1.1) < 0.35, f = S.p(h).face;
      if (lt < 4.6) drawProp(ctx, food, x - 3 - (up ? f * 3 : 0), y + 2 - (up ? 7 : 0), f < 0);
      if (up && lt < 4.6) { ctx.fillStyle = "#e8c890"; ctx.fillRect(R(x - f * 4), R(y + 4), 1, 1); }
    }, 1);
    P.mark("peak", t + 2.0);
    P.hold(h, b, t + 4.4, t + 5.8, { face: -1, pose: (lt, p) => { p.dip = lt > 0.3 && lt < 1.0 ? 1 : 0; } });
    P.effect(t + 4.6, t + 5.8, (ctx, lt, S) => { const [x, y] = S.head(h); glyph(ctx, "heart", x + 4, y - 6 - R(lt * 4), "#e8566a", 1 - lt / 1.2); });
    P.mark("after", t + 4.4);
    return 6.0;
  }
  function foodAct(kind) {
    return (P, h, t) => {
      if (P.block.act === "breakfast" && ["street", "market", "square"].includes(P.sc.set)) return onTheMove(P, h, t, P.prop || "bun");
      const sitting = P.sc.set === "tavern" || P.sc.set === "room" || P.sc.set === "poorhouse" || !!P.sitters.hero;
      const s = P.sitters.hero || (sitting ? P.spot("seat", "act") : P.spot("act"));
      if (sitting) P.walk(h, P.posOf(h), s, t, t + 1.0, { end: "sit" });
      const t1 = t + (sitting ? 1.0 : 0), food = P.prop || (kind === "drink" ? "mug" : "bowl");
      P.mark("act", t1);
      if (P.npc && P.sc.set === "tavern" && P.sc.night === false) {
        const end = P.sc.spots.barend || P.sc.spots.bar || near(s, 3, -3), by = near(s, 1.0, -0.9);
        P.walk(P.npc, P.npc.at, end, t1 - 0.6, t1 + 0.2); P.walk(P.npc, end, by, t1 + 0.2, t1 + 1.2, { faceEnd: -1 });
        P.walk(P.npc, by, end, t1 + 2.0, t1 + 3.0); P.walk(P.npc, end, P.npc.at, t1 + 3.0, t1 + 3.8);
        handover(P, P.npc, h, t1 + 1.2, food);
      }
      const start = t1 + (P.npc && P.sc.set === "tavern" ? 2.0 : 0.4);
      P.hold(h, s, t1, start + 4.6, { mode: sitting ? "sit" : "stand", face: s[2] || -1, pose: (lt, p) => { p.dip = frac(lt / 1.2) < 0.3 ? 1 : 0; } });
      P.mark("peak", start + 1.2);
      P.effect(start, start + 4.6, (ctx, lt, S) => {
        const [x, y] = S.hand(h), up = frac(lt / 1.2) < 0.35, f = S.p(h).face;
        drawProp(ctx, food, x - 3 - (up ? f * 3 : 0), y + (sitting ? 6 : 2) - (up ? 7 : 0), f < 0);
        if (kind === "eat" && up) { ctx.fillStyle = "#e8c890"; ctx.fillRect(R(x - f * 4), R(y + 2 + (lt * 6) % 4), 1, 1); }
        if (kind === "eat" && lt > 1.2 && lt < 2.4) glyph(ctx, "heart", S.head(h)[0] - 2, S.head(h)[1] - 6 - R((lt - 1.2) * 6), "#e8566a", 1 - (lt - 1.2) / 1.2);
        if (/bowl|tea|pot|cup/.test(food) && !up) steam(ctx, x, y - 2, lt, 3);
      }, 1);
      P.mark("after", start + 2.6);
      return start + 4.8 - t;
    };
  }
  ACT.eat = foodAct("eat"); ACT.drink = foodAct("drink");
  ACT.read = (P, h, t) => {
    const at = P.spot("board", "act"), b = P.sc.set === "guild" || P.sc.set === "square";
    P.mark("act", t);
    P.hold(h, at, t, t + 5, { face: at[2] || 1, pose: (lt, p) => { p.dip = Math.floor(lt / 1.2) % 2; p.dx = lt > 2.6 ? 1 : 0; } });
    P.effect(t, t + 5, (ctx, lt, S) => {
      const [x, y] = S.hand(h);
      if (!b || P.prop) drawProp(ctx, P.prop || "paper", x - 3, y, S.p(h).face < 0);
      if (lt > 2.4 && lt < 3.6) glyph(ctx, "!", S.head(h)[0] + 5, S.head(h)[1] - 6, "#ffe08a", 1);
    });
    P.mark("peak", t + 2.4); P.mark("after", t + 3.6);
    return 5.2;
  };
  ACT.write = (P, h, t) => {
    const s = P.spot("counter", "seat", "act");
    P.mark("act", t);
    P.hold(h, s, t, t + 5, { pose: (lt, p) => { p.dip = 1; p.dx = Math.floor(lt * 4) % 2; } });
    P.effect(t, t + 5, (ctx, lt, S) => {
      const [x, y] = S.hand(h); drawProp(ctx, P.prop || "ledger", x - 3, y + 3, false);
      for (let i = 0; i < Math.min(5, Math.floor(lt * 1.5)); i++) { ctx.fillStyle = "#2a1a12"; ctx.fillRect(R(x - 2 + i), R(y - 1), 1, 1); }
      if (frac(lt * 4) < 0.5) { ctx.fillStyle = "#f4ecd8"; ctx.fillRect(R(x + 3), R(y - 6), 1, 4); }
    });
    P.mark("peak", t + 2.2); P.mark("after", t + 3.6);
    return 5.2;
  };
  ACT.carry = (P, h, t) => {
    const a = P.spot("crate", "act"), b = near(P.spot("act"), 2.6, 1.6), prop = P.prop && /crate|sack|basket|trunk|pail|wood|ladder/.test(P.prop) ? P.prop : "crate";
    P.mark("act", t);
    const leg = (t0, from, to, loaded) => {
      P.walk(h, from, to, t0, t0 + 1.8);
      if (loaded) P.effect(t0, t0 + 1.8, (ctx, lt, S) => { const [x, y] = S.head(h); drawProp(ctx, prop, x - 3, y - 1 + (Math.floor(lt * 6) % 2), false); });
    };
    leg(t, P.posOf(h), a, false);
    P.hold(h, a, t + 1.8, t + 2.4, { mode: "crouch" });
    leg(t + 2.4, a, b, true); P.mark("peak", t + 2.6);
    P.hold(h, b, t + 4.2, t + 5.0, { mode: "crouch" });
    P.effect(t + 4.2, t + 6.4, (ctx, lt, S) => { const [x, y] = P.sc.st.iso(b[0] + 0.6, b[1] + 0.2); drawProp(ctx, prop, x - 3, y, false); if (lt < 0.5) puff(ctx, x, y, lt, "#d8c8a8", 4); });
    P.hold(h, b, t + 5.0, t + 6.4, { pose: (lt, p) => { p.lift = lt < 0.4 ? 1 : 0; p.face = -1; } });
    P.effect(t + 5.0, t + 6.4, (ctx, lt, S) => { const [x, y] = S.head(h); glyph(ctx, "drop", x + 6, y + 2 + R(lt * 6), "#9ac8f0", 1 - lt / 1.4); });
    P.mark("after", t + 5.0);
    return 6.6;
  };
  function tool(kind) {
    // sweep, scrub, mend: a steady working rhythm with the tool, and what it leaves behind
    return (P, h, t) => {
      const at = P.spot(kind === "sweep" ? "broom" : kind === "mend" ? "bench" : "act", "act"), mode = kind === "scrub" ? "kneel" : kind === "mend" ? "sit" : "stand";
      const path = kind === "sweep" ? [at, near(at, 1.8, 0.4)] : [at, at];
      P.mark("act", t);
      P.seg(h, t, t + 5.4, { mode, from: path[0], to: path[1], move: true, face: 1, pose: (lt, p) => { p.dx = Math.floor(lt * (kind === "mend" ? 2 : 3)) % 2 ? 1 : 0; p.dip = mode === "kneel" ? Math.floor(lt * 3) % 2 : 0; } });
      P.effect(t, t + 5.4, (ctx, lt, S) => {
        const [x, y] = S.hand(h), ph = Math.floor(lt * 3) % 2;
        if (kind === "sweep") { drawProp(ctx, "broom", x - 2 + (ph ? 3 : -2), y + 14, false); if (ph) puff(ctx, x + 4, y + 13, lt, "#d8c8a8", 3, 8); }
        if (kind === "scrub") { drawProp(ctx, "brush", x - 2 + (ph ? 3 : -3), y + 9, false); for (let i = 0; i < 3; i++) { const b = frac(lt * 0.8 + i / 3); ctx.globalAlpha = 1 - b; ctx.fillStyle = "#e8f4ff"; ctx.fillRect(R(x - 4 + i * 4), R(y + 8 - b * 8), 2, 2); ctx.globalAlpha = 1; } }
        if (kind === "mend") { drawProp(ctx, P.prop || "boots", x - 3, y + 6, false); if (frac(lt * 2) < 0.2) star(ctx, x + 2, y + 1, frac(lt * 2) / 0.2); }
      });
      P.mark("peak", t + 2.0);
      P.effect(t + 3.6, t + 5.4, (ctx, lt, S) => { const [x, y] = S.hand(h); if (kind !== "mend") for (let i = 0; i < 3; i++) star(ctx, x - 8 + i * 8, y + 10 - i * 2, frac(lt * 0.9 + i / 3)); });
      P.mark("after", t + 3.6);
      return 5.6;
    };
  }
  ACT.sweep = tool("sweep"); ACT.scrub = tool("scrub"); ACT.mend = tool("mend");
  ACT.climb = (P, h, t) => {
    const at = P.spot("door", "act"), base = near(at, 0.3, 0.6);
    P.mark("act", t);
    P.effect(t, t + 6, (ctx) => { const [x, y] = P.sc.st.iso(base[0], base[1]); for (let k = 0; k < 3; k++) drawProp(ctx, "ladder", x - 2, y - k * 15, false); }, -1);
    P.walk(h, P.posOf(h), base, t, t + 0.8);
    P.hold(h, base, t + 0.8, t + 4.6, { pose: (lt, p) => { p.lift = R(lt < 1.6 ? lt / 1.6 * 26 : lt < 2.8 ? 26 : Math.max(0, 26 - (lt - 2.8) / 1.0 * 26)); p.face = 1; } });
    P.mark("peak", t + 2.4);
    P.effect(t + 2.4, t + 3.6, (ctx, lt, S) => { const [x, y] = S.head(h); glyph(ctx, "!", x + 6, y - 6, "#ffe08a", 1); });
    P.mark("after", t + 3.8);
    P.hold(h, base, t + 4.6, t + 5.8, { pose: idle(0.1) });
    return 6.0;
  };
  ACT.pray = (P, h, t) => {
    const at = P.spot("kneel", "altar", "act");
    P.walk(h, P.posOf(h), at, t, t + 1.0, { end: "kneel", faceEnd: -1 });
    P.mark("act", t + 1.0);
    P.hold(h, at, t + 1.0, t + 6.0, { mode: "kneel", face: -1, pose: (lt, p) => { p.dip = frac(lt / 2.4) < 0.5 ? 1 : 0; p.shut = lt > 0.6; } });
    P.effect(t + 1.2, t + 6.0, (ctx, lt, S) => {
      const [x, y] = S.head(h);
      K().glow(ctx, x, y + 6, 22, "#fff0b0", 0.18 * seg(lt, 0, 1.4));
      for (let i = 0; i < 6; i++) { const ph = frac(lt * 0.35 + i / 6); ctx.globalAlpha = (1 - ph) * seg(lt, 0, 1); ctx.fillStyle = "#fff4c0"; ctx.fillRect(R(x - 8 + i * 3 + Math.sin(ph * 6 + i) * 2), R(y + 8 - ph * 26), 1, 1); }
      ctx.globalAlpha = 1;
    });
    P.mark("peak", t + 2.8); P.mark("after", t + 4.4);
    return 6.2;
  };
  function music(kind) {
    return (P, h, t) => {
      const at = P.spot("fountain", "act"), crowd = P.crowdA.slice(0, 4), inst = kind === "play" ? (P.prop && /lute|whistle|drum/.test(P.prop) ? P.prop : "lute") : null;
      P.mark("act", t);
      P.hold(h, at, t, t + 6.4, { face: -1, pose: (lt, p) => { p.dip = frac(lt * 1.7) < 0.3 ? 1 : 0; p.lift = kind === "dance" ? (Math.floor(lt * 4) % 2) * 2 : kind === "perform" && frac(lt * 0.7) < 0.15 ? 2 : 0; if (kind === "dance") p.face = Math.floor(lt * 2) % 2 ? 1 : -1; p.dx = kind === "perform" ? (Math.floor(lt * 1.4) % 2 ? 1 : -1) : 0; } });
      // the crowd drifts in from the edge of the set to its places in an arc before the hero, and stays to watch
      crowd.forEach((c, i) => {
        const to = c.at, from = near(P.sc.spots.in || to, (i % 2 ? 1 : -1) * 0.8, i * 0.5);
        P.walk(c, from, to, t + 0.6 + i * 0.5, t + 1.8 + i * 0.5, { faceEnd: toward(to, at) });
        P.hold(c, to, t + 1.8 + i * 0.5, t + 6.4, { face: toward(to, at), pose: (lt, p) => { p.dip = frac(lt * 1.7 + i * 0.3) < 0.3 ? 1 : 0; } });
      });
      P.effect(t, t + 6.4, (ctx, lt, S) => {
        const [x, y] = S.head(h), f = S.p(h).face;
        if (inst) drawProp(ctx, inst, x - (f > 0 ? -2 : 8), y + 22, f < 0);
        if (kind === "juggle") for (let i = 0; i < 3; i++) { const ph = frac(lt * 1.3 + i / 3); ctx.fillStyle = ["#d84a3a", "#e8c050", "#4a8ac8"][i]; ctx.fillRect(R(x - 6 + ph * 12), R(y + 4 - Math.sin(ph * Math.PI) * 14), 2, 2); }
        if (kind !== "juggle" && kind !== "perform") for (let i = 0; i < 3; i++) { const ph = frac(lt * 0.6 + i / 3); glyph(ctx, "note", x - f * 8 + ph * f * -10 + Math.sin(ph * 6) * 2, y - ph * 18, ["#fff4dc", "#ffe8a0", "#c8e0f0"][i], 1 - ph); }
        if (kind === "perform" && frac(lt * 0.5) < 0.25) crowd.forEach((c) => { const [cx, cy] = S.head(c); glyph(ctx, "ha", cx - 3, cy - 8, "#ffe08a", 1); });
      });
      P.mark("peak", t + 2.6);
      if (P.sc.set === "square" || P.sc.set === "street" || P.sc.set === "market") {
        P.effect(t + 0.2, t + 7.4, (ctx) => { const [x, y] = P.sc.st.iso(at[0] + 0.7, at[1] + 0.7); drawProp(ctx, "hat", x - 3, y, false); }, -1);
        crowd.slice(0, 2).forEach((c, i) => handoverTo(P, c, at, t + 3.6 + i * 0.7));
      }
      P.effect(t + 4.6, t + 6.4, (ctx, lt, S) => crowd.forEach((c, i) => { const [x, y] = S.head(c); if (frac(lt * 2 + i * 0.3) < 0.5) glyph(ctx, "heart", x - 2, y - 7, "#e8566a", 0.9); }));
      P.mark("after", t + 4.6);
      return 6.6;
    };
  }
  function handoverTo(P, from, spot, t) {
    P.effect(t, t + 0.7, (ctx, lt, S) => { const a = S.hand(from), b = P.sc.st.iso(spot[0] + 0.7, spot[1] + 0.7); arc(ctx, a, [b[0], b[1] - 3], lt / 0.7, 10, (x, y) => coin(ctx, x, y, lt * 9)); }, 2);
  }
  ACT.sing = music("sing"); ACT.play = music("play"); ACT.dance = music("dance"); ACT.juggle = music("juggle"); ACT.perform = music("perform");
  // the animals: a pet to pet, a stick to throw, a mount to brush, feed or ride
  ACT.pet = (P, h, t) => {
    const a = P.petA || P.mountA, at = P.spot("act");
    if (!a) return ACT.look(P, h, t);
    const ap = a.kind === "mount" ? P.posOf(a) : near(at, 0.9, 0.3);
    if (a.kind === "pet") P.walk(a, P.posOf(a), ap, t, t + 1.0, { pet: true, faceEnd: -1 });
    P.hold(h, at, t + 0.8, t + 5.0, { mode: a.kind === "pet" ? "crouch" : "stand", face: toward(at, ap), pose: (lt, p) => { p.dip = Math.floor(lt * 2) % 2; } });
    P.mark("act", t + 0.8);
    P.effect(t + 1.2, t + 5.0, (ctx, lt, S) => { const [x, y] = S.head(a); for (let i = 0; i < 3; i++) { const ph = frac(lt * 0.7 + i / 3); glyph(ctx, "heart", x - 2 + (i - 1) * 5, y - 2 - R(ph * 12), "#e8566a", 1 - ph); } });
    P.mark("peak", t + 2.0); P.mark("after", t + 3.4);
    return 5.2;
  };
  ACT.throw = (P, h, t) => {
    const a = P.petA, at = P.spot("act"), far = P.spot("throw", "in");
    if (!a) return ACT.look(P, h, t);
    const stick = P.prop || "stick";
    P.mark("act", t);
    P.hold(h, at, t, t + 0.6, { face: toward(at, far), pose: (lt, p) => { p.lift = lt > 0.3 ? 1 : 0; } });
    P.effect(t + 0.5, t + 1.6, (ctx, lt, S) => { const a0 = S.hand(h), b = P.sc.st.iso(far[0], far[1]); arc(ctx, a0, [b[0], b[1] - 2], seg(lt, 0, 1.1), 26, (x, y) => drawProp(ctx, stick, x - 3, y, false)); }, 2);
    P.walk(a, P.posOf(a), far, t + 0.6, t + 1.8, { pet: true, run: true });
    P.mark("peak", t + 1.8);
    P.walk(a, far, near(at, 0.8, 0.2), t + 2.2, t + 3.6, { pet: true, run: true, faceEnd: -1 });
    P.effect(t + 1.8, t + 3.8, (ctx, lt, S) => { const [x, y] = S.head(a); drawProp(ctx, stick, x - 4, y + 4, false); });
    P.hold(h, at, t + 3.6, t + 5.4, { mode: "crouch", pose: (lt, p) => { p.dip = Math.floor(lt * 3) % 2; } });
    P.effect(t + 3.8, t + 5.4, (ctx, lt, S) => { const [x, y] = S.head(a); glyph(ctx, "heart", x - 2, y - 4 - R(lt * 6), "#e8566a", 1 - lt / 1.6); });
    P.mark("after", t + 3.8);
    return 5.6;
  };
  ACT.chase = (P, h, t) => {
    const a = P.petA, at = P.spot("act"), far = near(at, -4.2, 3.4), back = near(at, 2.4, -2.0), prop = P.prop;
    P.mark("act", t);
    if (a) { P.walk(a, P.posOf(a), far, t, t + 1.4, { pet: true, run: true }); P.walk(a, far, back, t + 1.6, t + 3.2, { pet: true, run: true }); }
    P.walk(h, at, far, t + 0.3, t + 1.9, { run: true });
    P.walk(h, far, back, t + 1.9, t + 3.6, { run: true });
    if (prop) P.effect(t, t + 3.4, (ctx, lt, S) => { const p = a ? S.head(a) : P.sc.st.iso(lerp(at[0], far[0], seg(lt, 0, 1.4)), lerp(at[1], far[1], seg(lt, 0, 1.4))); drawProp(ctx, prop, p[0] - 3, p[1] - 4 - R(Math.abs(Math.sin(lt * 5)) * 6), false); });
    P.mark("peak", t + 1.6);
    P.hold(h, back, t + 3.6, t + 5.2, { mode: "crouch", pose: (lt, p) => { p.dip = Math.floor(lt * 4) % 2; } });
    P.effect(t + 3.6, t + 5.2, (ctx, lt, S) => { const [x, y] = S.head(h); glyph(ctx, "drop", x + 6, y + 2 + R(lt * 4), "#9ac8f0", 1 - lt / 1.6); });
    P.mark("after", t + 3.6);
    return 5.4;
  };
  ACT.brush = (P, h, t) => {
    const m = P.mountA || P.petA, at = m ? near(P.posOf(m), 0.4, 1.0) : P.spot("act");
    P.walk(h, P.posOf(h), at, t, t + 1.0, { faceEnd: m ? toward(at, P.posOf(m)) : -1 });
    P.mark("act", t + 1.0);
    P.hold(h, at, t + 1.0, t + 5.6, { pose: (lt, p) => { p.dx = Math.floor(lt * 2.5) % 2 ? 1 : 0; p.dip = Math.floor(lt * 2.5) % 2; } });
    P.effect(t + 1.0, t + 5.6, (ctx, lt, S) => { const [x, y] = S.hand(h); drawProp(ctx, P.prop === "ribbon" ? "ribbon" : "brush", x - 2 + (Math.floor(lt * 2.5) % 2 ? 3 : -2), y - 4 + (Math.floor(lt * 2.5) % 2 ? 3 : 0), false); });
    if (m) P.seg(m, t + 3.2, t + 5.8, { mode: "stand", from: P.posOf(m), to: P.posOf(m), shine: true });
    P.mark("peak", t + 2.4); P.mark("after", t + 3.4);
    return 5.8;
  };
  ACT.feed = (P, h, t) => {
    const m = P.mountA || P.petA, at = m ? near(P.posOf(m), 0.5, 1.0) : P.spot("act"), food = P.prop || "apple";
    P.walk(h, P.posOf(h), at, t, t + 1.0, { faceEnd: m ? toward(at, P.posOf(m)) : -1 });
    P.mark("act", t + 1.0);
    P.hold(h, at, t + 1.0, t + 4.8, { mode: m && m.kind === "pet" ? "crouch" : "stand", pose: (lt, p) => { p.dx = lt < 1.2 ? 1 : 0; } });
    P.effect(t + 1.0, t + 2.6, (ctx, lt, S) => { const [x, y] = S.hand(h); drawProp(ctx, food, x - 2, y + 2 - (lt > 1 ? 2 : 0), false); });
    P.effect(t + 2.6, t + 4.8, (ctx, lt, S) => { if (!m) return; const [x, y] = S.head(m); for (let i = 0; i < 3; i++) { const ph = frac(lt * 1.6 + i / 3); ctx.fillStyle = "#e8c890"; ctx.fillRect(R(x - 4 + i * 3), R(y + 6 + ph * 8), 1, 1); } glyph(ctx, "heart", x - 2, y - 4 - R(lt * 5), "#e8566a", 1 - lt / 2.2); });
    P.mark("peak", t + 2.6); P.mark("after", t + 3.4);
    return 5.0;
  };
  ACT.ride = (P, h, t) => {
    const m = P.mountA, a = P.spot("act"), b = near(a, -4.0, 3.0), c = near(a, 3.0, -1.4);
    if (!m) return ACT.walk(P, h, t);
    P.mark("act", t);
    P.seg(h, t, t + 2.6, { mode: "ride", from: a, to: b, move: true, mountFig: m.ref });
    P.seg(h, t + 2.6, t + 5.6, { mode: "ride", from: b, to: c, move: true, mountFig: m.ref });
    P.seg(m, t, t + 5.8, { hidden: true });
    P.effect(t, t + 5.6, (ctx, lt, S) => { const p = S.p(h), [x, y] = P.sc.st.iso(p.u, p.v); puff(ctx, x - p.face * 10, y - 2, lt, "#d8c8a8", 4, 6); });
    P.mark("peak", t + 2.6); P.mark("after", t + 4.4);
    return 6.0;
  };
  ACT.hammer = (P, h, t) => {
    const at = P.spot("anvil", "act");
    P.walk(h, P.posOf(h), at, t, t + 0.8, { faceEnd: 1 });
    P.mark("act", t + 0.8);
    P.hold(h, at, t + 0.8, t + 6.0, { face: 1, pose: (lt, p) => { const k = frac(lt * 1.4); p.lift = k < 0.4 ? 1 : 0; p.dip = k > 0.45 && k < 0.6 ? 2 : 0; } });
    P.effect(t + 0.8, t + 6.0, (ctx, lt, S) => {
      const [x, y] = S.hand(h), k = frac(lt * 1.4);
      drawProp(ctx, "hammer", x - 1, y - (k < 0.4 ? 14 : k < 0.5 ? 5 : 1), false);
      if (k > 0.45 && k < 0.8) { sparks(ctx, x + 6, y + 6, (k - 0.45) / 0.35); sparks(ctx, x + 3, y + 7, (k - 0.45) / 0.35 * 0.8); K().glow(ctx, x + 5, y + 6, 10, "#ffb040", 0.5 * (1 - (k - 0.45) / 0.35)); }
    });
    P.mark("peak", t + 2.6); P.mark("after", t + 4.2);
    return 6.2;
  };
  ACT.drill = (P, h, t) => {
    const d = P.spot("dummy", "act"), at = near(d, 0.6, 0.6), coach = P.npc;
    P.walk(h, P.posOf(h), at, t, t + 0.8, { faceEnd: -1 });
    P.mark("act", t + 0.8);
    P.hold(h, at, t + 0.8, t + 6.2, { face: -1, pose: (lt, p) => { const k = frac(lt * 1.1); p.lift = k < 0.2 ? 1 : 0; p.dx = k > 0.3 && k < 0.5 ? -2 : 0; p.dip = k > 0.3 && k < 0.5 ? 1 : 0; } });
    P.effect(t + 0.8, t + 6.2, (ctx, lt, S) => {
      const [x, y] = S.hand(h), k = frac(lt * 1.1);
      drawProp(ctx, "sword", x - (k > 0.3 && k < 0.5 ? 9 : 3), y - (k < 0.3 ? 8 : 0), true);
      if (k > 0.35 && k < 0.6) { const [dx, dy] = P.sc.st.iso(d[0], d[1]); for (let i = 0; i < 5; i++) { const ph = (k - 0.35) / 0.25; ctx.fillStyle = "#d8b860"; ctx.fillRect(R(dx - 4 + i * 2 - ph * 6), R(dy - 24 - ph * 8 + i), 1, 1); } }
    });
    if (coach) P.hold(coach, coach.at, t + 0.8, t + 6.2, { face: toward(coach.at, at), pose: (lt, p) => { p.lift = frac(lt * 0.5) < 0.1 ? 1 : 0; } });
    P.effect(t + 3.0, t + 4.6, (ctx, lt, S) => { if (coach) glyph(ctx, "!", S.head(coach)[0] - 1, S.head(coach)[1] - 8, "#ffe08a", 1); });
    P.mark("peak", t + 2.4); P.mark("after", t + 3.4);
    return 6.4;
  };
  ACT.spar = (P, h, t) => {
    const b = P.other || P.mate || P.npc, at = P.spot("act"), bt = near(at, 1.2, 0.2);
    if (b) P.walk(b, P.posOf(b), bt, t, t + 1.0, { faceEnd: -1 });
    P.mark("act", t + 1.0);
    const lose = /\bloss\b|wins this one\b(?!.*{n} wins)/.test(String(P.block.line || "")) && P.tag.act === "fall";
    P.hold(h, at, t + 1.0, t + 5.4, { face: 1, pose: (lt, p) => { const k = frac(lt * 0.9); p.dx = k < 0.25 ? 2 : 0; p.lift = k > 0.5 && k < 0.6 ? 1 : 0; } });
    if (b) P.hold(b, bt, t + 1.0, t + 5.4, { face: -1, pose: (lt, p) => { const k = frac(lt * 0.9 + 0.5); p.dx = k < 0.25 ? -2 : 0; p.dip = k > 0.25 && k < 0.4 ? 1 : 0; } });
    P.effect(t + 1.0, t + 5.4, (ctx, lt, S) => {
      const a = S.hand(h), c = b ? S.hand(b) : a, k = frac(lt * 0.9);
      drawProp(ctx, "stick", a[0] - 2, a[1] + 2, false); drawProp(ctx, "stick", c[0] - 4, c[1] + 2, true);
      if (k < 0.12 || (k > 0.5 && k < 0.62)) sparks(ctx, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2, ((k < 0.12 ? k : k - 0.5) / 0.12));
    });
    P.mark("peak", t + 2.8);
    if (b) P.hold(b, bt, t + 5.4, t + 6.6, { mode: lose ? "stand" : "fallen" });
    P.hold(h, at, t + 5.4, t + 6.6, { mode: lose ? "fallen" : "stand", pose: (lt, p) => { if (!lose) p.lift = lt < 0.3 ? 2 : 0; } });
    P.mark("after", t + 5.4);
    return 6.8;
  };
  ACT.fall = (P, h, t) => {
    const at = P.spot("act"), fwd = near(at, 0.8, 0.4);
    P.mark("act", t);
    P.walk(h, at, fwd, t, t + 0.6);
    P.seg(h, t + 0.6, t + 2.4, { mode: "fallen", from: fwd, to: fwd, face: 1, pose: (lt, p) => { p.tilt = Math.min(1, lt / 0.25); } });
    P.effect(t + 0.6, t + 1.6, (ctx, lt, S) => { const [x, y] = P.sc.st.iso(fwd[0], fwd[1]); puff(ctx, x, y, lt, "#d8c8a8", 6, 10); glyph(ctx, "star", x - 2 + R(Math.sin(lt * 8) * 4), y - 14, "#ffe08a", 1 - lt); });
    P.mark("peak", t + 0.7);
    P.hold(h, fwd, t + 2.4, t + 4.2, { pose: (lt, p) => { p.lift = lt < 0.3 ? 2 : 0; p.dx = lt > 0.4 && lt < 1.2 ? 1 : 0; } });
    P.effect(t + 2.6, t + 4.2, (ctx, lt, S) => { const [x, y] = S.head(h); glyph(ctx, "drop", x + 6, y + 2 + R(lt * 4), "#9ac8f0", 1 - lt / 1.6); });
    P.mark("after", t + 2.4);
    return 4.4;
  };
  ACT.cards = (P, h, t) => {
    const s = P.spot("seat", "bench", "act"), b = P.mate || P.other || P.npc, bs = P.spot("seat2", "mate");
    P.walk(h, P.posOf(h), s, t, t + 1.0, { end: "sit" });
    const sit = P.sc.set === "tavern" || P.sc.set === "room" ? "sit" : "stand";
    if (b) P.walk(b, P.posOf(b), P.sc.spots.mate || near(s, -1.4, 0.4), t, t + 1.0, { end: sit });
    P.mark("act", t + 1.0);
    P.hold(h, s, t + 1.0, t + 6.0, { mode: sit, face: -1, pose: (lt, p) => { p.dip = frac(lt * 0.8) < 0.2 ? 1 : 0; } });
    if (b) P.hold(b, P.sc.spots.mate || near(s, -1.4, 0.4), t + 1.0, t + 6.0, { mode: sit, face: 1, pose: (lt, p) => { p.dip = frac(lt * 0.8 + 0.5) < 0.2 ? 1 : 0; } });
    P.effect(t + 1.0, t + 6.0, (ctx, lt, S) => {
      const a = S.hand(h), c = b ? S.hand(b) : [a[0] - 20, a[1]], k = Math.floor(lt / 0.8), ph = frac(lt / 0.8);
      const from = k % 2 ? c : a, to = [(a[0] + c[0]) / 2, Math.max(a[1], c[1]) + 4];
      arc(ctx, from, to, io(ph), 6, (x, y) => { ctx.fillStyle = "#2a1a12"; ctx.fillRect(R(x) - 2, R(y) - 3, 5, 6); ctx.fillStyle = k % 3 ? "#f4ecd8" : "#e8c050"; ctx.fillRect(R(x) - 1, R(y) - 2, 3, 4); });
      for (let i = 0; i < Math.min(5, k); i++) { ctx.fillStyle = "#2a1a12"; ctx.fillRect(R(to[0] - 6 + i * 3), R(to[1]), 3, 4); ctx.fillStyle = i % 2 ? "#f4ecd8" : "#c83a2a"; ctx.fillRect(R(to[0] - 5 + i * 3), R(to[1] + 1), 1, 2); }
    }, 1);
    P.mark("peak", t + 3.0);
    P.effect(t + 4.4, t + 6.0, (ctx, lt, S) => { const [x, y] = S.head(h); glyph(ctx, "star", x - 2, y - 8 - R(lt * 4), "#ffe08a", 1 - lt / 1.6); }); P.mark("after", t + 4.4);
    return 6.2;
  };
  ACT.ladle = (P, h, t) => {
    const at = P.spot("cauldron", "act"), q = P.crowdA.slice(0, 3);
    P.mark("act", t);
    P.hold(h, at, t, t + 6, { face: 1, pose: (lt, p) => { p.dip = frac(lt * 0.8) < 0.3 ? 1 : 0; } });
    q.forEach((c, i) => { const s = near(at, 1.2 + i * 0.9, 0.6 + i * 0.5); P.walk(c, P.posOf(c), s, t + i * 0.4, t + 1.2 + i * 0.4, { faceEnd: -1 }); P.hold(c, s, t + 1.2 + i * 0.4, t + 6, { face: -1 }); });
    P.effect(t, t + 6, (ctx, lt, S) => {
      const [x, y] = S.hand(h), k = frac(lt * 0.8), c = q[Math.floor(lt * 0.8) % Math.max(1, q.length)];
      drawProp(ctx, "spoon", x - 1, y - (k < 0.3 ? 4 : 0), false); steam(ctx, x + 2, y + 2, lt, 4);
      if (c && k > 0.35 && k < 0.8) { const b = S.hand(c); arc(ctx, [x, y], b, (k - 0.35) / 0.45, 6, (xx, yy) => { ctx.fillStyle = "#c8803a"; ctx.fillRect(R(xx), R(yy), 2, 2); }); }
    }, 1);
    P.effect(t + 3.4, t + 6, (ctx, lt, S) => q.forEach((c, i) => { const [x, y] = S.head(c); if (frac(lt + i * 0.3) < 0.4) glyph(ctx, "heart", x - 2, y - 7, "#e8566a", 0.9); }));
    P.mark("peak", t + 2.0); P.mark("after", t + 3.4);
    return 6.2;
  };
  ACT.bandage = (P, h, t) => {
    const at = P.spot("cot", "act"), pt = P.sc.spots.patient;
    P.walk(h, P.posOf(h), at, t, t + 1.0, { end: "kneel", faceEnd: -1 });
    P.mark("act", t + 1.0);
    P.hold(h, at, t + 1.0, t + 5.8, { mode: "kneel", face: -1, pose: (lt, p) => { p.dx = Math.floor(lt * 2) % 2 ? -1 : 0; } });
    P.effect(t + 1.0, t + 5.8, (ctx, lt, S) => {
      const [x, y] = S.hand(h);
      for (let i = 0; i < Math.min(6, Math.floor(lt * 1.6)); i++) { ctx.fillStyle = i % 2 ? "#f4ecd8" : "#e2d6bc"; ctx.fillRect(R(x - 10 + i * 2), R(y + 4 - (i % 2)), 2, 2); }
      if (lt > 3.2) { const [hx, hy] = pt ? P.sc.st.iso(pt[0], pt[1]) : [x - 12, y]; glyph(ctx, "heart", hx - 2, hy - 18 - R((lt - 3.2) * 5), "#e8566a", 1 - (lt - 3.2) / 1.6); }
    }, 1);
    P.mark("peak", t + 2.4); P.mark("after", t + 4.2);
    return 6.0;
  };
  ACT.wash = (P, h, t) => {
    if (P.sc.set !== "bath") {
      const at = P.spot("basin", "act");
      P.walk(h, P.posOf(h), at, t, t + 0.8, { faceEnd: at[2] || 1 });
      P.mark("act", t + 0.8);
      P.hold(h, at, t + 0.8, t + 4.8, { pose: (lt, p) => { p.dip = frac(lt * 1.4) < 0.5 ? 2 : 0; } });
      P.effect(t + 0.8, t + 4.8, (ctx, lt, S) => { const [x, y] = S.hand(h); for (let i = 0; i < 6; i++) { const ph = frac(lt * 1.4 + i / 6); ctx.fillStyle = "#c8e4f4"; ctx.fillRect(R(x - 4 + Math.cos(i) * ph * 8), R(y - 6 - Math.sin(ph * Math.PI) * 8), 1, 2); } }, 1);
      P.mark("peak", t + 2.0); P.mark("after", t + 3.4);
      P.effect(t + 3.4, t + 4.8, (ctx, lt, S) => { const [x, y] = S.head(h); glyph(ctx, "drop", x + 6, y + 4 + R(lt * 4), "#9ac8f0", 1 - lt / 1.4); });
      return 5.0;
    }
    const at = P.spot("tub", "act");
    P.walk(h, P.posOf(h), near(at, 0.8, 0.8), t, t + 1.0);
    P.mark("act", t + 1.2);
    P.hold(h, at, t + 1.2, t + 6.4, { mode: "tub", face: -1, pose: (lt, p) => { p.dip = lt < 0.5 ? 4 - R(lt * 8) : frac(lt / 2.6) < 0.4 ? 1 : 0; p.shut = lt > 2.2; } });
    P.effect(t + 1.2, t + 6.4, (ctx, lt, S) => {
      const [x, y] = S.head(h);
      steam(ctx, x, y + 6, lt, 10);
      if (lt < 0.8) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.fillStyle = "#c8e4f4"; ctx.fillRect(R(x + Math.cos(a) * lt * 16), R(y + 14 - Math.sin(lt * 4) * 5), 1, 2); }
      if (lt > 2.6) glyph(ctx, "heart", x + 6, y - 2 - R((lt - 2.6) * 3), "#e8566a", 1 - (lt - 2.6) / 2.4);
    }, 1);
    P.mark("peak", t + 2.0); P.mark("after", t + 3.6);
    return 6.6;
  };
  ACT.sleep = (P, h, t) => {
    const at = P.sc.bedAt || P.spot("bed", "act");
    P.mark("act", t);
    P.hold(h, at, t, t + 5.6, { mode: "lie", z: P.sc.bedZ || 6, quilt: P.quilt, len: P.len });
    P.effect(t, t + 5.6, (ctx, lt) => { const [x, y] = P.sc.st.iso(at[0], at[1]); Tv().zzz(ctx, R(x) - 2, R(y) - 34, lt); });
    P.mark("peak", t + 2.0); P.mark("after", t + 3.6);
    return 5.8;
  };
  ACT.wake = (P, h, t) => {
    const at = P.sc.bedAt || P.spot("bed", "act"), up = P.spot("bed", "act");
    P.hold(h, at, t, t + 1.6, { mode: "lie", z: P.sc.bedZ || 6, quilt: P.quilt, len: P.len });
    P.effect(t, t + 1.6, (ctx, lt) => { const [x, y] = P.sc.st.iso(at[0], at[1]); Tv().zzz(ctx, R(x) - 2, R(y) - 34, lt); });
    P.mark("act", t + 0.2);
    P.walk(h, at, up, t + 1.6, t + 2.2, { faceEnd: -1 });
    P.hold(h, up, t + 2.2, t + 5.4, { face: -1, pose: (lt, p) => { p.lift = lt > 0.2 && lt < 1.2 ? 2 : 0; p.shut = lt < 1.4; p.dip = lt > 1.4 && lt < 1.8 ? 1 : 0; } });
    P.effect(t + 2.4, t + 3.6, (ctx, lt, S) => { const [x, y] = S.head(h); ctx.fillStyle = "#2a1a12"; ctx.fillRect(R(x) - 1, R(y) + 13, 3, 2); glyph(ctx, "dots", x - 2, y - 6, "#f4ecd8", 1 - lt / 1.2); });
    P.mark("peak", t + 2.4); P.mark("after", t + 3.8);
    return 5.6;
  };
  ACT.fish = (P, h, t) => {
    const at = P.spot("edge", "act");
    P.walk(h, P.posOf(h), at, t, t + 0.8, { faceEnd: 1 });
    P.mark("act", t + 0.8);
    P.hold(h, at, t + 0.8, t + 6.4, { face: 1, pose: (lt, p) => { p.lift = lt > 4.0 && lt < 4.4 ? 2 : 0; } });
    P.effect(t + 0.8, t + 6.4, (ctx, lt, S) => {
      const [x, y] = S.hand(h), tip = [x + 16, y - 14], [bx, by] = P.sc.st.iso(at[0] + 2.6, at[1] - 1.2), cast = seg(lt, 0, 0.6), bite = lt > 3.2 && lt < 4.0;
      ctx.fillStyle = "#6a4a2a"; for (let i = 0; i < 16; i++) ctx.fillRect(R(x + i), R(y - i * 0.9), 1, 1);
      const fx = lerp(tip[0], bx, cast), fy = lerp(tip[1], by + (bite ? Math.floor(lt * 12) % 2 * 2 : 0), cast);
      Tv().line(ctx, tip, [fx, fy], "rgba(240,240,230,0.7)");
      ctx.fillStyle = "#d84a3a"; ctx.fillRect(R(fx), R(fy) - 1, 2, 2);
      if (cast >= 1) for (let k = 0; k < 2; k++) { const ph = frac(lt * 0.6 + k * 0.5); ctx.globalAlpha = 1 - ph; ctx.fillStyle = "#c8e4f4"; ctx.fillRect(R(fx - ph * 6), R(fy + 1), R(ph * 12) + 1, 1); ctx.globalAlpha = 1; }
      if (lt > 4.0) { const ph = seg(lt, 4.0, 4.8); arc(ctx, [fx, fy], [x + 2, y - 4], ph, 12, (xx, yy) => drawProp(ctx, "fish", xx - 3, yy + 3, false)); }
    }, 1);
    P.mark("peak", t + 4.0); P.mark("after", t + 4.8);
    return 6.6;
  };
  // a rope: a tug of war, the hero's side against the town's, the ribbon creeping their way; else a rope made fast to a post
  const TUG = /\b(tug[- ]of[- ]war|tug|haul(s|ing)?|heave)\b/i;
  function rope(P, h, t) {
    const at = P.spot("act"), sc = P.sc;
    P.walk(h, P.posOf(h), at, t, t + 0.8, { faceEnd: -1 });
    P.mark("act", t + 0.8);
    if (!TUG.test(P.block.line || "")) {
      const post = near(at, -0.9, 0.9);
      P.hold(h, at, t + 0.8, t + 5.6, { mode: "crouch", face: -1, pose: (lt, p) => { p.dip = frac(lt * 1.4) < 0.4 ? 1 : 0; p.dx = Math.sin(lt * 5) > 0.5 ? -1 : 0; } });
      P.effect(t, t + 30, (ctx, lt, S) => {
        const [px, py] = sc.st.iso(post[0], post[1]);
        ctx.fillStyle = "#5a3a1e"; ctx.fillRect(R(px) - 1, R(py) - 9, 3, 9); ctx.fillStyle = "#7a5a32"; ctx.fillRect(R(px) - 1, R(py) - 10, 3, 1);
        const [hx, hy] = lt > 0.8 ? S.hand(h) : [px + 10, py - 2];
        Tv().line(ctx, [R(px) + 1, R(py) - 6], [R(hx), R(hy) + 2], "#c8a868");
        if (lt > 2.6) { ctx.fillStyle = "#e0c888"; ctx.fillRect(R(px), R(py) - 7, 3, 2); }
      }, 1);
      P.effect(t + 2.6, t + 3.6, (ctx, lt, S) => { const [x, y] = S.head(h); glyph(ctx, "!", x + 6, y - 6, "#ffe08a", 1); });
      P.mark("peak", t + 2.6); P.mark("after", t + 4.0);
      return 5.8;
    }
    // the hero's end of the rope runs off to the left; the other team takes the strain at the far end
    // spaced in screen pixels (a body's width apart) so either camera lines them up the same
    const kx = sc.st.iso(1, -1)[0] - sc.st.iso(0, 0)[0], px = (x) => near(at, x / kx, -x / kx);
    const team = [px(15), px(30)], them = [px(-42), px(-57), px(-72)];
    const pull = (side, i) => (lt, p) => { p.dx = (Math.sin(lt * 3.1 + i) > 0 ? side : 0); p.dip = frac(lt * 1.55 + i * 0.3) < 0.5 ? 1 : 0; };
    P.hold(h, at, t + 0.8, t + 6.6, { face: -1, pose: pull(1, 0) });
    const folkA = team.concat(them).map((q, i) => { const a = P.actor("tug" + i, "folk", folk("local", sc.town + "tug" + i, null), q.concat([i < 2 ? -1 : 1])); P.hold(a, q, 0, t + 7.0, { face: i < 2 ? -1 : 1, pose: pull(i < 2 ? 1 : -1, i + 1) }); return a; });
    P.crowdA.forEach((c) => { c.gone = true; });
    if (P.npc) P.npc.gone = true;
    // the ribbon on the middle of the rope: back and forth, then over to the hero's side for the win
    const mid = (lt) => clamp(0.5 + Math.sin(lt * 1.3) * 0.08 - seg(lt, 3.6, 5.2) * 0.3, 0.15, 0.9);
    P.effect(t + 0.8, t + 30, (ctx, lt, S) => {
      const a = S.hand(folkA[1]), z = S.hand(folkA[4]), k = mid(lt), m = [lerp(z[0], a[0], k), lerp(z[1], a[1], k) + 1];
      Tv().line(ctx, [R(z[0]), R(z[1]) + 2], [R(a[0]), R(a[1]) + 2], "#c8a868");
      ctx.fillStyle = "#c83a2a"; ctx.fillRect(R(m[0]), R(m[1]) + 2, 2, 4);
    }, 1);
    P.effect(t + 5.2, t + 6.6, (ctx, lt, S) => { const [x, y] = S.head(h); glyph(ctx, "heart", x - 2, y - 7 - R(lt * 4), "#e8566a", 1 - lt / 1.4); });
    P.mark("peak", t + 3.0); P.mark("after", t + 5.2);
    return 6.8;
  }
  ACT.hold = (P, h, t) => {
    if (P.prop === "rope") return rope(P, h, t);
    const b = other(P) || P.npc, at = P.spot("door", "act"), base = near(at, 0.3, 0.6);
    P.walk(h, P.posOf(h), near(base, 0.6, 0.4), t, t + 0.8, { faceEnd: -1 });
    P.mark("act", t + 0.8);
    if (P.prop === "ladder" || !P.prop) P.effect(t, t + 6, (ctx) => { const [x, y] = P.sc.st.iso(base[0], base[1]); for (let k = 0; k < 3; k++) drawProp(ctx, "ladder", x - 2, y - k * 15, false); }, -1);
    P.hold(h, near(base, 0.6, 0.4), t + 0.8, t + 5.6, { face: -1, pose: (lt, p) => { p.dx = Math.sin(lt * 7) > 0.6 ? -1 : 0; p.dip = 1; } });
    if (b) { P.walk(b, P.posOf(b), base, t, t + 1.0); P.hold(b, base, t + 1.0, t + 5.6, { pose: (lt, p) => { p.lift = R(lt < 1.2 ? (lt / 1.2) * 24 : lt < 3.2 ? 24 : Math.max(0, 24 - (lt - 3.2) * 20)); p.face = 1; } }); }
    P.effect(t + 2.4, t + 3.4, (ctx, lt, S) => { const [x, y] = S.head(h); glyph(ctx, "!", x + 6, y - 6, "#ffe08a", 1); });
    P.mark("peak", t + 2.4); P.mark("after", t + 4.0);
    return 5.8;
  };
  ACT.teach = (P, h, t) => {
    const b = other(P), at = P.spot("act");
    P.mark("act", t);
    P.hold(h, at, t, t + 2.4, { face: 1, pose: (lt, p) => { p.lift = Math.floor(lt * 3) % 2; p.dx = Math.floor(lt * 3) % 2 ? 1 : 0; } });
    if (b) P.hold(b, P.posOf(b), t, t + 2.4, { face: toward(P.posOf(b), at) });
    if (b) P.hold(b, P.posOf(b), t + 2.4, t + 5.0, { pose: (lt, p) => { p.lift = Math.floor(lt * 2) % 2; p.dx = Math.floor(lt * 2) % 2 ? -1 : 0; } });
    P.hold(h, at, t + 2.4, t + 5.0, { face: b ? toward(at, P.posOf(b)) : -1, pose: (lt, p) => { p.dip = frac(lt) < 0.2 ? 1 : 0; } });
    P.effect(t + 3.6, t + 5.0, (ctx, lt, S) => { const [x, y] = S.head(h); glyph(ctx, lt < 0.7 ? "!" : "heart", x - 1, y - 8, "#ffe08a", 1); });
    P.mark("peak", t + 2.4); P.mark("after", t + 3.6);
    return 5.2;
  };

  // errands: each errand the line ran is a short beat of its own (sell at the stall, buy, the bounty clerk), told in order
  function errands(P, h, t) {
    const beats = (P.tag.beats || []).slice(0, 3);
    if (beats.length <= 1) return ACT[P.tag.act] ? ACT[P.tag.act](P, h, t) : ACT.haggle(P, h, t);
    let tt = t;
    beats.forEach((b, i) => {
      P.tag = Object.assign({}, P.tag, { act: b[1], prop: b[2] });
      P.prop = b[2];
      const d = (ACT[b[1]] || ACT.haggle)(P, h, tt);
      if (i === 0) P.marks.act = tt;
      P.marks["beat" + i] = tt;
      tt += d * 0.8;
    });
    return tt - t;
  }

  // ---------- the staging: on each set, where the hero, the keeper and the townsfolk are for each act (or kind) ----------
  // { hero: a spot, npc: a spot, crowd: "seated" (in their seats the whole time) | "watch" (gather to watch) | "ambient" | "none" }
  // keys: "_" (the set's default), an act, or a kind ("confession"); the kind's entry wins over the act's
  const STAGING = {
    temple: { _: { npc: "altar", crowd: "seated" }, listen: { hero: "pew" }, sit: { hero: "pew" }, read: { hero: "pew" }, pray: { hero: "rail" }, sing: { hero: "pew" },
      pay: { hero: "box" }, give: { hero: "box" }, confession: { hero: "booth", npc: "booth_in", crowd: "seated" }, sweep: { hero: "aisle", crowd: "none" },
      scrub: { hero: "steps", crowd: "none" }, mend: { hero: "pew" }, climb: { hero: "window", crowd: "none" }, hold: { hero: "window", crowd: "none" }, carry: { crowd: "none" },
      talk: { hero: "rail" }, wave: { hero: "pew" }, laugh: { hero: "pew" }, shock: { hero: "pew" }, look: { hero: "pew" } },
    market: { _: { hero: "counter", crowd: "ambient" }, eat: { hero: "bench" }, food_rush: { hero: "counter" }, sit: { hero: "bench" }, walk: { hero: "walk" }, look: { hero: "stall2" }, carry: { hero: "crate" },
      chase: { hero: "walk" }, play: { hero: "walk", crowd: "watch" }, juggle: { hero: "walk", crowd: "watch" } },
    square: { _: { crowd: "ambient" }, play: { crowd: "watch" }, sing: { crowd: "watch" }, perform: { crowd: "watch" }, juggle: { crowd: "watch" }, dance: { crowd: "watch" },
      listen: { hero: "bench", crowd: "watch" }, sit: { hero: "bench" }, read: { hero: "board" }, write: { hero: "board" }, look: { hero: "board" } },
    street: { _: { crowd: "ambient" }, sit: { hero: "bench" }, carry: { hero: "cart" }, hold: { hero: "door" }, climb: { hero: "door" }, play: { crowd: "watch" } },
    green: { _: { crowd: "ambient" }, sit: { hero: "tree" }, listen: { hero: "tree" }, read: { hero: "tree" }, feed: { hero: "pond" }, look: { hero: "pond" }, play: { crowd: "watch" }, dance: { crowd: "watch" } },
    yard: { _: { crowd: "none" }, spar: { hero: "ring" }, teach: { hero: "ring" }, fall: { hero: "ring" } },
    docks: { _: { crowd: "ambient" }, fish: { hero: "edge" }, sit: { hero: "edge" }, carry: { hero: "crate" } },
    stables: { _: { crowd: "none" }, sit: { hero: "bale" } },
    guild: { _: { crowd: "ambient" }, talk: { hero: "counter" }, get: { hero: "counter" }, give: { hero: "counter" }, pay: { hero: "counter" }, paid: { hero: "counter" },
      haggle: { hero: "counter" }, write: { hero: "counter" }, look: { hero: "map" } },
    // at the tavern the hero has a stool at the table by the hearth unless the act takes them up: a song on the stage, a scuffle
    tavern: { _: { crowd: "none", hero: "seat", mode: "sit" }, sing: { hero: "stage", mode: null }, play: { hero: "stage", mode: null }, perform: { hero: "stage", mode: null },
      dance: { hero: "act", mode: null }, spar: { hero: "act", mode: null }, fall: { hero: "act", mode: null }, chase: { hero: "act", mode: null },
      carry: { hero: "bar", mode: null }, walk: { hero: "act", mode: null }, hold: { hero: "act", mode: null }, haggle: { hero: "bar", mode: null },
      pay: { hero: "bar", mode: null }, paid: { hero: "bar", mode: null }, give: { hero: "bar", mode: null }, get: { hero: "seat", mode: "sit" } },
    poorhouse: { _: { crowd: "seated" }, ladle: { hero: "cauldron" }, listen: { hero: "bench", mode: "sit" }, sit: { hero: "bench", mode: "sit" },
      talk: { hero: "bench", mode: "sit" }, mend: { hero: "bench", mode: "sit" }, read: { hero: "bench", mode: "sit" }, eat: { hero: "bench", mode: "sit" },
      perform: { hero: "act" }, give: { hero: "cauldron" } },
    infirmary: { _: { crowd: "none" }, sit: { hero: "cot", mode: "sit" }, read: { hero: "cot", mode: "sit" }, listen: { hero: "cot", mode: "sit" },
      bandage: { hero: "cot" }, hold: { hero: "cot" }, give: { hero: "cot" }, talk: { hero: "cot" }, drink: { hero: "seat", mode: "sit" } },
    tent: { _: { hero: "seat", mode: "sit", crowd: "none" } },
    smithy: { _: { crowd: "none" }, hammer: { hero: "anvil" }, mend: { hero: "anvil" }, look: { hero: "anvil" }, hold: { hero: "anvil" } },
    bath: { _: { crowd: "none" }, wash: { hero: "tub" }, sleep: { hero: "tub" }, sing: { hero: "tub" }, listen: { hero: "tub" }, sit: { hero: "bench", mode: "sit" } },
  };
  function staging(sc, kind, act) {
    const t = STAGING[sc.set] || {};
    return Object.assign({ crowd: "ambient" }, t._ || {}, t[act] || {}, t[kind] || {});
  }

  const MUSICIAN = /\b(fiddler|fiddle|bard|minstrel|piper|harper|lutist|singer|musicians?|band)\b/i;
  const PAYS = /\b(pays?|paid|drops? \d+ silver|silver (in|into) the (box|hat|poor box))\b/i;
  const LEAVES = /\b(walk(s|ing)? out|on the (walk|way) (out|home)|heads? (home|out|off)|goes? (home|out)|leaves? (the|for)|takes? (his|her|their|\{their\}) leave|wanders? off|strolls? off)\b/i;

  // ---------- a table set out in the open: the feast-day board with the party round it, the baking contest's entries ----------
  // it runs across the picture (along u = -v), so its top is a plain screen rectangle and every place behind it shares one depth
  const OPEN_TABLE = { food_feast: "feast", food_contest: "contest" };
  // places 17px apart along it; distances are in screen pixels so the corner camera and the side-on one lay it out alike
  const along = (c, k, back) => [c[0] + k - back, c[1] - k - back];
  function openTable(P, sp, cast, kind, seed) {
    const st = P.sc.st, a = sp.act || [6, 6], o = st.iso(0, 0), kx = st.iso(1, -1)[0] - o[0], by = st.iso(1, 1)[1] - o[1];
    const at = (c, xpx, backpx) => along(c, xpx / kx, backpx / by), c = at(a, 0, 5), places = 4, w = places * 17 + 8;
    const [cx, cy] = st.iso(c[0], c[1]), x0 = R(cx - w / 2), top = R(cy - 13), cv = st.canvas(), g = cv.getContext("2d");
    const wood = "#7a4e2c", dark = "#4a2e18";
    g.fillStyle = "rgba(20,10,4,0.25)"; g.fillRect(x0 + 1, R(cy) + 1, w, 3);
    for (const lx of [x0 + 2, x0 + w - 4]) { g.fillStyle = dark; g.fillRect(lx, top + 8, 2, R(cy) - top - 6); }
    g.fillStyle = wood; g.fillRect(x0, top, w, 7);
    g.fillStyle = "#efe4c8"; g.fillRect(x0 - 1, top - 1, w + 2, 7);
    g.fillStyle = "#e0d2b0"; g.fillRect(x0 - 1, top + 6, w + 2, 4);
    for (let x = x0 + 2; x < x0 + w; x += 6) { g.fillStyle = "#b8443a"; g.fillRect(x, top - 1, 2, 7); g.fillStyle = "#a03a30"; g.fillRect(x, top + 6, 2, 4); }
    g.fillStyle = "#c8b890"; g.fillRect(x0 - 1, top + 10, w + 2, 1);
    const dishes = kind === "contest" ? ["pie", "cake", "pie", "loaf", "cake"] : ["bowl", "loaf", "pot", "bowl", "loaf"];
    dishes.forEach((d, i) => {
      const X = R(x0 + 6 + i * (w - 12) / (dishes.length - 1)), Y = top + 3;
      if (d === "pie" || d === "cake") {
        g.fillStyle = "#6a4a2a"; g.fillRect(X - 3, Y, 7, 1);
        g.fillStyle = d === "pie" ? "#c88a3a" : "#f0d8b0"; g.fillRect(X - 3, Y - 3, 7, 3);
        g.fillStyle = d === "pie" ? "#e8b860" : "#e86a8a"; g.fillRect(X - 2, Y - 4, 5, 1);
        if (d === "cake") { g.fillStyle = "#c83a3a"; g.fillRect(X, Y - 5, 1, 1); }
      } else if (d === "pot") {
        g.fillStyle = "#2a2a2e"; g.fillRect(X - 3, Y - 5, 7, 5); g.fillStyle = "#4a4a52"; g.fillRect(X - 3, Y - 5, 7, 1); g.fillStyle = "#a85a2a"; g.fillRect(X - 2, Y - 6, 5, 1);
      } else if (d === "loaf") {
        g.fillStyle = "#8a5a2a"; g.fillRect(X - 3, Y - 2, 6, 2); g.fillStyle = "#c88a4a"; g.fillRect(X - 2, Y - 3, 4, 1);
      } else {
        g.fillStyle = "#a8784a"; g.fillRect(X - 2, Y - 2, 5, 2); g.fillStyle = "#c07a36"; g.fillRect(X - 2, Y - 3, 5, 1);
      }
    });
    P.pieces.push({ key: c[0] + c[1], cv });
    if (kind === "feast") P.effect(0, 60, (ctx, lt) => { for (const i of [0, 2, 3]) steam(ctx, x0 + 6 + i * (w - 12) / 4, top - 3, lt + i, 2); }, 1);
    // the places behind it, left to right; the hero takes the second, the party the ones beside, the town the rest and the ends
    const behind = [0, 1, 2, 3].map((i) => at(c, (i - (places - 1) / 2) * 17, 6).concat([i < 2 ? 1 : -1, "sit"]));
    const ends = [at(c, -(w / 2 + 9), 0).concat([1]), at(c, w / 2 + 9, 0).concat([-1])];
    if (kind === "contest") return { hero: at(c, -22, -7).concat([1]), judge: at(c, 0, 6).concat([1]), watch: ends.concat([at(c, 20, -9).concat([-1]), at(c, 6, 8).concat([-1])]) };
    return { hero: behind[1], seats: [behind[2], behind[0], behind[3]], ends };
  }
  function seatAt(P, id, ref, seat, kind) {
    const a = P.actor(id, kind || "folk", ref, seat);
    P.sitters[id] = seat;
    P.hold(a, seat, 0, 0.4);
    return a;
  }

  // ---------- the cast on the set, and the plan ----------
  function plan(block, sc, cast, opts) {
    const o = opts || {}, tag = block.scene || {}, P = new Plan(sc, cast, block), sg = staging(sc, block.act, tag.act);
    // this act's spots: the set's own, with the staging's choice of where the hero and the keeper stand
    const sp = Object.assign({}, sc.spots);
    if (sg.hero && sc.spots[sg.hero]) sp.act = sc.spots[sg.hero];
    // the staging may seat (or kneel) the hero at a spot the set left standing: a stool by the cot, the reader's cushion
    if (sp.act) sp.act = sg.mode ? [sp.act[0], sp.act[1], sp.act[2] || 1, sg.mode] : sg.mode === null ? sp.act.slice(0, 3) : sp.act;
    if (sg.npc && sc.spots[sg.npc]) sp.npc = sc.spots[sg.npc];
    P.sc = Object.assign({}, sc, { spots: sp });
    const seed = (block.from || 0) + (block.line || "").length;
    P.prop = tag.prop || null;
    P.quilt = sc.lie ? sc.lie.quilt : ["#3a5a7a", "#a8b8c8"];
    P.len = sc.lie ? sc.lie.len : 1.3;
    const hero = figure(cast.hero), h = P.actor("hero", "hero", hero, sp.act ? sp.in || sp.act : [6, 6]);
    P.hero = h;
    // the set's own keeper (the merchant, the priest, the trainer...) at their post; a crewmate, another hero, the animals; a few locals
    const posted = sc.npc && !["local", "child"].includes(sc.npc.kind);
    if (sc.npc && (posted || ["npc", "child", "crowd"].includes(tag.who))) P.npc = P.actor("npc", "folk", folk(sc.npc.kind, sc.town + sc.set, sc.npc.name), sp.npc || [3, 3, 1]);
    const mates = (cast.mates || []).slice(0, 1);
    if (mates[0]) P.mate = P.actor("mate", "hero", figure(mates[0]), sp.mate || [8, 8, -1]);
    if (cast.other) P.other = P.actor("other", "hero", figure(cast.other), sp.other || [9, 7, -1]);
    const pf = petFig(cast.pet);
    // a pet goes nearly everywhere its hero goes (not into the bath, the fortune-teller's tent, the sickroom or a service)
    if (pf && !["bath", "tent", "infirmary", "temple"].includes(sc.set)) P.petA = P.actor("pet", "pet", pf, sp.pet || [7, 7, -1]);
    const mf = mountFig(cast.mount);
    if (mf && (tag.who === "mount" || sc.set === "stables" || tag.act === "ride")) P.mountA = P.actor("mount", "mount", mf, sc.horse ? [sc.horse[0], sc.horse[1], 1] : sp.mount || [3, 3, 1]);
    P.crowdA = (sg.crowd === "none" ? [] : sc.crowd || []).map((c, i) => P.actor("crowd" + i, "folk", folk(i === 0 && tag.who === "child" ? "child" : "local", sc.town + i + seed, null), [c[0], c[1], c[2] || -1]));
    // a congregation, a table of regulars: seated where the set seats them, the whole scene long
    if (sg.crowd === "seated") P.crowdA.forEach((c, i) => { const at = (sc.crowd[i] || []); if (at[3] === "sit") P.sitters[c.id] = at; });
    // nobody seated right beside the hero's own place (a pew-mate would cover them), nor on the priest
    const room = (c) => [sp.act, sp.npc].some((q) => q && Math.abs(c.at[0] - q[0]) + Math.abs(c.at[1] - q[1]) < 1.6);
    if (sg.crowd === "seated") P.crowdA.forEach((c) => { if (room(c)) c.gone = true; });
    // the feast-day table (the party at it, locals in the other seats) and the contest's table of entries with its judge and onlookers
    const tk = OPEN_TABLE[block.act];
    if (tk && !["tavern", "room", "poorhouse", "tent"].includes(sc.set)) {
      const tb = openTable(P, sp, cast, tk, seed);
      sp.act = tb.hero;
      P.crowdA.forEach((c) => { c.gone = true; });
      if (tk === "feast") {
        const party = (cast.mates || []).slice(0, 3), seats = tb.seats;
        if (P.mate) { P.actors.splice(P.actors.indexOf(P.mate), 1); P.tracks.delete("mate"); P.mate = null; }
        party.forEach((m, i) => seatAt(P, "mate" + i, figure(m), seats[i], "hero"));
        seats.slice(party.length).forEach((at, i) => seatAt(P, "guest" + i, folk("local", sc.town + "feast" + i + seed, null), at));
        tb.ends.forEach((at, i) => { const c = P.actor("end" + i, "folk", folk("local", sc.town + "end" + i + seed, null), at); P.hold(c, at, 0, 60, { face: at[2], pose: idle(i * 0.4) }); });
      } else {
        P.judge = P.actor("judge", "folk", folk("local", sc.town + "judge", null), tb.judge);
        tb.watch.forEach((at, i) => { const c = P.actor("watch" + i, "folk", folk("local", sc.town + "watch" + i + seed, null), at); P.hold(c, at, 0, 60, { face: at[2], pose: idle(i * 0.31) }); });
      }
    }
    // a market-day crush: townsfolk jostling round the stall the hero elbows through to
    if (block.act === "food_rush" && sp.act) {
      P.crowdA.forEach((c) => { c.gone = true; });
      [[-1.5, -0.6], [1.3, -1.1], [-0.7, 1.4], [1.6, 0.9], [-2.2, 0.6]].forEach(([du, dv], i) => {
        const at = near(sp.act, du, dv), c = P.actor("throng" + i, "folk", folk("local", sc.town + "throng" + i + seed, null), at.concat([du > 0 ? -1 : 1]));
        P.hold(c, at, 0, 60, { face: du > 0 ? -1 : 1, pose: (lt, p) => { const k = Math.sin(lt * 2.3 + i * 1.7); p.dx = k > 0.4 ? 1 : k < -0.4 ? -1 : 0; p.dip = frac(lt * 0.9 + i * 0.27) < 0.3 ? 1 : 0; if (frac(lt / 2.6 + i * 0.4) < 0.18) p.face = -p.face; } });
      });
    }
    P.posOf = (a) => {
      if (!a) return sp.act;
      const tr = P.tracks.get(a.id), last = tr && tr[tr.length - 1];
      return last && last.to ? last.to : a.id === "hero" ? sp.act || a.at : a.at;
    };
    // the hero walks in from the set's edge (or wakes where they slept), then the act
    const actSpot = sp.act || [6, 6];
    let t = T0;
    if (block.act === "wake" && tag.act !== "sleep") {
      // the morning starts in bed: asleep, then up; whatever the line says happens after that
      const bed = sc.bedAt || sp.bed || actSpot, up = sp.bed || actSpot;
      P.hold(h, bed, 0, 1.6, { mode: "lie", z: sc.bedZ || 6, quilt: P.quilt, len: P.len });
      P.effect(0, 1.6, (ctx, lt) => { const [x, y] = sc.st.iso(bed[0], bed[1]); Tv().zzz(ctx, R(x) - 2, R(y) - 34, lt); });
      P.walk(h, bed, up, 1.6, 2.1, { faceEnd: -1 });
      P.hold(h, up, 2.1, 2.8, { pose: (lt, p) => { p.lift = lt < 0.5 ? 2 : 0; p.shut = true; } });
      P.mark("arrive", 0.2);
      sp.act = up;
      t = 2.8;
    } else if ((block.act === "breakfast" || block.act === "evening") && tag.set === "tavern" && ["sing", "play", "perform", "dance"].includes(tag.act)) {
      // a song at the tavern: up from the table and onto the stage
      P.walk(h, sp.seat || actSpot, sp.stage || actSpot, 0.4, 1.8, { faceEnd: 1 });
      sp.act = sp.stage || actSpot;
      P.mark("arrive", 0.2);
      t = 1.8;
    } else if ((block.act === "breakfast" || block.act === "evening") && tag.set === "tavern") {
      // at the table: seated from the start, the crew round it, the room going about its morning or its night
      P.sitters.hero = sp.seat || actSpot;
      if (P.mate && sp.mate) P.sitters.mate = sp.mate;
      if (P.other && sp.other) P.sitters.other = sp.other;
      for (const id of Object.keys(P.sitters)) P.hold(P.actors.find((a) => a.id === id), null, 0, 0.6);
      P.mark("arrive", 0.2);
      t = 0.6;
    } else if (tag.act !== "wake" && tag.act !== "sleep" && tag.act !== "ride" && block.act !== "evening" && !(tag.set === "room" && tag.act === "sit")) {
      P.walk(h, sp.in || actSpot, actSpot, 0, 1.6, { faceEnd: actSpot[2] || -1, end: actSpot[3] });
      // a seat in the pews, a place at the rail: the hero stays there, seated or kneeling, whatever the act does
      if (actSpot[3]) P.sitters.hero = actSpot;
      if (P.mate && (tag.who === "mate" || block.act === "crew" || (tag.set === "tavern" && (block.act === "breakfast" || block.act === "evening")))) P.walk(P.mate, near(sp.in || actSpot, 0.8, 0.6), sp.mate || near(actSpot, 1.2, 1), 0.2, 1.8);
      P.mark("arrive", 0.2);
      t = 1.6;
    }
    if (PAYS.test(block.line || "") && P.npc && !["pay", "haggle", "paid"].includes(tag.act) && block.act !== "errands") {
      handover(P, h, P.npc, t + 0.2, null, true);
      P.mark("pay", t + 0.2);
      t += 1.2;
    }
    const fn = block.act === "errands" ? errands : ACT[tag.act] || ACT.look;
    const len = fn(P, h, t);
    // a reading: the three cards turned on the table one by one as the line names them
    if (block.act === "fortune" && sp.table) {
      const at = sp.table, c0 = (P.marks.peak || t + 1) - 0.4;
      P.effect(c0, t + len + 30, (ctx, lt) => {
        for (let i = 0; i < 3; i++) {
          const k = clamp((lt - i * 0.6) / 0.4, 0, 1), [x, y] = P.sc.st.up(P.sc.st.iso(at[0] + 0.25 + i * 0.3, at[1] + 0.2 - i * 0.15), 12);
          if (k <= 0) continue;
          const w = Math.max(1, R(5 * Math.abs(Math.cos((1 - k) * Math.PI / 2))));
          ctx.fillStyle = "#2a1a12"; ctx.fillRect(R(x) - R(w / 2) - 1, R(y) - 8, w + 2, 9);
          ctx.fillStyle = k < 1 ? "#7a2030" : ["#f4ecd8", "#f0e0b0", "#ecd8c0"][i]; ctx.fillRect(R(x) - R(w / 2), R(y) - 7, w, 7);
          if (k >= 1) { ctx.fillStyle = ["#c83a2a", "#3a6aa8", "#c8a040"][i]; ctx.fillRect(R(x) - 1, R(y) - 5, 2, 3); }
        }
      }, 1);
    }
    let dur = t + len + 1.2;
    if (LEAVES.test(block.line || "") && !P.sitters.hero && sp.in) {
      P.walk(h, P.posOf(h), sp.in, t + len, t + len + 1.8);
      P.mark("leave", t + len);
      dur += 1.2;
    }
    // the captions: split the line, then each lands on a beat (arrive, act, peak, after) so the words come with what they say
    const parts = root.Stage ? Stage.split(block.line || "") : [block.line || ""];
    if (block.why) parts.push(block.why);
    const order = parts.length >= 4 ? ["arrive", "act", "peak", "after"] : parts.length === 3 ? ["act", "peak", "after"] : parts.length === 2 ? ["act", "after"] : ["act"];
    const caps = [];
    let last = -9;
    parts.forEach((text, i) => {
      const m = P.marks[order[Math.min(i, order.length - 1)]];
      // the opening words never wait past the hero's arrival (a paid-for tub, a walk across the yard)
      const tt = i === 0 ? Math.min(Math.max(m != null ? m : 0.2, 0.2), 1.8) : Math.max(m != null ? m : last + 2.6, last + 2.2, 0.2);
      caps.push({ t: tt, text });
      last = tt;
    });
    // a long line gets the time to be read: the last caption holds at least as long as it takes to read
    const tail = caps.length ? last + Math.max(2.2, String(caps[caps.length - 1].text).length * 0.045) : 0;
    if (tail > dur) { dur = tail; }
    const loop = [Math.max(0, (P.marks.act || t) - 0.2), Math.min(dur, t + len)];
    if (P.petA && !P.tracks.get("pet").length) P.petA.follow = true;
    if (sc.set === "tavern" && sp.stage && MUSICIAN.test(block.line || "") && !["sing", "play", "perform"].includes(tag.act)) {
      const mus = P.actor("musician", "folk", folk("local", sc.town + "fiddler"), sp.stage);
      P.hold(mus, sp.stage, 0, dur + 30, { face: 1, pose: (lt, p) => { p.dip = frac(lt * 2.2) < 0.3 ? 1 : 0; p.dx = Math.sin(lt * 4.4) > 0 ? 1 : 0; } });
      P.effect(0, dur + 30, (ctx, lt, S) => {
        const [x, y] = S.head(mus);
        drawProp(ctx, "lute", x - 2, y + 22, false);
        for (let i = 0; i < 3; i++) { const ph = frac(lt * 0.6 + i / 3); glyph(ctx, "note", x + 6 + ph * 10 + Math.sin(ph * 6) * 2, y - ph * 18, ["#fff4dc", "#ffe8a0", "#c8e0f0"][i], 1 - ph); }
      }, 1);
    }
    // the animals and carts the line names cross the set near the hero while the act plays: birds overhead, the slow ones slowly
    namedThings(block.line, cast.pet && cast.pet.kind).forEach((id, i) => {
      const tf = thingFig(id), at = P.posOf(h);
      if (!tf) return;
      const a = P.actor("thing" + i, "thing", tf, near(at, 2.4 - i, -2.8 + i)), from = near(at, 4.2 + i * 0.6, -1.6 + i * 0.6), to = near(at, -1.4 + i * 0.6, 4.0 + i * 0.6);
      const t0 = Math.max(0.4, (P.marks.act || 1.6) - 0.6), t1 = Math.min(dur - 0.5, t0 + (tf.slow ? 7 : tf.bird ? 3.5 : 4.5));
      P.seg(a, 0, t0, { mode: "stand", from, to: from, hidden: true });
      P.seg(a, t0, t1, { mode: "walk", from, to, move: true, face: toward(from, to), lift: tf.bird ? 34 : 0 });
      P.seg(a, t1, dur + 30, { mode: "stand", from: to, to, hidden: !!tf.bird });
    });
    // townsfolk the act didn't use: patrons sit at the tavern's tables, elsewhere they cross the set in the background, or stay home
    const paths = sc.walkers || [];
    P.crowdA.forEach((c, i) => {
      if (P.tracks.get(c.id).length) return;
      if (P.sitters[c.id] || sc.set === "tavern" || sc.set === "poorhouse") { P.hold(c, c.at, 0, dur + 30, { mode: (P.sitters[c.id] || [])[3] || "sit", face: c.face, pose: idle(i * 0.3) }); return; }
      const path = paths[i % Math.max(1, paths.length)];
      if (!path || i >= 2 * paths.length) { c.gone = true; return; }
      c.ambient = { from: i % 2 ? path[1] : path[0], to: i % 2 ? path[0] : path[1], period: 14 + i * 3, ph: (i * 0.37) % 1 };
    });
    const draw = (ctx, tt, still) => {
      const states = new Map();
      for (const a of P.actors) {
        const tr = P.tracks.get(a.id);
        let p;
        if (a.gone) continue;
        if (a.ambient) {
          const m = a.ambient, k = frac(tt / m.period + m.ph);
          p = { u: lerp(m.from[0], m.to[0], k), v: lerp(m.from[1], m.to[1], k), face: toward(m.from, m.to), mode: "walk", step: Math.floor(tt * 5) };
          states.set(a.id, p);
          continue;
        }
        if (a.follow) {
          // a step behind the hero, trotting while they walk, sitting when they stop
          const hp = states.get("hero") || P.at(P.hero, tt);
          p = { u: hp.u + 0.7, v: hp.v + 0.5, face: hp.face, mode: "pet", run: hp.mode === "walk" };
          states.set(a.id, p);
          continue;
        }
        if (!tr.length) p = { u: a.at[0], v: a.at[1], face: a.face, mode: a.kind === "pet" ? "pet" : "stand" };
        else p = P.at(a, tt);
        if (!tr.length || !tr.some((s) => s.t0 <= tt && tt < s.t1)) idle(a.id.length * 0.13)(tt, p);
        states.set(a.id, p);
      }
      const S = { p: (a) => states.get(a.id), head: (a) => { const p = states.get(a.id); if (!p) return [0, 0]; if (a.kind === "pet" || a.kind === "mount") { const [x, y] = sc.st.iso(p.u, p.v); return [x, y - (a.kind === "mount" ? 26 : 10)]; } return headOf(p, sc); }, hand: (a) => handOf(states.get(a.id), sc) };
      const list = [];
      for (const a of P.actors) {
        if (a.gone) continue;
        const p = states.get(a.id), tr = P.tracks.get(a.id), s = tr.filter((x) => x.t0 <= tt).pop();
        if (s && s.hidden && tt < s.t1) continue;
        list.push({ key: p.u + p.v + (p.mode === "sit" ? 0.3 : 0) + (p.mode === "lie" ? 1.5 : 0), draw: () => {
          if (a.kind === "pet") drawPet(ctx, sc, a.ref, { u: p.u, v: p.v, face: p.face, run: p.run || s && s.run && tt < s.t1, still }, tt);
          else if (a.kind === "thing") drawThing(ctx, sc, a.ref, { u: p.u, v: p.v, face: p.face, lift: s && s.lift && tt < s.t1 ? s.lift : 0 }, tt);
          else if (a.kind === "mount") drawMount(ctx, sc, a.ref, { u: p.u, v: p.v, face: p.face, walk: false, shine: s && s.shine && tt < s.t1 }, tt);
          else drawFig(ctx, sc, a.ref, p, tt);
        } });
      }
      for (const f of P.fx) if (f.z < 0 && tt >= f.t0 && tt < f.t1) list.push({ key: -1, draw: () => f.draw(ctx, tt - f.t0, S) });
      for (const pc of P.pieces) list.push({ key: pc.key, draw: () => ctx.drawImage(pc.cv, 0, 0) });
      sc.compose(ctx, tt, still, list);
      for (const f of P.fx.filter((f) => f.z >= 0).sort((a, b) => a.z - b.z)) if (tt >= f.t0 && tt < f.t1) f.draw(ctx, tt - f.t0, S);
      // the page's hero gets a small bobbing gold marker while the scene opens, so the eye finds them
      if (tt < 3.2 && !still) { const [x, y] = S.head(h); marker(ctx, x, y - 8 - (Math.floor(tt * 2.5) % 2), Math.min(1, (3.2 - tt) / 0.6)); }
    };
    return { dur, loop, caps, draw, marks: P.marks };
  }

  root.TownActs = { plan, figure, folk, ACTS: Object.keys(ACT), drawProp, glyph };
})(typeof window !== "undefined" ? window : globalThis);
