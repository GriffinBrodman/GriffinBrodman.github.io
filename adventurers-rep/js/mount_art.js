/* Mounts and wagons: side-view pixel sprites for every kind and colour in league/content/mounts.py, hitched teams and the stables pen. */
/*
  Two sizes, each drawn natively (never resampled): the pen size for the stables yard and the mount panels, and people scale
  (scene = true) for anywhere an animal stands beside a ~30px hero (the night scenes, the hero page), where a horse's back is
  above a person's chest and the horse is longer than a person is tall.
  MountArt.mountGrid(kind, colour, frame, scene)   -> cached 1x canvas, facing right; frame 0/1 is the idle pair; scene = "rider" is
                                                      people scale with the small kinds (pony, donkey) drawn bigger, for fight replays
  MountArt.mountSprite(kind, colour, scale, opts)  -> a <canvas class="mount-px"> for the page, idling unless opts.animate === false;
                                                      opts.scene for people scale
  MountArt.wagonGrid(kind, puller, frame, scene)   -> cached 1x canvas of the wagon alone (shafts resting on the ground), or the
                                                      hitched team when puller = {kind, colour}
  MountArt.drawMount(ctx, kind, colour, x, y, frame, scale, scene) and MountArt.drawWagon(ctx, kind, x, y, scale, puller, frame, scene)
      draw onto a canvas: x is the left edge, y the ground line (the sprite's bottom edge); both return {w, h} in canvas pixels
  MountArt.cowGrid(frame)                          -> the road companion's milk cow at people scale (0/1 stand, 2 grazes)
  MountArt.stablePen(mounts, opts)                 -> a live 280x120 stables-yard canvas; mounts [{kind, colour, name}],
      opts.wagons [{kind, puller}], opts.w / opts.h / opts.seed; canvas.spots lists [{name, kind, x, y, w, h}] for labels
  MountArt.penBase(W, H, ground, r)                -> the stables-yard backdrop alone (plank wall, stalls, rails, hay, trough), r an Art.rng
*/
(function () {
  "use strict";
  const { Grid, ramp, mix, hash, rng, OUTLINE } = Art;

  const COLOURS = {
    donkey: ["grey", "dun", "brown", "black", "cream"], pony: ["bay", "piebald", "chestnut", "palomino", "buckskin", "appaloosa", "roan"],
    ox: ["red", "black", "cream"],
    horse: ["bay", "chestnut", "grey", "black", "dun", "palomino", "buckskin", "pinto", "appaloosa", "roan", "white-socked"],
    courser: ["grey", "black", "chestnut", "palomino", "white-socked"], destrier: ["black", "grey", "bay", "roan", "pinto"],
    camel: ["sand"], unicorn: ["white"], eagle: ["golden"], skeleton: ["bone"], kelpie: ["sea-green", "black"], stag: ["white"],
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
  const OX = { red: "#9c4c2c", black: "#3a3434", cream: "#dccaa2" }, COW = "#ece6d8";
  const HOOF = "#3a2c28";
  const BONE = "#e4dccb", GLOW = "#8af0a0";
  // the kelpie: a wet dark coat, a mane of river weed with pond-light in it, and water running off; the white stag: grey-blue shade, ivory antlers
  const KELPIE = { "sea-green": { coat: "#2e5852", mane: "#4f7a34", hoof: "#1e3430" }, black: { coat: "#22272c", mane: "#3a6034", hoof: "#16201e" } };
  const WATER = ["#3a7aa8", "#6ab8dc", "#b0e8f6"], SEAGLOW = "#8af0c8";
  const STAG = { coat: "#e2e5ea", mane: "#c4c8d0", hoof: "#4a4448" }, ANTLER = "#cdb68a", MOTE = "#e4f4ff";

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
  // L body half-length, B body half-height, leg, neck, head lengths; neckA / headA in degrees. k is the drawing size: 1 for the
  // stables pen and the panels, SCENE_K beside people in the night scenes, every length re-rasterised at that size (never resampled)
  const EQUINE = {
    horse: { L: 6.2, B: 3.2, leg: 6.5, neck: 5.4, neckA: 58, head: 4.4, headA: 42, ear: 2, mane: 1.0, tail: 1.2 },
    courser: { L: 6.6, B: 2.8, leg: 7.6, neck: 6.0, neckA: 60, head: 4.2, headA: 40, ear: 2, mane: 0.9, tail: 1.0, slim: true },
    destrier: { L: 7.2, B: 3.9, leg: 7.0, neck: 5.6, neckA: 54, head: 4.8, headA: 46, ear: 2, mane: 1.3, tail: 1.5, feather: true, barding: true },
    unicorn: { L: 6.4, B: 3.0, leg: 7.2, neck: 5.8, neckA: 60, head: 4.2, headA: 40, ear: 2, mane: 1.2, tail: 1.4, horn: true },
    pony: { L: 5.0, B: 3.1, leg: 4.4, neck: 4.0, neckA: 56, head: 3.8, headA: 44, ear: 1.5, mane: 1.3, tail: 1.6, shaggy: true },
    donkey: { L: 5.2, B: 2.9, leg: 5.4, neck: 3.4, neckA: 40, head: 4.6, headA: 52, ear: 4.2, mane: 0.6, tail: 0.6, donkey: true },
    skeleton: { L: 6.2, B: 3.2, leg: 6.5, neck: 5.4, neckA: 58, head: 4.4, headA: 42, ear: 2, mane: 0, tail: 0.7, bones: true },
    kelpie: { L: 6.3, B: 3.0, leg: 7.0, neck: 5.8, neckA: 62, head: 4.4, headA: 40, ear: 2, mane: 1.3, tail: 1.5, kelpie: true },
    stag: { L: 5.8, B: 2.7, leg: 7.6, neck: 5.4, neckA: 56, head: 4.0, headA: 46, ear: 2, mane: 0, tail: 0.9, slim: true, stag: true },
  };
  // beside a ~30px hero: a horse's back stands above a person's chest and it is longer than a person is tall; a pony comes
  // up to the hip, a donkey a little lower, a camel's head well over a person's
  const SCENE_K = { horse: 1.7, courser: 1.7, destrier: 1.75, unicorn: 1.7, skeleton: 1.7, kelpie: 1.7, stag: 1.7, pony: 1.5, donkey: 1.4, ox: 1.65, camel: 1.6, eagle: 1.6 };
  const WAGON_K = 1.7;
  // in a fight a rider sits on the small kinds, so they are drawn bigger there (scene = "rider") or the rider hides them;
  // still clearly smaller than a horse
  const RIDER_K = { pony: 1.75, donkey: 1.65 };
  // a pony drawn at people scale stands a little longer in the leg than the pen's stocky one
  const SCENE_SHAPE = { pony: { leg: 1.15 } };
  function sized(p, k) {
    if (k === 1) return p;
    const o = Object.assign({}, p);
    for (const f of ["L", "B", "leg", "neck", "head", "ear", "mane", "tail"]) o[f] = p[f] * k * ((SCENE_SHAPE[p.kind] || {})[f] || 1);
    return o;
  }
  function geometry(p, frame, k) {
    const G = Math.round(p.leg + p.B * 2 + p.neck + (p.stag ? 10 : 6) * k), legTop = G - p.leg, cy = legTop - p.B * 0.45;
    const rumpR = p.B * 1.02, rumpX = 3.4 * k + rumpR, bodyX = rumpX + p.L * 0.72, chestX = bodyX + p.L - 1.8 * k;
    const na = p.neckA * Math.PI / 180, ha = p.headA * Math.PI / 180, bob = frame ? 1 : 0;
    const nb = [chestX + 0.4 * k, cy - p.B * 0.35];
    const nt = [nb[0] + Math.cos(na) * p.neck, nb[1] - Math.sin(na) * p.neck + bob];
    const muzzle = [nt[0] + 0.6 * k + Math.cos(ha) * p.head, nt[1] + Math.sin(ha) * p.head];
    return { G, legTop, cy, rumpR, rumpX, bodyX, chestX, nb, nt, muzzle, W: Math.ceil(muzzle[0] + 2.6 * k), H: G + 2, na };
  }
  function drawEquine(kind, colour, frame, k) {
    k = k || 1;
    const p = sized(Object.assign({ kind }, EQUINE[kind]), k), q = geometry(p, frame, k), big = k > 1;
    if (p.bones) return drawSkeletonHorse(new Grid(q.W, q.H), p, q, frame, k);
    const co = kind === "donkey" ? { coat: DONKEY[colour], mane: "#2e2624", donkey: true } : kind === "kelpie" ? KELPIE[colour] : kind === "stag" ? STAG : COAT[colour];
    const C = ramp(co.coat), M = ramp(co.mane), F = ramp(co.hoof || HOOF);
    const g = new Grid(q.W, q.H);
    const { G, legTop, cy, rumpR, rumpX, bodyX, chestX, nb, nt, muzzle } = q;
    const B = p.B;
    const fl = frame ? 1 : 0;
    const tb = [rumpX - rumpR + 0.6 * k, cy - B * 0.7];
    const tail = p.stag ? [tb, [tb[0] - 1.1 * k, tb[1] + 1.2 * k + fl * 0.4 * k]]
      : p.kelpie ? [tb, [tb[0] - 2.2 * k - fl * 0.6, tb[1] + 2.6 * k], [tb[0] - 1.4 * k - fl * 1.2, tb[1] + 3 * k + p.leg * 0.55], [tb[0] - 2.4 * k - fl, G - 1 * k]]
      : p.donkey
      ? [tb, [tb[0] - 1.2 * k - fl * 0.6, tb[1] + 3 * k], [tb[0] - 1.2 * k - fl, tb[1] + 6 * k]]
      : p.shaggy ? [tb, [tb[0] - 2 * k - fl * 0.5, tb[1] + 2.5 * k], [tb[0] - 2 * k - fl, G - 3 * k]]
        : [tb, [tb[0] - 1.8 * k - fl * 0.6, tb[1] + 2.4 * k], [tb[0] - 1.6 * k - fl * 1.2, tb[1] + 3 * k + p.leg * 0.85]];
    const leg = (x, bias, hind) => {
      // a big near leg starts below the body line, so its shading doesn't streak the flank
      const top = big && !bias ? 1.2 * k : 0;
      const pts = hind ? [[x + 0.4 * k, legTop - 1.5 * k + top], [x - 0.6 * k, legTop + p.leg * 0.45], [x + 0.1 * k, G - 0.5]] : [[x, legTop - 1 * k + top], [x, legTop + p.leg * 0.5], [x, G - 0.5]];
      cap(g, pts, (hind ? 1.5 : 1.25) * k, (p.slim ? 0.8 : 0.95) * k, C, bias);
    };
    const foreX = chestX - 0.6 * k, hindX = rumpX - 0.4 * k;
    leg(foreX - 2.2 * k, -1, false); leg(hindX + 2.2 * k, -1, true);
    cap(g, tail, p.tail, p.tail * 0.75, M, 0);
    if (big && !p.donkey) cap(g, tail.slice(1), p.tail * 0.5, p.tail * 0.3, M, 1);
    ell(g, rumpX, cy - 0.3 * k, rumpR, big ? rumpR * 0.94 : rumpR, C);
    ell(g, bodyX, cy, p.L, B, C);
    ell(g, chestX, cy + 0.2 * k, B * 0.85, B * 0.95, C);
    leg(foreX, 0, false); leg(hindX, 0, true);
    cap(g, [nb, nt], B * 0.8, (p.donkey ? 1.6 : 1.5) * k, C);
    const ha = p.headA * Math.PI / 180, cheek = [nt[0] + 0.5 * k, nt[1] + 0.3 * k];
    ell(g, cheek[0], cheek[1], (p.donkey ? 2.0 : 1.9) * k, (p.donkey ? 1.9 : 1.7) * k, C);
    cap(g, [cheek, muzzle], (p.donkey ? 1.7 : 1.5) * k, (p.donkey ? 1.45 : 1.15) * k, C);
    const lower = legTop + p.leg * 0.55;
    if (co.points) recolor(g, C, M, (x, y) => y >= lower);
    if (co.sock || p.feather) recolor(g, C, ramp("#ece6da"), (x, y) => y >= G - 1.5 * k - (p.feather ? 0.5 * k : 0) && x >= foreX - 1 * k && x <= foreX + 1 * k);
    if (co.patches) {
      const P = ramp(co.patches), spots = [[bodyX - 1 * k, cy - 0.5 * k, 2.6 * k, 2 * k], [rumpX, cy + 0.6 * k, 2 * k, 2.2 * k], [nt[0] - 0.5 * k, nt[1] + 0.8 * k, 1.8 * k, 1.6 * k], [chestX, cy + 2.5 * k, 1.6 * k, 1 * k]];
      recolor(g, C, P, (x, y) => spots.some(([sx, sy, rx, ry]) => ((x + 0.5 - sx) / rx) ** 2 + ((y + 0.5 - sy) / ry) ** 2 <= 1));
    }
    if (co.socks) recolor(g, C, ramp("#ece6da"), (x, y) => y >= G - 2 * k);
    if (co.blanket) {
      const Wb = ramp("#ece6da"), inBlanket = (x, y) => ((x + 0.5 - rumpX - 0.6 * k) / (rumpR + 1.4 * k)) ** 2 + ((y + 0.5 - cy + 0.8 * k) / (B * 0.95)) ** 2 <= 1;
      recolor(g, C, Wb, inBlanket);
      recolor(g, Wb, M, big ? (x, y) => inBlanket(x, y) && hash(x + "/" + y) % 4 === 0 && hash((x - 1) + "/" + y) % 4 !== 0 : (x, y) => inBlanket(x, y) && y % 2 === 0 && (x + y * 1.5) % 3 === 0);
    }
    if (co.roan) recolor(g, C, ramp(co.roan), (x, y) => y < legTop + 1 && hash(x + ":" + y) % 5 < 2);
    if (co.dapple) for (let y = 0; y < q.H; y++) for (let x = 0; x < q.W; x++) if (g.get(x, y) === C[2] && (x * 3 + y * 5) % 7 === 0 && y < legTop + 1) g.set(x, y, C[3]);
    if (co.donkey) {
      const P = ramp(mix(co.coat, "#f2ece0", 0.7));
      recolor(g, C, P, (x, y) => (Math.hypot(x + 0.5 - muzzle[0], y + 0.5 - muzzle[1]) < 1.8 * k) || (y >= cy + B * 0.45 && y < legTop + 1.5 * k && x > rumpX - 1 * k && x < chestX + 1 * k));
      for (let x = Math.floor(rumpX - 1 * k); x <= chestX; x++) for (let y = 0; y < q.H; y++) if (C.includes(g.get(x, y))) { g.set(x, y, M[2]); break; }
      for (let j = 0; j < Math.round(3 * k); j++) g.set(Math.round(chestX - 0.5 * k), Math.round(cy - B + 0.6 * k + j), M[1]);
    }
    if (co.stripe) for (let x = Math.floor(rumpX); x <= chestX - 1 * k; x++) for (let y = 0; y < q.H; y++) if (C.includes(g.get(x, y))) { g.set(x, y, M[1]); break; }
    // the mane follows the top edge of the neck
    const nx = Math.cos(q.na), ny = -Math.sin(q.na), px = ny, py = -nx;
    const off = (t, r) => [nb[0] + nx * t + px * r, nb[1] + ny * t + py * r + (t / p.neck) * (frame ? 1 : 0)];
    if (p.mane) {
      const r0 = B * 0.8, len = Math.hypot(nt[0] - nb[0], nt[1] - nb[1]);
      if (p.donkey) cap(g, [off(len * 0.3, r0 - 0.2 * k), off(len, 1.7 * k)], 0.7 * k, 0.7 * k, M);
      else cap(g, [off(len * 0.18, r0 - 0.3 * k), off(len * 1.02, 1.3 * k)], p.mane, p.mane * 0.8, M);
      if (big && !p.donkey) cap(g, [off(len * 0.25, r0 - 0.1 * k), off(len * 0.95, 1.4 * k)], p.mane * 0.45, p.mane * 0.35, M, 1);
      if (p.shaggy) {
        cap(g, [off(len * 0.25, r0 - 1.2 * k), off(len * 0.85, 0.4 * k)], 0.9 * k, 0.8 * k, M, -1);
        if (big) cap(g, [[nt[0] + 0.6 * k, nt[1] - 1.3 * k], [nt[0] + 1.9 * k, nt[1] - 0.2 * k]], 0.8 * k, 0.5 * k, M, 1);
        else { g.set(Math.round(nt[0] + 1.2), Math.round(nt[1] - 1.2), M[3]); g.set(Math.round(nt[0] + 1.9), Math.round(nt[1] - 0.6), M[2]); }
      } else if (!p.donkey) {
        if (big) cap(g, [[nt[0] + 0.4 * k, nt[1] - 1.2 * k], [nt[0] + 1.2 * k, nt[1] - 0.5 * k]], 0.55 * k, 0.4 * k, M, 1);
        else g.set(Math.round(nt[0] + 0.8), Math.round(nt[1] - 1.2), M[2]);
      }
    }
    const ex = Math.round(nt[0] + 0.3 * k), ey = Math.round(nt[1] - 1.6 * k);
    if (p.donkey) {
      cap(g, [[ex - 0.2 * k, ey + 0.8 * k], [ex - 1.4 * k, ey - p.ear + 0.6 * k]], 0.85 * k, 0.7 * k, C);
      cap(g, [[ex + 0.6 * k, ey + 0.8 * k], [ex + 0.2 * k, ey - p.ear + 1 * k]], 0.8 * k, 0.65 * k, C, -1);
      g.set(Math.round(ex - 1.2 * k), Math.round(ey - p.ear + 1.5 * k), M[1]);
      if (big) g.set(Math.round(ex - 1.3 * k), Math.round(ey - p.ear + 1.5 * k) + 1, M[1]);
    } else if (p.stag) {
      // a deer's ears stand out sideways, under the antlers
      cap(g, [[ex - 0.1 * k, ey + 0.8 * k], [ex - 2 * k, ey - 0.1 * k]], 0.8 * k, 0.45 * k, C, -1);
      if (!big) g.set(ex - 2, ey, C[3]);
    } else if (big) {
      cap(g, [[ex, ey + 1], [ex + 0.3 * k, ey - p.ear + 1.2]], 0.95 * k, 0.45 * k, C);
      g.set(ex, ey, C[1]);
    } else {
      for (let j = 0; j < p.ear; j++) g.set(ex, ey - j, j ? C[2] : C[3]);
      if (!p.shaggy) g.set(ex - 1, ey + 1, C[1]);
    }
    if (p.horn) {
      const H = ramp("#e8c058");
      if (big) {
        const b0 = [nt[0] + 1.8 * k, nt[1] - 1.4 * k], b1 = [b0[0] + 2.9 * k, b0[1] - 3.7 * k];
        cap(g, [b0, b1], 0.95 * k * 0.8, 0.35, H, 1);
        // the spiral: a darker groove winding up the horn
        for (let t = 0.1; t < 0.9; t += 0.2) g.set(Math.round(b0[0] + (b1[0] - b0[0]) * t + 0.4), Math.round(b0[1] + (b1[1] - b0[1]) * t + 0.4), H[2]);
      } else for (let j = 0; j < 5; j++) g.set(Math.round(nt[0] + 1.8 + j * 0.7), Math.round(nt[1] - 1.4 - j * 0.9), j % 2 ? H[2] : H[4]);
    }
    if (co.blaze || co.star) {
      const W = "#f2ece2", step = big ? 0.08 : 0.18;
      const t0 = co.star ? (big ? 0.3 : 0.12) : 0.1, t1 = co.star ? (big ? 0.45 : 0.3) : 0.9;
      for (let t = t0; t < t1; t += step) g.set(Math.round(cheek[0] + (muzzle[0] - cheek[0]) * t + 0.4 * k), Math.round(cheek[1] + (muzzle[1] - cheek[1]) * t - 0.9 * k), W);
    }
    for (let y = big ? G - 1 : G; y <= G; y++) for (let x = 0; x < q.W; x++) if (g.get(x, y)) g.set(x, y, x === Math.floor(foreX + 1) || x === Math.floor(hindX + 1) ? F[1] : y < G ? F[3] : F[2]);
    if (p.feather) for (const fx of [foreX, hindX, foreX - 2.2 * k, hindX + 2.2 * k]) for (const dx of big ? [-2, -1, 0, 1, 2, 3] : [-1, 0, 1, 2]) {
      g.set(Math.floor(fx) + dx, G - 1, dx === (big ? 3 : 2) ? "#cfc6b6" : "#efe8da");
      if (big && dx > -2 && dx < 3) g.set(Math.floor(fx) + dx, G - 2, dx === 2 ? "#cfc6b6" : "#f6f2ea");
    }
    const eye = [Math.round(nt[0] + 1.1 * k + Math.cos(ha) * 0.4 * k), Math.round(nt[1] - 0.4 * k)];
    g.set(eye[0], eye[1], OUTLINE);
    if (big) g.set(eye[0] - 1, eye[1] - 1, C[1]);
    g.set(Math.round(muzzle[0] + 0.3 * k), Math.round(muzzle[1] - 0.2 * k), C[0]);
    if (p.barding) barding(g, p, q, frame, [C, co.patches && ramp(co.patches), co.roan && ramp(co.roan)].filter(Boolean), k);
    if (p.kelpie) kelpieWeed(g, p, q, C, M, frame, k, off);
    if (p.stag) { g.set(Math.round(muzzle[0] + 0.3 * k), Math.round(muzzle[1] - 0.2 * k), "#3a3036"); }
    g.outline(OUTLINE);
    if (p.kelpie) kelpieWater(g, p, q, frame, k, foreX, hindX, eye);
    if (p.stag) antlers(g, ex, ey, k);
    if (p.stag) for (const [dx, dy] of frame ? [[-5, -3], [1.5, -9], [-6.5, -8]] : [[-4, -6], [2.5, -7], [-7, -4.5]]) {
      const x = Math.round(ex + dx * k), y = Math.round(ey + dy * k);
      if (y >= 0 && !g.get(x, y)) g.set(x, y, MOTE);
    }
    if (p.horn) {
      const sp = frame ? [[nt[0] + 6 * k, nt[1] - 6 * k], [rumpX - 3 * k, cy - 3 * k], [bodyX + 1 * k, cy - B - 3 * k]] : [[nt[0] + 5 * k, nt[1] - 3 * k], [rumpX - 2 * k, cy + 3 * k], [bodyX - 2 * k, cy - B - 2 * k]];
      for (const [sx, sy] of sp) { const x = Math.round(sx), y = Math.round(sy); if (!g.get(x, y)) g.set(x, y, "#fff6c8"); }
      const tip = big ? [Math.round(nt[0] + 1.8 * k + 2.9 * k), Math.round(nt[1] - 1.4 * k - 3.7 * k) - 2] : [Math.round(nt[0] + 1.8 + 4 * 0.7), Math.round(nt[1] - 1.4 - 4 * 0.9) - 1];
      if (!g.get(tip[0], tip[1])) g.set(tip[0], tip[1], frame ? "#fffbe6" : "#fff2a8");
    }
    g.hitch = [Math.round(nb[0] + 0.5), Math.round(nb[1] + 0.5)];
    return g;
  }
  // weed hanging from the crest and over the face, and a wet sheen along the back
  function kelpieWeed(g, p, q, C, M, frame, k, off) {
    const { nb, nt, rumpX, chestX } = q, big = k > 1, len = Math.hypot(nt[0] - nb[0], nt[1] - nb[1]), fl = frame ? 1 : 0;
    for (let i = 0; i < 5; i++) {
      const [sx, sy] = off(len * (0.12 + i * 0.2), p.B * 0.8 - 0.5 * k), drop = (i % 2 ? 2.2 : 3.4) * k;
      if (big) cap(g, [[sx, sy], [sx - 0.7 * k, sy + drop * 0.6], [sx - 0.4 * k - fl * 0.3 * k, sy + drop]], 0.5 * k, 0.3 * k, M, i % 2 ? 0 : -1);
      else for (let j = 0; j <= Math.round(drop); j++) g.set(Math.round(sx - (j > 1 ? 1 : 0)), Math.round(sy + j), M[j % 2 ? 1 : 2]);
    }
    if (big) cap(g, [[nt[0] + 0.7 * k, nt[1] - 1.1 * k], [nt[0] + 1.7 * k, nt[1] + 0.9 * k]], 0.55 * k, 0.35 * k, M, 0);
    else g.set(Math.round(nt[0] + 1.3), Math.round(nt[1] - 0.6), M[2]);
    for (let x = Math.floor(rumpX - 1 * k); x <= chestX; x += big ? 2 : 3) for (let y = 0; y < g.h; y++) if (C.includes(g.get(x, y))) { g.set(x, y + 1, C[4]); break; }
  }
  // drawn after the outline, so the water hangs free: drops off the belly and the weed, a ripple round the hooves, pond-light in the mane
  function kelpieWater(g, p, q, frame, k, foreX, hindX, eye) {
    const { G, cy, bodyX, chestX, nb } = q, big = k > 1, B = p.B, fall = frame ? 1.4 * k : 0;
    const drops = [[bodyX - 2.2 * k, cy + B + 2.4 * k + fall], [bodyX + 1.4 * k, cy + B + 3.6 * k - fall * 0.6], [bodyX - 0.4 * k, cy + B + 5 * k - fall],
      [q.rumpX - q.rumpR - 3.4 * k, G - 3 * k + fall * 0.5], [chestX + 2.4 * k, cy + B + 2.2 * k + fall * 0.8]];
    for (const [dx, dy] of drops) {
      const x = Math.round(dx), y = Math.round(dy);
      if (g.get(x, y) || g.get(x, y + 1)) continue;
      g.set(x, y, WATER[2]);
      g.set(x, y + 1, WATER[1]);
      if (big && !g.get(x, y + 2)) g.set(x, y + 2, WATER[0]);
    }
    const y = g.h - 1, x0 = Math.floor(hindX - 4 * k), x1 = Math.ceil(foreX + 4 * k);
    for (let x = x0; x <= x1; x++) if (!g.get(x, y) && (x + (frame ? 1 : 0)) % 3 !== 0) g.set(x, y, (x + (frame ? 1 : 0)) % 3 === 1 ? WATER[1] : WATER[0]);
    const mane = [];
    for (let yy = 0; yy < g.h; yy++) for (let x = 0; x < g.w; x++) { const c = g.get(x, yy); if (c && c !== OUTLINE && ramp(KELPIE.black.mane).concat(ramp(KELPIE["sea-green"].mane)).includes(c)) mane.push([x, yy]); }
    const n = big ? 7 : 4;
    mane.filter(([x, yy]) => hash(x + "~" + yy) % 5 === (frame ? 1 : 0)).slice(0, n).forEach(([x, yy]) => g.set(x, yy, SEAGLOW));
    g.set(eye[0], eye[1], "#4ad8b0");
  }
  // at pen size the antlers are placed by hand, the far one (F) behind the near one (N), and go on after the outline with a shadow on
  // their lower right, since a full outline would close every gap between the tines
  const ANTLER_PEN = ["F.F...N.N", ".FF...NN.", "..F...N..", "F.F...N.N", ".FF...NN.", "..F...N..", "...F.N...", "....N...."];
  // people scale: each half is one antler from the middle of the head outward, the far one mirrored on the left
  const ANTLER_HALF = ["....N..N", "....N.N.", "..N.NN..", "..N.N...", "...NN..N", "...N..N.", "...N.N..", "...NN...", "..NN....", ".NN.....", "NN......", "N......."];
  const ANTLER_SCENE = ANTLER_HALF.map((r) => [...r].reverse().join("").replace(/N/g, "F") + r);
  function antlers(g, ex, ey, k) {
    const A = ramp(ANTLER), far = mix(A[0], "#6a6266", 0.3), pat = k > 1 ? ANTLER_SCENE : ANTLER_PEN, w = (pat[0].length - 1) / 2;
    const mine = new Set(), n = pat.length;
    pat.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === ".") return;
      const x = Math.round(ex - w + i), y = ey - n + 1 + j;
      g.set(x, y, ch === "N" ? (j % 3 === 0 ? A[3] : A[2]) : far);
      mine.add(x + "," + y);
    }));
    for (const key of mine) {
      const [x, y] = key.split(",").map(Number);
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) if (!g.get(x + dx, y + dy) && !mine.has(x + dx + "," + (y + dy))) g.set(x + dx, y + dy, OUTLINE);
    }
  }
  // the warhorse's caparison: a cloth over the back to the knees, gold-hemmed, and a steel chanfron on the face
  function barding(g, p, q, frame, coats, k) {
    const R = ramp("#9a2a26"), Au = ramp("#e8b84a"), St = ramp("#a8b0b8"), big = k > 1;
    const { legTop, cy, rumpX, chestX, bodyX, nt, muzzle } = q, hem = Math.floor(legTop + p.leg * 0.3), x0 = Math.floor(rumpX - 2.6 * k), x1 = Math.ceil(chestX + 1.6 * k);
    for (const c of coats) recolor(g, c, R, (x, y) => x >= x0 && x <= x1 && y >= cy - p.B - 1 * k && y < hem);
    for (let x = x0; x <= x1; x++) {
      if (!R.includes(g.get(x, hem - 1)) && !g.get(x, hem)) continue;
      g.set(x, hem, Au[(x + (frame ? 1 : 0)) % 3 ? 2 : 3]);
      if ((x + (frame ? 1 : 0)) % 3 === 0) g.set(x, hem + 1, Au[1]);
    }
    for (let x = x0; x <= x1; x++) for (let y = 0; y < hem; y++) if (R.includes(g.get(x, y))) { g.set(x, y, Au[3]); break; }
    const ex = Math.round(bodyX), ey = Math.round(cy + 0.5 * k);
    const cross = big ? [[0, -2, 4], [0, -1, 3], [-2, 0, 3], [-1, 0, 3], [0, 0, 2], [1, 0, 2], [2, 0, 1], [0, 1, 2], [0, 2, 1]] : [[0, -1, 4], [-1, 0, 3], [0, 0, 2], [1, 0, 2], [0, 1, 1]];
    for (const [dx, dy, i] of cross) g.set(ex + dx, ey + dy, Au[i]);
    for (let t = 0.15; t <= 0.85; t += big ? 0.07 : 0.14) g.set(Math.round(nt[0] + 0.6 * k + (muzzle[0] - nt[0]) * t), Math.round(nt[1] - 0.6 * k + (muzzle[1] - nt[1]) * t), t < 0.3 ? St[4] : St[3]);
  }
  function drawSkeletonHorse(g, p, q, frame, k) {
    const Bn = ramp(BONE), D = "#2a2230", big = k > 1;
    const { G, legTop, cy, rumpR, rumpX, bodyX, chestX, nb, nt, muzzle } = q, B = p.B;
    const bone = (pts, r, bias) => cap(g, pts, r, r, Bn, bias);
    const legs = (bias, dx) => {
      const fx = chestX - 0.6 * k + dx, hx = rumpX - 0.4 * k - dx;
      bone([[fx, legTop - 0.5 * k], [fx, legTop + p.leg * 0.5]], 0.75 * k, bias); bone([[fx, legTop + p.leg * 0.5], [fx, G - 0.5]], 0.6 * k, bias);
      bone([[hx + 0.4 * k, legTop - 1 * k], [hx - 0.6 * k, legTop + p.leg * 0.45]], 0.8 * k, bias); bone([[hx - 0.6 * k, legTop + p.leg * 0.45], [hx + 0.1 * k, G - 0.5]], 0.6 * k, bias);
      for (const [x, y] of [[fx, legTop + p.leg * 0.5], [hx - 0.6 * k, legTop + p.leg * 0.45]]) ell(g, x, y, 1 * k, 1 * k, Bn, 0, bias);
    };
    legs(-1, -2.2 * k);
    const fl = frame ? 1 : 0, n = Math.round(6 * k);
    for (let j = 0; j < n; j++) { const t = j * 5 / (n - 1); g.set(Math.round(rumpX - rumpR + 0.4 * k - t * 0.3 * k - fl * t * 0.25), Math.round(cy - B * 0.7 + 0.5 * k + t * 1.3 * k), j % 2 ? Bn[2] : Bn[3]); }
    ell(g, bodyX + 0.4 * k, cy - 0.3 * k, p.L * 0.74, B * 0.72, [D, D, D, D, D]);
    for (let x = Math.round(rumpX + 1.5 * k); x <= chestX; x += 2) {
      const top = cy - B * 0.7, bot = cy + B * 0.5 - Math.abs(x - bodyX) * 0.12;
      for (let y = Math.round(top); y <= bot; y++) g.set(x + (y > cy + 1 * k ? 1 : 0), y, y < cy - 1 * k ? Bn[3] : Bn[2]);
    }
    bone([[rumpX - rumpR + 0.8 * k, cy - B * 0.65], [chestX + 0.6 * k, cy - B * 0.75]], 0.7 * k);
    for (let x = Math.round(rumpX); x <= chestX; x += 2) g.set(x, Math.round(cy - B * 0.75 - 1 * k), Bn[3]);
    ell(g, rumpX, cy - 0.6 * k, 2.3 * k, 1.8 * k, Bn);
    g.set(Math.round(rumpX), Math.round(cy - 0.4 * k), D);
    if (big) g.set(Math.round(rumpX) + 1, Math.round(cy - 0.4 * k), D);
    ell(g, chestX - 0.4 * k, cy - 0.4 * k, 1.3 * k, 2.3 * k, Bn, -0.3);
    legs(0, 0);
    for (let t = 0; t <= 1.001; t += big ? 0.125 : 0.2) ell(g, nb[0] + (nt[0] - nb[0]) * t, nb[1] - 0.5 * k + (nt[1] - nb[1] + 0.5 * k) * t, 1.05 * k, 1.05 * k, Bn);
    const cheek = [nt[0] + 0.5 * k, nt[1] + 0.3 * k];
    ell(g, cheek[0], cheek[1], 2.0 * k, 1.7 * k, Bn);
    cap(g, [cheek, muzzle], 1.4 * k, 1.0 * k, Bn);
    const ex = Math.round(nt[0] + 1 * k), ey = Math.round(nt[1] - 0.3 * k);
    g.set(ex, ey, D); g.set(ex + 1, ey, D); g.set(ex, ey + 1, D); g.set(ex + 1, ey + 1, D);
    if (big) { g.set(ex - 1, ey, D); g.set(ex - 1, ey + 1, D); g.set(ex, ey - 1, D); }
    if (big) cap(g, [[nt[0] + 0.2 * k, nt[1] - 1.2 * k], [nt[0] + 0.4 * k, nt[1] - 2.4 * k]], 0.6 * k, 0.4 * k, Bn, 1);
    else g.set(Math.round(nt[0] + 0.3), Math.round(nt[1] - 2), Bn[3]);
    const ha = p.headA * Math.PI / 180;
    for (let t = 0.45; t <= 0.95; t += big ? 0.1 : 0.18) g.set(Math.round(cheek[0] + (muzzle[0] - cheek[0]) * t + Math.sin(ha) * 1.2 * k), Math.round(cheek[1] + (muzzle[1] - cheek[1]) * t + Math.cos(ha) * 1.2 * k), (Math.round(t * 10) % 2) ? D : Bn[4]);
    g.set(Math.round(muzzle[0] - 0.4 * k), Math.round(muzzle[1] - 1 * k), D);
    for (let x = 0; x < g.w; x++) if (g.get(x, G)) g.set(x, G, Bn[1]);
    g.outline(OUTLINE);
    g.set(ex + (frame ? 0 : 1), ey, GLOW); g.set(ex + (frame ? 1 : 0), ey + 1, frame ? "#3a6a48" : "#4a8a5a");
    g.hitch = [Math.round(nb[0] + 0.5), Math.round(nb[1] + 0.5)];
    return g;
  }

  // ---------- ox, camel, eagle ----------
  // laid out on the pen-size grid; at a bigger k every shape is re-rasterised at k times the size
  function scaler(g, k) {
    const S = (pts) => pts.map(([x, y]) => [x * k, y * k]);
    return { E: (cx, cy, rx, ry, c, a, b) => ell(g, cx * k, cy * k, rx * k, ry * k, c, a, b), T: (pts, r0, r1, c, b) => cap(g, S(pts), r0 * k, r1 * k, c, b),
      P: (x, y, c) => g.set(Math.round(x * k), Math.round(y * k), c) };
  }
  // colour "cow" is a drover's milk cow (white with brown patches, short horns, an udder); frame 2 grazes, head down
  function drawOx(colour, frame, k) {
    k = k || 1;
    const cow = colour === "cow", base = cow ? COW : OX[colour] || OX.red;
    const C = ramp(base), dark = colour === "black", Hn = ramp("#d8c490"), F = ramp(HOOF), big = k > 1;
    const W = Math.round(30 * k), G = Math.round(18 * k), H = G + 2, g = new Grid(W, H), fl = frame ? 1 : 0, bob = frame === 2 ? 4 : frame ? 1 : 0;
    const { E, T, P } = scaler(g, k), legTop = 13;
    const leg = (x, bias) => T([[x, legTop - 2], [x, G / k - 0.5 / k]], 1.6, 1.25, C, bias);
    leg(19.5, -1); leg(8.6, -1);
    T([[4.6, 8], [3.4 - fl * 0.6, 12], [3.2 - fl * 1.2, 15.5]], 0.6, 0.55, C, -1);
    E(3.2 - fl * 1.2, 16.2, 0.9, 1.3, ramp(dark ? "#1e1a1c" : mix(base, "#2a1e1a", 0.6)));
    E(8, 9.6, 3.9, 4.0, C);
    E(13.2, 10, 7.2, 4.1, C);
    E(19.2, 8.8, 3.4, 3.6, C);
    if (cow) E(15.2, 13.6, 1.9, 1.3, ramp("#e8a4a0"), 0, -1);
    leg(17.5, 0); leg(6.6, 0);
    E(21.4, 13.2 + bob * 0.5, 1.4, 2.2, C, 0, -1);
    T([[19.5, 9.2], [22.6, 9.4 + bob]], 3.2, 2.6, C);
    E(21.2, 8.2 + bob, 1.5, 0.75, C, 0.35, -1);
    T([[23.4, 8.6 + bob], [26, 12.2 + bob]], 2.4, 1.8, C);
    const Mz = ramp(dark ? "#5a5050" : colour === "cream" || cow ? "#c89a84" : "#d0a898");
    if (cow) {
      const P = ramp("#6a4630"), spots = [[8.5, 8.2, 3, 2.6], [14.6, 11.4, 2.6, 1.8], [19.2, 7.4, 2, 2.2], [4.2, 11, 1.4, 2]];
      recolor(g, C, P, (x, y) => spots.some(([sx, sy, rx, ry]) => ((x + 0.5 - sx * k) / (rx * k)) ** 2 + ((y + 0.5 - sy * k) / (ry * k)) ** 2 <= 1));
    }
    E(26.5, 12.8 + bob, 1.6, 1.3, Mz);
    if (big) T(cow ? [[23.4, 6.8 + bob], [24.4, 5.6 + bob]] : [[23.2, 6.4 + bob], [24.6, 5.2 + bob], [25.6, 3.6 + bob]], 0.75, 0.3, Hn, 1);
    else for (const [x, y, i] of [[23, 6, 1], [24, 6, 1], [24, 5, 3], [25, 5, 1], [25, 4, 4], [26, 4, 2], [26, 3, 0]]) g.set(x, y + bob, Hn[i]);
    if (colour === "red") recolor(g, C, ramp("#ece2d0"), (x, y) => x >= 24 * k && y >= (8 + bob) * k && y <= (11 + bob) * k + (k - 1) && x - 24 * k >= (y - bob * k - 7 * k) * 0.3);
    P(24, 9 + bob, OUTLINE);
    P(27, 12 + bob, Mz[0]);
    for (let y = big ? G - 1 : G; y <= G; y++) for (let x = 0; x < W; x++) if (g.get(x, y)) g.set(x, y, Math.floor(x / k) % 3 === 1 ? F[0] : F[2]);
    g.outline(OUTLINE);
    g.hitch = [Math.round(22 * k), Math.round((7 + bob) * k)];
    g.yoke = true;
    return g;
  }
  function drawCamel(colour, frame, k) {
    k = k || 1;
    const C = ramp((COAT[colour] || COAT.sand).coat), M = ramp(COAT.sand.mane), F = ramp("#7a5a3a"), big = k > 1;
    const W = Math.round(30 * k), G = Math.round(23 * k), H = G + 2, g = new Grid(W, H), fl = frame ? 1 : 0, bob = frame ? 1 : 0, legTop = 14;
    const { E, T, P } = scaler(g, k), Gu = G / k;
    const leg = (x, bias, hind) => {
      const kx = hind ? x - 0.8 : x;
      T([[x, legTop - 1], [kx, legTop + 4.2]], 1.3, 0.9, C, bias);
      T([[kx, legTop + 4.2], [x, Gu - 0.8]], 0.9, 0.75, C, bias);
      E(kx, legTop + 4.2, 1.05, 0.9, C, 0, bias);
      for (let px = Math.round((x - 1) * k); px <= Math.round((x + 1) * k); px++) g.set(px, G, px === Math.round((x + 1) * k) ? F[1] : F[2]);
    };
    leg(19, -1); leg(9, -1, true);
    T([[5, 10], [4.4 - fl * 0.5, 13.5], [4.2 - fl, 16]], 0.6, 0.55, C, -1);
    E(4.2 - fl, 16.6, 0.7, 1.1, M);
    E(13, 11.2, 7.6, 3.4, C);
    E(12.4, 7.4, 4, 3.6, C);
    leg(17, 0); leg(7, 0, true);
    T([[18.6, 11], [21.4, 13.2 + bob * 0.4], [23.6, 10 + bob], [24, 5.6 + bob]], 2.4, 1.3, C);
    E(25.6, 4.8 + bob, 2.2, 1.5, C, 0.1);
    E(27.4, 5.8 + bob, 1.2, 1.1, C, 0, -1);
    if (big) { T([[23.2, 3.6 + bob], [22.9, 2.1 + bob]], 0.6, 0.4, C, 1); P(25, 4 + bob, OUTLINE); P(24.4, 3.6 + bob, C[1]); g.set(Math.round(25 * k) + 1, Math.round((4 + bob) * k) - 1, C[1]); }
    else { g.set(23, 3 + bob, C[2]); g.set(23, 2 + bob, C[3]); g.set(25, 4 + bob, OUTLINE); g.set(24, 4 + bob, C[1]); }
    P(28, 6 + bob, C[0]);
    if (big) for (const [x, y] of [[21, 9], [22, 11], [22, 8], [21.6, 12.2], [22.6, 9.6]]) T([[x, y + bob], [x - 0.3, y + 0.7 + bob]], 0.45, 0.35, M);
    else for (const [x, y] of [[21, 9], [22, 11], [22, 8]]) g.set(x, y + bob, M[1]);
    g.outline(OUTLINE);
    g.hitch = [Math.round(19 * k), Math.round(9 * k)];
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
  // the giant eagle standing among people: the same bird, hand-drawn again at its full size
  const EAGLE_BIG = [
    "..................hhhh..........",
    "................hhhGGGh.........",
    "...............hhGGGGGGh........",
    "..............hGGkkkkGGhyy......",
    "..............GGGGkeGGGGyYYy....",
    ".............gGGGGGGGGGGyyYYy...",
    ".............gGGGGGGGGGGyyyddd..",
    "............ggGGGGGGGGGg....dd..",
    "............gggGGGGGGGgc.....d..",
    "...........bggggGGGGggcc........",
    "..........bBBBgggggBBcccc.......",
    ".........bBBBBBBggBBBBcccc......",
    "........bWvvWWBBBBBBBBBccc......",
    ".......bWvWWvvWBBBBBBBBBccc.....",
    "......bWWvWWWvWWBBBBBBBBBcc.....",
    "......wWWWvWWWWvWBBBBBBBBcc.....",
    ".....bwWWWWvWWWWvWBBBBBBBccc....",
    ".....wWWvWWWvWWWWvBBBBBBBBcc....",
    "....bwWWWvWWWWvWWWBBBBBBBBcc....",
    "....wWWvWWWvWWWWvWBBBBBBBBcc....",
    "...bwWWWvWWWWvWWWWBBBBBBBBcc....",
    "...wWWWWWvWWWWvWWWwBBBBBBBcc....",
    "..bwWWvWWWWvWWWWvWwBBBBBBccc....",
    "..wWWWWvWWWWWvWWWWwbBBBBBBcc....",
    "..wWWWWWWvWWWWWvWwbBBBBBBccc....",
    ".wwWWWWvWWWWvWWWw.bBBBBBcccc....",
    ".wWWWWWWWvWWWWWw..bbBBBccccb....",
    "wwWWWWWWWWvWWww...bbcccccbb.....",
    "wWWwwWWWWWWWw.....bcccccccb.....",
    "wWwtWwWWWw........ffyfyyfyf.....",
    "TttTtttTt........fyyfyyfyyfx....",
    "TtTTttTt........fyfyyfyyfyyx....",
    "tT.tT.Tt........x.x..x..x.x.....",
  ];
  const EAGLE_PAL = { h: "#f4cc6c", G: "#d8a040", g: "#a8702a", b: "#4a2e1a", B: "#6e4626", c: "#8e5e34", w: "#33200f", W: "#553820", v: "#7a5232",
    y: "#f0c030", Y: "#fbe27a", d: "#3a3438", k: "#3a2414", e: "#1a1220", t: "#e8dcc4", T: "#bcae94", f: "#f0c030", x: "#2a2428" };
  function drawEagle(colour, frame, k) {
    const src = k > 1 ? EAGLE_BIG : EAGLE, neck = k > 1 ? 9 : 6;
    const rows = frame ? [".".repeat(src[0].length), ...src.slice(0, neck), ...src.slice(neck + 1)] : src;
    const g = new Grid(rows[0].length + 2, rows.length + 2);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") g.set(x + 1, y + 1, EAGLE_PAL[ch]); }));
    g.outline(OUTLINE);
    g.hitch = k > 1 ? [20, 18] : [12, 12];
    return g;
  }

  // ---------- wagons ----------
  const Wd = ramp("#8a5a32"), Wdk = ramp("#6a4428"), IRON = ramp("#5a5458"), Au = ramp("#e8b84a");
  function wheel(g, cx, cy, r, opts) {
    opts = opts || {};
    const spokes = r >= 8 ? 10 : r >= 5 ? 8 : 6, S = opts.paint ? ramp(opts.paint) : Wd, hub = opts.hub || 1.3, rim = r >= 8 ? 1.1 : 0.9;
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d > r) continue;
      const lit2 = -dx - dy > 0;
      if (d > r - rim) g.set(x, y, IRON[lit2 ? 2 : 1]);
      else if (d > r - rim - 0.9) g.set(x, y, Wdk[lit2 ? 3 : 2]);
      else if (d < (opts.solid ? r : hub)) {
        if (opts.solid) g.set(x, y, (Math.floor(x + 0.5 - cx + r) % 3 === 0 ? Wdk[1] : Wdk[lit2 ? 3 : 2]));
        else g.set(x, y, d < hub - 0.5 ? IRON[3] : (opts.gold ? Au : IRON)[2]);
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
  function barrel(g, x, y, k) {
    const w = Math.round(4 * k), h = Math.round(5 * k);
    planks(g, x, y, x + w, y + h, Wd, 99);
    for (let yy = y; yy <= y + h; yy++) { g.set(x, yy, Wd[1]); g.set(x + w, yy, Wd[1]); }
    for (const yy of [y + 1, y + h - 1]) for (let xx = x; xx <= x + w; xx++) g.set(xx, yy, IRON[2]);
  }
  // the wagon parts on the pen-size grid; a bigger k lays every part out k times larger, re-rasterised at that size
  function kit(g, k) {
    const Z = (v) => Math.round(v * k), w = Math.max(1, Math.round(k));
    return {
      Z,
      planks: (x0, y0, x1, y1, R, seam) => planks(g, Z(x0), Z(y0), Z(x1 + 1) - 1, Z(y1 + 1) - 1, R, seam && seam !== 99 ? Math.max(2, Math.round(seam * k)) : seam),
      post: (x, y0, y1, top, side) => { for (let i = 0; i < w; i++) for (let y = Z(y0); y < Z(y1 + 1); y++) g.set(Z(x) + i, y, y === Z(y0) ? top : side); },
      rail: (x0, x1, y, c) => g.hline(Z(x0), Z(x1 + 1) - 1, Z(y), c),
      wheel: (cx, cy, r, o) => wheel(g, cx * k, cy * k, r * k, Object.assign({ hub: 1.3 * Math.sqrt(k) }, o)),
      sack: (cx, cy, r) => sack(g, cx * k, cy * k, r * k),
      barrel: (x, y) => barrel(g, Z(x), Z(y), k),
      // every big pixel whose pen-size cell lies in the box: fn(x, y, u, v) with u, v that cell
      each: (x0, y0, x1, y1, fn) => { for (let y = Z(y0); y < Z(y1 + 1); y++) for (let x = Z(x0); x < Z(x1 + 1); x++) fn(x, y, Math.floor(x / k), Math.floor(y / k)); },
      first: (v) => Z(v), w,
    };
  }
  // front: [x, y] where the shafts leave the bed; rest: where their tips lie when nothing is hitched
  const WAGON = {
    handcart: { W: 27, H: 16, front: [16, 8], rest: [25, 13], shafts: true, draw(g, K) {
      K.planks(3, 6, 16, 10, Wd); for (const x of [3, 16]) K.post(x, 4, 10, Wd[3], Wd[1]);
      K.sack(7, 4, 2.2); K.sack(11.5, 4.2, 2); K.post(2, 10, 13, Wdk[1], Wdk[1]);
      K.wheel(9.5, 10.5, 3.6);
    } },
    donkey_cart: { W: 31, H: 18, front: [18, 10], rest: [29, 15], draw(g, K) {
      K.planks(2, 7, 18, 12, Wd); for (const x of [2, 18]) K.post(x, 5, 12, Wd[3], Wd[1]);
      K.rail(2, 18, 5, Wd[3]);
      K.barrel(5, 1); K.sack(13, 4, 2.4);
      K.wheel(10.5, 11.5, 4.6);
    } },
    horse_cart: { W: 36, H: 20, front: [22, 11], rest: [34, 17], draw(g, K) {
      K.planks(2, 7, 22, 13, Wd); for (const x of [2, 8, 15, 22]) K.post(x, 5, 13, Wd[3], Wd[1]);
      K.rail(2, 22, 5, Wd[3]);
      K.barrel(4, 0); K.sack(13, 3.6, 2.6); K.sack(18, 4.2, 2.2);
      K.wheel(12, 13, 5.2);
    } },
    ox_wagon: { W: 46, H: 22, front: [34, 14], rest: [44, 19], pole: true, draw(g, K, k) {
      ell(g, 18 * k, 6.5 * k, 14 * k, 4.6 * k, ramp("#d8b04a"));
      for (let j = 0; j < Math.round(24 * k * k); j++) { const x = K.Z(6 + ((j * 13) % 25) / 1) + (k > 1 ? (j * 5) % 2 : 0), y = K.Z(3 + ((j * 7) % 5)) + (k > 1 ? (j * 3) % 2 : 0); if (g.get(x, y)) g.set(x, y, j % 2 ? "#f0d470" : "#a88030"); }
      K.planks(2, 8, 34, 15, Wdk, 2);
      for (let x = 2; x <= 34; x += 4) { K.post(x, 5, 7, Wdk[3], Wdk[3]); K.post(x, 8, 15, Wdk[1], Wdk[1]); }
      K.rail(2, 34, 5, Wdk[3]);
      for (const x of [2, 34]) g.set(K.Z(x), K.Z(15), IRON[2]);
      K.wheel(9, 15.4, 5.2, { solid: true }); K.wheel(27, 16.4, 4.2, { solid: true });
    } },
    covered_wagon: { W: 42, H: 26, front: [32, 18], rest: [40, 24], draw(g, K, k) {
      const Cv = ramp("#e8dcbc");
      for (let y = K.Z(3); y < K.Z(16); y++) for (let x = K.Z(4); x < K.Z(32); x++) {
        const u = (x + 0.5) / k - 0.5, v = (y + 0.5) / k - 0.5;
        const top = 3 + Math.max(0, Math.abs(u - 17.5) - 11) * 1.6 + (Math.abs(u - 17.5) / 13.5) ** 4 * 2;
        if (v < top) continue;
        const hoop = [6, 12, 18, 24, 30].some((h) => x === K.Z(h));
        g.set(x, y, hoop ? Cv[1] : v < top + 1.5 ? Cv[3] : v > 13 ? Cv[1] : (u < 10 ? Cv[3] : Cv[2]));
      }
      ell(g, 30.6 * k, 10.5 * k, 1.6 * k, 4.2 * k, ["#1e1612", "#2a1e18", "#2a1e18", "#3a2a20", "#3a2a20"]);
      K.planks(3, 15, 32, 19, Wd);
      K.rail(3, 32, 15, Wd[3]);
      K.each(33, 7, 33, 9, (x, y, u, v) => g.set(x, y, v === 8 ? "#ffd86a" : IRON[1]));
      K.wheel(10, 19.5, 4.6); K.wheel(26, 20.5, 3.6);
    } },
    carriage: { W: 46, H: 28, front: [37, 17], rest: [44, 25], draw(g, K, k) {
      const Pt = ramp("#8a2a2c"), Rf = ramp("#2e2a30"), Z = K.Z;
      for (let y = Z(4); y < Z(7); y++) { const v = (y + 0.5) / k - 0.5, cut = 6 - v; for (let x = Z(9 + cut); x <= Z(30 - cut); x++) g.set(x, y, y < Z(5) ? Rf[3] : Rf[2]); }
      for (const x of [10, 15, 20, 25, 29]) K.each(x, 3, x, 3, (px, py) => { if (px === Z(x) || k > 1 && py === Z(3) + 1) g.set(px, py, Au[3]); });
      for (let y = Z(7); y < Z(19); y++) {
        const v = (y + 0.5) / k - 0.5, inset = v > 14 ? (v - 14) * 1.2 : 0;
        for (let x = Math.round((8 + inset) * k); x <= Math.round((31 - inset) * k + k - 1); x++) g.set(x, y, y === Z(7) ? Pt[3] : x < Z(11) ? Pt[3] : v > 16 ? Pt[1] : Pt[2]);
      }
      K.rail(8, 31, 7, Au[3]);
      K.rail(10, 29, 13, Au[2]);
      for (const x of [16, 23]) K.each(x, 8, x, 17, (px, py) => { if (px === Z(x)) g.set(px, py, Au[2]); });
      K.each(17, 9, 22, 12, (x, y, u, v) => g.set(x, y, y === Z(9) || x === Z(17) || x === Z(23) - 1 ? "#e8d4a8" : v === 10 && (u === 18 || u === 21) && (x === Z(u) || y === Z(10)) ? "#e8d4a8" : "#2c3a52"));
      K.each(19, 11, 19, 11, (x, y) => g.set(x, y, "#5a7090"));
      K.each(10, 9, 14, 11, (x, y) => g.set(x, y, y === Z(9) ? "#e8d4a8" : "#2c3a52"));
      K.each(25, 9, 28, 11, (x, y) => g.set(x, y, y === Z(9) ? "#e8d4a8" : "#2c3a52"));
      K.each(21, 15, 21, 15, (x, y) => g.set(x, y, Au[4]));
      K.planks(32, 12, 37, 14, Wdk, 9); K.rail(32, 37, 11, "#3a2a40"); K.rail(33, 36, 10, "#4a3a50");
      K.post(32, 8, 11, IRON[1], IRON[1]); K.each(32, 7, 32, 7, (x, y) => g.set(x, y, Au[3])); K.each(33, 8, 33, 8, (x, y) => g.set(x, y, "#ffe28a")); K.each(33, 9, 33, 9, (x, y) => g.set(x, y, Au[2]));
      K.rail(8, 36, 20, IRON[1]);
      for (const [x, y] of [[6, 18], [6, 19], [7, 20], [35, 18], [36, 19]]) K.each(x, y, x, y, (px, py) => g.set(px, py, IRON[2]));
      K.wheel(12, 21, 5.2, { paint: "#b8862a", gold: true }); K.wheel(32, 22, 4.2, { paint: "#b8862a", gold: true });
    } },
  };
  function shaft(g, a, b, pole, k) {
    const th = Math.max(2, Math.round(2 * (k || 1)));
    for (let i = 0; i < th; i++) g.line(a[0], a[1] + i, b[0], b[1] + i, (pole ? Wdk : Wd)[i === 0 ? 3 : i === th - 1 ? 1 : 2]);
  }
  function drawWagonGrid(kind, bare, k) {
    k = k || 1;
    const s = WAGON[kind] || WAGON.horse_cart, g = new Grid(Math.round(s.W * k), Math.round(s.H * k)), Z = (v) => Math.round(v * k);
    s.draw(g, kit(g, k), k);
    if (!bare) {
      shaft(g, [Z(s.front[0]), Z(s.front[1])], [Z(s.rest[0]), Z(s.rest[1])], s.pole, k);
      if (kind === "handcart") for (let i = 0; i <= Math.round(k); i++) g.set(Z(s.rest[0]) + i, Z(s.rest[1]) - 1, Wd[3]);
    }
    return g;
  }
  function drawTeam(kind, puller, frame, k) {
    k = k || 1;
    const s = WAGON[kind] || WAGON.horse_cart, w = drawWagonGrid(kind, true, k), Z = (v) => Math.round(v * k);
    const m = rawMount(puller.kind, puller.colour, frame, k > 1), [mx0] = bbox(m);
    const gap = Z(puller.kind === "ox" ? 3 : 2), ox = Z(s.front[0]) + gap - mx0 + 1;
    const H = Math.max(w.h, m.h), W = Math.max(w.w, ox + m.w), g = new Grid(W, H);
    paste(g, w, 0, H - w.h);
    const a = [Z(s.front[0]), Z(s.front[1]) + H - w.h], hx = m.hitch[0] + ox, hy = m.hitch[1] + H - m.h;
    const b = m.yoke ? [hx - 1, hy + Z(4)] : [hx + 1, hy + Z(2)];
    shaft(g, a, b, m.yoke, k);
    g.outline(OUTLINE);
    // the near shaft and the harness lie over the animal, so they go on after its outline
    paste(g, m, ox, H - m.h);
    shaft(g, a, b, m.yoke, k);
    if (m.yoke) {
      for (let y = hy - 1; y <= hy + Z(5); y++) g.set(hx, y, Wdk[y === hy - 1 ? 3 : 2]);
      g.set(hx - 1, hy - 1, Wdk[3]); g.set(hx + 1, hy - 1, Wdk[3]); g.set(hx - 1, hy - 2, OUTLINE); g.set(hx + 1, hy - 2, OUTLINE);
    } else {
      for (let y = hy - 1; y <= hy + Z(3); y++) for (let i = 0; i < (k > 1 ? 2 : 1); i++) g.set(hx + i, y, y === hy - 1 ? "#c8a050" : "#4a2e1c");
      g.set(hx + 1 + (k > 1 ? 1 : 0), hy, "#4a2e1c"); g.set(hx + 1 + (k > 1 ? 1 : 0), hy + 1, "#e8b84a");
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
  // scene = true: the people-scale sprite for the night scenes, drawn natively at SCENE_K (WAGON_K for a wagon)
  function rawMount(kind, colour, frame, scene) {
    kind = COLOURS[kind] ? kind : "horse";
    colour = colourOf(kind, colour);
    const k = scene === "rider" ? RIDER_K[kind] || SCENE_K[kind] : scene ? SCENE_K[kind] : 1;
    const draw = (f) => kind === "ox" ? drawOx(colour, f, k) : kind === "camel" ? drawCamel(colour, f, k) : kind === "eagle" ? drawEagle(colour, f, k) : drawEquine(kind, colour, f, k);
    return cached("r:" + kind + colour + (scene === "rider" ? ":r" : scene ? ":s" : ""), () => trim(draw(0), draw(1)))[frame ? 1 : 0];
  }
  function mountGrid(kind, colour, frame, scene) {
    const g = rawMount(kind, colour, frame, scene);
    return cached("m:" + kind + colourOf(kind, colour) + (frame ? 1 : 0) + (scene === "rider" ? ":r" : scene ? ":s" : ""), () => g.toCanvas(1));
  }
  function wagonGrid(kind, puller, frame, scene) {
    const k = scene ? WAGON_K : 1, sk = scene ? ":s" : "";
    if (puller && puller.kind && kind !== "handcart")
      return cached("t:" + kind + puller.kind + colourOf(puller.kind, puller.colour) + (frame ? 1 : 0) + sk, () => drawTeam(kind, puller, frame, k).toCanvas(1));
    return cached("w:" + kind + sk, () => { const g = drawWagonGrid(kind, false, k); g.outline(OUTLINE); return g.toCanvas(1); });
  }
  // the road companion's cow at people scale: frames 0/1 stand, 2 grazes
  function cowGrid(frame) {
    return cached("cow" + frame, () => drawOx("cow", frame, SCENE_K.ox).toCanvas(1));
  }
  function blit(ctx, cv, x, y, scale) {
    scale = scale || 1;
    const w = cv.width * scale, h = cv.height * scale, smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, Math.round(x), Math.round(y - h), w, h);
    ctx.imageSmoothingEnabled = smooth;
    return { w, h };
  }
  function drawMount(ctx, kind, colour, x, y, frame, scale, scene) { return blit(ctx, mountGrid(kind, colour, frame, scene), x, y, scale); }
  function drawWagon(ctx, kind, x, y, scale, puller, frame, scene) { return blit(ctx, wagonGrid(kind, puller, frame, scene), x, y, scale); }

  // the pets' rhythm: one shared tick, but a mount only shifts every third beat, and not all in step
  const live = new Set();
  let beat = 0, beatTimer = 0;
  function pulse() {
    beat++;
    for (const a of live) {
      if (!a.cv.isConnected) { if (++a.idle > 8) live.delete(a); continue; }
      a.idle = 0;
      a.draw((beat + a.phase) % 3 === 0 ? 1 : 0);
    }
  }
  function pulsing() {
    const on = !(window.Settings && Settings.calm());
    if (on && !beatTimer) beatTimer = setInterval(pulse, 650);
    else if (!on && beatTimer) { clearInterval(beatTimer); beatTimer = 0; }
  }
  pulsing();
  if (window.Settings) Settings.watch(pulsing);
  function mountSprite(kind, colour, scale, opts) {
    opts = opts || {};
    scale = scale || 3;
    const c0 = mountGrid(kind, colour, 0, opts.scene), cv = document.createElement("canvas");
    cv.width = c0.width * scale; cv.height = c0.height * scale;
    cv.className = "mount-px" + (opts.cls ? " " + opts.cls : "");
    const ctx = cv.getContext("2d");
    const draw = (f) => { ctx.clearRect(0, 0, cv.width, cv.height); drawMount(ctx, kind, colour, 0, cv.height, f, scale, opts.scene); };
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

  window.MountArt = { COLOURS, WAGONS, mountGrid, cowGrid, mountSprite, wagonGrid, drawMount, drawWagon, stablePen, penBase };
})();
