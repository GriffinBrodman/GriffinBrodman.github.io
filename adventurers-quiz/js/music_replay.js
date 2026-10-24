/* Music replays on the #/night/<id> route: a crew's tavern set on the ballad stage (the crew plays, the room turns and sings back,
   copper lands in the hat), and the anthem moment, star silhouettes on a ridge the night a song becomes a warm crew's anthem
   (gold threads for the bond, notes climbing into stars, the lyric drawn as a constellation that regathers into the title).
   A camp night's scene registers itself with `MusicReplay.register("camp", fn)`; until one does, a camp song plays with its words
   only. Sound and timing come from Music (music.js); lyrics are talking text (speech.js `sing`). One verse and the chorus by
   default, then "▸ The whole song". Record format: league/music.py. */
(function () {
  "use strict";
  const R = Math.round, frac = (v) => ((v % 1) + 1) % 1, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const S = () => (window.Settings || null);
  const isStill = () => !!(S() && S().get("still"));
  const isReduced = () => !!(S() && S().reduced());
  const h01 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const OL = "#160d07";
  const sprite = (rows, pal) => Anim.sprite(rows, pal, OL);
  const put = (ctx, cv, x, y, left) => Anim.put(ctx, cv, x, y, left);
  const dot = (ctx, x, y, c, a) => { ctx.globalAlpha = a == null ? 1 : clamp(a, 0, 1); ctx.fillStyle = c; ctx.fillRect(R(x), R(y), 1, 1); ctx.globalAlpha = 1; };
  const line = (ctx, x0, y0, x1, y1, c, a) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (let i = 0; i <= n; i++) { const k = n ? i / n : 0; dot(ctx, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, c, a); } };
  const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lift = (hex, k) => { const c = /^#[0-9a-f]{6}$/i.test(hex || "") ? rgbOf(hex) : [236, 197, 106]; return "#" + c.map((v) => R(v + (255 - v) * k).toString(16).padStart(2, "0")).join(""); };
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
  // stepped, dithered light so glows stay pixel art
  function pglow(ctx, cx, cy, rx, ry, hex, a, steps) {
    const [r, g, b] = rgbOf(hex), st = steps || 4;
    ctx.globalCompositeOperation = "lighter";
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d >= 1) continue;
      const k = Math.floor(Math.pow(1 - d, 1.4) * st + BAY[(y & 3) * 4 + (x & 3)]) / st;
      if (k <= 0) continue;
      ctx.globalAlpha = Math.min(1, a * k); ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }

  // ---------- instruments, held in the players' own hands (Art.heroPose arms) ----------
  const WOOD = { b: "#c8823e", B: "#9a5a26", o: "#2a160a", n: "#5a3418", h: "#3a2010", s: "#f0d8a0" };
  const ROWS = {
    lute: [["...........xh", "..........xhx", ".........xnx.", "..xxxx..xnx..", ".xbbbbBxnx...", "xbbsbbbnx....", "xbboobbBx....", "xbboobbBx....", "xBbbbbBx.....", ".xBBBBx......", "..xxxx......."], WOOD],
    fiddle: [[".xh.", ".xn.", ".xn.", "xbbx", "bbbB", "xoBx", "bbbB", "bbbB", "xBBx"], { b: "#b8562a", B: "#7a2e16", o: "#2a100a", n: "#3a1c0e", h: "#2a140a", x: OL }],
    flute: [["xxxxxxxxxxxx", "wbobobwbbbbw", "xxxxxxxxxxxx"], { x: "#6a4a2a", w: "#e8d8b0", b: "#c8a878", o: "#2a1a0a" }],
    drum: [[".xxxxxxx.", "xhhhhhhhx", "xbrbrbrbx", "xbbbbbbbx", "xbrbrbrbx", ".xxxxxxx."], { x: "#3a2410", h: "#e8dcc0", b: "#8a4a2a", r: "#c8a050" }],
    horn: [["......bb", ".....bBb", "....bBb.", "ccbbBb..", "cBBbb...", "cc......"], { b: "#d8b04a", B: "#a87a22", c: "#f0d890" }],
    bagpipes: [[".d..d...", ".d..d...", ".d..d.c.", "ttttttc.", "tTtTttt.", "tttttt..", ".tttt...", "..c....."], { d: "#3a2a1a", t: "#3a7a4a", T: "#c8463a", c: "#2a1a10" }],
    pot: [[".xxxxxxx.", "xkkkkkkkx", "xgggggggx", ".xgggggx.", "..xxxxx.."], { k: "#8a8a96", g: "#3a3a44", x: OL }],
    spoon: [["oo...", "oos..", "..s..", "...s.", "....s"], { o: "#d8d0c0", s: "#a8a090" }],
    hat: [["...xxxxx...", "..xbbbbbx..", "..xbbbbbx..", ".xrrrrrrrx.", "xbbbbbbbbbx", ".xxxxxxxxx."], { b: "#5a3a24", r: "#a83a2a", x: "#2a160a" }],
    coin: [[".c.", "cCc", ".c."], { c: "#c87a3a", C: "#f0b060" }],
    note: [["...xx", "...xxx", "...x.x", "...x..", ".xxx..", "xxxx..", ".xx..."], null],
    heart: [[".rr.rr.", "rRrrrrr", "rRrrrrr", ".rrrrr.", "..rrr..", "...r..."], { r: "#e0506a", R: "#ffb0b8" }],
  };
  const sprites = {};
  function spr(name, col) {
    const key = name + (col || "");
    if (!sprites[key]) {
      const [rows, pal] = ROWS[name];
      sprites[key] = pal ? sprite(rows, pal) : sprite(rows.map((r) => r.replace(/x/g, "c")), { c: col || "#fff4dc" });
    }
    return sprites[key];
  }
  const bow = (ctx, x0, y0, x1, y1) => { line(ctx, x0, y0 + 1, x1, y1 + 1, OL); line(ctx, x0, y0, x1, y1, "#e8dcc0"); dot(ctx, x0, y0, "#3a2010"); dot(ctx, x1, y1, "#3a2010"); };
  function spark(ctx, x, y, c, s) {
    dot(ctx, x, y, "#fffbe8");
    for (let d = 1; d <= (s || 2); d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) dot(ctx, x + dx, y + dy, c, d === s ? 0.6 : 1);
  }
  // when each player last struck a note or a hit, from the plan, so the floating instruments move on the music
  function strikes(P) {
    const by = {};
    for (const n of P.notes) if (n.part !== "along") (by[n.who] = by[n.who] || []).push([n.t, n.d, n.part]);
    for (const x of P.hits) (by[x.who] = by[x.who] || []).push([x.t, 0.1, x.kind]);
    for (const k of Object.keys(by)) by[k].sort((a, b) => a[0] - b[0]);
    return (who, t) => {
      const a = by[who];
      if (!a || !a.length || t < a[0][0]) return null;
      let lo = 0, hi = a.length - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (a[m][0] <= t) lo = m; else hi = m - 1; }
      return { since: t - a[lo][0], d: a[lo][1], kind: a[lo][2] };
    };
  }
  // how each instrument is held, facing right, from the body's centre line x and chest y (the sprite's (14, 18)): the sprite's
  // cell `cell` lands on `at` (m: mirrored), and the hands go to r and l, one entry per strum frame (the last repeats)
  const HOLD = {
    lute: { m: true, cell: [3, 6], at: [4, 3], r: [[4, 2], [4, 4]], l: [[-3, -1]] },
    fiddle: { cell: [1, 5], at: [7, 1], r: [[7, -3]], l: [[-2, 1], [-1, 1], [0, 1], [1, 1]] },
    flute: { cell: [0, 1], at: [0, -5], r: [[6, -5]], l: [[1, -5]] },
    drum: { cell: [4, 1], at: [3, 3], r: [[6, -2], [5, 1], [6, -2]], l: [[-1, -1], [-1, -1], [0, 1]] },
    horn: { cell: [0, 4], at: [1, -5], r: [[5, -6], [5, -7]] },
    bagpipes: { cell: [3, 4], at: [5, 2], r: [[4, 1], [3, 2]], l: [[1, 2]] },
    pot: { cell: [4, 2], at: [1, 5], r: [[5, -1], [4, 2]], l: [[-2, 5]] },
    clap: { r: [[3, -2], [1, -2]], l: [[-2, -2], [0, -2]] },
  };
  const holdOf = (inst, how) => HOLD[inst] || (how === "pot" || how === "clap" ? HOLD[how] : null);
  // the strum frame at this moment: lute and pot down on a note, fiddle bow along the stroke, drum hits alternating hands
  function gripFrame(inst, how, t, hit, calm) {
    const on = !calm && hit && hit.since < 0.14;
    if (inst === "fiddle") return calm || !hit ? 1 : R(clamp(hit.since / Math.max(0.15, hit.d), 0, 1) * 3);
    if (inst === "drum") return on ? 1 + (Math.floor((t - hit.since) * 4.1) & 1) : 0;
    if (inst === "horn") return !calm && hit && hit.since < hit.d ? 1 : 0;
    return on ? 1 : 0;
  }
  // where the hands go at frame k, in sprite pixels facing right, for Art.heroPose's arms
  function grip(inst, how, k) {
    const g = holdOf(inst, how);
    if (!g) return null;
    const pick = (a) => (a ? a[Math.min(k, a.length - 1)] : null), r = pick(g.r), l = pick(g.l);
    return { r: r && [14 + r[0], 18 + r[1]], l: l && [14 + l[0], 18 + l[1]] };
  }
  // a hero holding an instrument: the posed body and the hands alone (to lay over the instrument), at frame k, flipped for left
  const heldCvs = new Map();
  function held(h, inst, how, f) {
    const cv = (k, left, part) => {
      const key = (h.id || h.name) + ":" + inst + how + k + (left ? "L" : "") + part + (f || 0);
      if (!heldCvs.has(key)) {
        let c = null;
        try { const arms = grip(inst, how, k); if (arms) { const g = Art.heroPose(bare(h), f || 0, App.heroLook(h), { arms, part: part ? "hands" : null }); c = (left ? g.flipX() : g).toCanvas(1); } } catch (e) { c = null; }
        heldCvs.set(key, c);
      }
      return heldCvs.get(key);
    };
    return { body: (k, left) => cv(k, left, false), hands: (k, left) => cv(k, left, true) };
  }
  // the sprite `n` placed so its cell (c, r) lands on (px, py), mirrored if m
  function putCell(ctx, cv, n, c, r, px, py, m) {
    const rows = ROWS[n][0], cols = Math.max(...rows.map((s) => s.length)), cc = m ? cols - 1 - c : c;
    put(ctx, cv, px - 1 - cc + ((cols + 2) >> 1), py + rows.length - 1 - r, m);
  }
  // one player's instrument in their hands: x, y the body's centre line and chest height, face the way they look; hands(k) the
  // player's hands alone at frame k (held(...).hands), laid over the instrument so they hold it
  function drawInst(ctx, inst, how, x, y, face, t, hit, calm, tint, hands) {
    const on = !calm && hit && hit.since < 0.14, sounding = !calm && hit && hit.since < hit.d;
    const g = holdOf(inst, how), k = gripFrame(inst, how, t, hit, calm), left = face < 0;
    const s = (n) => (tint ? tinted(spr(n), tint) : spr(n));
    const P = (dx, dy) => [x + face * dx, y + dy];
    const place = (n, dy) => { const [px, py] = P(g.at[0], g.at[1] + (dy || 0)); putCell(ctx, s(n), n, g.cell[0], g.cell[1], px, py, !!g.m !== left); };
    const hand = (side) => { const a = g && g[side]; return a ? P(...a[Math.min(k, a.length - 1)]) : null; };
    if (inst === "lute") { place("lute"); if (on) { const [px, py] = P(5, 0); dot(ctx, px, py, "#fff4dc"); dot(ctx, px + face * 2, py + 1, "#fff4dc", 0.6); } }
    else if (inst === "fiddle") {
      place("fiddle");
      // the bow in the far hand, drawn across the strings a stroke per note
      const [bx, by] = hand("l");
      bow(ctx, bx - face * 2, by + 1, bx + face * 12, by - 5);
    } else if (inst === "flute") {
      place("flute");
      if (sounding) for (let j = 0; j < 2; j++) dot(ctx, ...P(13 + j * 2 + frac(t * 3) * 2, -7 - j), "#e8f0ff", 0.6 - j * 0.2);
    } else if (inst === "drum") {
      place("drum");
      // a beater in each hand, its head on the skin when that hand strikes
      for (const side of ["r", "l"]) { const [hx, hy] = hand(side), d = side === "r" ? -face : face; line(ctx, hx, hy + 1, hx + d * 2, hy + 3, "#e8d8b0"); dot(ctx, hx + d * 2, hy + 3, "#fff4dc"); }
    } else if (inst === "horn") place("horn", sounding ? -1 : 0);
    else if (inst === "bagpipes") place("bagpipes", on ? 1 : 0);
    else if (how === "pot") {
      place("pot");
      const [hx, hy] = hand("r");
      putCell(ctx, spr("spoon"), "spoon", 4, 4, hx, hy, left);
    } else if (how === "clap" && on) { spark(ctx, ...P(1, -6), "#ffe8a0", 2); spark(ctx, ...P(4, -10), "#e8f0ff", 1); }
    const hc = g && hands ? hands(k) : null;
    if (hc) ctx.drawImage(hc, R(x) - 14, R(y) - 18);
  }
  const tintCache = new Map();
  function tinted(cv, col) {
    const key = col;
    let m = tintCache.get(cv);
    if (!m) tintCache.set(cv, (m = {}));
    if (!m[key]) {
      const c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height;
      const x = c.getContext("2d"); x.drawImage(cv, 0, 0); x.globalCompositeOperation = "source-atop"; x.fillStyle = col; x.globalAlpha = 0.4; x.fillRect(0, 0, c.width, c.height);
      c.pad = cv.pad; m[key] = c;
    }
    return m[key];
  }

  // a hero with weapons and shields put away: the night's instrument floats where the weapon would be
  function bare(h) {
    const kit = h.kit ? JSON.parse(JSON.stringify(h.kit)) : null;
    if (kit) { kit.weapon = null; kit.offhand = null; if (kit.back && kit.back.art === "quiver") kit.back = null; }
    return Object.assign({}, h, { alive: true, weapon: "none", weapon_tier: 1 }, kit ? { kit } : {});
  }
  const heroOf = (id, name) => (App.heroes && App.heroes[id]) || { id, name: name || "A hero", look: { skin: "#e0b088", hair: "#5a3a20", style: 1, face: 1, fav: "#8a6a3a", scars: [] }, cls: "warrior", weapon: "none", weapon_tier: 1, armor_tier: 1 };
  const voiceColor = (h) => lift(((h || {}).look || {}).fav, 0.5);
  // everyone at the night: the lead, the joiners in join order, then the crew who only listened ("listen"); old records list no
  // onlookers, and an anthem's members fill in for them
  function castOf(rec) {
    const out = [{ id: rec.lead.id, name: rec.lead.name, inst: rec.lead.inst || null, how: "lead" }]
      .concat((rec.joiners || []).map((j) => ({ id: j.id, name: j.name, inst: j.inst || null, how: j.how })));
    for (const m of (rec.onlookers || []).concat((rec.anthem || {}).members || [])) if (!out.some((p) => p.id === m.id)) out.push({ id: m.id, name: m.name, inst: null, how: "listen" });
    return out;
  }

  // ---------- D: the tavern stage ----------
  function tavernScene(rec, P, words) {
    // the whole room is painted at the ballad's size, then cut to the stage and the near tables so the crew reads at page width
    const FW = 256, FH = Ballad.FULL, W = 192, H = 108, CX = 32, CY = 2, town = rec.town, OX = R(FW / 2), OY = 40, hit = strikes(P);
    const iso = (u, v) => [OX + (u - v) * 8, OY + (u + v) * 4];
    const joinT = {};
    for (const c of P.cues) if (c.kind === "join") joinT[c.who] = c.t;
    const startT = P.lines.length ? P.lines[0].t0 : 0, endT = (P.cues.find((c) => c.kind === "end") || { t: P.len }).t;
    const chorusT = (P.cues.find((c) => c.kind === "chorus") || { t: endT }).t;
    const players = castOf(rec);
    const onStage = players.filter((p) => p.how === "lead" || p.how === "inst" || p.how === "sing" || p.how === "over").slice(0, 4);
    const front = players.filter((p) => !onStage.includes(p)).slice(0, 4);
    const STAGE = [[2.2, 2.2], [3.6, 0.9], [0.9, 3.6], [3.5, 2.7]], FLOOR = [[4.9, 2.7], [2.7, 4.9], [5.4, 1.4], [1.4, 5.4]];
    const cast = [], anchors = {};
    const place = (p, u, v, raised) => {
      const h = heroOf(p.id, p.name), [x, y0] = iso(u, v), y = y0 - (raised ? 4 : 0), face = p.how === "lead" ? 1 : x < OX ? 1 : -1;
      const a = Tavern.actor(bare(h), 0, 0, {});
      const c = { a, x, y, key: u + v + (raised ? 0.01 : 0), role: "band", face, ph: h01(u, v), id: p.id, p };
      // a player's arms go to the instrument: the figure is swapped for the pose of the moment's strum frame
      const H = holdOf(p.inst || null, p.how) ? held(h, p.inst || null, p.how) : null, looks = {};
      if (H) c.look = (k) => looks[k] || (looks[k] = Ballad.figure(Object.assign({}, a, { right: H.body(k, false) || a.right, left: H.body(k, true) || a.left }), 0, 0));
      c.extra = (ctx, t, pose, f) => {
        const fc = pose.face > 0 ? 1 : -1;
        drawInst(ctx, p.inst || null, p.how, R(f.x + (pose.dx || 0)), R(f.y - 15 + (pose.dip || 0)), fc, t, joined(p, t) ? hit(p.id, t) : null, calm, null, H ? (k) => H.hands(k, fc < 0) : null);
      };
      cast.push(c);
      anchors[p.id] = [x - CX, y - (a.right.height || 34) - 1 - CY];
    };
    onStage.forEach((p, i) => place(p, ...STAGE[i], true));
    front.forEach((p, i) => place(p, ...FLOOR[i], false));
    const joined = (p, t) => p.how === "lead" ? t >= startT - 1.5 : joinT[p.id] != null && t >= joinT[p.id];
    let calm = false, tNow = 0;
    const beatLen = P.unit * (P.meter === "6/8" ? 3 : 2);
    const beatOn = (t) => frac(t / beatLen) < 0.3;
    const pose = (f, t, p, playing) => {
      if (f.role === "band") {
        const pl = f.id && cast.find((c) => c.id === f.id);
        const live = pl && joined(pl.p, t) && t < endT + 0.5;
        p.face = f.face; p.dx = 0;
        p.dip = !calm && live && beatOn(t) ? 1 : 0;
        if (pl && pl.p.how === "lead" && t > endT + 0.4 && t < endT + 3) p.lift = calm ? 0 : frac((t - endT) / 0.9) < 0.15 ? 1 : 0;
        if (pl && pl.p.how === "over" && live) p.dx = f.face;
        if (pl && pl.look) { const L = pl.look(gripFrame(pl.p.inst || null, pl.p.how, t, joined(pl.p, t) ? hit(pl.id, t) : null, calm)); f.img = L.img; f.shut = L.shut; }
        return;
      }
      if (f.role !== "local" && f.role !== "keeper") return;
      // the room turns to the stage when the song starts, sings the chorus back, and takes the ending the way the night went
      const toStage = f.x < OX ? 1 : -1;
      if (t < startT - 0.6) { p.face = frac(f.ph * 7) < 0.5 ? -toStage : toStage; return; }
      p.face = toStage;
      if (calm) { p.dip = 0; return; }
      if (t >= chorusT && t < endT) p.dip = beatOn(t + f.ph * 0.1) ? 1 : 0;
      if (t >= endT && t < endT + 3.5) {
        const o = rec.outcome, k = t - endT;
        if (o === "mess") { p.lift = frac(k * 3 + f.ph) < 0.4 ? 1 : 0; p.dip = 0; }
        else if (o === "sore") { p.face = frac(f.ph * 5) < 0.5 ? -toStage : toStage; p.dip = 1; }
        else if (o === "soaring" || o === "sweet") p.lift = frac(k * 2.2 + f.ph) < 0.3 ? 1 : 0;
      }
    };
    // the hat at the foot of the stage, and the copper that lands in it
    const [hx, hy] = iso(4.3, 4.3);
    const pay = rec.pay || 0, nCoins = pay ? clamp(R(pay / 4), 1, 14) : 0;
    const coinFlights = [];
    for (let i = 0; i < nCoins; i++) coinFlights.push({ t0: chorusT + (endT + 2.2 - chorusT) * (i / Math.max(1, nCoins)) + h01(i, 5) * 0.4, from: i % 4, dur: 0.75 });
    const things = [{ key: 8.6, draw: (ctx, t) => {
      put(ctx, spr("hat"), hx, hy);
      const landed = coinFlights.filter((c) => t >= c.t0 + c.dur).length;
      for (let i = 0; i < landed; i++) put(ctx, spr("coin"), hx - 3 + (i * 3) % 7, hy - 4 - Math.floor(i / 3));
    } }];
    const song = { id: rec.id, towns: [town], heroes: [], mood: "glory", day: rec.day };
    const b = Ballad.build(song, FW, { cast, pose, things, over: (ctx, t) => over(ctx, t) });
    const locals = b.figs.filter((f) => f.role === "local");
    function over(ctx, t) {
      for (const c of coinFlights) {
        const k = (t - c.t0) / c.dur;
        if (k < 0 || k >= 1) continue;
        const f = locals[c.from % Math.max(1, locals.length)] || { x: OX - 60, y: OY + 60 };
        const x = f.x + (hx - f.x) * k, y = (f.y - 18) + (hy - 6 - (f.y - 18)) * k - Math.sin(k * Math.PI) * 18;
        put(ctx, spr("coin"), x, y);
        if (!calm && frac(k * 4) < 0.5) dot(ctx, x, y - 2, "#fff4c0");
      }
      if (calm) return;
      // notes off every live player, in their own colour
      for (const c of cast) {
        if (!joined(c.p, t) || t > endT + 1) continue;
        const col = voiceColor(c.a.h), per = 0.7;
        for (let k = Math.floor((t - 2.2) / per); k <= Math.floor(t / per); k++) {
          const age = t - k * per - h01(k, c.x) * 0.3;
          if (age < 0 || age > 2.2) continue;
          ctx.globalAlpha = age < 0.2 ? age / 0.2 : age > 1.5 ? (2.2 - age) / 0.7 : 1;
          ctx.drawImage(spr("note", col), R(c.x + c.face * 6 + Math.sin(age * 3 + k) * 3), R(c.y - 38 - age * 12));
          ctx.globalAlpha = 1;
        }
      }
      if (rec.outcome === "soaring" && t > chorusT) {
        const [sx, sy] = iso(2.2, 2.2);
        pglow(ctx, sx, sy - 24, 34, 22, "#ffc070", 0.12 + 0.04 * Math.sin(t * 2), 4);
        for (let k = 0; k < 10; k++) { const a = frac(t * 0.3 + k / 10); dot(ctx, sx + Math.sin(k * 2.3 + t) * 26 * a, sy - 6 - a * 50, "#ffd890", 1 - a); }
      }
    }
    const room = document.createElement("canvas"); room.width = FW; room.height = FH;
    const rc = room.getContext("2d"), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const near = locals.filter((f) => f.x - CX > 8 && f.x - CX < W - 8).sort((a, c) => a.y - c.y)[0];
    return {
      cv, W, H, anchors, crowd: near ? [near.x - CX + 6, near.y - 38 - CY] : [W * 0.25, H * 0.5],
      draw(t, o) {
        calm = !!(o && o.calm); tNow = t;
        rc.drawImage(b.bg, 0, 0); b.draw(rc, t, calm, t >= startT - 1 && t < endT + 1);
        ctx.drawImage(room, CX, CY, W, H, 0, 0, W, H);
      },
      along: "crowd",
    };
  }

  // ---------- E: star silhouettes, the night a song becomes a warm crew's anthem ----------
  const hashI = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const vnoise = (x, y, s) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hashI(ix, iy, s), b = hashI(ix + 1, iy, s), c = hashI(ix, iy + 1, s), d = hashI(ix + 1, iy + 1, s);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const fbm = (x, y, s) => (vnoise(x, y, s) + vnoise(x * 2, y * 2, s + 7) * 0.5 + vnoise(x * 4, y * 4, s + 13) * 0.25) / 1.75;
  const SKY = ["#04050c", "#070a18", "#0b1024", "#101830", "#16223c", "#1e2e48", "#2a3c54"];
  // stroke letters on a 4x6 grid: every vertex is a star, every stroke a faint line between them
  const GLYPH = {
    A: [[[0, 6], [0, 2], [2, 0], [4, 2], [4, 6]], [[0, 3], [4, 3]]], B: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]], [[0, 0], [3, 0], [4, 1], [4, 2], [3, 3]]],
    C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]], D: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 1], [3, 0], [0, 0]]],
    E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]], F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
    G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3], [2, 3]]], H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
    I: [[[2, 0], [2, 6]], [[1, 0], [3, 0]], [[1, 6], [3, 6]]], J: [[[4, 0], [4, 5], [3, 6], [1, 6], [0, 5]]], K: [[[0, 0], [0, 6]], [[4, 0], [0, 3], [4, 6]]],
    L: [[[0, 0], [0, 6], [4, 6]]], M: [[[0, 6], [0, 0], [2, 3], [4, 0], [4, 6]]], N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
    O: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]], P: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]]],
    Q: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[2, 4], [4, 6]]], R: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[2, 3], [4, 6]]],
    S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]], T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
    U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]], V: [[[0, 0], [2, 6], [4, 0]]], W: [[[0, 0], [1, 6], [2, 3], [3, 6], [4, 0]]],
    X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]], Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]], Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
    "'": [[[2, 0], [2, 1]]], "-": [[[1, 3], [3, 3]]], "!": [[[2, 0], [2, 4]], [[2, 6], [2, 6]]], "?": [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [2, 3], [2, 4]], [[2, 6], [2, 6]]],
  };
  // a word list laid out in rows of stars that fit the width; returns [{x, y, stroke edges}] per letter, in reading order
  function layoutStars(text, W, top, u) {
    const words = text.toUpperCase().replace(/[^A-Z'!?\- ]/g, "").split(/\s+/).filter(Boolean), adv = u * 4 + Math.max(2, u), maxC = Math.floor((W - 12) / adv);
    const rows = [];
    let cur = "";
    for (const w of words) { if (cur && (cur + " " + w).length > maxC) { rows.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; }
    if (cur) rows.push(cur);
    const out = [];
    rows.slice(0, 3).forEach((row, ri) => {
      const x0 = R((W - (row.length * adv - Math.max(2, u))) / 2), y0 = top + ri * (u * 6 + u * 4);
      [...row].forEach((ch, ci) => {
        const g = GLYPH[ch];
        if (!g) return;
        const pts = [], edges = [];
        for (const stroke of g) stroke.forEach(([a, b], k) => {
          const p = [x0 + ci * adv + a * u, y0 + b * u];
          let i = pts.findIndex((q) => q[0] === p[0] && q[1] === p[1]);
          if (i < 0) { pts.push(p); i = pts.length - 1; }
          if (k > 0) { const [pa, pb] = stroke[k - 1], j = pts.findIndex((q) => q[0] === x0 + ci * adv + pa * u && q[1] === y0 + pb * u); edges.push([j, i]); }
        });
        out.push({ pts, edges });
      });
    });
    return out;
  }
  function drawStars(ctx, letters, done, col, o) {
    const op = o || {}, n = letters.length;
    letters.forEach((L, li) => {
      const my = n ? li / n : 0, on = my < done, fade = op.alpha == null ? 1 : op.alpha;
      if (!on && !op.ghost) return;
      const pts = L.pts.map(([x, y], k) => op.from ? [op.from(li, k, x, y)[0], op.from(li, k, x, y)[1]] : [x, y]);
      if (on && op.lines !== false) for (const [a, b] of L.edges) line(ctx, pts[a][0], pts[a][1], pts[b][0], pts[b][1], col, (op.line == null ? 0.3 : op.line) * fade);
      for (const [x, y] of pts) {
        if (on) { pglow(ctx, x, y, 3, 3, col, 0.22 * fade, 3); dot(ctx, x, y, "#fffbe8", fade); if (op.big || hashI(x, y, 3) > 0.6) for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(ctx, x + ex, y + ey, col, 0.55 * fade); }
        else dot(ctx, x, y, col, 0.35 * fade);
      }
    });
  }
  const skyCache = {};
  function skyCanvas(W, H, ridge) {
    if (skyCache[W + "x" + H]) return skyCache[W + "x" + H];
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"), pick = (t, i, j) => SKY[clamp(R(t * (SKY.length - 1) + (BAY[(j & 3) * 4 + (i & 3)] - 0.47) * 0.9), 0, SKY.length - 1)];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      // the Milky Way: a soft band from low left to high right
      const band = Math.exp(-Math.pow((j - (H * 0.72 - i * 0.42 * H / 112)) / 18, 2)) * (0.5 + fbm(i / 12, j / 7, 4) * 0.8);
      const t = Math.pow(j / H, 1.6) * 0.75 + band * 0.32 + (fbm(i / 20, j / 13, 2) - 0.5) * 0.12;
      x.fillStyle = pick(t, i, j); x.fillRect(i, j, 1, 1);
    }
    for (let k = 0; k < W * 1.8; k++) {
      const i = Math.floor(hashI(k, 3, 1) * W), j = Math.floor(hashI(k, 4, 1) * H * 0.8), b = hashI(k, 5, 1);
      x.fillStyle = b > 0.93 ? "#fffbe8" : b > 0.75 ? "#c8d0f0" : b > 0.45 ? "#6a7498" : "#3a4468"; x.fillRect(i, j, 1, 1);
      if (b > 0.985) { x.fillStyle = "#8a94c0"; for (const [a, d] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) x.fillRect(i + a, j + d, 1, 1); }
    }
    for (let i = 0; i < W; i++) { const t = R(ridge(i) - 8 - Math.sin(i / 14 + 2) * 2 - fbm(i / 8, 1, 9) * 4); for (let j = t; j < ridge(i); j++) { x.fillStyle = "#0c1220"; x.fillRect(i, j, 1, 1); } }
    for (let i = 0; i < W; i++) { const top = R(ridge(i)); for (let j = top; j < H; j++) { x.fillStyle = j === top ? "#2a3650" : j === top + 1 ? "#121826" : "#05060a"; x.fillRect(i, j, 1, 1); } }
    return (skyCache[W + "x" + H] = c);
  }
  // a sprite as a pitch-dark figure with a rim of sky light, and a rim of its own colour once it plays
  function silhouette(cv, col, glowOn) {
    const c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height;
    const x = c.getContext("2d"), d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height), p = d.data, w = cv.width, h = cv.height;
    const on = (i, j) => i >= 0 && j >= 0 && i < w && j < h && p[(j * w + i) * 4 + 3] > 80;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!on(i, j)) continue;
      const k0 = (j * w + i) * 4, lum = (p[k0] * 0.3 + p[k0 + 1] * 0.5 + p[k0 + 2] * 0.2) / 255;
      let c0 = Art.mix("#04050a", "#2a3450", Math.min(1, lum * 0.55));
      if (!on(i, j - 1) || !on(i - 1, j)) c0 = "#3a4a6a";
      if (glowOn && (!on(i + 1, j) || !on(i - 1, j) || !on(i, j - 1))) c0 = col;
      else if (glowOn) c0 = Art.mix(c0, col, 0.18);
      x.fillStyle = c0; x.fillRect(i, j, 1, 1);
    }
    return c;
  }
  function starsScene(rec, P, words) {
    const W = 256, H = 144, hit = strikes(P), ridge = (x) => H * 0.84 - Math.sin(x / 40 + 0.4) * 7 - Math.sin(x / 14) * 1.6;
    const sky = skyCanvas(W, H, ridge);
    const joinT = {};
    for (const c of P.cues) if (c.kind === "join") joinT[c.who] = c.t;
    const startT = P.lines.length ? P.lines[0].t0 : 0, endT = (P.cues.find((c) => c.kind === "end") || { t: P.len }).t;
    const chorusT = (P.cues.find((c) => c.kind === "chorus") || { t: endT }).t;
    // the whole crew at the fire is on the ridge, joined or not: the lead, the joiners, and anyone who only listened
    const players = castOf(rec).slice(0, 6);
    // the lead in the middle, the crew either side
    const order = players.slice(1).reduce((a, p, i) => (i % 2 ? [p].concat(a) : a.concat([p])), [players[0]]);
    const gap = Math.min(44, (W - 60) / Math.max(1, order.length - 1 + (rec.pets && rec.pets.length ? 1 : 0)));
    const x0 = R(W / 2 - gap * (order.length - 1) / 2);
    const cast = order.map((p, i) => {
      const h = heroOf(p.id, p.name), x = R(x0 + i * gap), left = x > W / 2 + 4;
      const g = Art.heroGrid(bare(h), 0, App.heroLook(h)), cv = (left ? g.flipX() : g).toCanvas(1), col = lift((h.look || {}).fav, 0.55);
      const H = holdOf(p.inst || null, p.how) ? held(h, p.inst || null, p.how) : null, sil = {};
      const posed = H ? (k, hands) => { const key = k + (hands ? "h" : ""); if (!(key in sil)) { const pc = hands ? H.hands(k, left) : H.body(k, left); sil[key] = pc ? silhouette(pc, col, true) : null; } return sil[key]; } : null;
      return { p, h, x, left, col, dark: silhouette(cv, col, false), lit: silhouette(cv, col, true), posed, fy: R(ridge(x)) + 1 };
    });
    const pet = (rec.pets || [])[0], petOwner = pet && App.heroes && App.heroes[pet.owner];
    const petCast = petOwner && petOwner.pet ? (() => {
      const x = R(Math.min(W - 14, cast[cast.length - 1].x + gap * 0.7)), g = Art.petGrid(petOwner.pet, 0), cv = g.flipX().toCanvas(1);
      return { x, fy: R(ridge(x)) + 1, dark: silhouette(cv, "#ffc070", false), lit: silhouette(cv, "#ffc070", true), how: pet.does };
    })() : null;
    const anchors = {};
    for (const c of cast) anchors[c.p.id] = [c.x, c.fy - c.dark.height - 1];
    const lit = (c, t) => (c.p.how === "lead" ? t >= startT - 0.8 : joinT[c.p.id] != null ? t >= joinT[c.p.id] : c.p.how === "listen" && t >= endT);
    // bonds: the crew's own pairs, threads between neighbours on the ridge
    const rel = {};
    for (const [a, b, r] of (rec.anthem || {}).bonds || []) rel[a + "|" + b] = rel[b + "|" + a] = r;
    const title = (words && words.title) || (rec.song || {}).title || "";
    const tu = title.length <= 15 ? 3 : 2;
    const titleStars = layoutStars(title, W, 8, tu);
    const verseLines = P.lines.filter((l) => !l.chorus);
    const lineStars = verseLines.map((l) => layoutStars(l.text || "", W, 10, 2));
    let calm = false;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    function draw(t, o) {
      calm = !!(o && o.calm);
      ctx.drawImage(sky, 0, 0);
      // the bond, before anyone plays: gold threads heart to heart
      const bondA = t < startT ? 1 : t > endT + 1 ? 1 : 0.45;
      for (let k = 0; k < cast.length - 1; k++) {
        const a = cast[k], b = cast[k + 1], r = rel[a.p.id + "|" + b.p.id], str = r == null ? 0.6 : clamp(r / 100, 0.3, 1);
        const ya = a.fy - 18, yb = b.fy - 18;
        for (let x = a.x + 4; x < b.x - 4; x++) { const k2 = (x - a.x) / (b.x - a.x), sag = Math.sin(k2 * Math.PI) * 3; dot(ctx, x, ya + (yb - ya) * k2 + sag, "#f0c860", bondA * str * ((x & 1) ? 0.9 : 0.5)); }
        if ((t < startT || t > endT + 1.2) && (!calm || t > endT)) put(ctx, spr("heart"), (a.x + b.x) / 2, (ya + yb) / 2 - 2 - (calm ? 0 : R(Math.sin(t * 2 + k) * 1)));
      }
      // notes climb from each instrument and become the stars of the line being sung
      if (!calm) for (const c of cast) {
        if (!lit(c, t) || t > endT) continue;
        const ix = c.x + (c.left ? -10 : 10), iy = c.fy - 14;
        for (let k = 0; k < 6; k++) {
          const a = frac(t * 0.35 + k / 6 + h01(c.x, k) * 0.1), x = ix + Math.sin(a * 7 + c.x) * 4 + (W / 2 - ix) * a * 0.4, y = iy - a * (iy - 40);
          dot(ctx, x, y, c.col, 1 - a * 0.6); if (k % 2 === 0) dot(ctx, x, y - 1, "#fffbe8", 0.6 * (1 - a));
        }
      }
      // the verse, word by word, in stars; at the chorus its stars regather into the song's title
      const curV = verseLines.findIndex((l) => t >= l.t0 - 0.05 && t < l.t1 + 0.6);
      if (t < chorusT) {
        verseLines.forEach((l, i) => {
          if (t < l.t0 - 0.05) return;
          // the next line takes the same sky, so the last one clears quickly rather than the two being read as one
          const nx = verseLines[i + 1], gone = nx && t >= nx.t0 - 0.05 ? clamp(1 - (t - nx.t0 + 0.05) / 0.25, 0, 1) : 1;
          const sung = l.words.filter((w) => w.t <= t).length / Math.max(1, l.words.length), fadeOut = Math.min(gone, i === curV ? 1 : clamp(1 - (t - l.t1 - 0.6) / 1.2, 0, 1));
          if (fadeOut <= 0) return;
          drawStars(ctx, lineStars[i], sung, cast[0].col, { alpha: fadeOut });
        });
      } else {
        const k = clamp((t - chorusT) / Math.max(2.5, (endT - chorusT) * 0.7), 0, 1), e = k * k * (3 - 2 * k);
        const last = lineStars[lineStars.length - 1] || [];
        const lp = last.flatMap((L) => L.pts);
        const from = (li, j, x, y) => {
          const s = lp.length ? lp[(li * 7 + j * 3) % lp.length] : [x + (hashI(li, j, 2) - 0.5) * 60, y + 40];
          return calm ? [x, y] : [s[0] + (x - s[0]) * e, s[1] + (y - s[1]) * e];
        };
        drawStars(ctx, titleStars, calm ? 1 : clamp(k * 1.25, 0, 1), "#ffe8a0", { big: true, from, lines: e > 0.85 || calm, line: 0.4 });
        // a shooting star underlines it: the anthem is born
        const bottom = Math.max(...titleStars.flatMap((L) => L.pts.map((p) => p[1])), 20) + 6;
        const s = (t - endT) / 0.9;
        if (s > 0 && !calm) {
          const xa = 6, xb = W - 6, xe = xa + (xb - xa) * clamp(s, 0, 1);
          for (let x = xa; x <= xe; x++) dot(ctx, x, bottom - (x - xa) * 0.03, x > xe - 10 ? "#ffffff" : "#ffe8a0", s < 1 ? Math.pow((x - xa) / Math.max(1, xe - xa), 1.4) : 0.5);
          if (s < 1.2) { spark(ctx, xe, bottom - (xe - xa) * 0.03, "#ffe8a0", 2); pglow(ctx, xe, bottom, 7, 7, "#fff0be", 0.3, 4); }
        } else if (calm && t > endT) line(ctx, 6, bottom, W - 6, bottom - 7, "#ffe8a0", 0.5);
      }
      for (const c of cast) {
        const on = lit(c, t) && t < endT + 2.5;
        if (on) pglow(ctx, c.x, c.fy - 16, 16, 14, c.col, calm ? 0.4 : 0.4 + 0.1 * Math.sin(t * 2.4 + c.x), 5);
        const k = gripFrame(c.p.inst || null, c.p.how, t, hit(c.p.id, t), calm), img = on ? (c.posed && c.posed(k)) || c.lit : c.dark;
        ctx.drawImage(img, c.x - (img.width >> 1), c.fy - img.height);
        if (on) drawInst(ctx, c.p.inst || null, c.p.how, c.x, c.fy - 15, c.left ? -1 : 1, t, hit(c.p.id, t), calm, c.col, c.posed ? (kk) => c.posed(kk, true) : null);
      }
      if (petCast) {
        const on = t > chorusT && t < endT + 2;
        const img = on ? petCast.lit : petCast.dark;
        ctx.drawImage(img, petCast.x - (img.width >> 1), petCast.fy - img.height);
        if (on) pglow(ctx, petCast.x, petCast.fy - 4, 8, 6, "#ffc070", 0.25, 4);
      }
    }
    return { cv, W, H, anchors, crowd: null, along: "crew", draw, plate: { title, crew: (rec.anthem || {}).crew, names: players.map((p) => p.name) } };
  }

  // ---------- the player ----------
  // a scene: fn(rec, plan, words) -> { cv, W, H, draw(t, {calm}), anchors: {heroId: [x, y] above the head, canvas px},
  //   crowd: [x, y] where the room's sing-back shows, or null; along: "crowd" | "crew"; plate?: {title, crew, names} }
  // the camp scene (concept C, the overhead fire circle) plugs in here with register("camp", fn)
  const SCENES = { tavern: tavernScene, stars: starsScene, camp: null };
  const kindOf = (rec) => (rec.anthem ? "stars" : rec.where === "tavern" ? "tavern" : "camp");
  function register(kind, fn) { SCENES[kind] = fn; }
  const OUTCOME = () => ((window.LD && LD.static && LD.static.music && LD.static.music.outcomes) || {});
  function mark(w) {
    const t = w.txt.replace(/[{}*]/g, "");
    return w.sour ? `{shake}${t}{/}` : w.held ? `{wave}${t}{/}` : t;
  }

  function player(rec, opts) {
    const o = opts || {}, el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; };
    const fig = el("figure", "music-replay"), words = Music.words(rec.song), kind = kindOf(rec), make = SCENES[kind];
    const specShort = Music.specFor(rec, words, "short"), specFull = Music.specFor(rec, words, "full");
    let P = Music.plan(specShort);
    const short = P;
    const full = Music.plan(specFull);
    const folk = rec.song && rec.song.src === "folk" ? (((LD.static.music || {}).folk) || []).find((x) => x.id === rec.song.id) : null;
    const wrap = el("div", "tavern music-stage");
    fig.append(wrap);
    let scene = null;
    if (make) { try { scene = make(rec, P, words); } catch (e) { if (window.console) console.error(e); scene = null; } }
    const cap = el("figcaption", "music-cap");
    const btnFull = el("button", "btn small", "▸ The whole song"), btnPlay = el("button", "btn small", "▸ Listen");
    btnFull.hidden = !(full.len > P.len + 4);
    const status = el("span", "small muted");
    cap.append(btnPlay, btnFull, status);
    const lyr = el("div", "music-lyrics");
    if (!scene) {
      // a camp night before its scene exists: the song with its words, karaoke style
      wrap.className = "music-stage words";
      const card = el("div", "music-titlecard");
      card.append(el("b", null, folk ? folk.world_title : `“${(words && words.title) || rec.song.title}”`), el("span", "small muted", folk ? folk.teller : rec.place || ""));
      wrap.append(card, lyr);
    }
    fig.append(cap);
    // the words are the best part, so a reader with the sound off sees the verse and chorus before pressing play (round 31)
    if (scene && words) { lyr.classList.add("verse"); fig.append(lyr); }
    if (folk) fig.append(el("div", "tiny dim music-small", `The tune is ${folk.real_title}, a traditional air.`));
    const lyricBlock = () => {
      lyr.innerHTML = "";
      if (!words) { lyr.append(el("p", "small muted", folk ? "A tune without words, hummed and played." : "")); return; }
      const seen = new Set();
      for (const L of P.lines) {
        if (seen.has(L.idx) && L.chorus) continue;
        seen.add(L.idx);
        lyr.append(el("div", L.chorus ? "chorus" : L.resp ? "resp" : "", L.text));
      }
    };
    lyricBlock();
    if (scene) scene.plan = P;
    let cv = scene ? scene.cv : null;
    if (cv) {
      cv.className = "music-canvas";
      wrap.append(cv);
      cv.title = "Click to hear it again";
    }
    const plateEl = el("div", "anthem-plate");
    plateEl.hidden = true;
    if (scene && scene.plate) {
      plateEl.append(el("small", null, "A crew anthem is born"), el("b", null, scene.plate.title), el("small", null, scene.plate.crew || scene.plate.names.join(", ")));
      wrap.append(plateEl);
    }
    const talk = window.Speech && cv ? Speech.layer(wrap, (a) => { const k = cv.clientWidth / scene.W; return [a.at[0] * k, a.at[1] * k]; }) : null;
    const actors = {};
    const actorOf = (id, name) => actors[id] || (actors[id] = { name, h: heroOf(id, name), at: (scene && scene.anchors[id]) || [scene ? scene.W / 2 : 0, 20] });
    const crowd = scene && scene.crowd ? { name: "", at: scene.crowd } : null;
    const names = {};
    names[rec.lead.id] = rec.lead.name;
    for (const j of rec.joiners || []) names[j.id] = j.name;
    if (folk && scene) {
      const tc = el("div", "music-titlecard over");
      tc.append(el("b", null, folk.world_title), el("span", null, folk.teller));
      wrap.append(tc);
    }

    const slots = [];
    let t = 0, raf = 0, last = 0, onscreen = false, shown = -1, playing = false, handle = null, ended = false, paused = false;
    const live = () => !paused && fig.isConnected && onscreen && !document.hidden;
    const paint = () => { if (scene) scene.draw(t, { calm: isReduced() || isStill() }); };
    function lyricsAt(now) {
      if (!talk || !words) return;
      while (shown + 1 < P.lines.length && P.lines[shown + 1].t0 - 0.05 <= now) {
        const i = ++shown, L = P.lines[i], next = P.lines[i + 1], times = L.words.map((w) => w.t - now);
        const hold = Math.max(0.6, (next ? next.t0 : L.t1 + 1.5) - (L.words.length ? L.words[L.words.length - 1].t : L.t0) - 0.2);
        const text = L.words.map(mark).join(" ");
        if (scene.lyricAt) {
          // the camp: lines rise with the smoke; the newest sits low on the column and the older ones step up it
          const slot = { name: "", h: heroOf(rec.lead.id, rec.lead.name), at: scene.lyricAt(0), born: i };
          slots.forEach((x) => { x.at = scene.lyricAt(i - x.born); });
          slots.push(slot);
          talk.sing(slot, text, times, { hold: hold + (next ? next.t1 - next.t0 : 0), who: false });
          talk.place();
        } else talk.sing(actorOf(rec.lead.id, rec.lead.name), text, times, { hold });
        // the chorus comes back from the room (a tavern) or the crew (the stars)
        if ((L.chorus || L.resp) && L.along.length) {
          const who = scene.along === "crowd" && crowd ? crowd : actorOf(L.along[0], names[L.along[0]]);
          talk.sing(who, L.words.map((w) => w.txt).join(" "), times.map((x) => x + 0.18), { hold, cls: "along", who: scene.along === "crowd" ? false : undefined });
        }
      }
    }
    function stopSound() { if (handle) { handle.stop(); handle = null; } }
    // the song autoplays before the page has had a gesture; the music comes in, in time with the scene, the moment sound unlocks
    function hearIn() {
      if (t > P.len - 0.5 || isStill()) return;
      const E = window.Sound && Sound.engine ? Sound.engine() : null;
      if (E && E.live) handle = Music.perform(P, { voices: Music.voices(P === full ? specFull : specShort), now: Math.max(0, t) });
    }
    function frame(ms) {
      raf = 0;
      if (!live()) { last = 0; stopSound(); if (talk) talk.hold(true); return; }
      if (talk) talk.hold(false);
      const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
      last = ms;
      if (!handle && !ended) hearIn();
      t = handle ? handle.t : t + dt;
      lyricsAt(t);
      if (t > P.len + 1.5 && !ended) {
        ended = true; playing = false; stopSound();
        status.textContent = [OUTCOME()[rec.outcome] || rec.outcome, rec.pay ? `${rec.pay} copper in the hat` : null].filter(Boolean).join(" · ");
        btnPlay.textContent = "▸ Again";
      }
      if (scene && scene.plate) plateEl.hidden = !(t > P.cues.find((c) => c.kind === "end").t + 1.0);
      paint();
      if (!ended || t < P.len + 4) raf = requestAnimationFrame(frame);
    }
    function start(plan, withSound) {
      P = plan; t = 0; shown = -1; ended = false; playing = true; paused = false; last = 0; slots.length = 0;
      if (talk) talk.clear();
      stopSound();
      lyricBlock();
      status.textContent = "";
      btnPlay.textContent = "■ Stop";
      const E = window.Sound && Sound.engine ? Sound.engine() : null;
      if (withSound !== false && E && E.live) handle = Music.perform(P, { voices: Music.voices(P === full ? specFull : specShort) });
      // the whole song has its own cues (when each player joins, when it ends), so its scene is rebuilt on them
      if (scene && scene.plan !== P) {
        try { const next = make(rec, P, words); next.plan = P; next.cv.className = cv.className; next.cv.title = cv.title; next.cv.onclick = cv.onclick; cv.replaceWith(next.cv); cv = next.cv; scene = next; } catch (e) { /* keep the old scene */ }
      }
      if (scene) { scene.draw(0, { calm: true }); }
      if (isStill()) { stillFrame(); return; }
      if (!raf && live()) raf = requestAnimationFrame(frame);
    }
    // static scenes: one held frame mid-song with the words as a still block; a click plays the sound only
    function stillFrame() {
      const ch = P.lines.find((l) => l.chorus) || P.lines[0];
      t = ch ? (ch.t0 + ch.t1) / 2 : P.len / 2;
      if (scene) scene.draw(t, { calm: true });
      if (scene && !lyr.isConnected) fig.insertBefore(lyr, cap);
    }
    btnPlay.hidden = !!(o.bar && scene);
    btnPlay.onclick = () => { if (playing && !ended) { stopSound(); playing = false; ended = true; btnPlay.textContent = "▸ Listen"; return; } start(P === full ? full : short, true); };
    btnFull.onclick = () => { start(full, true); };
    if (cv) cv.onclick = () => start(P === full ? full : short, true);
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => {
        const was = onscreen;
        onscreen = es[es.length - 1].isIntersecting;
        if (!fig.isConnected && was) { io.disconnect(); stopSound(); return; }
        if (onscreen && !was && !ended && !raf && !isStill() && scene) raf = requestAnimationFrame(frame);
      });
      io.observe(fig);
    } else onscreen = true;
    document.addEventListener("visibilitychange", () => { if (document.hidden) stopSound(); else if (!ended && !raf && fig.isConnected && scene && !isStill()) raf = requestAnimationFrame(frame); });
    // the page's shared control bar drives the player through this (replay.js); a song keeps its own time, so it has no speeds
    if (o.bar && scene) {
      fig.replay = {
        get t() { return t; }, get dur() { return P.len + 1.5; }, get playing() { return playing && !ended && !paused; },
        play() {
          if (ended || !playing) { start(P === full ? full : short, true); return; }
          paused = false; last = 0;
          const E = window.Sound && Sound.engine ? Sound.engine() : null;
          if (E && E.live && !isStill()) handle = Music.perform(P, { voices: Music.voices(P === full ? specFull : specShort), now: t });
          if (!raf && live() && !isStill()) raf = requestAnimationFrame(frame);
        },
        pause() { paused = true; stopSound(); if (talk) talk.hold(true); },
        restart() { start(P === full ? full : short, true); },
        skip() {
          stopSound(); paused = false; playing = true; ended = false; shown = P.lines.length - 1; t = P.len + 1.6;
          if (talk) talk.clear();
          if (!raf && live()) raf = requestAnimationFrame(frame);
        },
      };
    }
    if (scene) {
      if (isStill()) stillFrame();
      else { paint(); playing = true; btnPlay.textContent = "■ Stop"; if (o.autoplay !== false) setTimeout(() => { if (fig.isConnected && !raf && onscreen) raf = requestAnimationFrame(frame); }, 0); }
    } else {
      // the words-only camp song: the lines light up as they're sung
      btnPlay.textContent = "▸ Listen";
      btnPlay.onclick = () => {
        if (handle) { stopSound(); btnPlay.textContent = "▸ Listen"; return; }
        handle = Music.perform(P, { voices: Music.voices(specShort), done: () => { handle = null; btnPlay.textContent = "▸ Listen"; } });
        if (!handle) return;
        btnPlay.textContent = "■ Stop";
        const rows = [...lyr.children], tick = () => {
          if (!handle) { rows.forEach((r) => r.classList.remove("on")); return; }
          const now = handle.t, i = P.lines.findIndex((l) => now >= l.t0 && now < l.t1);
          let k = -1, seen = new Set(), idx = -1;
          P.lines.forEach((l, j) => { if (!(seen.has(l.idx) && l.chorus)) { seen.add(l.idx); idx++; } if (j === i) k = l.chorus ? [...seen].indexOf(l.idx) : idx; });
          rows.forEach((r, j) => r.classList.toggle("on", j === k));
          setTimeout(tick, 200);
        };
        tick();
      };
      btnFull.onclick = () => { stopSound(); P = full; lyricBlock(); btnPlay.onclick(); };
    }
    return fig;
  }

  // pure: a plan's length and cues, for the night gallery and tests
  function timeline(rec, part) { const P = Music.plan(Music.specFor(rec, Music.words(rec.song), part || "short")); return { len: P.len, cues: P.cues, lines: P.lines.length }; }
  window.MusicReplay = { player, register, kindOf, timeline, strikes, castOf, SCENES, drawInst, grip, gripFrame, held, GLYPH };
})();
