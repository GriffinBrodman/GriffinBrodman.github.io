/* Town day sets: one hand-built iso scene for each place a town hour happens, in each town's own look, by the hour and the weather. */
/*
  TownSets.build(set, o) -> scene   o: { town, hour (0-24), weather, lodge (the room set: common private suite stables home cell), seed }
    scene = { W, H, st (Tavern.stage), set, town, hour, night, outdoor, bg (canvas: everything that never moves),
              things: [{ key, cv }] (furniture, depth-sorted with the figures: key = u + v of its front edge),
              spots: { name: [u, v, face?] } (where the cast stands: in, act, npc, mate, pet, crowd0.., and the set's own: bench, tub, anvil...),
              npc: { kind, name? } | null, amb(ctx, t, still) (what moves under the figures), over(ctx, t, still) (weather and light over them) }
  TownSets.SETS: the set names; TownSets.STYLE[town]: the town's palette; TownSets.kit: the painters the acts reuse (shade, mix, pix, glow).
  Needs tavern.js (the iso stage, slabs, lighting) and town_scenes.js (each town's colours).
*/
(function (root) {
  "use strict";
  const R = Math.round, W = 256, H = 122;
  const Tv = () => root.Tavern;
  const frac = (v) => ((v % 1) + 1) % 1;
  const h01 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const memo = new Map();
  const mix = (a, b, t) => { const k = a + b + t; let v = memo.get(k); if (!v) { const p = rgb(a), q = rgb(b); v = "#" + p.map((x, i) => R(x + (q[i] - x) * t).toString(16).padStart(2, "0")).join(""); memo.set(k, v); } return v; };
  const shade = (c, k) => (k >= 0 ? mix(c, "#fff0c8", k) : mix(c, "#140c0a", -k));
  function pix(ctx, x, y, rows, pal) {
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x + i, y + j, 1, 1); } } });
  }
  function glow(ctx, x, y, r, col, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r), [cr, cg, cb] = rgb(col);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

  // ---------- each town's look: the stone, timber, plaster, roofs and trim its buildings are made of ----------
  const STYLE = {
    ironhaven: { wall: "brick", brick: ["#9a4a38", "#8a4232", "#a6543e"], mortar: "#5a4a44", stone: ["#8a8076", "#7a7068", "#968a7e"], timber: "#3e2a1e", plaster: ["#d8ccb4", "#cec2a8"],
      roof: ["#4a4a58", "#3c3c4a", "#565666"], trim: "#7a2a24", door: "#4a2a1a", cobble: ["#7a746c", "#6c665e", "#86807a"], gap: "#4a4640", awning: ["#b83a32", "#ece8e0"], flag: ["#b83a32", "#e8b84a"], ground: "cobble" },
    thornwall: { wall: "timber", plaster: ["#e4d2a8", "#d8c49a"], timber: "#5a3a20", stone: ["#9a8a70", "#8a7a62", "#a89a80"], mortar: "#5e5040", roof: ["#a8823a", "#96722e", "#b8924a"], thatch: true,
      trim: "#6a8a3a", door: "#5a3a1e", cobble: ["#a8946a", "#9a8660", "#b4a076"], gap: "#6e5e40", awning: ["#a8743a", "#f4e4c0"], flag: ["#a8743a", "#e0b04a"], ground: "earth" },
    veldrock: { wall: "stone", stone: ["#6e7078", "#62646c", "#7a7c84"], mortar: "#3a3c42", timber: "#3a2e24", plaster: ["#b8b4ac", "#aca89e"], roof: ["#3e4048", "#34363e", "#4a4c54"],
      trim: "#b8602a", door: "#3a2a20", cobble: ["#5e6066", "#54565c", "#6a6c72"], gap: "#34363a", awning: ["#b8602a", "#d8d6d0"], flag: ["#5e646e", "#b8602a"], ground: "cobble" },
    carrbridge: { wall: "timber", plaster: ["#e6e2d6", "#dcd8cc"], timber: "#3a4a5a", stone: ["#8e9294", "#82868a", "#9a9ea0"], mortar: "#4e5256", roof: ["#a85a3a", "#964e32", "#b86a46"],
      trim: "#3a7ab8", door: "#2e4a66", cobble: ["#8a8a84", "#7e7e78", "#96968e"], gap: "#55554e", awning: ["#3a7ab8", "#e0eef4"], flag: ["#3a7ab8", "#6a9a3a"], ground: "cobble", water: true },
    ashfen: { wall: "boards", board: ["#5e6a5e", "#566256", "#667266"], timber: "#2e3a32", stone: ["#6a7066", "#5e645a", "#767c72"], mortar: "#3a3e38", plaster: ["#b8bca8", "#acb09c"],
      roof: ["#3e4a44", "#36423c", "#48544e"], trim: "#f0b44a", door: "#2e3a32", cobble: ["#5a5e50", "#50544a", "#64685a"], gap: "#36382e", awning: ["#4a6a62", "#d8dcc8"], flag: ["#4a6a62", "#f0b44a"], ground: "boards", damp: true },
    hollowood: { wall: "logs", logs: ["#8a5e3a", "#7a5232", "#5a3a22"], timber: "#4a2e1a", stone: ["#7a8068", "#6e745c", "#868c74"], mortar: "#3e4232", plaster: ["#d8d0b0", "#ccc4a4"],
      roof: ["#4a6a34", "#3e5a2c", "#56763e"], moss: true, trim: "#d8b45a", door: "#4a2e1a", cobble: ["#6a7a4a", "#5e6e42", "#768652"], gap: "#3e4a2a", awning: ["#3a6a34", "#e4ecd0"], flag: ["#3a6a34", "#d8b45a"], ground: "grass" },
    saltmarrow: { wall: "plaster", plaster: ["#f0ece0", "#e4e0d2"], timber: "#5a4a3a", stone: ["#a8a49a", "#9a968c", "#b4b0a6"], mortar: "#6a665e", board: ["#7a6a54", "#706048", "#86765e"],
      roof: ["#2a5a8a", "#244e7a", "#346a9a"], trim: "#d84a3a", door: "#2a6aa8", cobble: ["#a49c8a", "#968e7c", "#b0a896"], gap: "#6a6252", awning: ["#2a6aa8", "#f4f0e4"], flag: ["#2a6aa8", "#d84a3a"], ground: "cobble", water: true },
    frosthold: { wall: "stone", stone: ["#8a94a6", "#7e889a", "#96a0b0"], mortar: "#4a5060", timber: "#3e2a1e", plaster: ["#e8ecf0", "#dce0e6"], roof: ["#3a4a64", "#324058", "#445472"], snow: true,
      trim: "#8a5a34", door: "#4e3622", cobble: ["#a8b0bc", "#9aa2ae", "#b4bcc8"], gap: "#6a7280", awning: ["#4a7ab0", "#f0f6ff"], flag: ["#4a7ab0", "#8a5a34"], ground: "snow" },
  };
  const DEFAULT = STYLE.thornwall;
  const theme = (town) => (root.TownScenes && TownScenes.THEME && TownScenes.THEME[town]) || { primary: "#3a5a8a", accent: "#e8c060", dark: "#1a2440", light: "#e0e8f0" };

  // ---------- materials: (a, h) along a wall, (u, v) on a floor ----------
  const M = {
    stone: (cols, mortar, sz, w) => (a, h) => {
      const s = sz || 6, row = Math.floor(h / s), ww = w || 1.1, k = a / ww + (row % 2 ? 0.45 : 0), col = Math.floor(k), fy = h - row * s, fx = k - col;
      if (fy < 1 || fx < 0.07) return mortar;
      const c = cols[Math.floor(h01(row, col) * cols.length)];
      return fy > s - 1.2 ? shade(c, 0.12) : fx > 0.88 ? shade(c, -0.16) : fy < 2 ? shade(c, -0.08) : c;
    },
    brick: (cols, mortar) => (a, h) => {
      const row = Math.floor(h / 3), k = a / 0.55 + (row % 2 ? 0.5 : 0), col = Math.floor(k);
      if (h % 3 < 1 || k - col < 0.12) return mortar;
      return cols[Math.floor(h01(row, col) * cols.length)];
    },
    timber: (cols, timber) => (a, h) => {
      const p = 1.8, k = a / p, fk = k - Math.floor(k);
      if (fk < 0.08 || h % 30 < 2 || h < 3) return (R(h) + Math.floor(a * 8)) % 7 ? timber : shade(timber, 0.15);
      const d = (fk - 0.08) / 0.92, band = Math.floor(h / 30), hh = (h % 30) / 30;
      if (band % 2 === 0 && Math.abs(hh - (Math.floor(k) % 2 ? d : 1 - d)) < 0.06) return timber;
      return h01(Math.floor(a * 16), R(h)) > 0.92 ? cols[1] : cols[0];
    },
    plaster: (cols, trim) => (a, h) => {
      if (h < 4) return shade(cols[1], -0.25);
      const n = h01(Math.floor(a * 9), Math.floor(h / 3));
      return n > 0.94 ? shade(cols[0], -0.08) : n > 0.6 ? cols[1] : cols[0];
    },
    boards: (cols, seam) => (a, h) => {
      const k = a * 3.2, col = Math.floor(k);
      if (k - col < 0.1) return seam;
      const c = cols[Math.floor(h01(col, 3) * cols.length)];
      return h01(col, Math.floor(h / 7)) > 0.93 ? shade(c, -0.15) : c;
    },
    logs: (cols) => (a, h) => {
      const sz = 6, row = Math.floor(h / sz), f = (h - row * sz) / sz;
      if (f < 0.17) return cols[2];
      return f > 0.78 ? shade(cols[0], 0.12) : f > 0.45 ? cols[0] : cols[1];
    },
    tiles: (c0, c1, grout, size) => (a, h) => {
      const s = size || 4, i = Math.floor(a * 8 / s), j = Math.floor(h / s);
      if ((a * 8) % s < 0.6 || h % s < 0.6) return grout;
      return (i + j) % 2 ? c0 : c1;
    },
    cloth: (c0, c1) => (a, h) => { const f = frac(a * 2.4); return f < 0.12 ? shade(c0, -0.3) : f < 0.5 ? c0 : f > 0.86 ? shade(c1, 0.1) : c1; },
  };
  const F = {
    cobble: (cols, gap) => (u, v) => {
      const row = Math.floor(v * 2.2), k = u * 2.2 + (row % 2 ? 0.5 : 0), col = Math.floor(k), fx = k - col, fy = v * 2.2 - row;
      if (fx < 0.12 || fy < 0.14) return gap;
      const c = cols[Math.floor(h01(row, col) * cols.length)];
      return fy > 0.8 || fx > 0.85 ? shade(c, -0.12) : fy < 0.3 ? shade(c, 0.1) : c;
    },
    flags: (cols, gap) => (u, v) => {
      const row = Math.floor(v * 1.1), k = u * 1.1 + (row % 2 ? 0.5 : 0), col = Math.floor(k);
      if (v * 1.1 - row < 0.06 || k - col < 0.05) return gap;
      return cols[Math.floor(h01(row, col) * cols.length)];
    },
    planks: (cols, seam) => (u, v) => {
      const row = Math.floor(v * 2), end = Math.abs((u + row * 1.7) % 3) < 0.05;
      if (Math.abs(v * 2 - R(v * 2)) < 0.07 || end) return seam;
      return h01(Math.floor(u * 6), row) > 0.96 ? shade(cols[0], -0.12) : cols[((row % cols.length) + cols.length) % cols.length];
    },
    noise: (cols, n) => (u, v) => { const k = h01(Math.floor(u * (n || 6)), Math.floor(v * (n || 6))); return k > 0.75 ? cols[0] : k > 0.3 ? cols[1] : cols[2]; },
    tiles: (c0, c1, grout) => (u, v) => { if (frac(u * 2) < 0.06 || frac(v * 2) < 0.06) return grout; return (Math.floor(u * 2) + Math.floor(v * 2)) % 2 ? c0 : c1; },
  };
  function wallOf(S) {
    switch (S.wall) {
      case "brick": return M.brick(S.brick, S.mortar);
      case "timber": return M.timber(S.plaster, S.timber);
      case "stone": return M.stone(S.stone, S.mortar);
      case "boards": return M.boards(S.board, S.timber);
      case "logs": return M.logs(S.logs);
      default: return M.plaster(S.plaster, S.trim);
    }
  }
  function groundOf(S, town) {
    switch (S.ground) {
      case "earth": return F.noise(["#b49a6a", "#a68c5e", "#98804e"], 5);
      case "boards": return F.planks(["#6e6a52", "#646048", "#78745a"], "#3a3828");
      case "grass": return F.cobble(S.cobble, S.gap);
      case "snow": return (u, v) => (h01(Math.floor(u * 3), Math.floor(v * 3)) > 0.6 ? F.cobble(S.cobble, S.gap)(u, v) : h01(Math.floor(u * 7), Math.floor(v * 7)) > 0.5 ? "#eef2f8" : "#e2e8f2");
      default: return F.cobble(S.cobble, S.gap);
    }
  }

  // ---------- the hour: sky, ambient light and whether the lamps are lit ----------
  function hourOf(o) { return o.hour != null ? o.hour : 12; }
  function lightAt(hr, wx) {
    const grey = wx === "rain" || wx === "storm" || wx === "fog" || wx === "cloudy";
    if (hr < 5.5 || hr >= 21) return { night: true, lamps: true, sky: ["#0e1428", "#1e2a4a"], tint: null, amb: 0.36 };
    if (hr < 7) return { night: false, lamps: true, sky: grey ? ["#6a6e80", "#a8a0a0"] : ["#6a7aa8", "#f0b898"], tint: ["#ffb880", 0.14], amb: 0.9 };
    if (hr >= 19.5) return { night: true, lamps: true, sky: ["#1a1e3a", "#5a4a6a"], tint: null, amb: 0.5 };
    if (hr >= 17.5) return { night: false, lamps: true, sky: grey ? ["#5a5e6e", "#a88a78"] : ["#4a6aa0", "#f4a868"], tint: ["#ff9a50", 0.16], amb: 0.85 };
    if (grey) return { night: false, lamps: false, sky: wx === "fog" ? ["#a8aeb4", "#c8ccce"] : ["#7a8494", "#a4acb6"], tint: ["#8a96a8", 0.1], amb: 1 };
    return { night: false, lamps: false, sky: hr < 10 ? ["#7ab0e0", "#d8e8f0"] : ["#5a98d8", "#c8e0f0"], tint: hr < 9 ? ["#ffd8a0", 0.06] : null, amb: 1 };
  }

  // ---------- the stage and its two kinds of set ----------
  // indoors: the room's back corner at the top, walls running off both sides (the song scenes' camera); outdoors: lower, with sky
  const IN = { OY: 40, NU: 20, NV: 20, WH: 100 }, OUT = { OY: 30, NU: 16, NV: 16, WH: 44 };
  function stageFor(outdoor) { const g = outdoor ? OUT : IN; return Object.assign(Tv().stage(W, H, R(W / 2), g.OY), { g }); }

  // the sky behind an outdoor set: the hour's gradient, a sun or moon, clouds by the weather
  function sky(ctx, L, wx, r, hr) {
    for (let y = 0; y < H; y++) { ctx.fillStyle = mix(L.sky[0], L.sky[1], Math.min(1, y / 90)); ctx.fillRect(0, y, W, 1); }
    if (L.night) for (let i = 0; i < 40; i++) { ctx.fillStyle = r() < 0.6 ? "#e8e4d0" : "#9aa8d0"; ctx.fillRect(R(r() * W), R(r() * 60), 1, 1); }
    const grey = wx === "rain" || wx === "storm" || wx === "fog" || wx === "cloudy";
    if (!grey) {
      const sx = hr < 12 ? 40 + (hr - 6) * 8 : 200 - (hr - 12) * 8, sy = L.night ? 16 : 26 - Math.sin(Math.max(0, Math.min(1, (hr - 6) / 12)) * Math.PI) * 18;
      if (L.night) { pix(ctx, 214, 12, [".xx.", "xxyx", "xxxx", ".xx."], { x: "#f4ecc8", y: "#fffbe8" }); glow(ctx, 216, 14, 14, "#c8d0f0", 0.2); }
      else { glow(ctx, sx, sy, 22, "#fff4c8", 0.5); ctx.fillStyle = "#fff8e0"; ctx.fillRect(R(sx) - 2, R(sy) - 2, 5, 5); ctx.fillRect(R(sx) - 3, R(sy) - 1, 7, 3); }
    }
    const nc = grey ? 7 : 3, cc = grey ? (wx === "storm" ? "#5a5e6c" : "#9aa0aa") : L.night ? "#2a3250" : "#f4f6fa";
    for (let i = 0; i < nc; i++) {
      const cx = r() * W, cy = 4 + r() * 30, w = 18 + r() * 30;
      for (let k = 0; k < 4; k++) { ctx.fillStyle = k === 3 ? shade(cc, -0.15) : cc; ctx.fillRect(R(cx + k * w * 0.18), R(cy - Math.sin((k / 3) * Math.PI) * 4), R(w * 0.55), 4 + (k === 3 ? 1 : 0)); }
    }
  }

  // a run of house fronts along one back edge (side "l" runs along v, "r" along u), each with windows, a door, a roof and a chimney
  function facades(k, side, runs) {
    const { st, ctx, S, r, L } = k, P = Tv(), wall = side === "l" ? st.lwall : st.rwall, on = side === "l" ? st.onL : st.onR;
    const lit = [];
    for (const b of runs) {
      const [a0, a1, hh] = b, mat = b.mat || wallOf(S), roofH = b.roofH || 16;
      const f = (x, y) => { const [a, h] = on(x, y), c = mat(a, h); return side === "r" ? shade(c, 0.06) : shade(c, -0.1); };
      P.fillPoly(ctx, [wall(a0, 0), wall(a1, 0), wall(a1, hh), wall(a0, hh)], f);
      // the roof leans back from the eaves: rows of tiles (or thatch, or moss), snow on top in Frosthold
      const rc = S.roof;
      P.fillPoly(ctx, [wall(a0 - 0.2, hh), wall(a1 + 0.2, hh), wall(a1 + 0.2, hh + roofH), wall(a0 - 0.2, hh + roofH)], (x, y) => {
        const [a, h] = on(x, y), dh = h - hh;
        if (S.snow && dh > roofH - 5 - (h01(Math.floor(a * 6), 1) > 0.5 ? 1 : 0)) return dh > roofH - 2 ? "#f4f8fc" : "#dfe6f0";
        if (S.thatch) return h01(Math.floor(a * 14), Math.floor(dh / 2)) > 0.7 ? shade(rc[0], 0.12) : dh % 4 < 1 ? rc[1] : rc[0];
        const row = Math.floor(dh / 3), kk = a * 4 + (row % 2 ? 0.5 : 0);
        if (dh % 3 < 1) return shade(rc[1], -0.2);
        if (frac(kk) < 0.12) return rc[1];
        const c = rc[Math.floor(h01(row, Math.floor(kk)) * rc.length)];
        return S.moss && h01(Math.floor(a * 5), row) > 0.7 ? mix(c, "#6a8a3a", 0.5) : c;
      });
      P.line(ctx, wall(a0 - 0.2, hh), wall(a1 + 0.2, hh), shade(rc[1], -0.45));
      P.line(ctx, wall(a0 - 0.2, hh + 1), wall(a1 + 0.2, hh + 1), shade(rc[1], -0.25));
      // a chimney on most roofs, its smoke drawn live (k.smoke)
      if (b.chimney !== false && r() < 0.8) {
        const ca = a0 + 0.4 + r() * Math.max(0.2, a1 - a0 - 1.2), cw = 0.5;
        P.fillPoly(ctx, st.quad(wall, ca, ca + cw, hh + roofH - 6, hh + roofH + 8), (x, y) => { const [, h] = on(x, y); return h > hh + roofH + 6 ? shade(S.stone[0], -0.3) : M.stone(S.stone, S.mortar, 3, 0.25)(on(x, y)[0], h); });
        k.smoke.push(wall(ca + cw / 2, hh + roofH + 8));
      }
      // windows in a row under the eaves and a row lower down; at dusk and night some are lit
      const nWin = Math.max(1, Math.floor((a1 - a0) / 1.6));
      for (let i = 0; i < nWin; i++) {
        const wa = a0 + ((i + 0.5) * (a1 - a0)) / nWin - 0.35, rows = hh > 34 ? [hh - 16, hh - 33] : [hh - 16];
        for (const wy of rows) {
          if (b.door != null && Math.abs(wa + 0.35 - b.door) < 0.8 && wy < 20) continue;
          const glowing = L.lamps && r() < 0.55;
          P.fillPoly(ctx, st.quad(wall, wa - 0.1, wa + 0.8, wy - 1, wy + 11), shade(S.trim, -0.35));
          P.fillPoly(ctx, st.quad(wall, wa, wa + 0.7, wy, wy + 10), (x, y) => { const [, h] = on(x, y), t = (h - wy) / 10; return glowing ? (t > 0.6 ? "#ffe4a0" : "#f4b860") : L.night ? "#1a2238" : t > 0.55 ? "#9ab8d4" : "#4a6a8a"; });
          P.fillPoly(ctx, st.quad(wall, wa + 0.32, wa + 0.38, wy, wy + 10), shade(S.trim, -0.35));
          P.fillPoly(ctx, st.quad(wall, wa, wa + 0.7, wy + 4.5, wy + 5.5), shade(S.trim, -0.35));
          // shutters in the town's trim colour
          for (const [s0, s1] of [[wa - 0.32, wa - 0.08], [wa + 0.78, wa + 1.02]]) P.fillPoly(ctx, st.quad(wall, s0, s1, wy, wy + 10), (x, y) => (on(x, y)[1] % 3 < 1 ? shade(S.trim, -0.3) : S.trim));
          P.fillPoly(ctx, st.quad(wall, wa - 0.15, wa + 0.85, wy - 2, wy - 1), shade(S.stone[0], 0.1));
          if (glowing) { const [x, y] = wall(wa + 0.35, wy + 5); lit.push({ x, y: y + 10, r: 26, k: 0.5 }); }
          if (b.flowers && wy < 20 && r() < 0.6) for (let j = 0; j < 6; j++) { const [x, y] = wall(wa + j * 0.12, wy - 2); ctx.fillStyle = ["#d84a5a", "#f0c040", "#e86a9a", "#5a9a3a"][(j + i) % 4]; ctx.fillRect(R(x), R(y) - 1, 1, 1); }
        }
      }
      if (b.door != null) {
        const d = b.door;
        P.fillPoly(ctx, st.quad(wall, d - 0.6, d + 0.6, 0, 20), shade(S.trim, -0.4));
        P.fillPoly(ctx, st.quad(wall, d - 0.48, d + 0.48, 0, 18), (x, y) => { const [a, h] = on(x, y); return frac(a * 3.2) < 0.12 ? shade(S.door, -0.3) : h > 15 && Math.abs(a - d) > 0.3 ? shade(S.trim, -0.4) : S.door; });
        const [hx, hy] = wall(d + 0.3, 9); ctx.fillStyle = "#e8c060"; ctx.fillRect(R(hx), R(hy), 1, 1);
        P.slab(ctx, st, side === "r" ? d - 0.7 : 0, side === "r" ? 0 : d - 0.7, side === "r" ? 1.4 : 0.35, side === "r" ? 0.35 : 1.4, 2, S.stone[1]);
        if (L.lamps) { const [x, y] = wall(d, 10); lit.push({ x, y: y + 8, r: 20, k: 0.35 }); }
      }
      if (b.sign) sign(k, side, b.sign[0], b.sign[1], b.sign[2]);
    }
    return lit;
  }
  // a hanging sign on a bracket: its picture (a mug, a loaf, a horseshoe, a scroll...) on a board in the town's colours
  const SIGNS = {
    mug: [".xxx.", "xyyxx", "xyyx.x", "xyyxx", ".xxx."], loaf: [".xxxx.", "xyyyyx", "xyyyyx", ".xxxx."], shoe: ["x...x", "xy.yx", "xy.yx", ".xyx."],
    scroll: ["xxxxx", "xyyyx", "xyxyx", "xyyyx", "xxxxx"], fish: ["..x...", ".xyx.x", "xyyyxx", ".xyx.x", "..x..."], cross: ["..x..", ".xyx.", "xyyyx", ".xyx.", "..x.."],
    pot: ["xxxxx", "xyyyx", "xyyyx", ".xxx."], sword: ["....x", "...x.", "..x..", "xx...", "x...."], star: ["..x..", "xxyxx", ".xyx.", "x...x"],
  };
  function sign(k, side, a, h, pic) {
    const { st, ctx, S } = k, wall = side === "l" ? st.lwall : st.rwall, [bx, by] = wall(a, h), x = R(bx) + (side === "l" ? -12 : 4), y = R(by);
    ctx.fillStyle = "#2a1a10"; ctx.fillRect(Math.min(R(bx), x + 6), y - 1, 8, 1);
    ctx.fillRect(x + 1, y, 1, 3); ctx.fillRect(x + 8, y, 1, 3);
    ctx.fillStyle = shade(S.trim, -0.4); ctx.fillRect(x - 1, y + 3, 12, 10);
    ctx.fillStyle = S.trim; ctx.fillRect(x, y + 4, 10, 8);
    pix(ctx, x + 2, y + 5, SIGNS[pic] || SIGNS.star, { x: "#2a1a10", y: "#f4e4b0" });
  }

  // the room: a dark ceiling, the two back walls in a material, a skirting board, the floor
  function room(k, wallFn, floorFn, o) {
    const { st, ctx } = k, P = Tv(), { NU, NV, WH } = st.g, opt = o || {};
    ctx.fillStyle = opt.ceiling || "#1c120c"; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const kk = y - Math.abs(x - st.OX) / 2, b = ((Math.floor(kk / 6) % 2) + 2) % 2;
      ctx.fillStyle = ((kk % 6) + 6) % 6 < 1 ? "#140c08" : b ? (opt.beam || "#2c1c12") : (opt.ceiling || "#24170e"); ctx.fillRect(x, y, 1, 1);
    }
    const side = (s) => (x, y) => { const [a, h] = s === "l" ? st.onL(x, y) : st.onR(x, y), c = (s === "l" ? opt.left || wallFn : opt.right || wallFn)(a, h); return s === "r" ? shade(c, 0.06) : shade(c, -0.12); };
    P.fillPoly(ctx, [st.lwall(0, WH), st.lwall(NV, WH), st.iso(0, NV), st.iso(0, 0)], side("l"));
    P.fillPoly(ctx, [st.rwall(0, WH), st.rwall(NU, WH), st.iso(NU, 0), st.iso(0, 0)], side("r"));
    const skirt = opt.skirt || "#3a2414";
    P.fillPoly(ctx, [st.lwall(0, 3), st.lwall(NV, 3), st.iso(0, NV), st.iso(0, 0)], skirt);
    P.fillPoly(ctx, [st.rwall(0, 3), st.rwall(NU, 3), st.iso(NU, 0), st.iso(0, 0)], shade(skirt, 0.1));
    P.line(ctx, st.iso(0, 0), st.lwall(0, WH), "#2a180e");
    P.fillPoly(ctx, [st.iso(0, 0), st.iso(NU, 0), st.iso(NU, NV), st.iso(0, NV)], (x, y) => { const [u, v] = st.toUV(x, y); return floorFn(u, v); });
    // a soft shadow where the floor meets the walls
    P.fillPoly(ctx, [st.iso(0, 0), st.iso(NU, 0), st.iso(NU, 0.5), st.iso(0.5, 0.5), st.iso(0.5, NV), st.iso(0, NV)], "rgba(10,6,4,0.18)");
  }
  // a window in a back wall: sky by the hour (or the night), light falling across the floor by day
  function window_(k, side, a0, a1, h0, h1, o) {
    const { st, ctx, L, S } = k, P = Tv(), wall = side === "l" ? st.lwall : st.rwall, on = side === "l" ? st.onL : st.onR, opt = o || {};
    const fr = opt.frame || shade(S.timber, 0.1);
    P.fillPoly(ctx, st.quad(wall, a0 - 0.15, a1 + 0.15, h0 - 2, h1 + 2), fr);
    P.fillPoly(ctx, st.quad(wall, a0, a1, h0, h1), (x, y) => {
      const [a, h] = on(x, y), t = (h - h0) / (h1 - h0);
      if (opt.glass) { const c = opt.glass[(Math.floor(a * 6) + Math.floor(h / 5)) % opt.glass.length]; return L.night ? shade(c, -0.6) : t > 0.5 ? shade(c, 0.2) : c; }
      return L.night ? (t > 0.5 ? "#1e2a4a" : "#16203a") : mix(L.sky[1], L.sky[0], t);
    });
    if (opt.arch) P.fillPoly(ctx, st.quad(wall, a0, a1, h1 - 3, h1), fr);
    for (const m of opt.bars || [(a0 + a1) / 2]) P.fillPoly(ctx, st.quad(wall, m - 0.05, m + 0.05, h0, h1), fr);
    P.fillPoly(ctx, st.quad(wall, a0, a1, (h0 + h1) / 2 - 0.5, (h0 + h1) / 2 + 0.5), fr);
    P.slab(ctx, st, side === "r" ? a0 - 0.2 : 0, side === "r" ? 0 : a0 - 0.2, side === "r" ? a1 - a0 + 0.4 : 0.3, side === "r" ? 0.3 : a1 - a0 + 0.4, 2, shade(fr, 0.15), h0 - 4);
    if (!L.night && opt.beam !== false) {
      // the day coming in: a pale slab of light across the floor, tinted by coloured glass
      const reach = opt.reach || 4, tint = opt.glass ? opt.glass[0] : "#fff4d8";
      const pts = side === "r" ? [st.iso(a0, 0.1), st.iso(a1, 0.1), st.iso(a1 + reach * 0.5, reach), st.iso(a0 + reach * 0.5, reach)]
        : [st.iso(0.1, a0), st.iso(0.1, a1), st.iso(reach, a1 + reach * 0.5), st.iso(reach, a0 + reach * 0.5)];
      const [cr, cg, cb] = rgb(tint);
      P.fillPoly(ctx, pts, (x, y) => ((x + y) % 2 ? `rgba(${cr},${cg},${cb},0.16)` : `rgba(${cr},${cg},${cb},0.09)`));
      k.shafts.push({ side, a0, a1, h0, h1, tint });
    }
    if (L.night || L.lamps) { const [x, y] = wall((a0 + a1) / 2, (h0 + h1) / 2); k.lights.push({ x, y: y + 6, r: 30, k: 0.3, cool: L.night }); }
  }

  // ---------- the sets ----------
  const SETS = {};

  function crate(k, u, v, col, lid) {
    const c = k.piece(), g = c.getContext("2d"), P = Tv();
    P.slab(g, k.st, u, v, 0.7, 0.7, 7, { base: col || "#8a6236", left: (x, y) => ((y + x) % 4 ? "#8a6236" : "#6a4426"), right: "#5a3a1e" });
    if (lid !== false) P.line(g, k.st.up(k.st.iso(u, v + 0.7), 3.5), k.st.up(k.st.iso(u + 0.7, v + 0.7), 3.5), "#5a3a1e");
    k.add(u + v + 1.4, c);
  }
  function basket(k, u, v, col) {
    const c = k.piece(), g = c.getContext("2d"), [x, y] = k.st.iso(u, v);
    pix(g, R(x) - 4, R(y) - 6, [".yyyyyy.", "yzyzyzyz", "xxxxxxxx", "xwxwxwxw", ".xwxwxw.", "..xxxx.."], { x: "#8a5a2a", w: "#a8743a", y: col, z: shade(col, 0.25) });
    k.add(u + v + 0.3, c);
  }
  function barrel(k, u, v, s) { const c = k.piece(), [x, y] = k.st.iso(u, v); Tv().barrel(c.getContext("2d"), R(x), R(y), s); k.add(u + v + 0.6, c); }
  function lampPost(k, u, v) {
    const c = k.piece(), g = c.getContext("2d"), [x, y] = k.st.iso(u, v);
    g.fillStyle = "#2a2a30"; g.fillRect(R(x), R(y) - 40, 2, 40); g.fillRect(R(x) - 1, R(y) - 2, 4, 2);
    g.fillRect(R(x) - 2, R(y) - 46, 6, 1); g.fillRect(R(x) - 2, R(y) - 41, 6, 1); g.fillRect(R(x) - 2, R(y) - 46, 1, 6); g.fillRect(R(x) + 3, R(y) - 46, 1, 6);
    g.fillStyle = k.L.lamps ? "#ffe090" : "#c8d4dc"; g.fillRect(R(x) - 1, R(y) - 45, 4, 4);
    k.add(u + v, c);
    if (k.L.lamps) k.lights.push({ x: R(x) + 1, y: R(y) - 43, r: 40, k: 0.6, flame: [R(x) + 1, R(y) - 43] });
  }
  // the tavern is the song scenes' own room (Ballad.build): its town's look, its hearth, bar, tables and regulars, by day or by night;
  // the acts' figures are handed to its depth sort each frame (compose)
  function balladTavern(o, L) {
    const items = [], b = Ballad.build({ id: "town:" + o.town + ":" + (o.seed || ""), towns: [o.town], heroes: [], day: 0 }, W,
      { cast: [], things: items, event: { wx: o.weather }, ambient: L.night ? 0.42 : L.lamps ? 0.58 : 0.82,
        // the regulars keep to the hearth and the top of the bar, clear of the table by the bar where the hero sits
        locals: (OX, OY) => [[OX - 82, OY + 44, 1], [OX - 104, OY + 62, 1], [OX + 34, OY + 36, -1], [OX - 40, OY + 80, 1]],
        // the acts bring their own keeper, who can walk out from behind the bar
        pose: (f, t, p) => { if (f.role === "keeper") p.alpha = 0.001; },
        over: (ctx) => { if (!L.night) dayWindow(ctx, b.st, L); } });
    const st = b.st, uv = (x, y) => [((x - b.OX) / 8 + (y - b.OY) / 4) / 2, ((y - b.OY) / 4 - (x - b.OX) / 8) / 2];
    const t1 = uv(b.OX - 74, b.OY + 62), t2 = uv(b.OX + 54, b.OY + 66), kp = uv(b.OX + 99, b.OY + 54);
    const spots = {
      // the hearth table is the regulars' (the ambient patrons stand round it), so the hero takes the free table by the bar
      seat: [t2[0] + 0.35, t2[1] + 1.35, 1], act: [t2[0] + 0.35, t2[1] + 1.35, 1], mate: [t2[0] + 1.35, t2[1] + 0.35, -1], seat2: [t2[0] + 1.35, t2[1] + 0.35, -1],
      other: [t1[0] + 0.35, t1[1] + 1.35, 1], table: t2, bar: [11.6, 3.0, -1], npc: [kp[0], kp[1], -1], hearth: [3.0, 9.0, -1], in: [12, 12, -1], pet: [t2[0] - 0.2, t2[1] + 1.6, 1],
      stage: [2.2, 2.2, 1], board: [11.6, 3.0, -1], counter: [11.6, 3.0, -1], barend: [9.0, 0.9, -1],
    };
    return { bg: b.bg, st, spots, crowd: [], npc: { kind: "keeper", name: (Ballad.LOOKS[o.town] || {}).keeper }, ballad: b, items };
  }
  // where the hero slept, as the hero page's night scene drew it (camp.js Night.roomParts: the rented room, the suite, a home, the stables
  // loft), now in the morning light; the inn's common room is the tavern's own (Tavern.room, its pallets)
  const HOME_KIND = { private: "private", suite: "suite", home: "cottage" };
  function sleptRoom(o, L) {
    const lodge = o.lodge || "common", cast = o.cast || [], hero = cast[0] || {}, P = Tv();
    if (lodge === "common" || !root.Night || !Night.roomParts) {
      const st = P.stage(198, 158, 87, 60), r = Art.rng(Art.hash("inn:" + (o.seed || "") + o.town)), look = { town: o.town };
      const bg = P.room(st, r, look), f = P.furnish(st, r, false), props = f.furniture.slice();
      const bl = ["#7a4a2a", "#5a3a1e"], pal = st.canvas();
      P.pallet(pal.getContext("2d"), st, 1.0, 7.6, 1.9, 1.0, bl, "#3a2a1a");
      props.push({ key: 1.0 + 7.6 + 1.6, cv: pal });
      const inside = P.inRoom(st, 13, 10, 54), shine = P.lighting(198, 158, (x, y) => inside(x, y) && !look.views.some((v) => v.glass(x, y)));
      const fire = P.stage && P.ROOM ? P.ROOM.FIRE : { v0: 4.8, v1: 7.0 };
      return { W: 198, H: 158, st, bg, props, views: look.views, fire: [fire.v0, fire.v1], anims: [], lights: [], amb: L.night ? 0.42 : 0.74, shine, snores: f.sleepers,
        bedAt: [1.6, 8.1], lie: { quilt: bl, len: 1.2 }, z: 3, candles: f.candles,
        spots: { act: [3.2, 6.6, -1], bed: [2.6, 9.0, -1], in: [11, 8, -1], window: [9.4, 2.6, 1], mate: [4.4, 7.4, -1], pet: [2.6, 9.6, 1], other: [5.0, 6.4, -1], door: [11.8, 4.0, -1] } };
    }
    const t = { room: lodge === "stables" ? null : HOME_KIND[lodge] || "private", setting: lodge === "stables" ? "stable" : "room", town_id: o.town, host: { mount: hero.mount } };
    const p = Night.roomParts(t, cast.map((h) => ({ h })), "town:" + (o.seed || "") + lodge);
    const bed = p.st.bed || {};
    const inside = P.inRoom(p.st, p.NU, p.NV, p.WH), shine = P.lighting(p.W, p.H, (x, y) => inside(x, y) && !p.views.some((v) => v && v.glass(x, y)));
    const c = p.inBed || [1.2, 1.0];
    return { W: p.W, H: p.H, st: p.st, bg: p.bg, props: p.props, views: p.views.filter(Boolean), fire: p.fire, anims: p.anims, lights: p.lights, shine,
      amb: L.night ? p.amb : L.lamps ? Math.max(p.amb, 0.62) : 0.8, bedAt: c, lie: bed.lie || { quilt: ["#3a5a7a", "#2e4a66"], len: 1.3 }, z: bed.z || 11, crewBeds: p.crewBeds,
      spots: { act: [5.0, 4.6, -1], bed: [c[0] + 2.4, c[1] + 1.2, -1], in: [5.6, 9.0, -1], window: [7.4, 2.2, 1], mate: [6.4, 5.6, -1], pet: (bed.pet || [3, 2]).concat([1]),
        other: [6.0, 4.0, -1], door: [1.0, 8.0, 1], basin: [5.6, 1.4, 1] } };
  }
  function roomSet(o, L, base) {
    const p = sleptRoom(o, L), flick = (t) => 0.75 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.08;
    return Object.assign(base, { W: p.W, H: p.H, st: p.st, bg: p.bg, spots: p.spots, crowd: [], npc: null, bedAt: p.bedAt, lie: p.lie, bedZ: p.z,
      amb(ctx, t, still) {
        for (const v of p.views) v.draw(ctx, t, still);
        if (!L.night) for (const v of p.views) dayGlass(ctx, p.W, p.H, v, L);
        if (p.fire) Tv().flames(ctx, p.st, t, p.fire[0], p.fire[1], flick(t), 1, true);
      },
      compose(ctx, t, still, items) {
        const f = flick(t);
        p.props.map((th) => ({ key: th.key, draw: () => (th.cv ? ctx.drawImage(th.cv, 0, 0) : th.draw(ctx, t, f, still)) })).concat(items).sort((a, b) => a.key - b.key).forEach((d) => d.draw());
      },
      over(ctx, t, still) {
        const f = flick(t);
        for (const a of p.anims) a(ctx, t, f, still);
        for (const [x, y, ph] of p.snores || []) if (!still) Tv().zzz(ctx, x, y, t + ph);
        for (const [x, y] of p.candles || []) Tv().candle(ctx, R(x), R(y), t, f, 3);
        for (const l of p.lights) if (l.fire || l.flame) l.k = l.base * (l.fire ? 0.7 + f * 0.35 : 0.88 + f * 0.15);
        p.shine(ctx, t, p.lights, p.amb);
      } });
  }
  // a night window seen by day: its glass gets the hour's sky
  function dayGlass(ctx, w, h, v, L) {
    if (!v.glass) return;
    if (!v.dayPane) {
      // the panes, found once, painted with the sky as one small canvas
      const c = canvas(w, h), g = c.getContext("2d");
      let y0 = h, y1 = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (v.glass(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (v.glass(x, y)) { const k = (y - y0) / Math.max(1, y1 - y0); g.fillStyle = mix(L.sky[0], L.sky[1], k); g.fillRect(x, y, 1, 1); }
      v.dayPane = c;
    }
    ctx.drawImage(v.dayPane, 0, 0);
  }

  // the morning in the tavern's window: the hour's sky instead of the night view, painted after the room's light
  function dayWindow(ctx, st, L) {
    Tv().fillPoly(ctx, st.quad(st.rwall, 4.6, 6.4, 20, 40), (x, y) => { const [, h] = st.onR(x, y), t = (h - 20) / 20; return mix(L.sky[1], L.sky[0], t); });
    Tv().fillPoly(ctx, st.quad(st.rwall, 5.44, 5.56, 20, 40), "#3a2414");
    Tv().fillPoly(ctx, st.quad(st.rwall, 4.6, 6.4, 29.5, 30.5), "#3a2414");
  }

  // where the hero slept: the common room's pallets, a rented room, the best suite, the stables loft, a home, a cell
  SETS.room = function (k) {
    const { st, ctx, r } = k, P = Tv(), look = (root.Ballad && Ballad.LOOKS[k.town]) || null, lodge = k.lodge || "common";
    const wallFn = lodge === "cell" ? M.stone(["#6a6660", "#5e5a54", "#76726a"], "#3a3632", 6) : lodge === "stables" ? M.boards(["#7a5232", "#704a2c", "#845a38"], "#3a2414")
      : lodge === "suite" ? M.stone(["#c8b89a", "#bcac8e"], "#9a8a6e", 12, 3) : look ? look.wall : wallOf(k.S);
    const floorFn = lodge === "cell" ? F.flags(["#5e5a54", "#56524c", "#66625a"], "#3a3632") : lodge === "stables" ? F.noise(["#c4a452", "#b4943e", "#a8883e"], 7)
      : look ? look.floor : F.planks(["#7a5a3a", "#70522e"], "#3e2a18");
    room(k, wallFn, floorFn, lodge === "suite" ? { skirt: "#6a4a2a" } : null);
    if (lodge !== "cell") window_(k, "r", 5.4, 7.0, 22, 40, { frame: lodge === "suite" ? "#c8a040" : "#3a2414", reach: 4 });
    else { window_(k, "r", 6.0, 6.8, 46, 54, { frame: "#3a3632", bars: [6.2, 6.4, 6.6], beam: true, reach: 3 }); }
    const bed = (u, v, du, dv, cols, posts) => {
      const c = k.piece(), g = c.getContext("2d");
      P.slab(g, st, u, v, du, dv, 6, { base: "#6a4428", left: "#6a4428", right: "#4a2e1a" });
      P.slab(g, st, u + 0.1, v + 0.1, du - 0.2, dv - 0.2, 3, { base: cols[0], top: (x, y) => (((x >> 1) + y) % 5 === 0 ? cols[1] : cols[0]) }, 6);
      P.slab(g, st, u + 0.15, v + 0.15, 0.6, dv - 0.3, 2, { base: "#e8dcc0", top: "#f4ead4" }, 9);
      if (posts) for (const [pu, pv] of [[u, v], [u + du, v], [u, v + dv], [u + du, v + dv]]) { const [x, y] = st.iso(pu, pv); g.fillStyle = "#4a2e1a"; g.fillRect(R(x) - 1, R(y) - 40, 2, 40); }
      if (posts) P.fillPoly(g, [st.up(st.iso(u, v), 40), st.up(st.iso(u + du, v), 40), st.up(st.iso(u + du, v + dv), 40), st.up(st.iso(u, v + dv), 40)], (x, y) => ((x + y) % 4 ? cols[1] : shade(cols[1], -0.2)));
      k.add(u + du + v + dv, c);
    };
    if (lodge === "common") {
      for (const [u, v, b] of [[1.0, 1.6, ["#8a3a2a", "#6a2a1e"]], [1.0, 4.0, ["#3a5a7a", "#2a4a6a"]], [4.6, 1.0, ["#5a6a3a", "#4a5a2e"]], [8.0, 1.0, ["#8a6a3a", "#6a4a2a"]]]) {
        const c = k.piece(); const zz = P.pallet(c.getContext("2d"), st, u, v, 2.6, 1.2, b, ["#3a2a1a", "#6a4020", "#c8a050", "#9a9aa6"][Math.floor(r() * 4)]); k.add(u + v + 3.8, c); k.snores.push(zz);
      }
      k.spot("bed", 2.4, 7.4, -1); k.bed = { kind: "pallet", u: 1.0, v: 6.4 };
      const c = k.piece(); P.pallet(c.getContext("2d"), st, 1.0, 6.4, 2.6, 1.2, ["#7a4a2a", "#5a3a1e"], "#3a2a1a"); k.add(1 + 6.4 + 3.8, c);
    } else if (lodge === "stables") {
      for (let i = 0; i < 5; i++) { const c = k.piece(); P.slab(c.getContext("2d"), st, 6 + (i % 3) * 1.6, 0.6 + Math.floor(i / 3) * 1.0, 1.4, 0.9, 8, { base: "#c4a452", top: (x, y) => ((x * 3 + y) % 5 < 2 ? "#d8b860" : "#b8984a"), left: "#b4943e", right: "#8a6a36" }); k.add(8 + i, c); }
      k.bed = { kind: "hay", u: 1.2, v: 5.0 }; k.spot("bed", 2.8, 6.4, -1);
    } else if (lodge === "cell") {
      const c = k.piece(), g = c.getContext("2d"); P.slab(g, st, 0.6, 3.0, 2.4, 1.0, 5, { base: "#6a6660", top: (x, y) => ((x + y) % 3 ? "#c8a858" : "#a8883e") }); k.add(3 + 4 + 1, c);
      k.bed = { kind: "bench", u: 0.6, v: 3.0 }; k.spot("bed", 2.0, 4.6, -1);
      k.bars = true;
    } else {
      const suite = lodge === "suite", home = lodge === "home";
      bed(1.0, 1.4, 2.4, 1.7, suite ? ["#8a2a3a", "#c8a040"] : home ? ["#5a7a3a", "#d8c890"] : ["#3a5a7a", "#a8b8c8"], suite);
      k.bed = { kind: "bed", u: 1.0, v: 1.4, du: 2.4, dv: 1.7 }; k.spot("bed", 3.8, 2.6, -1);
      const chest = k.piece(); P.slab(chest.getContext("2d"), st, 4.0, 0.6, 1.0, 0.7, 6, { base: "#6a4428", top: "#8a5a34" }); k.add(6.3, chest);
      if (suite) {
        P.fillPoly(ctx, [st.iso(3.6, 4.2), st.iso(8.6, 4.2), st.iso(8.6, 8.2), st.iso(3.6, 8.2)], (x, y) => { const [u, v] = st.toUV(x, y); return u < 3.9 || v < 4.5 || u > 8.3 || v > 7.9 ? "#c8a040" : (Math.floor(u * 2) + Math.floor(v * 2)) % 2 ? "#8a2a3a" : "#7a2232"; });
        const ward = k.piece(); P.slab(ward.getContext("2d"), st, 0, 9.0, 0.9, 2.0, 44, { base: "#5a3420", left: (x, y) => ((y % 9) < 1 ? "#3a2414" : "#6a4028"), right: "#4a2a18" }); k.add(12, ward);
      }
      if (home) { P.hearth(ctx, st, r, 7.0, 9.2, k.st.g.WH, { mantel: "#5e3a1e" }); k.fire = [7.0, 9.2]; }
      const tbl = k.piece(); P.table(tbl.getContext("2d"), st, 6.4, 3.4, 1.0, 1.0, 9, "#7e5230"); k.add(6.4 + 3.4 + 2, tbl);
    }
    k.spot("act", 3.6, 5.6, -1); k.spot("in", 10, 10, -1); k.spot("mate", 6.0, 6.6, -1); k.spot("pet", 4.6, 7.0, -1); k.spot("npc", 8.6, 8.0, -1); k.spot("door", 9.6, 1.0, 1);
    k.spot("window", 6.2, 1.6, 1);
    k.npc = lodge === "cell" ? { kind: "guard" } : null;
    k.lamps.push([5.6, 5.6, 64]);
  };

  // ---------- the build ----------
  function build(set, o) {
    o = o || {};
    const town = o.town || "thornwall", fn = SETS[set] || SETS.square;
    const outdoor = OUTDOOR.has(set), hr = hourOf(o), wx = o.weather || "clear";
    const L = lightAt(hr, wx), S = STYLE[town] || DEFAULT, th = theme(town);
    if (set === "room" && (o.lodge !== "cell")) {
      return roomSet(Object.assign({}, o, { town }), L, { set, town, hour: hr, weather: wx, night: L.night, lamps: L.lamps, outdoor: false, things: [], S, th, L, lodge: o.lodge || "common" });
    }
    if (set === "tavern" && root.Ballad && Ballad.build) {
      const b = balladTavern(Object.assign({}, o, { town }), L);
      return { W, H, st: b.st, set, town, hour: hr, weather: wx, night: L.night, lamps: L.lamps, outdoor: false, bg: b.bg, things: [], spots: b.spots, crowd: b.crowd,
        npc: b.npc, S, th, L, amb() {}, over() {},
        compose(ctx, t, still, items) { b.items.length = 0; b.items.push(...items); b.ballad.draw(ctx, t, still, false); } };
    }
    // the open places (street, market, square, green) are seen side-on like the road (town_day_flat.js)
    if (root.TownFlat && TownFlat.has(set)) return TownFlat.build(set, Object.assign({}, o, { town }), { S, L, th, town, hour: hr, weather: wx });
    const st = stageFor(outdoor);
    const bg = canvas(W, H), ctx = bg.getContext("2d"), seed = Art.hash(String(o.seed || "") + set + town);
    const r = Art.rng(seed);
    const k = {
      st, ctx, S, th, r, L, town, hour: hr, wx, lodge: o.lodge, festival: !!o.festival, season: o.season,
      things: [], spots: {}, crowdAt: [], lights: [], candles: [], lamps: [], smoke: [], shafts: [], snores: [], leaves: [], anims: [],
      piece: () => st.canvas(),
      add: (key, cv) => k.things.push({ key, cv }),
      spot: (name, u, v, face, mode) => { k.spots[name] = mode ? [u, v, face || 1, mode] : [u, v, face || 1]; },
      crowd: (xs) => { k.crowdAt = xs; },
      outdoorBack: (left, right, ground) => {
        sky(ctx, L, wx, r, hr);
        const g = ground || groundOf(S, town), P = Tv();
        P.fillPoly(ctx, [st.iso(0, 0), st.iso(24, 0), st.iso(24, 24), st.iso(0, 24)], (x, y) => { const [u, v] = st.toUV(x, y); return g(u, v); });
        k.lights.push(...facades(k, "l", left.map(([a0, a1, hh, b]) => Object.assign([a0, a1, hh], b || {}))));
        k.lights.push(...facades(k, "r", right.map(([a0, a1, hh, b]) => Object.assign([a0, a1, hh], b || {}))));
        // the shadow of the buildings across the ground near them
        P.fillPoly(ctx, [st.iso(0, 0), st.iso(16, 0), st.iso(16, 0.8), st.iso(0.8, 0.8), st.iso(0.8, 16), st.iso(0, 16)], "rgba(20,14,10,0.16)");
      },
    };
    fn(k);
    k.things.sort((a, b) => a.key - b.key);
    const inside = outdoor ? null : Tv().inRoom(st, st.g.NU, st.g.NV, st.g.WH);
    const shine = (L.lamps || L.night) ? Tv().lighting(W, H, outdoor ? null : (x, y) => inside(x, y) || y < st.OY) : null;
    for (const [u, v, drop] of k.lamps) if (!outdoor && (L.lamps || L.night)) { const [x, y] = st.iso(u, v); k.lights.push({ x, y: y - drop + 10, r: 60, k: 0.5 }); }
    const sc = {
      W, H, st, set, town, hour: hr, weather: wx, night: L.night, lamps: L.lamps, outdoor, bg, things: k.things, spots: k.spots, crowd: k.crowdAt, walkers: k.walkers,
      npc: k.npc || null, S, th, L, horse: k.horse, bed: k.bed, water: k.water, lodge: k.lodge,
      // furniture and the cast, depth-sorted together (key = u + v), over the set's still layer
      compose(ctx, t, still, items) { k.things.map((th) => ({ key: th.key, draw: () => ctx.drawImage(th.cv, 0, 0) })).concat(items).sort((a, b) => a.key - b.key).forEach((d) => d.draw()); },
      amb(c, t, still) {
        for (const a of k.anims) a(c, t, still);
        if (k.fire) Tv().flames(c, st, t, k.fire[0], k.fire[1], 0.8 + Math.sin(t * 13) * 0.08, 1, true);
        for (const [x, y] of k.smoke) for (let i = 0; i < 5; i++) {
          const ph = frac(t * 0.18 + i / 5);
          c.globalAlpha = (1 - ph) * 0.5; c.fillStyle = k.L.night ? "#6a6e80" : "#d8d8d8";
          c.fillRect(R(x + Math.sin(ph * 5 + i) * 3 + ph * 8) - 1, R(y - ph * 26), 3 + R(ph * 3), 2 + R(ph * 2));
        }
        c.globalAlpha = 1;
        if (k.ducks) k.ducks.forEach(([u, v], i) => { const [x, y] = st.iso(u + Math.sin(t * 0.3 + i * 2) * 0.6, v + Math.cos(t * 0.25 + i) * 0.3); pix(c, R(x) - 3, R(y) - 4, [".hh...", "hgh...", ".wwwww", "wwwwww", ".wwww."], { h: "#3a6a3a", g: "#e8a040", w: i === 1 ? "#a87a4a" : "#f4f0e4" }); });
        if (k.boats) k.boats.forEach(([u, v], i) => { const [x, y] = st.iso(u, v), b = R(Math.sin(t * 1.3 + i) * 1.2); boat(c, R(x), R(y) + b, i, k); });
        if (k.water) {
          for (let i = 0; i < 46; i++) { const u = 8.4 + h01(i, 1) * 7.6, v = 3.8 + h01(i, 2) * 12, [x, y] = st.iso(u, v), ph = frac(t * 0.5 + h01(i, 3)); c.fillStyle = ph < 0.5 ? "#8ac0e0" : "#4a8ab8"; c.fillRect(R(x + ph * 4), R(y), 3, 1); }
        }
        for (const [x, y, ph] of k.snores) if (!still) Tv().zzz(c, x, y, t + ph);
      },
      over(c, t, still) {
        if (k.bunting) for (const [p0, p1] of k.bunting) for (let i = 0; i <= 16; i++) { const s = i / 16, x = p0[0] + (p1[0] - p0[0]) * s, y = p0[1] + (p1[1] - p0[1]) * s + Math.sin(s * Math.PI) * 8; c.fillStyle = [th.primary, "#f4ecd8", th.accent][i % 3]; c.fillRect(R(x) - 1, R(y), 3, 2); c.fillRect(R(x), R(y) + 2, 1, 1); }
        if (k.leaves.length && !still) for (const [x, y, rr] of k.leaves) for (let i = 0; i < 3; i++) { const ph = frac(t * 0.12 + i / 3); c.fillStyle = S.snow ? "#f4f8fc" : "#8ab048"; c.fillRect(R(x - rr + ph * rr * 2 + Math.sin(ph * 9 + i) * 4), R(y + ph * 40), 2, 1); }
        if (k.gulls && !still) for (let i = 0; i < 2; i++) { const ph = frac(t * 0.06 + i * 0.5), x = R(W * ph), y = R(18 + i * 9 + Math.sin(t * 2 + i) * 3), f = Math.floor(t * 4 + i) % 2; pix(c, x, y, f ? ["x...x", ".x.x.", "..x.."] : [".....", "xx.xx", "..x.."], { x: "#f4f4f0" }); }
        for (const [x, y] of k.candles) Tv().candle(c, R(x), R(y), t, 0.8, 3);
        for (const [u, v, drop] of k.lamps) if (!outdoor && (L.lamps || L.night)) Tv().lantern(c, st, u, v, 0.8, drop, true);
        // the hour's light: a warm or cool wash outdoors, lamplight at dusk and night
        if (L.tint) { c.fillStyle = `rgba(${rgb(L.tint[0]).join(",")},${L.tint[1]})`; c.fillRect(0, 0, W, H); }
        if (shine) {
          const flick = 0.75 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.08, lights = k.lights.slice();
          if (k.fire) { const p = st.lwall((k.fire[0] + k.fire[1]) / 2, 8); lights.push({ x: p[0] + 14, y: p[1] + 4, r: 84, k: 0.6 + flick * 0.35 }); }
          for (const [x, y] of k.candles) lights.push({ x, y: y - 5, r: 24, k: 0.45 + flick * 0.12 });
          shine(c, t, lights, L.night ? (outdoor ? 0.34 : 0.42) : 0.62);
        }
        weather(c, t, still, wx, outdoor, k);
        if (k.bars) { c.fillStyle = "#2a2a30"; for (let x = 6; x < W; x += 16) c.fillRect(x, 0, 3, H); c.fillStyle = "#4a4a52"; for (let x = 6; x < W; x += 16) c.fillRect(x, 0, 1, H); c.fillRect(0, 10, W, 3); }
      },
    };
    return sc;
  }
  const OUTDOOR = new Set(["market", "square", "street", "green", "yard", "docks"]);

  function boat(c, x, y, i, k) {
    const hull = i % 2 ? k.S.trim : "#6a4a2a";
    pix(c, x - 12, y - 6, ["x.....................x", "xxyyyyyyyyyyyyyyyyyyxx", ".xxyyyyyyyyyyyyyyyyxx.", "..xxxxxxxxxxxxxxxxxx.."], { x: shade(hull, -0.4), y: hull });
    c.fillStyle = "#4a3420"; c.fillRect(x, y - 24, 1, 19);
    if (i % 2 === 0) { c.fillStyle = "#f0ece0"; for (let j = 0; j < 14; j++) c.fillRect(x + 1, y - 23 + j, Math.min(10, R(j * 0.8)), 1); }
  }
  // the weather over the set: rain, snow, fog, a storm's flash; indoors only the patter on the windows
  function weather(c, t, still, wx, outdoor) {
    if (!outdoor || still && wx !== "fog") return;
    const W = c.canvas.width, H = c.canvas.height;
    if (wx === "rain" || wx === "storm") {
      c.fillStyle = "rgba(200,215,235,0.5)";
      for (let i = 0; i < (wx === "storm" ? 90 : 55); i++) { const x = frac(h01(i, 1) + t * 0.15) * (W + 40) - 20, y = frac(h01(i, 2) + t * 1.6) * H; c.fillRect(R(x), R(y), 1, 4); }
      if (wx === "storm" && frac(t / 7.3) < 0.025) { c.fillStyle = "rgba(240,244,255,0.35)"; c.fillRect(0, 0, W, H); }
    } else if (wx === "snow") {
      c.fillStyle = "#f4f8fc";
      for (let i = 0; i < 60; i++) { const x = frac(h01(i, 1) + Math.sin(t * 0.5 + i) * 0.01) * W, y = frac(h01(i, 2) + t * 0.12) * H; c.fillRect(R(x), R(y), i % 3 ? 1 : 2, i % 3 ? 1 : 2); }
    } else if (wx === "fog") {
      for (let y = 0; y < H; y += 2) { c.fillStyle = `rgba(220,226,232,${0.12 + Math.sin(y * 0.05 + t * 0.3) * 0.05})`; c.fillRect(0, y, W, 2); }
    } else if (wx === "heat") {
      c.fillStyle = "rgba(255,230,180,0.06)"; c.fillRect(0, 0, W, H);
    }
  }

  // another file adds a set: register(name, fn(k), outdoor); fn gets the same k the sets above get (st, ctx, S, th, r, L, town, hour, wx,
  // lodge, festival; piece(), add(key, cv), spot(name, u, v, face), crowd([[u, v, face]]), outdoorBack(left, right, ground), and the
  // lists it may fill: lights, candles, lamps [u, v, drop], smoke, anims (fn(ctx, t, still)), fire [v0, v1], snores, npc { kind, name })
  function register(name, fn, outdoor) {
    SETS[name] = fn;
    if (outdoor) OUTDOOR.add(name);
    if (!root.TownSets.SETS.includes(name)) root.TownSets.SETS.push(name);
  }
  root.TownSets = { build, register, weather, SETS: Object.keys(SETS), STYLE, OUTDOOR, kit: { shade, mix, pix, glow, h01, frac, W, H, M, F, wallOf, groundOf, room, window_, crate, basket, barrel, lampPost, facades, sign } };
})(typeof window !== "undefined" ? window : globalThis);
