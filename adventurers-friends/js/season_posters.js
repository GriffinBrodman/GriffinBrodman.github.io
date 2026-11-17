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

    // ---- the god themes (gods on only) ----
    // The Visitor: dusk at a cottage door, the top half open on the lit kitchen, and a small stranger in a red shawl knocking for supper
    visitor: { kind: "town", sky: "dusk", draw(o) {
      const { ctx, actors, A, W, ground, seed } = o, g = ground;
      const x = R(W * 0.4);
      cottage(ctx, x, g);
      const pell = Anim.sprite(["..h..", ".hhh.", ".sgs.", "rrrrr", "rRrrr", "rRrrb", ".rrr.", ".ddd.", ".ddd.", ".f.f."],
        { h: "#d8d4cc", s: "#e8b48a", g: "#7a6a5a", r: "#c8402e", R: "#e86a4a", b: "#c8b48a", d: "#5a4434", f: "#2a1e1a" });
      Anim.put(ctx, pell, x + 17, g, true);
      F(ctx, x + 14, g - 6, 3, 1, "#c8a060"); P(ctx, x + 13, g - 7, "#c8a060");
      standard(ctx, R(W * 0.64), g, o.key);
      if (A) actors.push(A.smoke({ x: x + 24, y: g - 30, seed, rise: 16, col: "#c8b8b0" }), A.smoke({ x: x + 13, y: g - 9, seed: seed + 3, n: 3, rise: 7, col: "#fff4e8", wind: 1 }),
        A.glow({ x: x + 6, y: g - 11, r: 16, rgb: "255,180,110", seed, front: true }));
    } },
    // The Quarrel of Salt and Iron: a squall over the Saltmarrow breakwater, the sea throwing itself at the salt-crusted wall, and an
    // iron ship rusting at its moorings in the lee of it, one plate of its hull welded back on with a seam that is still molten
    quarrel: { kind: "coast", sky: "gloam", draw(o) {
      const { ctx, actors, A, W, H, hz, ground, seed } = o, b = bgc(o), r = Anim.rng(seed + 11);
      // the sea right up to the frame, grey-green and chopped white
      for (let y = hz; y < H; y++) {
        const t = (y - hz) / (H - hz);
        F(b, 0, y, W, 1, t < 0.3 ? "#3a6a70" : t < 0.6 ? "#2e5a62" : "#264a52");
        for (let x = (y * 7) % 11; x < W; x += 11 + (y % 5)) F(b, x, y, 2 + (y % 3), 1, y % 3 ? "#4a8288" : "#c8e4e4");
      }
      // the breakwater: salt-crusted stone from the seaward end to a bollard
      const x0 = R(W * 0.1), x1 = R(W * 0.5), top = ground - 10;
      F(ctx, x0 - 1, top - 1, x1 - x0 + 2, ground - top + 3, OL);
      for (let x = x0; x < x1; x++) {
        F(ctx, x, top, 1, ground - top + 2, (x >> 2) % 3 ? "#8a8478" : "#7e786c");
        if ((x * 7) % 5 === 0) P(ctx, x, top + 1 + (x % 3), "#f4fbfa");
        if (x % 6 === 0) F(ctx, x, top + 2, 1, ground - top, "#6a645a");
        if ((x * 3) % 7 === 0) P(ctx, x, ground + 1, "#f4fbfa");
      }
      F(ctx, x0, top, x1 - x0, 1, "#c8c0b0");
      const bx = x1 - 4;
      F(ctx, bx - 1, top - 4, 4, 4, OL); F(ctx, bx, top - 3, 2, 3, "#4a4e56"); P(ctx, bx, top - 3, "#7a808a");
      // the ship: an iron hull, low at the stern by the wall and lifting to the bow, riveted plates weeping rust
      const sx0 = R(W * 0.56), sx1 = R(W * 0.84), wl = ground + 2, L = sx1 - sx0, mid = sx0 + R(L * 0.42);
      const deck = (x) => { const t = (x - sx0) / L; return wl - 14 - R(t > 0.78 ? ((t - 0.78) / 0.22) ** 2 * 9 : 0) + R(t < 0.06 ? (0.06 - t) * 30 : 0); };
      const keel = (x) => { const t = (x - sx0) / L; return wl + 2 - R(t > 0.82 ? ((t - 0.82) / 0.18) * 9 : 0); };
      const mast = sx0 + R(L * 0.48), mt = deck(mast) - 30;
      F(ctx, mast - 1, mt - 1, 4, deck(mast) - mt + 1, OL); F(ctx, mast, mt, 2, deck(mast) - mt, "#5a3a20"); F(ctx, mast, mt, 1, deck(mast) - mt, "#8a5e34");
      const yw = R(L * 0.24);
      F(ctx, mast - yw - 1, mt + 4, yw * 2 + 4, 4, OL); F(ctx, mast - yw, mt + 5, yw * 2 + 2, 1, "#5a3a20"); F(ctx, mast - yw + 1, mt + 6, yw * 2, 1, "#b8ac90");
      for (let k = 0; k < yw * 2; k += 4) P(ctx, mast - yw + 1 + k, mt + 6, "#8a7e66");
      for (const [ex, ey] of [[sx0 + 2, deck(sx0 + 2)], [sx1 - 1, deck(sx1 - 1)]]) {
        const n = Math.max(Math.abs(ex - mast), Math.abs(ey - mt));
        for (let k = 2; k < n; k += 1) if (k % 2) P(ctx, R(mast + ((ex - mast) * k) / n), R(mt + ((ey - mt) * k) / n), "#2a2230");
      }
      const hx0 = sx0 + R(L * 0.16), hw = R(L * 0.16);
      F(ctx, hx0 - 1, deck(hx0) - 6, hw + 2, 7, OL); F(ctx, hx0, deck(hx0) - 5, hw, 5, "#4e535c"); F(ctx, hx0, deck(hx0) - 5, hw, 1, "#7a808a");
      P(ctx, hx0 + 2, deck(hx0) - 3, "#ffd080"); P(ctx, hx0 + hw - 3, deck(hx0) - 3, "#1a1a22");
      for (let x = sx0; x < sx1; x++) {
        const d = deck(x), k = keel(x);
        F(ctx, x, d - 1, 1, k - d + 2, OL);
      }
      F(ctx, sx0 - 1, deck(sx0) - 1, 1, keel(sx0) - deck(sx0) + 2, OL); F(ctx, sx1, deck(sx1 - 1), 1, keel(sx1 - 1) - deck(sx1 - 1) + 1, OL);
      const plate = (x) => ((x - sx0) / 7) | 0;
      for (let x = sx0; x < sx1 - 1; x++) {
        const d = deck(x) + 1, k = keel(x) - 1;
        for (let y = d; y <= k; y++) {
          const u = (y - d) / Math.max(1, k - d), shade = plate(x) % 2 ? 0 : 1;
          const bloom = Math.sin(x * 0.37 + seed) + Math.sin(y * 0.9 + x * 0.11) > 1.1;
          P(ctx, x, y, y >= wl - 1 ? "#2e2a2a" : bloom ? (u < 0.4 ? "#a8582a" : "#7e3e1e") : u < 0.18 ? (shade ? "#8a8a90" : "#7a7a80") : u < 0.6 ? (shade ? "#625c5c" : "#5a5454") : "#4a4446");
        }
        P(ctx, x, d, "#a8b0b8");
        if ((x - sx0) % 7 === 0) for (let y = d + 1; y < wl - 1; y++) P(ctx, x, y, "#3a3e46");
        if ((x - sx0) % 7 === 3) {
          P(ctx, x, d + 2, "#b8c0c6");
          const run = 2 + ((x * 13 + seed) % 6);
          for (let j = 1; j <= run && d + 2 + j < wl - 1; j++) P(ctx, x + (j > 3 ? 1 : 0), d + 2 + j, j < 3 ? "#c86a2a" : "#8a4220");
        }
        if (r() < 0.1) P(ctx, x, d + 4 + ((x * 7) % 4), "#a85a2a");
        if (x % 3 === 0) P(ctx, x, wl - 2, "#e4f4f8");
      }
      for (let k = 0; k < L * 0.18; k++) {
        const x = sx0 + R(L * 0.62) + ((k * 5) % R(L * 0.16)), y = deck(x) + 4 + ((k * 3) % 5);
        if (y < wl - 2) P(ctx, x, y, k % 3 ? "#9a4e22" : "#c86a2a");
      }
      // the mended plate: a molten seam across the hull where it was welded back on
      for (let y = deck(mid) + 1; y < wl - 1; y++) P(ctx, mid + ((y >> 1) % 2), y, y % 2 ? "#f07c0c" : "#ffd080");
      for (let x = mid - 5; x <= mid; x++) P(ctx, x, deck(x) + 1, x % 2 ? "#f07c0c" : "#ffd080");
      // the mooring line from the stern to the bollard, sagging
      const rx0 = sx0, ry0 = deck(sx0) + 1, rx1 = bx + 1, ry1 = top - 3;
      for (let k = 0; k <= 24; k++) {
        const t = k / 24, x = R(rx0 + (rx1 - rx0) * t), y = R(ry0 + (ry1 - ry0) * t + Math.sin(t * Math.PI) * 4);
        P(ctx, x, y, "#c8a870"); P(ctx, x, y + 1, OL);
      }
      if (A) actors.push(A.glow({ x: mid, y: wl - 6, r: 10, rgb: "240,124,12", a: 0.2, seed, front: true }));
      // the sea breaking on the seaward end: a tall burst of white water leaning back off the wall, teal in its folds, spray above it
      const sx = x0 - 1;
      for (let j = 0; j < 18; j++) {
        const w = R(8 * Math.sin(((j + 3) / 22) * Math.PI)), lean = R(j * 0.35);
        for (let i = -w; i <= w; i++) if (j < 9 || (i * 3 + j * 5) % 7 < 5) P(ctx, sx + i - lean, ground + 2 - j, (i + j) % 4 ? "#f4fbfa" : "#7ad8cc");
      }
      for (const [dx, dy] of [[-9, -19], [-5, -22], [-1, -20], [3, -18], [-12, -15], [5, -14], [-7, -24]]) P(ctx, sx + dx, ground + dy, "#e4f4f8");
      standard(ctx, R(W * 0.3), top, o.key);
      if (A) actors.push(A.waves({ x0: 0, x1: W, y: hz + 6, h: H - hz - 8, seed, col: "#e4f4f8" }), A.rain({ W: R(W * 0.5), H: ground, n: 26, seed }),
        A.gull({ W, y: 10, seed }));
    } },
    // The Coin Is Missing: the Carrbridge toll-box shut, the barrier left up, IOUs pinned all over it, and the stool where the clerk sits empty
    coin_hunt: { kind: "town", draw(o) {
      const { ctx, actors, A, W, ground, seed, r } = o, g = ground;
      const x = R(W * 0.42);
      F(ctx, x - 1, g - 21, 18, 22, OL); F(ctx, x, g - 20, 16, 20, "#8a5e34"); F(ctx, x, g - 20, 16, 1, "#b88450");
      for (let k = 2; k < 16; k += 4) F(ctx, x + k, g - 19, 1, 19, "#6a4428");
      for (let k = 0; k < 7; k++) { F(ctx, x - 3 + k, g - 21 - k, 22 - k * 2, 1, OL); F(ctx, x - 2 + k, g - 21 - k, 20 - k * 2, 1, k % 2 ? "#3a7a4a" : "#4fae6a"); }
      F(ctx, x + 7, g - 30, 2, 3, "#4a3020"); F(ctx, x + 5, g - 33, 6, 4, OL); F(ctx, x + 6, g - 32, 4, 2, "#c89020"); P(ctx, x + 6, g - 32, "#ffd23a");
      F(ctx, x + 2, g - 16, 12, 8, OL); F(ctx, x + 3, g - 15, 10, 6, "#6a4428");
      for (let k = 0; k < 6; k += 2) F(ctx, x + 3, g - 15 + k, 10, 1, "#8a5e34");
      F(ctx, x + 1, g - 9, 14, 1, "#c8a060");
      for (const [dx, dy] of [[1, -19], [11, -19], [4, -13], [9, -14], [2, -6], [10, -5], [6, -4]]) {
        F(ctx, x + dx - 1, g + dy - 1, 5, 6, OL); F(ctx, x + dx, g + dy, 3, 4, "#f4ecd8"); P(ctx, x + dx + 1, g + dy + 2, "#6a5a4a"); P(ctx, x + dx + 1, g + dy, "#c8302a");
      }
      const bx = x + 17;
      F(ctx, bx, g - 7, 2, 7, "#4a3020");
      for (let k = 0; k < 22; k++) P(ctx, bx + 1 + k, g - 7 - R(k * 0.75), (k >> 2) % 2 ? "#f4f0e6" : "#c8302a");
      const sx = x - 6;
      F(ctx, sx - 2, g - 5, 5, 1, "#a87a48"); P(ctx, sx - 2, g - 4, "#6a4428"); P(ctx, sx + 2, g - 4, "#6a4428"); P(ctx, sx - 2, g - 3, "#6a4428"); P(ctx, sx + 2, g - 3, "#6a4428");
      const coins = [[x - 12, g + 2], [x + 30, g + 3], [x + 4, g + 4]];
      for (const [cx, cy] of coins) { F(ctx, cx, cy, 2, 1, "#ffd23a"); P(ctx, cx + 1, cy, "#c89020"); }
      for (let i = 0; i < 2; i++) folk(ctx, R(W * 0.18) + i * 10, g - (i % 2), r, { lamp: i === 0, left: false });
      standard(ctx, R(W * 0.8), g, o.key);
      if (A) actors.push(A.twinkle({ pts: coins.map(([cx, cy]) => [cx, cy]).concat([[x + 8, g - 12]]), col: "#ffffff", arm: "#ffd23a", seed, z: 9e4, front: true }));
    } },
    // The Long Supper: the whole street laid as one table at dusk, lanterns strung over it, the town sat down to it in paper party hats
    long_supper: { kind: "town", sky: "dusk", draw(o) {
      const { ctx, actors, A, W, ground, seed, r } = o, g = ground;
      const x0 = R(W * 0.08), x1 = R(W * 0.72), ty = g - 6;
      for (let x = x0 + 2; x < x1 - 2; x += 7 + R(r() * 3)) {
        const shirt = SH[Math.floor(r() * SH.length)], skin = SK[Math.floor(r() * SK.length)], hair = HAIRS[Math.floor(r() * HAIRS.length)];
        F(ctx, x - 1, ty - 7, 5, 8, OL); F(ctx, x, ty - 3, 3, 3, shirt); F(ctx, x, ty - 6, 3, 3, skin); F(ctx, x, ty - 6, 3, 1, hair);
        if (r() < 0.45) { P(ctx, x + 1, ty - 9, "#f0609e"); F(ctx, x, ty - 8, 3, 1, "#f0609e"); P(ctx, x + 2, ty - 8, "#b83a72"); P(ctx, x + 1, ty - 10, "#ffe070"); }
      }
      F(ctx, x0 - 1, ty - 1, x1 - x0 + 2, 4, OL); F(ctx, x0, ty, x1 - x0, 2, "#f4ecd8"); F(ctx, x0, ty + 2, x1 - x0, 1, "#c8b48a");
      for (let x = x0; x < x1; x += 4) P(ctx, x, ty + 2, "#e8d8b8");
      for (const lx of [x0 + 2, x1 - 3]) { F(ctx, lx, ty + 3, 1, g - ty - 2, "#5a3a1a"); }
      const flames = [];
      for (let x = x0 + 6; x < x1 - 4; x += 16) { F(ctx, x, ty - 3, 1, 3, "#f4ecd8"); flames.push([x, ty - 4]); }
      for (let x = x0 + 11; x < x1 - 4; x += 16) { F(ctx, x - 1, ty - 2, 4, 2, "#d8904a"); P(ctx, x, ty - 2, "#f0b860"); P(ctx, x + 5, ty - 1, "#c8ccd4"); }
      const ly = 9, lamps = [];
      for (let x = 0; x < W; x++) {
        const y = ly + R(4 * Math.sin((x / W) * Math.PI * 3) ** 2);
        P(ctx, x, y, "#2a1a10");
        if (x % 18 === 9) { F(ctx, x - 1, y + 1, 3, 3, x % 36 === 9 ? "#f0609e" : "#ffd27a"); P(ctx, x, y + 4, "#2a1a10"); lamps.push([x, y + 2]); }
      }
      standard(ctx, R(W * 0.82), g, o.key);
      if (A) {
        for (const [fx, fy] of flames) actors.push(A.torch({ x: fx, y: fy, seed: fx, cols: ["#c04a20", "#ff9a3a", "#ffd27a", "#fff4c0"] }));
        for (const [lx, lyy] of lamps) actors.push(A.glow({ x: lx, y: lyy, r: 8, rgb: "255,200,120", a: 0.18, seed: lx, front: true }));
        actors.push(A.embers({ x0: x0, x1: x1, y: ty - 6, n: 10, seed, cols: ["#ffe4f4", "#f0609e", "#ffe070", "#b83a72"], z: 9e3, front: true }));
      }
    } },
    // The Hungry Star Returns: night on a town wall, black stars drawn on it from the inside, and one of the Dawn scrubbing at the nearest
    // by her lamp
    black_star: { kind: "town", sky: true, draw(o) {
      const { ctx, actors, A, W, ground, seed } = o, g = ground;
      const x0 = R(W * 0.12), x1 = R(W * 0.72), top = g - 22;
      F(ctx, x0 - 1, top - 1, x1 - x0 + 2, g - top + 1, OL);
      for (let y = top; y < g; y++) for (let x = x0; x < x1; x++) {
        const row = Math.floor((y - top) / 4), edge = (y - top) % 4 === 3 || (x + row * 4) % 9 === 0;
        P(ctx, x, y, edge ? "#3a3a48" : (x * 3 + y) % 7 === 0 ? "#5e5e70" : "#54546a");
      }
      F(ctx, x0, top, x1 - x0, 1, "#7a7a90");
      const star = (cx, cy, s) => {
        const rows = s ? [".....k.....", "....kkk....", "kkkkkvkkkkk", ".kkkvVvkkk.", "..kkkvkkk..", "..kkk.kkk..", ".kk.....kk."] : ["..k..", "kkvkk", ".kkk.", ".k.k."];
        rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") P(ctx, cx - (row.length >> 1) + i, cy + j, ch === "k" ? "#0e0a14" : ch === "v" ? "#3a1a5a" : "#6a3aa0"); }));
      };
      star(x0 + 22, top + 5, true); star(x0 + 58, top + 9, true); star(x0 + 92, top + 4, false); star(x0 + 112, top + 12, false);
      const sx = x0 + 58;
      const dawn = Anim.sprite([".yy.", "yyyy", ".ss.", "wwww", "wWww", "wwwb", "l.l.", "l.l."], { y: "#e8c050", s: "#e0b088", w: "#efe2c0", W: "#f5cc2e", b: "#c8b48a", l: "#4a3a2a" });
      Anim.put(ctx, dawn, sx + 10, g);
      F(ctx, sx + 6, g - 10, 3, 2, "#c8a060"); P(ctx, sx + 5, g - 9, "#f4f0e6");
      F(ctx, sx + 14, g - 4, 4, 4, OL); F(ctx, sx + 15, g - 3, 2, 3, "#8a8478"); P(ctx, sx + 15, g - 3, "#a8d4ec");
      for (const [dx, dy] of [[-1, 12], [1, 13], [-3, 11]]) P(ctx, sx + dx, top + dy, "#9aa0b4");
      const lx = sx + 22;
      F(ctx, lx, g - 16, 1, 16, "#2a1c14"); F(ctx, lx - 1, g - 19, 3, 3, "#2a1c14"); P(ctx, lx, g - 18, "#ffd27a");
      standard(ctx, R(W * 0.84), g, o.key);
      if (A) actors.push(A.glow({ x: lx, y: g - 18, r: 26, rgb: "255,210,122", a: 0.22, seed, front: true }));
    } },
    // The Ferryman Takes a Holiday: a bright beach, a striped chair turned to the sea, his oar stuck upright in the sand with a straw hat
    // hung on it, and a bucket and spade
    coast: { kind: "coast", life: false, draw(o) {
      const { ctx, bg, actors, A, W, H, hz, ground, seed } = o, g = ground + 2, b = bg.getContext("2d");
      // a summer sea to the sky's edge, a line of surf, then the wet sand and the dry
      const rr = Anim.rng(seed + 31);
      for (let y = hz - 5; y < H; y++) {
        const c = y < hz + 5 ? (y < hz - 1 ? "#3a8ad0" : "#5aaae0") : y === hz + 5 ? "#f4fbfa" : y < hz + 8 ? "#c8b080" : "#ecd8a0";
        F(b, 0, y, W, 1, c);
        if (y < hz + 5) for (let x = (y * 5) % 9; x < W; x += 9 + (y % 4)) F(b, x, y, 3, 1, "#8ac8f0");
        if (y === hz + 6) for (let x = 0; x < W; x += 3) P(b, x, y, "#e4f4f8");
      }
      for (let i = 0; i < 40; i++) P(b, R(rr() * W), hz + 9 + R(rr() * (H - hz - 9)), rr() < 0.5 ? "#d8c08a" : "#fff4d0");
      // the oar, blade up, planted in the sand, with his straw hat hung tilted on the blade
      const ox = R(W * 0.5);
      F(ctx, ox - 1, g - 22, 3, 23, OL); F(ctx, ox, g - 21, 1, 22, "#d8b07a");
      F(ctx, ox - 2, g - 36, 5, 15, OL); F(ctx, ox - 1, g - 35, 3, 13, "#e8c490"); F(ctx, ox + 1, g - 35, 1, 13, "#b88a5a"); F(ctx, ox - 1, g - 26, 3, 2, "#6f9be8"); P(ctx, ox, g - 36, "#e8c490");
      const hat = Anim.sprite(["....sss...", "...sssss..", "...RRRRR..", "SSSSSSSSSS", ".hhhhhhhh."], { S: "#fff0a8", s: "#e8c860", R: "#d8402e", h: "#b8902e" });
      Anim.put(ctx, hat, ox - 1, g - 30);
      F(ctx, ox - 2, g, 5, 1, "rgba(80,60,30,0.35)");
      const chair = Anim.sprite(["..kwb.......", "..kbw.......", "...kwb......", "...kbw......", "....kwb.....", "....kbw.....", ".....kwbwbwk", ".....k.....k", "....k.....k.", "...k.....k.."],
        { k: "#8a5a34", w: "#f4f0e6", b: "#3a6ab8" });
      const cx = R(W * 0.3);
      Anim.put(ctx, chair, cx, g);
      F(ctx, cx - 6, g + 1, 13, 1, "rgba(80,60,30,0.3)");
      const bx = R(W * 0.62);
      F(ctx, bx - 1, g - 5, 6, 6, OL); F(ctx, bx, g - 4, 4, 4, "#d8402e"); F(ctx, bx, g - 4, 4, 1, "#f07050"); F(ctx, bx + 5, g - 9, 1, 9, "#8a5a34"); F(ctx, bx + 4, g - 1, 3, 1, "#c8ccd4");
      standard(ctx, R(W * 0.8), ground, o.key);
      if (A) { actors.push(A.gull({ W, y: 8, seed }), A.gull({ W, y: 15, seed: seed + 1 }), A.crab({ x: R(W * 0.68), y: g + 2, range: 10, seed })); }
    } },
    // The Old God's Funeral: Frosthold's road in the snow, the bier going by on four shoulders under its pall with the one glove on top,
    // blue grave-candles carried behind it, and a stag walking last
    procession: { kind: "snow", draw(o) {
      const { ctx, actors, A, W, H, ground, seed, r } = o, g = ground;
      const bx = R(W * 0.42), flames = [];
      for (let i = 0; i < 4; i++) folk(ctx, bx - 9 + (i % 2) * 18 + (i > 1 ? 2 : 0), g - (i > 1 ? 2 : 0), r, { shirt: i % 2 ? "#2e2a3a" : "#3a3048", left: true });
      F(ctx, bx - 14, g - 7, 30, 1, "#5a3a20");
      F(ctx, bx - 9, g - 13, 22, 7, OL); F(ctx, bx - 8, g - 12, 20, 5, "#4a3e5a"); F(ctx, bx - 8, g - 12, 20, 1, "#6a5a7e"); F(ctx, bx + 9, g - 12, 3, 5, "#2a2236");
      for (let x = bx - 8; x < bx + 12; x += 2) P(ctx, x, g - 7, "#d8b048");
      const glove = Anim.sprite(["W.W.W.", "W.W.W.", "WWWWWW", "WWWWWw", ".wWWw.", ".FFFF."], { W: "#f4f0e6", w: "#c8c0b0", F: "#d8b048" });
      Anim.put(ctx, glove, bx + 2, g - 13);
      for (let i = 0; i < 3; i++) {
        const fx = bx + 22 + i * 9;
        folk(ctx, fx, g - (i % 2), r, { shirt: "#2e2a3a", left: true });
        F(ctx, fx - 3, g - 6, 1, 3, "#c8d4f0"); flames.push([fx - 3, g - 7]);
      }
      const stag = Anim.sprite(["k.k.k.....", ".kkk......", "..k.k.....", "...kk.....", "...kkk....", "....kkkkkk", "....kkkkkk", "....kkkkk.", "....k.k.kk", "....k.k..k"], { k: "#5a4030" }, OL);
      Anim.put(ctx, stag, bx + 56, g, true);
      standard(ctx, R(W * 0.12), g, o.key);
      if (A) {
        for (const [fx, fy] of flames) actors.push(A.torch({ x: fx, y: fy, seed: fx, cols: ["#2a4a9a", "#6f9be8", "#a8c8ff", "#e8f0ff"] }));
        actors.push(A.snow({ W, H, n: 18, seed, speed: 4 }));
      }
    } },
    // The Contest of the Mountain: the Mountain itself standing up behind the hills with its halls lit, and down in front the winners'
    // three-step stand under the gods' pennants
    mountain: { kind: "hills", draw(o) {
      const { ctx, actors, A, W, hz, ground, seed } = o, b = bgc(o);
      // the Mountain: a lopsided peak with a shoulder on its right, snow running down its gullies, crags in the rock, a stair winding up
      // its face with the gods' halls lit at the turns, and the pennant on the summit
      const mx = R(W * 0.58), peak = 7, base = hz + 1, half = 54;
      for (let y = peak; y < base; y++) {
        const t = (y - peak) / (base - peak);
        const lw = R(2 + t * half * 0.85 + Math.sin(y / 4) * 1.5), rw = R(2 + t * half * 1.05 + 9 * Math.exp(-(((t - 0.45) / 0.13) ** 2)) + Math.sin(y / 3.3) * 1.5);
        for (let x = mx - lw; x <= mx + rw; x++) {
          const lit = x < mx - 2 + Math.sin(y / 2) * 2 + t * 6, snow = t < 0.26 + 0.1 * Math.sin(x / 2.3) - (Math.abs(x - mx) > 12 ? 0.06 : 0);
          const crag = (x * 13 + y * 7) % 17 === 0 || (x % 9 === 0 && y % 5 < 3);
          P(b, x, y, snow ? (lit ? "#f4f8ff" : "#c8d4e4") : crag ? (lit ? "#5e6678" : "#454c5c") : lit ? "#7e869a" : "#5e6678");
        }
        P(b, mx - lw - 1, y, "#3a4050"); P(b, mx + rw + 1, y, "#3a4050");
      }
      const turns = [[33, -22], [33, 16], [25, -12], [25, 10], [17, -4], [12, 3]];
      let [py, pxx] = [base - peak - 1, -2];
      turns.forEach(([dy, dx], i) => {
        for (let k = 0; k <= 12; k++) P(b, mx + R(pxx + ((dx - pxx) * k) / 12), peak + R(py + ((dy - py) * k) / 12), "#c8b898");
        [py, pxx] = [dy, dx];
        const hx = mx + dx, hy = peak + dy;
        F(b, hx - 2, hy - 4, 5, 4, "#2a2230"); F(b, hx - 1, hy - 3, 3, 3, "#d8c8a8"); P(b, hx, hy - 2, ["#f5cc2e", "#f3988e", "#f07c0c", "#22b3a6", "#f0609e", "#6f9be8"][i]);
        F(b, hx - 3, hy - 5, 7, 1, "#8a4a2a");
      });
      F(b, mx, peak - 7, 1, 7, "#3a2a1a"); F(b, mx + 1, peak - 7, 5, 2, "#d02a2a"); P(b, mx + 5, peak - 6, "#8a1e1e");
      const px = R(W * 0.36), g = ground;
      const steps = [[-11, 4, "#8a9aa8"], [-4, 8, "#e8b84a"], [3, 6, "#c88a4a"]];
      for (const [dx, h, col] of steps) { F(ctx, px + dx - 1, g - h - 1, 9, h + 1, OL); F(ctx, px + dx, g - h, 7, h, "#efe2c0"); F(ctx, px + dx, g - h, 7, 1, col); }
      P(ctx, px - 1, g - 10, "#4a8a3a"); P(ctx, px + 3, g - 10, "#4a8a3a"); F(ctx, px, g - 11, 3, 1, "#6aaa4a");
      standard(ctx, R(W * 0.8), g, o.key);
      if (A) {
        const fires = ["#f5cc2e", "#f3988e", "#f07c0c", "#22b3a6", "#4fae6a", "#b6e04c", "#d02a2a", "#f0609e", "#9a62d8", "#6f9be8"];
        fires.forEach((c, i) => { if (i % 2 === 0) actors.push(A.flag({ x: R(W * 0.06) + i * 9, y: g - 4 - (i % 3), h: 8, c1: c, c2: "#efe2c0", seed: i + seed })); });
      }
    } },
  };

  // a low cottage with a thatched roof, a chimney, a lit window and a stable door whose top half stands open on the kitchen
  function cottage(c, x, g) {
    F(c, x - 1, g - 15, 32, 16, OL); F(c, x, g - 14, 30, 14, "#d8c8a8"); F(c, x, g - 14, 30, 1, "#efe2c0"); F(c, x + 27, g - 14, 3, 14, "#b8a888");
    for (let k = 0; k < 11; k++) { F(c, x - 3 + k, g - 15 - k, 36 - k * 2, 1, OL); F(c, x - 2 + k, g - 15 - k, 34 - k * 2, 1, k % 3 === 2 ? "#a87a38" : "#c8964a"); }
    for (let k = 0; k < 30; k += 3) P(c, x + 1 + k, g - 16, "#8a5e28");
    F(c, x + 22, g - 30, 5, 10, OL); F(c, x + 23, g - 29, 3, 9, "#8a6a5a"); F(c, x + 23, g - 29, 3, 1, "#a88a7a");
    F(c, x + 2, g - 12, 9, 13, OL); F(c, x + 3, g - 11, 7, 5, "#ffcc78"); F(c, x + 3, g - 11, 7, 1, "#fff0c0"); P(c, x + 4, g - 9, "#d8402e"); P(c, x + 7, g - 8, "#c8862a");
    F(c, x + 3, g - 5, 7, 5, "#7a4a28"); F(c, x + 3, g - 5, 7, 1, "#a87048"); P(c, x + 8, g - 3, "#e8b84a");
    F(c, x + 17, g - 11, 7, 6, OL); F(c, x + 18, g - 10, 5, 4, "#ffd890"); F(c, x + 20, g - 10, 1, 4, "#5a3a20"); F(c, x + 18, g - 8, 5, 1, "#5a3a20");
    F(c, x + 3, g, 7, 1, "rgba(255,200,120,0.35)");
  }

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
