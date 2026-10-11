/* The preseason tavern: an isometric pixel room where the signed-up heroes mill about, chat and order drinks
   before the league opens. Everything said comes from the sim (league.voice.tavern_chatter); this only stages it. */
(function () {
  "use strict";
  const W = 198, H = 158, NU = 13, NV = 10, OX = 87, OY = 60, WH = 54;
  const iso = (u, v) => [OX + (u - v) * 8, OY + (u + v) * 4];
  const BAR_V = 2.0, WALK = { u0: 0.9, u1: NU - 0.5, v0: 2.7, v1: NV - 0.4 };
  const TABLES = [[3.0, 5.6], [7.6, 4.4], [5.6, 8.0], [10.2, 7.2]];
  const FIRE = { v0: 4.8, v1: 7.0 };

  function fillPoly(ctx, pts, color) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs)), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (!inside) continue;
      const c = typeof color === "function" ? color(x, y) : color;
      if (c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
    }
  }
  const up = (p, h) => [p[0], p[1] - h];
  const lwall = (v, h) => up(iso(0, v), h);
  const rwall = (u, h) => up(iso(u, 0), h);
  const quad = (f, a0, a1, h0, h1) => [f(a0, h0), f(a1, h0), f(a1, h1), f(a0, h1)];

  function box(u, v, du, dv, h, top, left, right) {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const a = iso(u, v + dv), b = iso(u + du, v + dv), c = iso(u + du, v), d = iso(u, v);
    fillPoly(ctx, [a, b, up(b, h), up(a, h)], left);
    fillPoly(ctx, [b, c, up(c, h), up(b, h)], right);
    fillPoly(ctx, [up(a, h), up(b, h), up(c, h), up(d, h)], top);
    return cv;
  }

  function room(r) {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#1a120c"; ctx.fillRect(0, 0, W, H);
    const plank = (light) => (x, y) => {
      const k = Math.floor((x - OX) / 6), seam = (x - OX) % 6 === 0;
      const beam = (y + 400) % 18 === 0;
      return seam || beam ? (light ? "#4a2e1c" : "#3e2616") : (k % 2 ? (light ? "#7a4e2c" : "#5e3c22") : (light ? "#704628" : "#58381f"));
    };
    fillPoly(ctx, [lwall(0, WH), lwall(NV, WH), iso(0, NV), iso(0, 0)], plank(false));
    fillPoly(ctx, [rwall(0, WH), rwall(NU, WH), iso(NU, 0), iso(0, 0)], plank(true));
    fillPoly(ctx, [lwall(0, WH), lwall(NV, WH), lwall(NV, WH - 3), lwall(0, WH - 3)], "#2e1c10");
    fillPoly(ctx, [rwall(0, WH), rwall(NU, WH), rwall(NU, WH - 3), rwall(0, WH - 3)], "#3a2414");
    fillPoly(ctx, [iso(0, 0), iso(NU, 0), iso(NU, NV), iso(0, NV)], (x, y) => {
      const u = ((x + 0.5 - OX) / 8 + (y + 0.5 - OY) / 4) / 2, v = ((y + 0.5 - OY) / 4 - (x + 0.5 - OX) / 8) / 2;
      const row = Math.floor(v * 2), seam = Math.abs(v * 2 - Math.round(v * 2)) < 0.07, end = Math.abs(((u + row * 1.7) % 3) - 0) < 0.05;
      if (seam || end) return "#5a3820";
      return ["#8e5c34", "#83542f", "#895830"][((row % 3) + 3) % 3];
    });
    fillPoly(ctx, [iso(4.8, 4.8), iso(8.6, 4.8), iso(8.6, 7.4), iso(4.8, 7.4)], (x, y) => {
      const u = ((x + 0.5 - OX) / 8 + (y + 0.5 - OY) / 4) / 2, v = ((y + 0.5 - OY) / 4 - (x + 0.5 - OX) / 8) / 2;
      const edge = u < 5.05 || u > 8.35 || v < 5.05 || v > 7.15;
      return edge ? "#c8a040" : ((Math.floor(u * 2) + Math.floor(v * 2)) % 2 ? "#8a2a24" : "#7a2420");
    });
    // the night outside
    for (const [a0, a1] of [[8.4, 10.0], [10.8, 12.2]]) {
      fillPoly(ctx, quad(rwall, a0 - 0.15, a1 + 0.15, 17, 41), "#2a1a10");
      fillPoly(ctx, quad(rwall, a0, a1, 19, 39), (x, y) => (r() < 0.02 ? "#f0e8c0" : y % 2 ? "#1c2a4a" : "#203054"));
      fillPoly(ctx, [rwall((a0 + a1) / 2 - 0.05, 19), rwall((a0 + a1) / 2 + 0.05, 19), rwall((a0 + a1) / 2 + 0.05, 39), rwall((a0 + a1) / 2 - 0.05, 39)], "#2a1a10");
    }
    const m = rwall(8.8, 35); ctx.fillStyle = "#f0e8c0"; ctx.fillRect(m[0], m[1], 3, 3); ctx.fillStyle = "#203054"; ctx.fillRect(m[0] + 2, m[1], 1, 1);
    // shelves of bottles behind the bar
    for (const h of [24, 35]) {
      fillPoly(ctx, quad(rwall, 1.4, 7.2, h, h + 1.5), "#3a2214");
      for (let u = 1.6; u < 7.0; u += 0.42) {
        const p = rwall(u, h + 1.5), col = ["#5a8a3a", "#8a3a2a", "#c8a040", "#3a5a8a", "#d8d0c0"][Math.floor(r() * 5)];
        const tall = 4 + Math.floor(r() * 3);
        ctx.fillStyle = col; ctx.fillRect(p[0], p[1] - tall, 2, tall); ctx.fillRect(p[0], p[1] - tall - 1, 1, 1);
        ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(p[0], p[1] - tall + 1, 1, 2);
      }
    }
    // fireplace and the sign-up board on the left wall
    fillPoly(ctx, quad(lwall, FIRE.v0 - 0.4, FIRE.v1 + 0.4, 0, 30), (x, y) => ((x + (y >> 2) * 3) % 7 === 0 || y % 4 === 0 ? "#5a5866" : r() < 0.5 ? "#7e7c8a" : "#6e6c7a"));
    fillPoly(ctx, quad(lwall, FIRE.v0 - 0.4, FIRE.v1 + 0.4, 28, WH - 3), (x, y) => (y % 4 === 0 ? "#4a4854" : "#64626f"));
    fillPoly(ctx, quad(lwall, FIRE.v0, FIRE.v1, 0, 17), "#120c0a");
    fillPoly(ctx, quad(lwall, FIRE.v0 - 0.5, FIRE.v1 + 0.5, 30, 32), "#3a2214");
    fillPoly(ctx, quad(lwall, 1.3, 3.1, 22, 38), "#4a2c18");
    fillPoly(ctx, quad(lwall, 1.45, 2.95, 23.5, 36.5), "#c8a878");
    for (const [a, h0] of [[1.6, 34], [1.6, 31], [1.6, 28], [1.6, 25.5]]) fillPoly(ctx, quad(lwall, a, a + 0.9 + r() * 0.4, h0, h0 + 1), "#6e5a44");
    for (const [a, h0, c] of [[2.7, 34.5, "#a03028"], [2.2, 27, "#2a5aa0"]]) { const p = lwall(a, h0); ctx.fillStyle = c; ctx.fillRect(p[0], p[1], 2, 2); }
    // barrels in the far corner
    for (const [u, v] of [[11.7, 0.5], [12.4, 1.3]]) {
      const [x, y] = iso(u, v);
      for (let j = 0; j < 12; j++) for (let i = -5; i <= 5; i++) {
        if (Math.abs(i) === 5 && (j < 1 || j > 10)) continue;
        ctx.fillStyle = j === 2 || j === 9 ? "#5a5a62" : i < -2 ? "#9a6a38" : i > 2 ? "#5e3c20" : "#7e5230";
        ctx.fillRect(x + i, y - j - 1, 1, 1);
      }
      ctx.fillStyle = "#4a2c18"; ctx.fillRect(x - 4, y - 13, 9, 1);
    }
    return cv;
  }

  function scene(L, S, A) {
    const r = Art.rng(Art.hash(L.meta.name + "tavern"));
    const tav = L.tavern || { name: "The tavern", barkeep: "The barkeep", lines: ["Another one?"] };
    const wrap = document.createElement("div");
    wrap.className = "tavern";
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    wrap.appendChild(cv);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const bg = room(r);
    const still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const furniture = [];
    for (let u = 1.2; u < 7.2; u += 1) furniture.push({ key: u + BAR_V + 0.4, cv: box(u, 1.2, 1, BAR_V - 1.2, 14, "#a8703c", "#5a3418", "#4a2c18") });
    for (const [u, v] of TABLES) {
      furniture.push({ key: u + v + 1.0, cv: box(u, v, 1.0, 1.0, 9, "#9a6436", "#5e3a1e", "#4e2e18") });
      for (const [su, sv] of [[u + 0.35, v + 1.25], [u + 1.25, v + 0.35]]) furniture.push({ key: su + sv + 0.35, cv: box(su, sv, 0.35, 0.35, 5, "#7a4a28", "#4a2c18", "#3e2414") });
    }

    const look = (h) => A.heroLook(h);
    const actors = [];
    L.pending.filter((h) => !h.npc).concat(L.pending.filter((h) => h.npc)).slice(0, 14).forEach((h, i) => {
      const hs = Object.assign({}, h, { weapon_tier: 1, armor_tier: 1, alive: true });
      const g = Art.heroGrid(hs, 0, look(hs));
      const pet = h.pet ? { g0: Art.petGrid(h.pet, 0), g1: Art.petGrid(h.pet, 1) } : null;
      const spot = freeSpot();
      actors.push({ h, name: h.name, lines: (h.chatter || []).slice(), u: spot[0], v: spot[1], tu: spot[0], tv: spot[1], face: r() < 0.5 ? 1 : -1,
        right: g.toCanvas(1), left: g.flipX().toCanvas(1), mode: "idle", wait: 1 + r() * 5 + i * 0.4, mug: 0, said: [],
        pet: pet && { right: [pet.g0.toCanvas(1), pet.g1.toCanvas(1)], left: [pet.g0.flipX().toCanvas(1), pet.g1.flipX().toCanvas(1)], u: spot[0] - 0.6, v: spot[1] + 0.4, face: 1 } });
    });
    const keepLook = { skin: "#c98e62", hair: "#9a9aa6", style: 4, face: 2, fav: "#8a3a2a", scars: [] };
    const kg = Art.heroGrid({ id: "barkeep", name: tav.barkeep, look: keepLook, weapon: "none", weapon_tier: 1, armor_tier: 1 }, 0,
      { name: "barkeep", look: { outfit: "vest", head: "none", aura: null, offhand: "none" } });
    const keep = { name: tav.barkeep, u: 3.5, v: 0.6, tu: 3.5, tv: 0.6, face: 1, right: kg.toCanvas(1), left: kg.flipX().toCanvas(1), wait: 2, keeper: true, said: [] };

    function blocked(u, v) {
      return TABLES.some(([tu, tv]) => u > tu - 0.45 && u < tu + 1.45 && v > tv - 0.45 && v < tv + 1.45) || (u < 1.7 && v > FIRE.v0 - 0.3 && v < FIRE.v1 + 0.3 && u < 0.9);
    }
    // sprites are ~3 tiles wide on screen, so "free" means far enough apart in screen x as well as on the floor
    function crowded(u, v, ...skip) {
      return actors.some((b) => !skip.includes(b) && Math.abs((b.tu - b.tv) - (u - v)) * 8 < 18 && Math.abs((b.tu + b.tv) - (u + v)) * 4 < 22);
    }
    function freeSpot(...skip) {
      let best = null;
      for (let k = 0; k < 40; k++) {
        const u = WALK.u0 + r() * (WALK.u1 - WALK.u0), v = WALK.v0 + r() * (WALK.v1 - WALK.v0);
        if (blocked(u, v)) continue;
        if (!crowded(u, v, ...skip)) return [u, v];
        best = best || [u, v];
      }
      return best || [5, 3.5];
    }

    const layer = document.createElement("div");
    layer.className = "tavern-talk";
    wrap.appendChild(layer);
    const bubbles = [];
    function say(a, text, secs) {
      if (!text) return;
      for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].a === a) { bubbles[i].el.remove(); bubbles.splice(i, 1); }
      if (bubbles.length >= 3) { const old = bubbles.shift(); old.el.remove(); }
      const el = document.createElement("div");
      el.className = "tavern-bubble" + (a.keeper ? " keeper" : "");
      const b = document.createElement("b"); b.textContent = a.name;
      el.append(b, document.createTextNode(" " + text));
      layer.appendChild(el);
      bubbles.push({ a, el, until: now + (secs || 3.4) });
    }
    function line(a, pred) {
      const ok = a.lines.filter((t) => (pred ? pred(t) : !t.startsWith("One ")));
      const fresh = ok.filter((t) => !a.said.includes(t)), src = fresh.length ? fresh : ok;
      const pick = src[Math.floor(r() * src.length)];
      a.said = (a.said.concat(pick)).slice(-3);
      return pick;
    }
    function go(a, u, v) { a.tu = u; a.tv = v; a.mode = "walk"; }
    function roomAt(gen, ...skip) {
      for (let k = 0; k < 10; k++) { const [u, v] = gen(); if (!crowded(u, v, ...skip)) return [u, v]; }
      return null;
    }
    function choose(a) {
      const roll = r();
      a.tu = a.u; a.tv = a.v;
      const bar = roll >= 0.28 && roll < 0.52 ? roomAt(() => [1.5 + r() * 5.4, BAR_V + 0.6 + r() * 0.2], a) : null;
      const fire = roll >= 0.52 && roll < 0.64 ? roomAt(() => [1.0 + r() * 0.6, FIRE.v0 + r() * (FIRE.v1 - FIRE.v0)], a) : null;
      if ((roll >= 0.28 && roll < 0.64) && !bar && !fire) { const [u, v] = freeSpot(a); go(a, u, v); a.then = () => { a.wait = 2 + r() * 3; }; return; }
      if (roll < 0.28) { const [u, v] = freeSpot(a); go(a, u, v); a.then = () => { a.wait = 1.5 + r() * 3; }; }
      else if (roll < 0.52) {
        go(a, bar[0], bar[1]);
        a.then = () => {
          a.face = 1; say(a, line(a, (t) => t.startsWith("One ")), 2.6);
          setTimeout(() => { if (wrap.isConnected) { say(keep, r() < 0.5 ? "Coming up." : tav.lines[Math.floor(r() * tav.lines.length)], 2.6); a.mug = 30; } }, 1400);
          a.wait = 4;
        };
      } else if (roll < 0.64) { go(a, fire[0], fire[1]); a.then = () => { a.face = -1; a.wait = 4 + r() * 4; }; }
      else {
        const free = actors.filter((b) => b !== a && b.mode !== "chat" && b.mode !== "join");
        const other = free[Math.floor(r() * free.length)];
        if (!other) { a.wait = 2; return; }
        // a pair needs two free places side by side on screen, not one in front of the other
        const pair = roomAt(() => { const [u, v] = freeSpot(a, other); return [u, v]; }, a, other);
        if (!pair) { a.wait = 2; return; }
        const [u, v] = pair, side = u + 1.4 <= WALK.u1 && v - 1.4 >= WALK.v0 ? 1.4 : -1.4;
        const ou = Math.max(WALK.u0, Math.min(WALK.u1, u + side)), ov = Math.max(WALK.v0, Math.min(WALK.v1, v - side));
        if (crowded(ou, ov, a, other)) { a.wait = 2; return; }
        go(a, u, v); other.partner = a;
        go(other, ou, ov); other.mode = "join";
        a.then = () => {
          a.mode = "chat"; a.partner = other;
          const turns = [a, other, a, other].slice(0, 2 + Math.floor(r() * 3));
          turns.forEach((s, i) => setTimeout(() => { if (wrap.isConnected) say(s, line(s), 2.6); }, 300 + i * 2300));
          const end = 300 + turns.length * 2300;
          setTimeout(() => { a.mode = "idle"; a.wait = 1 + r() * 2; other.mode = "idle"; other.wait = 1 + r() * 2; }, end);
          a.wait = end / 1000 + 1;
        };
      }
    }

    let now = 0, last = 0, raf = 0, visible = true;
    function step(a, dt, speed) {
      const du = a.tu - a.u, dv = a.tv - a.v, d = Math.hypot(du, dv);
      if (d < 0.05) return true;
      const s = Math.min(d, speed * dt);
      a.u += (du / d) * s; a.v += (dv / d) * s;
      const sx = (du - dv);
      if (Math.abs(sx) > 0.02) a.face = sx > 0 ? 1 : -1;
      return false;
    }
    function update(dt) {
      for (const a of actors) {
        if (a.mug > 0) a.mug -= dt;
        if (a.mode === "walk" || a.mode === "join") {
          if (still) { a.u = a.tu; a.v = a.tv; }
          if (step(a, dt, 1.3)) {
            if (a.mode === "join") { a.mode = "chat"; if (a.partner) a.face = a.partner.u - a.partner.v > a.u - a.v ? 1 : -1; }
            else { a.mode = "idle"; const t = a.then; a.then = null; if (t) t(); }
            if (a.partner && a.mode === "chat") a.partner.face = a.u - a.v > a.partner.u - a.partner.v ? 1 : -1;
          }
        } else if (a.mode === "idle") {
          a.wait -= dt;
          if (a.wait <= 0) choose(a);
        }
        if (a.pet) {
          const p = a.pet;
          p.tu = a.u - 0.55 * a.face; p.tv = a.v + 0.45;
          const moving = !step(p, dt, 1.8);
          p.moving = moving;
          p.face = a.face;
        }
      }
      keep.wait -= dt;
      if (!still) step(keep, dt, 0.7);
      if (keep.wait <= 0) {
        keep.tu = 1.6 + r() * 5.2; keep.wait = 4 + r() * 6;
        if (r() < 0.35) say(keep, tav.lines[Math.floor(r() * tav.lines.length)], 3);
      }
      for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].until < now) { bubbles[i].el.remove(); bubbles.splice(i, 1); }
    }

    function sprite(a, bob) {
      const [x, y] = iso(a.u, a.v);
      ctx.fillStyle = "rgba(20,10,4,0.35)";
      ctx.fillRect(Math.round(x) - 6, Math.round(y) - 1, 12, 2); ctx.fillRect(Math.round(x) - 4, Math.round(y) - 2, 8, 4);
      ctx.drawImage(a.face > 0 ? a.right : a.left, Math.round(x) - 14, Math.round(y) - 33 - bob);
      if (a.mug > 0) { const mx = Math.round(x) + (a.face > 0 ? 7 : -9); const my = Math.round(y) - 15 - bob; ctx.fillStyle = "#c8a040"; ctx.fillRect(mx, my, 3, 4); ctx.fillStyle = "#f0e8d0"; ctx.fillRect(mx, my - 1, 3, 1); ctx.fillStyle = "#8a6020"; ctx.fillRect(mx + 3, my + 1, 1, 2); }
    }
    function draw() {
      ctx.drawImage(bg, 0, 0);
      const flick = 0.75 + Math.sin(now * 13) * 0.08 + Math.sin(now * 7.3) * 0.08;
      const [fx, fy] = lwall((FIRE.v0 + FIRE.v1) / 2, 4);
      for (let i = 0; i < 18; i++) {
        const v = FIRE.v0 + 0.2 + (i / 18) * (FIRE.v1 - FIRE.v0 - 0.4), h = 3 + Math.abs(Math.sin(now * 9 + i * 1.7)) * 9 * flick;
        const [x, y] = lwall(v, 1);
        for (let k = 0; k < h; k++) { ctx.fillStyle = k < h * 0.35 ? "#fff0a0" : k < h * 0.7 ? "#f0a030" : "#c04a20"; ctx.fillRect(x, y - k, 1, 1); }
      }
      const glow = ctx.createRadialGradient(fx + 20, fy + 14, 2, fx + 20, fy + 14, 70);
      glow.addColorStop(0, `rgba(255,170,80,${0.22 * flick})`); glow.addColorStop(1, "rgba(255,170,80,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      const things = furniture.map((f) => ({ key: f.key, draw: () => ctx.drawImage(f.cv, 0, 0) }));
      const bob = (a) => (a.mode === "walk" || a.mode === "join") && !still ? (Math.floor(now * 6 + a.u * 3) % 2) : 0;
      for (const a of actors) {
        things.push({ key: a.u + a.v, draw: () => sprite(a, bob(a)) });
        if (a.pet) things.push({ key: a.pet.u + a.pet.v, draw: () => { const [x, y] = iso(a.pet.u, a.pet.v); const f = a.pet.moving && !still ? Math.floor(now * 6) % 2 : 0; ctx.drawImage((a.pet.face > 0 ? a.pet.right : a.pet.left)[f], Math.round(x) - 7, Math.round(y) - 10); } });
      }
      things.push({ key: keep.u + keep.v, draw: () => sprite(keep, 0) });
      things.sort((p, q) => p.key - q.key).forEach((t) => t.draw());
      for (const [lu, lv] of [[3.6, 4.0], [8.8, 6.8]]) {
        const [x, y] = iso(lu, lv); const ly = y - 62;
        ctx.fillStyle = "#2a1a10"; ctx.fillRect(x, 0, 1, ly); ctx.fillRect(x - 2, ly, 5, 5); ctx.fillStyle = "#ffd86a"; ctx.fillRect(x - 1, ly + 1, 3, 3);
        const g = ctx.createRadialGradient(x, ly + 2, 0, x, ly + 2, 46);
        g.addColorStop(0, `rgba(255,210,120,${0.16 + flick * 0.04})`); g.addColorStop(1, "rgba(255,210,120,0)");
        ctx.fillStyle = g; ctx.fillRect(x - 46, ly - 44, 92, 92);
      }
      const k = cv.clientWidth / W;
      for (const b of bubbles) {
        const [x, y] = iso(b.a.u, b.a.v);
        const bw = b.el.offsetWidth / 2, cw = cv.clientWidth;
        b.el.style.left = `${Math.max(bw + 4, Math.min(cw - bw - 4, x * k))}px`;
        b.el.style.top = `${Math.max(b.el.offsetHeight + 4, (y - 36) * k)}px`;
      }
    }
    function frame(t) {
      if (!wrap.isConnected) return;
      raf = requestAnimationFrame(frame);
      if (!visible) { last = t; return; }
      const dt = Math.min(0.1, (t - last) / 1000 || 0);
      last = t; now += dt;
      update(dt); draw();
    }
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(wrap);
    cv.addEventListener("click", (ev) => {
      const k = cv.clientWidth / W, rect = cv.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) / k, my = (ev.clientY - rect.top) / k;
      const hit = actors.concat([keep]).filter((a) => { const [x, y] = iso(a.u, a.v); return Math.abs(mx - x) < 9 && my < y && my > y - 34; })
        .sort((p, q) => q.u + q.v - (p.u + p.v))[0];
      if (hit) say(hit, hit.keeper ? tav.lines[Math.floor(r() * tav.lines.length)] : line(hit), 3);
    });
    raf = requestAnimationFrame(frame);
    draw();
    return wrap;
  }

  window.Tavern = { scene };
})();
