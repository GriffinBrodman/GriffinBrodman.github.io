/* The Mountain: the gods' halls cut into one peak at dusk, a switchback stair up its face to the hole in the stars (native 160 x 500), and the phone strip. */
/*
  MountainScene.build(opts) -> { base, acts, W, H }    opts: fires {id: hex}, moods {id: mood}, lit {id: true} (a feast day),
                                                       feuds [[a, b], ...] (the rival ledger's live feuds; default the top pair)
  MountainScene.canvas(opts) -> a staged canvas        opts.scale (2 phone, 3 desktop), opts.strip (rows 0-STRIP only); build inside GodArt.ready
  MountainScene.HALLS                                  {id: {x, y, door: [x, y, w, h], l, r, cx}} in native pixels; x, y is the 64 x 64 tap box
  MountainScene.at(x, y) -> the god id whose hall holds the native pixel, or null
*/
(function () {
  "use strict";
  const W = 160, H = 500, STRIP = 170, Y0 = 60, PITCH = 40;
  const OUT = "#16121a";
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAY[(y & 3) * 4 + (x & 3)];
  const R = Math.round;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hex2 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = (c) => "#" + c.map((v) => clamp(R(v), 0, 255).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const x = hex2(a), y = hex2(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };

  const FROST = ["#64708c", "#9aa6c0", "#c8d0e0"];
  const BRASS = ["#3a2810", "#6a4a1c", "#a87a2c", "#e0b050", "#fff0b0"];
  const ROWS = [["brannock", "marrow"], ["aurel", "veiled"], ["pell", "ferryman"], ["gorm", "mab"], ["tally", "antlered"]];
  const ORDER = ROWS.flat();
  // each hall a step lower and wider than the one above, on alternate sides of the stair: the higher, the farther back and narrower
  const HALLS = {};
  ORDER.forEach((id, i) => {
    const side = i % 2 ? "r" : "l", fw = 2 * R((34 + i * 2.4) / 2), off = fw / 2 + 6 + i * 1.5;
    const cx = R(80 + (side === "r" ? off : -off)), y = Y0 + i * PITCH, l = cx - fw / 2, r = cx + fw / 2 - 1;
    HALLS[id] = { i, x: cx - 32, y, cx, l, r, fw, side, sill: y + 56, land: side === "l" ? r + 6 : l - 6, door: [cx - 12, y + 20, 24, 36] };
  });
  function at(x, y) {
    for (const id in HALLS) { const h = HALLS[id]; if (x >= h.l - 3 && x <= h.r + 3 && y >= h.y && y < h.y + 64) return id; }
    return null;
  }
  // the switchback: from the foot to each landing in turn, the lowest first, and on up to the locked door under the gap
  const DOOR = { x: 77, y: 48 };
  const STAIR = [[74, H - 1]].concat(ORDER.slice().reverse().map((id) => [HALLS[id].land, HALLS[id].sill]), [[DOOR.x + 5, DOOR.y + 14]]);

  const ROCK = ["#141826", "#1e2436", "#2a3248", "#38425a", "#4c5872", "#64708a"];
  const STONE = ["#1c1a26", "#2c2836", "#3c3646", "#4e4858", "#645c6a", "#7e7482"];
  const MOSS = ["#1a2a24", "#24402e", "#36583a"];
  const WOOD = ["#24161a", "#3a2422", "#54362a", "#6e4a32"];
  const PINE = ["#0a1210", "#101c18", "#18281f", "#22382a"];

  function Buf() {
    const c = new Float32Array(W * H * 3), e = new Uint8Array(W * H), m = new Uint8Array(W * H);
    const b = { c, e, m };
    b.px = (x, y, col, emit) => {
      x = R(x); y = R(y);
      if (x < 0 || y < 0 || x >= W || y >= H || !col) return;
      const i = y * W + x, v = typeof col === "string" ? hex2(col) : col;
      c[i * 3] = v[0]; c[i * 3 + 1] = v[1]; c[i * 3 + 2] = v[2]; e[i] = emit ? 1 : 0;
    };
    b.rect = (x, y, w, h, col, emit) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) b.px(x + i, y + j, col, emit); };
    b.get = (x, y) => { const i = (clamp(R(y), 0, H - 1) * W + clamp(R(x), 0, W - 1)) * 3; return toHex([c[i], c[i + 1], c[i + 2]]); };
    b.dith = (x, y, w, h, col, f, emit) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (bay(i, j) < f) b.px(i, j, col, emit); };
    b.line = (x0, y0, x1, y1, col, emit) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let k = 0; k <= n; k++) b.px(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, col, emit);
    };
    b.ell = (cx, cy, rx, ry, col, emit, fn) => {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
        if (d <= 1) b.px(x, y, fn ? fn(x, y, dx, dy, d) : col, emit);
      }
    };
    b.snap = (x, y, w, h) => {
      const s = { x, y, w, h, c: new Float32Array(w * h * 3), e: new Uint8Array(w * h) };
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const X = x + i, Y = y + j;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const k = Y * W + X, q = j * w + i;
        s.c[q * 3] = c[k * 3]; s.c[q * 3 + 1] = c[k * 3 + 1]; s.c[q * 3 + 2] = c[k * 3 + 2]; s.e[q] = e[k];
      }
      return s;
    };
    b.put = (s) => {
      for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
        const X = s.x + i, Y = s.y + j;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const k = Y * W + X, q = j * s.w + i;
        c[k * 3] = s.c[q * 3]; c[k * 3 + 1] = s.c[q * 3 + 1]; c[k * 3 + 2] = s.c[q * 3 + 2]; e[k] = s.e[q];
      }
    };
    return b;
  }
  function snapCanvas(s) {
    const cv = document.createElement("canvas");
    cv.width = s.w; cv.height = s.h;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(s.w, s.h);
    for (let q = 0; q < s.w * s.h; q++) { for (let k = 0; k < 3; k++) img.data[q * 4 + k] = clamp(R(s.c[q * 3 + k]), 0, 255); img.data[q * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function noise(s) {
    const v = [], rr = rng(s);
    for (let i = 0; i < 97; i++) v.push(rr());
    return (x) => { const i = Math.floor(x), f = x - i, e = f * f * (3 - 2 * f), m = (k) => v[((k % 97) + 97) % 97]; return m(i) * (1 - e) + m(i + 1) * e; };
  }

  // ---------- the sky, the far ranges, the gap ----------
  const SKYC = [[0, "#060a1a"], [40, "#0b132e"], [100, "#142048"], [160, "#22305a"], [210, "#3c4062"], [255, "#6a5260"], [290, "#a0624c"], [318, "#d0844a"], [336, "#e8a456"]];
  function skyAt(y) {
    for (let i = 0; i < SKYC.length - 1; i++) {
      const [y0, a] = SKYC[i], [y1, b] = SKYC[i + 1];
      if (y < y1) return [a, b, (y - y0) / (y1 - y0)];
    }
    return [SKYC[SKYC.length - 1][1], SKYC[SKYC.length - 1][1], 0];
  }
  const GAP = { x: 84, y: 13, r: 7.5 };
  function sky(b, r) {
    for (let y = 0; y < H; y++) {
      const [a, c, f] = skyAt(y), q = clamp((f - 0.5) * 2.4 + 0.5, 0, 1);
      for (let x = 0; x < W; x++) b.px(x, y, bay(x, y) < q ? c : a);
    }
    const band = (x) => 2 + x * 0.3;
    for (let i = 0; i < 760; i++) {
      const x = r() * W, y = r() * 200, d = Math.hypot(x - GAP.x, y - GAP.y);
      if (d < GAP.r + 2.5) continue;
      const near = Math.abs(y - band(x)) < 9 ? 1 : 0, keep = Math.max(0, 1 - y / 200) * (0.3 + near * 0.6) + (d < GAP.r + 7 ? 0.6 : 0);
      if (r() > keep) continue;
      const big = r() < 0.06 + near * 0.05;
      const col = r() < 0.2 ? "#ffe6c0" : r() < 0.3 ? "#c8dcff" : "#e8eeff";
      b.px(x, y, big ? col : mix(col, b.get(x, y), 0.4 + r() * 0.35), true);
      if (big && r() < 0.5) { const arm = mix(col, b.get(x, y), 0.6); b.px(x - 1, y, arm, true); b.px(x + 1, y, arm, true); b.px(x, y - 1, arm, true); b.px(x, y + 1, arm, true); }
    }
    for (let y = 0; y < 60; y++) for (let x = 0; x < W; x++) {
      const d = Math.abs(y - band(x));
      if (d < 7 && bay(x, y) < (1 - d / 7) * 0.3) b.px(x, y, mix(b.get(x, y), "#3a4a78", 0.5));
    }
    for (let y = 0; y < 34; y++) for (let x = 60; x < 110; x++) {
      const d = Math.hypot(x + 0.5 - GAP.x, y + 0.5 - GAP.y);
      if (d < GAP.r - 0.6) b.px(x, y, d < GAP.r - 2.2 ? "#020208" : "#06050e", true);
      else if (d < GAP.r + 0.4) b.px(x, y, bay(x, y) < 0.7 ? "#2a1c3a" : "#06050e", true);
      else if (d < GAP.r + 3.2 && bay(x, y) < (GAP.r + 3.2 - d) / 3.2 * 0.5) b.px(x, y, mix(b.get(x, y), "#03040a", 0.6), true);
    }
    for (let k = 0; k < 11; k++) {
      const a = k / 11 * Math.PI * 2 + 0.3, d = GAP.r + 2.4 + (k % 3) * 0.9;
      b.px(GAP.x + Math.cos(a) * d, GAP.y + Math.sin(a) * d * 0.95, k % 2 ? "#e8eeff" : "#b8c4e8", true);
    }
  }
  // two far ranges in the afterglow, low behind the peak, so the sides of the picture fall away to a valley
  function ranges(b) {
    const far = [["#4a3e56", "#8a6260", 262, 30, 3], ["#2c2c46", "#5a4a5a", 300, 34, 7], ["#1a1e30", "#3a3a52", 352, 30, 13]];
    for (const [c, rim, base, amp, s] of far) {
      const n = noise(s);
      for (let x = 0; x < W; x++) {
        const t = R(base - n(x / 11) * amp - n(x / 3 + 5) * 5);
        for (let y = t; y < H; y++) b.px(x, y, y === t ? rim : y < t + 3 && bay(x, y) < 0.4 ? mix(c, rim, 0.4) : c);
      }
    }
  }

  // ---------- the peak ----------
  // the silhouette: a summit crag over the top hall, then flanks that widen all the way down; west faces lit by the afterglow
  const n1 = noise(11), n2 = noise(29), n3 = noise(41), cn1 = noise(61), cn2 = noise(67);
  const APEX = [78, 24];
  function edgeL(y) {
    if (y < 70) return APEX[0] - (y - APEX[1]) * 1.04 + (n1(y / 4) - 0.5) * 6;
    const u = (y - 70) / 330;
    return 30 - 36 * Math.pow(u, 1.35) + (n1(y / 5) - 0.5) * 5 + (n2(y / 17) - 0.5) * 6;
  }
  function edgeR(y) {
    if (y < 110) return APEX[0] + 2 + (y - APEX[1]) * 0.64 + (n3(y / 4) - 0.5) * 6 + (y < 50 ? -3 : 0);
    const u = (y - 110) / 300;
    return 134 + 32 * Math.pow(u, 1.35) + (n3(y / 5) - 0.5) * 5 + (n1(y / 13 + 9) - 0.5) * 6;
  }
  const inRock = (x, y) => y >= APEX[1] && x >= edgeL(y) && x <= edgeR(y);
  function crag(x, y) {
    const facet = cn1(x / 7 + y / 13) + (cn2(y / 5) - 0.5) * 0.3 + (x < 80 ? 0.06 : -0.06), fy = y + R(cn2(x / 3) * 4);
    let k = facet > 0.62 ? 2 : facet > 0.4 ? 1 : 0;
    if (fy % 9 === 0) k = Math.max(0, k - 1);
    if (facet > 0.62 && cn1(x / 7 + (y - 1) / 13) <= 0.62) k = 3;
    if (k === 0 && bay(x, y) < 0.3) k = 1;
    return ROCK[k];
  }
  function peak(b) {
    for (let y = APEX[1]; y < H; y++) {
      const L = edgeL(y), Rr = edgeR(y);
      for (let x = Math.max(0, Math.ceil(L)); x <= Math.min(W - 1, Math.floor(Rr)); x++) {
        const dl = x - L, dr = Rr - x;
        let c = crag(x, y);
        if (dl < 1) c = y < 100 ? "#e8a070" : ROCK[5];
        else if (dl < 3) c = y < 100 ? (dl < 2 ? "#a8705a" : ROCK[4]) : bay(x, y) < 0.6 ? ROCK[4] : c;
        else if (dr < 1) c = ROCK[0];
        else if (dr < 4 && bay(x, y) < 0.5) c = ROCK[0];
        b.px(x, y, c);
        b.m[y * W + x] = 1;
        const snowline = 34 + n2(x / 3) * 30 + (Math.abs(x - APEX[0]) > 30 ? -14 : 0);
        if (y < snowline && (dl < 5 + n1(x) * 6 || (y < 46 && bay(x, y) < 0.7) || dr < 3)) b.px(x, y, dl < 1.2 ? "#f0f4ff" : x < APEX[0] + 6 ? "#d8c8c8" : "#a8b4cc");
      }
    }
    // ridges: buttresses running down and out from under each hall, lit on their west side, so the face has mass between the halls
    for (const id of ORDER) {
      const h = HALLS[id], s = h.side === "l" ? -1 : 1;
      for (let k = 0; k < 2; k++) {
        const x0 = k ? h.cx + s * 4 : h.cx - s * 10, y0 = h.sill + 6, len = 24 + k * 10;
        for (let j = 0; j < len; j++) {
          const x = R(x0 + s * j * (0.35 + k * 0.25)), y = y0 + j;
          if (!inRock(x, y) || !inRock(x + 1, y)) continue;
          b.px(x, y, ROCK[3]); b.px(x + 1, y, ROCK[1]); b.px(x - 1, y, bay(x, y) < 0.5 ? ROCK[4] : ROCK[2]);
        }
      }
    }
    for (let i = 0; i < 70; i++) {
      const y = 60 + R(((i * 53) % 97) / 97 * 420), L = edgeL(y), Rr = edgeR(y), x = R(L + 4 + ((i * 31) % 89) / 89 * (Rr - L - 8));
      if (!inRock(x, y)) continue;
      b.line(x, y, x + 2 + (i % 3), y + 1 + (i % 2), ROCK[0]);
      b.px(x, y - 1, ROCK[3]);
    }
  }
  // the foot: dark pine slopes that run out past both sides of the peak
  function foot(b, r) {
    const sl = noise(83);
    const top = (x) => {
      const L = 436 + Math.pow(Math.max(0, x - 4) / 40, 1.4) * 40, Rr = 452 + Math.pow(Math.max(0, 156 - x) / 40, 1.4) * 40;
      return Math.min(L, Rr) + (sl(x / 5) - 0.5) * 6;
    };
    for (let x = 0; x < W; x++) {
      if (x > 62 && x < 98) continue;
      const t = R(top(x));
      for (let y = t; y < H; y++) b.px(x, y, y === t ? PINE[3] : bay(x, y) < 0.3 ? PINE[0] : PINE[1]);
    }
    const pine = (px, py, ph, pal) => {
      for (let i = 0; i < ph; i++) {
        const w = R(i * 0.38) - ((i % 4 === 3) ? 1 : 0), yy = py - ph + i;
        b.rect(px - w - 1, yy, 2 * w + 3, 1, PINE[0]);
        b.rect(px - w, yy, 2 * w + 1, 1, pal[1]); b.rect(px - w, yy, Math.max(1, w), 1, pal[2]);
      }
    };
    for (let k = 0; k < 9; k++) {
      const x = k < 5 ? 2 + k * 12 + R(r() * 5) : 96 + (k - 5) * 9 + R(r() * 4);
      if (x > 92 && x < 158 && k > 5) continue;
      pine(x, R(top(x)) + 3, 12 + R(r() * 12), k % 2 ? PINE : [PINE[0], PINE[2], PINE[3]]);
    }
  }
  // the locked door at the top of the stair, under the gap: the house shut it on Vashk
  function summitDoor(b) {
    const { x, y } = DOOR;
    b.ell(x + 5, y + 5, 10, 11, null, false, (xx, yy, dx, dy) => dy < 0.6 ? (bay(xx, yy) < 0.75 ? ROCK[0] : ROCK[1]) : null);
    b.rect(x - 2, y - 2, 14, 16, OUT);
    b.rect(x - 1, y - 1, 12, 15, STONE[3]);
    for (let j = 0; j < 15; j += 3) b.rect(x - 1, y - 1 + j, 12, 1, STONE[2]);
    b.rect(x + 1, y + 1, 8, 13, OUT);
    b.rect(x + 2, y + 2, 6, 12, WOOD[1]);
    b.rect(x + 4, y + 2, 1, 12, WOOD[0]);
    b.rect(x + 2, y + 6, 6, 1, "#4a4450"); b.rect(x + 2, y + 10, 6, 1, "#4a4450");
    b.px(x + 5, y + 8, "#8a8090"); b.px(x + 5, y + 9, OUT);
    b.rect(x - 2, y - 3, 14, 1, STONE[5]);
    b.px(x + 4, y - 4, STONE[4]); b.px(x + 5, y - 5, STONE[4]); b.px(x + 6, y - 4, STONE[4]);
  }

  // ---------- the stair ----------
  // flights cut into the face between the landings, each step a lit tread over a shadowed riser; the rock under a flight is in its shadow
  function flights(b, r) {
    const cand = [];
    for (let k = 0; k < STAIR.length - 1; k++) {
      const [xa, ya] = STAIR[k], [xb, yb] = STAIR[k + 1], top = k === STAIR.length - 2;
      for (let y = yb; y <= ya; y++) {
        const u = (ya - y) / Math.max(1, ya - yb), x = R(xa + (xb - xa) * u), hw = top ? 2 : 3;
        for (let i = -hw - 1; i <= hw + 1; i++) {
          if (Math.abs(i) === hw + 1) { b.px(x + i, y, OUT); continue; }
          const st = (y + k) % 3, worn = Math.abs(i) < 2;
          b.px(x + i, y, st === 0 ? (worn ? STONE[5] : STONE[4]) : st === 1 ? (worn ? STONE[3] : STONE[2]) : STONE[1]);
        }
        const dn = xb > xa ? -1 : 1;
        b.px(x + dn * (hw + 2), y + 1, ROCK[0]); if (bay(x, y) < 0.5) b.px(x + dn * (hw + 3), y + 1, ROCK[0]);
        if (!top && y % 9 === 4 && y !== ya && y !== yb) cand.push([x + (k % 2 ? -hw : hw), y]);
      }
    }
    return cand;
  }
  // the ledge a hall stands on, from its far wall to the stair, mossed on top, its edge throwing a shadow down the rock
  function ledge(b, h, r) {
    const x0 = h.side === "l" ? h.l - 3 : h.land - 4, x1 = h.side === "l" ? h.land + 4 : h.r + 3, y = h.sill;
    for (let x = x0; x <= x1; x++) {
      for (let j = 0; j < 6; j++) {
        const brick = ((x + (j < 3 ? 0 : 3)) % 6) === 0;
        b.px(x, y + j, j === 0 ? MOSS[2] : j === 1 ? (r() < 0.4 ? MOSS[1] : STONE[4]) : brick ? STONE[0] : j < 3 ? STONE[3] : STONE[2]);
      }
      b.px(x, y + 6, OUT);
      if (bay(x, y) < 0.6) b.px(x, y + 7, ROCK[0]);
      if (bay(x, y + 1) < 0.25) b.px(x, y + 8, ROCK[0]);
      if (r() < 0.12) { const len = 2 + R(r() * 6); for (let k = 0; k < len; k++) b.px(x, y + 6 + k, k === len - 1 ? "#4a7a44" : k % 2 ? MOSS[1] : MOSS[2]); }
    }
    b.px(x0 - 1, y, OUT); b.px(x1 + 1, y, OUT);
  }
  // a lantern on a post at each landing
  function post(b, x, y) {
    b.rect(x - 1, y - 12, 3, 12, OUT); b.rect(x, y - 11, 1, 11, WOOD[3]);
    b.rect(x - 2, y - 17, 5, 6, OUT, true); b.rect(x - 1, y - 16, 3, 4, "#ffb860", true); b.px(x, y - 15, "#fff0b8", true); b.px(x, y - 14, "#ffe0a0", true);
    b.rect(x - 2, y - 18, 5, 1, STONE[4]);
  }

  // ---------- halls ----------
  // the niche each hall stands in: a cave mouth in the face, deep in shadow, so the hall sits in the mountain and not on it
  function niche(b, h, top) {
    const { cx, l, r } = h, rx = (r - l) / 2 + 5, y0 = h.y + top - 4, y1 = h.sill;
    for (let y = y0; y <= y1; y++) for (let x = l - 6; x <= r + 6; x++) {
      const u = (x + 0.5 - cx - 0.5) / rx, v = (y - y1) / (y1 - y0);
      const d = u * u + v * v;
      if (d > 1.06) continue;
      if (d > 0.9) { b.px(x, y, (x < cx ? bay(x, y) < 0.6 : bay(x, y) < 0.3) ? ROCK[4] : ROCK[2]); continue; }
      b.px(x, y, bay(x, y) < 0.25 ? ROCK[1] : "#0c0e18");
    }
  }
  // the common front: the walls, windows where there is room, the arched door
  function front(b, h, o, r) {
    const { y, l, r: rr } = h, wall = o.wall || STONE;
    niche(b, h, o.top || 0);
    const wx0 = l, wx1 = rr, wy0 = y + 18, wy1 = h.sill;
    b.rect(wx0 - 1, wy0, wx1 - wx0 + 3, wy1 - wy0, OUT);
    for (let yy = wy0; yy < wy1; yy++) {
      const row = Math.floor((yy - wy0) / 4), off = row % 2 ? 4 : 0;
      for (let xx = wx0; xx <= wx1; xx++) {
        const seam = (yy - wy0) % 4 === 3 || ((xx - wx0 + off) % 8) === 0;
        let c = seam ? wall[1] : (yy - wy0) % 4 === 0 ? wall[3] : wall[2];
        if (!seam && r() < 0.06) c = wall[4];
        if (xx === wx0) c = wall[4];
        if (xx === wx1) c = wall[1];
        b.px(xx, yy, c);
      }
    }
    if (o.timber) for (let yy = wy0; yy < wy1; yy++) for (const xx of [wx0 + 1, wx1 - 1]) b.px(xx, yy, o.timber);
    h.wins = [];
    const [dx, dy, dw, dh] = h.door, room = dx - 3 - (wx0 + 2);
    if (room >= 5) for (const s of [0, 1]) {
      const shape = o.win || "sq", qw = Math.min(shape === "slit" ? 3 : 6, room - 3), qh = shape === "port" ? qw : shape === "slit" ? 11 : 9;
      const ql = R((wx0 + 1 + dx - 3) / 2 - qw / 2), qx = s ? 2 * h.cx - ql - qw : ql, qy = y + (shape === "port" ? 30 : 28);
      if (shape === "port") { b.ell(qx + qw / 2, qy + qw / 2, qw / 2 + 1.6, qw / 2 + 1.6, wall[4]); b.ell(qx + qw / 2, qy + qw / 2, qw / 2 + 0.6, qw / 2 + 0.6, OUT); }
      else { b.rect(qx - 1, qy - 1, qw + 2, qh + 2, OUT); b.rect(qx - 2, qy + qh + 1, qw + 4, 1, wall[4]); }
      h.wins.push([qx, qy, qw, qh, shape]);
    }
    b.rect(dx - 3, dy - 3, dw + 6, dh + 3, OUT);
    for (let k = 0; k < dw + 6; k += 3) { b.rect(dx - 3 + k, dy - 4, 3, 2, (k / 3) % 2 ? wall[3] : wall[4]); b.px(dx - 3 + k, dy - 4, OUT); }
    b.rect(dx - 2, dy - 2, 2, dh + 2, wall[4]); b.rect(dx + dw, dy - 2, 2, dh + 2, wall[1]);
    b.rect(dx - 2, dy - 2, dw + 4, 2, wall[3]);
    // the rock closes in on both walls, so the front reads as built into the face
    for (let yy = wy0 - 2; yy < wy1; yy++) {
      const a = 1 + R(n2(yy / 3 + h.i * 7) * 2), c = 1 + R(n3(yy / 3 + h.i * 5) * 2);
      for (let k = 0; k < a; k++) b.px(wx0 - 1 + k, yy, k === a - 1 ? OUT : ROCK[4 - k]);
      for (let k = 0; k < c; k++) b.px(wx1 + 1 - k, yy, k === c - 1 ? OUT : ROCK[1]);
    }
  }

  function roofGable(b, h, pal, o) {
    const { y, cx, l, r } = h, top = y + (o.top || 2), eave = y + 20, half = (r - l) / 2 + 2;
    const hw = (yy) => 3 + (yy - top) * (half - 3) / (eave - top);
    for (let yy = top - 1; yy <= eave; yy++) { const w = R(hw(yy)); b.rect(cx - w - 1, yy, 2 * w + 2, 1, OUT); }
    for (let yy = top; yy < eave; yy++) {
      const w = R(hw(yy));
      for (let xx = cx - w; xx < cx + w; xx++) {
        const row = (yy - top) % 3, u = (xx - cx + w) / (2 * w);
        let c = row === 2 ? pal[1] : u < 0.18 ? pal[3] : u > 0.82 ? pal[1] : pal[2];
        if (row === 0 && ((xx + yy) % 4) === 0) c = pal[0];
        b.px(xx, yy, c);
      }
      b.px(cx - w, yy, pal[3]); b.px(cx + w - 1, yy, pal[0]);
    }
    b.rect(l - 2, eave, r - l + 5, 2, OUT); b.rect(l - 1, eave, r - l + 3, 1, pal[3]);
  }
  function chimney(b, x, y, w, hgt, pal) {
    b.rect(x - 1, y - 1, w + 2, hgt + 1, OUT);
    for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) b.px(x + i, y + j, i === 0 ? pal[4] : i === w - 1 ? pal[1] : (j % 3 === 2) ? pal[1] : pal[2]);
    b.rect(x - 2, y - 2, w + 4, 2, OUT); b.rect(x - 1, y - 2, w + 2, 1, pal[4]);
  }

  // per god: the roof, the chimney and the one thing on the front that says whose hall it is
  const DRESS = {
    brannock(b, h, f, r) {
      front(b, h, { wall: ["#1e1a20", "#2e2628", "#423634", "#564640", "#6e5a4e", "#8a7060"], win: "sq", top: 0 }, r);
      roofGable(b, h, ["#2a2a34", "#3a3c48", "#4e5262", "#6e7486"], { top: 4 });
      for (let k = 0; k < 4; k++) b.px(h.cx - 9 + k * 6, h.y + 13 + (k % 2), "#8a90a2");
      chimney(b, h.r - 9, h.y - 2, 7, 18, ["#1e1a20", "#3a2c2a", "#56403a", "#6e5446", "#8a6a56"]);
      b.rect(h.r - 8, h.y - 3, 5, 1, f[4], true);
      b.dith(h.r - 8, h.y - 2, 5, 2, f[3], 0.5, true);
      h.lights.push({ x: h.r - 6, y: h.y - 5, r: 14, s: 0.8 });
      h.chim = [h.r - 6, h.y - 4];
      const ax = h.l - 1, ay = h.sill - 4;
      b.rect(ax - 1, ay - 1, 10, 5, OUT); b.rect(ax, ay, 8, 2, "#5a5e6e"); b.rect(ax, ay, 8, 1, "#8a90a2"); b.rect(ax + 2, ay + 2, 4, 2, "#3a3c48");
      b.px(ax + 3, ay - 2, f[4], true); b.px(ax + 4, ay - 1, f[3], true);
    },
    marrow(b, h, f, r) {
      front(b, h, { wall: ["#16202a", "#22303a", "#2e4048", "#3e525a", "#526870", "#6e848a"], win: "port", top: 2 }, r);
      const { y, cx, l, r: rr } = h, half = (rr - l) / 2 + 2;
      for (let j = 0; j < 18; j++) {
        const yy = y + 3 + j, w = R(6 + Math.sqrt(j / 17) * (half - 6));
        b.rect(cx - w - 1, yy, 2 * w + 2, 1, OUT);
        for (let i = -w; i < w; i++) b.px(cx + i, yy, j % 4 === 1 ? "#24302e" : i < -w + 3 ? "#5a6a5e" : i > w - 4 ? "#2a3634" : "#3e4c46");
      }
      b.rect(cx - 7, y + 2, 14, 1, OUT); b.rect(cx - 6, y + 2, 12, 1, "#6a3a2a");
      b.rect(l - 2, y + 20, rr - l + 5, 2, OUT); b.rect(l - 1, y + 20, rr - l + 3, 1, "#6a7a70");
      for (let i = 0; i < 7; i++) b.px(cx - 12 + R(r() * 24), y + 6 + R(r() * 12), "#c8d0c0");
      const lx = l + 3, ly = y + 23;
      b.rect(lx, ly - 3, 1, 3, OUT);
      b.rect(lx - 2, ly, 5, 6, OUT); b.rect(lx - 1, ly + 1, 3, 4, f[3], true); b.px(lx, ly + 2, f[4], true); b.rect(lx - 2, ly + 6, 5, 1, "#3a3c48");
      h.lights.push({ x: lx, y: ly + 3, r: 12, s: 0.6 });
      h.drip = [rr - 1, y + 22, h.sill + 12];
      for (let j = 0; j < 4; j++) b.px(rr - 1, y + 21 + j, "#6a8a90");
      for (let k = 0; k < 4; k++) b.px(l + 2 + k * 3, h.sill + 2, "#c8d8d0");
    },
    // Aurel's light is a lamp worn as a hat: brass, and out through pinholes, so the hall is dark brass with a spray of dots, never a wash
    aurel(b, h, f, r) {
      front(b, h, { wall: ["#26222a", "#3a3438", "#544a4a", "#6e625c", "#8c7e70", "#b0a088"], win: "arch", top: -4 }, r);
      const { y, cx, l, r: rr } = h;
      b.rect(l - 2, y + 15, rr - l + 5, 6, OUT); b.rect(l - 1, y + 16, rr - l + 3, 2, "#b0a088"); b.rect(l - 1, y + 18, rr - l + 3, 2, "#6e625c");
      for (let i = 0; i < rr - l + 3; i += 4) b.px(l - 1 + i, y + 19, "#3a3438");
      const rx = Math.min(13, (rr - l) / 2 - 3), holes = [];
      b.ell(cx, y + 15, rx, 13, null, false, (xx, yy, dx, dy, d) => {
        if (d > 0.84) return OUT;
        if (yy > y + 14) return null;
        const pin = (xx * 3 + yy * 5) % 7 === 0 && d < 0.7 && yy < y + 13;
        if (pin) { holes.push([xx, yy]); return null; }
        return dx < -0.5 && dy < -0.3 ? BRASS[3] : dx < 0.05 ? BRASS[2] : dx < 0.55 ? BRASS[1] : BRASS[0];
      });
      for (const [xx, yy] of holes) b.px(xx, yy, (xx + yy) % 2 ? BRASS[4] : BRASS[3], true);
      b.rect(cx - rx - 1, y + 14, 2 * rx + 2, 1, OUT);
      b.rect(cx - 1, y, 3, 3, OUT); b.px(cx, y + 1, BRASS[4], true); b.rect(cx, y - 3, 1, 3, BRASS[3]);
      // the shuttered pane: the dome's dark wedge faces the Ferryman's hall
      for (let j = 0; j < 9; j++) for (let i = 0; i < 3 + (j >> 2); i++) { const xx = cx + rx - 4 - i + (j >> 2), yy = y + 5 + j; if (yy < y + 14) b.px(xx, yy, "#0e0a08"); }
      for (const sx of [l + 1, rr - 3]) { b.rect(sx - 1, y + 8, 5, 8, OUT); b.rect(sx, y + 9, 3, 7, "#8c7e70"); b.rect(sx, y + 9, 3, 1, BRASS[3]); }
      // the spray: brass dots thrown on the niche and the ledge, thinning away from the dome
      const dots = [], rs = rng(907);
      for (let k = 0; k < 90 && dots.length < 26; k++) {
        const a = -Math.PI * (0.05 + rs() * 0.9), d = rx + 3 + rs() * 16, xx = R(cx + Math.cos(a) * d * 1.15), yy = R(y + 9 + Math.sin(a) * d * 0.7);
        if (yy >= y + 15 || xx < l - 6 || xx > rr + 6 || yy < h.y - 6 || !inRock(xx - 2, yy) || !inRock(xx + 2, yy)) continue;
        dots.push([xx, yy]);
      }
      for (let k = 0; k < 10; k++) dots.push([l + 2 + R(rs() * (rr - l - 4)), h.sill + 1 + R(rs() * 2)]);
      for (const [xx, yy] of dots) b.px(xx, yy, rs() < 0.35 ? BRASS[4] : BRASS[3], true);
      h.pins = dots.filter((_, k) => k % 3 === 0).slice(0, 10);
      h.pin = holes;
    },
    veiled(b, h, f, r) {
      front(b, h, { wall: ["#141626", "#1e2234", "#2a3044", "#384058", "#4a5470", "#64708c"], win: "slit", top: -6 }, r);
      const { y, cx } = h;
      roofGable(b, h, ["#141826", "#1e2436", "#2a3248", "#3c4660"], { top: 6 });
      for (let j = 0; j < 12; j++) { const w = R(1 + j * 0.45); b.rect(cx - w - 1, y - 6 + j, 2 * w + 2, 1, OUT); b.rect(cx - w, y - 6 + j, 2 * w, 1, j % 3 ? "#2a3248" : "#3c4660"); }
      b.ell(cx, y + 12, 3, 3, OUT);
      b.ell(cx, y + 12, 2, 2, "#2a3248");
      b.px(cx - 1, y + 11, "#3c4660");
      h.dark = true;
      h.candle = [15, 15];
      h.rime = [];
    },
    pell(b, h, f, r) {
      front(b, h, { wall: ["#2a201e", "#3e302a", "#584236", "#725844", "#8e7254", "#ac8e6a"], timber: "#3a2420", win: "sq", top: 0 }, r);
      const { y, cx, l, r: rr } = h, half = (rr - l) / 2 + 3;
      for (let j = 0; j < 20; j++) {
        const yy = y + 2 + j, w = R(half - 12 + Math.sqrt(j / 19) * 12);
        b.rect(cx - w - 1, yy, 2 * w + 2, 1, OUT);
        for (let i = -w; i < w; i++) { const s = ((i * 7 + j * 3) & 7); b.px(cx + i, yy, j === 19 ? "#5a4020" : s === 0 ? "#6a4e26" : i < -w + 4 ? "#c49a52" : s < 4 ? "#a07a3c" : "#8a6630"); }
      }
      for (let i = -half + 1; i < half - 1; i += 2) b.px(cx + i, y + 22, "#5a4020");
      chimney(b, l + 4, y - 2, 6, 10, ["#2a201e", "#5a3a2a", "#7a4e36", "#946044", "#b07a56"]);
      b.rect(l + 5, y - 3, 4, 1, f[3], true);
      h.chim = [l + 7, y - 4];
      const sx = rr - 1, sy = y + 24;
      b.rect(sx, sy - 2, 1, 2, OUT); b.rect(sx - 3, sy, 7, 6, OUT); b.rect(sx - 2, sy + 1, 5, 4, "#e8d8b0"); b.ell(sx + 0.5, sy + 3, 1.6, 1.2, "#c47a3a");
      for (let k = 0; k < 5; k++) b.px(l + 3 + k * R((rr - l - 6) / 4), h.sill + 1, ["#c84a3a", "#e8b84a", "#e8e0c8"][k % 3]);
    },
    ferryman(b, h, f, r) {
      front(b, h, { wall: ["#12161e", "#1a2028", "#242c36", "#323c48", "#44505e", "#5c6a78"], win: "arch", top: -4 }, r);
      const { y, cx, rr = h.r } = h;
      roofGable(b, h, ["#10141c", "#1a2028", "#262e3a", "#3a4452"], { top: 8 });
      b.rect(cx - 5, y - 1, 11, 10, OUT); b.rect(cx - 4, y, 9, 8, "#323c48"); b.rect(cx - 2, y + 2, 5, 5, "#0c0e14"); b.ell(cx, y + 5, 1.6, 2, "#8a8a7a");
      b.rect(cx - 6, y - 2, 13, 1, "#5c6a78"); b.px(cx, y - 4, "#5c6a78"); b.px(cx, y - 3, "#5c6a78");
      const px = rr + 4;
      b.rect(px - 1, y + 26, 3, 30, OUT); b.rect(px, y + 27, 1, 29, "#4a3a2c");
      b.rect(px - 3, y + 22, 5, 5, OUT); b.rect(px - 2, y + 23, 3, 3, f[3], true); b.px(px - 1, y + 23, f[4], true);
      h.lights.push({ x: px - 1, y: y + 24, r: 12, s: 0.6 });
      for (const cx2 of [h.l + 2, h.l + 6]) { b.rect(cx2, h.sill - 4, 2, 4, "#c8c8b8"); b.px(cx2, h.sill - 5, f[4], true); b.px(cx2 + 1, h.sill - 6, f[3], true); }
    },
    gorm(b, h, f, r) {
      front(b, h, { wall: ["#20140e", "#301e16", "#44281c", "#5a3624", "#74472e", "#8e5a3a"], timber: "#1e120c", win: "slit", top: 0 }, r);
      const { y, cx, l, r: rr } = h;
      roofGable(b, h, ["#2a1a12", "#4a2c1a", "#6a4024", "#8a5a34"], { top: 3 });
      for (const s of [-1, 1]) { b.line(cx, y + 3, cx + s * 7, y - 3, OUT); b.line(cx + s, y + 3, cx + s * 7, y - 2, "#c8b890"); b.px(cx + s * 7, y - 3, "#e8dcc0"); }
      for (const [sx, c] of [[l + 5, "#a82a2a"], [rr - 5, "#3a5a8a"]]) {
        b.ell(sx, y + 24, 4, 4, OUT); b.ell(sx, y + 24, 3, 3, c); b.px(sx, y + 24, "#c8b890"); b.px(sx - 1, y + 22, mix(c, "#ffffff", 0.4));
      }
      for (let k = 0; k < 3; k++) { b.rect(l - 4 + k * 3, h.sill - 5, 2, 5, OUT); b.rect(l - 4 + k * 3, h.sill - 4, 2, 3, "#6a4024"); b.px(l - 4 + k * 3, h.sill - 4, "#e8d8b0"); }
      chimney(b, rr - 9, y + 2, 5, 8, ["#20140e", "#3a2a22", "#4e3a2e", "#62483a", "#7a5a46"]);
      b.rect(rr - 8, y + 1, 3, 1, f[3], true);
      h.chim = [rr - 7, y];
    },
    mab(b, h, f, r) {
      front(b, h, { wall: ["#20162a", "#2c2034", "#3a2c40", "#4a3a4e", "#5e4c60", "#786476"], win: "arch", top: 0 }, r);
      const { y, cx, l, r: rr } = h, half = (rr - l) / 2 + 2;
      for (let j = 0; j < 20; j++) {
        const yy = y + 1 + j, w = R(2 + Math.pow(j / 19, 0.8) * (half - 2));
        b.rect(cx - w - 1, yy, 2 * w + 2, 1, OUT);
        for (let i = -w; i < w; i++) { const st = Math.floor(((i / Math.max(1, w)) + 1) * 4) % 2; b.px(cx + i, yy, st ? (i < 0 ? "#d85a8a" : "#a83a68") : (i < 0 ? "#f0e0c8" : "#c8b49c")); }
      }
      for (let i = -half + 1; i < half - 1; i += 5) { b.px(cx + i, y + 21, "#d85a8a"); b.px(cx + i + 2, y + 22, "#f0e0c8"); b.px(cx + i + 1, y + 21, OUT); }
      b.rect(cx, y - 5, 1, 6, OUT); b.rect(cx + 1, y - 5, 4, 2, "#f0609e"); b.px(cx + 5, y - 4, "#f0609e");
      const cols = ["#f0609e", "#f5cc2e", "#22b3a6", "#f0e0c8"];
      for (let i = 0; i < 22; i++) { const t = i / 21, bx = l + 1 + t * (rr - l - 2), by = y + 24 + Math.sin(t * Math.PI * 2) * 2 + 2; b.px(bx, by, i % 2 ? cols[(i >> 1) % 4] : OUT); }
      h.lights.push({ x: cx, y: y + 26, r: 16, s: 0.25 });
      h.confetti = [];
      for (let i = 0; i < 10; i++) h.confetti.push([l + 3 + R(i * (rr - l - 6) / 9), y + 23 + ((i * 7) % 6)]);
    },
    tally(b, h, f, r) {
      front(b, h, { wall: ["#16201c", "#20302a", "#2c4038", "#3a5246", "#4e6a58", "#68866e"], win: "sq", top: 0 }, r);
      const { y, cx, rr = h.r } = h;
      roofGable(b, h, ["#1c3a2c", "#2a5a42", "#3a7a56", "#5aa070"], { top: 5 });
      b.rect(cx - 4, y - 2, 9, 9, OUT); b.rect(cx - 3, y - 1, 7, 7, "#3a5246"); b.ell(cx + 0.5, y + 2.5, 2.5, 2.5, "#e0c060"); b.px(cx, y + 2, "#fff0a0");
      b.rect(cx, y - 6, 1, 4, OUT); b.ell(cx + 0.5, y - 7, 2, 2, f[2], true); b.px(cx, y - 8, f[4], true);
      const tx = rr + 2, ty = h.sill - 6;
      b.rect(tx - 1, ty - 1, 8, 7, OUT); b.rect(tx, ty, 6, 5, "#4a3a2c"); b.rect(tx, ty, 6, 1, "#6e5440"); b.rect(tx + 2, ty + 1, 2, 1, OUT); b.px(tx + 2, ty - 2, "#e0c060", true);
      h.coins = [[cx, y - 8], [cx - 2, y + 1], [cx + 2, y + 3], [tx + 2, ty - 2]];
      const gy = H - 14;
      for (let gx = 66; gx < 84; gx++) { b.px(gx, gy, OUT); b.px(gx, gy + 1, ((gx >> 2) % 2) ? "#e8dcc0" : "#a82a2a"); b.px(gx, gy + 2, OUT); }
      b.rect(64, gy - 6, 3, 14, OUT); b.rect(65, gy - 5, 1, 12, "#6e5440");
    },
  };

  // the Antlered keeps no hall: a grove at the foot of the peak, the door a gap in the trees
  function grove(b, h, f, r) {
    const { y, cx, l, r: rr } = h;
    b.ell(cx, y + 36, (rr - l) / 2 + 5, 34, null, false, (xx, yy, dx, dy, d) => d > 0.88 ? (bay(xx, yy) < 0.5 ? PINE[1] : null) : bay(xx, yy) < 0.3 ? ROCK[0] : "#101a18");
    const trunk = (tx, ty, th, w) => { b.rect(tx - 1, ty - th, w + 2, th, OUT); b.rect(tx, ty - th, w, th, "#2a2420"); b.rect(tx, ty - th, 1, th, "#4a3a30"); };
    const pine = (px, py, ph, pal) => {
      for (let i = 0; i < ph; i++) {
        const w = 1 + R(i * 0.42) - ((i % 4 === 3) ? 1 : 0), yy = py - ph + i;
        b.rect(px - w - 1, yy, 2 * w + 3, 1, OUT);
        b.rect(px - w, yy, 2 * w + 1, 1, pal[1]); b.rect(px - w, yy, Math.max(1, w - 1), 1, pal[2]); b.px(px + w, yy, pal[0]);
      }
    };
    const P1 = ["#0e1c18", "#1a3428", "#2a4c34"], P2 = ["#101e1a", "#1e3a2e", "#30583c"];
    pine(l + 3, y + 56, 44, P1); pine(rr - 3, y + 56, 46, P2); pine(rr - 12, y + 58, 24, P1);
    trunk(l + 9, y + 58, 26, 5);
    for (const [ox, oy, rx, ry, c] of [[-4, 22, 15, 10, "#1a3428"], [-10, 18, 8, 6, "#24442e"], [2, 16, 8, 7, "#24442e"], [-6, 14, 6, 4, "#36583a"]]) b.ell(cx + ox, y + oy, rx, ry, c);
    for (let j = 0; j < 8; j++) for (let i = l - 4; i < rr + 4; i++) b.px(i, y + 56 + j, j === 0 ? MOSS[2] : bay(i, j) < 0.4 ? MOSS[0] : MOSS[1]);
    for (let i = 0; i < 16; i++) { const mx = l + R(r() * (rr - l)), my = y + 57 + R(r() * 6); b.px(mx, my, r() < 0.5 ? "#b6e04c" : "#e8e0c8"); }
    for (const [sx, sy, w] of [[l - 2, y + 54, 6], [rr - 16, y + 55, 5]]) { b.rect(sx - 1, sy - 3, w + 2, 4, OUT); b.rect(sx, sy - 2, w, 3, "#3a4652"); b.rect(sx, sy - 2, w, 1, "#5a6a74"); }
    h.door = [cx - 10, y + 24, 24, 32];
    h.grove = true;
    h.wins = [];
  }

  // ---------- light ----------
  function lightPass(b, lights) {
    const add = new Float32Array(W * H * 3);
    for (const L of lights) {
      const rgb = hex2(L.col).map((v) => v / 255), r2 = L.r;
      for (let y = Math.max(0, Math.floor(L.y - r2)); y < Math.min(H, Math.ceil(L.y + r2)); y++) {
        if (L.ymin != null && y < L.ymin) continue;
        for (let x = Math.max(0, Math.floor(L.x - r2)); x < Math.min(W, Math.ceil(L.x + r2)); x++) {
          const dy = (y - L.y) * (L.sy || 1), d = Math.hypot(x - L.x, dy) / r2;
          if (d >= 1) continue;
          const v = Math.pow(1 - d, 1.6) * L.s * 4, q = Math.floor(v + bay(x, y)) / 4;
          if (q <= 0) continue;
          const i = (y * W + x) * 3;
          add[i] += rgb[0] * q; add[i + 1] += rgb[1] * q; add[i + 2] += rgb[2] * q;
        }
      }
    }
    for (let i = 0; i < W * H; i++) {
      if (b.e[i]) continue;
      for (let k = 0; k < 3; k++) {
        const a = Math.min(1.6, add[i * 3 + k]), c = b.c[i * 3 + k];
        b.c[i * 3 + k] = c * (1 + a * 1.8) + a * 34;
      }
    }
  }
  // the air: the higher on the peak, the more of the evening's blue between us and the rock
  function haze(b) {
    const hz = hex2("#2a3456");
    for (let y = 0; y < H; y++) {
      const t = clamp(0.26 * (1 - (y - 60) / 340), 0, 0.26);
      if (t <= 0) continue;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (b.e[i] || !b.m[i]) continue;
        for (let k = 0; k < 3; k++) b.c[i * 3 + k] += (hz[k] - b.c[i * 3 + k]) * t;
      }
    }
  }
  // banks of mist between the tiers: thick over the valley at the sides, a thin veil across the face
  const MISTS = [146, 226, 306, 386];
  function mistBanks(b) {
    const mc = hex2("#8a94b4"), mn = noise(97);
    for (const my of MISTS) for (let y = my - 6; y <= my + 6; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (b.e[i]) continue;
      const side = b.m[i] ? 0.16 : 0.5, v = (1 - Math.abs(y - my - (mn(x / 9 + my) - 0.5) * 4) / 6) * side * (0.6 + mn(x / 5 + my * 0.3) * 0.7);
      if (v <= 0) continue;
      const q = Math.floor(v * 4 + bay(x, y)) / 4;
      for (let k = 0; k < 3; k++) b.c[i * 3 + k] += (mc[k] - b.c[i * 3 + k]) * q * 0.6;
    }
  }

  // the door: the fire inside, the god leaning on the half-door, the half-door lit from behind on its top rail
  function doorway(b, h, id, f, opts, cv) {
    const [dx, dy, dw, dh] = h.door, lit = opts.lit && opts.lit[id];
    const d = cv ? cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data : null;
    if (h.grove) {
      const bx = dx + dw / 2 - 16, by = dy;
      if (d) for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const k = (j * 32 + i) * 4; if (d[k + 3] >= 128) b.px(bx + i, by + j, [d[k], d[k + 1], d[k + 2]], true); }
      for (let i = -4; i < dw + 4; i++) {
        const fh = 3 + ((i * 5) % 4);
        for (let j = 0; j < fh; j++) b.px(dx + i + (j > 1 && i % 2 ? 1 : 0), dy + 32 - j, j === fh - 1 ? MOSS[2] : j % 2 ? "#24442e" : "#1a3428");
      }
      return;
    }
    if (h.dark) return darkDoor(b, h, d, f);
    for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) {
      const u = Math.abs(i + 0.5 - dw / 2) / (dw / 2), v = j / dh, heat = (1 - u * 0.75) * (0.62 + v * 0.5) - (v < 0.08 ? 0.25 : 0) + (lit ? 0.4 : 0);
      let q = heat + (bay(dx + i, dy + j) - 0.5) * 0.35;
      if (h.pin) {
        const pin = ((dx + i) * 5 + (dy + j) * 3) % 11 === 0 && v < 0.75, bg = (bay(dx + i, dy + j) < 0.2 + (lit ? 0.15 : 0)) ? BRASS[1] : "#1e140a";
        b.px(dx + i, dy + j, pin ? (v < 0.35 ? BRASS[4] : BRASS[3]) : v > 0.7 && bay(dx + i, dy + j) < 0.5 ? BRASS[1] : bg, true);
        continue;
      }
      b.px(dx + i, dy + j, q > 0.95 ? f[3] : q > 0.7 ? f[2] : q > 0.45 ? f[1] : q > 0.22 ? f[0] : mix(f[0], OUT, 0.5), true);
    }
    for (const [i0, j0] of [[0, 0], [1, 0], [0, 1], [dw - 1, 0], [dw - 2, 0], [dw - 1, 1]]) b.px(dx + i0, dy + j0, OUT, true);
    b.rect(dx, dy + dh - 9, dw, 1, h.pin ? BRASS[1] : f[0], true);
    if (d) {
      const bx = dx + dw / 2 - 16, by = dy;
      for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
        const k = (j * 32 + i) * 4, X = bx + i, Y = by + j;
        if (d[k + 3] < 128 || X < dx || X >= dx + dw || Y >= dy + dh - 8) continue;
        if ((X === dx || X === dx + dw - 1) && Y < dy + 2) continue;
        b.px(X, Y, [d[k], d[k + 1], d[k + 2]], true);
      }
    }
    const hy = dy + dh - 8, rail = h.pin ? BRASS[3] : f[3];
    b.rect(dx - 1, hy - 1, dw + 2, 9, OUT);
    for (let j = 0; j < 8; j++) for (let i = 0; i < dw; i++) {
      const plank = i % 6 === 5;
      b.px(dx + i, hy + j, j === 0 ? rail : j === 1 ? WOOD[3] : plank ? WOOD[0] : j === 4 ? WOOD[1] : i % 6 === 0 ? WOOD[3] : WOOD[2], j === 0);
    }
    b.px(dx + dw - 4, hy + 4, "#a89060");
  }
  // the Veiled One's door: the darkest on the Mountain, her veil in the hall's cold stone, the candle her one violet, its light only rime
  function darkDoor(b, h, d, f) {
    const [dx, dy, dw, dh] = h.door, [ci, cj] = h.candle, cx = dx + ci, cy = dy + cj, hy = dy + dh - 8;
    const VEIL = ["#141828", "#1e2234", "#2a3044", "#384058", "#4a5470", FROST[0]];
    for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) b.px(dx + i, dy + j, bay(dx + i, dy + j) < 0.18 ? "#0e1020" : "#080910", true);
    const rime = [];
    const frost = (x, y, k) => { b.px(x, y, FROST[k], true); rime.push([x, y]); };
    if (d) {
      const bx = dx + dw / 2 - 16, by = dy, on = (i, j) => i >= 0 && j >= 0 && i < 32 && j < 32 && d[(j * 32 + i) * 4 + 3] >= 128;
      for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
        const k = (j * 32 + i) * 4, X = bx + i, Y = by + j;
        if (!on(i, j) || X < dx || X >= dx + dw || Y >= hy) continue;
        const edge = !on(i - 1, j) || !on(i + 1, j) || !on(i, j - 1), lum = (d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11) / 255;
        if (edge) { if (X > cx - 3 && Math.abs(Y - cy) < 9 && (Y & 1)) frost(X, Y, 0); else b.px(X, Y, OUT, true); continue; }
        b.px(X, Y, VEIL[clamp(Math.floor(lum * 6), 0, VEIL.length - 1)], true);
      }
    }
    b.px(cx, cy + 1, FROST[1], true); b.px(cx, cy + 2, FROST[0], true);
    b.px(cx, cy, f[2], true); b.px(cx, cy - 1, f[3], true); b.px(cx + 1, cy - 1, f[3], true); b.px(cx + 1, cy - 2, f[4], true);
    for (let j = cj - 9; j < cj + 10; j++) if ((j * 7) % 5 < 2) frost(dx + dw, dy + j, Math.abs(j - cj) < 4 ? 2 : 1);
    for (let j = cj - 5; j < cj + 6; j++) if ((j * 3) % 4 === 0) frost(dx - 1, dy + j, 0);
    for (let i = ci - 6; i < ci + 8; i++) if ((i * 5) % 3 === 0) frost(dx + i, dy - 2, Math.abs(i - ci) < 3 ? 2 : 1);
    b.rect(dx - 1, hy - 1, dw + 2, 9, OUT);
    for (let j = 0; j < 8; j++) for (let i = 0; i < dw; i++) {
      const plank = i % 6 === 5;
      b.px(dx + i, hy + j, j === 0 ? "#2a3044" : j === 1 ? WOOD[2] : plank ? WOOD[0] : j === 4 ? WOOD[1] : i % 6 === 0 ? WOOD[2] : WOOD[1]);
    }
    for (let i = ci - 5; i < ci + 6; i++) if ((i * 7) % 4 < 2) frost(dx + i, hy, Math.abs(i - ci) < 2 ? 2 : 1);
    h.rime = [0.1, 0.35, 0.6, 0.85].map((u) => rime[Math.floor(u * rime.length)]).filter(Boolean);
  }
  function windows(b, h, f, lit) {
    if (h.dark) {
      for (const [qx, qy, qw, qh] of h.wins) { b.rect(qx, qy, qw, qh, "#080910", true); b.px(qx, qy + qh - 1, FROST[0], true); }
      return;
    }
    for (const [qx, qy, qw, qh, shape] of h.wins) {
      for (let j = 0; j < qh; j++) for (let i = 0; i < qw; i++) {
        if (shape === "port" && Math.hypot(i + 0.5 - qw / 2, j + 0.5 - qw / 2) > qw / 2 - 0.2) continue;
        if (shape === "arch" && j < 2 && (i < 2 - j || i > qw - 3 + j)) { b.px(qx + i, qy + j, OUT, true); continue; }
        if (h.pin) { b.px(qx + i, qy + j, ((qx + i) * 5 + (qy + j) * 3) % 7 === 0 ? BRASS[4] : "#1e140a", true); continue; }
        const q = (j / qh) * 0.8 + (bay(qx + i, qy + j) - 0.5) * 0.5 + (lit ? 0.3 : 0);
        b.px(qx + i, qy + j, q > 0.7 ? f[3] : q > 0.3 ? f[2] : f[1], true);
      }
      if (qw >= 4) b.rect(qx + (qw >> 1), qy, 1, qh, OUT, true);
      b.rect(qx, qy + (qh >> 1), qw, 1, OUT, true);
    }
  }

  // ---------- actors ----------
  const dot = (ctx, x, y, c, w, h) => { ctx.fillStyle = c; ctx.fillRect(R(x), R(y), w || 1, h || 1); };
  const frac = (v) => ((v % 1) + 1) % 1;
  // a feud across the stair: one god's light arcs from its hall and the rival's meets it over the steps
  function feud(a, b2, fa, fb) {
    const A = HALLS[a], B = HALLS[b2];
    const src = (h) => h.chim || [h.side === "l" ? h.r - 4 : h.l + 4, h.y + 6];
    const p0 = src(A), p1 = src(B), mid = [R((A.land + B.land) / 2), R((A.y + B.y) / 2) + 14];
    const arc = (p, u) => {
      const c = [(p[0] + mid[0]) / 2, Math.min(p[1], mid[1]) - 22], q = 1 - u;
      return [q * q * p[0] + 2 * q * u * c[0] + u * u * mid[0], q * q * p[1] + 2 * q * u * c[1] + u * u * mid[1]];
    };
    const steam = ["#e8eef4", "#b8c8d4", "#8a9cac"];
    return { z: 2e4, draw(ctx, t) {
      for (let i = 0; i < 22; i++) {
        const u = frac(t * 0.38 + i / 22), [x, y] = arc(p0, u), j = Math.sin(i * 7.1) * 1.5;
        dot(ctx, x + j, y, u > 0.8 ? fa[4] : i % 3 ? fa[3] : fa[2], i % 3 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
        if (i % 2 === 0) dot(ctx, x + j - 1, y + 1, fa[1]);
        const v = frac(t * 0.42 + i / 22 + 0.03), [x2, y2] = arc(p1, v), j2 = Math.sin(i * 5.3) * 1.5;
        dot(ctx, x2 + j2, y2, v > 0.8 ? "#e8fff8" : i % 2 ? fb[3] : fb[4], 1, i % 3 === 0 ? 2 : 1);
        if (i % 3 === 1) dot(ctx, x2 + j2 + 1, y2 + 1, fb[2]);
      }
      const puff = (cx, cy, rx, ry, col) => { for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) <= 1 && bay(R(cx + xx), R(cy + yy)) < 0.8) dot(ctx, cx + xx, cy + yy, col); };
      for (let k = 0; k < 4; k++) {
        const a2 = frac(t * 0.25 + k / 4), cx = mid[0] + Math.sin(k * 2.3 + t * 0.7) * 3, cy = mid[1] - 2 - a2 * 16, rr = 3 + a2 * 4;
        ctx.globalAlpha = 0.85 * (1 - a2);
        puff(cx, cy, R(rr), R(rr * 0.7), steam[a2 < 0.3 ? 0 : a2 < 0.65 ? 1 : 2]);
      }
      ctx.globalAlpha = 1;
      const burst = 0.5 + 0.5 * Math.sin(t * 3.1);
      for (let k = 0; k < 8; k++) {
        const ang = k / 8 * Math.PI * 2 + t * 0.8, d = 2 + burst * 3 + (k % 2);
        dot(ctx, mid[0] + Math.cos(ang) * d, mid[1] + Math.sin(ang) * d * 0.7, k % 2 ? fa[4] : fb[4]);
      }
      dot(ctx, mid[0] - 1, mid[1], "#fff8e0", 3, 1); dot(ctx, mid[0], mid[1] - 1, "#fff8e0", 1, 3);
    } };
  }

  function build(opts) {
    opts = opts || {};
    if (window.GodArt && opts.fires) GodArt.init({ fires: opts.fires });
    const fireOf = (id) => (opts.fires && opts.fires[id]) || (window.GodArt && GodArt.fire(id)) || "#f0a040";
    const rampOf = (id) => window.Art ? Art.ramp(fireOf(id)) : [fireOf(id), fireOf(id), fireOf(id), fireOf(id), fireOf(id)];
    const b = Buf(), r = rng(4401);
    sky(b, r);
    ranges(b);
    peak(b);
    foot(b, r);
    summitDoor(b);
    const lights = [];
    for (const id of ORDER) {
      const h = Object.assign(HALLS[id], { lights: [], chim: null, pin: null, dark: false, candle: null, grove: false }), f = rampOf(id);
      if (id === "antlered") grove(b, h, f, r); else DRESS[id](b, h, f, r);
      const k = opts.lit && opts.lit[id] ? 1.8 : 1;
      const [dx, dy, dw, dh] = h.door;
      if (h.dark) { /* her door throws no light */ } else if (h.pin) {
        lights.push({ x: dx + dw / 2, y: dy + dh + 1, r: 22 * k, s: 0.45 * k, col: BRASS[3], ymin: dy + dh - 9, sy: 2.4 });
      } else if (!h.grove) {
        lights.push({ x: dx + dw / 2, y: dy + dh + 1, r: 34 * k, s: 0.9 * k, col: f[3], ymin: dy + dh - 9, sy: 2.2 });
        lights.push({ x: dx + dw / 2, y: dy + 10, r: 20, s: 0.3 * k, col: f[2] });
        for (const [qx, qy, qw, qh] of h.wins) lights.push({ x: qx + qw / 2, y: qy + qh, r: 10, s: 0.4 * k, col: f[3], ymin: qy - 2 });
      } else lights.push({ x: dx + 12, y: dy + 26, r: 28, s: 0.55 * k, col: f[2] }, { x: dx + 12, y: dy + 34, r: 20, s: 0.5 * k, col: f[3], sy: 1.8 });
      for (const L of h.lights) lights.push(Object.assign({ col: f[3] }, L, { s: L.s * k }));
    }
    const cand = flights(b, r);
    for (const id of ORDER) ledge(b, HALLS[id], r);
    for (const id of ORDER) {
      const h = HALLS[id];
      post(b, h.land + (h.side === "l" ? 3 : -3), h.sill);
      lights.push({ x: h.land + (h.side === "l" ? 3 : -3), y: h.sill - 14, r: 16, s: 0.55, col: "#ffcc80" });
    }
    const vot = rng(77);
    for (const [x, y] of cand) {
      if (vot() < 0.45) continue;
      b.px(x, y - 1, "#d8d0c0"); b.px(x, y - 2, "#ffe0a0", true); b.px(x, y - 3, "#ffb860", true);
      lights.push({ x, y: y - 2, r: 6, s: 0.45, col: "#ffcc80" });
    }
    for (const fd of opts.feuds || [["brannock", "marrow"]]) {
      const A = HALLS[fd[0]], B = HALLS[fd[1]];
      if (A && B) { const mx = R((A.land + B.land) / 2), my = R((A.y + B.y) / 2) + 14; lights.push({ x: mx - 4, y: my, r: 20, s: 0.45, col: rampOf(fd[0])[3] }, { x: mx + 4, y: my, r: 20, s: 0.45, col: rampOf(fd[1])[3] }); }
    }
    lightPass(b, lights);
    haze(b);
    mistBanks(b);
    const idles = [];
    for (const id of ORDER) {
      const h = HALLS[id], f = rampOf(id), mood = opts.moods && opts.moods[id];
      const [dx, dy, dw, dh] = h.door, box = [dx - 2, dy - 3, dw + 4, dh + 4];
      const art = window.GodArt ? [GodArt.litBust(id, mood), GodArt.litBust(id, mood, 1)] : [null, null];
      const keep = b.snap(...box);
      doorway(b, h, id, f, opts, art[1]);
      const one = b.snap(...box);
      b.put(keep);
      doorway(b, h, id, f, opts, art[0]);
      if (!h.grove) windows(b, h, f, opts.lit && opts.lit[id]);
      if (opts.lit && opts.lit[id]) for (let x = h.l; x <= h.r; x += 2) {
        const i = (x - h.l) >> 1, gy = h.y + 22 + R(Math.abs(Math.sin(i * Math.PI / 6)) * 3);
        b.px(x, gy, h.dark ? FROST[i % 3] : h.pin ? BRASS[3 + (i % 2)] : i % 3 === 0 ? f[4] : i % 3 === 1 ? f[3] : "#fff4d8", true);
      }
      idles.push({ id, a: snapCanvas(b.snap(...box)), b: snapCanvas(one), x: box[0], y: box[1] });
    }
    const base = document.createElement("canvas");
    base.width = W; base.height = H;
    const ctx = base.getContext("2d"), img = ctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) { for (let k = 0; k < 3; k++) img.data[i * 4 + k] = clamp(R(b.c[i * 3 + k]), 0, 255); img.data[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    const acts = actors(opts, rampOf, idles);
    return { base, acts, W, H };
  }

  // the gods breathe at their doors (two frames each, out of step), and each hall keeps one small motion of its own
  function actors(opts, rampOf, idles) {
    const A = window.Anim, out = [];
    if (!A) return out;
    const rgb = (h) => hex2(h).join(",");
    idles.forEach((d, i) => out.push(A.flip({ a: d.a, b: d.b, x: d.x, y: d.y, rate: 1.6 + (i % 3) * 0.35, seed: i * 3 + 1, z: -100 })));
    for (const id in opts.lit || {}) if (opts.lit[id] && HALLS[id] && !HALLS[id].dark && !HALLS[id].pin) { const d = HALLS[id].door; out.push(A.glow({ x: d[0] + 12, y: d[1] + 24, r: 26, rgb: rgb(rampOf(id)[3]), a: 0.14, speed: 1.6, seed: 40 })); }
    const H_ = HALLS, f = (id) => rampOf(id);
    out.push(A.embers({ x0: H_.brannock.chim[0] - 2, x1: H_.brannock.chim[0] + 2, y: H_.brannock.chim[1], n: 10, rise: 22, cols: [f("brannock")[4], f("brannock")[3], f("brannock")[2], f("brannock")[0]], seed: 3 }));
    out.push(A.drip({ x: H_.marrow.drip[0], y0: H_.marrow.drip[1], y1: H_.marrow.drip[2], col: "#8ad8d0", seed: 7 }));
    out.push(A.twinkle({ pts: H_.aurel.pins, col: BRASS[4], arm: BRASS[3], seed: 29 }));
    if (H_.veiled.rime && H_.veiled.rime.length) out.push(A.twinkle({ pts: H_.veiled.rime, col: FROST[2], arm: FROST[1], seed: 23 }));
    out.push(A.smoke({ x: H_.pell.chim[0], y: H_.pell.chim[1], n: 6, rise: 14, col: "#c8c4c0", col2: "#8a8890", seed: 11, wind: 3 }));
    out.push(A.mist({ W: 160, y: H_.ferryman.sill - 6, h: 8, rgb: rgb(f("ferryman")[4]), a: 0.14, seed: 13, speed: 1 }));
    out.push(A.embers({ x0: H_.gorm.chim[0] - 2, x1: H_.gorm.chim[0] + 2, y: H_.gorm.chim[1], n: 6, rise: 14, cols: [f("gorm")[4], f("gorm")[3], f("gorm")[2], f("gorm")[0]], seed: 15 }));
    out.push(A.twinkle({ pts: H_.mab.confetti, col: f("mab")[4], arm: f("mab")[2], seed: 17 }));
    out.push(A.twinkle({ pts: H_.tally.coins, col: f("tally")[4], arm: f("tally")[2], seed: 27 }));
    out.push(A.fireflies({ x: H_.antlered.l, y: H_.antlered.y + 18, w: H_.antlered.r - H_.antlered.l, h: 34, n: 8, rgb: rgb(f("antlered")[3]), col: f("antlered")[4], seed: 19 }));
    const stars = [];
    for (let i = 0; i < 12; i++) stars.push([R(6 + (i * 37) % 148), R(4 + (i * 23) % 120)]);
    out.push(A.twinkle({ pts: stars.filter(([x, y]) => Math.hypot(x - GAP.x, y - GAP.y) > GAP.r + 4 && !inRock(x, y)), seed: 21 }));
    MISTS.forEach((y, t) => out.push(A.mist({ W: 160, y: y - 5, h: 10, rgb: "150,170,210", a: 0.12, seed: 30 + t, speed: 1.2 + t * 0.3 })));
    out.push(A.bat({ W: 160, y0: 60, y1: 120, seed: 4 }));
    const feuds = opts.feuds || [["brannock", "marrow"]];
    for (const [a, c] of feuds) if (H_[a] && H_[c]) out.push(feud(a, c, f(a), f(c)));
    return out;
  }

  function canvas(opts) {
    opts = opts || {};
    const s = build(opts), scale = opts.scale || 3, h = opts.strip ? STRIP : H;
    let base = s.base;
    if (opts.strip) { base = document.createElement("canvas"); base.width = W; base.height = STRIP; base.getContext("2d").drawImage(s.base, 0, 0); }
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = h;
    cv.className = "mountain-scene";
    cv.style.imageRendering = "pixelated";
    cv.style.width = W * scale + "px"; cv.style.height = h * scale + "px";
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", opts.label || "The Mountain");
    if (window.Anim) Anim.stage(cv, base, s.acts, { fps: 10, still: opts.still });
    else cv.getContext("2d").drawImage(base, 0, 0);
    return cv;
  }

  window.MountainScene = { build, canvas, HALLS, at, ROWS, W, H, STRIP };
})();
