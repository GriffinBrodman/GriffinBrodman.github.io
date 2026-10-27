/* Town header scenes: one hand-built animated pixel panorama per town, plus matching panel colours (TownScenes.THEME). */
(function () {
  "use strict";
  const IH = 90;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const R = Math.round;
  const frac = (v) => ((v % 1) + 1) % 1;

  const THEME = {
    ironhaven: { primary: "#b83a32", accent: "#e8b84a", dark: "#2e2a36", light: "#ece8e0" },
    thornwall: { primary: "#a8743a", accent: "#e0b04a", dark: "#3e2818", light: "#f4e4c0" },
    veldrock: { primary: "#5e646e", accent: "#b8602a", dark: "#26282e", light: "#d8d6d0" },
    carrbridge: { primary: "#3a7ab8", accent: "#6a9a3a", dark: "#1e3446", light: "#e0eef4" },
    ashfen: { primary: "#4a6a62", accent: "#f0b44a", dark: "#1e2a28", light: "#d8dcc8" },
    hollowood: { primary: "#3a6a34", accent: "#d8b45a", dark: "#16261a", light: "#e4ecd0" },
    saltmarrow: { primary: "#2a6aa8", accent: "#d84a3a", dark: "#16304a", light: "#f4f0e4" },
    frosthold: { primary: "#4a7ab0", accent: "#8a5a34", dark: "#142440", light: "#f0f6ff" },
    // Goblin Town, the season the camp is a town (The Goblin Kingdom): the king's green and gold
    goblin_camp: { primary: "#4e8a3a", accent: "#e0b43a", dark: "#1e2e18", light: "#eef2d8" },
  };
  THEME.goblin_town = THEME.goblin_camp;

  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }
  function rect(ctx, x, y, w, h, c) {
    x = R(x); y = R(y); w = R(w); h = R(h);
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
  }
  function ln(ctx, x0, y0, x1, y1, c) {
    x0 = R(x0); y0 = R(y0); x1 = R(x1); y1 = R(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    ctx.fillStyle = c;
    for (let i = 0; i < 999; i++) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function kit(ctx, W, H, seed) {
    const r = Art.rng(seed);
    const F = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
    const P = (x, y, c) => rect(ctx, x, y, 1, 1, c);
    const k = { ctx, W, H, r, F, P };
    k.mix = Art.mix;
    k.rnd = (a, b) => a + r() * (b - a);
    k.ri = (a, b) => Math.floor(a + r() * (b - a + 1));
    k.pick = (a) => a[Math.floor(r() * a.length)];
    k.on = (x, y, f) => BAYER[(y & 3) * 4 + (x & 3)] < f;
    k.line = (x0, y0, x1, y1, c) => ln(ctx, x0, y0, x1, y1, c);
    k.grad = (y0, y1, stops, x0, x1) => {
      x0 = x0 || 0; x1 = x1 == null ? W : x1;
      const n = stops.length - 1;
      for (let y = y0; y < y1; y++) {
        const t = (y - y0) / Math.max(1, y1 - y0 - 1) * n, i = Math.min(n - 1, Math.floor(t)), f = Math.max(0, Math.min(1, (t - i - 0.5) * 3.2 + 0.5));
        if (f <= 0.02 || f >= 0.98) { F(x0, y, x1 - x0, 1, stops[f >= 0.98 ? i + 1 : i]); continue; }
        for (let x = x0; x < x1; x++) P(x, y, k.on(x, y, f) ? stops[i + 1] : stops[i]);
      }
    };
    k.dith = (x, y, w, h, c, f) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (k.on(xx, yy, f)) P(xx, yy, c); };
    k.noise = (s) => {
      const rr = Art.rng(s), v = [];
      for (let i = 0; i < 512; i++) v.push(rr());
      return (x) => { const i = Math.floor(x), f = x - i, e = f * f * (3 - 2 * f); return v[((i % 512) + 512) % 512] * (1 - e) + v[(((i + 1) % 512) + 512) % 512] * e; };
    };
    k.fbm = (n, x) => n(x) * 0.6 + n(x * 2.3 + 17) * 0.28 + n(x * 5.1 + 41) * 0.12;
    k.ridge = (y, amp, sc, c, s, rim, bottom) => {
      const n = k.noise(s), tops = [];
      for (let x = 0; x < W; x++) {
        const t = R(y - k.fbm(n, x / sc) * amp);
        tops.push(t);
        F(x, t, 1, (bottom == null ? H : bottom) - t, c);
        if (rim) P(x, t, rim);
      }
      return tops;
    };
    k.blob = (cx, cy, rx, ry, c) => {
      for (let yy = -ry; yy <= ry; yy++) { const w = R(rx * Math.sqrt(Math.max(0, 1 - (yy / (ry + 0.5)) ** 2))); F(cx - w, cy + yy, 2 * w + 1, 1, c); }
    };
    k.tri = (x, y, w, h, c) => {
      for (let i = 0; i < h; i++) { const ins = (w / 2) * (h - 1 - i) / h; F(R(x + ins), y + i, R(x + w - ins) - R(x + ins), 1, c); }
    };
    k.cloud = (cx, cy, w, cols) => {
      const [l, m, s] = cols || ["#ffffff", "#eef4fa", "#c4d6ea"];
      cx = R(cx); cy = R(cy);
      F(cx - R(w * 0.5), cy + 1, w, 2, s);
      k.blob(cx - R(w * 0.28), cy, R(w * 0.2), 2, m);
      k.blob(cx + R(w * 0.04), cy - 1, R(w * 0.24), 3, m);
      k.blob(cx + R(w * 0.3), cy + 0, R(w * 0.16), 2, m);
      k.blob(cx - R(w * 0.3), cy - 1, R(w * 0.12), 1, l);
      k.blob(cx - R(w * 0.02), cy - 2, R(w * 0.16), 2, l);
      F(cx - R(w * 0.45), cy + 2, R(w * 0.9), 1, s);
    };
    k.stones = (x, y, w, h, pal, rowH) => {
      rowH = rowH || 3;
      F(x, y, w, h, pal[3]);
      for (let yy = y, row = 0; yy < y + h; yy += rowH, row++) {
        let xx = x - (row % 2 ? 3 : 0);
        const hh = Math.min(rowH - 1, y + h - yy);
        while (xx < x + w) {
          const bw = k.ri(4, 7), x0 = Math.max(x, xx), x1 = Math.min(x + w, xx + bw - 1);
          if (x1 > x0) {
            const v = r(), c = v < 0.18 ? pal[2] : v > 0.8 ? pal[0] : pal[1];
            F(x0, yy, x1 - x0, hh, c);
            F(x0, yy, x1 - x0, 1, k.mix(c, pal[0], 0.55));
          }
          xx += bw;
        }
      }
    };
    k.win = (x, y, w, h, lit, fr) => {
      fr = fr || "#2a1e18";
      // after dark most of a town's windows have a lamp behind them (hashed from the spot, so the day's random draws don't shift)
      if (!lit && k.night) { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; lit = s - Math.floor(s) < 0.6; }
      F(x - 1, y - 1, w + 2, h + 2, fr);
      F(x, y, w, h, lit ? "#ffd27a" : "#3a4858");
      if (lit) F(x, y + h - 1, w, 1, "#e89a44"); else P(x, y, "#9ab0c4");
      if (w >= 3) F(x + (w >> 1), y, 1, h, fr);
      if (h >= 4 && w >= 3) F(x, y + (h >> 1), w, 1, fr);
    };
    k.house = (o) => {
      const { x, g, w, wh, rh } = o, top = g - wh, wl = o.wall, rf = o.roof, ol = o.ol || "#2a1e18", out = { top, tops: [] };
      F(x - 1, top, w + 2, wh, ol);
      F(x, top, w, wh, wl[1]); F(x, top, 1, wh, wl[0]); F(x + w - 1, top, 1, wh, wl[2]);
      if (o.planks) for (let xx = x + 2; xx < x + w - 1; xx += 2) F(xx, top + 2, 1, wh - 2, o.planks);
      if (o.logs) for (let yy = top + 3; yy < g; yy += 2) F(x, yy, w, 1, o.logs);
      if (o.frame) {
        const fc = o.frame, mid = top + 2 + ((wh - 3) >> 1);
        F(x, top + 2, w, 1, fc); F(x, g - 1, w, 1, fc); F(x, top, 1, wh, fc); F(x + w - 1, top, 1, wh, fc); F(x, mid, w, 1, fc);
        for (let xx = x + 6; xx < x + w - 3; xx += 7) { F(xx, top + 2, 1, wh - 2, fc); if (wh > 9) k.line(xx - 4, mid - 1, xx - 1, top + 3, fc); }
      }
      F(x, top, w, 2, wl[2]);
      const nWin = o.wins == null ? Math.max(1, Math.floor((w - 4) / 7)) : o.wins;
      const dx = o.door === false ? null : x + (o.doorAt == null ? (w >> 1) - 1 : o.doorAt);
      for (let i = 0; i < nWin; i++) {
        let wx = x + R((i + 0.5) * w / nWin) - 1;
        if (dx != null && Math.abs(wx - dx) < 4) wx = wx < dx ? dx - 5 : dx + 5;
        if (wx < x + 1 || wx > x + w - 4) continue;
        k.win(wx, top + 4 + (o.winDy || 0), o.winW || 2, o.winH || 3, o.lit == null ? r() < 0.4 : o.lit, ol);
      }
      if (dx != null) { F(dx - 1, g - 6, 5, 6, ol); F(dx, g - 5, 3, 5, o.doorC || "#6a4024"); F(dx, g - 5, 1, 5, k.mix(o.doorC || "#6a4024", "#ffffff", 0.2)); P(dx + 2, g - 3, "#e8c060"); out.door = dx + 1; }
      if (o.type === "gable") {
        k.tri(x - 3, top - rh - 1, w + 6, rh + 2, ol);
        for (let i = 0; i < rh; i++) {
          const ins = ((w + 4) / 2) * (rh - 1 - i) / rh, l = R(x - 2 + ins), rr = R(x + w + 2 - ins);
          F(l, top - rh + i, rr - l, 1, rf[1]);
          F(l, top - rh + i, Math.min(2, rr - l), 1, rf[0]);
          P(rr - 1, top - rh + i, rf[2]);
          out.tops.push([l, rr, top - rh + i]);
        }
        if (rh > 5) {
          k.tri(x + 1, top - rh + 3, w - 2, rh - 2, wl[1]);
          F(x + 1, top - 1, w - 2, 1, wl[2]);
          if (o.frame) F(x + (w >> 1), top - rh + 4, 1, rh - 4, o.frame);
          if (rh > 8) k.win(x + (w >> 1) - 1, top - R(rh * 0.45), 2, 2, o.lit, ol);
        }
        F(x - 2, top, w + 4, 1, rf[2]);
      } else {
        const slope = o.slope || 1.1, x0 = x - 2, x1 = x + w + 1;
        for (let cx = x0 - 1; cx <= x1 + 1; cx++) {
          const dist = Math.min(cx - x0, x1 - cx), u = (cx - x0) / (x1 - x0);
          const ct = top - rh + Math.max(0, rh - 1 - R(dist * slope)) + R((o.sag || 0) * Math.sin(Math.PI * Math.max(0, Math.min(1, u))));
          if (dist < 0) { F(cx, ct + 1, 1, top - ct, ol); continue; }
          P(cx, ct - 1, ol);
          for (let y = ct; y < top + 1; y++) {
            const j = y - ct;
            let c = j === 0 ? rf[0] : y >= top ? rf[2] : (j % 3 === 2) ? rf[2] : rf[1];
            if (o.speckle && c === rf[1] && r() < 0.18) c = r() < 0.5 ? rf[0] : rf[2];
            if (dist === 0) c = ol;
            P(cx, y, c);
          }
          out.tops.push([cx, ct]);
        }
      }
      if (o.chim) {
        const cx = x + R(w * (o.chim === "l" ? 0.2 : 0.7)), ch = o.chimH || 5, ct = top - R(rh * 0.6) - ch;
        F(cx - 1, ct - 1, 5, ch + 2, ol); F(cx, ct, 3, ch + 1, o.chimC || "#8a7a6a"); F(cx, ct, 1, ch + 1, k.mix(o.chimC || "#8a7a6a", "#ffffff", 0.25)); F(cx - 1, ct - 1, 5, 1, ol);
        out.chim = [cx + 1, ct - 2];
      }
      if (o.snow) {
        for (const t of out.tops) {
          if (t.length === 2) { F(t[0], t[1] - 2, 1, 2 + (r() < 0.5 ? 1 : 0), "#f4f8ff"); P(t[0], t[1] - 2, "#ffffff"); }
        }
        for (let xx = x - 1; xx < x + w + 1; xx += k.ri(2, 4)) F(xx, top + 1, 1, k.ri(1, 3), "#d8ecff");
      }
      return out;
    };
    k.tree = (x, y, s, pal) => {
      pal = pal || ["#1e4a24", "#3a8a34", "#5cb046", "#94d862"];
      F(x - 1, y - 3, 2, 4, "#5a3a22");
      k.blob(x, y - 4 - s, s + 1, s, pal[0]);
      k.blob(x - 1, y - 5 - s, s, s - 1, pal[1]);
      k.blob(x - 2, y - 6 - s, Math.max(1, s - 2), Math.max(1, s - 3), pal[2]);
      P(x - 3, y - 7 - s, pal[3]);
    };
    k.pine = (x, y, h, pal, snow) => {
      pal = pal || ["#1a3a30", "#2a5a44", "#3a7a54"];
      F(x, y - 2, 1, 3, "#4a3020");
      for (let i = 0; i < h; i++) {
        const w = 1 + R(i * 0.55) - ((i % 3 === 0 && i > 2) ? 1 : 0), yy = y - 2 - h + i;
        F(x - w, yy, w * 2 + 1, 1, pal[1]); F(x - w, yy, Math.max(1, w), 1, pal[2]); P(x + w, yy, pal[0]);
        if (snow && i % 3 === 1) F(x - w, yy, w + 1, 1, "#f0f6ff");
      }
      if (snow) P(x, y - 2 - h, "#ffffff");
    };
    k.tufts = (y, c1, c2, n) => {
      for (let i = 0; i < (n || W / 4); i++) { const x = k.ri(0, W), yy = y + k.ri(0, H - y); P(x, yy, c1); P(x + 1, yy - 1, c2 || c1); P(x - 1, yy - 1, c1); }
    };
    return k;
  }

  // ---------- custom actors ----------
  function pennant(o) {
    const ph = (o.seed || 0) * 1.7, len = o.len || 6, fh = o.h || 3;
    return { z: o.z == null ? 0 : o.z, front: o.front, draw(ctx, t) {
      for (let i = 0; i < len; i++) {
        const u = i / Math.max(1, len - 1), dy = R(Math.sin(t * 4.2 - i * 0.9 + ph) * u * 1.3), hh = Math.max(1, fh - (u > 0.7 ? 1 : 0));
        const x = o.x + 1 + i, y = o.y + dy;
        if (o.fork && i === len - 1) { rect(ctx, x, y, 1, 1, o.c1); rect(ctx, x, y + hh - 1, 1, 1, o.c3 || o.c1); continue; }
        rect(ctx, x, y, 1, hh, o.c1); rect(ctx, x, y, 1, 1, o.c2 || o.c1); if (hh > 2) rect(ctx, x, y + hh - 1, 1, 1, o.c3 || o.c1);
      }
    } };
  }
  function sails(o) {
    const ph = (o.seed || 0) * 0.7;
    return { z: o.z || 0, draw(ctx, t) {
      const a0 = t * (o.speed || 0.9) + ph;
      for (let q = 0; q < 4; q++) {
        const a = a0 + q * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
        ln(ctx, o.x, o.y, o.x + c * o.r, o.y + s * o.r, o.arm || "#4a3020");
        for (let d = 1; d <= 2; d++) ln(ctx, o.x + c * o.r * 0.35 - s * d, o.y + s * o.r * 0.35 + c * d, o.x + c * o.r - s * d, o.y + s * o.r + c * d, d === 1 ? (o.sail || "#f0e6cc") : (o.sail2 || "#c8b898"));
      }
      rect(ctx, o.x - 1, o.y - 1, 2, 2, "#2a1e14");
    } };
  }
  function wheel(o) {
    const ph = (o.seed || 0) * 0.5;
    return { z: o.z || 0, draw(ctx, t) {
      const a0 = t * (o.speed || 1.4) + ph;
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; rect(ctx, o.x + Math.cos(a) * o.r, o.y + Math.sin(a) * o.r, 1, 1, o.rim || "#3a2a1e"); }
      for (let q = 0; q < 3; q++) { const a = a0 + q * Math.PI / 3; ln(ctx, o.x - Math.cos(a) * o.r, o.y - Math.sin(a) * o.r, o.x + Math.cos(a) * o.r, o.y + Math.sin(a) * o.r, o.spoke || "#6a5038"); }
      rect(ctx, o.x, o.y, 1, 1, "#c8a060");
    } };
  }
  function railCart(o) {
    const ph = (o.seed || 0) * 0.3, per = o.period || 14;
    return { z: o.z || 0, draw(ctx, t) {
      const f = frac(t / per + ph), u = f < 0.4 ? f / 0.4 : f < 0.5 ? 1 : f < 0.9 ? 1 - (f - 0.5) / 0.4 : 0;
      const x = o.x0 + (o.x1 - o.x0) * u, y = o.y0 + (o.y1 - o.y0) * u;
      rect(ctx, x - 4, y - 5, 8, 4, "#2a2020"); rect(ctx, x - 3, y - 5, 6, 3, "#6a5a50"); rect(ctx, x - 3, y - 5, 6, 1, "#8a7a6c");
      if (f < 0.5) { rect(ctx, x - 2, y - 7, 4, 2, "#5a5654"); rect(ctx, x - 1, y - 7, 1, 1, "#b8642a"); rect(ctx, x + 1, y - 6, 1, 1, "#8a8a8e"); }
      rect(ctx, x - 3, y - 1, 2, 1, "#1a1414"); rect(ctx, x + 1, y - 1, 2, 1, "#1a1414");
    } };
  }
  function swing(o) {
    const ph = (o.seed || 0) * 1.3;
    return { z: o.z || 0, draw(ctx, t) {
      const d = R(Math.sin(t * 1.4 + ph) * 0.7);
      rect(ctx, o.x, o.y, 1, 2, "#2a1e14"); rect(ctx, o.x + 6, o.y, 1, 2, "#2a1e14");
      rect(ctx, o.x - 1 + d, o.y + 2, 9, 6, "#2a1e14"); rect(ctx, o.x + d, o.y + 3, 7, 4, o.board || "#8a5a30"); rect(ctx, o.x + d, o.y + 3, 7, 1, "#b07a44");
      if (o.icon === "mug") { rect(ctx, o.x + 2 + d, o.y + 4, 2, 3, "#f0c040"); rect(ctx, o.x + 2 + d, o.y + 4, 2, 1, "#ffffff"); rect(ctx, o.x + 4 + d, o.y + 5, 1, 1, "#f0c040"); }
      else if (o.icon === "lantern") { rect(ctx, o.x + 3 + d, o.y + 4, 1, 2, "#ffd060"); }
      else { rect(ctx, o.x + 2 + d, o.y + 4, 3, 2, o.icon || "#c8463a"); }
    } };
  }
  function barrier(o) {
    const ph = (o.seed || 0) * 0.1, per = o.period || 11;
    return { z: o.z || 0, front: o.front, draw(ctx, t) {
      const f = frac(t / per + ph), lift = f < 0.55 ? 0 : f < 0.62 ? (f - 0.55) / 0.07 : f < 0.85 ? 1 : f < 0.92 ? 1 - (f - 0.85) / 0.07 : 0;
      const a = -lift * 1.25 * (o.dir || 1), c = Math.cos(a), s = Math.sin(a);
      for (let i = 0; i < o.len; i++) rect(ctx, o.x + (o.dir || 1) * c * i, o.y + s * i * (o.dir || 1), 1, 1, (i >> 1) % 2 ? "#f4f0e8" : "#c8302a");
      rect(ctx, o.x - 1, o.y - 1, 3, 3, "#3a2a1e");
    } };
  }
  function rowboat(o) {
    const A = window.Anim, ph = (o.seed || 0) * 0.37;
    const pal = { b: o.hull || "#8a5a30", d: "#5a3a1e", l: "#b07a44", s: o.skin || "#e0b088", c: o.shirt || "#3a5a8a", h: o.hat || "#3a2a1a" };
    const body = A.sprite(["....h....", "....s....", "....c....", "lbbbbbbbl", ".dddddddd"].map((s) => s.replace(/^l/, "b")), pal);
    const span = o.x1 - o.x0, per = o.period || 40;
    return { z: o.y, front: o.front, draw(ctx, t) {
      const f = frac(t / per + ph), right = f < 0.5, u = right ? f * 2 : 2 - f * 2;
      const x = o.x0 + span * u, y = o.y + R(Math.sin(t * 2.1 + ph) * 0.6);
      A.put(ctx, body, x, y, !right);
      const st = Math.floor(t * 2 + ph) % 2;
      rect(ctx, x + (st ? -4 : -3), y - 1, 1, 1, "#e8f4ff"); rect(ctx, x + (st ? 3 : 4), y - 1, 1, 1, "#e8f4ff");
      rect(ctx, x - 1, y - 3 + st, 3, 1, "#5a3a1e");
      ctx.globalAlpha = 0.5; rect(ctx, x - 5, y + 1, 10, 1, o.wake || "#d8ecf4"); ctx.globalAlpha = 1;
    } };
  }
  function eel(o) {
    const ph = (o.seed || 0) * 0.31, per = o.period || 7;
    return { z: o.y, draw(ctx, t) {
      const f = frac(t / per + ph);
      if (f > 0.22) return;
      const a = f / 0.16;
      if (a <= 1) for (let s = 0; s < 4; s++) {
        const u = Math.max(0, Math.min(1, a - s * 0.07)), x = o.x + u * 10, y = o.y - Math.sin(u * Math.PI) * 7;
        rect(ctx, x, y, 2, 1, s === 0 ? "#5a6a4a" : "#3e4a36");
        if (s === 0) rect(ctx, x + 1, y, 1, 1, "#c8d0a0");
      }
      const sp = Math.min(1, f / 0.05), sp2 = Math.max(0, (f - 0.14) / 0.08);
      ctx.fillStyle = "#c8dcd0";
      if (f < 0.07) { ctx.fillRect(R(o.x - sp * 2), o.y, 1, 1); ctx.fillRect(R(o.x + 1 + sp * 2), o.y, 1, 1); }
      if (f > 0.14) { ctx.fillRect(R(o.x + 10 - sp2 * 3), o.y, 1, 1); ctx.fillRect(R(o.x + 11 + sp2 * 3), o.y, 1, 1); ctx.fillRect(R(o.x + 10), o.y - 1 - R(sp2), 1, 1); }
    } };
  }
  function surf(o) {
    const ps = o.pts.map((p, i) => [p[0], p[1], ((o.seed || 0) * 0.17 + i * 0.37) % 1, 2.6 + (i % 3) * 0.5]);
    return { z: o.z || 0, front: o.front, draw(ctx, t) {
      for (const [x, y, ph, per] of ps) {
        const a = frac(t / per + ph);
        if (a > 0.6) continue;
        const u = a / 0.6;
        for (let s = 0; s < 6; s++) {
          const sx = x + (s - 2.5) * (1 + u * 2.2), sy = y - Math.sin(Math.min(1, u * 1.3) * Math.PI) * (5 + (s % 3) * 2) * (1 - u * 0.3);
          ctx.globalAlpha = 1 - u * 0.7;
          rect(ctx, sx, sy, u < 0.5 ? 2 : 1, 1, s % 2 ? "#ffffff" : "#d8f0fa");
        }
        ctx.globalAlpha = 0.8 * (1 - u);
        rect(ctx, x - 4 - u * 4, y, 9 + u * 8, 1, "#ffffff");
        ctx.globalAlpha = 1;
      }
    } };
  }
  function shore(o) {
    const ph = (o.seed || 0) * 0.2;
    return { z: o.z || 0, draw(ctx, t) {
      const f = 0.5 + 0.5 * Math.sin(t * 0.9 + ph);
      for (let x = o.x0; x < o.x1; x++) {
        const y = o.line(x) - R(f * 2.2 + Math.sin(x * 0.4 + t) * 0.6);
        rect(ctx, x, y, 1, 1, (x + Math.floor(t * 3)) % 7 === 0 ? "#bfe6f6" : "#ffffff");
        if (f > 0.5 && x % 3 === 0) { ctx.globalAlpha = 0.5; rect(ctx, x, y + 1, 1, 1, "#e8f6ff"); ctx.globalAlpha = 1; }
      }
    } };
  }
  function beam(o) {
    const A = window.Anim;
    return { z: o.z || 0, front: true, light: true, draw(ctx, t) {
      const s = Math.sin(t * 0.8), dir = s > 0 ? 1 : -1, str = Math.abs(s);
      A.light(ctx, o.x, o.y, 10, "255,236,160", 0.35 + 0.35 * str);
      for (let i = 2; i < o.len * str; i++) {
        const hh = 1 + i * 0.09;
        ctx.globalAlpha = 0.3 * (1 - i / o.len) * str;
        rect(ctx, o.x + dir * i, o.y - hh, 1, hh * 2 + 1, "#fff4c0");
      }
      ctx.globalAlpha = 1;
      rect(ctx, o.x - 1, o.y - 1, 3, 2, "#fff8d8");
    } };
  }
  function aurora(o) {
    const ph = (o.seed || 0) * 0.13;
    return { z: -100, light: true, draw(ctx, t) {
      for (let x = 0; x < o.W; x += 2) {
        const y = o.y + Math.sin(x * 0.034 + t * 0.22 + ph) * 5 + Math.sin(x * 0.012 - t * 0.15 + 1) * 7;
        const a = Math.max(0, 0.5 + 0.5 * Math.sin(x * 0.045 - t * 0.5) * Math.sin(x * 0.017 + t * 0.21 + 2));
        if (a < 0.08) continue;
        ctx.globalAlpha = a * 0.24; rect(ctx, x, y - o.h, 2, o.h, o.cols[0]);
        ctx.globalAlpha = a * 0.36; rect(ctx, x, y - o.h * 0.45, 2, o.h * 0.45, o.cols[1]);
        ctx.globalAlpha = a * 0.7; rect(ctx, x, y - 2, 2, 2, o.cols[2]);
        ctx.globalAlpha = a * 0.22; rect(ctx, x, y - o.h - 3, 2, 3, o.cols[3] || o.cols[0]);
      }
      ctx.globalAlpha = 1;
    } };
  }
  function leaves(o) {
    const r = Art.rng((o.seed || 5) * 7919 + 3), ps = [];
    for (let i = 0; i < (o.n || 10); i++) ps.push([o.x + r() * o.w, r() * 40, 4 + r() * 5, r() * 6, o.cols[Math.floor(r() * o.cols.length)]]);
    return { z: 1e4, front: true, draw(ctx, t) {
      const span = o.y1 - o.y0;
      for (const [x0, y0, sp, ph, c] of ps) {
        const y = o.y0 + ((y0 + t * sp) % span), x = x0 + Math.sin(t * 1.3 + ph) * 3 + t * 0.4 % 1;
        rect(ctx, x, y, Math.floor(t * 3 + ph) % 2 ? 2 : 1, 1, c);
      }
    } };
  }
  function shafts(o) {
    return { z: -200, day: true, draw(ctx, t) {
      for (const [x0, w, a, ph] of o.list) {
        const al = a * (0.75 + 0.25 * Math.sin(t * 0.45 + ph));
        for (let y = o.y0; y < o.y1; y += 1) {
          const u = (y - o.y0) / (o.y1 - o.y0);
          ctx.globalAlpha = al * (u < 0.15 ? u / 0.15 : 1 - u * 0.6);
          rect(ctx, x0 + (y - o.y0) * o.slope, y, w, 1, o.col || "#fff4b0");
        }
      }
      ctx.globalAlpha = 1;
    } };
  }
  function rope(o) {
    const ph = (o.seed || 0) * 0.9;
    return { z: o.z || 0, draw(ctx, t) {
      const sw = o.sag + Math.sin(t * 1.1 + ph) * 0.9 + Math.sin(t * 2.6 + ph) * 0.3;
      const n = Math.abs(o.x1 - o.x0);
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = o.x0 + (o.x1 - o.x0) * u, base = o.y0 + (o.y1 - o.y0) * u, y = base + sw * 4 * u * (1 - u);
        const yr = y - 4 - Math.sin(t * 1.1 + ph + 0.4) * 0.3 * 4 * u * (1 - u);
        rect(ctx, x, y, 1, 1, i % 2 ? "#b08a54" : "#8a6a3e"); rect(ctx, x, y + 1, 1, 1, "#4a3420");
        rect(ctx, x, yr, 1, 1, "#c8a46a");
        if (i % 3 === 0) { ctx.globalAlpha = 0.7; rect(ctx, x, yr + 1, 1, y - yr - 1, "#a8844e"); ctx.globalAlpha = 1; }
      }
    } };
  }
  function chicken(o) {
    const A = window.Anim, ph = (o.seed || 0) * 0.71;
    const pal = { w: o.col || "#f4ece0", r: "#d83a2a", y: "#e8a830", k: "#1a1220" };
    // three pixels tall: a hen comes up to a villager's knee, not their chest
    const stand = A.sprite(["...r.", "wwwky", ".y.y."], pal), peck = A.sprite([".....", "wwww.", ".y.wr"], pal);
    return { z: o.y, walker: true, draw(ctx, t) {
      const f = frac(t / 5 + ph), x = o.x + R(Math.sin(f * Math.PI * 2) * (o.range || 4));
      A.put(ctx, Math.floor(t * 2.5 + ph * 5) % 3 === 0 ? peck : stand, x, o.y, Math.cos(f * Math.PI * 2) < 0);
    } };
  }
  function ship(o) {
    const ph = (o.seed || 0) * 0.3;
    return { z: -80, draw(ctx, t) {
      const x = o.x0 + frac(t / (o.period || 120) + ph) * (o.x1 - o.x0), y = o.y + R(Math.sin(t * 1.3) * 0.4);
      rect(ctx, x - 4, y - 1, 9, 2, "#3a2a24"); rect(ctx, x - 3, y + 1, 7, 1, "#2a1e1a");
      rect(ctx, x, y - 9, 1, 8, "#3a2a24");
      rect(ctx, x - 3, y - 8, 3, 6, "#f4f0e4"); rect(ctx, x + 1, y - 7, 3, 5, "#e0dcd0"); rect(ctx, x - 3, y - 8, 1, 6, "#ffffff");
      rect(ctx, x, y - 10, 2, 1, "#c8302a");
    } };
  }
  function plume(o) {
    const r = Art.rng((o.seed || 1) * 977 + 5), phase = r(), n = o.n || 6, rise = o.rise || 26, life = o.life || 5;
    const cols = o.cols || ["#3a3a40", "#4e4e56", "#66666e", "#7e7e86", "#8e8e96"];
    return { z: -5, draw(ctx, t) {
      for (let i = 0; i < n; i++) {
        const a = frac(t / life + phase + i / n), sz = 1 + R(a * 3), ci = Math.min(3, Math.floor(a * 4));
        const x = o.x + Math.sin(a * 3 + phase * 6 + i) * 1.5 + a * a * (o.wind == null ? 12 : o.wind), y = o.y - a * rise;
        ctx.globalAlpha = Math.max(0, 0.85 * (1 - a * a));
        rect(ctx, x - (sz >> 1), y - (sz >> 1), sz + 1, sz, cols[ci]);
        rect(ctx, x - (sz >> 1), y - (sz >> 1), sz, 1, cols[ci + 1]);
      }
      ctx.globalAlpha = 1;
    } };
  }
  function walker(o) {
    const A = window.Anim, r = A.rng(o.seed || 1), lk = A.look(r, o.look), phase = r();
    const top = lk.hood ? ["hh.", "hs."] : lk.hat ? ["aaa", ".s."] : [".h.", ".s."];
    const mid = ["ccc", lk.carry ? "cccb" : "ccc"];
    const legs = lk.dress ? [["ccc", "f.f"], ["ccc", ".f."]] : [["p.p", "f.f"], [".p.", ".f."]];
    const pal = { h: lk.hood || lk.hair, s: lk.skin, a: lk.hat, c: lk.shirt, p: lk.legs, f: "#2a1e1a", b: lk.carry };
    const fr = legs.map((l) => A.sprite(top.concat(mid, l), pal));
    const left = r() < 0.5, speed = o.speed || 5, len = o.x1 - o.x0 + 8, per = len / speed + (o.gap == null ? 8 : o.gap);
    return { z: o.z || 0, draw(ctx, t) {
      const d = frac(t / per + phase) * per * speed;
      if (d > len) return;
      const x = left ? o.x1 + 4 - d : o.x0 - 4 + d;
      A.put(ctx, fr[Math.floor(t * 6 + phase * 8) % 2], x, o.yAt(x), left);
    } };
  }
  function sparkle(o) {
    const r = Art.rng((o.seed || 3) * 131 + 7), ps = [];
    for (let i = 0; i < o.n; i++) ps.push([o.x + r() * o.w, o.y + r() * o.h, r(), 1.5 + r() * 2.5]);
    return { z: o.z || 0, day: true, draw(ctx, t) {
      for (const [x, y, ph, per] of ps) {
        const a = frac(t / per + ph);
        if (a > 0.35) continue;
        rect(ctx, x, y, a > 0.1 && a < 0.25 ? 3 : 1, 1, o.col || "#ffffff");
      }
    } };
  }
  function raven(o) {
    const A = window.Anim, ph = (o.seed || 0) * 0.9;
    const pal = { k: "#16141a", b: "#e8b84a" };
    const a = A.sprite(["..kk.", ".kkkb", "kkkk.", "..k.."], pal, null), b = A.sprite([".....", "..kkb", "kkkk.", "..k.."], pal, null);
    return { z: o.y, draw(ctx, t) { A.put(ctx, frac(t / 4 + ph) < 0.15 ? b : a, o.x, o.y, frac(t / 9 + ph) < 0.5); } };
  }

  // ---------- the towns ----------
  function ironhaven(k, A) {
    const { W, F, P } = k, add = k.add;
    const ST = ["#dcd8d0", "#b2aea8", "#8a8690", "#5e5a66"], OL = "#2a2430";
    const RED = ["#ec6a54", "#c03c32", "#7e2228"], GOLD = ["#fff2a8", "#f0c050", "#b07a28", "#7a5018"], MAR = ["#ffffff", "#eeeae2", "#c8c2b8", "#968e86"];
    const SLATE = ["#8a9ab8", "#5e6e90", "#3e4a68"];
    k.grad(0, 64, ["#3a78cc", "#5294dc", "#7eb4ea", "#b0d4f0", "#ecdcb8"]);
    k.cloud(W * 0.1, 12, 28); k.cloud(W * 0.83, 8, 36); k.cloud(W * 0.55, 16, 16);
    k.ridge(52, 10, 34, "#a8bcd4", 11, "#bccce0");
    k.ridge(57, 6, 16, "#8eaab0", 12);
    const aqY = 40, aqX1 = R(W * 0.2);
    for (let x = -4; x < aqX1; x += 10) { F(x, aqY + 4, 3, 22, ST[2]); F(x, aqY + 4, 1, 22, ST[1]); F(x + 3, aqY + 4, 2, 2, ST[2]); F(x + 9, aqY + 4, 1, 2, ST[2]); }
    F(-1, aqY, aqX1 + 1, 4, ST[1]); F(-1, aqY, aqX1 + 1, 1, ST[0]); F(-1, aqY + 3, aqX1 + 1, 1, ST[2]); F(aqX1, aqY, 1, 4, ST[3]);
    const chims = [];
    for (let x = -3; x < W; ) {
      const w = k.ri(8, 12), wh = k.ri(9, 14), g = 62 - k.ri(0, 3);
      const h = k.house({ x, g, w, wh, rh: k.ri(4, 6), wall: ["#f0e6d4", "#ddd0b8", "#b4a48c"], roof: k.r() < 0.55 ? RED : SLATE, ol: OL, door: false, wins: 1, lit: false, type: k.r() < 0.3 ? "gable" : "hip", chim: k.r() < 0.3 ? "r" : null, chimC: "#a09a94" });
      if (h.chim) chims.push(h.chim);
      x += w + k.ri(1, 3);
    }
    for (const sx of [W * 0.12, W * 0.86]) {
      const x = R(sx);
      F(x - 4, 28, 9, 34, OL); F(x - 3, 29, 7, 33, MAR[1]); F(x - 3, 29, 2, 33, MAR[0]); F(x + 2, 29, 2, 33, MAR[2]);
      for (let y = 33; y < 60; y += 7) { F(x - 1, y, 2, 3, "#3a3444"); }
      k.tri(x - 5, 16, 11, 13, OL); k.tri(x - 4, 17, 9, 12, SLATE[1]); k.tri(x - 4, 17, 4, 12, SLATE[0]);
      F(x, 12, 1, 5, "#3a2a1e");
      add(pennant({ x, y: 12, len: 5, h: 2, c1: RED[1], c2: RED[0], seed: x }));
    }
    const dx = R(W * 0.29);
    F(dx - 18, 50, 36, 12, OL); k.stones(dx - 17, 51, 34, 11, [MAR[0], MAR[1], MAR[2], MAR[3]]);
    F(dx - 13, 37, 26, 14, OL);
    for (let x = dx - 12; x < dx + 12; x++) {
      const u = (x - dx + 12) / 24, c = (x - dx + 12) % 3 === 2 ? (u < 0.3 ? MAR[2] : MAR[3]) : u < 0.25 ? MAR[0] : u < 0.7 ? MAR[1] : MAR[2];
      F(x, 39, 1, 11, c);
    }
    for (let x = dx - 10; x < dx + 10; x += 6) k.win(x, 42, 2, 4, false, OL);
    F(dx - 14, 36, 28, 3, OL); F(dx - 13, 36, 26, 2, MAR[0]); F(dx - 13, 49, 26, 1, MAR[3]);
    for (let yy = -13; yy <= 0; yy++) {
      const hw = R(12.5 * Math.sqrt(1 - (yy / 13.5) ** 2));
      F(dx - hw - 1, 35 + yy, hw * 2 + 3, 1, OL);
      for (let x = -hw; x <= hw; x++) {
        const u = x / (hw + 0.01), v = yy / 13;
        let c = u < -0.55 + v * 0.2 ? GOLD[0] : u < 0.2 ? GOLD[1] : u < 0.7 ? GOLD[2] : GOLD[3];
        if ((x === -6 || x === 0 || x === 6) && yy > -12) c = u < -0.3 ? GOLD[1] : GOLD[3];
        if (u < -0.3 && u > -0.5 && v < -0.4 && v > -0.75) c = "#ffffff";
        P(dx + x, 35 + yy, c);
      }
    }
    F(dx - 3, 17, 7, 6, OL); F(dx - 2, 18, 5, 5, MAR[1]); F(dx - 2, 18, 1, 5, MAR[0]); P(dx, 20, "#3a3444"); P(dx, 21, "#3a3444");
    k.blob(dx, 17, 3, 1, GOLD[2]); F(dx - 2, 16, 3, 1, GOLD[1]);
    F(dx, 11, 1, 5, GOLD[2]); P(dx, 10, GOLD[0]);
    add(pennant({ x: dx, y: 10, len: 7, h: 3, c1: RED[1], c2: RED[0], c3: RED[2], fork: true, seed: 3 }));
    const hx = R(W * 0.68);
    F(hx - 23, 56, 46, 6, OL); F(hx - 22, 59, 44, 3, MAR[2]); F(hx - 21, 56, 42, 3, MAR[1]); F(hx - 21, 56, 42, 1, MAR[0]);
    F(hx - 20, 40, 40, 16, "#4a3e44");
    for (let i = 0; i < 6; i++) {
      const bx = hx - 15 + i * 6;
      if (i < 5) { F(bx + 2, 41, 3, 9, RED[1]); F(bx + 2, 41, 1, 9, RED[0]); P(bx + 3, 44, GOLD[1]); P(bx + 2, 50, RED[1]); P(bx + 4, 50, RED[2]); }
    }
    for (let i = 0; i < 7; i++) {
      const cx = hx - 20 + i * 6;
      F(cx - 1, 40, 5, 16, OL); F(cx, 40, 3, 16, MAR[1]); F(cx, 40, 1, 16, MAR[0]); F(cx + 2, 40, 1, 16, MAR[3]);
      F(cx - 1, 40, 5, 1, MAR[0]); F(cx - 1, 55, 5, 1, MAR[2]);
    }
    F(hx - 22, 35, 44, 6, OL); F(hx - 21, 36, 42, 4, MAR[1]); F(hx - 21, 36, 42, 1, MAR[0]); F(hx - 21, 38, 42, 1, RED[1]);
    for (let x = hx - 20; x < hx + 21; x += 3) P(x, 38, GOLD[1]);
    k.tri(hx - 23, 25, 46, 11, OL); k.tri(hx - 21, 26, 42, 9, MAR[1]); k.tri(hx - 17, 28, 34, 7, MAR[2]);
    for (let i = 0; i < 9; i++) { const ins = R(21 * (8 - i) / 9); P(hx - 21 + ins, 26 + i, MAR[0]); P(hx - 20 + ins, 26 + i, MAR[0]); }
    k.blob(hx, 31, 2, 2, GOLD[2]); k.blob(hx, 31, 1, 1, GOLD[1]); P(hx - 1, 30, GOLD[0]);
    F(hx, 21, 1, 4, GOLD[2]); P(hx, 20, GOLD[0]); P(hx - 21, 34, GOLD[1]); P(hx + 20, 34, GOLD[1]);
    const gx = R(W * 0.48), wy = 62;
    k.stones(0, wy, W, 18, ST);
    F(0, wy, W, 1, ST[0]); F(0, wy + 16, W, 2, ST[3]);
    for (let x = 0; x < W; x += 5) { F(x, wy - 3, 3, 3, OL); F(x, wy - 2, 3, 2, ST[1]); P(x, wy - 2, ST[0]); }
    F(0, wy - 1, W, 1, OL); F(0, wy - 1, W, 1, ST[2]);
    for (let i = 0; i < W / 30; i++) {
      const bx = R(W * 0.03 + i * 30 + 12);
      if (Math.abs(bx - gx) < 26) continue;
      F(bx - 1, wy, 7, 13, OL); F(bx, wy, 5, 11, RED[1]); F(bx, wy, 1, 11, RED[0]); F(bx + 4, wy, 1, 11, RED[2]);
      F(bx, wy + 2, 5, 1, GOLD[1]); P(bx + 2, wy + 5, GOLD[0]); F(bx + 1, wy + 6, 3, 1, GOLD[1]); P(bx + 2, wy + 7, GOLD[2]);
      F(bx + 1, wy + 11, 3, 1, RED[1]); P(bx + 2, wy + 11, OL); P(bx + 2, wy + 12, OL); P(bx, wy + 11, RED[1]); P(bx + 4, wy + 11, RED[2]);
    }
    const tower = (tx, top, tall) => {
      F(tx - 7, top, 15, 82 - top, OL);
      for (let x = tx - 6; x <= tx + 6; x++) {
        const u = (x - tx + 6) / 12, c = u < 0.18 ? ST[0] : u < 0.6 ? ST[1] : u < 0.88 ? ST[2] : ST[3];
        F(x, top + 3, 1, 79 - top - 3, c);
      }
      for (let y = top + 6; y < 80; y += 3) for (let x = tx - 6 + (y % 2) * 2; x <= tx + 6; x += 4) P(x, y, ST[3]);
      F(tx - 1, top + 9, 2, 4, "#2a2228"); F(tx - 1, top + 18, 2, 4, "#2a2228");
      F(tx - 7, top, 15, 3, ST[1]); F(tx - 7, top, 15, 1, ST[0]);
      for (let x = tx - 7; x <= tx + 7; x += 3) { F(x, top - 2, 2, 2, ST[1]); P(x, top - 2, ST[0]); P(x, top - 3, OL); P(x + 1, top - 3, OL); }
      if (tall) {
        k.tri(tx - 8, top - 16, 17, 14, OL); k.tri(tx - 7, top - 15, 15, 13, RED[1]);
        for (let i = 0; i < 13; i++) { const ins = (7.5) * (12 - i) / 13; P(R(tx - 7 + ins), top - 15 + i, RED[0]); P(R(tx - 7 + ins) + 1, top - 15 + i, RED[0]); P(R(tx + 8 - ins) - 1, top - 15 + i, RED[2]); }
        F(tx, top - 21, 1, 6, "#3a2a1e"); P(tx, top - 22, GOLD[1]);
        add(pennant({ x: tx, y: top - 21, len: 7, h: 3, c1: k.r() < 0.5 ? RED[1] : GOLD[1], c2: k.r() < 0.5 ? RED[0] : GOLD[0], c3: RED[2], fork: true, seed: tx }));
      }
    };
    F(gx - 12, 50, 24, 32, OL); k.stones(gx - 11, 51, 22, 31, ST);
    for (let x = gx - 12; x < gx + 12; x += 4) { F(x, 47, 3, 3, ST[1]); P(x, 47, ST[0]); }
    F(gx - 12, 50, 24, 1, ST[0]);
    for (let y = 0; y < 16; y++) {
      const ins = y < 5 ? R(5 - Math.sqrt(25 - (5 - y) ** 2)) : 0;
      F(gx - 6 + ins, 64 + y, 12 - ins * 2, 1, y < 5 && ins > 0 ? "#2a2228" : "#3a2e2e");
    }
    F(gx - 6, 62, 12, 2, OL); F(gx - 7, 64, 1, 16, OL); F(gx + 6, 64, 1, 16, OL);
    for (let x = gx - 5; x < gx + 6; x += 2) F(x, 63, 1, 7, "#6a5a4a");
    F(gx - 6, 66, 12, 1, "#6a5a4a"); F(gx - 6, 69, 12, 1, "#6a5a4a"); for (let x = gx - 5; x < gx + 6; x += 2) P(x, 70, "#9a8a6a");
    F(gx - 4, 53, 9, 9, OL); F(gx - 3, 53, 7, 8, RED[1]); F(gx - 3, 53, 1, 8, RED[0]); F(gx - 1, 55, 3, 2, GOLD[1]); P(gx - 1, 54, GOLD[0]); P(gx + 1, 54, GOLD[0]); P(gx, 54, GOLD[0]); P(gx, 58, GOLD[2]);
    tower(gx - 17, 46, true); tower(gx + 17, 46, true);
    tower(R(W * 0.05), 50, true); tower(R(W * 0.95), 50, true);
    if (W > 260) { tower(R(W * 0.22), 54, false); tower(R(W * 0.77), 54, false); }
    k.grad(80, 90, ["#7ab84a", "#5e9a3a"]);
    k.tufts(81, "#4a8a32", "#8ac85a", W / 5);
    for (let y = 80; y < 90; y++) { const hw = 6 + R((y - 80) * 1.4); F(gx - hw, y, hw * 2, 1, "#e6d098"); P(gx - hw, y, "#c4a868"); P(gx + hw - 1, y, "#c4a868"); }
    F(0, 85, W, 4, "#e6d098"); F(0, 85, W, 1, "#c4a868"); F(0, 89, W, 1, "#c4a868");
    for (let x = 3; x < W; x += 7) P(x, 87, "#d0b67c");
    for (let i = 0; i < W / 18; i++) { const x = k.ri(2, W - 2); if (Math.abs(x - gx) > 14) { P(x, 82, k.pick(["#f4f0e8", "#f0d050", "#e86a5a"])); } }
    for (const [x, y] of chims) add(A.smoke({ x, y, wind: 4, seed: x }));
    add(A.bird({ W, y: 20, flock: 4, speed: 10, gap: 12, seed: 4 }));
    add(A.bird({ W, y: 30, flock: 2, speed: 13, gap: 20, seed: 9 }));
    add(A.villager({ x0: gx - 9, x1: gx - 8, y: 81, speed: 1, rest: 0.45, look: { shirt: RED[1], hat: "#9a9aa6", carry: "#c8c8d0", dress: false }, seed: 31 }));
    add(A.villager({ x0: gx + 8, x1: gx + 9, y: 81, speed: 1, rest: 0.45, look: { shirt: RED[1], hat: "#9a9aa6", carry: "#c8c8d0", dress: false }, seed: 32 }));
    for (let i = 0; i < 5; i++) add(A.villager({ mode: "cross", x0: 0, x1: W, y: 87 + (i % 2), speed: k.rnd(4, 7), gap: k.rnd(2, 12), seed: 40 + i }));
    for (let i = 0; i < 3; i++) add(A.villager({ x0: gx - 4 + i * 2, x1: gx + 2 + i * 2, y: 82 + (i % 2) * 2, speed: 2, seed: 50 + i }));
    add(A.wagon({ W, y: 88, speed: 7, gap: 8, seed: 61 }));
    add(A.wagon({ W, y: 89, speed: 6, gap: 14, horse: "#5a3a22", seed: 62 }));
  }

  function thornwall(k, A) {
    const { W, F, P } = k, add = k.add;
    const PL = ["#f8e2a8", "#e8c47e", "#c0925a"], BM = "#5a3a22", OL = "#2e1e14";
    const TH = ["#f4d27a", "#d0a44c", "#94682c"], TILE = ["#d8784a", "#b05634", "#7a3420"];
    k.grad(0, 52, ["#62a2d8", "#8cc0e4", "#bed8e2", "#f0dcb0", "#f6c88c"]);
    k.cloud(W * 0.2, 10, 30, ["#fff8ec", "#fbecd8", "#e8c8a8"]); k.cloud(W * 0.7, 15, 22, ["#fff8ec", "#fbecd8", "#e8c8a8"]);
    const far = k.ridge(44, 5, 40, "#b8bc78", 21, "#cccc88");
    for (let y = 44; y < 62; y++) for (let x = 0; x < W; x++) if (y >= far[x] + 2) P(x, y, ((Math.floor((x + y * 3) / 26)) % 3 === 0) ? "#e2c45c" : ((Math.floor((x - y * 2) / 31)) % 2 ? "#a8b45a" : "#94a64e"));
    for (let x = 0; x < W; x += 3) P(x + (x % 2), 50 + ((x / 17) | 0) % 3 * 3, "#6a7a3a");
    const mx = R(W * 0.86), my = 36;
    F(mx - 4, my, 8, 13, OL); F(mx - 3, my + 1, 6, 12, "#e8dcc4"); F(mx - 3, my + 1, 2, 12, "#fff4dc"); F(mx + 2, my + 1, 1, 12, "#b8a888");
    k.tri(mx - 5, my - 4, 10, 5, OL); k.tri(mx - 4, my - 3, 8, 4, TILE[1]); F(mx - 1, my + 8, 2, 4, "#5a3a22");
    add(sails({ x: mx, y: my - 1, r: 10, speed: 0.7, sail: "#f8eedc", sail2: "#d0c0a0", seed: 2 }));
    k.grad(58, 90, ["#a8b05a", "#9a8a52", "#8a6c44"]);
    const chims = [];
    for (let x = R(W * 0.03); x < W; ) {
      const w = k.ri(10, 15);
      if (k.r() < 0.35) { k.tree(x + 5, 63, k.ri(4, 6), ["#4a6a2a", "#6a8a34", "#8aa83e", "#b8c860"]); x += 12; continue; }
      const hh = k.house({ x, g: 63, w, wh: k.ri(7, 10), rh: k.ri(5, 8), wall: PL, roof: k.r() < 0.5 ? TH : TILE, frame: BM, ol: OL, type: k.r() < 0.4 ? "gable" : "hip", speckle: true, wins: 1, door: false, lit: false, chim: k.r() < 0.3 ? "r" : null, chimC: "#9a7a5a" });
      if (hh.chim) chims.push(hh.chim);
      x += w + k.ri(2, 6);
    }
    k.dith(0, 74, W, 16, "#7a5c38", 0.5);
    for (let x = 0; x < W; x++) { if (k.r() < 0.12) P(x, 80 + k.ri(0, 8), "#5e4228"); if (k.r() < 0.08) P(x, 76 + k.ri(0, 10), "#b08a5a"); }
    for (let y = 82; y < 90; y += 4) for (let x = 0; x < W; x++) if ((x + y) % 11 < 7) P(x, y + R(Math.sin(x / 13) * 1), "#6a4c2e");
    for (let i = 0; i < 3; i++) { const px = R(W * (0.15 + i * 0.33)) + k.ri(-8, 8), py = 84 + k.ri(0, 3); k.blob(px, py, 6, 1, "#6a4c2e"); k.blob(px, py, 5, 0, "#8ab4d4"); F(px - 3, py, 3, 1, "#c4dcec"); }
    for (let x = -2; x < W * 0.05; x += 3) { const h = 20 + (x * 7) % 5; F(x, 74 - h, 3, h, OL); F(x, 74 - h + 1, 2, h - 1, "#8a5a30"); P(x, 74 - h + 1, "#b07a44"); P(x + 1, 74 - h, OL); }
    for (let x = R(W * 0.97); x < W + 2; x += 3) { const h = 18 + (x * 5) % 5; F(x, 74 - h, 3, h, OL); F(x, 74 - h + 1, 2, h - 1, "#8a5a30"); P(x, 74 - h + 1, "#b07a44"); }
    let h1 = k.house({ x: R(W * 0.06), g: 74, w: 20, wh: 13, rh: 9, wall: PL, roof: TH, frame: BM, ol: OL, chim: "r", chimC: "#9a7a5a", speckle: true, lit: true });
    chims.push(h1.chim);
    const sx = R(W * 0.06) + 25;
    for (let i = 0; i < 2; i++) {
      const x = sx + i * 14, c = i ? "#5a8ac0" : "#c8463a";
      F(x, 66, 1, 9, BM); F(x + 11, 66, 1, 9, BM);
      for (let j = 0; j < 13; j++) { F(x - 1 + j, 64, 1, 3, Math.floor(j / 2) % 2 ? "#f4ecd8" : c); P(x - 1 + j, 67, j % 2 ? "#f4ecd8" : c); }
      F(x - 1, 63, 13, 1, OL);
      F(x, 70, 12, 4, BM); F(x, 70, 12, 1, "#a07040");
      for (let j = 0; j < 4; j++) k.blob(x + 2 + j * 3, 69, 1, 1, k.pick(["#e88a2a", "#c83a2a", "#8ab43a", "#f0c040"]));
    }
    const hw = 38, hx = R(W * 0.46) - (hw >> 1);
    const lc = canvas(hw + 30, 80), lk = kit(lc.getContext("2d"), hw + 30, 80, 77), hc = 12 + (hw >> 1);
    lk.house({ x: 12, g: 78, w: hw, wh: 27, rh: 17, wall: PL, roof: TILE, frame: BM, ol: OL, type: "gable", lit: true, wins: 2, door: false });
    lk.F(hc - 4, 68, 9, 10, OL); lk.F(hc - 3, 69, 7, 9, "#7a4a24"); lk.F(hc, 69, 1, 9, OL); lk.P(hc - 1, 73, "#e8c060"); lk.P(hc + 1, 73, "#e8c060"); lk.F(hc - 3, 69, 7, 1, "#a06a34");
    lk.F(hc - 6, 56, 13, 10, OL); lk.F(hc - 5, 57, 11, 8, "#a83a2a"); lk.F(hc - 5, 57, 11, 1, "#d85a3a"); lk.line(hc - 4, 58, hc + 4, 63, "#e8e0d0"); lk.line(hc + 4, 58, hc - 4, 63, "#e8e0d0"); lk.P(hc, 60, "#f0c040");
    lk.F(hc - 4, 26, 9, 8, OL); lk.F(hc - 3, 27, 7, 7, "#c0925a"); lk.F(hc - 3, 27, 2, 7, "#e0b47a"); lk.F(hc - 1, 28, 3, 4, "#2a1e14"); lk.P(hc, 30, "#e8b84a");
    lk.tri(hc - 6, 19, 13, 8, OL); lk.tri(hc - 5, 20, 11, 7, TILE[1]); lk.tri(hc - 5, 20, 5, 7, TILE[0]); lk.F(hc, 15, 1, 5, "#3a2a1e");
    const lean = 0.2;
    for (let y = 0; y < 80; y++) k.ctx.drawImage(lc, 0, y, lc.width, 1, hx - 12 + R((78 - y) * lean), y - 4, lc.width, 1);
    add(pennant({ x: hx - 12 + hc + R(63 * lean), y: 11, len: 5, h: 2, c1: "#c8463a", c2: "#ec7a5c", seed: 9 }));
    const px0 = hx + hw + 14, py1 = 52, px1 = hx + hw + R((74 - py1) * lean) + 1;
    k.line(px0 - 1, 74, px1 - 1, py1, OL); k.line(px0, 74, px1, py1, "#8a5a30"); k.line(px0 + 1, 74, px1 + 1, py1, "#6a4024"); k.line(px0 + 2, 74, px1 + 2, py1, OL);
    F(px0 - 2, 72, 7, 2, "#5a3a22");
    F(hx - 8, 69, 6, 5, OL); F(hx - 7, 70, 4, 4, "#b07a44"); F(hx - 7, 71, 4, 1, "#6a4024");
    const tx = R(W * 0.67);
    const tav = k.house({ x: tx, g: 74, w: 34, wh: 14, rh: 11, wall: PL, roof: TH, frame: BM, ol: OL, sag: 3.5, slope: 0.9, chim: "l", chimC: "#9a7a5a", speckle: true, lit: true, wins: 3, doorAt: 22, doorC: "#6a3a1c" });
    chims.push(tav.chim);
    F(tx + 34, 62, 4, 1, OL); add(swing({ x: tx + 34, y: 63, icon: "mug", board: "#8a5a30", seed: 3 }));
    for (let i = 0; i < 2; i++) { const bx = tx + 3 + i * 6; F(bx - 1, 67, 6, 7, OL); F(bx, 68, 4, 6, "#9a6a3a"); F(bx, 69, 4, 1, "#5a5a62"); F(bx, 72, 4, 1, "#5a5a62"); F(bx, 68, 1, 6, "#b88a50"); }
    const cart = (x, y, flip) => {
      F(x - 1, y - 5, 20, 4, OL); F(x, y - 4, 18, 2, "#9a6a3a"); F(x, y - 4, 18, 1, "#c08a50");
      k.line(flip ? x - 6 : x + 18, y - 3, flip ? x - 1 : x + 24, y - 2, BM);
      k.blob(x + 9, y - 8, 9, 4, OL); k.blob(x + 9, y - 8, 8, 3, TH[1]); k.blob(x + 7, y - 9, 6, 2, TH[0]); F(x + 2, y - 6, 15, 1, TH[2]);
      for (let i = 0; i < 6; i++) P(x + 2 + i * 3, y - 11 + (i % 2), TH[0]);
      for (const wx of [x + 4, x + 13]) { k.blob(wx, y - 1, 3, 3, OL); k.blob(wx, y - 1, 2, 2, "#7a4a24"); P(wx, y - 1, "#2a1e14"); F(wx - 2, y - 1, 5, 1, "#a07040"); }
    };
    cart(R(W * 0.86) - 4, 79, false);
    if (W > 250) cart(hx - 30, 80, true);
    const h3 = k.house({ x: R(W * 0.93) - 2, g: 74, w: 18, wh: 12, rh: 8, wall: PL, roof: TILE, frame: BM, ol: OL, chim: "l", chimC: "#9a7a5a", lit: false });
    chims.push(h3.chim);
    for (let x = 0; x < W; x += 2) { if (k.r() < 0.4) { const y = 88 + k.ri(0, 2); P(x, y, "#94a44a"); P(x, y - 1, "#b8c060"); } }
    for (const c of chims) if (c) add(A.smoke({ x: c[0], y: c[1], wind: 3, seed: c[0] }));
    add(A.bird({ W, y: 16, flock: 3, speed: 11, gap: 16, seed: 5 }));
    for (let i = 0; i < 3; i++) add(chicken({ x: R(W * (0.12 + i * 0.05)) + 20, y: 78 + (i % 2) * 2, seed: i + 1, col: i === 2 ? "#c87a3a" : null }));
    for (let i = 0; i < 4; i++) { const x = k.rnd(W * 0.1, W * 0.8); add(A.villager({ x0: x, x1: x + k.rnd(12, 30), y: 77 + (i % 3) * 3, speed: k.rnd(3, 5), seed: 70 + i })); }
    for (let i = 0; i < 2; i++) add(A.villager({ mode: "cross", x0: 0, x1: W, y: 86 + i, speed: k.rnd(3, 5), gap: k.rnd(4, 14), look: { carry: "#e8c870" }, seed: 80 + i }));
    add(A.butterfly({ x: W * 0.05, y: 70, w: 50, h: 12, seed: 2 }));
    add(A.cat({ x: tx - 4, y: 75, range: 6, col: "#d8823a", seed: 4 }));
  }

  function veldrock(k, A) {
    const { W, F, P } = k, add = k.add;
    const SW = ["#b8b6b0", "#96948e", "#6e6c6a"], SR = ["#7a8494", "#58606e", "#3a404c"], OL = "#1c1c22", RUST = ["#d07a3a", "#a8542a", "#6a3018"];
    const FOUND = ["#8a8a84", "#74746e", "#5a5a54", "#3a3a36"];
    k.grad(0, 56, ["#646c78", "#7a828e", "#929aa2", "#a8acac", "#bab6aa"]);
    for (const [cx, cy, w] of [[0.15, 9, 70], [0.6, 5, 90], [0.95, 15, 50], [0.4, 18, 50]]) { k.blob(R(W * cx), cy, R(w / 2), 3, "#8a929a"); k.blob(R(W * cx) - 4, cy - 1, R(w / 3), 2, "#a2a8ac"); F(R(W * cx - w / 2), cy + 3, w, 1, "#6e7680"); }
    k.ridge(34, 12, 22, "#7e828c", 31, "#9498a2");
    const n = k.noise(32), hill = [];
    for (let x = 0; x < W; x++) {
      const u = x / W, base = 62 - 44 * Math.pow(Math.max(0, u - 0.3) / 0.7, 0.9) - 20 * Math.pow(Math.max(0, 0.22 - u) / 0.22, 1.2);
      hill.push(R(base - k.fbm(n, x / 14) * 5));
    }
    for (let x = 0; x < W; x++) for (let y = hill[x]; y < 90; y++) {
      const v = k.fbm(n, x / 5 + y * 0.7);
      P(x, y, y === hill[x] ? "#8e8e80" : v > 0.62 ? "#76766a" : v < 0.38 ? "#54544c" : "#64645a");
    }
    for (let i = 0; i < W / 5; i++) { const x = k.ri(0, W - 1), y = hill[x] + k.ri(2, 30); F(x, y, k.ri(2, 4), 1, "#46463f"); P(x, y - 1, "#86867a"); }
    for (let i = 0; i < W / 9; i++) { const x = k.ri(0, W - 1); P(x, hill[x] - 1, "#5e6e44"); P(x + 1, hill[x], "#6e7e4a"); }
    const mx = R(W * 0.86), my = hill[mx] + 10;
    k.blob(mx - 16, my + 14, 16, 7, "#2e2c2c"); k.blob(mx - 17, my + 12, 13, 5, "#3e3a3a"); k.blob(mx - 19, my + 9, 6, 2, "#4e4a48");
    for (let i = 0; i < 16; i++) P(mx - 16 + k.ri(-12, 12), my + k.ri(8, 18), k.pick(RUST));
    F(mx - 8, my - 13, 17, 15, OL); F(mx - 5, my - 9, 11, 11, "#0a080c"); F(mx - 7, my - 12, 2, 14, "#7a5a38"); F(mx + 6, my - 12, 2, 14, "#5a4028"); F(mx - 8, my - 13, 17, 2, "#8a6a42"); F(mx - 8, my - 13, 17, 1, "#a8844e");
    P(mx, my - 6, "#ffc860"); add(A.glow({ x: mx, y: my - 6, r: 9, rgb: "255,190,90", a: 0.14, seed: 5 }));
    const rx0 = mx - 4, ry0 = my + 1, rx1 = R(W * 0.66), ry1 = hill[R(W * 0.66)] + 8;
    k.line(rx0, ry0, rx1, ry1, "#3a2a20"); k.line(rx0, ry0 + 1, rx1, ry1 + 1, "#7a6a5a");
    for (let i = 0; i <= 6; i++) { const u = i / 6, x = rx0 + (rx1 - rx0) * u, y = ry0 + (ry1 - ry0) * u; F(x, y + 2, 1, 4, "#5a4028"); }
    add(railCart({ x0: rx1 + 2, y0: ry1 + 0.5, x1: rx0 - 1, y1: ry0, period: 16, seed: 1 }));
    const fx = R(W * 0.5), fy = hill[fx] + 4;
    const chims = [], slots = [];
    for (const off of [8, 24]) {
      for (let x = k.ri(-4, 3); x < W; ) {
        const w = k.ri(10, 15), mid = Math.min(W - 1, Math.max(0, x + (w >> 1)));
        const g = Math.min(72, hill[mid] + off);
        if ((Math.abs(mid - fx) < 17 && off < 25) || (mid > mx - 16 && mid < mx + 14) || g > 71) { x += 8; continue; }
        slots.push([x, g, w]);
        x += w + k.ri(3, 8);
      }
    }
    slots.sort((p, q) => p[1] - q[1]);
    const head = () => {
      k.line(fx - 10, fy, fx - 1, fy - 32, OL); k.line(fx + 10, fy, fx + 1, fy - 32, OL); k.line(fx - 9, fy, fx, fy - 32, "#7a5a38"); k.line(fx + 9, fy, fx, fy - 32, "#5a4028");
      for (let y = fy - 6; y > fy - 30; y -= 7) { const hw = R((y - (fy - 32)) * 0.28); F(fx - hw, y, hw * 2 + 1, 1, "#6a4a30"); k.line(fx - hw, y, fx + hw, y - 6, "#5a4028"); }
      k.line(fx + 1, fy - 33, fx + 18, fy - 4, "#2a2a2a");
      F(fx - 7, fy - 7, 14, 9, OL); F(fx - 6, fy - 6, 12, 8, "#7a7a76"); F(fx - 6, fy - 6, 12, 1, "#9a9a94"); F(fx - 7, fy - 9, 14, 3, "#4a4a52"); F(fx - 2, fy - 3, 4, 5, "#2a1e18");
      add(wheel({ x: fx, y: fy - 34, r: 6, speed: 1.2, rim: "#2a2420", spoke: "#7a5a38", seed: 2 }));
    };
    let drawn = false;
    for (const [x, g, w] of slots) {
      if (!drawn && g > fy) { head(); drawn = true; }
      k.stones(x - 2, g, w + 4, 5, FOUND, 2);
      F(x - 2, g, w + 4, 1, FOUND[3]);
      const hh = k.house({ x, g, w, wh: k.ri(8, 12), rh: k.ri(4, 6), wall: SW, roof: SR, ol: OL, lit: k.r() < 0.25, wins: 1, doorC: k.r() < 0.5 ? RUST[1] : "#4a3e34", type: k.r() < 0.35 ? "gable" : "hip" });
      if (k.r() < 0.4) continue;
      for (let c = 0; c < (w > 13 && k.r() < 0.3 ? 2 : 1); c++) {
        const cx = x + (c ? w - 4 : k.ri(1, 4)), ct = hh.top - k.ri(7, 10);
        F(cx - 1, ct, 4, hh.top - ct + 2, OL); F(cx, ct + 1, 2, hh.top - ct + 1, "#6a5a54"); P(cx, ct + 1, "#8a7a74"); F(cx - 1, ct, 4, 1, "#141414");
        chims.push([cx + 1, ct - 1]);
      }
    }
    if (!drawn) head();
    k.grad(74, 90, ["#76766f", "#5e5e58", "#4a4a46"]);
    F(0, 73, W, 2, FOUND[3]);
    for (let y = 75; y < 90; y += 2) for (let x = (y % 4 ? 0 : 2); x < W; x += 4) F(x, y, 3, 1, k.r() < 0.5 ? "#6c6c66" : "#80807a");
    for (let i = 0; i < W / 3; i++) P(k.ri(0, W), k.ri(75, 89), "#383836");
    const tvx = R(W * 0.03);
    const vats = [[RUST[1], RUST[0]], ["#b8903a", "#d8b05a"], ["#5a3a22", "#7a5432"], ["#8a9a8a", "#aab8a8"]];
    for (let i = 0; i < 4; i++) {
      const vx = tvx + 6 + i * 13, vy = 83 + (i % 2) * 3;
      F(vx - 6, vy - 5, 13, 8, OL); F(vx - 5, vy - 4, 11, 7, "#7a5432"); for (let x = vx - 5; x < vx + 6; x += 2) F(x, vy - 4, 1, 7, "#5a3a22"); F(vx - 5, vy - 1, 11, 1, RUST[2]); F(vx - 5, vy + 1, 11, 1, RUST[2]);
      k.blob(vx, vy - 5, 6, 1, OL); k.blob(vx, vy - 5, 5, 1, "#8a6a44"); k.blob(vx, vy - 5, 4, 0, vats[i][0]); F(vx - 2, vy - 5, 2, 1, vats[i][1]);
      add(A.bubbles({ x: vx - 3, y: vy - 5, w: 6, n: 2, col: vats[i][1], seed: i + 3 }));
      add(A.smoke({ x: vx, y: vy - 7, n: 3, rise: 8, life: 3, col: "#a8a49a", wind: 2, seed: 40 + i }));
    }
    const rx = tvx + 58;
    if (rx < W * 0.4) {
      F(rx, 70, 1, 16, "#4a3420"); F(rx + 16, 70, 1, 16, "#4a3420"); F(rx - 1, 70, 19, 1, "#6a4a30");
      for (const [hx2, c] of [[rx + 2, "#d8c098"], [rx + 9, "#b89870"]]) { F(hx2, 71, 6, 9, OL); F(hx2 + 1, 71, 4, 8, c); P(hx2, 79, c); P(hx2 + 5, 79, c); P(hx2 + 2, 80, c); }
    }
    const ax = R(W * 0.74);
    F(ax - 8, 80, 16, 6, OL); k.blob(ax, 80, 7, 3, "#5a5654"); for (let i = 0; i < 10; i++) P(ax + k.ri(-6, 6), 78 + k.ri(0, 4), k.pick([RUST[0], RUST[1], "#8a8a8e", "#3a3838"]));
    F(ax + 12, 79, 10, 3, OL); F(ax + 13, 79, 8, 2, "#4a4a52"); F(ax + 13, 79, 8, 1, "#7a7a84"); F(ax + 15, 82, 4, 5, "#3a3a40");
    add(A.glow({ x: ax + 17, y: 82, r: 14, rgb: "255,130,50", a: 0.16, seed: 7 }));
    add(A.embers({ x0: ax + 13, x1: ax + 21, y: 79, n: 5, rise: 12, seed: 8 }));
    add(A.mist({ W, y: 20, h: 14, rgb: "84,84,92", a: 0.3, speed: 1.6, seed: 9 }));
    for (const [x, y] of chims) add(plume({ x, y, seed: x * 3 + y }));
    for (let i = 0; i < 4; i++) { const x = k.rnd(W * 0.25, W * 0.85); add(A.villager({ x0: x, x1: x + k.rnd(10, 26), y: 78 + (i % 3) * 4, speed: k.rnd(2.5, 4), look: { hat: i % 2 ? "#3a3a44" : "#c8a040", shirt: k.pick(["#5a5a62", "#6a5a4a", "#4a4a52", "#7a4a2a"]), legs: "#2e2e34", carry: i === 1 ? "#8a8a8e" : null }, seed: 90 + i })); }
    add(A.bird({ W, y: 12, flock: 3, col: "#1a1a1e", speed: 8, seed: 3 }));
  }

  function carrbridge(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const ST = ["#d0ccb6", "#aca892", "#86826e", "#5c5a4a"], MOSS = ["#8ab04a", "#6a9038", "#4a6a2e"], OL = "#22262a";
    const WAT = ["#7ac0e8", "#4a96d0", "#3a7eb8", "#2e6aa2", "#24588a"];
    k.grad(0, 48, ["#4aa0e6", "#6eb6ec", "#a0d0f2", "#d4eaf2"]);
    k.cloud(W * 0.18, 10, 30); k.cloud(W * 0.62, 7, 24); k.cloud(W * 0.9, 16, 18);
    k.ridge(44, 8, 30, "#9ec4c0", 41, "#b4d4cc");
    k.ridge(46, 3, 6, "#5e9a5a", 42, "#7ab86a");
    const water = 68, deckY = (x) => R(58 - 13 * Math.sin(Math.PI * Math.max(0, Math.min(1, x / W))));
    F(0, 46, W, 44, "#6aa83e");
    for (let y = 46; y < water; y++) {
      const u = (y - 46) / (water - 46), hw = R(W * (0.03 + u * 0.32));
      F(R(W / 2) - hw, y, hw * 2, 1, y < 50 ? WAT[0] : WAT[1]);
      P(R(W / 2) - hw - 1, y, "#8a8a6a"); P(R(W / 2) + hw, y, "#8a8a6a");
      if (k.r() < 0.5) F(R(W / 2) - hw + k.ri(0, hw * 2), y, 3, 1, "#b8e0f4");
    }
    const chims = [];
    for (const side of [0, 1]) {
      let x = side ? R(W * 0.6) : -2;
      const end = side ? W + 4 : R(W * 0.4);
      while (x < end) {
        const w = k.ri(9, 12), wh = k.ri(11, 15);
        const hh = k.house({ x, g: 50 - k.ri(0, 2), w, wh, rh: k.ri(5, 7), wall: k.pick([["#f4ecd8", "#e0d4b8", "#b8a888"], ["#e8d8c0", "#d4bc9c", "#a89070"], ["#dce4e8", "#c4ccd4", "#9aa4b0"]]), roof: k.pick([["#5a7ab8", "#3e5a94", "#2a3e6a"], ["#d86a4a", "#b04a34", "#7a3020"], ["#6a8a6a", "#4e6e50", "#344a36"]]), ol: OL, type: k.r() < 0.5 ? "gable" : "hip", door: false, wins: 1, winDy: 2, lit: false, chim: k.r() < 0.4 ? "l" : null, chimC: "#9a8a7a" });
        if (hh.chim) chims.push(hh.chim);
        x += w + 1;
      }
    }
    const bc = canvas(W, 90), b = kit(bc.getContext("2d"), W, 90, 909);
    const nA = Math.max(3, R(W / 60)), span = W / nA, piers = [];
    for (let i = 0; i <= nA; i++) piers.push(R(i * span));
    b.stones(0, 40, W, 50, ST, 3);
    const banks = [piers[1] - 6, piers[nA - 1] + 6];
    for (let i = 0; i < nA; i++) {
      const x0 = piers[i] + 6, x1 = piers[i + 1] - 6, cx = (x0 + x1) / 2, rx = (x1 - x0) / 2, land = i === 0 || i === nA - 1;
      const crown = deckY(cx) + 6, spring = water - 3;
      for (let y = crown; y < 90; y++) {
        const dy = (spring - y) / (spring - crown);
        const hw = y < spring ? rx * Math.sqrt(Math.max(0, 1 - dy * dy)) : rx;
        if (hw < 0.5) continue;
        const c = y < crown + 2 ? "#3a4a4a" : land ? (y < water - 1 ? "#4a5a48" : "#5a6a50") : y < water - 4 ? "#56786a" : "#5a9ec8";
        b.F(cx - hw, y, hw * 2, 1, c);
        if (y < spring + 1) { b.P(cx - hw - 1, y, ST[3]); b.P(cx + hw, y, ST[3]); }
      }
      for (let a = 0.02; a < 1; a += 0.03) {
        const ang = Math.PI * a, px = cx - Math.cos(ang) * (rx + 1.5), py = spring - Math.sin(ang) * (spring - crown + 1.5);
        b.P(px, py, Math.floor(a * 30) % 3 === 0 ? ST[3] : ST[0]);
      }
    }
    for (let i = 1; i < nA; i++) {
      const px = piers[i];
      b.F(px - 6, water - 2, 12, 30, ST[2]); b.F(px - 6, water - 2, 2, 30, ST[1]); b.F(px + 4, water - 2, 2, 30, ST[3]);
      for (let y = water; y < 90; y += 3) b.F(px - 6, y, 12, 1, ST[3]);
    }
    for (let i = 0; i < W / 4; i++) { const x = b.ri(0, W - 1), y = b.pick([deckY(x) + 1, deckY(x) + 2, water - 2, water - 1]); b.F(x, y, b.ri(1, 3), 1, MOSS[b.ri(0, 1)]); b.F(x, y + 1, 1, b.ri(1, 4), MOSS[2]); }
    for (let x = 0; x < W; x++) {
      const d = deckY(x);
      k.ctx.drawImage(bc, x, d, 1, water - d, x, d, 1, water - d);
      P(x, d, k.r() < 0.3 ? MOSS[0] : ST[0]); P(x, d + 1, ST[3]);
    }
    k.grad(water, 90, [WAT[1], WAT[2], WAT[3], WAT[4]], banks[0], banks[1]);
    k.ctx.save(); k.ctx.globalAlpha = 0.3; k.ctx.translate(0, water * 2); k.ctx.scale(1, -1);
    for (let x = 0; x < W; x++) { const d = deckY(x); k.ctx.drawImage(bc, x, d, 1, water - d, x, d, 1, water - d); }
    k.ctx.restore();
    for (let i = 1; i < nA; i++) { const px = piers[i]; F(px - 6, water, 12, 3, ST[3]); F(px - 6, water, 2, 3, ST[2]); F(px - 7, water + 3, 14, 1, "#2e5a84"); }
    for (let y = water + 1; y < 90; y++) for (let x = banks[0]; x < banks[1]; x++) if ((x * 3 + y * 7) % 13 === 0 && k.r() < 0.5) F(x, y, k.ri(2, 4), 1, y < 76 ? "#6ab0dc" : "#4a90c8");
    for (let x = banks[0]; x < banks[1]; x++) P(x, water, k.r() < 0.5 ? "#cfe8f4" : WAT[1]);
    for (const [x0, x1, side] of [[0, banks[0], 0], [banks[1], W, 1]]) {
      F(x0, water - 1, x1 - x0, 3, "#a89870"); F(x0, water - 1, x1 - x0, 1, "#c8b890");
      k.stones(x0, water + 2, x1 - x0, 6, ST, 2);
      k.grad(water + 8, 90, ["#6aa83e", "#5a9636"], x0, x1);
      F(side ? x0 : x1 - 1, water - 1, 1, 30, ST[3]);
      const ax = side ? piers[nA - 1] + span / 2 : span / 2;
      const stall = (sx, c) => {
        F(sx, water - 10, 1, 9, "#5a3a22"); F(sx + 10, water - 10, 1, 9, "#5a3a22");
        for (let j = 0; j < 12; j++) F(sx - 1 + j, water - 12, 1, 3, Math.floor(j / 2) % 2 ? "#f4ecd8" : c);
        F(sx - 1, water - 13, 12, 1, OL);
        F(sx, water - 5, 11, 4, "#7a5a34"); F(sx, water - 5, 11, 1, "#a07a48");
        for (let j = 0; j < 3; j++) P(sx + 2 + j * 3, water - 6, k.pick(["#e8c040", "#c84a3a", "#7ac0e8", "#e8e0d0"]));
        add(A.glow({ x: sx + 5, y: water - 8, r: 12, rgb: "255,200,110", a: 0.2, seed: sx }));
      };
      stall(R(ax - 12), side ? "#c8463a" : "#3a8a8a");
      if (span > 54) stall(R(ax + 2), side ? "#3a6ab0" : "#c8a040");
    }
    const tx = R(W / 2), td = deckY(tx);
    F(tx - 8, td - 21, 16, 21, OL); k.stones(tx - 7, td - 20, 14, 20, ST);
    k.win(tx - 3, td - 15, 2, 3, true, OL); k.win(tx + 2, td - 15, 2, 3, true, OL);
    F(tx - 2, td - 8, 4, 8, OL); F(tx - 1, td - 7, 2, 7, "#7a4a24");
    k.tri(tx - 10, td - 32, 20, 12, OL); k.tri(tx - 9, td - 31, 18, 11, "#3e5a94"); k.tri(tx - 9, td - 31, 7, 11, "#5a7ab8");
    F(tx, td - 37, 1, 6, "#3a2a1e");
    add(pennant({ x: tx, y: td - 37, len: 6, h: 3, c1: "#e8b84a", c2: "#fff0a0", c3: "#a87a28", fork: true, seed: 6 }));
    for (let x = 0; x < W; x++) {
      const d = deckY(x);
      o.F(x, d - 3, 1, 4, ST[2]); o.P(x, d - 3, ST[0]); o.P(x, d - 4, OL); o.P(x, d, ST[3]);
      if (x % 6 < 2) { o.P(x, d - 5, OL); o.P(x, d - 4, ST[1]); }
    }
    add(barrier({ x: tx + 8, y: td - 5, len: 14, dir: 1, front: true, seed: 1 }));
    for (const lx of [R(W * 0.2), R(W * 0.8)]) { const d = deckY(lx); o.F(lx, d - 11, 1, 8, "#2a2a2a"); o.F(lx - 1, d - 13, 3, 3, "#2a2a2a"); o.P(lx, d - 12, "#ffd86a"); add(A.glow({ x: lx, y: d - 12, r: 6, rgb: "255,210,120", a: 0.15, seed: lx, front: true })); }
    for (let x = 0; x < 20; x += 2) { const h = k.ri(4, 9); o.F(x, 90 - h, 1, h, "#4a7a32"); o.P(x, 89 - h, "#7a5a34"); }
    const jx = W - 22;
    o.F(jx - 6, 80, 22, 2, "#7a5a34"); o.F(jx - 6, 80, 22, 1, "#a07a48"); for (const px of [jx - 5, jx + 4, jx + 13]) o.F(px, 80, 1, 10, "#4a3420");
    for (const [x, y] of chims) add(A.smoke({ x, y, wind: 4, seed: x }));
    add(A.waves({ x0: banks[0], x1: banks[1], y: water + 5, h: 22, n: R(W / 7), col: "#a8dcf4", seed: 3 }));
    add(sparkle({ x: banks[0], y: water + 2, w: banks[1] - banks[0], h: 22, n: R(W / 14), col: "#e8f8ff", seed: 4 }));
    for (let i = 1; i < nA; i++) add(A.waves({ x0: piers[i] - 9, x1: piers[i] + 9, y: water + 1, h: 2, n: 4, col: "#ffffff", seed: i * 7 }));
    add(rowboat({ x0: banks[0] + 12, x1: banks[1] - 12, y: 85, period: 60, hull: "#8a5a30", shirt: "#c8463a", seed: 2 }));
    for (let i = 0; i < 5; i++) add(walker({ x0: 0, x1: W, yAt: (x) => deckY(x) - 1, speed: k.rnd(3, 6), gap: k.rnd(2, 10), look: i === 2 ? { carry: "#c8a060" } : null, seed: 120 + i }));
    add(A.villager({ x0: tx + 9, x1: tx + 11, y: td - 2, speed: 1, rest: 0.4, look: { shirt: "#3a5a8a", hat: "#e8b84a" }, seed: 129 }));
    for (let i = 0; i < 2; i++) { const sx = i ? piers[nA - 1] + span / 2 : span / 2; add(A.villager({ x0: sx - 14, x1: sx + 10, y: water + 1, speed: 2, seed: 130 + i })); }
    add(A.gull({ W, y: 14, seed: 4 }));
    add(A.bird({ W, y: 24, flock: 3, speed: 12, seed: 5 }));
  }

  function ashfen(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const WD = ["#8a7458", "#6a5640", "#4a3c2c"], RF = ["#9aaa78", "#7a8a5a", "#56643e"], OL = "#1a1e1c";
    k.grad(0, 58, ["#5a6a6e", "#6e8086", "#8a9a96", "#a6b0a0", "#b8baa2"]);
    k.blob(R(W * 0.72), 24, 9, 9, "#c4c4aa"); k.blob(R(W * 0.72), 24, 7, 7, "#dcd8b8"); k.blob(R(W * 0.72), 24, 5, 5, "#ece6c4");
    for (let y = 30; y < 34; y++) F(0, y, W, 1, "#9aa69c");
    const far = k.ridge(54, 5, 7, "#7e8e86", 51);
    for (let i = 0; i < W / 22; i++) { const x = k.ri(0, W), y = far[Math.min(W - 1, x)]; k.line(x, y, x + k.ri(-2, 2), y - k.ri(8, 14), "#6e7e78"); k.line(x, y - 8, x + 4, y - 12, "#6e7e78"); k.line(x, y - 6, x - 3, y - 9, "#6e7e78"); }
    k.ridge(57, 2, 5, "#5e6e5a", 52);
    k.grad(58, 90, ["#6a8478", "#4e6a62", "#3a5650", "#2c4440"]);
    for (let y = 60; y < 90; y += 2) for (let x = 0; x < W; x++) if (k.r() < 0.05) F(x, y, k.ri(2, 5), 1, "#7a968a");
    const lamps = [], houses = [];
    const stilt = (x, pf, w, wh, rh, lamp) => {
      for (const sx of [x, x + (w >> 1), x + w - 1]) { F(sx, pf, 1, 72 - pf, OL); ctx2(sx); }
      F(x - 3, pf, w + 6, 2, OL); F(x - 3, pf, w + 6, 1, "#9a8466");
      const h = k.house({ x, g: pf, w, wh, rh, wall: WD, roof: RF, ol: OL, planks: "#5a4834", lit: true, wins: Math.max(1, (w / 8) | 0), speckle: true, doorC: "#3e3024" });
      houses.push(h);
      if (lamp) lamps.push([x - 3, pf - 7]);
      return h;
    };
    const ctx2 = (sx) => { k.ctx.globalAlpha = 0.35; F(sx, 73, 1, 6, "#1e2a28"); k.ctx.globalAlpha = 1; };
    const pos = [[0.04, 60, 16, 11, 7, true], [0.24, 57, 22, 13, 9, true], [0.48, 61, 18, 10, 7, false], [0.64, 58, 14, 12, 8, true]];
    let prev = null;
    for (const [fx, pf, w, wh, rh, lamp] of pos) {
      const x = R(W * fx) + 3;
      if (x + w > W * 0.8) continue;
      stilt(x, pf, w, wh, rh, lamp);
      if (prev) {
        const [px, ppf] = prev;
        k.line(px, ppf, x - 3, pf, OL); k.line(px, ppf - 1, x - 3, pf - 1, "#8a7458");
        for (let xx = px + 3; xx < x - 3; xx += 6) { const yy = R(ppf + (pf - ppf) * (xx - px) / (x - 3 - px)); F(xx, yy, 1, 72 - yy, "#2e2a24"); }
        const mid = R((px + x - 3) / 2), my = R((ppf + pf) / 2);
        F(mid, my + 1, 1, 3, "#5a4a34"); k.tri(mid - 1, my + 3, 3, 4, "#b8a070"); P(mid, my + 5, "#7a6440");
      }
      prev = [x + w + 3, pf];
    }
    const ux = R(W * 0.87);
    k.blob(ux, 66, 18, 4, "#3e4a3a"); k.blob(ux, 65, 16, 3, "#56604a"); k.blob(ux - 4, 64, 10, 1, "#6a7458");
    for (let i = 0; i < 12; i++) P(ux + k.ri(-15, 15), 63 + k.ri(0, 2), "#7a8460");
    const uh = k.house({ x: ux - 6, g: 64, w: 13, wh: 18, rh: 13, wall: ["#5a5460", "#46404c", "#322e38"], roof: ["#3a3642", "#2a2630", "#1c1a22"], ol: "#100e14", type: "gable", lit: false, wins: 0, doorAt: 5, doorC: "#1e1a20" });
    void uh;
    k.blob(ux, 52, 2, 2, "#100e14"); k.blob(ux, 52, 1, 1, "#c8d4a0");
    for (const [cx, tilt] of [[ux - 12, 0], [ux + 10, 1], [ux + 14, 1]]) {
      F(cx - 1, 54 + tilt, 5, 10, "#100e14"); F(cx, 55 + tilt, 3, 9, "#7a5a3a"); F(cx, 55 + tilt, 1, 9, "#9a7a52"); P(cx - 1, 54 + tilt, "#56604a"); P(cx + 3, 54 + tilt, "#56604a"); P(cx + 1, 57 + tilt, "#c8b890"); F(cx, 58 + tilt, 3, 1, "#c8b890");
    }
    k.line(ux + 22, 66, ux + 20, 40, "#2a2620"); k.line(ux + 21, 52, ux + 27, 44, "#2a2620"); k.line(ux + 21, 46, ux + 15, 40, "#2a2620"); k.line(ux + 24, 48, ux + 26, 42, "#2a2620");
    add(raven({ x: ux + 16, y: 41, seed: 2 }));
    F(ux - 10, 56, 1, 8, "#2a2620"); F(ux - 11, 54, 3, 3, "#2a2620"); P(ux - 10, 55, "#ffc860");
    lamps.push([ux - 10, 55]);
    const dx = R(W * 0.12);
    k.line(dx, 90, dx + 2, 58, "#2e2c26"); k.line(dx + 1, 90, dx + 3, 58, "#3e3a32"); k.line(dx + 2, 66, dx - 6, 58, "#2e2c26"); k.line(dx + 3, 62, dx + 10, 55, "#2e2c26"); k.line(dx - 3, 61, dx - 6, 56, "#2e2c26");
    for (let x = 0; x < W; x += 2) {
      if (k.r() < 0.55) { const h = k.ri(5, 13); o.F(x, 90 - h, 1, h, k.r() < 0.5 ? "#3a4a32" : "#4a5a3a"); if (k.r() < 0.25) { o.F(x, 90 - h - 3, 1, 3, "#5a3a24"); o.P(x, 90 - h - 4, "#3a4a32"); } }
    }
    for (const [x, y] of lamps) {
      if (x < 1) continue;
      F(x, y, 1, 9, OL); F(x - 1, y - 3, 3, 3, OL); P(x, y - 2, "#ffd060");
      add(A.glow({ x, y: y - 2, r: 16, rgb: "255,180,80", a: 0.22, amp: 0.12, seed: x }));
      add(A.glow({ x, y: 74 + (y % 3), r: 6, rgb: "255,190,90", a: 0.1, amp: 0.08, seed: x + 1 }));
    }
    for (const h of houses) if (h.door) add(A.glow({ x: h.door, y: h.top + 5, r: 9, rgb: "255,190,90", a: 0.08, seed: h.door }));
    add(A.mist({ W, y: 40, h: 12, rgb: "200,212,204", a: 0.4, speed: 1.4, seed: 1 }));
    add(A.mist({ W, y: 62, h: 12, rgb: "196,210,200", a: 0.55, speed: 2.2, seed: 2 }));
    add(A.mist({ W, y: 76, h: 14, rgb: "186,204,196", a: 0.45, speed: -1.2, seed: 3, front: true }));
    add(A.fireflies({ x: W * 0.3, y: 66, w: W * 0.5, h: 12, n: 6, rgb: "255,210,120", col: "#ffe8a0", seed: 4 }));
    add(eel({ x: R(W * 0.38), y: 78, period: 7, seed: 1 }));
    add(eel({ x: R(W * 0.7), y: 84, period: 9, seed: 5 }));
    add(A.bubbles({ x: W * 0.55, y: 82, w: 10, n: 2, col: "#8aa89a", seed: 2 }));
    add(A.waves({ x0: 0, x1: W, y: 70, h: 18, n: R(W / 10), col: "#7a988c", seed: 6 }));
    add(rowboat({ x0: W * 0.22, x1: W * 0.6, y: 82, period: 70, hull: "#4a3a2a", shirt: "#5a6a4a", hat: "#2a2a24", wake: "#7a988c", seed: 3 }));
    const p0 = R(W * 0.24) + 3;
    add(A.villager({ x0: p0 - 2, x1: p0 + 14, y: 56, speed: 2, look: { shirt: "#5a6a4a", hood: "#4a5a42" }, seed: 140 }));
  }

  function hollowood(k, A) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const BK = ["#a0805a", "#7e5e3e", "#5e4430", "#3e2c1e"], OL = "#14100c";
    const LF = ["#163a1e", "#22502a", "#2e6a32", "#4a8a3a", "#7ab84a"];
    k.grad(0, 76, ["#1e3a2a", "#2a4a32", "#365a38", "#3e6a3e"]);
    for (let i = 0; i < W / 12; i++) {
      const x = k.ri(-4, W), w = k.ri(3, 7), c = k.r() < 0.5 ? "#2e5236" : "#3a6040";
      F(x, 0, w, 76, c); F(x, 0, 1, 76, k.mix(c, "#7aa070", 0.25));
    }
    k.ctx.globalAlpha = 0.35; k.grad(40, 76, ["#4a7a4a", "#6a9a5a"]); k.ctx.globalAlpha = 1;
    k.grad(74, 90, ["#4e7e36", "#3e6a2e", "#2e5426"]);
    for (let i = 0; i < W / 2; i++) P(k.ri(0, W), k.ri(75, 89), k.pick(["#6a9a3e", "#a08a3a", "#2a4a22", "#c8a050"]));
    const trees = [[0.13, 20], [0.5, 24], [0.87, 20]].map(([u, w]) => [R(W * u), w]);
    const trunk = (cx, w) => {
      const x0 = cx - (w >> 1);
      for (let y = 0; y < 80; y++) {
        const flare = y > 68 ? R(((y - 68) / 12) ** 1.6 * 9) : 0;
        F(x0 - flare - 1, y, w + flare * 2 + 2, 1, OL);
        for (let x = x0 - flare; x < x0 + w + flare; x++) {
          const u = (x - x0 + flare) / (w + flare * 2);
          let c = u < 0.15 ? BK[0] : u < 0.55 ? BK[1] : u < 0.85 ? BK[2] : BK[3];
          P(x, y, c);
        }
      }
      for (let i = 0; i < w * 3; i++) { const x = x0 + k.ri(1, w - 2), y = k.ri(0, 74), l = k.ri(3, 9); F(x, y, 1, l, k.mix(BK[3], BK[2], 0.3)); P(x - 1, y, BK[0]); }
      for (let i = 0; i < 6; i++) { const y = k.ri(10, 70); F(x0 + w - k.ri(3, 6), y, k.ri(2, 4), k.ri(2, 4), k.pick(["#4a7a3a", "#5a8a40"])); }
      k.blob(x0 + R(w * 0.35), 56, 2, 2, BK[3]); P(x0 + R(w * 0.35), 56, "#1a120c");
      for (const dx of [-1, 1]) { k.line(cx + dx * (w >> 1), 79, cx + dx * ((w >> 1) + 12), 86, BK[2]); k.line(cx + dx * (w >> 1), 80, cx + dx * ((w >> 1) + 11), 87, OL); }
    };
    for (const [cx, w] of trees) trunk(cx, w);
    for (let x = -6; x < W + 6; x += 6) { const cy = k.ri(2, 8); k.blob(x, cy, k.ri(7, 10), k.ri(4, 7), LF[0]); }
    for (let x = -6; x < W + 6; x += 7) { const cy = k.ri(0, 5); k.blob(x, cy, k.ri(5, 8), k.ri(3, 5), LF[1]); k.blob(x - 2, cy - 1, k.ri(3, 5), k.ri(2, 3), LF[2]); }
    for (let i = 0; i < W / 4; i++) { const x = k.ri(0, W), y = k.ri(0, 8); P(x, y, LF[3]); if (k.r() < 0.3) P(x + 1, y, LF[4]); }
    for (let i = 0; i < W / 10; i++) { const x = k.ri(0, W), y = k.ri(10, 14); k.blob(x, y, 2, 1, LF[1]); P(x, y + 2, LF[0]); }
    const plats = [], ropes = [], lamps = [];
    const platform = (cx, w, y, hutW, hutSide) => {
      const x0 = cx - w, x1 = cx + w;
      F(x0 - 1, y - 1, x1 - x0 + 2, 4, OL); F(x0, y, x1 - x0, 2, "#a8804a"); F(x0, y, x1 - x0, 1, "#c8a064"); for (let x = x0; x < x1; x += 3) P(x, y + 1, "#6a4a2a");
      k.line(x0 + 2, y + 2, cx - 6, y + 10, "#5a3c22"); k.line(x1 - 2, y + 2, cx + 6, y + 10, "#5a3c22");
      const hx = hutSide < 0 ? x0 + 2 : x1 - hutW - 2;
      const hh = k.house({ x: hx, g: y, w: hutW, wh: 8, rh: 7, wall: ["#b08a58", "#8a6a42", "#6a4e30"], roof: ["#6aa040", "#4a7a2e", "#2e5420"], ol: OL, planks: "#6a4e30", lit: true, wins: 1, doorAt: hutSide < 0 ? hutW - 4 : 1, speckle: true });
      for (let x = x0; x < x1; x += 4) o.F(x, y - 4, 1, 4, "#5a3c22");
      o.F(x0, y - 4, x1 - x0, 1, "#c8a46a");
      plats.push([x0, x1, y]);
      lamps.push([hutSide < 0 ? x1 - 2 : x0 + 2, y - 6]);
      return hh;
    };
    const [t1, t2, t3] = trees;
    platform(t1[0], 15, 42, 12, -1);
    platform(t2[0], 17, 30, 16, 1);
    platform(t3[0], 15, 46, 12, 1);
    ropes.push([t1[0] + 15, 42, t2[0] - 17, 30], [t2[0] + 17, 30, t3[0] - 15, 46]);
    for (const [r0, y0, r1, y1] of ropes) add(rope({ x0: r0, y0, x1: r1, y1, sag: 4, seed: r0 }));
    const ladder = (x, y0, y1) => { F(x, y0, 1, y1 - y0, "#5a3c22"); F(x + 4, y0, 1, y1 - y0, "#5a3c22"); for (let y = y0 + 2; y < y1; y += 3) F(x, y, 5, 1, "#a8804a"); };
    ladder(t1[0] - 2, 44, 80); ladder(t3[0] - 2, 48, 80);
    for (const [x, y] of lamps) { F(x, y - 2, 1, 2, OL); F(x - 1, y, 3, 3, OL); P(x, y + 1, "#ffd870"); add(A.glow({ x, y: y + 1, r: 10, rgb: "255,210,120", a: 0.18, seed: x })); }
    const cx2 = R((t2[0] + 12 + t3[0] - 10) / 2);
    const cot = k.house({ x: cx2 - 13, g: 78, w: 24, wh: 11, rh: 10, wall: ["#e8d8b0", "#ccb88c", "#a08a64"], roof: ["#7ab044", "#4e8a30", "#2e5a20"], frame: "#5a3c22", ol: OL, chim: "r", chimC: "#8a7a6a", speckle: true, lit: true, wins: 2, doorAt: 10, doorC: "#5a7a3a" });
    // the bunting burns with the cottage (its colours are still drawn from the dice, so the rest of the scene doesn't shift)
    if (!cot.burned) F(cx2 - 15, 68, 28, 1, "#4a3420");
    for (let i = 0; i < 6; i++) { const hx = cx2 - 13 + i * 4, c = k.pick(["#8ab04a", "#c8a050", "#a85a8a", "#6a9a4a", "#d8c060"]); if (!cot.burned) { F(hx, 69, 2, 3, c); P(hx, 68, "#4a3420"); } }
    for (let i = 0; i < 3; i++) { const px = cx2 + 14 + i * 4; F(px, 75, 3, 3, "#a8583a"); F(px, 75, 3, 1, "#c87a4a"); P(px + 1, 74, k.pick(["#6aa040", "#e8c040", "#c84a6a"])); }
    const shroom = (x, y, big, c) => {
      const s = big ? 3 : 2;
      F(x, y - s, 1, s + 1, "#f0e8d8"); k.blob(x, y - s - 1, s, 1, OL); k.blob(x, y - s - 1, s - 1, 1, c[0]); F(x - s + 1, y - s, s * 2 - 1, 1, c[1]); P(x - 1, y - s - 2, "#ffffff"); if (big) P(x + 1, y - s - 1, "#ffffff");
    };
    const RED = ["#e04a3a", "#a8302a"], TAN = ["#d8b070", "#a8844a"];
    for (const [cx] of trees) for (let i = 0; i < 4; i++) shroom(cx + k.ri(-14, 14), k.ri(82, 89), k.r() < 0.4, k.r() < 0.6 ? RED : TAN);
    for (let i = 0; i < W / 22; i++) shroom(k.ri(4, W - 4), k.ri(80, 89), false, k.r() < 0.5 ? RED : TAN);
    for (let i = 0; i < W / 14; i++) { const x = k.ri(0, W), y = k.ri(80, 90); for (let j = 0; j < 4; j++) { k.line(x, y, x - 3 + j * 2, y - 4 - (j % 2) * 2, j % 2 ? "#5a9a3a" : "#3e7a2e"); } }
    const lx = R((t1[0] + 12 + t2[0] - 12) / 2);
    F(lx - 6, 84, 12, 3, OL); F(lx - 5, 84, 10, 2, "#8a6a42"); k.blob(lx - 5, 85, 1, 1, "#c8a46a"); k.blob(lx + 5, 85, 1, 1, "#c8a46a");
    F(lx + 9, 80, 5, 5, OL); F(lx + 10, 81, 3, 4, "#8a6a42"); F(lx + 10, 80, 3, 1, "#c8a46a"); k.line(lx + 12, 80, lx + 14, 76, "#5a3c22"); F(lx + 13, 76, 2, 2, "#9aa0a8");
    add(shafts({ y0: 8, y1: 88, slope: 0.35, col: "#fff2b0", list: [[R(W * 0.22), 4, 0.1, 0], [R(W * 0.36), 7, 0.08, 1.4], [R(W * 0.62), 5, 0.1, 2.2], [R(W * 0.74), 3, 0.12, 3.1]] }));
    add(leaves({ x: 0, w: W, y0: 8, y1: 90, n: R(W / 18), cols: ["#7ab84a", "#c8a040", "#a8c858", "#d88a3a"], seed: 3 }));
    add(A.fireflies({ x: 0, y: 20, w: W, h: 60, n: R(W / 24), rgb: "255,240,170", col: "#fff8d0", blink: 0.6, seed: 4 }));
    if (cot.chim) add(A.smoke({ x: cot.chim[0], y: cot.chim[1], wind: 2, seed: 5 }));
    for (const [x0, x1, y] of plats) add(A.villager({ x0: x0 + 2, x1: x1 - 2, y: y - 1, speed: 2, look: { shirt: k.pick(["#5a7a3a", "#8a5a3a", "#3a5a4a"]), hood: k.r() < 0.5 ? "#4a6a32" : null }, seed: x0 }));
    add(A.villager({ x0: cx2 - 30, x1: cx2 - 14, y: 82, speed: 2, look: { shirt: "#6a8a4a", carry: "#8ab04a", dress: true }, seed: 150 }));
    add(A.rabbit({ x: R(W * 0.25), y: 87, range: 18, seed: 6 }));
    add(A.butterfly({ x: cx2 - 20, y: 66, w: 40, h: 14, col: "#f0d050", seed: 7 }));
  }

  function saltmarrow(k, A) {
    const { W, F, P } = k, add = k.add;
    const CH = ["#fbf8ee", "#e4e0d2", "#bcb8aa", "#8a8a84"], OL = "#1a2230";
    const hz = 46;
    k.grad(0, hz, ["#3a84d2", "#58a0e0", "#88bcec", "#bcd8f0", "#e6f0f2"]);
    k.cloud(W * 0.15, 10, 26); k.cloud(W * 0.45, 16, 34); k.cloud(W * 0.8, 6, 20);
    k.grad(hz, 90, ["#5a9ed0", "#3a82c0", "#2e6eac", "#245c96", "#1e4e84"]);
    F(0, hz, W, 1, "#8ac4ea");
    for (let y = hz + 1; y < 90; y += 2) for (let x = 0; x < W; x++) if (k.r() < 0.06) F(x, y, k.ri(2, 4), 1, y < 60 ? "#7ab8e4" : "#4a8ac8");
    const cx0 = R(W * 0.5), top = (x) => 34 + R(Math.sin(x * 0.07) * 1.5);
    const n = k.noise(71);
    const cliffTop = [];
    const n2 = k.noise(72), base = [];
    for (let x = cx0; x < W; x++) {
      const u = (x - cx0) / 18, t = u < 1 ? R(top(x) + (1 - Math.sin(u * Math.PI / 2)) * 40) : top(x), bot = 78 + R(k.fbm(n2, x / 7) * 5);
      cliffTop[x] = t; base[x] = bot;
      for (let y = t; y < bot; y++) {
        const v = k.fbm(n, x / 2.2 + y * 0.04) + (k.fbm(n2, x / 9 + y / 11) - 0.5) * 0.5;
        let c = v > 0.6 ? CH[0] : v < 0.36 ? CH[2] : CH[1];
        if (x - cx0 < 2 + (y - t) * 0.06) c = CH[0];
        if ((y - t + R(k.fbm(n2, x / 12) * 6)) % 11 === 6 && k.fbm(n2, x / 3 + y) > 0.55) c = "#6a6a72";
        if (k.fbm(n2, x * 1.7 + 50) > 0.72 && (y + x) % 3 === 0 && y - t > 4) c = CH[2];
        if (y - t < 2) c = CH[2];
        if (y > bot - 6) c = k.mix(c, "#6a7068", (y - bot + 6) / 7);
        if (y === bot - 1) c = (x % 3) ? "#4a6a44" : "#3a4a3a";
        P(x, y, c);
      }
      F(x, t - 1, 1, 3, "#6ab040"); P(x, t - 1, "#8ad04a");
      if (k.r() < 0.3) P(x, t + 2, "#5a9a38");
    }
    const cvx = R(W * 0.72);
    for (let y = 0; y < 12; y++) { const hw = R(5 * Math.sqrt(Math.max(0, 1 - ((11 - y) / 12) ** 2))) + (y > 8 ? 1 : 0); F(cvx - hw, base[cvx] - 12 + y, hw * 2 + 1, 1, y < 2 ? "#3a3a40" : "#1e2026"); }
    for (let x = cx0; x < cx0 + 18; x++) P(x, cliffTop[x], "#1e3a1a");
    for (let i = 0; i < 9; i++) { const x = cx0 + k.ri(4, W - cx0 - 2), y = (base[x] || 80) + k.ri(1, 6); k.blob(x, y, k.ri(2, 4), 1, "#3e4048"); F(x - 2, y - 1, 3, 1, "#7a7e86"); }
    const lx = W - 14, lt = cliffTop[lx] || 34;
    F(lx - 5, lt - 26, 11, 27, OL);
    for (let y = lt - 25; y < lt; y++) {
      const hw = 4 - R((lt - y) / 14), band = Math.floor((y - lt) / 5) % 2 === 0;
      for (let x = -hw; x <= hw; x++) P(lx + x, y, band ? (x < -1 ? "#f0786a" : x > 1 ? "#a82a24" : "#d84a3a") : (x < -1 ? "#ffffff" : x > 1 ? "#c8c8c8" : "#eeeeee"));
    }
    F(lx - 4, lt - 27, 9, 2, "#2a2a30"); F(lx - 3, lt - 32, 7, 5, OL); F(lx - 2, lt - 31, 5, 4, "#fff0a0"); F(lx, lt - 31, 1, 4, OL);
    k.tri(lx - 4, lt - 37, 9, 5, OL); k.tri(lx - 3, lt - 36, 7, 4, "#a82a24"); P(lx, lt - 38, "#2a2a30");
    F(lx - 1, lt - 8, 2, 3, "#2a3a5a");
    add(beam({ x: lx, y: lt - 30, len: 46 }));
    const chims = [];
    let hxp = cx0 + 20;
    while (hxp < lx - 22) {
      const w = k.ri(10, 13), g = (cliffTop[hxp + 4] || 34) + 1;
      const h = k.house({ x: hxp, g, w, wh: k.ri(7, 9), rh: k.ri(5, 7), wall: CH.slice(0, 3), roof: k.r() < 0.7 ? ["#4e6488", "#34466a", "#222e48"] : ["#c8603a", "#a04428", "#6a2c1a"], ol: OL, lit: false, wins: 1, chim: k.r() < 0.6 ? "r" : null, chimC: "#d0ccc0", doorC: "#3a5a8a" });
      if (h.chim) chims.push(h.chim);
      hxp += w + k.ri(2, 4);
    }
    for (let y = 40; y < 74; y += 3) { const x = cx0 + 4 + R((74 - y) * 0.35); F(x, y, 5, 1, "#8a6a44"); P(x, y + 1, "#5a4028"); P(x, y + 2, "#5a4028"); }
    const beach = (x) => 72 + R(x * 0.08 + Math.sin(x * 0.15) * 1.2);
    for (let x = 0; x < cx0 + 6; x++) {
      const y = beach(x);
      for (let yy = y; yy < 90; yy++) P(x, yy, (x * 7 + yy * 3) % 11 === 0 ? "#a89878" : ((x + yy) % 5 === 0 ? "#cbbc96" : "#d8caa4"));
      P(x, y, "#ece2c4");
    }
    const shx = R(W * 0.14);
    for (let x = shx - 14; x < shx + 14; x++) { const c = k.pick(["#6a4a30", "#8a5a34", "#4a3424", "#2e2a28", "#7a6040"]); F(x, 62, 1, 12 - (x % 3 === 0 ? 1 : 0), c); }
    F(shx - 15, 61, 30, 1, OL); F(shx - 15, 61, 1, 13, OL); F(shx + 14, 61, 1, 13, OL);
    for (let x = -17; x <= 17; x++) { const y = 61 - R(Math.sqrt(Math.max(0, 1 - (x / 17.5) ** 2)) * 8); F(shx + x, y, 1, 62 - y, x < -8 ? "#a8583a" : x < 6 ? "#8a4228" : "#6a301e"); P(shx + x, y, OL); P(shx + x, 61, "#e8dcc0"); }
    F(shx - 1, 52, 2, 2, "#3a2418");
    F(shx - 3, 66, 6, 8, OL); F(shx - 2, 67, 4, 7, "#2a1e18");
    k.win(shx + 6, 65, 3, 3, true, OL); k.win(shx - 10, 65, 3, 3, false, OL);
    F(shx - 19, 66, 2, 8, "#3a2a1e"); k.blob(shx - 18, 65, 2, 1, "#e8d0a8"); P(shx - 19, 64, "#c8a080"); P(shx - 17, 64, "#2a1e18");
    for (const [bx, c] of [[shx + 17, "#8a5a30"], [shx + 21, "#6a4428"]]) { F(bx, 69, 4, 5, OL); F(bx, 70, 3, 4, c); F(bx, 71, 3, 1, "#3a3a40"); }
    F(shx - 26, 60, 1, 14, "#5a3a22"); F(shx - 36, 60, 1, 14, "#5a3a22");
    for (let x = shx - 36; x <= shx - 26; x++) { const y = 61 + R(Math.sin((x - shx + 36) / 10 * Math.PI) * 3); P(x, y, "#4a3a2a"); for (let yy = y + 1; yy < y + 8; yy += 2) if ((x + yy) % 2 === 0) P(x, yy, "#7a6a50"); }
    if (W > 200) { const ax = shx + 26; k.line(ax, 66, ax, 74, "#3a3a44"); F(ax - 3, 73, 7, 1, "#3a3a44"); P(ax - 3, 72, "#3a3a44"); P(ax + 3, 72, "#3a3a44"); F(ax - 1, 66, 3, 1, "#3a3a44"); }
    const bt = R(W * 0.32);
    F(bt - 7, 77, 15, 3, OL); F(bt - 6, 77, 13, 2, "#c84a3a"); F(bt - 6, 77, 13, 1, "#e86a5a"); F(bt - 5, 79, 11, 1, "#6a2a20");
    const sx = R(W * 0.44);
    k.blob(sx, 70, 4, 8, "#5a5a62"); k.blob(sx - 1, 68, 3, 7, "#7a7a84"); k.blob(sx - 2, 64, 1, 3, "#9a9aa4"); F(sx - 4, 62, 9, 1, "#e8e8ec");
    add(surf({ pts: [[sx, 77], [cx0 + 10, 82], [cx0 + 34, 81], [cvx, 80], [W - 22, 81]].filter((p) => p[0] < W - 4), seed: 1 }));
    add(shore({ x0: 0, x1: cx0 + 4, line: (x) => beach(x) - 1, seed: 1 }));
    add(A.waves({ x0: 0, x1: W, y: hz + 2, h: 40, n: R(W / 5), col: "#d8f0fc", seed: 2 }));
    add(sparkle({ x: 0, y: hz + 1, w: W, h: 12, n: R(W / 10), col: "#ffffff", seed: 3 }));
    add(ship({ x0: -20, x1: W * 0.5, y: hz - 1, period: 140, seed: 1 }));
    add(rowboat({ x0: W * 0.2, x1: W * 0.4, y: 86, period: 50, hull: "#3a6a8a", shirt: "#e8e0d0", hat: "#e8b84a", seed: 4, front: true }));
    for (let i = 0; i < 4; i++) add(A.gull({ W, y: k.rnd(6, 30), seed: 20 + i }));
    for (const [x, y] of chims) add(A.smoke({ x, y, wind: -5, seed: x }));
    add(A.crab({ x: R(W * 0.22), y: 86, range: 8, seed: 3 }));
    add(A.villager({ x0: cx0 + 22, x1: lx - 12, y: 34, speed: 3, look: { shirt: "#2e4a6e", hat: "#e8b84a" }, seed: 160 }));
    add(A.villager({ x0: shx + 4, x1: shx + 16, y: 76, speed: 2, look: { shirt: "#4a3a2a", carry: "#c8a060" }, seed: 161 }));
    add(A.flag({ x: shx + 10, y: 53, h: 6, c1: "#2a2a30", c2: "#e8e0d0", seed: 2 }));
  }

  function frosthold(k, A) {
    const { W, F, P } = k, add = k.add;
    const LOG = ["#8a6448", "#6a4a34", "#4e3626"], OL = "#0e1424", SN = ["#ffffff", "#e6eef8", "#c4d2e8", "#98aacc"];
    k.grad(0, 56, ["#0a1430", "#102044", "#1a2e5c", "#2a4676", "#4a6a98"]);
    const stars = [];
    for (let i = 0; i < W / 3; i++) { const x = k.ri(0, W), y = k.ri(0, 34); P(x, y, k.r() < 0.3 ? "#ffffff" : "#8aa0c8"); if (k.r() < 0.25) stars.push([x, y]); }
    const mx = R(W * 0.84);
    k.blob(mx, 10, 5, 5, "#fff8e0"); k.blob(mx + 2, 9, 4, 4, "#1a2e5c"); P(mx - 4, 9, "#fff8e0");
    add(A.twinkle({ pts: stars, col: "#ffffff", arm: "#a8c0f0", seed: 3 }));
    add(aurora({ W, y: 24, h: 18, cols: ["#3ad89a", "#5af0b0", "#c8ffe4", "#6a8ad8"], seed: 1 }));
    const range = (yb, cl, cd, rock, sd) => {
      const rr = Art.rng(sd), pk = [], nn = k.noise(sd);
      for (let x = -20; x < W + 40; x += 26 + Math.floor(rr() * 30)) pk.push([x, yb + Math.floor(rr() * 14), 0.6 + rr() * 0.7, 0.6 + rr() * 0.7]);
      for (let x = 0; x < W; x++) {
        let best = 99, lit = true, pkx = 0;
        for (const [px, py, sl, sr] of pk) { const y = py + (x < px ? (px - x) * sl : (x - px) * sr) + k.fbm(nn, x / 3) * 2.5; if (y < best) { best = y; lit = x < px + R(k.fbm(nn, x / 5 + 9) * 3 - 1); pkx = px; } }
        best = R(best);
        for (let y = best; y < 62; y++) {
          const d = y - best, rk = rock && (x * 2 + y) % 7 === 0 && k.fbm(nn, x / 6 + 30) > 0.45;
          let c = lit ? (d < 1 ? SN[0] : cl) : (rk && d > 2 ? rock : cd);
          if (!lit && Math.abs(x - pkx) < 2 && d < 3) c = cl;
          P(x, y, c);
        }
        P(x, best, lit ? "#ffffff" : cl);
      }
    };
    range(14, "#e0e8f6", "#8090c0", "#5a6898", 81);
    range(30, "#c8d4ec", "#7080b0", null, 82);
    for (let x = 0; x < W; x += 3) k.pine(x + k.ri(0, 2), 60 + k.ri(0, 2), k.ri(5, 8), ["#0e2230", "#183444", "#244a5a"], true);
    k.grad(60, 90, [SN[1], SN[2], SN[1], SN[0]]);
    for (let i = 0; i < W / 8; i++) { const x = k.ri(0, W), y = k.ri(64, 88); F(x, y, k.ri(4, 10), 1, SN[3]); F(x + 1, y - 1, k.ri(3, 7), 1, SN[0]); }
    const wx = R(W * 0.07);
    k.blob(wx, 66, 12, 6, "#4a5470"); k.blob(wx - 2, 64, 9, 4, "#6a7490"); k.blob(wx - 3, 61, 7, 2, SN[0]);
    const wt = 22;
    for (const [a, b] of [[-6, -3], [6, 3]]) { k.line(wx + a, 62, wx + b, wt + 6, OL); k.line(wx + a + (a < 0 ? 1 : -1), 62, wx + b + (a < 0 ? 1 : -1), wt + 6, LOG[1]); }
    for (let y = 56; y > wt + 8; y -= 8) { const hw = 3 + R((y - wt) * 0.08); k.line(wx - hw, y, wx + hw, y - 7, LOG[2]); F(wx - hw, y, hw * 2 + 1, 1, LOG[1]); }
    F(wx - 6, wt + 4, 13, 3, OL); F(wx - 5, wt + 5, 11, 1, LOG[0]); F(wx - 6, wt, 1, 5, LOG[1]); F(wx + 6, wt, 1, 5, LOG[1]); F(wx - 6, wt + 1, 13, 1, LOG[2]);
    k.tri(wx - 7, wt - 6, 15, 6, OL); k.tri(wx - 6, wt - 5, 13, 5, LOG[2]); k.tri(wx - 6, wt - 6, 13, 3, SN[0]);
    F(wx - 2, wt + 2, 4, 2, "#3a3a44");
    add(A.torch({ x: wx - 1, y: wt + 2, r: 20, seed: 1 }));
    add(A.glow({ x: wx, y: wt + 1, r: 26, rgb: "255,160,70", a: 0.12, seed: 2 }));
    const chims = [], glows = [];
    const hut = (x, w, wh, rh) => {
      const h = k.house({ x, g: 74, w, wh, rh, wall: LOG, roof: ["#7a5a44", "#5a4232", "#3e2c20"], ol: OL, logs: "#3e2a1e", lit: true, wins: 1, chim: "r", chimC: "#5a5a66", snow: true, doorC: "#4a3020" });
      for (const t of h.tops) if (t.length === 2) { const c = k.r() < 0.6 ? SN[0] : SN[1]; if (!h.burned) F(t[0], t[1] - 2, 1, 3, c); }
      F(x - 3, 73, w + 6, 2, SN[1]);
      if (!h.burned) for (let xx = x; xx < x + w; xx += 2) P(xx, h.top + 1, "#cce4ff");
      chims.push(h.burned ? null : h.chim);
      if (!h.burned) glows.push([x + 2, h.top + 5]);
      return h;
    };
    const rack = (x) => {
      F(x, 62, 1, 12, LOG[2]); F(x + 12, 62, 1, 12, LOG[2]); F(x - 1, 62, 14, 1, LOG[1]); P(x - 1, 61, SN[0]); P(x + 12, 61, SN[0]);
      const pelts = [["#8a5a34", "#6a4426"], ["#e8e0d0", "#c8beb0"], ["#7a7a84", "#5a5a64"]];
      pelts.forEach(([c1, c2], i) => { const px = x + 1 + i * 4; F(px, 63, 3, 7, c1); F(px + 2, 63, 1, 7, c2); P(px - 1, 64, c1); P(px + 3, 64, c2); P(px, 70, c1); P(px + 2, 70, c2); });
    };
    hut(R(W * 0.2), 18, 10, 9);
    rack(R(W * 0.2) + 22);
    hut(R(W * 0.8) - 6, 20, 11, 10);
    if (W > 250) hut(R(W * 0.93), 16, 9, 8);
    const lx = R(W * 0.5), lw = 50;
    const lodge = k.house({ x: lx - lw / 2, g: 76, w: lw, wh: 15, rh: 17, wall: LOG, roof: ["#7a5a44", "#5a4232", "#3e2c20"], ol: OL, logs: "#3e2a1e", type: "gable", lit: true, wins: 2, doorAt: lw / 2 - 2, doorC: "#2a1a10" });
    for (const [l, r2, y] of lodge.tops) { F(l - 1, y - 1, 3, 2, SN[0]); F(r2 - 2, y - 1, 3, 2, SN[1]); }
    k.tri(lx - lw / 2 - 2, 76 - 15 - 18, lw + 4, 5, SN[0]);
    for (const s of [-1, 1]) { k.line(lx, 42, lx + s * 6, 36, OL); k.line(lx + s, 42, lx + s * 7, 37, LOG[0]); P(lx + s * 7, 35, LOG[0]); P(lx + s * 8, 35, OL); }
    F(lx - 4, 76 - 15 - 1, 9, 2, SN[1]);
    const sy = 60;
    k.blob(lx, sy, 5, 4, OL); k.blob(lx, sy, 4, 3, "#f0ece0"); F(lx - 4, sy + 1, 9, 1, "#c8c0b0"); F(lx - 3, sy - 1, 2, 2, "#1a1414"); F(lx + 2, sy - 1, 2, 2, "#1a1414"); P(lx, sy + 1, "#1a1414");
    for (let i = -2; i <= 2; i++) P(lx + i * 1, sy + 3, i % 2 ? "#f0ece0" : "#1a1414");
    for (const s of [-1, 1]) { k.line(lx + s * 4, sy - 2, lx + s * 8, sy - 6, "#d8d0c0"); P(lx + s * 8, sy - 7, "#f0ece0"); }
    for (let x = lx - 9; x <= lx + 9; x++) { const l = 4 + ((x * 7) % 3); F(x, sy + 3, 1, l, x === lx - 9 || x === lx + 9 ? OL : (x + l) % 2 ? "#f4f0e8" : "#d8d2c4"); }
    const bnx = lx + 12;
    F(bnx, 64, 1, 12, LOG[2]); F(bnx - 1, 64, 8, 1, LOG[2]); F(bnx + 1, 65, 6, 8, "#3a5a8a"); F(bnx + 1, 65, 1, 8, "#5a7ab0"); P(bnx + 3, 67, "#f0ece0"); P(bnx + 5, 67, "#f0ece0"); P(bnx + 4, 66, "#f0ece0"); F(bnx + 3, 68, 3, 3, "#f0ece0"); P(bnx + 2, 72, "#3a5a8a"); P(bnx + 6, 72, "#3a5a8a");
    for (const s of [-1, 1]) { const tx = lx + s * 9 - (s < 0 ? 0 : 1); F(tx, 70, 1, 7, LOG[2]); add(A.torch({ x: tx - (s < 0 ? 1 : 0), y: 69, r: 14, seed: tx })); }
    glows.push([lx, 72]);
    F(lx - lw / 2 - 3, 75, lw + 6, 2, SN[1]);
    const snx = R(W * 0.34);
    k.blob(snx, 84, 4, 3, OL); k.blob(snx, 84, 3, 2, SN[0]); k.blob(snx, 79, 3, 2, OL); k.blob(snx, 79, 2, 2, SN[0]); P(snx - 1, 78, "#1a1414"); P(snx + 1, 78, "#1a1414"); P(snx + 1, 79, "#e88a3a"); P(snx + 2, 79, "#e88a3a");
    F(snx - 3, 77, 7, 1, "#2a2a30"); F(snx - 2, 74, 5, 3, "#2a2a30"); F(snx - 3, 81, 7, 1, "#c8302a"); P(snx + 3, 82, "#c8302a");
    const sdx = R(W * 0.62);
    F(sdx, 86, 16, 1, "#5a3a22"); F(sdx + 1, 84, 14, 2, LOG[1]); k.line(sdx + 15, 86, sdx + 18, 83, "#5a3a22");
    for (let i = 0; i < 3; i++) { F(sdx + 2 + i * 4, 81, 4, 3, OL); F(sdx + 2 + i * 4, 81, 3, 2, LOG[0]); P(sdx + 2 + i * 4, 81, "#c8a07a"); }
    for (let x = R(W * 0.7); x < W; x += 6) { P(x, 82 + ((x / 6) % 2), SN[3]); P(x + 1, 82 + ((x / 6) % 2), SN[3]); }
    for (const c of chims) if (c) add(A.smoke({ x: c[0], y: c[1], wind: 2, col: "#c8d0dc", seed: c[0] }));
    for (const [x, y] of glows) add(A.glow({ x, y, r: 10, rgb: "255,190,100", a: 0.14, seed: x }));
    add(A.snow({ W, H: 90, n: R(W / 4), speed: 5, wind: 1.2, seed: 7 }));
    for (let i = 0; i < 3; i++) { const x = k.rnd(W * 0.15, W * 0.85); add(A.villager({ x0: x, x1: x + k.rnd(10, 22), y: 80 + i * 3, speed: k.rnd(2, 4), look: { hood: k.pick(["#8a5a34", "#e8e0d0", "#6a4426", "#7a7a84"]), shirt: k.pick(["#6a4426", "#8a5a34", "#5a6a8a"]), hat: null }, seed: 170 + i })); }
  }

  // ---------- dungeons with a header of their own ----------
  // header-scale cut of the battle grunt (beasts.js goblin): dented pot helm, swept ears, red-striped hide shield on the back arm, spear
  const GOB = { s: "#8cbc4a", g: "#74a63e", d: "#5e8e36", P: "#d88a8a", e: "#ffe04a", H: "#a8a8b4", h: "#74747e", k: "#4a4656", r: "#a8643a",
    c: "#9a6e44", C: "#6e4c2e", b: "#4a3020", Y: "#d8a838", F: "#d4b47c", f: "#9a7c50", R: "#b83828", w: "#8a6a40", t: "#e4e8ee", T: "#9aa2aa",
    p: "#5a4430", o: "#2a1e14", a: "#f4f0e6", A: "#c4bcae" };
  const GOB_HEAD = ["..........t.", ".........ttT", ".....HHh..T.", "....HrHhh.R.", "ss.kkkkkkkw.", ".Pgssses..w.", "..dssssss.w."];
  const GOB_BODY = [".FRFcccgssw.", ".FRFbbYbC.w.", ".fRfcCcCc.w."];
  const GOB_LEGS = [["..f.g..g..w.", "...dd..dd.w."], ["..f..gg...w.", ".....dd...w."]];
  const COOK = ["...aaa...", "..aaaaa..", "...AAAA..", "ss.sssss.", ".Pgssesd.", "..ddsssss", "..caaaac.", "...aaaa..", "...aaaa.."];
  function goblinFrames(cook, pal) {
    const A = window.Anim;
    if (cook) return GOB_LEGS.map((l) => A.sprite(COOK.concat(l.map((r) => r.slice(0, 9).replace(/[fw]/g, "."))), GOB));
    return GOB_LEGS.map((l) => A.sprite(GOB_HEAD.concat(GOB_BODY, l), pal ? Object.assign({}, GOB, pal) : GOB));
  }
  // the same goblin in Goblin Town's compulsory hat: the helm's colours repainted as a hat, its shade, its band and its brim
  const HATS = [{ H: "#c8463a", h: "#8a2a22", r: "#f0c84a", k: "#5a1e18" }, { H: "#4a6ab0", h: "#2e4478", r: "#e8e0c8", k: "#1e2a4a" },
                { H: "#e0b43a", h: "#a87a20", r: "#7a3a8a", k: "#5a3a10" }];
  // walks a stretch and back, stopping at each end to look both ways; `clip` hides it behind whatever is in front of it
  function patrol(o) {
    const A = window.Anim, fr = goblinFrames(false, o.pal), ph = (o.seed || 0) * 0.37;
    const span = o.x1 - o.x0, speed = o.speed || 4, rest = 0.2, per = (2 * span / speed) / (1 - 2 * rest), a = 0.5 - rest;
    return { z: o.y, walker: true, draw(ctx, t) {
      const f = frac(t / per + ph);
      let u, moving = true, left;
      if (f < a) { u = f / a; left = false; } else if (f < 0.5) { u = 1; moving = false; left = (f - a) / rest > 0.55; }
      else if (f < 0.5 + a) { u = 1 - (f - 0.5) / a; left = true; } else { u = 0; moving = false; left = (f - 0.5 - a) / rest < 0.55; }
      const step = moving ? Math.floor(t * 5 + ph * 7) % 2 : 1;
      if (o.clip) { ctx.save(); ctx.beginPath(); for (let x = o.x0 - 8; x <= o.x1 + 8; x++) ctx.rect(x, 0, 1, o.clip(x)); ctx.clip(); }
      A.put(ctx, fr[step], o.x0 + u * span, o.y - (moving && step === 0 ? 1 : 0), left);
      if (o.clip) ctx.restore();
    } };
  }
  function lookout(o) {
    const A = window.Anim, fr = goblinFrames(false, o.pal), ph = (o.seed || 0) * 0.21;
    return { z: o.y, draw(ctx, t) {
      const f = frac(t / 11 + ph), left = f < 0.42 || (f > 0.62 && f < 0.7);
      A.put(ctx, fr[1], o.x, o.y + (frac(t / 2.6 + ph) < 0.12 ? 1 : 0), left);
    } };
  }
  function bonfire(o) {
    const A = window.Anim, cols = ["#b83a20", "#ec6a2a", "#ffac3e", "#ffe27a", "#fff8d8"];
    return { z: o.y, light: true, draw(ctx, t) {
      A.light(ctx, o.x, o.y - 2, 24, "255,150,60", 0.1 + 0.05 * Math.sin(t * 7.3));
      for (let i = -4; i <= 4; i++) {
        const ph = i * 2.3, base = 11 - Math.abs(i) * 1.8, hgt = Math.max(1, R(base * (0.72 + 0.2 * Math.sin(t * 8.7 + ph) + 0.12 * Math.sin(t * 21 + ph * 1.7))));
        for (let j = 0; j < hgt; j++) {
          const u = j / hgt, sway = R(Math.sin(t * 4.1 + i + j * 0.5) * u * 1.2);
          const c = u > 0.78 ? cols[0] : u > 0.5 ? cols[1] : u > 0.22 || Math.abs(i) > 2 ? cols[2] : Math.abs(i) < 1 && j < 2 ? cols[4] : cols[3];
          rect(ctx, o.x + i + sway, o.y - 1 - j, 1, 1, c);
        }
        if (Math.abs(i) < 3 && frac(t * 1.3 + i * 0.37) < 0.18) rect(ctx, o.x + i + R(Math.sin(t * 5 + i)), o.y - hgt - 2 - R(frac(t * 4 + i) * 2), 1, 1, cols[1]);
      }
    } };
  }
  // the spit turns as the cook cranks it: the roast's crackling and its fat shine roll round with the crank
  function roast(o) {
    const A = window.Anim, cook = goblinFrames(true)[1], rx = o.rx || 6, ry = 3, om = o.speed || 2.2;
    const MEAT = ["#4a1e10", "#7a3418", "#a8522a", "#cc7434", "#f0b26a"];
    const ex = o.x + o.reach;
    return { z: o.z, draw(ctx, t) {
      const ang = t * om, mx = o.x, my = o.y, hy = my + R(Math.sin(ang) * 2.4), hx = ex + R(Math.cos(ang) * 0.6);
      A.put(ctx, cook, ex + 6, o.feet + (Math.sin(ang) > 0.5 ? 1 : 0), true);
      rect(ctx, o.x - rx - 6, my, 2 * rx + 7 + o.reach - rx, 1, "#3a3440");
      rect(ctx, ex, Math.min(my, hy), 1, Math.abs(hy - my) + 1, "#3a3440"); rect(ctx, hx + 1, hy, 1, 1, "#8a6a40");
      ln(ctx, ex + 4, o.feet - 5, hx + 2, hy, "#1e1a14"); ln(ctx, ex + 4, o.feet - 6, hx + 2, hy, GOB.s); rect(ctx, hx + 2, hy, 1, 1, GOB.d);
      for (let dy = -ry - 1; dy <= ry + 1; dy++) {
        const v = dy / (ry + 1), half = R((rx + 1) * Math.sqrt(Math.max(0, 1 - v * v)));
        rect(ctx, mx - half, my + dy, 2 * half + 1, 1, "#2a140c");
      }
      for (let dy = -ry; dy <= ry; dy++) {
        const v = dy / (ry + 0.5), half = R(rx * Math.sqrt(Math.max(0, 1 - v * v))), th = Math.asin(Math.max(-1, Math.min(1, v)));
        for (let dx = -half; dx <= half; dx++) {
          const phi = th - ang;
          let s = 2.4 - v * 1.3 - (Math.abs(dx) >= half ? 0.8 : 0);
          if (Math.sin(phi * 3 + dx * 0.45) > 0.72) s -= 1.5;
          if (v < 0.2 && Math.sin(phi * 2 + 1.1) > 0.9) s += 1.4;
          rect(ctx, mx + dx, my + dy, 1, 1, MEAT[Math.max(0, Math.min(4, R(s)))]);
        }
      }
      for (const sx of [-1, 1]) { rect(ctx, mx + sx * (rx + 1) - (sx < 0 ? 1 : 0), my - 1, 2, 2, "#f0e8d6"); rect(ctx, mx + sx * (rx + 2) - (sx < 0 ? 1 : 0), my - 2, 1, 1, "#f0e8d6"); }
      const dr = frac(t / 2.3 + 0.3);
      if (dr < 0.35) rect(ctx, mx + 1 - R(dr * 6) % 3, my + ry + 1 + R(dr * 14), 1, 1, dr < 0.25 ? "#f4c46a" : "#ffe27a");
    } };
  }

  // the King of Goblin Town on his Throne Wagon: a chair nailed to a farm cart, a red blanket over the chair, a crown, and a wave
  const KING = ["..Y.Y.Y..", "..YYYYY..", "ss.sssss.", ".Pgssesd.", "..ddsssss", ".BBYYYBB.", ".BBBYBBB.", "..BBBBB.."];
  const KING_WAVE = ["s........", ".s.......", "..s......"];
  function throneKing(o) {
    const A = window.Anim, body = A.sprite(KING, Object.assign({ B: "#3e5ab0" }, GOB)), arm = [A.sprite(KING_WAVE, GOB), A.sprite(KING_WAVE.slice(1).concat(["s........"]), GOB)];
    return { z: o.z, draw(ctx, t) {
      A.put(ctx, body, o.x, o.y, false);
      const wave = frac(t / 5 + 0.2) < 0.4;
      if (wave) A.put(ctx, arm[Math.floor(t * 4) % 2], o.x - 3, o.y - 9, false);
    } };
  }
  // Goblin Town: the camp as it is the season it is a town (The Goblin Kingdom): posts painted green and the warning skulls taken down,
  // the king's crown and charter over the gate, market stalls and the Throne Wagon in the yard, buttons where the bones were, and hats
  function goblin_town(k, A) {
    goblin_camp(k, A, true);
  }
  function goblin_camp(k, A, town) {
    const { W, F, P } = k, add = k.add, o = k.o;
    const OL = "#2a1c14", WD = ["#c8935a", "#a06e40", "#7a5230", "#563820"], ROPE = "#d4b474", BURNT = "#5a3c24";
    // the stolen fence posts, painted the king's green before they go back to their farmers
    const PAINT = ["#94c86e", "#68a44c", "#467c38", "#2e5a28"];
    const HIDE = ["#e2c690", "#c49e66", "#96723f", "#664a2a"], BONE = "#f0e8d6", RED = town ? ["#5ea84a", "#3e7a34", "#264e22"] : ["#d85a3a", "#b03a2a", "#7a2420"];
    const GOLD = ["#fff0a0", "#f0c84a", "#c8962a", "#7a5418"];
    k.grad(0, 60, ["#4e8cc8", "#72a8d4", "#a2c4d8", "#dcd2a8", "#f0bc78"]);
    k.cloud(W * 0.2, 9, 30, ["#fff6e8", "#f6e6d0", "#e0c4a4"]); k.cloud(W * 0.72, 15, 24, ["#fff6e8", "#f6e6d0", "#e0c4a4"]); k.cloud(W * 0.95, 6, 14, ["#fff6e8", "#f6e6d0", "#e0c4a4"]);
    k.ridge(50, 9, 36, "#93aaa2", 31, "#a8beb2");
    const mid = k.ridge(57, 5, 18, "#6a8c4e", 32, "#82a25c");
    for (let i = 0; i < W / 16; i++) { const x = k.ri(0, W - 1); k.tree(x, mid[x] + 4, k.ri(2, 4), ["#2e5a2a", "#477a34", "#5e9440", "#8cbc5a"]); }
    const gx = R(W * 0.5), wy = 64, fy = 79;
    k.grad(60, 90, ["#9a8456", "#8c7448", "#7c663e"]);
    for (let y = 61; y < 90; y++) { const hw = 7 + R((y - 61) * 0.7); for (let x = gx - hw - 2; x < gx + hw + 2; x++) if (Math.abs(x - gx) < hw || k.on(x, y, 0.5)) P(x, y, "#ac9664"); }
    for (let i = 0; i < W * 1.4; i++) { const x = k.ri(0, W), y = k.ri(63, 89); P(x, y, k.r() < 0.5 ? "#a8925e" : "#6e5a36"); }
    for (let i = 0; i < W / 7; i++) { const x = k.ri(0, W), y = k.ri(64, 89); if (Math.abs(x - gx) < 16) continue; P(x, y, "#6a8a3a"); P(x + 1, y - 1, "#8aa84a"); P(x - 1, y - 1, "#6a8a3a"); }
    const tops = new Array(W).fill(wy);
    const stake = (kk, x, base, h, w, fence, rec, paint) => {
      const C = paint || WD;
      const top = base - h, n = (w + 1) >> 1;
      kk.F(x - 1, top + n, w + 2, h - n, OL);
      if (fence) {
        kk.F(x - 1, top + n - 1, w + 2, 1, OL);
        kk.F(x, top + n, w, h - n, "#e6dece"); kk.F(x + w - 1, top + n, 1, h - n, "#b4aa98"); kk.F(x, top + n + 3, w, 1, RED[1]);
        if (rec) for (let i = -1; i <= w; i++) if (x + i >= 0 && x + i < W) tops[x + i] = Math.min(tops[x + i], top + n - 1);
        return;
      }
      kk.F(x, top + n, 1, h - n, C[0]); kk.F(x + 1, top + n, w - 2, h - n, C[1]); kk.F(x + w - 1, top + n, 1, h - n, C[2]);
      for (let i = 0; i < n; i++) {
        const ww = Math.min(w, 1 + 2 * i), xx = x + ((w - ww) >> 1), y = top + i;
        kk.F(xx - 1, y, 1, 1, OL); kk.F(xx + ww, y, 1, 1, OL);
        kk.F(xx, y, ww, 1, paint ? (i < n - 1 ? C[3] : C[2]) : i < n - 1 ? BURNT : "#7a5636");
        if (rec) for (let j = xx - 1; j <= xx + ww; j++) if (j >= 0 && j < W) tops[j] = Math.min(tops[j], y);
      }
      kk.P(x + (w >> 1), top - 1, OL);
      if (rec && x + (w >> 1) < W) tops[x + (w >> 1)] = Math.min(tops[x + (w >> 1)], top - 1);
      for (let j = 0; j < (h >> 3); j++) kk.P(x + 1, top + n + 2 + k.ri(0, h - n - 4), C[2]);
    };
    const wall = [];
    for (let x = 0; x < W; x += 4) {
      if (Math.abs(x + 1 - gx) < 14) continue;
      const h = 15 + ((x * 7 + (x >> 3)) % 5), fence = k.r() < 0.08;
      wall.push([x, h]);
      stake(k, x, wy, h, 3, fence, true, town && (x * 13 + (x >> 2)) % 5 < 2 ? PAINT : null);
    }
    for (const y of [wy - 5, wy - 11]) for (let x = 0; x < W; x++) {
      if (Math.abs(x - gx) < 13) continue;
      P(x, y, x % 4 === 2 ? "#8a6a3a" : ROPE);
    }
    F(0, wy, W, 1, "#5e4a2c"); F(0, wy + 1, W, 1, "#7a6440");
    const post = (x, top) => { F(x - 1, top, 6, wy - top + 1, OL); F(x, top + 1, 1, wy - top, WD[0]); F(x + 1, top + 1, 2, wy - top, WD[1]); F(x + 3, top + 1, 1, wy - top, WD[2]); P(x + 1, top, BURNT); P(x + 2, top, BURNT); P(x + 1, top - 1, OL); P(x + 2, top - 1, OL); };
    post(gx - 14, 30); post(gx + 10, 30);
    F(gx - 16, 34, 32, 4, OL); F(gx - 15, 35, 30, 2, WD[1]); F(gx - 15, 35, 30, 1, WD[0]);
    for (const x of [gx - 14, gx + 10]) { F(x - 1, 38, 6, 1, ROPE); F(x - 1, 33, 6, 1, ROPE); }
    if (town) {
      // a wooden crown over the gate, gilded badly, and the charter nailed to the crossbar
      F(gx - 7, 27, 15, 8, OL); F(gx - 6, 29, 13, 5, GOLD[1]); F(gx - 6, 33, 13, 1, GOLD[2]); F(gx - 6, 29, 13, 1, GOLD[0]);
      for (const dx of [-6, -2, 2, 6]) { F(gx + dx - 1, 24, 3, 5, OL); F(gx + dx, 25, 1, 4, GOLD[1]); P(gx + dx, 24, GOLD[0]); }
      for (const [dx, c] of [[-4, "#c8302a"], [0, "#3a6ad0"], [4, "#c8302a"]]) { P(gx + dx, 31, c); P(gx + dx, 30, GOLD[0]); }
      F(gx - 2, 38, 5, 7, OL); F(gx - 1, 39, 3, 5, "#f2e8cc"); P(gx, 40, "#8a7a62"); P(gx - 1, 42, "#8a7a62"); P(gx + 1, 42, "#8a7a62"); F(gx - 1, 44, 3, 1, "#c8302a");
    } else {
      for (const s of [-1, 1]) {
        k.line(gx + s * 3, 30, gx + s * 6, 27, OL); k.line(gx + s * 6, 27, gx + s * 8, 24, OL); k.line(gx + s * 8, 24, gx + s * 8, 22, OL);
        k.line(gx + s * 3, 29, gx + s * 6, 26, BONE); k.line(gx + s * 6, 26, gx + s * 7, 24, "#d8ccb4"); P(gx + s * 7, 23, "#d8ccb4");
      }
      k.blob(gx, 31, 4, 3, OL); k.blob(gx, 31, 3, 2, BONE); F(gx - 1, 33, 3, 3, OL); F(gx - 1, 33, 3, 2, "#e0d6c0");
      P(gx - 1, 31, OL); P(gx + 1, 31, OL); P(gx - 2, 30, "#d8ccb4"); P(gx, 34, "#8a7a62");
    }
    const banner = (x, y, h) => {
      F(x - 1, y - 1, 7, h + 1, OL); F(x, y, 5, h, RED[1]); F(x, y, 1, h, RED[0]); F(x + 4, y, 1, h, RED[2]);
      for (let i = 0; i < 5; i += 2) P(x + i, y + h, RED[1]);
      if (town) { P(x + 1, y + 2, GOLD[1]); P(x + 2, y + 1, GOLD[1]); P(x + 3, y + 2, GOLD[1]); F(x + 1, y + 3, 3, 2, GOLD[1]); P(x + 2, y + 3, GOLD[0]); P(x + 2, y + 6, GOLD[1]); return; }
      P(x + 1, y + 3, BONE); P(x + 3, y + 3, BONE); F(x + 1, y + 2, 3, 1, BONE); P(x + 2, y + 4, BONE); P(x + 1, y + 6, BONE); P(x + 3, y + 6, BONE); P(x + 2, y + 7, BONE);
    };
    banner(gx - 11, 38, 9); banner(gx + 6, 38, 9);
    add(pennant({ x: gx - 13, y: 26, len: 7, h: 3, c1: RED[1], c2: RED[0], c3: RED[2], fork: true, seed: 2 }));
    add(pennant({ x: gx + 11, y: 26, len: 7, h: 3, c1: RED[1], c2: RED[0], c3: RED[2], fork: true, seed: 5 }));
    F(gx - 13, 26, 1, 4, OL); F(gx + 11, 26, 1, 4, OL);
    for (const x of [gx - 17, gx + 15]) { F(x, 46, 3, 1, OL); F(x + 1, 44, 1, 2, "#3a3440"); add(A.torch({ x, y: 43, r: 16, seed: x })); }

    const tx = R(W * 0.12), py = 30, ty = 75;
    for (const lx of [tx - 9, tx + 7]) { F(lx - 1, py, 4, ty - py, OL); F(lx, py, 1, ty - py, WD[0]); F(lx + 1, py, 1, ty - py, WD[2]); }
    for (let y = py + 5; y < ty - 8; y += 13) for (const s of [-1, 1]) {
      const x0 = s < 0 ? tx - 7 : tx + 6, x1 = s < 0 ? tx + 6 : tx - 7;
      k.line(x0, y, x1, y + 11, OL); k.line(x0, y + 1, x1, y + 12, WD[2]);
    }
    F(tx - 13, py - 1, 27, 4, OL); F(tx - 12, py, 25, 2, WD[1]); F(tx - 12, py, 25, 1, WD[0]);
    for (let x = tx - 10; x < tx + 13; x += 4) P(x, py + 1, WD[3]);
    for (let y = ty - 2; y > py + 2; y -= 3) { F(tx + 11, y, 4, 1, WD[2]); }
    k.line(tx + 10, ty, tx + 10, py + 2, OL); k.line(tx + 15, ty, tx + 15, py + 2, OL);
    for (const x of [tx - 11, tx + 10]) { F(x - 1, py - 18, 3, 18, OL); F(x, py - 17, 1, 17, WD[1]); }
    k.tri(tx - 16, py - 27, 33, 10, OL);
    for (let i = 0; i < 9; i++) {
      const ins = 16 * (8 - i) / 9, l = R(tx - 15 + ins), r2 = R(tx + 16 - ins), y = py - 26 + i;
      F(l, y, r2 - l, 1, HIDE[1]); F(l, y, Math.max(1, R((r2 - l) * 0.42)), 1, HIDE[0]); P(r2 - 1, y, HIDE[2]);
    }
    for (let x = tx - 15; x < tx + 16; x += 3) P(x, py - 17, x % 2 ? HIDE[2] : OL);
    F(tx + 4, py - 22, 4, 3, "#8a5a3a"); P(tx + 4, py - 21, HIDE[3]); P(tx + 7, py - 21, HIDE[3]);
    k.line(tx - 2, py - 29, tx + 2, py - 25, OL); k.line(tx + 2, py - 29, tx - 2, py - 25, OL);
    for (let x = tx - 13; x < tx + 13; x += 4) stake(o, x, py, 5, 3, false, false);
    o.F(tx - 13, py - 3, 27, 1, ROPE);
    add(lookout({ x: tx - 1, y: py - 3, seed: 3, pal: town ? HATS[1] : null }));
    add(pennant({ x: tx, y: py - 30, len: 6, h: 2, c1: RED[1], c2: RED[0], seed: 8 }));
    F(tx, py - 30, 1, 4, OL);

    const lx = R(W * 0.3);
    const barrel = (x, y) => { F(x - 1, y - 8, 7, 9, OL); F(x, y - 7, 5, 7, "#9a6a3a"); F(x, y - 7, 1, 7, "#b8844a"); F(x + 4, y - 7, 1, 7, "#6e4a28"); F(x, y - 6, 5, 1, "#5a5a62"); F(x, y - 2, 5, 1, "#5a5a62"); F(x, y - 7, 5, 1, "#c89a5a"); };
    const crate = (x, y) => { F(x - 1, y - 7, 9, 8, OL); F(x, y - 6, 7, 6, "#b08a50"); F(x, y - 6, 7, 1, "#cca46a"); k.line(x, y - 5, x + 6, y - 1, "#7a5a30"); F(x, y - 1, 7, 1, "#7a5a30"); };
    const wr = 5, wcx = lx + 22, wcy = wy - 4;
    for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; P(wcx + R(Math.cos(t) * (wr + 1)), wcy + R(Math.sin(t) * (wr + 1)), OL); }
    for (let a = 0; a < 32; a++) { const t = a / 32 * Math.PI * 2; P(wcx + R(Math.cos(t) * wr), wcy + R(Math.sin(t) * wr), Math.sin(t) < 0 ? "#b07a44" : "#7a5230"); }
    for (let q = 0; q < 4; q++) { const t = q * Math.PI / 4 + 0.3; k.line(wcx - R(Math.cos(t) * (wr - 1)), wcy - R(Math.sin(t) * (wr - 1)), wcx + R(Math.cos(t) * (wr - 1)), wcy + R(Math.sin(t) * (wr - 1)), "#7a5230"); }
    F(wcx - 1, wcy - 1, 2, 2, "#3a3440");
    barrel(lx, 70); barrel(lx + 6, 71); crate(lx + 12, 72); barrel(lx + 3, 63);
    k.blob(lx - 6, 69, 4, 3, OL); k.blob(lx - 6, 69, 3, 2, "#d8c08a"); P(lx - 7, 67, "#f0dca8"); F(lx - 7, 66, 2, 1, "#a8884a");
    for (const [bx, by] of [[gx - 22, 84], [gx + 26, 80], [R(W * 0.42), 87], [R(W * 0.6), 74]]) {
      if (town) { P(bx, by, GOLD[1]); P(bx + 1, by, GOLD[2]); P(bx + 3, by + 1, "#c8c8d0"); continue; }
      F(bx, by, 3, 1, BONE); P(bx - 1, by - 1, BONE); P(bx + 3, by + 1, BONE);
    }

    // a market stall: two posts, a striped awning, a counter of goods
    const stall = (x, g, cols) => {
      for (const dx of [0, 13]) { F(x + dx - 1, g - 13, 3, 13, OL); F(x + dx, g - 12, 1, 12, WD[1]); }
      F(x - 2, g - 16, 18, 4, OL);
      for (let i = 0; i < 16; i++) { F(x - 1 + i, g - 15, 1, 2, cols[(i >> 1) % 2]); }
      for (let i = 0; i < 16; i += 2) P(x - 1 + i, g - 13, cols[0]);
      F(x - 1, g - 6, 16, 3, OL); F(x, g - 5, 14, 1, "#b08a50"); F(x, g - 4, 14, 1, "#7a5a30");
      const wares = [GOLD[1], "#c8463a", "#e8dcb8", "#6a9a3a", "#3e6ab0", "#c8c8d0"];
      for (let i = 0; i < 6; i++) { F(x + 1 + i * 2, g - 7, 2, 2, OL); P(x + 1 + i * 2, g - 7, wares[(i + x) % wares.length]); P(x + 2 + i * 2, g - 6, wares[(i + x + 2) % wares.length]); }
    };
    // the Throne Wagon: a farm cart, a chair nailed to its bed, a red blanket over the chair, and the king
    const throneWagon = (x, g) => {
      F(x - 2, g - 9, 26, 4, OL); F(x - 1, g - 8, 24, 2, "#a06e40"); F(x - 1, g - 8, 24, 1, "#c8935a");
      k.line(x + 22, g - 7, x + 30, g - 3, OL); k.line(x + 22, g - 6, x + 30, g - 2, "#7a5230");
      for (const wx of [x + 3, x + 18]) {
        for (let a = 0; a < 28; a++) { const t = a / 28 * Math.PI * 2; P(wx + R(Math.cos(t) * 4), g - 3 + R(Math.sin(t) * 4), OL); }
        for (let a = 0; a < 22; a++) { const t = a / 22 * Math.PI * 2; P(wx + R(Math.cos(t) * 3), g - 3 + R(Math.sin(t) * 3), "#9a6a3a"); }
        k.line(wx - 3, g - 3, wx + 3, g - 3, "#7a5230"); k.line(wx, g - 6, wx, g, "#7a5230"); P(wx, g - 3, OL);
      }
      F(x + 6, g - 22, 11, 14, OL); F(x + 7, g - 21, 9, 3, "#7a5230"); F(x + 7, g - 18, 9, 9, "#b8302a"); F(x + 7, g - 18, 9, 1, "#e0604a");
      for (let i = 0; i < 9; i += 2) P(x + 7 + i, g - 10, GOLD[1]);
      F(x + 6, g - 24, 2, 3, OL); F(x + 15, g - 24, 2, 3, OL); P(x + 6, g - 24, GOLD[1]); P(x + 16, g - 24, GOLD[1]);
      add(throneKing({ x: x + 7, y: g - 16, z: g + 1 }));
      add(pennant({ x: x - 1, y: g - 22, len: 6, h: 3, c1: RED[1], c2: RED[0], c3: RED[2], fork: true, seed: 6 }));
      F(x - 1, g - 22, 1, 13, OL);
    };
    const tent = (x, g, w, h, chief) => {
      k.tri(x - 1, g - h - 1, w + 2, h + 1, OL);
      for (let i = 0; i < h; i++) {
        const ins = (w / 2) * (h - 1 - i) / h, l = R(x + ins), r2 = R(x + w - ins), y = g - h + i;
        F(l, y, r2 - l, 1, HIDE[1]); F(l, y, Math.max(1, R((r2 - l) * 0.4)), 1, HIDE[0]); P(r2 - 1, y, HIDE[2]);
      }
      const ax = x + (w >> 1), ay = g - h;
      k.line(ax, ay, R(x + w * 0.22), g - 1, HIDE[2]); k.line(ax, ay, R(x + w * 0.8), g - 1, HIDE[3]);
      F(R(x + w * 0.62), R(g - h * 0.45), 4, 3, chief ? RED[1] : "#8a5a3a"); P(R(x + w * 0.62) - 1, R(g - h * 0.45) + 1, HIDE[3]);
      const dw = chief ? 9 : 7;
      k.tri(ax - (dw >> 1), g - dw, dw, dw, "#22160e"); k.line(ax - 1, g - dw + 1, ax - (dw >> 1) - 1, g - 1, HIDE[0]);
      k.line(ax - 2, ay - 3, ax + 1, ay, OL); k.line(ax + 2, ay - 3, ax - 1, ay, OL); P(ax - 2, ay - 3, WD[1]); P(ax + 2, ay - 3, WD[1]);
      F(x - 1, g, w + 2, 1, "#5e4a2c");
      return [ax, ay];
    };
    if (town) throneWagon(R(W * 0.64), 76);
    else tent(R(W * 0.66), 70, 22, 13, false);
    const [cx, cy] = tent(R(W * 0.8), 73, 30, 18, true);
    add(A.smoke({ x: cx, y: cy - 3, n: 4, rise: 12, wind: 3, col: "#c8c0b8", seed: 11 }));
    if (town) { F(cx - 2, cy + 7, 5, 3, OL); F(cx - 1, cy + 8, 3, 1, GOLD[1]); P(cx - 1, cy + 7, GOLD[1]); P(cx + 1, cy + 7, GOLD[1]); }
    else {
      k.blob(cx, cy + 9, 2, 2, OL); k.blob(cx, cy + 9, 2, 1, BONE); P(cx - 1, cy + 9, OL); P(cx + 1, cy + 9, OL);
      for (const s of [-1, 1]) { P(cx + s * 3, cy + 8, BONE); P(cx + s * 4, cy + 7, BONE); P(cx + s * 4, cy + 6, "#d8ccb4"); }
    }
    const sx = R(W * 0.8) + 34;
    F(sx - 1, 46, 3, 28, OL); F(sx, 47, 1, 27, WD[1]);
    if (town) { F(sx - 1, 44, 3, 2, OL); P(sx, 44, GOLD[0]); } else { k.blob(sx, 45, 2, 2, OL); k.blob(sx, 45, 1, 1, BONE); P(sx, 45, OL); }
    F(sx - 8, 48, 8, 12, OL); F(sx - 7, 49, 7, 10, RED[1]); F(sx - 7, 49, 7, 1, RED[0]); F(sx - 7, 49, 1, 10, RED[0]);
    for (let i = 0; i < 7; i += 2) P(sx - 7 + i, 59, RED[1]);
    if (town) { for (const dx of [-6, -4, -2]) P(sx + dx, 51, GOLD[1]); F(sx - 6, 52, 5, 2, GOLD[1]); F(sx - 6, 54, 5, 1, GOLD[2]); P(sx - 4, 52, "#c8302a"); F(sx - 6, 56, 5, 1, GOLD[1]); }
    else { F(sx - 5, 51, 3, 2, BONE); P(sx - 5, 52, OL); P(sx - 3, 52, OL); P(sx - 4, 53, BONE); P(sx - 6, 55, BONE); P(sx - 2, 55, BONE); P(sx - 5, 56, BONE); P(sx - 3, 56, BONE); P(sx - 4, 57, BONE); }

    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, x = gx + R(Math.cos(a) * 7), y = fy + R(Math.sin(a) * 2);
      if (y < fy) continue;
      F(x - 1, y, 3, 2, OL); F(x, y, 2, 1, "#a8a4a0"); P(x, y + 1, "#6e6a68");
    }
    F(gx - 5, fy - 1, 11, 2, "#2a1a10"); k.line(gx - 5, fy - 2, gx + 4, fy, "#5a3a22"); k.line(gx + 5, fy - 2, gx - 4, fy, "#4a3020");
    P(gx - 2, fy - 1, "#ff8a3a"); P(gx + 2, fy, "#ffb84a"); P(gx + 4, fy - 1, "#ff6a2a");
    const my = fy - 11, rx = 5, cxr = gx + rx + 8;
    F(cxr - 1, fy - 4, 9, 5, OL); F(cxr, fy - 3, 7, 3, "#b08a50"); F(cxr, fy - 3, 7, 1, "#cca46a"); F(cxr, fy, 7, 1, "#7a5a30"); k.line(cxr, fy - 2, cxr + 6, fy - 1, "#8a6a3a");
    for (const s of [-1, 1]) {
      const px = gx + s * (rx + 5);
      F(px - 1, my - 2, 3, fy - my + 3, OL); F(px, my - 1, 1, fy - my + 2, WD[2]);
      P(px - 1, my - 3, OL); P(px + 1, my - 3, OL); P(px - 1, my - 2, WD[1]); P(px + 1, my - 2, WD[1]);
    }
    add(bonfire({ x: gx, y: fy - 1 }));
    add(A.embers({ x0: gx - 4, x1: gx + 4, y: fy - 6, n: 6, rise: 24, z: fy, seed: 90731 }));
    add(A.smoke({ x: gx, y: my - 4, n: 7, rise: 30, life: 4.4, wind: 6, col: "#c4bcb4", seed: 21 }));
    add(A.glow({ x: gx, y: fy - 3, r: 46, rgb: "255,150,60", a: 0.07, amp: 0.25, speed: 1.4, seed: 6 }));
    add(roast({ x: gx, y: my, rx, reach: rx + 5, feet: fy - 4, z: fy + 1 }));

    const pk = gx - 25;
    F(pk - 1, 72, 3, 16, OL); F(pk, 73, 1, 15, WD[1]);
    if (town) {
      F(pk - 5, 70, 11, 3, OL); F(pk - 4, 71, 9, 1, "#c8463a"); F(pk - 2, 66, 5, 5, OL); F(pk - 1, 67, 3, 3, "#c8463a"); F(pk - 1, 69, 3, 1, GOLD[1]); P(pk + 2, 65, "#f0e8d6"); P(pk + 3, 64, "#f0e8d6");
      F(pk + 3, 75, 10, 7, OL); F(pk + 4, 76, 8, 5, "#e8dcb8"); F(pk + 5, 77, 6, 1, "#7a5a3a"); F(pk + 5, 79, 4, 1, "#7a5a3a"); F(pk + 10, 79, 1, 1, "#c8302a"); F(pk + 7, 82, 1, 5, OL);
    } else { k.blob(pk, 70, 3, 3, OL); k.blob(pk, 70, 2, 2, BONE); P(pk - 1, 70, OL); P(pk + 1, 70, OL); F(pk - 1, 72, 3, 1, "#d8ccb4"); P(pk, 72, OL); }
    add(chicken({ x: R(W * 0.71), y: 81, seed: 2 })); add(chicken({ x: R(W * 0.75), y: 83, seed: 5, col: "#c87a3a" }));
    const clip = (x) => (x >= 0 && x < W ? tops[x] : 0);
    if (town) {
      stall(R(W * 0.38), 80, ["#c8463a", "#f2e8cc"]); stall(R(W * 0.57), 86, ["#3e6ab0", "#f2e8cc"]);
      add(patrol({ x0: R(W * 0.2), x1: R(W * 0.43), y: wy - 13, speed: 3, clip, seed: 2, pal: HATS[0] }));
      add(patrol({ x0: R(W * 0.18), x1: R(W * 0.34), y: 79, speed: 3.5, seed: 5, pal: HATS[1] }));
      add(patrol({ x0: R(W * 0.44), x1: R(W * 0.56), y: 89, speed: 3, seed: 7, pal: HATS[2] }));
      add(patrol({ x0: R(W * 0.66), x1: R(W * 0.9), y: 86, speed: 4.5, seed: 9, pal: HATS[0] }));
      add(A.villager({ x0: R(W * 0.4), x1: R(W * 0.52), y: 84, speed: 2.6, look: { hood: "#6a4426", shirt: "#5a6a8a", hat: null }, seed: 171 }));
    } else {
      add(patrol({ x0: R(W * 0.2), x1: R(W * 0.43), y: wy - 13, speed: 3, clip, seed: 2 }));
      add(patrol({ x0: R(W * 0.2), x1: R(W * 0.4), y: 77, speed: 4, seed: 5 }));
      add(patrol({ x0: R(W * 0.6), x1: R(W * 0.88), y: 86, speed: 4.5, seed: 9 }));
    }
    const perch = wall.find(([x]) => x > W * 0.58);
    if (perch) add(raven({ x: perch[0] + 1, y: wy - perch[1] - 2, seed: 4 }));
    add(A.bird({ W, y: 12, flock: 3, col: "#1e1a20", speed: 6, gap: 14, seed: 3 }));

    const front = (x, h) => stake(o, x, 92, h, 5, false, false);
    for (const [x, h] of [[-2, 46], [4, 40], [W - 9, 42], [W - 3, 47]]) front(x, h);
    for (const [x0, x1] of [[-2, 9], [W - 10, W]]) { o.F(x0, 70, x1 - x0, 1, ROPE); o.F(x0, 78, x1 - x0, 1, ROPE); }
  }

  const SCENES = { ironhaven, thornwall, veldrock, carrbridge, ashfen, hollowood, saltmarrow, frosthold };
  const DUNGEON_SCENES = { goblin_camp };
  // a place that is a town for one season only (a theme's as_town), named by its static row's `scene`
  const SEASON_SCENES = { goblin_town };
  const WILD_SCENES = {};

  // the night version of a scene: the sky is painted in a key colour so it can be swapped for a night sky, everything else is
  // graded to moonlight, and of the moving life only the lights (fires, torches, glows, eyes) carry on
  const SKY_KEY = "#ff00fe", LIGHTS = new Set(["torch", "glow", "embers", "fireflies", "wisp"]);
  function nightSky(y, h) { const t = Math.min(1, y / Math.max(1, h)); return [R(10 + 22 * t), R(15 + 26 * t), R(36 + 46 * t)]; }
  function grade(cv, sky) {
    const ctx = cv.getContext("2d"), im = ctx.getImageData(0, 0, cv.width, cv.height), d = im.data, mask = new Uint8Array(cv.width * cv.height);
    const r = Art.rng(77), skyH = Math.max(1, sky || cv.height), w = cv.width, h = cv.height;
    const warm = (i) => d[i + 3] && d[i] > 190 && d[i + 1] >= 90 && d[i + 2] < 130 && d[i] - d[i + 2] > 110;
    // a summed table of the warm-coloured pixels: a lit window or an ember is a bright spot in something dark, while a wheat field,
    // thatch, a gilt dome or desert sand is a whole patch of warm colour, so only the bright spots glow on through the dark
    const warmish = (i) => d[i + 3] && d[i] > 130 && d[i] - d[i + 2] > 60;
    const sum = new Uint32Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) for (let x = 0, run = 0; x < w; x++) { run += warmish((y * w + x) * 4) ? 1 : 0; sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + run; }
    const dense = (x, y) => {
      const x0 = Math.max(0, x - 4), x1 = Math.min(w, x + 5), y0 = Math.max(0, y - 4), y1 = Math.min(h, y + 5);
      return (sum[y1 * (w + 1) + x1] - sum[y0 * (w + 1) + x1] - sum[y1 * (w + 1) + x0] + sum[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
    };
    const dark = (c0, c1, c2) => { const l = c0 * 0.3 + c1 * 0.55 + c2 * 0.15; return [8 + c0 * 0.2 + l * 0.08, 10 + c1 * 0.22 + l * 0.1, 24 + c2 * 0.26 + l * 0.2]; };
    const d0 = new Uint8ClampedArray(d), lum0 = (p) => d0[p * 4] * 0.3 + d0[p * 4 + 1] * 0.55 + d0[p * 4 + 2] * 0.15;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const p = i >> 2, y = Math.floor(p / w);
      if (d[i] === 255 && d[i + 1] === 0 && d[i + 2] === 254) {
        mask[p] = 1;
        const [a, b, c] = nightSky(y, skyH), star = r() < 0.012 ? 120 + r() * 110 : 0;
        d[i] = Math.min(255, a + star); d[i + 1] = Math.min(255, b + star); d[i + 2] = Math.min(255, c + star * 0.9);
        continue;
      }
      // haze or a glow laid half over the key sky: take the key's share back out and put the night sky in its place, so it never
      // grades to a purple band
      const ka = Math.min(d[i], d[i + 2]) - d[i + 1];
      if (ka > 70 && Math.abs(d[i] - d[i + 2]) < 50) {
        const a = Math.min(0.95, ka / 255), un = (v, k) => Math.max(0, Math.min(255, (v - a * k) / (1 - a)));
        const g = dark(un(d[i], 255), un(d[i + 1], 0), un(d[i + 2], 254)), s = nightSky(y, skyH);
        d[i] = R(a * s[0] + (1 - a) * g[0]); d[i + 1] = R(a * s[1] + (1 - a) * g[1]); d[i + 2] = R(a * s[2] + (1 - a) * g[2]);
        continue;
      }
      // lava, lit windows and embers glow on through the dark
      const lit = warm(i) ? Math.max(0, Math.min(1, (0.6 - dense(p % w, y)) / 0.25)) : 0;
      const g = dark(d[i], d[i + 1], d[i + 2]);
      d[i] = R(g[0] + (d[i] * 0.92 - g[0]) * lit); d[i + 1] = R(g[1] + (d[i + 1] * 0.85 - g[1]) * lit); d[i + 2] = R(g[2] + (d[i + 2] * 0.8 - g[2]) * lit);
    }
    // the moon catches the tops of things: a roof against the sky, or a lit face just under a dark outline, takes a cool edge, so
    // rows of rooftops stay apart instead of grading into one dark mass
    for (let p = w; p < w * h; p++) {
      const i = p * 4, up = p - w;
      if (mask[p] || !d0[i + 3] || warm(i)) continue;
      if (!(mask[up] || (lum0(up) < 60 && lum0(p) > 90 && lum0(p) - lum0(up) > 50))) continue;
      d[i] = R(d[i] * 0.55 + 106 * 0.45); d[i + 1] = R(d[i + 1] * 0.55 + 122 * 0.45); d[i + 2] = R(d[i + 2] * 0.55 + 168 * 0.45);
    }
    ctx.putImageData(im, 0, 0);
    return mask;
  }
  // opts.life keeps the rest of the life on a night scene too (the townsfolk, carts, boats, smoke), drawn in the moonlight's colour;
  // the birds and butterflies and the sun's own glints still go
  const DAY_ONLY = new Set(["bird", "gull", "eagle", "butterfly"]);
  let moonCv = null;
  function moonlit(a) {
    return Object.assign({}, a, { draw(ctx, t) {
      const w = ctx.canvas.width, h = ctx.canvas.height;
      if (!moonCv || moonCv.width !== w || moonCv.height !== h) moonCv = canvas(w, h);
      const g = moonCv.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.setTransform(ctx.getTransform());
      a.draw(g, t);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(14,20,46,0.64)"; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over";
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(moonCv, 0, 0); ctx.restore();
    } });
  }
  // a low sun (scenes.js's TONES: the Long Night's dawn): the key sky becomes the tone's sky with its disc low on the right, half behind
  // the roofs; everything else takes the tone's flat grade, and an edge that faces the sun (sky to its right or above it) catches it
  const hexRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function toneGrade(cv, skyEnd, T) {
    const ctx = cv.getContext("2d"), w = cv.width, h = cv.height, im = ctx.getImageData(0, 0, w, h), d = im.data, mask = new Uint8Array(w * h);
    const skyH = Math.max(1, skyEnd || h), dc = T.disc, rr = dc.r + 2;
    // the sun comes up where the roofs on the right sit lowest, just its top half over them
    const key = (x, y) => { const i = (y * w + x) * 4; return d[i] === 255 && d[i + 1] === 0 && d[i + 2] === 254; };
    const line = [];
    for (let x = 0; x < w; x++) { let y = 0; while (y < h && key(x, y)) y++; line.push(y); }
    let sx = R(w * dc.x), best = -1;
    for (let cx = R(w * 0.6); cx <= R(w * 0.94); cx++) {
      let s = 0;
      for (let x = cx - rr; x <= cx + rr; x++) s += line[Math.max(0, Math.min(w - 1, x))];
      const v = s / (rr * 2 + 1) - Math.abs(cx - w * dc.x) * 0.05;
      if (v > best) { best = v; sx = cx; }
    }
    let lo = 0;
    for (let x = sx - rr; x <= sx + rr; x++) lo += line[Math.max(0, Math.min(w - 1, x))];
    const sy = skyEnd ? R(lo / (rr * 2 + 1)) + 2 : -99;
    const skyAt = (y) => { const t = Math.min(1, y / skyH); return hexRGB(t < 0.55 ? Art.mix(T.sky[0], T.sky[1], t / 0.55) : Art.mix(T.sky[1], T.sky[2], (t - 0.55) / 0.45)); };
    const glow = hexRGB(dc.ring), disc = dc.c.map(hexRGB);
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const p = i >> 2, x = p % w, y = (p / w) | 0;
      if (d[i] === 255 && d[i + 1] === 0 && d[i + 2] === 254) {
        mask[p] = 1;
        const dx = x - sx, dy = y - sy, dd = Math.sqrt(dx * dx + dy * dy);
        let c = skyAt(y);
        if (dd <= rr) c = dx + dy < -rr * 0.7 ? disc[0] : dd > rr - 1.6 && dx + dy > 0 ? disc[2] : disc[1];
        else if (dd <= rr + 6 && (x + y) % 2 === 0) c = c.map((v, j) => R(v + (glow[j] - v) * (dd <= rr + 3 ? 0.7 : 0.35)));
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
        continue;
      }
      const ka = Math.min(d[i], d[i + 2]) - d[i + 1];
      if (ka > 70 && Math.abs(d[i] - d[i + 2]) < 50) {
        const a = Math.min(0.95, ka / 255), un = (v, k) => Math.max(0, Math.min(255, (v - a * k) / (1 - a)));
        const g = T.land(un(d[i], 255), un(d[i + 1], 0), un(d[i + 2], 254)), s = skyAt(y);
        d[i] = R(a * s[0] + (1 - a) * g[0]); d[i + 1] = R(a * s[1] + (1 - a) * g[1]); d[i + 2] = R(a * s[2] + (1 - a) * g[2]);
        continue;
      }
      const g = T.land(d[i], d[i + 1], d[i + 2]);
      d[i] = g[0]; d[i + 1] = g[1]; d[i + 2] = g[2];
    }
    for (let p = w; p < w * h; p++) {
      const i = p * 4;
      if (mask[p] || !d[i + 3] || !(mask[p - w] || (p % w < w - 1 && mask[p + 1]))) continue;
      d[i] = R(d[i] * 0.5 + glow[0] * 0.5); d[i + 1] = R(d[i + 1] * 0.5 + glow[1] * 0.5); d[i + 2] = R(d[i + 2] * 0.5 + glow[2] * 0.5);
    }
    ctx.putImageData(im, 0, 0);
    return mask;
  }
  // the life on a toned scene, drawn in the tone's warm shadow
  let toneCv = null;
  function toned(a) {
    return Object.assign({}, a, { draw(ctx, t) {
      const w = ctx.canvas.width, h = ctx.canvas.height;
      if (!toneCv || toneCv.width !== w || toneCv.height !== h) toneCv = canvas(w, h);
      const g = toneCv.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.setTransform(ctx.getTransform());
      a.draw(g, t);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(80,36,30,0.3)"; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over";
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(toneCv, 0, 0); ctx.restore();
    } });
  }
  // The Dragon Wakes: a town she burned this season. Two or three houses, spread along the street, have their roofs gone to char along
  // the roof's own line (ridge and eaves kept, the ridge broken in a notch or two), their windows dark and their wall-tops sooted, with
  // a glowing crack in the char and a real column of smoke. The houses are picked on a dry run of the scene, and the real run draws the
  // same pixels in the same order (the kit's dice are untouched), so only the burned houses change
  const CHAR = ["#5e4232", "#3a2619", "#20140d"];
  // the houses whose roofs show most once the whole scene is drawn (a city's houses stand behind its wall and towers)
  function burnPick(list, W, base, over) {
    const B = base.getContext("2d").getImageData(0, 0, W, IH).data, O = over.getContext("2d").getImageData(0, 0, W, IH).data;
    const hex = (d, i) => "#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
    for (const h of list) {
      const rf = new Set(h.rf.map((c) => c.toLowerCase()));
      h.seen = h.px.filter(([x, y]) => {
        const i = (y * W + x) * 4;
        return x >= 0 && y >= 0 && x < W && y < IH && (h.front ? O[i + 3] && rf.has(hex(O, i)) : !O[i + 3] && rf.has(hex(B, i)));
      }).length;
    }
    const pick = [];
    for (const h of list.filter((h) => h.seen >= 14).sort((a, b) => b.seen - a.seen)) {
      if (pick.length >= (list.length > 3 ? 3 : 2)) break;
      if (pick.every((p) => Math.abs(p.cx - h.cx) > W / 7)) pick.push(h);
    }
    return new Set(pick.map((h) => h.i));
  }
  function scorchHouse(kk, o, out, seed) {
    const r = Art.rng(seed), x0 = o.x, x1 = o.x + o.w - 1, top = out.top, ol = o.ol || "#2a1e18", span = x1 - x0;
    // a hip roof keeps its top per column, a gable per row
    const colTop = (x) => Math.min(top, ...out.tops.filter((t) => (t.length === 2 ? t[0] === x : t[0] <= x && x < t[1])).map((t) => t[t.length - 1]));
    let ridge = top;
    for (let x = x0; x <= x1; x++) ridge = Math.min(ridge, colTop(x));
    const peak = [];
    for (let x = x0; x <= x1; x++) if (colTop(x) === ridge) peak.push(x);
    // the fire took the snow off the roof: put back what stood behind the drift, the outline and the char's top course
    if (o.snow) for (const t of out.tops) if (t.length === 2) {
      kk.ctx.putImageData(kk.ctx.getImageData(t[0], t[1] - 3, 1, 1), t[0], t[1] - 2);
      kk.P(t[0], t[1] - 1, ol); kk.P(t[0], t[1], CHAR[0]);
    }
    // ash on the char's upper courses, and cracks lower down
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      const ct = colTop(x);
      if (ct >= top) continue;
      for (let y = ct; y < top; y++) if (r() < (y - ct < 2 ? 0.2 : 0.07)) kk.P(x, y, y - ct < 2 ? "#6a584a" : "#0c0604");
    }
    // the ridge broken where the roof fell in: whatever stood behind shows through a notch, floored by the outline
    for (let n = 0, nn = span > 14 ? 2 : 1; n < nn; n++) {
      const nx = x0 + Math.round(span * (n ? 0.62 + r() * 0.14 : 0.22 + r() * 0.14)), nw = span > 10 && r() < 0.6 ? 2 : 1;
      for (let x = nx; x < nx + nw; x++) {
        const ct = colTop(x), dep = Math.min(2, top - ct - 2);
        if (dep < 1) continue;
        const behind = kk.ctx.getImageData(x, ct - 2, 1, 1);
        for (let y = ct - 1; y < ct - 1 + dep; y++) kk.ctx.putImageData(behind, x, y);
        // the fire still alive where the roof fell in: a glow on the notch's floor, one ember to a notch, never a pair side by side
        kk.P(x, ct - 1 + dep, x === nx && n === 0 ? "#f08030" : ol);
        if (x === nx && n === 0) kk.P(x, ct + dep, "#a83a1a");
      }
    }
    for (let x = x0; x <= x1; x++) if (r() < 0.6) kk.F(x, top, 1, 1 + Math.floor(r() * 3), Art.mix("#1a100c", "#5a4a3a", r() * 0.5));
    return { x: peak.length ? peak[peak.length >> 1] : R((x0 + x1) / 2), y: ridge - 1 };
  }
  // the smoke off a house she burned: a column of solid puffs in mid grey, lit on their upper left, that climb along a leaning path,
  // swell as they rise and break into a dither near the top (at night, the same in the moon's greys)
  // (Anim.column, shared with the season posters)
  const column = (o) => window.Anim.column(o);
  // a scene's still layers and moving life at width W (90 tall), for a header or for another view to frame (opts.night, opts.scorched)
  function build(id, W, opts) {
    const fn = SCENES[id] || DUNGEON_SCENES[id] || WILD_SCENES[id] || SEASON_SCENES[id];
    if (!fn || !window.Art || !window.Anim) return null;
    opts = opts || {};
    const seed = Art.hash("town:" + id), night = !!opts.night, tone = !night && opts.tone && window.Scenes && Scenes.TONES ? Scenes.TONES[opts.tone] : null;
    const run = (base, over, burn) => {
      const k = kit(base.getContext("2d"), W, IH, seed);
      k.o = kit(over.getContext("2d"), W, IH, seed + 1);
      k.night = k.o.night = night;
      const res = { acts: [], skyEnd: 0, houses: [], burned: [] };
      if (night || tone) {
        const grad = k.grad;
        k.grad = (y0, y1, stops, x0, x1) => { if (y0 === 0) { res.skyEnd = Math.max(res.skyEnd, y1); stops = stops.map(() => SKY_KEY); } grad(y0, y1, stops, x0, x1); };
        k.cloud = () => {};
      }
      const life = night && !!opts.life;
      k.add = (a) => { if (!burn) return; if (a && tone) res.acts.push(a.light ? a : toned(a)); else if (a && (!night || a.light)) res.acts.push(a); else if (a && life && !a.day) res.acts.push(moonlit(a)); };
      if (opts.scorched) {
        let n = 0;
        for (const kk of [k, k.o]) {
          const h0 = kk.house;
          kk.house = (o) => {
            const i = n++, hit = burn && burn.has(i), w0 = kk.win;
            // a burned house's windows are dark holes, day or night
            if (hit) kk.win = (x, y, w, h, lit, fr) => { kk.F(x - 1, y - 1, w + 2, h + 2, fr || "#2a1e18"); kk.F(x, y, w, h, "#1a1410"); };
            const out = h0(hit ? Object.assign({}, o, { roof: CHAR, doorC: "#3a2619" }) : o);
            kk.win = w0;
            if (hit) out.burned = true;
            if (!burn) {
              const px = [];
              for (const t of out.tops) { if (t.length === 2) for (let y = t[1]; y < out.top; y++) px.push([t[0], y]); else for (let x = t[0]; x < t[1]; x++) px.push([x, t[2]]); }
              res.houses.push({ i, cx: o.x + o.w / 2, rf: o.roof, px, front: kk === k.o });
            }
            if (hit) res.burned.push(Object.assign(scorchHouse(kk, o, out, seed + i), { front: kk === k.o }));
            return out;
          };
        }
      }
      let A = window.Anim;
      if (night) {
        A = Object.create(window.Anim);
        for (const name of LIGHTS) if (typeof window.Anim[name] === "function") A[name] = (o) => Object.assign(window.Anim[name](o), { light: true });
        for (const name of DAY_ONLY) if (typeof window.Anim[name] === "function") A[name] = (o) => Object.assign(window.Anim[name](o), { day: true });
      }
      fn(k, A);
      // with the dragon sat on her perch (opts.perched), that roof's smoke goes up behind her and off to the side, not out of her head
      const sat = opts.perched ? perchOf(res.burned, W) : null;
      for (const b of res.burned) {
        const aside = b === sat;
        k.add(column({ x: aside ? b.x - 19 : b.x, y: aside ? b.y + 5 : b.y, h: Math.max(12, Math.min(40, b.y - 2)), wind: aside ? -14 : 4, seed: b.x, light: night, cols: night ? ["#8a8ea4", "#62667c", "#44485e"] : null }));
        k.add(A.embers({ x0: b.x - 2, x1: b.x + 2, y: b.y + 1, n: 2, rise: 9, z: b.front ? 1e3 : -4, cols: ["#ffe08a", "#f08030", "#c84a1e", "#5a2a14"], seed: b.x + 1 }));
      }
      return res;
    };
    let pick = new Set();
    if (opts.scorched) {
      const b0 = canvas(W, IH), o0 = canvas(W, IH);
      pick = burnPick(run(b0, o0, null).houses, W, b0, o0);
    }
    const base = canvas(W, IH), over = canvas(W, IH);
    const res = run(base, over, pick);
    const sky = night ? grade(base, res.skyEnd) : tone ? toneGrade(base, res.skyEnd, tone) : null;
    if (night) grade(over);
    else if (tone) toneGrade(over, 0, tone);
    const perch = perchOf(res.burned, W);
    return { base, over, acts: res.acts, W, H: IH, sky, perch: perch ? [perch.x, perch.y + 3] : null };
  }
  // where something big can land: on the roof of a house she burned, the one nearest the right of the street, if she fits under the sky
  const perchOf = (burned, W) => burned.filter((b) => b.y > 34).sort((a, b) => Math.abs(a.x - W * 0.7) - Math.abs(b.x - W * 0.7))[0] || null;
  // the row each dungeon's way in stands on, so a view can set it on its own horizon
  const FOOT = { goblin_camp: 66, wolf_den: 84, collapsed_mine: 76, cragtooth_warren: 72, ashveil_crypts: 76, thornmere_ruins: 74, frostspire: 66, sunken_vault: 78, emberdeep: 82 };
  // the same, cut down to h rows from row y0 (default: the bottom of the scene, a few rows up), with the life moved to match
  function frame(id, W, h, opts) {
    const b = build(id, W, opts);
    if (!b) return null;
    opts = opts || {};
    const y0 = Math.max(0, Math.min(IH - h, opts.y0 == null ? IH - h - 6 : opts.y0));
    const cut = (src) => { const c = canvas(W, h); c.getContext("2d").drawImage(src, 0, -y0); return c; };
    const acts = b.acts.map((a) => ({ z: a.z, light: a.light, walker: a.walker, draw(ctx, t) { ctx.save(); ctx.translate(0, -y0); a.draw(ctx, t); ctx.restore(); } }));
    const sky = b.sky && ((x, y) => x >= 0 && x < W && y >= 0 && y < h && b.sky[(y + y0) * W + x] === 1);
    return { base: cut(b.base), over: cut(b.over), acts, W, H: h, y0, sky };
  }

  function header(townId, w, h, opts) {
    if (!window.Art || !window.Anim) return null;
    opts = opts || {};
    w = Math.max(40, R(w || 600)); h = Math.max(30, R(h || 180));
    const b = build(townId, Math.max(150, R(w * IH / h)), { night: !!opts.night, life: !!opts.night, scorched: !!opts.scorched, perched: !!opts.more });
    if (!b) return null;
    const { base, over, W } = b;
    // `more`: fn(W, scene) -> extra actors a view adds over the scene (the dragon while she is down there, on the scene's `perch`)
    const acts = opts.more ? b.acts.concat(opts.more(W, b) || []) : b.acts;
    const cv = canvas(W, IH);
    cv.className = "town-scene";
    cv.style.imageRendering = "pixelated";
    if (opts.fluid) { cv.style.width = "100%"; cv.style.height = "auto"; } else { cv.style.width = w + "px"; cv.style.height = h + "px"; }
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", opts.label || townId);
    cv.theme = THEME[townId];
    window.Anim.stage(cv, base, acts, { over, fps: opts.fps || 10, still: opts.still });
    return cv;
  }

  const TOWNS = Object.keys(SCENES), DUNGEONS = Object.keys(DUNGEON_SCENES), WILDS = [];
  // wild_scenes.js adds the wilds and the other dungeons, and isle_scenes.js a risen layer's town with its panel colours, drawn with the same kit and actors
  function register(id, fn, group, theme) {
    (group === "towns" ? SCENES : group === "dungeons" ? DUNGEON_SCENES : WILD_SCENES)[id] = fn;
    const list = group === "towns" ? TOWNS : group === "dungeons" ? DUNGEONS : WILDS;
    if (!list.includes(id)) list.push(id);
    if (theme) THEME[id] = theme;
  }
  const actors = { pennant, sails, wheel, swing, rowboat, eel, surf, shore, beam, aurora, leaves, shafts, rope, chicken, ship, plume, walker, sparkle, raven, bonfire };
  window.TownScenes = { header, build, frame, FOOT, THEME, TOWNS, DUNGEONS, WILDS, register, kit, rect, ln, actors };
})();
