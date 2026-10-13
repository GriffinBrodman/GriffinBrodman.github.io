/* Tonight: the hero at the end of today, staged from the exported `tonight` (league/export.py _tonight). A campfire under
   the stars on the road or in the wild, a torch-lit camp on a dungeon floor, a cell, the stables, a rented room, a home,
   or the inn's common room (Tavern.inn). Lines come from league.voice.night_lines; this file only stages them. */
(function () {
  "use strict";
  const W = 200, H = 150;
  const T = () => window.Tavern;
  const fp = (...a) => T().fillPoly(...a);

  function pix(ctx, x, y, rows, pal) {
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x + i, y + j, 1, 1); } } });
  }
  function layer(st, paint) { const cv = st.canvas(), ctx = cv.getContext("2d"); paint(ctx); return cv; }
  // Anim's small looping actors (anim.js), when that file is present; each scene keeps working without them
  const anim = (name, o) => (window.Anim && typeof Anim[name] === "function" ? Anim[name](o) : null);
  const drawAll = (ctx, list, t) => { for (const a of list) if (a) a.draw(ctx, t); };
  // places given as screen offsets in pixels from a centre spot, so nobody stands in front of anybody else
  const fromScreen = (cu, cv, pts) => pts.map(([sx, sy]) => [cu + (sx / 8 + sy / 4) / 2, cv + (sy / 4 - sx / 8) / 2]);

  // ---------- ground and sky for the open-air camp ----------
  const GROUND = {
    plains: { a: "#26361f", b: "#2c3d23", c: "#33482a", far: "#1c2818", hill: "#141c1a", tuft: "#3e5530" },
    forest: { a: "#1f2e1c", b: "#243520", c: "#2b3f26", far: "#162214", hill: "#0e1814", tuft: "#36502c" },
    hills: { a: "#2c3222", b: "#323826", c: "#3a402c", far: "#20261c", hill: "#181c1e", tuft: "#465034" },
    marsh: { a: "#25301f", b: "#2a3522", c: "#303c26", far: "#1c2418", hill: "#121a18", tuft: "#3a4a2a", water: "#162430" },
    coast: { a: "#4a4636", b: "#524c3a", c: "#5a5440", far: "#3a3830", hill: "#141a26", tuft: "#5a6040", sea: true },
    snow: { a: "#7c88a2", b: "#8692ac", c: "#929eb8", far: "#5c6680", hill: "#2a3046", tuft: "#a8b2c8" },
    volcanic: { a: "#2a2220", b: "#30261f", c: "#372b22", far: "#201816", hill: "#1a1012", tuft: "#4a3428" },
  };
  const HZ = 50;

  function sky(ctx, r, biome) {
    const bands = biome === "volcanic" ? ["#140c18", "#1e1020", "#2c1420", "#40181c"] : ["#0a0f24", "#10183a", "#18224a", "#232c58"];
    for (let y = 0; y < HZ; y++) {
      const f = y / HZ * (bands.length - 1), i = Math.floor(f), frac = f - i;
      for (let x = 0; x < W; x++) {
        const dither = ((x + y) % 2 === 0 ? 0.25 : -0.25) + ((x * 3 + y) % 4 === 0 ? 0.12 : 0);
        ctx.fillStyle = bands[Math.min(bands.length - 1, frac + dither > 0.5 ? i + 1 : i)];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // the moon, a crescent high on the right
    const mx = 160 + Math.floor(r() * 20), my = 10 + Math.floor(r() * 6);
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
      const d = x * x + y * y, cut = (x + 2.5) ** 2 + (y - 1.5) ** 2;
      if (d <= 26 && cut > 18) { ctx.fillStyle = d > 18 ? "#c8c0a0" : "#f0e8c8"; ctx.fillRect(mx + x, my + y, 1, 1); }
    }
    return [mx, my];
  }
  function stars(r, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push({ x: Math.floor(r() * W), y: Math.floor(r() * (HZ - 8)), b: r(), ph: r() * 7, sp: 0.8 + r() * 2.4 });
    return out;
  }
  function horizon(ctx, r, biome, g) {
    const sil = (fn, col) => { for (let x = 0; x < W; x++) { const top = Math.round(fn(x)); for (let y = top; y <= HZ + 2; y++) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } } };
    const n1 = r() * 6, n2 = r() * 6;
    if (biome === "snow" || biome === "hills" || biome === "volcanic") {
      sil((x) => HZ - 14 - Math.abs(((x + n1 * 20) % 70) - 35) * 0.5 - Math.sin(x / 9 + n2) * 2, biome === "volcanic" ? "#1c1014" : "#1a2034");
      if (biome === "snow") for (let x = 0; x < W; x++) { const top = Math.round(HZ - 14 - Math.abs(((x + n1 * 20) % 70) - 35) * 0.5 - Math.sin(x / 9 + n2) * 2); if (top < HZ - 20) { ctx.fillStyle = "#8a94b0"; ctx.fillRect(x, top, 1, 2); } }
      sil((x) => HZ - 5 - Math.sin(x / 17 + n1) * 3, g.hill);
    } else if (biome === "forest") {
      sil((x) => HZ - 4 - Math.sin(x / 23 + n1) * 2, g.hill);
      for (let x = -4; x < W + 4; x += 5 + Math.floor(r() * 4)) {
        const h = 10 + Math.floor(r() * 9);
        for (let j = 0; j < h; j++) { const w = Math.floor(j / 2.2); ctx.fillStyle = g.hill; ctx.fillRect(x - w, HZ - h + j, w * 2 + 1, 1); }
      }
    } else if (g.sea) {
      ctx.fillStyle = "#0e1830"; ctx.fillRect(0, HZ - 6, W, 8);
      ctx.fillStyle = "#16244a"; for (let x = 0; x < W; x += 1) if (r() < 0.2) ctx.fillRect(x, HZ - 6 + Math.floor(r() * 7), 2, 1);
    } else {
      sil((x) => HZ - 4 - Math.sin(x / 31 + n1) * 3 - Math.sin(x / 11 + n2) * 1, g.hill);
      for (let k = 0; k < 4; k++) { const x = Math.floor(r() * W), h = 4 + Math.floor(r() * 4); ctx.fillStyle = g.hill; for (let j = 0; j < h; j++) ctx.fillRect(x - (j > 1 ? 2 : 1), HZ - 4 - h + j, j > 1 ? 5 : 3, 1); }
    }
    if (biome === "marsh") for (let k = 0; k < 3; k++) { const x = Math.floor(r() * W); ctx.fillStyle = g.hill; ctx.fillRect(x, HZ - 14, 1, 12); ctx.fillRect(x - 3, HZ - 11, 3, 1); ctx.fillRect(x + 1, HZ - 9, 3, 1); }
  }
  function ground(ctx, st, r, biome, road) {
    const g = GROUND[biome] || GROUND.plains;
    for (let y = HZ; y < H; y++) for (let x = 0; x < W; x++) {
      const depth = (y - HZ) / (H - HZ), n = r(), m = Math.sin(x * 0.21 + y * 0.63) + Math.sin(x * 0.09 - y * 0.37 + 2) + (n - 0.5) * 0.9;
      let c = depth < 0.12 ? g.far : m < -0.7 ? g.a : m < 0.9 ? g.b : g.c;
      if (g.water && depth > 0.15) { const [u, v] = st.toUV(x, y); if (Math.sin(u * 1.3 + v * 0.4) + Math.sin(v * 1.1 - u * 0.3) > 1.35) c = (x + y) % 3 ? g.water : "#1c3040"; }
      if (road) {
        const [, v] = st.toUV(x, y);
        if (v > 0.7 && v < 1.9) c = Math.abs(v - 1.0) < 0.08 || Math.abs(v - 1.6) < 0.08 ? "#2e261c" : n < 0.5 ? "#3e3426" : "#463a2a";
      }
      ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1);
    }
    for (let k = 0; k < 90; k++) {
      const x = Math.floor(r() * W), y = HZ + 6 + Math.floor(r() * (H - HZ - 6));
      ctx.fillStyle = g.tuft; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 2);
    }
    return g;
  }

  // ---------- props ----------
  const PINE = ["......x......", ".....xax.....", "....xaaax....", "...xaabaax...", "....xabax....", "...xaabaax...", "..xaaabbaax..", "...xaabaax...",
    "..xaaabbaax..", ".xaaaabbaaax.", "..xaaabbbaax.", ".xaaaabbbaaax", "xaaaabbbbaaax", "xxxxxxttxxxxx", "......tt.....", "......tt....."];
  const ROCK = ["..xxxx...", ".xabbax..", "xabbbbax.", "xbbbbbbbx", ".xxxxxxx."];
  const HORSE = ["......o.o...........", ".....obobo..........", ".....obbbo.mm.......", "....obbbbbommm......", "....obebbbbommm.....", "...obbbbbbbdommm....",
    "...obwbbbbbbdommm...", "..obbwbbbbbbbdommm..", "..obbwbobbbbbbdommm.", ".obbwbo.obbbbbbdomm.", ".obbbo...obbbbbbdom.", "obbbo....obbbbbbbdo.",
    "olllo....obbbbbbbdo.", "olnlo....obbbbbbbdo.", ".ooo.....obbbbbbbdo.", ".........obbbbbbbdo."];
  const BONES = ["x...x..", ".x.x...", "..x....", ".x.x.oo", "x...xoo"];
  const BUCKET = [".xxxxx.", "xbbbbbx", ".xcbcx.", ".xbbbx.", "..xxx.."];
  function tent(st, u0, v0, color) {
    return layer(st, (ctx) => {
      const u1 = u0 + 2.2, v1 = v0 + 1.8, vm = (v0 + v1) / 2, h = 15, { iso, up } = st;
      fp(ctx, [iso(u0, v1), iso(u1, v1), up(iso(u1, vm), h), up(iso(u0, vm), h)], (x, y) => ((x + y) % 7 === 0 ? color[2] : color[0]));
      fp(ctx, [iso(u1, v0), iso(u1, v1), up(iso(u1, vm), h)], color[1]);
      fp(ctx, [iso(u1, vm - 0.45), iso(u1, vm + 0.45), up(iso(u1, vm), h * 0.7)], "#140c08");
      const [x0, y0] = up(iso(u0, vm), h), [x1, y1] = up(iso(u1, vm), h);
      ctx.strokeStyle = "#3a2414"; ctx.beginPath(); ctx.moveTo(x0 + 0.5, y0 + 0.5); ctx.lineTo(x1 + 0.5, y1 + 0.5); ctx.stroke();
      ctx.fillStyle = "#3a2414"; ctx.fillRect(Math.round(x1), Math.round(y1) - 3, 1, 3);
    });
  }
  function bedroll(st, u, v, c) { return st.box(u, v, 1.1, 0.5, 2, c[0], c[1], c[2]); }
  function log(st, u, v, du, dv) { return st.box(u, v, du, dv, 3, "#7a5432", "#4a2e18", "#3a2414"); }
  function bed(st, u, v, du, dv, blanket, fancy) {
    return layer(st, (ctx) => {
      ctx.drawImage(st.box(u, v, du, dv, 4, "#6a4226", "#4a2c18", "#3e2414"), 0, 0);
      ctx.drawImage(st.box(u + 0.05, v + 0.05, du - 0.1, dv - 0.1, 3, blanket[0], blanket[1], blanket[2], 4), 0, 0);
      ctx.drawImage(st.box(u + 0.1, v + 0.15, 0.55, dv - 0.3, 2, "#e8e0d0", "#b8b0a0", "#a8a090", 7), 0, 0);
      ctx.drawImage(st.box(u - 0.05, v - 0.05, 0.12, dv + 0.1, fancy ? 34 : 14, "#7a4a28", "#4a2c18", "#3e2414"), 0, 0);
      if (fancy) {
        for (const [pu, pv] of [[u + du - 0.1, v - 0.05], [u + du - 0.1, v + dv - 0.05], [u - 0.05, v + dv - 0.05]]) ctx.drawImage(st.box(pu, pv, 0.12, 0.12, 34, "#7a4a28", "#4a2c18", "#3e2414"), 0, 0);
        const cp = [st.up(st.iso(u, v), 34), st.up(st.iso(u + du, v), 34), st.up(st.iso(u + du, v + dv), 34), st.up(st.iso(u, v + dv), 34)];
        fp(ctx, cp, blanket[1]);
        fp(ctx, [cp[3], cp[2], [cp[2][0], cp[2][1] + 4], [cp[3][0], cp[3][1] + 4]], (x) => (x % 3 ? blanket[0] : blanket[2]));
        fp(ctx, [cp[1], cp[2], [cp[2][0], cp[2][1] + 4], [cp[1][0], cp[1][1] + 4]], (x) => (x % 3 ? blanket[1] : blanket[2]));
      }
    });
  }
  function rug(ctx, st, u0, v0, u1, v1, a, b, edge) {
    fp(ctx, [st.iso(u0, v0), st.iso(u1, v0), st.iso(u1, v1), st.iso(u0, v1)], (x, y) => {
      const [u, v] = st.toUV(x, y);
      if (u < u0 + 0.22 || u > u1 - 0.22 || v < v0 + 0.22 || v > v1 - 0.22) return edge;
      return (Math.floor(u * 2) + Math.floor(v * 2)) % 2 ? a : b;
    });
  }
  function shelf(ctx, st, r, side, a0, a1, h) {
    const f = side === "l" ? st.lwall : st.rwall;
    fp(ctx, st.quad(f, a0, a1, h, h + 1.5), "#3a2214");
    for (let a = a0 + 0.2; a < a1 - 0.2; a += 0.45) {
      const p = f(a, h + 1.5), col = ["#5a8a3a", "#8a3a2a", "#c8a040", "#3a5a8a", "#d8d0c0", "#7a5a9a"][Math.floor(r() * 6)];
      const tall = 3 + Math.floor(r() * 3);
      ctx.fillStyle = col; ctx.fillRect(p[0], p[1] - tall, 2, tall);
    }
  }
  function frame(ctx, st, side, a0, a1, h0, h1, inside) {
    const f = side === "l" ? st.lwall : st.rwall;
    fp(ctx, st.quad(f, a0 - 0.1, a1 + 0.1, h0 - 1.5, h1 + 1.5), "#8a6420");
    fp(ctx, st.quad(f, a0, a1, h0, h1), inside);
  }

  // ---------- wall and floor patterns ----------
  function bricks(base, mortar, r, tall, wide) {
    return (st, side) => (x, y) => {
      const [a, h] = side === "l" ? st.onL(x, y) : st.onR(x, y);
      const row = Math.floor(h / (tall || 5)), off = row % 2 ? 0.5 : 0;
      if (h % (tall || 5) < 1 || Math.abs(((a / (wide || 1.2) + off) % 1)) < 0.08) return mortar;
      return base[Math.floor(Math.abs(Math.sin(row * 12.9 + Math.floor(a / (wide || 1.2) + off) * 78.2)) * base.length * 0.999)] || base[0];
    };
  }
  function planks(cols, seam) {
    return (st, side) => (x, y) => {
      const [a] = side === "l" ? st.onL(x, y) : st.onR(x, y);
      const k = Math.floor(a * 2.6);
      if (Math.abs(a * 2.6 - Math.round(a * 2.6)) < 0.06) return seam;
      return cols[((k % cols.length) + cols.length) % cols.length];
    };
  }
  function plaster(cols, wains) {
    return (st, side) => (x, y) => {
      const [a, h] = side === "l" ? st.onL(x, y) : st.onR(x, y);
      if (h < 13) return Math.abs(a * 2 - Math.round(a * 2)) < 0.05 || h > 12 ? wains[1] : wains[0];
      if (h > 13 && h < 15) return wains[1];
      return ((Math.floor(x) * 7 + Math.floor(y) * 13) % 23 === 0) ? cols[1] : cols[0];
    };
  }
  function floorTiles(cols, seam, size) {
    return (st) => (x, y) => {
      const [u, v] = st.toUV(x, y), s = size || 1;
      if (Math.abs(u / s - Math.round(u / s)) < 0.06 || Math.abs(v / s - Math.round(v / s)) < 0.06) return seam;
      return cols[Math.floor(Math.abs(Math.sin(Math.floor(u / s) * 31.7 + Math.floor(v / s) * 17.3)) * cols.length * 0.999)];
    };
  }
  function floorBoards(cols, seam) {
    return (st) => (x, y) => {
      const [u, v] = st.toUV(x, y), row = Math.floor(v * 2);
      if (Math.abs(v * 2 - Math.round(v * 2)) < 0.07 || Math.abs(((u + row * 1.7) % 3)) < 0.05) return seam;
      return cols[((row % cols.length) + cols.length) % cols.length];
    };
  }
  function straw(st) {
    return (x, y) => { const n = Math.sin(x * 12.1 + y * 3.7) + Math.sin(x * 2.3 - y * 9.1); return n > 1.2 ? "#b89848" : n > 0.2 ? "#9a7a38" : n > -0.8 ? "#8a6a30" : "#6e5428"; };
  }

  // a walled room: back walls, floor, top trim
  function walls(st, NU, NV, WH, wallFn, floorFn, trim) {
    return layer(st, (ctx) => {
      ctx.fillStyle = "#120c0a"; ctx.fillRect(0, 0, W, H);
      const { iso, lwall, rwall } = st;
      fp(ctx, [lwall(0, WH), lwall(NV, WH), iso(0, NV), iso(0, 0)], wallFn(st, "l"));
      fp(ctx, [rwall(0, WH), rwall(NU, WH), iso(NU, 0), iso(0, 0)], wallFn(st, "r"));
      fp(ctx, [lwall(0, WH), lwall(NV, WH), lwall(NV, WH - 3), lwall(0, WH - 3)], trim[0]);
      fp(ctx, [rwall(0, WH), rwall(NU, WH), rwall(NU, WH - 3), rwall(0, WH - 3)], trim[1]);
      // the walls are shaded darker where they meet the floor
      fp(ctx, [lwall(0, 2), lwall(NV, 2), iso(0, NV), iso(0, 0)], "rgba(0,0,0,0.25)");
      fp(ctx, [rwall(0, 2), rwall(NU, 2), iso(NU, 0), iso(0, 0)], "rgba(0,0,0,0.2)");
      fp(ctx, [iso(0, 0), iso(NU, 0), iso(NU, NV), iso(0, NV)], floorFn(st));
    });
  }

  // ---------- animated bits ----------
  function campfire(ctx, st, u, v, now, flick, still, big) {
    const [x0, y0] = st.iso(u, v), x = Math.round(x0), y = Math.round(y0), k = big || 1;
    for (let i = -Math.round(4 * k); i <= Math.round(4 * k); i++) {
      const edge = 1 - Math.abs(i) / (4.6 * k);
      const h = Math.max(1, (2 + edge * 11 * k) * (0.7 + 0.3 * Math.abs(Math.sin(now * 8.5 + i * 1.9))) * flick);
      for (let j = 0; j < h; j++) { ctx.fillStyle = j < h * 0.3 ? "#fff4b0" : j < h * 0.62 ? "#f8b030" : j < h * 0.88 ? "#e06a20" : "#a8341a"; ctx.fillRect(x + i, y - 3 - j, 1, 1); }
    }
    if (!still) for (let i = 0; i < 2; i++) { const t = (now * 1.7 + i * 0.5) % 1; ctx.fillStyle = t < 0.5 ? "#ffd070" : "#e07030"; ctx.fillRect(x + Math.round(Math.sin(now * 5 + i * 3) * 3), y - 12 * k - t * 10, 1, 1); }
  }
  function firepit(st, u, v) {
    return layer(st, (ctx) => {
      const [x0, y0] = st.iso(u, v), x = Math.round(x0), y = Math.round(y0);
      ctx.fillStyle = "#1a120c"; for (let j = -3; j <= 3; j++) { const w = Math.round(Math.sqrt(1 - (j / 3.5) ** 2) * 9); ctx.fillRect(x - w, y + j, w * 2, 1); }
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
        const sx = x + Math.round(Math.cos(a) * 9), sy = y + Math.round(Math.sin(a) * 4);
        ctx.fillStyle = "#4a4650"; ctx.fillRect(sx - 1, sy - 1, 3, 2); ctx.fillStyle = "#6e6a76"; ctx.fillRect(sx - 1, sy - 1, 2, 1);
      }
      ctx.fillStyle = "#5a3a20"; for (let i = -5; i <= 4; i++) { ctx.fillRect(x + i, y - 1 + Math.round(i * 0.3), 1, 2); ctx.fillRect(x - i, y - 2 + Math.round(i * 0.3), 1, 2); }
      ctx.fillStyle = "#c04a20"; ctx.fillRect(x - 2, y - 1, 4, 1);
    });
  }
  function sparks(list, x, y, dt, still, rate) {
    if (!still && Math.random() < dt * (rate || 7)) list.push({ x: x + (Math.random() - 0.5) * 6, y, vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 14, life: 0.9 + Math.random() * 1.1, t: 0 });
    for (let i = list.length - 1; i >= 0; i--) { const s = list[i]; s.t += dt; s.x += s.vx * dt + Math.sin(s.t * 6) * 0.15; s.y += s.vy * dt; if (s.t > s.life) list.splice(i, 1); }
  }
  function drawSparks(ctx, list) { for (const s of list) { const f = s.t / s.life; ctx.fillStyle = f < 0.35 ? "#fff0a0" : f < 0.7 ? "#f0a030" : "#a04020"; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); } }
  function glow(ctx, x, y, r0, r1, rgb, a) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r1, y - r1, r1 * 2, r1 * 2);
  }
  // darkness everywhere except a pool of light: drawn last, over everything
  function dark(ctx, x, y, r0, r1, a, tint) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    g.addColorStop(0, `rgba(${tint || "6,6,16"},0)`); g.addColorStop(1, `rgba(${tint || "6,6,16"},${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function candle(ctx, x, y, now, flick) {
    ctx.fillStyle = "#e8e0c8"; ctx.fillRect(x, y - 4, 2, 4); ctx.fillStyle = "#8a6020"; ctx.fillRect(x - 1, y, 4, 1);
    const f = Math.floor(now * 9) % 3;
    ctx.fillStyle = "#f8b030"; ctx.fillRect(x, y - 6, 2, 2); ctx.fillStyle = "#fff4b0"; ctx.fillRect(x + (f === 1 ? 1 : 0), y - 7 - (f === 2 ? 1 : 0), 1, 1);
    glow(ctx, x + 1, y - 6, 1, 40, "255,200,110", 0.2 * flick);
  }
  function torch(ctx, x, y, now, flick) {
    ctx.fillStyle = "#2a1a10"; ctx.fillRect(x - 1, y, 3, 2); ctx.fillRect(x, y + 2, 1, 4); ctx.fillStyle = "#5a3a20"; ctx.fillRect(x, y - 3, 1, 3);
    for (let i = -1; i <= 1; i++) { const h = Math.round((3 + (i === 0 ? 3 : 0)) * (0.8 + 0.3 * Math.abs(Math.sin(now * 11 + i * 2))) * flick); for (let j = 0; j < h; j++) { ctx.fillStyle = j < h * 0.35 ? "#fff0a0" : j < h * 0.75 ? "#f0a030" : "#c04a20"; ctx.fillRect(x + i, y - 4 - j, 1, 1); } }
    glow(ctx, x, y - 6, 2, 60, "255,170,80", 0.28 * flick);
  }

  // ---------- the gathering: a small cast at fixed spots, taking turns to talk ----------
  function gather(cfg) {
    const r = Art.rng(Art.hash(cfg.seed));
    const st = cfg.st;
    const wrap = document.createElement("div");
    wrap.className = "tavern night-" + cfg.kind;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    wrap.appendChild(cv);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const still = T().reduced();
    const center = cfg.center;
    // a pet sits a little behind its owner's back and a step nearer the viewer
    const petSpot = (a) => { a.pet.tu = a.u + (-1.25 * a.face + 0.75) / 2; a.pet.tv = a.v + (0.75 + 1.25 * a.face) / 2; };
    const faceTo = (a) => { const [ax] = st.iso(a.u, a.v), [cx] = st.iso(center[0], center[1]); a.face = cx >= ax ? 1 : -1; };
    const actors = cfg.cast.slice(0, cfg.spots.length).map((c, i) => {
      const [u, v] = cfg.spots[i];
      const a = T().actor(c.h, u, v, { lines: c.lines, focus: i === 0, petLines: c.pet });
      a.spot = i; faceTo(a);
      if (a.pet) { petSpot(a); a.pet.u = a.pet.tu; a.pet.v = a.pet.tv; a.pet.face = a.face; }
      return a;
    });
    const focus = actors[0];
    const host = cfg.host && cfg.host.lines && cfg.host.lines.length ? { name: cfg.host.name, lines: cfg.host.lines.slice(), keeper: true, at: cfg.host.at, said: [] } : null;
    const Talk = T().talk(wrap, cv, st);
    const say = (a, t, s) => Talk.say(a, t, s);
    const later = (ms, fn) => setTimeout(() => { if (wrap.isConnected) fn(); }, ms);
    const fx = { sparks: [], now: 0 };
    let chatAt = 0.9, moveAt = 8 + r() * 6, petAt = 7 + r() * 8, hostAt = 5 + r() * 8, first = true;

    // real exchanges between the people here (league.voice.night_talk) take turns with the idle chatter
    const talks = (cfg.talks || []).map((ex) => ex.map((l) => [actors.find((a) => a.h.id === l.id), l.text])).filter((ex) => ex.every(([a]) => a));
    let talkAt = 0;
    function exchange() {
      const ex = talks.shift();
      talks.push(ex);
      ex.forEach(([a, t], i) => later(i * 2900, () => { faceTo(a); say(a, t, 3.4); }));
      chatAt = Talk.now + ex.length * 2.9 + 1.5;
      talkAt = Talk.now + ex.length * 2.9 + 9 + r() * 6;
    }
    function talkTurn() {
      if (Talk.count >= 2) { chatAt = Talk.now + 1.5; return; }
      if (first) { first = false; say(focus, focus.lines[0]); focus.said.push(focus.lines[0]); chatAt = Talk.now + 4 + r() * 2; talkAt = chatAt; return; }
      if (talks.length && Talk.now >= talkAt && actors.every((a) => a.mode === "idle")) return exchange();
      const others = actors.filter((a) => a !== focus && a.mode === "idle");
      const sp = !others.length || r() < 0.45 ? focus : others[Math.floor(r() * others.length)];
      if (sp.mode !== "idle") { chatAt = Talk.now + 1; return; }
      say(sp, T().pick(sp, r, cfg.pred));
      const listener = actors.filter((a) => a !== sp && a.mode === "idle")[Math.floor(r() * (actors.length - 1))];
      if (listener && r() < 0.45) later(2600, () => { if (listener.mode === "idle") say(listener, T().pick(listener, r, cfg.pred)); });
      chatAt = Talk.now + 3.6 + r() * 3.2;
    }
    function wander() {
      const free = cfg.spots.map((s, i) => i).filter((i) => !actors.some((a) => a.spot === i));
      const movers = actors.filter((a) => a.mode === "idle" && !Talk.speaking(a));
      const a = movers[Math.floor(r() * movers.length)];
      if (!a) return;
      if (free.length && r() < 0.6) {
        const to = free[Math.floor(r() * free.length)];
        a.spot = to; a.tu = cfg.spots[to][0]; a.tv = cfg.spots[to][1]; a.mode = "walk"; a.then = () => faceTo(a);
      } else if (a.pet && a.pet.lines.length) say(a.pet, T().pick(a.pet, r, () => true), 2.2);
      else faceTo(a);
    }
    function update(dt) {
      Talk.now += dt; fx.now = Talk.now;
      const now = Talk.now;
      for (const a of actors) {
        if (a.mode === "walk" && T().step(a, dt, 1.1)) { a.mode = "idle"; const t = a.then; a.then = null; if (t) t(); }
        if (a.pet) {
          const p = a.pet;
          petSpot(a);
          p.moving = !T().step(p, dt, 1.6);
          if (!p.moving) p.face = a.face;
        }
      }
      if (now > chatAt) talkTurn();
      if (now > moveAt) { wander(); moveAt = now + 9 + r() * 9; }
      if (now > petAt) {
        const o = actors.filter((a) => a.pet && a.pet.lines.length);
        const a = o.includes(focus) && r() < 0.6 ? focus : o[Math.floor(r() * o.length)];
        if (a && Talk.count < 3) say(a.pet, T().pick(a.pet, r, () => true), 2.2);
        petAt = now + 11 + r() * 10;
      }
      if (host && now > hostAt) { if (Talk.count < 3) say(host, T().pick(host, r, () => true), 3); hostAt = now + 14 + r() * 12; }
      if (cfg.update) cfg.update(dt, fx);
      Talk.prune();
    }
    function draw() {
      const now = Talk.now, flick = 0.78 + Math.sin(now * 13) * 0.08 + Math.sin(now * 7.3) * 0.08;
      ctx.drawImage(cfg.bg, 0, 0);
      if (cfg.under) cfg.under(ctx, now, flick, still, fx);
      const things = cfg.props.map((p) => ({ key: p.key, draw: () => (p.cv ? ctx.drawImage(p.cv, 0, 0) : p.draw(ctx, now, flick, still, fx)) }));
      for (const a of actors) {
        const bob = a.mode === "walk" && !still ? Math.floor(now * 6 + a.u * 3) % 2 : 0;
        things.push({ key: a.u + a.v, draw: () => T().drawActor(ctx, st, a, bob, now) });
        if (a.pet) things.push({ key: a.pet.u + a.pet.v, draw: () => T().drawPet(ctx, st, a.pet, a.pet.moving && !still ? Math.floor(now * 6) % 2 : 0) });
      }
      things.sort((p, q) => p.key - q.key).forEach((t) => t.draw());
      if (cfg.over) cfg.over(ctx, now, flick, still, fx);
      T().drawMarker(ctx, st, focus, now);
      Talk.place();
    }
    const L = T().loop(wrap, (dt) => { if (dt) update(dt); draw(); }, cfg.onVisible);
    if (still) { say(focus, focus.lines[0], 999); L.redraw(); }
    cv.addEventListener("click", (ev) => {
      const k = cv.clientWidth / W, rect = cv.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) / k, my = (ev.clientY - rect.top) / k;
      const hit = actors.filter((a) => { const [x, y] = st.iso(a.u, a.v); return Math.abs(mx - x) < 9 && my < y && my > y - 34; }).sort((p, q) => q.u + q.v - (p.u + p.v))[0];
      const pet = !hit && actors.map((a) => a.pet).filter((p) => p && p.lines.length).find((p) => { const [x, y] = st.iso(p.u, p.v); return Math.abs(mx - x) < 8 && my < y + 2 && my > y - 12; });
      if (hit) say(hit, T().pick(hit, r, cfg.pred), still ? 999 : 3.4);
      else if (pet) say(pet, T().pick(pet, r, () => true), still ? 999 : 2.2);
      else if (host && host.at && Math.abs(mx - host.at[0]) < 14 && Math.abs(my - host.at[1]) < 18) say(host, T().pick(host, r, () => true), still ? 999 : 3);
      L.redraw();
    });
    return wrap;
  }
  const notOrder = (t) => !t.startsWith("One ");

  // ---------- the camp ----------
  const STALL_COAT = {
    grey: { b: "#c0b8ac", d: "#8e877c", m: "#3e3834", l: "#d8d0c4" }, white: { b: "#ece8e0", d: "#c4beb4", m: "#d8d0c4", l: "#fbf8f2" },
    bay: { b: "#8a4a26", d: "#62321a", m: "#1e1410", l: "#a8623a" }, chestnut: { b: "#a8552a", d: "#7a3a1c", m: "#8a4220", l: "#c4703e" },
    black: { b: "#3a3438", d: "#26222a", m: "#141014", l: "#524a50" }, dun: { b: "#c4a46a", d: "#94784a", m: "#3e2e1e", l: "#d8bc84" },
    brown: { b: "#6e4a2e", d: "#4e341e", m: "#2a1c12", l: "#8a6040" }, piebald: { b: "#e8e2d8", d: "#2e2a2c", m: "#2e2a2c", l: "#f8f4ec" },
    sand: { b: "#c8a470", d: "#9a7a4e", m: "#7a5c38", l: "#dcbc8a" }, bone: { b: "#d8d0b8", d: "#9a9280", m: "#5a5448", l: "#ece6d2" },
    red: { b: "#8a3e26", d: "#62281a", m: "#3e1a10", l: "#a8563a" }, cream: { b: "#e0d4b4", d: "#b4a684", m: "#6e6250", l: "#f0e6cc" },
  };
  function camp(t, cast, seed, onVisible) {
    const st = T().stage(W, H, 100, 60);
    const r = Art.rng(Art.hash(seed + "camp"));
    const biome = t.biome || "plains";
    const starList = stars(r, biome === "forest" ? 34 : 56);
    let moon;
    const bg = layer(st, (ctx) => { moon = sky(ctx, r, biome); const g = GROUND[biome] || GROUND.plains; horizon(ctx, r, biome, g); ground(ctx, st, r, biome, t.road); });
    const props = [{ key: 10, cv: firepit(st, 5, 5) }];
    const cols = [["#8a6a4a", "#6a4e36", "#7a5c40"], ["#5a6a4a", "#46543a", "#50603f"], ["#8a4a3a", "#6a362a", "#7a4232"]];
    props.push({ key: -2.5 + 4.0 + 3.0, cv: tent(st, -2.5, 4.0, cols[Math.floor(r() * cols.length)]) });
    props.push({ key: 3.4 + 3.6, cv: log(st, 3.3, 3.4, 1.4, 0.35) });
    const rolls = [["#6a3a2a", "#4a2a1e", "#3a2016"], ["#3a5a6a", "#2a4250", "#22363f"], ["#6a6a3a", "#4a4a2a", "#3a3a22"]];
    fromScreen(5, 5, [[-8, 30], [40, 24], [-62, -4]]).slice(0, Math.max(1, cast.length)).forEach(([u, v], i) => props.push({ key: u + v + 0.6, cv: bedroll(st, u, v, rolls[i % 3]) }));
    const pine = { x: "#0c1610", a: "#1e3626", b: "#152a1e", t: "#2a1a10" }, rock = { x: "#16141c", a: "#5a5866", b: "#46444f" };
    const scatter = biome === "forest" ? [[0.2, 1.4, "p"], [1.6, -0.4, "p"], [9.8, 0.8, "p"], [-0.6, 4.5, "p"], [10.6, 3.6, "p"]] :
      biome === "hills" || biome === "snow" || biome === "volcanic" ? [[1.0, 1.0, "r"], [9.4, 2.2, "r"], [0.4, 9.4, "r"], [10.0, 7.2, "r"]] :
      biome === "plains" ? [[9.6, 1.0, "p"], [0.6, 2.0, "r"], [10.2, 8.6, "r"]] : [[1.0, 1.4, "r"], [9.4, 1.8, "r"]];
    for (const [u, v, k] of scatter.filter(([u, v]) => !(u > -3 && u < 0.6 && v > 3.4 && v < 6.4))) props.push({ key: u + v, cv: layer(st, (ctx) => { const [x, y] = st.iso(u, v); if (k === "p") pix(ctx, Math.round(x) - 6, Math.round(y) - 15, PINE, pine); else pix(ctx, Math.round(x) - 4, Math.round(y) - 4, ROCK, biome === "snow" ? { x: "#3a4258", a: "#c8d0e0", b: "#8a94b0" } : rock); }) });
    if (t.road) props.push({ key: 6 + 2.4, cv: layer(st, (ctx) => { const [x, y] = st.iso(6, 2.4); ctx.fillStyle = "#4a2e18"; ctx.fillRect(Math.round(x), Math.round(y) - 18, 2, 18); ctx.fillStyle = "#8a6038"; ctx.fillRect(Math.round(x) - 7, Math.round(y) - 17, 13, 4); ctx.fillStyle = "#5a3a20"; ctx.fillRect(Math.round(x) - 6, Math.round(y) - 15, 9, 1); }) });
    // a pot hung over the fire on a tripod
    const [fx0, fy0] = st.iso(5, 5), fcx = Math.round(fx0), fcy = Math.round(fy0);
    const steam = anim("smoke", { x: fcx, y: fcy - 19, n: 4, rise: 12, wind: 2, seed: 5 }), embers = anim("embers", { x0: fcx - 4, x1: fcx + 4, y: fcy - 10, n: 7, rise: 34, seed: 9 });
    props.push({ key: 10.2, draw: (ctx, now, flick, still, fx) => {
      const x = fcx, y = fcy;
      campfire(ctx, st, 5, 5, now, flick, still, 1.35);
      ctx.fillStyle = "#2a1a10"; for (let j = 0; j < 24; j++) { ctx.fillRect(x - 10 + Math.round(j * 0.4), y - j, 1, 1); ctx.fillRect(x + 10 - Math.round(j * 0.4), y - j, 1, 1); }
      ctx.fillRect(x, y - 24, 1, 6);
      ctx.fillStyle = "#1a181e"; ctx.fillRect(x - 4, y - 18, 9, 5); ctx.fillRect(x - 3, y - 13, 7, 1); ctx.fillStyle = "#4a4852"; ctx.fillRect(x - 4, y - 18, 9, 1); ctx.fillStyle = "#6a6872"; ctx.fillRect(x - 3, y - 17, 2, 1);
      if (steam) steam.draw(ctx, now);
      if (embers) embers.draw(ctx, now); else drawSparks(ctx, fx.sparks);
    } });
    // the crew's horses tethered at the edge of the firelight, and the wagon parked behind them
    const MA = window.MountArt;
    if (MA && t.wagon) {
      const [wx, wy] = st.iso(1.2, 8.6), pl = t.wagon.puller ? { kind: t.wagon.puller.kind, colour: t.wagon.puller.colour } : null;
      props.push({ key: 1.2 + 8.6, draw: (ctx, now, flick, still) => { MA.drawWagon(ctx, t.wagon.kind, Math.round(wx) - 20, Math.round(wy), 1, pl, still ? 0 : (Math.floor(now * 0.6) % 5 === 0 ? 1 : 0)); } });
    }
    if (MA) (t.mounts || []).slice(0, 4).forEach((m, i) => {
      const [u, v] = [[8.6, 1.4], [9.4, 3.0], [7.6, 0.4], [9.8, 4.6]][i];
      const [mx, my] = st.iso(u, v), ph = Art.hash(m.name || String(i)) % 7;
      props.push({ key: u + v, draw: (ctx, now, flick, still) => { MA.drawMount(ctx, m.kind, m.colour, Math.round(mx) - 12, Math.round(my), still ? 0 : (Math.floor(now * 0.8 + ph) % 4 === 0 ? 1 : 0), 1); } });
    });
    const night = [];
    if (biome === "forest" || biome === "plains") night.push(anim("fireflies", { x: 8, y: HZ + 12, w: 60, h: 40, n: 5, seed: 3 }), anim("fireflies", { x: 132, y: HZ + 20, w: 60, h: 50, n: 4, seed: 4 }));
    if (biome === "marsh") night.push(anim("wisp", { x: 140, y: HZ + 14, w: 50, h: 20, seed: 6 }), anim("fireflies", { x: 10, y: HZ + 30, w: 50, h: 40, n: 4, rgb: "160,255,200", seed: 7 }));
    const sky2 = [anim("twinkle", { pts: starList.filter((s) => s.b > 0.6).map((s) => [s.x, s.y]), seed: 2 })];
    if ((GROUND[biome] || {}).sea) sky2.push(anim("waves", { x0: 0, x1: W, y: HZ - 5, h: 6, rgb: "40,60,110", seed: 8 }));
    let shoot = null, shootAt = 6 + r() * 14;
    const spots = fromScreen(5, 5, [[28, 4], [-28, 2], [-4, -24], [52, -16], [-54, 14], [24, -30]]);
    return gather({ talks: t.talk, kind: "camp", st, bg, props, cast, seed, center: [5, 5], spots, pred: notOrder, onVisible,
      update(dt, f) {
        const [x, y] = st.iso(5, 5);
        if (!embers) sparks(f.sparks, x, y - 10, dt, false);
        if (f.now > shootAt && !shoot) { shoot = { x: 20 + r() * 120, y: 4 + r() * 18, t: 0 }; shootAt = f.now + 18 + r() * 25; }
        if (shoot) { shoot.t += dt; if (shoot.t > 0.7) shoot = null; }
      },
      under(ctx, now, flick, still) {
        for (const s of starList) {
          const tw = still || sky2[0] ? s.b : (Math.sin(now * s.sp + s.ph) + 1) / 2 * s.b;
          if (tw < 0.15) continue;
          ctx.fillStyle = tw > 0.7 ? "#f8f0d8" : tw > 0.4 ? "#b8bcd8" : "#5a628a";
          ctx.fillRect(s.x, s.y, 1, 1);
        }
        drawAll(ctx, sky2, now);
        if (moon) glow(ctx, moon[0], moon[1], 3, 22, "240,232,200", 0.12);
        if (shoot) { for (let i = 0; i < 9; i++) { const px = shoot.x + (shoot.t * 90) - i * 2, py = shoot.y + shoot.t * 30 - i * 0.66; ctx.fillStyle = `rgba(248,240,216,${(1 - i / 9) * (1 - shoot.t / 0.7)})`; ctx.fillRect(Math.round(px), Math.round(py), 1, 1); } }
        if ((GROUND[biome] || {}).sea && moon) for (let i = 0; i < 6; i++) { const w = 2 + ((Math.floor(now * 2) + i) % 3); ctx.fillStyle = "rgba(240,232,200,0.5)"; ctx.fillRect(moon[0] - w / 2 + ((i * 7) % 5) - 2, HZ - 5 + i, w, 1); }
      },
      over(ctx, now, flick, still) {
        const [x, y] = st.iso(5, 5);
        glow(ctx, x, y - 4, 4, 70 + flick * 6, "255,160,70", 0.26 * flick);
        dark(ctx, x, y - 6, 38, 124, 0.6, "6,8,24");
        drawAll(ctx, night, now);
      } });
  }

  // ---------- a dungeon floor ----------
  const DEEP = {
    cave: { wall: ["#4a3e34", "#54463a", "#3e342c"], mortar: "#2a221c", floor: ["#3a322a", "#42382e", "#362e26"], seam: "#262018", tall: 7, wide: 1.8 },
    undead: { wall: ["#4a4a54", "#54545e", "#42424c"], mortar: "#24242c", floor: ["#3c3c44", "#44444c", "#36363e"], seam: "#22222a" },
    ice: { wall: ["#4a6a8a", "#5a7a9a", "#3e5e7e"], mortar: "#2a3e56", floor: ["#3e5670", "#486078", "#36506a"], seam: "#243848" },
    fire: { wall: ["#4a2a24", "#54302a", "#3e221e"], mortar: "#2a1210", floor: ["#3a2420", "#422a24", "#341e1a"], seam: "#5a2416", lava: true },
    swamp: { wall: ["#3e4a36", "#465440", "#36402e"], mortar: "#222a1c", floor: ["#34402c", "#3c4832", "#2e3826"], seam: "#1e2618" },
    sea: { wall: ["#3a4a54", "#42545e", "#34424c"], mortar: "#1e2a32", floor: ["#34444c", "#3c4c54", "#2e3c44"], seam: "#1c2830" },
  };
  function dungeon(t, cast, seed, onVisible) {
    const NU = 11, NV = 9, WH = 50, st = T().stage(W, H, 92, 58);
    const th = DEEP[t.theme] || DEEP[{ goblin: "cave", beast: "cave" }[t.theme]] || DEEP.cave;
    const r = Art.rng(Art.hash(seed + "deep"));
    const bg = walls(st, NU, NV, WH, bricks(th.wall, th.mortar, r, th.tall, th.wide), floorTiles(th.floor, th.seam), [th.mortar, th.mortar]);
    const bctx = bg.getContext("2d");
    // the stair further down, a dark hole in the back corner
    fp(bctx, [st.iso(8.2, 0.2), st.iso(10.4, 0.2), st.iso(10.4, 2.0), st.iso(8.2, 2.0)], "#08060a");
    for (let i = 0; i < 4; i++) fp(bctx, [st.iso(8.4, 0.4 + i * 0.4), st.iso(10.2, 0.4 + i * 0.4), st.iso(10.2, 0.55 + i * 0.4), st.iso(8.4, 0.55 + i * 0.4)], ["#3a3440", "#2c2832", "#201c26", "#16121a"][i]);
    if (t.theme === "undead") for (const v of [2.0, 5.0]) { fp(bctx, st.quad(st.lwall, v, v + 1.4, 18, 30), "#141218"); pix(bctx, Math.round(st.lwall(v + 0.6, 26)[0]) - 3, Math.round(st.lwall(v + 0.6, 26)[1]), [".xxx.", "xoxox", "xxxxx", ".x.x."], { x: "#c8c0b0", o: "#141218" }); }
    if (th.lava) for (let k = 0; k < 5; k++) { let u = 1 + r() * 9, v = 1 + r() * 7; for (let j = 0; j < 14; j++) { const [x, y] = st.iso(u, v); bctx.fillStyle = j % 3 ? "#e0601c" : "#ffb040"; bctx.fillRect(Math.round(x), Math.round(y), 1, 1); u += (r() - 0.3) * 0.25; v += (r() - 0.5) * 0.25; } }
    if (t.theme === "ice") for (let u = 0.5; u < NU; u += 0.9 + r()) { const p = st.rwall(u, WH - 3); bctx.fillStyle = "#a8c8e8"; for (let j = 0; j < 3 + Math.floor(r() * 5); j++) bctx.fillRect(p[0], p[1] + j, j < 2 ? 2 : 1, 1); }
    // a puddle under the drip
    const pu = 3.0, pv = 6.0;
    fp(bctx, [st.iso(pu - 0.8, pv), st.iso(pu, pv - 0.5), st.iso(pu + 0.8, pv), st.iso(pu, pv + 0.5)], t.theme === "fire" ? "#3a1410" : "#1a2230");
    pix(bctx, Math.round(st.iso(8.5, 7.5)[0]), Math.round(st.iso(8.5, 7.5)[1]) - 4, BONES, { x: "#b8b0a0", o: "#d8d0c0" });
    const props = [];
    const rolls = [["#6a3a2a", "#4a2a1e", "#3a2016"], ["#3a5a6a", "#2a4250", "#22363f"], ["#6a6a3a", "#4a4a2a", "#3a3a22"], ["#5a4a6a", "#40344e", "#342a40"]];
    fromScreen(5, 5, [[10, 30], [-30, 22], [44, 30], [-56, 2]]).slice(0, Math.max(1, cast.length)).forEach(([u, v], i) => props.push({ key: u + v + 0.6, cv: bedroll(st, u, v, rolls[i % 4]) }));
    props.push({ key: 1.4 + 1.0 + 1.2, cv: st.box(1.0, 0.6, 0.9, 0.9, 7, "#7a5a3a", "#5a3e24", "#4a321c") });
    props.push({ key: 2.2 + 0.6, cv: layer(st, (ctx) => { const [x, y] = st.iso(2.6, 0.6); T().barrel(ctx, Math.round(x), Math.round(y)); }) });
    props.push({ key: 10, cv: firepit(st, 5, 5) });
    props.push({ key: 10.1, draw: (ctx, now, flick, still, fx) => { campfire(ctx, st, 5, 5, now, flick * 0.75, still); drawSparks(ctx, fx.sparks); } });
    const drip = { t: 0, phase: "fall", y: 0, ring: 0 };
    const [dx, dyFloor] = st.iso(pu, pv);
    const eyes = { at: 9 + r() * 10, t: -1, x: 0, y: 0 };
    const tx = st.rwall(4.2, 26);
    const tf = anim("torch", { x: Math.round(tx[0]), y: Math.round(tx[1]) - 4, r: 30, seed: 3 });
    const deep = [anim("drip", { x: Math.round(dx), y0: Math.round(dyFloor) - 70, y1: Math.round(dyFloor), seed: 4, period: 3.1 }),
      anim("cobweb", { x: Math.round(st.iso(0, 0)[0]) + 1, y: Math.round(st.iso(0, 0)[1]) - WH + 3, size: 14, side: "r" }),
      t.theme === "cave" || t.theme === "beast" || t.theme === "goblin" ? anim("bat", { W, y0: 18, y1: 50, seed: 5 }) : null].filter(Boolean);
    const spots = fromScreen(5, 5, [[28, 4], [-28, 2], [-4, -24], [-48, 8], [50, 14]]);
    return gather({ talks: t.talk, kind: "dungeon", st, bg, props, cast, seed, center: [5, 5], spots, pred: notOrder, onVisible,
      update(dt, f) {
        const [x, y] = st.iso(5, 5);
        sparks(f.sparks, x, y - 6, dt, false, 4);
        drip.t += dt;
        if (drip.phase === "fall") { drip.y = Math.min(1, drip.t / 0.55); if (drip.t > 0.55) { drip.phase = "ring"; drip.t = 0; } }
        else if (drip.phase === "ring" && drip.t > 0.6) { drip.phase = "wait"; drip.t = 0; }
        else if (drip.phase === "wait" && drip.t > 2.2 + (Math.sin(f.now) + 1)) { drip.phase = "fall"; drip.t = 0; }
        if (f.now > eyes.at && eyes.t < 0) { eyes.t = 0; const left = r() < 0.5; eyes.x = left ? 8 + r() * 10 : W - 18 - r() * 10; eyes.y = 100 + r() * 30; }
        if (eyes.t >= 0) { eyes.t += dt; if (eyes.t > 3) { eyes.t = -1; eyes.at = f.now + 16 + r() * 18; } }
      },
      under(ctx, now, flick, still) {
        const top = dyFloor - 70;
        if (deep.length) drawAll(ctx, deep, now);
        else if (!still && drip.phase === "fall") { ctx.fillStyle = "#8ab0d8"; ctx.fillRect(Math.round(dx), Math.round(top + drip.y * 70) - 2, 1, 2); }
        if (!deep.length && !still && drip.phase === "ring") { const w = Math.round(1 + drip.t * 10); ctx.fillStyle = `rgba(160,200,230,${0.6 - drip.t})`; ctx.fillRect(Math.round(dx - w), Math.round(dyFloor), w * 2, 1); ctx.fillRect(Math.round(dx - w / 2), Math.round(dyFloor - 1), w, 1); }
        if (tf) { ctx.fillStyle = "#2a1a10"; ctx.fillRect(Math.round(tx[0]) - 1, Math.round(tx[1]) - 2, 4, 2); ctx.fillRect(Math.round(tx[0]), Math.round(tx[1]), 2, 5); tf.draw(ctx, now); glow(ctx, tx[0], tx[1] - 6, 2, 60, "255,170,80", 0.22 * flick); }
        else torch(ctx, tx[0], tx[1], now, flick);
      },
      over(ctx, now, flick, still) {
        const [x, y] = st.iso(5, 5);
        glow(ctx, x, y - 4, 4, 56, "255,150,60", 0.2 * flick);
        dark(ctx, (x + tx[0]) / 2, (y + tx[1]) / 2 + 4, 26 + flick * 4, 104, 0.88);
        if (eyes.t >= 0 && !still && Math.floor(eyes.t * 4) % 6 !== 5) { ctx.fillStyle = t.theme === "ice" ? "#a0e0ff" : "#e83a2a"; ctx.fillRect(Math.round(eyes.x), Math.round(eyes.y), 1, 1); ctx.fillRect(Math.round(eyes.x) + 3, Math.round(eyes.y), 1, 1); }
      } });
  }

  // ---------- a cell ----------
  function cell(t, cast, seed, onVisible) {
    const NU = 9, NV = 8, WH = 50, st = T().stage(W, H, 100, 56);
    const r = Art.rng(Art.hash(seed + "cell"));
    const bg = walls(st, NU, NV, WH, bricks(["#55525e", "#5e5b68", "#4c4a56"], "#2c2a34", r), floorTiles(["#45424c", "#4c4954", "#3e3c46"], "#2a2830"), ["#2c2a34", "#2c2a34"]);
    const b = bg.getContext("2d");
    fp(b, st.quad(st.rwall, 4.0, 5.6, 30, 40), "#0e1428");
    for (let u = 4.2; u < 5.6; u += 0.4) fp(b, st.quad(st.rwall, u, u + 0.1, 30, 40), "#2a2830");
    const m = st.rwall(4.4, 38); b.fillStyle = "#f0e8c0"; b.fillRect(m[0], m[1], 2, 2);
    // the moonlight falls through the window onto the floor
    fp(b, [st.iso(4.0, 0), st.iso(5.6, 0), st.iso(7.4, 4.2), st.iso(5.8, 4.2)], (x, y) => ((x + y) % 2 ? "rgba(170,190,240,0.2)" : "rgba(170,190,240,0.14)"));
    for (let k = 0; k < 6; k++) { const p = st.lwall(1 + r() * 6, 8 + r() * 30); b.fillStyle = "#3a3842"; for (let j = 0; j < 4; j++) b.fillRect(p[0] + j * 2, p[1], 1, 4); b.fillRect(p[0] - 1, p[1] + 2, 9, 1); }
    const props = [];
    props.push({ key: 1.2 + 4.0 + 1, cv: st.box(0.3, 3.0, 2.2, 1.6, 2, "#b89848", "#8a6a30", "#6e5428") });
    props.push({ key: 6.8 + 1.0, cv: layer(st, (ctx) => { const [x, y] = st.iso(6.8, 0.6); pix(ctx, Math.round(x) - 3, Math.round(y) - 5, BUCKET, { x: "#2a1a10", b: "#6a4a2a", c: "#4a3420" }); }) });
    const rat = { u: 0.4, v: 7.5, dir: -1, t: 0, at: 5 + r() * 8 };
    const arat = anim("quad", { x0: Math.round(st.iso(0.6, 7.6)[0]), x1: Math.round(st.iso(3.4, 7.6)[0]), y: Math.round(st.iso(2, 7.6)[1]), kind: "rat", seed: 6 });
    if (arat) props.push({ key: 9.6, draw: (ctx, now) => arat.draw(ctx, now) });
    else props.push({ key: 0, draw: (ctx, now, flick, still) => { if (rat.t <= 0 || still) return; const [x, y] = st.iso(rat.u, rat.v); ctx.fillStyle = "#3a3038"; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 2); ctx.fillStyle = "#5a5058"; ctx.fillRect(Math.round(x) + (rat.dir > 0 ? 2 : -3), Math.round(y) - 2, 1, 1); ctx.fillRect(Math.round(x) + (rat.dir > 0 ? -3 : 2), Math.round(y) - 1, 2, 1); } });
    const bars = layer(st, (ctx) => {
      for (let v = 0.2; v <= NV; v += 0.55) { const [x, y] = st.iso(NU, v); ctx.fillStyle = "#1a1820"; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 52, 3, 52); ctx.fillStyle = "#6a6876"; ctx.fillRect(Math.round(x), Math.round(y) - 52, 1, 52); }
      for (const h of [8, 46]) fp(ctx, [st.up(st.iso(NU, 0), h), st.up(st.iso(NU, NV), h), st.up(st.iso(NU, NV), h + 2), st.up(st.iso(NU, 0), h + 2)], "#4a4854");
    });
    const gate = st.iso(NU + 0.6, 5.5);
    const host = t.host && Object.assign({}, t.host, { at: [gate[0] + 10, gate[1] - 40] });
    return gather({ talks: t.talk, kind: "cell", st, bg, props, cast, seed, center: [4, 4], spots: fromScreen(4, 4, [[-12, 0], [-40, 10], [10, 18]]), pred: notOrder, host, onVisible,
      update(dt, f) {
        if (rat.t <= 0 && f.now > rat.at) { rat.t = 0.01; rat.u = 0.4; rat.v = rat.dir > 0 ? 0.6 : 7.4; }
        if (rat.t > 0) { rat.t += dt; rat.v += rat.dir * dt * 3; if (rat.v < 0.5 || rat.v > 7.6) { rat.t = 0; rat.dir = -rat.dir; rat.at = f.now + 14 + r() * 14; } }
      },
      over(ctx, now, flick) {
        ctx.drawImage(bars, 0, 0);
        glow(ctx, gate[0] + 12, gate[1] - 30, 4, 60, "255,190,100", 0.18 + 0.04 * flick);
        dark(ctx, 92, 90, 46, 130, 0.42, "6,6,20");
      } });
  }

  // ---------- rooms: the stables, a rented room, the best suite, a home ----------
  function room(t, cast, seed, onVisible) {
    const NU = 11, NV = 9, WH = 50, st = T().stage(W, H, 92, 58);
    const r = Art.rng(Art.hash(seed + "room" + t.room));
    const kind = t.setting === "stable" ? "stables" : t.room;
    const rich = kind === "suite" || kind === "manor", homey = kind === "cottage" || kind === "townhouse" || kind === "manor";
    const wallFn = kind === "stables" ? planks(["#4e3420", "#553822", "#4a301c"], "#2e1c10") : rich || kind === "townhouse" ? plaster(rich ? ["#b8a07a", "#a8906a"] : ["#a89070", "#988060"], ["#5e3a1e", "#3e2414"])
      : planks(kind === "private" ? ["#7a4e2c", "#704628", "#76502e"] : ["#6a4426", "#704a2a", "#664022"], "#3e2616");
    const floorFn = kind === "stables" ? () => straw() : floorBoards(rich ? ["#7a4a2a", "#70442a", "#76482c"] : ["#8e5c34", "#83542f", "#895830"], "#5a3820");
    const bg = walls(st, NU, NV, WH, wallFn, floorFn, kind === "stables" ? ["#2e1c10", "#3a2414"] : ["#2e1c10", "#3a2414"]);
    const b = bg.getContext("2d");
    const props = [];
    const blankets = [["#8a3a2a", "#6a2a20", "#5a2018"], ["#3a5a8a", "#2a4268", "#22365a"], ["#4a6a3a", "#36502a", "#2a4020"]];
    const bl = blankets[Math.floor(r() * 3)];
    let fire = null, candleAt = null, lamps = [];
    if (kind === "stables") {
      for (let v = 0.2; v < 9; v += 3.0) fp(b, st.quad(st.lwall, v, v + 0.15, 0, 22), "#3a2414");
      fp(b, st.quad(st.lwall, 0, 9, 21, 23), "#2e1c10");
      shelf(b, st, r, "r", 4.0, 6.8, 30);
      fp(b, st.quad(st.rwall, 2.0, 3.2, 18, 26), "#5a3a20"); fp(b, st.quad(st.rwall, 2.2, 3.0, 22, 24), "#8a6a40");
      // the horse looks out over its stall door on the left wall, into the room
      const hx = st.iso(0.5, 6.6), horse = HORSE.map((row) => row.split("").reverse().join(""));
      // the hero's own horse in the stall, in its own colour; a stranger's grey otherwise
      const coat = STALL_COAT[((t.host || {}).mount || {}).colour] || STALL_COAT.grey;
      props.push({ key: 1, draw: (ctx, now, flick, still) => {
        const nod = still ? 0 : Math.floor(now * 0.7) % 4 === 0 ? 1 : 0;
        pix(ctx, Math.round(hx[0]) - 6, Math.round(hx[1]) - 34 + nod, horse, Object.assign({ o: "#1a1210", e: "#0a0604", n: "#2a2420", w: "#f4f0e8" }, coat));
      } });
      props.push({ key: 2, cv: st.box(0.05, 5.0, 1.0, 3.2, 12, "#6a4426", "#553620", "#4a2e1a") });
      props.push({ key: 2.1, cv: layer(st, (ctx) => { for (const v of [5.0, 8.2]) { const p = st.iso(1.05, v); ctx.fillStyle = "#2e1c10"; ctx.fillRect(Math.round(p[0]), Math.round(p[1]) - 13, 1, 13); } fp(ctx, [st.up(st.iso(1.05, 5.0), 7), st.up(st.iso(1.05, 8.2), 7), st.up(st.iso(1.05, 8.2), 6), st.up(st.iso(1.05, 5.0), 6)], "#2e1c10"); }) });
      props.push({ key: 8.0 + 1.2, cv: st.box(7.8, 0.2, 1.4, 1.0, 9, "#c8a850", "#9a7a38", "#8a6a30") });
      props.push({ key: 9.4 + 1.2, cv: st.box(9.3, 0.2, 1.4, 1.0, 9, "#c8a850", "#9a7a38", "#8a6a30") });
      props.push({ key: 9.6 + 2.3, cv: st.box(9.0, 1.4, 1.2, 0.9, 6, "#c8a850", "#9a7a38", "#8a6a30") });
      props.push({ key: 1.0 + 3.6, cv: layer(st, (ctx) => { const [x, y] = st.iso(0.7, 3.6); T().barrel(ctx, Math.round(x), Math.round(y)); }) });
      lamps = [[2.4, 5.0]];
    } else {
      T().windowR(b, st, r, 6.8, 8.6, 18, 38, true);
      if (rich || homey) T().windowR(b, st, r, 9.2, 10.4, 18, 38);
      if (rich || homey) { T().hearth(b, st, r, 4.6, 6.6, WH); fire = [4.6, 6.6]; }
      if (kind === "townhouse" || kind === "manor" || kind === "suite") shelf(b, st, r, "r", 1.2, 5.6, 30);
      if (kind === "cottage") { shelf(b, st, r, "r", 1.2, 5.2, 28); shelf(b, st, r, "r", 1.2, 5.2, 36); }
      if (kind === "manor" || kind === "suite") frame(b, st, "l", 1.4, 3.2, 24, 38, (x, y) => (y % 5 === 0 ? "#4a5a3a" : (x + y) % 9 === 0 ? "#c8a050" : "#3a4a5a"));
      if (kind === "private" || kind === "common") fp(b, st.quad(st.lwall, 7.4, 8.6, 0, 30), "#4a2c18"), fp(b, st.quad(st.lwall, 7.55, 8.45, 0, 28), "#5e3a20");
      if (rich) rug(b, st, 3.6, 3.4, 8.8, 7.4, "#8a2a24", "#7a2420", "#c8a040");
      else if (kind !== "private") rug(b, st, 4.0, 4.0, 7.6, 6.8, "#6a5a3a", "#5e4e32", "#8a6a40");
      props.push({ key: 0.4 + 0.4 + 2.6 + 2.0, cv: bed(st, 0.4, 0.4, 2.6, 2.0, bl, rich) });
      props.push({ key: 3.2 + 0.6 + 1.2, cv: st.box(3.3, 0.6, 0.8, 0.8, rich ? 10 : 7, "#7a4a28", "#4a2c18", "#3e2414") });
      candleAt = st.up(st.iso(3.7, 1.0), rich ? 10 : 7);
      props.push({ key: 0.4 + 2.8 + 1.2, cv: st.box(0.5, 2.6, 1.1, 0.7, 6, "#6a4226", "#4a2c18", "#3e2414") });
      if (kind !== "private") {
        props.push({ key: 7.8 + 3.4 + 1.6, cv: st.box(7.8, 3.4, 1.4, 1.4, 9, "#9a6436", "#5e3a1e", "#4e2e18") });
        props.push({ key: 9.0 + 5.4, cv: st.box(9.2, 5.0, 0.4, 0.4, 5, "#7a4a28", "#4a2c18", "#3e2414") });
      }
      if (kind === "cottage") props.push({ key: 2 + 8.4, cv: layer(st, (ctx) => { const [x, y] = st.iso(1.6, 8.4); T().barrel(ctx, Math.round(x), Math.round(y)); }) });
      if (kind !== "private") lamps = [[6.2, 5.6]];
    }
    const door = st.lwall(8.0, 30);
    const host = t.host && t.host.lines && Object.assign({}, t.host, { at: kind === "stables" ? [st.iso(0.5, 6.6)[0] + 4, st.iso(0.5, 6.6)[1] - 40] : [door[0] + 4, door[1] - 2] });
    const spots = fromScreen(0, 0, [[26, 44], [-18, 48], [4, 62], [46, 56], [-38, 46]]);
    return gather({ talks: t.talk, kind: kind === "stables" ? "stable" : "room", st, bg, props, cast, seed, center: kind === "stables" ? [5.2, 5.2] : [5.6, 5.4], spots, pred: notOrder, host, onVisible,
      under(ctx, now, flick) { if (fire) T().flames(ctx, st, now, fire[0], fire[1], flick); },
      over(ctx, now, flick) {
        if (candleAt) candle(ctx, Math.round(candleAt[0]), Math.round(candleAt[1]), now, flick);
        for (const [u, v] of lamps) T().lantern(ctx, st, u, v, flick, 58);
        if (kind === "private" && host) glow(ctx, door[0] + 2, door[1] + 20, 2, 30, "255,200,120", 0.1);
        dark(ctx, 100, 92, 50, 140, kind === "stables" ? 0.45 : 0.3, "10,8,20");
      } });
  }

  // ---------- the page piece ----------
  function scene(h, L) {
    const t = h.tonight;
    if (!t || !window.Tavern || !window.Art) return null;
    const by = App.heroes;
    const self = Object.assign({}, by[h.id] || {}, h);
    const cast = t.cast.map((c) => ({ h: c.id === h.id ? self : by[c.id], lines: c.lines.length ? c.lines : ["..."], pet: c.pet })).filter((c) => c.h);
    if (!cast.length) return null;
    const seed = `${L.meta.day}:${h.id}`;
    const sound = { inn: "inn", room: "room", stable: "stable", camp: "camp", dungeon: "dungeon", cell: "cell" }[t.setting];
    let stage;
    const onVisible = (on) => { if (window.Sound && Sound.scene) Sound.scene(on ? sound : null, stage); };
    if (t.setting === "inn") {
      const others = (t.others || []).map((o) => ({ h: by[o.id], lines: o.lines })).filter((o) => o.h);
      const crowd = [Object.assign(cast[0], { focus: true })].concat(cast.slice(1), others);
      stage = Tavern.inn({ seed, keeper: t.host, cast: crowd, talks: t.talk, locals: Math.max(4, crowd.length), onVisible });
      stage.classList.add("night-inn");
    } else stage = ({ camp, dungeon, cell, room, stable: room })[t.setting](t, cast, seed, onVisible);
    const box = document.createElement("div");
    box.className = "night";
    const cap = document.createElement("div");
    cap.className = "night-cap";
    const b = document.createElement("b"); b.textContent = "Tonight: ";
    cap.append(b, document.createTextNode(t.place + (cast.length > 1 ? ", with " + listNames(cast.slice(1).map((c) => c.h.name)) : "") + "."));
    const hint = document.createElement("span"); hint.className = "tiny dim"; hint.textContent = " Click anyone to hear them.";
    cap.appendChild(hint);
    box.append(stage, cap);
    return box;
  }
  function listNames(ns) { return ns.length < 2 ? ns.join("") : ns.slice(0, -1).join(", ") + " and " + ns[ns.length - 1]; }

  window.Night = { scene };
})();
