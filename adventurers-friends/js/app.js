/* Core: data access, helpers, sprites, routing. */
(function () {
  "use strict";
  const LD = window.LD || {};
  const L = LD.league;
  const S = LD.static;
  const heroes = {};
  const parties = {};
  const events = {};
  if (L) {
    // owners sign up in whatever case they type; a name typed all in lower case is shown capitalised ("cade" -> "Cade")
    for (const h of L.heroes) {
      if (h.owner && h.owner === h.owner.toLowerCase()) h.owner = h.owner.replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
      heroes[h.id] = h;
    }
    for (const p of L.parties) parties[p.id] = p;
    for (const e of L.events) events[e.id] = e;
  }

  // ---------- DOM helpers ----------
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      n.appendChild(typeof k === "string" || typeof k === "number" ? document.createTextNode(String(k)) : k);
    }
    return n;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
  const IRREGULAR = { hero: "heroes", party: "parties" };
  function plural(n, w, p) { return `${n} ${n === 1 ? w : p || IRREGULAR[w] || w + "s"}`; }
  function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
  // as league/content/world_map.py floor_words: n counts from 1, and the last of several floors reads "the bottom floor" (of two) or "the deepest floor"
  const FLOOR_ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
  function floorOrd(n) { return FLOOR_ORD[n - 1] || `${n}th`; }
  function floorWords(n, did, capital, deep = true) {
    const t = ((S.dungeons || {})[did] || {}).floors || 0;
    return `${capital ? "The" : "the"} ${deep && t > 1 && n >= t ? (t === 2 ? "bottom" : "deepest") : floorOrd(n)} floor`;
  }
  // a crew's own exported possessive when there is one (party.poss), else as league/heroes.py poss: "The Mossy Cats'", "Brix's"
  function poss(s, pid) {
    const p = pid && parties[pid];
    if (p && p.poss) return p.poss;
    s = String(s || "");
    return s + (/s$/.test(s) && !/ss$/.test(s) ? "'" : "'s");
  }

  // ---------- sprites ----------
  const animated = new Set();
  let frame = 0, idleTimer = 0;
  function idle() {
    frame ^= 1;
    for (const a of animated) {
      if (!a.canvas.isConnected) { animated.delete(a); continue; }
      a.draw(frame);
    }
  }
  // static scenes (and reduced motion) stop the idle beat outright, not just its drawing
  function idling() {
    const on = !(window.Settings && Settings.calm());
    if (on && !idleTimer) idleTimer = setInterval(idle, 650);
    else if (!on && idleTimer) { clearInterval(idleTimer); idleTimer = 0; }
  }
  idling();
  if (window.Settings) Settings.watch(idling);
  function heroLook(h) { return S.classes[h.cls] || S.classes.warrior; }
  // a legendary figure (L.legends[].art, from league/export.py legend_art) as a hero-like figure for any scene: { h, cls, lines }
  function legendFigure(name) {
    const art = ((L.legends || []).find((x) => x.name === name) || {}).art;
    if (!art) return null;
    const k = art.kit;
    return { h: { id: "legend:" + name, name, look: art.look, kit: k, weapon: k.weapon.family, weapon_tier: k.weapon.tier, armor_tier: k.armor.tier, legend: true, alive: true },
      cls: { name: "legend", look: { outfit: k.armor.outfit, head: "none", aura: null, offhand: "none" } }, lines: art.lines || [] };
  }
  function spriteCanvas(gridFn, scale, cls, animate) {
    const g0 = gridFn(0);
    const cv = el("canvas", { width: g0.w * scale, height: g0.h * scale, class: cls || "" });
    const ctx = cv.getContext("2d");
    const draw = (f) => {
      const g = gridFn(f);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(g.toCanvas(scale), 0, 0);
    };
    draw(0);
    if (animate) animated.add({ canvas: cv, draw });
    return cv;
  }
  function heroSprite(h, scale, opts) {
    opts = opts || {};
    const cv = spriteCanvas((f) => Art.heroGrid(h, f, heroLook(h)), scale || 2, opts.cls, opts.animate !== false && h.alive !== false);
    if (h.alive === false && !opts.noGray) cv.style.filter = "grayscale(0.85) brightness(0.8)";
    cv.title = h.name;
    return cv;
  }
  function heroPortrait(h, scale, opts) {
    opts = opts || {};
    const cv = Paint.portraitGrid(h, heroLook(h)).toCanvas(scale || 2);
    cv.className = "portrait-px " + (opts.cls || "");
    if (h.alive === false && !opts.noGray) cv.style.filter = "grayscale(0.85) brightness(0.75)";
    cv.title = h.name;
    return cv;
  }
  function monsterSprite(mid, scale, animate) {
    const m = S.monsters[mid];
    return spriteCanvas((f) => Art.monsterGrid(m, f), scale || 2, "", animate);
  }
  function petSprite(pet, scale) { return spriteCanvas((f) => Art.petGrid(pet, f), scale || 3, "pet", true); }
  // from scale 3 up the detailed 24x30 banner is drawn at two thirds the scale, so the footprint matches the 16x20 one;
  // at scale 1 the 16x20 banner's emblem is too small to read, so the 24x30 one stands in at its own size
  function bannerSprite(b, scale, cls) {
    scale = scale || 3;
    const cv = scale === 2 ? Art.bannerGrid(b).toCanvas(2) : Art.bannerGrid(b, true).toCanvas(Math.max(1, Math.round(scale * 2 / 3)));
    cv.className = "banner-px" + (cls ? " " + cls : "");
    return cv;
  }
  function itemSprite(id, scale) { return Art.itemGrid(id).toCanvas(scale || 2); }

  // ---------- names & links ----------
  // the site's one money formatter (league/town.py money is the sim's): wealth in silver, small sums in copper, gold only as flavour
  function money(copper, gold) {
    copper = Math.round(Math.abs(copper || 0));
    const s = Math.floor(copper / 10), c = copper % 10;
    if (!s) return `${c} copper`;
    if (gold && copper >= 1000 && copper % 100 === 0) return `${copper / 100} gold piece${copper > 100 ? "s" : ""}`;
    if (c && s < 10) return `${s} silver ${c} copper`;
    return `${s.toLocaleString("en-US")} silver`;
  }
  // money that changes hands (a table's winnings or losses, a reward): gold pieces from 100 silver up, the rest as money(); town.py gold_words
  function coins(copper) {
    copper = Math.round(Math.abs(copper || 0));
    const g = Math.floor(copper / 100), rest = copper % 100;
    if (copper < 1000 || !g) return money(copper);
    return `${g.toLocaleString("en-US")} gold piece${g > 1 ? "s" : ""}` + (rest ? ` and ${money(rest)}` : "");
  }
  // a sitting at a town table, a night's game, a reading or a meal, as the day box and the calendar show it: "Lost 3 silver at Liar's Dice ▶ watch"
  function tableLink(x) {
    if (!x || !x.table) return null;
    const route = x.route || "table";
    return el("span", { class: "table-line" }, x.table, kept(route, x.game) ? [" ", el("a", { class: "watch", href: `#/${route}/${x.game}` }, "▶ watch")] : null);
  }

  function heroLink(id, opts) {
    const h = heroes[id];
    if (!h) return el("span", null, "someone");
    return el("a", { href: `#/hero/${id}`, class: opts && opts.cls }, h.name);
  }
  // a hero's page opened on one day's hour by hour, while that day is kept in their daybook
  function heroDayHref(id, day) {
    const h = heroes[id];
    return h && day && (day === L.meta.day || (h.daybook_days || []).includes(day)) ? `#/hero/${id}/diary/${day}` : `#/hero/${id}`;
  }
  function partyLink(id) {
    const p = parties[id];
    return p ? el("a", { href: `#/party/${id}` }, p.name) : el("span", null, "a party");
  }
  // ---------- links to what a story line tells ----------
  // an event, diary line or snippet carries the ids of the records it is about (league/export.py LINKS); the link shows only while that record is kept
  const ROUTES = [["fight", "fight"], ["in_fight", "fight"], ["night", "night"], ["meal", "meal"], ["reading", "reading"], ["game", "table"], ["catch", "catch"], ["road_rec", "road"]];
  function kept(route, id) {
    const ids = { fight: fightIds, night: nightIds, meal: mealIds, reading: readingIds, table: gameIds, catch: catchIds, road: roadIds }[route];
    return !!id && !!ids && ids.has(id);
  }
  function storyHref(x) {
    if (!x) return null;
    for (const [k, route] of ROUTES) if (x[k] && kept(route, x[k])) return [`#/${route}/${x[k]}`, k === "night" && (x.music || x.anthem) ? "♪ listen" : "▶ watch"];
    if (x.song && songIds.has(x.song)) return [`#/songs/${x.song}`, "♪ hear it"];
    const by = x.hero_song && heroSongBy[x.hero_song];
    if (by && heroes[by]) return [`#/hero/${by}/character`, "♪ hear it"];
    return null;
  }
  function storyLink(x) {
    const h = storyHref(x);
    return h ? el("a", { class: "watch", href: h[0] }, h[1]) : null;
  }

  function nodeName(id, mid) {
    if (!id) return "";
    const n = (S.towns[id] || S.wilds[id] || S.dungeons[id] || { name: id }).name;
    return mid && n.startsWith("The ") ? "the" + n.slice(3) : n;
  }
  function clsName(id) { return (S.classes[id] || { name: id }).name; }
  // towns and dungeons by the name a sentence uses ("the Collapsed Mine" mid-sentence), longest first so "Old Ironhaven Mine" beats "Ironhaven"
  let placeNames = null;
  function places() {
    if (placeNames) return placeNames;
    placeNames = [];
    for (const src of [S.towns, S.dungeons]) for (const [id, n] of Object.entries(src || {})) if (n && n.name) placeNames.push([n.name.replace(/^The /, ""), placeHref(id)]);
    return placeNames;
  }
  // a dungeon has its own page with its floors; every other place opens on the map
  function placeHref(id) { return S.dungeons && S.dungeons[id] ? `#/dungeon/${id}` : `#/map/${id}`; }
  // turns plain story text into nodes with hero & party names linked, and the first mention of each town and dungeon
  function richText(text, heroIds, partyIds) {
    const names = [];
    for (const id of heroIds || []) if (heroes[id]) names.push([heroes[id].name, `#/hero/${id}`, false, true]);
    for (const id of partyIds || []) if (parties[id]) names.push([parties[id].name, `#/party/${id}`]);
    for (const [nm, href] of places()) names.push([nm, href, true]);
    names.sort((a, b) => b[0].length - a[0].length);
    let parts = [String(text == null ? "" : text)];
    const word = /[\p{L}\p{N}]/u;
    for (const [nm, href, once, hero] of names) {
      if (!nm) continue;
      let done = false;
      const next = [];
      for (const p of parts) {
        if (typeof p !== "string" || done) { next.push(p); continue; }
        let rest = p, i;
        while (!done && (i = indexOfWord(rest, nm, word, once, hero)) >= 0) {
          if (i > 0) next.push(rest.slice(0, i));
          next.push(el("a", { href }, nm));
          rest = rest.slice(i + nm.length);
          done = !!once;
        }
        if (rest) next.push(rest);
      }
      parts = next;
    }
    return parts;
  }
  // a story line anyone wrote (a diary entry, a snippet, a letter): every hero, crew, town and dungeon it names is linked
  function storyText(text) { return richText(text, Object.keys(heroes), Object.keys(parties)); }
  // one story line as the site shows it everywhere: its names linked, then a link to the replay, song or reading it tells, while that is kept
  function storyLine(x, text) {
    const link = storyLink(x);
    return [storyText(text == null ? x.text : text), link ? [" ", link] : null];
  }
  // a place name that opens a longer proper name ("the Saltmarrow Shell Dice", "Ironhaven Lullaby") names a thing, not the place
  // a hero's name straight after another name's possessive is part of a longer name ("Varun's Hunter's Mark"), not the hero Mark
  function indexOfWord(s, nm, word, place, hero) {
    let from = 0;
    for (;;) {
      const i = s.indexOf(nm, from);
      if (i < 0) return -1;
      const before = i > 0 ? s[i - 1] : "", after = s[i + nm.length] || "";
      const named = (place && /^ [A-Z]/.test(s.slice(i + nm.length, i + nm.length + 2))) || (hero && /[A-Z][a-z]+'s $/.test(s.slice(Math.max(0, i - 16), i)));
      if (!(before && word.test(before)) && !(after && word.test(after)) && !named) return i;
      from = i + 1;
    }
  }

  // ---------- days: one style everywhere, the season and its day ----------
  function seasonOf(day) {
    const s = ((L && L.seasons) || []).find((x) => x.start_day <= day && day <= x.end_day);
    if (s) return [s.season, day - s.start_day + 1];
    const m = (L && L.meta) || {};
    if (!m.season) return [1, day];
    // a deadline can fall past this season's last day, into the next one
    const d = day - (m.day - m.season_day), len = m.season_length || 30;
    return d > len ? [m.season + Math.floor((d - 1) / len), ((d - 1) % len) + 1] : [m.season, d];
  }
  // "S2 · Day 9" on cards; in a sentence always "day 9 of season 2" ("on day 9 of season 2" after "on"): a bare "day 9" reads as the world's day
  function when(day, prose) {
    if (day == null) return "";
    const [s, d] = seasonOf(day);
    if (!prose) return `S${s} · Day ${d}`;
    return `${prose === "on" ? "on " : ""}day ${d} of season ${s}`;
  }

  // ---------- events ----------
  // by the world day, never e.sday: a story written while a save was being upgraded carries the day before's season day (round 38)
  function dayLabel(e) {
    return when(e.day);
  }
  const SHARE_KINDS = new Set(["showdown", "pvp", "rescue", "boss_kill", "boss", "death", "evolve", "keystone", "legend", "vow_kept", "epithet", "race_won", "funeral"]);
  function shareBtn(text, hash, msg) {
    return el("button", { class: "share-mini", type: "button", title: "Copy this with a link, to paste anywhere",
      onclick: (ev) => { ev.preventDefault(); ev.stopPropagation(); copy(`${typeof text === "function" ? text() : text}
${shareUrl(hash)}`, msg || "Copied with a link. Paste it anywhere."); } }, "↗ share");
  }
  function eventHash(e) {
    const h = (e.heroes || []).find((id) => heroes[id]);
    return h ? `#/hero/${h}` : `#/day/${e.day}`;
  }
  function eventRow(e, opts) {
    opts = opts || {};
    const who = el("div", { class: "who" });
    const hs = (e.heroes || []).filter((id) => heroes[id]).slice(0, opts.max || 2);
    for (const id of hs) who.appendChild(heroPortrait(heroes[id], 1, { noGray: true }));
    const meta = [];
    if (!opts.noDay) meta.push(dayLabel(e));
    if (e.loc) meta.push(S.towns[e.loc] || S.dungeons[e.loc] || S.wilds[e.loc] ? el("a", { href: placeHref(e.loc) }, nodeName(e.loc)) : nodeName(e.loc));
    const owners = [...new Set((e.heroes || []).map((id) => heroes[id]).filter((h) => h && !h.npc).map((h) => h.owner))].slice(0, 3);
    if (owners.length) meta.push("👤 " + owners.join(", "));
    const fightLink = storyLink(e) || (e.kind === "song" ? el("a", { class: "watch", href: "#/songs" }, "♪ hear it") : null);
    const ks = e.kind === "keystone", tag = ks ? "✦ Keystone" : e.sk ? `✧ ${e.sk}` : null;
    const share = !opts.noShare && (SHARE_KINDS.has(e.kind) || e.imp >= 5) ? shareBtn(e.text, eventHash(e)) : null;
    const jump = (movesOf[e.id] || []).filter((m) => heroes[m.hero] || parties[m.party]);
    const chips = jump.slice(0, 3).map((m) => el("span", { class: "jump", title: `${m.from ? ordinal(m.from) : "unranked"} to ${ordinal(m.to)}` },
      `${heroes[m.hero] ? heroes[m.hero].name : parties[m.party].name} +${m.gain}${m.to < m.from ? " ▲" + (m.from - m.to) : ""}`));
    const marks = opts.mark && (opts.mark instanceof Set ? opts.mark : mineSet());
    const pinned = marks && (e.heroes || []).some((id) => marks.has(id));
    return el("li", { class: `ev imp${e.imp}${ks ? " keystone" : ""}${pinned ? " pinned" : ""}` }, who,
      el("div", { class: "body" }, el("div", { class: "text" }, storyText(e.text), fightLink ? " " : "", fightLink),
        chips.length ? el("div", { class: "jumps" }, chips) : null,
        el("div", { class: "meta" }, tag ? el("span", { class: "ks-tag" }, tag) : null, tag && meta.length ? " · " : null, meta.map((x, i) => [i ? " · " : "", x]), share ? [" ", share] : null)));
  }
  // a "+N renown" line names the story that caused it, so the jump can sit on that story as chips
  const movesOf = {};
  for (const e of (L && L.events) || []) if (e.kind === "big_move" && e.cause) movesOf[e.cause] = (movesOf[e.cause] || []).concat(e.moves || [], e.party_moves || []);
  function ordinal(n) { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  const fightIds = new Set((L && L.fights_index) || []), nightIds = new Set((L && L.nights_index) || []), mealIds = new Set((L && L.meals_index) || []), readingIds = new Set((L && L.readings_index) || []);
  const roadIds = new Set((L && L.roads_index) || []);
  const catchIds = new Set((L && L.catches_index) || []), gameIds = new Set((L && L.games_index) || []), songIds = new Set(((L && L.songs) || []).map((s) => s.id));
  const heroSongBy = {};
  for (const s of (L && L.hero_songs) || []) heroSongBy[s.id] = s.author;
  function feed(list, opts) {
    const ul = el("ul", { class: "feed" });
    let lastDay = null;
    // a renown jump already rides as chips on the story that caused it, so in the same list it isn't told a second time
    const ids = new Set(list.map((e) => e.id));
    list = list.filter((e) => !(e.kind === "big_move" && e.cause && ids.has(e.cause) && (movesOf[e.cause] || []).length));
    if (opts && opts.mark && !(opts.mark instanceof Set)) opts = Object.assign({}, opts, { mark: mineSet() });
    for (const e of list) {
      if (opts && opts.dayHeaders && e.day !== lastDay) {
        const [s, d] = seasonOf(e.day);
        ul.appendChild(el("li", { class: "daydiv" }, `Season ${s} · Day ${d}`));
        lastDay = e.day;
      }
      ul.appendChild(eventRow(e, Object.assign({ noDay: opts && opts.dayHeaders }, opts)));
    }
    if (!list.length) ul.appendChild(el("li", { class: "empty" }, (opts && opts.empty) || "Nothing yet."));
    return ul;
  }

  // ---------- lazy data ----------
  const pending = {};
  // the build's version (export.stamp_site), so a lazily loaded file matches the page that asked for it
  const V = window.AL_V ? "?v=" + window.AL_V : "";
  function load(key) {
    if (LD[key]) return Promise.resolve(LD[key]);
    if (pending[key]) return pending[key];
    pending[key] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `data/${key}.js${V}`;
      s.onload = () => (LD[key] ? resolve(LD[key]) : reject(new Error("missing " + key)));
      s.onerror = () => reject(new Error("could not load " + key));
      document.head.appendChild(s);
    });
    return pending[key];
  }
  // the heavy players (fights, meals, readings, music and night games) load with their first page, in order; a <script> tag works from file://
  const scripts = {};
  function need(names) {
    return names.reduce((p, n) => p.then(() => scripts[n] || (scripts[n] = document.querySelector(`script[src="js/${n}.js${V}"]`) ? Promise.resolve() : new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `js/${n}.js${V}`;
      s.onload = resolve;
      s.onerror = () => { delete scripts[n]; reject(new Error("could not load " + n)); };
      document.head.appendChild(s);
    }))), Promise.resolve());
  }
  // the heavy drawing and sound files load with the first page that uses them (eval #92), in this order: the place headers before the
  // tavern and camp that stand in them, the tavern before the ballad stage
  const PLACES = ["town_scenes", "wild_scenes"];
  const STAGE = PLACES.concat(["mount_art", "tavern", "camp", "ballad"]);
  const SONG = STAGE.concat(["music"]);
  // a part of a page whose file isn't in yet: an empty slot now, swapped for the drawing once the file loads (nothing draws before it)
  function later(names, make) {
    const slot = document.createElement("span");
    slot.className = "later";
    need(names).then(() => { let out = null; try { out = make(); } catch (e) { console.error(e); } if (out) slot.replaceWith(out); else slot.remove(); },
      (e) => { console.error(e); slot.remove(); });
    return slot;
  }
  // a story vignette: a song is staged on the ballad stage, a dungeon framed from its own header; anything else draws now
  function vignette(e, W, H, cls) {
    const make = () => { const c = Scenes.vignette(e, W, H); if (cls) c.className = cls; return c; };
    const names = e.kind === "song" && S.towns[e.loc] ? ["town_scenes", "wild_scenes", "tavern", "music", "ballad"]
      : S.dungeons[e.loc] ? (["boss", "boss_kill"].includes(e.kind) ? PLACES.concat(["deaths"]) : PLACES) : e.kind === "mount" ? ["mount_art"] : null;
    return names ? later(names, make) : make();
  }
  // the road strip, busts and map pins (road_scenes.js, road_art.js) load with the first page that draws them
  const ROAD_ART = ["road_scenes", "road_art"];
  // a town day's scenes: the sets, the acts and the player (and what they draw with), loaded with the first town day a page draws
  const TOWN_ART = STAGE.concat(["road_scenes", "road_art", "scene_kits", "stage", "town_day_sets", "town_day_sets_b", "town_day_sets_c", "town_day_sets_e", "town_day_flat", "town_day_flat_sets", "town_day_flat_sets_b", "town_day_acts", "town_day_replay"]);
  // a hunt day's acts on the wilds' own ground, with the game and the hunt's props
  const HUNT_ART = ["road_scenes", "road_art", "scene_kits", "stage", "hunt_art", "hunt_scenes"];
  // the art and the road cast (data/road_cast.js: travellers' looks and the places) arrive together
  function roadArt(names) {
    return Promise.all([need(names || ROAD_ART), S.road ? null : load("road_cast").then((c) => { S.road = c; })]);
  }

  // ---------- follow ("my heroes") ----------
  function mine() {
    try { const v = JSON.parse(localStorage.getItem("al.mine") || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch (e) { return []; }
  }
  function mineSet() { return new Set(mine()); }
  function setMine(ids) { try { localStorage.setItem("al.mine", JSON.stringify(ids)); } catch (e) { /* storage unavailable */ } }
  function toggleMine(id) {
    const m = mine();
    const i = m.indexOf(id);
    if (i >= 0) m.splice(i, 1); else m.push(id);
    setMine(m);
    return i < 0;
  }

  // ---------- misc ui ----------
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2200);
  }
  function copy(text, msg) {
    const done = () => toast(msg || "Copied!");
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() {
      const ta = el("textarea", { style: { position: "fixed", opacity: 0 } }, text);
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { toast("Copy failed; select the text manually."); }
      ta.remove();
    }
  }
  function shareUrl(hash) {
    const base = location.href.split("#")[0];
    return base + hash;
  }
  function bar(v, max, cls) {
    const pct = Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100));
    return el("div", { class: "bar " + (cls || "") }, el("i", { style: { width: pct + "%" } }));
  }
  function heroCard(h, opts) {
    opts = opts || {};
    const m = mine().includes(h.id);
    const where = h.alive === false ? `Fell in season ${h.died_season || "?"}` : h.travel ? `On the road to ${nodeName(h.travel.to)}` : h.doing ? cap(h.doing) : nodeName(h.loc);
    return el("a", { class: `hcard ${h.alive === false ? "dead" : ""} ${m ? "mine" : ""}`, href: `#/hero/${h.id}` },
      m ? el("span", { class: "badge" }, "YOURS") : null,
      heroPortrait(h, 2, { cls: "spr" }),
      el("div", { class: "info" },
        el("div", { class: "nm" }, h.name, h.epithet ? el("span", { class: "gold small" }, " " + h.epithet) : null),
        el("div", { class: "small" }, `Lv ${h.level} ${h.title || clsName(h.cls)}`),
        el("div", { class: "small muted" }, h.npc ? "League hero" : `${h.owner}'s hero`),
        el("div", { class: "small dim" }, where),
        opts.extra || null));
  }

  // ---------- router ----------
  const routes = [];
  function route(re, fn) { routes.push([re, fn]); }
  // a page that draws with lazily loaded files names them here, and is drawn once they are in
  const NEEDS = [];
  function needs(re, names) { NEEDS.push([re, names]); }
  // pages few visits need are fetched the first time they're opened, so the first load stays light (with the build's version)
  const LAZY = [[/^\/dungeon\//, ["js/town_scenes.js", "js/wild_scenes.js", "js/dungeon_pen.js", "js/dungeon_map_ink.js", "js/views_dungeon.js"], ["css/dungeon.css"]],
    [/^\/places(\/|$)/, ["js/views_places.js"], ["css/places.css"]],
    // the replay pages (replay.js) and everything their players stand on
    [/^\/(fight|night|meal|catch|road|reading|table|day)\//, ["js/town_scenes.js", "js/wild_scenes.js", "js/mount_art.js", "js/tavern.js", "js/camp.js", "js/ballad.js",
      "js/music.js", "js/replay.js"], []]];
  const lazyLoaded = new Set();
  function lazy(hash) {
    const hit = LAZY.find(([re]) => re.test(hash));
    if (!hit || lazyLoaded.has(hit)) return false;
    lazyLoaded.add(hit);
    const v = window.AL_V ? `?v=${window.AL_V}` : "";
    for (const href of hit[2]) document.head.appendChild(Object.assign(document.createElement("link"), { rel: "stylesheet", href: href + v }));
    // in order, and never twice: later page files build on the earlier ones, and a page may already have loaded some
    need(hit[1].map((src) => src.replace(/^js\/|\.js$/g, ""))).then(render, (e) => console.error(e));
    return true;
  }
  // a deep page lights the tab it belongs under; a replay keeps the tab the reader came from
  const TAB_OF = [[/^\/(hero|roster)(\/|$)/, "/roster"], [/^\/(party|parties)(\/|$)/, "/parties"], [/^\/(map|dungeon|places)(\/|$)/, "/map"],
    [/^\/(days?|digest)(\/|$)/, "/"], [/^\/(finale|history)(\/|$)/, "/history"], [/^\/songs(\/|$)/, "/songs"], [/^\/guide(\/|$)/, "/guide"], [/^\/(event|world)(\/|$)/, "/world"],
    [/^\/replays(\/|$)/, "/replays"]];
  const REPLAY = /^\/((fight|night|meal|catch|road|reading|table)\/|day\/\w*[a-z]\w*\/\d+\/\d+$)/;
  let navTab = "/";
  function lightNav(hash) {
    const links = [...document.querySelectorAll("#nav a")], has = (t) => links.some((a) => a.getAttribute("href") === "#" + t);
    let tab;
    if (REPLAY.test(hash)) tab = navTab;
    else if (/^\/annals/.test(hash)) tab = has("/annals") ? "/annals" : "/history";
    else {
      const hit = TAB_OF.find(([re]) => re.test(hash));
      tab = hit ? hit[1] : hash === "/" ? "/" : "/" + hash.split("/")[1];
    }
    if (!has(tab)) tab = REPLAY.test(hash) ? "/" : tab;
    navTab = tab;
    for (const a of links) a.classList.toggle("on", a.getAttribute("href") === "#" + tab);
    const more = document.getElementById("nav-more");
    if (more) more.classList.toggle("on", links.some((a) => a.classList.contains("on") && a.closest(".nav-more-list")));
  }
  function render() {
    const hash = location.hash.replace(/^#/, "") || "/";
    const view = document.getElementById("view");
    if (window.Music) Music.stop();
    if (window.Sound) Sound.setPage(hash);
    lightNav(hash);
    for (const [re, fn] of routes) {
      const m = hash.match(re);
      if (m) {
        view.innerHTML = "";
        animated.clear();
        try {
          const want = NEEDS.filter(([re2]) => re2.test(hash)).flatMap(([, n]) => n);
          const out = want.length ? need(want).then(() => fn(view, ...m.slice(1))) : fn(view, ...m.slice(1));
          if (out && out.catch) out.catch((err) => { view.appendChild(el("p", { class: "red" }, "Couldn't load that page: " + err.message)); });
        } catch (err) {
          console.error(err);
          view.appendChild(el("p", { class: "red" }, "Something went wrong drawing this page."));
        }
        window.scrollTo(0, 0);
        return;
      }
    }
    if (lazy(hash)) return;
    view.innerHTML = "";
    view.appendChild(el("div", { class: "panel" }, el("h2", null, "Lost in the woods"), el("p", null, "That page doesn't exist. ", el("a", { href: "#/" }, "Back to the Crier."))));
  }

  function start() {
    if (!L || !S) {
      document.getElementById("view").innerHTML = "<div class='panel'><h2>No league data</h2><p>Run <code>python -m league run</code> to build the site.</p></div>";
      return;
    }
    const meta = L.meta;
    document.title = meta.name;
    document.getElementById("brand-name").textContent = meta.name;
    const icon = document.getElementById("brand-icon");
    const anyHero = L.heroes.find((h) => h.alive) || L.heroes[0];
    if (anyHero) { const g = Art.heroGrid(anyHero, 0, heroLook(anyHero)); icon.width = g.w; icon.height = g.h; icon.getContext("2d").drawImage(g.toCanvas(1), 0, 0); icon.style.width = "22px"; icon.style.height = "27px"; }
    if (L.annals && !document.querySelector('#nav a[href="#/annals"]')) {
      const a = document.createElement("a");
      a.href = "#/annals"; a.textContent = "Annals"; a.className = "annals-link";
      const guide = document.querySelector('#nav a[href="#/guide"]');
      guide.parentNode.insertBefore(a, guide);
    }
    // the phone nav is one row of five and a "More" menu (round 38); on a desktop the menu's links sit in the row
    const more = document.getElementById("nav-more"), nav = document.getElementById("nav");
    if (more) {
      const shut = () => { nav.classList.remove("more-open"); more.setAttribute("aria-expanded", "false"); };
      more.addEventListener("click", (e) => { e.stopPropagation(); const open = nav.classList.toggle("more-open"); more.setAttribute("aria-expanded", String(open)); });
      document.addEventListener("click", (e) => { if (!more.contains(e.target)) shut(); });
      window.addEventListener("hashchange", shut);
    }
    const clock = document.getElementById("clock");
    if (meta.phase === "preseason") clock.innerHTML = `<b>Preseason</b> · ${plural(L.pending.length, "hero")} signed up`;
    else if (L.annals) clock.innerHTML = `<b class="clock-long">The age is over</b><b class="clock-short">Age over</b> · <a href="#/annals"><span class="clock-long">read the </span>Annals</a>`;
    else if (meta.phase === "offseason") clock.innerHTML = `<b>Season ${meta.season} is over</b><span class="clock-long"> · next season starts with the next run</span>`;
    else clock.innerHTML = `<span class="clock-long"><b>Season ${meta.season}</b> · Day ${meta.season_day} of ${meta.season_length} · Week ${Math.ceil(meta.season_day / 7)}</span>`
      + `<span class="clock-short"><b>S${meta.season}</b> · Day ${meta.season_day}/${meta.season_length}</span>`;
    document.getElementById("foot-text").textContent = `${meta.name} · run by ${meta.commissioner} · world day ${meta.day} · nothing here needs your input, just check back tomorrow.`;
    window.addEventListener("hashchange", render);
    render();
  }

  window.App = {
    LD, L, S, heroes, parties, events, el, esc, plural, cap, heroSprite, heroPortrait, monsterSprite, petSprite, bannerSprite, itemSprite, heroLink, partyLink,
    nodeName, clsName, richText, storyText, storyLine, storyLink, storyHref, kept, eventRow, feed, load, need, needs, later, vignette, PLACES, STAGE, SONG, ROAD_ART, TOWN_ART, HUNT_ART, roadArt, mine, toggleMine, toast, copy, shareUrl, shareBtn, bar, heroCard, route, start, heroLook, legendFigure, spriteCanvas, when,
    animated, money, coins, tableLink, poss, placeHref, floorWords, floorOrd, seasonOf, heroDayHref, mineSet,
  };
})();
