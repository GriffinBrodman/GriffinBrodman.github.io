/* Fight replays: a stored combat log played on the S stage (a side view on a ground plane), directed by FightDirector. */
(function () {
  "use strict";
  const A = App;
  const { el, S, heroes } = A;
  const W = 384, H = 216, FRONT = 150, BACK = 130, MID = W / 2, FLAT = 0.32;
  const R = Math.round, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (x) => 1 - (1 - clamp(x, 0, 1)) ** 3;
  const seg = (a, a0, a1) => clamp((a - a0) / (a1 - a0), 0, 1);
  const realFX = () => !!(window.FightFX && FightFX.FAMILIES && Object.keys(FightFX.FAMILIES).length);
  const FONT = "'League Five', 'Pixelify Sans', monospace";

  // ---------- the players load with their first page (A.need); the words below each one still tell it if one can't ----------
  const KIT = {
    fight: ["battlefield", "deaths", "fight_fx", "fight_director"], meal: ["food_art", "food_dishes", "food_eat", "meal_replay", "meal_tavern"],
    road: ["food_art", "road_scenes", "road_art", "scene_kits", "stage", "road_hints", "road_replay"], town: A.TOWN_ART, hunt: A.HUNT_ART, reading: ["tarot_replay"], catch: ["food_art", "fish_art", "fish_replay"], music: ["music_replay", "music_camp"], chess: ["chess_replay"], night: ["night_replay"], table: ["tables_replay"],
  };
  const kit = (k) => A.need(KIT[k]).catch((e) => { if (window.console) console.error(e); });

  // ---------- the control bar every replay shares ----------
  // ctl: { t, dur, playing, play(), pause(), restart(), skip(), rate(s)? } (a player's fig.replay, or the fight's own);
  // o: { share: () => text, shared: its toast, title: [kicker, title, sub] for a plate over the stage until ctl.t passes titleUntil }
  const BAR_SPEEDS = [1, 2, 4];
  function controls(ctl, o) {
    o = o || {};
    const btn = (icon, label, title, fn) => el("button", { class: "btn small", type: "button", title, "aria-label": title, onclick: fn },
      el("span", { class: "ico", "aria-hidden": "true" }, icon), el("span", { class: "lbl" }, label));
    const set = (b, icon, label) => { b.firstChild.textContent = icon; b.lastChild.textContent = label; };
    const play = btn("❚❚", "Pause", "Play or pause", () => { if (ctl.playing) ctl.pause(); else if (ctl.t >= ctl.dur) ctl.restart(); else ctl.play(); sync(); });
    const speeds = BAR_SPEEDS.map((sp) => el("button", {
      class: "btn small spd" + (sp === 1 ? " on" : ""), type: "button", title: ctl.rate ? `Play at ${sp}× speed` : "A song keeps its own time", disabled: !ctl.rate,
      onclick: () => { ctl.rate(sp); speeds.forEach((b, k) => b.classList.toggle("on", BAR_SPEEDS[k] === sp)); },
    }, `${sp}×`));
    // while the browser still holds sound back, a tap on the bar's own button is the gesture that frees it, not a switch to off
    const snd = btn("🔊", "Sound", "Sound on or off", (e) => { e.stopPropagation(); const wait = window.Sound && Sound.locked; const t = document.querySelector(".snd-panel .btn"); if (t && !wait) t.click(); setTimeout(sync, 60); });
    // while sound waits for the page's first gesture a "Tap for sound" button joins the bar, beside the sound switch: over the stage it
    // covered captions and the people acting them
    const tap = el("button", { class: "snd-tap", type: "button", title: "Sound is waiting for a tap", hidden: true }, "♪ Tap for sound");
    tap.onclick = (e) => { e.stopPropagation(); tap.hidden = true; };
    const box = el("div", { class: "controls replay-bar" }, play,
      btn("↺", "Restart", "Watch from the start", () => { ctl.restart(); sync(); }),
      btn("⏭", "Skip", "Skip to the end", () => { ctl.skip(); sync(); }),
      el("span", { class: "spds", role: "group", "aria-label": "Speed" }, speeds), snd, tap,
      o.share ? btn("⤴", "Share", "Copy this with a link", () => A.copy(o.share(), o.shared || "Copied with a link.")) : null);
    const plate = o.title ? el("div", { class: "replay-title", "aria-hidden": "true" }, el("small", null, o.title[0]), el("b", null, o.title[1]), o.title[2] ? el("small", null, o.title[2]) : null) : null;
    // a replay starts on its own before the page has had a gesture, and browsers keep sound locked till one comes: the tap is it,
    // and each player brings its sound in where the scene has got to (a song in time, the fire's bed for what is left of it)
    function sync() {
      const on = ctl.playing;
      set(play, on ? "❚❚" : "▶", on ? "Pause" : "Play");
      const wait = !!(window.Sound && Sound.locked);
      set(snd, window.Sound && Sound.on ? "🔊" : "🔇", "Sound");
      snd.classList.toggle("snd-wait", wait);
      tap.hidden = !wait;
      if (plate) plate.classList.toggle("gone", ctl.t > (o.titleUntil || 0));
    }
    sync();
    // the players run their own loops; the bar only follows them, a few times a second while it is on the page
    let seen = false;
    const iv = setInterval(() => {
      if (!box.isConnected) { if (seen) clearInterval(iv); return; }
      seen = true;
      if (!document.hidden) sync();
    }, 250);
    box.plate = plate;
    return box;
  }
  // a whole stage stays on a desktop screen below the header, however wide the page
  const fitScreen = (node, cv) => { if (cv && cv.width && cv.height) { node.classList.add("fit-screen"); node.style.setProperty("--ar", (cv.width / cv.height).toFixed(3)); } };
  // a player's figure on the page, with the bar right under its stage
  function stage(p, fig, o) {
    p.appendChild(fig);
    fitScreen(fig, fig.querySelector("canvas"));
    if (!fig.replay) return;
    const bar = controls(fig.replay, o), shot = fig.firstChild;
    fig.insertBefore(bar, shot.nextSibling);
    const wrap = el("div", { class: "replay-shot" });
    fig.insertBefore(wrap, shot);
    wrap.append(shot);
    if (bar.plate) wrap.append(bar.plate);
  }
  const lineup = (xs) => xs.reduce((acc, x, i) => acc.concat(i ? [i === xs.length - 1 ? " and " : ", ", x] : [x]), []);
  // the rest of the crew at the fire or the table, who didn't play
  const looked = (g, verb) => ((g.onlookers || []).length ? [" ", ...lineup(g.onlookers.map((x) => A.heroLink(x.id))), ` ${verb}.`] : []);
  const fadedPage = (v, title, why) => v.appendChild(el("section", { class: "panel faded" }, el("h2", null, title), el("p", null, why),
    el("p", null, el("a", { class: "btn", href: "#/" }, "Back to the Crier"))));

  // the way back from a replay, above and below it: the hero's day, that day's paper, the crew and the place, as far as the record knows them
  function backBar(o) {
    const L = A.L, who = [...new Set((o.heroes || []).filter((id) => heroes[id]))], pinned = A.mine();
    const hid = who.find((id) => pinned.includes(id)) || who[0], day = o.day;
    const place = o.place && (S.towns[o.place] || S.wilds[o.place] || S.dungeons[o.place]) ? o.place : null;
    const party = o.party && A.parties[o.party] ? o.party : null;
    const items = [hid ? el("a", { href: A.heroDayHref(hid, day) }, `‹ ${A.poss(heroes[hid].name)} day`) : null,
      day ? el("a", { href: day === L.meta.day ? "#/" : `#/day/${day}` }, `Day ${A.seasonOf(day)[1]} paper`) : null,
      party ? el("a", { href: `#/party/${party}` }, A.parties[party].name) : null,
      place ? el("a", { href: A.placeHref(place) }, A.nodeName(place)) : null].filter(Boolean);
    if (!items.length) return null;
    return el("div", { class: "back-bar", role: "navigation", "aria-label": "Back from this replay" }, items.map((x, i) => [i ? el("span", { class: "sep", "aria-hidden": "true" }, "·") : null, x]));
  }
  function backBars(v, o) {
    const top = backBar(o);
    if (!top) return;
    v.prepend(top);
    v.appendChild(backBar(o));
  }
  const ids = (xs) => (xs || []).map((x) => (x && typeof x === "object" ? x.id : x)).filter(Boolean);

  // a fight with a traveller in the line brings the road art, so they are drawn as themselves
  const withTravellers = (f) => ((f.lineup || []).some((u) => u.kind === "traveller") && !window.RoadArt ? A.roadArt(["road_art"]).then(() => f, () => f) : f);
  A.route(/^\/fight\/(\w+)$/, (v, id) => Promise.all([A.load(`fight/${id}`), kit("fight")]).then(([f]) => withTravellers(f)).then((f) => { replayPage(v, f); backBars(v, { heroes: f.heroes, day: f.day, party: (f.parties || [])[0], place: f.place }); }).catch((err) => {
    if (window.console && err && err.stack && !/load/i.test(String(err))) console.error(err);
    const art = Scenes.backdrop("plains", 200, 50, Art.hash(id));
    art.className = "faded-art";
    v.appendChild(el("section", { class: "panel faded" }, el("h2", null, "That fight has faded from memory"), art,
      el("p", null, "Only notable fights are kept for long. Routine scraps are forgotten after two weeks."),
      el("p", null, el("a", { class: "btn", href: "#/" }, "Back to the Crier"))));
  }));

  // a game at camp or in a tavern; the pixel player (NightReplay) draws it when loaded, otherwise the game is told in words
  A.route(/^\/night\/(\w+)$/, (v, id) => A.load(`night/${id}`).then((g) => kit(g.game === "music" ? "music" : g.game === "chess" ? "chess" : "night").then(() => g)).then((g) => {
    // a music night: the tavern stage, the anthem under the stars, or a camp song (music_replay.js)
    if (g.game === "music") {
      const mates = (g.joiners || []).map((x) => A.heroLink(x.id));
      const head = g.anthem ? `${A.poss(g.anthem.crew, g.anthem.party)} anthem: “${g.song.title}”` : `“${g.song.title}” at ${g.place || (g.where === "tavern" ? "the tavern" : "camp")}`;
      const p = el("section", { class: "panel" }, el("h2", null, head),
        el("p", { class: "small muted" }, A.heroLink(g.lead.id), " led", ...(mates.length ? [" with ", ...lineup(mates)] : []), `, ${A.when(g.day, "on")}.`, ...looked(g, "listened")));
      if (window.MusicReplay) {
        try { stage(p, MusicReplay.player(g, { bar: true }), { share: () => `${head}\n${A.shareUrl("#/night/" + g.id)}`, shared: "The song and a link copied." }); } catch (e) { if (window.console) console.error(e); }
      }
      if (g.text) p.appendChild(el("p", null, g.text));
      v.appendChild(p);
      backBars(v, { heroes: [g.lead && g.lead.id, ...ids(g.joiners), ...ids(g.onlookers)], day: g.day, party: g.anthem && g.anthem.party });
      return;
    }
    const names = (g.players || []).map((x) => (x.goblin ? x.name : A.heroLink(x.id)));
    const won = (g.players || [])[g.winner];
    const title = `${g.game.charAt(0).toUpperCase() + g.game.slice(1)} at ${g.place || (g.where === "tavern" ? "the tavern" : "camp")}`;
    const p = el("section", { class: "panel" }, el("h2", null, title),
      el("p", { class: "small muted" }, ...lineup(names), `, ${A.when(g.day, "on")}. `, won ? `${won.name} won.` : "A draw.", ...looked(g, "looked on")));
    const R = g.game === "chess" ? window.ChessReplay : window.NightReplay;
    if (R) {
      try { stage(p, R.player(g), { share: () => `${title}: ${won ? `${won.name} won` : "a draw"}\n${A.shareUrl("#/night/" + g.id)}`, shared: "The game and a link copied." }); } catch (e) { /* the words below still tell it */ }
    }
    if (g.text) p.appendChild(el("p", null, g.text));
    v.appendChild(p);
    backBars(v, { heroes: [...ids((g.players || []).filter((x) => !x.goblin)), ...ids(g.onlookers)], day: g.day });
  }).catch(() => {
    // a night whose song a hero is still writing isn't faded, only unfinished: it appears once the song is written down (round 31)
    const pending = (((window.LD && LD.league) || {}).nights_pending || []).includes(id);
    if (pending) fadedPage(v, "That song isn't written down yet", "Someone at that fire sang a song of their own that they're still writing. The night comes back here once the words are finished.");
    else fadedPage(v, "That night by the fire has faded", "Only a fortnight of camp games is kept, and the ones that made the paper.");
  }));

  // a meal: a cooking night at camp, or a named dish bought in town; the pixel player (MealReplay) draws it when loaded, otherwise it is told in words.
  // Meal files are never deleted, so an old link always plays
  A.route(/^\/meal\/(\w+)$/, (v, id) => A.load(`meal/${id}`).then((g) => kit("meal").then(() => g)).then((g) => {
    const list = (xs) => lineup(xs.map((x) => A.heroLink(x.id)));
    const others = (g.eaters || []).filter((x) => x.id !== g.cook);
    const t = S.towns[g.town] || {};
    const mid = (s) => (s && s.startsWith("The ") ? "the" + s.slice(3) : s);
    const at = g.kind === "camp" ? g.at || `at ${A.nodeName(g.place, true)}` : g.where === "tavern" ? `at ${mid(t.tavern) || A.nodeName(g.place, true)}` : `at a ${g.where === "stall" ? "food stall" : "bakery"} in ${t.name || A.nodeName(g.place)}`;
    const dish = ((S.food || {}).dishes || {})[g.dish] || {};
    const ev = window.MealReplay && MealReplay.eventOf ? MealReplay.eventOf(g) : null, town = t.name || A.nodeName(g.place);
    // a town event's own words (meal.at, from league/cooking.py) when the record has them; a baker never "ate at a bakery"
    const who = ev === "contest" ? [...list(g.baker ? [{ id: g.baker }] : g.eaters || []), ` baked it ${g.at || `for the ${town} baking contest`}`]
      : ev === "feud" ? [...list(g.eaters || []), g.at ? ` tasted it ${g.at}` : ` settled a cooks' feud with it in ${town}`]
      : ev === "feast" ? [...list(g.eaters || []), ` ate it ${g.at || `at the ${town} feast day`}`]
      : g.cook ? [A.heroLink(g.cook), " cooked", ...(others.length ? [" for ", ...list(others)] : [" alone"]), ` ${at}`] : [...list(g.eaters || []), ` ate ${at}`];
    const p = el("section", { class: "panel" }, el("h2", null, `${g.name}${g.disaster ? ", gone wrong" : ""}`),
      el("p", { class: "small muted" }, ...who, `, ${A.when(g.day, "on")}.`, g.special ? " This week's special." : ""));
    if (window.MealReplay) {
      try { stage(p, MealReplay.player(g), { share: () => `${g.name}${g.text ? ": " + g.text : ""}\n${A.shareUrl("#/meal/" + g.id)}`, shared: "The meal and a link copied." }); } catch (e) { if (window.console) console.error(e); }
    }
    if (g.text) p.appendChild(el("p", null, g.text));
    if (dish.desc) p.appendChild(el("p", { class: "small dim" }, dish.desc));
    v.appendChild(p);
    backBars(v, { heroes: [g.cook, g.baker, ...ids(g.eaters)], day: g.day, place: g.town || g.place });
  }).catch(() => fadedPage(v, "That meal isn't on file", "The kitchen has no record of it.")));

  // a fishing session: the pixel player (FishReplay) draws it when loaded, otherwise it is told in words. Catch files are never deleted,
  // so a trophy's link always plays
  A.route(/^\/catch\/(\w+)$/, (v, id) => A.load(`catch/${id}`).then((g) => kit("catch").then(() => g)).then((g) => {
    const F = S.fish || {}, sp = (F.species || {})[g.species] || {}, lg = g.legend ? (F.legends || {})[g.legend.id] || {} : null;
    const title = g.outcome === "legend_caught" ? `${g.legend.name}, landed` : g.outcome === "legend_away" ? `${g.legend.name} got away`
      : g.outcome === "catch" ? `${sp.name || "A fish"}, ${g.size} cm` : g.outcome === "strange" ? { whiskers: "Old Whiskers", letter: "A letter in a bottle", key: "A drowned key" }[g.strange]
      : { nothing: "Nothing bit", away: "The one that got away", junk: "Not a fish", stolen: "Stolen from the bank" }[g.outcome] || "Fishing";
    const where = g.where === "contest" ? ` at the ${A.nodeName(g.place)} fishing contest` : ` ${g.at || "at " + A.nodeName(g.place, true)}`;
    const p = el("section", { class: "panel" }, el("h2", null, title),
      el("p", { class: "small muted" }, A.heroLink(g.hero), " fished", where, (g.crew || []).length ? [" with ", ...lineup(g.crew.map((x) => A.heroLink(x.id))), " watching"] : "",
        `, ${A.when(g.day, "on")}${g.night ? ", after dark" : ""}.`, g.rod ? ` ${g.rod.name}${g.lure ? " and a " + ((F.lures || {})[g.lure] || {}).name : ""}.` : " A hand line."));
    if (window.FishReplay) {
      try { stage(p, FishReplay.player(g), { share: () => `${title}${g.text ? ": " + g.text : ""}\n${A.shareUrl("#/catch/" + g.id)}`, shared: "The catch and a link copied." }); } catch (e) { if (window.console) console.error(e); }
    }
    if (g.text) p.appendChild(el("p", null, g.text));
    if (g.said) p.appendChild(el("p", { class: "small" }, `Old Whiskers says: “${g.said}”`));
    if (g.letter) p.appendChild(el("p", { class: "small" }, "The letter, in ", g.letter.from && (A.heroes || {})[g.letter.from] ? A.heroLink(g.letter.from) : g.letter.name, `'s hand: “${g.letter.text}”`));
    if (g.key) p.appendChild(el("p", { class: "small dim" }, `It looks like a key to ${g.key.name}. Nothing it opens has been found yet.`));
    if (g.outcome === "catch" && g.rank != null) p.appendChild(el("p", { class: "small dim" }, g.first ? "The first of its kind the league has landed." : `Bigger than ${g.rank}% of the league's ${(sp.name || "fish").toLowerCase()}.`));
    if (lg && lg.desc) p.appendChild(el("p", { class: "small dim" }, lg.desc));
    else if (sp.desc) p.appendChild(el("p", { class: "small dim" }, sp.desc));
    p.appendChild(el("p", { class: "small" }, el("a", { href: "#/creel" }, "The Creel Book →")));
    v.appendChild(p);
    backBars(v, { heroes: [g.hero, ...ids(g.crew)], day: g.day, place: g.place });
  }).catch(() => fadedPage(v, "That catch isn't on file", "The anglers' book has no record of it.")));

  // a stretch of road worth a vignette (league/roads.py records): a meeting, a place, a scene; RoadReplay dresses it, the words below still tell it
  A.route(/^\/road\/(\w+)$/, (v, id) => A.load(`road/${id}`).then((g) => A.roadArt(g.hunt ? KIT.hunt : KIT.road).then(() => g, () => g)).then((g) => {
    if (g.hunt) return huntPage(v, g);
    const R = S.road || {}, place = (R.places || {})[g.place] || null, trav = (R.travellers || {})[g.traveller] || null;
    const ends = (g.road || "").split("~").filter(Boolean).map((n) => A.nodeName(n));
    const last = trav && g.arc_step && g.arc_step >= (g.arc_len || 99);
    const title = trav ? (last ? `${trav.name.replace(/^./, (c) => c.toUpperCase())}, at the end of the road` : `${g.met > 1 ? "Again, " : ""}${trav.name}`)
      : place ? place.name.replace(/^./, (c) => c.toUpperCase()) : "On the road";
    const sub = trav ? trav.what : place ? `on the road between ${ends.join(" and ")}` : "";
    const p = el("section", { class: "panel" }, el("h2", null, title),
      el("p", { class: "small muted" }, ...lineup((g.heroes || []).map((x) => A.heroLink(x))), ends.length ? ` on the road between ${ends.join(" and ")}` : " on the road",
        `, ${A.when(g.day, "on")}.`, trav && g.met > 1 ? ` They have met ${g.met} times now.` : ""));
    if (window.RoadReplay) {
      try { stage(p, RoadReplay.player(g), { title: [(window.RoadScenes ? RoadScenes.hourOf(g) : 12) >= 18 ? "Evening" : (window.RoadScenes ? RoadScenes.hourOf(g) : 12) >= 12.5 ? "Afternoon" : "Morning", title, sub], titleUntil: 1.2,
        share: () => `${title}: ${g.line}\n${A.shareUrl("#/road/" + g.id)}`, shared: "The road and a link copied." }); } catch (e) { if (window.console) console.error(e); }
    }
    if (g.line) p.appendChild(el("p", null, A.storyText(g.line)));
    // not "part 3 of 3": a reader may have seen only some of the steps, which other heroes took
    if (trav && g.arc_step) p.appendChild(el("p", { class: "small dim" }, g.arc_step >= (g.arc_len || 99) ? `The end of ${trav.name}'s story on the roads.` : g.arc_step === 1 ? `Where ${trav.name}'s story on the roads begins.` : `A chapter of ${trav.name}'s story on the roads.`));
    v.appendChild(p);
    backBars(v, { heroes: [g.lead, ...(g.heroes || [])], day: g.day });
  }).catch(() => fadedPage(v, "That stretch of road isn't on file", "Nobody wrote that part of the road down.")));

  // a hunt's moment worth a record (league/hunt.py, hunt: True): acted out on the wild's own ground by HuntScenes
  function huntPage(v, g) {
    const where = A.nodeName(g.wild || g.road), hr = g.hour != null ? g.hour : 12;
    const p = el("section", { class: "panel" }, el("h2", null, `Hunting in ${where}`),
      el("p", { class: "small muted" }, ...lineup((g.heroes || []).map((x) => A.heroLink(x))), ` in ${where}, ${A.when(g.day, "on")}.`));
    if (window.HuntScenes) {
      try { stage(p, HuntScenes.player(g, { heroes: A.heroes }), { title: [hr >= 16 ? "Evening" : hr >= 12.5 ? "Afternoon" : "Morning", `Hunting in ${where}`, ""], titleUntil: 1.0,
        share: () => `${where}: ${g.line}
${A.shareUrl("#/road/" + g.id)}`, shared: "The hunt and a link copied." }); } catch (e) { if (window.console) console.error(e); }
    }
    if (g.line) p.appendChild(el("p", null, A.storyText(g.line)));
    v.appendChild(p);
    backBars(v, { heroes: g.heroes, day: g.day, place: g.wild });
  }

  // an hour of a hero's town day (league/town_day.py), or of a hunt day (league/hunt.py): its scene played from the day's own file
  // (export.save_daybook), the words below it
  A.route(/^\/day\/(\w+)\/(\d+)\/(\d+)$/, (v, hid, wday, i) => A.load(`daybook/${hid}/${wday}`).then((db) => {
    const b = (db.blocks || [])[+i];
    return (b && b.act === "hunt" && b.stretch ? kit("hunt") : kit("town")).then(() => db);
  }).then((db) => {
    const b = (db.blocks || [])[+i];
    if (b && b.act === "hunt" && b.stretch) return huntHour(v, hid, wday, i, b);
    if (!b || !b.scene) throw new Error("no town hour " + i);
    const hero = A.heroes[hid] || { id: hid }, at = A.nodeName(b.scene.town), span = window.Daybook ? `${Daybook.clock(b.from)} to ${Daybook.clock(b.to)}` : "";
    const p = el("section", { class: "panel" }, el("h2", null, b.label || "An hour in town"),
      el("p", { class: "small muted" }, A.heroLink(hid), ` in ${at}, ${span}, ${A.when(+wday, "on")}.`));
    if (window.TownDay) {
      try { stage(p, TownDay.player(b, { hero, heroes: A.heroes }), { title: [span, b.label || "", at], titleUntil: 1.0,
        share: () => `${hero.name || ""}, ${b.label}: ${b.line}
${A.shareUrl(`#/day/${hid}/${wday}/${i}`)}`, shared: "The hour and a link copied." }); } catch (e) { if (window.console) console.error(e); }
    }
    if (b.line) p.appendChild(el("p", null, A.storyText(b.line), b.why ? el("span", { class: "dim" }, " " + b.why) : null));
    v.appendChild(p);
    backBars(v, { heroes: [hid], day: +wday, place: b.scene.town });
  }).catch(() => fadedPage(v, "That hour isn't on file", "Only the days kept in the hero's daybook can be watched.")));

  function huntHour(v, hid, wday, i, b) {
    const hero = A.heroes[hid] || { id: hid }, party = hero.party && A.parties && A.parties[hero.party];
    const band = [hero, ...((party && party.members) || []).filter((id) => id !== hid).map((id) => A.heroes[id]).filter(Boolean)];
    const span = window.Daybook ? `${Daybook.clock(b.from)} to ${Daybook.clock(b.to)}` : "";
    // the crew that day, from the hour itself (older days without it fall back to the party now)
    const crew = (b.crew || []).filter((id) => id !== hid && A.heroes[id]).map((id) => A.heroLink(id));
    const p = el("section", { class: "panel" }, el("h2", null, b.label || "Hunting"), el("p", { class: "small muted" }, A.heroLink(hid), crew.length ? [" with ", ...lineup(crew)] : b.crew ? " alone" : "", ` hunting, ${span}, ${A.when(+wday, "on")}.`));
    if (window.HuntScenes) {
      try { stage(p, HuntScenes.player(b, { hero, band, heroes: A.heroes }), { title: [span, b.label || "", ""], titleUntil: 1.0,
        share: () => `${hero.name || ""}, ${b.label}: ${b.line}
${A.shareUrl(`#/day/${hid}/${wday}/${i}`)}`, shared: "The hour and a link copied." }); } catch (e) { if (window.console) console.error(e); }
    }
    if (b.line) p.appendChild(el("p", null, A.storyText(b.line)));
    v.appendChild(p);
    backBars(v, { heroes: [hid], day: +wday });
  }

  // a tarot reading; the pixel player (TarotReplay) draws it when loaded, otherwise the spread is told in words.
  // It opens on the laid table under a title plate, before the deal
  const READING_PRE = 1.8;
  A.route(/^\/reading\/(\w+)$/, (v, id) => A.load(`reading/${id}`).then((g) => kit("reading").then(() => g)).then((g) => {
    const T = (S.tarot || {}), cards = {};
    (T.cards || []).forEach((c) => { cards[c.id] = c; });
    if (T.drowned) cards.drowned = T.drowned;
    const reader = g.reader.kind === "hero" ? A.heroLink(g.reader.id) : g.reader.name;
    // a crew reading is for the whole crew, named as one (sitter.name is the crew's name then), with who sat in the ring
    const crewP = g.crew && Object.values(A.parties || {}).find((x) => x.name === g.sitter.name), ring = (g.crew || []).filter((x) => x !== g.reader.id && heroes[x]);
    const sitter = g.crew ? [crewP && A.partyLink ? A.partyLink(crewP.id) : g.sitter.name, ...(ring.length ? [" (", ...lineup(ring.map((x) => A.heroLink(x))), ")"] : [])] : [A.heroLink(g.sitter.id)];
    const p = el("section", { class: "panel" }, el("h2", null, `A reading at ${g.place}`),
      el("p", { class: "small muted" }, g.self ? [A.heroLink(g.sitter.id), " reads the cards for themself"] : [reader, " reads the cards for ", ...sitter], `, ${A.when(g.day, "on")}.`));
    const title = [A.cap(g.place), g.self ? `${g.sitter.name} reads alone` : `${g.reader.name} reads for ${g.sitter.name}`, "three cards"];
    if (window.TarotReplay) {
      try { stage(p, TarotReplay.player(g, { pre: READING_PRE }), { title, titleUntil: -0.3, share: () => `${title[1]} at ${g.place}\n${A.shareUrl("#/reading/" + g.id)}`, shared: "The reading and a link copied." }); } catch (e) { /* the words below still tell it */ }
    }
    p.appendChild(el("ol", { class: "small" }, g.cards.map((c) => {
      const card = cards[c.card] || { name: c.card, up: {}, rev: {} }, side = c.rev ? card.rev : card.up, om = (T.omens || {})[c.omen] || {};
      return el("li", null, el("b", null, card.name + (c.rev ? ", upside down" : "")), `: ${side.meaning || ""} `,
        el("span", { class: "muted" }, `(${c.omen === "secret" ? "a secret, until it ends" : om.says || c.omen}${c.hit === true ? "; it came true" : c.hit === false ? "; it didn't come to pass" : ""})`));
    })));
    if (g.text) p.appendChild(el("p", null, g.text));
    v.appendChild(p);
    backBars(v, { heroes: [g.sitter.id, g.reader.kind === "hero" ? g.reader.id : null, ...ring], day: g.day, party: crewP && crewP.id, place: g.town });
  }).catch(() => fadedPage(v, "That reading has faded", "Only a fortnight of readings is kept, and the ones that came true.")));

  // a sitting at a town table; the pixel player (TablesReplay) draws it when loaded, otherwise the night is told in words
  A.route(/^\/table\/(\w+)$/, (v, id) => A.load(`game/${id}`).then((g) => kit("table").then(() => g)).then((g) => {
    const t = S.towns[g.town] || {};
    const title = `${(t.game || {}).name || "The tables"} in ${t.name || g.town}`;
    const p = el("section", { class: "panel" }, el("h2", null, title),
      el("p", { class: "small muted" }, A.heroLink(g.hero), g.nick ? ` (${g.nick})` : "", ` at ${g.dealer}'s table, ${A.when(g.day, "on")}. `,
        g.net > 0 ? `Won ${A.coins(g.net)}.` : g.net < 0 ? `Lost ${A.coins(-g.net)}.` : "Broke even."),
      (t.game || {}).rules ? el("p", { class: "small" }, el("b", null, "How it's played: "), t.game.rules) : null);
    if (window.TablesReplay) {
      try { stage(p, TablesReplay.player(g, { caption: true }), { share: () => `${title}\n${A.shareUrl("#/table/" + g.id)}`, shared: "The night and a link copied." }); } catch (e) { /* the words below still tell it */ }
    }
    p.appendChild(el("ol", { class: "small" }, g.rounds.map((r) => el("li", null, roundWords(g.game, r)))));
    v.appendChild(p);
    backBars(v, { heroes: [g.hero], day: g.day, place: g.town });
  }).catch(() => fadedPage(v, "That night at the tables has faded", "Only a fortnight of table nights is kept, and the ones that made the paper.")));

  // one round of a table sitting in words: what the pieces did, then what it paid
  const NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  function roundWords(game, r) {
    const s = r.show || {}, n = r.net !== undefined ? r.net : r.cheat ? (r.won ? 2 : -2) * r.stake : r.won ? r.stake : -r.stake;
    const odds = (o) => (o ? (o[0] === o[1] ? "evens" : `${o[0]}-${o[1]}`) : "");
    const plural = (k, f) => `${NUM[k] || k} ${f}${k === 1 ? "" : "s"}`;
    const what = r.cheat ? (r.caught ? "caught cheating" : "a quiet cheat")
      : game === "liars_dice" && s.bid ? `${s.called_by === "hero" ? "the table bid" : "bid"} ${plural(s.bid[0], s.bid[1])}, ${s.called_by === "hero" ? "called a liar" : "the table called"}; there were ${(s.mine || []).concat(s.theirs || []).filter((x) => x === s.bid[1]).length}`
      : game === "crown_anchor" && s.dice ? `on the ${s.pick}: ${s.dice.join(", ")}`
      : game === "pig_races" && s.order ? `#${s.backed}${s.odds ? ` at ${odds(s.odds[s.backed - 1])}` : ""}; #${s.order[0]} won`
      : game === "knucklebones" && s.mine ? `${s.mine.reduce((a, b) => a + b, 0)} against the house's ${(s.house || []).reduce((a, b) => a + b, 0)}`
      : game === "undertakers_lots" && s.roll ? `lot ${s.lot}, rolled ${s.roll[0] + s.roll[1]}`
      : game === "acorn_shells" && s.swaps ? `${plural(s.swaps.length, "swap")}, picked the ${["left", "middle", "right"][s.guess]} shell`
      : game === "toll_toss" && s.call ? `called ${s.call}, it landed ${s.landed}`
      : game === "candle_stakes" && s.burn ? `${plural(s.burn.length, "stub")}, ${s.burn[0] === Math.max(...s.burn) ? "the last flame" : "out early"}`
      : "";
    const paid = n > 0 ? `won ${A.coins(n)}` : n < 0 ? `lost ${A.coins(-n)}` : "the stake came back";
    return `${A.coins(r.stake)} staked${what ? `, ${what}` : ""}: ${paid}${s.again ? " (a second throw, by luck)" : ""}${r.caught ? "" : ""}.`;
  }

  // the hero as the replay draws them: with the afterglow they had at this moment of the fight (u.glowNow), whatever they wear today
  function heroOf(u) {
    const h = heroes[u.ref];
    if (!h || !h.look || u.glowNow === undefined || (h.look.afterglow || null) === (u.glowNow || null)) return h;
    const look = Object.assign({}, h.look);
    if (u.glowNow) look.afterglow = u.glowNow; else delete look.afterglow;
    return Object.assign({}, h, { look });
  }
  function unitGrid(u, frame) {
    if (u.kind === "traveller" && window.RoadArt) return RoadArt.fighter(u, frame);
    const look = u.look || {};
    // without the road art, a traveller who fights is drawn with the stat block's own sprite
    if (u.kind === "traveller" && look.monster && S.monsters[look.monster]) return Art.monsterGrid(S.monsters[look.monster], frame);
    if (u.kind === "hero" && heroes[u.ref]) return Art.heroGrid(heroOf(u), frame, A.heroLook(heroes[u.ref]));
    if (look.pet) return Art.petGrid({ kind: look.pet, name: u.name, coat: look.coat }, frame);
    const m = S.monsters[u.ref];
    if (m) return Art.monsterGrid(Art.withLook(Object.assign({}, m, { boss: u.boss }), look), frame);
    return Art.graveGrid();
  }

  // ---------- riders ----------
  // a hero in the saddle is one fighter: the mount at the vignettes' people scale and the rider seated on its back in the
  // riding pose (Art.heroSeated: the near thigh along the back, the shin and boot down the flank), all facing right (the
  // right-hand side mirrors the whole thing)
  const MOUNTED = true;
  const HIP = 26, riders = new Map(), backs = new Map();
  const mounted = (u) => MOUNTED && !!(u && u.mount && u.mount.kind && u.kind === "hero" && heroes[u.ref] && window.MountArt && MountArt.mountGrid);
  // the top of the back and the belly line below the seat, where the rider's boot hangs
  function backOf(m, key) {
    if (backs.has(key)) return backs.get(key);
    // the top of the back is the median top edge across the barrel, so a hump, a mane or a drifting mote can't lift the saddle
    const d = m.getContext("2d").getImageData(0, 0, m.width, m.height).data, ys = [], on = (x, y) => d[(y * m.width + x) * 4 + 3] > 200;
    for (let x = Math.round(m.width * 0.3); x <= Math.round(m.width * 0.5); x++) for (let y = 0; y < m.height; y++) if (on(x, y)) { ys.push(y); break; }
    ys.sort((a, b) => a - b);
    const back = ys.length ? ys[ys.length >> 1] : Math.round(m.height * 0.3);
    // the belly is the median bottom of the barrel between the legs (a column that runs to the ground is a leg)
    const bs = [];
    for (let x = Math.round(m.width * 0.25); x <= Math.round(m.width * 0.7); x++) {
      let y = 0;
      while (y < m.height && !on(x, y)) y++;
      while (y + 1 < m.height && on(x, y + 1)) y++;
      if (y > back && y < m.height - 3) bs.push(y);
    }
    bs.sort((a, b) => a - b);
    const r = { back, belly: bs.length ? bs[bs.length >> 1] : back + 8 };
    backs.set(key, r);
    return r;
  }
  function rider(u, frame) {
    const key = `${u.ref}|${u.mount.kind}|${u.mount.colour}|${frame}|${u.glowNow || ""}`;
    if (riders.has(key)) return riders.get(key);
    const m = MountArt.mountGrid(u.mount.kind, u.mount.colour, frame, "rider");
    const { back, belly } = backOf(m, u.mount.kind + "|" + u.mount.colour), sx = Math.round(m.width * 0.37);
    // the boot's sole hangs just above the belly line: longer legs down a horse's deep barrel, shorter on a donkey
    const sole = clamp(HIP + belly - back - 2, 33, 36), h = heroOf(u);
    const hero = (Art.heroSeated ? Art.heroSeated(h, frame, A.heroLook(h), sole) : unitGrid(u, frame)).toCanvas(1);
    const L = Math.max(0, 14 - sx), lift = Math.max(0, HIP - (back + 1));
    const cv = document.createElement("canvas");
    cv.width = Math.max(L + m.width, L + sx + 14); cv.height = m.height + lift;
    const c = cv.getContext("2d"), my = lift, seatY = my + back + 1;
    c.imageSmoothingEnabled = false;
    c.drawImage(m, L, my);
    c.drawImage(hero, L + sx - 14, seatY - HIP);
    Object.assign(cv, { seatX: L + sx, mountL: L, mountW: m.width, mountH: m.height });
    riders.set(key, cv);
    return cv;
  }
  function bounds(w, h, on) {
    let l = w, r = -1, top = h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) { if (x < l) l = x; if (x > r) r = x; if (y < top) top = y; }
    return { sw: r < l ? w : r - l + 1, sh: r < l ? h : h - top };
  }
  function measure(u) {
    if (mounted(u)) {
      const cv = rider(u, 0), d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      Object.assign(u, bounds(cv.width, cv.height, (x, y) => d[(y * cv.width + x) * 4 + 3] > 0));
      return;
    }
    u.mount = null;
    const g = unitGrid(u, 0);
    Object.assign(u, bounds(g.w, g.h, (x, y) => g.px[y * g.w + x]));
  }
  // how far apart two neighbours must stand: lookalikes may overlap a lot (the stagger keeps them readable), but a short
  // sprite next to a tall one is swallowed by any overlap, so the allowance shrinks with the square of the height ratio
  function need(a, b) {
    // a rider's mount is long and low, so beside it only a sliver may overlap or one mount reads as two heads on one horse
    const hr = Math.min(a.sh, b.sh) / Math.max(a.sh, b.sh), lap = a.mount || b.mount ? 0.3 : 0.7;
    return (a.sw + b.sw) / 2 - lap * Math.min(a.sw, b.sw) * hr * hr;
  }
  // two rows on the ground plane: the front rank meets the other side's in the middle, the back rank stands behind and
  // further out; a crowded side packs tighter rather than leaving the stage
  function layout(units) {
    for (const side of [0, 1]) {
      const mine = units.filter((u) => u && u.side === side);
      mine.forEach(measure);
      const front = mine.filter((u) => u.row === "front"), back = mine.filter((u) => u.row !== "front");
      const line = [...front, ...back];
      if (!line.length) continue;
      const step = clamp(120 / line.length, 17, 25);
      const gaps = line.slice(1).map((u, k) => Math.max(step, need(line[k], u) + 4));
      const lead = Math.max(15, line[0].sw / 2 + 5);
      const room = MID - 12 - lead - line[line.length - 1].sw / 2, sum = gaps.reduce((a, b) => a + b, 0);
      const k = sum > room ? room / sum : 1;
      let d = lead;
      line.forEach((u, n) => {
        if (n) d += gaps[n - 1] * k;
        const fr = u.row === "front", rank = fr ? front.indexOf(u) : back.indexOf(u);
        // the back rank stands a step further out than the front, so a tall front fighter never hides a back-rank head
        if (!fr && n && line[n - 1].row === "front") d += 8 * k;
        u.x = R(side === 0 ? MID - d : MID + d);
        u.y = (fr ? FRONT : BACK) - (rank % 2) * 6;
      });
    }
  }
  // the view: wide enough for everyone, the horizon in the top third, the ground plane below
  function camera(units) {
    const live = units.filter(Boolean);
    const lo = Math.min(...live.map((u) => u.x - u.sw / 2 - 14)), hi = Math.max(...live.map((u) => u.x + u.sw / 2 + 14));
    const vw = Math.min(W, Math.ceil(Math.max(224, hi - lo) / 16) * 16), vh = vw * 9 / 16;
    const feet = Math.max(...live.map((u) => u.y));
    return { vx: R(clamp((lo + hi) / 2 - vw / 2, 0, W - vw)), vy: R(clamp(feet + 26 - vh, 0, H - vh)), vw, vh };
  }

  // a crew is named for what its members are ("The Brine Hammers", "The Shadows of Veldrock"), so a plural head noun
  // takes a plural verb; a single word is a person's name however it ends
  const crewPlural = (l) => {
    const w = l.split(" of ")[0].trim().split(/\s+/), head = w[w.length - 1];
    return w.length > 1 && /[a-z]s$/i.test(head) && !/(ss|us|is|'s)$/i.test(head);
  };
  const isPlural = (l) => /^([2-9]|\d\d+)\s/.test(l) || / and /.test(l) || /^(Several|Many|A pack of) /.test(l) || crewPlural(l);
  const vb = (l, one, many) => `${l} ${isPlural(l) ? many : one}`;
  function describe(e, units, labels) {
    const n = (i) => (units[i] ? units[i].name : "?");
    const side = (k) => (labels && labels[k]) || (k === 0 ? "The heroes" : "The enemy");
    switch (e.fx) {
      case "start": return "The fight begins.";
      case "act": return `${n(e.a)} uses ${e.k}.`;
      case "hit": return `${n(e.a)} hits ${n(e.t)} for ${e.v}${e.st ? ` (${e.st})` : ""}.`;
      case "crit": return `CRITICAL! ${n(e.a)} hits ${n(e.t)} for ${e.v}.`;
      case "miss": return `${n(e.a)} misses ${n(e.t)}.`;
      case "heal": return e.t === e.a ? `${n(e.a)} patches up, recovering ${e.v}${e.k ? ` (${e.k})` : ""}.` : `${n(e.a)} heals ${n(e.t)} for ${e.v}${e.k ? ` (${e.k})` : ""}.`;
      case "guard": return `${n(e.a)}: ${e.k}. Come at me.`;
      case "buff": return e.card ? `${n(e.a)} turns ${e.k}.` : `${n(e.a)}: ${e.k}.`;
      case "rally": return e.v != null ? `${n(e.a)}: ${e.k}! Resolve +${e.v}.` : `${n(e.a)}: ${e.k}! ${lift(e)}.`;
      case "fear": return `${n(e.a)}: ${e.k}. Enemy resolve -${e.v}.`;
      case "debuff": {
        const t = [].concat(e.t == null ? [] : e.t);
        if (e.st === "cowering") return t.length ? `${n(e.a)}: ${e.k}. ${n(t[0])} cowers.` : `${n(e.a)}: ${e.k}. Nobody flinches.`;
        if (e.st === "shaken") return t.length ? `${n(e.a)}: ${e.k}. ${t.length === 1 ? n(t[0]) + " is" : t.length + " foes are"} shaken.` : `${n(e.a)}: ${e.k}. Nobody flinches.`;
        if (e.st === "parley") return `${n(e.a)}: ${e.k}. Nobody is listening.`;
        return `${n(e.a)}: ${e.k}.`;
      }
      case "parley": return `${n(e.a)}: ${e.k}. ${n(e.t)} stands down.`;
      case "stealth": return `${n(e.a)} vanishes into the shadows.`;
      case "summon": return `${n(e.a)} calls in ${e.new ? e.new.name : "help"}.`;
      case "tick": return `${n(e.a)} suffers ${e.v} from ${e.st}.`;
      case "surge": return `WILD SURGE! ${e.say || `${n(e.a)}'s magic goes sideways: ${e.k}.`}`;
      case "stunned": if (e.st === "goose") return `${n(e.a)} is a goose, and does nothing useful.`;
        if (e.st === "swapped") return `${n(e.a)} is on the wrong side of the field and loses a turn finding the way back.`;
        return e.st === "cowering" ? `${n(e.a)} cowers and does nothing.` : `${n(e.a)} is ${e.st === "charm" ? "charmed" : "stunned"} and does nothing.`;
      case "thorns": return `${n(e.t)} is hurt for ${e.v} by ${n(e.a)}'s spikes.`;
      case "down": return `${n(e.t)} goes down!`;
      case "rout": return vb(side(e.side), "breaks and runs!", "break and run!");
      case "surrender": return vb(side(e.side), "surrenders!", "surrender!");
      case "flee": return e.walk ? `${n(e.a)} walks off the field.` : e.bolt ? `${n(e.a)}, the last one standing, bolts!` : `${n(e.a)} escapes.`;
      case "carry": return `${n(e.a)} drags ${n(e.t)} out.`;
      case "end": return e.outcome === "stalemate" ? "Both sides back off." : "The fight is over.";
      default: return "";
    }
  }

  // what a rally gave its crew, in words
  const LIFT = { pow: "harder blows", acc: "steadier aim", arm: "thicker skin", crit: "sharper eyes", eva: "quicker feet", spd: "quicker feet" };
  function lift(e) {
    const bits = [...new Set((e.st || []).map((s) => LIFT[s]).filter(Boolean))];
    if (e.heals && e.heals.length) bits.push("a breath back");
    const s = bits.length > 1 ? bits.slice(0, -1).join(", ") + " and " + bits[bits.length - 1] : bits[0] || "a lift";
    return s[0].toUpperCase() + s.slice(1) + " for the crew";
  }

  // the moments worth telling a friend: first blood, the biggest hit, the save, who did the damage, how it ended
  function highlights(f, units) {
    const n = (i) => (units[i] ? units[i].name : "someone");
    const hp = units.map((u) => (u ? u.hp0 : 0)), lastHit = {}, downs = {};
    let first = null, big = null, save = null, carry = null, talk = null, misses = 0, swings = 0;
    for (const e of f.log) {
      if (e.fx === "miss") { misses++; swings++; }
      if (e.fx === "hit" || e.fx === "crit") {
        swings++;
        if (!first) first = e;
        if (!big || e.v > big.v) big = e;
        lastHit[e.t] = e.a;
        hp[e.t] = e.hp != null ? e.hp : Math.max(0, hp[e.t] - e.v);
      }
      if (e.fx === "thorns" || e.fx === "tick") { const t = e.fx === "tick" ? e.a : e.t; hp[t] = Math.max(0, hp[t] - e.v); }
      if (e.fx === "heal" && units[e.t]) {
        const before = hp[e.t], max = units[e.t].maxhp || 1;
        if (before / max < 0.35 && (!save || before / max < save.pct)) save = { e, before, pct: before / max };
        hp[e.t] = e.hp != null ? e.hp : hp[e.t] + e.v;
      }
      if (e.fx === "carry" && !carry) carry = e;
      if (e.fx === "parley" && !talk) talk = e;
      if (e.fx === "rally") for (const [i, , v] of e.heals || []) hp[i] = v;
      if (e.fx === "down" && lastHit[e.t] != null && units[lastHit[e.t]] && units[lastHit[e.t]].side !== (units[e.t] || {}).side) downs[lastHit[e.t]] = (downs[lastHit[e.t]] || 0) + 1;
    }
    const out = [];
    if (first) out.push(["First blood", `${n(first.a)} hits ${n(first.t)} for ${first.v}.`]);
    if (big && big !== first) out.push(["Biggest hit", `${n(big.a)}, ${big.v} on ${n(big.t)}${big.fx === "crit" ? ", a critical" : ""}.`]);
    else if (big && big.fx === "crit") out.push(["Biggest hit", `That first one, and a critical too.`]);
    if (save) out.push(["The save", `${n(save.e.a)} ${save.e.t === save.e.a ? "patches up" : "heals " + n(save.e.t)} at ${save.before} hp, for ${save.e.v}${save.e.k ? ` (${save.e.k})` : ""}.`]);
    else if (carry) out.push(["The save", `${n(carry.a)} drags ${n(carry.t)} out of it.`]);
    if (talk) out.push(["The talk", `${n(talk.a)} talks ${n(talk.t)} out of the fight.`]);
    const top = Object.entries(downs).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) out.push(["Most takedowns", `${n(+top[0])}, ${top[1]}.`]);
    out.push(["How it ended", `${outcomeText(f)} after ${f.rounds} round${f.rounds === 1 ? "" : "s"}.`]);
    if (swings >= 8 && misses / swings > 0.6) out.push(["Also", `${misses} of ${swings} swings missed. Nobody is proud of that.`]);
    return out;
  }

  // ---------- stand-ins for FightFX, while the effects library is missing ----------
  const GL = { A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100",
    G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
    M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100", Q: "010101101110011", R: "110101110101101",
    S: "011100010001110", T: "111010010010010", U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
    Y: "101101010010010", Z: "111001010100111", 0: "111101101101111", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110",
    4: "101101111001001", 5: "111100110001110", 6: "011100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001110",
    "!": "010010010000010", "+": "000010111010000", "-": "000000111000000", " ": "000000000000000", ">": "100010001010100", ".": "000000000000010",
    ":": "000010000010000", "'": "010010000000000", ",": "000000000010100", "%": "101001010100101", "/": "001001010100100", x: "000101010101000" };
  function pxText(ctx, str, x, y, col, sc, ol, align) {
    if (realFX()) return FightFX.text(ctx, str, x, y, col, sc, ol, align);
    const s = String(str).toUpperCase().replace(/[^A-Z0-9!+\-> .:',%/]/g, " ");
    sc = sc || 1;
    const w = s.length * 4 * sc - sc;
    x = R(align === "left" ? x : align === "right" ? x - w : x - w / 2); y = R(y);
    for (const pass of ol === false ? [1] : [0, 1]) {
      ctx.fillStyle = pass ? col : (typeof ol === "string" ? ol : "#120c18");
      for (let i = 0; i < s.length; i++) {
        const g = GL[s[i]] || GL[" "];
        for (let k = 0; k < 15; k++) if (g[k] === "1") {
          const px = x + (i * 4 + (k % 3)) * sc, py = y + Math.floor(k / 3) * sc;
          if (pass) ctx.fillRect(px, py, sc, sc); else ctx.fillRect(px - 1, py - 1, sc + 2, sc + 2);
        }
      }
    }
  }
  const COL = { physical: ["#f6efe0", "#ffffff", "#a89880"], blade: ["#e8eef6", "#ffffff", "#8a98aa"], flame: ["#ff8a2a", "#ffe08a", "#c8401e"], frost: ["#8ad0f4", "#eaf8ff", "#4a8ac8"],
    storm: ["#c8b4ff", "#ffffff", "#6a5ad8"], arcane: ["#c88aff", "#f4e0ff", "#7a3ac8"], holy: ["#ffe27a", "#ffffff", "#c89a2a"], healing: ["#8ae08a", "#e8ffe0", "#3a9a4a"],
    shadow: ["#8a6aa8", "#d0b8e8", "#3a2a4a"], death: ["#9ae0b0", "#e0fff0", "#3a5a48"], poison: ["#9ad84a", "#e8ffb0", "#4a7a2a"], wild: ["#8ad06a", "#e0ffc8", "#3a7a3a"],
    marksman: ["#f0e0b0", "#ffffff", "#8a6a3a"], fury: ["#ff6a4a", "#ffd0a0", "#a82a1a"], song: ["#ffb0d8", "#ffffff", "#b85a8a"] };
  const colOf = (p) => COL[(p && p.school) || "physical"] || COL.physical;
  const chestOf = (p) => (realFX() ? FightFX.chest(p) : { x: p.x, y: p.y - (p.h || 30) * 0.55 });
  function hashRng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s ^ (s << 13)) >>> 0, s = (s ^ (s >>> 17)) >>> 0, s = (s ^ (s << 5)) >>> 0) / 4294967296); }
  const FB = {
    sparks(ctx, x, y, t, o) {
      if (t < 0 || t > 0.45) return;
      const rnd = hashRng(o.seed || 1), n = o.crit ? 14 : 8, c = colOf(o);
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2, sp = (o.crit ? 70 : 45) * (0.5 + rnd());
        const px = x + Math.cos(a) * sp * t, py = y + Math.sin(a) * sp * t + 60 * t * t;
        ctx.fillStyle = k % 3 ? c[1] : c[0]; ctx.fillRect(R(px), R(py), t < 0.12 ? 2 : 1, 1);
      }
      if (t < 0.1) { ctx.fillStyle = "#ffffff"; const s = o.crit ? 4 : 2; ctx.fillRect(R(x - s), R(y), s * 2 + 1, 1); ctx.fillRect(R(x), R(y - s), 1, s * 2 + 1); }
    },
    number(ctx, style, text, x, y, t) {
      const life = style === "crit" ? 1.4 : 1.1;
      if (t < 0 || t > life) return false;
      const col = { crit: "#ffd84a", heal: "#7ad08a", miss: "#c8bca8", burn: "#ff8a2a", poison: "#9ad84a", tick: "#e2645c", block: "#9ab8ff" }[style] || "#f6ebd0";
      const pop = t < 0.08 ? 1.6 - t * 5 : 1, sc = style === "crit" ? 2 : style === "miss" ? 1 : 2;
      ctx.globalAlpha = clamp((life - t) * 4, 0, 1);
      pxText(ctx, text, x, y - 8 * ease(t / 0.6) - (pop - 1) * 6, col, Math.max(1, R(sc * pop)), "#120c18");
      ctx.globalAlpha = 1;
      return true;
    },
    stamp(ctx, kind, x, y, t, text) {
      const life = kind === "ko" ? 1.6 : 1.1;
      if (t < 0 || t > life) return false;
      const s = kind === "status" ? text : kind.toUpperCase(), sc = kind === "status" ? 2 : 4, slam = t < 0.1 ? 1 + (0.1 - t) * 8 : 1;
      const w = (s.length * 4 * sc) * slam + 8, h = 5 * sc * slam + 8;
      ctx.globalAlpha = clamp((life - t) * 3, 0, 1);
      ctx.fillStyle = "rgba(30,16,14,0.88)"; ctx.fillRect(R(x - w / 2), R(y - h / 2), R(w), R(h));
      ctx.strokeStyle = kind === "ko" ? "#ff5a3c" : "#ffd84a"; ctx.lineWidth = 2; ctx.strokeRect(R(x - w / 2) + 1, R(y - h / 2) + 1, R(w) - 2, R(h) - 2);
      pxText(ctx, s, x, y - 5 * sc * slam / 2, kind === "ko" ? "#ff5a3c" : "#ffd84a", R(sc * slam), "#120c18");
      ctx.globalAlpha = 1;
      return true;
    },
    ring(ctx, x, y, r, t, p, mode) {
      const c = colOf(p);
      ctx.strokeStyle = c[0]; ctx.lineWidth = 1;
      if (mode === "tell") { ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 20); ctx.beginPath(); ctx.ellipse(x, y, r, r * FLAT, 0, 0, Math.PI * 2); ctx.stroke(); }
      else if (t >= 0 && t < 0.6) { ctx.globalAlpha = 1 - t / 0.6; const rr = r * (0.6 + t); ctx.beginPath(); ctx.ellipse(x, y, rr, rr * FLAT, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
    },
    shake(t, power, seed) { if (t < 0 || t > 0.25 * power) return [0, 0]; const a = (1 - t / (0.25 * power)) * power * 1.5, r = hashRng(seed + R(t * 60)); return [R((r() - 0.5) * 2 * a), R((r() - 0.5) * 2 * a)]; },
    flash(ctx, w, h, t, s) { if (t < 0 || t > 0.05) return; ctx.globalAlpha = 0.55 * (s || 1); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; },
    play(ctx, fam, p, from, to, t, layer, tm) {
      const list = to.length ? to : [from], c = colOf(p), I = tm.impact, fc = chestOf(from);
      if (layer === "floor") {
        if ((fam === "nova" || fam === "smash" && p.shape !== "hammer") && t > I - 0.3) for (const q of list) this.ring(ctx, q.x, q.y, fam === "nova" ? 22 : 12, t - I, p, t < I ? "tell" : "hit");
        if (fam === "heal" && t > I - 0.2 && t < I + 0.6) for (const q of list) { ctx.globalAlpha = 0.6 * (1 - Math.abs(t - I) / 0.6); ctx.strokeStyle = c[0]; ctx.beginPath(); ctx.ellipse(q.x, q.y, 10, 3, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
        return t < tm.dur;
      }
      list.forEach((q, k) => {
        const it = tm.impacts[k] != null ? tm.impacts[k] : I, tc = chestOf(q), dir = Math.sign(tc.x - fc.x) || 1;
        if (fam === "arrow" || fam === "bolt") {
          const fly = Math.max(0.12, Math.abs(tc.x - fc.x) / (fam === "arrow" ? 260 : 190)), s = (t - (it - fly)) / fly;
          if (s >= 0 && s <= 1) {
            const lob = fam === "arrow" ? 14 * (p.arc != null ? p.arc + 0.3 : 1) : 6;
            const P = (u) => [fc.x + (tc.x - fc.x) * u, fc.y + (tc.y - fc.y) * u - lob * 4 * u * (1 - u)];
            const [x, y] = P(s), [x2, y2] = P(Math.max(0, s - 0.08));
            if (fam === "arrow") { ctx.strokeStyle = "#6a4a2a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = "#e8e8f0"; ctx.fillRect(R(x), R(y), 1, 1); }
            else for (let j = 0; j < 7; j++) { const [jx, jy] = P(Math.max(0, s - j * 0.03)); ctx.fillStyle = j ? (j < 3 ? c[0] : c[2]) : c[1]; const r = j < 2 ? 2 : 1; ctx.fillRect(R(jx - r / 2), R(jy - r / 2), r, r); }
          }
        } else if (fam === "beam") {
          if (t > it - 0.1 && t < it + 0.35) { ctx.strokeStyle = c[1]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fc.x, fc.y); for (let j = 1; j <= 6; j++) ctx.lineTo(fc.x + (tc.x - fc.x) * j / 6 + (j < 6 ? Math.sin(t * 60 + j) * 2 : 0), fc.y + (tc.y - fc.y) * j / 6 + (j < 6 ? Math.cos(t * 50 + j * 2) * 3 : 0)); ctx.stroke(); ctx.strokeStyle = c[0]; ctx.lineWidth = 1; ctx.stroke(); }
        } else if (fam === "heal" || fam === "buff") {
          if (t > it - 0.2 && t < it + 0.7) for (let j = 0; j < 6; j++) { const u = clamp((t - it + 0.2 + j * 0.05) / 0.8, 0, 1); ctx.globalAlpha = 1 - u; ctx.fillStyle = j % 2 ? c[1] : c[0]; ctx.fillRect(R(q.x - 8 + j * 3), R(q.y - 4 - u * 26 - (j % 3) * 4), 1, fam === "buff" ? 2 : 1); }
          ctx.globalAlpha = 1;
        } else if (fam === "curse") {
          if (t > it - 0.15 && t < it + 0.5) { ctx.globalAlpha = 1 - clamp((t - it) / 0.5, 0, 1); ctx.strokeStyle = c[0]; ctx.beginPath(); ctx.arc(tc.x, tc.y - 4, 5 + (t - it) * 10, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
        } else if (fam === "summon") {
          if (t > it - 0.3 && t < it + 0.4) for (let j = 0; j < 10; j++) { const a = j * 0.63, r = 4 + (t - it + 0.3) * 20; ctx.fillStyle = "#d8d0c4"; ctx.globalAlpha = 0.7; ctx.fillRect(R(q.x + Math.cos(a) * r), R(q.y - 6 + Math.sin(a) * r * 0.5), 2, 2); ctx.globalAlpha = 1; }
        } else if (fam === "guard") {
          if (t > it - 0.1 && t < it + 0.5) { ctx.globalAlpha = 0.8 * (1 - clamp((t - it) / 0.5, 0, 1)); ctx.fillStyle = c[0]; const d = from.side ? -1 : 1; ctx.fillRect(R(from.x + d * 9), R(from.y - 24), 2, 18); ctx.globalAlpha = 1; }
        } else if (fam === "nova") {
          if (t > it && t < it + 0.4) { const u = (t - it) / 0.4; ctx.globalAlpha = 1 - u; ctx.fillStyle = c[1]; for (let j = 0; j < 12; j++) { const a = j * 0.52; ctx.fillRect(R(tc.x + Math.cos(a) * u * 16), R(tc.y + Math.sin(a) * u * 8), 2, 2); } ctx.globalAlpha = 1; }
        } else if (t > it && t < it + 0.22) {
          // melee: a crescent smear across the target
          const u = (t - it) / 0.22, r = fam === "smash" ? 10 : 12;
          ctx.globalAlpha = 1 - u; ctx.strokeStyle = c[1]; ctx.lineWidth = fam === "smash" ? 3 : 2; ctx.beginPath();
          if (fam === "thrust") { ctx.moveTo(tc.x - dir * 14, tc.y); ctx.lineTo(tc.x + dir * (6 + u * 10), tc.y); }
          else ctx.arc(tc.x - dir * 4, tc.y, r, dir > 0 ? -1.2 + u * 0.4 : Math.PI - 0.8 - u * 0.4, dir > 0 ? 1.0 + u * 0.4 : Math.PI + 1.2 + u * 0.4);
          ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
        }
      });
      return t < tm.dur;
    },
    pose(fam, p, role, t, from, to, i, tm) {
      const o = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, white: 0, alpha: 1 };
      const list = Array.isArray(to) ? to : [to], q = list[i || 0] || list[0] || from, dir = Math.sign(q.x - from.x) || (from.side ? -1 : 1);
      const I = (tm.impacts && tm.impacts[i || 0]) || tm.impact, wu = Math.min(tm.windup || 0.15, I * 0.6);
      if (role === "actor") {
        const melee = fam === "slash" || fam === "thrust" || fam === "smash";
        const reach = melee ? Math.max(0, Math.abs(q.x - from.x) - 14) : 0;
        if (t < 0 || t > tm.dur) return o;
        if (t < wu) { const k = t / wu; o.sx = 1 + 0.16 * k; o.sy = 1 - 0.14 * k; o.dx = -4 * dir * k; }
        else if (t < I) { const k = (t - wu) / Math.max(0.01, I - wu); o.dx = -4 * dir + (reach + 4) * dir * k * k; o.sx = melee ? 1.1 : 0.94; o.sy = melee ? 0.92 : 1.06; if (fam === "smash") o.dy = -6 * Math.sin(k * Math.PI); }
        else { const k = clamp((t - I) / Math.max(0.05, tm.dur - I), 0, 1); o.dx = (reach - 3) * dir * (1 - ease(k)); o.sx = 1 - 0.06 * (1 - k); o.sy = 1 + 0.06 * (1 - k); }
        return o;
      }
      if (t < I) return o;
      const a = t - I, kb = (p.crit ? 9 : 5) * Math.exp(-a * 9) * (1 - Math.exp(-a * 40));
      o.dx = dir * kb; o.rot = dir * 0.12 * Math.exp(-a * 7) * Math.sin(a * 30); o.white = a < 0.07 ? 1 : 0;
      return o;
    },
  };
  const FXL = () => (realFX() ? FightFX : FB);

  function replayPage(v, f) {
    const units = f.lineup.map((u) => Object.assign({}, u, { hp0: u.hp }));
    for (const e of f.log) if (e.fx === "summon" && e.new) units[e.new.i] = Object.assign({}, e.new, { summoned: true, hp0: e.new.hp });
    layout(units);
    const cam = camera(units);
    const label = (s) => (f.labels && f.labels[s]) || (s === 0 ? "Heroes" : "Foes");
    const heroIds = f.heroes || [];
    // a mount's own trick (the kelpie's lure, the stag's path, the eagle's stoop...) starts at the mount's head, not the rider
    const pos = (i, b) => {
      const u = units[i] || {};
      if (b && u.mount && /^mount:/.test((b.look && b.look.key) || "")) {
        const cv = rider(u, 0), fd = u.side ? -1 : 1, hx = cv.mountL + cv.mountW * 0.82 - cv.width / 2;
        return { x: R(u.x + fd * hx), y: u.y, h: R(cv.mountH * 0.85), side: u.side };
      }
      return { x: u.x, y: u.y, h: u.sh || 30, side: u.side };
    };
    if (window.FightFX) FightFX.config({ flat: FLAT, scale: 1 });
    const P = FightDirector.plan(f, units, { S, heroes, pos, mounted: MOUNTED });
    // afterglows as they stood that day: one from before the fight shows from the start, one this fight's own surge left shows from
    // the moment it went off (unitGrid draws u.glowNow)
    for (const q of units) if (q && q.kind === "hero" && heroes[q.ref]) { const g = heroes[q.ref].afterglow; q.glowBase = g && g.from < f.day ? g.id : null; q.glowNow = q.glowBase; }
    f.log.forEach((e, k) => { if (e.fx === "surge" && e.g && units[e.g[0]]) Object.assign(units[e.g[0]], { glowAt: P.events[k], glowId: e.g[1] }); });
    const glowAt = (t) => { for (const q of units) if (q && q.glowAt != null) q.glowNow = t >= q.glowAt ? q.glowId : q.glowBase; };
    const calm = (window.FightFX && FightFX.reduced && FightFX.reduced()) || (window.Settings ? Settings.reduced() : !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches));

    // every fighter gets a mark: numbers for the left side, letters for the right, the same on the stage and in the list
    const marks = {};
    for (const s of [0, 1]) units.filter((u) => u && u.side === s).forEach((u, k) => (marks[u.i] = s === 0 ? String(k + 1) : String.fromCharCode(65 + (k % 26))));
    v.appendChild(el("h1", null, f.title || `${label(0)} vs ${label(1)}`));
    v.appendChild(el("p", { class: "muted" }, `${A.when(f.day)} · ${f.place_name} · ${f.rounds} round${f.rounds === 1 ? "" : "s"} · `,
      el("b", { class: "gold" }, outcomeText(f)), " · ", heroIds.filter((h) => heroes[h]).map((h, i) => [i ? ", " : "", A.heroLink(h)])));
    const PX = Math.max(3, R(1200 / cam.vw));
    const cv = el("canvas", { class: "stage", width: cam.vw * PX, height: cam.vh * PX });
    const box = el("div", { class: "replay-shot" }, cv);
    fitScreen(box, cv);
    const logBox = el("div", { class: "rlog" });
    const lines = f.log.map((e, i) => el("div", { "data-i": i }, describe(e, units, f.labels)));
    lines.forEach((l) => logBox.appendChild(l));
    const hl = highlights(f, units);
    let speed = 1, playing = true, T = 0, visible = true;
    const ctl = {
      get t() { return T; }, get dur() { return P.total; }, get playing() { return playing; },
      play() { playing = true; if (T >= P.total) { T = 0; lastT = -1; } kick(); },
      pause() { playing = false; },
      restart() { T = 0; lastT = -1; playing = true; kick(); },
      skip() { T = P.total; lastT = -1; playing = false; draw(T); },
      rate(s) { speed = s; },
    };
    const shareText = () => [`${f.title}: ${outcomeText(f)}`, ...hl.filter(([k]) => k !== "How it ended" && k !== "Also").map(([k, x]) => `${k}: ${x}`), A.shareUrl("#/fight/" + f.id)].join("\n");
    const ctrls = controls(ctl, { share: shareText, shared: "Fight and highlights copied." });

    const rows = {};
    const sideList = (s) => el("div", { class: "fside s" + s }, el("div", { class: "fside-name" }, A.cap(label(s))),
      units.filter((u) => u && u.side === s).map((u) => {
        const fill = el("i"), num = el("span", { class: "fhp" }), row = el("div", { class: "fighter", hidden: !!u.summoned },
          el("span", { class: "fmark s" + s }, marks[u.i]), u.kind === "hero" && heroes[u.ref] ? A.heroLink(u.ref) : el("span", { title: u.name }, u.summoned ? summonName(u.name) : u.name, u.kind === "traveller" ? el("span", { class: "dim" }, " · traveller") : null),
          el("div", { class: "fbar" }, fill), num);
        rows[u.i] = { row, fill, num, key: "" };
        return row;
      }));
    const roster = el("div", { class: "fighters" }, sideList(0), sideList(1));
    const hlBox = el("section", { class: "panel highlights" }, el("h3", null, "Highlights"),
      el("dl", { class: "kv hl" }, hl.map(([k, x]) => [el("dt", null, k), el("dd", null, x)])));
    v.appendChild(el("div", { class: "fight-stage" }, box, ctrls, roster));
    v.appendChild(hlBox);
    v.appendChild(el("details", { class: "panel blow" }, el("summary", null, el("h3", null, "Blow by blow")), logBox));

    const bg = window.Battlefield ? Battlefield.backdrop(f) : Scenes.backdrop("plains", W, H, Art.hash(f.id), { battle: true });
    const floorTint = (bg.setting && bg.setting.floor) || "#7a6a50";
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const o = off.getContext("2d");
    o.imageSmoothingEnabled = false;

    // ---------- sprites ----------
    const sprites = new Map(), whites = new Map();
    const mirror = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.translate(img.width, 0); x.scale(-1, 1); x.drawImage(img, 0, 0); return c; };
    // what a fighter looks like: a rider and mount together (part "all"), or, once the rider is thrown, the hero alone
    // ("foot") and the mount alone ("mount"); `away` turns them to run for their own side's edge
    function sprite(u, frame, part, away) {
      part = u.mount ? part || "all" : "foot";
      const key = `${u.i}:${frame}:${part}:${away ? 1 : 0}:${u.glowNow || ""}`;
      if (!sprites.has(key)) {
        let img;
        if (part === "foot") { let g = unitGrid(u, frame); if ((u.side === 1) !== !!away) g = g.flipX(); img = g.toCanvas(1); }
        else {
          img = part === "all" ? rider(u, frame) : MountArt.mountGrid(u.mount.kind, u.mount.colour, frame, "rider");
          if ((u.side === 1) !== !!away) img = mirror(img);
        }
        sprites.set(key, img);
      }
      return sprites.get(key);
    }
    // where the saddle is, from the middle of the rider sprite
    const seatDx = (u) => { const cv = rider(u, 0); return (cv.seatX - cv.width / 2) * (u.side ? -1 : 1); };
    function flat(img, col) {
      if (realFX()) return FightFX.silhouette(img, col);
      const key = img; let m = whites.get(key);
      if (!m) { m = {}; whites.set(key, m); }
      if (!m[col]) { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); m[col] = c; }
      return m[col];
    }

    // ---------- the fight's state at time T ----------
    function stateAt(t) {
      const st = units.map((u) => u && { hp: u.hp0, down: null, fled: null, shown: u.summoned ? null : -1, ghost: false, hitT: -9, before: u.hp0,
        shaken: 0, cower: 0, fearT: -9, glow: 0, glowSt: null, glowT: -9, walk: false });
      let res = [100, 100], li = -1, round = 1;
      f.log.forEach((e, k) => {
        if (P.events[k] > t) return;
        li = Math.max(li, k);
        if (e.r) round = Math.max(1, e.r);
        if (e.res) res = e.res.map((x) => Math.min(x, 160));
        const U = (i) => st[i] || {};
        switch (e.fx) {
          case "hit": case "crit": case "thorns": { const u = U(e.t); u.before = u.hp; u.hitT = P.events[k]; u.hp = e.hp != null ? e.hp : Math.max(0, u.hp - e.v); break; }
          case "tick": { const u = U(e.a); u.before = u.hp; u.hitT = P.events[k]; u.hp = Math.max(0, u.hp - e.v); break; }
          case "heal": U(e.t).hp = e.hp != null ? e.hp : U(e.t).hp + e.v; break;
          case "down": U(e.t).down = P.events[k]; break;
          case "flee": U(e.a).fled = P.events[k]; U(e.a).walk = !!e.walk; U(e.a).bolt = !!e.bolt; break;
          // a scare lasts a few rounds, and so does a rally's lift; the log says how many
          case "debuff":
            if (e.st === "shaken" || e.st === "cowering") for (const i of [].concat(e.t == null ? [] : e.t)) {
              const u = U(i), until = round + (e.d || 2);
              if (e.st === "shaken") u.shaken = Math.max(u.shaken, until); else u.cower = Math.max(u.cower, until);
              u.fearT = P.events[k];
            }
            break;
          case "rally":
            for (const i of [].concat(e.t == null ? [] : e.t)) { const u = U(i); u.glow = round + (e.d || 2); u.glowSt = (e.st || [])[0] || "heal"; u.glowT = P.events[k]; }
            for (const [i, , v] of e.heals || []) U(i).hp = v;
            break;
          case "summon": if (e.new) U(e.new.i).shown = P.events[k]; break;
          case "stealth": U(e.a).ghost = true; break;
          case "act": U(e.a).ghost = false; break;
        }
      });
      return { st, res, li, round };
    }

    // ---------- what is moving right now ----------
    const slotAt = (t) => { let s = P.slots[0]; for (const x of P.slots) if (x.t0 <= t) s = x; return s; };
    function active(t) {
      const out = [];
      for (const s of P.slots) {
        if (!s.members.length || t < s.t0 - 0.01 || t > s.t0 + s.len + 0.6) continue;
        for (const m of s.members) {
          const b = m.b;
          if (b.kind !== "act" || !b.time) continue;
          const tau = FightDirector.tauAt(m.knots, t - s.t0);
          if (tau < -0.02 || tau > b.time.dur + 0.05) continue;
          out.push({ s, m, b, tau });
        }
      }
      return out;
    }
    // one params object and one point list per beat, so FightFX's setup cache holds between frames
    const params = (b, variant) => {
      const key = "_p" + (variant || "");
      if (!b[key]) {
        const allMiss = b.whiff || b.hits.length && b.hits.every((li) => f.log[li].fx === "miss");
        b[key] = Object.assign({}, b.look.params, { crit: variant === "crit" || (!variant && b.crit), miss: variant === "miss" || (!variant && !!allMiss), seed: b.ev[0] || 0 });
      }
      return b[key];
    };
    const pts = (b) => b._to || (b._to = (b.to.length ? b.to : [b.a]).map(pos));
    const toArg = (b) => { const t = pts(b); return realFX() && t.length === 1 ? t[0] : t; };

    function posesAt(acts, now) {
      const pose = {};
      const put = (i, p) => {
        const q = pose[i] || { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, white: 0, alpha: 1, tint: null, tintAmt: 0, ghosts: [] };
        q.dx += p.dx || 0; q.dy += p.dy || 0; q.sx *= p.sx || 1; q.sy *= p.sy || 1; q.rot += p.rot || 0; q.white = Math.max(q.white, p.white || 0);
        q.alpha = Math.min(q.alpha, p.alpha == null ? 1 : p.alpha);
        if (p.tint && (p.tintAmt || 0) > q.tintAmt) { q.tint = p.tint; q.tintAmt = p.tintAmt; }
        pose[i] = q; return q;
      };
      for (const x of acts) {
        const b = x.b, fam = b.look.family, pr = params(b), to = pts(b);
        const ap = realFX() ? FightFX.pose(fam, pr, "actor", x.tau, b.from, toArg(b), 0) : FB.pose(fam, pr, "actor", x.tau, b.from, to, 0, b.time);
        const q = put(b.a, ap);
        // a smear: ghosts where the lunge was a moment ago
        if (!calm && x.s.kind !== "merge") {
          for (const back of [0.03, 0.06]) {
            const pp = realFX() ? FightFX.pose(fam, pr, "actor", x.tau - back, b.from, toArg(b), 0) : FB.pose(fam, pr, "actor", x.tau - back, b.from, to, 0, b.time);
            if (Math.abs((pp.dx || 0) - (ap.dx || 0)) > 3) q.ghosts.push({ dx: pp.dx || 0, dy: pp.dy || 0, a: back < 0.05 ? 0.4 : 0.22 });
          }
        }
        const seen = new Set();
        b.to.forEach((t, k) => {
          if (t === b.a || seen.has(t)) return;
          seen.add(t);
          const li = b.hits[k], e = li != null ? f.log[li] : null;
          const variant = e && e.fx === "crit" ? "crit" : b.whiff || e && e.fx === "miss" ? "miss" : "hit";
          if (realFX()) {
            // the white flash is two real frames from the blow, not the whole hit-stop, or it hides the smear and sparks
            const tp = FightFX.pose(fam, params(b, variant), "target", x.tau, b.from, toArg(b), k);
            const hitT = x.s.t0 + FightDirector.uAt(x.m.knots, b.time.impacts[k] != null ? b.time.impacts[k] : b.time.impact), age = now - hitT;
            put(t, Object.assign({}, tp, { white: !calm && tp.white > 0 && age >= 0 && age < (2 / 60) * speed ? 1 : 0 }));
            return;
          }
          if (e && e.fx === "heal") return;
          if (e && e.fx === "miss") {
            const it = b.time.impacts[k] || b.time.impact, a = x.tau - it + 0.12;
            if (a > 0 && a < 0.5) put(t, { dx: -Math.sign(b.from.x - units[t].x || 1) * -6 * Math.sin(Math.PI * a / 0.5), dy: -2 * Math.sin(Math.PI * a / 0.5) });
            return;
          }
          if (!e && fam !== "curse") return;
          const tp = FB.pose(fam, params(b, variant), "target", x.tau, b.from, to, k, b.time);
          put(t, calm ? Object.assign({}, tp, { white: 0 }) : tp);
        });
      }
      return pose;
    }

    // ---------- floor decals ----------
    const floor = realFX() ? FightFX.floor(W, H) : null, fbMarks = [];
    const extra = [];
    for (const im of P.impacts) {
      const u = units[im.t];
      if (!u || !im.b) continue;
      const fam = im.b.look.family, sch = (im.b.look.params || {}).school;
      if (im.kind === "down") extra.push({ kind: "skid", x: u.x + (u.side ? 6 : -6), y: u.y, T: im.T + 0.2, opts: { flip: u.side === 0, seed: im.li } });
      if (realFX()) continue;
      if (im.kind === "crit" || im.heavy && fam === "smash") extra.push({ kind: "crack", x: u.x, y: u.y + 1, T: im.T, opts: { seed: im.li } });
      if (im.kind === "miss" && fam === "arrow") extra.push({ kind: "stub", x: u.x + (u.side ? 10 : -10), y: u.y + 3, T: im.T + 0.05, opts: { seed: im.li } });
      if ((im.kind === "hit" || im.kind === "crit") && sch === "flame") extra.push({ kind: "scorch", x: u.x, y: u.y + 1, T: im.T, opts: { seed: im.li } });
      if ((im.kind === "hit" || im.kind === "crit") && sch === "frost") extra.push({ kind: "frost", x: u.x, y: u.y + 1, T: im.T, opts: { seed: im.li } });
    }
    for (const s of P.slots) for (const m of s.members) if (m.b.aoe && m.b.to.length > 1 && !m.b.ranged) {
      const xs = m.b.to.map((i) => units[i].x), ys = m.b.to.map((i) => units[i].y);
      extra.push({ kind: "scuff", x: R((Math.min(...xs) + Math.max(...xs)) / 2), y: R(ys.reduce((a, b) => a + b, 0) / ys.length) + 2, T: s.t0 + FightDirector.uAt(m.knots, m.b.time.impact), opts: { size: 1 + (Math.max(...xs) - Math.min(...xs)) / 40, seed: m.b.ev[0] } });
    }
    const allMarks = P.marks.concat(extra).sort((a, b) => a.T - b.T);
    let floorN = 0, floorT = -1;
    function drawFloor(t) {
      if (t < floorT) { floorN = 0; if (floor) floor.clear(); fbMarks.length = 0; }
      floorT = t;
      while (floorN < allMarks.length && allMarks[floorN].T <= t) {
        const mk = allMarks[floorN++];
        if (floor) floor.add(mk.kind, mk.x, mk.y, mk.opts || {}, mk.T); else fbMarks.push(mk);
      }
      if (floor) { floor.draw(o, t); return; }
      for (const mk of fbMarks) drawDecal(o, mk, t);
    }
    function drawDecal(c, mk, t) {
      const rnd = hashRng((mk.opts && mk.opts.seed) || 7), x = mk.x, y = mk.y;
      c.fillStyle = "rgba(40,28,20,0.28)";
      if (mk.kind === "crack") { for (let k = 0; k < 5; k++) { const a = rnd() * Math.PI * 2; let px = x, py = y; c.fillStyle = "rgba(50,36,26,0.7)"; for (let j = 0; j < 6; j++) { px += Math.cos(a) * 1.4; py += Math.sin(a) * 1.4 * FLAT; c.fillRect(R(px), R(py), 1, 1); } } }
      else if (mk.kind === "scorch") { for (let k = 0; k < 8; k++) { const a = rnd() * 6.28, r = rnd() * 8; c.fillStyle = "rgba(40,24,16,0.25)"; c.fillRect(R(x + Math.cos(a) * r - 2), R(y + Math.sin(a) * r * FLAT), 4, 1); } if (t - mk.T < 1.2) { c.fillStyle = "#ff9a3a"; c.fillRect(R(x + rnd() * 6 - 3), R(y), 1, 1); } }
      else if (mk.kind === "frost") { c.fillStyle = "rgba(220,240,255,0.55)"; for (let k = 0; k < 7; k++) c.fillRect(R(x - 8 + rnd() * 16), R(y - 1 + rnd() * 3), 2, 1); }
      else if (mk.kind === "stub") { c.strokeStyle = "#5c3e22"; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (mk.opts.seed % 2 ? 3 : -3), y - 5); c.stroke(); c.fillStyle = "#e6e2d6"; c.fillRect(x + (mk.opts.seed % 2 ? 3 : -4), y - 6, 2, 1); }
      else if (mk.kind === "skid") { c.fillStyle = "rgba(60,44,30,0.35)"; const d = mk.opts.flip ? -1 : 1; c.fillRect(R(Math.min(x, x + d * 14)), y - 1, 14, 1); c.fillRect(R(Math.min(x, x + d * 12)), y + 1, 12, 1); }
      else if (mk.kind === "scuff") { c.strokeStyle = "rgba(70,54,40,0.45)"; c.setLineDash([3, 4]); c.beginPath(); c.ellipse(x, y, 20 * (mk.opts.size || 1), 20 * (mk.opts.size || 1) * FLAT, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
    }

    // ---------- the bust for a cut-in ----------
    const busts = {};
    function bust(u) {
      if (busts[u.i] !== undefined) return busts[u.i];
      let cvs = null;
      try { if (u.kind === "hero" && heroes[u.ref] && window.Paint) cvs = Paint.portraitGrid(heroes[u.ref], A.heroLook(heroes[u.ref])).toCanvas(1); } catch (err) { cvs = null; }
      return (busts[u.i] = cvs || sprite(u, 0));
    }

    // ---------- drawing ----------
    let frame = 0;
    const anchors = {}, stamps = [];
    // a Diviner's card each round: it rises over them face down, turns, holds, and fades; a reversed one comes up upside down, a little cold
    const tarotDeck = { d: null };
    // the Diviner turns their own deck: the one they last read with before this fight (their hero file links the readings)
    const drawer = (f.log.find((e) => e.card) || {}).a, dh = drawer != null && units[drawer] && units[drawer].kind === "hero" ? units[drawer].ref : null;
    const ownDeck = () => (dh ? A.load(`hero/${dh}`) : Promise.reject(new Error("no diviner"))).then((hd) => {
      const rids = [...new Set(((hd && hd.events) || []).filter((e) => e.reading && e.day <= f.day && (e.heroes || []).includes(dh)).sort((a, b) => b.day - a.day).map((e) => e.reading))].slice(0, 4);
      const next = (i) => (i >= rids.length ? "witch" : A.load(`reading/${rids[i]}`).then((rec) => (rec && rec.reader && rec.reader.id === dh ? TarotCards.deckFor(rec) : next(i + 1)), () => next(i + 1)));
      return next(0);
    }).catch(() => "witch");
    if (window.TarotCards && f.log.some((e) => e.card)) ownDeck().then((k) => TarotCards.load(k).catch(() => TarotCards.load("witch"))).then((d) => { tarotDeck.d = d; }).catch(() => {});
    const cardCache = {};
    function cardCanvas(id, back, rev) {
      const key = `${id}|${back}|${rev}`;
      if (cardCache[key]) return cardCache[key];
      const d = tarotDeck.d, c = document.createElement("canvas");
      c.width = d.w; c.height = d.h;
      const g = c.getContext("2d"), img = g.createImageData(d.w, d.h);
      let px = back ? d.back() : d.card(id);
      if (rev && window.TarotReplay) px = TarotReplay.rot180(px, d.w, d.h);
      img.data.set(px);
      g.putImageData(img, 0, 0);
      return (cardCache[key] = c);
    }
    function tarotCard(b, tau) {
      if (!tarotDeck.d) return;
      const an = anchors[b.a] || pos(b.a), dur = (b.time && b.time.dur) || 0.8, k = clamp(tau / dur, 0, 1);
      const turn = clamp((k - 0.12) / 0.3, 0, 1), face = turn >= 0.5, sx = Math.max(0.08, Math.abs(Math.cos(turn * Math.PI)));
      const a = clamp(k / 0.1, 0, 1) * clamp((1 - k) / 0.18, 0, 1), w = 16, h = 26;
      const cx = an.x, top = (an.top != null ? an.top : an.y - 30) - h - 4 - 6 * ease(Math.min(1, k * 3));
      o.save();
      o.globalAlpha = a;
      o.imageSmoothingEnabled = false;
      o.translate(R(cx), R(top + h / 2));
      o.scale(sx, 1);
      o.drawImage(cardCanvas(b.e.card, !face, b.e.rev), -w / 2, -h / 2, w, h);
      if (face && b.e.rev && !calm) { o.globalAlpha = a * 0.35 * (1 - clamp((k - 0.45) / 0.4, 0, 1)); o.fillStyle = "#24304a"; o.fillRect(-w / 2, -h / 2, w, h); }
      o.restore();
    }
    function draw(t) {
      frame = Math.floor(t / 0.42) % 2;
      glowAt(t);
      const slot = slotAt(t), u = t - slot.t0, live = stateAt(t), { st } = live;
      viewSt = st;
      const acts = active(t), pose = posesAt(acts, t), V = view(t, slot, u);
      const L = FXL();
      const inX = (x, m) => clamp(x, V.vx + m, V.vx + V.vw - m), inY = (y, m) => Math.max(V.vy + m + (slot.close ? V.vh * 0.1 : 0), y);
      // the world, at stage size
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.clearRect(0, 0, W, H);
      o.drawImage(bg, 0, 0);
      if (bg.life && !calm) bg.life(o, performance.now() / 1000); else if (bg.life) bg.life(o, 2);
      drawFloor(t);
      for (const x of acts) {
        const b = x.b;
        L.play(o, b.look.family, params(b), b.from, toArg(b), x.tau, "floor", b.time);
        // an area ring marks blows and group heals; a crew buff or ward, a status that fizzled and the lure's wake don't get one
        const own = (b.look.family === "buff" || b.look.family === "guard") && units[b.to[0]] && units[b.a] && units[b.to[0]].side === units[b.a].side;
        if (b.to.length > 1 && b.look.family !== "nova" && !own && !b.whiff && b.look.params.shape !== "lure" && new Set(b.to).size > 1) {
          const xs = b.to.map((i) => units[i].x), ys = b.to.map((i) => units[i].y);
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = ys.reduce((a, c) => a + c, 0) / ys.length + 2, r = (Math.max(...xs) - Math.min(...xs)) / 2 + 14;
          L.ring(o, cx, cy, r, x.tau < b.time.impact ? x.tau : x.tau - b.time.impact, params(b), x.tau < b.time.impact ? "tell" : "hit");
        }
      }
      // shadows, then fighters back to front
      const tallest = Math.max(...units.map((q) => (q ? q.sh : 0)));
      const depth = (q) => q.y + (tallest - q.sh) * 0.15;
      const shown = units.filter((q) => q && st[q.i].shown !== null && !(st[q.i].fled != null && !doomed(q, st[q.i]) && t - st[q.i].fled > fadeLen(st[q.i]))).sort((a, b) => depth(a) - depth(b));
      const place = {};
      for (const q of shown) {
        const s = st[q.i];
        let p = pose[q.i] || { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, white: 0, alpha: 1, ghosts: [] };
        if (q.mount && !calm) { const mp = mountPose(q, t); p = Object.assign({}, p, { dx: p.dx + mp.dx, dy: p.dy + mp.dy, rot: (p.rot || 0) + mp.rot }); }
        let x = q.x + p.dx, alpha = p.alpha;
        if (s.fled != null) { x += fleeDx(q, s, t); if (!doomed(q, s)) alpha *= clamp(1 - (t - s.fled) / fadeLen(s), 0, 1); }
        if (s.shown > 0) alpha *= clamp((t - s.shown) / 0.3, 0, 1);
        if (s.ghost) alpha *= 0.5;
        place[q.i] = { x, alpha, p };
        if (s.down == null) { o.globalAlpha = 0.3 * alpha; o.fillStyle = "#1e140c"; o.beginPath(); o.ellipse(R(x), q.y, Math.max(5, q.sw * 0.38), 2, 0, 0, Math.PI * 2); o.fill(); o.globalAlpha = 1; }
      }
      const inverted = !calm && slot.close && invertedAt(slot, t), rim = tagAlpha(slot, u);
      if (inverted) { o.fillStyle = "#f6efe0"; o.fillRect(0, 0, W, H); }
      for (const q of shown) {
        const s = st[q.i], pl = place[q.i];
        let p = pl.p;
        const bolting = (!!q.mount || s.walk || s.bolt) && s.fled != null && t >= s.fled;
        let img = sprite(q, s.down != null ? 0 : (frame + q.i) % 2, "all", bolting);
        if (inverted) { if (slot.members.some((m) => m.b.a === q.i || m.b.to.includes(q.i))) blit(flat(img, "#120c18"), pl.x, q.y, p, 1); continue; }
        let fx = pl.x;
        if (s.down != null && q.mount) {
          // the rider is thrown and the mount bolts for home, riderless, fading as it goes
          const k = Math.max(0, t - s.down), cv = rider(q, 0), fd = q.side ? -1 : 1;
          const mx = pl.x + (cv.mountL + cv.mountW / 2 - cv.width / 2) * fd - fd * (calm ? 0 : 190 * k * k);
          const ma = clamp(1 - k / 1.1, 0, 1) * pl.alpha;
          if (ma > 0) blit(sprite(q, calm ? 0 : Math.floor(k * 9) % 2, "mount", true), mx, q.y, { sx: 1, sy: 1 }, ma);
          img = sprite(q, 0, "foot"); fx = pl.x + seatDx(q);
        }
        if (s.down != null && window.Deaths && Deaths.group(q) && !q.mount) {
          // a monster dies its own way (deaths.js); a boss's death waits out the hit-stop as a white cut-out, then plays
          const boss = !!q.boss, age = t - s.down - (boss ? BOSS_WAIT : 0);
          if (age < 0) {
            blit(img, fx, q.y, { sx: 1, sy: 1 }, pl.alpha);
            if (!calm && t - s.down < 0.09) blit(flat(img, "#ffffff"), fx, q.y, { sx: 1, sy: 1 }, pl.alpha);
          } else Deaths.draw(o, q, age, fx, q.y, q.side ? -1 : 1, { alpha: (boss ? 1 : 0.85) * pl.alpha, dust: dustCol, calm });
          if (boss) bossAfter(q, age, fx);
          continue;
        }
        if (s.down != null) {
          // the death fall: tip over with a bounce, then lie still
          const k = clamp((t - s.down) / 0.38, 0, 1), fall = k < 0.75 ? ease(k / 0.75) : 1 - 0.08 * Math.sin((k - 0.75) / 0.25 * Math.PI);
          o.save(); o.globalAlpha = 0.85 * pl.alpha;
          if (!q.mount && q.sw > q.sh * 1.1) {
            // a beast rolls onto its back, legs in the air
            // turned over about its middle, so its back comes to rest on the floor line rather than under it
            o.translate(R(fx + (q.side ? 3 : -3) * fall), q.y - R(img.height / 2) - R(Math.sin(fall * Math.PI) * 4));
            o.scale(1, 1 - 2 * fall);
            o.drawImage(img, -R(img.width / 2), -R(img.height / 2));
          } else {
            o.translate(R(fx + (q.side ? 4 : -4) * fall), q.y);
            o.rotate((q.side === 0 ? -1 : 1) * Math.PI / 2 * fall);
            o.drawImage(img, -R(img.width / 2), -img.height + R(fall * 2));
          }
          o.restore();
          if (!calm && k < 1) dustPuff(o, fx, q.y, t - s.down, q.i);
          continue;
        }
        for (const g of p.ghosts) blit(img, q.x + g.dx, q.y + g.dy, { sx: p.sx, sy: p.sy, rot: 0, white: 0 }, g.a * pl.alpha);
        const mood = moodOf(q, s, t, live.round);
        if (mood.fear) { pl.x += mood.dx; p = Object.assign({}, p, { sx: p.sx * mood.sx, sy: p.sy * mood.sy, rot: (p.rot || 0) + mood.rot }); }
        if (s.walk && s.fled != null && t >= s.fled && !calm) p = Object.assign({}, p, { dy: p.dy - (Math.floor((t - s.fled) * 6) % 2) });
        if (mood.glow) { const g = flat(img, GLOW[s.glowSt] || GLOW.heal); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) blit(g, pl.x + dx, q.y + p.dy + dy, p, mood.glow * pl.alpha); }
        if (rim && q.i === shot(slot).tag.a) { const gold = flat(img, "#f0c450"); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) blit(gold, pl.x + dx, q.y + p.dy + dy, p, rim * pl.alpha); }
        blit(img, pl.x, q.y + p.dy, p, pl.alpha);
        if (p.tint && p.tintAmt > 0.01) blit(flat(img, p.tint), pl.x, q.y + p.dy, p, p.tintAmt * pl.alpha);
        if (mood.fear) blit(flat(img, "#2c3a78"), pl.x, q.y + p.dy, p, (mood.fear > 1 ? 0.3 : 0.22) * pl.alpha);
        if (p.white > 0.01) blit(flat(img, "#ffffff"), pl.x, q.y + p.dy, p, p.white * pl.alpha);
        moodMarks(q, s, pl, p, mood, t);
        anchors[q.i] = { x: pl.x, y: q.y, top: q.y - q.sh };
      }
      if (!inverted) for (const x of acts) { const b = x.b; L.play(o, b.look.family, params(b), b.from, toArg(b), x.tau, "fx", b.time); }
      if (!inverted) for (const x of acts) if (x.b.e && x.b.e.card) tarotCard(x.b, x.tau);
      // impacts: sparks, numbers and stamps, each a function of the time since it landed
      let shake = [0, 0], flash = null;
      const stack = {};
      stamps.length = 0;
      for (const im of P.impacts) {
        const a = t - im.T;
        if (a < 0 || a > (im.boss ? 4 : 1.7)) continue;
        const q = units[im.t];
        if (!q) continue;
        const an = anchors[im.t] || { x: q.x, y: q.y, top: q.y - q.sh }, ch = chestOf({ x: an.x, y: q.y, h: q.sh });
        const n = stack[im.t] = (stack[im.t] || 0) + 1;
        const e = f.log[im.li] || {};
        // numbers on one fighter stack a glyph and its rim apart, and never rise into the letterbox or off the top
        const ny = Math.max(inY(0, 30) + (n - 1) * 13, an.top - 6 - (n - 1) * 13);
        if (im.kind === "hit" || im.kind === "crit") {
          if (!inverted) L.sparks(o, ch.x, ch.y, a, { school: (im.b && im.b.look.params.school) || "physical", count: 0, size: im.crit ? 1.4 : 1, dir: q.side ? 1 : -1, seed: im.li, crit: im.crit });
          L.number(o, im.crit ? "crit" : "normal", String(e.v), an.x, ny, a);
          const power = im.crit ? 2 : im.heavy ? 1 : 0;
          if (power && !calm && im.slot && im.slot.kind !== "merge") { const s = L.shake(a, power, im.li); if (Math.abs(s[0]) + Math.abs(s[1]) > Math.abs(shake[0]) + Math.abs(shake[1])) shake = s; }
          if (im.crit && !calm && a < 0.1) flash = { a, s: 0.6 };
          if (im.crit && im.slot && im.slot.close && !im.slot.kill) stamps.push(["crit", inX(an.x + (q.side ? 16 : -16), 36), inY(an.top - 30, 16), a]);
          if (e.st && im.slot && im.slot.kind === "beat" && !im.slot.close && !(e.hp === 0)) stamps.push(["status", inX(an.x, 40), Math.min(q.y - 6, inY(an.top + 8, 8)), a - 0.35, statusWord(e.st)]);
        } else if (im.kind === "miss") L.number(o, "miss", "miss", an.x, ny, a);
        else if (im.kind === "heal" && e.v > 0) L.number(o, "heal", "+" + e.v, an.x, ny, a);
        else if (im.kind === "tick") L.number(o, e.st === "burn" ? "burn" : e.st === "poison" ? "poison" : "tick", String(e.v), an.x, ny, a);
        else if (im.kind === "down" && im.boss) {
          // the boss: a flash on the blow, then a heavy, slow quake when the body hits the floor; the card says the rest
          const al = a - BOSS_WAIT - Deaths.land(q);
          if (!calm) { const s = al >= 0 ? L.shake(al, 3, im.li) : L.shake(a, 1, im.li); if (Math.abs(s[0]) + Math.abs(s[1]) > Math.abs(shake[0]) + Math.abs(shake[1])) shake = s; }
          if (!calm && a < 0.1) flash = { a, s: 1 };
        }
        else if (im.kind === "down") {
          if (!calm) { const s = L.shake(a, im.kill ? 3 : 1, im.li); if (Math.abs(s[0]) + Math.abs(s[1]) > Math.abs(shake[0]) + Math.abs(shake[1])) shake = s; }
          if (im.kill) { stamps.push(["ko", inX(an.x + (q.side ? 18 : -18), 34), inY(an.top - 50, 20), a - 0.1]); if (!calm && a < 0.1) flash = { a, s: 1 }; }
        }
      }
      if (flash && !inverted) L.flash(o, W, H, flash.a, flash.s);
      drawBars(o, st, t, slot);
      present(t, slot, u, shake, st, live, acts);
      syncRoster(st, t);
      syncLog(live.li);
    }
    // shaken: a tremble, a blue chill and a sweat drop; cowering: a crouch, a lean away from the fight and shiver marks;
    // a rally's lift: a glow round the crew in the colour of what it gave them, pulsing while it lasts
    const GLOW = { pow: "#ff9a4a", acc: "#8fd6ff", arm: "#e2e8f0", crit: "#ffe066", eva: "#b8f0c8", spd: "#b8f0c8", heal: "#8af0a0" };
    function moodOf(q, s, t, round) {
      const out = { fear: 0, dx: 0, sx: 1, sy: 1, rot: 0, glow: 0 };
      if (s.down != null || s.fled != null) return out;
      const cower = s.cower >= round, shaken = s.shaken >= round;
      out.fear = cower ? 2 : shaken ? 1 : 0;
      const away = q.side ? 1 : -1, k = clamp((t - s.fearT) / 0.25, 0, 1);
      if (cower) { out.sy = 1 - 0.16 * k; out.sx = 1 + 0.06 * k; out.rot = away * 0.1 * k; }
      if (out.fear && !calm) out.dx = (Math.floor(t * (cower ? 16 : 11) + q.i) % 2 ? 1 : 0) * away;
      if (s.glow >= round) {
        const since = t - s.glowT;
        out.glow = since < 0.5 ? 1 - since * 0.6 : calm ? 0.55 : 0.5 + 0.18 * Math.sin(t * 5 + q.i);
      }
      return out;
    }
    function moodMarks(q, s, pl, p, mood, t) {
      const head = q.y + p.dy - q.sh * (p.sy || 1), side = q.side ? -1 : 1, hx = pl.x + side * Math.max(5, q.sw * 0.28);
      if (mood.fear === 1) {
        // a sweat drop slides down beside the head, over and over
        const ph = calm ? 0.3 : ((t * 0.9 + q.i * 0.37) % 1), y = R(head + 3 + ph * 7);
        o.globalAlpha = clamp(1.2 - ph, 0, 1) * pl.alpha; o.fillStyle = "#1c2a48"; o.fillRect(R(hx) - 1, y - 1, 3, 4);
        o.fillStyle = "#a8dcff"; o.fillRect(R(hx), y, 1, 2); o.fillRect(R(hx), y - 1, 1, 1);
        o.fillStyle = "#ffffff"; o.fillRect(R(hx), y, 1, 1);
        o.globalAlpha = 1;
      } else if (mood.fear === 2) {
        // shiver marks either side of a head pulled down low
        const on = calm || Math.floor(t * 8 + q.i) % 2 === 0;
        o.globalAlpha = 0.9 * pl.alpha; o.fillStyle = "#e8ecf8";
        for (const d of [-1, 1]) {
          const x = R(pl.x + d * (q.sw * 0.42 + 2)), y = R(head + 2);
          if (on) { o.fillRect(x, y, 1, 3); o.fillRect(x + d * 2, y + 1, 1, 2); } else o.fillRect(x + d, y + 1, 1, 3);
        }
        o.globalAlpha = 1;
      }
      if (mood.glow > 0.05 && !calm) {
        // motes rise off a lifted fighter
        o.fillStyle = GLOW[s.glowSt] || GLOW.heal;
        for (let j = 0; j < 3; j++) {
          const ph = (t * 0.7 + j / 3 + q.i * 0.21) % 1, x = R(pl.x - q.sw * 0.3 + ((j * 7 + q.i * 5) % Math.max(4, R(q.sw * 0.6)))), y = R(q.y - ph * q.sh * 0.9);
          o.globalAlpha = Math.min(1, mood.glow * 2) * (1 - ph) * pl.alpha; o.fillRect(x, y, 1, 1);
        }
        o.globalAlpha = 1;
      }
    }
    function statusWord(s) { return { stun: "STUNNED", charm: "CHARMED", shaken: "SHAKEN", cowering: "COWERING", burn: "BURNING", chill: "CHILLED", poison: "POISONED", bleed: "BLEEDING", weaken: "WEAKENED", blind: "BLINDED", marked: "MARKED", root: "ROOTED", frozen: "FROZEN" }[s] || String(s).toUpperCase(); }
    function invertedAt(slot, t) {
      const im = P.impacts.find((x) => x.slot === slot && (x.kind === "hit" || x.kind === "crit"));
      return !!im && t >= im.T && t < im.T + 0.07;
    }
    function blit(img, x, feet, p, alpha) {
      const w = img.width * (p.sx || 1), h = img.height * (p.sy || 1);
      o.save(); o.globalAlpha = clamp(alpha, 0, 1);
      o.translate(R(x), R(feet));
      if (p.rot) o.rotate(p.rot);
      o.drawImage(img, R(-w / 2), R(-h), R(w), R(h));
      o.restore();
    }
    // ---------- a boss's body stays: its loot spills out and glints, and the slayer's banner drops in beside it ----------
    const BOSS_WAIT = FightDirector.T.bossHold - 0.03;
    const dustCol = (() => { const n = parseInt(floorTint.slice(1), 16), lift = (v) => R(v + (255 - v) * 0.3); return "#" + [lift(n >> 16), lift((n >> 8) & 255), lift(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join(""); })();
    const icons = {};
    const icon = (id) => icons[id] || (icons[id] = Art.itemGrid(id).toCanvas(1));
    let flag;
    function slayerBanner() {
      if (flag !== undefined) return flag;
      const bk = P.bossKill, a = bk && bk.b.kind === "act" && units[bk.b.a], h = a && a.kind === "hero" ? heroes[a.ref] : heroes[(f.heroes || [])[0]];
      const p = h && h.party && A.parties && A.parties[h.party];
      const b = (p && p.banner) || (h && { c1: (h.look && h.look.fav) || "#7a2a2a", c2: "#e8c860", emblem: "sword" });
      return (flag = b ? [Art.bannerGrid(b).toCanvas(1), Art.bannerGrid(b).flipX().toCanvas(1)] : null);
    }
    function bossAfter(q, age, x) {
      if (age < 0) return;
      const land = Deaths.land(q), len = Deaths.len(q), dir = q.side ? -1 : 1;
      // the landing sends a ring of grit out across the floor
      const k = seg(age, land, land + 0.55);
      if (!calm && k > 0 && k < 1) {
        o.save(); o.globalAlpha = 0.7 * (1 - k); o.strokeStyle = dustCol; o.lineWidth = 1; o.setLineDash([3, 2]);
        const r1 = 10 + 70 * ease(k), r2 = 6 + 44 * ease(k);
        o.beginPath(); o.ellipse(R(x), q.y, r1, r1 * FLAT, 0, 0, Math.PI * 2); o.stroke(); o.setLineDash([]);
        o.globalAlpha = 0.5 * (1 - k); o.beginPath(); o.ellipse(R(x), q.y, r2, r2 * FLAT, 0, 0, Math.PI * 2); o.stroke();
        o.restore();
      }
      const after = calm ? 9 : age - len;
      if (after <= 0) return;
      // the loot and the banner stay on the stage whatever the body's size and wherever it fell (round 32: f121 ran off the right edge)
      const lo = cam.vx + 4, hi = cam.vx + cam.vw - 4, spoils = (f.spoils || []).slice(0, 4);
      const reach = spoils.reduce((m, id, i) => Math.max(m, 10 + i * 6 + icon(id).width / 2), 0), sx0 = clamp(x, lo + reach, hi - reach);
      spoils.forEach((id, i) => {
        const kt = after - i * 0.12;
        if (kt <= 0) return;
        const img = icon(id), side = i % 2 ? 1 : -1, fl = Math.min(1, kt / 0.45), dist = 10 + i * 6;
        const px = sx0 + side * dist * ease(fl), py = q.y - 1 - Math.sin(fl * Math.PI) * 14 - (fl >= 1 ? Math.sin(seg(kt, 0.45, 0.6) * Math.PI) * 2 : 0);
        o.drawImage(img, R(px - img.width / 2), R(py - img.height));
        const g = ((kt * 0.8 + i * 0.31) % 1.6) / 0.45;
        if (!calm && fl >= 1 && g < 1) {
          const sz = R(Math.sin(g * Math.PI) * 3), gx = R(px + 2), gy = R(py - img.height);
          o.fillStyle = "#fff6c8"; o.fillRect(gx, gy - sz, 1, 2 * sz + 1); o.fillRect(gx - sz, gy, 2 * sz + 1, 1); o.fillStyle = "#ffffff"; o.fillRect(gx, gy, 1, 1);
        }
      });
      const ban = slayerBanner();
      if (!ban) return;
      // point first into the floor just behind the body, flying over it toward the slayer; nobody carries it in
      const bw = ban[0].width + 3, kb = calm ? 1 : seg(after, 0.35, 0.57), by = q.y + 2 - R((1 - kb * kb) * 90);
      const bx = R(dir > 0 ? clamp(x - 11, lo + 1, hi - bw - 1) : clamp(x + 11, lo + bw + 1, hi - 2));
      if (kb <= 0) return;
      const ww = seg(after, 0.57, 0.9), wob = !calm && kb >= 1 ? Math.sin(ww * Math.PI * 3) * 0.06 * (1 - ww) : 0;
      o.save(); o.translate(bx, by); if (wob) o.rotate(wob);
      o.fillStyle = "#5c3e22"; o.fillRect(0, -32, 1, 32); o.fillStyle = "#3a2614"; o.fillRect(1, -32, 1, 32); o.fillStyle = "#d8b060"; o.fillRect(-1, -34, 4, 2);
      if (dir < 0) o.drawImage(ban[1], -ban[1].width, -32); else o.drawImage(ban[0], 2, -32);
      o.restore();
      const kd = seg(after, 0.57, 1.05);
      if (!calm && kd > 0 && kd < 1) dustPuff(o, bx, q.y, kd * 0.4, q.i + 5);
    }
    function dustPuff(c, x, y, a, seed) {
      const rnd = hashRng(seed + 3);
      c.fillStyle = "#e8dcc4";
      for (let k = 0; k < 6; k++) { const d = (rnd() - 0.5) * 2, r = 1 + R(a * 6); c.globalAlpha = clamp(0.8 - a * 2, 0, 1); c.fillRect(R(x + d * (6 + a * 30)), R(y - 1 - a * 8 * rnd()), r, r); }
      c.globalAlpha = 1;
    }

    // bars stay under each fighter's home spot and step down past each other, so a pile-up never hides one
    function barLayout(st, t) {
      const out = [];
      const list = units.filter((q) => q && st[q.i].shown !== null && st[q.i].fled == null && (st[q.i].down == null || t - st[q.i].down < 0.6) && q.maxhp).sort((a, b) => a.y - b.y || a.x - b.x);
      for (const q of list) {
        const w = q.look && q.look.pet ? 12 : clamp(R(q.sw * 0.6), 14, 20);
        let bx = R(q.x - w / 2 + 3), by = q.y + 3;
        const hits = (y) => out.some((b) => bx - 7 < b.x + b.w + 1 && b.x - 7 < bx + w + 1 && y < b.y + 4 && b.y < y + 4);
        let tries = 0;
        while (hits(by) && tries++ < 4) by += 4;
        if (hits(by)) { by = q.y + 3; let nudge = 0; while (hits(by) && nudge++ < 10) bx += q.side ? 2 : -2; }
        out.push({ x: bx, y: by, w, q });
      }
      return out;
    }
    let bars = [];
    function drawBars(c, st, t, slot) {
      bars = slot.close ? [] : barLayout(st, t);
      for (const b of bars) {
        const s = st[b.q.i], frac = clamp(s.hp / b.q.maxhp, 0, 1), n = R(b.w * frac);
        c.fillStyle = "#120c18"; c.fillRect(b.x - 1, b.y - 1, b.w + 2, 4);
        c.fillStyle = "#3a2822"; c.fillRect(b.x, b.y, b.w, 2);
        c.fillStyle = frac < 0.25 ? "#ff963c" : b.q.side === 0 ? "#6ccf7a" : "#e2645c"; c.fillRect(b.x, b.y, n, 2);
        const lostA = t - s.hitT;
        if (lostA >= 0 && lostA < 0.7 && s.before > s.hp) { const m = R(b.w * clamp((s.before - s.hp) / b.q.maxhp, 0, 1) * (1 - lostA / 0.7)); c.fillStyle = "#faf0dc"; c.fillRect(b.x + n, b.y, Math.min(m, b.w - n), 2); }
      }
    }

    // ---------- to the screen: camera, close-ups, cut-ins, HUD ----------
    // a fighter who runs is gone in a second, unless a parting shot drops them on the way
    const shotDown = {};
    f.log.forEach((e, k) => { if (e.fx === "down") shotDown[e.t] = P.events[k]; });
    const doomed = (q, s) => s.fled != null && shotDown[q.i] != null && shotDown[q.i] >= s.fled;
    // a foe talked out of the fight turns its back and walks off; one that bolts is gone in a second
    const fadeLen = (s) => (s.walk ? 2.6 : 1.2);
    function fleeDx(q, s, t) {
      if (s.fled == null) return 0;
      if (s.walk) return (q.side ? 1 : -1) * 34 * Math.max(0, t - s.fled);
      const k = Math.max(0, t - s.fled), run = doomed(q, s) ? Math.min(k, 0.45) : k;
      return (q.side ? 1 : -1) * (q.mount ? 210 : 150) * run * run;
    }
    // a mount answers in its own way: it rears, pivoting on its hind legs, when its rider lands a critical or the last
    // blow, and stumbles back a step when it is hit
    function mountPose(q, t) {
      const fd = q.side ? -1 : 1;
      let rear = 0, stag = 0;
      for (const im of P.impacts) {
        const a = t - im.T;
        if (a < 0 || a > 0.75) continue;
        if (im.b && im.b.a === q.i && (im.crit || im.kill)) rear = Math.max(rear, 0.3 * Math.sin(Math.PI * a / 0.75));
        else if (im.t === q.i && (im.kind === "hit" || im.kind === "crit") && a < 0.35) stag = Math.max(stag, Math.sin(Math.PI * a / 0.35));
      }
      return { dx: -fd * 2 * stag, dy: stag - q.sw * 0.32 * Math.sin(rear), rot: -fd * rear + fd * 0.06 * stag };
    }
    let viewSt = null;
    // a beat that matters is framed so the one acting is never in doubt: a pair within reach shares a close-up; an actor
    // out of reach (a caster, an archer, the back rank) opens the shot through the wind-up and the cast, then the camera
    // follows the effect to where it lands. Slowed beats and cut-ins frame a little wider than the 2x close-up.
    const REACH = 18;
    function shot(slot) {
      if (slot._shot !== undefined) return slot._shot;
      slot._shot = null;
      const m = slot.members[0], b = m && m.b;
      if (slot.kind !== "beat" || !b || b.kind !== "act" || !b.time || !units[b.a]) return null;
      if (!(slot.close || slot.kill || slot.turning || slot.cutin || slot.rate < 1)) return null;
      const a = units[b.a], foes = [...new Set(b.to)].filter((i) => i !== b.a && units[i]);
      const uOf = (tau) => FightDirector.uAt(m.knots, tau);
      const tag = { a: b.a, from: slot.cutin ? slot.pre : 0, until: Math.max(uOf(b.time.impact), (slot.pre || 0) + 0.5) + 0.3 };
      const zw = cam.vw / (slot.close ? 2 : 1.5);
      if (calm || !foes.length) return (slot._shot = { tag });
      const gap = Math.min(...foes.map((i) => Math.abs(units[i].x - a.x) - (units[i].sw + a.sw) / 2));
      const span = Math.max(a.x + a.sw / 2, ...foes.map((i) => units[i].x + units[i].sw / 2)) - Math.min(a.x - a.sw / 2, ...foes.map((i) => units[i].x - units[i].sw / 2)) + 24;
      if (gap <= REACH && span <= cam.vw / 1.4) return (slot._shot = slot.close ? { pair: foes[0], tag } : { tag });
      // the pan starts as the effect leaves the actor and lands with it, never before the actor has had the frame a moment
      const uB = Math.max(uOf(b.time.impact) - 0.04, (slot.pre || 0) + 0.3), uA = clamp(uOf(b.time.windup || 0), (slot.pre || 0) + 0.12, uB - 0.14);
      return (slot._shot = { follow: true, a: b.a, foes, zw, uA, uB, tag });
    }
    const atX = (q, t) => q.x + (viewSt && viewSt[q.i] ? fleeDx(q, viewSt[q.i], t) : 0);
    // heads to feet, with room for the letterbox that eats a tenth top and bottom: a tall fighter widens the shot
    function framing(cx, top, feet, zw) {
      zw = Math.min(cam.vw, Math.max(zw, (feet - top + 12) / 0.78 * 16 / 9));
      // a fighter on their feet straddling an edge is taken in whole rather than cut in half
      let l = clamp(cx - zw / 2, 0, W - zw), r = l + zw;
      const standing = units.filter((q) => q && (!viewSt || !viewSt[q.i] || (viewSt[q.i].down == null && viewSt[q.i].fled == null && viewSt[q.i].shown !== null)));
      for (let pass = 0; pass < 3; pass++) for (const q of standing) {
        const a = q.x - q.sw / 2, b = q.x + q.sw / 2;
        if (a < l && b > l) l = a - 4;
        if (a < r && b > r) r = b + 4;
      }
      if (r - l > zw) { zw = Math.min(cam.vw, r - l); l = clamp((l + r) / 2 - zw / 2, 0, W - zw); }
      const zh = zw * 9 / 16;
      return { vx: l, vy: clamp((top + feet) / 2 - zh / 2 - 1, 0, H - zh), vw: zw, vh: zh };
    }
    const mix = (A, B, k) => ({ vx: A.vx + (B.vx - A.vx) * k, vy: A.vy + (B.vy - A.vy) * k, vw: A.vw + (B.vw - A.vw) * k, vh: A.vh + (B.vh - A.vh) * k });
    function view(t, slot, u) {
      const base = shotView(t, slot, u);
      if (!slot.bossKill || calm) return base;
      // once a boss starts to die the camera eases over to where its body will lie, and stays for the loot and the banner
      const q = units[slot.bossKill.who], st = viewSt && viewSt[q.i];
      if (!st || st.down == null) return base;
      const age = t - st.down - BOSS_WAIT, kk = ease(seg(age, 0.15, 0.9)) * Math.min(ease(u / 0.16), ease((slot.len - u) / 0.3));
      if (kk <= 0) return base;
      const back = q.side ? 1 : -1, cx = q.x + back * q.sh * 0.3;
      return mix(base, framing(cx, q.y - q.sh * 1.2, q.y + 2, Math.max(cam.vw / 1.7, q.sh * 2.6)), kk);
    }
    function shotView(t, slot, u) {
      const s = shot(slot), wide = { vx: cam.vx, vy: cam.vy, vw: cam.vw, vh: cam.vh };
      if (!s || !(s.pair != null || s.follow)) return wide;
      const k = Math.min(ease(u / 0.16), ease((slot.len - u) / 0.22));
      const b = slot.members[0].b, a = units[b.a];
      if (s.pair != null) {
        // 2x on the pair, or as close as fits them both; the letterbox eats a tenth top and bottom
        const q = units[s.pair], qx = atX(q, t), span = Math.abs(a.x - qx) + (a.sw + q.sw) / 2 + 24;
        return mix(wide, framing((a.x + qx) / 2, Math.min(a.y - a.sh, q.y - q.sh), Math.max(a.y, q.y), clamp(span, cam.vw / 2, cam.vw / 1.4)), k);
      }
      // the shot lands on the targets with the actor's side still in it: a target running away is followed only a step,
      // and the actor's nearest fighter on their feet stays in frame; when that can't fit, the shot lands wide
      const st = viewSt || [], up = (q) => st[q.i] && st[q.i].down == null && st[q.i].fled == null && st[q.i].shown !== null;
      const chase = (q) => q.x + clamp(atX(q, t) - q.x, -36, 36);
      const qs = s.foes.map((i) => units[i]);
      let lo = Math.min(...qs.map((q) => chase(q) - q.sw / 2)), hi = Math.max(...qs.map((q) => chase(q) + q.sw / 2));
      const c0 = (lo + hi) / 2, mates = units.filter((q) => q && q.side === a.side && up(q)).sort((p, q) => Math.abs(p.x - c0) - Math.abs(q.x - c0));
      const near = mates[0] || a, inB = [...qs, near];
      lo = Math.min(lo, near.x - near.sw / 2); hi = Math.max(hi, near.x + near.sw / 2);
      if (a.x + a.sw / 2 > lo && a.x - a.sw / 2 < hi) inB.push(a);
      const mid = (lo + hi) / 2, dir = mid > a.x ? 1 : -1, zt = clamp(hi - lo + 28, s.zw, cam.vw);
      const A = framing(a.x + dir * s.zw * 0.18, a.y - a.sh, a.y, s.zw);
      // leaning the shot back toward the actor never pushes what it lands on out of it
      const cx = zt > s.zw ? mid : clamp(mid - dir * s.zw * 0.18, hi + 12 - zt / 2, lo - 12 + zt / 2);
      const B = hi - lo + 28 > cam.vw ? wide : framing(cx, Math.min(...inB.map((q) => q.y - q.sh)), Math.max(...inB.map((q) => q.y)), zt);
      const p = u <= s.uA ? 0 : u >= s.uB ? 1 : (u - s.uA) / (s.uB - s.uA);
      return mix(wide, mix(A, B, p * p * (3 - 2 * p)), k);
    }
    // who is acting: a gold rim on the sprite and a name tag over their head, from the wind-up until just after it lands
    function tagAlpha(slot, u) {
      const s = shot(slot), tg = s && s.tag;
      if (!tg || u < tg.from || u > tg.until + 0.25) return 0;
      // an actor felled in their own beat (thorns, a parting blow) loses the tag as they fall
      if (viewSt && viewSt[tg.a] && viewSt[tg.a].down != null) return 0;
      return clamp(Math.min((u - tg.from) / 0.1, (tg.until + 0.25 - u) / 0.25), 0, 1);
    }
    // the HUD's resolve panels and chips take the top of the frame whenever they show; a tag keeps below them
    const hudShows = (t, slot, u) => !(slot.close || slot.cutin && u < slot.pre || slot.kind === "boss");
    const hudFloor = (t, slot, u, B) => !hudShows(t, slot, u) ? 0 : slot.kind === "title" || t >= P.end ? 19 * B : 31 * B;
    function nameTag(t, slot, u, X, Y, B) {
      if (!tagAlpha(slot, u)) return;
      const q = units[shot(slot).tag.a], an = anchors[q.i] || { x: q.x, top: q.y - q.sh }, lb = slot.close ? cv.height * 0.1 : 0, px = X(an.x);
      // once the camera has followed the effect away, the tag goes with the actor rather than clinging to the edge
      const al = tagAlpha(slot, u) * clamp(Math.min(px, cv.width - px) / (12 * B), 0, 1);
      if (!al) return;
      ctx.font = `${R(5.5 * B)}px ${FONT}`;
      const str = `${marks[q.i] || ""} ${q.name}`.trim().toUpperCase(), w = ctx.measureText(str).width + 8 * B, h = 8.5 * B;
      const x = clamp(px - w / 2, 2 * B, cv.width - w - 2 * B), y = Math.max(lb + 2 * B, hudFloor(t, slot, u, B), Y(an.top) - h - 6 * B);
      ctx.globalAlpha = al;
      ctx.fillStyle = "rgba(28,20,18,0.9)"; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#f0c450"; ctx.fillRect(x, y + h - Math.max(1, B * 0.6), w, Math.max(1, B * 0.6));
      const tx = clamp(px, x + 3 * B, x + w - 3 * B);
      ctx.beginPath(); ctx.moveTo(tx - 2.5 * B, y + h); ctx.lineTo(tx + 2.5 * B, y + h); ctx.lineTo(tx, y + h + 3 * B); ctx.closePath(); ctx.fill();
      ctx.textAlign = "left"; ctx.fillStyle = "#f6ebd0"; ctx.fillText(str, x + 4 * B, y + 6.3 * B);
      ctx.globalAlpha = 1;
    }
    function present(t, slot, u, shake, st, live, acts) {
      const cvw = cv.width, cvh = cv.height, vw0 = view(t, slot, u), K = cvw / vw0.vw;
      const sx = shake[0] * K / 2, sy = shake[1] * K / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cvw, cvh);
      const cut = slot.cutin && u < slot.pre;
      if (cut && !calm && "filter" in ctx) ctx.filter = "saturate(0.35) brightness(0.55)";
      ctx.drawImage(off, vw0.vx, vw0.vy, vw0.vw, vw0.vh, sx, sy, cvw, cvh);
      ctx.filter = "none";
      if (cut && (calm || !("filter" in ctx))) { ctx.fillStyle = "rgba(10,8,22,0.55)"; ctx.fillRect(0, 0, cvw, cvh); }
      const X = (x) => (x - vw0.vx) * K + sx, Y = (y) => (y - vw0.vy) * K + sy;
      const B = (cvw / 384) * Math.max(1, Math.min(2, 640 / (cv.clientWidth || 640)));
      // the slow beats close in with a vignette
      if (slot.kill || slot.turning) {
        const k = Math.min(ease(u / 0.25), ease((slot.len - u) / 0.3));
        const g = ctx.createRadialGradient(cvw / 2, cvh * 0.55, cvh * 0.3, cvw / 2, cvh * 0.55, cvw * 0.62);
        g.addColorStop(0, "rgba(8,4,10,0)"); g.addColorStop(1, `rgba(8,4,10,${0.8 * k})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, cvw, cvh);
      }
      if (!slot.close) marksOnBars(X, Y, K, B);
      // stamps keep one size on screen however close the camera is
      // a status word is a footnote to the blow, not the blow: one size on the full stage whatever the zoom or the screen,
      // so it never swallows the fighter it names and their neighbours
      const sk = Math.min(K, (cvw / cam.vw) * 1.3), L = FXL(), skStatus = (cvw / W) * 0.9;
      for (const [kind, x, y, a, label] of stamps) { const k = kind === "status" ? skStatus : sk; ctx.save(); ctx.translate(R(X(x)), R(Y(y))); ctx.scale(k, k); L.stamp(ctx, kind, 0, 0, a, label); ctx.restore(); }
      if (slot.close) closeup(t, slot, u, st, B, K);
      if (cut) cutin(slot, u, B, K, X, Y);
      if (slot.kind === "boss") bossIntro(slot, u, B, X, Y, K);
      if (slot.bossKill) bossOutro(t, slot, B);
      hud(t, slot, u, live, B);
      nameTag(t, slot, u, X, Y, B);
      if (slot.kind === "title") titleCard(u, B);
      if (slot.kind === "morale") banner(vb(label(slot.side), "breaks!", "break!"), u, B, slot.len);
      if (t >= P.end) endCard(t - P.end, B);
    }
    function marksOnBars(X, Y, K, B) {
      for (const b of bars) {
        const s = Math.round(5 * B), bx = R(X(b.x) - s - 4), by = R(Y(b.y) + K * 1 - s / 2);
        ctx.fillStyle = "#120c18"; ctx.fillRect(bx - 2, by - 2, s + 4, s + 4);
        ctx.fillStyle = b.q.side === 0 ? "#3f6a2c" : "#8e2a22"; ctx.fillRect(bx, by, s, s);
        ctx.font = `${R(4.4 * B)}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "#f6ebd0"; ctx.fillText(marks[b.q.i] || "", bx + s / 2, by + s / 2 + 1);
        ctx.textBaseline = "alphabetic";
      }
    }
    function txt(str, x, y, size, col, align, B) {
      ctx.font = `${R(size * B)}px ${FONT}`;
      ctx.textAlign = align || "center";
      ctx.fillStyle = "#120c18"; ctx.fillText(str, x + Math.max(2, B * 0.7), y + Math.max(2, B * 0.7));
      ctx.fillStyle = col; ctx.fillText(str, x, y);
    }
    function chip(str, x, y, col, align, B) {
      ctx.font = `${R(5.5 * B)}px ${FONT}`;
      const w = ctx.measureText(str).width + 8 * B, h = 9 * B;
      const x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
      ctx.fillStyle = "rgba(28,20,18,0.86)"; ctx.fillRect(x0, y, w, h);
      ctx.fillStyle = "#c8963e"; ctx.fillRect(x0, y + h - Math.max(1, B * 0.6), w, Math.max(1, B * 0.6));
      ctx.textAlign = "left"; ctx.fillStyle = col; ctx.fillText(str, x0 + 4 * B, y + 6.5 * B);
      return w;
    }
    function hud(t, slot, u, live, B) {
      const cvw = cv.width;
      if (!hudShows(t, slot, u)) return;
      for (const s of [0, 1]) {
        const pw = 84 * B, x = s === 0 ? 4 * B : cvw - 4 * B - pw, val = Math.max(0, live.res[s]);
        ctx.fillStyle = "rgba(42,27,17,0.82)"; ctx.fillRect(x, 4 * B, pw, 13 * B);
        ctx.fillStyle = "#c8963e"; ctx.fillRect(x, 17 * B - B * 0.6, pw, B * 0.6);
        ctx.fillStyle = "#4a3020"; ctx.fillRect(x + 2 * B, 12.5 * B, pw - 4 * B, 2.5 * B);
        ctx.fillStyle = val > 900 ? "#b0a090" : val < 30 ? "#e2645c" : "#e8b84a";
        ctx.fillRect(x + 2 * B, 12.5 * B, Math.round(Math.min(1, Math.min(val, 160) / 160) * (pw - 4 * B)), 2.5 * B);
        txt(trunc(A.cap(label(s)), 22), s === 0 ? x + 3 * B : x + pw - 3 * B, 10.5 * B, 5.5, "#f1e3c2", s === 0 ? "left" : "right", B);
      }
      if (slot.kind === "title" || t >= P.end) return;
      const y = 20 * B;
      chip(t < P.end ? `ROUND ${live.round}` : "END", 4 * B, y, "#f6ebd0", "left", B);
      const tempo = slot.cutin && u < slot.pre ? ["CUT-IN", "#ffd65a"] : slot.kill ? ["0.4× KO", "#ff7a5a"] : slot.turning ? ["0.4×", "#ff7a5a"]
        : slot.rate > 1 ? [`»${slot.rate}×`, "#ffbe5a"] : slot.rate < 1 ? [`${slot.rate}×`, "#ffbe5a"] : ["1×", "#f6ebd0"];
      chip(tempo[0], cvw - 4 * B, y, tempo[1], "right", B);
      const b = slot.members[0] && slot.members[0].b;
      let lab = null;
      if (slot.kind === "merge") lab = `${slot.members.length} TRADES, ONE BEAT`;
      else if (slot.turning) lab = "TURNING POINT";
      else if (b && b.kind === "act" && units[b.a]) { const k = b.e.k && b.e.k !== "Attack" ? b.e.k : null; lab = k ? `${units[b.a].name.toUpperCase()} · ${k.toUpperCase()}` : null; }
      if (lab) chip(trunc(lab, 40), cvw / 2, y, "#f6ebd0", "center", B);
    }
    function titleCard(u, B) {
      const cvw = cv.width, cvh = cv.height, k = Math.min(ease(u / 0.25), ease((P.slots[0].len - u) / 0.3));
      ctx.globalAlpha = k;
      const name = (f.place_name || "").toUpperCase();
      txt(name, cvw / 2, cvh * 0.3, 13, "#ffd65a", "center", B);
      const sides = (s) => units.filter((q) => q && q.side === s && !q.summoned);
      // a traveller walking with the band is counted as one, not read as a second crew
      const count = (s) => { const L = sides(s), hs = L.filter((q) => q.kind === "hero").length, pets = L.filter((q) => q.look && q.look.pet).length,
        trav = L.filter((q) => q.kind === "traveller").length, mons = L.length - hs - pets - trav;
        return [hs ? `${hs} ${hs === 1 ? "hero" : "heroes"}` : "", pets ? `${pets} ${pets === 1 ? "pet" : "pets"}` : "", trav ? `${trav} ${trav === 1 ? "traveller" : "travellers"}` : "",
          mons ? label(s) : ""].filter(Boolean).join(" + ") || label(s); };
      txt(trunc(`${f.kind === "pve" ? count(0) : label(0)}  vs  ${label(1)}`, 56), cvw / 2, cvh * 0.3 + 12 * B, 6.5, "#f6ebd0", "center", B);
      ctx.globalAlpha = 1;
    }
    function banner(msg, u, B, len) {
      const cvw = cv.width, my = cv.height * 0.4, k = Math.min(ease(u / 0.15), ease((len - u) / 0.2));
      ctx.globalAlpha = k;
      ctx.fillStyle = "rgba(42,27,17,0.85)"; ctx.fillRect(0, my - 12 * B, cvw, 18 * B);
      ctx.fillStyle = "#c8963e"; ctx.fillRect(0, my - 12 * B, cvw, B); ctx.fillRect(0, my + 5 * B, cvw, B);
      txt(trunc(msg.toUpperCase(), 44), cvw / 2 + (1 - k) * 40 * B, my + B, 9, "#ffd877", "center", B);
      ctx.globalAlpha = 1;
    }
    function endCard(a, B) {
      const cvw = cv.width, k = ease(a / 0.3), heroSide = f.kind === "pve" ? 0 : null;
      const big = f.winner == null ? "STALEMATE" : heroSide === 0 ? (f.winner === 0 ? "VICTORY" : "DEFEAT") : vb(label(f.winner), "WINS", "WIN").toUpperCase();
      const sub = `${outcomeText(f)} · ${f.rounds} round${f.rounds === 1 ? "" : "s"}`;
      ctx.font = `${R(15 * B)}px ${FONT}`;
      const w = Math.min(cvw * 0.9, ctx.measureText(big).width + 24 * B), h = 24 * B, x = cvw / 2 - w / 2, y = 26 * B;
      ctx.globalAlpha = k;
      const slam = 1 + (1 - k) * 0.3;
      ctx.save(); ctx.translate(cvw / 2, y + h / 2); ctx.scale(slam, slam); ctx.translate(-cvw / 2, -(y + h / 2));
      ctx.fillStyle = "rgba(30,20,16,0.92)"; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = big === "DEFEAT" ? "#e2645c" : "#f0c450"; ctx.lineWidth = 2 * B; ctx.strokeRect(x + B, y + B, w - 2 * B, h - 2 * B);
      txt(big, cvw / 2, y + 17.5 * B, 15, big === "DEFEAT" ? "#ff8a7a" : "#ffd65a", "center", B);
      ctx.restore();
      txt(trunc(sub, 60), cvw / 2, y + h + 9 * B, 5.5, "#f6ebd0", "center", B);
      ctx.globalAlpha = 1;
    }
    function closeup(t, slot, u, st, B, K) {
      const cvw = cv.width, cvh = cv.height, lb = R(cvh * 0.1), b = slot.members[0].b, a = units[b.a], q = units[b.to[0]];
      // speed lines streak past once the blow lands
      const im = P.impacts.find((x) => x.slot === slot && (x.kind === "hit" || x.kind === "crit"));
      if (!calm && im && t > im.T && t < im.T + 0.5) {
        const rnd = hashRng(b.ev[0] + 11), k = (t - im.T) / 0.5, dir = q.x > a.x ? 1 : -1;
        ctx.fillStyle = "rgba(255,244,214,0.55)";
        for (let n = 0; n < 26; n++) { const y = lb + rnd() * (cvh - 2 * lb), L = (30 + rnd() * 90) * B, x0 = ((rnd() * cvw + dir * k * cvw * 1.4) % (cvw + L)) - L; ctx.globalAlpha = 0.6 * (1 - k); ctx.fillRect(dir > 0 ? x0 : cvw - x0 - L, y, L, Math.max(1, B * 0.6)); }
        ctx.globalAlpha = 1;
      }
      // the glint tells it before it lands
      if (u < slot.pre + 0.05) {
        const an = anchors[b.a] || { x: a.x, top: a.y - a.sh }, dir = q.x > a.x ? 1 : -1, v = view(t, slot, u);
        const gx = (an.x + dir * a.sw * 0.45 - v.vx) * K, gy = (a.y - a.sh * 0.75 - v.vy) * K, r = (4 + 3 * Math.sin(u * 30)) * B * 1.5;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(gx - r, gy - B * 0.6, r * 2, B * 1.2); ctx.fillRect(gx - B * 0.6, gy - r, B * 1.2, r * 2);
        ctx.fillStyle = "#fff0b4"; ctx.fillRect(gx - 2 * B, gy - 2 * B, 4 * B, 4 * B);
      }
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cvw, lb); ctx.fillRect(0, cvh - lb, cvw, lb);
      const k = b.e.k && b.e.k !== "Attack" ? b.e.k : "";
      txt(`${a.name}${k ? "  –  " + k : ""}`.toUpperCase(), cvw / 2, cvh - lb / 2 + 2 * B, 6, "#f6ebd0", "center", B);
      chip("2× CLOSE", cvw - 4 * B, cvh - lb + 1.5 * B, "#ffbe5a", "right", B);
      const s = st[q.i], w = 60 * B, x = 6 * B, y = cvh - lb / 2 - 2 * B;
      ctx.fillStyle = "#120c18"; ctx.fillRect(x - B, y - B, w + 2 * B, 5 * B);
      ctx.fillStyle = "#3a2822"; ctx.fillRect(x, y, w, 3 * B);
      ctx.fillStyle = q.side === 0 ? "#6ccf7a" : "#e2645c"; ctx.fillRect(x, y, w * clamp(s.hp / q.maxhp, 0, 1), 3 * B);
      // the mark in brackets: a bare "A Gruk the Warchief" reads as an article, not as the key to the list below
      txt(`[${marks[q.i]}] ${q.name}`, x, y - 2 * B, 5, "#f6ebd0", "left", B);
    }
    // a wild surge's cut-in: a deep-sea band with jagged edges in the surge's colour (odd: sea-glass, a help: mint, a hindrance: amber),
    // motes of loose magic drifting through it, WILD SURGE over what the spell turned into
    const SURGE_COL = { odd: "#6ad8e8", help: "#8af0b0", hinder: "#f0b05a" };
    function surgeCutin(slot, u, B, K, X, Y) {
      const cvw = cv.width, cvh = cv.height, b = slot.members[0].b, a = units[b.a], an = anchors[b.a] || { x: a.x, y: a.y, top: a.y - a.sh };
      const col = SURGE_COL[b.e.kind] || SURGE_COL.odd;
      const k = calm ? 1 : Math.min(ease(u / 0.16), ease((slot.pre - u) / 0.14));
      const heroY = Y(an.top), heroX = X(an.x), above = heroY > cvh * 0.42;
      const yc = above ? cvh * 0.3 : cvh * 0.72, hh = cvh * 0.22, teeth = 14, wob = calm ? 0 : Math.sin(u * 18) * B;
      ctx.save();
      ctx.globalAlpha = k;
      const edge = (y0, dir) => { for (let i = 0; i <= teeth; i++) { const x = (cvw + 20) * i / teeth - 10; ctx.lineTo(x, y0 + dir * (i % 2 ? 5 : 0) * B + (i % 2 ? wob : -wob)); } };
      ctx.beginPath(); ctx.moveTo(-10, yc - hh / 2); edge(yc - hh / 2, -1); ctx.lineTo(cvw + 10, yc + hh / 2);
      for (let i = teeth; i >= 0; i--) { const x = (cvw + 20) * i / teeth - 10; ctx.lineTo(x, yc + hh / 2 + (i % 2 ? 5 : 0) * B + (i % 2 ? -wob : wob)); }
      ctx.closePath();
      ctx.fillStyle = "rgba(10,34,40,0.95)"; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2 * B; ctx.stroke();
      const img = bust(a), bs = Math.max(1, Math.floor((hh * 0.8) / img.height)), bw = img.width * bs, bh = img.height * bs;
      const left = heroX > cvw / 2, bx = left ? cvw * 0.06 : cvw * 0.94 - bw, by = yc - bh / 2;
      const r0 = left ? bx + bw + 6 * B : cvw * 0.06, r1 = left ? cvw * 0.94 : bx - 6 * B, tx = (r0 + r1) / 2;
      const name = (b.e.k || "").toUpperCase();
      // the name keeps to the band's middle third, so the header and the line under it never touch it on a small screen
      let size = Math.min(15, 280 / Math.max(6, name.length), hh / B * 0.3);
      ctx.font = `${R(size * B)}px ${FONT}`;
      const tw = ctx.measureText(name).width;
      if (tw > (r1 - r0) * 0.94) size = Math.max(6, size * (r1 - r0) * 0.94 / tw);
      // on a phone the line under the name would be a few pixels tall: the log under the stage already carries it
      const sub = (cv.clientWidth || cvw) >= 480;
      const spell = b.e.spell && b.e.spell !== "Attack" ? b.e.spell : "a stray spark", line = trunc(b.e.say || `${a.name} · ${spell}`, 56);
      const wide = (str, sz) => { ctx.font = `${R(sz * B)}px ${FONT}`; return ctx.measureText(str).width; };
      const half = Math.max(wide("WILD SURGE!", 6), wide(name, size), sub ? wide(line, 5) : 0) / 2 + 4 * B;
      // loose magic drifting through the band, kept off the words
      const rnd = hashRng(b.ev[0] + 9), cols = [col, "#f6efd8", "#ffd65a", "#7cc0ec"];
      const onText = (x, y, s) => x + 2 * s > tx - half && x - s < tx + half && y + 2 * s > yc - hh * 0.26 - 8 * B && y - s < yc + (sub ? hh * 0.36 + 3 * B : size * B * 0.6);
      for (let n = 0; n < 36; n++) {
        const x = (rnd() * cvw * 1.2 + (calm ? 0 : u * (60 + rnd() * 140) * B)) % (cvw + 20) - 10, y = yc - hh / 2 + rnd() * hh, s = (1 + Math.floor(rnd() * 2)) * B;
        const al = 0.4 + 0.6 * rnd();
        if (onText(x, y, s)) continue;
        ctx.fillStyle = cols[n % cols.length]; ctx.globalAlpha = k * al;
        ctx.fillRect(R(x), R(y), s, s);
        if (n % 9 === 0) { ctx.fillRect(R(x - s), R(y), s, s); ctx.fillRect(R(x + s), R(y), s, s); ctx.fillRect(R(x), R(y - s), s, s); ctx.fillRect(R(x), R(y + s), s, s); }
      }
      ctx.globalAlpha = k;
      ctx.fillStyle = col; ctx.fillRect(bx - 2 * B, by - 2 * B, bw + 4 * B, bh + 4 * B);
      ctx.fillStyle = "#0a2228"; ctx.fillRect(bx, by, bw, bh);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(img, bx, by, bw, bh);
      txt("WILD SURGE!", tx, yc - hh * 0.26, 6, col, "center", B);
      txt(name, tx + (calm ? 0 : Math.sin(u * 23) * 0.6 * B), yc + size * B * 0.35, size, "#f6efd8", "center", B);
      if (sub) txt(line, tx, yc + hh * 0.36, 5, "#bfe8e0", "center", B);
      ctx.restore();
      // the caster stands in front of it, rimmed in the surge's colour
      const img2 = sprite(a, 0), px = X(an.x) - img2.width * K / 2, py = Y(a.y) - img2.height * K, rim = flat(img2, col);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(rim, px + dx * K, py + dy * K, img2.width * K, img2.height * K);
      ctx.drawImage(img2, px, py, img2.width * K, img2.height * K);
    }
    function cutin(slot, u, B, K, X, Y) {
      if (slot.members[0].b.e.fx === "surge") return surgeCutin(slot, u, B, K, X, Y);
      const cvw = cv.width, cvh = cv.height, b = slot.members[0].b, a = units[b.a], an = anchors[b.a] || { x: a.x, y: a.y, top: a.y - a.sh };
      const inK = calm ? 1 : ease(u / 0.16), outK = calm ? 1 : ease((slot.pre - u) / 0.14), k = Math.min(inK, outK);
      // the band goes where the hero isn't: above them when they stand low in the frame, and the bust at the far end
      const heroY = Y(an.top), heroX = X(an.x), above = heroY > cvh * 0.42;
      const yc = above ? cvh * 0.3 : cvh * 0.72, hh = cvh * 0.2, slant = cvh * 0.08;
      const shift = (1 - k) * cvw * (heroX < cvw / 2 ? 1 : -1);
      ctx.save(); ctx.translate(shift, 0);
      ctx.fillStyle = "rgba(34,22,18,0.95)";
      ctx.beginPath(); ctx.moveTo(-10, yc - hh / 2 + slant); ctx.lineTo(cvw + 10, yc - hh / 2 - slant); ctx.lineTo(cvw + 10, yc + hh / 2 - slant); ctx.lineTo(-10, yc + hh / 2 + slant); ctx.closePath(); ctx.fill();
      const rnd = hashRng(b.ev[0] + 5);
      ctx.strokeStyle = "rgba(200,150,62,0.35)"; ctx.lineWidth = Math.max(1, B * 0.5);
      for (let n = 0; n < 30; n++) { const x = rnd() * cvw, y = yc - hh / 2 + rnd() * hh, L = (10 + rnd() * 50) * B, s = -2 * slant / cvw; ctx.beginPath(); ctx.moveTo(x - u * 400 * B, y + s * x); ctx.lineTo(x + L - u * 400 * B, y + s * (x + L)); ctx.stroke(); }
      ctx.strokeStyle = "#f0c450"; ctx.lineWidth = 2 * B;
      ctx.beginPath(); ctx.moveTo(-10, yc - hh / 2 + slant); ctx.lineTo(cvw + 10, yc - hh / 2 - slant); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10, yc + hh / 2 + slant); ctx.lineTo(cvw + 10, yc + hh / 2 - slant); ctx.stroke();
      const img = bust(a), bs = Math.floor((hh * 0.86) / img.height), bw = img.width * bs, bh = img.height * bs;
      const left = heroX > cvw / 2, bx = left ? cvw * 0.06 : cvw * 0.94 - bw, by = yc - bh / 2 + (left ? slant * 0.7 : -slant * 0.7);
      ctx.fillStyle = "#f0c450"; ctx.fillRect(bx - 2 * B, by - 2 * B, bw + 4 * B, bh + 4 * B);
      ctx.fillStyle = "#2a1c16"; ctx.fillRect(bx, by, bw, bh);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(img, bx, by, bw, bh);
      ctx.restore();
      // the hero stands in front of their own band, rimmed in gold
      const img2 = sprite(a, 0), sc = K;
      const px = X(an.x) - img2.width * sc / 2, py = Y(a.y) - img2.height * sc;
      const gold = flat(img2, "#f0c450");
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(gold, px + dx * sc, py + dy * sc, img2.width * sc, img2.height * sc);
      ctx.drawImage(img2, px, py, img2.width * sc, img2.height * sc);
      // the move's name goes in the widest stretch of band the hero doesn't cover, sized to fit it, and on top of everything
      const r0 = left ? bx + bw + 4 * B : cvw * 0.06, r1 = left ? cvw * 0.94 : bx - 4 * B, h0 = px - shift - 3 * sc, h1 = px - shift + img2.width * sc + 3 * sc;
      const segs = [[r0, Math.min(r1, h0)], [Math.max(r0, h1), r1]].filter(([p, q]) => q > p);
      const [s0, s1] = segs.length && !(h1 <= r0 || h0 >= r1) ? segs.reduce((m, g) => (g[1] - g[0] > m[1] - m[0] ? g : m)) : [r0, r1];
      const fits = s1 - s0 >= (r1 - r0) * 0.4, [c0, c1] = fits ? [s0, s1] : [r0, r1], tx = (c0 + c1) / 2;
      const name = (b.e.k || "").toUpperCase(), h = a.kind === "hero" && heroes[a.ref];
      let size = Math.min(16, 300 / Math.max(6, name.length));
      ctx.font = `${R(size * B)}px ${FONT}`;
      const tw = ctx.measureText(name).width;
      if (tw > (c1 - c0) * 0.94) size = Math.max(6, size * (c1 - c0) * 0.94 / tw);
      // the band slopes, so the words sit on its centre line where they are, not where the band's middle is
      const off = slant * (1 - 2 * tx / cvw) * 0.8;
      ctx.save(); ctx.translate(shift, 0);
      txt(name, tx, yc - 1 * B + off, size, "#ffd65a", "center", B);
      txt(trunc(h ? `${a.name}, ${A.clsName ? A.clsName(h.cls) : h.cls} · level ${h.level}`.toUpperCase() : a.name.toUpperCase(), 44), tx, yc + off + Math.min(10 * B, hh * 0.3), 5, "#d8c8a0", "center", B);
      ctx.restore();
    }
    function bossIntro(slot, u, B, X, Y, K) {
      const cvw = cv.width, q = units[slot.who], k = Math.min(ease(u / 0.2), ease((slot.len - u) / 0.25));
      ctx.globalAlpha = 0.5 * k; ctx.fillStyle = "#0a0608"; ctx.fillRect(0, 0, cvw, cv.height); ctx.globalAlpha = 1;
      const img = sprite(q, R(u * 4) % 2), sc = K, px = X(q.x) - img.width * sc / 2, py = Y(q.y) - img.height * sc;
      const rim = flat(img, "#e2645c");
      ctx.globalAlpha = k;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(rim, px + dx * sc, py + dy * sc, img.width * sc, img.height * sc);
      ctx.drawImage(img, px, py, img.width * sc, img.height * sc);
      txt(q.name.toUpperCase(), Math.min(cvw * 0.75, Math.max(cvw * 0.25, X(q.x))), Y(q.y - q.sh) - 10 * B, 10, "#ff8a6a", "center", B);
      txt("BOSS", Math.min(cvw * 0.75, Math.max(cvw * 0.25, X(q.x))), Y(q.y - q.sh) - 22 * B, 5.5, "#f6ebd0", "center", B);
      ctx.globalAlpha = 1;
    }

    // the outro answers the intro: once the body is down, BOSS SLAIN over the name, the field dimmed under it
    function bossOutro(t, slot, B) {
      const im = P.impacts.find((x) => x.boss && x.slot === slot), q = im && units[im.t];
      if (!q) return;
      const a = t - im.T - BOSS_WAIT, t0 = Deaths.land(q) + 0.15, t1 = Deaths.len(q) + 0.9;
      const k = calm ? (a > t0 && a < t1 ? 1 : 0) : Math.min(ease(seg(a, t0, t0 + 0.25)), 1 - seg(a, t1 - 0.3, t1));
      if (k <= 0) return;
      const cvw = cv.width, cvh = cv.height;
      ctx.globalAlpha = 0.35 * k; ctx.fillStyle = "#0a0608"; ctx.fillRect(0, R(cvh * 0.1), cvw, R(cvh * 0.8)); ctx.globalAlpha = k;
      txt("BOSS SLAIN", cvw / 2, cvh * 0.27, 6.5, "#f0c450", "center", B);
      txt(q.name.toUpperCase(), cvw / 2, cvh * 0.27 + 13 * B, 10, "#ff8a6a", "center", B);
      ctx.globalAlpha = 1;
    }

    // ---------- the page beside the stage ----------
    function syncRoster(st, t) {
      for (const q of units) {
        const r = q && rows[q.i];
        if (!r) continue;
        const s = st[q.i], key = `${s.shown !== null}|${s.down != null}|${s.fled != null}|${R(s.hp)}`;
        if (key === r.key) continue;
        r.key = key;
        r.row.hidden = s.shown === null;
        r.row.classList.toggle("out", s.down != null || s.fled != null);
        r.fill.style.width = `${clamp((100 * s.hp) / Math.max(1, q.maxhp), 0, 100)}%`;
        r.num.textContent = s.down != null ? "down" : s.fled != null ? "fled" : `${Math.max(0, R(s.hp))}/${q.maxhp}`;
      }
    }
    let curLine = -1;
    function syncLog(li) {
      if (li === curLine) return;
      if (lines[curLine]) lines[curLine].classList.remove("cur");
      curLine = li;
      if (lines[li]) { lines[li].classList.add("cur"); logBox.scrollTop = lines[li].offsetTop - logBox.offsetTop - 120; }
    }

    // ---------- sound, only when the replay plays through a moment ----------
    let lastT = -1;
    function sounds(t0, t1) {
      if (t0 < 0 || t1 <= t0 || t1 - t0 > 0.5) return;
      const fx = realFX();
      for (const s of P.slots) for (const m of s.members) {
        const b = m.b;
        if (b.kind !== "act") continue;
        const st0 = s.t0 + (s.pre || 0);
        if (st0 > t0 && st0 <= t1 && fx && s.kind !== "merge") FightFX.sound(b.look.family, params(b), "cast", 0);
      }
      for (const im of P.impacts) {
        if (im.T <= t0 || im.T > t1) continue;
        const sch = im.b && im.b.look.params.school;
        if (fx) {
          // the impact phase already carries the family's hit and the crit sting; a plain sting covers the rest
          if (im.kind === "hit" || im.kind === "crit") { if (im.k === 0 && im.slot.kind !== "merge") FightFX.sound(im.b.look.family, params(im.b, im.crit ? "crit" : "hit"), "impact", 0); else FightFX.sting(im.crit ? "crit" : im.heavy ? "heavy" : "hit", sch, 0); }
          else if (im.kind === "miss") FightFX.sting("miss", sch, 0);
          else if (im.kind === "heal") FightFX.sting("heal", sch, 0);
          else if (im.kind === "tick") FightFX.sting("tick", sch, 0);
          else if (im.kind === "down") FightFX.sting(im.kill ? "ko" : "heavy", sch, 0);
        } else if (window.Sound) Sound.sfx({ hit: "hit", crit: "crit", miss: "miss", heal: "heal", down: "down" }[im.kind]);
      }
      if (P.end > t0 && P.end <= t1 && window.Sound && f.winner === 0) Sound.sfx("win");
    }

    // ---------- the loop: runs only while the stage is on screen ----------
    let raf = 0, last = 0;
    function step(now) {
      raf = 0;
      if (!cv.isConnected) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playing) T = Math.min(P.total, T + dt * speed);
      if (playing && lastT >= 0) sounds(lastT, T);
      lastT = T;
      draw(T);
      // the end card holds still, so the loop stops there (and while paused); Play or Restart starts it again
      if (playing && T >= P.total) playing = false;
      if (playing && visible && !document.hidden) raf = requestAnimationFrame(step);
    }
    function kick() { if (!raf && playing && cv.isConnected) { last = performance.now(); raf = requestAnimationFrame(step); } }
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) kick(); });
      io.observe(cv);
    }
    document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
    cv.addEventListener("click", () => { if (T < P.end && P.slots.some((s) => s.cutin && T >= s.t0 && T < s.t0 + s.pre)) { const s = P.slots.find((x) => x.cutin && T >= x.t0 && T < x.t0 + x.pre); T = s.t0 + s.pre; lastT = -1; if (!playing) draw(T); } });
    // a hook for review tools: render any moment of the replay
    cv.replay = { plan: P, draw: (t) => { T = t; lastT = -1; draw(t); }, pause: () => { playing = false; } };
    draw(0);
    kick();
  }
  // "Vessimir the Unburied's Avenger's Skeleton" would cut to the same "Vessimir the Unburied…" as its master in the list
  function summonName(s) { const p = s.split("'s "); return p.length > 2 ? p.slice(-2).join("'s ") : s; }
  function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function outcomeText(f) {
    const L0 = f.labels[0], L1 = f.labels[1];
    if (f.outcome === "stalemate" || f.winner == null) return "Stalemate";
    // fled_label (league/fights.py) names only the ones who ran, so a boss cut down before the rest fled isn't said to flee
    const w = f.winner === 0 ? L0 : L1, l = (f.winner === 0 && f.fled_label) || (f.winner === 0 ? L1 : L0);
    // when some fell and only the rest ran, the win comes first: "The Verdant Sigil wins; a Goblin Shaman flees"
    if (f.outcome === "fled" && f.winner === 0 && f.fled_label) return `${vb(w, "wins", "win")}; ${vb(l, "flees", "flee")}`;
    return { wiped: vb(w, "wins", "win"), fled: vb(l, "flees", "flee"), surrender: vb(l, "surrenders", "surrender") }[f.outcome] || vb(w, "wins", "win");
  }
})();
