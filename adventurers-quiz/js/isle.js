/* The world map: a bright terraced island in oblique view (cliff faces, beaches, a river with falls, red-roofed towns),
   rendered once per page from the static map data. Map data uses 320x200 units; the terrain is drawn at U px per unit. */
(function () {
  "use strict";
  const { rng, hash, mix } = Art;
  const U = 2, MW = 320, MH = 200, TW = MW * U, TH = MH * U, CH = 5;

  function noise2(seed) {
    const r = rng(seed), N = 64, tab = [];
    for (let i = 0; i < N * N; i++) tab.push(r());
    const at = (x, y) => tab[((y % N + N) % N) * N + ((x % N + N) % N)];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = (t) => t * t * (3 - 2 * t);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
    };
  }
  const fbm = (n, x, y) => n(x, y) * 0.6 + n(x * 2.1, y * 2.1) * 0.3 + n(x * 4.3, y * 4.3) * 0.1;
  const rgb = (h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };

  const SURF = {
    sand: ["#e0bc74", "#ecd08e", "#f6e2b0"], plains: ["#5aa83a", "#72c044", "#92d650"], forest: ["#3c8c38", "#4a9e3e", "#5eb444"],
    marsh: ["#68884a", "#7a9a52", "#8eaa5e"], hills: ["#98a04a", "#acb256", "#c2c26a"], snow: ["#c4d2ee", "#dce6f6", "#f4f8ff"],
    volcanic: ["#584044", "#6a4c4e", "#7e5e58"], coast: ["#66b23e", "#7ec448", "#9ad658"],
  };
  const CLIFF = {
    def: ["#bcc2e6", "#9ea6d6", "#7e86bc", "#5e6298"], snow: ["#e2eaf8", "#c0cbea", "#9ca8d2", "#7884b2"],
    volcanic: ["#7a5a5a", "#5e4446", "#4a3436", "#36262a"], sand: ["#d8b070", "#c09858", "#a08048", "#806438"],
  };
  const FALLS = ["#f2fbff", "#c4e6fa", "#8ccaf0"];
  const SEACLIFF = ["#d4d8f0", "#aab2dc", "#8890c4", "#5e6298"];
  const BASE = { plains: 2, forest: 2, marsh: 2, hills: 3, snow: 4, volcanic: 4, coast: 3 };
  const RIVER = [[204, 26], [194, 50], [182, 72], [170, 98], [158, 120], [144, 144], [138, 166], [132, 204]];

  let T = null;
  function nodes() {
    const S = App.S, out = [];
    for (const [id, t] of Object.entries(S.towns)) out.push({ id, kind: "town", xy: t.xy, biome: t.biome, size: t.size, name: t.name });
    for (const [id, t] of Object.entries(S.wilds)) out.push({ id, kind: "wild", xy: t.xy, biome: t.biome, name: t.name });
    for (const [id, t] of Object.entries(S.dungeons)) out.push({ id, kind: "dungeon", xy: t.xy, biome: t.biome, theme: t.theme, name: t.name });
    return out;
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }

  function build() {
    const S = App.S, N = nodes(), n = noise2(99), n2 = noise2(7), n3 = noise2(1234);
    const nodeById = Object.fromEntries(N.map((d) => [d.id, d]));
    const lev = new Uint8Array(TW * TH), bio = new Array(TW * TH), landv = new Float32Array(TW * TH);
    const river = new Uint8Array(TW * TH), road = new Uint8Array(TW * TH);
    const roads = S.roads.map(([a, b]) => [nodeById[a].xy, nodeById[b].xy]);
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const mx = (x + 0.5) / U, my = (y + 0.5) / U, i = y * TW + x;
      let l = -1;
      for (const d of N) {
        const r = d.theme === "sea" ? 12 : d.kind === "town" ? 44 : 38;
        l = Math.max(l, 1 - Math.hypot(d.xy[0] - mx, d.xy[1] - my) / r);
      }
      for (const [A, B] of roads) l = Math.max(l, 0.55 - segDist(mx, my, A[0], A[1], B[0], B[1]) / 26);
      l += (fbm(n, mx / 20, my / 20) - 0.5) * 0.6;
      const edge = Math.min(mx, MW - mx, my, MH - my);
      l -= Math.max(0, (16 - edge) / 16) * 0.7;
      landv[i] = l;
      const rd = Math.min(...RIVER.slice(1).map((p, k) => segDist(mx + (n2(mx / 8, my / 8) - 0.5) * 3, my, RIVER[k][0], RIVER[k][1], p[0], p[1])));
      if (l <= 0.16) continue;
      const wx = mx + (fbm(n, mx / 16, my / 16) - 0.5) * 26, wy = my + (fbm(n, mx / 16 + 40, my / 16) - 0.5) * 26;
      let best = N[0], bd = 1e9;
      for (const d of N) { const dd = (d.xy[0] - wx) ** 2 + (d.xy[1] - wy) ** 2; if (dd < bd) { bd = dd; best = d; } }
      const b = best.biome;
      bio[i] = b;
      if (l < 0.25) { lev[i] = 1; bio[i] = "sand"; }
      else {
        const t = fbm(n3, mx / 26, my / 26);
        lev[i] = Math.max(2, BASE[b] + (t > 0.6 ? 1 : 0) - (t < 0.34 && b !== "snow" && b !== "volcanic" ? 1 : 0));
      }
      if (rd < 1.6) river[i] = 1;
    }
    for (const [A, B] of roads) {
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]), steps = Math.ceil(len * U * 1.5), wob = (n2(A[0] / 9, B[1] / 9) - 0.5) * 14;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps, bend = Math.sin(t * Math.PI) * wob;
        const mx = A[0] + (B[0] - A[0]) * t - ((B[1] - A[1]) / len) * bend, my = A[1] + (B[1] - A[1]) * t + ((B[0] - A[0]) / len) * bend;
        const x = Math.round(mx * U), y = Math.round(my * U);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < TW && yy < TH && lev[yy * TW + xx] && !river[yy * TW + xx]) road[yy * TW + xx] = 1;
        }
      }
    }
    return { lev, bio, landv, river, road, N, n, n2 };
  }

  function levelAt(mx, my) {
    const x = Math.max(0, Math.min(TW - 1, Math.round(mx * U))), y = Math.max(0, Math.min(TH - 1, Math.round(my * U)));
    return T.lev[y * TW + x];
  }
  function project(mx, my) { return [mx * U, my * U - levelAt(mx, my) * CH]; }

  function render() {
    T = build();
    const { lev, bio, landv, river, road, N, n, n2 } = T;
    const cv = document.createElement("canvas");
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext("2d");
    const img = ctx.createImageData(TW, TH), D = img.data;
    const put = (x, y, c) => { if (x < 0 || y < 0 || x >= TW || y >= TH) return; const i = (y * TW + x) * 4, v = typeof c === "string" ? rgb(c) : c; D[i] = v[0]; D[i + 1] = v[1]; D[i + 2] = v[2]; D[i + 3] = 255; };
    const bayer = (x, y) => [0, 0.5, 0.75, 0.25][(x & 1) + (y & 1) * 2] - 0.375;
    // pixels that move: wave crests, shore foam, river glints and falls; each kept with its colour index so the live map can shift them
    const fx = { crest: [], foam: [], river: [], falls: [] };
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const l = landv[y * TW + x], v = fbm(n2, x / 14, y / 5);
      let c = l > 0.12 + bayer(x, y) * 0.04 ? "#7cc8f0" : l > 0.02 + bayer(x, y) * 0.06 ? "#5aaee6" : l > -0.25 ? "#3f94d8" : l > -0.5 + bayer(x, y) * 0.08 ? "#3484cc" : "#2c74bc";
      if (l <= 0.12 && v > 0.7) fx.crest.push([x, y, (x + (y >> 1)) % 6, c]);
      if (l <= 0.12 && v > 0.7 && (x + (y >> 1)) % 6 < 3) c = "#a4dcf8";
      put(x, y, c);
    }
    for (let x = 0; x < TW; x++) for (let y = 0; y < TH; y++) {
      const i = y * TW + x, L = lev[i];
      if (!L) continue;
      const b = bio[i], ty = y - L * CH, cl = b === "sand" ? CLIFF.sand : b === "snow" ? CLIFF.snow : b === "volcanic" ? CLIFF.volcanic : CLIFF.def;
      for (let sy = ty + 1; sy <= y; sy++) {
        const t = (sy - ty) / (L * CH);
        let c;
        if (river[i]) { c = FALLS[(sy + x * 2 + (x >> 1)) % 3]; fx.falls.push([x, sy, (sy + x * 2 + (x >> 1)) % 3]); }
        else if (road[i]) c = (sy - ty) % 2 ? "#c4a462" : "#8e7046";
        else {
          let k = t < 0.12 ? 0 : t < 0.5 ? 1 : t < 0.86 ? 2 : 3;
          if ((x * 7 + Math.floor(sy / 4)) % 13 === 0 || (sy - ty) % CH === 0 && t > 0.2) k = Math.min(3, k + 1);
          c = cl[k];
        }
        put(x, sy, c);
      }
      const pal = SURF[b] || SURF.plains, v = fbm(n, x / 9, y / 7) + bayer(x, y) * 0.12;
      let c = pal[v > 0.6 ? 2 : v < 0.42 ? 0 : 1];
      const front = y + 1 < TH && lev[i + TW] < L, back = y > 0 && lev[i - TW] < L, left = x > 0 && lev[i - 1] < L, right = x + 1 < TW && lev[i + 1] < L;
      if (back || left) c = pal[2];
      if (right) c = pal[0];
      if (river[i]) { c = (x + y) % 6 === 0 ? "#bfe6fa" : bayer(x, y) > 0 ? "#5ab4ec" : "#4aa4e2"; fx.river.push([x, ty, (x + y) % 6, bayer(x, y) > 0 ? "#5ab4ec" : "#4aa4e2"]); }
      else if (road[i]) c = (road[i - 1] && road[i + 1] && road[i - TW] && road[i + TW]) ? "#ecd49a" : "#d2b072";
      else if (b === "marsh" && fbm(n2, x / 6, y / 6) > 0.66) c = (x + y) % 3 ? "#6aa0a0" : "#88b8b4";
      else if (b === "volcanic" && fbm(n2, x / 4, y / 4) > 0.72) c = (x + y) % 2 ? "#ff7a2a" : "#ffb04a";
      if (front && !river[i]) c = mix(pal[0], "#1e3a1a", 0.35);
      put(x, ty, c);
      if (y + 1 < TH && !lev[i + TW]) {
        const S = 3 + Math.floor(fbm(n2, x / 10, 7) * 9) + (river[i] ? 0 : 0);
        for (let k = 1; k <= S; k++) {
          const t = k / S;
          put(x, y + k, river[i] ? FALLS[(y + k + x * 2) % 3] : SEACLIFF[t < 0.2 ? 0 : t < 0.55 ? 1 : t < 0.85 ? 2 : 3 - ((x * 5 + k) % 9 === 0 ? 1 : 0)]);
          if (river[i]) fx.falls.push([x, y + k, (y + k + x * 2) % 3]);
        }
        put(x, y + S + 1, (x + y) % 3 ? "#f2fbff" : "#c4e6fa");
        fx.foam.push([x, y + S + 1, (x + y) % 3]);
        put(x, y + S + 2, "#2f80c4");
      }
    }
    ctx.putImageData(img, 0, 0);

    const sprites = [];
    const near = (mx, my, r) => N.some((d) => (d.kind !== "wild") && Math.hypot(d.xy[0] - mx, d.xy[1] - my) < r);
    for (let cy = 2; cy < TH; cy += 5) for (let cx = 1; cx < TW; cx += 5) {
      const h = hash(cx + ":" + cy), jx = cx + (h & 3), jy = cy + ((h >> 2) & 3), i = jy * TW + jx;
      if (jy >= TH || !lev[i] || river[i] || road[i] || bio[i] === "sand") continue;
      if (road[i - 2] || road[i + 2] || road[i - 2 * TW] || road[i + 2 * TW] || river[i + 2] || river[i - 2]) continue;
      const b = bio[i], p = ((h >> 8) & 1023) / 1024, mx = jx / U, my = jy / U;
      if (near(mx, my, 11)) continue;
      const dens = { forest: 0.8, plains: 0.07, hills: 0.1, marsh: 0.16, snow: 0.3, coast: 0.05, volcanic: 0.06 }[b] || 0;
      if (p > dens) continue;
      const [sx, sy] = [jx, jy - lev[i] * CH];
      if (lev[i + 2 * TW] < lev[i]) continue;
      sprites.push({ y: sy, draw: () => b === "snow" ? pine(ctx, sx, sy, true) : b === "hills" || b === "volcanic" ? rock(ctx, sx, sy, b) : b === "marsh" ? reeds(ctx, sx, sy, h) : tree(ctx, sx, sy, b === "forest" ? h : h + 1) });
    }
    for (const d of N) {
      const [sx, sy] = [d.xy[0] * U, d.xy[1] * U - levelAt(d.xy[0], d.xy[1]) * CH];
      if (d.kind === "town") townSprites(ctx, sprites, sx, sy, d);
      else if (d.kind === "dungeon") sprites.push({ y: sy + 2, draw: () => dungeon(ctx, sx, sy, d.theme) });
    }
    const [bx, by] = project(141, 151);
    sprites.push({ y: by + 1, draw: () => bridge(ctx, bx, by) });
    sprites.sort((a, b) => a.y - b.y);
    for (const s of sprites) s.draw();
    // a moving pixel only moves where no house, tree or bridge was drawn over it
    const after = ctx.getImageData(0, 0, TW, TH).data;
    const bare = ([x, y]) => { const i = (y * TW + x) * 4; return D[i] === after[i] && D[i + 1] === after[i + 1] && D[i + 2] === after[i + 2]; };
    for (const k of Object.keys(fx)) fx[k] = fx[k].filter((p) => p[1] >= 0 && p[1] < TH && bare(p));
    T.fx = fx;
    T.clouds = clouds(landv);
    return cv;
  }

  // the moving water, as six frames drawn once each: crests drift, foam pulses, the river glints downstream, the falls fall
  const PH = 6, phaseCache = [];
  function phase(p) {
    if (phaseCache[p]) return phaseCache[p];
    const cv = document.createElement("canvas");
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext("2d"), fx = T.fx;
    for (const [x, y, m, base] of fx.crest) { ctx.fillStyle = (m + PH - p) % PH < 3 ? "#a4dcf8" : base; ctx.fillRect(x, y, 1, 1); }
    for (const [x, y, m] of fx.foam) { ctx.fillStyle = (m + p) % 3 ? "#f2fbff" : "#c4e6fa"; ctx.fillRect(x, y, 1, 1); }
    for (const [x, y, m, base] of fx.river) { ctx.fillStyle = (m + PH - p) % PH === 0 ? "#bfe6fa" : base; ctx.fillRect(x, y, 1, 1); }
    for (const [x, y, m] of fx.falls) { ctx.fillStyle = FALLS[(m + 3 - (p % 3)) % 3]; ctx.fillRect(x, y, 1, 1); }
    return (phaseCache[p] = cv);
  }

  const F = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const Ln = (ctx, x0, y0, x1, y1, c) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let i = 0; i <= n; i++) F(ctx, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, 1, 1, c); };

  function cloud(w, seed) {
    // one cloud and its shadow on their own canvas, so the live map can slide it across
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(w * 1.6) + 12; cv.height = Math.ceil(w * 0.6) + 18;
    const ctx = cv.getContext("2d"), x = Math.ceil(w * 0.8), y = Math.ceil(w * 0.42);
    const r = rng(seed), puffs = [];
    for (let k = 0; k < 5; k++) { const t = k / 4; puffs.push([x + (t - 0.5) * w, y - Math.sin(t * Math.PI) * w * 0.12, w * (0.16 + Math.sin(t * Math.PI) * 0.12) * (0.8 + r() * 0.4)]); }
    const inside = (px, py) => puffs.some(([cx, cy, rr]) => (px - cx) ** 2 + ((py - cy) * 1.5) ** 2 <= rr * rr) && py <= y + w * 0.08;
    ctx.fillStyle = "rgba(20,60,120,0.22)";
    for (let py = Math.floor(y - w * 0.4); py <= y + w * 0.1; py++) for (let px = Math.floor(x - w * 0.75); px <= x + w * 0.75; px++) if (inside(px, py)) ctx.fillRect(px + 8, py + 14, 1, 1);
    for (let py = Math.floor(y - w * 0.4); py <= y + w * 0.1; py++) for (let px = Math.floor(x - w * 0.75); px <= x + w * 0.75; px++) {
      if (!inside(px, py)) continue;
      const low = !inside(px, py + 2), top = !inside(px - 1, py - 1);
      ctx.fillStyle = top ? "#ffffff" : low ? ((px + py) % 2 ? "#c4d8ee" : "#d8e6f4") : "#f2f6fc";
      ctx.fillRect(px, py, 1, 1);
    }
    return { cv, ox: x, oy: y };
  }
  function clouds(landv) {
    const r = rng(4242), spots = [[30, 26, 70], [TW - 60, 34, 60], [TW / 2 - 40, 10, 54], [24, TH - 40, 64], [TW - 40, TH - 30, 70]];
    for (let k = 0; k < 40 && spots.length < 9; k++) {
      const x = 30 + r() * (TW - 60), y = 20 + r() * (TH - 40);
      if (landv[Math.floor(y) * TW + Math.floor(x)] > -0.3 || spots.some(([a, b]) => Math.hypot(a - x, b - y) < 120)) continue;
      spots.push([x, y, 40 + r() * 30]);
    }
    return spots.map(([x, y, w], k) => Object.assign(cloud(w, 77 + k), { x, y, w, speed: 1.6 + (k % 3) * 0.7 }));
  }
  // a cloud drifts east and comes round again from the west edge, so the sky never empties
  function cloudAt(c, t) {
    const span = TW + c.cv.width * 2;
    return ((c.x + c.speed * t + c.cv.width) % span + span) % span - c.cv.width;
  }

  function castle(ctx, x, y) {
    F(ctx, x - 5, y - 28, 10, 17, "#3a2a2a"); F(ctx, x - 4, y - 27, 8, 16, "#d0ccdc"); F(ctx, x + 1, y - 27, 3, 16, "#a09cb4");
    for (let k = -4; k < 4; k += 2) F(ctx, x + k, y - 30, 1, 2, "#d0ccdc");
    F(ctx, x - 1, y - 23, 2, 3, "#2a2030"); F(ctx, x, y - 38, 1, 9, "#5a4a3a"); F(ctx, x + 1, y - 38, 5, 3, "#c8463a"); F(ctx, x + 1, y - 38, 5, 1, "#ec7a5c");
    F(ctx, x - 14, y - 13, 28, 14, "#3a2a2a"); F(ctx, x - 13, y - 12, 26, 12, "#b8b4c4"); F(ctx, x + 4, y - 12, 9, 12, "#8c88a0");
    for (let k = -13; k < 13; k += 3) F(ctx, x + k, y - 15, 2, 3, k > 3 ? "#8c88a0" : "#b8b4c4");
    F(ctx, x - 2, y - 7, 4, 7, "#2a1a12"); F(ctx, x - 1, y - 8, 2, 1, "#2a1a12");
    for (const tx of [x - 17, x + 12]) {
      F(ctx, tx - 1, y - 21, 7, 22, "#3a2a2a"); F(ctx, tx, y - 20, 5, 20, "#c4c0d0"); F(ctx, tx + 3, y - 20, 2, 20, "#9894ac");
      F(ctx, tx - 1, y - 23, 7, 3, "#7a2a22"); F(ctx, tx, y - 25, 5, 2, "#c8463a"); F(ctx, tx + 1, y - 27, 3, 2, "#c8463a"); F(ctx, tx + 2, y - 28, 1, 1, "#ec7a5c"); F(ctx, tx, y - 25, 2, 1, "#ec7a5c");
      F(ctx, tx + 2, y - 15, 1, 2, "#2a2030");
    }
  }
  function headframe(ctx, x, y) {
    F(ctx, x - 12, y - 4, 22, 5, "#4a4450"); F(ctx, x - 10, y - 6, 14, 2, "#6a6458"); F(ctx, x - 8, y - 7, 8, 1, "#8a8478");
    for (const [a, b] of [[-6, -1], [6, 1]]) { Ln(ctx, x + a, y - 4, x + b, y - 22, "#3a2414"); Ln(ctx, x + a + 1, y - 4, x + b + 1, y - 22, "#7a5232"); }
    Ln(ctx, x - 4, y - 12, x + 5, y - 12, "#7a5232"); Ln(ctx, x - 5, y - 8, x + 5, y - 16, "#5a3a22");
    for (let a = 0; a < 16; a++) F(ctx, x + Math.round(Math.cos(a / 16 * 6.283) * 3.5), y - 23 + Math.round(Math.sin(a / 16 * 6.283) * 3.5), 1, 1, "#2a1a10");
    F(ctx, x, y - 23, 1, 1, "#c8963e"); Ln(ctx, x + 3, y - 23, x + 3, y - 6, "#c8c0b0");
    F(ctx, x + 6, y - 9, 9, 7, "#3a2626"); F(ctx, x + 7, y - 8, 7, 6, "#8a6a42"); F(ctx, x + 5, y - 11, 11, 2, "#6a4a3a"); F(ctx, x + 9, y - 6, 2, 4, "#2a1a12");
    F(ctx, x - 14, y - 7, 5, 3, "#4a4450"); F(ctx, x - 13, y - 8, 3, 1, "#e0c45a"); F(ctx, x - 14, y - 4, 1, 1, "#1a1416"); F(ctx, x - 10, y - 4, 1, 1, "#1a1416");
  }
  function lighthouse(ctx, x, y) {
    F(ctx, x - 7, y - 2, 14, 4, "#5e6298"); F(ctx, x - 6, y - 3, 12, 2, "#8890c4");
    for (let j = 0; j < 24; j++) {
      const w = Math.round(7 - j / 6), x0 = x - Math.floor(w / 2);
      F(ctx, x0 - 1, y - 3 - j, w + 2, 1, "#3a2626");
      F(ctx, x0, y - 3 - j, w, 1, (j >> 2) % 2 ? "#c8463a" : "#f2ead8");
      F(ctx, x0 + w - 1, y - 3 - j, 1, 1, (j >> 2) % 2 ? "#8a2a22" : "#c8bca4");
    }
    F(ctx, x - 3, y - 32, 7, 6, "#3a2626"); F(ctx, x - 2, y - 31, 5, 4, "#ffe88a"); F(ctx, x - 1, y - 30, 2, 2, "#ffffff");
    F(ctx, x - 4, y - 34, 9, 2, "#3a2626"); F(ctx, x - 2, y - 36, 5, 2, "#c8463a"); F(ctx, x, y - 37, 1, 1, "#3a2626");
    ctx.globalAlpha = 0.28; ctx.fillStyle = "#fff2a0";
    for (let k = 1; k < 18; k++) { ctx.fillRect(x + 3 + k, y - 30 - Math.floor(k / 4), 1, 2 + Math.floor(k / 3)); ctx.fillRect(x - 3 - k, y - 30 - Math.floor(k / 4), 1, 2 + Math.floor(k / 3)); }
    ctx.globalAlpha = 1;
  }
  function watchtower(ctx, x, y) {
    for (const lx of [x - 5, x + 4]) F(ctx, lx, y - 14, 1, 15, "#5a3a22");
    Ln(ctx, x - 5, y - 1, x + 4, y - 13, "#7a5232"); Ln(ctx, x + 4, y - 1, x - 5, y - 13, "#7a5232");
    F(ctx, x - 7, y - 16, 15, 3, "#3a2414"); F(ctx, x - 6, y - 16, 13, 1, "#9a6a3a");
    F(ctx, x - 5, y - 23, 11, 7, "#3a2414"); F(ctx, x - 4, y - 22, 9, 6, "#8a6a42"); F(ctx, x + 2, y - 22, 3, 6, "#6a4a30"); F(ctx, x - 1, y - 20, 2, 2, "#ffd46a");
    F(ctx, x - 7, y - 25, 15, 3, "#9ca8d2"); F(ctx, x - 6, y - 26, 13, 2, "#f4f8ff"); F(ctx, x - 4, y - 28, 9, 2, "#f4f8ff"); F(ctx, x - 2, y - 29, 5, 1, "#ffffff");
    F(ctx, x, y - 33, 1, 4, "#5a4a3a"); F(ctx, x + 1, y - 33, 4, 2, "#3e5ab0");
  }
  function tollhouse(ctx, x, y) {
    F(ctx, x - 9, y - 13, 18, 14, "#3a2a2a"); F(ctx, x - 8, y - 12, 16, 12, "#c4b8a4"); F(ctx, x + 3, y - 12, 5, 12, "#a0947e");
    F(ctx, x - 3, y - 7, 6, 7, "#2a1a12"); F(ctx, x - 2, y - 8, 4, 1, "#2a1a12");
    F(ctx, x - 10, y - 16, 20, 3, "#2c3e7a"); F(ctx, x - 8, y - 18, 16, 2, "#3e5ab0"); F(ctx, x - 6, y - 19, 12, 1, "#6a88d8");
    F(ctx, x - 6, y - 11, 2, 2, "#4a6a9a"); F(ctx, x + 4, y - 11, 2, 2, "#4a6a9a");
    F(ctx, x + 10, y - 5, 1, 6, "#5a3a22");
    for (let k = 0; k < 12; k++) F(ctx, x + 10 + k, y - 5, 1, 1, (k >> 1) % 2 ? "#c8463a" : "#f2ead8");
    F(ctx, x - 3, y - 15, 6, 1, "#e0c45a");
  }
  function treehouse(ctx, x, y) {
    F(ctx, x - 3, y - 18, 6, 19, "#3a2414"); F(ctx, x - 2, y - 18, 4, 18, "#7a5232"); F(ctx, x + 1, y - 18, 1, 18, "#5a3a22");
    F(ctx, x - 5, y - 1, 3, 1, "#5a3a22"); F(ctx, x + 2, y - 1, 3, 1, "#5a3a22");
    const blob = (cx, cy, rx, ry, c) => { for (let yy = -ry; yy <= ry; yy++) { const w = Math.round(rx * Math.sqrt(1 - (yy / ry) ** 2)); F(ctx, cx - w, cy + yy, w * 2 + 1, 1, c); } };
    blob(x, y - 28, 15, 10, "#1e4a24"); blob(x - 1, y - 29, 14, 9, "#3a8a34"); blob(x - 4, y - 32, 8, 5, "#5cb046"); blob(x - 6, y - 34, 3, 2, "#94d862");
    F(ctx, x - 9, y - 20, 18, 2, "#5a3a22"); F(ctx, x - 8, y - 20, 16, 1, "#9a6a3a");
    house(ctx, x - 4, y - 20, "red", false);
    Ln(ctx, x + 6, y - 19, x + 8, y - 1, "#c8a46a");
    for (const [dx, dy] of [[-12, -24], [11, -26], [-2, -38]]) F(ctx, x + dx, y + dy, 3, 2, "#3a8a34");
  }
  function palisade(ctx, sprites, sx, sy, spread) {
    for (let a = 0.15; a < Math.PI - 0.1; a += 0.16) {
      const px = Math.round(sx + Math.cos(a) * (spread + 7)), py = Math.round(sy + 2 + Math.sin(a) * (spread + 7) * 0.6);
      if (Math.abs(a - Math.PI / 2) < 0.2) continue;
      sprites.push({ y: py, draw: () => { F(ctx, px - 1, py - 7, 3, 8, "#3a2414"); F(ctx, px, py - 7, 1, 7, "#9a6a3a"); F(ctx, px, py - 8, 1, 1, "#c8a46a"); } });
    }
    const gx = Math.round(sx), gy = Math.round(sy + 2 + (spread + 7) * 0.6);
    sprites.push({ y: gy + 1, draw: () => { for (const dx of [-5, 4]) { F(ctx, gx + dx - 1, gy - 11, 3, 12, "#3a2414"); F(ctx, gx + dx, gy - 11, 1, 11, "#9a6a3a"); } F(ctx, gx - 5, gy - 12, 10, 2, "#5a3a22"); } });
  }
  const LANDMARK = { ironhaven: castle, veldrock: headframe, saltmarrow: lighthouse, frosthold: watchtower, carrbridge: tollhouse, hollowood: treehouse };
  function tree(ctx, x, y, h) {
    const big = (h >> 5) & 1;
    F(ctx, x - 1, y - 1, 2, 2, "#5a3a22");
    F(ctx, x - 3, y - 7 - big, 7, 6 + big, "#1e4a24");
    F(ctx, x - 4, y - 6 - big, 9, 4 + big, "#1e4a24");
    F(ctx, x - 3, y - 6 - big, 7, 4 + big, "#3a8a34");
    F(ctx, x - 2, y - 7 - big, 5, 1, "#3a8a34");
    F(ctx, x - 2, y - 6 - big, 3, 2, "#5cb046");
    F(ctx, x - 1, y - 6 - big, 1, 1, "#94d862");
    F(ctx, x + 1, y - 3, 2, 1, "#2a6a2e");
  }
  function pine(ctx, x, y, snow) {
    F(ctx, x, y - 1, 1, 2, "#5a3a22");
    for (let k = 0; k < 4; k++) F(ctx, x - k + (k > 2 ? 1 : 0), y - 8 + k * 2, k * 2 + 1 - (k > 2 ? 2 : 0), 2, k % 2 ? "#2a6a44" : "#1e5236");
    if (snow) { F(ctx, x, y - 8, 1, 1, "#ffffff"); F(ctx, x - 2, y - 4, 2, 1, "#f0f6ff"); F(ctx, x + 1, y - 6, 1, 1, "#f0f6ff"); }
  }
  function rock(ctx, x, y, b) {
    const c = b === "volcanic" ? ["#3a2a2a", "#5a4444", "#7a5e58"] : ["#6a6458", "#9a9486", "#c4bcaa"];
    F(ctx, x - 2, y - 2, 5, 3, c[0]); F(ctx, x - 1, y - 3, 3, 3, c[1]); F(ctx, x - 1, y - 3, 1, 1, c[2]);
  }
  function reeds(ctx, x, y, h) { for (const dx of [-1, 1, 2]) F(ctx, x + dx, y - 3 - ((h >> dx + 3) & 1), 1, 3, dx === 1 ? "#a8b45a" : "#6a7a3a"); }
  function house(ctx, x, y, roof, wide, stilts) {
    const w = wide ? 9 : 7;
    if (stilts) {
      F(ctx, x - 1, y + 1, w + 2, 2, "#6aa0a0"); F(ctx, x, y + 2, w, 1, "#88b8b4");
      for (const px of [x, x + w - 1, x + (w >> 1)]) F(ctx, px, y - 3, 1, 5, "#5a3a22");
      y -= 4;
    }
    const R = roof === "blue" ? ["#2c3e7a", "#3e5ab0", "#6a88d8"] : ["#7a2a22", "#c8463a", "#ec7a5c"];
    F(ctx, x - 1, y - 9, w + 2, 10, "#3a2626");
    F(ctx, x, y - 4, w, 4, "#f2ead8"); F(ctx, x + w - 2, y - 4, 2, 4, "#c8bca4");
    F(ctx, x + 2, y - 2, 1, 2, "#5a3a2a"); F(ctx, x + w - 4, y - 3, 1, 1, "#4a6a9a");
    F(ctx, x - 1, y - 6, w + 2, 2, R[1]); F(ctx, x, y - 8, w, 2, R[1]); F(ctx, x + 1, y - 9, w - 2, 1, R[1]);
    F(ctx, x, y - 8, 3, 1, R[2]); F(ctx, x - 1, y - 5, w + 2, 1, R[0]);
    F(ctx, x + w - 3, y - 11, 1, 2, "#6a5a5a");
  }
  function townSprites(ctx, sprites, sx, sy, d) {
    const n = d.size === "city" ? 17 : d.size === "town" ? 10 : 6, r = rng(hash(d.id)), spread = d.size === "city" ? 22 : d.size === "town" ? 15 : 11;
    const lm = LANDMARK[d.id], hole = lm ? (d.size === "city" ? 0.75 : 0.5) : 0;
    const lx = d.id === "ironhaven" ? sx : sx - spread - 5, ly = d.id === "ironhaven" ? sy : sy - 3;
    if (lm) sprites.push({ y: ly - 1, draw: () => lm(ctx, lx, ly) });
    if (d.id === "thornwall") palisade(ctx, sprites, sx, sy, spread);
    if (d.size !== "city") {
      const fx = sx + (r() < 0.5 ? -spread - 12 : spread + 2), fy = sy + 2;
      sprites.push({ y: fy - 6, draw: () => { F(ctx, fx - 1, fy - 1, 12, 8, "#8a6a3a"); for (let k = 0; k < 6; k += 2) { F(ctx, fx, fy + k, 10, 1, "#e0c45a"); F(ctx, fx, fy + k + 1, 10, 1, "#b8983a"); } } });
    }
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, rr = (hole + (1 - hole) * Math.sqrt(r())) * spread;
      const hx = sx + Math.cos(a) * rr - 3, hy = sy + Math.sin(a) * rr * 0.6 + 2;
      const roof = r() < 0.18 ? "blue" : "red", wide = r() < 0.3, st = d.id === "ashfen";
      sprites.push({ y: hy, draw: () => house(ctx, hx, hy, roof, wide, st) });
    }
  }
  function dungeon(ctx, x, y, theme) {
    switch (theme) {
      case "goblin":
        for (const [dx, c] of [[-8, "#a8442e"], [1, "#8a6a3a"]]) { F(ctx, x + dx, y - 5, 7, 5, "#2a1a10"); F(ctx, x + dx + 1, y - 4, 5, 4, c); F(ctx, x + dx + 2, y - 6, 3, 2, c); F(ctx, x + dx + 3, y - 3, 1, 3, "#2a1a10"); }
        for (let k = -10; k <= 9; k += 2) F(ctx, x + k, y + 1, 1, 3, "#6a4a2a");
        F(ctx, x - 1, y - 12, 1, 7, "#5a3a22"); F(ctx, x, y - 12, 3, 2, "#7a2a2a");
        break;
      case "beast": case "cave":
        F(ctx, x - 8, y - 8, 16, 9, "#4a4450"); F(ctx, x - 7, y - 9, 13, 2, "#6e6878"); F(ctx, x - 6, y - 10, 8, 1, "#8a8494");
        F(ctx, x - 3, y - 5, 6, 6, "#120c14"); F(ctx, x - 2, y - 6, 4, 1, "#120c14");
        if (theme === "cave") { F(ctx, x - 4, y - 7, 1, 8, "#7a5232"); F(ctx, x + 3, y - 7, 1, 8, "#7a5232"); F(ctx, x - 4, y - 7, 8, 1, "#9a6a3a"); }
        break;
      case "undead":
        F(ctx, x - 6, y - 9, 12, 10, "#2a2430"); F(ctx, x - 5, y - 8, 10, 9, "#a8a4b4"); F(ctx, x + 1, y - 8, 4, 9, "#84809a");
        F(ctx, x - 6, y - 10, 12, 2, "#5c586c"); F(ctx, x - 2, y - 4, 4, 5, "#1a1420"); F(ctx, x - 1, y - 16, 2, 6, "#5c586c"); F(ctx, x - 3, y - 14, 6, 2, "#5c586c");
        break;
      case "swamp":
        for (const [dx, hgt] of [[-7, 8], [-3, 12], [2, 6], [6, 10]]) { F(ctx, x + dx - 1, y - hgt - 1, 4, hgt + 1, "#2a3028"); F(ctx, x + dx, y - hgt, 2, hgt, "#8a9a7a"); F(ctx, x + dx, y - hgt, 1, hgt, "#a8b498"); }
        F(ctx, x - 8, y - 2, 16, 2, "#5a6a4a");
        break;
      case "ice":
        F(ctx, x - 4, y - 22, 8, 23, "#3a4a6a"); F(ctx, x - 3, y - 20, 6, 21, "#a4dcf4"); F(ctx, x + 1, y - 20, 2, 21, "#78b4dc"); F(ctx, x - 1, y - 26, 2, 7, "#e8f8ff"); F(ctx, x - 2, y - 21, 1, 12, "#e8f8ff");
        break;
      case "sea":
        F(ctx, x - 7, y - 10, 14, 11, "#2a3a48"); F(ctx, x - 6, y - 9, 3, 10, "#8aa4b0"); F(ctx, x + 3, y - 9, 3, 10, "#6a8494"); F(ctx, x - 6, y - 10, 12, 2, "#8aa4b0");
        F(ctx, x - 7, y, 14, 2, "#c4ecfa");
        break;
      case "fire":
        F(ctx, x - 11, y - 3, 22, 4, "#3a2626"); F(ctx, x - 8, y - 7, 16, 4, "#4a3030"); F(ctx, x - 5, y - 11, 10, 4, "#5a3a36"); F(ctx, x - 3, y - 13, 6, 2, "#ff7a2a"); F(ctx, x - 2, y - 13, 3, 1, "#ffd04a");
        F(ctx, x - 1, y - 11, 2, 9, "#e8502a"); F(ctx, x + 1, y - 19, 3, 3, "#8a7a7a"); F(ctx, x + 3, y - 23, 4, 3, "#a89a9a");
        break;
      default:
        F(ctx, x - 4, y - 5, 9, 6, "#1a1220"); F(ctx, x - 3, y - 4, 7, 5, "#6a6070");
    }
  }
  function bridge(ctx, x, y) { F(ctx, x - 6, y - 2, 12, 4, "#3a2616"); F(ctx, x - 5, y - 1, 10, 2, "#a8784a"); for (let k = -5; k < 5; k += 2) F(ctx, x + k, y - 1, 1, 2, "#7a5232"); }

  let terrainCache = null;
  function terrain() { return terrainCache || (terrainCache = render()); }

  function heroPos(h) {
    const S = App.S, xy = (id) => (S.towns[id] || S.wilds[id] || S.dungeons[id] || { xy: [0, 0] }).xy;
    let m;
    if (h.travel) {
      const a = xy(h.travel.from), b = xy(h.travel.to), t = 1 - (h.travel.left / Math.max(1, h.travel.total)) * 0.8 - 0.1;
      m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    } else m = xy(h.loc);
    return project(m[0], m[1]);
  }

  function drawMap(cv, opts) {
    opts = opts || {};
    const k = opts.small ? 1 : 2;
    const ter = terrain();
    cv.width = TW * k; cv.height = TH * k; cv._k = k;
    const base = document.createElement("canvas");
    base.width = cv.width; base.height = cv.height;
    const bctx = base.getContext("2d");
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(ter, 0, 0, TW * k, TH * k);
    // heroes, labels and markers go on a clear sheet above the moving water and clouds
    const over = document.createElement("canvas");
    over.width = cv.width; over.height = cv.height;
    const ctx = over.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const S = App.S, placed = [], groups = {}, extra = {};
    for (const h of App.L.heroes) {
      if (!h.alive) continue;
      const [x, y] = heroPos(h), key = Math.round(x) + "," + Math.round(y);
      const off = (groups[key] = (groups[key] || 0) + 1) - 1;
      if (off >= 3) { extra[key] = [x, y, off - 2]; continue; }
      const g = Art.heroGrid(h, 0, App.heroLook(h)), hs = k, fan = [[0, 0], [-10, -4], [10, -4]][off];
      const hx = x * k - (g.w * hs) / 2 + fan[0] * hs, hy = y * k - g.h * hs + 2 * hs + fan[1] * hs;
      placed.push({ h, g, x: hx + (g.w * hs) / 2, y: hy + (g.h * hs) / 2, r: 12 * hs, hx, hy, z: fan[1] });
    }
    placed.sort((a, b) => a.z - b.z);
    for (const p of placed) {
      ctx.fillStyle = "rgba(20,30,20,0.35)";
      ctx.beginPath(); ctx.ellipse(p.x, p.hy + p.g.h * k - 2 * k, 8 * k, 2.5 * k, 0, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(p.g.toCanvas(k), Math.round(p.hx), Math.round(p.hy));
    }
    for (const [x, y, c] of Object.values(extra)) {
      const bx = Math.round(x * k + 16 * k), by = Math.round(y * k - 30 * k);
      ctx.fillStyle = "#2a1b11"; ctx.fillRect(bx - 1, by - 1, 12 * k + 2, 8 * k + 2);
      ctx.fillStyle = "#8e2a22"; ctx.fillRect(bx, by, 12 * k, 8 * k);
      ctx.fillStyle = "#ffe9b8"; ctx.font = `600 ${7 * k}px "Pixelify Sans", monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("+" + c, bx + 6 * k, by + 4 * k + 1);
    }
    const L = App.L, WXI = { clear: "☀", cloudy: "☁", rain: "🌧", fog: "🌫", storm: "⛈", snow: "❄", heat: "🔥" };
    if (!opts.small && S.regions && L.weather) {
      ctx.font = `${22}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const [r, nodesIn] of Object.entries(S.regions)) {
        const pts = nodesIn.map((id) => (S.towns[id] || S.wilds[id] || S.dungeons[id] || {}).xy).filter(Boolean);
        if (!pts.length || !L.weather[r]) continue;
        const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        const [x, y] = project(cx, cy);
        ctx.globalAlpha = 0.85; ctx.fillText(WXI[L.weather[r]] || "", x * k, (y - 14) * k); ctx.globalAlpha = 1;
      }
    }
    const hy = L.hyper;
    if (hy && (hy.kind === "megabeast" || hy.kind === "comet") && hy.loc) {
      const xy = (S.towns[hy.loc] || S.wilds[hy.loc] || S.dungeons[hy.loc] || {}).xy;
      if (xy) {
        const [x, y] = project(xy[0], xy[1]);
        if (hy.kind === "megabeast" && S.monsters[hy.body]) {
          const g = Art.monsterGrid(Object.assign({}, S.monsters[hy.body], { boss: true }), 0);
          ctx.fillStyle = "rgba(160,20,20,0.35)"; ctx.beginPath(); ctx.arc(x * k, (y - 6) * k, 22 * k, 0, Math.PI * 2); ctx.fill();
          ctx.drawImage(g.toCanvas(k), Math.round(x * k - g.w * k / 2), Math.round((y - 4) * k - g.h * k));
        } else { ctx.font = `${30}px serif`; ctx.textAlign = "center"; ctx.fillText("☄", x * k, (y - 10) * k); }
      }
    }
    const dawn = (L.factions || {}).dawn;
    if (!opts.small && dawn && dawn.loc && dawn.loc !== "ironhaven") {
      const xy = (S.towns[dawn.loc] || S.wilds[dawn.loc] || S.dungeons[dawn.loc] || {}).xy;
      if (xy) { const [x, y] = project(xy[0], xy[1]); ctx.font = "20px serif"; ctx.textAlign = "center"; ctx.fillStyle = "#f6d77a"; ctx.fillText("☀", (x + 10) * k, (y - 16) * k); }
    }
    for (const [id, until] of Object.entries(L.closed || {})) {
      if (until <= L.meta.day) continue;
      const xy = (S.wilds[id] || {}).xy;
      if (xy) { const [x, y] = project(xy[0], xy[1]); ctx.font = "bold 18px sans-serif"; ctx.fillStyle = "#b02a1a"; ctx.textAlign = "center"; ctx.fillText("✖", x * k, (y - 10) * k); }
    }
    const phone = !opts.small && window.innerWidth < 700;
    const fs = opts.small ? 11 : phone ? 30 : 13;
    const busy = new Set(App.L.heroes.filter((h) => h.alive && !h.travel).map((h) => h.loc));
    const plaque = (txt, x, y, kind) => {
      ctx.font = `${kind === "town" ? 600 : 400} ${kind === "town" ? fs + 2 : fs}px "Pixelify Sans", monospace`;
      const w = Math.ceil(ctx.measureText(txt).width) + 10, h = fs + 6;
      x = Math.max(w / 2 + 2, Math.min(cv.width - w / 2 - 2, x));
      const x0 = Math.round(x - w / 2), y0 = Math.round(y);
      ctx.fillStyle = "#2a1b11"; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
      ctx.fillStyle = kind === "town" ? "#f1e3c2" : kind === "dungeon" ? "#e8cfc0" : "#dfe6c4"; ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = kind === "town" ? "#c8963e" : "rgba(0,0,0,0)"; ctx.fillRect(x0, y0 + h - 2, w, 2);
      ctx.fillStyle = kind === "dungeon" ? "#8e2a22" : kind === "wild" ? "#3a5a2a" : "#2e2116";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(txt, x0 + w / 2, y0 + h / 2 + 1);
    };
    for (const d of T.N) {
      if (opts.small && d.kind !== "town") continue;
      if (d.kind === "wild" && !busy.has(d.id)) continue;
      const [x, y] = project(d.xy[0], d.xy[1]);
      let txt = d.name;
      if (d.kind === "dungeon") { const st = (App.L.dungeons || {})[d.id] || {}; if (st.boss_alive === false) txt += " ✝"; }
      plaque(txt, x * k, (y + (d.kind === "town" ? 8 : 6)) * k, d.kind);
    }
    const water = { z: 0, draw: (c, t) => { c.imageSmoothingEnabled = false; c.drawImage(phase(Math.floor(t * 2.5) % PH), 0, 0, TW * k, TH * k); } };
    const sky = { z: 1, draw: (c, t) => {
      c.imageSmoothingEnabled = false;
      for (const cl of T.clouds) c.drawImage(cl.cv, Math.round((cloudAt(cl, t) - cl.ox) * k), Math.round((cl.y - cl.oy) * k), cl.cv.width * k, cl.cv.height * k);
    } };
    if (cv.anim) cv.anim.stop();
    if (window.Anim) Anim.stage(cv, base, [water, sky], { over, fps: 8, still: 0 });
    else { const c = cv.getContext("2d"); c.drawImage(base, 0, 0); water.draw(c, 0); sky.draw(c, 0); c.drawImage(over, 0, 0); }
    return placed;
  }

  function nearestNode(px, py, cv) {
    const k = (cv && cv._k) || 2, tx = px / k, ty = py / k;
    let best = null, bd = 1e9;
    for (const d of (T || { N: [] }).N) {
      const [x, y] = project(d.xy[0], d.xy[1]), dd = (x - tx) ** 2 + (y - ty) ** 2;
      if (dd < bd) { bd = dd; best = d.id; }
    }
    return bd < 26 * 26 ? best : null;
  }

  window.Isle = { drawMap, nearestNode, project, TW, TH, tree, pine, rock, house, SURF };
})();
