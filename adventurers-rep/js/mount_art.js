/* Mounts and wagons: side-view pixel sprites for every kind and colour in league/content/mounts.py, hitched teams and the stables pen. */
/*
  MountArt.mountGrid(kind, colour, frame)          -> cached 1x canvas, facing right; frame 0/1 is the idle pair
  MountArt.mountSprite(kind, colour, scale, opts)  -> a <canvas class="mount-px"> for the page, idling unless opts.animate === false
  MountArt.wagonGrid(kind, puller)                 -> cached 1x canvas of the wagon alone (shafts resting on the ground), or the
                                                      hitched team when puller = {kind, colour}
  MountArt.drawMount(ctx, kind, colour, x, y, frame, scale) and MountArt.drawWagon(ctx, kind, x, y, scale, puller, frame)
      draw onto a canvas: x is the left edge, y the ground line (the sprite's bottom edge); both return {w, h} in canvas pixels
  MountArt.stablePen(mounts, opts)                 -> a live 280x120 stables-yard canvas; mounts [{kind, colour, name}],
      opts.wagons [{kind, puller}], opts.w / opts.h / opts.seed; canvas.spots lists [{name, kind, x, y, w, h}] for labels
*/
(function () {
  "use strict";
  const { Grid, ramp, mix, hash, rng, OUTLINE } = Art;

  const COLOURS = {
    donkey: ["grey", "dun", "brown", "black", "cream"], pony: ["bay", "piebald", "chestnut", "palomino", "buckskin", "appaloosa", "roan"],
    ox: ["red", "black", "cream"],
    horse: ["bay", "chestnut", "grey", "black", "dun", "palomino", "buckskin", "pinto", "appaloosa", "roan", "white-socked"],
    courser: ["grey", "black", "chestnut", "palomino", "white-socked"], destrier: ["black", "grey", "bay", "roan", "pinto"],
    camel: ["sand"], unicorn: ["white"], eagle: ["golden"], skeleton: ["bone"],
  };
  const WAGONS = ["handcart", "donkey_cart", "horse_cart", "ox_wagon", "covered_wagon", "carriage"];

  // coat, mane/tail, hoof; points = dark lower legs, socks = four white feet, patches = big splashes of another colour,
  // blanket = a white rump with dark spots (appaloosa), roan = pale hairs flecked through the body
  const COAT = {
    bay: { coat: "#8e4c2a", mane: "#2c2220", points: true, star: true },
    chestnut: { coat: "#b4642e", mane: "#8a3c1c", blaze: true, sock: true },
    grey: { coat: "#a6a6aa", mane: "#e6e2dc", dapple: true, hoof: "#5a5250" },
    black: { coat: "#3e363c", mane: "#1e181c" },
    dun: { coat: "#c8a468", mane: "#3a2a20", points: true, stripe: true },
    piebald: { coat: "#ece6dc", mane: "#2a2428", patches: "#34303a" },
    brown: { coat: "#6a4a36", mane: "#2e2220" },
    sand: { coat: "#c8a064", mane: "#9a7444" },
    white: { coat: "#eceef0", mane: "#f2e2a8", hoof: "#c8a050" },
    palomino: { coat: "#d8a850", mane: "#f4ecd4", blaze: true },
    buckskin: { coat: "#c89c5c", mane: "#2a2220", points: true },
    pinto: { coat: "#94502a", mane: "#3a2620", patches: "#f0eae0", socks: true },
    appaloosa: { coat: "#7a4a30", mane: "#2c2220", blanket: true, sock: true },
    roan: { coat: "#6a6c7a", mane: "#26222a", roan: "#c4c8d4", points: true },
    "white-socked": { coat: "#7a4026", mane: "#2c2220", blaze: true, socks: true },
  };
  const DONKEY = { grey: "#8e8984", dun: "#b09270", brown: "#6c4c38", black: "#3e3634", cream: "#d8ccb4" };
  const OX = { red: "#9c4c2c", black: "#3a3434", cream: "#dccaa2" };
  const HOOF = "#3a2c28";
  const BONE = "#e4dccb", GLOW = "#8af0a0";

  // ---------- shaded primitives (lit from the top-left, like Grid.blob) ----------
  function lit(nx, ny, d, bias) {
    const l = -nx * 0.55 - ny * 0.75 + (1 - d) * 0.4;
    const i = l > 0.75 ? 4 : l > 0.25 ? 3 : l > -0.35 ? 2 : l > -0.8 ? 1 : 0;
    return Math.max(0, Math.min(4, i + (bias || 0)));
  }
  function ell(g, cx, cy, rx, ry, c, ang, bias) {
    const ca = Math.cos(ang || 0), sa = Math.sin(ang || 0), R = Math.max(rx, ry) + 1;
    for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry, d = u * u + v * v;
      if (d <= 1) g.set(x, y, c[lit(u * ca - v * sa, u * sa + v * ca, d, bias)]);
    }
  }
  // a tapering tube through pts, radius r0 at the start to r1 at the end
  function cap(g, pts, r0, r1, c, bias) {
    const segs = [];
    let L = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay) || 0.01;
      segs.push([ax, ay, bx, by, L, l]); L += l;
    }
    const R = Math.max(r0, r1) + 1, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys) - R); y <= Math.max(...ys) + R; y++) for (let x = Math.floor(Math.min(...xs) - R); x <= Math.max(...xs) + R; x++) {
      const px = x + 0.5, py = y + 0.5;
      let best = null;
      for (const [ax, ay, bx, by, s0, l] of segs) {
        const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (l * l)));
        const qx = ax + (bx - ax) * t, qy = ay + (by - ay) * t, r = r0 + (r1 - r0) * (s0 + t * l) / L, k = Math.hypot(px - qx, py - qy) / r;
        if (k <= 1 && (!best || k < best[0])) best = [k, (px - qx) / r, (py - qy) / r];
      }
      if (best) g.set(x, y, c[lit(best[1], best[2], best[0] * best[0], bias)]);
    }
  }
  function recolor(g, from, to, keep) {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const i = from.indexOf(g.get(x, y));
      if (i >= 0 && keep(x, y)) g.px[y * g.w + x] = to[i];
    }
  }
  function bbox(g) {
    let x0 = g.w, x1 = -1;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    return [x0, x1];
  }
  function paste(dst, src, ox, oy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.px[y * src.w + x]; if (c) dst.set(x + ox, y + oy, c); }
  }

  // ---------- horses and their kin ----------
  // L body half-length, B body half-height, leg, neck, head lengths; neckA / headA in degrees
  const EQUINE = {
    horse: { L: 6.2, B: 3.2, leg: 6.5, neck: 5.4, neckA: 58, head: 4.4, headA: 42, ear: 2, mane: 1.0, tail: 1.2 },
    courser: { L: 6.6, B: 2.8, leg: 7.6, neck: 6.0, neckA: 60, head: 4.2, headA: 40, ear: 2, mane: 0.9, tail: 1.0, slim: true },
    destrier: { L: 7.2, B: 3.9, leg: 7.0, neck: 5.6, neckA: 54, head: 4.8, headA: 46, ear: 2, mane: 1.3, tail: 1.5, feather: true, barding: true },
    unicorn: { L: 6.4, B: 3.0, leg: 7.2, neck: 5.8, neckA: 60, head: 4.2, headA: 40, ear: 2, mane: 1.2, tail: 1.4, horn: true },
    pony: { L: 5.0, B: 3.1, leg: 4.4, neck: 4.0, neckA: 56, head: 3.8, headA: 44, ear: 1.5, mane: 1.3, tail: 1.6, shaggy: true },
    donkey: { L: 5.2, B: 2.9, leg: 5.4, neck: 3.4, neckA: 40, head: 4.6, headA: 52, ear: 4.2, mane: 0.6, tail: 0.6, donkey: true },
    skeleton: { L: 6.2, B: 3.2, leg: 6.5, neck: 5.4, neckA: 58, head: 4.4, headA: 42, ear: 2, mane: 0, tail: 0.7, bones: true },
  };
  function geometry(p, frame) {
    const G = Math.round(p.leg + p.B * 2 + p.neck + 6), legTop = G - p.leg, cy = legTop - p.B * 0.45;
    const rumpR = p.B * 1.02, rumpX = 3.4 + rumpR, bodyX = rumpX + p.L * 0.72, chestX = bodyX + p.L - 1.8;
    const na = p.neckA * Math.PI / 180, ha = p.headA * Math.PI / 180, bob = frame ? 1 : 0;
    const nb = [chestX + 0.4, cy - p.B * 0.35];
    const nt = [nb[0] + Math.cos(na) * p.neck, nb[1] - Math.sin(na) * p.neck + bob];
    const muzzle = [nt[0] + 0.6 + Math.cos(ha) * p.head, nt[1] + Math.sin(ha) * p.head];
    return { G, legTop, cy, rumpR, rumpX, bodyX, chestX, nb, nt, muzzle, W: Math.ceil(muzzle[0] + 2.6), H: G + 2, na };
  }
  function drawEquine(kind, colour, frame) {
    const p = EQUINE[kind], q = geometry(p, frame);
    if (p.bones) return drawSkeletonHorse(new Grid(q.W, q.H), p, q, frame);
    const co = kind === "donkey" ? { coat: DONKEY[colour], mane: "#2e2624", donkey: true } : COAT[colour];
    const C = ramp(co.coat), M = ramp(co.mane), F = ramp(co.hoof || HOOF);
    const g = new Grid(q.W, q.H);
    const { G, legTop, cy, rumpR, rumpX, bodyX, chestX, nb, nt, muzzle } = q;
    const B = p.B;
    const fl = frame ? 1 : 0;
    const tb = [rumpX - rumpR + 0.6, cy - B * 0.7];
    const tail = p.donkey
      ? [tb, [tb[0] - 1.2 - fl * 0.6, tb[1] + 3], [tb[0] - 1.2 - fl, tb[1] + 6]]
      : p.shaggy ? [tb, [tb[0] - 2 - fl * 0.5, tb[1] + 2.5], [tb[0] - 2 - fl, G - 3]]
        : [tb, [tb[0] - 1.8 - fl * 0.6, tb[1] + 2.4], [tb[0] - 1.6 - fl * 1.2, tb[1] + 3 + p.leg * 0.85]];
    const leg = (x, bias, hind) => {
      const pts = hind ? [[x + 0.4, legTop - 1.5], [x - 0.6, legTop + p.leg * 0.45], [x + 0.1, G - 0.5]] : [[x, legTop - 1], [x, legTop + p.leg * 0.5], [x, G - 0.5]];
      cap(g, pts, hind ? 1.5 : 1.25, p.slim ? 0.8 : 0.95, C, bias);
    };
    const foreX = chestX - 0.6, hindX = rumpX - 0.4;
    leg(foreX - 2.2, -1, false); leg(hindX + 2.2, -1, true);
    cap(g, tail, p.tail, p.tail * 0.75, M, 0);
    ell(g, rumpX, cy - 0.3, rumpR, rumpR, C);
    ell(g, bodyX, cy, p.L, B, C);
    ell(g, chestX, cy + 0.2, B * 0.85, B * 0.95, C);
    leg(foreX, 0, false); leg(hindX, 0, true);
    cap(g, [nb, nt], B * 0.8, p.donkey ? 1.6 : 1.5, C);
    const ha = p.headA * Math.PI / 180, cheek = [nt[0] + 0.5, nt[1] + 0.3];
    ell(g, cheek[0], cheek[1], p.donkey ? 2.0 : 1.9, p.donkey ? 1.9 : 1.7, C);
    cap(g, [cheek, muzzle], p.donkey ? 1.7 : 1.5, p.donkey ? 1.45 : 1.15, C);
    const lower = legTop + p.leg * 0.55;
    if (co.points) recolor(g, C, M, (x, y) => y >= lower);
    if (co.sock || p.feather) recolor(g, C, ramp("#ece6da"), (x, y) => y >= G - 1.5 - (p.feather ? 0.5 : 0) && x >= foreX - 1 && x <= foreX + 1);
    if (co.patches) {
      const P = ramp(co.patches), spots = [[bodyX - 1, cy - 0.5, 2.6, 2], [rumpX, cy + 0.6, 2, 2.2], [nt[0] - 0.5, nt[1] + 0.8, 1.8, 1.6], [chestX, cy + 2.5, 1.6, 1]];
      recolor(g, C, P, (x, y) => spots.some(([sx, sy, rx, ry]) => ((x + 0.5 - sx) / rx) ** 2 + ((y + 0.5 - sy) / ry) ** 2 <= 1));
    }
    if (co.socks) recolor(g, C, ramp("#ece6da"), (x, y) => y >= G - 2);
    if (co.blanket) {
      const Wb = ramp("#ece6da"), inBlanket = (x, y) => ((x + 0.5 - rumpX - 0.6) / (rumpR + 1.4)) ** 2 + ((y + 0.5 - cy + 0.8) / (B * 0.95)) ** 2 <= 1;
      recolor(g, C, Wb, inBlanket);
      recolor(g, Wb, M, (x, y) => inBlanket(x, y) && y % 2 === 0 && (x + y * 1.5) % 3 === 0);
    }
    if (co.roan) recolor(g, C, ramp(co.roan), (x, y) => y < legTop + 1 && hash(x + ":" + y) % 5 < 2);
    if (co.dapple) for (let y = 0; y < q.H; y++) for (let x = 0; x < q.W; x++) if (g.get(x, y) === C[2] && (x * 3 + y * 5) % 7 === 0 && y < legTop + 1) g.set(x, y, C[3]);
    if (co.donkey) {
      const P = ramp(mix(co.coat, "#f2ece0", 0.7));
      recolor(g, C, P, (x, y) => (Math.hypot(x + 0.5 - muzzle[0], y + 0.5 - muzzle[1]) < 1.8) || (y >= cy + B * 0.45 && y < legTop + 1.5 && x > rumpX - 1 && x < chestX + 1));
      for (let x = Math.floor(rumpX - 1); x <= chestX; x++) for (let y = 0; y < q.H; y++) if (C.includes(g.get(x, y))) { g.set(x, y, M[2]); break; }
      for (let k = 0; k < 3; k++) g.set(Math.round(chestX - 0.5), Math.round(cy - B + 0.6 + k), M[1]);
    }
    if (co.stripe) for (let x = Math.floor(rumpX); x <= chestX - 1; x++) for (let y = 0; y < q.H; y++) if (C.includes(g.get(x, y))) { g.set(x, y, M[1]); break; }
    // the mane follows the top edge of the neck
    const nx = Math.cos(q.na), ny = -Math.sin(q.na), px = ny, py = -nx;
    const off = (t, r) => [nb[0] + nx * t + px * r, nb[1] + ny * t + py * r + (t / p.neck) * (frame ? 1 : 0)];
    if (p.mane) {
      const r0 = B * 0.8, len = Math.hypot(nt[0] - nb[0], nt[1] - nb[1]);
      if (p.donkey) cap(g, [off(len * 0.3, r0 - 0.2), off(len, 1.7)], 0.7, 0.7, M);
      else cap(g, [off(len * 0.18, r0 - 0.3), off(len * 1.02, 1.3)], p.mane, p.mane * 0.8, M);
      if (p.shaggy) {
        cap(g, [off(len * 0.25, r0 - 1.2), off(len * 0.85, 0.4)], 0.9, 0.8, M, -1);
        g.set(Math.round(nt[0] + 1.2), Math.round(nt[1] - 1.2), M[3]); g.set(Math.round(nt[0] + 1.9), Math.round(nt[1] - 0.6), M[2]);
      } else if (!p.donkey) g.set(Math.round(nt[0] + 0.8), Math.round(nt[1] - 1.2), M[2]);
    }
    const ex = Math.round(nt[0] + 0.3), ey = Math.round(nt[1] - 1.6);
    if (p.donkey) {
      cap(g, [[ex - 0.2, ey + 0.8], [ex - 1.4, ey - p.ear + 0.6]], 0.85, 0.7, C);
      cap(g, [[ex + 0.6, ey + 0.8], [ex + 0.2, ey - p.ear + 1]], 0.8, 0.65, C, -1);
      g.set(Math.round(ex - 1.2), Math.round(ey - p.ear + 1.5), M[1]);
    } else {
      for (let k = 0; k < p.ear; k++) g.set(ex, ey - k, k ? C[2] : C[3]);
      if (!p.shaggy) g.set(ex - 1, ey + 1, C[1]);
    }
    if (p.horn) {
      const H = ramp("#e8c058");
      for (let k = 0; k < 5; k++) g.set(Math.round(nt[0] + 1.8 + k * 0.7), Math.round(nt[1] - 1.4 - k * 0.9), k % 2 ? H[2] : H[4]);
    }
    if (co.blaze || co.star) {
      const W = "#f2ece2";
      for (let t = co.star ? 0.12 : 0.1; t < (co.star ? 0.3 : 0.9); t += 0.18) g.set(Math.round(cheek[0] + (muzzle[0] - cheek[0]) * t + 0.4), Math.round(cheek[1] + (muzzle[1] - cheek[1]) * t - 0.9), W);
    }
    for (let x = 0; x < q.W; x++) if (g.get(x, G)) g.set(x, G, x === Math.floor(foreX + 1) || x === Math.floor(hindX + 1) ? F[1] : F[2]);
    if (p.feather) for (const fx of [foreX, hindX, foreX - 2.2, hindX + 2.2]) for (const dx of [-1, 0, 1, 2]) g.set(Math.floor(fx) + dx, G - 1, dx === 2 ? "#cfc6b6" : "#efe8da");
    const eye = [Math.round(nt[0] + 1.1 + Math.cos(ha) * 0.4), Math.round(nt[1] - 0.4)];
    g.set(eye[0], eye[1], OUTLINE);
    g.set(Math.round(muzzle[0] + 0.3), Math.round(muzzle[1] - 0.2), C[0]);
    if (p.barding) barding(g, p, q, frame, C);
    g.outline(OUTLINE);
    if (p.horn) {
      const sp = frame ? [[nt[0] + 6, nt[1] - 6], [rumpX - 3, cy - 3], [bodyX + 1, cy - B - 3]] : [[nt[0] + 5, nt[1] - 3], [rumpX - 2, cy + 3], [bodyX - 2, cy - B - 2]];
      for (const [sx, sy] of sp) { const x = Math.round(sx), y = Math.round(sy); if (!g.get(x, y)) g.set(x, y, "#fff6c8"); }
      const tip = [Math.round(nt[0] + 1.8 + 4 * 0.7), Math.round(nt[1] - 1.4 - 4 * 0.9) - 1];
      if (!g.get(tip[0], tip[1])) g.set(tip[0], tip[1], frame ? "#fffbe6" : "#fff2a8");
    }
    g.hitch = [Math.round(nb[0] + 0.5), Math.round(nb[1] + 0.5)];
    return g;
  }
  // the warhorse's caparison: a cloth over the back to the knees, gold-hemmed, and a steel chanfron on the face
  function barding(g, p, q, frame, C) {
    const R = ramp("#9a2a26"), Au = ramp("#e8b84a"), St = ramp("#a8b0b8");
    const { legTop, cy, rumpX, chestX, bodyX, nt, muzzle } = q, hem = Math.floor(legTop + p.leg * 0.3), x0 = Math.floor(rumpX - 2.6), x1 = Math.ceil(chestX + 1.6);
    recolor(g, C, R, (x, y) => x >= x0 && x <= x1 && y >= cy - p.B - 1 && y < hem);
    for (let x = x0; x <= x1; x++) {
      if (!R.includes(g.get(x, hem - 1)) && !g.get(x, hem)) continue;
      g.set(x, hem, Au[(x + (frame ? 1 : 0)) % 3 ? 2 : 3]);
      if ((x + (frame ? 1 : 0)) % 3 === 0) g.set(x, hem + 1, Au[1]);
    }
    for (let x = x0; x <= x1; x++) for (let y = 0; y < hem; y++) if (R.includes(g.get(x, y))) { g.set(x, y, Au[3]); break; }
    const ex = Math.round(bodyX), ey = Math.round(cy + 0.5);
    for (const [dx, dy, i] of [[0, -1, 4], [-1, 0, 3], [0, 0, 2], [1, 0, 2], [0, 1, 1]]) g.set(ex + dx, ey + dy, Au[i]);
    for (let t = 0.15; t <= 0.85; t += 0.14) g.set(Math.round(nt[0] + 0.6 + (muzzle[0] - nt[0]) * t), Math.round(nt[1] - 0.6 + (muzzle[1] - nt[1]) * t), t < 0.3 ? St[4] : St[3]);
  }
  function drawSkeletonHorse(g, p, q, frame) {
    const Bn = ramp(BONE), D = "#2a2230";
    const { G, legTop, cy, rumpR, rumpX, bodyX, chestX, nb, nt, muzzle } = q, B = p.B;
    const bone = (pts, r, bias) => cap(g, pts, r, r, Bn, bias);
    const legs = (bias, dx) => {
      const fx = chestX - 0.6 + dx, hx = rumpX - 0.4 - dx;
      bone([[fx, legTop - 0.5], [fx, legTop + p.leg * 0.5]], 0.75, bias); bone([[fx, legTop + p.leg * 0.5], [fx, G - 0.5]], 0.6, bias);
      bone([[hx + 0.4, legTop - 1], [hx - 0.6, legTop + p.leg * 0.45]], 0.8, bias); bone([[hx - 0.6, legTop + p.leg * 0.45], [hx + 0.1, G - 0.5]], 0.6, bias);
      for (const [x, y] of [[fx, legTop + p.leg * 0.5], [hx - 0.6, legTop + p.leg * 0.45]]) ell(g, x, y, 1, 1, Bn, 0, bias);
    };
    legs(-1, -2.2);
    const fl = frame ? 1 : 0;
    for (let k = 0; k < 6; k++) g.set(Math.round(rumpX - rumpR + 0.4 - k * 0.3 - fl * k * 0.25), Math.round(cy - B * 0.7 + 0.5 + k * 1.3), k % 2 ? Bn[2] : Bn[3]);
    ell(g, bodyX + 0.4, cy - 0.3, p.L * 0.74, B * 0.72, [D, D, D, D, D]);
    for (let x = Math.round(rumpX + 1.5); x <= chestX; x += 2) {
      const top = cy - B * 0.7, bot = cy + B * 0.5 - Math.abs(x - bodyX) * 0.12;
      for (let y = Math.round(top); y <= bot; y++) g.set(x + (y > cy + 1 ? 1 : 0), y, y < cy - 1 ? Bn[3] : Bn[2]);
    }
    bone([[rumpX - rumpR + 0.8, cy - B * 0.65], [chestX + 0.6, cy - B * 0.75]], 0.7);
    for (let x = Math.round(rumpX); x <= chestX; x += 2) g.set(x, Math.round(cy - B * 0.75 - 1), Bn[3]);
    ell(g, rumpX, cy - 0.6, 2.3, 1.8, Bn);
    g.set(Math.round(rumpX), Math.round(cy - 0.4), D);
    ell(g, chestX - 0.4, cy - 0.4, 1.3, 2.3, Bn, -0.3);
    legs(0, 0);
    for (let t = 0; t <= 1.001; t += 0.2) ell(g, nb[0] + (nt[0] - nb[0]) * t, nb[1] - 0.5 + (nt[1] - nb[1] + 0.5) * t, 1.05, 1.05, Bn);
    const cheek = [nt[0] + 0.5, nt[1] + 0.3];
    ell(g, cheek[0], cheek[1], 2.0, 1.7, Bn);
    cap(g, [cheek, muzzle], 1.4, 1.0, Bn);
    const ex = Math.round(nt[0] + 1), ey = Math.round(nt[1] - 0.3);
    g.set(ex, ey, D); g.set(ex + 1, ey, D); g.set(ex, ey + 1, D); g.set(ex + 1, ey + 1, D);
    g.set(Math.round(nt[0] + 0.3), Math.round(nt[1] - 2), Bn[3]);
    const ha = p.headA * Math.PI / 180;
    for (let t = 0.45; t <= 0.95; t += 0.18) g.set(Math.round(cheek[0] + (muzzle[0] - cheek[0]) * t + Math.sin(ha) * 1.2), Math.round(cheek[1] + (muzzle[1] - cheek[1]) * t + Math.cos(ha) * 1.2), (Math.round(t * 10) % 2) ? D : Bn[4]);
    g.set(Math.round(muzzle[0] - 0.4), Math.round(muzzle[1] - 1), D);
    for (let x = 0; x < g.w; x++) if (g.get(x, G)) g.set(x, G, Bn[1]);
    g.outline(OUTLINE);
    g.set(ex + (frame ? 0 : 1), ey, GLOW); g.set(ex + (frame ? 1 : 0), ey + 1, frame ? "#3a6a48" : "#4a8a5a");
    g.hitch = [Math.round(nb[0] + 0.5), Math.round(nb[1] + 0.5)];
    return g;
  }

  // ---------- ox, camel, eagle ----------
  function drawOx(colour, frame) {
    const C = ramp(OX[colour] || OX.red), dark = colour === "black", Hn = ramp("#d8c490"), F = ramp(HOOF);
    const W = 30, H = 20, G = 18, g = new Grid(W, H), fl = frame ? 1 : 0, bob = frame ? 1 : 0;
    const legTop = 13;
    const leg = (x, bias) => cap(g, [[x, legTop - 2], [x, G - 0.5]], 1.6, 1.25, C, bias);
    leg(19.5, -1); leg(8.6, -1);
    cap(g, [[4.6, 8], [3.4 - fl * 0.6, 12], [3.2 - fl * 1.2, 15.5]], 0.6, 0.55, C, -1);
    ell(g, 3.2 - fl * 1.2, 16.2, 0.9, 1.3, ramp(dark ? "#1e1a1c" : mix(OX[colour] || OX.red, "#2a1e1a", 0.6)));
    ell(g, 8, 9.6, 3.9, 4.0, C);
    ell(g, 13.2, 10, 7.2, 4.1, C);
    ell(g, 19.2, 8.8, 3.4, 3.6, C);
    leg(17.5, 0); leg(6.6, 0);
    ell(g, 21.4, 13.2 + bob * 0.5, 1.4, 2.2, C, 0, -1);
    cap(g, [[19.5, 9.2], [22.6, 9.4 + bob]], 3.2, 2.6, C);
    ell(g, 21.2, 8.2 + bob, 1.5, 0.75, C, 0.35, -1);
    cap(g, [[23.4, 8.6 + bob], [26, 12.2 + bob]], 2.4, 1.8, C);
    const Mz = ramp(dark ? "#5a5050" : colour === "cream" ? "#c89a84" : "#d0a898");
    ell(g, 26.5, 12.8 + bob, 1.6, 1.3, Mz);
    for (const [x, y, i] of [[23, 6, 1], [24, 6, 1], [24, 5, 3], [25, 5, 1], [25, 4, 4], [26, 4, 2], [26, 3, 0]]) g.set(x, y + bob, Hn[i]);
    if (colour === "red") recolor(g, C, ramp("#ece2d0"), (x, y) => x >= 24 && y >= 8 + bob && y <= 11 + bob && x - 24 >= (y - bob - 7) * 0.3);
    g.set(24, 9 + bob, OUTLINE);
    g.set(27, 12 + bob, Mz[0]);
    for (let x = 0; x < W; x++) if (g.get(x, G)) g.set(x, G, x % 3 === 1 ? F[0] : F[2]);
    g.outline(OUTLINE);
    g.hitch = [22, 7 + bob];
    g.yoke = true;
    return g;
  }
  function drawCamel(colour, frame) {
    const C = ramp((COAT[colour] || COAT.sand).coat), M = ramp(COAT.sand.mane), F = ramp("#7a5a3a");
    const W = 30, H = 25, G = 23, g = new Grid(W, H), fl = frame ? 1 : 0, bob = frame ? 1 : 0, legTop = 14;
    const leg = (x, bias, hind) => {
      const kx = hind ? x - 0.8 : x;
      cap(g, [[x, legTop - 1], [kx, legTop + 4.2]], 1.3, 0.9, C, bias);
      cap(g, [[kx, legTop + 4.2], [x, G - 0.8]], 0.9, 0.75, C, bias);
      ell(g, kx, legTop + 4.2, 1.05, 0.9, C, 0, bias);
      g.set(Math.round(x) - 1, G, F[2]); g.set(Math.round(x), G, F[2]); g.set(Math.round(x) + 1, G, F[1]);
    };
    leg(19, -1); leg(9, -1, true);
    cap(g, [[5, 10], [4.4 - fl * 0.5, 13.5], [4.2 - fl, 16]], 0.6, 0.55, C, -1);
    ell(g, 4.2 - fl, 16.6, 0.7, 1.1, M);
    ell(g, 13, 11.2, 7.6, 3.4, C);
    ell(g, 12.4, 7.4, 4, 3.6, C);
    leg(17, 0); leg(7, 0, true);
    cap(g, [[18.6, 11], [21.4, 13.2 + bob * 0.4], [23.6, 10 + bob], [24, 5.6 + bob]], 2.4, 1.3, C);
    ell(g, 25.6, 4.8 + bob, 2.2, 1.5, C, 0.1);
    ell(g, 27.4, 5.8 + bob, 1.2, 1.1, C, 0, -1);
    g.set(23, 3 + bob, C[2]); g.set(23, 2 + bob, C[3]);
    g.set(25, 4 + bob, OUTLINE); g.set(24, 4 + bob, C[1]);
    g.set(28, 6 + bob, C[0]);
    for (const [x, y] of [[21, 9], [22, 11], [22, 8]]) g.set(x, y + bob, M[1]);
    g.outline(OUTLINE);
    g.hitch = [19, 9];
    return g;
  }
  // hand-drawn: at this size a bird reads from its outline far better than from shaded primitives
  const EAGLE = [
    "...........hhh......",
    "..........hhGGh.....",
    ".........hGkkkhyy...",
    ".........GGGeGGyYy..",
    "........gGGGGGGyydd.",
    "........gGGGGGg...d.",
    ".......bggGGGgc.....",
    "......bBBBggBcc.....",
    ".....bWvvWBBBBcc....",
    "....bWvWWvWBBBBc....",
    "....wWWvWWvWBBcc....",
    "...bwWWWvWWWBBBc....",
    "...wWvWWWvWWBBBc....",
    "...wWWvWWWvWBBBc....",
    "..wwWWWvWWWwBBBc....",
    "..wWWWWWvWWwBBBc....",
    ".wwWWWWWWvwbBBBc....",
    ".wWWWwWWWw.bBBcc....",
    "wwWWwWWWw..bbccb....",
    "wWWwtWW....fyfyf....",
    "TttTtt....fyfyfyx...",
    "tT.Tt.....x.x.x.....",
  ];
  const EAGLE_PAL = { h: "#f4cc6c", G: "#d8a040", g: "#a8702a", b: "#4a2e1a", B: "#6e4626", c: "#8e5e34", w: "#33200f", W: "#553820", v: "#7a5232",
    y: "#f0c030", Y: "#fbe27a", d: "#3a3438", k: "#3a2414", e: "#1a1220", t: "#e8dcc4", T: "#bcae94", f: "#f0c030", x: "#2a2428" };
  function drawEagle(colour, frame) {
    const rows = frame ? ["....................", ...EAGLE.slice(0, 6), ...EAGLE.slice(7)] : EAGLE;
    const g = new Grid(rows[0].length + 2, rows.length + 2);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") g.set(x + 1, y + 1, EAGLE_PAL[ch]); }));
    g.outline(OUTLINE);
    g.hitch = [12, 12];
    return g;
  }

  // ---------- wagons ----------
  const Wd = ramp("#8a5a32"), Wdk = ramp("#6a4428"), IRON = ramp("#5a5458"), Au = ramp("#e8b84a");
  function wheel(g, cx, cy, r, opts) {
    opts = opts || {};
    const spokes = r >= 5 ? 8 : 6, S = opts.paint ? ramp(opts.paint) : Wd;
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d > r) continue;
      const lit2 = -dx - dy > 0;
      if (d > r - 0.9) g.set(x, y, IRON[lit2 ? 2 : 1]);
      else if (d > r - 1.8) g.set(x, y, Wdk[lit2 ? 3 : 2]);
      else if (d < (opts.solid ? r : 1.3)) {
        if (opts.solid) g.set(x, y, (Math.floor(x + 0.5 - cx + r) % 3 === 0 ? Wdk[1] : Wdk[lit2 ? 3 : 2]));
        else g.set(x, y, d < 0.8 ? IRON[3] : (opts.gold ? Au : IRON)[2]);
      } else if (!opts.solid) {
        const a = Math.atan2(dy, dx) * spokes / (2 * Math.PI);
        if (Math.abs(a - Math.round(a)) < 0.16 + 0.3 / d) g.set(x, y, S[lit2 ? 3 : 2]);
      }
    }
    if (opts.solid) for (const [x, y] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) g.set(Math.floor(cx) + x, Math.floor(cy) + y, IRON[x + y === 0 ? 3 : 2]);
  }
  function planks(g, x0, y0, x1, y1, R, seam) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const c = y === y0 ? R[3] : y === y1 ? R[1] : (y - y0) % (seam || 2) === 0 ? R[1] : (x * 7 + y * 3) % 11 === 0 ? R[1] : R[2];
      g.set(x, y, c);
    }
  }
  function sack(g, cx, cy, r) { ell(g, cx, cy, r, r * 0.85, ramp("#d8c49a")); g.set(Math.round(cx - 0.4), Math.round(cy - r * 0.85), "#8a7050"); }
  function barrel(g, x, y) {
    planks(g, x, y, x + 4, y + 5, Wd, 99);
    for (let yy = y; yy <= y + 5; yy++) { g.set(x, yy, Wd[1]); g.set(x + 4, yy, Wd[1]); }
    for (const yy of [y + 1, y + 4]) for (let xx = x; xx <= x + 4; xx++) g.set(xx, yy, IRON[2]);
  }
  // front: [x, y] where the shafts leave the bed; rest: where their tips lie when nothing is hitched
  const WAGON = {
    handcart: { W: 27, H: 16, front: [16, 8], rest: [25, 13], shafts: true, draw(g) {
      planks(g, 3, 6, 16, 10, Wd); for (const x of [3, 16]) for (let y = 4; y <= 10; y++) g.set(x, y, Wd[y === 4 ? 3 : 1]);
      sack(g, 7, 4, 2.2); sack(g, 11.5, 4.2, 2); g.vline(2, 10, 13, Wdk[1]);
      wheel(g, 9.5, 10.5, 3.6);
    } },
    donkey_cart: { W: 31, H: 18, front: [18, 10], rest: [29, 15], draw(g) {
      planks(g, 2, 7, 18, 12, Wd); for (const x of [2, 18]) for (let y = 5; y <= 12; y++) g.set(x, y, Wd[y === 5 ? 3 : 1]);
      g.hline(2, 18, 5, Wd[3]);
      barrel(g, 5, 1); sack(g, 13, 4, 2.4);
      wheel(g, 10.5, 11.5, 4.6);
    } },
    horse_cart: { W: 36, H: 20, front: [22, 11], rest: [34, 17], draw(g) {
      planks(g, 2, 7, 22, 13, Wd); for (const x of [2, 8, 15, 22]) for (let y = 5; y <= 13; y++) g.set(x, y, Wd[y === 5 ? 3 : 1]);
      g.hline(2, 22, 5, Wd[3]);
      barrel(g, 4, 0); sack(g, 13, 3.6, 2.6); sack(g, 18, 4.2, 2.2);
      wheel(g, 12, 13, 5.2);
    } },
    ox_wagon: { W: 46, H: 22, front: [34, 14], rest: [44, 19], pole: true, draw(g) {
      ell(g, 18, 6.5, 14, 4.6, ramp("#d8b04a"));
      for (let k = 0; k < 24; k++) { const x = 6 + ((k * 13) % 25), y = 3 + ((k * 7) % 5); if (g.get(x, y)) g.set(x, y, k % 2 ? "#f0d470" : "#a88030"); }
      planks(g, 2, 8, 34, 15, Wdk, 2);
      for (let x = 2; x <= 34; x += 4) for (let y = 5; y <= 15; y++) g.set(x, y, Wdk[y < 8 ? 3 : 1]);
      g.hline(2, 34, 5, Wdk[3]);
      for (const x of [2, 34]) g.set(x, 15, IRON[2]);
      wheel(g, 9, 15.4, 5.2, { solid: true }); wheel(g, 27, 16.4, 4.2, { solid: true });
    } },
    covered_wagon: { W: 42, H: 26, front: [32, 18], rest: [40, 24], draw(g) {
      const Cv = ramp("#e8dcbc");
      for (let y = 3; y <= 15; y++) for (let x = 4; x <= 31; x++) {
        const top = 3 + Math.max(0, Math.abs(x - 17.5) - 11) * 1.6 + (Math.abs(x - 17.5) / 13.5) ** 4 * 2;
        if (y < top) continue;
        const hoop = [6, 12, 18, 24, 30].includes(x);
        g.set(x, y, hoop ? Cv[1] : y < top + 1.5 ? Cv[3] : y > 13 ? Cv[1] : (x < 10 ? Cv[3] : Cv[2]));
      }
      ell(g, 30.6, 10.5, 1.6, 4.2, ["#1e1612", "#2a1e18", "#2a1e18", "#3a2a20", "#3a2a20"]);
      planks(g, 3, 15, 32, 19, Wd);
      g.hline(3, 32, 15, Wd[3]);
      g.set(33, 7, IRON[1]); g.set(33, 8, "#ffd86a"); g.set(33, 9, IRON[1]);
      wheel(g, 10, 19.5, 4.6); wheel(g, 26, 20.5, 3.6);
    } },
    carriage: { W: 46, H: 28, front: [37, 17], rest: [44, 25], draw(g) {
      const Pt = ramp("#8a2a2c"), Rf = ramp("#2e2a30");
      for (let y = 4; y <= 6; y++) for (let x = 9 + (6 - y); x <= 30 - (6 - y); x++) g.set(x, y, y === 4 ? Rf[3] : Rf[2]);
      for (const x of [10, 15, 20, 25, 29]) g.set(x, 3, Au[3]);
      for (let y = 7; y <= 18; y++) {
        const inset = y > 14 ? (y - 14) * 1.2 : 0;
        for (let x = Math.round(8 + inset); x <= Math.round(31 - inset); x++) g.set(x, y, y === 7 ? Pt[3] : x < 11 ? Pt[3] : y > 16 ? Pt[1] : Pt[2]);
      }
      for (let x = 8; x <= 31; x++) g.set(x, 7, Au[3]);
      for (let x = 10; x <= 29; x++) g.set(x, 13, Au[2]);
      for (let y = 8; y <= 17; y++) { g.set(16, y, Au[2]); g.set(23, y, Au[2]); }
      for (let y = 9; y <= 12; y++) for (let x = 17; x <= 22; x++) g.set(x, y, y === 9 || x === 17 || x === 22 ? "#e8d4a8" : y === 10 && (x === 18 || x === 21) ? "#e8d4a8" : "#2c3a52");
      g.set(19, 11, "#5a7090");
      for (let y = 9; y <= 11; y++) for (let x = 10; x <= 14; x++) g.set(x, y, y === 9 ? "#e8d4a8" : "#2c3a52");
      for (let y = 9; y <= 11; y++) for (let x = 25; x <= 28; x++) g.set(x, y, y === 9 ? "#e8d4a8" : "#2c3a52");
      g.set(21, 15, Au[4]);
      planks(g, 32, 12, 37, 14, Wdk, 9); g.hline(32, 37, 11, "#3a2a40"); g.hline(33, 36, 10, "#4a3a50");
      g.vline(32, 8, 11, IRON[1]); g.set(32, 7, Au[3]); g.set(33, 8, "#ffe28a"); g.set(33, 9, Au[2]);
      g.hline(8, 36, 20, IRON[1]);
      for (const [x, y] of [[6, 18], [6, 19], [7, 20], [35, 18], [36, 19]]) g.set(x, y, IRON[2]);
      wheel(g, 12, 21, 5.2, { paint: "#b8862a", gold: true }); wheel(g, 32, 22, 4.2, { paint: "#b8862a", gold: true });
    } },
  };
  function shaft(g, a, b, pole) {
    g.line(a[0], a[1], b[0], b[1], (pole ? Wdk : Wd)[3]);
    g.line(a[0], a[1] + 1, b[0], b[1] + 1, (pole ? Wdk : Wd)[1]);
  }
  function drawWagonGrid(kind, bare) {
    const s = WAGON[kind] || WAGON.horse_cart, g = new Grid(s.W, s.H);
    s.draw(g);
    if (!bare) {
      shaft(g, s.front, s.rest, s.pole);
      if (kind === "handcart") { g.set(s.rest[0], s.rest[1] - 1, Wd[3]); g.set(s.rest[0] + 1, s.rest[1] - 1, Wd[3]); }
    }
    return g;
  }
  function drawTeam(kind, puller, frame) {
    const s = WAGON[kind] || WAGON.horse_cart, w = drawWagonGrid(kind, true);
    const m = rawMount(puller.kind, puller.colour, frame), [mx0] = bbox(m);
    const gap = puller.kind === "ox" ? 3 : 2, ox = s.front[0] + gap - mx0 + 1;
    const H = Math.max(w.h, m.h), W = Math.max(s.W, ox + m.w), g = new Grid(W, H);
    paste(g, w, 0, H - w.h);
    const a = [s.front[0], s.front[1] + H - w.h], hx = m.hitch[0] + ox, hy = m.hitch[1] + H - m.h;
    const b = m.yoke ? [hx - 1, hy + 4] : [hx + 1, hy + 2];
    shaft(g, a, b, m.yoke);
    g.outline(OUTLINE);
    // the near shaft and the harness lie over the animal, so they go on after its outline
    paste(g, m, ox, H - m.h);
    shaft(g, a, b, m.yoke);
    if (m.yoke) {
      for (let y = hy - 1; y <= hy + 5; y++) g.set(hx, y, Wdk[y === hy - 1 ? 3 : 2]);
      g.set(hx - 1, hy - 1, Wdk[3]); g.set(hx + 1, hy - 1, Wdk[3]); g.set(hx - 1, hy - 2, OUTLINE); g.set(hx + 1, hy - 2, OUTLINE);
    } else {
      for (let y = hy - 1; y <= hy + 3; y++) g.set(hx, y, y === hy - 1 ? "#c8a050" : "#4a2e1c");
      g.set(hx + 1, hy, "#4a2e1c"); g.set(hx + 1, hy + 1, "#e8b84a");
    }
    return g;
  }

  // ---------- public API with caching ----------
  const cache = new Map();
  function cached(key, fn) {
    if (!cache.has(key)) cache.set(key, fn());
    return cache.get(key);
  }
  function colourOf(kind, colour) { const c = COLOURS[kind] || COLOURS.horse; return c.includes(colour) ? colour : c[0]; }
  // both frames share one box, so the idle pair never shifts on the page
  function trim(a, b) {
    let top = a.h, x0 = a.w, x1 = 0;
    for (const g of [a, b]) for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y)) { top = Math.min(top, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    return [a, b].map((g) => {
      const t = new Grid(x1 - x0 + 1, g.h - top);
      paste(t, g, -x0, -top);
      t.hitch = [g.hitch[0] - x0, g.hitch[1] - top]; t.yoke = g.yoke;
      return t;
    });
  }
  function rawMount(kind, colour, frame) {
    kind = COLOURS[kind] ? kind : "horse";
    colour = colourOf(kind, colour);
    const draw = (f) => kind === "ox" ? drawOx(colour, f) : kind === "camel" ? drawCamel(colour, f) : kind === "eagle" ? drawEagle(colour, f) : drawEquine(kind, colour, f);
    return cached("r:" + kind + colour, () => trim(draw(0), draw(1)))[frame ? 1 : 0];
  }
  function mountGrid(kind, colour, frame) {
    const g = rawMount(kind, colour, frame);
    return cached("m:" + kind + colourOf(kind, colour) + (frame ? 1 : 0), () => g.toCanvas(1));
  }
  function wagonGrid(kind, puller, frame) {
    if (puller && puller.kind && kind !== "handcart")
      return cached("t:" + kind + puller.kind + colourOf(puller.kind, puller.colour) + (frame ? 1 : 0), () => drawTeam(kind, puller, frame).toCanvas(1));
    return cached("w:" + kind, () => { const g = drawWagonGrid(kind); g.outline(OUTLINE); return g.toCanvas(1); });
  }
  function blit(ctx, cv, x, y, scale) {
    scale = scale || 1;
    const w = cv.width * scale, h = cv.height * scale, smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, Math.round(x), Math.round(y - h), w, h);
    ctx.imageSmoothingEnabled = smooth;
    return { w, h };
  }
  function drawMount(ctx, kind, colour, x, y, frame, scale) { return blit(ctx, mountGrid(kind, colour, frame), x, y, scale); }
  function drawWagon(ctx, kind, x, y, scale, puller, frame) { return blit(ctx, wagonGrid(kind, puller, frame), x, y, scale); }

  // the pets' rhythm: one shared tick, but a mount only shifts every third beat, and not all in step
  const live = new Set();
  let beat = 0;
  setInterval(() => {
    beat++;
    for (const a of live) {
      if (!a.cv.isConnected) { if (++a.idle > 8) live.delete(a); continue; }
      a.idle = 0;
      a.draw((beat + a.phase) % 3 === 0 ? 1 : 0);
    }
  }, 650);
  function mountSprite(kind, colour, scale, opts) {
    opts = opts || {};
    scale = scale || 3;
    const c0 = mountGrid(kind, colour, 0), cv = document.createElement("canvas");
    cv.width = c0.width * scale; cv.height = c0.height * scale;
    cv.className = "mount-px" + (opts.cls ? " " + opts.cls : "");
    const ctx = cv.getContext("2d");
    const draw = (f) => { ctx.clearRect(0, 0, cv.width, cv.height); drawMount(ctx, kind, colour, 0, cv.height, f, scale); };
    draw(0);
    if (opts.animate !== false) live.add({ cv, draw, idle: 0, phase: hash(kind + colour + (opts.seed || "")) % 3 });
    return cv;
  }

  // ---------- the stables yard ----------
  function penBase(W, H, ground, r) {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d"), px = (x, y, c, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w || 1, h || 1); };
    const PL = ["#4e3420", "#553822", "#4a301c"], wallTop = 10, wallBot = ground - 2;
    for (let x = 0; x < W; x++) {
      const p = Math.floor(x / 6), c = x % 6 === 0 ? "#2e1c10" : PL[(p * 7) % 3];
      px(x, wallTop, c, 1, wallBot - wallTop);
      if (x % 6 === 3 && (p * 5) % 4 === 0) px(x, wallTop + 6 + (p % 5) * 4, "#3a2414");
    }
    for (let x = 0; x < W; x++) for (let y = 0; y < wallTop; y++) px(x, y, (x + y * 2) % 8 < 4 ? (y % 3 === 2 ? "#2a1c18" : "#5a3a2a") : (y % 3 === 2 ? "#2a1c18" : "#4a2e22"));
    px(0, wallTop, "#1e140c", W, 2);
    for (let x = 22 + Math.floor(r() * 20); x < W - 30; x += 64 + Math.floor(r() * 24)) {
      px(x, wallTop + 8, "#2e1c10", 26, wallBot - wallTop - 8);
      px(x + 2, wallTop + 10, "#160e08", 22, wallBot - wallTop - 10);
      px(x + 2, wallBot - 14, "#6a4426", 22, 14); px(x + 2, wallBot - 14, "#7a5030", 22, 1);
      for (let k = 0; k < 22; k += 5) px(x + 2 + k, wallBot - 13, "#4a2e1a", 1, 13);
      px(x + 12, wallTop + 2, "#7a5a30", 3, 3);
    }
    for (let y = ground - 2; y < H; y++) for (let x = 0; x < W; x++) {
      const n = Math.sin(x * 0.07 + y * 0.31) + Math.sin(x * 0.023 - y * 0.17 + 1) + r() * 0.5;
      px(x, y, n > 1.25 ? "#a8884a" : n > 0.2 ? "#8a6c40" : n > -0.9 ? "#7c603a" : "#6e5434");
    }
    for (let k = 0; k < W * 0.5; k++) {
      const x = Math.floor(r() * W), y = ground + Math.floor(r() * (H - ground)), c = r() < 0.4 ? "#d8b85a" : "#a8883e";
      if (r() < 0.5) px(x, y, c, 2, 1); else { px(x, y, c); px(x + 1, y - 1, c); }
    }
    for (let x = 4; x < W; x += 34) { px(x, ground - 14, "#3a2414", 3, 14); px(x, ground - 14, "#6a4a2c", 1, 13); }
    for (const y of [ground - 12, ground - 6]) { px(0, y, "#7a5432", W, 2); px(0, y + 2, "#3a2414", W, 1); px(0, y, "#9a7044", W, 1); }
    const bale = (x, y) => { px(x, y - 8, "#3a2a14", 14, 9); px(x + 1, y - 7, "#d8b04a", 12, 7); px(x + 1, y - 7, "#f0d070", 12, 1); px(x + 4, y - 7, "#8a6a2a", 1, 7); px(x + 9, y - 7, "#8a6a2a", 1, 7); };
    bale(W - 18, ground + 2); bale(W - 30, ground + 3); bale(W - 24, ground - 4);
    px(6, ground + 1, "#2e1c10", 16, 6); px(7, ground + 2, "#5a7a8a", 14, 2); px(7, ground + 4, "#6a4426", 14, 2);
    return cv;
  }
  function stablePen(mounts, opts) {
    opts = opts || {};
    const items = (mounts || []).map((m) => ({ name: m.name, kind: m.kind, colour: m.colour, cv: mountGrid(m.kind, m.colour, 0) }))
      .concat((opts.wagons || []).map((w) => ({ name: w.name, kind: w.kind, puller: w.puller, wagon: true, cv: wagonGrid(w.kind, w.puller, 0) })));
    const H = opts.h || 120, ground = Math.round(H * 0.42), rows = [[], []], widths = [0, 0];
    items.sort((a, b) => b.cv.width - a.cv.width);
    for (const it of items) { const k = widths[0] <= widths[1] ? 0 : 1; rows[k].push(it); widths[k] += it.cv.width + 6; }
    const W = Math.max(opts.w || 280, Math.max(...widths) + 40);
    const r = rng(hash(String(opts.seed || "pen")));
    const base = penBase(W, H, ground, r), spots = [], actors = [];
    rows.forEach((row, k) => {
      const feet = k ? H - 8 : ground + 30, total = row.reduce((s, it) => s + it.cv.width, 0) + (row.length - 1) * 6;
      let x = Math.max(28, Math.round((W - total) / 2)) + (k ? 6 : -6);
      for (const it of row) {
        const x0 = x, ph = r() * 7, per = 2.2 + r() * 2.4;
        spots.push({ name: it.name, kind: it.kind, x: x0, y: feet - it.cv.height, w: it.cv.width, h: it.cv.height });
        actors.push({ z: feet, draw(ctx, t) {
          const f = ((t + ph) % per) < 0.7 ? 1 : 0;
          ctx.fillStyle = "rgba(30,18,8,0.35)"; ctx.fillRect(x0 + 2, feet - 1, it.cv.width - 4, 2);
          if (it.wagon) drawWagon(ctx, it.kind, x0, feet, 1, it.puller, f);
          else drawMount(ctx, it.kind, it.colour, x0, feet, f, 1);
        } });
        x += it.cv.width + 6;
      }
    });
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H; cv.className = "mount-pen";
    cv.spots = spots;
    if (window.Anim) Anim.stage(cv, base, actors, { fps: 8 });
    else { const ctx = cv.getContext("2d"); ctx.drawImage(base, 0, 0); for (const a of actors.sort((p, q) => p.z - q.z)) a.draw(ctx, 0); }
    return cv;
  }

  window.MountArt = { COLOURS, WAGONS, mountGrid, mountSprite, wagonGrid, drawMount, drawWagon, stablePen };
})();
