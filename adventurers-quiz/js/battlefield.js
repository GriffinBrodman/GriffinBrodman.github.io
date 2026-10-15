/* Fight-replay battlefields: a calm backdrop for every place a stored fight can happen, the far scenery behind a deep ground plane. */
(function () {
  "use strict";
  const TS = window.TownScenes;
  if (!TS || !TS.kit) return;
  const { rect, ln } = TS;
  const R = Math.round;
  const frac = (v) => ((v % 1) + 1) % 1;
  // the S stage: a side view onto a ground plane seen from about 35 degrees. The scenery was first drawn for a 256x132
  // stage, so right-edge props move out by RX, centred ones by MX, and props standing on the ground slide down the deeper
  // plane with GY (keeping their tops where they were); the fighters' rows stand between y 120 and 156
  const W = 384, H = 216, HZ = 84, RX = W - 256, MX = RX >> 1;
  const GY = (y) => R(HZ + (y - HZ) * 1.85);
  const up = (base, h) => h + GY(base) - base;
  const FIELD = [44, W - 44, 168];
  const inField = (x, y) => x > FIELD[0] && x < FIELD[1] && y < FIELD[2];

  // ---------- shared painting ----------
  function haze(k, y0, y1, col, a) { k.ctx.globalAlpha = a; k.F(0, y0, W, y1 - y0, col); k.ctx.globalAlpha = 1; }
  // a ground plane whose mottling stretches toward the viewer, in colours close enough not to fight the sprites
  function ground(k, y0, y1, cols, tex, seed, scale) {
    k.grad(y0, y1, cols);
    const n = TS.paint.noise2d(seed), sc = scale || 1;
    for (let y = y0; y < y1; y++) {
      const p = 1 + (y - y0) / 14;
      for (let x = 0; x < W; x++) {
        const v = n(x / (7 * p * sc), y / (1.6 * p * sc));
        if (v > 0.64 && k.on(x, y, 0.55)) k.P(x, y, tex[0]);
        else if (v < 0.34 && k.on(x, y, 0.45)) k.P(x, y, tex[1]);
      }
    }
  }
  // rows of paving that grow taller toward the viewer: the plane reads as a plane
  function paving(k, y0, y1, stones, gap, seed) {
    k.F(0, y0, W, y1 - y0, gap);
    let y = y0 + 1, i = 0;
    while (y < y1) {
      const h = Math.min(y1 - y, R(3 + i * 0.9)), sw = 6 + h * 3;
      let x = -k.ri(0, sw) - ((i % 2) * sw >> 1);
      while (x < W) {
        const w = k.ri(sw - 3, sw + 3), c = k.pick(stones);
        k.F(x + 1, y, w - 2, h - 1, c); k.F(x + 2, y, w - 4, 1, k.mix(c, "#ffffff", 0.12));
        for (let d = 0; d < w / 9; d++) k.P(x + k.ri(2, Math.max(2, w - 3)), y + k.ri(1, Math.max(1, h - 2)), k.mix(c, "#000000", 0.06));
        x += w;
      }
      y += h; i++;
    }
  }
  // the left and right edges fall slightly into shade, which keeps the eye on the middle
  function vignette(k, col, a) {
    for (let x = 0; x < 56; x++) {
      const al = a * (1 - x / 56) ** 1.6;
      k.ctx.globalAlpha = al; k.F(x, 0, 1, H, col); k.F(W - 1 - x, 0, 1, H, col);
    }
    k.ctx.globalAlpha = 1;
  }
  function tufts(k, y0, y1, cols, n, avoid) {
    for (let i = 0; i < n; i++) {
      const x = k.ri(0, W - 1), y = k.ri(y0, y1);
      if (avoid && inField(x, y)) continue;
      k.P(x, y, cols[0]); k.P(x - 1, y - 1, cols[1]); k.P(x + 1, y - 1, cols[1]);
    }
  }
  function sideTree(k, x, w, top, base, bark, leaves) {
    for (let y = top; y < base; y++) {
      const flare = y > base - 10 ? R(((y - base + 10) / 10) ** 1.6 * 5) : 0;
      k.F(x - flare - 1, y, w + flare * 2 + 2, 1, bark[3]);
      k.F(x - flare, y, w + flare * 2, 1, bark[1]); k.F(x - flare, y, 2, 1, bark[0]); k.F(x + w + flare - 2, y, 2, 1, bark[2]);
    }
    for (let i = 0; i < w * 4; i++) k.F(x + k.ri(1, w - 2), k.ri(top, base - 6), 1, k.ri(3, 7), bark[2]);
    if (leaves) for (let i = 0; i < 9; i++) { const cx = x + (w >> 1) + k.ri(-22, 22), cy = top + k.ri(-6, 10); k.blob(cx, cy, k.ri(9, 14), k.ri(6, 9), leaves[0]); k.blob(cx - 2, cy - 2, k.ri(6, 9), k.ri(3, 6), leaves[1]); }
  }
  function cloudAt(ctx, x, y, w, cols) {
    rect(ctx, x - (w >> 1), y + 1, w, 2, cols[2]);
    rect(ctx, x - R(w * 0.4), y - 1, R(w * 0.5), 3, cols[1]); rect(ctx, x - R(w * 0.05), y - 2, R(w * 0.4), 4, cols[1]);
    rect(ctx, x - R(w * 0.3), y - 2, R(w * 0.3), 2, cols[0]); rect(ctx, x, y - 3, R(w * 0.25), 2, cols[0]);
  }
  function drift(list, cols) {
    return { draw(ctx, t) { for (const [x0, y, w, sp] of list) cloudAt(ctx, R(frac((x0 + t * sp) / (W + 80)) * (W + 80) - 40), y, w, cols); } };
  }
  function flutter(x, y, w, h, col, lit, dark, trim) {
    return { draw(ctx, t) {
      for (let j = 0; j < h; j++) {
        const dx = R(Math.sin(t * 2 - j * 0.5) * 0.8 * (j / h));
        for (let i = 0; i < w; i++) {
          if (j === h - 1 && i > 0 && i < w - 1) continue;
          rect(ctx, x + i + dx, y + j, 1, 1, j === 1 && trim ? trim : i === 0 ? lit : i === w - 1 ? dark : col);
        }
      }
    } };
  }
  function puffs(x, y, col, n) {
    const A = window.Anim;
    return A ? A.smoke({ x, y, n: n || 4, rise: 12, wind: 3, col, seed: x }) : null;
  }
  function flame(x, y, r) {
    const A = window.Anim;
    return { keep: true, draw(ctx, t) {
      if (A) A.light(ctx, x, y - 2, r, "255,170,80", 0.16 + 0.04 * Math.sin(t * 6.1) + 0.03 * Math.sin(t * 13.7));
      const h = 3 + R(Math.sin(t * 9 + x) * 0.8);
      rect(ctx, x - 1, y - h, 2, h, "#ff9a3a"); rect(ctx, x, y - h - 1, 1, 1, "#ffd86a"); rect(ctx, x, y - 2, 1, 2, "#fff0b0");
    } };
  }
  function column(x, y, rise, wind) {
    return { draw(ctx, t) {
      for (let i = 0; i < 16; i++) {
        const a = frac(t / 7 + i / 16), r = 1 + a * 5, cx = x + Math.sin(a * 5 + i) * 1.5 + a * a * wind, cy = y - a * rise;
        ctx.globalAlpha = 0.55 * (1 - a) * Math.min(1, a * 8);
        rect(ctx, cx - r, cy - r * 0.7, r * 2, r * 1.4, i % 3 ? "#4a4246" : "#5e5458");
        rect(ctx, cx - r + 1, cy - r * 0.7, r, 1, "#6e6468");
      }
      ctx.globalAlpha = 1;
    } };
  }
  function walltorch(k, x, y) { k.F(x - 1, y, 3, 1, "#3a2a1e"); k.F(x, y - 1, 1, 5, "#5a3a22"); return flame(x, y - 1, 16); }
  function sparkle(list) {
    return { draw(ctx, t) { list.forEach(([x, y], i) => { const f = frac(t / (2.2 + i * 0.37) + i * 0.29); if (f > 0.28) return; const big = f > 0.09 && f < 0.19; rect(ctx, x - (big ? 1 : 0), y, big ? 3 : 1, 1, "#ffffff"); if (big) rect(ctx, x, y - 1, 1, 3, "#ffffff"); }); } };
  }

  // ---------- the wilds ----------
  function kingsroad(k, s) {
    const { F, P } = k;
    k.grad(0, HZ, ["#78acd8", "#9cc2e0", "#c4d8e0", "#e2dcc0"]);
    k.ridge(72, 7, 40, "#b0bece", 5, "#bccad8");
    const cx = 196 + MX;
    k.blob(cx, 76, 34, 7, "#a2b89a"); k.blob(cx - 6, 74, 22, 5, "#aec4a4");
    const C = ["#e6e8ec", "#cdd2dc", "#b0b6c6", "#8e96aa"], RF = ["#d8a49a", "#c08480"];
    F(cx - 13, 62, 26, 9, C[3]); F(cx - 12, 63, 24, 8, C[1]); F(cx - 12, 63, 24, 1, C[0]);
    for (let x = cx - 12; x < cx + 12; x += 2) P(x, 62, C[1]);
    F(cx - 4, 54, 8, 9, C[3]); F(cx - 3, 55, 6, 8, C[1]); F(cx - 3, 55, 2, 8, C[0]);
    for (const [x, t] of [[cx - 15, 57], [cx + 12, 57], [cx - 1, 47]]) { F(x, t, 3, 71 - t, C[2]); F(x, t, 1, 71 - t, C[0]); k.tri(x - 1, t - 5, 5, 5, RF[1]); P(x + 1, t - 6, RF[0]); }
    F(cx - 1, 67, 2, 4, C[3]);
    k.grad(74, HZ, ["#9cb47a", "#94ae72"]);
    for (let y = 75; y < HZ; y += 3) { let x = -k.ri(0, 20); while (x < W) { const w = k.ri(20, 44); F(x, y, w, 2, k.pick(["#a8b878", "#b8b878", "#98b072", "#a4b47c"])); x += w; } F(0, y + 2, W, 1, "#86a066"); }
    const inn = k.house({ x: 6, g: HZ, w: 24, wh: 13, rh: 8, wall: ["#ece2c8", "#d8caa8", "#b8a682"], roof: ["#c88a6e", "#a8705a", "#7e5446"], frame: "#7a5a42", ol: "#5a4a3c", type: "gable", chim: "l", chimC: "#a49a8e", lit: false, wins: 2, doorAt: 14 });
    haze(k, 36, HZ, "#e4e6dc", 0.3);
    if (inn.chim) k.add(puffs(inn.chim[0], inn.chim[1], "#e4e4e0", 3));
    F(0, HZ, W, 6, "#8aa862"); tufts(k, HZ, HZ + 5, ["#7a9a56", "#9ab872"], 44);
    const road1 = 168;
    F(0, 90, W, 1, "#a69878");
    paving(k, 90, road1, ["#d4c7a8", "#cbbd9c", "#c2b494", "#d0c2a2"], "#b4a688");
    F(0, road1, W, 1, "#d0c3a4"); F(0, road1 + 1, W, 2, "#9c8e70");
    F(0, road1 + 3, W, H - road1 - 3, "#86a45e"); tufts(k, road1 + 4, H - 1, ["#76944f", "#96b46a"], 120);
    const ms = 58; F(ms - 1, 85, 5, 6, "#8a8678"); F(ms, 84, 3, 6, "#d4d0c4"); F(ms + 2, 85, 1, 5, "#aaa69a"); P(ms + 1, 87, "#7a766c");
    const pole = 236 + RX;
    F(pole, 52, 1, 38, "#5a4030"); F(pole - 4, 52, 9, 1, "#5a4030");
    k.add(flutter(pole - 3, 53, 6, 12, "#b8463c", "#d0645a", "#8a3430", "#e8c050"));
    if (s.road) {
      const cx2 = 226 + RX, cy = GY(108);
      F(cx2 - 2, cy + 4, 30, 10, "#3a2a1e"); F(cx2 - 1, cy + 5, 28, 8, "#8a6440"); F(cx2 - 1, cy + 5, 28, 1, "#a8804e"); for (let i = 0; i < 28; i += 4) F(cx2 - 1 + i, cy + 6, 1, 6, "#6a4a2c");
      for (let a = 0; a < 16; a++) { const q = a / 16 * Math.PI * 2; P(cx2 + 6 + R(Math.cos(q) * 5), cy + R(Math.sin(q) * 5), "#3a2a1e"); }
      ln(k.ctx, cx2 + 1, cy, cx2 + 11, cy, "#7a5432"); ln(k.ctx, cx2 + 6, cy - 5, cx2 + 6, cy + 5, "#7a5432");
      F(cx2 - 14, cy + 8, 8, 7, "#3a2a1e"); F(cx2 - 13, cy + 9, 6, 5, "#b08a50"); F(cx2 - 13, cy + 9, 6, 1, "#c8a46a");
      for (const [ax, ay] of [[30, 124], [40, 127], [204 + RX, 126], [212 + RX, 123]]) { const y = GY(ay); ln(k.ctx, ax, y, ax + 3, y - 5, "#5a4030"); P(ax + 3, y - 6, "#e8e0d0"); P(ax + 4, y - 6, "#e8e0d0"); }
    }
    vignette(k, "#2a3a2a", 0.22);
    k.add(drift([[20, 14, 30, 1.2], [150 + MX, 24, 22, 0.8], [230 + RX, 8, 18, 1.0]], ["#ffffff", "#f0f4f8", "#d4e0ec"]));
  }

  function greenwood(k, s) {
    const { F } = k;
    k.grad(0, HZ, ["#a6cfe0", "#c4e0dc", "#d6e8d0"]);
    TS.paint.grove(k, 58, "#a8c8b4", "#b8d6c2", null, 7, 10, 10, 21);
    F(0, 56, W, 30, "#a8c8b4");
    TS.paint.grove(k, 72, "#8cb496", "#9cc2a2", "#7a9a80", 7, 11, 11, 22);
    F(0, 70, W, 16, "#8cb496");
    TS.paint.grove(k, 86, "#76a27e", "#86b08a", "#5e7e62", 8, 12, 12, 23);
    haze(k, 30, HZ + 2, "#dceadc", 0.18);
    ground(k, HZ, H, ["#86ac5c", "#7aa252", "#6e9648", "#66903f"], ["#94b866", "#6a8e46"], 31);
    for (let i = 0; i < 14; i++) { const x = k.ri(10, W - 10), y = k.ri(88, 170), rx = k.ri(6, 16); k.ctx.globalAlpha = 0.18; k.blob(x, y, rx, 1, "#e8f0a8"); k.ctx.globalAlpha = 1; }
    tufts(k, HZ, H - 1, ["#5e8a3e", "#7aa44e"], 130, true);
    const BK = ["#9a7e5c", "#7e6448", "#634e38", "#3e3226"];
    sideTree(k, 4, 14, 0, GY(126), BK); sideTree(k, 236 + RX + 2, 15, 0, GY(124), BK);
    const BK2 = ["#a8906e", "#8e7658", "#76604a", "#5a4a3a"];
    sideTree(k, 34, 7, 20, GY(92), BK2); sideTree(k, 214 + RX, 7, 18, GY(90), BK2);
    for (let x = -10; x < W + 10; x += 9) { k.blob(x, k.ri(-2, 5), k.ri(10, 14), k.ri(5, 8), "#4e7e46"); k.blob(x - 2, k.ri(-2, 3), k.ri(6, 9), k.ri(3, 5), "#5e9050"); }
    const fern = (x, y) => { for (let j = -3; j <= 3; j++) ln(k.ctx, x, y, x + j * 2, y - 4 + Math.abs(j), Math.abs(j) % 2 ? "#5e8e42" : "#76a44e"); };
    for (const [x, y] of [[18, 128], [30, 122], [226 + RX, 127], [244 + RX, 120], [8, 116], [24, 140], [350, 146]]) fern(x, GY(Math.min(y, 132)));
    const shafts = { draw(ctx, t) { for (const [x0, w, ph] of [[70 + MX, 6, 0], [150 + MX, 9, 1.7], [196 + MX, 5, 3.1], [20, 5, 2.2]]) { const a = 0.05 + 0.02 * Math.sin(t * 0.4 + ph); for (let y = 6; y < 120; y++) { ctx.globalAlpha = a * (1 - y / 134); rect(ctx, x0 + y * 0.3, y, w, 1, "#fff8c8"); } } ctx.globalAlpha = 1; } };
    k.add(shafts);
    vignette(k, "#1e2e1a", 0.28);
  }

  function bleakmarsh(k, s) {
    const { F, P } = k;
    k.grad(0, HZ, ["#76847e", "#8c988e", "#a4ac9c", "#b6b8a4"]);
    for (const [x, y, w] of [[75, 14, 90], [255, 24, 110]]) { F(x - (w >> 1), y, w, 3, "#7e8a84"); F(x - (w >> 1) + 8, y - 2, w - 20, 2, "#848e88"); }
    const dead = (x, g, h, col) => { ln(k.ctx, x, g, x, g - h, col); for (let i = 0; i < 3; i++) { const yy = g - h + 3 + i * R(h / 4), sd = i % 2 ? 1 : -1, l = R(h * 0.35); ln(k.ctx, x, yy, x + sd * l, yy - R(l * 0.6), col); } };
    for (let i = 0; i < 24; i++) dead(k.ri(0, W), 78, k.ri(8, 18), "#8e9688");
    F(0, 76, W, 8, "#8a927e");
    for (let x = 0; x < W; x++) if (k.r() < 0.35) F(x, 76 - k.ri(1, 4), 1, 4, "#7e8872");
    F(0, 80, W, 4, "#7a8a86"); for (let x = 0; x < W; x += 3) if (k.r() < 0.4) F(x, 81, k.ri(2, 6), 1, "#9aa6a0");
    haze(k, 40, HZ, "#b8bca8", 0.25);
    ground(k, HZ, H, ["#6e7458", "#646a4e", "#5a6046", "#545a40"], ["#7a8060", "#545a40"], 32);
    for (const [x, y, w] of [[8, 124, 40], [214 + RX, 122, 40], [-6, 104, 24], [238 + RX, 102, 26], [120, 176, 40]]) { const yy = y > 140 ? y : GY(y); k.blob(x + (w >> 1), yy, w >> 1, 3, "#4a564c"); k.blob(x + (w >> 1), yy, (w >> 1) - 2, 2, "#5e6e66"); F(x + 6, yy - 1, R(w / 3), 1, "#8a9a90"); }
    const reeds = (x0, x1, y0, y1) => { for (let i = 0; i < (x1 - x0) * 1.2; i++) { const x = k.ri(x0, x1), y = k.ri(y0, y1), h = k.ri(5, 12); F(x, y - h, 1, h, k.pick(["#6e7a48", "#5e6a3e", "#808a52"])); if (k.r() < 0.4) F(x, y - h - 3, 1, 3, "#6a5236"); } };
    reeds(0, 40, 92, GY(132)); reeds(W - 40, W - 1, 92, GY(132));
    const tx = 16, base = GY(100);
    for (let y = 30; y < base; y++) { const w = y > base - 8 ? 5 + R((y - base + 8) * 0.6) : 4; F(tx - 1, y, w + 2, 1, "#3e3e36"); F(tx, y, w, 1, "#6a665a"); P(tx, y, "#847e70"); }
    for (const [dx, yy] of [[18, 36], [16, 48], [-10, 42]]) { ln(k.ctx, tx + 2, yy + 6, tx + dx, yy, "#4e4c44"); for (let j = 0; j < 5; j++) { const x = tx + 2 + R((dx - 2) * j / 5); F(x, yy + 4 - j, 1, k.ri(4, 9), "#7e8a62"); } }
    k.add(window.Anim ? Anim.wisp({ x: 150 + MX, y: 58, w: 60, h: 14, seed: 3 }) : null);
    k.add(window.Anim ? Anim.bubbles({ x: 220 + RX, y: GY(121), w: 18, n: 2, col: "#8a9a8a", seed: 4 }) : null);
    vignette(k, "#1e241e", 0.28);
  }

  function redcrag(k, s) {
    const { F, P } = k;
    k.grad(0, HZ, ["#6a9ccc", "#90b2d0", "#c2c8c0", "#e6cca6"]);
    const mesa = (x0, x1, top, col, lit) => { for (let x = x0; x < x1; x++) { const u = (x - x0) / (x1 - x0), e = Math.min(u, 1 - u), t = top + (e < 0.12 ? R((0.12 - e) * 70) : 0); F(x, t, 1, HZ - t, col); if (e >= 0.12) P(x, t, lit); if ((x + t) % 5 === 0) P(x, t + 5, k.mix(col, "#000000", 0.06)); } };
    mesa(10, 120, 52, "#d4ae9e", "#e4c4b4"); mesa(214, 374, 48, "#cca294", "#dcb8aa");
    k.ridge(78, 5, 26, "#cc9a80", 72, "#dcae94");
    haze(k, 40, HZ, "#ead8c4", 0.28);
    ground(k, HZ, H, ["#c28a62", "#b8805a", "#ac7652", "#a46e4c"], ["#cc966c", "#a06c4a"], 33);
    tufts(k, HZ + 2, H - 1, ["#a89a52", "#c4b464"], 50, true);
    for (let i = 0; i < 70; i++) { const x = k.ri(0, W), y = k.ri(88, H - 2); if (inField(x, y)) continue; F(x, y, 2, 1, "#8e5e40"); P(x, y - 1, "#d8a47a"); }
    const RK = ["#e4a07a", "#cc8460", "#ac6a4a", "#8a5038", "#6a3c2a"];
    const spire = (cx, base, h, w, sd) => {
      const rr = Art.rng(sd), cols = [];
      for (let x = cx - w; x <= cx + w; x += 2 + Math.floor(rr() * 3)) cols.push([x, rr()]);
      const colAt = (x) => { let c = cols[0]; for (const q of cols) if (q[0] <= x) c = q; return c; };
      for (let x = cx - w; x <= cx + w; x++) {
        const u = Math.abs(x - cx) / w, [c0, v] = colAt(x), t = R(base - h * (1 - u ** 1.8) * (0.6 + 0.4 * v)), side = x < cx - w * 0.2 ? 1 : x < cx + w * 0.35 ? 2 : 3;
        F(x, t, 1, base - t, RK[side]); P(x, t, RK[side - 1]);
        if (x === c0) F(x, t + 1, 1, base - t - 1, RK[Math.min(4, side + 1)]);
        for (let yy = t + 3; yy < base; yy += 6) if (((x + yy) >> 1) % 3) P(x, yy, RK[Math.min(4, side + 1)]);
      }
    };
    spire(14, GY(128), up(128, 70), 16, 3); spire(244 + RX, GY(124), up(124, 62), 14, 4); spire(40, GY(96), up(96, 26), 8, 5); spire(220 + RX, GY(94), up(94, 22), 7, 6);
    k.add(window.Anim ? Anim.eagle({ x: 120 + MX, y: 18, r: 22, seed: 7 }) : null);
    vignette(k, "#3a1e12", 0.24);
  }

  function whitepeak(k, s) {
    const { F, P } = k;
    k.grad(0, HZ, ["#7aa6d6", "#9cbce0", "#c6d8ec", "#e4ecf6"]);
    TS.paint.range(k, { peaks: [[60, 40, 0.9, 1.1], [192, 26, 0.9, 0.8], [315, 36, 1.0, 0.9], [380, 50, 1, 1]], base: HZ, lit: "#e2eaf4", shade: "#b8c6da", rim: "#ffffff", rock: "#9aa8c0", rockLit: "#c8d4e4", jag: 3, seed: 81 });
    for (let x = 2; x < W; x += k.ri(4, 9)) k.pine(x, 84 + k.ri(-1, 1), k.ri(4, 7), ["#5a6e80", "#687c8e", "#76899a"], true);
    haze(k, 20, HZ, "#eef3fa", 0.32);
    ground(k, HZ, H, ["#e8eef6", "#e0e8f2", "#d8e2ee", "#d2dcea"], ["#f4f8fc", "#c8d4e4"], 34);
    for (let i = 0; i < 34; i++) { const x = k.ri(0, W), y = k.ri(90, H - 2); if (inField(x, y)) continue; F(x, y, k.ri(4, 10), 1, "#c4d0e2"); F(x + 1, y - 1, k.ri(3, 6), 1, "#ffffff"); }
    const pine = (x, g, h) => k.pine(x, g, h, ["#26384a", "#32485a", "#3e586a"], true);
    pine(10, GY(130), 40); pine(28, GY(118), 28); pine(244 + RX, GY(128), 36); pine(230 + RX, GY(114), 24);
    const cairn = (x, g) => { k.blob(x, g - 2, 4, 2, "#7a8494"); k.blob(x, g - 5, 3, 2, "#8e98a8"); k.blob(x, g - 8, 2, 1, "#a2acba"); F(x - 3, g - 6, 6, 1, "#ffffff"); P(x, g - 10, "#ffffff"); };
    cairn(44, 92); cairn(208 + RX, 90);
    const FL = ["#c85a4a", "#e0b848", "#4a84b8", "#6a9a58", "#f0ece0"];
    for (let i = 0; i < 14; i++) { const x = 150 + MX + i * 6, yy = 64 + R(Math.sin(i / 13 * Math.PI) * 4); P(x, yy, "#7a6a5a"); F(x, yy + 1, 2, 2, FL[i % 5]); }
    const snow = { draw(ctx, t) { for (let i = 0; i < 32; i++) { const x = frac(i * 0.618 + t * 0.012) * W, y = frac(i * 0.37 + t * 0.04) * 64; rect(ctx, x + Math.sin(t + i) * 2, y, 1, 1, "#ffffff"); } } };
    k.add(snow);
    vignette(k, "#4a5a78", 0.18);
  }

  function saltcliffs(k, s) {
    const { F, P } = k;
    const cliff = 176 + RX;
    k.grad(0, 66, ["#5c9cd8", "#86b8e6", "#b6d4ee", "#e2eef4"]);
    k.grad(66, HZ, ["#6a9ccc", "#5a8ec0", "#4e82b4"]);
    F(0, 66, W, 1, "#b0d2ec");
    for (let y = 68; y < HZ; y += 2) for (let x = 0; x < cliff; x++) if (k.r() < 0.05) F(x, y, k.ri(2, 4), 1, "#8ab8de");
    const stack = (x, w, top) => { for (let y = top; y < 70; y++) { const hw = R(w * (0.6 + 0.4 * (y - top) / (70 - top))); F(x - hw, y, hw * 2 + 1, 1, "#d4c8a8"); F(x + hw - 1, y, 2, 1, "#b4a688"); } F(x - w, top - 1, w * 2, 1, "#88b070"); };
    stack(46, 4, 46); stack(64, 2, 56); stack(150, 3, 54);
    const BAND = ["#e6d8b8", "#d8c8a4", "#c8b490", "#b29c78"];
    for (let x = cliff; x < W; x++) {
      const u = (x - cliff) / 22, t = u < 1 ? R(10 + (1 - Math.sin(u * Math.PI / 2)) * 70) : 10 + R(Math.sin(x * 0.1) * 2);
      for (let y = t; y < 92; y++) { const st = Math.floor((y + Math.sin(x * 0.07) * 4) / 5) % 4; let c = BAND[[1, 2, 1, 3][st]]; if (x - cliff < 2 + (y - t) * 0.06) c = BAND[0]; P(x, y, c); }
      F(x, t - 2, 1, 2, "#78ac58");
    }
    for (let i = 0; i < 14; i++) { const x = k.ri(cliff + 10, W - 2), y0 = k.ri(18, 70); for (let j = 0; j < k.ri(3, 8); j++) P(x, y0 + j, "#f6f2e8"); }
    haze(k, 30, HZ, "#e8f0f2", 0.22);
    ground(k, HZ, H, ["#d8cca8", "#d0c4a0", "#c6b896", "#beb08e"], ["#e2d8b8", "#b8aa88"], 35);
    F(0, HZ, cliff, 1, "#e2e8e2");
    for (let i = 0; i < 60; i++) { const x = k.ri(0, W), y = k.ri(90, H - 2); if (inField(x, y)) continue; F(x, y, 2, 1, k.pick(["#9a948a", "#8a8478", "#aaa294"])); }
    const pool = GY(124); k.blob(26, pool, 16, 3, "#8a8070"); k.blob(26, pool, 14, 2, "#6aa0b8"); F(18, pool - 1, 9, 1, "#a8d4e4");
    for (const [x, y] of [[6, 112], [236 + RX, 120], [222 + RX, 128]]) { const yy = GY(y); k.blob(x, yy, 6, 3, "#6e6a62"); k.blob(x - 1, yy - 1, 4, 2, "#8e887e"); }
    const A = window.Anim;
    if (A) { for (let i = 0; i < 3; i++) k.add(A.gull({ W, y: 10 + i * 9, seed: 30 + i })); k.add(A.crab({ x: 228 + RX - 8, y: GY(126), range: 10, seed: 5 })); }
    k.add({ draw(ctx, t) { for (let i = 0; i < 12; i++) { const f = frac(t / (2.5 + i * 0.3) + i * 0.37); if (f > 0.3) continue; rect(ctx, (i * 41) % (cliff - 6), 68 + (i * 7) % 14, f > 0.1 && f < 0.2 ? 3 : 1, 1, "#ffffff"); } } });
    vignette(k, "#2a3a4a", 0.18);
  }

  // ---------- the dungeons ----------
  function goblin_camp(k, s) {
    const { F, P } = k;
    const gx = 128 + MX;
    k.grad(0, HZ, ["#6aa0d0", "#90b8d8", "#c0d0d0", "#e6d4a8"]);
    k.ridge(62, 6, 36, "#a8bcb4", 31);
    const WD = ["#b48a5c", "#966e44", "#76542e", "#5a3e22"];
    for (let x = 0; x < W; x += 4) { if (Math.abs(x - gx) < 14) continue; const h = 18 + ((x * 7) % 5); F(x, HZ - h, 3, h, WD[1]); F(x, HZ - h, 1, h, WD[0]); F(x + 2, HZ - h, 1, h, WD[2]); P(x + 1, HZ - h - 1, WD[3]); }
    F(0, HZ - 7, W, 1, "#c8a870"); F(0, HZ - 13, W, 1, "#c8a870");
    for (const x of [gx - 15, gx + 12]) { F(x, 50, 4, 34, WD[2]); F(x, 50, 1, 34, WD[0]); }
    F(gx - 17, 54, 34, 3, WD[1]); F(gx - 17, 54, 34, 1, WD[0]);
    k.blob(gx, 51, 3, 3, "#ece4d2"); P(gx - 1, 51, "#5a4a3a"); P(gx + 1, 51, "#5a4a3a");
    F(0, HZ - 1, W, 1, WD[3]);
    haze(k, 40, HZ, "#e4dcc4", 0.28);
    ground(k, HZ, H, ["#a89060", "#9c8456", "#90784e", "#887048"], ["#b49c6a", "#84704a"], 36);
    const tent = (x, g, w, h) => { k.tri(x - 1, g - h - 1, w + 2, h + 1, "#4a3420"); for (let i = 0; i < h; i++) { const ins = (w / 2) * (h - 1 - i) / h; F(R(x + ins), g - h + i, R(w - 2 * ins), 1, "#c49e66"); F(R(x + ins), g - h + i, Math.max(1, R((w - 2 * ins) * 0.4)), 1, "#e2c690"); } k.tri(x + (w >> 1) - 3, g - 7, 7, 7, "#2a1c12"); };
    tent(2, GY(120), 36, 28); tent(220 + RX - 4, GY(118), 36, 26);
    const bone = (x, y) => { F(x, y, 3, 1, "#ece4d0"); P(x - 1, y - 1, "#ece4d0"); P(x + 3, y + 1, "#ece4d0"); };
    for (const [x, y] of [[42, 126], [210 + RX, 128], [30, 104], [226 + RX, 100], [60, 180], [330, 186]]) bone(x, y > 140 ? y : GY(y));
    for (const x of [44, 212 + RX]) { F(x, 86, 2, 14, WD[3]); k.blob(x + 1, 84, 2, 2, "#ece4d2"); }
    k.add(flutter(gx - 14, 40, 5, 9, "#b03a2a", "#d85a3a", "#7a2420"));
    k.add(flutter(gx + 13, 40, 5, 9, "#b03a2a", "#d85a3a", "#7a2420"));
    F(gx - 14, 40, 1, 10, WD[3]); F(gx + 13, 40, 1, 10, WD[3]);
    k.add(puffs(70, 70, "#c4bcb4", 5));
    vignette(k, "#2a1c10", 0.24);
  }

  function cave(k, o) {
    const { F, P } = k;
    const n = TS.paint.noise2d(o.seed);
    for (let y = 0; y < HZ; y++) for (let x = 0; x < W; x++) {
      const v = n(x / 7, y / 5);
      P(x, y, v > 0.64 ? o.wall[0] : v < 0.34 ? o.wall[2] : o.wall[1]);
    }
    for (let i = 0; i < W / 10; i++) { let x = k.ri(0, W), y = k.ri(4, HZ - 12); for (let j = 0; j < k.ri(4, 9); j++) { P(x, y, o.wall[2]); P(x + 1, y, o.wall[0]); x += k.ri(-1, 1); y++; } }
    for (let y = 0; y < HZ; y += 1) { const a = 0.35 * (1 - y / HZ) ** 2; k.ctx.globalAlpha = a; F(0, y, W, 1, o.shadow); }
    k.ctx.globalAlpha = 1;
    F(0, HZ - 2, W, 2, o.wall[2]);
    ground(k, HZ, H, o.floor, o.tex, o.seed + 1, 1.2);
    // the torchlight pools on the floor where the fight is and fades toward the viewer
    for (let y = 168; y < H; y++) { k.ctx.globalAlpha = 0.3 * (y - 168) / (H - 168); F(0, y, W, 1, o.shadow); }
    k.ctx.globalAlpha = 1;
  }

  function wolf_den(k, s) {
    const { F, P } = k;
    cave(k, { wall: ["#6a5a46", "#5a4a3a", "#4a3c30"], shadow: "#1e1610", floor: ["#6e5c44", "#64523c", "#5a4a36"], tex: ["#7a6850", "#4e4030"], seed: 41 });
    const ax = 196 + MX;
    for (let y = 0; y < 34; y++) { const hw = R(26 * Math.sqrt(Math.max(0, 1 - ((33 - y) / 34) ** 2))); F(ax - hw, HZ - 34 + y, hw * 2 + 1, 1, y < 20 ? "#4a5e6e" : "#3e525e"); }
    for (let i = 0; i < 8; i++) k.pine(ax - 22 + i * 6 + k.ri(-1, 1), HZ - 2, k.ri(8, 13), ["#2a3e40", "#304644", "#384e4a"]);
    k.blob(ax + 12, HZ - 26, 2, 2, "#e8e2cc");
    F(ax - 26, HZ - 2, 53, 2, "#3a3028");
    const BK = ["#7a6650", "#5e4e3c", "#46392c"];
    const hang = (x, len) => { for (let j = 0; j < len; j++) { const dx = R(Math.sin(j * 0.3 + x) * 1.5); F(x + dx, j, j < len - 6 ? 3 : 2, 1, BK[j % 5 === 0 ? 0 : 1]); P(x + dx + 2, j, BK[2]); } };
    for (const [x, l] of [[8, 60], [22, 40], [40, 26], [70, 18], [96, 12], [150, 9], [180 + RX, 14], [204 + RX, 24], [224 + RX, 44], [242 + RX, 58]]) hang(x, l);
    for (let x = 0; x < W; x++) { const t = R(6 + Math.sin(x * 0.08) * 3 + Math.sin(x * 0.21) * 2); F(x, 0, 1, t, "#2a2016"); }
    const bone = (x, y) => { F(x, y, 4, 1, "#e6decc"); P(x - 1, y - 1, "#e6decc"); P(x - 1, y + 1, "#e6decc"); P(x + 4, y - 1, "#e6decc"); P(x + 4, y + 1, "#e6decc"); };
    for (const [x, y] of [[14, 122], [36, 128], [216 + RX, 126], [238 + RX, 118], [28, 108], [226 + RX, 104]]) bone(x, GY(y));
    const sk = GY(126); k.blob(232 + RX - 6, sk, 3, 2, "#e6decc"); P(231 + RX - 6, sk, "#3a2e22"); P(233 + RX - 6, sk, "#3a2e22");
    for (let i = 0; i < 70; i++) { const x = k.ri(0, W), y = k.ri(88, H - 1); if (inField(x, y)) continue; P(x, y, k.pick(["#8a6a3a", "#a0783e", "#6a5236"])); }
    k.add({ draw(ctx, t) { for (const [x, y, ph] of [[20, 74, 0], [236 + RX, 70, 0.4]]) { const f = frac(t / 7 + ph); if (f > 0.5 || f < 0.04) continue; rect(ctx, x, y, 1, 1, "#e8c840"); rect(ctx, x + 3, y, 1, 1, "#e8c840"); } } });
    vignette(k, "#0e0a08", 0.32);
  }

  function collapsed_mine(k, s) {
    const { F, P } = k;
    cave(k, { wall: ["#7a7268", "#6a625a", "#5a534c"], shadow: "#16120e", floor: ["#76706a", "#6c665e", "#625c54"], tex: ["#827c74", "#58524a"], seed: 42 });
    const WD = ["#a07a4e", "#86643e", "#6a4c2e", "#4a3420"];
    for (const x of [30, 138, 246, 354]) { F(x, 14, 5, HZ - 14, WD[3]); F(x + 1, 14, 3, HZ - 14, WD[1]); F(x + 1, 14, 1, HZ - 14, WD[0]); }
    F(0, 10, W, 5, WD[3]); F(0, 11, W, 3, WD[1]); F(0, 11, W, 1, WD[0]);
    F(54, 30, 22, 4, WD[2]); ln(k.ctx, 54, 30, 76, 44, WD[3]);
    F(0, HZ + 2, W, 1, "#5a4a3a"); F(0, HZ + 5, W, 1, "#5a4a3a");
    for (let x = 0; x < W; x += 5) F(x, HZ + 1, 2, 6, WD[2]);
    for (let x = 0; x < W; x++) { P(x, HZ + 2, "#9a9aa2"); P(x, HZ + 5, "#9a9aa2"); }
    const pile = (cx, w, h, g) => { for (let i = 0; i < 30; i++) { const x = cx + k.ri(-w, w), y = g - k.ri(1, h); k.blob(x, y, k.ri(2, 4), k.ri(1, 3), k.pick(["#8a8278", "#6e665e", "#5a5048"])); } };
    pile(14, 16, 30, GY(132)); pile(244 + RX, 14, 28, GY(132));
    const mc = 214 + RX - 8;
    F(mc, 92, 14, 9, "#2a2626"); F(mc + 1, 93, 12, 6, "#5a5a62"); F(mc + 1, 93, 12, 1, "#8a8a92"); P(mc + 3, 102, "#1a1a1e"); P(mc + 11, 102, "#1a1a1e");
    for (let i = 0; i < 6; i++) P(mc + 2 + k.ri(0, 9), 92 - k.ri(0, 1), k.pick(["#e8ecf0", "#b8c0c8"]));
    const web = (cx, cy, sx, sy, r) => { for (let i = 0; i < 5; i++) { const q = i / 4 * Math.PI / 2; ln(k.ctx, cx, cy, cx + sx * Math.cos(q) * r, cy + sy * Math.sin(q) * r, "#9a9aa0"); } for (let ring = 4; ring < r; ring += 4) for (let i = 0; i < 4; i++) { const a0 = i / 4 * Math.PI / 2, a1 = (i + 1) / 4 * Math.PI / 2; ln(k.ctx, cx + sx * Math.cos(a0) * ring, cy + sy * Math.sin(a0) * ring, cx + sx * Math.cos(a1) * ring, cy + sy * Math.sin(a1) * ring, "#808088"); } };
    web(35, 15, 1, 1, 16); web(353, 15, -1, 1, 14);
    const pb = GY(114);
    F(4, 70, 2, pb - 70, WD[3]); F(1, 68, 8, 3, "#2a2420"); F(2, 69, 6, 2, "#ffd27a");
    k.add(flame(5, 68, 22));
    vignette(k, "#0e0c0a", 0.32);
  }

  function cragtooth_warren(k, s) {
    const { F, P } = k;
    cave(k, { wall: ["#a8704a", "#94603e", "#7e5034"], shadow: "#2a140a", floor: ["#b08a5e", "#a68056", "#9a764e"], tex: ["#bc966a", "#8e6a46"], seed: 43 });
    for (let y = 0; y < HZ; y += 6) for (let x = 0; x < W; x++) if (((x >> 3) + (y >> 2)) % 5 === 0) P(x, y + ((x >> 4) % 2), "#6e4430");
    const hole = (x, y, r) => { k.blob(x, y, r + 1, R(r * 0.7) + 1, "#5a3420"); k.blob(x, y, r, R(r * 0.7), "#1e1008"); F(x - r, y + R(r * 0.7), r * 2 + 1, 1, "#c08a5e"); };
    for (const [x, y, r] of [[30, 50, 7], [86, 40, 5], [128 + MX, 56, 6], [178 + MX, 44, 5], [226 + RX, 52, 7], [60, 70, 4], [200 + RX, 72, 4], [140, 66, 4], [270, 38, 5]]) hole(x, y, r);
    for (const x of [44, 212 + RX]) k.add(walltorch(k, x, 60));
    const chest = (x, g, open) => { F(x - 1, g - 9, 14, 10, "#3a2010"); F(x, g - 8, 12, 8, "#b07a3a"); F(x, g - 8, 12, 1, "#d09a50"); F(x, g - 5, 12, 1, "#6a4418"); F(x + 5, g - 6, 2, 3, "#f0d040"); if (open) { F(x, g - 12, 12, 3, "#8a5a28"); for (let i = 0; i < 5; i++) P(x + 1 + i * 2, g - 9, "#f4f0e0"); } };
    chest(8, GY(126), false); chest(232 + RX - 4, GY(122), true); chest(24, GY(116), false);
    const glints = [];
    for (let i = 0; i < 36; i++) { const x = k.pick([k.ri(2, 46), k.ri(W - 46, W - 2)]), y = k.ri(GY(110), GY(131)); P(x, y, k.pick(["#f0d040", "#e8b830", "#fff4a0"])); if (i < 5) glints.push([x, y]); }
    k.add(sparkle(glints));
    vignette(k, "#1a0c06", 0.3);
  }

  function ashveil_crypts(k, s) {
    const { F, P } = k;
    const ST = ["#8e9088", "#7c7e76", "#6a6c66", "#565852"];
    F(0, 0, W, HZ, ST[2]);
    k.stones(0, 0, W, HZ, [ST[0], ST[1], ST[2], ST[3]], 6);
    for (const x of [60, 132, 252, 324]) {
      F(x - 10, 24, 20, 34, ST[3]);
      for (let a = 0; a <= 20; a++) { const q = Math.PI + a / 20 * Math.PI; F(x + R(Math.cos(q) * 10), 24 + R(Math.sin(q) * 10), 1, 10, ST[3]); }
      F(x - 9, 24, 18, 34, "#3e403c");
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { const sx = x - 7 + c * 9, sy = 28 + r * 10; F(sx, sy, 6, 6, "#2e302c"); k.blob(sx + 3, sy + 3, 2, 2, "#c8c4b0"); P(sx + 2, sy + 3, "#2e302c"); P(sx + 4, sy + 3, "#2e302c"); }
    }
    F(0, HZ - 4, W, 4, ST[3]); F(0, HZ - 4, W, 1, ST[1]);
    const n = TS.paint.noise2d(44);
    for (let y = 0; y < HZ; y++) for (let x = 0; x < W; x++) if (n(x / 8, y / 8) > 0.7 && k.on(x, y, 0.4)) P(x, y, "#5e6e56");
    haze(k, 0, HZ, "#2a302c", 0.25);
    k.grad(HZ, H, ["#7a7c74", "#70726a", "#666860", "#5e6058"]);
    for (let y = HZ, h = 3; y < H; y += h, h = Math.min(14, h + 1)) {
      k.F(0, y, W, 1, "#5e605a");
      for (let x = (y * 7) % 13; x < W; x += 14 + h * 2) k.F(x, y, 1, h, "#62645c");
    }
    const pb = GY(114);
    for (const x of [6, 354]) { F(x, 6, 24, pb, "#4e504a"); F(x + 2, 6, 20, pb, ST[1]); F(x + 2, 6, 4, pb, ST[0]); F(x + 18, 6, 4, pb, ST[2]); F(x - 2, 4, 28, 4, ST[0]); }
    const sarc = (x, g) => { F(x - 1, g - 11, 30, 12, "#3e403c"); F(x, g - 10, 28, 10, ST[1]); F(x, g - 10, 28, 2, ST[0]); F(x + 3, g - 7, 22, 1, ST[3]); };
    sarc(-4, GY(130)); sarc(232 + RX - 4, GY(128));
    const candles = [[36, 76], [60, 70], [196 + RX, 70], [220 + RX, 76]];
    for (const [x, y] of candles) { F(x - 1, y, 3, 6, "#e8e0c8"); k.add(flame(x, y, 12)); }
    for (const [x, y] of candles) if (window.Anim) k.add({ draw(ctx, t) { Anim.light(ctx, x, y - 3, 14, "140,255,160", 0.08 + 0.03 * Math.sin(t * 3 + x)); } });
    vignette(k, "#0c0e0c", 0.34);
  }

  function thornmere_ruins(k, s) {
    const { F, P } = k;
    k.grad(0, HZ, ["#2e4a56", "#3a5a62", "#527470", "#6e8c7e"]);
    for (let i = 0; i < 40; i++) P(k.ri(0, W), k.ri(0, 30), "#a8c4c8");
    const ST = ["#a2ac9e", "#8a9488", "#727c72", "#5a645c"];
    for (const [x, h, lean] of [[60 + MX, 40, 0], [96 + MX, 52, 2], [160 + MX, 48, -2], [196 + MX, 34, 3], [20, 30, 1], [350, 26, -2]]) { for (let j = 0; j < h; j++) { const dx = R(lean * j / h); F(x + dx, HZ - j, 7, 1, ST[1]); F(x + dx, HZ - j, 2, 1, ST[0]); F(x + dx + 5, HZ - j, 2, 1, ST[3]); } F(x - 2 + R(lean), HZ - h - 2, 11, 3, ST[1]); }
    F(92 + MX, HZ - 54, 76, 4, ST[2]); F(92 + MX, HZ - 54, 76, 1, ST[0]);
    haze(k, 20, HZ, "#6a8a80", 0.3);
    k.grad(HZ, H, ["#4e6c66", "#46625c", "#3e5852", "#38504a"]);
    for (let y = HZ, h = 3; y < H; y += h, h = Math.min(14, h + 1)) { F(0, y, W, 1, "#3a524c"); for (let x = (y * 7) % 13; x < W; x += 16 + h * 2) F(x, y, 1, h, "#3e5650"); }
    for (let y = HZ + 1; y < H; y += 3) for (let x = 0; x < W; x++) if (k.r() < 0.03) F(x, y, k.ri(3, 7), 1, "#6a8a84");
    for (const [x, y] of [[10, 124], [30, 118], [228 + RX, 126], [244 + RX, 112], [18, 102]]) { const yy = GY(y); k.blob(x, yy, 4, 2, "#3e6a3e"); P(x + 1, yy - 1, "#5a8a4e"); P(x - 1, yy, "#f0ece0"); }
    const TH = ["#6a3e2c", "#4e2c20", "#2e1a12"];
    const vine = (pts) => { for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; ln(k.ctx, x0, y0 + 1, x1, y1 + 1, TH[2]); ln(k.ctx, x0, y0, x1, y1, TH[1]); ln(k.ctx, x0, y0 - 1, x1, y1 - 1, TH[0]); const nn = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let s2 = 2; s2 < nn; s2 += 3) { const x = R(x0 + (x1 - x0) * s2 / nn), y = R(y0 + (y1 - y0) * s2 / nn); P(x + (s2 % 2 ? 1 : -1), y - 2, "#c8b4a0"); } } };
    vine([[-4, 20], [14, 36], [8, 62], [24, GY(90)], [12, GY(132)]]); vine([[W + 4, 30], [368, 50], [378, 80], [360, GY(108)], [374, GY(132)]]); vine([[0, GY(110)], [20, GY(104)], [38, GY(118)], [44, GY(132)]]);
    if (window.Anim) k.add(Anim.wisp({ x: 110 + MX, y: 50, w: 50, h: 14, rgb: "150,240,210", col: "#e0fff4", seed: 5 }));
    vignette(k, "#0e1a1a", 0.3);
  }

  function frostspire(k, s) {
    const { F, P } = k;
    const IC = ["#e8f8ff", "#c4e8f8", "#9ad0ec", "#74b4dc", "#5294c6"];
    for (let x = -2; x < W;) {
      const w = k.ri(7, 15), c = k.pick(["#86b2da", "#92bce0", "#9ec4e4", "#7eaad4"]);
      k.grad(0, HZ, [k.mix(c, "#4a7ab0", 0.25), c, k.mix(c, "#e8f6ff", 0.3)], x, x + w);
      F(x, 0, 1, HZ, k.mix(c, "#ffffff", 0.35)); F(x + w - 1, 0, 1, HZ, k.mix(c, "#3a6a9a", 0.25));
      if (k.r() < 0.5) { const y = k.ri(10, 60); ln(k.ctx, x + 2, y, x + w - 3, y + k.ri(2, 6), k.mix(c, "#ffffff", 0.25)); }
      x += w;
    }
    for (let x = 0; x < W; x += k.ri(3, 7)) { const l = k.ri(3, 11); for (let j = 0; j < l; j++) P(x, j, j < l - 2 ? "#d8eef8" : "#ffffff"); if (l > 6) P(x + 1, 0, "#c4e2f2"); }
    const shard = (x, g, h, w, lean) => { for (let j = 0; j < h; j++) { const u = j / h, hw = Math.max(0, R(w * (1 - u) ** 0.7)), cx = x + R(lean * u); F(cx - hw, g - j, hw * 2 + 1, 1, IC[3]); F(cx - hw, g - j, Math.max(1, hw), 1, IC[1]); P(cx, g - j, IC[0]); P(cx + hw, g - j, IC[4]); } };
    for (const [x, h, w, lean] of [[8, 80, 7, 2], [24, 54, 5, -3], [38, 30, 3, 4], [246 + RX, 86, 8, -2], [228 + RX, 58, 5, 3], [214 + RX, 28, 3, -4]]) shard(x, GY(HZ + 30), up(HZ + 30, h), w, lean);
    haze(k, 0, HZ, "#d8ecf8", 0.16);
    ground(k, HZ, H, ["#d4e8f4", "#c8e0f0", "#bcd8ec", "#b4d0e6"], ["#e4f2fa", "#aacce4"], 47);
    for (let i = 0; i < 22; i++) { const x = k.ri(0, W), y = k.ri(90, H - 2); ln(k.ctx, x, y, x + k.ri(4, 12), y + k.ri(-1, 1), "#e8f6fc"); }
    for (const [x, g, h, w, lean] of [[16, 132, 26, 4, 3], [240 + RX, 130, 24, 4, -3], [34, 126, 12, 2, 2]]) shard(x, GY(g), up(g, h) - 20, w, lean);
    k.add(sparkle([[10, 40], [26, 60], [40, 70], [214 + RX, 66], [230 + RX, 52], [246 + RX, 30]]));
    vignette(k, "#1e3a5a", 0.22);
  }

  function sunken_vault(k, s) {
    const { F, P } = k;
    const MB = ["#c8c4b0", "#b0ac98", "#969280", "#7a7666"];
    F(0, 0, W, HZ, "#4a6a6e");
    for (let i = 0; i < 7; i++) {
      const x = 8 + i * 60;
      for (let a = 0; a <= 30; a++) { const q = Math.PI + a / 30 * Math.PI; F(x + 22 + R(Math.cos(q) * 22), 30 + R(Math.sin(q) * 18), 2, 2, MB[2]); }
      F(x + 4, 30, 36, HZ - 30, "#2e4a50");
    }
    for (const x of [2, 60, 120, 180, 240, 300, 360]) { F(x, 6, 12, HZ, MB[1]); F(x, 6, 3, HZ, MB[0]); F(x + 9, 6, 3, HZ, MB[3]); F(x - 2, 4, 16, 4, MB[0]); for (let i = 0; i < 10; i++) P(x + k.ri(1, 10), k.ri(30, HZ - 2), k.pick(["#e8e4d8", "#5a7a5a", "#7a9a6a"])); }
    F(0, 0, W, 6, MB[2]);
    const caust = { draw(ctx, t) { ctx.globalAlpha = 0.07; for (let i = 0; i < 20; i++) { const x = (i * 37 + Math.sin(t * 0.6 + i) * 6) % W, y = 10 + (i * 13) % 60; rect(ctx, x, y, 6 + (i % 3) * 3, 1, "#d8f4f0"); } ctx.globalAlpha = 1; } };
    k.add(caust);
    haze(k, 0, HZ, "#2e4a50", 0.22);
    k.grad(HZ, H, ["#8c8a78", "#828070", "#787666", "#706e60"]);
    for (let y = HZ, h = 3; y < H; y += h, h = Math.min(15, h + 1)) { F(0, y, W, 1, "#6e6c5e"); for (let x = (y * 5) % 17; x < W; x += 18 + h * 2) F(x, y, 1, h, "#727062"); }
    for (const [x, y, w] of [[60 + MX, 98, 30], [170 + MX, 104, 36], [110 + MX, 124, 40]]) { k.ctx.globalAlpha = 0.35; k.blob(x, GY(y), w >> 1, 1, "#9ab8b8"); k.ctx.globalAlpha = 1; }
    const gold = (cx, g, w, h) => { for (let i = 0; i <= w; i++) { const u = (i - w / 2) / (w / 2), hh = R((1 - u * u) * h); F(cx - (w >> 1) + i, g - hh, 1, hh, u < 0 ? "#e8b838" : "#c8942a"); P(cx - (w >> 1) + i, g - hh, "#fff0a0"); } };
    gold(18, GY(128), 34, 12); gold(240 + RX, GY(126), 30, 11); gold(40, GY(118), 14, 5);
    for (let i = 0; i < 10; i++) { const x = k.pick([k.ri(4, 44), k.ri(W - 34, W - 4)]); F(x, GY(112) + k.ri(0, 18), 1, 1, "#fff8c0"); }
    for (const x of [8, 30, 228 + RX, 246 + RX]) { const b = GY(132); for (let j = 0; j < 30; j++) P(x + R(Math.sin(j * 0.5 + x) * 1.5), b - j, j % 2 ? "#3e6a44" : "#5a8a52"); }
    k.add(sparkle([[12, GY(120)], [26, GY(124)], [232 + RX, GY(118)], [246 + RX, GY(122)]]));
    vignette(k, "#0a1418", 0.3);
  }

  function emberdeep(k, s) {
    const { F, P } = k;
    cave(k, { wall: ["#564240", "#4c3a36", "#42322e"], shadow: "#120808", floor: ["#5a4642", "#52403c", "#4a3a36"], tex: ["#64504a", "#3e302c"], seed: 48 });
    const ly = 50;
    F(0, ly - 2, W, 7, "#2a1a16");
    for (let x = 0; x < W; x++) { const y = ly + R(Math.sin(x * 0.07) * 1.5); F(x, y, 1, 3, "#c85a26"); if ((x >> 2) % 3 === 0) P(x, y + 1, "#f09a40"); P(x, y - 1, "#6a2a18"); }
    for (let y = ly + 4; y < HZ; y++) { k.ctx.globalAlpha = 0.12 * (1 - (y - ly) / (HZ - ly)); F(0, y, W, 1, "#c85a26"); }
    k.ctx.globalAlpha = 1;
    for (const x of [6, 48, 200 + RX, 246 + RX]) { for (let j = 0; j < 40; j++) { const hw = R((40 - j) / 40 * 6); F(x - hw, HZ - j, hw * 2 + 1, 1, j % 5 === 0 ? "#3a2a26" : "#4a3632"); } }
    const glow = { draw(ctx, t) { if (!window.Anim) return; for (const x of [60, 192, 324]) Anim.light(ctx, x, ly + 2, 30, "255,110,40", 0.08 + 0.03 * Math.sin(t * 0.8 + x)); } };
    k.add(glow);
    for (let i = 0; i < 46; i++) { const x = k.ri(0, W), y = k.ri(88, H - 1); if (inField(x, y)) continue; const l = k.ri(3, 8); ln(k.ctx, x, y, x + l, y + k.ri(-1, 1), "#8a3a1e"); }
    const gold = (cx, g, w, h) => { for (let i = 0; i <= w; i++) { const u = (i - w / 2) / (w / 2), hh = R((1 - u * u) * h); F(cx - (w >> 1) + i, g - hh, 1, hh, u < 0 ? "#e8b838" : "#b8842a"); P(cx - (w >> 1) + i, g - hh, "#fff0a0"); } };
    gold(238 + RX, GY(130), 40, 16);
    const sk = GY(124);
    k.blob(20, sk, 3, 2, "#d8d0c0"); P(19, sk, "#2a1e1a"); P(21, sk, "#2a1e1a"); ln(k.ctx, 26, GY(128), 30, GY(128) - 16, "#9a9aa4");
    if (window.Anim) { k.add(Anim.embers({ x0: 0, x1: 50, y: 172, n: 5, rise: 90, seed: 1 })); k.add(Anim.embers({ x0: W - 50, x1: W, y: 172, n: 5, rise: 90, seed: 2 })); }
    vignette(k, "#0a0404", 0.34);
  }

  // ---------- towns ----------
  function town(k, s) {
    const { F, P } = k, id = s.place, d = s.town || {}, th = TS.THEME[id] || { primary: "#b83a32", accent: "#e8b84a", dark: "#2e2a36", light: "#ece8e0" };
    const biome = d.biome || "plains", snowy = biome === "snow", marsh = biome === "marsh", coast = biome === "coast", forest = biome === "forest";
    k.grad(0, HZ, snowy ? ["#7aa2d0", "#a0bede", "#cadcee", "#e6eef6"] : marsh ? ["#7a8a86", "#94a09a", "#acb4a6", "#c0c2ae"] : ["#72a8da", "#98c0e2", "#c4d8e2", "#e4dcc4"]);
    if (coast) { F(0, 62, W, 22, "#5e94c4"); F(0, 62, W, 1, "#a8cce8"); }
    if (forest) TS.paint.grove(k, 60, "#8cb496", "#9cc2a2", null, 8, 12, 12, 24);
    const mark = TOWN_MARKS[id];
    if (mark) mark(k, th);
    const roofs = [[th.primary, k.mix(th.primary, "#000000", 0.25), k.mix(th.primary, "#000000", 0.45)], [k.mix(th.dark, "#ffffff", 0.35), k.mix(th.dark, "#ffffff", 0.2), th.dark]];
    const wall = snowy ? ["#a08066", "#86684e", "#6a503a"] : ["#f0e6d0", "#ddd0b4", "#bca88a"];
    for (let x = -6, i = 0; x < W; i++) {
      const w = k.ri(18, 30), wh = k.ri(11, 18), g = HZ - 6 - (marsh ? 4 : 0);
      const h = k.house({ x, g, w, wh, rh: k.ri(6, 10), wall, roof: roofs[i % 2], frame: d.size === "city" ? null : "#6a5040", ol: "#4a3e36", type: i % 3 === 1 ? "gable" : "hip", lit: false, wins: Math.max(1, Math.floor(w / 9)), doorAt: R(w / 2) - 1, chim: i % 2 ? "r" : null, chimC: "#9a8e84", snow: snowy, logs: snowy ? "#5a4434" : null });
      if (h.chim && i % 4 === 1) k.add(puffs(h.chim[0], h.chim[1], snowy ? "#d0d8e4" : "#dcdcd8", 3));
      if (marsh) for (let sx = x + 2; sx < x + w; sx += 6) F(sx, g, 1, 4, "#4a3a2a");
      x += w + k.ri(2, 8);
    }
    if (s.raid) {
      for (const [x, y] of [[58, 66], [190 + RX, 64]]) {
        k.add(column(x, y, 50, 9));
        k.add(flame(x - 3, y + 2, 20)); k.add(flame(x + 2, y + 1, 10));
      }
    }
    k.add(flutter(R(W * 0.5) - 3, 30, 6, 10, th.primary, k.mix(th.primary, "#ffffff", 0.25), k.mix(th.primary, "#000000", 0.3), th.accent));
    F(R(W * 0.5) - 4, 28, 1, 22, "#4a3a2a");
    haze(k, 20, HZ, snowy ? "#eef3fa" : "#e8e8e0", 0.42);
    k.F(0, HZ - 6, W, 6, marsh ? "#7a8a80" : snowy ? "#d0d8e4" : "#bcb29c");
    if (marsh) {
      k.grad(HZ, H, ["#8a7458", "#806c52", "#76644c", "#6e5e46"]);
      for (let y = HZ, h = 4; y < H; y += h, h = Math.min(12, h + 1)) { F(0, y, W, 1, "#5e4c38"); for (let x = (y * 3) % 11; x < W; x += 22) F(x, y, 1, h, "#66543e"); }
    } else {
      paving(k, HZ, H, snowy ? ["#dce2ec", "#d2dae6", "#e4eaf2"] : ["#cabea6", "#c2b69e", "#d0c4ac"], snowy ? "#c4ccda" : "#b0a690");
    }
    if (s.pvp) {
      const crowd = (x0, x1, g) => {
        for (let x = x0; x < x1; x += k.ri(5, 7)) {
          const c = k.pick(["#7a4a3a", "#3a5a7a", "#8a7a44", "#5a6a4a", "#8a5a4a", "#4a6a6a"]), sk = k.pick(["#e0b088", "#c48a5e", "#9a6440"]), hr = k.pick(["#3a2a1a", "#6a4020", "#c8a050", "#2a2228"]), yy = g + k.ri(-1, 1);
          F(x - 1, yy - 9, 6, 9, "#2a2420"); F(x, yy - 8, 4, 8, c); F(x, yy - 8, 1, 8, k.mix(c, "#ffffff", 0.2));
          F(x, yy - 13, 4, 5, "#2a2420"); F(x + 1, yy - 12, 2, 3, sk); F(x + 1, yy - 13, 2, 1, hr);
          if (k.r() < 0.35) { F(x + (k.r() < 0.5 ? -2 : 4), yy - 14, 2, 6, "#2a2420"); }
        }
      };
      crowd(0, 44, GY(96)); crowd(W - 44, W, GY(96)); crowd(4, 40, GY(120)); crowd(W - 36, W - 4, GY(122));
      crowd(60, 324, 96);
    }
    if (snowy && window.Anim) k.add({ draw(ctx, t) { for (let i = 0; i < 26; i++) { const x = frac(i * 0.618 + t * 0.01) * W, y = frac(i * 0.37 + t * 0.035) * 60; rect(ctx, x, y, 1, 1, "#ffffff"); } } });
    vignette(k, "#2a2420", 0.24);
  }

  const TOWN_MARKS = {
    ironhaven(k, th) {
      const { F } = k, x = 186 + MX;
      F(x - 7, 26, 15, 50, "#c8c4be"); F(x - 6, 27, 13, 49, "#e2ded6"); F(x - 6, 27, 4, 49, "#f0ece6"); F(x + 4, 27, 3, 49, "#c4beb6");
      k.tri(x - 9, 12, 19, 15, "#7a8aa8"); k.tri(x - 8, 13, 9, 14, "#9aaac4");
      F(x - 1, 6, 1, 7, "#5a4a3a"); F(x, 6, 5, 3, th.primary);
      for (let y = 34; y < 70; y += 9) F(x - 1, y, 3, 4, "#6a6a7a");
      F(0, 58, W, 18, "#d0ccc4"); for (let xx = 0; xx < W; xx += 4) F(xx, 56, 2, 2, "#d0ccc4"); F(0, 58, W, 1, "#e6e2da");
    },
    thornwall(k) {
      const { F, P } = k;
      for (let x = 0; x < W; x += 3) { const h = 22 + ((x * 7) % 5); F(x, HZ - h, 3, h, "#9a7048"); F(x, HZ - h, 1, h, "#b8885a"); P(x + 1, HZ - h - 1, "#6a4a2e"); }
      const tx = 56; F(tx - 6, 36, 2, 30, "#6a4a2e"); F(tx + 6, 36, 2, 30, "#6a4a2e"); F(tx - 8, 32, 18, 4, "#8a6440"); k.tri(tx - 9, 24, 20, 8, "#a8603a");
    },
    veldrock(k) {
      k.ridge(56, 16, 30, "#a4a8b0", 91, "#b8bcc4");
      const { F } = k;
      for (const x of [40, 210 + RX]) { F(x, 30, 5, 40, "#7a6e66"); F(x, 30, 2, 40, "#968a80"); k.add(TS.actors.plume({ x: x + 2, y: 28, n: 6, rise: 22, life: 5, wind: 8, seed: x })); }
    },
    carrbridge(k) {
      const { F } = k;
      F(0, 70, W, 6, "#6a9cc8"); F(0, 70, W, 1, "#a8d0ec");
      for (const [x0, x1] of [[60, 165], [165, 270]]) { for (let x = x0; x <= x1; x++) { const u = (x - x0) / (x1 - x0), y = 56 + R(Math.sin(u * Math.PI) * -8); F(x, y, 1, 3, "#b8ae9c"); if (u > 0.08 && u < 0.92) F(x, y + 3, 1, R(14 * (1 - Math.sin(u * Math.PI))) + 1, "#a49a88"); } }
      F(54, 48, 222, 2, "#c8beac");
    },
    ashfen(k) {
      const { F } = k;
      F(0, 76, W, 8, "#6a7e74"); for (let x = 0; x < W; x += 3) if (k.r() < 0.4) F(x, 78, k.ri(2, 6), 1, "#8a9e94");
      for (let i = 0; i < 15; i++) { const x = k.ri(0, W), h = k.ri(10, 18); ln(k.ctx, x, 74, x, 74 - h, "#8a9288"); ln(k.ctx, x, 74 - h + 4, x + 4, 74 - h, "#8a9288"); }
    },
    saltmarrow(k) {
      const { F } = k, x = 226 + RX;
      for (let y = 30; y < 70; y++) { const hw = 4 - R((y - 30) / 16); F(x - hw, y, hw * 2 + 1, 1, Math.floor((y - 30) / 6) % 2 ? "#f4f0e8" : "#c8463a"); }
      F(x - 4, 24, 9, 6, "#3a3a44"); F(x - 3, 25, 7, 4, "#fff0a0"); k.tri(x - 5, 18, 11, 6, "#a83a32");
    },
    hollowood(k) {
      TS.paint.grove(k, 64, "#7aa888", "#8ab896", "#5e7e62", 9, 14, 13, 25);
    },
    frosthold(k) {
      TS.paint.range(k, { peaks: [[75, 30, 0.9, 1], [225, 22, 1, 0.9], [354, 34, 1, 1]], base: HZ, lit: "#e2eaf4", shade: "#b8c6da", rim: "#ffffff", rock: "#9aa8c0", rockLit: "#c8d4e4", jag: 3, seed: 93 });
    },
  };

  // ---------- night, for a fight at a camp after dark ----------
  function night(k, s) {
    const ctx = k.ctx;
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "#58689a"; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.2; ctx.fillStyle = "#0e1428"; ctx.fillRect(0, 0, W, HZ); ctx.globalAlpha = 1;
    for (let i = 0; i < 60; i++) k.P(k.ri(0, W), k.ri(0, 46), k.r() < 0.3 ? "#ffffff" : "#9aa8c8");
    k.blob(44, 18, 4, 4, "#f4ecd0"); k.blob(46, 17, 3, 3, "#3a4466");
    const fx = 228 + RX, fy = GY(118);
    if (window.Anim) k.add({ draw(c, t) { Anim.light(c, fx, fy - 4, 70, "255,150,70", 0.2 + 0.04 * Math.sin(t * 5.3) + 0.03 * Math.sin(t * 11.1)); } });
    k.F(fx - 7, fy, 15, 2, "#2a1a10"); ln(ctx, fx - 6, fy - 1, fx + 5, fy + 1, "#5a3a22"); ln(ctx, fx + 6, fy - 1, fx - 5, fy + 1, "#4a3020");
    k.add({ draw(c, t) { for (let i = -3; i <= 3; i++) { const h = Math.max(1, R((7 - Math.abs(i) * 1.6) * (0.75 + 0.25 * Math.sin(t * 9 + i * 2)))); for (let j = 0; j < h; j++) rect(c, fx + i, fy - 1 - j, 1, 1, j > h * 0.6 ? "#c8401e" : j > h * 0.3 ? "#f07a2a" : "#ffd27a"); } } });
  }

  const PLACES = { kingsroad, greenwood, bleakmarsh, redcrag, whitepeak, saltcliffs, goblin_camp, wolf_den, collapsed_mine, cragtooth_warren, ashveil_crypts, thornmere_ruins, frostspire, sunken_vault, emberdeep };
  const BIOME = { plains: kingsroad, forest: greenwood, marsh: bleakmarsh, hills: redcrag, snow: whitepeak, coast: saltcliffs, volcanic: emberdeep };
  const THEME_PAINT = { goblin: goblin_camp, beast: wolf_den, cave: collapsed_mine, undead: ashveil_crypts, swamp: thornmere_ruins, ice: frostspire, sea: sunken_vault, fire: emberdeep };
  // the floor's own colours, so decals and shadows can be tinted to sit on it
  const FLOORS = { kingsroad: "#b4a688", greenwood: "#6e9648", bleakmarsh: "#5a6046", redcrag: "#ac7652", whitepeak: "#d8e2ee", saltcliffs: "#c6b896",
    goblin_camp: "#90784e", wolf_den: "#5a4a36", collapsed_mine: "#625c54", cragtooth_warren: "#9a764e", ashveil_crypts: "#666860", thornmere_ruins: "#3e5852",
    frostspire: "#bcd8ec", sunken_vault: "#787666", emberdeep: "#4a3a36", town: "#b0a690" };

  // what the stored fight says about where it happened: the place id, the context (road, camp, raid...) and pvp
  function setting(f) {
    const S = (window.App && App.S) || (window.LD && LD.static) || {}, place = f.place;
    const ctxName = f.context || (f.kind === "pvp" ? "pvp" : null);
    const s = { place, context: ctxName, pvp: f.kind === "pvp", road: ctxName === "road", raid: ctxName === "raid" };
    if (S.towns && S.towns[place]) { s.town = S.towns[place]; s.paint = town; s.floor = FLOORS.town; return s; }
    const dg = S.dungeons && S.dungeons[place], wd = S.wilds && S.wilds[place];
    s.paint = PLACES[place] || (dg && THEME_PAINT[dg.theme]) || BIOME[(dg || wd || {}).biome] || kingsroad;
    s.floor = FLOORS[s.paint.name] || "#8a7a60";
    s.outdoor = !dg || dg.theme === "goblin";
    s.night = ctxName === "camp" && s.outdoor;
    return s;
  }

  function backdrop(f) {
    const s = setting(f || {});
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const k = TS.kit(ctx, W, H, Art.hash("field:" + (s.place || "") + (s.context || "")));
    const acts = [];
    k.add = (a) => { if (a) acts.push(a); };
    s.paint(k, s);
    if (s.night) {
      // daylight life (drifting clouds, gulls) has no place after dark; fires and torches stay lit
      for (let i = acts.length - 1; i >= 0; i--) if (!acts[i].keep) acts.splice(i, 1);
      night(k, s);
    }
    cv.setting = s;
    cv.life = (c, t) => { for (const a of acts) a.draw(c, t); };
    return cv;
  }

  window.Battlefield = { backdrop, setting, W, H, HZ, GY };
})();
