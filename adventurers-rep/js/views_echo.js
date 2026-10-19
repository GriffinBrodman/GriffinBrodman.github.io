/* The Daily Echo (#/echo[/<day>][?at=<hour>]): everyone's day as one film, a clock from dawn to night over a live tile of each hero's hour, and the day's big moments played in order. */
(function () {
  "use strict";
  const A = App;
  const { L, S, el, heroes } = A;
  const STEP = 0.5, DAWN = 6, NIGHT = 21.5, LAST = 22;
  const STEPS = [];
  for (let t = DAWN; t <= LAST; t += STEP) STEPS.push(t);
  const TW = 192, TH = 96;
  const calm = () => (window.Settings && Settings.calm ? Settings.calm() : !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches));
  const ART = A.TOWN_ART.concat(["hunt_art", "hunt_scenes", "delve_scenes", "delve_fx"]);
  const SKEY = "al.echo";

  const keptDays = () => [...new Set([L.meta.day, ...(L.heroes || []).flatMap((h) => h.daybook_days || [])])].sort((a, b) => a - b);

  A.route(/^\/echo(?:\/(\d+))?(?:\?(.*))?$/, (v, d, query) => {
    const days = keptDays(), day = d ? +d : L.meta.day;
    const q = new URLSearchParams(query || "");
    v.appendChild(el("p", { class: "loading" }, "Rolling the film…"));
    const who = (L.heroes || []).filter((h) => heroes[h.id] && (h.daybook_days || []).includes(day));
    return Promise.all([
      A.roadArt(ART).catch((e) => console.error(e)),
      Promise.all(who.map((h) => A.load(`daybook/${h.id}/${day}`).then((db) => [h.id, db], () => null))),
      A.load("replays").catch(() => ({ rows: [] })),
    ]).then(([, books, R]) => {
      v.innerHTML = "";
      const dbs = new Map(books.filter((x) => x && x[1] && ((x[1].blocks || []).length || x[1].evening)));
      reel(v, day, days, dbs, (R && R.rows) || [], q);
    });
  });

  // ---------- places named in a day's lines ----------
  let NAMES = null;
  function names() {
    if (NAMES) return NAMES;
    NAMES = [];
    for (const [kind, set] of [["town", S.towns], ["wild", S.wilds], ["dungeon", S.dungeons]]) for (const [id, x] of Object.entries(set || {})) NAMES.push({ kind, id, name: x.name, re: new RegExp("\\b" + x.name.replace(/^The /, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i") });
    NAMES.sort((a, b) => b.name.length - a.name.length);
    return NAMES;
  }
  function named(text, kind) {
    const out = [];
    for (const n of names()) if ((!kind || n.kind === kind) && n.re.test(text || "")) out.push(n);
    return out;
  }
  // what a hero's day says about where it was: the town of its scenes, the wild of its hunt, the dungeon below, where the road led
  function dayInfo(h, db) {
    const blocks = db.blocks || [], text = blocks.map((b) => b.line || "").join(" ");
    const scene = blocks.filter((b) => b.scene && b.scene.town);
    const room = blocks.find((b) => b.room && b.room.dungeon);
    const roadLines = blocks.filter((b) => b.stretch || b.act === "road" || b.act === "arrive").map((b) => b.line || "").join(" ");
    const end = /\bended ([^.]+)/i.exec(text), toward = end && /toward ([^.,]+)/i.exec(end[1]);
    const dest = end ? named(toward ? toward[1] : end[1], "town")[0] : named(roadLines, "town").pop();
    const town = (scene.length && scene[scene.length - 1].scene.town) || (dest && dest.id) || (named(text, "town")[0] || {}).id || (S.towns[h.loc] ? h.loc : null);
    const wild = named(text, "wild")[0], dun = room ? { id: room.room.dungeon, name: A.nodeName(room.room.dungeon) } : named(text, "dungeon")[0];
    const stretch = blocks.filter((b) => b.biome).pop();
    const biome = (stretch && stretch.biome) || (wild && S.wilds[wild.id].biome) || (town && S.towns[town] && S.towns[town].biome) || "plains";
    const weather = (stretch && stretch.weather) || (scene[0] && scene[0].scene.weather) || "clear";
    const lodge = blocks.find((b) => b.act === "wake" && b.scene);
    return { town, wild: wild && wild.id, dungeon: dun && dun.id, dest: dest && dest.id, biome, weather, lodge: lodge && lodge.scene, floor: room ? room.room.floor : 1 };
  }

  // ---------- what a hero is doing at an hour ----------
  function sorted(db) {
    return (db.blocks || []).map((b, i) => (b ? Object.assign({}, b, { i }) : null)).filter((b) => b && b.to > b.from).sort((a, b) => a.from - b.from);
  }
  function stateAt(list, db, t) {
    if (t < NIGHT || !db.evening) {
      let cur = null;
      for (const b of list) if (b.from <= t + 0.01) cur = b;
      if (!cur && list.length) cur = list[0];
      if (cur && (t < cur.to || list.indexOf(cur) < list.length - 1)) return { key: "b" + cur.i, b: cur };
    }
    const kind = (db.evening && db.evening.kind) || "room";
    return t >= NIGHT ? { key: "night", night: true, kind } : { key: "eve", eve: true, kind };
  }

  // ---------- captions ----------
  const TOWN_VERB = { errands: "running errands", wake: "waking up", breakfast: "at breakfast", work: "working a shift", rest: "taking it easy", wander: "wandering the streets",
    service: "at the temple", study: "reading", train: "drilling at the guild", brew: "brewing", forge: "at the forge", busk: "busking", pickpocket: "light fingers",
    forage: "foraging", graverob: "night work", trainer: "with a trainer", labour: "day labour", confession: "at confession", blessing: "getting a blessing",
    poorhouse: "at the poorhouse", church_work: "temple chores", infirmary: "at the infirmary", bath: "at the bathhouse", fishing: "fishing", fish_contest: "in the fishing contest",
    dice: "at the dice", bakery: "at the bakery", stall: "at a food stall", mount: "at the stables", crew: "with the crew", meet: "running into someone", spar: "sparring",
    odd_request: "on an odd job", fair: "at the fair", yeti: "with the Yeti Society", fortune: "at the fortune-teller", song: "making music", auction: "at the storm auction",
    event: "out and about", carousing: "carousing", food_feast: "at a feast", food_contest: "in a cooking contest", food_rival: "eating out", food_rush: "in the lunch rush" };
  const EVE_VERB = { sing: "singing", play: "playing", eat: "supper", talk: "a drink", cards: "cards", listen: "listening to the band", dance: "dancing", sit: "a drink", laugh: "a drink" };
  const ROAD_VERB = { depart: "setting out", road: "on the road", event: "on the road", halt: "a halt by the road", arrive: "arriving", traveller: "meeting a traveller",
    shrine: "at a roadside shrine", milestone: "passing a landmark", toll: "at the toll", ferry: "at the crossing", ford: "at the ford", crew: "on the road with the crew",
    spar: "a scrap on the road", camp: "making camp", wander: "on the road", forage: "foraging by the road" };
  const HUNT_VERB = { sign: "reading tracks", stalk: "stalking", quarry: "after the quarry", fight: "fighting the quarry", forage: "foraging", dress: "dressing the kill",
    camp: "making camp", walk: "hunting", retreat: "falling back" };
  const ROOM_VERB = { fight: "fighting", trap: "at a trap", chest: "opening a chest", cache: "digging out a cache", puzzle: "working a puzzle", obstacle: "getting past something",
    fear: "in a bad room", shrine: "at a shrine", remains: "searching remains", supplies: "finding supplies", lore: "reading old writing", camp_spot: "resting in a safe room",
    stair: "at the stair", lair: "in the lair", famous: "in the famous room", secret: "in a secret room", walk: "walking the halls", stair_down: "heading down", empty: "in a picked-clean room" };
  const NIGHT_VERB = { inn: "asleep at the inn", room: "asleep", stable: "asleep in the stables", cell: "in the cells", road: "asleep by the roadside", camp: "asleep at camp", dungeon: "camped below" };
  const townName = (id) => (id ? A.nodeName(id) : "");
  const tavernOf = (id) => (S.towns[id] && S.towns[id].tavern) || "the tavern";
  const many = (nm) => (/(s|x|ch|sh)$/.test(nm) ? nm + "es" : /[^aeiou]y$/.test(nm) ? nm.slice(0, -1) + "ies" : /(?<!e)lf$/.test(nm) ? nm.slice(0, -1) + "ves" : nm + "s");
  function foesOf(rec) {
    const fight = ((rec && rec.beats) || []).find((x) => x.foes && x.foes.length);
    if (!fight) return null;
    const n = {};
    for (const f of fight.foes) n[f] = (n[f] || 0) + 1;
    return Object.entries(n).map(([id, k]) => { const nm = ((S.monsters || {})[id] || { name: id.replace(/_/g, " ") }).name; return k > 1 ? `${k} ${many(nm)}` : `${/^[aeiou]/i.test(nm) ? "an" : "a"} ${nm}`; }).join(" and ");
  }
  function doing(h, st, info, rec) {
    if (st.night || st.eve) {
      const k = st.kind;
      if (st.eve) {
        if (k === "camp" || k === "road") return info.wild ? `by the fire in ${A.nodeName(info.wild, true)}` : "by the campfire";
        if (k === "dungeon") return `resting below in ${A.nodeName(info.dungeon, true) || "the dark"}`;
        if (k === "cell") return "in the cells";
        return info.town ? `a drink at ${tavernOf(info.town)}, ${townName(info.town)}` : "an evening in";
      }
      const v = NIGHT_VERB[k] || "asleep";
      if (k === "dungeon") return `${v} in ${A.nodeName(info.dungeon, true) || "the dark"}`;
      if ((k === "camp") && info.wild) return `${v} in ${A.nodeName(info.wild, true)}`;
      return info.town && ["inn", "room", "stable", "cell"].includes(k) ? `${v} in ${townName(info.town)}` : v;
    }
    const b = st.b;
    if (b.room) {
      const foes = rec && rec.kind === "fight" ? foesOf(rec) : null;
      const verb = foes ? `fighting ${foes}` : ROOM_VERB[(rec && rec.kind) || ""] || (b.label || "below").toLowerCase();
      return `${verb} on floor ${b.room.floor} of ${A.nodeName(b.room.dungeon, true)}`;
    }
    if (b.act === "delve") return `${(b.fights || []).length ? "fighting" : "underground"} in ${A.nodeName(info.dungeon, true) || "a dungeon"}`;
    if (b.act === "hunt") return `${b.fought ? "fighting" : HUNT_VERB[b.stretch] || "hunting"} in ${A.nodeName(info.wild, true) || "the wilds"}`;
    if (b.scene) {
      const town = b.scene.town || info.town;
      if (b.act === "evening") return `${EVE_VERB[b.scene.act] || "an evening"} at ${tavernOf(town)}, ${townName(town)}`;
      const verb = b.act === "pet" && h.pet ? `out with ${h.pet.name}` : TOWN_VERB[b.act] || (b.label || "").toLowerCase();
      return b.scene.set === "tavern" ? `${verb} at ${tavernOf(town)}, ${townName(town)}` : `${verb} in ${townName(town)}`;
    }
    if (b.stretch || b.act === "road" || b.act === "camp") {
      if (b.fought) return "fighting on the road";
      if (b.act === "inn") return `a stop at ${b.label}`;
      if (b.act === "arrive") return info.dest ? `arriving in ${townName(info.dest)}` : "arriving";
      const v = ROAD_VERB[b.act] || (b.label || "on the road").toLowerCase();
      return info.dest && b.act !== "camp" ? `${v}, bound for ${townName(info.dest)}` : v;
    }
    const verb = b.act === "pet" && h.pet ? `out with ${h.pet.name}` : TOWN_VERB[b.act] || (b.label || "busy").toLowerCase();
    return info.town ? `${verb} in ${townName(info.town)}` : verb;
  }

  // ---------- the tiles ----------
  // the road and the dungeon tiles run on one loop here (the town and hunt strips run on their own shared pumps); off screen they rest
  const loop = { tiles: new Set(), raf: 0 };
  const seen = new Map();
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => { for (const e of es) { const t = seen.get(e.target); if (t) t.on = e.isIntersecting; } wake(); }) : null;
  function wake() { if (!loop.raf && loop.tiles.size && !calm()) loop.raf = requestAnimationFrame(tick); }
  function tick(ms) {
    loop.raf = 0;
    const now = ms / 1000;
    let any = false;
    for (const t of loop.tiles) {
      if (!t.cv.isConnected) { loop.tiles.delete(t); seen.delete(t.cv); if (io) io.unobserve(t.cv); continue; }
      any = true;
      if (t.on && !document.hidden && now - t.last >= 0.1) { t.last = now; try { t.draw(now); } catch (e) { loop.tiles.delete(t); console.error(e); } }
    }
    if (any && !calm()) loop.raf = requestAnimationFrame(tick);
  }
  function looped(cv, draw, still) {
    const t = { cv, draw, last: 0, on: !io };
    if (calm()) { still(); return cv; }
    draw(performance.now() / 1000);
    loop.tiles.add(t);
    seen.set(cv, t);
    if (io) io.observe(cv);
    wake();
    return cv;
  }
  const BIOMES = ["plains", "forest", "marsh", "hills", "snow", "coast", "volcanic"];
  function roadTile(spec) {
    const cv = el("canvas", { width: TW, height: TH, "aria-hidden": "true" }), g = cv.getContext("2d"), im = g.createImageData(TW, TH);
    const K = RoadScenes.kit, biome = spec.biome === "dungeon" ? "dungeon" : BIOMES.includes(spec.biome) ? spec.biome : "plains";
    const sp = Object.assign({}, spec, { biome: spec.biome === "dungeon" ? "dungeon" : biome });
    const t0 = performance.now() / 1000 - (K.hash(JSON.stringify(spec.extra || []) + (spec.seed || "")) % 40) / 10;
    const paint = (t) => { const f = RoadScenes.frame(sp, t, TW, TH); im.data.set(K.punch ? K.punch(f.data, biome, sp.weather) : f.data); g.putImageData(im, 0, 0); };
    return looped(cv, (now) => paint(((now - t0) % 24 + 24) % 24), () => paint(3.2));
  }
  function delveTile(rec) {
    const D = window.DelveScenes;
    const cv = el("canvas", { width: D.W, height: D.H, "aria-hidden": "true" });
    const len = D.length(rec), t0 = performance.now() / 1000;
    return looped(cv, (now) => { const a = now - t0, t = a % (len + 2.5); D.frame(rec, Math.min(t, len), cv, a); }, () => D.frame(rec, len * 0.6, cv, len * 0.6));
  }
  // a room nobody wrote up (a plain day below, a night in camp underground): the dungeon's own room kit with the crew in it
  function looseRoom(info, kind, crew) {
    const sd = S.dungeons[info.dungeon] || {};
    return { floor: info.floor || 1, n: 0, kind, name: kind === "camp_spot" ? "a quiet corner" : "a passage", story: "", beats: [], theme: sd.theme || "cave", pace: "steady", crew, did: info.dungeon };
  }
  const roomCache = new Map();
  function roomRec(b, day, crew) {
    const r = b.room, key = `${r.dungeon}/${day}/${r.floor}/${r.room}`;
    if (!roomCache.has(key)) roomCache.set(key, A.load(`dungeon/${r.dungeon}`).then((D) => {
      for (const d of D.days || []) {
        if (d.day !== day) continue;
        const rm = (d.rooms || []).find((x) => x.floor === r.floor && x.n === r.room);
        if (!rm) continue;
        const sd = S.dungeons[D.id] || {};
        return Object.assign({}, rm, { theme: D.theme, pace: d.pace, crew: (d.heroes || []).map((x) => heroes[x]).filter(Boolean), did: D.id, boss: { mon: sd.boss, name: D.boss && D.boss.name } });
      }
      return null;
    }).catch(() => null));
    return roomCache.get(key).then((rec) => rec || Object.assign(looseRoom({ dungeon: r.dungeon, floor: r.floor }, "empty", crew), { name: b.label || "a room" }));
  }
  // a town hour the day kept no scene for still plays on its town's own set, as the nearest act the sets know
  const STAGE_OF = { errands: ["market", "haggle"], work: ["street", "carry"], labour: ["yard", "carry"], rest: ["green", "sit"], wander: ["street", "walk"],
    service: ["temple", "pray"], confession: ["temple", "pray"], blessing: ["temple", "pray"], church_work: ["temple", "sweep"], study: ["guild", "read"],
    train: ["yard", "drill"], trainer: ["yard", "drill"], spar: ["yard", "spar"], forge: ["smithy", "hammer"], busk: ["square", "sing"], song: ["square", "sing"],
    pet: ["green", "pet"], mount: ["stables", "brush"], crew: ["tavern", "talk"], meet: ["street", "talk"], odd_request: ["street", "carry"], fair: ["square", "look"],
    fortune: ["tent", "listen"], event: ["square", "look"], carousing: ["tavern", "laugh"], dice: ["tavern", "cards"], bakery: ["market", "eat"], stall: ["market", "eat"],
    food_feast: ["tavern", "eat"], food_contest: ["market", "eat"], food_rival: ["market", "eat"], food_rush: ["market", "eat"], bath: ["bath", "wash"],
    poorhouse: ["poorhouse", "ladle"], infirmary: ["infirmary", "bandage"], fishing: ["docks", "fish"], fish_contest: ["docks", "fish"], pickpocket: ["market", "look"],
    brew: ["tavern", "ladle"], graverob: ["street", "carry"], forage: ["green", "look"], wake: ["room", "wake"], breakfast: ["tavern", "eat"] };
  function townScene(act, set, info, hour, line) {
    const sets = (window.TownSets && TownSets.SETS) || [];
    if (!info.town || !sets.includes(set)) return null;
    return { act, from: hour, to: hour + 1, line: line || "", scene: { set, act: STAGE_OF[act] ? STAGE_OF[act][1] : act, town: info.town, weather: info.weather, hour, who: "npc" } };
  }
  function townTile(b, h, phase) {
    if (!window.TownDay) return null;
    try { return TownDay.strip(b, { hero: h, heroes: A.heroes, w: TW, h: TH, phase }); } catch (e) { console.error(e); return null; }
  }
  function band(h) {
    const p = h.party && A.parties[h.party];
    return [h, ...((p && p.members) || []).filter((id) => id !== h.id).map((id) => heroes[id]).filter(Boolean)];
  }
  function iconTile(act, t) {
    const box = el("div", { class: "echo-icon", style: { background: skyAt(t) } });
    if (window.Daybook) box.appendChild(Daybook.icon(act, 4));
    return box;
  }
  // the picture for a hero's hour: the same strips the hero page's hour by hour plays, or the nearest the art has
  function picture(h, st, info, day, t, rec) {
    const crew = band(h);
    const road = (extra) => roadTile(Object.assign({ biome: info.biome, hour: t, weather: info.weather, heroes: crew }, extra));
    if (st.night || st.eve) {
      const k = st.kind;
      if (k === "dungeon") return delveTile(looseRoom(info, "camp_spot", crew));
      if (k === "camp" || k === "road") return road({ hour: st.night ? 22.5 : Math.min(t, 21), extra: [["camp", 0.5]], band_x: 0.5, band_still: true, seed: `camp:${h.id}` });
      const tb = st.night ? townScene("sleep", "room", info, 22.5) : townScene("evening", "tavern", info, Math.min(t, 21));
      if (tb) {
        tb.scene.act = st.night ? "sleep" : "talk";
        if (st.night) tb.scene.lodge = { room: "private", inn: "common", stable: "stables", cell: "cell" }[k] || (info.lodge && info.lodge.lodge) || "private";
        return townTile(tb, h, 0.3);
      }
      return iconTile(st.night ? "camp" : "evening", t);
    }
    const b = st.b;
    if (b.scene) return townTile(b, h, b.i * 0.7) || iconTile(b.act, t);
    if (b.act === "hunt" && b.stretch && window.HuntScenes) {
      try { return HuntScenes.strip(b, { hero: h, band: crew, w: TW, h: TH }); } catch (e) { console.error(e); }
    }
    if (b.room && window.DelveScenes) return rec ? delveTile(rec) : null;
    if (b.act === "delve" && window.DelveScenes) return delveTile(looseRoom(info, (b.fights || []).length ? "fight" : "walk", crew));
    if (b.stretch && window.RoadScenes) {
      const dressed = RoadScenes.dress ? RoadScenes.dress(Object.assign({}, b, { seed: day })) : {};
      return roadTile(Object.assign({ biome: b.biome, hour: (b.from + b.to) / 2, weather: b.weather, place_kind: b.place_kind, heroes: crew }, dressed));
    }
    if (["road", "hunt", "camp", "wander"].includes(b.act) && window.RoadScenes) {
      const biome = b.act === "hunt" && info.wild ? S.wilds[info.wild].biome : info.biome;
      return road({ biome, hour: (b.from + b.to) / 2, seed: `${h.id}:${b.i}`, extra: b.act === "camp" ? [["camp", 0.5]] : [], band_x: 0.45, band_speed: b.act === "hunt" ? 2 : 4 });
    }
    const stage = STAGE_OF[b.act];
    const tb = stage && townScene(b.act, stage[0], info, (b.from + b.to) / 2, b.line);
    return (tb && townTile(tb, h, b.i * 0.7)) || iconTile(b.act, t);
  }

  // ---------- where a tap goes ----------
  function hrefOf(h, st, db, day) {
    const kept = (route, id) => id && A.kept(route, id);
    if (st.b) {
      const b = st.b;
      const own = b.ref && A.storyHref(b.ref);
      if (own) return own[0];
      const fight = (b.fights || []).concat(b.room && b.room.fight ? [b.room.fight] : []).find((id) => kept("fight", id));
      if (fight) return `#/fight/${fight}`;
      if (b.rec && kept("road", b.rec)) return `#/road/${b.rec}`;
      if (b.scene || (b.act === "hunt" && b.stretch)) return `#/day/${h.id}/${day}/${b.i}`;
      if (b.room) return `#/dungeon/${b.room.dungeon}/${b.room.floor}/${b.room.room}`;
    } else if (db.evening) {
      const ev = db.evening;
      for (const x of [ev, ...(ev.more || [])]) if (x.game && kept(x.route || "table", x.game)) return `#/${x.route || "table"}/${x.game}`;
    }
    return A.heroDayHref(h.id, day);
  }

  // ---------- the day's big moments, in the order they happened ----------
  const DEFAULT_HOUR = { fight: 12, road: 12, catch: 10, meal: 19, reading: 20, night: 21, table: 21 };
  const ROUTE_OF = { fight: "fight", night: "night", meal: "meal", reading: "reading", catch: "catch", table: "table", game: "table", road: "road" };
  function moments(dbs, rows, day) {
    const byHref = new Map();
    const add = (href, hour, hid, row) => {
      if (!href || !/^#\/(fight|night|meal|catch|road|reading|table)\//.test(href)) return;
      const m = byHref.get(href);
      if (m) { m.hour = Math.min(m.hour, hour); if (hid && !m.who.includes(hid)) m.who.push(hid); return; }
      byHref.set(href, { href, hour, who: hid ? [hid] : [], row });
    };
    for (const [hid, db] of dbs) {
      for (const b of sorted(db)) {
        const own = b.ref && A.storyHref(b.ref);
        if (own) add(own[0], b.from, hid);
        for (const id of (b.fights || []).concat(b.room && b.room.fight ? [b.room.fight] : [])) if (A.kept("fight", id)) add(`#/fight/${id}`, b.from, hid);
        if (b.rec && A.kept("road", b.rec)) add(`#/road/${b.rec}`, b.from, hid);
      }
      const ev = db.evening;
      if (ev) [ev, ...(ev.more || [])].forEach((x, k) => { if (x.game && A.kept(x.route || "table", x.game)) add(`#/${x.route || "table"}/${x.game}`, 21 + k * 0.01, hid); });
    }
    for (const r of rows) {
      if (r.d !== day) continue;
      const href = `#/${ROUTE_OF[r.k] || r.k}/${r.id}`;
      add(href, DEFAULT_HOUR[r.k] || 12, null, r);
      const m = byHref.get(href);
      if (m) { m.row = r; for (const x of r.h || []) if (heroes[x] && !m.who.includes(x)) m.who.push(x); }
    }
    const KIND = { fight: "Fight", night: "Night", meal: "Meal", catch: "Catch", road: "Road", reading: "Reading", table: "Table" };
    return [...byHref.values()].map((m) => {
      const k = m.href.split("/")[1];
      return Object.assign(m, { kind: k, label: KIND[k] || "Replay", title: (m.row && m.row.t) || KIND[k] || "A moment" });
    }).sort((a, b) => a.hour - b.hour || a.href.localeCompare(b.href));
  }

  // ---------- the sky ----------
  const SKY = [[5, "#d9a48c"], [6, "#e8b898"], [7, "#efcca4"], [8, "#ead9b4"], [9, "#d6e0cc"], [10, "#c8dcd8"], [11, "#c2d9dc"], [14, "#c2d9dc"],
    [15, "#cfdccc"], [16, "#e6d6a8"], [17, "#ecbe88"], [18, "#d8946c"], [19, "#8a7a8c"], [20, "#4a5470"], [21, "#2f3a58"], [24, "#2a3450"]];
  function skyAt(t) { let c = SKY[0][1]; for (const [k, v] of SKY) if (t >= k) c = v; return c; }
  const clock = (t) => (t >= LAST ? "night" : window.Daybook ? Daybook.clock(t) : `${t}`);
  const phase = (t) => (t >= LAST ? "lights out" : t < 7 ? "Dawn" : t < 12 ? "Morning" : t < 12.5 ? "Noon" : t < 17 ? "Afternoon" : t < 18.5 ? "Dusk" : t < NIGHT ? "Evening" : "Late evening");

  // ---------- the session that carries a viewer from a tile or the in-order film to a replay and back ----------
  function sess() { try { return JSON.parse(sessionStorage.getItem(SKEY) || "null"); } catch (e) { return null; } }
  function setSess(s) { try { if (s) sessionStorage.setItem(SKEY, JSON.stringify(s)); else sessionStorage.removeItem(SKEY); } catch (e) { /* storage unavailable */ } MEM = s; }
  let MEM = null;
  const session = () => sess() || MEM;
  const target = (s) => (s ? (s.list ? (s.list[s.i] || {}).href : s.href) : null);
  const backHref = (s, at) => `#/echo/${s.day}?at=${at != null ? at : s.at}`;
  function playOrder(day, list, i) {
    if (!list.length) return;
    const s = { day, at: snap(list[i].hour), list: list.map((m) => ({ href: m.href, hour: m.hour, title: m.title, label: m.label, who: m.who.slice(0, 4) })), i, held: false };
    setSess(s);
    location.hash = s.list[i].href;
  }
  const snap = (h) => Math.max(DAWN, Math.min(LAST, Math.floor(h / STEP) * STEP));

  function echoBar(s) {
    const cur = s.list ? s.list[s.i] : null;
    if (!cur) return el("div", { class: "echo-bar", role: "navigation", "aria-label": "Back to The Daily Echo" },
      el("a", { class: "echo-bar-back", href: backHref(s), onclick: () => setSess(null) }, `‹ Back to The Daily Echo at ${clock(s.at)}`));
    const go = (i) => { const n = Object.assign({}, s, { i, held: false, at: snap(s.list[i].hour) }); setSess(n); location.hash = n.list[i].href; };
    const who = cur.who.filter((id) => heroes[id]).map((id) => heroes[id].name);
    const auto = el("button", { type: "button", class: "btn small", title: "Move on by itself when a replay ends", onclick: () => { const n = Object.assign({}, session(), { held: !session().held }); setSess(n); auto.textContent = n.held ? "▶ Auto" : "❚❚ Auto"; } }, s.held ? "▶ Auto" : "❚❚ Auto");
    return el("div", { class: "echo-bar in-order", role: "navigation", "aria-label": "The day in order" },
      el("a", { class: "echo-bar-back", href: backHref(s, snap(cur.hour)), onclick: () => setSess(null) }, "‹ The Daily Echo"),
      el("span", { class: "echo-bar-now" }, el("b", null, `${s.i + 1}/${s.list.length}`), ` · ${clock(cur.hour)} · ${cur.label}: ${cur.title}`, who.length ? el("span", { class: "dim" }, ` · ${who.join(", ")}`) : null),
      el("span", { class: "echo-bar-btns" },
        s.i > 0 ? el("button", { type: "button", class: "btn small", onclick: () => go(s.i - 1) }, "‹ Prev") : null,
        auto,
        s.i < s.list.length - 1 ? el("button", { type: "button", class: "btn small primary", onclick: () => go(s.i + 1) }, "Next ›")
          : el("a", { class: "btn small primary", href: backHref(s, LAST), onclick: () => setSess(null) }, "Done ›")));
  }
  // the bar rides at the top of the replay the session points at; the auto-advance follows the replay's own bar (Play once it has ended)
  const view = document.getElementById("view");
  let ended = 0, waited = 0, lastHref = null;
  function mountBar() {
    const s = session(), here = location.hash;
    let bar = view.querySelector(":scope > .echo-bar");
    if (!s || here !== target(s)) { if (bar) bar.remove(); return; }
    if (!bar || bar.dataset.for !== here + (s.i || 0)) { if (bar) bar.remove(); bar = echoBar(s); bar.dataset.for = here + (s.i || 0); }
    if (view.firstChild !== bar) view.prepend(bar);
  }
  if (view && "MutationObserver" in window) new MutationObserver(mountBar).observe(view, { childList: true });
  window.addEventListener("hashchange", () => {
    const s = session(), here = location.hash;
    if (s && here !== target(s) && !/^#\/echo/.test(here)) setSess(null);
    if (here !== lastHref) { lastHref = here; ended = 0; waited = 0; }
  });
  setInterval(() => {
    const s = session();
    if (!s || !s.list || location.hash !== target(s)) return;
    if (s.held) { ended = 0; return; }
    const bar = view.querySelector(".replay-bar");
    waited += 0.4;
    if (!bar) { if (waited > 10) next(); return; }
    if (!bar.dataset.echo) { bar.dataset.echo = "1"; bar.addEventListener("click", () => { const n = Object.assign({}, session(), { held: true }); setSess(n); const b = view.querySelector(".echo-bar"); if (b) { b.remove(); mountBar(); } }); }
    const lbl = bar.querySelector("button .lbl");
    ended = lbl && lbl.textContent === "Play" ? ended + 0.4 : 0;
    if (ended >= 1.6 || waited > 180) next();
    function next() {
      ended = 0; waited = 0;
      if (s.i < s.list.length - 1) { const n = Object.assign({}, s, { i: s.i + 1, at: snap(s.list[s.i + 1].hour) }); setSess(n); location.hash = n.list[n.i].href; }
      else { setSess(null); location.hash = backHref(s, LAST); }
    }
  }, 400);

  // ---------- the reel ----------
  function reel(v, day, days, dbs, rows, q) {
    const [season, sd] = A.seasonOf(day);
    const i = days.indexOf(day), prev = days[i - 1], next = days[i + 1];
    const nav = el("div", { class: "echo-days" },
      prev != null ? el("a", { class: "btn small", href: `#/echo/${prev}` }, `‹ Day ${A.seasonOf(prev)[1]}`) : el("span"),
      el("span", { class: "echo-day" }, `Season ${season} · Day ${sd}`),
      next != null ? el("a", { class: "btn small", href: `#/echo/${next}` }, next === L.meta.day ? "Today ›" : `Day ${A.seasonOf(next)[1]} ›`) : el("span"));
    const list = moments(dbs, rows, day);
    const head = el("section", { class: "panel parch echo-head" },
      el("div", { class: "echo-mast" }, el("h1", null, "The Daily Echo"),
        el("p", { class: "small muted" }, day === L.meta.day ? "Today, everyone at once: " : "That day, everyone at once: ", "where each hero was and what they were up to, hour by hour, from dawn to the last candle. Tap a picture to watch that hour.")),
      nav,
      list.length ? el("div", { class: "echo-order" }, el("button", { type: "button", class: "btn primary", onclick: () => playOrder(day, list, 0) }, `▶ Watch in order`),
        el("span", { class: "small muted" }, ` ${A.plural(list.length, "big moment")}, one after another, full size`)) : null);
    v.appendChild(head);
    if (!dbs.size) {
      v.appendChild(el("section", { class: "panel" }, el("p", { class: "empty" }, "Nobody's hours were kept for that day.")));
      return;
    }

    // who: crews first (a crew with a pinned hero before the rest), each crew's pinned heroes first, then the heroes on their own
    const mine = A.mine(), pin = (id) => (mine.includes(id) ? 0 : 1);
    const ids = [...dbs.keys()].filter((id) => heroes[id]);
    const groups = new Map();
    for (const id of ids) {
      const p = heroes[id].party && A.parties[heroes[id].party] ? heroes[id].party : null;
      const k = p || "_solo";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(id);
    }
    const order = [...groups.entries()].map(([k, xs]) => [k, xs.sort((a, b) => pin(a) - pin(b) || heroes[a].name.localeCompare(heroes[b].name))])
      .sort((a, b) => (a[0] === "_solo") - (b[0] === "_solo") || Math.min(...a[1].map(pin)) - Math.min(...b[1].map(pin)) || String((A.parties[a[0]] || {}).name).localeCompare(String((A.parties[b[0]] || {}).name)));

    // the clock, sticky over the grid
    let si = Math.max(0, STEPS.indexOf(snap(q.get("at") != null ? +q.get("at") : DAWN)));
    let speed = 1, playing = q.get("at") == null && !calm(), timer = 0;
    const timeEl = el("b", { class: "echo-time" }), phaseEl = el("span", { class: "echo-phase" });
    const sun = el("span", { class: "echo-sun", "aria-hidden": "true" });
    const range = el("input", { type: "range", min: 0, max: STEPS.length - 1, step: 1, value: si, class: "echo-range", "aria-label": "The hour" });
    const skyBand = el("div", { class: "echo-sky", "aria-hidden": "true", style: { backgroundImage: `linear-gradient(90deg, ${STEPS.map((t, k) => `${skyAt(t)} ${(k / (STEPS.length - 1)) * 100}%`).join(", ")})` } }, sun);
    const ticks = el("div", { class: "echo-ticks", "aria-hidden": "true" }, [6, 9, 12, 15, 18, 21].map((t) => el("span", { class: t % 6 ? "minor" : null, style: { left: `${((t - DAWN) / (LAST - DAWN)) * 100}%` } }, t === 6 ? "dawn" : t === 12 ? "noon" : t === 18 ? "dusk" : clock(t))),
      el("span", { style: { left: "100%" } }, "night"));
    const playBtn = el("button", { type: "button", class: "btn small echo-play", "aria-label": "Play or pause" });
    const spd = [1, 2].map((s) => el("button", { type: "button", class: "btn small spd" + (s === 1 ? " on" : ""), onclick: () => { speed = s; spd.forEach((b, k) => b.classList.toggle("on", k + 1 === s)); if (playing) run(); } }, `${s}×`));
    const clockBar = el("div", { class: "echo-clock" },
      el("div", { class: "echo-when" }, playBtn, el("div", { class: "echo-tlabel" }, timeEl, phaseEl), el("span", { class: "echo-spds", role: "group", "aria-label": "Speed" }, spd)),
      el("div", { class: "echo-scrub" }, skyBand, range, ticks));
    v.appendChild(clockBar);

    const grid = el("div", { class: "echo-groups" });
    v.appendChild(grid);
    const tiles = [];
    for (const [k, xs] of order) {
      const p = k !== "_solo" ? A.parties[k] : null;
      const gh = el("div", { class: "echo-ghead" }, p ? A.bannerSprite(p.banner, 2) : null, p ? A.partyLink(k) : el("span", null, groups.size > 1 ? "On their own" : "Everyone"));
      const g = el("div", { class: "echo-grid" });
      g.style.setProperty("--n", String(Math.min(5, xs.length)));
      const gi = tiles.length;
      for (const id of xs) {
        const h = heroes[id], db = dbs.get(id), t = { h, db, list: sorted(db), info: dayInfo(h, db), key: null, rec: null, group: gi, cols: Math.min(5, xs.length) };
        t.pic = el("div", { class: "echo-pic" });
        t.what = el("span", { class: "echo-what" });
        t.line = el("div", { class: "echo-line" });
        t.when = el("span", { class: "echo-span" });
        t.face = A.heroPortrait(h, 1, { cls: "echo-face" });
        t.faces = el("span", { class: "echo-faces" }, t.face);
        t.nameEl = el("b", null, h.name);
        t.a = el("a", { class: "echo-tile" + (mine.includes(id) ? " mine" : ""), href: "#/hero/" + id, onclick: () => setSess({ day, at: STEPS[si], href: t.a.getAttribute("href") }) },
          t.pic, el("div", { class: "echo-cap" }, t.faces, el("div", { class: "echo-captxt" }, t.nameEl, " · ", t.what)), t.when, t.line);
        g.appendChild(t.a);
        tiles.push(t);
      }
      grid.appendChild(el("section", { class: "echo-group" }, gh, g));
    }

    if (list.length) {
      v.appendChild(el("section", { class: "panel echo-list" }, el("h2", null, "The day's big moments"),
        el("ol", null, list.map((m, k) => el("li", null, el("span", { class: "echo-lt" }, clock(m.hour)), el("span", { class: `rp-kind k-${m.kind}` }, m.label),
          el("a", { href: m.href, onclick: (e) => { e.preventDefault(); playOrder(day, list, k); } }, m.title),
          m.who.length ? el("span", { class: "small dim" }, " · ", m.who.filter((x) => heroes[x]).slice(0, 4).map((x, j) => [j ? ", " : "", heroes[x].name])) : null)))));
    }

    // a tile's picture is rebuilt only when that hero's hour changes, a few per frame so a busy hour doesn't stall the clock
    const queue = [];
    let pumping = false;
    function pump() {
      pumping = false;
      const t0 = performance.now();
      while (queue.length && performance.now() - t0 < 24) build(queue.shift());
      if (queue.length) { pumping = true; requestAnimationFrame(pump); }
    }
    function build(job) {
      const { t, st, time } = job;
      if (t.key !== st.key) return;
      let pic = null;
      try { pic = picture(t.h, st, t.info, day, time, t.rec); } catch (e) { console.error(e); }
      if (!pic) pic = iconTile(st.b ? st.b.act : "camp", time);
      pic.classList.add("echo-img");
      t.pic.replaceChildren(pic);
    }
    function show() {
      const time = STEPS[si];
      timeEl.textContent = clock(time);
      phaseEl.textContent = phase(time).toLowerCase() === clock(time) ? "" : phase(time);
      range.value = si;
      sun.style.left = `${(si / (STEPS.length - 1)) * 100}%`;
      sun.classList.toggle("moon", time >= 19);
      clockBar.style.setProperty("--sky", skyAt(time));
      clockBar.classList.toggle("dark", time >= 19.5);
      for (const t of tiles) {
        const st = stateAt(t.list, t.db, time);
        if (st.key === t.key) continue;
        t.key = st.key;
        t.st = st;
        t.rec = null;
        const words = st.b ? st.b.line || st.b.label : st.night ? (t.db.evening && t.db.evening.line) || "" : "";
        t.line.textContent = words || "";
        t.when.textContent = st.b ? `${clock(st.b.from)}–${clock(st.b.to)}` : st.night ? "night" : "evening";
        t.what.textContent = doing(t.h, st, t.info, null);
        t.a.setAttribute("href", hrefOf(t.h, st, t.db, day));
        t.a.classList.toggle("has-replay", /^#\/(fight|night|meal|catch|road|reading|table|day)\//.test(t.a.getAttribute("href")));
        t.a.title = `${t.h.name}, ${clock(st.b ? st.b.from : time)}: ${t.what.textContent}`;
        t.sig = [t.when.textContent, t.what.textContent].join("|");
        if (st.b && st.b.room && window.DelveScenes) {
          roomRec(st.b, day, band(t.h)).then((rec) => {
            if (t.key !== st.key) return;
            t.rec = rec;
            t.what.textContent = doing(t.h, st, t.info, rec);
            queue.push({ t, st, time });
            if (!pumping) { pumping = true; requestAnimationFrame(pump); }
          });
          continue;
        }
        queue.push({ t, st, time });
      }
      merge();
      if (queue.length && !pumping) { pumping = true; requestAnimationFrame(pump); }
      try { history.replaceState(null, "", `#/echo/${day}?at=${time}`); } catch (e) { /* file:// may refuse */ }
    }
    // crewmates doing the same thing this hour share one wide tile, and part again when they go separate ways
    function merge() {
      const same = new Map();
      for (const t of tiles) {
        const k = t.group + "#" + t.sig;
        if (!same.has(k)) same.set(k, []);
        same.get(k).push(t);
      }
      for (const xs of same.values()) {
        const [lead, ...rest] = xs;
        for (const t of rest) t.a.hidden = true;
        lead.a.hidden = false;
        lead.a.classList.toggle("wide", xs.length > 1);
        lead.a.style.gridColumn = xs.length > 1 ? `span ${Math.min(xs.length, lead.cols)}` : "";
        lead.faces.replaceChildren(...xs.map((t) => t.face));
        const nm = xs.map((t) => t.h.name);
        lead.nameEl.textContent = nm.length > 1 ? `${nm.slice(0, -1).join(", ")} and ${nm[nm.length - 1]}` : nm[0];
        lead.a.classList.toggle("mine", xs.some((t) => mine.includes(t.h.id)));
      }
    }
    function sync() {
      playBtn.textContent = playing ? "❚❚" : si >= STEPS.length - 1 ? "↺" : "▶";
      playBtn.title = playing ? "Pause the clock" : "Play the day";
    }
    function run() {
      clearInterval(timer);
      if (!playing) { sync(); return; }
      timer = setInterval(() => {
        if (!clockBar.isConnected) { clearInterval(timer); return; }
        if (si >= STEPS.length - 1) { playing = false; run(); return; }
        si += 1;
        show();
      }, 2000 / speed);
      sync();
    }
    playBtn.addEventListener("click", () => {
      if (!playing && si >= STEPS.length - 1) { si = 0; show(); }
      playing = !playing;
      run();
    });
    range.addEventListener("input", () => { si = +range.value; show(); });
    range.addEventListener("pointerdown", () => { if (playing) { playing = false; run(); } });
    show();
    run();
  }
})();
