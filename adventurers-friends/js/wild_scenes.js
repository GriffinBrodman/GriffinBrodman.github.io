/* Map-page headers for the wilds and the dungeons without a scene in town_scenes.js, registered with TownScenes. */
(function () {
  "use strict";
  const TS = window.TownScenes;
  if (!TS || !TS.register) return;
  const { rect, ln } = TS, ACT = TS.actors;
  const R = Math.round;
  const frac = (v) => ((v % 1) + 1) % 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- shared painting ----------
  // a mountain range: each peak is [x, top, left slope, right slope]; the sunlit side is left of each summit
  function range(k, o) {
    const { W, P } = k, nn = k.noise(o.seed), n2 = noise2d(o.seed + 5), tops = [];
    const rock = o.rock || o.shade, rockLit = o.rockLit || o.lit, mid = o.mid || Art.mix(o.lit, o.shade, 0.45);
    for (let x = 0; x < W; x++) {
      let best = 999, pkx = 0;
      for (const [px, py, sl, sr] of o.peaks) {
        const y = py + (x < px ? (px - x) * sl : (x - px) * sr) + k.fbm(nn, x / 3) * (o.jag || 2.5);
        if (y < best) { best = y; pkx = px; }
      }
      best = R(best);
      tops[x] = best;
      for (let y = best; y < o.base; y++) {
        const d = y - best, bend = (n2(x / 6, y / 8) - 0.5) * 22;
        const lit = (x - pkx) + bend - d * 0.12 < 0;
        let c = lit ? o.lit : o.shade;
        if (d === 0) c = lit ? (o.rim || o.lit) : o.lit;
        else if (n2(x / 7 + 30, y / 6) > 0.68) c = lit ? mid : Art.mix(o.shade, rock, 0.5);
        if (d > 3 && n2(x / 4.5 + 70, y / 3.5) > 0.74) c = lit ? rockLit : rock;
        if (o.snowline != null && y > o.snowline + k.fbm(nn, x / 7 + 3) * 8) c = lit ? (o.lowLit || rockLit) : (o.lowShade || rock);
        if (o.fade) c = Art.mix(c, o.fade, Math.min(0.6, (y - best) / Math.max(8, o.base - best) * 0.6));
        P(x, y, c);
      }
    }
    return tops;
  }
  // smooth 2D value noise in 0..1, for textures that must not streak along one direction
  function noise2d(seed) {
    const r = Art.rng(seed), N = 64, tab = [];
    for (let i = 0; i < N * N; i++) tab.push(r());
    const at = (x, y) => tab[((y % N + N) % N) * N + ((x % N + N) % N)];
    const s = (t) => t * t * (3 - 2 * t);
    const one = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    };
    return (x, y) => one(x, y) * 0.6 + one(x * 2.1 + 17, y * 2.1 + 5) * 0.3 + one(x * 4.3 + 3, y * 4.3 + 29) * 0.1;
  }
  function grove(k, base, col, rim, trunk, minR, maxR, gap, sd) {
    const r = Art.rng(sd), out = [];
    for (let x = -6 + Math.floor(r() * gap); x < k.W + 6; x += gap + Math.floor(r() * gap)) {
      const rr = minR + Math.floor(r() * (maxR - minR + 1)), h = Math.floor(r() * 5), cy = base - rr - 3 - h;
      if (trunk) rect(k.ctx, x, cy + rr - 1, 1, base - cy - rr + 1, trunk);
      k.blob(x, cy, rr, R(rr * 0.85), col);
      k.blob(x - 1, cy - 2, Math.max(1, rr - 3), Math.max(1, R(rr * 0.4)), rim);
      if (rr > 4) k.dith(x - rr + 2, cy + R(rr * 0.4), rr * 2 - 3, 2, k.mix(col, "#000000", 0.12), 0.5);
      out.push([x, cy, rr]);
    }
    return out;
  }

  // ---------- shared actors ----------
  function banner(o) {
    const ph = (o.seed || 0) * 0.7, w = o.w || 5, h = o.h || 12, mid = (w - 1) / 2;
    const sway = (j, t) => R(Math.sin(t * 2.1 - j * 0.45 + ph) * 0.9 * (j / (h - 1)));
    return { z: o.z == null ? o.y + h : o.z, draw(ctx, t) {
      for (let j = 0; j < h; j++) {
        const dx = sway(j, t);
        for (let i = 0; i < w; i++) {
          if (o.fork && j >= h - 2 && Math.abs(i - mid) < (j === h - 1 ? 2 : 1)) continue;
          rect(ctx, o.x + i + dx, o.y + j, 1, 1, i === 0 ? o.lit : i === w - 1 ? o.dark : o.col);
        }
      }
      if (o.emblem) for (const [ex, ey, c] of o.emblem) rect(ctx, o.x + ex + sway(ey, t), o.y + ey, 1, 1, c);
    } };
  }
  function lurker(o) {
    const A = window.Anim, ph = (o.seed || 0) * 0.29, per = o.period || 13;
    const pal = { h: o.hood || "#4a5a2e", d: o.shade || "#2e3a1e", f: "#1e1812", e: "#f4e6a0", s: o.skin || "#c8946a" };
    const kob = o.kind === "kobold";
    if (kob) Object.assign(pal, { h: "#e8dcb8", s: o.skin || "#c8603a", d: o.shade || "#7a3420", e: "#f4e040", f: o.skin || "#c8603a" });
    const rows = kob ? (eyeRow) => [".h...h.", ".hsssh.", eyeRow, "sssssss", ".sdsds.", "..sss.."] : (eyeRow) => ["..hhh..", ".hhhhh.", "hhfffhh", eyeRow, "hhfffhh", "dhhhhhd", "ddhhhdd"];
    const head = (kob ? ["ssesess", "sesesss", "sssesse", "sssssss"] : ["hhefefh", "hefeffh", "hhffefh", "hhfffhh"]).map((e) => A.sprite(rows(e), pal));
    return { z: o.z || o.y, draw(ctx, t) {
      const f = frac(t / per + ph);
      if (f > 0.5) return;
      const up = f < 0.06 ? f / 0.06 : f > 0.44 ? (0.5 - f) / 0.06 : 1;
      const look = frac(t / 2.7 + ph) < 0.05 ? 3 : f < 0.16 ? 0 : f < 0.27 ? 1 : f < 0.38 ? 2 : 0;
      const y = o.y + R((1 - up) * 9);
      A.put(ctx, head[look], o.x, y);
      if (o.blade && up > 0.9 && f > 0.2 && f < 0.36) { rect(ctx, o.x + 5, y - 7, 1, 4, "#c8ccd4"); rect(ctx, o.x + 5, y - 8, 1, 1, "#ffffff"); rect(ctx, o.x + 5, y - 3, 1, 1, "#5a3a22"); }
    } };
  }
  function caravan(o) {
    const ph = (o.seed || 0) * 0.13, per = o.period || 44, stop = o.stop, span0 = stop + 34, span1 = o.W + 34 - stop;
    const WOOD = ["#c08a50", "#8e5c30", "#5e3a1e"], TOP = o.canopy || ["#f2e8cc", "#c8463a", "#d8ccac", "#9a3028"];
    const draw = (ctx, x, y, t, moving) => {
      const F = (a, b, w, h, c) => rect(ctx, x + a, y + b, w, h, c);
      const step = moving ? Math.floor(t * 6) % 2 : 0;
      F(-13, -9, 15, 1, "#2a1a10");
      F(-13, -8, 15, 4, WOOD[1]); F(-13, -8, 15, 1, WOOD[0]); F(-13, -5, 15, 1, WOOD[2]); F(-13, -8, 1, 4, "#2a1a10"); F(1, -8, 1, 4, "#2a1a10");
      for (let i = -11; i < 0; i += 3) F(i, -7, 1, 2, WOOD[2]);
      for (let j = 0; j < 7; j++) {
        const ins = j === 0 ? 2 : j === 1 ? 1 : 0;
        for (let i = -12 + ins; i <= 0 - ins; i++) {
          const band = Math.floor((i + 12) / 2) % 2;
          let c = band ? TOP[1] : TOP[0];
          if (i >= -1 - ins) c = band ? TOP[3] : TOP[2];
          F(i, -16 + j, 1, 1, c);
        }
        F(-13 + ins, -16 + j, 1, 1, "#2a1a10"); F(1 - ins, -16 + j, 1, 1, "#2a1a10");
      }
      F(-10, -17, 9, 1, "#2a1a10");
      F(-14, -7, 2, 2, "#c89a5a"); F(-14, -7, 2, 1, "#e8c070");
      const wheel = (cx, cy, r) => {
        for (let a = 0; a < 12; a++) { const q = a / 12 * Math.PI * 2; rect(ctx, x + cx + Math.cos(q) * r, y + cy + Math.sin(q) * r, 1, 1, "#2a1a10"); }
        const s = (moving ? t * 5 : 0) + cx;
        for (let q = 0; q < 2; q++) { const a = s + q * Math.PI / 2; ln(ctx, x + cx - Math.cos(a) * (r - 1), y + cy - Math.sin(a) * (r - 1), x + cx + Math.cos(a) * (r - 1), y + cy + Math.sin(a) * (r - 1), WOOD[0]); }
        rect(ctx, x + cx, y + cy, 1, 1, "#e8c070");
      };
      wheel(-9, -3, 3); wheel(-1, -3, 2.4);
      F(1, -11, 3, 3, "#2a1a10"); F(2, -12, 2, 1, "#5a3a22"); F(1, -13, 4, 1, "#5a3a22"); F(2, -11, 2, 1, "#e0b088"); F(2, -10, 2, 2, "#4a6a3a");
      ln(ctx, x + 2, y - 6, x + 7, y - 7, "#5a3a22");
      const hc = "#8a5a34", hd = "#5e3a22", bob = moving ? 0 : (Math.floor(t * 0.8) % 3 === 0 ? 1 : 0);
      F(5, -10, 8, 4, "#2a1a10"); F(6, -9, 6, 3, hc); F(6, -9, 6, 1, "#a8744a");
      F(11, -13 + bob, 3, 4, "#2a1a10"); F(12, -13 + bob, 3, 2, "#2a1a10"); F(12, -12 + bob, 2, 3, hc); F(14, -12 + bob, 1, 2, hc); P2(ctx, x + 13, y - 12 + bob, "#1a1010"); F(11, -12 + bob, 1, 3, hd);
      F(4, -9, 1, 3, hd);
      const L = step ? [[6, 0], [8, 1], [10, 0], [11, 1]] : [[7, 1], [8, 0], [10, 1], [12, 0]];
      for (const [lx, d] of L) F(lx, -6, 1, 5 - d, hd);
      F(6, -1, 1, 1, "#2a1a10"); F(11, -1, 1, 1, "#2a1a10");
    };
    return { z: o.y, draw(ctx, t) {
      const f = frac(t / per + ph);
      let x, moving = true;
      if (f < 0.34) x = -34 + span0 * (f / 0.34);
      else if (f < 0.5) { x = stop; moving = false; }
      else if (f < 0.86) x = stop + span1 * ((f - 0.5) / 0.36);
      else return;
      x = R(x);
      draw(ctx, x, o.y, t, moving);
      if (moving) for (let k = 0; k < 3; k++) {
        const a = frac(t * 1.4 + k / 3);
        ctx.globalAlpha = 0.55 * (1 - a);
        rect(ctx, x - 14 - a * 7, o.y - 1 - a * 3, a < 0.5 ? 1 : 2, a < 0.5 ? 1 : 2, o.dust || "#e8dcb8");
        ctx.globalAlpha = 1;
      }
    } };
  }
  function P2(ctx, x, y, c) { rect(ctx, x, y, 1, 1, c); }
  function eyes(o) {
    const ps = o.pts.map((p, i) => [p[0], p[1], ((o.seed || 1) * 0.31 + i * 0.43) % 1, 5 + (i % 3) * 1.7]);
    return { z: o.z || 0, draw(ctx, t) {
      for (const [x, y, ph, per] of ps) {
        const f = frac(t / per + ph);
        if (f > 0.55) continue;
        const shut = f < 0.04 || f > 0.51 || Math.abs(f - 0.3) < 0.02;
        const dx = f > 0.18 && f < 0.3 ? 1 : 0;
        if (o.glow) window.Anim.light(ctx, x + 1, y, 5, o.glow, 0.25);
        rect(ctx, x + dx, y, 1, shut ? 0 : 1, o.col || "#f0d040");
        rect(ctx, x + 3 + dx, y, 1, shut ? 0 : 1, o.col || "#f0d040");
        if (!shut && o.hot) { rect(ctx, x + dx, y, 1, 1, o.hot); }
      }
    } };
  }

  function perch(o) {
    const A = window.Anim, ph = (o.seed || 0) * 0.37, per = o.period || 5;
    return { z: o.z == null ? o.y : o.z, front: o.front, draw(ctx, t) {
      const f = frac(t / per + ph);
      A.put(ctx, f < (o.duty || 0.18) ? o.b : o.a, o.x, o.y + (o.bob ? R(Math.sin(t * 1.6 + ph * 6) * o.bob) : 0), o.left);
    } };
  }
  function flyby(o) {
    const A = window.Anim, ph = (o.seed || 0) * 0.19, per = o.period || 30, left = !!o.left, dur = o.dur || 0.45;
    return { z: o.z == null ? -70 : o.z, draw(ctx, t) {
      const f = frac(t / per + ph), span = o.W + 40;
      if (f > dur) return;
      const u = f / dur, x = left ? o.W + 20 - u * span : -20 + u * span;
      const y = o.y + Math.sin(u * Math.PI * 2 + ph) * (o.wave || 4);
      A.put(ctx, o.frames[Math.floor(t * (o.flap || 5)) % o.frames.length], x, y, left);
    } };
  }

  // ---------- the King's Road ----------
  function kingsroad(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const OL = "#2a2018";
    k.grad(0, 56, ["#4f8fd4", "#6ea6dc", "#98c0e2", "#c8dae0", "#ecdcb4"]);
    k.cloud(W * 0.12, 10, 30); k.cloud(W * 0.48, 5, 18); k.cloud(W * 0.9, 13, 26);
    k.ridge(50, 9, 44, "#a4b8cc", 41, "#b6c8d8");
    const cx = R(W * 0.7);
    k.blob(cx, 55, 42, 10, "#86a67e"); k.blob(cx - 8, 52, 30, 6, "#92b288");
    for (let i = 0; i < 26; i++) { const x = cx + k.ri(-36, 36), y = k.ri(50, 58); if (Math.abs(x - cx) > 40 - (58 - y) * 2.6) continue; F(x, y, 3, 2, "#6e8e6c"); F(x, y, 2, 1, "#86a682"); }
    const C = { st: ["#eef0f0", "#d0d4dc", "#aeb4c4", "#868ea4"], rf: ["#e09a8e", "#c06a64", "#8e5058"], ol: "#6a6e84", win: "#6a6e84" };
    const tower = (x, top, w, base, roofH) => {
      F(x - 1, top, w + 2, base - top, C.ol); F(x, top, w, base - top, C.st[1]); F(x, top, 1, base - top, C.st[0]); F(x + w - 1, top, 1, base - top, C.st[2]);
      k.tri(x - 2, top - roofH, w + 4, roofH + 1, C.ol); k.tri(x - 1, top - roofH + 1, w + 2, roofH, C.rf[1]); k.tri(x - 1, top - roofH + 1, R((w + 2) / 2), roofH, C.rf[0]);
      P(x + (w >> 1), top + 3, C.win); if (base - top > 10) P(x + (w >> 1), top + 8, C.win);
      return [x + (w >> 1), top - roofH];
    };
    F(cx - 19, 40, 38, 8, C.ol); F(cx - 18, 41, 36, 7, C.st[1]); F(cx - 18, 41, 36, 1, C.st[0]);
    for (let x = cx - 18; x < cx + 18; x += 2) P(x, 40, C.st[1]);
    for (let x = cx - 16; x < cx + 16; x += 4) P(x, 44, C.st[2]);
    F(cx - 7, 30, 14, 11, C.ol); F(cx - 6, 31, 12, 10, C.st[1]); F(cx - 6, 31, 3, 10, C.st[0]); F(cx + 3, 31, 3, 10, C.st[2]);
    for (let x = cx - 6; x < cx + 6; x += 2) P(x, 30, C.st[1]);
    P(cx - 3, 34, C.win); P(cx + 2, 34, C.win); F(cx - 1, 36, 2, 3, C.win);
    const tips = [tower(cx - 21, 33, 5, 48, 7), tower(cx + 16, 33, 5, 48, 7), tower(cx - 2, 20, 4, 31, 8)];
    F(cx - 1, 44, 3, 4, "#585c72"); P(cx, 43, "#585c72");
    for (const [tx, ty] of tips) { F(tx, ty - 4, 1, 4, C.ol); add(ACT.pennant({ x: tx, y: ty - 4, len: 4, h: 2, c1: "#c84a40", c2: "#e8786a", seed: tx })); }
    const mid = k.ridge(60, 4, 22, "#7aa456", 42, "#8eb864");
    k.grad(58, 70, ["#82aa58", "#76a050", "#6c984a"]);
    for (let y = 61; y < 68; y += 3) {
      let x = -k.ri(0, 20);
      while (x < W) {
        const w = k.ri(18, 40), c = k.pick(["#a8bc62", "#c8bc5c", "#86aa54", "#98b45c", "#b4c070"]);
        for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + w; xx++) if (xx >= 0 && xx < W && yy < 69) P(xx, yy, (xx + yy * 2) % 5 === 0 ? k.mix(c, "#ffffff", 0.15) : c);
        if (x > 0) { P(x, y, "#4e7a34"); P(x, y + 1, "#4e7a34"); P(x, y + 2, "#4e7a34"); }
        x += w;
      }
      for (let x = 0; x < W; x++) if (k.r() < 0.6) P(x, y + 2, k.r() < 0.5 ? "#4e7a34" : "#5e8a3c");
    }
    for (let i = 0; i < W / 22; i++) { const x = k.ri(0, W); if (Math.abs(x - cx) < 26) continue; k.tree(x, mid[clamp(x, 0, W - 1)] + 5, k.ri(1, 3), ["#3e6a32", "#4e8038", "#62963e", "#86b450"]); }
    const jx = R(W * 0.6);
    for (let y = 48; y < 70; y++) {
      const u = (y - 48) / 21, c0 = cx + (jx - cx) * u + Math.sin(u * Math.PI) * 9, hw = 0.5 + u * 2.8;
      const l = R(c0 - hw), r2 = R(c0 + hw);
      F(l, y, r2 - l + 1, 1, "#d6c8a4"); P(l, y, "#a89878"); P(r2, y, "#a89878");
      if (y % 2 === 0 && r2 - l > 3) P(R(c0), y, "#bcae8c");
    }
    const GAP = "#a29470", ST = ["#e8dcbc", "#d8caa8", "#cbbc98", "#b4a47e"];
    F(0, 68, W, 1, "#4e7a36"); F(0, 69, W, 1, "#bcae8a"); F(0, 70, W, 11, GAP);
    for (const [y, h, a, b] of [[70, 2, 4, 6], [73, 3, 5, 8], [77, 3, 7, 10]]) {
      let x = -k.ri(0, 6);
      while (x < W) {
        const w = k.ri(a, b), c = k.r() < 0.55 ? ST[1] : ST[2];
        F(x, y, w - 1, h, c);
        F(x + 1, y, w - 3, 1, ST[0]);
        if (h > 2) { F(x + 1, y + h - 1, w - 3, 1, ST[3]); P(x, y, GAP); P(x + w - 2, y, GAP); P(x, y + h - 1, GAP); P(x + w - 2, y + h - 1, GAP); }
        if (k.r() < 0.1) P(x + w - 1, y + k.ri(0, h - 1), "#7a9a4a");
        x += w;
      }
    }
    for (let x = 0; x < W; x++) if ((x * 13) % 29 < 3) P(x, 76, k.mix(GAP, ST[1], 0.5));
    F(0, 80, W, 1, "#cfc2a0"); F(0, 81, W, 2, "#958870"); for (let x = k.ri(0, 5); x < W; x += 7) F(x, 81, 1, 2, "#7a6e58");
    k.grad(83, 90, ["#6c9a48", "#5e8e40", "#4e7c36"]);
    for (let i = 0; i < W / 2; i++) { const x = k.ri(0, W), y = k.ri(83, 89); P(x, y, k.pick(["#86b45a", "#4a7032", "#7aa850"])); }
    for (let i = 0; i < W / 9; i++) { const x = k.ri(0, R(W * 0.55)), y = k.ri(84, 89); P(x, y, k.pick(["#e84a3a", "#f4e8d0", "#f0c840", "#e84a3a"])); P(x, y + 1, "#3e6a2e"); }
    const stone = (x, g, num) => {
      F(x - 1, g - 8, 6, 8, OL); P(x - 1, g - 8, "#5e8a40"); P(x + 4, g - 8, "#5e8a40");
      F(x, g - 7, 4, 7, "#d8d4c6"); F(x, g - 8, 4, 1, "#d8d4c6"); P(x, g - 8, "#5e8a40"); P(x + 3, g - 8, "#5e8a40"); F(x + 3, g - 7, 1, 7, "#a8a498"); F(x, g - 7, 1, 6, "#eeebe2");
      for (let i = 0; i < num; i++) F(x + 1 + i, g - 5, 1, 2, "#6e6a62");
      P(x, g - 2, "#6a9a3e"); P(x + 1, g - 1, "#6a9a3e"); P(x - 1, g, "#5e8a40"); P(x + 4, g, "#5e8a40");
    };
    stone(R(W * 0.06), 69, 1); stone(R(W * 0.44), 69, 2); if (W > 200) stone(R(W * 0.93), 69, 3);
    const wx = R(W * 0.12), ww = 26;
    const inn = k.house({ x: wx, g: 68, w: ww, wh: 15, rh: 9, wall: ["#f2e6c8", "#dccaa4", "#b8a27c"], roof: ["#d0724e", "#a8503a", "#6e3226"], frame: "#5e3c22", ol: OL, type: "gable", chim: "l", chimC: "#9a8a7a", lit: true, wins: 2, doorAt: 15 });
    const sx = wx + ww + 1;
    F(sx, 55, 13, 1, OL); for (let i = 0; i < 13; i++) P(sx + i, 54 - R(i * 0.25), "#8a5a34");
    k.line(sx, 54, sx + 12, 51, OL); F(sx, 52, 13, 2, "#a8744a"); for (let i = 0; i < 13; i += 2) P(sx + i, 53, "#7a4e2c");
    F(sx + 12, 52, 1, 16, "#5e3c22"); F(sx + 1, 56, 11, 12, "#4a3424"); F(sx + 1, 64, 11, 4, "#c8a858"); for (let i = 0; i < 11; i += 2) P(sx + 1 + i, 63, "#e0c470");
    F(sx + 6, 58, 3, 2, "#6a4428"); F(sx + 8, 57, 2, 3, "#6a4428"); P(sx + 9, 58, "#1a1010"); F(sx + 6, 57, 2, 1, "#2e2018");
    const tx0 = wx + 3;
    F(tx0 - 1, 66, 9, 3, OL); F(tx0, 66, 7, 2, "#8a6038"); F(tx0, 66, 7, 1, "#6ab0d8");
    add(ACT.swing({ x: wx + ww - 7, y: 52 + 0, board: "#8a5a30", icon: "mug", seed: 3 }));
    F(wx + ww - 9, 52, 9, 1, "#3e2a1a");
    if (inn.chim) add(A.smoke({ x: inn.chim[0], y: inn.chim[1], wind: 4, seed: 4 }));
    add(A.glow({ x: wx + 15, y: 60, r: 10, rgb: "255,210,120", a: 0.14, seed: 5 }));
    const bx = jx - 12;
    F(bx, 36, 1, 33, "#4a3020"); F(bx + 1, 36, 1, 33, "#6e4a2c"); F(bx - 3, 36, 9, 1, "#4a3020"); P(bx - 4, 36, "#e8c04a"); P(bx + 6, 36, "#e8c04a"); F(bx, 34, 2, 2, "#e8c04a");
    const GOLD = "#f0c850";
    add(banner({ x: bx - 2, y: 37, w: 6, h: 13, col: "#b83a32", lit: "#d85a48", dark: "#82262a", fork: true, z: 40,
      emblem: [[1, 3, GOLD], [3, 3, GOLD], [5, 3, GOLD], [1, 4, GOLD], [2, 4, GOLD], [3, 4, GOLD], [4, 4, GOLD], [5, 4, GOLD], [1, 5, GOLD], [2, 5, GOLD], [3, 5, GOLD], [4, 5, GOLD], [5, 5, GOLD],
        [3, 4, "#c8302a"], [0, 9, GOLD], [1, 9, GOLD], [2, 9, GOLD], [3, 9, GOLD], [4, 9, GOLD], [5, 9, GOLD], [0, 0, GOLD], [1, 0, GOLD], [2, 0, GOLD], [3, 0, GOLD], [4, 0, GOLD], [5, 0, GOLD]], seed: 1 }));
    F(bx - 1, 68, 4, 1, "#3e2a1a");
    const hx0 = R(W * 0.56);
    for (let x = hx0; x < W + 2; x++) {
      const t = 80 + R(Math.sin(x * 0.45) * 0.8 + Math.sin(x * 0.17 + 1) * 1.2) + (x - hx0 < 7 ? R((7 - (x - hx0)) ** 2 / 7) : 0);
      for (let y = t; y < 91; y++) {
        const v = Math.sin(x * 1.7 + y * 2.3) + Math.sin(x * 0.6 - y * 1.1);
        let c = y - t < 1 ? "#6ea048" : v > 1.1 ? "#5a8e40" : v < -0.9 ? "#2a5228" : "#3e6e32";
        if (y > 86) c = k.mix(c, "#1e3a1e", 0.4);
        o.P(x, y, c);
      }
      o.P(x, t - 1, "#264a24");
      if (k.r() < 0.12) o.P(x, t + k.ri(1, 6), k.pick(["#f4f0e4", "#f4f0e4", "#c8302a"]));
    }
    add(lurker({ x: R(W * 0.76), y: 81, hood: "#7a4a2e", shade: "#4e2e1c", blade: true, period: 14, seed: 2 }));
    if (W > 220) add(lurker({ x: R(W * 0.93), y: 83, hood: "#5e5e52", shade: "#3a3a32", period: 17, seed: 7 }));
    add(caravan({ W, y: 80, stop: wx + ww + 18, period: 46, seed: 1 }));
    add(A.villager({ mode: "cross", x0: 0, x1: W, y: 77, speed: 3.5, gap: 18, look: { hood: "#6a5a44", carry: "#c8a060", shirt: "#7a5a3a" }, seed: 41 }));
    add(A.bird({ W, y: 16, flock: 3, speed: 9, gap: 16, seed: 6 }));
    add(A.shade({ W, y0: 56, y1: 90, speed: 1.4, a: 0.08, seed: 7 }));
    add(A.butterfly({ x: R(W * 0.1), y: 82, w: 40, h: 7, seed: 8 }));
  }

  // ---------- the Salt Cliffs ----------
  function saltcliffs(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const hz = 46, OL = "#2a2a34";
    k.grad(0, hz, ["#3a82cc", "#5a9cda", "#86b8e6", "#b8d6ee", "#e4f0f4"]);
    for (const [x, y, w] of [[0.1, 8, 40], [0.36, 14, 26], [0.56, 5, 34], [0.86, 18, 22]]) {
      const cx = R(W * x);
      F(cx - (w >> 1), y, w, 2, "#ffffff"); F(cx - (w >> 1) + 4, y - 1, w - 12, 1, "#ffffff"); F(cx - (w >> 1) - 3, y + 2, w - 4, 1, "#d8e8f4");
    }
    k.grad(hz, 78, ["#4e94cc", "#3a7ebc", "#2e6aa6", "#245a92"]);
    F(0, hz, W, 1, "#9ccaec");
    for (let y = hz + 1; y < 78; y += 2) for (let x = 0; x < W; x++) if (k.r() < 0.05) F(x, y, k.ri(2, 4), 1, y < 58 ? "#78b4e2" : "#4a8ac4");
    const stack = (x, w, top) => {
      for (let y = top; y < hz + 6; y++) {
        const u = (y - top) / (hz + 6 - top), hw = R(w * (0.55 + u * 0.45));
        F(x - hw, y, hw * 2 + 1, 1, "#c8b894"); F(x - hw, y, 2, 1, "#ece4cc"); F(x + hw - 1, y, 2, 1, "#9a8a6a");
        if ((y - top) % 5 === 2) F(x - hw + 1, y, hw * 2 - 1, 1, "#b4a07c");
      }
      F(x - R(w * 0.55), top - 1, R(w * 1.1) + 1, 1, "#6aa848");
      add(ACT.surf({ pts: [[x, hz + 5]], seed: x }));
    };
    stack(R(W * 0.12), 4, 28); stack(R(W * 0.2), 2, 36);
    const cx0 = R(W * 0.5), top = (x) => 16 + R(Math.sin(x * 0.05) * 2 + Math.sin(x * 0.17) * 1);
    const n = k.noise(91), n2 = k.noise(92), face = [];
    const BAND = ["#e8d8b0", "#d8c49a", "#c8ae80", "#b09468", "#8e7650"];
    for (let x = cx0; x < W; x++) {
      const u = (x - cx0) / 22, t = u < 1 ? R(top(x) + (1 - Math.sin(u * Math.PI / 2)) * 52) : top(x);
      face[x] = t;
      for (let y = t; y < 80; y++) {
        const strata = Math.floor((y + k.fbm(n, x / 14) * 6) / 4) % 5;
        let c = BAND[[1, 2, 1, 3, 2][strata]];
        if (k.fbm(n2, x / 3 + y * 0.05) > 0.7) c = k.mix(c, "#ffffff", 0.22);
        if (x - cx0 < 3 + (y - t) * 0.08) c = BAND[0];
        if (y - t < 2) c = BAND[3];
        if (y > 74) c = k.mix(c, "#5a5048", (y - 74) / 8);
        P(x, y, c);
      }
      F(x, t - 2, 1, 2, "#5aa040"); P(x, t - 2, "#7ac04a"); if (k.r() < 0.3) P(x, t - 3, "#6ab044");
    }
    for (let i = 0; i < W / 18; i++) {
      const x = k.ri(cx0 + 6, W - 2), y0 = (face[x] || 20) + k.ri(4, 40);
      const len = k.ri(3, 10);
      for (let j = 0; j < len; j++) P(x + (j > len - 3 ? 1 : 0), y0 + j, j === 0 ? "#ffffff" : "#f4f2ea");
    }
    const ledges = [];
    for (const [u, y, w] of [[0.62, 34, 18], [0.78, 28, 22], [0.7, 50, 16], [0.9, 44, 20], [0.84, 60, 14]]) {
      const x = R(W * u);
      if (x + w > W + 6 || y < (face[x] || 0) + 3) continue;
      F(x, y, w, 1, "#fbf8ee"); F(x, y + 1, w, 1, "#6e5e44"); F(x + 1, y + 2, w - 2, 1, "#8e7650");
      ledges.push([x, y, w]);
    }
    const ax = R(W * 0.6), ab = 76;
    for (let y = 0; y < 16; y++) {
      const hw = R(6 * Math.sqrt(Math.max(0, 1 - ((15 - y) / 16) ** 2)));
      F(ax - hw, ab - 16 + y, hw * 2 + 1, 1, y < 2 ? "#4a4a50" : "#1e2a36");
      if (y > 9) F(ax - hw + 1, ab - 16 + y, hw * 2 - 1, 1, k.mix("#2e6aa6", "#1e2a36", 0.5));
    }
    const shore = (x) => 74 + R(x * 0.03 + Math.sin(x * 0.11) * 1.5);
    for (let x = 0; x < W; x++) {
      const y = shore(x);
      for (let yy = y; yy < 90; yy++) {
        const v = (x * 7 + yy * 13) % 17;
        P(x, yy, v === 0 ? "#a8987a" : v < 3 ? "#cbbc98" : (x + yy) % 5 === 0 ? "#d2c4a0" : "#ddd0ac");
      }
      P(x, y, "#f0e6c8");
    }
    for (let i = 0; i < W / 5; i++) { const x = k.ri(0, W), y = k.ri(78, 89); F(x, y, 2, 1, k.pick(["#8a8478", "#6e6a64", "#a49c8c"])); P(x, y - 1, "#c8c0b0"); }
    const pools = [[R(W * 0.32), 84, 12], [R(W * 0.68), 86, 9], [R(W * 0.9), 82, 7]];
    for (const [x, y, w] of pools) {
      k.blob(x, y, R(w / 2) + 1, 2, "#7a7068"); k.blob(x, y, R(w / 2), 1, "#4a8aa8"); F(x - (w >> 2), y - 1, R(w / 3), 1, "#8ac8e0");
      for (let i = 0; i < 3; i++) P(x + k.ri(-(w >> 1), w >> 1), y + 2, k.pick(["#3e8a5a", "#c84a5a"]));
    }
    for (let i = 0; i < W / 12; i++) { const x = k.ri(0, W), y = shore(x) + k.ri(1, 4); F(x, y, k.ri(2, 4), 1, k.pick(["#3a6a3a", "#5a7a3a", "#2e5a3e"])); }
    const wx = R(W * 0.18);
    const rib = (x, h, lean) => { for (let j = 0; j < h; j++) { const dx = R(lean * (j / h) ** 2); F(x + dx - 1, 86 - j, 3, 1, OL); F(x + dx, 86 - j, 1, 1, j % 4 === 0 ? "#8a6a48" : "#6a4a30"); } };
    rib(wx - 8, 13, 4); rib(wx - 3, 16, 3); rib(wx + 2, 17, 1); rib(wx + 7, 15, -2); rib(wx + 12, 11, -4);
    F(wx - 10, 85, 26, 3, OL); F(wx - 9, 85, 24, 2, "#6a4a30"); F(wx - 9, 85, 24, 1, "#8a6a48");
    F(wx + 16, 82, 6, 4, OL); F(wx + 17, 83, 4, 3, "#7a5a38"); F(wx + 17, 84, 4, 1, "#5a5a62");
    add(ACT.surf({ pts: [[ax - 10, 77], [R(W * 0.75), 77], [R(W * 0.95), 76]], seed: 3 }));
    add(ACT.shore({ x0: 0, x1: cx0 + 2, line: (x) => shore(x) - 1, seed: 2 }));
    add(A.waves({ x0: 0, x1: cx0 + 4, y: hz + 2, h: 28, n: R(W / 6), col: "#d8f0fc", seed: 4 }));
    add(ACT.sparkle({ x: 0, y: hz + 1, w: cx0, h: 10, n: R(W / 12), seed: 5 }));
    for (const [x, y] of pools) add(ACT.sparkle({ x: x - 3, y: y - 1, w: 6, h: 2, n: 2, seed: x }));
    const GP = { k: "#f4f4f0", g: "#8a96a8", y: "#e8a830", e: "#1a1a20" };
    const sit = A.sprite([".ke", "kky", "gk."], GP, "#6a7280"), flap = A.sprite(["g.ke", ".gky", ".gk."], GP, "#6a7280");
    ledges.forEach(([x, y, w], i) => { for (let j = 0; j < 2; j++) if (w > 10 || j === 0) add(perch({ x: x + 3 + j * (w - 7), y: y - 1, a: sit, b: flap, period: 4 + i + j * 1.3, left: (i + j) % 2 === 0, seed: i * 3 + j })); });
    for (let i = 0; i < 5; i++) add(A.gull({ W, y: k.rnd(6, 36), seed: 30 + i }));
    const SP = { h: "#f0c860", s: "#f0c8a0", t: "#3aa088", d: "#2a7a6a", r: "#7a7e86", l: "#a4a8b0" };
    const sa = A.sprite([".hh....", "hhsh...", ".hss...", "..stt..", "...ttd.", "rrrrrdt", "rlllrr."], SP), sb = A.sprite([".hh.s..", "hhsh...", ".hss...", "..stt..", "...ttd.", "rrrrrdt", "rlllrr."], SP);
    add(perch({ x: R(W * 0.34), y: 60, a: sa, b: sb, period: 2.2, duty: 0.5, seed: 4 }));
    add(ACT.surf({ pts: [[R(W * 0.34), 60]], seed: 9 }));
    const DP = { r: "#c8502e", d: "#8a3020", w: "#e88a4a", y: "#f0d050" };
    add(flyby({ W, y: 12, period: 34, dur: 0.4, wave: 3, left: true, seed: 2, flap: 4,
      frames: [A.sprite(["...ww....", "..rrrr..y", "rrrrrrrr.", ".d..d...."], DP), A.sprite(["........y", "..rrrrrr.", "rrrww....", ".ww.d...."], DP)] }));
    const bx = R(W * 0.8), btop = (face[bx] || 16) - 1;
    F(bx - 3, btop - 1, 7, 1, "#5a3a22"); F(bx, btop - 4, 1, 4, "#5a3a22");
    add({ z: 30, draw(ctx, t) {
      const sw = Math.sin(t * 1.3) * 1.2, len = 22;
      ln(ctx, bx, btop, bx + R(sw), btop + len, "#c8a46a");
      const x = bx + R(sw), y = btop + len;
      rect(ctx, x - 2, y, 5, 4, "#2a1e14"); rect(ctx, x - 1, y + 1, 3, 2, "#b08a50"); rect(ctx, x - 1, y, 3, 1, "#f4f2ea");
    } });
    for (let i = 0; i < 3; i++) add(A.crab({ x: k.rnd(W * 0.05, W * 0.9), y: k.ri(82, 88), range: k.rnd(6, 14), seed: 50 + i }));
    o.F(0, 88, W, 2, "#c8b890");
  }

  // ---------- the Greenwood ----------
  function greenwood(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const BK = ["#9a7a52", "#7a5c3a", "#5a422a", "#3a2a1a"], OL = "#16120c";
    k.grad(0, 44, ["#9ccce4", "#bcdce4", "#d8ead6", "#e8f0d0"]);
    grove(k, 40, "#a4c8b4", "#b8d8c4", null, 6, 9, 9, 11);
    k.F(0, 38, W, 30, "#a4c8b4");
    grove(k, 50, "#7eac8c", "#94c09c", "#6a8e72", 6, 9, 10, 12);
    k.F(0, 48, W, 20, "#7eac8c");
    grove(k, 60, "#558e56", "#6aa462", "#3e5e36", 7, 10, 11, 13);
    k.grad(60, 90, ["#86b44c", "#74a444", "#62943c", "#528236"]);
    for (let i = 0; i < W / 10; i++) {
      const x = k.ri(0, W), y = k.ri(63, 88), rx = k.ri(3, 8);
      k.blob(x, y, rx + 1, 1, "#7aaa48"); k.blob(x, y, rx, 1, "#98c45a"); k.ctx.globalAlpha = 0.6; k.F(x - rx + 2, y, rx * 2 - 3, 1, "#b0d468"); k.ctx.globalAlpha = 1;
    }
    for (let i = 0; i < W / 2; i++) P(k.ri(0, W), k.ri(61, 89), k.pick(["#5e9038", "#4e8030", "#94c056"]));
    const tc = (y) => R(W * 0.5 + (y - 60) * 0.9 + Math.sin(y * 0.3) * 6);
    for (let y = 60; y < 90; y++) {
      const hw = R(1 + (y - 60) * 0.22), c = tc(y);
      for (let x = c - hw; x <= c + hw; x++) P(x, y, (x + y) % 7 === 0 ? "#b89a62" : x === c - hw || x === c + hw ? "#a08254" : "#c8aa70");
    }
    const lx = R(W * 0.22);
    F(lx - 16, 74, 30, 6, OL); F(lx - 15, 75, 28, 4, BK[1]); F(lx - 15, 75, 28, 1, BK[0]); F(lx - 15, 78, 28, 1, BK[2]);
    for (let x = lx - 15; x < lx + 13; x += 4) P(x, 76, BK[3]);
    k.blob(lx + 14, 77, 3, 3, OL); k.blob(lx + 14, 77, 2, 2, "#c8a878"); P(lx + 14, 77, BK[1]); P(lx + 15, 76, BK[2]);
    for (let x = lx - 14; x < lx + 12; x++) if (k.r() < 0.7) { P(x, 74, "#5a9a3a"); if (k.r() < 0.4) P(x, 73, "#7ab84a"); }
    const shroom = (x, y, c) => { F(x, y - 2, 1, 2, "#f0e8d8"); F(x - 1, y - 3, 3, 1, c); P(x, y - 4, c); P(x - 1, y - 3, "#ffffff"); };
    for (let i = 0; i < 3; i++) shroom(lx - 18 + i * 3, 81 + (i % 2), "#d84a3a"); shroom(lx + 18, 82, "#e8b860");
    const fern = (x, y, s) => { for (let j = -s; j <= s; j++) k.line(x, y, x + j * 2, y - s - 1 + Math.abs(j), Math.abs(j) % 2 ? "#4e8a38" : "#6aaa44"); };
    for (let i = 0; i < W / 18; i++) fern(k.ri(0, W), k.ri(66, 88), k.ri(2, 3));
    const trunk = (x0, w, flip) => {
      for (let y = 0; y < 90; y++) {
        const flare = y > 76 ? R(((y - 76) / 14) ** 1.5 * 8) : 0, a = x0 - (flip ? 0 : flare), b = x0 + w + (flip ? flare : 0);
        o.F(a - 1, y, b - a + 2, 1, OL);
        for (let x = a; x < b; x++) { const u = (x - a) / (b - a); o.P(x, y, u < 0.18 ? BK[0] : u < 0.6 ? BK[1] : u < 0.85 ? BK[2] : BK[3]); }
      }
      for (let i = 0; i < w * 3; i++) { const x = x0 + k.ri(1, w - 2), y = k.ri(0, 80), l = k.ri(3, 8); o.F(x, y, 1, l, BK[3]); }
      for (let i = 0; i < 7; i++) o.F(x0 + k.ri(0, w - 3), k.ri(14, 84), k.ri(2, 4), k.ri(1, 3), k.pick(["#5a9a3a", "#4a8a34", "#78b04a"]));
    };
    trunk(-6, 16, false); trunk(W - 12, 18, true);
    for (let x = -6; x < W + 6; x += 5) { const cy = k.ri(-2, 4); o.blob(x, cy, k.ri(5, 8), k.ri(3, 5), "#2a5a2a"); }
    for (let x = -4; x < W + 6; x += 6) { const cy = k.ri(-3, 2); o.blob(x, cy, k.ri(3, 5), k.ri(2, 3), "#3e7a34"); if (k.r() < 0.5) o.P(x - 1, cy - 1, "#6aaa44"); }
    const wx = W - 12, wcx = W - 38, wcy = 34, wr = 16;
    const silk = "rgba(240,244,236,0.55)";
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + 0.2; ln(o.ctx, wcx, wcy, wcx + Math.cos(a) * wr, wcy + Math.sin(a) * wr * 0.9, "#dde4d8"); }
    for (let ring = 3; ring < wr; ring += 3) for (let i = 0; i < 9; i++) {
      const a0 = i / 9 * Math.PI * 2 + 0.2, a1 = (i + 1) / 9 * Math.PI * 2 + 0.2;
      ln(o.ctx, wcx + Math.cos(a0) * ring, wcy + Math.sin(a0) * ring * 0.9, wcx + Math.cos(a1) * ring, wcy + Math.sin(a1) * ring * 0.9, (ring / 3) % 2 ? "#c8d2c4" : "#e8eee4");
    }
    ln(o.ctx, wcx + wr - 2, wcy - 6, wx, wcy - 12, "#dde4d8"); ln(o.ctx, wcx + wr - 1, wcy + 6, wx, wcy + 14, "#dde4d8");
    const SPD = { b: "#2a2420", l: "#4a3a30", r: "#c83a2a", e: "#f05a3a" };
    const spider = A.sprite(["l.l.l.l", ".lbbbl.", "lbbrbbl", ".bbbbb.", "l.beb.l", ".l...l."], SPD);
    add({ z: 1e4, front: true, draw(ctx, t) {
      const drop = 6 + R((0.5 + 0.5 * Math.sin(t * 0.5)) * 18);
      ln(ctx, wcx + 1, wcy, wcx + 1, wcy + drop - 4, silk);
      A.put(ctx, spider, wcx + 1, wcy + drop + R(Math.sin(t * 3) * 0.6));
    } });
    const BP = { b: "#5a3a26", d: "#3a2416", l: "#7a5236", t: "#f0e8d0", k: "#120c08", s: "#c8907a" };
    const boarA = A.sprite(["..dddd....", ".dbbbbdd..", "dbbbbbbbbd", "dlbbbbbbkb", ".b.b..b.ts", ".d.d..d..."], BP);
    const boarB = A.sprite(["..dddd....", ".dbbbbdd..", "dbbbbbbbb.", "dlbbbbbbbd", ".b.b..b.bk", ".d.d..d.ts"], BP);
    add(perch({ x: R(W * 0.38), y: 84, a: boarA, b: boarB, period: 1.4, duty: 0.5, seed: 1 }));
    add(A.quad({ kind: "deer", x0: R(W * 0.62), x1: R(W * 0.72), y: 62, seed: 3 }));
    add(A.rabbit({ x: R(W * 0.12), y: 86, range: 16, seed: 4 }));
    add(ACT.shafts({ y0: 6, y1: 88, slope: 0.3, col: "#fff6c0", list: [[R(W * 0.18), 5, 0.1, 0], [R(W * 0.42), 8, 0.08, 1.3], [R(W * 0.6), 4, 0.1, 2.1]] }));
    add(ACT.leaves({ x: 0, w: W, y0: 8, y1: 90, n: R(W / 20), cols: ["#86c04e", "#c8b040", "#a8d058"], seed: 5 }));
    add(A.butterfly({ x: R(W * 0.45), y: 70, w: 30, h: 10, col: "#f0e070", seed: 6 }));
    add(A.smoke({ x: R(W * 0.3), y: 44, n: 5, rise: 20, life: 6, wind: 3, col: "#c8d0c4", seed: 7 }));
    add(A.bird({ W, y: 22, flock: 2, speed: 8, gap: 20, col: "#2a3a2a", seed: 8 }));
  }

  // ---------- Bleakmarsh ----------
  function bleakmarsh(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const OL = "#141a14", hz = 54;
    k.grad(0, hz, ["#5e6c6e", "#76847e", "#929c8e", "#aab09a", "#bcbea4"]);
    for (const [x, y, w] of [[0.2, 10, 60], [0.65, 18, 80], [0.9, 8, 40]]) { const cx = R(W * x); F(cx - (w >> 1), y, w, 3, "#6a7672"); F(cx - (w >> 1) + 6, y - 2, w - 16, 2, "#727e78"); F(cx - (w >> 1) + 3, y + 3, w - 8, 1, "#828c84"); }
    k.ridge(hz - 2, 4, 30, "#8a9484", 61);
    const dead = (x, g, h, col, ctx) => {
      const L = ctx || k.ctx;
      ln(L, x, g, x, g - h, col); ln(L, x + 1, g, x + 1, g - h + 3, col);
      for (let i = 0; i < 4; i++) { const y = g - h + 3 + i * R(h / 5), s = i % 2 ? 1 : -1, len = R(h * (0.4 - i * 0.06)); ln(L, x, y, x + s * len, y - R(len * 0.6), col); ln(L, x + s * R(len * 0.6), y - R(len * 0.36), x + s * R(len * 0.6), y - R(len * 0.36) - 3, col); }
    };
    for (let i = 0; i < W / 16; i++) dead(k.ri(0, W), hz, k.ri(8, 16), "#7a8476");
    for (let i = 0; i < W / 4; i++) { const x = k.ri(0, W); F(x, hz - k.ri(1, 4), 1, 4, "#6e7a62"); }
    k.grad(hz, 90, ["#5e6a56", "#4a5848", "#3a483c", "#2e3a32"]);
    const refl = k.noise(62);
    for (let y = hz + 1; y < 90; y++) for (let x = 0; x < W; x++) if (k.fbm(refl, x / 6 + y * 0.9) > 0.68 && (y % 2)) P(x, y, "#7a8670");
    const banks = [[0, 0.22, 66], [0.36, 0.58, 72], [0.72, 1.02, 64]];
    for (const [a, b, y0] of banks) {
      const x0 = R(W * a), x1 = R(W * b);
      for (let x = x0; x < x1; x++) {
        const u = (x - x0) / (x1 - x0), t = y0 - R(Math.sin(u * Math.PI) * 4);
        F(x, t, 1, 3 + R(Math.sin(u * Math.PI) * 2), "#5a6a3e"); P(x, t, "#7a8a4a");
        if (k.r() < 0.5) { F(x, t - k.ri(2, 6), 1, k.ri(2, 6), k.pick(["#8a9a52", "#6e7e44", "#a0a058"])); }
      }
    }
    const cat = (x, y, h) => { F(x, y - h, 1, h, "#5a6a3a"); F(x, y - h - 3, 1, 3, "#6a4a2a"); P(x, y - h - 4, "#5a6a3a"); };
    for (let i = 0; i < W / 7; i++) { const x = k.ri(0, W); cat(x, k.ri(76, 90), k.ri(6, 12)); }
    for (let i = 0; i < W / 18; i++) { const x = k.ri(4, W - 4), y = k.ri(70, 88); k.blob(x, y, 2, 1, "#4a7a3a"); P(x + 1, y - 1, "#6a9a4a"); P(x - 1, y, "#2e4a2a"); }
    const bwY = 70;
    for (let x = R(W * 0.18); x < R(W * 0.66); x += 4) {
      if (x % 9 === 0) continue;
      const y = bwY + R(Math.sin(x * 0.07) * 1.5) + (x % 11 === 0 ? 1 : 0);
      F(x - 1, y - 1, 5, 3, OL); F(x, y - 1, 3, 2, "#7a6a4a"); P(x, y - 1, "#9a8a62");
      if (x % 12 < 4) F(x + 1, y + 1, 1, 5, "#4a3a28");
    }
    const tx = R(W * 0.12);
    for (let y = 30; y < 78; y++) { const w = y > 72 ? 5 + R((y - 72) * 0.8) : 4; F(tx - (w >> 1) - 1, y, w + 2, 1, OL); F(tx - (w >> 1), y, w, 1, "#5a5448"); P(tx - (w >> 1), y, "#7a7462"); }
    for (const [dx, dy, s] of [[-14, 34, -1], [12, 40, 1], [-9, 46, -1], [10, 30, 1]]) { ln(k.ctx, tx, dy + 6, tx + dx, dy, OL); ln(k.ctx, tx, dy + 5, tx + dx, dy - 1, "#5a5448"); for (let j = 0; j < 5; j++) { const mx = tx + R(dx * (0.3 + j * 0.15)); F(mx, dy + 3 - j, 1, k.ri(3, 7), "#7a8a5a"); } }
    add(ACT.raven({ x: tx + 9, y: 39, seed: 2 }));
    const lp = R(W * 0.66) + 4;
    F(lp, 56, 1, 16, "#3a2e22"); F(lp, 56, 5, 1, "#3a2e22"); F(lp + 3, 57, 3, 4, OL); P(lp + 4, 58, "#ffd27a"); P(lp + 4, 59, "#f0a040");
    add(A.glow({ x: lp + 4, y: 59, r: 12, rgb: "255,200,110", a: 0.2, amp: 0.15, seed: 11 }));
    for (const [x, y] of [[R(W * 0.42), 86], [R(W * 0.58), 84], [R(W * 0.9), 87]]) { k.blob(x, y, 3, 1, "#3e6a34"); P(x + 2, y, "#2e4a2a"); P(x - 1, y - 1, "#f0e8f0"); P(x, y - 1, "#f8f0e8"); P(x, y - 2, "#f0d860"); }
    const cxw = R(W * 0.82);
    for (let a = 0; a < 20; a++) { const q = Math.PI + a / 20 * Math.PI; P(cxw + R(Math.cos(q) * 5), 82 + R(Math.sin(q) * 5), "#3a2a1a"); }
    k.line(cxw - 4, 79, cxw + 4, 79, "#5a4a32"); k.line(cxw, 77, cxw, 82, "#5a4a32");
    F(cxw + 6, 79, 12, 3, OL); F(cxw + 7, 79, 10, 2, "#5a4a32"); F(cxw + 7, 79, 10, 1, "#7a6a48");
    const th = R(W * 0.5), ty = 78;
    k.blob(th, ty, 9, 4, "#3e4a2e"); k.blob(th - 2, ty - 1, 7, 3, "#4e5e36"); for (let i = 0; i < 9; i++) P(th + k.ri(-8, 8), ty - k.ri(0, 4), k.pick(["#6a7a42", "#2e3a24"]));
    F(th - 9, ty + 1, 19, 1, "#7a8670");
    add(eyes({ pts: [[th - 4, ty - 1]], col: "#e8d040", hot: null, seed: 3 }));
    add(A.bubbles({ x: th - 6, y: ty + 2, w: 12, n: 2, col: "#8a9a7a", seed: 4 }));
    add({ z: 82, draw(ctx, t) {
      const f = frac(t / 19 + 0.4);
      if (f > 0.25) return;
      const up = R(Math.sin(f / 0.25 * Math.PI) * 5), x = R(W * 0.34), y = 86;
      if (up < 1) return;
      rect(ctx, x, y - up, 2, up, "#8a9a7a"); rect(ctx, x - 1, y - up - 2, 1, 2, "#8a9a7a"); rect(ctx, x + 1, y - up - 3, 1, 3, "#8a9a7a"); rect(ctx, x + 2, y - up - 2, 1, 2, "#8a9a7a"); rect(ctx, x + 2, y - up, 1, 1, "#6a7a5a");
      rect(ctx, x - 2, y, 6, 1, "#9aa48a");
    } });
    for (const [x, y, w] of [[R(W * 0.25), 82, 10], [R(W * 0.62), 86, 12]]) add(A.bubbles({ x, y, w, n: 2, col: "#8a9a7a", seed: x }));
    add(A.wisp({ x: R(W * 0.55), y: hz - 6, w: R(W * 0.3), h: 22, seed: 5 }));
    add(A.wisp({ x: R(W * 0.2), y: hz + 2, w: R(W * 0.2), h: 18, seed: 6 }));
    add(A.mist({ W, y: hz + 4, h: 12, rgb: "200,210,196", a: 0.32, speed: 1.2, seed: 7 }));
    add(A.mist({ W, y: 78, h: 10, rgb: "190,200,186", a: 0.22, speed: 0.8, seed: 8 }));
    add(A.fireflies({ x: R(W * 0.66), y: 62, w: 14, h: 8, n: 6, glow: false, col: "#1e241e", seed: 9 }));
    add(A.bird({ W, y: 16, flock: 1, speed: 5, gap: 24, col: "#1e1a1a", seed: 10 }));
  }

  // ---------- Redcrag Hills ----------
  function redcrag(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const OL = "#2a140e", RK = ["#ec9a6a", "#d4764a", "#b45a38", "#8a3e28", "#5e2a1c"];
    k.grad(0, 62, ["#5a96cc", "#7eaed2", "#b2c6c8", "#e0caa0", "#f0b882"]);
    k.cloud(W * 0.3, 10, 24, ["#fff4e4", "#f6e2cc", "#e0c0a0"]); k.cloud(W * 0.78, 6, 30, ["#fff4e4", "#f6e2cc", "#e0c0a0"]);
    const mesa = (x0, x1, top, base, col, lit) => {
      for (let x = x0; x < x1; x++) {
        const u = (x - x0) / (x1 - x0), edge = Math.min(u, 1 - u), t = top + (edge < 0.12 ? R((0.12 - edge) * 60) : 0);
        F(x, t, 1, base - t, col); if (edge >= 0.12) P(x, t, lit);
        for (let y = t + 3; y < base; y += 4) if ((x + (y >> 2)) % 7) P(x, y, k.mix(col, "#7a4a3a", 0.12));
        if (edge < 0.12) F(x, t, 1, base - t, k.mix(col, "#7a4a3a", 0.1));
      }
    };
    mesa(R(W * 0.05), R(W * 0.32), 34, 56, "#d0a08e", "#e4bca8"); mesa(R(W * 0.55), R(W * 0.95), 30, 56, "#c8968a", "#dcb0a0");
    k.ridge(58, 6, 26, "#c88466", 72, "#dca080");
    k.grad(60, 90, ["#c47a4e", "#b46a42", "#a45c3a", "#8e4e32"]);
    const n = k.noise(75);
    for (let y = 61; y < 90; y++) for (let x = 0; x < W; x++) { const v = k.fbm(n, x / 7 + y * 0.4); if (v > 0.66 && k.on(x, y, 0.55)) P(x, y, "#d08a5a"); else if (v < 0.3 && k.on(x, y, 0.4)) P(x, y, "#8a4a30"); }
    for (let i = 0; i < W / 3; i++) { const x = k.ri(0, W), y = k.ri(62, 89); P(x, y, k.pick(["#d8b45a", "#c8a04a", "#e8c870"])); if (k.r() < 0.5) P(x + 1, y - 1, "#e8c870"); }
    const crag = (cx, base, h, w, sd) => {
      const rr = Art.rng(sd), pts = [], cols = [];
      for (let x = cx - w; x <= cx + w; x += 2 + Math.floor(rr() * 3)) cols.push([x, rr()]);
      const colAt = (x) => { let c = cols[0]; for (const q of cols) if (q[0] <= x) c = q; return c; };
      for (let x = cx - w; x <= cx + w; x++) {
        const u = Math.abs(x - cx) / w, [c0, v] = colAt(x), edge = x === c0;
        const t = R(base - h * (1 - u ** 1.8) * (0.62 + 0.38 * v));
        pts.push([x, t]);
        const side = x < cx - w * 0.2 ? 1 : x < cx + w * 0.35 ? 2 : 3;
        F(x, t, 1, base - t, RK[side]);
        P(x, t, side === 1 ? RK[0] : RK[side - 1]);
        if (edge) F(x, t + 1, 1, base - t - 1, RK[Math.min(4, side + 1)]);
        else if (side === 1 && (x - c0) === 1) F(x, t + 1, 1, base - t - 2, RK[0]);
        for (let y = t + 3; y < base; y += 5) if (((x + y) >> 1) % 3) P(x, y + ((x >> 2) % 2), RK[Math.min(4, side + 1)]);
      }
      for (let i = 0; i < w; i++) { const x = cx + Math.floor((rr() - 0.5) * w * 2.4); F(x, base - 1, 2, 1, RK[3]); P(x, base - 2, RK[1]); }
      F(cx - w - 1, base, w * 2 + 3, 1, RK[4]);
      return pts;
    };
    const big = R(W * 0.66);
    const bp = crag(big, 74, 52, 20, 76);
    crag(R(W * 0.16), 70, 26, 13, 77); crag(R(W * 0.88), 78, 30, 12, 78); crag(R(W * 0.4), 72, 18, 9, 79);
    const peak = bp.reduce((a, b) => (b[1] < a[1] ? b : a));
    const sx = big - 8;
    for (let i = 0; i < 6; i++) P(sx + k.ri(-3, 3), 52 + k.ri(-4, 6), k.pick(["#f4f0e0", "#e8d070", "#c8c8d0"]));
    add(ACT.sparkle({ x: sx - 4, y: 48, w: 8, h: 10, n: 4, col: "#fff8d0", seed: 3 }));
    const DK = { r: "#c84a2a", d: "#8a2e1c", w: "#e8784a", y: "#f4d24a", k: "#2a1410", h: "#f0e0c0" };
    const furled = A.sprite(["...........hh", "..........rry", ".....ww..rrr.", "....wwwwrrr..", "..rrrrrrrrr..", "rrr..dd..dd.."], DK);
    const spread = A.sprite(["..w..........", "..ww.......hh", "...www....rry", "....wwww.rrr.", ".....wwwrrr..", "..rrrrrrrrr..", "rrr..dd..dd.."], DK);
    add(perch({ x: peak[0], y: peak[1], a: furled, b: spread, period: 9, duty: 0.22, seed: 2 }));
    const hole = [R(W * 0.3), 82];
    k.blob(hole[0], hole[1], 4, 2, OL); k.blob(hole[0], hole[1] + 1, 3, 1, "#1a0c08");
    for (let dx = -7; dx <= 7; dx++) { const hh = R(3 * Math.sqrt(Math.max(0, 1 - (dx / 7.5) ** 2))); o.F(hole[0] + dx, hole[1] + 3 - hh, 1, hh + 2, "#a45c3a"); o.P(hole[0] + dx, hole[1] + 3 - hh, "#d08a5a"); if (dx > 2) o.P(hole[0] + dx, hole[1] + 4 - hh, "#8a4a30"); }
    for (const dx of [-5, -2, 4]) o.P(hole[0] + dx, hole[1] + 4, "#e0a070");
    add(lurker({ x: hole[0], y: hole[1] + 2, kind: "kobold", period: 9, seed: 5 }));
    const cx2 = R(W * 0.08);
    F(cx2 - 1, 80, 12, 6, OL); F(cx2, 81, 10, 4, "#7a5230"); F(cx2, 81, 10, 1, "#9a6a40");
    for (const wx of [cx2 + 2, cx2 + 8]) { k.blob(wx, 86, 2, 2, OL); P(wx, 86, "#9a6a40"); }
    k.line(cx2 + 11, 80, cx2 + 15, 74, "#6a4a2a"); k.line(cx2 + 13, 74, cx2 + 17, 76, "#9a9aa4");
    for (let i = 0; i < 3; i++) { F(cx2 + 2 + i * 3, 79, 2, 2, k.pick(["#8a8a92", "#b8b8c0", "#c8a050"])); }
    const bush = (x, y) => { for (let j = -3; j <= 3; j++) k.line(x, y, x + j, y - 3 - (j % 2 ? 0 : 1), j % 2 ? "#7a8a3a" : "#5a6a2e"); };
    for (let i = 0; i < W / 16; i++) bush(k.ri(0, W), k.ri(64, 88));
    add({ z: 88, draw(ctx, t) {
      const f = frac(t / 22 + 0.1);
      if (f > 0.55) return;
      const x = R(W * 0.2 + f / 0.55 * W * 0.5), g = 86;
      for (let i = 0; i < 14; i++) {
        const h = i / 14, a = t * 7 + i * 1.3, r = 1 + h * 4;
        ctx.globalAlpha = 0.45 * (1 - h * 0.6) * Math.sin(Math.min(1, f / 0.55) * Math.PI);
        rect(ctx, x + Math.cos(a) * r, g - h * 14, 1, 1, i % 3 ? "#e8b888" : "#c88a5a");
      }
      ctx.globalAlpha = 1;
    } });
    add(A.quad({ kind: "goat", x0: R(W * 0.44), x1: R(W * 0.52), y: 76, seed: 6 }));
    add(A.eagle({ x: R(W * 0.4), y: 18, r: 20, seed: 7 }));
    add(A.shade({ W, y0: 58, y1: 90, speed: 1.6, a: 0.08, seed: 8 }));
  }

  // ---------- Whitepeak Pass ----------
  function whitepeak(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const SN = ["#ffffff", "#eaf0f8", "#ccd8ea", "#a4b4cc", "#7a8cac"], RK = ["#7a8494", "#5a6474", "#3e4656"], OL = "#1e2432";
    k.grad(0, 60, ["#5a8ac4", "#7aa2d0", "#a0bede", "#c8daec", "#e6eef6"]);
    range(k, { peaks: [[R(W * 0.14), 24, 1.0, 0.8], [R(W * 0.3), 30, 0.9, 1.1], [R(W * 0.84), 22, 0.8, 0.9], [R(W * 0.97), 30, 1, 1]], base: 62, lit: "#d4e0ee", shade: "#9cb0ca", rim: "#ffffff", rock: "#7a8ca8", rockLit: "#b0c0d6", seed: 81 });
    const main = range(k, { peaks: [[R(W * 0.54), 6, 0.95, 0.85], [R(W * 0.42), 24, 0.8, 1.2], [R(W * 0.68), 26, 1.3, 0.9]], base: 64, lit: SN[1], shade: "#a8bad4", rim: "#ffffff", rock: RK[1], rockLit: "#8e9aaa", jag: 3.2, seed: 83 });
    add(ACT.plume({ x: R(W * 0.54) + 2, y: 8, n: 8, rise: 4, life: 3, wind: 26, cols: ["#ffffff", "#f4f8ff", "#e6eef8", "#d8e4f2", "#ccdaec"], seed: 2 }));
    k.grad(60, 90, [SN[1], SN[2], SN[1], SN[0]]);
    for (let i = 0; i < W / 6; i++) { const x = k.ri(0, W), y = k.ri(62, 89); F(x, y, k.ri(3, 9), 1, SN[3]); F(x + 1, y - 1, k.ri(2, 6), 1, SN[0]); }
    for (let x = k.ri(0, 6); x < W; x += k.ri(3, 11)) k.pine(x, 64 + k.ri(-1, 2), k.ri(4, 8), ["#24384a", "#30485a", "#3e5a6a"], true);
    const trail = (x) => 74 + R(Math.sin(x * 0.04) * 3);
    for (let x = 0; x < W; x++) { const y = trail(x); F(x, y, 1, 3, "#d4dcea"); P(x, y - 1, SN[3]); P(x, y + 3, SN[0]); if (x % 5 === 0) P(x, y + 1, "#b8c4d8"); }
    const gx = R(W * 0.36), gt = 52;
    for (const s of [-1, 1]) {
      const px = gx + s * 11;
      F(px - 3, gt, 7, 22, OL); k.stones(px - 2, gt + 1, 5, 21, ["#b8c0cc", "#9aa2b0", "#7a8494", "#5a6474"], 3);
      F(px - 3, gt - 1, 7, 2, SN[0]);
    }
    F(gx - 15, gt - 4, 31, 5, OL); k.stones(gx - 14, gt - 3, 29, 3, ["#b8c0cc", "#9aa2b0", "#7a8494", "#5a6474"], 3);
    F(gx - 15, gt - 6, 31, 2, SN[0]); F(gx - 13, gt - 7, 26, 1, SN[1]);
    const FL = ["#d84a3a", "#f0c040", "#3a8ac8", "#5aa04a", "#f4f0e4"];
    const flags = (x0, y0, x1, y1, n, sd) => ({ z: 40, draw(ctx, t) {
      for (let i = 0; i <= 24; i++) { const u = i / 24; rect(ctx, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * 4, 1, 1, "#5a4a3a"); }
      for (let i = 1; i < n; i++) {
        const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * 4, dx = R(Math.sin(t * 5 + i * 1.7 + sd) * 1);
        rect(ctx, x + dx, y + 1, 2, 3, FL[(i + sd) % FL.length]);
      }
    } });
    add(flags(gx - 13, gt - 3, R(W * 0.06), 58, 9, 0));
    add(flags(gx + 13, gt - 3, R(W * 0.66), 66, 11, 2));
    F(R(W * 0.06), 56, 1, 18, "#5a4a3a"); F(R(W * 0.66), 64, 1, 12, "#5a4a3a");
    const cairn = (x, g) => { k.blob(x, g - 1, 3, 1, RK[1]); k.blob(x, g - 3, 2, 1, RK[0]); P(x, g - 5, RK[0]); F(x - 2, g - 4, 4, 1, SN[0]); P(x, g - 6, SN[0]); };
    cairn(R(W * 0.2), 75); cairn(R(W * 0.58), 76); if (W > 220) cairn(R(W * 0.92), 73);
    const rx = R(W * 0.8);
    k.blob(rx, 86, 14, 6, OL); k.blob(rx, 86, 13, 5, RK[1]); k.blob(rx - 3, 85, 9, 4, RK[0]); k.blob(rx - 2, 81, 10, 2, SN[0]); F(rx - 11, 83, 22, 1, SN[1]);
    for (let i = 0; i < 5; i++) P(rx + k.ri(-10, 10), 86 + k.ri(-2, 2), RK[2]);
    for (let i = 0; i < 14; i++) { const x = R(W * 0.28) + i * 5, y = trail(x) + 1 + (i % 2); P(x, y, SN[4]); P(x + 1, y, SN[4]); }
    const YP = { w: "#f4f6fa", g: "#c4ccd8", k: "#4a5a7a", f: "#9aa8bc" };
    const yeti = [A.sprite(["..www..", ".wkkkw.", ".wkkkw.", "wwwwwww", "wgwwwgw", "wgwwwgw", "g.www.g", "..w.w..", "..w.w..", "..f.f.."], YP, "#4a5870"), A.sprite(["..www..", ".wkkkw.", ".wkkkw.", "wwwwwww", "wgwwwgw", ".gwwwg.", ".gwwwg.", "...ww..", "..ww...", "..ff..."], YP, "#4a5870")];
    add({ z: -10, draw(ctx, t) {
      const f = frac(t / 40), x0 = R(W * 0.66), x1 = R(W * 0.95);
      const u = f < 0.5 ? f * 2 : 2 - f * 2, x = x0 + (x1 - x0) * u;
      const y = (main[R(x)] || 40) + 14;
      A.put(ctx, yeti[Math.floor(t * 2.5) % 2], x, y, f >= 0.5);
    } });
    add(A.wisp({ x: R(W * 0.1), y: 66, w: R(W * 0.2), h: 14, rgb: "200,230,255", col: "#e8f6ff", seed: 3 }));
    add(A.snow({ W, H: 90, n: R(W / 3), speed: 8, wind: 6, seed: 4 }));
    add(A.mist({ W, y: 60, h: 8, rgb: "240,246,255", a: 0.4, speed: 7, seed: 5 }));
    add(A.mist({ W, y: 84, h: 6, rgb: "255,255,255", a: 0.35, speed: 9, seed: 6 }));
    o.F(0, 89, W, 1, SN[2]);
  }

  // ---------- the Wolf Den ----------
  function wolf_den(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const OL = "#0c100e", BK = ["#6a5a46", "#4e4234", "#3a3026", "#241e18"];
    k.grad(0, 58, ["#16202e", "#1e2c3c", "#34404a", "#6a6252", "#b07a48"]);
    const stars = [];
    for (let i = 0; i < W / 6; i++) { const x = k.ri(0, W), y = k.ri(0, 24); P(x, y, k.r() < 0.4 ? "#e8e4d0" : "#8a92a0"); if (k.r() < 0.3) stars.push([x, y]); }
    add(A.twinkle({ pts: stars, col: "#ffffff", arm: "#9aa4b8", seed: 1 }));
    const mx = R(W * 0.82), my = 14;
    add(A.glow({ x: mx, y: my, r: 18, rgb: "255,236,190", a: 0.12, amp: 0.05, seed: 2 }));
    k.blob(mx, my, 6, 6, "#f4ecd0"); k.blob(mx + 1, my - 1, 4, 4, "#fff8e4"); P(mx - 2, my + 2, "#d8ceb0"); P(mx + 2, my + 3, "#d8ceb0"); P(mx - 3, my - 1, "#e0d8bc");
    for (let x = 0; x < W; x += 3) k.pine(x + k.ri(0, 2), 56 + k.ri(-2, 1), k.ri(10, 16), ["#1a2a2c", "#22343a", "#2a4044"]);
    k.F(0, 56, W, 6, "#1a2a2c");
    for (let x = 1; x < W; x += 4) k.pine(x + k.ri(0, 2), 64 + k.ri(-1, 2), k.ri(12, 20), ["#0e1a18", "#14241e", "#1a2e26"]);
    k.grad(62, 90, ["#1e2a20", "#24301e", "#2a341e", "#222a18"]);
    for (let i = 0; i < W; i++) P(k.ri(0, W), k.ri(64, 89), k.pick(["#3a4428", "#1a2216", "#4a4a2e"]));
    const rx = R(W * 0.66), hy = 84, lx0 = R(W * 0.04);
    const root = (L, x0, y0, ang, len, th, bend) => {
      let x = x0, y = y0, a = ang;
      for (let s2 = 0; s2 < len; s2++) {
        const r = Math.max(0.6, th * (1 - s2 / len));
        L.blob(R(x), R(y), R(r) + 1, R(r) + 1, OL);
        x += Math.cos(a); y += Math.sin(a); a += bend;
      }
      x = x0; y = y0; a = ang;
      for (let s2 = 0; s2 < len; s2++) {
        const r = Math.max(0.6, th * (1 - s2 / len));
        L.blob(R(x), R(y), R(r), R(r), BK[2]); if (r >= 1) L.P(R(x), R(y - r), BK[0]); if (r >= 2) L.P(R(x - 1), R(y - r + 1), BK[1]);
        x += Math.cos(a); y += Math.sin(a); a += bend;
      }
    };
    for (let y = 0; y < 18; y++) {
      const hw = R(14 * Math.sqrt(Math.max(0, 1 - ((17 - y) / 18) ** 2)));
      F(rx + 4 - hw, hy - 18 + y, hw * 2 + 1, 1, y < 3 ? "#1a140e" : "#06080a");
    }
    const pcx = rx + 6, pcy = 52, prx = 14, pry = 21, n2 = noise2d(17);
    for (let a = 0; a < 46; a++) {
      const q = a / 46 * Math.PI * 2;
      if (q > Math.PI * 0.3 && q < Math.PI * 0.72) continue;
      let x = pcx + Math.cos(q) * prx, y = pcy + Math.sin(q) * pry, dir = q + (k.r() - 0.5) * 0.5;
      const len = k.ri(4, 11), thick = a % 5 === 0;
      for (let j = 0; j < len; j++) {
        P(x, y, j < len * 0.5 ? "#3a2e22" : "#2a2018"); if (thick && j < len * 0.6) P(x + 1, y, "#4a3c2c");
        x += Math.cos(dir); y += Math.sin(dir); dir += (k.r() - 0.5) * 0.5 + 0.04;
      }
    }
    k.blob(pcx, pcy, prx + 1, pry + 1, "#1e1812");
    for (let y = pcy - pry; y <= pcy + pry; y++) for (let x = pcx - prx; x <= pcx + prx; x++) {
      const dx = (x - pcx) / prx, dy = (y - pcy) / pry, d = dx * dx + dy * dy;
      if (d > 1) continue;
      const v = n2(x / 4, y / 4), lit = dx + dy < -0.3;
      let c = v > 0.6 ? (lit ? "#6a5640" : "#4e3e2e") : v < 0.38 ? "#2a2018" : (lit ? "#54442f" : "#3a2e22");
      if (d > 0.82) c = "#2a2018";
      P(x, y, c);
    }
    for (let i = 0; i < 9; i++) { const q = k.r() * Math.PI * 2, d = k.r() * 0.75; const x = R(pcx + Math.cos(q) * prx * d), y = R(pcy + Math.sin(q) * pry * d); F(x, y, 2, 2, "#7a7468"); P(x, y, "#a09a8e"); }
    for (let i = 0; i < 7; i++) { const q = k.r() * Math.PI * 2, d = k.r() * 0.7; const x = R(pcx + Math.cos(q) * prx * d), y = R(pcy + Math.sin(q) * pry * d); k.line(x, y, x + k.ri(-4, 4), y + k.ri(-4, 4), "#6a5640"); }
    for (let y = 0; y < 15; y++) {
      const hw = R(10 * Math.sqrt(Math.max(0, 1 - ((14 - y) / 15) ** 2)));
      F(rx + 5 - hw, hy - 15 + y, hw * 2 + 1, 1, "#06080a");
    }
    add(eyes({ pts: [[rx - 1, hy - 8], [rx + 7, hy - 10], [rx + 9, hy - 4], [rx + 2, hy - 4]], col: "#f0d040", hot: null, glow: "255,210,80", seed: 4 }));
    for (let x = lx0; x <= rx; x++) {
      const u = (x - lx0) / (rx - lx0), th = R(5 + u * 13), bot = R(78 - u * 6), top = bot - th;
      F(x, top - 1, 1, th + 2, OL);
      for (let y = top; y < bot; y++) { const v = (y - top) / th; P(x, y, v < 0.15 ? BK[0] : v < 0.55 ? BK[1] : v < 0.85 ? BK[2] : BK[3]); }
      if ((x * 7) % 11 < 2 && th > 6) F(x, top + 2, 1, th - 4, BK[3]);
      if (k.r() < 0.55) { P(x, top - 1, "#3e5a2e"); if (k.r() < 0.4) P(x, top - 2, "#4e6e34"); }
    }
    for (let y = 58; y < 74; y++) P(rx, y, BK[3]);
    for (let i = 0; i < 12; i++) { const x = rx - 6 + i * 2 + k.ri(0, 1), y0 = 66 + R(Math.abs(i - 6) * 0.5); k.line(x, y0, x + k.ri(-1, 1), y0 + k.ri(3, 7), i % 2 ? "#4a3a2a" : "#3a2e22"); }
    root(k, rx - 2, 68, 1.85, 12, 3, 0.02); root(k, rx + 16, 68, 1.25, 12, 3, 0.03);
    const bone = (x, y) => { F(x, y, 4, 1, "#e8e0cc"); P(x - 1, y - 1, "#e8e0cc"); P(x - 1, y + 1, "#e8e0cc"); P(x + 4, y - 1, "#e8e0cc"); P(x + 4, y + 1, "#e8e0cc"); };
    bone(rx - 22, 86); bone(rx + 14, 85); bone(rx - 4, 88);
    const skull = (x, y) => { k.blob(x, y, 3, 2, OL); k.blob(x, y, 2, 2, "#e8e0cc"); F(x - 1, y, 1, 1, "#1a1410"); F(x + 1, y, 1, 1, "#1a1410"); F(x - 3, y - 3, 1, 2, "#c8c0a8"); F(x + 3, y - 3, 1, 2, "#c8c0a8"); P(x - 4, y - 3, "#c8c0a8"); P(x + 4, y - 3, "#c8c0a8"); };
    skull(rx + 22, 84);
    const fx = R(W * 0.88);
    for (const [x, h, lean] of [[fx - 8, 10, 0], [fx, 9, 2], [fx + 8, 6, 4]]) { k.line(x, 84, x + lean, 84 - h, "#5a4a36"); k.line(x + 1, 84, x + 1 + lean, 84 - h, "#3a3026"); }
    k.line(fx - 8, 78, fx, 79, "#6a5a42"); k.line(fx, 80, fx + 3, 83, "#6a5a42");
    k.blob(fx - 3, 78, 2, 1, "#e8e2d4"); P(fx - 5, 79, "#d8d0c0");
    const WP = { b: "#4a4a54", l: "#7a7a86", k: "#0e0e12", e: "#f0d040" };
    const sitA = A.sprite(["......bb", ".....bbbk", "....bbe..", "...bbb...", "..bbbbb..", ".lbbbbb..", "bblbblb.."], WP);
    const howl = A.sprite([".......b.", "......bbk", ".....bbb.", "....bbb..", "...bbbb..", "..bbbbb..", ".lbbbbb..", "bblbblb.."], WP);
    add(perch({ x: R(W * 0.4), y: R(78 - ((R(W * 0.4) - lx0) / (rx - lx0)) * 6 - 5 - ((R(W * 0.4) - lx0) / (rx - lx0)) * 13) - 1, a: sitA, b: howl, period: 12, duty: 0.25, seed: 3 }));
    add(A.quad({ kind: "wolf", x0: R(W * 0.4), x1: R(W * 0.5), y: 87, period: 9, seed: 5 }));
    add(ACT.raven({ x: rx + 7, y: 33, seed: 6 }));
    add(A.fireflies({ x: 0, y: 60, w: W, h: 20, n: R(W / 30), rgb: "200,255,150", col: "#e8ffb0", blink: 0.5, seed: 7 }));
    add(A.mist({ W, y: 76, h: 10, rgb: "120,140,140", a: 0.25, speed: 1, seed: 8 }));
    add(A.bat({ W, y0: 20, y1: 44, speed: 16, gap: 10, rim: "#3a4448", seed: 9 }));
    for (let x = -2; x < W + 2; x += 5) o.blob(x, 92, k.ri(3, 5), 4, "#0a120e");
  }

  // ---------- the Collapsed Mine ----------
  function collapsed_mine(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const OL = "#1a1614", RK = ["#a8a098", "#8a8278", "#6e665e", "#524a44", "#3a3430"], WD = ["#a07a4e", "#7e5a36", "#5a3e24"];
    k.grad(0, 76, ["#6a7e94", "#8294a6", "#a0acb4", "#bcc0bc", "#cac6b8"]);
    k.cloud(W * 0.25, 10, 40, ["#e4e6e8", "#d0d4d8", "#a8b0b8"]); k.cloud(W * 0.7, 6, 50, ["#e4e6e8", "#d0d4d8", "#a8b0b8"]);
    range(k, { peaks: [[R(W * 0.14), 34, 0.8, 0.7], [R(W * 0.3), 40, 0.7, 0.9], [R(W * 0.5), 28, 0.6, 0.8], [R(W * 0.7), 38, 0.9, 0.7], [R(W * 0.88), 30, 0.7, 0.6]], base: 90, lit: "#9aa6ae", shade: "#808c98", rim: "#b4bec4", jag: 4, seed: 41 });
    const hillTop = (x) => R(40 + Math.abs(x - W * 0.6) * 0.18 + Math.sin(x * 0.09) * 2);
    const n2 = noise2d(42);
    for (let x = 0; x < W; x++) {
      const t = hillTop(x);
      for (let y = t; y < 90; y++) {
        const v = n2(x / 6, y / 3.5);
        P(x, y, y - t < 1 ? "#7a8a52" : y - t < 3 ? "#6a7a46" : v > 0.64 ? RK[1] : v < 0.36 ? RK[3] : RK[2]);
      }
      if (k.r() < 0.4) P(x, t - 1, "#8a9a5a");
    }
    for (let i = 0; i < W / 3; i++) { const x = k.ri(0, W), y = k.ri(hillTop(x) + 4, 89); F(x, y, 2, 1, RK[0]); P(x, y + 1, RK[4]); }
    const ex = R(W * 0.56), eg = 74, ew = 24, eh = 22;
    F(ex - ew / 2 - 3, eg - eh - 4, ew + 6, eh + 4, "#2a2622");
    F(ex - ew / 2, eg - eh, ew, eh, "#0a0a0c");
    const web = (cx, cy, r, sx, sy) => { for (let i = 0; i < 5; i++) { const q = i / 4 * Math.PI / 2; ln(k.ctx, cx, cy, cx + sx * Math.cos(q) * r, cy + sy * Math.sin(q) * r, "#8a8a90"); } for (let ring = 3; ring < r; ring += 3) for (let i = 0; i < 4; i++) { const a0 = i / 4 * Math.PI / 2, a1 = (i + 1) / 4 * Math.PI / 2; ln(k.ctx, cx + sx * Math.cos(a0) * ring, cy + sy * Math.sin(a0) * ring, cx + sx * Math.cos(a1) * ring, cy + sy * Math.sin(a1) * ring, "#6a6a70"); } };
    web(ex - ew / 2, eg - eh, 9, 1, 1); web(ex + ew / 2 - 1, eg - eh, 7, -1, 1);
    add(eyes({ pts: [[ex - 3, eg - 12], [ex - 2, eg - 10], [ex + 1, eg - 11]], col: "#e83a2a", hot: null, glow: "255,60,40", seed: 3 }));
    for (const px of [ex - ew / 2 - 2, ex + ew / 2]) { F(px - 1, eg - eh - 1, 4, eh + 1, OL); F(px, eg - eh, 2, eh, WD[1]); F(px, eg - eh, 1, eh, WD[0]); }
    k.line(ex - ew / 2 - 3, eg - eh - 2, ex + 2, eg - eh + 3, OL); k.line(ex + 2, eg - eh + 3, ex + ew / 2 + 2, eg - eh - 3, OL);
    k.line(ex - ew / 2 - 3, eg - eh - 3, ex + 1, eg - eh + 2, WD[0]); k.line(ex - ew / 2 - 3, eg - eh - 1, ex + 1, eg - eh + 4, WD[2]);
    k.line(ex + 3, eg - eh + 2, ex + ew / 2 + 2, eg - eh - 4, WD[0]); k.line(ex + 3, eg - eh + 4, ex + ew / 2 + 2, eg - eh - 2, WD[2]);
    P(ex + 2, eg - eh + 2, "#d8c098"); P(ex + 1, eg - eh + 5, "#d8c098");
    const boulder = (x, y, r) => { k.blob(x, y, r + 1, r, OL); k.blob(x, y, r, r - 1, RK[2]); k.blob(x - 1, y - 1, r - 1, r - 2, RK[1]); P(x - R(r / 2), y - R(r / 2), RK[0]); };
    boulder(ex + 6, eg - 3, 5); boulder(ex + 1, eg - 2, 4); boulder(ex + 9, eg - 9, 4); boulder(ex - 3, eg - 1, 3); boulder(ex + 4, eg - 12, 3);
    for (const [bx, by] of [[ex - 8, eg - 9], [ex - 12, eg - 12]]) { F(bx - 1, by - 1, 15, 4, OL); F(bx, by, 13, 2, WD[0]); F(bx, by + 1, 13, 1, WD[2]); P(bx + 1, by, "#3a3a40"); P(bx + 11, by, "#3a3a40"); }
    k.line(ex - 12, eg - 13, ex + 2, eg - 7, OL); k.line(ex - 12, eg - 7, ex + 2, eg - 13, OL);
    const SG = ex - ew / 2 - 16;
    F(SG, eg - 14, 11, 7, OL); F(SG + 1, eg - 13, 9, 5, "#c8a46a"); F(SG + 1, eg - 13, 9, 1, "#e0c088"); for (let i = 0; i < 3; i++) F(SG + 2 + i * 3, eg - 11, 2, 1, "#8a2a20"); P(SG + 4, eg - 10, "#8a2a20"); F(SG + 4, eg - 7, 1, 7, WD[2]);
    const hx = R(W * 0.26), hg = hillTop(hx) + 2;
    for (const [a, b] of [[-9, -3], [9, 3]]) { k.line(hx + a, hg, hx + b, hg - 28, OL); k.line(hx + a + (a < 0 ? 1 : -1), hg, hx + b + (a < 0 ? 1 : -1), hg - 28, WD[1]); }
    for (let y = hg - 6; y > hg - 26; y -= 6) { const hw = 3 + R((y - hg + 28) * 0.22); F(hx - hw, y, hw * 2 + 1, 1, WD[2]); k.line(hx - hw, y, hx + hw, y - 5, WD[2]); }
    F(hx - 5, hg - 30, 11, 2, OL); F(hx - 4, hg - 30, 9, 1, WD[0]);
    add(ACT.wheel({ x: hx, y: hg - 34, r: 5, speed: 0.25, seed: 1 }));
    F(hx - 1, hg - 34, 3, 5, WD[2]);
    ln(k.ctx, hx + 5, hg - 34, ex - 6, eg - eh - 2, "#4a4440");
    const track = (x) => eg + R((ex - x) * 0.12);
    for (let x = 0; x < ex - 8; x++) { const y = track(x); if (x % 4 === 0) F(x, y - 1, 1, 3, WD[2]); P(x, y - 1, "#7a7a82"); P(x, y + 1, "#7a7a82"); }
    const cx = R(W * 0.32), cy = track(cx);
    F(cx - 6, cy - 9, 11, 7, OL); F(cx - 5, cy - 8, 9, 5, "#5a5a62"); F(cx - 5, cy - 8, 9, 1, "#8a8a92"); F(cx - 5, cy - 4, 9, 1, "#3a3a40");
    k.blob(cx + 5, cy - 2, 2, 2, OL); P(cx + 5, cy - 2, "#8a8a92"); k.blob(cx - 2, cy - 1, 2, 2, OL); P(cx - 2, cy - 1, "#8a8a92");
    for (let i = 0; i < 9; i++) { const x = cx - 14 + k.ri(0, 9), y = cy - k.ri(0, 3); P(x, y, k.pick(["#e8ecf0", "#b8c0c8", "#6a6a72", "#8a8278"])); }
    add(ACT.sparkle({ x: cx - 14, y: cy - 4, w: 10, h: 4, n: 3, col: "#ffffff", seed: 4 }));
    for (const [tx, w] of [[R(W * 0.82), 26], [R(W * 0.95), 18]]) {
      for (let i = 0; i <= w; i++) {
        const u = (i - w / 2) / (w / 2), h = R((1 - u * u) * w * 0.3), x = R(tx - w / 2 + i);
        if (h < 1) continue;
        F(x, 84 - h, 1, h, u < -0.2 ? RK[1] : u < 0.4 ? RK[2] : RK[3]); P(x, 84 - h, u < 0.2 ? RK[0] : RK[1]);
        for (let y = 85 - h; y < 84; y++) if (k.on(x, y, 0.2)) P(x, y, RK[4]);
      }
      F(tx - w / 2 - 1, 84, w + 3, 1, RK[4]);
    }
    add(ACT.plume({ x: ex - 4, y: eg - eh + 4, n: 5, rise: 10, life: 3.5, wind: -3, cols: ["#8a8278", "#a09a90", "#b8b2a8", "#c8c4bc", "#d8d4cc"], seed: 6 }));
    add({ z: 100, draw(ctx, t) {
      for (let i = 0; i < 3; i++) {
        const f = frac(t / 3.7 + i * 0.37);
        if (f > 0.3) continue;
        rect(ctx, ex - 10 + i * 9, eg - eh - 6 + R(f / 0.3 * (eh + 2)), 1, 1, i % 2 ? RK[1] : RK[0]);
      }
    } });
    add(A.bat({ W, y0: eg - 30, y1: eg - 18, speed: 20, gap: 12, rim: "#4a4440", seed: 7 }));
    add(A.bird({ W, y: 14, flock: 2, speed: 7, gap: 18, col: "#3a3a44", seed: 8 }));
    add(A.mist({ W, y: 58, h: 8, rgb: "200,206,210", a: 0.25, speed: 2, seed: 9 }));
  }

  // ---------- Cragtooth Warren ----------
  function cragtooth_warren(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const OL = "#24140c", RK = ["#e0a874", "#c48656", "#a0683e", "#7a4c2c", "#4e301c"];
    k.grad(0, 64, ["#4a86c4", "#6c9ece", "#9cbcd0", "#d4d0b0", "#ecc690"]);
    k.cloud(W * 0.15, 8, 26, ["#fff4e4", "#f6e2cc", "#e0c0a0"]); k.cloud(W * 0.62, 12, 20, ["#fff4e4", "#f6e2cc", "#e0c0a0"]);
    k.ridge(52, 6, 30, "#b8a49a", 51, "#cab6aa");
    const hill = (x) => R(36 + ((x - W * 0.5) / (W * 0.5)) ** 2 * 18 + Math.sin(x * 0.11) * 2);
    const n = k.noise(52), n2 = noise2d(52);
    for (let x = 0; x < W; x++) {
      const t = hill(x);
      for (let y = t; y < 90; y++) {
        const v = n2(x / 7, y / 4);
        let c = v > 0.64 ? RK[1] : v < 0.34 ? RK[3] : RK[2];
        if ((y + R(k.fbm(n, x / 11) * 5)) % 6 === 0) c = RK[3];
        if (y - t < 2) c = "#a0a050";
        if (y > 80) c = k.mix(c, "#7a5a3a", 0.3);
        P(x, y, c);
      }
      if (k.r() < 0.5) P(x, t - 1, "#b8b060");
    }
    const tooth = (x, h, w, lean) => {
      const base = hill(x) + 2;
      for (let j = 0; j < h; j++) {
        const u = j / h, hw = Math.max(0, R(w * (1 - u) ** 0.8)), cx = x + R(lean * u * u);
        F(cx - hw - 1, base - j, hw * 2 + 3, 1, OL);
        F(cx - hw, base - j, hw * 2 + 1, 1, RK[2]); F(cx - hw, base - j, Math.max(1, hw), 1, RK[1]); P(cx - hw, base - j, RK[0]);
        if (j % 4 === 1) P(cx + hw - 1, base - j, RK[4]);
      }
      P(x + R(lean), base - h, OL);
    };
    for (const [u, h, w, lean] of [[0.12, 22, 4, -2], [0.2, 14, 3, 1], [0.44, 26, 5, 1], [0.52, 18, 3, -2], [0.8, 24, 4, 2], [0.9, 15, 3, -1]]) tooth(R(W * u), h, w, lean);
    const holes = [[0.16, 58], [0.3, 64], [0.42, 54], [0.58, 66], [0.7, 56], [0.86, 62], [0.24, 76], [0.66, 78]].map(([u, y]) => [R(W * u), y]).filter(([x]) => x > 6 && x < W - 6);
    const hole = (x, y) => {
      k.blob(x, y, 5, 3, OL); k.blob(x, y + 1, 4, 2, "#0c0806");
      F(x - 6, y - 3, 1, 6, "#6a4a2a"); F(x + 6, y - 3, 1, 6, "#6a4a2a"); F(x - 6, y - 4, 13, 1, "#8a6a40");
      o.F(x - 5, y + 2, 11, 2, RK[2]); o.F(x - 5, y + 2, 11, 1, RK[1]); o.P(x - 6, y + 3, RK[3]); o.P(x + 5, y + 3, RK[3]);
    };
    holes.forEach(([x, y]) => hole(x, y));
    for (let i = 0; i < holes.length - 1; i += 2) { const [x0, y0] = holes[i], [x1, y1] = holes[i + 1]; if (Math.abs(x1 - x0) < W * 0.25) add(ACT.rope({ x0: x0 + 6, y0: y0 - 3, x1: x1 - 6, y1: y1 - 3, sag: 3, seed: i })); }
    holes.forEach(([x, y], i) => { if (i % 3 === 0) { F(x + 7, y - 6, 1, 4, "#3a2a1a"); add(A.torch({ x: x + 7, y: y - 7, r: 8, seed: x })); } });
    holes.forEach(([x, y], i) => add(lurker({ x, y: y + 2, kind: "kobold", skin: i % 2 ? "#c8603a" : "#b8542e", period: 6 + (i * 1.7) % 5, seed: i * 2 + 1 })));
    const MC = ["#c8903e", "#9a6a2a", "#6a4418"];
    const mx = R(W * 0.5), my = 86;
    const lidShut = A.sprite(["kgggggggk", "gbbbbbbbg", "gbbbybbbg", "kgggggggk", "gbbbbbbbg", "gbbbbbbbg", "kgggggggk"], { g: MC[2], b: MC[0], y: "#f0d040", k: OL });
    const lidOpen = A.sprite(["gbbbbbbbg", "kgggggggk", "tttttttt.", ".........", "w.w.w.w.w", "krrrrrrrk", "gbbbbbbbg", "kgggggggk"].map((r) => r.slice(0, 9)), { g: MC[2], b: MC[0], t: "#f4f0e0", w: "#f4f0e0", r: "#c83a3a", k: OL });
    add(perch({ x: mx, y: my, a: lidShut, b: lidOpen, period: 7, duty: 0.12, seed: 3 }));
    add(ACT.sparkle({ x: mx - 6, y: my - 8, w: 12, h: 4, n: 2, col: "#fff4b0", seed: 5 }));
    const sx = R(W * 0.34);
    F(sx, 74, 1, 12, "#5a3e24"); F(sx - 6, 72, 13, 7, OL); F(sx - 5, 73, 11, 5, "#c8a46a"); F(sx - 5, 73, 11, 1, "#e0c088");
    F(sx - 3, 75, 5, 2, "#8a5a2a"); F(sx - 3, 75, 5, 1, "#b07a3a"); P(sx - 1, 76, "#f0d040"); k.line(sx + 3, 76, sx + 5, 76, "#8a2a20"); P(sx + 4, 75, "#8a2a20"); P(sx + 4, 77, "#8a2a20");
    for (let i = 0; i < 6; i++) P(R(W * 0.5) + k.ri(-14, 14), k.ri(84, 89), "#f0d040");
    add(ACT.sparkle({ x: R(W * 0.5) - 14, y: 83, w: 28, h: 5, n: 3, col: "#fff8c0", seed: 6 }));
    const bone = (x, y) => { F(x, y, 3, 1, "#ece4d0"); P(x - 1, y - 1, "#ece4d0"); P(x + 3, y + 1, "#ece4d0"); };
    bone(R(W * 0.1), 86); bone(R(W * 0.78), 87); bone(R(W * 0.92), 84);
    k.line(R(W * 0.06), 88, R(W * 0.06) + 4, 82, "#6a4a2a"); k.line(R(W * 0.06) + 2, 82, R(W * 0.06) + 6, 84, "#9a9aa4");
    add(A.eagle({ x: R(W * 0.7), y: 16, r: 18, seed: 7 }));
    add(A.bat({ W, y0: 30, y1: 46, speed: 14, gap: 16, rim: "#5a3a2a", seed: 8 }));
  }

  // ---------- the Ashveil Crypts ----------
  function ashveil_crypts(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const OL = "#121614", ST = ["#b4b4a8", "#94968c", "#74786e", "#545850", "#383c36"], hz = 60;
    k.grad(0, hz, ["#1e2828", "#2a3634", "#3e4a44", "#6a6a56", "#a8906a"]);
    for (const [x, y, w] of [[0.15, 14, 50], [0.6, 8, 70], [0.88, 20, 40]]) { const cx = R(W * x); F(cx - (w >> 1), y, w, 2, "#3a4642"); F(cx - (w >> 1) + 5, y - 1, w - 14, 1, "#46524c"); F(cx - (w >> 1) + 2, y + 2, w - 6, 1, "#4e5a52"); }
    k.ridge(hz - 2, 3, 30, "#4a524a", 31);
    for (let i = 0; i < W / 10; i++) { const x = k.ri(0, W), h = k.ri(4, 9); F(x, hz - h, 1, h, "#525a50"); k.line(x, hz - h + 2, x - 2, hz - h, "#525a50"); k.line(x, hz - h + 3, x + 3, hz - h + 1, "#525a50"); }
    k.grad(hz, 90, ["#3e4842", "#323c38", "#28322e", "#1e2624"]);
    for (let y = hz + 1; y < 90; y += 2) for (let x = 0; x < W; x++) if (k.r() < 0.05) F(x, y, k.ri(2, 5), 1, "#4a5650");
    const mx = R(W * 0.55), mg = 72, mw = 46;
    F(mx - mw / 2 - 4, mg, mw + 8, 3, OL); k.stones(mx - mw / 2 - 3, mg, mw + 6, 2, [ST[1], ST[2], ST[3], ST[4]], 2);
    F(mx - mw / 2 - 1, mg - 2, mw + 2, 2, ST[2]); F(mx - mw / 2 - 1, mg - 2, mw + 2, 1, ST[1]);
    F(mx - mw / 2, mg - 24, mw, 22, OL); k.stones(mx - mw / 2 + 1, mg - 23, mw - 2, 21, [ST[1], ST[2], ST[3], ST[4]], 3);
    const cols = [-18, -10, 8, 16];
    for (const c of cols) { F(mx + c - 1, mg - 24, 5, 22, OL); F(mx + c, mg - 23, 3, 21, ST[1]); F(mx + c, mg - 23, 1, 21, ST[0]); F(mx + c + 2, mg - 23, 1, 21, ST[3]); F(mx + c - 1, mg - 25, 5, 2, ST[1]); F(mx + c - 1, mg - 3, 5, 1, ST[2]); }
    F(mx - 5, mg - 18, 10, 16, OL); F(mx - 4, mg - 17, 8, 15, "#0e1410"); F(mx - 4, mg - 17, 3, 15, "#3a3020"); F(mx - 4, mg - 17, 3, 1, "#5a4a30"); P(mx - 2, mg - 10, "#c8a050");
    add(A.glow({ x: mx + 1, y: mg - 9, r: 16, rgb: "120,255,150", a: 0.22, amp: 0.3, speed: 0.6, seed: 1 }));
    F(mx - mw / 2 - 3, mg - 27, mw + 6, 3, OL); F(mx - mw / 2 - 2, mg - 26, mw + 4, 2, ST[1]); F(mx - mw / 2 - 2, mg - 26, mw + 4, 1, ST[0]);
    for (let i = 0; i < 10; i++) { const ins = R((mw / 2 + 3) * (i / 10)), y = mg - 28 - i; if (i === 6) continue; F(mx - mw / 2 - 3 + ins, y, mw + 6 - ins * 2, 1, i === 9 ? OL : ST[i % 3 === 0 ? 2 : 1]); P(mx - mw / 2 - 3 + ins, y, OL); P(mx + mw / 2 + 2 - ins, y, OL); }
    k.line(mx + 2, mg - 37, mx + 6, mg - 30, OL); k.line(mx + 6, mg - 30, mx + 4, mg - 27, OL);
    k.blob(mx, mg - 32, 2, 2, ST[3]); P(mx - 1, mg - 32, OL); P(mx + 1, mg - 32, OL);
    for (let i = 0; i < 14; i++) P(mx - mw / 2 + k.ri(0, mw), mg - k.ri(3, 26), k.pick(["#4a6a3a", "#5a7a42", "#3a5a32"]));
    for (let i = 0; i < 4; i++) { const x = mx - mw / 2 + 4 + i * 12; F(x, mg - 27, 1, k.ri(4, 9), "#4a6a3a"); }
    const grave = (x, g, tilt, kind) => {
      if (kind === 0) { for (let j = 0; j < 8; j++) { const dx = R(tilt * j / 8); F(x + dx - 1, g - j, 6, 1, OL); F(x + dx, g - j, 4, 1, j > 5 ? ST[1] : ST[2]); P(x + dx, g - j, ST[0]); } F(x + R(tilt) , g - 9, 4, 1, OL); }
      else if (kind === 1) { F(x - 1, g - 9, 3, 10, OL); F(x, g - 8, 1, 9, ST[1]); F(x - 3, g - 6, 7, 3, OL); F(x - 2, g - 5, 5, 1, ST[1]); }
      else { F(x - 2, g - 14, 5, 15, OL); F(x - 1, g - 13, 3, 14, ST[2]); F(x - 1, g - 13, 1, 14, ST[1]); P(x, g - 15, OL); }
    };
    for (const [u, g, tilt, kind] of [[0.1, 78, 2, 0], [0.18, 74, -1, 1], [0.27, 80, 0, 2], [0.8, 76, 2, 1], [0.88, 82, -2, 0], [0.95, 74, 0, 2], [0.36, 86, 1, 0]]) grave(R(W * u), g, tilt, kind);
    for (let x = R(W * 0.68); x < R(W * 0.8); x += 3) { const lean = x > W * 0.75 ? 3 : 0; k.line(x, 80, x + lean, 72, "#2a2e2c"); P(x + lean, 71, "#5a5e5a"); }
    k.line(R(W * 0.68), 74, R(W * 0.75), 74, "#2a2e2c");
    const src = k.ctx.getImageData(mx - mw / 2 - 4, mg - 30, mw + 8, 30);
    for (let j = 0; j < 14; j++) for (let i = 0; i < mw + 8; i++) {
      if ((j + i) % 2 && j > 6) continue;
      const q = ((29 - j * 2) * (mw + 8) + i) * 4, d = src.data;
      if (d[q + 3] < 10) continue;
      P(mx - mw / 2 - 4 + i + (j % 3 === 1 ? 1 : 0), mg + 4 + j, Art.mix("#" + [d[q], d[q + 1], d[q + 2]].map((v) => v.toString(16).padStart(2, "0")).join(""), "#26302c", 0.55 + j * 0.02));
    }
    const tx = R(W * 0.06);
    for (let y = 36; y < 82; y++) { const w = y > 76 ? 4 + R((y - 76) * 0.8) : 3; F(tx - 1, y, w + 2, 1, OL); F(tx, y, w, 1, "#4a4a42"); }
    for (const [dx, y] of [[14, 40], [16, 50], [12, 58]]) { k.line(tx + 2, y + 6, tx + dx, y, OL); for (let j = 0; j < 6; j++) { const x = tx + 2 + R((dx - 2) * j / 6); F(x, y + 4 - R(j * 0.8), 1, k.ri(4, 9), "#5a6a4a"); } }
    add(ACT.raven({ x: tx + 13, y: 46, seed: 2 }));
    add(ACT.raven({ x: mx - 2, y: mg - 38, seed: 5 }));
    add(A.skeleton({ x0: mx - 14, x1: mx + 14, y: mg + 1, seed: 3 }));
    add({ z: 84, draw(ctx, t) {
      const f = frac(t / 14 + 0.2);
      if (f > 0.3) return;
      const up = R(Math.sin(f / 0.3 * Math.PI) * 6), x = R(W * 0.27) + 5, y = 84;
      if (up < 1) return;
      rect(ctx, x, y - up, 1, up, "#e8e4d4"); rect(ctx, x - 1, y - up - 2, 1, 2, "#e8e4d4"); rect(ctx, x + 1, y - up - 3, 1, 3, "#e8e4d4"); rect(ctx, x + 2, y - up - 2, 1, 2, "#e8e4d4");
      rect(ctx, x - 2, y, 6, 1, "#4a5650");
    } });
    for (let i = 0; i < 3; i++) add(A.wisp({ x: k.rnd(0, W * 0.8), y: hz - 4 + i * 6, w: R(W * 0.18), h: 14, rgb: "150,255,170", col: "#d0ffd8", seed: 6 + i }));
    add(A.mist({ W, y: hz + 3, h: 12, rgb: "170,190,180", a: 0.35, speed: 1.4, seed: 10 }));
    add(A.mist({ W, y: 82, h: 8, rgb: "150,170,160", a: 0.3, speed: 0.9, seed: 11 }));
    add(A.bubbles({ x: R(W * 0.4), y: 84, w: 10, n: 2, col: "#6a7a70", seed: 12 }));
    add(A.bat({ W, y0: 12, y1: 30, speed: 16, gap: 14, rim: "#3a4440", seed: 13 }));
  }

  // ---------- Thornmere Ruins ----------
  function thornmere_ruins(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const OL = "#0e1416", ST = ["#a8b0a0", "#8a9286", "#6a746a", "#4e564e"], TH = ["#6a3a2a", "#4a2a1e", "#2e1a12"], hz = 58;
    k.grad(0, hz, ["#122230", "#1a3040", "#284650", "#3e605e", "#6a8a76"]);
    const stars = [];
    for (let i = 0; i < W / 7; i++) { const x = k.ri(0, W), y = k.ri(0, 26); P(x, y, "#9ab8c0"); if (k.r() < 0.3) stars.push([x, y]); }
    add(A.twinkle({ pts: stars, col: "#e8f8ff", arm: "#7a98a8", seed: 1 }));
    k.ridge(hz - 1, 4, 24, "#2a4440", 81, "#34504a");
    for (let i = 0; i < W / 12; i++) { const x = k.ri(0, W); k.blob(x, hz - 4, k.ri(3, 6), k.ri(2, 4), "#24403a"); }
    const hut = R(W * 0.86);
    for (const lx of [-5, 0, 5]) F(hut + lx, hz - 4, 1, 6, "#1a2a28");
    F(hut - 7, hz - 12, 15, 8, "#1e2e2c"); k.tri(hut - 9, hz - 19, 19, 8, "#16241e"); F(hut + 2, hz - 9, 2, 2, "#e8c060");
    add(A.glow({ x: hut + 3, y: hz - 8, r: 8, rgb: "255,200,100", a: 0.2, seed: 2 }));
    add(A.smoke({ x: hut - 4, y: hz - 18, n: 4, rise: 12, wind: -3, col: "#4a5e5a", seed: 3 }));
    k.grad(hz, 90, ["#2e4a48", "#26403e", "#1e3434", "#162a2a"]);
    for (let y = hz + 1; y < 90; y += 2) for (let x = 0; x < W; x++) if (k.r() < 0.04) F(x, y, k.ri(2, 5), 1, "#3e5e5a");
    const tx = R(W * 0.5), tg = 70;
    for (let i = 0; i < 7; i++) {
      const ox = (i - 3) * 8, h = 22 - Math.abs(i - 3) * 2, lean = i === 0 ? -2 : i === 6 ? 3 : 0;
      for (let j = 0; j < h; j++) { const dx = R(lean * j / h); F(tx + ox + dx - 1, tg - j, 5, 1, OL); F(tx + ox + dx, tg - j, 3, 1, j % 6 === 5 ? ST[2] : ST[1]); P(tx + ox + dx, tg - j, ST[0]); P(tx + ox + dx + 2, tg - j, ST[3]); }
      if (i !== 1 && i !== 5) F(tx + ox + R(lean) - 2, tg - h - 1, 7, 2, ST[1]);
    }
    F(tx - 26, tg - 23, 52, 3, OL); F(tx - 25, tg - 22, 50, 1, ST[1]); F(tx - 25, tg - 21, 50, 1, ST[2]);
    for (let a = 0; a <= 40; a++) { const q = Math.PI + a / 40 * Math.PI, x = tx + R(Math.cos(q) * 20), y = tg - 23 + R(Math.sin(q) * 13); F(x, y, 1, tg - 23 - y, a > 26 && a < 31 ? "#0e1416" : a % 6 === 0 ? ST[2] : ST[1]); P(x, y, a < 20 ? ST[0] : ST[3]); }
    F(tx - 1, tg - 40, 3, 4, ST[1]); P(tx, tg - 42, ST[0]);
    F(tx - 4, tg - 12, 8, 12, "#0a1012");
    add(A.glow({ x: tx, y: tg - 6, r: 14, rgb: "120,230,200", a: 0.2, amp: 0.4, speed: 0.5, seed: 4 }));
    F(0, tg, W, 1, "#4e6e68");
    for (let x = tx - 30; x < tx + 30; x++) if ((x * 7) % 5 < 3) P(x, tg + 2 + ((x * 3) % 4), k.mix(ST[2], "#1e3434", 0.5));
    const vine = (L, pts, thick) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        L.line(x0, y0 + 1, x1, y1 + 1, OL); L.line(x0, y0, x1, y1, TH[1]); if (thick) L.line(x0, y0 - 1, x1, y1 - 1, TH[0]);
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let s = 2; s < n; s += 3) { const x = R(x0 + (x1 - x0) * s / n), y = R(y0 + (y1 - y0) * s / n); L.P(x + (s % 2 ? 1 : -1), y - 1 - (s % 2), TH[2]); L.P(x + (s % 2 ? 1 : -1), y + 2 - (s % 2) * 3, "#c8b4a0"); }
      }
    };
    vine(k, [[tx - 24, tg], [tx - 26, tg - 10], [tx - 20, tg - 22], [tx - 8, tg - 30], [tx + 4, tg - 34]], false);
    vine(k, [[tx + 25, tg], [tx + 22, tg - 14], [tx + 14, tg - 26]], false);
    vine(o, [[-4, 80], [R(W * 0.1), 72], [R(W * 0.18), 78], [R(W * 0.26), 88], [R(W * 0.3), 92]], true);
    vine(o, [[W + 4, 74], [R(W * 0.9), 70], [R(W * 0.8), 80], [R(W * 0.74), 92]], true);
    for (const [x, y] of [[R(W * 0.1), 71], [R(W * 0.89), 69]]) { o.blob(x, y, 2, 1, "#c84a6a"); o.P(x, y, "#f0a0b8"); }
    for (let i = 0; i < W / 10; i++) { const x = k.ri(0, W), y = k.ri(72, 89); k.blob(x, y, 2, 1, "#3a6a3a"); P(x + 1, y - 1, "#5a8a4a"); if (k.r() < 0.25) P(x, y, "#f0ece0"); }
    for (let i = 0; i < W / 8; i++) { const x = k.ri(0, W); if (Math.abs(x - tx) < 28) continue; F(x, k.ri(64, 74), 1, k.ri(4, 9), k.pick(["#4a6a3e", "#5a7a44"])); }
    const procession = { z: 1e3, draw(ctx, t) {
      for (let i = 0; i < 5; i++) {
        const f = frac(t / 16 + i / 5), x = R(W * 0.08) + (tx - R(W * 0.08)) * f, y = 82 - f * 14 + Math.sin(t * 2 + i) * 1.5;
        const a = f < 0.1 ? f / 0.1 : f > 0.85 ? (1 - f) / 0.15 : 1;
        A.light(ctx, x, y, 7, "150,240,210", 0.4 * a);
        ctx.globalAlpha = a; rect(ctx, x, y, 1, 1, "#e8fff4"); ctx.globalAlpha = 1;
      }
    } };
    add(procession);
    add(A.wisp({ x: R(W * 0.62), y: hz + 4, w: R(W * 0.2), h: 16, rgb: "150,240,210", col: "#e0fff4", seed: 5 }));
    const FR = { g: "#4a8a3a", d: "#2e5a28", y: "#e8e070", t: "#a8d070" };
    const frogA = A.sprite(["y.y.", "ggg.", "dggd"], FR), frogB = A.sprite(["y.y.", "gggt", "dggd"], FR);
    for (const [u, y] of [[0.22, 84], [0.72, 86]]) add(perch({ x: R(W * u), y, a: frogA, b: frogB, period: 2.4, duty: 0.3, seed: y }));
    add(A.mist({ W, y: tg - 2, h: 12, rgb: "150,190,180", a: 0.3, speed: 1, seed: 6 }));
    add(A.fireflies({ x: R(W * 0.3), y: 60, w: R(W * 0.4), h: 14, n: 6, rgb: "180,255,200", col: "#e0ffe8", blink: 0.6, seed: 7 }));
    add(A.bubbles({ x: tx - 10, y: tg + 6, w: 20, n: 2, col: "#5a8a80", seed: 8 }));
  }

  // ---------- Frostspire ----------
  function frostspire(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const SN = ["#ffffff", "#eaf2fa", "#ccdcee", "#a8bcd8"], IC = ["#f4fcff", "#c4ecfa", "#8ccce8", "#58a0d0", "#3a74ac", "#24508a"];
    k.grad(0, 72, ["#3e72b4", "#5a8cc6", "#86acd6", "#b4cce4", "#e2ecf6"]);
    const sx = R(W * 0.18), sy = 14;
    for (let a = 0; a < 90; a++) { const q = a / 90 * Math.PI * 2; if (Math.sin(q) > 0.6) continue; P(sx + R(Math.cos(q) * 13), sy + R(Math.sin(q) * 13), "#d8e8f6"); }
    k.blob(sx, sy, 3, 3, "#fffbe8"); P(sx - 4, sy, "#f0f6ff"); P(sx + 4, sy, "#f0f6ff"); P(sx, sy - 4, "#f0f6ff");
    add(A.glow({ x: sx, y: sy, r: 14, rgb: "255,250,230", a: 0.25, amp: 0.04, seed: 1 }));
    range(k, { peaks: [[R(W * 0.06), 38, 0.9, 1.2], [R(W * 0.22), 44, 1.1, 0.9], [R(W * 0.34), 30, 1, 1.1], [R(W * 0.82), 40, 1.2, 0.9], [R(W * 0.96), 32, 0.9, 0.8]], base: 70, lit: "#dce6f2", shade: "#a8b8d0", rim: "#ffffff", rock: "#7a8aa8", rockLit: "#b8c6da", jag: 4, seed: 61 });
    const ridge = range(k, { peaks: [[R(W * 0.62), 50, 0.35, 0.4]], base: 70, lit: SN[1], shade: SN[3], rim: "#ffffff", rock: "#8a9cba", rockLit: "#c0cee2", jag: 1.5, seed: 62 });
    k.grad(66, 90, [SN[2], SN[1], SN[0]]);
    for (let i = 0; i < W / 6; i++) { const x = k.ri(0, W), y = k.ri(70, 89); F(x, y, k.ri(3, 9), 1, SN[3]); F(x + 1, y - 1, k.ri(2, 6), 1, SN[0]); }
    const tx = R(W * 0.62), base = (ridge[tx] || 50) + 2;
    const shard = (x, w, h, lean, shade) => {
      const top = base - h;
      for (let y = top; y < base; y++) {
        const d = y - top, u = d / h, hw = d < w * 1.6 ? Math.floor(d / 1.6) : w, cx = x + R(lean * (1 - u));
        for (let i = -hw; i <= hw; i++) {
          const c = i < 0 ? (i === -hw ? IC[0] : IC[1 + shade]) : i === 0 ? IC[0] : i === hw ? IC[4 + shade] : IC[3 + shade];
          P(cx + i, y, c);
        }
        P(cx - hw - 1, y, IC[5]); P(cx + hw + 1, y, IC[5]);
      }
      P(x + R(lean), top - 1, IC[5]);
      for (let j = 0; j < 2; j++) { const y = top + R(h * (0.3 + j * 0.3)); k.line(x + R(lean * 0.6) - 1, y, x + R(lean * 0.6) + 1, y + 3, IC[0]); }
    };
    shard(tx - 13, 3, 20, -6, 1); shard(tx + 13, 3, 24, 7, 1); shard(tx - 7, 4, 38, -3, 0); shard(tx + 7, 4, 44, 3, 0); shard(tx, 6, 60, 0, 0);
    shard(tx - 18, 2, 10, -5, 1); shard(tx + 19, 2, 12, 5, 1);
    F(tx - 20, base - 1, 41, 2, SN[0]); F(tx - 18, base + 1, 37, 1, SN[1]);
    add(A.glow({ x: tx, y: base - 30, r: 34, rgb: "160,220,255", a: 0.12, amp: 0.25, speed: 0.4, seed: 2 }));
    add(ACT.sparkle({ x: tx - 14, y: base - 70, w: 28, h: 68, n: 10, col: "#ffffff", seed: 3 }));
    for (let i = 0; i < 7; i++) { const x = R(W * 0.14) + i * R(W * 0.065), y = 87 - i * 2 - (i % 2); F(x - 2, y, 5, 1, SN[3]); F(x - 1, y + 1, 3, 1, SN[3]); P(x - 2, y - 1, SN[3]); P(x + 2, y - 1, SN[3]); }
    const shardAt = (x, g, h, lean) => { for (let j = 0; j < h; j++) { const hw = j > h - 3 ? 0 : 1, cx = x + R(lean * j / h); P(cx - hw, g - j, IC[1]); P(cx, g - j, IC[0]); if (hw) P(cx + 1, g - j, IC[3]); } };
    const sh = R(W * 0.3);
    F(sh - 3, 80, 7, 6, "#3a4a6a"); F(sh - 2, 81, 5, 4, "#7a8aa8"); F(sh - 2, 81, 5, 1, "#a8b4c8"); P(sh, 83, "#c84a3a"); F(sh - 4, 84, 9, 2, SN[0]);
    k.line(sh + 6, 86, sh + 9, 74, "#5a4a3a"); F(sh + 9, 74, 5, 3, "#a83a32"); P(sh + 13, 75, "#a83a32"); F(sh + 5, 85, 6, 1, SN[0]);
    for (let i = 0; i < W / 10; i++) { const x = k.ri(0, W), y = k.ri(76, 88), w = k.ri(6, 14); F(x, y, w, 1, "#ffffff"); F(x + 1, y + 1, w - 2, 1, SN[3]); }
    shardAt(R(W * 0.08), 86, 9, -3); shardAt(R(W * 0.1), 86, 6, 2); shardAt(R(W * 0.92), 85, 11, 3); shardAt(R(W * 0.95), 86, 7, -2); shardAt(R(W * 0.89), 86, 5, -3);
    const wraith = { z: 50, draw(ctx, t) {
      const a = t * 0.5, x = tx + Math.cos(a) * 24, y = base - 28 + Math.sin(a * 2) * 6, front = Math.sin(a) > 0;
      ctx.globalAlpha = front ? 0.75 : 0.35;
      A.light(ctx, x, y, 8, "190,230,255", 0.3);
      rect(ctx, x - 2, y - 4, 5, 4, "#e8f6ff"); rect(ctx, x - 1, y - 5, 3, 1, "#e8f6ff"); rect(ctx, x - 1, y - 3, 1, 1, "#2a4a7a"); rect(ctx, x + 1, y - 3, 1, 1, "#2a4a7a");
      for (let i = 0; i < 6; i++) rect(ctx, x - 2 + (i % 5) - R(Math.cos(a) * i * 0.4), y + i, 1, 1, i < 3 ? "#d0ecfa" : "#a8d4f0");
      ctx.globalAlpha = 1;
    } };
    add(wraith);
    add(A.snow({ W, H: 90, n: R(W / 4), speed: 6, wind: 5, col: "#ffffff", seed: 4 }));
    add(A.mist({ W, y: base - 2, h: 8, rgb: "240,248,255", a: 0.4, speed: 6, seed: 5 }));
    add(ACT.plume({ x: tx, y: base - 70, n: 6, rise: 3, life: 3, wind: 22, cols: ["#ffffff", "#f4faff", "#e8f2fa", "#dce8f4", "#d0e0f0"], seed: 6 }));
    add(A.eagle({ x: R(W * 0.3), y: 24, r: 16, seed: 7 }));
  }

  // ---------- the Sunken Vault ----------
  function sunken_vault(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const OL = "#101820", ST = ["#d8d0b8", "#b8b098", "#968e78", "#6e685a", "#4a463e"], hz = 46;
    k.grad(0, hz, ["#24405e", "#36587a", "#5a7c94", "#94a8ac", "#d4c49c"]);
    for (const [x, y, w] of [[0.2, 10, 50], [0.55, 16, 70], [0.85, 6, 40]]) { const cx = R(W * x); F(cx - (w >> 1), y, w, 3, "#4a6680"); F(cx - (w >> 1) + 6, y - 2, w - 18, 2, "#567290"); F(cx - (w >> 1) + 2, y + 3, w - 6, 1, "#7a90a0"); }
    k.grad(hz, 90, ["#4a7890", "#3a6680", "#2e5670", "#244862"]);
    F(0, hz, W, 1, "#c8c8b0");
    for (let y = hz + 1; y < 90; y += 2) for (let x = 0; x < W; x++) if (k.r() < 0.05) F(x, y, k.ri(2, 4), 1, y < 60 ? "#7aa0b0" : "#4a7a94");
    const flat = (x) => 74 + R(Math.sin(x * 0.05) * 2);
    for (let x = 0; x < W; x++) { const y = flat(x); for (let yy = y; yy < 90; yy++) P(x, yy, (x * 5 + yy * 3) % 13 === 0 ? "#7a7458" : yy < y + 2 ? "#a49c7c" : (x + yy) % 4 === 0 ? "#8e866a" : "#968e70"); P(x, y, "#c8c0a0"); }
    for (let i = 0; i < W / 14; i++) { const x = k.ri(0, W), y = k.ri(78, 88), w = k.ri(6, 16); F(x, y, w, 1, "#6e98a4"); F(x + 2, y, R(w / 3), 1, "#a8ccd4"); }
    const vx = R(W * 0.42), vg = 68, vw = 56;
    const tilt = (x) => R((x - vx) * 0.08);
    for (let x = vx - vw / 2; x < vx + vw / 2; x++) {
      const t = vg - 28 + tilt(x);
      F(x, t, 1, vg + 6 - t, x === vx - vw / 2 || x === vx + vw / 2 - 1 ? OL : (x * 3) % 7 === 0 ? ST[3] : ST[2]);
    }
    for (let i = 0; i < 6; i++) {
      const cx = vx - vw / 2 + 5 + i * 9, t = vg - 28 + tilt(cx);
      F(cx - 1, t, 5, vg + 6 - t, OL); F(cx, t + 1, 3, vg + 5 - t, ST[1]); F(cx, t + 1, 1, vg + 5 - t, ST[0]); F(cx + 2, t + 1, 1, vg + 5 - t, ST[3]);
      F(cx - 2, t - 1, 7, 2, ST[1]);
    }
    for (let i = 0; i < 12; i++) { const ins = R(i * 2.4), x0 = vx - vw / 2 - 2 + ins, x1 = vx + vw / 2 + 1 - ins; for (let x = x0; x <= x1; x++) P(x, vg - 30 - i + tilt(x), i === 11 || x === x0 || x === x1 ? OL : i % 4 === 0 ? ST[2] : ST[1]); }
    k.blob(vx, vg - 36 + tilt(vx), 3, 2, "#c8a040"); P(vx, vg - 36 + tilt(vx), "#f0d060");
    const dx0 = vx - 7;
    F(dx0 - 1, vg - 21 + tilt(dx0), 16, 25, OL);
    for (let x = dx0; x < dx0 + 14; x++) { const t = vg - 20 + tilt(x); F(x, t, 1, 24, x < dx0 + 7 ? "#4a8a72" : "#3a7a64"); if ((x - dx0) % 7 === 0 || (x - dx0) % 7 === 6) F(x, t, 1, 24, "#2a5a4a"); }
    F(dx0 + 6, vg - 20 + tilt(dx0 + 6), 1, 24, "#1a3a30"); P(dx0 + 4, vg - 8 + tilt(dx0), "#e8c060"); P(dx0 + 9, vg - 8 + tilt(dx0 + 9), "#e8c060");
    for (let i = 0; i < 30; i++) { const x = vx - vw / 2 + k.ri(0, vw - 1); P(x, vg + 2 + tilt(x) - k.ri(0, 4), k.pick(["#e8e0d0", "#c8c0b0", "#3a6a4a", "#5a8a5a"])); }
    for (let i = 0; i < 8; i++) { const x = vx - vw / 2 + k.ri(2, vw - 3), t = vg - 28 + tilt(x); for (let j = 0; j < k.ri(4, 12); j++) P(x + (j % 3 === 2 ? 1 : 0), t + 4 + j, j % 2 ? "#3a6a3a" : "#4a7a42"); }
    for (let x = vx - vw / 2 - 3; x < vx + vw / 2 + 3; x++) { P(x, vg + 3 + tilt(x), "#d8ecf4"); if (x % 3 === 0) P(x, vg + 4 + tilt(x), "#8ab8cc"); }
    for (let i = 0; i < 10; i++) P(vx + k.ri(-12, 12), vg + 4 + k.ri(0, 3), "#f0d060");
    add(ACT.sparkle({ x: vx - 14, y: vg + 2, w: 28, h: 5, n: 5, col: "#fff4b0", seed: 2 }));
    const tentacle = (bx, by, len, ph, per) => ({ z: by, draw(ctx, t) {
      const f = frac(t / per + ph);
      const up = f < 0.2 ? f / 0.2 : f < 0.6 ? 1 : f < 0.8 ? 1 - (f - 0.6) / 0.2 : 0;
      if (up <= 0) return;
      const n = R(len * up);
      for (let i = 0; i < n; i++) {
        const u = i / len, sway = Math.sin(t * 1.1 + ph * 6 + u * 3.2) * u * u * 9;
        const x = bx + sway + (u > 0.75 ? Math.sin((u - 0.75) * 12 + t) * (u - 0.75) * 24 : 0), y = by - i + (u > 0.85 ? R((u - 0.85) * 20) : 0);
        const w = Math.max(1, R((1 - u) * 3.2));
        rect(ctx, x - w - 1, y, w * 2 + 3, 1, "#2a0e10");
        rect(ctx, x - w, y, w * 2 + 1, 1, "#9a3428"); rect(ctx, x - w, y, 1, 1, "#c8583e");
        if (i % 3 === 1 && w > 1) rect(ctx, x + w, y, 1, 1, "#f0c8b0");
      }
      rect(ctx, bx - 5, by + 1, 11, 1, "#d8ecf4");
    } });
    add(tentacle(R(W * 0.76), 68, 34, 0, 17));
    add(tentacle(R(W * 0.86), 71, 26, 0.35, 17));
    add(tentacle(R(W * 0.14), 62, 18, 0.6, 23));
    add({ z: -20, draw(ctx, t) {
      const f = frac(t / 28 + 0.3);
      if (f > 0.6) return;
      const x = W + 10 - f / 0.6 * (W + 40), y = hz + 6;
      for (let s = 0; s < 3; s++) { const hx = x + s * 7, h = 2 + (s === 0 ? 1 : 0); rect(ctx, hx - 2, y - h, 5, h, "#2e5a5a"); rect(ctx, hx - 1, y - h, 3, 1, "#4a7a72"); rect(ctx, hx - 3, y, 7, 1, "#c8e4ec"); }
    } });
    const bt = R(W * 0.92);
    F(bt - 8, 82, 17, 3, OL); F(bt - 7, 82, 15, 2, "#7a5a38"); F(bt - 7, 82, 15, 1, "#9a7a4a"); F(bt - 1, 79, 1, 3, "#5a4028");
    add(A.waves({ x0: 0, x1: vx - vw / 2 - 3, y: hz + 2, h: 26, n: R(W / 12), col: "#d0e8f0", seed: 3 }));
    add(A.waves({ x0: vx + vw / 2 + 3, x1: W, y: hz + 2, h: 26, n: R(W / 12), col: "#d0e8f0", seed: 7 }));
    add(A.waves({ x0: vx - vw / 2 - 3, x1: vx + vw / 2 + 3, y: vg + 1, h: 4, n: 4, col: "#d0e8f0", seed: 8 }));
    add(ACT.sparkle({ x: 0, y: hz + 1, w: vx - vw / 2 - 4, h: 8, n: R(W / 28), seed: 4 }));
    add(ACT.sparkle({ x: vx + vw / 2 + 4, y: hz + 1, w: W - vx - vw / 2 - 4, h: 8, n: R(W / 28), seed: 9 }));
    for (let i = 0; i < 3; i++) add(A.gull({ W, y: k.rnd(8, 30), seed: 40 + i }));
    for (let i = 0; i < 2; i++) add(A.crab({ x: k.rnd(W * 0.1, W * 0.8), y: k.ri(84, 88), range: 8, seed: 60 + i }));
    add(A.mist({ W, y: hz + 2, h: 8, rgb: "200,214,220", a: 0.25, speed: 2, seed: 5 }));
  }

  // ---------- Emberdeep ----------
  function emberdeep(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const OL = "#0e0808", BS = ["#5a4440", "#42302e", "#2e2220", "#1e1616"], LV = ["#fff2a0", "#ffc04a", "#f07a2a", "#c8401e", "#7a2214"];
    k.grad(0, 82, ["#140c10", "#22141a", "#3a1c1c", "#6a2c22", "#a8482a"]);
    for (let i = 0; i < W / 8; i++) { const x = k.ri(0, W), y = k.ri(0, 30); P(x, y, "#4a2a2a"); }
    const vx = R(W * 0.52);
    const tops = range(k, { peaks: [[vx - 6, 16, 1.1, 1.0], [vx + 6, 17, 1.0, 1.1], [R(W * 0.08), 44, 0.6, 0.7], [R(W * 0.95), 42, 0.7, 0.6]], base: 80, lit: BS[1], shade: BS[2], rim: BS[0], rock: BS[3], rockLit: BS[0], jag: 2, seed: 71 });
    for (let x = vx - 6; x <= vx + 6; x++) { const t = tops[x]; F(x, t, 1, 2, LV[2 + (x % 2)]); P(x, t, LV[1]); }
    const flow = (x0, y0, len, sd) => { const rr = Art.rng(sd); let x = x0; for (let y = y0; y < y0 + len; y++) { x += R((rr() - 0.5) * 2); P(x, y, LV[(y - y0) % 7 === 0 ? 1 : 2]); P(x + 1, y, LV[3]); } };
    flow(vx - 3, 20, 26, 1); flow(vx + 4, 22, 32, 2); flow(vx - 12, 34, 20, 3);
    const cx = vx, cy = 78, crack = [];
    { let x = cx; for (let y = 0; y < 26; y++) { if (y % 4 === 0) x += [2, -2, 1, -1, 2, -3, 1][(y >> 2) % 7]; crack.push(x); } }
    for (let y = 0; y < 26; y++) {
      const x = crack[y], hw = y < 6 ? 0 : y < 16 ? 1 : 2;
      F(x - hw - 1, cy - 38 + y, hw * 2 + 3, 1, OL);
      F(x - hw, cy - 38 + y, hw * 2 + 1, 1, y < 8 ? LV[3] : LV[2]);
      if (hw > 0) P(x, cy - 38 + y, y < 12 ? LV[2] : LV[1]);
    }
    for (let y = 0; y < 13; y++) {
      const hw = R(9 * Math.sqrt(Math.max(0, 1 - ((12 - y) / 13) ** 2)));
      F(cx - hw - 1, cy - 12 + y, hw * 2 + 3, 1, OL);
      F(cx - hw, cy - 12 + y, hw * 2 + 1, 1, y < 4 ? "#2a1210" : "#1a0a08");
      if (y > 7) F(cx - hw + 2, cy - 12 + y, Math.max(1, hw * 2 - 3), 1, y > 10 ? LV[2] : LV[3]);
    }

    const breathe = { z: 0, draw(ctx, t) {
      const b = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 6);
      A.light(ctx, cx, cy - 10, 30, "255,110,40", 0.12 + b * 0.22);
      A.light(ctx, cx, cy - 3, 12, "255,210,110", 0.1 + b * 0.16);
      const f = frac(t / 6 + 0.75);
      if (f < 0.4) for (let i = 0; i < 7; i++) {
        const a = f / 0.4, x = cx + Math.sin(i * 1.7 + a * 3) * (2 + a * 6), y = cy - 28 - a * 22 - i * 1.5;
        ctx.globalAlpha = 0.5 * (1 - a); rect(ctx, x, y, 2 + R(a * 3), 2, i % 2 ? "#6a5a5a" : "#8a7672"); ctx.globalAlpha = 1;
      }
    } };
    add(breathe);
    k.grad(80, 90, ["#2a1e1c", "#221816", "#1a1210"]);
    const river = (x) => 84 + R(Math.sin(x * 0.06) * 2);
    for (let x = 0; x < W; x++) { const y = river(x); F(x, y - 1, 1, 5, OL); F(x, y, 1, 3, LV[2]); if ((x >> 2) % 3 === 0) P(x, y + 1, LV[1]); if (x % 9 < 4) F(x, y, 1, 1, LV[3]); }
    add({ z: 85, draw(ctx, t) { for (let x = 0; x < W; x += 1) { const y = river(x), v = Math.sin(x * 0.4 - t * 2) + Math.sin(x * 0.13 + t); if (v > 1.3) rect(ctx, x, y + 1, 1, 1, LV[0]); else if (v < -1.2) rect(ctx, x, y, 1, 1, LV[4]); } } });
    const snag = (x, g, h) => { k.line(x, g, x, g - h, OL); k.line(x + 1, g, x + 1, g - h + 2, "#2a1e1a"); k.line(x, g - h + 4, x - 4, g - h, OL); k.line(x + 1, g - h + 6, x + 5, g - h + 2, OL); P(x, g - h + 1, LV[3]); };
    snag(R(W * 0.14), 80, 16); snag(R(W * 0.2), 82, 10); snag(R(W * 0.86), 81, 14);
    const kx = R(W * 0.32);
    k.blob(kx, 80, 3, 2, OL); k.blob(kx, 79, 2, 2, "#c8c0b0"); P(kx - 1, 79, OL); P(kx + 1, 79, OL);
    F(kx + 4, 76, 6, 6, OL); F(kx + 5, 77, 4, 4, "#7a8a9a"); F(kx + 5, 77, 4, 1, "#a8b4c0"); P(kx + 6, 79, "#c84a2a");
    k.line(kx - 5, 81, kx - 2, 70, "#8a8a94"); P(kx - 2, 69, "#d8d8e0"); F(kx - 5, 74, 4, 1, "#6a5030");
    for (let i = 0; i < 9; i++) P(cx + k.ri(-5, 5), cy - k.ri(1, 2), k.pick(["#f0d060", "#ffe890", "#c8a040"]));
    add(ACT.sparkle({ x: cx - 5, y: cy - 3, w: 10, h: 2, n: 3, col: "#fff8c0", seed: 2 }));
    add(ACT.plume({ x: vx, y: 14, n: 9, rise: 16, life: 6, wind: 18, cols: ["#3a2a2a", "#4a3634", "#5a4442", "#6a5452", "#7a6462"], seed: 3 }));
    add(A.embers({ x0: 0, x1: W, y: 90, n: R(W / 10), rise: 70, seed: 4 }));
    add(A.embers({ x0: cx - 8, x1: cx + 8, y: cy, n: 6, rise: 40, seed: 5 }));
    add({ z: 1e3, draw(ctx, t) { for (let i = 0; i < R(W / 12); i++) { const x = frac(i * 0.618 + t * 0.01) * W + Math.sin(t + i) * 3, y = frac(i * 0.37 + t * 0.05) * 90; rect(ctx, x, y, 1, 1, i % 2 ? "#4a3a38" : "#6a5a56"); } } });
    for (let i = 0; i < 3; i++) add(A.glow({ x: R(W * (0.2 + i * 0.3)), y: 86, r: 24, rgb: "255,110,30", a: 0.12, amp: 0.2, speed: 0.8 + i * 0.3, seed: 6 + i }));
  }

  TS.register("kingsroad", kingsroad, "wilds");
  TS.register("greenwood", greenwood, "wilds");
  TS.register("bleakmarsh", bleakmarsh, "wilds");
  TS.register("redcrag", redcrag, "wilds");
  TS.register("whitepeak", whitepeak, "wilds");
  TS.register("wolf_den", wolf_den, "dungeons");
  TS.register("collapsed_mine", collapsed_mine, "dungeons");
  TS.register("cragtooth_warren", cragtooth_warren, "dungeons");
  TS.register("ashveil_crypts", ashveil_crypts, "dungeons");
  TS.register("thornmere_ruins", thornmere_ruins, "dungeons");
  TS.register("frostspire", frostspire, "dungeons");
  TS.register("sunken_vault", sunken_vault, "dungeons");
  TS.register("emberdeep", emberdeep, "dungeons");
  TS.register("saltcliffs", saltcliffs, "wilds");
  TS.paint = { range, grove, noise2d };
})();
