/* Full-art scenes (#/fall/<fight id>): a megabeast's last moment in the town it fell in, painted large in lit layers that drift, from the real fight (its heroes, the killing blow). */
(function () {
  "use strict";
  const A = App;
  const { L, S, el } = A;
  const W = 480, H = 270, M = 10, GY = 228;
  const R = Math.round;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const rgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const mixC = (a, b, k) => { const p = rgb(a), q = rgb(b); return "#" + p.map((v, i) => R(v + (q[i] - v) * k).toString(16).padStart(2, "0")).join(""); };
  const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

  // each town's houses by night: plaster, the frame's beams, and two roofs (thatch or tile) from its header's look
  const STYLE = {
    thornwall: { wall: "#f0d8a0", beam: "#5a3a22", roofs: [["#e0b45a", "#a87a34"], ["#c8643a", "#8a3a22"]], stall: ["#c8463a", "#5a8ac0"] },
    ironhaven: { wall: "#b8b0a8", beam: "#3a3440", roofs: [["#6a5a6a", "#3e3446"], ["#a83a32", "#6a2420"]], stall: ["#b83a32", "#e8b84a"] },
    veldrock: { wall: "#a8a49c", beam: "#3a3a40", roofs: [["#5e646e", "#3a3e46"], ["#8a5a3a", "#5a3a24"]], stall: ["#b8602a", "#5e646e"] },
    carrbridge: { wall: "#e8e0d0", beam: "#3a3a4a", roofs: [["#3a6a9a", "#22425e"], ["#b86a3a", "#7a4024"]], stall: ["#3a7ab8", "#6a9a3a"] },
    ashfen: { wall: "#c8c4a8", beam: "#3a3a2a", roofs: [["#8a8a5a", "#5a5a3a"], ["#6a7a6a", "#3e4a42"]], stall: ["#4a6a62", "#f0b44a"] },
    hollowood: { wall: "#c8b48a", beam: "#3a2a1a", roofs: [["#5a7a3a", "#36502a"], ["#9a7a4a", "#6a4a2a"]], stall: ["#3a6a34", "#d8b45a"] },
    saltmarrow: { wall: "#f0ece0", beam: "#2a3a4a", roofs: [["#2a6aa8", "#1a4270"], ["#d84a3a", "#8a2a22"]], stall: ["#2a6aa8", "#d84a3a"] },
    frosthold: { wall: "#d8d0c0", beam: "#3a2a1e", roofs: [["#8a5a34", "#5a3a20"], ["#6a7a8a", "#3e4a5a"]], stall: ["#4a7ab0", "#8a5a34"] },
  };

  function layer(w, h) { const c = document.createElement("canvas"); c.width = w || W + M * 2; c.height = h || H; return c; }
  function kit(cv) {
    const g = cv.getContext("2d");
    const F = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(R(x), R(y), R(w), R(h)); };
    const P = (x, y, c) => F(x, y, 1, 1, c);
    const ell = (cx, cy, rx, ry, c) => { for (let y = -ry; y <= ry; y++) { const w = R(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); F(cx - w, cy + y, w * 2 + 1, 1, c); } };
    const tri = (x, y, w, h, c) => { for (let i = 0; i < h; i++) { const k = (i + 1) / h; F(x + (w / 2) * (1 - k), y + i, w * k, 1, c); } };
    const dgrad = (y0, y1, cols) => {
      for (let y = y0; y < y1; y++) for (let x = 0; x < cv.width; x++) {
        const t = ((y - y0) / Math.max(1, y1 - y0)) * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(t));
        P(x, y, t - i > bay(x, y) ? cols[i + 1] : cols[i]);
      }
    };
    const soft = (cx, cy, rx, ry, c, a) => {
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        const d = Math.hypot(x / rx, y / ry);
        if (d < 1 && (1 - d) * 2.2 * (a || 1) > bay(R(cx + x), R(cy + y))) P(cx + x, cy + y, c);
      }
    };
    return { g, F, P, ell, tri, dgrad, soft };
  }

  // the light pass: flat colours lit by the night (ambient) and every fire and the blow's light, banded and dithered like paint
  function light(cv, lights, amb) {
    const g = cv.getContext("2d"), im = g.getImageData(0, 0, cv.width, cv.height), d = im.data;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const i = (y * cv.width + x) * 4;
      // a see-through aura glows by itself: darkening it would leave a box round the hero
      if (d[i + 3] < 160) continue;
      let r = amb[0], gg = amb[1], b = amb[2];
      const sx = x, th = bay(x, y);
      for (const L0 of lights) {
        const dx = L0.line ? Math.max(0, Math.abs(sx - L0.x) - L0.w) : sx - L0.x, dy = L0.line ? Math.max(0, y - L0.y1) : (y - L0.y) * (L0.flat || 1);
        const dist = Math.hypot(dx, dy);
        if (dist >= L0.r) continue;
        const f = Math.floor(Math.pow(1 - dist / L0.r, L0.p || 1.6) * 8 + th) / 8;
        r += L0.c[0] * f * L0.i; gg += L0.c[1] * f * L0.i; b += L0.c[2] * f * L0.i;
      }
      d[i] = Math.min(255, d[i] * r); d[i + 1] = Math.min(255, d[i + 1] * gg); d[i + 2] = Math.min(255, d[i + 2] * b);
    }
    g.putImageData(im, 0, 0);
    return cv;
  }
  // distance: a figure further back takes on the colour of the smoky air between it and us
  function haze(cv, col, a) {
    const g = cv.getContext("2d"), im = g.getImageData(0, 0, cv.width, cv.height), d = im.data, c = rgb(col);
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) for (let k = 0; k < 3; k++) d[i + k] = R(d[i + k] + (c[k] - d[i + k]) * a);
    g.putImageData(im, 0, 0);
    return cv;
  }
  // an edge lit from one side: opaque pixels with open air toward the light take its colour
  function rim(cv, side, col, a) {
    const g = cv.getContext("2d"), im = g.getImageData(0, 0, cv.width, cv.height), d = im.data, w = cv.width, c = rgb(col);
    // a class's aura is see-through: only solid pixels catch the light, and only against open air
    const open = (x, y) => x < 0 || y < 0 || x >= w || y >= cv.height || d[(y * w + x) * 4 + 3] < 160;
    const hits = [];
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] >= 160 && (open(x + side, y) || (side > 0 && open(x, y - 1) && open(x + 1, y - 1)))) hits.push((y * w + x) * 4);
    for (const i of hits) for (let k = 0; k < 3; k++) d[i + k] = R(d[i + k] + (c[k] - d[i + k]) * a);
    g.putImageData(im, 0, 0);
    return cv;
  }

  // ---------- the town: sky, far roofs, the burning street ----------
  function sky() {
    const cv = layer(W, H), k = kit(cv);
    k.dgrad(0, 160, ["#0c0a16", "#161024", "#2a1428", "#4a1c26", "#7a2a22", "#b0482a"]);
    const r = rng(7);
    for (let i = 0; i < 40; i++) { const x = R(r() * W), y = R(r() * 60); if (r() < 0.6) k.P(x, y, i % 5 ? "#5a5470" : "#a8a0c0"); }
    // the smoke shelf over the town, its belly lit by the fires underneath
    for (let i = 0; i < 30; i++) {
      const x = R(r() * (W + 40)) - 20, y = 30 + R(r() * 80), rx = 26 + R(r() * 44), ry = 8 + R(r() * 12), lit = y > 66;
      k.soft(x, y, rx, ry, lit ? "#341a22" : "#1a1222", 0.9);
      if (lit) { k.soft(x + 3, y + ry * 0.55, rx * 0.7, ry * 0.35, "#5a2626", 0.8); k.soft(x + 5, y + ry * 0.8, rx * 0.45, 2, "#8a3e2a", 0.7); }
    }
    // the moon through a gap in the smoke
    k.soft(78, 32, 26, 22, "#2e2438", 0.8); k.soft(78, 32, 19, 17, "#3e3446", 0.9);
    k.ell(78, 32, 12, 12, "#c8c0a8"); k.ell(80, 30, 10, 10, "#e4dcc4"); k.ell(82, 29, 6, 6, "#f2ecd8"); k.ell(74, 29, 2, 2, "#cec6ae");
    return cv;
  }

  function house(k, o) {
    const { x, g, w, wh, rh, st, roof } = o, top = g - wh;
    k.F(x - 1, top - 1, w + 2, wh + 1, "#1a120c");
    for (let y = 0; y < wh; y++) for (let i = 0; i < w; i++) {
      const n = ((i * 13 + y * 7) % 11) / 11, dark = y / wh * 0.22 + (n > 0.82 ? 0.08 : 0) + (i * 3 + y * 5) % 17 === 0 ? 0.12 : y / wh * 0.22;
      k.P(x + i, top + y, mixC(st.wall, "#2a1a14", dark));
    }
    k.F(x, top, w, 2, st.beam); k.F(x, g - 2, w, 2, st.beam); k.F(x, top, 2, wh, st.beam); k.F(x + w - 2, top, 2, wh, st.beam);
    if (wh > 30) k.F(x, top + R(wh / 2), w, 2, st.beam);
    for (let i = 1; i < 3; i++) { const bx = x + R((w * i) / 3); k.F(bx - 1, top, 2, wh, st.beam); }
    for (let i = 0; i < 2; i++) { const by = top + (i ? R(wh / 2) + 2 : 2); for (let j = 0; j < R(wh / 2) - 4; j++) k.P(x + 3 + j, by + j, st.beam); }
    const wins = o.wins || [];
    for (const [wx, wy] of wins) { k.F(x + wx - 1, top + wy - 1, 8, 9, "#1a120c"); k.F(x + wx, top + wy, 6, 7, "#ffcf6a"); k.F(x + wx + 2, top + wy, 1, 7, st.beam); k.F(x + wx, top + wy + 3, 6, 1, st.beam); }
    if (o.door) { k.F(x + o.door - 1, g - 17, 10, 17, "#1a120c"); k.F(x + o.door, g - 16, 8, 16, "#5a3018"); k.F(x + o.door + 3, g - 16, 1, 16, "#3a2010"); }
    for (let y = 0; y < 4; y++) for (let i = 0; i < w; i++) if (y < 2 || bay(i, y) < 0.5) k.P(x + i, top + y, "#1a120c");
    const [r0, r1] = roof;
    for (let i = 0; i < rh; i++) {
      const kx = (i + 1) / rh, hw = (w / 2 + 5) * kx, cx = x + w / 2;
      k.F(cx - hw - 1, top - rh + i, hw * 2 + 2, 1, "#1a120c");
      for (let j = 0; j < hw * 2; j++) k.P(cx - hw + j, top - rh + i, (i % 3 === 0 && (j + i) % 4 !== 0) || (j * 7 + i * 3) % 13 === 0 ? r1 : j < hw * 0.4 ? mixC(r0, "#ffffff", 0.12) : r0);
      if (o.broken) for (let j = 0; j < hw * 2; j += 9) if ((j + i * 5) % 17 < 5 && i > 3) k.F(cx - hw + j, top - rh + i, 4, 1, "#1a0e0a");
    }
    return { roofTop: top - rh, cx: x + w / 2, top };
  }

  function far(st) {
    const cv = layer(), k = kit(cv), r = rng(3), G = 176;
    k.F(0, G - 4, cv.width, H - G + 4, "#4a3a32");
    // the town wall and its gate tower
    for (let x = 0; x < cv.width; x++) { const cren = x % 10 < 6 ? 0 : 3; k.F(x, G - 22 + cren, 1, 22 - cren, x % 10 === 0 ? "#3a2c26" : "#56463c"); }
    for (const [x, w, h] of [[30, 34, 48], [118, 26, 40], [214, 40, 56], [300, 30, 42], [352, 26, 36], [430, 40, 50]]) {
      const top = G - 22 - h;
      k.F(x, top, w, h, mixC(st.wall, "#40303a", 0.45));
      for (let i = 0; i < h; i += 7) k.F(x, top + i, w, 1, mixC(st.beam, "#40303a", 0.3));
      k.tri(x - 4, top - 14, w + 8, 14, mixC(st.roofs[(x >> 4) & 1][1], "#40303a", 0.35));
      for (let i = 0; i < 3; i++) if (r() < 0.7) k.F(x + 5 + i * 9, top + 8, 4, 5, "#ffb850");
    }
    // the guild hall's leaning tower and the windmill on the rise behind
    const tx = 254, lean = 0.18;
    for (let y = 60; y < G - 22; y++) k.F(tx + R((G - y) * lean * 0.3), y, 16, 1, mixC(st.wall, "#40303a", 0.4));
    k.tri(tx - 3 + 18, 44, 22, 17, mixC(st.roofs[1][0], "#40303a", 0.3)); k.F(tx + 27, 32, 1, 12, "#2a1e18"); k.F(tx + 28, 32, 7, 4, "#c8463a");
    k.F(tx + 6 + 9, 84, 5, 7, "#ffb850");
    const mx = 396; k.F(mx, 96, 10, 34, mixC(st.wall, "#40303a", 0.5)); k.tri(mx - 2, 88, 14, 8, "#3a2c26");
    for (const [dx, dy] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) for (let i = 0; i < 16; i++) k.F(mx + 5 + (dx * i) / 16, 92 + (dy * i) / 16, 3, 2, "#5a4a3e");
    return cv;
  }

  function mid(st) {
    const cv = layer(), k = kit(cv), r = rng(11), fires = [];
    k.F(0, GY - 30, cv.width, H - GY + 30, "#3a2e28");
    for (let y = GY - 28, row = 0; y < H; row++) {
      const rh = 2 + Math.floor((y - GY + 28) / 14);
      for (let x = -R(r() * 6); x < cv.width; ) {
        const sw = rh * 2 + R(r() * rh * 1.5), base = ["#6e5a4a", "#76604e", "#665446", "#7c6854", "#5e4c40"][R(r() * 4)];
        k.F(x + 1, y, sw - 1, rh, base); k.F(x + 1, y, sw - 2, 1, mixC(base, "#ffffff", 0.18)); k.P(x + 1, y + rh - 1, mixC(base, "#000000", 0.2));
        x += sw;
      }
      y += rh + 1;
    }
    const L0 = house(k, { x: -4, g: GY - 20, w: 92, wh: 62, rh: 34, st, roof: st.roofs[0], wins: [[12, 10], [44, 10], [70, 36]], door: 26, broken: true });
    fires.push({ x: L0.cx - 30, y: L0.roofTop + 18, w: 58, h: 30 }, { x: 74, y: L0.top + 36, w: 8, h: 10 });
    const L1 = house(k, { x: 96, g: GY - 22, w: 46, wh: 40, rh: 22, st, roof: st.roofs[1], wins: [[8, 8], [28, 8]] });
    fires.push({ x: L1.cx - 8, y: L1.roofTop + 10, w: 22, h: 18 });
    const R0 = house(k, { x: 404, g: GY - 18, w: 96, wh: 70, rh: 34, st, roof: st.roofs[0], wins: [[14, 12], [50, 12], [74, 40]], door: 56, broken: true });
    fires.push({ x: R0.cx - 34, y: R0.roofTop + 14, w: 70, h: 36 });
    // the market: torn striped awnings on snapped poles, the crates kicked over, the cabbages everywhere
    for (const [x, c, tilt] of [[168, st.stall[0], 4], [372, st.stall[1], -5]]) {
      k.F(x, GY - 34, 2, 30, "#3a2618"); k.F(x + 30, GY - 30 + tilt, 2, 26 - tilt, "#3a2618");
      for (let j = 0; j < 34; j++) { const y = GY - 36 + R((j / 34) * tilt); k.F(x - 1 + j, y, 1, 4, Math.floor(j / 3) % 2 ? "#f0e6d0" : c); if (j % 5 < 3) k.P(x - 1 + j, y + 4 + (j % 3), Math.floor(j / 3) % 2 ? "#f0e6d0" : c); }
      k.F(x + 2, GY - 12, 26, 3, "#7a4a24"); k.F(x + 4, GY - 9, 2, 6, "#3a2618"); k.F(x + 24, GY - 9, 2, 6, "#3a2618");
    }
    fires.push({ x: 384, y: GY - 34, w: 14, h: 12 });
    for (let i = 0; i < 26; i++) { const x = R(r() * cv.width), y = GY - 4 + R(r() * 30); k.ell(x, y, 2, 1, ["#6a9a3a", "#c83a2a", "#e8a03a", "#8ab43a"][i % 4]); k.P(x - 1, y - 1, "#e8f0c0"); }
    for (const [x, y] of [[40, GY + 18], [120, GY + 24], [440, GY + 20]]) { k.F(x, y - 7, 12, 8, "#1a120c"); k.F(x + 1, y - 6, 10, 6, "#8a5a30"); k.F(x + 1, y - 3, 10, 1, "#5a3a20"); }
    return { cv, fires };
  }

  function near() {
    const cv = layer(W + M * 4, H), k = kit(cv);
    // dark rubble and a cart wheel along the bottom edge, nearer than anyone in the scene
    for (let x = 0; x < cv.width; x += 3) { const h = 6 + R(4 * Math.sin(x / 9) + 3 * Math.sin(x / 23)); k.F(x, H - h, 3, h, "#120c0a"); }
    k.ell(470, H - 6, 18, 18, "#120c0a"); k.ell(470, H - 6, 15, 15, "#2a1a12"); k.ell(470, H - 6, 12, 12, "#120c0a");
    for (let a = 0; a < 8; a++) { const t = (a / 8) * Math.PI * 2; for (let i = 0; i < 12; i++) k.P(470 + R(Math.cos(t) * i), H - 6 + R(Math.sin(t) * i), "#2a1a12"); }
    k.F(20, H - 22, 40, 4, "#120c0a"); k.F(30, H - 30, 4, 12, "#120c0a");
    return cv;
  }

  // ---------- the heroes, painted large ----------
  // a figure is painted in shaded volumes (heads and limbs lit as round, cloth in folds) from the hero's own look and kit,
  // in an action pose chosen by what they fought with, then lit by the scene like everything else
  const KEY = (() => { const v = [0.55, -0.5, 0.67], n = Math.hypot(...v); return v.map((x) => x / n); })();
  function ramp5(c) { return [mixC(c, "#140c1a", 0.62), mixC(c, "#24162a", 0.32), c, mixC(c, "#fff0c8", 0.22), mixC(c, "#fffaec", 0.48)]; }
  function canvasBuf(w, h) {
    const px = new Array(w * h).fill(null), glow = [];
    const tone = (rp, s, x, y) => { const t = Math.max(0, Math.min(3.999, (s + 0.45) * 2.6)), i = Math.floor(t), fr = t - i; return rp[Math.min(4, i + (fr > 0.62 || (fr > 0.38 && bay(x, y) < (fr - 0.38) / 0.24) ? 1 : 0))]; };
    const put = (x, y, c) => { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = c; };
    const ell = (cx, cy, rx, ry, col, o) => {
      o = o || {}; const rp = ramp5(col);
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
        if (d > 1 || (o.clip && !o.clip(x, y))) continue;
        const nz = Math.sqrt(1 - d), s = nx * KEY[0] + ny * KEY[1] + nz * KEY[2] + (o.lift || 0) + (o.tex ? o.tex(x, y) : 0);
        put(x, y, d > 1 - 2.2 / Math.max(2, Math.min(rx, ry)) && s < 0.25 ? rp[0] : tone(rp, s, x, y));
      }
    };
    const cap = (x0, y0, x1, y1, r0, r1, col, o) => {
      o = o || {}; const rp = ramp5(col), dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, len = Math.sqrt(L2), m = Math.max(r0, r1);
      const nx0 = -dy / len, ny0 = dx / len;
      for (let y = Math.floor(Math.min(y0, y1) - m); y <= Math.max(y0, y1) + m; y++)
        for (let x = Math.floor(Math.min(x0, x1) - m); x <= Math.max(x0, x1) + m; x++) {
          const t = Math.max(0, Math.min(1, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / L2)), rr = r0 + (r1 - r0) * t;
          const qx = x + 0.5 - (x0 + dx * t), qy = y + 0.5 - (y0 + dy * t), d = Math.hypot(qx, qy) / rr;
          if (d > 1) continue;
          const side = (qx * nx0 + qy * ny0) / rr, nz = Math.sqrt(Math.max(0, 1 - d * d));
          const s = side * (nx0 * KEY[0] + ny0 * KEY[1]) + nz * KEY[2] + (o.lift || 0) + (o.tex ? o.tex(x, y) : 0);
          put(x, y, d > 1 - 1.6 / Math.max(2, rr) && s < 0.3 ? rp[0] : tone(rp, s, x, y));
        }
    };
    const inPoly = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
    // cloth: lit across its width and darker toward the hem; o.folds puts creases every n pixels
    const poly = (pts, col, o) => {
      o = o || {}; const rp = ramp5(col), xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), cx = (x0 + x1) / 2, hw = (x1 - x0) / 2 || 1;
      for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
        if (!inPoly(pts, x + 0.5, y + 0.5)) continue;
        const edge = !inPoly(pts, x + 1.5, y + 0.5) || !inPoly(pts, x - 0.5, y + 0.5) || !inPoly(pts, x + 0.5, y + 1.5) || !inPoly(pts, x + 0.5, y - 0.5);
        let s = ((x - cx) / hw) * 0.45 + 0.2 - ((y - y0) / Math.max(1, y1 - y0)) * 0.25 + (o.lift || 0);
        if (o.folds) s += Math.sin(((x + (y - y0) * (o.slant || 0)) / o.folds) * Math.PI * 2) * 0.28;
        if (o.tex) s += o.tex(x, y);
        put(x, y, edge && s < 0.4 ? rp[0] : tone(rp, s, x, y));
      }
    };
    const line = (x0, y0, x1, y1, col, wd) => {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5) || 1, steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
      for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n; for (let k = 0; k < (wd || 1); k++) put(x + (steep ? k : 0), y + (steep ? 0 : k), col); }
    };
    const toCanvas = () => {
      const cv = layer(w, h), g = cv.getContext("2d"), out = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!px[y * w + x] && ((x > 0 && px[y * w + x - 1]) || (x < w - 1 && px[y * w + x + 1]) || (y > 0 && px[(y - 1) * w + x]) || (y < h - 1 && px[(y + 1) * w + x]))) out.push(y * w + x);
      for (const i of out) px[i] = "#0e0810";
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = px[y * w + x]; if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); } }
      return cv;
    };
    return { w, h, put, ell, cap, poly, line, toCanvas, glow };
  }

  const HAIR_LONG = new Set([1, 2, 6, 9, 10, 16, 17, 20]);
  function role(u, f, killer, h) {
    const acts = f.log.filter((e) => e.fx === "act" && e.a === u.i), kitW = ((h.kit || {}).weapon || {}).family || h.weapon || "";
    if (killer && killer.id === u.id) return "call";
    if (acts.some((e) => /bow/.test(e.anim || "")) || /bow/.test(kitW)) return "archer";
    if (((h.kit || {}).offhand || {}).art === "shield") return "guard";
    if (/staff|wand|orb/.test(kitW)) return "chant";
    return "blade";
  }

  // H: the figure's height in pixels, crown to soles; frame: the wind in the cloak and hair
  function figure(h, pose, H, frame) {
    const look = h.look || {}, kitx = h.kit || {}, arm = kitx.armor || {}, head = (kitx.head || {}).art, off = (kitx.offhand || {}).art, mark = kitx.mark;
    const Wd = R(H * 1.2), Ht = R(H * 1.36), oy = R(H * 0.34), ox = R(Wd * 0.45);
    const B = canvasBuf(Wd, Ht), u = (p) => [ox + p[0] * H, oy + p[1] * H], r = (v) => Math.max(1, v * H);
    const skin = look.skin || "#e8b088", hair = look.hair || "#4b2e1e", fav = look.fav || "#3c64c8";
    const wd = frame ? 1 : 0;
    const robe = arm.material === "cloth", mail = arm.material === "chain" || arm.material === "plate";
    const coat = robe ? fav : mail ? "#8a929c" : "#7a5032";
    const cloakC = robe ? "#3a3a34" : mail ? mixC(fav, "#1a1a28", 0.45) : mixC(fav, "#2a2a22", 0.2), lining = mixC(cloakC, "#000000", 0.35);
    const legC = robe ? "#3a2c2a" : "#4a3628", boot = "#2e1e16", metal = "#b4bcc6", wood = "#7a5030", ink = "#0e0810";
    // the stance: shoulders, elbows, hands, knees, feet, and how far the body leans into it
    const P = {
      call: { lean: 0.02, eN: [0.11, 0.34], hN: [0.17, 0.41], eF: [0.17, 0.06], hF: [0.25, -0.1], kN: [-0.08, 0.74], fN: [-0.17, 0.98], kF: [0.12, 0.72], fF: [0.21, 0.98], tilt: -0.12, shout: true },
      archer: { lean: 0.03, eN: [-0.13, 0.2], hN: [-0.03, 0.13], eF: [0.2, 0.17], hF: [0.35, 0.13], kN: [-0.1, 0.75], fN: [-0.2, 0.98], kF: [0.14, 0.72], fF: [0.25, 0.98], tilt: -0.06 },
      guard: { lean: 0.05, eN: [0.1, 0.32], hN: [0.19, 0.31], eF: [0.0, 0.03], hF: [0.07, -0.08], kN: [-0.09, 0.75], fN: [-0.2, 0.98], kF: [0.15, 0.71], fF: [0.26, 0.98], tilt: 0 },
      chant: { lean: 0.0, eN: [0.11, 0.24], hN: [0.18, 0.12], eF: [0.14, 0.34], hF: [0.19, 0.31], kN: [-0.05, 0.74], fN: [-0.12, 0.98], kF: [0.1, 0.74], fF: [0.17, 0.98], tilt: -0.08 },
      blade: { lean: 0.05, eN: [0.11, 0.3], hN: [0.21, 0.26], eF: [0.0, 0.03], hF: [0.07, -0.08], kN: [-0.09, 0.75], fN: [-0.2, 0.98], kF: [0.15, 0.71], fF: [0.26, 0.98], tilt: 0 },
    }[pose];
    const L = P.lean, shN = [-0.045 + L, 0.215], shF = [0.07 + L, 0.205], hipN = [-0.04, 0.5], hipF = [0.05, 0.5], neck = [0.02 + L, 0.17];
    const limb = (a, b, r0, r1, col, o) => { const [x0, y0] = u(a), [x1, y1] = u(b); B.cap(x0, y0, x1, y1, r(r0), r(r1), col, o); };
    const mid = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    // a leg: a full thigh, the knee, a calf that swells and then the boot up to mid-shin
    const leg = (hip, knee, foot, col, far) => {
      const o = far ? { lift: -0.25 } : {};
      limb(hip, knee, 0.068, 0.05, col, o); limb(knee, mid(knee, foot, 0.45), 0.05, 0.054, col, o);
      limb(mid(knee, foot, 0.45), foot, 0.052, 0.04, boot, o);
      const [fx, fy] = u(foot); B.ell(fx + r(0.035), fy - r(0.018), r(0.062), r(0.028), boot, o); B.line(fx - r(0.02), fy + r(0.008), fx + r(0.09), fy + r(0.008), "#1a100c", 1);
    };
    // an arm: a rounded shoulder, upper arm, forearm and a hand with its knuckles picked out
    const armL = (sh, el, hand, col, bare, far) => {
      const o = Object.assign(far ? { lift: -0.25 } : {}, mail ? { tex: (x, y) => (((x >> 1) + (y % 3 === 0 ? 1 : 0)) % 2 ? -0.22 : 0.05) } : {});
      B.ell(...u(sh), r(0.05), r(0.048), col, o);
      limb(sh, el, 0.044, 0.036, col, o); limb(el, hand, 0.037, 0.03, bare || col, o);
      const [hx, hy] = u(hand); B.ell(hx, hy, r(0.032), r(0.03), mail ? "#5a5250" : skin, o);
      B.line(hx - r(0.015), hy - r(0.02), hx + r(0.018), hy - r(0.02), mixC(mail ? "#5a5250" : skin, "#2a1410", 0.4), 1);
    };

    // behind everything: the cloak flaring back on the wind, its dark lining showing at the turn
    if ((kitx.back && kitx.back.art === "cloak") || arm.outfit === "cloak") {
      const k = wd * 0.02;
      B.poly([[-0.07 + L, 0.19], [0.07 + L, 0.19], [0.02, 0.48], [-0.06, 0.82], [-0.17 - k, 0.92], [-0.24 - k * 2, 0.88], [-0.31 - k * 3, 0.72], [-0.26 - k, 0.5], [-0.16, 0.3]].map(u), cloakC, { folds: r(0.06), slant: -0.5, lift: -0.1 });
      B.poly([[-0.24 - k * 2, 0.88], [-0.31 - k * 3, 0.72], [-0.28 - k * 2, 0.7], [-0.2 - k, 0.84]].map(u), lining);
    }
    if (kitx.back && kitx.back.art === "quiver") {
      limb([-0.12 + L, 0.16], [-0.05 + L, 0.46], 0.04, 0.034, "#6a4026");
      for (let i = 0; i < 5; i++) { const [x, y] = u([-0.135 + L + i * 0.012, 0.15]); B.line(x, y, x - r(0.025), y - r(0.07), "#4a3020", 1); B.line(x - r(0.025), y - r(0.07), x - r(0.03), y - r(0.09), i % 2 ? "#e8e0d0" : "#c83a2a", 2); }
    }
    const longHair = HAIR_LONG.has(look.style) && head !== "helm";
    if (longHair) {
      const k = wd * 0.015;
      B.poly([[-0.03 + L, 0.0], [0.06 + L, -0.01], [0.05 + L, 0.12], [0.0 + L, 0.3], [-0.08 - k * 2, 0.38], [-0.15 - k * 3, 0.33], [-0.12 - k, 0.2], [-0.07, 0.07]].map(u), hair, { folds: r(0.018), slant: 0.6, lift: -0.05 });
    }

    // the far side, turned away from the light
    leg(hipF, P.kF, P.fF, legC, true);
    const sleeve = mail ? "#8a929c" : coat;
    if (pose === "call") armL(shF, P.eF, P.hF, sleeve, null, true);
    else armL(shF, P.eF, P.hF, sleeve, null, true);
    if (pose === "archer") {
      const [bx, by] = u(P.hF), top = [bx - r(0.05), by - r(0.34)], bot = [bx + r(0.02), by + r(0.34)];
      const pt = (t) => [top[0] + (bot[0] - top[0]) * t + Math.sin(t * Math.PI) * r(0.07) + Math.sin(t * Math.PI * 2) * r(0.012), top[1] + (bot[1] - top[1]) * t];
      for (let i = 0; i <= 90; i++) { const [x, y] = pt(i / 90), th = Math.abs(i - 45) < 8 ? 2 : 1; for (let k = -1; k <= th; k++) B.put(x + k, y, k < 0 ? "#2a180c" : k === th ? "#4a2c16" : i % 10 < 2 ? "#e8b870" : "#a8743e"); }
      B.line(top[0] + 1, top[1], bot[0] + 1, bot[1], "#f0e8d0", 1);
      if ((kitx.weapon || {}).glow) B.glow.push([bx + r(0.05), by, r(0.13), kitx.weapon.glow]);
    }
    if (pose === "call") {
      const [gx, gy] = u([P.hF[0] + 0.015, P.hF[1] - 0.045]);
      if (off === "orb") { B.ell(gx, gy, r(0.042), r(0.042), "#a8e8f8", { lift: 0.4 }); B.glow.push([gx, gy, r(0.2), "#c8f8ff"]); } else B.glow.push([gx, gy, r(0.17), "#fff0b0"]);
    }
    if (pose === "guard" || pose === "blade") {
      const [hx, hy] = u(P.hF), [tx, ty] = u([P.hF[0] - 0.28, P.hF[1] - 0.2]), [px, py] = u([P.hF[0] + 0.05, P.hF[1] + 0.035]);
      B.line(hx, hy, tx, ty, "#2a2a34", 3); B.line(hx, hy - 1, tx + 1, ty, "#d8e0e8", 2); B.line(hx + 1, hy - 1, tx + 2, ty, "#ffffff", 1);
      const gx = (hx + tx) / 2 - (hx - tx) * 0.42, gy = (hy + ty) / 2 - (hy - ty) * 0.42;
      B.line(gx - r(0.04), gy + r(0.03), gx + r(0.04), gy - r(0.03), "#c8a040", 2); B.line(hx, hy, px, py, "#4a2c18", 2); B.ell(px, py, r(0.016), r(0.016), "#c8a040");
    }

    // the body
    if (robe) {
      const motley = arm.outfit === "motley" ? (x, y) => ((Math.floor((x + y) / r(0.07)) + Math.floor((x - y) / r(0.07))) % 2 ? -0.16 : 0.1) : null;
      B.poly([[-0.08 + L, 0.2], [0.09 + L, 0.2], [0.11 + L * 0.5, 0.47], [0.22 + wd * 0.01, 0.97], [0.0, 0.99], [-0.2, 0.96], [-0.1, 0.48]].map(u), coat, { folds: r(0.045), slant: 0.15, lift: 0.05, tex: motley });
      B.poly([[-0.07 + L, 0.19], [0.08 + L, 0.19], [0.06 + L, 0.25], [-0.06 + L, 0.25]].map(u), mixC(coat, "#ffffff", 0.32));
      B.poly([[0.01 + L, 0.24], [0.04 + L, 0.24], [0.1, 0.97], [0.06, 0.97]].map(u), mixC(coat, "#ffffff", 0.28));
      B.poly([[-0.09, 0.47], [0.11, 0.47], [0.11, 0.51], [-0.09, 0.51]].map(u), "#4a2c18");
      const [bx] = u(P.fN); B.ell(bx + r(0.04), u(P.fN)[1] - r(0.015), r(0.06), r(0.026), boot);
    } else {
      leg(hipN, P.kN, P.fN, legC);
      B.poly([[-0.085 + L, 0.2], [0.095 + L, 0.2], [0.11 + L * 0.6, 0.3], [0.085, 0.5], [-0.075, 0.52], [-0.09 + L * 0.5, 0.32]].map(u), coat, { tex: mail ? (x, y) => (((x >> 1) + (y % 3 === 0 ? 1 : 0)) % 2 ? -0.24 : 0.06) : null, lift: 0.08 });
      if (mail && mark === "tabard") {
        B.poly([[-0.055 + L, 0.24], [0.08 + L, 0.24], [0.09, 0.66], [0.015, 0.73], [-0.06, 0.66]].map(u), fav, { folds: r(0.05), lift: 0.05 });
        B.poly([[0.0 + L, 0.3], [0.03 + L, 0.3], [0.035, 0.56], [0.005, 0.56]].map(u), "#e8e0c8", { lift: 0.15 });
      }
      if (!mail) B.poly([[0.02 + L, 0.21], [0.06 + L, 0.21], [0.04, 0.48], [0.0, 0.48]].map(u), mixC(coat, "#000000", 0.2));
      B.poly([[-0.08, 0.47], [0.09, 0.47], [0.09, 0.515], [-0.08, 0.515]].map(u), "#4a2c18");
      const [bx, by] = u([0.035, 0.483]); B.ell(bx, by, r(0.013), r(0.016), "#e8c060");
    }
    if (head === "hood" && pose !== "chant") B.poly([[-0.1 + L, 0.155], [0.09 + L, 0.155], [0.08 + L, 0.235], [-0.1 + L, 0.25]].map(u), cloakC, { folds: r(0.025) });
    if (kitx.neck && kitx.neck.art === "pendant") { const [nx, ny] = u([0.04 + L, 0.28]); B.line(nx - r(0.04), ny - r(0.06), nx, ny, "#c8a040", 1); B.ell(nx, ny, r(0.014), r(0.016), kitx.neck.gem || "#c86a3a"); if (kitx.neck.glow) B.glow.push([nx, ny, r(0.06), kitx.neck.glow]); }
    if (pose === "archer") armL(shN, P.eN, P.hN, coat);

    // the head: cranium, jaw forward, the face three-quarter to the right and tipped by the pose
    const [hx0, hy0] = u([0.04 + L, 0.08]), hr = r(0.074), hv = r(0.088), tl = P.tilt;
    const hx = hx0, hy = hy0, F = (dx, dy) => [hx + hr * dx + hv * dy * tl * -1, hy + hv * dy + hr * dx * tl];
    limb([0.02 + L, 0.13], [0.025 + L, 0.2], 0.032, 0.036, skin);
    if (head === "hood" && pose === "chant") B.ell(hx - hr * 0.15, hy + hv * 0.05, hr * 1.38, hv * 1.32, mixC(fav, "#20201a", 0.3));
    B.ell(hx - hr * 0.08, hy - hv * 0.08, hr * 0.98, hv * 0.92, skin);
    B.poly([F(-0.6, 0.1), F(0.7, 0.05), F(1.02, 0.25), F(0.95, 0.68), F(0.62, 0.95), F(0.15, 1.0), F(-0.45, 0.6)], skin, { lift: 0.05 });
    const shade = mixC(skin, "#5a2a1a", 0.32), deep = mixC(skin, "#3a1410", 0.55), brow = mixC(hair, "#000000", 0.25);
    // nose, brow ridge, eyes, mouth
    B.poly([F(0.88, -0.12), F(1.14, 0.22), F(1.06, 0.3), F(0.86, 0.26)], skin, { lift: 0.2 }); B.put(...F(1.0, 0.3), deep); B.put(...F(0.94, 0.3), shade);
    const eye = (ex, ey, big) => {
      const [x, y] = F(ex, ey);
      // an eye is a glint of white and a dark iris under one lash pixel, never a box (a box reads as spectacles)
      B.put(x, y, mixC(skin, "#f4ece0", 0.6)); B.put(x + 1, y, "#24161a"); if (big) B.put(x + 1, y + 1, "#3a2420");
      B.put(x + 1, y - 1, deep);
    };
    const BIG = hr > 9;
    if (mark === "domino") B.poly([F(0.12, -0.32), F(1.1, -0.36), F(1.04, 0.1), F(0.7, 0.04), F(0.5, 0.12), F(0.12, 0.08)], mixC(fav, "#101018", 0.5), { lift: 0.1 });
    eye(0.32, -0.08, BIG); eye(0.78, -0.1, false);
    B.line(...F(0.14, -0.36), ...F(0.48, -0.27), brow, 1); B.line(...F(0.64, -0.3), ...F(0.96, -0.38), brow, 1);
    B.ell(...F(-0.42, 0.06), hr * 0.2, hv * 0.26, shade); B.put(...F(-0.42, 0.06), deep);
    B.line(...F(0.2, 0.35), ...F(0.45, 0.62), shade, 1);
    if (P.shout) { const [mx, my] = F(0.7, 0.55); B.ell(mx, my, hr * 0.18, hv * 0.13, "#3a1414"); B.put(mx, my - 1, "#e8dcd0"); }
    else B.line(...F(0.5, 0.56), ...F(0.9, 0.52), deep, 1);
    if (look.face === 2 || look.face === 1) {
      const bc = look.face === 1 ? mixC(hair, skin, 0.5) : hair;
      B.poly([F(-0.38, 0.2), F(0.1, 0.42), F(0.55, 0.42), F(1.0, 0.45), F(0.96, 0.85), F(0.65, 1.18), F(0.15, 1.18), F(-0.4, 0.7)], bc, { folds: 2, slant: 0.2, lift: -0.05 });
      if (P.shout) { const [mx, my] = F(0.7, 0.58); B.ell(mx, my, hr * 0.16, hv * 0.12, "#3a1414"); }
      else B.line(...F(0.5, 0.6), ...F(0.88, 0.58), deep, 1);
    }
    if (look.face === 3 || look.face === 2) B.line(...F(0.4, 0.44), ...F(1.02, 0.42), hair, 2);
    // hair over the crown, then whatever is on the head
    if (head !== "helm" && look.style !== 4) {
      if (longHair) {
        B.poly([F(-0.15, -1.02), F(0.45, -0.98), F(0.88, -0.66), F(0.92, -0.4), F(0.62, -0.58), F(0.28, -0.5), F(0.02, -0.28), F(-0.18, 0.15), F(-0.12, 0.7), F(-0.3, 1.25), F(-0.7, 1.2), F(-1.05, 0.5), F(-1.0, -0.4), F(-0.7, -0.85)], hair, { folds: hr * 0.35, slant: -0.6, lift: 0.08 });
        B.line(...F(0.1, -0.98), ...F(0.62, -0.62), mixC(hair, "#fff0d0", 0.3), 1); B.line(...F(-0.4, -0.85), ...F(-0.8, 0.2), mixC(hair, "#fff0d0", 0.18), 1);
      } else {
        B.ell(hx - hr * 0.18, hy - hv * 0.4, hr * 0.98, hv * 0.62, hair, { clip: (x, y) => y < hy - hv * 0.22 + (x < hx - hr * 0.35 ? hv * 0.8 : 0) });
        B.poly([F(-0.2, -0.95), F(0.7, -0.82), F(0.98, -0.45), F(0.6, -0.52), F(0.25, -0.4), F(-0.05, -0.5)], hair, { lift: 0.1 });
      }
    }
    if (head === "helm") {
      B.ell(hx - hr * 0.08, hy - hv * 0.08, hr * 1.18, hv * 1.18, metal, { lift: 0.05, clip: (x, y) => !(x > hx + hr * 0.12 && y > hy - hv * 0.4 && y < hy + hv * 0.9 && (x < hx + hr * 0.9 || y > hy - hv * 0.12)) });
      B.line(...F(-1.1, 0.2), ...F(0.1, 0.25), "#5a626c", 1); B.line(...F(-0.9, -0.85), ...F(0.2, -1.05), "#f4f8ff", 1);
      for (const [a, b] of [[-0.8, 0.0], [-0.55, 0.2], [-0.3, 0.32]]) B.put(...F(a, b), "#5a626c");
    }
    if (head === "hood" && pose === "chant") {
      const hc = mixC(fav, "#20201a", 0.3);
      B.poly([F(-1.35, -0.1), F(-0.6, -1.2), F(0.5, -1.35), F(1.2, -0.8), F(0.98, -0.6), F(0.3, -0.62), F(-0.25, -0.2), F(-0.5, 0.6), F(-1.0, 1.2)], hc, { folds: hr * 0.45 });
      B.poly([F(0.3, -0.6), F(0.98, -0.6), F(0.95, -0.45), F(0.3, -0.45)], hair, { folds: 2 });
    }
    if (head === "top_hat") {
      B.poly([F(-1.3, -0.62), F(1.3, -0.82), F(1.32, -0.62), F(-1.28, -0.42)], "#2a2430", { lift: 0.15 });
      B.poly([F(-0.78, -0.6), F(0.82, -0.74), F(0.82, -2.2), F(-0.72, -2.08)], "#2e2834", { lift: 0.18, folds: hr * 0.6 });
      B.poly([F(-0.76, -0.95), F(0.82, -1.08), F(0.82, -0.82), F(-0.76, -0.7)], fav, { lift: 0.1 });
      B.line(...F(0.5, -2.1), ...F(0.5, -1.15), "#6a6274", 1);
    }
    if (mark === "halo") B.glow.push([hx - hr * 0.25, hy - hv * 1.55, hr * 1.15, "#ffe08a", "ring"]);

    // the near side, in the light
    if (pose === "guard") {
      armL(shN, P.eN, P.hN, sleeve);
      if (mail) { B.ell(...u([shN[0] + 0.01, shN[1] - 0.005]), r(0.07), r(0.058), metal, { lift: 0.15 }); const [px, py] = u([shN[0] + 0.01, shN[1] + 0.02]); B.line(px - r(0.06), py, px + r(0.06), py - r(0.01), "#5a626c", 1); }
      const [sx, sy] = u([0.2 + L, 0.38]), sw = r(0.15), sh = r(0.27);
      B.poly([[sx - sw, sy - sh * 0.72], [sx + sw, sy - sh * 0.78], [sx + sw * 0.96, sy + sh * 0.02], [sx + sw * 0.1, sy + sh], [sx - sw * 0.92, sy + sh * 0.05]], fav, { lift: 0.2 });
      B.poly([[sx - sw * 0.18, sy - sh * 0.7], [sx + sw * 0.18, sy - sh * 0.72], [sx + sw * 0.2, sy + sh * 0.82], [sx - sw * 0.1, sy + sh * 0.84]], "#ece4cc", { lift: 0.25 });
      B.poly([[sx - sw * 0.92, sy - sh * 0.24], [sx + sw * 0.95, sy - sh * 0.28], [sx + sw * 0.95, sy + sh * 0.04], [sx - sw * 0.92, sy + sh * 0.08]], "#ece4cc", { lift: 0.25 });
      B.line(sx - sw, sy - sh * 0.72, sx + sw, sy - sh * 0.78, "#d8b050", 1);
      B.line(sx + sw * 0.55, sy - sh * 0.6, sx + sw * 0.8, sy - sh * 0.1, "#ffffff", 1);
    } else if (pose === "call") {
      const [sx, sy] = u([0.19, 0.0]), [tx, ty] = u([0.17, 1.0]); B.line(sx, sy, tx, ty, "#3a2214", 3); B.line(sx + 1, sy, tx + 1, ty, wood, 1);
      armL(shN, P.eN, P.hN, sleeve);
    } else if (pose === "chant") {
      const [sx, sy] = u([0.05, 0.56]), [tx, ty] = u([0.31, -0.2]); B.line(sx, sy, tx, ty, "#3a2214", 3); B.line(sx + 1, sy, tx + 1, ty, wood, 1);
      const [ttx, tty] = u([0.31, -0.2]); B.ell(ttx, tty, r(0.026), r(0.03), "#e8c060", { lift: 0.3 }); B.glow.push([ttx, tty, r(0.14), "#ffe8a0"]);
      armL(shN, P.eN, P.hN, sleeve);
      if (off === "tome") {
        const [bx, by] = u([0.22, 0.32]);
        B.poly([[bx - r(0.08), by - r(0.02)], [bx + r(0.08), by - r(0.05)], [bx + r(0.08), by + r(0.05)], [bx - r(0.08), by + r(0.07)]], "#f0e6c8", { lift: 0.35 });
        B.poly([[bx - r(0.09), by + r(0.06)], [bx + r(0.09), by + r(0.04)], [bx + r(0.09), by + r(0.065)], [bx - r(0.09), by + r(0.085)]], "#6a2a1a");
        B.line(bx, by - r(0.035), bx, by + r(0.06), "#8a6a4a", 1);
        for (let i = 0; i < 3; i++) { B.line(bx - r(0.065), by + r(0.0 + i * 0.02), bx - r(0.015), by + r(0.0 + i * 0.02) - 1, "#a08a6a", 1); B.line(bx + r(0.015), by - r(0.01 - i * 0.02), bx + r(0.065), by - r(0.02 - i * 0.02), "#a08a6a", 1); }
        B.glow.push([bx, by, r(0.12), "#ffe8b0"]);
      }
    } else if (pose !== "archer") armL(shN, P.eN, P.hN, sleeve);
    return { cv: B.toCanvas(), glow: B.glow, ox, foot: oy + H };
  }

  // ---------- the beast ----------
  const PIV = { troll: [0.17, 1] };
  function beast(unit, tilt) {
    const m = (unit && unit.look) || {}, body = (S.monsters[m.monster] || {}).body || m.body || "troll", pal = m.pal || (S.monsters[m.monster] || {}).pal || "stone";
    const P0 = Beasts.draw(body, pal, 0, true, Art.MPAL[pal] || Art.MPAL.grey, null, null);
    const k = 196 / P0.h, pose = { eyes: 1, arm: 0.3, crown: false, pivot: PIV[body] || [0.5, 1], tilt };
    const g = Beasts.draw(body, pal, 0, true, Art.MPAL[pal] || Art.MPAL.grey, pose, { k });
    const cv = g.toCanvas(1), f = layer(cv.width, cv.height), fg = f.getContext("2d");
    fg.translate(cv.width, 0); fg.scale(-1, 1); fg.drawImage(cv, 0, 0);
    const piv = pose.pivot;
    return { cv: f, fx: cv.width - (g.pad + piv[0] * g.stand[0]), fy: g.pad + g.stand[1], stand: g.stand };
  }

  function scene(f) {
    const town = f.place, st = STYLE[town] || STYLE.thornwall;
    const mon = f.lineup.find((u) => u.kind === "monster");
    const down = [...f.log].reverse().find((e) => e.fx === "down" && e.t === mon.i);
    const killer = down && f.lineup[down.by];
    const last = f.log.filter((e) => e.r === (down ? down.r : 0));
    const killAct = [...last].reverse().find((e) => e.fx === "act" && e.a === (down && down.by));
    const holy = killAct && /smite|holy|judg|light|divine/.test(killAct.anim || killAct.sid || "");
    const archer = last.find((e) => e.fx === "act" && /bow/.test(e.anim || "") && e.a !== (down && down.by));
    const crew = f.lineup.filter((u) => u.kind === "hero" && A.heroes[u.id]);

    const BX = 384, BY = GY + 8;
    // the lights in a canvas's own pixels, the canvas's top left standing at (dx, dy) in the scene
    const lights = (dx, dy) => [
      { x: 44, y: GY - 112, r: 210, c: [1, 0.48, 0.16], i: 1.05, p: 1.9 },
      { x: 118, y: GY - 76, r: 100, c: [1, 0.55, 0.2], i: 0.7, p: 1.8 },
      { x: 452, y: GY - 118, r: 220, c: [1, 0.48, 0.16], i: 1.05, p: 1.9 },
      { x: 390, y: GY - 36, r: 70, c: [1, 0.6, 0.25], i: 0.7 },
      holy ? { line: true, x: BX, w: 4, y1: GY + 6, r: 110, c: [1, 0.88, 0.5], i: 0.9, p: 2.2 } : { x: BX, y: GY - 60, r: 110, c: [1, 0.8, 0.5], i: 0.8 },
    ].map((l) => Object.assign({}, l, { x: l.x - dx, y: l.y - (dy || 0), y1: l.y1 - (dy || 0) }));
    const AMB = [0.2, 0.2, 0.34];

    const base = sky();
    const farCv = light(far(st), lights(-M).map((l) => Object.assign({}, l, { i: l.i * 0.6 })), [0.36, 0.34, 0.5]);
    const md = mid(st), midCv = light(md.cv, lights(-M), AMB);
    const nearCv = near();
    const T = beast(mon, -0.42);
    light(T.cv, lights(BX - T.fx, BY - T.fy).map((l) => (l.line ? Object.assign({}, l, { i: 0.45 }) : l)), AMB);
    rim(T.cv, 1, "#ff9040", 0.5);
    rim(T.cv, -1, holy ? "#fff0b0" : "#ffb060", 0.7);

    // the crew at different depths, the way a camera would find them: the one who landed the blow in the middle, the archer
    // near on the left, the front row nearest of all and cut off by the frame, the rest further back in the haze
    const SLOTS = [{ x: 310, H: 206, foot: 318, haze: 0 }, { x: 226, H: 150, foot: 258, haze: 0.12 }, { x: 56, H: 172, foot: 292, haze: 0 },
      { x: 152, H: 124, foot: 246, haze: 0.28 }, { x: 250, H: 112, foot: 240, haze: 0.38 }, { x: 18, H: 116, foot: 244, haze: 0.34 }];
    const free = SLOTS.slice(0, Math.max(crew.length, 1)), want = (u) => (u.row === "front" ? 0 : killer && killer.id === u.id ? 1 : role(u, f, killer, A.heroes[u.id]) === "archer" ? 2 : 3);
    const placed = [];
    for (const u of [...crew].sort((a, b) => want(a) - want(b))) {
      let k = free.findIndex((x) => x && SLOTS.indexOf(x) === want(u));
      if (k < 0) k = free.findIndex((x) => x && SLOTS.indexOf(x) >= 3);
      if (k < 0) k = free.findIndex((x) => x);
      placed.push({ u, s: free[k] }); free[k] = null;
    }
    const cast = placed.sort((a, b) => a.s.foot - b.s.foot).map(({ u, s: sl }) => {
      const h = A.heroes[u.id], pose = role(u, f, killer, h);
      const frames = [0, 1].map((fr) => {
        const F0 = figure(h, pose, sl.H, fr), cv = F0.cv;
        light(cv, lights(sl.x - F0.ox, sl.foot - F0.foot), [0.6 - sl.haze * 0.3, 0.54 - sl.haze * 0.25, 0.66 - sl.haze * 0.1]);
        rim(cv, 1, holy ? "#ffe9a0" : "#ffa050", 0.65);
        rim(cv, -1, "#ff7a30", 0.5);
        if (sl.haze) haze(cv, "#3a2232", sl.haze);
        return F0;
      });
      return { x: sl.x, foot: sl.foot, frames };
    });

    const drift = (t, k) => R(Math.sin(t * 0.22) * k);
    const actors = [];
    actors.push({ z: 0, draw: (c, t) => c.drawImage(farCv, -M + drift(t, 1), 0) });
    actors.push({ z: 1, draw: (c, t) => { const o = -M + drift(t, 1); for (const fi of md.fires) if (fi.w > 20) plume(c, fi.x + fi.w / 2 + o, fi.y - fi.h * 0.6, t, fi.x); } });
    actors.push({ z: 2, draw: (c, t) => c.drawImage(midCv, -M + drift(t, 2), 0) });
    actors.push({ z: 3, draw: (c, t) => { const o = -M + drift(t, 2); for (const fi of md.fires) flame(c, fi.x + o, fi.y, fi.w, fi.h, t, fi.x); } });
    actors.push({ z: 4, draw: (c, t) => { const o = drift(t, 3); c.drawImage(T.cv, R(BX - T.fx + o), R(BY - T.fy)); if (archer) arrow(c, BX - 14 + o, BY - T.stand[1] * 0.64); } });
    if (holy) actors.push({ z: 5, draw: (c, t) => beam(c, BX + drift(t, 3), t) });
    actors.push({ z: 6, draw: (c, t) => {
      const o = drift(t, 4);
      for (const x of cast) {
        const F0 = x.frames[Math.floor(t * 2.2 + x.x) % 2];
        shadowAt(c, x.x + o, x.foot, F0.cv.width * 0.3);
        c.drawImage(F0.cv, R(x.x - F0.ox + o), x.foot - F0.foot);
        glows(c, F0.glow, x.x - F0.ox + o, x.foot - F0.foot, t);
      }
    } });
    actors.push(Object.assign(Anim.embers({ x0: 0, x1: W, y: GY - 40, n: 34, rise: 120 }), { z: 7 }));
    actors.push({ z: 8, draw: (c, t) => c.drawImage(nearCv, -M * 2 + drift(t, 5), 0) });
    actors.push({ z: 9, draw: (c) => grade(c) });
    return { base, actors };
  }

  // what shines by itself: an orb, a staff's head, a tome's pages, a halo, a glowing bow; breathing a little
  function glows(c, list, ox, oy, t) {
    c.save(); c.globalCompositeOperation = "lighter";
    for (const [x, y, r, col, kind] of list) {
      const k = 1 + Math.sin(t * 3 + x) * 0.12, cx = ox + x, cy = oy + y;
      if (kind === "ring") { c.globalAlpha = 0.85; c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.ellipse(R(cx) + 0.5, R(cy) + 0.5, r, r * 0.3, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 0.25; c.lineWidth = 3; c.stroke(); continue; }
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, r * k), [a, b, d] = rgb(col);
      g.addColorStop(0, `rgba(${a},${b},${d},0.75)`); g.addColorStop(0.35, `rgba(${a},${b},${d},0.28)`); g.addColorStop(1, `rgba(${a},${b},${d},0)`);
      c.globalAlpha = 1; c.fillStyle = g; c.fillRect(cx - r * k, cy - r * k, r * 2 * k, r * 2 * k);
    }
    c.restore();
  }
  function shadowAt(c, x, y, rx) { c.fillStyle = "rgba(10,6,8,.45)"; for (let i = -R(rx); i <= R(rx); i++) c.fillRect(R(x + i), y - 1, 1, Math.abs(i) < rx * 0.7 ? 2 : 1); }

  // a fire on a roof or a stall: tongues that lick up, white-gold at the root and red at the tips
  const FIRE = ["#fff4c0", "#ffd860", "#ffa030", "#f0682a", "#c03a1e", "#7a2216"];
  function flame(c, x, y, w, h, t, seed) {
    for (let i = 0; i < w; i++) {
      const n = Math.sin(i * 0.9 + t * 7 + seed) * 0.25 + Math.sin(i * 0.37 - t * 4.3 + seed * 0.7) * 0.35 + Math.sin(t * 11 + i * 2.1) * 0.12;
      const edge = Math.sin((i / w) * Math.PI), hh = Math.max(2, R(h * edge * (0.65 + n)));
      for (let j = 0; j < hh; j++) {
        const k = j / hh, band = Math.min(FIRE.length - 1, Math.floor(k * FIRE.length + (bay(i, j) - 0.5) * 0.8 + (1 - edge) * 1.5));
        c.fillStyle = FIRE[Math.max(0, band)];
        c.fillRect(R(x + i), R(y - j), 1, 1);
      }
    }
    c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.07 + Math.sin(t * 9 + seed) * 0.02;
    c.fillStyle = "#ff8a30"; c.beginPath(); c.ellipse(x + w / 2, y - h * 0.3, w * 0.9, h * 1.1, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }
  // smoke off a burning roof: puffs that swell and thin as they climb and lean with the wind, lit orange near the fire
  const puffs = new Map();
  function puff(r, a, col) {
    const key = r + "|" + a + col;
    if (!puffs.has(key)) { const cv = layer(r * 2 + 1, r * 2 + 1), k = kit(cv); k.soft(r, r, r, r, col, a); puffs.set(key, cv); }
    return puffs.get(key);
  }
  function plume(c, x, y, t, seed) {
    for (let i = 0; i < 9; i++) {
      const ph = (t * 0.07 + i / 9 + seed * 0.013) % 1, r = R(5 + ph * 24), a = Math.round((1 - ph) * 6) / 6;
      if (a <= 0) continue;
      const px = x + ph * 46 + Math.sin(ph * 6 + i) * 4, py = y - ph * 150;
      c.drawImage(puff(r, a * 0.9, ph < 0.18 ? "#6a2e26" : ph < 0.4 ? "#3a1e24" : "#24161e"), R(px - r), R(py - r));
    }
  }
  // the killing light: a column of gold out of the smoke onto the beast, its core breathing, motes drifting down
  function beam(c, x, t) {
    c.save(); c.globalCompositeOperation = "lighter";
    const pulse = 1 + Math.sin(t * 3) * 0.12;
    for (const [w, a, col] of [[70, 0.05, "#ffc860"], [44, 0.08, "#ffd870"], [26, 0.12, "#ffe490"], [14, 0.18, "#fff2c0"], [5, 0.3, "#ffffff"]]) {
      c.globalAlpha = a; c.fillStyle = col; const ww = R(w * pulse);
      for (let y = 0; y < GY + 8; y += 2) c.fillRect(R(x - ww / 2 + Math.sin(y * 0.05 + t * 2) * (w > 10 ? 1 : 0)), y, ww, 2);
    }
    c.globalAlpha = 0.22; c.fillStyle = "#ffe490"; c.beginPath(); c.ellipse(x, GY + 6, 46 * pulse, 7, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 0.9;
    for (let i = 0; i < 24; i++) { const ph = (t * 0.35 + i * 0.137) % 1, mx = x + Math.sin(i * 7.3 + t) * (6 + (i % 5) * 3), my = ph * (GY + 6); c.fillStyle = i % 3 ? "#fff2c0" : "#ffffff"; c.fillRect(R(mx), R(my), 1, i % 4 ? 1 : 2); }
    c.restore();
  }
  function arrow(c, x, y) {
    c.fillStyle = "#2a1a10"; c.fillRect(R(x - 22), R(y), 12, 1);
    c.fillStyle = "#8a6a3a"; c.fillRect(R(x - 21), R(y), 10, 1);
    c.fillStyle = "#e8e0d0"; c.fillRect(R(x - 24), R(y) - 1, 3, 1); c.fillRect(R(x - 24), R(y) + 1, 3, 1);
  }
  // the grade: the corners pulled into the dark, smoothly, so it never lays a dither over the moon
  let gradeCv = null;
  function grade(c) {
    if (!gradeCv) {
      gradeCv = layer(W, H); const g = gradeCv.getContext("2d"), gr = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.62);
      gr.addColorStop(0, "rgba(8,4,10,0)"); gr.addColorStop(1, "rgba(8,4,10,0.55)");
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    c.drawImage(gradeCv, 0, 0);
  }

  A.route(/^\/fall\/(\w+)$/, (v, id) => A.load(`fight/${id}`).then((f) => {
    const mon = f.lineup.find((u) => u.kind === "monster");
    const box = el("div", { class: "full-art" });
    v.appendChild(el("h1", null, `The fall of ${mon ? mon.name : "the beast"}`));
    v.appendChild(box);
    const cv = el("canvas", { width: W, height: H, class: "full-art-cv", style: { width: "100%", imageRendering: "pixelated", display: "block", borderRadius: "4px" } });
    box.appendChild(cv);
    const sc = scene(f);
    Anim.stage(cv, sc.base, sc.actors, { fps: 15 });
    const names = f.lineup.filter((u) => u.kind === "hero").map((u) => u.name);
    v.appendChild(el("p", { class: "muted" }, `${A.cap(A.when(f.day, true))} · ${A.nodeName(f.place)}. `,
      A.richText(`${mon.name} falls to ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}.`, f.heroes, []), " ", el("a", { href: `#/fight/${id}` }, "Watch the fight ▶")));
  }));
})();
