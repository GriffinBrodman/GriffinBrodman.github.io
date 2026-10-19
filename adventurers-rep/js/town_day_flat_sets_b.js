/* The market, the square and the green seen side-on: stalls under striped awnings, a fountain (or a well and a market cross) on ringed paving, a green with a tree, a pond and a fair; the flat camera of town_day_flat.js. */
(function (root) {
  "use strict";
  const R = Math.round;
  const K = () => root.TownSets.kit;
  const flip = (rows) => rows.map((s) => s.split("").reverse().join(""));

  // ---------- small painters ----------
  function ellipse(g, cx, cy, rx, ry, col) {
    for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const c = typeof col === "function" ? col(dx, dy, x, y) : col;
      if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
    }
  }
  // a soft shadow on the ground under something standing at y
  function shadow(k, x0, x1, y, h) {
    for (let j = 0; j < h; j++) { k.ctx.fillStyle = `rgba(20,12,8,${0.22 - j * 0.05})`; k.ctx.fillRect(x0 + j, y - 1 + j, x1 - x0 - j * 2, 1); }
  }
  // a piece sorted with the cast whose picture changes: base (painted once) under fn's moving parts, redrawn each frame
  function live(k, y, base, fn) {
    const cv = k.piece(), g = cv.getContext("2d");
    const draw = (t, still) => { g.clearRect(0, 0, cv.width, cv.height); if (base) g.drawImage(base, 0, 0); fn(g, t, still); };
    draw(1.3, true);
    k.add(y, cv);
    k.anims.push((c, t, still) => draw(t, still));
  }
  function post(g, x, y0, y1, col) {
    const c = col || "#4a2e18";
    g.fillStyle = c; g.fillRect(x, y0, 2, y1 - y0); g.fillStyle = K().shade(c, 0.3); g.fillRect(x, y0, 1, y1 - y0);
  }
  // a townsperson standing behind something (a stall's seller), shifting their weight now and then
  function folkAt(k, x, y, face, seed) {
    let fig = null;
    return (g, t, still) => {
      if (!fig) { if (!root.TownActs || !TownActs.folk) return; try { fig = TownActs.folk("local", k.town + "flat" + seed); } catch (e) { fig = false; } }
      if (!fig) return;
      const img = fig.f.img[face > 0 ? 1 : "-1"], dip = !still && K().frac(t / 3.1 + seed * 0.37) < 0.4 ? 1 : 0;
      g.drawImage(img, 0, 0, img.width, 22, R(x) - (img.width >> 1), R(y) - img.height + 1 + dip, img.width, 22);
      g.drawImage(img, 0, 22, img.width, img.height - 22, R(x) - (img.width >> 1), R(y) - img.height + 23, img.width, img.height - 22);
    };
  }

  // ---------- the goods: heaps of the town's wares on the counters ----------
  const ITEMS = {
    round: [".ab.", "abbc", "bbcc", ".cc."], big: [".abb.", "abbbc", "abbcc", "bbccc", ".ccc."], loaf: [".aaa.", "abbba", "bbbbc", ".ccc."], fish: ["d.aaaa.", "dbbbbbe", "d.cccc."],
    bar: [".aaaa", "abbbc", "ccccc"], wheel: [".aaaa.", "abbbbc", "dddddd", ".cccc."], jar: [".dd.", "aabb", "abbc", "abbc", ".cc."], bolt: ["aaaaab", "bbbbbc", "cccccd"],
    leaf: [".aaa.", "abbba", "abccb", "bcccb", ".cc."], shroom: [".aaa.", "abbbc", "..w..", ".ww.."], fur: [".aaaaa.", "abbbbbc", "bbccccc"], shell: [".aa.", "abbc", "bccc"], pot: [".dd.", "abbc", "abbc", ".cc."],
  };
  const LAID = new Set(["fish", "bar", "bolt", "fur", "loaf"]);
  const vary = (c, r, a) => K().shade(c, (r() - 0.5) * (a || 0.16));
  function item(g, x, y, kind, col) {
    const rows = ITEMS[kind] || ITEMS.round, w = rows[0].length, { shade, pix } = K();
    pix(g, R(x - w / 2), R(y - rows.length), rows, { a: shade(col, 0.4), b: col, c: shade(col, -0.25), d: shade(col, -0.5), e: "#14100c", w: "#ece2c8" });
  }
  function heap(g, x, y, kind, col, r, n) {
    const rows = ITEMS[kind] || ITEMS.round, w = rows[0].length - 1, laid = LAID.has(kind);
    const layers = laid ? [3, 3, 2] : n === 2 ? [2, 1] : [3, 2, 1], h = laid ? 2 : Math.max(2, rows.length - 2);
    layers.forEach((cnt, row) => {
      for (let i = 0; i < cnt; i++) item(g, x + (i - (cnt - 1) / 2) * (w - 1) + (laid ? (row % 2 ? 1 : -1) : R(r() - 0.5)), y - row * h, kind, vary(col, r));
    });
  }
  // what each town's stalls heap up, and what hangs from the awnings' rails
  const WARES = {
    ironhaven: { w: [["bar", "#a8a8b4"], ["big", "#b83a2a"], ["loaf", "#c8904a"]], hang: "shoe" },
    thornwall: { w: [["loaf", "#d8a048"], ["round", "#d8702a"], ["leaf", "#8aa83a"]], hang: "garlic" },
    veldrock: { w: [["bar", "#8a8a92"], ["pot", "#c86a3a"], ["round", "#8a6a4a"]], hang: "sausage" },
    carrbridge: { w: [["leaf", "#8ab84a"], ["wheel", "#e8c050"], ["big", "#c84a3a"]], hang: "herbs" },
    ashfen: { w: [["fish", "#7a9a7a"], ["leaf", "#6a8a5a"], ["jar", "#8a6a8a"]], hang: "herbs" },
    hollowood: { w: [["big", "#d86a3a"], ["shroom", "#a8784a"], ["jar", "#d8b84a"]], hang: "herbs" },
    saltmarrow: { w: [["fish", "#b8c4cc"], ["round", "#e8a040"], ["shell", "#ecdccc"]], hang: "fish" },
    frosthold: { w: [["fish", "#c8d4dc"], ["fur", "#8a6a4a"], ["round", "#c8603a"]], hang: "sausage" },
  };
  const HANG = {
    sausage: { rows: [".k.", "aba", "bbc", ".c.", "aba", "bbc", ".c.", "aba", "bbc", ".c."], col: "#9a3a2a" },
    garlic: { rows: [".k.", "aba", "bbb", "aba", "bbb", ".b.", "aba", "bbc", ".c."], col: "#ece4d0" },
    herbs: { rows: [".k.", ".k.", "aba", "abbc", "bbbc", ".bc.", ".b."], col: "#6a8a3a" },
    fish: { rows: [".k.", ".a.", "abc", "abc", "abc", ".b.", "a.c"], col: "#a8b4bc" },
    shoe: { rows: [".k.", ".k.", "a.c", "a.c", "b.c", ".b."], col: "#8a8a94" },
  };
  const SACK = ["...xx.....", "..xyyx....", ".xyyyyxx..", "xyyzyyyyx.", "xyyyyyzyyx", "xyzyyyyyyx", "xyyyyyyzyx", "xyyyyyyyyx", "xzyyyyyyzx", ".xxyyyyxx.", "...xxxx..."];
  function sack(g, x, y, col) { const { shade, pix } = K(); pix(g, R(x) - 5, R(y) - 11, SACK, { x: shade(col, -0.45), y: col, z: shade(col, -0.15) }); }
  function basket(g, x, y, ware, r) {
    if (ware) heap(g, x, y - 5, ware[0], ware[1], r, 2);
    K().pix(g, R(x) - 5, R(y) - 6, ["xxxxxxxxxx", "xwywywywyx", "xywywywywx", ".xwywywyx.", "..xxxxxx.."], { x: "#6a4220", w: "#b8844a", y: "#946232" });
  }
  function crateAt(g, x, y, col, ware, r) {
    const { shade } = K(), c0 = col || "#a07a48";
    g.fillStyle = shade(c0, -0.4); g.fillRect(x - 7, y - 11, 14, 11);
    g.fillStyle = c0; g.fillRect(x - 6, y - 10, 12, 9);
    for (const yy of [y - 7, y - 4]) { g.fillStyle = shade(c0, -0.22); g.fillRect(x - 6, yy, 12, 1); }
    g.fillStyle = shade(c0, 0.22); g.fillRect(x - 6, y - 10, 12, 1);
    g.fillStyle = shade(c0, -0.3); g.fillRect(x - 6, y - 10, 1, 9); g.fillRect(x + 5, y - 10, 1, 9);
    if (ware) heap(g, x, y - 10, ware[0], ware[1], r, 2);
  }
  // a tub of flowers (or a stone trough of them), snowed over in the cold
  function tub(k, x, y, seed, stone) {
    const { pix, shade, h01 } = K(), S = k.S, body = stone ? S.stone[0] : "#7a5230";
    const cols = S.snow ? ["#e8eef4", "#dfe6ee"] : [["#d84a5a", "#f0c040", "#e86a9a", "#f4f0e4"][seed % 4], ["#f0c040", "#8a5ac8", "#d84a5a"][seed % 3]];
    k.prop(y, (g) => {
      pix(g, x - 6, y - 7, ["xyyyyyyyyyx", "xyzyyyyyzyx", ".xyyyyyyyx.", ".xyzyyyyyx.", "..xxxxxxx.."].concat(["..x.....x.."]), { x: shade(body, -0.4), y: body, z: stone ? shade(body, -0.15) : "#4a4a52" });
      for (let i = 0; i < 22; i++) {
        const dx = R((h01(i, seed) - 0.5) * 11), dy = R(h01(i, seed + 3) * 7);
        g.fillStyle = S.snow ? "#5a7058" : i % 3 ? "#4e8a32" : "#3a6a26"; g.fillRect(x + dx, y - 8 - dy, 1, 2 + (i % 2));
        if (i % 2) { g.fillStyle = cols[i % 4 < 2 ? 0 : 1]; g.fillRect(x + dx, y - 9 - dy, 1 + (i % 3 === 0 ? 1 : 0), 1 + (i % 5 === 0 ? 1 : 0)); }
      }
      if (S.snow) { g.fillStyle = "#f4f8fc"; g.fillRect(x - 5, y - 8, 10, 1); }
    });
  }

  // ---------- the living things ----------
  const PIGEON = [["....hh.", "...hhek", ".bbbnn.", "bwwwbb.", ".bbbb..", "..f.f.."], [".......", ".......", "bbbb...", "bwwwbn.", ".bbbbhh", "..f.fek"]];
  const PIG_PAL = [{ h: "#6a7088", e: "#1a1414", k: "#3a3434", b: "#9a9eaa", n: "#5a8a7a", w: "#7a7e8c", f: "#c87a6a" }, { h: "#8a7a6a", e: "#1a1414", k: "#3a3434", b: "#c8beb0", n: "#7a8a6a", w: "#9a8a78", f: "#c87a6a" }];
  // pigeons pecking about the stones, hopping round now and then
  function pigeons(k, list) {
    const { frac, pix } = K();
    k.anims.push((c, t, still) => {
      list.forEach(([x, y, face], i) => {
        const lt = (still ? 1.3 : t) + i * 1.7, hop = Math.floor(lt / 5.3 + i * 0.3) % 2, peck = !still && frac(lt * 0.8 + i * 0.37) < 0.3;
        const f = hop ? -face : face, up = !still && frac(lt / 5.3 + i * 0.3) < 0.04 ? 2 : 0, X = R(x + (hop ? 3 : 0));
        c.fillStyle = "rgba(20,12,8,0.25)"; c.fillRect(X - 3, y, 7, 1);
        pix(c, X - 3, y - 6 - up, f > 0 ? PIGEON[peck ? 1 : 0] : flip(PIGEON[peck ? 1 : 0]), PIG_PAL[i % 3 === 2 ? 1 : 0]);
      });
    });
  }
  // bunting on a sagging string between two points, the flags stirring
  function bunting(k, x0, y0, x1, y1, sag, cols) {
    const { shade } = K();
    k.overs.push((c, t, still) => {
      const n = Math.max(6, R(Math.hypot(x1 - x0, y1 - y0) / 6));
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) { const s = (x - x0) / (x1 - x0); c.fillStyle = "#3a2a1a"; c.fillRect(x, R(y0 + (y1 - y0) * s + Math.sin(s * Math.PI) * sag), 1, 1); }
      for (let i = 0; i < n; i++) {
        const s = (i + 0.5) / n, x = R(x0 + (x1 - x0) * s), y = R(y0 + (y1 - y0) * s + Math.sin(s * Math.PI) * sag), col = cols[i % cols.length], w = still ? 0 : R(Math.sin(t * 3 + i * 0.9) * 0.7);
        c.fillStyle = col; c.fillRect(x - 2, y + 1, 5, 1); c.fillRect(x - 1, y + 2, 3, 1); c.fillRect(x - 1, y + 3, 3, 1); c.fillRect(x + w, y + 4, 1, 1);
        c.fillStyle = shade(col, 0.3); c.fillRect(x - 2, y + 1, 5, 1); c.fillStyle = shade(col, -0.25); c.fillRect(x + 1, y + 2, 1, 2);
      }
    });
  }

  // ---------- the market ----------
  // a stall face-on: the counter with its cloth skirt and heaped trays at the front, posts and a striped awning over the seller behind,
  // things hung from the rail; o: { x0, x1, y (the counter's foot), ab, af (the awning's back and front edges), wares, hang, cols, scale, lantern, mid, seller, sx }
  function stall(k, o) {
    const { S, L, r } = k, { shade, pix, h01 } = K();
    const { x0, x1, y } = o, cols = o.cols || S.awning, ct = y - 16, ab = o.ab || 22, af = o.af || 30, wood = "#8a5a32", mid = o.mid != null ? o.mid : (x0 + x1) >> 1;
    shadow(k, x0 - 3, x1 + 3, y + 1, 3);
    k.ctx.fillStyle = "rgba(20,12,8,0.12)"; k.ctx.fillRect(x0 - 2, y - 8, x1 - x0 + 4, 9);
    // the back: two posts and the rail the awning hangs from, the day's stock stacked at the ends
    k.prop(y - 7, (g) => {
      g.fillStyle = "rgba(20,12,8,0.2)"; g.fillRect(x0 + 1, af + 2, x1 - x0 - 2, ct - af - 2); g.fillRect(x0 + 1, af + 2, x1 - x0 - 2, 3);
      for (const px of [x0 + 1, x1 - 3]) post(g, px, ab, y - 7);
      g.fillStyle = shade(wood, -0.4); g.fillRect(x0 + 1, ab, x1 - x0 - 2, 2);
      crateAt(g, x0 + 9, y - 7, "#8a6236"); crateAt(g, x0 + 9, y - 18, "#7a5a36");
      sack(g, x1 - 9, y - 7, "#c8b48a");
    });
    if (o.seller != null) live(k, y - 5, null, folkAt(k, o.sx, y - 5, o.sface || 1, o.seller));
    k.prop(y, (g) => {
      // the counter: planks, a top seen from just above, a cloth skirt in the stall's stripes with a scalloped hem
      for (let yy = ct; yy < y; yy++) for (let x = x0; x < x1; x++) {
        const f = (x - x0) % 5;
        g.fillStyle = f === 0 ? "#4a2e18" : yy >= y - 2 ? "#5a3a1e" : f === 1 ? "#9a6a3a" : h01(x, yy >> 2) > 0.9 ? "#7a4e2a" : "#845a32"; g.fillRect(x, yy, 1, 1);
      }
      for (let x = x0 - 1; x <= x1; x++) { g.fillStyle = (x - x0) % 9 === 0 ? "#7a5030" : "#a8784a"; g.fillRect(x, ct - 3, 1, 3); }
      g.fillStyle = "#c8946a"; g.fillRect(x0 - 1, ct - 3, x1 - x0 + 2, 1); g.fillStyle = "#5a3a1e"; g.fillRect(x0 - 1, ct, x1 - x0 + 2, 1);
      const sw = 6;
      for (let x = x0 + 1; x < x1 - 1; x++) {
        const s = Math.floor((x - x0 - 1) / sw), f = (x - x0 - 1) % sw, col = s % 2 ? cols[0] : cols[1], e = Math.abs(f - (sw - 1) / 2), hem = 8 + (e < 1 ? 2 : e < 2 ? 1 : 0);
        for (let j = 0; j < hem; j++) { g.fillStyle = j === 0 ? shade(col, 0.18) : j >= hem - 1 ? shade(col, -0.22) : f === 0 ? shade(col, -0.1) : col; g.fillRect(x, ct + 1 + j, 1, 1); }
      }
      // the wares on trays, two rows deep, the back row higher; a slate with the prices chalked on it
      const W = o.wares, n = Math.max(2, Math.floor((x1 - x0 - 4) / 13));
      for (const [row, ty] of [[0, ct - 3], [1, ct - 1]]) for (let i = 0; i < n - row; i++) {
        const cx = R(x0 + 4 + ((i + 0.5 + row * 0.5) * (x1 - x0 - 8)) / n), [kind, col] = W[(i + row) % W.length], low = Math.abs(cx - mid) < 11;
        if (low && row === 0) continue;
        g.fillStyle = "#4a2e18"; g.fillRect(cx - 6, ty, 13, 1); g.fillStyle = "#7a5230"; g.fillRect(cx - 6, ty - 1, 13, 1); g.fillStyle = "#946a40"; g.fillRect(cx - 6, ty - 2, 1, 1); g.fillRect(cx + 6, ty - 2, 1, 1);
        heap(g, cx, ty - 1, kind, col, r, low ? 2 : 3);
      }
      for (const sx of [x0 + 5, x1 - 7]) {
        pix(g, sx - 3, ct - 13, ["kkkkkkk", "kswwsrk", "ksssssk", "kswwwsk", "kkkkkkk", "...k...", "...k..."], { k: "#6a4426", s: "#2e3034", w: "#d8d4c8", r: "#e8c050" });
      }
      // the front posts and the awning, stripe by stripe, its valance scalloped; snow lies on it in the cold
      for (const px of [x0 - 1, x1 - 1]) post(g, px, af, y);
      for (let yy = ab; yy < af; yy++) for (let x = x0 - 3; x < x1 + 3; x++) {
        const s = Math.floor((x - x0 + 3) / 5), col = s % 2 ? cols[0] : cols[1], tt = (yy - ab) / (af - ab);
        let c = shade(col, 0.12 - tt * 0.16);
        if ((x - x0 + 3) % 5 === 0) c = shade(c, -0.06);
        if (S.snow && yy - ab < 3 + (h01(x, 2) > 0.5 ? 1 : 0)) c = yy === ab ? "#f8fbff" : "#e4ecf4";
        g.fillStyle = c; g.fillRect(x, yy, 1, 1);
      }
      g.fillStyle = shade(cols[1], -0.45); g.fillRect(x0 - 3, ab - 1, x1 - x0 + 6, 1);
      for (let x = x0 - 3; x < x1 + 3; x++) {
        const s = Math.floor((x - x0 + 3) / 5), f = (x - x0 + 3) % 5, col = shade(s % 2 ? cols[0] : cols[1], -0.16), d = f === 0 || f === 4 ? 2 : f === 2 ? 4 : 3;
        for (let j = 0; j < d; j++) { g.fillStyle = j === d - 1 ? shade(col, -0.2) : col; g.fillRect(x, af + 1 + j, 1, 1); }
      }
      g.fillStyle = shade(wood, -0.35); g.fillRect(x0 - 3, af, x1 - x0 + 6, 1);
      // things hung from the front rail, clear of the seller's face; the merchant's scale
      const hg = HANG[o.hang];
      if (hg) for (let x = x0 + 4; x < x1 - 4; x += 5) {
        if (Math.abs(x - mid) < 12 || (o.scale && x > x1 - 16)) continue;
        pix(g, x - 1, af + 1, hg.rows, { k: "#3a2a1a", a: shade(hg.col, 0.3), b: hg.col, c: shade(hg.col, -0.3) });
      }
      if (o.scale) {
        const X = x1 - 9, Y = af + 1;
        g.fillStyle = "#3a3030"; g.fillRect(X, Y, 1, 6); g.fillRect(X - 5, Y + 6, 11, 1);
        for (const dx of [-5, 5]) { g.fillStyle = "#5a5050"; g.fillRect(X + dx, Y + 7, 1, 3); pix(g, X + dx - 2, Y + 10, ["kyyyk", ".kkk."], { k: "#8a6a2a", y: "#d8b050" }); }
        g.fillStyle = "#d8b050"; g.fillRect(X - 1, Y + 5, 3, 1);
      }
      if (o.lantern) {
        const X = x0 + 1, Y = af + 2;
        pix(g, X - 2, Y, ["..k..", ".kkk.", "kgggk", "kgggk", ".kkk."], { k: "#2a2a30", g: L.lamps ? "#ffd870" : "#b8c4cc" });
        if (L.lamps) k.lights.push({ x: X, y: Y + 4, r: 30, k: 0.6 });
      }
    });
  }
  // a two-wheeled cart side-on being unloaded: sacks and a crate on its bed, its tailboard down, its shafts resting on the stones
  function cart(k, x, y) {
    const { shade } = K(), wood = "#8a5a30", iron = "#3a3434";
    shadow(k, x - 2, x + 44, y + 1, 2);
    k.prop(y, (g) => {
      for (let i = 0; i < 18; i++) { g.fillStyle = i % 4 ? shade(wood, -0.2) : shade(wood, -0.4); g.fillRect(x + 40 + i, y - 17 + R(i * 0.8), 1, 2); }
      sack(g, x + 9, y - 21, "#c8b48a"); sack(g, x + 19, y - 22, "#b8a47a"); crateAt(g, x + 32, y - 21, "#9a6a3a"); sack(g, x + 14, y - 28, "#d0bc92");
      for (let yy = y - 22; yy < y - 12; yy++) for (let xx = x; xx < x + 42; xx++) {
        const f = (yy - (y - 22)) % 3;
        g.fillStyle = yy === y - 22 ? shade(wood, 0.28) : yy === y - 13 ? shade(wood, -0.45) : f === 0 ? shade(wood, -0.32) : (xx - x) % 14 === 0 ? shade(wood, -0.2) : h(xx, yy) ? shade(wood, 0.08) : wood;
        g.fillRect(xx, yy, 1, 1);
      }
      for (const sx of [x + 1, x + 14, x + 27, x + 40]) { g.fillStyle = shade(wood, -0.4); g.fillRect(sx, y - 25, 2, 13); g.fillStyle = shade(wood, 0.15); g.fillRect(sx, y - 25, 1, 13); }
      for (let i = 0; i < 12; i++) { g.fillStyle = i % 3 ? wood : shade(wood, -0.3); g.fillRect(x - 2 - R(i * 0.8), y - 12 + i, 4, 1); }
      const cx = x + 21, cy = y - 9;
      for (let a = 0; a < 64; a++) {
        const t = (a / 64) * Math.PI * 2, lit = Math.cos(t + 2.3) > 0.2;
        g.fillStyle = iron; g.fillRect(R(cx + Math.cos(t) * 8.6), R(cy + Math.sin(t) * 8.6), 1, 1);
        g.fillStyle = lit ? "#8a5a32" : "#5a3a1e"; g.fillRect(R(cx + Math.cos(t) * 7.4), R(cy + Math.sin(t) * 7.4), 1, 1);
      }
      for (let a = 0; a < 8; a++) { const t = (a / 8) * Math.PI * 2 + 0.2; for (let d = 2; d <= 7; d++) { g.fillStyle = "#6a4426"; g.fillRect(R(cx + Math.cos(t) * d), R(cy + Math.sin(t) * d), 1, 1); } }
      g.fillStyle = "#4a2e18"; g.fillRect(cx - 2, cy - 2, 5, 5); g.fillStyle = "#8a8a90"; g.fillRect(cx - 1, cy - 1, 2, 2);
      if (k.S.snow) { g.fillStyle = "#f4f8fc"; g.fillRect(x + 4, y - 32, 10, 1); g.fillRect(x + 26, y - 32, 12, 1); g.fillRect(x, y - 23, 42, 1); }
    });
  }
  const h = (x, y) => K().h01(x, y >> 1) > 0.85;

  root.TownFlat.register("market", (k) => {
    const { GY, W, S, town, r } = k, { shade } = K();
    k.sky(40);
    k.houses(-6, W + 6, GY - 1, { signs: { 0: "pot", 2: "scroll", 3: "mug" } });
    k.ground();
    // straw and dropped leaves round the stalls and the cart
    for (let i = 0; i < 90; i++) {
      const x = R(r() * W), y = R(GY + 2 + r() * 40), near = (x < 56 && y < GY + 18) || (x > 66 && x < 128 && y < GY + 14) || (x > 130 && y < GY + 20);
      if (!near && r() > 0.15) continue;
      k.ctx.fillStyle = S.snow ? "#9aa4b0" : r() < 0.5 ? "#c8a85a" : r() < 0.5 ? "#6a8a3a" : "#8a6a3a"; k.ctx.fillRect(x, y, 2, 1);
    }
    const Wt = WARES[town] || WARES.thornwall, Wr = Wt.w;
    stall(k, { x0: 4, x1: 50, y: GY + 9, ab: 24, af: 31, wares: [Wr[1], Wr[2]], hang: Wt.hang === "herbs" ? "garlic" : "herbs", cols: [S.awning[1], shade(S.awning[0], -0.12)], seller: Art.hash(town) % 7, sx: 27, sface: 1, mid: 27 });
    stall(k, { x0: 70, x1: 124, y: GY + 10, wares: Wr, hang: Wt.hang, scale: true, lantern: true, mid: 98 });
    cart(k, 146, GY + 8);
    // stock unloaded beside the cart, baskets set down by the shoppers
    k.prop(GY + 12, (g) => { crateAt(g, 134, GY + 12, "#9a7040", Wr[0], r); });
    k.prop(GY + 12, (g) => { sack(g, 146, GY + 12, "#c8b48a"); });
    k.prop(GY + 11, (g) => { basket(g, 58, GY + 11, Wr[1], r); });
    k.prop(GY + 29, (g) => { basket(g, 184, GY + 29, Wr[2], r); });
    k.prop(GY + 14, (g) => { crateAt(g, 10, GY + 14, "#8a6236"); sack(g, 20, GY + 15, "#b8a47a"); });
    k.bench(160, GY + 27, 22);
    pigeons(k, [[30, GY + 32, 1], [38, GY + 34, -1], [150, GY + 33, 1], [46, GY + 30, 1]]);
    k.npc = { kind: "merchant", name: null };
    // the merchant behind the middle counter; the hero buys from in front of it, a little to the left so both faces show
    k.spot("npc", 98, GY + 5, -1);
    k.spot("counter", 82, GY + 19, 1); k.spot("act", 82, GY + 19, 1);
    k.spot("stall2", 40, GY + 18, -1); k.spot("crate", 132, GY + 18, 1);
    k.spot("bench", 160, GY + 26, -1, "sit"); k.spot("walk", 108, GY + 24, -1); k.spot("in", W + 10, GY + 22, -1);
    k.spot("mate", 118, GY + 21, -1); k.spot("pet", 70, GY + 27, 1); k.spot("other", 64, GY + 20, 1);
    k.crowd([[54, GY + 14, -1], [138, GY + 13, -1], [14, GY + 20, 1], [160, GY + 20, -1]]);
    // passers-by behind the stalls and along the front of the counters, never in front of the hero
    k.walk([[[-12, GY + 1], [W + 12, GY + 1]], [[W + 12, GY + 11], [-12, GY + 11]]]);
  });

  // ---------- the square ----------
  // the paving laid in rings round the fountain, worn pale where the ways cross; snow lies in drifts on it in the cold
  function rings(k, cx, cy) {
    const { ctx, S, GY, W, H } = k, { shade, mix, h01 } = K(), setts = S.cobble.map((c) => shade(c, 0.1)), ringStone = shade(S.stone[0], 0.16);
    for (let y = GY + 2; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) * 3.4, d = Math.hypot(dx, dy);
      if (d > 104) continue;
      if (S.snow && d > 56 + h01(x >> 3, y >> 2) * 40) continue;
      if (d > 99) { ctx.fillStyle = d > 102 ? shade(S.gap, -0.1) : ringStone; ctx.fillRect(x, y, 1, 1); continue; }
      const ring = Math.floor(d / 6.5), fr = d / 6.5 - ring, ang = Math.atan2(dy, dx) + Math.PI, k2 = (ang * Math.max(4, d)) / 6.5 + (ring % 2) * 0.5, sg = Math.floor(k2), fs = k2 - sg;
      let c;
      if (fr < 0.16 || fs < 0.14) c = S.gap;
      else {
        c = setts[Math.floor(h01(ring, sg) * setts.length)];
        if (ring % 4 === 3) c = mix(c, ringStone, 0.6);
        if (S.snow && h01(ring * 3, sg) > 0.8) c = "#e2e8f0";
        c = fr > 0.8 || fs > 0.88 ? shade(c, -0.1) : fr < 0.34 ? shade(c, 0.08) : c;
      }
      ctx.fillStyle = shade(c, ((y - GY) / (H - GY)) * -0.12); ctx.fillRect(x, y, 1, 1);
    }
  }
  // the fountain face-on: a round basin of dressed stone, a column and a bowl, a finial spouting; the jets alive. Frozen in the cold.
  function fountain(k, cx, y) {
    const { S, L } = k, { shade, mix, h01, frac, pix } = K(), stone = S.stone, frozen = !!S.snow, ry = 5, rx = 30, top = y - 10 - ry;
    const base = k.piece(), g = base.getContext("2d");
    shadow(k, cx - rx - 2, cx + rx + 2, y + 1, 3);
    const sky = L.night ? "#1a2848" : mix(L.sky[0], "#4a86b0", 0.45);
    // the inside of the basin and the water in it
    ellipse(g, cx, top, rx - 2, ry - 1, (dx, dy, x, yy) => {
      if (frozen) return (x * 3 + yy * 7) % 23 === 0 ? "#ffffff" : (x + 2 * yy) % 17 === 0 ? "#8aa0b4" : dy < -0.3 ? "#dce8f2" : "#c4d6e6";
      return dy < -0.45 ? sky : (x * 3 + yy * 5) % 13 < 2 ? "#8ac0e0" : dy > 0.4 ? "#2e6a94" : "#3a7aa8";
    });
    // the rim, then the curved wall below it in blocks of dressed stone, lit from the left
    for (let x = cx - rx; x <= cx + rx; x++) {
      const nx = (x + 0.5 - cx) / rx, e = Math.sqrt(Math.max(0, 1 - nx * nx)), yt = top + ry * e, yb = R(yt + 10), lit = -nx * 0.14;
      g.fillStyle = shade(stone[0], 0.22 + lit); g.fillRect(x, R(top - ry * e), 1, 1);
      g.fillStyle = shade(stone[0], 0.14 + lit); g.fillRect(x, R(yt) - 1, 1, 2);
      for (let yy = R(yt) + 1; yy < yb; yy++) {
        const row = Math.floor((yy - R(yt)) / 3), bx = Math.floor((nx * 7 + (row % 2) * 0.5 + 9) * 1), joint = (yy - R(yt)) % 3 === 0 || Math.abs(((nx * 7 + (row % 2) * 0.5) % 1 + 1) % 1) < 0.1;
        const c = stone[Math.floor(h01(row, bx) * stone.length)];
        g.fillStyle = joint ? S.mortar : shade(c, lit - (yy > yb - 2 ? 0.12 : 0)); g.fillRect(x, yy, 1, 1);
      }
      g.fillStyle = shade(stone[1], -0.3); g.fillRect(x, yb, 1, 1);
    }
    for (let x = cx - rx; x <= cx + rx; x++) { const nx = (x + 0.5 - cx) / rx, e = Math.sqrt(Math.max(0, 1 - nx * nx)); if (frozen) { g.fillStyle = "#f4f8fc"; g.fillRect(x, R(top - ry * e) - 1, 1, 1); g.fillRect(x, R(top + ry * e) - 2, 1, 1); } }
    // the column and the bowl, a finial on top
    const colTop = top - 20, bowlY = colTop;
    for (let yy = colTop; yy < top + 2; yy++) for (let x = cx - 3; x <= cx + 3; x++) { g.fillStyle = x === cx - 3 ? shade(stone[0], 0.2) : x >= cx + 2 ? shade(stone[1], -0.25) : (yy - colTop) % 6 === 0 ? S.mortar : stone[0]; g.fillRect(x, yy, 1, 1); }
    for (let j = 0; j < 5; j++) { const w = 12 - j * 2; g.fillStyle = j === 0 ? shade(stone[0], 0.22) : shade(stone[1], -0.05 - j * 0.06); g.fillRect(cx - w, bowlY + 1 + j, w * 2 + 1, 1); }
    ellipse(g, cx + 0.5, bowlY, 11, 1.8, frozen ? "#e4ecf4" : (dx) => (dx < -0.3 ? "#8ac0e0" : "#3a7aa8"));
    g.fillStyle = shade(stone[0], 0.25); g.fillRect(cx - 12, bowlY, 1, 2); g.fillRect(cx + 12, bowlY, 1, 2);
    pix(g, cx - 2, bowlY - 7, [".aa..", "abbc.", "abbc.", ".bc..", "abbbc", ".bbc."], { a: shade(stone[0], 0.3), b: stone[0], c: shade(stone[1], -0.3) });
    if (frozen) {
      g.fillStyle = "#f4f8fc"; g.fillRect(cx - 11, bowlY - 1, 23, 1); g.fillRect(cx - 2, bowlY - 8, 4, 1);
      for (let x = cx - 11; x <= cx + 11; x += 2) { const l = 2 + R(h01(x, 5) * 5); for (let j = 0; j < l; j++) { g.fillStyle = j < l - 1 ? "#d8e8f4" : "#ffffff"; g.fillRect(x, bowlY + 5 + j, 1, 1); } }
    }
    live(k, y, base, (c, t, still) => {
      if (frozen) { if (!still && frac(t * 0.3) < 0.15) { c.fillStyle = "#ffffff"; c.fillRect(cx + 6, top - 1, 1, 1); c.fillRect(cx - 9, bowlY + 9, 1, 1); } return; }
      const tt = still ? 1.3 : t;
      // the spout from the finial, falling back into the bowl
      for (let i = 0; i < 16; i++) {
        const ph = frac(tt * 1.1 + i / 16), side = i % 2 ? 1 : -1, px = cx + side * ph * 9, py = bowlY - 8 - Math.sin(Math.min(1, ph * 1.4) * Math.PI) * 6 + ph * 7;
        c.fillStyle = ph > 0.75 ? "#c8e4f4" : "#eef8ff"; c.fillRect(R(px), R(py), 1, 1 + (ph < 0.3 ? 1 : 0));
      }
      c.fillStyle = "#f4fbff"; c.fillRect(cx, bowlY - 11, 1, 4);
      // sheets of water pouring off the bowl's lip into the basin
      for (const side of [-1, 1]) for (let j = 0; j < 14; j++) {
        const ph = frac(tt * 1.6 + j / 14 + (side > 0 ? 0.5 : 0)), px = cx + side * (12 + ph * 3), py = bowlY + 2 + ph * (top - bowlY - 1);
        c.fillStyle = ph > 0.8 ? "#9acce8" : "#dff2fc"; c.fillRect(R(px), R(py), 1, 2);
      }
      // rings spreading where it lands, a glint on the water
      for (const side of [-1, 1]) { const ph = frac(tt * 0.8 + (side > 0 ? 0.4 : 0)), w = 2 + R(ph * 6); c.fillStyle = `rgba(230,246,255,${0.8 - ph * 0.7})`; c.fillRect(R(cx + side * 15 - w / 2), top + 1, w, 1); }
      if (frac(tt * 0.5) < 0.5) { c.fillStyle = "#ffffff"; c.fillRect(cx - 18 + R(frac(tt * 0.13) * 30), top - 1, 2, 1); }
    });
  }
  // a well under a shingled roof, its bucket swinging on the rope
  function well(k, cx, y, rx) {
    const { S } = k, { shade, h01, frac } = K(), ry = 3, wall = 12, top = y - wall - ry, roofY = y - 50, sh = ["#7a5232", "#6a4628", "#8a6038"];
    const base = k.piece(), g = base.getContext("2d");
    shadow(k, cx - rx - 2, cx + rx + 2, y + 1, 2);
    for (const px of [cx - rx + 1, cx + rx - 3]) post(g, px, roofY + 6, top + 1, "#5a3a1e");
    ellipse(g, cx, top, rx - 1, ry - 1, "#141018");
    for (let x = cx - rx; x <= cx + rx; x++) {
      const nx = (x + 0.5 - cx) / rx, e = Math.sqrt(Math.max(0, 1 - nx * nx)), yt = R(top + ry * e), lit = -nx * 0.16;
      g.fillStyle = shade(S.stone[0], 0.24 + lit); g.fillRect(x, R(top - ry * e), 1, 1); g.fillRect(x, yt - 1, 1, 1);
      for (let yy = yt; yy < yt + wall; yy++) {
        const row = Math.floor((yy - yt) / 3), bx = Math.floor((nx * 5 + (row % 2) * 0.5 + 9)), j = (yy - yt) % 3 === 0 || ((nx * 5 + (row % 2) * 0.5 + 9) % 1) < 0.12;
        g.fillStyle = j ? S.mortar : shade(S.stone[h01(row, bx) > 0.5 ? 0 : 1], lit - (yy > yt + wall - 3 ? 0.12 : 0)); g.fillRect(x, yy, 1, 1);
      }
      if (S.snow) { g.fillStyle = "#f4f8fc"; g.fillRect(x, R(top - ry * e) - 1, 1, 1); }
    }
    for (let j = 0; j < 11; j++) {
      const w = rx + 5 - R(j * 0.9);
      for (let x = cx - w; x <= cx + w; x++) { g.fillStyle = S.snow && j > 6 ? (j === 10 ? "#ffffff" : "#eef2f8") : j % 3 === 0 ? shade(sh[1], -0.3) : sh[h01(x >> 1, j) > 0.6 ? 2 : (x + j) % 4 ? 0 : 1]; g.fillRect(x, roofY + 9 - j, 1, 1); }
    }
    g.fillStyle = "#2a1a10"; g.fillRect(cx - rx - 5, roofY + 10, rx * 2 + 11, 1); g.fillRect(cx - 1, roofY - 3, 2, 3);
    g.fillStyle = "#5a3a1e"; g.fillRect(cx - rx + 2, roofY + 14, rx * 2 - 3, 2); g.fillStyle = "#3a2414"; g.fillRect(cx + rx - 1, roofY + 14, 1, 6); g.fillRect(cx + rx - 1, roofY + 19, 4, 1);
    live(k, y, base, (c, t, still) => {
      const sw = still ? 0 : Math.sin(t * 1.2) * 1.2, drop = 10 + (still ? 0 : R((Math.sin(t * 0.35) + 1) * 4));
      for (let j = 0; j < drop; j++) { c.fillStyle = "#c8b080"; c.fillRect(R(cx + sw * (j / drop)), roofY + 16 + j, 1, 1); }
      const bx = R(cx + sw), by = roofY + 16 + drop;
      c.fillStyle = "#2a1a10"; c.fillRect(bx - 4, by, 9, 1); c.fillStyle = "#7a5230"; c.fillRect(bx - 3, by + 1, 7, 5); c.fillStyle = "#3a3434"; c.fillRect(bx - 3, by + 2, 7, 1); c.fillRect(bx - 3, by + 4, 7, 1); c.fillStyle = "#9a6a3a"; c.fillRect(bx - 3, by + 1, 1, 5);
      if (!still && frac(t * 0.6) < 0.2) { c.fillStyle = "#8ac0e0"; c.fillRect(bx + 1, by + 6 + R(frac(t * 3) * 3), 1, 1); }
    });
  }
  // the market cross on its steps, weathered stone outlined dark against the houses
  function marketCross(k, cx, y) {
    const { S } = k, { shade } = K(), s0 = shade(S.stone[0], 0.1), s1 = S.stone[1], o = shade(S.stone[1], -0.55);
    shadow(k, cx - 15, cx + 15, y + 1, 2);
    k.prop(y, (g) => {
      const box = (x0, y0, w, h, lit) => { g.fillStyle = o; g.fillRect(x0 - 1, y0 - 1, w + 2, h + 2); g.fillStyle = s1; g.fillRect(x0, y0, w, h); g.fillStyle = shade(s0, 0.18); g.fillRect(x0, y0, w, 1); if (lit) g.fillRect(x0, y0, 1, h); g.fillStyle = shade(s1, -0.28); g.fillRect(x0 + w - 2, y0 + 1, 2, h - 1); };
      box(cx - 14, y - 4, 29, 4, true); box(cx - 10, y - 8, 21, 4, true); box(cx - 6, y - 12, 13, 4, true);
      box(cx - 2, y - 44, 5, 32, true);
      box(cx - 8, y - 38, 17, 4, true);
      box(cx - 3, y - 47, 7, 3, true);
      g.fillStyle = shade(s1, -0.15); for (let yy = y - 40; yy < y - 14; yy += 6) g.fillRect(cx - 1, yy, 3, 1);
      if (S.snow) { g.fillStyle = "#f4f8fc"; for (const [x0, y0, w] of [[cx - 14, y - 5, 29], [cx - 10, y - 9, 21], [cx - 6, y - 13, 13], [cx - 8, y - 39, 17], [cx - 3, y - 48, 7]]) g.fillRect(x0, y0, w, 1); }
    });
  }
  // the notice board: two posts, a little roof, a board crowded with bills, one of them lifting in the wind
  function noticeBoard(k, x0, x1, y) {
    const { S } = k, { shade, h01, pix, frac } = K(), base = k.piece(), g = base.getContext("2d"), bt = y - 40, bb = y - 15;
    shadow(k, x0 - 2, x1 + 2, y + 1, 2);
    for (const px of [x0 + 1, x1 - 3]) post(g, px, y - 48, y, "#3e2614");
    for (let yy = bt; yy < bb; yy++) for (let x = x0 + 2; x < x1 - 2; x++) { g.fillStyle = yy === bt || yy === bb - 1 || x === x0 + 2 || x === x1 - 3 ? "#4a2e18" : (x + yy * 3) % 7 ? "#a8804e" : "#9a7444"; g.fillRect(x, yy, 1, 1); }
    for (let j = 0; j < 7; j++) for (let x = x0 - 4 + R(j * 0.6); x < x1 + 4 - R(j * 0.6); x++) { g.fillStyle = S.snow && j > 3 ? "#f2f6fa" : j % 2 ? S.roof[0] : shade(S.roof[1], x % 4 === 0 ? -0.2 : 0); g.fillRect(x, y - 47 - j, 1, 1); }
    g.fillStyle = shade(S.roof[1], -0.45); g.fillRect(x0 - 4, y - 46, x1 - x0 + 8, 1); g.fillStyle = "rgba(20,12,8,0.3)"; g.fillRect(x0 + 3, bt + 1, x1 - x0 - 6, 2);
    const cols = ["#f4ecd8", "#e8dcc0", "#f0e0b0", "#ece4d4", "#dcd0b8"], bills = [];
    for (let i = 0; i < 14; i++) {
      const w = 7 + R(h01(i, 5) * 4), h = 7 + R(h01(i, 6) * 4), bx = x0 + 4 + R(h01(i, 3) * (x1 - x0 - 10 - w)), by = bt + 2 + R(h01(i, 4) * (bb - bt - 4 - h));
      bills.push([bx, by, w]);
      g.fillStyle = "rgba(20,12,8,0.25)"; g.fillRect(bx + 1, by + 1, w, h);
      g.fillStyle = cols[i % 5]; g.fillRect(bx, by, w, h);
      for (let j = 0; j < 3; j++) { g.fillStyle = "#9a8a6a"; g.fillRect(bx + 1, by + 2 + j * 2, w - 2 - (j === 2 ? 2 : 0), 1); }
      g.fillStyle = "#c83a2a"; g.fillRect(bx + (w >> 1), by, 1, 1);
      if (i % 5 === 2) pix(g, bx + 1, by + 1, [".xx.", "xyyx", ".xx.", "x..x"], { x: "#3a2a1a", y: "#c8a080" });
    }
    const [lx, ly, lw] = bills[bills.length - 1];
    live(k, y, base, (c, t, still) => {
      const lift = still ? 0 : frac(t * 0.37) < 0.3 ? 1 + (Math.floor(t * 9) % 2) : 0;
      if (lift) { c.fillStyle = "#fffaf0"; c.fillRect(lx + lw - 3, ly + 5 - lift, 3, 1); c.fillStyle = "rgba(20,12,8,0.3)"; c.fillRect(lx + lw - 3, ly + 6, 3, 1); }
    });
  }

  root.TownFlat.register("square", (k) => {
    const { GY, W, S, town, th } = k;
    k.sky(40);
    k.houses(-6, W + 6, GY - 1, { signs: { 0: "scroll", 2: "star", 4: "mug" } });
    k.ground();
    rings(k, 96, GY + 5);
    const hasFountain = !["thornwall", "ashfen", "hollowood"].includes(town);
    if (hasFountain) fountain(k, 96, GY + 6);
    else { well(k, 96, GY + 7, 15); marketCross(k, 134, GY + 3); }
    noticeBoard(k, 8, 52, GY + 5);
    k.bench(160, GY + 18, 22); k.bench(164, GY + 4, 18);
    k.lampPost(60, GY + 7); k.lampPost(180, GY + 7);
    tub(k, 70, GY + 9, 1, true); tub(k, 122, GY + 9, 2, true); tub(k, 7, GY + 24, 3); tub(k, 186, GY + 27, 0);
    if (S.water) k.barrel(176, GY + 18);
    bunting(k, -2, 16, 96, 12, 6, [th.primary, "#f4ecd8", th.accent]);
    bunting(k, 96, 12, W + 2, 18, 6, [th.accent, th.primary, "#f4ecd8"]);
    pigeons(k, [[28, GY + 34, 1], [36, GY + 35, -1], [154, GY + 33, 1], [168, GY + 36, -1], [64, GY + 38, 1]]);
    k.npc = { kind: "local", name: null };
    // the busker's pitch before the fountain; the crowd gathers in an arc to either side of it, a little behind and a little before
    k.spot("act", 96, GY + 20, 1); k.spot("fountain", 96, GY + 20, 1);
    k.spot("bench", 160, GY + 17, -1, "sit"); k.spot("board", 30, GY + 14, 1); k.spot("npc", 74, GY + 21, 1);
    k.spot("in", W + 10, GY + 22, -1); k.spot("mate", 116, GY + 21, -1); k.spot("pet", 84, GY + 29, 1); k.spot("other", 126, GY + 18, -1);
    k.crowd([[66, GY + 14, 1], [126, GY + 14, -1], [52, GY + 25, 1], [140, GY + 25, -1], [120, GY + 33, -1]]);
    k.walk([[[-12, GY + 8], [W + 12, GY + 8]], [[W + 12, GY + 11], [-12, GY + 11]]]);
  });

  // ---------- the green ----------
  // the big tree: a trunk with roots, a crown of leafy clumps that stirs in the wind (frames), a kite caught in it
  function bigTree(k, cx, y) {
    const { S, r, th } = k, { h01, pix } = K();
    const leaf = S.snow ? ["#f4f8fc", "#d8e2ec", "#a8b6c6", "#7a8a9a"] : k.season === "autumn" ? ["#e8a040", "#d07a2e", "#a85424", "#7a3a1a"] : ["#8ac050", "#6aa040", "#4e8432", "#355e24"];
    const trunk = k.piece(), g = trunk.getContext("2d"), bark = ["#6a4a30", "#5a3c26", "#4a301e", "#3a2416"];
    shadow(k, cx - 26, cx + 26, y + 1, 3);
    for (let j = 0; j < 44; j++) {
      const w = j < 4 ? 8 - j * 0.8 : j > 30 ? 4.2 - (j - 30) * 0.1 : 4.6;
      for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) { const t = (dx + w) / (2 * w); g.fillStyle = (dx + j * 3) % 7 === 0 ? bark[3] : t < 0.3 ? bark[0] : t < 0.7 ? bark[1] : bark[2]; g.fillRect(cx + dx, y - j, 1, 1); }
    }
    for (const [ax, ay, bx, by] of [[0, -36, -16, -52], [0, -36, 15, -54], [0, -40, 2, -60], [-6, -44, -22, -56], [6, -46, 22, -48]]) {
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let i = 0; i <= n; i++) { g.fillStyle = bark[1]; g.fillRect(R(cx + ax + ((bx - ax) * i) / n), R(y + ay + ((by - ay) * i) / n), 2, 1); }
    }
    const clumps = [];
    for (let i = 0; i < 24; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 24; clumps.push([Math.cos(a) * d * 1.3, -55 + Math.sin(a) * d * 0.7, 8 + r() * 5, r() * 6]); }
    clumps.sort((a, b) => a[1] - b[1]);
    const frames = [0, 1, 2, 3].map((f) => {
      const c = k.piece(), cg = c.getContext("2d");
      cg.drawImage(trunk, 0, 0);
      clumps.forEach(([dx0, dy0, rr, ph]) => {
        const sway = R(Math.sin((f / 4) * Math.PI * 2 + ph) * (Math.abs(dx0) > 14 ? 1 : 0.5));
        ellipse(cg, cx + dx0 + sway, y + dy0, rr, rr * 0.78, (dx, dy, px, py) => {
          const n = h01(px * 3, py * 5);
          if (dx * dx + dy * dy > 0.82 && n > 0.5) return null;
          const l = -dy * 0.6 - dx * 0.15 + (dx0 < 0 ? 0.25 : -0.1) - (dy0 + 55) / 50 + (n - 0.5) * 0.6;
          return l > 0.55 ? leaf[0] : l > 0.05 ? leaf[1] : l > -0.45 ? leaf[2] : leaf[3];
        });
      });
      if (!S.snow) {
        const kx = cx + 22, ky = y - 66;
        pix(cg, kx - 3, ky - 4, ["...r...", "..rry..", ".rrryy.", "rrrryyy", ".rrryy.", "..rry..", "...r..."], { r: th.primary, y: th.accent });
        for (let s = 0; s < 8; s++) { cg.fillStyle = s % 3 === 1 ? th.accent : "#e8dcc0"; cg.fillRect(kx + R(Math.sin(s * 0.8 + f * 1.4) * 2), ky + 3 + s * 2, 1, 2); }
      }
      return c;
    });
    live(k, y, null, (c, t, still) => c.drawImage(frames[still ? 0 : Math.floor(t * 1.4) % 4], 0, 0));
    // a leaf now and then drifting down from it (a flake of snow off it in the cold)
    k.overs.push((c, t, still) => {
      if (still) return;
      for (let i = 0; i < 3; i++) { const ph = K().frac(t * 0.1 + i / 3); c.fillStyle = S.snow ? "#f4f8fc" : leaf[1 + (i % 2)]; c.fillRect(R(cx - 24 + ph * 30 + Math.sin(ph * 9 + i) * 4 + i * 8), R(y - 50 + ph * 50), 2, 1); }
    });
  }
  // the pond: a muddy bank, deep water with the sky in it, lily pads, reeds swaying round the back, the ducks; ice in the cold
  function pond(k, cx, cy, rx, ry) {
    const { ctx, S, L, r } = k, { mix, pix, frac } = K(), frozen = !!S.snow, sky = L.night ? "#1a2848" : mix(L.sky[0], "#4a86b0", 0.5);
    ellipse(ctx, cx, cy, rx + 2, ry + 1.5, (dx, dy, x, y) => (frozen ? "#c8d4e0" : (x + y) % 3 ? "#7a6a4a" : "#6a5a3e"));
    ellipse(ctx, cx, cy, rx, ry, (dx, dy, x, y) => {
      const d = dx * dx + dy * dy;
      if (frozen) return (x * 3 + y * 7) % 29 === 0 ? "#ffffff" : (x + 2 * y) % 31 === 0 ? "#8aa0b4" : d > 0.8 ? "#e8f0f6" : dy < -0.3 ? "#d4e2ee" : "#c4d6e6";
      if (d > 0.86) return "#5a7a6a";
      return dy < -0.5 && d < 0.7 ? sky : (x * 3 + y * 7) % 19 < 2 ? "#8ac0d8" : d < 0.35 ? "#2e6a94" : "#3a7aa4";
    });
    if (!frozen) for (const [dx, dy, fl] of [[-14, 1, 0], [10, -2, 1], [16, 3, 0], [-4, 4, 0]]) { pix(ctx, cx + dx - 3, cy + dy - 1, [".gggg.", "gglggg", ".ggg.."], { g: "#4e8a3a", l: "#6aa84a" }); if (fl) pix(ctx, cx + dx - 1, cy + dy - 2, ["pwp", ".p."], { p: "#f0a0c0", w: "#fff4f8" }); }
    const reeds = [];
    for (let i = 0; i < 30; i++) { const a = Math.PI * (0.95 + r() * 1.1), x = cx + Math.cos(a) * (rx + 1), y = cy + Math.sin(a) * (ry + 0.5); reeds.push([x, y, 6 + r() * 8, r() < 0.3, r() * 6]); }
    for (let i = 0; i < 10; i++) { const a = r() * 0.5 - 0.1, x = cx + Math.cos(a) * (rx + 1), y = cy + Math.sin(a) * (ry + 0.5); reeds.push([x, y, 5 + r() * 6, r() < 0.3, r() * 6]); }
    const DUCK = ["......hh.", ".....hhey", "bbbbbbhh.", "bbbbbbbb.", ".wwwwww.."], ducks = [[-8, 0, 0], [6, -1, 2.1], [0, 2, 4.2]];
    k.anims.push((c, t, still) => {
      ducks.forEach(([dx, dy, ph], i) => {
        const tt = still ? ph : t * (frozen ? 0.08 : 0.22) + ph, x = cx + dx + Math.cos(tt) * 9, y = cy + dy + Math.sin(tt) * 2, face = -Math.sin(tt) >= 0 ? 1 : -1;
        const pal = { h: i === 1 ? "#a87a4a" : "#2e6a3a", e: "#101010", y: "#e8a040", b: i === 1 ? "#a8845a" : "#a89478", w: frozen ? "#e8a040" : "#8aa8b8" };
        pix(c, R(x) - 4, R(y) - 4, face > 0 ? DUCK : flip(DUCK), pal);
        if (!still && !frozen) for (let j = 1; j < 4; j++) { c.fillStyle = "rgba(200,230,245,0.55)"; c.fillRect(R(x) - face * (4 + j * 2), R(y) + (j % 2), 1, 1); }
      });
      for (const [x, y, h, rush, ph] of reeds) {
        const sw = still ? 0 : Math.sin(t * 1.3 + ph) * 0.9;
        for (let j = 0; j < h; j++) { c.fillStyle = frozen ? (j > h - 3 ? "#f4f8fc" : "#a89870") : j > h - 2 ? "#8ab858" : j % 3 ? "#4e7a2e" : "#5a8a36"; c.fillRect(R(x + sw * (j / h)), R(y - j), 1, 1); }
        if (rush && !frozen) { c.fillStyle = "#6a4024"; c.fillRect(R(x + sw), R(y - h - 2), 1, 3); }
      }
    });
  }
  // a bale of hay, a strap round it
  function bale(g, x, y, snow) {
    const { shade, h01 } = K(), c0 = "#c8a650";
    for (let yy = y - 9; yy < y; yy++) for (let xx = x - 8; xx < x + 8; xx++) { g.fillStyle = yy === y - 9 ? (snow ? "#f4f8fc" : shade(c0, 0.2)) : h01(xx, yy) > 0.75 ? shade(c0, 0.15) : h01(xx * 3, yy) > 0.8 ? shade(c0, -0.2) : c0; g.fillRect(xx, yy, 1, 1); }
    g.fillStyle = "#7a5230"; g.fillRect(x - 4, y - 9, 1, 9); g.fillRect(x + 3, y - 9, 1, 9);
    g.fillStyle = shade(c0, -0.35); g.fillRect(x - 8, y - 1, 16, 1);
  }
  // the fair's tent: striped walls, a striped cone, the flap open, a pennant flying from the pole
  function tent(k, cx, y) {
    const { th } = k, { shade, pix } = K(), base = k.piece(), g = base.getContext("2d"), w = 20, wt = y - 20, apex = y - 42;
    shadow(k, cx - w - 2, cx + w + 2, y + 1, 3);
    for (let yy = wt; yy < y; yy++) for (let x = cx - w; x <= cx + w; x++) { const s = Math.floor((x - cx + w) / 4) % 2, c = s ? th.primary : "#f4ecd8"; g.fillStyle = shade(c, (x - cx) / w * -0.18 - (yy > y - 2 ? 0.15 : 0)); g.fillRect(x, yy, 1, 1); }
    for (let yy = apex; yy < wt; yy++) {
      const f = (yy - apex) / (wt - apex), hw = R(2 + f * (w + 2));
      for (let x = cx - hw; x <= cx + hw; x++) { const s = Math.floor(((x - cx) / Math.max(1, hw)) * 4 + 4) % 2, c = s ? th.accent : "#f4ecd8"; g.fillStyle = shade(c, ((x - cx) / (w + 2)) * -0.2); g.fillRect(x, yy, 1, 1); }
    }
    for (let x = cx - w - 2; x <= cx + w + 2; x++) { const f = (x - cx + w + 2) % 4; g.fillStyle = shade(th.accent, -0.2); g.fillRect(x, wt, 1, f === 1 || f === 2 ? 3 : 2); }
    for (let yy = y - 14; yy < y; yy++) { const hw = R((yy - y + 14) * 0.4) + 1; g.fillStyle = "#2a1a14"; g.fillRect(cx - hw, yy, hw * 2, 1); }
    g.fillStyle = "#4a3020"; g.fillRect(cx, apex - 8, 1, 8);
    live(k, y, base, (c, t, still) => { const f = still ? 0 : Math.floor(t * 4) % 2; pix(c, cx + 1, apex - 8, f ? ["ppp..", "pppp.", "pp..."] : ["pppp.", "ppppp", "p...."], { p: th.accent }); });
    return apex;
  }
  // fireflies over the grass after dusk, each a small moving light; butterflies by day
  function flutter(k, x0, x1, y0, y1) {
    const { S, L, hour, wx } = k, { frac, h01 } = K();
    if (S.snow || ["rain", "storm", "snow"].includes(wx)) return;
    if (L.lamps && (L.night || hour >= 17)) {
      const flies = Array.from({ length: 10 }, (_, i) => ({ x: 0, y: 0, r: 7, k: 0, i }));
      k.lights.push(...flies);
      k.anims.push((c, t, still) => flies.forEach((f) => {
        const ph = frac(t * 0.12 + h01(f.i, 9)), on = still ? f.i % 2 : frac(t * 0.6 + h01(f.i, 8)) < 0.55;
        f.x = R(x0 + h01(f.i, 1) * (x1 - x0) + Math.sin(ph * 6.3) * 8); f.y = R(y0 + h01(f.i, 2) * (y1 - y0) - Math.cos(ph * 6.3) * 4); f.k = on ? 0.35 : 0;
      }));
      k.overs.push((c) => flies.forEach((f) => { if (!f.k) return; c.fillStyle = "#f0f8a0"; c.fillRect(f.x, f.y, 1, 1); c.fillStyle = "rgba(232,240,136,0.35)"; c.fillRect(f.x - 1, f.y, 3, 1); c.fillRect(f.x, f.y - 1, 1, 3); }));
    } else if (!L.lamps) k.overs.push((c, t, still) => {
      for (let i = 0; i < 3; i++) {
        const ph = still ? 0.3 + i * 0.2 : frac(t * 0.05 + i / 3), x = x0 + ph * (x1 - x0) + Math.sin(ph * 31 + i) * 6, y = y0 + h01(i, 4) * (y1 - y0) + Math.cos(ph * 23) * 5, fl = !still && Math.floor(t * 8 + i) % 2;
        c.fillStyle = ["#f4f0e4", "#f0c040", "#e8a0c8"][i]; c.fillRect(R(x) - 1, R(y), fl ? 1 : 3, 1); c.fillRect(R(x), R(y) - 1, 1, 1);
      }
    });
  }

  // the green's turf: tussocky grass darker toward the front, a few daisies and buttercups; autumn-dry or snowed over by the season
  function lawn(k) {
    const { ctx, S, GY, W, H, L, wx } = k, { shade, h01 } = K();
    const g0 = S.snow ? ["#f2f6fa", "#e6ecf4", "#d8e0ea", "#c8d2de"] : k.season === "autumn" ? ["#a8a850", "#94984a", "#7e8840", "#6a7636"] : ["#86bc4e", "#74ac44", "#62983a", "#4e8430"];
    for (let y = GY - 2; y < H; y++) for (let x = 0; x < W; x++) {
      const n = h01(x >> 1, y), n2 = h01((x >> 3) + 3, y >> 1), n3 = h01((x + (y >> 1)) >> 4, y >> 3);
      let c = n2 > 0.66 ? g0[0] : n2 > 0.3 ? g0[1] : g0[2];
      if (n3 > 0.7) c = shade(c, -0.05);
      if (n > 0.9) c = g0[3]; else if (n < 0.08) c = shade(c, 0.14);
      if (!S.snow && n > 0.5 && h01(x, y + 1) < 0.08) c = g0[3];
      if (!S.snow && h01(x * 3, y * 7) > 0.994) c = ["#f4f0e4", "#f0c040", "#f4f0e4", "#e86a9a"][Math.floor(h01(x, y * 2) * 4)];
      ctx.fillStyle = shade(c, ((y - GY) / (H - GY)) * -0.12); ctx.fillRect(x, y, 1, 1);
    }
    if (wx === "rain" || wx === "storm") for (let i = 0; i < 7; i++) { const x = R(h01(i, 3) * W), y = R(GY + 14 + h01(i, 4) * (H - GY - 16)), w = 8 + R(h01(i, 5) * 8); ctx.fillStyle = L.night ? "rgba(90,110,150,0.4)" : "rgba(150,175,200,0.45)"; ctx.fillRect(x, y, w, 2); ctx.fillRect(x + 2, y - 1, w - 4, 1); }
  }

  root.TownFlat.register("green", (k) => {
    const { GY, W, S, ctx, th } = k, { h01 } = K();
    k.sky(40);
    k.houses(-6, W + 6, GY - 1, { flowers: false });
    lawn(k);
    // a footpath worn across the green where the townsfolk cross it
    for (let x = 0; x < W; x++) for (let y = GY + 6; y < GY + 14; y++) {
      const c = y - (GY + 9.5 + Math.sin(x * 0.05) * 1.5), n = h01(x >> 1, y);
      if (Math.abs(c) > 2.6 + n * 1.2) continue;
      ctx.fillStyle = S.snow ? (n > 0.5 ? "#d4dce6" : "#c8d0da") : n > 0.8 ? "#c8ae7a" : n > 0.3 ? "#b49a6a" : "#a68a5a"; ctx.fillRect(x, y, 1, 1);
    }
    // the hedge along the back, then the fence before it, a gate standing open
    const leafC = S.snow ? ["#f4f8fc", "#d8e2ec", "#b4c2d2"] : ["#5a9a3a", "#3e6e2a", "#2e5a22"];
    for (let x = -4; x < W + 4; x += 5) {
      const n = h01(x, 7), hx = x + R(n * 2), hy = GY - 6 - R(n * 3);
      ellipse(ctx, hx, hy, 5 + n * 2, 5 + n * 1.5, (dx, dy, px, py) => (dy < -0.35 + dx * 0.2 ? leafC[0] : dy > 0.4 ? leafC[2] : !S.snow && h01(px, py) > 0.94 ? "#e86a9a" : leafC[1]));
    }
    ctx.fillStyle = S.snow ? "#c8d4e0" : "#2e4a1e"; ctx.fillRect(0, GY - 1, W, 2);
    for (let x = 2; x < W; x += 9) {
      if (x > 54 && x < 70) continue;
      ctx.fillStyle = "#6a4a2a"; ctx.fillRect(x, GY - 10, 2, 11); ctx.fillStyle = "#a07e50"; ctx.fillRect(x, GY - 10, 1, 11);
      if (S.snow) { ctx.fillStyle = "#f4f8fc"; ctx.fillRect(x, GY - 11, 2, 1); }
    }
    for (const yy of [GY - 8, GY - 4]) for (const [a, b] of [[0, 56], [70, W]]) { ctx.fillStyle = "#a07e50"; ctx.fillRect(a, yy, b - a, 1); ctx.fillStyle = "#6a4a2a"; ctx.fillRect(a, yy + 1, b - a, 1); }
    for (let i = 0; i < 9; i++) { ctx.fillStyle = "#a07e50"; ctx.fillRect(56 + R(i * 0.4), GY - 9 + i, 1, 1); ctx.fillRect(56 + R(i * 0.4) + 1, GY - 9 + i, 1, 1); }
    bigTree(k, 30, GY + 7);
    pond(k, 160, GY + 19, 28, 7);
    k.bench(18, GY + 27, 22);
    k.lampPost(60, GY + 7);
    k.prop(GY + 4, (g) => { bale(g, 120, GY + 4, S.snow); bale(g, 137, GY + 4, S.snow); });
    k.prop(GY + 5, (g) => { bale(g, 128, GY - 5, S.snow); });
    well(k, 174, GY + 3, 10);
    // a ball left in the grass
    K().pix(ctx, 44, GY + 33, [".rr.", "rwwr", "rrww", ".rr."], { r: "#d84a3a", w: "#f4f0e4" });
    if (k.festival) {
      const apex = tent(k, 96, GY + 5);
      k.barrel(74, GY + 7); k.barrel(82, GY + 8);
      bunting(k, 46, 22, 96, apex - 2, 5, [th.primary, "#f4ecd8", th.accent]);
      bunting(k, 96, apex - 2, W + 2, 18, 6, [th.accent, th.primary, "#f4ecd8"]);
    }
    flutter(k, 20, 180, GY - 20, GY + 20);
    k.npc = { kind: "child", name: null };
    k.spot("act", 96, GY + 22, 1);
    k.spot("tree", 42, GY + 13, 1, "sit"); k.spot("bench", 18, GY + 26, 1, "sit");
    k.spot("pond", 128, GY + 20, 1); k.spot("throw", 170, GY + 36, -1); k.spot("fair", 98, GY + 13, -1);
    k.spot("npc", 70, GY + 20, 1); k.spot("in", W + 10, GY + 24, -1);
    k.spot("mate", 114, GY + 21, -1); k.spot("pet", 82, GY + 29, 1); k.spot("other", 78, GY + 24, 1);
    k.crowd([[58, GY + 15, 1], [136, GY + 30, -1], [12, GY + 16, 1], [182, GY + 32, -1]]);
    k.walk([[[-12, GY + 8], [W + 12, GY + 8]], [[W + 12, GY + 10], [-12, GY + 10]]]);
  });
})(typeof window !== "undefined" ? window : globalThis);
