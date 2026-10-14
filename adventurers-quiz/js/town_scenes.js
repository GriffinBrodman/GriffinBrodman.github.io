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
  };

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
    return { z: o.z || 0, front: true, draw(ctx, t) {
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
    return { z: -100, draw(ctx, t) {
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
    return { z: -200, draw(ctx, t) {
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
    const stand = A.sprite(["..rw", ".wwky", "www w".replace(" ", "w"), ".y.y"], pal), peck = A.sprite(["....", "www.", "wwwwr", ".y.yy"], pal);
    return { z: o.y, draw(ctx, t) {
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
    return { z: o.z || 0, draw(ctx, t) {
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
    F(cx2 - 15, 68, 28, 1, "#4a3420");
    for (let i = 0; i < 6; i++) { const hx = cx2 - 13 + i * 4; F(hx, 69, 2, 3, k.pick(["#8ab04a", "#c8a050", "#a85a8a", "#6a9a4a", "#d8c060"])); P(hx, 68, "#4a3420"); }
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
      for (const t of h.tops) if (t.length === 2) F(t[0], t[1] - 2, 1, 3, k.r() < 0.6 ? SN[0] : SN[1]);
      F(x - 3, 73, w + 6, 2, SN[1]);
      for (let xx = x; xx < x + w; xx += 2) P(xx, h.top + 1, "#cce4ff");
      chims.push(h.chim); glows.push([x + 2, h.top + 5]);
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

  const SCENES = { ironhaven, thornwall, veldrock, carrbridge, ashfen, hollowood, saltmarrow, frosthold };

  function header(townId, w, h, opts) {
    const fn = SCENES[townId];
    if (!fn || !window.Art || !window.Anim) return null;
    opts = opts || {};
    w = Math.max(40, R(w || 600)); h = Math.max(30, R(h || 180));
    const W = Math.max(150, R(w * IH / h)), seed = Art.hash("town:" + townId);
    const base = canvas(W, IH), over = canvas(W, IH);
    const k = kit(base.getContext("2d"), W, IH, seed);
    k.o = kit(over.getContext("2d"), W, IH, seed + 1);
    const acts = [];
    k.add = (a) => { if (a) acts.push(a); };
    fn(k, window.Anim);
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

  window.TownScenes = { header, THEME, TOWNS: Object.keys(SCENES) };
})();
