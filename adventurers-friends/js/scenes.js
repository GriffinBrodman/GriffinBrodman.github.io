/* Backdrops, story vignettes and the world map, all drawn as pixel art at native resolution. */
(function () {
  "use strict";
  const { ramp, mix, rng, hash } = Art;

  function noise2(seed) {
    const r = rng(seed);
    const N = 64, tab = [];
    for (let i = 0; i < N * N; i++) tab.push(r());
    const at = (x, y) => tab[((y % N + N) % N) * N + ((x % N + N) % N)];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const s = (t) => t * t * (3 - 2 * t);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
    };
  }
  function fbm(n, x, y) { return n(x, y) * 0.6 + n(x * 2.1, y * 2.1) * 0.3 + n(x * 4.3, y * 4.3) * 0.1; }

  const BIOME = {
    plains: { ground: ["#5a8a3a", "#6a9a42", "#4a7a32"], sky: ["#2a2050", "#5a3a6a", "#c86a5a"], far: "#3a3054" },
    forest: { ground: ["#3a6a2a", "#2a5a2a", "#4a7a32"], sky: ["#1a2040", "#3a3a5a", "#7a5a6a"], far: "#1a3a2a" },
    marsh: { ground: ["#4a5a3a", "#3a4a32", "#5a6a3a"], sky: ["#2a2a3a", "#4a4a5a", "#7a7a6a"], far: "#2a3a30" },
    hills: { ground: ["#7a7a4a", "#6a6a42", "#8a8a5a"], sky: ["#2a2a50", "#5a4a6a", "#d88a5a"], far: "#4a3a4a" },
    snow: { ground: ["#d8e0e8", "#c0c8d8", "#e8eef4"], sky: ["#1a2a4a", "#3a5a7a", "#9ab8d0"], far: "#6a7a9a" },
    coast: { ground: ["#d8c890", "#c8b880", "#e0d0a0"], sky: ["#1a3050", "#3a6a8a", "#e8a07a"], far: "#2a5a7a" },
    volcanic: { ground: ["#3a2a2a", "#4a3030", "#2a2020"], sky: ["#1a0a10", "#4a1a1a", "#c84a2a"], far: "#2a1418" },
  };
  const SKY = {
    plains: ["#6ab8ec", "#a8daf4", "#e8f4f0"], forest: ["#72b8e0", "#acd8ec", "#e0f0e4"], hills: ["#7ab8e4", "#b8dcf0", "#f4ead0"],
    snow: ["#8cb4e0", "#c4daf0", "#f0f4fa"], coast: ["#5ab0ec", "#9cd6f6", "#e4f4f8"], marsh: ["#8aa4b4", "#b4c8c4", "#d8e0cc"],
    volcanic: ["#3a2028", "#7a3a34", "#d0784e"],
  };
  const CAVE = {
    cave: ["#3a3040", "#2a2230", "#4a4050"], undead: ["#2a3034", "#1e2428", "#3a4248"], swamp: ["#2a3a2a", "#1e2a1e", "#3a4a32"],
    ice: ["#5a7a9a", "#4a6a8a", "#8ab0d0"], fire: ["#4a2020", "#3a1818", "#6a2a20"], sea: ["#1a3a4a", "#12303e", "#2a4a5a"],
    goblin: null, beast: null,
  };

  function interior(kind, W, H, r) {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const F = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    const floor = Math.round(H * 0.62) + 2;
    if (kind === "jail") {
      F(0, 0, W, floor, "#5a5866");
      for (let y = 0; y < floor; y += 6) for (let x = (y / 6) % 2 ? -5 : 0; x < W; x += 10) { F(x, y, 9, 5, r() < 0.5 ? "#6e6c7a" : "#64626f"); F(x, y, 9, 1, "#7e7c8a"); }
      F(0, floor, W, H - floor, "#3e3c46");
      for (let x = 0; x < W; x += 3) if (r() < 0.3) F(x, floor + Math.floor(r() * (H - floor)), 2, 1, "#4a4854");
      const wx = Math.floor(W * 0.3);
      F(wx, 8, 16, 12, "#2a2834"); F(wx + 1, 9, 14, 10, "#8ab4dc");
      for (let k = 0; k < 4; k++) F(wx + 2 + k * 4, 9, 1, 10, "#2a2834");
      const dx = Math.floor(W * 0.6), dw = Math.floor(W * 0.32);
      F(dx - 2, 2, dw + 4, floor + 2, "#2a2630"); F(dx, 4, dw, floor - 2, "#24222c");
      for (let x = dx + 2; x < dx + dw; x += 6) { F(x, 4, 2, floor - 2, "#3a3844"); F(x, 4, 1, floor - 2, "#8a8898"); }
      F(dx, 12, dw, 2, "#3a3844"); F(dx, 12, dw, 1, "#8a8898"); F(dx + dw - 8, 22, 4, 4, "#c8a040");
      return cv;
    }
    for (let x = 0; x < W; x += 6) { F(x, 0, 6, floor, r() < 0.5 ? "#6e4628" : "#644024"); F(x, 0, 1, floor, "#42281a"); }
    for (let y = 10; y < floor; y += 14) F(0, y, W, 1, "#4a2e1c");
    for (let y = floor; y < H; y += 3) { F(0, y, W, 3, (y / 3) % 2 ? "#8e5c34" : "#83542f"); F(0, y, W, 1, "#a06c40"); }
    for (let x = 0; x < W; x += 17) F(x + ((x / 17) % 2) * 8, floor, 1, H - floor, "#5a3820");
    const wx = Math.floor(W * 0.08);
    F(wx, 6, 22, 16, "#3a2414"); F(wx + 2, 8, 18, 12, "#8ac4ec"); F(wx + 2, 16, 18, 4, "#6aa83a"); F(wx + 10, 8, 2, 12, "#3a2414"); F(wx + 2, 13, 18, 1, "#3a2414");
    const sx = Math.floor(W * 0.55);
    for (const y of [8, 18]) {
      F(sx, y + 6, 70, 2, "#3a2414");
      for (let k = 0; k < 9; k++) { const c = ["#5a8a3a", "#8a3a2a", "#c8a040", "#3a5a8a"][k % 4]; F(sx + 3 + k * 7, y + 1, 3, 5, c); F(sx + 4 + k * 7, y, 1, 1, c); F(sx + 3 + k * 7, y + 1, 1, 2, "#f0e0c0"); }
    }
    const by = floor - 12;
    F(sx - 6, by, W - sx + 6, 13, "#4a2c18"); F(sx - 6, by, W - sx + 6, 3, "#7a4a28"); F(sx - 6, by, W - sx + 6, 1, "#a8703c");
    for (let x = sx; x < W; x += 12) F(x, by + 4, 1, 9, "#3a2214");
    for (const [bx, s] of [[W * 0.42, 1], [W * 0.47, 0]]) { F(bx, floor - 10 + s * 2, 9, 10, "#3a2214"); F(bx + 1, floor - 9 + s * 2, 7, 8, "#8a5a30"); F(bx + 1, floor - 7 + s * 2, 7, 1, "#5a5a62"); F(bx + 1, floor - 3 + s * 2, 7, 1, "#5a5a62"); }
    const lx = Math.floor(W * 0.3);
    F(lx, 0, 1, 7, "#2a1a10"); F(lx - 2, 7, 5, 5, "#2a1a10"); F(lx - 1, 8, 3, 3, "#ffd86a");
    const g = ctx.createRadialGradient(lx, 10, 0, lx, 10, 40);
    g.addColorStop(0, "rgba(255,200,110,0.35)"); g.addColorStop(1, "rgba(255,200,110,0)");
    ctx.fillStyle = g; ctx.fillRect(lx - 40, 0, 80, 50);
    const tx = Math.floor(W * 0.62);
    F(tx, H - 9, 34, 3, "#3a2214"); F(tx, H - 9, 34, 1, "#a8703c"); F(tx + 3, H - 6, 2, 6, "#3a2214"); F(tx + 29, H - 6, 2, 6, "#3a2214");
    F(tx + 8, H - 12, 3, 3, "#c8c0b0"); F(tx + 20, H - 12, 3, 3, "#c8a040");
    return cv;
  }

  function backdrop(kind, W, H, seed) {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const r = rng(seed || 7);
    const P = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    const F = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    if (kind === "tavern" || kind === "jail") return interior(kind, W, H, r);
    const cave = CAVE[kind];
    const horizon = Math.round(H * 0.62);
    if (cave) {
      const mortar = mix(cave[1], "#000000", 0.45);
      F(0, 0, W, horizon, mortar);
      for (let y = 0, row = 0; y < horizon; y += 7, row++) for (let x = row % 2 ? -7 : 0; x < W; x += 14) {
        const base = mix(r() < 0.5 ? cave[0] : cave[2], "#000000", 0.25 * (1 - y / horizon));
        F(x + 1, y + 1, 12, 5, base);
        F(x + 1, y + 1, 12, 1, mix(base, "#ffffff", 0.14));
        F(x + 1, y + 1, 1, 5, mix(base, "#ffffff", 0.08));
        F(x + 1, y + 5, 12, 1, mix(base, "#000000", 0.3));
        if (r() < 0.08) { const cx = x + 3 + Math.floor(r() * 7); for (let k = 0; k < 4; k++) P(cx + (k % 2), y + 2 + k, mortar); }
        if (kind === "swamp" && r() < 0.3) F(x + 1, y + 1, 3 + Math.floor(r() * 6), 1, "#5a7a3a");
        if (kind === "ice" && r() < 0.25) F(x + 2, y + 5, 2 + Math.floor(r() * 6), 1, "#e8f8ff");
      }
      for (let i = 0; i < W / 26; i++) {
        const x = Math.floor(r() * W);
        for (let k = 0; k < 4 + r() * 7; k++) F(x - k / 2, k, Math.max(1, 6 - k), 1, mortar);
      }
      const fl = mix(cave[1], "#000000", 0.2), joint = mix(cave[1], "#000000", 0.55), lit = mix(cave[2], "#000000", 0.15);
      F(0, horizon, W, H - horizon, fl);
      const vx = W / 2, vy = horizon - 70;
      let yy = horizon, gap = 3;
      while (yy < H) { F(0, yy, W, 1, joint); yy += gap; gap = Math.round(gap * 1.35) + 1; }
      for (let k = -14; k <= 14; k++) {
        for (let y = horizon; y < H; y++) { const t = (y - vy) / (horizon - vy); P(Math.round(vx + k * 14 * t), y, joint); }
      }
      for (let y = horizon + 1; y < H; y++) for (let x = (y % 2); x < W; x += 2) if (r() < 0.05) P(x, y, lit);
      F(0, horizon, W, 1, mix(cave[2], "#ffffff", 0.1));
      F(0, horizon + 1, W, 2, mix(cave[1], "#000000", 0.6));
      const vg = ctx.createLinearGradient(0, horizon, 0, H);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = vg; ctx.fillRect(0, horizon, W, H - horizon);
      for (const side of [0, 1]) for (let k = 0; k < 9; k++) {
        const x = side ? W - 1 - k * 2 : k * 2, h0 = 14 + Math.floor(r() * 10) - k;
        F(side ? x - 1 : x, H - h0, 2, h0, mix(cave[1], "#000000", 0.7));
      }
      for (let t = 0; t < 2; t++) {
        const tx = Math.floor(W * (0.15 + t * 0.7));
        F(tx, horizon - 22, 2, 6, "#6a4a2a");
        const g = ctx.createRadialGradient(tx + 1, horizon - 24, 0, tx + 1, horizon - 24, 26);
        g.addColorStop(0, "rgba(255,170,80,0.35)"); g.addColorStop(1, "rgba(255,170,80,0)");
        ctx.fillStyle = g; ctx.fillRect(tx - 26, horizon - 50, 54, 54);
        const fg = ctx.createRadialGradient(tx + 1, horizon + 10, 0, tx + 1, horizon + 10, 46);
        fg.addColorStop(0, "rgba(255,160,70,0.22)"); fg.addColorStop(1, "rgba(255,160,70,0)");
        ctx.fillStyle = fg; ctx.fillRect(tx - 46, horizon, 94, H - horizon);
        P(tx, horizon - 24, "#ffd86a"); P(tx + 1, horizon - 25, "#ff9a3a"); P(tx, horizon - 23, "#ff7a2a");
      }
      if (kind === "undead") for (let i = 0; i < 4; i++) { const x = Math.floor(r() * W); F(x, horizon - 4, 6, 4, "#5a5a60"); F(x + 1, horizon - 6, 4, 2, "#6a6a70"); }
      if (kind === "ice") for (let i = 0; i < 10; i++) { const x = Math.floor(r() * W); for (let k = 0; k < 8; k++) F(x - (8 - k) / 3, k, Math.max(1, (8 - k) / 2), 1, "#c8f0ff"); }
      if (kind === "fire") for (let x = 0; x < W; x++) if (r() < 0.25) F(x, H - 3, 1, 3, r() < 0.5 ? "#ff6a2a" : "#ffb84a");
      if (kind === "sea") for (let x = 0; x < W; x += 1) if (r() < 0.4) P(x, horizon + 2 + Math.floor(r() * 4), "#4a8a9a");
      return cv;
    }
    const bk = { goblin: "plains", beast: "forest", town: "plains", swamp: "marsh" }[kind] || kind;
    const sky = SKY[bk] || SKY.plains, n = noise2(seed || 3);
    for (let y = 0; y < horizon; y++) {
      const t = y / horizon;
      F(0, y, W, 1, t < 0.55 ? mix(sky[0], sky[1], t / 0.55) : mix(sky[1], sky[2], (t - 0.55) / 0.45));
    }
    for (let i = 0; i < Math.max(2, W / 70); i++) {
      const cx = Math.floor(r() * W), cy = Math.floor(4 + r() * horizon * 0.35), cw = 10 + Math.floor(r() * 16);
      for (let k = 0; k < 4; k++) {
        const bx = cx + Math.floor((k - 1.5) * cw * 0.3), bw = Math.floor(cw * (k === 1 || k === 2 ? 0.7 : 0.45)), bh = k === 1 || k === 2 ? 5 : 3;
        F(bx - bw / 2, cy - bh + 4, bw, bh, bk === "volcanic" ? "#6a4a4a" : "#ffffff");
      }
      F(cx - cw * 0.55, cy + 4, cw * 1.1, 2, bk === "volcanic" ? "#4a3434" : mix(sky[1], "#8aa8d8", 0.5));
    }
    const farC = bk === "volcanic" ? ["#5a3a3a", "#4a2e30"] : bk === "snow" ? ["#b8c8e8", "#98aad6"] : ["#a8b2dc", "#8e98c8"];
    for (let x = 0; x < W; x++) {
      const hgt = Math.floor(fbm(n, x / 34, 1) * (bk === "snow" || bk === "hills" ? 34 : 22)) + 4;
      F(x, horizon - hgt, 1, hgt, (x >> 2) % 5 === 0 ? farC[1] : farC[0]);
      if ((bk === "snow" || bk === "hills") && hgt > 24) F(x, horizon - hgt, 1, Math.min(4, hgt - 24), "#f4f8ff");
    }
    if (bk === "coast") {
      F(0, horizon - 10, W, 10, "#3f94d8");
      for (let x = 0; x < W; x++) if (r() < 0.25) P(x, horizon - 9 + Math.floor(r() * 8), "#7cc8f0");
    }
    if (bk === "volcanic") for (let k = 0; k < 3; k++) { const vx = Math.floor(r() * W); for (let y = 0; y < horizon - 10; y += 3) F(vx + Math.round(Math.sin(y / 6) * 3), y, 4, 3, mix("#8a7a7a", "#4a2a30", y / horizon)); }
    const SG = Isle.SURF[bk === "town" ? "plains" : bk] || Isle.SURF.plains;
    const midC = bk === "snow" ? ["#c4d2ee", "#dce6f6"] : bk === "volcanic" ? ["#4a3436", "#5a4044"] : bk === "marsh" ? ["#5a7a44", "#6a8a4c"] : ["#4a9a3a", "#5aac40"];
    const ridge = [];
    for (let x = 0; x < W; x++) {
      const hgt = Math.floor(fbm(n, x / 18 + 9, 3) * 14) + 2;
      ridge.push(horizon - hgt);
      F(x, horizon - hgt, 1, hgt, (x + hgt) % 7 === 0 ? midC[0] : midC[1]);
    }
    for (let y = horizon; y < H; y++) for (let x = 0; x < W; x++) {
      const v = fbm(n, x / 9, y / 5) + ([0, 0.5, 0.75, 0.25][(x & 1) + (y & 1) * 2] - 0.375) * 0.1;
      ctx.fillStyle = v > 0.62 ? SG[2] : v < 0.4 ? SG[0] : SG[1];
      ctx.fillRect(x, y, 1, 1);
    }
    const trees = { forest: W / 5, beast: W / 5, plains: W / 22, town: W / 30, hills: W / 40, marsh: W / 30, snow: W / 10, coast: W / 40 }[kind] || W / 30;
    const tl = [];
    for (let i = 0; i < trees; i++) { const x = Math.floor(r() * W); tl.push([x, ridge[x] + 2 + Math.floor(r() * 6)]); }
    tl.sort((a, b) => a[1] - b[1]);
    for (const [x, y] of tl) bk === "snow" ? Isle.pine(ctx, x, y, true) : bk === "volcanic" || bk === "hills" ? Isle.rock(ctx, x, y, bk) : Isle.tree(ctx, x, y, x * 31);
    if (kind === "plains" || kind === "goblin" || kind === "town") {
      const nh = kind === "goblin" ? 0 : 3 + Math.floor(r() * 3);
      for (let i = 0; i < nh; i++) Isle.house(ctx, Math.floor(W * (0.1 + i * 0.19 + r() * 0.06)), horizon + 1 + (i % 2), r() < 0.2 ? "blue" : "red", r() < 0.3);
    }
    if (kind === "plains" || kind === "town" || kind === "goblin") {
      const py = horizon + Math.floor((H - horizon) * 0.55);
      for (let x = 0; x < W; x++) { const w = Math.round(Math.sin(x / 23) * 1.5); F(x, py + w, 1, 4, "#e6cc8a"); P(x, py + w - 1, "#c4a462"); P(x, py + w + 4, "#c4a462"); }
    }
    if (kind === "marsh" || kind === "swamp") for (let i = 0; i < W / 25; i++) { const x = Math.floor(r() * W), y = horizon + 4 + Math.floor(r() * (H - horizon - 8)); F(x, y, 12 + Math.floor(r() * 10), 3, "#6aa0a0"); F(x + 2, y, 6, 1, "#a8d0c8"); }
    if (kind === "marsh" || kind === "swamp") for (let i = 0; i < W / 6; i++) { const x = Math.floor(r() * W); F(x, horizon + Math.floor(r() * 6), 1, 4, "#a8b45a"); }
    if (kind === "volcanic") for (let x = 0; x < W; x++) if (r() < 0.05) F(x, horizon + Math.floor(r() * (H - horizon)), 2, 1, "#ff7a2a");
    if (kind === "snow") for (let i = 0; i < W / 4; i++) P(Math.floor(r() * W), Math.floor(r() * H), "#ffffff");
    return cv;
  }

  function locKind(loc) {
    const S = App.S;
    if (!loc) return "plains";
    if (S.dungeons[loc]) return S.dungeons[loc].theme === "goblin" ? "goblin" : S.dungeons[loc].theme === "beast" ? "forest" : S.dungeons[loc].theme;
    if (S.towns[loc]) return S.towns[loc].biome === "plains" ? "town" : S.towns[loc].biome;
    if (S.wilds[loc]) return S.wilds[loc].biome;
    return "plains";
  }

  // story vignette: background + heroes + a prop that hints at what happened
  const TAVERN_KINDS = new Set(["brawl", "dice", "insult", "arm_wrestle", "drinking_contest", "flirt", "bond", "loan", "repay", "chat", "mentor",
    "party_formed", "party_join", "poached", "argument", "festival", "games", "funeral", "join"]);
  function vignette(e, W, H) {
    W = W || 200; H = H || 84;
    const { heroes, S } = App;
    const kind = locKind(e.loc);
    const indoors = S.towns[e.loc] && TAVERN_KINDS.has(e.kind) ? "tavern" : S.towns[e.loc] && e.kind === "crime" ? "jail" : null;
    const bg = backdrop(indoors || (kind === "town" ? "plains" : kind), W, H, hash(e.id));
    const ctx = bg.getContext("2d");
    const ground = Math.round(H * 0.62) + 14;
    if (e.wx && !indoors) weatherOverlay(ctx, W, H, e.wx, hash(e.id));
    const hs = (e.heroes || []).map((id) => heroes[id]).filter(Boolean).slice(0, 4);
    const dead = new Set();
    if (e.kind === "death") dead.add(hs[0] && hs[0].id);
    const startX = Math.round(W * 0.18);
    hs.forEach((h, i) => {
      const g = Art.heroGrid(h, 0, App.heroLook(h));
      let c = g.toCanvas(1);
      const x = startX + i * 30, y = ground - g.h;
      if (dead.has(h.id) || (e.kind === "body_sold" && i === 1) || (e.kind === "body_taken" && i === 1) || (e.kind === "funeral" && i === 0)) {
        drawGrave(ctx, x + 6, ground - 16);
        return;
      }
      ctx.drawImage(c, x, y);
    });
    const px = Math.round(W * 0.66);
    const prop = (grid, sx, sy) => ctx.drawImage(grid.toCanvas(1), sx, sy);
    if (["boss_kill", "boss"].includes(e.kind) && S.dungeons[e.loc]) {
      const m = S.monsters[S.dungeons[e.loc].boss];
      const g = Art.monsterGrid(m, 0);
      ctx.save(); ctx.globalAlpha = 0.9;
      ctx.translate(px + g.w / 2, ground - 6); ctx.rotate(Math.PI / 2 * 0.95); ctx.drawImage(g.toCanvas(1), -g.w / 2, -g.h / 2); ctx.restore();
    } else if (["fight", "ambush", "boss"].includes(e.kind) && (e.foes || []).length) {
      e.foes.slice(0, 3).forEach((mid, i) => {
        const m = S.monsters[mid];
        if (!m) return;
        const g = Art.monsterGrid(Object.assign({}, m, { boss: e.kind === "boss" && i === 0 }), 0).flipX();
        const mx = Math.round(W * 0.62) + i * 26, my = ground - g.h + (i % 2) * 3;
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(mx + 3, ground - 1, g.w - 6, 2);
        ctx.drawImage(g.toCanvas(1), mx, my);
      });
    } else if (e.kind === "party_formed" || e.kind === "party_join") {
      const p = App.parties[(e.parties || [])[0]];
      if (p) prop(Art.bannerGrid(p.banner), px, ground - 20);
    } else if (e.kind === "bond" || e.kind === "flirt") {
      const heart = e.bond === "rivals" || e.bond === "nemeses" ? "#3a3a3a" : "#e84a6a";
      drawHeart(ctx, startX + 22, ground - 40, heart);
    } else if (["sale", "body_sold", "trade", "relic", "relic_sold", "gear"].includes(e.kind)) {
      prop(Art.itemGrid(e.kind === "body_sold" ? "remains" : e.kind === "relic" ? "relic" : "gold"), px, ground - 12);
      prop(Art.itemGrid("gem"), px + 12, ground - 10);
    } else if (e.kind === "evolve") {
      for (let i = 0; i < 18; i++) { const r = rng(i + 3); ctx.fillStyle = ["#ffe88a", "#c88aff", "#ffffff"][i % 3]; ctx.fillRect(startX - 6 + Math.floor(r() * 36), ground - 40 + Math.floor(r() * 40), 1, 1); }
    } else if (e.kind === "brawl" || e.kind === "pvp" || e.kind === "robbery") {
      ctx.fillStyle = "#ffffff";
      for (const [dx, dy] of [[0, 0], [2, -2], [-2, -2], [4, 1], [-4, 1]]) ctx.fillRect(startX + 28 + dx, ground - 30 + dy, 1, 1);
    } else if (e.kind === "season_start" || e.kind === "join") {
      prop(Art.bannerGrid({ c1: "#e8b84a", c2: "#7a2a2a", emblem: "crown" }), px, ground - 20);
    }
    return bg;
  }
  function weatherOverlay(ctx, W, H, wx, seed) {
    const r = rng(seed + 5);
    if (wx === "rain" || wx === "storm") {
      ctx.fillStyle = "rgba(40,50,80,0.25)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(200,220,255,0.7)";
      for (let i = 0; i < W * (wx === "storm" ? 0.9 : 0.5); i++) { const x = Math.floor(r() * W), y = Math.floor(r() * H); ctx.fillRect(x, y, 1, 3); }
      if (wx === "storm") { ctx.fillStyle = "#fff8c0"; let x = Math.floor(W * (0.2 + r() * 0.6)); for (let y = 0; y < H * 0.5; y += 2) { x += Math.floor(r() * 3) - 1; ctx.fillRect(x, y, 1, 2); } }
    } else if (wx === "snow") {
      ctx.fillStyle = "rgba(230,240,255,0.18)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < W * 0.6; i++) ctx.fillRect(Math.floor(r() * W), Math.floor(r() * H), 1, 1);
    } else if (wx === "fog") {
      for (let y = 0; y < H; y += 2) { ctx.fillStyle = `rgba(230,230,235,${0.25 + 0.2 * Math.sin(y / 7)})`; ctx.fillRect(0, y, W, 2); }
    } else if (wx === "heat") {
      ctx.fillStyle = "rgba(255,170,60,0.15)"; ctx.fillRect(0, 0, W, H);
    }
  }
  function drawGrave(ctx, x, y) { ctx.drawImage(Art.graveGrid().toCanvas(1), x, y); }
  function drawHeart(ctx, x, y, c) {
    const pts = [[1, 0], [2, 0], [4, 0], [5, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [2, 4], [3, 4], [4, 4], [3, 5]];
    ctx.fillStyle = "#1a1220";
    for (const [px, py] of pts) ctx.fillRect(x + px - 1, y + py, 3, 1);
    ctx.fillStyle = c;
    for (const [px, py] of pts) ctx.fillRect(x + px, y + py, 1, 1);
  }

  window.Scenes = { backdrop, vignette, locKind, drawMap: (...a) => Isle.drawMap(...a), nearestNode: (...a) => Isle.nearestNode(...a) };
})();
