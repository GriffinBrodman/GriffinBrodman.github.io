/* The weekly digest page (#/digest, #/digest/<season>/<week>). */
(function () {
  const A = App;
  const { L, S, el, events, heroes, parties, plural } = A;
  const { headline, moveMark, panel, partyCard, tellOnce } = Views;

  // ---------- Lady Luck's Ledger: the gambling hall's noticeboard, a painted plank over cork with a parchment slip per item ----------
  const LG_PAL = { k: "#2a1a10", g: "#ecc56a", G: "#c8963e", d: "#8a6020", e: "#5a9a3a", r: "#b83a2a", w: "#f4ead0", W: "#c8b894", b: "#7ab0e0", B: "#cfe6f8",
    m: "#3a2a30", M: "#5a4048", p: "#8a5a34", P: "#b07a48", s: "#e0a878", h: "#5a3a22", t: "#c87048", y: "#e8c070" };
  const LG_ICONS = {
    swing_win: ["......e.....", ".....eee....", "....eeeee...", "......e.....", "...gggggg...", "...GGGGGG...", "...gggggg...", "...GGGGGG...", "...gggggg...", "...dddddd..."],
    swing_loss: ["...gggggg...", "...GGGGGG...", "...gggggg...", "...dddddd...", "......r.....", "....rrrrr...", ".....rrr....", "......r....."],
    streak: ["wwwwwwww", "wwwwwwww", "wwwrrwww", "wwwrrwww", "wwwwwwww", "WWWWWWWW", "B.BB..B.", "B..B..B.", "...B....", ],
    cheat: ["............", ".mmmm..mmmm.", "mMMMMmmMMMMm", "mm..MmmM..mm", "mm..MmmM..mm", ".mmmm..mmmm.", "r..........r", ".r........r."],
    cheat_clean: ["wwwwwwww....", "wwwwwwww...e", "wrwwwwrw..ee", "wwwwwwww.ee.", "wrwwwwrwee..", "wwwwwwwwe...", "WWWWWWWW...."],
    crew: ["..hh....yy....tt..", ".hhhh..yyyy..tttt.", ".ssss..ssss..ssss.", ".ssss..ssss..ssss.", "..ss....ss....ss..", ".pppp..GGGG..eeee."],
  };
  const LG_KIND = {
    swing_win: ["Biggest swing", "up big", "green"], swing_loss: ["Biggest swing", "down big", "red"], streak: ["Longest cold streak", "cold", "blue"],
    cheat: ["Cheat of the week", "caught", "red"], cheat_clean: ["Cheat of the week", "none caught", "green"], crew: ["A crew at the tables", "", ""],
  };
  function lgIcon(kind) {
    const rows = LG_ICONS[kind] || LG_ICONS.swing_win, h = rows.length, w = Math.max(...rows.map((r) => r.length)), k = 2;
    const cv = document.createElement("canvas");
    cv.width = (w + 2) * k; cv.height = (h + 2) * k; cv.className = "lg-icon";
    const g = cv.getContext("2d"), on = (x, y) => y >= 0 && y < h && x >= 0 && x < rows[y].length && rows[y][x] !== ".";
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      const c = on(x, y) ? LG_PAL[rows[y][x]] : on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) ? LG_PAL.k : null;
      if (c) { g.fillStyle = c; g.fillRect((x + 1) * k, (y + 1) * k, k, k); }
    }
    return cv;
  }
  function ledger(lg, week) {
    const board = el("div", { class: "lg-board" },
      el("div", { class: "lg-plank" }, el("span", { class: "lg-nail" }), el("div", { class: "lg-title" }, el("b", null, "Lady Luck's Ledger"), el("small", null, `pinned up at the town tables, week ${week}`)), el("span", { class: "lg-nail" })),
      el("div", { class: "lg-note" }, el("span", { class: "lg-pin" }), el("p", null, A.richText(lg.header, [], []))));
    const slips = el("div", { class: "lg-slips" });
    for (const r of lg.rows || []) {
      const [title, stamp, tone] = LG_KIND[r.kind] || ["At the tables", "", ""];
      const p = r.party && parties[r.party], town = r.town && S.towns[r.town];
      const fig = r.figure || stamp;
      slips.appendChild(el("div", { class: `lg-slip lg-${r.kind}` }, el("span", { class: "lg-pin" }),
        el("div", { class: "lg-head" }, lgIcon(r.kind), el("b", null, title), fig ? el("em", { class: `lg-fig ${tone}` }, fig) : p ? A.bannerSprite(p.banner, 1) : null),
        el("p", null, A.richText(r.text, r.heroes || [], r.party ? [r.party] : [])),
        town ? el("div", { class: "lg-where" }, town.name) : null));
    }
    if (slips.childNodes.length) board.appendChild(slips);
    const n = lg.sessions || 0;
    board.appendChild(el("div", { class: "lg-torn" }, lg.quiet ? `A quiet week: ${plural(n, "sitting", "sittings")} at the town tables.` : `${plural(n, "sitting", "sittings")} at the town tables this week.`));
    return el("section", { class: "panel lg-panel" }, board);
  }

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
      const sc = A.vignette(top[0], 240, 72, "scene");
      main.appendChild(el("div", { class: "lead" }, el("h1", null, A.richText(headline(top[0]), top[0].heroes, top[0].parties)), sc, el("p", null, A.storyLine(top[0]))));
    }
    if (d.column) main.appendChild(el("div", { style: { borderTop: "1px solid #b0915e", borderBottom: "1px solid #b0915e", padding: "8px 0", margin: "8px 0 12px" } },
      el("h4", null, d.columnist ? `From the columnist: ${d.columnist}` : "From the columnist"), el("p", { style: { fontSize: "21px", lineHeight: "1.3" } }, A.storyText(d.column))));
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
    if (d.ledger && d.ledger.header) right.appendChild(ledger(d.ledger, d.week));
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
