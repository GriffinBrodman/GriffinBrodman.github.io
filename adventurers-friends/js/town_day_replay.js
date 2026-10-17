/* Town day replays: a town stretch of a hero's daybook played as its scene (the set, the act, the captions on their beats), and the
   still-plus-loop strip behind the stretch's daybook tile. */
/*
  TownDay.player(block, opts) -> <figure> that plays while on screen, holds on its last beat, replays on click; fig.replay for the page's
    control bar. opts: { hero (the hero summary), heroes (id -> hero, default App.heroes), scale }.
  TownDay.strip(block, opts) -> a live canvas for a daybook tile: the act looping on its set, cropped round the hero (10 fps, on screen
    only; one still frame under Static scenes). opts: { hero, heroes, w, h }.
  TownDay.frame(block, t, opts) -> canvas (no DOM loop), for galleries.
  Needs town_day_sets.js and town_day_acts.js (and what they need); loaded through App.need with replay.js's KIT.town.
*/
(function (root) {
  "use strict";
  const W = 256, H = 122;
  const AMBIENCE = { tavern: "tavern", room: "room", stables: "stable", poorhouse: "inn", infirmary: "room", guild: "inn", smithy: "camp", bath: "room", temple: "room", tent: "room" };
  const reduced = () => (root.Settings ? Settings.calm() : !!(root.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches));

  function castOf(block, opts) {
    const hs = (opts && opts.heroes) || (root.App && App.heroes) || {}, hero = (opts && opts.hero) || {};
    const sc = block.scene || {};
    const mates = (sc.with || []).map((id) => hs[id]).filter(Boolean);
    const other = sc.who === "other" ? Object.values(hs).find((x) => x && x.id !== hero.id && block.line && block.line.includes(x.name) && !mates.includes(x)) : null;
    return { hero, mates, other: other || null, pet: hero.pet || null, mount: hero.mount && !hero.mount.hitched ? hero.mount : null };
  }
  function hourOf(block) {
    const sc = block.scene || {};
    return sc.hour != null ? sc.hour : ((block.from || 12) + (block.to || block.from + 1 || 13)) / 2;
  }
  function make(block, opts) {
    const sc = block.scene || {};
    const cast = castOf(block, opts);
    const set = TownSets.build(sc.set || "square", { town: sc.town, hour: hourOf(block), weather: sc.weather, lodge: sc.lodge, seed: sc.town + (cast.hero.id || ""),
      festival: sc.festival, cast: [cast.hero].concat(cast.mates) });
    const p = TownActs.plan(block, set, cast);
    return { set, p };
  }
  function paint(ctx, m, t, still) {
    ctx.drawImage(m.set.bg, 0, 0);
    m.set.amb(ctx, t, still);
    m.p.draw(ctx, t, still);
    m.set.over(ctx, t, still);
  }
  function frame(block, t, opts) {
    const m = make(block, opts), cv = document.createElement("canvas");
    cv.width = m.set.W; cv.height = m.set.H;
    paint(cv.getContext("2d"), m, t, true);
    return cv;
  }

  // ---------- the player ----------
  function player(block, opts) {
    opts = opts || {};
    const m = make(block, opts), fig = document.createElement("figure"), cv = document.createElement("canvas");
    fig.className = "town-replay night-replay";
    cv.width = m.set.W; cv.height = m.set.H;
    cv.style.cssText = `image-rendering:pixelated;image-rendering:crisp-edges;display:block;cursor:pointer;${opts.scale ? `width:${cv.width * opts.scale}px;height:${cv.height * opts.scale}px` : "width:100%;height:auto"}`;
    cv.title = "Click to watch again";
    const cap = document.createElement("div");
    cap.className = "town-cap";
    cap.setAttribute("aria-live", "polite");
    fig.append(cv, cap);
    const g = cv.getContext("2d");
    let t = reduced() ? Math.min(m.p.dur - 0.01, (m.p.marks.after || m.p.dur * 0.7) + 0.4) : 0, raf = 0, last = 0, onscreen = false, rate = 1, held = false, forced = false, shown = -1;
    const live = () => !held && fig.isConnected && onscreen && !document.hidden;
    // the caption on screen is the last one whose beat has come; in Static scenes every caption shows at once
    function caption() {
      const caps = m.p.caps, i = reduced() && !forced ? caps.length - 1 : caps.reduce((k, c, j) => (c.t <= t ? j : k), -1);
      if (i === shown) return;
      shown = i;
      cap.textContent = "";
      if (i < 0) return;
      const list = reduced() && !forced ? caps : [caps[i]];
      for (const c of list) {
        const s = document.createElement("span");
        s.textContent = c.text;
        if (/^Why:/.test(c.text)) s.className = "town-why";
        cap.append(s, " ");
      }
      cap.classList.remove("in"); void cap.offsetWidth; cap.classList.add("in");
    }
    const draw = () => { paint(g, m, t, reduced() && !forced); caption(); };
    function tick(ms) {
      raf = 0;
      if (!live()) { last = 0; return; }
      const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
      last = ms;
      t = Math.min(m.p.dur, t + dt * rate);
      draw();
      if (t < m.p.dur) raf = root.requestAnimationFrame(tick);
    }
    const wake = () => { if ((forced || !reduced()) && !raf && live() && t < m.p.dur) { last = 0; raf = root.requestAnimationFrame(tick); } };
    const restart = () => { held = false; t = 0; shown = -1; draw(); wake(); };
    cv.addEventListener("click", () => { forced = true; restart(); });
    if ("IntersectionObserver" in root) {
      const ob = new root.IntersectionObserver((es) => {
        onscreen = es[es.length - 1].isIntersecting;
        sound(onscreen && fig.isConnected);
        if (!fig.isConnected && t > 0) { ob.disconnect(); return; }
        wake();
      });
      ob.observe(fig);
    } else onscreen = true;
    // the place's own sound while the scene is on screen: the town's tune out of doors, the room's murmur indoors
    function sound(on) {
      if (m.set.outdoor && root.TownMusic) { if (on) TownMusic.play(m.set.town); else TownMusic.stop(); return; }
      if (root.Sound && Sound.scene) Sound.scene(on ? AMBIENCE[m.set.set] || "room" : null, fig);
    }
    document.addEventListener("visibilitychange", wake);
    fig.replay = {
      get t() { return t; }, get dur() { return m.p.dur; }, get playing() { return !held && t < m.p.dur && (forced || !reduced()); },
      play() { held = false; forced = true; if (t >= m.p.dur) t = 0; wake(); },
      pause() { held = true; },
      restart() { forced = true; restart(); },
      skip() { t = m.p.dur; shown = -1; draw(); },
      rate(s) { rate = s; },
      seek(s) { t = Math.max(0, Math.min(m.p.dur, s)); shown = -1; draw(); },
    };
    draw();
    wake();
    return fig;
  }

  // ---------- the daybook strip: the act looping on its set, cropped round the hero ----------
  const live = new Set();
  let timer = 0;
  function pump() {
    timer = 0;
    const now = performance.now() / 1000;
    for (const s of live) {
      if (!s.cv.isConnected) { live.delete(s); continue; }
      if (s.on && !document.hidden) s.draw(now);
    }
    if (live.size) timer = setTimeout(pump, 100);
  }
  function strip(block, opts) {
    opts = opts || {};
    if (!block.scene || !root.TownSets || !root.TownActs) return null;
    let m;
    try { m = make(block, opts); } catch (e) { if (root.console) console.error(e); return null; }
    const w = opts.w || 200, h = opts.h || 80, cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.className = "town-strip";
    const full = document.createElement("canvas"); full.width = m.set.W; full.height = m.set.H;
    const fg = full.getContext("2d"), g = cv.getContext("2d");
    const [l0, l1] = m.p.loop, span = Math.max(1, l1 - l0);
    // frame the hero where the act happens: the act's own spot, a little above the feet
    const at = m.set.spots.act || [6, 6], [ax, ay] = m.set.st.iso(at[0], at[1]);
    const x0 = Math.max(0, Math.min(m.set.W - w, Math.round(ax - w / 2))), y0 = Math.max(0, Math.min(m.set.H - h, Math.round(ay - h * 0.7)));
    const s = { cv, on: true, t0: performance.now() / 1000 + ((opts.phase || 0) % span), draw(now) {
      const t = reduced() ? l0 + span * 0.55 : l0 + ((((now - s.t0) % span) + span) % span);
      paint(fg, m, t, reduced());
      g.drawImage(full, x0, y0, w, h, 0, 0, w, h);
    } };
    s.draw(performance.now() / 1000);
    if (!reduced()) {
      live.add(s);
      if ("IntersectionObserver" in root) { const ob = new IntersectionObserver((es) => { s.on = es[es.length - 1].isIntersecting; if (!cv.isConnected) ob.disconnect(); }); ob.observe(cv); }
      if (!timer) timer = setTimeout(pump, 100);
    }
    return cv;
  }

  root.TownDay = { player, strip, frame, make, W, H };
})(typeof window !== "undefined" ? window : globalThis);
