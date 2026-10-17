/* A song's scene: the bard on a low stage in the tavern where the song was first sung, dressed in that town's own look, by night, with the heroes it is about in the crowd. */
(function () {
  "use strict";
  const T = () => window.Tavern;
  const R = Math.round;
  const BARD = { id: "bard", name: "The Bard", look: { skin: "#e8b088", hair: "#7a4424", style: 1, face: 2, fav: "#c8463a", scars: [] }, weapon: "lute", weapon_tier: 2, armor_tier: 1 };
  const FULL = 122, OY = 40, WH = 90, NU = 20, NV = 20;

  const memo = new Map();
  const sh = (c, k) => { const key = c + k; let v = memo.get(key); if (!v) { v = T().shade(c, k); memo.set(key, v); } return v; };
  const mix = (a, b, t) => { const key = a + b + t; let v = memo.get(key); if (!v) { const p = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), q = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16)); v = "#" + p.map((x, i) => R(x + (q[i] - x) * t).toString(16).padStart(2, "0")).join(""); memo.set(key, v); } return v; };
  const h01 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  function pix(ctx, x, y, rows, pal) {
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x + i, y + j, 1, 1); } } });
  }

  // ---------- walls and floors: a = along the wall in tiles, h = px above the floor ----------
  function wains(o, a, h) {
    if (h > 12.5) return o.rail;
    const f = a * 2.4;
    return Math.abs(f - R(f)) < 0.07 ? sh(o.wains[1], -0.35) : o.wains[Math.floor(f) % 2];
  }
  const WALL = {
    boards: (o) => (a, h) => {
      if (o.post && a > 0.5 && Math.abs(a / o.post - R(a / o.post)) < 0.05) return o.postC;
      if (o.wains && h < 14) return wains(o, a, h);
      const bh = o.bh || 5, row = Math.floor((h - 14) / bh), off = row * 1.3, len = o.len || 2.6;
      if ((((h - 14) % bh) + bh) % bh < 1 || Math.abs((a + off) % len) < 0.04) return o.seam;
      const n = Math.sin(row * 7.1 + Math.floor((a + off) / len) * 3.3);
      return o.cols[n > 0.3 ? 0 : n > -0.4 ? 1 : 2];
    },
    stone: (o) => (a, h) => {
      if (o.wains && h < 14) return wains(o, a, h);
      const sz = o.sz || 6, row = Math.floor(h / sz), w = o.w || 1.1, k = a / w + (row % 2 ? 0.45 : 0), col = Math.floor(k), fy = h - row * sz, fx = k - col;
      if (fy < 1 || fx < 0.07) return o.mortar;
      const c = o.cols[Math.floor(h01(row, col) * o.cols.length)];
      return fy > sz - 1.2 ? sh(c, 0.14) : fx > 0.88 ? sh(c, -0.18) : fy < 2 ? sh(c, -0.08) : c;
    },
    logs: (o) => (a, h) => {
      const sz = o.sz || 6, row = Math.floor(h / sz), f = (h - row * sz) / sz;
      if (o.post && a > 0.5 && Math.abs(a / o.post - R(a / o.post)) < 0.06) return o.postC;
      if (f < 0.17) return o.cols[2];
      if (h01(row, Math.floor(a * 1.7)) > 0.93 && f > 0.35 && f < 0.7) return sh(o.cols[2], 0.1);
      return f > 0.78 ? sh(o.cols[0], 0.12) : f > 0.45 ? o.cols[0] : o.cols[1];
    },
    plaster: (o) => (a, h) => {
      if (o.wains && h < 14) return wains(o, a, h);
      const p = o.post || 1.8, k = a / p, fk = k - Math.floor(k);
      if (fk < 0.09 || Math.abs(h - 34) < 1.5) return (h + Math.floor(a * 8)) % 7 ? o.timber : sh(o.timber, 0.15);
      const d = (fk - 0.09) / 0.91;
      if (h > 34 && Math.abs((h - 34) / 28 - (Math.floor(k) % 2 ? d : 1 - d)) < 0.07) return o.timber;
      return h01(Math.floor(a * 16), h) > 0.9 ? o.cols[1] : o.cols[0];
    },
  };
  const FLOOR = {
    boards: (o) => (u, v) => {
      const w = o.w || 2, row = Math.floor(v * w), seam = Math.abs(v * w - R(v * w)) < 0.07 * (w / 2), end = Math.abs((u + row * 1.7) % 3) < 0.05;
      if (seam || end) return o.seam;
      if (o.nails && Math.abs(((u + row * 1.7) % 3) - 0.12) < 0.04 && Math.abs(v * w - row - 0.5) < 0.12) return o.nails;
      if (h01(Math.floor(u * 6), row) > 0.96) return sh(o.cols[0], -0.12);
      return o.cols[((row % o.cols.length) + o.cols.length) % o.cols.length];
    },
    flags: (o) => (u, v) => {
      const row = Math.floor(v * 1.2), k = u * 0.9 + (row % 2 ? 0.5 : 0), col = Math.floor(k);
      if (Math.abs(v * 1.2 - R(v * 1.2)) < 0.05 || k - col < 0.05) return o.seam;
      return o.cols[Math.floor(h01(row, col) * o.cols.length)];
    },
  };

  // ---------- each town's tavern ----------
  const LOOKS = {
    saltmarrow: { name: "The Drowned Gull", wall: WALL.boards({ cols: ["#7e766a", "#746c60", "#6a6458"], seam: "#3a3632", wains: ["#3e5a6e", "#365062"], rail: "#d8d0bc", post: 3.4, postC: "#4a3a2c", bh: 4, len: 3.2 }),
      floor: FLOOR.boards({ cols: ["#7a5e40", "#715638", "#76593c"], seam: "#4a3826", nails: "#3e3022" }), stone: ["#8e8e88", "#7c7e7a", "#9c988e"], mortar: "#4a4a46", mantel: "#5a4a3a",
      curtain: null, frame: "#e0dccc", rug: ["#2a6aa8", "#d8d0bc"], bunting: ["#d84a3a", "#f4f0e4", "#2a6aa8"], decor: saltDecor },
    frosthold: { name: "The Third Coat", wall: WALL.stone({ cols: ["#8a94a6", "#7e889a", "#96a0b0"], mortar: "#4a5060", wains: ["#5a3e28", "#4e3622"], rail: "#8a6a44", sz: 7, w: 1.3 }),
      floor: FLOOR.boards({ cols: ["#6e4c30", "#66462c", "#72502f"], seam: "#3a2616" }), stone: ["#9aa2b0", "#8a92a2", "#a6aebc"], mortar: "#4e5462", mantel: "#4e3622",
      curtain: ["#7a2a24", "#5a1e1a"], frame: "#4e3622", rug: ["#7a2a24", "#e8dcc0"], bunting: ["#4a7ab0", "#f0f6ff", "#8a5a34"], decor: frostDecor },
    ironhaven: { name: "The Gilded Flagon", wall: WALL.stone({ cols: ["#8a4a3a", "#7e4234", "#965240"], mortar: "#4a3430", wains: ["#4a2a1c", "#42261a"], rail: "#c8a040", sz: 3, w: 0.55 }),
      floor: FLOOR.boards({ cols: ["#6e3e22", "#663a20", "#743f22"], seam: "#3a2010" }), stone: ["#8a8076", "#7a7068", "#948a7e"], mortar: "#4e4640", mantel: "#7a5a2a",
      curtain: ["#b83a32", "#8a2a24"], frame: "#7a5a2a", rug: ["#b83a32", "#e8b84a"], bunting: ["#b83a32", "#e8b84a", "#ece8e0"], decor: ironDecor },
    thornwall: { name: "The Sagging Beam", wall: WALL.plaster({ cols: ["#d8c8a4", "#cbb994"], timber: "#4a2e1a", wains: ["#5e3a1e", "#54341c"], rail: "#8a5a30" }),
      floor: FLOOR.boards({ cols: ["#8e5c34", "#83542f", "#895830"], seam: "#5a3820" }), stone: ["#9a8a76", "#8a7a68", "#a4947e"], mortar: "#54483c", mantel: "#5e3a1e",
      curtain: ["#a8743a", "#7e5428"], frame: "#4a2e1a", rug: ["#a8743a", "#f4e4c0"], bunting: ["#a8743a", "#e0b04a", "#f4e4c0"], decor: thornDecor },
    veldrock: { name: "The Pickaxe & Pint", wall: WALL.stone({ cols: ["#6a6460", "#5e5854", "#726c66"], mortar: "#36302c", sz: 6, w: 1.0 }),
      floor: FLOOR.flags({ cols: ["#6a625a", "#625a52", "#70685e"], seam: "#3a342e" }), stone: ["#7a726a", "#6a625a", "#847a70"], mortar: "#3a342e", mantel: "#4a3020",
      curtain: ["#b8602a", "#8a4620"], frame: "#3a2a1e", rug: ["#b8602a", "#d8d6d0"], bunting: ["#b8602a", "#d8d6d0", "#5e646e"], decor: veldDecor },
    carrbridge: { name: "The Honest Toll", wall: WALL.boards({ cols: ["#4e6e8a", "#486680", "#52728e"], seam: "#2a3a4a", wains: ["#6e4a2c", "#644226"], rail: "#e0eef4", post: 3.4, postC: "#3a2a1c" }),
      floor: FLOOR.boards({ cols: ["#8a6a44", "#82623e", "#866642"], seam: "#4e3a24" }), stone: ["#8a8a90", "#7a7a80", "#94949a"], mortar: "#4a4a50", mantel: "#5e3a1e",
      curtain: ["#6a9a3a", "#4e7a2a"], frame: "#3a2a1c", rug: ["#3a7ab8", "#e0eef4"], bunting: ["#3a7ab8", "#6a9a3a", "#e0eef4"], decor: carrDecor },
    ashfen: { name: "The Damp Lantern", wall: WALL.boards({ cols: ["#545a46", "#4c5240", "#5a604a"], seam: "#262a20", wains: ["#3e4a3c", "#364234"], rail: "#7a8a64", post: 3.4, postC: "#2a2a1e", bh: 6 }),
      floor: FLOOR.boards({ cols: ["#5e5038", "#564a34", "#625438"], seam: "#2e281c" }), stone: ["#6e7466", "#5e6458", "#7a8070"], mortar: "#3a3e34", mantel: "#3e3424",
      curtain: ["#4a6a62", "#36504a"], frame: "#2e2a1e", rug: ["#4a6a62", "#d8dcc8"], bunting: ["#f0b44a", "#4a6a62", "#d8dcc8"], decor: ashDecor },
    hollowood: { name: "The Watching Oak", wall: WALL.logs({ cols: ["#7a5232", "#6a4628", "#3e2814"], post: 4.2, postC: "#4a3018" }),
      floor: FLOOR.boards({ cols: ["#9a6e44", "#926840", "#a07446"], seam: "#5e4228" }), stone: ["#7e7a6a", "#6e6a5c", "#8a8674"], mortar: "#44403a", mantel: "#4a3018",
      curtain: ["#3a6a34", "#2a5028"], frame: "#4a3018", rug: ["#3a6a34", "#d8b45a"], bunting: ["#3a6a34", "#d8b45a", "#e4ecd0"], decor: oakDecor },
  };
  const DEFAULT = { wall: WALL.boards({ cols: ["#7e5230", "#744a2a", "#6c4426"], seam: "#4a2e1c", wains: ["#6a4224", "#623c20"], rail: "#9a6436", post: 3.4, postC: "#4a2e18" }),
    floor: FLOOR.boards({ cols: ["#8e5c34", "#83542f", "#895830"], seam: "#5a3820" }), stone: null, mortar: null, mantel: "#5e3a1e", curtain: ["#7a3a24", "#5a2818"], frame: "#3a2414",
    rug: ["#8a2a24", "#d8c08a"], bunting: ["#c8463a", "#e8c060", "#3a5a8a"], decor: () => {} };

  // a flat sprite on a wall, anchored by its centre at (a, h)
  function onWall(ctx, st, side, a, h, rows, pal) {
    const [x, y] = (side === "l" ? st.lwall : st.rwall)(a, h);
    pix(ctx, R(x) - (rows[0].length >> 1), R(y) - (rows.length >> 1), rows, pal);
  }
  function saltDecor(ctx, st) {
    // a fishing net swagged along the left wall, cork floats caught in it
    for (let a = 1.6; a < 6.6; a += 0.04) for (let k = 0; k < 7; k++) {
      const sag = Math.sin(((a - 1.6) / 5) * Math.PI) * 6, h = 50 - k * 3 - sag * (k / 6), p = st.lwall(a, h);
      if ((Math.floor(a * 12) + k) % 2 === 0) { ctx.fillStyle = k === 0 ? "#8a7a5a" : "#c8b892"; ctx.fillRect(R(p[0]), R(p[1]), 1, 1); }
    }
    for (const [a, h, c] of [[2.4, 43, "#d84a3a"], [3.6, 40, "#e8d8b0"], [4.8, 41, "#d84a3a"], [5.8, 44, "#e8d8b0"]]) onWall(ctx, st, "l", a, h, ["oxx", "xxx", "xxd"], { o: sh(c, 0.4), x: c, d: sh(c, -0.4) });
    // a ship's wheel and a life ring
    onWall(ctx, st, "r", 7.6, 44, ["....w....", ".w..w..w.", "..wbbbw..", "..b...b..", "wwb.h.bww", "..b...b..", "..wbbbw..", ".w..w..w.", "....w...."], { w: "#9a6a3a", b: "#6a4424", h: "#c8a040" });
    onWall(ctx, st, "l", 11.6, 32, [".rrww.", "r....w", "w....r", "w....r", "r....w", ".wwrr."], { r: "#d84a3a", w: "#f4f0e4" });
    // the gull on the sign over the stage
    onWall(ctx, st, "r", 2.6, 44, ["bbbbbbbbbb", "b........b", "b.ww..ww.b", "b..wwww..b", "b...wy...b", "bbbbbbbbbb"], { b: "#4a3a2c", ".": "#2a4a5e", w: "#f4f0e4", y: "#e8b84a" });
  }
  function frostDecor(ctx, st) {
    onWall(ctx, st, "l", 3.0, 44, ["..ffff..", ".ffffff.", "ffgffgff", "ffffffff", ".ffffff.", ".ff..ff.", "ff....ff"], { f: "#c8b8a0", g: "#8a7a64" });
    onWall(ctx, st, "l", 5.0, 42, ["..ffff..", ".ffffff.", "ffffffff", "ffffffff", ".ffffff.", ".ff..ff.", "ff....ff"], { f: "#6a5038" });
    onWall(ctx, st, "r", 7.6, 44, ["a.a...a.a", ".aa...aa.", "..a...a..", "...aaa...", "...www..."], { a: "#e8dcc4", w: "#5a3e28" });
  }
  function ironDecor(ctx, st) {
    onWall(ctx, st, "l", 3.6, 42, ["gggggggggg", "grrrrrrrrg", "grrryyrrrg", "grryyyyrrg", "grrryyrrrg", "grrrrrrrrg", "gggggggggg"], { g: "#c8a040", r: "#8a2a24", y: "#e8b84a" });
    onWall(ctx, st, "r", 7.6, 44, ["yyyyy", "rrrrr", "rrrrr", "ryyyr", "rrrrr", "r.r.r"], { y: "#e8b84a", r: "#b83a32" });
  }
  function thornDecor(ctx, st) {
    onWall(ctx, st, "l", 3.4, 44, ["..y.y..", ".yyyyy.", "..yyy..", "..yyy..", "..bbb..", "..yyy..", ".y.y.y."], { y: "#e0b04a", b: "#8a5a30" });
    onWall(ctx, st, "r", 7.6, 44, ["...www...", ".w..w..w.", "w...w...w", "wwwwhwwww", "w...w...w", ".w..w..w.", "...www..."], { w: "#7a5232", h: "#3a2a1a" });
  }
  function veldDecor(ctx, st) {
    onWall(ctx, st, "l", 3.4, 44, ["mm.....mm", ".mm...mm.", "..hh.hh..", "...hhh...", "..hh.hh..", ".hh...hh.", "hh.....hh"], { m: "#a8a8b0", h: "#7a5232" });
    onWall(ctx, st, "r", 7.6, 42, [".b.", "bbb", "byb", "bbb"], { b: "#3a3a40", y: "#f8c060" });
  }
  function carrDecor(ctx, st) {
    onWall(ctx, st, "l", 3.4, 44, ["bbbbbbbbbb", "bppppppppb", "bpccpccppb", "bppppppppb", "bpccpccpcb", "bbbbbbbbbb"], { b: "#3a2a1c", p: "#e0d8c0", c: "#c8a040" });
    onWall(ctx, st, "r", 7.6, 44, ["sssssssss", "s.......s", "ssss.ssss", "...s.s...", "~~~~~~~~~"], { s: "#8a8a90", "~": "#3a7ab8" });
  }
  function ashDecor(ctx, st) {
    onWall(ctx, st, "l", 3.4, 44, ["r.r.r.r", "r.r.r.r", "rrrrrrr", ".rrrrr.", "..bbb..", "..rrr..", "..r.r.."], { r: "#a89a5a", b: "#5a3a20" });
    onWall(ctx, st, "r", 7.6, 42, [".b.", "bgb", "ggg", "gyg", "bbb"], { b: "#2a2a1e", g: "#5a8a6a", y: "#f0b44a" });
  }
  function oakDecor(ctx, st) {
    for (let a = 1.4; a < 7; a += 0.3) { const p = st.lwall(a, 56 - Math.sin(a * 1.3) * 3); ctx.fillStyle = (a * 10) % 3 < 1.5 ? "#4a7a3a" : "#3a6a34"; ctx.fillRect(R(p[0]), R(p[1]), 2, 2); if ((a * 10) % 4 < 1) { ctx.fillStyle = "#d8b45a"; ctx.fillRect(R(p[0]), R(p[1]) + 2, 1, 1); } }
    onWall(ctx, st, "r", 7.6, 44, ["..gg..", ".gggg.", "gggggg", ".gggg.", "..bb..", "..bb.."], { g: "#3a6a34", b: "#5a3a20" });
  }

  // ---------- the room, painted once ----------
  const FIRE = { v0: 7.6, v1: 9.8 };
  function room(st, r, look, town, weather) {
    const { iso, lwall, rwall, quad } = st, S = T();
    const cv = st.canvas(), ctx = cv.getContext("2d");
    // rafters overhead where the walls run out of frame
    ctx.fillStyle = "#1c120c"; ctx.fillRect(0, 0, st.W, st.H);
    for (let y = 0; y < st.H; y++) for (let x = 0; x < st.W; x++) {
      const k = y - Math.abs(x - st.OX) / 2, b = ((Math.floor(k / 6) % 2) + 2) % 2, e = ((k % 6) + 6) % 6 < 1;
      ctx.fillStyle = e ? "#140c08" : b ? "#2c1c12" : "#24170e"; ctx.fillRect(x, y, 1, 1);
    }
    const side = (s) => (x, y) => { const [a, h] = s === "l" ? st.onL(x, y) : st.onR(x, y), c = look.wall(a, h); return s === "r" ? sh(c, 0.06) : sh(c, -0.12); };
    S.fillPoly(ctx, [lwall(0, WH), lwall(NV, WH), iso(0, NV), iso(0, 0)], side("l"));
    S.fillPoly(ctx, [rwall(0, WH), rwall(NU, WH), iso(NU, 0), iso(0, 0)], side("r"));
    S.fillPoly(ctx, [lwall(0, WH), lwall(NV, WH), lwall(NV, WH - 4), lwall(0, WH - 4)], "#3a2414");
    S.fillPoly(ctx, [rwall(0, WH), rwall(NU, WH), rwall(NU, WH - 4), rwall(0, WH - 4)], "#45291a");
    S.fillPoly(ctx, [lwall(0, 2), lwall(NV, 2), iso(0, NV), iso(0, 0)], "rgba(0,0,0,0.25)");
    S.fillPoly(ctx, [rwall(0, 2), rwall(NU, 2), iso(NU, 0), iso(0, 0)], "rgba(0,0,0,0.2)");
    S.line(ctx, iso(0, 0), lwall(0, WH), "#2a180e");
    S.fillPoly(ctx, [iso(0, 0), iso(NU, 0), iso(NU, NV), iso(0, NV)], (x, y) => { const [u, v] = st.toUV(x, y); return look.floor(u, v); });
    look.decor(ctx, st, r);
    // the window looks out on the town, in the weather of the night it was sung
    const views = [S.windowR(ctx, st, r, 4.6, 6.4, 20, 40, true, { frame: look.frame, curtain: look.curtain, town, weather })].filter(Boolean);
    S.moonbeam(ctx, st, 4.6, 6.4, 2.4, NU);
    // shelves of bottles behind the bar
    for (const hh of [24, 35]) {
      S.slab(ctx, st, 9.4, 0, 6.6, 0.3, 2, "#5a361c", hh - 1);
      for (let u = 9.6; u < 15.8; u += 0.42) {
        const p = rwall(u, hh + 1.5), x = R(p[0]), y = R(p[1]);
        const col = ["#4e7a34", "#8a3a2a", "#c8a040", "#2e5a7a", "#d8d0c0", "#5a3a20"][Math.floor(r() * 6)], tall = 4 + Math.floor(r() * 3);
        ctx.fillStyle = sh(col, -0.3); ctx.fillRect(x, y - tall, 2, tall); ctx.fillStyle = col; ctx.fillRect(x, y - tall, 1, tall); ctx.fillRect(x, y - tall - 2, 1, 2);
        ctx.fillStyle = "rgba(255,248,220,0.45)"; ctx.fillRect(x, y - tall + 1, 1, 1);
      }
    }
    S.hearth(ctx, st, r, FIRE.v0, FIRE.v1, WH, look.stone ? { stone: look.stone, mortar: look.mortar, mantel: look.mantel } : { mantel: look.mantel });
    // bunting in the town's colours, swagged over the stage from wall to wall
    const flags = (pts) => {
      for (let i = 0; i < pts.length - 1; i++) S.line(ctx, pts[i], pts[i + 1], "#2a1a10");
      pts.forEach(([x, y], i) => { if (i % 2) return; const c = look.bunting[(i >> 1) % look.bunting.length]; pix(ctx, R(x) - 2, R(y) + 1, ["xxxxx", ".xxx.", "..x.."], { x: c }); ctx.fillStyle = sh(c, 0.3); ctx.fillRect(R(x) - 2, R(y) + 1, 5, 1); });
    };
    const swag = (f, a0, a1, h0, h1) => Array.from({ length: 17 }, (_, i) => { const s = i / 16, p = f(a0 + (a1 - a0) * s, h0 + (h1 - h0) * s - Math.sin(s * Math.PI) * 5); return [p[0], p[1]]; });
    flags(swag(lwall, 5.4, 0.02, 42, 34));
    flags(swag(rwall, 0.02, 5.4, 34, 42));
    return { cv, views };
  }

  // ---------- figures: idle life on a hero's sprite ----------
  // eyes shut for a blink, cheeks pink for a blush; the sprite's eyes sit at (12,10) and (15,10) facing either way
  function variant(src, blink, blush, skinHex) {
    const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
    const g = c.getContext("2d"); g.drawImage(src, 0, 0);
    if (src.width !== 28) return c;
    const d = g.getImageData(0, 0, 28, src.height), at = (x, y) => (y * 28 + x) * 4, px = (x, y) => [d.data[at(x, y)], d.data[at(x, y) + 1], d.data[at(x, y) + 2], d.data[at(x, y) + 3]];
    const set = (x, y, p) => { for (let i = 0; i < 4; i++) d.data[at(x, y) + i] = p[i]; };
    const same = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < 30;
    // the face's own skin, found near the eyes (a helm's nasal or a beard can sit right beside them)
    const want = /^#[0-9a-f]{6}$/i.test(skinHex || "") ? [1, 3, 5].map((i) => parseInt(skinHex.slice(i, i + 2), 16)) : null;
    let skin = [0, 0, 0, 0], best = 1e9;
    if (want) for (let y = 9; y <= 12; y++) for (let x = 10; x <= 17; x++) { const p = px(x, y), dd = Math.abs(p[0] - want[0]) + Math.abs(p[1] - want[1]) + Math.abs(p[2] - want[2]); if (p[3] > 0 && dd < best) { best = dd; skin = p; } }
    if (best > 90) skin = [0, 0, 0, 0];
    const eye = px(12, 10);
    if (blink && eye[3] > 0 && skin[3] > 0 && !same(eye, skin)) {
      const lid = skin.map((v, i) => (i < 3 ? R(v * 0.78) : 255));
      for (const x of [12, 15]) if (!same(px(x, 10), skin)) set(x, 10, lid);
    }
    if (blush && skin[3] > 0) for (const x of [11, 16]) { const p = px(x, 11); if (p[3] > 0 && same(p, skin)) set(x, 11, [R(p[0] * 0.6 + 232 * 0.4), R(p[1] * 0.6 + 96 * 0.4), R(p[2] * 0.6 + 96 * 0.4), 255]); }
    g.putImageData(d, 0, 0);
    return c;
  }
  function figure(a, x, y, o) {
    const f = Object.assign({ a, x, y, face: a.face || 1, ph: (Art.hash(a.name + x) % 1000) / 1000 }, o || {}), skin = ((a.h || {}).look || {}).skin;
    f.img = { 1: a.right, "-1": a.left };
    f.shut = { 1: variant(a.right, true, f.blush, skin), "-1": variant(a.left, true, f.blush, skin) };
    if (f.blush) f.img = { 1: variant(a.right, false, true, skin), "-1": variant(a.left, false, true, skin) };
    return f;
  }
  // p: { face, dip (upper body down, px), lift (whole figure up), dx (upper body sway), shut, alpha }
  function drawFig(ctx, f, p) {
    const img = (p.shut ? f.shut : f.img)[p.face > 0 ? 1 : "-1"], w = img.width, hh = img.height, split = Math.min(hh - 10, 22);
    const x = R(f.x) - (w >> 1), y = R(f.y) - hh + 1 - (p.lift || 0);
    if (!p.alpha) { ctx.fillStyle = "rgba(20,10,4,0.35)"; ctx.fillRect(R(f.x) - 6, R(f.y) - 1, 12, 2); ctx.fillRect(R(f.x) - 4, R(f.y) - 2, 8, 4); }
    if (p.alpha) ctx.globalAlpha = p.alpha;
    ctx.drawImage(img, 0, split, w, hh - split, x, y + split, w, hh - split);
    ctx.drawImage(img, 0, 0, w, split, x + (p.dx || 0), y + (p.dip || 0), w, split);
    ctx.globalAlpha = 1;
  }
  const frac = (v) => ((v % 1) + 1) % 1;
  // a breath every few seconds and a blink now and then, out of step with everyone else
  const breath = (f, t, per) => (frac(t / (per || 3.4) + f.ph) < 0.42 ? 1 : 0);
  const blinking = (f, t) => frac(t / (3.1 + f.ph * 2.2) + f.ph * 7) < 0.045;

  // how the hero a song is about takes hearing it: by the song's mood and their own nature
  function reaction(h, mood) {
    const v = h.vox || {}, bold = v.bold || 0, style = v.style || "";
    if (mood === "sad") return "solemn";
    if (mood === "shame") return (style === "cruel" || style === "pompous") && bold > 0.2 ? "proud" : "shy";
    if (["anxious", "curt", "earnest"].includes(style) && bold < 0.3) return "shy";
    return bold < -0.2 ? "shy" : "proud";
  }

  const NOTE = [["..x..", "..xx.", "..x.x", "..x..", ".xx..", "xxx..", ".x..."], [".xxxxx", ".x...x", ".x...x", ".x...x", "xx..xx", "xx..xx"]];
  const STAR = ["..x..", ".xyx.", "xyyyx", ".xyx.", "..x.."];
  const DROP = [".x.", "xyx", "xyx", ".x."];
  const glyph = (rows, pal) => (window.Anim ? Anim.sprite(rows, pal) : (() => { const c = document.createElement("canvas"); c.width = rows[0].length; c.height = rows.length; pix(c.getContext("2d"), 0, 0, rows, pal); return c; })());

  // the song's own event, for the night's weather
  function eventOf(song) {
    const L = App.L || {};
    return (L.events || []).find((e) => e.kind === "song" && e.day === song.day && (e.heroes || []).join() === (song.heroes || []).join());
  }

  // build(song, W): the whole room at W x FULL, and draw(ctx, t, still) for everything that moves
  function build(song, W, opts) {
    const S = App.S, H = App.heroes, Tv = T(), o = opts || {};
    const town = (song.towns || [])[0], look = LOOKS[town] || DEFAULT;
    const OX = R(W / 2), st = Tv.stage(W, FULL, OX, OY), r = Art.rng(Art.hash(song.id + "ballad"));
    const ev = o.event || eventOf(song), weather = (ev && ev.wx) || Tv.weatherAt(town);
    const { cv: bg, views } = room(st, r, look, town, weather);
    const uv = (x, y) => [((x - OX) / 8 + (y - OY) / 4) / 2, ((y - OY) / 4 - (x - OX) / 8) / 2];
    const piece = (paint) => { const c = st.canvas(); paint(c.getContext("2d")); return c; };
    const things = [], candles = [];
    // the stage: a low plank dais in the back corner with a rug and a row of footlight candles
    things.push({ key: 2.0, cv: piece((c) => {
      Tv.slab(c, st, 0.2, 0.2, 3.6, 3.6, 4, { base: "#5e3a1e", top: (x, y) => { const [u, v] = st.toUV(x, y + 4); return Math.abs(v * 2 - R(v * 2)) < 0.08 ? "#4a2c16" : "#8a5a32"; }, left: "#4e301a", right: "#3a2414" });
      const [r0, r1] = look.rug;
      Tv.slab(c, st, 0.8, 0.8, 2.4, 2.4, 0.5, { base: r0, top: (x, y) => { const [u, v] = st.toUV(x, y + 4.5); return u < 0.95 || v < 0.95 || u > 3.05 || v > 3.05 ? r1 : (Math.floor(u * 3) + Math.floor(v * 3)) % 2 ? r0 : sh(r0, -0.15); } }, 4, false);
    }) });
    for (const [u, v] of [[3.9, 1.0], [3.9, 2.6], [1.0, 3.9], [2.6, 3.9]]) candles.push(st.up(st.iso(u, v), 4));
    // the bar along the right wall
    for (let u = 9.6; u < 16; u += 1) things.push({ key: u + 2.4, cv: piece((c) => {
      Tv.slab(c, st, u, 1.2, 1, 0.9, 12, { base: "#5e3a1e", right: "#3e2414" }, 0, false);
      Tv.slab(c, st, u, 1.1, 1, 1.1, 2, { base: "#8a5630", top: (x, y) => ((x + 2 * y) % 11 ? "#b07642" : "#a06a3a"), left: "#6a4024", right: "#5a3620" }, 12, false);
      Tv.line(c, st.up(st.iso(u, 2.2), 14), st.up(st.iso(u + 1, 2.2), 14), "#d49a5a");
      if (r() < 0.6) { const [x, y] = st.up(st.iso(u + 0.3 + r() * 0.4, 1.6), 14); Tv.mugAt(c, R(x), R(y)); }
    }) });
    // tables down front, each with a candle and a mug
    const TABLES = [[uv(OX - 74, OY + 62), "#8e5c34"], [uv(OX + 54, OY + 66), "#7e5230"]];
    for (const [[u, v], wood] of TABLES) {
      things.push({ key: u + v + 1, cv: piece((c) => { Tv.table(c, st, u, v, 1.1, 1.1, 9, wood); const [x, y] = st.up(st.iso(u + 0.3, v + 0.7), 9); Tv.mugAt(c, R(x), R(y)); }) });
      candles.push(st.up(st.iso(u + 0.6, v + 0.45), 9));
      for (const [su, sv] of [[u + 0.35, v + 1.35], [u + 1.35, v + 0.35]]) things.push({ key: su + sv + 0.35, cv: piece((c) => Tv.stool(c, st, su, sv, "#7a4a28")) });
    }
    things.push({ key: 1.4 + 0.8, cv: piece((c) => { const [x, y] = st.iso(16.6, 0.6); Tv.barrel(c, R(x), R(y)); }) });

    // the cast: the bard, the heroes the song is about, a ghost for a dirge, locals and the keeper
    const bardCls = S.classes.bard || { look: { outfit: "fancy", head: "feather_cap", offhand: "lute" } };
    const figs = [];
    // depth is u + v, which is (y - OY) / 4 for anyone standing on the floor
    const add = (a, x, y, extra) => { const f = figure(a, x, y, extra); f.key = (y - OY) / 4; figs.push(f); return f; };
    // a crew's tavern set (music_replay.js) puts its own players on the stage in the bard's place
    const bard = o.cast ? null : add(Tv.actor(BARD, 0, 0, { look: bardCls }), OX, OY + 12, { role: "bard", face: 1, ph: 0.1 });
    if (bard) bard.key = 4;
    for (const c of o.cast || []) { const f = add(c.a, c.x, c.y, { role: c.role || "band", face: c.face || 1, ph: c.ph || 0 }); f.key = c.key; f.id = c.id; f.extra = c.extra; c.f = f; }
    const about = o.cast ? [] : (song.heroes || []).map((id) => H[id]).filter((h) => h && h.alive !== false).slice(0, 3);
    const SPOTS = [[OX - 26, OY + 42], [OX + 28, OY + 44], [OX - 52, OY + 50]];
    about.forEach((h, i) => {
      const a = Tv.actor(h, 0, 0, {});
      const how = reaction(h, song.mood), [x, y] = SPOTS[i];
      const f = add(a, x, y, { role: "hero", how, blush: how === "shy", face: x < OX ? 1 : -1, ph: 0.3 + i * 0.27 });
      f.toBard = f.face;
      if (a.pet) { const [pu, pv] = uv(x + (f.face > 0 ? -12 : 12), y + 5); const p = Object.assign(a.pet, { u: pu, v: pv, face: f.face }); figs.push({ pet: p, key: pu + pv }); }
    });
    const ghost = !o.cast && song.dirge && H[song.dirge] ? add(Tv.actor(H[song.dirge], 0, 0, {}), OX + 30, OY + 22, { role: "ghost", face: -1, ph: 0.6 }) : null;
    if (ghost) ghost.key = 4.5;
    const LOCALS = [[OX - 82, OY + 44, 1], [OX + 62, OY + 52, -1], [OX - 104, OY + 62, 1], [OX + 84, OY + 76, -1]].filter(([x]) => x > 8 && x < W - 8);
    for (const [x, y, face] of LOCALS.slice(0, o.cast ? 4 : Math.max(3, 5 - about.length))) {
      const a = Tv.local(r, 0, 0);
      add(a, x, y, { role: "local", face, ph: r() });
    }
    // behind the bar, at u 13, v 0.6
    add(Tv.keeper(look.keeper || "The keeper", 0, 0), OX + 99, OY + 54, { role: "keeper", face: -1, ph: 0.8 });

    const inside = Tv.inRoom(st, NU, NV, WH), shine = Tv.lighting(W, FULL, (x, y) => !views.some((v) => v.glass(x, y)) && (inside(x, y) || y < OY));
    const fireAt = st.lwall((FIRE.v0 + FIRE.v1) / 2, 8);

    const notes = [0, 1].map((k) => glyph(NOTE[k], { x: k ? "#ffe8a0" : "#fff4dc" }));
    const star = glyph(STAR, { x: "#e8b84a", y: "#fff4c0" }), drop = glyph(DROP, { x: "#9ac8f0", y: "#e8f6ff" });
    let strum = -9;

    function pose(f, t, playing) {
      const bps = playing ? 2.2 : 1.5, beat = t * bps, onBeat = frac(beat) < 0.3;
      const p = { face: f.face, dip: breath(f, t), shut: blinking(f, t) };
      if (f.role === "bard") {
        p.dx = Math.sin((beat * Math.PI) / 2) > 0 ? 1 : 0;
        p.dip = onBeat || performance.now() - strum < 140 ? 1 : 0;
        p.lift = playing && frac(beat / 8) < 0.06 ? 1 : 0;
        p.face = frac(t / 14) < 0.7 ? 1 : -1;
      } else if (f.role === "hero") {
        if (f.how === "proud") {
          // chest out and nodding along, glancing round to see who's listening, up on their toes now and then
          p.dip = onBeat && frac(beat / 2) < 0.5 ? 1 : 0;
          p.face = frac(t / 7 + f.ph) < 0.3 ? -f.toBard : f.toBard;
          p.lift = frac(t / 5.3 + f.ph) < 0.05 ? 1 : 0;
        } else if (f.how === "shy") {
          // turned half away and hunched, a look back at the stage now and then
          p.dip = 1 + breath(f, t, 2.6);
          p.face = frac(t / 6 + f.ph) < 0.22 ? f.toBard : -f.toBard;
        } else {
          p.dip = 1; p.shut = p.shut || frac(t / 7 + f.ph) < 0.3;
        }
      } else if (f.role === "ghost") {
        p.lift = R(3 + Math.sin(t * 1.6) * 2); p.alpha = 0.45 + Math.sin(t * 0.9) * 0.08; p.dip = 0;
      } else if (f.role === "local") {
        const nod = frac(beat + f.ph) < 0.3 && frac(t / 9 + f.ph) < 0.6;
        p.dip = nod ? 1 : p.dip;
        p.face = frac(t / 11 + f.ph) < 0.12 ? -f.face : f.face;
      }
      if (o.pose) o.pose(f, t, p, playing);
      return p;
    }
    function draw(ctx, t, still, playing) {
      for (const v of views) v.draw(ctx, t, still);
      const flick = 0.75 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.08;
      Tv.flames(ctx, st, t, FIRE.v0, FIRE.v1, flick, 1, true);
      const list = things.map((th) => ({ key: th.key, draw: () => ctx.drawImage(th.cv, 0, 0) }));
      for (const f of figs) list.push({ key: f.key, draw: () => { if (f.pet) { Tv.drawPet(ctx, st, f.pet, frac(t / 1.6 + 0.3) < 0.5 ? 0 : 1, t); return; } const p = pose(f, t, playing); drawFig(ctx, f, p); if (f.extra) f.extra(ctx, t, p, f); } });
      for (const th of o.things || []) list.push({ key: th.key, draw: () => th.draw(ctx, t) });
      list.sort((p, q) => p.key - q.key).forEach((d) => d.draw());
      const bardFace = bard ? pose(bard, t, playing).face : 1;
      for (const [x, y] of candles) Tv.candle(ctx, R(x), R(y), t, flick, 3);
      const lights = [{ x: fireAt[0] + 14, y: fireAt[1] + 4, r: 84, k: 0.62 + flick * 0.35 }, { x: OX, y: OY + 4, r: 56, k: 0.55 + flick * 0.08 }];
      for (const [x, y] of candles) lights.push({ x, y: y - 5, r: 24, k: 0.45 + flick * 0.12 });
      for (const [lu, lv, drop] of [[6.2, 6.2, 70], [11.5, 6.5, 66]]) { Tv.lantern(ctx, st, lu, lv, flick, drop, true); const [x, y] = st.iso(lu, lv); lights.push({ x, y: y - drop + 10, r: 60, k: 0.5 + flick * 0.1 }); }
      { const [x, y] = st.rwall(5.5, 28); lights.push({ x, y: y + 10, r: 30, k: 0.5, cool: true }); }
      shine(ctx, t, lights, 0.42);
      if (o.over) o.over(ctx, t);
      // the tune rising off the lute, a little faster while the song is on
      const per = playing ? 0.42 : 0.95, life = 2.6;
      for (let k = Math.floor((t - life) / per); bard && k <= Math.floor(t / per); k++) {
        const age = t - k * per - h01(k, 3) * per * 0.5;
        if (age < 0 || age > life) continue;
        const g = notes[Math.floor(h01(k, 1) * 2)], s = age / life, side = h01(k, 2) < 0.5 ? -1 : 1;
        ctx.globalAlpha = s < 0.1 ? s / 0.1 : s > 0.65 ? (1 - s) / 0.35 : 1;
        const out = -bardFace * (side > 0 ? 1 : 0.55);
        ctx.drawImage(g, R(bard.x - bardFace * 10 + out * (2 + age * 9) + Math.sin(age * 3 + k) * 2.5) - 3, R(bard.y - 20 - age * 13));
        ctx.globalAlpha = 1;
      }
      // the hero's side of it: a glint of pride, or a bead of sweat
      for (const f of figs) {
        if (f.role !== "hero") continue;
        const top = f.y - 36;
        if (f.how === "proud") { const s = frac(t / 3.7 + f.ph); if (s < 0.22) { ctx.globalAlpha = s < 0.06 ? s / 0.06 : 1 - (s - 0.06) / 0.16; ctx.drawImage(star, R(f.x + 9 * f.toBard) - 3, R(top - 2 - s * 10)); ctx.globalAlpha = 1; } }
        if (f.how === "shy") { const s = frac(t / 4.2 + f.ph); if (s < 0.25) ctx.drawImage(drop, R(f.x - 8 * f.toBard) - 2, R(top + 6 + s * 16)); }
      }
    }
    return { bg, draw, strum: () => { strum = performance.now(); }, figs, st, OX, OY, look, W };
  }

  // the Songbook's stage: a live canvas W x H; .ballad.playing(on) speeds the bard up, .ballad.strum() on each sung syllable
  function scene(song, o) {
    const opt = o || {}, W = opt.W || 256, H = opt.H || FULL, y0 = opt.y0 != null ? opt.y0 : H < FULL ? Math.min(FULL - H, 12) : 0;
    const b = build(song, W, opt);
    const base = document.createElement("canvas"); base.width = W; base.height = H;
    base.getContext("2d").drawImage(b.bg, 0, -y0);
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    let playing = false;
    const still = () => (window.Settings ? Settings.calm() : !!(window.Anim && Anim.reduced));
    const actor = { z: 0, draw(ctx, t) { ctx.save(); ctx.translate(0, -y0); b.draw(ctx, t, still(), playing); ctx.restore(); } };
    if (window.Anim) Anim.stage(cv, base, [actor], { fps: opt.fps || 20 });
    else { const c = cv.getContext("2d"); c.drawImage(base, 0, 0); actor.draw(c, 2); }
    // the room's murmur while the scene is on screen
    if (opt.sound !== false && "IntersectionObserver" in window && window.Sound && Sound.scene) {
      const io = new IntersectionObserver((es) => {
        const on = es[es.length - 1].isIntersecting && cv.isConnected;
        Sound.scene(on ? "tavern" : null, cv);
        if (!cv.isConnected) io.disconnect();
      });
      io.observe(cv);
    }
    cv.ballad = { playing(on) { playing = !!on; }, strum: b.strum };
    return cv;
  }
  // a song event as the day's lead picture
  function vignette(e, W, H) {
    const L = App.L || {};
    const song = (L.songs || []).find((s) => s.day === e.day && (s.heroes || []).join() === (e.heroes || []).join() && s.towns[0] === e.loc)
      || { id: e.id, heroes: e.heroes || [], towns: [e.loc], mood: "glory", day: e.day };
    return scene(song, { W, H, event: e, fps: 12, sound: false });
  }

  window.Ballad = { scene, vignette, reaction, LOOKS, build, FULL };
})();
