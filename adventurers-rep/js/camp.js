/* Tonight: the hero at the end of today, staged from the exported `tonight` (league/export.py _tonight). A campfire under
   the stars on the road or in the wild, a torch-lit camp on a dungeon floor, a cell, the stables, a rented room, a home,
   or the inn's common room (Tavern.inn). Lines come from league.voice.night_lines; this file only stages them. */
(function () {
  "use strict";
  const W = 200, H = 150;
  const T = () => window.Tavern;
  const fp = (...a) => T().fillPoly(...a);

  function pix(ctx, x, y, rows, pal) {
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x + i, y + j, 1, 1); } } });
  }
  function layer(st, paint) { const cv = st.canvas(), ctx = cv.getContext("2d"); paint(ctx); return cv; }
  // Anim's small looping actors (anim.js), when that file is present; each scene keeps working without them
  const anim = (name, o) => (window.Anim && typeof Anim[name] === "function" ? Anim[name](o) : null);
  const drawAll = (ctx, list, t) => { for (const a of list) if (a) a.draw(ctx, t); };
  // places given as screen offsets in pixels from a centre spot, so nobody stands in front of anybody else
  const fromScreen = (cu, cv, pts) => pts.map(([sx, sy]) => [cu + (sx / 8 + sy / 4) / 2, cv + (sy / 4 - sx / 8) / 2]);

  // ---------- ground and sky for the open-air camp ----------
  const GROUND = {
    plains: { a: "#26361f", b: "#2c3d23", c: "#33482a", far: "#1c2818", hill: "#141c1a", tuft: "#3e5530" },
    forest: { a: "#1f2e1c", b: "#243520", c: "#2b3f26", far: "#162214", hill: "#0e1814", tuft: "#36502c" },
    hills: { a: "#2c3222", b: "#323826", c: "#3a402c", far: "#20261c", hill: "#181c1e", tuft: "#465034" },
    marsh: { a: "#25301f", b: "#2a3522", c: "#303c26", far: "#1c2418", hill: "#121a18", tuft: "#3a4a2a", water: "#162430" },
    coast: { a: "#4a4636", b: "#524c3a", c: "#5a5440", far: "#3a3830", hill: "#141a26", tuft: "#5a6040", sea: true },
    snow: { a: "#7c88a2", b: "#8692ac", c: "#929eb8", far: "#5c6680", hill: "#2a3046", tuft: "#a8b2c8" },
    volcanic: { a: "#2a2220", b: "#30261f", c: "#372b22", far: "#201816", hill: "#1a1012", tuft: "#4a3428" },
  };
  const HZ = 50;

  function sky(ctx, r, biome) {
    const bands = biome === "volcanic" ? ["#140c18", "#1e1020", "#2c1420", "#40181c"] : ["#0a0f24", "#10183a", "#18224a", "#232c58"];
    for (let y = 0; y < HZ; y++) {
      const f = y / HZ * (bands.length - 1), i = Math.floor(f), frac = f - i;
      for (let x = 0; x < W; x++) {
        const dither = ((x + y) % 2 === 0 ? 0.25 : -0.25) + ((x * 3 + y) % 4 === 0 ? 0.12 : 0);
        ctx.fillStyle = bands[Math.min(bands.length - 1, frac + dither > 0.5 ? i + 1 : i)];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // the moon, a crescent high on the right
    const mx = 160 + Math.floor(r() * 20), my = 10 + Math.floor(r() * 6);
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
      const d = x * x + y * y, cut = (x + 2.5) ** 2 + (y - 1.5) ** 2;
      if (d <= 26 && cut > 18) { ctx.fillStyle = d > 18 ? "#c8c0a0" : "#f0e8c8"; ctx.fillRect(mx + x, my + y, 1, 1); }
    }
    return [mx, my];
  }
  function stars(r, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push({ x: Math.floor(r() * W), y: Math.floor(r() * (HZ - 8)), b: r(), ph: r() * 7, sp: 0.8 + r() * 2.4 });
    return out;
  }
  function horizon(ctx, r, biome, g) {
    const sil = (fn, col) => { for (let x = 0; x < W; x++) { const top = Math.round(fn(x)); for (let y = top; y <= HZ + 2; y++) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } } };
    const n1 = r() * 6, n2 = r() * 6;
    if (biome === "snow" || biome === "hills" || biome === "volcanic") {
      sil((x) => HZ - 14 - Math.abs(((x + n1 * 20) % 70) - 35) * 0.5 - Math.sin(x / 9 + n2) * 2, biome === "volcanic" ? "#1c1014" : "#1a2034");
      if (biome === "snow") for (let x = 0; x < W; x++) { const top = Math.round(HZ - 14 - Math.abs(((x + n1 * 20) % 70) - 35) * 0.5 - Math.sin(x / 9 + n2) * 2); if (top < HZ - 20) { ctx.fillStyle = "#8a94b0"; ctx.fillRect(x, top, 1, 2); } }
      sil((x) => HZ - 5 - Math.sin(x / 17 + n1) * 3, g.hill);
    } else if (biome === "forest") {
      sil((x) => HZ - 4 - Math.sin(x / 23 + n1) * 2, g.hill);
      for (let x = -4; x < W + 4; x += 5 + Math.floor(r() * 4)) {
        const h = 10 + Math.floor(r() * 9);
        for (let j = 0; j < h; j++) { const w = Math.floor(j / 2.2); ctx.fillStyle = g.hill; ctx.fillRect(x - w, HZ - h + j, w * 2 + 1, 1); }
      }
    } else if (g.sea) {
      ctx.fillStyle = "#0e1830"; ctx.fillRect(0, HZ - 6, W, 8);
      ctx.fillStyle = "#16244a"; for (let x = 0; x < W; x += 1) if (r() < 0.2) ctx.fillRect(x, HZ - 6 + Math.floor(r() * 7), 2, 1);
    } else {
      sil((x) => HZ - 4 - Math.sin(x / 31 + n1) * 3 - Math.sin(x / 11 + n2) * 1, g.hill);
      for (let k = 0; k < 4; k++) { const x = Math.floor(r() * W), h = 4 + Math.floor(r() * 4); ctx.fillStyle = g.hill; for (let j = 0; j < h; j++) ctx.fillRect(x - (j > 1 ? 2 : 1), HZ - 4 - h + j, j > 1 ? 5 : 3, 1); }
    }
    if (biome === "marsh") for (let k = 0; k < 3; k++) { const x = Math.floor(r() * W); ctx.fillStyle = g.hill; ctx.fillRect(x, HZ - 14, 1, 12); ctx.fillRect(x - 3, HZ - 11, 3, 1); ctx.fillRect(x + 1, HZ - 9, 3, 1); }
  }
  function ground(ctx, st, r, biome, road) {
    const g = GROUND[biome] || GROUND.plains;
    for (let y = HZ; y < H; y++) for (let x = 0; x < W; x++) {
      const depth = (y - HZ) / (H - HZ), n = r(), m = Math.sin(x * 0.21 + y * 0.63) + Math.sin(x * 0.09 - y * 0.37 + 2) + (n - 0.5) * 0.9;
      let c = depth < 0.12 ? g.far : m < -0.7 ? g.a : m < 0.9 ? g.b : g.c;
      if (g.water && depth > 0.15) { const [u, v] = st.toUV(x, y); if (Math.sin(u * 1.3 + v * 0.4) + Math.sin(v * 1.1 - u * 0.3) > 1.35) c = (x + y) % 3 ? g.water : "#1c3040"; }
      if (road) {
        const [, v] = st.toUV(x, y);
        if (v > 0.7 && v < 1.9) c = Math.abs(v - 1.0) < 0.08 || Math.abs(v - 1.6) < 0.08 ? "#2e261c" : n < 0.5 ? "#3e3426" : "#463a2a";
      }
      ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1);
    }
    for (let k = 0; k < 90; k++) {
      const x = Math.floor(r() * W), y = HZ + 6 + Math.floor(r() * (H - HZ - 6));
      ctx.fillStyle = g.tuft; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 2);
    }
    return g;
  }

  // ---------- props ----------
  const PINE = ["......x......", ".....xax.....", "....xaaax....", "...xaabaax...", "....xabax....", "...xaabaax...", "..xaaabbaax..", "...xaabaax...",
    "..xaaabbaax..", ".xaaaabbaaax.", "..xaaabbbaax.", ".xaaaabbbaaax", "xaaaabbbbaaax", "xxxxxxttxxxxx", "......tt.....", "......tt....."];
  const ROCK = ["..xxxx...", ".xabbax..", "xabbbbax.", "xbbbbbbbx", ".xxxxxxx."];
  const BONES = ["x...x..", ".x.x...", "..x....", ".x.x.oo", "x...xoo"];
  const BUCKET = [".xxxxx.", "xbbbbbx", ".xcbcx.", ".xbbbx.", "..xxx.."];
  function tent(st, u0, v0, color) {
    return layer(st, (ctx) => {
      const u1 = u0 + 2.2, v1 = v0 + 1.8, vm = (v0 + v1) / 2, h = 15, { iso, up } = st;
      fp(ctx, [iso(u0, v1), iso(u1, v1), up(iso(u1, vm), h), up(iso(u0, vm), h)], (x, y) => ((x + y) % 7 === 0 ? color[2] : color[0]));
      fp(ctx, [iso(u1, v0), iso(u1, v1), up(iso(u1, vm), h)], color[1]);
      fp(ctx, [iso(u1, vm - 0.45), iso(u1, vm + 0.45), up(iso(u1, vm), h * 0.7)], "#140c08");
      const [x0, y0] = up(iso(u0, vm), h), [x1, y1] = up(iso(u1, vm), h);
      ctx.strokeStyle = "#3a2414"; ctx.beginPath(); ctx.moveTo(x0 + 0.5, y0 + 0.5); ctx.lineTo(x1 + 0.5, y1 + 0.5); ctx.stroke();
      ctx.fillStyle = "#3a2414"; ctx.fillRect(Math.round(x1), Math.round(y1) - 3, 1, 3);
    });
  }
  function bedroll(st, u, v, c) { return st.box(u, v, 1.1, 0.5, 2, c[0], c[1], c[2]); }
  function log(st, u, v, du, dv) { return st.box(u, v, du, dv, 3, "#7a5432", "#4a2e18", "#3a2414"); }

  // ---------- wall and floor patterns ----------
  function bricks(base, mortar, r, tall, wide) {
    return (st, side) => (x, y) => {
      const [a, h] = side === "l" ? st.onL(x, y) : st.onR(x, y);
      const row = Math.floor(h / (tall || 5)), off = row % 2 ? 0.5 : 0;
      if (h % (tall || 5) < 1 || Math.abs(((a / (wide || 1.2) + off) % 1)) < 0.08) return mortar;
      return base[Math.floor(Math.abs(Math.sin(row * 12.9 + Math.floor(a / (wide || 1.2) + off) * 78.2)) * base.length * 0.999)] || base[0];
    };
  }
  function floorTiles(cols, seam, size) {
    return (st) => (x, y) => {
      const [u, v] = st.toUV(x, y), s = size || 1;
      if (Math.abs(u / s - Math.round(u / s)) < 0.06 || Math.abs(v / s - Math.round(v / s)) < 0.06) return seam;
      return cols[Math.floor(Math.abs(Math.sin(Math.floor(u / s) * 31.7 + Math.floor(v / s) * 17.3)) * cols.length * 0.999)];
    };
  }

  // a walled room: back walls, floor, top trim
  function walls(st, NU, NV, WH, wallFn, floorFn, trim) {
    return layer(st, (ctx) => {
      ctx.fillStyle = "#120c0a"; ctx.fillRect(0, 0, W, H);
      const { iso, lwall, rwall } = st;
      fp(ctx, [lwall(0, WH), lwall(NV, WH), iso(0, NV), iso(0, 0)], wallFn(st, "l"));
      fp(ctx, [rwall(0, WH), rwall(NU, WH), iso(NU, 0), iso(0, 0)], wallFn(st, "r"));
      fp(ctx, [lwall(0, WH), lwall(NV, WH), lwall(NV, WH - 3), lwall(0, WH - 3)], trim[0]);
      fp(ctx, [rwall(0, WH), rwall(NU, WH), rwall(NU, WH - 3), rwall(0, WH - 3)], trim[1]);
      // the walls are shaded darker where they meet the floor
      fp(ctx, [lwall(0, 2), lwall(NV, 2), iso(0, NV), iso(0, 0)], "rgba(0,0,0,0.25)");
      fp(ctx, [rwall(0, 2), rwall(NU, 2), iso(NU, 0), iso(0, 0)], "rgba(0,0,0,0.2)");
      fp(ctx, [iso(0, 0), iso(NU, 0), iso(NU, NV), iso(0, NV)], floorFn(st));
    });
  }

  // ---------- animated bits ----------
  function campfire(ctx, st, u, v, now, flick, still, big) {
    const [x0, y0] = st.iso(u, v), x = Math.round(x0), y = Math.round(y0), k = big || 1;
    for (let i = -Math.round(4 * k); i <= Math.round(4 * k); i++) {
      const edge = 1 - Math.abs(i) / (4.6 * k);
      const h = Math.max(1, (2 + edge * 11 * k) * (0.7 + 0.3 * Math.abs(Math.sin(now * 8.5 + i * 1.9))) * flick);
      for (let j = 0; j < h; j++) { ctx.fillStyle = j < h * 0.3 ? "#fff4b0" : j < h * 0.62 ? "#f8b030" : j < h * 0.88 ? "#e06a20" : "#a8341a"; ctx.fillRect(x + i, y - 3 - j, 1, 1); }
    }
    if (!still) for (let i = 0; i < 2; i++) { const t = (now * 1.7 + i * 0.5) % 1; ctx.fillStyle = t < 0.5 ? "#ffd070" : "#e07030"; ctx.fillRect(x + Math.round(Math.sin(now * 5 + i * 3) * 3), y - 12 * k - t * 10, 1, 1); }
  }
  function firepit(st, u, v) {
    return layer(st, (ctx) => {
      const [x0, y0] = st.iso(u, v), x = Math.round(x0), y = Math.round(y0);
      ctx.fillStyle = "#1a120c"; for (let j = -3; j <= 3; j++) { const w = Math.round(Math.sqrt(1 - (j / 3.5) ** 2) * 9); ctx.fillRect(x - w, y + j, w * 2, 1); }
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
        const sx = x + Math.round(Math.cos(a) * 9), sy = y + Math.round(Math.sin(a) * 4);
        ctx.fillStyle = "#4a4650"; ctx.fillRect(sx - 1, sy - 1, 3, 2); ctx.fillStyle = "#6e6a76"; ctx.fillRect(sx - 1, sy - 1, 2, 1);
      }
      ctx.fillStyle = "#5a3a20"; for (let i = -5; i <= 4; i++) { ctx.fillRect(x + i, y - 1 + Math.round(i * 0.3), 1, 2); ctx.fillRect(x - i, y - 2 + Math.round(i * 0.3), 1, 2); }
      ctx.fillStyle = "#c04a20"; ctx.fillRect(x - 2, y - 1, 4, 1);
    });
  }
  function sparks(list, x, y, dt, still, rate) {
    if (!still && Math.random() < dt * (rate || 7)) list.push({ x: x + (Math.random() - 0.5) * 6, y, vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 14, life: 0.9 + Math.random() * 1.1, t: 0 });
    for (let i = list.length - 1; i >= 0; i--) { const s = list[i]; s.t += dt; s.x += s.vx * dt + Math.sin(s.t * 6) * 0.15; s.y += s.vy * dt; if (s.t > s.life) list.splice(i, 1); }
  }
  function drawSparks(ctx, list) { for (const s of list) { const f = s.t / s.life; ctx.fillStyle = f < 0.35 ? "#fff0a0" : f < 0.7 ? "#f0a030" : "#a04020"; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); } }
  function glow(ctx, x, y, r0, r1, rgb, a) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r1, y - r1, r1 * 2, r1 * 2);
  }
  // darkness everywhere except a pool of light: drawn last, over everything
  function dark(ctx, x, y, r0, r1, a, tint) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    g.addColorStop(0, `rgba(${tint || "6,6,16"},0)`); g.addColorStop(1, `rgba(${tint || "6,6,16"},${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function torch(ctx, x, y, now, flick) {
    ctx.fillStyle = "#2a1a10"; ctx.fillRect(x - 1, y, 3, 2); ctx.fillRect(x, y + 2, 1, 4); ctx.fillStyle = "#5a3a20"; ctx.fillRect(x, y - 3, 1, 3);
    for (let i = -1; i <= 1; i++) { const h = Math.round((3 + (i === 0 ? 3 : 0)) * (0.8 + 0.3 * Math.abs(Math.sin(now * 11 + i * 2))) * flick); for (let j = 0; j < h; j++) { ctx.fillStyle = j < h * 0.35 ? "#fff0a0" : j < h * 0.75 ? "#f0a030" : "#c04a20"; ctx.fillRect(x + i, y - 4 - j, 1, 1); } }
    glow(ctx, x, y - 6, 2, 60, "255,170,80", 0.28 * flick);
  }

  // ---------- the gathering: a small cast at fixed spots, taking turns to talk ----------
  function gather(cfg) {
    const r = Art.rng(Art.hash(cfg.seed));
    const st = cfg.st;
    const wrap = document.createElement("div");
    wrap.className = "tavern night-" + cfg.kind;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    wrap.appendChild(cv);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const still = T().reduced();
    const center = cfg.center;
    // a pet sits a little behind its owner's back and a step nearer the viewer
    const petSpot = (a) => { a.pet.tu = a.u + (-1.25 * a.face + 0.75) / 2; a.pet.tv = a.v + (0.75 + 1.25 * a.face) / 2; };
    const faceTo = (a) => { const [ax] = st.iso(a.u, a.v), [cx] = st.iso(center[0], center[1]); a.face = cx >= ax ? 1 : -1; };
    const actors = cfg.cast.slice(0, cfg.spots.length).map((c, i) => {
      const [u, v] = cfg.spots[i];
      const a = T().actor(c.h, u, v, { lines: c.lines, focus: i === 0, petLines: c.pet });
      a.spot = i; faceTo(a);
      if (a.pet) { petSpot(a); a.pet.u = a.pet.tu; a.pet.v = a.pet.tv; a.pet.face = a.face; }
      return a;
    });
    // a solo hero's road companion: a fixed spot by the fire, a share of the chatter, never wanders off
    if (cfg.npc) {
      const n = cfg.npc, [u, v] = cfg.spots[n.spot];
      const a = T().actor({ id: "npc:" + n.name, name: n.name, look: n.look, kit: n.kit, weapon: n.kit.weapon.family, weapon_tier: 1, armor_tier: n.kit.armor.tier }, u, v,
        { lines: n.lines, look: { name: "npc", look: { outfit: n.kit.armor.outfit, head: "none", aura: null, offhand: "none" } } });
      Object.assign(a, { spot: n.spot, stay: true, keeper: true, npc: n });
      faceTo(a);
      actors.push(a);
    }
    const focus = actors[0];
    const host = cfg.host && cfg.host.lines && cfg.host.lines.length ? { name: cfg.host.name, lines: cfg.host.lines.slice(), keeper: true, at: cfg.host.at, said: [] } : null;
    const Talk = T().talk(wrap, cv, st);
    const say = (a, t, s) => Talk.say(a, t, s);
    const later = (ms, fn) => setTimeout(() => { if (wrap.isConnected) fn(); }, ms);
    const fx = { sparks: [], now: 0 };
    let chatAt = 0.9, moveAt = 8 + r() * 6, petAt = 7 + r() * 8, hostAt = 5 + r() * 8, first = true;

    // real exchanges between the people here (league.voice.night_talk) take turns with the idle chatter
    const talks = (cfg.talks || []).map((ex) => ex.map((l) => [actors.find((a) => a.h.id === l.id), l.text])).filter((ex) => ex.every(([a]) => a));
    let talkAt = 0;
    function exchange() {
      const ex = talks.shift();
      talks.push(ex);
      ex.forEach(([a, t], i) => later(i * 2900, () => { faceTo(a); say(a, t, 3.4); }));
      chatAt = Talk.now + ex.length * 2.9 + 1.5;
      talkAt = Talk.now + ex.length * 2.9 + 9 + r() * 6;
    }
    function talkTurn() {
      if (Talk.count >= 2) { chatAt = Talk.now + 1.5; return; }
      if (first) { first = false; say(focus, focus.lines[0]); focus.said.push(focus.lines[0]); chatAt = Talk.now + 4 + r() * 2; talkAt = chatAt; return; }
      if (talks.length && Talk.now >= talkAt && actors.every((a) => a.mode === "idle")) return exchange();
      const others = actors.filter((a) => a !== focus && a.mode === "idle");
      const sp = !others.length || r() < 0.45 ? focus : others[Math.floor(r() * others.length)];
      if (sp.mode !== "idle") { chatAt = Talk.now + 1; return; }
      say(sp, T().pick(sp, r, cfg.pred));
      const listener = actors.filter((a) => a !== sp && a.mode === "idle")[Math.floor(r() * (actors.length - 1))];
      if (listener && r() < 0.45) later(2600, () => { if (listener.mode === "idle") say(listener, T().pick(listener, r, cfg.pred)); });
      chatAt = Talk.now + 3.6 + r() * 3.2;
    }
    function wander() {
      const free = cfg.spots.map((s, i) => i).filter((i) => !actors.some((a) => a.spot === i));
      const movers = actors.filter((a) => a.mode === "idle" && !a.stay && !Talk.speaking(a));
      const a = movers[Math.floor(r() * movers.length)];
      if (!a) return;
      if (free.length && r() < 0.6) {
        const to = free[Math.floor(r() * free.length)];
        a.spot = to; a.tu = cfg.spots[to][0]; a.tv = cfg.spots[to][1]; a.mode = "walk"; a.then = () => faceTo(a);
      } else if (a.pet && a.pet.lines.length) say(a.pet, T().pick(a.pet, r, () => true), 2.2);
      else faceTo(a);
    }
    function update(dt) {
      Talk.now += dt; fx.now = Talk.now;
      const now = Talk.now;
      for (const a of actors) {
        if (a.mode === "walk" && T().step(a, dt, 1.1)) { a.mode = "idle"; const t = a.then; a.then = null; if (t) t(); }
        if (a.pet) {
          const p = a.pet;
          petSpot(a);
          p.moving = !T().step(p, dt, 1.6);
          if (!p.moving) p.face = a.face;
        }
      }
      if (now > chatAt) talkTurn();
      if (now > moveAt) { wander(); moveAt = now + 9 + r() * 9; }
      if (now > petAt) {
        const o = actors.filter((a) => a.pet && a.pet.lines.length);
        const a = o.includes(focus) && r() < 0.6 ? focus : o[Math.floor(r() * o.length)];
        if (a && Talk.count < 3) say(a.pet, T().pick(a.pet, r, () => true), 2.2);
        petAt = now + 11 + r() * 10;
      }
      if (host && now > hostAt) { if (Talk.count < 3) say(host, T().pick(host, r, () => true), 3); hostAt = now + 14 + r() * 12; }
      if (cfg.update) cfg.update(dt, fx);
      Talk.prune();
    }
    function draw() {
      const now = Talk.now, flick = 0.78 + Math.sin(now * 13) * 0.08 + Math.sin(now * 7.3) * 0.08;
      ctx.drawImage(cfg.bg, 0, 0);
      if (cfg.under) cfg.under(ctx, now, flick, still, fx);
      const things = cfg.props.map((p) => ({ key: p.key, draw: () => (p.cv ? ctx.drawImage(p.cv, 0, 0) : p.draw(ctx, now, flick, still, fx)) }));
      for (const a of actors) {
        const bob = a.mode === "walk" && !still ? Math.floor(now * 6 + a.u * 3) % 2 : 0;
        things.push({ key: a.u + a.v, draw: () => {
          if (a.npc) carried(ctx, st, a, now, still, false);
          T().drawActor(ctx, st, a, bob, now);
          if (a.npc) carried(ctx, st, a, now, still, true);
        } });
        if (a.pet) things.push({ key: a.pet.u + a.pet.v, draw: () => T().drawPet(ctx, st, a.pet, a.pet.moving && !still ? Math.floor(now * 6) % 2 : 0, now) });
      }
      things.sort((p, q) => p.key - q.key).forEach((t) => t.draw());
      if (cfg.over) cfg.over(ctx, now, flick, still, fx);
      T().drawMarker(ctx, st, focus, now);
      Talk.place();
    }
    const L = T().loop(wrap, (dt) => { if (dt) update(dt); draw(); }, cfg.onVisible);
    if (still) { say(focus, focus.lines[0], 999); L.redraw(); }
    cv.addEventListener("click", (ev) => {
      const k = cv.clientWidth / W, rect = cv.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) / k, my = (ev.clientY - rect.top) / k;
      const hit = actors.filter((a) => { const [x, y] = st.iso(a.u, a.v); return Math.abs(mx - x) < 9 && my < y && my > y - 34; }).sort((p, q) => q.u + q.v - (p.u + p.v))[0];
      const pet = !hit && actors.map((a) => a.pet).filter((p) => p).find((p) => { const [x, y] = st.iso(p.u, p.v); return Math.abs(mx - x) < 8 && my < y + 2 && my > y - 12; });
      if (hit) say(hit, T().pick(hit, r, cfg.pred), still ? 999 : 3.4);
      else if (pet) { pet.pat = Talk.now; if (pet.lines.length) say(pet, T().pick(pet, r, () => true), still ? 999 : 2.2); }
      else if (host && host.at && Math.abs(mx - host.at[0]) < 14 && Math.abs(my - host.at[1]) < 18) say(host, T().pick(host, r, () => true), still ? 999 : 3);
      L.redraw();
    });
    return wrap;
  }
  const notOrder = (t) => !t.startsWith("One ");

  // ---------- what a road companion brings: things on the ground beside them, and things they carry ----------
  const INK = "#16121a";
  // a shaded pixel ellipse lit from the upper left, with a dark outline unless o is false
  function blob(ctx, cx, cy, rx, ry, c, o) {
    for (let pass = o === false ? 1 : 0; pass < 2; pass++) {
      const ex = rx + (pass ? 0 : 1), ey = ry + (pass ? 0 : 1);
      for (let y = -Math.ceil(ey); y <= Math.ceil(ey); y++) for (let x = -Math.ceil(ex); x <= Math.ceil(ex); x++) {
        if ((x / ex) ** 2 + (y / ey) ** 2 > 1) continue;
        const l = x / rx + y / ry;
        ctx.fillStyle = pass ? (l < -0.7 ? c[0] : l > 0.6 ? c[2] : c[1]) : INK;
        ctx.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }
  const px = (ctx, x, y, c, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w || 1, h || 1); };
  function basket(ctx, x, y) {
    for (let j = 0; j < 6; j++) { const w = 5 - Math.floor(j / 3); px(ctx, x - w - 1, y - 6 + j, INK, w * 2 + 3); for (let i = -w; i <= w; i++) px(ctx, x + i, y - 6 + j, (i + j) % 2 ? "#a87a42" : j > 3 ? "#6e4a26" : "#8e6232"); }
    px(ctx, x - 6, y - 7, INK, 13); px(ctx, x - 5, y - 7, "#c49a5a", 11);
  }
  // [screen dx away from the fire, dy, painter(ctx, x, y, facing, now, companion x, companion y)]
  const GROUND_PROP = {
    handcart: [-25, -3, (ctx, x, y, f) => {
      const L = (dx) => x + dx * f;
      for (let i = 0; i < 8; i++) { px(ctx, L(4 + i), y - 8 + Math.round(i * 0.6), "#4a2e18"); px(ctx, L(4 + i), y - 5 + Math.round(i * 0.6), "#4a2e18"); }
      px(ctx, Math.min(L(-10), L(5)) - 1, y - 10, INK, 18, 7);
      for (let i = -10; i <= 5; i++) for (let j = 0; j < 5; j++) px(ctx, L(i), y - 9 + j, j === 0 ? "#a8784a" : j === 4 ? "#4a2e18" : (i + 20) % 4 === 0 ? "#5e3c22" : "#7a5232");
      blob(ctx, L(-6), y - 13, 3, 2, ["#d0745a", "#a84a3a", "#7a3026"]);
      blob(ctx, L(-1), y - 13, 2, 2, ["#7a9ac0", "#4e6e96", "#344c6e"]);
      blob(ctx, L(3), y - 12, 2, 1, ["#ece4d0", "#c8bca4", "#968a74"]);
      px(ctx, L(-11), y - 10, "#3a3a44", 1, 4); px(ctx, Math.min(L(-12), L(-11)), y - 7, "#5a5a66", 2, 1);
      blob(ctx, L(-3), y - 3, 3, 3, ["#8a6038", "#6a4426", "#4a2e18"]);
      px(ctx, L(-3), y - 3, "#c8a060"); px(ctx, L(-5), y - 3, "#4a2e18"); px(ctx, L(-1), y - 3, "#4a2e18"); px(ctx, L(-3), y - 5, "#4a2e18"); px(ctx, L(-3), y - 1, "#4a2e18");
    }],
    cow: [-31, 5, (ctx, x, y, f, now) => {
      const L = (dx) => x + dx * f, graze = now && Math.floor(now / 3.7) % 3 === 1 ? 2 : 0;
      for (const dx of [-5, -2, 3, 6]) { px(ctx, L(dx) - 1, y - 6, INK, 3, 6); px(ctx, L(dx), y - 6, dx < 0 ? "#bcb09c" : "#d4c8b4", 1, 5); px(ctx, L(dx), y - 1, "#2a2224"); }
      blob(ctx, x, y - 9, 8, 4, ["#f4eee0", "#dcd2c0", "#aa9c88"]);
      blob(ctx, L(-3), y - 10, 2, 2, ["#6a4630", "#5a3a26", "#432a1a"], false); blob(ctx, L(3), y - 8, 2, 1, ["#6a4630", "#5a3a26", "#432a1a"], false);
      px(ctx, L(-9), y - 10, "#aa9c88", 1, 5); px(ctx, Math.min(L(-9), L(-10)), y - 5, "#5a3a26", 2, 2);
      const hx = L(10), hy = y - 10 + graze;
      blob(ctx, hx, hy, 3, 2, ["#f4eee0", "#dcd2c0", "#aa9c88"]);
      px(ctx, Math.min(hx + 2 * f, hx + 3 * f), hy, "#d89a8a", 2, 2); px(ctx, hx + f, hy - 1, INK);
      px(ctx, hx - 2 * f, hy - 3, "#ece4cc"); px(ctx, hx - 3 * f, hy - 4, "#ece4cc"); px(ctx, hx + 1 * f, hy - 3, "#ece4cc"); px(ctx, hx + 2 * f, hy - 4, "#ece4cc");
      px(ctx, hx - 3 * f, hy - 1, "#bcb09c");
    }],
    pig: [-15, 6, (ctx, x, y, f, now) => {
      const L = (dx) => x + dx * f, sniff = now && Math.floor(now * 3) % 7 === 0 ? 1 : 0;
      for (const dx of [-3, -1, 2, 4]) px(ctx, L(dx), y - 2, INK, 1, 2);
      blob(ctx, x, y - 5, 5, 3, ["#f6c6b6", "#e49c8c", "#b8706a"]);
      blob(ctx, L(5), y - 6 + sniff, 2, 2, ["#f6c6b6", "#e49c8c", "#b8706a"]);
      px(ctx, Math.min(L(7), L(8)), y - 6 + sniff, "#c87a72", 2, 2); px(ctx, L(8), y - 6 + sniff, "#8a4a48");
      px(ctx, L(5), y - 7 + sniff, INK); px(ctx, L(4), y - 9 + sniff, "#c87a72"); px(ctx, L(3), y - 9 + sniff, "#b8706a");
      px(ctx, L(-6), y - 6, "#e49c8c"); px(ctx, L(-7), y - 7, "#e49c8c"); px(ctx, L(-6), y - 8, "#e49c8c");
    }],
    goose: [-17, 5, (ctx, x, y, f, now, cx, cy) => {
      const L = (dx) => x + dx * f, honk = now && Math.floor(now * 1.3) % 5 === 0 ? 1 : 0;
      const hx = cx - 7 * f, hy = cy - 9, nx = L(2), ny = y - 8;
      const n = Math.max(Math.abs(nx - hx), 1);
      for (let i = 0; i <= n; i++) { const t = i / n; px(ctx, Math.round(hx + (nx - hx) * t), Math.round(hy + (ny - hy) * t + Math.sin(t * Math.PI) * 2), "#e0d0a8"); }
      px(ctx, L(-1), y - 1, "#e8902a"); px(ctx, L(1), y - 1, "#e8902a");
      blob(ctx, x, y - 4, 3, 2, ["#fcf8ee", "#e4ded0", "#aca698"]);
      px(ctx, L(-4), y - 5, "#e4ded0");
      for (let j = 0; j < 4; j++) { px(ctx, Math.min(L(2), L(3)), y - 7 - j - honk, INK, 2, 1); px(ctx, L(2), y - 7 - j - honk, "#f4f0e4"); }
      blob(ctx, L(3), y - 11 - honk, 1, 1, ["#fcf8ee", "#e4ded0", "#aca698"]);
      px(ctx, Math.min(L(5), L(6)), y - 11 - honk, "#e8902a", 2, 1); px(ctx, L(3), y - 12 - honk, INK);
    }],
    fish: [-13, 4, (ctx, x, y) => {
      for (const [dx, h, c] of [[-4, 4, "#9ab0c0"], [0, 6, "#c4d6e0"], [3, 3, "#8aa2b4"]]) {
        px(ctx, x + dx - 1, y - 7 - h, INK, 4, h + 2); px(ctx, x + dx, y - 6 - h, c, 2, h); px(ctx, x + dx, y - 6 - h, "#e8f0f4", 1, 1);
        px(ctx, x + dx - 1, y - 8 - h, "#5a7080"); px(ctx, x + dx + 2, y - 8 - h, "#5a7080"); px(ctx, x + dx, y - 7 - h, "#5a7080", 2, 1);
      }
      basket(ctx, x, y);
    }],
    herbs: [-13, 4, (ctx, x, y) => {
      for (const [dx, h, c] of [[-3, 3, "#5a9a3a"], [-1, 5, "#4a7a2e"], [2, 4, "#6aaa46"], [4, 2, "#4a7a2e"]]) px(ctx, x + dx, y - 6 - h, c, 1, h);
      px(ctx, x - 1, y - 12, "#e8d870"); px(ctx, x + 2, y - 11, "#d8e8f0"); px(ctx, x - 4, y - 10, "#5a9a3a", 2, 1); px(ctx, x + 3, y - 9, "#6aaa46", 2, 1);
      basket(ctx, x, y);
    }],
    stone: [-13, 4, (ctx, x, y) => {
      px(ctx, x - 6, y - 8, INK, 12, 8);
      for (let j = 0; j < 6; j++) for (let i = 0; i < 10; i++) px(ctx, x - 5 + i, y - 7 + j, j === 0 ? "#b8b4ac" : i > 7 ? "#6e6a66" : (i * 3 + j) % 7 === 0 ? "#8e8a84" : "#9e9a92");
      px(ctx, x + 3, y - 10, "#7a5232", 1, 3); px(ctx, x + 2, y - 11, "#7a828c", 3, 1);
    }],
  };
  // things worn or carried, painted in the 28x34 figure's own pixels so they flip with it
  function carried(ctx, st, a, now, still, front) {
    const [fx, fy] = st.iso(a.u, a.v), x0 = Math.round(fx) - 14, y0 = Math.round(fy) - 33;
    const P = (sx, sy, c, w, h) => px(ctx, a.face > 0 ? x0 + sx : x0 + 28 - sx - (w || 1), y0 + sy, c, w || 1, h || 1);
    const B = (sx, sy, rx, ry, c, o) => blob(ctx, a.face > 0 ? x0 + sx : x0 + 27 - sx, y0 + sy, rx, ry, c, o);
    const k = a.npc.prop;
    if (!front) {
      if (k === "hive") {
        for (let j = 0; j < 13; j++) {
          const w = Math.round(Math.sqrt(1 - ((12 - j) / 13) ** 2) * 6);
          P(21 - w, 6 + j, INK, w * 2 + 3);
          for (let i = -w; i <= w; i++) P(22 + i, 6 + j, j % 3 === 2 ? "#9a7030" : i < -w / 3 ? "#ecc86e" : i > w / 2 ? "#b8883a" : "#d8ae52");
        }
        P(21, 16, "#3a2410", 2, 2);
      }
      if (k === "pot") {
        P(25, 0, "#7a5232", 1, 7); P(24, 0, "#9a7a52");
        B(22, 9, 5, 4, ["#e0a060", "#b8682e", "#7a4220"]);
        P(17, 5, INK, 11, 1); P(18, 5, "#f0c890", 9, 1);
      }
      return;
    }
    if (k === "hive" && !still) for (let i = 0; i < 3; i++) { const t = now * (1.4 + i * 0.3) + i * 2; P(22 + Math.round(Math.cos(t) * 8), 10 + Math.round(Math.sin(t * 1.7) * 5), i % 2 ? "#f0c840" : "#2a2010"); }
    if (k === "pots") { B(3, 22, 2, 2, ["#e0a060", "#c07a3a", "#8a5226"]); P(3, 19, "#4a4652", 1, 2); B(25, 21, 1, 2, ["#9a9aa4", "#6e6e7a", "#4a4a56"]); P(25, 18, "#4a4652", 1, 2); }
    if (k === "satchel") {
      for (let i = 0; i <= 8; i++) P(10 + i, 17 + Math.round(i * 0.8), "#5a3a20");
      P(17, 23, INK, 6, 6); P(18, 24, "#8e6a40", 4, 4); P(18, 24, "#a88050", 4, 1); P(18, 25, "#6e4e2e", 4, 1); P(20, 26, "#d8b45a");
    }
    if (k === "habit") { P(12, 22, "#d8c8a0", 1, 4); P(11, 26, "#d8c8a0", 2, 1); }
    if (k === "tallhat") {
      if (a.tip === undefined) {
        const g = a.right.getContext("2d").getImageData(0, 0, 28, 34).data;
        a.tip = null;
        for (let y = 0; y < 34 && !a.tip; y++) for (let x = 0; x < 28; x++) if (g[(y * 28 + x) * 4 + 3] > 0) { a.tip = [x, y]; break; }
      }
      if (a.tip) {
        const [tx, ty] = a.tip, sway = still ? 0 : Math.round(Math.sin(now * 1.3) * 0.8);
        for (let j = 0; j <= 11; j++) {
          const bend = j > 6 ? j - 6 + sway : 0, w = j < 5 ? 3 : j < 9 ? 2 : 1, x = tx - 1 - bend + (w < 3 ? 1 : 0);
          P(x - 1, ty - j, INK, w + 2);
          P(x, ty - j, j === 4 ? "#c8a040" : "#4a6a9a", w, 1);
          if (w > 1 && j !== 4) P(x + w - 1, ty - j, "#36507a");
        }
        P(tx - 7 - sway, ty - 12, "#e8d070");
      }
    }
  }

  // ---------- the camp ----------
  function camp(t, cast, seed, onVisible) {
    const st = T().stage(W, H, 100, 60);
    const r = Art.rng(Art.hash(seed + "camp"));
    const biome = t.biome || "plains";
    const starList = stars(r, biome === "forest" ? 34 : 56);
    let moon;
    const bg = layer(st, (ctx) => { moon = sky(ctx, r, biome); const g = GROUND[biome] || GROUND.plains; horizon(ctx, r, biome, g); ground(ctx, st, r, biome, t.road); });
    const props = [{ key: 10, cv: firepit(st, 5, 5) }];
    const cols = [["#8a6a4a", "#6a4e36", "#7a5c40"], ["#5a6a4a", "#46543a", "#50603f"], ["#8a4a3a", "#6a362a", "#7a4232"]];
    props.push({ key: -2.5 + 4.0 + 3.0, cv: tent(st, -2.5, 4.0, cols[Math.floor(r() * cols.length)]) });
    props.push({ key: 3.4 + 3.6, cv: log(st, 3.3, 3.4, 1.4, 0.35) });
    const rolls = [["#6a3a2a", "#4a2a1e", "#3a2016"], ["#3a5a6a", "#2a4250", "#22363f"], ["#6a6a3a", "#4a4a2a", "#3a3a22"]];
    fromScreen(5, 5, [[-8, 30], [40, 24], [-62, -4]]).slice(0, Math.max(1, cast.length)).forEach(([u, v], i) => props.push({ key: u + v + 0.6, cv: bedroll(st, u, v, rolls[i % 3]) }));
    const pine = { x: "#0c1610", a: "#1e3626", b: "#152a1e", t: "#2a1a10" }, rock = { x: "#16141c", a: "#5a5866", b: "#46444f" };
    const scatter = biome === "forest" ? [[0.2, 1.4, "p"], [1.6, -0.4, "p"], [9.8, 0.8, "p"], [-0.6, 4.5, "p"], [10.6, 3.6, "p"]] :
      biome === "hills" || biome === "snow" || biome === "volcanic" ? [[1.0, 1.0, "r"], [9.4, 2.2, "r"], [0.4, 9.4, "r"], [10.0, 7.2, "r"]] :
      biome === "plains" ? [[9.6, 1.0, "p"], [0.6, 2.0, "r"], [10.2, 8.6, "r"]] : [[1.0, 1.4, "r"], [9.4, 1.8, "r"]];
    for (const [u, v, k] of scatter.filter(([u, v]) => !(u > -3 && u < 0.6 && v > 3.4 && v < 6.4))) props.push({ key: u + v, cv: layer(st, (ctx) => { const [x, y] = st.iso(u, v); if (k === "p") pix(ctx, Math.round(x) - 6, Math.round(y) - 15, PINE, pine); else pix(ctx, Math.round(x) - 4, Math.round(y) - 4, ROCK, biome === "snow" ? { x: "#3a4258", a: "#c8d0e0", b: "#8a94b0" } : rock); }) });
    if (t.road) props.push({ key: 6 + 2.4, cv: layer(st, (ctx) => { const [x, y] = st.iso(6, 2.4); ctx.fillStyle = "#4a2e18"; ctx.fillRect(Math.round(x), Math.round(y) - 18, 2, 18); ctx.fillStyle = "#8a6038"; ctx.fillRect(Math.round(x) - 7, Math.round(y) - 17, 13, 4); ctx.fillStyle = "#5a3a20"; ctx.fillRect(Math.round(x) - 6, Math.round(y) - 15, 9, 1); }) });
    // a pot hung over the fire on a tripod
    const [fx0, fy0] = st.iso(5, 5), fcx = Math.round(fx0), fcy = Math.round(fy0);
    const steam = anim("smoke", { x: fcx, y: fcy - 19, n: 4, rise: 12, wind: 2, seed: 5 }), embers = anim("embers", { x0: fcx - 4, x1: fcx + 4, y: fcy - 10, n: 7, rise: 34, seed: 9 });
    props.push({ key: 10.2, draw: (ctx, now, flick, still, fx) => {
      const x = fcx, y = fcy;
      campfire(ctx, st, 5, 5, now, flick, still, 1.35);
      ctx.fillStyle = "#2a1a10"; for (let j = 0; j < 24; j++) { ctx.fillRect(x - 10 + Math.round(j * 0.4), y - j, 1, 1); ctx.fillRect(x + 10 - Math.round(j * 0.4), y - j, 1, 1); }
      ctx.fillRect(x, y - 24, 1, 6);
      ctx.fillStyle = "#1a181e"; ctx.fillRect(x - 4, y - 18, 9, 5); ctx.fillRect(x - 3, y - 13, 7, 1); ctx.fillStyle = "#4a4852"; ctx.fillRect(x - 4, y - 18, 9, 1); ctx.fillStyle = "#6a6872"; ctx.fillRect(x - 3, y - 17, 2, 1);
      if (steam) steam.draw(ctx, now);
      if (embers) embers.draw(ctx, now); else drawSparks(ctx, fx.sparks);
    } });
    // the crew's horses tethered at the edge of the firelight, and the wagon parked behind them
    const MA = window.MountArt;
    if (MA && t.wagon) {
      const [wx, wy] = st.iso(1.2, 8.6), pl = t.wagon.puller ? { kind: t.wagon.puller.kind, colour: t.wagon.puller.colour } : null;
      props.push({ key: 1.2 + 8.6, draw: (ctx, now, flick, still) => { MA.drawWagon(ctx, t.wagon.kind, Math.round(wx) - 20, Math.round(wy), 1, pl, still ? 0 : (Math.floor(now * 0.6) % 5 === 0 ? 1 : 0)); } });
    }
    if (MA) (t.mounts || []).slice(0, 4).forEach((m, i) => {
      const [u, v] = [[8.6, 1.4], [9.4, 3.0], [7.6, 0.4], [9.8, 4.6]][i];
      const [mx, my] = st.iso(u, v), ph = Art.hash(m.name || String(i)) % 7;
      props.push({ key: u + v, draw: (ctx, now, flick, still) => { MA.drawMount(ctx, m.kind, m.colour, Math.round(mx) - 12, Math.round(my), still ? 0 : (Math.floor(now * 0.8 + ph) % 4 === 0 ? 1 : 0), 1); } });
    });
    const night = [];
    if (biome === "forest" || biome === "plains") night.push(anim("fireflies", { x: 8, y: HZ + 12, w: 60, h: 40, n: 5, seed: 3 }), anim("fireflies", { x: 132, y: HZ + 20, w: 60, h: 50, n: 4, seed: 4 }));
    if (biome === "marsh") night.push(anim("wisp", { x: 140, y: HZ + 14, w: 50, h: 20, seed: 6 }), anim("fireflies", { x: 10, y: HZ + 30, w: 50, h: 40, n: 4, rgb: "160,255,200", seed: 7 }));
    const sky2 = [anim("twinkle", { pts: starList.filter((s) => s.b > 0.6).map((s) => [s.x, s.y]), seed: 2 })];
    if ((GROUND[biome] || {}).sea) sky2.push(anim("waves", { x0: 0, x1: W, y: HZ - 5, h: 6, rgb: "40,60,110", seed: 8 }));
    let shoot = null, shootAt = 6 + r() * 14;
    // a companion takes the place across the fire; the spot behind them is left for whatever they brought along
    const comp = t.companion && cast.length < 2 ? t.companion : null;
    const spots = fromScreen(5, 5, [[28, 4], [-28, 2], [-4, -24], [52, -16], [-54, 14], [24, -30]].filter((p, i) => !(comp && i === 4)));
    if (comp && GROUND_PROP[comp.prop]) {
      const [x0, y0] = st.iso(spots[1][0], spots[1][1]), [dx, dy, draw] = GROUND_PROP[comp.prop], f = x0 < st.iso(5, 5)[0] ? 1 : -1;
      const [pu, pv] = fromScreen(spots[1][0], spots[1][1], [[dx * f, dy]])[0];
      const x = Math.round(x0 + dx * f), y = Math.round(y0 + dy);
      props.push({ key: pu + pv, draw: (ctx, now, flick, still) => draw(ctx, x, y, f, still ? 0 : now, x0, y0) });
    }
    return gather({ talks: t.talk, kind: "camp", st, bg, props, cast, seed, center: [5, 5], spots, pred: notOrder, onVisible, npc: comp && Object.assign({ spot: 1 }, comp),
      update(dt, f) {
        const [x, y] = st.iso(5, 5);
        if (!embers) sparks(f.sparks, x, y - 10, dt, false);
        if (f.now > shootAt && !shoot) { shoot = { x: 20 + r() * 120, y: 4 + r() * 18, t: 0 }; shootAt = f.now + 18 + r() * 25; }
        if (shoot) { shoot.t += dt; if (shoot.t > 0.7) shoot = null; }
      },
      under(ctx, now, flick, still) {
        for (const s of starList) {
          const tw = still || sky2[0] ? s.b : (Math.sin(now * s.sp + s.ph) + 1) / 2 * s.b;
          if (tw < 0.15) continue;
          ctx.fillStyle = tw > 0.7 ? "#f8f0d8" : tw > 0.4 ? "#b8bcd8" : "#5a628a";
          ctx.fillRect(s.x, s.y, 1, 1);
        }
        drawAll(ctx, sky2, now);
        if (moon) glow(ctx, moon[0], moon[1], 3, 22, "240,232,200", 0.12);
        if (shoot) { for (let i = 0; i < 9; i++) { const px = shoot.x + (shoot.t * 90) - i * 2, py = shoot.y + shoot.t * 30 - i * 0.66; ctx.fillStyle = `rgba(248,240,216,${(1 - i / 9) * (1 - shoot.t / 0.7)})`; ctx.fillRect(Math.round(px), Math.round(py), 1, 1); } }
        if ((GROUND[biome] || {}).sea && moon) for (let i = 0; i < 6; i++) { const w = 2 + ((Math.floor(now * 2) + i) % 3); ctx.fillStyle = "rgba(240,232,200,0.5)"; ctx.fillRect(moon[0] - w / 2 + ((i * 7) % 5) - 2, HZ - 5 + i, w, 1); }
      },
      over(ctx, now, flick, still) {
        const [x, y] = st.iso(5, 5);
        glow(ctx, x, y - 4, 4, 70 + flick * 6, "255,160,70", 0.26 * flick);
        dark(ctx, x, y - 6, 38, 124, 0.6, "6,8,24");
        drawAll(ctx, night, now);
      } });
  }

  // ---------- a dungeon floor ----------
  const DEEP = {
    cave: { wall: ["#4a3e34", "#54463a", "#3e342c"], mortar: "#2a221c", floor: ["#3a322a", "#42382e", "#362e26"], seam: "#262018", tall: 7, wide: 1.8 },
    undead: { wall: ["#4a4a54", "#54545e", "#42424c"], mortar: "#24242c", floor: ["#3c3c44", "#44444c", "#36363e"], seam: "#22222a" },
    ice: { wall: ["#4a6a8a", "#5a7a9a", "#3e5e7e"], mortar: "#2a3e56", floor: ["#3e5670", "#486078", "#36506a"], seam: "#243848" },
    fire: { wall: ["#4a2a24", "#54302a", "#3e221e"], mortar: "#2a1210", floor: ["#3a2420", "#422a24", "#341e1a"], seam: "#5a2416", lava: true },
    swamp: { wall: ["#3e4a36", "#465440", "#36402e"], mortar: "#222a1c", floor: ["#34402c", "#3c4832", "#2e3826"], seam: "#1e2618" },
    sea: { wall: ["#3a4a54", "#42545e", "#34424c"], mortar: "#1e2a32", floor: ["#34444c", "#3c4c54", "#2e3c44"], seam: "#1c2830" },
  };
  function dungeon(t, cast, seed, onVisible) {
    const NU = 11, NV = 9, WH = 50, st = T().stage(W, H, 92, 58);
    const th = DEEP[t.theme] || DEEP[{ goblin: "cave", beast: "cave" }[t.theme]] || DEEP.cave;
    const r = Art.rng(Art.hash(seed + "deep"));
    const bg = walls(st, NU, NV, WH, bricks(th.wall, th.mortar, r, th.tall, th.wide), floorTiles(th.floor, th.seam), [th.mortar, th.mortar]);
    const bctx = bg.getContext("2d");
    // the stair further down, a dark hole in the back corner
    fp(bctx, [st.iso(8.2, 0.2), st.iso(10.4, 0.2), st.iso(10.4, 2.0), st.iso(8.2, 2.0)], "#08060a");
    for (let i = 0; i < 4; i++) fp(bctx, [st.iso(8.4, 0.4 + i * 0.4), st.iso(10.2, 0.4 + i * 0.4), st.iso(10.2, 0.55 + i * 0.4), st.iso(8.4, 0.55 + i * 0.4)], ["#3a3440", "#2c2832", "#201c26", "#16121a"][i]);
    if (t.theme === "undead") for (const v of [2.0, 5.0]) { fp(bctx, st.quad(st.lwall, v, v + 1.4, 18, 30), "#141218"); pix(bctx, Math.round(st.lwall(v + 0.6, 26)[0]) - 3, Math.round(st.lwall(v + 0.6, 26)[1]), [".xxx.", "xoxox", "xxxxx", ".x.x."], { x: "#c8c0b0", o: "#141218" }); }
    if (th.lava) for (let k = 0; k < 5; k++) { let u = 1 + r() * 9, v = 1 + r() * 7; for (let j = 0; j < 14; j++) { const [x, y] = st.iso(u, v); bctx.fillStyle = j % 3 ? "#e0601c" : "#ffb040"; bctx.fillRect(Math.round(x), Math.round(y), 1, 1); u += (r() - 0.3) * 0.25; v += (r() - 0.5) * 0.25; } }
    if (t.theme === "ice") for (let u = 0.5; u < NU; u += 0.9 + r()) { const p = st.rwall(u, WH - 3); bctx.fillStyle = "#a8c8e8"; for (let j = 0; j < 3 + Math.floor(r() * 5); j++) bctx.fillRect(p[0], p[1] + j, j < 2 ? 2 : 1, 1); }
    // a puddle under the drip
    const pu = 3.0, pv = 6.0;
    fp(bctx, [st.iso(pu - 0.8, pv), st.iso(pu, pv - 0.5), st.iso(pu + 0.8, pv), st.iso(pu, pv + 0.5)], t.theme === "fire" ? "#3a1410" : "#1a2230");
    pix(bctx, Math.round(st.iso(8.5, 7.5)[0]), Math.round(st.iso(8.5, 7.5)[1]) - 4, BONES, { x: "#b8b0a0", o: "#d8d0c0" });
    const props = [];
    const rolls = [["#6a3a2a", "#4a2a1e", "#3a2016"], ["#3a5a6a", "#2a4250", "#22363f"], ["#6a6a3a", "#4a4a2a", "#3a3a22"], ["#5a4a6a", "#40344e", "#342a40"]];
    fromScreen(5, 5, [[10, 30], [-30, 22], [44, 30], [-56, 2]]).slice(0, Math.max(1, cast.length)).forEach(([u, v], i) => props.push({ key: u + v + 0.6, cv: bedroll(st, u, v, rolls[i % 4]) }));
    props.push({ key: 1.4 + 1.0 + 1.2, cv: st.box(1.0, 0.6, 0.9, 0.9, 7, "#7a5a3a", "#5a3e24", "#4a321c") });
    props.push({ key: 2.2 + 0.6, cv: layer(st, (ctx) => { const [x, y] = st.iso(2.6, 0.6); T().barrel(ctx, Math.round(x), Math.round(y)); }) });
    props.push({ key: 10, cv: firepit(st, 5, 5) });
    props.push({ key: 10.1, draw: (ctx, now, flick, still, fx) => { campfire(ctx, st, 5, 5, now, flick * 0.75, still); drawSparks(ctx, fx.sparks); } });
    const drip = { t: 0, phase: "fall", y: 0, ring: 0 };
    const [dx, dyFloor] = st.iso(pu, pv);
    const eyes = { at: 9 + r() * 10, t: -1, x: 0, y: 0 };
    const tx = st.rwall(4.2, 26);
    const tf = anim("torch", { x: Math.round(tx[0]), y: Math.round(tx[1]) - 4, r: 30, seed: 3 });
    const deep = [anim("drip", { x: Math.round(dx), y0: Math.round(dyFloor) - 70, y1: Math.round(dyFloor), seed: 4, period: 3.1 }),
      anim("cobweb", { x: Math.round(st.iso(0, 0)[0]) + 1, y: Math.round(st.iso(0, 0)[1]) - WH + 3, size: 14, side: "r" }),
      t.theme === "cave" || t.theme === "beast" || t.theme === "goblin" ? anim("bat", { W, y0: 18, y1: 50, seed: 5 }) : null].filter(Boolean);
    const spots = fromScreen(5, 5, [[28, 4], [-28, 2], [-4, -24], [-48, 8], [50, 14]]);
    return gather({ talks: t.talk, kind: "dungeon", st, bg, props, cast, seed, center: [5, 5], spots, pred: notOrder, onVisible,
      update(dt, f) {
        const [x, y] = st.iso(5, 5);
        sparks(f.sparks, x, y - 6, dt, false, 4);
        drip.t += dt;
        if (drip.phase === "fall") { drip.y = Math.min(1, drip.t / 0.55); if (drip.t > 0.55) { drip.phase = "ring"; drip.t = 0; } }
        else if (drip.phase === "ring" && drip.t > 0.6) { drip.phase = "wait"; drip.t = 0; }
        else if (drip.phase === "wait" && drip.t > 2.2 + (Math.sin(f.now) + 1)) { drip.phase = "fall"; drip.t = 0; }
        if (f.now > eyes.at && eyes.t < 0) { eyes.t = 0; const left = r() < 0.5; eyes.x = left ? 8 + r() * 10 : W - 18 - r() * 10; eyes.y = 100 + r() * 30; }
        if (eyes.t >= 0) { eyes.t += dt; if (eyes.t > 3) { eyes.t = -1; eyes.at = f.now + 16 + r() * 18; } }
      },
      under(ctx, now, flick, still) {
        const top = dyFloor - 70;
        if (deep.length) drawAll(ctx, deep, now);
        else if (!still && drip.phase === "fall") { ctx.fillStyle = "#8ab0d8"; ctx.fillRect(Math.round(dx), Math.round(top + drip.y * 70) - 2, 1, 2); }
        if (!deep.length && !still && drip.phase === "ring") { const w = Math.round(1 + drip.t * 10); ctx.fillStyle = `rgba(160,200,230,${0.6 - drip.t})`; ctx.fillRect(Math.round(dx - w), Math.round(dyFloor), w * 2, 1); ctx.fillRect(Math.round(dx - w / 2), Math.round(dyFloor - 1), w, 1); }
        if (tf) { ctx.fillStyle = "#2a1a10"; ctx.fillRect(Math.round(tx[0]) - 1, Math.round(tx[1]) - 2, 4, 2); ctx.fillRect(Math.round(tx[0]), Math.round(tx[1]), 2, 5); tf.draw(ctx, now); glow(ctx, tx[0], tx[1] - 6, 2, 60, "255,170,80", 0.22 * flick); }
        else torch(ctx, tx[0], tx[1], now, flick);
      },
      over(ctx, now, flick, still) {
        const [x, y] = st.iso(5, 5);
        glow(ctx, x, y - 4, 4, 56, "255,150,60", 0.2 * flick);
        dark(ctx, (x + tx[0]) / 2, (y + tx[1]) / 2 + 4, 26 + flick * 4, 104, 0.88);
        if (eyes.t >= 0 && !still && Math.floor(eyes.t * 4) % 6 !== 5) { ctx.fillStyle = t.theme === "ice" ? "#a0e0ff" : "#e83a2a"; ctx.fillRect(Math.round(eyes.x), Math.round(eyes.y), 1, 1); ctx.fillRect(Math.round(eyes.x) + 3, Math.round(eyes.y), 1, 1); }
      } });
  }

  // ---------- a cell ----------
  function cell(t, cast, seed, onVisible) {
    const NU = 9, NV = 8, WH = 50, st = T().stage(W, H, 100, 56);
    const r = Art.rng(Art.hash(seed + "cell"));
    const bg = walls(st, NU, NV, WH, bricks(["#55525e", "#5e5b68", "#4c4a56"], "#2c2a34", r), floorTiles(["#45424c", "#4c4954", "#3e3c46"], "#2a2830"), ["#2c2a34", "#2c2a34"]);
    const b = bg.getContext("2d");
    fp(b, st.quad(st.rwall, 4.0, 5.6, 30, 40), "#0e1428");
    for (let u = 4.2; u < 5.6; u += 0.4) fp(b, st.quad(st.rwall, u, u + 0.1, 30, 40), "#2a2830");
    const m = st.rwall(4.4, 38); b.fillStyle = "#f0e8c0"; b.fillRect(m[0], m[1], 2, 2);
    // the moonlight falls through the window onto the floor
    fp(b, [st.iso(4.0, 0), st.iso(5.6, 0), st.iso(7.4, 4.2), st.iso(5.8, 4.2)], (x, y) => ((x + y) % 2 ? "rgba(170,190,240,0.2)" : "rgba(170,190,240,0.14)"));
    for (let k = 0; k < 6; k++) { const p = st.lwall(1 + r() * 6, 8 + r() * 30); b.fillStyle = "#3a3842"; for (let j = 0; j < 4; j++) b.fillRect(p[0] + j * 2, p[1], 1, 4); b.fillRect(p[0] - 1, p[1] + 2, 9, 1); }
    const props = [];
    props.push({ key: 1.2 + 4.0 + 1, cv: st.box(0.3, 3.0, 2.2, 1.6, 2, "#b89848", "#8a6a30", "#6e5428") });
    props.push({ key: 6.8 + 1.0, cv: layer(st, (ctx) => { const [x, y] = st.iso(6.8, 0.6); pix(ctx, Math.round(x) - 3, Math.round(y) - 5, BUCKET, { x: "#2a1a10", b: "#6a4a2a", c: "#4a3420" }); }) });
    const rat = { u: 0.4, v: 7.5, dir: -1, t: 0, at: 5 + r() * 8 };
    const arat = anim("quad", { x0: Math.round(st.iso(0.6, 7.6)[0]), x1: Math.round(st.iso(3.4, 7.6)[0]), y: Math.round(st.iso(2, 7.6)[1]), kind: "rat", seed: 6 });
    if (arat) props.push({ key: 9.6, draw: (ctx, now) => arat.draw(ctx, now) });
    else props.push({ key: 0, draw: (ctx, now, flick, still) => { if (rat.t <= 0 || still) return; const [x, y] = st.iso(rat.u, rat.v); ctx.fillStyle = "#3a3038"; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 2); ctx.fillStyle = "#5a5058"; ctx.fillRect(Math.round(x) + (rat.dir > 0 ? 2 : -3), Math.round(y) - 2, 1, 1); ctx.fillRect(Math.round(x) + (rat.dir > 0 ? -3 : 2), Math.round(y) - 1, 2, 1); } });
    const bars = layer(st, (ctx) => {
      for (let v = 0.2; v <= NV; v += 0.55) { const [x, y] = st.iso(NU, v); ctx.fillStyle = "#1a1820"; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 52, 3, 52); ctx.fillStyle = "#6a6876"; ctx.fillRect(Math.round(x), Math.round(y) - 52, 1, 52); }
      for (const h of [8, 46]) fp(ctx, [st.up(st.iso(NU, 0), h), st.up(st.iso(NU, NV), h), st.up(st.iso(NU, NV), h + 2), st.up(st.iso(NU, 0), h + 2)], "#4a4854");
    });
    const gate = st.iso(NU + 0.6, 5.5);
    const host = t.host && Object.assign({}, t.host, { at: [gate[0] + 10, gate[1] - 40] });
    return gather({ talks: t.talk, kind: "cell", st, bg, props, cast, seed, center: [4, 4], spots: fromScreen(4, 4, [[-12, 0], [-40, 10], [10, 18]]), pred: notOrder, host, onVisible,
      update(dt, f) {
        if (rat.t <= 0 && f.now > rat.at) { rat.t = 0.01; rat.u = 0.4; rat.v = rat.dir > 0 ? 0.6 : 7.4; }
        if (rat.t > 0) { rat.t += dt; rat.v += rat.dir * dt * 3; if (rat.v < 0.5 || rat.v > 7.6) { rat.t = 0; rat.dir = -rat.dir; rat.at = f.now + 14 + r() * 14; } }
      },
      over(ctx, now, flick) {
        ctx.drawImage(bars, 0, 0);
        glow(ctx, gate[0] + 12, gate[1] - 30, 4, 60, "255,190,100", 0.18 + 0.04 * flick);
        dark(ctx, 92, 90, 46, 130, 0.42, "6,6,20");
      } });
  }

  // ---------- rooms: the stables, a rented room, the best suite, a home ----------
  // each price tier is its own room: a plain board room upstairs, a papered suite with a four-poster, a cottage
  // round its cooking fire, a townhouse study, a manor bedchamber, or straw beside the horses
  const PACK = ["..rrrr..", ".rRRRRr.", "..rrrr..", ".bbbbbb.", "bBBBBBBb", "bBsgsBBb", "bBBsBBBb", "bBBBBBBb", "bBBBBBBb", ".bbbbbb."];
  const BOOTS = [".bb..bb", ".bB..bB", ".bB..bB", "bbB.bbB", "ooo.ooo"];
  const CLOAK = ["....p....", "...ooo...", "..ohhho..", "..ohdho..", ".oCChCCo.", ".oCcCcCo.", ".oCcCcCo.", "oCCcCcCCo", "oCCcCcCCo", "oCcCCcCCo", "ooooooooo"];
  const CAT = [["......o.o.", ".oooo.oOo.", "oOOOOooOOo", "oOOOOOOOOo", "oTOOOOOOo.", ".oTTooooo."], ["..........", "......o.o.", ".ooooooOo.", "oOOOOOOOOo", "oTOOOOOOOo", ".oTToooooo"]];
  const SADDLE = ["..o.......o..", ".oHo.....oHo.", ".oHHooooHHSo.", "..oSHHHHSSo..", "..oSSSSSSSo..", "...oFFFFFo...", "...oFFFFFo...", "....oFFFo....", ".....oLo.....", ".....mmm.....", ".....m.m.....", ".....mmm....."];
  const ARMOUR = ["....ooo....", "...oHHHo...", "...oHvho...", "...oHHho...", "....oho....", ".ooHHHHhoo.", "oHHHHHHHhho", "oHhoHHHhoho", "oHhoHHHhoho", "oHhoHgHhoho", ".oo.oHho.oo", "....ohho...", "...oHHHho..", "...oHhoho..", "...oHo.oho.", "...oHo.oho.", "...oHo.oho.", "...oHo.oho.", "..oHHo.ohho", "..ooooooooo", "..wwwwwwww.", "..WWWWWWWW."];
  const BRIDLE = ["..ooo..", ".o...o.", "o.....o", "o.....o", ".o...o.", "..omo..", "...m...", "...m..."];
  const FORK = ["x.x.x", "x.x.x", "x.x.x", "xxxxx", "..s..", "..s..", "..s..", "..s..", "..s..", "..s..", "..s..", "..s..", "..s..", "..s..", "..s..", "..s..", "..s..", "..s.."];

  // where a pixel sits on a vertical plane: v = vc (faces down-left) or u = uc (faces down-right)
  const onV = (st, vc) => (x, y) => { const u = (x + 0.5 - st.OX) / 8 + vc; return [u, st.OY + (u + vc) * 4 - y - 0.5]; };
  const onU = (st, uc) => (x, y) => { const v = uc - (x + 0.5 - st.OX) / 8; return [v, st.OY + (uc + v) * 4 - y - 0.5]; };
  const qV = (st, vc, u0, u1, h0, h1) => [st.up(st.iso(u0, vc), h0), st.up(st.iso(u1, vc), h0), st.up(st.iso(u1, vc), h1), st.up(st.iso(u0, vc), h1)];
  const qU = (st, uc, v0, v1, h0, h1) => [st.up(st.iso(uc, v0), h0), st.up(st.iso(uc, v1), h0), st.up(st.iso(uc, v1), h1), st.up(st.iso(uc, v0), h1)];
  const topUV = (st, z) => (x, y) => st.toUV(x, y + z);
  const hashc = (a, b, n) => Math.floor(Math.abs(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1 * n);

  // walls: boards (a plain rented room), papered over panelling (suite, townhouse, manor), timber-framed whitewash (cottage)
  function boardWall(cols, seam, rail) {
    return (st, side) => (x, y) => {
      const [a, h] = side === "l" ? st.onL(x, y) : st.onR(x, y), lt = side === "r" ? 0.05 : -0.06, S = T().shade;
      if (rail && h > 12.5 && h < 15) return S(rail, h > 13.8 ? 0.22 + lt : lt);
      const k = Math.floor(a * 2.4);
      if (Math.abs(a * 2.4 - Math.round(a * 2.4)) < 0.07) return seam;
      const knot = (Math.floor(h * 0.5) * 7 + k * 13) % 37 === 0 && h % 2 < 1;
      return S(cols[((k % cols.length) + cols.length) % cols.length], knot ? -0.35 : lt + (Math.sin(h * 0.9 + k * 3) > 0.85 ? -0.08 : 0));
    };
  }
  function paperWall(WH, o) {
    return (st, side) => (x, y) => {
      const [a, h] = side === "l" ? st.onL(x, y) : st.onR(x, y), lt = side === "r" ? 0.05 : -0.07, S = T().shade, wh = o.wains;
      if (h >= WH - 5) return S(o.crown, h >= WH - 1.5 ? 0.3 : h < WH - 4 ? -0.25 : lt);
      if (h < wh) {
        if (h > wh - 2) return S(o.panel, 0.25 + lt);
        if (h < 2) return S(o.panel, -0.35);
        const f = a * 1.25 - Math.floor(a * 1.25);
        if (f < 0.07 || h < 3.5 || h > wh - 3.5) return S(o.panel, lt);
        if (f < 0.12 || h > wh - 4.5) return S(o.panel, -0.3);
        if (f > 0.93 || h < 4.5) return S(o.panel, 0.12 + lt);
        return S(o.panel, -0.12 + lt);
      }
      const [p0, p1] = o.paper;
      if (o.motif === "stripe") return S(Math.floor(a * 2.5) % 2 ? p0 : p1, lt + (Math.floor(a * 5) % 2 && Math.floor(a * 2.5) % 2 === 0 ? -0.04 : 0));
      const du = a * 1.25 - Math.floor(a * 1.25) - 0.5, dh = (h - wh) / 8 - Math.floor((h - wh) / 8) - 0.5, d = Math.abs(du) + Math.abs(dh);
      if (o.motif === "damask") {
        if (d < 0.14 || (Math.abs(du) < 0.05 && Math.abs(dh) < 0.3) || (Math.abs(dh) < 0.06 && Math.abs(du) < 0.25)) return S(p1, lt + 0.1);
        return S(p0, lt + ((x + y) % 2 ? 0 : -0.03));
      }
      if (Math.abs(d - 0.48) < 0.05) return S(p1, lt);
      if (d < 0.07) return S(p1, lt - 0.1);
      return S(p0, lt);
    };
  }
  function timberWall(WH) {
    return (st, side) => (x, y) => {
      const [a, h] = side === "l" ? st.onL(x, y) : st.onR(x, y), lt = side === "r" ? 0.05 : -0.06, S = T().shade, wood = "#5a3a20";
      const bay = 2.7, p = a / bay - Math.floor(a / bay), pa = p * bay;
      if (pa < 0.18 || h < 3 || (h > 21 && h < 23.5) || h > WH - 4) return S(wood, (h > 21 && h < 22) || h > WH - 1 ? 0.25 : pa < 0.06 ? 0.15 : lt);
      if (h < 21 && Math.abs((h - 3) - (pa - 0.18) * 7.4) < 1.3) return S(wood, lt - 0.05);
      const n = (Math.floor(x) * 7 + Math.floor(y) * 13) % 23;
      return S(n === 0 ? "#c8bca0" : n === 5 ? "#e4dac4" : "#d8ccb2", lt);
    };
  }
  // floors: boards, basket-weave parquet, scrubbed wide boards
  function boardFloor(cols, seam) {
    return (st) => (x, y) => {
      const [u, v] = st.toUV(x, y), row = Math.floor(v * 2);
      if (Math.abs(v * 2 - Math.round(v * 2)) < 0.07 || Math.abs(((u + row * 1.7) % 3)) < 0.05) return seam;
      const grain = Math.sin(u * 9 + row * 4) > 0.9 ? -0.08 : 0;
      return T().shade(cols[((row % cols.length) + cols.length) % cols.length], grain);
    };
  }
  function parquet(c0, c1, seam) {
    return (st) => (x, y) => {
      // seams sit on quarter tiles, where pixel centres fall, so they draw as unbroken lines
      const [u, v] = st.toUV(x, y), cu = Math.floor(u), cv = Math.floor(v), along = (cu + cv) % 2;
      const f = along ? v - cv : u - cu, g = along ? u : v, s = Math.floor(f * 4);
      if (Math.abs(f * 4 - Math.round(f * 4)) < 0.14 || Math.abs(g - Math.round(g)) < 0.035) return seam;
      return (s + cu + cv) % 2 ? c1 : c0;
    };
  }
  function strawFloor() {
    return (st) => (x, y) => {
      const [u, v] = st.toUV(x, y), n = Math.sin(x * 12.1 + y * 3.7) + Math.sin(x * 2.3 - y * 9.1) + Math.sin(u * 3 + v * 5) * 0.5;
      if (n > 1.5) return "#c8a850";
      if (n > 0.6) return "#a88a40";
      if (n > -0.5) return "#8e7034";
      return n > -1.3 ? "#7a5e2c" : "#5e4622";
    };
  }

  // a bed with its head to the left wall; o: {wood, quilt: [base, alt, trim], pattern, head, foot, posts, canopy: [c, d]}
  function bedPiece(st, u, v, du, dv, o) {
    const { slab, legs, shade, line } = T();
    // two layers: the bed itself, and the posts, canopy and curtains on its near side, which draw in front of whoever is in it
    const back = st.canvas(), front = o.posts ? st.canvas() : null;
    let ctx = back.getContext("2d");
    {
      const wood = o.wood, hz = o.head, cz = 40, [q0, q1, trim] = o.quilt;
      if (o.posts) {
        for (const [pu, pv] of [[u - 0.16, v - 0.04], [u + du - 0.1, v - 0.04]]) slab(ctx, st, pu, pv, 0.14, 0.14, cz, wood);
        const [c, d] = o.canopy, f = onV(st, v - 0.02);
        fp(ctx, qV(st, v - 0.02, u, u + du - 0.1, 10, cz), (x, y) => { const [a] = f(x, y), k = Math.floor(a * 7) % 3; return k === 0 ? d : k === 1 ? c : shade(c, 0.1); });
      }
      slab(ctx, st, u - 0.16, v - 0.04, 0.16, dv + 0.08, hz, { base: wood, right: (x, y) => {
        const [vv, h] = onU(st, u)(x, y), f = (vv - v) / dv;
        if (h > hz - 2.5 || f < 0.08 || f > 0.92 || h < 9) return shade(wood, -0.1);
        return f < 0.12 || f > 0.88 || h > hz - 4 ? shade(wood, -0.38) : shade(wood, -0.2);
      } });
      if (o.arch) slab(ctx, st, u - 0.16, v + dv * 0.25, 0.16, dv * 0.5, 3, wood, hz);
      legs(ctx, st, u, v, du, dv, 4, shade(wood, -0.1));
      slab(ctx, st, u, v, du, dv, 4, wood, 3);
      slab(ctx, st, u + 0.03, v + 0.03, du - 0.08, dv - 0.06, 3, { base: "#d8ccb4", top: "#ece2cc" }, 7, false);
      const n = dv > 1.6 ? 2 : 1, pw = (dv - 0.24) / n;
      for (let i = 0; i < n; i++) {
        slab(ctx, st, u + 0.1, v + 0.12 + i * pw + 0.03, 0.55, pw - 0.06, 3, { base: "#e0d6c2", top: "#f6f0e2", left: "#d6ccb6", right: "#c4b8a0" }, 10);
        const [x, y] = st.up(st.iso(u + 0.38, v + 0.12 + (i + 0.5) * pw), 13); ctx.fillStyle = "#d2c6ae"; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 1);
      }
      const qu = u + 0.78, top = topUV(st, 11);
      const pat = (x, y) => {
        const [a, b] = top(x, y);
        if (o.pattern === "patch") {
          const pu = Math.floor(a * 2.2), pv = Math.floor(b * 2.2);
          if (Math.abs(a * 2.2 - Math.round(a * 2.2)) < 0.07 || Math.abs(b * 2.2 - Math.round(b * 2.2)) < 0.07) return "#e8dcc0";
          return ["#a84a32", "#d8b860", "#5a7a4a", "#c88a5a", "#4a6a8a", "#e0d4b8", "#8a3a2a"][hashc(pu, pv, 7)];
        }
        if (trim && (b < v + 0.14 || b > v + dv - 0.14 || a > u + du - 0.12)) return trim;
        const da = a * 3 - Math.floor(a * 3) - 0.5, db = b * 3 - Math.floor(b * 3) - 0.5;
        if (Math.abs(Math.abs(da) + Math.abs(db) - 0.45) < 0.07) return q1;
        return q0;
      };
      const side = (k) => (x, y) => (trim && (x + y) % 6 === 0 ? trim : shade(q0, k));
      slab(ctx, st, qu, v - 0.05, du - qu + u + 0.04, dv + 0.1, 7, { base: q0, top: pat, left: side(-0.08), right: side(-0.32) }, 4);
      slab(ctx, st, qu, v - 0.05, 0.24, dv + 0.1, 1, { base: "#e8dece", top: "#f6f0e2", left: "#ddd2be", right: "#c8bca4" }, 11, false);
      line(ctx, st.up(st.iso(qu + 0.24, v + dv + 0.05), 12), st.up(st.iso(qu + 0.24, v - 0.05), 12), shade(q0, -0.2));
      const fz = o.foot;
      slab(ctx, st, u + du - 0.04, v - 0.04, 0.14, dv + 0.08, fz, { base: wood, right: (x, y) => {
        const [vv, h] = onU(st, u + du + 0.1)(x, y), f = (vv - v) / dv;
        return h > fz - 2.5 || f < 0.08 || f > 0.92 || h < 4 ? shade(wood, -0.18) : f < 0.13 || f > 0.87 || h > fz - 4 ? shade(wood, -0.45) : shade(wood, -0.3);
      } });
      if (o.posts) {
        const [c, d] = o.canopy;
        ctx = front.getContext("2d");
        slab(ctx, st, u - 0.16, v + dv - 0.1, 0.14, 0.14, cz, wood);
        slab(ctx, st, u + du - 0.06, v + dv - 0.1, 0.14, 0.14, cz, wood);
        slab(ctx, st, u - 0.2, v - 0.08, du + 0.32, dv + 0.2, 3, { base: c, top: shade(c, -0.15) }, cz);
        const drape = (plane, a0, a1) => (x, y) => {
          const [a, h] = plane(x, y), sc = Math.abs(Math.sin((a - a0) * Math.PI * 3.2));
          if (h < cz - 6 + sc * 2.5) return null;
          return trim && h < cz - 4.5 + sc * 2.5 ? trim : Math.floor(a * 9) % 2 ? c : shade(c, -0.12);
        };
        fp(ctx, qV(st, v + dv + 0.12, u - 0.2, u + du + 0.12, cz - 7, cz), drape(onV(st, v + dv + 0.12), u - 0.2));
        fp(ctx, qU(st, u + du + 0.12, v - 0.08, v + dv + 0.12, cz - 7, cz), drape(onU(st, u + du + 0.12), v - 0.08));
        const tied = (plane, a0, a1, toward) => (x, y) => {
          const [a, h] = plane(x, y), t = Math.abs(h - 18) / 22, w = 0.12 + t * (a1 - a0 - 0.12);
          if ((toward > 0 ? a1 - a : a - a0) > w) return null;
          if (Math.abs(h - 18) < 1) return trim || shade(c, -0.4);
          return Math.floor(a * 14) % 3 === 0 ? d : Math.floor(a * 14) % 3 === 1 ? c : shade(c, 0.12);
        };
        fp(ctx, qV(st, v + dv + 0.06, u + du - 0.5, u + du + 0.08, 3, cz - 2), tied(onV(st, v + dv + 0.06), u + du - 0.5, u + du + 0.08, 1));
        fp(ctx, qV(st, v + dv + 0.06, u - 0.16, u + 0.36, 3, cz - 2), tied(onV(st, v + dv + 0.06), u - 0.16, u + 0.36, -1));
        fp(ctx, qU(st, u + du + 0.08, v - 0.04, v + 0.5, 3, cz - 2), tied(onU(st, u + du + 0.08), v - 0.04, v + 0.5, -1));
      }
    }
    return { back, front };
  }

  // a tall piece against the right wall (front faces down-left): wardrobe, bookcase, dresser, clock
  function cabinet(st, u, v, du, dv, h, wood, front) {
    const { slab, shade } = T();
    return layer(st, (ctx) => {
      slab(ctx, st, u, v, du, dv, h, { base: wood, left: front ? front(onV(st, v + dv)) : wood });
      slab(ctx, st, u - 0.06, v, du + 0.12, dv + 0.08, 2, shade(wood, 0.1), h);
    });
  }
  const doors = (u0, u1, h, wood) => (f) => (x, y) => {
    const [a, hh] = f(x, y), S = T().shade, m = (u0 + u1) / 2, e = Math.min(a - u0, u1 - a, Math.abs(a - m));
    if (hh < 3) return S(wood, -0.35);
    if (Math.abs(a - m) < 0.1 && Math.abs(hh - h * 0.55) < 1.5) return "#c8a040";
    if (e < 0.08 || hh < 5 || hh > h - 3) return wood;
    if (e < 0.14 || hh > h - 5) return S(wood, -0.35);
    return S(wood, -0.15);
  };
  const books = (u0, u1, h, wood, r) => {
    const cols = ["#7a2a20", "#2e4a6a", "#3e5a32", "#8a6a2a", "#5a3a20", "#a8885a", "#6a2a2a"];
    const shelfH = 7, spine = new Map();
    return (f) => (x, y) => {
      const [a, hh] = f(x, y), S = T().shade;
      if (a - u0 < 0.1 || u1 - a < 0.1 || hh < 2 || hh > h - 2) return wood;
      const row = Math.floor((hh - 2) / shelfH), inRow = (hh - 2) - row * shelfH;
      if (inRow < 1.2) return S(wood, 0.1);
      const bi = Math.floor((a - u0) * 9), key = row * 100 + bi;
      if (!spine.has(key)) spine.set(key, [cols[Math.floor(r() * cols.length)], 3 + r() * 3.2, r() < 0.12]);
      const [c, tall, gap] = spine.get(key);
      if (gap || inRow > 1.2 + tall) return S(wood, -0.55);
      return (a - u0) * 9 - bi < 0.25 ? S(c, -0.25) : inRow > tall - 0.2 ? S(c, 0.2) : c;
    };
  };
  function chest(st, u, v, du, dv, wood, band) {
    const { slab, shade, line } = T();
    return layer(st, (ctx) => {
      slab(ctx, st, u, v, du, dv, 5, wood);
      slab(ctx, st, u - 0.03, v - 0.03, du + 0.06, dv + 0.06, 2.5, shade(wood, 0.08), 5);
      for (const f of [0.2, 0.8]) { line(ctx, st.iso(u + du * f, v + dv + 0.03), st.up(st.iso(u + du * f, v + dv + 0.03), 7.5), band); }
      for (const f of [0.25, 0.75]) line(ctx, st.iso(u + du + 0.03, v + dv * f), st.up(st.iso(u + du + 0.03, v + dv * f), 7.5), shade(band, -0.3));
      const [x, y] = st.up(st.iso(u + du / 2, v + dv + 0.03), 5); ctx.fillStyle = "#e0b850"; ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 2);
    });
  }
  function chair(st, u, v, wood, cloth, arms) {
    const { slab, legs, shade } = T();
    return layer(st, (ctx) => {
      slab(ctx, st, u, v, 0.18, 0.7, arms ? 16 : 13, wood);
      if (cloth) slab(ctx, st, u + 0.05, v + 0.08, 0.14, 0.54, arms ? 9 : 6, { base: cloth, top: shade(cloth, 0.1) }, 5, false);
      legs(ctx, st, u, v, 0.7, 0.7, 5, wood, 0.06);
      slab(ctx, st, u, v, 0.7, 0.7, 2, cloth ? { base: shade(cloth, -0.1), top: cloth } : wood, 4);
      if (arms) for (const av of [v, v + 0.58]) slab(ctx, st, u, av, 0.66, 0.12, 4, cloth || wood, 6);
    });
  }
  function rugPaint(ctx, st, u0, v0, u1, v1, o) {
    const { shade } = T();
    fp(ctx, [st.iso(u0, v0), st.iso(u1, v0), st.iso(u1, v1), st.iso(u0, v1)], (x, y) => {
      const [u, v] = st.toUV(x, y), e = Math.min(u - u0, u1 - u, v - v0, v1 - v);
      if (o.oval) {
        const nu = (u - (u0 + u1) / 2) / ((u1 - u0) / 2), nv = (v - (v0 + v1) / 2) / ((v1 - v0) / 2), d = nu * nu + nv * nv;
        if (d > 1) return null;
        return o.cols[Math.floor(Math.sqrt(d) * 7 + (Math.floor((x + y * 2) / 3) % 2) * 0.5) % o.cols.length];
      }
      if (e < 0.12) return (Math.floor(u * 6) + Math.floor(v * 6)) % 2 ? o.fringe : null;
      if (e < 0.32) return Math.abs(e - 0.22) < 0.04 ? o.edge2 : o.edge;
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, d = Math.abs(u - cu) / (u1 - u0) + Math.abs(v - cv) / (v1 - v0);
      if (Math.abs(d - 0.3) < 0.025) return o.edge2;
      if (d < 0.3) return d < 0.08 ? o.edge : (Math.floor(u * 3) + Math.floor(v * 3)) % 2 ? o.c1 : shade(o.c1, -0.1);
      return (Math.floor(u * 2.5) + Math.floor(v * 2.5)) % 2 ? o.c0 : shade(o.c0, -0.08);
    });
  }
  function painting(ctx, st, side, a0, a1, h0, h1, gold, scene) {
    const f = side === "l" ? st.lwall : st.rwall, { shade } = T();
    fp(ctx, st.quad(f, a0 - 0.18, a1 + 0.18, h0 - 2.5, h1 + 2.5), shade(gold, -0.35));
    fp(ctx, st.quad(f, a0 - 0.12, a1 + 0.12, h0 - 1.8, h1 + 1.8), (x, y) => ((x + y) % 3 ? gold : shade(gold, 0.3)));
    const span = side === "l" ? (x, y) => st.onL(x, y) : (x, y) => st.onR(x, y);
    fp(ctx, st.quad(f, a0, a1, h0, h1), (x, y) => { const [a, h] = span(x, y); return scene((a - a0) / (a1 - a0), (h - h0) / (h1 - h0), x, y); });
  }
  const landscape = (fx, fy, x, y) => {
    if (fy < 0.3) return (x + y) % 5 ? "#4a5a2e" : "#3e4e26";
    if (fy < 0.42 + Math.sin(fx * 7) * 0.1) return "#5a6a4a";
    if (Math.abs(fx - 0.7) < 0.08 && Math.abs(fy - 0.8) < 0.08) return "#f0d890";
    return fy > 0.75 ? "#8aa0b8" : "#a8b8c0";
  };
  const portrait = (fx, fy) => {
    const dx = fx - 0.5, dy = fy - 0.62;
    if (dx * dx * 4 + dy * dy * 6 < 0.08) return fy > 0.7 ? "#4a3020" : "#d8a87a";
    if (fy < 0.42 && Math.abs(dx) < 0.36) return fy < 0.1 ? "#1e2a22" : "#2e4a36";
    return fy > 0.5 ? "#2a1e16" : "#3a2a1e";
  };
  function wallSprite(ctx, st, side, a, h, rows, pal) {
    const p = side === "l" ? st.lwall(a, h) : st.rwall(a, h);
    pix(ctx, Math.round(p[0]) - (rows[0].length >> 1), Math.round(p[1]), rows, pal);
  }
  function door(ctx, st, v0, v1, top, wood, iron) {
    const { shade, line } = T(), f = (x, y) => st.onL(x, y);
    fp(ctx, st.quad(st.lwall, v0 - 0.18, v1 + 0.18, 0, top + 2.5), shade(wood, -0.45));
    fp(ctx, st.quad(st.lwall, v0, v1, 0, top), (x, y) => {
      const [a, h] = f(x, y), k = Math.floor((a - v0) * 3.2);
      if (Math.abs((a - v0) * 3.2 - Math.round((a - v0) * 3.2)) < 0.08) return shade(wood, -0.3);
      if (iron && (Math.abs(h - top * 0.25) < 1 || Math.abs(h - top * 0.78) < 1) && a < v1 - 0.25) return iron;
      return shade(wood, k % 2 ? -0.05 : -0.12);
    });
    const kn = st.lwall(v1 - 0.18, top * 0.48); ctx.fillStyle = "#c8a040"; ctx.fillRect(Math.round(kn[0]), Math.round(kn[1]), 1, 2);
    line(ctx, st.lwall(v0 - 0.18, top + 2.5), st.lwall(v1 + 0.18, top + 2.5), shade(wood, 0.1));
  }
  function shelfOn(ctx, st, r, a0, a1, h, wood, things) {
    const { slab } = T();
    slab(ctx, st, a0, 0, a1 - a0, 0.32, 2, wood, h - 2);
    for (let a = a0 + 0.2; a < a1 - 0.15; a += 0.42 + r() * 0.12) {
      const p = st.rwall(a, h), x = Math.round(p[0]) + 1, y = Math.round(p[1]) + 1, k = things[Math.floor(r() * things.length)];
      if (k === "plate") { ctx.fillStyle = "#d8d0c0"; ctx.fillRect(x - 1, y - 5, 4, 5); ctx.fillStyle = "#4a6a8a"; ctx.fillRect(x, y - 4, 2, 3); ctx.fillStyle = "#f0e8d8"; ctx.fillRect(x - 1, y - 5, 1, 5); }
      else if (k === "crock") { ctx.fillStyle = "#8a6a4a"; ctx.fillRect(x - 1, y - 4, 4, 4); ctx.fillStyle = "#b08a5e"; ctx.fillRect(x - 1, y - 4, 1, 4); ctx.fillStyle = "#e8dcc0"; ctx.fillRect(x - 1, y - 5, 4, 1); }
      else if (k === "jar") { ctx.fillStyle = "#6a8a5a"; ctx.fillRect(x, y - 5, 3, 5); ctx.fillStyle = "#9ab88a"; ctx.fillRect(x, y - 4, 1, 3); ctx.fillStyle = "#8a5a30"; ctx.fillRect(x, y - 6, 3, 1); }
      else if (k === "book") { const c = ["#7a2a20", "#2e4a6a", "#3e5a32", "#8a6a2a"][Math.floor(r() * 4)]; ctx.fillStyle = c; ctx.fillRect(x - 1, y - 5, 2, 5); ctx.fillStyle = T().shade(c, 0.25); ctx.fillRect(x + 1, y - 4, 2, 4); }
      else { const c = ["#4e7a34", "#8a3a2a", "#c8a040", "#2e5a7a"][Math.floor(r() * 4)]; ctx.fillStyle = c; ctx.fillRect(x, y - 5, 2, 5); ctx.fillRect(x, y - 7, 1, 2); ctx.fillStyle = "rgba(255,248,220,0.45)"; ctx.fillRect(x, y - 4, 1, 1); }
    }
  }
  function candlestick(ctx, x, y, now, flick, gold) {
    ctx.fillStyle = gold ? "#a87a28" : "#4a4a52"; ctx.fillRect(x - 1, y - 1, 4, 1); ctx.fillStyle = gold ? "#e0b850" : "#7a7a84"; ctx.fillRect(x, y - 2, 2, 1);
    T().candle(ctx, x, y - 2, now, flick, 4);
  }
  function candelabra(ctx, x, y, now, flick) {
    ctx.fillStyle = "#a87a28"; ctx.fillRect(x - 2, y - 1, 5, 1); ctx.fillRect(x, y - 6, 1, 5); ctx.fillRect(x - 4, y - 7, 9, 1);
    ctx.fillStyle = "#e0b850"; ctx.fillRect(x - 4, y - 8, 1, 1); ctx.fillRect(x + 4, y - 8, 1, 1); ctx.fillRect(x, y - 8, 1, 2);
    for (const dx of [-4, 0, 4]) T().candle(ctx, x + dx - (dx > 0 ? 1 : 0), y - 8 - (dx ? 0 : 2), now + dx, flick, 3);
  }
  function chandelier(ctx, x, y, now, flick) {
    ctx.fillStyle = "#2a1a10"; ctx.fillRect(x, 0, 1, y - 6);
    for (let i = -9; i <= 9; i++) { const dy = Math.round(Math.sqrt(1 - (i / 10) ** 2) * 3); ctx.fillStyle = "#a87a28"; ctx.fillRect(x + i, y + dy, 1, 1); ctx.fillStyle = "#6a4a18"; ctx.fillRect(x + i, y - dy, 1, 1); }
    ctx.fillStyle = "#a87a28"; ctx.fillRect(x - 3, y - 6, 1, 6); ctx.fillRect(x + 3, y - 6, 1, 6); ctx.fillRect(x, y - 6, 1, 9);
    for (const [dx, dy] of [[-9, 0], [-5, 3], [0, 3], [5, 3], [9, 0], [-5, -3], [5, -3]]) T().candle(ctx, x + dx, y + dy - 1, now + dx * 0.3, flick, 3);
  }
  function pot(ctx, x, y, now, still) {
    ctx.fillStyle = "#2a2a30"; ctx.fillRect(x, y - 22, 1, 14);
    ctx.fillStyle = "#1e1e24"; ctx.fillRect(x - 4, y - 8, 9, 6); ctx.fillRect(x - 3, y - 2, 7, 1); ctx.fillStyle = "#3a3a44"; ctx.fillRect(x - 4, y - 8, 2, 5); ctx.fillStyle = "#4a4a54"; ctx.fillRect(x - 5, y - 9, 11, 1);
    if (still) return;
    for (let i = 0; i < 3; i++) { const t = (now * 0.5 + i / 3) % 1; ctx.fillStyle = `rgba(230,225,215,${0.5 * (1 - t)})`; ctx.fillRect(Math.round(x - 2 + i * 2 + Math.sin(now * 2 + i) * 2), Math.round(y - 10 - t * 14), 1 + (t > 0.5 ? 1 : 0), 1); }
  }
  function strawBed(st, u, v, du, dv, blanket) {
    const { shade, slab } = T();
    return layer(st, (ctx) => {
      const cu = u + du / 2, cv = v + dv / 2;
      for (let h = 0; h < 6; h++) {
        const k = 1 - h / 7;
        fp(ctx, [st.up(st.iso(cu - du / 2 * k, cv - dv / 2 * k), h), st.up(st.iso(cu + du / 2 * k, cv - dv / 2 * k), h), st.up(st.iso(cu + du / 2 * k, cv + dv / 2 * k), h), st.up(st.iso(cu - du / 2 * k, cv + dv / 2 * k), h)], (x, y) => {
          const n = Math.sin(x * 9.1 + y * 4.3 + h) + Math.sin(x * 3.3 - y * 7.7);
          return n > 1.1 ? "#d8b860" : n > 0.2 ? "#b89848" : n > -0.8 ? (h < 2 ? "#7a5e2c" : "#9a7a38") : "#6e5428";
        });
      }
      const [b0, b1] = blanket, z = 5;
      fp(ctx, [st.up(st.iso(u + 0.55, v + 0.2), z), st.up(st.iso(u + du - 0.25, v + 0.15), z), st.up(st.iso(u + du - 0.2, v + dv - 0.2), z - 1), st.up(st.iso(u + 0.5, v + dv - 0.25), z)], (x, y) => {
        const [a, b] = st.toUV(x, y + z); return Math.floor(a * 4) % 2 === Math.floor(b * 4) % 2 ? b0 : b1;
      });
      fp(ctx, [st.up(st.iso(u + 0.55, v + 0.2), z), st.up(st.iso(u + 0.85, v + 0.2), z), st.up(st.iso(u + 0.8, v + dv - 0.25), z), st.up(st.iso(u + 0.5, v + dv - 0.25), z)], shade(b0, 0.3));
      const [px, py] = st.up(st.iso(u + 0.3, v + dv / 2), 5);
      pix(ctx, Math.round(px) - 4, Math.round(py) - 8, PACK, { r: b1, R: b0, b: "#3e2a1a", B: "#6a4a2a", s: "#4a3020", g: "#d8b040" });
    });
  }
  function bales(st, list) {
    const { slab, shade } = T();
    return layer(st, (ctx) => {
      for (const [u, v, du, dv, z] of list) {
        const tex = (k) => (x, y) => { const n = Math.sin(x * 7.3 + y * 13.1) + Math.sin(x * 1.9 - y * 5.3); return shade(n > 1 ? "#d8bc64" : n > -0.2 ? "#c4a450" : "#a88a3e", k); };
        slab(ctx, st, u, v, du, dv, 7, { base: "#b89848", top: tex(0.06), left: tex(-0.05), right: tex(-0.3) }, z);
        for (const f of [0.3, 0.7]) {
          const a = st.up(st.iso(u + du * f, v + dv), z);
          T().line(ctx, a, st.up(a, 7), "#7a5a2a"); T().line(ctx, st.up(a, 7), st.up(st.iso(u + du * f, v), z + 7), "#7a5a2a");
        }
      }
    });
  }

  function room(t, cast, seed, onVisible) {
    const NU = 11, NV = 9, WH = 50, st = T().stage(W, H, 92, 58);
    const r = Art.rng(Art.hash(seed + "room" + t.room));
    const kind = t.setting === "stable" ? "stables" : t.room;
    const S = T(), { slab, shade, line } = S;
    const LOOK = {
      private: { wall: boardWall(["#7a4e2c", "#724828", "#7e522e"], "#3e2616", "#5e3a1e"), floor: boardFloor(["#8e5c34", "#83542f", "#895830"], "#5a3820") },
      suite: { wall: paperWall(WH, { wains: 16, panel: "#5a3420", crown: "#7a4a28", paper: ["#cdb68a", "#b49a6a"] }), floor: parquet("#8a5430", "#7e4c2c", "#4e2c18") },
      cottage: { wall: timberWall(WH), floor: boardFloor(["#a07a4c", "#987248", "#a6804e"], "#6e5032") },
      townhouse: { wall: paperWall(WH, { wains: 15, panel: "#4e3020", crown: "#5e3a20", paper: ["#4e6248", "#5a6e52"], motif: "stripe" }), floor: boardFloor(["#6e4428", "#664024", "#72482a"], "#3e2414") },
      manor: { wall: paperWall(WH, { wains: 19, panel: "#3e2414", crown: "#a87a30", paper: ["#2e4434", "#8a7a3a"], motif: "damask" }), floor: parquet("#6e3e20", "#643820", "#3a2010") },
      stables: { wall: boardWall(["#4e3420", "#553822", "#4a301c"], "#2a1a0e"), floor: strawFloor() },
    }[kind] || { wall: boardWall(["#7a4e2c", "#724828", "#7e522e"], "#3e2616", "#5e3a1e"), floor: boardFloor(["#8e5c34", "#83542f", "#895830"], "#5a3820") };
    const bg = walls(st, NU, NV, WH, LOOK.wall, LOOK.floor, ["#2e1c10", "#3a2414"]);
    const b = bg.getContext("2d");
    const props = [], lights = [], anims = [];
    const self = (cast[0] && cast[0].h) || {};
    const town = t.town_id || self.loc, outside = { town, weather: S.weatherAt(town) }, views = [];
    const cloakCol = ((self.look || {}).fav) || "#5a6a3a";
    const blankets = [["#8a3a2a", "#6e2c22"], ["#3a5a7a", "#2e4a66"], ["#4a6a3a", "#3a5630"]];
    const bl = blankets[Math.floor(r() * 3)];
    let fire = null, amb = 0.4, hostAt = null;
    const lamp = (x, y, rad, k, cool) => lights.push({ x, y, r: rad, k, cool, base: k });
    const windowAt = (a0, a1, h0, h1, moon, o) => {
      views.push(S.windowR(b, st, r, a0, a1, h0, h1, moon, Object.assign({}, o, outside))); S.moonbeam(b, st, a0, a1, 3.2, NU);
      const [x, y] = st.rwall((a0 + a1) / 2, (h0 + h1) / 2); lamp(x, y, 30, 0.45, true);
      const [fx, fy] = st.iso((a0 + a1) / 2 + 1, 1.8); lamp(fx, fy, 28, 0.35, true);
    };
    const hearthAt = (v0, v1, o) => {
      S.hearth(b, st, r, v0, v1, WH, o); fire = [v0, v1];
      const [x, y] = st.lwall((v0 + v1) / 2, 8); lamp(x + 16, y + 4, 92, 0.9, false);
      lights[lights.length - 1].fire = true;
    };
    const candleOn = (u, v, z, kind2, reach) => {
      const [x, y] = st.up(st.iso(u, v), z), cx = Math.round(x), cy = Math.round(y);
      anims.push((ctx, now, flick) => (kind2 === "gold" ? candlestick(ctx, cx, cy, now, flick, true) : kind2 === "three" ? candelabra(ctx, cx, cy, now, flick) : candlestick(ctx, cx, cy, now, flick, false)));
      lamp(cx, cy - 8, reach || (kind2 === "three" ? 64 : 52), kind2 === "three" ? 0.85 : 0.75);
      lights[lights.length - 1].flame = true;
    };
    const tableAt = (u, v, du, dv, h, wood, things) => props.push({ key: u + du + v + dv, cv: layer(st, (ctx) => {
      S.table(ctx, st, u, v, du, dv, h, wood);
      for (const [k, fu, fv] of things || []) {
        const [x0, y0] = st.up(st.iso(u + du * fu, v + dv * fv), h), x = Math.round(x0), y = Math.round(y0);
        if (k === "book") { ctx.fillStyle = "#6a2a20"; ctx.fillRect(x - 2, y - 2, 5, 2); ctx.fillStyle = "#e8dcc0"; ctx.fillRect(x - 2, y - 3, 5, 1); }
        if (k === "bread") { ctx.fillStyle = "#8a5a2a"; ctx.fillRect(x - 3, y - 3, 6, 3); ctx.fillStyle = "#c8904a"; ctx.fillRect(x - 2, y - 4, 4, 2); ctx.fillStyle = "#e0b070"; ctx.fillRect(x - 1, y - 4, 1, 1); }
        if (k === "jug") { ctx.fillStyle = "#8a6a4a"; ctx.fillRect(x - 1, y - 6, 4, 6); ctx.fillStyle = "#b08a5e"; ctx.fillRect(x - 1, y - 6, 1, 6); ctx.fillStyle = "#6a4a2a"; ctx.fillRect(x + 3, y - 5, 1, 3); ctx.fillRect(x, y - 7, 2, 1); }
        if (k === "basin") { ctx.fillStyle = "#c8c0b0"; ctx.fillRect(x - 4, y - 2, 9, 2); ctx.fillStyle = "#e8e2d4"; ctx.fillRect(x - 4, y - 3, 9, 1); ctx.fillStyle = "#6a8aa8"; ctx.fillRect(x - 3, y - 2, 7, 1); }
        if (k === "wine") { ctx.fillStyle = "#3a1a20"; ctx.fillRect(x, y - 6, 2, 6); ctx.fillRect(x, y - 8, 1, 2); ctx.fillStyle = "#7a2a30"; ctx.fillRect(x, y - 4, 1, 2); ctx.fillStyle = "#d8d0c8"; ctx.fillRect(x + 4, y - 3, 1, 3); ctx.fillRect(x + 3, y - 4, 3, 1); ctx.fillStyle = "#8a2a30"; ctx.fillRect(x + 3, y - 4, 3, 1); }
        if (k === "fruit") { ctx.fillStyle = "#c8c0b0"; ctx.fillRect(x - 3, y - 1, 7, 1); for (const [dx, c] of [[-2, "#b83a2a"], [0, "#d8a030"], [2, "#6a8a3a"], [-1, "#a8382a"], [1, "#c89a2a"]]) { ctx.fillStyle = c; ctx.fillRect(x + dx, y - 3 - (Math.abs(dx) === 1 ? 1 : 0), 2, 2); } }
        if (k === "papers") { ctx.fillStyle = "#e8e0c8"; ctx.fillRect(x - 3, y - 1, 6, 1); ctx.fillRect(x - 1, y - 2, 5, 1); ctx.fillStyle = "#2a2028"; ctx.fillRect(x + 4, y - 3, 2, 3); ctx.fillStyle = "#f0e8d8"; ctx.fillRect(x + 5, y - 6, 1, 3); }
      }
    }) });
    let inBed = null;
    const bedAt = (u, v, du, dv, o) => {
      const p = bedPiece(st, u, v, du, dv, o);
      props.push({ key: 0.5, cv: p.back });
      if (p.front) props.push({ key: u + du + v + dv + 0.6, cv: p.front });
      st.bed = { has: (a, c) => a > u + 0.2 && a < u + du && c > v && c < v + dv, z: 11, cut: 20, fold: "#f2e8d4" };
      inBed = [u + 0.85, v + dv / 2];
    };
    const packAt = (u, v, z) => {
      const [x, y] = st.up(st.iso(u, v), z || 0);
      props.push({ key: u + v, cv: layer(st, (ctx) => pix(ctx, Math.round(x) - 4, Math.round(y) - 10, PACK, { r: bl[0], R: shade(bl[0], 0.15), b: "#3e2a1a", B: "#6a4a2a", s: "#4a3020", g: "#d8b040" })) });
    };
    const bootsAt = (u, v) => { const [x, y] = st.iso(u, v); props.push({ key: u + v, cv: layer(st, (ctx) => pix(ctx, Math.round(x) - 3, Math.round(y) - 5, BOOTS, { b: "#3a2416", B: "#5e3e24", o: "#1e140c" })) }); };
    const catAt = (u, v, z, fur, key) => {
      const [x, y] = st.up(st.iso(u, v), z || 0), pal = { o: shade(fur, -0.55), O: fur, T: shade(fur, 0.2) };
      props.push({ key: key || u + v, draw: (ctx, now, flick, still) => pix(ctx, Math.round(x) - 5, Math.round(y) - 6, CAT[still ? 0 : Math.floor(now / 1.6) % 2], pal) });
    };

    if (kind === "stables") {
      amb = 0.36;
      fp(b, st.quad(st.lwall, 0, NV, 30, 32), "#2a180c"); fp(b, st.quad(st.rwall, 0, NU, 30, 32), "#33200f");
      line(b, st.lwall(0, 32), st.lwall(NV, 32), "#5a3a1e"); line(b, st.rwall(0, 32), st.rwall(NU, 32), "#6a4424");
      for (let a = 2.2; a < NV; a += 3.2) { fp(b, st.quad(st.lwall, a, a + 0.2, 0, WH - 3), "#3a2412"); line(b, st.lwall(a, 0), st.lwall(a, WH - 3), "#5a3a1e"); }
      // moonlight through the gaps between the boards and a hatch high in the wall
      for (const a of [2.6, 5.5, 9.6]) fp(b, st.quad(st.rwall, a, a + 0.04, 6, 26), "rgba(150,180,240,0.35)");
      views.push(S.windowR(b, st, r, 8.0, 9.6, 31, 43, true, Object.assign({ sill: false, frame: "#2a1a0e" }, outside)));
      { const [x, y] = st.rwall(8.8, 38); lamp(x, y, 26, 0.5, true); }
      // tack on the left wall: a saddle on its peg, a bridle, a coil of rope, a horseshoe for luck
      wallSprite(b, st, "l", 3.0, 30, BRIDLE, { o: "#4a2a16", m: "#9a9aa2" });
      { const p = st.lwall(3.9, 27); b.fillStyle = "#a8884a"; for (let i = 0; i < 3; i++) { b.fillRect(Math.round(p[0]) - 3 + i, Math.round(p[1]) + i * 2, 6 - i * 2 + 1, 1); } b.strokeStyle = "#8a6a3a"; b.beginPath(); b.arc(Math.round(p[0]) + 0.5, Math.round(p[1]) + 3.5, 3, 0, Math.PI * 2); b.stroke(); }
      { const p = st.lwall(5.0, 36); b.fillStyle = "#7a7a84"; b.fillRect(Math.round(p[0]) - 2, Math.round(p[1]), 1, 4); b.fillRect(Math.round(p[0]) + 2, Math.round(p[1]), 1, 4); b.fillRect(Math.round(p[0]) - 1, Math.round(p[1]) + 4, 3, 1); }
      // stalls along the back wall, the hero's own mount in the first
      const mount = (t.host || {}).mount, own = mount && window.MountArt ? [mount.kind, mount.colour] : ["horse", "grey"];
      const stranger = ["horse", ["bay", "chestnut", "dun", "black"][Math.floor(r() * 4)]];
      const STALLS = [[0.8, 3.9, own], [3.9, 7.0, stranger]];
      slab(b, st, 0.8, 0, 0.14, 2.3, 22, "#5a3a20");
      for (const [u0, k] of [[3.9, 1.5], [7.0, 1.7]]) props.push({ key: k, cv: layer(st, (ctx) => slab(ctx, st, u0, 0, 0.14, 2.3, 22, "#5a3a20")) });
      STALLS.forEach(([u0, u1, [mk, mc]], i) => {
        const [x, y] = st.iso((u0 + u1) / 2, 1.0), sleepy = i === 1;
        if (window.MountArt) props.push({ key: 1 + i * 0.6, draw: (ctx, now, flick, still) => {
          const g = MountArt.mountGrid(mk, mc, sleepy || still ? 0 : Math.floor(now / 0.9) % 2), left = i === 0;
          ctx.save(); if (left) { ctx.translate(Math.round(x) * 2, 0); ctx.scale(-1, 1); }
          ctx.drawImage(g, Math.round(x - g.width / 2), Math.round(y - g.height + 2)); ctx.restore();
        } });
        if (i === 0) hostAt = [Math.round(x) - 8, Math.round(y) - 30];
        props.push({ key: 2 + i * 0.01, cv: layer(st, (ctx) => {
          slab(ctx, st, u0 + 0.14, 2.15, u1 - u0 - 0.14, 0.16, 12, { base: "#6a4426", left: (px, py) => {
            const [a, h] = onV(st, 2.31)(px, py), f = (a - u0 - 0.14) / (u1 - u0 - 0.14);
            if (h < 1.5 || h > 10.5 || f < 0.05 || f > 0.95) return "#7a5030";
            if (Math.abs((h - 1.5) / 9 - f) < 0.07 || Math.abs((h - 1.5) / 9 - (1 - f)) < 0.07) return "#7a5030";
            return Math.floor(a * 4) % 2 ? "#5a3820" : "#523420";
          } });
          const p = st.up(st.iso(u0 + 0.5, 2.31), 9); ctx.fillStyle = "#9a9aa2"; ctx.fillRect(Math.round(p[0]), Math.round(p[1]), 2, 1);
          // the hero's saddle thrown over their own stall door
          if (i === 0) { const q = st.up(st.iso(u0 + 1.0, 2.25), 12); pix(ctx, Math.round(q[0]) - 6, Math.round(q[1]) - 5, SADDLE, { o: "#2a160c", S: "#8a4a26", H: "#b8743e", F: "#6e381c", L: "#4a2814", m: "#8a8a92" }); }
        }) });
      });
      props.push({ key: 2.4, cv: layer(st, (ctx) => { for (const u0 of [0.8, 3.9, 7.0]) slab(ctx, st, u0, 2.1, 0.18, 0.22, 24, "#4e321c"); }) });
      props.push({ key: 8 + 2.6, cv: bales(st, [[7.4, 0.1, 1.6, 1.0, 0], [9.1, 0.1, 1.6, 1.0, 0], [7.5, 1.15, 1.6, 1.0, 0], [9.2, 1.15, 1.6, 1.0, 0], [8.2, 0.2, 1.6, 1.0, 7], [9.0, 2.3, 1.5, 0.9, 0]]) });
      catAt(8.9, 0.8, 14, "#c8783a", 10.7);
      props.push({ key: 4.5, cv: strawBed(st, 0.2, 5.0, 2.4, 1.7, bl) });
      st.bed = { has: (a, c) => a > 0.5 && a < 2.4 && c > 5.0 && c < 6.7, z: 5, cut: 20, fold: bl[0] };
      inBed = [1.15, 5.85];
      props.push({ key: 0.8 + 8.8, cv: layer(st, (ctx) => {
        slab(ctx, st, 0.1, 7.2, 0.8, 1.6, 7, { base: "#5e3e22", top: (x, y) => { const [u] = st.toUV(x, y + 7); return u < 0.22 || u > 0.78 ? "#7a5030" : (x + y) % 5 ? "#2e4a5e" : "#3e5e74"; } });
        const [x, y] = st.iso(1.4, 7.7); pix(ctx, Math.round(x) - 3, Math.round(y) - 5, BUCKET, { x: "#2a1a10", b: "#6a4a2a", c: "#8a8a92" });
      }) });
      { const p = st.rwall(7.3, 22); props.push({ key: 2.5, cv: layer(st, (ctx) => pix(ctx, Math.round(p[0]) + 2, Math.round(p[1]) - 2, FORK, { x: "#8a8a92", s: "#8a6038" })) }); }
      anims.push((ctx, now, flick) => T().lantern(ctx, st, 3.45, 3.85, flick, 40, true));
      { const [x, y] = st.iso(3.45, 3.85); lamp(x, y - 30, 96, 1.0); lights[lights.length - 1].flame = true; }
      // dust drifting in the lantern light
      anims.push((ctx, now, flick, still) => {
        if (still) return;
        const [x, y] = st.iso(3.45, 3.85);
        for (let i = 0; i < 7; i++) { const t = (now * 0.05 + i * 0.37) % 1; ctx.fillStyle = "rgba(255,230,170,0.5)"; ctx.fillRect(Math.round(x - 20 + ((i * 17) % 40) + Math.sin(now * 0.7 + i) * 4), Math.round(y - 20 - t * 30), 1, 1); }
      });
    } else {
      if (kind === "private" || !["suite", "cottage", "townhouse", "manor"].includes(kind)) {
        amb = 0.34;
        windowAt(6.4, 8.4, 16, 37, true, { curtain: ["#b8a47c", "#98845c"] });
        door(b, st, 7.2, 8.5, 32, "#6a4224", "#3a3a40");
        rugPaint(b, st, 3.0, 3.0, 7.8, 6.6, { oval: true, cols: ["#8a5a3a", "#6a7a4a", "#a8885a", "#7a4a32", "#c8a870"] });
        b.fillStyle = "#4a2c18"; line(b, st.rwall(3.4, 30), st.rwall(5.2, 30), "#4a2c18");
        wallSprite(b, st, "r", 3.9, 31, CLOAK, { p: "#3a2414", o: shade(cloakCol, -0.6), h: shade(cloakCol, -0.15), d: shade(cloakCol, -0.45), c: shade(cloakCol, -0.35), C: shade(cloakCol, -0.12) });
        { const p = st.rwall(4.8, 30); b.fillStyle = "#3a2414"; b.fillRect(Math.round(p[0]), Math.round(p[1]), 1, 2); }
        { const p = st.rwall(5.7, 26); b.fillStyle = "#3a2414"; b.fillRect(Math.round(p[0]) - 3, Math.round(p[1]) - 5, 7, 9); b.fillStyle = "#8a98a8"; b.fillRect(Math.round(p[0]) - 2, Math.round(p[1]) - 4, 5, 7); b.fillStyle = "#c8d4e0"; b.fillRect(Math.round(p[0]) - 2, Math.round(p[1]) - 4, 1, 3); }
        bedAt(0.4, 0.3, 2.4, 1.3, { wood: "#6a4226", quilt: [bl[0], bl[1]], head: 15, foot: 9 });
        tableAt(0.3, 1.85, 0.6, 0.55, 9, "#6a4226", [["book", 0.6, 0.3]]);
        candleOn(0.55, 2.2, 9, null, 74);
        props.push({ key: 3.0 + 1.5, cv: chest(st, 3.0, 0.35, 0.6, 1.1, "#5e3a1e", "#3a3a40") });
        tableAt(5.2, 0.1, 0.8, 0.6, 11, "#6a4226", [["basin", 0.5, 0.5], ["jug", 0.15, 0.3]]);
        props.push({ key: 7.4 + 1.4, cv: layer(st, (ctx) => S.stool(ctx, st, 7.0, 1.0, "#6a4226")) });
        packAt(3.4, 2.1); bootsAt(2.3, 2.3);
        hostAt = (() => { const d = st.lwall(7.85, 32); return [d[0] + 4, d[1] - 2]; })();
      } else if (kind === "suite") {
        amb = 0.42;
        windowAt(6.6, 8.6, 17, 39, true, { curtain: ["#8a2a24", "#6a1e1a"], frame: "#4a2a18" });
        windowAt(9.1, 10.7, 17, 39, false, { curtain: ["#8a2a24", "#6a1e1a"], frame: "#4a2a18" });
        hearthAt(4.7, 6.5, { marble: true, mantel: "#e0d6c4" });
        door(b, st, 7.5, 8.7, 34, "#5a3420", "#a87a30");
        painting(b, st, "l", 2.9, 4.0, 24, 36, "#c8a040", landscape);
        rugPaint(b, st, 3.4, 3.2, 8.8, 7.6, { c0: "#7a2420", c1: "#2e4a5a", edge: "#c8a040", edge2: "#5a1a16", fringe: "#e0d0a8" });
        bedAt(0.4, 0.3, 2.8, 2.0, { wood: "#5a3018", quilt: ["#7a2420", "#6a1e1a", "#c8a040"], head: 22, foot: 13, posts: true, canopy: ["#8a2a24", "#6a1e1a"], arch: true });
        tableAt(0.3, 2.55, 0.6, 0.55, 10, "#5a3018");
        candleOn(0.6, 2.85, 10, "gold");
        props.push({ key: 3.4 + 2.1, cv: chest(st, 3.4, 0.5, 0.55, 1.5, "#5a3018", "#c8a040") });
        props.push({ key: 4.4 + 0.8, cv: cabinet(st, 4.3, 0.05, 1.4, 0.75, 36, "#5a3018", doors(4.3, 5.7, 36, "#6a3a1e")) });
        tableAt(9.4, 1.6, 0.9, 0.9, 10, "#5a3018", [["wine", 0.3, 0.6], ["fruit", 0.7, 0.3]]);
        candleOn(9.75, 1.85, 10, "three");
        props.push({ key: 1.2 + 3.6 + 0.7, cv: chair(st, 1.3, 3.4, "#5a3018", "#2e4a5a", true) });
        { const [x, y] = st.iso(10.5, 0.45); props.push({ key: 11, cv: layer(st, (ctx) => { ctx.fillStyle = "#8a4a2a"; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 6, 7, 6); ctx.fillStyle = "#a85e36"; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 6, 2, 6); for (let i = 0; i < 14; i++) { ctx.fillStyle = i % 3 ? "#4a7a3a" : "#6a9a4a"; ctx.fillRect(Math.round(x) - 5 + (i * 7) % 11, Math.round(y) - 8 - ((i * 5) % 12), 2, 2); } }) }); }
        packAt(3.6, 2.4); bootsAt(2.6, 2.6);
        hostAt = (() => { const d = st.lwall(8.1, 34); return [d[0] + 4, d[1] - 2]; })();
      } else if (kind === "cottage") {
        amb = 0.36;
        windowAt(6.6, 8.6, 18, 38, true, { curtain: ["#a83a2a", "#e8dcc0"], frame: "#5a3a20" });
        { const p = st.rwall(7.0, 17); pix(b, Math.round(p[0]), Math.round(p[1]) - 7, ["..gGg..", ".gGgGg.", "..rgr..", "..ttt..", "..ttt.."], { g: "#4a7a3a", G: "#6a9a4a", r: "#c84a3a", t: "#a8603a" }); }
        hearthAt(4.7, 6.6, { mantel: "#5a3a20" });
        door(b, st, 7.4, 8.6, 32, "#6a4a2a", "#3a3a40");
        for (const [a, c] of [[1.0, "#6a7a3a"], [1.8, "#8a6a3a"], [2.6, "#6a8a4a"], [3.4, "#9a8a4a"]]) {
          const p = st.lwall(a, WH - 4), x = Math.round(p[0]), y = Math.round(p[1]);
          b.fillStyle = "#3a2a1a"; b.fillRect(x, y, 1, 3); b.fillStyle = "#8a5a30"; b.fillRect(x - 1, y + 3, 3, 1);
          for (let i = -2; i <= 2; i++) { b.fillStyle = i % 2 ? c : shade(c, 0.2); b.fillRect(x + i, y + 4, 1, 5 - Math.abs(i)); }
        }
        shelfOn(b, st, r, 3.0, 5.6, 26, "#5a3a20", ["plate", "crock", "jar", "plate"]);
        shelfOn(b, st, r, 3.0, 5.6, 35, "#5a3a20", ["crock", "jar", "plate"]);
        rugPaint(b, st, 3.6, 3.4, 7.6, 6.8, { oval: true, cols: ["#a84a32", "#d8b860", "#5a7a4a", "#c88a5a", "#4a6a8a", "#e0d4b8"] });
        bedAt(0.4, 0.3, 2.6, 1.9, { wood: "#7a5030", quilt: ["#c8b890", "#a89870"], pattern: "patch", head: 17, foot: 11, arch: true });
        tableAt(6.7, 0.5, 1.4, 0.9, 10, "#7a5030", [["bread", 0.3, 0.6], ["jug", 0.75, 0.35]]);
        candleOn(7.6, 1.15, 10);
        props.push({ key: 8.3 + 1.8, cv: layer(st, (ctx) => S.stool(ctx, st, 8.4, 1.6, "#6a4426")) });
        props.push({ key: 6.4 + 1.6, cv: layer(st, (ctx) => S.stool(ctx, st, 6.2, 1.5, "#6a4426")) });
        props.push({ key: 1.4 + 3.3 + 0.7, cv: chair(st, 1.4, 3.3, "#6a4426", null, false) });
        props.push({ key: 2 + 8.4, cv: layer(st, (ctx) => { const [x, y] = st.iso(1.6, 8.4); S.barrel(ctx, Math.round(x), Math.round(y)); }) });
        catAt(1.4, 6.0, 0, "#c8783a");
        { const [x, y] = st.lwall(5.65, 2); anims.push((ctx, now, flick, still) => pot(ctx, Math.round(x) + 4, Math.round(y), now, still)); }
        packAt(3.3, 2.3); bootsAt(2.5, 2.5);
      } else if (kind === "townhouse") {
        amb = 0.4;
        windowAt(6.6, 8.6, 17, 39, true, { curtain: ["#3a4e5e", "#2e3e4a"], frame: "#4a2a18" });
        hearthAt(4.7, 6.5, { stone: ["#8a4a34", "#7a4230", "#94543a"], mortar: "#4a2e24", mantel: "#4e3020" });
        door(b, st, 7.5, 8.7, 34, "#5a3420", "#8a8a92");
        painting(b, st, "l", 2.9, 4.0, 22, 34, "#a87a30", portrait);
        rugPaint(b, st, 3.6, 3.4, 8.4, 7.2, { c0: "#3a4e5e", c1: "#8a6a3a", edge: "#6a2a20", edge2: "#c8a040", fringe: "#d8c8a0" });
        bedAt(0.4, 0.3, 2.6, 1.9, { wood: "#4e3020", quilt: ["#3a4e5e", "#2e3e4a", "#c8b890"], head: 19, foot: 12 });
        tableAt(0.3, 2.45, 0.6, 0.55, 10, "#4e3020", [["book", 0.4, 0.4]]);
        candleOn(0.6, 2.8, 10);
        props.push({ key: 3.5 + 0.8, cv: cabinet(st, 3.4, 0.05, 1.8, 0.65, 38, "#4e3020", books(3.4, 5.2, 38, "#4e3020", r)) });
        tableAt(9.2, 0.15, 1.4, 0.8, 11, "#4e3020", [["papers", 0.4, 0.5], ["book", 0.85, 0.4]]);
        candleOn(10.3, 0.5, 11);
        props.push({ key: 9.6 + 1.6 + 0.7, cv: chair(st, 9.6, 1.2, "#4e3020", "#6a2a20", false) });
        props.push({ key: 1.3 + 3.4 + 0.7, cv: chair(st, 1.3, 3.4, "#4e3020", "#6a2a20", true) });
        props.push({ key: 5.6 + 0.6, cv: cabinet(st, 5.6, 0.05, 0.6, 0.5, 34, "#5a3018", (f) => (x, y) => {
          const [a, h] = f(x, y);
          if (h > 24 && h < 31 && a > 5.72 && a < 6.08) { const dx = a - 5.9, dh = h - 27.5; return dx * dx * 60 + dh * dh / 12 < 1 ? (Math.abs(dx) < 0.03 || (Math.abs(dh) < 0.6 && dx > 0) ? "#2a1a10" : "#e8dcc0") : "#c8a040"; }
          return h > 22 || h < 4 ? "#5a3018" : Math.abs(a - 5.9) < 0.12 ? "#3a2010" : "#4e2a16";
        }) });
        packAt(3.3, 2.4); bootsAt(2.5, 2.6);
      } else if (kind === "manor") {
        amb = 0.46;
        windowAt(6.6, 8.4, 16, 40, true, { curtain: ["#2e4a36", "#22382a"], frame: "#3e2414" });
        windowAt(9.0, 10.6, 16, 40, false, { curtain: ["#2e4a36", "#22382a"], frame: "#3e2414" });
        hearthAt(4.6, 6.6, { marble: true, mantel: "#e8e0d0" });
        door(b, st, 7.4, 8.8, 36, "#3e2414", "#c8a040");
        painting(b, st, "l", 2.9, 4.1, 22, 40, "#d8b048", portrait);
        rugPaint(b, st, 3.2, 3.0, 9.4, 7.8, { c0: "#6a1e1a", c1: "#2e4a36", edge: "#d8b048", edge2: "#3e1210", fringe: "#e8d8b0" });
        bedAt(0.4, 0.3, 2.9, 2.1, { wood: "#3e2414", quilt: ["#2e4a36", "#22382a", "#d8b048"], head: 26, foot: 15, posts: true, canopy: ["#2e4a36", "#1e3226"], arch: true });
        tableAt(0.3, 2.65, 0.6, 0.55, 10, "#3e2414");
        candleOn(0.6, 2.95, 10, "gold");
        props.push({ key: 3.6 + 1.2, cv: cabinet(st, 3.6, 0.05, 1.9, 0.8, 40, "#3e2414", doors(3.6, 5.5, 40, "#4e2e18")) });
        props.push({ key: 1.3 + 3.4 + 0.7, cv: chair(st, 1.3, 3.4, "#3e2414", "#6a1e1a", true) });
        { const [x, y] = st.iso(10.45, 0.45); props.push({ key: 10.9, cv: layer(st, (ctx) => pix(ctx, Math.round(x) - 5, Math.round(y) - 22, ARMOUR, { o: "#24202a", H: "#a8a8b0", h: "#6a6a74", v: "#14101a", g: "#d8b048", w: "#5a3a20", W: "#3e2414" })) }); }
        tableAt(9.6, 1.4, 0.8, 0.8, 10, "#3e2414", [["wine", 0.4, 0.5]]);
        const [cx, cy] = st.iso(5.9, 4.9);
        anims.push((ctx, now, flick) => chandelier(ctx, Math.round(cx), Math.round(cy) - 70, now, flick));
        lamp(Math.round(cx), Math.round(cy) - 60, 104, 0.9); lights[lights.length - 1].flame = true;
        packAt(3.7, 2.6); bootsAt(2.7, 2.8);
      }
    }
    const host = t.host && t.host.lines && Object.assign({}, t.host, { at: hostAt || [W / 2, 20] });
    const spots = (inBed ? [inBed] : []).concat(fromScreen(0, 0, [[26, 44], [-18, 48], [4, 62], [46, 56], [-38, 46]]));
    const inside = S.inRoom(st, NU, NV, WH), shine = S.lighting(W, H, (x, y) => inside(x, y) && !views.some((v) => v && v.glass(x, y)));
    return gather({ talks: t.talk, kind: kind === "stables" ? "stable" : "room", st, bg, props, cast, seed, center: kind === "stables" ? [5.2, 5.2] : [5.6, 5.4], spots, pred: notOrder, host, onVisible,
      under(ctx, now, flick, still) {
        for (const v of views) if (v) v.draw(ctx, now, still);
        if (fire) S.flames(ctx, st, now, fire[0], fire[1], flick, 1, true);
      },
      over(ctx, now, flick, still) {
        for (const a of anims) a(ctx, now, flick, still);
        for (const l of lights) if (l.fire || l.flame) l.k = l.base * (l.fire ? 0.7 + flick * 0.35 : 0.88 + flick * 0.15);
        shine(ctx, now, lights, amb);
      } });
  }

  // ---------- the page piece ----------
  function scene(h, L) {
    const t = h.tonight;
    if (!t || !window.Tavern || !window.Art) return null;
    const by = App.heroes;
    const self = Object.assign({}, by[h.id] || {}, h);
    const cast = t.cast.map((c) => ({ h: c.id === h.id ? self : by[c.id], lines: c.lines.length ? c.lines : ["..."], pet: c.pet })).filter((c) => c.h);
    if (!cast.length) return null;
    const seed = `${L.meta.day}:${h.id}`;
    const sound = { inn: "inn", room: "room", stable: "stable", camp: "camp", dungeon: "dungeon", cell: "cell" }[t.setting];
    let stage;
    const onVisible = (on) => { if (window.Sound && Sound.scene) Sound.scene(on ? sound : null, stage); };
    if (t.setting === "inn") {
      const others = (t.others || []).map((o) => ({ h: by[o.id], lines: o.lines })).filter((o) => o.h);
      const crowd = [Object.assign(cast[0], { focus: true })].concat(cast.slice(1), others);
      stage = Tavern.inn({ seed, keeper: t.host, cast: crowd, talks: t.talk, locals: Math.max(4, crowd.length), onVisible });
      stage.classList.add("night-inn");
    } else stage = ({ camp, dungeon, cell, room, stable: room })[t.setting](t, cast, seed, onVisible);
    const box = document.createElement("div");
    box.className = "night";
    const cap = document.createElement("div");
    cap.className = "night-cap";
    const b = document.createElement("b"); b.textContent = "Tonight: ";
    const company = cast.slice(1).map((c) => c.h.name).concat(t.companion ? [t.companion.name] : []);
    cap.append(b, document.createTextNode(t.place + (company.length ? ", with " + listNames(company) : "") + "."));
    const hint = document.createElement("span"); hint.className = "tiny dim"; hint.textContent = " Click anyone to hear them.";
    cap.appendChild(hint);
    box.append(stage, cap);
    return box;
  }
  function listNames(ns) { return ns.length < 2 ? ns.join("") : ns.slice(0, -1).join(", ") + " and " + ns[ns.length - 1]; }

  window.Night = { scene };
})();
