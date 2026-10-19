/* The great event's page (#/event, #/event/<season>): where it is, its route and next stop on the island, the countdowns, who has met it,
   the story so far and how it ended; earlier seasons' events below. */
(function () {
  const A = App;
  const { L, S, el, heroes, cap, plural } = A;

  const KIND_WORD = { megabeast: "A megabeast", plague: "A plague", comet: "A falling star", tournament: "The Tournament of Crowns" };
  const sdayOf = (day) => day - (L.meta.day - L.meta.season_day);

  A.route(/^\/event(?:\/(\d+))?$/, (v, season) => {
    const m = L.meta, log = L.hyper_log || [];
    season = season ? Number(season) : L.hyper ? m.season : (log.slice(-1)[0] || {}).season || m.season;
    const live = L.hyper && season === m.season ? L.hyper : null, done = log.filter((x) => x.season === season).slice(-1)[0];
    const story = (L.hyper_story || []).filter((e) => e.season === season);
    v.classList.add("ev-page");
    if (!live && !done) {
      v.appendChild(el("h1", null, "The great event"));
      v.appendChild(panel(null, el("p", null, `Every season has one great event, in its last ten days: a megabeast, a plague, a falling star or the Tournament of Crowns. Omens come a few days before. `,
        Views.helpLink ? Views.helpLink("great-event", "the great event") : null),
        story.length ? storyList(story) : el("p", { class: "small dim" }, season === m.season && m.phase === "season" ? `Season ${season} has ${plural(m.season_length - m.season_day, "day")} to go. Nothing has stirred yet.` : "Nothing came this season.")));
      v.appendChild(earlier(season));
      return;
    }
    const h = live || done;
    v.appendChild(el("p", { class: "small" }, el("a", { href: "#/" }, "‹ The Crier"), " · ", el("a", { href: "#/world" }, "The World"), " · ", el("a", { href: "#/history" }, "History")));
    v.appendChild(head(h, live, season));
    if (live && live.kind === "megabeast") v.appendChild(beastRoute(live));
    else if (live) v.appendChild(panel("Where it is", el("p", null, whereLine(live))));
    if (done) {
      const end = story.filter((e) => e.day === done.end).map((e) => e.sday)[0] || (season === L.meta.season ? sdayOf(done.end) : null);
      v.appendChild(panel("How it ended", el("p", null, el("b", null, cap(done.outcome)), end ? `, on day ${end} of season ${season}` : ` in season ${season}`,
        done.start ? `, ${plural(Math.max(1, done.end - done.start + 1), "day")} after it began.` : ".")));
    }
    const met = metBy(story, live);
    v.appendChild(panel("Who has met it", met.length ? el("ul", { class: "ev-met" }, met) : el("p", { class: "empty" }, h.kind === "megabeast" ? "Nobody has stood against it yet." : "Nobody yet.")));
    v.appendChild(panel("The story so far", storyList(story)));
    v.appendChild(earlier(season));
  });

  function panel(title, ...kids) {
    return el("section", { class: "panel" }, title ? el("h2", null, title) : null, ...kids);
  }
  function sprite(h) {
    if (Views.hyperSprite) { try { return Views.hyperSprite(h); } catch (e) { /* the monster's own sprite below */ } }
    if (h.kind !== "megabeast" || !h.body || !S.monsters[h.body]) return null;
    const c = A.monsterSprite(h.body, 3, true);
    c.classList.add("hy-px");
    return c;
  }
  function head(h, live, season) {
    const day = live ? L.meta.season_day - sdayOf(live.start) + 1 : null;
    const counts = [];
    const count = (n, what) => counts.push(el("div", { class: "hy-count" }, el("b", null, n <= 0 ? "Today:" : n === 1 ? "Tomorrow:" : `${n} days`), el("span", null, n <= 1 ? what : `until ${what}`)));
    if (live) {
      if (live.kind === "megabeast") {
        const next = (live.ahead || [])[0];
        if (live.moves_in != null && (live.path || []).length && !(next && next[0] === live.path[0])) count(live.moves_in, `it moves on from ${A.nodeName(live.loc)}`);
        if (next && next[1] <= live.season_left) count(next[1], `it reaches ${A.nodeName(next[0])}`);
        if (live.market) count(live.market[1], `market day in ${A.nodeName(live.market[0])}`);
      } else if (live.left != null) count(live.left, live.kind === "comet" ? "it cools" : live.kind === "tournament" ? "the first bout" : "it burns out");
      count(live.season_left, "the season ends");
    }
    return el("section", { class: `hy-strip hy-${h.kind} ev-head` },
      el("div", { class: "hy-sprite" }, live ? sprite(live) : null),
      el("div", { class: "hy-body" },
        el("div", { class: "hy-kick" }, el("span", { class: "hy-tag" }, live ? "Now" : "Over"), `The great event of season ${season}${day ? ` · day ${day}` : ""}`,
          Views.helpLink ? Views.helpLink("great-event", "the great event") : null),
        el("h1", { class: "hy-name" }, cap(h.name || KIND_WORD[h.kind] || "The great event")),
        el("p", { class: "hy-line" }, live ? [KIND_WORD[live.kind] || "", live.habit ? `. It ${live.habit}.` : ".", " ", whereLine(live)] : `${KIND_WORD[h.kind] || "It"}: ${h.outcome}.`),
        counts.length ? el("div", { class: "hy-counts" }, counts) : null));
  }
  function whereLine(h) {
    const place = (id) => el("a", { href: A.placeHref(id) }, A.nodeName(id));
    if (h.kind === "megabeast") return [`${h.short || "It"} ${S.towns[h.loc] ? "is in" : "was last seen in"} `, place(h.loc), "."];
    if (h.kind === "plague") return ["It holds ", Object.keys(h.towns || {}).map((t, i, a) => [i ? (i === a.length - 1 ? " and " : ", ") : null, place(t)]), ". Heroes who stay there may come down with it."];
    if (h.kind === "comet") return ["It came down in ", place(h.loc), ". The first hero to reach the crater pulls out the star-metal."];
    if (h.kind === "tournament") return [place(h.town), " hosts it."];
    return [];
  }
  // the beast's road: where it is, every stop ahead with the day it gets there, drawn on the island
  function beastRoute(h) {
    const stops = [[h.loc, 0]].concat((h.path || []).map((n, i) => [n, (h.moves_in || 0) + 2 * i]));
    const ol = el("ol", { class: "ev-route" }, stops.map(([n, d], i) => {
      const late = d > h.season_left, town = !!S.towns[n];
      return el("li", { class: `${i ? "" : "now"}${late ? " late" : ""}${town ? " town" : ""}` },
        el("a", { href: A.placeHref(n) }, A.nodeName(n)),
        el("span", { class: "tiny dim" }, i === 0 ? " · now" : late ? " · after the season ends" : d <= 0 ? " · today" : d === 1 ? " · tomorrow" : ` · in ${d} days`),
        town && i ? el("span", { class: "tiny red" }, " · a town") : null);
    }));
    const next = (h.ahead || [])[0];
    const box = panel("Its road", el("p", { class: "small" }, next ? ["Next town: ", el("b", null, A.nodeName(next[0])), next[1] <= h.season_left ? `, in ${plural(next[1], "day")}.` : ", but the season ends first."] : "It has nowhere left to go."),
      el("div", { class: "ev-route-grid" }, mapWith(stops), ol));
    if (h.stands) box.appendChild(el("p", { class: "small" }, `${plural(h.stands, "stand")} against it so far. Every stand wears it down.`));
    return box;
  }
  function mapWith(stops) {
    if (!window.Scenes || !window.Isle) return el("span");
    const wrap = el("div", { class: "mapwrap ev-map" }), cv = el("canvas"), over = el("canvas", { class: "ev-over", "aria-hidden": "true" });
    wrap.append(cv, over);
    requestAnimationFrame(() => {
      try {
        Scenes.drawMap(cv, {});
        over.width = cv.width; over.height = cv.height;
        // marks are sized for the screen, so the road still reads when a phone shrinks the island to a third
        const k = cv._k || 2, u = Math.max(k / 2, cv.width / Math.max(1, cv.clientWidth)), g = over.getContext("2d");
        const pts = stops.map(([n]) => (S.towns[n] || S.wilds[n] || S.dungeons[n] || {}).xy).filter(Boolean).map((xy) => Isle.project(xy[0], xy[1]).map((x) => x * k));
        g.lineWidth = 5 * u; g.strokeStyle = "rgba(42,27,17,0.85)"; g.setLineDash([]);
        g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        g.lineWidth = 2.5 * u; g.strokeStyle = "#e0443a"; g.setLineDash([7 * u, 5 * u]);
        g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        g.setLineDash([]);
        pts.forEach(([x, y], i) => {
          g.fillStyle = "#2a1b11"; g.beginPath(); g.arc(x, y, (i ? 5 : 8) * u, 0, Math.PI * 2); g.fill();
          g.fillStyle = i ? "#ecc56a" : "#e0443a"; g.beginPath(); g.arc(x, y, (i ? 3.2 : 5.5) * u, 0, Math.PI * 2); g.fill();
        });
      } catch (e) { console.error(e); }
    });
    return wrap;
  }
  function metBy(story, live) {
    const by = {};
    for (const e of story) if (e.kind === "hyper") for (const id of e.heroes || []) (by[id] = by[id] || []).push(e);
    for (const id of (live && live.stood) || []) by[id] = by[id] || [];
    return Object.entries(by).filter(([id]) => heroes[id]).sort((a, b) => b[1].length - a[1].length).map(([id, evs]) =>
      el("li", null, A.heroPortrait(heroes[id], 1), el("div", null, A.heroLink(id), el("span", { class: "tiny dim" }, evs.length ? ` · ${plural(evs.length, "time")}` : ""),
        evs.length ? el("div", { class: "tiny" }, evs.map((e, i) => [i ? " · " : null, `Day ${e.sday || e.day}`, e.fight && A.kept("fight", e.fight) ? [" ", el("a", { class: "watch", href: `#/fight/${e.fight}` }, "▶ watch")] : null])) : null)));
  }
  function storyList(story) {
    if (!story.length) return el("p", { class: "empty" }, "Nothing has happened yet.");
    return el("ol", { class: "timeline small ev-story" }, story.map((e) => el("li", null, el("span", { class: "when" }, `Day ${e.sday || e.day}`), el("div", null, A.storyLine(e)))));
  }
  function earlier(season) {
    const rest = (L.hyper_log || []).filter((x) => x.season !== season);
    if (!rest.length && !(L.hyper && season !== L.meta.season)) return el("span");
    return panel("Every great event", el("ul", { class: "ev-all" },
      L.hyper && season !== L.meta.season ? el("li", null, el("a", { href: "#/event" }, cap(L.hyper.name)), ` · season ${L.meta.season}, happening now`) : null,
      rest.slice().reverse().map((x) => el("li", null, el("a", { href: `#/event/${x.season}` }, cap(x.name || KIND_WORD[x.kind] || x.kind)), ` · season ${x.season}: ${x.outcome}`))));
  }
})();
