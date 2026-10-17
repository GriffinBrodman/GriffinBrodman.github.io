/* The floor sheet: one tacked parchment per floor, its burrows inked as crews come home (ticks and days in the crew's colour, trap Xs with tier dots, the rooms a passage away pencilled with "?", the S of a found secret door, the lair named in pencil when rumoured or ringed when slain, crew pennants), with the heroes' margin notes written in their own pixel hands. */
(function () {
  "use strict";
  const P = window.DungeonPen, { mix, h2, vnoise, hashStr, key } = P;
  const CELL = 6;
  const C = {
    cloth0: "#150d08", cloth1: "#1f140d", cloth2: "#2a1b11", parch: "#eedfba", parch3: "#dbc394", edge: "#b0915e", edge2: "#8a6a42",
    ink: "#2e2116", hatch: "#7a5a3a", paper: "#f3e6c6", lite: "#ece0bc", pencil: "#6e665e", red: "#a3301f", brass: "#c8963e", brass2: "#ecc56a", outline: "#16121a",
  };
  const clean = (s) => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, "-").replace(/…/g, "...").replace(/→/g, "->");

  // where everything sits on the sheet, before anything is drawn: the room boxes in sheet pixels and the passages the token walks
  function layout(D, floor, o) {
    o = o || {};
    const plan = P.carve(D.id, floor), wide = !!o.wide;
    // margins grow with the notes the sheet may carry; the right one always keeps room for the crews' pennants
    const said = new Set((D.notes || []).filter((n) => n.floor === floor.floor && n.text.length <= 90).map((n) => n.text)).size;
    const side = said >= 4 ? 96 : said >= 2 ? 72 : said ? 52 : 20;
    // the sheet is cut to what it shows, so the paper isn't mostly empty; a floor nobody has walked keeps room for its admission
    const fr = frame(D, floor, plan);
    const LM = wide ? side : 12, RM = wide ? Math.max(side, 70) : 12, TM = wide ? 30 : 28, BM = (wide ? (said >= 3 ? 40 : 24) : 12) + (fr.blank && !fr.none ? 40 : 0);
    const title = P.width("neat", clean(`${D.name} - floor ${floor.floor}`));
    const minW = Math.max(title + (wide ? 70 : 50), wide ? 330 : 170), minH = wide ? 190 : 110;
    let cw = (fr.x1 - fr.x0 + 1) * CELL, ch = (fr.y1 - fr.y0 + 1) * CELL;
    const W = Math.max(LM + cw + RM, minW), H = Math.max(TM + ch + BM, minH);
    const mx = Math.round(LM + (W - LM - RM - cw) / 2) - fr.x0 * CELL, my = Math.round(TM + (H - TM - BM - ch) / 2) - fr.y0 * CELL;
    const cx = (x) => mx + x * CELL, cy = (y) => my + y * CELL;
    const rooms = plan.rooms.map((b) => ({ r: b.r, n: b.n, b, x0: cx(b.x0), y0: cy(b.y0), w: b.w * CELL, h: b.h * CELL, cx: cx(b.cx), cy: cy(b.cy) }));
    const byN = {};
    for (const r of rooms) byN[r.n] = r;
    const adj = {};
    for (const c of plan.corrs) { (adj[c.a] = adj[c.a] || []).push([c.b, c, false]); (adj[c.b] = adj[c.b] || []).push([c.a, c, true]); }
    // the token's way from one room to another: along the carved passages, through any rooms between
    function route(a, b) {
      a = key(a); b = key(b);
      if (!byN[a] || !byN[b] || a === b) return byN[b] ? [[byN[b].cx, byN[b].cy]] : [];
      const prev = { [a]: null }, q = [a];
      while (q.length && !(b in prev)) { const n = q.shift(); for (const [m, c, rev] of adj[n] || []) if (!(m in prev)) { prev[m] = [n, c, rev]; q.push(m); } }
      if (!(b in prev)) return [[byN[b].cx, byN[b].cy]];
      const legs = [];
      for (let n = b; prev[n]; n = prev[n][0]) legs.unshift(prev[n]);
      const pts = [[byN[a].cx, byN[a].cy]];
      let at = a;
      for (const [, c, rev] of legs) {
        const cells = rev ? c.cells.slice().reverse() : c.cells;
        const to = rev ? c.a : c.b;
        for (const [x, y] of cells) pts.push([cx(x + 0.5), cy(y + 0.5)]);
        pts.push([byN[to].cx, byN[to].cy]);
        at = to;
      }
      void at;
      // keep only the corners
      const out = [pts[0]];
      for (let i = 1; i < pts.length - 1; i++) {
        const [px, py] = out[out.length - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
        if ((px === x && x === nx) || (py === y && y === ny)) continue;
        out.push(pts[i]);
      }
      out.push(pts[pts.length - 1]);
      return out.slice(1);
    }
    return { W, H, mx, my, CELL, plan, rooms, byN, edges: floor.edges || [], floor, route, wide, blank: fr.blank, none: fr.none, shown: new Map(), cellPx: (x, y) => [cx(x), cy(y)] };
  }
  // the cells worth paper: what the sheet shows (walked rooms, the rooms a passage away, the passages between); a floor with nothing to show
  // keeps a small sheet for its admission
  function frame(D, floor, plan) {
    const inked = new Set(floor.rooms.filter((r) => r.state).map((r) => key(r.n)));
    const cls = P.visible(D, floor, plan, inked);
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    const take = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const b of plan.rooms) if (cls.has(b.n)) for (const [x, y] of b.cells) take(x, y);
    for (const c of plan.corrs) if ((cls.get(c.a) === 1 && cls.has(c.b)) || (cls.get(c.b) === 1 && cls.has(c.a)) || (!inked.size && cls.has(c.a) && cls.has(c.b))) for (const [x, y] of c.cells) take(x, y);
    if (x1 < 0) return { x0: 0, y0: 0, x1: 24, y1: 14, blank: true, none: true };
    const pad = 2;
    return { x0: Math.max(0, x0 - pad), y0: Math.max(0, y0 - pad), x1: Math.min(plan.W - 1, x1 + pad), y1: Math.min(plan.H - 1, y1 + pad), blank: !inked.size };
  }

  function cloth(S, W, H) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const m = vnoise(x * 0.05, y * 0.05, 3), tw = (x + y * 2) % 4 === 0, n = h2(x, y, 4);
      let c = m < 0.4 ? C.cloth0 : m < 0.75 ? C.cloth1 : C.cloth2;
      if (tw) c = mix(c, "#000000", 0.25);
      if (n > 0.985) c = mix(c, "#5c3c24", 0.4);
      S.px(x, y, c);
    }
  }
  // the sheet: mottled paper, a darker handled rim, a deckled edge, two folds and an old cup ring
  function parchment(S, x0, y0, w, h, seed) {
    const base = C.parch, e1 = C.parch3, e2 = C.edge, R = (i) => h2(i, 7, seed);
    const inset = [];
    for (let i = 0; i < Math.max(w, h); i++) inset.push(R(i) < 0.3 ? 1 : R(i + 999) < 0.08 ? 2 : 0);
    for (let j = 0; j < h + 3; j++) for (let i = 0; i < w + 3; i++) if (i >= 3 && j >= 3 && (i >= w || j >= h)) S.px(x0 + i, y0 + j, "#060301", 0.45);
    const fx = Math.round(w * (0.45 + h2(1, 2, seed) * 0.1)), fy = Math.round(h * (0.45 + h2(3, 4, seed) * 0.1));
    const st = [Math.round(w * (0.12 + h2(5, 6, seed) * 0.7)), Math.round(h * (0.15 + h2(7, 8, seed) * 0.6)), 10 + Math.round(h2(9, 9, seed) * 6)];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (i < inset[j % inset.length] || w - 1 - i < inset[(j + 7) % inset.length] || j < inset[i % inset.length] || h - 1 - j < inset[(i + 3) % inset.length]) continue;
      const d = Math.min(i, j, w - 1 - i, h - 1 - j);
      let c = d < 1 ? e2 : d < 3 ? e1 : base;
      const n = h2(i + seed, j, 51), m = vnoise((i + seed) * 0.06, j * 0.06, 52), m2 = vnoise((i + seed) * 0.02, j * 0.02, 53);
      if (d >= 3 && m < 0.22) c = mix(c, e1, 0.3);
      if (d >= 3 && m2 > 0.75) c = mix(c, e1, 0.2);
      if (d >= 3 && d < 9 && n < 0.25 + (9 - d) * 0.05) c = mix(c, e1, 0.45);
      if (d >= 3 && n < 0.02) c = e1;
      if (i === fx || j === fy) c = mix(c, e1, 0.7);
      if (i === fx + 1 || j === fy + 1) c = mix(c, "#fff8e8", 0.3);
      const sd = Math.hypot(i - st[0], (j - st[1]) * 1.15);
      if (sd < st[2] && sd > st[2] - 1.4 && n < 0.8) c = mix(c, e2, 0.6);
      else if (sd < st[2] - 1.5 && n < 0.3) c = mix(c, e1, 0.35);
      S.px(x0 + i, y0 + j, c);
    }
  }
  function tack(S, x, y) {
    const r = P.ramp(C.brass);
    S.px(x + 1, y + 2, "#140c06", 0.5); S.px(x + 2, y + 1, "#140c06", 0.4); S.px(x + 2, y + 2, "#140c06", 0.3);
    S.px(x, y, r[4]); S.px(x + 1, y, r[3]); S.px(x, y + 1, r[3]); S.px(x + 1, y + 1, r[1]);
  }
  // a crew's pin: a pennant in its colours on a brass pin, the point where the crew stands
  function crewPin(S, x, y, crew) {
    const b = P.crewBanner(crew), r1 = P.ramp(b.c1), r2 = P.ramp(b.c2 || "#e8dcc0");
    S.px(x + 1, y + 1, "#140c06", 0.55); S.px(x + 2, y + 2, "#140c06", 0.35);
    for (let j = -14; j <= 0; j++) S.px(x, y + j, j === -14 ? C.brass2 : j < -8 ? "#d8c8a8" : "#9a8a70");
    for (let j = 0; j < 9; j++) for (let i = 0; i < 11 - Math.abs(j - 4) * 1.5; i++) {
      let c = j === 0 ? r1[3] : j === 8 ? r1[1] : i < 2 ? r1[3] : r1[2];
      if (i >= 2 && i <= 4 && j >= 3 && j <= 5) c = r2[3];
      S.px(x + 1 + i, y - 14 + j, c);
    }
    for (let j = 0; j < 9; j++) S.px(x + 1 + Math.ceil(11 - Math.abs(j - 4) * 1.5), y - 14 + j, C.outline);
    for (let i = 1; i <= 10; i++) { S.px(x + i, y - 15, C.outline); S.px(x + i, y - 5, C.outline); }
    S.px(x - 1, y - 1, r1[2]); S.px(x, y - 1, r1[3]); S.px(x + 1, y - 1, r1[1]); S.px(x - 1, y, r1[1]); S.px(x, y, r1[2]); S.px(x + 1, y, r1[0]);
  }

  // ---------- one sheet ----------
  function draw(cv, G, D, st, notes) {
    const { W, H, plan, mx, my } = G, S = P.surface(W, H), I = plan.I;
    const occ = new Uint8Array(W * H);
    const block = (x, y, w, h) => { for (let j = Math.max(0, y); j < Math.min(H, y + h); j++) for (let i = Math.max(0, x); i < Math.min(W, x + w); i++) occ[j * W + i] = 1; };
    const seed = hashStr(D.id + ":" + G.floor.floor) % 9973;
    cloth(S, W, H);
    const SX = 4, SY = 4, SW = W - 8, SH = H - 8;
    parchment(S, SX, SY, SW, SH, seed);
    block(0, 0, W, SY + 6); block(0, 0, SX + 6, H); block(SX + SW - 6, 0, 10, H); block(0, SY + SH - 6, W, 10);

    // what is inked, what is pencilled: the walked rooms, and the rooms one passage from them, with the passages between
    const roomCls = P.visible(D, G.floor, plan, st.inked);
    G.shown = roomCls;
    const corrCls = new Map();
    const blankFloor = !st.inked.size;
    for (const c of plan.corrs) {
      const ia = roomCls.get(c.a), ib = roomCls.get(c.b);
      if (ia === 1 && ib === 1) corrCls.set(c.k, 1);
      else if (ia && ib && (ia === 1 || ib === 1 || blankFloor)) corrCls.set(c.k, 2);
    }
    const lair = plan.rooms.find((b) => b.r.lair);
    const rumour = lair && st.rumour && roomCls.get(lair.n) === 2;
    const unmapped = blankFloor;
    const cls = new Uint8Array(W * H);
    const fillCell = (x, y, k) => { const X = mx + x * CELL, Y = my + y * CELL; for (let j = 0; j < CELL; j++) for (let i = 0; i < CELL; i++) { const p = (Y + j) * W + X + i; if (p >= 0 && p < W * H && X + i >= 0 && X + i < W && (!cls[p] || cls[p] > k)) cls[p] = k; } };
    for (const b of plan.rooms) if (roomCls.has(b.n)) for (const [x, y] of b.cells) fillCell(x, y, roomCls.get(b.n));
    for (const c of plan.corrs) { const v = corrCls.get(c.k); if (v) for (const [x, y] of c.cells) fillCell(x, y, v); }
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : cls[y * W + x]);
    // hatching round the inked walls
    const dist = new Uint8Array(W * H).fill(99), q = [];
    for (let i = 0; i < W * H; i++) if (cls[i] === 1) { dist[i] = 0; q.push(i); }
    for (let hd = 0; hd < q.length; hd++) {
      const i = q[hd], X = i % W, Y = (i / W) | 0, d = dist[i];
      if (d >= 6) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = X + dx, ny = Y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (dist[j] > d + 1) { dist[j] = d + 1; q.push(j); }
      }
    }
    for (let Y = SY + 3; Y < SY + SH - 3; Y++) for (let X = SX + 3; X < SX + SW - 3; X++) {
      const i = Y * W + X, k = cls[i];
      if (k === 1) {
        let wall = false, thick = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(X + dx, Y + dy) !== 1) wall = true;
        for (const [dx, dy] of [[2, 0], [0, 2], [1, 1]]) if (at(X + dx, Y + dy) !== 1) thick = true;
        S.px(X, Y, wall ? C.ink : thick ? mix(C.paper, C.hatch, 0.18) : h2(X, Y, 41) < 0.05 ? C.lite : C.paper);
        occ[i] = 1;
        continue;
      }
      if (k === 2) {
        let edge = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(X + dx, Y + dy) === 0) edge = true;
        if (edge && (X + Y) % 2 === 0) S.px(X, Y, mix(C.ink, C.parch, 0.25));
        occ[i] = 1;
        continue;
      }
      const d = dist[i];
      if (d <= 6) {
        occ[i] = 1;
        if (d === 1) S.px(X, Y, C.ink);
        else if ((X + Y) % 3 === 0 && h2(X >> 1, Y >> 1, 43) < (d <= 3 ? 0.97 : d <= 4 ? 0.75 : d <= 5 ? 0.45 : 0.2)) S.px(X, Y, d <= 3 ? mix(C.hatch, C.ink, 0.45) : C.hatch);
      }
    }
    // a number, or any mark, on a halo of clean paper so it reads over hatching and walls
    const haloed = (fn, col) => {
      const pts = [];
      fn((x, y) => pts.push([x, y]));
      const set = new Set(pts.map(([x, y]) => y * W + x));
      for (const [x, y] of pts) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) if (!set.has((y + dy) * W + x + dx)) S.px(x + dx, y + dy, C.paper);
      for (const [x, y] of pts) S.px(x, y, col);
      for (const [x, y] of pts) block(x - 1, y - 1, 3, 3);
    };
    const cellXY = (x, y) => [mx + x * CELL, my + y * CELL];
    for (const b of plan.rooms) if (roomCls.get(b.n) === 2) { const [x, y] = cellXY(b.cx, b.cy); haloed((p) => P.write(p, "neat", "?", x - 2, y - 4, { col: C.pencil }), C.pencil); }
    if (unmapped) sketch(S, G, D, st, block, roomCls, cls);
    // the lair nobody has reached, pencilled from the talk
    if (rumour) {
      const [lx, ly] = cellXY(lair.cx, lair.cy);
      block(cellXY(lair.x0, 0)[0] - 2, cellXY(0, lair.y0)[1] - 2, lair.w * CELL + 4, lair.h * CELL + 4);
      const nm = clean(String((D.boss && D.boss.name) || "the boss").replace(/^the\s+/i, "").split(/[ ,]/)[0]) + "?";
      const tw = P.width("cramped", nm), tx = Math.min(W - 12 - tw, lx + (lair.w * CELL) / 2 + 3), ty = ly - 3;
      haloed((p) => P.write(p, "cramped", nm, tx, ty, {}), P.HANDS.cramped.col);
    }
    for (const b of plan.rooms) {
      if (roomCls.get(b.n) !== 1) continue;
      const r = b.r, [lx0, ly0] = plan.label(b), [X, Y] = cellXY(lx0, ly0);
      if (r.stair) {
        const [sx, sy] = cellXY(b.x0 + b.w - 1, b.y0 + b.h - 1);
        for (let t = 0; t < 5; t++) for (let u = 0; u <= t; u++) S.px(sx + t, sy + 5 - u, t % 2 ? C.ink : mix(C.ink, C.paper, 0.45));
        for (let t = 0; t < 6; t++) S.px(sx + t, sy + 5, C.ink);
      }
      if (r.trap) {
        const tc = b.cells[b.cells.length - 1], [tx0, ty0] = cellXY(tc[0], tc[1]), tier = Math.max(1, Math.min(3, r.trap_tier || 1));
        const tx = tx0 + (b.w > 3 ? -2 : 0), ty = ty0;
        haloed((p) => { for (let i = 0; i < 5; i++) { p(tx + i, ty + i); p(tx + 4 - i, ty + i); p(tx + 1 + i, ty + i); p(tx + 5 - i, ty + i); } }, C.red);
        for (let t = 0; t < tier; t++) { S.px(tx + 1 + t * 2, ty - 2, C.red); }
        if (st.sprung.has(b.n)) P.ring(S.px, tx + 3, ty + 2.5, 5, 4.5, C.red, { seed: tx, wob: 1.2, over: 1.15, drift: 0.01 });
      }
      if (r.famous) haloed((p) => P.write(p, "neat", "!", X - 3, Y - 4, { col: C.red }), C.red);
      const label = b.secret ? "S" : String(r.n), lw = P.width("map", label);
      const slainLair = r.lair && st.slain;
      // on a phone the sheet is small: bold numbers, and the day each room was inked stays on its card
      const narrow = !G.wide, bw = narrow ? lw + label.length : lw;
      haloed((p) => P.write(p, "map", label, X + 2, Y + 2, { col: C.ink, bold: narrow }), b.secret || slainLair ? C.red : C.ink);
      const tick = st.inked.get(b.n);
      if (tick) {
        const c = P.crewInk(tick.crew), tx = X + 3 + bw;
        haloed((p) => P.tick(p, tx, Y + 2, "#000000"), c);
        if (!narrow) { const ds = "D" + tick.d; haloed((p) => P.Font3.text(p, ds, tx + 3, Y + 10, c), mix(c, C.paper, 0.1)); }
      }
      if (r.lair && st.slain) for (const rad of [b.w * CELL * 0.62, b.w * CELL * 0.72]) {
        const [cx, cy] = cellXY(b.cx, b.cy);
        for (let a = 0; a < 140; a++) {
          if (rad > b.w * CELL * 0.7 && a % 5 === 4) continue;
          const t = (a / 140) * Math.PI * 2;
          S.px(Math.round(cx + Math.cos(t) * rad), Math.round(cy + Math.sin(t) * rad * 0.7), C.red);
        }
      }
    }
    // the S where a secret passage was found
    for (const c of plan.corrs) {
      if (!c.secret || corrCls.get(c.k) !== 1 || !c.cells.length) continue;
      const [x, y] = cellXY(c.cells[0][0], c.cells[0][1]);
      haloed((p) => P.write(p, "map", "S", x, y - 1, { bold: true, col: C.red }), C.red);
    }
    // the title, the compass and the crews who inked this floor
    const title = clean(`${D.name} - floor ${G.floor.floor}`);
    P.write(S.px, "neat", title, 14, 12, {});
    P.line(S.px, 12, 22, 16 + P.width("neat", title), 21, P.HANDS.neat.col);
    block(10, 8, P.width("neat", title) + 10, 18);
    const nx = W - 22, ny = 12;
    P.write(S.px, "neat", "N", nx - 2, ny, {});
    for (let i = 0; i < 13; i++) S.px(nx + 1, ny + 9 + i, i < 6 ? C.red : C.ink);
    for (let i = -6; i <= 6; i++) S.px(nx + 1 + i, ny + 15, C.ink);
    for (const [a, b2] of [[0, 10], [2, 10], [-1, 11], [3, 11], [-1, 12], [3, 12]]) S.px(nx + a, ny + b2, C.red);
    block(nx - 8, ny - 2, 18, 26);
    if (G.wide) {
      const crews = [];
      for (const v of st.inked.values()) if (!crews.includes(v.crew)) crews.push(v.crew);
      let ly = ny + 30;
      for (const crew of crews.slice(0, 4)) {
        const A = window.App || {}, hero = (A.heroes || {})[crew];
        const g = A.parties && A.parties[crew] && A.parties[crew].banner ? Art.bannerGrid(A.parties[crew].banner) : hero ? P.bust(hero, 14) : null;
        const lx = W - 36;
        if (g) { S.grid(g, lx - (g.w >> 1), ly); ly += g.h + 2; }
        const nm = clean(P.crewShort(crew)), w = P.width("neat", nm);
        P.write(S.px, "neat", nm, Math.min(W - 10 - w, lx - (w >> 1)), ly + 1, { col: mix(P.crewInk(crew), C.ink, 0.25) });
        block(lx - 30, ly - (g ? g.h + 2 : 0) - 2, 60, (g ? g.h + 2 : 0) + 14);
        ly += 15;
      }
    }
    const onPaper = (notes || []).filter((n) => roomCls.get(key(n.room)) === 1);
    const placed = G.wide && onPaper.length ? margins(S, G, onPaper, occ, block) : [];
    for (const pin of st.crews || []) {
      const b = G.byN[key(pin.n)];
      if (b) crewPin(S, Math.round(b.x0 + b.w - 5), Math.round(b.y0 + 4), pin.crew);
    }
    for (const [x, y] of [[SX + 2, SY + 2], [SX + SW - 5, SY + 2], [SX + 2, SY + SH - 5], [SX + SW - 5, SY + SH - 5]]) tack(S, x, y);
    S.canvas(cv);
    return placed;
  }

  // a floor nobody has walked: the way in from the stair above (when anyone has reached it) is already pencilled with the rooms off it;
  // a pencilled admission sits below it, or across the middle of an empty sheet
  function sketch(S, G, D, st, block, roomCls, cls) {
    const { plan, mx, my, W, H } = G;
    const door = plan.byN[key((G.floor.rooms[0] || {}).n)];
    if (door && roomCls.get(door.n) === 2) {
      // the label sits beside the way in, on whichever side has clear paper
      const lbl = G.floor.floor === 1 ? "way in" : "stair from above", lw = P.width("cramped", lbl);
      const clearAt = (x, y) => { for (let j = -1; j < 11; j++) for (let i = -1; i < lw + 2; i++) { const X = x + i, Y = y + j; if (X < 8 || Y < 26 || X >= W - 8 || Y >= H - 8 || cls[Y * W + X]) return false; } return true; };
      const L0 = mx + door.x0 * CELL, T0 = my + door.y0 * CELL, R0 = L0 + door.w * CELL, B0 = T0 + door.h * CELL, MY = Math.round((T0 + B0) / 2 - 4);
      const spot = [[L0 - lw - 4, MY], [R0 + 4, MY], [Math.round((L0 + R0) / 2 - lw / 2), B0 + 3], [Math.round((L0 + R0) / 2 - lw / 2), T0 - 12]].find(([x, y]) => clearAt(x, y)) || [L0 - lw - 4, MY];
      P.write(S.px, "cramped", lbl, spot[0], spot[1], {});
      block(spot[0] - 2, spot[1] - 2, lw + 4, 12);
    }
    const l1 = "Nobody has mapped", l2 = "this floor yet.", Hh = P.hand("cramped"), lh = P.lineH(Hh) + 1;
    const w = Math.max(P.width("cramped", l1), P.width("cramped", l2)) + 12, h = lh * 2 + 8;
    const free = (x, y) => { for (let j = -2; j < h + 2; j++) for (let i = -2; i < w + 2; i++) { const X = x + i, Y = y + j; if (X < 6 || Y < 26 || X >= W - 6 || Y >= H - 6) return false; } return true; };
    let bx = Math.round(W / 2 - w / 2), by = Math.round(H / 2 - h / 2) + 6;
    if (door && roomCls.get(door.n) === 2) {
      const spots = [[bx, H - h - 10], [bx, 28], [8, H - h - 10], [W - w - 8, H - h - 10]];
      const clear = (x, y) => { for (const b of G.rooms) if (roomCls.has(b.n) && x < b.x0 + b.w + 4 && b.x0 - 4 < x + w && y < b.y0 + b.h + 14 && b.y0 - 4 < y + h) return false; return free(x, y); };
      const sp = spots.find(([x, y]) => clear(x, y));
      if (sp) [bx, by] = sp;
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
      S.px(bx + i, by + j, edge ? ((i + j) % 3 ? C.pencil : null) : mix(C.parch, "#fff8e8", 0.35), edge ? 0.6 : 0.92);
    }
    P.write(S.px, "cramped", l1, bx + 6, by + 5, { seed: 3 });
    P.write(S.px, "cramped", l2, bx + 6 + Math.round((P.width("cramped", l1) - P.width("cramped", l2)) / 2), by + 5 + lh, { seed: 9 });
    block(bx - 2, by - 2, w + 4, h + 4);
  }

  // ---------- margin notes: each in its writer's hand, as near its room as the paper allows ----------
  const ARROW = /\s*(?:->|=>|-->)\s*$|^\s*(?:<-|<=|<--)\s*/;
  function noteLines(n, w) {
    const sig = " -" + String(n.name || "?").trim()[0].toUpperCase();
    return P.wrap(n.hand, clean(n.text).replace(ARROW, " ").trim() + sig, w);
  }
  function margins(S, G, notes, occ, block) {
    const { W, H } = G;
    // summed-area table of what is taken, rebuilt after each note goes down
    let sat = null;
    const build = () => {
      sat = new Int32Array((W + 1) * (H + 1));
      for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += occ[y * W + x]; sat[(y + 1) * (W + 1) + x + 1] = sat[y * (W + 1) + x + 1] + row; } }
    };
    const taken = (x, y, w, h) => {
      if (x < 0 || y < 0 || x + w > W || y + h > H) return true;
      const A = sat[y * (W + 1) + x], B = sat[y * (W + 1) + x + w], Cc = sat[(y + h) * (W + 1) + x], Dd = sat[(y + h) * (W + 1) + x + w];
      return Dd - B - Cc + A > 0;
    };
    const placed = [];
    for (const n of notes) {
      const b = G.byN[key(n.room)];
      if (!b) continue;
      const pointed = ARROW.test(clean(n.text));
      const Hh = P.hand(n.hand), lh = P.lineH(Hh) + (Hh.font === "3" ? 0 : 0);
      const widths = Hh.font === "3" && Hh.k === 2 ? [118, 150, 90] : [92, 118, 72, 140];
      build();
      let best = null;
      for (const mw of widths) {
        const ls = noteLines(n, mw);
        const w = Math.max(...ls.map((l) => P.width(n.hand, l))) + 2, h = ls.length * lh + 1;
        for (let y = 2; y + h < H - 2; y += 2) for (let x = 2; x + w < W - 2; x += 2) {
          const nx = Math.max(x, Math.min(b.cx, x + w)), ny = Math.max(y, Math.min(b.cy, y + h));
          const d = Math.hypot(nx - b.cx, ny - b.cy);
          if (best && d + h * 0.15 >= best.cost) continue;
          if (taken(x - 2, y - 2, w + 4, h + 4)) continue;
          // a note that points needs room for its arrow
          if (pointed && Math.max(b.x0 - x - w, x - b.x0 - b.w, b.y0 - y - h, y - b.y0 - b.h) < 14) continue;
          best = { cost: d + h * 0.15, x, y, w, h, ls, d, nx, ny };
        }
      }
      if (!best || best.d > 70) continue;
      const col = n.kind === "boss" ? C.red : Hh.col;
      best.ls.forEach((l, i) => P.write(S.px, n.hand, l, best.x, best.y + i * lh, { col, seed: (hashStr(n.text) % 997) + i * 17, flourish: Hh.flourish && i === 0 }));
      block(best.x - 3, best.y - 3, best.w + 6, best.h + 6);
      const far = Math.hypot(Math.max(b.x0 - 2, Math.min(best.nx, b.x0 + b.w + 2)) - best.nx, Math.max(b.y0 - 2, Math.min(best.ny, b.y0 + b.h + 2)) - best.ny);
      if ((best.d > 9 && far > 5) || (pointed && far > 1)) {
        // from the note's nearest edge to just short of the room
        const sx = best.nx, sy = best.ny;
        const tx = Math.max(b.x0 - 2, Math.min(sx, b.x0 + b.w + 2)), ty = Math.max(b.y0 - 2, Math.min(sy, b.y0 + b.h + 2));
        const len = Math.max(0.01, Math.hypot(tx - sx, ty - sy)), ux = (tx - sx) / len, uy = (ty - sy) / len;
        const pts = [[sx + ux * 2, sy + uy * 2], [tx - ux * 2, ty - uy * 2]].map(([x, y]) => [Math.round(x), Math.round(y)]);
        P.arrow(S.px, pts, col, 4);
        const ar = [];
        P.arrow((x, y) => ar.push([x, y]), pts, col, 4);
        for (const [x, y] of ar) block(x - 1, y - 1, 3, 3);
      }
      placed.push({ note: n, x: best.x, y: best.y, w: best.w, h: best.h });
    }
    return placed;
  }

  // a note on its own slip, in its writer's hand, for the cards under the sheet and the phone's pins
  function slip(n, maxW) {
    const Hh = P.hand(n.hand), ls = P.wrap(n.hand, clean(n.text), maxW || 150), lh = P.lineH(Hh) + 1;
    const w = Math.max(20, ...ls.map((l) => P.width(n.hand, l))) + 4, h = ls.length * lh + 3;
    const S = P.surface(w, h);
    ls.forEach((l, i) => P.write(S.px, n.hand, l, 1, 2 + i * lh, { col: n.kind === "boss" ? C.red : Hh.col, seed: (hashStr(n.text) % 997) + i * 17, flourish: Hh.flourish && i === 0 }));
    return S.canvas();
  }
  function bustCanvas(h, rows) { const g = P.bust(h, rows || 16), S = P.surface(g.w, g.h); S.grid(g, 0, 0); return S.canvas(); }

  window.DungeonInk = { layout, draw, slip, bustCanvas, clean, CELL };
})();
