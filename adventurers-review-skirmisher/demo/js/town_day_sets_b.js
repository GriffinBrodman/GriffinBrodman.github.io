/* Town day sets, more of them (registered with TownSets.register): the smithy, the bathhouse and the fortune-teller's tent. */
(function (root) {
  "use strict";
  const R = Math.round;
  const Tv = () => root.Tavern;
  const K = () => root.TownSets.kit;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- round things in screen space: an ellipse, an upright cylinder shaded across its width ----------
  function ell(g, cx, cy, rx, ry, col) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const c = typeof col === "function" ? col(dx, dy, x, y) : col;
      if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
    }
  }
  function cyl(g, cx, cy, rx, ry, h, side) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const t = (x + 0.5 - cx) / rx;
      if (Math.abs(t) > 1) continue;
      const e = ry * Math.sqrt(1 - t * t), y0 = R(cy - h + e), y1 = R(cy + e);
      for (let y = y0; y < y1; y++) { const c = side(t, y - y0, y1 - y0, x, y); if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); } }
    }
  }
  const across = (c, t) => { const sh = K().shade; return t < -0.55 ? sh(c, 0.14) : t < 0.1 ? c : t < 0.6 ? sh(c, -0.16) : sh(c, -0.34); };
  // a point on a block's face as (along, height): the face at u = U runs along v, the face at v = V along u
  const faceU = (st, U) => (x, y) => { const v = (st.OX + 8 * U - x - 0.5) / 8; return [v, st.OY + 4 * (U + v) - y - 0.5]; };
  const faceV = (st, V) => (x, y) => { const u = (x + 0.5 - st.OX + 8 * V) / 8; return [u, st.OY + 4 * (u + V) - y - 0.5]; };
  function onWall(ctx, st, side, a, h, rows, pal) { const [x, y] = (side === "l" ? st.lwall : st.rwall)(a, h); K().pix(ctx, R(x) - (rows[0].length >> 1), R(y) - (rows.length >> 1), rows, pal); }
  // a piece of furniture that moves: its canvas is repainted each frame by an anim, which the scene runs before it draws the things
  function live(k, key, paint) {
    const c = k.piece(), g = c.getContext("2d");
    k.add(key, c);
    paint(g, 1.3, true);
    k.anims.push((ctx, t, still) => { g.clearRect(0, 0, c.width, c.height); paint(g, t, still); });
  }
  const flick = (t) => 0.75 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.08;
  const FLAME = ["#fff6c4", "#ffc844", "#f07c26", "#b83818"];
  function tongue(g, x, y, h, t, i) {
    for (let j = 0; j < h; j++) {
      const s = j > h * 0.55 ? R(Math.sin(t * 6 + i * 0.9) * 0.8) : 0, c = FLAME[j < h * 0.25 ? 0 : j < h * 0.5 ? 1 : j < h * 0.8 ? 2 : 3];
      g.fillStyle = c; g.fillRect(R(x) + s, R(y) - j, 1, 1);
      if (j < h * 0.4) { g.fillStyle = FLAME[Math.min(3, (j < h * 0.2 ? 1 : 2))]; g.fillRect(R(x) + s + 1, R(y) - j, 1, 1); }
    }
  }
  const TOOLPAL = { l: "#c4c8d0", m: "#7e828c", d: "#3e4048", w: "#9a6a3a", x: "#5a3a1e", k: "#1e1612", g: "#c8962a", y: "#e8c060" };

  // ---------- the smithy: the forge in the left wall, the anvil, the quench tub, the tool wall, the grindstone, sparks ----------
  function smithy(k) {
    const { st, ctx, S, r, L } = k, P = Tv(), kit = K(), { shade, mix, pix, h01, frac, M, F } = kit;
    L.lamps = true;
    const FV0 = 2.2, FV1 = 5.6, FU = 2.0, FH = 13, MID = (FV0 + FV1) / 2;
    const masonry = S.wall === "brick" ? M.brick(S.brick, S.mortar) : M.stone(S.stone, S.mortar, 6, 1.1);
    const plinth = M.stone(S.stone.map((c) => shade(c, -0.22)), shade(S.mortar, -0.3), 7, 1.5);
    const soot = (side, a, h) => Math.min(0.3, h / 260) + (side === "l" ? 0.55 * clamp(1 - Math.abs(a - MID) / 3.4, 0, 1) * clamp((h - 10) / 40, 0, 1) : 0);
    const wall = (side) => (a, h) => shade(h < 10 ? plinth(a, h) : masonry(a, h), -soot(side, a, h));
    const flags = F.flags(S.stone.map((c) => shade(c, -0.18)), shade(S.mortar, -0.35));
    kit.room(k, wall("r"), (u, v) => {
      const n = h01(Math.floor(u * 11), Math.floor(v * 11)), burn = clamp(1 - Math.hypot((u - 2.4) / 2.6, (v - MID) / 3.4), 0, 1);
      if (n > 0.988) return "#2a1e18";
      if (n < 0.008) return "#7a4422";
      return shade(flags(u, v), -burn * 0.35);
    }, { left: wall("l"), right: wall("r"), ceiling: "#16100c", beam: "#20160f", skirt: shade(S.stone[1], -0.5) });
    kit.window_(k, "l", 9.6, 11.0, 30, 46, { frame: "#2a2018", reach: 3.5, bars: [10.05, 10.55] });

    // the open double door in the right wall, the street beyond, the day falling in across the flags
    const DA = 11.0, DB = 13.4, DH = 40;
    P.fillPoly(ctx, st.quad(st.rwall, DA - 0.3, DB + 0.3, 0, DH + 4), "#2a1a10");
    const opp = kit.wallOf(S);
    P.fillPoly(ctx, st.quad(st.rwall, DA, DB, 0, DH), (x, y) => {
      const [a, h] = st.onR(x, y);
      let c = h < 7 ? (frac(a * 3) < 0.12 || h % 3 < 1 ? S.gap : S.cobble[Math.floor(h01(R(a * 3), R(h / 3)) * 3)]) : h < 31 ? opp(a * 1.4, h - 6) : mix(L.sky[1], L.sky[0], (h - 31) / 9);
      if (h >= 7 && h < 31 && Math.abs(a - 12.2) < 0.35 && h > 14 && h < 24) c = L.lamps ? "#f4c870" : "#4a6a8a";
      return L.night ? shade(c, -0.6) : c;
    });
    P.fillPoly(ctx, st.quad(st.rwall, DB + 0.35, DB + 1.5, 0, DH - 1), (x, y) => { const [a, h] = st.onR(x, y); return frac(a * 3.4) < 0.14 ? "#3a2414" : Math.abs(h - 8) < 1 || Math.abs(h - 30) < 1 ? "#2a2a30" : "#6a4428"; });
    if (!L.night) {
      P.fillPoly(ctx, [st.iso(DA, 0.1), st.iso(DB, 0.1), st.iso(DB + 2.4, 4.8), st.iso(DA + 2.4, 4.8)], (x, y) => ((x + y) % 2 ? "rgba(255,240,200,0.2)" : "rgba(255,240,200,0.12)"));
      const [x, y] = st.iso((DA + DB) / 2 + 1, 2); k.lights.push({ x, y: y - 10, r: 64, k: 0.5 });
    }

    // the hood: a masonry canopy over the forge, its underside lit by the fire, the chimney breast up into the dark
    const brk = (side, U, k0) => (x, y) => { const [a, h] = (side === "u" ? faceU(st, U) : faceV(st, U))(x, y); return shade(masonry(a * 1.3, h), k0 - Math.min(0.25, h / 300)); };
    P.slab(ctx, st, 0, FV0 - 0.2, FU + 0.2, FV1 - FV0 + 0.4, 10, { base: shade(S.stone[1], -0.2), left: brk("v", FV1 + 0.2, -0.12), right: brk("u", FU + 0.2, -0.28), top: (x, y) => shade(S.stone[1], -0.45) }, 34);
    const h0 = st.up(st.iso(FU + 0.2, FV1 + 0.2), 34), h1 = st.up(st.iso(FU + 0.2, FV0 - 0.2), 34), h2 = st.up(st.iso(0, FV1 + 0.2), 34);
    P.line(ctx, h0, h1, "#e8a060"); P.line(ctx, h2, h0, "#c87a3a"); P.line(ctx, [h0[0], h0[1] - 1], [h1[0], h1[1] - 1], "#a86a40");
    P.slab(ctx, st, 0, FV0 + 0.45, 0.9, FV1 - FV0 - 0.9, 70, { base: shade(S.stone[1], -0.4), left: brk("v", FV1 - 0.45, -0.3), right: brk("u", 0.9, -0.42), top: "#1a1210" }, 44);

    // the forge: a raised hearth of the town's masonry, a bed of coals on top, the ash pit glowing under it
    const coal = (u, v) => { const n = h01(Math.floor(u * 10), Math.floor(v * 10)); return n > 0.8 ? "#3a2622" : n > 0.4 ? "#22160f" : "#160e0a"; };
    const inBed = (u, v) => u > 0.35 && u < FU - 0.3 && v > FV0 + 0.35 && v < FV1 - 0.35;
    P.slab(ctx, st, 0, FV0, FU, FV1 - FV0, FH, {
      base: S.stone[1],
      left: (x, y) => { const [a, h] = faceV(st, FV1)(x, y); return shade(masonry(a * 1.3, h), -0.05); },
      right: (x, y) => {
        const [a, h] = faceU(st, FU)(x, y), d = Math.abs(a - MID);
        if (d < 0.7 && h < 7 - Math.max(0, d - 0.4) * 10) { const n = h01(x, y); return h > 5 ? "#1a0e0a" : n > 0.85 ? "#e8702a" : n > 0.6 ? "#8a2e14" : "#2a1410"; }
        if (d < 0.8 && h < 8 - Math.max(0, d - 0.5) * 10) return shade(S.stone[0], -0.2);
        return shade(masonry(a * 1.3, h), -0.2);
      },
      top: (x, y) => {
        const [u, v] = st.toUV(x, y + FH);
        if (inBed(u, v)) return coal(u, v);
        if (inBed(u - 0.1, v) || inBed(u + 0.1, v) || inBed(u, v - 0.1) || inBed(u, v + 0.1)) return "#2a2624";
        return h01(R(u * 4), R(v * 4)) > 0.5 ? shade(S.stone[0], 0.05) : shade(S.stone[1], -0.1);
      },
    });
    const embers = [];
    for (let y = 30; y < 90; y++) for (let x = 60; x < 140; x++) {
      const [u, v] = st.toUV(x, y + FH);
      if (!inBed(u, v)) continue;
      const heat = clamp(1 - Math.hypot((u - 1.15) / 0.9, (v - MID) / 1.6), 0, 1);
      if (heat > 0.12 && h01(x * 3, y * 7) > 0.35) embers.push([x, y, heat, h01(x, y)]);
    }
    const pumpAt = (t) => (Math.sin(t * 1.9) + 1) / 2;
    const [fx, fy] = st.up(st.iso(1.1, MID), FH + 8), forgeLight = { x: fx + 10, y: fy + 8, r: 104, k: 0.9 };
    k.lights.push(forgeLight);
    k.anims.push((g, t) => {
      const pump = pumpAt(t);
      forgeLight.k = 0.8 + pump * 0.2 + Math.sin(t * 13) * 0.05;
      for (const [x, y, heat, n] of embers) {
        const val = heat * (0.75 + 0.25 * Math.sin(t * 3 + n * 20)) + pump * 0.18;
        if (val < 0.3) continue;
        g.fillStyle = val > 0.9 ? "#ffe890" : val > 0.7 ? "#ffa040" : val > 0.5 ? "#e0602a" : "#a03018"; g.fillRect(x, y, 1, 1);
      }
      const n = 8;
      for (let i = 0; i < n; i++) {
        const v = FV0 + 0.6 + (i / (n - 1)) * (FV1 - FV0 - 1.2), prof = Math.sin(Math.PI * (i + 0.5) / n), [x, y] = st.up(st.iso(1.15 + (i % 2) * 0.2, v), FH);
        tongue(g, x, y, Math.max(1, (3 + prof * 8) * (0.55 + 0.45 * Math.abs(Math.sin(t * 8.3 + i * 1.7))) * (0.75 + pump * 0.45)), t, i);
      }
      // sparks off the coals: most go up the hood, a few drift out into the room
      for (let i = 0; i < 18; i++) {
        const ph = frac(t * 0.42 + h01(i, 1)), v = FV0 + 0.6 + h01(i, 2) * (FV1 - FV0 - 1.2), [sx, sy] = st.up(st.iso(1.1, v), FH + 2);
        const out = i % 4 === 0, x = sx + Math.sin(ph * 6 + i) * 3 + (out ? ph * 36 : (h01(i, 3) - 0.5) * ph * 14), y = sy - ph * (out ? 30 : 46) + (out ? ph * ph * 30 : 0);
        g.globalAlpha = 1 - ph; g.fillStyle = ph < 0.3 ? "#fff4c0" : ph < 0.6 ? "#ffb040" : "#e06020"; g.fillRect(R(x), R(y), 1, 1);
      }
      g.globalAlpha = 1;
      // the bellows against the forge's end, pumped by its long handle
      const Bk = st.up(st.iso(0.9, FV1 + 2.4), 12), Nz = st.up(st.iso(0.9, FV1 + 0.4), 12), len = R(Nz[0] - Bk[0]), open = 4 + pump * 7;
      for (const vv of [FV1 + 0.7, FV1 + 2.1]) { const [x, y] = st.iso(0.9, vv); g.fillStyle = "#3e2614"; g.fillRect(R(x), R(y) - 12, 2, 12); g.fillStyle = "#5a3a20"; g.fillRect(R(x), R(y) - 12, 1, 12); }
      for (let i = 0; i <= len; i++) {
        const s = i / len, x = R(Bk[0]) + i, yb = R(Bk[1] - i * 0.5), oh = Math.max(1, R(open * (1 - s) + 1)), wide = s < 0.85 ? 1 : 0;
        for (let j = 1; j <= oh; j++) { g.fillStyle = Math.floor((j * 3) / (oh + 1)) % 2 ? "#4e2a14" : s < 0.15 ? "#8a5030" : "#6e3e20"; g.fillRect(x, yb - j, 1, 1); }
        g.fillStyle = "#5e3a1e"; g.fillRect(x, yb, 1, 1 + wide); g.fillStyle = "#3a2010"; g.fillRect(x, yb + 1 + wide, 1, 1);
        g.fillStyle = "#b07a44"; g.fillRect(x, yb - oh - 1 - wide, 1, 1); g.fillStyle = "#8a5a30"; g.fillRect(x, yb - oh - wide, 1, wide + 0);
      }
      const tip = st.up(st.iso(0.9, FV1 - 0.1), 10); P.line(g, Nz, tip, "#4a4a52"); P.line(g, [Nz[0], Nz[1] - 1], [tip[0], tip[1] - 1], "#9a9aa2");
      g.fillStyle = "#2a2a30"; g.fillRect(R(Nz[0]) - 1, R(Nz[1]) - 3, 2, 4);
      const hx = R(Bk[0]) + 1, hy = R(Bk[1]) - R(open) - 2; P.line(g, [hx, hy], [hx - 6, hy - 14 + pump * 3], "#5a3a1e"); P.line(g, [hx + 1, hy], [hx - 5, hy - 14 + pump * 3], "#8a5a30");
      g.fillStyle = "#9a6a3a"; g.fillRect(R(hx - 9), R(hy - 15 + pump * 3), 6, 2);
    });

    // the coal heap in the corner behind the forge, a shovel stuck in it
    const lumps = [];
    for (let i = 0; i < 260; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()), u = 0.95 + Math.cos(a) * d * 0.85, v = 1.0 + Math.sin(a) * d * 0.9; lumps.push([u, v, (1 - d * d) * 10, r()]); }
    lumps.sort((p, q) => p[0] + p[1] - q[0] - q[1]);
    for (const [u, v, h, n] of lumps) { const [x, y] = st.up(st.iso(u, v), h); ctx.fillStyle = n > 0.66 ? "#2e2826" : n > 0.33 ? "#1e1a18" : "#141010"; ctx.fillRect(R(x) - 1, R(y) - 1, 3, 2); ctx.fillStyle = n > 0.8 ? "#6a625c" : "#433c38"; ctx.fillRect(R(x) - 1, R(y) - 1, 1, 1); }
    { const [x, y] = st.up(st.iso(1.2, 1.3), 8); P.line(ctx, [x, y], [x + 6, y - 16], "#6a4428"); P.line(ctx, [x + 1, y], [x + 7, y - 16], "#9a6a3a"); pix(ctx, R(x) - 2, R(y) - 1, ["mmmm", ".dd."], TOOLPAL); }

    // the tool wall: a plank board of tongs, hammers and files on pegs
    P.fillPoly(ctx, st.quad(st.rwall, 1.3, 5.9, 17, 47), "#2e1c10");
    P.fillPoly(ctx, st.quad(st.rwall, 1.45, 5.75, 18.5, 45.5), (x, y) => { const [a, h] = st.onR(x, y); return frac(a * 2.5) < 0.09 ? "#3a2414" : h01(Math.floor(a * 2.5), 1) > 0.5 ? "#6a4428" : h01(R(a * 20), R(h / 4)) > 0.85 ? "#5a3a20" : "#5e3c22"; });
    const T = {
      hammer: ["kkkkkk", "kllmmk", "kkxwkk", "..xw..", "..xw..", "..xw..", "..xw..", "..xw..", "..kk.."],
      sledge: ["kkkkkkk", "kllmmdk", "kllmmdk", "kkkxwkk", "...xw..", "...xw..", "...xw..", "...xw..", "...xw..", "...xw..", "...kk.."],
      tongs: ["k...k", "lk.kl", ".lml.", "..m..", ".m.d.", ".m.d.", ".m.d.", "m...d", "m...d", "m...d", "k...k"],
      file: [".k", "lm", "lm", "lm", "lm", "md", "xw", "xw", "kk"],
      punch: ["k", "l", "m", "m", "m", "d", "k"],
    };
    [["tongs", 1.9, 40], ["hammer", 2.5, 41], ["sledge", 3.1, 41], ["tongs", 3.7, 40], ["hammer", 4.3, 41], ["file", 4.8, 39], ["punch", 5.2, 38], ["tongs", 5.55, 40],
      ["hammer", 2.2, 28], ["file", 2.8, 27], ["punch", 3.2, 27], ["file", 3.6, 27], ["hammer", 4.6, 28]].forEach(([n, a, h]) => {
      const [x, y] = st.rwall(a, h); ctx.fillStyle = "#1e120a"; ctx.fillRect(R(x), R(y) - 1, 1, 1);
      pix(ctx, R(x) - (T[n][0].length >> 1), R(y), T[n], TOOLPAL);
    });
    // finished work hung on a rail: horseshoes in a row, an axe head, a sickle
    P.slab(ctx, st, 8.4, 0, 2.4, 0.2, 1, "#3a2a20", 38);
    for (let i = 0; i < 6; i++) { const [x, y] = st.rwall(8.6 + i * 0.36, 37); pix(ctx, R(x) - 2, R(y), [".lmm.", "l...d", "m...d", "m...d", "k...k"], TOOLPAL); }
    onWall(ctx, st, "r", 9.2, 28, ["..kkk.", ".kllmk", "kllmmk", "klmmdk", ".kmdk.", "..xw..", "..xw..", "..xw..", "..kk.."], TOOLPAL);
    onWall(ctx, st, "r", 10.1, 28, ["..lll.", ".l...m", "l.....", "m.....", ".m....", "..dxw.", "....xw", "....kk"], TOOLPAL);

    // the anvil on its stump, a bar glowing on its face
    const anvil = k.piece(), ag = anvil.getContext("2d"), [ax, ay] = st.iso(6.6, 3.4);
    cyl(ag, ax, ay, 7, 3.5, 8, (t, j, n, x) => (j === 0 ? "#8a5e36" : h01(x, R(j / 3)) > 0.82 ? "#3e2614" : across("#6a4428", t)));
    ell(ag, ax, ay - 8, 7, 3.5, (dx, dy) => { const d = Math.hypot(dx, dy); return d > 0.85 ? "#5a3a20" : R(d * 6) % 2 ? "#b48450" : "#9a6c40"; });
    pix(ag, R(ax) - 11, R(ay) - 17, [
      "..kkkkkkkkkkkkkkkkkkk.",
      "kkllllllllllllllllllmk",
      ".kmmllmmmmmmmmmmmmmmdk",
      "..kkdmmmmmmmmmmmmmmddk",
      "......kkmmmmmmmmmdkk..",
      "........kmmmmmmmdk....",
      "........kmmmmmmmdk....",
      ".......kmmmmmmmmmdk...",
      "......kmmmmmmmmmmmdk..",
      "......kkkkkkkkkkkkkk..",
    ], { k: "#1e1c20", l: "#aeb4bc", m: "#5e626c", d: "#3a3c44" });
    pix(ag, R(ax) - 4, R(ay) - 18, ["yyyyyyyy", "oyyyyyyo"], { y: "#ffd060", o: "#e8702a" });
    ag.fillStyle = "#fff4c0"; ag.fillRect(R(ax) - 1, R(ay) - 18, 2, 1);
    P.line(ag, [ax + 4, ay - 17], [ax + 16, ay - 12], "#2a2a30"); P.line(ag, [ax + 4, ay - 16], [ax + 16, ay - 11], "#5a5a62");
    k.add(9.9, anvil);
    { const [x, y] = st.up(st.iso(6.6, 3.4), 18); k.lights.push({ x, y, r: 18, k: 0.35 }); }

    // the quench tub: a half barrel of black water, tongs left standing in it
    const tub = k.piece(), tg = tub.getContext("2d"), [qx, qy] = st.iso(3.4, 7.4);
    cyl(tg, qx, qy, 8, 4, 9, (t, j, n, x) => (j === 1 || j === n - 3 ? across("#5a5e66", t) : (R(x - qx + 8) % 3 === 0 ? "#3e2614" : across("#7a5030", t))));
    ell(tg, qx, qy - 9, 8, 4, (dx, dy) => (dx * dx + dy * dy > 0.66 ? (dy < 0 ? "#a07040" : "#7a5030") : dy < -0.2 && Math.abs(dx + dy * 0.5) < 0.12 ? "#5a7a84" : "#1a2428"));
    P.line(tg, [qx - 2, qy - 10], [qx - 7, qy - 22], "#3a3c44"); P.line(tg, [qx, qy - 10], [qx - 4, qy - 22], "#5e626c");
    k.add(3.4 + 7.4 + 0.6, tub);
    k.anims.push((g, t) => {
      const ph = frac(t / 7);
      if (ph > 0.35) return;
      for (let i = 0; i < 6; i++) { const p = frac(ph / 0.35 + i / 6); g.globalAlpha = (1 - p) * 0.45; g.fillStyle = "#e8e4dc"; g.fillRect(R(qx - 5 + i * 2 + Math.sin(p * 6 + i) * 2), R(qy - 12 - p * 20), 3, 2); }
      g.globalAlpha = 1;
    });

    // the grindstone on its frame over a trough
    const gs = k.piece(), gg = gs.getContext("2d");
    P.slab(gg, st, 9.0, 2.65, 1.3, 0.7, 5, { base: "#5e3c22", top: (x, y) => ((x + y) % 5 ? "#2e4a58" : "#4a6a78") });
    for (const vv of [2.65, 3.35]) { const [x, y] = st.iso(9.65, vv); gg.fillStyle = "#4a2e18"; gg.fillRect(R(x) - 1, R(y) - 15, 2, 15); gg.fillStyle = "#7a5030"; gg.fillRect(R(x) - 1, R(y) - 15, 1, 15); }
    const wheel = (vv, dark) => {
      const [cx, cy] = st.up(st.iso(9.65, vv), 13);
      for (let y = R(cy) - 10; y <= R(cy) + 10; y++) for (let x = R(cx) - 8; x <= R(cx) + 8; x++) {
        const s = (x + 0.5 - cx) / 8, z = s * 4 - (y + 0.5 - cy), q = Math.hypot(s / 0.62, z / 7.5);
        if (q > 1) continue;
        gg.fillStyle = dark ? "#55524c" : q > 0.86 ? "#7a766e" : q < 0.16 ? "#4a3a2a" : (R(q * 7) % 2 ? "#aaa69c" : "#9c988e"); if (!dark && q < 0.86 && z > 0 && s < 0 && q > 0.3) gg.fillStyle = "#bab6ac";
        gg.fillRect(x, y, 1, 1);
      }
    };
    wheel(2.85, true); wheel(3.05, false);
    { const [cx, cy] = st.up(st.iso(9.65, 3.4), 13); P.line(gg, [cx, cy], [cx - 3, cy + 5], "#5a5a62"); gg.fillStyle = "#6a4428"; gg.fillRect(R(cx) - 5, R(cy) + 5, 3, 2); }
    k.add(13.4, gs);

    // a rack of finished blades against the right wall
    const rk = k.piece(), rg = rk.getContext("2d");
    P.slab(rg, st, 6.4, 0.15, 2.0, 0.45, 4, "#5a3a20"); P.slab(rg, st, 6.4, 0.2, 2.0, 0.2, 2, "#6a4428", 20);
    for (let i = 0; i < 5; i++) {
      const [x, y] = st.up(st.iso(6.65 + i * 0.4, 0.38), 3);
      rg.fillStyle = "#c8ccd4"; rg.fillRect(R(x), R(y) - 17, 1, 17); rg.fillStyle = "#7a7e88"; rg.fillRect(R(x) + 1, R(y) - 17, 1, 17);
      rg.fillStyle = i % 2 ? "#c8962a" : "#5e626c"; rg.fillRect(R(x) - 2, R(y) - 18, 6, 1);
      rg.fillStyle = "#5a3a1e"; rg.fillRect(R(x), R(y) - 23, 2, 5); rg.fillStyle = "#c8962a"; rg.fillRect(R(x), R(y) - 24, 2, 1);
    }
    k.add(8.9, rk);

    // the workbench under the window: a vice, a helm being beaten out, files
    const wb = k.piece(), wg = wb.getContext("2d");
    P.table(wg, st, 0.1, 9.3, 1.1, 2.6, 12, "#6a4428");
    { const [x, y] = st.up(st.iso(0.7, 9.8), 12); pix(wg, R(x) - 3, R(y) - 6, [".kkk..", "kmmmk.", ".kmk..", ".kmkkk", "kmmmmk"], TOOLPAL); }
    { const [x, y] = st.up(st.iso(0.6, 10.9), 12); pix(wg, R(x) - 4, R(y) - 5, ["..kkkk..", ".kllmmk.", "klllmmdk", "kmmmmmdk", "kk.kk.kk"], TOOLPAL); }
    { const [x, y] = st.up(st.iso(0.8, 11.5), 12); P.line(wg, [x - 3, y], [x + 3, y - 2], "#8a8e96"); }
    k.add(1.2 + 11.9, wb);
    kit.barrel(k, 1.0, 13.2);
    // a bucket of scrap and blanks by the anvil, a crate of bar stock by the door
    const sb = k.piece(), sg = sb.getContext("2d"), [bx, by] = st.iso(5.0, 9.4);
    cyl(sg, bx, by, 4.5, 2.2, 6, (t, j) => (j === 1 ? across("#5a5e66", t) : across("#6a4428", t)));
    for (let i = 0; i < 9; i++) { sg.fillStyle = i % 3 ? "#5e626c" : "#9aa0a8"; sg.fillRect(R(bx - 4 + h01(i, 1) * 8), R(by - 7 - h01(i, 2) * 3), 2, 1); }
    k.add(5.0 + 9.4 + 0.3, sb);
    kit.crate(k, 12.0, 0.5, "#6a4a2a");
    const bars = k.piece(), bg2 = bars.getContext("2d");
    for (let i = 0; i < 5; i++) { const p0 = st.up(st.iso(12.1 + i * 0.12, 0.8), 7), p1 = st.up(st.iso(11.9 + i * 0.12, 0.6), 22); P.line(bg2, p0, p1, i % 2 ? "#5e626c" : "#3e4048"); P.line(bg2, [p0[0] + 1, p0[1]], [p1[0] + 1, p1[1]], "#8a8e96"); }
    k.add(12 + 0.5 + 1.45, bars);

    // sacks of charcoal, one slumped open
    for (const [u, v, open] of [[6.6, 10.6, false], [7.4, 11.0, true], [6.9, 11.8, false]]) {
      const sk = k.piece(), skg = sk.getContext("2d"), [x, y] = st.iso(u, v);
      ell(skg, x, y - 5, 6, 6, (dx, dy) => (dy > 0.75 ? "#5a4a30" : dx < -0.35 && dy < 0.2 ? "#b8a070" : dx > 0.45 ? "#7a6440" : (R(dx * 9) + R(dy * 9)) % 3 ? "#9a8458" : "#8a7450"));
      if (open) { ell(skg, x, y - 10, 5, 2, (dx) => (dx < 0 ? "#2e2826" : "#1a1614")); for (let i = 0; i < 4; i++) { skg.fillStyle = "#1e1a18"; skg.fillRect(R(x + 4 + i * 2), R(y - 1 + (i % 2)), 2, 1); } }
      else pix(skg, R(x) - 2, R(y) - 14, [".kk.", "kxxk", ".kk."], { k: "#5a4a30", x: "#c8b080" });
      k.add(u + v + 0.4, sk);
    }

    k.spot("act", 5.6, 4.6, 1); k.spot("anvil", 5.6, 4.6, 1); k.spot("npc", 2.4, 6.6, -1); k.spot("forge", 2.7, 4.6, -1); k.spot("quench", 4.4, 8.2, -1);
    k.spot("in", 14.4, 4.6, -1); k.spot("mate", 10.4, 6.0, -1); k.spot("pet", 7.4, 7.2, -1); k.spot("other", 9.0, 7.6, -1); k.spot("crate", 11.6, 1.8, -1); k.spot("grind", 10.6, 3.8, -1);
    k.crowd([[11.4, 6.4, -1], [12.6, 4.2, -1]]);
    k.npc = { kind: "smith" };
    k.lamps.push([7.6, 7.4, 66]);
  }

  // ---------- the bathhouse: tiled walls and floor, two steaming tubs, a cold plunge, benches and towels, light through the steam ----------
  function bath(k) {
    const { st, ctx, S, th, r, L } = k, P = Tv(), kit = K(), { shade, mix, pix, h01, frac } = kit;
    const tA = mix(th.primary, "#e4eef0", 0.18), tB = mix(th.primary, "#e4eef0", 0.42), tG = mix(th.primary, "#24201c", 0.4);
    const TUB = [4.8, 5.0], TUB2 = [8.5, 2.3];
    const wall = (a, h) => {
      if (h < 3) return shade(tA, -0.4);
      if (h < 36) { const s = 4, x = a * 8.94; if (x % s < 0.8 || h % s < 0.8) return tG; const c = (Math.floor(x / s) + Math.floor(h / s)) % 2 ? tA : tB; return h % s > s - 1.2 ? shade(c, 0.12) : c; }
      if (h < 42) { if (h < 37 || h >= 41) return shade(th.accent, -0.35); const x = Math.floor(a * 8.94 / 2) + Math.floor((h - 37) / 2); return x % 2 ? th.accent : "#f0e8d4"; }
      const s = 7, row = Math.floor((h - 42) / s), x = a * 8.94 + (row % 2 ? s / 2 : 0);
      if (x % s < 0.8 || (h - 42) % s < 0.8) return "#b4aa98";
      const n = h01(Math.floor(x / s), row);
      return (h - 42) % s > s - 1.5 ? "#f4eee0" : n > 0.7 ? "#e2dacb" : "#ebe4d6";
    };
    const wet = (u, v) => Math.max(clamp(1 - Math.hypot(u - TUB[0], v - TUB[1]) / 2.6, 0, 1), clamp(1 - Math.hypot(u - TUB2[0], v - TUB2[1]) / 2.2, 0, 1));
    kit.room(k, wall, (u, v) => {
      const fu = frac(u * 1.25), fv = frac(v * 1.25), i = Math.floor(u * 1.25), j = Math.floor(v * 1.25);
      if (fu < 0.06 || fv < 0.06) return "#a89e8c";
      let c = (i + j) % 2 ? "#e2dacb" : "#d2c8b6";
      if (i % 2 === 0 && j % 2 === 0 && Math.abs(fu - 0.53) + Math.abs(fv - 0.53) < 0.16) c = tA;
      if (u < 0.75 || v < 0.75) c = tB;
      const w = wet(u, v), n = h01(Math.floor(u * 9), Math.floor(v * 9));
      if (w > 0 && n < w * 0.5) c = mix(c, "#8a9aa4", 0.3);
      return n > 0.94 ? shade(c, 0.14) : c;
    }, { ceiling: "#1a1614", beam: "#241c18", skirt: shade(tA, -0.45) });
    const WINS = [["l", 7.6, 9.2, 44, 60], ["r", 5.0, 6.6, 44, 60]];
    for (const [s, a0, a1, h0, h1] of WINS) kit.window_(k, s, a0, a1, h0, h1, { frame: "#6a5a4a", arch: true, reach: 5 });

    // light falling through the steam from the high windows, motes turning in it
    if (!L.night) {
      const shafts = WINS.map(([s, a0, a1, h0, h1]) => {
        const pts = s === "l" ? [st.lwall(a0, h1), st.lwall(a1, h1), st.lwall(a1, h0), st.iso(5, a1 + 2.5), st.iso(5, a0 + 2.5)] : [st.rwall(a0, h1), st.rwall(a1, h1), st.iso(a1 + 2.5, 5), st.iso(a0 + 2.5, 5), st.rwall(a0, h0)];
        const px = [], c = document.createElement("canvas"); c.width = st.W; c.height = st.H;
        P.fillPoly(c.getContext("2d"), pts, "#fff");
        const d = c.getContext("2d").getImageData(0, 0, st.W, st.H).data;
        for (let i = 0; i < st.W * st.H; i++) if (d[i * 4 + 3]) px.push(i);
        return px;
      });
      k.anims.push((g, t) => {
        for (const px of shafts) for (const i of px) {
          const x = i % st.W, y = (i / st.W) | 0, s = Math.sin(x * 0.35 + y * 0.18 - t * 0.6) + Math.sin(x * 0.11 - t * 0.3);
          if (s < 0.2) continue;
          g.fillStyle = s > 1.2 ? "rgba(255,250,230,0.24)" : "rgba(255,250,230,0.13)"; g.fillRect(x, y, 1, 1);
        }
        for (let i = 0; i < 10; i++) { const px = shafts[i % 2], p = px[Math.floor(frac(h01(i, 4) + t * 0.01 * (i % 3 + 1)) * px.length)]; if (p == null) continue; g.fillStyle = "#fffbe8"; g.fillRect(p % st.W, ((p / st.W) | 0) + R(Math.sin(t + i) * 2), 1, 1); }
      });
    }

    // the copper boiler in the corner over its little firebox, its pipe up into the dark
    P.slab(ctx, st, 0.3, 0.5, 1.6, 1.8, 9, { base: shade(S.stone[1], -0.1), left: (x, y) => (y % 3 < 1 ? shade(S.mortar, -0.2) : S.stone[0]), right: (x, y) => (y % 3 < 1 ? shade(S.mortar, -0.3) : shade(S.stone[1], -0.25)) });
    const [bx, by] = st.up(st.iso(1.1, 1.4), 9);
    cyl(ctx, bx, by, 9, 4.5, 24, (t, j, n) => (j === 2 || j === n - 4 || j === 12 ? across("#8a4a22", t) : (j === 3 || j === 13) && R(t * 9) % 2 ? "#e8b070" : across("#c87a3a", t)));
    ell(ctx, bx, by - 24, 9, 4.5, (dx, dy) => (dx * dx + dy * dy > 0.7 ? "#a85e2a" : dy < -0.1 && dx < 0 ? "#e8a060" : "#d08848"));
    ell(ctx, bx, by - 27, 5, 2.5, (dx) => (dx < -0.2 ? "#f0b070" : "#c87a3a"));
    ctx.fillStyle = "#8a4a22"; ctx.fillRect(R(bx) - 1, 0, 3, R(by) - 28); ctx.fillStyle = "#e8a060"; ctx.fillRect(R(bx) - 1, 0, 1, R(by) - 28);
    { const [x, y] = st.up(st.iso(1.9, 1.6), 14); ctx.fillStyle = "#8a6a2a"; ctx.fillRect(R(x), R(y), 4, 2); ctx.fillStyle = "#e8c060"; ctx.fillRect(R(x) + 3, R(y) + 1, 2, 2); }
    const fire = st.up(st.iso(1.9, 1.4), 2), boilLight = { x: fire[0] + 6, y: fire[1] - 2, r: 40, k: 0.5 };
    k.lights.push(boilLight);
    k.anims.push((g, t) => {
      boilLight.k = 0.4 + flick(t) * 0.15;
      for (let i = 0; i < 6; i++) { const x = R(fire[0]) + i - 3, hh = 2 + R(Math.abs(Math.sin(t * 7 + i * 1.9)) * 3); for (let j = 0; j < hh; j++) { g.fillStyle = FLAME[Math.min(3, j)]; g.fillRect(x, R(fire[1]) - j - (i - 3) * 0.5, 1, 1); } }
      const ph = frac(t * 0.6);
      g.fillStyle = "#9ac8e8"; g.fillRect(R(bx) + 13, R(by) - 9 + R(ph * 8), 1, 2);
      for (let i = 0; i < 5; i++) { const p = frac(t * 0.3 + i / 5); g.globalAlpha = (1 - p) * 0.5; g.fillStyle = "#f4f4f0"; g.fillRect(R(bx + 3 + Math.sin(p * 5 + i) * 3 + p * 6), R(by - 30 - p * 18), 3, 2); }
      g.globalAlpha = 1;
    });

    // the cold plunge: a sunken stone pool in the floor, steps down, a brass rail
    const PU0 = 0.6, PU1 = 2.9, PV0 = 9.4, PV1 = 12.6, D = 6;
    P.fillPoly(ctx, [st.iso(PU0, PV0), st.iso(PU1, PV0), st.iso(PU1, PV1), st.iso(PU0, PV1)], (x, y) => { const [u, v] = st.toUV(x, y); return u < PU0 + 0.3 || v < PV0 + 0.3 ? shade(tA, -0.3) : "#2e5a74"; });
    P.fillPoly(ctx, [st.iso(PU0, PV0), st.iso(PU1, PV0), [st.iso(PU1, PV0)[0], st.iso(PU1, PV0)[1] + D], [st.iso(PU0 + 0.15, PV0)[0], st.iso(PU0, PV0)[1] + D]], (x, y) => ((x >> 2) + (y >> 2)) % 2 ? tA : shade(tA, -0.25));
    P.fillPoly(ctx, [st.iso(PU0, PV0), st.iso(PU0, PV1), [st.iso(PU0, PV1)[0], st.iso(PU0, PV1)[1] + D], [st.iso(PU0, PV0)[0], st.iso(PU0, PV0)[1] + D]], (x, y) => ((x >> 2) + (y >> 2)) % 2 ? shade(tA, -0.3) : shade(tA, -0.45));
    P.fillPoly(ctx, [[st.iso(PU0, PV0)[0], st.iso(PU0, PV0)[1] + D], [st.iso(PU1, PV0)[0], st.iso(PU1, PV0)[1] + D], st.iso(PU1, PV1), [st.iso(PU0, PV1)[0], st.iso(PU0, PV1)[1] + D]], (x, y) => ((x * 3 + y * 7) % 17 < 2 ? "#6a9ab8" : (x + y) % 3 ? "#3a6e8c" : "#346684"));
    for (const [u0, v0, du, dv] of [[PU0 - 0.15, PV0 - 0.15, PU1 - PU0 + 0.3, 0.2], [PU0 - 0.15, PV0 - 0.15, 0.2, PV1 - PV0 + 0.3], [PU1 - 0.05, PV0 - 0.15, 0.2, PV1 - PV0 + 0.3], [PU0 - 0.15, PV1 - 0.05, PU1 - PU0 + 0.3, 0.2]]) P.slab(ctx, st, u0, v0, du, dv, 2, { base: "#cfc6b4", top: "#e8e0d0" });
    for (let i = 0; i < 2; i++) P.slab(ctx, st, PU1 - 0.9, PV0 + 0.3 + i * 0.35, 0.7, 0.35, 1, { base: shade(tA, -0.2), top: tB }, 3 - i * 3);
    { const p0 = st.up(st.iso(PU1 - 0.2, PV0 + 0.1), 14), p1 = st.up(st.iso(PU1 - 0.2, PV0 + 0.9), 12); P.line(ctx, p0, p1, "#c8962a"); for (const p of [p0, p1]) { ctx.fillStyle = "#8a6420"; ctx.fillRect(R(p[0]), R(p[1]), 1, 13); } }
    k.anims.push((g, t) => {
      for (let i = 0; i < 12; i++) { const u = PU0 + 0.4 + h01(i, 1) * (PU1 - PU0 - 0.6), v = PV0 + 0.4 + h01(i, 2) * (PV1 - PV0 - 0.6), [x, y] = st.iso(u, v), ph = frac(t * 0.4 + h01(i, 3)); g.fillStyle = ph < 0.5 ? "#8ab8d4" : "#5a90b0"; g.fillRect(R(x + ph * 4), R(y + D - 2), 3, 1); }
    });

    // the tubs: staves and brass hoops; the hero's is drawn twice, its back behind them and its front rim and water in front
    function tubAt(u, v, rad, front) {
      const [cx, cy] = st.iso(u, v), rx = rad * 11.3, ry = rad * 5.66, h = 13, hw = 9, rxi = rx - 2, ryi = ry - 1.2;
      return (g, part) => {
        cyl(g, cx, cy, rx, ry, h, (t, j, n, x) => (j === 2 || j === 3 || j === n - 3 ? (j === 2 ? across("#e8c070", t) : across("#b8903a", t)) : R(x - cx + rx) % 4 === 0 ? across("#6a4224", t) : across("#a06a3a", t)));
        const yTop = cy - h;
        for (let y = Math.floor(yTop - ry); y <= Math.ceil(yTop + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - yTop) / ry;
          if (dx * dx + dy * dy > 1) continue;
          const ix = (x + 0.5 - cx) / rxi, iy = (y + 0.5 - yTop) / ryi, inner = ix * ix + iy * iy <= 1;
          if (part === "front" && y + 0.5 < (inner ? cy - hw : yTop)) continue;
          let c;
          if (!inner) c = dy < 0 ? (dx < 0 ? "#d8a868" : "#c0905a") : "#b07a44";
          else {
            const wt = cy - hw - ryi * Math.sqrt(Math.max(0, 1 - ix * ix));
            if (y + 0.5 < wt) c = R(x - cx) % 3 === 0 ? "#4a2e18" : "#6a4428";
            else { const s = Math.sin(x * 0.7 + y * 1.3); c = s > 0.85 ? "#a8d8e8" : (x + y) % 3 ? "#5a9ab4" : "#4a8aa8"; if (part === "front") { g.globalAlpha = 0.6; } }
          }
          g.fillStyle = c; g.fillRect(x, y, 1, 1); g.globalAlpha = 1;
        }
        if (part === "front") { g.fillStyle = "rgba(220,244,255,0.7)"; g.fillRect(R(cx - rxi * 0.7), R(cy - hw), R(rxi * 1.4), 1); }
      };
    }
    const t1 = tubAt(TUB[0], TUB[1], 1.15), back = k.piece(), front = k.piece();
    t1(back.getContext("2d"), "back"); t1(front.getContext("2d"), "front");
    k.add(TUB[0] + TUB[1] - 0.6, back); k.add(TUB[0] + TUB[1] + 0.25, front);
    const t2 = tubAt(TUB2[0], TUB2[1], 1.0), c2 = k.piece(); t2(c2.getContext("2d"), "back"); k.add(TUB2[0] + TUB2[1] + 0.9, c2);
    k.anims.push((g, t) => {
      for (const [u, v, w] of [[TUB[0], TUB[1], 13], [TUB2[0], TUB2[1], 11]]) {
        const [x, y] = st.iso(u, v);
        for (let i = 0; i < 14; i++) {
          const ph = frac(t * 0.22 + i / 14 + u), sx = x - w * 0.6 + h01(i, u) * w * 1.2 + Math.sin(ph * 5 + i) * 3;
          g.globalAlpha = Math.sin(ph * Math.PI) * 0.5; g.fillStyle = "#fbfaf6"; g.fillRect(R(sx), R(y - 14 - ph * 34), 4 + R(ph * 5), 2 + R(ph * 3));
        }
      }
      g.globalAlpha = 1;
    });

    // benches along the right wall stacked with folded towels, a shelf of rolled towels and oils above
    const bn = k.piece(), bgc = bn.getContext("2d");
    P.legs(bgc, st, 10.0, 0.25, 3.2, 0.65, 7, "#6a4428"); P.slab(bgc, st, 10.0, 0.25, 3.2, 0.65, 1.5, { base: "#a06a3a", top: (x, y) => ((x + 2 * y) % 5 ? "#c08a50" : "#8a5a30") }, 7);
    [[10.3, 3], [11.0, 2], [12.4, 3]].forEach(([u, n]) => { for (let i = 0; i < n; i++) P.slab(bgc, st, u + (i % 2) * 0.05, 0.35, 0.6, 0.45, 2, { base: i % 2 ? tB : "#f4f0e6", top: i % 2 ? shade(tB, 0.2) : "#fffaf0" }, 8.5 + i * 2.2); });
    k.add(13.2 + 0.9, bn);
    P.slab(ctx, st, 9.8, 0, 3.6, 0.4, 2, "#7a5030", 30);
    for (let i = 0; i < 7; i++) { const [x, y] = st.up(st.iso(10.05 + i * 0.5, 0.22), 35); ell(ctx, x, y, 2.5, 2.5, (dx, dy) => (Math.hypot(dx, dy) < 0.4 ? "#c8c0b0" : i % 3 === 1 ? (dx < 0 ? shade(tB, 0.2) : tB) : dx < 0 ? "#fffaf0" : "#e8e0d0")); }
    for (const [a, c] of [[10.3, "#5a8a3a"], [12.9, "#c8902a"]]) { const [x, y] = st.rwall(a, 41); pix(ctx, R(x), R(y) - 3, [".k.", "kyk", "yyy", "yyy"], { k: "#3a2a1a", y: c }); }

    // a stool of towels by the tub, the bucket and its ladle, ferns in pots, a drain in the floor
    const st1 = k.piece(), sg = st1.getContext("2d");
    P.stool(sg, st, 3.0, 6.5, "#8a5a32");
    for (let i = 0; i < 3; i++) P.slab(sg, st, 2.98 + (i % 2) * 0.03, 6.48, 0.42, 0.42, 2, { base: i === 1 ? tB : "#f4f0e6", top: i === 1 ? shade(tB, 0.2) : "#fffaf0" }, 5.5 + i * 2);
    k.add(3.0 + 6.5 + 0.4, st1);
    const bk = k.piece(), bkg = bk.getContext("2d"), [kx, ky] = st.iso(6.6, 3.9);
    cyl(bkg, kx, ky, 4, 2, 7, (t, j) => (j === 1 || j === 5 ? across("#8a8a92", t) : across("#9a6a3a", t)));
    ell(bkg, kx, ky - 7, 3, 1.4, "#4a8aa8");
    P.line(bkg, [kx - 4, ky - 7], [kx - 1, ky - 12], "#5a5a62"); P.line(bkg, [kx - 1, ky - 12], [kx + 4, ky - 7], "#5a5a62");
    P.line(bkg, [kx + 1, ky - 7], [kx + 6, ky - 15], "#c8902a"); bkg.fillStyle = "#c8902a"; bkg.fillRect(R(kx) - 1, R(ky) - 8, 3, 1);
    k.add(6.6 + 3.9 + 0.3, bk);
    for (const [u, v] of [[0.7, 4.4], [13.8, 0.7]]) {
      const pc = k.piece(), pg = pc.getContext("2d"), [x, y] = st.iso(u, v);
      cyl(pg, x, y, 4, 2, 6, (t) => across("#b85a3a", t)); ell(pg, x, y - 6, 4, 2, "#4a3020");
      for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.33; for (let j = 0; j < 9; j++) { pg.fillStyle = j > 5 ? "#8ac058" : i % 2 ? "#4e8a32" : "#3a6a26"; pg.fillRect(R(x + Math.cos(a) * j * 1.2), R(y - 7 + Math.sin(a) * j * 1.4 + (j * j) / 14), 1, 1); } }
      k.add(u + v + 0.3, pc);
    }
    { const [x, y] = st.iso(8.2, 8.0); pix(ctx, R(x) - 4, R(y) - 2, [".kkkkkk.", "kk.k.k.kk", "k.k.k.k.k", ".kkkkkk."], { k: "#5a5248" }); }

    // a low bench along the left wall with a folded robe, sandals left under it
    const lb = k.piece(), lbg = lb.getContext("2d");
    P.legs(lbg, st, 0.25, 13.2, 0.7, 2.8, 6, "#6a4428"); P.slab(lbg, st, 0.25, 13.2, 0.7, 2.8, 1.5, { base: "#a06a3a", top: (x, y) => ((x + 2 * y) % 5 ? "#c08a50" : "#8a5a30") }, 6);
    P.slab(lbg, st, 0.35, 13.6, 0.5, 0.8, 2, { base: tB, top: shade(tB, 0.25) }, 7.5); P.slab(lbg, st, 0.38, 13.65, 0.44, 0.7, 1, { base: "#f4f0e6", top: "#fffaf0" }, 9.5);
    for (const [u, v] of [[1.3, 14.6], [1.6, 15.2]]) { const [x, y] = st.iso(u, v); pix(lbg, R(x) - 3, R(y) - 2, [".xxxx.", "xyyyyx", ".xxxx."], { x: "#5a3a1e", y: "#9a6a3a" }); }
    k.add(0.95 + 16.0, lb);
    const mb = k.piece(), mbg = mb.getContext("2d"), [mx, my] = st.iso(4.6, 12.2);
    cyl(mbg, mx, my, 4.5, 2.2, 7, (t, j) => (j === 1 || j === 5 ? across("#8a8a92", t) : across("#8a5a32", t))); ell(mbg, mx, my - 7, 3.5, 1.6, "#6a8a98");
    P.line(mbg, [mx + 1, my - 7], [mx - 6, my - 26], "#8a5a30"); P.line(mbg, [mx + 2, my - 7], [mx - 5, my - 26], "#b07a44");
    for (let i = 0; i < 5; i++) { mbg.fillStyle = i % 2 ? "#d8d0c0" : "#c0b8a8"; mbg.fillRect(R(mx) - 1 + i - 2, R(my) - 9 + (i % 2), 1, 4); }
    k.add(4.6 + 12.2 + 0.3, mb);

    k.spot("tub", TUB[0], TUB[1], -1); k.spot("act", TUB[0], TUB[1], -1); k.spot("bench", 11.4, 1.5, -1); k.spot("npc", 2.0, 8.2, 1); k.spot("towels", 3.4, 7.6, -1);
    k.spot("in", 14.0, 5.0, -1); k.spot("mate", 9.2, 5.6, -1); k.spot("pet", 6.8, 7.6, -1); k.spot("other", 9.4, 5.4, -1); k.spot("plunge", 3.6, 10.6, -1);
    k.crowd([[11.6, 4.6, -1]]);
    k.npc = { kind: "attendant" };
    k.lamps.push([6.6, 7.0, 70]);
  }

  // ---------- the fortune-teller's tent: draped cloth, the draped table with its crystal ball and cards, candles, charms, incense ----------
  function tent(k) {
    const { st, ctx, th, r, L } = k, P = Tv(), kit = K(), { shade, mix, pix, h01, frac } = kit;
    L.lamps = true;
    const RED = ["#7a1c1c", "#5e1616"], GOLD = ["#c8962a", "#e8c060", "#8a6420"];
    const POLES = [6.2, 12.4];
    const cloth = (a, h) => {
      if (POLES.some((p) => Math.abs(a - p) < 0.12)) return Math.abs(a - POLES.find((p) => Math.abs(a - p) < 0.12)) < 0.04 ? "#6a4428" : "#3e2614";
      let c;
      const f = frac(a * 1.6), fold = Math.sin(a * Math.PI * 3.2);
      if (h < 5) c = "#2e0e0c";
      else if (h < 9) c = (Math.floor(a * 8.94) + (h | 0)) % 4 < 2 ? GOLD[0] : GOLD[2];
      else if (f > 0.46 && f < 0.52) c = GOLD[2];
      else { c = Math.floor(a * 1.6) % 2 ? RED[0] : RED[1]; c = fold > 0.55 ? shade(c, 0.12) : fold < -0.55 ? shade(c, -0.28) : c; }
      return shade(c, -Math.min(0.45, Math.max(0, h - 20) / 140));
    };
    kit.room(k, cloth, (u, v) => {
      const n = h01(Math.floor(u * 6), Math.floor(v * 6));
      let c = n > 0.7 ? "#4a3424" : n > 0.3 ? "#3e2c1e" : "#34241a";
      // the big rug under the table: a gold border, a red field, a medallion
      if (u > 1.6 && u < 9.2 && v > 1.4 && v < 8.4) {
        const e = Math.min(u - 1.6, 9.2 - u, v - 1.4, 8.4 - v), d = Math.hypot(u - 5.4, v - 4.9) * 1.15;
        if (e < 0.12) c = (Math.floor((u + v) * 6) % 2) ? "#d8c8a0" : "#b8a880";
        else if (e < 0.42) c = Math.abs(frac((u + v) * 1.5) - 0.5) < 0.18 && e > 0.18 && e < 0.36 ? "#7a1c1c" : GOLD[0];
        else if (e < 0.5) c = "#2a1410";
        else if (Math.abs(d - 2.4) < 0.12 || Math.abs(d - 1.4) < 0.1) c = GOLD[1];
        else if (d < 1.4) c = (Math.floor(u * 3) + Math.floor(v * 3)) % 2 ? "#1e3a34" : "#244640";
        else c = h01(Math.floor(u * 4), Math.floor(v * 4)) > 0.85 ? "#2a1410" : (Math.floor(u * 2) + Math.floor(v * 2)) % 2 ? "#8a2420" : "#7a1e1a";
      }
      // a runner from the door
      if (u > 9.6 && u < 13.4 && v > 0.8 && v < 2.4) { const e = Math.min(v - 0.8, 2.4 - v); c = e < 0.2 ? "#8a6420" : frac(u * 2) < 0.5 ? "#a8743a" : "#946630"; }
      return c;
    }, { ceiling: "#2a0e0c", beam: "#3a1410", skirt: "#2e0e0c" });
    // the poles and the swags of gold beads looped between them
    { const [x, y] = st.iso(0, 0); ctx.fillStyle = "#4a2e18"; ctx.fillRect(R(x) - 1, 0, 3, R(y)); ctx.fillStyle = "#7a5030"; ctx.fillRect(R(x) - 1, 0, 1, R(y)); }
    for (const side of ["l", "r"]) {
      const wall = side === "l" ? st.lwall : st.rwall, stops = [0, ...POLES, 18];
      for (let s = 0; s < stops.length - 1; s++) for (let a = stops[s]; a < stops[s + 1]; a += 0.12) {
        const p = (a - stops[s]) / (stops[s + 1] - stops[s]), [x, y] = wall(a, 58 - Math.sin(p * Math.PI) * 12);
        ctx.fillStyle = Math.floor(a * 8) % 2 ? GOLD[1] : GOLD[2]; ctx.fillRect(R(x), R(y), 1, 1);
      }
      for (const a of POLES) { const [x, y] = wall(a, 58); pix(ctx, R(x) - 1, R(y), [".y.", "yyy", "ggg", "g.g", "g.g"], { y: GOLD[1], g: GOLD[0] }); }
    }
    // a star chart woven on the left wall, a palm chart pinned on the right
    const [scx] = [3.6];
    P.fillPoly(ctx, st.quad(st.lwall, 1.6, 5.6, 16, 48), (x, y) => {
      const [a, h] = st.onL(x, y), d = Math.hypot((a - scx) * 8.94, h - 32);
      if (d > 15.5) return null;
      if (d > 14.5) return GOLD[2];
      if (d > 11 && d < 13.5) { const ang = Math.atan2(h - 32, (a - scx) * 8.94); return Math.floor(ang * 12 / Math.PI) % 2 ? GOLD[0] : "#1c2a3a"; }
      if (d > 13.5 || (d > 10.4 && d <= 11)) return GOLD[1];
      return h01(R(a * 30), R(h)) > 0.93 ? "#f4ecc8" : d < 3 ? (d < 2 ? "#f0c050" : "#c8962a") : "#1c2a3a";
    });
    { const [x, y] = st.lwall(scx - 0.6, 37); pix(ctx, R(x), R(y), [".xx", "x..", "x..", ".xx"], { x: "#e8e4d4" }); }
    P.fillPoly(ctx, st.quad(st.rwall, 3.4, 5.8, 18, 44), "#5a3a1e");
    P.fillPoly(ctx, st.quad(st.rwall, 3.55, 5.65, 19.5, 42.5), (x, y) => (h01(x, y) > 0.9 ? "#d8c8a0" : "#e8dcb8"));
    onWall(ctx, st, "r", 4.6, 31, [
      "...k.k.k...", "..kk.k.kk..", ".k.k.k.k.k.", ".k.k.k.k.k.", ".k.k.k.k.k.", ".k.......k.", "k.........k", "k..r...r..k", "k...r.r...k", "k....r....k", ".k.......k.", "..kkkkkkk..",
    ], { k: "#5a2a1a", r: "#a83a2a" });
    // herbs hung to dry along a cord on the left wall
    for (let i = 0; i < 7; i++) {
      const a = 7.2 + i * 0.55, [x, y] = st.lwall(a, 50 - Math.sin(i / 6 * Math.PI) * 3);
      ctx.fillStyle = "#3a2a1a"; ctx.fillRect(R(x), R(y), 1, 3);
      pix(ctx, R(x) - 2, R(y) + 3, ["xyx.x", ".xyx.", ".gyg.", "gyggy", "g.y.g", "..g.."], { x: "#8a5a30", y: i % 2 ? "#6a7a3a" : "#8a8a4a", g: i % 3 ? "#4e5e2a" : "#7a6a3a" });
    }
    // the door: curtains drawn back on gold ties, the street's light in the gap
    const DA = 10.4, DB = 12.8, DC = (DA + DB) / 2, DH = 46;
    P.fillPoly(ctx, st.quad(st.rwall, DA, DB, 0, DH + 6), (x, y) => {
      const [a, h] = st.onR(x, y);
      if (h > DH) return h > DH + 5 ? GOLD[2] : Math.floor(a * 8.94) % 4 < 2 && h < DH + 2 ? GOLD[1] : RED[0];
      const gap = 0.08 + 0.5 * Math.pow(Math.sin(Math.PI * clamp(h / (DH + 6), 0, 1)), 0.6) * (h < 16 ? 0.55 + h / 36 : 1);
      if (Math.abs(a - DC) < gap) {
        const t = h / DH;
        return L.night ? (t < 0.2 ? "#1a1e28" : "#121a30") : t < 0.18 ? "#8a7a5a" : mix(L.sky[1], L.sky[0], (t - 0.18) / 0.82);
      }
      if (Math.abs(h - 16) < 1.2) return GOLD[1];
      const f = Math.sin((a - DC) * 30 / Math.max(0.3, (h < 16 ? 1 : 1.4)));
      return f > 0.5 ? "#9a2a24" : f < -0.5 ? "#4a1010" : RED[0];
    });
    if (!L.night) { const [x, y] = st.rwall(DC, 18); k.lights.push({ x, y: y + 18, r: 46, k: 0.4 }); P.fillPoly(ctx, [st.iso(DC - 0.4, 0.1), st.iso(DC + 0.4, 0.1), st.iso(DC + 1.6, 3.2), st.iso(DC + 0.4, 3.2)], (x, y) => ((x + y) % 2 ? "rgba(255,236,190,0.16)" : null)); }

    // the chest against the left wall: jars, books, a skull, a candle
    P.slab(ctx, st, 0.15, 8.6, 1.1, 1.8, 9, { base: "#4a2a16", left: (x, y) => (x % 9 < 1 ? GOLD[2] : "#5a3420"), right: "#3a2010", top: "#6a4024" });
    pix(ctx, R(st.up(st.iso(0.6, 9.2), 9)[0]) - 3, R(st.up(st.iso(0.6, 9.2), 9)[1]) - 5, [".www.", "wwwww", "wkwkw", ".www.", ".w.w."], { w: "#e8dcc0", k: "#2a1a12" });
    for (const [v, c] of [[9.8, "#3a6a5a"], [10.2, "#a8743a"]]) { const [x, y] = st.up(st.iso(0.6, v), 9); pix(ctx, R(x) - 1, R(y) - 6, [".k.", "yyy", "yzy", "yyy", "yyy"], { k: "#3a2a1a", y: c, z: shade(c, 0.4) }); }
    { const [x, y] = st.up(st.iso(0.75, 8.8), 9); pix(ctx, R(x) - 3, R(y) - 4, ["rrrrr.", "ggggg.", "bbbbbb", "wwwwww"], { r: "#7a1c1c", g: "#c8962a", b: "#1e3a34", w: "#e8dcc0" }); }
    k.candles.push(st.up(st.iso(0.5, 10.0), 9));

    // charms hung from the canopy: stars, moons, bells, crystals, an eye, a bundle of herbs, each swaying a little
    const CH = {
      star: ["..y..", ".yzy.", "yzzzy", ".y.y."], moon: [".ss", "s..", "s..", ".ss"], bell: [".y.", "yzy", "yzy", "yyy", ".k."],
      crystal: [".c.", "cdc", "cdc", ".c."], eye: [".bbb.", "bwkwb", ".bbb."], herb: ["xxx", "gyg", "ggg", ".g."],
    };
    const charms = [];
    for (let i = 0; i < 14; i++) { const x = 8 + i * 17 + R(h01(i, 1) * 8); if (Math.abs(x - 133) < 12) continue; charms.push([x, 8 + R(h01(i, 2) * 22), Object.keys(CH)[i % 6], h01(i, 3)]); }
    k.anims.push((g, t) => {
      for (const [x, len, n, ph] of charms) {
        const sw = Math.sin(t * 0.9 + ph * 6) * 1.2, bx = x + sw;
        for (let j = 0; j < len; j++) { g.fillStyle = "#5a4430"; g.fillRect(R(x + sw * j / len), j, 1, 1); }
        pix(g, R(bx) - (CH[n][0].length >> 1), len, CH[n], { y: GOLD[0], z: GOLD[1], s: "#d8dce4", k: "#3a2a1a", c: "#8ad0c8", d: "#d8f4f0", b: "#2a5a9a", w: "#f4f0e4", x: "#8a5a30", g: "#5e6e34" });
      }
    });

    // the reader's high-backed chair, the draped round table, the ball and the cards; the hero's cushion
    const ch = k.piece(), cg = ch.getContext("2d");
    P.legs(cg, st, 3.4, 3.6, 0.8, 0.8, 8, "#3a2010"); P.slab(cg, st, 3.4, 3.6, 0.8, 0.8, 2, { base: "#4a2a16", top: RED[0] }, 8);
    P.slab(cg, st, 3.3, 3.55, 0.16, 0.9, 26, { base: "#4a2a16", left: "#5a3420", right: (x, y) => (y % 5 < 1 ? GOLD[2] : "#3e2214") }, 10);
    for (const v of [3.55, 4.45]) { const [x, y] = st.up(st.iso(3.38, v), 37); pix(cg, R(x) - 1, R(y) - 3, [".y.", "yzy", ".y."], { y: GOLD[0], z: GOLD[1] }); }
    { const [x, y] = st.up(st.iso(3.38, 4.0), 33); pix(cg, R(x) - 2, R(y) - 2, ["..y..", ".yzy.", "yzzzy", ".yzy.", "..y.."], { y: GOLD[2], z: GOLD[1] }); }
    k.add(7.9, ch);
    const TU = 5.4, TV = 4.8, [tx, ty] = st.iso(TU, TV), trx = 12, try_ = 6, tH = 12, top = ty - tH;
    const tb = k.piece(), tg = tb.getContext("2d");
    cyl(tg, tx, ty, trx, try_, tH, (t, j, n, x) => {
      if (j >= n - 2) return (x + j) % 2 ? GOLD[1] : GOLD[2];
      if (j < 2) return across(GOLD[0], t);
      if (j < 4) return R(x) % 4 < 2 ? across(GOLD[0], t) : across(RED[0], t);
      const f = Math.sin((x - tx) * 0.9);
      return across(f > 0.5 ? "#9a2a24" : f < -0.5 ? "#4a1010" : RED[0], t);
    });
    ell(tg, tx, top, trx, try_, (dx, dy) => { const d = Math.hypot(dx, dy); return d > 0.9 ? GOLD[0] : d > 0.82 ? "#3a0e0c" : (Math.abs(dx * 2.4) + Math.abs(dy * 2.4) < 0.9 && Math.abs(Math.abs(dx * 2.4) + Math.abs(dy * 2.4) - 0.7) < 0.15) ? GOLD[2] : "#5e1414"; });
    const CARD = { a: ["wwww", "wrrw", "wgrw", "wrrw", "wwww"], b: ["wwww", "wbbw", "wwyw", "wbbw", "wwww"], c: ["wwww", "wyyw", "wyyw", "wggw", "wwww"], d: ["kkkk", "kyrk", "krrk", "kryk", "kkkk"] };
    [[-9, 0, "d"], [-5, 2, "a"], [0, 3, "b"], [5, 2, "c"], [9, 0, "a"]].forEach(([dx, dy, n]) => pix(tg, R(tx + dx) - 2, R(top + dy) - 1, CARD[n], { w: "#f4ead0", r: "#a83a2a", g: GOLD[0], b: "#2a5a9a", y: GOLD[1], k: "#5e1414" }));
    k.add(10.9, tb);
    const ballY = top - 7, ballLight = { x: tx, y: ballY, r: 34, k: 0.55 }, cl = [[tx - 9, top - 2], [tx + 8, top - 3]];
    const candLights = cl.map(([x, y]) => ({ x, y: y - 6, r: 26, k: 0.5 }));
    k.lights.push(ballLight, ...candLights);
    live(k, 10.95, (g, t, still) => {
      const f = flick(t), pulse = 0.5 + 0.5 * Math.sin(t * 1.7);
      ballLight.k = 0.45 + pulse * 0.2; candLights.forEach((l) => { l.k = 0.4 + f * 0.15; });
      for (const [x, y] of cl) { g.fillStyle = GOLD[2]; g.fillRect(R(x) - 1, R(y), 4, 1); Tv().candle(g, R(x), R(y), t, f, 4); }
      kit.glow(g, tx, ballY, 16, "#a8f0e0", 0.16 + pulse * 0.12);
      pix(g, R(tx) - 4, R(top) - 3, [".yzzy.", "yzzzzy", ".yyyy.", "y.yy.y"].map((s) => s + "."), { y: GOLD[2], z: GOLD[1] });
      ell(g, tx, ballY, 5, 5, (dx, dy) => {
        const d = Math.hypot(dx, dy);
        if (d > 0.84) return "#2a6a70";
        if (dx < -0.3 && dy < -0.3 && d < 0.7) return "#f4fffc";
        const s = Math.sin(Math.atan2(dy, dx) * 2 + t * 1.6 + d * 5);
        return s > 0.55 ? "#e0fff8" : s > -0.1 ? "#8ad8d0" : "#4a9aa0";
      });
    });
    const pf = k.piece(), pg = pf.getContext("2d"), [px, py] = st.iso(6.7, 4.2);
    cyl(pg, px, py, 6, 3, 6, (t, j) => (j === 0 ? across(GOLD[1], t) : across(RED[0], t)));
    ell(pg, px, py - 6, 6, 3, (dx, dy) => (Math.hypot(dx, dy) < 0.25 ? GOLD[0] : dx < -0.2 && dy < 0 ? "#9a2a24" : "#7a1c1c"));
    k.add(10.7, pf);

    // the raven on its perch, turning its head; the incense on its tripod, smoke curling up
    live(k, 3.1, (g, t) => {
      const [x, y] = st.iso(0.9, 2.2);
      g.fillStyle = "#3e2614"; g.fillRect(R(x), R(y) - 24, 2, 24); g.fillRect(R(x) - 4, R(y) - 24, 10, 2); g.fillRect(R(x) - 3, R(y) - 1, 8, 1);
      const turn = frac(t / 5) < 0.3, blink = frac(t / 3.3) < 0.05;
      pix(g, R(x) - 3, R(y) - 34, turn ? ["....kk..", "...kkkk.", "..kkkkk.", "..kkkkk.", ".kkkkkk.", ".kkkkkk.", "kkkkkk..", "k.kk.k..", "..k..k.."] : ["..kk....", ".kkkk...", ".kkkkk..", ".kkkkk..", ".kkkkkk.", ".kkkkkk.", "..kkkkkk", "..k.kk.k", "..k..k.."], { k: "#1a1820" });
      g.fillStyle = "#3a3a48"; g.fillRect(R(x) - (turn ? -2 : 1), R(y) - 30, 3, 1);
      if (!blink) { g.fillStyle = "#e8b040"; g.fillRect(R(x) + (turn ? 2 : 0), R(y) - 32, 1, 1); }
      g.fillStyle = "#4a4a50"; g.fillRect(R(x) + (turn ? 4 : -3), R(y) - 32, 2, 1);
    });
    const ib = k.piece(), ig = ib.getContext("2d"), [ix, iy] = st.iso(2.4, 7.0);
    for (const d of [-3, 0, 3]) P.line(ig, [ix + d, iy], [ix, iy - 9], GOLD[2]);
    ell(ig, ix, iy - 10, 4, 2, (dx, dy) => (dy < 0 ? GOLD[1] : GOLD[0])); ig.fillStyle = "#e8702a"; ig.fillRect(R(ix), R(iy) - 11, 1, 1);
    k.add(9.6, ib);
    k.anims.push((g, t) => {
      for (let s = 0; s < 2; s++) for (let j = 0; j < 40; j++) {
        const y = iy - 12 - j, ph = j / 40, x = ix + Math.sin(j * 0.16 + t * 1.3 + s * 2.4) * (1 + ph * 5) + s * ph * 4;
        g.globalAlpha = (1 - ph) * 0.45; g.fillStyle = s ? "#c8c0b4" : "#e0d8cc"; g.fillRect(R(x), R(y), 1 + (ph > 0.5 ? 1 : 0), 1);
      }
      g.globalAlpha = 1;
    });

    // a candle stand by the door's side, floor cushions
    const cs = k.piece(), csg = cs.getContext("2d"), [sx, sy] = st.iso(9.0, 2.2);
    csg.fillStyle = GOLD[2]; csg.fillRect(R(sx), R(sy) - 26, 2, 26); csg.fillRect(R(sx) - 3, R(sy) - 1, 8, 1);
    csg.fillStyle = GOLD[1]; csg.fillRect(R(sx), R(sy) - 26, 1, 26); csg.fillRect(R(sx) - 6, R(sy) - 24, 14, 1);
    k.add(11.2, cs);
    const sticks = [[sx - 6, sy - 24], [sx, sy - 27], [sx + 6, sy - 24]];
    const stickLights = sticks.map(([x, y]) => ({ x, y: y - 5, r: 24, k: 0.45 }));
    k.lights.push(...stickLights);
    live(k, 11.25, (g, t) => { const f = flick(t); stickLights.forEach((l) => { l.k = 0.38 + f * 0.12; }); for (const [x, y] of sticks) Tv().candle(g, R(x), R(y), t, f, 3); });
    for (const [u, v, c] of [[8.4, 7.2, GOLD[0]], [2.6, 9.6, "#1e3a34"], [3.4, 10.0, RED[0]]]) {
      const cu = k.piece(), cgx = cu.getContext("2d"), [x, y] = st.iso(u, v);
      cyl(cgx, x, y, 7, 3.5, 5, (t, j) => (j === 0 ? shade(c, 0.2) : across(c, t)));
      ell(cgx, x, y - 5, 7, 3.5, (dx, dy) => (Math.hypot(dx, dy) < 0.2 ? GOLD[1] : dx < -0.2 && dy < 0 ? shade(c, 0.15) : c));
      k.add(u + v + 0.5, cu);
    }

    // a low tray table set for tea, a trunk of scrolls, a pennant in the town's colours over the door
    const tt = k.piece(), ttg = tt.getContext("2d");
    P.table(ttg, st, 4.0, 10.0, 1.2, 1.2, 5, "#4a2a16");
    ell(ttg, ...st.up(st.iso(4.6, 10.6), 5), 7, 3.5, (dx, dy) => (Math.hypot(dx, dy) > 0.82 ? GOLD[2] : dx < -0.2 && dy < 0 ? GOLD[1] : GOLD[0]));
    { const [x, y] = st.up(st.iso(4.5, 10.5), 5); pix(ttg, R(x) - 4, R(y) - 6, ["..k.....", ".kyk....", "kyyyk.cc", "kyyyk.cc", ".kkk...."], { k: "#3a2010", y: "#c8a060", c: "#e8dcc0" }); }
    k.add(4.0 + 10.0 + 2.4, tt);
    const tr = k.piece(), trg = tr.getContext("2d");
    P.slab(trg, st, 12.6, 4.8, 1.4, 0.9, 8, { base: "#5a3420", left: (x, y) => (x % 7 < 1 ? GOLD[2] : "#6a4024"), right: "#3e2214", top: "#7a4a2a" });
    for (let i = 0; i < 4; i++) { const [x, y] = st.up(st.iso(12.9 + i * 0.3, 5.1 + (i % 2) * 0.2), 8); trg.fillStyle = "#e8dcc0"; trg.fillRect(R(x) - 3, R(y) - 2, 6, 2); trg.fillStyle = "#c8b890"; trg.fillRect(R(x) - 3, R(y), 6, 1); trg.fillStyle = "#a83a2a"; trg.fillRect(R(x), R(y) - 2, 1, 2); }
    k.add(12.6 + 4.8 + 2.3, tr);
    P.fillPoly(ctx, [st.rwall(DC - 0.9, DH + 16), st.rwall(DC + 0.9, DH + 16), st.rwall(DC + 0.9, DH + 6), st.rwall(DC, DH), st.rwall(DC - 0.9, DH + 6)], (x, y) => { const [a, h] = st.onR(x, y); return h > DH + 14 ? GOLD[0] : frac(a * 1.4) < 0.2 ? th.accent : th.primary; });

    k.spot("act", 6.7, 4.2, -1); k.spot("seat", 6.7, 4.2, -1); k.spot("npc", 4.0, 4.2, 1); k.spot("table", TU, TV, -1); k.spot("in", 11.6, 1.4, -1);
    k.spot("mate", 9.8, 4.6, -1); k.spot("pet", 7.6, 5.6, -1); k.spot("other", 9.4, 6.4, -1);
    k.crowd([[10.6, 7.6, -1]]);
    k.npc = { kind: "reader" };
    k.lamps.push([TU, TV, 76]);
  }

  const reg = () => { const T = root.TownSets; if (!T || !T.register) return; T.register("smithy", smithy); T.register("bath", bath); T.register("tent", tent); };
  reg();
})(typeof window !== "undefined" ? window : globalThis);
