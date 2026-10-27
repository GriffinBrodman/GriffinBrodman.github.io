/* Delve vignettes: the room record's beats turned into a timeline of short clips (the walk in at the crew's pace, then traps, chests and loot, puzzles, obstacles, fears, shrines, lore, camps, secret doors, fights and the boss) drawn with DelveScenes. */
(function (root) {
  "use strict";
  const D = root.DelveScenes;
  const { W, H, FL, clamp, lerp, seg, ease, easeIn, hash, hashStr, mix, bay, WOOD, IRON, BONE, GOLD } = D;
  const R = Math.round;
  const arc = (t, h) => -4 * h * t * (1 - t);
  const pulse = (t, a, b) => (t >= a && t < b ? 1 : 0);
  const BOX = new Map();
  function bbox(cv) {
    let b = BOX.get(cv);
    if (b) return b;
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let x0 = cv.width, x1 = 0, y0 = cv.height, y1 = 0;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    b = { x0, x1, y0, y1, h: y1 - y0 + 1, w: x1 - x0 + 1, cx: (x0 + x1) / 2 - cv.width / 2 };
    BOX.set(cv, b);
    return b;
  }
  const tall = (env, i) => (env.crew[i] ? bbox(D.heroCanvas(env.crew[i], 0)).h : 30);

  // ---------- the room, as it stands at a clip's start ----------
  function room(st, S) {
    const env = st.env, bg = env.bg, A = bg.A, T = st.T, c = st.ctx, g = st.g;
    c.drawImage(bg.cv, 0, 0);
    g.drawImage(bg.glow, 0, 0);
    for (const l of A.lights) st.lights.push(l.flick != null ? Object.assign({}, l, { r: l.r * (1 + Math.sin(T * 13 + l.flick) * 0.035 + Math.sin(T * 5.1 + l.flick) * 0.03) }) : l);
    for (const b of A.beams) st.beam(b);
    for (const [x, y, big] of A.flames) st.flame(x, y, big);
    D.sceneAnim(st);
    if (A.flames.length && env.depth !== 2) for (const [x, y] of A.flames) st.light(x, y, 16, [1, 0.7, 0.4], 0.5);
    if (env.depth <= 1) for (let k = 0; k < 10; k++) {
      const b = A.beams[k % A.beams.length];
      if (!b) break;
      const u = (hash(k, 3, 9) + T * 0.03 * (0.5 + hash(k, 4, 9))) % 1, x = lerp(b.x0, b.x1, u) + Math.sin(T * 0.7 + k) * 3, y = lerp(b.y0, b.y1, u);
      if (bay(k, R(T * 4)) < 0.7) st.px(x, y, "#fff4d0", true);
    }
    if (A.embers) for (let k = 0; k < 9; k++) { const u = (hash(k, 5, 2) + T * (0.12 + hash(k, 6, 2) * 0.1)) % 1; st.px(20 + hash(k, 7, 2) * 140 + Math.sin(T * 2 + k) * 3, H - 4 - u * 80, u < 0.6 ? "#ffb040" : "#c05020", true); }
    if (A.drips) for (let k = 0; k < 3; k++) { const p = (T * 0.45 + hash(k, 8, 3)) % 1, x = 30 + hash(k, 9, 3) * 120; if (p < 0.5) st.px(x, 4 + easeIn(p * 2) * (FL + 20), env.theme === "ice" ? "#d8f0fa" : "#8ab0c0"); }
    const kind = env.kind;
    if (kind === "chest" || kind === "secret") chest(st, S);
    if ((kind === "puzzle" || (kind === "obstacle" && env.rec.sub === "stuck_door")) && S.door !== "gone") door(st, S);
    if (kind === "obstacle" && env.rec.sub === "rubble") rubblePile(st, S.rubble == null ? 1 : S.rubble);
    if (kind === "obstacle" && env.rec.sub === "flood") water(st, 80);
    if (kind === "shrine") for (let k = 0; k < A.candles.length; k++) if ((S.candles || 0) > k) { const [x, y] = A.candles[k]; st.flame(x, y - 2, false); st.light(x, y - 2, S.gutter ? 10 : 22, [1, 0.72, 0.42], S.gutter ? 0.3 : 0.6); }
    if (kind === "remains") remains(st, S);
    if (kind === "lore" || S.mural != null) mural(st, S.mural == null ? 0 : S.mural, S.muralGlow);
    if (kind === "camp_spot" && S.fire) campfire(st, A.focus[0], A.focus[1], S.fire === "low");
    if (kind === "camp_spot" && S.barred) { st.rect(148, 38, 22, 3, WOOD[3]); st.rect(148, 38, 22, 1, WOOD[4]); }
    if (kind === "lair" && S.bossHere !== false && env.boss) st.mon(env.boss, A.focus[0], A.focus[1], { frame: (T * 1.5) % 2 | 0 });
    if (S.secret) secretWall(st, 1);
    if (S.trapMark) trapMark(st, 1, S.trapMark === "dead");
    if (S.pitOpen) pitHole(st, S.pitOpen);
    for (const h of S.hover || []) drawLoot(st, h.L, h.ox, h.oy, 99);
  }

  // ---------- the crew ----------
  // crew(st, poses): each hero at its mark (plus S.dx), idling, unless the clip says otherwise; the lead carries the light below the first floor
  function crew(st, S, poses, o) {
    const env = st.env, n = env.crew.length, order = [];
    o = o || {};
    for (let i = n - 1; i >= 0; i--) order.push(i);
    order.sort((a, b) => (poseOf(a).y || 0) - (poseOf(b).y || 0));
    function poseOf(i) {
      const hm = D.home(env, i), p = Object.assign({ x: hm.x + (S.dx || 0), y: hm.y, frame: Math.floor(st.T * 1.6 + i * 0.7) % 2 }, (poses && poses[i]) || {});
      return p;
    }
    let lx = 0, ly = 0, k = 0;
    for (const i of order) {
      const p = poseOf(i);
      if (p.hide) continue;
      const sty = Object.assign({}, p);
      if (S.wet && S.wet[i]) Object.assign(sty, { tint: "#4a7aa0", ta: 0.3 });
      if (S.goo && S.goo[i]) Object.assign(sty, { tint: "#7ab040", ta: 0.45 });
      if (S.soot && S.soot[i]) Object.assign(sty, { tint: "#2a2420", ta: 0.45 });
      if (S.dust) Object.assign(sty, { tint: "#a89a88", ta: 0.35 });
      if (p.tint) Object.assign(sty, { tint: p.tint, ta: p.ta });
      st.hero(i, p.x, p.y, sty);
      if (S.pack && S.pack[i]) pack(st, p.x, p.y, S.pack[i], p.flip);
      if (i === 0 && !o.noLight && !p.rot && !p.noTorch) carry(st, p, S);
      if (!p.rot) { lx += p.x; ly += p.y; k++; }
    }
    if (env.dark && k) {
      // the one light reaches whatever the crew is fighting, so a clash in the dark is still seen
      const also = o.also || [], ax = also.reduce((a, p) => a + p[0], lx), cx = ax / (k + also.length), cy = ly / k - 14, fl = Math.sin(st.T * 9) * 1.2 + Math.sin(st.T * 23) * 0.8;
      const reach = also.reduce((a, p) => Math.max(a, Math.abs(p[0] - cx) + 16), 0);
      st.darkness = { x: cx, y: cy, r: Math.max(30, reach) + fl };
      st.ambOverride = [0, 0, 0];
      st.light(cx, cy, Math.max(40, reach + 10) + fl, [0.95, 0.75, 0.5], 0.95);
    }
  }
  function carry(st, p, S) {
    const env = st.env;
    if (env.dark || S.noTorch) return;
    const f = p.flip ? -1 : 1;
    if (S.lantern) { st.rect(p.x + 5 * f, p.y - 40, 1, 14, WOOD[2]); st.lantern(p.x + 5 * f, p.y - 42); return; }
    if (env.depth >= 2) st.torch(p.x + 7 * f, p.y - 21 + (p.dy || 0));
  }
  function pack(st, x, y, n, flip) {
    const f = flip ? 1 : -1, w = 5 + Math.min(4, n), h = 6 + Math.min(4, n), px = x + f * 6 - (f < 0 ? w : 0);
    st.rect(px, y - 22 - h + 6, w, h, "#6a4a26"); st.rect(px, y - 22 - h + 6, w, 1, "#8a6a3a"); st.rect(px + 1, y - 22 - h + 8, w - 2, 1, "#4a301a");
  }
  const lead = (env, b) => { const id = b && b.r && b.r[0] && b.r[0][0]; const i = env.byId[id]; return i == null ? 0 : i; };
  const idxOf = (env, id) => { const i = env.byId[id]; return i == null ? -1 : i; };
  function walkPose(st, x, y, rate, flip) { const f = Math.floor(st.T * (rate || 6)) % 2; return { x, y, frame: f, dy: -f, flip }; }
  function stars(st, x, y, t) { for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2.1, sx = R(x + Math.cos(a) * 6), sy = R(y + Math.sin(a) * 2); st.px(sx, sy, "#fff8c0", true); st.px(sx - 1, sy, "#ffd040", true); st.px(sx + 1, sy, "#ffd040", true); st.px(sx, sy - 1, "#ffd040", true); st.px(sx, sy + 1, "#ffd040", true); } }
  function sweat(st, x, y, t) { const p = (t * 1.4) % 1; st.px(x, y + p * 6, "#bfe4ff", true); if (p < 0.5) st.px(x, y + p * 6 - 1, "#e8f6ff", true); }
  function puff(st, x, y, t, col, n) { if (t < 0 || t > 1) return; for (let k = 0; k < (n || 6); k++) { const a = (k / (n || 6)) * Math.PI - Math.PI, r = 2 + t * 9; st.px(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5 - t * 3, bay(k, R(t * 9)) < 1 - t ? col || "#b8ac98" : null); } }
  function mark(st, s, x, y, c) { st.text(s, R(x), R(y), c || "#ffe070", { center: true, outline: "#1a1008" }); }
  function bubble(st, x, y, s) {
    st.uiDraw((o) => {
      const w = D.textWidth(s) + 6;
      o.fillStyle = "#1a1008"; o.fillRect(R(x - w / 2) - 1, y - 1, w + 2, 10); o.fillStyle = "#f6ead0"; o.fillRect(R(x - w / 2), y, w, 8); o.fillRect(R(x) - 1, y + 8, 2, 2);
      D.text(o, s, R(x), y + 2, "#2e2116", { center: true });
    });
  }
  function sparkle(st, x, y, t, col, n) { for (let k = 0; k < (n || 8); k++) { const a = (k / (n || 8)) * Math.PI * 2 + hash(k, 1, 7), r = ease(t) * (8 + hash(k, 2, 7) * 8); if (t < 1) st.px(x + Math.cos(a) * r, y + Math.sin(a) * r - t * 4, k % 2 ? "#ffffff" : col || "#ffe27a", true); } }
  function dustCloud(st, x, y, t, w) { for (let k = 0; k < 18; k++) { const a = hash(k, 1, 4) * Math.PI * 2, r = ease(t) * (w || 14) * (0.4 + hash(k, 2, 4) * 0.6); if (bay(k, R(t * 7)) < 1 - t) st.px(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.45 - t * 6, hash(k, 3, 4) < 0.5 ? "#c8b8a0" : "#a89880"); } }

  // ---------- props ----------
  function chest(st, S) {
    const [fx, fy] = st.env.bg.A.focus, x = fx - 11, y = fy, c = st.ctx, st8 = S.chest || "shut";
    const P = (xx, yy, w, h, col) => { c.fillStyle = col; c.fillRect(xx, yy, w, h); };
    st.light(fx, fy - 8, 26, [1, 0.8, 0.5], 0.35);
    P(x - 1, y, 24, 1, "rgba(0,0,0,0.45)");
    const body = (top) => {
      P(x, top, 22, y - top, WOOD[2]);
      for (let yy = top + 3; yy < y - 1; yy += 3) P(x, yy, 22, 1, WOOD[1]);
      P(x, top, 22, 1, WOOD[3]); P(x, top, 1, y - top, WOOD[3]); P(x + 21, top, 1, y - top, WOOD[0]); P(x, y - 1, 22, 1, WOOD[0]);
      for (const bx of [x + 2, x + 18]) { P(bx, top, 2, y - top, IRON[2]); P(bx, top, 1, y - top, IRON[3]); P(bx + 1, top + 2, 1, 1, IRON[4]); P(bx + 1, y - 3, 1, 1, IRON[4]); }
    };
    if (st8 === "broken") {
      body(y - 10);
      for (let i = 0; i < 22; i += 3) P(x + i, y - 11 - (i * 7 % 3), 2, 1 + (i * 5 % 2), WOOD[3]);
      P(x + 1, y - 10, 20, 2, "#1a0e06"); P(x + 6, y - 10, 2, 1, GOLD[3]); P(x + 13, y - 10, 3, 1, GOLD[4]);
      return;
    }
    if (st8 === "open") {
      P(x, y - 22, 22, 11, WOOD[1]); P(x + 1, y - 21, 20, 9, "#2a170a"); P(x, y - 22, 22, 1, WOOD[2]);
      for (const bx of [x + 2, x + 18]) P(bx, y - 22, 2, 11, IRON[1]);
      body(y - 10);
      P(x + 1, y - 10, 20, 2, "#140a04"); for (let i = 2; i < 20; i += 2) P(x + i, y - 11 + (i % 4 === 0 ? 0 : 1), 2, 1, i % 6 === 0 ? GOLD[4] : GOLD[3]);
      P(x + 9, y - 9, 4, 3, GOLD[2]);
      return;
    }
    const lift = st8 === "unlocked" ? 1 : 0, lt = y - 16 - lift;
    body(y - 10);
    P(x + 2, lt, 18, 1, WOOD[4]); P(x + 1, lt + 1, 20, 1, WOOD[3]); P(x, lt + 2, 22, 4, WOOD[2]); P(x, lt + 3, 22, 1, WOOD[1]);
    P(x, lt + 5, 22, 1, GOLD[2]); P(x, lt + 2, 1, 3, WOOD[3]); P(x + 21, lt + 2, 1, 4, WOOD[0]);
    for (const bx of [x + 2, x + 18]) { P(bx, lt + 1, 2, 5, IRON[2]); P(bx, lt + 1, 1, 5, IRON[3]); }
    P(x + 9, lt + 4, 4, 5, GOLD[3]); P(x + 9, lt + 4, 4, 1, GOLD[4]); P(x + 10, lt + 6, 2, 2, "#2a1a08"); P(x + 12, lt + 5, 1, 4, GOLD[2]);
  }
  function door(st, S) {
    const c = st.ctx, T = st.env.T, T2 = st.T;
    if (S.door === "open") {
      const g = st.g;
      for (let y = 14; y < FL; y++) { g.fillStyle = mix("#fff0c8", "#d8a050", (y - 14) / 50); g.fillRect(106, y, 42, 1); }
      for (let k = 0; k < 8; k++) { const u = (T2 * 0.2 + hash(k, 1, 23)) % 1; g.fillStyle = "#fffaf0"; g.fillRect(108 + R(hash(k, 2, 23) * 38), R(FL - 2 - u * 46), 1, 1); }
      st.beam({ x0: 127, y0: 40, x1: 80, y1: H, w: 22, k: 0.5 });
      st.light(127, 50, 70, [1, 0.85, 0.55], 0.9);
      return;
    }
    const lift = S.doorLift || 0;
    for (let y = 14; y < FL - lift; y++) for (let x = 106; x < 148; x++) {
      const yy = y + lift, edge = x === 106 || x === 147 || yy === 14 || (x - 106) % 14 === 0;
      c.fillStyle = edge ? T.ramp[1] : ((x * 3 + yy * 7) % 23 === 0 ? T.ramp[2] : yy % 9 === 0 ? T.ramp[2] : T.ramp[3]);
      c.fillRect(x, y, 1, 1);
    }
    if (!lift) {
      c.fillStyle = S.runeRed ? "#c84030" : S.runeLit ? "#ffd060" : T.ramp[1];
      for (const [rx, ry] of [[118, 26], [134, 26], [126, 20], [126, 34]]) c.fillRect(rx, ry, 3, 3);
      if (S.runeLit || S.runeRed) for (const [rx, ry] of [[118, 26], [134, 26], [126, 20], [126, 34]]) { st.g.fillStyle = S.runeRed ? "#ff5040" : "#ffe080"; st.g.fillRect(rx + 1, ry + 1, 1, 1); }
    }
  }
  function rubblePile(st, k) {
    const T = st.env.T, c = st.ctx;
    for (let i = 0; i < 70 * k; i++) {
      const x = 98 + hash(i, 1, 5) * 56, top = 90 - Math.sin(((x - 98) / 56) * Math.PI) * 40 * k, y = top + hash(i, 2, 5) * (92 - top), w = 3 + (hash(i, 3, 5) * 4 | 0);
      const base = mix(T.ramp[2 + (hash(i, 4, 5) * 2 | 0)], "#c8b8a0", 0.18);
      c.fillStyle = mix(base, "#000000", 0.55); c.fillRect(R(x) - 1, R(y) - 1, w + 2, w + 1);
      c.fillStyle = base; c.fillRect(R(x), R(y), w, w - 1); c.fillStyle = mix(base, "#ffffff", 0.25); c.fillRect(R(x), R(y), w - 1, 1); c.fillStyle = mix(base, "#000000", 0.3); c.fillRect(R(x) + 1, R(y) + w - 2, w - 1, 1);
    }
  }
  function water(st, y0, x0, x1) {
    const g = st.g, c = st.ctx, T = st.T;
    for (let x = x0 || 4; x < (x1 || W - 4); x++) {
      const s = R(y0 + Math.sin(x * 0.3 + T * 4) * 0.8);
      c.fillStyle = "rgba(20,60,80,0.72)"; c.fillRect(x, s, 1, H - s);
      if ((x + R(T * 8)) % 7 < 3) { g.fillStyle = "#8ac8d8"; g.fillRect(x, s, 1, 1); }
    }
  }
  function trapMark(st, a, dead) {
    const [fx, fy] = st.env.bg.A.focus, wire = wireTrap(st.env.rec.tid);
    const col = dead ? "#6a6a6a" : "#ff4a3a";
    if (wire) { for (let x = fx - 14; x <= fx + 14; x += 2) if ((x - fx + 14) / 28 <= a) st.px(x, fy - 6, col, !dead); }
    else for (let i = 0; i < 40 * a; i += 2) { const p = i / 40, x = p < 0.3 ? fx - 8 + (p / 0.3) * 16 : p < 0.5 ? fx + 8 : p < 0.8 ? fx + 8 - ((p - 0.5) / 0.3) * 16 : fx - 8; const y = p < 0.3 ? fy - 3 : p < 0.5 ? fy - 3 + ((p - 0.3) / 0.2) * 4 : p < 0.8 ? fy + 1 : fy + 1 - ((p - 0.8) / 0.2) * 4; st.px(x, y, col, !dead); }
  }
  function pitHole(st, k) { const [fx, fy] = st.env.bg.A.focus, w = R(10 * k); st.rect(fx - w, fy - 2, w * 2, 5, "#050302"); st.rect(fx - w, fy - 2, w * 2, 1, "#2a1a10"); }
  function secretWall(st, k) {
    const c = st.ctx, T = st.env.T, x0 = 22, x1 = 46, top = 30;
    c.fillStyle = "#050404"; c.fillRect(x0, top, x1 - x0, FL - top);
    const lift = R((FL - top) * k);
    for (let y = top; y < FL - lift; y++) for (let x = x0; x < x1; x++) { c.fillStyle = (x + y) % 6 === 0 ? T.ramp[2] : y % 8 === 0 ? T.ramp[1] : T.ramp[3]; c.fillRect(x, y, 1, 1); }
    if (k >= 1) st.light(34, 50, 20, [0.9, 0.8, 0.6], 0.2);
  }
  function remains(st, S) {
    const [fx, fy] = st.env.bg.A.focus, c = st.ctx, P = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    if (S.laid) {
      P(fx - 12, fy - 3, 22, 3, "#5a4430"); P(fx - 12, fy - 3, 22, 1, "#7a6040");
      for (let k = 0; k < 3; k++) { P(fx + 12 + k * 3, fy - 2 - (k === 1 ? 2 : 0), 3, 2, st.env.T.ramp[3]); }
      P(fx + 16, fy - 16, 1, 12, IRON[3]); P(fx + 14, fy - 12, 5, 1, IRON[2]);
      return;
    }
    P(fx - 4, fy - 20, 6, 5, BONE[3]); P(fx - 3, fy - 18, 1, 1, "#1a1410"); P(fx, fy - 18, 1, 1, "#1a1410"); P(fx - 5, fy - 22, 8, 3, IRON[2]); P(fx - 5, fy - 22, 8, 1, IRON[3]);
    for (let k = 0; k < 4; k++) P(fx - 5, fy - 14 + k * 2, 8, 1, BONE[2]);
    P(fx - 2, fy - 15, 1, 9, BONE[3]); P(fx - 8, fy - 13, 3, 1, BONE[3]); P(fx + 3, fy - 13, 4, 1, BONE[3]); P(fx - 9, fy - 12, 1, 6, BONE[2]);
    P(fx - 6, fy - 5, 12, 2, BONE[2]); P(fx - 8, fy - 3, 4, 3, BONE[3]); P(fx + 4, fy - 3, 5, 3, BONE[3]);
    P(fx + 9, fy - 26, 1, 22, IRON[3]); P(fx + 7, fy - 8, 5, 1, IRON[2]);
    if (!S.packOpen) { P(fx - 20, fy - 8, 9, 8, "#5a3e22"); P(fx - 20, fy - 8, 9, 1, "#7a5a32"); P(fx - 17, fy - 6, 3, 2, "#3a2614"); }
    if (!S.noteTaken) { P(fx + 1, fy - 1, 5, 3, "#e8dcb8"); P(fx + 2, fy, 3, 1, "#8a7a5a"); }
  }
  const MURAL = {};
  function muralCanvas(env) {
    const k = env.theme + (env.boss || "") + env.bg.A.mural.join();
    if (MURAL[k]) return MURAL[k];
    const [, , w, h] = env.bg.A.mural, cv = root.document.createElement("canvas");
    cv.width = w; cv.height = h;
    const c = cv.getContext("2d"), O = "#c88a4a", Rd = "#a83a2a", Wt = "#e8dcc0";
    const P = (x, y, ww, hh, col) => { c.fillStyle = col; c.fillRect(x, y, ww, hh); };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (hash(x, y, 77) < 0.04) P(x, y, 1, 1, "rgba(0,0,0,0.3)");
    for (let k2 = 0; k2 < 5; k2++) {
      const x = 4 + k2 * 11, y = 22;
      P(x + 1, y, 3, 3, O); P(x + 2, y + 3, 1, 6, O); P(x, y + 4, 5, 1, O); P(x + 1, y + 9, 1, 4, O); P(x + 3, y + 9, 1, 4, O);
      if (k2 === 0) { P(x + 5, y + 1, 1, 7, Wt); P(x + 4, y, 3, 2, "#ffd060"); }
    }
    for (let k2 = 0; k2 < 3; k2++) P(60 + k2 * 4, 30 - k2 * 3, 4, 3 + k2 * 3, Wt);
    P(4, 4, 46, 1, O); P(4, 6, 30, 1, O); P(4, 8, 38, 1, O);
    for (let k2 = 0; k2 < 8; k2++) P(56 + k2 * 2, 4 + (k2 % 3), 1, 1, O);
    try {
      const m = D.monCanvas(env.boss || "goblin_warchief", 0), b = bbox(m), s = Math.min(1, 30 / b.h);
      const tmp = root.document.createElement("canvas"); tmp.width = m.width; tmp.height = m.height;
      const t2 = tmp.getContext("2d"); t2.drawImage(m, 0, 0); t2.globalCompositeOperation = "source-atop"; t2.fillStyle = Rd; t2.fillRect(0, 0, m.width, m.height);
      c.imageSmoothingEnabled = false;
      c.drawImage(tmp, b.x0, b.y0, b.w, b.h, w - 8 - R(b.w * s), h - 2 - R(b.h * s), R(b.w * s), R(b.h * s));
    } catch (e) { P(w - 30, 8, 22, 28, Rd); }
    MURAL[k] = cv;
    return cv;
  }
  function mural(st, k, glowK) {
    const env = st.env, [mx, my, mw, mh] = env.bg.A.mural, cv = muralCanvas(env), c = st.ctx;
    if (env.kind !== "lore") { c.fillStyle = mix(env.T.ramp[1], "#000000", 0.25); c.fillRect(mx - 2, my - 2, mw + 4, mh + 4); c.fillStyle = env.T.ramp[4]; c.fillRect(mx - 2, my - 2, mw + 4, 1); }
    const shown = R(mw * k);
    if (shown > 0) c.drawImage(cv, 0, 0, shown, mh, mx, my, shown, mh);
    if (glowK) { const g = st.g; g.globalAlpha = glowK; g.drawImage(cv, mw - 40, 0, 40, mh, mx + mw - 40, my, 40, mh); g.globalAlpha = 1; st.light(mx + mw - 20, my + 20, 30, [1, 0.3, 0.2], glowK); }
  }

  // ---------- loot: each find flies out on its own, its aura by how good it is ----------
  const GOOD_SPR = {
    gem: (st, x, y) => { st.rect(x - 1, y - 2, 3, 1, "#8ae0f0", true); st.rect(x - 2, y - 1, 5, 1, "#4ab0d0", true); st.rect(x - 1, y, 3, 1, "#2a80b0", true); st.px(x, y + 1, "#1a5a90", true); },
    potion: (st, x, y) => { st.rect(x - 1, y - 3, 2, 1, "#c8b8a0"); st.rect(x - 2, y - 2, 4, 4, "#c03a3a"); st.px(x - 1, y - 2, "#ff9a8a", true); },
    trinket: (st, x, y) => { st.rect(x - 2, y - 2, 4, 1, GOLD[3]); st.rect(x - 2, y + 1, 4, 1, GOLD[2]); st.rect(x - 2, y - 2, 1, 4, GOLD[3]); st.rect(x + 1, y - 2, 1, 4, GOLD[2]); },
  };
  function itemsOf(env, b) {
    const out = [];
    if (b.gear) out.push((env.rec.loot || []).find((l) => l.name === b.gear) || { name: b.gear, tier: "common", slot: "pocket" });
    for (const [g, n] of Object.entries(b.goods || {})) for (let k = 0; k < Math.min(3, n); k++) out.push({ good: g in GOOD_SPR ? g : "trinket" });
    return out;
  }
  const TIER_SND = { cosmetic: "clink", common: "shimmer", great: "flare", unique: "bell" };
  function aura(st, l, x, y, age) {
    const T = st.T, g = st.g, tier = l.tier, col = D.auraOf(l);
    if (tier === "unique") {
      const r = 15 + Math.sin(T * 3) * 1.5;
      for (let j = -18; j <= 18; j++) for (let i = -18; i <= 18; i++) {
        const d = Math.hypot(i, j) / r;
        if (d < 1 && bay(i + 40, j + 40) < (1 - d) * 1.6) { g.fillStyle = d < 0.6 ? mix(col, "#ffffff", 0.3) : col; g.fillRect(R(x + i), R(y + j), 1, 1); }
      }
      for (let k = 0; k < 12; k++) { const u = (T * 0.5 + hash(k, 1, 11)) % 1; st.px(x - 12 + hash(k, 2, 11) * 24 + Math.sin(T * 3 + k) * 1.5, y + 12 - u * 34, u < 0.7 ? mix(col, "#ffffff", 0.5) : col, true); }
      st.light(x, y, 44, D.rgb(col).map((v) => v / 255), 1.1);
    } else if (tier === "great") {
      const r = 13 + Math.sin(T * 5) * 1;
      for (let j = -15; j <= 15; j++) for (let i = -15; i <= 15; i++) { const d = Math.hypot(i, j) / r; if (d < 1 && bay(i + 40, j + 40) < (1 - d) * 1.6) { g.fillStyle = d < 0.55 ? "#fff0a0" : "#f2c450"; g.fillRect(R(x + i), R(y + j), 1, 1); } }
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + T * 0.6, L = (k % 2 ? 17 : 21) + Math.sin(T * 6 + k) * 2; for (let q = 13; q < L; q++) st.px(x + Math.cos(a) * q, y + Math.sin(a) * q, q > L - 3 ? "#fff6c8" : "#ffe27a", true); }
      for (let k = 0; k < 12; k++) { const u = (T * 1.4 + hash(k, 3, 13)) % 1, a = hash(k, 4, 13) * Math.PI * 2; if (u < 0.8) st.px(x + Math.cos(a) * (9 + u * 16), y + Math.sin(a) * (9 + u * 16) + u * u * 8, u < 0.4 ? "#ffffff" : "#ffd040", true); }
      st.light(x, y, 30, [1, 0.85, 0.4], 0.8);
    } else if (tier === "common") {
      const sw = ((T * 0.8 + hash(x, y, 5)) % 1.6) - 0.3;
      for (let j = -11; j <= 11; j++) for (let i = -11; i <= 11; i++) { const d = Math.hypot(i, j) / 11; if (d < 1 && bay(i + 40, j + 40) < (1 - d) * 0.9) { g.fillStyle = d < 0.5 ? "#e8eef4" : "#a8b8c8"; g.fillRect(R(x + i), R(y + j), 1, 1); } }
      if (sw > 0 && sw < 1) for (let j = -10; j <= 10; j++) st.px(x - 10 + sw * 20 + j * 0.5, y + j, "#ffffff", true);
      st.light(x, y, 16, [0.85, 0.9, 1], 0.4);
    } else if (age % 1.4 < 0.25) {
      const k = (age % 1.4) / 0.25, gx = x - 3 + (hashStr(l.name || "x") % 6), gy = y - 3;
      st.px(gx, gy, "#ffffff", true); if (k > 0.3 && k < 0.8) { st.px(gx - 1, gy, "#fff0c0", true); st.px(gx + 1, gy, "#fff0c0", true); st.px(gx, gy - 1, "#fff0c0", true); st.px(gx, gy + 1, "#fff0c0", true); }
    }
  }
  // finds: a clip's items fly from (ox, oy) to slots above, one by one, and stay hovering
  function lootPlan(env, b, ox, oy, t0) {
    const items = itemsOf(env, b), coins = b.silver ? clamp(R(b.silver / 4), 3, 14) : 0, gear = items.filter((l) => !l.good), goods = items.filter((l) => l.good);
    const ev = [], fly = [];
    let t = t0 + (coins ? 0.5 : 0);
    if (coins) ev.push([t0, "coins", 1, { coin: b.silver }]);
    goods.forEach((l, k) => { fly.push({ l, t: t + k * 0.18, x: ox - 22 + k * 9, y: oy - 18 - (k % 2) * 3 }); ev.push([t + k * 0.18, "pop", 0.8]); });
    if (goods.length) t += 0.3 + goods.length * 0.18;
    const n = gear.length;
    gear.forEach((l, k) => {
      const sx = n === 1 ? ox : ox - 20 + (40 * k) / Math.max(1, n - 1);
      fly.push({ l, t, x: sx, y: oy - 34 });
      ev.push([t + 0.3, TIER_SND[l.tier] || "clink", 1, { item: l }]);
      t += l.tier === "unique" ? 1.5 : l.tier === "great" ? 1.2 : 0.85;
    });
    return { fly, coins, ev, end: t + (gear.length ? 0.4 : 0.3), empty: !coins && !items.length };
  }
  function drawLoot(st, L, ox, oy, T) {
    for (let k = 0; k < L.coins; k++) {
      const t0 = 0.06 * k, u = clamp((T - L.t0 - t0) / 0.7, 0, 1);
      if (T < L.t0 + t0) continue;
      const ang = -Math.PI / 2 + (hash(k, 1, 21) - 0.5) * 2.2, v = 26 + hash(k, 2, 21) * 14, x = ox + Math.cos(ang) * v * u, land = oy + 4 + hash(k, 3, 21) * 5;
      const y = u < 1 ? oy - 6 + Math.sin(ang) * v * u + 60 * u * u : land;
      st.rect(R(x), R(Math.min(y, land)), 2, 1, u < 1 && k % 2 ? GOLD[4] : "#d8d8e0", u < 1);
      if (u >= 1 && (st.T * 3 + k) % 4 < 0.15) st.px(x, land - 1, "#ffffff", true);
    }
    for (const f of L.fly) {
      if (T < f.t) continue;
      const u = ease((T - f.t) / 0.55), x = lerp(ox, f.x, u), y = lerp(oy - 4, f.y, u) + arc(clamp((T - f.t) / 0.55, 0, 1), 10) + (u >= 1 ? Math.sin(st.T * 2 + f.x) * 1.2 : 0);
      if (f.l.good) { GOOD_SPR[f.l.good](st, x, y); continue; }
      aura(st, f.l, x, y, T - f.t);
      st.item(f.l, x, y + D.itemCanvas(f.l).height / 2, { glow: true });
    }
  }

  // ---------- close-ups: the hands at work ----------
  // a pair of hands from the bottom of the frame, sleeves in the hero's own colour, fingers apart, a pick between them when picking
  function hand(c, X, Y, f, sk, sl) {
    const dk = mix(sk, "#3a1a0c", 0.4), lt = mix(sk, "#fff4e0", 0.25), ol = mix(sk, "#1a0c06", 0.7), sd = mix(sl, "#140c10", 0.45), sh = mix(sl, "#ffffff", 0.18);
    const P = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(X + (f > 0 ? x : -x - w), Y + y, w, h); };
    P(-7, 12, 16, 30, ol); P(-6, 13, 14, 29, sl); P(-6, 13, 3, 29, sh); P(4, 13, 4, 29, sd); P(-7, 12, 16, 3, sd); P(-6, 12, 14, 1, sh);
    P(-6, 3, 13, 10, ol); P(-5, 4, 11, 9, sk); P(-5, 4, 11, 2, lt); P(3, 6, 3, 7, dk);
    const fing = [[-5, -4], [-2, -6], [1, -6], [4, -3]];
    for (const [fx, fy] of fing) { P(fx - 1, fy - 1, 4, 7 - fy, ol); P(fx, fy, 2, 6 - fy, sk); P(fx, fy, 2, 1, lt); P(fx + 1, fy + 1, 1, 4 - fy, dk); }
    P(-10, 5, 5, 4, ol); P(-9, 6, 4, 2, sk); P(-9, 6, 4, 1, lt);
  }
  function hands(st, x, y, h, jit, tool) {
    const look = (h && h.look) || {}, sk = look.skin || "#d8a880", sl = mix(look.fav || "#6a5a8a", "#3a3440", 0.35), c = st.ctx, j = R(jit);
    hand(c, x - 18 + j, y + Math.abs(j), 1, sk, sl);
    hand(c, x + 18 - j, y + Math.abs(j), -1, sk, sl);
    if (tool === "pick") { st.line(x - 12 + j, y - 4, x - 2 + j, y - 16, IRON[3]); st.line(x - 11 + j, y - 4, x - 1 + j, y - 16, IRON[1]); st.line(x + 12 - j, y - 6, x + 3 - j, y - 14, IRON[4]); st.px(x + 2 - j, y - 15, IRON[4]); }
  }
  const CLOSE = {};
  function closeBg(st) {
    const env = st.env, key = env.theme;
    if (!CLOSE[key]) {
      const cv = root.document.createElement("canvas"); cv.width = W; cv.height = H;
      const c = cv.getContext("2d"), im = c.createImageData(W, H), d = im.data, r = env.T.framp.concat([env.T.ramp[4]]), s = hashStr(key);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const gx = Math.floor(x / 44), gy = Math.floor(y / 30);
        let d1 = 1e9, d2 = 1e9, id = 0, px = 0, py = 0;
        for (let jj = -1; jj <= 1; jj++) for (let ii = -1; ii <= 1; ii++) { const cx = gx + ii, cy = gy + jj, ox = (cx + 0.2 + hash(cx, cy, s) * 0.6) * 44, oy = (cy + 0.2 + hash(cx, cy, s + 1) * 0.6) * 30, dd = ((x - ox) / 44) ** 2 + ((y - oy) / 30) ** 2; if (dd < d1) { d2 = d1; d1 = dd; id = cx * 31 + cy; px = ox; py = oy; } else if (dd < d2) d2 = dd; }
        const e = Math.sqrt(d2) - Math.sqrt(d1);
        let v = 0.35 + hash(id, 2, s) * 0.3 - ((x - px) / 44) * 0.3 - ((y - py) / 30) * 0.45 + (hash(x >> 1, y >> 1, s) - 0.5) * 0.12;
        if (e < 0.05) v = -1; else if (e < 0.1) v -= 0.25;
        const vig = Math.min(1, Math.hypot((x - W / 2) / (W * 0.62), (y - H / 2) / (H * 0.62)));
        const col = v < 0 ? mix(r[0], "#000000", 0.5) : r[clamp(Math.floor(v * (r.length - 1) + bay(x, y)), 0, r.length - 1)];
        const rgb = D.rgb(col), k = 1 - vig * vig * 0.85, i = (y * W + x) * 4;
        d[i] = rgb[0] * k; d[i + 1] = rgb[1] * k; d[i + 2] = rgb[2] * k; d[i + 3] = 255;
      }
      c.putImageData(im, 0, 0);
      CLOSE[key] = cv;
    }
    st.ctx.drawImage(CLOSE[key], 0, 0);
    st.ambOverride = [0.35, 0.32, 0.3];
    st.light(90, 44, 110, [1, 0.78, 0.5], 1.0);
  }

  // ---------- the clips ----------
  const PACE = { cautious: { dur: 1.9, speed: 15, rate: 4 }, steady: { dur: 1.3, speed: 30, rate: 6 }, push: { dur: 1.0, speed: 95, rate: 11 } };
  function intro(env, S) {
    const p = PACE[env.pace] || PACE.steady, C = D.corridor(env.theme, env.depth, env.seed), ev = [];
    for (let t = 0.05; t < p.dur; t += 1.2 / p.rate) ev.push([t, "step", env.pace === "push" ? 1.4 : 0.8]);
    if (env.pace === "steady") ev.push([0.3, "scribble", 0.7]);
    const s0 = Object.assign({}, S, { lantern: env.pace === "cautious" });
    return { dur: p.dur, ev, draw(st, lt) {
      const off = R(30 + lt * p.speed), c = st.ctx;
      c.drawImage(C.cv, -off, 0); st.g.drawImage(C.glow, -off, 0);
      if (env.depth === 2) for (const x of C.lights) { if (x - off > -20 && x - off < W + 20) { st.flame(x - off, 24); st.light(x - off, 24, 58, [1, 0.66, 0.36], 1.05); } }
      if (env.depth <= 1) st.beam({ x0: 120 - off * 0.2, y0: 0, x1: 136 - off * 0.2, y1: H, w: 10, k: 0.45 });
      if (env.pace === "cautious") for (let k = 0; k < 12; k++) {
        const mx = 60 + k * 46;
        if (mx - off < D.home(env, 0).x - 4 && mx - off > 6) { for (let q = -2; q <= 2; q++) { st.px(mx - off + q, 38 + q, "#e8e4d8"); st.px(mx - off + q, 38 - q, "#e8e4d8"); } }
      }
      const poses = {}, n = env.crew.length;
      for (let i = 0; i < n; i++) {
        const hm = D.home(env, i), f = Math.floor(lt * p.rate + i * 0.5) % 2;
        poses[i] = { x: hm.x - 6, y: hm.y, frame: f, dy: env.pace === "push" ? -f * 2 : -f };
      }
      crew(st, s0, poses);
      if (env.pace === "steady" && n) {
        const m = n - 1, hm = poses[m], x = hm.x + 4, y = hm.y - 18 + hm.dy;
        st.rect(x, y, 8, 6, "#efe0bc"); st.rect(x, y, 8, 1, "#d8c8a0");
        const k = clamp(lt / p.dur, 0, 1);
        for (let q = 0; q < 10 * k; q++) st.px(x + 1 + (q % 6), y + 2 + ((q / 6) | 0) * 2, "#5a4a3a");
      }
      if (env.pace === "push") st.uiDraw((o) => { o.fillStyle = "rgba(240,230,210,0.5)"; for (let k = 0; k < 6; k++) { const y = 30 + hash(k, 1, 3) * 60, x = ((k * 53 - lt * 400) % 220 + 220) % 220 - 20; o.fillRect(R(x), R(y), 14, 1); } });
    } };
  }
  function settle(env, S, dur) {
    const s0 = Object.assign({}, S);
    return { dur: dur || 0.6, ev: [], draw(st) {
      room(st, s0);
      if (S.camp) { campScene(st, env, S.camp); return; }
      crew(st, s0, s0.poses);
    } };
  }

  // fear: the room goes cold and the edges crawl; the fearful freeze while the rest walk on, and a crewmate may turn back
  const PHANTOM = { spiders: "spider", "beasts": "rat", rats: "rat", "crawling things": "rat", bats: "bat", "the dead": "skull", ghosts: "wisp", "being forgotten": "wisp",
    statues: "skull", "deep water": "water", "water rising": "water", fire: "flame", heat: "flame", "tight spaces": "walls", "being buried alive": "walls", "the cold": "frost" };
  function fearClip(env, S, b) {
    const who = (b.r || []).map(([id, res, fear]) => ({ i: idxOf(env, id), res, fear })).filter((x) => x.i >= 0);
    const frozen = new Set((b.frozen || []).map((id) => idxOf(env, id)));
    const s0 = Object.assign({}, S), dur = 3.2, scared = new Set(who.map((w) => w.i));
    const helper = [...env.crew.keys()].find((i) => !scared.has(i));
    const ph = PHANTOM[(who[0] || {}).fear] || "eyes";
    const ev = [[0.1, "dread", 1], [0.6, "beat", 0.9], [1.3, "beat", 1]];
    if (who.some((w) => w.res !== "pass") && helper != null) ev.push([1.4, "step", 1]);
    return { dur, ev, who, draw(st, lt) {
      room(st, s0);
      const anyBad = who.some((w) => w.res === "bad" || frozen.has(w.i));
      const k = seg(lt, 0, 0.7) * (1 - (anyBad ? 0 : seg(lt, 2.2, 3.0) * 0.8));
      st.post.fear = k * 0.7; st.post.warp = k;
      phantom(st, ph, k, lt);
      const poses = {};
      for (let i = 0; i < env.crew.length; i++) {
        const hm = D.home(env, i), w = who.find((q) => q.i === i);
        if (!w) { const go = seg(lt, 0.2, 1.4) * 12; poses[i] = walkPose(st, hm.x + go, hm.y, lt < 1.4 ? 6 : 0); if (lt >= 1.4) poses[i] = { x: hm.x + 12, y: hm.y, frame: 0 }; continue; }
        const shake = lt > 0.4 ? (Math.floor(st.T * 20) % 2) : 0, held = w.res === "pass" ? lt < 1.8 : w.res === "fail" ? lt < 2.2 : true;
        poses[i] = { x: hm.x + shake + (held ? 0 : seg(lt, w.res === "pass" ? 1.8 : 2.2, 3.0) * 12), y: hm.y, frame: 0, tint: held ? "#7a9ad8" : null, ta: 0.35 * seg(lt, 0.3, 0.8) };
        if (held && lt > 0.5) { const bx = bbox(D.heroCanvas(env.crew[i], 0)); sweat(st, hm.x + 5, hm.y - bx.h + 4, lt); }
        if (w.res === "pass" && lt > 1.5 && lt < 1.9) poses[i].flip = Math.floor(lt * 10) % 2 === 0;
      }
      const need = who.find((w) => w.res === "fail" && !frozen.has(w.i));
      if (need && helper != null) {
        const hm = D.home(env, helper), to = D.home(env, need.i).x + 8;
        if (lt > 1.2 && lt < 2.3) { const u = seg(lt, 1.2, 1.7); poses[helper] = Object.assign(walkPose(st, lerp(hm.x + 12, to, u), hm.y, u < 1 ? 6 : 0, true), u >= 1 ? { frame: 0, dy: 0 } : {}); }
        else if (lt >= 2.3) poses[helper] = walkPose(st, lerp(to, hm.x + 12, seg(lt, 2.3, 3.0)), hm.y, 6);
        if (lt > 1.75 && lt < 2.3) mark(st, "!", to + 2, hm.y - tall(env, helper) - 8, "#fff0c0");
      }
      crew(st, s0, poses);
      for (const w of who) if (lt > 0.35 && lt < 0.9) mark(st, "!", D.home(env, w.i).x, D.home(env, w.i).y - tall(env, w.i) - 8, "#bfe0ff");
    } };
  }
  function phantom(st, kind, k, lt) {
    if (k <= 0) return;
    const T = st.T;
    for (let s = 0; s < 2; s++) {
      const ex = s ? W - 14 : 8;
      if (kind === "spider") for (let q = 0; q < 2; q++) { const x = ex + q * 6 - (s ? 6 : 0), y = 10 + (Math.sin(T * 1.5 + q + s) * 0.5 + 0.5) * 30 * k; st.line(x, 0, x, y, "#c8c4bc"); st.rect(x - 1, y, 3, 2, "#0a0806"); st.px(x - 2, y + 1, "#0a0806"); st.px(x + 2, y + 1, "#0a0806"); st.px(x, y, "#c02020", true); }
      else if (kind === "rat") for (let q = 0; q < 3; q++) { const x = ((T * 40 + q * 37 + s * 80) % 200) - 10, y = 96 - q; if (bay(q, 1) < k) { st.rect(x, y - 2, 4, 2, "#2a2420"); st.px(x + 4, y - 2, "#2a2420"); st.px(x - 1, y - 1, "#4a3a30"); st.px(x + 4, y - 3, "#ff4030", true); } }
      else if (kind === "bat") for (let q = 0; q < 3; q++) { const x = ((T * 55 + q * 61 + s * 90) % 220) - 20, y = 8 + q * 6 + Math.sin(T * 9 + q) * 3, f = Math.floor(T * 10 + q) % 2; st.px(x, y, "#100c0c"); st.line(x - 3, y - f, x, y, "#100c0c"); st.line(x + 3, y - f, x, y, "#100c0c"); }
      else if (kind === "skull" || kind === "wisp") for (let q = 0; q < 2; q++) { const y = 20 + q * 26 + Math.sin(T * 1.3 + q) * 3, x = ex + (s ? -2 : 2); if (kind === "skull") { st.rect(x - 2, y, 5, 4, "#c8d0c8"); st.px(x - 1, y + 1, "#000"); st.px(x + 1, y + 1, "#000"); } else for (let j = 0; j < 8; j++) st.px(x + Math.sin(T * 3 + j * 0.7 + q) * 2, y + j, "#b8d8e8", true); }
      else if (kind === "water") { st.ctx.fillStyle = "rgba(20,50,80,0.55)"; const y = H - 18 * k; st.ctx.fillRect(0, y, W, H - y); }
      else if (kind === "flame") for (let q = 0; q < 3; q++) st.flame(ex + q * 3 - (s ? 6 : 0), 80 + q * 4, true);
      else if (kind === "walls") { st.ctx.fillStyle = "#050404"; const w = R(18 * k * seg(lt, 0, 1.2)); st.ctx.fillRect(s ? W - w : 0, 0, w, H); }
      else if (kind === "frost") for (let q = 0; q < 60 * k; q++) st.px(s ? W - 1 - hash(q, 1, 3) * 24 * k : hash(q, 1, 3) * 24 * k, hash(q, 2, 3) * H, "#e8f6ff");
      else for (let q = 0; q < 3; q++) { const y = 18 + q * 22 + (s * 9), x = ex + (q % 2) * 4, open = (T * 0.7 + q * 0.37 + s * 0.2) % 2 > 0.15; if (open && bay(q, s) < k * 1.4) { st.px(x, y, "#ffd040", true); st.px(x + 3, y, "#ffd040", true); } }
    }
  }

  // traps
  const FAMILY = { dart_wall: "darts", harpoon: "darts", rockfall: "drop", icicle_door: "drop", deadfall: "drop", rotten_beam: "drop", falling_lid: "drop", portcullis: "drop", bucket: "drop",
    spiked_pit: "pit", sinkhole: "pit", thin_ice: "pit", slag_pool: "pit", leech_pool: "pit", bear_trap: "jaws", swinging_blade: "blade", rolling_stone: "roll",
    snare: "snare", tripwire: "snare", web_line: "snare", gas_pocket: "cloud", glyph: "cloud", whispering_door: "cloud", hag_charm: "cloud", tide_room: "cloud",
    flame_vent: "jet", bell_line: "noise", bone_pile: "noise", ice_slide: "slide" };
  const wireTrap = (tid) => ["tripwire", "snare", "web_line", "bell_line"].includes(tid);
  const SND = { darts: "whoosh", drop: "thud", pit: "crack", jaws: "slam", blade: "whoosh", roll: "rumble", snare: "boing", cloud: "hiss", jet: "hiss", noise: "alarm", slide: "whoosh" };
  function spotClip(env, S, b) {
    const s0 = Object.assign({}, S), i = lead(env, b), res = (b.r && b.r[0] && b.r[0][1]) || "pass";
    if (b.c === "map") {
      S.trapMark = "live"; S.dx = (S.dx || 0) + 64;
      return { dur: 2.6, ev: [[0.2, "scribble", 1], [0.9, "pop", 1]], draw(st, lt) {
        room(st, Object.assign({}, s0, { trapMark: lt > 0.9 ? "live" : null }));
        const poses = {};
        for (let q = 0; q < env.crew.length; q++) {
          const hm = D.home(env, q), u = seg(lt, 1.0 + q * 0.12, 2.4), x = hm.x + (s0.dx || 0) + u * 64, y = hm.y - Math.sin(u * Math.PI) * 14;
          poses[q] = u > 0 && u < 1 ? walkPose(st, x, y, 6) : { x, y, frame: 0 };
        }
        crew(st, s0, poses);
        if (lt < 1.2) { const p = poses[0], x = p.x + 3, y = p.y - 20; st.rect(x, y, 10, 7, "#efe0bc"); st.rect(x, y, 10, 1, "#d8c8a0"); if (lt > 0.6) { st.px(x + 6, y + 3, "#c02a1a"); st.px(x + 5, y + 2, "#c02a1a"); st.px(x + 7, y + 4, "#c02a1a"); st.px(x + 7, y + 2, "#c02a1a"); st.px(x + 5, y + 4, "#c02a1a"); } }
      } };
    }
    if (res === "pass") {
      S.trapMark = "live";
      return { dur: 1.7, ev: [[0.5, "pop", 1]], draw(st, lt) {
        room(st, s0);
        const poses = {};
        for (let q = 0; q < env.crew.length; q++) { const hm = D.home(env, q), u = seg(lt, 0, q === i ? 0.45 : 0.75); poses[q] = u < 1 ? walkPose(st, hm.x + (s0.dx || 0) + u * 10, hm.y, 6) : { x: hm.x + (s0.dx || 0) + 10, y: hm.y, frame: 0 }; }
        crew(st, s0, poses);
        if (lt > 0.45) { trapMark(st, seg(lt, 0.6, 1.4), false); mark(st, "!", poses[i].x, poses[i].y - tall(env, i) - 8); }
      } };
    }
    return { dur: 0.9, ev: [[0.85, "click", 1]], draw(st, lt) {
      room(st, s0);
      const poses = {};
      for (let q = 0; q < env.crew.length; q++) { const hm = D.home(env, q); poses[q] = walkPose(st, hm.x + (s0.dx || 0) + seg(lt, 0, 0.85) * 24, hm.y, 6); }
      crew(st, s0, poses);
      if (lt > 0.82) st.text("CLICK", R(poses[0].x + 4), R(poses[0].y - 6), "#fff0c0", { outline: "#1a1008" });
    }, after: () => { S.dx = (S.dx || 0) + 24; } };
  }
  function handleClip(env, S, b) {
    const s0 = Object.assign({}, S), i = lead(env, b), res = (b.r && b.r[0] && b.r[0][1]) || "pass", h = env.crew[i] || {};
    if (b.c === "round" || !b.r) {
      S.dx = (S.dx || 0) + 70;
      return { dur: 2.6, ev: [[0.3, "step", 1], [1.0, "step", 1], [1.7, "step", 1]], draw(st, lt) {
        room(st, Object.assign({}, s0, { trapMark: "live" }));
        const poses = {};
        for (let q = 0; q < env.crew.length; q++) {
          const hm = D.home(env, q), u = seg(lt, q * 0.25, 1.7 + q * 0.25), x = hm.x + (s0.dx || 0) + u * 70, y = hm.y - Math.sin(u * Math.PI) * 16;
          poses[q] = u > 0 && u < 1 ? walkPose(st, x, y, 5) : { x, y, frame: 0 };
        }
        crew(st, s0, poses);
      } };
    }
    if (res === "pass") S.trapMark = "dead";
    if (b.c === "brace") {
      return { dur: 2.2, ev: [[0.4, "creak", 1], [1.4, res === "pass" ? "crack" : "slam", 1]], draw(st, lt) {
        room(st, Object.assign({}, s0, { trapMark: "live" }));
        const hm = D.home(env, i), poses = { [i]: { x: hm.x + (s0.dx || 0) + 22 + (lt > 0.3 && lt < 1.4 ? Math.floor(st.T * 24) % 2 : 0), y: hm.y, frame: 1 } };
        crew(st, s0, poses);
        if (lt > 1.4 && res === "pass") { dustCloud(st, poses[i].x + 12, poses[i].y - 6, seg(lt, 1.4, 2.2), 16); for (let k = 0; k < 6; k++) { const u = seg(lt, 1.4, 2.0); st.rect(poses[i].x + 10 + k * 3 + u * (k - 3) * 6, poses[i].y - 20 + arc(u, 10) + u * 20, 3, 1, WOOD[3]); } }
        if (lt > 0.3 && lt < 1.4) sweat(st, poses[i].x - 4, poses[i].y - tall(env, i) + 2, lt);
      } };
    }
    const glowHands = b.c === "dispel";
    return { dur: 2.8, ev: [[0.3, "scrape", 0.6], [1.8, res === "pass" ? "click" : "slam", 1]].concat(glowHands ? [[0.4, "glow", 1]] : []), close: true, draw(st, lt) {
      closeBg(st);
      const jit = lt < 1.8 ? Math.sin(st.T * 30) * (0.5 + seg(lt, 0.5, 1.8)) : 0;
      if (glowHands) {
        for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; st.px(90 + Math.cos(a) * 30, 56 + Math.sin(a) * 12, res === "pass" && lt > 1.8 ? "#5a5a5a" : lt > 1.8 ? "#ff6a3a" : "#ffb050", !(res === "pass" && lt > 1.8)); }
        st.light(90, 56, 50, res === "pass" && lt > 1.8 ? [0.3, 0.3, 0.3] : [1, 0.6, 0.3], 0.8);
      } else if (env.rec.tid === "bear_trap") {
        // a jaw trap close-up: the toothed ring open on the floor, the pan in the middle; a pass wedges a stake between the jaws, a fail
        // lets them shut
        const shut = res !== "pass" ? ease(seg(lt, 1.8, 1.95)) : 0, open = 1 - shut;
        for (let k = 0; k <= 28; k++) {
          const a = Math.PI + (k / 28) * Math.PI, rx = 34, ry = 14 * open + 2;
          const x = R(90 + Math.cos(a) * rx), yt = R(52 + Math.sin(a) * ry), yb = R(52 - Math.sin(a) * ry);
          st.rect(x, yt, 1, 2, IRON[3]); st.rect(x, yb - 1, 1, 2, IRON[2]);
          if (k % 3 === 1) { st.px(x, yt + 2, IRON[4], true); st.px(x, yb - 2, IRON[4], true); }
        }
        st.rect(56, 51, 68, 2, IRON[1]); st.rect(84, 49, 12, 6, IRON[2]); st.rect(85, 50, 10, 1, IRON[4]);
        if (res === "pass" && lt > 1.2) { const u = ease(seg(lt, 1.2, 1.7)); st.rect(R(lerp(140, 88, u)), 41, 3, 22, WOOD[3]); st.rect(R(lerp(140, 88, u)), 41, 1, 22, WOOD[4]); }
      } else {
        const slack = res === "pass" ? seg(lt, 1.8, 2.3) : 0, snap = res !== "pass" && lt > 1.8;
        for (let x = 0; x < W; x++) { const sag = Math.sin((x / W) * Math.PI) * slack * 22; if (!snap || Math.abs(x - 90) > (lt - 1.8) * 140) st.rect(x, R(44 + sag), 1, 2, IRON[3]); }
        st.rect(84, 39, 12, 9, GOLD[2]); st.rect(84, 39, 12, 2, GOLD[3]); st.rect(88 + (snap ? R((lt - 1.8) * 60) : 0), 36 - (snap ? R((lt - 1.8) * 40) : 0), 4, 3, IRON[3]);
      }
      hands(st, 90, 62, h, jit, glowHands ? null : "pick");
      if (glowHands && lt < 1.8) sparkle(st, 90, 54, (lt * 1.3) % 1, "#ffb050", 10);
      if (lt > 1.8 && lt < 2.6) st.text(res === "pass" ? "...CLICK." : "SNAP!", 90, 18, res === "pass" ? "#fff0c0" : "#ffb0a0", { center: true, outline: "#1a1008", k: res === "pass" ? 1 : 2 });
    } };
  }
  function reactClip(env, S, b, spring) {
    const fam = FAMILY[env.rec.tid] || (spring && (env.kind === "chest" || env.kind === "secret") ? "needle" : "darts"), s0 = Object.assign({}, S);
    const hit = {}; for (const [id, hp, inj] of b.hit || []) hit[id] = { hp, inj };
    const who = (b.r || []).map(([id, res]) => ({ i: idxOf(env, id), res: res === "sprung" ? "fail" : res, hp: (hit[id] || {}).hp || 0 })).filter((w) => w.i >= 0);
    if (!who.length && env.crew.length) who.push({ i: 0, res: "fail", hp: 0 });
    // a bear trap that holds on: a crewmate comes over and prises the jaws apart before the crew can go on
    const stuck = fam === "jaws" && b.extra === "stuck" ? who.find((w) => w.res !== "pass") : null, freer = stuck ? [...env.crew.keys()].find((i) => i !== stuck.i) : null;
    const t0 = 0.7, dur = 2.9 + who.length * 0.15 + (stuck && freer != null ? 1.7 : 0), comic = ["snare", "pit", "slide", "jaws"].includes(fam);
    const ev = [[0.1, "click", 1], [t0, SND[fam] || "hiss", 1]];
    who.forEach((w, k) => ev.push([t0 + 0.35 + k * 0.15, w.res === "pass" ? "step" : fam === "snare" ? "boing" : fam === "pit" ? "splash" : "hit", 1]));
    if (fam === "needle") ev.unshift([0.05, "hiss", 0.8]);
    if (stuck && freer != null) ev.push([t0 + 1.7, "scrape", 0.8], [t0 + 2.1, "creak", 0.8], [t0 + 2.55, "clunk", 1]);
    if (b.extra === "alarm" || fam === "noise") ev.push([t0 + 0.2, "alarm", 1]);
    const after = {};
    for (const w of who) if (w.res !== "pass") {
      if (env.rec.tid === "bucket") (S.goo = Object.assign({}, S.goo))[w.i] = 1;
      if (env.rec.tid === "tide_room" || env.rec.tid === "sinkhole" || env.rec.tid === "leech_pool" || env.rec.tid === "thin_ice") (S.wet = Object.assign({}, S.wet))[w.i] = 1;
      if (fam === "jet" || env.rec.tid === "slag_pool") (S.soot = Object.assign({}, S.soot))[w.i] = 1;
    }
    if (fam === "pit") after.pit = 1;
    const dangle = fam === "snare" && env.rec.tid === "snare" ? who.find((w) => w.res !== "pass") : null;
    if (dangle) S.poses = Object.assign({}, S.poses, { [dangle.i]: { dangle: true } });
    return { dur, ev, draw(st, lt) {
      room(st, Object.assign({}, s0, { pitOpen: fam === "pit" && lt > t0 ? 1 : s0.pitOpen }));
      const T = lt - t0, poses = {};
      for (let q = 0; q < env.crew.length; q++) { const hm = D.home(env, q); poses[q] = { x: hm.x + (s0.dx || 0), y: hm.y, frame: 0 }; }
      if (fam === "needle") {
        const [fx, fy] = env.bg.A.focus;
        if (lt < t0 + 0.2) st.text("PSSST", fx, fy - 30, "#c8f0a0", { center: true, outline: "#1a1008" });
        for (let k = 0; k < 14; k++) { const u = seg(lt, 0.1, 1.4), a = hash(k, 1, 6) * Math.PI * 2; if (u > 0 && u < 1) st.px(fx + Math.cos(a) * u * 14, fy - 10 + Math.sin(a) * u * 6 - u * 8, bay(k, 2) < 1 - u ? "#a8d870" : null, true); }
      }
      if (fam === "jaws" && lt < t0 && who[0]) bearTrap(st, poses[who[0].i].x + 2, poses[who[0].i].y + 1, 0, false);
      who.forEach((w, k) => {
        const p = poses[w.i], tt = T - k * 0.15, h = tall(env, w.i);
        if (tt < 0) return;
        const u = clamp(tt / 0.5, 0, 1);
        trapFx(st, fam, env.rec.tid, p.x, p.y, h, tt, w.res);
        if (w.res === "pass") {
          if (fam === "roll" || fam === "pit" || fam === "jaws" || fam === "snare") p.dy = arc(u, 10);
          else if (fam === "blade" || fam === "darts") p.dy = tt < 0.6 ? 4 : 0;
          else { p.x -= ease(u) * 6; p.dy = arc(u, 5); }
          if (u >= 1 && tt < 1.0) puff(st, p.x, p.y, (tt - 0.5) * 2);
          return;
        }
        const flash = tt > 0.25 && tt < 0.37;
        if (flash) Object.assign(p, { tint: "#ffffff", ta: 0.6 });
        if (fam === "snare" && env.rec.tid === "snare") { const up = ease(seg(tt, 0.25, 0.7)); Object.assign(p, { rot: up > 0.5 ? 2 : 0, dy: -up * 34, x: p.x + Math.sin(st.T * 3) * 3 * up, noTorch: true }); if (up > 0.2) st.line(p.x, 0, p.x, p.y - up * 34 - (up > 0.5 ? h : 2), "#a88a5a"); }
        else if (fam === "snare" && env.rec.tid === "tripwire") { if (tt > 0.3 && tt < 1.4) Object.assign(p, { rot: 1, dy: 0, x: p.x + 8 }); }
        else if (fam === "snare") { if (tt > 0.3) for (let q = 0; q < 6; q++) st.line(p.x - 7 + q * 3, p.y - h, p.x + 7 - q * 2, p.y - 2, "#e8e4dc"); p.x += tt > 0.3 ? Math.floor(st.T * 12) % 2 : 0; }
        else if (fam === "pit") { const dn = tt < 0.3 ? 0 : tt < 1.4 ? 14 : 14 - seg(tt, 1.4, 1.9) * 14; Object.assign(p, { dy: dn, clipY: p.y - 3 }); }
        else if (fam === "slide") { const o = tt < 0.3 ? 0 : tt < 1.0 ? easeIn(seg(tt, 0.3, 1.0)) * 140 : 140 - seg(tt, 1.2, 2.2) * 140; p.x += o; p.flip = tt > 1.1; }
        else if (fam === "jaws") { p.dy = tt > 0.3 ? -Math.abs(Math.sin(st.T * 12)) * 3 : 0; }
        else if (fam === "roll" || fam === "blade") { if (tt > 0.3 && tt < 1.3) Object.assign(p, { rot: 3, x: p.x - 8 }); }
        else { p.x -= ease(seg(tt, 0.25, 0.45)) * 7; p.dy = arc(seg(tt, 0.25, 0.5), 3); }
        if (tt > 0.45 && tt < 1.8 && !(fam === "snare" && env.rec.tid === "snare")) stars(st, p.x, p.y - h - 2 + (p.dy || 0), st.T);
        if (fam === "cloud" && env.rec.tid === "gas_pocket" && tt > 0.4) Object.assign(p, { tint: "#8ac050", ta: 0.35 * seg(tt, 0.4, 0.8) });
        if (fam === "needle" && tt > 0.3) { p.x -= 3; puff(st, p.x + 6, p.y - h + 4, (tt % 0.6) / 0.6, "#a8d870", 5); }
      });
      if (dangle && lt > t0 + 0.8) poses[dangle.i].noTorch = true;
      if (stuck && freer != null) {
        const ps = poses[stuck.i], hm = D.home(env, freer), to = ps.x + 12, u = seg(T, 1.0, 1.5), back = seg(T, 2.9, 3.4);
        if (T > 1.0) poses[freer] = back > 0 ? walkPose(st, lerp(to, hm.x + (s0.dx || 0), back), hm.y, back < 1 ? 7 : 0) : u < 1 ? walkPose(st, lerp(hm.x + (s0.dx || 0), to, u), hm.y, 7, to < hm.x) : { x: to + (T < 2.55 ? Math.floor(st.T * 16) % 2 : 0), y: ps.y, frame: 1, flip: true, dy: 1 };
        if (T > 1.5 && T < 2.55) { sweat(st, to - 3, ps.y - tall(env, freer) + 4, lt); st.line(to - 5, ps.y - 6, ps.x + 4, ps.y - 1, IRON[3]); }
        if (T > 1.6 && T < 2.5) mark(st, "HNNG", to, ps.y - tall(env, freer) - 8, "#fff0c0");
        if (T > 2.55) { const f = seg(T, 2.55, 2.95); ps.dy = arc(f, 8); if (T < 2.85) mark(st, "FREE!", ps.x, ps.y - tall(env, stuck.i) - 16, "#c8f0a0"); }
      }
      crew(st, s0, poses, { noLight: false });
      // the jaws close in front of the leg they catch
      if (fam === "jaws") who.forEach((w, k) => { const tt = T - k * 0.15, hm = D.home(env, w.i); if (tt >= 0) bearTrap(st, hm.x + (s0.dx || 0) + 2, hm.y + 1, w.res === "pass" ? seg(tt, 0.15, 0.3) : stuck === w && freer != null && tt > 2.55 ? 1 - seg(tt, 2.55, 2.7) * 0.85 : seg(tt, 0, 0.18), w.res !== "pass" && tt < 2.55); });
      if (lt > 0.1 && lt < t0 + 0.1 && fam !== "needle") { st.text("CLICK", R(poses[0].x + 2), R(poses[0].y - 4), "#fff0c0", { outline: "#1a1008" }); if (lt > 0.3) for (let q = 0; q < env.crew.length; q++) mark(st, "!", poses[q].x, poses[q].y - tall(env, q) - 6, "#ffb070"); }
      if ((b.extra === "alarm" || fam === "noise") && lt > t0) for (let q = 0; q < env.crew.length; q++) if (Math.floor(st.T * 6) % 2) mark(st, "!", poses[q].x, poses[q].y - tall(env, q) - 8, "#ff8060");
    }, after: () => { if (after.pit) S.pitOpen = 1; } };
  }
  // what each trap does, drawn at the hero it reaches (x, y: their feet; t: seconds since it fired)
  function trapFx(st, fam, tid, x, y, h, t, res) {
    const TH = st.env.T, T = st.T;
    if (fam === "darts") {
      const n = tid === "harpoon" ? 1 : 3;
      for (let k = 0; k < n; k++) {
        const u = (t / 0.32 - k * 0.18) * (res === "pass" ? 0.55 : 1);
        if (u < 0) continue;
        if (u >= 1 && res !== "pass") continue;
        const L = tid === "harpoon" ? 14 : 7, dx = lerp(172, res === "pass" ? 8 : x + 6, clamp(u, 0, 1) ** 0.8), dy = R(y - h * 0.55 - k * 5 + 3), stuck = u >= 1;
        if (!stuck) for (let q = 1; q < 10; q++) if (bay(q, k) < 1 - q / 10) st.px(dx + L + 2 + q, dy, "#d8d0c0", true);
        st.rect(R(dx), dy, L, 1, tid === "harpoon" ? IRON[4] : "#e8e0d0", true); st.px(dx - 1, dy, IRON[4], true);
        st.rect(R(dx + L), dy - 1, 2, 3, "#c83a2a", true);
      }
        } else if (fam === "drop") {
      const u = clamp(t / 0.3, 0, 1), yy = lerp(0, y - h + 2, easeIn(u)), land = res === "pass" ? y - 2 : y - h;
      const fy = u < 1 ? yy : res === "pass" ? y - 2 : land;
      if (tid === "rockfall" || tid === "deadfall" || tid === "rotten_beam" || tid === "falling_lid") {
        const w = tid === "rockfall" ? 5 : 16; st.rect(R(x - w / 2), R(fy - 4), w, 4, tid === "rockfall" ? TH.ramp[3] : tid === "falling_lid" ? "#727a78" : WOOD[2]); st.rect(R(x - w / 2), R(fy - 4), w, 1, tid === "rockfall" ? TH.ramp[4] : WOOD[4]);
        if (u >= 1 && t < 1.0) dustCloud(st, x, y - 2, (t - 0.3) / 0.7, 12);
      } else if (tid === "icicle_door") { for (let k = 0; k < 3; k++) { const ix = x - 4 + k * 4; st.line(ix, fy - 6 - k, ix, fy - k, "#d8f0fa"); } }
      else if (tid === "portcullis") { const by = lerp(0, y, easeIn(u)); for (let k = 0; k < 4; k++) st.rect(x + 10 + k * 3, 0, 1, R(by), IRON[2]); st.rect(x + 9, R(by) - 2, 12, 1, IRON[3]); }
      else if (tid === "bucket") { st.rect(x - 3, 2, 6, 5, WOOD[2]); if (t > 0.1 && t < 0.7) for (let k = 0; k < 8; k++) st.px(x - 2 + (k % 4), 7 + (t - 0.1) * 80 - k * 3, "#7ab040"); }
    } else if (fam === "pit") {
      if (tid === "thin_ice") for (let k = 0; k < 6; k++) st.line(x, y, x + Math.cos(k) * 8, y + Math.sin(k) * 2, "#e8f8ff");
      if (tid === "slag_pool" && t < 1.5) for (let k = 0; k < 5; k++) st.px(x - 4 + k * 2, y - 2 - ((t * 20 + k * 3) % 8), "#ff9a30", true);
      if (tid === "sinkhole" || tid === "leech_pool") for (let k = 0; k < 6; k++) st.px(x - 6 + k * 2, y - 1 + (k % 2), "#5a7a3a");
    } else if (fam === "jaws") {
      if (t > 0.18 && t < 0.7) st.text("SNAP!", R(x), R(y - h - 14), "#ffb0a0", { center: true, outline: "#1a1008" });
    } else if (fam === "blade") {
      const a = Math.sin(clamp(t / 0.7, 0, 1) * Math.PI - Math.PI / 2) * 1.0, px = x + 8, L = 56, bx = px + Math.sin(a) * L, by = Math.cos(a) * L;
      st.line(px, 0, bx, by, IRON[2]); st.line(px + 1, 0, bx + 1, by, IRON[1]);
      for (let k = -7; k <= 7; k++) for (let j = 0; j < 3 - Math.abs(k) / 3; j++) st.px(bx + k, by + Math.abs(k) * 0.4 + j, j === 0 ? IRON[4] : IRON[3], true);
    } else if (fam === "roll") {
      const bx = lerp(200, x - 30, clamp(t / 0.9, 0, 1)), by = y - 8;
      for (let j = -9; j <= 9; j++) for (let i = -9; i <= 9; i++) { const d2 = i * i + j * j; if (d2 <= 81) st.px(bx + i, by - 2 + j, d2 > 64 ? TH.ramp[0] : (Math.floor((Math.atan2(j, i) - bx * 0.15) * 2) & 1) ? TH.ramp[4] : TH.ramp[3]); }
      if (t < 1.2) dustCloud(st, bx + 8, y - 2, (t * 2) % 1, 8);
    } else if (fam === "snare") {
      if (tid === "tripwire" || tid === "web_line") st.line(x - 10, y - 4, x + 14, y - 4, tid === "web_line" ? "#e8e4dc" : "#c8b890");
    } else if (fam === "cloud") {
      const u = clamp(t / 0.8, 0, 1);
      if (tid === "gas_pocket") for (let k = 0; k < 40; k++) { const a = hash(k, 1, 9) * Math.PI * 2, r = u * (10 + hash(k, 2, 9) * 12); if (bay(k, R(t * 6)) < 1 - u * 0.6) st.px(x + Math.cos(a) * r, y - 10 + Math.sin(a) * r * 0.6 - u * 6, k % 3 ? "#8ac050" : "#b0e070", true); }
      else if (tid === "glyph") { for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; st.px(x + Math.cos(a) * (8 + u * 4), y + Math.sin(a) * 2.5, t < 1.0 ? "#ff7a3a" : "#7a4a3a", t < 1.0); } if (t < 0.6 && res !== "pass") st.line(x, y - 2, x + 2, y - h, "#fff0a0", true); }
      else if (tid === "tide_room") { st.ctx.fillStyle = "rgba(20,70,90,0.6)"; const wy = y - 4 - u * 12 + Math.sin(T * 4) * 0.8; st.ctx.fillRect(x - 8, wy, 16, y + 4 - wy); }
      else for (let k = 0; k < 10; k++) st.px(x + Math.sin(T * 4 + k) * 9, y - 6 - k * 2.5 + Math.cos(T * 3 + k) * 2, "#b8d0e8", true);
    } else if (fam === "jet") {
      if (t < 0.9) for (let j = 0; j < 22; j++) { const w = 2 + (j % 3 === 0 ? 1 : 0); for (let i = -w; i <= w; i++) st.px(x + 6 + i + Math.sin(T * 30 + j) * 1, y - j, j < 6 ? "#fff0a0" : j < 14 ? "#ffa030" : "#e04a1a", true); }
      st.light(x + 6, y - 10, 40, [1, 0.6, 0.25], t < 0.9 ? 1 : 0);
    } else if (fam === "noise") {
      if (tid === "bell_line") { st.line(x - 20, 40, x + 30, 44, "#c8b890"); for (let k = 0; k < 4; k++) { const bx = x - 14 + k * 12, j = Math.sin(T * 30 + k) * 1.5; st.rect(R(bx + j), 42, 3, 3, GOLD[3]); } }
      else bones(st, x + 10, y);
    }
  }
  // a bear trap: a chain to a stake, and a toothed steel ring that lies open on the floor (k 0) and stands up clamped shut (k 1)
  function bearTrap(st, x, y, k, caught) {
    const O = "#0e0a08", S = ["#3a3a42", "#6a6a74", "#a4a6b0", "#dfe3ea"], rx = 12, h = 2 + k * 10;
    st.rect(x - 24, y - 6, 3, 7, WOOD[2]); st.px(x - 24, y - 6, WOOD[4]); st.px(x - 22, y - 6, WOOD[1]);
    for (let i = -21; i <= -14; i++) { st.px(x + i, y - ((i & 1) ? 0 : 1), (i & 1) ? S[1] : S[3]); st.px(x + i, y + ((i & 1) ? 1 : 0), O); }
    st.rect(x - 15, y - 1, 30, 3, O); st.rect(x - 14, y - 1, 28, 1, S[1]); st.rect(x - 4, y - 2, 8, 2, S[2]); st.rect(x - 4, y - 2, 8, 1, S[3]);
    for (const sx of [x - 15, x + 12]) { st.rect(sx, y - 3, 4, 4, O); st.rect(sx, y - 3, 3, 3, S[2]); st.px(sx, y - 3, S[3]); }
    // two toothed jaws hinged at the ends: open they lie flat, front and back; shut they both stand up round the leg
    for (const side of [-1, 1]) {
      for (let a = 0; a <= 40; a++) {
        const t = (a / 40) * Math.PI, X = R(x - Math.cos(t) * rx), lift = Math.sin(t), Y = R(y - 1 + lerp(side * lift * 4, -lift * h, k));
        st.px(X, Y + 1, O); st.px(X, Y, side < 0 ? S[3] : S[2]); st.px(X, Y - 1, O);
        if (a % 5 === 2 && a > 2 && a < 38) {
          const up = k > 0.5 ? -1 : -side, off = k > 0.5 && side > 0 ? 1 : 0;
          st.px(X + off, Y + up, "#f4f6fa"); st.px(X + off, Y + up * 2, k > 0.5 ? S[2] : "#c8ccd4");
        }
      }
    }
    if (k >= 1 && caught) for (let q = 0; q < 5; q++) st.px(x - 4 + q * 2, y - h - 4 - (q % 2), q % 2 ? "#ffffff" : "#fff0a0", true);
  }
  function bones(st, x, y) { for (let k = 0; k < 5; k++) st.rect(x + k * 3 + Math.sin(st.T * 25 + k), y - 2 - (k % 2), 3, 1, BONE[3]); }

  // chests
  function chestLook(env, S, b) {
    const s0 = Object.assign({}, S), i = lead(env, b), found = (b.next === "found");
    return { dur: 1.6, ev: [[0.5, "scrape", 0.4]].concat(found ? [[1.2, "pop", 1]] : []), draw(st, lt) {
      room(st, s0);
      const [fx, fy] = env.bg.A.focus, poses = { [i]: kneelPose(st, env, i, fx - 16, fy + 1, lt) };
      crew(st, s0, poses);
      const gx = fx - 4 + Math.sin(lt * 4) * 6, gy = fy - 12;
      st.px(gx, gy, "#ffffff", true); st.px(gx + 1, gy - 1, "#cfe8ff", true);
      if (found && lt > 1.2) { mark(st, "!", fx, fy - 26, "#ff6a50"); st.px(fx + 1, fy - 9, "#a8ff70", true); }
    } };
  }
  function kneelPose(st, env, i, x, y, lt) {
    const hm = D.home(env, i), u = seg(lt, 0, 0.45);
    return u < 1 ? walkPose(st, lerp(hm.x, x, u), lerp(hm.y, y, u), 7) : { x, y, frame: 0, dy: 3, clipY: y - 2 };
  }
  function chestOpen(env, S, b) {
    const s0 = Object.assign({}, S), i = lead(env, b), res = (b.r && b.r[0] && b.r[0][1]) || "pass", force = b.c === "force" || b.c === "shake";
    const ev = [], dur = force ? 2.3 : res === "partial" ? 2.6 : 2.0;
    if (force) { ev.push([0.6, "creak", 1]); ev.push([1.6, res === "fail" ? "boing" : "crack", 1]); if (res === "partial") ev.push([1.7, "clink", 0.6]); }
    else { for (let t = 0.6; t < dur - 0.6; t += 0.32) ev.push([t, "click", 0.4]); ev.push([dur - 0.5, res === "fail" ? "clunk" : "click", 1.2]); }
    if (res !== "fail") S.chest = force ? "broken" : "unlocked";
    return { dur, ev, draw(st, lt) {
      const [fx, fy] = env.bg.A.focus, done = lt > (force ? 1.6 : dur - 0.5);
      room(st, Object.assign({}, s0, { chest: done && res !== "fail" ? (force ? "broken" : "unlocked") : s0.chest }));
      let p;
      if (force) {
        const hm = D.home(env, i), u = seg(lt, 0, 0.5);
        p = u < 1 ? walkPose(st, lerp(hm.x, fx - 16, u), lerp(hm.y, fy + 1, u), 7) : { x: fx - 16 + (lt > 0.6 && lt < 1.6 ? Math.floor(st.T * 26) % 2 : 0), y: fy + 1, frame: 1 };
        if (res === "fail" && lt > 1.6) Object.assign(p, { x: fx - 22, pose: "seated", dy: 2 });
        if (lt > 0.5 && lt < 1.6) { st.line(p.x + 6, p.y - 14, fx - 2, fy - 10, IRON[3]); st.px(fx - 1, fy - 10, IRON[4]); }
        if (done && res !== "fail") {
          const u2 = seg(lt, 1.6, 2.3);
          st.rect(R(fx - 10 - u2 * 16), R(fy - 16 + arc(u2, 14) + u2 * 14), 8, 3, WOOD[2]); st.rect(R(fx + 2 + u2 * 18), R(fy - 15 + arc(u2, 18) + u2 * 13), 9, 3, WOOD[3]);
          for (let k = 0; k < 8; k++) st.px(fx - 6 + k * 2 + (k - 4) * u2 * 8, fy - 14 + arc(u2, 8 + k) + u2 * 12, WOOD[4]);
        }
        if (res === "fail" && lt > 1.6) stars(st, p.x, p.y - tall(env, i) + 6, st.T);
      } else {
        p = kneelPose(st, env, i, fx - 15, fy + 1, lt);
        if (lt > 0.5 && !done) { st.line(p.x + 5, p.y - 12, fx - 1, fy - 9, IRON[3]); if (Math.floor(st.T * 8) % 3 === 0) st.px(fx, fy - 9, "#fff0a0", true); }
        if (done && res === "fail") { sweat(st, p.x - 4, p.y - tall(env, i) + 6, lt); p.flip = Math.floor(lt * 6) % 2 === 0; }
        if (done && res !== "fail" && lt < dur - 0.1) st.text("CLICK!", fx, fy - 30, "#fff0c0", { center: true, outline: "#1a1008" });
      }
      crew(st, s0, { [i]: p });
    } };
  }
  function chestLeave(env, S) {
    const s0 = Object.assign({}, S);
    S.dx = (S.dx || 0) - 80;
    return { dur: 1.6, ev: [[0.3, "step", 1]], draw(st, lt) {
      room(st, s0);
      const poses = {};
      for (let q = 0; q < env.crew.length; q++) { const hm = D.home(env, q); poses[q] = walkPose(st, hm.x + (s0.dx || 0) - easeIn(seg(lt, 0.3, 1.6)) * 80, hm.y, 6, true); }
      crew(st, s0, poses);
      if (lt < 0.8) mark(st, "...", poses[0].x, poses[0].y - tall(env, 0) - 8, "#e8dcc0");
    } };
  }

  // the find, from the room's container: the chest's lid rises and light spills out first
  function lootClip(env, S, b) {
    const s0 = Object.assign({}, S), kind = env.kind, A = env.bg.A;
    let [ox, oy] = A.focus;
    if (kind === "chest" || kind === "secret") oy -= 12;
    else if (kind === "puzzle") { ox = 127; oy = 56; }
    else if (kind === "remains") { ox -= 16; oy -= 6; }
    else if (kind === "shrine") oy -= 14;
    else if (kind === "cache" || kind === "supplies" || kind === "fear") { ox = 150; oy = 54; }
    else if (kind === "lair") oy -= 6;
    else if (kind === "fight" || kind === "stair") { ox = 136; oy = 88; }
    else if (kind === "famous" || kind === "trap") { ox = 120; oy = 84; }
    const open = kind === "chest" || kind === "secret", pre = open ? 0.7 : 0.25;
    const L = lootPlan(env, b, ox, oy, pre);
    L.t0 = pre;
    const hover0 = S.hover || [];
    S.hover = hover0.concat([{ L, ox, oy }]);
    if (hover0.length) for (const f of L.fly) if (!f.l.good) f.x = Math.min(166, f.x + 24 * hover0.length) - (hover0.length > 1 ? 60 : 0);
    if (open && S.chest !== "broken") S.chest = "open";
    if (kind === "cache" || kind === "fear") S.stone = true;
    const ev = L.ev.slice();
    if (open) ev.unshift([0.1, "creak", 0.8]);
    if (L.empty) ev.push([0.4, "pop", 0.6]);
    const dur = L.empty ? 1.6 : Math.max(1.8, L.end + 0.9);
    return { dur, ev, loot: L, draw(st, lt) {
      const st8 = open ? (s0.chest === "broken" ? "broken" : lt > 0.3 ? "open" : s0.chest) : s0.chest;
      room(st, Object.assign({}, s0, { chest: st8 }));
      if ((kind === "cache" || kind === "fear") && !s0.stone) { st.rect(144, 46, 12, 9, "#050404"); st.rect(144 + R(seg(lt, 0, 0.25) * 10), 46, 12, 9, env.T.ramp[3]); }
      crew(st, s0, s0.poses);
      if (open && lt > 0.3) {
        const k = seg(lt, 0.3, 0.8);
        st.beam({ x0: ox, y0: oy, x1: ox, y1: 0, w: 7 + k * 5, k: 0.9 * k });
        st.light(ox, oy - 6, 50, [1, 0.88, 0.55], k * 1.1);
        for (let q = 0; q < 10; q++) { const u = (st.T * 0.35 + hash(q, 1, 17)) % 1; if (bay(q, R(u * 12)) < k) st.px(ox - 5 + hash(q, 2, 17) * 10 + Math.sin(st.T * 2 + q) * 2, oy - u * 50, u < 0.5 ? "#fff6d8" : "#ffe0a0", true); }
      }
      if (L.empty) {
        const u = seg(lt, 0.4, 1.6);
        if (u > 0) { const mx = ox + Math.sin(u * 14) * 6 + u * 20, my = oy - u * 30; st.px(mx, my, "#e8dcc0"); st.px(mx - 1, my - (Math.floor(st.T * 12) % 2), "#c8bca0"); st.px(mx + 1, my - (Math.floor(st.T * 12) % 2), "#c8bca0"); }
        puff(st, ox, oy, seg(lt, 0.35, 1.0), "#b8ac98", 8);
      }
      drawLoot(st, L, ox, oy, lt);
    } };
  }

  // puzzles: a close-up of the mechanism, the solver's tries as moves, then the door
  function puzzleClip(env, S, b) {
    const s0 = Object.assign({}, S), i = lead(env, b), res = (b.r && b.r[0] && b.r[0][1]) || "pass", sub = b.s === "custom" ? "mechanism" : b.s, h = env.crew[i] || {};
    if (b.c === "break") return doorRam(env, S, b, i, res);
    const wrong = res === "pass" ? 1 : res === "partial" ? 2 : 3, tries = res === "fail" || res === "bad" ? wrong : wrong + 1, step = 0.55, close0 = 0.6, close1 = close0 + tries * step + 0.5;
    const ok = res === "pass" || res === "partial", ev = [[0.2, "step", 1]];
    for (let k = 0; k < tries; k++) { const right = ok && k === tries - 1; ev.push([close0 + 0.2 + k * step, right ? "clunk" : "click", right ? 1.2 : 0.8]); if (!right) ev.push([close0 + 0.38 + k * step, "thud", 0.5]); }
    if (ok) ev.push([close1 + 0.1, "rumble", 0.8], [close1 + 0.9, "chime", 0.7]);
    else ev.push([close1 + 0.1, "rumble", 1.2]);
    const dur = close1 + (ok ? 1.9 : 1.4);
    if (ok) S.door = "open";
    return { dur, ev, draw(st, lt) {
      if (lt >= close0 && lt < close1) {
        const k = Math.floor((lt - close0) / step), inT = (lt - close0) % step, right = ok && k >= tries - 1, bad = !right && inT > 0.2 && k < tries;
        mechanism(st, sub, k, inT / step, right, bad, ok && lt > close1 - 0.5);
        hands(st, 90, 74 + (sub === "rune_lock" ? 4 : 0), h, Math.sin(st.T * 16) * 0.5, null);
        if (bad) st.shake(1.5);
        return;
      }
      const after = lt >= close1, lift = after && ok ? ease(seg(lt, close1, close1 + 1.2)) : 0;
      room(st, Object.assign({}, s0, { door: after && ok && lift >= 1 ? "open" : "shut", doorLift: R(lift * 50), runeRed: after && !ok && lt < close1 + 0.8, runeLit: after && ok }));
      if (after && ok && lift < 1) dustCloud(st, 127, FL - 2, lift, 24);
      if (after && ok && lift > 0 && lift < 1) { const top = R(FL - lift * 50); for (let y = top; y < FL; y++) { st.ctx.fillStyle = mix("#fff0c8", "#d8a050", (y - top) / 50); st.ctx.fillRect(106, y, 42, 1); } st.light(127, 50, 70 * lift, [1, 0.85, 0.55], 0.9); }
      if (after && !ok) st.shake(lt < close1 + 0.8 ? 2 : 0);
      const hm = D.home(env, i), u = seg(lt, 0, close0 - 0.05), poses = { [i]: u < 1 ? walkPose(st, lerp(hm.x, 96, u), lerp(hm.y, 90, u), 7) : { x: 96, y: 90, frame: 0 } };
      if (after && !ok) { sweat(st, 92, 90 - tall(env, i) + 4, lt); poses[i].flip = Math.floor(lt * 5) % 2 === 0; }
      crew(st, s0, poses);
    } };
  }
  function mechanism(st, sub, k, u, right, bad, done) {
    const env = st.env, T = env.T, c = st.ctx;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { c.fillStyle = D.bay(x >> 2, y >> 2) < 0.3 ? T.ramp[2] : y % 16 === 0 || (x + (y >> 4) * 9) % 26 === 0 ? T.ramp[1] : T.ramp[3]; c.fillRect(x, y, 1, 1); }
    st.light(90, 40, 140, [1, 0.8, 0.55], 1.0);
    const red = bad ? "#ff4a30" : null, gold = "#ffd060";
    if (sub === "riddle") {
      for (let r = 0; r < 4; r++) for (let q = 0; q < 26; q++) if (hash(q, r, 3) < 0.7) st.rect(36 + q * 4, 10 + r * 6, 3, 2, T.ramp[0]);
      const cx = 90, cy = 64, rr = 18, ang = (k + ease(u)) * 1.05 - 1.6;
      for (let a = 0; a < 64; a++) { const t = (a / 64) * Math.PI * 2; st.px(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr, T.ramp[0]); st.px(cx + Math.cos(t) * (rr + 1), cy + Math.sin(t) * (rr + 1), T.ramp[4]); }
      for (let q = 0; q < 6; q++) { const t = (q / 6) * Math.PI * 2 - Math.PI / 2, lit = (done && right) || (q === k % 6 && (bad || right)); st.rect(R(cx + Math.cos(t) * 12) - 1, R(cy + Math.sin(t) * 12) - 1, 3, 3, lit ? (bad ? red : gold) : T.ramp[0]); if (lit) st.px(cx + Math.cos(t) * 12, cy + Math.sin(t) * 12, bad ? red : gold, true); }
      st.line(cx, cy, cx + Math.cos(ang) * 9, cy + Math.sin(ang) * 9, IRON[4]);
    } else if (sub === "rune_lock") {
      const cx = 90, cy = 46;
      for (let q = 0; q < 8; q++) { const t = (q / 8) * Math.PI * 2 - Math.PI / 2, x = R(cx + Math.cos(t) * 26), y = R(cy + Math.sin(t) * 22), lit = done || q <= k * 2 + (u > 0.5 ? 1 : 0); st.rect(x - 2, y - 3, 5, 6, T.ramp[1]); st.rect(x - 1, y - 2, 1, 4, lit ? (bad ? red : gold) : T.ramp[0]); st.rect(x + 1, y - 2, 1, 2, lit ? (bad ? red : gold) : T.ramp[0]); if (lit) { st.px(x - 1, y - 2, bad ? red : gold, true); st.light(x, y, 14, bad ? [1, 0.3, 0.2] : [1, 0.8, 0.3], 0.5); } }
      st.rect(cx - 6, cy - 8, 12, 16, T.ramp[4]); st.rect(cx - 5, cy - 7, 10, 14, done ? gold : T.ramp[2]);
    } else {
      for (let q = 0; q < 3; q++) { const x = 52 + q * 22, down = q === k % 3 ? u > 0.4 : q < k % 3; st.rect(x, 30, 4, 34, "#0a0806"); const hy = down ? 52 : 34; st.rect(x - 1, hy, 6, 4, bad && q === k % 3 ? red : WOOD[3]); st.rect(x + 1, hy + 4, 2, 6, IRON[2]); }
      for (const [gx, gy, r, dir] of [[130, 40, 12, 1], [146, 60, 8, -1]]) { const spin = (done || right ? st.T * 2 : 0) * dir; for (let a = 0; a < 40; a++) { const t = (a / 40) * Math.PI * 2 + spin, rr = r + (a % 5 < 2 ? 2 : 0); st.px(gx + Math.cos(t) * rr, gy + Math.sin(t) * rr, IRON[3]); } st.rect(gx - 2, gy - 2, 4, 4, GOLD[2]); }
      st.rect(118, 14, 6, 6, bad ? red : done ? gold : "#3a2a20"); if (bad || done) st.px(120, 16, bad ? red : gold, true);
      if (bad) for (let q = 0; q < 10; q++) st.px(124 + q, 14 - q * 0.6 + Math.sin(st.T * 9 + q), "#e8e4dc", true);
    }
  }
  function doorRam(env, S, b, i, res) {
    const s0 = Object.assign({}, S), ok = res !== "fail" && res !== "bad";
    if (ok) S.door = "gone";
    return { dur: 2.6, ev: [[0.7, "slam", 1], [1.5, ok ? "crack" : "boing", 1]], draw(st, lt) {
      const fallen = ok && lt > 1.5;
      room(st, Object.assign({}, s0, { door: fallen ? "gone" : "shut" }));
      if (fallen) { const u = seg(lt, 1.5, 1.9); st.rect(106, R(lerp(14, FL + 2, u)), 42, R(lerp(50, 5, u)), env.T.ramp[3]); dustCloud(st, 127, FL + 4, seg(lt, 1.6, 2.6), 26); st.light(127, 40, 60, [1, 0.85, 0.55], 0.7); }
      const hm = D.home(env, i), run = (t0, t1) => seg(lt, t0, t1);
      let p;
      if (lt < 0.7) p = walkPose(st, lerp(hm.x, 100, easeIn(run(0, 0.7))), 90, 10);
      else if (lt < 1.0) p = { x: 100 - run(0.7, 1.0) * 14, y: 90, frame: 0, dy: arc(run(0.7, 1.0), 4) };
      else if (lt < 1.5) p = walkPose(st, lerp(86, 100, easeIn(run(1.0, 1.5))), 90, 10);
      else p = ok ? { x: 104 + run(1.5, 2.0) * 10, y: 90, frame: 0 } : { x: 88, y: 92, pose: "seated", frame: 0 };
      if (!ok && lt > 1.6) stars(st, p.x, 92 - tall(env, i) + 8, st.T);
      if (lt > 0.68 && lt < 0.8) st.shake(2);
      crew(st, s0, { [i]: p });
    } };
  }

  // obstacles
  function crossClip(env, S, b) {
    const sub = env.rec.sub || "chasm", s0 = Object.assign({}, S), list = (b.r || []).map(([id, res]) => ({ i: idxOf(env, id), res })).filter((w) => w.i >= 0);
    if (b.c === "round") return roundClip(env, S);
    if (sub === "flood" || b.s === "flood") return swimClip(env, S, list);
    if (sub === "rubble" || b.s === "rubble") return b.c === "squeeze" ? squeezeClip(env, S, list[0] || { i: 0, res: "pass" }) : digClip(env, S, list[0] || { i: 0, res: "pass" });
    if (sub === "crawl" || b.s === "crawl") return crawlClip(env, S, list[0] || { i: 0, res: "pass" });
    if (sub === "stuck_door" || b.s === "stuck_door" || b.s === "stuck_door_force") return b.c === "pick" ? doorPick(env, S, list[0] || { i: 0, res: "pass" }) : doorRam(env, S, b, (list[0] || { i: 0 }).i, (list[0] || { res: "pass" }).res);
    if (sub === "slope" || b.s === "slope") return slopeClip(env, S, list);
    const go = list.length ? list : env.crew.map((h, i) => ({ i, res: "pass" }));
    if (b.c === "rope") return ropeClip(env, S, go);
    const per = 0.85, ev = [];
    let t = 0.2;
    const sched = go.map((w) => { const o = { w, t }; ev.push([t + 0.35, "whoosh", 0.6]); ev.push([t + 0.7, w.res === "pass" ? "step" : "boing", 1]); t += per + (w.res !== "pass" ? 1.6 : 0); return o; });
    S.dx = (S.dx || 0) + 66;
    const dur = t + 0.5;
    return { dur, ev, draw(st, lt) {
      room(st, s0);
      const poses = {}, done = [];
      for (let q = 0; q < env.crew.length; q++) { const hm = D.home(env, q); poses[q] = { x: hm.x + (s0.dx || 0), y: hm.y, frame: 0 }; }
      for (const { w, t: t0 } of sched) {
        const hm = D.home(env, w.i), tt = lt - t0, x0 = hm.x + (s0.dx || 0), edge = 86, far = 126 + (w.i % 3) * 8;
        if (tt < 0) continue;
        if (tt < 0.3) { poses[w.i] = walkPose(st, lerp(x0, edge, ease(tt / 0.3)), lerp(hm.y, 90, tt / 0.3), 10); continue; }
        if (w.res === "pass" || tt > 0.3 + 0.5 + 1.6) {
          const u = clamp((tt - 0.3) / 0.45, 0, 1);
          poses[w.i] = w.res === "pass" ? { x: lerp(edge, far, u), y: 90 + arc(u, 14), frame: 1 } : { x: far, y: 90, frame: 0 };
          if (u >= 1) poses[w.i] = { x: far, y: hm.y, frame: 0 };
          if (u >= 1 && tt < 1.2) puff(st, far, hm.y, (tt - 0.75) * 2);
          done.push(w.i);
          continue;
        }
        const u = clamp((tt - 0.3) / 0.35, 0, 1);
        if (tt < 0.65) { poses[w.i] = { x: lerp(edge, 104, u), y: 90 + arc(u, 10) * 0.6, frame: 1 }; continue; }
        const fall = tt - 0.65, soft = env.bg.A.sink === "silt";
        const helper = done[0] != null ? done[0] : go[0].i === w.i ? null : go[0].i;
        // in silt the crust gives and they go in to the thigh instead of over the edge
        if (fall < 0.4) { poses[w.i] = soft ? { x: 104, y: 90 + ease(fall / 0.4) * 12, frame: 1, clipY: 88 } : { x: 104, y: 90 + easeIn(fall / 0.4) * 30, frame: 1, clipY: H }; if (fall > 0.05) st.text(soft ? "SQUELCH" : "AAAA!", 104, 60, "#fff0c0", { center: true, outline: "#1a1008" }); if (soft) dustCloud(st, 104, 87, fall / 0.4, 12); continue; }
        const up = seg(fall, 0.9, 1.6), hy = soft ? lerp(102, 90, ease(up)) : lerp(118, 90, ease(up));
        poses[w.i] = up < 1 ? (soft ? { x: 104 + Math.sin(st.T * 9) * 1, y: hy, frame: 0, clipY: 88, noTorch: true } : { x: 104 + Math.sin(st.T * 4) * 2, y: hy, rot: 2, frame: 0, noTorch: true }) : { x: far, y: 90, frame: 0 };
        if (helper != null && up < 1) { const hp = poses[helper]; st.line(hp.x + 4, hp.y - 16, 104 + Math.sin(st.T * 4) * 2, hy - tall(env, w.i) + 2, "#a88a5a"); if (fall > 0.5) st.text("HOLD ON!", hp.x, hp.y - tall(env, helper) - 10, "#fff0c0", { center: true, outline: "#1a1008" }); }
        else if (up < 1) st.line(104 + Math.sin(st.T * 4) * 2, FL + 4, 104 + Math.sin(st.T * 4) * 2, hy - tall(env, w.i) + 2, "#a88a5a");
      }
      crew(st, s0, poses);
    } };
  }
  function roundClip(env, S) {
    const s0 = Object.assign({}, S);
    S.dx = (S.dx || 0) + 70;
    return { dur: 2.6, ev: [[0.3, "step", 1], [1.6, "step", 1]], draw(st, lt) {
      room(st, s0);
      const poses = {}, back = lt > 1.3;
      for (let q = 0; q < env.crew.length; q++) {
        const hm = D.home(env, q);
        poses[q] = !back ? walkPose(st, hm.x + (s0.dx || 0) - easeIn(seg(lt, 0.2, 1.2)) * 90, hm.y, 6, true) : walkPose(st, lerp(220, hm.x + (s0.dx || 0) + 70, ease(seg(lt, 1.4, 2.4))), hm.y, lt < 2.4 ? 6 : 0);
        if (back && lt > 2.3) sweat(st, poses[q].x - 3, hm.y - tall(env, q) + 4, lt + q);
      }
      crew(st, s0, poses);
      const fade = Math.max(0, 1 - Math.abs(lt - 1.3) / 0.25);
      if (fade > 0) st.uiDraw((o) => { o.fillStyle = `rgba(0,0,0,${fade})`; o.fillRect(0, 0, W, H); });
    } };
  }
  function ropeClip(env, S, go) {
    const s0 = Object.assign({}, S), first = go[0];
    S.dx = (S.dx || 0) + 66;
    const ev = [[0.4, "whoosh", 1], [0.8, "step", 1], [1.2, "pop", 0.6]];
    go.slice(1).forEach((w, k) => { if (w.res !== "pass") ev.push([1.8 + k * 0.9, "boing", 1]); });
    return { dur: 1.8 + (go.length - 1) * 0.9 + 0.6, ev, draw(st, lt) {
      room(st, s0);
      const poses = {}, far = 130, ry = 66;
      for (let q = 0; q < env.crew.length; q++) { const hm = D.home(env, q); poses[q] = { x: hm.x + (s0.dx || 0), y: hm.y, frame: 0 }; }
      const u0 = seg(lt, 0.3, 0.75);
      poses[first.i] = lt < 0.3 ? walkPose(st, lerp(poses[first.i].x, 86, lt / 0.3), 90, 10) : { x: lerp(86, far, u0), y: 90 + arc(u0, 14), frame: 1 };
      if (lt > 1.1) { st.line(84, ry, far + 4, ry, "#a88a5a"); st.rect(82, ry, 2, 26, WOOD[2]); }
      go.slice(1).forEach((w, k) => {
        const t0 = 1.6 + k * 0.9, u = seg(lt, t0, t0 + 0.8);
        if (lt < t0) return;
        const x = lerp(88, far - 6 - k * 6, u), slip = w.res !== "pass" && u > 0.4 && u < 0.75;
        poses[w.i] = u < 1 ? { x, y: ry + tall(env, w.i) - 4 + (slip ? 10 : 0), frame: Math.floor(st.T * 6) % 2, rot: slip ? 2 : 0, noTorch: true } : { x: far - 6 - k * 6, y: 90, frame: 0 };
        if (slip) { poses[w.i].y = ry + 2 + tall(env, w.i); mark(st, "!", x, ry - 10, "#ff8060"); }
      });
      crew(st, s0, poses);
    } };
  }
  function swimClip(env, S, list) {
    const s0 = Object.assign({}, S), go = list.length ? list : env.crew.map((h, i) => ({ i, res: "pass" }));
    S.dx = (S.dx || 0) + 70;
    for (const w of go) if (w.res !== "pass") (S.wet = Object.assign({}, S.wet))[w.i] = 1;
    const ev = [[0.3, "splash", 0.6]];
    go.forEach((w, k) => { if (w.res !== "pass") ev.push([0.9 + k * 0.3, "splash", 1.2]); });
    return { dur: 3.2, ev, draw(st, lt) {
      room(st, s0);
      const poses = {}, wl = 80;
      go.forEach((w, k) => {
        const hm = D.home(env, w.i), u = seg(lt, k * 0.3, 2.4 + k * 0.2), x = hm.x + (s0.dx || 0) + u * 70, inW = x > 30 && x < 168;
        const dunk = w.res !== "pass" && u > 0.35 && u < 0.6;
        poses[w.i] = Object.assign(walkPose(st, x, hm.y, 4), inW ? { clipY: wl + 1, dy: dunk ? 26 : 6 } : {});
        if (dunk) for (let q = 0; q < 4; q++) st.px(x + Math.sin(st.T * 5 + q) * 3, wl - ((st.T * 18 + q * 3) % 10), "#cfeaf4", true);
        if (w.res !== "pass" && u >= 0.6 && u < 0.8) mark(st, "PAH!", x, wl - tall(env, w.i) - 6, "#cfeaf4");
        if (w.res === "bad" && u > 0.5) { const sx = x + (u - 0.5) * 60; st.rect(R(sx), wl - 2, 5, 3, "#8e7646"); }
      });
      crew(st, s0, poses);
      water(st, wl);
    } };
  }
  function digClip(env, S, w) {
    const s0 = Object.assign({}, S), ok = w.res !== "fail" && w.res !== "bad", dur = w.res === "partial" ? 3.2 : 2.6;
    S.rubble = ok ? 0 : 0.7;
    if (!ok) S.dust = true;
    const ev = []; for (let t = 0.4; t < dur - 0.6; t += 0.35) ev.push([t, "scrape", 0.4]);
    if (!ok) ev.push([dur - 0.9, "rumble", 1], [dur - 0.5, "cough", 1]);
    return { dur, ev, draw(st, lt) {
      const k = ok ? 1 - seg(lt, 0.4, dur - 0.4) : lt < dur - 0.9 ? 1 - seg(lt, 0.4, dur - 0.9) * 0.6 : 0.7;
      room(st, Object.assign({}, s0, { rubble: k }));
      const poses = {};
      for (let q = 0; q < env.crew.length; q++) { const x = 96 - q * 10, u = seg(lt, 0, 0.4), hm = D.home(env, q); poses[q] = u < 1 ? walkPose(st, lerp(hm.x, x, u), lerp(hm.y, 92 - (q % 2) * 3, u), 8) : { x, y: 92 - (q % 2) * 3, frame: Math.floor(st.T * 6 + q) % 2, dy: -(Math.floor(st.T * 6 + q) % 2) }; }
      crew(st, Object.assign({}, s0, { dust: !ok && lt > dur - 0.9 }), poses);
      for (let q = 0; q < 6; q++) { const u = ((lt * 1.6 + q * 0.17) % 1); if (lt > 0.4 && lt < dur - 0.5) st.rect(R(100 - u * 40), R(80 + arc(u, 18)), 2, 2, env.T.ramp[3]); }
      if (!ok && lt > dur - 0.9) dustCloud(st, 110, 84, seg(lt, dur - 0.9, dur), 30);
    } };
  }
  function squeezeClip(env, S, w) {
    const s0 = Object.assign({}, S), ok = w.res === "pass";
    return { dur: 3.0, ev: [[0.5, "scrape", 0.6]].concat(ok ? [[2.0, "pop", 1]] : [[1.4, "boing", 0.8], [2.3, "pop", 1]]), draw(st, lt) {
      room(st, Object.assign({}, s0, { rubble: 1 }));
      const hm = D.home(env, w.i), u = seg(lt, 0, 0.8), v = seg(lt, 0.8, 2.0);
      const p = lt < 0.8 ? { x: lerp(hm.x, 110, u), y: lerp(hm.y, 66, u), frame: 1 } : ok ? { x: lerp(110, 140, v), y: 62, rot: 1, alpha: 1 - seg(lt, 1.7, 2.0) } : { x: 118 + (lt < 2.2 ? Math.floor(st.T * 14) % 2 : -seg(lt, 2.2, 2.5) * 8), y: 62, rot: 1, clipY: 70 };
      crew(st, s0, { [w.i]: Object.assign(p, { noTorch: true }) });
      if (!ok && lt > 1.0 && lt < 2.2) mark(st, "MMF!", 118, 46, "#fff0c0");
    } };
  }
  function crawlClip(env, S, w) {
    const s0 = Object.assign({}, S), stuck = w.res !== "pass";
    S.dx = (S.dx || 0) + 0;
    const n = env.crew.length, per = 0.5;
    const ev = [[0.3, "scrape", 0.5]].concat(stuck ? [[1.6, "boing", 0.8], [2.6, "pop", 1]] : []);
    return { dur: 1.2 + n * per + (stuck ? 1.2 : 0), ev, draw(st, lt) {
      room(st, s0);
      const poses = {};
      for (let q = 0; q < n; q++) {
        const hm = D.home(env, q), t0 = q * per + (stuck && q > w.i ? 1.2 : 0), u = seg(lt, t0, t0 + 1.0);
        const x = lerp(hm.x, 160, u), prone = x > 120;
        let pose = prone ? { x, y: 90, rot: 1, frame: 0, noTorch: true, alpha: 1 - seg(x, 146, 160) } : walkPose(st, x, hm.y, 6);
        if (stuck && q === w.i && lt > t0 + 0.7 && lt < t0 + 1.9) { pose = { x: 144 + (Math.floor(st.T * 14) % 2), y: 90, rot: 1, frame: 0, noTorch: true }; if (lt > t0 + 0.8) mark(st, "STUCK", 150, 70, "#fff0c0"); }
        if (u >= 1) pose.hide = true;
        poses[q] = pose;
      }
      crew(st, s0, poses);
    } };
  }
  function doorPick(env, S, w) {
    const s0 = Object.assign({}, S), ok = w.res === "pass";
    if (ok) S.door = "open";
    return { dur: 2.2, ev: [[0.6, "click", 0.4], [0.9, "click", 0.4], [1.3, ok ? "creak" : "clunk", 1]], draw(st, lt) {
      room(st, Object.assign({}, s0, { door: ok && lt > 1.3 ? "open" : "shut" }));
      const p = kneelPose(st, env, w.i, 100, 91, lt);
      crew(st, s0, { [w.i]: p });
      if (!ok && lt > 1.3) sweat(st, p.x - 3, p.y - tall(env, w.i) + 6, lt);
    } };
  }
  function slopeClip(env, S, list) {
    const s0 = Object.assign({}, S), go = list.length ? list : env.crew.map((h, i) => ({ i, res: "pass" }));
    S.dx = (S.dx || 0) + 60;
    const yAt = (x) => (x < 96 ? 92 : lerp(92, 58, (x - 96) / 80));
    const ev = []; go.forEach((w, k) => { if (w.res !== "pass") ev.push([0.9 + k * 0.3, "whoosh", 1], [1.4 + k * 0.3, "thud", 0.6]); });
    return { dur: 3.4, ev, draw(st, lt) {
      room(st, s0);
      const poses = {};
      go.forEach((w, k) => {
        const hm = D.home(env, w.i), slip = w.res !== "pass";
        let u = seg(lt, k * 0.3, 2.6 + k * 0.2);
        if (slip) u = lt < 0.9 + k * 0.3 ? seg(lt, k * 0.3, 2.6) : lt < 1.5 + k * 0.3 ? seg(0.9, 0, 2.6) * (1 - seg(lt, 0.9 + k * 0.3, 1.5 + k * 0.3)) : seg(lt, 1.5 + k * 0.3, 3.2) * 0.9;
        const x = lerp(hm.x + (s0.dx || 0) - 30, 160 - k * 8, u), sliding = slip && lt > 0.9 + k * 0.3 && lt < 1.5 + k * 0.3;
        poses[w.i] = sliding ? { x, y: yAt(x), pose: "seated", frame: 0, noTorch: true } : walkPose(st, x, yAt(x), 5);
        if (sliding) dustCloud(st, x + 4, yAt(x), (lt * 3) % 1, 6);
      });
      crew(st, s0, poses);
    } };
  }

  // shrines, remains, lore, supplies, caches, camps, secret doors
  function shrineClip(env, S, b) {
    const s0 = Object.assign({}, S), i = lead(env, b), res = (b.r && b.r[0] && b.r[0][1]) || "pass", strip = b.c === "strip" || b.c === "take";
    const nC = env.bg.A.candles.length, ok = res === "pass" || res === "partial", ev = [];
    for (let k = 0; k < nC; k++) ev.push([0.2 + k * 0.25, "pop", 0.7]);
    ev.push([1.8, strip ? "cold" : ok ? "glow" : "cold", 1]);
    S.candles = nC;
    if (strip || !ok) S.gutter = true;
    return { dur: 3.4, ev, draw(st, lt) {
      const lit = Math.min(nC, Math.floor((lt - 0.1) / 0.25) + 1);
      room(st, Object.assign({}, s0, { candles: Math.max(0, lit), gutter: (strip || !ok) && lt > 2.0 }));
      const [fx, fy] = env.bg.A.focus, hm = D.home(env, i), u = seg(lt, 0.3, 1.2);
      const poses = { [i]: u < 1 ? walkPose(st, lerp(hm.x, fx - 20, u), lerp(hm.y, fy + 6, u), 6) : strip ? { x: fx - 16 + (lt > 1.4 && lt < 1.9 ? Math.floor(st.T * 20) % 2 : 0), y: fy + 6, frame: 1 } : { x: fx - 20, y: fy + 6, pose: "seated", frame: 0 } };
      crew(st, s0, poses);
      if (lt > 1.8) {
        const k = seg(lt, 1.8, 2.4) * (1 - seg(lt, 3.0, 3.4) * 0.5);
        if (ok && !strip) {
          for (let q = 0; q < 16; q++) { const uu = (st.T * 0.4 + hash(q, 1, 8)) % 1, x = 20 + hash(q, 2, 8) * 120, y = 94 - uu * 50; if (bay(q, R(uu * 9)) < k) st.px(x + Math.sin(st.T * 2 + q) * 2, y, uu < 0.6 ? "#fff0b0" : "#ffd060", true); }
          st.light(70, 70, 110, [1, 0.85, 0.5], 0.6 * k);
        } else {
          for (let q = 0; q < 3; q++) for (let j = 0; j < 18; j++) { const a = st.T * 2 + q * 2.1 + j * 0.25; st.px(60 + Math.cos(a) * (30 + q * 8) + j, 76 + Math.sin(a * 1.3) * 10 - j * 0.6, "#8ab8e8", true); }
          st.light(60, 76, 90, [0.45, 0.65, 1.0], 0.55 * k);
        }
      }
    } };
  }
  function remainsClip(env, S, b) {
    const s0 = Object.assign({}, S), i = lead(env, b), bury = b.c === "bury";
    if (bury) S.laid = true; else S.packOpen = true;
    S.noteTaken = true;
    return { dur: 4.0, ev: [[0.4, "step", 1], [1.0, bury ? "scrape" : "scrape", 0.6], [2.4, "scribble", 0.6]], draw(st, lt) {
      const [fx, fy] = env.bg.A.focus, hm = D.home(env, i), u = seg(lt, 0, 0.7);
      room(st, Object.assign({}, s0, { laid: bury && lt > 1.6, packOpen: !bury && lt > 1.2, noteTaken: lt > 2.2 }));
      if (bury && lt > 0.9 && lt < 1.6) { const k = seg(lt, 0.9, 1.6); st.rect(fx - 12, fy - 3 - R((1 - k) * 18), R(22 * k), 3 + R((1 - k) * 4), "#5a4430"); }
      const p = u < 1 ? walkPose(st, lerp(hm.x, fx - 26, u), lerp(hm.y, fy + 4, u), 6) : { x: fx - 26 + (lt > 0.9 && lt < 1.6 ? Math.floor(st.T * 10) % 2 : 0), y: fy + 4, frame: 0, dy: lt > 0.9 && lt < 2.2 ? 3 : 0 };
      crew(st, s0, { [i]: p });
      if (lt > 2.3) {
        const k = seg(lt, 2.3, 2.6);
        st.uiDraw((o) => {
          const x = 46, y = R(lerp(100, 18, ease(k))), w = 88, h = 64;
          o.fillStyle = "#1a1008"; o.fillRect(x - 1, y - 1, w + 2, h + 2); o.fillStyle = "#e8dcb8"; o.fillRect(x, y, w, h); o.fillStyle = "#d4c49c"; o.fillRect(x, y + h - 3, w, 3);
          o.fillStyle = "#4a3a2a";
          const n = Math.floor(seg(lt, 2.6, 3.8) * 7);
          for (let r = 0; r < n; r++) for (let q = 0; q < 34 + (r * 7) % 9; q++) { const yy = y + 8 + r * 7 + Math.round(Math.sin(q * 0.9 + r) * 1.2); if (hash(q, r, 4) < 0.82) o.fillRect(x + 6 + q * 2, yy, 2, 1); if (hash(q, r, 5) < 0.2) o.fillRect(x + 6 + q * 2, yy - 2, 1, 2); }
        });
      }
    } };
  }
  function loreClip(env, S, b) {
    const s0 = Object.assign({}, S), i = lead(env, b), res = (b.r && b.r[0] && b.r[0][1]) || "pass", reach = res === "partial" ? 0.62 : 1;
    S.mural = reach; if (res === "pass") S.muralGlow = 0.4;
    return { dur: 3.8, ev: [[0.3, "step", 0.8], [1.3, "step", 0.8], [2.2, "step", 0.8]].concat(res === "pass" ? [[3.0, "beat", 1]] : []), draw(st, lt) {
      const [mx, , mw] = env.bg.A.mural, hm = D.home(env, i), u = seg(lt, 0.2, 2.8) * reach, tx = lerp(mx - 4, mx + mw + 2, u);
      room(st, Object.assign({}, s0, { mural: clamp((tx - mx + 12) / mw, 0, reach), muralGlow: res === "pass" ? seg(lt, 2.9, 3.4) * (0.7 + Math.sin(st.T * 6) * 0.3) : 0 }));
      const p = lt < 0.2 ? { x: hm.x, y: hm.y, frame: 0 } : walkPose(st, Math.min(tx - 6, 168), 90, lt < 2.8 ? 5 : 0);
      crew(st, Object.assign({}, s0, { lantern: false }), { [i]: Object.assign(p, { noTorch: true }) });
      st.rect(p.x + 6, p.y - 32, 1, 10, WOOD[2]); st.flame(p.x + 6, p.y - 37, false); st.light(p.x + 6, p.y - 34, 44, [1, 0.68, 0.38], 1.1);
      if (res === "pass" && lt > 3.0) mark(st, "!", mx + mw - 18, 8, "#ff7060");
      if ((res === "fail" || res === "bad") && lt > 2.9) mark(st, "?", p.x, p.y - tall(env, i) - 8, "#fff0c0");
    } };
  }
  function suppliesClip(env, S, b) {
    const s0 = Object.assign({}, S), i = lead(env, b), res = (b.r && b.r[0] && b.r[0][1]) || "pass", n = res === "pass" ? 4 : res === "partial" ? 2 : 0;
    if (n) S.pack = Object.assign({}, S.pack, { [i]: n });
    else S.goo = Object.assign({}, S.goo, { [i]: 1 });
    const ev = [[0.6, "creak", 0.7], [1.0, "crack", 0.5]]; for (let k = 0; k < n; k++) ev.push([1.4 + k * 0.3, "pop", 0.6]);
    if (!n) ev.push([1.6, "boing", 0.7]);
    return { dur: 3.0, ev, draw(st, lt) {
      room(st, s0);
      const hm = D.home(env, i), u = seg(lt, 0, 0.6), p = u < 1 ? walkPose(st, lerp(hm.x, 128, u), lerp(hm.y, 92, u), 7) : { x: 128, y: 92, frame: lt > 0.7 && lt < 1.1 ? Math.floor(st.T * 20) % 2 : 0, flip: lt > 1.3 && n > 0 };
      if (lt > 1.0) { st.rect(146, 74, 14, 2, WOOD[3]); st.rect(142, 70 - R(seg(lt, 1.0, 1.3) * 6), 8, 2, WOOD[2]); }
      const s1 = Object.assign({}, s0, { pack: Object.assign({}, s0.pack, { [i]: Math.min(n, Math.floor(seg(lt, 1.4, 1.4 + n * 0.3) * n)) }) });
      if (!n && lt > 1.5) Object.assign(p, { tint: "#7ab040", ta: 0.5 * seg(lt, 1.5, 2.0) });
      crew(st, s1, { [i]: p });
      for (let k = 0; k < n; k++) { const t0 = 1.4 + k * 0.3, v = seg(lt, t0, t0 + 0.3); if (v > 0 && v < 1) { st.rect(R(lerp(150, 126, v)), R(lerp(72, 70, v) + arc(v, 10)), 3, 2, "#c89a5a"); } }
      if (!n && lt > 1.2) { if (lt < 1.6) st.rect(p.x + 4, p.y - 22, 3, 2, "#c84a3a"); else { stars(st, p.x, p.y - tall(env, i) - 2, st.T); mark(st, "BLEH", p.x, p.y - tall(env, i) - 12, "#b0e070"); } }
    } };
  }
  function searchClip(env, S, b) {
    const s0 = Object.assign({}, S), i = lead(env, b), res = (b.r && b.r[0] && b.r[0][1]) || "pass", ok = res !== "fail" && res !== "bad";
    return { dur: 2.6, ev: [[0.6, "scrape", 0.5], [1.2, "scrape", 0.5]].concat(ok ? [[1.9, "clunk", 0.8]] : [[1.9, "boing", 0.6]]), draw(st, lt) {
      room(st, s0);
      const hm = D.home(env, i), path = [[hm.x, hm.y], [118, 90], [140, 88], [146, 66]], u = seg(lt, 0, 1.8) * 3, k = Math.min(2, Math.floor(u)), f = u - k;
      const [ax, ay] = path[k], [bx, by] = path[k + 1], p = walkPose(st, lerp(ax, bx, ease(f)), lerp(ay, by, ease(f)), f < 0.6 ? 6 : 0);
      if (f > 0.6) p.x += Math.floor(st.T * 16) % 2;
      if (lt > 1.8) Object.assign(p, { x: 146, y: 66 + 24, frame: 0 });
      p.y = Math.max(p.y, 88);
      crew(st, s0, { [i]: p });
      if (!ok && lt > 1.8) { const v = seg(lt, 1.8, 2.6); st.rect(R(150 - v * 120), 95, 4, 2, "#3a3430"); st.px(R(150 - v * 120) - 1, 95, "#ff4030", true); st.px(R(150 - v * 120) + 4, 96, "#3a3430"); mark(st, "?", p.x, p.y - tall(env, i) - 8, "#fff0c0"); }
      if (ok && lt > 1.8) mark(st, "!", 150, 36, "#ffe070");
    } };
  }
  // a fire with a life of its own: crossed logs, three tongues that never settle, sparks, a curl of smoke, and the light breathing with it
  function campfire(st, x, y, low) {
    const T = st.T, k = low ? 0.55 : 1;
    st.rect(x - 7, y - 2, 14, 2, WOOD[1]); st.rect(x - 7, y - 2, 14, 1, WOOD[3]);
    st.line(x - 6, y - 4, x + 5, y - 1, WOOD[2]); st.line(x - 5, y - 1, x + 6, y - 4, WOOD[2]);
    for (let i = -5; i <= 5; i++) if (hash(i, Math.floor(T * 4), 3) < 0.5) st.px(x + i, y - 1, i % 2 ? "#ff7a1a" : "#ffb040", true);
    const C = ["#fff4c0", "#ffd060", "#ff9a30", "#e05a18"];
    for (let q = 0; q < 3; q++) {
      const cx = x - 3 + q * 3, h = Math.round((q === 1 ? 9 : 6) * k + Math.sin(T * (9 + q * 3) + q * 2) * 2 * k);
      for (let j = 0; j < h; j++) {
        const w = j < h * 0.35 ? 2 : j < h * 0.7 ? 1 : 0, sway = Math.round(Math.sin(T * 7 + j * 0.6 + q) * (j / h) * 1.5);
        for (let i = -w; i <= w; i++) st.px(cx + i + sway, y - 3 - j, C[clamp(Math.floor((j / h) * 3) + (Math.abs(i) === w && w ? 1 : 0), 0, 3)], true);
      }
    }
    for (let q = 0; q < 5; q++) { const u = (T * 0.8 + q * 0.21) % 1; if (u < 0.7) st.px(x - 2 + Math.sin(T * 3 + q * 2) * 4 * u + q, y - 10 - u * 26, u < 0.35 ? "#ffd070" : "#c05020", true); }
    for (let q = 0; q < 4; q++) { const u = (T * 0.25 + q / 4) % 1; if (bay(q, Math.round(u * 9)) < 0.7 - u * 0.6) { const sx = x + Math.sin(T * 0.9 + q + u * 4) * (2 + u * 5), sy = y - 14 - u * 30; st.px(sx, sy, "#8a8078"); st.px(sx + 1, sy, "#6a625c"); } }
    const fl = 1 + Math.sin(T * 11) * 0.05 + Math.sin(T * 4.3) * 0.06;
    st.light(x, y - 6, 74 * fl * (low ? 0.75 : 1), [1, 0.62, 0.32], low ? 0.9 : 1.35);
  }
  // the camp: a fire, the crew down round it, and a watch rota passing from one to the next, named at the top;
  // an uneasy camp sits up all night with the fire low
  function campScene(st, env, c) {
    const [fx, fy] = env.bg.A.focus, n = env.crew.length, poses = {}, ok = c.ok;
    const turn = Math.floor(Math.max(0, st.T - c.t0) / 2.2), w = (c.watcher + turn) % Math.max(1, n);
    env.crew.forEach((h, q) => {
      const a = (q / n) * Math.PI * 2 + 0.8, x = fx + Math.cos(a) * 26, y = fy + 2 + Math.sin(a) * 4;
      poses[q] = q === w || !ok ? { x, y, pose: "seated", frame: 0, noTorch: true, flip: x > fx } : { x, y: y + 2, rot: q % 2 ? 1 : 3, frame: 0, noTorch: true };
    });
    crew(st, c.s0, poses, { noLight: true });
    const night = c.t0 == null ? 1 : seg(st.T - c.t0, 0, 0.6);
    st.ambOverride = env.amb.map((v) => v * (1 - night * 0.55));
    if (!ok) { for (let q = 0; q < n; q++) if (Math.floor(st.T * 2 + q * 1.3) % 4 === 0) mark(st, "!", poses[q].x, poses[q].y - 24, "#fff0c0"); return; }
    const p = poses[w];
    for (let q = 0; q < n; q++) if (q !== w) { const pq = poses[q], z = (st.T * 0.8 + q * 0.4) % 1; st.text("Z", R(pq.x + 4 + z * 4), R(pq.y - 14 - z * 10), "#d8e0f0", { outline: "#1a1008" }); }
    const h = env.crew[w], nm = h ? String(h.name || "").split(" ")[0].toUpperCase() : "";
    if (nm) st.text(["FIRST", "SECOND", "THIRD", "LAST"][Math.min(3, turn % Math.max(1, n))] + " WATCH: " + nm, W / 2, 5, "#f4e4c0", { center: true, outline: "#1a1008" });
    if (p) { const hx = R(p.x) + (p.flip ? -6 : 5), hy = R(p.y - tall(env, w) - 2), sand = (st.T - c.t0) % 2.2 / 2.2; for (let j = 0; j < 5; j++) { const wd = j === 2 ? 0 : 1; for (let i = -wd; i <= wd; i++) st.px(hx + i, hy + j, (j < 2 && sand < 1 - j * 0.3) || (j > 2 && sand > (4 - j) * 0.4) ? "#e8c070" : "#c8d0d8", true); } st.rect(hx - 1, hy - 1, 3, 1, WOOD[3]); st.rect(hx - 1, hy + 5, 3, 1, WOOD[3]); }
  }
  function campClip(env, S, b) {
    const s0 = Object.assign({}, S), watcher = lead(env, b), res = (b.r && b.r[0] && b.r[0][1]) || "pass", ok = res === "pass";
    S.fire = ok ? true : "low"; S.barred = ok;
    const ev = [[0.4, "scrape", 0.7], [1.1, ok ? "clunk" : "thud", 1], [1.6, "hiss", 0.4], [2.3, "drip", 1], [3.0, "drip", 0.8]];
    const camp = { watcher, ok, s0: Object.assign({}, s0, { fire: S.fire, barred: ok }), t0: null };
    S.camp = camp;
    return { dur: 3.8, ev, draw(st, lt) {
      room(st, Object.assign({}, s0, { fire: lt > 1.6 ? S.fire : false, barred: ok && lt > 1.1 }));
      const [fx, fy] = env.bg.A.focus, poses = {};
      if (lt > 1.8) {
        // the rota keeps its own clock so it runs on through the held last frame
        if (camp.t0 == null || st.T < camp.t0) camp.t0 = st.T - (lt - 1.8);
        campScene(st, env, camp);
        return;
      }
      if (lt < 1.1) { const q = (watcher + 1) % Math.max(1, env.crew.length), u = seg(lt, 0, 1.0); poses[q] = walkPose(st, lerp(D.home(env, q).x, 146, u), 90, 6); if (u > 0.4) st.rect(R(lerp(D.home(env, q).x, 146, u)) + 2, 72, 18, 3, WOOD[3]); }
      if (!ok && lt > 1.1 && lt < 1.6) { const u = seg(lt, 1.1, 1.6); st.rect(150, R(38 + u * 50), 18, 3, WOOD[3]); }
      if (lt > 1.2) for (let q = 0; q < env.crew.length; q++) if (!poses[q]) { const hm = D.home(env, q), u = seg(lt, 1.2, 1.8), a = (q / env.crew.length) * Math.PI * 2 + 0.8; poses[q] = walkPose(st, lerp(hm.x, fx + Math.cos(a) * 26, u), lerp(hm.y, fy + 2 + Math.sin(a) * 4, u), 6, Math.cos(a) > 0.3 && u > 0.8); }
      crew(st, s0, poses);
      if (lt > 1.4 && lt < 1.9) sparkle(st, fx, fy - 4, seg(lt, 1.4, 1.9), "#ffb040", 6);
    } };
  }
  function secretClip(env, S, b) {
    const s0 = Object.assign({}, S), i = lead(env, b);
    S.secret = true;
    return { dur: 2.6, ev: [[0.8, "click", 1], [1.0, "rumble", 0.8], [1.8, "chime", 1]], draw(st, lt) {
      room(st, s0);
      const hm = D.home(env, i), u = seg(lt, 0, 0.7), p = u < 1 ? walkPose(st, lerp(hm.x + (s0.dx || 0), 44, u), lerp(hm.y, 84, u), 6, (hm.x + (s0.dx || 0)) > 44) : { x: 44, y: 84, frame: 1, flip: true };
      const k = seg(lt, 1.0, 1.9);
      if (lt < 1.0) { secretWall(st, 0); if (Math.floor(st.T * 10) % 2) for (let y = 30; y < FL; y += 2) st.px(22 + ((y * 7 + R(st.T * 30)) % 24), y, "#f0e0c0", true); }
      else secretWall(st, k);
      if (lt > 1.0 && lt < 2.2) dustCloud(st, 34, FL - 2, seg(lt, 1.0, 2.2), 18);
      crew(st, s0, { [i]: p });
      if (lt > 1.8) sparkle(st, 34, 44, seg(lt, 1.8, 2.6), "#ffe8a0", 10);
    } };
  }

  // fights: the approach, then a short clash dressed to the result; the full replay is a link under the scene
  function foesOf(env, b) { return ((b && b.foes) || env.rec.foes || []).slice(0, 3); }
  function approachClip(env, S, b, fight) {
    const s0 = Object.assign({}, S), c = b.c || "charge", res = (b.r && b.r[0] && b.r[0][1]) || "pass", foes = foesOf(env, fight), i = lead(env, b);
    S.foes = foes;
    const ev = c === "charge" ? [[0.2, "step", 1.2], [0.5, "step", 1.2]] : c === "parley" ? [[0.4, "scribble", 0.6], [1.2, "scribble", 0.6]] : [[0.3, "step", 0.5]];
    if (b.jumped) ev.push([1.0, "slam", 0.8]);
    return { dur: c === "parley" ? 2.6 : 1.6, ev, draw(st, lt) {
      room(st, s0);
      drawFoes(st, foes, lt, { alert: res !== "pass" || c === "charge" });
      const poses = {};
      for (let q = 0; q < env.crew.length; q++) {
        const hm = D.home(env, q);
        if (c === "charge") poses[q] = walkPose(st, hm.x - 20 + ease(seg(lt, 0, 0.9)) * 26, hm.y, 11);
        else if (c === "sneak") poses[q] = Object.assign(walkPose(st, hm.x - 14 + seg(lt, 0, 1.4) * 14, hm.y, 3), { tint: "#0a0a14", ta: 0.55 });
        else if (c === "scout") poses[q] = q === i ? { x: hm.x + Math.sin(seg(lt, 0.2, 1.4) * Math.PI) * 14, y: hm.y, frame: 0 } : { x: hm.x - 8, y: hm.y, frame: 0 };
        else poses[q] = { x: hm.x, y: hm.y, frame: 0 };
      }
      crew(st, s0, poses, { also: foes.map((f, k) => [128 + k * 18 - (foes.length - 1) * 4, 80]) });
      if (c === "charge" && lt < 0.9) st.uiDraw((o) => { o.fillStyle = "rgba(240,230,210,0.45)"; for (let k = 0; k < 5; k++) o.fillRect(R(20 + k * 9 - lt * 30), 60 + k * 6, 10, 1); });
      if (c === "sneak" && lt > 0.4) mark(st, "SHH", poses[i].x, poses[i].y - tall(env, i) - 8, "#c8d0e0");
      if (c === "parley") {
        if (lt > 0.3 && lt < 1.1) bubble(st, poses[i].x + 4, R(poses[i].y - tall(env, i) - 14), "...");
        if (lt > 1.1 && lt < 2.0) bubble(st, 140, 42, res === "pass" ? "..." : "!!");
        if (lt > 2.0 && res === "pass") mark(st, "OK", 140, 40, "#c8f0a0");
      }
      if (b.jumped && lt > 1.0) for (let q = 0; q < env.crew.length; q++) mark(st, "!", poses[q].x, poses[q].y - tall(env, q) - 8, "#ff8060");
    }, after: () => { if (c === "parley" && res === "pass") S.foes = null; } };
  }
  function drawFoes(st, foes, lt, o) {
    o = o || {};
    foes.forEach((id, k) => {
      if (o.down && o.down[k] != null && lt > o.down[k] + 0.6) return;
      const x = 128 + k * 18 - (foes.length - 1) * 4, y = 92 - (k % 2) * 4, dn = o.down && o.down[k] != null && lt > o.down[k];
      const lunge = o.lunge && o.lunge[k] != null ? Math.sin(seg(lt, o.lunge[k], o.lunge[k] + 0.3) * Math.PI) * -8 : 0;
      const fl = (dn && lt < o.down[k] + 0.08) || (o.flash && o.flash[k] != null && Math.abs(lt - o.flash[k]) < 0.06);
      st.mon(id, x + lunge, y, { flip: true, frame: (st.T * 2 + k) % 2 | 0, tint: fl ? "#ffffff" : dn ? "#1a0c08" : null, ta: fl ? 0.55 : 0.35, alpha: dn ? 1 - seg(lt, o.down[k] + 0.25, o.down[k] + 0.6) : 1, rot: dn ? 1 : 0 });
      if (dn) puff(st, x, y - 2, seg(lt, o.down[k], o.down[k] + 0.6), "#b8ac98", 8);
      if (o.alert && lt < 0.6 && !o.down) mark(st, "!", x, y - 30, "#ff8060");
    });
  }
  // a short clash dressed to the result: each blow is wound up, lands with a flash, a beat of hit-stop and a knock back, and the
  // heavy ones shake the room; foes stagger and go down one by one, then the winners' beat (a hop, a push-in, a hand up from the floor),
  // or on a loss the crew gives ground step by step under the foes' blows and then runs for it
  const EXCH = { clean: 3, solid: 4, close: 6, grim: 6, lost: 5 };
  const STEP = { clean: 0.44, solid: 0.48, close: 0.5, grim: 0.5, lost: 0.5 };
  const HS = 0.06;
  function fightClip(env, S, b) {
    const s0 = Object.assign({}, S), band = b.band || "solid", foes = (S.foes || foesOf(env, b)).filter(Boolean), lost = band === "lost";
    const n = env.crew.length, nf = Math.max(1, foes.length), ex = [], ev = [], step = STEP[band] || 0.48;
    const foeTurn = (k) => (band === "clean" ? k === 1 : band === "solid" ? k % 3 === 1 : lost ? k % 2 === 0 : k % 2 === 1);
    for (let k = 0; k < (EXCH[band] || 4); k++) {
      const t = 0.3 + k * step, back = foeTurn(k);
      ex.push({ t, hit: t + 0.12, hero: (k * 3 + 1) % Math.max(1, n), foe: k % nf, back, heavy: back && (band === "grim" || lost) });
      ev.push([t - 0.1, "whoosh", 0.5], [t + 0.12, back ? "thud" : "hit", back ? 0.9 : 1]);
    }
    const clash = 0.3 + ex.length * step, down = {};
    if (!lost) foes.forEach((f, k) => {
      const last = ex.filter((e) => !e.back && e.foe === k).slice(-1)[0];
      down[k] = last ? last.hit : clash - 0.2 + k * 0.14;
      if (last) last.heavy = true;
      ev.push([down[k] + 0.3, "thud", 0.7]);
    });
    const downHero = (band === "close" || band === "grim") && n > 1 ? ex.filter((e) => e.back).slice(-1).map((e) => e.hero)[0] : null;
    const win = clash + 0.3, dur = win + (lost ? 2.1 : 1.5);
    const stops = ex.map((e) => e.hit);
    const mt = (lt) => lt - stops.reduce((a, h) => a + clamp(lt - h, 0, HS), 0);
    const pushes = lost ? [0, 1, 2].map((k) => win + k * 0.42) : [];
    if (lost) { pushes.forEach((t) => ev.push([t + 0.12, "thud", 0.8], [t + 0.2, "step", 1])); ev.push([win + 1.4, "step", 1.2], [win + 1.6, "step", 1.2], [win + 1.5, "roar", 0.6]); }
    else ev.push([win + 0.1, band === "clean" || band === "solid" ? "chime" : "beat", 0.7]);
    S.foes = null;
    if (lost) S.dx = (S.dx || 0) - 90;
    const fx = (k) => 128 + k * 18 - (foes.length - 1) * 4;
    return { dur, ev, draw(st, lt) {
      room(st, s0);
      const m = mt(lt), poses = {};
      if (ex.some((e) => e.heavy && lt > e.hit && lt < e.hit + 0.14)) st.shake(2.2);
      // the ground the crew gives on a loss, and how far the foes follow
      const give = lost ? pushes.reduce((a, t) => a + ease(seg(lt, t + 0.1, t + 0.32)) * 13, 0) : 0;
      const run = lost ? easeIn(seg(lt, win + 1.35, dur)) * 120 : 0;
      foes.forEach((id, k) => {
        if (!lost && lt > down[k] + 1.15) return;
        let x = fx(k), dy = 0, skew = 0, tint = null, ta = 0.35, rot = 0, alpha = 1;
        const y = 92 - (k % 2) * 4;
        for (const e of ex) {
          if (e.foe !== k) continue;
          if (e.back) {
            x += ease(seg(m, e.t - 0.14, e.t)) * 5 * (1 - seg(m, e.t, e.t + 0.1));
            dy += arc(seg(m, e.t - 0.14, e.t), 2);
            x -= Math.sin(seg(m, e.t, e.t + 0.42) * Math.PI) * 22;
          } else {
            const kb = ease(seg(m, e.hit, e.hit + 0.18)) * (e.heavy ? 12 : 7) * (1 - seg(m, e.hit + 0.3, e.hit + 0.6) * (e.heavy ? 0 : 0.6));
            x += kb; skew += 0.22 * Math.sin(seg(m, e.hit, e.hit + 0.35) * Math.PI);
            if (lt > e.hit && lt < e.hit + 0.05) { tint = "#ffffff"; ta = 0.85; } else if (lt >= e.hit + 0.05 && lt < e.hit + 0.11) { tint = "#ffb090"; ta = 0.55; }
          }
        }
        if (!lost && down[k] != null && lt > down[k] + 0.14) {
          const u = seg(lt, down[k] + 0.14, down[k] + 0.4);
          dy += u < 1 ? arc(u, 5) : -Math.abs(Math.sin(seg(lt, down[k] + 0.4, down[k] + 0.55) * Math.PI)) * 2;
          rot = u > 0.45 ? 1 : 0; skew = u > 0.45 ? 0 : 0.35;
          if (!tint) { tint = "#1a0c08"; ta = 0.25 + seg(lt, down[k] + 0.5, down[k] + 1.0) * 0.4; }
          alpha = 1 - seg(lt, down[k] + 0.8, down[k] + 1.15);
          if (u >= 1) puff(st, x, y - 1, seg(lt, down[k] + 0.4, down[k] + 1.0), "#b8ac98", 10);
        }
        // the winners hold the room: they press the crew back, then stand their ground and roar as it runs (they never leave with it)
        if (lost && lt > win) { x -= give * 0.85; dy += lt > win + 1.35 ? -Math.abs(Math.sin((lt - win) * 9 + k)) * 2 : 0; for (const t of pushes) x -= Math.sin(seg(lt, t, t + 0.3) * Math.PI) * (k === 0 ? 14 : 6); }
        st.mon(id, x, y + dy, { flip: true, frame: (st.T * 3 + k) % 2 | 0, tint, ta, alpha, rot, skew });
        for (const e of ex) if (e.back && e.foe === k && m > e.t && m < e.t + 0.16) for (let q = 1; q < 7; q++) st.px(x + 12 + q * 3, y - 12 + (q % 2) * 3, bay(q, 1) < 0.6 ? "#e8dcc8" : null);
        if (lost && lt > win + 1.4 && lt < win + 2.1 && k < 2) mark(st, "!!", x, y - 34, "#ff8060");
      });
      for (let q = 0; q < n; q++) {
        const hm = D.home(env, q), home = hm.x + 22 - q * 2;
        let x = home, dy = 0, tint = null, ta = 0, skew = 0;
        for (const e of ex) {
          if (e.hero !== q) continue;
          if (!e.back) {
            const reach = fx(e.foe) - 14 - home;
            if (m < e.t) { x -= ease(seg(m, e.t - 0.14, e.t)) * 5; dy += m > e.t - 0.14 ? 1 : 0; }
            else if (m < e.hit) { x += lerp(-5, reach, ease(seg(m, e.t, e.hit))); skew += 0.2; }
            else { x += reach * (1 - ease(seg(m, e.hit + 0.08, e.hit + 0.36))); }
            dy += m >= e.t && m < e.hit + 0.36 ? arc(seg(m, e.t, e.hit + 0.36), 3) : 0;
          } else if (lt > e.hit) {
            x -= ease(seg(m, e.hit, e.hit + 0.16)) * (e.heavy ? 10 : 6) * (1 - seg(m, e.hit + 0.25, e.hit + 0.55));
            skew -= 0.2 * Math.sin(seg(m, e.hit, e.hit + 0.3) * Math.PI);
            if (lt < e.hit + 0.05) { tint = "#ffffff"; ta = 0.8; } else if (lt < e.hit + 0.11) { tint = "#ff9070"; ta = 0.5; }
          }
        }
        poses[q] = { x, y: hm.y, dy, frame: Math.floor(st.T * 5 + q) % 2, skew };
        if (tint) Object.assign(poses[q], { tint, ta });
        if (lost && lt > win) {
          const back = x - give - run, stepping = pushes.some((t) => lt > t + 0.1 && lt < t + 0.32);
          poses[q] = lt > win + 1.35 ? walkPose(st, back, hm.y, 12, true) : { x: back, y: hm.y, frame: stepping ? 1 : 0, dy: stepping ? -1 : 0 };
          pushes.forEach((t, k) => { if (q === k % n && lt > t + 0.12 && lt < t + 0.2) Object.assign(poses[q], { tint: "#ffffff", ta: 0.7, skew: -0.2 }); });
        }
        if (!lost && lt > win) {
          const k = seg(lt, win + 0.15 + q * 0.12, win + 0.65 + q * 0.12), big = band === "clean" || band === "solid";
          poses[q] = { x: home, y: hm.y, frame: k > 0 && k < 1 ? 1 : 0, dy: arc(k, big ? 8 : 4) };
        }
        if (q === downHero) {
          const hit = ex.filter((e) => e.back && e.hero === q).slice(-1)[0], t0 = hit ? hit.hit + 0.12 : 99;
          if (lt > t0 && lt < win + 0.55) Object.assign(poses[q], { rot: 3, x: poses[q].x - 8, dy: 0, noTorch: true, skew: 0 });
        }
      }
      crew(st, s0, poses, { also: foes.map((f, k) => [fx(k), 80]).filter((p, k) => lost || down[k] == null || lt < down[k] + 1.0) });
      for (const e of ex) {
        const p = poses[e.hero];
        if (!p || lt < e.hit || lt > e.hit + 0.24) continue;
        const u = seg(lt, e.hit, e.hit + 0.24);
        if (!e.back) {
          const hx = p.x + 9, hy = p.y - 16;
          for (let k = 0; k < 11; k++) { const a = -1.4 + k * 0.28; if (k / 11 < u * 1.6) st.px(hx + Math.cos(a) * 10, hy + Math.sin(a) * 10, k / 11 > u ? "#fff4c0" : "#ffffff", true); }
          impact(st, fx(e.foe) - 6, 80 - (e.foe % 2) * 4, u, e.heavy);
        } else {
          impact(st, p.x + 4, p.y - 14, u, e.heavy, "#ffd0b0");
          if (u > 0.3) stars(st, p.x, p.y - tall(env, e.hero) - 2, st.T);
        }
      }
      if (downHero != null && poses[downHero] && poses[downHero].rot) stars(st, poses[downHero].x, poses[downHero].y - 8, st.T);
      if (downHero != null && !lost && lt > win + 0.2 && lt < win + 0.6) {
        const j = (downHero + 1) % n, a = poses[j], dn = poses[downHero];
        if (a && dn) { mark(st, "!", a.x, a.y - tall(env, j) - 8, "#fff0c0"); st.line(a.x - 3, a.y - 14, dn.x + 6, dn.y - 4, mix(((env.crew[downHero] || {}).look || {}).skin || "#d8a880", "#000000", 0.2)); }
      }
      if (!lost && lt > win) {
        const k = seg(lt, win, win + 0.9), big = band === "clean" || band === "solid";
        st.cam.z = 1 + ease(seg(lt, win, win + 0.6)) * (big ? 0.14 : 0.08); st.cam.cx = 62; st.cam.cy = 68;
        st.light(D.home(env, 0).x, 70, 70, [1, 0.85, 0.55], 0.35 * Math.sin(k * Math.PI));
        for (let q = 0; q < n; q++) { const p = poses[q]; if (big) sparkle(st, p.x + 6, p.y - tall(env, q) + 2, seg(k, q * 0.12, 0.6 + q * 0.12), "#ffe27a", 7); else if (q !== downHero) puff(st, p.x + 6, p.y - tall(env, q) + 6, seg(k, 0.1, 0.8), "#d8e0e8", 4); }
      }
      if (lost && lt > win && lt < win + 0.5) for (let q = 0; q < n; q++) mark(st, "!", poses[q].x, poses[q].y - tall(env, q) - 8, "#ff8060");
    } };
  }
  // the moment a blow lands: a white core, rays thrown out and a ring that opens, bigger for a heavy one
  function impact(st, x, y, u, heavy, col) {
    if (u >= 1) return;
    const R0 = heavy ? 11 : 7, c = col || "#fff4c0", nr = heavy ? 8 : 6;
    if (u < 0.2) { st.rect(x - 1, y - 1, 3, 3, "#ffffff", true); if (heavy) { st.rect(x - 2, y, 5, 1, "#ffffff", true); st.rect(x, y - 2, 1, 5, "#ffffff", true); } }
    for (let k = 0; k < nr; k++) {
      const a = (k / nr) * Math.PI * 2 + 0.3, r0 = 2 + u * R0 * 0.6, r1 = r0 + (1 - u) * (heavy ? 6 : 4);
      for (let r = r0; r < r1; r++) st.px(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, r > r1 - 2 ? c : "#ffffff", true);
    }
    if (u > 0.3) for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; if (bay(k, R(u * 6)) < 1 - u) st.px(x + Math.cos(a) * R0 * u, y + Math.sin(a) * R0 * u * 0.7, c, true); }
    st.light(x, y, heavy ? 30 : 20, [1, 0.92, 0.7], (1 - u) * (heavy ? 1.2 : 0.8));
  }

  // the boss: a slow push-in, the name card, the clash, then a freeze with the stamp
  function bossClip(env, S, scout, b) {
    const s0 = Object.assign({}, S), band = b.band || "solid", slain = band !== "lost", name = env.rec.bossName || "The master of this place";
    const ev = [[0.3, "dread", 1], [1.6, "roar", 1], [2.5, "whoosh", 1], [2.75, "slam", 1.2]];
    const t1 = 2.4, t2 = 4.4, t3 = 7.4;
    for (let k = 0; k < 6; k++) ev.push([t2 + 0.3 + k * 0.42, "hit", 1]);
    if (slain) ev.push([t3 - 0.2, "thud", 1], [t3 + 0.3, "stamp", 1.3]);
    else ev.push([t3 - 0.6, "roar", 1]);
    S.bossHere = slain ? false : true;
    if (!slain) S.dx = (S.dx || 0) - 90;
    const id = env.boss, swings = [];
    for (let k = 0; k < 6; k++) swings.push({ t: t2 + 0.3 + k * 0.42, hero: k % Math.max(1, env.crew.length), back: k % 3 === 2 });
    return { dur: t3 + (slain ? 1.6 : 0.6), ev, boss: true, draw(st, lt) {
      const [fx, fy] = env.bg.A.focus;
      room(st, Object.assign({}, s0, { bossHere: false }));
      const bcv = id ? D.monCanvas(id, 0) : null, bb = bcv ? bbox(bcv) : { h: 30 };
      if (lt < t1) {
        const z = 1 + ease(seg(lt, 0.2, t1)) * 0.9;
        st.cam.z = z; st.cam.cx = fx - 6; st.cam.cy = fy - bb.h / 2;
        if (id) st.mon(id, fx, fy, { frame: (st.T * 1.5) % 2 | 0, flip: true });
        crew(st, s0, scout && scout.c === "scout" ? { 0: { x: D.home(env, 0).x - 6 + Math.sin(seg(lt, 0.2, 1.4) * Math.PI) * 10, y: D.home(env, 0).y, frame: 0 } } : null);
        if (lt > 1.4) { const ey = fy - bb.h + R(bb.h * 0.22), ex = fx + R(bb.cx * -1) - 2; st.px(ex - 2, ey, "#ffe060", true); st.px(ex + 2, ey, "#ffe060", true); st.light(ex, ey, 14, [1, 0.9, 0.4], 0.8); }
        if (lt > 1.6 && lt < 2.2) st.shake(1.5);
        return;
      }
      if (lt < t2) {
        st.cam.z = 1.9; st.cam.cx = fx - 6; st.cam.cy = fy - bb.h / 2;
        if (id) st.mon(id, fx, fy, { frame: (st.T * 1.5) % 2 | 0, flip: true });
        const u = ease(seg(lt, t1 + 0.1, t1 + 0.4));
        st.uiDraw((o) => {
          const y = 62, x = R(lerp(-W, 0, u));
          o.fillStyle = "#1a0806"; o.fillRect(x, y - 2, W, 26); o.fillStyle = "#8a1e14"; o.fillRect(x, y, W, 22); o.fillStyle = "#c0382a"; o.fillRect(x, y, W, 2); o.fillStyle = "#5a0e0a"; o.fillRect(x, y + 20, W, 2);
          o.fillStyle = "#e8c050"; o.fillRect(x + 6, y + 4, 22, 7); D.text(o, "BOSS", x + 9, y + 5, "#2a0a06");
          const k = D.textWidth(name, 2) <= W - 16 ? 2 : 1;
          D.text(o, name.toUpperCase(), x + 8, y + (k === 2 ? 12 : 14), "#fff4dc", { k, shadow: "#3a0806" });
        });
        if (lt < t1 + 0.5) st.shake(2.5 * (1 - seg(lt, t1 + 0.3, t1 + 0.5)));
        return;
      }
      const freeze = slain && lt > t3 - 0.15, tt = freeze ? t3 - 0.15 : lt;
      if (id) {
        const hitBy = swings.filter((s) => !s.back && Math.abs(tt - s.t - 0.12) < 0.07).length, lunge = swings.filter((s) => s.back).reduce((a, s) => a + Math.sin(seg(tt, s.t, s.t + 0.3) * Math.PI) * -10, 0);
        st.mon(id, fx + lunge, fy, { flip: true, frame: (st.T * 2) % 2 | 0, tint: hitBy ? "#ffffff" : null, ta: 0.55 });
      }
      const poses = {};
      for (let q = 0; q < env.crew.length; q++) {
        const hm = D.home(env, q);
        let x = hm.x + 18;
        for (const s of swings) if (s.hero === q && !s.back) x += Math.sin(seg(tt, s.t, s.t + 0.3) * Math.PI) * 18;
        poses[q] = { x, y: hm.y, frame: Math.floor(st.T * 4 + q) % 2 };
        for (const s of swings) if (s.back && s.hero === q && Math.abs(tt - s.t - 0.15) < 0.07) Object.assign(poses[q], { tint: "#ffffff", ta: 0.55, x: x - 4 });
        if (!slain && lt > t3 - 1.0) poses[q] = walkPose(st, x - easeIn(seg(lt, t3 - 1.0, t3 + 0.4)) * 120, hm.y, 11, true);
      }
      crew(st, s0, poses);
      for (const s of swings) if (!s.back && tt > s.t + 0.08 && tt < s.t + 0.22) { const hx = poses[s.hero].x + 14; for (let k = 0; k < 9; k++) st.px(hx + Math.cos(k * 0.35 - 1.4) * 10, 70 + Math.sin(k * 0.35 - 1.4) * 10, "#ffffff", true); }
      for (const s of swings) if (tt > s.t + 0.12 && tt < s.t + 0.36) { const u = seg(tt, s.t + 0.12, s.t + 0.36), p = poses[s.hero]; if (s.back) impact(st, p.x + 4, p.y - 14, u, true, "#ffd0b0"); else impact(st, fx - 10, fy - bb.h * 0.5, u, false); }
      if (swings.some((s) => s.back && Math.abs(tt - s.t - 0.15) < 0.1)) st.shake(2);
      if (freeze) {
        const k = seg(lt, t3 - 0.15, t3 + 0.3);
        st.post.grey = 0.85 * k;
        const sk = 1 + (1 - ease(seg(lt, t3 + 0.2, t3 + 0.45))) * 2.5;
        if (lt > t3 + 0.2) st.uiDraw((o) => stamp(o, W / 2 + 8, 30, sk));
        if (lt > t3 + 0.3 && lt < t3 + 0.5) st.shake(3);
      }
    } };
  }
  // the SLAIN stamp from the map, sheared a pixel every few rows so it sits askew without blurring
  function stamp(o, cx, cy, s) {
    const tw = D.textWidth("SLAIN", 3), w = tw + 12, h = 23, x0 = R(cx - w / 2), y0 = R(cy - h / 2);
    const tmp = root.document.createElement("canvas"); tmp.width = w + 4; tmp.height = h + 4;
    const t = tmp.getContext("2d");
    t.fillStyle = "#c0281e"; t.fillRect(2, 2, w, 2); t.fillRect(2, h, w, 2); t.fillRect(2, 2, 2, h); t.fillRect(w, 2, 2, h);
    t.fillRect(4, 5, w - 4, 1); t.fillRect(4, h - 1, w - 4, 1);
    D.text(t, "SLAIN", 8, 7, "#c0281e", { k: 3 });
    const d = t.getImageData(0, 0, tmp.width, tmp.height);
    for (let i = 3; i < d.data.length; i += 4) if (d.data[i] && hash(i, 1, 3) < 0.05) d.data[i] = 0;
    t.putImageData(d, 0, 0);
    o.save();
    o.imageSmoothingEnabled = false;
    const sw = R(tmp.width * s), sh = R(tmp.height * s);
    for (let y = 0; y < tmp.height; y++) { const shift = R((tmp.height / 2 - y) / 4); o.drawImage(tmp, 0, y, tmp.width, 1, R(x0 + (tmp.width - sw) / 2 + shift * s), R(y0 + (tmp.height - sh) / 2 + y * s), sw, Math.max(1, R(s))); }
    o.restore();
  }
  function lairScout(env, S, b) {
    const s0 = Object.assign({}, S), rush = b.c === "rush";
    return { dur: rush ? 0.9 : 1.6, ev: rush ? [[0.2, "step", 1.2], [0.5, "step", 1.2]] : [[0.3, "step", 0.4]], draw(st, lt) {
      room(st, Object.assign({}, s0, { bossHere: true }));
      const poses = {};
      for (let q = 0; q < env.crew.length; q++) { const hm = D.home(env, q); poses[q] = rush ? walkPose(st, hm.x - 20 + ease(seg(lt, 0, 0.8)) * 22, hm.y, 11) : Object.assign({ x: hm.x - 10 + (q === 0 ? Math.sin(seg(lt, 0.2, 1.4) * Math.PI) * 10 : 0), y: hm.y, frame: 0 }, { tint: "#0a0a14", ta: 0.5 }); }
      crew(st, s0, poses);
    } };
  }

  // a room type's own step: whoever it picked steps up and works at the room's object
  function customClip(env, S, b) {
    const kind = env.kind, c = b.c || "";
    if (kind === "chest" || kind === "secret") return /pick|careful|sense|inventory|count/.test(c) ? chestOpen(env, S, Object.assign({}, b, { c: "pick" })) : chestOpen(env, S, Object.assign({}, b, { c: "force" }));
    if (kind === "obstacle") return crossClip(env, S, b);
    if (kind === "puzzle") return puzzleClip(env, S, Object.assign({}, b, { s: "custom" }));
    if (kind === "shrine") return shrineClip(env, S, Object.assign({}, b, { c: /strip|take/.test(c) ? "strip" : "pray" }));
    if (kind === "lore") return loreClip(env, S, b);
    if (kind === "supplies") return suppliesClip(env, S, b);
    if (kind === "cache") return searchClip(env, S, b);
    if (kind === "remains") return remainsClip(env, S, Object.assign({}, b, { c: "search" }));
    if (kind === "camp_spot") return campClip(env, S, b);
    if (kind === "fear") return fearClip(env, S, Object.assign({}, b, { r: (b.r || []).map(([id, res]) => [id, res, "the dark"]) }));
    if (kind === "trap" || kind === "famous") return handleClip(env, S, Object.assign({}, b, { c: "disarm" }));
    if (kind === "fight" || kind === "stair") return calmClip(env, S, b);
    const s0 = Object.assign({}, S), list = (b.r || []).map(([id, res]) => ({ i: idxOf(env, id), res })).filter((w) => w.i >= 0), w = list[0] || { i: 0, res: "pass" }, ok = w.res === "pass" || w.res === "partial";
    return { dur: 2.0, ev: [[0.6, "scrape", 0.6], [1.3, ok ? "chime" : "pop", ok ? 0.6 : 0.8]], draw(st, lt) {
      room(st, s0);
      const [fx, fy] = env.bg.A.focus, hm = D.home(env, w.i), u = seg(lt, 0, 0.5), p = u < 1 ? walkPose(st, lerp(hm.x, fx - 16, u), lerp(hm.y, Math.min(94, fy + 2), u), 7) : { x: fx - 16 + (lt < 1.3 ? Math.floor(st.T * 14) % 2 : 0), y: Math.min(94, fy + 2), frame: 0 };
      crew(st, s0, { [w.i]: p });
      if (lt > 1.3) { if (ok) sparkle(st, fx - 6, fy - 14, seg(lt, 1.3, 2.0)); else { puff(st, fx - 6, fy - 4, seg(lt, 1.3, 1.9)); mark(st, "?", p.x, p.y - tall(env, w.i) - 8, "#fff0c0"); } }
    } };
  }
  // a fight room's own way past (calming the wolf, hearing the ghost out, a bribe): the one it picked walks up to what lives there,
  // which is there to see; it settles and goes, or it lunges
  const CALM_FOE = [[/wolf|hound|pup|whelp/, "wolf"], [/bear/, "cave_bear"], [/rat/, "giant_rat"], [/spider|web/, "giant_spider"], [/bat/, "giant_bat"],
    [/widow|ghost|pale|weep|mourn|wraith/, "wraith"], [/bone|skelet|crypt/, "skeleton"], [/hag|witch/, "hag_mother"], [/troll/, "cave_troll"], [/kobold/, "kobold"], [/goblin|chief|camp/, "goblin"]];
  const BEASTLY = new Set(["wolf", "dire_wolf", "frost_wolf", "cave_bear", "giant_rat", "giant_spider", "giant_bat", "boar", "salamander", "crab"]);
  const THEME_FOE = { goblin: "goblin", beast: "wolf", cave: "kobold", undead: "skeleton", swamp: "bog_crawler", ice: "frost_wolf", sea: "drowned", fire: "salamander" };
  function calmClip(env, S, b) {
    const s0 = Object.assign({}, S), list = (b.r || []).map(([id, res]) => ({ i: idxOf(env, id), res })).filter((w) => w.i >= 0), w = list[0] || { i: 0, res: "pass" };
    // a look before a fight that still happens: the foe stays put and the watcher keeps their distance
    const ok = (w.res === "pass" || w.res === "partial") && !b.fightNext, watch = !!b.fightNext, nm = String(env.rec.name || "").toLowerCase();
    const id = (env.rec.foes || [])[0] || (CALM_FOE.find(([re]) => re.test(nm)) || [])[1] || THEME_FOE[env.theme] || "wolf";
    return { dur: 3.0, ev: [[0.3, "step", 0.5], [1.4, ok ? "chime" : "slam", ok ? 0.5 : 0.8]], draw(st, lt) {
      room(st, s0);
      const hm = D.home(env, w.i), fy = hm.y, fx = 140;
      const gone = ok ? seg(lt, 1.6, 2.8) : 0, lunge = !ok && !watch ? Math.sin(seg(lt, 1.3, 1.7) * Math.PI) * -18 : 0;
      st.mon(id, fx + gone * 40 + lunge, fy, { flip: !(ok && lt > 1.6), frame: (st.T * (ok && lt > 1.6 ? 6 : 2)) % 2 | 0, alpha: 1 - seg(gone, 0.5, 1) });
      const u = seg(lt, 0, 0.9), tx = watch ? fx - 60 : fx - 34, kneel = lt > 0.9 && lt < (ok ? 2.4 : 1.4);
      const knock = !ok && !watch ? ease(seg(lt, 1.45, 1.8)) * -14 : 0;
      // back to the crew's line by the end, so the next beat starts where this one leaves off
      const home = seg(lt, ok || watch ? 2.5 : 2.2, 3.0), ax = tx + (!ok && !watch ? -14 : 0);
      const p = u < 1 ? walkPose(st, lerp(hm.x, tx, u), fy, 4) : home > 0 ? Object.assign(walkPose(st, lerp(ax, hm.x, home), fy, home < 1 ? 7 : 0, true), home >= 1 ? { flip: false, frame: 0, dy: 0 } : {}) : { x: tx + knock, y: fy, frame: 0, dy: kneel ? 3 : 0 };
      const poses = {};
      for (let q = 0; q < env.crew.length; q++) if (q !== w.i) { const h2 = D.home(env, q); poses[q] = { x: h2.x - 6, y: h2.y, frame: 0 }; }
      poses[w.i] = p;
      crew(st, s0, poses);
      if (lt > 0.9 && lt < 1.5 && !watch) bubble(st, p.x + 4, R(p.y - tall(env, w.i) - 12), "...");
      if (watch && lt > 0.9 && lt < 2.4) mark(st, "?", fx, fy - 30, "#fff0c0");
      if (ok && lt > 1.6 && lt < 2.6) mark(st, BEASTLY.has(id) ? "zz" : "OK", fx + gone * 40, fy - 26, "#c8f0a0");
      if (!ok && !watch && lt > 1.4 && lt < 2.2) mark(st, "!", p.x, p.y - tall(env, w.i) - 8, "#ff8060");
    } };
  }
  function stairExit(env, S) {
    const s0 = Object.assign({}, S);
    return { dur: 1.6, ev: [[0.3, "step", 1], [0.8, "step", 0.8]], draw(st, lt) {
      room(st, s0);
      const poses = {};
      for (let q = 0; q < env.crew.length; q++) {
        const hm = D.home(env, q), u = seg(lt, q * 0.15, 1.3 + q * 0.1), x = lerp(hm.x + (s0.dx || 0), 168, u), down = Math.max(0, x - 140) * 0.6;
        poses[q] = Object.assign(walkPose(st, x, hm.y + down, 6), { clipY: x > 140 ? 72 + (x - 140) * 0.9 : null, alpha: 1 - seg(x, 158, 168) });
      }
      crew(st, s0, poses);
    } };
  }
  function retreat(env, S) {
    const s0 = Object.assign({}, S);
    return { dur: 1.3, ev: [[0.2, "step", 1.2], [0.5, "step", 1.2]], draw(st, lt) {
      room(st, s0);
      const poses = {};
      for (let q = 0; q < env.crew.length; q++) { const hm = D.home(env, q); poses[q] = walkPose(st, hm.x + (s0.dx || 0) - easeIn(seg(lt, 0, 1.2)) * 110, hm.y, 11, true); }
      crew(st, s0, poses);
    } };
  }

  // ---------- the plan ----------
  // an old record without beats still plays: the room's kind, its result and its finds
  function guessBeats(rec) {
    const out = [], k = rec.kind;
    if (k === "trap" || k === "famous") out.push({ s: "trap_spot", c: "spot", r: [["", rec.sprung ? "fail" : "pass"]] }, rec.sprung ? { s: "trap_react", r: [] } : { s: "trap_handle", c: "round" });
    else if (k === "chest" || k === "secret") out.push({ s: "chest_open", c: "pick", r: [["", "pass"]] });
    else if (k === "fight" || k === "stair") out.push({ s: "fight_approach", c: "charge" }, { s: "fight", band: rec.result === "driven back" ? "lost" : "solid", foes: [] });
    else if (k === "lair") out.push({ s: "lair_scout", c: "rush" }, { s: "lair_fight", band: rec.result === "driven back" ? "lost" : "solid" });
    else if (k === "puzzle") out.push({ s: rec.sub || "mechanism", r: [["", "pass"]] });
    else if (k === "obstacle") out.push({ s: rec.sub || "chasm", c: "leap", r: [] });
    else if (["shrine", "remains", "supplies", "lore", "camp_spot"].includes(k)) out.push({ s: k, c: k === "shrine" ? "pray" : k === "remains" ? "bury" : "read", r: [["", "pass"]] });
    else if (k === "cache") out.push({ s: "cache_search", r: [["", "pass"]] });
    if ((rec.loot || []).length || rec.silver) {
      const gear = rec.loot || [];
      if (!gear.length) out.push({ s: "loot", silver: rec.silver, goods: {}, gear: null });
      gear.forEach((l, i) => out.push({ s: "loot", silver: i ? 0 : rec.silver, goods: {}, gear: l.name }));
    }
    return out;
  }
  D.build = function (rec, env) {
    const kind = rec.kind === "famous" ? "famous" : rec.kind;
    env.bg = D.background(env.theme, env.depth, kind, { sub: rec.sub || (kind === "obstacle" ? "chasm" : ""), seed: env.seed % 3, name: rec.name });
    const statics = (root.LD && root.LD.static) || {};
    env.boss = rec.boss && rec.boss.mon ? rec.boss.mon : ((statics.dungeons || {})[rec.did] || {}).boss || null;
    env.rec.bossName = (rec.boss && rec.boss.name) || ((statics.monsters || {})[env.boss] || {}).name;
    // a successor rides in the sprite id (DelveScenes.monCanvas reads "id@role@gen"), so every lair beat draws its variant
    if (env.boss && rec.boss && rec.boss.role) env.boss += `@${rec.boss.role}@${rec.boss.gen || 2}`;
    env.rec.foes = rec.foes || [];
    const P = { env, clips: [], events: [], len: 0 }, S = { dx: 0 };
    if (!env.bg.A.mural) env.bg.A = Object.assign({}, env.bg.A, { mural: [24, 14, 76, 34] });
    const add = (c) => {
      if (!c) return;
      c.t0 = P.len;
      for (const e of c.ev || []) P.events.push([c.t0 + e[0], e[1], e[2] == null ? 1 : e[2], e[3]]);
      P.len += c.dur;
      P.clips.push(c);
      if (c.after) c.after();
    };
    add(intro(env, S));
    const beats = (rec.beats && rec.beats.length ? rec.beats : guessBeats(rec)).slice();
    if (!env.rec.foes.length) { const fb = beats.find((x) => x.foes && x.foes.length); if (fb) env.rec.foes = fb.foes; }
    // captions: each beat's own line as its clip starts (an older record without them spreads its story's sentences over the clips)
    const says = [];
    const told = beats.some((b) => b.t) || rec.enter;
    if (told && rec.enter) says.push([0.05, rec.enter]);
    let scout = null;
    for (let k = 0; k < beats.length; k++) {
      const b = beats[k], nx = beats[k + 1] || {}, at = P.len;
      const sayAt = says.length;
      if (told && b.t) says.push([at + 0.05, b.t]);
      switch (b.s) {
        case "fear": add(fearClip(env, S, b)); break;
        case "trap_spot": add(spotClip(env, S, b)); break;
        case "trap_handle": add(handleClip(env, S, b)); break;
        case "trap_react": add(reactClip(env, S, b, false)); break;
        case "spring": add(reactClip(env, S, b, true)); break;
        case "chest_look": add(chestLook(env, S, Object.assign({}, b, { next: nx.s === "chest_trapped_found" ? "found" : "" }))); break;
        case "chest_trapped_found": add(b.c === "leave" ? chestLeave(env, S) : handleClip(env, S, Object.assign({}, b, { c: "disarm" }))); break;
        case "chest_open": case "chest_force_after": add(chestOpen(env, S, b)); break;
        case "loot": add(lootClip(env, S, b)); break;
        case "riddle": case "mechanism": case "rune_lock": add(puzzleClip(env, S, b)); break;
        case "chasm": case "rubble": case "flood": case "crawl": case "stuck_door": case "stuck_door_force": case "slope": add(crossClip(env, S, b)); break;
        case "shrine": add(shrineClip(env, S, b)); break;
        case "remains": add(remainsClip(env, S, b)); break;
        case "lore": add(loreClip(env, S, b)); break;
        case "supplies": add(suppliesClip(env, S, b)); break;
        case "cache_search": add(searchClip(env, S, b)); break;
        case "camp_spot": add(campClip(env, S, b)); break;
        case "secret_look": if ((b.r || []).some((x) => x[1] === "pass")) add(secretClip(env, S, b)); break;
        case "fight_approach": add(approachClip(env, S, b, beats.slice(k + 1).find((x) => x.s === "fight"))); break;
        case "fight": add(fightClip(env, S, b)); break;
        case "lair_scout": scout = b; add(lairScout(env, S, b)); break;
        case "lair_fight": add(bossClip(env, S, scout, b)); break;
        case "custom": add(customClip(env, S, Object.assign({}, b, { fightNext: beats.slice(k + 1).some((x) => x.s === "fight" || x.s === "lair_fight") }))); break;
        default: break;
      }
      // a fight's line tells how it ended, so it waits for the end of the clash rather than giving the result away
      if ((b.s === "fight" || b.s === "lair_fight") && says[sayAt] && P.len > at) says[sayAt][0] = Math.max(at + 0.05, P.len - 1.4);
    }
    if (rec.kind === "stair" && rec.result !== "driven back") add(stairExit(env, S));
    else if (rec.result === "driven back" && !beats.some((b) => b.s === "fight" || b.s === "lair_fight")) add(retreat(env, S));
    add(settle(env, S, 0.8));
    if (!told && rec.story) {
      const lines = String(rec.story).split(/(?<=[.!?])\s+(?=[A-Z"'])/).filter(Boolean), cl = P.clips.slice(1, -1);
      lines.forEach((ln, i) => {
        const c = i === 0 || !cl.length ? P.clips[0] : cl[Math.min(cl.length - 1, Math.floor(((i - 1) * cl.length) / Math.max(1, lines.length - 1)))];
        says.push([c.t0 + 0.05 + (i === 0 ? 0 : 0.01 * i), ln]);
      });
    }
    for (const [t, say] of says) P.events.push([t, "", 0, { say }]);
    P.events.sort((a, b) => a[0] - b[0]);
    return P;
  };
})(typeof window !== "undefined" ? window : globalThis);
