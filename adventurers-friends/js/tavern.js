/* Isometric pixel rooms with heroes who walk, chat and order drinks. Tavern.scene is the preseason tavern on the Crier;
   Tavern.inn is the same common room for any cast; the stage, actor, talk (speech.js) and loop helpers are shared with camp.js.
   Everything said comes from the sim (league.voice); this only stages it. */
(function () {
  "use strict";

  function fillPoly(ctx, pts, color) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs)), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (!inside) continue;
      const c = typeof color === "function" ? color(x, y) : color;
      if (c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
    }
  }

  // one tile is 16x8 px on screen; u runs down-right along the right wall, v down-left along the left wall
  function stage(W, H, OX, OY) {
    const iso = (u, v) => [OX + (u - v) * 8, OY + (u + v) * 4];
    const up = (p, h) => [p[0], p[1] - h];
    const lwall = (v, h) => up(iso(0, v), h);
    const rwall = (u, h) => up(iso(u, 0), h);
    const quad = (f, a0, a1, h0, h1) => [f(a0, h0), f(a1, h0), f(a1, h1), f(a0, h1)];
    const toUV = (x, y) => { const a = (x + 0.5 - OX) / 8, b = (y + 0.5 - OY) / 4; return [(a + b) / 2, (b - a) / 2]; };
    // position along a wall and height above the floor, for brick and plank patterns that follow the wall
    const onL = (x, y) => [(OX - x - 0.5) / 8, OY + (OX - x - 0.5) / 2 - y - 0.5];
    const onR = (x, y) => [(x + 0.5 - OX) / 8, OY + (x + 0.5 - OX) / 2 - y - 0.5];
    function canvas() { const cv = document.createElement("canvas"); cv.width = W; cv.height = H; return cv; }
    function box(u, v, du, dv, h, top, left, right, z) {
      const cv = canvas(), ctx = cv.getContext("2d"), e = z || 0;
      const a = up(iso(u, v + dv), e), b = up(iso(u + du, v + dv), e), c = up(iso(u + du, v), e), d = up(iso(u, v), e);
      fillPoly(ctx, [a, b, up(b, h), up(a, h)], left);
      fillPoly(ctx, [b, c, up(c, h), up(b, h)], right);
      fillPoly(ctx, [up(a, h), up(b, h), up(c, h), up(d, h)], top);
      return cv;
    }
    return { W, H, OX, OY, iso, up, lwall, rwall, quad, toUV, onL, onR, canvas, box };
  }

  // k scales it down for a keg on a counter
  function barrel(ctx, x, y, k) {
    const s = k || 1, R = Math.round(5 * s), Hh = Math.round(12 * s), hoops = [2, Hh - 3, Math.round(Hh / 2)];
    for (let j = 0; j < Hh; j++) {
      const w = R - (j < 1 || j > Hh - 2 ? 1 : 0);
      for (let i = -w; i <= w; i++) {
        const t = (i + w) / (2 * w);
        let c = t < 0.18 ? "#6e4424" : t < 0.42 ? "#a8743e" : t < 0.62 ? "#8a5a30" : t < 0.85 ? "#6a4224" : "#4a2c18";
        if (hoops.includes(j)) c = t < 0.42 ? "#8a8a8e" : t < 0.7 ? "#5e5e66" : "#3e3e46";
        else if (Math.round(i * 2.2) % 5 === 0 && i !== 0 && t > 0.1) c = "#4a2c18";
        ctx.fillStyle = c; ctx.fillRect(x + i, y - j - 1, 1, 1);
      }
    }
    ctx.fillStyle = "#3a2212"; ctx.fillRect(x - R + 1, y - Hh - 1, 2 * R - 1, 1);
    ctx.fillStyle = "#8a5a30"; ctx.fillRect(x - R + 2, y - Hh - 2, 2 * R - 3, 1);
    ctx.fillStyle = "#24140a"; ctx.fillRect(x - R + 1, y, 2 * R - 1, 1);
  }
  // a night window in the right wall, with a mullion and a few stars
  // o: { frame: wood colour, curtain: [cloth, fold], sill: true, town: id and weather for a live view out of it }
  // with o.town it returns { draw(ctx, now, still) }: the view, then the panes and curtains over it, every frame
  function windowR(ctx, st, r, a0, a1, h0, h1, moon, o) {
    const opt = o || {}, fr = opt.frame || "#3a2414";
    fillPoly(ctx, st.quad(st.rwall, a0 - 0.15, a1 + 0.15, h0 - 2, h1 + 2), fr);
    fillPoly(ctx, st.quad(st.rwall, a0, a1, h0, h1), (x, y) => {
      const [, h] = st.onR(x, y), t = (h - h0) / (h1 - h0);
      if (r() < 0.025 && t > 0.3) return r() < 0.5 ? "#f0e8c0" : "#a8b8e0";
      return t < 0.3 ? ((x + y) % 2 ? "#2c4272" : "#263a66") : t < 0.55 ? ((x + y) % 3 ? "#203258" : "#26386a") : "#1a2848";
    });
    const live = opt.town ? st.canvas() : null, wall = ctx;
    if (live) ctx = live.getContext("2d");
    const mid = (a0 + a1) / 2, hm = (h0 + h1) / 2;
    fillPoly(ctx, st.quad(st.rwall, mid - 0.06, mid + 0.06, h0, h1), fr);
    if (!live) fillPoly(ctx, st.quad(st.rwall, a0, a1, hm - 0.5, hm + 0.5), fr);
    line(ctx, st.rwall(a0 - 0.15, h1 + 2), st.rwall(a1 + 0.15, h1 + 2), shade(fr, 0.3));
    if (moon && !live) {
      const m = st.rwall(a0 + 0.35, h1 - 3), x = Math.round(m[0]), y = Math.round(m[1]);
      ctx.fillStyle = "#f4ecc8"; ctx.fillRect(x + 1, y, 2, 1); ctx.fillRect(x, y + 1, 2, 2); ctx.fillRect(x + 1, y + 3, 2, 1);
      ctx.fillStyle = "#fffbe8"; ctx.fillRect(x, y + 1, 1, 1);
    }
    if (opt.sill !== false) slab(wall, st, a0 - 0.25, 0, a1 - a0 + 0.5, 0.3, 2, shade(fr, 0.15), h0 - 4);
    if (opt.curtain) {
      const [c, d] = opt.curtain;
      for (const [s0, s1] of [[a0 - 0.5, a0 + 0.12], [a1 - 0.12, a1 + 0.5]]) {
        fillPoly(ctx, st.quad(st.rwall, s0, s1, h0 - 7, h1 + 3), (x, y) => {
          const [a, h] = st.onR(x, y), fold = Math.floor((a - s0) * 14) % 3;
          const tie = Math.abs(h - (h0 + 2)) < 1;
          return tie ? shade(c, -0.4) : fold === 0 ? d : fold === 1 ? c : shade(c, 0.12);
        });
      }
      fillPoly(ctx, st.quad(st.rwall, a0 - 0.6, a1 + 0.6, h1 + 2, h1 + 6), (x, y) => {
        const [a, h] = st.onR(x, y);
        if (h < h1 + 3 && Math.floor(a * 5) % 2) return null;
        return h > h1 + 5 ? shade(c, 0.15) : c;
      });
    }
    if (!live) return null;
    const view = townView(opt.town, opt.weather, moon, Math.round((a1 - a0) * 8), Math.round(h1 - h0), r), x0 = Math.round(st.rwall(a0, 0)[0]);
    const gq = st.quad(st.rwall, a0, a1, h0, h1);
    return { glass: (x, y) => x >= gq[0][0] && x < gq[1][0] && y >= gq[3][1] + (x - gq[0][0]) / 2 && y < gq[0][1] + (x - gq[0][0]) / 2, draw(c, now, still) {
      const pano = view(now, still);
      for (let i = 0; i < pano.width; i++) c.drawImage(pano, i, 0, 1, pano.height, x0 + i, Math.round(st.rwall(a0 + (i + 0.5) / 8, h1)[1]), 1, pano.height);
      c.drawImage(live, 0, 0);
    } };
  }

  // ---------- what each town looks like through a window at night (palettes from TownScenes.THEME) ----------
  function weatherAt(town) {
    const S = (window.LD && LD.static) || {}, L = (window.App && App.L) || (window.LD && LD.league) || {};
    const reg = Object.keys(S.regions || {}).find((k) => S.regions[k].includes(town));
    return (L.weather || {})[reg] || "clear";
  }
  // returns view(now, still) -> a w x h canvas: the still scene is painted once, the moving bits each frame
  function townView(town, weather, moon, w, h, r) {
    const th = (window.TownScenes && TownScenes.THEME && TownScenes.THEME[town]) || { primary: "#3a5a8a", accent: "#e8c060", dark: "#1a2440", light: "#e0e8f0" };
    const wx = town === "frosthold" && weather !== "storm" ? "snow" : weather || "clear";
    const base = document.createElement("canvas"); base.width = w; base.height = h;
    const out = document.createElement("canvas"); out.width = w; out.height = h;
    const b = base.getContext("2d"), c = out.getContext("2d");
    const P = (g, x, y, col, ww, hh) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), ww || 1, hh || 1); };
    const gy = Math.round(h * 0.68), grey = wx === "cloudy" || wx === "rain" || wx === "storm" || wx === "fog";
    const top = grey ? "#1c2230" : mixc(th.dark, "#0a1228", 0.55), low = grey ? "#343c4e" : mixc(mixc(th.dark, "#2c4270", 0.7), th.primary, 0.15);
    for (let y = 0; y < h; y++) P(b, 0, y, mixc(top, low, y / h), w, 1);
    if (!grey) for (let i = 0; i < Math.max(2, (w * h) / 40); i++) P(b, r() * w, r() * gy * 0.8, r() < 0.5 ? "#f0e8c0" : "#a8b8e0");
    if (moon && !grey && town !== "hollowood") { P(b, 2, 1, "#f4ecc8", 2, 1); P(b, 1, 2, "#f4ecc8", 2, 2); P(b, 2, 4, "#f4ecc8", 2, 1); P(b, 1, 2, "#fffbe8"); }
    if (wx === "cloudy" || wx === "storm") for (let i = 0; i < 3; i++) { const cx = r() * w, cy = 1 + r() * gy * 0.4; P(b, cx - 3, cy, "#3e4658", 7, 2); P(b, cx - 1, cy - 1, "#485064", 4, 1); }
    const ridge = (y0, amp, f, ph, col, cap) => {
      for (let x = 0; x < w; x++) {
        const y = Math.round(y0 - Math.abs(Math.sin(x * f + ph)) * amp - Math.sin(x * f * 2.7 + ph) * amp * 0.3);
        P(b, x, y, col, 1, h - y);
        if (cap && y < y0 - amp * 0.6) P(b, x, y, cap, 1, 2);
      }
    };
    let anim = null;
    if (town === "frosthold") {
      ridge(gy - 1, 4, 0.5, 1, "#9aa8c4", "#e8f0fc"); ridge(gy + 2, 2, 0.3, 2, "#dfe8f6");
      for (const px of [1, w - 4, Math.round(w * 0.45)]) for (let j = 0; j < 6; j++) P(b, px + 1 - Math.floor(j / 2.5), gy - 4 + j, "#142440", 1 + Math.floor(j / 2.5) * 2, 1);
    } else if (town === "saltmarrow") {
      const sy = Math.round(h * 0.55), lx = moon ? Math.round(w * 0.74) : -99, ly = sy - 9;
      for (let y = sy; y < h; y++) P(b, 0, y, mixc(th.dark, "#0c1a2c", ((y - sy) / (h - sy)) * 0.6), w, 1);
      P(b, 0, sy, mixc(th.primary, "#a8c0e0", 0.3), w, 1);
      P(b, lx - 1, sy - 2, "#3a3a44", 4, 2);
      for (let j = 0; j < 7; j++) P(b, lx, sy - 3 - j, j % 3 === 1 ? th.accent : th.light, 2, 1);
      P(b, lx - 1, sy - 10, "#2a2a34", 4, 1);
      anim = (now, still) => {
        for (let i = 0; i < 4; i++) P(c, (i * 5.3 + now * 1.5) % w, sy + 2 + ((i * 3) % Math.max(1, h - sy - 2)), "#5a7aa8", 2, 1);
        const k = still ? 0.6 : Math.cos(now * 1.3);
        P(c, lx, ly, k > 0.85 ? "#fffbe0" : "#f8d878", 2, 1);
        if (k > 0 && moon) {
          c.globalAlpha = 0.45 * k;
          for (let i = 1; i < Math.round(k * w); i++) { const sp = Math.floor(i / 6); P(c, lx - i, ly - sp, "#fff4c0", 1, 1 + sp * 2); }
          c.globalAlpha = 1;
        }
      };
    } else if (town === "hollowood") {
      P(b, 0, gy, "#1e3220", w, h - gy);
      for (let x = 0; x < w; x++) P(b, x, 0, "#16261a", 1, 2 + Math.round(Math.abs(Math.sin(x * 0.9)) * 3));
      for (const [px, pw] of [[1, 2], [Math.round(w * 0.42), 3], [w - 4, 2]]) { P(b, px, 0, "#3a2a1c", pw, h); P(b, px, 0, "#6a5438", 1, h); P(b, px + pw - 1, 0, "#24180e", 1, h); P(b, px - 1, gy - 1, "#24180e", pw + 2, 2); }
      anim = (now, still) => {
        for (let i = 0; i < 4; i++) {
          if (!still && Math.sin(now * 2.1 + i * 1.7) < -0.2) continue;
          P(c, (i * 3.7 + Math.sin(now * 0.6 + i) * 2.5 + w) % w, gy - 2 - ((i * 2.3) % (gy - 4)) + Math.sin(now * 0.9 + i * 2) * 1.5, i % 2 ? "#e8e070" : "#c8f080");
        }
      };
    } else if (town === "veldrock") {
      ridge(gy - 2, 7, 0.55, 0.4, "#3a3e4a", "#c8ccd4"); ridge(gy + 1, 4, 0.35, 2, th.dark);
      const mx = Math.round(w * (moon ? 0.72 : 0.3)), my = gy + 1;
      anim = (now, still) => {
        const k = still ? 1 : 0.75 + 0.25 * Math.sin(now * 1.6);
        c.globalAlpha = 0.35 * k; P(c, mx - 3, my - 2, th.accent, 7, 4); c.globalAlpha = 0.6 * k; P(c, mx - 2, my - 1, th.accent, 5, 2); c.globalAlpha = 1;
        P(c, mx, my, "#f8c060", 2, 1); P(c, mx, my - 1, "#ffe8a0", 1, 1);
      };
    } else if (town === "ashfen") {
      const lx = Math.round(w * (moon ? 0.68 : 0.3));
      P(b, 0, gy, th.dark, w, h - gy);
      for (let x = 1; x < w - 1; x += 3) P(b, x, gy + 2 + (x % 2), "#2e4440", 2, 1);
      for (let x = 0; x < w; x += 3) P(b, x + ((x * 5) % 2), gy - 1 - ((x * 7) % 3), "#16201e", 1, 2 + ((x * 7) % 3));
      P(b, lx, gy - 6, "#16201e", 1, 7); P(b, lx, gy - 6, "#16201e", 3, 1);
      anim = (now, still) => {
        const f = still ? 1 : 0.7 + 0.3 * Math.abs(Math.sin(now * 5.3) * Math.sin(now * 2.1));
        c.globalAlpha = 0.3 * f; P(c, lx, gy - 8, "#f8e0a0", 5, 6); c.globalAlpha = 0.6 * f; P(c, lx + 2, gy + 2, th.accent, 1, 2);
        c.globalAlpha = 1; P(c, lx + 1, gy - 5, "#3a2a1a", 3, 3); P(c, lx + 2, gy - 4, f > 0.85 ? "#fff4c0" : th.accent, 1, 1);
        c.globalAlpha = 0.4;
        for (const [y0, sp] of [[gy - 3, 1.2], [gy + 1, -0.8]]) { const off = ((now * sp) % 7 + 7) % 7; for (let x = -7; x < w + 7; x += 7) P(c, x + off, y0, th.light, 5, 1); }
        c.globalAlpha = 1;
      };
    } else if (town === "ironhaven") {
      const dx = moon ? Math.round(w * 0.74) : -99, dy = gy - 9;
      for (let x = 0; x < w;) { const bw = 3 + Math.floor(r() * 3), bh = 3 + Math.floor(r() * 4); P(b, x, gy - bh, th.dark, bw, h); P(b, x + 1, gy - bh - 1, th.dark, bw - 2, 1); if (r() < 0.6) P(b, x + 1, gy - bh + 2, "#e8c060"); x += bw; }
      if (moon) {
        P(b, dx - 4, dy + 4, mixc(th.dark, "#4a4656", 0.5), 9, 6); P(b, dx - 3, dy + 6, "#e8c060"); P(b, dx + 1, dy + 6, "#e8c060");
        for (let j = 0; j <= 4; j++) for (let i = -4; i <= 4; i++) if (i * i + (4 - j) * (4 - j) <= 17) P(b, dx + i, dy + j, i < -1 ? "#fff0c0" : i < 2 ? th.accent : mixc(th.accent, "#5a3a14", 0.45));
        P(b, dx, dy - 2, th.accent, 1, 2); P(b, dx, dy - 3, "#fff0c0");
      }
      anim = (now, still) => { if (!still && Math.floor(now / 3.3) % 3 === 1) P(c, Math.round(w * 0.2), gy - 3, "#e8c060"); };
    } else if (town === "thornwall") {
      const mx = moon ? Math.round(w * 0.74) : -99, hy = gy - 8, hx = Math.round(w * 0.12);
      P(b, 0, gy, "#3e2818", w, h - gy);
      for (const y of [gy + 2, gy + 4]) for (let x = 0; x < w; x += 2) P(b, x + (y % 2), y, "#5a3a20");
      P(b, hx, gy - 6, "#2a1c12", 5, 6); P(b, hx, gy - 8, "#2a1c12", 5, 2); P(b, hx + 1, gy - 9, "#2a1c12", 3, 1); P(b, hx + 1, gy - 4, th.accent, 2, 2);
      P(b, mx - 1, hy, "#2a1c12", 3, 8); P(b, mx - 2, gy - 2, "#2a1c12", 5, 2);
      anim = (now, still) => {
        const a0 = still ? 0.4 : now * 0.7;
        for (let k = 0; k < 4; k++) { const a = a0 + (k * Math.PI) / 2; for (let i = 1; i <= 6; i++) P(c, mx + Math.cos(a) * i, hy + Math.sin(a) * i, i > 2 ? "#a88a64" : "#6a5038"); }
        P(c, mx, hy, "#1a120a");
        if (still || Math.sin(now * 0.7) < 0.95) P(c, hx + 1, gy - 4, "#f8d070");
      };
    } else if (town === "carrbridge") {
      const tx = moon ? Math.round(w * 0.76) : -99;
      for (let y = gy; y < h; y++) P(b, 0, y, mixc(th.dark, "#0e1a26", ((y - gy) / (h - gy)) * 0.5), w, 1);
      const stone = mixc(th.dark, "#6a6a70", 0.45);
      for (let x = 0; x < w; x++) { const d = (x - w * 0.38) / (w * 0.3), arch = d * d < 1 ? Math.round(Math.sqrt(1 - d * d) * 4) : 0; P(b, x, gy - 4, stone, 1, 7 - arch); P(b, x, gy - 5, "#8a8a90"); }
      for (let x = 0; x < w; x += 3) P(b, x, gy - 6, stone, 1, 1);
      if (moon) { P(b, tx - 1, gy - 13, stone, 3, 13); P(b, tx - 2, gy - 14, "#8a8a90", 5, 1); P(b, tx - 1, gy - 15, stone, 3, 1); }
      anim = (now, still) => {
        for (let i = 0; i < 3; i++) P(c, (i * 4.1 + now * 2) % w, gy + 2 + ((i * 2) % Math.max(1, h - gy - 2)), th.primary, 2, 1);
        if (still || Math.sin(now * 0.9) > -0.6) { P(c, tx, gy - 11, "#ffe080", 1, 2); c.globalAlpha = 0.5; P(c, tx - 1, gy - 12, "#f0c860", 3, 4); P(c, tx, gy + 2, "#f0c860", 1, 3); c.globalAlpha = 1; }
      };
    } else P(b, 0, gy + 2, "#1a2030", w, h - gy - 2);
    const flakes = wx === "snow" ? Math.max(4, Math.round((w * h) / 30)) : 0, drops = wx === "rain" ? 4 : wx === "storm" ? 7 : 0;
    // frost creeps in from the frame on Frosthold's panes
    const frost = town === "frosthold" ? document.createElement("canvas") : null;
    if (frost) {
      frost.width = w; frost.height = h;
      const f = frost.getContext("2d");
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const e = Math.min(x, w - 1 - x, y, h - 1 - y) - (y > h - 4 ? 1 : 0);
        if (e < 2 && (x * 7 + y * 13) % 5 < (e < 1 ? 4 : 2)) P(f, x, y, e < 1 ? "rgba(236,244,255,0.85)" : "rgba(210,226,250,0.55)");
      }
    }
    return function (now, still) {
      const t = still ? 2 : now;
      c.drawImage(base, 0, 0);
      if (anim) anim(t, still);
      for (let i = 0; i < flakes; i++) P(c, (i * 3.7 + Math.sin(t * 0.8 + i) * 1.5 + w * 4) % w, (t * (4 + (i % 3)) + i * 5.3) % h, "#f0f6ff");
      for (let i = 0; i < drops; i++) { const x = ((i * 4.3 + t * 9) % (w + 4)) - 2, y = ((t * 30 + i * 7.1) % (h + 4)) - 3; P(c, x, y, "#8aa0c8"); P(c, x - 1, y + 1, "#8aa0c8"); P(c, x - 1, y + 2, "#6a80a8"); }
      if (wx === "storm" && !still && (now * 0.31) % 1 < 0.025) { c.fillStyle = "rgba(230,236,255,0.65)"; c.fillRect(0, 0, w, h); }
      if (wx === "fog") { c.globalAlpha = 0.22; for (let k = 0; k < 4; k++) { const y = gy - 5 + k * 3, off = ((t * (0.6 + k * 0.25) + k * 5) % (w + 6)) - 6; P(c, off, y, "#c8ccd0", 6 + k, 2); P(c, off - w - 6, y, "#c8ccd0", 6 + k, 2); P(c, 0, y + 1, "#c8ccd0", w, 1); } c.globalAlpha = 1; }
      if (frost) c.drawImage(frost, 0, 0);
      return out;
    };
  }
  // the moonlight a right-wall window lays across the floor
  // maxU: the floor's far edge, so the beam never spills past it
  function moonbeam(ctx, st, a0, a1, reach, maxU) {
    const d = reach || 3.4, lim = maxU || 99;
    fillPoly(ctx, [st.iso(a0, 0.1), st.iso(a1, 0.1), st.iso(a1 + d * 0.55, d), st.iso(a0 + d * 0.55, d)], (x, y) => {
      if (st.toUV(x, y)[0] > lim) return null;
      return (x + y) % 2 ? "rgba(150,180,240,0.12)" : "rgba(150,180,240,0.07)";
    });
  }
  // a stone fireplace in the left wall; flames() animates the fire inside it
  // o: { stone: [three colours], mortar, mantel: wood colour, marble: true for a pale dressed-stone surround }
  function hearth(ctx, st, r, v0, v1, top, o) {
    const T = top || 52, opt = o || {};
    const s = opt.stone || (opt.marble ? ["#d8cfc0", "#cfc5b4", "#e2dacc"] : ["#8a8076", "#7a7068", "#948a7e"]), mortar = opt.mortar || (opt.marble ? "#a89c8a" : "#4e4640");
    const stones = (big) => (x, y) => {
      const [a, h] = st.onL(x, y), sz = big ? 6 : 4, row = Math.floor(h / sz), off = row % 2 ? 0.35 : 0, w = big ? 1.1 : 0.7;
      if (h % sz < 1 || Math.abs((a / w + off) % 1) < 0.08) return mortar;
      return s[Math.floor(Math.abs(Math.sin(row * 12.9 + Math.floor(a / w + off) * 78.2)) * s.length * 0.999)];
    };
    fillPoly(ctx, st.quad(st.lwall, v0 - 0.2, v1 + 0.2, 30, T - 3), stones(false));
    fillPoly(ctx, st.quad(st.lwall, v0 - 0.2, v1 + 0.2, 30, T - 3), (x, y) => ((x + y) % 2 ? "rgba(0,0,0,0.12)" : null));
    fillPoly(ctx, st.quad(st.lwall, v0 - 0.5, v1 + 0.5, 0, 30), stones(!!opt.marble));
    const arch = [st.lwall(v0, 0), st.lwall(v1, 0), st.lwall(v1, 13), st.lwall(v1 - 0.25, 16), st.lwall(v1 - 0.6, 17), st.lwall(v0 + 0.6, 17), st.lwall(v0 + 0.25, 16), st.lwall(v0, 13)];
    fillPoly(ctx, arch, (x, y) => { const [, h] = st.onL(x, y); return h > 12 ? "#0a0605" : h > 6 ? "#140c08" : "#1e120c"; });
    for (let i = 0; i < 26; i++) { const p = st.lwall(v0 + 0.2 + r() * (v1 - v0 - 0.4), 17 + r() * 6); ctx.fillStyle = "rgba(20,12,10,0.5)"; ctx.fillRect(Math.round(p[0]), Math.round(p[1]), 1, 1); }
    fillPoly(ctx, [st.iso(0, v0 - 0.5), st.iso(0.75, v0 - 0.5), st.iso(0.75, v1 + 0.5), st.iso(0, v1 + 0.5)], (x, y) => {
      const [u, v] = st.toUV(x, y);
      return Math.abs(v * 1.4 - Math.round(v * 1.4)) < 0.06 || u > 0.68 ? mortar : (Math.floor(v * 1.4) % 2 ? s[1] : s[0]);
    });
    slab(ctx, st, 0, v0 - 0.62, 0.32, v1 - v0 + 1.24, 3, opt.mantel || "#5e3a1e", 29);
  }
  // bare: the fire alone, for rooms whose light comes from lighting()
  function flames(ctx, st, now, v0, v1, flick, size, bare) {
    const k = size || 1, n = Math.round((v1 - v0 - 0.4) * 8);
    const l0 = st.lwall(v0 + 0.35, 1), l1 = st.lwall(v1 - 0.35, 1);
    for (let t = 0; t < 3; t++) line(ctx, [l0[0], l0[1] - t], [l1[0], l1[1] - t], t === 1 ? "#6a4022" : "#3e2412");
    for (let i = 0; i < n; i++) {
      const v = v0 + 0.2 + (i / n) * (v1 - v0 - 0.4), prof = Math.sin(Math.PI * (i + 0.5) / n);
      const h = Math.max(1, (2 + prof * 11 * k) * (0.6 + 0.4 * Math.abs(Math.sin(now * 8.3 + i * 1.7))) * flick);
      const [x0, y] = st.lwall(v, 2), x = Math.round(x0);
      for (let j = 0; j < h; j++) {
        const sway = j > h * 0.6 ? Math.round(Math.sin(now * 6 + i * 0.9) * 0.7) : 0;
        ctx.fillStyle = j < h * 0.25 ? "#fff6c4" : j < h * 0.5 ? "#ffc844" : j < h * 0.78 ? "#f07c26" : "#b83818";
        ctx.fillRect(x + sway, Math.round(y) - j, 1, 1);
      }
      if ((i + Math.floor(now * 5)) % 4 === 0) { ctx.fillStyle = "#ff8a2a"; ctx.fillRect(x, Math.round(y) + 1, 1, 1); }
    }
    if (bare) return;
    const [fx, fy] = st.lwall((v0 + v1) / 2, 4);
    const glow = ctx.createRadialGradient(fx + 20, fy + 14, 2, fx + 20, fy + 14, 70 * k);
    glow.addColorStop(0, `rgba(255,170,80,${0.22 * flick})`); glow.addColorStop(1, "rgba(255,170,80,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, st.W, st.H);
  }
  // a lantern hanging from the ceiling at floor spot (u, v)
  // bare: the lamp alone, for rooms whose light comes from lighting()
  function lantern(ctx, st, u, v, flick, drop, bare) {
    const [x0, y] = st.iso(u, v), x = Math.round(x0), ly = Math.round(y - (drop || 62));
    ctx.fillStyle = "#2a1a10"; ctx.fillRect(x, 0, 1, ly - 2);
    ctx.fillRect(x - 1, ly - 2, 3, 1); ctx.fillRect(x - 2, ly - 1, 5, 1); ctx.fillRect(x - 2, ly, 1, 5); ctx.fillRect(x + 2, ly, 1, 5); ctx.fillRect(x - 2, ly + 5, 5, 1);
    ctx.fillStyle = "#ffe9a0"; ctx.fillRect(x - 1, ly, 3, 5); ctx.fillStyle = flick > 0.82 ? "#fff8d8" : "#ffd060"; ctx.fillRect(x, ly + 1, 1, 3);
    ctx.fillStyle = "#4a3018"; ctx.fillRect(x, ly, 1, 1); ctx.fillRect(x - 1, ly + 6, 3, 1);
    if (bare) return;
    const g = ctx.createRadialGradient(x, ly + 2, 0, x, ly + 2, 46);
    g.addColorStop(0, `rgba(255,210,120,${0.16 + flick * 0.04})`); g.addColorStop(1, "rgba(255,210,120,0)");
    ctx.fillStyle = g; ctx.fillRect(x - 46, ly - 44, 92, 92);
  }

  // ---------- shaded pieces for the rooms: colour ramps, pixel lines, solid blocks with lit edges ----------
  const rgbOf = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mixc = (a, b, t) => { const p = rgbOf(a), q = rgbOf(b); return "#" + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  // lighter toward warm candlelight, darker toward a deep brown, so shading never goes grey or purple
  const shade = (c, k) => (k >= 0 ? mixc(c, "#fff0c8", k) : mixc(c, "#140c0a", -k));
  function line(ctx, a, b, c) {
    let x0 = Math.round(a[0]), y0 = Math.round(a[1]);
    const x1 = Math.round(b[0]), y1 = Math.round(b[1]), dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    ctx.fillStyle = c;
    for (let n = 0; n < 400; n++) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // a block from floor spot (u, v), du x dv tiles, h px tall, raised z px; c is a colour or {top, left, right} (colours or pattern fns)
  function slab(ctx, st, u, v, du, dv, h, c, z, edges) {
    const { iso, up } = st, e = z || 0, base = typeof c === "string" ? c : c.base;
    const a = up(iso(u, v + dv), e), b = up(iso(u + du, v + dv), e), cc = up(iso(u + du, v), e), d = up(iso(u, v), e);
    const f = (k, fb) => (typeof c === "string" ? fb : c[k] || fb);
    if (h > 0) {
      fillPoly(ctx, [a, b, up(b, h), up(a, h)], f("left", base));
      fillPoly(ctx, [b, cc, up(cc, h), up(b, h)], f("right", shade(base, -0.3)));
    }
    fillPoly(ctx, [up(a, h), up(b, h), up(cc, h), up(d, h)], f("top", shade(base, 0.16)));
    if (edges === false) return;
    line(ctx, up(a, h), up(b, h), shade(base, 0.34));
    line(ctx, up(b, h), up(cc, h), shade(base, 0.24));
    if (h > 2) { line(ctx, up(b, h - 1), b, shade(base, 0.08)); line(ctx, a, b, shade(base, -0.45)); line(ctx, b, cc, shade(base, -0.55)); }
  }
  // four thin legs under a top at height h
  function legs(ctx, st, u, v, du, dv, h, c, inset) {
    const i = inset == null ? 0.08 : inset;
    for (const [lu, lv, k] of [[u + du - i, v + i, -0.35], [u + i, v + dv - i, 0], [u + du - i, v + dv - i, -0.15]]) {
      const [x, y] = st.iso(lu, lv);
      ctx.fillStyle = shade(c, k); ctx.fillRect(Math.round(x) - 1, Math.round(y) - h, 2, h);
      ctx.fillStyle = shade(c, -0.5); ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 1);
    }
  }

  // ---------- night light: soft pools of lamp and fire light over a dark room, warm near flames and cool under the moon ----------
  const WARM = [[10, 11, 22, 0.72], [20, 14, 20, 0.5], [34, 18, 16, 0.24], [0, 0, 0, 0], [255, 180, 90, 0.16]];
  const COOL = [[10, 11, 22, 0.72], [14, 20, 40, 0.5], [32, 48, 90, 0.3], [96, 124, 190, 0.14], [160, 190, 245, 0.2]];
  const ramp = (stops) => Array.from({ length: 81 }, (_, i) => {
    const t = Math.min(stops.length - 1.001, i / 20), j = Math.floor(t), f = t - j, a = stops[j], b = stops[j + 1];
    const m = a.map((v, n) => v + (b[n] - v) * f), al = m[3];
    // a transparent stop has no colour of its own, so blend toward the other one's
    const c = a[3] === 0 ? b : b[3] === 0 ? a : m;
    return ((Math.round(al * 255) << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0;
  });
  // returns draw(ctx, now, lights, ambient): lights are {x, y, r, k, cool?}; inside(x, y) limits the light to the room;
  // the overlay is recomputed a dozen times a second, not every frame
  function lighting(W, H, inside) {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d"), img = c.createImageData(W, H), px = new Uint32Array(img.data.buffer);
    const warm = ramp(WARM), cool = ramp(COOL);
    const mask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) mask[y * W + x] = !inside || inside(x, y) ? 1 : 0;
    let at = -1;
    return function (ctx, now, lights, amb) {
      if (now - at > 0.08 || now < at) {
        at = now;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (!mask[i]) { px[i] = 0; continue; }
          let w = 0, k = 0;
          for (let n = 0; n < lights.length; n++) {
            const l = lights[n], dx = x - l.x, dy = (y - l.y) * 1.35, d = (dx * dx + dy * dy) / (l.r * l.r);
            if (d < 1) { const f = (1 - d) * (1 - d) * l.k; if (l.cool) k += f; else w += f; }
          }
          px[i] = (k > w ? cool : warm)[Math.min(80, Math.round((amb + w + k) * 60))];
        }
        c.putImageData(img, 0, 0);
      }
      ctx.drawImage(cv, 0, 0);
    };
  }
  // the room's outline: back walls up to WH and the floor, for lighting()'s inside test
  function inRoom(st, NU, NV, WH) {
    const pts = [st.lwall(NV, 0), st.lwall(NV, WH), st.lwall(0, WH), st.rwall(NU, WH), st.rwall(NU, 0), st.iso(NU, NV)];
    return (x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
  }
  // a candle at a screen spot, its flame a little alive
  function candle(ctx, x, y, now, flick, tall) {
    const t = tall || 4, f = Math.floor(now * 9 + x) % 3;
    ctx.fillStyle = "#e8dcc0"; ctx.fillRect(x, y - t, 2, t); ctx.fillStyle = "#fff4dc"; ctx.fillRect(x, y - t, 1, t);
    ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x, y - t - 1, 1, 1);
    ctx.fillStyle = "#f8a830"; ctx.fillRect(x, y - t - 3, 2, 2);
    ctx.fillStyle = flick > 0.8 ? "#fffbe0" : "#ffe890"; ctx.fillRect(x + (f === 1 ? 1 : 0), y - t - 4 - (f === 2 ? 1 : 0), 1, 1 + (f === 0 ? 1 : 0));
  }
  function mugAt(ctx, x, y) {
    ctx.fillStyle = "#5a3a1e"; ctx.fillRect(x, y - 4, 3, 4); ctx.fillStyle = "#8a6a3a"; ctx.fillRect(x, y - 4, 1, 4);
    ctx.fillStyle = "#f4ecd8"; ctx.fillRect(x, y - 5, 3, 1); ctx.fillStyle = "#5a3a1e"; ctx.fillRect(x + 3, y - 3, 1, 2);
  }
  function table(ctx, st, u, v, du, dv, h, c) {
    legs(ctx, st, u, v, du, dv, h - 2, shade(c, -0.2));
    slab(ctx, st, u, v, du, dv, 2, { base: c, top: (x, y) => ((x + 2 * y) % 13 ? shade(c, 0.16) : shade(c, 0.04)) }, h - 2);
  }
  function stool(ctx, st, u, v, c) {
    legs(ctx, st, u, v, 0.35, 0.35, 4, c, 0.06);
    slab(ctx, st, u - 0.03, v - 0.03, 0.41, 0.41, 1.5, c, 4);
  }
  // a straw pallet with someone asleep under a blanket; returns where their snores rise from
  function pallet(ctx, st, u, v, du, dv, blanket, hair) {
    slab(ctx, st, u, v, du, dv, 3, { base: "#8a6a36", top: (x, y) => ((x * 3 + y * 5) % 7 < 2 ? "#a8883e" : (x + y) % 3 ? "#c4a452" : "#b4943e"), left: "#8a6a36", right: "#6e5228" });
    slab(ctx, st, u + 0.08, v + 0.18, 0.5, dv - 0.36, 2, { base: "#d0c4a4", top: "#ece2c8" }, 3);
    const [b0, b1] = blanket, quilt = (x, y) => (((x >> 1) + y) % 5 === 0 ? b0 : b1);
    slab(ctx, st, u + 0.55, v + 0.06, du - 0.6, dv - 0.12, 3, { base: b0, top: quilt, left: b0, right: shade(b0, -0.3) }, 3);
    slab(ctx, st, u + 0.75, v + 0.24, du - 1.25, dv - 0.48, 2, { base: b0, top: quilt, left: shade(b1, -0.1), right: shade(b0, -0.25) }, 6, false);
    slab(ctx, st, u + 0.55, v + 0.06, 0.18, dv - 0.12, 1, { base: "#e8dcc0", top: "#f2e8d0", left: "#d8ccb0", right: "#c8bca0" }, 6, false);
    const [hx, hy] = st.up(st.iso(u + 0.33, v + dv / 2), 6), x = Math.round(hx), y = Math.round(hy);
    ctx.fillStyle = shade(hair, -0.3); ctx.fillRect(x - 2, y - 3, 5, 4); ctx.fillStyle = hair; ctx.fillRect(x - 2, y - 4, 4, 4);
    ctx.fillStyle = "#d8a07a"; ctx.fillRect(x + 1, y - 2, 2, 3); ctx.fillStyle = "#b07a58"; ctx.fillRect(x + 1, y, 2, 1);
    return [x + 2, y - 6, (u * 1.7) % 3];
  }
  const ZED = ["xxxx", "..x.", ".x..", "xxxx"];
  function zzz(ctx, x, y, now) {
    for (let i = 0; i < 2; i++) {
      const t = ((now / 3.2) + i * 0.5) % 1;
      ctx.globalAlpha = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;
      const zx = Math.round(x + t * 6 + Math.sin(t * 7) * 1.5), zy = Math.round(y - t * 14);
      ZED.forEach((row, j) => { for (let k = 0; k < row.length; k++) if (row[k] === "x") { ctx.fillStyle = "#e8e2d4"; ctx.fillRect(zx + k, zy + j, 1, 1); } });
    }
    ctx.globalAlpha = 1;
  }

  // ---------- actors: a hero (or anyone with a look) and their pet, standing on the floor grid ----------
  function actor(h, u, v, opts) {
    const o = opts || {};
    const hs = Object.assign({}, h, { alive: true }, o.plain ? { weapon_tier: 1, armor_tier: 1 } : {});
    const g = Art.heroGrid(hs, 0, o.look || App.heroLook(hs));
    const pet = h.pet ? { g0: Art.petGrid(h.pet, 0), g1: Art.petGrid(h.pet, 1) } : null;
    return { h, name: o.name || h.name, lines: (o.lines || []).slice(), u, v, tu: u, tv: v, face: o.face || 1, mode: "idle", wait: o.wait || 1, mug: 0, said: [],
      right: g.toCanvas(1), left: g.flipX().toCanvas(1), cls: o.look || App.heroLook(hs), focus: !!o.focus, keeper: !!o.keeper,
      pet: pet && { name: h.pet.name, kind: h.pet.kind, lines: o.petLines || [], right: [pet.g0.toCanvas(1), pet.g1.toCanvas(1)], left: [pet.g0.flipX().toCanvas(1), pet.g1.flipX().toCanvas(1)],
        u: u - 0.6, v: v + 0.4, tu: u - 0.6, tv: v + 0.4, face: 1, pet: true, said: [] } };
  }
  // nameless townsfolk who fill a quiet common room; they never speak
  function local(r, u, v) {
    const p = (a) => a[Math.floor(r() * a.length)];
    const look = { skin: p(["#f0c8a0", "#e0b088", "#c48a5e", "#9a6440", "#6e4428"]), hair: p(["#3a2a1a", "#6a4020", "#c8a050", "#9a9aa6", "#2a2228", "#a04a20"]),
      style: Math.floor(r() * 6), face: Math.floor(r() * 3), fav: p(["#5a6a3a", "#3a5a8a", "#7a5a3a", "#6a3a3a", "#8a7a5a"]), scars: [] };
    const a = actor({ id: "local" + Math.floor(r() * 1e6), name: "A local", look, weapon: "none", weapon_tier: 1, armor_tier: 1 }, u, v,
      { name: "A local", look: { name: "local", look: { outfit: p(["vest", "leather", "cloak"]), head: "none", aura: null, offhand: "none" } } });
    a.local = true;
    return a;
  }
  function keeper(name, u, v) {
    const look = { skin: "#c98e62", hair: "#9a9aa6", style: 4, face: 2, fav: "#8a3a2a", scars: [] };
    return actor({ id: "barkeep", name, look, weapon: "none", weapon_tier: 1, armor_tier: 1 }, u, v,
      { name, keeper: true, look: { name: "barkeep", look: { outfit: "vest", head: "none", aura: null, offhand: "none" } } });
  }
  function step(a, dt, speed) {
    const du = a.tu - a.u, dv = a.tv - a.v, d = Math.hypot(du, dv);
    if (d < 0.05) return true;
    const s = Math.min(d, speed * dt);
    a.u += (du / d) * s; a.v += (dv / d) * s;
    const sx = du - dv;
    if (Math.abs(sx) > 0.02) a.face = sx > 0 ? 1 : -1;
    return false;
  }
  // the same figure with the hat, hood or helm off, for someone sitting up in bed
  function bare(a) {
    if (!a.bare) {
      const look = Object.assign({}, (a.cls || {}).look);
      if (!(window.Paint && Paint.MARKS.has(look.head))) look.head = "none";
      const g = Art.heroGrid(Object.assign({}, a.h, { alive: true }, a.h.kit ? { kit: Object.assign({}, a.h.kit, { head: null }) } : {}), 0, Object.assign({}, a.cls, { look }));
      a.bare = [g.toCanvas(1), g.flipX().toCanvas(1)];
    }
    return a.face > 0 ? a.bare[0] : a.bare[1];
  }
  // st.bed = { has(u, v), z, cut, fold, lie, pet }: the page's hero, idle in that bed, lies asleep under the covers (lie: Paint.sleeper's
  // quilt spec), breathing, and sits up bareheaded for a few seconds after a click (a.wake) to answer.
  // a.rest is the same shape for anyone on a bedroll at camp, plus pad (the roll, a canvas layer) and lie.awake for lying awake.
  function drawActor(ctx, st, a, bob, now) {
    const [x0, y0] = st.iso(a.u, a.v), x = Math.round(x0), y = Math.round(y0);
    const bed = st.bed && a.focus && a.mode === "idle" && st.bed.has(a.u, a.v) ? st.bed : a.rest && a.mode === "idle" ? a.rest : null;
    if (bed) {
      // tucked in for the night, so gather() never walks them off (it skips actors that stay)
      a.stay = true; a.abed = !a.rest;
      const t = now || 0, up = a.wake != null && t - a.wake < 4.5, ph = a.rest ? (a.u * 2.3 + a.v * 1.7) % 6 : 0;
      bed.awake = up;
      if (bed.pad) ctx.drawImage(bed.pad, 0, 0);
      if (bed.helm && !up) ctx.drawImage(bed.helm.cv, x - 12 - bed.helm.w / 2, y + 6 - bed.helm.foot);
      if (bed.lie && !up) {
        a.lie = a.lie || [0, 1].map((f) => Art.heroLying(a.h, f, a.cls, bed.lie).toCanvas(1));
        ctx.drawImage(a.lie[Math.sin(t * 1.7 + ph) > 0.35 ? 1 : 0], x - 18, y - bed.z - 24);
        if (!reduced() && !bed.lie.awake) zzz(ctx, x - 1, y - bed.z - 22, t + ph);
        return;
      }
      const img = bed.lie ? bare(a) : a.face > 0 ? a.right : a.left, top = y - bed.z - bed.cut;
      ctx.drawImage(img, 0, 0, img.width, bed.cut, x - 14, top, img.width, bed.cut);
      ctx.fillStyle = bed.fold; ctx.fillRect(x - 8, y - bed.z - 1, 16, 2);
      ctx.fillStyle = "rgba(255,248,230,0.5)"; ctx.fillRect(x - 8, y - bed.z - 1, 16, 1);
      return;
    }
    ctx.fillStyle = "rgba(20,10,4,0.35)";
    ctx.fillRect(x - 6, y - 1, 12, 2); ctx.fillRect(x - 4, y - 2, 8, 4);
    ctx.drawImage(a.face > 0 ? a.right : a.left, x - 14, y - 33 - bob);
    if (a.mug > 0) { const mx = x + (a.face > 0 ? 7 : -9), my = y - 15 - bob; ctx.fillStyle = "#c8a040"; ctx.fillRect(mx, my, 3, 4); ctx.fillStyle = "#f0e8d0"; ctx.fillRect(mx, my - 1, 3, 1); ctx.fillStyle = "#8a6020"; ctx.fillRect(mx + 3, my + 1, 1, 2); }
  }
  // the page's hero gets a small bobbing gold marker, like a game cursor; drawn last so no light or bars cover it
  function drawMarker(ctx, st, a, now) {
    const lie = a.rest && a.mode === "idle" && !(a.wake != null && now - a.wake < 4.5);
    const [x0, y0] = st.iso(a.u, a.v), x = Math.round(x0) - (lie ? 3 : 0), my = Math.round(y0) - (lie ? 31 : 40) - (Math.floor((now || 0) * 2.5) % 2);
    ctx.fillStyle = "#3a2410"; ctx.fillRect(x - 3, my - 1, 7, 1); ctx.fillRect(x - 3, my, 1, 1); ctx.fillRect(x + 3, my, 1, 1); ctx.fillRect(x - 2, my + 1, 1, 1); ctx.fillRect(x + 2, my + 1, 1, 1); ctx.fillRect(x - 1, my + 2, 1, 1); ctx.fillRect(x + 1, my + 2, 1, 1);
    ctx.fillStyle = "#f0c850"; ctx.fillRect(x - 2, my, 5, 1); ctx.fillRect(x - 1, my + 1, 3, 1); ctx.fillStyle = "#c8902a"; ctx.fillRect(x, my + 2, 1, 1);
  }
  // a click lands on a pet anywhere over its sprite (a wolf is bigger than a cat)
  function petHit(p, dx, dy) { const img = p.right[0]; return Math.abs(dx) < (img.width >> 1) + 1 && dy < 2 && dy > -img.height - 2; }
  const HEART = ["xx.xx", "xhxxx", ".xxx.", "..x.."];
  // a pet that was just clicked (p.pat = the time) hops, wags, and a few small hearts float up off it
  function drawPet(ctx, st, p, frame, now) {
    const lift = st.bed && st.bed.has(p.u, p.v) ? st.bed.z : 0;
    const [x0, y0] = st.iso(p.u, p.v), x = Math.round(x0), y = Math.round(y0) - lift, age = p.pat != null && now != null ? now - p.pat : 9;
    const hop = age < 0.45 ? Math.round(Math.sin((age / 0.45) * Math.PI) * 3) : 0, wag = age < 1 && Math.floor(age * 9) % 2 ? 1 : 0;
    const img = (p.face > 0 ? p.right : p.left)[wag ? 1 - frame : frame], hw = img.width >> 1, sw = Math.max(5, hw - 2);
    ctx.fillStyle = "rgba(20,10,4,0.3)"; ctx.fillRect(x - sw, y - 1, sw * 2, 2);
    // curled up by a sleeping owner: legs tucked under, belly on the ground, until a pat stands it up
    if (p.curl && age > 1.2) ctx.drawImage(img, 0, 0, img.width, img.height - 3, x - hw, y - img.height + 3, img.width, img.height - 3);
    else ctx.drawImage(img, x - hw, y - img.height - hop);
    for (let i = 0; i < 3; i++) {
      const t = age - i * 0.18;
      if (t < 0 || t > 0.95) continue;
      const hx = x - 3 + (i - 1) * 5 + Math.round(Math.sin(t * 12 + i * 2.1) * 1.2), hy = y - img.height - 4 - Math.round(t * 16) - (i === 1 ? 2 : 0);
      ctx.globalAlpha = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.4;
      HEART.forEach((row, j) => { for (let k = 0; k < 5; k++) if (row[k] !== ".") { ctx.fillStyle = row[k] === "h" ? "#ffc8c8" : j > 1 ? "#c8384a" : "#e8566a"; ctx.fillRect(hx + k, hy + j, 1, 1); } });
      ctx.globalAlpha = 1;
    }
  }
  function pick(a, r, pred) {
    const ok = a.lines.filter((t) => (pred ? pred(t) : !t.startsWith("One ")));
    if (!ok.length) return null;
    const fresh = ok.filter((t) => !a.said.includes(t)), src = fresh.length ? fresh : ok;
    const p = src[Math.floor(r() * src.length)];
    a.said = a.said.concat(p).slice(-Math.max(3, Math.floor(ok.length * 0.6)));
    return p;
  }

  // ---------- talking text (speech.js), anchored in CSS pixels over each speaker's head ----------
  function talk(wrap, cv, st) {
    if (!window.Speech) return { now: 0, say(a, t, s, done) { if (done) done(); }, speaking: () => false, count: 0, prune() {}, place() {}, clear() {} };
    return Speech.layer(wrap, (a) => {
      const k = cv.clientWidth / st.W, [x, y] = a.at || st.iso(a.u, a.v);
      const lift = a.at ? 0 : a.pet === true ? a.right[0].height + 2 : a.h && a.h.look && a.h.look.child ? 26 : 36;
      return [x * k, (y - lift) * k];
    });
  }

  // ---------- the loop: one rAF, stopped offscreen, in a hidden tab, once the scene leaves the page, and outright in static mode ----------
  // reduced(): hold still, for reduced motion or the Static scenes setting
  const reduced = () => (window.Settings ? Settings.calm() : !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches));
  function loop(wrap, tick, onVisible) {
    let raf = 0, last = 0, onscreen = true;
    const live = () => wrap.isConnected && onscreen && !document.hidden;
    function frame(t) {
      raf = 0;
      if (!live() || reduced()) return;
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      tick(dt);
      raf = requestAnimationFrame(frame);
    }
    function wake() { if (!reduced() && !raf && live()) { last = 0; raf = requestAnimationFrame(frame); } }
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => {
        onscreen = es[es.length - 1].isIntersecting;
        if (onVisible) onVisible(onscreen && wrap.isConnected);
        if (!wrap.isConnected) { io.disconnect(); return; }
        if (reduced() && onscreen) tick(0);
        wake();
      });
      io.observe(wrap);
    }
    const vis = () => { if (!wrap.isConnected) { document.removeEventListener("visibilitychange", vis); return; } wake(); };
    document.addEventListener("visibilitychange", vis);
    const unwatch = window.Settings ? Settings.watch((keys) => {
      if (!wrap.isConnected) { unwatch(); return; }
      if (!keys.includes("still") && !keys.includes("motion")) return;
      if (reduced()) { if (raf) { cancelAnimationFrame(raf); raf = 0; } tick(0); } else wake();
    }) : null;
    tick(0);
    wake();
    return { get still() { return reduced(); }, redraw: () => { if (reduced() || !raf) tick(0); } };
  }

  // ---------- the common room ----------
  const W = 198, H = 158, NU = 13, NV = 10, OX = 87, OY = 60, WH = 54;
  const BAR_V = 2.0, WALK = { u0: 0.9, u1: NU - 0.5, v0: 2.7, v1: NV - 0.4 };
  const TABLES = [[3.0, 5.6], [7.6, 4.4], [5.6, 8.0], [10.2, 7.2]];
  const FIRE = { v0: 4.8, v1: 7.0 };

  const TIMBER = "#3a2414";
  function room(st, r, opts) {
    const { iso, lwall, rwall, quad } = st;
    const cv = st.canvas(), ctx = cv.getContext("2d");
    ctx.fillStyle = "#1a120c"; ctx.fillRect(0, 0, W, H);
    // boarded walls: upright wainscot below a rail, wide horizontal boards above, a timber post every few tiles
    const wall = (side) => (x, y) => {
      const [a, h] = side === "l" ? st.onL(x, y) : st.onR(x, y), lt = side === "r";
      if (Math.abs(a / 3.4 - Math.round(a / 3.4)) < 0.05 && a > 0.5) return lt ? "#4a2e18" : "#3e2614";
      if (h < 14) {
        if (h > 12.5) return lt ? "#9a6436" : "#7e5230";
        return Math.abs(a * 2.4 - Math.round(a * 2.4)) < 0.07 ? (lt ? "#3e2616" : "#341f12") : (Math.floor(a * 2.4) % 2 ? (lt ? "#6a4224" : "#54341c") : (lt ? "#623c20" : "#4e301a"));
      }
      const row = Math.floor((h - 14) / 5), seam = (h - 14) % 5 < 1 || Math.abs(((a + row * 1.3) % 2.6)) < 0.04;
      if (seam) return lt ? "#4a2e1c" : "#3e2616";
      const n = Math.sin(row * 7.1 + Math.floor((a + row * 1.3) / 2.6) * 3.3);
      return lt ? (n > 0.3 ? "#7e5230" : n > -0.4 ? "#744a2a" : "#6c4426") : (n > 0.3 ? "#64401f" : n > -0.4 ? "#5c3a1e" : "#56361c");
    };
    fillPoly(ctx, [lwall(0, WH), lwall(NV, WH), iso(0, NV), iso(0, 0)], wall("l"));
    fillPoly(ctx, [rwall(0, WH), rwall(NU, WH), iso(NU, 0), iso(0, 0)], wall("r"));
    fillPoly(ctx, [lwall(0, WH), lwall(NV, WH), lwall(NV, WH - 4), lwall(0, WH - 4)], TIMBER);
    fillPoly(ctx, [rwall(0, WH), rwall(NU, WH), rwall(NU, WH - 4), rwall(0, WH - 4)], "#45291a");
    line(ctx, lwall(0, WH - 4), lwall(NV, WH - 4), "#5e3a1e"); line(ctx, rwall(0, WH - 4), rwall(NU, WH - 4), "#6e4424");
    fillPoly(ctx, [lwall(0, 2), lwall(NV, 2), iso(0, NV), iso(0, 0)], "rgba(0,0,0,0.25)");
    fillPoly(ctx, [rwall(0, 2), rwall(NU, 2), iso(NU, 0), iso(0, 0)], "rgba(0,0,0,0.2)");
    line(ctx, iso(0, 0), lwall(0, WH), "#2a180e");
    fillPoly(ctx, [iso(0, 0), iso(NU, 0), iso(NU, NV), iso(0, NV)], (x, y) => {
      const [u, v] = st.toUV(x, y);
      const row = Math.floor(v * 2), seam = Math.abs(v * 2 - Math.round(v * 2)) < 0.07, end = Math.abs(((u + row * 1.7) % 3) - 0) < 0.05;
      if (seam || end) return "#5a3820";
      if ((Math.floor(x * 3.1 + row * 5) % 23) === 0) return "#7a4c2a";
      return ["#8e5c34", "#83542f", "#895830"][((row % 3) + 3) % 3];
    });
    fillPoly(ctx, [iso(4.8, 4.8), iso(8.6, 4.8), iso(8.6, 7.4), iso(4.8, 7.4)], (x, y) => {
      const [u, v] = st.toUV(x, y);
      if (u < 4.95 || u > 8.45 || v < 4.95 || v > 7.25) return (Math.floor(u * 6) + Math.floor(v * 6)) % 2 ? "#d8c08a" : null;
      const edge = u < 5.1 || u > 8.3 || v < 5.1 || v > 7.1;
      if (edge) return "#c8a040";
      const du = Math.abs(u - 6.7), dv = Math.abs(v - 6.1);
      if (Math.abs(du + dv * 1.6 - 1.2) < 0.12) return "#d8b450";
      return du + dv * 1.6 < 1.2 ? ((Math.floor(u * 3) + Math.floor(v * 3)) % 2 ? "#3a5a4a" : "#34503f") : ((Math.floor(u * 2) + Math.floor(v * 2)) % 2 ? "#8a2a24" : "#7a2420");
    });
    const look = { curtain: ["#7a3a24", "#5a2818"], town: opts.town, weather: opts.town && weatherAt(opts.town) };
    opts.views = [windowR(ctx, st, r, 8.2, 10.2, 19, 41, true, look), windowR(ctx, st, r, 10.6, 12.5, 19, 41, false, look)].filter(Boolean);
    moonbeam(ctx, st, 8.2, 10.2, 2.6, NU); moonbeam(ctx, st, 10.6, 12.5, 2.6, NU);
    // shelves of bottles and crocks behind the bar
    for (const h of [24, 35]) {
      slab(ctx, st, 1.4, 0, 5.8, 0.3, 2, "#5a361c", h - 1);
      for (let u = 1.6; u < 7.0; u += 0.42) {
        const p = rwall(u, h + 1.5), x = Math.round(p[0]), y = Math.round(p[1]), k = r();
        if (k < 0.18) { ctx.fillStyle = "#b89a6a"; ctx.fillRect(x - 1, y - 4, 4, 4); ctx.fillStyle = "#d8c08a"; ctx.fillRect(x - 1, y - 4, 1, 4); ctx.fillStyle = "#6a4a2a"; ctx.fillRect(x - 1, y - 5, 4, 1); continue; }
        const col = ["#4e7a34", "#8a3a2a", "#c8a040", "#2e5a7a", "#d8d0c0", "#5a3a20"][Math.floor(r() * 6)], tall = 4 + Math.floor(r() * 3);
        ctx.fillStyle = shade(col, -0.3); ctx.fillRect(x, y - tall, 2, tall); ctx.fillStyle = col; ctx.fillRect(x, y - tall, 1, tall); ctx.fillRect(x, y - tall - 2, 1, 2);
        ctx.fillStyle = "rgba(255,248,220,0.45)"; ctx.fillRect(x, y - tall + 1, 1, 1);
      }
    }
    // a ham and bundles of drying herbs hung from the top beam over the bar
    for (const [u, len, ham] of [[2.2, 8, false], [3.4, 11, true], [5.4, 7, false], [6.5, 10, true]]) {
      const p = rwall(u, WH - 4), x = Math.round(p[0]), y = Math.round(p[1]);
      ctx.fillStyle = "#2a1a10"; ctx.fillRect(x, y, 1, len - 3);
      if (ham) {
        const hy = y + len - 3;
        ctx.fillStyle = "#6a3018"; ctx.fillRect(x - 2, hy + 1, 5, 6); ctx.fillRect(x - 1, hy + 7, 3, 1);
        ctx.fillStyle = "#9a4a2a"; ctx.fillRect(x - 1, hy + 1, 2, 5); ctx.fillStyle = "#c06a40"; ctx.fillRect(x - 1, hy + 2, 1, 2);
        ctx.fillStyle = "#e8dcc4"; ctx.fillRect(x, hy - 1, 1, 2);
      } else {
        const hy = y + len - 3;
        ctx.fillStyle = "#8a5a30"; ctx.fillRect(x - 1, hy, 3, 1);
        for (let i = -2; i <= 2; i++) { ctx.fillStyle = i % 2 ? "#5e6e34" : "#76863e"; ctx.fillRect(x + i, hy + 1, 1, 4 + (2 - Math.abs(i))); }
      }
    }
    hearth(ctx, st, r, FIRE.v0, FIRE.v1, WH);
    { const m = lwall(FIRE.v0 - 0.2, 32), x = Math.round(m[0]), y = Math.round(m[1]);
      ctx.fillStyle = "#8a6a3a"; ctx.fillRect(x - 3, y - 4, 3, 4); ctx.fillStyle = "#b08a4a"; ctx.fillRect(x - 3, y - 4, 1, 4);
      const n = lwall(FIRE.v1 - 0.3, 32); ctx.fillStyle = "#6a6a72"; ctx.fillRect(Math.round(n[0]) - 2, Math.round(n[1]) - 3, 4, 3); ctx.fillStyle = "#8a8a92"; ctx.fillRect(Math.round(n[0]) - 2, Math.round(n[1]) - 3, 4, 1);
      const s = lwall((FIRE.v0 + FIRE.v1) / 2, 40), sx = Math.round(s[0]), sy = Math.round(s[1]);
      ["x...x.x...x", ".x.x...x.x.", "..xx...xx..", "...xxxxx...", "....bbb....", "....bbb...."].forEach((row, j) => {
        for (let i = 0; i < row.length; i++) if (row[i] !== ".") { ctx.fillStyle = row[i] === "b" ? (j > 4 ? "#3e2412" : "#5a3418") : j < 2 ? "#f0e4c8" : "#d0bc98"; ctx.fillRect(sx - 5 + i, sy + j, 1, 1); }
      }); }
    if (opts.board) {
      fillPoly(ctx, quad(lwall, 1.3, 3.1, 22, 38), "#4a2c18");
      fillPoly(ctx, quad(lwall, 1.45, 2.95, 23.5, 36.5), "#c8a878");
      for (const [a, h0] of [[1.6, 34], [1.6, 31], [1.6, 28], [1.6, 25.5]]) fillPoly(ctx, quad(lwall, a, a + 0.9 + r() * 0.4, h0, h0 + 1), "#6e5a44");
      for (const [a, h0, c] of [[2.7, 34.5, "#a03028"], [2.2, 27, "#2a5aa0"]]) { const p = lwall(a, h0); ctx.fillStyle = c; ctx.fillRect(p[0], p[1], 2, 2); }
    } else {
      // a stair along the left wall, up to the door of the rooms
      fillPoly(ctx, quad(lwall, 0.15, 0.95, 36, 51), "#2a180e"); fillPoly(ctx, quad(lwall, 0.25, 0.85, 36, 50), "#6a4224");
      line(ctx, lwall(0.55, 36), lwall(0.55, 50), "#4e301a"); ctx.fillStyle = "#c8a040"; const kn = lwall(0.75, 43); ctx.fillRect(Math.round(kn[0]), Math.round(kn[1]), 1, 1);
      // open treads on a stringer, climbing toward the back corner to a landing
      const rail = (v) => 13 + (3.2 - v) / 2.4 * 32.4;
      line(ctx, st.up(st.iso(1.0, 3.3), 0), st.up(st.iso(1.0, 0.8), 34), "#3e2614");
      line(ctx, st.up(st.iso(1.0, 3.3), 1), st.up(st.iso(1.0, 0.8), 35), "#5e3a1e");
      for (let i = 5; i >= 0; i--) slab(ctx, st, 0, 3.2 - (i + 1) * 0.4, 1.0, 0.4, 2, { base: "#6a4224", top: "#9a6a3e" }, (i + 1) * 5.4 - 2);
      slab(ctx, st, 0, 0, 1.0, 0.8, 2, { base: "#6a4224", top: "#8a5a32" }, 34);
      const post = st.iso(1.0, 0.8); ctx.fillStyle = "#4a2c18"; ctx.fillRect(Math.round(post[0]) - 1, Math.round(post[1]) - 34, 2, 34);
      for (let v = 0.9; v < 3.3; v += 0.4) { const p = st.iso(1.0, v); ctx.fillStyle = "#3e2614"; ctx.fillRect(Math.round(p[0]) - 1, Math.round(p[1] - rail(v)), 1, 9); }
      line(ctx, st.up(st.iso(1.0, 3.25), rail(3.25)), st.up(st.iso(1.0, 0.8), rail(0.8)), "#9a6436");
      line(ctx, st.up(st.iso(1.0, 3.25), rail(3.25) - 1), st.up(st.iso(1.0, 0.8), rail(0.8) - 1), "#4e301a");
    }
    return cv;
  }

  // cfg: { seed, keeper: {name, lines}, cast: [{h, lines, focus, pet}], board, onVisible }
  function inn(cfg) {
    const r = Art.rng(Art.hash(cfg.seed || "tavern"));
    const st = stage(W, H, OX, OY);
    const wrap = document.createElement("div");
    wrap.className = "tavern";
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    wrap.appendChild(cv);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    // the town outside the windows: given, or wherever the page's hero is tonight
    const lookOut = { board: cfg.board, town: cfg.town || ((cfg.cast.find((c) => c.focus) || {}).h || {}).loc };
    const bg = room(st, r, lookOut);
    const keepLines = (cfg.keeper && cfg.keeper.lines) || ["Another one?"];

    const piece = (paint) => { const c = st.canvas(); paint(c.getContext("2d")); return c; };
    const furniture = [], candles = [], sleepers = [];
    // the bar front is panelled in half-tile frames
    const panels = (x, y) => {
      const u = (x + 0.5 - OX) / 8 + BAR_V, h = OY + (u + BAR_V) * 4 - y - 0.5, f = u * 2 - Math.floor(u * 2);
      if (f < 0.1 || h < 2.5 || h > 10.5) return "#6a4222";
      return f < 0.2 || h > 9.5 ? "#3a2212" : "#56361c";
    };
    for (let u = 1.2; u < 7.2; u += 1) furniture.push({ key: u + BAR_V + 0.4, cv: piece((c) => {
      slab(c, st, u, 1.2, 1, BAR_V - 1.2, 12, { base: "#5e3a1e", left: panels, right: "#3e2414" }, 0, false);
      slab(c, st, u, 1.1, 1, BAR_V - 1.1 + 0.12, 2, { base: "#8a5630", top: (x, y) => ((x + 2 * y) % 11 ? "#b07642" : "#a06a3a"), left: "#6a4024", right: "#5a3620" }, 12, false);
      line(c, st.up(st.iso(u, BAR_V + 0.12), 14), st.up(st.iso(u + 1, BAR_V + 0.12), 14), "#d49a5a");
      line(c, st.iso(u, BAR_V), st.iso(u + 1, BAR_V), "#24140a");
      if (u + 1 >= 7.2) { line(c, st.up(st.iso(u + 1, 1.1), 14), st.up(st.iso(u + 1, BAR_V + 0.12), 14), "#c08a50"); line(c, st.up(st.iso(u + 1, BAR_V + 0.12), 12), st.iso(u + 1, BAR_V), "#7a4a28"); }
      if (r() < 0.55) { const [x, y] = st.up(st.iso(u + 0.3 + r() * 0.4, 1.5), 14); mugAt(c, Math.round(x), Math.round(y)); }
      if (u > 5 && u < 6.5) { const [x, y] = st.up(st.iso(u + 0.5, 1.3), 14); barrel(c, Math.round(x), Math.round(y) + 1, 0.6); }
    }) });
    TABLES.forEach(([u, v], i) => {
      const lit = i !== 2;
      furniture.push({ key: u + v + 1.0, cv: piece((c) => {
        table(c, st, u, v, 1.0, 1.0, 9, "#8e5c34");
        const [x, y] = st.up(st.iso(u + 0.3, v + 0.65), 9); mugAt(c, Math.round(x), Math.round(y));
        if (i % 2) { const [px, py] = st.up(st.iso(u + 0.6, v + 0.3), 9); c.fillStyle = "#d8d0c0"; c.fillRect(Math.round(px) - 2, Math.round(py) - 1, 5, 2); c.fillStyle = "#a86a3a"; c.fillRect(Math.round(px) - 1, Math.round(py) - 2, 3, 1); }
      }), at: lit && st.up(st.iso(u + 0.55, v + 0.5), 9) });
      if (lit) candles.push(st.up(st.iso(u + 0.55, v + 0.5), 9));
      for (const [su, sv] of [[u + 0.35, v + 1.25], [u + 1.25, v + 0.35]]) furniture.push({ key: su + sv + 0.35, cv: piece((c) => stool(c, st, su, sv, "#7a4a28")) });
    });
    if (!cfg.board) {
      // tonight's bunks: straw pallets under the windows, a sleeper or two already snoring
      const sleeps = [[8.3, ["#6a3a2a", "#7e4632"], "#3a2a1a"], [10.6, ["#3e5a46", "#4a6a52"], "#a04a20"]];
      for (const [u, bl, hair] of sleeps) furniture.push({ key: u + 1.3, cv: piece((c) => sleepers.push(pallet(c, st, u, 0.25, 1.8, 1.0, bl, hair))) });
      furniture.push({ key: 7.7 + 0.6, cv: piece((c) => { const [x, y] = st.iso(7.75, 0.55); barrel(c, Math.round(x), Math.round(y)); }) });
    } else for (const [u, v] of [[11.7, 0.5], [12.4, 1.3]]) furniture.push({ key: u + v, cv: piece((c) => { const [x, y] = st.iso(u, v); barrel(c, Math.round(x), Math.round(y)); }) });
    const inside = inRoom(st, NU, NV, WH), shine = lighting(W, H, (x, y) => inside(x, y) && !lookOut.views.some((v) => v.glass(x, y))), fireAt = st.lwall((FIRE.v0 + FIRE.v1) / 2, 8);

    const actors = [];
    // real exchanges from league.voice.night_talk, each played once when its two heroes pair up
    const talks = (cfg.talks || []).slice();
    const talkFor = (a, b) => a.h && b.h && talks.find((ex) => { const ids = ex.map((l) => l.id); return ids.includes(a.h.id) && ids.includes(b.h.id); });
    function blocked(u, v) {
      return TABLES.some(([tu, tv]) => u > tu - 0.45 && u < tu + 1.45 && v > tv - 0.45 && v < tv + 1.45) || (u < 1.7 && v > FIRE.v0 - 0.3 && v < FIRE.v1 + 0.3 && u < 0.9);
    }
    // sprites are ~3 tiles wide on screen, so "free" means far enough apart in screen x as well as on the floor
    function crowded(u, v, ...skip) {
      return actors.some((b) => !skip.includes(b) && Math.abs((b.tu - b.tv) - (u - v)) * 8 < 18 && Math.abs((b.tu + b.tv) - (u + v)) * 4 < 22);
    }
    function freeSpot(...skip) {
      let best = null;
      for (let k = 0; k < 40; k++) {
        const u = WALK.u0 + r() * (WALK.u1 - WALK.u0), v = WALK.v0 + r() * (WALK.v1 - WALK.v0);
        if (blocked(u, v)) continue;
        if (!crowded(u, v, ...skip)) return [u, v];
        best = best || [u, v];
      }
      return best || [5, 3.5];
    }
    cfg.cast.slice(0, 14).forEach((c, i) => {
      const spot = c.focus ? [3.4 + r() * 0.6, 4.3 + r() * 0.4] : freeSpot();
      const a = actor(c.h, spot[0], spot[1], { lines: c.lines, focus: c.focus, plain: cfg.plain, petLines: c.pet, face: r() < 0.5 ? 1 : -1, wait: c.focus ? 6 + r() * 3 : 1 + r() * 5 + i * 0.4 });
      actors.push(a);
    });
    for (let i = actors.length; i < (cfg.locals || 0); i++) { const [u, v] = freeSpot(); const a = local(r, u, v); a.wait = 2 + r() * 6; a.face = r() < 0.5 ? 1 : -1; actors.push(a); }
    const keep = keeper((cfg.keeper && cfg.keeper.name) || "The barkeep", 3.5, 0.6);
    keep.wait = 2;
    const focus = actors.find((a) => a.focus);

    const T = talk(wrap, cv, st);
    const say = (a, text, secs) => T.say(a, text, secs);
    function go(a, u, v) { a.tu = u; a.tv = v; a.mode = "walk"; }
    function roomAt(gen, ...skip) {
      for (let k = 0; k < 10; k++) { const [u, v] = gen(); if (!crowded(u, v, ...skip)) return [u, v]; }
      return null;
    }
    const later = (ms, fn) => setTimeout(() => { if (wrap.isConnected) fn(); }, ms);
    function choose(a) {
      const roll = r();
      a.tu = a.u; a.tv = a.v;
      const bar = roll >= 0.28 && roll < 0.52 ? roomAt(() => [1.5 + r() * 5.4, BAR_V + 0.6 + r() * 0.2], a) : null;
      if (a.local && roll >= 0.64) { a.wait = 3 + r() * 4; return; }
      const fire = roll >= 0.52 && roll < 0.64 ? roomAt(() => [1.0 + r() * 0.6, FIRE.v0 + r() * (FIRE.v1 - FIRE.v0)], a) : null;
      if ((roll >= 0.28 && roll < 0.64) && !bar && !fire) { const [u, v] = freeSpot(a); go(a, u, v); a.then = () => { a.wait = 2 + r() * 3; }; return; }
      if (roll < 0.28) { const [u, v] = freeSpot(a); go(a, u, v); a.then = () => { a.wait = 1.5 + r() * 3; }; }
      else if (roll < 0.52) {
        go(a, bar[0], bar[1]);
        a.then = () => {
          a.face = 1;
          T.say(a, pick(a, r, (t) => t.startsWith("One ")), 2.6, () => later(250, () => { if (!a.local || r() < 0.3) say(keep, r() < 0.5 ? "Coming up." : keepLines[Math.floor(r() * keepLines.length)], 2.6); a.mug = 30; }));
          a.wait = 4;
        };
      } else if (roll < 0.64) { go(a, fire[0], fire[1]); a.then = () => { a.face = -1; a.wait = 4 + r() * 4; if (a.focus) later(800, () => say(a, pick(a, r))); }; }
      else {
        const free = actors.filter((b) => b !== a && !b.local && b.mode !== "chat" && b.mode !== "join");
        // someone a real conversation is waiting with comes first
        const owed = free.filter((b) => talkFor(a, b));
        const other = owed.length ? owed[Math.floor(r() * owed.length)] : free[Math.floor(r() * free.length)];
        if (!other) { a.wait = 2; if (a.focus && !T.speaking(a)) say(a, pick(a, r)); return; }
        // a pair needs two free places side by side on screen, not one in front of the other
        const pair = roomAt(() => freeSpot(a, other), a, other);
        if (!pair) { a.wait = 2; return; }
        const [u, v] = pair, side = u + 1.4 <= WALK.u1 && v - 1.4 >= WALK.v0 ? 1.4 : -1.4;
        const ou = Math.max(WALK.u0, Math.min(WALK.u1, u + side)), ov = Math.max(WALK.v0, Math.min(WALK.v1, v - side));
        if (crowded(ou, ov, a, other)) { a.wait = 2; return; }
        go(a, u, v); other.partner = a;
        go(other, ou, ov); other.mode = "join";
        a.then = () => {
          a.mode = "chat"; a.partner = other;
          const ex = talkFor(a, other);
          const turns = ex ? ex.map((l) => [l.id === a.h.id ? a : other, l.text]) : [a, other, a, other].slice(0, 2 + Math.floor(r() * 3)).map((s) => [s, null]);
          if (ex) talks.splice(talks.indexOf(ex), 1);
          // each turn waits for the last to be said, so a fast talker and a slow one still take turns
          const next = (i) => {
            if (i >= turns.length) { a.mode = "idle"; a.wait = 1 + r() * 2; other.mode = "idle"; other.wait = 1 + r() * 2; return; }
            const [s, t] = turns[i];
            T.say(s, t || pick(s, r), 3.2, () => later(450, () => next(i + 1)));
          };
          later(300, () => next(0));
          a.wait = 1;
        };
      }
    }

    let soloAt = 1.2, petAt = 9 + r() * 6;
    function update(dt) {
      T.now += dt;
      const now = T.now;
      for (const a of actors) {
        if (a.mug > 0) a.mug -= dt;
        if (a.mode === "walk" || a.mode === "join") {
          if (step(a, dt, 1.3)) {
            if (a.mode === "join") { a.mode = "chat"; if (a.partner) a.face = a.partner.u - a.partner.v > a.u - a.v ? 1 : -1; }
            else { a.mode = "idle"; const t = a.then; a.then = null; if (t) t(); }
            if (a.partner && a.mode === "chat") a.partner.face = a.u - a.v > a.partner.u - a.partner.v ? 1 : -1;
          }
        } else if (a.mode === "idle") {
          a.wait -= dt;
          if (a.wait <= 0) choose(a);
        }
        if (a.pet) {
          const p = a.pet;
          p.tu = a.u - 0.55 * a.face; p.tv = a.v + 0.45;
          p.moving = !step(p, dt, 1.8);
          p.face = a.face;
        }
      }
      // the page's hero talks more than anyone, so the day's news gets heard
      if (focus && now > soloAt && focus.mode !== "chat" && !T.speaking(focus)) { say(focus, pick(focus, r)); soloAt = now + 6 + r() * 5; }
      if (now > petAt) {
        const owners = actors.filter((a) => a.pet && a.pet.lines.length);
        const o = owners.find((a) => a.focus) && r() < 0.6 ? owners.find((a) => a.focus) : owners[Math.floor(r() * owners.length)];
        if (o) say(o.pet, pick(o.pet, r, () => true), 2.2);
        petAt = now + 12 + r() * 10;
      }
      keep.wait -= dt;
      step(keep, dt, 0.7);
      if (keep.wait <= 0) {
        keep.tu = 1.6 + r() * 5.2; keep.wait = 4 + r() * 6;
        if (r() < 0.35) say(keep, keepLines[Math.floor(r() * keepLines.length)], 3);
      }
      T.prune();
    }

    function draw() {
      const now = T.now, still = reduced();
      ctx.drawImage(bg, 0, 0);
      for (const v of lookOut.views) v.draw(ctx, now, still);
      const flick = 0.75 + Math.sin(now * 13) * 0.08 + Math.sin(now * 7.3) * 0.08;
      flames(ctx, st, now, FIRE.v0, FIRE.v1, flick, 1, true);
      const things = furniture.map((f) => ({ key: f.key, draw: () => { ctx.drawImage(f.cv, 0, 0); if (f.at) candle(ctx, Math.round(f.at[0]), Math.round(f.at[1]), now, flick, 3); } }));
      const bob = (a) => ((a.mode === "walk" || a.mode === "join") && !still ? Math.floor(now * 6 + a.u * 3) % 2 : 0);
      for (const a of actors) {
        things.push({ key: a.u + a.v, draw: () => drawActor(ctx, st, a, bob(a), now) });
        if (a.pet) things.push({ key: a.pet.u + a.pet.v, draw: () => drawPet(ctx, st, a.pet, a.pet.moving && !still ? Math.floor(now * 6) % 2 : 0, now) });
      }
      things.push({ key: keep.u + keep.v, draw: () => drawActor(ctx, st, keep, 0, now) });
      things.sort((p, q) => p.key - q.key).forEach((t) => t.draw());
      const lights = [{ x: fireAt[0] + 14, y: fireAt[1] + 4, r: 84, k: 0.62 + flick * 0.35 }];
      for (const [lu, lv] of [[3.6, 4.0], [8.8, 6.8]]) {
        lantern(ctx, st, lu, lv, flick, 62, true);
        const [x, y] = st.iso(lu, lv); lights.push({ x, y: y - 50, r: 62, k: 0.5 + flick * 0.1 });
      }
      for (const [x, y] of candles) lights.push({ x, y: y - 5, r: 26, k: 0.5 + flick * 0.12 });
      for (const a of [9.2, 11.5]) { const [x, y] = st.rwall(a, 26); lights.push({ x, y: y + 10, r: 30, k: 0.5, cool: true }); }
      shine(ctx, now, lights, 0.42);
      if (!still) for (const z of sleepers) zzz(ctx, z[0], z[1], now + z[2]);
      if (focus) drawMarker(ctx, st, focus, now);
      T.place();
    }
    const L = loop(wrap, (dt) => { if (dt) update(dt); draw(); }, cfg.onVisible);
    if (reduced() && focus) { say(focus, focus.lines[0], 999); L.redraw(); }
    cv.addEventListener("click", (ev) => {
      const still = reduced();
      const k = cv.clientWidth / W, rect = cv.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) / k, my = (ev.clientY - rect.top) / k;
      const hit = actors.filter((a) => !a.local).concat([keep]).filter((a) => { const [x, y] = st.iso(a.u, a.v); return Math.abs(mx - x) < 9 && my < y && my > y - 34; })
        .sort((p, q) => q.u + q.v - (p.u + p.v))[0];
      const pet = !hit && actors.map((a) => a.pet).find((p) => { if (!p) return false; const [x, y] = st.iso(p.u, p.v); return petHit(p, mx - x, my - y); });
      if (hit) say(hit, hit.keeper ? keepLines[Math.floor(r() * keepLines.length)] : pick(hit, r), still ? 999 : 3);
      else if (pet) { pet.pat = T.now; say(pet, window.Speech ? Speech.pat(pet) : pick(pet, r, () => true), still ? 999 : 2.2); }
      L.redraw();
    });
    // for review pages (tools/dialogue_demo.html) that stage a scripted scene in the real room
    wrap.stage = { actors, keeper: keep, talk: T, redraw: L.redraw };
    return wrap;
  }

  function scene(L) {
    const tav = L.tavern || { name: "The tavern", barkeep: "The barkeep", lines: ["Another one?"] };
    const pending = L.pending.filter((h) => !h.npc).concat(L.pending.filter((h) => h.npc));
    return inn({ seed: L.meta.name + "tavern", board: true, plain: true, keeper: { name: tav.barkeep, lines: tav.lines },
      cast: pending.map((h) => ({ h, lines: h.chatter || [] })) });
  }

  window.Tavern = { scene, inn, stage, reduced, fillPoly, actor, keeper, local, step, drawActor, drawMarker, drawPet, petHit, pick, talk, loop, windowR, moonbeam, hearth, flames, lantern, barrel,
    shade, line, slab, legs, table, stool, pallet, zzz, mugAt, candle, lighting, inRoom, weatherAt };
})();
