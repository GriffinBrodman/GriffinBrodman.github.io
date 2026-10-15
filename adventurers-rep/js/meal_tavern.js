/* Meal replays in town: "the special" for one hero and "the feast" for a crew, in that town's tavern (or at the bakery counter or a street stall), with the real sprites and portraits; adds to MealReplay. */
(function (root) {
  "use strict";
  const M = root.MealReplay, FA = root.FoodArt;
  if (!M || !FA) return;
  const K = FA.kit, MK = M.kit;
  const { W, H, Img, C, mix, pick, rng, fbm, h2, bay, clamp, lerp, TAU, glow, star, outline, text, textWidth, steam } = K;
  const { blit, sfx, bubble, nameCard, heart, twinkles, sparkleAt, godrays } = MK;
  const RW = W / 2, RH = H / 2, TABLE = 56;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const ease3 = (t) => 1 - Math.pow(1 - t, 3);
  const back = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  // ---------- the room, at the sprites' own pixel size (half the stage, drawn double) ----------
  const DEFAULT_WALL = (a, h) => { const row = Math.floor(h / 5); if (h % 5 < 1) return "#3a2414"; return ["#6a4224", "#5e3a20", "#724828"][(row + Math.floor(a * 0.4 + row * 1.3)) % 3]; };
  function lookOf(town) { const L = root.Ballad && root.Ballad.LOOKS; return (L && L[town]) || { wall: DEFAULT_WALL, rug: ["#8a2a24", "#d8c08a"], bunting: ["#c8463a", "#e8c060", "#3a5a8a"], frame: "#3a2414", curtain: ["#7a3a24", "#5a2818"], mantel: "#5e3a1e", stone: null }; }
  const sh = (c, k) => { const p = C(c); return k > 0 ? mix(p, "#ffffff", k) : mix(p, "#000000", -k); };
  function room(r, where) {
    const im = new Img(RW, RH, "#140c08"), town = r.place.id, lk = lookOf(town);
    if (where === "stall") return street(r, lk);
    for (let y = 0; y < TABLE + 4; y++) for (let x = 0; x < RW; x++) {
      let c = lk.wall(x / 9 + 0.3, (TABLE + 4 - y) * 1.15);
      c = c ? C(c) : C("#5e3a20");
      const d = Math.hypot((x - RW * 0.5) / 80, (y - 20) / 50);
      im.px(x, y, mix(c, "#0c0806", clamp(d * 0.55, 0, 0.6)));
    }
    for (let x = 0; x < RW; x++) { im.px(x, 0, "#1a100a"); im.px(x, 1, "#2a1a10"); }
    for (const bx of [2, 58, 116]) for (let y = 0; y < TABLE; y++) { im.px(bx, y, "#24160c"); im.px(bx + 1, y, "#3a2414"); }
    if (where === "bakery") bakeryWall(im, lk);
    else {
      win(im, 8, 8, 20, 18, lk, r);
      if (r.special || r.eaters.length === 1) chalkboard(im, 82, 7, 33, boardLines(r.name || "").length > 2 ? 23 : 18);
      else hearth(im, 86, 10, 28, 46, lk);
      shelf(im, 34, 12, 38, lk);
    }
    const bt = lk.bunting || ["#c8463a", "#e8c060", "#3a5a8a"];
    for (let x = 4; x < RW - 4; x++) { const y = 3 + Math.sin(((x - 4) / (RW - 8)) * Math.PI) * 4; im.px(x, y, "#2a1a10"); if ((x - 4) % 8 < 4 && (x - 4) % 8 > 0) for (let j = 1; j < 4 - Math.abs(((x - 4) % 8) - 2); j++) im.px(x, y + j, bt[Math.floor((x - 4) / 8) % bt.length]); }
    lamp(im, 60, 2);
    return im;
  }
  function win(im, x, y, w, h, lk, r) {
    const fr = lk.frame || "#3a2414";
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1, bar = i === Math.floor(w / 2) || j === Math.floor(h / 2);
      im.px(x + i, y + j, edge || bar ? fr : r.day_scene ? (j > h * 0.7 ? "#9ac8a0" : mix(C("#6aa8d8"), C("#c4e2f2"), j / h)) : j > h * 0.7 ? "#1a2030" : "#0e1424");
    }
    const rr = rng(r.seed + 4);
    if (!r.day_scene) { for (let k = 0; k < 6; k++) im.px(x + 2 + rr() * (w - 4), y + 2 + rr() * (h * 0.5), "#e8e4d0"); im.px(x + w - 5, y + 3, "#fff6dc"); im.px(x + w - 4, y + 3, "#e8dcc0"); im.px(x + w - 5, y + 4, "#e8dcc0"); }
    if (lk.curtain) for (let j = -1; j < h + 2; j++) { im.px(x - 2, y + j, lk.curtain[0]); im.px(x - 1, y + j, lk.curtain[1]); im.px(x + w, y + j, lk.curtain[1]); im.px(x + w + 1, y + j, lk.curtain[0]); }
  }
  // a long special takes three lines and a taller board (round 32: "Kobold Peppercorn" lost its "Stew"); longer still, the board names the dish's head
  const boardWrap = (nm) => (MK.wrap ? MK.wrap(nm, 54) : [nm]);
  const boardLines = (nm) => { const l = boardWrap(nm); return (l.length > 3 ? boardWrap(nm.split(/ with | on the |, /)[0]) : l).slice(0, 3); };
  function chalkboard(im, x, y, w, h) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) im.px(x + i, y + j, i === 0 || j === 0 || i === w - 1 || j === h - 1 ? "#5a3a1e" : (i + j * 3) % 11 === 0 ? "#2a3430" : "#1e2622");
  }
  function hearth(im, x, y, w, h, lk) {
    const st = lk.stone || ["#7a726a", "#6a625a", "#847a70"];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const row = Math.floor(j / 4), mort = j % 4 === 0 || (i + row * 3) % 7 === 0;
      im.px(x + i, y + j, mort ? "#2a2420" : st[(i * 3 + row * 5) % st.length]);
    }
    for (let j = 18; j < h; j++) for (let i = 6; i < w - 6; i++) im.px(x + i, y + j, "#0c0806");
    for (let i = -2; i < w + 2; i++) { im.px(x + i, y + 17, lk.mantel || "#5e3a1e"); im.px(x + i, y + 16, sh(lk.mantel || "#5e3a1e", 0.2)); }
  }
  function shelf(im, x, y, w, lk) {
    for (let i = 0; i < w; i++) { im.px(x + i, y + 8, "#5a3418"); im.px(x + i, y + 9, "#3a2010"); }
    const cols = ["#4e7a34", "#8a3a2a", "#c8a040", "#2e5a7a", "#d8d0c0", "#5a3a20"];
    for (let k = 0; k < 7; k++) { const bx = x + 2 + k * 5, hgt = 4 + (k % 3); for (let j = 0; j < hgt; j++) { im.px(bx, y + 8 - j, cols[k % 6]); im.px(bx + 1, y + 8 - j, sh(cols[k % 6], -0.3)); } im.px(bx, y + 8 - hgt - 1, cols[k % 6]); }
  }
  function lamp(im, x, y) {
    for (let j = 0; j < 5; j++) im.px(x, y + j, "#2a1a10");
    for (let j = 0; j < 4; j++) for (let i = -2; i <= 2; i++) im.px(x + i, y + 5 + j, j === 0 || j === 3 ? "#3a2414" : Math.abs(i) === 2 ? "#3a2414" : "#ffd27a");
  }
  function bakeryWall(im, lk) {
    for (const sy of [14, 30]) {
      for (let i = 8; i < RW - 8; i++) { im.px(i, sy, "#5a3418"); im.px(i, sy + 1, "#3a2010"); }
      for (let k = 0; k < 12; k++) {
        const bx = 12 + k * 9, by = sy - 1;
        for (let j = 0; j < 5; j++) for (let i = -3; i <= 3; i++) if (Math.hypot(i / 3.6, (j - 4) / 5) < 1) im.px(bx + i, by - 4 + j, mix(C(["#c88434", "#a86a26", "#d8a050", "#e8c07a"][(k + sy) % 4]), "#000000", j > 3 ? 0.3 : i > 1 ? 0.2 : 0));
      }
    }
    for (let j = 36; j < TABLE; j++) for (let i = 84; i < 112; i++) { const ed = i === 84 || i === 111 || j === 36; im.px(i, j, ed ? "#3a2a24" : j > 46 ? (((i + j) % 3) ? "#ff8a2a" : "#ffd27a") : "#1a1210"); }
  }
  // a street stall at night: the town's wall beyond, a striped awning in the town colours, a lantern
  function street(r, lk) {
    const day = r.day_scene, im = new Img(RW, RH, "#0a0e18");
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      // the town wall has battlements, and is toned to stone: a blue-grey tavern wall under open sky read as the sea (Carrbridge)
      const merlon = y >= 25 && y < 30 && x % 12 < 7;
      if (y < 30 && !merlon) { im.px(x, y, day ? mix(C("#5a9ad0"), C("#b4daf0"), y / 30) : mix(C("#0a0e1c"), C("#1a2234"), y / 30)); continue; }
      const c = merlon ? "#6e604e" : mix(C(lk.wall(x / 9, (TABLE + 4 - y) * 1.1) || "#3a2a20"), "#7e6c58", 0.45);
      im.px(x, y, mix(C(c), day ? "#fff4e0" : "#0a0c14", day ? 0.08 : 0.55));
    }
    const rr = rng(r.seed + 5);
    if (day) { for (let k = 0; k < 3; k++) { const cx = 10 + rr() * 100, cy = 6 + rr() * 12; for (let j = -2; j <= 2; j++) for (let i = -9; i <= 9; i++) if (Math.hypot(i / 9, j / 2.4) < 1) im.px(cx + i, cy + j, j < 0 ? "#ffffff" : "#e2eef6"); } }
    else for (let k = 0; k < 14; k++) im.px(rr() * RW, rr() * 24, k % 3 ? "#8a98b0" : "#fff6e0");
    const bt = lk.bunting || ["#c8463a", "#e8c060"];
    for (let x = 20; x < RW - 20; x++) for (let j = 0; j < 8; j++) { const scal = j === 7 && (x % 6) > 2; if (scal) continue; im.px(x, 10 + j + (j === 7 ? 0 : 0), ((Math.floor((x - 20) / 6)) % 2 ? bt[0] : "#efe4cc")); }
    for (const px of [22, RW - 23]) for (let y = 10; y < TABLE + 6; y++) { im.px(px, y, "#3a2414"); im.px(px + 1, y, "#24160c"); }
    for (let j = 0; j < 5; j++) for (let i = -2; i <= 2; i++) im.px(RW - 30 + i, 20 + j, j === 0 || j === 4 || Math.abs(i) === 2 ? "#2a1a10" : day ? "#8a7a5a" : "#ffd27a");
    return im;
  }
  function table(im, where) {
    const counter = where !== "tavern";
    for (let y = TABLE; y < RH; y++) for (let x = 0; x < RW; x++) {
      const top = y < TABLE + 6, plank = Math.floor(x / 14), seam = x % 14 === 0;
      let c = top ? pick(K.R(["#3a2210", "#5a361a", "#7a4c26", "#94602e", "#a87038"]), 0.3 + (y - TABLE) * -0.02 + (plank % 2 ? 0.1 : 0) + (fbm(x / 10, y, 3) - 0.5) * 0.3, x, y) : pick(K.R(["#140a04", "#1e1008", "#2a180c", "#3a2212"]), 0.4 - (y - TABLE - 6) * 0.03, x, y);
      if (top && seam) c = "#2a1808";
      if (y === TABLE) c = "#b8803e";
      if (counter && !top && x % 20 < 2) c = "#100804";
      im.px(x, y, c);
    }
  }
  // a hero seated behind the table (or standing at the counter), lit warm from the lamp; breathing and blinking
  function seat(im, c, x, t, o) {
    o = o || {};
    const spr = c.sprite, dip = ((t / 3.1 + c.i * 0.37) % 1) < 0.42 ? 1 : 0, lean = o.lean || 0, sx = Math.round(x - spr.w / 2 + lean), sy = TABLE - spr.h + (o.stand ? 6 : 10) + dip;
    for (let y = 0; y < spr.h; y++) {
      const ty = sy + y;
      if (ty >= TABLE + 1) break;
      for (let xx = 0; xx < spr.w; xx++) {
        const p = spr.d[(y * spr.w + xx) * 4 + 3] ? [spr.d[(y * spr.w + xx) * 4], spr.d[(y * spr.w + xx) * 4 + 1], spr.d[(y * spr.w + xx) * 4 + 2]] : null;
        if (!p) continue;
        const warm = mix(p, "#ffb060", 0.12);
        im.px(sx + xx, ty, warm);
      }
    }
    const blink = ((t / (3.3 + c.i * 0.7) + c.i * 0.29) % 1) < 0.05;
    if (blink) for (const ex of [12, 15]) { const p = im.get(sx + ex, sy + 10); if (p) im.px(sx + ex, sy + 10, mix(p, c.skin || "#d8a880", 0.8)); }
    return { x: sx + spr.w / 2, top: sy };
  }
  function seatsFor(n) { return n === 1 ? [62] : n === 2 ? [42, 80] : n === 3 ? [28, 60, 92] : [20, 46, 74, 100]; }

  // ---------- the dish small, on the table: the served close-up shrunk to room size and cut to its plate ----------
  function mini(ctx, key, w, h, serve) {
    const c = ctx.cache;
    if (c.has(key)) return c.get(key);
    const src = serve(), out = new Img(w, h), sx = 240 / (w * 1.05), sy = 150 / (h * 1.6), ox = 120 - (w / 2) * sx, oy = 92 - (h / 2) * sy;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2), ny = (y + 0.5 - h / 2) / (h / 2);
      if (nx * nx + ny * ny > 1) continue;
      let r0 = 0, g0 = 0, b0 = 0, n = 0;
      for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) { const p = src.get(ox + x * sx + i, oy + y * sy + j); if (p) { r0 += p[0]; g0 += p[1]; b0 += p[2]; n++; } }
      if (n) out.px(x, y, [r0 / n * 1.1, g0 / n * 1.1, b0 / n * 1.1]);
    }
    outline(out, "#0c0604");
    c.set(key, out);
    return out;
  }
  function plateAt(im, m, x, y) { K.shadow(im, x, y + m.h / 2, m.w / 2 + 1, 2, 0.4); im.paste(m, Math.round(x - m.w / 2), Math.round(y - m.h / 2 - 1)); }
  function mug(im, x, y) { for (let j = 0; j < 5; j++) for (let i = 0; i < 4; i++) im.px(x + i, y + j, j === 0 ? "#f4ead0" : i === 0 ? "#a8a8b0" : "#6a6a74"); im.px(x + 4, y + 1, "#6a6a74"); im.px(x + 4, y + 3, "#6a6a74"); }
  function emptyPlate(im, x, y, clean) { for (let j = -2; j <= 2; j++) for (let i = -6; i <= 6; i++) if (Math.hypot(i / 6.5, j / 2.6) < 1) im.px(x + i, y + j, Math.hypot(i / 6.5, j / 2.6) > 0.7 ? "#8a8a92" : clean ? "#b8b8c0" : "#a8a0a0"); }

  // ---------- portraits: the real bust, scaled, with an expression painted at the finer scale ----------
  function face(c, k, mode, bgFn) {
    const p = c.portrait;
    const out = new Img(40 * k, 40 * k);
    if (bgFn) out.fill(bgFn);
    if (!p) { MK.blit(out, c.sprite, 20 * k - c.sprite.w * k * 0.5, 2 * k, k * 1.1); return out; }
    MK.blit(out, p, 0, 0, k);
    const skinP = p.get(15, 19) || p.get(24, 19), noseP = p.get(19, 18), want = c.skin ? C(c.skin) : null;
    const near = (q) => q && want && Math.abs(q[0] - want[0]) + Math.abs(q[1] - want[1]) + Math.abs(q[2] - want[2]) < 190 && Math.abs((q[0] - q[2]) - (want[0] - want[2])) < 70;
    const bare = near(skinP) && near(noseP) && near(p.get(25, 19));
    if (!bare) return out;
    const skin = [skinP[0], skinP[1], skinP[2]], ink = "#1a1018";
    const E = [[16.5, 17], [22.5, 17]].map(([ex, ey]) => [ex * k + k / 2, ey * k + k / 2]);
    if (mode !== "plain") for (const [X, Y] of E) out.rect(X - 2.2 * k, Y - 1.6 * k, 4.4 * k, 3 * k, skin);
    const u = k / 2;
    for (const [X, Y] of E) {
      if (mode === "sparkle") {
        out.rect(X - 2.4 * u, Y - 3 * u, 5 * u, 6 * u, ink);
        out.rect(X - 1.4 * u, Y - 2 * u, 3 * u, 4 * u, "#3a6aa8");
        out.rect(X - 1.4 * u, Y + 1 * u, 3 * u, 1 * u, "#7ab4e8");
        out.rect(X - 2.4 * u, Y - 3 * u, 2 * u, 2 * u, "#ffffff");
        out.rect(X + 1 * u, Y + 1 * u, u, u, "#ffffff");
      } else if (mode === "bliss") {
        for (const [dx, dy] of [[-2, 1], [-1, 0], [0, -1], [1, 0], [2, 1]]) out.rect(X + dx * u, Y + dy * u, u, u, "#2a1410");
      } else if (mode === "shock") {
        out.rect(X - 2.4 * u, Y - 2.4 * u, 5 * u, 5 * u, "#fffaf0");
        out.rect(X - 2.4 * u, Y - 3.4 * u, 5 * u, u, ink); out.rect(X - 2.4 * u, Y + 2.6 * u, 5 * u, u, ink);
        out.rect(X - 3.4 * u, Y - 2.4 * u, u, 5 * u, ink); out.rect(X + 2.6 * u, Y - 2.4 * u, u, 5 * u, ink);
        out.rect(X - 0.4 * u, Y - 0.4 * u, u, u, ink);
      }
    }
    if (mode === "sparkle" || mode === "bliss" || mode === "shock") for (const [X, Y] of E) for (let j = 0; j < 3; j++) { out.rect(X - 3 * u + j * 2 * u, Y + 4 * u, u, u, "#e8505a", 0.8); }
    const mx = 20 * k, my = 22 * k + k / 2;
    if (mode === "sparkle" || mode === "bliss") { out.rect(mx - 3 * u, my, 6 * u, u, "#3a1410"); out.rect(mx - 2 * u, my + u, 4 * u, 2 * u, "#5a1a18"); out.rect(mx - u, my + 2 * u, 2 * u, u, "#d85a5a"); }
    if (mode === "shock") { out.rect(mx - u, my - u, 3 * u, 4 * u, "#3a1410"); out.rect(mx, my, u, 2 * u, "#8a2a28"); }
    return out;
  }
  function rays(img, x0, y0, w, h, cx, cy, a, b, n, twist) {
    const ca = C(a), cb = C(b);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const ang = Math.atan2(y - cy, x - cx) + (twist || 0); img.px(x, y, Math.sin(ang * n) > 0.15 ? ca : cb); }
  }
  const BITE = { fried: "CRUNCH", bread: "CRUNCH", pie: "CRUNCH", skewer: "CHOMP", steak: "CHOMP", roast: "CHOMP", stew: "SLURP", soup: "SLURP", grain: "NOM", seafood: "CRACK", sweet: "MMMF", greens: "CRUNCH", legendary: "...!!" };
  const LINES = { great: ["...unsettlingly good.", "oh. OH.", "I'd fight for this.", "more. please."], good: ["that's the stuff.", "good. really good.", "worth the coin."], plain: ["it's... food.", "fine. it's fine."], bad: ["...", "is it meant to taste like that?"] };
  const PANEL = [["#f8c860", "#f0a838"], ["#e86a4a", "#c84a30"], ["#5ab0a0", "#3a8a7e"], ["#f0d080", "#d8a850"]];

  // ---------- beats shared by every town meal ----------
  function zoomBeat(r, ctx, kit, roomAt, plateX, feast, overlay) {
    return { id: "zoom", dur: 2.6, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
      blit(img, roomAt(t), 0, 0, 2);
      if (overlay) overlay(img, t);
      const u = back(clamp(t / 0.35, 0, 1)), bx = 126, by = 58, rx = (feast ? 108 : 92) * Math.min(1.05, u), ry = (feast ? 50 : 46) * Math.min(1.05, u), src = kit.serve();
      for (let y = Math.floor(by - ry - 2); y <= by + ry + 2; y++) for (let x = Math.floor(bx - rx - 2); x <= bx + rx + 2; x++) {
        const d = Math.hypot((x + 0.5 - bx) / rx, (y + 0.5 - by) / ry);
        if (d > 1.04) continue;
        if (d > 1) { img.px(x, y, "#1a1010"); continue; }
        if (d > 0.96) { img.px(x, y, "#fffaf0"); continue; }
        const p = src.get(120 + (x - bx) * 1.0, 86 + (y - by) * 1.0);
        if (p) img.px(x, y, p);
      }
      const tx = plateX * 2, ty = TABLE * 2;
      for (let k = 0; k < 10; k++) { const q = k / 10; img.rect(lerp(bx - 20, tx, q) - (1 - q) * 4, lerp(by + ry - 4, ty - 4, q), (1 - q) * 8 + 1, 2, "#fffaf0"); }
      twinkles(img, [[bx - rx * 0.6, by - ry * 0.5, 2], [bx + rx * 0.5, by - ry * 0.6, 3], [bx + rx * 0.7, by + ry * 0.3, 2]], t, 1.2);
      for (let i = 0; i < 3; i++) steam(img, bx - 40 + i * 40, by - 10, 36, t * 1.3 + i * 1.5, 0.3, 4, 3);
    }, sfx: [[0.05, "pop", 0], [0.4, "sparkle", 1]] };
  }
  function macroBeat(r, kit) {
    const spec = kit.spec;
    return { id: "macro", dur: 3.0, base: () => kit.serve().copy(), draw: (img, t) => {
      for (const [x, y, ph] of spec.steamAt || [[70, 64, 0], [120, 58, 1.3], [170, 66, 2.1]]) steam(img, x, y, 40, t * 1.4 + ph, 0.36, 3, 3);
      twinkles(img, spec.sparkles || [[96, 50, 3], [150, 44, 2], [60, 70, 2]], t, 1.3);
      if (r.legendary) godrays(img, t);
      nameCard(img, r.name || spec.name || "", t - 0.4, { legendary: r.legendary });
    }, sfx: [[0.05, r.legendary ? "fanfare" : "reveal", 1], [0.45, "swish", 1]] };
  }
  // one eater: the bite, then their face in a sunburst with the line
  function soloCut(r, ctx, kit) {
    const cast = kit.cast, fam = kit.fam, line = kit.line;
    return [{ id: "bite", dur: 2.4, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
      rays(img, 0, 0, W, H, 60, 75, "#f8d070", "#f0b040", 18, t * 0.4);
      const split = (x, y) => x + (y - 75) * 0.35 > 128;
      const fc = face(cast[0], 3, "shock");
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (split(x, y)) img.px(x, y, Math.sin(Math.atan2(y - 75, x - 190) * 18 + t) > 0.15 ? "#4a8ac8" : "#2e6aa8");
      blit(img, fc, 132, 14, 1, 1, (c, u, v, i, j) => (split(132 + i, 14 + j) ? c : null));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const e = x + (y - 75) * 0.35 - 128; if (e >= 0 && e < 3) img.px(x, y, e < 1 ? "#1a1010" : "#fffaf0"); }
      const src = kit.serve(), cx = 62, cy = 70, R0 = 34, bite = t > 0.5;
      for (let y = -R0; y <= R0; y++) for (let x = -R0; x <= R0; x++) {
        if (Math.hypot(x, y * 1.2) > R0) continue;
        if (bite && Math.hypot(x - 22, y + 18) < 16) continue;
        const p = src.get(120 + x * 0.9, 84 + y * 0.9);
        if (p && !split(cx + x, cy + y)) img.px(cx + x, cy + y + Math.round(Math.sin(t * 6) * 2), p);
      }
      if (bite) { const r2 = rng(r.seed + 6), u = t - 0.5; for (let k = 0; k < 24; k++) { const a = r2() * TAU, sp = 30 + r2() * 50, x = cx + 22 + Math.cos(a) * sp * u, y = cy - 18 + Math.sin(a) * sp * u + 40 * u * u; img.rect(x, y, 2, 2, r2() < 0.5 ? "#e8b860" : "#a86a2a"); } }
      sfx(img, BITE[fam] || "CRUNCH", 10, 138, t - 0.5, { k: 3, shake: 2 });
      return { shake: t > 0.5 && t < 0.62 ? [1, 0] : null };
    }, sfx: [[0.5, fam === "stew" || fam === "soup" ? "slurp" : "crunch", 1]] },
    { id: "cutin", dur: 3.2, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
      rays(img, 0, 0, W, H, 120, 160, "#f8d070", "#f0b848", 22, t * 0.3);
      const k = 3, fc = face(cast[0], k, kit.mode);
      const u = ease3(clamp(t / 0.3, 0, 1)), x = lerp(W, 60, u);
      blit(img, fc, x, 150 - 120, 1);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t, rr = 70 + Math.sin(t * 3 + i) * 6; sparkleAt(img, 120 + Math.cos(a) * rr, 80 + Math.sin(a) * rr * 0.6, (t * 1.3 + i * 0.3) % 1.2, 0.2, 2); }
      if (kit.hearts) for (let i = 0; i < 5; i++) { const q = (t * 0.6 + i * 0.2) % 1; heart(img, 30 + i * 44 + Math.sin(q * 6 + i) * 4, 140 - q * 120, 1 - q); }
      if (t > 0.5) {
        const tw = textWidth(line) + 10, bx = 8, by = 118;
        img.rect(bx, by, tw, 15, "#fffaf0"); for (let i = 0; i < tw; i++) { img.px(bx + i, by, "#1a1010"); img.px(bx + i, by + 14, "#1a1010"); } for (let j = 0; j < 15; j++) { img.px(bx, by + j, "#1a1010"); img.px(bx + tw - 1, by + j, "#1a1010"); }
        const n = Math.floor(clamp((t - 0.5) / 0.04, 0, line.length));
        text(img, line.slice(0, n), bx + 5, by + 11, "#2a1810");
      }
    }, sfx: [[0.05, "swish", 1], [0.4, "sparkle", 1]] }];
  }
  // a crew: every face in its own slanted panel
  function crewCut(r, ctx, kit) {
    const cast = kit.cast;
    return { id: "cutin", dur: 3.4, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
      const n = cast.length, pw = W / n;
      cast.forEach((c, i) => {
        const x0 = i * pw, u = ease3(clamp((t - i * 0.18) / 0.3, 0, 1));
        if (u <= 0) return;
        const [a, b] = PANEL[i % PANEL.length], inPanel = (x, y) => { const e = (y - 75) * 0.18; return x >= x0 + e && x < x0 + pw + e; };
        for (let y = 0; y < H; y++) for (let x = Math.floor(x0 - 20); x < x0 + pw + 20; x++) if (inPanel(x, y)) img.px(x, y, Math.sin(Math.atan2(y - 150, x - x0 - pw / 2) * 16 + t * 0.6) > 0.15 ? a : b);
        const k = n >= 4 ? 2 : n === 3 ? 2.4 : 3, fc = face(c, Math.round(k * 2) / 2, ["sparkle", "bliss", "sparkle", "bliss"][i % 4]);
        blit(img, fc, x0 + pw / 2 - fc.w / 2, H - fc.h + (1 - u) * 60, 1, 1, (cc, uu, vv, ii, jj) => (inPanel(x0 + pw / 2 - fc.w / 2 + ii, H - fc.h + jj) ? cc : null));
        sparkleAt(img, x0 + pw * 0.8, 24 + i * 6, (t + i * 0.4) % 1.4, 0.2, 3);
      });
      for (let i = 1; i < n; i++) for (let y = 0; y < H; y++) { const x = i * pw + (y - 75) * 0.18; img.px(x - 1, y, "#1a1010"); img.px(x, y, "#fffaf0"); img.px(x + 1, y, "#1a1010"); }
    }, sfx: cast.map((_, i) => [0.05 + i * 0.18, "swish", 1]).concat([[0.8, "sparkle", 1]]) };
  }

  // ---------- the beats ----------
  function beats(r, ctx) {
    const where = r.where === "bakery" || r.where === "stall" ? r.where : "tavern", feast = ctx.cast.length > 1, ev = M.eventOf ? M.eventOf(r) : null;
    r.day_scene = where !== "tavern" && ctx.rec.night !== true;
    const spec = ctx.spec, cast = ctx.cast.slice(0, 4), xs = seatsFor(cast.length), stand = where !== "tavern";
    const serve = () => { if (!ctx.cache.has("tv:serve")) ctx.cache.set("tv:serve", FA.plate(spec, "done", { seed: r.seed, legendary: r.legendary })); return ctx.cache.get("tv:serve"); };
    const roomImg = () => { if (!ctx.cache.has("tv:room")) { const im = room(r, where); table(im, where); ctx.cache.set("tv:room", im); } return ctx.cache.get("tv:room"); };
    const fam = (r.family in BITE ? r.family : spec.plate === "claws" ? "seafood" : "steak");
    const pool = LINES[r.verdict === "bad" ? "plain" : r.verdict || "good"], line = r.line || pool[r.seed % pool.length];
    const kit = { spec, serve, cast, fam, line, lk: lookOf(r.place.id), mode: r.verdict === "bad" ? "plain" : r.verdict === "great" ? "sparkle" : "bliss", hearts: r.verdict !== "bad" };
    if (ev === "contest" && r.verdict !== "great") { kit.mode = "plain"; kit.hearts = false; }
    if (ev) return eventBeats(r, ctx, ev, kit);
    const MW = feast ? 40 : 24, MH = feast ? 16 : 10, plateX = feast ? RW / 2 : xs[0];
    const up = (img, rm, extra) => { blit(img, rm, 0, 0, 2); if (extra) extra(img); };
    const special = (img) => { if (!(r.special || cast.length === 1) || where !== "tavern") return; text(img, "Special:", 168, 26, "#e8eadc"); const lines = boardLines(r.name || spec.name || ""), three = lines.length > 2; lines.forEach((l, i) => text(img, l, 168, (three ? 35 : 36) + i * (three ? 8 : 9), "#f4f0d8")); };
    const scene = (t, o) => {
      o = o || {};
      const rm = roomImg().copy(), heads = [];
      cast.forEach((c, i) => { if (o.hide && o.hide(i)) return; heads.push(seat(rm, c, xs[i], t, { stand, lean: o.lean ? o.lean(i) : 0 })); });
      if (where === "tavern") cast.forEach((c, i) => { if (!o.noPlates) emptyPlate(rm, xs[i], TABLE + 3, false); mug(rm, xs[i] + 9, TABLE - 3); });
      return { rm, heads };
    };
    const B = [];
    B.push({ id: "room", dur: feast ? 2.8 : 2.4, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
      const { rm, heads } = scene(t);
      up(img, rm, special);
      glow(img, 120, 20, 70, "#ffb060", 0.12 + 0.03 * Math.sin(t * 7), 40);
      if (feast) sfx(img, "rumble", 120, 64, t - 0.8, { k: 2, shake: 1, fade: 1.6, center: true, fill: () => "#f4e0c0" });
      else sfx(img, "...?", heads[0].x * 2 + 20, heads[0].top * 2 + 6, t - 1.0, { k: 1, fill: () => "#f4e0c0" });
    }, sfx: [[0, "room", 18]].concat(feast ? [[0.8, "rumble", 1]] : []) });
    B.push({ id: "arrive", dur: 2.2, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
      const { rm } = scene(t, { lean: (i) => (t > 0.9 ? (xs[i] < plateX ? 1 : xs[i] > plateX ? -1 : 0) : 0) });
      const m = mini(ctx, "mini" + MW, MW, MH, serve);
      let px = plateX, py = TABLE + 2, shake;
      if (feast) { const u = seg(t, 0.1, 0.55); py = lerp(-20, TABLE + 2, u * u); if (u >= 1 && t < 0.7) shake = [0, 1]; }
      else px = lerp(RW + 30, plateX, ease3(seg(t, 0.1, 0.8)));
      plateAt(rm, m, px, py);
      up(img, rm, special);
      if (!feast && t < 0.9) for (let k = 0; k < 4; k++) img.rect(px * 2 + MW + 4 + k * 6, (TABLE - 2 + k) * 2, 10 + k * 4, 1, "#e8e0d0", 0.7);
      for (let i = 0; i < 3; i++) steam(img, px * 2 - 10 + i * 10, py * 2 - 8, 26, t * 1.4 + i, 0.32 * seg(t, 0.6, 1.2), 3, 2);
      sfx(img, feast ? "thud." : "shhhk", feast ? px * 2 - 10 : 150, feast ? 140 : 76, t - (feast ? 0.55 : 0.2), { k: 2, fade: 1.0, fill: () => "#f4e8d0" });
      return { shake };
    }, sfx: feast ? [[0.55, "thud", 1]] : [[0.1, "swish", 1], [0.8, "clink", 1]] });
    B.push(zoomBeat(r, ctx, kit, (t) => { const { rm } = scene(t + 2); plateAt(rm, mini(ctx, "mini" + MW, MW, MH, serve), plateX, TABLE + 2); return rm; }, plateX, feast, special));
    B.push(macroBeat(r, kit));
    if (!feast) B.push(...soloCut(r, ctx, kit));
    else {
      B.push({ id: "hush", dur: 2.6, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
        const { rm, heads } = scene(t + 4, { lean: (i) => (xs[i] < plateX ? -1 : 1) });
        emptyPlate(rm, plateX, TABLE + 2, true); emptyPlate(rm, plateX + 2, TABLE + 1, true);
        for (let k = 0; k < 6; k++) rm.px(plateX - 8 + k * 3, TABLE + 1 + (k % 2), "#d8c8a8");
        up(img, rm, special);
        heads.forEach((hd, i) => { const q = ((t * 0.5 + i * 0.3) % 1); if (t > 0.4) heart(img, hd.x * 2 + 4, hd.top * 2 - 4 - q * 30, 1 - q); });
        sfx(img, "...", 120, 30, t - 0.4, { k: 2, center: true, fill: () => "#f4e8d0" });
      }, sfx: [[0.4, "chime", 1]] });
      B.push(crewCut(r, ctx, kit));
    }
    return B;
  }

  // ---------- town food events: feast day, the baking contest, the cooks' feud ----------
  // townsfolk at the native sprite size, like tavern.js's locals; a cook gets a white cap and an apron
  const FOLK = { skin: ["#f0c8a0", "#e0b088", "#c48a5e", "#9a6440", "#6e4428"], hair: ["#3a2a1a", "#6a4020", "#c8a050", "#9a9aa6", "#2a2228", "#a04a20"],
    fav: ["#5a6a3a", "#3a5a8a", "#7a5a3a", "#6a3a3a", "#8a7a5a"] };
  function gridImg(g) {
    const im = new Img(g.w, g.h);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const c = g.px[y * g.w + x]; if (c) im.px(x, y, c); }
    return im;
  }
  function folk(seed, o) {
    o = o || {};
    const r = rng(seed * 7919 + 13), p = (a) => a[Math.floor(r() * a.length)];
    const look = { skin: p(FOLK.skin), hair: p(FOLK.hair), style: Math.floor(r() * 6), face: Math.floor(r() * 3), fav: p(FOLK.fav), scars: [] };
    let im = null;
    try {
      im = gridImg(root.Art.heroGrid({ id: "folk" + seed, name: "", look, weapon: "none", weapon_tier: 1, armor_tier: 1 }, 0,
        { name: "local", look: { outfit: o.outfit || p(["vest", "leather", "cloak"]), head: "none", aura: null, offhand: "none" } }));
    } catch (e) { im = null; }
    if (!im) return null;
    if (o.cook) {
      // room above the head for the cap
      const tall = new Img(im.w, im.h + 6);
      tall.paste(im, 0, 6);
      tall.pad = 6;
      im = tall;
      dressCook(im, o.cap !== false);
    }
    return { sprite: im, i: seed % 7, skin: look.skin, seed };
  }
  function dressCook(im, cap) {
    let y0 = im.h, sx = 0, n = 0;
    for (let y = 0; y < im.h && y0 === im.h; y++) for (let x = 0; x < im.w; x++) if (im.alpha(x, y)) { y0 = y; break; }
    for (let y = y0; y < y0 + 6; y++) for (let x = 0; x < im.w; x++) if (im.alpha(x, y)) { sx += x; n++; }
    const cx = Math.round(n ? sx / n : im.w / 2);
    if (cap) {
      for (let j = 0; j < 7; j++) for (let i = -5; i <= 5; i++) {
        const puff = j < 5 && Math.hypot(i / 5.2, (j - 2.5) / 3) < 1, band = j >= 5 && Math.abs(i) <= 4;
        if (!puff && !band) continue;
        const edge = (puff && Math.hypot(i / 5.2, (j - 2.5) / 3) > 0.8) || (band && Math.abs(i) === 4);
        im.px(cx + i, y0 - 5 + j, edge ? "#2a2420" : band ? "#d4cec2" : i > 1 ? "#d8d2c6" : "#fbf7ee");
      }
    }
    for (let j = 0; j < 12; j++) for (let i = -3; i <= 3; i++) {
      const y = y0 + 15 + j, x = cx + i + (j > 8 ? Math.sign(i) * 0 : 0);
      if (!im.alpha(x, y)) continue;
      im.px(x, y, Math.abs(i) === 3 ? "#bdb4a2" : i < -1 ? "#e4dccb" : "#f4efe4");
    }
    for (let i = -5; i <= 5; i++) if (im.alpha(cx + i, y0 + 15)) im.px(cx + i, y0 + 15, "#d4cab4");
  }
  function flipImg(im) {
    if (im.flip) return im.flip;
    const o = new Img(im.w, im.h);
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const p = im.get(x, y); if (p) o.px(im.w - 1 - x, y, p); }
    o.pad = im.pad;
    return (im.flip = o);
  }
  // one figure into the room: base is the top of whatever they stand or sit behind, clip where it hides them
  function figure(im, c, x, t, o) {
    o = o || {};
    const spr = o.flip ? flipImg(c.sprite) : c.sprite, dip = o.still ? 0 : ((t / 3.1 + c.i * 0.37) % 1) < 0.42 ? 1 : 0;
    const sx = Math.round(x - spr.w / 2 + (o.lean || 0)), sy = Math.round(o.top !== undefined ? o.top : o.base - spr.h + (c.sprite.pad || 0) + (o.stand ? 6 : 10)) + dip + (o.dy || 0);
    const clip = o.clip === undefined ? 999 : o.clip;
    for (let y = 0; y < spr.h; y++) {
      const ty = sy + y;
      if (ty >= clip) break;
      for (let xx = 0; xx < spr.w; xx++) {
        const p = spr.get(xx, y);
        if (!p) continue;
        let c2 = mix(p, o.warm || "#ffb060", o.warmK === undefined ? 0.12 : o.warmK);
        if (o.dim) c2 = mix(c2, o.dimC || "#1a1220", o.dim);
        im.px(sx + xx, ty, c2);
      }
    }
    return { x: sx + spr.w / 2, top: sy };
  }
  // a cloth-covered trestle: top from y to y + 4, a drape to bottom with the town's stripe
  function clothTable(im, x0, x1, y, bottom, cloth, stripe) {
    const cl = C(cloth), st = C(stripe);
    for (let yy = y; yy < bottom; yy++) for (let x = x0; x < x1; x++) {
      const top = yy < y + 4;
      let c = top ? mix(cl, "#ffffff", yy === y ? 0.25 : 0.06 - (yy - y) * 0.03) : mix(cl, "#000000", 0.18 + (yy - y) * 0.012);
      if (!top && (x - x0) % 9 === 0) c = mix(c, "#000000", 0.12);
      if (!top && yy >= y + 7 && yy < y + 9) c = mix(st, "#000000", yy === y + 8 ? 0.2 : 0);
      if (yy === y + 4) c = mix(cl, "#000000", 0.35);
      if (yy === bottom - 1 && (x - x0) % 6 < 3) continue;
      im.px(x, yy, c);
    }
  }
  function loaf(im, x, y, col) { for (let j = 0; j < 4; j++) for (let i = -4; i <= 4; i++) if (Math.hypot(i / 4.5, (j - 3) / 3.6) < 1) im.px(x + i, y - 3 + j, mix(C(col || "#c88434"), j < 1 ? "#ffffff" : "#000000", j < 1 ? 0.25 : j > 2 ? 0.25 : 0)); im.px(x - 1, y - 2, "#f0c880"); im.px(x + 2, y - 2, "#f0c880"); }
  function jug(im, x, y) { for (let j = 0; j < 6; j++) for (let i = -2; i <= 2; i++) if (!(j === 0 && Math.abs(i) === 2)) im.px(x + i, y - 6 + j, i === -2 || i === 2 || j === 0 ? "#3a3a46" : i < 0 ? "#8a96b0" : "#5e6a86"); im.px(x + 3, y - 4, "#3a3a46"); im.px(x + 3, y - 3, "#3a3a46"); }
  function candle(im, x, y) { for (let j = 0; j < 4; j++) im.px(x, y - 4 + j, j === 0 ? "#fff0c0" : "#e8dcc0"); im.px(x, y - 5, "#ffd27a"); im.px(x, y - 6, "#ff9a3a"); }
  function pie(im, x, y, col) { for (let j = 0; j < 4; j++) for (let i = -5; i <= 5; i++) if (Math.hypot(i / 5.5, (j - 2) / 2.2) < 1) im.px(x + i, y - 4 + j, j === 0 || Math.abs(i) > 3 ? "#c88434" : (i + j) % 3 ? mix(C(col || "#e0a454"), "#000000", 0.1) : "#7a2a2a"); for (let i = -6; i <= 6; i++) im.px(x + i, y, "#8a8a92"); }
  function cake(im, x, y, col) { for (let j = 0; j < 6; j++) for (let i = -4; i <= 4; i++) im.px(x + i, y - 6 + j, j < 2 ? "#fbf4e4" : (j === 3 ? col || "#c8303a" : "#e0b070")); im.px(x, y - 7, "#c8303a"); for (let i = -6; i <= 6; i++) im.px(x + i, y, "#8a8a92"); }
  function numCard(im, x, y, n) { for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) im.px(x + i, y + j, j === 0 || i === 0 || i === 3 || j === 3 ? "#8a7a62" : "#fbf7ee"); for (let k = 0; k < n; k++) im.px(x + 1 + (k % 2), y + 1 + (k >> 1), "#2a1810"); }
  function rosette(img, x, y, k, col, ctr) {
    for (const [dx, a] of [[-1, -0.3], [1, 0.3]]) for (let j = 0; j < 7 * k; j++) for (let i = 0; i < 2 * k; i++) img.px(x + dx * (1 * k) + i - k + j * a * 0.5, y + 3 * k + j, j > 6 * k - k && (i + j) % 2 ? null : mix(C(col), "#000000", i < k ? 0 : 0.25));
    for (let j = -4 * k; j <= 4 * k; j++) for (let i = -4 * k; i <= 4 * k; i++) {
      const d = Math.hypot(i, j) / k, ang = Math.atan2(j, i);
      if (d > 4 + Math.sin(ang * 8) * 0.5) continue;
      img.px(x + i, y + j, d < 1.8 ? (d < 1 ? "#fff2a0" : ctr || "#e8b830") : d > 3.6 ? mix(C(col), "#000000", 0.35) : (Math.floor(ang * 8 / TAU * 2) % 2 ? col : mix(C(col), "#ffffff", 0.2)));
    }
  }
  function confetti(img, t, seed, n, cols) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) { const x = r() * W, sp = 30 + r() * 40, y = -10 + ((t * sp + r() * 160) % 170), c = cols[i % cols.length]; img.rect(x + Math.sin(t * 5 + i) * 3, y, 2, r() < 0.5 ? 2 : 1, c); }
  }

  // feast day: the long tables down the street at dusk under lanterns, the town at the back table, the feast dish in the middle of the crew's
  function feastRoom(r, lk) {
    const im = new Img(RW, RH, "#140c08"), rr = rng(r.seed + 9);
    for (let y = 0; y < 22; y++) for (let x = 0; x < RW; x++) im.px(x, y, mix(C("#1a1c3a"), C("#c8785a"), Math.pow(y / 22, 1.4)));
    for (let k = 0; k < 10; k++) im.px(rr() * RW, rr() * 9, k % 3 ? "#8a98b0" : "#fff6e0");
    const roofC = mix(C(lk.mantel || "#5e3a1e"), "#000000", 0.45);
    for (const [hx, hw, peak] of [[-6, 44, 6], [38, 40, 10], [78, 48, 5]]) {
      const ridge = (x) => peak + Math.abs(x - (hx + hw / 2)) * 0.55;
      for (let x = hx; x < hx + hw; x++) for (let y = Math.floor(ridge(x)); y < 46; y++) {
        if (x < 0 || x >= RW) continue;
        const roof = y < ridge(x) + 5;
        let c = roof ? mix(roofC, "#000000", (x + y) % 3 === 0 ? 0.25 : 0) : C(lk.wall(x / 9 + 0.3, (TABLE + 4 - y) * 1.15) || "#5e3a20");
        if (!roof) c = mix(c, "#141024", 0.42);
        if (x === hx || x === hx + hw - 1) c = mix(c, "#000000", 0.5);
        im.px(x, y, c);
      }
      for (const wx of [hx + 7, hx + hw - 13]) for (let j = 0; j < 7; j++) for (let i = 0; i < 6; i++) {
        if (wx + i < 0 || wx + i >= RW) continue;
        im.px(wx + i, peak + 16 + j, i === 0 || j === 0 || i === 5 || j === 6 || i === 3 ? lk.frame || "#3a2414" : j > 3 ? "#ffb85a" : "#ffd88a");
      }
    }
    for (let y = 40; y < TABLE; y++) for (let x = 0; x < RW; x++) im.px(x, y, ((x + (y % 2) * 3) % 6 === 0 || y % 3 === 0) ? "#2a2420" : pick(K.R(["#3a342e", "#4a423a", "#564c42"]), fbm(x / 3, y / 2, 4), x, y));
    const bt = lk.bunting || ["#c8463a", "#e8c060", "#3a5a8a"];
    for (const [y0, sag, flags] of [[12, 5, true], [5, 3, false]]) for (let x = 0; x < RW; x++) {
      const y = y0 + Math.sin((x / RW) * Math.PI) * sag;
      im.px(x, y, "#2a1a10");
      if (flags && x % 7 > 0 && x % 7 < 5) for (let j = 1; j < 4 - Math.abs((x % 7) - 2.5) + 0.5; j++) im.px(x, y + j, bt[Math.floor(x / 7) % bt.length]);
    }
    clothTable(im, 0, RW, 41, TABLE, lk.rug ? lk.rug[1] : "#d8c08a", lk.rug ? lk.rug[0] : "#8a2a24");
    return im;
  }
  const LANTERNS = [8, 26, 44, 62, 80, 98, 114];
  function feastLanterns(img, t) {
    LANTERNS.forEach((x, i) => {
      const y = 5 + Math.sin((x / RW) * Math.PI) * 3 + 2, fl = 0.8 + 0.2 * Math.sin(t * 7 + i * 1.7);
      glow(img, x * 2, y * 2 + 3, 14, "#ffb060", 0.18 * fl, 10);
      for (let j = 0; j < 5; j++) for (let i2 = -2; i2 <= 2; i2++) img.px(x * 2 + i2, y * 2 + j, j === 0 || j === 4 || Math.abs(i2) === 2 ? "#3a2414" : i2 < 0 ? "#fff0b0" : "#ffc060");
    });
  }

  // the baking contest: a striped marquee, the judges at their table, the entries in a row, and the hero as one of the bakers
  function contestRoom(r, lk) {
    const im = new Img(RW, RH, "#140c08"), bt = lk.bunting || ["#c8463a", "#e8c060"], a = C(bt[0]), cream = C("#efe6d2");
    for (let y = 0; y < TABLE; y++) for (let x = 0; x < RW; x++) {
      const band = Math.floor((x + 3) / 8) % 2, edge = (x + 3) % 8 === 0;
      let c = band ? a : cream;
      c = mix(c, "#2a1810", 0.12 + (y / TABLE) * 0.3 + Math.abs(x - RW / 2) / RW * 0.25);
      if (edge) c = mix(c, "#000000", 0.25);
      im.px(x, y, c);
    }
    for (let x = 0; x < RW; x++) { const sc = Math.floor(x / 8) % 2, d = 5 + (sc ? 0 : 1) - Math.abs((x % 8) - 3.5) * 0.4; for (let y = 0; y < d; y++) im.px(x, y, y === Math.floor(d) - 1 ? "#2a1810" : sc ? mix(a, "#000000", 0.1) : C(bt[1] || "#e8c060")); }
    for (const px of [1, RW - 3]) for (let y = 0; y < TABLE; y++) { im.px(px, y, "#5a3a20"); im.px(px + 1, y, "#3a2414"); }
    for (let j = 0; j < 10; j++) for (let i = 0; i < 56; i++) { const x = 4 + i, y = 7 + j + Math.round(Math.sin((i / 55) * Math.PI) * 1); im.px(x, y, j === 0 || j === 9 || i === 0 || i === 55 ? mix(C(lk.rug ? lk.rug[0] : "#8a2a24"), "#000000", 0.2) : "#f8f0dc"); }
    for (let y = 46; y < TABLE; y++) for (let x = 0; x < RW; x++) im.px(x, y, pick(K.R(["#6a5a30", "#7e6c3a", "#948046", "#a8925a"]), 0.3 + fbm(x / 2, y, 8) * 0.5, x, y));
    clothTable(im, 62, RW, 40, 47, lk.rug ? lk.rug[0] : "#8a2a24", "#e8c060");
    return im;
  }
  const JUDGES = [[76, 0], [94, 1], [110, 2]];

  // the cooks' feud: two stalls across the street from each other in the town's colours, a cook glaring out of each, the hero between
  function feudRoom(r, lk) {
    const im = new Img(RW, RH, "#0a0e18"), bt = lk.bunting || ["#c8463a", "#e8c060", "#3a5a8a"];
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const merlon = y >= 25 && y < 30 && x % 12 < 7;
      if (y < 30 && !merlon) { im.px(x, y, mix(C("#5a9ad0"), C("#b4daf0"), y / 30)); continue; }
      if (y >= 46) { im.px(x, y, ((x + (y % 2) * 3) % 6 === 0 || y % 3 === 0) ? "#5a5248" : pick(K.R(["#6e665a", "#7e7466", "#8a8070"]), fbm(x / 3, y / 2, 4), x, y)); continue; }
      const c = merlon ? "#6e604e" : mix(C(lk.wall(x / 9, (TABLE + 4 - y) * 1.1) || "#3a2a20"), "#7e6c58", 0.45);
      im.px(x, y, mix(C(c), "#fff4e0", 0.08));
    }
    const rr = rng(r.seed + 5);
    for (let k = 0; k < 3; k++) { const cx = 10 + rr() * 100, cy = 6 + rr() * 12; for (let j = -2; j <= 2; j++) for (let i = -9; i <= 9; i++) if (Math.hypot(i / 9, j / 2.4) < 1) im.px(cx + i, cy + j, j < 0 ? "#ffffff" : "#e2eef6"); }
    const other = bt.find((c, i) => i > 0 && c.toLowerCase() !== "#ece8e0" && c.toLowerCase() !== "#f4f0e4") || bt[1] || "#3a5a8a";
    stall(im, 0, 46, bt[0], true);
    stall(im, 74, RW, other, false);
    return im;
  }
  function stall(im, x0, x1, col, left) {
    const a = C(col), cream = C("#efe6d2");
    for (const px of [x0 + 2, x1 - 4]) for (let y = 12; y < TABLE; y++) { im.px(px, y, "#4a2e18"); im.px(px + 1, y, "#2e1c0e"); }
    for (let y = 22; y < TABLE; y++) for (let x = x0 + 4; x < x1 - 4; x++) im.px(x, y, mix(im.get(x, y) || [60, 40, 30], "#1a1008", 0.45));
    for (let x = x0 + 5; x < x1 - 5; x++) { im.px(x, 34, "#5a3418"); im.px(x, 35, "#3a2010"); }
    for (let k = 0; k < 6; k++) { const jx = x0 + 8 + k * 6; for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) im.px(jx + i, 30 + j, j === 0 ? "#c8b8a0" : ["#8a3a2a", "#c8a040", "#4e7a34"][k % 3]); }
    for (let y = 10; y < 21; y++) for (let x = x0; x < x1; x++) {
      const sc = Math.floor((x - x0) / 5) % 2, bottom = y >= 18;
      if (bottom && ((x - x0) % 5 === 0 || (y === 20 && (x - x0) % 5 !== 2))) continue;
      im.px(x, y, mix(sc ? a : cream, "#000000", y === 10 ? 0.3 : (y - 10) * 0.025));
    }
    const sx = left ? x1 - 16 : x0 + 4;
    for (let j = 0; j < 7; j++) for (let i = 0; i < 12; i++) im.px(sx + i, 22 + j, i === 0 || j === 0 || i === 11 || j === 6 ? "#3a2414" : "#8a6038");
    im.px(sx + 3, 21, "#2a1a10"); im.px(sx + 8, 21, "#2a1a10");
  }
  // the crackle of a long feud, eye to eye across the street
  function bolt(img, x0, y0, x1, y1, t, col) {
    const n = 9, r = rng(Math.floor(t * 14));
    let px = x0, py = y0;
    for (let i = 1; i <= n; i++) {
      const q = i / n, x = lerp(x0, x1, q), y = lerp(y0, y1, q) + (i < n ? (r() - 0.5) * 10 : 0);
      for (let k = 0; k <= 6; k++) { const xx = lerp(px, x, k / 6), yy = lerp(py, y, k / 6); img.px(xx, yy - 1, col, 0.5); img.px(xx, yy, "#fffbe8"); img.px(xx, yy + 1, col); }
      px = x; py = y;
    }
  }
  function gloom(img, x, y, t) {
    for (let j = 0; j < 4; j++) for (let i = -7; i <= 7; i++) if (Math.hypot(i / 7.5, (j - 2) / 2.6) < 1 || Math.hypot((i + 3) / 4, (j) / 2.4) < 1) img.px(x + i, y + j, j < 1 ? "#8a90a0" : "#5a6070");
    for (let k = 0; k < 4; k++) { const yy = y + 5 + ((t * 30 + k * 7) % 14); img.px(x - 5 + k * 3, yy, "#8ab0e0"); img.px(x - 5 + k * 3, yy + 1, "#6a90c8"); }
  }
  function sweat(img, x, y) { for (let j = 0; j < 5; j++) for (let i = -1; i <= 1; i++) if (Math.abs(i) <= (j > 1 ? 1 : 0)) img.px(x + i, y + j, j === 4 || Math.abs(i) === 1 ? "#4a7ab8" : "#b8e0ff"); }

  function eventBeats(r, ctx, ev, kit) {
    const { spec, serve, cast, lk, line, mode } = kit;
    const hero = cast[0], B = [];
    const cache = ctx.cache, once = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };
    const up = (img, rm) => blit(img, rm, 0, 0, 2);
    if (ev === "feast") {
      const xs = seatsFor(cast.length), plateX = cast.length > 1 ? RW / 2 : xs[0] + 18, MW = cast.length > 1 ? 40 : 28, MH = cast.length > 1 ? 16 : 11;
      const crowd = once("ev:crowd", () => [8, 22, 36, 50, 64, 78, 92, 106, 118].map((x, i) => ({ x, f: folk(r.seed + i * 31, { outfit: ["vest", "cloak", "leather"][i % 3] }) })).filter((c) => c.f));
      const ends = once("ev:ends", () => (cast.length < 4 ? [[-2, folk(r.seed + 401)], [RW + 2, folk(r.seed + 409)]] : []).filter((e) => e[1]));
      const room = () => once("ev:room", () => feastRoom(r, lk));
      const scene = (t, o) => {
        o = o || {};
        const rm = room().copy(), heads = [];
        crowd.forEach((c, i) => figure(rm, c.f, c.x, t, { base: 41, clip: 42, dim: 0.46, lean: o.cheer && (i + Math.floor(t * 3)) % 2 ? 1 : 0, dy: o.cheer && ((t * 3 + i) % 1) < 0.5 ? -1 : 0 }));
        if (o.cheer) crowd.forEach((c, i) => { if (i % 2 === 0) { const mx = c.x + 5, my = 22 + ((t * 3 + i) % 1 < 0.5 ? -2 : 0); mug(rm, mx, my); } });
        clothTable(rm, 0, RW, TABLE, RH, lk.rug ? lk.rug[1] : "#d8c08a", lk.rug ? lk.rug[0] : "#8a2a24");
        ends.forEach(([x, f]) => figure(rm, f, x, t, { base: TABLE, clip: TABLE + 1 }));
        cast.forEach((c, i) => heads.push(figure(rm, c, xs[i], t, { base: TABLE, clip: TABLE + 1, lean: o.lean ? o.lean(i) : 0, dy: o.cheer && ((t * 2.4 + i * 0.3) % 1) < 0.5 ? -1 : 0 })));
        for (let k = 0; k < 7; k++) { const x = 8 + k * 17; if (Math.abs(x - plateX) < 22) continue; [loaf, jug, candle][k % 3](rm, x, TABLE + 2); }
        cast.forEach((c, i) => { if (Math.abs(xs[i] - plateX) > 8) emptyPlate(rm, xs[i], TABLE + 3, false); if (!o.cheer) mug(rm, xs[i] + 9, TABLE - 3); });
        if (o.cheer) heads.forEach((hd, i) => mug(rm, hd.x + 4, hd.top - 3 - ((t * 2.4 + i * 0.3) % 1 < 0.5 ? 1 : 0)));
        return { rm, heads };
      };
      const banner = (img, t) => {
        feastLanterns(img, t);
        const s = "FEAST DAY", tw = textWidth(s, { bold: true }) + 16, bx = 120 - tw / 2;
        for (let j = 0; j < 15; j++) for (let i = 0; i < tw; i++) img.px(bx + i, 24 + j + Math.round(Math.sin((i / tw) * Math.PI) * 2), j === 0 || j === 14 ? "#2a1408" : j < 3 || j > 11 ? mix(C((lk.bunting || ["#c8463a"])[0]), "#000000", 0.25) : (lk.bunting || ["#c8463a"])[0]);
        text(img, s, 120, 37, "#fff4d8", { bold: true, center: true, outline: "#2a1408" });
      };
      const night = (img) => glow(img, 120, 40, 120, "#ffb060", 0.08, 60);
      B.push({ id: "room", dur: 2.8, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
        up(img, scene(t, { cheer: t > 1.4 && t < 2.4 }).rm); banner(img, t); night(img);
        sfx(img, "huzzah!", 120, 74, t - 1.4, { k: 2, center: true, shake: 1, fade: 1.0, fill: () => "#fff0c8" });
      }, sfx: [[0, "room", 22], [1.4, "rumble", 1]] });
      B.push({ id: "arrive", dur: 2.2, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
        const { rm } = scene(t, { lean: (i) => (t > 0.9 ? (xs[i] < plateX ? 1 : xs[i] > plateX ? -1 : 0) : 0) });
        const m = mini(ctx, "mini" + MW, MW, MH, serve), u = seg(t, 0.1, 0.55), py = lerp(-20, TABLE + 2, u * u);
        plateAt(rm, m, plateX, py);
        up(img, rm); banner(img, t); night(img);
        for (let i = 0; i < 3; i++) steam(img, plateX * 2 - 10 + i * 10, py * 2 - 8, 26, t * 1.4 + i, 0.32 * seg(t, 0.6, 1.2), 3, 2);
        sfx(img, "thud.", plateX * 2 - 10, 136, t - 0.55, { k: 2, fade: 1.0, fill: () => "#f4e8d0" });
        return { shake: u >= 1 && t < 0.7 ? [0, 1] : null };
      }, sfx: [[0.55, "thud", 1]] });
      B.push(zoomBeat(r, ctx, kit, (t) => { const { rm } = scene(t + 2); plateAt(rm, mini(ctx, "mini" + MW, MW, MH, serve), plateX, TABLE + 2); return rm; }, plateX, cast.length > 1, (img, t) => { banner(img, t + 2); night(img); }));
      B.push(macroBeat(r, kit));
      if (cast.length > 1) {
        B.push({ id: "hush", dur: 2.8, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
          const { rm } = scene(t + 4, { cheer: t > 0.5 });
          emptyPlate(rm, plateX, TABLE + 2, true); emptyPlate(rm, plateX + 2, TABLE + 1, true);
          up(img, rm); banner(img, t + 4); night(img);
          sfx(img, "CHEERS!", 120, 74, t - 0.5, { k: 2, center: true, shake: 1, fade: 1.8, fill: () => "#fff0c8" });
          if (t > 0.6) for (let i = 0; i < 6; i++) sparkleAt(img, 20 + i * 40, 50 + (i % 2) * 14, (t + i * 0.3) % 1.2, 0.1, 2);
        }, sfx: [[0.5, "clink", 1], [0.62, "clink", 1], [0.7, "chime", 1]] });
        B.push(crewCut(r, ctx, kit));
      } else B.push(...soloCut(r, ctx, kit));
      return B;
    }
    if (ev === "contest") {
      const won = r.verdict === "great", hx = 22, rx = 48;
      const judges = once("ev:judges", () => JUDGES.map(([x, k]) => ({ x, f: folk(r.seed + 700 + k * 13, { cook: k === 1, outfit: k === 1 ? "vest" : ["cloak", "leather"][k % 2] }) })).filter((j) => j.f));
      const rival = once("ev:rival", () => folk(r.seed + 777, { cook: true, outfit: "vest" }));
      const room = () => once("ev:room", () => contestRoom(r, lk));
      const MW = 26, MH = 11;
      const scene = (t, o) => {
        o = o || {};
        const rm = room().copy(), heads = [];
        judges.forEach((j, i) => heads.push(figure(rm, j.f, j.x, t, { base: 40, clip: 41, lean: o.lean ? o.lean(i) : 0 })));
        clothTable(rm, 62, RW, 40, 47, lk.rug ? lk.rug[0] : "#8a2a24", "#e8c060");
        for (const [x, c] of [[70, "#efe9dc"], [86, "#efe9dc"], [102, "#efe9dc"], [116, "#efe9dc"]]) { for (let i = -2; i <= 2; i++) rm.px(x + i, 39, c); rm.px(x + 3, 38, "#8a8a92"); }
        const me = figure(rm, hero, hx, t, { base: TABLE, stand: true, clip: TABLE + 1, dy: o.bounce && ((t * 3) % 1) < 0.5 ? -2 : 0 });
        const them = rival ? figure(rm, rival, rx, t, { base: TABLE, stand: true, clip: TABLE + 1, dy: o.rivalBounce && ((t * 3) % 1) < 0.5 ? -2 : 0 }) : null;
        clothTable(rm, 0, RW, TABLE, RH, "#efe9dc", lk.rug ? lk.rug[0] : "#8a2a24");
        plateAt(rm, mini(ctx, "mini" + MW, MW, MH, serve), hx, TABLE + 1);
        if (o.bite) for (let j = 0; j < 4; j++) for (let i = 0; i < 4 - j; i++) rm.px(hx + 8 - i, TABLE - 3 + j, "#efe9dc");
        cake(rm, rx, TABLE + 2, (lk.bunting || ["#c8303a"])[0]);
        pie(rm, 72, TABLE + 2); loaf(rm, 88, TABLE + 1, "#a86a26"); pie(rm, 104, TABLE + 2, "#c8a050"); loaf(rm, 117, TABLE + 1);
        [[hx - 4, 1], [rx - 2, 2], [70, 3], [86, 4], [102, 5]].forEach(([x, n]) => numCard(rm, x, TABLE + 4, Math.min(4, n)));
        return { rm, heads, me, them };
      };
      const banner = (img) => text(img, "BAKING CONTEST", 64, 30, (lk.rug || ["#8a2a24"])[0], { bold: true, center: true });
      B.push({ id: "room", dur: 2.6, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
        const { rm, heads } = scene(t); up(img, rm); banner(img);
        sfx(img, "ahem.", heads[1] ? heads[1].x * 2 + 16 : 190, 34, t - 1.0, { k: 1, fade: 1.2, fill: () => "#2a1810" });
      }, sfx: [[0, "room", 24], [1.0, "pop", 0]] });
      B.push({ id: "taste", dur: 3.0, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
        const s = scene(t, { bite: t > 0.8, lean: (i) => (t > 0.3 && t < 2.6 ? -1 : 0) });
        up(img, s.rm); banner(img);
        const says = ["hmm.", won ? "oh!" : "mm.", "..."];
        s.heads.forEach((hd, i) => MK.bubble(img, says[i], hd.x * 2, hd.top * 2 - 2, t - 0.6 - i * 0.6, 0));
        if (t > 0.8) sweat(img, s.me.x * 2 + 12, s.me.top * 2 + 6);
      }, sfx: [[0.6, "pop", 0], [1.2, "pop", 1], [1.8, "pop", 2], [2.3, "scribble", 1]] });
      B.push(zoomBeat(r, ctx, kit, (t) => scene(t + 3, { bite: true }).rm, hx, false, banner));
      B.push(macroBeat(r, kit));
      B.push({ id: "ribbon", dur: 3.2, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
        const s = scene(t, { bite: true, bounce: won && t > 1.0, rivalBounce: !won && t > 1.0 });
        up(img, s.rm); banner(img);
        const tx = (won ? hx : rx) * 2 + 14, ty = TABLE * 2 - 4, u = ease3(seg(t, 0.2, 0.9));
        rosette(img, tx + Math.sin(t * 6) * (1 - u) * 10, lerp(-20, ty, u), 2, won ? "#2a5ab8" : "#2a5ab8", "#e8b830");
        if (won) { if (t > 0.9) confetti(img, t - 0.9, r.seed, 60, ["#e8b830", "#2a5ab8", "#c8303a", "#ffffff", (lk.bunting || ["#3a7a4a"])[0]]); sfx(img, "FIRST PRIZE!", 72, 60, t - 1.0, { k: 2, center: true, shake: 1 }); }
        else { if (t > 1.0) for (let i = 0; i < 4; i++) sparkleAt(img, rx * 2 - 20 + i * 14, ty - 20 - (i % 2) * 10, (t + i * 0.3) % 1.1, 0.1, 2); sweat(img, s.me.x * 2 + 12, s.me.top * 2 + 6); sfx(img, "next year.", 72, 60, t - 1.3, { k: 2, center: true, fill: () => "#f4e8d0" }); }
      }, sfx: won ? [[0.9, "fanfare", 1], [1.0, "sparkle", 1]] : [[0.9, "chime", 1], [1.3, "sad", 1]] });
      B.push(...soloCut(r, ctx, kit).filter((b) => b.id === "cutin"));
      return B;
    }
    // the feud: the hero stands in the street between the two stalls
    const pick2 = r.line === "...both?" ? -1 : (r.seed >>> 3) % 2, hx = 60, cx = [20, 100];
    const cooks = once("ev:cooks", () => [folk(r.seed + 801, { cook: true, outfit: "vest" }), folk(r.seed + 833, { cook: true, cap: (r.seed & 1) === 0, outfit: "leather" })]);
    const room = () => once("ev:room", () => feudRoom(r, lk));
    const MW = 14, MH = 6;
    const scene = (t, o) => {
      o = o || {};
      const rm = room().copy(), heads = [];
      cooks.forEach((c, i) => { if (c) heads.push(figure(rm, c, cx[i], t, { base: TABLE, stand: true, clip: TABLE + 1, flip: i === 1, dy: o.dy ? o.dy(i) : 0, lean: o.lean ? o.lean(i) : 0 })); else heads.push({ x: cx[i], top: 28 }); });
      for (const [x0, x1] of [[0, 46], [74, RW]]) for (let y = TABLE; y < RH; y++) for (let x = x0; x < x1; x++) {
        const top = y < TABLE + 4, c = top ? pick(K.R(["#5a361a", "#7a4c26", "#94602e"]), 0.4 + (fbm(x / 8, y, 3) - 0.5) * 0.5, x, y) : (x - x0) % 12 < 1 ? "#1a0e06" : pick(K.R(["#2a180c", "#3a2212", "#4a2c16"]), 0.5 - (y - TABLE) * 0.03, x, y);
        rm.px(x, y, y === TABLE ? "#b8803e" : c);
      }
      const m = mini(ctx, "mini" + MW, MW, MH, serve);
      plateAt(rm, m, 36, TABLE + 1); plateAt(rm, m, 84, TABLE + 1);
      const face = o.face ? o.face(t) : Math.floor(t / 0.7) % 2 === 0;
      const me = figure(rm, hero, hx, t, { top: RH - 2 - hero.sprite.h, flip: !face, lean: o.heroLean || 0 });
      return { rm, heads, me };
    };
    const signs = (img) => { const m = mini(ctx, "mini10", 10, 5, serve); for (const sx of [30, 78]) blit(img, m, (sx + 1) * 2, 23 * 2, 2); };
    const eyes = (hd, i) => [hd.x * 2 + (i === 0 ? 6 : -6), hd.top * 2 + 22];
    B.push({ id: "room", dur: 2.8, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
      const s = scene(t);
      up(img, s.rm); signs(img);
      if (t > 0.6) { const [ax, ay] = eyes(s.heads[0], 0), [bx, by] = eyes(s.heads[1], 1); bolt(img, ax, ay, bx, by, t, "#ffd24a"); }
      sfx(img, "grr", 30, 50, t - 0.9, { k: 1, shake: 1, fade: 1.4 }); sfx(img, "grr", 186, 50, t - 1.2, { k: 1, shake: 1, fade: 1.4 });
    }, sfx: [[0, "room", 24], [0.6, "hiss", 1], [0.9, "rumble", 1]] });
    B.push({ id: "taste", dur: 3.0, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
      const side = t < 1.1 ? 0 : t < 2.1 ? 1 : 0, s = scene(t, { face: () => side === 1, lean: (i) => (i === side ? (i === 0 ? 2 : -2) : 0) });
      up(img, s.rm); signs(img);
      const ph = (t < 1.1 ? t - 0.2 : t < 2.1 ? t - 1.2 : t - 2.2) / 0.7, reach = Math.sin(clamp(ph, 0, 1) * Math.PI);
      if (ph > 0 && ph < 1) {
        const from = s.heads[side], fx = from.x * 2 + (side === 0 ? 14 : -14), fy = from.top * 2 + 34, tx2 = s.me.x * 2 + (side === 0 ? -8 : 8), ty2 = s.me.top * 2 + 22;
        const ex = lerp(fx, tx2, reach), ey = lerp(fy, ty2, reach);
        img.line(fx, fy, ex, ey, "#5a3a20"); img.line(fx, fy + 1, ex, ey + 1, "#3a2414");
        for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) if (Math.hypot(i / 3.4, j / 2.4) < 1) img.px(ex + i, ey + j, j < 0 ? "#d8d4cc" : "#a8a4a0");
      }
      sfx(img, "nom", s.me.x * 2 - 10, s.me.top * 2 - 4, (t % 1) - 0.55, { k: 1, fade: 0.3, fill: () => "#fff4dc" });
      if (t > 2.2) MK.bubble(img, "again?", s.me.x * 2, s.me.top * 2 - 2, t - 2.2, 0);
    }, sfx: [[0.55, "slurp", 1], [1.55, "slurp", 1], [2.55, "slurp", 1]] });
    B.push(zoomBeat(r, ctx, kit, (t) => scene(t + 3).rm, 36, false, signs));
    B.push(macroBeat(r, kit));
    B.push({ id: "pick", dur: 3.0, base: () => new Img(W, H, "#000000"), draw: (img, t) => {
      const go = t > 0.6, s = scene(t, { face: () => (pick2 < 0 ? Math.floor(t / 0.3) % 2 === 0 : pick2 === 1), heroLean: go && pick2 >= 0 ? (pick2 === 0 ? -2 : 2) : 0,
        dy: (i) => (!go ? 0 : pick2 < 0 ? 0 : i === pick2 ? (((t * 3) % 1) < 0.5 ? -3 : 0) : 2) });
      up(img, s.rm); signs(img);
      if (pick2 < 0) {
        if (go) s.heads.forEach((hd, i) => { const [ax, ay] = eyes(hd, i); bolt(img, ax, ay, s.me.x * 2, s.me.top * 2 + 18, t + i, "#ffd24a"); });
        sweat(img, s.me.x * 2 + 12, s.me.top * 2 + 4);
        sfx(img, "...both?", 120, 40, t - 0.4, { k: 2, center: true, fill: () => "#2a1810" });
      } else {
        const w = s.heads[pick2], l = s.heads[1 - pick2];
        sfx(img, "HA!", w.x * 2 + (pick2 === 0 ? -10 : -20), w.top * 2 - 4, t - 0.7, { k: 2, shake: 1 });
        if (go) { for (let i = 0; i < 4; i++) sparkleAt(img, w.x * 2 - 16 + i * 12, w.top * 2 + (i % 2) * 8, (t + i * 0.3) % 1.1, 0.1, 2); gloom(img, l.x * 2, l.top * 2 - 12, t); }
      }
    }, sfx: pick2 < 0 ? [[0.6, "hiss", 1], [0.7, "gasp", 1]] : [[0.6, "swish", 1], [0.7, "pop", 0], [0.9, "sad", 1]] });
    B.push(...soloCut(r, ctx, kit).filter((b) => b.id === "cutin"));
    return B;
  }
  M.tavernBeats = beats;
  M.tavernKit = { room, face, mini };
})(typeof window !== "undefined" ? window : globalThis);
