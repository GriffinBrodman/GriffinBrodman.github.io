/* Set pieces for story vignettes: each season theme's day-1 poster (named by its THEMES row's `poster`) and the Long Night's sunrise. */
(function () {
  "use strict";
  const R = Math.round;
  const F = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(R(x), R(y), w, h); };
  const P = (c, x, y, col) => F(c, x, y, 1, 1, col);
  const OL = "#1a1220";
  const bgc = (o) => o.bg.getContext("2d");

  // the season's own standard: a cream banner on a pole with the theme's emblem (emblem_art.js) on it and a swallow tail
  function standard(c, x, g, key) {
    const top = g - 34, cx = x + 3, cy = top + 3, cw = 20, ch = 21;
    F(c, x - 1, top - 1, 4, g - top + 1, OL); F(c, x, top, 2, g - top, "#5a3a20"); F(c, x, top, 1, g - top, "#8a5e34");
    F(c, x - 1, top - 3, 4, 2, OL); F(c, x, top - 4, 2, 3, "#e8b84a"); P(c, x, top - 4, "#fff0a0");
    F(c, x + 1, top + 1, cw + 4, 3, OL); F(c, x + 2, top + 2, cw + 2, 1, "#8a5e34");
    F(c, cx - 1, cy, cw + 2, ch + 1, OL);
    for (let k = 0; k < 4; k++) { F(c, cx - 1 + k, cy + ch + k, 9 - k * 2 + 1 + 2, 1, OL); F(c, cx + cw - 10 + k + 1, cy + ch + k, 9 - k * 2 + 2, 1, OL); }
    F(c, cx, cy, cw, ch, "#efe2bf"); F(c, cx + cw - 2, cy, 2, ch, "#d4bf94"); F(c, cx, cy, 1, ch, "#fff6dc");
    for (let k = 0; k < 3; k++) { F(c, cx + k, cy + ch + k, 8 - k * 2, 1, k ? "#d4bf94" : "#efe2bf"); F(c, cx + cw - 8 + k, cy + ch + k, 8 - k * 2, 1, "#d4bf94"); }
    F(c, cx, cy, cw, 2, "#b8402e"); F(c, cx, cy + 1, cw, 1, "#8a2a20");
    const em = window.Emblems && Emblems.grid(key);
    if (em) c.drawImage(em.toCanvas(1), cx + 2, cy + 3);
  }

  // townsfolk at the scale of the places' own walkers (anim.js villager): standing, cheering with both arms up, or holding a lantern;
  // `shadow` throws a long shadow back to the left (a low sun on the right)
  const SK = ["#f0c8a0", "#e0b088", "#c48a5e", "#9a6440", "#6e4428"], SH = ["#8a3a2a", "#3a5a8a", "#5a8a3a", "#c8a040", "#7a5a3a", "#4a6a6a", "#a8503a", "#2e4a6e"];
  const HAIRS = ["#3a2a1a", "#6a4020", "#c8a050", "#2a2228", "#9a9aa6", "#a04a20"];
  const FOLK = {
    stand: [".h.", ".s.", "ccc", "ccc", "p.p", "f.f"],
    dress: [".h.", ".s.", "ccc", "ccc", "ccc", "f.f"],
    cheer: ["s...s", "c.h.c", ".csc.", "..c..", ".ccc.", ".p.p.", ".f.f."],
    lamp: [".h..", ".s..", "cccc", "ccck", "p.pl", "f.f."],
  };
  function folk(c, x, g, r, o) {
    o = o || {};
    const pal = { h: HAIRS[Math.floor(r() * HAIRS.length)], s: SK[Math.floor(r() * SK.length)], c: o.shirt || SH[Math.floor(r() * SH.length)], p: "#4a3a2a", f: "#2a1e1a", k: "#2a1c14", l: "#ffd27a" };
    const rows = o.cheer ? FOLK.cheer : o.lamp ? FOLK.lamp : r() < 0.3 ? FOLK.dress : FOLK.stand;
    if (o.shadow) for (let k = 2; k <= o.shadow + 1; k++) if (k < 5 || k % 2 === 0) P(c, x - k, g, "rgba(48,22,30,0.5)");
    Anim.put(c, Anim.sprite(rows, pal), x, g, o.left);
  }

  // a bank of mist at a fixed height: a flat body with a dithered, uneven top and a thin dithered foot, never a soft wash (the map's fog
  // sign)
  function mistBand(c, W, y, h, rgb, a, seed) {
    for (let x = 0; x < W; x++) {
      const top = y + R(1.5 + Math.sin((x + seed * 13) / 9) * 1.2 + Math.sin(x / 4.3) * 0.6);
      if ((x + top) % 2 === 0) P(c, x, top - 1, `rgba(${rgb},${a * 0.6})`);
      F(c, x, top, 1, y + h - top, `rgba(${rgb},${a})`);
      if (x % 2 === 0) P(c, x, y + h, `rgba(${rgb},${a * 0.6})`);
    }
  }

  // ---------- the theme posters: o = { ctx (over the land), bg (the painting), actors, A, W, H, ground, hz, seed, r, key (emblem) } ----------
  const POSTERS = {
    // the sun that didn't rise: night at noon, lamps lit, folk out in the street with lanterns staring up
    night: { sky: true, draw(o) {
      const { ctx, W, ground, r } = o;
      standard(ctx, R(W * 0.66), ground, o.key);
      for (let i = 0; i < 3; i++) folk(ctx, R(W * 0.3) + i * 9, ground - (i % 2), r, { lamp: i !== 1, left: i === 2 });
    } },
    // the sea went out: wet sand where it was, a low bar on the horizon with a drowned spire on it, a boat on its side, gulls
    dry_sea: { kind: "coast", life: false, draw(o) {
      const { ctx, bg, A, actors, W, H, hz, ground, seed } = o, b = bg.getContext("2d");
      // the sea bed laid bare from the shore to the sky: wet sand in bands that darken toward us, ripple lines, pools holding the sky,
      // weed and shells, and the old sea wall on the left with its steps going down to nothing
      const top = hz - 9, rr = Anim.rng(seed + 17);
      for (let y = top; y < H; y++) {
        const t = (y - top) / (H - top), base = t < 0.2 ? "#cdbd90" : t < 0.5 ? "#c2ae7e" : "#b49c6a", rip = t < 0.2 ? "#bca97a" : t < 0.5 ? "#ad9768" : "#9a8458";
        F(b, 0, y, W, 1, base);
        const gap = t < 0.2 ? 3 : t < 0.5 ? 4 : 5;
        if ((y - top) % gap === 0) for (let x = 0; x < W; x++) if (Math.sin(x / (4 + t * 6) + y) > 0.1) P(b, x, y, rip);
      }
      F(b, 0, top, W, 1, "#8ab8d0"); for (let x = 0; x < W; x += 3) P(b, x + (x % 2), top - 1, "#a8cce0");
      for (let i = 0; i < 6; i++) {
        const py = top + 4 + R(rr() * (H - top - 8)), pw = 8 + R(rr() * 10 * (1 + (py - top) / 20)), px0 = R(rr() * (W - pw));
        F(b, px0 + 1, py, pw - 2, 1, "#9ccbe0"); F(b, px0, py + 1, pw, 1, "#7ab0c8"); F(b, px0 + 2, py, R(pw / 3), 1, "#d8f0f8"); F(b, px0 + 1, py + 2, pw - 2, 1, "#a08a5c");
      }
      for (let i = 0; i < 14; i++) { const x = R(rr() * W), y = top + 3 + R(rr() * (H - top - 4)); P(b, x, y, rr() < 0.6 ? "#4a6a3a" : "#f0e6d4"); if (rr() < 0.5) P(b, x + 1, y - 1, "#3a5a2e"); }
      const wx = R(W * 0.06);
      F(b, 0, top - 5, wx, H - top + 5, "#8a8478");
      for (let y = top - 3; y < H; y += 3) { F(b, 0, y, wx, 1, "#6a645a"); for (let x = ((y / 3) % 2) * 3; x < wx; x += 6) F(b, x, y - 2, 1, 2, "#6a645a"); }
      F(b, 0, top - 6, wx + 1, 2, "#b8b0a0"); F(b, 0, top - 4, wx + 1, 1, "#5a544a"); F(b, wx, top - 4, 1, H - top + 4, "#4a443c");
      for (let y = top + 1; y < H; y += 5) { F(b, wx - 1, y, 2, 1, "#3a5a2e"); P(b, wx, y + 1, "#4a6a3a"); }
      for (let k = 0; k < 4; k++) { F(b, wx + 1, top - 2 + k * 4, 4 - k, 4, "#8a8478"); F(b, wx + 1, top - 2 + k * 4, 4 - k, 1, "#b8b0a0"); }
      // the bar and the spire on it, far out where the water was
      const sx = R(W * 0.74), by = hz - 7;
      for (let x = -22; x <= 22; x++) { const h = R(2.4 * (1 - (x / 22) ** 2)); if (h > 0) F(b, sx + x, by - h, 1, h, x < 0 ? "#a8946a" : "#988458"); }
      F(b, sx - 3, by - 19, 6, 18, "#3a4048"); F(b, sx - 2, by - 18, 4, 17, "#6a7280"); F(b, sx - 2, by - 18, 1, 17, "#8a929c"); F(b, sx + 1, by - 18, 1, 17, "#525a66");
      F(b, sx - 1, by - 15, 2, 3, "#1e2228"); F(b, sx - 2, by - 6, 4, 4, "#4a6a3a"); P(b, sx - 2, by - 6, "#6a8a4a"); P(b, sx + 1, by - 4, "#c8c0a8"); P(b, sx - 1, by - 3, "#c8c0a8");
      for (let k = 0; k < 9; k++) F(b, sx - 3 + Math.ceil(k / 3), by - 20 - k, Math.max(1, 7 - Math.ceil(k / 3) * 2), 1, k % 3 ? "#2e343c" : "#4a525e");
      P(b, sx, by - 30, "#c8a040");
      for (const [dx, w] of [[-14, 6], [9, 7]]) { F(b, sx + dx, by - 4, w, 3, "#4a4e56"); F(b, sx + dx + 1, by - 6, w - 2, 2, "#3a3e46"); P(b, sx + dx + 1, by - 3, "#1e2228"); }
      // a rowboat left high and dry, on her side
      const boat = Anim.sprite(["k..............k", "kbbbbbbbbbbbbbbk", ".hhhhhhhhhhhhhh.", "..hhdhhhhhhdhh..", "...ddddddddddd.."], { k: "#5a3a20", b: "#c8945a", h: "#8a5a34", d: "#6a4224" });
      Anim.put(ctx, boat, R(W * 0.3), ground + 3);
      F(ctx, R(W * 0.3) - 10, ground + 3, 20, 1, "rgba(60,44,20,0.35)");
      standard(ctx, R(W * 0.55), ground, o.key);
      if (A) { for (let i = 0; i < 2; i++) actors.push(A.gull({ W, y: 6 + i * 7, seed: seed + i })); actors.push(A.crab({ x: R(W * 0.12), y: H - 3, range: 12, seed })); }
    } },
    // sparks drifting up across the whole field, and a goose who was a mage this morning
    sparks: { draw(o) {
      const { ctx, actors, A, W, ground, hz, seed } = o;
      standard(ctx, R(W * 0.62), ground, o.key);
      const gx = R(W * 0.5), gy = ground;
      const goose = Anim.sprite(["....ww.", "...wwkb", "...ww..", "wwwww..", ".wwww..", "..oo..."], { w: "#f4f0e6", k: "#1a1220", b: "#e8862a", o: "#e8862a" });
      Anim.put(ctx, goose, gx, gy);
      const m = Scenes.kit.motes(8, W - 8, 6, ground - 2, seed, 40);
      if (A) actors.push(m); else m.draw(ctx, 0);
      void hz;
    } },
    // the dragon's shape crossing high over the land, and smoke going up off the far hills where she has been
    dragon: { draw(o) {
      const { ctx, actors, A, W, hz, ground, seed } = o;
      standard(ctx, R(W * 0.66), ground, o.key);
      if (!A) return;
      const fx = R(W * 0.88);
      for (let k = 0; k < 9; k++) P(bgc(o), fx - 4 + k, hz - 9 + (k % 3 === 1 ? 0 : 1), k % 2 ? "#6a2a1a" : "#3a1a14");
      actors.push(A.column({ x: fx, y: hz - 9, h: Math.min(34, hz - 6), wind: -7, seed, life: 7, z: -6, cols: ["#8a8480", "#6a6460", "#4e4846"] }));
      // her shape, high up and far off: a long neck and tail, and the wings beating (two frames)
      const pal = { k: "#2a1820", w: "#5a3038" };
      const body = ["k..kkkkkkkkkkkkkkkkk....", ".k.kkkkkkkkkkkkkkk......", "..kk...k.k...k.k........"];
      const up = Anim.sprite([
        "......k....k............",
        ".....kw...kw............",
        "....kww..kww............",
        "...kwww.kwww........k.k.",
        "..kwwwwkwwwwk......kkkk.",
        "..kwwwwwwwwwk.....kkkkkk"].concat(body, ["........................", "........................", "........................", "........................"]), pal, null);
      const dn = Anim.sprite([
        "........................",
        "........................",
        "........................",
        "....................k.k.",
        "...................kkkk.",
        "..................kkkkkk",
        "k..kkkkkkkkkkkkkkkkk....",
        ".k.kkkkkkkkkkkkkkk......",
        "..kkkwwwwwwwwk.k........",
        ".....kwwwwkwwk..........",
        "......kwwwkwk...........",
        ".......kww.k............",
        "........k..............."], pal, null);
      actors.push({ z: 1, draw(c, t) {
        const span = W + 80, x = W + 40 - ((t * 10 + seed % 97 + W * 0.45) % span), y = 24 + R(Math.sin(t * 0.8) * 2);
        Anim.put(c, Math.floor(t * 2.2) % 2 ? dn : up, x, y, true);
      } });
    } },
    // the snow came early: the snowfield, falling snow, and somebody has already built a snowman
    snow: { kind: "snow", draw(o) {
      const { ctx, W, ground } = o;
      standard(ctx, R(W * 0.66), ground, o.key);
      const x = R(W * 0.42), g = ground;
      F(ctx, x - 4, g - 7, 9, 7, OL); F(ctx, x - 3, g - 6, 7, 6, "#f4f8ff"); F(ctx, x + 2, g - 6, 2, 6, "#c8d4ea");
      F(ctx, x - 3, g - 13, 7, 6, OL); F(ctx, x - 2, g - 12, 5, 5, "#ffffff"); F(ctx, x + 2, g - 12, 1, 5, "#c8d4ea");
      F(ctx, x - 2, g - 9, 5, 1, "#c8402e"); F(ctx, x + 2, g - 9, 1, 3, "#a8302a");
      P(ctx, x - 1, g - 11, "#1a1220"); P(ctx, x + 1, g - 11, "#1a1220"); F(ctx, x, g - 10, 2, 1, "#e8862a");
      F(ctx, x - 2, g - 15, 5, 2, OL); F(ctx, x - 1, g - 16, 3, 1, OL); F(ctx, x - 1, g - 15, 3, 1, "#3a3440");
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) P(ctx, x + (s < 0 ? -4 - k : 4 + k), g - 6 - (k >> 1), "#5a3a20");
    } },
    // the wishing well in the square, coins winking in its water, and a frog on the rim who knows something
    well: { kind: "town", draw(o) {
      const { ctx, actors, A, W, ground, seed } = o;
      standard(ctx, R(W * 0.72), ground, o.key);
      const x = R(W * 0.44), g = ground + 1;
      F(ctx, x - 1, g - 31, 2, 4, OL);
      F(ctx, x - 12, g - 28, 24, 1, OL); for (let k = 0; k < 5; k++) F(ctx, x - 11 + k, g - 27 - k, 22 - k * 2, 1, k % 2 ? "#a83a24" : "#d8583a");
      F(ctx, x - 12, g - 27, 24, 1, "#6e2214");
      for (const s of [-9, 8]) { F(ctx, x + s - 1, g - 27, 3, 18, OL); F(ctx, x + s, g - 26, 1, 17, "#a87a48"); }
      F(ctx, x - 9, g - 22, 18, 1, "#6e4a28"); F(ctx, x + 9, g - 23, 2, 1, "#4a3424"); F(ctx, x + 10, g - 23, 1, 3, "#4a3424");
      F(ctx, x - 1, g - 21, 1, 6, "#4a3424"); F(ctx, x - 2, g - 15, 3, 3, OL); F(ctx, x - 1, g - 14, 2, 2, "#b88a4a");
      // the ring: a lit stone lip over the dark water, then two courses of rough stones, rounder at the ends, in the shade on the right
      F(ctx, x - 12, g - 12, 24, 12, OL);
      F(ctx, x - 11, g - 11, 22, 2, "#d8d0bc"); F(ctx, x - 11, g - 11, 22, 1, "#f0e8d4"); F(ctx, x + 6, g - 11, 5, 2, "#b0a894");
      F(ctx, x - 10, g - 9, 20, 2, "#142230"); F(ctx, x - 7, g - 9, 4, 1, "#3a6a8a"); P(ctx, x + 3, g - 9, "#ffe070"); P(ctx, x - 5, g - 8, "#ffe070");
      for (let row = 0; row < 2; row++) for (let k = 0; k < 5; k++) {
        const sx = x - 11 + k * 5 - row * 2 + (row && k === 0 ? 2 : 0), sw = row && k === 0 ? 2 : 4, sy = g - 7 + row * 3, sh = k > 2 ? ["#9a9080", "#7e7566"] : ["#b8ae9a", "#9a9080"];
        if (sx + sw > x + 11) continue;
        F(ctx, sx, sy, sw, 3, sh[1]); F(ctx, sx, sy, sw, 1, sh[0]); P(ctx, sx + sw - 1, sy + 2, "#5e564a");
      }
      F(ctx, x - 11, g - 1, 22, 1, "#5e564a");
      Scenes.kit.frog(ctx, x + 6, g - 13);
      P(ctx, x - 16, g - 1, "#ffe070"); P(ctx, x + 15, g, "#e0a020");
      if (A) actors.push(A.twinkle({ pts: [[x + 3, g - 9], [x - 5, g - 8], [x - 16, g - 1], [x + 15, g]], col: "#ffffff", arm: "#ffe070", seed, z: 9e4, front: true }));
    } },
    // a green-grey evening over the burial field: leaning stones, a crypt on the rise, a mist lying low and lights where no one walks
    graves: { sky: "gloam", draw(o) {
      const { ctx, bg, actors, A, W, hz, ground, seed } = o, b = bg.getContext("2d");
      const cx = R(W * 0.16);
      F(b, cx - 9, hz - 12, 19, 12, "#1a2024"); F(b, cx - 8, hz - 11, 17, 11, "#3a4446"); F(b, cx - 8, hz - 11, 2, 11, "#4e5a5a");
      for (let k = 0; k < 5; k++) F(b, cx - 10 + k, hz - 13 - k, 21 - k * 2, 1, k === 0 ? "#1a2024" : "#2a3234");
      F(b, cx - 2, hz - 7, 4, 7, "#0e1214"); P(b, cx, hz - 18, "#8a9672");
      const tx = R(W * 0.86);
      for (let y = 0; y < 16; y++) F(b, tx, hz - y, 2, 1, "#1e1a18");
      for (const [dx, dy, len] of [[1, 9, 5], [-1, 12, 4], [1, 14, 3], [-1, 6, 3]]) for (let k = 0; k < len; k++) P(b, tx + (dx > 0 ? 2 + k : -1 - k), hz - dy - (k >> 1), "#1e1a18");
      const gv = Art.graveGrid().toCanvas(1);
      for (const [fx, dy] of [[0.24, 2], [0.36, 0], [0.47, 3], [0.82, 1]]) ctx.drawImage(gv, R(W * fx), ground - 16 + dy);
      standard(ctx, R(W * 0.64), ground, o.key);
      mistBand(ctx, W, ground - 7, 6, "176,196,170", 0.55, seed % 7);
      if (A) for (let i = 0; i < 3; i++) actors.push(A.wisp({ x: R(W * (0.18 + i * 0.25)), y: hz + 2, w: 18, h: 10, rgb: "150,255,170", col: "#d0ffd8", seed: seed + i }));
    } },
    // half-finished maps blowing across the country on the wind, and one weighed down under a stone with its X
    maps: { draw(o) {
      const { ctx, actors, A, W, H, ground, seed } = o;
      standard(ctx, R(W * 0.68), ground, o.key);
      const mx = R(W * 0.4), my = ground - 2;
      F(ctx, mx - 1, my - 8, 16, 10, OL); F(ctx, mx, my - 7, 14, 8, "#ecdcb0"); F(ctx, mx, my - 7, 14, 1, "#f8ecc8"); F(ctx, mx + 13, my - 7, 1, 8, "#c8b080");
      for (const [px, py] of [[2, -4], [4, -3], [6, -4], [8, -2]]) P(ctx, mx + px, my + py, "#8a5a34");
      P(ctx, mx + 10, my - 3, "#c8302a"); P(ctx, mx + 11, my - 2, "#c8302a"); P(ctx, mx + 11, my - 4, "#c8302a"); P(ctx, mx + 10, my - 1, "#c8302a");
      F(ctx, mx + 2, my - 6, 4, 1, "#6a8ab0"); F(ctx, mx - 2, my - 10, 6, 4, OL); F(ctx, mx - 1, my - 9, 4, 2, "#8a8478"); F(ctx, mx - 1, my - 9, 4, 1, "#a8a296");
      if (!A) return;
      // a sheet tumbling: flat with its lines showing, turned edge-on, and curled
      const SP = { p: "#ecdcb0", q: "#c8b080", l: "#8a5a34", x: "#c8302a" };
      const sheet = [Anim.sprite(["pppppppp", "plplpppp", "pppplxpp", "ppppplpx", "qqqqqqqq"], SP, "#5a4428"), Anim.sprite(["ppp", "plq", "ppq", "pxq", "ppq"], SP, "#5a4428"),
        Anim.sprite(["....pppp", "..ppplpp", "pplplxq.", "pppqq...", "qq......"], SP, "#5a4428")];
      const rr = Anim.rng(seed), fly = [];
      for (let i = 0; i < 5; i++) fly.push([rr() * W, 6 + rr() * (H * 0.45), 0.6 + rr() * 0.6, rr() * 6]);
      actors.push({ z: 9e3, front: true, draw(c, t) {
        fly.forEach(([x0, y0, sp, ph], i) => {
          const x = ((x0 + t * 14 * sp) % (W + 20)) - 10, y = y0 + Math.sin(t * 1.7 + ph) * 3;
          Anim.put(c, sheet[(i + Math.floor(t * 3 + ph)) % 3], x, y);
        });
      } });
    } },
    // a big orange moon coming up over the trees at dusk, with a stag stood on the ridge in front of it
    moon: { kind: "forest", sky: "dusk", draw(o) {
      const { ctx, bg, W, hz, ground } = o, b = bg.getContext("2d");
      const m = o.info.moon || [R(W * 0.76), hz - 14], sx = m[0] - 6, sy = hz - 6;
      const stag = Anim.sprite(["k.k.k.....", ".kkk......", "..k.k.....", "...kk.....", "...kkk....", "....kkkkkk", "....kkkkkk", "....kkkkk.", "....k.k.kk", "....k.k..k"], { k: "#1a1218" }, null);
      for (let dx = -14; dx <= 18; dx++) { const top = sy + R(((dx - 2) / 16) ** 2 * 7); F(b, sx + 4 + dx, top, 1, hz + 3 - top, "#26321f"); if ((dx & 3) === 1) P(b, sx + 4 + dx, top - 1, "#26321f"); }
      b.drawImage(stag, sx, sy - 10);
      standard(ctx, R(W * 0.4), ground, o.key);
    } },
    // rain on the marsh, the road under water, ducks on what used to be a field
    rain: { kind: "marsh", wx: "rain", draw(o) {
      const { ctx, W, ground, hz } = o;
      standard(ctx, R(W * 0.68), ground, o.key);
      for (const [fx, y, w] of [[0.12, ground - 3, 30], [0.36, ground + 2, 40], [0.78, ground + 4, 34]]) {
        const x = R(W * fx);
        F(ctx, x, y, w, 3, "#5a8a9a"); F(ctx, x + 2, y, w - 4, 1, "#8ac0c8"); F(ctx, x - 2, y + 1, 2, 1, "#5a8a9a"); F(ctx, x + w, y + 1, 2, 1, "#5a8a9a");
        for (let k = 3; k < w - 3; k += 7) P(ctx, x + k, y + 1, "#c8e4e8");
      }
      const px = R(W * 0.3);
      F(ctx, px, ground - 14, 1, 14, "#4a3020"); F(ctx, px - 6, ground - 14, 12, 4, OL); F(ctx, px - 5, ground - 13, 10, 2, "#a87a48"); F(ctx, px - 4, ground - 13, 6, 1, "#6a4a28");
      F(ctx, px - 4, ground + 1, 10, 2, "#5a8a9a");
      const duck = Anim.sprite(["...gg", "...gyb", "wwww.", ".ww.."], { g: "#2a6a3a", y: "#1a1220", b: "#e8b84a", w: "#8a7a5a" });
      Anim.put(ctx, duck, R(W * 0.42), ground + 2); Anim.put(ctx, duck, R(W * 0.48), ground + 3, true);
      void hz;
    } },
    // the best harvest in living memory: the stubble gone gold, stooks standing in rows, a laden cart and pumpkins at the gate
    harvest: { kind: "plains", draw(o) {
      const { ctx, bg, W, H, hz, ground } = o, b = bg.getContext("2d");
      const path = o.info.path || ground;
      for (let y = hz + 1; y < path - 1; y++) for (let x = 0; x < W; x++) {
        const band = Math.floor((y - hz) / 3) % 2, fur = (y - hz) % 3 === 2;
        P(b, x, y, fur ? "#a8782c" : band ? "#e0b850" : "#d4a840");
        if (!fur && (x * 5 + y * 3) % 13 === 0) P(b, x, y, "#f0d27a");
      }
      // stooks: sheaves stood up together in a little tent, ears at the top, lit on the left, a dark gap at the foot
      for (let i = 0; i < 6; i++) {
        const sx = R(W * (0.05 + i * 0.16)), sy = hz + 7 + (i % 2) * 4;
        for (let k = 0; k < 9; k++) {
          const hw = Math.min(3, k >> 1), y = sy - 9 + k;
          F(b, sx - hw - 1, y, hw * 2 + 3, 1, "#5a3c10");
          F(b, sx - hw, y, hw * 2 + 1, 1, k < 3 ? "#f8e08a" : "#d8a840"); P(b, sx - hw, y, k < 3 ? "#fff0b0" : "#f0c860"); P(b, sx + hw, y, "#a87a28");
        }
        P(b, sx - 1, sy - 10, "#f8e08a"); P(b, sx + 1, sy - 10, "#f8e08a"); F(b, sx, sy - 2, 1, 2, "#5a3c10");
      }
      for (let y = path + 5; y < H; y++) for (let x = 0; x < W; x++) if ((x + y) % 5 === 0 && (x * 3 + y) % 7 < 2) P(b, x, y, "#c8a84a");
      standard(ctx, R(W * 0.7), ground, o.key);
      // the hay wain: a heaped dome of hay with loose strands, a plank bed, two spoked wheels and its shafts down on the ground
      const cx = R(W * 0.34), g = ground;
      for (let k = 0; k < 9; k++) { const hw = R(12 * Math.sqrt(1 - ((8 - k) / 9) ** 2)); F(ctx, cx + 11 - hw - 1, g - 17 + k, hw * 2 + 2, 1, OL); F(ctx, cx + 11 - hw, g - 17 + k, hw * 2, 1, k < 2 ? "#f8e08a" : k < 5 ? "#f0d27a" : "#d8b050"); }
      for (const [hx, hy] of [[4, -14], [9, -16], [15, -13], [6, -11], [18, -11], [12, -12]]) P(ctx, cx + hx, g + hy, "#c8962c");
      P(ctx, cx - 1, g - 10, "#f0d27a"); P(ctx, cx + 23, g - 11, "#f0d27a");
      F(ctx, cx - 1, g - 9, 25, 4, OL); F(ctx, cx, g - 8, 23, 2, "#8a5a34"); F(ctx, cx, g - 8, 23, 1, "#b88450");
      for (const wx of [cx + 5, cx + 18]) {
        F(ctx, wx - 3, g - 6, 7, 7, OL); F(ctx, wx - 2, g - 5, 5, 5, "#7a4a28"); F(ctx, wx - 1, g - 4, 3, 3, "#3a2414");
        P(ctx, wx, g - 3, "#b88450"); P(ctx, wx, g - 5, "#b88450"); P(ctx, wx, g - 1, "#b88450"); P(ctx, wx - 2, g - 3, "#b88450"); P(ctx, wx + 2, g - 3, "#b88450");
      }
      for (let k = 0; k < 8; k++) P(ctx, cx + 23 + k, g - 6 + (k >> 1), "#5a3a20");
      for (const [px, py] of [[R(W * 0.6), g], [R(W * 0.6) + 6, g + 1], [R(W * 0.82), g + 1]]) { F(ctx, px - 1, py - 4, 6, 5, OL); F(ctx, px, py - 3, 4, 3, "#e8862a"); F(ctx, px + 1, py - 3, 1, 3, "#c86a1a"); F(ctx, px, py - 3, 4, 1, "#f8a84a"); P(ctx, px + 2, py - 5, "#3a6a2a"); }
    } },
    // bunting strung across the street, a little stage, and the notes going up off it
    stage: { kind: "town", draw(o) {
      const { ctx, actors, A, W, ground, seed } = o;
      const y0 = 10, cols = ["#c8402e", "#e8b84a", "#3e5ab0", "#5a9a3a", "#efe2bf"];
      for (let x = 0; x < W; x++) { const y = y0 + R(5 * Math.sin((x / W) * Math.PI * 2) ** 2); P(ctx, x, y, "#4a3020"); if (x % 6 === 2) { const c = cols[(x / 6 | 0) % cols.length]; F(ctx, x, y + 1, 3, 1, c); P(ctx, x + 1, y + 2, c); P(ctx, x + 1, y + 3, OL); P(ctx, x - 1, y + 1, OL); P(ctx, x + 3, y + 1, OL); P(ctx, x, y + 2, OL); P(ctx, x + 2, y + 2, OL); } }
      const sx = R(W * 0.38), g = ground;
      F(ctx, sx - 1, g - 7, 34, 7, OL); F(ctx, sx, g - 6, 32, 2, "#b88450"); F(ctx, sx, g - 4, 32, 4, "#7a4a28");
      for (let k = 2; k < 32; k += 5) F(ctx, sx + k, g - 4, 1, 4, "#5a3418");
      for (const px of [sx + 1, sx + 30]) { F(ctx, px - 1, g - 26, 3, 20, OL); F(ctx, px, g - 25, 1, 19, "#8a5e34"); }
      F(ctx, sx - 2, g - 29, 36, 5, OL);
      for (let k = 0; k < 34; k++) F(ctx, sx - 1 + k, g - 28, 1, 3, (k >> 2) % 2 ? "#efe2bf" : "#c8402e");
      for (let k = 0; k < 34; k += 4) P(ctx, sx - 1 + k + 1, g - 25, (k >> 2) % 2 ? "#d4bf94" : "#8a2a20");
      const lute = Anim.sprite(["....kk", "...k..", "..k...", "bbb...", "bobb..", "bbb..."], { k: "#5a3418", b: "#d8904a", o: "#3a2010" });
      Anim.put(ctx, lute, sx + 16, g - 7);
      standard(ctx, R(W * 0.8), ground, o.key);
      if (!A) return;
      const note = [Anim.sprite(["..kk", "..k.", "..k.", "kkk.", "kk.."], { k: "#2a1a10" }, null), Anim.sprite(["kkkk", "k..k", "k..k", "k.kk", "kkk."], { k: "#2a1a10" }, null)];
      actors.push({ z: 9e3, front: true, draw(c, t) {
        for (let i = 0; i < 3; i++) {
          const a = ((t / 3.2 + i / 3) % 1 + 1) % 1, x = sx + 14 + i * 4 + Math.sin(t * 2 + i) * 3, y = g - 12 - a * 24;
          if (a < 0.85) Anim.put(c, note[(i + (seed & 1)) % 2], x, y);
        }
      } });
    } },
    // a caravan rolling along the road under the Gilded Scale's pennant
    wagons: { kind: "plains", draw(o) {
      const { ctx, actors, A, W, ground, seed } = o;
      standard(ctx, R(W * 0.18), ground, o.key);
      const y = (o.info.path || ground) + 3;
      // a covered wagon of the Scale's, gilt along its bed, drawn by one horse (two frames of the walk)
      const pal = { w: "#f0e6cc", s: "#c8bca0", g: "#e8b84a", b: "#7a4a28", d: "#4a2c18", o: "#3a2414", k: "#b88450", h: "#8a5a34", m: "#3a2414" };
      const top = ["....wwwwwwwwwww.........", "..wwwwwwwwwwwwwww........", ".wwswwwwswwwwswwww.......", ".wwswwwwswwwwswwww...mh..",
        ".wwswwwwswwwwswwww..mhhh.", ".gggggggggggggggg..mhhhhk", ".bbbbbbbbbbbbbbbbbhhhhh..", ".dddbbbbbbbbbdddbhhhhhh.."];
      const fr = [Anim.sprite(top.concat(["..ooo......ooo...hh..hh..", ".o.k.o....o.k.o..h....h..", "..ooo......ooo...h....h.."]), pal),
        Anim.sprite(top.concat(["..ooo......ooo....hhhh...", ".o.k.o....o.k.o...h..h...", "..ooo......ooo...h....h.."]), pal)];
      const draw = (c, t) => {
        for (let i = 0; i < 3; i++) {
          const x = ((t * 5 + seed % 50 + i * 32) % (W + 110)) - 40;
          Anim.put(c, fr[Math.floor(t * 4 + i) % 2], x, y + (i % 2));
        }
      };
      if (A) actors.push({ z: y, draw }); else draw(ctx, 2);
    } },
    // the tournament's pavilions on the far side of the lists, pennants flying, and the barrier down the middle
    lists: { kind: "plains", draw(o) {
      const { ctx, bg, actors, A, W, hz } = o, b = bg.getContext("2d");
      const tents = [[0.14, "#c8402e"], [0.32, "#3e5ab0"], [0.52, "#e8b84a"], [0.86, "#5a9a3a"]];
      for (const [fx, col] of tents) {
        const tx = R(W * fx), g = hz + 6;
        for (let k = 0; k < 7; k++) F(b, tx - 1 - k, g - 13 + k, 3 + k * 2, 1, OL);
        for (let k = 0; k < 6; k++) for (let x = -k; x <= k; x++) P(b, tx + x, g - 12 + k, ((x + 9) >> 1) % 2 ? "#efe2bf" : col);
        F(b, tx - 8, g - 6, 17, 7, OL);
        for (let x = -7; x <= 7; x++) F(b, tx + x, g - 6, 1, 6, ((x + 9) >> 1) % 2 ? "#e2d4ae" : col);
        F(b, tx - 1, g - 4, 3, 4, "#2a1a14"); F(b, tx - 7, g - 6, 15, 1, OL);
        F(b, tx, g - 17, 1, 4, "#4a3020");
        if (A) actors.push(A.flag({ x: tx, y: g - 13, h: 4, c1: col, c2: "#efe2bf", seed: tx }));
      }
      const fy = hz + 10;
      F(ctx, 0, fy, W, 1, "#5a3a20"); F(ctx, 0, fy + 1, W, 1, "#c8402e");
      for (let x = 2; x < W; x += 12) F(ctx, x, fy, 1, 5, "#5a3a20");
      standard(ctx, R(W * 0.68), o.ground, o.key);
    } },
    // the Lord Justice's writ nailed to a post at the gate, red seal and all, with a watchman stood by it
    writ: { kind: "town", draw(o) {
      const { ctx, W, ground } = o;
      const x = R(W * 0.42), g = ground;
      F(ctx, x - 1, g - 26, 3, 26, OL); F(ctx, x, g - 25, 1, 25, "#6a4428");
      F(ctx, x - 8, g - 25, 17, 14, OL); F(ctx, x - 7, g - 24, 15, 12, "#f2e6c4"); F(ctx, x - 7, g - 24, 15, 1, "#fff6dc"); F(ctx, x + 7, g - 24, 1, 12, "#d4bf94");
      for (let k = 0; k < 4; k++) F(ctx, x - 5, g - 21 + k * 2, k === 3 ? 6 : 11, 1, "#6a5a4a");
      F(ctx, x + 2, g - 15, 3, 3, "#c8302a"); P(ctx, x + 2, g - 15, "#e8584a"); P(ctx, x + 3, g - 12, "#8a1e18"); P(ctx, x + 4, g - 11, "#8a1e18");
      P(ctx, x - 6, g - 23, "#3a3440"); P(ctx, x + 6, g - 23, "#3a3440");
      const watch = Anim.sprite([".hh.", "hhhh", ".ss.", "bbbb", "bsbb", "bbbb", "l.l.", "l.l."], { h: "#7a8290", s: "#e0b088", b: "#2e4a6e", l: "#2a2a34" });
      Anim.put(ctx, watch, x + 16, g);
      F(ctx, x + 19, g - 18, 1, 18, "#5a3a20"); F(ctx, x + 18, g - 21, 3, 3, "#c8ccd4"); P(ctx, x + 19, g - 22, "#e8ecf2");
      standard(ctx, R(W * 0.7), ground, o.key);
    } },
    // the animals of the field gathered round to say their piece, one of them mid-sentence
    beasts: { kind: "plains", draw(o) {
      const { ctx, actors, A, W, ground, seed } = o;
      Scenes.kit.sheep(ctx, R(W * 0.36), ground, false); Scenes.kit.sheep(ctx, R(W * 0.47), ground + 2, true);
      const cow = Anim.sprite(["k.......", "kkwwkwww", "wwwwwwkw", ".wwkwwww", ".k.k..k."], { k: "#2a2420", w: "#f0ece0" });
      Anim.put(ctx, cow, R(W * 0.27), ground + 1);
      const bx = R(W * 0.43), by = ground - 21;
      F(ctx, bx - 1, by - 1, 15, 9, OL); F(ctx, bx, by, 13, 7, "#ffffff"); F(ctx, bx, by + 6, 13, 1, "#d8d4cc");
      F(ctx, bx + 3, by + 8, 2, 1, OL); P(ctx, bx + 2, by + 9, OL); F(ctx, bx + 3, by + 7, 2, 1, "#ffffff");
      for (let k = 0; k < 3; k++) P(ctx, bx + 3 + k * 3, by + 3, OL);
      standard(ctx, R(W * 0.68), ground, o.key);
      if (A) actors.push(A.cat({ x: R(W * 0.56), y: ground + 2, range: 8, seed }), A.rabbit({ x: R(W * 0.12), y: ground + 4, range: 14, seed: seed + 1 }));
    } },
    // Goblin Town itself, its own header (the crowned gate, the charter, the stalls, the Throne Wagon, goblins in hats); without the place
    // headers loaded, the camp's tents with the king's crown flying over them
    goblins: { kind: "goblin", frame: "goblin_town", draw(o) {
      const { ctx, W, ground } = o;
      if (o.framed) return;
      const x = R(W * 0.64), top = ground - 32;
      F(ctx, x - 1, top - 1, 3, 33, OL); F(ctx, x, top, 1, 32, "#5a3a20");
      F(ctx, x + 1, top, 14, 9, OL); F(ctx, x + 2, top + 1, 12, 7, "#5a8a3a"); F(ctx, x + 2, top + 1, 12, 1, "#7aaa4a");
      const crown = [[3, 5, 1, 2], [5, 4, 1, 3], [7, 5, 1, 2], [9, 4, 1, 3], [11, 5, 1, 2]];
      F(ctx, x + 4, top + 5, 7, 2, "#e8b84a"); for (const [cx, cy, w, h] of crown) F(ctx, x + cx, top + cy - 1, w, h, "#e8b84a"); P(ctx, x + 7, top + 5, "#c8302a");
      for (let k = 0; k < 3; k++) { F(ctx, x + 14 + k, top + 1 + k, 1, 7 - k * 2, OL); }
    } },
    // the hills full of prospectors' claims: a mine mouth with a cart on its rails, a sluice by the stream, and the glint in the pan
    // gold in the hills: a mine mouth with a loaded cart on its rails, claim stakes flagged up the slopes, and down at the stream a
    // prospector crouched over a pan with something winking in it
    gold: { kind: "hills", draw(o) {
      const { ctx, bg, actors, A, W, hz, ground, seed } = o, b = bg.getContext("2d");
      const mx = R(W * 0.18), my = hz + 3;
      F(b, mx - 9, my - 12, 19, 13, "#5a4a32"); F(b, mx - 9, my - 12, 19, 1, "#7a6a4a");
      F(b, mx - 5, my - 9, 10, 10, "#140e0a"); F(b, mx - 6, my - 10, 2, 11, "#8a5a30"); F(b, mx + 4, my - 10, 2, 11, "#6a4220"); F(b, mx - 7, my - 11, 14, 2, "#a8743e"); F(b, mx - 7, my - 11, 14, 1, "#c89458");
      for (let x = mx + 5; x < mx + 38; x++) { const y = my + 1 + ((x - mx) >> 3); P(b, x, y, "#4a3a2a"); if (x % 3 === 0) P(b, x, y + 1, "#7a5a3a"); }
      const cx = mx + 18, cy = my + 4;
      F(b, cx - 1, cy - 6, 10, 6, OL); F(b, cx, cy - 5, 8, 4, "#6a6a72"); F(b, cx, cy - 5, 8, 1, "#8a8a92");
      F(b, cx + 1, cy - 7, 6, 2, "#8a6a4a"); P(b, cx + 2, cy - 7, "#ffd23a"); P(b, cx + 5, cy - 7, "#ffd23a"); P(b, cx + 3, cy - 8, "#fff6b0");
      P(b, cx + 1, cy, OL); P(b, cx + 6, cy, OL);
      for (const [fx, dy, col] of [[0.4, 4, "#c8402e"], [0.5, 1, "#e8b84a"], [0.84, 3, "#3e5ab0"], [0.94, 6, "#c8402e"]]) {
        const sx = R(W * fx), sy = hz + dy;
        F(b, sx, sy - 6, 1, 6, "#4a3020"); F(b, sx + 1, sy - 6, 3, 2, col); P(b, sx + 1, sy - 5, OL);
      }
      // a creek winding down out of the hills, and the panner stood in it up to the ankles
      const px = R(W * 0.46), g = ground + 2;
      for (let y = hz + 6; y < o.H; y++) {
        const cxw = px + 6 + R(Math.sin(y / 5) * 3 + (y - hz) * 0.6), w = 3 + R((y - hz) / 6);
        F(b, cxw - w, y, w * 2, 1, "#4a8ab8"); P(b, cxw - w, y, "#8ac0e0"); P(b, cxw + w - 1, y, "#2e6a98");
        if (y % 3 === 0) P(b, cxw - 1 + (y % 2), y, "#a8d4ec");
      }
      standard(ctx, R(W * 0.7), ground, o.key);
      const pros = Anim.sprite(["...aa...", "..aaaa..", ".aaaaaa.", "...ss...", "..cccc..", ".cccccss", "..cccc..", "..pppp..", "..p..p..", "..f..f.."],
        { a: "#7a5a3a", s: "#e0b088", c: "#8a3a2a", p: "#4a4a5a", f: "#2a1e1a" });
      Anim.put(ctx, pros, px, g);
      F(ctx, px + 4, g - 6, 7, 3, OL); F(ctx, px + 5, g - 6, 5, 1, "#b8b8c4"); F(ctx, px + 5, g - 5, 5, 1, "#7a7a86"); P(ctx, px + 7, g - 6, "#ffd23a");
      if (A) actors.push(A.twinkle({ pts: [[px + 7, g - 7], [cx + 3, cy - 9], [px + 8, g - 7]], col: "#ffffff", arm: "#ffd23a", seed, z: 9e4, front: true }));
    } },
  };

  // ---------- the Long Night's sunrise: first light over the town, the street full of people with their faces turned up to it ----------
  const SUNRISE = { sky: "dawn", frame: true, draw(o) {
    const { ctx, W, ground, seed, hs, startX } = o, r = Anim.rng(seed + 5);
    const busy = new Set();
    hs.forEach((_, i) => { for (let x = startX + i * 30 - 2; x < startX + i * 30 + 30; x++) busy.add(x); });
    for (let x = 6; x < W - 6; x += 6 + Math.floor(r() * 4)) {
      if (busy.has(x) || busy.has(x + 3)) continue;
      const back = r() < 0.5;
      folk(ctx, x, ground - (back ? 4 : 1), r, { up: true, cheer: r() < 0.25, shadow: 7 });
    }
    // the heroes' own long shadows, thrown back to the left by a sun just over the roofs on the right
    hs.forEach((_, i) => { const x = startX + i * 30 + 12; for (let k = 2; k < 22; k++) if (k % 5 !== 4) F(ctx, x - k, ground, 1, 1, "rgba(40,20,30,0.4)"); });
  } };

  // which set piece an event has: a season's first day takes its theme's poster (`poster` on its THEMES row, through theme_signs); the
  // last shard home takes the sunrise
  function of(e) {
    const S = App.S, T = S.theme_signs || {};
    if (e.sunrise) return SUNRISE;
    if (e.kind !== "season_start") return null;
    const row = T[e.theme] || Object.values(T).find((t) => e.text && e.text.indexOf(": " + t.name + ".") > 0);
    const p = row && POSTERS[row.poster];
    return p ? Object.assign({ key: row.emblem }, p) : null;
  }
  window.Posters = { of, POSTERS, SUNRISE, standard, folk, mistBand };
})();
