/* God sprites for the site: the drawn gods from GodSprites (god_sprites.js), lit silhouettes for the gods not drawn yet, and the backlit bake. */
/*
  GodArt.init({fires})      the fire hexes by god id (static data); a drawn god's own fire is the fallback
  GodArt.ready(cb)          cb once every drawn sprite is decoded (a placeholder stands in until then)
  GodArt.icon(id), bust(id, mood, frame)   the 32 px bust as a canvas; frame 1 is its idle (it sinks a pixel behind the half-door)
  GodArt.figure(id, frame, mood)      the 48 px figure, frame 0 or 1
  GodArt.litBust(id, mood, frame)     the doorway bust with a 1 px rim in the fire's two lightest steps (top and both sides), cached
  GodArt.litFigure(id, frame, side, mood)   the 48 px frame with the rim on the side facing the light ("l" or "r")
  GodArt.idle(id, {side, mood, scale})      the 48 px lit figure breathing through Anim.flip, as a staged canvas
  GodArt.still(id, mood)              the 128 px portrait's data URI for a mood (its overlay layer when there is one), or the base
  GodArt.mood(id, mood)               the god's own name for a mood: a generic "cross" is Marrow's "sorry", Tally's "owed" ...
  GodArt.drawn(id)                    true when the god has real art; fire(id), ramp(id) its fire hex and 5-step ramp
  GodArt.sable()                      Sable Vey's 32 px bust (a mortal, drawn from rows here)
*/
(function () {
  "use strict";
  const OUT = "#16121a";
  const fires = {};
  const imgs = {};
  const cache = new Map();
  let pending = 0;
  const waiting = [];

  const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const toHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const x = hex2(a), y = hex2(b); return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
  const fire = (id) => fires[id] || (window.GodSprites && GodSprites[id] && GodSprites[id].fire) || null;
  const ramp = (id) => {
    const f = fire(id);
    if (!f) return ["#05060c", "#0c0e1a", "#161a2c", "#2a2440", "#3e3458"];
    return window.Art ? Art.ramp(f) : [mix(f, "#000000", 0.6), mix(f, "#000000", 0.3), f, mix(f, "#ffffff", 0.3), mix(f, "#ffffff", 0.55)];
  };
  function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

  // each god's own mood overlay; any other mood name (a generic "cross") means that one
  function moodOf(id, m) {
    if (!m) return null;
    const ms = (window.GodSprites && GodSprites[id] && GodSprites[id].moods) || [];
    return ms.includes(m) ? m : ms[0] || m;
  }
  function init(o) {
    Object.assign(fires, (o && o.fires) || {});
    if (!window.GodSprites) return;
    for (const id of Object.keys(GodSprites)) {
      const g = GodSprites[id];
      for (const k of Object.keys(g)) {
        const v = g[k];
        for (const [i, uri] of (Array.isArray(v) ? v.map((u, j) => [j, u]) : [[null, v]])) {
          if (typeof uri !== "string" || uri.slice(0, 5) !== "data:") continue;
          const key = id + ":" + k + (i == null ? "" : ":" + i);
          if (imgs[key]) continue;
          const im = new Image();
          pending++;
          im.onload = im.onerror = () => { imgs[key] = im.naturalWidth ? im : null; cache.clear(); if (--pending === 0) waiting.splice(0).forEach((f) => f()); };
          im.src = uri;
        }
      }
    }
  }
  function ready(cb) { if (!pending) cb(); else waiting.push(cb); }
  const drawn = (id) => !!imgs[id + ":b32"];

  // placeholder silhouettes: one shape list per god in units of the bust (0-32); the figure reuses it on a body
  const E = (cx, cy, rx, ry) => ["e", cx, cy, rx, ry];
  const Q = (...pts) => ["p", pts];
  const SHAPES = {
    aurel: [Q([2, 32], [5, 22], [10, 19], [22, 19], [27, 22], [30, 32]), Q([9, 21], [11, 15], [21, 15], [23, 21]), E(16, 12, 6, 7),
      Q([8, 7], [10, 2], [12, 6], [14, 0], [16, 5], [18, 0], [20, 6], [22, 2], [24, 7], [22, 9], [10, 9])],
    pell: [Q([1, 32], [3, 23], [9, 18], [23, 18], [29, 23], [31, 32]), E(16, 13, 6.5, 7), E(16, 5, 4, 3.5), Q([7, 18], [16, 25], [25, 18], [24, 22], [16, 29], [8, 22])],
    marrow: [Q([4, 32], [7, 22], [11, 19], [21, 19], [25, 22], [28, 32]), E(16, 12, 6, 7.5), Q([9, 10], [10, 4], [16, 2], [22, 4], [23, 10], [24, 24], [21, 26], [22, 12], [10, 12], [11, 26], [8, 24]),
      Q([27, 9], [31, 9], [31, 16], [27, 16]), Q([28, 7], [30, 7], [30, 9], [28, 9])],
    veiled: [Q([3, 32], [6, 21], [12, 17], [20, 17], [26, 21], [29, 32]), Q([16, 0], [21, 6], [24, 17], [22, 24], [10, 24], [8, 17], [11, 6]), Q([26, 12], [28, 12], [28, 20], [26, 20])],
    ferryman: [Q([3, 32], [6, 20], [11, 16], [21, 16], [26, 20], [29, 32]), Q([16, 1], [23, 6], [25, 15], [23, 22], [9, 22], [7, 15], [9, 6]), Q([28, 0], [30, 0], [30, 32], [28, 32])],
    gorm: [Q([0, 32], [1, 22], [8, 17], [24, 17], [31, 22], [31, 32]), E(16, 10, 7, 7), Q([8, 12], [24, 12], [26, 20], [20, 28], [16, 30], [12, 28], [6, 20]),
      Q([8, 6], [4, 1], [6, 0], [10, 4]), Q([24, 6], [28, 1], [26, 0], [22, 4])],
    mab: [Q([3, 32], [6, 22], [11, 19], [21, 19], [26, 22], [29, 32]), E(16, 13, 6, 6.5), Q([9, 10], [6, 6], [3, 9], [2, 14], [5, 11], [10, 9], [12, 4], [16, 2], [20, 4], [22, 9], [27, 11], [30, 14], [29, 9], [26, 6], [23, 10]),
      E(2.5, 15, 1.5, 1.5), E(29.5, 15, 1.5, 1.5), E(27, 23, 4, 4)],
    tally: [Q([4, 32], [7, 21], [12, 18], [20, 18], [25, 21], [28, 32]), E(16, 13, 5.5, 6.5), Q([10, 8], [11, 0], [21, 0], [22, 8]), Q([7, 8], [25, 8], [25, 10], [7, 10])],
    antlered: [Q([5, 32], [8, 24], [12, 20], [20, 20], [24, 24], [27, 32]), E(16, 15, 5, 7), Q([13, 18], [19, 18], [18, 25], [14, 25]), E(11, 10, 2.5, 1.5), E(21, 10, 2.5, 1.5),
      Q([12, 8], [8, 4], [4, 5], [2, 1], [6, 2], [7, 0], [9, 3], [11, 1], [13, 6]), Q([20, 8], [24, 4], [28, 5], [30, 1], [26, 2], [25, 0], [23, 3], [21, 1], [19, 6])],
    vashk: [E(16, 16, 11, 11)],
  };
  const EYES = { aurel: [[13, 12], [19, 12]], pell: [[13, 13], [19, 13]], marrow: [[13, 13], [19, 13]], ferryman: [[14, 14], [18, 14]], gorm: [[13, 9], [19, 9]],
    mab: [[13, 13], [19, 13]], tally: [[14, 13], [18, 13]], antlered: [[13, 14], [19, 14]] };
  const GLINT = { aurel: [[16, 2], [12, 4], [20, 4]], marrow: [[29, 12], [29, 13]], veiled: [[27, 11], [27, 12]], ferryman: [[29, 0], [29, 1]], mab: [[27, 22], [24, 21], [30, 21], [2, 15], [29, 15]], tally: [[16, 9]] };

  function inside(sh, x, y) {
    if (sh[0] === "e") { const dx = (x - sh[1]) / sh[3], dy = (y - sh[2]) / sh[4]; return dx * dx + dy * dy <= 1; }
    const p = sh[1];
    let c = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i], [xj, yj] = p[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  // a silhouette lit like the halls: deep ramp step, a shade on the far side, the outline, the eyes and the god's one glint
  function silhouette(id, W, H, map) {
    const cv = canvas(W, H), ctx = cv.getContext("2d"), sh = SHAPES[id] || SHAPES.vashk, r = ramp(id);
    const on = new Int8Array(W * H).fill(-1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [u, v] = map(x + 0.5, y + 0.5);
      if (u === null) { on[y * W + x] = 0; continue; }
      for (let i = sh.length - 1; i >= 0; i--) if (inside(sh[i], u, v)) { on[y * W + x] = i; break; }
    }
    const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && on[y * W + x] >= 0;
    const cloth = mix(r[0], "#2c2e40", 0.45), tones = [cloth, mix(cloth, r[1], 0.3), mix(cloth, "#6a6070", 0.3)];
    const face = mix(cloth, "#8a7068", 0.4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!at(x, y)) continue;
      const i = on[y * W + x], edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || (!at(x, y + 1) && y < H - 1);
      const seam = (at(x, y - 1) && on[(y - 1) * W + x] !== i && i < on[(y - 1) * W + x]) || (at(x + 1, y) && on[y * W + x + 1] > i);
      let c = id === "vashk" ? "#04050a" : sh[i][0] === "e" && i > 0 ? face : tones[i % 3];
      if (id !== "vashk" && x > W * 0.55 && ((x + y) & 1)) c = mix(c, "#0c0a14", 0.35);
      if (id !== "vashk" && x < W * 0.4 && y < H * 0.5 && ((x * 3 + y) % 4 === 0)) c = mix(c, "#9aa4c0", 0.18);
      ctx.fillStyle = edge || seam ? OUT : c;
      ctx.fillRect(x, y, 1, 1);
    }
    const s = W / 32, put = (pts, c) => { ctx.fillStyle = c; for (const [u, v] of pts) { const p = map.inv(u, v); if (at(p[0], p[1])) ctx.fillRect(p[0], p[1], Math.max(1, Math.floor(s * 0.75)), 1); } };
    if (EYES[id]) put(EYES[id], r[4]);
    if (GLINT[id]) put(GLINT[id], r[3]);
    if (id === "vashk") {
      ctx.fillStyle = "#2a1c3a";
      for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2, x = Math.round(W / 2 + Math.cos(t) * W * 0.36), y = Math.round(H / 2 + Math.sin(t) * H * 0.36); ctx.fillRect(x, y, 1, 1); }
    }
    return cv;
  }
  const bustMap = (() => { const m = (x, y) => [x, y]; m.inv = (u, v) => [Math.floor(u), Math.floor(v)]; return m; })();
  // the 48 px figure: the bust's shapes on the top 30 rows, a robe below, frame 1 sinks the head a pixel
  function figMap(frame) {
    const k = 30 / 32, ox = 9, oy = 1 + frame;
    const m = (x, y) => {
      if (y > 26 + frame) { const half = 6 + (y - 26) * 0.42; if (Math.abs(x - 24) <= half && y < 47) return [null, null]; }
      return [(x - ox) / k, (y - oy) / k];
    };
    m.inv = (u, v) => [Math.floor(u * k + ox), Math.floor(v * k + oy)];
    return m;
  }

  function fromImg(key, w, h) {
    const im = imgs[key];
    if (!im) return null;
    const c = canvas(w, h);
    c.getContext("2d").drawImage(im, 0, 0);
    return c;
  }
  function withMood(base, id, mood, k, dx, dy) {
    const ov = mood && imgs[id + ":" + k + "_" + mood];
    if (!ov) return base;
    const c = canvas(base.width, base.height), ctx = c.getContext("2d");
    ctx.drawImage(base, 0, 0); ctx.drawImage(ov, dx || 0, dy || 0);
    // a pixel the mood takes away comes in at alpha 1 (tools/god_art_build.py ERASE)
    const o = canvas(base.width, base.height), ox = o.getContext("2d");
    ox.drawImage(ov, dx || 0, dy || 0);
    const od = ox.getImageData(0, 0, o.width, o.height).data;
    let img = null;
    for (let i = 3; i < od.length; i += 4) if (od[i] === 1) { img = img || ctx.getImageData(0, 0, c.width, c.height); img.data[i] = 0; }
    if (img) ctx.putImageData(img, 0, 0);
    return c;
  }
  function memo(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }
  const px = (cv) => cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;

  function bust(id, mood, frame) {
    mood = moodOf(id, mood); frame = frame ? 1 : 0;
    return memo("b:" + id + ":" + (mood || "") + ":" + frame, () => {
      const b = fromImg(id + ":b32", 32, 32), one = b ? withMood(b, id, mood, "b32") : silhouette(id, 32, 32, bustMap);
      if (!frame) return one;
      const c = canvas(32, 32);
      c.getContext("2d").drawImage(one, 0, 1);
      return c;
    });
  }
  // the mood overlay is cut against frame 0; on the idle frame it goes where that frame's face moved to
  function shiftOf(id, mood) {
    const ov = imgs[id + ":f48_" + mood], f0 = fromImg(id + ":f48:0", 48, 48), f1 = fromImg(id + ":f48:1", 48, 48);
    if (!ov || !f0 || !f1) return [0, 0];
    const o = canvas(48, 48); o.getContext("2d").drawImage(ov, 0, 0);
    const a = px(o), p0 = px(f0), p1 = px(f1);
    let best = [0, 0], score = -1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      let s = 0;
      for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
        if (!a[(y * 48 + x) * 4 + 3]) continue;
        for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
          const X = x + i, Y = y + j, X1 = X + dx, Y1 = Y + dy;
          if (X < 0 || Y < 0 || X >= 48 || Y >= 48 || X1 < 0 || Y1 < 0 || X1 >= 48 || Y1 >= 48) continue;
          const k0 = (Y * 48 + X) * 4, k1 = (Y1 * 48 + X1) * 4;
          if (p0[k0] === p1[k1] && p0[k0 + 1] === p1[k1 + 1] && p0[k0 + 2] === p1[k1 + 2] && p0[k0 + 3] === p1[k1 + 3]) s++;
        }
      }
      if (s > score || (s === score && !dx && !dy)) { score = s; best = [dx, dy]; }
    }
    return best;
  }
  function erases(key) {
    const im = imgs[key];
    if (!im) return false;
    const c = canvas(im.width, im.height);
    c.getContext("2d").drawImage(im, 0, 0);
    const d = px(c);
    for (let i = 3; i < d.length; i += 4) if (d[i] === 1) return true;
    return false;
  }
  function figure(id, frame, mood) {
    frame = frame ? 1 : 0; mood = moodOf(id, mood);
    // an overlay that erases (Aurel's fist over his open hand) is cut against frame 0 alone, so that mood holds still
    if (frame && mood && memo("e:" + id + ":" + mood, () => erases(id + ":f48_" + mood))) frame = 0;
    return memo("f:" + id + ":" + frame + ":" + (mood || ""), () => {
      const f = fromImg(id + ":f48:" + frame, 48, 48);
      if (!f) return silhouette(id, 48, 48, figMap(frame));
      const [dx, dy] = frame && mood ? memo("s:" + id + ":" + mood, () => shiftOf(id, mood)) : [0, 0];
      return withMood(f, id, mood, "f48", dx, dy);
    });
  }
  // the rim: transparent pixels touching the sprite from above or the lit side take the fire's two lightest steps
  function rim(src, id, sides) {
    const w = src.width, h = src.height, c = canvas(w, h), ctx = c.getContext("2d");
    ctx.drawImage(src, 0, 0);
    const a = px(src), r = ramp(id);
    const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!op(x, y)) continue;
      const fall = y / h, side = fall < 0.45 || (fall < 0.7 && (y & 1) === 0);
      const top = !op(x, y - 1), l = side && sides.l && !op(x - 1, y), rr = side && sides.r && !op(x + 1, y);
      if (!top && !l && !rr) continue;
      ctx.fillStyle = top || fall < 0.3 ? r[4] : r[3];
      ctx.fillRect(x, y, 1, 1);
      if (top && op(x, y + 1) && op(x, y + 2) && (x + y) % 3 === 0) { ctx.fillStyle = r[3]; ctx.fillRect(x, y + 1, 1, 1); }
    }
    return c;
  }
  const litBust = (id, mood, frame) => memo("lb:" + id + ":" + (moodOf(id, mood) || "") + ":" + (frame ? 1 : 0), () => rim(bust(id, mood, frame), id, { l: true, r: true }));
  const litFigure = (id, frame, side, mood) => memo("lf:" + id + ":" + (frame ? 1 : 0) + ":" + (side || "r") + ":" + (moodOf(id, mood) || ""),
    () => rim(figure(id, frame, mood), id, side === "l" ? { l: true } : { r: true }));
  function idle(id, o) {
    o = o || {};
    const a = litFigure(id, 0, o.side, o.mood), b = litFigure(id, 1, o.side, o.mood), cv = canvas(48, 48), s = o.scale || 2;
    cv.className = "god-px" + (o.cls ? " " + o.cls : "");
    cv.style.width = cv.style.height = 48 * s + "px";
    cv.style.imageRendering = "pixelated";
    if (window.Anim) Anim.stage(cv, canvas(48, 48), [Anim.flip({ a, b, x: 0, y: 0, rate: 1.8, seed: id.length })], { fps: 10, still: 0 });
    else cv.getContext("2d").drawImage(a, 0, 0);
    return cv;
  }
  // the 128 px still: the export's mood is drawn as an overlay layer the page puts over the base
  function still(id, mood) {
    const g = window.GodSprites && GodSprites[id];
    if (!g || !g.s128) return null;
    const m = moodOf(id, mood);
    return { base: g.s128, over: (m && g["s128_" + m]) || null };
  }

  // Sable Vey is a mortal, a soothsayer who works the tables: her 32 px bust for the Mountain's box, drawn here (she has no god sprite)
  const SABLE = [
    "................................",
    "..............ooo...............",
    "..............oHo...............",
    ".............oLGho..............",
    "............oLHggGo.............",
    "............oLGggho.............",
    "...........oLHHHGHho............",
    "...........oLHhhhHho............",
    "..........oLHhbbbhHho...........",
    ".........oLHhbbbbbhHho..........",
    ".........oLhbbbbbbbhho..........",
    "........oLhbbbSsssbbhho.........",
    ".......oLHhbbSsssssbhHho........",
    ".......oLHhbSSSssSSbhHho........",
    "......oLHHhbSeesseebhHHho.......",
    "......oLHHhbSssssssbhHHho.......",
    ".....oLHHHhbSsssSssbhHHHho......",
    "....oLHHHHhbSssSsssbhHHHHho.....",
    "....oLHHHHHhsslllssgHHHHHho.....",
    "...oLHHHHHHHHsssssgHgHHHHHho....",
    "...oLHHHHHHHHHsssHHgHooooooo....",
    "..oLHHHHHHHHHHHHHHHHHorwwwwoo...",
    "..oLHHHHHHHHHHHHHHHHHowwrwwoo...",
    "..oLHHHHHHHHHHHHHHHHHowrrrwoo...",
    ".oLHHHHHHHHHHHHHHHHHHowrrrwoho..",
    ".oLHHHHHHHHHHHHggHHHHowwrwwoho..",
    ".oLHHHHHHHHHHHHggHHHHowwwwwoho..",
    "oLHHHHHHHHHHHHHGGHHHHowwwwroHho.",
    "oLHHHHHHHHHHHHHHHHHHHoooooooHho.",
    "oLHHHHHHHHHHHHHHHHHHossssoHHHho.",
    "oLHHHHHHHHHHHHHHHHHHossssoHHHHho",
    "oLHHHHHHHHHHHHHHHHHHHooooHHHHHho",
  ];
  const SABLE_PAL = { o: OUT, h: "#1e1824", H: "#3a2e48", L: "#5c4a74", s: "#ecc6a4", S: "#c08a70", e: "#1a1418", l: "#b83a50", g: "#f0c048",
    G: "#a87a28", w: "#f4ece0", r: "#c83a3a", b: "#120e16" };
  function sable() {
    return memo("sable", () => {
      const c = canvas(32, 32), g = c.getContext("2d");
      SABLE.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (SABLE_PAL[row[x]]) { g.fillStyle = SABLE_PAL[row[x]]; g.fillRect(x, y, 1, 1); } });
      return c;
    });
  }

  window.GodArt = { init, ready, icon: bust, bust, figure, litBust, litFigure, idle, still, mood: moodOf, drawn, fire, ramp, SHAPES, sable };
})();
