/* Headers for The Drowned Isle's places (Old Marrow, the Tidal Flats, the Drowned Chapel), registered with TownScenes and drawn with its kit. */
(function () {
  "use strict";
  const TS = window.TownScenes;
  if (!TS || !TS.register) return;
  const { rect, ln } = TS, ACT = TS.actors;
  const R = Math.round;
  const frac = (v) => ((v % 1) + 1) % 1;

  const OL = "#22201c";
  const STONE = ["#d4d0bc", "#b4b09c", "#928e7a", "#6a6656"];
  const WEED = ["#2a4426", "#3e6234", "#5e8a42", "#8cb256"];
  const SAND = { far: "#c8b48c", wet: "#bc9e68", mid: "#c6aa74", dry: "#d6bc86", hi: "#e2c892", lo: "#a8895a", sheen: "#b8c4bc" };
  const SKY = ["#4a8ccc", "#68a2d8", "#92bce2", "#c2d8e8", "#e8eee6"];
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

  // ---------- shared painting ----------
  // the old sea floor from row y0 down: hazy and smooth far off, wet sheen where it holds the sky, long low ripples nearer the eye
  function flats(k, y0, y1, o) {
    const { W, P } = k, n = k.noise(o.seed), n2 = k.noise(o.seed + 3), n3 = k.noise(o.seed + 5);
    for (let y = y0; y < y1; y++) {
      const d = (y - y0) / Math.max(1, y1 - y0), gap = 3 + R(d * 4);
      const base = k.mix(SAND.far, SAND.wet, Math.min(1, d * 1.6));
      for (let x = 0; x < W; x++) {
        let c = base;
        const sheen = k.fbm(n, x / (30 + d * 40) + y * 0.37);
        if (sheen > 0.62) c = k.mix(base, o.sheen || SAND.sheen, Math.min(0.75, (sheen - 0.62) * 4));
        else if (d > 0.15) {
          const wob = R(Math.sin(x / (5 + d * 7) + k.fbm(n2, x / 50 + y * 0.2) * 6) * (0.5 + d * 1.2));
          const ph = (((y - y0) + wob) % gap + gap) % gap;
          if (ph === 0 && k.fbm(n3, x / (6 + d * 10) + y * 0.53) > 0.4) c = k.mix(base, SAND.hi, 0.55 + d * 0.3);
          else if (ph === 1 && d > 0.5 && k.fbm(n3, x / (6 + d * 10) + y * 0.53) > 0.5) c = k.mix(base, SAND.lo, 0.35);
        }
        P(x, y, c);
      }
    }
    const r = Art.rng(o.seed * 7 + 1), pools = [];
    for (let i = 0; i < (o.pools == null ? W / 40 : o.pools); i++) {
      const y = R(y0 + 3 + r() * (y1 - y0 - 6)), d = (y - y0) / (y1 - y0), w = R(10 + r() * (12 + d * 30)), h = Math.max(1, R(d * 2.6)), x = R(r() * W);
      pool(k, x, y, w, h, o.sky);
      pools.push([x, y, w]);
    }
    for (let i = 0; i < W / 12; i++) {
      const x = k.ri(0, W), y = k.ri(y0 + R((y1 - y0) * 0.3), y1 - 1);
      if (r() < 0.5) { k.F(x, y, 2, 1, WEED[1]); k.P(x + 1, y - 1, WEED[2]); } else k.P(x, y, k.pick(["#ece4d4", "#f0d8c8", "#8a8478"]));
    }
    return pools;
  }
  function pool(k, x, y, w, h, sky) {
    k.blob(x, y, R(w / 2) + 1, h, k.mix(SAND.lo, "#8a9a90", 0.3));
    for (let j = -h + 1; j <= h - 1 || j === 0; j++) {
      const hw = R((w / 2) * Math.sqrt(Math.max(0, 1 - (j / (h + 0.5)) ** 2)));
      k.F(x - hw, y + j, hw * 2 + 1, 1, sky ? sky(y + j) : "#9cc8e0");
      if (j === -h + 1 || h === 1) k.F(x - R(hw * 0.6), y + j, R(hw * 0.5), 1, "#d8eef6");
      if (j >= h - 1) break;
    }
  }
  // weed hanging from a ledge: strands of uneven length, dark at the root, lit at the tip
  function weed(k, x0, x1, y, len, rr, skip) {
    for (let x = x0; x <= x1; x++) {
      if (rr() < (skip == null ? 0.4 : skip)) continue;
      const l = 1 + Math.floor(rr() * len);
      for (let j = 0; j < l; j++) k.P(x, y + j, j === l - 1 ? WEED[3] : j === 0 ? WEED[0] : j % 2 ? WEED[2] : WEED[1]);
    }
  }
  function barnacles(k, x, y, w, h, n, rr) {
    for (let i = 0; i < n; i++) {
      const bx = x + Math.floor(rr() * w), by = y + Math.floor(rr() * h);
      for (let j = 0; j < 4; j++) { const px = bx + (j & 1) * 2 - (j > 1 ? 1 : 0), py = by + (j > 1 ? 1 : 0); k.P(px, py, j === 0 ? "#f4f0e2" : "#c8c4b2"); }
      k.P(bx + 1, by, "#7a766a");
    }
  }
  // a wall gone under the sea: a greenish stain below the old tidemark, weed streaks running down, barnacle clusters
  function drowned(k, x, top, w, g, rr, frac0) {
    const tide = top + R((g - top) * (frac0 == null ? 0.42 : frac0)), im = k.ctx.getImageData(x, tide, w, g - tide), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      d[i] = R(d[i] * 0.72 + 0x5a * 0.28); d[i + 1] = R(d[i + 1] * 0.72 + 0x72 * 0.28); d[i + 2] = R(d[i + 2] * 0.72 + 0x4e * 0.28);
    }
    k.ctx.putImageData(im, x, tide);
    for (let xx = x; xx < x + w; xx++) { k.P(xx, tide, rr() < 0.7 ? WEED[2] : WEED[1]); if (rr() < 0.45) k.P(xx, tide + 1, WEED[1]); }
    for (let xx = x + 1; xx < x + w - 1; xx++) if (rr() < 0.16) { const l = 2 + Math.floor(rr() * (g - tide - 2)); k.F(xx, tide + 1, 1, l, rr() < 0.5 ? WEED[1] : "#58704a"); }
    barnacles(k, x + 1, tide + 2, w - 3, Math.max(1, g - tide - 4), Math.max(2, R(w / 7)), rr);
    return tide;
  }
  // a drowned house side-on: barnacled stone, empty windows, a door hanging off one hinge, the roof half gone to rafters, sand to the sills
  function ruin(k, o) {
    const { x, g, w, wh } = o, top = g - wh, rr = Art.rng(o.seed || 1), F = k.F, P = k.P, pal = o.pal || STONE;
    F(x - 1, top - 1, w + 2, wh + 1, OL);
    k.stones(x, top, w, wh, pal, 3);
    F(x + w - 3, top, 3, wh, k.mix(pal[2], pal[3], 0.4)); F(x, top, 1, wh, pal[0]);
    F(x, top, w, 1, k.mix(pal[0], "#ffffff", 0.2));
    const dx = x + (o.doorAt == null ? (w >> 1) - 2 : o.doorAt), dh = Math.min(10, wh - 4);
    const wins = [];
    const nw = Math.max(1, Math.floor((w - 4) / 9));
    for (let i = 0; i < nw; i++) {
      let wx = x + R((i + 0.5) * w / nw) - 1;
      if (Math.abs(wx - dx) < 6) wx = wx < dx ? dx - 6 : dx + 7;
      if (wx < x + 2 || wx > x + w - 5) continue;
      wins.push(wx);
    }
    drowned(k, x, top, w, g, rr, o.tide);
    for (const wx of wins) {
      const wy = top + 4;
      F(wx - 1, wy - 1, 5, 6, OL); F(wx, wy, 3, 4, "#161a1a"); P(wx + 2, wy + 3, "#2e3a38"); F(wx - 1, wy + 4, 5, 1, pal[0]);
      if (rr() < 0.5) { F(wx + 4, wy, 1, 4, "#5a4028"); F(wx + 5, wy + 1, 1, 4, "#6e4c2c"); }
      weed(k, wx - 1, wx + 3, wy - 1, 3, rr);
    }
    if (o.door !== false) {
      F(dx - 1, g - dh - 1, 6, dh + 1, OL); F(dx, g - dh, 4, dh, "#14120f"); F(dx, g - dh, 1, dh, "#262220");
      const left = rr() < 0.5;
      for (let j = 0; j < dh - 1; j++) F(left ? dx - 3 - R(j * 0.18) : dx + 4 + R(j * 0.18), g - dh + 1 + j, 2, 1, j % 3 === 0 ? "#4a3220" : "#7a5432");
      F(left ? dx - 3 : dx + 4, g - dh, 2, 1, OL);
      F(dx - 1, g - dh - 2, 6, 1, pal[1]);
      weed(k, dx - 1, dx + 4, g - dh - 1, 4, rr, 0.2);
    }
    const kind = o.roof || "holed", rh = o.rh || 8, x0 = x - 2, x1 = x + w + 1;
    const span = (j) => [x0 + j, x1 - j];
    if (kind === "gone") {
      for (let xx = x - 1; xx <= x + w; xx++) { const j = R(Math.abs(Math.sin(xx * 0.9 + w)) * 3); if (j) { F(xx, top - j - 1, 1, j + 1, OL); if (xx >= x && xx < x + w) F(xx, top - j, 1, j, pal[1]); } }
      weed(k, x, x + w - 1, top, 3, rr);
    } else {
      const holeX = kind === "rafters" ? null : x + R(w * (0.25 + rr() * 0.4)), holeW = R(w * 0.18) + 3;
      for (let j = 0; j < rh; j++) {
        const [a, b] = span(j), y = top - 1 - j;
        for (let cx = a; cx <= b; cx++) {
          const edge = cx === a || cx === b || j === rh - 1;
          const open = kind === "rafters" ? !edge && j > 0 : holeX != null && Math.abs(cx - holeX) < holeW - R(j * 0.3) && j > 1 && j < rh - 1;
          if (open) { if ((cx - x0) % 4 === 1) P(cx, y, "#2e241c"); continue; }
          P(cx, y, edge ? OL : j === 0 ? "#2e3440" : j % 2 ? "#4e5868" : (cx + j) % 5 === 0 ? "#3e4654" : "#606a7a");
        }
      }
      if (kind === "rafters") { const [a, b] = span(0); for (let cx = a + 1; cx < b; cx++) if (rr() < 0.7) P(cx, top - 1, (cx & 1) ? "#4e5868" : "#606a7a"); }
      weed(k, x0 + 1, x1 - 1, top, 4, rr);
    }
    const sd = o.sand == null ? 3 : o.sand;
    if (sd) for (const sx of [x - 1, x + w]) for (let i = -sd * 2; i <= sd * 2; i++) { const h = R(sd * (1 - Math.abs(i) / (sd * 2 + 1))); if (h > 0) F(sx + i, g - h, 1, h, (sx + i) % 4 ? SAND.dry : SAND.mid); }
    if (o.door !== false) { F(dx, g - 2, 4, 2, SAND.dry); P(dx + 1, g - 3, SAND.dry); P(dx + 2, g - 3, SAND.hi); }
    return { top, door: dx };
  }
  function tent(k, x, g, h, col) {
    for (let j = 0; j < h; j++) {
      const hw = R((j + 1) * 0.95);
      k.F(x - hw - 1, g - h + j, hw * 2 + 3, 1, OL);
      for (let i = -hw; i <= hw; i++) k.P(x + i, g - h + j, Math.floor((i + hw) / 2) % 2 ? "#f2e8cc" : col);
      if (j > 1) k.P(x + hw, g - h + j, k.mix(col, OL, 0.4));
    }
    k.F(x - 2, g - R(h * 0.55), 4, R(h * 0.55), "#2a2018"); k.F(x - 1, g - R(h * 0.5), 2, R(h * 0.5), "#4a3a2a");
    k.F(x, g - h - 3, 1, 3, "#5a3a22");
    k.line(x + R(h * 0.95) + 2, g, x + R(h * 0.95) + 5, g + 1, "#7a6a4a");
  }
  // a salvage man's handcart: a box of finds on one wheel, the shafts out behind; t turns the wheel
  function cart(ctx, x, g, t) {
    const F = (a, b, w, h, c) => rect(ctx, x + a, g + b, w, h, c);
    F(-8, -9, 16, 6, OL); F(-7, -8, 14, 4, "#9a6e3e"); F(-7, -8, 14, 1, "#c08a50"); F(-7, -5, 14, 1, "#6e4a28");
    for (const [a, b, c, w] of [[-6, -11, "#c8963e", 3], [-2, -10, "#7ab0a0", 2], [1, -11, "#e0d8c0", 3], [4, -10, "#c8963e", 2]]) { F(a - 1, b - 1, w + 2, 3, OL); F(a, b, w, 2, c); }
    ln(ctx, x + 7, g - 6, x + 13, g - 4, "#4a3220");
    for (let a = 0; a < 12; a++) { const q = a / 12 * Math.PI * 2; rect(ctx, x - 1 + Math.cos(q) * 3.4, g - 3 + Math.sin(q) * 3.4, 1, 1, OL); }
    const s = t * 4;
    for (const d of [0, Math.PI / 2]) ln(ctx, x - 1 - Math.cos(s + d) * 2, g - 3 - Math.sin(s + d) * 2, x - 1 + Math.cos(s + d) * 2, g - 3 + Math.sin(s + d) * 2, "#9a6e3e");
    rect(ctx, x - 1, g - 3, 1, 1, "#e8c070");
  }
  // a Saltmarrow salvage man pushing his cart across, stopping halfway to stoop over something in the sand
  function salvager(o) {
    const A = window.Anim, ph = (o.seed || 0) * 0.17, per = o.period || 40, left = !!o.left;
    const pal = { a: "#d8b040", A: "#9a7428", s: "#d8a882", c: o.coat || "#4a5a6a", C: "#34404c", p: "#3a3228", f: "#1e1812" };
    const walk = [A.sprite([".aa.", "AAAA", ".ss.", "cccs", "cccc", "cCc.", "p.p.", "f.f."], pal), A.sprite([".aa.", "AAAA", ".ss.", "cccs", "cccc", "cCc.", ".p..", ".f.."], pal)];
    const bend = A.sprite(["....", "....", ".aa.", "AAAAs", "ccccs", "cCc.", "p.p.", "f.f."], pal);
    return { z: o.z == null ? o.y : o.z, front: o.front, draw(ctx, t) {
      const f = frac(t / per + ph), span = o.x1 - o.x0;
      if (f > 0.8) return;
      const u = f / 0.8, stop = u > 0.45 && u < 0.6, pos = u < 0.45 ? u / 0.45 * 0.5 : u < 0.6 ? 0.5 : 0.5 + (u - 0.6) / 0.4 * 0.5;
      const x = R(left ? o.x1 - pos * span : o.x0 + pos * span), y = o.yAt ? o.yAt(x) : o.y;
      ctx.save();
      if (left) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
      cart(ctx, x - 10, y, stop ? 0 : t);
      ctx.restore();
      A.put(ctx, stop ? bend : walk[Math.floor(t * 5) % 2], x + (left ? -2 : 2), y, left);
    } };
  }
  function perch(o) {
    const A = window.Anim, ph = (o.seed || 0) * 0.37, per = o.period || 5;
    return { z: o.z == null ? o.y : o.z, draw(ctx, t) { A.put(ctx, frac(t / per + ph) < (o.duty || 0.18) ? o.b : o.a, o.x, o.y, o.left); } };
  }
  function gullSprites(A) {
    const GP = { k: "#f4f4f0", g: "#8a96a8", y: "#e8a830", e: "#1a1a20" };
    return [A.sprite([".ke", "kky", "gk."], GP, "#6a7280"), A.sprite(["g.ke", ".gky", ".gk."], GP, "#6a7280")];
  }
  // a bell on its beam, swinging; at the top of each swing two short ring marks
  function bell(o) {
    const sp = o.speed || 1.6;
    return { z: o.z == null ? o.y : o.z, draw(ctx, t) {
      const a = Math.sin(t * sp) * (o.amp || 0.5), s = o.s || 1;
      const pt = (dx, dy) => [o.x + dx * Math.cos(a) - dy * Math.sin(a), o.y + dx * Math.sin(a) + dy * Math.cos(a)];
      const rows = s > 1 ? [[0, 1], [1, 2], [2, 2], [3, 2], [4, 3], [5, 3], [6, 4], [7, 5]] : [[0, 1], [1, 1], [2, 2], [3, 2], [4, 3]];
      for (const [dy, hw] of rows) for (let dx = -hw - 1; dx <= hw + 1; dx++) { const [x, y] = pt(dx, dy + 1); rect(ctx, x, y, 1, 1, OL); }
      for (const [dy, hw] of rows) for (let dx = -hw; dx <= hw; dx++) {
        const [x, y] = pt(dx, dy + 1);
        rect(ctx, x, y, 1, 1, dy === rows.length - 1 ? "#2e6a5a" : dx <= -hw + (s > 1 ? 1 : 0) ? "#9ad8c0" : dx === hw ? "#2e6a5a" : "#5aa08a");
      }
      const [cx, cy] = pt(Math.sin(t * sp - 0.7) * (s > 1 ? 2 : 1), rows.length + 1);
      rect(ctx, cx, cy, s > 1 ? 2 : 1, s > 1 ? 2 : 1, "#c8a040");
      if (o.ring && Math.abs(Math.cos(t * sp)) < 0.15) for (const d of [-1, 1]) { rect(ctx, o.x + d * (rows.length + 2), o.y + 3, 1, 3, "#f4f0e0"); rect(ctx, o.x + d * (rows.length + 4), o.y + 2, 1, 5, "#e8e4d4"); }
    } };
  }
  // rings spreading on still water each time the bell swings full out
  function rings(o) {
    const sp = o.speed || 1.6, per = Math.PI / sp;
    return { z: o.y, draw(ctx, t) {
      for (let i = 0; i < 2; i++) {
        const a = frac((t + i * per) / (per * 2)), r = 3 + a * (o.r || 26);
        ctx.globalAlpha = 0.6 * (1 - a);
        for (let q = 0; q < 32; q++) { const th = q / 32 * Math.PI * 2; rect(ctx, o.x + Math.cos(th) * r, o.y + Math.sin(th) * r * 0.2, 2, 1, "#eef8f8"); }
        ctx.globalAlpha = 1;
      }
    } };
  }
  // a mudlurker's eyes on their stalks: up out of the mud, a look round, and back down with a bubble
  function lurk(o) {
    const ph = (o.seed || 0) * 0.29, per = o.period || 11;
    return { z: o.y, draw(ctx, t) {
      rect(ctx, o.x - 3, o.y, 11, 1, "#8a7650"); rect(ctx, o.x - 2, o.y + 1, 9, 1, "#7a6644");
      const f = frac(t / per + ph);
      if (f > 0.5) { if (f > 0.52 && f < 0.62) { rect(ctx, o.x + 1, o.y - 1 - R((f - 0.52) * 30), 1, 1, "#e8dcc0"); rect(ctx, o.x + 3, o.y - 1, 2, 1, "#e8dcc0"); } return; }
      const up = f < 0.08 ? f / 0.08 : f > 0.42 ? (0.5 - f) / 0.08 : 1, h = R(up * 4), look = f > 0.2 && f < 0.32 ? 1 : 0;
      for (const ex of [0, 4]) {
        rect(ctx, o.x + ex, o.y - h, 1, h, "#6a5434");
        rect(ctx, o.x + ex - 1, o.y - h - 2, 3, 2, "#3a2a18"); rect(ctx, o.x + ex - 1 + look, o.y - h - 2, 1, 1, "#f0d860");
      }
    } };
  }
  // the risen island seen across the flats: a low weedy hump with roofless houses and the chapel tower
  function farIsle(k, cx, w, g, rr) {
    const { F, P } = k, x0 = R(cx - w / 2);
    for (let x = x0; x < x0 + w; x++) {
      const u = (x - cx) / (w / 2), top = g - R((1 - u * u) * 5) - 1;
      F(x, top, 1, g - top + 2, (x * 3) % 7 === 0 ? "#68744e" : "#76825a"); P(x, top, "#909c6c");
      P(x, g + 1, "#5a6648");
    }
    const tx = x0 + R(w * 0.18);
    F(tx - 3, g - 22, 7, 20, OL); F(tx - 2, g - 21, 5, 19, "#a4a89e"); F(tx + 1, g - 21, 2, 19, "#888c84"); F(tx - 1, g - 18, 3, 4, "#1c2224");
    for (let j = 0; j < 5; j++) F(tx - 3 + (j >> 1), g - 23 - j, 7 - (j >> 1) * 2, 1, j < 4 ? "#4e8a78" : OL);
    const out = [];
    for (let i = 0; i < 6; i++) {
      const hx = x0 + R(w * (0.34 + i * 0.1)), hw = 6 + (i % 2) * 2, hh = 5 + ((i * 7) % 3), top = g - 3 - hh;
      if (hx + hw > x0 + w - 2) break;
      F(hx - 1, top - 1, hw + 2, hh + 1, "#5a5c58"); F(hx, top, hw, hh, "#b0b2a8"); F(hx + hw - 2, top, 2, hh, "#94968e"); F(hx + 2, top + hh - 3, 2, 3, "#2a2e2e");
      if (i % 3 === 0) for (let j = 0; j < 3; j++) F(hx - 1 + j, top - 1 - j, hw + 2 - j * 2, 1, j === 2 ? "#5a5c58" : "#68707e");
      else if (i % 3 === 1) { ln(k.ctx, hx, top - 1, hx + hw - 1, top - 3, "#4a3a2e"); P(hx + hw - 1, top - 4, "#4a3a2e"); }
      out.push([hx + (hw >> 1), top]);
    }
    return { tower: [tx, g - 18], roofs: out };
  }

  // ---------- Old Marrow ----------
  function old_marrow(k, A) {
    const { W, F, P } = k, add = k.add, rr = Art.rng(311);
    const hz = 40;
    k.grad(0, hz + 2, SKY);
    k.cloud(W * 0.22, 9, 30); k.cloud(W * 0.62, 15, 24); k.cloud(W * 0.9, 6, 18);
    const cliff = (x) => 30 + R(Math.sin(x * 0.05) * 1.5 + Math.sin(x * 0.19)), cw = R(W * 0.56);
    for (let x = 0; x < cw; x++) {
      const t = x > cw - 12 ? cliff(x) + R((x - cw + 12) * 1.1) : cliff(x);
      F(x, t, 1, hz + 2 - t, (x * 5 + t) % 9 === 0 ? "#c0c6cc" : "#d0d6d8"); P(x, t, "#9ab68a"); P(x, t + 1, "#b8c6b4");
    }
    const lx = R(W * 0.12), lt = cliff(lx);
    F(lx - 2, lt - 9, 4, 9, "#d4d4d0"); for (let y = lt - 8; y < lt; y += 3) F(lx - 2, y, 4, 1, "#d89a94"); F(lx - 1, lt - 11, 2, 2, "#f4e4a8");
    for (let i = 0; i < 4; i++) { const hx = R(W * 0.2) + i * 6; F(hx, cliff(hx) - 3, 4, 3, "#ecebe4"); F(hx, cliff(hx) - 4, 4, 1, i % 2 ? "#7a8aa4" : "#c88a74"); }
    F(cw - 6, hz, W - cw + 6, 2, "#5a98cc"); F(cw - 6, hz, W - cw + 6, 1, "#8ac0e4");
    flats(k, hz + 2, 66, { seed: 41, pools: R(W / 34), sky: (y) => (y < 54 ? "#a8cee6" : "#94c4e2") });
    for (let i = 0; i < 9; i++) { const u = i / 8, x = R(W * (0.7 - u * 0.2)), y = R(64 - u * 18), h = Math.max(1, R(5 - u * 4)); F(x, y - h, 1, h, "#3a2a1c"); if (h > 2) P(x, y - h, "#8a6a42"); }
    const bank = (x) => 58 + R(Math.sin(x * 0.04 + 1) * 1.5);
    for (let x = 0; x < W; x++) { const b = bank(x); F(x, b, 1, 66 - b, (x * 3) % 7 === 0 ? "#6e7c50" : "#7a885a"); P(x, b, "#98a46c"); }
    const tx = R(W * 0.05), tg = bank(tx) + 1;
    F(tx - 5, tg - 30, 11, 31, OL); k.stones(tx - 4, tg - 29, 9, 29, ["#b8bab0", "#a0a298", "#888a82", "#6a6c66"], 3); F(tx + 2, tg - 29, 3, 29, "#7e807a");
    F(tx - 2, tg - 25, 5, 7, "#1a2022");
    for (let j = 0; j < 7; j++) F(tx - 5 + (j >> 1), tg - 31 - j, 11 - (j >> 1) * 2, 1, j < 6 ? (j < 2 ? "#5aa08a" : "#4e8a78") : OL);
    weed(k, tx - 4, tx + 4, tg - 30, 4, rr);
    add(bell({ x: tx, y: tg - 25, s: 1, speed: 1.3, amp: 0.45 }));
    const backs = [];
    for (let x = R(W * 0.14); x < W - 10; x += 15 + Math.floor(rr() * 10)) {
      const w = 10 + Math.floor(rr() * 5), hh = 7 + Math.floor(rr() * 4), b = bank(x) + 2, top = b - hh;
      F(x - 1, top - 1, w + 2, hh + 1, "#6a6e6a"); F(x, top, w, hh, "#b4b8b0"); F(x + w - 2, top, 2, hh, "#9a9e98"); F(x + 3, b - 4, 2, 4, "#3a4040"); F(x + w - 5, top + 2, 2, 2, "#3a4040");
      if (rr() < 0.5) for (let j = 0; j < 3; j++) F(x - 1 + j, top - 1 - j, w + 2 - j * 2, 1, j === 2 ? "#6a6e6a" : "#7a8494");
      else { ln(k.ctx, x, top - 1, x + w - 1, top - 3, "#5a4a3e"); ln(k.ctx, x + 2, top - 1, x + 4, top - 3, "#5a4a3e"); }
      for (let xx = x; xx < x + w; xx++) if (rr() < 0.4) P(xx, top + 1, WEED[2]);
      backs.push([x, top]);
    }
    const g = 76, sand = (x, y) => { const v = (x * 7 + y * 13) % 19; return v === 0 ? SAND.lo : v < 3 ? SAND.mid : (x + y * 3) % 23 === 0 ? SAND.hi : SAND.dry; };
    for (let y = 66; y < 90; y++) for (let x = 0; x < W; x++) P(x, y, y === 66 ? k.mix(SAND.dry, "#7a885a", 0.4) : sand(x, y));
    for (const ry of [83, 86]) for (let x = 0; x < W; x++) if (Math.sin(x * 0.07 + ry) > -0.6) P(x, ry, k.mix(SAND.dry, SAND.lo, 0.6));
    pool(k, R(W * 0.3), 87, 26, 1, null); pool(k, R(W * 0.74), 85, 18, 1, null);
    const inn = R(W * 0.47), slots = [];
    let x = R(W * 0.12);
    while (x < W - 12) {
      if (x + 26 > inn - 19 && x < inn + 19) { x = inn + 22; continue; }
      if (x > W * 0.78) break;
      const w = 22 + Math.floor(rr() * 9), wh = 18 + Math.floor(rr() * 8);
      slots.push([x, Math.min(w, W * 0.78 - x), wh]);
      x += w + 5 + Math.floor(rr() * 4);
    }
    const roofs = ["rafters", "holed", "gone", "holed", "rafters"];
    slots.forEach(([hx, w, wh], i) => { if (w > 14) ruin(k, { x: hx, g, w, wh, seed: 50 + i, rh: 7 + (i % 3), roof: roofs[i % 5] }); });
    const iw = 34, ih = 28, ix = inn - iw / 2;
    const it = ruin(k, { x: ix, g: g - 4, w: iw, wh: ih, seed: 7, rh: 10, roof: "holed", door: false, sand: 0, tide: 0.5 });
    F(ix + 12, g - 16, 10, 12, OL); F(ix + 13, g - 15, 8, 11, "#14120f"); F(ix + 14, g - 15, 1, 11, "#262220");
    weed(k, ix + 12, ix + 21, g - 17, 4, rr, 0.15);
    k.stones(inn - 19, g - 4, 38, 2, STONE, 2); F(inn - 19, g - 5, 38, 1, OL);
    k.stones(inn - 15, g - 2, 30, 2, STONE, 2); F(inn - 15, g - 3, 30, 1, OL);
    F(inn + 11, it.top + 3, 1, 4, "#4a3220"); F(inn + 11, it.top + 3, 9, 1, "#4a3220"); F(inn + 18, it.top + 4, 1, 1, "#4a3220");
    F(inn + 15, it.top + 5, 8, 5, OL); F(inn + 16, it.top + 6, 6, 3, "#7a5432"); F(inn + 18, it.top + 6, 2, 3, "#a86a34"); P(inn + 18, it.top + 7, "#5a4a3a");
    const bx = inn - 4, by = g - 5;
    F(bx - 1, by - 10, 10, 11, OL); F(bx, by - 9, 8, 9, "#a86a34"); F(bx, by - 9, 2, 9, "#c88a4a"); F(bx + 6, by - 9, 2, 9, "#7a4a24");
    F(bx, by - 7, 8, 1, "#4a3a2e"); F(bx, by - 3, 8, 1, "#4a3a2e"); F(bx + 3, by - 6, 2, 2, "#5a3a22"); P(bx + 4, by - 4, "#c8a040");
    F(bx - 10, by - 6, 6, 7, OL); F(bx - 9, by - 5, 4, 5, "#9a6436"); F(bx - 9, by - 4, 4, 1, "#4a3a2e");
    F(bx + 12, by - 6, 6, 7, OL); F(bx + 13, by - 5, 4, 5, "#9a6436"); F(bx + 13, by - 4, 4, 1, "#4a3a2e");
    F(bx - 11, by - 8, 30, 2, OL); F(bx - 10, by - 8, 28, 1, "#c09058");
    for (const [cx, c] of [[bx - 7, "#e8e0c8"], [bx + 14, "#7aa494"], [bx + 16, "#e8e0c8"]]) { F(cx, by - 10, 2, 2, c); P(cx, by - 11, OL); }
    F(bx - 13, by - 18, 1, 13, "#2a1a10"); F(bx - 14, by - 21, 3, 3, OL); P(bx - 13, by - 20, "#ffd46a");
    add(A.glow({ x: bx - 13, y: by - 20, r: 14, rgb: "255,200,110", a: 0.22 }));
    add(A.villager({ x0: bx + 21, x1: bx + 24, y: g - 6, speed: 0.6, look: { shirt: "#7a3a2a", hat: null, carry: null, dress: false, skin: "#d8a882" }, seed: 71 }));
    const tents = [[R(W * 0.85), 15, "#b84a3a"], [R(W * 0.95), 12, "#3e6aa8"]];
    for (const [tx2, h, c] of tents) tent(k, tx2, g, h, c);
    const sx = R(W * 0.9), sg = g + 6;
    F(sx, sg - 16, 1, 16, "#4a3220"); F(sx - 2, sg, 5, 1, "#4a3220"); ln(k.ctx, sx - 5, sg - 15, sx + 5, sg - 15, "#6a4a2a");
    for (const d of [-5, 5]) { F(sx + d, sg - 14, 1, 4, "#8a8478"); F(sx + d - 2, sg - 10, 5, 1, "#c8a040"); F(sx + d - 1, sg - 11, 3, 1, d < 0 ? "#e0d8c0" : "#7ab0a0"); }
    const fx = R(W * 0.8), fg = g + 8;
    F(fx - 3, fg - 5, 7, 4, OL); F(fx - 2, fg - 4, 5, 3, "#5a5a5e"); F(fx - 2, fg - 4, 5, 1, "#8a8a8e"); F(fx - 4, fg - 1, 9, 1, "#3a2a1c");
    add(A.torch({ x: fx - 1, y: fg, r: 10, seed: 3 }));
    add(A.smoke({ x: fx, y: fg - 6, wind: 4, seed: 9, col: "#e8e4dc" }));
    F(R(W * 0.24), 85, 9, 3, OL); F(R(W * 0.24) + 1, 85, 7, 2, "#7a6a50"); F(R(W * 0.24) + 2, 84, 2, 1, "#c8963e");
    const ax = R(W * 0.66), ay = 88;
    F(ax, ay - 8, 1, 8, "#4a4a52"); F(ax - 3, ay, 7, 1, "#4a4a52"); P(ax - 3, ay - 1, "#4a4a52"); P(ax + 3, ay - 1, "#4a4a52"); F(ax - 1, ay - 8, 3, 1, "#4a4a52"); P(ax + 1, ay - 3, "#8a4a2a"); P(ax - 1, ay - 5, "#8a4a2a");
    const [gs, gf] = gullSprites(A);
    slots.slice(0, 3).forEach(([hx, w, wh], i) => add(perch({ x: hx + (w >> 1) - 3 + i * 2, y: g - wh - 2, a: gs, b: gf, period: 4 + i * 1.3, left: i % 2 === 0, seed: i })));
    add(perch({ x: inn + 19, y: it.top + 2, a: gs, b: gf, period: 6.1, left: true, seed: 7 }));
    for (let i = 0; i < 4; i++) add(A.gull({ W, y: k.rnd(6, 28), seed: 80 + i }));
    add(salvager({ x0: -18, x1: W + 18, y: 88, period: 46, seed: 2, front: true }));
    add(A.waves({ x0: cw, x1: W, y: hz, h: 2, n: R(W / 14), col: "#e8f6ff", seed: 5 }));
    add(ACT.sparkle({ x: 0, y: hz + 3, w: W, h: 14, n: R(W / 10), col: "#ffffff", seed: 6 }));
    for (const [hx, w, wh] of slots.slice(0, 3)) add(A.drip({ x: hx + 4, y0: g - wh + 1, y1: g - 1, col: "#a8d8e8", seed: hx }));
    add(A.crab({ x: R(W * 0.36), y: 87, range: 10, seed: 4 }));
  }

  // ---------- the Tidal Flats ----------
  function tidal_flats(k, A) {
    const { W, F, P } = k, add = k.add, rr = Art.rng(411);
    const hz = 38;
    k.grad(0, hz + 2, ["#3c86d0", "#5c9edc", "#88bae6", "#bcd8ee", "#eaf0ec"]);
    k.cloud(W * 0.12, 8, 34); k.cloud(W * 0.48, 14, 26); k.cloud(W * 0.82, 7, 30);
    const cw = R(W * 0.34), cliff = (x) => 22 + R(Math.sin(x * 0.06) * 2 + Math.sin(x * 0.21));
    for (let x = 0; x < cw; x++) {
      const t = x > cw - 14 ? cliff(x) + R((x - cw + 14) * 1.3) : cliff(x);
      for (let y = t; y < hz + 2; y++) P(x, y, (y - t) % 5 === 2 ? "#d6d6d0" : (x * 7 + y) % 13 === 0 ? "#cacccc" : "#e6e6e0");
      P(x, t, "#8ab874"); P(x, t + 1, "#a8c890");
    }
    const lx = R(W * 0.08), lt = cliff(lx);
    F(lx - 3, lt - 13, 6, 13, "#2a2a34"); for (let y = lt - 12; y < lt; y++) F(lx - 2, y, 4, 1, Math.floor((y - lt) / 3) % 2 ? "#e8e4dc" : "#d0544a");
    F(lx - 2, lt - 16, 4, 3, "#2a2a34"); F(lx - 1, lt - 15, 2, 2, "#fff0a0");
    for (let i = 0; i < 4; i++) { const hx = R(W * 0.14) + i * 8; F(hx - 1, cliff(hx) - 6, 7, 6, "#2a2a34"); F(hx, cliff(hx) - 5, 5, 5, "#f0ece0"); F(hx - 1, cliff(hx) - 7, 7, 2, i % 2 ? "#4e6488" : "#a04428"); P(hx + 2, cliff(hx) - 3, "#3a5a8a"); }
    F(cw - 8, hz, W - cw + 8, 2, "#4a92cc"); F(cw - 8, hz, W - cw + 8, 1, "#7ab8e4");
    flats(k, hz + 2, 90, { seed: 9, pools: R(W / 30), sky: (y) => (y < 60 ? "#aed2e8" : y < 76 ? "#9ccae4" : "#88bee0") });
    const isle = farIsle(k, R(W * 0.68), R(W * 0.32), hz + 3, rr);
    const posts = [];
    for (let i = 0; i < 13; i++) {
      const u = i / 12, x = R(W * (0.06 + u * 0.48) + Math.sin(u * 3) * 6), y = R(89 - u * 46), h = Math.max(1, R(10 - u * 9));
      posts.push([x, y, h]);
    }
    for (let i = 0; i < posts.length - 1; i++) {
      const [x0, y0, h0] = posts[i], [x1, y1] = posts[i + 1];
      for (let s = 0; s <= 6; s++) { const xx = R(x0 + (x1 - x0) * s / 6), yy = R(y0 + (y1 - y0) * s / 6); F(xx - R(h0 / 2), yy, Math.max(1, h0), 1, k.mix(SAND.wet, "#8a7a5a", 0.35)); }
    }
    for (const [x, y, h] of posts) {
      const pw = h > 6 ? 2 : 1;
      F(x - pw, y - h - 1, pw * 2 + (pw > 1 ? 0 : 1), h + 2, h > 3 ? OL : "#3a2a1c"); if (h > 3) { F(x - pw + 1, y - h, pw * 2 - 1, h, "#5a3e26"); P(x - pw + 1, y - h, "#9a7448"); }
      if (h > 5) { P(x, y - 2, WEED[2]); P(x - 1, y - 1, WEED[1]); F(x - 3, y + 1, 7, 1, k.mix(SAND.lo, "#7a8a80", 0.3)); }
    }
    const wx = R(W * 0.62), wg = 76;
    F(wx - 16, wg - 4, 34, 6, OL);
    for (let x = wx - 15; x < wx + 17; x++) { const top = wg - 3 + R(Math.abs(x - wx) * 0.12); F(x, top, 1, wg + 2 - top, (x % 4) ? "#6a4a30" : "#4a3220"); P(x, top, "#8a6a48"); }
    const rib = (x, h, lean) => { for (let j = 0; j < h; j++) { const dx = R(lean * (j / h) ** 2); F(x + dx - 1, wg - 3 - j, 3, 1, OL); F(x + dx, wg - 3 - j, 1, 1, j % 4 === 0 ? "#8a6a48" : "#6a4a30"); } };
    rib(wx - 12, 9, 5); rib(wx - 6, 13, 3); rib(wx, 15, 1); rib(wx + 6, 13, -2); rib(wx + 12, 8, -4);
    for (let j = 0; j < 20; j++) { const mx = wx + 2 + R(j * 0.45); F(mx - 1, wg - 4 - j, 3, 1, OL); P(mx, wg - 4 - j, j % 5 ? "#7a5636" : "#9a7448"); }
    weed(k, wx - 15, wx + 16, wg + 1, 2, rr); barnacles(k, wx - 14, wg - 2, 28, 3, 6, rr);
    for (let x = wx - 18; x < wx + 20; x++) P(x, wg + 2, SAND.lo);
    const pools = [[R(W * 0.16), 82, 22, 2], [R(W * 0.84), 86, 30, 2], [R(W * 0.88), 66, 14, 1]];
    for (const [px, py, w, h] of pools) pool(k, px, py, w, h, (y) => (y < 84 ? "#a4cce4" : "#8cc0e0"));
    for (const [px, py] of [[R(W * 0.4), 80], [R(W * 0.83), 72]]) add(lurk({ x: px, y: py, seed: px }));
    add(A.bubbles({ x: R(W * 0.6), y: 70, w: 6, n: 2, col: "#e8dcc0", seed: 3 }));
    for (const [px, py, w] of pools) add(ACT.sparkle({ x: px - R(w / 2), y: py - 1, w, h: 2, n: 3, seed: px }));
    add(ACT.sparkle({ x: 0, y: hz + 4, w: W, h: 24, n: R(W / 10), col: "#fff8e0", seed: 7 }));
    add(A.waves({ x0: cw - 8, x1: W, y: hz, h: 2, n: R(W / 12), col: "#e8f6ff", seed: 8 }));
    const OC = { k: "#1a1a20", w: "#f4f4f0", o: "#e8602a", l: "#e89a8a" };
    const wa = A.sprite(["kk...", "kkkoo", "kww..", ".l..."], OC, null), wb = A.sprite([".....", "kk...", "kkkw.", ".lo.o"], OC, null);
    for (const [bx, by, i] of [[R(W * 0.44), 84, 0], [R(W * 0.48), 86, 1], [R(W * 0.92), 78, 2]]) add(perch({ x: bx, y: by, a: wa, b: wb, period: 2.4 + i * 0.7, duty: 0.45, left: i === 1, seed: i }));
    for (let i = 0; i < 5; i++) add(A.gull({ W, y: k.rnd(5, 28), seed: 90 + i }));
    const pathY = (x) => { const u = Math.max(0, Math.min(1, (x - W * 0.06) / (W * 0.48))); return R(89 - u * 46); };
    add(salvager({ x0: R(W * 0.04), x1: R(W * 0.46), yAt: pathY, period: 52, seed: 3 }));
    for (let i = 0; i < 3; i++) add(A.crab({ x: k.rnd(W * 0.05, W * 0.85), y: k.ri(82, 88), range: k.rnd(6, 12), seed: 120 + i }));
    add(bell({ x: isle.tower[0], y: isle.tower[1], s: 1, speed: 1.3, amp: 0.35 }));
  }

  // ---------- the Drowned Chapel ----------
  function marrow_chapel(k, A) {
    const { W, F, P } = k, add = k.add, rr = Art.rng(511);
    const hz = 48, wl = 72;
    k.grad(0, hz, ["#5a7c9c", "#7a96ac", "#a0b2b6", "#c4c8bc", "#dcd6c0"]);
    k.cloud(W * 0.18, 10, 36, ["#eef0f0", "#cdd4d8", "#a4b0b8"]); k.cloud(W * 0.8, 16, 28, ["#eef0f0", "#cdd4d8", "#a4b0b8"]);
    F(0, hz - 2, W, 3, "#6a8aa4"); F(0, hz - 2, W, 1, "#9ab8cc");
    flats(k, hz + 1, wl, { seed: 21, pools: R(W / 30), sheen: "#aebcbc", sky: () => "#a8bcc4" });
    const cx = R(W * 0.56), nw = 60, nh = 26, ng = wl, nx = cx - nw / 2 + 6, nt = ng - nh;
    const tw = 18, twx = nx - tw - 1, tt = 10;
    const pal = ["#d0ccb8", "#b2ae9a", "#928e7c", "#666252"];
    F(nx - 1, nt - 1, nw + 2, nh + 1, OL);
    k.stones(nx, nt, nw, nh, pal, 3);
    F(nx + nw - 3, nt, 3, nh, k.mix(pal[2], pal[3], 0.4));
    const wins = [nx + 14, nx + 29, nx + 44];
    for (const wx of wins) {
      const wy = nt + 5, wh2 = 11;
      F(wx - 1, wy - 1, 7, wh2 + 2, OL); k.blob(wx + 2, wy - 1, 2, 2, OL);
      F(wx, wy, 5, wh2, "#1a2422"); k.blob(wx + 2, wy, 1, 1, "#1a2422"); P(wx + 2, wy - 2, "#1a2422");
      F(wx + 2, wy, 1, wh2, "#3a3a34"); F(wx, wy + 5, 5, 1, "#3a3a34");
      P(wx + 1, wy + 2, "#3e7a68"); P(wx + 3, wy + 7, "#3e7a68");
      F(wx - 1, wy + wh2, 7, 1, pal[0]);
    }
    drowned(k, nx, nt, nw, ng, rr, 0.45);
    for (const wx of wins) weed(k, wx - 1, wx + 5, nt + 3, 5, rr, 0.25);
    const rh = 14;
    for (let j = 0; j < rh; j++) {
      const y = nt - 1 - j, a = nx - 3 + j, b = nx + nw + 2 - j;
      for (let x = a; x <= b; x++) {
        const gone = x > nx + nw * 0.5 && x < nx + nw * 0.84 && j > 1 && j < rh - 2 + (x > nx + nw * 0.7 ? 1 : 0);
        if (gone) { if ((x - nx) % 5 === 1) P(x, y, "#2e241c"); continue; }
        P(x, y, x === a || x === b || j === rh - 1 ? OL : j === 0 ? "#2e3440" : j % 2 ? "#4e5868" : (x + j) % 5 === 0 ? "#3e4654" : "#606a7a");
      }
    }
    weed(k, nx - 2, nx + nw + 1, nt - 1, 7, rr, 0.3);
    F(twx - 1, tt - 1, tw + 2, ng - tt + 1, OL);
    k.stones(twx, tt, tw, ng - tt, pal, 3);
    F(twx + tw - 3, tt, 3, ng - tt, k.mix(pal[2], pal[3], 0.4)); F(twx, tt, 1, ng - tt, pal[0]);
    drowned(k, twx, tt, tw, ng, rr, 0.72);
    const bx = twx + (tw >> 1), by = tt + 6;
    F(twx + 3, tt + 3, tw - 6, 17, OL); F(twx + 4, tt + 4, tw - 8, 16, "#14181a"); k.blob(bx, tt + 4, (tw >> 1) - 4, 2, "#14181a");
    F(twx + 3, tt + 20, tw - 6, 1, pal[0]);
    F(twx + 4, by - 1, tw - 8, 1, "#5a3e26");
    for (let i = 0; i < 4; i++) { const mx = twx - 1 + i * 6; if (mx < twx + tw) { F(mx, tt - 6, 4, 6, OL); F(mx + 1, tt - 5, 2, 5, pal[i === 1 ? 2 : 0]); } }
    F(twx - 2, tt - 1, tw + 4, 2, OL); F(twx - 1, tt - 1, tw + 2, 1, pal[1]);
    weed(k, twx - 1, twx + tw, tt + 1, 6, rr, 0.35);
    add(bell({ x: bx, y: by, s: 2, speed: 1.6, amp: 0.55, ring: true }));
    F(twx + 6, tt + 26, 6, 9, OL); F(twx + 7, tt + 27, 4, 8, "#1a2422"); k.blob(twx + 9, tt + 26, 2, 1, OL);
    const dx = nx + 4;
    F(dx - 1, ng - 17, 11, 17, OL); k.blob(dx + 4, ng - 17, 5, 3, OL);
    F(dx, ng - 16, 9, 16, "#100c0a"); k.blob(dx + 4, ng - 16, 4, 2, "#100c0a");
    for (let j = 0; j < 13; j++) F(dx + 10 + R(j * 0.12), ng - 14 + j, 3, 1, j % 3 === 0 ? "#4a3220" : "#7a5432");
    weed(k, dx - 1, dx + 9, ng - 19, 5, rr, 0.15);
    add({ z: ng, light: true, draw(ctx, t) {
      const f = frac(t / 7.5);
      for (const [ex, ey, off] of [[dx + 2, ng - 10, 0], [dx + 5, ng - 7, 0.45]]) {
        const a = frac(f + off);
        if (a > 0.6 || (a > 0.28 && a < 0.31)) continue;
        window.Anim.light(ctx, ex + 1, ey, 6, "120,240,200", 0.25);
        rect(ctx, ex, ey, 1, 1, "#9af0d0"); rect(ctx, ex + 2, ey, 1, 1, "#9af0d0");
      }
    } });
    // the churchyard wall, fallen to stubs in places
    const wall = (x0, x1) => {
      for (let x = x0; x < x1; x += 6) {
        const h = Math.sin(x * 0.31) > 0.55 ? 0 : 3 + (Math.sin(x * 0.17) > 0 ? 2 : 0), w = Math.min(6, x1 - x);
        if (!h || w < 3) continue;
        F(x - 1, wl - h - 1, w + 1, h + 1, OL);
        k.stones(x, wl - h, w - 1, h, pal, 2);
        F(x, wl - h, w - 1, 1, pal[0]);
      }
    };
    wall(2, twx - 26); wall(nx + nw + 40, W - 2);
    const graves = [[twx - 20, 1, 1], [twx - 12, 0, 0], [R(W * 0.08), 1, 2], [nx + nw + 9, 0, 1], [nx + nw + 18, 1, 0], [nx + nw + 28, 0, 2]];
    for (const [gx, gd, kind] of graves) {
      if (gx > W - 6 || gx < 4) continue;
      const gg = wl + gd, lean = rr() < 0.5 ? 1 : -1;
      if (kind === 1) { F(gx - 1, gg - 12, 3, 12, OL); F(gx - 4, gg - 10, 9, 3, OL); F(gx, gg - 11, 1, 11, pal[1]); F(gx - 3, gg - 9, 7, 1, pal[1]); P(gx, gg - 11, pal[0]); P(gx - 3, gg - 9, pal[0]); }
      else if (kind === 2) { F(gx - 5, gg - 6, 11, 6, OL); F(gx - 4, gg - 5, 9, 5, pal[1]); F(gx - 4, gg - 5, 9, 1, pal[0]); F(gx + 2, gg - 4, 2, 4, pal[2]); }
      else { for (let y = 0; y < 10; y++) { const sh = R(y * lean * 0.18); F(gx - 4 + sh, gg - 10 + y, 9, 1, OL); if (y > 0) F(gx - 3 + sh, gg - 10 + y, 7, 1, y === 1 ? pal[0] : pal[1]); } k.blob(gx, gg - 9, 3, 1, OL); F(gx - 2, gg - 9, 5, 1, pal[0]); }
      barnacles(k, gx - 3, gg - 4, 6, 3, 2, rr);
      F(gx - 3, gg - 1, 7, 1, WEED[1]); P(gx - 2, gg - 2, WEED[2]);
    }
    const water = (y) => (y < wl + 4 ? "#7aa2b0" : y < wl + 10 ? "#6894a6" : "#5a889c");
    const src = k.ctx.getImageData(0, 0, W, wl).data;
    for (let y = wl; y < 90; y++) {
      const sy = wl - 1 - R((y - wl) * 1.3);
      const band = (y - wl) % 3 === 2;
      for (let x = 0; x < W; x++) {
        if (sy < hz || band) { P(x, y, water(y)); continue; }
        const ox = R(Math.sin(y * 1.3 + x * 0.04) * 1.5), i = (sy * W + Math.max(0, Math.min(W - 1, x + ox))) * 4;
        P(x, y, k.mix(hex(src[i], src[i + 1], src[i + 2]), water(y), 0.5 + (y - wl) * 0.012));
      }
    }
    for (let x = 0; x < W; x++) P(x, wl, (x % 5) ? "#d8ecec" : "#a8c8cc");
    add(rings({ x: bx, y: wl + 5, r: 34, speed: 1.6 }));
    add(A.waves({ x0: 0, x1: W, y: wl + 2, h: 15, n: R(W / 9), col: "#cfe6ea", seed: 11 }));
    add(ACT.sparkle({ x: 0, y: wl + 1, w: W, h: 15, n: R(W / 12), col: "#f4fbff", seed: 12 }));
    add(A.mist({ W, y: wl - 7, h: 9, rgb: "214,226,226", a: 0.3, speed: 1.6, seed: 13 }));
    for (const ddx of [wins[0] + 2, wins[2] + 2, twx + 4]) add(A.drip({ x: ddx, y0: nt + 18, y1: ng - 1, col: "#a8d0d8", seed: ddx }));
    const [gs, gf] = gullSprites(A);
    add(perch({ x: twx + 3, y: tt - 7, a: gs, b: gf, period: 5.5, seed: 1 }));
    add(perch({ x: nx + nw - 2, y: nt - 2, a: gs, b: gf, period: 4.2, left: true, seed: 2 }));
    for (let i = 0; i < 2; i++) add(A.gull({ W, y: k.rnd(8, 26), seed: 130 + i }));
    add(A.crab({ x: nx + nw + 14, y: wl - 1, range: 8, seed: 5 }));
  }

  TS.register("old_marrow", old_marrow, "towns", { primary: "#3e7a74", accent: "#c8963e", dark: "#1e2e2c", light: "#ece6d4" });
  TS.register("tidal_flats", tidal_flats, "wilds");
  TS.register("marrow_chapel", marrow_chapel, "dungeons");
  TS.FOOT.marrow_chapel = 72;
})();
