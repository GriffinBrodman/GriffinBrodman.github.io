/* The world map: a bright terraced island in oblique view (cliff faces, beaches, a river with falls, towns built like their header scenes),
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
    drowned: ["#687a46", "#788a50", "#8a9a5c"], wrack: ["#a08a58", "#b09a66", "#c0aa74"],
  };
  const CLIFF = {
    def: ["#bcc2e6", "#9ea6d6", "#7e86bc", "#5e6298"], snow: ["#e2eaf8", "#c0cbea", "#9ca8d2", "#7884b2"],
    volcanic: ["#7a5a5a", "#5e4446", "#4a3436", "#36262a"], sand: ["#d8b070", "#c09858", "#a08048", "#806438"],
    // the mainland's lavender ramp a step darker and wetter: the isle's rock is the same rock, a century under the sea
    drowned: ["#a4a8cc", "#868ab6", "#6a6c9a", "#4e5078"],
  };
  const FALLS = ["#f2fbff", "#c4e6fa", "#8ccaf0"];
  const SEACLIFF = ["#d4d8f0", "#aab2dc", "#8890c4", "#5e6298"];
  const WETCLIFF = ["#9a9ec4", "#7c80ae", "#62649a", "#4a4c78"];
  const RAMP = ["#e4cc96", "#d8c08a", "#c8ac74", "#b89a62"];
  const BASE = { plains: 2, forest: 2, marsh: 2, hills: 3, snow: 4, volcanic: 4, coast: 3 };
  const RIVER = [[204, 26], [194, 50], [182, 72], [170, 98], [158, 120], [144, 144], [138, 166], [132, 204]];

  let T = null;
  function nodes() {
    const S = App.S, out = [];
    for (const [id, t] of Object.entries(S.towns)) out.push({ id, kind: "town", xy: t.xy, biome: t.biome, size: t.size, name: t.name, layer: t.layer });
    for (const [id, t] of Object.entries(S.wilds)) out.push({ id, kind: "wild", xy: t.xy, biome: t.biome, name: t.name, layer: t.layer });
    for (const [id, t] of Object.entries(S.dungeons)) out.push({ id, kind: "dungeon", xy: t.xy, biome: t.biome, theme: t.theme, name: t.name, layer: t.layer });
    return out;
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }

  // a risen map layer (The Drowned Isle Rises) is its own low island off the coast, ringed by the sand the sea left; it never shapes the mainland
  function build() {
    const S = App.S, N = nodes(), n = noise2(99), n2 = noise2(7), n3 = noise2(1234);
    const M = N.filter((d) => !d.layer), LN = N.filter((d) => d.layer), IN = LN.filter((d) => d.kind !== "wild");
    const nodeById = Object.fromEntries(N.map((d) => [d.id, d]));
    const lev = new Uint8Array(TW * TH), bio = new Array(TW * TH), landv = new Float32Array(TW * TH);
    const river = new Uint8Array(TW * TH), road = new Uint8Array(TW * TH);
    const isle = new Uint8Array(TW * TH), flat = new Uint8Array(TW * TH), cause = new Uint8Array(TW * TH), seav = new Float32Array(TW * TH).fill(-9);
    const roads = S.roads.map(([a, b]) => [nodeById[a].xy, nodeById[b].xy, !!(nodeById[a].layer || nodeById[b].layer)]);
    const mainRoads = roads.filter((r) => !r[2]), isleRoads = S.roads.filter(([a, b]) => IN.includes(nodeById[a]) && IN.includes(nodeById[b])).map(([a, b]) => [nodeById[a].xy, nodeById[b].xy]);
    const C = IN.length ? [IN.reduce((a, d) => a + d.xy[0], 0) / IN.length, IN.reduce((a, d) => a + d.xy[1], 0) / IN.length] : null;
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const mx = (x + 0.5) / U, my = (y + 0.5) / U, i = y * TW + x;
      let l = -1;
      for (const d of M) {
        const r = d.theme === "sea" ? 12 : d.kind === "town" ? 44 : 38;
        l = Math.max(l, 1 - Math.hypot(d.xy[0] - mx, d.xy[1] - my) / r);
      }
      for (const [A, B] of mainRoads) l = Math.max(l, 0.55 - segDist(mx, my, A[0], A[1], B[0], B[1]) / 26);
      l += (fbm(n, mx / 20, my / 20) - 0.5) * 0.6;
      const edge = Math.min(mx, MW - mx, my, MH - my);
      l -= Math.max(0, (16 - edge) / 16) * 0.7;
      landv[i] = l;
      if (C && l <= 0.16 && risen(mx, my, l, i)) continue;
      const rd = Math.min(...RIVER.slice(1).map((p, k) => segDist(mx + (n2(mx / 8, my / 8) - 0.5) * 3, my, RIVER[k][0], RIVER[k][1], p[0], p[1])));
      if (l <= 0.16) continue;
      const wx = mx + (fbm(n, mx / 16, my / 16) - 0.5) * 26, wy = my + (fbm(n, mx / 16 + 40, my / 16) - 0.5) * 26;
      let best = M[0], bd = 1e9;
      for (const d of M) { const dd = (d.xy[0] - wx) ** 2 + (d.xy[1] - wy) ** 2; if (dd < bd) { bd = dd; best = d; } }
      const b = best.biome;
      bio[i] = b;
      if (l < 0.25) { lev[i] = 1; bio[i] = "sand"; }
      else {
        const t = fbm(n3, mx / 26, my / 26);
        lev[i] = Math.max(2, BASE[b] + (t > 0.6 ? 1 : 0) - (t < 0.34 && b !== "snow" && b !== "volcanic" ? 1 : 0));
      }
      if (rd < 1.6) river[i] = 1;
    }
    // the island: low drowned ground around its places; then the flats, the old sea floor between it and the shore, hugging the coast
    function risen(mx, my, l, i) {
      let il = -1;
      for (const d of IN) il = Math.max(il, 1 - Math.hypot(d.xy[0] - mx, (d.xy[1] - my) * 1.4) / (d.kind === "town" ? 22 : 16));
      for (const [A, B] of isleRoads) il = Math.max(il, 0.5 - segDist(mx, my, A[0], A[1], B[0], B[1]) / 16);
      il += (fbm(n, mx / 9 + 50, my / 9) - 0.5) * 0.5;
      seav[i] = il;
      if (il > 0.16) {
        isle[i] = 1; lev[i] = il < 0.3 ? 1 : 2; bio[i] = il < 0.3 ? "wrack" : "drowned";
        return true;
      }
      let fv = 1 - Math.hypot((mx - C[0] - 8) / 46, (my - C[1] + 10) / 13);
      for (const d of LN) if (d.kind === "wild") fv = Math.max(fv, 1 - Math.hypot(d.xy[0] - mx, d.xy[1] - my) / 18);
      fv = Math.min(fv, 0.15 + (l + 0.6) * 0.9) + Math.max(0, il + 0.3) * 0.8 + (fbm(n3, mx / 7, my / 7) - 0.5) * 0.45;
      if (fv > 0.12) { flat[i] = fv > 0.2 ? 2 : 1; seav[i] = Math.max(seav[i], 0.13); }
      return false;
    }
    // the old sea floor runs right up to the old shore: a strip of sea left between the flats and the land above them is sand too
    if (C) for (let x = 0; x < TW; x++) for (let y = TH - 1; y > 0; y--) {
      const i = y * TW + x;
      if (!flat[i] || flat[i - TW] || lev[i - TW]) continue;
      let k = 1;
      while (k < 18 && y - k > 0 && !lev[i - k * TW] && !flat[i - k * TW]) k++;
      if (k < 18 && y - k > 0 && lev[i - k * TW]) for (let j = 1; j < k; j++) { flat[i - j * TW] = 1; seav[i - j * TW] = Math.max(seav[i - j * TW], 0.13); }
    }
    for (const [A, B, lay] of roads) {
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]), steps = Math.ceil(len * U * 1.5), wob = (n2(A[0] / 9, B[1] / 9) - 0.5) * 14;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps, bend = Math.sin(t * Math.PI) * wob;
        const mx = A[0] + (B[0] - A[0]) * t - ((B[1] - A[1]) / len) * bend, my = A[1] + (B[1] - A[1]) * t + ((B[0] - A[0]) / len) * bend;
        const x = Math.round(mx * U), y = Math.round(my * U);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < TW && yy < TH && lev[yy * TW + xx] && !river[yy * TW + xx]) road[yy * TW + xx] = 1;
          else if (lay && xx >= 0 && yy >= 0 && xx < TW && yy < TH && flat[yy * TW + xx]) cause[yy * TW + xx] = s % 16 === 0 ? 2 : 1;
        }
      }
    }
    return { lev, bio, landv, river, road, isle, flat, cause, seav, N, n, n2, n3 };
  }

  function levelAt(mx, my) {
    const x = Math.max(0, Math.min(TW - 1, Math.round(mx * U))), y = Math.max(0, Math.min(TH - 1, Math.round(my * U)));
    return T.lev[y * TW + x];
  }
  function project(mx, my) { return [mx * U, my * U - levelAt(mx, my) * CH]; }

  function render() {
    T = build();
    const { lev, bio, landv, river, road, isle, flat, cause, seav, N, n, n2, n3 } = T;
    const cv = document.createElement("canvas");
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext("2d");
    const img = ctx.createImageData(TW, TH), D = img.data;
    const put = (x, y, c) => { if (x < 0 || y < 0 || x >= TW || y >= TH) return; const i = (y * TW + x) * 4, v = typeof c === "string" ? rgb(c) : c; D[i] = v[0]; D[i + 1] = v[1]; D[i + 2] = v[2]; D[i + 3] = 255; };
    const bayer = (x, y) => [0, 0.5, 0.75, 0.25][(x & 1) + (y & 1) * 2] - 0.375;
    // pixels that move: wave crests, shore foam, river glints and falls; each kept with its colour index so the live map can shift them
    const fx = { crest: [], foam: [], river: [], falls: [], glint: [] };
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const i = y * TW + x;
      if (flat[i]) { put(x, y, sand(x, y, i)); continue; }
      const l = Math.max(landv[i], seav[i]), v = fbm(n2, x / 14, y / 5);
      let c = l > 0.12 + bayer(x, y) * 0.04 ? "#7cc8f0" : l > 0.02 + bayer(x, y) * 0.06 ? "#5aaee6" : l > -0.25 ? "#3f94d8" : l > -0.5 + bayer(x, y) * 0.08 ? "#3484cc" : "#2c74bc";
      if (l <= 0.12 && v > 0.7) fx.crest.push([x, y, (x + (y >> 1)) % 6, c]);
      if (l <= 0.12 && v > 0.7 && (x + (y >> 1)) % 6 < 3) c = "#a4dcf8";
      put(x, y, c);
    }
    // the old sea floor: wet rippled sand, pools that catch the light, a wash of foam where the sea now stops, and the causeways over it
    function sand(x, y, i) {
      const edge = !flat[i - 1] || !flat[i + 1] || !flat[i - TW] || !flat[i + TW], near = !flat[i - 2] || !flat[i + 2] || !flat[i + 2 * TW];
      if (cause[i] || cause[i - 1] || cause[i + 1]) {
        if (cause[i] === 2 || cause[i - 1] === 2) return "#4e3a26";
        return cause[i] && cause[i - 1] && cause[i + 1] ? ((x * 3 + y) % 4 ? "#b8a682" : "#9a8a6a") : "#6e6050";
      }
      if (edge && !lev[i - TW] && !lev[i + TW]) { fx.foam.push([x, y, (x + y) % 3]); return (x + y) % 3 ? "#f2fbff" : "#c4e6fa"; }
      if (near && !lev[i - TW]) return "#9ccbd6";
      const pool = fbm(n3, x / 11 + 9, y / 6), wet = flat[i] === 1 || pool > 0.6;
      if (pool > 0.66) {
        const rim = fbm(n3, x / 11 + 9, (y - 1) / 6) <= 0.66 || fbm(n3, x / 11 + 9, (y + 1) / 6) <= 0.66;
        if (rim) return "#86a8a0";
        const g = (x * 7 + y * 13) % 23 === 0;
        if (g) fx.glint.push([x, y, (x + y) % PH]);
        return g ? "#e8f8ff" : bayer(x, y) > 0 ? "#78c0dc" : "#6ab2d4";
      }
      if (fbm(n2, x / 5 + 70, y / 5) > 0.74) return (x + y) % 2 ? "#6e7a44" : "#58663a";
      const rip = ((y + Math.round(Math.sin(x / 3.5 + fbm(n, x / 30, y / 30) * 8) * 1.2)) % 5 + 5) % 5, dash = fbm(n2, x / 3 + 20, y / 2) > 0.45;
      if (pool > 0.56) return bayer(x, y) > 0 ? "#a8b49a" : "#b4b898";
      if (dash && rip === 0) return wet ? "#d4ba82" : "#e4ca94";
      if (dash && rip === 1) return wet ? "#b09460" : "#c4a870";
      return wet ? "#c0a26c" : "#d0b47e";
    }
    for (let x = 0; x < TW; x++) for (let y = 0; y < TH; y++) {
      const i = y * TW + x, L = lev[i];
      if (!L) continue;
      const b = bio[i], ty = y - L * CH, cl = isle[i] ? CLIFF.drowned : b === "sand" ? CLIFF.sand : b === "snow" ? CLIFF.snow : b === "volcanic" ? CLIFF.volcanic : CLIFF.def;
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
      if (isle[i] && !road[i] && fbm(n2, x / 4 + 30, y / 4) > 0.64) c = (x + y) % 2 ? "#4e6a3a" : "#5e7c44";
      if (front && !river[i]) c = mix(pal[0], "#1e3a1a", 0.35);
      put(x, ty, c);
      // where the old sea floor runs up to a shore, mainland or isle, the shore comes down to it as a low stepped sand ramp, not a sea cliff,
      // so the isle and the coast it rose off read as one landmass; barnacles speckle the isle's ramp
      const ramp = y + 1 < TH && !lev[i + TW] && (flat[i + TW] || flat[i + 2 * TW] || flat[i + 3 * TW]);
      if (ramp) {
        const S = 2 + (fbm(n2, x / 5, 11) > 0.5 ? 1 : 0);
        for (let k = 1; k <= S; k++) put(x, y + k, isle[i] && (x * 3 + k) % 7 === 0 ? "#e8e2cc" : RAMP[Math.min(RAMP.length - 1, k - 1 + (S === 2 ? 1 : 0))]);
        if (!flat[(y + S + 1) * TW + x] || (x + y) % 3) put(x, y + S + 1, "#a08a5a");
      } else if (y + 1 < TH && !lev[i + TW] && isle[i]) {
        const S = 2 + Math.floor(fbm(n2, x / 6, 3) * 4);
        for (let k = 1; k <= S; k++) put(x, y + k, k === 1 ? "#4e6a3a" : (x * 3 + k) % 7 === 0 ? "#e8e2cc" : WETCLIFF[Math.min(3, Math.floor((k - 1) / S * 4))]);
        put(x, y + S + 1, (x + y) % 3 ? "#f2fbff" : "#c4e6fa");
        fx.foam.push([x, y + S + 1, (x + y) % 3]);
      } else if (y + 1 < TH && !lev[i + TW]) {
        const S = 3 + Math.floor(fbm(n2, x / 10, 7) * 9) + (river[i] ? 0 : 0);
        for (let k = 1; k <= S; k++) {
          const t = k / S;
          put(x, y + k, river[i] ? FALLS[(y + k + x * 2) % 3] : SEACLIFF[t < 0.2 ? 0 : t < 0.55 ? 1 : t < 0.85 ? 2 : 3 - ((x * 5 + k) % 9 === 0 ? 1 : 0)]);
          if (river[i]) fx.falls.push([x, y + k, (y + k + x * 2) % 3]);
        }
        if (flat[(y + S + 1) * TW + x]) { put(x, y + S + 1, "#7a6444"); put(x, y + S + 2, "#9a8058"); continue; }
        put(x, y + S + 1, (x + y) % 3 ? "#f2fbff" : "#c4e6fa");
        fx.foam.push([x, y + S + 1, (x + y) % 3]);
        put(x, y + S + 2, "#2f80c4");
      }
    }
    ctx.putImageData(img, 0, 0);

    const sprites = [];
    T.windows = [];
    T.burnt = {};
    const near = (mx, my, r) => N.some((d) => (d.kind !== "wild") && Math.hypot(d.xy[0] - mx, d.xy[1] - my) < r);
    for (let cy = 2; cy < TH; cy += 5) for (let cx = 1; cx < TW; cx += 5) {
      const h = hash(cx + ":" + cy), jx = cx + (h & 3), jy = cy + ((h >> 2) & 3), i = jy * TW + jx;
      if (jy < TH && isle[i] && !road[i] && !road[i + 2] && !road[i - 2] && p0(h) < 0.22 && !near(jx / U, jy / U, 7)) { const sx = jx, sy = jy - lev[i] * CH; sprites.push({ y: sy, draw: () => wrack(ctx, sx, sy, h) }); continue; }
      if (jy >= TH || !lev[i] || river[i] || road[i] || bio[i] === "sand" || isle[i]) continue;
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
      if (RISEN[d.id]) RISEN[d.id](ctx, sprites, sx, sy, d);
      else if (d.kind === "town") townSprites(ctx, sprites, sx, sy, d);
      else if (d.kind === "dungeon") sprites.push({ y: sy + 2, draw: () => dungeon(ctx, sx, sy, d.theme) });
    }
    // the stakes that mark the causeways over the sand
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) if (cause[y * TW + x] === 2 && cause[y * TW + x - 1] !== 2) sprites.push({ y, draw: () => { F(ctx, x - 2, y - 4, 1, 4, "#3a2a1c"); F(ctx, x - 2, y - 4, 1, 1, "#8a6a42"); F(ctx, x + 2, y - 3, 1, 3, "#3a2a1c"); } });
    const [bx, by] = project(141, 151);
    sprites.push({ y: by + 1, draw: () => bridge(ctx, bx, by) });
    sprites.sort((a, b) => a.y - b.y);
    for (const s of sprites) s.draw();
    // a moving pixel only moves where no house, tree or bridge was drawn over it
    const after = ctx.getImageData(0, 0, TW, TH).data;
    const bare = ([x, y]) => { const i = (y * TW + x) * 4; return D[i] === after[i] && D[i + 1] === after[i + 1] && D[i + 2] === after[i + 2]; };
    for (const k of Object.keys(fx)) fx[k] = fx[k].filter((p) => p[1] >= 0 && p[1] < TH && bare(p));
    T.fx = fx;
    T.clouds = clouds(landv, seav);
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
    for (const [x, y, m] of fx.glint) { ctx.fillStyle = m === p ? "#ffffff" : "#78c0dc"; ctx.fillRect(x, y, 1, 1); }
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
  function clouds(landv, seav) {
    const r = rng(4242), spots = [[30, 26, 70], [TW - 60, 34, 60], [TW / 2 - 40, 10, 54], [24, TH - 40, 64], [TW - 40, TH - 30, 70]];
    for (let k = 0; k < 40 && spots.length < 9; k++) {
      const x = 30 + r() * (TW - 60), y = 20 + r() * (TH - 40);
      if (Math.max(landv[Math.floor(y) * TW + Math.floor(x)], seav[Math.floor(y) * TW + Math.floor(x)]) > -0.3 || spots.some(([a, b]) => Math.hypot(a - x, b - y) < 120)) continue;
      spots.push([x, y, 40 + r() * 30]);
    }
    return spots.map(([x, y, w], k) => Object.assign(cloud(w, 77 + k), { x, y, w, speed: 1.6 + (k % 3) * 0.7 }));
  }
  // a cloud drifts east and comes round again from the west edge, so the sky never empties
  function cloudAt(c, t) {
    const span = TW + c.cv.width * 2;
    return ((c.x + c.speed * t + c.cv.width) % span + span) % span - c.cv.width;
  }

  const MAR = ["#ffffff", "#eeeae2", "#c8c2b8", "#968e86"], GOLD = ["#fff2a8", "#f0c050", "#b07a28", "#7a5018"];
  const CRIM = ["#ec6a54", "#c03c32", "#7e2228"], SLATE = ["#8a9ab8", "#5e6e90", "#3e4a68"], WALLST = ["#dcd8d0", "#b2aea8", "#8a8884", "#5e5c60"];
  const blob = (ctx, cx, cy, rx, ry, c) => { for (let yy = -ry; yy <= ry; yy++) { const w = Math.round(rx * Math.sqrt(1 - (yy / ry) ** 2)); F(ctx, cx - w, cy + yy, w * 2 + 1, 1, c); } };
  function pennant(ctx, x, y, c) { F(ctx, x, y, 1, 5, "#3a2a1e"); F(ctx, x + 1, y, 4, 2, c[1]); F(ctx, x + 1, y, 4, 1, c[0]); F(ctx, x + 5, y, 1, 1, c[1]); }
  function cone(ctx, x, y, w, R, ol) {
    let i = 0;
    for (; w - (i >> 1) * 2 >= 1; i++) F(ctx, x - 1 + (i >> 1), y - i, w + 2 - (i >> 1) * 2, 1, ol);
    F(ctx, x + ((i - 1) >> 1), y - i, w - ((i - 1) >> 1) * 2, 1, ol);
    for (let j = 0; j < i; j++) { const a = x + (j >> 1), n = w - (j >> 1) * 2; F(ctx, a, y - j, n, 1, R[1]); F(ctx, a, y - j, Math.min(2, n), 1, R[0]); if (n > 2) F(ctx, a + n - 1, y - j, 1, 1, R[2]); }
  }
  function citadel(ctx, x, y) {
    const OL = "#2a2430";
    for (const tx of [x - 16, x + 12]) {
      F(ctx, tx - 1, y - 23, 6, 24, OL); F(ctx, tx, y - 22, 4, 22, MAR[1]); F(ctx, tx, y - 22, 1, 22, MAR[0]); F(ctx, tx + 3, y - 22, 1, 22, MAR[2]);
      F(ctx, tx + 1, y - 18, 2, 3, "#3a3444"); F(ctx, tx + 1, y - 11, 2, 3, "#3a3444");
      cone(ctx, tx, y - 24, 4, [SLATE[0], SLATE[1], SLATE[2]], OL); F(ctx, tx - 1, y - 24, 6, 1, OL); F(ctx, tx, y - 24, 4, 1, SLATE[2]);
      pennant(ctx, tx + 2, y - 33, [CRIM[0], CRIM[1]]);
    }
    F(ctx, x - 12, y - 13, 24, 14, OL); F(ctx, x - 11, y - 12, 22, 12, MAR[1]); F(ctx, x + 5, y - 12, 6, 12, MAR[2]);
    for (let xx = x - 10; xx < x + 11; xx += 3) { F(ctx, xx, y - 10, 1, 10, xx > x + 4 ? MAR[3] : MAR[2]); F(ctx, xx - 1, y - 10, 1, 10, xx > x + 4 ? MAR[2] : MAR[0]); }
    for (const bx of [x - 8, x + 6]) { F(ctx, bx, y - 10, 2, 6, CRIM[1]); F(ctx, bx, y - 10, 1, 6, CRIM[0]); F(ctx, bx, y - 8, 2, 1, GOLD[1]); }
    F(ctx, x - 2, y - 7, 5, 7, "#3a2e2e"); F(ctx, x - 1, y - 8, 3, 1, "#3a2e2e"); F(ctx, x, y - 6, 1, 6, "#6a5a4a");
    F(ctx, x - 13, y - 15, 26, 3, OL); F(ctx, x - 12, y - 14, 24, 1, MAR[0]); F(ctx, x - 12, y - 13, 24, 1, CRIM[1]);
    for (let xx = x - 11; xx < x + 12; xx += 3) F(ctx, xx, y - 13, 1, 1, GOLD[1]);
    F(ctx, x - 7, y - 20, 14, 6, OL); F(ctx, x - 6, y - 19, 12, 5, MAR[1]); F(ctx, x - 6, y - 19, 2, 5, MAR[0]); F(ctx, x + 3, y - 19, 3, 5, MAR[2]);
    for (const wx of [x - 3, x, x + 3]) F(ctx, wx, y - 18, 1, 2, "#3a3444");
    const r = 7.5;
    for (let yy = -8; yy <= 0; yy++) { const hw = Math.round((r + 1) * Math.sqrt(Math.max(0, 1 - (yy / (r + 1)) ** 2))); F(ctx, x - hw, y - 20 + yy, hw * 2 + 1, 1, OL); }
    for (let yy = -7; yy <= 0; yy++) {
      const hw = Math.round(r * Math.sqrt(Math.max(0, 1 - (yy / r) ** 2)));
      for (let xx = -hw; xx <= hw; xx++) {
        const u = xx / (hw + 0.01);
        let c = u < -0.5 ? GOLD[0] : u < 0.15 ? GOLD[1] : u < 0.65 ? GOLD[2] : GOLD[3];
        if ((xx === -3 || xx === 3) && yy > -6) c = u < 0 ? GOLD[2] : GOLD[3];
        F(ctx, x + xx, y - 20 + yy, 1, 1, c);
      }
    }
    F(ctx, x - 4, y - 24, 1, 2, "#ffffff"); F(ctx, x - 7, y - 20, 15, 1, GOLD[3]);
    F(ctx, x - 2, y - 31, 5, 4, OL); F(ctx, x - 1, y - 30, 3, 3, GOLD[1]); F(ctx, x - 1, y - 30, 1, 3, GOLD[0]); F(ctx, x, y - 29, 1, 1, "#3a3444");
    F(ctx, x, y - 34, 1, 3, GOLD[2]); F(ctx, x, y - 35, 1, 1, GOLD[0]); pennant(ctx, x, y - 40, [CRIM[0], CRIM[1]]);
  }
  // Ironhaven's curtain wall rings the whole city; each block is placed on the ground under it, and the river runs through a water gate
  function ramparts(ctx, sprites, d) {
    const cx = d.xy[0] * U, cy = d.xy[1] * U, rx = 31, ry = 19, OL = "#2a2430", N = 44, TOWERS = new Set([0, 5, 17, 22, 33]);
    const wet = (x, y) => { for (let dx = -3; dx <= 3; dx++) { const i = Math.round(y) * TW + Math.round(x) + dx; if (!T.lev[i] || T.river[i]) return true; } return false; };
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2, gx = cx + Math.cos(a) * rx, gy = cy + Math.sin(a) * ry;
      if (wet(gx, gy)) continue;
      const px = Math.round(gx), py = Math.round(gy - T.lev[Math.round(gy) * TW + Math.round(gx)] * CH), tower = TOWERS.has(k), gate = k === 11;
      sprites.push({ y: py, draw: () => {
        if (gate) {
          for (const dx of [-6, 3]) { F(ctx, px + dx - 1, py - 12, 6, 13, OL); F(ctx, px + dx, py - 11, 4, 11, WALLST[1]); F(ctx, px + dx, py - 11, 1, 11, WALLST[0]); F(ctx, px + dx + 3, py - 11, 1, 11, WALLST[2]); cone(ctx, px + dx, py - 13, 4, [CRIM[0], CRIM[1], CRIM[2]], OL); }
          F(ctx, px - 2, py - 9, 5, 10, OL); F(ctx, px - 2, py - 10, 5, 1, WALLST[1]); F(ctx, px - 1, py - 7, 3, 7, "#4a3a32"); F(ctx, px - 1, py - 8, 3, 1, CRIM[1]); F(ctx, px, py - 8, 1, 1, GOLD[1]);
          return;
        }
        F(ctx, px - 2, py - 7, 5, 8, OL); F(ctx, px - 2, py - 6, 5, 6, WALLST[1]); F(ctx, px - 2, py - 6, 5, 1, WALLST[0]); F(ctx, px - 2, py - 1, 5, 1, WALLST[2]);
        F(ctx, px - 1 + (k % 2) * 2, py - 4, 1, 1, WALLST[2]);
        if (k % 2) { F(ctx, px - 1, py - 9, 3, 2, OL); F(ctx, px, py - 8, 1, 1, WALLST[0]); }
        if (!tower) return;
        F(ctx, px - 4, py - 12, 9, 13, OL); F(ctx, px - 3, py - 11, 7, 11, WALLST[1]); F(ctx, px - 3, py - 11, 2, 11, WALLST[0]); F(ctx, px + 2, py - 11, 2, 11, WALLST[2]); F(ctx, px, py - 8, 1, 2, "#2a2228");
        cone(ctx, px - 3, py - 13, 7, [CRIM[0], CRIM[1], CRIM[2]], OL);
        if (k === 0 || k === 22 || k === 33) pennant(ctx, px, py - 26, [CRIM[0], CRIM[1]]);
      } });
    }
  }
  function headframe(ctx, x, y) {
    F(ctx, x - 12, y - 4, 22, 5, "#4a4450"); F(ctx, x - 10, y - 6, 14, 2, "#6a6458"); F(ctx, x - 8, y - 7, 8, 1, "#8a8478");
    for (const [a, b] of [[-6, -1], [6, 1]]) { Ln(ctx, x + a, y - 4, x + b, y - 22, "#3a2414"); Ln(ctx, x + a + 1, y - 4, x + b + 1, y - 22, "#7a5232"); }
    Ln(ctx, x - 4, y - 12, x + 5, y - 12, "#7a5232"); Ln(ctx, x - 5, y - 8, x + 5, y - 16, "#5a3a22");
    for (let a = 0; a < 16; a++) F(ctx, x + Math.round(Math.cos(a / 16 * 6.283) * 3.5), y - 23 + Math.round(Math.sin(a / 16 * 6.283) * 3.5), 1, 1, "#2a1a10");
    F(ctx, x, y - 23, 1, 1, "#c8963e"); Ln(ctx, x + 3, y - 23, x + 3, y - 6, "#c8c0b0");
    F(ctx, x + 5, y - 10, 11, 9, "#1c1c22"); F(ctx, x + 6, y - 9, 9, 7, "#96948e"); F(ctx, x + 6, y - 9, 2, 7, "#b8b6b0"); F(ctx, x + 12, y - 9, 3, 7, "#6e6c6a");
    F(ctx, x + 4, y - 12, 13, 3, "#1c1c22"); F(ctx, x + 5, y - 11, 11, 1, "#7a8494"); F(ctx, x + 5, y - 10, 11, 1, "#58606e"); F(ctx, x + 9, y - 6, 2, 4, "#2a1a12"); F(ctx, x + 13, y - 7, 1, 1, "#ffc860");
    F(ctx, x + 14, y - 15, 3, 4, "#1c1c22"); F(ctx, x + 15, y - 14, 1, 3, "#6a5a54");
    puffs(ctx, x + 15, y - 15, "#8a8c90");
    blob(ctx, x - 20, y - 2, 6, 3, "#2e2c2c"); blob(ctx, x - 21, y - 3, 4, 2, "#3e3a3a"); F(ctx, x - 22, y - 5, 2, 1, "#4e4a48");
    for (const [dx, dy] of [[-24, -1], [-19, -3], [-17, 0], [-22, -2]]) F(ctx, x + dx, y + dy, 1, 1, "#a8542a");
    F(ctx, x - 14, y - 7, 5, 3, "#4a4450"); F(ctx, x - 13, y - 8, 3, 1, "#d07a3a"); F(ctx, x - 12, y - 8, 1, 1, "#6a3018"); F(ctx, x - 14, y - 4, 1, 1, "#1a1416"); F(ctx, x - 10, y - 4, 1, 1, "#1a1416");
  }
  function lighthouse(ctx, x, y) {
    F(ctx, x - 8, y - 4, 16, 7, "#1a2230"); F(ctx, x - 7, y - 3, 14, 5, "#e4e0d2"); F(ctx, x - 7, y - 3, 4, 5, "#fbf8ee"); F(ctx, x + 3, y - 3, 4, 5, "#bcb8aa"); F(ctx, x - 4, y, 1, 2, "#8a8a84"); F(ctx, x + 4, y - 1, 1, 2, "#8a8a84");
    F(ctx, x - 7, y - 4, 14, 1, "#6ab040"); F(ctx, x - 6, y - 4, 3, 1, "#8ad04a");
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
    F(ctx, x + 7, y - 21, 1, 4, "#3a2414"); F(ctx, x + 7, y - 22, 1, 1, "#ff9a3a"); F(ctx, x + 7, y - 23, 1, 1, "#ffe08a");
    ctx.globalAlpha = 0.22; blob(ctx, x + 7, y - 22, 5, 4, "#ffb04a"); ctx.globalAlpha = 1;
  }
  function tollhouse(ctx, x, y) {
    const ST = ["#d0ccb6", "#aca892", "#86826e", "#5c5a4a"], OL = "#22262a";
    F(ctx, x - 7, y - 17, 14, 18, OL); F(ctx, x - 6, y - 16, 12, 16, ST[1]); F(ctx, x - 6, y - 16, 3, 16, ST[0]); F(ctx, x + 3, y - 16, 3, 16, ST[2]);
    for (let yy = y - 14; yy < y; yy += 3) for (let xx = x - 5 + ((yy >> 1) % 2) * 2; xx < x + 6; xx += 4) F(ctx, xx, yy, 2, 1, ST[3]);
    F(ctx, x - 3, y - 13, 2, 3, OL); F(ctx, x + 1, y - 13, 2, 3, OL); F(ctx, x - 3, y - 12, 2, 2, "#ffd46a"); F(ctx, x + 1, y - 12, 2, 2, "#e8b84a");
    F(ctx, x - 3, y - 8, 6, 8, OL); F(ctx, x - 2, y - 9, 4, 1, OL); F(ctx, x - 2, y - 7, 4, 7, "#7a4a24"); F(ctx, x, y - 7, 1, 7, "#5a3418");
    F(ctx, x - 8, y - 19, 16, 3, OL); F(ctx, x - 7, y - 18, 14, 1, ST[0]);
    cone(ctx, x - 5, y - 20, 10, ["#5a7ab8", "#3e5a94", "#2a3e6a"], OL);
    pennant(ctx, x, y - 35, ["#fff0a0", "#e8b84a"]);
    F(ctx, x + 9, y - 5, 1, 6, "#5a3a22");
    for (let k = 0; k < 12; k++) F(ctx, x + 9 + k, y - 5, 1, 1, (k >> 1) % 2 ? "#c8463a" : "#f2ead8");
  }
  function treehouse(ctx, x, y) {
    F(ctx, x - 3, y - 18, 6, 19, "#3a2414"); F(ctx, x - 2, y - 18, 4, 18, "#7a5232"); F(ctx, x + 1, y - 18, 1, 18, "#5a3a22");
    F(ctx, x - 5, y - 1, 3, 1, "#5a3a22"); F(ctx, x + 2, y - 1, 3, 1, "#5a3a22");
    blob(ctx, x, y - 28, 15, 10, "#163a1e"); blob(ctx, x - 1, y - 29, 14, 9, "#2e6a32"); blob(ctx, x - 4, y - 32, 8, 5, "#4a8a3a"); blob(ctx, x - 6, y - 34, 3, 2, "#7ab84a");
    F(ctx, x - 10, y - 20, 20, 3, "#14100c"); F(ctx, x - 9, y - 20, 18, 1, "#c8a064"); F(ctx, x - 9, y - 19, 18, 1, "#a8804a");
    for (let k = -9; k < 9; k += 3) F(ctx, x + k, y - 23, 1, 3, "#5a3c22");
    F(ctx, x - 9, y - 23, 18, 1, "#c8a46a");
    home(ctx, x - 5, y - 20, STYLE.hollowood, true, 11);
    for (let k = 0; k < 7; k++) F(ctx, x + 7, y - 17 + k * 3, 3, 1, "#c8a46a");
    F(ctx, x + 7, y - 18, 1, 18, "#5a3c22"); F(ctx, x + 9, y - 18, 1, 18, "#5a3c22");
    for (const [dx, dy] of [[-12, -24], [11, -26], [-2, -38]]) F(ctx, x + dx, y + dy, 3, 2, "#2e6a32");
    for (const [dx, dy] of [[-9, -25], [9, -27]]) { F(ctx, x + dx, y + dy - 2, 1, 2, "#14100c"); F(ctx, x + dx, y + dy, 1, 1, "#ffd870"); ctx.globalAlpha = 0.25; blob(ctx, x + dx, y + dy, 3, 2, "#ffe8a0"); ctx.globalAlpha = 1; }
  }
  function guildhall(ctx, x, y) {
    const c = document.createElement("canvas"), PL = ["#f8e2a8", "#c0925a"], BM = "#5a3a22", OL = "#2e1e14", TILE = ["#d8784a", "#b05634", "#7a3420"];
    c.width = 44; c.height = 40;
    const g = c.getContext("2d"), o = 10, gy = 38, w = 22;
    F(g, o - 1, gy - 11, w + 2, 12, OL); F(g, o, gy - 10, w, 10, PL[0]); F(g, o + w - 5, gy - 10, 5, 10, PL[1]);
    F(g, o, gy - 10, w, 1, BM); F(g, o, gy - 5, w, 1, BM);
    for (const bx of [0, 5, 16, w - 1]) F(g, o + bx, gy - 10, 1, 10, BM);
    Ln(g, o + 1, gy - 6, o + 4, gy - 9, BM); Ln(g, o + 17, gy - 9, o + 20, gy - 6, BM);
    F(g, o + 2, gy - 4, 2, 2, "#ffd46a"); F(g, o + 18, gy - 4, 2, 2, "#e8b84a"); F(g, o + 2, gy - 9, 2, 2, "#ffd46a");
    F(g, o + 8, gy - 6, 6, 6, OL); F(g, o + 9, gy - 5, 4, 5, "#7a4a24"); F(g, o + 11, gy - 5, 1, 5, OL);
    F(g, o + 8, gy - 10, 6, 4, OL); F(g, o + 9, gy - 9, 4, 2, "#a83a2a"); F(g, o + 10, gy - 9, 2, 1, "#f0c040");
    const rh = 12;
    for (let j = 0; j < rh; j++) { const ins = Math.round(j * (w / 2) / rh); F(g, o - 2 + ins, gy - 11 - j, w + 4 - ins * 2, 1, OL); }
    for (let j = 0; j < rh - 1; j++) {
      const ins = Math.round(j * (w / 2) / rh), a = o - 1 + ins, n = w + 2 - ins * 2;
      F(g, a, gy - 11 - j, n, 1, TILE[1]); F(g, a, gy - 11 - j, Math.min(3, n), 1, TILE[0]); F(g, a + n - 2, gy - 11 - j, 2, 1, TILE[2]);
      if (j % 2) for (let xx = a + 1 + (j % 4 === 1 ? 1 : 0); xx < a + n - 1; xx += 3) F(g, xx, gy - 11 - j, 1, 1, TILE[2]);
    }
    F(g, o + 9, gy - 18, 4, 3, OL); F(g, o + 10, gy - 17, 2, 2, "#e0b47a");
    F(g, o + 8, gy - 27, 6, 5, OL); F(g, o + 9, gy - 26, 4, 4, PL[1]); F(g, o + 10, gy - 25, 2, 2, "#2a1e14"); F(g, o + 10, gy - 24, 1, 1, "#e8b84a");
    cone(g, o + 9, gy - 28, 4, TILE, OL);
    pennant(g, o + 11, gy - 37, ["#ec7a5c", "#c8463a"]);
    for (let row = 0; row < c.height; row++) ctx.drawImage(c, 0, row, c.width, 1, x - o - w / 2 + Math.round((gy - row) * 0.17), y - gy + row, c.width, 1);
    Ln(ctx, x + w / 2 + 6, y, x + w / 2 + 1, y - 8, OL); Ln(ctx, x + w / 2 + 5, y, x + w / 2, y - 8, "#8a5a30"); F(ctx, x + w / 2 + 3, y, 5, 1, "#5a3a22");
  }
  function undertaker(ctx, x, y) {
    const OL = "#100e10", WL = ["#6a6866", "#4e4c4a", "#363432"], RF = ["#4a4846", "#2e2c2c", "#1c1a1a"];
    blob(ctx, x, y, 11, 3, "#3e4a3a"); blob(ctx, x - 1, y - 1, 9, 2, "#56604a"); F(ctx, x - 5, y - 3, 6, 1, "#6a7458");
    F(ctx, x - 5, y - 13, 11, 13, OL); F(ctx, x - 4, y - 12, 9, 12, WL[1]); F(ctx, x - 4, y - 12, 2, 12, WL[0]); F(ctx, x + 2, y - 12, 3, 12, WL[2]);
    for (let xx = x - 3; xx < x + 4; xx += 2) F(ctx, xx, y - 12, 1, 12, WL[2]);
    F(ctx, x - 1, y - 5, 3, 5, "#1e1a1a");
    for (let j = 0; j < 9; j++) { const ins = j >> 1; F(ctx, x - 6 + ins, y - 14 - j, 13 - ins * 2, 1, OL); if (j < 8) { F(ctx, x - 5 + ins, y - 14 - j, 11 - ins * 2, 1, RF[1]); F(ctx, x - 5 + ins, y - 14 - j, 2, 1, RF[0]); } }
    F(ctx, x - 1, y - 18, 3, 3, OL); F(ctx, x, y - 17, 1, 1, "#c8d4a0");
    for (const [dx, t] of [[-9, 0], [8, 1], [11, 0]]) { F(ctx, x + dx - 1, y - 6 + t, 3, 5, OL); F(ctx, x + dx, y - 5 + t, 1, 4, "#9a9a92"); }
    F(ctx, x - 12, y - 10, 1, 9, "#2a2620"); F(ctx, x - 13, y - 12, 3, 3, "#2a2620"); F(ctx, x - 12, y - 11, 1, 1, "#ffc860");
    ctx.globalAlpha = 0.25; blob(ctx, x - 12, y - 11, 5, 4, "#ffc860"); ctx.globalAlpha = 1;
    Ln(ctx, x + 15, y, x + 14, y - 16, "#2a2620"); Ln(ctx, x + 14, y - 9, x + 19, y - 14, "#2a2620"); Ln(ctx, x + 14, y - 12, x + 10, y - 17, "#2a2620");
    F(ctx, x + 18, y - 16, 2, 1, "#14141a"); F(ctx, x + 19, y - 17, 1, 1, "#14141a");
  }
  function windmill(ctx, x, y) {
    F(ctx, x - 3, y - 11, 7, 12, "#2e1e14"); F(ctx, x - 2, y - 10, 5, 10, "#e8dcc4"); F(ctx, x - 2, y - 10, 2, 10, "#fff4dc"); F(ctx, x + 2, y - 10, 1, 10, "#b8a888"); F(ctx, x, y - 4, 1, 4, "#5a3a22");
    cone(ctx, x - 2, y - 11, 5, ["#d8784a", "#b05634", "#7a3420"], "#2e1e14");
    for (const [ex, ey] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) {
      for (let t = 1; t <= 7; t++) { const px = x + Math.round(ex * t / 7), py = y - 13 + Math.round(ey * t / 7); F(ctx, px - 1, py - 1, 3, 3, "#2e1e14"); }
    }
    for (const [ex, ey] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) {
      for (let t = 2; t <= 6; t++) { const px = x + Math.round(ex * t / 7), py = y - 13 + Math.round(ey * t / 7); F(ctx, px, py, 1, 1, "#f8eedc"); F(ctx, px + Math.sign(ex), py, 1, 1, t % 2 ? "#d0c0a0" : "#f8eedc"); }
    }
    F(ctx, x - 1, y - 14, 3, 3, "#2e1e14"); F(ctx, x, y - 13, 1, 1, "#c0925a");
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
  // Goblin Town, the season the camp is a town (The Goblin Kingdom): the stockade gate with the king's wooden crown over it
  function crowngate(ctx, x, y) {
    for (const dx of [0, 9]) { F(ctx, x + dx - 1, y - 12, 4, 13, "#2a1c14"); F(ctx, x + dx, y - 11, 2, 12, "#a06e40"); F(ctx, x + dx, y - 11, 1, 12, "#c8935a"); }
    F(ctx, x - 2, y - 13, 15, 3, "#2a1c14"); F(ctx, x - 1, y - 12, 13, 1, "#a06e40");
    F(ctx, x + 2, y - 18, 8, 5, "#2a1c14"); F(ctx, x + 3, y - 16, 6, 2, "#f0c84a");
    for (const dx of [3, 5, 7]) { F(ctx, x + dx, y - 18, 1, 2, "#f0c84a"); F(ctx, x + dx, y - 19, 1, 1, "#2a1c14"); }
    F(ctx, x + 5, y - 15, 1, 1, "#c8302a");
    for (const dx of [2, 7]) { F(ctx, x + dx, y - 10, 3, 5, "#264e22"); F(ctx, x + dx, y - 10, 3, 4, "#5ea84a"); F(ctx, x + dx + 1, y - 8, 1, 1, "#f0c84a"); }
  }
  const LANDMARK = { ironhaven: citadel, thornwall: guildhall, veldrock: headframe, saltmarrow: lighthouse, frosthold: watchtower, carrbridge: tollhouse, hollowood: treehouse, ashfen: undertaker,
                     goblin_camp: crowngate };
  // each town's houses follow its header scene (town_scenes.js): the same walls, roofs and trim, cut down to map scale
  const STYLE = {
    ironhaven: { ol: "#2a2430", wall: ["#f0e6d4", "#c8b89c"], roofs: [[["#7e2228", "#c03c32", "#ec6a54"], 0.55], [["#3e4a68", "#5e6e90", "#8a9ab8"], 1, "slate"]], roof: "hip", tall: 2, door: "#5a3a2a", win: "#4a5a7a", chim: "#a09a94" },
    thornwall: { ol: "#2e1e14", wall: ["#f8e2a8", "#c0925a"], frame: "#5a3a22", roofs: [[["#94682c", "#d0a44c", "#f4d27a"], 0.5, "thatch"], [["#7a3420", "#b05634", "#d8784a"], 1, "slate"]], roof: "hip", door: "#6a3a1c", win: "#ffd46a", chim: "#9a7a5a" },
    veldrock: { ol: "#24242a", wall: ["#c4c2bc", "#7e7c78"], stone: "#96948e", found: "#5a5a54", roofs: [[["#46505e", "#6a7484", "#929cac"], 1]], roof: "slate", door: "#a8542a", win: "#ffc860", chim: "#6a5a54", chimOdds: 0.7, smoke: "#8a8c90" },
    carrbridge: { ol: "#22262a", walls: [["#f4ecd8", "#b8a888"], ["#e8d8c0", "#a89070"], ["#dce4e8", "#9aa4b0"]], roofs: [[["#2a3e6a", "#3e5a94", "#5a7ab8"], 0.4], [["#7a3020", "#b04a34", "#d86a4a"], 0.75], [["#344a36", "#4e6e50", "#6a8a6a"], 1]], roof: "hip", door: "#7a4a24", win: "#4a6a9a", chim: "#9a8a7a" },
    ashfen: { ol: "#1a1e1c", wall: ["#9a8462", "#4a3c2c"], planks: "#6a5640", roofs: [[["#56643e", "#8a9a62", "#b4c08a"], 1]], roof: "hip", stilts: true, door: "#3e3024", win: "#ffd060" },
    hollowood: { ol: "#14100c", wall: ["#c8a068", "#7a5a38"], planks: "#9a7648", roofs: [[["#2e5420", "#78b040", "#b0dc5c"], 1]], roof: "steep", moss: true, perch: 0.5, door: "#5a7a3a", win: "#ffd870" },
    saltmarrow: { ol: "#1a2230", wall: ["#fbf8ee", "#bcb8aa"], roofs: [[["#222e48", "#34466a", "#4e6488"], 0.7, "slate"], [["#6a2c1a", "#a04428", "#c8603a"], 1]], roof: "hip", door: "#3a5a8a", win: "#4a6a9a", chim: "#d0ccc0", chimOdds: 0.5 },
    frosthold: { ol: "#0e1424", wall: ["#8a6448", "#4e3626"], logs: "#6a4a34", roofs: [[["#3e2c20", "#5a4232", "#7a5a44"], 1]], roof: "steep", snow: true, door: "#4a3020", win: "#ffd46a", chim: "#5a5a66", chimOdds: 0.8, smoke: "#c8d0dc" },
    // the goblins' hide huts under thatch, and a few roofs already in the king's green
    goblin_camp: { ol: "#2a1c14", wall: ["#d8b47a", "#9a7444"], planks: "#b08a50", roofs: [[["#6a4a2a", "#a07a44", "#c8a060"], 0.6, "thatch"], [["#264e22", "#5ea84a", "#94c86e"], 1]], roof: "steep", door: "#2a1c14", win: "#ffd060" },
  };
  const PROFILE = { hip: [0, 0, 1, 1, 2], steep: [0, 1, 1, 2, 2, 3, 4], steepW: [0, 1, 1, 2, 2, 3, 3, 4, 5], thatch: [0, 0, 1, 1, 2, 3] };
  function home(ctx, x, y, s, wide, seed, perch) {
    const r = rng(seed), w = wide ? 9 : 7, OL = s.ol;
    x = Math.round(x); y = Math.round(y);
    const pick = r(), opt = s.roofs.find((o) => pick < o[1]) || s.roofs[0], R = opt[0], kind = opt[2] || s.roof;
    const wall = s.walls ? s.walls[Math.floor(r() * s.walls.length)] : s.wall;
    const wh = 4 + (s.tall && r() < 0.6 ? s.tall : 0), chim = s.chim && r() < (s.chimOdds || 0.35);
    const prof = kind === "steep" ? (wide ? PROFILE.steepW : PROFILE.steep) : kind === "thatch" ? PROFILE.thatch : PROFILE.hip, n = prof.length;
    if (s.stilts) {
      F(ctx, x - 1, y + 1, w + 2, 2, "#6aa0a0"); F(ctx, x, y + 2, w, 1, "#88b8b4");
      for (const px of [x, x + w - 1, x + (w >> 1)]) F(ctx, px, y - 3, 1, 5, "#2e2a24");
      F(ctx, x - 2, y - 4, w + 4, 2, OL); F(ctx, x - 1, y - 4, w + 2, 1, "#9a8466");
      y -= 4;
    }
    if (perch) {
      const tx = x + (w >> 1);
      blob(ctx, tx, y - 8 - wh - n, 9, 5, "#163a1e"); blob(ctx, tx - 1, y - 9 - wh - n, 8, 4, "#2e6a32"); blob(ctx, tx - 3, y - 11 - wh - n, 4, 2, "#4a8a3a");
      F(ctx, tx - 2, y - 7, 4, 8, OL); F(ctx, tx - 1, y - 7, 2, 7, "#7e5e3e"); F(ctx, tx - 1, y - 7, 1, 7, "#a0805a");
      F(ctx, tx - 4, y, 3, 1, "#5e4430"); F(ctx, tx + 2, y, 3, 1, "#5e4430");
      F(ctx, x - 2, y - 9, w + 4, 3, OL); F(ctx, x - 1, y - 8, w + 2, 1, "#c8a064");
      F(ctx, x - 2, y - 12, 1, 3, OL); F(ctx, x - 2, y - 13, 1, 1, "#ffd870");
      ctx.globalAlpha = 0.3; blob(ctx, x - 2, y - 13, 3, 2, "#ffe8a0"); ctx.globalAlpha = 1;
      y -= 8;
    }
    const top = y - wh;
    if (s.found) { F(ctx, x - 2, y, w + 4, 2, OL); F(ctx, x - 1, y, w + 2, 1, s.found); }
    F(ctx, x - 1, top - 1, w + 2, wh + 2, OL);
    F(ctx, x, top, w, wh, wall[0]); F(ctx, x + w - 2, top, 2, wh, wall[1]);
    if (s.logs) for (let yy = top + 1; yy < y; yy += 2) F(ctx, x, yy, w, 1, s.logs);
    if (s.planks) for (let xx = x + 1; xx < x + w - 2; xx += 2) F(ctx, xx, top, 1, wh, s.planks);
    if (s.stone) for (let yy = top + 1; yy < y; yy += 2) for (let xx = x + 1 + ((yy - top) & 2); xx < x + w - 1; xx += 4) F(ctx, xx, yy, 1, 1, s.stone);
    if (s.frame) { F(ctx, x, top, w, 1, s.frame); F(ctx, x, top, 1, wh, s.frame); F(ctx, x + w - 3, top, 1, wh, s.frame); F(ctx, x + 1, top + 2, 1, 1, s.frame); }
    F(ctx, x + 2, y - 2, wide ? 2 : 1, 2, s.door); F(ctx, x + w - 4, top + 1, 1, 1, s.win);
    if (wh > 4) { F(ctx, x + 2, top + 1, 1, 1, s.win); F(ctx, x + w - 4, top + 3, 1, 1, s.win); }
    // where the lamps will be lit after dark (the colour kept, so a window a tree was later drawn over stays dark)
    if (T && T.windows) T.windows.push([x + w - 4, top + 1, s.win], [x + 2, y - 2, s.door, 1], ...(wh > 4 ? [[x + 2, top + 1, s.win], [x + w - 4, top + 3, s.win]] : []));
    for (let i = 0; i < n; i++) F(ctx, x - 2 + prof[i], top - 1 - i, w + 4 - prof[i] * 2, 1, OL);
    F(ctx, x - 1 + prof[n - 1], top - 1 - n, w + 2 - prof[n - 1] * 2, 1, OL);
    for (let i = 0; i < n; i++) {
      const a = x - 1 + prof[i], m = w + 2 - prof[i] * 2, yy = top - 1 - i;
      if (s.snow) {
        F(ctx, a, yy, m, 1, i ? "#e6eef8" : R[1]);
        if (i) { F(ctx, a, yy, Math.min(2, m), 1, "#ffffff"); if (m > 3) F(ctx, a + m - 1, yy, 1, 1, "#b4c4e0"); }
        continue;
      }
      F(ctx, a, yy, m, 1, i ? R[1] : R[0]);
      if (!i) continue;
      F(ctx, a, yy, Math.min(2, m), 1, R[2]);
      if (m > 3) F(ctx, a + m - 1, yy, 1, 1, R[0]);
      if (kind === "slate" && i % 2 === 0) for (let xx = a + 2; xx < a + m - 1; xx += 2) F(ctx, xx, yy, 1, 1, R[0]);
      if (kind === "thatch" && i % 2) for (let xx = a + 2 + (i % 4 === 1 ? 0 : 1); xx < a + m - 1; xx += 2) F(ctx, xx, yy, 1, 1, R[0]);
      if (s.moss && m > 3 && r() < 0.7) F(ctx, a + 2 + Math.floor(r() * (m - 3)), yy, 1, 1, "#94d862");
    }
    if (s.snow) for (let xx = x; xx < x + w; xx += 2) F(ctx, xx, top, 1, 1, "#cce4ff");
    if (kind === "thatch") for (let xx = x - 1; xx < x + w + 1; xx += 2) F(ctx, xx, top, 1, 1, R[0]);
    if (chim) {
      const cx = x + w - 3, ct = top - n - 2;
      F(ctx, cx - 1, ct, 3, 5, OL); F(ctx, cx, ct + 1, 1, 4, s.chim);
      if (s.snow) F(ctx, cx - 1, ct - 1, 3, 1, "#ffffff");
      if (s.smoke) puffs(ctx, cx, ct, s.smoke);
    }
  }
  function puffs(ctx, x, y, c) {
    for (const [dx, dy, w, a] of [[0, -3, 2, 0.8], [1, -6, 3, 0.6], [3, -9, 2, 0.4]]) { ctx.globalAlpha = a; F(ctx, x + dx, y + dy, w, 2, c); F(ctx, x + dx + 1, y + dy - 1, w - 1, 1, c); }
    ctx.globalAlpha = 1;
  }
  function field(ctx, fx, fy) { F(ctx, fx - 1, fy - 1, 12, 8, "#8a6a3a"); for (let k = 0; k < 6; k += 2) { F(ctx, fx, fy + k, 10, 1, "#e0c45a"); F(ctx, fx, fy + k + 1, 10, 1, "#b8983a"); } }
  // what sits beside each town in place of a plain field: the trade its header scene shows
  const YARD = {
    thornwall: (ctx, x, y) => { windmill(ctx, x + 8, y - 1); field(ctx, x, y + 1); },
    // the Throne Wagon: a cart, the king's red chair on it and his crown on him
    goblin_camp: (ctx, x, y) => {
      F(ctx, x - 1, y - 2, 13, 3, "#2a1c14"); F(ctx, x, y - 1, 11, 1, "#a06e40");
      for (const wx of [x + 1, x + 8]) { F(ctx, wx, y + 1, 3, 3, "#2a1c14"); F(ctx, wx + 1, y + 2, 1, 1, "#9a6a3a"); }
      F(ctx, x + 3, y - 8, 5, 6, "#2a1c14"); F(ctx, x + 4, y - 7, 3, 5, "#c8302a");
      F(ctx, x + 4, y - 5, 3, 3, "#74a63e"); F(ctx, x + 4, y - 6, 3, 1, "#f0c84a"); F(ctx, x + 4, y - 7, 1, 1, "#f0c84a"); F(ctx, x + 6, y - 7, 1, 1, "#f0c84a");
    },
    frosthold: (ctx, x, y) => {
      F(ctx, x, y - 8, 1, 10, "#3a2414"); F(ctx, x + 11, y - 8, 1, 10, "#3a2414"); F(ctx, x - 1, y - 8, 14, 1, "#6a4a34"); F(ctx, x - 1, y - 9, 14, 1, "#ffffff");
      [["#8a5a34", "#6a4426"], ["#e8e0d0", "#c8beb0"], ["#7a7a84", "#5a5a64"]].forEach(([a, b], i) => { const px = x + 2 + i * 3; F(ctx, px, y - 7, 2, 6, a); F(ctx, px + 1, y - 7, 1, 6, b); F(ctx, px, y - 1, 1, 1, a); });
      for (let i = 0; i < 4; i++) { F(ctx, x + i * 3, y + 3, 3, 3, "#3a2414"); F(ctx, x + 1 + i * 3, y + 4, 1, 1, "#c8a07a"); }
      F(ctx, x, y + 2, 12, 1, "#f4f8ff");
    },
    veldrock: (ctx, x, y) => {
      F(ctx, x - 1, y + 4, 14, 1, "#3a2a20"); for (let k = 0; k < 14; k += 3) F(ctx, x - 1 + k, y + 5, 1, 1, "#5a4028");
      for (const [cx, ore, dk] of [[x, "#d07a3a", "#6a3018"], [x + 7, "#9a9a9e", "#4a4a52"]]) {
        F(ctx, cx, y - 1, 6, 5, "#1c1c22"); F(ctx, cx + 1, y, 4, 3, "#5a5a62"); F(ctx, cx + 1, y, 4, 1, "#7a7a84");
        F(ctx, cx + 1, y - 2, 4, 2, ore); F(ctx, cx + 2, y - 3, 2, 1, ore); F(ctx, cx + 3, y - 1, 1, 1, dk);
        F(ctx, cx + 1, y + 3, 1, 1, "#141414"); F(ctx, cx + 4, y + 3, 1, 1, "#141414");
      }
    },
    carrbridge: (ctx, x, y) => {
      for (const [sx, c] of [[x, "#c8463a"], [x + 7, "#3a6ab0"]]) {
        F(ctx, sx, y - 5, 1, 7, "#5a3a22"); F(ctx, sx + 5, y - 5, 1, 7, "#5a3a22"); F(ctx, sx - 1, y - 7, 8, 1, "#22262a");
        for (let j = 0; j < 8; j++) F(ctx, sx - 1 + j, y - 6, 1, 2, (j >> 1) % 2 ? "#f4ecd8" : c);
        F(ctx, sx, y - 1, 6, 3, "#22262a"); F(ctx, sx + 1, y - 1, 4, 2, "#7a5a34"); F(ctx, sx + 1, y - 1, 4, 1, "#a07a48");
        F(ctx, sx + 1, y - 2, 1, 1, "#e8c040"); F(ctx, sx + 3, y - 2, 1, 1, sx === x ? "#7ac0e8" : "#c84a3a");
      }
    },
    ashfen: (ctx, x, y) => {
      F(ctx, x - 2, y + 3, 15, 3, "#6aa0a0"); F(ctx, x - 1, y + 4, 12, 1, "#88b8b4");
      F(ctx, x - 2, y + 1, 15, 3, "#1a1e1c"); F(ctx, x - 1, y + 2, 13, 1, "#9a8466"); for (let k = 0; k < 13; k += 4) F(ctx, x + k, y + 4, 1, 2, "#2e2a24");
      F(ctx, x + 1, y - 6, 1, 7, "#2e2a24"); F(ctx, x + 8, y - 6, 1, 7, "#2e2a24"); F(ctx, x + 1, y - 6, 8, 1, "#5a4834");
      for (let k = 0; k < 3; k++) { F(ctx, x + 3 + k * 2, y - 5, 1, 4, "#3a4a3a"); F(ctx, x + 3 + k * 2, y - 5, 1, 1, "#6a7a5a"); }
      F(ctx, x + 11, y - 7, 1, 8, "#1a1e1c"); F(ctx, x + 10, y - 9, 3, 3, "#1a1e1c"); F(ctx, x + 11, y - 8, 1, 1, "#ffd060");
      ctx.globalAlpha = 0.25; blob(ctx, x + 11, y - 8, 4, 3, "#ffc860"); ctx.globalAlpha = 1;
    },
    hollowood: (ctx, x, y) => {
      for (let k = 0; k < 3; k++) { F(ctx, x, y + 1 + k * 2, 11, 1, "#4a3420"); for (let j = 0; j < 11; j += 2) F(ctx, x + j + (k % 2), y + k * 2, 1, 1, k === 1 ? "#a8c858" : "#5a9a3a"); }
      for (const [dx, dy, c] of [[1, -2, "#e04a3a"], [5, -1, "#d8b070"], [9, -3, "#e04a3a"], [12, 1, "#e04a3a"]]) {
        F(ctx, x + dx, y + dy, 1, 2, "#f0e8d8"); F(ctx, x + dx - 1, y + dy - 1, 3, 1, c); F(ctx, x + dx, y + dy - 2, 1, 1, c); F(ctx, x + dx - 1, y + dy - 1, 1, 1, "#ffffff");
      }
    },
    saltmarrow: (ctx, x, y) => {
      F(ctx, x - 1, y - 1, 9, 4, "#1a2230"); F(ctx, x, y - 2, 7, 1, "#1a2230"); F(ctx, x, y - 1, 7, 2, "#c84a3a"); F(ctx, x, y - 1, 7, 1, "#e86a5a"); F(ctx, x, y + 1, 7, 1, "#6a2a20");
      F(ctx, x + 9, y - 6, 1, 8, "#5a3a22"); F(ctx, x + 13, y - 6, 1, 8, "#5a3a22"); F(ctx, x + 9, y - 6, 5, 1, "#4a3a2a");
      for (let yy = y - 5; yy < y; yy++) for (let xx = x + 10; xx < x + 13; xx++) if ((xx + yy) % 2 === 0) F(ctx, xx, yy, 1, 1, "#7a6a50");
    },
  };
  // The Dragon Wakes: a town she burned this season has every other house's roof gone to char, picked out as the pixels the house
  // itself drew (whatever its style), with a rafter left standing and an ember in it; the first one's ridge is where the smoke goes up
  const CHARR = ["#24160e", "#3e2618", "#6a4030"];
  function charred(ctx, x, y, draw, seed, id) {
    const x0 = Math.max(0, Math.round(x) - 6), y0 = Math.max(0, Math.round(y) - 36), w = 22, h = Math.round(y) + 4 - y0;
    const before = ctx.getImageData(x0, y0, w, h).data;
    draw();
    const img = ctx.getImageData(x0, y0, w, h), d = img.data, r = rng(seed);
    let top = h, bot = -1;
    for (let i = 0; i < w * h; i++) if (d[i * 4] !== before[i * 4] || d[i * 4 + 1] !== before[i * 4 + 1] || d[i * 4 + 2] !== before[i * 4 + 2]) { top = Math.min(top, (i / w) | 0); bot = Math.max(bot, (i / w) | 0); }
    if (bot < 0) return;
    const roofBot = top + Math.max(2, Math.round((bot - top) * 0.5)), roof = [];
    for (let j = top; j <= roofBot; j++) for (let i = 0; i < w; i++) {
      const q = (j * w + i) * 4;
      if (d[q] === before[q] && d[q + 1] === before[q + 1] && d[q + 2] === before[q + 2]) continue;
      const l = d[q] * 0.3 + d[q + 1] * 0.55 + d[q + 2] * 0.15;
      if (l < 45) continue;
      const c = CHARR[l > 165 ? 2 : l > 105 ? 1 : 0];
      d[q] = parseInt(c.slice(1, 3), 16); d[q + 1] = parseInt(c.slice(3, 5), 16); d[q + 2] = parseInt(c.slice(5, 7), 16);
      roof.push([i, j]);
    }
    ctx.putImageData(img, x0, y0);
    if (!roof.length) return;
    const low = roof.filter((p) => p[1] >= roofBot - 1);
    // one ember to a roof: two side by side read as a pair of eyes in the char
    const p = low[Math.floor(r() * low.length)];
    if (p) F(ctx, x0 + p[0], y0 + p[1], 1, 1, "#f08030");
    const ridge = roof.filter((p) => p[1] === top), rx = ridge.length ? ridge[Math.floor(r() * ridge.length)][0] : roof[0][0];
    F(ctx, x0 + rx, y0 + top - 2, 1, 2, "#1a0e08");
    if (T && T.burnt && !T.burnt[id]) T.burnt[id] = [x0 + rx, y0 + top - 2];
  }
  const burntTowns = () => new Set(((App.L && App.L.dragon) || {}).burned ? App.L.dragon.burned.map((b) => b[1]) : []);
  function townSprites(ctx, sprites, sx, sy, d) {
    const n = d.size === "city" ? 17 : d.size === "town" ? 10 : 6, r = rng(hash(d.id)), spread = d.size === "city" ? 22 : d.size === "town" ? 15 : 11;
    const burnt = burntTowns().has(d.id);
    const lm = LANDMARK[d.id], s = STYLE[d.id], mid = d.id === "ironhaven" || d.id === "thornwall";
    const hole = lm ? (d.size === "city" ? 0.75 : mid ? 0.7 : 0.5) : 0;
    const lx = mid ? sx : sx - spread - 5, ly = mid ? sy : sy - 3;
    if (lm) sprites.push({ y: ly - 1, draw: () => lm(ctx, lx, ly) });
    if (d.id === "thornwall" || d.id === "goblin_camp") palisade(ctx, sprites, sx, sy, spread);
    if (d.id === "ironhaven") ramparts(ctx, sprites, d);
    if (d.size !== "city") {
      const left = r() < 0.5 && !(lm && !mid), fx = sx + (left ? -spread - 12 : spread + 2), fy = sy + 2, yard = YARD[d.id] || field;
      sprites.push({ y: fy - 6, draw: () => yard(ctx, fx, fy) });
    }
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, rr = (hole + (1 - hole) * Math.sqrt(r())) * spread;
      const hx = sx + Math.cos(a) * rr - 3, hy = sy + Math.sin(a) * rr * 0.6 + 2;
      const roof = r() < 0.18 ? "blue" : "red", wide = r() < 0.3, st = d.id === "ashfen", seed = hash(d.id + ":" + k);
      const one = () => s ? home(ctx, hx, hy, s, wide, seed, s.perch && (seed % 100) < s.perch * 100) : house(ctx, hx, hy, roof, wide, st);
      sprites.push({ y: hy, draw: burnt && k % 2 === 1 ? () => charred(ctx, hx, hy, one, seed, d.id) : one });
    }
  }
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
  const p0 = (h) => ((h >> 8) & 1023) / 1024;
  // The Drowned Isle: weed and barnacled rock on the risen ground, Old Marrow's roofless houses, the salvage camp, and the chapel in its pool
  function wrack(ctx, x, y, h) {
    if (h & 1) { F(ctx, x - 2, y - 2, 5, 3, "#3e3a34"); F(ctx, x - 1, y - 3, 3, 2, "#6a665c"); F(ctx, x - 1, y - 3, 1, 1, "#9a968a"); F(ctx, x + 1, y - 2, 1, 1, "#e0dccc"); F(ctx, x - 2, y, 5, 1, "#4e6a3a"); }
    else for (const dx of [-2, 0, 1, 3]) F(ctx, x + dx, y - 2 - ((h >> (dx + 4)) & 1), 1, 3, dx === 1 ? "#7a9a4e" : "#4e6a3a");
  }
  const RUIN = { ol: "#26241f", wall: ["#b8b4a0", "#8e8a78", "#6a6658"], weed: ["#4e6a3a", "#6e8e48"], sand: "#d8c08a", slate: ["#3e4652", "#5a6474"] };
  function ruin(ctx, x, y, seed) {
    const r = rng(seed), w = r() < 0.4 ? 9 : 7, wh = 5 + (r() < 0.4 ? 2 : 0), OL = RUIN.ol;
    x = Math.round(x); y = Math.round(y);
    const top = y - wh;
    F(ctx, x - 1, top - 1, w + 2, wh + 2, OL);
    F(ctx, x, top, w, wh, RUIN.wall[0]); F(ctx, x + w - 2, top, 2, wh, RUIN.wall[1]);
    for (let yy = top + 1; yy < y; yy += 2) for (let xx = x + ((yy - top) & 2); xx < x + w - 1; xx += 3) F(ctx, xx, yy, 1, 1, RUIN.wall[1]);
    if (r() < 0.45) {
      // roofless: a broken gable and a couple of bare rafters
      for (let k = 0; k < 3; k++) { F(ctx, x + k - 1, top - 2 - k, 1, 1, OL); F(ctx, x + k, top - 1 - k, 1, 1, RUIN.wall[0]); }
      Ln(ctx, x + 2, top - 3, x + w, top - 1, "#3a2e24"); Ln(ctx, x + 4, top - 4, x + w + 1, top - 2, "#3a2e24");
    } else {
      const n = 4, R = RUIN.slate;
      for (let i = 0; i < n; i++) F(ctx, x - 2 + (i >> 1), top - 1 - i, w + 4 - (i >> 1) * 2, 1, OL);
      for (let i = 0; i < n - 1; i++) { const a = x - 1 + (i >> 1), m = w + 2 - (i >> 1) * 2; F(ctx, a, top - 1 - i, m, 1, R[1]); F(ctx, a, top - 1 - i, 2, 1, R[0]); }
      const hole = x + 2 + Math.floor(r() * (w - 4));
      F(ctx, hole, top - 3, 2, 2, OL); F(ctx, hole, top - 2, 1, 1, "#3a2e24");
    }
    for (let xx = x - 1; xx < x + w + 1; xx++) if (r() < 0.55) F(ctx, xx, top + (r() < 0.5 ? 0 : 1), 1, 1 + Math.floor(r() * 2), RUIN.weed[(xx + seed) & 1]);
    F(ctx, x + 2, y - 3, 2, 3, "#14120f"); Ln(ctx, x + 4, y - 3, x + 5, y, "#6a4a2a");
    F(ctx, x + w - 3, top + 2, 1, 1, "#14120f");
    F(ctx, x + 1, top + 3, 1, 1, "#e8e4d4"); F(ctx, x + w - 2, y - 2, 1, 1, "#e8e4d4");
    F(ctx, x - 2, y, 4, 1, RUIN.sand); F(ctx, x - 1, y - 1, 2, 1, RUIN.sand); F(ctx, x + w - 1, y, 3, 1, RUIN.sand);
  }
  function tent(ctx, x, y, c) {
    for (let j = 0; j < 6; j++) { F(ctx, x - j - 1, y - 6 + j, j * 2 + 3, 1, "#2a2018"); F(ctx, x - j, y - 6 + j, j * 2 + 1, 1, j % 2 ? "#f0e6cc" : c); }
    F(ctx, x - 6, y, 13, 1, "#2a2018"); F(ctx, x, y - 4, 1, 4, "#2a2018"); F(ctx, x, y - 8, 1, 2, "#5a3a22");
  }
  function handcart(ctx, x, y) {
    F(ctx, x - 1, y - 5, 8, 4, "#2a1e14"); F(ctx, x, y - 4, 6, 2, "#9a6e3e"); F(ctx, x, y - 4, 6, 1, "#b8884e");
    F(ctx, x + 1, y - 6, 2, 1, "#c8963e"); F(ctx, x + 4, y - 6, 1, 1, "#8ab0a0");
    F(ctx, x + 1, y - 1, 3, 2, "#2a1e14"); F(ctx, x + 2, y - 1, 1, 1, "#7a5a34");
    Ln(ctx, x + 7, y - 4, x + 10, y - 1, "#5a3a22");
  }
  function barrelSteps(ctx, x, y) {
    F(ctx, x - 5, y - 2, 11, 3, "#26241f"); F(ctx, x - 4, y - 2, 9, 1, "#b8b4a0"); F(ctx, x - 3, y - 4, 7, 2, "#26241f"); F(ctx, x - 2, y - 4, 5, 1, "#a8a490");
    F(ctx, x - 1, y - 9, 4, 6, "#2a1a10"); F(ctx, x, y - 8, 2, 4, "#a86a34"); F(ctx, x, y - 7, 2, 1, "#5a4a3a"); F(ctx, x, y - 5, 2, 1, "#5a4a3a");
    F(ctx, x + 4, y - 9, 1, 5, "#2a1a10"); F(ctx, x + 3, y - 10, 3, 2, "#2a1a10"); F(ctx, x + 4, y - 10, 1, 1, "#ffd46a");
    ctx.globalAlpha = 0.28; blob(ctx, x + 4, y - 9, 5, 3, "#ffc860"); ctx.globalAlpha = 1;
  }
  function oldMarrow(ctx, sprites, sx, sy, d) {
    const r = rng(hash(d.id)), spread = 13;
    sprites.push({ y: sy + 1, draw: () => barrelSteps(ctx, sx + 1, sy + 1) });
    for (const [dx, dy, c] of [[-spread - 14, 6, "#b84a3a"], [-spread - 6, 9, "#4a6ab0"], [spread + 9, 4, "#b84a3a"]]) sprites.push({ y: sy + dy, draw: () => tent(ctx, sx + dx, sy + dy, c) });
    for (const [dx, dy] of [[spread + 1, 10], [-6, 9]]) sprites.push({ y: sy + dy, draw: () => handcart(ctx, sx + dx, sy + dy) });
    // two drowned streets either side of the inn steps
    [[-19, -5], [-9, -9], [2, -10], [12, -6], [-15, 2], [8, 3]].forEach(([dx, dy], k) => {
      const hx = sx + dx + Math.round(r() * 2) - 4, hy = sy + dy, seed = hash(d.id + ":" + k);
      sprites.push({ y: hy, draw: () => ruin(ctx, hx, hy, seed) });
    });
  }
  function chapel(ctx, sprites, sx, sy) {
    sprites.push({ y: sy + 3, draw: () => {
      const x = Math.round(sx), y = Math.round(sy), OL = "#22201c", ST = ["#c4c0ac", "#a09c88", "#7a7666"], W = ["#4e6a3a", "#6e8e48"];
      blob(ctx, x - 1, y + 1, 18, 4, "#86a8a0"); blob(ctx, x - 1, y + 1, 17, 3, "#6ab2d4"); blob(ctx, x + 1, y + 1, 9, 2, "#78c0dc");
      for (let k = -17; k <= 16; k += 4) F(ctx, x + k, y + 1 + ((k >> 2) & 1 ? 2 : -2), 2, 1, (k >> 2) & 1 ? "#e8f8ff" : "#c4e6fa");
      for (const [gx, gy, cross] of [[13, 0, 1], [17, 2, 0], [-20, 1, 0], [21, -1, 1]]) {
        if (cross) { F(ctx, x + gx - 1, y + gy - 6, 3, 7, OL); F(ctx, x + gx - 2, y + gy - 5, 5, 3, OL); F(ctx, x + gx, y + gy - 5, 1, 5, ST[1]); F(ctx, x + gx - 1, y + gy - 4, 3, 1, ST[1]); }
        else { F(ctx, x + gx - 2, y + gy - 4, 4, 5, OL); F(ctx, x + gx - 1, y + gy - 3, 2, 4, ST[1]); F(ctx, x + gx - 1, y + gy - 3, 1, 1, ST[0]); }
        F(ctx, x + gx - 1, y + gy, 2, 1, W[0]); F(ctx, x + gx, y + gy - 2, 1, 1, "#e8e4d4");
      }
      F(ctx, x - 6, y - 10, 17, 11, OL); F(ctx, x - 5, y - 9, 15, 10, ST[0]); F(ctx, x + 6, y - 9, 4, 10, ST[1]);
      for (let yy = y - 8; yy < y; yy += 2) for (let xx = x - 4 + ((yy & 2) ? 1 : 0); xx < x + 9; xx += 3) F(ctx, xx, yy, 1, 1, ST[1]);
      for (const wx of [x - 2, x + 4]) { F(ctx, wx, y - 7, 2, 4, "#1e2a2a"); F(ctx, wx, y - 8, 1, 1, "#1e2a2a"); F(ctx, wx + 1, y - 6, 1, 1, "#5aa08a"); }
      for (let j = 0; j < 6; j++) { F(ctx, x - 6 + j, y - 11 - j, 17 - j * 2, 1, OL); if (j < 5) { F(ctx, x - 5 + j, y - 11 - j, 15 - j * 2, 1, "#4e5864"); F(ctx, x - 5 + j, y - 11 - j, 2, 1, "#6a7684"); } }
      F(ctx, x + 2, y - 14, 3, 2, OL); F(ctx, x + 3, y - 13, 1, 1, "#3a2e24");
      for (let xx = x - 6; xx < x + 11; xx++) if ((xx * 5 + 3) % 4 < 3) F(ctx, xx, y - 10, 1, 1 + ((xx * 7) % 3 === 0 ? 2 : (xx & 1)), W[xx & 1]);
      const tx = x - 13;
      F(ctx, tx - 1, y - 25, 9, 26, OL); F(ctx, tx, y - 24, 7, 25, ST[0]); F(ctx, tx + 5, y - 24, 2, 25, ST[1]);
      for (let yy = y - 22; yy < y; yy += 3) F(ctx, tx + 1 + ((yy & 1) * 2), yy, 2, 1, ST[2]);
      F(ctx, tx + 2, y - 4, 3, 5, "#14120f"); F(ctx, tx + 2, y - 5, 2, 1, "#14120f");
      F(ctx, tx + 1, y - 21, 5, 6, "#14120f"); F(ctx, tx + 2, y - 22, 3, 1, "#14120f");
      F(ctx, tx + 2, y - 20, 3, 3, "#5aa08a"); F(ctx, tx + 2, y - 20, 1, 3, "#8ad0b4"); F(ctx, tx + 1, y - 17, 5, 1, "#3e7a68"); F(ctx, tx + 3, y - 16, 1, 1, "#c8a040");
      for (let j = 0; j < 7; j++) { F(ctx, tx - 1 + (j >> 1), y - 26 - j, 9 - (j >> 1) * 2, 1, OL); if (j < 6) F(ctx, tx + (j >> 1), y - 26 - j, 7 - (j >> 1) * 2, 1, j < 2 ? "#5aa08a" : "#4e8a78"); }
      F(ctx, tx + 3, y - 34, 1, 3, OL); F(ctx, tx + 2, y - 33, 3, 1, OL);
      for (const [dx, len] of [[0, 4], [2, 2], [4, 5], [6, 3]]) F(ctx, tx + dx, y - 25, 1, len, W[dx & 2 ? 1 : 0]);
      F(ctx, tx + 1, y - 12, 1, 1, "#e8e4d4"); F(ctx, tx + 5, y - 8, 1, 1, "#e8e4d4"); F(ctx, tx + 3, y - 14, 1, 1, "#e8e4d4");
    } });
  }
  const RISEN = { old_marrow: oldMarrow, marrow_chapel: chapel };
  function bridge(ctx, x, y) { F(ctx, x - 6, y - 2, 12, 4, "#3a2616"); F(ctx, x - 5, y - 1, 10, 2, "#a8784a"); for (let k = -5; k < 5; k += 2) F(ctx, x + k, y - 1, 1, 2, "#7a5232"); }

  let terrainCache = null;
  function terrain() { return terrainCache || (terrainCache = render()); }

  // ---------- after dark (a theme's dark sky): the island relit by the moon, colour by colour, with its lamps lit; the names, pins and
  // figures above it are left as they are, so the map still reads ----------
  const isNight = () => !!(App.L && App.L.meta && App.L.meta.sky === "night");
  const moonC = new Map();
  function moonOf(r, g, b) {
    const key = (r << 16) | (g << 8) | b;
    let v = moonC.get(key);
    if (v) return v;
    // a multiply toward night blue, the colour kept a little apart from the grey, so forest, field and sea still read as themselves
    const l = r * 0.3 + g * 0.55 + b * 0.15, s = 0.75, m = [0.42, 0.5, 0.74];
    v = [r, g, b].map((c, i) => Math.round((l + (c - l) * s) * m[i] + 6 * i));
    moonC.set(key, v);
    return v;
  }
  function relit(src, lamps) {
    const cv = document.createElement("canvas");
    cv.width = src.width; cv.height = src.height;
    const c = cv.getContext("2d");
    c.drawImage(src, 0, 0);
    const im = c.getImageData(0, 0, cv.width, cv.height), d = im.data, before = new Uint8ClampedArray(d);
    // what gives its own light (a lighthouse lamp, a lava field, a lantern) keeps its colour
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] && !(d[i] > 240 && d[i + 1] > 110 && d[i + 2] < 150)) { const v = moonOf(d[i], d[i + 1], d[i + 2]); d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; }
    for (const [x, y, col, door] of lamps || []) {
      const i = (y * cv.width + x) * 4, w = rgb(col);
      if (x < 0 || y < 0 || x >= cv.width || y >= cv.height || before[i] !== w[0] || before[i + 1] !== w[1] || before[i + 2] !== w[2]) continue;
      if (door && (x * 7 + y * 3) % 3) continue;
      const lit = rgb(door ? "#c8783a" : (x + y) % 4 ? "#ffd27a" : "#ffb84a");
      d[i] = lit[0]; d[i + 1] = lit[1]; d[i + 2] = lit[2];
    }
    c.putImageData(im, 0, 0);
    return cv;
  }
  let nightTer = null;
  const nightPhase = [];
  function nightCloud(cl) {
    if (cl.night) return cl.night;
    // a night cloud: slate, with the moon along its top; its shadow on the sea stays as it was
    const cv = document.createElement("canvas");
    cv.width = cl.cv.width; cv.height = cl.cv.height;
    const c = cv.getContext("2d");
    c.drawImage(cl.cv, 0, 0);
    const im = c.getImageData(0, 0, cv.width, cv.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 255) continue;
      const l = d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15, v = rgb(l > 252 ? "#8a96b8" : l > 238 ? "#3a4660" : "#2e3850");
      d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2];
    }
    c.putImageData(im, 0, 0);
    return (cl.night = cv);
  }

  function heroPos(h) {
    const S = App.S, xy = (id) => (S.towns[id] || S.wilds[id] || S.dungeons[id] || { xy: [0, 0] }).xy;
    let m;
    if (h.travel) {
      const a = xy(h.travel.from), b = xy(h.travel.to), t = 1 - (h.travel.left / Math.max(1, h.travel.total)) * 0.8 - 0.1;
      m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    } else m = xy(h.loc);
    return project(m[0], m[1]);
  }

  // a roadside place a hero has found (league road_places: {road: [a, b], at}): a tiny pin on the road where it bends, as the road was drawn
  const PIN = { inn: "#c8963e", waystation: "#c8963e", shrine: "#f6ead0", toll: "#c0402c", ferry: "#4a7ab8", ford: "#4a7ab8" };
  function placeXY(p) {
    const S = App.S, nodeById = Object.fromEntries(T.N.map((d) => [d.id, d]));
    const r = S.roads.find(([a, b]) => (a === p.road[0] && b === p.road[1]) || (a === p.road[1] && b === p.road[0]));
    if (!r || !nodeById[r[0]] || !nodeById[r[1]]) return null;
    const A = nodeById[r[0]].xy, B = nodeById[r[1]].xy, t = r[0] === p.road[0] ? p.at : 1 - p.at;
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, wob = (T.n2(A[0] / 9, B[1] / 9) - 0.5) * 14, bend = Math.sin(t * Math.PI) * wob;
    return project(A[0] + (B[0] - A[0]) * t - ((B[1] - A[1]) / len) * bend, A[1] + (B[1] - A[1]) * t + ((B[0] - A[0]) / len) * bend);
  }
  function roadPins(ctx, k) {
    for (const p of App.L.road_places || []) {
      const xy = placeXY(p);
      if (!xy) continue;
      const x = Math.round(xy[0] * k), y = Math.round(xy[1] * k), s = k;
      if (window.RoadArt && RoadArt.drawPin) { RoadArt.drawPin(ctx, p.kind, x, y, k); continue; }
      ctx.fillStyle = "#2a1b11"; ctx.fillRect(x - 2 * s, y - 5 * s, 4 * s, 4 * s); ctx.fillRect(x - s / 2, y - 2 * s, s, 2 * s);
      ctx.fillStyle = PIN[p.kind] || "#b4bcc4"; ctx.fillRect(x - s, y - 4 * s, 2 * s, 2 * s);
    }
  }

  // map marks as pixels, never text: phones turn symbols like a cross, a sun or a snowflake into colour emoji
  const MARK = {
    cross: { rows: ["..#..", "#####", "..#..", "..#..", "..#..", "..#.."] },
    closed: { line: true, pal: { r: "#c0402c", R: "#e8644a" }, rows: ["rr...rr", "rRr.rRr", ".rRrRr.", "..rRr..", ".rRrRr.", "rRr.rRr", "rr...rr"] },
    sun: { pal: { y: "#e8b23a", Y: "#fff2b0", o: "#f6d77a" }, rows: ["....y....", ".y.....y.", "...ooo...", "..oYYYo..", "y.oYYYo.y", "..oYYYo..", "...ooo...", ".y.....y.", "....y...."] },
    cloudy: { pal: { w: "#f4f6f8", g: "#b8c4cc" }, rows: ["...ww....", ".wwwwww..", "wwwwwwwww", "wwwwwwwww", ".ggggggg."] },
    rain: { pal: { w: "#c8d0d8", g: "#8a96a2", b: "#5aa0e0" }, rows: ["...ww....", ".wwwwww..", "wwwwwwwww", ".ggggggg.", ".b..b..b.", "b..b..b.."] },
    storm: { pal: { w: "#9aa2ac", g: "#6a7280", y: "#ffd84a" }, rows: ["...ww....", ".wwwwww..", "wwwwwwwww", ".ggggggg.", "....yy...", "...yy....", "....y...."] },
    fog: { pal: { f: "#e4e8ec" }, rows: [".fffffff.", ".........", "fffffff..", ".........", "..fffffff"] },
    snow: { pal: { s: "#f4fbff", S: "#a8d0ec" }, rows: ["...s...", ".s.s.s.", "..sss..", "sssSsss", "..sss..", ".s.s.s.", "...s..."] },
    heat: { pal: { r: "#e8502a", y: "#ffb030", Y: "#fff0a0" }, rows: ["..r..", ".rr..", ".rrr.", "rryrr", "ryyyr", "ryYyr", ".rrr."] },
    // the smoke still going up off a town the dragon burned this season (its roofs are charred in the terrain itself)
    smoke: { pal: { S: "#bab2a8", s: "#7a7268", e: "#f08030" }, rows: [".SSS.....", "SSsSS.SS.", ".SssSSsS.", "..SsssS..", "...sss...", "...ss....",
      "..ss.....", "..s......", "..ss.....", "...s.....", "...e....."] },
    comet: { pal: { c: "#a8c8e8", y: "#ffd84a", Y: "#fff6d0" }, rows: ["......yy.", "...c.yYYy", ".cc.yYYYy", "cc..yYYy.", ".....yy.."] },
    // where heroes sleep tonight (the Tonight view): a campfire by the road or in the wilds, a tent at a lair's door, a lantern below ground
    fire: { line: true, pal: { r: "#e8502a", y: "#ffb030", Y: "#fff0a0", b: "#6a4428" }, rows: ["...r...", "..ryr..", ".ryYyr.", ".ryYyr.", "b.b.b.b", ".bbbbb."] },
    tent: { line: true, pal: { t: "#c8a060", T: "#e8c890", d: "#3a2616" }, rows: ["...t...", "..tTt..", ".tTdTt.", "tTTdTTt", "ttTdTtt"] },
    lantern: { line: true, pal: { k: "#2a1b11", y: "#ffd84a", Y: "#fff6d0" }, rows: ["..kkk..", ".k...k.", "kkkkkkk", "kyYYYyk", "kyYYYyk", "kkkkkkk"] },
    // the League's muster: a red war banner on a pole where everyone is called
    banner: { line: true, pal: { p: "#5a3a1e", r: "#b8302a", R: "#e8604a", y: "#f0c850" }, rows: ["p......", "prrRRr.", "prRyyR.", "prrRRr.", "prr.rr.", "p......", "p......"] },
  };
  MARK.clear = MARK.sun;
  MARK.moon = { pal: { m: "#f0e8c8", M: "#c8c0a0" }, rows: ["..mmm..", ".mm....", "mm.....", "mM.....", "mM.....", ".mM..m.", "..mMMm."] };
  // a weather sign under a dark sky is lit by the moon like the land under it; only what gives its own light (a bolt, the heat) keeps
  // its colour, and a clear night shows the moon, not the sun
  const nightMarks = new Map();
  function nightMark(kind) {
    if (kind === "clear") return MARK.moon;
    const m = MARK[kind];
    if (!m || nightMarks.has(kind)) return nightMarks.get(kind) || m;
    const pal = {};
    for (const [ch, hex] of Object.entries(m.pal)) {
      const [r, g, b] = rgb(hex);
      // the rest goes to the night clouds' slate, darker as it was darker, with its own hue (rain's blue) kept a little
      const l = (r * 0.3 + g * 0.55 + b * 0.15) / 255, lo = [46, 56, 80], hi = [160, 172, 210];
      pal[ch] = r > 240 && g > 110 && b < 150 ? hex : "#" + [r, g, b].map((c, i) => Math.round(lo[i] + (hi[i] - lo[i]) * l + (c - l * 255) * 0.25)).map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
    }
    const out = Object.assign({}, m, { pal });
    nightMarks.set(kind, out);
    return out;
  }
  // a mark centred on (x, y) at px canvas pixels per pixel; col paints a one-colour mark, and a dark line rings the ones that sit on open ground
  function mark(ctx, m, x, y, px, col) {
    const w = m.rows[0].length, h = m.rows.length, x0 = Math.round(x - (w * px) / 2), y0 = Math.round(y - (h * px) / 2);
    const on = (i, j) => j >= 0 && j < h && i >= 0 && i < w && m.rows[j][i] !== ".";
    if (m.line) {
      ctx.fillStyle = "#1a100a";
      for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
        if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) ctx.fillRect(x0 + i * px, y0 + j * px, px, px);
      }
    } else if (!col) {
      ctx.fillStyle = "rgba(20,16,10,0.4)";
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (on(i, j)) ctx.fillRect(x0 + (i + 1) * px, y0 + (j + 1) * px, px, px);
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!on(i, j)) continue;
      ctx.fillStyle = col || m.pal[m.rows[j][i]] || "#fff"; ctx.fillRect(x0 + i * px, y0 + j * px, px, px);
    }
  }

  function drawMap(cv, opts) {
    opts = opts || {};
    const k = opts.small ? 1 : 2, night = isNight();
    let ter = terrain();
    if (night) { if (!nightTer || nightTer.src !== ter) nightTer = { src: ter, cv: relit(ter, T.windows) }; ter = nightTer.cv; }
    const phaseAt = (p) => (night ? nightPhase[p] || (nightPhase[p] = relit(phase(p))) : phase(p));
    cv.width = TW * k; cv.height = TH * k; cv._k = k;
    const base = document.createElement("canvas");
    base.width = cv.width; base.height = cv.height;
    const bctx = base.getContext("2d");
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(ter, 0, 0, TW * k, TH * k);
    // pins, labels and figures go on a clear sheet above the moving water and clouds
    const over = document.createElement("canvas");
    over.width = cv.width; over.height = cv.height;
    const ctx = over.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const S = App.S, L = App.L, placed = [], groups = {}, extra = {};
    const nights = {};
    for (const h of L.heroes) {
      if (!h.alive) continue;
      const [x, y] = heroPos(h), key = Math.round(x) + "," + Math.round(y);
      const sl = opts.tonight && h.sleep;
      if (sl && !nights[key]) {
        const m = sl.setting === "dungeon" ? "lantern" : sl.gate ? "tent" : sl.setting === "camp" ? "fire" : null;
        if (m) nights[key] = [x, y, m];
      }
      const off = (groups[key] = (groups[key] || 0) + 1) - 1;
      if (off >= 3) { extra[key] = [x, y, off - 2]; continue; }
      const g = Art.heroGrid(h, 0, App.heroLook(h)), hs = k, fan = [[0, 0], [-10, -4], [10, -4]][off];
      const hx = x * k - (g.w * hs) / 2 + fan[0] * hs, hy = y * k - g.h * hs + 2 * hs + fan[1] * hs;
      placed.push({ h, g, x: hx + (g.w * hs) / 2, y: hy + (g.h * hs) / 2, r: 12 * hs, hx, hy, z: fan[1] });
    }
    placed.sort((a, b) => a.z - b.z);
    const phone = !opts.small && window.innerWidth < 700;
    // canvas pixels per css pixel where the map is shown: marks are sized for the screen, never below the map's own pixel
    const scr = cv.clientWidth ? cv.width / cv.clientWidth : 1;
    const mpx = (css, cells) => Math.max(k, Math.round((css * scr) / cells));
    const hy = L.hyper;
    let beast = null;
    if (hy && hy.kind === "megabeast" && hy.loc && S.monsters[hy.body]) {
      const xy = (S.towns[hy.loc] || S.wilds[hy.loc] || S.dungeons[hy.loc] || {}).xy;
      if (xy) {
        const [x, y] = project(xy[0], xy[1]), g = Art.monsterGrid(Object.assign({}, S.monsters[hy.body], { boss: true }), 0);
        beast = { g, x, y, hx: Math.round(x * k - g.w * k / 2), hy: Math.round((y - 4) * k - g.h * k) };
      }
    }
    // The Dragon Wakes: the dragon over where she is down (or the muster town she waits above), her flight so far, and what she burned.
    // She is sized for the screen like the marks (a phone shrinks the island to a third), kept inside the canvas, and set beside the
    // place, never on it (lower and further out when the top edge would cut her off)
    const dw = L.dragon, xyOf = (id) => (S.towns[id] || S.wilds[id] || S.dungeons[id] || {}).xy;
    let drake = null;
    const dg = dw && dw.at && xyOf(dw.at) ? dragonGrid(dw.monster) : null;
    if (dg) {
      const [x, y] = project(...xyOf(dw.at)), ds = Math.max(k, mpx(phone ? 58 : 92, dg.w)), w = dg.w * ds, h = dg.h * ds;
      let hx = x * k + 7 * k, hy = (y - 14) * k - h * 0.6;
      if (hy < 2 * k) { hx = x * k + 14 * k; hy = y * k - h * 0.7; }
      if (hx + w > cv.width - 2 * k) hx = x * k - 14 * k - w;
      hx = Math.max(2 * k, Math.min(cv.width - w - 2 * k, hx)); hy = Math.max(2 * k, Math.min(cv.height - h - 2 * k, hy));
      drake = { g: dg, ds, x, y, hx: Math.round(hx), hy: Math.round(hy), cv: dg.toCanvas(ds) };
    }
    // where the figures' drawn pixels are, so a name can step aside instead of hiding under one
    const solid = (g, x, y) => {
      let x0 = g.w, y0 = g.h, x1 = -1, y1 = -1;
      for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.px[j * g.w + i]) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
      return x1 < 0 ? null : [x + x0 * k, y + y0 * k, (x1 - x0 + 1) * k, (y1 - y0 + 1) * k];
    };
    for (const p of placed) p.box = solid(p.g, p.hx, p.hy);
    const figs = placed.map((p) => p.box).concat(beast ? [solid(beast.g, beast.hx, beast.hy)] : [], drake ? [[drake.hx, drake.hy, drake.g.w * drake.ds, drake.g.h * drake.ds]] : []).filter(Boolean);
    const paint = () => {
      ctx.clearRect(0, 0, over.width, over.height);
      // lowest: the roadside pins, just above the roads, so names and figures always cover them
      if (!opts.small) roadPins(ctx, k);
      if (!opts.small && S.regions && L.weather) {
        ctx.globalAlpha = 0.9;
        // a sign keeps clear of the roadside pins, the places and their names, and the figures, as the names do: it takes the nearest
        // free spot round its region's middle, so it never reads as a pin's shadow
        const keep = (App.L.road_places || []).map(placeXY).filter(Boolean).map(([x, y]) => [x * k - 4 * k, y * k - 7 * k, 8 * k, 8 * k])
          .concat(T.N.map((d) => { const [x, y] = project(d.xy[0], d.xy[1]); return [x * k - 16 * k, y * k - 22 * k, 32 * k, 40 * k]; }), figs);
        const hit = (a, b, s) => keep.some((o) => a < o[0] + o[2] && o[0] < a + s && b < o[1] + o[3] && o[1] < b + s);
        for (const [r, nodesIn] of Object.entries(S.regions)) {
          const pts = nodesIn.map((id) => (S.towns[id] || S.wilds[id] || S.dungeons[id] || {}).xy).filter(Boolean);
          const m = night ? nightMark(L.weather[r]) : MARK[L.weather[r]];
          if (!pts.length || !m) continue;
          const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
          const [x, y] = project(cx, cy), px = mpx(10, 9), s = 9 * px + 2 * k;
          const spots = [[0, -14], [0, -26], [14, -14], [-14, -14], [0, -2], [22, -20], [-22, -20], [26, -6], [-26, -6], [0, -38]].map(([dx, dy]) => [(x + dx) * k, (y + dy) * k]);
          const [sx, sy] = spots.find(([a, b]) => !hit(a - s / 2, b - s / 2, s)) || spots[0];
          keep.push([sx - s / 2, sy - s / 2, s, s]);
          mark(ctx, m, sx, sy, px);
        }
        ctx.globalAlpha = 1;
      }
      if (hy && hy.kind === "comet" && hy.loc) {
        const xy = (S.towns[hy.loc] || S.wilds[hy.loc] || S.dungeons[hy.loc] || {}).xy;
        if (xy) { const [x, y] = project(xy[0], xy[1]); mark(ctx, MARK.comet, x * k, (y - 14) * k, mpx(16, 9)); }
      }
      const dawn = (L.factions || {}).dawn;
      if (!opts.small && dawn && dawn.loc && dawn.loc !== "ironhaven") {
        const xy = (S.towns[dawn.loc] || S.wilds[dawn.loc] || S.dungeons[dawn.loc] || {}).xy;
        if (xy) { const [x, y] = project(xy[0], xy[1]); mark(ctx, MARK.sun, (x + 10) * k, (y - 20) * k, mpx(12, 9)); }
      }
      if (dw && !opts.small) {
        // her flight so far, stepped as square dots on the map's own pixel grid
        const pts = [dw.lair].concat((dw.path || []).map((p) => p[1])).map(xyOf).filter(Boolean).map((xy) => project(...xy));
        // in a deep oxblood, not ember orange, and stopped short of a town she burned, so the dots never run into its embers
        const dot = mpx(2.5, 1), gap = dot * 4, clear = 28 * k;
        const burntAt = [...new Set((dw.burned || []).map((b) => b[1]))].filter((id) => S.towns[id] && xyOf(id)).map((id) => project(...xyOf(id)).map((v) => v * k));
        for (let i = 1; i < pts.length; i++) {
          const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay) * k;
          for (let s = 0; s < len; s += gap) {
            const px = Math.round((ax * k + ((bx - ax) * k * s) / len) / dot) * dot, py = Math.round(((ay - 6) * k + ((by - ay) * k * s) / len) / dot) * dot;
            if (burntAt.some(([tx, ty]) => Math.hypot(px - tx, py - ty + 6 * k) < clear)) continue;
            ctx.fillStyle = "rgba(30,10,6,0.8)"; ctx.fillRect(px - k, py - k, dot + 2 * k, dot + 2 * k);
            ctx.fillStyle = "#8a2e1c"; ctx.fillRect(px, py, dot, dot);
          }
        }
        for (const id of new Set((dw.burned || []).map((b) => b[1]))) {
          if (id === dw.at || !xyOf(id)) continue;
          const [x, y] = project(...xyOf(id));
          const at = S.towns[id] && T.burnt && T.burnt[id], sp = mpx(phone ? 11 : 15, 9);
          if (at) mark(ctx, MARK.smoke, at[0] * k + sp, at[1] * k - (MARK.smoke.rows.length * sp) / 2 + sp, sp);
          else if (!S.towns[id]) mark(ctx, MARK.heat, (x - 9) * k, (y - 13) * k, mpx(9, 7));
        }
        if (dw.muster && dw.muster.town && xyOf(dw.muster.town)) {
          const [x, y] = project(...xyOf(dw.muster.town));
          mark(ctx, MARK.banner, (x - 42) * k, (y - 8) * k, mpx(phone ? 11 : 20, 7));
        }
      }
      for (const [id, until] of Object.entries(L.closed || {})) {
        if (until <= L.meta.day) continue;
        const xy = (S.wilds[id] || {}).xy;
        if (xy) { const [x, y] = project(xy[0], xy[1]); mark(ctx, MARK.closed, x * k, (y - 14) * k, mpx(10, 9)); }
      }
      // her heat on the ground under the names and figures: a stepped disc in her own pixels
      if (drake) {
        const { g, ds, hx, hy } = drake, cx = g.w / 2, cy = g.h / 2, r = Math.max(g.w, g.h) * 0.62;
        for (const [rr, a] of [[r, 0.12], [r * 0.7, 0.16]]) {
          ctx.fillStyle = `rgba(255,120,40,${a})`;
          for (let j = Math.floor(cy - rr); j <= Math.ceil(cy + rr); j++) for (let i = Math.floor(cx - rr * 1.2); i <= Math.ceil(cx + rr * 1.2); i++)
            if (((i - cx) / 1.2) ** 2 + (j - cy) ** 2 <= rr * rr && (i + j) % 2 === 0) ctx.fillRect(hx + i * ds, hy + j * ds, ds, ds);
        }
      }
      // on a phone the map is shrunk to the screen, so labels are sized for the screen: about 11px tall where they land
      const shrink = phone && cv.clientWidth ? cv.width / cv.clientWidth : 0;
      const fs = opts.small ? 11 : phone ? (shrink ? Math.round(10 * shrink) : 30) : 13;
      const taken = [];
      const busy = new Set(L.heroes.filter((h) => h.alive && !h.travel).map((h) => h.loc));
      const fontOf = (kind) => `${kind === "town" ? 600 : 400} ${kind === "town" ? fs + 2 : fs}px "League Five", "Pixelify Sans", monospace`;
      const cp = Math.max(1, Math.round((fs * 0.7) / 6));
      // a risen layer's places (the Drowned Isle's) are new to everyone this season, so each keeps its name, the wild too, and a phone
      // drops them no sooner than a dungeon's
      const rank = { town: 0, dungeon: 1, wild: 2 }, rk = (d) => (d.layer ? Math.min(1, rank[d.kind]) : rank[d.kind] ?? 3);
      const labels = [], late = [];
      for (const d of phone ? T.N.slice().sort((a, b) => rk(a) - rk(b)) : T.N) {
        if (opts.small && d.kind !== "town") continue;
        if (d.kind === "wild" && !busy.has(d.id) && !d.layer) continue;
        const [px, py] = project(d.xy[0], d.xy[1]);
        const slain = d.kind === "dungeon" && ((L.dungeons || {})[d.id] || {}).boss_alive === false;
        ctx.font = fontOf(d.kind);
        const cw = slain ? 5 * cp + Math.round(fs / 3) : 0, tw = Math.ceil(ctx.measureText(d.name).width), w = tw + cw + 10, h = fs + 6;
        const x = Math.max(w / 2 + 2, Math.min(cv.width - w / 2 - 2, px * k));
        labels.push({ d, slain, cw, tw, w, h, x0: Math.round(x - w / 2), y0: Math.round((py + (d.kind === "town" ? 8 : 6)) * k) });
      }
      const meets = (a, b, w, h, r, g) => a < r[0] + r[2] + g && r[0] < a + w + g && b < r[1] + r[3] + g / 2 && r[1] < b + h + g / 2;
      for (const lb of labels) {
        const { d, slain, cw, tw, w, h } = lb;
        let { x0, y0 } = lb;
        const clash = (a, b) => phone && taken.some((r) => meets(a, b, w, h, r, 4));
        // figures are drawn over the names: a name a figure would cover steps down or aside, clear of every figure and the other
        // names' own spots, by the least it can; above would bury the town's own buildings, and with nowhere to go it stays put
        const under = figs.filter((f) => meets(x0, y0, w, h, f, 2));
        let boxed = false;
        if (under.length) {
          const l = Math.min(...under.map((f) => f[0])), r = Math.max(...under.map((f) => f[0] + f[2])), b = Math.max(...under.map((f) => f[1] + f[3]));
          // a phone gives up a wild's name first, so a moving name only keeps clear of the towns' and dungeons' spots there
          const homes = labels.filter((o) => o !== lb && (!phone || o.d.kind !== "wild")).map((o) => [o.x0, o.y0, o.w, o.h]);
          const fit = ([a, c]) => a >= 2 && a + w <= cv.width - 2 && c + h <= cv.height - 2 && !figs.some((f) => meets(a, c, w, h, f, 2)) &&
            !homes.some((o) => meets(a, c, w, h, o, 4)) && !clash(a, c);
          // beside the figures at its own height, or a half or a whole line up or down when a neighbour's name is in the way there
          // (a dungeon's name may go above them too: its camp or cave mouth is small enough to read round a label)
          const t = Math.min(...under.map((f) => f[1]));
          const best = [[x0, b + 3]].concat(...[0, h / 2, -h / 2, h, -h].map((dy) => [[l - w - 4, Math.round(y0 + dy)], [r + 4, Math.round(y0 + dy)]]),
            d.kind === "dungeon" ? [[x0, t - h - 3]] : []).filter(fit).sort((p, q) => Math.hypot(p[0] - x0, p[1] - y0) - Math.hypot(q[0] - x0, q[1] - y0))[0];
          if (best && Math.hypot(best[0] - x0, best[1] - y0) < 3 * h + w / 2) [x0, y0] = best;
          else {
            // boxed in by figures on both sides (a phone's names are wide): slide along its own row to where the least of it is covered
            const cover = (a) => figs.reduce((s, f) => s + Math.max(0, Math.min(a + w, f[0] + f[2]) - Math.max(a, f[0])) * Math.max(0, Math.min(y0 + h, f[1] + f[3]) - Math.max(y0, f[1])), 0);
            let bx = x0, bc = cover(x0);
            for (let a = Math.max(2, x0 - w / 2); a <= Math.min(cv.width - w - 2, x0 + w / 2); a += 2) {
              const c = cover(a);
              if (c < bc && !homes.some((o) => meets(a, y0, w, h, o, 4)) && !clash(a, y0)) { bc = c; bx = a; }
            }
            x0 = Math.round(bx);
            // and with no way out at all its name is drawn over the figures, so it can still be read
            boxed = bc > 0;
          }
        }
        // a crowded phone map keeps the towns and drops whatever would sit on top of them; the panel below names every place
        if (clash(x0, y0)) continue;
        taken.push([x0, y0, w, h]);
        const draw = () => {
          ctx.font = fontOf(d.kind);
          ctx.fillStyle = "#2a1b11"; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
          ctx.fillStyle = d.kind === "town" ? "#f1e3c2" : d.kind === "dungeon" ? "#e8cfc0" : "#dfe6c4"; ctx.fillRect(x0, y0, w, h);
          ctx.fillStyle = d.kind === "town" ? "#c8963e" : "rgba(0,0,0,0)"; ctx.fillRect(x0, y0 + h - 2, w, 2);
          const ink = d.kind === "dungeon" ? "#8e2a22" : d.kind === "wild" ? "#3a5a2a" : "#2e2116";
          ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(d.name, x0 + 5 + tw / 2, y0 + h / 2 + 1);
          // a dungeon whose boss is slain: a small cross after its name
          if (slain) mark(ctx, MARK.cross, x0 + 5 + tw + cw - 2.5 * cp, y0 + h / 2, cp, ink);
        };
        if (boxed) late.push(draw); else draw();
      }
      // under the heroes' feet in the Tonight view: what kind of night each group has
      for (const [x, y, m] of Object.values(nights)) mark(ctx, MARK[m], (x - 11) * k, (y + 2) * k, mpx(15, 7));
      // highest: the figures, a megabeast and then the heroes, over every name and pin
      if (beast) {
        ctx.fillStyle = "rgba(160,20,20,0.35)"; ctx.beginPath(); ctx.arc(beast.x * k, (beast.y - 6) * k, 22 * k, 0, Math.PI * 2); ctx.fill();
        ctx.drawImage(beast.g.toCanvas(k), beast.hx, beast.hy);
      }
      for (const p of placed) {
        ctx.fillStyle = "rgba(20,30,20,0.35)";
        ctx.beginPath(); ctx.ellipse(p.x, p.hy + p.g.h * k - 2 * k, 8 * k, 2.5 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.drawImage(p.g.toCanvas(k), Math.round(p.hx), Math.round(p.hy));
      }
      for (const [x, y, c] of Object.values(extra)) {
        const bx = Math.round(x * k + 16 * k), by = Math.round(y * k - 30 * k);
        ctx.fillStyle = "#2a1b11"; ctx.fillRect(bx - 1, by - 1, 12 * k + 2, 8 * k + 2);
        ctx.fillStyle = "#8e2a22"; ctx.fillRect(bx, by, 12 * k, 8 * k);
        ctx.fillStyle = "#ffe9b8"; ctx.font = `600 ${7 * k}px "League Five", "Pixelify Sans", monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("+" + c, bx + 6 * k, by + 4 * k + 1);
      }
      for (const draw of late) draw();
      // the dragon over everything, the heroes included
      if (drake) ctx.drawImage(drake.cv, drake.hx, drake.hy);
    };
    paint();
    const water = { z: 0, draw: (c, t) => { c.imageSmoothingEnabled = false; c.drawImage(phaseAt(Math.floor(t * 2.5) % PH), 0, 0, TW * k, TH * k); } };
    const sky = { z: 1, draw: (c, t) => {
      c.imageSmoothingEnabled = false;
      for (const cl of T.clouds) c.drawImage(night ? nightCloud(cl) : cl.cv, Math.round((cloudAt(cl, t) - cl.ox) * k), Math.round((cl.y - cl.oy) * k), cl.cv.width * k, cl.cv.height * k);
    } };
    if (cv.anim) cv.anim.stop();
    const show = () => {
      if (cv.anim && cv.anim.draw) { cv.anim.draw(cv.anim.still); return; }
      const c = cv.getContext("2d"); c.drawImage(base, 0, 0); water.draw(c, 0); sky.draw(c, 0); c.drawImage(over, 0, 0);
    };
    if (window.Anim) Anim.stage(cv, base, [water, sky], { over, fps: 8, still: 0 });
    else show();
    // the road art loads late: the whole sheet is painted again with its pins, so they stay under the names and figures
    if (!opts.small && !window.RoadArt && (L.road_places || []).length) App.roadArt().then(() => { if (window.RoadArt && cv.isConnected) { paint(); show(); } }, () => {});
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

  // the found places' pins on a drawn map, in its canvas pixels: { p (league road_places row), x, y (the pin's point), cy (its head's middle) }
  function pinsOn(cv) {
    const k = cv._k || 2;
    const R = window.RoadArt, px = R && R.pinPx ? R.pinPx(cv.getContext("2d"), k) : k, up = R && R.PIN ? (R.PIN.tipY - 5) * px : 3 * k;
    return (App.L.road_places || []).map((p) => { const xy = placeXY(p); return xy && { p, x: xy[0] * k, y: xy[1] * k, cy: xy[1] * k - up }; }).filter(Boolean);
  }
  // The Dragon Wakes: her sprite cropped to her body with a dark rim, so she reads against snow and roofs (the map and a place's header)
  function dragonGrid(monster, frame) {
    const m = App.S.monsters[monster];
    if (!m) return null;
    const g = Art.monsterGrid(Object.assign({}, m, { boss: true }), frame || 0);
    let x0 = g.w, y0 = g.h, x1 = -1, y1 = -1;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < 0) return null;
    const c = new Art.Grid(x1 - x0 + 3, y1 - y0 + 3);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) c.set(x - x0 + 1, y - y0 + 1, g.get(x, y));
    c.outline("#1a0a06");
    return c;
  }
  // a place's header scene while she is down there: she sits on a roof she burned (the scene's `perch`), or up on the skyline, breathing,
  // wings shifting, with embers rising off her
  function dragonActs(dw, W, scene) {
    const fr = [0, 1].map((f) => dragonGrid(dw.monster, f)).filter(Boolean).map((g) => g.toCanvas(1));
    if (!fr.length || !window.Anim) return [];
    const p = scene && scene.perch, x = p ? p[0] : Math.round(W * 0.7), y = p ? Math.max(p[1], 2 + fr[0].height) : 4 + fr[0].height;
    const her = { z: 900, front: true, draw(ctx, t) {
      const c = fr[Math.floor(t * 1.5) % fr.length], bob = Math.round(Math.sin(t * 1.3));
      ctx.drawImage(c, x - (c.width >> 1), y - c.height + bob);
    } };
    return [Anim.embers({ x0: x - 14, x1: x + 14, y: y - 4, n: 7, rise: 22, front: true, z: 901 }), her];
  }
  window.Isle = { drawMap, dragonGrid, dragonActs, nearestNode, project, pinsOn, TW, TH, tree, pine, rock, house, SURF };
})();
