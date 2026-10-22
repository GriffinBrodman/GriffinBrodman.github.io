/* Ceremony Night: the season's envelopes opened on the party's stage (league/finale.py `ceremony`), one award at a time: the presenter reads, the winner walks up from the crowd, takes the trophy and bows, friends cheer and the runner-up sulks. */
(function () {
  "use strict";
  const R = Math.round, frac = (v) => ((v % 1) + 1) % 1, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const W = 240, H = 120, OL = "#160d07", BEAT = 0.54;
  const TOP = 80, FACE = 90, S0 = 54, S1 = 186, STAGE_FEET = 82, LECTERN = 76;
  const CALL = 1.8, UP = 2.0, GIVE = 5.4, BOW = 6.1, ALOFT = 7.0, DUR = 10.5;
  const h01 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const mix = (a, b, t) => Art.mix(a, b, t);
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").imageSmoothingEnabled = false; return c; };
  const sprite = (rows, pal) => Anim.sprite(rows, pal, OL);
  const dot = (ctx, x, y, c, a) => { if (a != null) ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = c; ctx.fillRect(R(x), R(y), 1, 1); ctx.globalAlpha = 1; };
  const box = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(R(x), R(y), w, h); };
  const PARTY_COLS = ["#c8463a", "#e8b84a", "#efe4cc", "#3a7a9a", "#5a9a4a"];
  const LEAVES = ["#4e8a3e", "#6aa84a", "#2e5a28", "#e8b84a", "#c8902a"];

  // ---------- figures: the heroes with weapons put away, the townsfolk who present, Nib ----------
  function bare(h) {
    const kit = h.kit ? JSON.parse(JSON.stringify(h.kit)) : null;
    if (kit) { kit.weapon = null; kit.offhand = null; if (kit.back && kit.back.art === "quiver") kit.back = null; }
    return Object.assign({}, h, { alive: true, weapon: "none", weapon_tier: 1 }, kit ? { kit } : {});
  }
  const cvs = new Map();
  function memo(key, make) { if (!cvs.has(key)) { let c = null; try { c = make(); } catch (e) { c = null; } cvs.set(key, c); } return cvs.get(key); }
  const heroCv = (id, f, left) => memo(`${id}:${f}:${left ? "L" : ""}`, () => { const h = App.heroes[id], g = Art.heroGrid(bare(h), f, App.heroLook(h)); return (left ? g.flipX() : g).toCanvas(1); });
  // a presenter's working clothes, by the townsfolk role league/finale.py names
  const ROLE_LOOK = { barkeep: ["vest", "none"], smith: ["leather", "leather_cap"], guard: ["chain", "helm"], priest: ["vestments", "mitre"], merchant: ["fancy", "top_hat"],
    special: ["cloak", "hood"], undertaker: ["robe_dark", "wide_hat"] };
  function folkCv(name, role, f, left) {
    return memo(`folk:${name}:${role}:${f}:${left ? "L" : ""}`, () => {
      const r = Art.rng(Art.hash(name || "keeper")), p = (a) => a[Math.floor(r() * a.length)], [outfit, head] = ROLE_LOOK[role] || ROLE_LOOK.barkeep;
      const look = { skin: p(["#f0c8a0", "#e0b088", "#c48a5e", "#9a6440", "#6e4428"]), hair: p(["#3a2a1a", "#6a4020", "#c8a050", "#9a9aa6", "#2a2228"]), style: Math.floor(r() * 6), face: Math.floor(r() * 3), fav: p(["#5a6a3a", "#3a5a8a", "#7a5a3a", "#6a3a3a"]), scars: [] };
      const g = Art.heroGrid({ id: "folk:" + name, name, look, weapon: "none", weapon_tier: 1, armor_tier: 1 }, f, { name: role, look: { outfit, head, aura: null, offhand: "none" } });
      return (left ? g.flipX() : g).toCanvas(1);
    });
  }
  const nibCv = (f, left) => memo(`nib:${f}:${left ? "L" : ""}`, () => { const g = Art.monsterGrid(App.S.monsters.goblin, f); return (left ? g.flipX() : g).toCanvas(1); });
  function draw(ctx, c, x, feet, o) {
    if (!c) return;
    o = o || {};
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.drawImage(c, R(x - c.width / 2), R(feet - c.height + (o.dy || 0)));
    ctx.globalAlpha = 1;
  }
  function shadow(ctx, x, y, w) { ctx.fillStyle = "rgba(10,6,4,0.35)"; ctx.fillRect(R(x - w / 2), R(y), w, 1); ctx.fillRect(R(x - w / 2 + 2), R(y + 1), w - 4, 1); }

  // ---------- props ----------
  const MUG = sprite(["ffff.", "wwww.", "wWwwww", "wWww.w", "wWwwww", "wwww."], { f: "#fbf4dc", w: "#8a5a30", W: "#b07a44" });
  const ENVELOPE = sprite(["pppppppp", "pPppppPp", "ppPrrPpp", "pppRrppp", "pppppppp"], { p: "#f4ead0", P: "#c8b898", r: "#c8463a", R: "#8a2a24" });
  const VEIN = sprite(["r.r", ".r.", "r.r"], { r: "#e0402a" });
  const BUBBLE = { dots: ["xxxxxxx", "xwwwwwx", "xwkwkwk", "xwwwwwx", "xxxxxxx", "..x...."], bang: ["xxxxx", "xwkwx", "xwkwx", "xwwwx", "xwkwx", "xxxxx", ".x..."], note: ["xxxxxx", "xwwkkx", "xwwkwx", "xkkkwx", "xkkwwx", "xxxxxx", ".x...."] };
  const bubbles = {};
  const bubble = (k) => bubbles[k] || (bubbles[k] = Anim.sprite(BUBBLE[k], { x: "#3a2418", w: "#fbf4e4", k: "#3a2418" }, null));
  const smallTrophy = (kind) => Trophies.scene(kind);
  function bunting(ctx, x0, x1, y, sag, seed) {
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0), yy = R(y + Math.sin(u * Math.PI) * sag);
      dot(ctx, x, yy, "#2a1a10");
      const k = (x - x0) % 7;
      if (k >= 1 && k <= 5) { const c = PARTY_COLS[(Math.floor((x - x0) / 7) + seed) % PARTY_COLS.length], d = 3 - Math.abs(k - 3); for (let j = 1; j <= d + 1; j++) dot(ctx, x, yy + j, j === d + 1 ? mix(c, "#000000", 0.25) : k < 3 ? mix(c, "#ffffff", 0.12) : c); }
    }
  }

  // ---------- the room: the venue's tavern (the party's own room), a curtained stage, the season's banner, a lectern ----------
  function room(town, seed) {
    const cv = canvas(W, H), info = { kind: "tavern", W, H, town, wx: town === "frosthold" ? "snow" : "clear" };
    if (window.TavernFlat) TavernFlat.paint(cv, info, Art.rng(seed));
    const ctx = cv.getContext("2d");
    for (let y = 3; y < TOP; y++) for (const [x0, x1] of [[S0 - 8, S0 + 6], [S1 - 6, S1 + 8]]) for (let x = x0; x < x1; x++) {
      const fold = Math.sin((x - x0) * 1.3 + (y > 50 ? (x0 < W / 2 ? 1 : -1) * (y - 50) * 0.05 : 0));
      dot(ctx, x, y, mix("#8a1e1e", fold > 0.3 ? "#d04a3a" : fold < -0.5 ? "#3a0a0a" : "#8a1e1e", Math.abs(fold) * 0.6));
    }
    for (const x of [S0 + 4, S1 - 4]) { box(ctx, x - 3, 50, 7, 2, "#e8b84a"); box(ctx, x - 2, 52, 5, 1, "#a87a22"); }
    for (let x = S0 - 8; x < S1 + 8; x++) {
      const sc0 = 8 + R(Math.abs(Math.sin((x - S0) * Math.PI / 16)) * 3);
      for (let y = 3; y < sc0; y++) dot(ctx, x, y, y < 5 ? "#5a1414" : mix("#a82a24", "#6a1414", (y - 3) / 8));
      dot(ctx, x, sc0, "#e8b84a"); if (x % 2) dot(ctx, x, sc0 + 1, "#c89a30");
    }
    // the season's banner over the stage: crimson, gold-edged, the laurel cup on it
    const BX = W / 2 - 13, BY = 15;
    for (let y = 0; y < 28; y++) for (let x = 0; x < 26; x++) {
      const tail = y > 22 && Math.abs(x - 12.5) < (y - 22) * 1.6;
      if (tail) continue;
      const edge = x === 0 || x === 25 || y === 0;
      dot(ctx, BX + x, BY + y, edge ? "#c8902a" : x === 1 || x === 24 || y === 1 ? "#ffe070" : (x + y) % 9 === 0 ? "#7a1e1a" : "#a82a24");
    }
    box(ctx, BX - 2, BY - 1, 30, 1, "#5a3418");
    ctx.drawImage(smallTrophy("mvp"), BX + 6, BY + 5);
    // the boards and their front
    for (let y = TOP; y < FACE + 2; y++) for (let x = S0 - 6; x < S1 + 6; x++) {
      const top = y < TOP + 4, plank = Math.floor((x - S0) / 12);
      let c = top ? mix("#a87038", "#7a4c26", (y - TOP) / 4 + ((plank % 2) ? 0.1 : 0)) : mix("#5a361a", "#2a180c", (y - TOP - 4) / 8);
      if (top && (x - S0) % 12 === 0) c = "#4a2a12";
      if (!top && (x - S0) % 6 === 0) c = mix(c, "#000000", 0.25);
      if (y === TOP) c = "#c8904a";
      if (y === TOP + 4) c = "#2a1808";
      dot(ctx, x, y, c);
    }
    // three steps down the middle to the floor
    for (let k = 0; k < 3; k++) {
      const y = FACE + 2 + k * 4, x0 = W / 2 - 12 - k * 2, x1 = W / 2 + 12 + k * 2;
      for (let x = x0; x < x1; x++) { dot(ctx, x, y, "#b07a44"); dot(ctx, x, y + 1, "#8a5a2a"); dot(ctx, x, y + 2, "#5a3418"); dot(ctx, x, y + 3, "#3a2010"); }
    }
    bunting(ctx, S0 - 6, S1 + 6, 12, 4, 2);
    const r = Art.rng(seed + 7), s = () => Math.floor(r() * 1e9);
    const acts = window.TavernFlat ? TavernFlat.actors(info, Anim, s).filter((a) => a.z < 60 || a.z > 1e3) : [];
    return { cv, acts };
  }
  // the lectern: drawn in front of whoever reads from it
  function lectern(ctx) {
    const x = LECTERN, y = STAGE_FEET;
    for (let j = 0; j < 17; j++) { const hw = j < 3 ? 8 : j < 14 ? 5 : 7; for (let i = -hw; i < hw; i++) dot(ctx, x + i, y - 17 + j, j < 2 ? (i < 0 ? "#c8904a" : "#a87038") : j === 2 ? "#4a2a12" : i === -hw ? "#8a5a2a" : i === hw - 1 ? "#3a2010" : (j + i) % 7 === 0 ? "#5a3418" : "#6e4422"); }
    box(ctx, x - 3, y - 11, 6, 3, "#c8902a"); box(ctx, x - 3, y - 11, 6, 1, "#ffe070");
  }
  function footlight(x, y, seed) {
    return { z: 4e3, front: true, draw(ctx, t) {
      box(ctx, x - 3, y - 1, 7, 3, "#5a5a64"); box(ctx, x - 3, y - 1, 7, 1, "#a8a8b4");
      const f = frac(t * 3.7 + h01(seed, 2)) < 0.5;
      dot(ctx, x, y - 2, "#fff4c0"); dot(ctx, x, y - 3, f ? "#ffb040" : "#ffd27a");
      Anim.light(ctx, x, y - 6, 16, "255,190,110", 0.16);
    } };
  }

  // ---------- the cast of one envelope ----------
  const membersOf = (pid) => ((App.parties[pid] || {}).members || []).filter((m) => App.heroes[m] && App.heroes[m].alive !== false);
  function castOf(env, standings) {
    const party = env.kind === "party";
    const walkers = party ? membersOf(env.winner).slice(0, 4) : [env.winner].concat(env.co || []).filter((id) => App.heroes[id]);
    const heroIds = (ids) => (party ? ids.flatMap((p) => membersOf(p).slice(0, 2)) : ids).filter((id) => App.heroes[id]);
    const cheer = heroIds((env.crowd || {}).cheer || []), sulk = heroIds((env.crowd || {}).sulk || []);
    const ru = env.runner_up || {}, runner = heroIds([party ? ru.party : ru.hero].filter(Boolean));
    const presenter = env.presenter && env.presenter.hero;
    const seen = new Set(walkers.concat(presenter ? [presenter] : []));
    const crowd = [];
    const add = (id, how) => { if (!seen.has(id) && crowd.length < 9 - walkers.length) { seen.add(id); crowd.push({ id, how }); } };
    // a big league can't all fit on the floor: the runner-up and the winner's friends go in before anyone who only watches
    runner.forEach((id) => add(id, cheer.includes(id) ? "cheer" : "sulk"));
    for (let k = 0; k < Math.max(cheer.length, sulk.length); k++) { if (cheer[k]) add(cheer[k], "cheer"); if (sulk[k]) add(sulk[k], "sulk"); }
    for (const r of standings) if (App.heroes[r.hero] && r.alive !== false) add(r.hero, "watch");
    return { walkers, crowd };
  }
  // crowd places on the floor either side of the steps, walkers first so they start nearest the middle
  function places(n) {
    const out = [], L = [], Rr = [];
    for (let i = 0; i < 6; i++) { L.push(W / 2 - 26 - i * 18); Rr.push(W / 2 + 26 + i * 18); }
    for (let i = 0; i < n; i++) { const left = i % 2 === 0, k = i >> 1; out.push({ x: left ? L[k] : Rr[k], feet: 112 + ((k + (left ? 0 : 1)) % 2) * 5, left }); }
    return out;
  }
  const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  // where a walker is at time lt: from their crowd place to the steps, up them, and across to their spot beside the lectern
  function walkAt(p, spot, lt, delay) {
    const t = lt - UP - delay;
    if (t <= 0) return { x: p.x, feet: p.feet, moving: false };
    const legs = [[p.x, p.feet, W / 2 + (p.x < W / 2 ? -4 : 4), 108, Math.abs(p.x - W / 2) / 34 + 0.3], [W / 2, 108, W / 2, STAGE_FEET, 0.9], [W / 2, STAGE_FEET, spot, STAGE_FEET, Math.abs(spot - W / 2) / 34 + 0.2]];
    let acc = 0;
    for (const [x0, y0, x1, y1, d] of legs) {
      if (t < acc + d) { const u = ease((t - acc) / d); return { x: x0 + (x1 - x0) * u, feet: y0 + (y1 - y0) * u, moving: true, dir: Math.sign(x1 - x0) }; }
      acc += d;
    }
    return { x: spot, feet: STAGE_FEET, moving: false };
  }

  // the stage for a season's running order: a canvas, and `show(i)` to open envelope i (the captions follow through `onBeat`)
  function stage(fin, standings, opts) {
    const o = opts || {}, list = fin.ceremony || [];
    if (!list.length || !window.Art || !window.Anim || !window.Trophies) return null;
    const town = fin.venue || "ironhaven", seed = Art.hash("ceremony:" + town + list.length);
    const rm = room(town, seed), base = rm.cv;
    const cv = canvas(W, H);
    cv.className = "ceremony-canvas";
    cv.setAttribute("role", "img");
    const st = { i: 0, at: null, playing: true, beat: -1, cast: null, calm: false };
    const set = (i) => {
      st.i = (i + list.length) % list.length; st.at = null; st.beat = -1;
      const env = list[st.i];
      st.cast = castOf(env, standings);
      st.spots = places(st.cast.walkers.length + st.cast.crowd.length);
      cv.setAttribute("aria-label", `${env.name}: ${env.kind === "party" ? (App.parties[env.winner] || {}).name : (App.heroes[env.winner] || {}).name}`);
    };
    set(0);
    const localT = (t) => { if (Anim.reduced) return ALOFT + 1; if (st.at == null) st.at = t; return t - st.at; };
    const acts = rm.acts.slice();
    acts.push({ z: 50, draw(ctx, t) {
      const lt = localT(t), env = list[st.i];
      if (!Anim.reduced && st.playing && lt > DUR) { if (st.i < list.length - 1 || o.loop) { set(st.i + 1); st.at = t; if (o.onEnvelope) o.onEnvelope(st.i); } }
      const beat = lt < CALL ? 0 : lt < GIVE - 1.2 ? 1 : lt < ALOFT ? 2 : 3;
      if (beat !== st.beat) { const from = st.beat; st.beat = beat; if (o.onBeat) o.onBeat(st.i, beat, from); }
      // the crowd on the floor, the presenter at the lectern, the walkers on their way up
      const { walkers, crowd } = st.cast, spots = st.spots, order = [];
      const pres = env.presenter || {}, reading = lt < CALL;
      const pdraw = (f, left) => pres.kind === "champion" && App.heroes[pres.hero] ? heroCv(pres.hero, f, left) : pres.kind === "nib" ? nibCv(f, left) : folkCv(pres.name, pres.role, f, left);
      order.push({ y: STAGE_FEET - 1, fn: () => {
        const f = frac(t / 0.8) < 0.5 ? 0 : 1, give = lt > GIVE - 0.6 && lt < GIVE + 0.3;
        draw(ctx, pdraw(f, false), LECTERN - 2 + (give ? 3 : 0), STAGE_FEET - 1);
        if (reading) { Anim.put(ctx, ENVELOPE, LECTERN + 6, STAGE_FEET - 19); }
      } });
      order.push({ y: STAGE_FEET, fn: () => lectern(ctx) });
      const trophy = smallTrophy(env.award);
      // the trophy waits on a little stand beside the lectern (on the lectern it hid the presenter's face) until it is handed over
      const TX = LECTERN - 15;
      order.push({ y: STAGE_FEET, fn: () => {
        box(ctx, TX - 4, STAGE_FEET - 8, 9, 2, "#b07a44"); box(ctx, TX - 4, STAGE_FEET - 8, 9, 1, "#d8a868"); box(ctx, TX - 1, STAGE_FEET - 6, 3, 6, "#5a3418"); box(ctx, TX - 3, STAGE_FEET - 1, 7, 1, "#3a2010");
        if (lt < GIVE) ctx.drawImage(trophy, TX - (trophy.width >> 1), STAGE_FEET - 8 - trophy.height + 1);
      } });
      const n = walkers.length, spotX = (k) => LECTERN + 22 + k * 16;
      walkers.forEach((id, k) => {
        const p = spots[k], at = walkAt(p, spotX(k), lt, k * 0.35);
        order.push({ y: at.feet, fn: () => {
          const up = at.feet <= STAGE_FEET + 0.5, f = at.moving ? (frac(t / 0.36) < 0.5 ? 0 : 1) : frac(t / 0.8 + k * 0.3) < 0.5 ? 0 : 1;
          const facesLeft = at.moving ? at.dir < 0 : up ? lt < ALOFT + 2 : !p.left;
          const bow = lt > BOW && lt < ALOFT ? (frac((lt - BOW) / 0.45) < 0.5 ? 2 : 0) : 0, hop = lt > ALOFT && k > 0 ? (frac(t / BEAT + k * 0.2) < 0.4 ? 1 : 0) : 0;
          if (!up) shadow(ctx, at.x, at.feet, 12);
          draw(ctx, heroCv(id, f, facesLeft), at.x, at.feet, { dy: bow - hop });
          if (k === 0 && lt >= GIVE) {
            const c = heroCv(id, 0, facesLeft), top = at.feet - (c ? c.height : 32);
            const lift = lt < ALOFT ? 0 : Math.min(1, (lt - ALOFT) / 0.4), bob = lt > ALOFT + 0.4 ? (frac(t / BEAT) < 0.5 ? 0 : 1) : 0;
            const tx = at.x + (facesLeft ? -7 : 7) * (1 - lift), ty = R(top + 14 + bow - lift * 16 - bob);
            ctx.drawImage(trophy, R(tx - trophy.width / 2), R(ty - trophy.height + 6));
          }
          if (k === 0 && lt > CALL && lt < CALL + 1.2) Anim.put(ctx, bubble("bang"), at.x + 4, at.feet - 36);
        } });
      });
      crowd.forEach((c, k) => {
        const p = spots[n + k];
        if (!p) return;
        order.push({ y: p.feet, fn: () => {
          const ph = h01(k + 3, seed % 61), live = lt > CALL;
          const hop = c.how === "cheer" && live ? (frac(t / BEAT + ph) < 0.4 ? 2 : 0) : c.how === "watch" && lt > ALOFT ? (frac(t / (BEAT * 2) + ph) < 0.3 ? 1 : 0) : 0;
          const f = frac(t / 0.8 + ph) < 0.5 ? 0 : 1, away = c.how === "sulk" && live && frac(t / 4 + ph) < 0.7;
          shadow(ctx, p.x, p.feet, 12);
          draw(ctx, heroCv(c.id, f, away ? !p.left : p.left), p.x, p.feet, { dy: -hop });
          if (c.how === "cheer" && live) { const up = frac(t / 2 + ph) > 0.5 ? 4 : 0; Anim.put(ctx, MUG, p.x + (p.left ? 8 : -8), p.feet - 14 - up - hop, !p.left); }
          if (c.how === "sulk" && live && frac(t / 2.4 + k * 0.5) < 0.6) Anim.put(ctx, VEIN, p.x + 5, p.feet - 33);
        } });
      });
      order.sort((a, b) => a.y - b.y).forEach((d) => d.fn());
      if (reading) Anim.put(ctx, bubble("dots"), LECTERN + 4, STAGE_FEET - 40);
    } });
    for (let x = S0 + 4; x <= S1; x += 32) acts.push(footlight(x, FACE - 1, seed + x));
    // pixel leaves and gold flakes over the stage once the trophy is up
    acts.push({ z: 9e4, front: true, draw(ctx, t) {
      const lt = Anim.reduced ? ALOFT + 1 : st.at == null ? 0 : t - st.at;
      if (lt < ALOFT) return;
      const age = lt - ALOFT;
      for (let i = 0; i < 30; i++) {
        const sp = 18 + (i % 5) * 4, py = -6 + age * sp + h01(i, 4) * -40, px = S0 + h01(i, 2) * (S1 - S0) + Math.sin(age * 2 + i) * 4;
        if (py < -2 || py > STAGE_FEET + 4) continue;
        const c = LEAVES[i % LEAVES.length];
        dot(ctx, px, py, c); if (i % 2) dot(ctx, px + 1, py + (frac(age + i * 0.3) < 0.5 ? 0 : 1), mix(c, "#000000", 0.25));
      }
    } });
    Anim.stage(cv, base, acts, { fps: 12, still: 9 });
    return {
      cv, list,
      get i() { return st.i; },
      show(i) { set(i); if (cv.anim) cv.anim.draw(cv.anim.still); },
      play(on) { st.playing = !!on; },
      get playing() { return st.playing; },
    };
  }

  window.CeremonyReplay = { stage, castOf, W, H, DUR, CALL, ALOFT };
})();
