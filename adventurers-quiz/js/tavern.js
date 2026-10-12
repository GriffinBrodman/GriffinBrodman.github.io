/* Isometric pixel rooms with heroes who walk, chat and order drinks. Tavern.scene is the preseason tavern on the Crier;
   Tavern.inn is the same common room for any cast; the stage, actor, speech and loop helpers are shared with camp.js.
   Everything said comes from the sim (league.voice); this only stages it. */
(function () {
  "use strict";

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

  // one tile is 16x8 px on screen; u runs down-right along the right wall, v down-left along the left wall
  function stage(W, H, OX, OY) {
    const iso = (u, v) => [OX + (u - v) * 8, OY + (u + v) * 4];
    const up = (p, h) => [p[0], p[1] - h];
    const lwall = (v, h) => up(iso(0, v), h);
    const rwall = (u, h) => up(iso(u, 0), h);
    const quad = (f, a0, a1, h0, h1) => [f(a0, h0), f(a1, h0), f(a1, h1), f(a0, h1)];
    const toUV = (x, y) => { const a = (x + 0.5 - OX) / 8, b = (y + 0.5 - OY) / 4; return [(a + b) / 2, (b - a) / 2]; };
    // position along a wall and height above the floor, for brick and plank patterns that follow the wall
    const onL = (x, y) => [(OX - x - 0.5) / 8, OY + (OX - x - 0.5) / 2 - y - 0.5];
    const onR = (x, y) => [(x + 0.5 - OX) / 8, OY + (x + 0.5 - OX) / 2 - y - 0.5];
    function canvas() { const cv = document.createElement("canvas"); cv.width = W; cv.height = H; return cv; }
    function box(u, v, du, dv, h, top, left, right, z) {
      const cv = canvas(), ctx = cv.getContext("2d"), e = z || 0;
      const a = up(iso(u, v + dv), e), b = up(iso(u + du, v + dv), e), c = up(iso(u + du, v), e), d = up(iso(u, v), e);
      fillPoly(ctx, [a, b, up(b, h), up(a, h)], left);
      fillPoly(ctx, [b, c, up(c, h), up(b, h)], right);
      fillPoly(ctx, [up(a, h), up(b, h), up(c, h), up(d, h)], top);
      return cv;
    }
    return { W, H, OX, OY, iso, up, lwall, rwall, quad, toUV, onL, onR, canvas, box };
  }

  function barrel(ctx, x, y) {
    for (let j = 0; j < 12; j++) for (let i = -5; i <= 5; i++) {
      if (Math.abs(i) === 5 && (j < 1 || j > 10)) continue;
      ctx.fillStyle = j === 2 || j === 9 ? "#5a5a62" : i < -2 ? "#9a6a38" : i > 2 ? "#5e3c20" : "#7e5230";
      ctx.fillRect(x + i, y - j - 1, 1, 1);
    }
    ctx.fillStyle = "#4a2c18"; ctx.fillRect(x - 4, y - 13, 9, 1);
  }
  // a night window in the right wall, with a mullion and a few stars
  function windowR(ctx, st, r, a0, a1, h0, h1, moon) {
    fillPoly(ctx, st.quad(st.rwall, a0 - 0.15, a1 + 0.15, h0 - 2, h1 + 2), "#2a1a10");
    fillPoly(ctx, st.quad(st.rwall, a0, a1, h0, h1), (x, y) => (r() < 0.02 ? "#f0e8c0" : y % 2 ? "#1c2a4a" : "#203054"));
    const mid = (a0 + a1) / 2;
    fillPoly(ctx, [st.rwall(mid - 0.05, h0), st.rwall(mid + 0.05, h0), st.rwall(mid + 0.05, h1), st.rwall(mid - 0.05, h1)], "#2a1a10");
    if (moon) { const m = st.rwall(a0 + 0.4, h1 - 4); ctx.fillStyle = "#f0e8c0"; ctx.fillRect(m[0], m[1], 3, 3); ctx.fillStyle = "#203054"; ctx.fillRect(m[0] + 2, m[1], 1, 1); }
  }
  // a stone fireplace in the left wall; flames() animates the fire inside it
  function hearth(ctx, st, r, v0, v1, top) {
    const T = top || 52;
    fillPoly(ctx, st.quad(st.lwall, v0 - 0.4, v1 + 0.4, 0, 30), (x, y) => ((x + (y >> 2) * 3) % 7 === 0 || y % 4 === 0 ? "#5a5866" : r() < 0.5 ? "#7e7c8a" : "#6e6c7a"));
    fillPoly(ctx, st.quad(st.lwall, v0 - 0.4, v1 + 0.4, 28, T - 3), (x, y) => (y % 4 === 0 ? "#4a4854" : "#64626f"));
    fillPoly(ctx, st.quad(st.lwall, v0, v1, 0, 17), "#120c0a");
    fillPoly(ctx, st.quad(st.lwall, v0 - 0.5, v1 + 0.5, 30, 32), "#3a2214");
  }
  function flames(ctx, st, now, v0, v1, flick, size) {
    const k = size || 1;
    for (let i = 0; i < 18; i++) {
      const v = v0 + 0.2 + (i / 18) * (v1 - v0 - 0.4), h = (3 + Math.abs(Math.sin(now * 9 + i * 1.7)) * 9 * flick) * k;
      const [x, y] = st.lwall(v, 1);
      for (let j = 0; j < h; j++) { ctx.fillStyle = j < h * 0.35 ? "#fff0a0" : j < h * 0.7 ? "#f0a030" : "#c04a20"; ctx.fillRect(x, y - j, 1, 1); }
    }
    const [fx, fy] = st.lwall((v0 + v1) / 2, 4);
    const glow = ctx.createRadialGradient(fx + 20, fy + 14, 2, fx + 20, fy + 14, 70 * k);
    glow.addColorStop(0, `rgba(255,170,80,${0.22 * flick})`); glow.addColorStop(1, "rgba(255,170,80,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, st.W, st.H);
  }
  // a lantern hanging from the ceiling at floor spot (u, v)
  function lantern(ctx, st, u, v, flick, drop) {
    const [x, y] = st.iso(u, v); const ly = y - (drop || 62);
    ctx.fillStyle = "#2a1a10"; ctx.fillRect(x, 0, 1, ly); ctx.fillRect(x - 2, ly, 5, 5); ctx.fillStyle = "#ffd86a"; ctx.fillRect(x - 1, ly + 1, 3, 3);
    const g = ctx.createRadialGradient(x, ly + 2, 0, x, ly + 2, 46);
    g.addColorStop(0, `rgba(255,210,120,${0.16 + flick * 0.04})`); g.addColorStop(1, "rgba(255,210,120,0)");
    ctx.fillStyle = g; ctx.fillRect(x - 46, ly - 44, 92, 92);
  }

  // ---------- actors: a hero (or anyone with a look) and their pet, standing on the floor grid ----------
  function actor(h, u, v, opts) {
    const o = opts || {};
    const hs = Object.assign({}, h, { alive: true }, o.plain ? { weapon_tier: 1, armor_tier: 1 } : {});
    const g = Art.heroGrid(hs, 0, o.look || App.heroLook(hs));
    const pet = h.pet ? { g0: Art.petGrid(h.pet, 0), g1: Art.petGrid(h.pet, 1) } : null;
    return { h, name: o.name || h.name, lines: (o.lines || []).slice(), u, v, tu: u, tv: v, face: o.face || 1, mode: "idle", wait: o.wait || 1, mug: 0, said: [],
      right: g.toCanvas(1), left: g.flipX().toCanvas(1), focus: !!o.focus, keeper: !!o.keeper,
      pet: pet && { name: h.pet.name, lines: o.petLines || [], right: [pet.g0.toCanvas(1), pet.g1.toCanvas(1)], left: [pet.g0.flipX().toCanvas(1), pet.g1.flipX().toCanvas(1)],
        u: u - 0.6, v: v + 0.4, tu: u - 0.6, tv: v + 0.4, face: 1, pet: true, said: [] } };
  }
  // nameless townsfolk who fill a quiet common room; they never speak
  function local(r, u, v) {
    const p = (a) => a[Math.floor(r() * a.length)];
    const look = { skin: p(["#f0c8a0", "#e0b088", "#c48a5e", "#9a6440", "#6e4428"]), hair: p(["#3a2a1a", "#6a4020", "#c8a050", "#9a9aa6", "#2a2228", "#a04a20"]),
      style: Math.floor(r() * 6), face: Math.floor(r() * 3), fav: p(["#5a6a3a", "#3a5a8a", "#7a5a3a", "#6a3a3a", "#8a7a5a"]), scars: [] };
    const a = actor({ id: "local" + Math.floor(r() * 1e6), name: "A local", look, weapon: "none", weapon_tier: 1, armor_tier: 1 }, u, v,
      { name: "A local", look: { name: "local", look: { outfit: p(["vest", "leather", "cloak"]), head: "none", aura: null, offhand: "none" } } });
    a.local = true;
    return a;
  }
  function keeper(name, u, v) {
    const look = { skin: "#c98e62", hair: "#9a9aa6", style: 4, face: 2, fav: "#8a3a2a", scars: [] };
    return actor({ id: "barkeep", name, look, weapon: "none", weapon_tier: 1, armor_tier: 1 }, u, v,
      { name, keeper: true, look: { name: "barkeep", look: { outfit: "vest", head: "none", aura: null, offhand: "none" } } });
  }
  function step(a, dt, speed) {
    const du = a.tu - a.u, dv = a.tv - a.v, d = Math.hypot(du, dv);
    if (d < 0.05) return true;
    const s = Math.min(d, speed * dt);
    a.u += (du / d) * s; a.v += (dv / d) * s;
    const sx = du - dv;
    if (Math.abs(sx) > 0.02) a.face = sx > 0 ? 1 : -1;
    return false;
  }
  function drawActor(ctx, st, a, bob, now) {
    const [x0, y0] = st.iso(a.u, a.v), x = Math.round(x0), y = Math.round(y0);
    ctx.fillStyle = "rgba(20,10,4,0.35)";
    ctx.fillRect(x - 6, y - 1, 12, 2); ctx.fillRect(x - 4, y - 2, 8, 4);
    ctx.drawImage(a.face > 0 ? a.right : a.left, x - 14, y - 33 - bob);
    if (a.mug > 0) { const mx = x + (a.face > 0 ? 7 : -9), my = y - 15 - bob; ctx.fillStyle = "#c8a040"; ctx.fillRect(mx, my, 3, 4); ctx.fillStyle = "#f0e8d0"; ctx.fillRect(mx, my - 1, 3, 1); ctx.fillStyle = "#8a6020"; ctx.fillRect(mx + 3, my + 1, 1, 2); }
  }
  // the page's hero gets a small bobbing gold marker, like a game cursor; drawn last so no light or bars cover it
  function drawMarker(ctx, st, a, now) {
    const [x0, y0] = st.iso(a.u, a.v), x = Math.round(x0), my = Math.round(y0) - 40 - (Math.floor((now || 0) * 2.5) % 2);
    ctx.fillStyle = "#3a2410"; ctx.fillRect(x - 3, my - 1, 7, 1); ctx.fillRect(x - 3, my, 1, 1); ctx.fillRect(x + 3, my, 1, 1); ctx.fillRect(x - 2, my + 1, 1, 1); ctx.fillRect(x + 2, my + 1, 1, 1); ctx.fillRect(x - 1, my + 2, 1, 1); ctx.fillRect(x + 1, my + 2, 1, 1);
    ctx.fillStyle = "#f0c850"; ctx.fillRect(x - 2, my, 5, 1); ctx.fillRect(x - 1, my + 1, 3, 1); ctx.fillStyle = "#c8902a"; ctx.fillRect(x, my + 2, 1, 1);
  }
  function drawPet(ctx, st, p, frame) {
    const [x, y] = st.iso(p.u, p.v);
    ctx.fillStyle = "rgba(20,10,4,0.3)"; ctx.fillRect(Math.round(x) - 5, Math.round(y) - 1, 10, 2);
    ctx.drawImage((p.face > 0 ? p.right : p.left)[frame], Math.round(x) - 7, Math.round(y) - 10);
  }
  function pick(a, r, pred) {
    const ok = a.lines.filter((t) => (pred ? pred(t) : !t.startsWith("One ")));
    if (!ok.length) return null;
    const fresh = ok.filter((t) => !a.said.includes(t)), src = fresh.length ? fresh : ok;
    const p = src[Math.floor(r() * src.length)];
    a.said = a.said.concat(p).slice(-Math.max(3, Math.floor(ok.length * 0.6)));
    return p;
  }

  // ---------- speech bubbles, positioned over the canvas in CSS pixels ----------
  function talk(wrap, cv, st) {
    const layer = document.createElement("div");
    layer.className = "tavern-talk";
    wrap.appendChild(layer);
    const bubbles = [];
    const T = {
      now: 0,
      say(a, text, secs) {
        if (!text) return;
        for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].a === a) { bubbles[i].el.remove(); bubbles.splice(i, 1); }
        if (bubbles.length >= 3) { const old = bubbles.shift(); old.el.remove(); }
        const el = document.createElement("div");
        el.className = "tavern-bubble" + (a.keeper ? " keeper" : "") + (a.pet === true ? " pet" : "") + (a.focus ? " focus" : "");
        const b = document.createElement("b"); b.textContent = a.name;
        el.append(b, document.createTextNode(" " + text));
        layer.appendChild(el);
        bubbles.push({ a, el, until: T.now + (secs || Math.min(5.5, 2.4 + text.length / 22)) });
      },
      speaking(a) { return bubbles.some((b) => b.a === a); },
      get count() { return bubbles.length; },
      prune() { for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].until < T.now) { bubbles[i].el.remove(); bubbles.splice(i, 1); } },
      place() {
        const k = cv.clientWidth / st.W, cw = cv.clientWidth;
        for (const b of bubbles) {
          const [x, y] = b.a.at || st.iso(b.a.u, b.a.v), lift = b.a.at ? 0 : b.a.pet === true ? 12 : 36;
          const bw = b.el.offsetWidth / 2;
          b.el.style.left = `${Math.max(bw + 4, Math.min(cw - bw - 4, x * k))}px`;
          b.el.style.top = `${Math.max(b.el.offsetHeight + 4, (y - lift) * k)}px`;
        }
      },
    };
    return T;
  }

  // ---------- the loop: one rAF, stopped offscreen, in a hidden tab and once the scene leaves the page ----------
  const reduced = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  function loop(wrap, tick, onVisible) {
    const still = reduced();
    let raf = 0, last = 0, onscreen = true;
    const live = () => wrap.isConnected && onscreen && !document.hidden;
    function frame(t) {
      raf = 0;
      if (!live()) return;
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      tick(dt);
      raf = requestAnimationFrame(frame);
    }
    function wake() { if (!still && !raf && live()) { last = 0; raf = requestAnimationFrame(frame); } }
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => {
        onscreen = es[es.length - 1].isIntersecting;
        if (onVisible) onVisible(onscreen && wrap.isConnected);
        if (!wrap.isConnected) { io.disconnect(); return; }
        if (still && onscreen) tick(0);
        wake();
      });
      io.observe(wrap);
    }
    const vis = () => { if (!wrap.isConnected) { document.removeEventListener("visibilitychange", vis); return; } wake(); };
    document.addEventListener("visibilitychange", vis);
    tick(0);
    wake();
    return { still, redraw: () => { if (still || !raf) tick(0); } };
  }

  // ---------- the common room ----------
  const W = 198, H = 158, NU = 13, NV = 10, OX = 87, OY = 60, WH = 54;
  const BAR_V = 2.0, WALK = { u0: 0.9, u1: NU - 0.5, v0: 2.7, v1: NV - 0.4 };
  const TABLES = [[3.0, 5.6], [7.6, 4.4], [5.6, 8.0], [10.2, 7.2]];
  const FIRE = { v0: 4.8, v1: 7.0 };

  function room(st, r, opts) {
    const { iso, lwall, rwall, quad } = st;
    const cv = st.canvas(), ctx = cv.getContext("2d");
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
      const [u, v] = st.toUV(x, y);
      const row = Math.floor(v * 2), seam = Math.abs(v * 2 - Math.round(v * 2)) < 0.07, end = Math.abs(((u + row * 1.7) % 3) - 0) < 0.05;
      if (seam || end) return "#5a3820";
      return ["#8e5c34", "#83542f", "#895830"][((row % 3) + 3) % 3];
    });
    fillPoly(ctx, [iso(4.8, 4.8), iso(8.6, 4.8), iso(8.6, 7.4), iso(4.8, 7.4)], (x, y) => {
      const [u, v] = st.toUV(x, y);
      const edge = u < 5.05 || u > 8.35 || v < 5.05 || v > 7.15;
      return edge ? "#c8a040" : ((Math.floor(u * 2) + Math.floor(v * 2)) % 2 ? "#8a2a24" : "#7a2420");
    });
    windowR(ctx, st, r, 8.4, 10.0, 19, 39, true);
    windowR(ctx, st, r, 10.8, 12.2, 19, 39);
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
    hearth(ctx, st, r, FIRE.v0, FIRE.v1, WH);
    if (opts.board) {
      fillPoly(ctx, quad(lwall, 1.3, 3.1, 22, 38), "#4a2c18");
      fillPoly(ctx, quad(lwall, 1.45, 2.95, 23.5, 36.5), "#c8a878");
      for (const [a, h0] of [[1.6, 34], [1.6, 31], [1.6, 28], [1.6, 25.5]]) fillPoly(ctx, quad(lwall, a, a + 0.9 + r() * 0.4, h0, h0 + 1), "#6e5a44");
      for (const [a, h0, c] of [[2.7, 34.5, "#a03028"], [2.2, 27, "#2a5aa0"]]) { const p = lwall(a, h0); ctx.fillStyle = c; ctx.fillRect(p[0], p[1], 2, 2); }
    } else {
      // a stair up to the rooms, climbing the left wall
      for (let i = 0; i < 6; i++) {
        const v0 = 0.3 + i * 0.5, h0 = 6 + i * 6;
        fillPoly(ctx, quad(lwall, v0, v0 + 0.5, 0, h0), "#3e2616");
        fillPoly(ctx, quad(lwall, v0, v0 + 0.5, h0 - 1.5, h0), "#9a6436");
      }
      fillPoly(ctx, quad(lwall, 0.2, 3.4, 37, 39), "#4a2c18");
      for (let v = 0.5; v < 3.4; v += 0.6) fillPoly(ctx, quad(lwall, v, v + 0.08, 39, 47), "#4a2c18");
      fillPoly(ctx, quad(lwall, 0.2, 3.4, 46.5, 48), "#5e3a1e");
    }
    for (const [u, v] of [[11.7, 0.5], [12.4, 1.3]]) { const [x, y] = iso(u, v); barrel(ctx, x, y); }
    return cv;
  }

  // cfg: { seed, keeper: {name, lines}, cast: [{h, lines, focus, pet}], board, onVisible }
  function inn(cfg) {
    const r = Art.rng(Art.hash(cfg.seed || "tavern"));
    const st = stage(W, H, OX, OY);
    const wrap = document.createElement("div");
    wrap.className = "tavern";
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    wrap.appendChild(cv);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const bg = room(st, r, { board: cfg.board });
    const keepLines = (cfg.keeper && cfg.keeper.lines) || ["Another one?"];

    const furniture = [];
    for (let u = 1.2; u < 7.2; u += 1) furniture.push({ key: u + BAR_V + 0.4, cv: st.box(u, 1.2, 1, BAR_V - 1.2, 14, "#a8703c", "#5a3418", "#4a2c18") });
    for (const [u, v] of TABLES) {
      furniture.push({ key: u + v + 1.0, cv: st.box(u, v, 1.0, 1.0, 9, "#9a6436", "#5e3a1e", "#4e2e18") });
      for (const [su, sv] of [[u + 0.35, v + 1.25], [u + 1.25, v + 0.35]]) furniture.push({ key: su + sv + 0.35, cv: st.box(su, sv, 0.35, 0.35, 5, "#7a4a28", "#4a2c18", "#3e2414") });
    }

    const actors = [];
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
    cfg.cast.slice(0, 14).forEach((c, i) => {
      const spot = c.focus ? [3.4 + r() * 0.6, 4.3 + r() * 0.4] : freeSpot();
      const a = actor(c.h, spot[0], spot[1], { lines: c.lines, focus: c.focus, plain: cfg.plain, petLines: c.pet, face: r() < 0.5 ? 1 : -1, wait: c.focus ? 6 + r() * 3 : 1 + r() * 5 + i * 0.4 });
      actors.push(a);
    });
    for (let i = actors.length; i < (cfg.locals || 0); i++) { const [u, v] = freeSpot(); const a = local(r, u, v); a.wait = 2 + r() * 6; a.face = r() < 0.5 ? 1 : -1; actors.push(a); }
    const keep = keeper((cfg.keeper && cfg.keeper.name) || "The barkeep", 3.5, 0.6);
    keep.wait = 2;
    const focus = actors.find((a) => a.focus);
    const still = reduced();

    const T = talk(wrap, cv, st);
    const say = (a, text, secs) => T.say(a, text, secs);
    function go(a, u, v) { a.tu = u; a.tv = v; a.mode = "walk"; }
    function roomAt(gen, ...skip) {
      for (let k = 0; k < 10; k++) { const [u, v] = gen(); if (!crowded(u, v, ...skip)) return [u, v]; }
      return null;
    }
    const later = (ms, fn) => setTimeout(() => { if (wrap.isConnected) fn(); }, ms);
    function choose(a) {
      const roll = r();
      a.tu = a.u; a.tv = a.v;
      const bar = roll >= 0.28 && roll < 0.52 ? roomAt(() => [1.5 + r() * 5.4, BAR_V + 0.6 + r() * 0.2], a) : null;
      if (a.local && roll >= 0.64) { a.wait = 3 + r() * 4; return; }
      const fire = roll >= 0.52 && roll < 0.64 ? roomAt(() => [1.0 + r() * 0.6, FIRE.v0 + r() * (FIRE.v1 - FIRE.v0)], a) : null;
      if ((roll >= 0.28 && roll < 0.64) && !bar && !fire) { const [u, v] = freeSpot(a); go(a, u, v); a.then = () => { a.wait = 2 + r() * 3; }; return; }
      if (roll < 0.28) { const [u, v] = freeSpot(a); go(a, u, v); a.then = () => { a.wait = 1.5 + r() * 3; }; }
      else if (roll < 0.52) {
        go(a, bar[0], bar[1]);
        a.then = () => {
          a.face = 1; say(a, pick(a, r, (t) => t.startsWith("One ")), 2.6);
          later(1400, () => { if (!a.local || r() < 0.3) say(keep, r() < 0.5 ? "Coming up." : keepLines[Math.floor(r() * keepLines.length)], 2.6); a.mug = 30; });
          a.wait = 4;
        };
      } else if (roll < 0.64) { go(a, fire[0], fire[1]); a.then = () => { a.face = -1; a.wait = 4 + r() * 4; if (a.focus) later(800, () => say(a, pick(a, r))); }; }
      else {
        const free = actors.filter((b) => b !== a && !b.local && b.mode !== "chat" && b.mode !== "join");
        const other = free[Math.floor(r() * free.length)];
        if (!other) { a.wait = 2; if (a.focus && !T.speaking(a)) say(a, pick(a, r)); return; }
        // a pair needs two free places side by side on screen, not one in front of the other
        const pair = roomAt(() => freeSpot(a, other), a, other);
        if (!pair) { a.wait = 2; return; }
        const [u, v] = pair, side = u + 1.4 <= WALK.u1 && v - 1.4 >= WALK.v0 ? 1.4 : -1.4;
        const ou = Math.max(WALK.u0, Math.min(WALK.u1, u + side)), ov = Math.max(WALK.v0, Math.min(WALK.v1, v - side));
        if (crowded(ou, ov, a, other)) { a.wait = 2; return; }
        go(a, u, v); other.partner = a;
        go(other, ou, ov); other.mode = "join";
        a.then = () => {
          a.mode = "chat"; a.partner = other;
          const turns = [a, other, a, other].slice(0, 2 + Math.floor(r() * 3));
          turns.forEach((s, i) => later(300 + i * 2600, () => say(s, pick(s, r), 2.8)));
          const end = 300 + turns.length * 2600;
          later(end, () => { a.mode = "idle"; a.wait = 1 + r() * 2; other.mode = "idle"; other.wait = 1 + r() * 2; });
          a.wait = end / 1000 + 1;
        };
      }
    }

    let soloAt = 1.2, petAt = 9 + r() * 6;
    function update(dt) {
      T.now += dt;
      const now = T.now;
      for (const a of actors) {
        if (a.mug > 0) a.mug -= dt;
        if (a.mode === "walk" || a.mode === "join") {
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
          p.moving = !step(p, dt, 1.8);
          p.face = a.face;
        }
      }
      // the page's hero talks more than anyone, so the day's news gets heard
      if (focus && now > soloAt && focus.mode !== "chat" && !T.speaking(focus)) { say(focus, pick(focus, r)); soloAt = now + 6 + r() * 5; }
      if (now > petAt) {
        const owners = actors.filter((a) => a.pet && a.pet.lines.length);
        const o = owners.find((a) => a.focus) && r() < 0.6 ? owners.find((a) => a.focus) : owners[Math.floor(r() * owners.length)];
        if (o) say(o.pet, pick(o.pet, r, () => true), 2.2);
        petAt = now + 12 + r() * 10;
      }
      keep.wait -= dt;
      step(keep, dt, 0.7);
      if (keep.wait <= 0) {
        keep.tu = 1.6 + r() * 5.2; keep.wait = 4 + r() * 6;
        if (r() < 0.35) say(keep, keepLines[Math.floor(r() * keepLines.length)], 3);
      }
      T.prune();
    }

    function draw() {
      const now = T.now;
      ctx.drawImage(bg, 0, 0);
      const flick = 0.75 + Math.sin(now * 13) * 0.08 + Math.sin(now * 7.3) * 0.08;
      flames(ctx, st, now, FIRE.v0, FIRE.v1, flick);
      const things = furniture.map((f) => ({ key: f.key, draw: () => ctx.drawImage(f.cv, 0, 0) }));
      const bob = (a) => ((a.mode === "walk" || a.mode === "join") && !still ? Math.floor(now * 6 + a.u * 3) % 2 : 0);
      for (const a of actors) {
        things.push({ key: a.u + a.v, draw: () => drawActor(ctx, st, a, bob(a), now) });
        if (a.pet) things.push({ key: a.pet.u + a.pet.v, draw: () => drawPet(ctx, st, a.pet, a.pet.moving && !still ? Math.floor(now * 6) % 2 : 0) });
      }
      things.push({ key: keep.u + keep.v, draw: () => drawActor(ctx, st, keep, 0, now) });
      things.sort((p, q) => p.key - q.key).forEach((t) => t.draw());
      for (const [lu, lv] of [[3.6, 4.0], [8.8, 6.8]]) lantern(ctx, st, lu, lv, flick);
      if (focus) drawMarker(ctx, st, focus, now);
      T.place();
    }
    const L = loop(wrap, (dt) => { if (dt) update(dt); draw(); }, cfg.onVisible);
    if (still && focus) { say(focus, focus.lines[0], 999); L.redraw(); }
    cv.addEventListener("click", (ev) => {
      const k = cv.clientWidth / W, rect = cv.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) / k, my = (ev.clientY - rect.top) / k;
      const hit = actors.filter((a) => !a.local).concat([keep]).filter((a) => { const [x, y] = st.iso(a.u, a.v); return Math.abs(mx - x) < 9 && my < y && my > y - 34; })
        .sort((p, q) => q.u + q.v - (p.u + p.v))[0];
      if (hit) { say(hit, hit.keeper ? keepLines[Math.floor(r() * keepLines.length)] : pick(hit, r), still ? 999 : 3); L.redraw(); }
    });
    return wrap;
  }

  function scene(L) {
    const tav = L.tavern || { name: "The tavern", barkeep: "The barkeep", lines: ["Another one?"] };
    const pending = L.pending.filter((h) => !h.npc).concat(L.pending.filter((h) => h.npc));
    return inn({ seed: L.meta.name + "tavern", board: true, plain: true, keeper: { name: tav.barkeep, lines: tav.lines },
      cast: pending.map((h) => ({ h, lines: h.chatter || [] })) });
  }

  window.Tavern = { scene, inn, stage, reduced, fillPoly, actor, keeper, local, step, drawActor, drawMarker, drawPet, pick, talk, loop, windowR, hearth, flames, lantern, barrel };
})();
