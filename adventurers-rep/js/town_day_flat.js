/* Town day sets seen side-on, like the road and dungeon scenes: a row of house fronts face-on with sky above, the ground along the bottom, the cast in a row at a readable size; TownSets.build hands the sets registered here to TownFlat.build. */
/*
  TownFlat.register(name, fn(k)) -> the set draws with the flat camera. k is the iso sets' k (S, th, r, L, town, hour, wx, festival, season,
    lights, candles, smoke, anims, npc, walkers) with pixel coordinates throughout: x across, y the foot line (GY at the back of the ground,
    H at the front). spot(name, x, y, face, mode), crowd([[x, y, face, mode]]), walk([[x0, y0], [x1, y1]]), add(y, cv) for a piece that
    stands with its foot at y (sorted with the cast), and the painters below.
  The stage keeps the acts' (u, v) so they play unchanged: iso(u, v) = [OX + (u - v) * XS, GY + (u + v) * YS], a lateral move reads as a
  walk along the street and depth as a step toward the viewer.
*/
(function (root) {
  "use strict";
  const R = Math.round, W = 192, H = 108, OX = 96, GY = 66, XS = 8, YS = 1.6;
  const Tv = () => root.Tavern;
  const K = () => root.TownSets.kit;
  const FLAT = {};

  function stage() {
    const iso = (u, v) => [OX + (u - v) * XS, GY + (u + v) * YS];
    const toUV = (x, y) => { const a = (x - OX) / XS, b = (y - GY) / YS; return [(a + b) / 2, (b - a) / 2]; };
    const canvas = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
    return { W, H, OX, OY: GY, GY, flat: true, iso, toUV, up: (p, h) => [p[0], p[1] - h], canvas };
  }

  // ---------- painters ----------
  // the sky above the roofs: the hour's gradient, sun or moon, the weather's clouds, and a far roofline in the haze
  function sky(k, horizon) {
    const { ctx, L, wx, r, hour, S } = k, { mix, glow, pix, shade } = K();
    for (let y = 0; y < horizon; y++) { ctx.fillStyle = mix(L.sky[0], L.sky[1], Math.min(1, y / horizon)); ctx.fillRect(0, y, W, 1); }
    if (L.night) for (let i = 0; i < 34; i++) { ctx.fillStyle = r() < 0.6 ? "#e8e4d0" : "#9aa8d0"; ctx.fillRect(R(r() * W), R(r() * horizon * 0.7), 1, 1); }
    const grey = ["rain", "storm", "fog", "cloudy"].includes(wx);
    if (!grey) {
      if (L.night) { pix(ctx, 160, 8, [".xx.", "xxyx", "xxxx", ".xx."], { x: "#f4ecc8", y: "#fffbe8" }); glow(ctx, 162, 10, 12, "#c8d0f0", 0.2); }
      else {
        const sx = 20 + Math.max(0, Math.min(1, (hour - 6) / 13)) * 150, sy = 22 - Math.sin(Math.max(0, Math.min(1, (hour - 6) / 13)) * Math.PI) * 15;
        glow(ctx, sx, sy, 18, "#fff4c8", 0.5); ctx.fillStyle = "#fff8e0"; ctx.fillRect(R(sx) - 2, R(sy) - 2, 5, 5); ctx.fillRect(R(sx) - 3, R(sy) - 1, 7, 3);
      }
    }
    const nc = grey ? 6 : 3, cc = grey ? (wx === "storm" ? "#5a5e6c" : "#9aa0aa") : L.night ? "#2a3250" : "#f4f6fa";
    for (let i = 0; i < nc; i++) {
      const cx = r() * W, cy = 3 + r() * horizon * 0.45, w = 16 + r() * 26;
      for (let j = 0; j < 4; j++) { ctx.fillStyle = j === 3 ? shade(cc, -0.15) : cc; ctx.fillRect(R(cx + j * w * 0.18), R(cy - Math.sin((j / 3) * Math.PI) * 3), R(w * 0.55), 3 + (j === 3 ? 1 : 0)); }
    }
    // the town beyond: roofs and a spire or two, pale with distance
    const far = mix(S.roof[2], L.sky[1], 0.55), farD = mix(S.roof[0], L.sky[1], 0.45);
    let x = -6;
    while (x < W) {
      const w = 16 + R(r() * 18), h = 10 + R(r() * 10), base = horizon;
      ctx.fillStyle = farD; ctx.fillRect(x, base - h, w, h);
      for (let j = 0; j < R(w / 2); j++) { ctx.fillStyle = far; ctx.fillRect(x + j, base - h - j, w - j * 2, 1); }
      if (r() < 0.18) { ctx.fillStyle = farD; ctx.fillRect(x + (w >> 1) - 1, base - h - 18, 3, 18); for (let j = 0; j < 6; j++) ctx.fillRect(x + (w >> 1) - 1 + (j >> 2), base - h - 18 - j, 3 - (j >> 1), 1); }
      if (L.lamps && r() < 0.4) { ctx.fillStyle = "#f4c870"; ctx.fillRect(x + 3 + R(r() * (w - 6)), base - h + 3, 1, 1); }
      x += w - 2;
    }
  }

  const SIGNS = {
    mug: [".xxx.", "xyyxx", "xyyx.x", "xyyxx", ".xxx."], loaf: [".xxxx.", "xyyyyx", "xyyyyx", ".xxxx."], shoe: ["x...x", "xy.yx", "xy.yx", ".xyx."],
    scroll: ["xxxxx", "xyyyx", "xyxyx", "xyyyx", "xxxxx"], fish: ["..x...", ".xyx.x", "xyyyxx", ".xyx.x", "..x..."], key: [".xx..", "x..x.", ".xxxxx", "....x"],
    pot: ["xxxxx", "xyyyx", "xyyyx", ".xxx."], boot: [".xx..", ".xx..", ".xxxx", "xxxxx"], star: ["..x..", "xxyxx", ".xyx.", "x...x"], hat: ["..xx..", ".xyyx.", "xxxxxx"],
  };
  // a hanging sign on an iron bracket out from the wall, its picture on a board in the town's colours
  function sign(k, x, y, pic) {
    const { ctx, S } = k, { shade, pix } = K();
    ctx.fillStyle = "#2a1a10"; ctx.fillRect(x - 1, y - 1, 13, 1); ctx.fillRect(x - 1, y - 1, 1, 3); ctx.fillRect(x + 2, y, 1, 3); ctx.fillRect(x + 9, y, 1, 3);
    ctx.fillStyle = shade(S.trim, -0.4); ctx.fillRect(x, y + 2, 12, 10);
    ctx.fillStyle = S.trim; ctx.fillRect(x + 1, y + 3, 10, 8);
    ctx.fillStyle = shade(S.trim, 0.25); ctx.fillRect(x + 1, y + 3, 10, 1);
    pix(ctx, x + 3, y + 4, SIGNS[pic] || SIGNS.star, { x: "#2a1a10", y: "#f4e4b0" });
  }

  // a run of house fronts face-on from x0 to x1 standing on the line `base`: walls in the town's own material, roofs gabled or eaved, two
  // floors of shuttered windows (some lit after dark), doors with steps and lamps, a shop sign or two, chimneys smoking; returns each door's x
  function houses(k, x0, x1, base, o) {
    o = o || {};
    const { ctx, S, r, L } = k, { shade, mix, h01, frac, wallOf } = K(), mat = wallOf(S), doors = [];
    let x = x0;
    let n = 0;
    while (x < x1) {
      const w = Math.min(x1 - x, (o.widths && o.widths[n]) || 34 + R(r() * 14)), hh = (o.heights && o.heights[n]) || 34 + R(r() * 10), top = base - hh;
      const tint = n % 2 ? -0.06 : 0.02;
      for (let yy = top; yy < base; yy++) for (let xx = x; xx < x + w; xx++) { ctx.fillStyle = shade(mat((xx - x0) / 8, base - yy), tint); ctx.fillRect(xx, yy, 1, 1); }
      // grime at the foot, the shadow of the house next door, a string course between floors
      for (let yy = base - 4; yy < base; yy++) { ctx.fillStyle = `rgba(20,12,8,${0.08 * (yy - base + 5)})`; ctx.fillRect(x, yy, w, 1); }
      ctx.fillStyle = "rgba(20,12,8,0.22)"; ctx.fillRect(x + w - 2, top, 2, hh);
      if (hh > 30) { ctx.fillStyle = shade(S.stone[0], 0.05); ctx.fillRect(x, base - 20, w, 1); ctx.fillStyle = shade(S.stone[0], -0.3); ctx.fillRect(x, base - 19, w, 1); }
      // the roof: a gable end to the street, or the eaves along it
      const rc = S.roof, gable = (o.gables != null ? o.gables : n % 3 !== 1), rh = gable ? Math.min(20, R(w / 2) + 2) : 11;
      for (let j = 0; j < rh; j++) {
        const inset = gable ? R((j * (w + 4)) / 2 / rh) : R(j * 0.6), y = top - 1 - j, a = x - 2 + inset, b = x + w + 2 - inset;
        for (let xx = a; xx < b; xx++) {
          let c;
          if (S.snow && j > rh - 4 - (h01(xx, 1) > 0.5 ? 1 : 0)) c = j === rh - 1 ? "#f4f8fc" : "#dfe6f0";
          else if (S.thatch) c = h01(xx, j >> 1) > 0.7 ? shade(rc[0], 0.12) : j % 3 < 1 ? rc[1] : rc[0];
          else { const row = j >> 1, kk = (xx + (row % 2 ? 2 : 0)) >> 2; c = j % 2 === 0 ? shade(rc[1], -0.18) : (xx + (row % 2 ? 2 : 0)) % 4 === 0 ? rc[1] : rc[Math.floor(h01(row, kk) * rc.length)]; if (S.moss && h01(kk, row) > 0.75) c = mix(c, "#6a8a3a", 0.5); }
          if (gable && (xx === a || xx === b - 1)) c = shade(S.timber, -0.1);
          ctx.fillStyle = c; ctx.fillRect(xx, y, 1, 1);
        }
      }
      ctx.fillStyle = shade(rc[1], -0.45); ctx.fillRect(x - 2, top - 1, w + 4, 1);
      if (S.snow) { ctx.fillStyle = "#f4f8fc"; ctx.fillRect(x - 2, top - 2, w + 4, 1); }
      // a chimney, its smoke drawn live
      if (o.chimney !== false && r() < 0.75) {
        const cx = x + 4 + R(r() * (w - 12)), cy = top - (gable ? R(rh * (1 - Math.abs(cx - x - w / 2) / (w / 2 + 2))) : rh) - 6;
        for (let yy = cy; yy < cy + 10; yy++) for (let xx = cx; xx < cx + 5; xx++) { ctx.fillStyle = (yy - cy) % 3 === 0 ? S.mortar : h01(xx, yy) > 0.5 ? S.stone[0] : S.stone[1]; ctx.fillRect(xx, yy, 1, 1); }
        ctx.fillStyle = shade(S.stone[0], -0.35); ctx.fillRect(cx - 1, cy, 7, 2);
        k.smoke.push([cx + 2, cy - 1]);
      }
      // windows: two floors, shuttered, a window box below the upper ones; some glow after dark
      const door = o.doors === false ? null : x + R(w * (n % 2 ? 0.28 : 0.68));
      const cols = Math.max(1, Math.floor(w / 15));
      for (let i = 0; i < cols; i++) {
        const wx = x + R(((i + 0.5) * w) / cols) - 3;
        for (const wy of hh > 30 ? [top + 5, base - 17] : [top + 6]) {
          if (door != null && Math.abs(wx + 3 - door) < 9 && wy > base - 20) continue;
          const glowing = L.lamps && r() < 0.6;
          ctx.fillStyle = shade(S.trim, -0.45); ctx.fillRect(wx - 1, wy - 1, 9, 11);
          for (let yy = 0; yy < 9; yy++) { const t = yy / 9; ctx.fillStyle = glowing ? (t > 0.5 ? "#ffe0a0" : "#f4b860") : L.night ? "#1a2238" : t < 0.35 ? "#a8c4dc" : "#4a6a8a"; ctx.fillRect(wx, wy + yy, 7, 1); }
          ctx.fillStyle = shade(S.trim, -0.45); ctx.fillRect(wx + 3, wy, 1, 9); ctx.fillRect(wx, wy + 4, 7, 1);
          if (!glowing && !L.night) { ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillRect(wx + 1, wy + 1, 1, 2); ctx.fillRect(wx + 5, wy + 1, 1, 1); }
          for (const sx of [wx - 4, wx + 8]) for (let yy = 0; yy < 9; yy++) { ctx.fillStyle = yy % 3 === 0 ? shade(S.trim, -0.3) : S.trim; ctx.fillRect(sx, wy + yy, 3, 1); }
          ctx.fillStyle = shade(S.stone[0], 0.15); ctx.fillRect(wx - 2, wy + 9, 11, 1);
          if (o.flowers !== false && wy < base - 20 && r() < 0.7) {
            ctx.fillStyle = shade(S.timber, 0.1); ctx.fillRect(wx - 1, wy + 10, 9, 2);
            for (let j = 0; j < 8; j++) { ctx.fillStyle = S.snow ? "#dfe6f0" : ["#d84a5a", "#f0c040", "#5a9a3a", "#e86a9a", "#4a8a3a"][(j + i + n) % 5]; ctx.fillRect(wx - 1 + j, wy + 9 - (j % 2), 1, 1); }
          }
          if (glowing) k.lights.push({ x: wx + 3, y: wy + 10, r: 20, k: 0.45 });
        }
      }
      if (door != null) {
        doors.push(door);
        ctx.fillStyle = shade(S.trim, -0.45); ctx.fillRect(door - 6, base - 18, 13, 18);
        for (let yy = base - 17; yy < base; yy++) for (let xx = door - 5; xx < door + 6; xx++) { ctx.fillStyle = (xx - door + 5) % 4 === 0 ? shade(S.door, -0.3) : yy < base - 15 ? shade(S.door, 0.12) : S.door; ctx.fillRect(xx, yy, 1, 1); }
        if (S.wall === "stone" || S.wall === "brick") { ctx.fillStyle = shade(S.trim, -0.45); ctx.fillRect(door - 5, base - 18, 2, 1); ctx.fillRect(door + 4, base - 18, 2, 1); }
        ctx.fillStyle = "#e8c060"; ctx.fillRect(door + 3, base - 9, 1, 1);
        ctx.fillStyle = shade(S.stone[1], 0.1); ctx.fillRect(door - 7, base - 1, 15, 2); ctx.fillStyle = shade(S.stone[1], -0.25); ctx.fillRect(door - 7, base + 1, 15, 1);
        if (L.lamps && n % 2 === 0) {
          ctx.fillStyle = "#2a1a10"; ctx.fillRect(door + 8, base - 19, 3, 1); ctx.fillRect(door + 10, base - 19, 1, 2);
          ctx.fillStyle = "#3a2a1a"; ctx.fillRect(door + 9, base - 17, 3, 4); ctx.fillStyle = "#ffe08a"; ctx.fillRect(door + 10, base - 16, 1, 2);
          k.lights.push({ x: door + 10, y: base - 10, r: 22, k: 0.5 });
        }
        if (o.signs && o.signs[n]) sign(k, door + (n % 2 ? 6 : -18), base - 31, o.signs[n]);
      }
      x += w;
      n++;
    }
    return doors;
  }

  // the ground from the house line to the front: a kerb of flags, then the town's cobbles, earth, boards, grass or snow; darker toward the front
  function ground(k, kind) {
    const { ctx, S, town, L } = k, { shade, groundOf, F, h01 } = K();
    const g = kind === "grass" ? grass(k) : kind === "earth" ? F.noise(["#b49a6a", "#a68c5e", "#98804e"], 5) : groundOf(S, town);
    for (let y = GY - 2; y < H; y++) {
      const v = (y - GY + 2) / 3.2, sc = 1 + (y - GY) / 60;
      for (let x = 0; x < W; x++) { ctx.fillStyle = shade(g((x - OX) / (7 * sc) + 40, v), (y - GY) / (H - GY) * -0.12); ctx.fillRect(x, y, 1, 1); }
    }
    if (kind !== "grass") {
      for (let x = 0; x < W; x++) { ctx.fillStyle = shade(S.stone[(x >> 3) % 2], 0.08); ctx.fillRect(x, GY - 2, 1, 3); if (x % 8 === 0) { ctx.fillStyle = shade(S.stone[1], -0.3); ctx.fillRect(x, GY - 2, 1, 3); } }
      ctx.fillStyle = shade(S.stone[1], -0.35); ctx.fillRect(0, GY + 1, W, 1);
    }
    if (S.snow) for (let i = 0; i < 260; i++) { const x = R(h01(i, 7) * W), y = R(GY + h01(i, 8) * (H - GY)); ctx.fillStyle = "#eef2f8"; ctx.fillRect(x, y, 2 + (i % 3), 1); }
    if (S.damp || k.wx === "rain" || k.wx === "storm") for (let i = 0; i < 9; i++) { const x = R(h01(i, 3) * W), y = R(GY + 8 + h01(i, 4) * (H - GY - 10)), w = 8 + R(h01(i, 5) * 10); ctx.fillStyle = L.night ? "rgba(90,110,150,0.4)" : "rgba(150,175,200,0.45)"; ctx.fillRect(x, y, w, 2); ctx.fillRect(x + 2, y - 1, w - 4, 1); }
  }
  function grass(k) {
    const { S } = k, { h01 } = K(), cols = S.snow ? ["#eef2f8", "#e2e8f2", "#d4dce8"] : ["#6aa040", "#5a9036", "#7ab04a"];
    return (u, v) => { const n = h01(Math.floor(u * 5), Math.floor(v * 3)); return n > 0.93 && !S.snow ? ["#e8d040", "#e86a8a", "#f4f4f0"][Math.floor(n * 100) % 3] : n > 0.6 ? cols[2] : n > 0.25 ? cols[0] : cols[1]; };
  }

  // ---------- props that stand on the ground, each its own piece sorted with the cast ----------
  function prop(k, y, draw) { const cv = k.piece(); draw(cv.getContext("2d")); k.add(y, cv); }
  function barrel(k, x, y) {
    const { shade } = K();
    prop(k, y, (c) => {
      for (let j = 0; j < 12; j++) { const w = j < 2 || j > 9 ? 8 : 9; c.fillStyle = j === 2 || j === 9 ? "#3a3a40" : j % 3 ? "#8a5a32" : "#7a4e2a"; c.fillRect(x - (w >> 1), y - 12 + j, w, 1); }
      c.fillStyle = shade("#8a5a32", 0.25); c.fillRect(x - 3, y - 11, 1, 10); c.fillStyle = "#5a3a1e"; c.fillRect(x - 4, y - 13, 8, 1);
    });
  }
  function crate(k, x, y, col) {
    const { shade } = K(), c0 = col || "#a07a48";
    prop(k, y, (c) => {
      c.fillStyle = shade(c0, -0.35); c.fillRect(x - 6, y - 10, 12, 10);
      c.fillStyle = c0; c.fillRect(x - 5, y - 9, 10, 8);
      c.fillStyle = shade(c0, -0.2); c.fillRect(x - 5, y - 6, 10, 1); c.fillRect(x - 5, y - 3, 10, 1);
      c.fillStyle = shade(c0, 0.2); c.fillRect(x - 5, y - 9, 10, 1);
    });
  }
  function bench(k, x, y, w) {
    const { shade } = K(), wd = "#7a5232";
    prop(k, y, (c) => {
      c.fillStyle = shade(wd, -0.35); c.fillRect(x - (w >> 1) + 1, y - 5, 2, 5); c.fillRect(x + (w >> 1) - 3, y - 5, 2, 5);
      c.fillStyle = wd; c.fillRect(x - (w >> 1), y - 7, w, 2); c.fillStyle = shade(wd, 0.25); c.fillRect(x - (w >> 1), y - 7, w, 1);
      c.fillStyle = shade(wd, -0.2); c.fillRect(x - (w >> 1), y - 13, w, 2); c.fillRect(x - (w >> 1) + 1, y - 13, 1, 6); c.fillRect(x + (w >> 1) - 2, y - 13, 1, 6);
    });
  }
  function lampPost(k, x, y) {
    prop(k, y, (c) => {
      c.fillStyle = "#2a2a30"; c.fillRect(x, y - 30, 2, 30); c.fillRect(x - 2, y - 2, 6, 2);
      c.fillStyle = "#3a3a44"; c.fillRect(x - 2, y - 36, 6, 6); c.fillStyle = k.L.lamps ? "#ffe08a" : "#a8b0b8"; c.fillRect(x - 1, y - 35, 4, 4);
      c.fillStyle = "#2a2a30"; c.fillRect(x - 3, y - 37, 8, 1);
    });
    if (k.L.lamps) k.lights.push({ x: x + 1, y: y - 30, r: 34, k: 0.6 });
  }

  // ---------- building a flat set ----------
  function build(set, o, base) {
    const { S, L } = base, kit = K(), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const st = stage(), ctx = cv.getContext("2d"), r = Art.rng(Art.hash(String(o.seed || "") + set + base.town));
    const uv = (x, y, face, mode) => { const [u, v] = st.toUV(x, y); return mode ? [u, v, face || 1, mode] : [u, v, face || 1]; };
    const k = Object.assign({}, base, {
      st, ctx, r, W, H, GY, hour: base.hour, wx: base.weather, festival: !!o.festival, season: o.season,
      things: [], spots: {}, crowdAt: [], walkers: [], lights: [], candles: [], smoke: [], anims: [], snores: [], overs: [],
      piece: () => st.canvas(),
      add: (y, c) => k.things.push({ key: (y - GY) / YS, cv: c }),
      spot: (name, x, y, face, mode) => { k.spots[name] = uv(x, y, face, mode); },
      crowd: (xs) => { k.crowdAt = xs.map(([x, y, f, m]) => uv(x, y, f, m)); },
      walk: (paths) => { k.walkers = paths.map(([a, b]) => [uv(a[0], a[1]).slice(0, 2), uv(b[0], b[1]).slice(0, 2)]); },
      sky: (horizon) => sky(k, horizon), houses: (x0, x1, b, oo) => houses(k, x0, x1, b, oo), ground: (kind) => ground(k, kind), sign: (x, y, pic) => sign(k, x, y, pic),
      barrel: (x, y) => barrel(k, x, y), crate: (x, y, c) => crate(k, x, y, c), bench: (x, y, w) => bench(k, x, y, w || 18), lampPost: (x, y) => lampPost(k, x, y), prop: (y, fn) => prop(k, y, fn),
    });
    FLAT[set](k);
    k.things.sort((a, b) => a.key - b.key);
    const shine = (L.lamps || L.night) ? Tv().lighting(W, H, null) : null;
    return {
      W, H, st, set, town: base.town, hour: base.hour, weather: base.weather, night: L.night, lamps: L.lamps, outdoor: true, flat: true, bg: cv, things: k.things,
      spots: k.spots, crowd: k.crowdAt, walkers: k.walkers, npc: k.npc || null, S, th: base.th, L,
      compose(c, t, still, items) { k.things.map((th) => ({ key: th.key, draw: () => c.drawImage(th.cv, 0, 0) })).concat(items).sort((a, b) => a.key - b.key).forEach((d) => d.draw()); },
      amb(c, t, still) {
        for (const a of k.anims) a(c, t, still);
        for (const [x, y] of k.smoke) for (let i = 0; i < 5; i++) {
          const ph = kit.frac(t * 0.18 + i / 5);
          c.globalAlpha = (1 - ph) * 0.45; c.fillStyle = L.night ? "#6a6e80" : "#d8d8d8";
          c.fillRect(R(x + Math.sin(ph * 5 + i) * 2 + ph * 6) - 1, R(y - ph * 20), 2 + R(ph * 3), 2 + R(ph * 2));
        }
        c.globalAlpha = 1;
      },
      over(c, t, still) {
        for (const f of k.overs) f(c, t, still);
        for (const [x, y] of k.candles) Tv().candle(c, R(x), R(y), t, 0.8, 3);
        if (L.tint) { c.fillStyle = `rgba(${[1, 3, 5].map((i) => parseInt(L.tint[0].slice(i, i + 2), 16)).join(",")},${L.tint[1]})`; c.fillRect(0, 0, W, H); }
        if (shine) shine(c, t, k.lights, L.night ? 0.36 : 0.62);
        root.TownSets.weather(c, t, still, base.weather, true);
      },
    };
  }

  function register(name, fn) { FLAT[name] = fn; root.TownSets.register(name, () => {}, true); }
  root.TownFlat = { build, register, has: (name) => !!FLAT[name], W, H, GY, OX, XS, YS, kit: { houses, ground, sky, sign, barrel, crate, bench, lampPost, prop, SIGNS } };
})(typeof window !== "undefined" ? window : globalThis);
