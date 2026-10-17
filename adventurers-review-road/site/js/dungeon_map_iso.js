/* The floor stack: every floor of a dungeon as an exploded isometric cutaway, painted in where crews have walked (the clearing crew's stripe on each room number), chalk where nobody has, ladders between floors, tiny crews below tonight, and the boss first as a chalk rumour, then a slain ring. */
(function () {
  "use strict";
  const P = window.DungeonPen, { mix, h2, vnoise, key, ramp } = P;
  const A = 4, BH = 2, WH = 5, LOW = 2, BOT = -9;

  // materials per lair theme, dark to light; the top floor of a camp or den is open ground
  const MAT = {
    grass: { top: "#5f7e3a", low: "#8a6a44", side: "#7a5034", floor: "#b08e5c", corr: "#9a7c4e", strata: "#5c4030", lair: "#b08e5c", style: "plank" },
    earth: { top: "#5a4a38", low: "#6a5844", side: "#8a7258", floor: "#b49e7c", corr: "#968062", strata: "#463a30", lair: "#ac9070", style: "earth" },
    mine: { top: "#4c4238", low: "#5a4c3e", side: "#8a7a62", floor: "#b4a282", corr: "#948266", strata: "#463e3a", lair: "#a8977a", style: "earth" },
    crypt: { top: "#34303a", low: "#433e48", side: "#77727c", floor: "#9c968c", corr: "#85807a", strata: "#2e2830", lair: "#a88a7a", style: "flag" },
    swamp: { top: "#3e4a2c", low: "#4e5636", side: "#6a6a4a", floor: "#9a9a6e", corr: "#82825c", strata: "#30321e", lair: "#8e8a5e", style: "earth" },
    ice: { top: "#6a7e92", low: "#7a8ea2", side: "#a2b6c8", floor: "#d0dce6", corr: "#b4c4d2", strata: "#4a5a6c", lair: "#c4cede", style: "flag" },
    sea: { top: "#2e4a52", low: "#3a5860", side: "#6a8a8e", floor: "#a6b8b0", corr: "#8aa29c", strata: "#22363c", lair: "#9ab0a8", style: "flag" },
    fire: { top: "#3a2620", low: "#4a3028", side: "#7a5244", floor: "#a8806a", corr: "#8e6a58", strata: "#2a1812", lair: "#b07a5e", style: "flag" },
  };
  function material(theme, depth) {
    const base = theme === "goblin" || theme === "beast" ? (depth === 0 ? MAT.grass : MAT.earth) : theme === "cave" ? MAT.mine : theme === "undead" ? MAT.crypt : MAT[theme] || MAT.mine;
    const k = Math.min(0.32, depth * 0.09), out = {};
    for (const [n, v] of Object.entries(base)) out[n] = n === "style" ? v : ramp(mix(v, "#100c10", k));
    return out;
  }
  function tone(r, v, X, Y) {
    const d = [0, 0.5, 0.125, 0.625, 0.75, 0.25, 0.875, 0.375][(X & 1) + (Y & 1) * 2 + ((X >> 1) & 1) * 4] - 0.5;
    const q = v + d * 0.35;
    return r[q < 0.6 ? 0 : q < 1.5 ? 1 : q < 2.4 ? 2 : q < 3.3 ? 3 : 4];
  }

  // ---------- one floor ----------
  function model(D, floor, depth, st) {
    const plan = P.carve(D.id, floor), { W, H, own, I } = plan;
    const seen = (b) => st.inked.has(b.n);
    const open = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const o = own[i];
      if (o > 0) open[i] = seen(plan.rooms[o - 1]) ? 1 : 0;
      else if (o < 0) {
        const c = plan.corrs[-o - 1], a = plan.byN[c.a], b = plan.byN[c.b];
        open[i] = c.secret ? (seen(a) && seen(b) ? 1 : 0) : seen(a) || seen(b) ? 1 : 0;
      }
    }
    const top = new Float32Array(W * H), mat = new Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = I(x, y);
      if (open[i]) { top[i] = 0; const o = own[i]; mat[i] = o > 0 ? (plan.rooms[o - 1].r.lair ? "lair" : "floor") : "corr"; continue; }
      const near = (dx, dy) => x - dx >= 0 && y - dy >= 0 && open[I(x - dx, y - dy)];
      if (near(1, 0) || near(0, 1) || near(1, 1)) { top[i] = LOW; mat[i] = "low"; } else { top[i] = WH; mat[i] = "top"; }
    }
    const OX = H * A, OY = WH + 2, GW = (W + H) * A + 1, GH = OY + (W + H) * BH - BOT + 3;
    return { D, floor, depth, plan, W, H, I, open, top, mat, T: material(D.theme, depth), OX, OY, GW, GH, st };
  }
  function render(m) {
    const { top, I, W, H, OX, OY, GW, GH } = m;
    const S = P.surface(GW, GH), hit = new Uint8Array(GW * GH);
    const tz = (cx, cy) => (cx >= 0 && cy >= 0 && cx < W && cy < H ? top[I(cx, cy)] : -99);
    for (let Y = 0; Y < GH; Y++) for (let X = 0; X < GW; X++) {
      const u = (X + 0.5 - OX) / A;
      let pcx = null, pcy = null, pz = 0;
      for (let z = WH + 1; z >= BOT; z -= 0.125) {
        const s = (Y + 0.5 - OY + z) / BH, x = (s + u) / 2, y = (s - u) / 2, cx = Math.floor(x), cy = Math.floor(y);
        const t = tz(cx, cy);
        if (t > -99 && z <= t) {
          let face = pcx == null || (pcx === cx && pcy === cy) ? "top" : pcx !== cx ? "sx" : "sy";
          if (face !== "top" && z > t - 0.13 && pcx != null && pz > t) face = "top";
          S.px(X, Y, shade(m, face, cx, cy, x - cx, y - cy, z, t, X, Y));
          hit[Y * GW + X] = 1;
          break;
        }
        pcx = cx; pcy = cy; pz = z;
      }
    }
    for (let Y = 0; Y < GH; Y++) for (let X = 0; X < GW; X++) {
      if (hit[Y * GW + X]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const a = X + dx, b = Y + dy; return a >= 0 && b >= 0 && a < GW && b < GH && hit[b * GW + a]; })) S.px(X, Y, "#120a06");
    }
    rim(m, S);
    return { S, hit };
  }
  // the slab's outer edges: a lit lip along the near top edges, a fainter one behind, a dark seam where the sides meet the floor below
  function rim(m, S) {
    const { W, H, OX, OY, T } = m, at = (x, y, z) => [OX + (x - y) * A, OY + (x + y) * BH - z];
    const lit = mix(T.top[4], "#f4e2b0", 0.35), far = mix(T.top[3], "#f4e2b0", 0.15), seam = mix(T.strata[0], "#000000", 0.4);
    const edge = (p, q, col, a) => P.line((x, y) => S.px(x, y, col, a), p[0], p[1], q[0], q[1], col);
    edge(at(0, H, WH), at(W, H, WH), lit, 0.95);
    edge(at(W, 0, WH), at(W, H, WH), lit, 0.95);
    edge(at(0, 0, WH), at(W, 0, WH), far, 0.6);
    edge(at(0, 0, WH), at(0, H, WH), far, 0.6);
    edge(at(0, H, BOT + 1), at(W, H, BOT + 1), seam, 0.7);
    edge(at(W, 0, BOT + 1), at(W, H, BOT + 1), seam, 0.7);
    const [cx, cy] = at(W, H, WH);
    for (let j = 1; j <= WH - BOT - 1; j++) S.px(cx, cy + j, mix(T.side[3], "#f4e2b0", 0.25), 0.8);
  }
  function shade(m, face, cx, cy, fx, fy, z, t, X, Y) {
    const i = m.I(cx, cy), mt = m.mat[i], T = m.T, sty = T.style, fi = m.depth;
    const n = h2(Math.floor(fx * 6) + cx * 9, Math.floor(fy * 6) + cy * 9, 3 + fi), v = vnoise((cx + fx) * 0.8, (cy + fy) * 0.8, 13 + fi);
    const hgt = (dx, dy) => { const x = cx + dx, y = cy + dy; return x >= 0 && y >= 0 && x < m.W && y < m.H ? m.top[m.I(x, y)] : -99; };
    if (face === "top") {
      let ao = 0;
      if (t <= 0) {
        if (hgt(-1, 0) > t + 0.5 && fx < 0.3) ao += hgt(-1, 0) > 3 ? 0.55 : 0.25;
        if (hgt(0, -1) > t + 0.5 && fy < 0.3) ao += hgt(0, -1) > 3 ? 0.55 : 0.25;
      }
      if (mt === "top") {
        const rim = [[1, 0, fx > 0.82], [0, 1, fy > 0.82], [-1, 0, fx < 0.18], [0, -1, fy < 0.18]].some(([dx, dy, near]) => near && hgt(dx, dy) < WH - 0.5 && hgt(dx, dy) > -90);
        if (sty === "plank") return rim ? tone(T.low, 3.6, X, Y) : tone(T.top, 2 + (v - 0.5) * 0.9 + (n < 0.05 ? -0.7 : n > 0.96 ? 0.8 : 0), X, Y);
        return rim ? tone(T.side, 3.8, X, Y) : tone(T.top, 1.9 + (v - 0.5) * 0.8 + (n < 0.05 ? -0.5 : n > 0.97 ? 0.9 : 0), X, Y);
      }
      if (mt === "low") return tone(T.low, (fx > 0.7 || fy > 0.7 ? 3.4 : 2.5) + (v - 0.5) * 0.5 + (n < 0.08 ? -0.6 : 0), X, Y);
      if (mt === "floor" || mt === "lair") {
        const r = mt === "lair" ? T.lair : T.floor;
        if (sty === "plank") { const seam = Math.floor((fy + cy) * 3) !== Math.floor((fy + cy) * 3 - 0.14); return tone(r, (seam ? 1.4 : 2.7) + (n < 0.08 ? -0.6 : 0) - ao, X, Y); }
        if (sty === "flag") { const joint = fx < 0.09 || fy < 0.09 || (Math.abs(fx - 0.5) < 0.05 && cy & 1); return tone(r, (joint ? 1.4 : 2.7 + (h2(cx, cy, 77) - 0.5) * 0.5) + (n < 0.05 ? -0.5 : 0) - ao, X, Y); }
        return tone(r, 2.6 + (v - 0.5) * 0.6 + (n < 0.1 ? -0.6 : n > 0.93 ? 0.6 : 0) - ao, X, Y);
      }
      return tone(T.corr, 1.35 + (n < 0.12 ? -0.5 : 0) - ao * 0.6, X, Y);
    }
    const lit = face === "sy" ? 0.4 : -0.4, along = face === "sy" ? fx : fy, zz = Math.floor(z);
    if (z < 0) {
      const band = Math.floor((-z + 1) / 3);
      if (m.D.theme === "fire" && h2(Math.floor(along * 8) + cx * 8 + cy * 8, zz, 61) < 0.03) return "#d8542a";
      return tone(T.strata, 2 + lit + (band % 2 ? -0.45 : 0.2) + (h2(Math.floor(along * 6) + cx * 6 + cy * 6, band, 5) < 0.14 ? -0.6 : 0), X, zz);
    }
    const lip = z > t - 1 ? 0.6 : 0;
    if (mt === "low") return tone(T.low, 1.6 + lit + lip, X, zz);
    if (sty === "plank") { const s2 = Math.floor(along * 3); return tone(T.side, 1.9 + lit + (Math.abs(along * 3 - s2 - 0.5) > 0.38 ? -0.9 : 0) + lip, X, zz); }
    if (sty === "earth") { const post = Math.abs(along - 0.5) < 0.09 && (cx + cy) & 1; return post ? tone(ramp("#7a5034"), 2 + lit, X, zz) : tone(T.side, 1.9 + lit + (h2(Math.floor(along * 5) + cx * 5 + cy * 5, Math.floor(z / 2), 7) < 0.2 ? -0.8 : 0) + lip, X, zz); }
    const brick = zz % 3 === 0 || Math.floor(along * 3 + (Math.floor(zz / 3) & 1) * 0.5) !== Math.floor(along * 3 + (Math.floor(zz / 3) & 1) * 0.5 - 0.06);
    return tone(T.side, (brick ? 1.2 : 2) + lit + lip, X, zz);
  }

  // ---------- marks on a floor ----------
  function marks(m, R) {
    const { S } = R, { plan, OX, OY, st } = m, D = m.D;
    const at = (x, y, z) => [OX + (x - y) * A, OY + (x + y) * BH - (z || 0)];
    const seen = (b) => st.inked.has(b.n);
    const chalkLine = (x0, y0, z0, x1, y1, z1, col, dash) => {
      const [a, b] = at(x0, y0, z0), [c, d] = at(x1, y1, z1), n = Math.max(Math.abs(c - a), Math.abs(d - b)) || 1;
      for (let k = 0; k <= n; k++) { if (dash && k % 4 === 3) continue; S.px(Math.round(a + ((c - a) * k) / n), Math.round(b + ((d - b) * k) / n), col); }
    };
    const outline = (b, col, dash) => {
      const set = new Set(b.cells.map(([x, y]) => x + "," + y));
      for (const [x, y] of b.cells) for (const [dx, dy, p, q] of [[1, 0, [1, 0], [1, 1]], [-1, 0, [0, 0], [0, 1]], [0, 1, [0, 1], [1, 1]], [0, -1, [0, 0], [1, 0]]]) {
        if (set.has(x + dx + "," + (y + dy))) continue;
        const zz = m.top[m.I(x, y)];
        chalkLine(x + p[0], y + p[1], zz, x + q[0], y + q[1], zz, col, dash);
      }
    };
    const lair = plan.rooms.find((b) => b.r.lair);
    const rumour = st.rumour;
    for (const b of plan.rooms) {
      if (seen(b) || b.secret || (b.r.lair && !rumour)) continue;
      outline(b, b.r.lair ? "#e8c8a0" : "#d6cab0", true);
    }
    for (const c of plan.corrs) {
      if (c.secret) continue;
      for (const [x, y] of c.cells) if (!m.open[m.I(x, y)]) { const [sx, sy] = at(x + 0.5, y + 0.5, m.top[m.I(x, y)]).map(Math.round); S.px(sx, sy, "#d6cab0"); S.px(sx + 1, sy, "#d6cab0"); }
    }
    for (const b of plan.rooms) {
      if (!seen(b)) continue;
      if (b.r.stair) {
        const x = b.x0 + b.w - 1, y = b.y0 + b.h - 1, [sx, sy] = at(x + 0.5, y + 0.5, 0).map(Math.round), stc = ramp("#6a5a48");
        for (let j = -2; j <= 2; j++) for (let i = -4 + Math.abs(j) * 2; i <= 4 - Math.abs(j) * 2; i++) S.px(sx + i, sy + j, "#1a100a");
        for (let k = 0; k < 3; k++) for (let i = -2 + k; i <= 2 - k; i++) S.px(sx + i - k, sy - 1 + k, stc[3 - k]);
      }
      if (b.r.trap) {
        const tc = b.cells[b.cells.length - 1], [sx, sy] = at(tc[0] + 0.5, tc[1] + 0.5, 0).map(Math.round), tier = Math.max(1, Math.min(3, b.r.trap_tier || 1));
        for (let i = -2; i <= 2; i++) { S.px(sx + i, sy + i, "#b8261e"); S.px(sx + i, sy - i, "#b8261e"); S.px(sx + i + 1, sy + i, "#5a0e0a"); }
        for (let t = 0; t < tier; t++) { const X = sx - (tier - 1) * 2 + t * 4; S.px(X, sy - 5, "#d8302a"); S.px(X + 1, sy - 5, "#d8302a"); S.px(X, sy - 6, "#ff6a4a"); S.px(X + 1, sy - 6, "#d8302a"); }
      }
    }
    for (const c of plan.corrs) {
      if (!c.secret || !c.cells.length || !m.open[m.I(c.cells[0][0], c.cells[0][1])]) continue;
      const [sx, sy] = at(c.cells[0][0] + 0.5, c.cells[0][1] + 0.5, 0).map(Math.round);
      P.FontP.text(S.px, "S", sx - 2, sy - 8, "#c0302a", { bold: true });
    }
    if (lair && st.slain && seen(lair)) {
      const [lx, ly] = at(lair.cx, lair.cy, 0), rx = (lair.w + lair.h) * A * 0.5 + 3, ry = rx / 2;
      for (let a = 0; a < 160; a++) { const t = (a / 160) * Math.PI * 2; for (const k of [0, 1]) S.px(Math.round(lx + Math.cos(t) * (rx - k)), Math.round(ly + 2 + Math.sin(t) * (ry - k * 0.5)), k ? "#7a1410" : "#d8302a"); }
    }
    for (const pin of st.crews || []) { const b = plan.byN[key(pin.n)]; if (b) crew(S, at, b, pin.crew); }
    // numbers last, so they always read: each tag stands on its room's floor, nudged apart where rooms crowd
    const tags = [];
    for (const b of plan.rooms) {
      const vis = seen(b);
      if (!vis && (b.secret || (b.r.lair && !rumour))) continue;
      const z = vis ? 0 : m.top[m.I(Math.floor(b.cx), Math.floor(b.cy))];
      const [sx, sy] = at(b.cx, b.cy, z);
      const label = b.secret ? "S" : String(b.r.n);
      let o;
      if (b.r.lair && !vis) { const nm = String((D.boss && D.boss.name) || "").replace(/^the\s+/i, "").split(/[ ,]/)[0]; o = { s: `${label} ${nm}?`, pencil: true }; }
      else o = vis ? { s: label, crew: st.inked.get(b.n).crew, red: b.r.lair } : { s: label, pencil: true };
      const sz = tagSize(o.s, o);
      tags.push(Object.assign(o, { fx: Math.round(sx), fy: Math.round(sy), x: Math.round(sx - sz.w / 2), y: Math.round(sy - sz.h + 2), w: sz.w, h: sz.h, seated: vis }));
    }
    spread(tags);
    for (const t of tags) if (t.seated) seat(S, t);
    for (const t of tags) tag(S, t.s, t.x, t.y, t);
  }
  function tagSize(s, o) {
    const bold = !o.pencil && s.length < 2;
    return { w: P.FontP.width(s, { bold }) + (o.crew ? 6 : 5), h: 10, bold };
  }
  // push overlapping tags apart, up and down first since rooms lie in rows, never far from their own floor
  function spread(tags) {
    const hit = (a, b) => a.x < b.x + b.w + 1 && b.x < a.x + a.w + 1 && a.y < b.y + b.h + 1 && b.y < a.y + a.h + 1;
    for (let it = 0; it < 12; it++) {
      let moved = false;
      for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) {
        const a = tags[i], b = tags[j];
        if (!hit(a, b)) continue;
        const [lo, hi] = a.y + a.h / 2 <= b.y + b.h / 2 ? [a, b] : [b, a];
        const dy = lo.y + lo.h + 1 - hi.y, dx = a.x <= b.x ? a.x + a.w + 1 - b.x : b.x + b.w + 1 - a.x;
        const room = (t, d) => Math.abs(t.y + d - (t.fy - t.h + 2)) <= 6;
        if (dy <= dx + 2 && room(lo, -Math.ceil(dy / 2)) && room(hi, dy - Math.ceil(dy / 2))) { lo.y -= Math.ceil(dy / 2); hi.y += dy - Math.ceil(dy / 2); }
        else { const [l, r] = a.x <= b.x ? [a, b] : [b, a], k = Math.ceil(dx / 2); l.x -= k; r.x += dx - k; }
        moved = true;
      }
      if (!moved) break;
    }
  }
  // where a tag stands: a soft shadow cast back onto the floor, and a short stake when the tag had to step off its spot
  function seat(S, t) {
    const bx = t.x + 1, by = t.y + t.h;
    for (let i = 0; i < t.w + 2; i++) { S.px(bx + i, by, "#0a0604", 0.42); if (i > 1 && i < t.w) S.px(bx + i + 1, by + 1, "#0a0604", 0.25); }
    if (Math.abs(by - t.fy) > 2 || t.fx < t.x || t.fx > t.x + t.w) {
      const x0 = Math.max(t.x + 2, Math.min(t.x + t.w - 3, t.fx));
      P.line((x, y) => S.px(x, y, "#2a1a10", 0.8), x0, by, t.fx, t.fy, "#2a1a10");
      S.px(t.fx, t.fy, "#0a0604", 0.6); S.px(t.fx + 1, t.fy, "#0a0604", 0.4);
    }
  }
  function tag(S, s, x, y, o) {
    const { w, h, bold } = o;
    const fill = o.pencil ? "#3e3832" : o.red ? "#f6dcc8" : "#f4ead2", edge = o.pencil ? "#a89c84" : "#2a1a10", ink = o.pencil ? "#d8ccb0" : o.red ? "#a8221a" : "#2a1a10";
    const top = o.pencil ? fill : o.red ? "#fff0e4" : "#fffaea", base = o.pencil ? fill : o.red ? "#d8b8a4" : "#d8c8a4";
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const border = j === 0 || j === h - 1 || i === 0 || i === w - 1;
      if (border && o.pencil && (i + j) % 2) continue;
      if ((i === 0 || i === w - 1) && (j === 0 || j === h - 1)) continue;
      S.px(x + i, y + j, border ? edge : j === 1 ? top : j === h - 2 ? base : fill);
    }
    if (o.crew) { const c = ramp(P.crewBanner(o.crew).c1); for (let j = 1; j < h - 1; j++) { S.px(x + 1, y + j, c[3]); S.px(x + 2, y + j, c[1]); } }
    P.FontP.text(S.px, s, x + (o.crew ? 4 : 3), y + 1, ink, { bold });
  }
  function figure(S, x, y, col, skin, hair, flag) {
    const r = ramp(col);
    S.px(x - 1, y - 1, "#2a1a10"); S.px(x + 1, y - 1, "#2a1a10"); S.px(x - 1, y - 2, "#3a2a20"); S.px(x + 1, y - 2, "#3a2a20");
    for (let j = 3; j <= 6; j++) { S.px(x - 1, y - j, r[j === 3 ? 1 : 2]); S.px(x, y - j, r[3]); S.px(x + 1, y - j, r[1]); }
    S.px(x, y - 7, skin); S.px(x - 1, y - 7, mix(skin, "#000000", 0.2)); S.px(x + 1, y - 7, mix(skin, "#000000", 0.35)); S.px(x, y - 8, hair); S.px(x - 1, y - 8, hair); S.px(x + 1, y - 8, hair);
    if (flag) {
      for (let j = 2; j <= 14; j++) S.px(x + 2, y - j, "#d8c8a8");
      const b = ramp(flag.c1), e = ramp(flag.c2 || "#e8dcc0");
      for (let j = 0; j < 5; j++) for (let i = 0; i < 5 - (j === 0 || j === 4 ? 1 : 0); i++) S.px(x + 3 + i, y - 14 + j, j === 2 && i === 1 ? e[3] : j === 0 ? b[3] : b[2]);
    }
  }
  function crew(S, at, b, id) {
    const App = window.App || {}, p = (App.parties || {})[id], ids = p ? p.members || p.heroes || [] : [id];
    const hs = ids.map((x) => (App.heroes || {})[x]).filter(Boolean).slice(0, 3);
    if (!hs.length) hs.push({ look: { fav: P.crewInk(id), skin: "#c98e62", hair: "#4a3020" } });
    const [bx, by] = at(b.cx - 0.2, b.cy - 0.4, 0).map(Math.round);
    const sub = new Art.Grid(30, 22);
    hs.forEach((h, k) => {
      const lk = h.look || {}, [dx, dy] = [[0, 0], [5, 2], [-4, 3]][k];
      const g = { set: (x, y, c) => sub.set(x, y, c) };
      figure({ px: g.set }, 13 + dx, 18 + dy, lk.fav || P.crewInk(id), lk.skin || "#c98e62", lk.hair || "#4a3020", k === 0 ? P.crewBanner(id) : null);
    });
    sub.outline("#140c10");
    S.grid(sub, bx - 13, by - 18);
  }

  // ---------- the whole stack ----------
  const cache = new Map();
  function floorRender(D, floor, depth, st, sig) {
    const k = D.id + ":" + floor.floor + ":" + sig;
    if (cache.has(k)) return cache.get(k);
    const m = model(D, floor, depth, st), R = render(m);
    marks(m, R);
    if (cache.size > 24) cache.clear();
    const out = { m, R };
    cache.set(k, out);
    return out;
  }
  function stack(D, sel, crews) {
    const STEPGAP = 14;
    const fl = D.floors.map((f, i) => {
      const st = P.known(D, f);
      st.crews = (crews || []).filter((c) => c.floor === f.floor);
      const sig = [...st.inked.keys()].join(".") + "|" + st.slain + st.rumour + "|" + st.crews.map((c) => c.crew + c.n).join(".");
      return floorRender(D, f, i, st, sig);
    });
    // each lower floor sits so its way in lies under the stair of the floor above
    const xs = [0];
    for (let i = 1; i < fl.length; i++) {
      const up = fl[i - 1].m, lo = fl[i].m, us = up.plan.rooms.find((b) => b.r.stair), le = lo.plan.rooms[0];
      let dx = 0;
      if (us && le) dx = Math.round(up.OX + (us.cx - us.cy) * A - (lo.OX + (le.cx - le.cy) * A));
      xs.push(xs[i - 1] + Math.max(-28, Math.min(28, dx)));
    }
    const minX = Math.min(...xs), PADL = 6, LABW = 0;
    const W = Math.max(...fl.map((f, i) => xs[i] - minX + f.m.GW)) + PADL * 2 + LABW;
    const TOP = 6, ys = [];
    let y = TOP;
    fl.forEach((f) => { ys.push(y); y += Math.round(f.m.GH * 0.82) + STEPGAP; });
    const H = ys[ys.length - 1] + fl[fl.length - 1].m.GH + 6;
    const S = P.surface(W, H);
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const n = h2(X, Y, 91), v = vnoise(X * 0.05, Y * 0.05, 92);
      let c = mix("#22170f", "#100a07", (Y / H) * 0.9);
      if (v < 0.3) c = mix(c, "#24180f", 0.3);
      if (n < 0.012) c = mix(c, "#4a3624", 0.6);
      S.px(X, Y, c);
    }
    const pos = fl.map((f, i) => [PADL + xs[i] - minX, ys[i]]);
    const blit = (i) => {
      const { R, m } = fl[i], [ox, oy] = pos[i], d = R.S.data;
      for (let j = 0; j < m.GH; j++) for (let k = 0; k < m.GW; k++) { const p = (j * m.GW + k) * 4; if (d[p + 3]) S.px(ox + k, oy + j, P.hex(d[p], d[p + 1], d[p + 2])); }
    };
    const shadow = (i) => { const { R, m } = fl[i], [ox, oy] = pos[i]; for (let j = 0; j < m.GH; j++) for (let k = 0; k < m.GW; k++) if (R.S.data[(j * m.GW + k) * 4 + 3]) S.px(ox + k + 4, oy + j + 5, "#000000", 0.22); };
    for (let i = fl.length - 1; i >= 0; i--) {
      shadow(i);
      blit(i);
      if (i > 0) ladder(S, fl[i - 1], pos[i - 1], fl[i], pos[i]);
    }
    for (let i = 0; i < fl.length - 1; i++) blit(i);
    const boxes = fl.map((f, i) => {
      const { m } = f, [ox, oy] = pos[i], at = (x, yy) => [ox + m.OX + (x - yy) * A, oy + m.OY + (x + yy) * BH];
      const fv = D.floors[i], walked = fv.rooms.filter((r) => r.state).length;
      const top = at(0, 0), right = at(m.W, 0), bottom = at(m.W, m.H), left = at(0, m.H);
      return { f: fv.floor, y0: oy, y1: oy + m.GH, x0: ox, x1: ox + m.GW, top, right, bottom, left, walked, total: fv.rooms.length, i };
    });
    // labels in the empty corner above each plate's right side
    boxes.forEach((b) => {
      const on = b.f === sel, t1 = `Floor ${b.f}`, t2 = `${b.walked} of ${b.total} walked`;
      const w1 = P.FontP.width(t1, { bold: true }), w2 = P.FontP.width(t2), lx = Math.max(10, b.x0 + 4), ly = Math.max(b.y0 + 2, b.top[1] + 4);
      if (on) { P.FontP.text(S.px, ">", lx - 8, ly, "#ecc56a", { bold: true }); }
      P.FontP.text(S.px, t1, lx, ly, on ? "#ecc56a" : b.walked ? "#f1e3c2" : "#9a9080", { bold: true });
      P.FontP.text(S.px, t2, lx, ly + 10, b.walked === b.total ? "#ecc56a" : b.walked ? "#c8b48c" : "#7a7060");
      if (on) for (const [a, c] of [[b.top, b.right], [b.right, b.bottom], [b.bottom, b.left], [b.left, b.top]]) P.line((x, yy) => S.px(x, yy - 1, "#ecc56a", 0.85), a[0], a[1], c[0], c[1], "#ecc56a");
    });
    boss(S, D, fl, pos, boxes);
    return { canvas: S.canvas(), W, H, boxes };
  }
  function ladder(S, up, pu, lo, pl) {
    const us = up.m.plan.rooms.find((b) => b.r.stair), le = lo.m.plan.rooms[0];
    if (!us || !le) return;
    const atU = (x, y) => [pu[0] + up.m.OX + (x - y) * A, pu[1] + up.m.OY + (x + y) * BH], atL = (x, y) => [pl[0] + lo.m.OX + (x - y) * A, pl[1] + lo.m.OY + (x + y) * BH];
    const [ux, uy] = atU(us.cx, us.cy), [, ly] = atL(le.cx, le.cy);
    const X = Math.round(ux), walked = up.m.st.inked.has(us.n), wood = ramp("#7a5034");
    for (let Y = Math.round(uy); Y <= Math.round(ly) - 4; Y++) {
      if (walked) {
        S.px(X - 3, Y, wood[2]); S.px(X + 3, Y, wood[1]); S.px(X - 4, Y, "#140c08"); S.px(X + 4, Y, "#140c08");
        if (Y % 4 === 0) for (let i = -2; i <= 2; i++) S.px(X + i, Y, wood[3]);
      } else if (Y % 4 === 0) S.px(X, Y, "#8a7c64");
    }
  }
  function boss(S, D, fl, pos, boxes) {
    const i = fl.findIndex((f) => f.m.plan.rooms.some((b) => b.r.lair));
    if (i < 0 || !D.boss) return;
    const App = window.App || {}, sd = (App.S && App.S.dungeons && App.S.dungeons[D.id]) || {}, mon = App.S && App.S.monsters ? App.S.monsters[sd.boss] : null;
    const b = boxes[i], st = fl[i].m.st;
    const cx = Math.round(Math.max(26, b.left[0] + 26)), y = Math.round(b.left[1] + 10);
    if (st.slain) {
      if (mon) { const t = Art.trophyGrid(Object.assign({}, mon, { name: D.boss.name, boss: true })); S.grid(t, cx - (t.w >> 1), y - 2); }
      const k = (D.boss.kills || []).slice(-1)[0], s = "slain" + (k ? " d" + (k.sday || k.day) : ""), w = P.FontP.width(s) + 6;
      for (let j = 0; j < 11; j++) for (let q = 0; q < w; q++) S.px(cx - (w >> 1) + q, y + 46 + j, j === 0 || j === 10 || q === 0 || q === w - 1 ? "#7a1410" : "#f6dcc8");
      P.FontP.text(S.px, s, cx - (w >> 1) + 3, y + 48, "#a8221a");
    } else if (st.rumour && mon) {
      const mg = Art.monsterGrid(Object.assign({}, mon, { boss: true }));
      const on = (q, j) => q >= 0 && j >= 0 && q < mg.w && j < mg.h && mg.get(q, j);
      for (let j = 0; j < mg.h; j++) for (let q = 0; q < mg.w; q++) if (on(q, j) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => !on(q + a, j + c)) && (q * 3 + j) % 5) S.px(cx - (mg.w >> 1) + q, y + j, "#d6cab0");
      P.FontP.text(S.px, "?", cx - 2, y + (mg.h >> 1) - 3, "#ecc56a", { bold: true });
      const s = "rumoured", w = P.FontP.width(s) + 6;
      for (let j = 0; j < 11; j++) for (let q = 0; q < w; q++) if (!((j === 0 || j === 10 || q === 0 || q === w - 1) && (q + j) % 2)) S.px(cx - (w >> 1) + q, y + mg.h + 3 + j, j === 0 || j === 10 || q === 0 || q === w - 1 ? "#a89c84" : "#3e3832");
      P.FontP.text(S.px, s, cx - (w >> 1) + 3, y + mg.h + 5, "#d6cab0");
    }
  }

  window.DungeonIso = { stack };
})();
