/* The weekly digest page (#/digest, #/digest/<season>/<week>). */
(function () {
  const A = App;
  const { L, S, el, events, heroes, parties, plural } = A;
  const { headline, moveMark, panel, partyCard, tellOnce } = Views;

  A.route(/^\/digest(?:\/(\d+)\/(\d+))?$/, (v, s, w) => {
    const ds = (L.digests || []).slice().sort((a, b) => b.season - a.season || b.week - a.week);
    if (!ds.length) { v.appendChild(panel("The Weekly Digest", el("p", { class: "empty" }, "The first digest comes out after the first day of the season."))); return; }
    const d = s ? ds.find((x) => x.season == s && x.week == w) || ds[0] : ds[0];
    const g = el("div", { class: "grid2" });
    const main = el("section", { class: "panel parch" });
    const inProgress = d.season === L.meta.season && L.meta.phase === "season" && d.day_to < d.week * 7;
    main.appendChild(el("div", { class: "mast" }, el("div", { class: "title", style: { fontSize: "34px" } }, "The Weekly Digest"),
      el("div", { class: "sub" }, el("span", null, `Season ${d.season} · Week ${d.week}`), el("span", null, inProgress ? `So far: through day ${d.day_to}` : `Days ${d.day_from}–${d.day_to}`), el("span", null, `${d.events_total} things happened`))));
    const top = d.top.map((id) => events[id]).filter(Boolean);
    if (top[0]) {
      const sc = Scenes.vignette(top[0], 240, 72);
      sc.className = "scene";
      main.appendChild(el("div", { class: "lead" }, el("h1", null, A.richText(headline(top[0]), top[0].heroes, top[0].parties)), sc, el("p", null, A.richText(top[0].text, top[0].heroes, top[0].parties))));
    }
    if (d.column) main.appendChild(el("div", { style: { borderTop: "1px solid #b0915e", borderBottom: "1px solid #b0915e", padding: "8px 0", margin: "8px 0 12px" } },
      el("h4", null, d.columnist ? `From the columnist: ${d.columnist}` : "From the columnist"), el("p", { style: { fontSize: "21px", lineHeight: "1.3" } }, A.richText(d.column, Object.keys(heroes), []))));
    main.appendChild(el("h4", null, "The week's biggest stories"));
    main.appendChild(A.feed(top.slice(1).map(tellOnce(top)), { empty: top.length ? "That was the big one." : "A quiet week." }));
    g.appendChild(main);
    const right = el("div");
    const hw = heroes[d.hero_of_week];
    if (hw) right.appendChild(panel("Hero of the week", A.heroCard(hw),
      el("p", { class: "tiny dim", style: { marginTop: "6px" } }, `The most talked-about hero this week${d.hero_of_week_n ? ` (${plural(d.hero_of_week_n, "story", "stories")})` : ""}, not the strongest: that's the power rankings.`)));
    const pw = parties[d.party_of_week];
    if (pw) right.appendChild(panel("Party of the week", partyCard(pw),
      d.party_of_week_n ? el("p", { class: "tiny dim", style: { marginTop: "6px" } }, `The most talked-about crew this week (${plural(d.party_of_week_n, "story", "stories")}).`) : null));
    const moves = (d.big_moves || []).map((id) => events[id]).filter(Boolean);
    if (moves.length) right.appendChild(panel("Big moves", el("p", { class: "tiny dim" }, "Days someone jumped 50 renown or more."), A.feed(moves, { noShare: true })));
    const boxTable = (rows, link, label) => {
      const t = el("table", { class: "boxscore" });
      t.appendChild(el("tr", null, el("th", null, label), el("th", { class: "num", title: "stories that named them" }, "Stories"), el("th", { class: "num", title: "how big those stories were, added up" }, "Score"), el("th", { class: "num", title: "renown gained this week" }, "Renown")));
      for (const r of rows) t.appendChild(el("tr", null, el("td", null, link(r)), el("td", { class: "num" }, r.stories), el("td", { class: "num" }, r.score), el("td", { class: "num gold" }, r.gain > 0 ? `+${r.gain}` : r.gain)));
      return t;
    };
    const hb = (d.box || []).filter((r) => heroes[r.hero]).slice(0, 8), pb = (d.party_box || []).filter((r) => parties[r.party]).slice(0, 5);
    if (hb.length) right.appendChild(panel("The week's box score", el("p", { class: "tiny dim" }, "Who the week's stories were about. The top line is the hero (and the party) of the week."),
      boxTable(hb, (r) => A.heroLink(r.hero), "Hero"), pb.length ? boxTable(pb, (r) => A.partyLink(r.party), "Party") : null));
    if (d.rankings && d.rankings.length) {
      const t = el("table");
      for (const r of d.rankings.slice(0, 10)) {
        const h = heroes[r.hero];
        if (!h) continue;
        const mv = moveMark(r, d.week);
        t.appendChild(el("tr", null, el("td", { class: "dim" }, r.rank), el("td", null, mv), el("td", null, A.heroLink(h.id)), el("td", { class: "num gold" }, r.renown)));
      }
      right.appendChild(panel("Hero power rankings", t));
    }
    if (d.party_rankings && d.party_rankings.length) {
      const t = el("table");
      d.party_rankings.slice(0, 8).forEach((r, i) => {
        const p = parties[r.party];
        if (!p) return;
        const grp = el("div", { class: "grp-row" });
        for (const m of p.members) if (heroes[m]) grp.appendChild(A.heroPortrait(heroes[m], 1, { cls: "grp" }));
        t.appendChild(el("tr", null, el("td", { class: "dim" }, r.rank || i + 1), el("td", null, moveMark(r, d.week)), el("td", null, A.bannerSprite(p.banner, 2)), el("td", null, A.partyLink(p.id), grp), el("td", { class: "num gold" }, r.renown)));
      });
      right.appendChild(panel("Party power rankings", t));
    }
    const c = d.counts;
    const kv = el("dl", { class: "kv" });
    for (const [k, lab] of [["fight", "Fights"], ["boss_kill", "Bosses slain"], ["death", "Deaths"], ["evolve", "Class changes"], ["party_formed", "Parties formed"], ["party_disband", "Parties broken"],
      ["bond", "New bonds"], ["brawl", "Brawls"], ["pvp", "Hero vs hero"], ["robbery", "Robberies"], ["body_sold", "Bodies sold"], ["crime", "Arrests & crimes"], ["funeral", "Funerals"]])
      if (c[k]) kv.append(el("dt", null, lab), el("dd", null, c[k]));
    right.appendChild(panel("By the numbers", kv));
    const m = panel("Market report");
    m.appendChild(el("p", { class: "small" }, "Hot: ", d.market_hot.map((x, i) => [i ? ", " : "", el("span", { class: "green" }, `${S.goods[x.good].name} in ${S.towns[x.town].name} (×${x.ratio})`)])));
    m.appendChild(el("p", { class: "small" }, "Glutted: ", d.market_cold.map((x, i) => [i ? ", " : "", el("span", { class: "red" }, `${S.goods[x.good].name} in ${S.towns[x.town].name} (×${x.ratio})`)])));
    right.appendChild(m);
    const arch = panel("Back issues", el("p", { class: "small" }, el("a", { href: "#/days" }, "Every day's Crier →")));
    for (const x of ds) arch.appendChild(el("div", null, el("a", { href: `#/digest/${x.season}/${x.week}`, class: x === d ? "gold" : "" }, `Season ${x.season}, week ${x.week}`)));
    right.appendChild(arch);
    g.appendChild(right);
    v.appendChild(g);
  });
})();
