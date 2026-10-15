/* Meal replays: a camp cook in six beats (the haul, into the fire, two close-ups, the dish, the verdict round the fire, and a punchline when it went wrong) or a dish at a tavern, bakery or stall (the special for one, the feast for a crew), drawn from a meal record with synthesised sound. */
/*
  INPUT: one meal record (league/food.py writes one per cooking night and per named dish bought in town; see food.md "Meal replay record"):
    { id, day, season,
      kind: "camp" | "tavern",
      where?: "tavern" | "bakery" | "stall"       for kind "tavern": the room, the bakery counter or the street stall (default "tavern"),
      dish: dish id in league/content/food.py,  name: its display name,
      family: the art family ("steak", "stew", "seafood", "grain", "pie", "greens", "legendary", ...; anything unknown falls back on plate),
      method: "iron" | "pot" | "steam" | "spit" | "embers" | "cold"   how it's cooked at camp (beats 2 to 4),
      plate: the dish's drawing (slab, stew, skewer, crisps, roast, pie, bun, soup, jelly, fillet, claws, salad, pilaf, porridge, sweet, ice, sausage),
      pal: the dish's colour word (drake, wolf, crab, pilaf, ...),
      legendary: bool (the showpiece treatment; never a disaster),  disaster: bool (camp only),
      cook: the cooking hero's id (camp),
      eaters: [ { id, name }, ... ]   everyone at the meal, the cook included; at a tavern one eater is "the special", more are "the feast" (4 shown),
      reactions?: { heroId: "seconds" | "wow" | "love" | "meh" | "ugh" },  verdict: "great" | "good" | "plain" | "bad",
      parts: [ goods ids laid out in the haul ],  notes?: [ the field notes, "|" breaks a line ],
      place: town, wild or dungeon id (the camp's sky or cave, the town's tavern),  night?: bool (default true),
      special?: bool (the weekly special: the chalkboard shows it),  line?: the cut-in's line,  text?: a sentence for under the player }

  MealReplay.player(rec, opts) -> <figure> that plays while on screen, holds on the last beat, replays on click; under reduced motion it
    shows the dish. opts.scale (CSS px per pixel, default fluid to 100% width), opts.heroes (id -> hero, default App.heroes).
  MealReplay.frame(rec, t, opts) -> { w, h, data: RGBA bytes } (no DOM; tools capture with it).
  MealReplay.length(rec) -> seconds before the hold. MealReplay.beats(rec) -> [{ id, t0, t1 }]. MealReplay.events(rec) -> the sound cues.
*/
(function (root) {
  "use strict";
  const FA = root.FoodArt, K = FA.kit, B = FA.bits;
  const { W, H, Img, C, mix, pick, rng, hash, fbm, h2, bay, clamp, lerp, TAU, glow, light, star, outline, text, textWidth, steam } = K;
  const ease = (t) => 1 - (1 - t) * (1 - t);
  const ease3 = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const back = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const METHODS = ["iron", "pot", "steam", "spit", "embers", "cold"];

  // ---------- the record, filled in ----------
  function placeOf(id) {
    const S = (root.App && root.App.S) || (root.LD && root.LD.static) || {};
    for (const [k, kind] of [["towns", "town"], ["dungeons", "dungeon"], ["wilds", "wild"]]) {
      const p = (S[k] || {})[id];
      if (p) return { id, kind, biome: p.biome || "plains", name: p.name || id, tavern: p.tavern };
    }
    return { id: id || "", kind: "wild", biome: "plains", name: "" };
  }
  function norm(rec) {
    const r = Object.assign({}, rec);
    const spec = FA.dish(r);
    r.spec = spec;
    r.method = METHODS.includes(r.method) ? r.method : METHODS.includes(r.cook) ? r.cook : spec.method;
    if (METHODS.includes(r.cook)) r.cook = r.chef || ((r.eaters || [])[0] || {}).id;
    r.legendary = !!(r.legendary || spec.legendary);
    r.disaster = !!r.disaster && !r.legendary && r.kind !== "tavern";
    r.eaters = (r.eaters || []).slice(0, 5);
    r.verdict = r.disaster ? "bad" : r.verdict || "good";
    r.place = placeOf(r.place);
    r.night = r.night !== false;
    r.seed = hash(r.id || r.dish || "meal");
    return r;
  }

  // ---------- heroes: the real sprite and bust portrait as pixel buffers ----------
  function gridImg(g) {
    if (!g) return null;
    const im = new Img(g.w, g.h);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const c = g.px[y * g.w + x]; if (c) im.px(x, y, c); }
    return im;
  }
  function castOf(r, opts) {
    const A = root.App || {}, heroes = (opts && opts.heroes) || A.heroes || {}, S = A.S || (root.LD && root.LD.static) || {};
    return r.eaters.map((e, i) => {
      const h = Object.assign({ id: e.id, name: e.name }, heroes[e.id] || {}, e.look ? e : {});
      const cls = (S.classes || {})[h.cls] || (S.classes || {}).warrior || { look: { outfit: "leather", head: "none" } };
      let sprite = null, portrait = null, seated = null;
      try { if (root.Art && h.look) sprite = gridImg(root.Art.heroGrid(h, 0, cls)); } catch (e) { sprite = null; }
      try { if (root.Art && root.Art.heroSeated && h.look) seated = gridImg(root.Art.heroSeated(bare(h), 0, cls)); } catch (e) { seated = null; }
      try { if (root.Paint && h.look) portrait = gridImg(root.Paint.portraitGrid(h, cls, { bg: false })); } catch (e) { portrait = null; }
      return { id: e.id, name: e.name || h.name || "", i, h, sprite: sprite || stand(i), seated: seated || sprite || stand(i), portrait, skin: (h.look || {}).skin, cook: e.id === r.cook, pet: h.pet || null };
    });
  }
  // supper by the fire: weapons are put down
  function bare(h) {
    const kit = h.kit ? JSON.parse(JSON.stringify(h.kit)) : null;
    if (kit) { kit.weapon = null; kit.offhand = null; if (kit.back && kit.back.art === "quiver") kit.back = null; }
    return Object.assign({}, h, { alive: true, weapon: "none", weapon_tier: 1 }, kit ? { kit } : {});
  }
  // someone with no art to hand (an old record, a tool page): a plain dark figure, rim-lit at the fire
  function stand(i) {
    const im = new Img(28, 34), r = rng(i * 77 + 5);
    const hw = 4 + Math.floor(r() * 2), bw = 6 + Math.floor(r() * 3);
    for (let y = 0; y < 34; y++) for (let x = 0; x < 28; x++) {
      const dx = Math.abs(x - 13.5);
      if ((y >= 4 && y < 13 && Math.hypot(dx / hw, (y - 8.5) / 4.5) < 1) || (y >= 12 && y < 34 && dx < bw - (y < 15 ? 15 - y : 0))) im.px(x, y, "#1a1414");
    }
    return im;
  }

  // ---------- small drawing helpers on top of the kit ----------
  function blit(dst, src, x, y, sx, sy, fn) {
    sx = sx || 1; sy = sy || sx;
    const w = Math.round(src.w * Math.abs(sx)), h = Math.round(src.h * Math.abs(sy));
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < h; j++) {
      const ty = y + j;
      if (ty < 0 || ty >= dst.h) continue;
      const v = Math.min(src.h - 1, Math.floor(j / Math.abs(sy)));
      for (let i = 0; i < w; i++) {
        const tx = x + i;
        if (tx < 0 || tx >= dst.w) continue;
        const u = Math.min(src.w - 1, Math.floor((sx < 0 ? w - 1 - i : i) / Math.abs(sx)));
        const o = (v * src.w + u) * 4, a = src.d[o + 3];
        if (!a) continue;
        let c = [src.d[o], src.d[o + 1], src.d[o + 2]];
        if (fn) { c = fn(c, u, v, i, j); if (!c) continue; }
        dst.px(tx, ty, c, a / 255);
      }
    }
  }
  // a light that flickers: the mask is worked out once, each frame only scales it
  function mask(cx, cy, rx, ry, pw) {
    const m = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot((x - cx) / rx, (y - cy) / ry); m[y * W + x] = d < 1 ? Math.pow(1 - d, pw || 2) : 0; }
    return m;
  }
  function lit(img, m, col, a) {
    const c = C(col), d = img.d;
    for (let i = 0, n = W * H; i < n; i++) {
      const v = m[i] * a;
      if (v < 0.004) continue;
      const q = Math.floor(v * 10 + bay(i % W, (i / W) | 0)) / 10;
      if (q <= 0) continue;
      const o = i * 4;
      d[o] += c[0] * q; d[o + 1] += c[1] * q; d[o + 2] += c[2] * q;
    }
  }
  function darken(img, a, col) {
    const c = C(col || "#000000"), d = img.d;
    for (let i = 0; i < d.length; i += 4) { d[i] = lerp(d[i], c[0], a); d[i + 1] = lerp(d[i + 1], c[1], a); d[i + 2] = lerp(d[i + 2], c[2], a); }
  }
  const flick = (t, s) => 0.82 + 0.1 * Math.sin(t * 9.1 + s) + 0.06 * Math.sin(t * 23.7 + s * 2) + 0.05 * Math.sin(t * 4.3);

  // a living flame: noise tongues licking up from a bed, white-gold core to red tips
  const FIRE = [C("#5a1206"), C("#a8280a"), C("#e05a12"), C("#ff9a2a"), C("#ffd25a"), C("#fff6d0")];
  function flame(img, cx, by, w, h, t, seed, o) {
    o = o || {};
    const x0 = Math.floor(cx - w), x1 = Math.ceil(cx + w), y0 = Math.floor(by - h);
    for (let y = y0; y <= by; y++) {
      const v = (by - y) / h;
      for (let x = x0; x <= x1; x++) {
        const u = (x + 0.5 - cx) / w;
        const n = fbm(x / 5 + seed, y / 4 + t * 3.2, seed, 2), n2 = fbm(x / 2.5, y / 2 + t * 6, seed + 3, 2);
        const width = (1 - v) * (0.75 + 0.35 * Math.sin(v * 5 + t * 4 + u * 3));
        const k = width - Math.abs(u) * (1 + v * 0.6) + (n - 0.5) * 0.9 + (n2 - 0.5) * 0.35 - v * 0.25;
        if (k <= 0) continue;
        const heat = Math.min(1, k * 2.2 + (1 - v) * 0.35 - Math.abs(u) * 0.3);
        const c = FIRE[clamp(Math.floor(heat * 5.99 + (bay(x, y) - 0.5) * 0.7), 0, 5)];
        img.px(x, y, o.tint ? mix(c, o.tint, 0.55) : c);
      }
    }
  }
  function embers(img, cx, by, n, t, seed, spread, rise) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const ph = r(), sp = 0.5 + r() * 0.8, dx = (r() - 0.5) * (spread || 30), life = (t * sp * 0.4 + ph) % 1;
      const x = cx + dx + Math.sin(life * 6 + i) * 5 * life, y = by - life * (rise || 60);
      img.px(x, y, life < 0.5 ? "#ffd25a" : life < 0.8 ? "#ff8a2a" : "#a8320a", 1 - life * 0.7);
    }
  }
  function sparkleAt(img, x, y, t, t0, s) {
    const u = (t - t0) / 0.5;
    if (u < 0 || u > 1) return;
    star(img, x, y, "#fffbe8", Math.max(1, Math.round((s || 3) * Math.sin(u * Math.PI))));
  }
  function twinkles(img, pts, t, period) {
    pts.forEach(([x, y, s], i) => {
      const u = ((t + i * 0.37) % (period || 1.6)) / (period || 1.6);
      if (u < 0.45) star(img, x, y, "#fffbe8", Math.max(1, Math.round((s || 2) * Math.sin((u / 0.45) * Math.PI))));
    });
  }

  // ---------- words: SFX, field notes, the name card, speech bubbles ----------
  function sfx(img, s, x, y, t, o) {
    o = o || {};
    if (t < 0) return;
    const pop = t < 0.12 ? 1 + (0.12 - t) * 4 : 1, k = o.k || 2, al = o.fade && t > o.fade ? Math.max(0, 1 - (t - o.fade) / 0.3) : 1;
    if (al <= 0) return;
    const jit = (i) => Math.round(Math.sin(i * 2.1 + t * 30) * (o.shake || 0));
    const fill = o.fill || ((xx, yy) => (yy % 4 < 2 ? "#ffe27a" : "#ffc23a"));
    const lay = new Img(W, H), tw = textWidth(s, { k, bold: true });
    // a long word near the edge slides in rather than running off the frame
    if (o.center) x = clamp(x, tw / 2 + 3, W - tw / 2 - 3); else x = clamp(x, 3, W - tw - 3);
    text(lay, s, x, y - (pop - 1) * 6, "#ffd24a", { k, bold: true, center: o.center, outline: "#2a0c04", fill, wave: (i) => jit(i) + (o.wave ? Math.sin(t * 8 + i) * 1.4 : 0) });
    img.paste(lay, 0, 0, al);
  }
  function wrap(s, w) {
    const out = [];
    for (const part of String(s).split("|")) {
      let line = "";
      for (const word of part.trim().split(/\s+/)) {
        const next = line ? line + " " + word : word;
        if (line && textWidth(next) > w) { out.push(line); line = word; } else line = next;
      }
      if (line) out.push(line);
    }
    return out;
  }
  // a torn paper tag with the cook's notes, pinned down, a leader line to what it's about
  function note(img, lines, x, y, u, tx, ty) {
    if (u <= 0) return;
    u = Math.min(1, u);
    const w = Math.max(...lines.map((l) => textWidth(l))) + 8, h = lines.length * 9 + 5, dy = Math.round((1 - ease3(u)) * -5);
    y += dy;
    if (tx !== undefined) {
      const ax = clamp(tx, x, x + w), ay = ty < y ? y : y + h;
      const n = Math.max(Math.abs(tx - ax), Math.abs(ty - ay));
      for (let i = 0; i <= n * ease(u); i += 2) img.px(lerp(ax, tx, i / n), lerp(ay, ty, i / n), "#f2e2bc", 0.85);
      img.px(tx, ty, "#fff4d8"); img.px(tx + 1, ty, "#c8b48a");
    }
    const r = rng(lines.join().length * 31 + x);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const edgeT = j === 0 && r() < 0.3, edgeB = j === h - 1 && r() < 0.35;
      if (edgeT || edgeB) continue;
      const t = 0.62 + (i / w) * 0.1 - (j / h) * 0.18 + (fbm((x + i) / 6, (y + j) / 6, 41) - 0.5) * 0.3;
      img.px(x + i, y + j, pick(K.P.paper, t, x + i, y + j), u < 1 ? ease(u) : 1);
    }
    for (let i = 1; i < w; i++) img.px(x + i, y + h, "#1a0e08", 0.55);
    for (let j = 1; j <= h; j++) img.px(x + w, y + j, "#1a0e08", 0.55);
    img.px(x + w - 4, y + 2, "#8a2a1a"); img.px(x + w - 3, y + 2, "#c84a2a"); img.px(x + w - 4, y + 3, "#5a1a10");
    const reveal = Math.floor(clamp(u * 1.6, 0, 1) * lines.join("").length);
    let k = 0;
    lines.forEach((l, i) => {
      const part = l.slice(0, Math.max(0, reveal - k));
      k += l.length;
      if (part) text(img, part, x + 4, y + 10 + i * 9, "#2a1810");
    });
  }
  function nameCard(img, name, t, o) {
    o = o || {};
    if (t <= 0) return;
    if (!o.line2 && textWidth(name, { bold: true }) > W - 24) {
      const words = name.split(" "), half = name.length / 2;
      let cut = 1, best = 1e9;
      for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(" ").length - half); if (d < best) { best = d; cut = i; } }
      nameCard(img, words.slice(cut).join(" "), t, Object.assign({}, o, { line2: true, legendary: false }));
      return nameCard(img, words.slice(0, cut).join(" "), t, Object.assign({}, o, { line2: true, y: (o.y || (o.sub ? H - 22 : H - 12)) - 15, sub: null }));
    }
    const u = ease3(clamp(t / 0.45, 0, 1)), k = textWidth(name, { k: 2, bold: true }) > W - 24 ? 1 : 2;
    // it drops into place rather than sliding in from past the left edge, so no frame shows the name cut off
    const tw = textWidth(name, { k, bold: true }), x = 10, y = (o.y || (o.sub ? H - 22 : H - 12)) - Math.round((1 - u) * 8);
    const gold = o.legendary ? ["#fff6c8", "#ffe08a", "#f0b840", "#c8841c"] : ["#fff8e8", "#f8e2b0", "#e8c07a", "#c89048"];
    for (let i = -6; i < tw + 26; i++) for (let j = -18 * (k / 2) - 4; j < 6; j++) {
      const a = 0.62 * (1 - Math.max(0, i - tw) / 26) * (1 - Math.abs(j + 6) / 22);
      if (a > 0.05) img.px(x + i, y + j, "#0a0604", Math.floor(a * 5 + bay(x + i, y + j)) / 5);
    }
    text(img, name, x, y, gold[1], { k, bold: true, outline: "#1a0c06", shadow: "#000000", sk: 2, fill: (xx, yy) => gold[clamp(Math.floor(((yy - (y - 7 * k)) / (7 * k)) * 4), 0, 3)] });
    const lw = Math.round(tw * ease(clamp((t - 0.25) / 0.4, 0, 1)));
    for (let i = 0; i < lw; i++) { img.px(x + i, y + 3, gold[2]); img.px(x + i, y + 4, gold[3], 0.6); }
    if (o.sub && t > 0.5) text(img, o.sub, x + 1, y + 13, "#e8d4b0", { outline: "#140a04" });
    if (o.legendary) {
      const lab = "LEGENDARY MEAL", lw = textWidth(lab) + 10, ly = y - 7 * k - 16;
      img.rect(x - 2, ly - 9, lw, 12, "#7a1a10"); img.rect(x - 2, ly - 9, lw, 1, "#c8841c"); img.rect(x - 2, ly + 2, lw, 1, "#c8841c");
      img.px(x - 3, ly - 3, "#7a1a10"); img.px(x - 4, ly - 4, "#7a1a10"); img.px(x - 4, ly - 2, "#7a1a10"); img.px(x + lw - 2, ly - 3, "#7a1a10");
      text(img, lab, x + 3, ly, "#ffe08a");
      for (const [dx, dy, s] of [[-4, -16, 2], [tw + 6, -12, 3], [tw / 2, -22, 2]]) sparkleAt(img, x + dx, y + dy - 10, (t % 1.4) + 0.3, 0.3, s);
    }
  }
  const HEART = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];
  // a speech bubble: pops with an overshoot, a tail to the speaker's head
  function bubble(img, say, x, y, t, side) {
    if (t <= 0) return;
    const u = clamp(t / 0.22, 0, 1), sc = Math.max(0.2, back(u)), heartB = say === "<3";
    const w0 = heartB ? 20 : textWidth(say) + 10, h0 = heartB ? 18 : 15;
    const bw = Math.max(5, Math.round(w0 * sc)), bh = Math.max(4, Math.round(h0 * sc));
    const bx = clamp(Math.round(x - bw / 2), 2, W - bw - 2), by = Math.round(y - bh);
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      const cnr = (i < 2 && j < 2 && i + j < 2) || (i > bw - 3 && j < 2 && bw - 1 - i + j < 2) || (i < 2 && j > bh - 3 && i + bh - 1 - j < 2) || (i > bw - 3 && j > bh - 3 && bw - 1 - i + bh - 1 - j < 2);
      if (cnr) continue;
      const edge = i === 0 || j === 0 || i === bw - 1 || j === bh - 1 || (i === 1 && (j === 1 || j === bh - 2)) || (i === bw - 2 && (j === 1 || j === bh - 2));
      img.px(bx + i, by + j, edge ? "#1a1010" : j > bh - 4 ? "#e4dccf" : "#fffaf0");
    }
    const tx = clamp(Math.round(x), bx + 3, bx + bw - 4), sd = side || 0;
    for (let k = 0; k < 5; k++) {
      img.px(tx - 1 + sd * k, by + bh - 1 + k, "#1a1010"); img.px(tx + 2 + sd * k - (k > 2 ? 1 : 0), by + bh - 1 + k, "#1a1010");
      for (let q = tx + sd * k; q < tx + 2 + sd * k - (k > 2 ? 1 : 0); q++) img.px(q, by + bh - 1 + k, k < 4 ? "#e4dccf" : "#1a1010");
    }
    if (u < 0.8) return;
    if (heartB) {
      HEART.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === "#") img.rect(bx + Math.round(bw / 2) - 7 + i * 2, by + 3 + j * 2, 2, 2, j < 2 && i < 3 ? "#ff8a8a" : j > 3 ? "#b81e2a" : "#e0303a"); });
      img.rect(bx + Math.round(bw / 2) - 5, by + 5, 2, 2, "#ffffff");
      return;
    }
    const red = /^!+$/.test(say);
    text(img, say, bx + 5, by + 12, red ? "#d0202a" : "#2a1810", { bold: red });
  }

  // ---------- night skies, tree lines and caves behind the camp ----------
  const SKY = {
    forest: { sky: ["#05070e", "#0a0f1c", "#121a2a"], far: "#0c1410", near: "#070a08", shape: "pines" },
    plains: { sky: ["#06080f", "#0c1222", "#162036"], far: "#10141a", near: "#08090c", shape: "hills" },
    hills: { sky: ["#07070e", "#0e1020", "#1a1a2e"], far: "#141218", near: "#0a0809", shape: "crags" },
    snow: { sky: ["#060a14", "#0e1828", "#1a2a40"], far: "#2a3448", near: "#141a26", shape: "peaks" },
    coast: { sky: ["#050a12", "#0a1424", "#14243a"], far: "#0c1622", near: "#06080c", shape: "sea" },
    marsh: { sky: ["#06090a", "#0c1414", "#142020"], far: "#0e1612", near: "#070a08", shape: "reeds" },
    volcanic: { sky: ["#0c0606", "#1a0a08", "#2a120c"], far: "#1a0c0a", near: "#0a0605", shape: "crags" },
  };
  function sky(img, r, horizon) {
    const look = SKY[r.place.biome] || SKY.plains;
    if (r.place.kind === "dungeon") return cave(img, r, horizon);
    const sk = look.sky.map(C), rr = rng(r.seed + 1);
    img.fill((x, y) => pick(sk, 0.15 + (y / horizon) * 0.9 + (fbm(x / 60, y / 30, 3) - 0.5) * 0.3, x, y));
    for (let i = 0; i < 70; i++) { const x = rr() * W, y = rr() * horizon * 0.85, b = rr(); img.px(x, y, b > 0.9 ? "#fff6e0" : b > 0.6 ? "#a8b8d0" : "#58687e"); }
    const ridge = (x, base, amp, f, seed) => base - amp * (fbm(x / f, 0.5, seed, 3) - 0.3);
    for (let x = 0; x < W; x++) {
      let top;
      if (look.shape === "pines") top = ridge(x, horizon - 4, 26, 30, 5) - (((x * 7) % 13) < 6 ? (((x * 7) % 13) - 3) * -2 + 6 : 0);
      else if (look.shape === "peaks") top = horizon - 10 - Math.abs(((x + 30) % 90) - 45) * 0.9 + fbm(x / 8, 1, 6) * 6;
      else if (look.shape === "crags") top = ridge(x, horizon - 2, 30, 24, 7);
      else if (look.shape === "sea") top = horizon + 2;
      else top = ridge(x, horizon, 14, 50, 8);
      for (let y = Math.max(0, Math.floor(top)); y < H; y++) img.px(x, y, look.far);
      if (look.shape === "snow") for (let y = Math.floor(top); y < top + 3; y++) img.px(x, y, "#4a5a78");
    }
    if (look.shape === "sea") for (let y = horizon + 2; y < horizon + 14; y++) for (let x = 0; x < W; x++) if ((x * 3 + y * 11) % 17 === 0) img.px(x, y, "#2a3e5a");
    for (let x = 0; x < W; x++) {
      const top = horizon + 10 + (fbm(x / 22, 2.5, 9) - 0.5) * 10 - (look.shape === "pines" && (x % 37) < 9 ? 30 - Math.abs((x % 37) - 4) * 6 : 0) - (look.shape === "reeds" && (x * 5) % 7 < 2 ? 6 + (x % 5) : 0);
      for (let y = Math.max(0, Math.floor(top)); y < H; y++) img.px(x, y, look.near);
    }
    img.rect(W - 46, 14, 1, 1, "#fff6e0");
    glow(img, 196, 22, 10, "#c8d8f0", 0.3);
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 25 && (x + 2) * (x + 2) + (y - 1) * (y - 1) > 18) img.px(196 + x, 22 + y, x + y < 0 ? "#fff8e4" : "#d8d0bc");
  }
  function cave(img, r, horizon) {
    const rr = rng(r.seed + 2);
    img.fill((x, y) => {
      const n = fbm(x / 18, y / 12, 31, 4), n2 = fbm(x / 5, y / 4, 32, 2);
      const t = 0.12 + n * 0.35 + (n2 > 0.62 ? 0.12 : 0) - (y / H) * 0.1;
      return pick(K.R(["#05060a", "#0a0c12", "#10141c", "#181e28", "#222a36"]), t, x, y);
    });
    for (let i = 0; i < 9; i++) {
      const x = rr() * W, len = 8 + rr() * 22, w = 2 + rr() * 4;
      for (let j = 0; j < len; j++) for (let k = -w; k <= w; k++) if (Math.abs(k) < w * (1 - j / len)) img.px(x + k, j, k < 0 ? "#141a24" : "#0a0c12");
    }
    for (let i = 0; i < 14; i++) { const x = rr() * W, y = rr() * horizon; img.px(x, y, "#6ab8c8", 0.6); glow(img, x, y, 3, "#4a9ab0", 0.25); }
  }

  // ---------- the camp by night, seen wide: ground, stones, logs, the fire, what's on it ----------
  function campWide(r, o) {
    o = o || {};
    const img = new Img(W, H, "#000000"), horizon = o.horizon || 70;
    sky(img, r, horizon);
    const g = r.place.biome === "snow" ? ["#1a2030", "#242c3e", "#323c52", "#46526a"] : r.place.kind === "dungeon" ? ["#0c0e12", "#14161c", "#1c2028", "#262a34"] : r.place.biome === "coast" ? ["#1a1610", "#242016", "#302a1e", "#3e3626"] : ["#0e0c08", "#16120c", "#201a10", "#2c2416"];
    const gr = K.R(g);
    for (let y = horizon + 14; y < H; y++) for (let x = 0; x < W; x++) {
      const near = (y - horizon) / (H - horizon), t = 0.15 + near * 0.35 + (fbm(x / 9, y / 4, 12) - 0.5) * 0.35;
      img.px(x, y, pick(gr, t, x, y));
      if (r.place.biome === "forest" || r.place.biome === "plains") if ((x * 7 + y * 13) % 29 === 0 && near > 0.3) img.px(x, y - 1, "#2a3a1a");
    }
    return img;
  }
  function stones(img, cx, cy, rx, ry, seed) {
    const r = rng(seed);
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (0.05 + (i / 10) * 0.9) + (r() - 0.5) * 0.1, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry * 0.6 + 2, s = 4 + r() * 2.5;
      const E = K.ell(x, y, s, s * 0.65);
      K.hrender(img, [x - s - 1, y - s - 1, x + s + 1, y + s + 1], (xx, yy) => { const d = E(xx, yy); return d > 1 ? null : Math.sqrt(1 - d * d) * s * 0.8; },
        (xx, yy, inf) => pick(K.R(["#0a0a0c", "#16161a", "#24242a", "#3a3a40", "#5a5650"]), 0.1 + inf.diff * 0.5 + inf.fire * 0.4, xx, yy));
    }
  }
  function logs(img, cx, cy) {
    for (const [dx, dy, len, ang] of [[-10, 2, 26, -0.25], [8, 3, 24, 0.3], [0, -1, 22, 0.05]]) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      for (let i = -len / 2; i < len / 2; i++) for (let k = -2; k <= 2; k++) {
        const x = cx + dx + i * ca - k * sa * 0.5, y = cy + dy + i * sa * 0.4 + k;
        const ember = Math.abs(i) < 6 && k < 1;
        img.px(x, y, ember ? (k === 0 ? "#ff7a20" : "#a8320a") : k < 0 ? "#3a2416" : k === 2 ? "#120a06" : "#24160c");
      }
    }
  }
  // a hero at the fire (beats 6 and 7): their own colours under the night, warm on the side facing the flames with a hot rim, a cool
  // moon edge behind; the art faces right, so the fire is always on the source's right (x + 1) once a far-side hero is mirrored.
  // A bad supper burns green, and lights them green.
  function firelit(spr, faceRight, k, hot) {
    const w = spr.w, h = spr.h, d = spr.d, s = new Img(w * k, h * k);
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 127;
    const ink = (x, y) => !on(x, y) || d[(y * w + x) * 4] + d[(y * w + x) * 4 + 1] + d[(y * w + x) * 4 + 2] < 80;
    const RIM = C(hot || "#ffc070"), EDGE = mix(RIM, "#000000", 0.62), MOON = C("#7e92d2"), warm = hot ? [0.86, 1.02, 0.74] : [1.12, 0.9, 0.7];
    for (let y = 0; y < h; y++) for (let u = 0; u < w; u++) {
      if (!on(u, y)) continue;
      const o = (y * w + u) * 4, src = [d[o], d[o + 1], d[o + 2]];
      let c;
      if (src[0] + src[1] + src[2] < 80) c = !on(u + 1, y) ? mix(src, EDGE, 0.7) : src;
      else {
        const lift = 0.62 + (u / w) * 0.4;
        c = [src[0] * lift * warm[0], src[1] * lift * warm[1], src[2] * lift * warm[2]];
        if (ink(u + 1, y)) c = mix(c, RIM, 0.55);
        else if (ink(u + 2, y)) c = mix(c, RIM, 0.2);
        else if (ink(u - 1, y)) c = mix(c, MOON, 0.24);
      }
      const x = faceRight ? u : w - 1 - u;
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s.px(x * k + i, y * k + j, c);
    }
    return s;
  }
  // the same, tipped backwards about the seat (pivot, default the feet) by a radians: nearest-neighbour, so it stays pixel art
  function tipped(im, a, faceRight, pivot) {
    const n = Math.ceil(Math.hypot(im.w, im.h)) + 2, out = new Img(n * 2, n * 2), ca = Math.cos(a), sa = Math.sin(a) * (faceRight ? -1 : 1);
    const [px, py] = pivot || [im.w / 2, im.h], ox = n, oy = n;
    for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
      const dx = x - ox, dy = y - oy, sx = Math.round(ca * dx + sa * dy + px), sy = Math.round(-sa * dx + ca * dy + py);
      if (sx < 0 || sy < 0 || sx >= im.w || sy >= im.h) continue;
      const o = (sy * im.w + sx) * 4;
      if (im.d[o + 3]) out.px(x, y, [im.d[o], im.d[o + 1], im.d[o + 2]]);
    }
    out.pivot = [ox, oy];
    return out;
  }

  // ---------- the haul: what came back from the fight, laid out with the cook's field notes ----------
  // league/content/food.py TIPS is the source and the record carries its notes; these only cover the sides of an old record
  const SIDE_TIP = { butter: "butter: all of it", moonpetal: "moonpetal: last. it wilts", salt: "salt: (checked twice)", scale: "scale: NOT food", garlic: "garlic: a whole head", roots: "roots: scrubbed, mostly", herbs: "herbs: whatever turned up",
    kelp: "kelp: under everything", lid: "lid: it rattles. that's fine", fat: "fat: for the drips", leaves: "leaves: wrap it twice", clay: "clay: thick as a thumb", knife: "knife: sharp. go slow", berries: "berries: count them first" };
  // a camp supper without monster parts: what it's made from, read off the first note's subject
  const SUPPLY = [["ration", "ration"], ["herb", "herbs"], ["fish", "fish"], ["hedge", "forage"], ["egg", "forage"], ["forage", "forage"]];
  function suppliesOf(r) {
    const subj = String((r.notes || [])[0] || "").split(":")[0].toLowerCase();
    const hit = SUPPLY.find(([k]) => subj.includes(k));
    return hit ? hit[1] : "forage";
  }
  // which laid-out thing a note is about: its subject before the colon names it ("dock leaves: ..." is the leaves)
  const ALIAS = { leaves: ["leaf", "leaves", "dock"], roots: ["root"], herbs: ["herb"], berries: ["berr"], knife: ["knife", "blade"], fat: ["fat", "dripping"], kelp: ["kelp", "weed"], lid: ["lid"], clay: ["clay"], salt: ["salt"], butter: ["butter"], moonpetal: ["moonpetal", "petal"], garlic: ["garlic"], scale: ["scale"] };
  function itemFor(note, items, fallback) {
    const subj = String(note).split(":")[0].toLowerCase();
    const side = items.find((it) => !it.main && (ALIAS[it.id] || [it.id]).some((a) => subj.includes(a)));
    return fallback || side || items.find((it) => it.main) || items[0];
  }
  function notesOf(r) {
    const mate = ((r.eaters || []).find((e) => e.id !== r.cook) || r.eaters[0] || {}).name || "somebody";
    return (r.notes || []).slice(0, 3).map((n) => String(n).replace(/\{mate\}/g, mate));
  }
  function haulBase(r, ctx) {
    const img = new Img(W, H, "#0a0705"), dark = r.place.kind === "dungeon";
    const cloth = dark ? K.R(["#0c0e12", "#151820", "#1e222c", "#2a303c", "#3a4250"]) : K.R(["#140c08", "#21140c", "#301e12", "#43291a", "#583824", "#704a30"]);
    img.fill((x, y) => {
      const wv = Math.sin(x * 0.07 + fbm(x / 30, y / 20, 5) * 4) * 0.08, n = fbm(x / 14, y / 9, 6);
      const d = Math.hypot((x - 150) / 190, (y - 150) / 120);
      return pick(cloth, 0.15 + (1 - d) * 0.55 + wv + (n - 0.5) * 0.3, x, y);
    });
    if (!dark) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x + y * 2) % 23 === 0 && fbm(x / 6, y / 6, 77) > 0.6) img.px(x, y, "#5a3a22", 0.4);
    const lay = ctx.haul.layout, pr = rng(r.seed + 7);
    for (let i = 0; i < 46; i++) { const x = 20 + pr() * 200, y = 60 + pr() * 86, k = pr(); img.px(x, y, k < 0.4 ? "#f4eee4" : k < 0.7 ? "#140806" : "#d8cfc0"); if (k < 0.4) img.px(x, y + 1, "#3a2414", 0.6); }
    for (let i = 0; i < 5; i++) { const x = 30 + pr() * 180, y = 70 + pr() * 70; for (let j = 0; j < 4; j++) img.px(x + j, y - j * 0.4, j < 2 ? "#3a5a24" : "#5a8a34"); }
    for (let j = 0; j < 40; j++) img.px(150 + j * 2.2, 140 + Math.sin(j * 0.4) * 3, j % 3 ? "#a88a5a" : "#7a6040");
    for (const it of lay) FA.part(it.id, img, it.x, it.y, it.s, r.seed + it.i, ctx.spec);
    K.light(img, 250, 170, 220, "#ff8a3a", 0.32, 150);
    K.vignette(img, 0.55);
    return img;
  }
  function haulLayout(r, ctx) {
    const parts = (r.parts && r.parts.length ? r.parts : ctx.spec.parts && ctx.spec.parts.length ? ctx.spec.parts : [suppliesOf(r)]).slice(0, 3);
    const sides = (ctx.spec.sides || []).filter((s) => !parts.includes(s)).slice(0, Math.max(1, 4 - parts.length));
    const slots = parts.length === 1 ? [[112, 92, 1]] : parts.length === 2 ? [[76, 96, 0.8], [168, 104, 0.72]] : [[64, 92, 0.66], [150, 84, 0.62], [116, 126, 0.56]];
    const sideSlots = parts.length === 1 ? [[206, 88], [200, 128], [30, 122], [34, 80]] : [[214, 70], [216, 128], [28, 128], [70, 138]];
    const out = parts.map((id, i) => ({ id, i, x: slots[i][0], y: slots[i][1], s: slots[i][2], main: true }));
    sides.forEach((id, i) => out.push({ id, i: i + 5, x: sideSlots[i][0], y: sideSlots[i][1], s: 1.5 }));
    const notes = notesOf(r).map((n) => n);
    const extra = out.filter((it) => !it.main).map((it) => SIDE_TIP[it.id]).filter(Boolean);
    while (notes.length < Math.min(3, out.length) && extra.length) notes.push(extra.shift());
    const n = Math.min(3, notes.length);
    const boxes = out.map((it) => (it.main ? [it.x - 52 * it.s, it.y - 26 * it.s, it.x + 52 * it.s, it.y + 22 * it.s] : [it.x - 18, it.y - 16, it.x + 18, it.y + 12]));
    const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    const tags = [];
    const cross = (a, b, c, d) => { const o = (p, q, r2) => Math.sign((q[0] - p[0]) * (r2[1] - p[1]) - (q[1] - p[1]) * (r2[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
    notes.slice(0, n).forEach((s, i) => {
      const it = itemFor(s, out, i < parts.length ? out[i] : null);
      const tx = it.x + (it.main ? -8 : 0), ty = it.main ? it.y - 18 * it.s : it.y - 6;
      let best = null;
      for (const ww of [130, 112, 96, 80, 66]) {
        const lines = wrap(s, ww), w = Math.max(...lines.map((l) => textWidth(l))) + 8, h = lines.length * 9 + 5;
        const ragged = lines.some((l, k) => k < lines.length - 1 && textWidth(l) < (w - 8) * 0.45) || textWidth(lines[lines.length - 1]) < 14 ? 40 : 0;
        for (let cy = 4; cy <= H - 4 - h; cy += 6) for (let cx = 4; cx <= W - 4 - w; cx += 6) {
          const bx = [cx - 2, cy - 2, cx + w + 3, cy + h + 3];
          if (boxes.some((b, k) => out[k].main && hit(bx, b)) || tags.some((tg) => hit(bx, [tg.x - 3, tg.y - 3, tg.x + tg.w + 4, tg.y + tg.h + 4])) || hit(bx, boxes[out.indexOf(it)])) continue;
          const over = boxes.filter((b, k) => !out[k].main && hit(bx, b)).length * 70;
          const ax = clamp(tx, cx, cx + w), ay = ty < cy ? cy : cy + h;
          if (tags.some((tg) => cross([ax, ay], [tx, ty], [clamp(tg.tx, tg.x, tg.x + tg.w), tg.ty < tg.y ? tg.y : tg.y + tg.h], [tg.tx, tg.ty]))) continue;
          if (tags.some((tg) => { for (let q = 0.05; q < 1; q += 0.05) { const px = lerp(ax, tx, q), py = lerp(ay, ty, q); if (px > tg.x - 1 && px < tg.x + tg.w + 1 && py > tg.y - 1 && py < tg.y + tg.h + 1) return true; } return false; })) continue;
          const score = Math.hypot(ax - tx, ay - ty) + lines.length * 12 + ragged + over + (cy + h > ty + 30 && it.main ? 30 : 0);
          if (!best || score < best.score) best = { score, lines, x: cx, y: cy, w, h, tx, ty };
        }
      }
      if (best) tags.push(best);
    });
    return { layout: out, tags };
  }

  // ---------- what flies about in a hot pan ----------
  function spits(img, cx, cy, rx, ry, t, seed, n, hot) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, ph = r(), per = 0.5 + r() * 0.6, u = ((t / per) + ph) % 1, h = (6 + r() * 18) * (hot || 1), dx = (r() < 0.5 ? -1 : 1) * (2 + r() * 9);
      const x0 = cx + Math.cos(a) * rx, y0 = cy + 4 + Math.sin(a) * ry;
      const x = x0 + dx * u, y = y0 - h * Math.sin(u * Math.PI);
      img.px(x, y, u < 0.3 ? "#fff6c8" : u < 0.7 ? "#ffc050" : "#e07a28", 1 - u * 0.4);
      if (u < 0.5) img.px(x - dx * 0.04, y + 1, "#ffc050", 0.6);
    }
  }
  function froth(img, cx, cy, rx, ry, t, seed, n, cols, from, to) {
    const r = rng(seed), cs = cols.map(C);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, rr = lerp(from || 1.0, to || 1.2, r()), per = 0.25 + r() * 0.5, u = ((t / per) + r()) % 1;
      if (u > 0.75) continue;
      const x = cx + Math.cos(a) * rx * rr, y = cy + 4 + Math.sin(a) * ry * rr;
      if (y < cy - ry * 0.2 && rr < 1.1) continue;
      const c = cs[Math.floor(r() * cs.length)];
      img.px(x, y, c);
      if (u < 0.35) img.px(x - 1, y - 1, "#fff8e0", 0.8);
      else img.px(x, y + 1, "#2a1408", 0.8);
    }
  }
  function smokePuffs(img, cx, cy, t, seed, n, col, spread, rise) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const ph = r(), u = ((t * 0.35) + ph) % 1, x = cx + (r() - 0.5) * (spread || 40) + Math.sin(u * 5 + i) * 6, y = cy - u * (rise || 60), rad = 6 + u * 16;
      glow(img, x, y, rad, col, 0.75 * (1 - u) * Math.min(1, u * 5), rad * 0.8, 5);
    }
  }
  // a piece of food painted once into its own layer, at a stage, so it can drop, squash and flip
  function pieceLayer(ctx, key, fn) {
    if (!ctx.cache.has(key)) { const im = new Img(W, H); fn(im); ctx.cache.set(key, im); }
    return ctx.cache.get(key);
  }
  function bounds(im) {
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (im.d[(y * im.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  // draw a layer squashed vertically about its own middle (a flip, a landing)
  function squash(img, lay, sy, dy, sx) {
    const b = lay.bb || (lay.bb = bounds(lay));
    sx = sx || 1;
    const hh = Math.max(1, Math.round(b.h * Math.abs(sy))), ww = Math.round(b.w * sx);
    for (let j = 0; j < hh; j++) {
      const v = b.y0 + Math.min(b.h - 1, Math.floor((sy < 0 ? hh - 1 - j : j) / Math.abs(sy)));
      const ty = Math.round(b.cy - hh / 2 + j + (dy || 0));
      if (ty < 0 || ty >= H) continue;
      for (let i = 0; i < ww; i++) {
        const u = b.x0 + Math.min(b.w - 1, Math.floor(i / sx)), o = (v * W + u) * 4;
        if (!lay.d[o + 3]) continue;
        img.px(Math.round(b.cx - ww / 2 + i), ty, [lay.d[o], lay.d[o + 1], lay.d[o + 2]], lay.d[o + 3] / 255);
      }
    }
  }
  // the camp fire seen wide with the cookware on it: what's static, cached
  function fireScene(r, ctx, vessel) {
    return pieceLayer(ctx, "wide:" + vessel, (im) => {
      const base = campWide(r, { horizon: 66 });
      im.paste(base, 0, 0);
      ctx.wideMask = mask(120, 118, 160, 80, 1.5);
      lit(im, ctx.wideMask, "#ff7a2a", 0.55);
      stones(im, 120, 120, 40, 16, r.seed + 3);
      logs(im, 120, 122);
      campProps(im, r);
    });
  }

  // a pack and a rolled blanket off to one side, a dented kettle on the other; lit from the fire's side
  function campProps(im, r) {
    const pk = K.ell(30, 118, 13, 15), tone = (x, y, ramp, i) => pick(K.R(ramp), 0.1 + i.diff * 0.45 + i.fire * 0.35 + (x > 30 ? 0.15 : 0), x, y);
    K.hrender(im, [16, 102, 44, 134], (x, y) => { const d = pk(x, y); return d > 1 ? null : Math.sqrt(1 - d * d) * 10; }, (x, y, i) => (Math.abs(y - 114) < 1 ? "#2a1a0c" : tone(x, y, ["#1a120a", "#2e2012", "#4a321c", "#6a4a2a", "#8e6a3e"], i)));
    for (let y = 104; y < 133; y++) im.px(41, y, "#2a1a0c");
    const roll = K.ell(48, 132, 16, 6);
    K.hrender(im, [30, 124, 66, 140], (x, y) => { const d = roll(x, y); return d > 1 ? null : Math.sqrt(1 - d * d) * 6; }, (x, y, i) => (x % 6 === 0 ? "#141a10" : tone(x, y, ["#10140e", "#1c241a", "#2c3828", "#42503a", "#5e6c50"], i)));
    const kt = K.ell(206, 116, 9, 8);
    K.hrender(im, [196, 106, 216, 126], (x, y) => { const d = kt(x, y); return d > 1 ? null : Math.sqrt(1 - d * d) * 8; }, (x, y, i) => (i.spec > 0.6 ? "#c8b8a8" : tone(x, y, ["#0e0e10", "#1c1c20", "#2e2e34", "#46464e", "#6a6670"], i)));
    for (let k = 0; k < 7; k++) { im.px(199 + k * 2, 106 - Math.sin((k / 6) * Math.PI) * 5, "#3a3a40"); }
    im.rect(213, 112, 6, 2, "#2e2e34");
    outline(im, "#000000", 300);
  }

  const METHOD = {};
  // parts that hop in on their own along an arc, one after another
  function hops(img, list, t, t0, gap, to, spec, seed) {
    list.forEach((id, i) => {
      const a = t0 + i * gap, u = seg(t, a, a + 0.5);
      if (t < a || u >= 1) return;
      const from = i % 2 ? [226, 136] : [14, 136], x = lerp(from[0], to[0] + (i % 3 - 1) * 8, u), y = lerp(from[1], to[1], u) - Math.sin(u * Math.PI) * 40;
      FA.part(id, img, x, y, 0.55, seed + i, spec);
    });
  }
  function splash(img, x, y, u, col) {
    if (u < 0 || u > 1) return;
    for (let k = 0; k < 9; k++) { const a = Math.PI * (1.1 + (k / 8) * 0.8), d = u * 16, h = Math.sin(u * Math.PI) * 10; img.px(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5 - h, col || "#e8d8b8", 1 - u); }
  }
  function bubblesIn(img, f, t, seed, n, col, size) {
    const r = rng(seed), cs = C(col || "#f0d8a0");
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.85, x = f.cx + Math.cos(a) * f.rx * d, y = f.cy + Math.sin(a) * f.ry * d, per = 0.6 + r() * 0.9, u = ((t / per) + r()) % 1, rad = (size || 2.2) * Math.sin(u * Math.PI) + 0.5;
      if (u > 0.92) { for (let k = 0; k < 4; k++) img.px(x + Math.cos(k * 1.6) * 3, y + Math.sin(k * 1.6) * 1.5 - 1, cs, 0.7); continue; }
      for (let yy = -rad; yy <= rad; yy++) for (let xx = -rad; xx <= rad; xx++) { const d2 = Math.hypot(xx, yy / 0.7); if (d2 <= rad) img.px(x + xx, y + yy, d2 > rad - 1 ? cs : mix(cs, "#ffffff", 0.2), d2 > rad - 1 ? 0.9 : 0.25); }
      img.px(x - rad * 0.4, y - rad * 0.5, "#ffffff", 0.9);
    }
  }
  function shimmer(img, y0, y1, t, amp) {
    const d = img.d, row = new Uint8ClampedArray(W * 4);
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
      const sh = Math.round(Math.sin(y * 0.45 + t * 9) * (amp || 1) * ((y - y0) / Math.max(1, y1 - y0)));
      if (!sh) continue;
      row.set(d.subarray(y * W * 4, (y + 1) * W * 4));
      for (let x = 0; x < W; x++) { const sx = clamp(x - sh, 0, W - 1); for (let k = 0; k < 4; k++) d[(y * W + x) * 4 + k] = row[sx * 4 + k]; }
    }
  }
  const OIL = ["#ffd070", "#c88a3a", "#fff0c0"];
  // the wide shot's furniture: a tripod and its cauldron, a steamer stack, the spit rig, a board by the fire
  function tripod(im, cx) {
    for (const [x0, y0] of [[cx - 52, 132], [cx + 50, 132], [cx + 10, 138]]) for (let k = 0; k <= 60; k++) { const t = k / 60, x = lerp(x0, cx, t), y = lerp(y0, 28, t); im.px(x, y, "#2a1a0e"); im.px(x + 1, y, t > 0.9 ? "#1a1008" : "#4a3018"); }
    for (let y = 28; y < 70; y += 2) { im.px(cx, y, "#4a4a52"); im.px(cx, y + 1, "#26262c"); }
  }
  function wideVessel(r, ctx, kind) {
    return pieceLayer(ctx, "vessel:" + kind, (im) => {
      if (kind === "pot") { tripod(im, 120); ctx.potF = FA.cauldron(im, 120, 82, 40, 13, 28); }
      else if (kind === "steam") { ctx.potF = FA.bowl(im, 120, 92, 40, 12, 18, "iron"); FA.basketSide(im, 120, 78, 34, 10, 18, false); }
      else if (kind === "spit") { for (const x of [44, 196]) { const s2 = x < 120 ? 1 : -1; FA.stickDraw(im, x, 132, x + 4 * s2, 62, 3); FA.stickDraw(im, x + 4 * s2, 64, x - 2 * s2, 54, 2); FA.stickDraw(im, x + 4 * s2, 64, x + 10 * s2, 56, 2); } FA.stickDraw(im, 34, 64, 206, 64, 2); }
      else if (kind === "cold") { B.board(im, 112, 116, 84, 22, 4); }
    });
  }
  function fireScene2(r, ctx, kind) {
    return pieceLayer(ctx, "wide2:" + kind, (im) => {
      const base = campWide(r, { horizon: 66 });
      im.paste(base, 0, 0);
      const fx = kind === "cold" ? 196 : 120;
      ctx.wideMask = mask(fx, 118, 160, 80, 1.5);
      lit(im, ctx.wideMask, "#ff7a2a", 0.55);
      stones(im, fx, 120, kind === "cold" ? 26 : 40, 16, r.seed + 3);
      logs(im, fx, 122);
      if (kind !== "cold") campProps(im, r);
    });
  }
  function wideFire(img, t, ctx, kind) {
    const fx = kind === "cold" ? 196 : 120, fl = flick(t, 2);
    lit(img, ctx.wideMask, "#ff8a3a", (fl - 0.8) * 1.4);
    flame(img, fx, 122, kind === "cold" ? 18 : 26, kind === "cold" ? 34 : 38, t, 4);
    embers(img, fx, 104, 10, t, 5, 50, 80);
  }
  // the parcel buried in the coals: a lidded pot for pies, breads and sweets, leaves for fish and greens, clay for roots
  const PARCEL = { pie: "oven", sweet: "oven", bun: "oven", fillet: "leaves", salad: "leaves", roast: "clay", stew: "oven" };
  function parcel(img, kind, cx, cy, s, t, burnt, opening) {
    const lay = new Img(W, H);
    if (kind === "oven") {
      FA.bowl(lay, cx, cy, 46 * s, 16 * s, 22 * s, "iron");
      FA.lidDraw(lay, cx, cy - 2 - (opening || 0) * 70, 48 * s, 16 * s, 0, false);
    } else if (kind === "leaves") {
      const op = opening || 0;
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + 0.3, x = cx + Math.cos(a) * (8 + op * 40) * s, y = cy + Math.sin(a) * (4 + op * 14) * s; FA.leafDraw(lay, x, y, 30 * s, 12 * s, a, burnt ? 1 : 0); }
    } else {
      FA.scene(lay, [FA.blob(cx, cy, 40 * s, 18 * s, 18 * s, (x, y, i) => (h2(x, y, 3) > 0.93 ? "#2a160c" : pick(K.R(["#2a160c", "#4a2a18", "#6e4228", "#94603c", "#b88256"]), 0.15 + i.diff * 0.8 - (burnt ? 0.4 : 0), x, y)), { wob: [[3, 0.08, 1], [5, 0.06, 2]], k: 10 })]);
    }
    outline(lay, "#050302");
    img.paste(lay, 0, 0);
  }
  // a bed of coals: dark lumps with a few glowing seams that breathe, a dusting of white ash, a warm glow under it all
  function coalBed(img, y0, t, seed) {
    const r = rng(seed), lumps = [];
    for (let i = 0; i < 70; i++) lumps.push([r() * W, y0 + Math.pow(r(), 0.8) * (H - y0 + 6), 5 + r() * 8, r() * 6, r()]);
    lumps.sort((a, b) => a[1] - b[1]);
    glow(img, W / 2, H, W * 0.7, "#ff6a1a", 0.35, (H - y0) * 1.4);
    for (const [x, y, rad, ph, v] of lumps) {
      const g = 0.5 + 0.5 * Math.sin(t * (0.8 + v) + ph), ry = rad * 0.62;
      for (let yy = Math.floor(y - ry); yy <= y + ry; yy++) for (let xx = Math.floor(x - rad); xx <= x + rad; xx++) {
        const d = Math.hypot((xx + 0.5 - x) / rad, (yy + 0.5 - y) / ry);
        if (d > 1) continue;
        const n = fbm(xx / 3 + ph, yy / 2.2, 7), seam = Math.abs(n - 0.5) < 0.035 + g * 0.03 && d < 0.85, top = (y - yy) / ry;
        let c;
        if (seam) c = g > 0.6 && d < 0.5 ? "#ffd27a" : "#ff7a22";
        else if (top > 0.55 && n > 0.62) c = "#8a8278";
        else c = pick(K.R(["#060404", "#0e0806", "#1a0f0a", "#2a1a12", "#3e2a1e"]), 0.15 + top * 0.45 + (1 - d) * 0.2, xx, yy);
        if (!seam && d > 0.7 && top < -0.2) c = mix(c, "#ff6a1a", 0.35 * g);
        img.px(xx, yy, c);
      }
    }
  }
  function knife(img, x, y, ang) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let k = -30; k < 34; k++) for (let w = 0; w < (k < 0 ? 5 : 3); w++) {
      const px = x + ca * k - sa * w, py = y + sa * k + ca * w;
      if (k < 0) img.px(px, py, w === 0 ? "#e8eef4" : w === 4 ? "#5a626c" : k < -26 ? "#c8d0d8" : "#a8b2bc");
      else img.px(px, py, k % 9 === 0 ? "#c8a050" : w === 0 ? "#8a5a30" : "#5a3418");
    }
  }
  function ditherMix(img, a, b, v) {
    const n = W * H;
    for (let i = 0; i < n; i++) {
      const x = i % W, y = (i / W) | 0, src = bay(x, y) < v ? b : a, o = i * 4;
      if (src.d[o + 3]) img.px(x, y, [src.d[o], src.d[o + 1], src.d[o + 2]], src.d[o + 3] / 255);
    }
  }
  function sheen(img, L, t) {
    const sweep = ((t * 0.55) % 1) * 260 - 70;
    for (let y = 30; y < 135; y++) for (let x = Math.max(0, Math.floor(sweep - 8)); x < Math.min(W, sweep + 8); x++) {
      const xx = Math.floor(x - (y - 82) * 0.4);
      if (xx < 0 || xx >= W || !L.d[(y * W + xx) * 4 + 3]) continue;
      img.add(xx, y, [255, 210, 120], 0.2 * (1 - Math.abs(x - sweep) / 8));
    }
  }
  function saltFall(img, t, t0, seed) {
    const r = rng(seed + 77);
    for (let i = 0; i < 40; i++) { const x = 60 + r() * 120, sp = 40 + r() * 40, y = (t - t0 - r() * 0.8) * sp; if (y > 0 && y < 100) img.px(x + Math.sin(y * 0.2) * 2, y, "#ffffff"); }
  }
  function greaseFire(img, t, r) {
    flame(img, 40, 112, 20, 58 + 8 * Math.sin(t * 3), t, 11, { tint: "#7ad04a" });
    flame(img, 202, 114, 18, 50, t + 1, 12, { tint: "#7ad04a" });
    flame(img, 150, 64, 10, 26, t + 2, 13, { tint: "#9ae05a" });
    smokePuffs(img, 120, 70, t, r.seed + 1, 18, "#5a8a3a", 180, 90);
    smokePuffs(img, 120, 80, t + 1.3, r.seed + 2, 12, "#2a2a26", 140, 80);
    sfx(img, "...", 120, 44, t - 0.6, { k: 3, center: true, fill: () => "#e8e8d8" });
  }
  const partsOf = (r, spec, n) => (r.parts && r.parts.length ? r.parts : spec.parts || []).slice(0, n || 2);

  // iron: into a hot skillet, sizzle (a steak, a flatbread or the hash flips itself; fried things bubble in deep fat), then baste or finish
  METHOD.iron = (r, ctx) => {
    const spec = ctx.spec, P = FA.piece(spec), burnt = r.disaster, deep = spec.plate === "crisps", sweet = spec.plate === "sweet";
    const PAN = { cx: 120, cy: 100, rx: 128, ry: 50 }, AT = P.at || { cx: 120, cy: 82 };
    const lay = (stage) => pieceLayer(ctx, "piece:" + stage, (im) => P.draw(im, { cx: AT.cx, cy: AT.cy, s: 1.5, stage, seed: r.seed, f: { cx: 120, cy: 90, rx: 100, ry: 38 } }));
    const small = (stage) => pieceLayer(ctx, "small:" + stage, (im) => P.draw(im, { cx: 120, cy: 88, s: 0.62, stage, seed: r.seed, f: { cx: 120, cy: 92, rx: 46, ry: 12 } }));
    const oilC = deep ? K.R(["#3a1c06", "#5a300c", "#7a4614", "#9a601e", "#c08030"]) : null;
    const into = {
      id: "into", dur: 3.0,
      base: () => fireScene(r, ctx, "iron").copy(),
      draw: (img, t) => {
        const fl = flick(t, 2);
        lit(img, ctx.wideMask, "#ff8a3a", (fl - 0.8) * 1.4);
        flame(img, 120, 122, 30, 36, t, 4);
        img.paste(pieceLayer(ctx, "panwide", (im) => B.skilletWide(im, 120, 96, 62, 17, 0.9)), 0, 0);
        flame(img, 66, 120, 9, 20, t + 3, 8);
        flame(img, 174, 120, 9, 20, t + 5, 9);
        for (const [x, w, h, ph] of [[96, 7, 10, 1], [118, 9, 9, 2], [142, 7, 11, 3]]) flame(img, x, 126, w, h, t + ph, 20 + ph);
        embers(img, 120, 104, 10, t, 5, 70, 80);
        const sm = small("raw"), land = 0.85, fall = seg(t, 0.15, land);
        let shake;
        if (t < land) squash(img, sm, 1, -110 * (1 - easeIn(fall)));
        else {
          const u = t - land, sq = u < 0.14 ? 1 - 0.28 * Math.sin((u / 0.14) * Math.PI) : 1;
          squash(img, sm, sq, (1 - sq) * 10, 1 + (1 - sq) * 0.4);
          spits(img, 120, 90, 46, 12, u, r.seed + 1, Math.round(26 * Math.max(0.35, 1 - u)), 1.2);
          if (u < 0.12) shake = [0, 1];
          for (let i = 0; i < 4; i++) steam(img, 92 + i * 18, 84, 34, t * 1.3 + i * 1.7, 0.3 * Math.min(1, u * 2), 3, 2.5);
        }
        hops(img, spec.hop || ["garlic"], t, 1.5, 0.45, [120, 90], spec, r.seed);
        sfx(img, deep ? "FSSSHH!" : "TSSSS!", 160, 52, t - land, { k: 2, shake: 1, fade: 1.3 });
        return { shake };
      },
      sfx: [[0, "fire", 14], [0.85, "splat", 1], [1.6, "plop", 1], [2.05, "plop", 1]],
    };
    const sear = {
      id: "macro1", dur: 3.2,
      base: () => { const im = B.macroBack(0.6, 2); B.skillet(im, PAN.cx, PAN.cy, PAN.rx, PAN.ry, 0.8, deep ? { oil: oilC } : null); return im; },
      draw: (img, t) => {
        light(img, 120, 170, 170, "#ff6a1a", 0.18 + 0.05 * Math.sin(t * 7), 60);
        const flips = P.flip, flipAt = 1.55, flipDur = 0.42, u = seg(t, flipAt, flipAt + flipDur);
        let shake;
        if (deep || sweet || !flips) {
          ditherMix(img, lay("raw"), lay(burnt ? "burnt" : "cook"), seg(t, 0.3, 2.8));
          if (deep) bubblesIn(img, { cx: 120, cy: 92, rx: 104, ry: 38 }, t, r.seed, 70, "#ffe0a0", 2.4);
          else if (sweet) bubblesIn(img, { cx: 120, cy: 90, rx: 90, ry: 32 }, t, r.seed, 40, burnt ? "#5a5a3a" : "#ffd060", 2);
          else froth(img, AT.cx, AT.cy + 6, 84, 34, t, r.seed + 4, 120, OIL, 1.0, 1.12);
          spits(img, AT.cx, AT.cy + 4, 90, 32, t, r.seed + 2, 26, 1);
        } else if (t < flipAt) {
          froth(img, AT.cx, AT.cy + 6, 80, 33, t, r.seed + 4, 140, OIL, 1.0, 1.12);
          squash(img, lay("sear"), 1, 0);
          spits(img, AT.cx, AT.cy + 4, 78, 30, t, r.seed + 2, 30, Math.min(1, 0.5 + t * 0.4));
        } else if (u < 1) {
          froth(img, AT.cx, AT.cy + 6, 80, 33, t, r.seed + 4, 140, OIL, 1.0, 1.12);
          const lift = Math.sin(u * Math.PI) * 26, sy = Math.cos(u * Math.PI);
          squash(img, lay(sy > 0 ? "sear" : burnt ? "burnt" : "cook"), Math.max(0.16, Math.abs(sy)), -lift);
        } else {
          froth(img, AT.cx, AT.cy + 6, 80, 33, t, r.seed + 4, 140, OIL, 1.0, 1.12);
          const v = t - flipAt - flipDur, sq = v < 0.12 ? 1 - 0.12 * Math.sin((v / 0.12) * Math.PI) : 1;
          squash(img, lay(burnt ? "burnt" : "cook"), sq, (1 - sq) * 18, 1 + (1 - sq) * 0.2);
          spits(img, AT.cx, AT.cy + 4, 78, 30, v + 0.2, r.seed + 3, v < 0.5 ? 60 : 34, 1.4);
          if (v < 0.1) shake = [1, 1];
        }
        if (burnt && t > 1.6) smokePuffs(img, AT.cx, AT.cy - 10, t, r.seed, 10, "#3a3a34", 120, 70);
        for (let i = 0; i < 5; i++) steam(img, 52 + i * 34, 62, 42, t * 1.5 + i * 2.1, 0.32, 4, 3);
        K.vignette(img, 0.35);
        sfx(img, deep ? "FSSSHH" : "TSSSS", 168, 30, t - 0.2, { k: 2, shake: 1, fade: 1.2 });
        if (flips && u >= 1) sfx(img, burnt ? "uh oh." : "FWSSH!", 22, 30, t - flipAt - flipDur, { k: 2, shake: burnt ? 0 : 1, fade: 1.0, fill: burnt ? () => "#e8e0d0" : null });
        return { shake };
      },
      sfx: [[0, "sizzle", 3.2]].concat(P.flip ? [[1.55, "flip", 1], [1.97, "splat", 1]] : []).concat(burnt ? [[2.2, "gasp", 1]] : []),
    };
    const finish = {
      id: "macro2", dur: 3.2,
      base: () => {
        const im = B.macroBack(0.9, 4);
        B.skillet(im, PAN.cx, PAN.cy, PAN.rx, PAN.ry, 1, deep ? { oil: oilC } : null);
        if (!burnt && !deep && !sweet) for (const [x, y, sd] of [[34, 116, 1], [208, 118, 2], [196, 126, 3]]) B.garlic(im, x, y, sd, 1.6);
        return im;
      },
      draw: (img, t) => {
        light(img, 120, 170, 170, "#ff6a1a", 0.22 + 0.05 * Math.sin(t * 7), 60);
        if (burnt) { squash(img, lay("burnt"), 1, 0); greaseFire(img, t, r); return; }
        if (deep) {
          squash(img, lay("cook"), 1, 0);
          bubblesIn(img, { cx: 120, cy: 92, rx: 104, ry: 38 }, t, r.seed + 3, 40, "#ffe0a0", 2);
          saltFall(img, t, 0.6, r.seed);
          sparkleAt(img, 96, 70, t, 1.8, 3); sparkleAt(img, 150, 82, t, 2.2, 2);
        } else if (spec.plate === "slab") {
          froth(img, AT.cx, AT.cy + 6, 80, 33, t, r.seed + 8, 220, ["#c8862a", "#f0c050", "#ffe890", "#fffae0"], 1.0, 1.32);
          squash(img, lay("baste"), 1, 0);
          sheen(img, lay("baste"), t);
          const melt = seg(t, 0.35, 2.6);
          if (t > 0.1) { const drop = seg(t, 0.1, 0.35); B.butter(img, 140, lerp(-10, 70, easeIn(drop)), melt * 0.85, 2, 1.6); }
          const mp = seg(t, 1.3, 2.0);
          if (mp > 0 && spec.garnish === "moonpetal") { B.moonpetal(img, lerp(80, 98, mp), lerp(-10, 60, ease3(mp)) + Math.sin(mp * 9) * 3 * (1 - mp), 2.3, 1, mp >= 1); sparkleAt(img, 100, 58, t, 2.0, 3); }
        } else {
          squash(img, lay("cook"), 1, 0);
          sheen(img, lay("cook"), t);
          if (sweet) bubblesIn(img, { cx: 120, cy: 90, rx: 90, ry: 32 }, t, r.seed, 24, "#ffe080", 1.6);
          else froth(img, AT.cx, AT.cy + 6, 84, 34, t, r.seed + 8, 160, ["#c8862a", "#f0c050", "#ffe890", "#fffae0"], 1.0, 1.25);
          sparkleAt(img, 100, 64, t, 1.6, 3);
        }
        for (let i = 0; i < 5; i++) steam(img, 50 + i * 35, 60, 46, t * 1.4 + i * 1.9, 0.4, 5, 3.5);
        K.vignette(img, 0.3);
        sfx(img, deep ? "crackle" : "fsshhh", 24, 30, t - 0.4, { k: 2, wave: true, fade: 1.6, fill: () => "#fff0c8" });
      },
      sfx: burnt ? [[0, "sizzle", 3.2], [0.4, "hiss", 1]] : [[0, "sizzle", 3.2], [0.35, "plop", 1], [1.95, "chime", 1]],
    };
    return [into, sear, finish];
  };

  // pot: everything hops into the cauldron, a sear in the fat, then the long simmer
  METHOD.pot = (r, ctx) => {
    const spec = ctx.spec, P = FA.piece(spec), burnt = r.disaster;
    const F = { cx: 120, cy: 92, rx: 116, ry: 48 };
    const lay = (stage) => pieceLayer(ctx, "pot:" + stage, (im) => P.draw(im, { cx: F.cx, cy: F.cy, s: 1.6, stage, seed: r.seed, f: F }));
    const rimBase = (heat) => { const im = B.macroBack(heat, 5); FA.cauldronRim(im, 120, 96, 140, 62); return im; };
    const into = {
      id: "into", dur: 3.2,
      base: () => fireScene2(r, ctx, "pot").copy(),
      draw: (img, t) => {
        wideFire(img, t, ctx, "pot");
        img.paste(wideVessel(r, ctx, "pot"), 0, 0);
        const f = ctx.potF, list = partsOf(r, spec).concat((spec.hop || ["roots", "herbs"]).slice(0, 2));
        img.paste(pieceLayer(ctx, "potbroth", (im) => FA.scene(im, [FA.liquid(f.cx, f.cy, f.rx, f.ry, 0, K.R(["#2a1606", "#46260c", "#643a16", "#845222", "#a46c34"]), { seed: 3, oil: 0.4 })])), 0, 0);
        hops(img, list, t, 0.25, 0.55, [f.cx, f.cy - 6], spec, r.seed);
        list.forEach((_, i) => splash(img, f.cx + (i % 3 - 1) * 8, f.cy - 2, (t - 0.25 - i * 0.55 - 0.5) / 0.4, "#e8c890"));
        bubblesIn(img, f, t, r.seed, 6, "#e0b878", 1.4);
        for (let i = 0; i < 3; i++) steam(img, f.cx - 16 + i * 16, f.cy - 6, 30, t * 1.3 + i * 1.7, 0.3, 3, 2.5);
        list.forEach((_, i) => sfx(img, "plip", f.cx + 30 + (i % 2) * 20, f.cy - 30 - i * 6, t - 0.75 - i * 0.55, { k: 1, fade: 0.4, fill: () => "#fff4dc" }));
      },
      sfx: [[0, "fire", 14], [0.75, "plop", 1], [1.3, "plop", 1], [1.85, "plop", 1], [2.4, "plop", 1]],
    };
    const sear = {
      id: "macro1", dur: 3.0,
      base: () => { const im = rimBase(0.6); im.paste(lay("sear"), 0, 0); return im; },
      draw: (img, t) => {
        light(img, 120, 170, 170, "#ff6a1a", 0.15 + 0.05 * Math.sin(t * 7), 60);
        spits(img, F.cx, F.cy, F.rx * 0.8, F.ry * 0.7, t, r.seed + 2, 28, 0.9);
        for (let i = 0; i < 4; i++) steam(img, 60 + i * 40, 70, 40, t * 1.5 + i * 2.1, 0.3, 4, 3);
        K.vignette(img, 0.4);
        sfx(img, spec.plate === "pilaf" ? "tik tik" : "TSSSS", 160, 28, t - 0.3, { k: 2, shake: 1, fade: 1.4 });
      },
      sfx: [[0, "sizzle", 3]],
    };
    const simmer = {
      id: "macro2", dur: 3.4,
      base: () => { const im = rimBase(0.8); im.paste(lay(burnt ? "burnt" : "cook"), 0, 0); return im; },
      draw: (img, t) => {
        light(img, 120, 170, 170, "#ff6a1a", 0.18 + 0.05 * Math.sin(t * 5), 60);
        const thick = spec.plate === "porridge" || spec.plate === "pilaf";
        bubblesIn(img, F, t * (thick ? 0.6 : 1), r.seed + 5, thick ? 10 : 26, burnt ? "#8ac85a" : thick ? "#f8ecd0" : "#f0c888", thick ? 3 : 2.6);
        if (burnt) { smokePuffs(img, 120, 70, t, r.seed + 1, 16, "#5a8a3a", 180, 80); sfx(img, "blorp.", 120, 40, t - 0.8, { k: 3, center: true, fill: () => "#b8e090" }); }
        else for (let i = 0; i < 6; i++) steam(img, 40 + i * 32, 66, 50, t * 1.2 + i * 1.7, 0.42, 5, 4);
        K.vignette(img, 0.35);
        if (!burnt) sfx(img, "blub", 24, 32, t - 0.5, { k: 2, wave: true, fade: 1.6, fill: () => "#ffe8b0" });
      },
      sfx: [[0, "simmer", 3.4]].concat(burnt ? [[0.8, "groan", 0]] : []),
    };
    return [into, sear, simmer];
  };

  // steam: a basket over the pot, the lid drops on by itself, rattles, then lifts in a cloud
  METHOD.steam = (r, ctx) => {
    const spec = ctx.spec, P = FA.piece(spec), burnt = r.disaster;
    const F = { cx: 120, cy: 90, rx: 100, ry: 40 };
    const lay = (stage) => pieceLayer(ctx, "steam:" + stage, (im) => P.draw(im, { cx: F.cx, cy: F.cy - 4, s: 1.4, stage, seed: r.seed, f: F }));
    const into = {
      id: "into", dur: 3.2,
      base: () => fireScene2(r, ctx, "steam").copy(),
      draw: (img, t) => {
        wideFire(img, t, ctx, "steam");
        img.paste(wideVessel(r, ctx, "steam"), 0, 0);
        hops(img, partsOf(r, spec).concat((spec.hop || ["kelp"]).slice(0, 1)), t, 0.2, 0.5, [120, 70], spec, r.seed);
        const lt = seg(t, 1.9, 2.3), ly = t < 1.9 ? -40 : lerp(-40, 66, easeIn(lt));
        if (t > 1.6) FA.lidDraw(img, 120, ly, 36, 11, 0, true);
        if (t > 2.3) { for (let i = 0; i < 3; i++) steam(img, 92 + i * 28, 64, 34, t * 1.5 + i, 0.4 * Math.min(1, (t - 2.3) * 3), 3, 3); sfx(img, "clack", 150, 46, t - 2.3, { k: 2, fade: 0.6 }); }
      },
      sfx: [[0, "fire", 14], [0.7, "plop", 1], [1.2, "plop", 1], [2.3, "clink", 1]],
    };
    const rattle = {
      id: "macro1", dur: 3.0,
      base: () => { const im = B.macroBack(0.5, 7); FA.bowl(im, 120, 128, 120, 26, 30, "iron"); return im; },
      draw: (img, t) => {
        const jig = Math.sin(t * 38) > 0.3 ? -1 : 0, hard = t > 1.5 ? -Math.abs(Math.round(Math.sin(t * 22) * 2)) : 0;
        FA.basketSide(img, 120, 92, 92, 26, 42, false);
        FA.lidDraw(img, 120, 84 + jig + hard, 96, 26, 0, true);
        for (let i = 0; i < 7; i++) steam(img, 30 + i * 30, 86 + jig, 60, t * 2 + i * 1.3, 0.45, 6, 4);
        K.vignette(img, 0.35);
        sfx(img, "rattle", 22, 30, t - 0.3, { k: 2, shake: 2, fade: 1.2 });
        sfx(img, "hssss", 150, 28, t - 1.4, { k: 2, wave: true, fade: 1.3, fill: () => "#f0f4ff" });
      },
      sfx: [[0.3, "clink", 1], [0.6, "clink", 1], [0.9, "clink", 1], [1.5, "hiss", 1], [2.2, "clink", 1]],
    };
    const lift = {
      id: "macro2", dur: 3.4,
      base: () => { const im = B.macroBack(0.6, 8); FA.basketTop(im, F.cx, F.cy, F.rx + 12, F.ry + 6); im.paste(lay(burnt ? "burnt" : "cook"), 0, 0); return im; },
      draw: (img, t) => {
        const u = seg(t, 0.2, 1.0);
        if (u < 1) FA.lidDraw(img, 120, lerp(88, -70, easeIn(u)), 118, 46, 0, true);
        const cloud = 1 - seg(t, 0.4, 2.4);
        if (cloud > 0) for (let i = 0; i < 26; i++) { const rr = rng(i + 3), x = 20 + rr() * 200, y = 40 + rr() * 80 - (1 - cloud) * 40, rad = 14 + rr() * 22; glow(img, x, y, rad, burnt ? "#8ab860" : "#f4f6ff", 0.75 * cloud, rad * 0.8, 5); }
        for (let i = 0; i < 4; i++) steam(img, 50 + i * 44, 70, 50, t * 1.3 + i * 1.9, 0.38, 5, 4);
        if (!burnt && t > 2) { sparkleAt(img, 90, 70, t, 2.0, 3); sparkleAt(img, 160, 80, t, 2.3, 2); }
        if (burnt) sfx(img, "...", 120, 44, t - 1.8, { k: 3, center: true, fill: () => "#e8e8d8" });
        K.vignette(img, 0.3);
      },
      sfx: [[0.2, "swish", 1], [0.3, "hiss", 1]].concat(burnt ? [[1.8, "groan", 0]] : [[2.0, "chime", 1]]),
    };
    return [into, rattle, lift];
  };

  // spit: the joint slides onto the spit by itself and turns, fat drips and flares
  METHOD.spit = (r, ctx) => {
    const spec = ctx.spec, P = FA.piece(spec), burnt = r.disaster, joint = spec.plate === "roast" && FA.rotJoint;
    const small = (stage) => pieceLayer(ctx, "spitsmall:" + stage, (im) => P.draw(im, { cx: 120, cy: 64, s: 0.55, stage, seed: r.seed }));
    const big = (stage) => pieceLayer(ctx, "spitbig:" + stage, (im) => P.draw(im, { cx: 120, cy: 70, s: 1.45, stage, seed: r.seed }));
    const into = {
      id: "into", dur: 3.0,
      base: () => fireScene2(r, ctx, "spit").copy(),
      draw: (img, t) => {
        wideFire(img, t, ctx, "spit");
        img.paste(wideVessel(r, ctx, "spit"), 0, 0);
        img.paste(small("raw"), lerp(-130, 0, ease3(seg(t, 0.2, 1.4))), 0);
        if (t > 1.4) sfx(img, "shunk", 150, 44, t - 1.4, { k: 2, fade: 0.8 });
        hops(img, spec.hop || ["salt", "herbs"], t, 1.7, 0.45, [120, 60], spec, r.seed);
      },
      sfx: [[0, "fire", 14], [0.3, "swish", 1], [1.4, "thud", 1], [1.9, "plop", 1]],
    };
    const coalsBase = (heat) => { const im = B.macroBack(heat, 9); coalBed(im, 112, 0, r.seed); return im; };
    const drips = (img, t, n) => {
      const rr = rng(r.seed + 11);
      for (let i = 0; i < n; i++) {
        const x = 50 + rr() * 140, per = 0.8 + rr() * 0.8, u = ((t / per) + rr()) % 1, y = 96 + u * 30;
        img.px(x, y, "#ffd890"); img.px(x, y - 1, "#f0b050", 0.7);
        if (u > 0.88) flame(img, x, 128, 6, 14 + rr() * 10, t + i, 30 + i, burnt ? { tint: "#7ad04a" } : null);
      }
    };
    const draw = (img, t, stage, v) => {
      if (joint) FA.rotJoint(img, spec, 120, 70, 94, 30, t * 1.6, stage, r.seed, v);
      else if (v !== undefined) ditherMix(img, big("raw"), big(stage), v);
      else { const L = big(stage); img.paste(L, 0, Math.round(Math.sin(t * 3))); sheen(img, L, t); }
      FA.stickDraw(img, -4, 69, W + 4, 69, 3);
    };
    const cook1 = {
      id: "macro1", dur: 3.0,
      base: () => coalsBase(0.6),
      draw: (img, t) => {
        coalBed(img, 112, t, r.seed);
        draw(img, t, burnt && t > 1.5 ? "burnt" : "cook", seg(t, 0.2, 2.8));
        drips(img, t, 8);
        shimmer(img, 98, 114, t, 1);
        K.vignette(img, 0.35);
        sfx(img, "sss...", 22, 30, t - 0.2, { k: 2, fade: 1.0, fill: () => "#fff0c8" });
        sfx(img, "FWOOMP", 140, 34, t - 1.7, { k: 2, shake: 1, fade: 0.9 });
      },
      sfx: [[0, "sizzle", 3], [1.7, "thud", 1]],
    };
    const cook2 = {
      id: "macro2", dur: 3.2,
      base: () => coalsBase(0.85),
      draw: (img, t) => {
        coalBed(img, 112, t + 3, r.seed);
        draw(img, t + 3, burnt ? "burnt" : "cook");
        drips(img, t + 3, 12);
        if (burnt) { flame(img, 90, 66, 24, 60, t, 14, { tint: "#7ad04a" }); flame(img, 150, 68, 20, 50, t + 1, 15, { tint: "#7ad04a" }); smokePuffs(img, 120, 40, t, r.seed, 14, "#2a2a26", 160, 60); sfx(img, "...", 120, 30, t - 0.8, { k: 3, center: true, fill: () => "#e8e8d8" }); }
        else { for (let i = 0; i < 5; i++) steam(img, 50 + i * 35, 50, 40, t * 1.4 + i * 1.9, 0.32, 4, 3); sparkleAt(img, 100, 56, t, 1.4, 3); sparkleAt(img, 160, 62, t, 2.1, 2); }
        shimmer(img, 98, 114, t, 1);
        K.vignette(img, 0.3);
      },
      sfx: [[0, "sizzle", 3.2]].concat(burnt ? [[0.8, "groan", 0]] : [[1.4, "chime", 1]]),
    };
    return [into, cook1, cook2];
  };

  // embers: wrapped (a lidded pot, leaves or clay) and buried in the coals, then raked out and opened in a puff of steam
  METHOD.embers = (r, ctx) => {
    const spec = ctx.spec, P = FA.piece(spec), burnt = r.disaster, kind = spec.parcel || PARCEL[spec.plate] || "oven";
    const F = { cx: 120, cy: 92, rx: 96, ry: 36 };
    const lay = (stage) => pieceLayer(ctx, "emb:" + stage, (im) => P.draw(im, { cx: F.cx, cy: F.cy, s: 1.3, stage, seed: r.seed, f: F }));
    const into = {
      id: "into", dur: 3.2,
      base: () => fireScene2(r, ctx, "embers").copy(),
      draw: (img, t) => {
        wideFire(img, t, ctx, "embers");
        const u = seg(t, 0.2, 1.1), x = lerp(-30, 120, ease3(u)), y = 114 - Math.abs(Math.sin(u * Math.PI * 2)) * 12 * (1 - u);
        parcel(img, kind, x, y, 0.5, t, false, 0);
        const rr = rng(r.seed + 2);
        for (let i = 0; i < 12; i++) { const a = 1.4 + i * 0.1, v = seg(t, a, a + 0.4); if (v <= 0) continue; const sx = 120 + (rr() - 0.5) * 120, ex = 120 + (rr() - 0.5) * 40, px = lerp(sx, ex, v), py = lerp(130, 104 + rr() * 10, v) - Math.sin(v * Math.PI) * 16; img.rect(px, py, 3, 2, "#ff8a2a"); img.px(px, py, "#ffd27a"); }
        if (t > 1.4) sfx(img, "tik tik tik", 150, 44, t - 1.4, { k: 1, fade: 1.2, fill: () => "#ffd27a" });
      },
      sfx: [[0, "fire", 14], [0.4, "thud", 1], [0.7, "thud", 1], [1.4, "scribble", 1], [1.9, "scribble", 1]],
    };
    const bake = {
      id: "macro1", dur: 3.0,
      base: () => B.macroBack(0.7, 10),
      draw: (img, t) => {
        coalBed(img, 96, t, r.seed);
        parcel(img, kind, 120, 96, 1.5, t, burnt && t > 1.5, 0);
        const rr = rng(r.seed + 4);
        for (let i = 0; i < 40; i++) { const x = 20 + rr() * 200, y = 104 + rr() * 40; img.rect(x, y, 4, 3, rr() < 0.5 ? "#3a1c10" : "#ff7a2a"); }
        shimmer(img, 20, 100, t, 1.3);
        for (let i = 0; i < 3; i++) steam(img, 80 + i * 40, 64, 40, t * 1.2 + i * 2, burnt ? 0.5 : 0.3, 4, 3, burnt ? "#3a3a34" : "#fff6ea");
        K.vignette(img, 0.4);
        sfx(img, "crackle", 22, 30, t - 0.3, { k: 2, shake: 1, fade: 1.3 });
      },
      sfx: [[0, "fire", 3]],
    };
    const open = {
      id: "macro2", dur: 3.4,
      base: () => { const im = B.macroBack(0.6, 11); if (kind === "leaves") FA.leafBed(im, F.cx, F.cy + 4, F.rx + 14, F.ry + 10); else if (kind === "oven") FA.bowl(im, F.cx, F.cy - 4, F.rx + 16, F.ry + 10, 24, "iron"); else FA.clayHalves(im, F.cx, F.cy, F.rx, F.ry); im.paste(lay(burnt ? "burnt" : "cook"), 0, 0); return im; },
      draw: (img, t) => {
        const u = seg(t, 0.25, 0.9);
        if (kind === "oven" && u < 1) FA.lidDraw(img, F.cx, lerp(F.cy - 6, -60, easeIn(u)), F.rx + 18, F.ry + 10, 0, false);
        if (kind === "clay" && u < 1) { const l2 = new Img(W, H); FA.scene(l2, [FA.blob(F.cx, F.cy, F.rx * (1 - u * 0.5), F.ry * (1 - u * 0.5), 20, (x, y, i) => pick(K.R(["#2a160c", "#4a2a18", "#6e4228", "#94603c", "#b88256"]), 0.15 + i.diff * 0.8, x, y), { k: 10 })]); img.paste(l2, 0, 0, 1 - u); }
        const cloud = 1 - seg(t, 0.5, 2.3);
        if (cloud > 0) for (let i = 0; i < 20; i++) { const rr = rng(i + 9), x = 30 + rr() * 180, y = 50 + rr() * 60 - (1 - cloud) * 30, rad = 12 + rr() * 20; glow(img, x, y, rad, burnt ? "#3a3a34" : "#fff4ea", 0.7 * cloud, rad * 0.8, 5); }
        for (let i = 0; i < 4; i++) steam(img, 60 + i * 40, 70, 46, t * 1.3 + i * 1.6, 0.36, 5, 4, burnt ? "#5a5a50" : "#fff6ea");
        sfx(img, kind === "clay" ? "CRACK!" : kind === "oven" ? "clank" : "fwump", 22, 30, t - 0.3, { k: 2, shake: 1, fade: 1.0 });
        if (burnt) sfx(img, "...", 120, 44, t - 1.8, { k: 3, center: true, fill: () => "#e8e8d8" });
        else { sparkleAt(img, 92, 70, t, 2.1, 3); sparkleAt(img, 154, 84, t, 2.4, 2); }
        K.vignette(img, 0.3);
      },
      sfx: [[0.3, kind === "clay" ? "crunch" : "clink", 1], [0.45, "hiss", 1]].concat(burnt ? [[1.8, "groan", 0]] : [[2.1, "chime", 1]]),
    };
    return [into, bake, open];
  };

  // cold: nothing on the fire; the knife chops by itself, things are poured, layered and set, lit by the camp fire to one side
  METHOD.cold = (r, ctx) => {
    const spec = ctx.spec, P = FA.piece(spec), spoiled = r.disaster, wobbly = spec.plate === "jelly";
    const F = { cx: 120, cy: 90, rx: 92, ry: 34 };
    const lay = (stage) => pieceLayer(ctx, "cold:" + stage, (im) => P.draw(im, { cx: F.cx, cy: F.cy, s: 1.3, stage, seed: r.seed, f: F }));
    const into = {
      id: "into", dur: 3.0,
      base: () => fireScene2(r, ctx, "cold").copy(),
      draw: (img, t) => {
        wideFire(img, t, ctx, "cold");
        img.paste(wideVessel(r, ctx, "cold"), 0, 0);
        const list = partsOf(r, spec).concat((spec.hop || ["berries"]).slice(0, 2));
        hops(img, list, t, 0.2, 0.5, [112, 108], spec, r.seed);
        knife(img, 60, 120, -0.1);
        list.forEach((_, i) => sfx(img, "tok", 140 + (i % 2) * 20, 70 - i * 6, t - 0.7 - i * 0.5, { k: 1, fade: 0.4, fill: () => "#fff4dc" }));
      },
      sfx: [[0, "fire", 14], [0.7, "thud", 0.6], [1.2, "thud", 0.6], [1.7, "thud", 0.6], [2.2, "thud", 0.6]],
    };
    // what "prep" means depends on the dish: a jelly is poured into its mould, an ice is shaved, a trifle is layered, the rest is chopped
    const prepKind = spec.plate === "jelly" ? "pour" : spec.plate === "ice" ? "shave" : spec.plate === "sweet" ? "layer" : "chop";
    const prep = {
      id: "macro1", dur: 3.0,
      base: () => { const im = FA.tableBack(r.seed); light(im, 260, 120, 200, "#ff8a3a", 0.25, 120); if (prepKind === "chop") { B.board(im, 120, 100, 124, 46, 5); im.paste(lay("raw"), 0, 0); } else if (prepKind === "layer") FA.platter(im, 120, 112, 90, 26, "pewter", { rim: true }); else FA.platter(im, 120, 110, 100, 34, "pewter", { rim: true }); return im; },
      draw: (img, t) => {
        if (prepKind === "chop") {
          const chops = 6, k = Math.floor(t / 0.4), u = (t % 0.4) / 0.4, x = 70 + (k % chops) * 20, up = u < 0.5 ? -u * 2 * 30 : -(1 - u) * 2 * 30;
          for (let i = 0; i < Math.min(k, chops); i++) img.line(70 + i * 20, 70, 66 + i * 20, 112, "#1a0e08", 0.7);
          if (k < chops + 1) knife(img, x - 30, 70 + up, -0.12);
          sfx(img, "chk chk", 130, 30, t - 0.3, { k: 2, shake: 1, fade: 2.2 });
        } else if (prepKind === "pour") {
          const fill = seg(t, 0.4, 2.6), jx = 60, jy = 30;
          const lv = Math.round(fill * 34);
          for (let y = 0; y < lv; y++) { const yy = 110 - y, w = 40 - y * 0.3; for (let x = -w; x <= w; x++) img.px(120 + x, yy, x < -w + 2 ? "#d8fae0" : pick(K.R(["#14482a", "#226a3e", "#36905a", "#58b878", "#90dca0"]), 0.4 + (x / w) * -0.2 + (y === lv - 1 ? 0.4 : 0), 120 + x, yy)); }
          for (let x = -42; x <= 42; x++) { img.px(120 + x, 111, "#5a6068"); img.px(120 + x, 110 - 36, "#8a9098", 0.5); }
          for (let y = 74; y < 111; y++) { img.px(78 + (110 - y) * 0.06, y, "#9aa0a8", 0.7); img.px(162 - (110 - y) * 0.06, y, "#9aa0a8", 0.7); }
          FA.part("slime_jelly", img, jx, jy, 1.6, 2, spec);
          if (t > 0.4 && t < 2.6) for (let y = jy + 10; y < 110 - lv; y++) img.px(jx + 14 + (y - jy) * 0.9 * 0.5 + Math.sin(y * 0.5 + t * 20) * 0.6, y, "#58b878");
          sfx(img, "glug glug", 112, 30, t - 0.4, { k: 2, wave: true, fade: 2.0, fill: () => "#b8f0c8" });
        } else if (prepKind === "shave") {
          FA.part("glacier_ice", img, 120, 46, 2.0, 2, spec);
          const k = Math.floor(t / 0.3), u = (t % 0.3) / 0.3;
          knife(img, 88 + u * 60, 70 - u * 4, -0.05);
          const rr = rng(r.seed + 7), drift = Math.min(1, t / 2.6);
          for (let i = 0; i < 160; i++) { const x = 70 + rr() * 100, sp = 30 + rr() * 40, y = 74 + ((t * sp + rr() * 60) % 40); img.px(x + Math.sin(y * 0.3 + i) * 2, y, rr() < 0.5 ? "#ffffff" : "#d4ecf8"); }
          FA.scene(img, [FA.blob(120, 108, 40 * drift + 4, 14 * drift + 2, 14 * drift + 1, (x, y, i) => pick(K.R(["#a8bccc", "#cedce6", "#e8f0f6", "#ffffff"]), 0.3 + i.diff * 0.7, x, y), { rough: 3, scale: 2, seed: 3, k: 14 })]);
          sfx(img, "shhk shhk", 112, 30, t - 0.2, { k: 2, fade: 2.4, fill: () => "#e8f6ff" });
        } else {
          const bands = [["#c47e34", "#e0a454"], ["#9a1e2a", "#c8303a"], ["#e8b432", "#f8d050"], ["#c47e34", "#e0a454"], ["#efe0c0", "#fff8ea"]];
          for (let x = 70; x <= 170; x++) { img.px(x, 112, "#a8c0cc"); }
          for (let y = 52; y < 112; y++) { img.px(70 + (112 - y) * 0.15, y, "#c8dce6", 0.6); img.px(170 - (112 - y) * 0.15, y, "#c8dce6", 0.6); }
          bands.forEach(([a, b], k) => { const t0 = 0.3 + k * 0.5, u = seg(t, t0, t0 + 0.35); if (u <= 0) return; const yb = 111 - k * 11, yt = yb - 10, drop = (1 - u) * -60; for (let y = yt; y <= yb; y++) { const w = 48 - (111 - y) * 0.15; for (let x = -w; x <= w; x++) img.px(120 + x, y + drop, (y - yt) < 2 ? b : a); } if (u < 1) sfx(img, "plap", 176, yt + drop, 0.05, { k: 1, fill: () => "#fff4dc" }); });
          sfx(img, "layer by layer", 20, 30, t - 0.2, { k: 1, fade: 2.6, fill: () => "#fff4dc" });
        }
        K.vignette(img, 0.35);
      },
      sfx: prepKind === "pour" ? [[0.4, "slurp", 1], [1.4, "slurp", 1]] : prepKind === "shave" ? [0.2, 0.5, 0.8, 1.1, 1.4, 1.7, 2.0].map((a) => [a, "swish", 1]) : prepKind === "layer" ? [0.65, 1.15, 1.65, 2.15, 2.65].map((a) => [a, "plop", 1]) : [0.2, 0.6, 1.0, 1.4, 1.8, 2.2].map((a) => [a, "thud", 0.5]),
    };
    const set = {
      id: "macro2", dur: 3.4,
      base: () => { const im = FA.tableBack(r.seed + 1); light(im, 260, 120, 200, "#ff8a3a", 0.25, 120); if (!(wobbly && !spoiled)) im.paste(lay(spoiled ? "burnt" : "cook"), 0, 0); return im; },
      draw: (img, t) => {
        if (wobbly && !spoiled) { const w = Math.sin(t * 9) * Math.exp(-t * 0.6) * 0.12; const im2 = new Img(W, H); P.draw(im2, { cx: F.cx, cy: F.cy, s: 1.3, stage: "cook", seed: r.seed, f: F, wob: w }); img.paste(im2, 0, 0); sfx(img, "wobble", 22, 30, t - 0.3, { k: 2, wave: true, fade: 1.8, fill: () => "#c8f0b0" }); }
        if (spoiled) { const fx = 120 + Math.cos(t * 3) * 50, fy = 50 + Math.sin(t * 5) * 14; img.rect(fx, fy, 2, 2, "#0a0a0a"); img.px(fx - 1, fy - 1, "#c8d8e8", 0.8); img.px(fx + 2, fy - 1, "#c8d8e8", 0.8); sfx(img, "...", 120, 34, t - 1.2, { k: 3, center: true, fill: () => "#e8e8d8" }); }
        else { const rr = rng(r.seed + 3); for (let i = 0; i < 6; i++) { const x = 50 + rr() * 140, y = 50 + rr() * 60; sparkleAt(img, x, y, (t + i * 0.37) % 1.8, 0.2, 2); } }
        K.vignette(img, 0.3);
      },
      sfx: spoiled ? [[1.2, "groan", 0]] : [[0.5, "chime", 1], [1.6, "sparkle", 1]],
    };
    return [into, prep, set];
  };

  // ---------- the timeline ----------
  function camp(r, ctx) {
    const beats = [];
    const how = METHOD[r.method] || METHOD.iron;
    beats.push({ id: "haul", dur: 3.4 + ctx.haul.tags.length * 0.35, base: () => haulBase(r, ctx), draw: (img, t) => {
      ctx.haul.tags.forEach((tg, i) => note(img, tg.lines, tg.x, tg.y, (t - 0.35 - i * 0.7) / 0.6, tg.tx, tg.ty));
      const fl = flick(t, 1);
      if (ctx.haulMask) lit(img, ctx.haulMask, "#ff7a2a", (fl - 0.82) * 1.2);
      const it = ctx.haul.layout[0];
      if (it && ctx.spec.legendary) twinkles(img, [[it.x - 20, it.y - 14, 2], [it.x + 24, it.y - 6, 3]], t);
    }, sfx: ctx.haul.tags.map((_, i) => [0.4 + i * 0.7, "scribble", 1]) });
    for (const b of how(r, ctx)) beats.push(b);
    beats.push({ id: "reveal", dur: 3.6, base: () => FA.plate(ctx.spec, r.disaster ? "burnt" : "done", { seed: r.seed, legendary: r.legendary }), draw: (img, t) => {
      const p = ctx.spec;
      for (const [x, y, ph] of (p.steamAt || [[70, 60, 0], [120, 54, 1.3], [170, 62, 2.1]])) steam(img, x, y, 40, t * 1.4 + ph, r.disaster ? 0.32 : 0.36, 3, 3, r.disaster ? "#9ac870" : "#fff6ea");
      if (r.disaster) { for (let i = 0; i < 3; i++) steam(img, 80 + i * 40, 90, 70, t * 1.1 + i * 2, 0.45, 6, 6, "#6aa848"); }
      else twinkles(img, p.sparkles || [[96, 50, 3], [150, 44, 2], [60, 70, 2]], t, 1.3);
      if (r.legendary) godrays(img, t);
      nameCard(img, r.name || p.name || "", t - 0.5, { legendary: r.legendary, sub: r.disaster ? "(more or less)" : null });
    }, sfx: [[0.05, r.disaster ? "sad" : r.legendary ? "fanfare" : "reveal", 1], [0.55, "swish", 1]] });
    beats.push(verdictBeat(r, ctx));
    if (r.disaster) beats.push(punchBeat(r, ctx));
    return beats;
  }
  function godrays(img, t) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = Math.atan2(y + 40, x - 120), v = Math.sin(a * 18 + t * 0.6) * 0.5 + 0.5;
      if (v > 0.8 && y < 110) img.add(x, y, [255, 220, 140], ((v - 0.8) * 0.5 * (1 - y / 110)) * (bay(x, y) > 0.5 ? 1 : 0.6));
    }
  }

  // beat 6: the crew round the fire in their own colours, lit by it, a bubble each; a supper gone wrong gets beat 7, its punchline
  const SAYS = {
    great: { seconds: "seconds?", wow: "!!", love: "<3", meh: "mm.", ugh: "mm." },
    good: { seconds: "seconds?", wow: "!!", love: "<3", meh: "mm.", ugh: "mm." },
    plain: { seconds: "seconds?", wow: "oh!", love: "<3", meh: "mm.", ugh: "mm." },
    bad: { seconds: "...", wow: "uh...", love: "...", meh: "...", ugh: "urk" },
  };
  const DEFAULT_REACT = { great: ["love", "wow", "seconds", "wow", "love"], good: ["seconds", "wow", "love", "meh", "seconds"], plain: ["meh", "seconds", "meh", "wow", "meh"], bad: ["ugh", "meh", "ugh", "meh", "ugh"] };
  const SEATS = [[70, 122, true], [170, 122, false], [26, 136, true], [214, 136, false], [120, 92, false]];
  const PUNCH = ["tip", "critter", "flare"];
  const GREEN = "#b0f070";
  function circle(r, ctx) {
    if (ctx.circle) return ctx.circle;
    const n = Math.max(1, ctx.cast.length), fx = 120, fy = 112;
    const order = n === 1 ? [0] : n === 2 ? [0, 1] : n === 3 ? [0, 1, 4] : n === 4 ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
    const seats = ctx.cast.map((c, i) => {
      const [x, y, fr] = SEATS[order[i]], back = order[i] === 4, lit = firelit(c.seated, fr, 2, r.disaster ? GREEN : null);
      return { c, i, x, y, fr, back, lit, top: y - 52 - (back ? 12 : 0) };
    });
    const base = () => {
      const img = campWide(r, { horizon: 74 });
      lit(img, mask(fx, fy, 150, 70, 1.6), r.disaster ? "#7ad84a" : "#ff7a2a", 0.5);
      stones(img, fx, fy + 2, 22, 10, r.seed);
      logs(img, fx, fy);
      return img;
    };
    return (ctx.circle = { n, fx, fy, seats, base, mask: mask(fx, fy, 150, 70, 1.6) });
  }
  function seatLog(img, s) {
    const w = 52, lx = s.x - 26 + (s.fr ? -6 : 6), ly = s.y - 6 - (s.back ? 12 : 0);
    for (let j = 0; j < 8; j++) for (let k = 0; k < w; k++) {
      const end = s.fr ? k > w - 5 : k < 5, toward = s.fr ? k / w : 1 - k / w;
      if (j === 0 && (k < 2 || k > w - 3)) continue;
      let c = j < 2 ? "#4a2c16" : j < 5 ? "#2a180c" : "#140c06";
      if (end) c = j < 2 || j > 5 ? "#3a2412" : (k + j) % 3 ? "#8a5a2c" : "#6a4220";
      else if ((k * 3 + j * 7) % 11 === 0) c = "#0e0804";
      if (!end && j < 4 && toward > 0.75) c = mix(c, "#ff8a3a", (toward - 0.75) * 1.6);
      img.px(lx + k, ly + j, c);
    }
  }
  // the fire flickers on faces too: a small warm swing over the lit sprite
  const flickOn = (fl) => { const m = 0.93 + (fl - 0.82) * 0.9; return (c) => [c[0] * m, c[1] * m * 0.98, c[2] * m * 0.95]; };
  function drawSeat(img, s, t, fl) {
    seatLog(img, s);
    const bob = ((t / 2.6 + s.i * 0.31) % 1) < 0.45 ? 1 : 0;
    blit(img, s.lit, s.x - s.lit.w / 2, s.top + bob, 1, 1, flickOn(fl));
  }
  function circleDraw(img, t, C0, r, o) {
    o = o || {};
    const fl = flick(t, 3), { fx, fy } = C0, skip = o.skip === undefined ? -1 : o.skip;
    lit(img, C0.mask, r.disaster ? "#7ad84a" : "#ff8a3a", (fl - 0.8) * 1.5 + (o.flash || 0));
    C0.seats.filter((s) => s.back && s.i !== skip).forEach((s) => drawSeat(img, s, t, fl));
    if (o.back) o.back(img, fl);
    const big = o.flare || 0;
    glow(img, fx, fy - 8 - big * 20, 34 + big * 40, r.disaster ? "#8ae05a" : "#ff9a3a", (0.16 + big * 0.3) * fl, 26 + big * 30);
    flame(img, fx, fy + 2, 15 + big * 22, 40 + big * 60, t, 7, r.disaster ? { tint: "#5aa83a" } : null);
    embers(img, fx, fy - 6, 14 + Math.round(big * 30), t, 9, 26 + big * 40, 70 + big * 40);
    if (r.disaster) for (let i = 0; i < 2; i++) steam(img, fx - 8 + i * 16, fy - 18, 60, t * 1.2 + i * 2, 0.5, 6, 5, "#7ab850");
    C0.seats.filter((s) => !s.back && s.i !== skip).forEach((s) => drawSeat(img, s, t, fl));
    if (o.front) o.front(img, fl);
  }
  // the colour of a hero's boots: the lowest lit pixel of their sprite
  function bootOf(spr) {
    for (let y = spr.h - 1; y >= 0; y--) for (let x = 0; x < spr.w; x++) { const o = (y * spr.w + x) * 4; if (spr.d[o + 3] && spr.d[o] + spr.d[o + 1] + spr.d[o + 2] > 90) return [spr.d[o], spr.d[o + 1], spr.d[o + 2]]; }
    return C("#4a3020");
  }
  const sayAt = (img, s, words, t) => bubble(img, words, s.x + (s.fr ? 8 : -8), s.top - 2, t, s.fr ? -1 : 1);
  function verdictBeat(r, ctx) {
    const C0 = circle(r, ctx), n = C0.n;
    const said = ctx.cast.map((c, i) => {
      const how = (r.reactions || {})[c.id] || DEFAULT_REACT[r.verdict][i % 5];
      return r.disaster ? (i === 0 ? "..." : ["...", "urk", "blegh", "..."][i % 4]) : SAYS[r.verdict][how] || "...";
    });
    return { id: "verdict", dur: 2.2 + n * 0.7, base: C0.base, draw: (img, t) => {
      circleDraw(img, t, C0, r);
      C0.seats.forEach((s, i) => sayAt(img, s, said[i], t - 0.5 - i * 0.6));
      if (r.verdict === "great" && !r.disaster) for (let i = 0; i < 4; i++) { const u = ((t * 0.5 + i * 0.25) % 1); if (t > 1.2) heart(img, C0.fx - 20 + i * 13 + Math.sin(u * 6 + i) * 3, C0.fy - 30 - u * 50, 1 - u); }
    }, sfx: said.map((_, i) => [0.55 + i * 0.6, r.disaster ? "groan" : "pop", i]).concat([[0, "fire", 2.2 + n * 0.7 + (r.disaster ? 4.6 : 1)]]) };
  }
  // beat 7, after a disaster: one of three punchlines, picked by the meal, so a crew's bad suppers don't all end alike
  function punchBeat(r, ctx) {
    const C0 = circle(r, ctx), seats = C0.seats, kind = PUNCH.includes(r.punch) ? r.punch : PUNCH[(r.seed >>> 5) % PUNCH.length];
    const front = seats.filter((s) => !s.back), cookS = seats.find((s) => s.c.cook) || seats[0];
    if (kind === "tip") {
      // whoever is sitting nearest rocks, goes over backwards behind the log, and leaves only their boots in the air
      const v = front.find((s) => !s.c.cook) || front[0] || seats[0];
      const hip = [v.lit.w / 2, 52], frames = new Map(), at = (a) => { const k = Math.round(a * 40); if (!frames.has(k)) frames.set(k, tipped(v.lit, k / 40, v.fr, hip)); return frames.get(k); };
      const others = seats.filter((s) => s !== v), logTop = v.y - 6 - (v.back ? 12 : 0), bootC = bootOf(v.c.seated), lx = v.x + (v.fr ? -14 : 14);
      return { id: "punch", dur: 3.6, base: C0.base, draw: (img, t) => {
        const a = t < 0.5 ? Math.sin(t * 14) * 0.05 * (t / 0.5) : 0.75 * easeIn(seg(t, 0.5, 0.85)), drop = 70 * easeIn(seg(t, 0.75, 1.0));
        circleDraw(img, t, C0, r, { skip: v.i, [v.back ? "back" : "front"]: (im, fl) => {
          if (drop < 66) { const tp = at(a); blit(im, tp, v.x - tp.pivot[0] + (v.fr ? -1 : 1) * drop * 0.3, v.top + hip[1] - tp.pivot[1] + drop, 1, 1, (c, u, vv, i, j) => (v.top + hip[1] - tp.pivot[1] + drop + j > logTop + 3 ? null : flickOn(fl)(c))); }
          if (t > 1.0) {
            const up = Math.round(14 * Math.min(1, (t - 1.0) / 0.12)), wig = t > 1.6 ? Math.round(Math.sin(t * 9)) : 0;
            for (const [bx, w] of [[lx - 7, wig], [lx + 3, -wig]]) for (let j = 0; j < up; j++) for (let i = 0; i < 7; i++) {
              const sole = j < 2, toe = j < 4 && (v.fr ? i < 2 : i > 4) ? 0 : 1, x = bx + i + w + (j < 4 && toe === 0 ? (v.fr ? -2 : 2) : 0);
              im.px(x, logTop + 1 - j, i === 0 || i === 6 || sole ? "#120a06" : mix(bootC, "#ff9a4a", i < 3 === v.fr ? 0 : 0.25));
            }
          }
          seatLog(im, v);
        } });
        sfx(img, "thunk.", lx, logTop - 26, t - 1.0, { k: 2, center: true, fade: 1.4, fill: () => "#e8e8d8" });
        if (t > 1.4) for (let k = 0; k < 3; k++) { const aa = t * 4 + (k * TAU) / 3; star(img, lx + Math.cos(aa) * 10, logTop - 14 + Math.sin(aa) * 3, "#fff2b0", 1); }
        others.forEach((s, i) => sayAt(img, s, s === cookS ? "...seconds?" : "!", t - (s === cookS ? 2.2 : 1.1 + i * 0.12)));
        if (!others.length) sfx(img, "...", 120, 30, t - 2.0, { k: 2, center: true, fill: () => "#e8e8d8" });
      }, sfx: [[0.5, "swish", 1], [1.0, "thud", 1], [1.1, "pop", 2], [2.2, "pop", 0]] };
    }
    if (kind === "critter") {
      // a pet (or a camp stray) comes for the pot, sniffs it twice, and leaves
      const own = seats.find((s) => s.c.pet && ["dog", "cat", "wolf"].includes(s.c.pet.kind));
      const pet = own ? own.c.pet : { kind: root.Art && root.Art.PET_COATS && root.Art.PET_COATS.cat ? "cat" : "dog", name: "stray" + (r.seed % 97) };
      let spr = null;
      try { spr = [0, 1].map((f) => gridImg(root.Art.petGrid(pet, f))); } catch (e) { spr = null; }
      const lits = spr && { l: spr.map((g) => firelit(g, false, 2, GREEN)), r: spr.map((g) => firelit(g, true, 2, GREEN)) };
      const bx = 118, by = 130, talker = own || cookS;
      return { id: "punch", dur: 3.9, base: C0.base, draw: (img, t) => {
        circleDraw(img, t, C0, r, { front: (im) => {
          for (let j = -5; j <= 5; j++) for (let i = -12; i <= 12; i++) { const e = Math.hypot(i / 12, j / 5); if (e > 1) continue; im.px(bx + i, by + j + 4, j < -2 ? (e > 0.82 ? "#4a4a52" : "#5aa83a") : e > 0.86 ? "#101014" : "#24242a"); }
          for (let i = -9; i <= 9; i++) im.px(bx + i, by + 1 + Math.round(Math.sin(i + t * 3) * 0.5), i % 4 ? "#7ad84a" : "#c8f890");
          if (!lits) return;
          let x, face = "l", fr = Math.floor(t * 8) % 2;
          if (t < 1.3) x = lerp(264, bx + 24, ease(seg(t, 0, 1.3)));
          else if (t < 2.55) { x = bx + 24 - (t > 1.5 && t < 2.3 && Math.sin((t - 1.5) * 18) > 0 ? 2 : 0); fr = 0; }
          else { face = "r"; x = lerp(bx + 24, 300, easeIn(seg(t, 2.6, 3.3))); fr = Math.floor(t * 12) % 2; }
          const g = lits[face][fr], gx = Math.round(x - g.w / 2), gy = by + 14 - g.h;
          // a dark pet at night would vanish into the dark legs behind it: a thin fire-lit edge all round keeps it a shape
          for (let j = -1; j <= g.h; j++) for (let i = -1; i <= g.w; i++) if (!g.alpha(i, j) && (g.alpha(i - 1, j) || g.alpha(i + 1, j) || g.alpha(i, j - 1) || g.alpha(i, j + 1))) im.px(gx + i, gy + j, "#ffc070", 0.75);
          blit(im, g, gx, gy, 1, 1);
        } });
        sfx(img, "sniff", bx + 14, by - 22, t - 1.5, { k: 1, fade: 0.45, fill: () => "#f4e8d0" });
        sfx(img, "sniff", bx + 26, by - 30, t - 1.95, { k: 1, fade: 0.45, fill: () => "#f4e8d0" });
        sfx(img, "nope.", 196, 58, t - 2.6, { k: 2, center: true, fade: 1.1, fill: () => "#e8e8d8" });
        sayAt(img, talker, own ? "traitor." : "even the cat...", t - 3.0);
      }, sfx: [[1.5, "swish", 0.3], [1.95, "swish", 0.3], [2.6, "pop", 0], [3.0, "groan", 1]] };
    }
    // the cook gives the pot to the fire, which doesn't want it either
    return { id: "punch", dur: 3.6, base: C0.base, draw: (img, t) => {
      const big = t < 0.9 ? 0 : t < 1.0 ? (t - 0.9) * 10 : Math.max(0, 1 - (t - 1.0) / 1.0);
      circleDraw(img, t, C0, r, { flare: big, flash: big * 0.6 });
      if (t > 0.3 && t < 0.9) { const u = seg(t, 0.3, 0.9), x = lerp(cookS.x + (cookS.fr ? 14 : -14), C0.fx, u), y = lerp(cookS.top + 34, C0.fy - 6, u) - Math.sin(u * Math.PI) * 30; img.rect(x - 2, y - 2, 5, 4, "#5aa83a"); img.px(x - 1, y - 2, GREEN); }
      sfx(img, "FWOOMP", C0.fx, 40, t - 0.9, { k: 3, center: true, shake: 2, fade: 1.6, fill: (xx, yy) => (yy % 4 < 2 ? "#c8f890" : "#7ad84a") });
      if (t > 1.9) { const u = clamp((t - 1.9) / 1.6, 0, 1), ry = 3 + u * 4, rx = 7 + u * 10; for (let k = 0; k < 28; k++) { const aa = (k / 28) * TAU; img.px(C0.fx + Math.cos(aa) * rx, C0.fy - 40 - u * 50 + Math.sin(aa) * ry, "#6a8a5a", 0.8 * (1 - u)); } }
      if (t < 2.4) seats.forEach((s) => sayAt(img, s, "!!", t - 1.0));
      else sayAt(img, seats[seats.length > 1 ? 1 : 0], "...rations?", t - 2.4);
      return { shake: t > 0.9 && t < 1.3 ? [Math.round(Math.sin(t * 60)), 1] : null };
    }, sfx: [[0.3, "swish", 1], [0.9, "rumble", 1], [0.92, "hiss", 1], [2.4, "pop", 1]] };
  }
  function heart(img, x, y, a) { HEART.slice(0, 5).forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === "#") img.px(x + i - 3, y + j, j < 2 && i < 3 ? "#ff9a9a" : "#e0303a", a); }); }

  // a town food event, from the record's event field, or for records written before it, from the bubble line its event always sets (league/cooking.py)
  const EVENT_LINES = { feast: ["feast day!"], contest: ["FIRST PRIZE", "next year"], feud: ["this one!", "no contest", "...both?"] };
  function eventOf(rec) {
    if (!rec || rec.kind !== "tavern") return null;
    if (rec.event && EVENT_LINES[rec.event]) return rec.event;
    for (const k in EVENT_LINES) if (EVENT_LINES[k].includes(rec.line) && (k !== "contest" || rec.where === "bakery")) return k;
    return null;
  }

  function tavern(r, ctx) { return root.MealReplay && root.MealReplay.tavernBeats ? root.MealReplay.tavernBeats(r, ctx) : camp(Object.assign({}, r, { kind: "camp" }), ctx); }

  // ---------- plan and render ----------
  const plans = new Map();
  function planFor(rec, opts) {
    const key = JSON.stringify(rec);
    if (plans.has(key)) return plans.get(key);
    const r = norm(rec), ctx = { r, rec, spec: r.spec, cast: castOf(r, opts), cache: new Map() };
    ctx.haul = haulLayout(r, ctx);
    ctx.haulMask = mask(250, 170, 230, 160, 1.4);
    const beats = r.kind === "tavern" ? tavern(r, ctx) : camp(r, ctx);
    let t0 = 0;
    const ev = [];
    for (const b of beats) {
      b.t0 = t0; b.t1 = t0 + b.dur;
      for (const [at, name, v] of b.sfx || []) ev.push([t0 + at, name, v]);
      t0 += b.dur;
    }
    ev.sort((a, b) => a[0] - b[0]);
    const p = { r, ctx, beats, dur: t0, ev };
    if (plans.size > 12) plans.delete(plans.keys().next().value);
    plans.set(key, p);
    return p;
  }
  function baseOf(p, b) {
    const c = p.ctx.cache;
    if (!c.has(b.id)) c.set(b.id, b.base());
    return c.get(b.id);
  }
  // a camp meal opens on the camp kitchen, the cookware on the fire before anything goes in, under the dish's name (t from -PRE to 0);
  // a town meal opens on its room already
  const PRE = 2.4;
  const preOf = (rec, opts) => (planFor(rec, opts).r.kind === "tavern" ? 0 : PRE);
  function opening(p, t) {
    const b = p.beats.find((x) => x.id === "into");
    const img = baseOf(p, b).copy();
    b.draw(img, 0.02, p);
    const cook = (p.r.eaters || []).find((e) => e.id === p.r.cook);
    nameCard(img, p.r.name || p.ctx.spec.name || "", t - 0.3, { legendary: p.r.legendary, sub: cook ? `${cook.name}'s turn to cook` : null });
    return img;
  }
  function render(rec, t, opts) {
    const p = planFor(rec, opts);
    if (t < 0 && p.r.kind !== "tavern") {
      const img = opening(p, t + PRE), out = new Uint8ClampedArray(W * H * 4);
      for (let i = 0; i < W * H; i++) { out[i * 4] = img.d[i * 4]; out[i * 4 + 1] = img.d[i * 4 + 1]; out[i * 4 + 2] = img.d[i * 4 + 2]; out[i * 4 + 3] = 255; }
      return { w: W, h: H, data: out };
    }
    t = Math.max(0, t);
    let i = p.beats.findIndex((b) => t < b.t1);
    if (i < 0) i = p.beats.length - 1;
    const b = p.beats[i], lt = t - b.t0;
    const img = baseOf(p, b).copy();
    const info = b.draw(img, lt, p) || {};
    const out = new Uint8ClampedArray(W * H * 4), sh = info.shake || [0, 0], fade = i > 0 && lt < 0.16 ? lt / 0.16 : 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sx = clamp(x - sh[0], 0, W - 1), sy = clamp(y - sh[1], 0, H - 1), s = (sy * W + sx) * 4, o = (y * W + x) * 4;
      if (fade < 1 && bay(x, y) > fade) { out[o] = 6; out[o + 1] = 4; out[o + 2] = 3; out[o + 3] = 255; continue; }
      out[o] = img.d[s]; out[o + 1] = img.d[s + 1]; out[o + 2] = img.d[s + 2]; out[o + 3] = 255;
    }
    return { w: W, h: H, data: out };
  }
  // warms the next beat's still layers while the current one plays, so a cut never stalls
  function warm(rec, t, opts) {
    const p = planFor(rec, opts);
    const nx = p.beats.find((b) => b.t0 > t && !p.ctx.cache.has(b.id));
    if (nx) baseOf(p, nx);
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
      fire: (t, secs) => {
        secs = Math.min(16, secs || 8);
        noise(t, secs, 0.05, "lowpass", 260, 0.7, null, 0.4);
        let at = t + 0.05;
        while (at < t + secs - 0.2) { const big = Math.random() < 0.12; noise(at, big ? 0.03 : 0.012, big ? 0.3 : 0.08 + Math.random() * 0.1, "bandpass", big ? 1800 : 2500 + Math.random() * 3000, big ? 1.2 : 2.5); at += 0.05 + Math.random() * Math.random() * 0.35; }
      },
      sizzle: (t, secs) => {
        secs = Math.min(8, secs || 2);
        noise(t, secs, 0.14, "highpass", 3800, 0.6, null, 0.05);
        noise(t, secs, 0.06, "bandpass", 6500, 1.2, null, 0.05);
        for (let i = 0; i < secs * 14; i++) noise(t + Math.random() * secs, 0.01, 0.1 + Math.random() * 0.1, "highpass", 5000 + Math.random() * 3000);
      },
      splat: (t) => { tone(t, 140, 60, 0.12, 0.35); noise(t, 0.08, 0.35, "lowpass", 900); FX.sizzle(t + 0.02, 1.4); },
      plop: (t) => { tone(t, 420, 180, 0.08, 0.16, "sine"); noise(t, 0.04, 0.12, "lowpass", 1200); },
      flip: (t) => { noise(t, 0.12, 0.12, "bandpass", 1600, 1.4, 600); },
      thud: (t) => { tone(t, 110, 50, 0.18, 0.4); noise(t, 0.1, 0.25, "lowpass", 500); },
      scribble: (t) => { for (let i = 0; i < 6; i++) noise(t + i * 0.06 + Math.random() * 0.02, 0.04, 0.05, "bandpass", 3200 + Math.random() * 1400, 3); },
      swish: (t) => { noise(t, 0.3, 0.12, "bandpass", 900, 1.2, 3200, 0.08); },
      reveal: (t) => { [784, 988, 1175, 1568].forEach((f, i) => ring(t + i * 0.07, f, 0.9, 0.05)); },
      fanfare: (t) => { [523, 659, 784, 1046].forEach((f, i) => { tone(t + i * 0.12, f, f, 0.5, 0.06, "triangle", 0.02); ring(t + i * 0.12, f * 2, 0.6, 0.02); }); tone(t + 0.5, 1046, 1046, 1.2, 0.07, "triangle", 0.03); },
      sad: (t) => { tone(t, 330, 311, 0.4, 0.07, "triangle"); tone(t + 0.35, 294, 262, 0.7, 0.07, "triangle"); },
      sparkle: (t) => { const n = [2093, 2637, 3136, 3520]; for (let i = 0; i < 5; i++) ring(t + i * 0.08, n[i % 4], 0.5, 0.035); },
      pop: (t, i) => { const f = 620 + (i || 0) * 90; tone(t, f, f * 1.6, 0.06, 0.12); noise(t, 0.03, 0.06, "highpass", 3000); },
      groan: (t, i) => { tone(t, 180 - (i || 0) * 15, 120, 0.4, 0.06, "sawtooth", 0.05); },
      blub: (t) => { for (let i = 0; i < 3; i++) { const at = t + i * 0.14 + Math.random() * 0.05, f = 180 + Math.random() * 140; tone(at, f, f * 2.2, 0.07, 0.12); } },
      simmer: (t, secs) => { secs = Math.min(8, secs || 2); noise(t, secs, 0.04, "lowpass", 400, 0.8, null, 0.2); for (let i = 0; i < secs * 4; i++) FX.blub(t + Math.random() * secs); },
      hiss: (t) => { noise(t, 0.9, 0.16, "highpass", 2500, 0.7, 6000, 0.05); },
      clink: (t) => { ring(t, 2400, 0.3, 0.05); },
      crunch: (t) => { for (let i = 0; i < 4; i++) noise(t + i * 0.03, 0.05, 0.3, "bandpass", 1600 + Math.random() * 2000, 1.5); tone(t, 160, 70, 0.08, 0.2); },
      slurp: (t) => { noise(t, 0.35, 0.12, "bandpass", 700, 4, 1800, 0.05); },
      chime: (t) => { ring(t, 1568, 0.8, 0.05); ring(t + 0.1, 2093, 0.7, 0.04); },
      rumble: (t) => { tone(t, 70, 55, 0.6, 0.12, "sawtooth", 0.1); noise(t, 0.5, 0.06, "lowpass", 200); },
      gasp: (t) => { noise(t, 0.25, 0.08, "bandpass", 1400, 2, 2400, 0.05); },
      room: (t, secs) => { secs = Math.min(16, secs || 8); noise(t, secs, 0.035, "bandpass", 520, 0.7, null, 0.4); for (let i = 0; i < secs * 1.5; i++) noise(t + Math.random() * secs, 0.2, 0.012, "bandpass", 500 + Math.random() * 700, 5); },
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
    fig.className = "meal-replay night-replay";
    cv.width = W; cv.height = H;
    cv.style.cssText = `image-rendering:pixelated;image-rendering:crisp-edges;display:block;cursor:pointer;${opts.scale ? `width:${W * opts.scale}px;height:${H * opts.scale}px` : "width:100%;height:auto"}`;
    cv.title = "Click to watch again";
    fig.appendChild(cv);
    const g = cv.getContext("2d"), img = g.createImageData(W, H);
    const p = planFor(rec, opts), still = p.beats.find((b) => b.id === "reveal" || b.id === "macro2") || p.beats[p.beats.length - 1];
    const pre = preOf(rec, opts);
    let t = reduced() ? still.t0 + Math.min(1.6, still.dur - 0.01) : -pre, raf = 0, last = 0, onscreen = false, fired = 0, lastDraw = -1, rate = 1, held = false, forced = false;
    const paint = () => { const f = render(rec, t, opts); img.data.set(f.data); g.putImageData(img, 0, 0); };
    const live = () => !held && fig.isConnected && onscreen && !doc.hidden;
    const LONG = { fire: 1, sizzle: 1, simmer: 1, room: 1 };
    function frame(ms) {
      raf = 0;
      if (!live()) { last = 0; return; }
      const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
      last = ms;
      t += dt * rate;
      while (fired < p.ev.length && p.ev[fired][0] <= t) {
        const e = p.ev[fired], late = t - e[0];
        if (late < 0.25 || (LONG[e[1]] && late < 1)) Snd.play(e[1], e[2]);
        fired++;
      }
      // after the cut the last beat keeps breathing (the fire, the bubbles) at a low rate for a while, then holds
      const end = t >= p.dur;
      if (!end || t - lastDraw > 1 / 12) { paint(); lastDraw = t; }
      if (!end) warm(rec, t, opts);
      if (t < p.dur + 40) raf = root.requestAnimationFrame(frame);
    }
    const wake = () => { if ((forced || !reduced()) && !raf && live()) { last = 0; raf = root.requestAnimationFrame(frame); } };
    const restart = () => { held = false; t = -pre; fired = 0; lastDraw = -1; paint(); wake(); };
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
    // the page's shared control bar drives the player through this (replay.js); a press of Play also plays under reduced motion
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

  root.MealReplay = {
    player, W, H, METHODS, eventOf,
    frame: render,
    length: (rec, opts) => planFor(rec, opts).dur,
    pre: preOf,
    beats: (rec, opts) => planFor(rec, opts).beats.map((b) => ({ id: b.id, t0: b.t0, t1: b.t1 })),
    events: (rec, opts) => planFor(rec, opts).ev.slice(),
    sound: Snd,
    kit: { wrap, campWide, flame, embers, stones, logs, flick, mask, lit, sfx, blit, sparkleAt, twinkles, darken, bubble, nameCard, note, firelit, heart, godrays, sky, castOf },
  };
})(typeof window !== "undefined" ? window : globalThis);
