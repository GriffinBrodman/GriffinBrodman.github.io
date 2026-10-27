/* Afterglows (The Wild Magic Summer): the cosmetic marks a wild surge or a summer potion leaves on a hero's sprite for a few days (look.afterglow),
   painted into the figure's own Paint buffers so they take its outline and light. Paint.fullBody calls Afterglow.paint before it renders,
   Afterglow.post after, and Afterglow.goose instead of the figure when the hero is, for the moment, a goose. */
(function () {
  "use strict";
  const { mix, rng, hash } = Art;
  const R = (hex) => Paint.ramp(hex);
  const MATS = {
    goose: "#e4ded0", goosew: "#c8c2b6", beak: "#e8862a",
    petal: "#f2eef0", petal2: "#f29ab8", bloom: "#f4cc40", glowh: "#7ae6f2", smoke: "#a8a49e",
  };
  function mats(M) { for (const k in MATS) if (!M[k]) M[k] = R(MATS[k]); }
  // the top of the head (or the hat on it): the highest painted row over the face
  function headTop(P) {
    for (let y = 0; y < P.h; y++) for (let x = 10; x <= 18; x++) if (P.mat[y * P.w + x] !== null) return y;
    return 4;
  }
  function isGreen(hex) {
    if (!hex || hex[0] !== "#") return false;
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return g > r + 12 && g > b + 8;
  }
  const OL = "#1e2a12";
  // a storm-coloured hero (a Stormcaller's own grey cloud) gets a white and pink one, or the afterglow would vanish into the class look
  const CLOUD = {
    rain: { hi: "#e8ecf0", body: "#a4adbc", shade: "#7a8496", under: "#4a5260", ol: "#16121a" },
    storm: { hi: "#fff6fa", body: "#f2d4e2", shade: "#d8a8c0", under: "#a87090", ol: "#3a1a2a" },
  };
  const inCloud = (u, v) => (v >= 3 && v <= 4 && u >= 1 && u <= 12) || ((u - 4.5) / 3.2) ** 2 + ((v - 3) / 2.3) ** 2 <= 1 || ((u - 9) / 3.6) ** 2 + ((v - 2.3) / 2.5) ** 2 <= 1;
  // 14 x 5 with its outline round it, on the bare background only, so a hat it hangs behind stays in front
  function cloud(g, x0, y0, C, free) {
    const set = (x, y, c) => { if (free(x, y)) g.set(x, y, c); };
    for (let v = -1; v <= 5; v++) for (let u = -1; u <= 14; u++) {
      const x = x0 + u, y = y0 + v;
      if (inCloud(u, v)) {
        const up = !inCloud(u, v - 1), down = !inCloud(u, v + 1);
        set(x, y, down ? C.under : up ? (u < 10 ? C.hi : C.body) : v >= 3 && u > 7 ? C.shade : C.body);
      } else if (inCloud(u - 1, v) || inCloud(u + 1, v) || inCloud(u, v - 1) || inCloud(u, v + 1)) set(x, y, C.ol);
    }
  }
  // a little green frog, 7 x 5 with its outline, white eyes on top looking about (the pupils swap sides between frames)
  const FROG = [".OO.OO.", "OWPOPWO", "OGGGGGO", "OgyyygO", ".OOOOO."];
  const FROG_C = { O: OL, W: "#f4f0e0", P: "#16121a", G: "#74b84e", g: "#4a8a30", m: "#2e4a1a", y: "#d0dc78" };
  const FROG_BIG = ["..OOO.OOO..", ".OWPOOOPWO.", "OGGGGGGGGGO", "OGmmmmmmmGO", "OgGyyyyyGgO", ".OOOOOOOOO."];
  function frog(g, x0, y0, f, rows) {
    (rows || FROG).forEach((row, v) => [...row].forEach((ch, u) => {
      if (ch === ".") return;
      let c = FROG_C[ch];
      if (v === 1 && (ch === "W" || ch === "P") && f) c = ch === "W" ? FROG_C.P : FROG_C.W;
      g.set(x0 + u, y0 + v, c);
    }));
  }

  // ---------- before the figure is rendered: marks that sit on it ----------
  function paint(P, M, c, o) {
    const id = o.look && o.look.afterglow;
    if (!id) return;
    mats(M);
    const top = headTop(P);
    P.tf = null; P.layer = 12;
    // the cloud and the frog are whole little sprites of their own, laid on after the render (post), with their own outline
    P.agStorm = c.aura === "storm" || c.mark === "raincloud" || c.mark === "thundercloud";
    P.agGreen = isGreen(c.look.skin);
    if (id === "flowers") {
      for (const [x, dy, petal] of [[10, 2, "petal"], [14, 0, "petal2"], [18, 2, "petal"]]) {
        const y = top + dy;
        P.px(x - 1, y, petal, 0.3); P.px(x + 1, y, petal, -0.1); P.px(x, y - 1, petal, 0.5); P.px(x, y + 1, petal, -0.2);
        P.px(x, y, "bloom", 0.4);
      }
    } else if (id === "moustache" && !c.full) {
      // a handlebar: a thick bar under the nose, the ends swept up past the cheeks
      P.layer = 13;
      for (let x = 11; x <= 16; x++) P.px(x, 12, "hair", x < 14 ? -0.15 : -0.45);
      for (let x = 12; x <= 15; x++) P.px(x, 13, "hair", -0.6);
      P.px(10, 11, "hair", 0.1); P.px(17, 11, "hair", -0.4); P.px(10, 10, "hair", 0.2); P.px(17, 10, "hair", -0.3);
    } else if (id === "blue_hair") {
      P.layer = 13;
      const at = (x, y) => P.mat[y * P.w + x];
      // a brim that hides all the hair (a wizard's hat) counts as covered: only the brows would be left to show the blue
      let shown = 0;
      for (let y = 0; y <= 10; y++) for (let x = 0; x < P.w; x++) if (at(x, y) === "hair" && y !== 8) shown++;
      const hidden = c.head && c.head !== "none" && shown < 6;
      if ((c.covered || hidden) && !c.full) {
        // under a hat or a hood the blue still shows: a fringe right across the forehead under the brim and a lock down past each
        // ear, in fixed bright blues (a ramp material would be pinched dark against the brim's higher layer and read as eyebrows)
        const hood = /hood/.test(c.head), B = hood ? "#3068c8" : "#3a7ae0", HI = hood ? "#6a9ef0" : "#8ab8ff";
        let fy = -1;
        for (let y = 3; y <= 10 && fy < 0; y++) for (let x = 12; x <= 16; x++) if (at(x, y) === "skin" || at(x, y) === "hair") { fy = y; break; }
        if (fy >= 0) {
          let l = 20, r = 8;
          for (let x = 8; x <= 20; x++) if (at(x, fy) === "skin" || at(x, fy + 1) === "skin") { l = Math.min(l, x); r = Math.max(r, x); }
          // the band in the brim's shadow, and three or four locks of uneven length falling out of it, never over an eye
          const SH = hood ? "#24509a" : "#2a5ab0", face = (m) => m === "skin" || m === "hair", bare = (x, y) => [x - 1, x, x + 1].every((xx) => (face(at(xx, y)) || at(xx, y) === null) && !(y === 10 && (xx === 12 || xx === 15)));
          const locks = [];
          for (let x = l + 1, n = 0; x < r && locks.length < 4; x += 2 + (n++ % 2)) if (face(at(x, fy)) && at(x, fy + 1) === "skin" && bare(x, fy + 1)) locks.push([x, at(x, fy + 2) === "skin" && bare(x, fy + 2)]);
          for (let x = l; x <= r; x++) {
            const y = face(at(x, fy)) ? fy : fy + 1;
            if (face(at(x, y))) P.px(x, y, SH);
          }
          locks.forEach(([x, long], i) => { P.px(x, fy, HI); P.px(x, fy + 1, B); if (i % 3 === 0 && long) P.px(x, fy + 2, B); });
          for (const [x, d] of [[l, -1], [r, 1]]) for (let y = fy; y <= fy + 4; y++) {
            const xx = at(x, y) === "skin" ? x : at(x - d, y) === "skin" ? x - d : null;
            if (xx === null) continue;
            P.px(xx, y, y === fy ? HI : B);
            if (y >= fy + 1 && at(xx + d, y) === null) P.px(xx + d, y, B);
          }
        }
      } else if (c.full) {
        for (const [x, y, sh] of [[9, 11, 0.3], [9, 12, 0], [9, 13, -0.3], [19, 11, 0], [19, 12, -0.3], [19, 13, -0.5]]) P.px(x, y, "hair", sh);
      } else {
        // a bald head grows a little blue tuft on the crown
        let n = 0;
        for (let i = 0; i < 11 * P.w; i++) if (P.mat[i] === "hair") n++;
        if (n < 8 && [13, 14, 15].some((x) => at(x, top) === "skin")) for (const [x, y, sh] of [[13, -1, 0.5], [14, -1, 0.2], [14, -2, 0.6], [15, -1, -0.2], [12, 0, 0.3], [16, 0, -0.3]]) P.px(x, top + y, "hair", sh);
      }
    } else if (id === "singed") {
      // the hair burnt black at the tips, an ember still caught in it, soot on the cheeks
      if (!c.full) for (let x = 10; x <= 18; x++) for (let y = Math.max(0, top); y <= 9; y++) {
        const m = P.mat[y * P.w + x];
        if (m === "hair" && (x + y) % 2 === 0) P.px(x, y, "#2a1a10");
        if (m !== null) { if (m !== "hair" && x % 3 === 0 && y <= 8) P.px(x, y, "#2a1a10"); break; }
      }
      P.layer = 13;
      for (const [x, y] of [[11, 11], [12, 12], [16, 11]]) P.px(x, y, mix(c.look.skin, "#2e2a28", 0.5));
    } else if (id === "glowing_hands") {
      for (let i = 0; i < P.mat.length; i++) {
        const y = (i / P.w) | 0, m = P.mat[i];
        if (y >= 23 && (m === "skin" || m === "phand" || m === "glv") && P.lay[i] >= 3) { P.mat[i] = "glowh"; P.sh[i] += 0.35; }
      }
    }
  }

  // ---------- after: what floats around the figure (pixels on the bare background only) ----------
  const BUTTER = [["#f2a03a", "#c8641e"], ["#6ab8f0", "#3a7ab8"]];
  function post(g, P, o, outline) {
    const id = o.look && o.look.afterglow;
    if (!id) return;
    const f = o.frame || 0, top = headTop(P), free = (x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h && !g.get(x, y);
    const put = (x, y, col) => { if (free(x, y)) g.set(x, y, col); };
    if (id === "raincloud") {
      // the sprite has no headroom over a hat, so the cloud hangs over the far shoulder, half behind the head, where it can't be taken for
      // a hat; the rain falls past the face, never over the eyes, and lands on the shoulder
      // (a Stormcaller's own cloud already sits there, so theirs goes over the near shoulder)
      const m = P.agStorm ? -1 : 1, X = (x) => (m > 0 ? x : 27 - x);
      cloud(g, m > 0 ? 14 : 0, 1, P.agStorm ? CLOUD.storm : CLOUD.rain, free);
      for (const [x, dy] of f ? [[17, 3], [20, 0], [23, 4], [26, 1]] : [[17, 0], [20, 4], [23, 1], [26, 3]]) for (let y = 7 + dy; y < 17; y += 5) { put(X(x), y, "#7cc0ec"); put(X(x), y + 1, "#c4e8fc"); }
      for (const [x, y] of f ? [[20, 16], [22, 17]] : [[21, 16], [23, 17]]) put(X(x), y, "#c4e8fc");
    } else if (id === "frog") {
      // a frog sat on the head, or on the shoulder when a tall hat leaves no room or it would vanish into a green head or a green hat
      const hat = g.get(14, top + 1);
      const onHead = top >= 2 && !P.agGreen && !(hat && isGreen(hat));
      frog(g, onHead ? 11 : 18, onHead ? top - 2 : 13, f);
    } else if (id === "sparkles") {
      const r = rng(hash(o.id || o.name || "s") + f * 7919), edge = [];
      for (let y = 1; y < g.h - 2; y++) for (let x = 1; x < g.w - 1; x++) if (free(x, y) && (g.get(x - 1, y) || g.get(x + 1, y) || g.get(x, y - 1) || g.get(x, y + 1))) edge.push([x, y]);
      for (let k = 0; k < 7 && edge.length; k++) {
        const [x, y] = edge.splice(Math.floor(r() * edge.length), 1)[0], nx = x + (x < 14 ? -1 : 1), ny = y - 1;
        put(nx, ny, k % 2 ? "#fff6c4" : "#ffffff");
        if (k === 0) { put(nx - 1, ny, "#f6e08a"); put(nx + 1, ny, "#f6e08a"); put(nx, ny - 1, "#f6e08a"); put(nx, ny + 1, "#f6e08a"); }
      }
    } else if (id === "butterflies") {
      // two butterflies about the head, wings open on one frame and closed up on the other
      const spots = f ? [[3, 9], [24, 5]] : [[4, 11], [23, 7]];
      spots.forEach(([x, y], k) => {
        const [a, b] = BUTTER[k], open = f === k % 2;
        g.set(x, y, "#2a1c16"); g.set(x, y + 1, "#2a1c16");
        if (open) { for (const dx of [-2, -1, 1, 2]) g.set(x + dx, y, Math.abs(dx) === 2 ? b : a); g.set(x - 1, y + 1, b); g.set(x + 1, y + 1, b); g.set(x - 1, y - 1, a); g.set(x + 1, y - 1, a); }
        else { g.set(x - 1, y - 1, a); g.set(x + 1, y - 1, a); g.set(x - 1, y - 2, b); g.set(x + 1, y - 2, b); }
      });
    } else if (id === "singed") {
      // an ember caught in the scorched crown, and two curls of dark smoke rising past the temples (on the bare background, so grey kit
      // can't swallow them)
      const ex = f ? 13 : 15, ey = Math.max(0, top);
      g.set(ex, ey, f ? "#ffd05a" : "#ff8a2a"); g.set(ex + 1, ey, f ? "#ff8a2a" : "#c8501e");
      // a wisp rises from each temple, thick and dark at the hair, thinning and paling as it curls up (the curl sways between frames)
      const WISP = [[0, 0, 2], [0, -1, 2], [1, -2, 2], [1, -3, 1], [0, -4, 1], [-1, -5, 1], [-1, -6, 1], [0, -7, 1]];
      const tone = (k) => (k < 3 ? "#3a322e" : k < 6 ? "#6a605a" : "#a89e94");
      for (const [bx, by, side] of [[8, 9, -1], [20, 8, 1]]) WISP.forEach(([dx, dy, w], k) => {
        const x = bx + dx * (f ? -side : side), y = by + dy;
        put(x, y, tone(k)); if (w > 1) put(x + side, y, tone(k));
      });
      put(f ? 8 : 20, f ? 10 : 9, "#ff8a2a");
    } else if (id === "glowing_hands") {
      const lit = [];
      for (let i = 0; i < P.mat.length; i++) if (P.mat[i] === "glowh") lit.push(i);
      for (const i of lit) {
        const x = i % P.w, y = (i / P.w) | 0;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) if (g.get(x + dx, y + dy) === outline && P.mat[(y + dy) * P.w + x + dx] === null) g.set(x + dx, y + dy, mix(outline, "#8af2ff", 0.7));
      }
      const hands = lit.length ? [lit[0], lit[lit.length - 1]] : [];
      hands.forEach((i, k) => { const x = i % P.w, y = (i / P.w) | 0; put(x + (k ? 1 : -1), y - 2 - ((f + k) % 2), "#e8ffff"); });
    }
  }

  // ---------- the bust portrait (40 x 40): the marks that float or sit, over the backdrop but behind the hero ----------
  function portrait(g, P, id, f, c) {
    const free = (x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h && P.mat[y * P.w + x] === null;
    const put = (x, y, col) => { if (free(x, y)) g.set(x, y, col); };
    if (id === "blue_hair" && !c.full && c.head && c.head !== "none") {
      // a brim that hides every hair (a wizard's hat) leaves only blue brows; give the bust the sprite's fringe and locks
      const at = (x, y) => (x >= 0 && y >= 0 && x < P.w && y < P.h ? P.mat[y * P.w + x] : null);
      let fy = -1, shown = 0;
      for (let y = 0; y < 30 && fy < 0; y++) for (let x = 15; x <= 24; x++) if (at(x, y) === "skin") { fy = y; break; }
      for (let y = 0; y < fy + 2; y++) for (let x = 0; x < P.w; x++) if (at(x, y) === "hair") shown++;
      if (fy > 0 && shown < 10) {
        const face = (m) => m === "skin" || m === "hair";
        let l = P.w, r = 0;
        for (let y = fy; y <= fy + 1; y++) for (let x = 0; x < P.w; x++) if (face(at(x, y))) { l = Math.min(l, x); r = Math.max(r, x); }
        // a row in the brim's shadow, then locks of uneven length falling from it with the brow showing between them
        const drop = [1, 2, 1, 3, 1, 2];
        for (let x = l; x <= r; x++) {
          if (face(at(x, fy))) g.set(x, fy, "#2a5ab0");
          const k = Math.floor((x - l) / 3), lock = (x - l) % 3 !== 2, len = drop[k % drop.length];
          if (!lock) continue;
          for (let y = fy + 1; y <= fy + len; y++) if (face(at(x, y)) && y < 16) g.set(x, y, (x - l) % 3 === 0 && y === fy + 1 ? "#8ab8ff" : "#3a7ae0");
        }
        for (const [x0, d] of [[l, 1], [r, -1]]) for (let y = fy; y <= fy + 6; y++) {
          let x = x0;
          while (!face(at(x, y)) && Math.abs(x - x0) < 3) x += d;
          if (!face(at(x, y))) continue;
          const w = y > fy + 4 ? 1 : 2;
          for (let k = 0; k < w; k++) if (face(at(x + k * d, y))) g.set(x + k * d, y, k === 0 && y < fy + 3 ? "#8ab8ff" : "#3a7ae0");
        }
      }
    }
    if (id === "raincloud") {
      const storm = c.aura === "storm" || c.mark === "raincloud" || c.mark === "thundercloud";
      cloud(g, storm ? 1 : 25, 1, storm ? CLOUD.storm : CLOUD.rain, free);
      for (const [x, dy] of f ? [[27, 2], [30, 0], [33, 3], [36, 1]] : [[27, 0], [30, 3], [33, 1], [36, 4]]) {
        const X = storm ? 39 - x : x;
        for (let y = 8 + dy; y < 30; y += 6) { put(X, y, "#7cc0ec"); put(X, y + 1, "#c4e8fc"); }
      }
    } else if (id === "frog") frog(g, 28, 26, f, FROG_BIG);
  }

  // ---------- the hero, for the moment, as a goose: a farmyard goose in the hero's own scarf ----------
  function goose(o, M, BH, seated) {
    mats(M);
    const P = new Paint.Paint(28, BH), base = seated ? Math.min(BH - 2, 27) : BH - 2;
    const lift = base - 32;
    const Y = (y) => y + lift;
    P.layer = 1;
    if (!seated) {
      P.rect(11, Y(29), 1, 3, "beak", -0.1); P.rect(16, Y(29), 1, 3, "beak", -0.3);
      P.rect(10, Y(32), 3, 1, "beak", 0.1); P.rect(15, Y(32), 3, 1, "beak", -0.1);
    }
    P.layer = 2;
    P.poly([[5.5, Y(23.5)], [2.5, Y(21.5)], [3.5, Y(25)], [6.5, Y(27)]], "goosew", (x, y) => 0.1 - (y - Y(22)) * 0.1);
    P.ell(13.5, Y(25.5), 8, 4.4, "goose", { s: 0.05 });
    P.layer = 3;
    P.ell(11.8, Y(24.8), 5.2, 2.6, "goosew", { s: 0.15, k: 0.7 });
    for (let x = 8; x <= 14; x += 2) P.px(x, Y(26), "goosew", -0.55);
    // the second frame bobs the head a pixel, the way a goose does when it is thinking about biting someone
    const b = o.frame === 1 ? 1 : 0, H = (y) => Y(y) + b;
    P.layer = 4;
    P.tube([[19.5, Y(23)], [20.2, Y(20)], [20.6, H(17)], [20.4, H(14.5)]], 2.1, 1.6, "goose", 0.15);
    P.ell(20.8, H(12.6), 2.7, 2.3, "goose", { s: 0.2 });
    P.layer = 5;
    P.poly([[22.6, H(11.6)], [26.2, H(12.6)], [22.6, H(14)]], "beak", (x, y) => (y < H(12.6) ? 0.35 : -0.25));
    P.px(23, H(12), "#d06a1e");
    P.px(21, H(11), "#16121a");
    // the hero's own colour, knotted at the throat, the loose end blowing back
    P.layer = 6;
    P.rect(18, Y(18), 5, 2, "fav", (x, y) => 0.3 - (x - 18) * 0.12 - (y - Y(18)) * 0.3);
    P.poly([[18, Y(19.5)], [16.2, Y(21.8)], [17.6, Y(22.4)], [19.2, Y(20)]], "favd", 0);
    return P.render(M, { outline: o.legend ? "#5a3a08" : "#16121a" });
  }

  window.Afterglow = { paint, post, portrait, goose, MATS };
})();
