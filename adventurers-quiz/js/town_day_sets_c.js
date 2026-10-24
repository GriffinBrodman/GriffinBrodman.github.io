/* Town day sets, more of them (registered with TownSets.register): the poorhouse and the infirmary. */
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
  function planksTop(st, z, wood) {
    const { shade, h01 } = K();
    return (x, y) => {
      const [, vv] = st.toUV(x, y + z), f = (vv * 3) % 1;
      if (f < 0.14) return shade(wood, -0.28);
      return h01(x >> 1, Math.floor(vv * 3)) > 0.88 ? shade(wood, 0.06) : shade(wood, 0.18);
    };
  }
  function trestle(k, u, v, du, dv, wood) {
    const { st } = k, P = Tv(), { shade } = K();
    along(k, u, v, du, dv, 1.25, (g, su, s, first, last) => {
      for (const [lu, on] of [[u + 0.3, first], [u + du - 0.3, last]]) {
        if (!on) continue;
        for (const lv of [v + 0.18, v + dv - 0.18]) { const [x, y] = st.iso(lu, lv); g.fillStyle = shade(wood, -0.3); g.fillRect(R(x) - 1, R(y) - 7, 2, 7); g.fillStyle = shade(wood, -0.55); g.fillRect(R(x) - 1, R(y) - 1, 2, 1); }
        P.line(g, st.up(st.iso(lu, v + 0.18), 3), st.up(st.iso(lu, v + dv - 0.18), 3), shade(wood, -0.4));
      }
      P.slab(g, st, su, v + 0.12, s, dv - 0.24, 2, shade(wood, -0.42), 5, false);
      P.slab(g, st, su, v, s, dv, 2, { base: wood, top: planksTop(st, 9, wood), left: shade(wood, -0.08), right: shade(wood, -0.35) }, 7, false);
      P.line(g, st.up(st.iso(su, v + dv), 9), st.up(st.iso(su + s, v + dv), 9), shade(wood, 0.36));
      P.line(g, st.up(st.iso(su, v + dv), 7), st.up(st.iso(su + s, v + dv), 7), shade(wood, -0.5));
      if (last) P.line(g, st.up(st.iso(su + s, v + dv), 9), st.up(st.iso(su + s, v), 9), shade(wood, 0.24));
    });
  }
  function longBench(k, u, v, du, dv, wood) {
    const { st } = k, P = Tv(), { shade } = K();
    along(k, u, v, du, dv, 1.25, (g, su, s, first, last) => {
      for (const [lu, on] of [[u + 0.25, first], [u + du - 0.25, last], [su + s / 2, !first && !last]]) {
        if (!on) continue;
        for (const lv of [v + 0.08, v + dv - 0.08]) { const [x, y] = st.iso(lu, lv); g.fillStyle = shade(wood, -0.35); g.fillRect(R(x), R(y) - 4, 1, 4); }
      }
      P.slab(g, st, su, v, s, dv, 1.5, { base: wood, top: shade(wood, 0.14), left: shade(wood, -0.1), right: shade(wood, -0.35) }, 4, false);
      P.line(g, st.up(st.iso(su, v + dv), 5.5), st.up(st.iso(su + s, v + dv), 5.5), shade(wood, 0.32));
    });
  }
  function bowl(g, x, y, soup) {
    K().pix(g, x - 3, y - 3, [".rrrr.", "rbbbbr", "wbccbw", ".wwww.", "..dd.."], { r: "#a8784a", b: soup ? "#c07a36" : "#5a3a22", c: soup ? "#d89a4a" : "#4a2e1a", w: "#7a4a26", d: "#5a3418" });
  }
  function loaf(g, x, y) { K().pix(g, x - 3, y - 3, ["..yyy.", ".yzyyy", "yyyyzy", "xxxxxx"], { y: "#c8904a", z: "#e8b870", x: "#8a5a2a" }); }
  function jug(g, x, y, col) { K().pix(g, x - 2, y - 7, [".xx.", "xyyx", "xyyxx", "xyyx.x", "xyyxx", "xyyx", ".xx."], { x: K().shade(col, -0.35), y: col }); }

  // a seated figure seen across a table: hood or hair, face, a drab coat; the table in front hides the rest
  const SITTER = ["...hhhh...", "..hhhhhh..", "..hssssh..", "..hesesh..", "..hsssshh.", "...sssshh.", "..lccccd..", ".lcccccdd.", ".lccccccd.", ".lcccccdd.", ".lccccccd.", ".lcccccdd.", ".lccccccd."];
  function sitter(k, u, v, look) {
    const { st } = k, { shade, pix } = K(), c = k.piece(), g = c.getContext("2d"), [x, y] = st.iso(u, v);
    pix(g, R(x) - 5, R(y) - 18, SITTER, { h: look.hood, s: look.skin, e: shade(look.skin, -0.55), c: look.coat, l: shade(look.coat, 0.18), d: shade(look.coat, -0.3) });
    k.add(u + v + 0.2, c);
  }

  // ---------- the poorhouse: a whitewashed hall, the soup cauldron at the hearth, long tables, blankets, the alms box ----------
  function hallWall(S) {
    const { mix, shade, h01, frac } = K(), tim = S.timber, dado = shade(tim, 0.22);
    const wash = [mix(S.plaster[0], "#f4f0e6", 0.6), mix(S.plaster[1], "#e8e2d4", 0.55)];
    return (a, h) => {
      const fk = frac(a / 3.2), d0 = fk * 3.2, d1 = (1 - fk) * 3.2;
      if (a > 0.3 && (d0 < 0.32 || d1 < 0.06)) return d0 < 0.1 ? shade(tim, 0.16) : d0 > 0.26 ? shade(tim, -0.2) : tim;
      if (h > 93) return h > 98 ? shade(tim, -0.25) : h < 94.5 ? shade(tim, -0.15) : tim;
      if (Math.abs(h - 54) < 1.6) return h > 54.4 ? shade(tim, 0.14) : tim;
      if (h < 15) {
        if (h > 13) return shade(dado, 0.26);
        const b = a * 2.6, bi = Math.floor(b);
        if (b - bi < 0.1) return shade(dado, -0.38);
        return h < 2 ? shade(dado, -0.3) : h01(bi, 3) > 0.5 ? dado : shade(dado, -0.08);
      }
      if (h > 54 && h < 93 && a > 0.3 && Math.floor(a / 3.2) % 2 === 0 && Math.abs(h - 54 - d0 * 17) < 1.3 && d0 < 2.3) return Math.abs(h - 54 - d0 * 17) < 0.45 ? shade(tim, 0.12) : tim;
      const n = h01(Math.floor(a * 7), Math.floor(h / 4));
      let c = n > 0.93 ? shade(wash[0], -0.05) : n > 0.55 ? wash[1] : wash[0];
      if (h01(Math.floor(a * 1.4), Math.floor(h / 9)) > 0.9 && n > 0.35) c = mix(c, "#c8b494", 0.35);
      if (h < 26) c = mix(c, "#a8987a", ((26 - h) / 11) * 0.22);
      return c;
    };
  }
  function hallFloor(k) {
    const { mix, shade, h01, frac } = K(), cols = ["#9c7248", "#946a42", "#a2784e"], seam = "#5a3c24";
    return (u, v) => {
      const row = Math.floor(v * 1.7), f = v * 1.7 - row, off = h01(row, 7) * 3, run = (u + off) / 3.4, end = frac(run);
      if (f < 0.09 || end < 0.018) return seam;
      let c = cols[Math.floor(h01(row, Math.floor(run)) * 3)];
      if (end > 0.03 && end < 0.045 && (Math.abs(f - 0.3) < 0.08 || Math.abs(f - 0.75) < 0.08)) return "#4a3020";
      if (f > 0.86) c = shade(c, -0.08); else if (f < 0.24) c = shade(c, 0.06);
      if (h01(Math.floor(u * 5), row) > 0.97 && f > 0.4 && f < 0.6) c = shade(c, -0.1);
      // the boards are worn pale where the queue stands, from the door to the cauldron
      const dq = Math.hypot(u - 3.4, (v - 5.0) * 1.4), dd = Math.abs((u - 2.4) * 0.26 + (v - 4.6) - 0) / 1.03;
      const wear = Math.max(0, 1 - dq / 3.4) * 0.3 + (u > 2 && u < 14 && dd < 1.1 ? (1.1 - dd) * 0.12 : 0);
      if (wear > 0) c = mix(c, "#b89c74", Math.min(0.34, wear));
      if (Math.hypot(u - 1.6, v - 4.1) < 1.4 && h01(Math.floor(u * 3), Math.floor(v * 3)) > 0.86) c = shade(c, -0.12);
      return c;
    };
  }
  function cauldronArt(st, u, v, rad) {
    const { mix, shade } = K(), c = st.canvas(), g = c.getContext("2d"), [cx, cy] = st.iso(u, v), rx = rad * 11.3, Hh = R(rad * 14);
    const iron = ["#6a6662", "#46423e", "#2a2724", "#191614"];
    for (const [du, dv] of [[-0.5, 0.35], [0.45, 0.4]]) { const [x, y] = st.iso(u + du * rad, v + dv * rad); g.fillStyle = iron[3]; g.fillRect(R(x) - 1, R(y) - 4, 2, 5); g.fillStyle = iron[1]; g.fillRect(R(x) - 1, R(y) - 4, 1, 3); }
    for (let j = 0; j <= Hh; j++) {
      const s = j / Hh, w = rx * (0.66 + 0.34 * Math.sin(Math.PI * Math.min(1, 0.25 + s * 0.85)));
      ellipse(g, cx, cy - 3 - j, w, w / 2, (dx) => {
        let col = dx < -0.62 ? iron[0] : dx < -0.12 ? iron[1] : dx < 0.55 ? iron[2] : iron[3];
        if (dx < -0.45 && dx > -0.62 && s > 0.3 && s < 0.7) col = "#8a8680";
        if (s < 0.22) col = mix(col, "#c8541e", (0.22 - s) * 2.2);
        if (Math.abs(dx) > 0.86) col = mix(col, "#a8461a", 0.45);
        return col;
      });
    }
    const top = cy - 3 - Hh - 1, rr = rx * 0.94;
    ellipse(g, cx, top, rr, rr / 2, (dx, dy) => (dy < -0.55 ? "#5a5652" : dx < -0.3 ? "#7e7a74" : dx > 0.6 ? "#3a3632" : "#625e58"));
    ellipse(g, cx, top + 0.5, rr * 0.78, rr * 0.38, (dx, dy) => (dy < -0.35 ? "#1e1a16" : (Math.abs(dx * 3 + dy * 5) % 2 < 0.4 ? "#e0a452" : dy > 0.4 ? "#b06a2a" : "#c8843a")));
    for (const [ox, oy, col] of [[-3, 0, "#e86a2a"], [2, 1, "#6a8a3a"], [4, -1, "#e8d088"], [-1, 2, "#e86a2a"], [0, -1, "#8aa848"]]) { g.fillStyle = col; g.fillRect(R(cx) + ox, R(top) + oy + 1, 1, 1); }
    for (const sx of [-1, 1]) { g.fillStyle = iron[2]; g.fillRect(R(cx + sx * rr) - (sx > 0 ? 0 : 1), R(top) - 1, 2, 3); }
    // the long ladle left resting in the pot
    Tv().line(g, [R(cx) + 3, R(top) - 1], [R(cx) + 9, R(top) - 13], "#8a5a30");
    Tv().line(g, [R(cx) + 4, R(top) - 1], [R(cx) + 10, R(top) - 13], "#5a3a1e");
    return { cv: c, rim: [cx, top], rx: rr };
  }

  function poorhouse(k) {
    const { st, ctx, S, th, r, L } = k, P = Tv(), { shade, mix, pix, glow, room, window_, basket } = K(), tim = S.timber;
    room(k, hallWall(S), hallFloor(k), { beam: shade(tim, -0.2), skirt: shade(tim, -0.1) });
    const v0 = 2.4, v1 = 5.6;
    P.hearth(ctx, st, r, v0, v1, st.g.WH, { stone: S.stone, mortar: S.mortar, mantel: tim });
    // soot up the chimney breast, and bowls and a crock on the mantel
    P.fillPoly(ctx, st.quad(st.lwall, v0 + 0.2, v1 - 0.2, 17, 28), (x, y) => { const [, h] = st.onL(x, y); return (x + y) % 2 && K().h01(x, y) < 1 - (h - 17) / 12 ? "rgba(20,12,8,0.35)" : null; });
    for (let i = 0; i < 4; i++) { const [x, y] = st.lwall(v0 + 0.1 + i * 0.32, 32.5); bowl(ctx, R(x) + 2, R(y) + 2, false); }
    { const [x, y] = st.lwall(v1 - 0.4, 33); jug(ctx, R(x) + 2, R(y) + 2, "#a8885a"); }
    // the hall's plaque over the hearth: a bowl and a loaf in the town's colours
    { const [x, y] = st.lwall((v0 + v1) / 2, 47); pix(ctx, R(x) - 9, R(y) - 4, ["bbbbbbbbbbbbbbbbbb", "bppppppppppppppppb", "bpppaaaaaaaaaapppb", "bpppaccccccccapppb", "bppppaccccccappppb", "bpppppaaaaaapppppb", "bppppppppppppppppb", "bbbbbbbbbbbbbbbbbb"], { b: shade(tim, -0.2), p: th.primary, a: th.accent, c: shade(th.accent, 0.35) }); }
    // the ladle rack and its tools beside the hearth
    P.slab(ctx, st, 0, 6.3, 0.25, 1.9, 2, shade(tim, 0.1), 38);
    [["....xx", "...x..", "..x...", ".x....", "x.....", "ooo...", "ooo...", ".o...."], ["..x", "..x", "..x", "..x", "..x", ".oo", "ooo", "ooo", ".o."], [".x.", ".x.", ".x.", ".x.", "sss", "s.s", "sss"], ["..x...", "..x...", "..x...", "ooooo.", "o...ox", "ooooo."]].forEach((rows, i) => {
      const [x, y] = st.lwall(6.55 + i * 0.45, 38); pix(ctx, R(x) - 2, R(y) + 1, rows, { x: "#7a5030", o: "#8a8a8e", s: "#6a6a70" });
    });
    // a small window on each wall, and the door with the alms box beside it
    window_(k, "l", 10.2, 11.4, 36, 50, { frame: tim, beam: false });
    window_(k, "r", 10.4, 11.6, 36, 50, { frame: tim, reach: 3.5 });
    P.fillPoly(ctx, st.quad(st.rwall, 13.3, 15.1, 0, 30), shade(tim, -0.3));
    P.fillPoly(ctx, st.quad(st.rwall, 13.45, 14.95, 0, 28), (x, y) => { const [a, h] = st.onR(x, y); return K().frac(a * 3.4) < 0.12 ? shade(S.door, -0.35) : Math.abs(h - 7) < 1 || Math.abs(h - 21) < 1 ? "#2a2626" : h01p(a, h) ? shade(S.door, 0.08) : S.door; });
    { const [x, y] = st.rwall(14.7, 13); ctx.fillStyle = "#c8a040"; ctx.fillRect(R(x), R(y), 1, 2); }
    P.slab(ctx, st, 12.2, 0, 0.75, 0.5, 7, { base: "#6a4428", top: "#7e5232", left: (x, y) => ((x + y) % 5 ? "#6a4428" : "#5a3a20"), right: "#4a2e1a" }, 16);
    { const [x, y] = st.up(st.iso(12.55, 0.25), 23); ctx.fillStyle = "#1a120c"; ctx.fillRect(R(x) - 2, R(y), 4, 1); ctx.fillStyle = "#8a8a8e"; for (const dx of [-5, 3]) ctx.fillRect(R(x) + dx, R(y) + 3, 1, 6); }
    { const [x, y] = st.rwall(12.6, 30); pix(ctx, R(x) - 3, R(y), [".ccc.", "cyyyc", "cyxyc", "cyyyc", ".ccc."], { c: "#a87a20", y: "#e8c050", x: "#a87a20" }); }

    // a plate rack over the back table, a banner in the town's colours, strings of onions
    P.slab(ctx, st, 3.6, 0, 6.4, 0.35, 2, shade(tim, 0.12), 48);
    for (let u = 3.85; u < 9.9; u += 0.4) {
      const [x, y] = st.rwall(u, 50), i = Math.round(u * 2.5);
      if (i % 3 === 0) pix(ctx, R(x) - 2, R(y) - 5, [".xxx.", "xyyyx", "xyzyx", "xyyyx", ".xxx."], { x: "#8a7a62", y: "#e8dcc0", z: "#c8b088" });
      else if (i % 3 === 1) pix(ctx, R(x) - 1, R(y) - 4, ["xxx.", "xyyx", "xyyx", "xxx."], { x: "#5a3a20", y: "#8a6038" });
      else pix(ctx, R(x) - 2, R(y) - 3, ["xxxxx", "xyyyx", ".xxx."], { x: "#7a4a26", y: "#a8784a" });
    }
    P.fillPoly(ctx, [st.rwall(1.6, 44), st.rwall(3.2, 44), st.rwall(3.2, 24), st.rwall(2.4, 19), st.rwall(1.6, 24)], (x, y) => { const [a, h] = st.onR(x, y); return Math.abs(a - 2.4) < 0.42 && Math.abs(h - 33) < 5 ? (Math.abs(a - 2.4) < 0.26 && Math.abs(h - 33) < 3 ? shade(th.accent, 0.3) : th.accent) : K().frac(a * 1.6) < 0.08 ? shade(th.primary, -0.25) : th.primary; });
    P.slab(ctx, st, 1.5, 0, 1.8, 0.2, 2, "#4a2e1a", 44);
    for (const [vv, n] of [[8.1, 7], [8.7, 6]]) for (let j = 0; j < n; j++) { const [x, y] = st.lwall(vv + (j % 2) * 0.08, 62 - j * 3); pix(ctx, R(x) - 1, R(y), [".x.", "yyy", "yzy", ".y."], { x: "#6a5030", y: j % 3 ? "#c8964a" : "#d8b070", z: "#a8743a" }); }
    // a broom against the wall, a water butt with its dipper, a pail
    { const [x, y] = st.lwall(15.0, 0); ctx.fillStyle = "#8a6a3a"; for (let j = 0; j < 30; j++) ctx.fillRect(R(x) + R(j / 10), R(y) - 8 - j, 1, 1); pix(ctx, R(x) - 3, R(y) - 9, ["..xxx..", ".xyyyx.", "xyyyyyx", "yyyyyyy", "y.y.y.y"], { x: "#6a4a20", y: "#c8a050" }); }
    { const c = k.piece(), [x, y] = st.iso(0.9, 10.2); P.barrel(c.getContext("2d"), R(x), R(y), 1.1); const g = c.getContext("2d"); g.fillStyle = "#3a5a6a"; g.fillRect(R(x) - 3, R(y) - 15, 7, 1); P.line(g, [R(x) + 2, R(y) - 15], [R(x) + 7, R(y) - 20], "#7a5a30"); k.add(0.9 + 10.2 + 0.7, c); }
    { const c = k.piece(), g = c.getContext("2d"), [x, y] = st.iso(1.9, 11.4); pix(g, R(x) - 4, R(y) - 7, [".xxxxxx.", "xwwwwwwx", "xyyyyyyx", "xyzyyyyx", "xyyyyyyx", ".xyyyyx.", "..xxxx.."], { x: "#4a3a2a", w: "#7aa0b8", y: "#8a6a44", z: "#a8885a" }); k.add(1.9 + 11.4 + 0.3, c); }
    // the tables' shadows on the boards
    for (const [u, v, du, dv] of [[4.4, 1.5, 5.4, 1.0], [6.0, 6.45, 5.2, 1.0]]) P.fillPoly(ctx, [st.iso(u + 0.1, v - 0.2), st.iso(u + du + 0.2, v - 0.2), st.iso(u + du + 0.2, v + dv + 0.25), st.iso(u + 0.1, v + dv + 0.25)], (x, y) => ((x + y) % 2 ? "rgba(40,22,10,0.26)" : "rgba(40,22,10,0.16)"));

    const fire = { x: 0, y: 0, r: 84, k: 0.8 }, fp = st.lwall((v0 + v1) / 2, 8);
    fire.x = fp[0] + 14; fire.y = fp[1] + 4;
    k.lights.push(fire);
    const pot = cauldronArt(st, 0.95, (v0 + v1) / 2, 0.82);
    k.anims.push((c, t, still) => {
      const flick = 0.78 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07;
      fire.k = 0.6 + flick * 0.35;
      if (!L.night) glow(c, fp[0] + 6, fp[1] + 2, 30, "#ffa040", 0.22 * flick);
      P.flames(c, st, t, v0, v1, flick, 0.9, true);
      c.drawImage(pot.cv, 0, 0);
      const [rx, ry] = pot.rim;
      for (let i = 0; i < 5; i++) { const ph = K().frac(t * 0.9 + i * 0.37); if (ph < 0.5) { c.fillStyle = ph < 0.35 ? "#f0c070" : "#fff0c8"; c.fillRect(R(rx - 5 + ((i * 7) % 10)), R(ry - 1 + (i % 3)), ph < 0.35 ? 1 : 2, 1); } }
      for (let i = 0; i < 9; i++) {
        const ph = K().frac(t * 0.28 + i / 9), x = rx + (i - 4) * 1.4 + Math.sin(ph * 5 + i * 1.3) * (2 + ph * 4), y = ry - 2 - ph * 34;
        c.globalAlpha = (ph < 0.15 ? ph / 0.15 : 1 - ph) * 0.42; c.fillStyle = ph < 0.4 ? "#fbf6ec" : "#e8e4dc";
        c.fillRect(R(x), R(y), 2 + R(ph * 3), 2);
      }
      c.globalAlpha = 1;
    });

    // firewood by the hearth, turnips and sacks of meal on the other side
    { const c = k.piece(), g = c.getContext("2d");
      for (let j = 0; j < 4; j++) for (let i = 0; i < 6 - j; i++) { const [x, y] = st.up(st.iso(0.35, 6.3 + i * 0.3 + j * 0.15), 3 + j * 4); ellipse(g, x, y, 2.6, 2.3, (dx, dy) => (dx * dx + dy * dy < 0.25 ? "#c8945a" : dx * dx + dy * dy < 0.6 ? "#a87444" : "#5a3a1e")); }
      k.add(0.7 + 8.2, c); }
    for (const [u, v, col] of [[0.5, 0.6, "#c8b48a"], [1.2, 0.5, "#b8a47a"]]) {
      const c = k.piece(), g = c.getContext("2d"), [x, y] = st.iso(u, v);
      pix(g, R(x) - 5, R(y) - 13, ["...xx.....", "..xyyx....", ".xyyyyxx..", "xyyzyyyyx.", "xyyyyyzyyx", "xyzyyyyyyx", "xyyyyyyzyx", "xyyyyyyyyx", "xyyyzyyyyx", "xyyyyyyyyx", "xzyyyyyyzx", ".xxyyyyxx.", "...xxxx..."], { x: shade(col, -0.45), y: col, z: shade(col, -0.15) });
      k.add(u + v + 0.6, c);
    }
    basket(k, 1.5, 1.4, "#c87a3a");

    // the long tables with their benches, the regulars already at the back one
    const wood = "#b48858", woodB = "#7a5232";
    longBench(k, 4.4, 0.55, 5.4, 0.42, woodB);
    const POOR = [{ hood: "#6a5a48", skin: "#d8a880", coat: "#6a5a48" }, { hood: "#9a9aa6", skin: "#e8c0a0", coat: "#5a6a52" }, { hood: "#4a3a2c", skin: "#a87048", coat: "#7a5440" }, { hood: "#7a6250", skin: "#c89068", coat: "#6a6458" }];
    [[5.3, 0.95], [6.9, 0.95], [8.6, 0.95]].forEach(([u, v], i) => sitter(k, u, v, POOR[(i + R(r() * 4)) % 4]));
    trestle(k, 4.4, 1.5, 5.4, 1.0, wood);
    longBench(k, 4.4, 2.85, 5.4, 0.42, woodB);
    longBench(k, 6.0, 5.6, 5.2, 0.42, woodB);
    trestle(k, 6.0, 6.45, 5.2, 1.0, wood);
    longBench(k, 6.0, 7.85, 5.2, 0.42, woodB);
    // what's on the tables: bowls of soup, spoons, bread, a jug, a candle by night
    const deck = k.piece(), dg = deck.getContext("2d");
    for (const [u, v, soup] of [[5.4, 1.8, true], [6.9, 1.75, true], [8.6, 1.8, true], [9.4, 2.2, false], [6.6, 6.9, true], [7.9, 6.8, true], [9.2, 6.9, false], [10.4, 7.1, true]]) { const [x, y] = st.up(st.iso(u, v), 9); bowl(dg, R(x), R(y), soup); dg.fillStyle = "#a8a8b0"; dg.fillRect(R(x) + 3, R(y) - 3, 1, 3); }
    for (const [u, v] of [[6.2, 2.1], [8.6, 7.1]]) { const [x, y] = st.up(st.iso(u, v), 9); loaf(dg, R(x), R(y)); }
    for (const [u, v, col] of [[7.7, 2.0, "#a8885a"], [7.2, 6.8, "#8a6a4a"]]) { const [x, y] = st.up(st.iso(u, v), 9); jug(dg, R(x), R(y), col); }
    for (const [u, v] of [[5.0, 1.9], [6.6, 1.9], [8.3, 1.9]]) { const [x, y] = st.up(st.iso(u, v), 9); dg.fillStyle = "#d8a880"; dg.fillRect(R(x) - 1, R(y) - 1, 2, 1); }
    k.add(9.8 + 2.5 + 0.01, deck);
    if (L.lamps) for (const [u, v] of [[7.4, 2.0], [8.4, 6.95]]) k.candles.push(st.up(st.iso(u, v), 9));

    // the blankets for the night, folded and stacked on a chest
    { const c = k.piece(), g = c.getContext("2d");
      P.slab(g, st, 10.9, 0.15, 1.1, 0.75, 6, { base: "#6a4428", left: (x, y) => ((x % 6) < 1 ? "#4a2e1a" : "#7a5030"), right: "#4a2e1a" });
      const wool = ["#8a5a3a", "#6a7258", "#a8483a", "#c8b898", "#5e6a74", "#9a7a4a", "#7a4a3a"];
      let z = 6;
      for (let i = 0; i < 7; i++) { const col = wool[(i + R(r() * 7)) % wool.length], o = (r() - 0.5) * 0.08, hh = 2 + (i % 2); P.slab(g, st, 11.0 + o, 0.2, 0.95, 0.64, hh, { base: col, top: shade(col, 0.16), left: (x, y) => (y % 3 === 0 ? shade(col, -0.2) : col), right: shade(col, -0.32) }, z, false); z += hh; }
      k.add(12.0 + 0.9, c); }

    // the poor's coats on pegs by the door
    for (let i = 0; i < 4; i++) { const [x, y] = st.lwall(12.2 + i * 0.6, 42); ctx.fillStyle = "#3a2414"; ctx.fillRect(R(x), R(y) - 1, 2, 2); if (i !== 2) pix(ctx, R(x) - 2, R(y) + 1, [".cc..", "cccc.", "ccdcc", "ccdcc", "ccdcc", "cc.cc"], { c: ["#6a5a48", "#5a6250", "#7a5440", "#6a6458"][i], d: "#3a3028" }); }

    k.spot("cauldron", 2.6, 3.6, 1); k.spot("act", 2.6, 3.6, 1); k.spot("npc", 3.6, 0.9, -1); k.spot("in", 14.2, 1.6, -1);
    k.spot("mate", 4.4, 8.4, -1); k.spot("pet", 3.6, 8.9, -1); k.spot("other", 5.4, 9.4, -1); k.spot("bench", 10.6, 5.85, -1); k.spot("seat", 10.6, 5.85, -1);
    k.crowd([[6.7, 5.85, -1], [8.0, 5.85, -1], [9.3, 5.85, -1]]);
    k.npc = { kind: "attendant" };
    k.lamps.push([7.2, 2.0, 66], [8.6, 7.0, 62]);
  }
  const h01p = (a, h) => K().h01(Math.floor(a * 3.4), Math.floor(h / 6)) > 0.8;

  // ---------- the infirmary: limewash, flagstones, a row of cots with the sick asleep, herbs, basins and bandages ----------
  function limeWall(S, th) {
    const { mix, shade, h01, frac, M } = K();
    const lime = [mix(S.plaster[0], "#f2f2ea", 0.7), mix(S.plaster[1], "#e8e8de", 0.65)], plinth = M.stone(S.stone.map((c) => shade(c, 0.12)), shade(S.mortar, 0.1), 5, 0.9);
    const band = mix(th.primary, "#8a8478", 0.45);
    return (a, h) => {
      if (h < 11) return plinth(a, h);
      if (h < 12.5) return shade(S.stone[0], 0.28);
      if (Math.abs(h - 32) < 1.6) return Math.abs(h - 32) > 1.0 ? shade(band, -0.2) : frac(a * 2) < 0.1 ? mix(th.accent, "#e8e0c8", 0.3) : band;
      if (h < 32) { const n = h01(Math.floor(a * 6), Math.floor(h / 3)), sage = mix(S.plaster[1], "#a8b498", 0.55), c = n > 0.6 ? shade(sage, -0.04) : sage; return h < 18 ? mix(c, "#8a8a70", (18 - h) / 30) : c; }
      if (h > 95) return shade(lime[1], -0.12);
      const n = h01(Math.floor(a * 6), Math.floor(h / 3));
      let c = n > 0.93 ? shade(lime[0], -0.05) : n > 0.55 ? lime[1] : lime[0];
      if (h01(Math.floor(a * 3), Math.floor(h / 12)) > 0.86 && frac(a * 9) < 0.5) c = shade(c, -0.03);
      if (h < 22) c = mix(c, "#c8c6b0", ((22 - h) / 10) * 0.25);
      return c;
    };
  }
  function infFloor(S) {
    const { mix, shade, h01, frac } = K(), cols = S.stone.map((c) => mix(shade(c, 0.2), "#d8d0c0", 0.25)), gap = shade(S.mortar, 0.15);
    return (u, v) => {
      const row = Math.floor(v * 1.1), kk = u * 0.9 + (row % 2 ? 0.5 : 0), col = Math.floor(kk), fy = v * 1.1 - row, fx = kk - col;
      if (fy < 0.06 || fx < 0.05) return gap;
      const c = cols[Math.floor(h01(row, col) * cols.length)];
      if (fy > 0.9 || fx > 0.94) return shade(c, -0.1);
      if (fy < 0.16) return shade(c, 0.08);
      // a rush runner down the aisle in front of the cots
      return h01(Math.floor(u * 7), Math.floor(v * 7)) > 0.9 ? shade(c, -0.05) : c;
    };
  }
  function runner(k, u0, u1, v0, v1) {
    const { st, ctx } = k, P = Tv(), { frac } = K();
    P.fillPoly(ctx, [st.iso(u0, v0), st.iso(u1, v0), st.iso(u1, v1), st.iso(u0, v1)], (x, y) => {
      const [u, v] = st.toUV(x, y);
      if (v - v0 < 0.12 || v1 - v < 0.12) return "#8a7040";
      if (u - u0 < 0.25 || u1 - u < 0.25) return (x % 2) ? "#c8b070" : null;
      const w = (Math.floor(u * 5) + Math.floor(v * 5)) % 2, f = frac(u * 5);
      return f < 0.15 ? "#9a7e48" : w ? "#c8ac6a" : "#b8985a";
    });
  }
  // a cot with someone asleep in it, its head to a wall (along "v": head at the back wall; along "u": head at the left wall); two frames for the breath
  function cotArt(st, u, v, wide, long, axis, look, breath) {
    const P = Tv(), { shade, pix } = K(), c = st.canvas(), g = c.getContext("2d"), wood = "#7a5232", [b0, b1] = look.blanket;
    const box = (a0, l0, da, dl) => (axis === "v" ? [u + a0, v + l0, da, dl] : [u + l0, v + a0, dl, da]);
    const slab = (a0, l0, da, dl, h, col, z, e) => { const [bu, bv, du, dv] = box(a0, l0, da, dl); P.slab(g, st, bu, bv, du, dv, h, col, z, e); };
    { const [bu, bv, du, dv] = box(0, 0, wide, long); P.legs(g, st, bu, bv, du, dv, 7, shade(wood, -0.1), 0.06); }
    slab(0, 0, wide, 0.12, 16, { base: wood, top: shade(wood, 0.2), left: (x, y) => (y % 4 ? wood : shade(wood, -0.15)), right: shade(wood, -0.3) }, 0);
    slab(0, 0, wide, long, 2, { base: wood, left: wood, right: shade(wood, -0.3), top: shade(wood, 0.1) }, 6);
    slab(0.05, 0.12, wide - 0.1, long - 0.17, 2, { base: "#d8ccaa", top: (x) => (x % 3 ? "#e8dec0" : "#c8bc98"), left: "#c8bc98", right: "#a89c7a" }, 8, false);
    slab(0.12, 0.16, wide - 0.26, 0.5, 2, { base: "#e8e4d8", top: "#f8f6ee", left: "#dcd8cc", right: "#c8c4b8" }, 10, false);
    const quilt = (x, y) => ((((x >> 1) + y) % 6 === 0) ? b1 : ((x + (y >> 1)) % 9 === 0 ? shade(b0, 0.12) : b0));
    slab(0.04, 0.78, wide - 0.08, long - 0.82, 2, { base: b0, top: quilt, left: shade(b0, -0.08), right: shade(b0, -0.3) }, 10);
    slab(0.04, 0.78, wide - 0.08, 0.2, 1, { base: "#f0ece0", top: "#faf8f0", left: "#e0dcd0", right: "#c8c4b8" }, 12, false);
    slab(0.2, 1.0, wide - 0.42, long - 1.5, 1 + breath, { base: b0, top: quilt, left: shade(b0, -0.1), right: shade(b0, -0.26) }, 12, false);
    slab(0.26, long - 0.6, wide - 0.55, 0.36, 1, { base: b0, top: shade(b0, 0.06), left: shade(b0, -0.12), right: shade(b0, -0.3) }, 12, false);
    const [hu, hv] = box(wide / 2 - 0.05, 0.45, 0, 0), [hx, hy] = st.up(st.iso(hu, hv), 12), x = R(hx), y = R(hy);
    pix(g, x - 3, y - 4, look.band ? [".hhhh.", "wwwwww", "hsssshh", "hesessh", ".ssss.", "..ss.."] : [".hhhh.", "hhhhhh", "hsssshh", "hesessh", ".ssss.", "..ss.."],
      { h: look.hair, s: look.skin, e: shade(look.skin, -0.5), w: "#f8f4ea" });
    if (look.arm) { const [au, av] = box(wide - 0.25, 1.25, 0, 0), [ax, ay] = st.up(st.iso(au, av), 12 + breath); pix(g, R(ax) - 2, R(ay) - 2, ["sss.", "swww", ".www"], { s: look.skin, w: "#f8f4ea" }); }
    return c;
  }
  function infirmary(k) {
    const { st, ctx, S, th, r, L } = k, P = Tv(), { shade, pix, frac, h01, room, window_, basket } = K();
    room(k, limeWall(S, th), infFloor(S), { beam: "#3a2a1e", ceiling: "#2a1e16", skirt: shade(S.stone[1], -0.1) });
    runner(k, 0.9, 14.6, 3.5, 4.3);
    window_(k, "r", 5.3, 6.9, 28, 58, { frame: "#5a4030", reach: 6, arch: true, bars: [5.83, 6.37] });
    window_(k, "l", 12.4, 13.6, 34, 52, { frame: "#5a4030", reach: 3.5 });
    // the light from the big window falling through the air, motes turning in it
    if (!L.night) {
      const a0 = 5.3, a1 = 6.9, rch = 6, top = [st.rwall(a0, 58), st.rwall(a1, 58)], foot = [st.iso(a1 + rch * 0.5, rch), st.iso(a0 + rch * 0.5, rch)];
      const shaft = st.canvas(), sg = shaft.getContext("2d");
      P.fillPoly(sg, [top[0], top[1], foot[0], foot[1]], (x, y) => ((x + y) % 3 === 0 ? "rgba(255,248,222,0.12)" : "rgba(255,248,222,0.06)"));
      k.anims.push((c, t, still) => {
        c.drawImage(shaft, 0, 0);
        for (let i = 0; i < 16; i++) {
          const ph = frac((still ? 0.3 : t * 0.03) + h01(i, 4)), s = h01(i, 5), A = [top[0][0] + (top[1][0] - top[0][0]) * s, top[0][1] + (top[1][1] - top[0][1]) * s], B = [foot[1][0] + (foot[0][0] - foot[1][0]) * s, foot[1][1] + (foot[0][1] - foot[1][1]) * s];
          c.fillStyle = i % 3 ? "rgba(255,250,230,0.7)" : "rgba(255,240,200,0.9)"; c.fillRect(R(A[0] + (B[0] - A[0]) * ph + Math.sin(t * 0.7 + i) * 1.5), R(A[1] + (B[1] - A[1]) * ph), 1, 1);
        }
      });
    }
    // the healer's sign high on the left wall: a sprig on a white roundel in a ring of the town's colour
    { const [x, y] = st.lwall(7.4, 60), ring = shade(th.accent, -0.15);
      pix(ctx, R(x) - 6, R(y) - 6, ["...rrrrrr...", ".rrwwwwwwrr.", ".rwwwwggwwr.", "rwwwwwgwwwwr", "rwwggggwwwwr", "rwwwwgwggwwr", "rwwwwggggwwr", "rwwwwgwwwwwr", ".rwwwwgwwwr.", ".rrwwwwwwrr.", "...rrrrrr..."], { w: "#f4f0e2", g: "#4e7a3a", r: ring }); }
    // a chart of the body pinned up, and pegs with the healer's aprons
    { const [x, y] = st.lwall(9.6, 58); pix(ctx, R(x) - 6, R(y) - 4, ["pppppppppppp", "pppppsspppkp", "pkkppsspppkp", "ppppssssppkp", "pkkpsssspppp", "pppppsspppkp", "pkkppspsppkp", "pppppspspppp", "pppppppppppp"], { p: "#e8dcb8", s: "#b06a4a", k: "#8a7a5a" }); }
    for (let i = 0; i < 2; i++) { const [x, y] = st.lwall(11.0 + i * 0.6, 40); ctx.fillStyle = "#3a2414"; ctx.fillRect(R(x), R(y) - 1, 2, 2); pix(ctx, R(x) - 2, R(y) + 1, [".ww..", "wwww.", "wwwww", "wwlww", "wwwww", "ww.ww"], { w: i ? "#e8e2d2" : "#d8d0b8", l: "#b8b0a0" }); }
    // bunches of herbs drying from a pole along the back wall, over the cots
    P.slab(ctx, st, 7.3, 0, 7.4, 0.2, 1, "#5a3a20", 62);
    for (let i = 0; i < 10; i++) {
      const col = ["#6a8a42", "#a8a04a", "#8a6a3a", "#5a7a4a", "#c8a85a", "#7a9a5a", "#9a7a44"][i % 7], [x, y] = st.rwall(7.6 + i * 0.72, 62);
      pix(ctx, R(x) - 2, R(y), ["..x..", "..r..", ".yyy.", "yyzyy", "yzyyz", ".yzy.", ".y.y.", "..y.."].slice(0, 6 + (i % 3)), { x: "#3a2414", r: "#c84a3a", y: col, z: shade(col, -0.25) });
    }
    // a shelf of rolled linen and jars over the far cots
    P.slab(ctx, st, 8.4, 0, 5.0, 0.35, 2, "#6a4428", 46);
    for (let u = 8.6; u < 13.3; u += 0.42) { const [x, y] = st.rwall(u, 48), i = R(u * 2.4) % 3; pix(ctx, R(x) - 2, R(y) - 4, i === 0 ? [".ww.", "wllw", "wwww", "wllw"] : i === 1 ? [".x.", "yyy", "yzy", "yyy"] : ["xx.", "yyy", "yyy", "yyy"], { w: "#f4f0e4", l: "#d8d0bc", x: "#5a3a20", y: ["#c8843a", "#5a8a5a", "#d8d0b8"][R(u * 7) % 3], z: "#f8f0dc" }); }
    // the herb shelf: jars, bottles, a pestle, folded linen
    { const c = k.piece(), g = c.getContext("2d"), sv0 = 3.4, sv1 = 6.0, wood = "#6a4428";
      P.fillPoly(g, st.quad(st.lwall, sv0, sv1, 0, 38), (x, y) => (y % 4 ? "#4a2e1a" : "#3e2616"));
      for (const z of [0, 9, 18, 27, 36]) P.slab(g, st, 0, sv0, 0.75, sv1 - sv0, 2, { base: wood, top: shade(wood, 0.18), left: shade(wood, 0.04), right: shade(wood, -0.3) }, z);
      const JAR = [[".xx.", "yyyy", "yzyy", "yyyy", "yyyy"], ["..x.", ".xx.", "yyyy", "yzyy", "yyyy", "yyyy"], [".x.", "yyy", "yzy", "yyy"], ["xxxx", "wwww", "wllw", "wwww"]];
      const COLS = ["#c8843a", "#5a8a5a", "#d8d0b8", "#8a5a3a", "#6a9a8a", "#c8b060", "#e8e2d0", "#7a8a4a"];
      for (const z of [2, 11, 20, 29, 38]) for (let vv = sv0 + 0.25; vv < sv1 - 0.2; vv += 0.36) {
        if (r() < 0.12) continue;
        const [x, y] = st.up(st.iso(0.4, vv), z), j = JAR[Math.floor(r() * JAR.length)], col = COLS[Math.floor(r() * COLS.length)];
        pix(g, R(x) - 2, R(y) - j.length, j, { x: "#5a3a20", y: col, z: shade(col, 0.35), w: "#ece6d4", l: "#8a6a3a" });
      }
      for (const z of [0, 9, 18, 27, 36]) P.line(g, st.up(st.iso(0.75, sv0), z + 2), st.up(st.iso(0.75, sv1), z + 2), shade(wood, 0.34));
      for (const vv of [sv0, sv1]) P.slab(g, st, 0, vv - 0.06, 0.78, 0.1, 38, { base: wood, left: shade(wood, -0.05), right: shade(wood, -0.3) });
      k.add(0.8 + sv1, c); }
    // the washstand: a basin of warm water, a ewer, towels
    { const c = k.piece(), g = c.getContext("2d"), [u, v, du, dv] = [0.25, 6.4, 0.85, 1.3];
      P.table(g, st, u, v, du, dv, 11, "#7a5232");
      const [bx, by] = st.up(st.iso(u + 0.45, v + 0.5), 11);
      ellipse(g, bx, by - 2, 5.5, 2.8, (dx, dy) => (dx * dx + dy * dy > 0.55 ? (dy < 0 ? "#b8bcc0" : "#e8ecee") : dy < -0.1 ? "#7aa0b8" : "#9ac0d4"));
      g.fillStyle = "#8a9096"; g.fillRect(R(bx) - 4, R(by), 9, 1);
      const [ex, ey] = st.up(st.iso(u + 0.4, v + 1.05), 11);
      pix(g, R(ex) - 3, R(ey) - 9, ["..xxx..", ".xyyyx.", "x.xyyx.", "x.yyzy.", "x.yyyyx", ".xyyyyx", "..yyyy.", "..yyyy.", "..xxxx."], { x: "#8a8478", y: "#e8e4d8", z: "#fff8ec" });
      P.fillPoly(g, [st.up(st.iso(u + du, v + 0.2), 11), st.up(st.iso(u + du, v + 0.75), 11), st.up(st.iso(u + du, v + 0.75), 3), st.up(st.iso(u + du, v + 0.2), 4)], (x, y) => (y % 3 ? "#f0ece0" : "#d8d2c2"));
      k.add(u + du + v + dv, c);
      k.anims.push((cc, t) => { for (let i = 0; i < 4; i++) { const ph = frac(t * 0.3 + i / 4); cc.globalAlpha = (1 - ph) * 0.3; cc.fillStyle = "#ffffff"; cc.fillRect(R(bx - 2 + i * 1.5 + Math.sin(ph * 6 + i) * 2), R(by - 4 - ph * 16), 2, 1); } cc.globalAlpha = 1; });
    }

    // two rows of cots, the sick asleep in them, breathing: heads to the back wall, and two heads to the left wall
    const HAIR = ["#3a2a1a", "#6a4020", "#c8a050", "#9a9aa6", "#2a2228", "#a04a20"], SKIN = ["#f0c8a0", "#e0b088", "#c48a5e", "#9a6440", "#d8a07a"];
    const BLANK = [["#7a8a6a", "#a8b48a"], ["#8a6a4a", "#b89a6a"], ["#6a7a8a", "#98a8b4"], ["#a87a5a", "#d0ac84"], ["#8a7a5a", "#b8a880"]];
    const COTS = [[1.0, 0.3, "v"], [3.2, 0.3, "v"], [7.8, 0.3, "v"], [10.1, 0.3, "v"], [0.3, 8.4, "u"], [0.3, 10.4, "u"]], cots = [];
    COTS.forEach(([u, v, ax], i) => {
      const look = { hair: HAIR[Math.floor(r() * HAIR.length)], skin: SKIN[Math.floor(r() * SKIN.length)], blanket: BLANK[i % BLANK.length], band: i === 2, arm: i === 2 };
      cots.push({ f: [0, 1].map((b) => cotArt(st, u, v, 1.15, 2.8, ax, look, b)), ph: i * 1.7 });
    });
    k.anims.push((c, t, still) => { for (const ct of cots) c.drawImage(ct.f[!still && Math.sin(t * 1.5 + ct.ph) > 0.2 ? 1 : 0], 0, 0); });
    // the end cot stands empty, made up for whoever comes next
    { const c = k.piece(), g = c.getContext("2d"), u = 12.4, v = 0.3;
      P.legs(g, st, u, v, 1.15, 2.8, 7, "#6a4428", 0.06); P.slab(g, st, u, v, 1.15, 0.12, 16, { base: "#7a5232", top: "#9a7048", right: "#5a3a20" });
      P.slab(g, st, u, v, 1.15, 2.8, 2, { base: "#7a5232", right: "#5a3a20", top: "#8a6038" }, 6);
      P.slab(g, st, u + 0.05, v + 0.12, 1.05, 2.63, 2, { base: "#d8ccaa", top: (x) => (x % 3 ? "#e8dec0" : "#c8bc98"), left: "#c8bc98", right: "#a89c7a" }, 8, false);
      P.slab(g, st, u + 0.15, v + 1.6, 0.85, 0.7, 3, { base: "#6a7a8a", top: (x, y) => (y % 3 ? "#7a8a9a" : "#5a6a7a"), left: "#5a6a7a", right: "#4a5a6a" }, 10, false);
      P.slab(g, st, u + 0.14, v + 0.2, 0.86, 0.45, 2, { base: "#e8e4d8", top: "#f8f6ee", left: "#dcd8cc", right: "#c8c4b8" }, 10, false);
      k.add(u + 1.15 + v + 2.8, c); }
    // the bedside table by the hurt one: a cup, rolled bandages, a candle
    { const c = k.piece(), g = c.getContext("2d"), [u, v] = [9.2, 0.25];
      P.table(g, st, u, v, 0.7, 0.6, 9, "#6a4428");
      const [x, y] = st.up(st.iso(u + 0.4, v + 0.4), 9);
      pix(g, R(x) - 4, R(y) - 4, [".ww....", "wwww.cc", "wlww.cy", ".ww..cc"], { w: "#f4f0e4", l: "#d8d0bc", c: "#8a6a4a", y: "#c8a060" });
      k.add(u + 0.7 + v + 0.6, c);
      if (L.lamps) k.candles.push(st.up(st.iso(u + 0.2, v + 0.15), 9)); }
    // the healer's table: a mortar, rolled bandages, folded linen, a stool; a basket of clean linen
    { const c = k.piece(), g = c.getContext("2d"), [u, v, du, dv] = [4.4, 5.6, 1.6, 1.0];
      P.fillPoly(ctx, [st.iso(u, v - 0.1), st.iso(u + du + 0.2, v - 0.1), st.iso(u + du + 0.2, v + dv + 0.2), st.iso(u, v + dv + 0.2)], "rgba(30,24,20,0.16)");
      P.table(g, st, u, v, du, dv, 10, "#9a7048");
      const at = (uu, vv) => st.up(st.iso(u + uu, v + vv), 10).map(R);
      { const [x, y] = at(0.35, 0.4); pix(g, x - 3, y - 5, ["..x...", ".xx...", "xyyyyx", "xyzyyx", ".xyyx.", "..xx.."], { x: "#6a6660", y: "#a8a49c", z: "#5a7a3a" }); }
      { const [x, y] = at(1.0, 0.3); pix(g, x - 4, y - 3, ["wwww.ww.", "wllw.wlw", "wwww.ww."], { w: "#f4f0e4", l: "#d8d0bc" }); }
      { const [x, y] = at(0.9, 0.75); pix(g, x - 4, y - 2, ["eeeeeeee", "dddddddd"], { e: "#ece6d4", d: "#cfc6b0" }); }
      { const [x, y] = at(1.4, 0.6); pix(g, x - 1, y - 6, [".x.", "yyy", "yzy", "yyy", "yyy"], { x: "#5a3a20", y: "#5a8a5a", z: "#9ac09a" }); }
      k.add(u + du + v + dv, c);
      const s = k.piece(); P.stool(s.getContext("2d"), st, 6.4, 6.2, "#6a4428"); k.add(6.4 + 6.2 + 0.4, s); }
    basket(k, 7.0, 4.9, "#ece6d4");
    // a brazier keeping the room warm, its coals alive
    { const c = k.piece(), g = c.getContext("2d"), [x, y] = st.iso(11.0, 6.4);
      g.fillStyle = "#2a2624"; g.fillRect(R(x) - 4, R(y) - 5, 1, 5); g.fillRect(R(x) + 3, R(y) - 5, 1, 5); g.fillRect(R(x), R(y) - 4, 1, 4);
      ellipse(g, x, y - 8, 6, 3.2, (dx, dy) => (dy < -0.2 ? null : dx < -0.4 ? "#5a5652" : dx > 0.5 ? "#24201c" : "#34302c"));
      k.add(11.0 + 6.4 + 0.3, c);
      k.anims.push((cc, t, still) => {
        ellipse(cc, x, y - 9, 5, 2, (dx, dy, px, py) => (h01(px, py + Math.floor((still ? 1 : t) * 3)) > 0.6 ? "#ffb040" : h01(px * 3, py) > 0.4 ? "#c8501e" : "#6a2a14"));
        for (let i = 0; i < 3; i++) { const ph = frac(t * 0.4 + i / 3); cc.globalAlpha = (1 - ph) * 0.25; cc.fillStyle = "#c8c0b8"; cc.fillRect(R(x - 1 + Math.sin(ph * 5 + i) * 2), R(y - 12 - ph * 14), 2, 2); }
        cc.globalAlpha = 1;
      });
      k.lights.push({ x, y: y - 10, r: 34, k: 0.4 }); }
    // a pail and mop by the far end
    { const c = k.piece(), g = c.getContext("2d"), [x, y] = st.iso(13.8, 4.6); pix(g, R(x) - 4, R(y) - 7, [".xxxxxx.", "xwwwwwwx", "xyyyyyyx", "xyzyyyyx", "xyyyyyyx", ".xyyyyx.", "..xxxx.."], { x: "#4a3a2a", w: "#9ac0d4", y: "#8a6a44", z: "#a8885a" }); P.line(g, [R(x) + 2, R(y) - 6], [R(x) + 8, R(y) - 30], "#8a6a3a"); k.add(13.8 + 4.6 + 0.3, c); }

    k.spot("cot", 9.5, 2.1, -1); k.spot("act", 9.5, 2.1, -1); k.spot("patient", 8.4, 0.9); k.spot("npc", 2.4, 5.6, 1); k.spot("in", 14.4, 7.4, -1);
    k.spot("mate", 7.6, 7.6, -1); k.spot("pet", 7.0, 8.4, -1); k.spot("other", 8.8, 8.2, -1); k.spot("bench", 6.45, 6.35, -1); k.spot("seat", 6.45, 6.35, -1);
    k.crowd([]);
    k.npc = { kind: "healer" };
    k.lamps.push([5.4, 3.4, 66], [10.6, 4.2, 62]);
  }

  root.TownSets.register("poorhouse", poorhouse);
  root.TownSets.register("infirmary", infirmary);
})(typeof window !== "undefined" ? window : globalThis);
