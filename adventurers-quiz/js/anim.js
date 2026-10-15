/* Ambient pixel animation: tiny looping actors (villagers, birds, bats, torches, snow...) staged over static paintings. */
/*
  Anim.stage(canvas, base, actors, opts) -> { draw(t), stop() }
    Makes `canvas` a live panel: every tick it copies `base` (a same-size canvas) and draws the actors on top.
    All panels share one requestAnimationFrame ticker; a panel only redraws while it is on screen and the tab is
    visible, at opts.fps (default 10). Under reduced motion or the Static scenes setting (Settings.calm) it holds one still
    frame (time opts.still, default 2), and picks up again live when the setting changes.
    opts.over: a canvas drawn after the back actors and before actors marked `front` (heroes in a vignette, say).
    A canvas that never reaches the page (used only as an image elsewhere) is dropped after a few seconds.

  An actor is { z, front?, draw(ctx, t) }, a pure function of t (seconds): motion loops, a panel looks the same on
  every visit, and any frame can be drawn on demand. Lower z draws first; factories set z to the feet's y.
  Factories take one options object. x, y are the feet / anchor in canvas pixels; `seed` (any integer) varies
  phase and look; W, H are the panel size; colours default to palettes that sit with Scenes and Isle.
    people, beasts: villager({x0,x1,y,speed,mode:"pace"|"cross",look:{skin,hair,shirt,legs,hat,hood,carry}})
                    skeleton({x0,x1,y})  cat({x,y,range,col})  quad({x0,x1,y,kind:"deer"|"wolf"|"goat"|"rat"})
                    rabbit({x,y,range,col})  crab({x,y,range})  wagon({y,W,speed})  flag({x,y,h,c1,c2})
    sky:            bird({W,y,speed,col,flock})  gull({W,y})  eagle({x,y,r})  bat({W,y0,y1})  butterfly({x,y,w,h})
    light and air:  torch({x,y,r})  glow({x,y,r,rgb,a,amp,speed})  smoke({x,y})  embers({x0,x1,y,n,rise})
                    fireflies({x,y,w,h,n,rgb,glow})  wisp({x,y,w,h})  snow({W,H,n,speed})  rain({W,H,n,storm})
                    mist({W,y,h,rgb,a,speed})  shade({W,y0,y1,speed})  (a cloud shadow sliding over the ground)
    water, caves:   waves({x0,x1,y,h,rgb})  bubbles({x,y,w,rgb,rise})  drip({x,y0,y1,rgb})  twinkle({pts,rgb})
                    cobweb({x,y,size,side:"l"|"r"})
    any sprite:     flip({a,b,x,y,rate}) alternates two canvases (replay-style idle)  rise({x,y,cv,h,period})
  Helpers: Anim.sprite(rows, pal, outline) builds a cached outlined pixel sprite from strings ("." is empty, other
  characters index pal); Anim.put(ctx, cv, x, y, faceLeft) draws one by its feet; Anim.reduced is true while still.
*/
(function () {
  "use strict";
  const OUT = "#1a1220";
  const calm = () => (window.Settings ? Settings.calm() : !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches));
  const rng = (seed) => Art.rng((seed >>> 0) * 2654435761 + 97);
  const frac = (v) => ((v % 1) + 1) % 1;
  const R = Math.round;

  // ---------- sprites ----------
  const cache = new Map();
  function sprite(rows, pal, outline) {
    const ol = outline === undefined ? OUT : outline;
    const key = rows.join("|") + JSON.stringify(pal) + ol;
    let cv = cache.get(key);
    if (cv) return cv;
    const h = rows.length, w = Math.max(...rows.map((r) => r.length)), pad = ol ? 1 : 0;
    cv = document.createElement("canvas");
    cv.width = w + pad * 2; cv.height = h + pad * 2; cv.pad = pad;
    const ctx = cv.getContext("2d");
    const on = (x, y) => y >= 0 && y < h && x >= 0 && x < rows[y].length && rows[y][x] !== ".";
    if (ol) {
      ctx.fillStyle = ol;
      for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++)
        if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) ctx.fillRect(x + pad, y + pad, 1, 1);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) { ctx.fillStyle = pal[rows[y][x]] || OUT; ctx.fillRect(x + pad, y + pad, 1, 1); }
    cache.set(key, cv);
    return cv;
  }
  function mirror(cv) {
    if (!cv.mirror) {
      const m = document.createElement("canvas");
      m.width = cv.width; m.height = cv.height; m.pad = cv.pad;
      const c = m.getContext("2d");
      c.scale(-1, 1); c.drawImage(cv, -cv.width, 0);
      cv.mirror = m;
    }
    return cv.mirror;
  }
  function put(ctx, cv, x, y, left) {
    const c = left ? mirror(cv) : cv;
    ctx.drawImage(c, R(x) - (c.width >> 1), R(y) - c.height + 1 + (c.pad || 0));
  }
  const glows = new Map();
  function glowSprite(r, rgb) {
    const key = r + rgb;
    let cv = glows.get(key);
    if (cv) return cv;
    cv = document.createElement("canvas");
    cv.width = cv.height = r * 2;
    const ctx = cv.getContext("2d"), g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.45, `rgba(${rgb},0.4)`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, r * 2, r * 2);
    glows.set(key, cv);
    return cv;
  }
  function light(ctx, x, y, r, rgb, a) {
    if (a <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(glowSprite(r, rgb), R(x) - r, R(y) - r);
    ctx.restore();
  }
  function dot(ctx, x, y, c, w, h) { ctx.fillStyle = c; ctx.fillRect(R(x), R(y), w || 1, h || 1); }

  // back and forth between the ends with a rest at each: [position 0..1, moving, facing left]
  function pace(t, period, rest, phase) {
    const f = frac(t / period + phase), a = 0.5 - rest;
    if (f < a) return [f / a, true, false];
    if (f < 0.5) return [1, false, false];
    if (f < 0.5 + a) return [1 - (f - 0.5) / a, true, true];
    return [0, false, true];
  }
  // across once, then off stage for a while: [x, visible]
  function cross(t, x0, x1, speed, gap, phase, left) {
    const len = Math.abs(x1 - x0), period = len / speed + gap, d = frac(t / period + phase) * period * speed;
    if (d > len) return [0, false];
    return [left ? x1 - d : x0 + d, true];
  }
  // a flicker that never quite repeats within a minute
  const flick = (t, s) => 0.6 + Math.sin(t * 9.1 + s) * 0.18 + Math.sin(t * 23.3 + s * 1.7) * 0.12 + Math.sin(t * 3.7 + s * 0.3) * 0.1;

  // ---------- palettes ----------
  const SKIN = ["#f0c8a0", "#e0b088", "#c48a5e", "#9a6440", "#6e4428"];
  const HAIR = ["#3a2a1a", "#6a4020", "#c8a050", "#9a9aa6", "#2a2228", "#a04a20"];
  const SHIRT = ["#8a3a2a", "#3a5a8a", "#5a8a3a", "#c8a040", "#7a5a3a", "#4a6a6a", "#a8503a", "#d8c8a0", "#2e4a6e", "#6a3a3a"];
  const LEGS = ["#4a3a2a", "#3a3a4a", "#5a4a3a", "#2a2a2a", "#6a5a44"];
  function look(r, over) {
    const p = (a) => a[Math.floor(r() * a.length)];
    return Object.assign({ skin: p(SKIN), hair: p(HAIR), shirt: p(SHIRT), legs: p(LEGS), hat: r() < 0.25 ? p(["#7a5a3a", "#c8b070", "#3a3a4a", "#8a3a2a"]) : null, carry: r() < 0.25 ? p(["#b88a4a", "#e8d8b0", "#8a6a3a"]) : null, dress: r() < 0.3 }, over || {});
  }

  // ---------- people and beasts ----------
  function villager(o) {
    const r = rng(o.seed || 1), lk = look(r, o.look), phase = r();
    const top = lk.goblin ? ["s.s", "sss"] : lk.hood ? ["hh.", "hs."] : lk.hat ? ["aaa", ".s."] : [".h.", ".s."];
    const mid = ["ccc", lk.carry ? "cccb" : "ccc"];
    const legs = lk.dress ? [["ccc", "f.f"], ["ccc", ".f."]] : [["p.p", "f.f"], [".p.", ".f."]];
    const pal = { h: lk.hood || lk.hair, s: lk.skin, a: lk.hat, c: lk.shirt, p: lk.legs, f: "#2a1e1a", b: lk.carry };
    const fr = legs.map((l) => sprite(top.concat(mid, l), pal));
    const speed = o.speed || 5, x0 = o.x0, x1 = o.x1, y = o.y;
    const span = Math.max(4, x1 - x0), rest = o.rest == null ? 0.18 : o.rest, period = (2 * span / speed) / (1 - 2 * rest);
    const left0 = r() < 0.5;
    return { z: y, front: o.front, draw(ctx, t) {
      let x, moving, left;
      if (o.mode === "cross") {
        const [cx, vis] = cross(t, x0 - 4, x1 + 4, speed, o.gap == null ? 8 : o.gap, phase, left0);
        if (!vis) return;
        x = cx; moving = true; left = left0;
      } else {
        const [u, m, l] = pace(t, period, rest, phase);
        x = x0 + u * span; moving = m; left = l !== left0;
        if (left0) x = x1 - u * span;
      }
      put(ctx, fr[moving ? Math.floor(t * 6 + phase * 8) % 2 : 1], x, y, left);
    } };
  }

  function skeleton(o) {
    const r = rng(o.seed || 2), phase = r();
    const pal = { w: o.col || "#e8e0c8", d: "#a8a090", k: "#1a1220", s: "#8a8a96" };
    const body = [".www.", ".kwk.", "..d..", "wwwww", "w.d.w", "w.w.w", ".ddd."];
    const fr = [sprite(body.concat([".w.w.", ".w.w."]), pal), sprite(body.concat([".w.w.", "w...w"]), pal)];
    const span = o.x1 - o.x0, speed = o.speed || 2.5, rest = 0.2, period = (2 * span / speed) / (1 - 2 * rest);
    return { z: o.y, draw(ctx, t) {
      const [u, moving, left] = pace(t, period, rest, phase);
      put(ctx, fr[moving ? Math.floor(t * 3 + phase * 4) % 2 : 0], o.x0 + u * span, o.y, left);
      if (!moving && frac(t / 3 + phase) < 0.3) { const x = R(o.x0 + u * span); dot(ctx, x - 1, o.y - 8, "#a8ff70"); dot(ctx, x + 1, o.y - 8, "#a8ff70"); }
    } };
  }

  function cat(o) {
    const r = rng(o.seed || 3), phase = r(), col = o.col || ["#3a3438", "#d8823a", "#e8e0d0", "#7a6a5a"][Math.floor(r() * 4)];
    const pal = { k: col, e: "#e8d050", t: col };
    const sitA = sprite(["..k.k", "..kek", "t.kk.", "tkkk.", ".kkk."], pal);
    const sitB = sprite(["..k.k", "..kek", "..kk.", "tkkk.", "tkkk."], pal);
    const walk = [sprite(["t....k.k", ".tkkkkkk", ".kkkkkk.", ".k.k.k.k"], pal), sprite(["t....k.k", ".tkkkkkk", ".kkkkkk.", "..k.k.k."], pal)];
    const range = o.range || 14, period = 2 * range / 4 / 0.2;
    return { z: o.y, draw(ctx, t) {
      const [u, moving, left] = pace(t, period, 0.4, phase);
      const x = o.x + u * range;
      if (moving) put(ctx, walk[Math.floor(t * 6) % 2], x, o.y, left);
      else put(ctx, frac(t / 2.3 + phase) < 0.2 ? sitB : sitA, x, o.y, !left);
    } };
  }

  const QUAD = {
    deer: { pal: { b: "#a8703c", l: "#e0c098", a: "#e8d8b0", t: "#f4ece0", k: "#2a1a10" }, ear: "......a.a." },
    wolf: { pal: { b: "#5e5e6c", l: "#9a9aaa", a: "#5e5e6c", t: "#9a9aaa", k: "#1a1220" }, ear: "........b." },
    goat: { pal: { b: "#e0d8c8", l: "#f8f4ec", a: "#7a6a5a", t: "#f8f4ec", k: "#2a2a2a" }, ear: ".......aa." },
  };
  function quad(o) {
    const r = rng(o.seed || 4), phase = r();
    if (o.kind === "rat") {
      const pal = { b: "#5a5050", k: "#e8a0a0" };
      const fr = [sprite(["....bb", "kbbbbb", ".b..b."], pal, null), sprite(["....bb", "kbbbbb", "b..b.."], pal, null)];
      const span = o.x1 - o.x0;
      return { z: o.y, draw(ctx, t) {
        const [u, moving, left] = pace(t, span / 14 / 0.3 * 2, 0.35, phase);
        put(ctx, fr[moving ? Math.floor(t * 10) % 2 : 0], o.x0 + u * span, o.y, left);
      } };
    }
    const q = QUAD[o.kind] || QUAD.deer;
    const body = [q.ear, ".......bbk", "tbbbbbbbb.", ".bbbbbbb..", ".llllll..."];
    const up = [sprite(body.concat([".b.b..b.b.", ".b.b..b.b."]), q.pal), sprite(body.concat(["..b.b..b.b", ".b...bb..b"]), q.pal)];
    const graze = sprite(["..........", "..........", "tbbbbbbb..", ".bbbbbbbb.", ".lllllllbb", ".b.b..b.bk", ".b.b..b..."], q.pal);
    const span = Math.max(4, (o.x1 || o.x0 + 10) - o.x0), period = o.period || 16 + r() * 8;
    return { z: o.y, draw(ctx, t) {
      const f = frac(t / period + phase);
      // grazing most of the time, head up to look about, then a short amble to the other end
      if (f < 0.35 || (f >= 0.5 && f < 0.85)) { const at = f < 0.5 ? 0 : 1; put(ctx, frac(t / 5 + phase) < 0.75 ? graze : up[0], o.x0 + at * span, o.y, at === 1); return; }
      const fwd = f < 0.5, u = fwd ? (f - 0.35) / 0.15 : (f - 0.85) / 0.15;
      put(ctx, up[Math.floor(t * 6) % 2], o.x0 + (fwd ? u : 1 - u) * span, o.y, !fwd);
    } };
  }

  function rabbit(o) {
    const r = rng(o.seed || 5), phase = r(), col = o.col || ["#9a7a5a", "#8a8478", "#c8b8a0"][Math.floor(r() * 3)];
    const pal = { b: col, e: col, t: "#f4f0e8", k: "#1a1220" };
    const sit = sprite(["...e.", "...e.", "..bbk", "tbbbb", ".bbbb"], pal);
    const ears = sprite([".....", "...ee", "..bbk", "tbbbb", ".bbbb"], pal);
    const hop = sprite(["....e.", "...e..", "tbbbbk", ".bb..b"], pal);
    const range = o.range || 16, hops = 4, cycle = 9 + r() * 5;
    return { z: o.y, draw(ctx, t) {
      const c = frac(t / cycle + phase) * cycle, leg = Math.floor(t / cycle + phase) % 2 === 1;
      const left = leg, base = (k) => left ? o.x + range - k * range / hops : o.x + k * range / hops;
      if (c < hops * 0.45) {
        const k = Math.floor(c / 0.45), p = (c % 0.45) / 0.45;
        put(ctx, hop, base(k) + (left ? -1 : 1) * p * range / hops, o.y - R(Math.sin(p * Math.PI) * 3), left);
      } else put(ctx, frac(t * 0.7 + phase) < 0.1 ? ears : sit, base(hops), o.y, left);
    } };
  }

  function crab(o) {
    const r = rng(o.seed || 6), phase = r(), pal = { r: "#c8583a", d: "#e88a5a" };
    const fr = [sprite(["d...d", "rrrrr", ".r.r."], pal, "#4a1a14"), sprite([".d.d.", "rrrrr", "r...r"], pal, "#4a1a14")];
    const range = o.range || 10;
    return { z: o.y, draw(ctx, t) {
      const [u, moving] = pace(t, range / 6 / 0.3 * 2, 0.35, phase);
      put(ctx, fr[moving ? Math.floor(t * 8) % 2 : Math.floor(t * 1.5) % 2], o.x + u * range, o.y);
    } };
  }

  function wagon(o) {
    const r = rng(o.seed || 7), phase = r(), left = r() < 0.5;
    const pal = { w: "#f0e6cc", s: "#c8bca0", b: "#7a4a28", d: "#4a2c18", o: "#3a2414", h: o.horse || "#8a5a34", m: "#3a2414", k: "#2a1a10" };
    const top = ["..wwwww.......", ".wwwwsww....mh", ".wwwwsww...mhh", ".bbbbbbbbhhhh.", ".dobbbod.hhhh."];
    const fr = [sprite(top.concat(["..o...o..h..h."]), pal), sprite(top.concat(["..o...o...hh.."]), pal)];
    const speed = o.speed || 7, W = o.W;
    return { z: o.y, draw(ctx, t) {
      const [x, vis] = cross(t, -12, W + 12, speed, o.gap || 14, phase, left);
      if (!vis) return;
      put(ctx, fr[Math.floor(t * 5) % 2], x, o.y, left);
      for (let k = 0; k < 3; k++) {
        const a = frac(t * 1.6 + k / 3);
        ctx.globalAlpha = 0.6 * (1 - a);
        dot(ctx, x + (left ? 7 : -7) + (left ? 1 : -1) * a * 6, o.y - 1 - a * 3, "#e6d6a8", a < 0.5 ? 1 : 2, a < 0.5 ? 1 : 2);
        ctx.globalAlpha = 1;
      }
    } };
  }

  function flag(o) {
    const r = rng(o.seed || 8), phase = r(), h = o.h || 9, pal = { a: o.c1 || "#c8463a", b: o.c2 || "#e8b84a", p: "#4a3020" };
    const fr = [["aaaaa", "abbaa", "aaaa."], ["aaaa.", "abbaa", "aaaaa"], [".aaaa", "aabba", "aaaa."]].map((c) => sprite(c, pal));
    return { z: o.y, draw(ctx, t) {
      ctx.fillStyle = "#3a2414"; ctx.fillRect(R(o.x), R(o.y) - h, 1, h + 1);
      dot(ctx, o.x, o.y - h - 1, "#e8b84a");
      const c = fr[Math.floor(t * 4 + phase * 3) % 3];
      ctx.drawImage(c, R(o.x) + 1, R(o.y) - h - 1);
    } };
  }

  // ---------- sky ----------
  function bird(o) {
    const r = rng(o.seed || 9), phase = r(), col = o.col || "#2a2630", left = r() < 0.5;
    const pal = { k: col, g: o.tip || col, w: col };
    const fr = o.frames || [sprite(["k...k", ".k.k.", "..k.."], pal, null), sprite([".....", "kk.kk", "..k.."], pal, null)];
    const n = o.flock || 1, speed = o.speed || 12, flap = 4 + r() * 3;
    return { z: -50, draw(ctx, t) {
      for (let i = 0; i < n; i++) {
        const [x, vis] = cross(t, -10, o.W + 10, speed, o.gap == null ? 20 : o.gap, phase + i * 0.006, left);
        if (!vis) continue;
        const dx = (left ? 1 : -1) * i * 5, dy = (i % 2 ? 2 : -1) * Math.ceil(i / 2) + Math.sin(t * 0.8 + phase * 6) * 2;
        const f = Math.floor(t * flap + i * 1.3) % 3 === 2 ? 1 : Math.floor(t * flap + i) % 2;
        put(ctx, fr[f], x + dx, o.y + dy, left);
      }
    } };
  }
  function gull(o) {
    const pal = { k: "#f4f4f0", g: "#5a5a64", w: "#f4f4f0" };
    return bird(Object.assign({ speed: 8, gap: 6, frames: [sprite(["g...g", ".k.k.", "..k.."], pal, "#8a96a8"), sprite([".....", "gkkkg", "..k.."], pal, "#8a96a8")] }, o, { col: null }));
  }
  function eagle(o) {
    const r = rng(o.seed || 10), phase = r(), rad = o.r || 18, pal = { k: "#4a3020", w: "#f0ece0", y: "#e8b84a" };
    const glide = sprite(["kkk...kkk", "...kkkw..", "....k...."], pal, null), flapS = sprite(["k.......k", ".kk...kk.", "...kkkw..", "....k...."], pal, null);
    return { z: -60, draw(ctx, t) {
      const a = t * 0.35 + phase * 6.28;
      const x = o.x + Math.cos(a) * rad, y = o.y + Math.sin(a) * rad * 0.35;
      put(ctx, frac(t / 6 + phase) < 0.12 && Math.floor(t * 6) % 2 ? flapS : glide, x, y, Math.sin(a) > 0);
    } };
  }
  function bat(o) {
    const r = rng(o.seed || 11), phase = r(), left = r() < 0.5, col = o.col || "#140e18";
    const pal = { k: col, e: "#e84a3a" };
    const rim = o.rim || "#4a3e56";
    const fr = [sprite(["kk...kk", ".kkekk.", "...k..."], pal, rim), sprite(["...k...", ".kkekk.", "kk...kk"], pal, rim)];
    const y0 = o.y0, y1 = o.y1, speed = o.speed || 22;
    return { z: -40, draw(ctx, t) {
      const [x, vis] = cross(t, -8, o.W + 8, speed, o.gap || 6, phase, left);
      if (!vis) return;
      const y = y0 + (y1 - y0) * (0.5 + 0.5 * Math.sin(x / 9 + phase * 9)) + Math.sin(t * 13) * 1.2;
      put(ctx, fr[Math.floor(t * 12 + phase * 4) % 2], x, y, left);
    } };
  }
  function butterfly(o) {
    const r = rng(o.seed || 12), phase = r(), col = o.col || ["#f4f0e0", "#f0d050", "#e88a3a", "#8ac8f0"][Math.floor(r() * 4)];
    return { z: o.y + o.h, draw(ctx, t) {
      const a = t * 0.6 + phase * 20;
      const x = o.x + o.w * (0.5 + 0.5 * Math.sin(a * 0.7) * Math.cos(a * 0.31)), y = o.y + o.h * (0.5 + 0.5 * Math.sin(a * 1.3 + 1));
      const open = Math.floor(t * 8 + phase * 5) % 2;
      ctx.fillStyle = col;
      if (open) { ctx.fillRect(R(x) - 1, R(y) - 1, 1, 2); ctx.fillRect(R(x) + 1, R(y) - 1, 1, 2); }
      else ctx.fillRect(R(x), R(y) - 1, 1, 1);
      ctx.fillStyle = "#2a2228"; ctx.fillRect(R(x), R(y), 1, 1);
    } };
  }

  // ---------- light and air ----------
  function glow(o) {
    const s = (o.seed || 0) * 1.37;
    return { z: o.z == null ? 1e4 : o.z, front: o.front, draw(ctx, t) {
      const f = o.speed ? 0.5 + 0.5 * Math.sin(t * o.speed + s) : flick(t, s);
      light(ctx, o.x, o.y, o.r || 24, o.rgb || "255,170,80", (o.a || 0.16) + (o.amp == null ? 0.1 : o.amp) * (f - 0.5));
    } };
  }
  function torch(o) {
    const s = (o.seed || 0) * 2.1, cols = o.cols || ["#c04a20", "#ff7a2a", "#ffb84a", "#fff0a0"];
    return { z: o.y, draw(ctx, t) {
      const f = flick(t, s), h = 2 + R(f * 3), lean = Math.sin(t * 5 + s) > 0.55 ? 1 : 0;
      for (let k = 0; k < h; k++) {
        const c = k === h - 1 ? cols[1] : k === 0 ? cols[0] : cols[Math.min(3, 2 + (k === 1 ? 1 : 0))];
        dot(ctx, o.x + (k >= h - 1 ? lean : 0), o.y - k, k === 0 ? cols[1] : c, k < 2 ? 2 : 1, 1);
      }
      dot(ctx, o.x + (lean ? 1 : 0), o.y - 1, cols[3]);
      light(ctx, o.x + 1, o.y - 1, o.r || 22, o.rgb || "255,160,70", 0.1 + 0.16 * f);
      if (frac(t * 0.9 + s) < 0.25) dot(ctx, o.x + lean, o.y - h - 2 - R(frac(t * 3.6 + s) * 3), cols[1]);
    } };
  }
  function smoke(o) {
    const r = rng(o.seed || 13), phase = r(), n = o.n || 5, rise = o.rise || 14, life = o.life || 3.2, col = o.col || "#d8d4d0";
    return { z: -5, draw(ctx, t) {
      for (let i = 0; i < n; i++) {
        const a = frac(t / life + phase + i / n);
        const x = o.x + Math.sin(a * 4 + phase * 6 + i) * 1.2 + a * a * (o.wind == null ? 5 : o.wind), y = o.y - a * rise;
        const sz = a < 0.25 ? 1 : 2;
        ctx.globalAlpha = Math.max(0, 0.75 * (1 - a));
        dot(ctx, x, y, a < 0.45 ? col : "#b0acac", sz, sz);
      }
      ctx.globalAlpha = 1;
    } };
  }
  function embers(o) {
    const r = rng(o.seed || 14), ps = [];
    for (let i = 0; i < (o.n || 8); i++) ps.push([o.x0 + r() * (o.x1 - o.x0), r(), 2 + r() * 2.5, r() * 6]);
    const cols = o.cols || ["#fff0a0", "#ffb84a", "#ff6a2a", "#a83a20"];
    return { z: o.z == null ? 1e3 : o.z, front: o.front, draw(ctx, t) {
      for (const [x0, ph, life, w] of ps) {
        const a = frac(t / life + ph);
        dot(ctx, x0 + Math.sin(t * 2 + w) * 2 + a * 3, o.y - a * (o.rise || 30), cols[Math.min(3, Math.floor(a * 4))]);
      }
    } };
  }
  function fireflies(o) {
    const r = rng(o.seed || 15), ps = [];
    for (let i = 0; i < (o.n || 6); i++) ps.push([r() * 50, r() * 50, 0.25 + r() * 0.35, r() * 6]);
    const rgb = o.rgb || "220,255,120", core = o.col || "#f4ffb0";
    return { z: o.z == null ? o.y + o.h : o.z, front: o.front, draw(ctx, t) {
      for (const [a, b, sp, ph] of ps) {
        const x = o.x + o.w * (0.5 + 0.5 * Math.sin(t * sp + a)), y = o.y + o.h * (0.5 + 0.5 * Math.sin(t * sp * 1.37 + b));
        const on = Math.pow(Math.max(0, Math.sin(t * (o.blink || 1.1) + ph)), 3);
        if (o.glow === false) { dot(ctx, x + (Math.floor(t * 9 + ph) % 2), y, core); continue; }
        if (on < 0.05) continue;
        light(ctx, x, y, 4, rgb, on * 0.5);
        ctx.globalAlpha = 0.4 + on * 0.6; dot(ctx, x, y, core); ctx.globalAlpha = 1;
      }
    } };
  }
  function wisp(o) {
    const r = rng(o.seed || 16), ph = r() * 9, rgb = o.rgb || "150,255,200";
    return { z: o.y + o.h, draw(ctx, t) {
      const x = o.x + o.w * (0.5 + 0.5 * Math.sin(t * 0.23 + ph)), y = o.y + o.h * (0.5 + 0.5 * Math.sin(t * 0.61 + ph * 2)) + Math.sin(t * 2.3) * 1.5;
      const p = 0.55 + 0.45 * Math.sin(t * 1.7 + ph);
      light(ctx, x, y, o.r || 7, rgb, (o.a || 0.12) + 0.12 * p);
      dot(ctx, x, y, o.col || "#e0fff0", 1, 1);
      ctx.globalAlpha = 0.5 * p; dot(ctx, x - 1, y, o.col || "#e0fff0", 3, 1); dot(ctx, x, y - 1, o.col || "#e0fff0", 1, 3); ctx.globalAlpha = 1;
    } };
  }
  function snow(o) {
    const r = rng(o.seed || 17), ps = [];
    for (let i = 0; i < (o.n || 30); i++) ps.push([r() * o.W, r() * o.H, 0.6 + r() * 0.8, r() * 6, r() < 0.15]);
    return { z: 2e4, front: true, draw(ctx, t) {
      for (const [x0, y0, sp, ph, big] of ps) {
        const y = (y0 + t * (o.speed || 6) * sp) % (o.H + 4) - 2, x = ((x0 + Math.sin(t * 0.9 + ph) * 3 + t * (o.wind || 1.5) * sp) % o.W + o.W) % o.W;
        dot(ctx, x, y, o.col || "#ffffff", big ? 2 : 1, 1);
        if (big) dot(ctx, x, y + 1, o.col || "#ffffff", 1, 1);
      }
    } };
  }
  function rain(o) {
    const r = rng(o.seed || 18), ps = [];
    for (let i = 0; i < (o.n || 40); i++) ps.push([r() * o.W, r() * o.H, 0.8 + r() * 0.4]);
    return { z: 2e4, front: true, draw(ctx, t) {
      ctx.fillStyle = "rgba(200,220,255,0.6)";
      for (const [x0, y0, sp] of ps) {
        const d = t * 90 * sp, y = (y0 + d) % (o.H + 6) - 3, x = ((x0 - d * 0.25) % o.W + o.W) % o.W;
        ctx.fillRect(R(x), R(y), 1, 3);
      }
      if (o.storm) { const f = frac(t / 7.3); if (f < 0.03 || (f > 0.05 && f < 0.07)) { ctx.fillStyle = "rgba(255,250,220,0.22)"; ctx.fillRect(0, 0, o.W, o.H); } }
    } };
  }
  const bands = new Map();
  function band(W, h, rgb, seed) {
    const key = [W, h, rgb, seed].join();
    let cv = bands.get(key);
    if (cv) return cv;
    cv = document.createElement("canvas");
    cv.width = W; cv.height = h;
    const ctx = cv.getContext("2d"), r = rng(seed), blobs = [];
    for (let i = 0; i < Math.max(3, W / 18); i++) blobs.push([r() * W, h * (0.3 + r() * 0.5), 8 + r() * 16, h * (0.3 + r() * 0.3)]);
    for (let y = 0; y < h; y++) for (let x = 0; x < W; x += 2) {
      let v = 0;
      for (const [bx, by, rx, ry] of blobs) for (const off of [-W, 0, W]) { const dx = (x + off - bx) / rx, dy = (y - by) / ry, d = dx * dx + dy * dy; if (d < 1) v += 1 - d; }
      const a = Math.min(1, v) * 0.9;
      if (a > 0.08) { ctx.fillStyle = `rgba(${rgb},${(Math.round(a * 4) / 4).toFixed(2)})`; ctx.fillRect(x, y, 2, 1); }
    }
    bands.set(key, cv);
    return cv;
  }
  function mist(o) {
    const cv = band(o.W, o.h || 10, o.rgb || "220,232,240", o.seed || 19);
    return { z: o.z == null ? 1.5e4 : o.z, front: o.front, draw(ctx, t) {
      const x = R(frac(t * (o.speed || 2) / o.W) * o.W);
      ctx.globalAlpha = (o.a || 0.35) * (0.8 + 0.2 * Math.sin(t * 0.4));
      ctx.drawImage(cv, x - o.W, R(o.y)); ctx.drawImage(cv, x, R(o.y));
      ctx.globalAlpha = 1;
    } };
  }
  function shade(o) {
    const h = o.y1 - o.y0, cv = band(Math.max(60, o.W), h, "20,30,40", o.seed || 20);
    return { z: -1, draw(ctx, t) {
      const x = R(frac(t * (o.speed || 1.5) / cv.width) * cv.width);
      ctx.globalAlpha = o.a || 0.14;
      ctx.drawImage(cv, x - cv.width, o.y0); ctx.drawImage(cv, x, o.y0);
      ctx.globalAlpha = 1;
    } };
  }

  // ---------- water and caves ----------
  function waves(o) {
    const r = rng(o.seed || 21), ds = [];
    for (let i = 0; i < (o.n || Math.max(4, (o.x1 - o.x0) / 10)); i++) ds.push([r() * (o.x1 - o.x0), r() * (o.h || 6), 2 + Math.floor(r() * 3), r(), 0.6 + r() * 0.8]);
    return { z: o.y, draw(ctx, t) {
      ctx.fillStyle = o.col || "#d8f0ff";
      for (const [x0, y0, len, ph, sp] of ds) {
        const a = frac(t / (2.5 * sp) + ph);
        if (a > 0.7) continue;
        const x = o.x0 + ((x0 + t * 2 * sp) % (o.x1 - o.x0)), w = a < 0.15 || a > 0.55 ? Math.max(1, len - 2) : len;
        ctx.fillRect(R(x), R(o.y + y0), w, 1);
      }
    } };
  }
  function bubbles(o) {
    const r = rng(o.seed || 22), bs = [];
    for (let i = 0; i < (o.n || 2); i++) bs.push([r() * Math.max(1, o.w - 2), 2.5 + r() * 3, r()]);
    const col = o.col || "#c8e8d8";
    return { z: o.y, draw(ctx, t) {
      for (const [dx, per, ph] of bs) {
        const a = frac(t / per + ph), x = o.x + 1 + dx;
        if (o.rise) {
          const y = o.y - a * o.rise;
          ctx.globalAlpha = a < 0.85 ? 0.85 : 0.85 * (1 - a) / 0.15;
          dot(ctx, x + Math.sin(t * 4 + ph * 9), y, col, a < 0.4 ? 1 : 2, a < 0.4 ? 1 : 2);
          ctx.globalAlpha = 1;
        } else if (a > 0.55 && a < 0.8) dot(ctx, x, o.y - (a > 0.68 ? 1 : 0), col, a > 0.68 ? 2 : 1, 1);
        else if (a >= 0.8 && a < 0.92) { dot(ctx, x - 1, o.y - 1, col); dot(ctx, x + 2, o.y - 1, col); dot(ctx, x - 1, o.y + 1, col, 4, 1); }
      }
    } };
  }
  function drip(o) {
    const r = rng(o.seed || 23), ph = r(), per = o.period || 2.6 + r() * 2.4, col = o.col || "#8ac8e8";
    return { z: o.y1, draw(ctx, t) {
      const a = frac(t / per + ph);
      if (a < 0.55) { if (a > 0.2) dot(ctx, o.x, o.y0, col, 1, a > 0.42 ? 2 : 1); return; }
      if (a < 0.75) { const p = (a - 0.55) / 0.2; dot(ctx, o.x, o.y0 + 1 + p * p * (o.y1 - o.y0 - 1), col, 1, 2); return; }
      if (a < 0.86) { const s = a < 0.8 ? 1 : 2; dot(ctx, o.x - s, o.y1 - s + 1, col); dot(ctx, o.x + s, o.y1 - s + 1, col); }
      else if (a < 0.95) { ctx.globalAlpha = 0.6; dot(ctx, o.x - 2, o.y1 + 1, col, 5, 1); ctx.globalAlpha = 1; }
    } };
  }
  function twinkle(o) {
    const r = rng(o.seed || 24), ps = o.pts.map((p) => [p[0], p[1], r(), 1.6 + r() * 2.5]), col = o.col || "#ffffff", arm = o.arm || "#a8e0ff";
    return { z: o.z == null ? 1e3 : o.z, front: o.front, draw(ctx, t) {
      for (const [x, y, ph, per] of ps) {
        const a = frac(t / per + ph);
        if (a > 0.2) continue;
        const big = a > 0.05 && a < 0.15;
        dot(ctx, x, y, col);
        if (big) { ctx.fillStyle = arm; ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1); }
      }
    } };
  }
  function cobweb(o) {
    const n = o.size || 12, right = o.side === "r";
    const make = (sway) => {
      const cv = document.createElement("canvas");
      cv.width = n + 2; cv.height = n + 2;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "rgba(225,225,235,0.55)";
      const spokes = [[1, 0.1], [0.75, 0.6], [0.35, 0.9], [0.05, 1]];
      for (const [sx, sy] of spokes) for (let k = 0; k <= n; k++) { const p = k / n; ctx.fillRect(Math.round(sx * n * p), Math.round(sy * n * p + (k > n * 0.6 ? sway : 0)), 1, 1); }
      for (const rad of [0.35, 0.65, 0.95]) for (let a = 0; a <= 1; a += 0.04) {
        const sx = Math.cos(a * Math.PI / 2), sy = Math.sin(a * Math.PI / 2), sag = Math.sin(a * Math.PI) * 1.5;
        ctx.fillRect(Math.round(sx * n * rad - sag * 0.5), Math.round(sy * n * rad - sag * 0.5 + (rad > 0.6 ? sway : 0)), 1, 1);
      }
      if (!right) return cv;
      const m = document.createElement("canvas");
      m.width = cv.width; m.height = cv.height;
      const c = m.getContext("2d"); c.scale(-1, 1); c.drawImage(cv, -cv.width, 0);
      return m;
    };
    const fr = [make(0), make(1)], s = (o.seed || 0) * 1.9, sx = R(o.x + (right ? -n * 0.45 : n * 0.45));
    return { z: -30, draw(ctx, t) {
      const f = Math.sin(t * 0.9 + s) > 0.4 ? 1 : 0;
      ctx.drawImage(fr[f], right ? R(o.x) - n - 1 : R(o.x), R(o.y));
      const drop = R(o.y + n * 0.5 + (o.thread || 10) * (0.5 + 0.5 * Math.sin(t * 0.35 + s)));
      ctx.fillStyle = "rgba(225,225,235,0.45)"; ctx.fillRect(sx, R(o.y + n * 0.45), 1, drop - R(o.y + n * 0.45));
      dot(ctx, sx - 1, drop, "#141018", 3, 2); dot(ctx, sx - 2, drop + Math.floor(t * 2) % 2, "#141018"); dot(ctx, sx + 2, drop + 1 - Math.floor(t * 2) % 2, "#141018");
    } };
  }

  // ---------- any sprite ----------
  function flipA(o) {
    const ph = (o.seed || 0) * 0.13;
    return { z: o.z == null ? o.y : o.z, front: o.front, draw(ctx, t) { ctx.drawImage(frac(t / (o.rate || 0.8) + ph) < 0.5 ? o.a : o.b, R(o.x), R(o.y)); } };
  }
  function rise(o) {
    const ph = (o.seed || 0) * 0.27, per = o.period || 3;
    return { z: o.z == null ? 1e4 : o.z, front: o.front !== false, draw(ctx, t) {
      const a = frac(t / per + ph);
      ctx.globalAlpha = a < 0.15 ? a / 0.15 : a > 0.7 ? Math.max(0, (1 - a) / 0.3) : 1;
      ctx.drawImage(o.cv, R(o.x + Math.sin(a * 6.28 + ph) * 1.5), R(o.y - a * (o.h || 14)));
      ctx.globalAlpha = 1;
    } };
  }

  // ---------- the shared ticker ----------
  const live = new Set();
  let raf = 0;
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => {
    for (const e of es) { const s = e.target.stageOf; if (!s) continue; s.vis = e.isIntersecting; if (e.target.isConnected) s.seen = true; else if (s.seen) s.stop(); }
    wake();
  }) : null;
  function wake() { if (!raf && !document.hidden && live.size && !calm()) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    if (document.hidden || calm()) return;
    let any = false;
    for (const s of live) {
      if (!s.cv.isConnected) { if (s.seen) s.stop(); continue; }
      s.seen = true;
      if (!s.vis) continue;
      any = true;
      if (s.t0 == null) s.t0 = now - s.ms;
      if (now - s.last >= s.ms) { s.last = now - ((now - s.last) % s.ms); s.draw(s.still + (now - s.t0) / 1000); }
    }
    if (any) raf = requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", wake);
  if (window.Settings) Settings.watch((keys) => {
    if (!keys.includes("still") && !keys.includes("motion")) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    for (const s of live) {
      if (!s.cv.isConnected) { if (s.seen) s.stop(); continue; }
      s.t0 = null; s.last = -1e9;
      if (calm()) s.draw(s.still);
    }
    wake();
  });

  function stage(cv, base, actors, opts) {
    opts = opts || {};
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const back = actors.filter((a) => !a.front).sort((p, q) => p.z - q.z), front = actors.filter((a) => a.front).sort((p, q) => p.z - q.z);
    const s = { cv, vis: !io, seen: false, last: -1e9, ms: 1000 / (opts.fps || 10), still: opts.still == null ? 2 : opts.still, t0: null };
    s.draw = (t) => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(base, 0, 0);
      for (const a of back) a.draw(ctx, t);
      if (opts.over) ctx.drawImage(opts.over, 0, 0);
      for (const a of front) a.draw(ctx, t);
    };
    s.stop = () => { live.delete(s); if (io) io.unobserve(cv); cv.stageOf = null; };
    s.draw(s.still);
    cv.stageOf = s;
    cv.anim = s;
    if (!actors.length) return s;
    live.add(s);
    if (io) io.observe(cv);
    setTimeout(() => { if (!s.seen && !cv.isConnected) s.stop(); }, 4000);
    wake();
    return s;
  }

  window.Anim = { stage, sprite, put, light, get reduced() { return calm(); }, rng, look,
    villager, skeleton, cat, quad, rabbit, crab, wagon, flag,
    bird, gull, eagle, bat, butterfly,
    torch, glow, smoke, embers, fireflies, wisp, snow, rain, mist, shade,
    waves, bubbles, drip, twinkle, cobweb,
    flip: flipA, rise };
})();
