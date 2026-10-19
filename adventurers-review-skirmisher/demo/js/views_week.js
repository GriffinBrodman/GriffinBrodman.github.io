/* The Week: the Crier's section on a week's last day (Views.theWeek), the running column (Views.columnBlock), and the old #/digest links. */
(function () {
  const A = App;
  const { L, S, el, heroes, parties, plural } = A;
  const { moveMark, partyCard } = Views;

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

  function columnBlock(d) {
    return el("div", { class: "week-column" }, el("h4", null, d.columnist ? `From the columnist: ${d.columnist}` : "From the columnist"), el("p", null, A.storyText(d.column)));
  }
  const goods = (xs, cls) => xs.map((x, i) => [i ? ", " : "", el("span", { class: cls }, `${S.goods[x.good].name} in ${S.towns[x.town].name} (×${x.ratio})`)]);
  const NUMS = [["fight", "fight", "fights"], ["boss_kill", "boss slain", "bosses slain"], ["death", "death", "deaths"], ["evolve", "class change", "class changes"],
    ["party_formed", "party formed", "parties formed"], ["party_disband", "party broken", "parties broken"], ["bond", "new bond", "new bonds"], ["brawl", "brawl", "brawls"],
    ["pvp", "hero vs hero", "hero vs hero"], ["robbery", "robbery", "robberies"], ["body_sold", "body sold", "bodies sold"], ["crime", "arrest or crime", "arrests & crimes"], ["funeral", "funeral", "funerals"]];

  // opts.rankings: a back issue has no standings table, so its week carries the top five
  function theWeek(d, opts) {
    opts = opts || {};
    const sec = el("section", { class: "panel parch week" },
      el("div", { class: "week-mast" }, el("div", { class: "week-title" }, "The Week"),
        el("div", { class: "sub" }, el("span", null, `Season ${d.season} · Week ${d.week}`), el("span", null, `Days ${d.day_from}–${d.day_to}`))));
    if (d.column) sec.appendChild(columnBlock(d));
    const hw = heroes[d.hero_of_week], pw = parties[d.party_of_week];
    const note = (t) => el("p", { class: "tiny dim week-note" }, t);
    if (hw || pw) sec.appendChild(el("div", { class: "grid2 even week-awards" },
      hw ? el("div", null, el("h4", null, "Hero of the week"), A.heroCard(hw),
        note(`The most talked-about hero this week${d.hero_of_week_n ? ` (${plural(d.hero_of_week_n, "story", "stories")})` : ""}, not the strongest: that's the ${opts.rankings ? "power rankings" : "standings"}.`)) : null,
      pw ? el("div", null, el("h4", null, "Party of the week"), partyCard(pw, { noNews: true }),
        d.party_of_week_n ? note(`The most talked-about crew this week (${plural(d.party_of_week_n, "story", "stories")}).`) : null) : null));
    if (d.ledger && d.ledger.header) sec.appendChild(ledger(d.ledger, d.week));
    const market = el("div", { class: "week-market" }, el("h4", null, "Market report"),
      d.market_hot.length ? el("p", { class: "small" }, el("b", null, "Hot: "), goods(d.market_hot, "green")) : null,
      d.market_cold.length ? el("p", { class: "small" }, el("b", null, "Glutted: "), goods(d.market_cold, "red")) : null);
    const ranks = opts.rankings ? (d.rankings || []).filter((r) => heroes[r.hero]) : [];
    if (ranks.length) {
      const t = el("table");
      for (const r of ranks) t.appendChild(el("tr", null, el("td", { class: "dim" }, r.rank), el("td", null, moveMark(r, d.week)),
        el("td", null, el("div", { class: "row", style: { gap: "4px" } }, A.heroPortrait(heroes[r.hero], 1), A.heroLink(r.hero))), el("td", { class: "num gold" }, r.renown)));
      sec.appendChild(el("div", { class: "grid2 even week-foot" }, market, el("div", null, el("h4", null, "Hero power rankings"), t)));
    } else sec.appendChild(market);
    const c = d.counts || {}, nums = NUMS.filter(([k]) => c[k]);
    sec.appendChild(el("div", { class: "week-nums" }, el("b", null, "By the numbers"),
      nums.length ? nums.map(([k, one, many]) => el("span", null, el("i", null, c[k]), ` ${c[k] === 1 ? one : many}`)) : el("span", null, "a quiet week")));
    return sec;
  }
  Object.assign(Views, { theWeek, columnBlock });

  // the Digest page folded into the Crier (2026-10-18): a shared digest link opens the Crier for that week's last day
  A.route(/^\/digest(?:\/(\d+)\/(\d+))?\/?$/, (v, s, w) => {
    const is = L.issues || [], last = is[is.length - 1];
    const inWeek = s ? is.filter((x) => x.season == s && x.sday && Math.ceil(x.sday / 7) == w) : [];
    const x = inWeek[inWeek.length - 1];
    location.replace(x && x !== last ? `#/day/${x.day}` : !s || x ? "#/" : "#/days");
  });
})();
