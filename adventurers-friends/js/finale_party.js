/* The season's party on the ceremony page: the vignettes league/ceremony.py seats (the champion's long table, the band, the dance floor in the street, the fireside corner, the bar, the stable yard out back), drawn with the heroes' own sprites in the venue town's tavern and street. */
(function () {
  "use strict";
  const R = Math.round, frac = (v) => ((v % 1) + 1) % 1, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const W = 240, H = 120, OL = "#160d07", BEAT = 0.54;
  const h01 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const mix = (a, b, t) => Art.mix(a, b, t);
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").imageSmoothingEnabled = false; return c; };
  const sprite = (rows, pal) => Anim.sprite(rows, pal, OL);
  const dot = (ctx, x, y, c, a) => { if (a != null) ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = c; ctx.fillRect(R(x), R(y), 1, 1); ctx.globalAlpha = 1; };
  const box = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(R(x), R(y), w, h); };

  // ---------- the heroes, weapons put away for the night ----------
  function bare(h) {
    const kit = h.kit ? JSON.parse(JSON.stringify(h.kit)) : null;
    if (kit) { kit.weapon = null; kit.offhand = null; if (kit.back && kit.back.art === "quiver") kit.back = null; }
    return Object.assign({}, h, { alive: true, weapon: "none", weapon_tier: 1 }, kit ? { kit } : {});
  }
  const cvs = new Map();
  // a hero's sprite, posed (Art.heroPose: turned to face someone, seated, arms reaching) or standing plain; left flips it
  function heroCv(id, f, left, pose) {
    const key = id + ":" + f + (left ? "L" : "") + JSON.stringify(pose || 0);
    if (!cvs.has(key)) {
      const h = App.heroes[id] || folks[id];
      let c = null;
      const look = folks[id] ? h.clsLook : App.heroLook(h);
      try { const g = pose ? Art.heroPose(bare(h), f, look, pose) : Art.heroGrid(bare(h), f, look); c = (left ? g.flipX() : g).toCanvas(1); } catch (e) { c = null; }
      cvs.set(key, c);
    }
    return cvs.get(key);
  }
  // nameless townsfolk drawn like heroes (they never speak and nobody is named): folk(seed) returns an id for heroCv
  const folks = {};
  function folk(seed, o) {
    const id = "folk" + seed + (o ? JSON.stringify(o) : "");
    if (folks[id]) return id;
    const r = Art.rng(Art.hash("folk:" + seed)), p = (a) => a[Math.floor(r() * a.length)];
    const look = { skin: p(["#f0c8a0", "#e0b088", "#c48a5e", "#9a6440", "#6e4428"]), hair: p(["#3a2a1a", "#6a4020", "#c8a050", "#9a9aa6", "#2a2228"]), style: Math.floor(r() * 6), face: Math.floor(r() * 3), fav: p(["#5a6a3a", "#3a5a8a", "#7a5a3a", "#6a3a3a"]), scars: [] };
    Object.assign(look, (o && o.look) || {});
    folks[id] = { id, name: "", look, weapon: "none", weapon_tier: 1, armor_tier: 1, clsLook: { name: "local", look: { outfit: (o && o.outfit) || p(["vest", "leather", "cloak"]), head: "none", aura: null, offhand: "none" } } };
    return id;
  }
  // canvas x of a sprite column: the sprite is drawn centred on x, mirrored when it faces left
  const sx = (x, col, left) => x + (left ? 14 - col : col - 14);
  // a seated figure turned to face the way it looks, its arm r reaching to hand (sprite pixels; elbow optional)
  const sitPose = (hand, extra) => Object.assign({ seated: 32, turn: 1 }, hand ? { arms: { r: hand } } : {}, extra || {});
  function petCv(pet, f, left) {
    const key = "pet:" + pet.kind + pet.name + (pet.coat || "") + f + (left ? "L" : "");
    if (!cvs.has(key)) { let c = null; try { const g = Art.petGrid(pet, f); c = (left ? g.flipX() : g).toCanvas(1); } catch (e) { c = null; } cvs.set(key, c); }
    return cvs.get(key);
  }
  // a figure by its feet (x the body's centre); clip: the row below which a table hides them
  // o.pose: Art.heroPose's pose; o.hold(ctx, top): draws what the hands hold, before the hands go over it; o.still: no breathing
  function figure(ctx, id, x, feet, t, o) {
    o = o || {};
    const f = o.still ? 0 : frac(t / 0.8 + (o.ph || 0)) < 0.5 ? 0 : 1, c = heroCv(id, f, o.left, o.pose);
    if (!c) return;
    const top = R(feet - c.height + (o.dy || 0)), left = R(x - c.width / 2);
    if (o.clip != null) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, o.clip); ctx.clip(); }
    ctx.drawImage(o.dim ? dim(c, o.dim) : c, left, top);
    if (o.clip != null) ctx.restore();
    if (o.hold) {
      o.hold(ctx, top + f);
      const hc = o.pose && o.pose.arms && heroCv(id, f, o.left, Object.assign({}, o.pose, { part: "hands" }));
      if (hc) ctx.drawImage(o.dim ? dim(hc, o.dim) : hc, left, top);
    }
  }
  // townsfolk sit back in the room's shade so the league's own read first
  function dim(c, k) {
    const key = "dim" + k;
    if (c[key]) return c[key];
    const out = canvas(c.width, c.height), x = out.getContext("2d");
    x.drawImage(c, 0, 0);
    x.globalCompositeOperation = "source-atop"; x.fillStyle = `rgba(40,22,14,${k})`; x.fillRect(0, 0, c.width, c.height);
    return (c[key] = out);
  }
  const favOf = (id) => { const h = App.heroes[id]; const f = (h && h.look && h.look.fav) || "#c8a050"; return /^#[0-9a-f]{6}$/i.test(f) ? mix(f, "#ffffff", 0.35) : "#e8c060"; };

  // ---------- small props ----------
  const MUG = sprite(["ffff.", "pppp.", "pbbpp", "pbbp.p", "pbbpp", "pppp."], { f: "#fbf4dc", p: "#8a8a96", b: "#5e5e6a" });
  const MUG_WOOD = sprite(["ffff.", "wwww.", "wWwwww", "wWww.w", "wWwwww", "wwww."], { f: "#fbf4dc", w: "#8a5a30", W: "#b07a44" });
  const noteIn = new Map();
  function noteCv(col) {
    if (!noteIn.has(col)) noteIn.set(col, sprite(["..xx", "..xxx", "..x.x", "..x..", "xxx..", "xxx.."], { x: col }));
    return noteIn.get(col);
  }
  const WREATH = sprite([".g.y.g.", "gGgYgGg", "G.....G"], { g: "#4e8a3e", G: "#2e5a28", y: "#ffe070", Y: "#e8b030" });
  const EYE = sprite([".xxxxx.", "xwwkwwx", ".xxxxx."], { x: "#3a2418", w: "#f4ecd8", k: "#1a1010" });
  const VEIN = sprite(["r.r", ".r.", "r.r"], { r: "#e0402a" });
  const BUBBLE = { dots: ["xxxxxxx", "xwwwwwx", "xwkwkwk", "xwwwwwx", "xxxxxxx", "..x...."], ha: ["xxxxxxxx", "xwwwwwwx", "xkwkwkkx", "xkkkwkkx", "xkwkwkkx", "xwwwwwwx", "xxxxxxxx", "..x....."], bang: ["xxxxx", "xwkwx", "xwkwx", "xwwwx", "xwkwx", "xxxxx", ".x..."], note: ["xxxxxx", "xwwkkx", "xwwkwx", "xkkkwx", "xkkwwx", "xxxxxx", ".x...."] };
  const bubbles = {};
  function bubble(kind) { if (!bubbles[kind]) bubbles[kind] = Anim.sprite(BUBBLE[kind], { x: "#3a2418", w: "#fbf4e4", k: "#3a2418" }, null); return bubbles[kind]; }
  function bunting(ctx, x0, x1, y, sag, cols, seed) {
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0), yy = R(y + Math.sin(u * Math.PI) * sag);
      dot(ctx, x, yy, "#2a1a10");
      const k = (x - x0) % 7;
      if (k >= 1 && k <= 5) { const c = cols[(Math.floor((x - x0) / 7) + seed) % cols.length], d = 3 - Math.abs(k - 3); for (let j = 1; j <= d + 1; j++) dot(ctx, x, yy + j, j === d + 1 ? mix(c, "#000000", 0.25) : k < 3 ? mix(c, "#ffffff", 0.12) : c); }
    }
  }
  // the season's banner: crimson, gold-edged, a gold cup on it, hung from a rod
  const CUP_BANNER = sprite([
    "rrrrrrrrrrrrrrr",
    ".gGGGGGGGGGGGg.",
    ".GcccccccccccG.",
    ".GcccccccccccG.",
    ".GccyyyyyyyccG.",
    ".GcyYyyyyyyycG.",
    ".GcyYyyyyyyycG.",
    ".GccyYyyyyyccG.",
    ".GcccyYyyyccCG.",
    ".GccccyyyccccG.",
    ".GcccccyccccCG.",
    ".GccccyyyccccG.",
    ".GcccyyyyyccCG.",
    ".GcccccccccCCG.",
    ".GcccccccccCCG.",
    ".GccccCcccCCCG.",
    ".GGcccCGcccCGG.",
    "..GGcCG.GcCGG..",
    "...GGG...GGG...",
  ], { r: "#5a3418", g: "#ffe070", G: "#c8902a", c: "#a82a24", C: "#7a1e1a", y: "#f0c040", Y: "#fff0a0" });
  const PARTY_COLS = ["#c8463a", "#e8b84a", "#efe4cc", "#3a7a9a", "#5a9a4a"];
  function shadow(ctx, x, y, w) { ctx.fillStyle = "rgba(10,6,4,0.35)"; ctx.fillRect(R(x - w / 2), R(y), w, 1); ctx.fillRect(R(x - w / 2 + 2), R(y + 1), w - 4, 1); }
  function sparkle(ctx, x, y, c, s) { dot(ctx, x, y, "#fffbe8"); for (let d = 1; d <= s; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) dot(ctx, x + dx, y + dy, c, d === s ? 0.6 : 1); }

  // the glare between rivals: a little red cross-vein over the one who is cross, the eye over a watcher
  function marks(sc, at, t) {
    const out = [];
    const g = sc.glare || [];
    g.forEach((id, i) => { if (at[id]) out.push({ z: 9e4, front: true, draw(ctx, tt) { const p = at[id](tt); if (frac(tt / 2.4 + i * 0.5) < 0.6) Anim.put(ctx, VEIN, p.x + 5, p.top + 1); } }); });
    if (sc.eyes && at[sc.eyes]) out.push({ z: 9e4, front: true, draw(ctx, tt) { const p = at[sc.eyes](tt); if (frac(tt / 3.1) < 0.7) { Anim.put(ctx, bubble("dots"), p.x + 1, p.top - 1); } else Anim.put(ctx, EYE, p.x, p.top - 2); } });
    return out;
  }
  function pets(sc, spots) {
    const out = [];
    (sc.pets || []).forEach((id, i) => {
      const h = App.heroes[id], sp = spots[i];
      if (!h || !h.pet || !sp) return;
      const range = sp.range == null ? 6 : sp.range, ph = h01(i, id.length);
      out.push({ z: sp.z || sp.y, front: !!sp.front, draw(ctx, t) {
        const u = frac(t / 9 + ph), walk = u < 0.25 || (u > 0.5 && u < 0.75), dir = u < 0.5 ? 1 : -1;
        const x = sp.x + (u < 0.25 ? u * 4 : u < 0.5 ? 1 : u < 0.75 ? 1 - (u - 0.5) * 4 : 0) * range;
        const c = petCv(h.pet, walk ? (frac(t * 3) < 0.5 ? 1 : 0) : (frac(t / 2.3 + ph) < 0.15 ? 1 : 0), dir < 0);
        if (!c) return;
        shadow(ctx, x, sp.y, Math.max(6, c.width - 6));
        ctx.drawImage(c, R(x - c.width / 2), R(sp.y - c.height + 1));
      } });
    });
    return out;
  }

  // ---------- the tavern room, wider than the frame so the corner and the bar can each show their own end of it ----------
  function room(town, rw, seed) {
    const cv = canvas(rw, H), info = { kind: "tavern", W: rw, H, town, wx: town === "frosthold" ? "snow" : "clear" };
    if (window.TavernFlat) TavernFlat.paint(cv, info, Art.rng(seed));
    const r = Art.rng(seed + 7), s = () => Math.floor(r() * 1e9);
    const acts = window.TavernFlat ? TavernFlat.actors(info, Anim, s).filter((a) => a.z < 60 || a.z > 1e3) : [];
    return { cv, info, acts };
  }
  function crop(src, x0, acts) {
    const cv = canvas(W, H);
    cv.getContext("2d").drawImage(src, -x0, 0);
    return { cv, acts: acts.map((a) => ({ z: a.z, front: a.front, draw(ctx, t) { ctx.save(); ctx.translate(-x0, 0); a.draw(ctx, t); ctx.restore(); } })) };
  }

  // ---------- the long table: the champion stands at its middle, everyone's mug goes up together ----------
  function toast(sc, town, seed) {
    const rm = room(town, W, seed), ctx = rm.cv.getContext("2d"), TOP = 93;
    bunting(ctx, 2, W / 2 - 4, 5, 5, PARTY_COLS, 0); bunting(ctx, W / 2 + 4, W - 2, 5, 5, PARTY_COLS, 2);
    for (const bx of [W / 2 - 40, W / 2 + 28]) ctx.drawImage(CUP_BANNER, R(bx - CUP_BANNER.width / 2), 13);
    const lead = sc.lead || sc.heroes[0];
    const rest = sc.heroes.filter((i) => i !== lead), gap = Math.min(28, (W - 50) / Math.max(1, rest.length + 1));
    const xs = {};
    xs[lead] = W / 2;
    rest.forEach((id, i) => { const k = (i >> 1) + 1, side = i % 2 ? 1 : -1; xs[id] = W / 2 + side * (k * gap + 4); });
    const span = Math.max(...Object.values(xs).map((x) => Math.abs(x - W / 2))), X0 = R(Math.max(8, W / 2 - span - 26)), X1 = R(Math.min(W - 8, W / 2 + span + 26)), DR = TOP + 13;
    const over = canvas(W, H), o = over.getContext("2d");
    // the trestles and their shadow on the boards, then the cloth: white with the party's stripe, over the seated so only their chests show
    for (let x = X0 + 4; x < X1 - 4; x++) for (let y = DR; y < DR + 4; y++) dot(o, x, y, "#0c0602", 0.45 - (y - DR) * 0.1);
    for (const lx of [X0 + 10, X1 - 12]) { box(o, lx, DR, 3, H - DR - 6, "#4a2a12"); box(o, lx, DR, 1, H - DR - 6, "#6a4220"); box(o, lx - 4, H - 7, 11, 2, "#3a2010"); box(o, lx - 4, H - 7, 11, 1, "#5a3418"); }
    for (let y = TOP; y < DR; y++) for (let x = X0; x < X1; x++) {
      const top = y < TOP + 4, edge = x === X0 || x === X1 - 1;
      let c = top ? (y === TOP ? "#fffaf0" : mix("#efe6d2", "#c8bca4", (y - TOP) / 4)) : mix("#e2d6be", "#8a7a66", (y - TOP - 4) / 10);
      if (!top && (x - X0) % 11 === 0) c = mix(c, "#000000", 0.1);
      if (!top && y >= TOP + 7 && y < TOP + 9) c = y === TOP + 8 ? "#8a2a24" : "#c8463a";
      if (!top && y === TOP + 10) c = "#e8b84a";
      if (y === TOP + 4) c = "#9a8c74";
      if (y === DR - 1) c = (x - X0) % 4 < 2 ? "#b8ac94" : "#9a8c74";
      if (edge) c = mix(c, "#000000", 0.2);
      dot(o, x, y, c);
    }
    // food down the middle, between the places
    const props = [];
    for (let x = X0 + 10; x < X1 - 10; x += 13) if (!Object.values(xs).some((hx) => Math.abs(hx + 7 - x) < 7)) props.push(x);
    props.forEach((x, i) => {
      const k = (i + seed) % 5;
      if (k === 0) { for (let j = 0; j < 4; j++) for (let ii = -4; ii <= 4; ii++) if (Math.hypot(ii / 4.5, (j - 3) / 3.6) < 1) dot(o, x + ii, TOP - 2 + j, mix("#c88434", j < 1 ? "#ffffff" : "#000000", j < 1 ? 0.25 : j > 2 ? 0.25 : 0)); dot(o, x - 1, TOP - 1, "#f0c880"); dot(o, x + 2, TOP - 1, "#f0c880"); }
      else if (k === 1) { for (let j = 0; j < 6; j++) for (let ii = -2; ii <= 2; ii++) if (!(j === 0 && Math.abs(ii) === 2)) dot(o, x + ii, TOP - 5 + j, ii === -2 || ii === 2 || j === 0 ? "#3a3a46" : ii < 0 ? "#8a96b0" : "#5e6a86"); }
      else if (k === 2) { for (let j = 0; j < 5; j++) for (let ii = -6; ii <= 6; ii++) if (Math.hypot(ii / 6.2, (j - 3) / 3.2) < 1) dot(o, x + ii, TOP - 3 + j, j > 2 ? "#8a8a92" : mix("#a8582a", "#ffd08a", (6 - Math.abs(ii)) / 12 + (j === 0 ? 0.2 : 0))); dot(o, x + 5, TOP - 3, "#f4ead0"); dot(o, x + 6, TOP - 4, "#f4ead0"); }
      else if (k === 3) { for (let j = 0; j < 3; j++) for (let ii = -5; ii <= 5; ii++) dot(o, x + ii, TOP - 1 + j, j === 2 ? "#8a8a92" : (ii + j) % 3 ? "#e0a454" : "#7a2a2a"); }
      else { for (let j = 0; j < 3; j++) for (let ii = -3; ii <= 3; ii++) if (Math.hypot(ii / 3.4, (j - 1) / 1.6) < 1.1) dot(o, x + ii, TOP - 1 + j, ["#c83a3a", "#e8c040", "#5a9a3a"][(ii + 3 + j) % 3]); }
    });
    const acts = rm.acts.slice(), at = {};
    // each mug in its owner's hand: on the table, to the lips now and then, up for the toast (the champion's stays raised)
    const MUG_AT = { rest: [21, 19], sip: [18, 14], mid: [22, 13], up: [22, 7], wave: [22, 6] };
    sc.heroes.forEach((id, i) => {
      const x = xs[id], champ = id === lead, ph = h01(i + 1, seed % 97), left = !champ && x > W / 2;
      const feet = champ ? TOP + 6 : TOP + 12;
      at[id] = (t) => ({ x, top: feet - 34 });
      acts.push({ z: 100 + (champ ? 50 : i), draw(ctx, t) {
        const p = frac(t / 6), s = frac(t / 7 + ph);
        const where = champ ? (frac(t / 1.4) < 0.5 ? "up" : "wave") : p >= 0.6 && p < 0.66 || p >= 0.86 && p < 0.92 ? "mid" : p >= 0.66 && p < 0.86 ? "up" : s > 0.88 && p < 0.5 ? "sip" : "rest";
        const hand = MUG_AT[where];
        figure(ctx, id, x, feet, t, { ph, clip: TOP + 1, left, pose: { arms: { r: hand } }, hold(c, top) {
          const mx = sx(x, hand[0], left), my = top + hand[1] + 3;
          Anim.put(c, champ ? MUG : MUG_WOOD, mx, my, left);
          if (where === "up" && !champ && frac(t * 5 + ph) < 0.5) dot(c, mx - (left ? 2 : -2), my - 7, "#fffbe8");
        } });
      } });
    });
    const lx = xs[lead];
    acts.push({ z: 9e4, front: true, draw(ctx, t) {
      Anim.put(ctx, WREATH, lx, TOP - 26);
      const p = frac(t / 6);
      if (p > 0.66 && p < 0.84) { const k = (p - 0.66) / 0.18; sparkle(ctx, lx + 9, TOP - 34 - 2, "#ffe070", 1 + R(k * 2)); for (let j = 0; j < 5; j++) dot(ctx, lx + 9 + R(Math.cos(j * 1.3) * k * 9), TOP - 34 - 2 - R(Math.sin(j * 1.3 + 0.4) * k * 6) + R(k * k * 6), "#fbf4dc"); }
    } });
    acts.push(Anim.twinkle({ pts: [[lx - 9, TOP - 26], [lx + 11, TOP - 22], [lx - 4, TOP - 33], [lx + 6, TOP - 34]], col: "#ffffff", arm: "#ffe88a", seed, z: 9e4, front: true }));
    acts.push(Anim.glow({ x: lx, y: TOP - 18, r: 30, rgb: "255,210,120", a: 0.12, amp: 0.06, seed, front: true }));
    for (let x = X0 + 14; x < X1 - 10; x += 48) acts.push(candleOn(x, TOP - 1, seed + x));
    acts.push(...marks(sc, at), ...pets(sc, [{ x: X0 + 24, y: H - 3, front: true, z: 3e3, range: 14 }]));
    return { base: rm.cv, over, acts };
  }
  function candleOn(x, y, seed) {
    return { z: 2500, front: true, draw(ctx, t) {
      box(ctx, x, y - 4, 1, 4, "#efe4c8"); dot(ctx, x, y - 4, "#fff8e0");
      const f = frac(t * 3.3 + h01(seed, 1)) < 0.5;
      dot(ctx, x, y - 5, "#ffd27a"); dot(ctx, x, y - 6, f ? "#ff9a3a" : "#ffd27a"); if (f) dot(ctx, x, y - 7, "#ff7a2a", 0.6);
      Anim.light(ctx, x, y - 6, 9, "255,190,110", 0.18);
    } };
  }

  // ---------- the band: the league's players on a little stage, instruments playing themselves, the crowd bobbing ----------
  const folkCv = (seed) => heroCv(folk(seed), 0, false, null);
  // a townsperson seen from behind the light: dark, with a warm rim from the stage
  function dark(c, k) {
    const key = "dark" + k;
    if (c[key]) return c[key];
    const out = canvas(c.width, c.height), x = out.getContext("2d");
    x.drawImage(c, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
      const i = (y * c.width + xx) * 4;
      if (!a[i + 3]) continue;
      const rim = y < 1 || !a[((y - 1) * c.width + xx) * 4 + 3];
      const m = rim ? [168, 104, 60] : [26, 18, 24];
      for (let j = 0; j < 3; j++) a[i + j] = R(a[i + j] * (1 - k) + m[j] * k);
    }
    x.putImageData(d, 0, 0);
    return (c[key] = out);
  }
  function band(sc, town, seed) {
    const rm = room(town, W, seed), ctx = rm.cv.getContext("2d");
    const S0 = 40, S1 = W - 40, TOP = 82, FACE = 92;
    // the curtain and its valance, the stage boards
    for (let y = 3; y < TOP; y++) for (const [x0, x1] of [[S0 - 8, S0 + 6], [S1 - 6, S1 + 8]]) for (let x = x0; x < x1; x++) {
      const fold = Math.sin((x - x0) * 1.3 + (y > 50 ? (x0 < W / 2 ? 1 : -1) * (y - 50) * 0.05 : 0));
      dot(ctx, x, y, mix("#8a1e1e", fold > 0.3 ? "#d04a3a" : fold < -0.5 ? "#3a0a0a" : "#8a1e1e", Math.abs(fold) * 0.6));
    }
    for (const x of [S0 + 4, S1 - 4]) { box(ctx, x - 3, 50, 7, 2, "#e8b84a"); box(ctx, x - 2, 52, 5, 1, "#a87a22"); }
    for (let x = S0 - 8; x < S1 + 8; x++) {
      const sc0 = 8 + R(Math.abs(Math.sin((x - S0) * Math.PI / 16)) * 3);
      for (let y = 3; y < sc0; y++) dot(ctx, x, y, y < 5 ? "#5a1414" : mix("#a82a24", "#6a1414", (y - 3) / 8));
      dot(ctx, x, sc0, "#e8b84a"); if (x % 2) dot(ctx, x, sc0 + 1, "#c89a30");
    }
    for (let y = TOP; y < FACE + 2; y++) for (let x = S0 - 6; x < S1 + 6; x++) {
      const top = y < TOP + 4, plank = Math.floor((x - S0) / 12);
      let c = top ? mix("#a87038", "#7a4c26", (y - TOP) / 4 + ((plank % 2) ? 0.1 : 0)) : mix("#5a361a", "#2a180c", (y - TOP - 4) / 8);
      if (top && (x - S0) % 12 === 0) c = "#4a2a12";
      if (!top && (x - S0) % 6 === 0) c = mix(c, "#000000", 0.25);
      if (y === TOP) c = "#c8904a";
      if (y === TOP + 4) c = "#2a1808";
      dot(ctx, x, y, c);
    }
    bunting(ctx, S0 - 6, S1 + 6, 12, 4, PARTY_COLS, 1);
    const acts = rm.acts.slice(), at = {}, n = sc.heroes.length, play = sc.play || {};
    const span = Math.min(150, 40 * n), x0 = W / 2 - span / 2 + span / (2 * n);
    sc.heroes.forEach((id, i) => {
      const x = R(x0 + (span / n) * i), feet = TOP + 2, inst = play[id] && play[id] !== "sing" ? play[id] : null, face = x < W / 2 - 4 ? 1 : x > W / 2 + 4 ? -1 : 1, ph = h01(i, seed % 89);
      at[id] = () => ({ x, top: feet - 34 });
      acts.push(Anim.glow({ x, y: feet - 16, r: 22, rgb: "255,200,120", a: 0.12, amp: 0.05, seed: seed + i }));
      const M = window.MusicReplay, H = inst && M && M.held ? M.held(App.heroes[id], inst, "inst") : null;
      const hitAt = (t) => ({ since: frac(t / BEAT + ph * 0.3) * BEAT, d: BEAT * 0.6, kind: "note" });
      // a singer's free hand goes out to the room on the beat
      const SING = [[23, 16], [24, 12]];
      acts.push({ z: 100 + i, draw(c, t) {
        const beat = frac(t / BEAT + ph * 0.2), bob = beat < 0.5 ? 0 : 1, calm = !!Anim.reduced;
        shadow(c, x, feet, 14);
        if (H) {
          const body = H.body(M.gripFrame(inst, "inst", t, hitAt(t), calm), face < 0);
          if (body) { c.drawImage(body, R(x - 14), R(feet - body.height)); return; }
        }
        figure(c, id, x, feet, t, { ph, dy: inst ? 0 : bob, left: face < 0, pose: inst ? null : { arms: { r: SING[frac(t / (BEAT * 4) + ph) < 0.5 ? 0 : 1] } } });
      } });
      acts.push({ z: 3e3 + i, front: true, draw(c, t) {
        const calm = !!Anim.reduced;
        if (inst && M && M.drawInst) M.drawInst(c, inst, "inst", x, feet - 15, face, t, hitAt(t), calm, null, H ? (k) => H.hands(k, face < 0) : null);
        const col = favOf(id), per = inst ? 2.2 : 1.7;
        for (let k = 0; k < 2; k++) {
          const a = frac(t / per + ph + k * 0.5);
          c.globalAlpha = a < 0.15 ? a / 0.15 : a > 0.7 ? Math.max(0, (1 - a) / 0.3) : 1;
          c.drawImage(noteCv(col), R(x + (inst ? face * 8 : 4) + Math.sin(a * 6.28 + k) * 2), R(feet - 38 - a * 16));
          c.globalAlpha = 1;
        }
      } });
    });
    // the crowd, backs to us, bobbing on the beat
    const crowd = [];
    for (let i = 0; i < 9; i++) { const f = folkCv(seed + i * 31); if (f) crowd.push({ c: dark(f, 0.82), x: 12 + i * 27 + R(h01(i, 3) * 8), y: H + 14 + R(h01(i, 5) * 5), ph: h01(i, 7), mug: h01(i, 9) > 0.6 }); }
    crowd.forEach((p, i) => acts.push({ z: 5e3 + p.y, front: true, draw(c, t) {
      const b = frac(t / BEAT + p.ph * 0.5) < 0.5 ? 0 : 1;
      c.drawImage(p.c, R(p.x - p.c.width / 2), R(p.y - p.c.height + b));
      if (p.mug) { const up = frac(t / 5 + p.ph) > 0.7 ? 4 : 0; Anim.put(c, MUG_WOOD, p.x + 9, p.y - 22 - up + b); }
    } }));
    for (let x = S0; x <= S1; x += 26) acts.push(footlight(x, FACE - 1, seed + x));
    acts.push(...marks(sc, at), ...pets(sc, [{ x: S1 + 2, y: TOP + 1, range: 4, z: 300 }]));
    return { base: rm.cv, acts };
  }
  function footlight(x, y, seed) {
    return { z: 4e3, front: true, draw(ctx, t) {
      box(ctx, x - 3, y - 1, 7, 3, "#5a5a64"); box(ctx, x - 3, y - 1, 7, 1, "#a8a8b4");
      const f = frac(t * 3.7 + h01(seed, 2)) < 0.5;
      dot(ctx, x, y - 2, "#fff4c0"); dot(ctx, x, y - 3, f ? "#ffb040" : "#ffd27a");
      Anim.light(ctx, x, y - 6, 16, "255,190,110", 0.16);
    } };
  }

  // ---------- the dance floor: the venue town's street by night, lanterns strung across, crew by crew ----------
  function dance(sc, town, seed) {
    const cv = canvas(W, H), ctx = cv.getContext("2d"), GY = 82;
    const b = window.TownScenes && TownScenes.build ? TownScenes.build(town, W, { night: true }) : null;
    let acts = [];
    if (b) {
      const y0 = GY - b.H + 8;
      ctx.drawImage(b.base, 0, y0); ctx.drawImage(b.over, 0, y0);
      acts = b.acts.map((a) => ({ z: a.z - 1e6, draw(c, t) { c.save(); c.translate(0, y0); a.draw(c, t); c.restore(); } }));
      if (y0 > 0) for (let y = 0; y < y0; y++) box(ctx, 0, y, W, 1, mix("#0a0f24", "#14203a", y / Math.max(1, y0)));
    } else for (let y = 0; y < GY; y++) box(ctx, 0, y, W, 1, mix("#0a0f24", "#26304a", y / GY));
    // the square: cobbles lit warm under the lanterns
    for (let y = GY; y < H; y++) for (let x = 0; x < W; x++) {
      const row = Math.floor((y - GY) / 4), k = x + (row % 2 ? 3 : 0), edge = (y - GY) % 4 === 3 || k % 7 === 0;
      const base = ["#4a4038", "#3e362e", "#544a40"][Math.floor(h01(Math.floor(k / 7), row) * 3)];
      const lit = clamp(1 - Math.hypot((x - W / 2) / 150, (y - 100) / 40), 0, 1);
      dot(ctx, x, y, mix(edge ? "#221c18" : base, "#c87a3a", lit * 0.35));
    }
    box(ctx, 0, GY, W, 1, "#1a1410");
    const lanterns = [];
    for (const [x0, x1, y, sag] of [[-4, W / 2 + 8, 14, 10], [W / 2 - 8, W + 4, 18, 9]]) {
      for (let x = x0; x <= x1; x++) dot(ctx, x, R(y + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * sag), "#1a1218");
      for (let k = 1; k < 6; k++) { const u = k / 6, x = R(x0 + (x1 - x0) * u); lanterns.push([x, R(y + Math.sin(u * Math.PI) * sag) + 1, ["#e8503a", "#f0b040", "#e8d080", "#4aa0c8"][(k + lanterns.length) % 4]]); }
    }
    for (const [x, y, c] of lanterns) {
      for (let j = 0; j < 5; j++) for (let i = -2; i <= 2; i++) if (Math.abs(i) < 2 || (j > 0 && j < 4)) dot(ctx, x + i, y + j, j === 0 || j === 4 ? "#3a2418" : i === -2 ? mix(c, "#ffffff", 0.3) : i === 2 ? mix(c, "#000000", 0.25) : c);
      acts.push(Anim.glow({ x, y: y + 2, r: 18, rgb: "255,190,110", a: 0.16, amp: 0.08, seed: x + y }));
    }
    const at = {}, n = sc.heroes.length, crews = (sc.crews || []).filter((c) => c.heroes.length);
    const groups = crews.map((c) => c.heroes).concat(sc.heroes.filter((id) => !crews.some((c) => c.heroes.includes(id))).map((id) => [id]));
    const slots = [];
    const gapIn = Math.min(24, (W - 20) / Math.max(1, n + groups.length * 0.4)), gapOut = gapIn * 1.4;
    let x = 0;
    groups.forEach((g, gi) => g.forEach((id, k) => { slots.push({ id, gi, k, x }); x += k === g.length - 1 ? gapOut : gapIn; }));
    // the maypole stands in the middle of the square; the dancers leave it room and hold its ribbons
    const POLE = 16, width = x - gapOut + POLE, xL = W / 2 - width / 2, PX = W / 2, PT = 30;
    const sxOf = (sx) => R(xL + sx + (xL + sx >= PX - POLE / 2 ? POLE : 0));
    const pc = ctx;
    for (let y = PT; y < 106; y++) { dot(pc, PX - 1, y, "#e8d8b8"); dot(pc, PX, y, (y >> 2) % 2 ? "#c8463a" : "#f4ead8"); dot(pc, PX + 1, y, "#8a7a62"); }
    for (let i = -3; i <= 3; i++) dot(pc, PX + i, PT - 1, i % 2 ? "#4e8a3e" : "#2e5a28");
    for (let i = -2; i <= 2; i++) dot(pc, PX + i, PT - 2, i ? "#4e8a3e" : "#ffe070");
    box(pc, PX - 3, 105, 7, 2, "#3a2a1a");
    const RIB = ["#e8503a", "#f0b040", "#4aa0c8", "#f4ead8", "#5a9a4a", "#c86aa0"];
    const STEPS = ["hop", "sway", "spin", "jig"];
    acts.push({ z: 150, draw(c, t) {
      slots.forEach((s, i) => {
        const hx = sxOf(s.x), feet = 104 + (i % 2 ? 7 : 0), hy = feet - 17 - hopOf(STEPS[s.gi % STEPS.length], t, s.gi * 0.17), col = RIB[i % RIB.length];
        const n0 = Math.max(Math.abs(hx - PX), Math.abs(hy - PT)) | 0, sag = Math.sin(t * 2 + i) * 1.5 + 3;
        for (let k = 0; k <= n0; k++) { const u = k / n0; dot(c, PX + (hx - PX) * u, PT + 1 + (hy - PT - 1) * u + Math.sin(u * Math.PI) * sag, col); }
      });
    } });
    slots.forEach((s, i) => {
      const step = STEPS[s.gi % STEPS.length], sx = sxOf(s.x), feet = 104 + (i % 2 ? 7 : 0), ph = s.gi * 0.17;
      at[s.id] = (t) => ({ x: sx, top: feet - 34 - hopOf(step, t, ph) });
      acts.push({ z: 200 + feet, draw(c, t) {
        const up = hopOf(step, t, ph), b2 = Math.floor(t / BEAT + ph);
        const left = step === "spin" ? b2 % 2 === 1 : step === "sway" ? Math.floor(t / (BEAT * 4) + ph) % 2 === 1 : s.k % 2 === 1;
        const dx = step === "sway" ? R(Math.sin((t / BEAT + ph) * Math.PI / 2) * 2) : step === "jig" ? (b2 % 4 < 2 ? 1 : -1) : 0;
        shadow(c, sx + dx, feet, Math.max(8, 14 - up * 2));
        figure(c, s.id, sx + dx, feet, t, { ph: s.k * 0.3, dy: -up, left });
      } });
    });
    // confetti from the windows
    acts.push({ z: 9e4, front: true, draw(c, t) {
      for (let i = 0; i < 26; i++) {
        const u = frac(t / (5 + (i % 5)) + h01(i, seed % 31)), px = (h01(i, 2) * W + Math.sin(t * 1.3 + i) * 4 + W) % W, py = -4 + u * (H + 8);
        dot(c, px, py, PARTY_COLS[i % PARTY_COLS.length], 0.9);
        if (i % 3 === 0) dot(c, px + 1, py, PARTY_COLS[i % PARTY_COLS.length], 0.6);
      }
    } });
    acts.push(...marks(sc, at), ...pets(sc, [{ x: 18, y: H - 3, range: 8, front: true, z: 8e3 }, { x: W - 22, y: H - 2, range: 8, front: true, z: 8e3 }]));
    return { base: cv, acts };
  }
  function hopOf(step, t, ph) {
    const b = frac(t / BEAT + ph);
    if (step === "hop") return R(Math.sin(b * Math.PI) * 3);
    if (step === "jig") return R(Math.abs(Math.sin(b * Math.PI * 2)) * 2);
    if (step === "spin") return b < 0.3 ? 1 : 0;
    return 0;
  }

  // ---------- the fireside corner: an arm-wrestle at a little table, friends talking face to face, lone heroes turned to the
  // hearth; the town's regulars, the barkeep, a dog asleep by the fire and a game of dice fill whatever the league leaves empty ----------
  const SOLE = 35, SEAT = SOLE + 2;
  const sitAt = (hand, elbow, thick) => ({ seated: SOLE, turn: 1, arms: { r: elbow ? hand.concat(elbow, thick ? [thick] : []) : hand } });
  // a three-legged stool under a seated figure (x its centre, facing the way it looks)
  function stool(o, x, floor, face) {
    const top = floor - 7, cx = x - face * 3;
    for (let y = floor; y < floor + 2; y++) for (let i = -6; i <= 6; i++) dot(o, cx + i, y, "#0c0602", 0.3 - (y - floor) * 0.12);
    for (const [lx, c] of [[cx - 4, "#3a2010"], [cx + 3, "#3a2010"], [cx, "#2a1608"]]) { box(o, lx, top + 2, 1, floor - top - 2, c); }
    box(o, cx - 5, top, 11, 1, "#b07840"); box(o, cx - 5, top + 1, 11, 1, "#7a4c26"); box(o, cx - 3, top + 4, 7, 1, "#4a2a12");
  }
  // a little round table on one leg, its top at row `top`
  function smallTable(o, x, top, floor, rx) {
    for (let x0 = -rx; x0 <= rx; x0++) for (let y = floor; y < floor + 2; y++) dot(o, x + x0, y, "#0c0602", 0.3 - (y - floor) * 0.12);
    for (let j = 0; j < 3; j++) for (let i = -rx; i <= rx; i++) if (Math.hypot(i / (rx + 0.5), (j - 1) / 1.8) < 1) dot(o, x + i, top + j, j === 0 ? "#c08a4a" : j === 2 ? "#5a3418" : "#8a5a2a");
    box(o, x - 1, top + 3, 3, floor - top - 3, "#4a2a12"); box(o, x - 1, top + 3, 1, floor - top - 3, "#6a4220"); box(o, x - 5, floor - 1, 11, 2, "#3a2010"); box(o, x - 5, floor - 1, 11, 1, "#5a3418");
  }
  // mulled cider: a curl of steam off a mug's top now and then
  function steam(ctx, x, y, t, ph) {
    for (let k = 0; k < 3; k++) {
      const a = frac(t / 2.2 + ph + k / 3);
      dot(ctx, x + Math.sin(a * 6 + k * 2) * 1.2, y - a * 8, "#f4ead8", (1 - a) * 0.45);
    }
  }
  // the hearth dog asleep, head down on its paws and an ear flopped over, facing the room; the back rises on the breath
  const DOG_PAL = { f: "#c8843a", F: "#e4aa62", E: "#7a4220", e: "#2a1408", n: "#1a0e08", W: "#f0dcb8", w: "#c8a880", d: "#94582a", p: "#ecd0a0", P: "#c8a070", t: "#d89a50", h: "#b07030" };
  const DOG_ROWS = [
    ".....................EE....",
    ".......FFFFFF.......EEFFF..",
    ".....FFfffffFFF....EEffffF.",
    "....FffffffffffF...EEffeefF",
    "t..FfffffffhhfffF..EEfffffn",
    "t.FfffffffhffffffFEEfWWWWW.",
    "ttffffffffhffffffdEEpWWWw..",
    ".tfffffffffhfffffdpppppp...",
    ".tddddddddddddddpppppPPPP..",
  ];
  const DOG = sprite(DOG_ROWS, DOG_PAL);
  const DOG_BREATH = sprite(["........FFFF.........EE....", "......FFffffFF......EEFFF.."].concat(DOG_ROWS.slice(2)), DOG_PAL);
  const ZED = sprite(["xxx", "..x", ".x.", "xxx"], { x: "#f4ead8" }, null);
  const DIE = sprite(["ww", "wk"], { w: "#f8f2e4", k: "#2a1a10" });
  function corner(sc, town, seed) {
    const RW = 360, rm = room(town, RW, seed), cr = crop(rm.cv, 0, rm.acts), ctx = cr.cv.getContext("2d");
    bunting(ctx, 2, W - 2, 5, 6, PARTY_COLS, 3);
    const over = canvas(W, H), o = over.getContext("2d");
    const acts = cr.acts.slice(), at = {}, FLOOR = 110;
    const groups = (sc.groups || []).length ? sc.groups : sc.heroes.map((id) => ({ kind: "lone", heroes: [id] }));
    const WID = { arm: 68, talk: 54, lone: 30 };
    // someone seated, turned the way they face (1 right, -1 left), a mug in hand: on the knee, to the lips now and then, or up as they talk
    const sitter = (id, x, face, ph, o2) => {
      o2 = o2 || {};
      const left = face < 0, MUG_AT = { rest: [21, 23], sip: [19, 14], talk: [24, 17] };
      return { z: o2.z || 120, draw(c, t) {
        const s = frac(t / 6.5 + ph), where = o2.talking && o2.talking(t) ? "talk" : s > 0.86 ? "sip" : "rest", hand = MUG_AT[where];
        figure(c, id, x, FLOOR, t, { ph, left, still: where !== "rest", dim: o2.dim, pose: sitAt(hand), hold(cc, top) {
          const mx = sx(x, hand[0], left), my = top + hand[1] + 3;
          Anim.put(cc, MUG_WOOD, mx, my, left);
          if (where !== "sip") steam(cc, mx, my - 6, t, ph);
        } });
      } };
    };
    let x = 52;
    groups.forEach((g, gi) => {
      const ids = g.heroes;
      if (g.kind === "arm") {
        // across a little table, elbows down on its top, hands locked between them and rocking: whoever has it this second wins nothing
        const TX = x + WID.arm / 2, TT = FLOOR - SEAT + 24, [a, b] = ids;
        smallTable(o, TX, TT, FLOOR, 10);
        // the clasp sits at TX + lean: the one leaning in shifts a pixel forward, the one giving way draws the hand a pixel back
        const lean = (t) => clamp(R(Math.sin(t * 1.7) * 1.2 + Math.sin(t * 4.3) * 0.4), -1, 1);
        const grip = (t, side) => { const l = lean(t), back = l === side ? 1 : 0; return { x: TX + side * 15 + (l === -side ? l : 0), pose: sitAt([27 - back, 12], [24 - back, 24], 1.35) }; };
        [[a, -1], [b, 1]].forEach(([id, side], k) => {
          const hx = TX + side * 15;
          stool(ctx, hx, FLOOR, -side);
          at[id] = () => ({ x: hx, top: FLOOR - 34 });
          acts.push({ z: 150 + k, draw(c, t) { const g = grip(t, side); figure(c, id, g.x, FLOOR, t, { ph: k * 0.4, still: true, left: side > 0, pose: g.pose }); } });
        });
        acts.push({ z: 4e3, front: true, draw(c, t) {
          // both forearms again over the table top, elbows planted on it
          [[a, -1], [b, 1]].forEach(([id, side]) => { const g = grip(t, side), rc = heroCv(id, 0, side > 0, Object.assign({}, g.pose, { part: "reach" })); if (rc) c.drawImage(rc, R(g.x - 14), FLOOR - rc.height); });
          if (frac(t / 1.6) < 0.5) { dot(c, TX - 20, TT - 18, "#9ad0ff"); dot(c, TX - 20, TT - 17, "#5a9ad0"); }
          if (frac(t / 1.6 + 0.5) < 0.5) { dot(c, TX + 20, TT - 18, "#9ad0ff"); dot(c, TX + 20, TT - 17, "#5a9ad0"); }
          // the knot of the two fists, each half its owner's skin, and a shake as one gives a hair
          const cx = TX + lean(t), cy = TT - 13, skin = (id) => { const s = ((App.heroes[id] || {}).look || {}).skin; return /^#[0-9a-f]{6}$/i.test(s || "") ? s : "#e0b088"; };
          box(c, cx - 4, cy - 1, 8, 5, OL);
          for (const [x0, id] of [[cx - 3, a], [cx, b]]) { const s = skin(id); box(c, x0, cy, 3, 3, s); box(c, x0, cy, 3, 1, mix(s, "#ffffff", 0.25)); dot(c, x0 + (x0 < cx ? 0 : 2), cy + 2, mix(s, "#000000", 0.3)); }
          dot(c, cx - 1, cy + 1, mix(skin(a), "#000000", 0.35)); dot(c, cx, cy + 1, mix(skin(b), "#000000", 0.2));
          if (frac(t / 0.9) < 0.3) { dot(c, cx - 4, cy - 2, "#fff4dc", 0.8); dot(c, cx + 4, cy - 1, "#fff4dc", 0.8); dot(c, cx - 4, cy + 3, "#fff4dc", 0.5); }
          // the side bets, stacked on the table between their elbows
          for (const [dx, n] of [[-3, 3], [2, 2]]) for (let i = 0; i < n; i++) { box(c, TX + dx, TT - 1 - i, 3, 1, i % 2 ? "#c89a3a" : "#f0c860"); dot(c, TX + dx, TT - 1 - i, "#8a6020"); }
        } });
        x += WID.arm;
        return;
      }
      if (g.kind === "talk") {
        // face to face over a stool-table, the one talking lifts their mug to make the point
        const [a, b] = ids, xa = x + 14, xb = x + WID.talk - 14, TX = (xa + xb) / 2;
        smallTable(o, TX, FLOOR - 9, FLOOR, 4);
        const talking = (k) => (t) => Math.floor(t / 2.6 + gi * 0.4) % 2 === k && frac(t / 2.6 + gi * 0.4) < 0.8;
        [[a, xa, 1], [b, xb, -1]].forEach(([id, hx, face], k) => {
          stool(ctx, hx, FLOOR, face);
          at[id] = () => ({ x: hx, top: FLOOR - 34 });
          acts.push(sitter(id, hx, face, h01(gi, k + 1), { talking: talking(k), z: 120 + gi * 2 + k }));
        });
        acts.push({ z: 6e3, front: true, draw(c, t) {
          const k = Math.floor(t / 2.6 + gi * 0.4) % 2;
          if (frac(t / 2.6 + gi * 0.4) > 0.8) return;
          const kinds = ["dots", "ha", "bang", "note"], kk = kinds[(Math.floor(t / 5.2) + k + gi) % kinds.length];
          Anim.put(c, bubble(kk), (k ? xb : xa) + (k ? -7 : 7), FLOOR - 39);
        } });
        acts.push(candleOn(TX, FLOOR - 9, seed + gi));
        x += WID.talk;
        return;
      }
      const id = ids[0], hx = x + 15;
      stool(ctx, hx, FLOOR, -1);
      at[id] = () => ({ x: hx, top: FLOOR - 34 });
      acts.push(sitter(id, hx, -1, h01(gi, 7), { z: 120 + gi * 2 }));
      x += WID.lone;
    });
    // the town's own regulars where the league leaves room: two at dice, or an old-timer with a pipe
    const free = W - 4 - x;
    if (free >= 58) {
      const TX = x + 29, TT = FLOOR - SEAT + 25, pa = folk(seed + 50, { outfit: "cloak", look: { skin: "#f0c8a0", hair: "#a04a20", style: 1, face: 0, fav: "#3a5a8a" } }), pb = folk(seed + 63, { outfit: "leather", look: { skin: "#9a6440", hair: "#2a2228", style: 3, face: 1, fav: "#6a3a3a" } });
      smallTable(o, TX, TT, FLOOR, 8);
      [[pa, -1], [pb, 1]].forEach(([id, side], k) => {
        const hx = TX + side * 13;
        stool(ctx, hx, FLOOR, -side);
        acts.push({ z: 110 + k, draw(c, t) {
          const turn = Math.floor(t / 4) % 2, u = frac(t / 4), throwing = turn === k && u < 0.25;
          figure(c, id, hx, FLOOR, t, { ph: k * 0.3, left: side > 0, dim: 0.4, pose: sitAt(throwing ? [25, 20] : [22, 23]) });
        } });
      });
      acts.push({ z: 4e3, front: true, draw(c, t) {
        const turn = Math.floor(t / 4) % 2, u = frac(t / 4), from = turn ? 1 : -1;
        for (let d = 0; d < 2; d++) {
          const k = clamp((u - 0.12) / 0.25, 0, 1), land = TX + from * (2 - d * 4) * -1 + d * 2 - 1;
          const xx = TX + from * 9 + (land - TX - from * 9) * k, yy = TT - 2 - R(Math.abs(Math.sin(k * Math.PI * 2.5)) * 4 * (1 - k));
          if (u > 0.12 || turn === 1) Anim.put(c, DIE, xx, yy, frac(t * 7 + d) < 0.5 && k < 1);
        }
        for (let i = 0; i < 3; i++) box(c, TX + 4, TT - 1 - i, 3, 1, i % 2 ? "#c89a3a" : "#f0c860");
        if (u > 0.4 && u < 0.6) Anim.put(c, bubble(turn ? "bang" : "ha"), TX + (turn ? 13 : -13) + (turn ? -4 : 4), FLOOR - 39);
      } });
      x += 58;
    }
    if (W - 4 - x >= 26) {
      const id = folk(seed + 77, { outfit: "vest", look: { skin: "#e0b088", hair: "#d8d8e0", style: 2, face: 2, fav: "#5a6a3a" } }), hx = x + 14;
      x += 28;
      stool(ctx, hx, FLOOR, -1);
      acts.push({ z: 110, draw(c, t) {
        figure(c, id, hx, FLOOR, t, { ph: 0.3, left: true, dim: 0.4, pose: sitAt([19, 15]), hold(cc, top) {
          const px = sx(hx, 19, true), py = top + 15;
          box(cc, px - 3, py - 1, 3, 1, "#5a3418"); box(cc, px - 5, py - 3, 2, 2, "#3a2010"); dot(cc, px - 5, py - 3, "#e8803a", frac(t * 1.3) < 0.5 ? 1 : 0.5);
          for (let k = 0; k < 4; k++) { const a = frac(t / 3 + k / 4); dot(cc, px - 4 + Math.sin(a * 5 + k) * 2, py - 5 - a * 14, "#d8d0c8", (1 - a) * 0.5); }
        } });
      } });
    }
    // the barkeep, come over from the bar with a jug, standing by to top up whoever's nearest
    if (W - 4 - x >= 20) {
      const keep = folk(seed + 91, { outfit: "vest", look: { skin: "#c98e62", hair: "#9a9aa6", style: 4, face: 2, fav: "#8a3a2a" } }), kx = R(x + Math.min(14, (W - 4 - x) / 2));
      acts.push({ z: 100, draw(c, t) {
        const pour = frac(t / 7) > 0.7, hand = pour ? [23, 17] : [21, 21];
        shadow(c, kx, FLOOR, 12);
        figure(c, keep, kx, FLOOR, t, { ph: 0.6, left: true, dim: 0.35, pose: { turn: 1, arms: { r: hand, l: [10, 21] } }, hold(cc, top) {
          const jx = sx(kx, hand[0], true), jy = top + hand[1] + 3;
          for (let j = 0; j < 6; j++) for (let i = -2; i <= 2; i++) if (!(j === 0 && Math.abs(i) === 2)) dot(cc, jx + i, jy - 5 + j, i === -2 || i === 2 || j === 0 || j === 5 ? "#3a2010" : i < 0 ? "#d8b078" : "#b08850");
          dot(cc, jx - 3, jy - 4, "#3a2010"); dot(cc, jx + 3, jy - 3, "#3a2010"); dot(cc, jx + 3, jy - 2, "#3a2010");
          if (pour) for (let j = 1; j < 5; j++) dot(cc, jx - 3, jy - 4 + j, "#e8b050", 0.8);
          const cx = sx(kx, 10, true), cy = top + 22;
          box(cc, cx - 1, cy - 1, 3, 4, "#efe6d2"); dot(cc, cx, cy + 3, "#c8bca4");
        } });
      } });
    }
    // the hearth dog, asleep: a breath, now and then a dream
    acts.push({ z: 7e3, front: true, draw(c, t) {
      const b = frac(t / 2.4) < 0.5;
      Anim.put(c, b ? DOG_BREATH : DOG, 26, H - 3);
      if (frac(t / 7) < 0.4) { const a = frac(t / 7) / 0.4; c.globalAlpha = 1 - a; Anim.put(c, ZED, 34 + R(a * 4), H - 14 - R(a * 8)); c.globalAlpha = 1; }
    } });
    acts.push(...marks(sc, at), ...pets(sc, [{ x: 60, y: H - 3, range: 6, front: true, z: 7e3 }, { x: 132, y: H - 2, range: 10, front: true, z: 7e3 }, { x: 214, y: H - 3, range: 6, front: true, z: 7e3 }]));
    return { base: cr.cv, over, acts };
  }

  // ---------- the arm-wrestle: the rivals over a barrel by the fire, framed close as the Closing Games stage it (games_replay.js) ----------
  // a 120x60 frame shown at the other vignettes' size, so the clasp reads at twice their scale; nobody ever wins
  const AW = 120, AH = 60, NEAR = [[20, 22], [5, 7]];
  function armCv(id, k) {
    const key = "arm:" + id + ":" + k;
    if (!cvs.has(key)) {
      let c = null;
      try {
        const h = App.heroes[id];
        c = Art.heroGrid(bare(h), 0, App.heroLook(h)).toCanvas(1);
        const x = c.getContext("2d"), [c0, c1] = NEAR[k], sl = x.getImageData(c0 + 1, 19, 1, 1).data;
        c.sleeve = sl[3] ? `rgb(${sl[0]},${sl[1]},${sl[2]})` : favOf(id);
        x.clearRect(c0, 16, c1 - c0 + 1, 11);
      } catch (e) { c = null; }
      cvs.set(key, c);
    }
    return cvs.get(key);
  }
  function thick(ctx, x0, y0, x1, y1, r, c) {
    ctx.fillStyle = c;
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
      for (let j = Math.floor(-r); j <= Math.ceil(r); j++) for (let i = Math.floor(-r); i <= Math.ceil(r); i++) if (i * i + j * j <= r * r + 0.3) ctx.fillRect(R(x + i), R(y + j), 1, 1);
    }
  }
  function barrel(ctx, cx, top, bottom) {
    const half = 8, x0 = cx - half;
    for (let x = x0 - 2; x <= x0 + 2 * half + 2; x++) dot(ctx, x, bottom, "#0c0602", 0.4);
    for (let y = top; y < bottom; y++) {
      const u = (y - top) / (bottom - top - 1), bulge = R(Math.sin(u * Math.PI) * 1.4);
      for (let x = x0 - bulge; x <= x0 + 2 * half + bulge; x++) {
        const v = (x - (x0 - bulge)) / (2 * half + 2 * bulge), hoop = y === top + 2 || y === top + 3 || y === bottom - 4 || y === bottom - 3;
        let c = mix("#804222", "#3e2012", v);
        if (v < 0.22) c = mix("#aa6032", c, v / 0.22);
        if ((x - x0 + 40) % 4 === 0) c = mix(c, "#000000", 0.22);
        dot(ctx, x, y, hoop ? (v < 0.3 ? "#c8c2b2" : v < 0.7 ? "#78746c" : "#403c38") : c);
      }
    }
    box(ctx, x0, top - 1, 2 * half + 1, 2, "#8c502a"); box(ctx, x0, top - 1, 2 * half + 1, 1, "#bc7842");
  }
  function arm(sc, town, seed) {
    const X0 = 8, Y0 = 58, rm = room(town, 360, seed), base = canvas(AW, AH), ctx = base.getContext("2d");
    ctx.drawImage(rm.cv, -X0, -Y0);
    const acts = rm.acts.map((a) => ({ z: a.z, front: a.front, draw(c, t) { c.save(); c.translate(-X0, -Y0); a.draw(c, t); c.restore(); } }));
    const [a, b] = sc.heroes, cx = AW / 2, FLOOR = AH - 3, TOP = FLOOR - 13, RAD = 7;
    // the bout sways back and forth all night and is never pinned
    const pos = (t) => clamp(0.55 * Math.sin(t * 0.8 + seed % 7) + 0.3 * Math.sin(t * 2.1 + 1) + 0.04 * Math.sin(t * 31), -0.85, 0.85);
    // two regulars behind, in the shade, a mug going up when the arm tips their way
    [[folk(seed + 21, { outfit: "vest" }), 14, 1], [folk(seed + 34, { outfit: "cloak" }), AW - 14, -1]].forEach(([id, x, s], k) => acts.push({ z: 90 + k, draw(c, t) {
      const up = pos(t) * s < -0.4;
      figure(c, id, x, FLOOR - 4, t, { ph: k * 0.5, left: s < 0, dim: 0.45, dy: up ? -1 : 0, pose: { turn: 1, arms: { r: up ? [22, 7] : [21, 19] } }, hold(cc, top) {
        Anim.put(cc, MUG_WOOD, sx(x, up ? 22 : 21, s < 0), top + (up ? 7 : 19) + 3, s < 0);
      } });
    } }));
    acts.push({ z: 200, draw(c, t) {
      const p = pos(t), sides = [{ x: cx - 30, sh: 21, el: cx - 4 }, { x: cx + 2, sh: 6, el: cx + 4 }];
      sides.forEach((s, k) => {
        const hc = armCv(sc.heroes[k], k);
        if (!hc) return;
        // whoever is behind leans in
        s.x += Math.abs(p) > 0.3 && Math.sign(p) === (k ? 1 : -1) ? (k ? -1 : 1) : 0;
        s.y = FLOOR - hc.height;
        s.cv = hc;
        shadow(c, s.x + 14, FLOOR, 16);
        c.drawImage(hc, R(s.x), R(s.y));
      });
      barrel(c, cx, TOP, FLOOR);
      for (const [dx, n] of [[-6, 3], [4, 2]]) for (let i = 0; i < n; i++) { box(c, cx + dx, TOP - 2 - i, 3, 1, i % 2 ? "#c89a3a" : "#f0c860"); dot(c, cx + dx, TOP - 2 - i, "#8a6020"); }
      const phi = p * 1.3, hx = cx + RAD * Math.sin(phi), hy = TOP - 2 - RAD * Math.cos(phi);
      const skinOf = (id) => { const sk = ((App.heroes[id] || {}).look || {}).skin; return /^#[0-9a-f]{6}$/i.test(sk || "") ? sk : "#e0b088"; };
      sides.forEach((s, k) => {
        if (!s.cv) return;
        const shx = s.x + s.sh, shy = s.y + 17, ex = s.el, ey = TOP - 2, mx = ex + (hx - ex) * 0.3, my = ey + (hy - ey) * 0.3;
        thick(c, shx, shy, ex, ey, 2.0, OL); thick(c, ex, ey, hx, hy, 1.9, OL);
        thick(c, shx, shy, ex, ey, 1.2, s.cv.sleeve); thick(c, ex, ey, mx, my, 1.2, s.cv.sleeve);
        thick(c, mx, my, hx, hy, 1.0, skinOf(sc.heroes[k]));
      });
      const skin = mix(skinOf(a), skinOf(b), 0.5);
      thick(c, hx, hy, hx, hy, 2.8, OL); thick(c, hx, hy, hx, hy, 2.0, skin); dot(c, hx - 1, hy - 1, mix(skin, "#ffffff", 0.25));
      // the one giving ground sweats and goes red in the face
      const k = p > 0 ? 1 : 0, s = sides[k];
      if (s.cv && Math.abs(p) > 0.35) {
        if (Math.floor(t * 2.5) % 3 === 0) { dot(c, s.x + (k ? 8 : 19), s.y + 5, "#d6e8fa"); dot(c, s.x + (k ? 8 : 19), s.y + 6 + (Math.floor(t * 6) % 2), "#d6e8fa"); }
        if (frac(t / 1.4) < 0.6) Anim.put(c, VEIN, s.x + (k ? 20 : 8), s.y + 1);
      }
    } });
    return { base, acts, w: AW, h: AH };
  }

  // ---------- the bar: the room's other end, heroes along the counter waiting on the next round ----------
  function bar(sc, town, seed) {
    const RW = 360, rm = room(town, RW, seed), cr = crop(rm.cv, RW - W, rm.acts), ctx = cr.cv.getContext("2d");
    bunting(ctx, 2, W - 2, 5, 6, PARTY_COLS, 4);
    const acts = cr.acts.slice(), at = {}, n = sc.heroes.length, FEET = 106, gap = Math.min(30, (W - 40) / Math.max(1, n));
    sc.heroes.forEach((id, i) => {
      const x = R(W / 2 - (gap * (n - 1)) / 2 + gap * i), ph = h01(i, seed % 53);
      at[id] = () => ({ x, top: FEET - 34 });
      acts.push({ z: 150 + i, draw(c, t) {
        const left = i % 2 === 1, hand = frac(t / 5 + ph) > 0.82 ? [19, 14] : [21, 20];
        shadow(c, x, FEET, 14);
        figure(c, id, x, FEET, t, { ph, left, pose: { turn: 1, arms: { r: hand } }, hold(cc, top) { Anim.put(cc, MUG_WOOD, sx(x, hand[0], left), top + hand[1] + 3, left); } });
      } });
    });
    acts.push(...marks(sc, at), ...pets(sc, [{ x: 20, y: H - 3, range: 8, front: true, z: 7e3 }, { x: W - 20, y: H - 3, range: 8, front: true, z: 7e3 }]));
    return { base: cr.cv, acts };
  }

  // ---------- out back: the stable yard by lantern light, every mount ceremony.py lists doing what it was given ----------
  // nuzzle (a pair nose to nose), scratch (its rump on the fence post; "roll" in older records), brush (the stable hand at its flank), hay, trough, stare (the bone
  // horse, at the tavern's back door), perch (the eagle on the rail), stand; each crew's wagon parked at the back
  const HEN_PAL = { w: "#f0e8d8", W: "#c8bca8", r: "#d8402a", y: "#e8b030", o: "#d89a30" };
  const HEN = [sprite(["...rr.", "...wwy", "wWwww.", ".wWww.", "..o.o."], HEN_PAL), sprite(["......", "......", "wWwwr.", ".wWwwy", "..o.o."], HEN_PAL)];
  const HEART = sprite([".r.r.", "rrrrr", ".rrr.", "..r.."], { r: "#e85a6a" });
  function yard(sc, town, seed) {
    const MA = window.MountArt, GROUND = 46, r = Art.rng(seed * 31 + 7);
    const base = canvas(W, H), ctx = base.getContext("2d");
    if (MA && MA.penBase) ctx.drawImage(MA.penBase(W, H, GROUND, r), 0, 0);
    // night: the yard graded down to blue, the tavern's back door open on the party at the left
    ctx.fillStyle = "rgba(14,18,46,0.5)"; ctx.fillRect(0, 0, W, H);
    const DX = 6, DY = 9;
    box(ctx, DX - 2, DY - 2, 26, GROUND - DY + 2, "#1a1008"); box(ctx, DX - 1, DY - 1, 24, 1, "#5a3a20");
    for (let y = DY; y < GROUND; y++) box(ctx, DX, y, 22, 1, mix("#ffe0a0", "#e8903a", (y - DY) / (GROUND - DY)));
    for (let y = DY + 4; y < GROUND; y += 5) box(ctx, DX + 1, y, 3, 1, "#c87a3a");
    const leaner = dark(folkCv(seed + 512), 0.9);
    for (let y = GROUND; y < GROUND + 16; y++) for (let x = DX - 6 - (y - GROUND); x < DX + 28 + (y - GROUND); x++) dot(ctx, x, y, "#e8a050", 0.16 * (1 - (y - GROUND) / 16));
    const acts = [Anim.glow({ x: DX + 11, y: GROUND - 6, r: 34, rgb: "255,180,90", a: 0.18, amp: 0.06, seed })];
    // someone from the party in the doorway against the light, swaying a little to the music inside
    if (leaner) acts.push({ z: 40, draw(c, t) { c.save(); c.beginPath(); c.rect(DX, DY, 22, GROUND - DY); c.clip(); c.drawImage(leaner, R(DX + 4 + (frac(t / (BEAT * 4)) < 0.5 ? 0 : 1)), GROUND - leaner.height + 1); c.restore(); } });
    acts.push({ z: 50, draw(c, t) { for (let k = 0; k < 2; k++) { const a = frac(t / 2.8 + k * 0.5); c.globalAlpha = a < 0.2 ? a / 0.2 : Math.max(0, 1 - a); c.drawImage(noteCv(PARTY_COLS[(k + Math.floor(t / 2.8)) % 4]), R(DX + 16 + a * 14 + Math.sin(a * 6) * 2), R(DY + 6 - a * 12)); c.globalAlpha = 1; } } });
    for (const [lx, ly] of [[96, 18], [196, 18]]) {
      box(ctx, lx, ly - 4, 1, 3, "#2a1a10"); box(ctx, lx - 2, ly - 1, 5, 1, "#3a2410"); box(ctx, lx - 2, ly, 5, 5, "#3a2410"); box(ctx, lx - 1, ly + 1, 3, 3, "#ffe0a0"); box(ctx, lx - 2, ly + 5, 5, 1, "#3a2410");
      acts.push(Anim.glow({ x: lx, y: ly + 3, r: 50, rgb: "255,190,110", a: 0.3, amp: 0.08, seed: lx }));
      acts.push(Anim.fireflies({ x: lx - 8, y: ly - 4, w: 16, h: 12, n: 2, glow: false, col: "#f0e0c0", seed: seed + lx }));
    }
    bunting(ctx, 30, W - 2, 3, 3, PARTY_COLS, 5);
    const ms = (sc.mounts || []).map((m, i) => Object.assign({ at: i }, m)).filter((m) => MA && (MA.COLOURS || {})[m.kind]);
    const wagons = (sc.wagons || []).filter((w) => MA && MA.WAGONS.includes(w.kind));
    // the units: a nose-to-nose pair, one mount at its business, a parked wagon, and the stable hand at the hay when nobody is being brushed
    const unitsAt = (scn) => {
      const grid = (m) => MA.mountGrid(m.kind, m.colour, 0, scn), out = [], seen = new Set();
      ms.forEach((m, i) => {
        if (seen.has(i)) return;
        seen.add(i);
        // a pair stands with the partner ceremony.py gave it (an older record without one pairs the next nuzzler)
        const j = m.does !== "nuzzle" ? -1 : m.with != null ? ms.findIndex((o, k) => !seen.has(k) && o.at === m.with) : ms.findIndex((o, k) => k > i && !seen.has(k) && o.does === "nuzzle");
        if (j >= 0) { seen.add(j); out.push({ kind: "pair", a: m, b: ms[j], pref: 1, w: grid(m).width + grid(ms[j]).width - 10 }); return; }
        const kind = m.does === "nuzzle" ? "stand" : m.does || "stand";
        const PREF = { hay: 0, stare: 0, perch: 0, scratch: 2, roll: 2, brush: 2, trough: 2 };
        out.push({ kind: kind === "roll" ? "scratch" : kind, a: m, pref: PREF[kind] == null ? 1 : PREF[kind], w: grid(m).width + (kind === "brush" ? 16 : kind === "trough" ? 4 : kind === "scratch" || kind === "roll" ? 5 : 0) });
      });
      wagons.forEach((w) => out.push({ kind: "wagon", w0: w, pref: 0, w: MA.wagonGrid(w.kind, null, 0, scn).width }));
      if (scn && !out.some((u) => u.kind === "brush")) out.push({ kind: "fork", pref: 2, w: 18 });
      return out;
    };
    const SPAN = W - 14, need = (us) => us.reduce((s, u) => s + u.w + 2, 0);
    // people scale when three rows hold everyone, the stables' own smaller scale when they would not
    const SCN = need(unitsAt(true)) <= SPAN * 3 * 1.12;
    const grid = (m, f) => MA.mountGrid(m.kind, m.colour, f, SCN), units = unitsAt(SCN);
    const nRows = clamp(Math.ceil(need(units) / SPAN - 0.05), 1, 3), BACK = GROUND + (SCN ? 32 : 24), FRONT = H - 4;
    const ROWS = nRows === 1 ? [FRONT - 6] : Array.from({ length: nRows }, (_, k) => R(BACK + ((FRONT - BACK) * k) / (nRows - 1)));
    const rows = ROWS.map(() => []), used = ROWS.map(() => 0), room = (k) => SPAN - (k === 0 && nRows > 1 ? 30 : 0) - used[k];
    const prefRow = (p) => (p === 0 ? 0 : p === 2 ? nRows - 1 : Math.floor(nRows / 2));
    const fair = need(units) / nRows + 20;
    for (const u of units.slice().sort((a, b) => b.w - a.w)) {
      let k = prefRow(u.pref);
      if (room(k) < u.w || used[k] + u.w > fair) k = ROWS.map((_, i) => i).sort((p, q) => room(q) - room(p))[0];
      rows[k].push(u); used[k] += u.w + 2;
    }
    // each row spread evenly across the yard, in the order the scene listed them
    rows.forEach((row, k) => {
      row.sort((a, b) => units.indexOf(a) - units.indexOf(b));
      if (k === 0) row.sort((a, b) => (a.kind === "wagon") - (b.kind === "wagon"));
      const x0 = k === 0 && nRows > 1 ? 38 : 6, span = W - 6 - x0, sum = row.reduce((s, u) => s + u.w, 0), gap = Math.max(-12, (span - sum) / (row.length + 1));
      let x = x0 + Math.max(0, gap);
      row.forEach((u, i) => { u.x = x; u.feet = ROWS[k] + (i % 2 && nRows < 3 ? 2 : 0); u.z = 100 + k * 1000 + i; x += u.w + gap; });
    });
    const ph = (m) => h01(m.name.length, (m.name.charCodeAt(0) || 1) % 17);
    const opaque = (cv) => {
      if (cv.bb) return cv.bb;
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      let x0 = cv.width, x1 = 0, y0 = cv.height, y1 = 0;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 100) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); }
      return (cv.bb = x1 > x0 ? { x0, x1, y0, y1 } : { x0: 0, x1: cv.width, y0: 0, y1: cv.height });
    };
    const idle = (m, t) => (frac(t / (2.6 + ph(m) * 2) + ph(m)) < 0.25 ? 1 : 0);
    const shade = (c2, x, feet, w) => { c2.fillStyle = "rgba(10,8,20,0.4)"; c2.fillRect(R(x + 2), R(feet), w - 4, 1); c2.fillRect(R(x + 4), R(feet + 1), w - 8, 1); };
    const put = (c2, cv, x, feet, left, dy) => { Anim.put(c2, cv, x + cv.width / 2, feet + (dy || 0), left); };
    // the stable hand: a townsperson with a brush, at the flank of the mount they're grooming
    const hand = folk(seed + 404, { outfit: "leather", look: { skin: "#c48a5e", hair: "#6a4020", style: 0, face: 1, fav: "#5a6a3a" } });
    for (const u of rows.flat()) {
      if (u.kind === "wagon") {
        acts.push({ z: u.z, draw(c2) { const cv = MA.wagonGrid(u.w0.kind, null, 0, SCN); shade(c2, u.x, u.feet, cv.width); put(c2, cv, u.x, u.feet, true); } });
        continue;
      }
      if (u.kind === "pair") {
        // nose to nose: the first faces right, the second left, heads dipping in turn; a heart now and then
        acts.push({ z: u.z, draw(c2, t) {
          const ca = grid(u.a, idle(u.a, t)), cb = grid(u.b, idle(u.b, t)), xb = u.x + ca.width - 10, k = Math.floor(t / 1.3) % 2;
          shade(c2, u.x, u.feet, ca.width); shade(c2, xb, u.feet, cb.width);
          put(c2, ca, u.x, u.feet, false, k === 0 && frac(t / 1.3) < 0.5 ? 1 : 0);
          put(c2, cb, xb, u.feet, true, k === 1 && frac(t / 1.3) < 0.5 ? 1 : 0);
          // the heart pops up right over the two noses and fades there, so it never drifts up into the row behind
          const hp = frac(t / 5 + ph(u.a));
          if (hp < 0.35) { c2.globalAlpha = hp < 0.25 ? 1 : (0.35 - hp) / 0.1; Anim.put(c2, HEART, u.x + ca.width - 5, u.feet - Math.min(ca.height, cb.height) + 2 - R(Math.min(hp, 0.2) * 10)); c2.globalAlpha = 1; }
        } });
        continue;
      }
      const m = u.a;
      if (u.kind === "scratch") {
        // rump hard against a stubby fence post, rocking on it: the hindquarters dip and rise, scritch marks fly off the post,
        // loose hair drifts down, and between itches a hind hoof stamps up a puff of dust
        acts.push({ z: u.z, draw(c2, t) {
          const p = frac(t / 5 + ph(m)), rub = p < 0.75, cv = grid(m, rub ? 0 : idle(m, t)), bb = opaque(cv), on = rub && frac(t * 2.6) < 0.5;
          const rx = u.x + 4, x = rx - bb.x0 + 1, top = u.feet - (bb.y1 - bb.y0), postTop = top + R((bb.y1 - bb.y0) * 0.25), rump = top + R((bb.y1 - bb.y0) * 0.4);
          shade(c2, x + bb.x0, u.feet, bb.x1 - bb.x0);
          put(c2, cv, x - (on ? 1 : 0), u.feet, false);
          box(c2, rx - 3, postTop, 4, u.feet - postTop + 1, "#6a4628"); box(c2, rx - 3, postTop, 1, u.feet - postTop + 1, "#9a6c40"); box(c2, rx, postTop, 1, u.feet - postTop + 1, "#3a2414");
          box(c2, rx - 4, postTop - 1, 6, 1, "#2a180c"); box(c2, rx - 4, u.feet, 6, 1, "#2a180c");
          if (rub) {
            const k = Math.floor(t * 2.6) % 2;
            for (const [dx, dy] of k ? [[-6, -2], [-7, 1], [-6, 4]] : [[-7, -1], [-6, 2], [-7, 5]]) { dot(c2, rx + dx, rump + dy, "#fff4dc"); dot(c2, rx + dx - 1, rump + dy, "#fff4dc", 0.7); }
            for (let i = 0; i < 5; i++) { const a = frac(t * 0.6 + i / 5); dot(c2, rx - 5 - a * 6 + Math.sin(a * 9 + i) * 2, rump + a * 12, "#f0e4c8", (1 - a)); }
          } else if (p < 0.88) {
            const d = (p - 0.75) / 0.13, hx = x + bb.x0 + 4;
            for (let i = 0; i < 6; i++) dot(c2, hx + Math.cos(i) * d * 6, u.feet - 1 - Math.abs(Math.sin(i * 1.7)) * d * 4, "#c8a870", 1 - d);
          }
        } });
        continue;
      }
      if (u.kind === "fork") {
        // nobody to brush: the stable hand forks hay off a pile, a toss every few seconds
        acts.push({ z: u.z, draw(c2, t) {
          const hx = u.x + 10, p = frac(t / 3.2), up = p > 0.7 && p < 0.85, rh = up ? [21, 11] : [20, 19], lh = up ? [11, 15] : [10, 22];
          for (let j = 0; j < 5; j++) for (let i = -6; i <= 6; i++) if (Math.hypot(i / 6.5, (j - 4) / 4.5) < 1) dot(c2, hx - 12 + i, u.feet - 4 + j, (i + j * 3) % 4 ? "#c8a040" : "#e8c860");
          shadow(c2, hx, u.feet, 12);
          figure(c2, hand, hx, u.feet, t, { left: true, still: true, dim: 0.15, pose: { turn: 1, arms: { r: rh, l: lh } }, hold(c3, top) {
            const ax = sx(hx, rh[0], true), ay = top + rh[1], bx = sx(hx, lh[0], true), by = top + lh[1], dx = ax - bx, dy = ay - by, n = Math.hypot(dx, dy) || 1;
            const tx = ax + (dx / n) * 6, ty = ay + (dy / n) * 6;
            for (let k = 0; k <= 16; k++) { const s = k / 16; dot(c3, bx - (dx / n) * 3 + (tx - bx + (dx / n) * 3) * s, by - (dy / n) * 3 + (ty - by + (dy / n) * 3) * s, "#c8965a"); }
            for (const o of [-1, 0, 1]) { dot(c3, tx + o, ty - 1, "#d8d8e0"); dot(c3, tx + o, ty - 2, "#a8a8b0"); }
            if (up) for (let i = 0; i < 5; i++) dot(c3, tx - 3 + i * 2 - (p - 0.7) * 30, ty - 3 - i % 2 * 2 - (p - 0.7) * 20, "#e8c860", 0.9);
          } });
        } });
        continue;
      }
      if (u.kind === "brush") {
        acts.push({ z: u.z, draw(c2, t) {
          const cv = grid(m, idle(m, t)), bx = u.x + cv.width + 1, stroke = frac(t / 1.1), hx = 8 + R(Math.abs(stroke - 0.5) * 6) - 2;
          shade(c2, u.x, u.feet, cv.width); put(c2, cv, u.x, u.feet, false);
          shadow(c2, bx + 7, u.feet, 12);
          figure(c2, hand, bx + 7, u.feet, t, { left: true, still: true, dim: 0.15, pose: { turn: 1, arms: { r: [28 - hx, Math.max(14, 34 - cv.height * 0.55) | 0] } }, hold(c3, top) {
            const px = sx(bx + 7, 28 - hx, true), py = top + Math.max(14, 34 - cv.height * 0.55) | 0;
            box(c3, px - 2, py - 2, 4, 2, "#8a5a2a"); box(c3, px - 2, py, 4, 1, "#d8c090");
            if (stroke < 0.5) dot(c3, px - 3, py + 1 + R(stroke * 4), "#c8a870", 0.6);
          } });
        } });
        continue;
      }
      const left = u.kind === "trough" || u.kind === "stare";
      acts.push({ z: u.z, draw(c2, t) {
        const cv = grid(m, idle(m, t)), x = u.x + (u.kind === "trough" ? 4 : 0);
        shade(c2, x, u.feet, cv.width);
        if (u.kind === "perch") {
          const fy = u.feet - 6;
          box(c2, u.x - 4, fy, cv.width + 8, 2, "#7a5432"); box(c2, u.x - 4, fy, cv.width + 8, 1, "#9a7044"); box(c2, u.x, fy + 2, 2, u.feet - fy - 2, "#3a2414"); box(c2, u.x + cv.width - 2, fy + 2, 2, u.feet - fy - 2, "#3a2414");
          put(c2, cv, u.x, fy, false);
          return;
        }
        if (u.kind === "trough") {
          // a low trough at its muzzle, the water shivering when it drinks
          box(c2, u.x - 2, u.feet - 6, 10, 6, "#3a2414"); box(c2, u.x - 1, u.feet - 5, 8, 1, "#6a9ab0"); box(c2, u.x - 1, u.feet - 4, 8, 4, "#5a3a1e");
          if (frac(t / 1.7 + ph(m)) < 0.4) dot(c2, u.x + 2 + R(frac(t * 2) * 3), u.feet - 5, "#c8e8f0");
        }
        put(c2, cv, x, u.feet, left);
        if (u.kind === "hay" && frac(t / 2.3 + ph(m)) < 0.3) for (let i = 0; i < 3; i++) dot(c2, x + cv.width - 6 + i, u.feet - cv.height * 0.55 + i * 3 + R(frac(t * 1.5) * 4), "#e8c860");
        if (u.kind === "stare" && frac(t / 3.1) < 0.5) { dot(c2, x + 4, u.feet - cv.height + 6, "#a8f0d8"); }
        if (u.kind === "stand") for (let i = 0; i < 2; i++) { const a = frac(t / 2 + i / 2); dot(c2, x + 4 + h01(i, 9) * (cv.width - 8), u.feet - cv.height + 4 - a * 6, "#fff8e0", 1 - a); }
      } });
    }
    // the yard's hens, up past their bedtime, pecking between the hooves
    for (let i = 0; i < 3; i++) {
      const hx0 = 30 + i * 78 + R(h01(i, seed % 23) * 30), hy = H - 2 - (i % 2) * 14, range = 10 + i * 3;
      acts.push({ z: 9e3 + i, front: true, draw(c2, t) {
        const u = frac(t / (7 + i) + h01(i, 4)), walk = u < 0.3 || (u > 0.5 && u < 0.8), dir = u < 0.5 ? 1 : -1;
        const x = hx0 + (u < 0.3 ? u / 0.3 : u < 0.5 ? 1 : u < 0.8 ? 1 - (u - 0.5) / 0.3 : 0) * range, peck = !walk && frac(t * 1.7 + i) < 0.4;
        Anim.put(c2, peck ? HEN[1] : HEN[0], x, hy - (walk && frac(t * 4) < 0.5 ? 1 : 0), dir < 0);
      } });
    }
    // the hay rack along the back wall, where the back row eats
    for (let x = 40; x < W - 8; x += 3) { box(ctx, x, GROUND - 14, 1, 8, "#5a3a1e"); }
    box(ctx, 38, GROUND - 15, W - 46, 1, "#7a5432"); box(ctx, 38, GROUND - 6, W - 46, 1, "#3a2414");
    for (let x = 40; x < W - 10; x++) if (h01(x, 2) > 0.35) dot(ctx, x, GROUND - 13 + R(h01(x, 5) * 5), h01(x, 7) > 0.5 ? "#c8a040" : "#9a7a30");
    return { base, acts };
  }

  const MAKERS = { toast, band, dance, arm, corner, bar, yard };
  const TITLES = { toast: "The long table", band: "The band", dance: "The dance floor", arm: "The arm-wrestle", corner: "By the fire", bar: "At the bar", yard: "Out back" };
  function scene(sc, town, seed) {
    const make = MAKERS[sc.kind];
    if (!make || !window.Art || !window.Anim) return null;
    const known = sc.heroes.filter((id) => App.heroes[id]);
    if (sc.kind === "yard" ? !window.MountArt || !(sc.mounts || []).length && !(sc.wagons || []).length : !known.length) return null;
    const s = Object.assign({}, sc, { heroes: known });
    const out = make(s, town || "ironhaven", seed);
    const cv = canvas(out.w || W, out.h || H);
    cv.className = "party-canvas";
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", TITLES[sc.kind] + ": " + (sc.kind === "yard" ? (sc.mounts || []).map((m) => m.name) : known.map((id) => App.heroes[id].name)).join(", "));
    Anim.stage(cv, out.base, out.acts, { over: out.over, still: 4.1 });
    return cv;
  }

  window.FinaleParty = { scene, TITLES, W, H };
})();
