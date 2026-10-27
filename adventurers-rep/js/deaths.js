/* Monster deaths for the fight replay: each body type falls its own way, painted pose by pose (no rotated bitmaps), plus dust, ash, motes and debris. */
(function () {
  "use strict";
  const R = Math.round, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const seg = (a, a0, a1) => clamp((a - a0) / (a1 - a0), 0, 1);
  const eOut = (k) => 1 - (1 - k) * (1 - k), eIn = (k) => k * k, sm = (k) => k * k * (3 - 2 * k);
  const back = (k) => 1 + 2.6 * Math.pow(k - 1, 3) + 1.6 * Math.pow(k - 1, 2);
  const qz = (v, st) => Math.round(v / st) * st;
  function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s ^ (s << 13)) >>> 0, s = (s ^ (s >>> 17)) >>> 0, s = (s ^ (s << 5)) >>> 0) / 4294967296); }
  const INK = "#16121a";
  const S = () => (window.LD && LD.static) || (window.App && App.S) || {};

  // seconds until the body lies still, and the moment it hits the floor (the boss kill shakes the stage then)
  const LEN = { curl: 1.5, slump: 1.6, kneel: 1.6, topple: 1.7, crumble: 1.9, dissolve: 1.5, melt: 2.0, shatter: 1.6, sink: 2.1, collapse: 2.4 };
  const LAND = { curl: 0.34, slump: 0.46, kneel: 1.2, topple: 1.0, crumble: 0.95, dissolve: 0.3, melt: 0.5, shatter: 0.42, sink: 0.6, collapse: 0.9 };
  // where each body turns when it goes over (fractions of its standing sprite, facing right)
  const PIVOT = { warchief: [0.2, 1], goblin: [0.22, 1], kobold: [0.24, 1], human: [0.18, 1], troll: [0.17, 1] };

  function monster(u) { const m = S().monsters && S().monsters[u.ref]; return m ? Art.withLook(Object.assign({ id: u.ref }, m, { boss: !!u.boss }), u.look) : null; }
  const groupOf = (u) => { const m = u && S().monsters && S().monsters[u.ref]; return (m && m.death) || null; };

  // ---------- sprites: the standing sprite and posed ones, as canvases facing dir ----------
  const cache = new Map();
  function toCv(g, dir, key) {
    let c = cache.get(key);
    if (!c) { const pad = g.pad || 0, stand = g.stand || [g.w, g.h]; c = (dir < 0 ? g.flipX() : g).toCanvas(1); c.pad = pad; c.stand = stand; cache.set(key, c); }
    return c;
  }
  const keyOf = (m) => m.body + "|" + m.pal + "|" + (m.boss ? 1 : 0) + (m.role ? "|" + m.role + m.gen : "");
  function stand(m, dir) { return toCv(Art.monsterGrid(m, 0), dir, "s|" + keyOf(m) + dir); }
  function posed(m, pose, dir) { const k = JSON.stringify(pose); return toCv(Art.monsterPose(m, pose), dir, "p|" + keyOf(m) + k + dir); }
  // a posed canvas lands with its standing place on the unit's feet, exactly where the standing sprite is drawn
  function put(c, cv, x, y, dx, dy) { c.drawImage(cv, R(x) + R(-cv.stand[0] / 2) - cv.pad + (dx || 0), R(y) - cv.stand[1] - cv.pad + (dy || 0)); }
  function putStand(c, cv, x, y, dx, dy) { c.drawImage(cv, R(x) + R(-cv.width / 2) + (dx || 0), R(y) - cv.height + (dy || 0)); }
  // how far a posed body sits above (positive) its standing sprite's floor line, so a rolled or tilted body can be set down on it
  function floorGap(cv) { return cv.pad + cv.stand[1] - 1 - bbox(cv).y1; }
  function pixels(cv) {
    if (cv._px) return cv._px;
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data, out = [];
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const i = (y * cv.width + x) * 4; if (d[i + 3] > 100) out.push({ x, y, r: d[i], g: d[i + 1], b: d[i + 2] }); }
    return (cv._px = out);
  }
  const hex = (p) => "#" + [p.r, p.g, p.b].map((v) => v.toString(16).padStart(2, "0")).join("");
  const lum = (p) => (0.3 * p.r + 0.59 * p.g + 0.11 * p.b) / 255;
  function mixC(a, b, t) {
    const pa = typeof a === "string" ? [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)) : [a.r, a.g, a.b], pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return "#" + pa.map((v, i) => R(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
  }
  function bbox(cv) {
    if (cv._bb) return cv._bb;
    const px = pixels(cv);
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (const p of px) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    return (cv._bb = { x0, x1, y0, y1 });
  }

  // ---------- the floor's own dust, motes, puffs ----------
  function dust(c, x, y, a, o) {
    o = o || {};
    const dur = o.dur || 0.7, k = a / dur;
    if (k < 0 || k > 1) return;
    const r = rng(o.seed || 9), n = o.n || 10, spread = o.spread || 16, col = o.col || "#b8a890";
    c.save();
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, sp = 0.5 + r() * 0.6, lift = 2 + r() * (o.lift || 5), sz0 = 1 + R(r() * (o.size || 2));
      const px = x + side * (o.w || 6) * r() + side * spread * sp * eOut(k), py = y - lift * eOut(k) * (0.6 + r() * 0.4) + r() * 2;
      const sz = Math.max(1, R(sz0 * (1 - k * 0.6)));
      c.globalAlpha = (1 - k) * 0.8;
      c.fillStyle = i % 3 ? col : mixC(col, "#ffffff", 0.35);
      c.fillRect(R(px - sz / 2), R(py - sz / 2), sz, sz);
    }
    c.restore();
  }
  function motes(c, x, y, a, o) {
    const r = rng(o.seed || 3), n = o.n || 8, cols = o.cols || ["#ffffff"];
    c.save();
    for (let i = 0; i < n; i++) {
      const t0 = (o.t0 || 0) + r() * (o.stagger || 0.6), life = (o.life || 0.9) * (0.7 + r() * 0.6), k = (a - t0) / life;
      const ox = (r() - 0.5) * (o.w || 20), drift = (r() - 0.5) * 6, rise = (o.rise || 18) * (0.6 + r() * 0.6);
      if (k < 0 || k > 1) continue;
      c.globalAlpha = k < 0.15 ? k / 0.15 : 1 - seg(k, 0.55, 1);
      c.fillStyle = cols[i % cols.length];
      c.fillRect(R(x + ox + drift * k + Math.sin(k * 6 + i) * 1.2), R(y - rise * eOut(k)), k < 0.5 && i % 3 === 0 ? 2 : 1, k < 0.5 && i % 3 === 0 ? 2 : 1);
    }
    c.restore();
  }
  function puff(c, x, y, k, col, size) {
    if (k <= 0 || k >= 1) return;
    c.save(); c.globalAlpha = 0.6 * (1 - k); c.fillStyle = col;
    const s = Math.max(1, R((size || 3) * (0.6 + k))), py = y - k * 8, px = x + Math.sin(k * 5) * 2;
    c.fillRect(R(px) - s, R(py) - s + 1, s * 2, s * 2 - 2); c.fillRect(R(px) - s + 1, R(py) - s, s * 2 - 2, s * 2);
    c.restore();
  }
  function glint(c, x, y, k, col) {
    if (k <= 0 || k >= 1) return;
    const s = R(Math.sin(k * Math.PI) * 3);
    c.save(); c.fillStyle = col || "#fff6c8";
    c.fillRect(R(x), R(y) - s, 1, 2 * s + 1); c.fillRect(R(x) - s, R(y), 2 * s + 1, 1);
    c.fillStyle = "#ffffff"; c.fillRect(R(x), R(y), 1, 1);
    c.restore();
  }
  function shadow(c, x, y, w, a) { c.save(); c.globalAlpha = 0.3 * (a == null ? 1 : a); c.fillStyle = "#1e140c"; c.beginPath(); c.ellipse(R(x), y, Math.max(5, w / 2), 2, 0, 0, Math.PI * 2); c.fill(); c.restore(); }

  // ---------- 1. curl: the legs give, a belly-flop, then the legs fold up over the back one pair at a time ----------
  function curl(c, m, a, x, y, dir, o) {
    if (m.body === "crab") {
      // a crab goes over onto its back and its legs curl in the air
      const roll = eIn(seg(a, 0.08, 0.42)), bnc = Math.sin(seg(a, 0.42, 0.56) * Math.PI) * 0.12;
      const pose = { curl: qz(back(seg(a, 0.45, 0.95)), 0.05), claws: qz(eOut(seg(a, 0.3, 0.6)), 0.1), eyes: qz(seg(a, 0.5, 0.9), 0.25), pivot: [0.5, 0.56] };
      const tl = qz(Math.PI * roll - bnc, 0.1);
      if (tl) pose.tilt = tl;
      shadow(c, x, y, stand(m, dir).width * 0.8);
      const cv = posed(m, pose, dir);
      put(c, cv, x, y, 0, floorGap(cv) - R(Math.sin(roll * Math.PI) * 4));
      dust(c, x, y, a - 0.42, { col: o.dust, n: 8, spread: 12, w: 8, seed: 4 });
      return;
    }
    const cu = [0, 0, 0, 0];
    let lift = 0, drop = 0, splay = 0, squash = 0;
    if (a < 0.12) { const k = a / 0.12; lift = 2 * eOut(k); splay = 0.5 * k; }
    else if (a < 0.34) { const k = eIn((a - 0.12) / 0.22); lift = 2 * (1 - k); drop = 3.1 * k; splay = 0.5 + 0.7 * k; }
    else { drop = 3.1; squash = Math.sin(seg(a, 0.34, 0.46) * Math.PI); splay = 1.2 * (1 - seg(a, 0.42, 0.9)); }
    for (let i = 0; i < 4; i++) cu[i] = back(seg(a, 0.44 + [2, 0, 3, 1][i] * 0.07, 0.86 + [2, 0, 3, 1][i] * 0.07));
    // one last twitch, then nothing
    const tw = seg(a, 1.12, 1.34);
    if (tw > 0 && tw < 1) cu[1] = 1 - 0.45 * Math.sin(tw * Math.PI);
    const pose = { lift: qz(lift, 0.25), drop: qz(drop, 0.25), splay: qz(splay, 0.1), squash: qz(squash, 0.25), head: qz(1.4 * sm(seg(a, 0.3, 0.6)), 0.2), eyes: qz(seg(a, 0.5, 1.0), 0.25), curl: cu.map((v) => qz(v, 0.05)) };
    shadow(c, x, y, stand(m, dir).width * (0.7 + 0.15 * seg(a, 0.2, 0.4)));
    const cv = posed(m, pose, dir);
    put(c, cv, x, y);
    dust(c, x, y, a - 0.34, { col: o.dust, n: 12, spread: 18, w: 14, seed: 4 });
  }

  // ---------- 2. slump: rear, the forelegs fold, the haunches follow, the head goes down, eyes shut, a last breath ----------
  function slump(c, m, a, x, y, dir, o) {
    const sw = stand(m, dir).width;
    if (m.body === "bat") {
      const pose = { down: qz(eIn(seg(a, 0.05, 0.4)), 0.05), eyes: a > 0.6 ? 1 : 0 };
      const fallY = -R((1 - eIn(seg(a, 0.05, 0.4))) * 0);
      shadow(c, x, y, sw * (0.5 + 0.4 * seg(a, 0.1, 0.4)));
      put(c, posed(m, pose, dir), x, y, 0, fallY);
      dust(c, x, y, a - 0.4, { col: o.dust, n: 8, spread: 14, w: 8, seed: 3 });
      return;
    }
    const rear = Math.sin(seg(a, 0, 0.22) * Math.PI);
    const bnc = Math.sin(seg(a, 0.46, 0.58) * Math.PI) * 0.12;
    const pose = { ff: qz(eIn(seg(a, 0.18, 0.46)) - bnc, 0.05), fb: qz(eIn(seg(a, 0.42, 0.7)), 0.05), head: qz(sm(seg(a, 0.75, 1.1)), 0.1), eyes: a > 1.0 ? 1 : 0 };
    shadow(c, x, y, sw * 0.85);
    put(c, posed(m, pose, dir), x, y, -dir * R(rear), -R(rear * 2));
    dust(c, x + dir * sw * 0.3, y, a - 0.46, { col: o.dust, n: 8, spread: 12, seed: 2 });
    dust(c, x - dir * sw * 0.25, y, a - 0.7, { col: o.dust, n: 6, spread: 10, seed: 5 });
    // the last breath: one soft puff from the muzzle
    if (o.boss) puff(c, x + dir * (sw / 2 - 2), y - 7, seg(a, 1.15, 1.75), "#e8e4dc", 2);
  }

  // ---------- 3. kneel: a stagger, down onto the knees, then back over; Gruk's banner, cleaver and crown fall on their own ----------
  function kneel(c, m, a, x, y, dir, o) {
    const kind = m.body === "goblin_big" ? "warchief" : m.body;
    const pv = PIVOT[kind] || [0.22, 1];
    const stag = Math.sin(seg(a, 0, 0.18) * Math.PI), kn = back(seg(a, 0.14, 0.4)), fall = eIn(seg(a, 0.85, 1.2));
    const bnc = Math.sin(seg(a, 1.2, 1.36) * Math.PI) * 0.08;
    const tilt = -(Math.PI / 2 - 0.06) * fall + bnc;
    const dx = -dir * R(stag * 3);
    const war = kind === "warchief";
    const pose = { kneel: qz(kn * (1 - fall), 0.05), eyes: a > 0.5 ? 1 : 0, tilt: qz(tilt, 0.04), pivot: pv };
    if (m.body === "kobold") pose.fall = qz(fall, 0.1);
    // Gruk's head rolls back toward us as he goes over, so the fallen warlord still shows his face
    if (war && fall > 0) pose.head = qz(1.2 * fall, 0.1);
    const armed = m.body === "goblin" || m.body === "kobold" || m.body === "human";
    if (war) pose.without = ["banner", "cleaver", "crown"];
    if (armed) pose.without = ["weapon"];
    if (!pose.tilt) delete pose.tilt;
    const sv = stand(m, dir), sw = sv.width, sh = sv.height;
    shadow(c, x - dir * fall * sh * 0.35, y, sw * (0.6 + fall * 0.6));
    if (war) {
      // the war banner tips over backwards and lands flat behind him
      const bt = eIn(seg(a, 0.5, 1.0)), bl = Math.sin(seg(a, 1.0, 1.14) * Math.PI) * 0.06;
      const bp = { part: "banner", pivot: [0.2, 1] };
      const btl = qz(-(Math.PI / 2 - 0.05) * bt + bl, 0.04);
      if (btl) bp.tilt = btl;
      put(c, posed(m, bp, dir), x, y, dx * (1 - bt));
      // the cleaver drops from the hand and falls flat in front
      const ct = eIn(seg(a, 0.3, 0.52)), cl = Math.sin(seg(a, 0.52, 0.62) * Math.PI) * 0.1;
      const cp = { part: "cleaver", pivot: [0.92, 0.94] }, ctl = qz((Math.PI / 2) * ct - cl, 0.04);
      if (ctl) cp.tilt = ctl;
      put(c, posed(m, cp, dir), x, y, dx * (1 - ct) + dir * R(3 * ct), R(2 * ct));
    }
    if (armed) {
      // the weapon slips from the hand as the knees go and falls flat in front, turning about its own foot
      const wp = posed(m, { part: "weapon" }, 1), bb = bbox(wp), W0 = wp.stand[0], H0 = wp.stand[1];
      const pv = [(R((bb.x0 + bb.x1) / 2) - wp.pad) / W0, (bb.y1 + 1 - wp.pad) / H0];
      const wt = eIn(seg(a, 0.25, 0.5)), wl = Math.sin(seg(a, 0.5, 0.6) * Math.PI) * 0.1, tl = qz((Math.PI / 2) * wt - wl, 0.04);
      const wq = { part: "weapon", pivot: pv };
      if (tl) wq.tilt = tl;
      const wc = posed(m, wq, dir);
      put(c, wc, x, y, dx * (1 - wt) + dir * R(2 * wt), wt > 0 ? R(floorGap(wc) * wt) : 0);
    }
    const body = posed(m, pose, dir);
    put(c, body, x, y, dx, fall > 0 ? R(floorGap(body) * fall) : 0);
    if (war) {
      // the crown comes off as he kneels, bounces once and rolls to a stop beyond his head
      const ck = seg(a, 0.42, 1.3), kd = R(6 * kn);
      const k1 = seg(ck, 0, 0.55), k2 = seg(ck, 0.55, 1);
      const sx = 0, sy = kd, ex = -dir * sh * 0.95, ey = sh * 0.82;
      const px = ck <= 0 ? 0 : k2 > 0 ? ex + dir * 6 - dir * 6 * eOut(k2) : lerp(sx, ex + dir * 6, k1);
      const py = ck <= 0 ? kd : k2 > 0 ? ey - Math.sin(k2 * Math.PI) * 3 : lerp(sy, ey, eIn(k1)) - Math.sin(k1 * Math.PI) * 10;
      const cp = { part: "crown", pivot: [0.5, 0.16] }, ctl = qz(ck <= 0 ? 0 : -(k2 > 0 ? 3.3 + 1.4 * eOut(k2) : k1 * 3.3), 0.08);
      if (ctl) cp.tilt = ctl;
      put(c, posed(m, cp, dir), x, y, dx + R(px), R(py));
    }
    dust(c, x - dir * sh * 0.4, y, a - 1.2, { col: o.dust, n: 14, spread: 20, w: 16, seed: 7 });
    dust(c, x, y, a - 0.36, { col: o.dust, n: 5, spread: 8, seed: 8, dur: 0.5 });
    if (war) dust(c, x + dir * sh * 0.4, y, a - 1.0, { col: o.dust, n: 8, spread: 12, w: 10, seed: 9 });
  }

  // ---------- 4. topple: a sway, then over backwards like a felled tree; snow or dust bursts, an ice crown skids off ----------
  function topple(c, m, a, x, y, dir, o) {
    const sv = stand(m, dir), sw = sv.width, sh = sv.height, ice = m.pal === "frost_giant";
    const sway = Math.sin(seg(a, 0, 0.3) * Math.PI * 2) * 0.06, tip = eIn(seg(a, 0.28, 1.0)), land = Math.sin(seg(a, 1.0, 1.22) * Math.PI) * 0.06;
    const tilt = -(Math.PI / 2) * tip + land + sway * (1 - tip);
    const pose = { arm: qz(sm(seg(a, 0.35, 1.0)), 0.1), eyes: a > 0.4 ? 1 : 0, pivot: PIVOT.troll, crown: false };
    const tl = qz(tilt, 0.035);
    if (tl) pose.tilt = tl;
    shadow(c, x - dir * tip * sh * 0.45, y, sw * (0.8 + tip * 0.7));
    const bodyCv = posed(m, pose, dir);
    put(c, bodyCv, x, y, 0, tip > 0 ? R(floorGap(bodyCv) * tip) : 0);
    if (ice) {
      if (a < 1.0) { const cp = { part: "crown", pivot: PIVOT.troll }; if (tl) cp.tilt = tl; put(c, posed(m, cp, dir), x, y); }
      else {
        const k = eOut(seg(a, 1.0, 1.5)), cp = { part: "crown", pivot: PIVOT.troll, tilt: qz(-(Math.PI / 2) - k * 0.6, 0.06) };
        put(c, posed(m, cp, dir), x, y, -dir * R(12 * k), -R(Math.sin(k * Math.PI) * 3));
      }
    }
    const px = x - dir * (sw / 2 - sw * PIVOT.troll[0]);
    if (a >= 1.0) {
      const k = seg(a, 1.0, 1.9), r = rng(11);
      c.save();
      for (let i = 0; i < 26; i++) {
        const along = r(), ang = -Math.PI / 2 + (r() - 0.5) * 2.2, sp = 10 + r() * 22, gx = px - dir * (4 + along * sh * 0.9);
        const t = k * (0.7 + r() * 0.5), qx = gx + Math.cos(ang) * sp * t, qy = y + Math.sin(ang) * sp * t + 30 * t * t;
        if (qy > y + 1 || t > 1) continue;
        c.globalAlpha = 1 - k;
        c.fillStyle = ice ? (i % 4 === 0 ? "#9ad8f0" : i % 3 ? "#f4faff" : "#cfe6f4") : i % 3 ? o.dust : mixC(o.dust, "#ffffff", 0.3);
        const s = i % 5 === 0 ? 2 : 1;
        c.fillRect(R(qx), R(qy), s, ice && i % 4 === 0 ? 2 : s);
      }
      c.restore();
    }
    dust(c, px - dir * sh * 0.5, y, a - 1.0, { col: o.dust, n: 18, spread: 26, w: 24, seed: 12, dur: 0.9, lift: 6, size: 3 });
  }

  // ---------- 5. crumble: a flare, cracks, then every pixel of the body drops into a heap and greys to ash ----------
  const heaps = new WeakMap();
  function heapOf(cv, seedN) {
    let H = heaps.get(cv);
    if (H) return H;
    const r = rng(seedN || 5), cols = {}, list = [], w = cv.width, h = cv.height;
    const px = pixels(cv).slice().sort((p, q) => q.y - p.y || p.x - q.x);
    for (const p of px) {
      const t0 = (1 - p.y / h) * 0.32 + r() * 0.12, fly = r() < 0.1;
      let tx = clamp(R(p.x + (r() - 0.5) * 6 * (1 - p.y / h)), 2, w - 3);
      for (let s = 0; s < 3; s++) { const hc = cols[tx] || 0; if ((cols[tx - 1] || 0) < hc - 1) tx--; else if ((cols[tx + 1] || 0) < hc - 1) tx++; }
      const ty = h - 1 - (cols[tx] || 0);
      if (!fly) cols[tx] = (cols[tx] || 0) + (r() < 0.55 ? 1 : 0);
      list.push({ p, t0, tx, ty, fly, c: hex(p), ash: mixC(p, r() < 0.5 ? "#8a8478" : "#6a6458", 0.75) });
    }
    let top = h, peak = w / 2;
    for (const k in cols) if (h - 1 - cols[k] < top) { top = h - 1 - cols[k]; peak = +k; }
    H = { list, top, peak };
    heaps.set(cv, H);
    return H;
  }
  function crumble(c, m, a, x, y, dir, o) {
    const lich = m.body === "human" && m.boss;
    const sv = stand(m, dir), w = sv.width, h = sv.height;
    // the lich's grave-light, or plain ash for the common dead
    const glow = lich ? (Art.MPAL[m.pal] || [])[2] || "#7af08a" : "#d8d0c0";
    // what lands on top of the heap: the crowned skull (painted on its own), a skeleton's skull (its own pixels)
    let top = null, bodyCv = sv;
    if (lich) { top = crop(posed(m, { part: "skull" }, dir), null, null, w, h); bodyCv = crop(posed(m, { part: "body" }, dir), null, null, w, h); }
    else if (m.body === "skeleton") { const bb = bbox(sv), cut = bb.y0 + (bb.y1 - bb.y0) * 0.36; [top, bodyCv] = split(sv, (p) => p.y < cut && lum(p) > 0.62); }
    const x0 = R(x) + R(-w / 2), y0 = R(y) - h;
    const flare = Math.sin(seg(a, 0, 0.3) * Math.PI), lift = R(flare * 2), shiver = a > 0.2 && a < 0.55 ? (Math.floor(a * 40) % 2 ? 1 : -1) : 0;
    shadow(c, x, y, w * (a < 0.55 ? 0.7 : 0.8));
    if (a < 0.55) {
      putStand(c, sv, x, y, shiver, -lift);
      if (flare > 0) { c.save(); c.globalAlpha = (lich ? 0.5 : 0.3) * flare; putStand(c, silhouette(sv, lich ? glow : "#f0ece0"), x, y, shiver, -lift); c.restore(); }
      const ck = seg(a, 0.22, 0.5);
      if (ck > 0) {
        const r = rng(21), bb = bbox(sv);
        c.save(); c.fillStyle = INK;
        for (let k = 0; k < 4; k++) {
          let px = bb.x0 + (bb.x1 - bb.x0) * (0.3 + r() * 0.4), py = bb.y0 + (bb.y1 - bb.y0) * (0.3 + r() * 0.45);
          const n = R(ck * 9);
          for (let j = 0; j < n; j++) { px += r() < 0.5 ? 1 : -1; py += r() < 0.6 ? 1 : 0; c.fillRect(x0 + R(px) + shiver, y0 + R(py) - lift, 1, 1); }
        }
        c.restore();
      }
      return;
    }
    const H = heapOf(bodyCv, 5), b = a - 0.55;
    c.save();
    for (const d of H.list) {
      const k = seg(b, d.t0, d.t0 + 0.32);
      if (d.fly) {
        if (k <= 0) { c.fillStyle = d.c; c.fillRect(x0 + d.p.x, y0 + d.p.y, 1, 1); continue; }
        const mk = seg(b, d.t0, d.t0 + 0.9);
        if (mk >= 1) continue;
        c.globalAlpha = 1 - mk; c.fillStyle = mk < 0.2 ? d.c : glow;
        c.fillRect(R(x0 + d.p.x + Math.sin(mk * 7 + d.p.y) * 2), R(y0 + d.p.y - mk * 22), 1, 1); c.globalAlpha = 1;
        continue;
      }
      c.fillStyle = k >= 1 ? d.ash : d.c;
      c.fillRect(R(x0 + lerp(d.p.x, d.tx, k)), R(y0 + lerp(d.p.y, d.ty, eIn(k))), 1, 1);
    }
    c.restore();
    if (top) {
      // the skull drops last and sits on the heap
      const sk = eIn(seg(a, 0.8, 1.15)), bump = Math.sin(seg(a, 1.15, 1.3) * Math.PI) * 2, tb = bbox(top);
      putStand(c, top, x, y, R((H.peak - (tb.x0 + tb.x1) / 2) * sk), R((H.top + 2 - tb.y1) * sk - bump));
    }
    dust(c, x, y, a - 0.85, { col: "#b8b0a0", n: 10, spread: 12, seed: 6, dur: 0.9, lift: 8 });
    motes(c, x, y - h * 0.3, a, { t0: 1.1, stagger: 0.8, n: 6, cols: [glow, mixC(glow, "#ffffff", 0.5)], rise: 14, w: 14, seed: 4 });
  }

  // ---------- 6. dissolve: spirits come apart into motes of their own colours, top first ----------
  function dissolve(c, m, a, x, y, dir, o) {
    const sv = stand(m, dir), w = sv.width, h = sv.height, x0 = R(x) + R(-w / 2), y0 = R(y) - h, r = rng(31);
    const flare = Math.sin(seg(a, 0, 0.2) * Math.PI);
    c.save();
    for (const p of pixels(sv)) {
      const t0 = 0.12 + (p.y / h) * 0.55 + r() * 0.35, k = seg(a, t0, t0 + 0.75), sp = r(), dx = (r() - 0.5) * 10;
      if (k >= 1) continue;
      c.globalAlpha = 1 - k;
      c.fillStyle = k > 0.25 ? mixC(p, "#ffffff", 0.45) : hex(p);
      c.fillRect(R(x0 + p.x + dx * eOut(k) + Math.sin(k * 6 + sp * 9) * 1.5 * k), R(y0 + p.y - (8 + sp * 16) * eOut(k)), 1, 1);
    }
    c.restore();
    if (flare > 0) { c.save(); c.globalAlpha = 0.45 * flare; putStand(c, silhouette(sv, "#ffffff"), x, y); c.restore(); }
  }

  // ---------- 7. melt: down into a puddle, the middle last; the crone's hat rides down and settles on top, her cauldron stays ----------
  function melt(c, m, a, x, y, dir, o) {
    const crone = m.body === "hag";
    const sv = stand(m, dir), w = sv.width, h = sv.height;
    const her = crone ? crop(posed(m, { part: "body" }, dir), null, null, w, h) : sv;
    const pal = (Art.MPAL && Art.MPAL[m.pal]) || ["#5a6a4a", "#2a1e2a", "#f0d040"];
    const shake = a < 0.3 ? (Math.floor(a * 36) % 2 ? 1 : -1) : 0, mk = sm(seg(a, 0.25, 1.3));
    const cx = x + (crone ? dir * w * 0.16 : 0), pw = R(lerp(6, crone ? 24 : w * 1.1, eOut(seg(a, 0.3, 1.4))));
    const puddle = crone ? ["#2a1e2a", "#4a6a3a", "#6a8a4a"] : [mixC(pal[0], INK, 0.4), pal[0], pal[1]];
    shadow(c, x, y, w * 0.8, 1 - mk * 0.5);
    if (a > 0.3) {
      c.save();
      c.fillStyle = puddle[0]; c.beginPath(); c.ellipse(R(cx), y - 1, pw / 2, 2.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = puddle[1]; c.fillRect(R(cx - pw / 2 + 3), y - 3, R(pw * 0.45), 1);
      c.fillStyle = puddle[2]; c.fillRect(R(cx - pw / 2 + 4), y - 3, 2, 1);
      c.restore();
    }
    // each column slides down into the floor, the middle last, and leaves a drip behind for a moment
    const x0 = R(x) + R(-w / 2), y0 = R(y) - h, bb = bbox(her);
    c.save();
    c.beginPath(); c.rect(x0 - 4, y0 - 20, w + 8, h + 20 - 1); c.clip();
    for (let i = bb.x0; i <= bb.x1; i++) {
      const u = Math.abs((i - bb.x0) / Math.max(1, bb.x1 - bb.x0) - 0.5) * 2, k = clamp(mk * (1.15 + u * 0.4) - 0.05 * Math.sin(i * 1.7), 0, 1);
      const dy = R(k * (h - bb.y0 + 2));
      c.drawImage(her, i, 0, 1, h, x0 + i + shake, y0 + dy, 1, h);
    }
    c.restore();
    if (crone) {
      const hat = posed(m, { part: "hat" }, dir), pot = posed(m, { part: "pot" }, dir), hb = bbox(hat), hr = bbox(posed(m, { part: "hat" }, 1));
      const hk = sm(seg(a, 0.3, 1.45)), hbn = Math.sin(seg(a, 1.45, 1.6) * Math.PI) * 1.5;
      const hx = R(lerp(0, cx - x, hk)) + shake * (1 - hk), hy = R(lerp(0, h - 3 - (hb.y1 - hat.pad), hk) - hbn);
      const hp = { part: "hat", pivot: [((hr.x0 + hr.x1) / 2 - hat.pad) / w, (hr.y1 - hat.pad) / h] }, ht = qz(0.3 * seg(a, 1.2, 1.6), 0.05);
      if (ht) hp.tilt = ht;
      put(c, ht ? posed(m, hp, dir) : hat, x, y, hx, hy);
      put(c, pot, x, y);
      const bub = seg(a, 1.5, 1.8);
      if (bub > 0 && bub < 1) { c.save(); c.globalAlpha = 1 - bub; c.fillStyle = "#9ad84a"; const bx = x + dir * w * 0.25, by = y - h * 0.38 - bub * 6; c.fillRect(R(bx) - 1, R(by) - 1, 3, 3); c.fillStyle = "#e8ffb0"; c.fillRect(R(bx) - 1, R(by) - 1, 1, 1); c.restore(); }
      motes(c, cx, y - 2, a, { t0: 1.2, stagger: 0.7, n: 4, cols: ["#f0f0a0", "#c8f0ff"], rise: 22, w: 12, seed: 8, life: 1.2 });
    } else {
      const bub = seg(a, 1.3, 1.6);
      if (bub > 0 && bub < 1) { c.save(); c.fillStyle = pal[1]; const s = bub < 0.8 ? 2 : 1; c.fillRect(R(cx + 2), R(y - 3 - bub * 3), s, s); c.restore(); }
    }
  }

  // ---------- 8. shatter: the mimic bursts into planks and spills its hoard; a golem cracks apart into rubble ----------
  const chunks = new WeakMap();
  function pieces(sv, chest, seedN) {
    let PS = chunks.get(sv);
    if (PS) return PS;
    PS = [];
    const r = rng(seedN), w = sv.width, h = sv.height, bb = bbox(sv);
    if (chest) {
      const lidH = R(bb.y0 + (bb.y1 - bb.y0) * 0.42), cut = [bb.x0, R(bb.x0 + (bb.x1 - bb.x0) * 0.27), R(bb.x0 + (bb.x1 - bb.x0) * 0.52), R(bb.x0 + (bb.x1 - bb.x0) * 0.76), bb.x1 + 1];
      PS.push({ sx: 0, sy: 0, sw: w, sh: lidH, vx: 0.2, vy: -34, turns: 2, rest: 2 });
      for (let i = 0; i < 4; i++) PS.push({ sx: cut[i], sy: lidH, sw: cut[i + 1] - cut[i], sh: h - lidH, vx: (i - 1.5) * 11 + (r() - 0.5) * 6, vy: -12 - r() * 10, turns: (i % 2 ? 1 : 3), rest: i === 2 ? 0 : i % 2 ? 1 : 3 });
    } else {
      const B = 5;
      for (let by = bb.y0; by <= bb.y1; by += B) for (let bx = bb.x0; bx <= bb.x1; bx += B) {
        const any = pixels(sv).some((p) => p.x >= bx && p.x < bx + B && p.y >= by && p.y < by + B);
        if (!any) continue;
        const hgt = 1 - (by - bb.y0) / (bb.y1 - bb.y0 + 1);
        PS.push({ sx: bx, sy: by, sw: B, sh: B, vx: (bx - (bb.x0 + bb.x1) / 2) * (0.6 + r() * 0.8) + (r() - 0.5) * 8, vy: -6 - r() * 14 * hgt, turns: R(r() * 3), rest: R(r() * 3), t0: hgt * 0.12 + r() * 0.06 });
      }
    }
    for (const p of PS) {
      const cv = document.createElement("canvas"); cv.width = p.sw; cv.height = p.sh;
      cv.getContext("2d").drawImage(sv, p.sx, p.sy, p.sw, p.sh, 0, 0, p.sw, p.sh);
      // a quarter turn of a pixel block loses nothing; pieces tumble through right angles only
      p.rot = [0, 1, 2, 3].map((k) => quarter(cv, k));
    }
    if (!chest) {
      // rubble stacks: the low blocks land first and the rest settle on top of them
      const hm = {};
      for (const p of PS.slice().sort((A, B) => B.sy - A.sy)) {
        const img = p.rot[p.rest], cx = R(p.sx + p.sw / 2 + p.vx * 0.55), x0 = cx - (img.width >> 1);
        let base = 0;
        for (let i = 1; i < img.width - 1; i++) base = Math.max(base, hm[x0 + i] || 0);
        p.lift = Math.max(0, base - 1);
        for (let i = 0; i < img.width; i++) hm[x0 + i] = Math.max(hm[x0 + i] || 0, p.lift + img.height - 1);
      }
    }
    chunks.set(sv, PS);
    return PS;
  }
  function quarter(cv, k) {
    if (!k) return cv;
    const o = document.createElement("canvas"), sw = k % 2 ? cv.height : cv.width, sh = k % 2 ? cv.width : cv.height;
    o.width = sw; o.height = sh;
    const g = o.getContext("2d"), src = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height), out = g.createImageData(sw, sh);
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const [X, Y] = k === 1 ? [cv.height - 1 - y, x] : k === 2 ? [cv.width - 1 - x, cv.height - 1 - y] : [y, cv.width - 1 - x];
      for (let ch = 0; ch < 4; ch++) out.data[(Y * sw + X) * 4 + ch] = src.data[(y * cv.width + x) * 4 + ch];
    }
    g.putImageData(out, 0, 0);
    return o;
  }
  function shatter(c, m, a, x, y, dir, o) {
    const chest = m.body === "chest", sv = stand(m, dir), w = sv.width, h = sv.height, x0 = R(x) + R(-w / 2), y0 = R(y) - h;
    const pal = (Art.MPAL && Art.MPAL[m.pal]) || ["#9aa2aa", "#ffffff", "#ffd84a"];
    const at = chest ? 0.42 : 0.36;
    if (a < at) {
      const hop = chest ? (a < 0.36 ? Math.abs(Math.sin(a * Math.PI / 0.12)) * 2 * (a < 0.12 ? 1 : 0.6) : 0) : 0, rat = Math.floor(a * 40) % 2 ? 1 : -1, sw2 = seg(a, at - 0.12, at);
      shadow(c, x, y, w * 0.9);
      putStand(c, sv, x, y, rat, -R(hop));
      // light at the seams: gold from the mimic, the golem's own glow
      if (sw2 > 0) { c.save(); c.globalAlpha = 0.4 * sw2; putStand(c, silhouette(sv, chest ? "#ffd84a" : pal[1]), x, y, rat, -R(hop)); c.restore(); }
      return;
    }
    shadow(c, x, y, w * 1.2, 0.6);
    const PS = pieces(sv, chest, chest ? 17 : 23), k = a - at, g = 70, settle = chest ? 0.65 : 0.55;
    for (const p of PS) {
      const t = clamp(k - (p.t0 || 0), 0, 9), T = Math.min(t, settle);
      const cxp = x0 + p.sx + p.sw / 2 + p.vx * T * (chest ? 1.6 : 1), turn = T >= settle ? p.rest : (p.rest + R(T / settle * p.turns * 4)) % 4;
      const img = p.rot[turn], floor = y - img.height / 2 - (t >= settle || turn === p.rest ? p.lift || 0 : 0);
      let cyp = y0 + p.sy + p.sh / 2 + p.vy * T + g * T * T;
      if (cyp > floor || t >= settle) cyp = Math.min(cyp, floor);
      if (t >= settle) cyp = floor;
      c.drawImage(img, R(cxp - img.width / 2), R(cyp - img.height / 2));
    }
    if (chest) {
      // the hoard: coins and two gems arc out, bounce once and lie glinting
      const r = rng(29);
      c.save();
      for (let i = 0; i < 26; i++) {
        const vx = (r() - 0.5) * 64, vy = -30 - r() * 30, t0 = r() * 0.15, kt = clamp(k - t0, 0, 9), gem = i < 2, fl = (-vy / 70) * 2;
        if (kt <= 0) continue;
        let px = x + vx * Math.min(kt, fl), py = y - 6 + vy * kt + 70 * kt * kt;
        if (kt > fl) { const bb2 = kt - fl; py = y - 1 - Math.max(0, Math.sin(Math.min(1, bb2 / 0.25) * Math.PI) * 4); px += vx * 0.2 * Math.min(bb2, 0.25); }
        py = Math.min(py, y - 1);
        if (gem) { c.fillStyle = INK; c.fillRect(R(px) - 1, R(py) - 1, 4, 4); c.fillStyle = i ? "#5ab8a8" : "#d84a6a"; c.fillRect(R(px), R(py), 2, 2); c.fillStyle = "#e8fff8"; c.fillRect(R(px), R(py), 1, 1); }
        else { c.fillStyle = "#7a5a1a"; c.fillRect(R(px), R(py), 2, 2); c.fillStyle = "#ffd84a"; c.fillRect(R(px), R(py), 2, 1); c.fillStyle = "#fff6c8"; c.fillRect(R(px), R(py), 1, 1); }
        if (kt > fl + 0.3) glint(c, px, py - 1, ((a * 0.9 + i * 0.37) % 1.6) / 0.5);
      }
      c.restore();
      if (k < 0.25) { c.save(); c.globalAlpha = 1 - k / 0.25; c.fillStyle = "#fff0a0"; const s = R(4 + k * 40); c.fillRect(R(x) - s, R(y - h / 2), 2 * s, 1); c.fillRect(R(x), R(y - h / 2) - R(s / 2), 1, s); c.restore(); }
    } else {
      // ice glints, lava cools, bone just lies there
      const r = rng(37);
      for (let i = 0; i < 6; i++) { const gx = x + (r() - 0.5) * w * 1.2, gy = y - 1 - r() * 6; if (m.pal === "ice") glint(c, gx, gy, seg(a, 0.8 + i * 0.15, 1.3 + i * 0.15), "#e8fbff"); }
      if (m.pal === "lava") motes(c, x, y - 4, a, { t0: at, stagger: 0.8, n: 8, cols: ["#ff6a2a", "#ffd84a"], rise: 12, w: w, seed: 7, life: 0.7 });
    }
    dust(c, x, y, k - (chest ? 0.55 : 0.3), { col: o.dust, n: 14, spread: 22, w: 12, seed: 3 });
  }

  // ---------- 9. sink: thrash, go slack, slide down through the floor; rings and bubbles, then still dark water ----------
  function sink(c, m, a, x, y, dir, o) {
    const thrash = Math.sin(a * 40) * (1 - seg(a, 0, 0.35));
    const pose = { slack: qz(sm(seg(a, 0.25, 0.7)), 0.05), eyes: a > 0.55 ? 1 : 0 };
    const cv = posed(m, pose, dir), w = cv.stand[0], h = cv.stand[1];
    const sinkK = eIn(seg(a, 0.6, 1.7)), pool = eOut(seg(a, 0.5, 1.0)) * (1 - 0.15 * seg(a, 1.7, 2.1)), pw = w * 1.15 * pool;
    if (pool > 0) {
      c.save(); c.fillStyle = "#1a3038"; c.beginPath(); c.ellipse(R(x), y - 1, pw / 2, 4 * pool, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#2a4a50"; c.beginPath(); c.ellipse(R(x), y - 1, Math.max(1, pw / 2 - 2), Math.max(0.5, 3 * pool - 0.5), 0, Math.PI, Math.PI * 2); c.fill(); c.restore();
    } else shadow(c, x, y, w * 0.8);
    c.save(); c.beginPath(); c.rect(R(x) - w * 2, 0, w * 4, y); c.clip();
    put(c, cv, x, y, R(thrash), R(sinkK * (h + 3)));
    c.restore();
    c.save();
    for (let i = 0; i < 3; i++) {
      const k = seg(a, 0.75 + i * 0.35, 1.55 + i * 0.35);
      if (k <= 0 || k >= 1) continue;
      c.globalAlpha = 0.7 * (1 - k); c.strokeStyle = "#9ad0c8"; c.lineWidth = 1;
      c.beginPath(); c.ellipse(R(x), y - 1, R(pw / 2 * (0.4 + k * 0.8)), Math.max(1, R(3 * (0.4 + k * 0.8))), 0, 0, Math.PI * 2); c.stroke();
    }
    const r = rng(41);
    for (let i = 0; i < 7; i++) {
      const t0 = 0.9 + r() * 1.0, k = seg(a, t0, t0 + 0.35), bx = x + (r() - 0.5) * pw * 0.7;
      if (k <= 0 || k >= 1) continue;
      c.globalAlpha = 1; c.fillStyle = "#c8f0e8"; const by = y - 2 - k * 5;
      if (k < 0.8) { c.fillRect(R(bx), R(by), 2, 2); c.fillStyle = "#ffffff"; c.fillRect(R(bx), R(by), 1, 1); } else { c.fillRect(R(bx) - 1, R(by), 1, 1); c.fillRect(R(bx) + 2, R(by), 1, 1); }
    }
    c.restore();
  }

  // ---------- 10. collapse: rear and stagger, the forelegs go, then the haunches, the neck comes down last; smoke from the nostrils ----------
  function collapse(c, m, a, x, y, dir, o) {
    const rear = Math.sin(seg(a, 0, 0.4) * Math.PI), stag = Math.sin(seg(a, 0.35, 0.7) * Math.PI * 2);
    const bnc = Math.sin(seg(a, 0.9, 1.0) * Math.PI) * 0.1 + Math.sin(seg(a, 1.6, 1.72) * Math.PI) * 0.08;
    const pose = { ff: qz(eIn(seg(a, 0.6, 0.9)) - bnc, 0.05), fb: qz(eIn(seg(a, 0.9, 1.2)), 0.05), wings: qz(sm(seg(a, 0.6, 1.3)), 0.05), neck: qz(eIn(seg(a, 1.25, 1.6)) - Math.sin(seg(a, 1.6, 1.72) * Math.PI) * 0.06, 0.04), tail: qz(sm(seg(a, 1.0, 1.5)), 0.1), eyes: a > 1.6 ? 1 : 0, pivot: [0.24, 1] };
    const rt = qz(-0.14 * rear, 0.02);
    if (rt) pose.tilt = rt;
    const cv = posed(m, pose, dir), w = cv.stand[0], h = cv.stand[1];
    shadow(c, x, y, w * 0.9);
    put(c, cv, x, y, -dir * R(stag * 2));
    dust(c, x + dir * w * 0.3, y, a - 0.9, { col: o.dust, n: 12, spread: 16, seed: 2, lift: 6, size: 3 });
    dust(c, x - dir * w * 0.25, y, a - 1.2, { col: o.dust, n: 10, spread: 14, seed: 5, lift: 5, size: 3 });
    dust(c, x + dir * w * 0.45, y, a - 1.6, { col: o.dust, n: 8, spread: 12, seed: 9 });
    const nx = x + dir * (w / 2 + 1), ny = y - 5;
    for (let i = 0; i < 3; i++) puff(c, nx + dir * i, ny - i, seg(a, 1.7 + i * 0.22, 2.4 + i * 0.22), i % 2 ? "#8a8078" : "#a89c90", 2);
    if (m.boss) motes(c, x, y - h * 0.4, a, { t0: 1.0, stagger: 0.9, n: 8, cols: ["#ffb04a", "#ff7a2a", "#ffd84a"], rise: 16, w: w * 0.7, seed: 12, life: 0.8 });
  }

  function crop(cv, ox, oy, w, h) {
    const key = "_crop" + w + "x" + h;
    if (cv[key]) return cv[key];
    const o = document.createElement("canvas"); o.width = w; o.height = h;
    o.getContext("2d").drawImage(cv, ox == null ? cv.pad : ox, oy == null ? cv.pad : oy, w, h, 0, 0, w, h);
    return (cv[key] = o);
  }
  function split(cv, test) {
    if (cv._split) return cv._split;
    const mk = () => { const o = document.createElement("canvas"); o.width = cv.width; o.height = cv.height; return o; };
    const A = mk(), B = mk(), ga = A.getContext("2d"), gb = B.getContext("2d");
    for (const p of pixels(cv)) { const g = test(p) ? ga : gb; g.fillStyle = hex(p); g.fillRect(p.x, p.y, 1, 1); }
    return (cv._split = [A, B]);
  }
  const sil = new WeakMap();
  function silhouette(cv, col) {
    let mm = sil.get(cv);
    if (!mm) sil.set(cv, (mm = {}));
    if (!mm[col]) { const o = document.createElement("canvas"); o.width = cv.width; o.height = cv.height; const g = o.getContext("2d"); g.drawImage(cv, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = col; g.fillRect(0, 0, o.width, o.height); mm[col] = o; }
    return mm[col];
  }

  const FN = { curl, slump, kneel, topple, crumble, dissolve, melt, shatter, sink, collapse };
  // draw a dying or dead monster at age a (seconds since its death began), feet at (x, y), facing dir; false when it has no death of its own
  function draw(c, u, a, x, y, dir, o) {
    const g = groupOf(u), m = g && monster(u);
    if (!m || !FN[g]) return false;
    o = o || {};
    const opts = { dust: o.dust || "#b8a890", boss: !!u.boss };
    c.save();
    c.imageSmoothingEnabled = false;
    if (o.alpha != null) c.globalAlpha = o.alpha;
    FN[g](c, m, o.calm ? LEN[g] + 1 : Math.max(0, a), x, y, dir, opts);
    c.restore();
    return true;
  }
  // the still body a boss leaves: its last frame, for the replay's end card and the loot to settle on
  window.Deaths = { draw, group: groupOf, len: (u) => LEN[groupOf(u)] || 0, land: (u) => LAND[groupOf(u)] || 0.4, LEN, LAND };
})();
