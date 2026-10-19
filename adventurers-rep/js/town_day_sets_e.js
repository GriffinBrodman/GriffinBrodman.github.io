/* Town day sets, rebuilt (registered with TownSets.register, replacing the first pass of the same name): the trainer's yard, the docks, the stables, the guild hall, the temple. */
(function (root) {
  "use strict";
  const R = Math.round;
  const Tv = () => root.Tavern;
  const K = () => root.TownSets.kit;

  function ellipse(g, cx, cy, rx, ry, col) {
    for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const c = typeof col === "function" ? col(dx, dy, x, y) : col;
      if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
    }
  }
  // a long piece cut into short lengths along u, each depth-sorted on its own, so a figure at one end isn't hidden by the far end
  function along(k, u, v, du, dv, step, paint) {
    const n = Math.max(1, Math.ceil(du / step)), s = du / n;
    for (let i = 0; i < n; i++) {
      const c = k.piece(), su = u + i * s;
      paint(c.getContext("2d"), su, s, i === 0, i === n - 1);
      k.add(su + s + v + dv, c);
    }
  }
  const rgba = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const dot = (g, x, y, c) => { g.fillStyle = c; g.fillRect(R(x), R(y), 1, 1); };
  // a piece repainted every frame (a boat that bobs, a horse that nods), still depth-sorted with the cast
  function live(k, key, paint) {
    const c = k.piece(), g = c.getContext("2d");
    k.add(key, c);
    k.anims.push((ctx, t, still) => { g.clearRect(0, 0, c.width, c.height); paint(g, t, still); });
  }
  function floorShadow(k, u, v, du, dv, a) {
    Tv().fillPoly(k.ctx, [k.st.iso(u, v), k.st.iso(u + du, v), k.st.iso(u + du, v + dv), k.st.iso(u, v + dv)], (x, y) => ((x + y) % 2 ? `rgba(30,18,10,${a})` : `rgba(30,18,10,${a * 0.55})`));
  }
  // a roof leaning back from the eaves along one back edge, in the town's tiles, thatch or moss, snow in Frosthold
  function roofOn(k, side, a0, a1, hh, roofH) {
    const { st, ctx, S } = k, P = Tv(), { shade, mix, h01, frac } = K(), wall = side === "l" ? st.lwall : st.rwall, on = side === "l" ? st.onL : st.onR, rc = S.roof;
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
  }
  // a torch in an iron bracket on a wall: lit from dusk, its flame alive and its light on the ground
  function torch(k, side, a, h) {
    const { st, ctx, L } = k, { pix } = K(), [x, y] = (side === "l" ? st.lwall : st.rwall)(a, h).map(R);
    pix(ctx, x - 2, y - 2, ["kkk..", "..k..", ".kbk.", ".kbk.", "..b..", "..b..", "..b..", "..k.."], { k: "#2a2420", b: "#6a4a2a" });
    if (!L.lamps) return;
    k.lights.push({ x, y: y - 4, r: 38, k: 0.55 });
    k.anims.push((c, t) => {
      const f = Math.floor(t * 9 + a * 3) % 3;
      pix(c, x - 1, y - 7 - (f === 2 ? 1 : 0), [f ? ".y." : "..y", ".yo", "yoo", "ooo"], { y: "#fff4c0", o: f === 1 ? "#ffb040" : "#f08a2a" });
      K().glow(c, x, y - 5, 9, "#ffb050", 0.35);
    });
  }
  // daylight falling through the air from an opening to its patch on the floor, and the dust turning in it
  function shaft(k, top, foot, tint, n, alpha) {
    const { st, L } = k, P = Tv(), { frac, h01 } = K(), c = st.canvas(), g = c.getContext("2d"), al = alpha || 0.1;
    if (L.night) return;
    P.fillPoly(g, [top[0], top[1], foot[0], foot[1]], (x, y) => ((x + y) % 3 === 0 ? rgba(tint, al * 1.4) : rgba(tint, al * 0.6)));
    k.anims.push((cc, t, still) => {
      cc.drawImage(c, 0, 0);
      for (let i = 0; i < n; i++) {
        const ph = frac((still ? 0.3 : t * 0.025) + h01(i, 4)), s = h01(i, 5), A = [top[0][0] + (top[1][0] - top[0][0]) * s, top[0][1] + (top[1][1] - top[0][1]) * s], B = [foot[1][0] + (foot[0][0] - foot[1][0]) * s, foot[1][1] + (foot[0][1] - foot[1][1]) * s];
        cc.fillStyle = i % 3 ? "rgba(255,250,230,0.65)" : "rgba(255,238,190,0.9)";
        cc.fillRect(R(A[0] + (B[0] - A[0]) * ph + Math.sin(t * 0.7 + i) * 1.5), R(A[1] + (B[1] - A[1]) * ph), 1, 1);
      }
    });
  }

  // ======================================================================================================================
  // the trainer's yard: packed earth scuffed by footwork, a limed sparring ring, straw dummies, the weapon rack, the barn and the hall
  // ======================================================================================================================
  const DUMMY = [
    ".......bbbb........",
    "......bbbbbB.......",
    ".....bbxbbxbB......",
    ".....bbbbbbbB......",
    ".....bbbxxbbB......",
    "......bbbbbB.......",
    ".......rrrr........",
    "ss......pP......ss.",
    "sSsrrpppppppppprsSs",
    "SsSrrPPPPPPPPPPrSsS",
    "ss...bbbbbbbbB...ss",
    ".....bbbbbbbbB.....",
    ".....bbbtttbbB.....",
    ".....bbtwwwtbB.....",
    ".....bbtwtwtbB.....",
    ".....bbtwwwtbB.....",
    ".....bbbtttbbB.....",
    ".....rrrrrrrrr.....",
    ".....bbbbbbbbB.....",
    "......bbbbbbB......",
    "......sSsSsSs......",
    "......s.pP..s......",
  ];
  const BATTERED = [
    "........bbbb.......",
    ".......bbobbB......",
    "......bbxbbxbB.....",
    ".....sbbbbbbbB.....",
    "......bbxxxbbBs....",
    ".......bbbbbB......",
    ".......rrrr........",
    "........pP......ss.",
    "....rrpppppppppsSs.",
    "...SrPPPPPPPPPPrSsS",
    "..s..bbbbbkbbB...ss",
    "...s.bbobbbkbB.s...",
    ".....bbbtttbkBs....",
    "....sbbtw.wtbB.....",
    ".....kbtwtwtbBs....",
    "......kbwwwtbB.....",
    ".....bbktttbbB.....",
    ".....rrrrrrrrr.....",
    "....sbbbbbobbBs....",
    "......bbbbbbB......",
    ".....sSsSsSsSs.....",
    "....s..spP..s..s...",
  ];
  function dummy(k, u, v, battered) {
    const { st, S } = k, c = k.piece(), g = c.getContext("2d"), [x0, y0] = st.iso(u, v).map(R);
    const pal = { b: "#c9aa6c", B: "#977944", x: "#4a3420", r: "#7a5a30", p: "#7a5432", P: "#4e321c", s: "#e2c463", S: "#b0903a", t: "#b03a2c", w: "#eee4cc", o: "#8a7a5a", k: "#5a4228" };
    const rows = battered ? BATTERED : DUMMY, lean = battered ? 0.09 : 0, post = 12, top = y0 - post - rows.length;
    // the post down to a cross-foot, then the stuffed body on it; the battered one leans and sheds its straw
    for (let j = 0; j < post; j++) { const off = R((post - j) * lean * 0.4); dot(g, x0 + off - 1, top + rows.length + j, pal.p); dot(g, x0 + off, top + rows.length + j, pal.P); }
    K().pix(g, x0 - 4, y0 - 2, ["..pppPP..", "PPPPPPPPP"], pal);
    rows.forEach((row, j) => {
      const off = R((rows.length - j + post) * lean);
      for (let i = 0; i < row.length; i++) if (pal[row[i]]) dot(g, x0 - 9 + i + off, top + j, pal[row[i]]);
    });
    if (S.snow) for (let i = 0; i < 4; i++) dot(g, x0 - 2 + i + R((rows.length + post) * lean), top - 1, "#f4f8fc");
    if (battered) for (const [dx, dy] of [[-6, 0], [-3, 1], [4, 0], [7, 1], [-8, 1], [9, 0]]) dot(g, x0 + dx, y0 + dy - 1, dx % 2 ? "#e2c463" : "#b0903a");
    k.add(u + v + 0.2, c);
  }
  function weaponRack(k, u, v, len) {
    const { st, th, S } = k, P = Tv(), { shade } = K(), c = k.piece(), g = c.getContext("2d"), wood = "#6e4a2a";
    for (const vv of [v, v + len]) { const [x, y] = st.iso(u + 0.2, vv).map(R); g.fillStyle = shade(wood, -0.2); g.fillRect(x - 1, y - 27, 2, 27); g.fillStyle = shade(wood, 0.15); g.fillRect(x - 1, y - 27, 1, 27); }
    const kinds = ["sword", "staff", "sword", "spear", "axe", "sword", "staff", "sword"];
    for (let i = 0; i < kinds.length; i++) {
      const vv = v + 0.22 + i * ((len - 0.44) / (kinds.length - 1)), [bx, by] = st.up(st.iso(u + 0.2, vv), 2).map(R), kind = kinds[i];
      const top = kind === "staff" ? 36 : kind === "spear" ? 38 : kind === "axe" ? 24 : 25;
      for (let j = 0; j < top; j++) {
        const x = bx + (j > 16 ? 1 : 0), y = by - j;
        if (kind === "sword") { g.fillStyle = j < 7 ? "#5a3a20" : j < 8 ? "#3a2414" : j % 6 === 0 ? "#a88a5e" : "#c8aa7a"; g.fillRect(x, y, 1, 1); if (j >= 8) { g.fillStyle = "#8a6e48"; g.fillRect(x + 1, y, 1, 1); } if (j === 7) { g.fillStyle = "#4a3020"; g.fillRect(x - 2, y, 5, 1); } }
        else if (kind === "staff") { g.fillStyle = j % 9 === 4 ? "#5a3a1e" : "#8a6238"; g.fillRect(x, y, 1, 1); g.fillStyle = "#6a4626"; g.fillRect(x + 1, y, 1, 1); }
        else if (kind === "spear") { g.fillStyle = j > top - 6 ? (j > top - 3 ? "#d8dce4" : "#9aa0a8") : "#7a5632"; g.fillRect(x, y, 1, 1); if (j > top - 6 && j < top - 2) { g.fillStyle = "#8a9098"; g.fillRect(x + 1, y, 1, 1); } if (j === top - 7) { g.fillStyle = "#c8b890"; g.fillRect(x - 1, y, 3, 2); } }
        else { g.fillStyle = "#7a5632"; g.fillRect(x, y, 1, 1); if (j > top - 7) { g.fillStyle = j > top - 5 ? "#c8ccd4" : "#8a8e96"; g.fillRect(x - 4, y, 4, 1); } }
      }
    }
    for (const h of [6, 24]) { P.line(g, st.up(st.iso(u + 0.2, v), h), st.up(st.iso(u + 0.2, v + len), h), shade(wood, 0.2)); P.line(g, st.up(st.iso(u + 0.2, v), h - 1), st.up(st.iso(u + 0.2, v + len), h - 1), shade(wood, -0.25)); }
    if (S.snow) P.line(g, st.up(st.iso(u + 0.2, v), 25), st.up(st.iso(u + 0.2, v + len), 25), "#f4f8fc");
    // a painted shield leaning at its foot
    const [sx, sy] = st.iso(u + 0.75, v + len - 0.3);
    ellipse(g, sx, sy - 6, 5, 6, (dx, dy) => { const d = Math.hypot(dx, dy); return d > 0.82 ? "#5a3a20" : d < 0.28 ? "#c8a040" : Math.abs(dx) < 0.18 ? th.accent : dx < 0 ? th.primary : shade(th.primary, -0.25); });
    k.add(u + v + len + 0.9, c);
  }
  function archeryTarget(k, u, v) {
    const { st } = k, P = Tv(), c = k.piece(), g = c.getContext("2d"), [x, y] = st.iso(u, v).map(R);
    P.line(g, [x - 5, y], [x - 1, y - 17], "#5a3a20"); P.line(g, [x + 5, y + 1], [x + 1, y - 17], "#4a2e18"); P.line(g, [x + 1, y - 3], [x + 2, y - 18], "#6a4426");
    ellipse(g, x, y - 17, 7.5, 8, (dx, dy) => { const d = Math.hypot(dx, dy); return d > 0.86 ? (dy + dx < 0 ? "#d8bc6a" : "#a88a3a") : d > 0.68 ? "#f0ece0" : d > 0.5 ? "#2a2a30" : d > 0.32 ? "#3a6ab0" : d > 0.16 ? "#c83a2a" : "#f0c040"; });
    for (const [ax, ay] of [[-2, -19], [3, -14], [1, -21]]) { P.line(g, [x + ax, y + ay], [x + ax + 4, y + ay + 2], "#6a4a2a"); dot(g, x + ax + 4, y + ay + 2, "#f4f0e4"); dot(g, x + ax + 4, y + ay + 1, "#d84a3a"); }
    k.add(u + v + 0.4, c);
  }
  function bale(g, st, u, v, du, dv, h, z, snow) {
    const P = Tv(), { shade } = K(), hay = (x, y) => ((x * 3 + y * 5) % 7 < 2 ? "#d8b860" : (x + y * 2) % 5 ? "#c4a452" : "#b0903e");
    P.slab(g, st, u, v, du, dv, h, { base: "#b8963e", top: snow ? "#eef2f8" : hay, left: (x, y) => ((x + y * 3) % 6 < 2 ? "#c8a64a" : "#b0903c"), right: (x, y) => ((x + y) % 4 ? "#8e7232" : "#7a6028") }, z || 0);
    for (const s of [0.3, 0.7]) {
      P.line(g, st.up(st.iso(u, v + dv * s), (z || 0) + h), st.up(st.iso(u + du, v + dv * s), (z || 0) + h), "#7a5a2a");
      P.line(g, st.up(st.iso(u + du, v + dv * s), (z || 0) + h), st.up(st.iso(u + du, v + dv * s), z || 0), shade("#7a5a2a", -0.2));
    }
  }
  // the barn along the left back edge: weathered boards, the big painted doors, the hayloft door open on the hay, a hoist beam
  function barn(k, a0, a1, hh) {
    const { st, ctx, S } = k, P = Tv(), { shade, mix, h01, frac } = K(), on = st.onL, wall = st.lwall;
    const wood = ["#8e5a36", "#80502e", "#9a643c"], paint = mix(S.trim, "#8a3a2a", 0.55);
    P.fillPoly(ctx, st.quad(wall, a0, a1, 0, hh), (x, y) => {
      const [a, h] = on(x, y), kk = a * 2.4, col = Math.floor(kk), f = kk - col;
      if (h < 5) return shade(S.stone[Math.floor(h01(Math.floor(a * 2.5), 1) * 3) % 3], -0.22 - (h < 1 ? 0.15 : 0));
      if (Math.abs(h - 22) < 1.2 || h > hh - 2) return h > hh - 1 || (h > 22.3 && h < 23.2) ? "#7a4a28" : "#3e2414";
      if (f < 0.1) return "#4a2a16";
      let c = wood[Math.floor(h01(col, 7) * 3)];
      if (f > 0.82) c = shade(c, -0.1); else if (f < 0.22) c = shade(c, 0.06);
      if (h01(col, Math.floor(h / 6)) > 0.93) c = shade(c, -0.16);
      if (h < 12) c = mix(c, "#4a3a2a", (12 - h) / 30);
      return shade(c, -0.1);
    });
    roofOn(k, "l", a0, a1, hh, 18);
    const d0 = 2.6, d1 = 6.2, dm = (d0 + d1) / 2;
    P.fillPoly(ctx, st.quad(wall, d0 - 0.2, d1 + 0.2, 0, 31), "#3a2214");
    P.fillPoly(ctx, st.quad(wall, d0, d1, 0, 29), (x, y) => {
      const [a, h] = on(x, y), left = a < dm, s = left ? (a - d0) / (dm - d0) : (d1 - a) / (d1 - dm);
      if (Math.abs(a - dm) < 0.05) return "#2a180e";
      if (h > 27 || h < 1.5 || s < 0.06) return shade(paint, -0.22);
      if (Math.abs(h - (2.5 + s * 24)) < 1.1) return shade(paint, 0.14);
      if (Math.abs(h - 14) < 0.9) return shade(paint, 0.08);
      if ((Math.abs(h - 6) < 0.7 || Math.abs(h - 22) < 0.7) && s < 0.42) return s < 0.06 ? "#2a2a2e" : "#4a4a52";
      if (frac(a * 3.4) < 0.1) return shade(paint, -0.3);
      return h01(Math.floor(a * 3.4), Math.floor(h / 5)) > 0.85 ? shade(paint, -0.08) : paint;
    });
    { const [x, y] = wall(dm, 14).map(R); ctx.fillStyle = "#2a2a2e"; ctx.fillRect(x - 3, y - 1, 6, 2); ctx.fillStyle = "#6a6a72"; ctx.fillRect(x - 3, y - 1, 6, 1); }
    // the hayloft door, open on the hay, and the hoist beam over it with its rope and hook
    P.fillPoly(ctx, st.quad(wall, 3.6, 5.2, 31.5, 43), "#3a2214");
    P.fillPoly(ctx, st.quad(wall, 3.75, 5.05, 32.5, 42), (x, y) => { const [a, h] = on(x, y); return h < 37 + Math.sin(a * 9) * 1.5 ? (h01(x, y) > 0.6 ? "#e0c060" : h01(x + 1, y) > 0.4 ? "#c4a046" : "#a8883a") : "#1a100a"; });
    P.slab(ctx, st, 0, 4.28, 1.3, 0.26, 3, { base: "#5a3820", top: "#7a5030", left: "#5a3820", right: "#3e2414" }, 44);
    { const [x, y] = st.up(st.iso(1.2, 4.41), 43).map(R); ctx.fillStyle = "#3a3434"; ctx.fillRect(x - 1, y, 3, 2); ctx.fillStyle = "#8a7a5a"; ctx.fillRect(x, y + 2, 1, 13); K().pix(ctx, x - 1, y + 15, [".k.", "k.k", ".kk"], { k: "#4a4a50" }); }
  }
  function yard(k) {
    const { st, ctx, S, th, r, L } = k, P = Tv(), { shade, mix, pix, h01 } = K();
    const snow = !!S.snow, RC = [9.1, 6.4], RR = 2.1, DM = [3.925, 9.425];
    const E = snow ? ["#eef2f8", "#e2e8f2", "#d6dee9"] : S.ground === "boards" ? ["#9a8c6a", "#8e8060", "#827456"] : ["#bfa171", "#b29465", "#a48758"];
    const tuft = S.ground === "grass" ? ["#7a9a46", "#5e7e38"] : ["#8e9a58", "#6e7a46"];
    k.outdoorBack([[10.4, 16, 42, { door: 13.0, flowers: true }]],
      [[0, 10, 52, { door: 8.6, sign: [9.6, 32, "sword"] }], [10.4, 16, 36, { roofH: 12, chimney: false }]],
      (u, v) => {
        const n = h01(Math.floor(u * 4), Math.floor(v * 4)), g = h01(Math.floor(u * 12 + 5), Math.floor(v * 12 + 1));
        let c = n > 0.72 ? E[0] : n > 0.3 ? E[1] : E[2];
        if (g > 0.95) c = shade(c, -0.2); else if (g < 0.05) c = shade(c, 0.14);
        const dr = Math.hypot(u - RC[0], v - RC[1]), dd = Math.hypot(u - DM[0], v - DM[1]);
        if (snow) {
          if (dr < RR + 0.25 || dd < 1.4 || (u > 2 && u < 9 && Math.abs(v - 0.6 - u * 0.62) < 0.5)) c = mix(c, "#8a7c6a", 0.45 + g * 0.3);
        } else {
          if (dr < RR) c = mix(c, "#dcc694", 0.3);
          const wear = Math.max(0, 1 - Math.abs(dr - RR * 0.55) / 1.4) * 0.45 + Math.max(0, 1 - dd / 1.6) * 0.55;
          if (h01(Math.floor(u * 9), Math.floor(v * 9)) < wear * 0.45) c = shade(c, -0.12);
          if ((u < 0.8 || v < 0.8) && S.ground !== "boards" && h01(Math.floor(u * 10), Math.floor(v * 10)) > 0.45) c = h01(Math.floor(u * 10) + 1, Math.floor(v * 10)) > 0.5 ? tuft[0] : tuft[1];
        }
        if (Math.abs(dr - RR) < 0.075 && h01(Math.floor(u * 22), Math.floor(v * 22)) > 0.18) c = snow ? "#6a5a4a" : "#f2ead6";
        return c;
      });
    barn(k, 0, 10.2, 40);
    torch(k, "l", 6.9, 24); torch(k, "r", 7.3, 22);
    // footwork: scuffed crescents in the ring and round the dummy, a few footprints
    const scuff = snow ? "#7a6c5c" : shade(E[2], -0.28);
    for (let i = 0; i < 34; i++) {
      const inRing = i < 24, a = r() * Math.PI * 2, d = Math.sqrt(r()) * (inRing ? RR * 0.92 : 1.3), [x, y] = st.iso((inRing ? RC[0] : DM[0] + 0.5) + Math.cos(a) * d, (inRing ? RC[1] : DM[1] - 0.2) + Math.sin(a) * d).map(R);
      pix(ctx, x - 2, y, i % 3 === 0 ? ["x.x", "..."] : r() < 0.5 ? ["x..x", ".xx."] : [".xx.", "x..x"], { x: scuff });
    }
    // the scoreboard on the hall: a slate in a frame, two names chalked up and their tallies
    { const wall = st.rwall;
      P.fillPoly(ctx, st.quad(wall, 4.3, 7.3, 9, 29), "#5a3a22");
      P.fillPoly(ctx, st.quad(wall, 4.45, 7.15, 10.5, 27.5), (x, y) => ((x * 7 + y * 3) % 11 === 0 ? "#3a443e" : (x + y) % 9 === 0 ? "#38403a" : "#2c3430"));
      P.slab(ctx, st, 4.4, 0, 2.8, 0.25, 1, "#6a4428", 8.5);
      const chalk = "#d8d8cc";
      const dim = "#a8aca4";
      P.line(ctx, wall(5.4, 24.5), wall(6.4, 24.5), dim);
      [[19.5, 7], [14.5, 4], [10.5, 9]].forEach(([h, n], row) => {
        for (let j = 0; j < 4; j++) dot(ctx, ...wall(4.62 + j * 0.13, h + 1 + (j % 2)), dim);
        for (let i = 0; i < n; i++) {
          const g5 = Math.floor(i / 5), m = i % 5, a = 5.3 + g5 * 1.05 + m * 0.25;
          if (m < 4) P.line(ctx, wall(a, h), wall(a, h + 2), chalk); else P.line(ctx, wall(a - 0.95, h + 0.2), wall(a - 0.05, h + 2), chalk);
        }
        if (row === 1) { const [x, y] = wall(4.55, h - 1).map(R); ctx.fillStyle = "#c8c0b0"; ctx.fillRect(x, y, 2, 1); }
      });
      for (const [a, col] of [[4.6, "#f4f0e4"], [4.8, "#e8d8a0"]]) { const [x, y] = st.up(st.iso(a, 0.12), 10).map(R); ctx.fillStyle = col; ctx.fillRect(x, y - 1, 2, 1); }
    }
    // a post-and-rail fence before the low house, the archery butts in front of it
    for (let a = 10.4; a < 16.4; a += 0.9) { const [x, y] = st.iso(a, 0.55).map(R); ctx.fillStyle = "#6a4a2c"; ctx.fillRect(x, y - 15, 2, 15); ctx.fillStyle = "#8a6a42"; ctx.fillRect(x, y - 15, 1, 15); if (snow) { ctx.fillStyle = "#f4f8fc"; ctx.fillRect(x, y - 16, 2, 1); } }
    for (const h of [5, 11]) { P.line(ctx, st.up(st.iso(10.4, 0.55), h), st.up(st.iso(16.4, 0.55), h), "#a07e50"); P.line(ctx, st.up(st.iso(10.4, 0.55), h - 1), st.up(st.iso(16.4, 0.55), h - 1), "#6a4a2c"); }
    archeryTarget(k, 12.2, 1.6); archeryTarget(k, 14.4, 1.9);
    for (const [u, v] of [[11.4, 3.0], [13.2, 3.4], [12.6, 2.6]]) { const [x, y] = st.iso(u, v).map(R); P.line(ctx, [x, y], [x + 2, y - 5], "#6a4a2a"); dot(ctx, x + 2, y - 5, "#f4f0e4"); dot(ctx, x + 3, y - 6, "#f4f0e4"); }
    // bales and a pitchfork in the corner by the barn
    { const c = k.piece(), g = c.getContext("2d"); bale(g, st, 0.2, 0.5, 0.9, 1.3, 7, 0, snow); bale(g, st, 0.25, 0.6, 0.85, 1.1, 7, 7, snow); P.line(g, st.up(st.iso(1.25, 1.9), 0), st.up(st.iso(1.0, 1.7), 26), "#8a6a3a"); pix(g, ...st.up(st.iso(1.25, 1.9), 3).map((n, i) => R(n) - (i ? 0 : 2)), ["x.x.x", "xxxxx"], { x: "#6a6a72" }); k.add(1.25 + 1.9 + 0.2, c); }
    dummy(k, 2.6, 1.4, true);
    dummy(k, DM[0], DM[1], false);
    // the water barrel with its dipper, a pail; the bench with a cloak and a jug on it, stones to lift
    { const c = k.piece(), g = c.getContext("2d"), [x, y] = st.iso(1.0, 7.4).map(R); P.barrel(g, x, y, 1.15); g.fillStyle = snow ? "#c8d8e8" : "#3a5a6a"; g.fillRect(x - 4, y - 15, 9, 1); P.line(g, [x + 2, y - 15], [x + 7, y - 20], "#7a5a30"); pix(g, x + 6, y - 22, ["xx", "xx"], { x: "#5a4a3a" }); k.add(1.0 + 7.4 + 0.7, c); }
    { const c = k.piece(), g = c.getContext("2d"), [x, y] = st.iso(1.5, 8.3).map(R); pix(g, x - 3, y - 6, [".xxxxx.", "xwwwwwx", "xyyyyyx", "xyzyyyx", ".xyyyx.", "..xxx.."], { x: "#4a3a2a", w: snow ? "#c8d8e8" : "#7aa0b8", y: "#8a6a44", z: "#a8885a" }); k.add(1.5 + 8.3 + 0.3, c); }
    { const c = k.piece(), g = c.getContext("2d"), wood = "#7a5232";
      P.legs(g, st, 0.75, 8.9, 0.45, 1.9, 5, shade(wood, -0.25)); P.slab(g, st, 0.75, 8.9, 0.45, 1.9, 1.5, { base: wood, top: shade(wood, 0.16), left: shade(wood, -0.05), right: shade(wood, -0.32) }, 5);
      const [cx, cy] = st.up(st.iso(1.0, 9.4), 7).map(R); pix(g, cx - 4, cy - 3, ["..cccc...", ".cccdcc..", "cccccdcc.", ".ddccccdd"], { c: shade(th.primary, -0.15), d: shade(th.primary, -0.4) });
      const [jx, jy] = st.up(st.iso(1.0, 10.3), 7).map(R); pix(g, jx - 2, jy - 6, [".xx.", "xyyx", "xyyxx", "xyyx.", ".xx.."], { x: "#6a4a2a", y: "#a8784a" });
      k.add(1.2 + 10.8 + 0.1, c); }
    { const c = k.piece(), g = c.getContext("2d");
      for (const [u, v, s] of [[1.9, 11.0, 4], [2.4, 11.3, 3], [2.1, 11.7, 2.4]]) { const [x, y] = st.iso(u, v); ellipse(g, x, y - s * 0.6, s * 1.2, s * 0.8, (dx, dy) => (dy < -0.3 && dx < 0.2 ? "#a8a29a" : dx > 0.4 || dy > 0.5 ? "#5e5a56" : "#86817a")); }
      k.add(2.5 + 11.7 + 0.3, c); }
    weaponRack(k, 1.2, 11.5, 2.8);
    // the pell: a stout post hacked with notches, for blade work
    { const c = k.piece(), g = c.getContext("2d"), wood = "#7e5a36";
      P.slab(g, st, 6.0, 12.8, 0.32, 0.32, 24, { base: wood, top: snow ? "#f4f8fc" : shade(wood, 0.2), left: (x, y) => ((y * 3 + x) % 7 === 0 ? shade(wood, -0.4) : (y % 5 === 0 ? shade(wood, -0.18) : wood)), right: (x, y) => ((y * 2 + x) % 6 === 0 ? shade(wood, -0.55) : shade(wood, -0.3)) });
      k.add(6.32 + 13.12, c); }
    // a sawhorse hung with practice shields and a dented helm on top
    { const c = k.piece(), g = c.getContext("2d"), wood = "#7a5634", u0 = 6.8, u1 = 8.4, v = 13.9;
      for (const u of [u0 + 0.1, u1 - 0.1]) for (const dv of [-0.25, 0.25]) { const [x, y] = st.iso(u, v + dv).map(R), [tx, ty] = st.up(st.iso(u, v), 11).map(R); P.line(g, [x, y], [tx, ty], shade(wood, dv < 0 ? -0.3 : 0)); }
      P.slab(g, st, u0, v - 0.08, u1 - u0, 0.16, 2, { base: wood, top: shade(wood, 0.25), left: wood, right: shade(wood, -0.3) }, 10);
      [[7.1, th.primary, th.accent], [7.6, "#8a6a42", "#c8a040"], [8.1, shade(th.accent, -0.2), th.primary]].forEach(([u, a, b]) => {
        const [x, y] = st.up(st.iso(u, v + 0.12), 8);
        ellipse(g, x, y, 4.5, 5, (dx, dy) => { const d = Math.hypot(dx, dy); return d > 0.8 ? "#4a3420" : d < 0.25 ? "#c8c8d0" : (dx > 0) === (dy > 0) ? a : b; });
      });
      const [hx, hy] = st.up(st.iso(7.6, v), 12).map(R); pix(g, hx - 3, hy - 5, ["..xxx..", ".xyyyx.", "xyyzyyx", "xyyyyyx", "xxxxxxx"], { x: "#4a4a52", y: "#8a8e96", z: "#c8ccd4" });
      if (snow) P.line(g, st.up(st.iso(u0, v), 13), st.up(st.iso(u1, v), 13), "#f4f8fc");
      k.add(u1 + v + 0.3, c); }
    // a sandbag on a gibbet arm to beat on, swinging
    { const [px, py] = st.iso(3.4, 15.6).map(R), [ax, ay] = st.up(st.iso(4.6, 15.6), 36).map(R), wood = "#6a4a2c";
      live(k, 3.4 + 15.6 + 0.3, (g, t, still) => {
        g.fillStyle = shade(wood, -0.2); g.fillRect(px - 1, py - 38, 3, 38); g.fillStyle = shade(wood, 0.15); g.fillRect(px - 1, py - 38, 1, 38);
        P.line(g, [px, py - 37], [ax, ay], wood); P.line(g, [px, py - 36], [ax, ay + 1], shade(wood, -0.3)); P.line(g, [px + 1, py - 26], [px + 7, py - 35], wood);
        const sw = still ? 0.5 : Math.sin(t * 1.6) * 2, bx = ax + sw;
        P.line(g, [ax, ay + 1], [bx, ay + 8], "#a08a62");
        pix(g, R(bx) - 3, ay + 8, ["..xx..", ".xyyx.", "xyyyyx", "xyzyyx", "xyyyzx", "xyzyyx", "xyyyyx", "xyyzyx", "xyyyyx", ".xyyx.", "..xx.."], { x: "#5a4428", y: "#a8885a", z: "#8a6e44" });
        if (snow) { g.fillStyle = "#f4f8fc"; g.fillRect(px - 1, py - 39, 3, 1); }
      }); }
    // a log balance beam on trestles
    { const c = k.piece(), g = c.getContext("2d"), v = 4.7, u0 = 15.2, u1 = 17.8;
      for (const u of [u0 + 0.3, u1 - 0.3]) for (const dv of [-0.3, 0.3]) P.line(g, st.iso(u, v + dv), st.up(st.iso(u, v), 8), "#5a3c22");
      for (let d = 0; d < 4; d++) P.line(g, st.up(st.iso(u0, v), 8 + d), st.up(st.iso(u1, v), 8 + d), ["#5a3c22", "#8a6440", "#a07a50", snow ? "#f4f8fc" : "#8a6440"][d]);
      const [ex, ey] = st.up(st.iso(u1, v), 10).map(R); ellipse(g, ex, ey, 2, 2, (dx, dy) => (dx * dx + dy * dy < 0.3 ? "#c8a070" : "#6a4a2a"));
      k.add(u1 + v + 0.4, c); }
    // a dropped practice sword by the ring, a forgotten helm
    { const [x, y] = st.iso(11.9, 5.8).map(R); pix(ctx, x - 5, y - 2, ["........x", ".....yyy.", "kk.yyy...", "kxyy.....", "x........"], { y: "#c8aa7a", x: "#4a3020", k: "#5a3a20" }); }
    if (!snow && (k.wx === "rain" || k.wx === "storm")) for (const [u, v, w] of [[6.6, 9.8, 1.1], [11.4, 9.4, 0.8], [3.6, 6.4, 0.7], [12.6, 4.8, 0.9]]) {
      const [x, y] = st.iso(u, v); ellipse(ctx, x, y, w * 8, w * 3, (dx, dy) => (dx * dx + dy * dy > 0.7 ? "#6a5a44" : dy < -0.2 ? mix(L.sky[1], "#8a96a8", 0.4) : "#7a8698"));
    }
    if (!snow) for (let i = 0; i < 40; i++) {
      const s = r(), u = s < 0.5 ? 0.3 + r() * 0.5 : 0.3 + r() * 15, v = s < 0.5 ? r() * 16 : 0.3 + r() * 0.5, [x, y] = st.iso(u, v).map(R);
      pix(ctx, x - 1, y - 2, r() < 0.5 ? ["x.x", ".x."] : ["x..", "x.x", ".x."], { x: r() < 0.5 ? tuft[0] : tuft[1] });
    }
    // footprints from the hall's door to the ring, straw shed round the dummies
    for (let i = 0; i < 14; i++) { const s2 = i / 14, u = 8.4 + (RC[0] - 8.4) * s2 + (i % 2 ? 0.12 : -0.12), v = 0.9 + (RC[1] - RR - 0.9) * s2, [x, y] = st.iso(u, v).map(R); ctx.fillStyle = scuff; ctx.fillRect(x, y, 2, 1); }
    for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, d = 0.3 + r() * 1.1, ctr = i % 3 ? DM : [2.6, 1.4], [x, y] = st.iso(ctr[0] + Math.cos(a) * d, ctr[1] + Math.sin(a) * d).map(R); ctx.fillStyle = r() < 0.5 ? "#e2c463" : "#b0903a"; ctx.fillRect(x, y, 2, 1); }
    // a few sparrows hopping about the ring
    const birds = [[7.6, 7.6], [10.4, 5.0], [10.6, 8.2]];
    k.anims.push((c, t, still) => birds.forEach(([u, v], i) => {
      const step = still ? 0 : Math.floor(t * 0.5 + i * 0.37), ph = still ? 0.5 : K().frac(t * 0.5 + i * 0.37);
      const [x, y] = st.iso(u + Math.sin(step * 2.1 + i) * 0.5, v + Math.cos(step * 1.7 + i) * 0.4).map(R), hop = ph < 0.12 ? 2 : 0, peck = ph > 0.5 && ph < 0.62;
      pix(c, x - 2, y - 4 - hop + (peck ? 1 : 0), peck ? ["..bb.", "kbbbb", ".bwb.", ".y.y."].slice(0, 4) : [".bb..", "kbbbb", ".bwbb", ".y.y."], { b: "#7a5a3a", k: "#e0a040", w: "#c8b8a0", y: "#3a2a1a" });
    }));
    k.spot("act", 5.125, 8.625, -1); k.spot("dummy", 4.525, 8.025, -1); k.spot("npc", 9.25, 3.25, -1); k.spot("ring", 8.6, 6.6, 1); k.spot("rack", 3.0, 12.4, -1);
    k.spot("in", 15, 8, -1); k.spot("mate", 13.5, 4.0, -1); k.spot("other", 13.5, 7.0, -1); k.spot("pet", 9.5, 10.0, -1);
    k.crowd([]);
    k.npc = { kind: "trainer" };
  }

  // ======================================================================================================================
  // the docks: a plank pier on the left, the stone quay before the warehouses, the harbour water on the right, boats, a crane, nets
  // ======================================================================================================================
  const PU = 6.0, QV = 2.4;
  const isDeck = (u, v) => u < PU || v < QV;
  function waterCols(k) {
    const { S, town } = k;
    if (S.snow) return ["#3e5e78", "#4a6c86", "#5a7c94", "#a8c0d4"];
    if (S.damp) return ["#2a4a42", "#34564c", "#3e6256", "#8ab0a0"];
    if (town === "saltmarrow" || town === "carrbridge") return ["#1e5a7e", "#26688c", "#3478a0", "#9ad0ec"];
    return ["#22546a", "#2a6278", "#36708a", "#8ac0d8"];
  }
  function boatArt(g, st, b, t, k) {
    const P = Tv(), { shade, mix } = K(), dz = R(Math.sin(t * 1.3 + b.ph) * 1.0), wc = waterCols(k);
    const N = 14, pts = [];
    for (let i = 0; i <= N; i++) {
      const s = i / N, w = b.w * Math.pow(Math.sin(Math.PI * Math.max(0.02, Math.min(0.98, s))), 0.55), along = b.at + s * b.len, hg = b.hg + 2.4 * Math.pow(Math.abs(2 * s - 1), 2);
      const near = b.axis === "u" ? [along, b.c + w] : [b.c + w, along], far = b.axis === "u" ? [along, b.c - w] : [b.c - w, along];
      const iw = (p) => { const [x, y] = st.iso(p[0], p[1]); return [x, y + 5 + dz]; };
      pts.push({ nw: iw(near), fw: iw(far), ng: st.up(iw(near), hg), fg: st.up(iw(far), hg), cw: iw(b.axis === "u" ? [along, b.c] : [b.c, along]), hg });
    }
    // the hull's shadow on the water and the shimmer of its reflection
    P.fillPoly(g, pts.map((p) => [p.nw[0], p.nw[1] + 1]).concat(pts.slice().reverse().map((p) => [p.fw[0], p.fw[1] + 1])), rgba("#0a1a24", 0.35));
    for (let i = 1; i < N; i += 2) { const p = pts[i]; g.fillStyle = rgba(shade(b.paint, -0.2), 0.35); g.fillRect(R(p.nw[0]), R(p.nw[1]) + 2 + (i % 4 ? 1 : 0), 2, 1); }
    // inside: the dark planking, thwarts across
    P.fillPoly(g, pts.map((p) => p.fg).concat(pts.slice().reverse().map((p) => p.ng)), (x, y) => ((x + y) % 5 === 0 ? "#3e2a1a" : "#4e3622"));
    for (const s of [0.32, 0.62]) { const p = pts[R(s * N)]; P.line(g, st.up(p.fg, -1.5), st.up(p.ng, -1.5), "#8a6a44"); P.line(g, st.up(p.fg, -2.5), st.up(p.ng, -2.5), "#5a3e26"); }
    if (b.oars) { const p = pts[R(0.45 * N)], q = pts[R(0.75 * N)]; P.line(g, st.up(p.fg, -1), st.up(q.ng, -1), "#b08a5a"); }
    if (b.net) { const p = pts[R(0.72 * N)]; ellipse(g, p.cw[0], p.cw[1] - p.hg + 1, 4, 2, (dx, dy, x, y) => ((x + y) % 2 ? "#8a7a5a" : "#6a5a40")); dot(g, p.cw[0] - 2, p.cw[1] - p.hg, "#d84a3a"); dot(g, p.cw[0] + 2, p.cw[1] - p.hg + 1, "#e8b040"); }
    // the near side: strakes in the boat's paint, a dark waterline band, the gunwale rail
    P.fillPoly(g, pts.map((p) => p.nw).concat(pts.slice().reverse().map((p) => p.ng)), b.paint);
    for (let i = 0; i < N; i++) {
      const a = pts[i], c = pts[i + 1];
      for (const [f, col] of [[0.18, shade(b.bottom, -0.1)], [0.4, shade(b.paint, -0.22)], [0.72, shade(b.paint, -0.18)]]) P.line(g, [a.nw[0] + (a.ng[0] - a.nw[0]) * f, a.nw[1] + (a.ng[1] - a.nw[1]) * f], [c.nw[0] + (c.ng[0] - c.nw[0]) * f, c.nw[1] + (c.ng[1] - c.nw[1]) * f], col);
      P.line(g, [a.nw[0], a.nw[1] - 1], [c.nw[0], c.nw[1] - 1], b.bottom);
      P.line(g, a.ng, c.ng, shade(b.trim, 0.1)); P.line(g, [a.ng[0], a.ng[1] + 1], [c.ng[0], c.ng[1] + 1], shade(b.trim, -0.2));
      P.line(g, a.fg, c.fg, shade(b.trim, -0.15));
    }
    if (b.name) { const p = pts[R(0.8 * N)]; g.fillStyle = "#f0e8d0"; g.fillRect(R(p.ng[0]) - 2, R(p.ng[1]) + 3, 4, 1); }
    // a mast with its sail furled on the boom, or set; stays to bow and stern; a lantern at night
    if (b.mast) {
      const m = pts[R(0.38 * N)], base = [R(m.cw[0]), R(m.cw[1] - m.hg + 1)], top = [base[0], base[1] - b.mast];
      const bow = pts[N].ng, stern = pts[0].ng;
      g.fillStyle = "#4a3420"; g.fillRect(base[0], top[1], 1, b.mast); g.fillStyle = "#7a5a36"; g.fillRect(base[0] - 1, top[1] + 2, 1, b.mast - 4);
      P.line(g, top, bow, rgba("#2a1a10", 0.55)); P.line(g, top, stern, rgba("#2a1a10", 0.55));
      const bend = pts[R(0.05 * N)], boomEnd = [R(bend.cw[0]), R(bend.cw[1] - bend.hg - 6)];
      if (b.sail) {
        P.fillPoly(g, [[top[0], top[1] + 2], [top[0], base[1] - 7], [boomEnd[0], boomEnd[1]]], (x, y) => ((y + Math.floor(x / 4)) % 6 === 0 ? "#d8ccb0" : x % 7 === 0 ? "#e2d8c0" : "#f2eadb"));
        P.line(g, [top[0], top[1] + 2], boomEnd, "#c8bca0");
      }
      P.line(g, [base[0], base[1] - 7], boomEnd, "#5a3e24");
      if (!b.sail) for (let i = 0; i <= 6; i++) { const s = i / 6, x = base[0] + (boomEnd[0] - base[0]) * s, y = base[1] - 8 + (boomEnd[1] - base[1] + 7) * s; g.fillStyle = i % 2 ? "#e8dcc4" : "#d4c8ac"; g.fillRect(R(x) - 1, R(y) - 1, 3, 2); }
      if (b.flag) { g.fillStyle = k.th.primary; g.fillRect(top[0] + 1, top[1], 4, 2); g.fillStyle = k.th.accent; g.fillRect(top[0] + 1, top[1] + 1, 2, 1); }
      if (k.L.lamps) { g.fillStyle = "#2a2018"; g.fillRect(base[0] - 1, base[1] - 20, 3, 4); g.fillStyle = "#ffe090"; g.fillRect(base[0], base[1] - 19, 1, 2); }
    }
    // the mooring line, sagging to its bollard
    if (b.moor) {
      const p = pts[b.moorEnd ? N : 0].ng, q = b.moor;
      for (let i = 0; i < 10; i++) { const s = i / 10, s2 = (i + 1) / 10, sag = (x) => Math.sin(x * Math.PI) * 3; P.line(g, [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s + sag(s)], [p[0] + (q[0] - p[0]) * s2, p[1] + (q[1] - p[1]) * s2 + sag(s2)], "#a08a62"); }
    }
    // little rings of water lapping at the hull
    for (const i of [2, 7, 12]) { const p = pts[i], ph = K().frac(t * 0.6 + i * 0.2 + b.ph); g.fillStyle = rgba(wc[3], 0.5 * (1 - ph)); g.fillRect(R(p.nw[0] - 2 - ph * 2), R(p.nw[1]) + 1, 3 + R(ph * 3), 1); }
  }
  function docks(k) {
    const { st, ctx, S, th, r, L } = k, P = Tv(), { shade, mix, pix, h01, frac, M, F } = K(), wc = waterCols(k), snow = !!S.snow;
    const plank = F.planks(["#8e7a5e", "#84705a", "#98846a"], "#4a3c2c"), quayCols = S.stone.map((c) => shade(c, 0.05));
    const deck = (u, v) => {
      if (u < PU) {
        let c = plank(u, v);
        if (snow && h01(Math.floor(u * 2.2 + Math.floor(v * 2) * 0.37), Math.floor(v * 2)) > (PU - u < 1 || u < 1 ? 0.45 : 0.8) && Math.abs(v * 2 - R(v * 2)) > 0.14) c = h01(Math.floor(u * 7), Math.floor(v * 7)) > 0.4 ? "#eef2f8" : "#dfe6f0";
        if (frac(u * 0.5 + 0.1) < 0.03 && Math.abs(v * 2 - R(v * 2)) < 0.12) c = "#3a3028";
        if (PU - u < 0.35) c = shade(c, -0.1);
        return c;
      }
      const row = Math.floor(v * 1.3), kk = u * 1.1 + (row % 2 ? 0.5 : 0), col = Math.floor(kk);
      if (v * 1.3 - row < 0.07 || kk - col < 0.06) return shade(S.mortar, 0.1);
      let c = quayCols[Math.floor(h01(row, col) * quayCols.length)];
      if (v > QV - 0.45) c = shade(c, 0.12 - (v > QV - 0.1 ? 0.1 : 0));
      if (snow && h01(Math.floor(u * 4), Math.floor(v * 4)) > 0.5) c = "#e8eef6";
      return c;
    };
    const wh1 = M.boards(["#6e6050", "#665848", "#786a58"], "#3a2e22"), wh2 = M.boards(S.board || ["#7a6a54", "#706048", "#86765e"], "#3a2e22");
    k.outdoorBack([[0, 5.6, 34, { roofH: 12, door: 2.8, sign: [4.4, 24, "fish"], flowers: true }], [6.0, 16, 26, { roofH: 10, chimney: false }]],
      [[0, 7.0, 46, { mat: wh1, door: 2.4, sign: [4.2, 30, "fish"] }], [7.4, 16, 54, { mat: wh2, chimney: false, roofH: 14 }]], deck);
    // the water, five pixels below the deck: the timber face of the pier and the stone face of the quay at its edge, slime at the waterline
    const waterAt = (u, v, x) => {
      const near = Math.min(u - PU, v - QV), band = frac((u * 1.4 + v * 0.7) * 1.6 + h01(Math.floor(u * 2), Math.floor(v * 2)) * 0.5);
      let c = near < 0.6 ? wc[0] : u + v > 17 ? wc[2] : wc[1];
      if (band < 0.08) c = mix(c, wc[3], 0.35); else if (band > 0.55 && band < 0.6) c = shade(c, -0.08);
      if (near < 0.25) c = shade(c, -0.2);
      if (snow && h01(Math.floor(u * 1.6), Math.floor(v * 1.6)) > 0.86 && near > 0.8) c = h01(x, Math.floor(v * 9)) > 0.3 ? "#e6eef6" : "#c8d8e6";
      return c;
    };
    P.fillPoly(ctx, [st.iso(PU - 0.5, QV - 0.5), st.iso(30, QV - 0.5), st.iso(30, 30), st.iso(PU - 0.5, 30)], (x, y) => {
      const [u0, v0] = st.toUV(x, y);
      if (isDeck(u0, v0)) return null;
      for (let s = 1; s <= 5; s++) {
        const [u1, v1] = st.toUV(x, y - s);
        if (!isDeck(u1, v1)) continue;
        if (s === 5) return "#3a5a32";
        if (u1 < PU) return s === 1 ? "#6a5a44" : frac(v1 * 2.4) < 0.12 ? "#2a2018" : s > 3 ? "#3a2e22" : "#4a3a2a";
        return s === 1 ? shade(S.stone[0], 0.05) : frac(u1 * 1.1) < 0.06 || s === 3 ? shade(S.mortar, -0.1) : shade(S.stone[Math.floor(h01(Math.floor(u1 * 1.1), s > 3 ? 1 : 2) * 3) % 3], -0.35);
      }
      const [uw, vw] = st.toUV(x, y - 5);
      return waterAt(uw, vw, x);
    });
    // an iron ladder down the quay face, a mooring ring
    { const [x, y] = st.iso(12.0, QV).map(R); ctx.fillStyle = "#3a3a40"; ctx.fillRect(x - 2, y, 1, 7); ctx.fillRect(x + 2, y + 2, 1, 7); for (let j = 1; j < 6; j += 2) { ctx.fillRect(x - 2, y + j + 1, 5, 1); } }
    { const [x, y] = st.iso(9.4, QV).map(R); pix(ctx, x - 1, y + 1, [".k.", "k.k", ".k."], { k: "#4a4a50" }); }
    // the warehouse's loading doors open on sacks and barrels, its loft door and hoist beam
    { const wall = st.rwall, on = st.onR;
      P.fillPoly(ctx, st.quad(wall, 12.4, 15.2, 0, 30), "#3a2a1e");
      P.fillPoly(ctx, st.quad(wall, 12.6, 15.0, 0, 28), (x, y) => { const [a, h] = on(x, y); return h < 2 ? "#2a2018" : (h + a * 3) % 9 < 1 ? "#1e1610" : "#161008"; });
      for (let i = 0; i < 5; i++) { const [x, y] = wall(12.9 + i * 0.42, 1).map(R); pix(ctx, x - 2, y - 7, i % 2 ? [".xx.", "xyyx", "xyyx", "xyyx", "xyyx", "xyyx", ".xx."] : ["..x..", ".xyx.", "xyyyx", "xyzyx", "xyyyx", "xyyyx", ".xxx."], { x: "#3a2a1a", y: i % 2 ? "#6a4a2a" : "#8a7454", z: "#a08a64" }); }
      for (const [a0, a1] of [[11.6, 12.4], [15.2, 16.0]]) P.fillPoly(ctx, st.quad(wall, a0, a1, 0, 28), (x, y) => { const [a, h] = on(x, y); return frac(a * 3.2) < 0.12 ? "#3a2a1e" : Math.abs(h - (a0 < 13 ? 2 + (a - a0) * 30 : 26 - (a - a0) * 30)) < 1.2 ? "#5a4432" : h01(Math.floor(a * 3.2), Math.floor(h / 6)) > 0.8 ? "#6e5844" : "#7a6450"; });
      P.fillPoly(ctx, st.quad(wall, 13.2, 14.4, 34, 46), "#3a2a1e"); P.fillPoly(ctx, st.quad(wall, 13.35, 14.25, 35, 45), "#140e08");
      P.slab(ctx, st, 13.65, 0, 0.3, 1.5, 3, { base: "#5a4430", top: "#7a5e44", left: "#5a4430", right: "#3e2e20" }, 48);
      const [px, py] = st.up(st.iso(13.8, 1.35), 47).map(R); ctx.fillStyle = "#3a3434"; ctx.fillRect(px - 1, py, 3, 3);
      k.anims.push((c, t, still) => { const sw = still ? 0 : Math.sin(t * 0.9) * 1.2, len = 18; Tv().line(c, [px, py + 3], [px + sw, py + 3 + len], "#8a7a5a"); pix(c, R(px + sw) - 3, py + 3 + len, ["..xx..", ".xyyx.", "xyyzyx", "xyyyyx", ".xxxx."], { x: "#6a5a3a", y: "#c8b088", z: "#a8946a" }); });
    }
    // nets drying on frames along the left, floats strung on them
    { const c = k.piece(), g = c.getContext("2d"), u = 1.0, posts = [7.4, 9.8, 12.2];
      for (const v of posts) { const [x, y] = st.iso(u, v).map(R); g.fillStyle = "#5a4430"; g.fillRect(x, y - 28, 2, 28); g.fillStyle = "#7a6048"; g.fillRect(x, y - 28, 1, 28); }
      for (let i = 0; i < posts.length - 1; i++) {
        const v0 = posts[i], v1 = posts[i + 1];
        P.line(g, st.up(st.iso(u, v0), 26), st.up(st.iso(u, v1), 26), "#6a5038");
        for (let s = 0; s <= 1; s += 0.02) {
          const vv = v0 + (v1 - v0) * s, [x, y] = st.up(st.iso(u, vv), 25).map(R), drop = 16 + Math.sin(s * Math.PI) * 4;
          for (let j = 1; j < drop; j++) if ((x + j) % 2 === 0 && (j + R(s * 50)) % 3) dot(g, x, y + j, j > drop - 2 ? "#6a5a40" : (x + j) % 4 ? "#8a7a5a" : "#a08e6a");
          if (R(s * 50) % 6 === 0) { dot(g, x, y + 1, "#e8b040"); dot(g, x, y + 2, "#c88a30"); }
          if (R(s * 50) % 8 === 4) dot(g, x, y + drop, "#d84a3a");
        }
      }
      k.add(u + 12.2 + 0.2, c); }
    // crates and barrels by the warehouse doors, lobster pots, a crate of the day's fish
    for (const [u, v, col] of [[1.2, 4.0, "#8a6236"], [1.3, 4.75, "#7a5a36"], [1.25, 4.35, "#946a3e"]]) K().crate(k, u, v, col);
    { const c = k.piece(), g = c.getContext("2d"); P.slab(g, st, 1.3, 4.2, 0.6, 0.6, 6, { base: "#8a6a3e", left: (x, y) => ((y + x) % 4 ? "#8a6a3e" : "#6a4a2a"), right: "#5a3a1e" }, 7); k.add(1.9 + 4.8 + 0.01, c); }
    for (const [u, v] of [[0.7, 1.8], [1.4, 1.5], [0.8, 2.7]]) K().barrel(k, u, v);
    for (const [u, v, z] of [[5.4, 0.6, 0], [6.1, 0.7, 0], [5.75, 0.62, 8]]) {
      const c = k.piece(), g = c.getContext("2d"), [x, y] = st.up(st.iso(u, v), z).map(R);
      pix(g, x - 5, y - 8, ["..xxxxxx..", ".xyxyxyxx.", "xyxyxyxyxx", "xxyxyxyxyx", "xyxyxyxyxx", "xxyxyxyxyx", "xyxyxyxyxx", ".xxxxxxxx."], { x: "#7a5a32", y: "#3a2a1a" });
      k.add(u + v + 0.6 + z * 0.01, c);
    }
    { const c = k.piece(), g = c.getContext("2d"); P.slab(g, st, 3.6, 3.0, 0.8, 0.55, 5, { base: "#7a5a36", top: "#4a3622", left: (x, y) => (y % 3 ? "#7a5a36" : "#5a4026"), right: "#5a3e24" });
      for (let i = 0; i < 9; i++) { const [x, y] = st.up(st.iso(3.75 + (i % 3) * 0.24, 3.1 + Math.floor(i / 3) * 0.15), 5).map(R); pix(g, x - 2, y - 1, ["xyyz", ".yy."], { x: "#8a9aa8", y: i % 2 ? "#c8d4dc" : "#a8b8c4", z: "#e0e8ee" }); }
      k.add(4.4 + 3.55, c); }
    // coils of rope on the planks and the quay
    for (const [u, v] of [[4.9, 11.2], [8.2, 1.4], [3.0, 9.0]]) { const [x, y] = st.iso(u, v).map(R); pix(ctx, x - 4, y - 3, ["..rrrr..", ".rRrrRr.", "rRr..rRr", ".rRrrRr.", "..rrrr.."], { r: "#b09a6a", R: "#8a744a" }); }
    // the pilings along the pier's edge and the bollards, gulls on a few of them
    const GULL = [".ww..", "wwwk.", ".wwww", "..g.g"];
    const pilings = [3.0, 5.4, 7.8, 10.2, 12.6, 15.0];
    pilings.forEach((v, i) => {
      const c = k.piece(), g = c.getContext("2d"), [x, y] = st.iso(PU, v).map(R);
      g.fillStyle = "#3e2e1e"; g.fillRect(x - 1, y - 6, 4, 12); g.fillStyle = "#5e4a34"; g.fillRect(x - 1, y - 6, 2, 12); g.fillStyle = "#7a644a"; g.fillRect(x - 1, y - 7, 4, 1);
      g.fillStyle = "#3a5a32"; g.fillRect(x - 1, y + 4, 4, 2);
      if (snow) { g.fillStyle = "#f4f8fc"; g.fillRect(x - 1, y - 8, 4, 1); }
      if (i === 1 || i === 4) pix(g, x - 2, y - 11, GULL, { w: "#f4f2ea", k: "#2a2a2a", g: "#e8a040" });
      k.add(PU + v + 0.05, c);
    });
    const bollard = (u, v) => { const c = k.piece(), g = c.getContext("2d"), [x, y] = st.iso(u, v).map(R); pix(g, x - 2, y - 6, [".xxx.", "xyyyx", ".xyx.", ".xyx.", ".xyx.", "xxxxx"], { x: "#2a2a2e", y: "#4a4a52" }); k.add(u + v + 0.2, c); return [x, y - 5]; };
    const bq1 = bollard(8.2, 2.05), bq2 = bollard(13.6, 2.05); bollard(5.7, 4.6); const bp = bollard(5.7, 12.6);
    // the quay crane: a post and a jib out over the water, a load swinging on its rope above the boat
    { const c = k.piece(), g = c.getContext("2d"), wood = "#6a4a2e", base = [10.4, 0.7];
      P.slab(g, st, base[0] - 0.25, base[1] - 0.25, 0.9, 0.9, 4, { base: shade(S.stone[1], -0.1), top: S.stone[0] });
      P.slab(g, st, base[0], base[1], 0.36, 0.36, 56, { base: wood, top: shade(wood, 0.2), left: (x, y) => (y % 7 === 0 ? shade(wood, -0.2) : wood), right: shade(wood, -0.3) }, 4);
      const top = st.up(st.iso(base[0] + 0.18, base[1] + 0.36), 54), tip = st.up(st.iso(base[0] + 0.18, 3.5), 50), brace = st.up(st.iso(base[0] + 0.18, base[1] + 0.36), 30);
      for (let d = 0; d < 2; d++) { P.line(g, [top[0], top[1] + d], [tip[0], tip[1] + d], d ? shade(wood, -0.3) : shade(wood, 0.1)); P.line(g, [brace[0], brace[1] + d], [(top[0] + tip[0]) / 2, (top[1] + tip[1]) / 2 + d + 1], d ? shade(wood, -0.3) : wood); }
      const [wx, wy] = st.up(st.iso(base[0] + 0.5, base[1] + 0.5), 14).map(R); ellipse(g, wx, wy, 3, 3, (dx, dy) => (dx * dx + dy * dy > 0.5 ? "#3a2a1a" : "#8a7a5a")); g.fillStyle = "#4a4a50"; g.fillRect(wx + 3, wy - 1, 3, 1);
      g.fillStyle = "#3a3434"; g.fillRect(R(tip[0]) - 1, R(tip[1]), 3, 2);
      k.add(base[0] + base[1] + 0.8, c);
      const tx = R(tip[0]), ty = R(tip[1]) + 2;
      k.anims.push((cc, t, still) => {
        const sw = still ? 0.6 : Math.sin(t * 0.7) * 1.6, len = 22, bx = tx + sw, by = ty + len;
        Tv().line(cc, [tx, ty], [bx, by], "#8a7a5a");
        pix(cc, R(bx) - 5, R(by), ["....x.....", "..xxxxxx..", ".xyyxyyyx.", "xyzyyxyzyx", "xyyyxyyyyx", "xyzyyyxyzx", ".xyyxyyyx.", "..xxxxxx.."], { x: "#5a4a32", y: "#8a6a44", z: "#a8885a" });
      });
    }
    // the boats: a fishing boat at the quay, sail furled, unloading; a rowboat by the pier; a smack come in with its sail up
    const boats = [
      { axis: "u", at: 7.8, len: 4.0, c: 3.25, w: 0.62, hg: 6, paint: S.trim, bottom: "#2a3a3a", trim: "#e8e0cc", mast: 34, net: true, moor: bq1, ph: 0, flag: true, name: true },
      { axis: "v", at: 11.4, len: 2.5, c: 6.6, w: 0.42, hg: 4, paint: "#7a5a36", bottom: "#3a2a1e", trim: "#a8885a", oars: true, moor: bp, moorEnd: true, ph: 2.1 },
      { axis: "u", at: 9.6, len: 3.4, c: 7.4, w: 0.55, hg: 5, paint: mix(th.primary, "#e8e0cc", 0.25), bottom: "#3a2a20", trim: "#f0e8d4", mast: 30, sail: true, ph: 4.2 },
      { axis: "u", at: 12.9, len: 2.4, c: 3.2, w: 0.42, hg: 4, paint: "#5a6a7a", bottom: "#2a2a2a", trim: "#c8b890", oars: true, ph: 1.3, moor: bq2, moorEnd: true },
    ];
    for (const b of boats) live(k, (b.axis === "u" ? b.at + b.len + b.c : b.c + b.at + b.len) + b.w, (g, t) => boatArt(g, st, b, t, k));
    if (L.lamps) for (const b of boats) if (b.mast) { const m = b.axis === "u" ? st.iso(b.at + b.len * 0.38, b.c) : st.iso(b.c, b.at + b.len * 0.38); k.lights.push({ x: m[0], y: m[1] - 14, r: 22, k: 0.4 }); }
    // the water alive: glints running, rings where a fish rose, the lamp's light trembling on it by night
    K().lampPost(k, 5.0, 1.6);
    const lampXY = st.iso(5.0, 1.6);
    k.anims.push((c, t, still) => {
      for (let i = 0; i < 70; i++) {
        const u = PU + 0.3 + h01(i, 1) * 10, v = QV + 0.3 + h01(i, 2) * 15;
        if (u + v > 22.4 || u - v > 16) continue;
        const [x, y] = st.iso(u, v), ph = frac((still ? 0.4 : t * 0.45) + h01(i, 3));
        if (ph > 0.7) continue;
        c.fillStyle = ph < 0.35 ? rgba(wc[3], 0.8) : rgba(wc[3], 0.4);
        c.fillRect(R(x + ph * 5), R(y + 5), i % 3 ? 2 : 3, 1);
      }
      for (let i = 0; i < 2; i++) {
        const ph = frac((still ? 0.3 : t * 0.16) + i * 0.5), seed = Math.floor((still ? 0 : t * 0.16) + i * 0.5) * 7 + i, u = 7.6 + h01(seed, 4) * 6, v = 5 + h01(seed, 5) * 7;
        if (u + v > 21.5) continue;
        const [x, y] = st.iso(u, v), rr = ph * 9;
        c.globalAlpha = (1 - ph) * 0.7; ellipse(c, x, y + 5, rr + 1, (rr + 1) / 2, (dx, dy) => (dx * dx + dy * dy > 0.7 ? wc[3] : null)); c.globalAlpha = 1;
      }
      if (L.lamps) for (let j = 0; j < 6; j++) { const w = Math.sin(t * 3 + j) > 0 ? 1 : 0, [x, y] = [lampXY[0] + 30 + w, lampXY[1] + 20 + j * 3]; c.fillStyle = `rgba(255,220,140,${0.45 - j * 0.06})`; c.fillRect(R(x) - 2 + (j % 2), R(y), 4 - (j % 2) * 2, 1); }
    });
    k.water = (u, v) => u > PU && v > QV;
    k.boats = [];
    k.gulls = true;
    const walker = [[2.6, 3.0], [3.6, 2.2]];
    k.anims.push((c, t, still) => { const ph = still ? 0.3 : (Math.sin(t * 0.25) + 1) / 2, [x, y] = st.iso(walker[0][0] + (walker[1][0] - walker[0][0]) * ph, walker[0][1] + (walker[1][1] - walker[0][1]) * ph).map(R), f = still ? 0 : Math.floor(t * 4) % 2;
      pix(c, x - 3, y - 6, Math.cos(t * 0.25) > 0 ? ["...ww.", "..wwkg", "wwwww.", ".www..", f ? "..g.g." : "..gg.."] : [".ww...", "gkww..", ".wwwww", "..www.", f ? ".g.g.." : "..gg.."], { w: "#f4f2ea", k: "#2a2a2a", g: "#e8a040" }); });
    k.spot("act", 4.6, 7.4, 1); k.spot("edge", 5.7, 9.0, 1, "sit"); k.spot("npc", 8.6, 1.2, -1); k.spot("crate", 2.6, 5.2, -1); k.spot("in", 3.0, 14.6, -1);
    k.spot("mate", 4.6, 13.0, -1); k.spot("pet", 5.0, 10.6, -1); k.spot("other", 1.8, 9.6, 1);
    k.crowd([[1.4, 12.6, 1], [11.6, 1.4, -1], [5.2, 4.2, 1]]);
    k.npc = { kind: "sailor" };
  }

  // ======================================================================================================================
  // the stables: board walls on a stone plinth, three stalls under the hayloft (a stranger's horse in one), the open door's daylight
  // ======================================================================================================================
  function stableWall(S) {
    const { shade, mix, h01, frac, M } = K(), plinth = M.stone(S.stone, S.mortar, 4, 0.8), wood = ["#7a5030", "#6e482a", "#845838"], tim = "#4a2c18";
    return (a, h) => {
      if (h < 7) return plinth(a, h);
      if (h < 8) return shade(tim, -0.25);
      const bay = frac(a / 3.6) * 3.6;
      if (bay < 0.32 && a > 0.3) return bay < 0.08 ? shade(tim, 0.2) : bay > 0.25 ? shade(tim, -0.28) : tim;
      if (Math.abs(h - 58) < 2.5) return h > 59.6 ? shade(tim, 0.16) : h < 56.4 ? shade(tim, -0.3) : tim;
      if (Math.floor(a / 3.6) % 2 === 0 && h > 8 && h < 56 && Math.abs((h - 8) - (bay - 0.32) * 15) < 1.4) return shade(tim, 0.08);
      const kk = a * 2.6, col = Math.floor(kk), f = kk - col;
      if (f < 0.1) return "#3a2214";
      let c = wood[Math.floor(h01(col, 5) * 3)];
      if (h01(col, Math.floor(h / 9)) > 0.92) c = shade(c, -0.14);
      if (f > 0.84) c = shade(c, -0.08); else if (f < 0.2) c = shade(c, 0.05);
      if (h < 22) c = mix(c, "#3e2c1c", (22 - h) / 50);
      return c;
    };
  }
  const STALLS = [4.0, 7.6, 11.2, 14.8], FRONT = 2.6;
  function stables(k) {
    const { st, ctx, S, th, r, L } = k, P = Tv(), { shade, mix, pix, h01, frac, F } = K();
    const cob = F.cobble(["#7e7062", "#726658", "#8a7c6c"], "#4a4036"), earth = ["#8a6e4a", "#7e6442", "#94784e"];
    room(k);
    function room(k) {
      K().room(k, stableWall(S), (u, v) => {
        const n = h01(Math.floor(u * 5), Math.floor(v * 5));
        if (v < FRONT && u > STALLS[0]) return n > 0.6 ? "#b8963e" : n > 0.25 ? "#a8883a" : "#9a7a34";
        if (v > 2.8 && v < 6.6) { const c = cob(u, v); return u > 7 && u < 10 ? shade(c, -0.04) : c; }
        if (Math.abs(v - 6.75) < 0.14) return "#3a3026";
        return n > 0.7 ? earth[2] : n > 0.3 ? earth[0] : earth[1];
      }, { beam: "#3a2414", ceiling: "#22160e", skirt: "#3a2616" });
    }
    // straw strewn everywhere, thick in the stalls and by the bales, thin on the cobbles
    for (let i = 0; i < 900; i++) {
      const u = r() * 16, v = r() * 16, inStall = v < FRONT && u > STALLS[0], aisle = v > 2.8 && v < 6.6, nearBale = u < 4 && v > 10.5;
      if (u + v > 21) continue;
      if (r() > (inStall ? 1 : nearBale ? 0.8 : aisle ? 0.18 : 0.45)) continue;
      const [x, y] = st.iso(u, v).map(R), d = Math.floor(r() * 4), col = r() < 0.4 ? "#d8b860" : r() < 0.5 ? "#c4a250" : "#a8883e";
      ctx.fillStyle = col;
      for (let j = 0; j < 3; j++) ctx.fillRect(x + (d === 0 ? j : d === 1 ? -j : d === 2 ? j : 0), y + (d === 2 ? -R(j / 2) : d === 3 ? -j : 0), 1, 1);
    }
    window_(k);
    function window_(k) { K().window_(k, "r", 0.9, 2.7, 28, 42, { frame: "#3a2414", reach: 3 }); }

    // ---- the right wall: the trough and pump by the corner, then the three stalls under the hayloft ----
    { P.slab(ctx, st, 0.5, 0.25, 2.8, 0.8, 9, { base: shade(S.stone[0], -0.05), top: S.stone[0], left: (x, y) => ((x + y) % 7 === 0 ? shade(S.stone[1], -0.2) : S.stone[1]), right: shade(S.stone[1], -0.3) });
      P.fillPoly(ctx, [st.up(st.iso(0.65, 0.38), 9), st.up(st.iso(3.15, 0.38), 9), st.up(st.iso(3.15, 0.92), 9), st.up(st.iso(0.65, 0.92), 9)], (x, y) => ((x * 2 + y * 5) % 13 === 0 ? "#9ac0d8" : (x + y) % 3 ? "#3e6a88" : "#4a7a98"));
      const [x, y] = st.iso(3.55, 0.35).map(R); pix(ctx, x - 3, y - 26, ["xxx....", ".x.....", "..x....", "...xx..", "...xxx.", "..xxxxx", "...xxx.", "...xyx.", "...xyx.", "...xyx.", "...xyx.", "...xyx.", "xxxxyx.", "x..xyx.", "...xyx.", "...xyx.", "...xyx.", "...xyx.", "...xyx.", "...xyx.", "...xyx.", "...xyx.", "..xxxxx", "..xxxxx"], { x: "#2e2e34", y: "#4a4a52" });
      const [bx, by] = st.iso(3.7, 1.4).map(R); pix(ctx, bx - 3, by - 6, [".xxxxx.", "xwwwwwx", "xyyyyyx", "xyzyyyx", ".xyyyx.", "..xxx.."], { x: "#4a3a2a", w: "#7aa0b8", y: "#8a6a44", z: "#a8885a" }); }
    const wood = "#7a5232", tim = "#4a2c18";
    // inside the stalls: a manger on the back wall of each, deep shadow under the loft
    for (let i = 0; i < 3; i++) {
      const u0 = STALLS[i], u1 = STALLS[i + 1];
      P.fillPoly(ctx, st.quad(st.rwall, u0, u1, 7, 62), (x, y) => ((x + y) % 2 ? "rgba(20,10,4,0.35)" : "rgba(20,10,4,0.25)"));
      P.fillPoly(ctx, [st.iso(u0, 0), st.iso(u1, 0), st.iso(u1, FRONT), st.iso(u0, FRONT)], (x, y) => ((x + y) % 2 ? "rgba(20,10,4,0.22)" : "rgba(20,10,4,0.14)"));
      P.slab(ctx, st, u0 + 0.7, 0, 1.6, 0.5, 6, { base: wood, top: (x, y) => ((x * 3 + y) % 5 < 2 ? "#d8b860" : "#b8984a"), left: (x, y) => ((x % 4) < 1 ? shade(wood, -0.3) : shade(wood, -0.1)), right: shade(wood, -0.35) }, 14);
      for (let j = 0; j < 12; j++) { const [x, y] = st.up(st.iso(u0 + 0.8 + j * 0.12, 0.3), 21 + (j % 3)).map(R); dot(ctx, x, y, j % 2 ? "#d8b860" : "#c4a250"); }
    }
    // the stranger's horse in the middle stall: its back above the door, the neck rising to the head (the head nods, live)
    const coat = ["#7a4022", "#a8a4a0", "#3a2e2a", "#9a5226"][Math.floor(r() * 4)], cd = shade(coat, -0.35), cl = shade(coat, 0.22), mane = coat === "#a8a4a0" ? "#e8e4dc" : "#2a1a12";
    const [dx0, dy0] = st.up(st.iso(9.4, FRONT), 15).map(R), hx = dx0 - 7, hy = dy0 - 15;
    { const [x, y] = st.up(st.iso(9.2, 1.1), 22).map(R);
      ellipse(ctx, x, y, 11, 5, (dx, dy) => (dy < -0.5 ? cl : dx > 0.6 || dy > 0.4 ? cd : coat));
      for (let j = 0; j < 3; j++) { ctx.fillStyle = mane; ctx.fillRect(x - 8 + j * 3, y - 5, 2, 1); } }
    // the partitions: boards to the rail, iron bars above, the front posts up to the loft
    for (let i = 0; i < STALLS.length; i++) {
      const u = STALLS[i];
      P.slab(ctx, st, u - 0.08, 0, 0.16, FRONT, 24, { base: wood, top: shade(wood, 0.2), left: shade(wood, -0.1), right: (x, y) => (y % 4 === 0 ? shade(wood, -0.35) : shade(wood, -0.15)) });
      for (let vv = 0.2; vv < FRONT - 0.1; vv += 0.28) P.line(ctx, st.up(st.iso(u, vv), 24), st.up(st.iso(u, vv), 38), "#2e2e34");
      P.line(ctx, st.up(st.iso(u, 0), 38), st.up(st.iso(u, FRONT), 38), "#4a4a52");
    }
    // the half doors: planks, a Z-brace, iron hinges and a latch; a blanket over the first, the third open on its straw and a pitchfork
    for (let i = 0; i < 3; i++) {
      const u0 = STALLS[i] + 0.14, u1 = STALLS[i + 1] - 0.14, dw = u1 - u0;
      if (i === 2) {
        { const [x, y] = st.iso(u0 + 1.4, 1.2).map(R); ellipse(ctx, x, y - 3, 11, 5, (dx, dy) => (dy < -0.2 ? "#d8b860" : dx > 0.4 ? "#9a7a34" : "#c4a250")); P.line(ctx, [x + 2, y - 4], [x + 6, y - 24], "#8a6a3a"); pix(ctx, x + 4, y - 30, ["x.x.x", "x.x.x", "xxxxx", "..x.."], { x: "#6a6a72" }); }
        P.slab(ctx, st, u0 - 0.05, FRONT - 0.15, 0.6, 0.14, 15, { base: wood, left: (x, y) => ((x % 3) < 1 ? shade(wood, -0.3) : wood), right: shade(wood, -0.3) });
        continue;
      }
      P.slab(ctx, st, u0, FRONT - 0.15, dw, 0.14, 15, { base: wood, top: shade(wood, 0.25), right: shade(wood, -0.3), left: (x, y) => {
        const uu = (x + 0.5 - st.OX) / 8 + FRONT - 0.01, s = (uu - u0) / dw, hh = st.iso(uu, FRONT - 0.01)[1] - y - 0.5;
        if (Math.abs(hh - (2 + s * 11)) < 0.9) return shade(wood, 0.12);
        if (Math.abs(hh - 3) < 0.8 || Math.abs(hh - 12) < 0.8) return s < 0.2 || s > 0.8 ? "#3a3a40" : shade(wood, 0.06);
        return frac(uu * 3) < 0.12 ? shade(wood, -0.3) : wood;
      } });
      const [lx, ly] = st.up(st.iso(u1 - 0.25, FRONT), 9).map(R); ctx.fillStyle = "#2a2a30"; ctx.fillRect(lx - 3, ly, 4, 1); ctx.fillStyle = "#8a8a92"; ctx.fillRect(lx - 3, ly, 1, 1);
      if (i === 0) {
        const b0 = u0 + 0.7, b1 = u0 + 2.4;
        P.fillPoly(ctx, [st.up(st.iso(b0, FRONT + 0.02), 16), st.up(st.iso(b1, FRONT + 0.02), 16), st.up(st.iso(b1 + 0.05, FRONT + 0.02), 5), st.up(st.iso((b0 + b1) / 2, FRONT + 0.02), 7), st.up(st.iso(b0 - 0.05, FRONT + 0.02), 5)], (x, y) => {
          const [uu] = st.toUV(x, y + 10); return frac((uu - b0) * 1.2) < 0.12 ? th.accent : (x + y) % 5 === 0 ? shade(th.primary, -0.15) : th.primary;
        });
        P.line(ctx, st.up(st.iso(b0, FRONT + 0.02), 16), st.up(st.iso(b1, FRONT + 0.02), 16), shade(th.primary, 0.25));
      }
    }
    // the stranger's horse's head over its door, nodding, an ear going back now and then
    const HEAD = ["..........dd....", ".........dcd.m..", "........dccdmmm.", ".......dcccmmmmm", "......dcckccmmmd", ".....dccccccmmmd", "....dlccccccccmd", "...dlcccccccccmd", "..dlwcccccccccd.", ".dlwccccdccccccd", "dlwccccd.dcccccd", "dlcccdd...dccccd", "nnncd.....dccccd", "nknnd.....dccccd", ".nnd......dccccd", "..........dccccd"];
    k.anims.push((c, t, still) => {
      const nod = still ? 0 : (K().frac(t / 4.2) < 0.25 ? 1 : 0), ear = !still && K().frac(t / 3.1 + 0.4) < 0.12, pal = { d: cd, c: coat, l: cl, m: mane, k: "#140c08", w: "#f0e6d0", n: shade(coat, -0.5) };
      const rows = ear ? [".........dd.....", "........dcd..m.."].concat(HEAD.slice(2)) : HEAD;
      rows.forEach((row, j) => { const y = hy + j + nod; for (let i = 0; i < row.length; i++) { const col = pal[row[i]]; if (col && (i < 10 || y < dy0)) { c.fillStyle = col; c.fillRect(hx + i, y, 1, 1); } } });
    });
    // the posts to the loft, the loft's edge with hay hanging over it, the ladder up
    for (const u of STALLS) P.slab(ctx, st, u - 0.12, FRONT - 0.12, 0.24, 0.24, 62, { base: tim, top: shade(tim, 0.2), left: shade(tim, 0.12), right: shade(tim, -0.2) });
    const loftHay = (uu, vv) => h01(Math.floor(uu * 0.9), 3) > 0.4 && vv < 2.0 - h01(Math.floor(uu * 3), 4) * 0.8;
    P.slab(ctx, st, 3.86, 0, 12.4, FRONT + 0.14, 3, { base: tim, top: (x, y) => { const [uu, vv] = st.toUV(x, y + 65); if (loftHay(uu, vv)) return h01(x, y) > 0.55 ? "#c4a250" : h01(x + 3, y) > 0.4 ? "#a8883e" : "#8e7232"; return frac(uu * 2.5) < 0.12 ? "#24160c" : (x + y) % 9 === 0 ? "#4a3020" : "#5a3a22"; }, left: (x, y) => (y % 3 === 0 ? shade(tim, 0.2) : tim), right: shade(tim, -0.2) }, 62);
    for (let u = 4.0; u < 16; u += 0.13) { if (!loftHay(u, 1.0)) continue; const [x, y] = st.up(st.iso(u, FRONT + 0.14), 62).map(R), d = 1 + Math.floor(h01(R(u * 30), 2) * 4); for (let j = 0; j < d; j++) dot(ctx, x + (j > 1 ? 1 : 0), y + j, j % 2 ? "#c4a250" : "#d8b860"); }
    { const a = st.iso(3.4, FRONT + 0.5), b = st.up(st.iso(3.7, FRONT + 0.2), 66), a2 = st.iso(3.4, FRONT + 0.9), b2 = st.up(st.iso(3.7, FRONT + 0.6), 66);
      P.line(ctx, a, b, "#6a4a2a"); P.line(ctx, a2, b2, "#6a4a2a");
      for (let j = 1; j < 10; j++) { const s = j / 10, p = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s], q = [a2[0] + (b2[0] - a2[0]) * s, a2[1] + (b2[1] - a2[1]) * s]; P.line(ctx, p, q, "#8a6a3a"); } }
    for (let i = 0; i < 2; i++) { const [x, y] = st.up(st.iso(STALLS[i] + 1.8, FRONT + 0.15), 52).map(R); ctx.fillStyle = "#3a2414"; ctx.fillRect(x - 5, y - 1, 10, 6); ctx.fillStyle = "#c8b48a"; ctx.fillRect(x - 4, y, 8, 4); ctx.fillStyle = "#5a4a3a"; ctx.fillRect(x - 3, y + 1, 5, 1); ctx.fillRect(x - 3, y + 3, 3, 1); }

    // ---- the left wall: the grain bin, the open doorway on the day, the door slid aside, the tack, the hay rack and bales ----
    { P.slab(ctx, st, 0, 0.35, 0.9, 2.3, 16, { base: wood, top: (x, y) => (y % 4 ? shade(wood, 0.2) : shade(wood, 0.05)), left: (x, y) => (x % 6 < 1 ? shade(wood, -0.3) : wood), right: shade(wood, -0.3) });
      for (const [u, v, col] of [[1.15, 2.85, "#c8b48a"]]) { const [x, y] = st.iso(u, v).map(R); pix(ctx, x - 4, y - 11, ["..xx....", ".xyyx...", "xyyyyxx.", "xyzyyyyx", "xyyyyzyx", "xyyyyyyx", "xzyyyyyx", "xyyyyyyx", "xyyyzyyx", ".xyyyyx.", "..xxxx.."], { x: shade(col, -0.45), y: col, z: shade(col, -0.15) }); }
      P.slab(ctx, st, 0, 0.5, 0.35, 2.0, 2, shade(wood, 0.1), 32);
      [["xx..", "xyyx", "xyyx", "xx.."], [".x.", "xxx", "yyy", "y.y"], ["xxxx", "yyyy", "yyyy"]].forEach((rows, i) => { const [x, y] = st.lwall(0.9 + i * 0.6, 34).map(R); pix(ctx, x - 2, y - rows.length, rows, { x: "#5a3a20", y: i === 1 ? "#c8a050" : "#8a6038" }); });
      const [hx2, hy2] = st.lwall(2.5, 46).map(R); pix(ctx, hx2 - 3, hy2, ["x...x", "xy.yx", "xy.yx", ".xyx."], { x: "#6a6a72", y: "#9a9aa2" }); }
    const d0 = 3.4, d1 = 6.6;
    { const on = st.onL, grd = S.ground === "snow" ? ["#eef2f8", "#dfe6f0"] : S.ground === "grass" ? ["#7aa848", "#6a9a3e"] : ["#c8ac78", "#b89c68"];
      P.fillPoly(ctx, st.quad(st.lwall, d0 - 0.3, d1 + 0.3, 0, 44), tim);
      P.fillPoly(ctx, st.quad(st.lwall, d0, d1, 0, 40), (x, y) => {
        const [a, h] = on(x, y);
        if (L.night) { if (h < 12) return h01(x, y) > 0.9 ? "#2a3048" : "#1a2034"; return h01(x * 3, y) > 0.97 ? "#e8e4d0" : mix("#141c34", "#22304e", (h - 12) / 28); }
        const hill = 13 + Math.sin(a * 2.3) * 2 + Math.sin(a * 5.1) * 1;
        if (h > hill) return mix(L.sky[1], L.sky[0], Math.min(1, (h - hill) / 26));
        if (h > 11) return S.snow ? "#d8e2ee" : "#7a9a5a";
        if (frac(a * 1.6) < 0.12 && h > 2 && h < 9) return "#6a5032";
        if (Math.abs(h - 4) < 0.6 || Math.abs(h - 7.5) < 0.6) return "#8a6a42";
        return h01(Math.floor(a * 6), Math.floor(h)) > 0.5 ? grd[0] : grd[1];
      });
      P.slab(ctx, st, 0, d0 - 0.3, 0.3, d1 - d0 + 0.6, 2, shade(S.stone[1], -0.1));
      P.fillPoly(ctx, st.quad(st.lwall, d0 - 0.4, 10.4, 41.5, 43.5), "#2e2a28");
      P.fillPoly(ctx, st.quad(st.lwall, 6.85, 10.1, 0, 39.5), (x, y) => {
        const [a, h] = on(x, y), s = (a - 6.85) / 3.25;
        if (h > 37.5 || h < 1.5 || s < 0.03 || s > 0.97 || Math.abs(h - 20) < 1) return shade(wood, -0.2);
        if (Math.abs(h - (1.5 + s * 36)) < 1.2 || Math.abs(h - (37.5 - s * 36)) < 1.2) return shade(wood, 0.12);
        return frac(a * 2.8) < 0.1 ? shade(wood, -0.32) : h01(Math.floor(a * 2.8), Math.floor(h / 7)) > 0.85 ? shade(wood, -0.08) : shade(wood, -0.02);
      });
      for (const a of [7.4, 9.6]) { const [x, y] = st.lwall(a, 42).map(R); pix(ctx, x - 2, y - 2, [".xx.", "xyyx", ".xx."], { x: "#2e2a28", y: "#6a6a72" }); }
      const [sx, sy] = st.lwall((d0 + d1) / 2, 46).map(R); pix(ctx, sx - 3, sy, ["x...x", "xy.yx", "xy.yx", ".xyx."], { x: "#6a6a72", y: "#b8b8c0" }); }
    { const [x, y] = st.lwall(2.9, 30).map(R); pix(ctx, x - 2, y - 3, ["kkk..", "..k..", ".kkk.", "kyyyk", "kyyyk", "kyyyk", ".kkk."], { k: "#2a2420", y: L.lamps ? "#ffe090" : "#c8c0a8" });
      if (L.lamps) { k.lights.push({ x, y: y + 2, r: 34, k: 0.5 }); k.anims.push((c, t) => K().glow(c, x, y + 1, 7, "#ffd070", 0.4 + Math.sin(t * 9) * 0.05)); } }
    // the tack: saddles on their racks over saddle cloths in the town's colours, bridles, a collar, a coil of rope
    const SADDLE = ["..ddd..........", ".dllldd.....dd.", ".dlccccddddccd.", "..dccccccccccd.", "..bbbbbbbbbbbb.", ".bbaabbbbbbaabb", ".bbbbbffffbbbb.", "......fffff....", "......fffff....", ".......dsd.....", ".......mmm....."];
    for (const v of [10.6, 12.3]) {
      P.slab(ctx, st, 0, v - 0.1, 0.5, 0.2, 2, "#5a3a20", 18);
      const [x, y] = st.lwall(v, 26).map(R); pix(ctx, x - 7, y, SADDLE.map((s) => s.split("").reverse().join("")), { d: "#3a1c0c", l: "#b0683a", c: "#7e4020", b: th.primary, a: th.accent, f: "#6a3418", s: "#2a1a10", m: "#a0a0a8" });
    }
    for (const [v, h] of [[10.4, 44], [11.2, 42], [12.0, 44], [12.9, 42]]) { const [x, y] = st.lwall(v, h).map(R); ctx.fillStyle = "#2a1a10"; ctx.fillRect(x, y - 1, 1, 2); pix(ctx, x - 2, y + 1, [".dd.", "d..d", "d..d", "d..d", ".dd.", ".d.d", "mddm", "m..m"], { d: "#4a2410", m: "#9a9aa2" }); }
    { const [x, y] = st.lwall(11.7, 58).map(R); pix(ctx, x - 4, y, ["..dddd..", ".dcccld.", "dcd..dcd", "dc....cd", "dc....cd", "dc....cd", "dcd..dcd", ".dccccd.", "..dmmd.."], { d: "#3a1c0c", c: "#7e4020", l: "#a8603a", m: "#c8a040" }); }
    { const [x, y] = st.lwall(13.0, 58).map(R); pix(ctx, x - 3, y, [".rrrr.", "rRrrRr", "r.RR.r", "rRrrRr", ".rrrr.", "..rr..", "..r..."], { r: "#c0a878", R: "#8a744a" }); }
    // the hay rack on the wall, bales stacked under it, a cat asleep on top; the loose bale to sit on
    { P.fillPoly(ctx, st.quad(st.lwall, 13.6, 15.8, 28, 44), (x, y) => { const [a, h] = st.onL(x, y); return frac(a * 3) < 0.15 ? "#5a3a20" : h > 41 || h < 30 ? "#6a4428" : h01(x, y) > 0.5 ? "#d8b860" : "#b8984a"; });
      bale(ctx, st, 0.1, 13.4, 1.3, 0.8, 8, 0); bale(ctx, st, 0.1, 14.3, 1.3, 0.8, 8, 0); bale(ctx, st, 0.15, 13.8, 1.2, 0.8, 8, 8);
      bale(ctx, st, 2.0, 11.8, 1.1, 0.7, 8, 0);
      const [cx, cy] = st.up(st.iso(0.75, 14.2), 16).map(R), cat = ["#8a8a92", "#c8803a", "#3a3438"][Math.floor(r() * 3)];
      pix(ctx, cx - 5, cy - 5, ["..ggg.....", ".gkgg.gg..", "gggggggggg", "ggggggggGg", ".GGGGGGGG."], { g: cat, G: shade(cat, -0.3), k: "#1a1a1a" });
      k.anims.push((c, t, still) => { const f = !still && K().frac(t / 5) < 0.15 ? 1 : 0; pix(c, cx + 5, cy - 3 - f, f ? ["g.", ".g"] : ["gg"], { g: shade(cat, -0.15) }); });
    }
    // the light from the doorway through the air, dust turning in it; the floor's patch of day
    if (!L.night) {
      const reach = 6.2;
      P.fillPoly(ctx, [st.iso(0.1, d0), st.iso(0.1, d1), st.iso(reach, d1 + reach * 0.5), st.iso(reach, d0 + reach * 0.5)], (x, y) => ((x + y) % 2 ? "rgba(255,244,210,0.16)" : "rgba(255,244,210,0.09)"));
      shaft(k, [st.lwall(d0, 40), st.lwall(d1, 40)], [st.iso(reach, d1 + reach * 0.5), st.iso(reach, d0 + reach * 0.5)], "#fff4d8", 22, 0.07);
    }
    // two hens scratching in the straw
    const HEN = [["..r.....", ".wwr....", "ywkw..w.", ".wwwwwww", "..wWwwww", "...WWWW.", "...y..y."], ["........", "....w...", ".r.wwwww", "wwwwwwww", "ykwWwwww", "...WWWW.", "...y..y."]];
    const hens = [[1.9, 8.6, "#f0ece0"], [12.6, 6.1, "#a8683a"]];
    k.anims.push((c, t, still) => hens.forEach(([u, v, col], i) => {
      const ph = still ? 0.3 : K().frac(t * 0.3 + i * 0.5), step = still ? 0 : Math.floor(t * 0.3 + i * 0.5), face = (step + i) % 2;
      const [x, y] = st.iso(u + Math.sin(step * 1.7 + i) * 0.4, v + Math.cos(step * 2.3) * 0.3).map(R), fr = HEN[ph > 0.4 && ph < 0.7 ? 1 : 0];
      pix(c, x - 4, y - 7, face ? fr.map((s) => s.split("").reverse().join("")) : fr, { r: "#d83a2a", w: col, W: shade(col, -0.2), k: "#141010", y: "#e8a030" });
    }));
    k.lamps.push([6.4, 6.4, 64]);
    k.spot("mount", 5.25, 8.75, 1); k.horse = [5.25, 8.75];
    k.spot("act", 7.5, 7.5, -1); k.spot("stall", 8.6, 3.6, 1); k.spot("bale", 3.25, 12.6, -1, "sit"); k.spot("npc", 13.4, 4.4, -1); k.spot("trough", 2.0, 1.9, 1);
    k.spot("door", 1.0, 5.0, -1); k.spot("in", 0.5, 5.0, 1); k.spot("mate", 11.2, 7.6, -1); k.spot("pet", 8.6, 9.4, -1); k.spot("other", 4.6, 11.4, 1);
    k.crowd([]);
    k.npc = { kind: "stablehand" };
  }

  // ======================================================================================================================
  // the guild hall: panelled walls, the bounty board crowded with notices and wanted faces, the clerk's counter, the island's map,
  // the fire with a monster's head over it, adventurers at a table, their gear by the window
  // ======================================================================================================================
  function guildWall(S) {
    const { shade, mix, h01, frac, M } = K(), stone = S.wall === "stone" || S.wall === "brick" ? M.stone(S.stone.map((c) => shade(c, 0.1)), shade(S.mortar, 0.1), 7, 1.4) : null;
    const wash = [mix(S.plaster[0], "#f0e6d0", 0.4), mix(S.plaster[1], "#e2d6bc", 0.4)], tim = "#4a2e1a", oak = "#6e4628";
    return (a, h) => {
      if (h < 27) {
        if (h < 2.5) return shade(tim, -0.3);
        if (h > 25) return h > 26.2 ? shade(oak, 0.3) : shade(oak, -0.2);
        const pw = 1.6, f = frac(a / pw) * pw;
        if (f < 0.16 || h < 4.5 || h > 22.5) return f < 0.05 || h > 24.3 ? shade(oak, 0.12) : shade(oak, -0.22);
        if (f < 0.26 || h > 21) return shade(oak, 0.16);
        if (f > pw - 0.1 || h < 6) return shade(oak, -0.38);
        return h01(Math.floor(a * 12), Math.floor(h / 4)) > 0.85 ? shade(oak, -0.08) : oak;
      }
      if (frac(a / 4) * 4 < 0.3) return frac(a / 4) * 4 < 0.08 ? shade(tim, 0.2) : tim;
      if (Math.abs(h - 76) < 2.5) return h > 77.6 ? shade(tim, 0.2) : tim;
      if (stone) return stone(a, h);
      const n = h01(Math.floor(a * 7), Math.floor(h / 4));
      let c = n > 0.93 ? shade(wash[0], -0.05) : n > 0.55 ? wash[1] : wash[0];
      if (h < 36) c = mix(c, "#b8a888", (36 - h) / 40);
      return c;
    };
  }
  // an adventurer seated across a table: hood, helm or hair, a face, a coat with a strap across it and a hand on the table
  const SEAT = ["....hhhh....", "...hhhhhh...", "..hhhhhhhh..", "..hsssssh...", "..hseseshh..", "..hsssssh...", "...ssmss....", "....sss.....", "..lcccccd...", ".lccbcccdd..", "lcccbbcccdd.", "lccccbbcccd.", "lcccccbbccd.", "lccccccbbcd.", "ss.cccccc.ss"];
  function sitter(k, u, v, look) {
    const { st } = k, { shade, pix } = K(), c = k.piece(), g = c.getContext("2d"), [x, y] = st.iso(u, v);
    const rows = look.helm ? ["....mmmm....", "...mmmmmm...", "..mmmmmmmm..", "..mssssssm..", "..msesesm...", "..mssssshh..", ...SEAT.slice(6)] : SEAT;
    pix(g, R(x) - 6, R(y) - 22, rows, { h: look.hood, s: look.skin, e: shade(look.skin, -0.55), m: look.helm ? "#9a9ea6" : shade(look.skin, -0.3), c: look.coat, l: shade(look.coat, 0.18), d: shade(look.coat, -0.3), b: "#4a2e1a" });
    k.add(u + v + 0.2, c);
  }
  // one of the town's people seated on a bench or behind a table, drawn the way the acts draw a sitter (TownActs.folk), the old sprite if the acts aren't loaded
  function seatFolk(k, u, v, face, kind, seed, key, look) {
    let fig = null;
    try { fig = root.TownActs && TownActs.folk ? TownActs.folk(kind, seed) : null; } catch (e) { fig = null; }
    if (!fig || !fig.f || !fig.f.img) return sitter(k, u, v, look);
    const c = k.piece(), g = c.getContext("2d"), [x, y] = k.st.iso(u, v).map(R), img = fig.f.img[face > 0 ? 1 : "-1"], w = img.width, hh = img.height, cut = hh - 11;
    g.drawImage(img, 0, 0, w, cut, x - (w >> 1), y - cut - 6, w, cut);
    g.drawImage(img, 0, hh - 4, w, 3, x - (w >> 1) + (face > 0 ? 2 : -2), y - 7, w, 3);
    k.add(key != null ? key : u + v + 0.3, c);
  }
  function face(g, x, y, f) {
    K().pix(g, x, y, [".hhh.", f.bald ? "hsssh" : "hhhhh", "sksks".replace(/k/g, (m, i) => (f.patch && i === 3 ? "p" : "k")), "sssss", f.beard ? "bbbbb" : ".sms.", f.beard ? ".bbb." : ".sss."],
      { h: f.hair, s: f.skin, k: "#1a1210", p: "#1a1210", m: "#8a4a3a", b: f.hair });
  }
  function guild(k) {
    const { st, ctx, S, th, r, L } = k, P = Tv(), { shade, mix, pix, h01, frac } = K(), oak = "#6e4628";
    K().room(k, guildWall(S), (u, v) => {
      const row = Math.floor(v * 1.6), f = v * 1.6 - row, off = h01(row, 3) * 4, run = (u + off) / 4, end = frac(run);
      if (f < 0.08 || end < 0.015) return "#3a2414";
      const cols = ["#8a6040", "#7e5838", "#946a46"];
      let c = cols[Math.floor(h01(row, Math.floor(run)) * 3)];
      if (f > 0.85) c = shade(c, -0.08); else if (f < 0.22) c = shade(c, 0.07);
      if (h01(Math.floor(u * 6), row) > 0.96) c = shade(c, -0.12);
      return c;
    }, { beam: "#2e1c10", ceiling: "#20140c", skirt: "#2e1c10" });
    // the rug in the guild's colours
    { const u0 = 4.6, u1 = 10.6, v0 = 4.4, v1 = 9.6;
      P.fillPoly(ctx, [st.iso(u0, v0), st.iso(u1, v0), st.iso(u1, v1), st.iso(u0, v1)], (x, y) => {
        const [u, v] = st.toUV(x, y), e = Math.min(u - u0, u1 - u, v - v0, v1 - v);
        if (e < 0.12) return (x + y) % 2 ? shade(th.accent, -0.2) : th.accent;
        if (e < 0.4) return (Math.floor(u * 3) + Math.floor(v * 3)) % 2 ? shade(th.primary, -0.35) : shade(th.primary, -0.2);
        if (e < 0.48) return th.accent;
        const d = Math.abs(u - (u0 + u1) / 2) * 0.7 + Math.abs(v - (v0 + v1) / 2);
        return d < 0.9 ? (d < 0.5 ? th.accent : shade(th.primary, 0.15)) : (frac(d * 1.5) < 0.12 ? shade(th.accent, -0.3) : th.primary);
      }); }

    // ---- the right wall: banners by the corner, the bounty board, the pigeonholes behind the counter ----
    const banner = (side, a0, a1, h0, h1) => {
      const wall = side === "l" ? st.lwall : st.rwall, on = side === "l" ? st.onL : st.onR, m = (a0 + a1) / 2;
      P.fillPoly(ctx, [wall(a0, h1), wall(a1, h1), wall(a1, h0 + 6), wall(m, h0), wall(a0, h0 + 6)], (x, y) => {
        const [a, h] = on(x, y);
        if (a - a0 < 0.08 || a1 - a < 0.08) return shade(th.accent, -0.15);
        if (Math.abs(a - m) < 0.22 && Math.abs(h - (h0 + h1) / 2 - 2) < 5) return Math.abs(a - m) < 0.1 || Math.abs(h - (h0 + h1) / 2 - 2) < 1 ? th.accent : shade(th.accent, -0.25);
        return frac(a * 6) < 0.1 ? shade(th.primary, -0.18) : th.primary;
      });
      P.fillPoly(ctx, st.quad(wall, a0 - 0.15, a1 + 0.15, h1, h1 + 1.5), "#3a2a1a");
    };
    banner("r", 0.7, 1.6, 16, 46); banner("r", 2.6, 3.5, 18, 54);
    { const wall = st.rwall, on = st.onR, a0 = 4.6, a1 = 10.6, h0 = 14, h1 = 58;
      P.fillPoly(ctx, st.quad(wall, a0 - 0.25, a1 + 0.25, h0 - 3, h1 + 3), "#3a2414");
      P.fillPoly(ctx, st.quad(wall, a0 - 0.1, a1 + 0.1, h0 - 1.5, h1 + 1.5), shade(oak, 0.15));
      P.fillPoly(ctx, st.quad(wall, a0, a1, h0, h1), (x, y) => ((x * 3 + y * 7) % 5 < 2 ? "#b48a52" : (x + y * 2) % 7 === 0 ? "#9a7444" : "#a87e48"));
      // the header: crossed swords over a purse, in brass
      const [hx, hy] = wall((a0 + a1) / 2, h1 + 2).map(R);
      P.fillPoly(ctx, st.quad(wall, 6.6, 8.6, h1 + 1, h1 + 7), "#3a2414");
      pix(ctx, hx - 5, hy - 6, ["x.......x", ".x.....x.", "..x.y.x..", "...yyy...", "..xyyyx..", ".x.yyy.x."], { x: "#d8dce4", y: "#e8b84a" });
      const papers = [];
      for (let i = 0; i < 30; i++) {
        const w = 0.55 + r() * 0.35, hh = 8 + r() * 6, a = a0 + 0.1 + r() * (a1 - a0 - w - 0.2), h = h0 + 1 + r() * (h1 - h0 - hh - 2);
        papers.push({ a, w, h, hh, kind: i % 5 === 0 ? "wanted" : i % 7 === 3 ? "beast" : i % 9 === 5 ? "seal" : "text", col: ["#f4ecd8", "#e8dcc0", "#f0e0b0", "#e4d4b4", "#f8f0dc"][i % 5] });
      }
      papers.sort((p, q) => p.kind === "wanted" ? 1 : q.kind === "wanted" ? -1 : 0);
      const SKIN = ["#f0c8a0", "#e0b088", "#c48a5e", "#9a6440"], HAIR = ["#3a2a1a", "#6a4020", "#c8a050", "#9a9aa6", "#2a2228", "#a04a20"];
      for (const p of papers) {
        const big = p.kind === "wanted", w = big ? 0.95 : p.w, hh = big ? 14 : p.hh;
        P.fillPoly(ctx, st.quad(wall, p.a + 0.05, p.a + w + 0.05, p.h - 1, p.h + hh - 1), "rgba(40,24,10,0.35)");
        P.fillPoly(ctx, st.quad(wall, p.a, p.a + w, p.h, p.h + hh), (x, y) => { const [a, h] = on(x, y); return a - p.a < 0.06 || h > p.h + hh - 0.8 ? shade(p.col, 0.06) : h - p.h < 1 && p.a + w - a < 0.15 ? shade(p.col, -0.25) : p.col; });
        const [cx, cy] = wall(p.a + w / 2, p.h + hh).map(R);
        if (big) {
          P.line(ctx, wall(p.a + 0.1, p.h + hh - 2), wall(p.a + w - 0.1, p.h + hh - 2), "#3a2a1a");
          face(ctx, cx - 2, cy + 4, { skin: SKIN[Math.floor(r() * 4)], hair: HAIR[Math.floor(r() * 6)], beard: r() < 0.4, patch: r() < 0.3, bald: r() < 0.2 });
          P.line(ctx, wall(p.a + 0.15, p.h + 2.5), wall(p.a + w - 0.15, p.h + 2.5), "#b83a2a");
        } else if (p.kind === "beast") {
          pix(ctx, cx - 3, cy + 3, [["x...x", "xx.xx", "xxxxx", ".x.x.", ".xxx."], [".xxx.", "xx.xx", "xxxxx", ".x.x.", "x.x.x"], ["x.x.x", ".xxx.", "xxxxx", ".xxx.", "x.x.x"]][Math.floor(r() * 3)], { x: "#8a2a1a" });
          P.line(ctx, wall(p.a + 0.1, p.h + 2), wall(p.a + w - 0.1, p.h + 2), "#7a6a4a");
        } else {
          for (let j = 0; j < Math.floor(p.hh / 2.5) - 1; j++) P.line(ctx, wall(p.a + 0.08, p.h + hh - 3 - j * 2.2), wall(p.a + w * (0.5 + h01(j, R(p.a * 10)) * 0.4), p.h + hh - 3 - j * 2.2), "#9a8a6a");
          if (p.kind === "seal") { const [sx, sy] = wall(p.a + w * 0.7, p.h + 2).map(R); pix(ctx, sx - 1, sy - 2, [".x.", "xxx", ".x."], { x: "#a8281e" }); }
        }
        dot(ctx, cx, cy + 1, r() < 0.7 ? "#c83a2a" : "#e8c050");
      }
    }
    { const wall = st.rwall, on = st.onR, a0 = 11.2, a1 = 15.6, h0 = 20, h1 = 58;
      P.fillPoly(ctx, st.quad(wall, a0 - 0.15, a1 + 0.15, h0 - 2, h1 + 2), "#3a2414");
      P.fillPoly(ctx, st.quad(wall, a0, a1, h0, h1), (x, y) => { const [a, h] = on(x, y); return frac((a - a0) / 0.55) < 0.14 || frac((h - h0) / 9.5) < 0.14 ? oak : "#1e120a"; });
      for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) {
        if (h01(i, j) < 0.15) continue;
        const [x, y] = wall(a0 + 0.3 + i * 0.55, h0 + 1.4 + j * 9.5).map(R), kind = Math.floor(h01(i + 3, j) * 3);
        if (kind === 0) pix(ctx, x - 2, y - 4, [".ww.", "wllw", "wwww", "wllw"], { w: "#f0e8d4", l: "#c8bc9a" });
        else if (kind === 1) pix(ctx, x - 2, y - 5, ["abcab", "abcab", "abcab", "abcab", "abcab"], { a: "#6a2a1e", b: "#2e4a6a", c: "#c8a050" });
        else pix(ctx, x - 2, y - 3, ["wwww", "wwww", "llll"], { w: "#e8dcc0", l: "#b8a888" });
      }
      banner("r", 12.4, 13.3, 62, 90); banner("r", 14.4, 15.3, 62, 94);
    }

    // ---- the left wall: the island's map, the window over the gear, the hearth with its trophy, the door ----
    { const wall = st.lwall, on = st.onL, a0 = 1.6, a1 = 6.2, h0 = 18, h1 = 50, cx = (a0 + a1) / 2, cy = (h0 + h1) / 2;
      P.fillPoly(ctx, st.quad(wall, a0 - 0.25, a1 + 0.25, h0 - 3, h1 + 3), "#3a2414");
      P.fillPoly(ctx, st.quad(wall, a0 - 0.1, a1 + 0.1, h0 - 1.5, h1 + 1.5), "#c8a040");
      const land = (a, h) => Math.hypot((a - cx) * 7.2, (h - cy) * 1.05) < 11.5 + Math.sin(a * 5.3) * 1.8 + Math.sin(h * 0.55) * 1.6 + Math.cos(a * 2.1 + h * 0.3) * 1.2;
      P.fillPoly(ctx, st.quad(wall, a0, a1, h0, h1), (x, y) => {
        const [a, h] = on(x, y);
        if (a - a0 < 0.12 || a1 - a < 0.12 || h - h0 < 1.2 || h1 - h < 1.2) return "#c8b07a";
        if (!land(a, h)) { const coast = land(a + 0.1, h) || land(a - 0.1, h) || land(a, h + 1) || land(a, h - 1); return coast ? "#e8dcb4" : (x + y * 2) % 9 === 0 ? "#9ab8b0" : "#b8c8b4"; }
        const d = Math.hypot((a - cx) * 7.2, (h - cy) * 1.05), n = h01(Math.floor(a * 6), Math.floor(h / 2.5));
        if (d < 4 && n > 0.45) return n > 0.75 ? "#8a7458" : "#a08a68";
        return n > 0.72 ? "#6a8a4a" : "#d8c896";
      });
      for (const [da, dh] of [[-1.2, 6], [0.9, 7], [1.5, -3], [-0.6, -7], [-1.7, -1], [0.3, 1], [1.0, -8], [-0.2, 9]]) { const [x, y] = wall(cx + da, cy + dh).map(R); dot(ctx, x, y, "#b82a1e"); dot(ctx, x, y - 1, "#e8c050"); }
      for (let s = 0; s < 1; s += 0.08) { const [x, y] = wall(cx - 1.2 + s * 2.7, cy + 6 - s * 9).map(R); if (R(s * 12) % 2) dot(ctx, x, y, "#6a4a2a"); }
      const [rx, ry] = wall(a1 - 0.45, h0 + 4).map(R); pix(ctx, rx - 2, ry - 2, ["..x..", ".x.x.", "x.y.x", ".x.x.", "..x.."], { x: "#5a3a20", y: "#b82a1e" }); }
    K().window_(k, "l", 7.1, 8.4, 30, 54, { frame: "#3a2414", reach: 4, arch: true });
    { for (const [v, kind] of [[6.9, "cloak"], [7.6, "shield"], [8.4, "rope"]]) {
        const [x, y] = st.lwall(v, 27).map(R); ctx.fillStyle = "#2a1a10"; ctx.fillRect(x, y - 1, 2, 2);
        if (kind === "cloak") pix(ctx, x - 3, y + 1, [".cccc.", "cccdcc", "ccdccc", "cccdcc", "ccdccc", "cc.ccc", "c...cc"], { c: "#4a5a3a", d: "#3a4a2c" });
        else if (kind === "shield") ellipse(ctx, x + 1, y + 6, 4.5, 5, (dx, dy) => { const d = Math.hypot(dx, dy); return d > 0.8 ? "#5a5a62" : d < 0.25 ? "#c8c8d0" : dy < 0 === dx < 0 ? th.primary : shade(th.accent, -0.1); });
        else pix(ctx, x - 2, y + 1, [".rr.", "rRRr", "r..r", "rRRr", ".rr."], { r: "#c0a878", R: "#8a744a" });
      }
      const [sx, sy] = st.lwall(8.9, 30).map(R); P.line(ctx, [sx, sy], [sx - 1, sy + 26], "#7a5632"); pix(ctx, sx - 1, sy - 4, [".x.", "xyx", "xyx", ".x."], { x: "#6a6e76", y: "#c8ccd4" }); }
    const hv0 = 9.8, hv1 = 12.6;
    P.hearth(ctx, st, r, hv0, hv1, 96, { stone: S.stone, mortar: S.mortar, mantel: "#4a2e1a" });
    k.fire = [hv0, hv1];
    { const TROPHY = ["..............hh........", "............hhh.........", "..........hhh..hh.......", ".........kkkkhhh........", ".......kklllggkk........", ".....kklllgggggGk.......", "...kklllgggeggGGGk......", ".kklllggggggggGGGGk.....", "kllgggggggggGGGGGGk.....", "ktttktttkGGGGGGGGk......", "kmmmmmmmmkGGGGGGk.......", "ktttktttkGGGGGk.........", ".kgggggggGGGGk..........", "..kkkkkkkkkkk..........."];
      const [x, y] = st.lwall((hv0 + hv1) / 2, 62).map(R);
      ellipse(ctx, x + 2, y + 8, 9, 11, (dx, dy) => { const d = Math.hypot(dx, dy); return d > 0.85 ? "#3a2414" : dx + dy < -0.3 ? "#8a5a34" : "#6e4628"; });
      pix(ctx, x - 12, y + 1, TROPHY.map((s) => s.split("").reverse().join("")), { h: "#e4d8b8", k: "#1e2a18", l: "#8aaa6a", g: "#5a7a4a", G: "#3e5a34", e: "#f0a020", t: "#f4f0e0", m: "#5a1a14" });
      for (const [v, kind] of [[hv0 - 0.1, "cs"], [hv0 + 0.7, "mug"], [hv1 - 0.6, "sk"], [hv1 + 0.1, "cs"]]) {
        const [mx, my] = st.lwall(v, 32).map(R);
        if (kind === "cs") { pix(ctx, mx - 1, my - 5, [".y.", ".y.", ".y.", "yyy"], { y: "#c8a040" }); k.candles.push([mx, my - 5]); }
        else if (kind === "mug") pix(ctx, mx - 2, my - 5, ["xxxx.", "xyyxx", "xyyx.x", "xyyxx", "xxxx."], { x: "#5a5a62", y: "#8a8a92" });
        else pix(ctx, mx - 2, my - 5, [".www.", "wkwkw", "wwwww", ".w.w."], { w: "#e8e0cc", k: "#2a2420" });
      }
      for (const [v, rows] of [[hv0 - 0.7, ["..xx", "..x.", "..x.", ".xx.", "x.x.", "..x.", "..x.", "..x.", ".xxx"]], [hv1 + 0.7, ["x..x", ".xx.", "..x.", "..x.", "..x.", "..x.", "..x.", "..x.", ".xxx"]]]) { const [x2, y2] = st.lwall(v, 12).map(R); pix(ctx, x2 - 2, y2, rows, { x: "#3a3a40" }); } }
    { const wall = st.lwall, on = st.onL, a0 = 13.6, a1 = 15.4;
      P.fillPoly(ctx, st.quad(wall, a0 - 0.2, a1 + 0.2, 0, 38), "#2e1c10");
      P.fillPoly(ctx, st.quad(wall, a0, a1, 0, 36), (x, y) => { const [a, h] = on(x, y); if (Math.abs(h - 8) < 0.8 || Math.abs(h - 28) < 0.8) return "#2e2a28"; if ((Math.floor(a * 6) + Math.floor(h / 4)) % 5 === 0 && frac(a * 6) < 0.3 && h % 4 < 1) return "#8a8a92"; return frac(a * 3) < 0.1 ? "#3e2614" : "#5e3a20"; });
      const [x, y] = wall(a0 + 0.3, 17).map(R); pix(ctx, x - 1, y - 1, [".x.", "x.x", ".x."], { x: "#c8a040" });
      torch(k, "l", 13.1, 30); }
    // by the door: a spear and a round shield leaning on the wall, a pack dropped at their foot
    { const c = k.piece(), g = c.getContext("2d"), [x, y] = st.iso(0.25, 13.3).map(R);
      P.line(g, [x - 2, y], [x + 1, y - 34], "#7a5632"); pix(g, x, y - 38, [".x.", "xyx", "xyx", ".x."], { x: "#6a6e76", y: "#c8ccd4" });
      ellipse(g, x + 3, y - 7, 5, 6, (dx, dy) => { const d = Math.hypot(dx, dy); return d > 0.82 ? "#4a3420" : d < 0.25 ? "#c8c8d0" : dy < 0 ? shade(th.accent, -0.1) : th.primary; });
      const [px, py] = st.iso(0.7, 13.2).map(R); pix(g, px - 4, py - 7, ["..xxxx...", ".xyyyyx..", "xyyzyyyx.", "xyyyyyyxx", "xyyyyyyxr", ".xxxxxxx."], { x: "#4a3018", y: "#7a5a32", z: "#9a7a4a", r: "#5a3a20" });
      k.add(0.9 + 13.3, c); }
    // the bench under the window, packs and a bedroll on it, a pair of spears against it
    { const c = k.piece(), g = c.getContext("2d"), wood = "#6a4428";
      P.legs(g, st, 0.25, 6.8, 0.48, 2.0, 5, shade(wood, -0.25)); P.slab(g, st, 0.25, 6.8, 0.48, 2.0, 1.5, { base: wood, top: shade(wood, 0.18), left: shade(wood, -0.05), right: shade(wood, -0.3) }, 5);
      const [px, py] = st.up(st.iso(0.5, 7.3), 7).map(R); pix(g, px - 4, py - 8, ["..xxxx...", ".xyyyyx..", "xyyzyyyx.", "xyyyyyyxx", "xyyyyyyxr", "xyyzyyyxr", ".xxxxxxx."], { x: "#4a3018", y: "#8a6a3e", z: "#a8885a", r: "#5a3a20" });
      const [bx, by] = st.up(st.iso(0.5, 8.3), 7).map(R); pix(g, bx - 4, by - 4, [".bbbbbb.", "bBbbbbBb", "bbBbbBbb", ".bbbbbb."], { b: "#6a7a4a", B: "#4a5a34" });
      k.add(0.73 + 8.8 + 0.1, c); }
    // the table by the fire: three adventurers over a map, their mugs and a helm, a sword against the end
    { const wood = "#7a5232", u0 = 2.6, v0 = 8.8, du = 1.0, dv = 3.2, tw = k.town + ":guild:";
      seatFolk(k, 2.15, 9.5, 1, "guard", tw + 1, null, { hood: "#3a2a1a", skin: "#e0b088", coat: "#5a4a6a", helm: true });
      seatFolk(k, 2.15, 11.3, 1, "local", tw + 2, null, { hood: "#4a6a3a", skin: "#9a6440", coat: "#4a6a3a" });
      { const c = k.piece(), g = c.getContext("2d"); P.legs(g, st, 3.85, 9.3, 0.45, 2.2, 5, shade(wood, -0.35)); P.slab(g, st, 3.85, 9.3, 0.45, 2.2, 1.5, { base: wood, top: shade(wood, 0.14), left: shade(wood, -0.1), right: shade(wood, -0.35) }, 4); k.add(4.3 + 11.5, c); }
      seatFolk(k, 4.15, 10.3, -1, "sailor", tw + 3, 15.95, { hood: "#c8a050", skin: "#f0c8a0", coat: "#8a3a2a" });
      const c = k.piece(), g = c.getContext("2d");
      floorShadow(k, u0, v0, du + 0.2, dv + 0.3, 0.2);
      P.table(g, st, u0, v0, du, dv, 10, wood);
      const at = (u, v) => st.up(st.iso(u, v), 10).map(R);
      { const [x, y] = at(3.1, 10.3); pix(g, x - 6, y - 3, ["pppppppppppp", "pggppppbbppp", "ppggggpbbppp", "pppppppppgpp", "pppppppppppp"], { p: "#e8dcb4", g: "#7a9a5a", b: "#9ab8c8" }); }
      for (const [u, v] of [[3.0, 9.4], [3.2, 11.2], [2.9, 10.9]]) { const [x, y] = at(u, v); pix(g, x - 1, y - 4, ["xxx.", "xyyx", "xyyx", "xxx."], { x: "#5a3a1e", y: "#8a6a3a" }); dot(g, x - 1, y - 5, "#f4ecd8"); dot(g, x, y - 5, "#f4ecd8"); }
      { const [x, y] = at(3.3, 9.8); pix(g, x - 3, y - 4, ["..xxx..", ".xyyyx.", "xyyzyyx", "xxxxxxx"], { x: "#4a4a52", y: "#8a8e96", z: "#c8ccd4" }); }
      const [sx, sy] = st.iso(3.7, v0 + dv + 0.1).map(R); P.line(g, [sx, sy], [sx + 3, sy - 16], "#b8bcc4"); P.line(g, [sx + 1, sy], [sx + 4, sy - 16], "#7a7e86"); g.fillStyle = "#5a3a20"; g.fillRect(sx + 2, sy - 20, 2, 4); g.fillStyle = "#c8a040"; g.fillRect(sx, sy - 16, 6, 1);
      k.add(u0 + du + v0 + dv, c);
      if (L.lamps) k.candles.push(at(3.3, 10.8)); }
    // a suit of armour on its stand in the far corner; a tall iron candle stand lighting the board
    { const c = k.piece(), g = c.getContext("2d"), [x, y] = st.iso(0.9, 0.9).map(R);
      pix(g, x - 6, y - 30, ["....xxxx....", "...xyyyyx...", "...xyzzyx...", "...xykkyx...", "....xyyx....", "..xxyyyyxx..", ".xyyyzyyyyx.", "xyyyyzyyyyyx", "xyx.yzyy.xyx", "xyx.yzyy.xyx", "xyx.yyyy.xyx", ".x..xyyx..x.", "....xbbx....", "...xyyyyx...", "...xy..yx...", "...xy..yx...", "...xy..yx...", "...xy..yx...", "...xy..yx...", "..xxy..yxx..", "......w.....", "......w.....", "......w.....", "......w.....", "......w.....", "......w.....", "......w.....", "......w.....", "....wwwww...", "...wwwwwww.."], { x: "#3a3c44", y: "#9aa0aa", z: "#d8dce4", k: "#141418", b: "#6a3a1e", w: "#5a3a20" });
      k.add(0.9 + 0.9 + 0.4, c); }
    { const c = k.piece(), g = c.getContext("2d"), [x, y] = st.iso(5.6, 0.9).map(R), fl = [];
      pix(g, x - 4, y - 36, ["y.y.y.y.y", "yyyyyyyyy", ".y..y..y.", "..yyyyy..", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "...yzy...", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "...yzy...", "....y....", "....y....", "...yyy...", "..y...y..", ".y.....y."], { y: "#2e2e34", z: "#5a5a62" });
      for (const dx of [0, 4, 8]) { g.fillStyle = "#e8dcc0"; g.fillRect(x - 4 + dx, y - 39, 1, 3); fl.push([x - 4 + dx, y - 41]); }
      k.add(5.6 + 0.9 + 0.3, c);
      k.anims.push((cc, t) => fl.forEach(([fx, fy], i) => { const f = Math.floor(t * 8 + i * 1.9) % 3; cc.fillStyle = f ? "#ffd060" : "#fff4c0"; cc.fillRect(fx, fy - (f === 2 ? 1 : 0), 1, 2); }));
      k.lights.push({ x, y: y - 40, r: 40, k: 0.5 }); }
    // the clerk's counter: panelled, its top with the scales, the ledger, ink and quill, coins, a bell and the strongbox
    { const u = 11.0, v = 2.8, du = 4.8, dv = 1.0, hgt = 16;
      floorShadow(k, u, v + dv, du, 0.35, 0.22);
      along(k, u, v, du, dv, 1.2, (g, su, s, first, last) => {
        P.slab(g, st, su, v + 0.08, s, dv - 0.08, hgt - 2, { base: oak, top: oak, right: shade(oak, -0.35), left: (x, y) => {
          const uu = (x + 0.5 - st.OX) / 8 + v + dv, f = frac((uu - u) / 1.2), hh = st.iso(uu, v + dv)[1] - y - 0.5;
          if (f < 0.1 || hh < 2 || hh > hgt - 4) return shade(oak, -0.25);
          if (f < 0.18 || hh > hgt - 5.5) return shade(oak, 0.14);
          return f > 0.92 || hh < 3 ? shade(oak, -0.4) : oak;
        } }, 0, false);
        P.slab(g, st, su, v, s, dv + 0.06, 2, { base: "#8a5a34", top: (x, y) => ((x + 2 * y) % 13 ? "#a06a3c" : "#946236"), left: "#7a4c2c", right: "#5a3820" }, hgt - 2, false);
        P.line(g, st.up(st.iso(su, v + dv + 0.06), hgt), st.up(st.iso(su + s, v + dv + 0.06), hgt), "#c08a54");
        if (last) P.slab(g, st, su + s - 0.02, v + 0.08, 0.02, dv - 0.08, hgt - 2, { base: oak, right: shade(oak, -0.35) }, 0, false);
        const on = (uu) => uu >= su && uu < su + s, at = (uu, vv) => st.up(st.iso(uu, vv), hgt).map(R);
        if (on(11.5)) { const [x, y] = at(11.5, 3.3); pix(g, x - 5, y - 9, ["....y.....", "..yyyyyy..", ".y..y...y.", "y...y....y", "yy..y...yy", "....y.....", "...yyy....", "..yyyyy...", "..zzzzz..."], { y: "#d8a840", z: "#8a6a2a" }); }
        if (on(12.6)) { const [x, y] = at(12.6, 3.3); pix(g, x - 6, y - 4, ["kkkkkk.kkkkkk", "kwwwwwkwwwwwk", "kwlwlwkwlwwwk", "kwwwwwkwwlwwk", ".kkkkkkkkkkk."], { k: "#5a2a1a", w: "#f4ecd8", l: "#8a7a5a" }); }
        if (on(13.4)) { const [x, y] = at(13.4, 3.2); pix(g, x - 1, y - 8, ["...w", "..w.", ".w..", "xw..", "xx..", "xx.."], { x: "#2a2a30", w: "#f4f0e4" }); }
        if (on(13.9)) { const [x, y] = at(13.9, 3.4); pix(g, x - 3, y - 4, [".yy...", "yzzy.y", "yzzyyz", ".yy.yz"], { y: "#e8c050", z: "#b88a2a" }); }
        if (on(14.3)) { const [x, y] = at(14.3, 3.1); pix(g, x - 2, y - 4, [".y.", "yyy", "yyy", "zzz"], { y: "#c8a040", z: "#8a6a2a" }); if (L.lamps) k.candles.push([x + 1, y - 1]); }
        if (on(14.8)) { P.slab(g, st, 14.8, 2.95, 0.75, 0.6, 7, { base: "#5a3a22", top: (x, y) => ((x + y) % 6 === 0 ? "#3a3a40" : "#6e4a2c"), left: (x, y) => ((x % 5) < 1 ? "#3a3a40" : "#5a3a22"), right: (x, y) => ((y % 4) < 1 ? "#2a2a30" : "#3e2816") }, hgt); const [x, y] = at(15.2, 3.55); dot(g, x, y - 4, "#c8a040"); }
      });
    }
    { const [cx, cy] = st.up(st.iso(9.0, 7.0), 62).map(R), lit = L.lamps;
      k.anims.push((c, t) => {
        c.fillStyle = "#2a2420"; c.fillRect(cx, 0, 1, cy - 1);
        for (const d of [-1, 1]) Tv().line(c, [cx, cy - 12], [cx + d * 12, cy], "#3a3430");
        ellipse(c, cx, cy, 13, 4, (dx, dy) => (dx * dx + dy * dy > 0.6 ? (dy > 0 ? "#4a3a2a" : "#2e2418") : null));
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3, x = R(cx + Math.cos(a) * 12), y = R(cy + Math.sin(a) * 3.6); if (lit) Tv().candle(c, x, y, t + i, 0.8, 3); else { c.fillStyle = "#efe6d0"; c.fillRect(x, y - 3, 2, 3); c.fillStyle = "#3a2a1a"; c.fillRect(x, y - 4, 1, 1); } }
      });
      if (lit) k.lights.push({ x: cx, y: cy + 4, r: 70, k: 0.55 }); }
    k.spot("board", 8.6, 2.4, 1); k.spot("act", 8.6, 2.4, 1); k.spot("counter", 13.0, 5.0, 1); k.spot("npc", 13.2, 1.6, -1); k.spot("map", 2.4, 4.6, -1);
    k.spot("in", 1.4, 14.4, 1); k.spot("mate", 7.5, 5.5, -1); k.spot("other", 4.8, 8.2, -1); k.spot("pet", 9.75, 6.25, -1);
    k.crowd([[10.2, 1.4, 1], [9.0, 10.0, -1]]);
    k.npc = { kind: "clerk" };
  }

  // ======================================================================================================================
  // the temple: dressed stone, lancet windows of coloured glass with the day falling through them, pews, the altar and its rail,
  // the confessional, the votive candles, the poor box, the font, a saint in a niche
  // ======================================================================================================================
  function templeWall(S) {
    const { shade, mix, h01, frac } = K(), cols = S.stone.map((c) => mix(shade(c, 0.16), "#d8d0c0", 0.18)), mortar = shade(S.mortar, 0.2);
    return (a, h) => {
      if (h < 9) { const k2 = a / 1.8, col = Math.floor(k2); if (h % 9 > 8 || k2 - col < 0.04) return shade(mortar, -0.15); return shade(cols[Math.floor(h01(col, 9) * cols.length)], -0.18); }
      if (h < 11) return h < 10 ? shade(cols[0], 0.1) : shade(cols[1], -0.2);
      if (Math.abs(h - 70) < 2.2) return h > 71.2 ? shade(cols[0], 0.18) : h < 68.6 ? shade(cols[1], -0.25) : cols[0];
      const pa = frac((a + 0.9) / 4.4) * 4.4;
      if (pa < 0.7) {
        const r2 = Math.floor(h / 12);
        if (h % 12 < 0.8) return mortar;
        return pa < 0.1 ? shade(cols[0], 0.2) : pa > 0.6 ? shade(cols[1], -0.25) : h01(r2, 77) > 0.5 ? shade(cols[0], 0.06) : cols[0];
      }
      const row = Math.floor(h / 7), kk = a / 1.3 + (row % 2 ? 0.5 : 0), col = Math.floor(kk), fy = h - row * 7, fx = kk - col;
      if (fy < 0.9 || fx < 0.05) return mortar;
      let c = cols[Math.floor(h01(row, col) * cols.length)];
      if (fy > 6.1) c = shade(c, 0.1); else if (fx > 0.92) c = shade(c, -0.14);
      if (h01(Math.floor(a * 9), Math.floor(h / 2)) > 0.9) c = shade(c, -0.06);
      if (h < 24) c = mix(c, "#6a6458", (24 - h) / 60);
      return c;
    };
  }
  function lancet(k, side, a0, a1, h0, h1, glass, reach) {
    const { st, ctx, L } = k, P = Tv(), { shade, mix, frac } = K(), wall = side === "l" ? st.lwall : st.rwall, on = side === "l" ? st.onL : st.onR;
    const m = (a0 + a1) / 2, half = (a1 - a0) / 2, arch = (a1 - a0) * 9;
    const inside = (a, h, grow) => { const d = Math.abs(a - m) / (half + grow); if (d > 1 || h < h0 - grow * 8 || h > h1 + grow * 8) return false; const hs = h1 - arch; return h <= hs || (h - hs) / (arch + grow * 8) <= Math.pow(1 - d, 0.55); };
    const box = st.quad(wall, a0 - 0.5, a1 + 0.5, h0 - 6, h1 + 6);
    P.fillPoly(ctx, box, (x, y) => { const [a, h] = on(x, y); return inside(a, h, 0.32) && !inside(a, h, 0.14) ? shade(k.S.stone[0], 0.22) : null; });
    P.fillPoly(ctx, box, (x, y) => { const [a, h] = on(x, y); return inside(a, h, 0.14) && !inside(a, h, 0) ? shade(k.S.stone[1], -0.3) : null; });
    P.fillPoly(ctx, box, (x, y) => {
      const [a, h] = on(x, y);
      if (!inside(a, h, 0)) return null;
      const px = a * 8, lead = frac((px + h) / 5) < 0.18 || frac((px - h) / 5) < 0.18 || Math.abs(a - m) < 0.04;
      if (lead) return L.night ? "#141018" : "#2a2420";
      const cell = Math.floor((px + h) / 5) * 3 + Math.floor((px - h) / 5), edge = Math.abs(a - m) / half > 0.62 || h > h1 - arch * 0.5;
      let c = edge ? glass[cell % 2 ? 0 : 1] : glass[2 + (((cell % 3) + 3) % 3)];
      if (Math.abs(h - (h0 + h1) / 2) < 3 && Math.abs(a - m) < half * 0.4) c = glass[1];
      if (L.night) return mix(shade(c, -0.6), "#1a2440", 0.4);
      return (h - h0) / (h1 - h0) > 0.6 ? shade(c, 0.22) : c;
    });
    P.slab(ctx, st, side === "r" ? a0 - 0.3 : 0, side === "r" ? 0 : a0 - 0.3, side === "r" ? a1 - a0 + 0.6 : 0.3, side === "r" ? 0.3 : a1 - a0 + 0.6, 2, shade(k.S.stone[0], 0.15), h0 - 4);
    if (L.night) { k.lights.push({ ...(() => { const [x, y] = wall(m, (h0 + h1) / 2); return { x, y: y + 6 }; })(), r: 26, k: 0.25, cool: true }); return; }
    // the day through the glass: coloured patches on the floor, bands of light through the air with dust in them
    const r2 = reach, foot = side === "r" ? (s) => st.iso(a0 + s * (a1 - a0) + r2 * 0.5, r2) : (s) => st.iso(r2, a0 + s * (a1 - a0) + r2 * 0.5);
    const near = side === "r" ? (s) => st.iso(a0 + s * (a1 - a0), 0.1) : (s) => st.iso(0.1, a0 + s * (a1 - a0));
    for (let i = 0; i < 4; i++) {
      const s0 = i / 4, s1 = (i + 1) / 4, col = glass[[2, 1, 3, 0][i]];
      P.fillPoly(ctx, [near(s0), near(s1), foot(s1), foot(s0)], (x, y) => ((x + y) % 2 ? rgba(col, 0.3) : rgba(col, 0.18)));
    }
    const top = [wall(a0, h1 - arch * 0.4), wall(a1, h1 - arch * 0.4)];
    shaft(k, top, [foot(1), foot(0)], mix(glass[1], "#fff4d8", 0.6), 14, 0.06);
  }
  function pew(k, u, v, dv) {
    const { st } = k, P = Tv(), { shade } = K(), c = k.piece(), g = c.getContext("2d"), wood = "#6e4428";
    P.legs(g, st, u, v + 0.1, 0.55, dv - 0.2, 5, shade(wood, -0.35));
    P.slab(g, st, u, v + 0.1, 0.55, dv - 0.2, 1.5, { base: wood, top: shade(wood, 0.18), left: shade(wood, -0.05), right: shade(wood, -0.32) }, 5);
    P.slab(g, st, u + 0.45, v + 0.1, 0.13, dv - 0.2, 9, { base: wood, top: shade(wood, 0.3), left: (x, y) => (y % 3 === 0 ? shade(wood, -0.15) : wood), right: shade(wood, -0.3) }, 5);
    P.line(g, st.up(st.iso(u + 0.58, v + 0.1), 14), st.up(st.iso(u + 0.58, v + dv - 0.1), 14), shade(wood, 0.35));
    for (const vv of [v, v + dv - 0.1]) {
      P.slab(g, st, u - 0.02, vv, 0.62, 0.1, 15, { base: shade(wood, -0.05), top: shade(wood, 0.25), left: (x, y) => { const [uu] = st.toUV(x, y + 6); return Math.abs(uu - u - 0.3) < 0.08 ? shade(wood, 0.15) : (x + y) % 5 === 0 ? shade(wood, -0.2) : shade(wood, -0.05); }, right: shade(wood, -0.35) });
      const [x, y] = st.up(st.iso(u + 0.3, vv + 0.1), 15).map(R); K().pix(g, x - 1, y - 3, [".x.", "xyx", "xxx"], { x: shade(wood, -0.1), y: shade(wood, 0.3) });
    }
    k.add(u + v + dv + 0.4, c);
  }
  function temple(k) {
    const { st, ctx, S, th, r, L } = k, P = Tv(), { shade, mix, pix, h01, frac } = K();
    const fl = S.stone.map((c) => mix(shade(c, 0.1), "#c8c0b0", 0.15)), sanct = S.stone.map((c) => mix(shade(c, 0.28), "#e8e0d0", 0.35)), gap = shade(S.mortar, 0.05);
    K().room(k, templeWall(S), (u, v) => {
      const sa = u < 3.0, cols = sa ? sanct : fl, s = sa ? 1.6 : 1.1, row = Math.floor(v * s), kk = u * s + (row % 2 ? 0.5 : 0), col = Math.floor(kk), fy = v * s - row, fx = kk - col;
      if (Math.abs(u - 3.0) < 0.06) return shade(cols[1], -0.35);
      if (fy < 0.06 || fx < 0.05) return gap;
      let c = cols[Math.floor(h01(row, col) * cols.length)];
      if (fy > 0.88 || fx > 0.94) c = shade(c, -0.08); else if (fy < 0.18) c = shade(c, 0.06);
      if (!sa && u > 10.0 && u < 11.2 && v > 3.0 && v < 4.6) { const e = Math.min(u - 10, 11.2 - u, (v - 3) / 1.3, (4.6 - v) / 1.3); c = e < 0.08 ? shade(c, -0.25) : Math.abs(u - 10.6) < 0.05 && v > 3.4 && v < 4.3 || Math.abs(v - 3.65) < 0.07 && Math.abs(u - 10.6) < 0.3 ? shade(c, -0.3) : shade(c, 0.05); }
      return c;
    }, { beam: "#2a2220", ceiling: "#1e1816", skirt: shade(S.stone[1], -0.3) });
    // the runner up the aisle to the sanctuary
    P.fillPoly(ctx, [st.iso(3.1, 5.3), st.iso(16, 5.3), st.iso(16, 6.1), st.iso(3.1, 6.1)], (x, y) => { const [u, v] = st.toUV(x, y); if (v < 5.4 || v > 6.0) return shade(th.accent, -0.2); return frac(u * 2) < 0.08 ? shade(th.primary, -0.3) : (x + y) % 7 === 0 ? shade(th.primary, -0.12) : th.primary; });
    const glass = [th.primary, th.accent, "#4a7ac0", "#e8d090", "#7aa84a"];
    lancet(k, "r", 3.6, 5.0, 20, 50, glass, 7);
    lancet(k, "r", 8.4, 9.8, 22, 62, glass, 7);
    lancet(k, "l", 9.0, 10.4, 22, 62, glass, 6);
    // the reredos behind the altar: gilt panels, the holy sign in the town's gold, two painted saints
    { const wall = st.lwall, on = st.onL, a0 = 2.2, a1 = 6.0, m = (a0 + a1) / 2;
      P.fillPoly(ctx, [wall(a0, 14), wall(a1, 14), wall(a1, 44), wall(m + 0.6, 50), wall(m, 56), wall(m - 0.6, 50), wall(a0, 44)], (x, y) => {
        const [a, h] = on(x, y), p = Math.floor((a - a0) / ((a1 - a0) / 3)), pf = frac((a - a0) / ((a1 - a0) / 3));
        if (pf < 0.08 || pf > 0.94 || h < 16 || (h > 42 && p !== 1)) return (x + y) % 3 ? "#c8a040" : "#e8c860";
        if (p === 1) return h > 30 ? mix(th.primary, "#1a1420", 0.25) : shade(th.primary, -0.35);
        return h > 34 ? "#d8c8a0" : h > 22 ? shade(p ? th.accent : "#7a5a8a", -0.15) : "#5a4a3a";
      });
      const [sx, sy] = wall(m, 40).map(R);
      pix(ctx, sx - 5, sy - 5, ["....y....", "..y.y.y..", "...yyy...", "yyyywyyyy", "...yyy...", "..y.y.y..", "....y....", "....y....", "...yyy..."], { y: th.accent, w: "#fff8e0" });
      for (const da of [-1.25, 1.25]) { const [x, y] = wall(m + da, 34).map(R); pix(ctx, x - 2, y - 2, [".yy.", "yssy", ".ss.", "rrrr", "rrrr", "rrrr", "rrrr", ".rr."], { y: "#e8c860", s: "#e0b890", r: da < 0 ? "#6a4a7a" : "#3a5a7a" }); } }
    // the altar: stone, its cloth in the town's colour with a gold fringe, the book, the chalice (candles alive)
    { const u0 = 0.6, v0 = 2.6, du = 1.4, dv = 3.0;
      P.slab(ctx, st, u0, v0, du, dv, 13, { base: shade(S.stone[0], 0.15), top: shade(S.stone[0], 0.25), left: shade(S.stone[1], -0.05), right: (x, y) => ((x + y) % 9 === 0 ? shade(S.stone[1], -0.4) : shade(S.stone[1], -0.28)) });
      P.slab(ctx, st, u0 + 0.02, v0 + 0.25, du, dv - 0.5, 1, { base: "#f0ece0", top: "#f8f4ea" }, 13);
      P.fillPoly(ctx, [st.up(st.iso(u0 + du + 0.02, v0 + 0.6), 13), st.up(st.iso(u0 + du + 0.02, v0 + dv - 0.6), 13), st.up(st.iso(u0 + du + 0.02, v0 + dv - 0.6), 3), st.up(st.iso(u0 + du + 0.02, v0 + 0.6), 3)], (x, y) => {
        const [, vv] = st.toUV(x, y + 8); const yy = y - st.up(st.iso(u0 + du, vv), 3)[1];
        if (yy > -1.5) return (x % 2) ? th.accent : shade(th.accent, -0.3);
        if (Math.abs(vv - (v0 + dv / 2)) < 0.12 || Math.abs(yy + 6) < 0.8 && Math.abs(vv - (v0 + dv / 2)) < 0.4) return th.accent;
        return frac(vv * 3) < 0.1 ? shade(th.primary, -0.2) : th.primary;
      });
      const at = (u, v) => st.up(st.iso(u, v), 14).map(R);
      { const [x, y] = at(1.3, 4.1); pix(ctx, x - 3, y - 2, ["rrrrrr", "rwwrww", "rwwrww"], { r: "#7a2a1e", w: "#f4ecd8" }); }
      { const [x, y] = at(1.3, 4.9); pix(ctx, x - 1, y - 5, ["yyy", ".y.", ".y.", "yyy"], { y: "#e8c050" }); }
      const altarC = [at(1.2, 3.0), at(1.2, 5.3)];
      for (const [x, y] of altarC) pix(ctx, x - 1, y - 3, [".y.", ".y.", "yyy"], { y: "#c8a040" });
      k.anims.push((c, t) => { for (const [x, y] of altarC) Tv().candle(c, x, y - 3, t, 0.8, 6); });
      for (const [x, y] of altarC) k.lights.push({ x, y: y - 10, r: 26, k: 0.45 });
    }
    // the lectern at the sanctuary's side, a brass eagle bearing the book
    { const [x, y] = st.iso(1.6, 6.8).map(R); pix(ctx, x - 4, y - 22, ["..wwwww..", ".wlwwwlw.", "..yyyyy..", ".yyykyy..", "..yyyyyy.", "...yyy...", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "....y....", "...yyy...", "....y....", "....y....", "....y....", "....y....", "...yyy...", "..yyyyy.."], { w: "#f4ecd8", l: "#8a7a5a", y: "#c8a040", k: "#2a2018" }); }
    // the hymn board: tonight's numbers in brass
    { const wall = st.lwall; P.fillPoly(ctx, st.quad(wall, 7.3, 8.5, 26, 50), "#3a2414"); P.fillPoly(ctx, st.quad(wall, 7.4, 8.4, 27, 49), "#5a3820");
      const DIG = { 1: [".x.", "xx.", ".x.", ".x.", "xxx"], 2: ["xx.", "..x", ".x.", "x..", "xxx"], 3: ["xx.", "..x", ".x.", "..x", "xx."], 4: ["x.x", "x.x", "xxx", "..x", "..x"], 7: ["xxx", "..x", ".x.", ".x.", ".x."], 0: [".x.", "x.x", "x.x", "x.x", ".x."] };
      ["144", "27", "301"].forEach((n, j) => { const [x, y] = wall(8.25, 46 - j * 7.5).map(R); n.split("").forEach((d, i) => pix(ctx, x + i * 4, y, DIG[d], { x: "#e8c060" })); }); }
    // a saint in a niche on the left wall, a halo in gold, flowers at the feet
    { const wall = st.lwall, on = st.onL, a0 = 12.6, a1 = 14.0, m = (a0 + a1) / 2;
      P.fillPoly(ctx, [wall(a0 - 0.2, 18), wall(a1 + 0.2, 18), wall(a1 + 0.2, 52), wall(m, 58), wall(a0 - 0.2, 52)], shade(S.stone[0], 0.2));
      P.fillPoly(ctx, [wall(a0, 20), wall(a1, 20), wall(a1, 50), wall(m, 55), wall(a0, 50)], (x, y) => { const [a, h] = on(x, y); return shade(S.stone[1], -0.45 + (a - a0) * 0.1); });
      const [x, y] = wall(m, 21).map(R);
      pix(ctx, x - 5, y - 28, ["...yyy....", "..y...y...", "..ysssy...", "...sss....", "...sSs....", "..ssSss...", ".ssSsSss..", ".ssSsSSs..", ".sssSsss..", "ssSsSsSss.", ".ssSsSss..", "..sSsSss..", "..sSsSs...", "..sSsSss..", "..ssSsss..", "..sSsSss..", "..ssSsss..", "..sSssSs..", ".ssSsSsss.", ".sssssssS.", "..SSSSSSS."], { y: "#e8c050", s: shade(S.stone[0], 0.3), S: shade(S.stone[0], 0.05) });
      pix(ctx, x - 4, y - 1, ["r.g.y.r.", "gggggggg"], { r: "#d84a5a", g: "#5a8a3a", y: "#f0c040" }); }
    banner(k, "r", 13.8, 14.8, 48, 92); banner(k, "l", 15.0, 15.9, 46, 90);
    // tall standing candlesticks either side of the altar (alive)
    { const tall = [];
      for (const v of [1.7, 6.7]) { const [x, y] = st.iso(2.2, v).map(R); pix(ctx, x - 2, y - 30, ["yyyyy", ".yyy.", "..y..", "..y..", "..y..", "..y..", "..y..", "..y..", "..y..", "..y..", "..y..", "..y..", ".yzy.", "..y..", "..y..", "..y..", "..y..", "..y..", "..y..", "..y..", "..y..", "..y..", ".yzy.", "..y..", "..y..", ".yyy.", "yyzyy", "y...y", "y...y", "yy.yy"], { y: "#c8a040", z: "#f0d070" }); tall.push([x - 1, y - 30]); k.lights.push({ x, y: y - 36, r: 30, k: 0.45 }); }
      k.anims.push((c, t) => tall.forEach(([x, y], i) => Tv().candle(c, x, y, t + i * 2, 0.8, 7))); }
    // a tomb with its lord lying in stone on the lid, by the saint's niche; a kneeler and candles before the saint
    { const c = k.piece(), g = c.getContext("2d"), u0 = 1.6, v0 = 10.4, du = 1.2, dv = 2.4, stn = S.stone;
      P.slab(g, st, u0, v0, du, dv, 11, { base: stn[0], top: shade(stn[0], 0.2), left: (x, y) => ((x + y) % 6 === 0 ? shade(stn[1], -0.15) : stn[1]), right: (x, y) => { const vv = u0 + du - (x + 0.5 - st.OX) / 8, hh = st.iso(u0 + du, vv)[1] - y, f = K().frac((vv - v0) / 0.6); return hh < 2 || hh > 9.5 ? shade(stn[1], -0.15) : f < 0.18 ? shade(stn[1], -0.2) : hh > 6 + Math.sin(f * Math.PI) * 2.5 ? shade(stn[1], -0.32) : shade(stn[1], -0.55); } });
      P.slab(g, st, u0 - 0.06, v0 - 0.06, du + 0.12, dv + 0.12, 2, { base: shade(stn[0], 0.1), top: shade(stn[0], 0.28) }, 11);
      const lie = (s) => st.up(st.iso(u0 + du / 2, v0 + 0.25 + s * (dv - 0.5)), 13), eff = mix(shade(stn[0], 0.4), "#f0ece0", 0.35), effD = shade(stn[0], -0.05);
      { const [x, y] = lie(0).map(R); P.fillPoly(g, [[x - 5, y - 2], [x + 3, y - 6], [x + 6, y - 3], [x - 2, y + 1]], shade(stn[0], 0.3)); }
      for (let i = 1; i <= 20; i++) {
        const s2 = i / 20, [x, y] = lie(s2), w = s2 < 0.12 ? 2.6 : s2 < 0.22 ? 1.6 : s2 < 0.4 ? 3.4 : s2 < 0.92 ? 3 - (s2 - 0.4) * 2.4 : 1.4;
        ellipse(g, x, y - 2.5, w + 0.8, 2.4, effD);
        ellipse(g, x, y - 3, w, 1.8, (dx, dy) => (dy < -0.3 ? eff : shade(eff, -0.12)));
      }
      { const [x, y] = lie(0.07).map(R); dot(g, x - 1, y - 4, shade(eff, -0.35)); dot(g, x + 1, y - 4, shade(eff, -0.35)); }
      { const [x, y] = lie(0.42).map(R); pix(g, x - 2, y - 6, [".x.", "xxx", ".x."], { x: shade(eff, 0.2) }); dot(g, x, y - 3, shade(eff, -0.3)); }
      { const [x, y] = lie(0.97).map(R); pix(g, x - 3, y - 5, [".kk..", "kkkk.", ".kkkk"], { k: shade(eff, -0.1) }); }
      k.add(u0 + du + v0 + dv, c); }
    { const c = k.piece(), g = c.getContext("2d"), flames = [];
      P.slab(g, st, 0.55, 12.6, 0.35, 1.4, 4, { base: shade(th.primary, -0.3), top: th.primary, left: shade(th.primary, -0.15), right: shade(th.primary, -0.45) });
      const [x, y] = st.iso(0.5, 14.6).map(R); pix(g, x - 4, y - 12, ["x.x.x.x.x", "xxxxxxxxx", ".x.x.x.x.", ".xxxxxxx.", "....x....", "....x....", "....x....", "....x....", "....x....", "....x....", "...xxx...", "..xxxxx.."], { x: "#3a3a40" });
      for (const dx of [-4, 0, 4, -2, 2]) { g.fillStyle = "#e8dcc0"; g.fillRect(x + dx, y - (Math.abs(dx) === 2 ? 15 : 14), 1, 2); flames.push([x + dx, y - (Math.abs(dx) === 2 ? 17 : 16)]); }
      k.add(0.9 + 14.6, c);
      k.anims.push((cc, t) => flames.forEach(([fx, fy], i) => { const f = Math.floor(t * 7 + i * 1.3) % 3; cc.fillStyle = f ? "#ffd060" : "#fff4c0"; cc.fillRect(fx, fy - (f === 2 ? 1 : 0), 1, 2); }));
      k.lights.push({ x, y: y - 16, r: 30, k: 0.45 }); }
    // the votive stand: three iron tiers of little candles between the windows (alive)
    { const u0 = 6.2, u1 = 7.8, flames = [];
      for (let t2 = 0; t2 < 3; t2++) { const vv = 0.65 - t2 * 0.2, z = 8 + t2 * 5; P.line(ctx, st.up(st.iso(u0, vv), z), st.up(st.iso(u1, vv), z), "#3a3a40"); P.line(ctx, st.up(st.iso(u0, vv), z - 1), st.up(st.iso(u1, vv), z - 1), "#2a2a2e");
        for (let i = 0; i < 6; i++) { if (h01(i, t2 + 7) < 0.2) continue; const [x, y] = st.up(st.iso(u0 + 0.12 + i * 0.26, vv), z).map(R); ctx.fillStyle = "#e8dcc0"; ctx.fillRect(x, y - 3, 1, 3); ctx.fillStyle = "#a8281e"; ctx.fillRect(x - 1, y - 1, 3, 1); flames.push([x, y - 3]); } }
      for (const u of [u0, u1]) { const [x, y] = st.iso(u, 0.65).map(R); ctx.fillStyle = "#2a2a2e"; ctx.fillRect(x, y - 18, 1, 18); }
      k.anims.push((c, t) => flames.forEach(([x, y], i) => { const f = Math.floor(t * 8 + i * 1.7) % 3; c.fillStyle = f ? "#ffd060" : "#fff4c0"; c.fillRect(x, y - 2 - (f === 2 ? 1 : 0), 1, 2); }));
      const [gx, gy] = st.up(st.iso((u0 + u1) / 2, 0.4), 14); k.lights.push({ x: gx, y: gy, r: 36, k: 0.5 });
      k.anims.push((c) => K().glow(c, gx, gy, 14, "#ffc860", L.night ? 0.3 : 0.16)); }
    // the communion rail, open in the middle where the priest comes down
    for (const [v0, v1] of [[1.7, 3.7], [4.5, 7.4]]) {
      const c = k.piece(), g = c.getContext("2d"), u = 2.78, brass = "#c8a040", wood = "#5a3820";
      for (let vv = v0; vv <= v1 + 0.01; vv += 0.25) { const [x, y] = st.iso(u, vv).map(R); g.fillStyle = shade(wood, -0.2); g.fillRect(x, y - 9, 1, 9); dot(g, x, y - 5, shade(wood, 0.2)); }
      P.slab(g, st, u - 0.06, v0, 0.14, v1 - v0, 2, { base: wood, top: shade(wood, 0.3), left: shade(wood, 0.05), right: shade(wood, -0.3) }, 9);
      P.slab(g, st, u + 0.1, v0, 0.3, v1 - v0, 2, { base: th.primary, top: shade(th.primary, 0.15), left: shade(th.primary, -0.1), right: shade(th.primary, -0.35) }, 0);
      for (const vv of [v0, v1]) { const [x, y] = st.up(st.iso(u, vv), 11).map(R); dot(g, x, y, brass); }
      k.add(4.0, c);
    }
    // the pews: two blocks either side of the aisle, a hymnal left on a seat
    for (const [v, dv] of [[2.6, 2.6], [6.2, 3.2]]) for (const u of [4.0, 6.4, 8.8]) pew(k, u, v, dv);
    pew(k, 11.2, 6.2, 3.2);
    { const c = k.piece(), g = c.getContext("2d"), [x, y] = st.up(st.iso(9.08, 4.9), 7).map(R); pix(g, x - 2, y - 2, ["xxxx", "xyyx", "xxxx"], { x: "#3a1a14", y: "#c8a040" }); k.add(8.8 + 3.0 + 2.62, c); }
    // the confessional: two bays of dark oak under a carved cornice and crest; the penitent's bay curtained, the priest's with a grille his face shows through
    { const u0 = 11.2, um = 12.4, u1 = 13.6, dv = 1.6, hgt = 40, oak = "#4e301c";
      P.fillPoly(ctx, [st.up(st.iso(um + 0.1, dv), 23), st.up(st.iso(u1 - 0.1, dv), 23), st.up(st.iso(u1 - 0.1, dv), 35), st.up(st.iso(um + 0.1, dv), 35)], "#140c08");
      const bay = (ua, ub, near) => {
        const c = k.piece(), g = c.getContext("2d");
        P.slab(g, st, ua, 0, ub - ua, dv, hgt, { base: oak, top: shade(oak, 0.2), right: near ? () => null : (x, y) => { const uu = ub, hh = st.iso(uu, (st.OX - x - 0.5) / 8 + uu)[1] - y; return (x % 6) < 1 || Math.abs(hh - 20) < 1 ? shade(oak, -0.5) : (x % 6) < 2 ? shade(oak, -0.1) : shade(oak, -0.3); }, left: (x, y) => {
          const uu = (x + 0.5 - st.OX) / 8 + dv, f = (uu - ua) / (ub - ua), hh = st.iso(uu, dv)[1] - y - 0.5;
          if (f < 0.07 || f > 0.93 || hh > hgt - 4) return f < 0.03 || hh > hgt - 1.5 ? shade(oak, 0.25) : shade(oak, 0.1);
          if (hh < 2) return shade(oak, -0.3);
          if (near) {
            if (f < 0.42 && hh < hgt - 5) { const fold = Math.floor((f - 0.07) * 40) % 3; return fold === 0 ? shade(th.primary, -0.3) : fold === 1 ? th.primary : shade(th.primary, 0.12); }
            if (hh < hgt - 5) return hh < 4 ? "#2a1a10" : (x + R(hh)) % 7 === 0 ? "#22160e" : "#1a100a";
            return oak;
          }
          if (hh > 23 && hh < 35 && f > 0.2 && f < 0.8) return (x % 3 === 0 || R(hh) % 3 === 0) ? "#c8a040" : null;
          if (Math.abs(hh - 22) < 0.8 || Math.abs(hh - 36) < 0.8 || Math.abs(f - 0.2) < 0.04 || Math.abs(f - 0.8) < 0.04) return shade(oak, 0.18);
          if (hh < 20 && (Math.abs(hh - 11) < 0.7 || Math.abs(f - 0.5) < 0.04)) return shade(oak, -0.25);
          return (x + R(hh)) % 11 === 0 ? shade(oak, -0.12) : oak;
        } });
        P.slab(g, st, ua - 0.06, -0.02, ub - ua + 0.12, dv + 0.1, 3, { base: shade(oak, 0.1), top: shade(oak, 0.25), left: (x, y) => (x % 2 ? shade(oak, 0.3) : shade(oak, 0.05)), right: shade(oak, -0.2) }, hgt);
        P.fillPoly(g, [st.up(st.iso(ua, dv + 0.08), hgt + 3), st.up(st.iso(ub, dv + 0.08), hgt + 3), st.up(st.iso((ua + ub) / 2, dv + 0.08), hgt + 10)], (x, y) => ((x + y) % 4 ? shade(oak, 0.05) : shade(oak, 0.3)));
        const [fx, fy] = st.up(st.iso((ua + ub) / 2, dv + 0.08), hgt + 10).map(R); pix(g, fx - 1, fy - 4, [".y.", "yyy", ".y."], { y: th.accent });
        if (near) { const [kx, ky] = st.iso((ua + ub) / 2, dv + 0.25).map(R); P.slab(g, st, ua + 0.2, dv, ub - ua - 0.4, 0.3, 3, { base: shade(th.primary, -0.3), top: shade(th.primary, -0.1) }); }
        else { const [hx, hy] = st.up(st.iso(ub - 0.25, dv), 14).map(R); dot(g, hx, hy, "#c8a040"); }
        return c;
      };
      k.add(um + dv + 0.3, bay(u0, um, true));
      k.add(14.4, bay(um, u1, false));
    }
    // the poor box on its pillar, a painted hand and coin above it
    { const c = k.piece(), g = c.getContext("2d");
      P.slab(g, st, 10.1, 0.3, 0.4, 0.35, 12, { base: shade(S.stone[0], 0.1), top: S.stone[0], left: S.stone[1], right: shade(S.stone[1], -0.3) });
      P.slab(g, st, 10.02, 0.22, 0.56, 0.5, 6, { base: "#5a3a22", top: (x, y) => ((x + y) % 5 === 0 ? "#2e2e34" : "#6e4a2c"), left: (x, y) => ((x % 4) < 1 ? "#2e2e34" : "#5a3a22"), right: "#3e2816" }, 12);
      const [x, y] = st.up(st.iso(10.3, 0.47), 18).map(R); g.fillStyle = "#140c08"; g.fillRect(x - 1, y, 3, 1);
      const [lx, ly] = st.up(st.iso(10.3, 0.72), 14).map(R); pix(g, lx - 1, ly - 1, ["xx", "xx", ".x"], { x: "#c8a040" });
      k.add(10.6 + 0.72, c);
      const [px, py] = st.rwall(10.3, 30).map(R); pix(ctx, px - 3, py - 3, [".sss..", "sssss.", "ssssy.", ".sssyy", "...yy."], { s: "#d8b088", y: "#e8c050" }); }
    // the font by the door: an octagon of stone on a stem, holy water in it
    { const c = k.piece(), g = c.getContext("2d"), u = 12.0, v = 5.2;
      P.slab(g, st, u - 0.2, v - 0.2, 0.4, 0.4, 9, { base: S.stone[0], left: S.stone[1], right: shade(S.stone[1], -0.3) });
      for (let h = 9; h < 15; h++) P.fillPoly(g, Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; return st.up(st.iso(u + Math.cos(a) * 0.62, v + Math.sin(a) * 0.62), h); }), h === 14 ? shade(S.stone[0], 0.25) : (x) => (x % 4 ? S.stone[0] : S.stone[1]));
      P.fillPoly(g, Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; return st.up(st.iso(u + Math.cos(a) * 0.45, v + Math.sin(a) * 0.45), 15); }), (x, y) => ((x + y) % 5 === 0 ? "#b8d8e8" : "#6a9ab8"));
      k.add(u + v + 0.7, c); }
    // the chandelier: an iron ring of candles high over the nave (alive)
    const ring = [7.0, 5.6], [cx, cy] = st.up(st.iso(ring[0], ring[1]), 76).map(R);
    k.anims.push((c, t) => {
      c.fillStyle = "#2a2420"; c.fillRect(cx, 0, 1, cy);
      ellipse(c, cx, cy, 13, 4, (dx, dy) => (dx * dx + dy * dy > 0.6 ? (dy > 0 ? "#3a3430" : "#2a2420") : null));
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, x = R(cx + Math.cos(a) * 12), y = R(cy + Math.sin(a) * 3.6); Tv().candle(c, x, y, t + i, 0.8, 3); }
    });
    k.lights.push({ x: cx, y: cy, r: 70, k: 0.55 });
    k.spot("altar", 2.3, 4.1, 1); k.spot("npc", 2.3, 4.1, 1); k.spot("rail", 3.3, 3.2, -1, "kneel"); k.spot("kneel", 3.3, 3.2, -1, "kneel");
    k.spot("pew", 6.68, 6.8, -1, "sit"); k.spot("act", 6.68, 6.8, -1, "sit"); k.spot("booth", 12.1, 2.35, 1, "kneel"); k.spot("booth_in", 12.5, 1.1, 1);
    k.spot("box", 10.3, 1.35, 1); k.spot("aisle", 4.2, 5.7, 1); k.spot("broom", 4.2, 5.7, 1); k.spot("steps", 7.0, 5.7, 1, "kneel"); k.spot("window", 4.6, 1.0, 1);
    k.spot("in", 13, 11, -1); k.spot("mate", 9.08, 6.8, -1, "sit"); k.spot("other", 9.08, 3.6, -1, "sit"); k.spot("pet", 7.4, 7.6, -1);
    k.crowd([[4.28, 3.6, -1, "sit"], [6.68, 3.6, -1, "sit"], [4.28, 7.8, -1, "sit"], [9.08, 7.8, -1, "sit"], [6.68, 4.6, -1, "sit"]]);
    k.npc = { kind: "priest" };
  }
  function banner(k, side, a0, a1, h0, h1) {
    const { st, ctx, th } = k, P = Tv(), { shade, frac } = K(), wall = side === "l" ? st.lwall : st.rwall, on = side === "l" ? st.onL : st.onR, m = (a0 + a1) / 2;
    P.fillPoly(ctx, [wall(a0, h1), wall(a1, h1), wall(a1, h0 + 6), wall(m, h0), wall(a0, h0 + 6)], (x, y) => {
      const [a, h] = on(x, y);
      if (a - a0 < 0.08 || a1 - a < 0.08) return shade(th.accent, -0.15);
      if (Math.abs(a - m) < 0.22 && Math.abs(h - (h0 + h1) / 2 - 2) < 5) return Math.abs(a - m) < 0.1 || Math.abs(h - (h0 + h1) / 2 - 2) < 1 ? th.accent : shade(th.accent, -0.25);
      return frac(a * 6) < 0.1 ? shade(th.primary, -0.18) : th.primary;
    });
    P.fillPoly(ctx, st.quad(wall, a0 - 0.15, a1 + 0.15, h1, h1 + 1.5), "#3a2a1a");
  }

  const T = root.TownSets;
  T.register("yard", yard, true);
  T.register("docks", docks, true);
  T.register("stables", stables);
  T.register("guild", guild);
  T.register("temple", temple);
})(typeof window !== "undefined" ? window : globalThis);
