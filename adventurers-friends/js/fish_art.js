/* Fish art for the catch replays, the hero page and the Creel Book: species sprites by shape family, the ruler and the species card, trophy plaques, ledger icons, the twelve waters' backdrops (and a roadside stream), the angler, and the odd things that come up on a line; all plain pixel buffers. */
/*
  FishArt.fish(idOrSpecies, o)  a fish as an Img. o.size: "icon" (20 px), "held" (by o.cm), "codex" / "card" (64 px), "plaque" (50 px) or o.len in px;
                                o.face (1 right, -1 left), o.phase (the swim), o.shadow (a colour: a silhouette), o.legend (a legend id: its tint).
                                The Img carries .snout [x, y] and .mid [x, y].
  FishArt.icon(id)              a ledger-row fish, about 20x10.
  FishArt.card(spec)            the codex / species card (96x124): spec { species, size?, rank?, first?, best?, rare?, legend?, hero?, day?, unknown? }.
  FishArt.plaque(spec)          a fish mounted on a walnut plaque with a brass nameplate (gold for a legend), 76x50: spec { species, size, legend? }.
  FishArt.toCanvas(img, scale)  a <canvas> at an integer scale, pixels kept square.
  FishArt.scene(rec)            the backdrop for a catch record: { img, wl, perch: { x, y, seat }, bob: [x, y], crew: [[x, y]...], water, kind, fg(img, t), amb(img, t) }.
  Needs FoodArt.kit (food_art.js) for the buffer, noise and the 1px font. Nothing here touches the DOM except toCanvas.
*/
(function (root) {
  "use strict";
  const K = root.FoodArt.kit;
  const { Img, C, mix, rng, hash, fbm, h2, bay, clamp, lerp, text, textWidth, glow, star } = K;
  const W = 240, H = 150;
  const R = Math.round;
  const S = () => ((root.App && root.App.S) || (root.LD && root.LD.static) || {}).fish || {};
  const luma = (c) => { c = C(c); return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; };
  const dith = (a, b, t, x, y) => (bay(x, y) < t ? b : a);

  const FALLBACK = { id: "fish", name: "Fish", shape: "slim", pattern: "plain", pal: { body: "#7a8a8a", belly: "#dfe3dc", fin: "#5a6a6a" }, lo: 10, mid: 25, hi: 50, kind: "river" };
  function species(x) {
    if (x && typeof x === "object") return Object.assign({}, FALLBACK, x, { pal: Object.assign({}, FALLBACK.pal, x.pal || {}) });
    const sp = (S().species || {})[x];
    return sp ? Object.assign({}, FALLBACK, sp) : Object.assign({}, FALLBACK, { id: x || "fish" });
  }
  const legendOf = (id) => (S().legends || {})[id] || null;

  // ---------- the fish: a profile per shape family, shaded back to belly, a pattern, fins, an eye ----------
  const SHAPE = {
    slim: { h: 0.27, tail: 0.2, fork: 0.55, span: 0.95, up: 1.05, dn: 0.95, dorsal: [0.38, 0.64, 0.36], anal: [0.1, 0.26, 0.28], eye: 0.86, min: 3 },
    deep: { h: 0.46, tail: 0.17, fork: 0.3, span: 0.72, up: 1.12, dn: 0.88, dorsal: [0.28, 0.74, 0.3], anal: [0.08, 0.3, 0.24], eye: 0.83, min: 4 },
    long: { h: 0.17, tail: 0.15, fork: 0.12, span: 1.25, up: 0.95, dn: 1.05, dorsal: [0.04, 0.24, 0.6], anal: [0.04, 0.2, 0.45], eye: 0.84, min: 3 },
    eel: { h: 0.13, tail: 0.0, fork: 0, span: 0, up: 1, dn: 1, dorsal: [0.0, 0.62, 0.22], anal: [0.0, 0.45, 0.18], eye: 0.94, min: 4 },
    round: { h: 0.6, tail: 0.15, fork: 0.15, span: 0.6, up: 1.04, dn: 0.96, dorsal: [0.32, 0.6, 0.22], anal: [0.3, 0.55, 0.18], eye: 0.74, min: 5 },
    tiny: { h: 0.32, tail: 0.22, fork: 0.45, span: 0.9, up: 1.05, dn: 0.95, dorsal: [0.42, 0.62, 0.38], anal: [0.18, 0.32, 0.28], eye: 0.82, min: 3 },
  };
  function prof(shape, u) {
    if (shape === "deep") return Math.max(0.2, Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * u)), 0.5));
    if (shape === "long") return u < 0.2 ? 0.4 + (u / 0.2) * 0.6 : u > 0.74 ? 1 - ((u - 0.74) / 0.26) * 0.58 : 1;
    if (shape === "eel") return u < 0.6 ? 0.12 + 0.88 * Math.pow(u / 0.6, 0.6) : u > 0.9 ? 1 - ((u - 0.9) / 0.1) * 0.45 : 1;
    if (shape === "round") return Math.max(0.2, Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2))));
    return Math.max(0.24, Math.pow(Math.sin(Math.PI * (0.06 + 0.9 * u)), 0.7));
  }
  // the little things that make a species itself (art only)
  const EXTRA = {
    pike: { jaw: 1 }, grayling: { sail: 1 }, perch: { spiny: 1 }, catfish: { barbels: 1 }, burbot: { chin: 1 }, gulper: { gape: 1 },
    crystal_eel: { heart: 1, clear: 1 }, cavefish: { blind: 1 }, moonfish: { clear: 0 }, lantern_minnow: { lamp: 1 }, conger: {}, bog_eel: {},
  };
  // a legend is its species in its own coat
  const LEGEND_TINT = {
    ford_ghost: { body: "#d8dcd8", belly: "#f6f6f0", fin: "#b8c0c0" }, pale_queen: { body: "#e0e6ea", belly: "#f8f8f6", fin: "#c0ccd4" },
    mourner: { body: "#26221e", belly: "#4a443a", fin: "#1a1612" }, lamp_eater: { body: "#2a3644", belly: "#e8d080", fin: "#1e2834" },
    old_toll: { body: "#4a5a30", belly: "#c8c48a", fin: "#7a5a24" }, hookjaw: { body: "#6a7880", belly: "#dfe4e4", fin: "#c8963e" },
  };
  const LENS = { icon: 20, codex: 64, card: 64, plaque: 50 };
  const heldLen = (cm) => clamp(R(9 + 8 * Math.log(Math.max(4, cm) / 7)), 9, 46);
  const cache = new Map();

  function fish(x, o) {
    o = o || {};
    let sp = species(x);
    if (o.legend) { const lg = legendOf(o.legend); if (lg && !(x && typeof x === "object")) sp = species(lg.species); if (LEGEND_TINT[o.legend]) sp = Object.assign({}, sp, { pal: Object.assign({}, sp.pal, LEGEND_TINT[o.legend]) }); }
    const L = Math.max(6, R(o.len || LENS[o.size] || (o.size === "held" ? heldLen(o.cm || sp.mid) : 24)));
    const ph = o.phase ? R((((o.phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8 : 0;
    const key = [sp.id, L, ph, o.face || 1, o.shadow || "", o.legend || "", sp.pal.body, o.noOutline ? 1 : 0].join("|");
    if (cache.has(key)) return cache.get(key);
    const img = draw(sp, L, ph * (Math.PI / 4), o);
    if (cache.size > 400) cache.delete(cache.keys().next().value);
    cache.set(key, img);
    return img;
  }

  function draw(sp, L, phase, o) {
    const sh = SHAPE[sp.shape] || SHAPE.slim, ex = EXTRA[sp.id] || {}, pal = sp.pal;
    const Hb = Math.max(sh.min, R(L * sh.h)), tl = R(L * sh.tail), bl = L - tl;
    const fhd = Math.max(1, R(Hb * sh.dorsal[2] * (ex.sail ? 1.9 : 1))), fha = Math.max(1, R(Hb * sh.anal[2]));
    const amp = sp.shape === "eel" ? Math.max(1, Hb * 0.5) : Math.max(0.6, Hb * 0.1);
    const extraX = ex.barbels ? R(L * 0.12) + 1 : 0;
    const w = L + 2 + extraX, h = Hb + fhd + fha + R(amp * 2) + 6 + (ex.barbels ? R(L * 0.08) : 0) + (ex.chin ? 2 : 0);
    const cy = fhd + R(amp) + 2 + Hb / 2;
    const kind = new Uint8Array(w * h), V = new Float32Array(w * h), U = new Float32Array(w * h);
    const set = (x, y, k, v, u) => { x = R(x); y = R(y); if (x < 0 || y < 0 || x >= w || y >= h) return; const i = y * w + x; if (k === 1 || !kind[i]) { kind[i] = k; V[i] = v; U[i] = u; } };
    const wave = (u) => (o.still ? 0 : sp.shape === "eel" ? Math.sin(phase - u * 7) * amp * (0.45 + 0.55 * (1 - u)) : Math.sin(phase) * amp * Math.pow(1 - u, 2) * 1.6);
    const tops = [], bots = [];
    for (let i = 0; i < L; i++) {
      const X = i + 1;
      if (i >= tl) {
        const u = bl > 1 ? (i - tl) / (bl - 1) : 1, hh = (Hb / 2) * prof(sp.shape, u), dy = wave(u);
        let top = cy - hh * sh.up + dy, bot = cy + hh * sh.dn + dy;
        if (ex.jaw && u > 0.78) top += (u - 0.78) * Hb * 0.9;
        tops[i] = top; bots[i] = bot;
        const y0 = R(top), y1 = Math.max(y0 + 1, R(bot));
        for (let y = y0; y < y1; y++) set(X, y, 1, (y + 0.5 - top) / Math.max(1, bot - top), u);
        const [a, b] = sh.dorsal;
        if (u >= a && u <= b) {
          // the leading ray stands tallest and the fin trails back, so a dorsal never reads as a shark's
          const s0 = (u - a) / (b - a), s1 = 1 - s0;
          let ft = sp.shape === "eel" ? fhd : fhd * Math.pow(Math.sin(Math.PI * Math.pow(s1, 1.6)), 0.8);
          if (sp.shape === "eel") ft = Math.min(ft, Math.max(1, Hb * 0.25));
          if (ex.spiny) ft += (i % 2 ? 0.8 : -0.4);
          for (let y = R(top - ft); y < y0; y++) set(X, y, 2, (y0 - y) / Math.max(1, ft), u);
        }
        const [c, d] = sh.anal;
        if (u >= c && u <= d) {
          let ft = fha * Math.sin((Math.PI * (u - c)) / (d - c));
          if (sp.shape === "eel") ft = Math.min(ft, Math.max(1, Hb * 0.22));
          for (let y = y1; y < R(bot + ft); y++) set(X, y, 2, (y - y1) / Math.max(1, ft), u);
        }
      } else {
        const t = i / Math.max(1, tl), dy = wave(0) * (1 + (1 - t) * 0.4), ped = (Hb / 2) * prof(sp.shape, 0);
        const span = lerp((Hb / 2) * sh.span * 1.15, ped, Math.pow(t, 0.9)), notch = sh.fork * (1 - t) * span * 1.1;
        for (let y = R(cy + dy - span); y <= R(cy + dy + span); y++) { const dd = Math.abs(y - cy - dy); if (dd >= notch || dd < 0.5 && notch < 1) set(X, y, 2, 1 - t, 0); }
      }
    }
    if (sp.shape === "eel") {
      for (let i = 0; i < 3; i++) { const dy = wave(0); set(1 + i - 1, cy + dy, 2, 0.5, 0); }
    }
    const img = new Img(w, h);
    const back = mix(pal.body, "#0e0a08", 0.4), lite = mix(pal.body, "#fff6e4", 0.2), bellyS = mix(pal.belly, pal.body, 0.38);
    const fin = C(pal.fin), finD = mix(pal.fin, "#0a0604", 0.3), finL = mix(pal.fin, "#fff6e4", 0.25);
    const dark = luma(pal.body) < 105, spotC = dark ? mix(pal.belly, "#fffaf0", 0.25) : mix(pal.body, "#120a06", 0.55);
    const big = L >= 30, mid = L >= 16;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, k = kind[i];
      if (!k) continue;
      const v = V[i], u = U[i];
      if (o.shadow) { img.px(x, y, o.shadow); continue; }
      if (k === 2) {
        const ray = (x % 2 === 0) && mid;
        img.px(x, y, v > 0.75 && mid ? finL : ray ? finD : fin);
        continue;
      }
      let c;
      if (v < 0.2) c = back;
      else if (v < 0.27) c = dith(back, C(pal.body), (v - 0.2) / 0.07, x, y);
      else if (v < 0.5) c = mid && v > 0.3 && v < 0.37 ? lite : C(pal.body);
      else if (v < 0.64) c = dith(C(pal.body), C(pal.belly), (v - 0.5) / 0.14, x, y);
      else c = v > 0.88 && mid ? bellyS : C(pal.belly);
      const pt = sp.pattern;
      if (pt === "spots" && v < 0.68 && mid) {
        const s = Math.max(3, R(L / 10)), cx = Math.floor(x / s), cyy = Math.floor(y / s), hx = h2(cx, cyy, 7), hy = h2(cx, cyy, 9);
        const sx = cx * s + Math.floor(hx * (s - 1)), syy = cyy * s + Math.floor(hy * (s - 1));
        if (h2(cx, cyy, 3) < 0.7 && (x === sx || (big && x === sx + 1)) && (y === syy || (big && L > 50 && y === syy + 1))) c = spotC;
      } else if (pt === "bars" && v < 0.7 && u > 0.05 && u < 0.82) {
        const p = Math.max(3, R(bl / 6)), wav = sp.shape === "slim" ? R(Math.sin(y * 0.9) * (big ? 1 : 0)) : 0;
        if ((((x - tl + wav) % p) + p) % p < Math.max(1, R(p * 0.38))) c = mix(c, "#0c0806", sp.shape === "slim" ? 0.5 : 0.42);
      } else if (pt === "stripe" && v > 0.42 && v < (mid ? 0.58 : 0.62) && u < 0.9) {
        c = mix(fin, c, 0.15);
      } else if (pt === "speckle" && v < 0.8 && mid) {
        const hv = h2(x, y, 13);
        if (hv < 0.11) c = mix(c, "#0c0806", 0.45); else if (hv > 0.94) c = mix(c, "#fffaf0", 0.35);
      } else if (pt === "glow") {
        if (v > 0.6 && v < 0.82 && x % 3 === 0 && u > 0.1 && u < 0.85) c = mix(fin, "#ffffff", 0.45);
        else c = mix(c, fin, 0.12);
      } else if (pt === "scales" && v < 0.86 && mid) {
        if (y % 2 === 0 && (x + (y % 4 === 0 ? 0 : 2)) % 4 === 0) c = mix(c, "#fff8e8", 0.24);
      }
      if (ex.clear && v > 0.25 && v < 0.75) c = mix(c, "#f0ffff", 0.18);
      if (sp.shape !== "eel" && sp.shape !== "tiny" && mid) {
        const gu = sh.eye - 0.13 + (v - 0.5) * (v - 0.5) * -0.12;
        if (Math.abs(u - gu) * (bl - 1) < 0.5 && v > 0.3 && v < 0.76) c = mix(c, "#0a0604", 0.22);
      }
      if (ex.heart && Math.abs(u - 0.72) * bl < 1 && v > 0.42 && v < 0.62) c = C("#e04a4a");
      img.px(x, y, c);
    }
    if (!o.shadow) {
      const ei = tl + R(sh.eye * (bl - 1)), et = tops[ei] !== undefined ? tops[ei] : cy - 1, eb = bots[ei] !== undefined ? bots[ei] : cy + 1;
      const ey = R(et + (eb - et) * (sp.shape === "round" ? 0.36 : 0.32)), X = ei + 1;
      if (ex.blind) img.px(X, ey, mix(pal.body, "#ffc0b0", 0.5));
      else if (L >= 40) { img.rect(X - 1, ey, 2, 2, "#f4efe2"); img.px(X, ey, "#120c08"); img.px(X, ey + 1, "#2a1e16"); }
      else if (L >= 14) { img.px(X - 1, ey, "#f4efe2"); img.px(X, ey, "#120c08"); }
      else img.px(X, ey, "#120c08");
      if (L >= 22 && !ex.gape) { const mx = L, my = R(et + (eb - et) * 0.6); img.px(mx, my, mix(pal.body, "#0a0604", 0.6)); img.px(mx - 1, my, mix(pal.body, "#0a0604", 0.4)); }
      if (ex.gape) { const my = R(et + (eb - et) * 0.55); for (let i = 0; i < R(bl * 0.22); i++) { img.px(L - i, my, "#2a0e0e"); if (i > 1 && i < R(bl * 0.18)) img.px(L - i, my + 1, "#7a2a2a"); } for (let i = 0; i < R(bl * 0.18); i += 2) img.px(L - 1 - i, my - 1, "#f4efe2"); }
      if (ex.lamp && L >= 12) { const lx = R(tl + bl * 0.7) + 1, ly = R(cy - (Hb / 2) * 1.2) - 2; img.px(lx, ly + 1, fin); img.px(lx + 1, ly, "#f6ffb0"); img.px(lx + 1, ly - 1, "#d8f070"); }
      if (ex.barbels) {
        const sx = L, sy = R(et + (eb - et) * 0.62), n = R(L * 0.12) + 1, dn = R(L * 0.08);
        for (let i = 0; i <= n; i++) { img.px(sx + i, sy + R((i / n) * (i / n) * dn), mix(pal.fin, "#0a0604", 0.3)); if (L >= 30) img.px(sx + R(i * 0.7), sy + 1 + R((i / n) * dn * 1.2), mix(pal.fin, "#0a0604", 0.45)); }
      }
      if (ex.chin) { const cxx = L - 1, cyy = R(eb); img.px(cxx, cyy, mix(pal.fin, "#0a0604", 0.3)); img.px(cxx, cyy + 1, mix(pal.fin, "#0a0604", 0.3)); }
      if (mid && sp.shape !== "eel") {
        const pu = 0.66, pi = tl + R(pu * (bl - 1)), pt = tops[pi], pb = bots[pi];
        if (pt !== undefined && big) { const py = R(pt + (pb - pt) * 0.6); for (let j = 0; j < 4; j++) for (let q = 0; q <= Math.min(j, 1); q++) img.px(pi - j, py + q, mix(fin, pal.body, j === 0 ? 0.5 : 0.15)); }
      }
      if (!o.noOutline) K.outline(img, o.outline || mix(pal.body, "#0a0604", 0.82));
    }
    let out = img;
    if (o.face === -1) { out = new Img(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = (y * w + x) * 4, d = (y * w + (w - 1 - x)) * 4; for (let k = 0; k < 4; k++) out.d[d + k] = img.d[s + k]; } }
    out.snout = [o.face === -1 ? w - 1 - (L + 1) : L + 1, R(cy)];
    out.mid = [R(w / 2), R(cy)];
    out.len = L;
    return out;
  }

  // a fish trimmed to its pixels
  function trim(img) {
    let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.d[(y * img.w + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < 0) return img;
    const o = new Img(x1 - x0 + 1, y1 - y0 + 1);
    o.paste(img, -x0, -y0);
    if (img.snout) o.snout = [img.snout[0] - x0, img.snout[1] - y0];
    o.mid = [R(o.w / 2), R(o.h / 2)];
    o.len = img.len;
    return o;
  }
  // the biggest drawing of a fish that fits a box
  function fit(sp, mw, mh, o) {
    let len = 64, f = null;
    for (let i = 0; i < 4; i++) {
      f = trim(fish(sp, Object.assign({ len, still: true }, o || {})));
      if (f.w <= mw && f.h <= mh) return f;
      len = Math.max(8, Math.floor(len * Math.min(mw / f.w, mh / f.h)));
    }
    return f;
  }
  const icon = (id, o) => trim(fish(id, Object.assign({ size: "icon", still: true }, o || {})));

  // ---------- words ----------
  function wrap(s, w, o) {
    const out = [];
    let line = "";
    for (const word of String(s || "").split(/\s+/)) {
      if (!word) continue;
      const next = line ? line + " " + word : word;
      if (line && textWidth(next, o) > w) { out.push(line); line = word; } else line = next;
    }
    if (line) out.push(line);
    return out;
  }
  const PAPER = K.P.paper;
  function paper(img, x, y, w, h, seed, gold) {
    const ramp = gold ? K.R(["#c89a3a", "#e8c060", "#f6dc8a", "#fff0c0"]) : PAPER;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const t = 0.74 + (fbm((x + i) / 9, (y + j) / 9, seed) - 0.5) * 0.18 - (j / h) * 0.1 + (i / w) * 0.05;
      img.px(x + i, y + j, K.pick(ramp, t, x + i, y + j));
    }
  }
  function frame(img, x, y, w, h, gold) {
    const o = gold ? ["#5a3a0a", "#c08a24", "#ffe08a", "#8a5a14"] : ["#2a1608", "#6a3e1a", "#aa7038", "#4a2810"];
    img.rect(x - 2, y - 2, w + 4, h + 4, o[0]);
    img.rect(x - 1, y - 1, w + 2, h + 2, o[1]);
    for (let i = 0; i < w + 2; i++) img.px(x - 1 + i, y - 1, o[2]);
    for (let j = 0; j < h + 2; j++) img.px(x - 1, y - 1 + j, o[2]);
    for (let i = 0; i < w + 2; i++) img.px(x - 1 + i, y + h, o[3]);
  }
  function tag(img, s, cx, y, kind) {
    const tw = textWidth(s, { bold: true }) + 10, x = R(cx - tw / 2);
    const col = kind === "legend" ? ["#5a3a0a", "#c08a24", "#ffe08a", "#fff6c8"] : ["#4a0e08", "#9a2a20", "#e05a3a", "#fff0d8"];
    img.rect(x, y, tw, 12, col[1]);
    for (let i = 0; i < tw; i++) { img.px(x + i, y, col[2]); img.px(x + i, y + 11, col[0]); }
    img.px(x - 1, y + 3, col[1]); img.px(x - 2, y + 5, col[1]); img.px(x - 1, y + 8, col[1]); img.px(x + tw, y + 3, col[1]); img.px(x + tw + 1, y + 5, col[1]); img.px(x + tw, y + 8, col[1]);
    text(img, s, x + 5, y + 10, col[3], { bold: true, outline: col[0] });
  }

  // ---------- the species card (the codex and the reveal) ----------
  function card(spec) {
    spec = spec || {};
    const sp = species(spec.species), lg = spec.legend ? (typeof spec.legend === "object" ? spec.legend : legendOf(spec.legend)) : null;
    const gold = !!(spec.rare || lg), cw = 96, ch = 132, img = new Img(cw + 4, ch + 4);
    frame(img, 2, 2, cw, ch, gold);
    paper(img, 2, 2, cw, ch, hash(sp.id) % 97, false);
    const title = lg ? lg.name : sp.name;
    const tl = wrap(title.toUpperCase(), cw - 10, { bold: true });
    const ty = gold ? 23 : 15;
    tl.slice(0, 2).forEach((l, i) => text(img, l, 2 + cw / 2, ty + i * 10, "#2a1810", { bold: true, center: true }));
    const top = ty + (Math.min(2, tl.length) - 1) * 10 + 5, ph = 36;
    img.rect(6, top, cw - 8, ph, "#e2cfa4");
    for (let i = 0; i < cw - 8; i++) { img.px(6 + i, top, "#c8b084"); img.px(6 + i, top + ph - 1, "#f4e6c4"); }
    const ft = fit(sp, cw - 16, ph - 4, spec.unknown ? { shadow: "#5a4a36" } : { legend: lg && lg.id });
    img.paste(ft, R(6 + (cw - 8 - ft.w) / 2), R(top + ph / 2 - ft.h / 2));
    let y = top + ph + 6;
    if (lg) { text(img, sp.name, 2 + cw / 2, y + 7, "#6b543c", { center: true }); y += 10; }
    if (spec.size && !spec.unknown) {
      const bx = 8, bw = cw - 12, by = y;
      const fr = lg ? 1 : clamp((spec.size - sp.lo) / Math.max(1, sp.hi - sp.lo), 0.04, 1);
      img.rect(bx, by, bw, 4, "#cbb48a");
      img.rect(bx, by, R(bw * fr), 4, gold ? "#e8b84a" : "#b8862a");
      for (let i = 0; i < R(bw * fr); i++) img.px(bx + i, by, gold ? "#fff0a0" : "#d8a848");
      for (let i = 0; i <= 4; i++) img.px(bx + R((bw - 1) * i / 4), by + 5, "#8a7458");
      y = by + 16;
      const s = `${R(spec.size)} cm`;
      text(img, s, 2 + cw / 2, y, "#2a1810", { k: 1, bold: true, center: true });
      y += 11;
      const line = spec.first ? "first in the league" : spec.rank !== undefined && spec.rank !== null ? `bigger than ${R(spec.rank)}% of the league's ${sp.name}` : spec.best ? "a personal best" : "";
      const room = tl.length > 1 ? 2 : 3;
      let ls = wrap(line, cw - 10);
      if (ls.length > room && spec.rank !== undefined) ls = wrap(`bigger than ${R(spec.rank)}% of those caught`, cw - 10);
      ls.slice(0, room).forEach((l) => { text(img, l, 2 + cw / 2, y, "#5a4430", { center: true }); y += 9; });
    } else if (spec.unknown) {
      text(img, "not yet caught", 2 + cw / 2, y + 6, "#6b543c", { center: true });
    } else if (sp.desc) {
      wrap(sp.desc, cw - 10).slice(0, 5).forEach((l) => { text(img, l, 2 + cw / 2, y, "#5a4430", { center: true }); y += 9; });
    }
    if (spec.hero) text(img, `${spec.hero}${spec.day ? ", day " + spec.day : ""}`, 2 + cw / 2, ch - 3, "#8a7458", { center: true });
    if (gold) { for (const [x, yy] of [[4, 4], [cw - 1, 4], [4, ch - 1], [cw - 1, ch - 1]]) star(img, x, yy, "#fff6c8", 2); tag(img, lg ? "LEGEND" : "RARE", 2 + cw / 2, -1, lg ? "legend" : "rare"); }
    return img;
  }

  // ---------- a trophy plaque: the fish on walnut, a brass plate ----------
  const WALNUT = K.R(["#1e1008", "#2e180c", "#3e2212", "#52301a", "#663e22", "#7a4c2a"]);
  function plaque(spec) {
    spec = spec || {};
    const sp = species(spec.species), lg = spec.legend ? (typeof spec.legend === "object" ? spec.legend : legendOf(spec.legend)) : null;
    const pw = 76, ph = 50, img = new Img(pw, ph), cx = pw / 2, cy = 21, rx = 36, ry = 18;
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d > 1) continue;
      const grain = Math.sin((y + fbm(x / 9, y / 3, 5) * 6) * 1.3) * 0.08, bev = d > 0.86 ? ((y < cy ? 0.25 : -0.25) + (x < cx ? 0.1 : -0.1)) : 0;
      img.px(x, y, K.pick(WALNUT, 0.5 + grain + bev - (y / ph) * 0.15 + (fbm(x / 4, y / 14, 6) - 0.5) * 0.3, x, y));
    }
    K.outline(img, "#120804");
    const fs = fit(sp, 62, 26, { legend: lg && lg.id });
    for (let y = 0; y < fs.h; y++) for (let x = 0; x < fs.w; x++) if (fs.d[(y * fs.w + x) * 4 + 3]) img.px(R(cx - fs.w / 2) + x + 1, R(cy - fs.h / 2) + y + 2, "#0e0604", 0.6);
    img.paste(fs, R(cx - fs.w / 2), R(cy - fs.h / 2));
    const label = spec.label || (spec.size ? `${R(spec.size)} cm` : lg ? lg.name : sp.name);
    const tw = Math.min(pw - 6, textWidth(label) + 8), px0 = R(cx - tw / 2), py0 = ph - 12;
    const brass = lg ? ["#5a3a0a", "#e8b84a", "#ffe08a", "#fff6c8"] : ["#4a3010", "#b8862a", "#d8a848", "#f6dc8a"];
    img.rect(px0, py0, tw, 10, brass[1]);
    for (let i = 0; i < tw; i++) { img.px(px0 + i, py0, brass[3]); img.px(px0 + i, py0 + 9, brass[0]); }
    img.px(px0 + 1, py0 + 4, brass[0]); img.px(px0 + tw - 2, py0 + 4, brass[0]);
    text(img, label, cx, py0 + 8, "#2a1808", { center: true });
    if (lg) for (const [x, y] of [[8, 8], [pw - 9, 10], [pw - 14, ph - 14]]) star(img, x, y, "#fff6c8", 2);
    return img;
  }

  // ---------- painting kit for the backdrops ----------
  const RAMP = {
    stone: K.R(["#3a342e", "#544c44", "#6e665a", "#8a8072", "#a69a88", "#c0b4a0"]),
    warm: K.R(["#3e3226", "#58483a", "#76624c", "#947e62", "#b09a7a", "#cab494"]),
    wood: K.R(["#24140a", "#3a2412", "#54361c", "#6e4a28", "#8a6236", "#a87c48"]),
    grass: K.R(["#1e2c14", "#2e421c", "#425a24", "#5a742e", "#74903a", "#94aa50"]),
    leaf: K.R(["#142212", "#1c3018", "#26401e", "#345424", "#46682c", "#5e8238", "#7c9a48"]),
    mud: K.R(["#1e160e", "#2e2216", "#40301e", "#544028", "#6a5234"]),
    snow: K.R(["#8a9ca8", "#a8b8c2", "#c4d0d6", "#dce4e6", "#f0f4f2", "#ffffff"]),
    rock: K.R(["#1a1614", "#26201c", "#342c26", "#443a32", "#564a40", "#6a5c50"]),
    slate: K.R(["#1e2226", "#2c3236", "#3c4448", "#4e585c", "#626c70"]),
    thatch: K.R(["#4a3418", "#6a4c22", "#8a6a30", "#a8883e", "#c4a456"]),
    tile: K.R(["#4a1a10", "#6a2616", "#8a3420", "#a8462a", "#c25a34"]),
    white: K.R(["#8a8478", "#aaa496", "#c8c2b2", "#e2dccc", "#f4f0e4"]),
    chalk: K.R(["#5a5448", "#77705f", "#958c78", "#b0a890", "#cac2a8", "#e0d8c0"]),
    reed: K.R(["#2a2a14", "#3e3e1c", "#565426", "#706c30", "#8c843e"]),
  };
  const pk = (ramp, t, x, y, d) => K.pick(ramp, clamp(t, 0, 1), x, y, d);
  function grad(img, x0, y0, x1, y1, cols) {
    const cs = cols.map(C), n = cs.length - 1;
    for (let y = Math.max(0, y0); y < Math.min(img.h, y1); y++) {
      const f = ((y - y0) / Math.max(1, y1 - y0 - 1)) * n, k = Math.min(n - 1, Math.floor(f)), t = f - k;
      for (let x = Math.max(0, x0); x < Math.min(img.w, x1); x++) img.px(x, y, bay(x, y) < t ? cs[Math.min(n, k + 1)] : cs[k]);
    }
  }
  function poly(img, pts, col) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(img.h - 1, Math.ceil(y1)); y++) {
      const xs = [], yy = y + 0.5;
      for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) xs.push(ax + ((yy - ay) / (by - ay)) * (bx - ax)); }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.max(0, R(xs[i])); x < Math.min(img.w, R(xs[i + 1])); x++) img.px(x, y, typeof col === "function" ? col(x, y) : col);
    }
  }
  function ell(img, cx, cy, rx, ry, col) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) <= 1) img.px(x, y, typeof col === "function" ? col(x, y) : col);
  }
  // foliage: a lumpy mass lit from the upper left, leaf clumps picked out
  function blob(img, cx, cy, rx, ry, ramp, seed, lift) {
    ramp = ramp || RAMP.leaf; lift = lift || 0;
    for (let y = Math.floor(cy - ry * 1.3); y <= cy + ry * 1.2; y++) for (let x = Math.floor(cx - rx * 1.3); x <= cx + rx * 1.3; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, n = fbm(x / 5, y / 4, seed, 3);
      if (Math.hypot(nx, ny) > 0.78 + n * 0.5) continue;
      const clump = fbm(x / 2.6, y / 2.2, seed + 5, 2);
      img.px(x, y, pk(ramp, 0.45 - nx * 0.22 - ny * 0.3 + (clump - 0.5) * 0.7 + lift, x, y));
    }
  }
  function pine(img, x, by, h, ramp, snow) {
    ramp = ramp || RAMP.leaf;
    img.rect(x, by - 3, 1, 3, "#3a2412");
    for (let j = 0; j < h; j++) {
      const t = j / h, w = Math.max(0, (1 - t) * h * 0.36 + (j % 4 === 0 ? 1 : 0));
      for (let i = -Math.floor(w); i <= w; i++) {
        let c = pk(ramp, 0.25 + (i < 0 ? 0.25 : 0) - t * 0.05 + (h2(x + i, by - j, 3) - 0.5) * 0.3, x + i, by - j);
        if (snow && (j % 4 === 0 || j % 4 === 1 && Math.abs(i) < w - 1) && h2(x + i, j, 9) < 0.8) c = pk(RAMP.snow, 0.8 - (i > 0 ? 0.2 : 0), x + i, by - j);
        img.px(x + i, by - 3 - j, c);
      }
    }
  }
  function masonry(img, x0, y0, w, h, ramp, seed, o) {
    o = o || {};
    const bh = o.bh || 4, bw = o.bw || 7;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (o.mask && !o.mask(x, y)) continue;
      const row = Math.floor((y - y0) / bh), off = row % 2 ? Math.floor(bw / 2) : 0, col = Math.floor((x - x0 + off) / bw);
      const jy = (y - y0) % bh === bh - 1, jx = (x - x0 + off) % bw === 0;
      const v = (o.base || 0.55) + (h2(col, row, seed) - 0.5) * 0.3 + (fbm(x / 3, y / 3, seed + 1) - 0.5) * 0.25 - (o.shade ? o.shade(x, y) : 0);
      img.px(x, y, jy || jx ? pk(ramp, v - 0.35, x, y) : (y - y0) % bh === 0 ? pk(ramp, v + 0.12, x, y) : pk(ramp, v, x, y));
    }
  }
  function planks(img, x0, y0, w, h, ramp, seed) {
    ramp = ramp || RAMP.wood;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const row = Math.floor((y - y0) / 2), seam = (x - x0 + row * 5) % 13 === 0;
      img.px(x, y, pk(ramp, (y === y0 ? 0.78 : 0.5) + (h2(row, Math.floor((x + row * 5) / 13), seed) - 0.5) * 0.25 - (seam ? 0.3 : 0) - ((y - y0) / h) * 0.2, x, y));
    }
  }
  function post(img, x, y0, y1, w, ramp) {
    ramp = ramp || RAMP.wood;
    for (let y = y0; y < y1; y++) for (let i = 0; i < w; i++) img.px(x + i, y, pk(ramp, i === 0 ? 0.62 : i === w - 1 ? 0.18 : 0.42, x + i, y));
  }
  function reeds(img, x, by, n, h, seed, ramp) {
    ramp = ramp || RAMP.reed;
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const xx = x + Math.floor(r() * n * 1.6), hh = h * (0.5 + r() * 0.6), lean = (r() - 0.5) * 0.25;
      for (let j = 0; j < hh; j++) img.px(xx + R(j * lean), by - j, pk(ramp, 0.3 + (j / hh) * 0.5, xx, by - j));
      if (r() < 0.45) { img.rect(xx + R(hh * lean), by - R(hh) - 3, 1, 4, "#5a3a1a"); img.px(xx + R(hh * lean), by - R(hh) - 4, "#3a2410"); }
    }
  }
  function house(img, E, x, by, w, h, o) {
    o = o || {};
    const wall = o.wall || RAMP.white, roof = o.roof || RAMP.slate, rh = o.rh || R(w * 0.45);
    for (let y = by - h; y < by; y++) for (let i = 0; i < w; i++) img.px(x + i, y, pk(wall, (o.wv || 0.6) - (i > w - 3 ? 0.2 : 0) + (fbm((x + i) / 3, y / 3, 4) - 0.5) * 0.25, x + i, y));
    if (o.timber) { for (let y = by - h; y < by; y++) { img.px(x, y, "#1e140c"); img.px(x + w - 1, y, "#1e140c"); } for (let i = 0; i < w; i++) { img.px(x + i, by - h, "#1e140c"); img.px(x + i, by - R(h / 2), "#1e140c"); } }
    for (let j = 0; j < rh; j++) { const ins = R((j / rh) * (w / 2 + 1)); for (let i = ins - 1; i < w - ins + 1; i++) { let c = pk(roof, 0.55 - (i > w / 2 ? 0.2 : 0) + ((rh - j) % 3 === 0 ? -0.15 : 0), x + i, by - h - j); if (o.snow && j > rh - 3 - (h2(i, x, 4) < 0.5 ? 1 : 0)) c = pk(RAMP.snow, 0.85, x + i, by - h - j); if (o.snow && j < 2) c = pk(RAMP.snow, 0.8, x + i, by - h - j); img.px(x + i, by - h - j - 1, c); } }
    if (o.chimney) img.rect(x + w - 5, by - h - rh + 1, 3, R(rh / 2) + 1, pk(RAMP.stone, 0.4, 0, 0));
    const wins = [];
    const nwin = Math.max(1, Math.floor(w / 8));
    for (let k = 0; k < nwin; k++) { const wx = x + 2 + R((k + 0.5) * (w - 4) / nwin) - 1, wy = by - h + 3; img.rect(wx, wy, 2, 3, "#1a1612"); wins.push([wx, wy, 2, 3]); }
    if (o.door !== false) img.rect(x + R(w / 2) - 1, by - 5, 3, 5, "#2a1a10");
    if (o.lit && E) for (const [wx, wy, ww, wh] of wins) { E.rect(wx, wy, ww, wh, "#ffcf6a"); E.lamps.push([wx + 1, wy + 1, 5]); }
    return wins;
  }
  function stonesBed(img, y0, y1, ramp, seed, n) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = y0 + r() * (y1 - y0), rx = 2 + r() * 4, ry = 1 + r() * 2;
      ell(img, x, y, rx, ry, (xx, yy) => pk(ramp, 0.6 - ((yy - y) / ry) * 0.3 - ((xx - x) / rx) * 0.15, xx, yy));
    }
  }

  // ---------- the sky: time of day, weather, sun and moon, clouds ----------
  const SKIES = {
    day: ["#6a9ac0", "#9ec0d2", "#d6e2d4"], morning: ["#7ea4c6", "#c8c8c0", "#f2d2a6"], dusk: ["#5e7290", "#d0905a", "#f2c678"], night: ["#060a16", "#0e1828", "#1c2a3e"],
    cloudy: ["#8896a0", "#a8b2b4", "#c6cac4"], rain: ["#5c6a74", "#7a868c", "#9aa2a2"], storm: ["#242a32", "#363e46", "#4e565a"], fog: ["#b0b4ae", "#c4c6be", "#d2d2c8"],
    snow: ["#9aa8b2", "#bac4ca", "#d6dcdc"], heat: ["#8eb4c8", "#e4d8ac", "#f6e2b2"],
  };
  function skyCols(tod, wx) {
    let c = (SKIES[tod] || SKIES.day).map(C);
    if (wx && wx !== "clear" && SKIES[wx]) {
      const wc = SKIES[wx].map(C), f = tod === "night" ? 0.18 : wx === "heat" ? 0.5 : tod === "dusk" ? 0.55 : 0.85;
      c = c.map((x, i) => mix(x, tod === "night" ? mix(wc[i], "#000000", 0.75) : wc[i], f));
    }
    return c;
  }
  function sky(img, E, ctx, y1) {
    const cs = skyCols(ctx.tod, ctx.wx);
    grad(img, 0, 0, W, y1, [cs[0], cs[1], cs[2], cs[2]]);
    const r = rng(ctx.seed + 3), clear = !ctx.wx || ctx.wx === "clear" || ctx.wx === "heat" || ctx.wx === "cloudy";
    if (ctx.tod === "night") {
      if (clear || ctx.wx === "snow") for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * y1 * 0.8, b = r(); img.px(x, y, b > 0.9 ? "#fff6e0" : b > 0.6 ? "#a8b8d0" : "#56667c"); }
      if (ctx.wx !== "storm" && ctx.wx !== "rain" && ctx.wx !== "fog") {
        const mx = 190 + R(r() * 30), my = 18;
        glow(img, mx, my, 14, "#c8d8f0", 0.22);
        for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 25 && (x + 2) * (x + 2) + (y - 1) * (y - 1) > 18) img.px(mx + x, my + y, x + y < 0 ? "#fff8e4" : "#d8d0bc");
      }
    } else if (clear) {
      const sx = ctx.tod === "dusk" ? 196 : ctx.tod === "morning" ? 40 + R(r() * 30) : 170 + R(r() * 40), sy = ctx.tod === "dusk" ? y1 - 16 : ctx.tod === "morning" ? y1 - 26 : 20, sr = ctx.tod === "dusk" ? 9 : 6;
      const sc = ctx.tod === "dusk" ? "#ffd890" : ctx.wx === "heat" ? "#fff4c8" : "#fff8dc";
      glow(img, sx, sy, sr * 3.2, sc, ctx.wx === "heat" ? 0.4 : 0.25);
      ell(img, sx, sy, sr, sr, (x, y) => (y > sy + sr * 0.4 && ctx.tod === "dusk" ? "#f6c070" : sc));
    }
    const nc = { clear: 2, heat: 0, cloudy: 7, rain: 9, storm: 10, fog: 0, snow: 7 }[ctx.wx || "clear"] || 0;
    for (let i = 0; i < nc; i++) {
      const cx = r() * W, cy = 6 + r() * y1 * 0.55, rx = 14 + r() * 26, ry = 4 + r() * 5;
      const top = mix(cs[2], "#ffffff", ctx.tod === "night" ? 0.05 : 0.35), bot = mix(cs[1], "#000000", ctx.wx === "storm" ? 0.35 : 0.12);
      for (let y = Math.floor(cy - ry * 1.4); y <= cy + ry; y++) for (let x = Math.floor(cx - rx * 1.3); x <= cx + rx * 1.3; x++) {
        const n = fbm(x / 9, y / 4, ctx.seed + i, 3), d = Math.hypot((x - cx) / rx, (y - cy) / (ry * (y < cy ? 1.4 : 0.8)));
        if (d > 0.7 + n * 0.5) continue;
        img.px(x, y, dith(top, bot, clamp((y - cy + ry) / (ry * 2) + (n - 0.5) * 0.5, 0, 1), x, y));
      }
    }
    return cs;
  }
  // the whole painted layer graded to the hour and the weather; the lit windows and lamps go on after, ungraded
  function grade(img, ctx) {
    const tod = ctx.tod, wx = ctx.wx || "clear", d = img.d, cave = ctx.kind === "cave";
    const night = !cave && tod === "night", dusk = !cave && tod === "dusk", morn = !cave && tod === "morning";
    const des = cave ? 0 : { cloudy: 0.15, rain: 0.3, storm: 0.45, fog: 0.35, snow: 0.2 }[wx] || 0, dk = cave ? 1 : { rain: 0.86, storm: 0.66, cloudy: 0.95, snow: 0.97 }[wx] || 1;
    const fogC = C("#c4c6bc");
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (des) { const l = r * 0.3 + g * 0.59 + b * 0.11; r = lerp(r, l, des); g = lerp(g, l, des); b = lerp(b, l * 1.04, des); }
      r *= dk; g *= dk; b *= dk;
      if (!cave && wx === "fog") { const y = ((i / 4) / W) | 0, f = 0.18 + 0.2 * (1 - y / H); r = lerp(r, fogC[0], f); g = lerp(g, fogC[1], f); b = lerp(b, fogC[2], f); }
      if (!cave && wx === "heat") { r *= 1.06; b *= 0.9; }
      if (night) { r = r * 0.28 + 4; g = g * 0.34 + 8; b = b * 0.5 + 18; }
      else if (dusk) { r = lerp(r, r * 1.04, 0.6); g = lerp(g, g * 0.8, 0.6); b = lerp(b, b * 0.62, 0.6); }
      else if (morn) { g *= 0.97; b *= 0.92; }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
  }

  // ---------- water, seen side on (A: the surface only) and as a tank (D: you can see in) ----------
  const WATERS_PAL = {
    river: ["#5e8e9a", "#3e6e7c", "#2a5060", "#1a3644"], lake: ["#6e8274", "#4e6862", "#364c4c", "#22323a"], sea: ["#4e7e92", "#305e74", "#204658", "#122c3a"],
    ice: ["#3e5e70", "#2c4858", "#1e3442", "#122230"], swamp: ["#5a6034", "#444a26", "#32381a", "#20260f"], cave: ["#2e6a6a", "#1e4c50", "#143438", "#0a2026"],
    ashfen: ["#2e3226", "#22261c", "#181c14", "#0e100c"], sunken_vault: ["#3a9a86", "#2a7a6c", "#1c5a52", "#103a38"], collapsed_mine: ["#2a5a5c", "#1c4246", "#122e32", "#0a1c20"],
  };
  function surface(img, x0, x1, wl, cols, skyC, seed) {
    const cs = cols.map(C);
    for (let y = wl; y < H; y++) {
      const t = (y - wl) / (H - wl);
      for (let x = x0; x < x1; x++) {
        let c = K.pick(cs, t * 0.95 + (fbm(x / 30, y / 4, seed) - 0.5) * 0.25, x, y);
        if (y < wl + 6) c = mix(c, skyC, 0.35 * (1 - (y - wl) / 6));
        img.px(x, y, c);
      }
    }
    const r = rng(seed + 9);
    for (let i = 0; i < 46; i++) { const x = r() * W, y = wl + 2 + Math.pow(r(), 1.5) * (H - wl - 3), l = 2 + r() * 8 * (0.4 + (y - wl) / (H - wl)); if (x < x0 || x > x1) continue; for (let k = 0; k < l; k++) img.px(x + k, y, mix(cs[0], "#ffffff", 0.22), 0.7); }
    for (let x = x0; x < x1; x++) img.px(x, wl, mix(cs[0], "#ffffff", 0.35));
  }
  function tank(img, wl, cols, seed, o) {
    o = o || {};
    const cs = cols.map(C), bed = H - 9;
    for (let y = wl; y < H; y++) for (let x = 0; x < W; x++) {
      const t = (y - wl) / (bed - wl);
      img.px(x, y, K.pick(cs, clamp(t, 0, 1) * 0.98 + (fbm(x / 24, y / 10, seed) - 0.5) * 0.18, x, y));
    }
    for (let x = 0; x < W; x++) { img.px(x, wl, mix(cs[0], "#ffffff", 0.45)); img.px(x, wl + 1, mix(cs[0], "#ffffff", 0.18)); }
    const bedR = o.bed || RAMP.mud;
    for (let x = 0; x < W; x++) {
      const top = bed + R((fbm(x / 16, 3, seed + 2) - 0.5) * 5);
      for (let y = top; y < H; y++) img.px(x, y, pk(bedR, 0.55 - (y - top) * 0.06 + (h2(x, y, 5) - 0.5) * 0.3, x, y));
    }
    stonesBed(img, bed - 1, H - 2, o.stone || RAMP.stone, seed + 4, 14);
    if (o.weeds !== false) {
      const r = rng(seed + 6), wr = o.weedRamp || RAMP.leaf;
      for (let i = 0; i < 16; i++) { const x = 4 + r() * (W - 8), hh = 5 + r() * 12; for (let j = 0; j < hh; j++) img.px(x + R(Math.sin(j * 0.6 + i) * 1.2), bed + 1 - j, pk(wr, 0.25 + (j / hh) * 0.5, x, j)); }
    }
    // the glass: two long glints down the front of the tank
    for (const [gx, gw] of [[14, 2], [20, 1]]) for (let y = wl + 4; y < bed - 6; y++) for (let k = 0; k < gw; k++) if ((y + k) % 9 < 6) img.px(gx + k + R((y - wl) * 0.25), y, "#ffffff", 0.08);
  }

  // ---------- the twelve waters and the roadside stream ----------
  // each draws its day layer and returns where the hero stands, where the float sits and where the crew can watch from
  const FRAMING = { lake: "D", cave: "D", ice: "D", river: "A", sea: "A", swamp: "A" };
  function framing(rec) {
    if (rec && (rec.framing === "A" || rec.framing === "D")) return rec.framing;
    const w = rec && rec.water, kind = (rec && rec.kind) || (w && ((S().waters || {})[w] || {}).kind) || "river";
    return (S().framing || FRAMING)[kind] || FRAMING[kind] || "A";
  }
  function farHills(img, y0, amp, ramp, seed, f) {
    for (let x = 0; x < W; x++) { const top = R(y0 - amp * fbm(x / (f || 40), 0.5, seed, 3)); for (let y = top; y < y0 + 30; y++) img.px(x, y, pk(ramp, 0.5 - (y - top) * 0.01 + (fbm(x / 6, y / 6, seed + 1) - 0.5) * 0.2, x, y)); }
  }
  function treeLine(img, y0, y1, ramp, seed, x0, x1) {
    x0 = x0 || 0; x1 = x1 === undefined ? W : x1;
    for (let x = x0; x < x1; x++) { const top = R(y0 - 8 * fbm(x / 7, 1.5, seed, 3) - 4 * fbm(x / 3, 2.5, seed + 1, 2)); for (let y = top; y < y1; y++) img.px(x, y, pk(ramp, 0.55 - (y - top) * 0.04 + (fbm(x / 3, y / 3, seed + 2) - 0.5) * 0.35, x, y)); }
  }
  const tint = (ramp, col, t) => ramp.map((c) => mix(c, col, t));

  const SCENES = {
    carrbridge(L, E, ctx) {
      const wl = 104, haze = ctx.haze;
      farHills(L, 86, 16, tint(RAMP.grass, haze, 0.55), 11, 50);
      treeLine(L, 96, wl, tint(RAMP.leaf, haze, 0.3), 12);
      for (const [x, w, h] of [[170, 14, 8], [186, 12, 10], [200, 16, 7], [218, 12, 9]]) house(L, E, x, 96, w, h, { wall: tint(RAMP.white, haze, 0.3), roof: tint(RAMP.tile, haze, 0.3), lit: ctx.lit, door: false });
      surface(L, 0, W, wl, WATERS_PAL.river, ctx.skyC[2], 21);
      const deck = 70, x1 = 150, arches = [[26, 17], [75, 19], [124, 17]];
      const inArch = (x, y) => arches.some(([cx, rx]) => Math.hypot((x - cx) / rx, (y - wl - 2) / 20) < 1);
      for (const [cx, rx] of arches) for (let x = cx - rx; x <= cx + rx; x++) { const y = R(wl + 3 + Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)) * 8); L.px(x, y, mix(WATERS_PAL.river[2], "#000000", 0.2)); L.px(x, y + 1, mix(WATERS_PAL.river[1], "#000000", 0.1)); }
      masonry(L, 0, deck, x1, wl - deck + 1, RAMP.warm, 31, { bh: 4, bw: 8, mask: (x, y) => !inArch(x, y), shade: (x, y) => (y > deck + 6 ? 0.08 : 0) });
      for (const [cx, rx] of arches) for (let x = cx - rx; x <= cx + rx; x++) for (let y = wl - 22; y < wl + 1; y++) if (inArch(x, y)) L.px(x, y, "#0e1a1c", inArch(x, y - 3) ? 0.42 : 0.7);
      for (const px of [0, 50, 99, 143]) poly(L, [[px, wl + 1], [px + 7, wl - 6], [px + 14, wl + 1]], (x, y) => pk(RAMP.warm, 0.4 + (x < px + 7 ? 0.15 : -0.1), x, y));
      masonry(L, 0, deck - 9, x1, 8, RAMP.warm, 32, { bh: 4, bw: 10, base: 0.6 });
      for (let x = 0; x < x1; x++) { L.px(x, deck - 10, pk(RAMP.warm, 0.85, x, 0)); L.px(x, deck - 9, pk(RAMP.warm, 0.7, x, 1)); L.px(x, deck, pk(RAMP.warm, 0.85, x, 2)); }
      for (let y = deck - 9; y < wl; y++) L.px(x1 - 1, y, pk(RAMP.warm, 0.2, 0, y));
      house(L, E, 4, deck - 9, 24, 18, { wall: RAMP.warm, roof: RAMP.tile, rh: 10, chimney: true, lit: ctx.lit, wv: 0.7 });
      for (let i = 0; i < 18; i++) L.px(34 + i, deck - 14 - R(i * 0.5), i % 6 < 3 ? "#c83a2a" : "#f0e8d8");
      L.rect(33, deck - 15, 2, 6, "#3a2412");
      return { perch: { x: 82, y: deck }, bob: [200, wl + 2], crew: [[60, deck], [106, deck]], wl, wx0: 0, flag: [16, deck - 38] };
    },
    kingsroad(L, E, ctx) {
      const wl = 106, haze = ctx.haze;
      farHills(L, 80, 20, tint(RAMP.grass, haze, 0.45), 41, 60);
      farHills(L, 94, 10, tint(RAMP.grass, haze, 0.2), 42, 30);
      poly(L, [[150, 70], [158, 70], [196, 100], [226, wl], [190, wl], [166, 96]], (x, y) => pk(RAMP.chalk, 0.55 + (fbm(x / 4, y / 3, 3) - 0.5) * 0.3, x, y));
      treeLine(L, 92, 100, tint(RAMP.leaf, haze, 0.2), 43, 0, 140);
      for (const [x, s] of [[30, 1], [96, 0.8], [124, 1.1]]) blob(L, x, 80, 12 * s, 11 * s, tint(RAMP.leaf, haze, 0.15), 44 + x);
      L.rect(212, 88, 2, 10, "#4a3220"); L.rect(206, 88, 14, 4, "#8a6236"); L.rect(206, 88, 14, 1, "#a87c48");
      for (const [x, y] of [[176, 86]]) { L.rect(x, y, 16, 6, "#6e4a28"); L.rect(x - 2, y - 1, 20, 2, "#54361c"); ell(L, x + 3, y + 7, 2.5, 2.5, "#3a2412"); ell(L, x + 13, y + 7, 2.5, 2.5, "#3a2412"); }
      surface(L, 0, W, wl, ["#7aa6aa", "#5a8a90", "#3e6a76", "#2a4e5c"], ctx.skyC[2], 45);
      for (const [x, y, rx] of [[160, wl + 4, 5], [178, wl + 6, 6], [198, wl + 4, 5], [216, wl + 7, 6], [234, wl + 5, 5]]) { ell(L, x, y, rx, 2.5, (xx, yy) => pk(RAMP.stone, 0.7 - (yy - y) * 0.15, xx, yy)); for (let k = -rx - 2; k <= rx + 2; k++) if (Math.abs(k) > rx - 1) L.px(x + k, y + 1, "#e8f0ec", 0.6); }
      const deck = 96;
      for (const px of [6, 44, 82, 118]) post(L, px, deck - 12, H, 3);
      planks(L, 0, deck, 124, 3, RAMP.wood, 46);
      for (let x = 0; x < 124; x++) L.px(x, deck - 9, pk(RAMP.wood, 0.6, x, 0));
      for (let x = 0; x < 124; x++) L.px(x, deck + 3, "#1a0e06", 0.5);
      return { perch: { x: 66, y: deck }, bob: [146, wl + 2], crew: [[40, deck], [92, deck]], wl };
    },
    saltcliffs(L, E, ctx) {
      const hz = 72, haze = ctx.haze;
      for (let y = hz; y < H; y++) { const t = (y - hz) / (H - hz); for (let x = 0; x < W; x++) L.px(x, y, mix(K.pick(WATERS_PAL.sea.map(C), t * 0.9 + (fbm(x / 26, y / 3, 51) - 0.5) * 0.25, x, y), ctx.skyC[2], 0.3 * (1 - t))); }
      for (let x = 0; x < W; x++) L.px(x, hz, mix(ctx.skyC[2], "#ffffff", 0.2));
      const r = rng(52);
      for (let i = 0; i < 70; i++) { const y = hz + 2 + Math.pow(r(), 1.3) * (H - hz - 2), x = r() * W, l = 2 + ((y - hz) / (H - hz)) * 10 * r(); for (let k = 0; k < l; k++) L.px(x + k, y, "#d8e6e8", 0.45); }
      poly(L, [[178, hz + 1], [200, hz - 7], [226, hz - 9], [240, hz - 4], [240, hz + 1]], tint(RAMP.rock, haze, 0.6)[3]);
      const top = 50;
      const edge = (y) => 84 + (y - top) * 0.3 + (fbm(1, y / 6, 53) - 0.5) * 14;
      for (let y = top; y < H; y++) { const ex = edge(y); for (let x = 0; x < ex; x++) { const strata = Math.sin(y * 0.55 + fbm(x / 10, y / 4, 54) * 3) * 0.12; L.px(x, y, pk(RAMP.chalk, 0.55 + strata - (x > ex - 4 ? 0.25 : 0) + (x / ex) * 0.1 - (y - top) * 0.004, x, y)); } }
      for (let x = 0; x < 90; x++) for (let k = 0; k < 4 - (x > 80 ? 2 : 0); k++) L.px(x, top + k - (h2(x, 1, 5) < 0.3 ? 1 : 0), pk(RAMP.grass, 0.7 - k * 0.15, x, k));
      for (let x = 0; x < 86; x += 3) if (h2(x, 2, 6) < 0.5) L.px(x, top - 2, pk(RAMP.grass, 0.8, x, 0));
      for (let i = 0; i < 7; i++) { const x = 96 + i * 9 + r() * 4, y = 130 + r() * 14; ell(L, x, y, 5 + r() * 4, 3 + r() * 2, (xx, yy) => pk(RAMP.rock, 0.6 - (yy - y) * 0.12, xx, yy)); }
      return { perch: { x: 56, y: top }, bob: [190, 118], crew: [[30, top], [78, top]], wl: hz, wx0: 122, passY: 116, foam: [[100, 128], [114, 140], [130, 136]] };
    },
    saltmarrow(L, E, ctx) {
      const hz = 78, haze = ctx.haze, wl = hz;
      for (let y = hz; y < H; y++) { const t = (y - hz) / (H - hz); for (let x = 0; x < W; x++) L.px(x, y, mix(K.pick(WATERS_PAL.sea.map(C), t * 0.85 + (fbm(x / 26, y / 3, 61) - 0.5) * 0.25, x, y), ctx.skyC[2], 0.3 * (1 - t))); }
      for (let x = 0; x < W; x++) L.px(x, hz, mix(ctx.skyC[2], "#ffffff", 0.2));
      poly(L, [[196, hz + 1], [206, hz - 10], [236, hz - 12], [240, hz - 10], [240, hz + 1]], tint(RAMP.grass, haze, 0.4)[2]);
      for (let y = hz - 44; y < hz - 10; y++) { const w = 3 + R((y - (hz - 44)) * 0.08); for (let i = -w; i <= w; i++) L.px(222 + i, y, Math.floor((y - hz) / 6) % 2 ? pk(RAMP.white, 0.8 - (i > 0 ? 0.3 : 0), i, y) : pk(RAMP.tile, 0.6 - (i > 0 ? 0.2 : 0), i, y)); }
      L.rect(219, hz - 50, 7, 6, "#3a2a20"); L.rect(220, hz - 49, 5, 4, "#f6e6a8"); L.rect(218, hz - 52, 9, 2, "#2a1a10");
      E.lamps.push([222, hz - 47, ctx.lit ? 12 : 0]); if (ctx.lit) E.rect(220, hz - 49, 5, 4, "#fff2b0");
      const r = rng(62);
      for (let i = 0; i < 9; i++) { const x = i * 15 - 4, w = 12 + R(r() * 4), h = 12 + R(r() * 10); house(L, E, x, 90, w, h, { wall: RAMP.white, roof: RAMP.slate, rh: 7 + R(r() * 3), chimney: r() < 0.5, lit: ctx.lit && r() < 0.6, door: false, wv: 0.75 + r() * 0.1 }); }
      for (let i = 0; i < 50; i++) { const y = hz + 2 + Math.pow(r(), 1.3) * (H - hz - 2), x = 130 + r() * 110, l = 2 + r() * 6; for (let k = 0; k < l; k++) L.px(x + k, y, "#d8e6e8", 0.4); }
      const top = 92;
      masonry(L, 0, top, 132, H - top, RAMP.stone, 63, { bh: 6, bw: 12, base: 0.58, shade: (x, y) => (y - top) * 0.006 });
      for (let x = 0; x < 132; x++) { L.px(x, top, pk(RAMP.stone, 0.9, x, 0)); L.px(x, top + 1, pk(RAMP.stone, 0.75, x, 0)); }
      for (let y = top; y < H; y++) L.px(131, y, pk(RAMP.stone, 0.25, 0, y));
      for (let y = 118; y < H; y++) for (let x = 0; x < 132; x++) L.px(x, y, "#1e2a1a", clamp((y - 118) / 30 + (fbm(x / 6, y / 4, 64) - 0.5) * 0.6, 0, 0.75));
      for (const bx of [12, 118]) { L.rect(bx, top - 5, 4, 5, "#2a2622"); L.rect(bx - 1, top - 6, 6, 2, "#3a3632"); L.px(bx + 1, top - 5, "#56504a"); }
      for (let k = 0; k < 8; k++) L.px(18 + k, top - 1 - (k % 2), "#a88c5a");
      return { perch: { x: 96, y: top }, bob: [206, 112], crew: [[72, top], [50, top]], wl, wx0: 134, passY: 110, boat: [150, 104], oldmen: [[26, top], [40, top]] };
    },
    bleakmarsh(L, E, ctx) {
      const wl = 104, haze = ctx.haze;
      farHills(L, 92, 6, tint(RAMP.reed, haze, 0.55), 71, 30);
      const r = rng(72);
      for (const [x, h] of [[132, 34], [168, 26], [210, 40]]) { const c = mix("#2a2416", haze, 0.45); for (let y = 92 - h; y < 92; y++) L.px(x, y, c); L.px(x + 1, 92 - h * 0.6, c); L.line(x, 92 - h * 0.7, x + 6, 92 - h * 0.85, c); L.line(x, 92 - h * 0.5, x - 5, 92 - h * 0.62, c); }
      for (let x = 0; x < W; x += 2) { const hh = 4 + fbm(x / 8, 4, 73) * 10; for (let j = 0; j < hh; j++) L.px(x + (j % 3 === 0 ? 1 : 0), 101 - j, pk(tint(RAMP.reed, haze, 0.25), 0.3 + j / hh * 0.5, x, j)); }
      surface(L, 0, W, wl, WATERS_PAL.swamp, ctx.skyC[2], 74);
      for (let i = 0; i < 6; i++) { const x = 104 + r() * 120, y = wl + 6 + r() * 30; ell(L, x, y, 4 + r() * 3, 1.2, (xx, yy) => pk(RAMP.grass, 0.4 + h2(xx, yy, 2) * 0.3, xx, yy)); }
      reeds(L, 204, wl + 6, 14, 26, 75); reeds(L, 120, wl + 14, 6, 16, 76);
      const top = 98;
      poly(L, [[0, top], [80, top], [92, top + 4], [100, wl + 2], [104, H], [0, H]], (x, y) => pk(RAMP.mud, 0.55 - (y - top) * 0.008 + (fbm(x / 4, y / 3, 77) - 0.5) * 0.35, x, y));
      for (let x = 0; x < 92; x++) if (h2(x, 3, 8) < 0.6) for (let j = 0; j < 1 + R(h2(x, 4, 8) * 4); j++) L.px(x, top - j, pk(RAMP.grass, 0.35 + j * 0.1, x, j));
      const tx = 14;
      for (let y = 38; y < top; y++) { const w = y > top - 6 ? 4 : 2; for (let i = 0; i < w; i++) L.px(tx + i - (y > top - 6 ? 1 : 0), y, pk(RAMP.wood, i === 0 ? 0.35 : 0.15, i, y)); }
      for (const [y, dx, len] of [[50, 1, 14], [60, -1, 10], [44, -1, 8], [70, 1, 8]]) for (let k = 0; k < len; k++) L.px(tx + 1 + dx * k, y - R(k * 0.5), pk(RAMP.wood, 0.2, k, y));
      return { perch: { x: 62, y: top }, bob: [168, wl + 2], crew: [[38, top], [84, top - 1]], wl, wx0: 104, eyes: [214, wl - 6] };
    },
    ashfen(L, E, ctx) {
      const wl = 106, haze = ctx.haze;
      const r = rng(81);
      for (let i = 0; i < 9; i++) { const x = 84 + i * 18 + R(r() * 3), w = 16, h = 20 + R(r() * 12); house(L, E, x, 96, w, h, { wall: K.R(["#1e1812", "#2a221a", "#362c22", "#443828", "#524432"]), roof: RAMP.slate, rh: 9 + R(r() * 3), timber: true, chimney: r() < 0.6, lit: ctx.lit && r() < 0.7, door: true, wv: 0.5 }); if (i % 2 === 0) { L.rect(x + 4, 96 - h + 8, 8, 4, "#5a4a32"); L.rect(x + 6, 96 - h + 9, 4, 2, "#2a1a10"); } }
      for (let x = 70; x < W; x++) for (let y = 96; y < wl; y++) L.px(x, y, pk(RAMP.grass, 0.35 + (fbm(x / 3, y / 2, 82) - 0.5) * 0.3 - (y - 96) * 0.02, x, y));
      for (let x = 74; x < W; x += 3) { L.px(x, 92, "#141010"); L.px(x, 93, "#141010"); L.px(x, 94, "#141010"); L.px(x, 95, "#141010"); if (x % 6 === 2) L.px(x, 91, "#141010"); }
      for (let x = 74; x < W; x++) L.px(x, 93, "#141010");
      surface(L, 0, W, wl, WATERS_PAL.ashfen, ctx.skyC[2], 83);
      const top = 100;
      poly(L, [[0, top], [84, top], [94, wl], [98, H], [0, H]], (x, y) => pk(RAMP.mud, 0.5 - (y - top) * 0.01 + (fbm(x / 4, y / 3, 84) - 0.5) * 0.3, x, y));
      for (let x = 0; x < 88; x++) for (let j = 0; j < 2; j++) L.px(x, top - j, pk(RAMP.grass, 0.3 + j * 0.15, x, j));
      for (const [x, h] of [[40, 8], [52, 6]]) { L.rect(x, top - h, 5, h, pk(RAMP.stone, 0.55, 0, 0)); L.rect(x + 1, top - h - 1, 3, 1, pk(RAMP.stone, 0.6, 0, 0)); L.rect(x + 4, top - h, 1, h, pk(RAMP.stone, 0.3, 0, 0)); L.px(x + 2, top - h + 2, "#2a2622"); }
      blob(L, 14, 46, 22, 20, RAMP.leaf, 85);
      for (let y = 40; y < top; y++) for (let i = 0; i < 4; i++) L.px(10 + i, y, pk(RAMP.wood, i === 0 ? 0.4 : 0.15, i, y));
      for (let k = 0; k < 22; k++) { const x = R(-6 + k * 2.3), len = 20 + h2(k, 1, 4) * 30; for (let j = 0; j < len; j++) if ((j + k) % 5 !== 0) L.px(x + R(Math.sin(j * 0.15) * 1), 50 + j, pk(RAMP.leaf, 0.45 + (k % 3) * 0.12, x, j)); }
      return { perch: { x: 64, y: top }, bob: [170, wl + 2], crew: [[30, top], [86, top - 1]], wl, wx0: 98, row: [84, 96] };
    },
    stream(L, E, ctx) {
      const wl = 108, haze = ctx.haze, ice = ctx.kind === "ice", sw = ctx.kind === "swamp";
      const gr = ice ? RAMP.snow : RAMP.grass;
      farHills(L, 82, 18, tint(gr, haze, 0.5), 91, 50);
      farHills(L, 96, 8, tint(gr, haze, 0.15), 92, 26);
      poly(L, [[0, 96], [240, 92], [240, 95], [0, 99]], (x, y) => pk(RAMP.chalk, 0.6, x, y));
      for (const [x, s] of [[150, 1], [182, 0.7], [226, 1.2]]) { blob(L, x, 78, 13 * s, 12 * s, ice ? tint(RAMP.leaf, "#d8e0e0", 0.4) : RAMP.leaf, 93 + x); for (let y = 86; y < 97; y++) L.rect(x - 1, y, 3, 1, pk(RAMP.wood, 0.3, 0, y)); }
      L.rect(118, 88, 5, 8, pk(RAMP.stone, 0.6, 0, 0)); L.rect(119, 87, 3, 1, pk(RAMP.stone, 0.7, 0, 0)); L.px(120, 90, "#2a2622");
      for (let x = 0; x < W; x++) for (let y = 99; y < wl; y++) L.px(x, y, pk(gr, 0.45 + (fbm(x / 3, y / 2, 94) - 0.5) * 0.3, x, y));
      surface(L, 0, W, wl, ice ? ["#8aa8b4", "#6a8c9a", "#4a6c7c", "#2e4e5e"] : ["#7aa2a2", "#5a8488", "#3e646c", "#2a4652"], ctx.skyC[2], 95);
      const top = 102;
      poly(L, [[0, top], [86, top], [96, wl + 1], [102, H], [0, H]], (x, y) => pk(ice ? RAMP.snow : RAMP.grass, 0.5 - (y - top) * 0.01 + (fbm(x / 4, y / 3, 96) - 0.5) * 0.3, x, y));
      if (!ice) for (let x = 2; x < 84; x += 5) if (h2(x, 1, 3) < 0.5) L.px(x, top - 1, ["#e8d070", "#f0f0e8", "#d86a5a"][x % 3]);
      if (sw) reeds(L, 196, wl + 4, 12, 22, 97);
      return { perch: { x: 58, y: top }, bob: [160, wl + 2], crew: [[34, top], [80, top]], wl, wx0: 100 };
    },
    greenwood(L, E, ctx) {
      const wl = 66, haze = ctx.haze;
      treeLine(L, 52, wl, tint(RAMP.leaf, haze, 0.45), 101);
      for (const [x, s] of [[120, 1], [160, 0.8], [196, 1.1]]) blob(L, x, 40, 13 * s, 12 * s, tint(RAMP.leaf, haze, 0.3), 102 + x);
      blob(L, -4, 6, 44, 30, RAMP.leaf, 103); blob(L, 244, 2, 40, 26, RAMP.leaf, 104);
      for (let y = 20; y < wl; y++) for (let i = 0; i < 5; i++) L.px(226 + i, y, pk(RAMP.wood, i === 0 ? 0.4 : 0.18, i, y));
      tank(L, wl, WATERS_PAL.lake, 105);
      const deck = 60;
      for (const px of [8, 40, 72, 100]) post(L, px, deck, H - 7, 3);
      planks(L, 0, deck, 106, 3, RAMP.wood, 106);
      for (let x = 0; x < 106; x++) L.px(x, deck + 3, "#1a0e06", 0.6);
      for (const [x, y] of [[150, wl], [176, wl], [214, wl], [196, wl]]) { ell(L, x, y, 5, 1.4, (xx, yy) => pk(RAMP.grass, 0.55 + (yy < y ? 0.2 : 0), xx, yy)); L.px(x + 1, y - 1, mix(WATERS_PAL.lake[0], "#000000", 0.2)); }
      L.px(178, wl - 2, "#f4e8f0"); L.px(177, wl - 1, "#f4e8f0"); L.px(179, wl - 1, "#e8c8d8");
      return { perch: { x: 76, y: deck }, bob: [168, wl], crew: [[50, deck], [100, deck]], wl, tank: true };
    },
    thornwall(L, E, ctx) {
      const wl = 66, haze = ctx.haze;
      farHills(L, 46, 12, tint(RAMP.grass, haze, 0.5), 111, 50);
      for (let y = 40; y < wl; y++) for (let x = 0; x < W; x++) if (Math.sin(x * 0.4 + y * 2.2) > 0.8 && y > 48) L.px(x, y, mix(RAMP.thatch[3], haze, 0.4));
      treeLine(L, 56, wl, tint(RAMP.leaf, haze, 0.25), 112, 0, 170);
      masonry(L, 186, 22, 54, wl - 22 + 1, RAMP.stone, 113, { bh: 5, bw: 9, base: 0.6 });
      for (let j = 0; j < 18; j++) { const ins = R(j * 0.9); for (let x = 182 + ins; x < 244 - ins + 10; x++) L.px(x, 22 - j, pk(RAMP.thatch, 0.6 - (j % 3 === 0 ? 0.15 : 0) + (h2(x, j, 3) - 0.5) * 0.3, x, j)); }
      L.rect(204, 40, 6, 7, "#1a1612"); L.rect(222, 30, 5, 6, "#1a1612");
      if (ctx.lit) { E.rect(204, 40, 6, 7, "#ffcf6a"); E.lamps.push([207, 43, 6]); E.rect(222, 30, 5, 6, "#ffcf6a"); E.lamps.push([224, 33, 5]); }
      L.rect(172, 32, 14, 3, pk(RAMP.wood, 0.5, 0, 0));
      for (let y = 34; y < wl; y++) L.px(180, y, pk(RAMP.wood, 0.3, 0, y));
      tank(L, wl, ["#62786a", "#46605a", "#324848", "#203038"], 114);
      const deck = 60;
      for (const px of [6, 36, 66, 90]) post(L, px, deck, H - 7, 3);
      planks(L, 0, deck, 96, 3, RAMP.wood, 115);
      for (let x = 0; x < 96; x++) L.px(x, deck + 3, "#1a0e06", 0.6);
      return { perch: { x: 64, y: deck }, bob: [138, wl], crew: [[40, deck], [88, deck]], wl, tank: true, wheel: [170, 60, 17] };
    },
    frosthold(L, E, ctx) {
      const wl = 70, haze = ctx.haze;
      for (let x = 0; x < W; x++) { const top = R(30 - 22 * Math.abs(((x + 30) % 110) / 55 - 1) + fbm(x / 8, 1, 121) * 8); for (let y = top; y < 58; y++) L.px(x, y, pk(tint(RAMP.snow, haze, 0.35), 0.75 - (y - top) * 0.012 + ((x + 30) % 110 > 55 ? -0.2 : 0), x, y)); }
      for (let i = 0; i < 12; i++) pine(L, 4 + i * 21 + (i % 3) * 3, 60, 10 + (i % 4) * 3, tint(RAMP.leaf, haze, 0.3), true);
      for (const [x, w, h] of [[130, 18, 10], [152, 16, 12], [172, 20, 9], [196, 15, 11]]) house(L, E, x, 60, w, h, { wall: RAMP.wood, roof: RAMP.wood, rh: 8, snow: true, chimney: true, lit: ctx.lit, wv: 0.55 });
      for (let x = 0; x < W; x++) for (let y = 58; y < wl - 4; y++) L.px(x, y, pk(RAMP.snow, 0.82 - (y - 58) * 0.02, x, y));
      tank(L, wl, WATERS_PAL.ice, 122, { weedRamp: K.R(["#14281e", "#1e3a2a", "#2a4c36", "#3a5e44"]) });
      for (let x = 0; x < W; x++) for (let y = wl - 4; y < wl + 5; y++) { if (x >= 146 && x < 160) continue; L.px(x, y, pk(RAMP.snow, (y < wl ? 0.9 : 0.62 - (y - wl) * 0.06) + (h2(x, y, 4) - 0.5) * 0.15, x, y)); }
      for (let y = wl - 4; y < wl + 5; y++) { L.px(145, y, pk(RAMP.snow, 0.3, 0, y)); L.px(160, y, pk(RAMP.snow, 0.45, 0, y)); }
      for (let x = 146; x < 160; x++) L.px(x, wl - 1, mix(WATERS_PAL.ice[0], "#ffffff", 0.3));
      for (let x = 0; x < W; x += 1) if (h2(x, 9, 2) < 0.15) L.line(x, wl + 1, x + 4, wl + 3, "#ffffff", 0.25);
      return { perch: { x: 124, y: wl - 4, seat: true }, bob: [153, wl - 1], crew: [[96, wl - 4], [80, wl - 4]], wl: wl - 1, tank: true, ice: [146, 160, wl - 4, wl + 5] };
    },
    whitepeak(L, E, ctx) {
      const wl = 72, haze = ctx.haze;
      for (let x = 0; x < W; x++) { const p1 = 60 - 54 * Math.max(0, 1 - Math.abs(x - 70) / 70), p2 = 60 - 40 * Math.max(0, 1 - Math.abs(x - 190) / 60), top = R(Math.min(p1, p2) + (fbm(x / 6, 1, 131) - 0.5) * 6); for (let y = top; y < 62; y++) { const shadeSide = (x > 70 && x < 140) || x > 190, snowLine = y < 30 + fbm(x / 5, 1, 132) * 12 || (y < 48 && fbm(x / 7, y / 3, 135) > 0.64); L.px(x, y, snowLine ? pk(RAMP.snow, 0.88 - (shadeSide ? 0.3 : 0), x, y) : pk(tint(RAMP.rock, haze, 0.4), 0.6 + (fbm(x / 4, y / 4, 133) - 0.5) * 0.4, x, y)); } }
      for (let i = 0; i < 4; i++) { const y = 64 - i * 3, x = 210; L.rect(x - 3 + i, y, 6 - i * 2 + 2, 3, pk(RAMP.stone, 0.5 + i * 0.1, 0, i)); }
      for (let x = 0; x < W; x++) for (let y = 60; y < wl - 4; y++) L.px(x, y, pk(RAMP.snow, 0.8 - (y - 60) * 0.02, x, y));
      for (const [x, y] of [[30, 66], [180, 64], [226, 66]]) ell(L, x, y, 6, 3, (xx, yy) => (yy < y - 1 ? pk(RAMP.snow, 0.9, xx, yy) : pk(RAMP.rock, 0.55, xx, yy)));
      tank(L, wl, ["#24343e", "#18262e", "#101c22", "#0a1218"], 134, { weeds: false, bed: RAMP.rock, stone: RAMP.rock });
      for (let x = 0; x < W; x++) for (let y = wl - 4; y < wl + 4; y++) { if (x >= 134 && x < 148) continue; L.px(x, y, pk(RAMP.snow, (y < wl ? 0.92 : 0.58 - (y - wl) * 0.07) + (h2(x, y, 4) - 0.5) * 0.15, x, y)); }
      for (let y = wl - 4; y < wl + 4; y++) { L.px(133, y, pk(RAMP.snow, 0.3, 0, y)); L.px(148, y, pk(RAMP.snow, 0.45, 0, y)); }
      for (let x = 134; x < 148; x++) L.px(x, wl - 1, "#3a4a54");
      return { perch: { x: 112, y: wl - 4, seat: true }, bob: [141, wl - 1], crew: [[86, wl - 4], [70, wl - 4]], wl: wl - 1, tank: true, ice: [134, 148, wl - 4, wl + 4] };
    },
    collapsed_mine(L, E, ctx) {
      const wl = 68;
      L.fill((x, y) => pk(RAMP.rock, 0.3 + (fbm(x / 14, y / 9, 141, 4) - 0.5) * 0.6 + (fbm(x / 4, y / 3, 142) > 0.62 ? 0.15 : 0) - (y < 10 ? 0.15 : 0), x, y), 0, 0, W, wl);
      const r = rng(143);
      for (let i = 0; i < 12; i++) { const x = r() * W, len = 5 + r() * 14, w = 1.5 + r() * 2.5; for (let j = 0; j < len; j++) for (let k = -w; k <= w; k++) if (Math.abs(k) < w * (1 - j / len)) L.px(x + k, j, pk(RAMP.rock, k < 0 ? 0.35 : 0.15, x + k, j)); }
      for (const bx of [118, 178]) { post(L, bx, 14, wl, 4, RAMP.wood); post(L, bx + 40, 14, wl, 4, RAMP.wood); for (let x = bx - 2; x < bx + 46; x++) for (let k = 0; k < 4; k++) L.px(x, 12 + k, pk(RAMP.wood, 0.6 - k * 0.12, x, k)); }
      tank(L, wl, WATERS_PAL.collapsed_mine, 144, { bed: RAMP.rock, stone: RAMP.rock, weedRamp: K.R(["#0e2022", "#163032", "#1e4044"]) });
      const top = 62;
      poly(L, [[0, top], [92, top], [100, top + 4], [104, H], [0, H]], (x, y) => pk(RAMP.rock, 0.5 - (y - top) * 0.004 + (fbm(x / 4, y / 3, 145) - 0.5) * 0.4 + (x > 92 ? -0.15 : 0), x, y));
      for (let x = 0; x < 96; x++) L.px(x, top, pk(RAMP.rock, 0.8, x, 0));
      const rail = (x) => (x < 60 ? top - 1 : top - 1 + (x - 60) * 0.55);
      for (let x = 0; x < 200; x++) { const y = R(rail(x)); if (y > H - 10) break; L.px(x, y, "#5a5650"); L.px(x, y - 1, "#8a8278"); if (x % 6 === 0) L.rect(x - 1, y + 1, 4, 1, pk(RAMP.wood, 0.4, x, 0)); }
      L.rect(10, top - 11, 18, 9, pk(RAMP.rock, 0.35, 0, 0)); L.rect(9, top - 12, 20, 2, "#6a5a48"); for (let x = 11; x < 27; x++) if (h2(x, 2, 3) < 0.5) L.px(x, top - 12, "#8a7a62"); ell(L, 14, top - 2, 2, 2, "#2a2622"); ell(L, 24, top - 2, 2, 2, "#2a2622");
      const sx = 168, sy = H - 14;
      L.rect(sx, sy, 16, 6, pk(RAMP.rock, 0.3, 0, 0)); ell(L, sx + 3, sy + 7, 2, 2, "#1a1612"); ell(L, sx + 13, sy + 7, 2, 2, "#1a1612");
      L.line(132, 14, 132, 26, "#3a3228"); L.rect(129, 26, 7, 8, "#3a2a1a"); L.rect(130, 27, 5, 6, "#f0c060");
      E.rect(130, 27, 5, 6, "#ffe090"); E.lamps.push([132, 30, 30]);
      return { perch: { x: 66, y: top }, bob: [150, wl], crew: [[44, top], [86, top]], wl, tank: true, lantern: [132, 30], tx0: 112 };
    },
    sunken_vault(L, E, ctx) {
      const wl = 68;
      masonry(L, 0, 0, W, wl, K.R(["#14201e", "#1e2e2a", "#2a3e38", "#384e46", "#4a6056"]), 151, { bh: 6, bw: 14, base: 0.45, shade: (x, y) => -((y / wl) * 0.25) });
      for (const ax of [60, 150]) { for (let y = 8; y < wl; y++) for (let x = ax - 30; x < ax + 30; x++) { const d = Math.hypot((x - ax) / 26, (y - 40) / 34); if (y > 40 ? Math.abs(x - ax) < 26 : d < 1) L.px(x, y, pk(K.R(["#060c0c", "#0c1614", "#14201e"]), 0.4 + (y - 8) / 120, x, y)); } for (let k = 0; k < 40; k++) { const a = Math.PI + (k / 39) * Math.PI, x = ax + Math.cos(a) * 28, y = 40 + Math.sin(a) * 36; L.rect(R(x) - 1, R(y), 3, 2, "#5a7064"); } }
      for (const px of [100, 200]) { for (let y = 0; y < wl; y++) for (let i = 0; i < 12; i++) L.px(px + i, y, pk(K.R(["#1e2e2a", "#2e423c", "#42584e", "#58705f", "#6a8270"]), 0.6 - Math.abs(i - 4) * 0.08 - (i > 8 ? 0.2 : 0), px + i, y)); for (let i = -2; i < 14; i++) { L.px(px + i, 6, "#6a8270"); L.px(px + i, 7, "#42584e"); } }
      tank(L, wl, WATERS_PAL.sunken_vault, 152, { bed: K.R(["#14201e", "#1e2e2a", "#2a3e38", "#384e46"]), stone: K.R(["#2a3e38", "#42584e", "#58705f"]), weedRamp: K.R(["#0e3a2e", "#16503e", "#20684e"]) });
      for (const px of [100, 200]) for (let y = wl; y < H - 8; y++) for (let i = 0; i < 12; i++) L.px(px + i, y, pk(K.R(["#14403a", "#1e564c", "#2a6a5c"]), 0.6 - Math.abs(i - 4) * 0.08, px + i, y));
      const top = 62;
      for (let s = 0; s < 3; s++) masonry(L, 0, top + s * 6, 92 - s * 10 + 6, 6, K.R(["#2a3e38", "#384e46", "#4a6056", "#5e7468", "#728a7a"]), 153 + s, { bh: 6, bw: 12, base: 0.6 });
      for (let x = 0; x < 98; x++) L.px(x, top, "#8aa490");
      for (const [x, y] of [[40, H - 6], [120, H - 5], [190, H - 6]]) { E.rect(x, y, 5, 1, "#8affd8"); E.rect(x + 2, y - 2, 1, 5, "#8affd8"); E.lamps.push([x + 2, y, 9]); }
      for (let i = 0; i < 6; i++) E.lamps.push([20 + i * 40, wl + 2, 14]);
      return { perch: { x: 60, y: top }, bob: [160, wl], crew: [[38, top], [80, top]], wl, tank: true, glowWater: true };
    },
    streamD(L, E, ctx) {
      const ice = ctx.kind === "ice", wl = ice ? 70 : 68, haze = ctx.haze;
      farHills(L, 50, 16, tint(ice ? RAMP.snow : RAMP.grass, haze, 0.4), 161, 50);
      if (ice) for (let i = 0; i < 10; i++) pine(L, 8 + i * 25 + (i % 2) * 6, 64, 12 + (i % 3) * 4, tint(RAMP.leaf, haze, 0.25), true);
      else { treeLine(L, 58, 64, tint(RAMP.leaf, haze, 0.25), 163); for (const [x, s] of [[150, 1], [206, 1.2]]) blob(L, x, 40, 12 * s, 11 * s, RAMP.leaf, 164 + x); }
      for (let x = 0; x < W; x++) for (let y = 62; y < wl - (ice ? 4 : 2); y++) L.px(x, y, ice ? pk(RAMP.snow, 0.82, x, y) : pk(RAMP.grass, 0.5 + (fbm(x / 3, y / 2, 165) - 0.5) * 0.3, x, y));
      tank(L, wl, ice ? WATERS_PAL.ice : ["#6a8a7e", "#4a6c66", "#34504e", "#22363a"], 162);
      if (ice) {
        for (let x = 0; x < W; x++) for (let y = wl - 4; y < wl + 4; y++) { if (x >= 136 && x < 150) continue; L.px(x, y, pk(RAMP.snow, (y < wl ? 0.9 : 0.6 - (y - wl) * 0.07) + (h2(x, y, 4) - 0.5) * 0.15, x, y)); }
        for (let x = 136; x < 150; x++) L.px(x, wl - 1, mix(WATERS_PAL.ice[0], "#ffffff", 0.3));
        return { perch: { x: 112, y: wl - 4, seat: true }, bob: [143, wl - 1], crew: [[86, wl - 4], [70, wl - 4]], wl: wl - 1, tank: true, ice: [136, 150, wl - 4, wl + 4] };
      }
      const top = 62;
      poly(L, [[0, top], [84, top], [94, wl + 4], [100, H], [0, H]], (x, y) => pk(y < wl ? RAMP.grass : RAMP.mud, 0.5 - (y - top) * 0.006 + (fbm(x / 4, y / 3, 166) - 0.5) * 0.3, x, y));
      for (let x = 2; x < 80; x += 5) if (h2(x, 1, 3) < 0.5) L.px(x, top - 1, ["#e8d070", "#f0f0e8", "#d86a5a"][x % 3]);
      return { perch: { x: 56, y: top }, bob: [150, wl], crew: [[32, top], [76, top]], wl, tank: true, tx0: 100 };
    },
  };
  const LAMP = C("#ffb048");
  function lamps(img, E, a) {
    for (const [x, y, r] of E.lamps) if (r) K.light(img, x, y, r, LAMP, a);
  }
  // one backdrop per (water, hour, weather), kept
  const scenes = new Map();
  const TODS = ["morning", "day", "day", "dusk"];
  // a record that says its hour is drawn at it once the sun is down (an evening catch reads as dusk, a late one as night)
  function todOf(rec) {
    if (rec.night) return "night";
    const hr = rec.hour;
    if (hr != null && (hr >= 17.5 || hr < 5.5)) return hr >= 20.5 || hr < 5.5 ? "night" : "dusk";
    return TODS[hash(String(rec.id || "") + (rec.day || 0)) % TODS.length];
  }
  function scene(rec, o) {
    o = o || {};
    const fr = framing(rec), wid = rec.water && SCENES[rec.water] ? rec.water : fr === "D" ? "streamD" : "stream";
    const kind = rec.kind || ((S().waters || {})[rec.water] || {}).kind || "river";
    const tod = o.tod || todOf(rec), wx = kind === "cave" ? "clear" : rec.sky || "clear";
    const key = [wid, kind, tod, wx].join("|");
    if (scenes.has(key)) return scenes.get(key);
    const ctx = { seed: hash(wid) % 1000, tod, wx, kind, lit: tod === "night" || tod === "dusk" };
    const img = new Img(W, H, "#000000"), L = new Img(W, H), E = new Img(W, H);
    E.lamps = [];
    ctx.skyC = kind === "cave" ? [C("#000000"), C("#000000"), C("#1a2a2a")] : skyCols("day", wx);
    ctx.haze = ctx.skyC[2];
    if (kind !== "cave") sky(img, E, ctx, H);
    const spec = SCENES[wid](L, E, ctx);
    grade(L, ctx);
    img.paste(L, 0, 0);
    img.paste(E, 0, 0);
    lamps(img, E, ctx.tod === "night" ? 0.5 : kind === "cave" ? 0.45 : 0.25);
    const out = Object.assign({ img, framing: fr, id: wid, kind, tod, wx, lit: ctx.lit, lampList: E.lamps }, spec);
    if (scenes.size > 24) scenes.delete(scenes.keys().next().value);
    scenes.set(key, out);
    return out;
  }

  function toCanvas(img, scale) {
    scale = Math.max(1, R(scale || 1));
    const doc = root.document, cv = doc.createElement("canvas");
    cv.width = img.w * scale; cv.height = img.h * scale;
    const g = cv.getContext("2d"), id = g.createImageData(cv.width, cv.height), src = img.data || img.d;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const s = (Math.floor(y / scale) * img.w + Math.floor(x / scale)) * 4, d = (y * cv.width + x) * 4; id.data[d] = src[s]; id.data[d + 1] = src[s + 1]; id.data[d + 2] = src[s + 2]; id.data[d + 3] = src[s + 3]; }
    g.putImageData(id, 0, 0);
    cv.style.imageRendering = "pixelated";
    cv.style.width = cv.width + "px"; cv.style.height = cv.height + "px";
    return cv;
  }

  root.FishArt = Object.assign(root.FishArt || {}, { W, H, species, legendOf, fish, icon, trim, fit, card, plaque, toCanvas, heldLen, wrap, paper, frame, tag, SHAPE, scene, framing, todOf, RAMP, poly, ell, blob, grad, masonry, planks, post, reeds, pine, WATERS_PAL, skyCols });
})(typeof window !== "undefined" ? window : globalThis);
