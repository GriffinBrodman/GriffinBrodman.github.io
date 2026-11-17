/* The Mountain (#/gods): this week's news from the gods, the halls at dusk, the feed, the Altar and the family; and each god's page (#/god/<id>). */
/*
  Reads only what league/export.py writes (gods on):
    S.gods (data/static_gods.js, lazy)  { ring: [id], rows: [[id, id] x5], family: [{gods: [a, b], text}],
                                          by: {id: {name, title, domain, fire, fire_name, rival, grudge, friends: [id], voice,
                                                    seat: {town, where, keeper}, shrines: [place id], saints: [name],
                                                    page: {top, wants, flaw, grudge, likes, hates, seat?, family?, aside?},
                                                    likes, hates, races: {won, lost, drawn} (this age), artifact: {id, name, wants, plural} | null}} }
    L.gods (data/league.js)             { week: {day, top, box: [{kind, text, gods, heroes}]}, feuds: [[a, b]], lit: [id],
                                          next_feast: {god, day, town} | null, feasts: [{god, day, town}], sable: {said, day} | null,
                                          by: {id: {mood, face, followers: [hid], sworn: [hid], fond: [hid],
                                                    asks: [{hero, text, got, need, left, great}],
                                                    artifact: {name, holder, text} | null}} }
    L.events with a `god` field         the feed, and each god's last answers and wraths
*/
(function () {
  "use strict";
  const A = App;
  const { el, heroes, L, S } = A;
  // a hero's private luck is the hero page's; the Mountain's feed is what the gods did
  const QUIET = new Set(["god_luck", "god_bad_luck"]);
  const ANSWERS = new Set(["god_answer", "god_miracle", "god_wrath", "god_luck", "god_bad_luck", "god_ask_met"]);
  const BOX_LABEL = { contest: "A contest", feud: "A feud", feast: "A feast day", sable: "Sable Vey", mood: "A mood" };

  const G = () => S.gods || null;
  const LG = () => (L && L.gods) || null;
  const god = (id) => (G() && G().by[id]) || null;
  const live = (id) => (LG() && LG().by && LG().by[id]) || {};
  const nameOf = (id) => (god(id) || {}).name || id;
  const fireOf = (id) => (god(id) || {}).fire || "#c8963e";
  // a god page's frame and labels wear the god's fire, but the Veiled One's violet is her candle's alone (docs/gods/LOOKS.md):
  // her page is framed in the hall's cool stone
  const CHROME = { veiled: "#aab6c6" };
  const chromeOf = (id) => CHROME[id] || fireOf(id);

  function copyCanvas(src, scale, cls) {
    const c = el("canvas", { width: src.width, height: src.height, class: "god-px" + (cls ? " " + cls : "") });
    c.getContext("2d").drawImage(src, 0, 0);
    c.style.width = src.width * scale + "px";
    c.style.height = src.height * scale + "px";
    return c;
  }
  // the 32 px bust; its shown size is the stylesheet's (32 css px, smaller inside a sentence)
  function icon(id) {
    if (!window.GodArt) return el("span", { class: "god-dot", style: { background: fireOf(id) } });
    const src = GodArt.icon(id, live(id).face), c = el("canvas", { width: src.width, height: src.height, class: "god-px god-icon", "aria-hidden": "true" });
    c.getContext("2d").drawImage(src, 0, 0);
    return c;
  }
  function godLink(id, opts) {
    opts = opts || {};
    return el("a", { class: "god-link", href: `#/god/${id}`, style: { "--fire": fireOf(id) } }, opts.icon === false ? null : icon(id), el("span", null, opts.text || nameOf(id)));
  }
  function line(text, hids) { return A.richText(text, hids || [], []); }
  function heroFace(hid, scale) {
    const h = heroes[hid];
    if (!h) return null;
    return el("a", { class: "god-hero", href: `#/hero/${hid}`, title: h.name }, A.heroPortrait(h, scale || 1, { noGray: true }), el("span", null, h.name));
  }
  function faces(hids, scale) {
    const xs = (hids || []).map((h) => heroFace(h, scale)).filter(Boolean);
    return xs.length ? el("div", { class: "god-heroes" }, xs) : null;
  }
  function weekEvents(pred) {
    const day = L.meta.day;
    return (L.events || []).filter((e) => e.god !== "vashk" && pred(e)).filter((e) => e.day > day - 7).sort((a, b) => b.day - a.day || (b.imp || 0) - (a.imp || 0));
  }
  function ready(cb) {
    if (window.GodArt) {
      const fires = {};
      for (const id of Object.keys((G() || {}).by || {})) fires[id] = G().by[id].fire;
      GodArt.init({ fires });
      GodArt.ready(cb);
    } else cb();
  }
  function quiet(v) {
    v.appendChild(el("div", { class: "panel" }, el("h2", null, "The Mountain"),
      el("p", null, "No gods keep halls in this league. ", el("a", { href: "#/" }, "Back to the Crier."))));
  }

  // ---------- the scene ----------
  function sceneOpts() {
    const lg = LG() || {}, lit = {}, moods = {};
    for (const id of lg.lit || []) lit[id] = true;
    for (const id of Object.keys(lg.by || {})) if (lg.by[id].face) moods[id] = lg.by[id].face;
    const fires = {};
    for (const id of Object.keys(G().by)) fires[id] = G().by[id].fire;
    return { fires, lit, moods, feuds: lg.feuds && lg.feuds.length ? lg.feuds : undefined };
  }
  function scene(wrap, scale, strip, onGod) {
    const MS = window.MountainScene;
    wrap.innerHTML = "";
    if (!MS) return;
    const cv = MS.canvas(Object.assign(sceneOpts(), { scale, strip, label: strip ? "The top of the Mountain: the hole in the stars, and Brannock's and Marrow's halls" : "The Mountain at dusk: ten halls up a stair" }));
    const box = el("div", { class: "mtn-frame" + (strip ? " strip" : ""), style: { width: MS.W * scale + "px", height: (strip ? MS.STRIP : MS.H) * scale + "px" } }, cv);
    if (strip) {
      // the strip itself climbs on a tap; the labelled button sits under the picture, never over a doorway
      box.appendChild(el("button", { class: "mtn-climb", type: "button", tabindex: "-1", "aria-hidden": "true", onclick: () => onGod(null) }));
      wrap.appendChild(box);
      wrap.appendChild(el("button", { class: "mtn-climb-go", type: "button", onclick: () => onGod(null) }, "Climb the Mountain ▾"));
      return box;
    } else {
      for (const id of Object.keys(MS.HALLS)) {
        if (!god(id)) continue;
        const h = MS.HALLS[id];
        box.appendChild(el("button", { class: "mtn-hall", type: "button", title: god(id).title, "aria-label": god(id).title,
          style: { left: h.x * scale + "px", top: h.y * scale + "px", width: 64 * scale + "px", height: 64 * scale + "px" },
          onclick: (ev) => { ev.stopPropagation(); onGod(id); } }));
      }
    }
    wrap.appendChild(box);
    return box;
  }
  function card(id, close) {
    const g = god(id), lv = live(id);
    const fig = window.GodArt ? GodArt.idle(id, { side: MountainScene.HALLS[id] && MountainScene.HALLS[id].side === "r" ? "l" : "r", mood: lv.face, scale: 2, cls: "god-fig" }) : null;
    return el("div", { class: "god-card", style: { "--fire": g.fire }, role: "dialog", "aria-label": g.title },
      el("button", { class: "god-card-x", type: "button", "aria-label": "Close", onclick: close }, "×"),
      el("div", { class: "god-card-top" }, fig,
        el("div", null, el("div", { class: "god-card-name" }, g.title), el("div", { class: "small muted" }, A.cap(g.domain)),
          lv.mood ? el("div", { class: "god-mood" }, lv.mood) : null)),
      g.page && g.page.top ? el("p", { class: "god-voice" }, g.page.top) : null,
      el("a", { class: "god-card-go", href: `#/god/${id}` }, `${A.cap(g.name)}'s page ›`));
  }

  // ---------- #/gods ----------
  A.route(/^\/gods\/?$/, (v) => {
    if (!G() || !LG()) return quiet(v);
    ready(() => mountain(v));
  });

  function mountain(v) {
    const lg = LG(), wk = lg.week || {};
    const page = el("div", { class: "mtn-page" });
    v.appendChild(page);
    const news = el("section", { class: "panel mtn-news" }, el("h2", null, "This week on the Mountain"));
    const box = (wk.box || []).filter((x) => !(x.gods || []).includes("vashk"));
    if (box.length) news.appendChild(el("ul", { class: "mtn-box" }, box.map((x) => el("li", { style: { "--fire": fireOf((x.gods || [])[0]) } },
      (x.gods || [])[0] && god(x.gods[0]) ? el("a", { class: "mtn-box-icon", href: `#/god/${x.gods[0]}`, title: nameOf(x.gods[0]) }, icon(x.gods[0]))
        : x.kind === "sable" && window.GodArt && GodArt.sable ? el("span", { class: "mtn-box-icon", title: "Sable Vey" }, copyCanvas(GodArt.sable(), 1, "god-icon"))
        : el("span", { class: "mtn-box-icon none" }),
      el("div", null, el("div", { class: "mtn-box-kind" }, BOX_LABEL[x.kind] || ""), el("div", null, line(x.text, x.heroes)))))));
    // the box is first filled at the end of the gods' first week (gods_ledger.weekly, every seventh day); until then there is no week to sum up
    else news.appendChild(el("p", { class: "muted" }, wk.day ? "A quiet week on the Mountain." : "The gods' first week is still under way. The Mountain sums it up when the week ends."));
    const more = [];
    if (lg.sable && lg.sable.said) more.push(el("p", { class: "mtn-sable" }, line(lg.sable.said)));
    if (lg.next_feast && god(lg.next_feast.god)) more.push(feastLine(lg.next_feast));
    if (more.length) news.appendChild(el("div", { class: "mtn-also" }, more));
    page.appendChild(news);

    const desk = matchMedia("(min-width: 900px)").matches;
    const stage = el("section", { class: "mtn-stage" });
    const sc = el("div", { class: "mtn-scene" });
    const art = el("div", { class: "mtn-art" });
    const slot = el("div", { class: "god-card-slot" });
    sc.append(art, slot);
    stage.appendChild(sc);
    const scale = desk ? 3 : 2;
    const closeCard = () => { slot.innerHTML = ""; slot.classList.remove("open"); };
    const openCard = (id) => {
      slot.innerHTML = "";
      slot.appendChild(card(id, closeCard));
      slot.classList.add("open");
      const h = MountainScene.HALLS[id];
      slot.style.top = Math.max(0, Math.min((h.y + 60) * scale, MountainScene.H * scale - slot.offsetHeight - 8)) + "px";
      slot.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    const full = () => { scene(art, scale, false, (id) => id && openCard(id)); sc.classList.add("full"); sc.classList.remove("strip"); };
    if (desk) full();
    else { scene(art, 2, true, full); sc.classList.add("strip"); }
    art.addEventListener("click", (e) => { if (!e.target.closest(".mtn-hall")) closeCard(); });

    const side = el("div", { class: "mtn-side" });
    // a god's running joke once a week (export._feed_quiet)
    const joke = new Set((LG() || {}).feed_quiet || []);
    const feedList = weekEvents((e) => /^god_/.test(e.kind || "") && !QUIET.has(e.kind) && !joke.has(e.id));
    side.appendChild(el("section", { class: "panel mtn-feed" }, el("h2", null, "What the gods were up to"),
      el("p", { class: "small muted" }, "The last seven days: feast days, feuds, answers, asks and Sable Vey's word."),
      A.feed(feedList.slice(0, 30), { dayHeaders: true, empty: "Nothing stirred on the Mountain this week.", noShare: true })));
    side.appendChild(altar());
    side.appendChild(family());
    stage.appendChild(side);
    page.appendChild(stage);
  }

  function feastLine(f) {
    return el("p", { class: "mtn-feast" }, "Next feast day: ", godLink(f.god), ", ", A.when(f.day, "on"), f.town ? [" in ", el("a", { href: A.placeHref(f.town) }, A.nodeName(f.town))] : null, ".");
  }

  function altar() {
    const g = G(), rows = [];
    for (const id of g.ring) {
      const x = god(id), lv = live(id);
      if (!x) continue;
      const who = (lv.followers || []).filter((h) => heroes[h]);
      rows.push(el("li", { style: { "--fire": x.fire } },
        el("a", { class: "altar-god", href: `#/god/${id}` }, icon(id), el("span", null, A.cap(x.name))),
        el("span", { class: "altar-mood" }, lv.mood || "keeps to the hall"),
        el("span", { class: "altar-who" }, who.length ? who.slice(0, 8).map((h) => el("a", { href: `#/hero/${h}`, title: heroes[h].name }, A.heroPortrait(heroes[h], 1, { noGray: true }))) : el("span", { class: "dim small" }, "no one yet"))));
    }
    const lg = LG();
    return el("details", { class: "panel mtn-altar" }, el("summary", null, el("h2", null, "The Altar")),
      el("p", { class: "small muted" }, "Who prays to whom (each hero counts for the god they pray to most), and how each god is this week."),
      el("ul", { class: "altar" }, rows), lg.next_feast && god(lg.next_feast.god) ? feastLine(lg.next_feast) : null);
  }

  // this age's races from the god's side (static_gods by.<id>.races, gods_contests.record): {won, lost, drawn}; none run, no line
  function raceRecord(r) {
    if (!r || typeof r !== "object") return null;
    const n = (k) => Math.max(0, +r[k] || 0), won = n("won"), lost = n("lost"), drawn = n("drawn");
    if (!won && !lost && !drawn) return null;
    const parts = [`won ${won}`, `lost ${lost}`].concat(drawn ? [`drawn ${drawn}`] : []);
    return el("p", { class: "god-races" }, el("span", { class: "kin-k" }, "Races"), `This age: ${parts.join(", ")}.`,
      r.last && r.last.text ? el("span", { class: "small muted god-races-last" }, line(r.last.text, r.last.heroes)) : null);
  }
  function family() {
    const g = G(), rows = (g.family || []).filter((f) => f.gods.every((id) => god(id)));
    const pairs = g.rows || [];
    return el("details", { class: "panel mtn-family" }, el("summary", null, el("h2", null, "The family")),
      el("p", { class: "small muted" }, "One house on one mountain. The rivals live across the stair from each other; the oldest quarrels are nearest the sky."),
      pairs.length ? el("ol", { class: "fam-rows" }, pairs.map((p) => el("li", null, p.map((id, i) => [i ? el("span", { class: "fam-stair" }, rivalOf(p) ? "⚔" : "·") : null, god(id) ? godLink(id) : null])))) : null,
      rows.length ? el("ul", { class: "fam-feuds" }, rows.map((f) => el("li", null, el("span", { class: "fam-pair" }, godLink(f.gods[0], { text: nameOf(f.gods[0]) }), " and ", godLink(f.gods[1], { text: nameOf(f.gods[1]) })), el("div", null, line(f.text))))) : null);
  }
  function rivalOf(pair) { return god(pair[0]) && god(pair[0]).rival === pair[1]; }

  // ---------- #/god/<id> ----------
  A.route(/^\/god\/(\w+)\/?$/, (v, id) => {
    if (!G() || !LG()) return quiet(v);
    if (!god(id)) {
      v.appendChild(el("div", { class: "panel" }, el("h2", null, "No hall by that name"), el("p", null, el("a", { href: "#/gods" }, "Back to the Mountain."))));
      return;
    }
    ready(() => godPage(v, id));
  });

  function portrait(id) {
    const st = window.GodArt && GodArt.still(id, live(id).face);
    const frame = el("div", { class: "god-portrait" });
    if (st) {
      frame.appendChild(el("img", { src: st.base, alt: god(id).title, width: 128, height: 128, class: "god-px" }));
      if (st.over) frame.appendChild(el("img", { src: st.over, alt: "", width: 128, height: 128, class: "god-px god-over", "aria-hidden": "true", style: { position: "absolute", left: "0", top: "0" } }));
      frame.style.position = "relative";
      return frame;
    }
    if (window.MountainScene && MountainScene.HALLS[id]) {
      const s = MountainScene.build(sceneOpts()), h = MountainScene.HALLS[id];
      const c = el("canvas", { width: 64, height: 64, class: "god-px", role: "img", "aria-label": `${god(id).title} in the doorway of the hall` });
      c.getContext("2d").drawImage(s.base, h.x, h.y, 64, 64, 0, 0, 64, 64);
      frame.appendChild(c);
      frame.classList.add("hall");
    }
    return frame;
  }

  function godPage(v, id) {
    const g = god(id), lv = live(id), P = g.page || {};
    const ring = G().ring.filter((x) => god(x)), at = ring.indexOf(id);
    const prev = ring[(at + ring.length - 1) % ring.length], next = ring[(at + 1) % ring.length];
    const page = el("div", { class: "god-page", style: { "--fire": chromeOf(id) } });
    v.appendChild(page);
    page.appendChild(el("div", { class: "god-crumbs small" }, el("a", { href: "#/gods" }, "‹ The Mountain"),
      el("span", { class: "god-step" }, el("a", { href: `#/god/${prev}`, title: nameOf(prev) }, "‹ ", nameOf(prev)), " · ", el("a", { href: `#/god/${next}`, title: nameOf(next) }, nameOf(next), " ›"))));
    const facts = [["Wants", P.wants], ["Flaw", P.flaw], ["Grudge", P.grudge], ["Likes", P.likes || g.likes], ["Hates", P.hates || g.hates]].filter((x) => x[1]);
    const head = el("header", { class: "god-head" }, portrait(id),
      el("div", { class: "god-id" },
        el("h1", null, A.cap(g.title)),
        el("div", { class: "god-domain" }, A.cap(g.domain)),
        el("div", { class: "god-fire small" }, el("span", { class: "god-swatch" }), `The light in ${g.name}'s hall: ${g.fire_name}.`),
        lv.mood ? el("div", { class: "god-mood" }, lv.mood) : null,
        P.top ? el("p", { class: "god-voice god-top" }, line(P.top)) : null,
        facts.length ? el("dl", { class: "god-facts" }, facts.map(([k, t]) => [el("dt", null, k), el("dd", { class: "god-voice" }, line(t))])) : null,
        P.aside ? el("p", { class: "small god-aside" }, line(P.aside)) : null));
    page.appendChild(head);

    const cols = el("div", { class: "god-cols" });
    const main = el("div", { class: "god-main" }), side = el("div", { class: "god-sidecol" });
    cols.append(main, side);
    page.appendChild(cols);

    const sworn = (lv.sworn || []).filter((h) => heroes[h]), fond = (lv.fond || []).filter((h) => heroes[h] && !sworn.includes(h));
    const follow = (lv.followers || []).filter((h) => heroes[h] && !sworn.includes(h) && !fond.includes(h));
    main.appendChild(el("section", { class: "panel god-people" }, el("h2", null, `${A.cap(g.name)}'s people`),
      sworn.length ? [el("h4", null, `Sworn to ${g.name}`), faces(sworn, 2)] : null,
      fond.length ? [el("h4", null, `${A.cap(g.name)}'s favourites`), faces(fond, 2)] : null,
      follow.length ? [el("h4", null, "Pray to it most"), faces(follow, 1)] : null,
      !sworn.length && !fond.length && !follow.length ? el("p", { class: "muted" }, `Nobody in the league has caught ${g.name}'s eye yet.`) : null));

    const asks = (lv.asks || []).filter((a) => heroes[a.hero]);
    if (asks.length) main.appendChild(el("section", { class: "panel god-asks" }, el("h2", null, `${A.cap(g.name)} asks`),
      el("ul", null, asks.map((a) => el("li", { class: a.great ? "great" : "" }, heroFace(a.hero, 1),
        el("div", null, el("div", { class: "god-voice" }, "“", a.text, "”"),
          el("div", { class: "small muted" }, a.great ? "A big ask · " : "", `${a.got || 0} of ${a.need}`, a.left != null ? `, ${A.plural(Math.max(0, a.left), "day")} left` : "")))))));

    const said = (L.events || []).filter((e) => e.god === id && ANSWERS.has(e.kind)).sort((a, b) => b.day - a.day).slice(0, 10);
    main.appendChild(el("section", { class: "panel god-answers" }, el("h2", null, "Answers and wraths"),
      A.feed(said, { empty: `${A.cap(g.name)} has not answered anyone lately.`, noShare: true })));

    const art = g.artifact, held = lv.artifact;
    if (art) side.appendChild(el("section", { class: "panel god-artifact" }, el("h2", null, art.name),
      el("p", { class: "god-voice" }, line(art.wants ? `${art.plural ? "They want" : "It wants"} ${art.wants}.` : "")),
      held && held.holder && heroes[held.holder] ? [el("h4", null, "Held by"), heroFace(held.holder, 2)] : el("p", { class: "small muted" }, art.plural ? "Nobody holds them. They are still on the Mountain." : "Nobody holds it. It is still on the Mountain."),
      held && held.text ? el("p", { class: "small" }, line(held.text, held.holder ? [held.holder] : [])) : null));

    const kin = [];
    if (g.rival && god(g.rival)) kin.push(el("li", null, el("span", { class: "kin-k" }, "Rival"), godLink(g.rival)));
    if (g.grudge && g.grudge !== g.rival && god(g.grudge)) kin.push(el("li", null, el("span", { class: "kin-k" }, "Grudge"), godLink(g.grudge)));
    for (const f of g.friends || []) if (god(f)) kin.push(el("li", null, el("span", { class: "kin-k" }, "Friend"), godLink(f)));
    const story = (G().family || []).filter((f) => f.gods.includes(id));
    side.appendChild(el("section", { class: "panel god-kin" }, el("h2", null, "The family"), kin.length ? el("ul", { class: "kin" }, kin) : null,
      raceRecord(g.races || lv.races),
      P.family ? el("p", { class: "small" }, line(P.family)) : null,
      story.map((f) => el("p", { class: "small muted" }, line(f.text)))));

    const lg = LG(), kept = (lg.feasts || []).filter((f) => f.god === id).sort((a, b) => b.day - a.day);
    const nf = lg.next_feast && lg.next_feast.god === id ? lg.next_feast : null;
    const seat = g.seat || {};
    side.appendChild(el("section", { class: "panel god-seat" }, el("h2", null, "Where to find it"),
      seat.where ? el("p", null, seat.town ? el("a", { href: A.placeHref(seat.town) }, A.cap(seat.where)) : A.cap(seat.where), seat.keeper ? `, kept by ${seat.keeper}.` : ".") : null,
      P.seat ? el("p", { class: "small god-voice" }, line(P.seat)) : null,
      (g.shrines || []).length ? el("p", { class: "small" }, "Shrines in ", g.shrines.map((p, i) => [i ? (i === g.shrines.length - 1 ? " and " : ", ") : null, el("a", { href: A.placeHref(p) }, A.nodeName(p, true))]), ".") : null,
      (g.saints || []).length ? el("p", { class: "small" }, "Its saints: ", g.saints.join(", "), ".") : null,
      el("h4", null, "Feast days"),
      nf ? el("p", { class: "small" }, "Next: ", A.when(nf.day, true), nf.town ? [" in ", el("a", { href: A.placeHref(nf.town) }, A.nodeName(nf.town))] : null, ".") : null,
      kept.length ? el("ul", { class: "small god-feasts" }, kept.slice(0, 5).map((f) => el("li", null, A.when(f.day), f.town ? [" · ", el("a", { href: A.placeHref(f.town) }, A.nodeName(f.town))] : null)))
        : !nf ? el("p", { class: "small muted" }, g.feast_none || `No feast day for ${g.name} yet this age. There are only a few a season, and the gods take turns, the most followed first.`) : null));
  }

  A.Gods = { icon, godLink };
})();
