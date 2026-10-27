/* The History page (#/history): Seasons (each with its ceremony), Treasures, the Memorial and the Annals, always all four. */
(function () {
  const A = App;
  const { L, el, heroes } = A;
  const { cursesPanel, panel, runnerUp, treasuresPanel } = Views;

  A.route(/^\/history$/, (v) => {
    v.appendChild(el("h1", null, "History"));
    const parts = [["seasons", "Seasons"], ["treasures", "Treasures"], ["memorial", "Memorial"], ["annals", "Annals"]];
    v.appendChild(el("div", { class: "hist-toc" }, parts.map(([id, label]) => el("a", { class: "rs-chip", href: "#/history", onclick: (ev) => { ev.preventDefault(); const t = document.getElementById(`hist-${id}`); if (t) t.scrollIntoView({ block: "start" }); } }, label))));
    const g = el("div", { class: "hist-grid" });
    g.append(seasonsPanel(), treasures(), memorial(), annals());
    v.appendChild(g);
  });

  function seasonsPanel() {
    const m = L.meta, p = panel("Seasons");
    p.id = "hist-seasons";
    if (m.phase === "season") p.appendChild(el("div", { class: "hist-now" }, el("b", null, sign(m.theme && m.theme.id, m.theme && m.theme.name), `Season ${m.season}${m.theme && m.theme.name ? ": " + m.theme.name : ""}`),
      el("div", { class: "small" }, `Under way: day ${m.season_day} of ${m.season_length}. Season ${m.season} closes on day ${m.season_length}; its awards and the ceremony land here then.`),
      L.theme_board && L.theme_board.head ? el("div", { class: "small" }, "On the board so far: ", A.storyText(L.theme_board.head)) : null));
    else if (m.phase === "preseason") p.appendChild(el("p", { class: "small" }, `Season ${m.season || 1} hasn't started. When it closes, after ${m.season_length} days, its awards and the ceremony land here.`));
    const seasons = (L.seasons || []).slice().reverse();
    if (!seasons.length && m.phase !== "season") p.appendChild(el("p", { class: "empty" }, "No season has finished yet. Awards are handed out on the last day."));
    for (const s of seasons) {
      const box = el("div", { class: "hist-season" }, el("h3", null, sign((s.theme_outcome || {}).id, s.theme), `Season ${s.season}: ${s.theme}`),
        el("p", null, el("a", { class: "btn small", href: `#/finale/${s.season}` }, "🏆 The ceremony")));
      const aw = el("div", { class: "cols", style: { gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" } });
      for (const a of s.awards) {
        const h = heroes[a.hero];
        aw.appendChild(el("div", { class: "award" }, h ? A.heroPortrait(h, 1) : null, el("div", null, el("div", { class: "small gold" }, a.name), h ? A.heroLink(h.id) : "?", el("span", { class: "dim small" }, ` (${a.value})`), runnerUp(a))));
      }
      box.appendChild(aw);
      const to = themeOutcome(s);
      if (to) box.appendChild(to);
      if (s.parties.length) box.appendChild(el("p", { class: "small", style: { marginTop: "8px" } }, "Top party: ", el("b", null, s.parties[0].name), ` (${s.parties[0].renown} renown)`));
      if (s.deaths.length) box.appendChild(el("p", { class: "small red" }, `Lost this season: ${s.deaths.map((d) => d.name).join(", ")}`));
      const ge = (L.hyper_log || []).find((x) => x.season === s.season);
      if (ge) box.appendChild(el("p", { class: "small" }, "The great event: ", el("a", { href: `#/event/${s.season}` }, ge.name ? A.cap(ge.name) : ge.kind), `, ${ge.outcome}.`));
      p.appendChild(box);
    }
    return p;
  }
  // the season theme's pixel sign at 1x, the theme's name tag everywhere else (a season kept before its outcome had an id is found by name)
  function sign(id, name) {
    const T = A.S.theme_signs || {}, row = T[id] || Object.values(T).find((t) => t.name === name);
    const cv = row && row.emblem && window.Emblems ? Emblems.canvas(row.emblem, 1) : null;
    if (cv) cv.classList.add("hist-emblem");
    return cv;
  }
  // how the season's theme went, as the sim kept it at the close: its board's last line and who took its hero and crew trophies
  function themeOutcome(s) {
    const o = s.theme_outcome;
    if (!o) return null;
    const prizes = (o.awards || []).filter((a) => heroes[a.hero]).map((a) => [el("b", null, a.name), ": ", A.heroLink(a.hero), ` (${a.amount}${a.note ? ", " + a.note : ""})`])
      .concat((o.crew_awards || []).filter((a) => A.parties[a.party]).map((a) => [el("b", null, a.name), ": ", A.partyLink(a.party), ` (${a.amount})`]));
    if (!o.line && !prizes.length) return null;
    return el("div", { class: "hist-theme small" }, el("div", { class: "gold" }, `How ${o.name || s.theme} went`),
      o.line ? el("div", null, A.storyText(o.line)) : null,
      prizes.length ? el("div", null, prizes.map((x, i) => [i ? " · " : "", x])) : null);
  }
  function treasures() {
    const t = treasuresPanel(), a = cursesPanel();
    const box = el("div", { id: "hist-treasures" });
    if (t.tagName === "SPAN" && a.tagName === "SPAN") box.appendChild(panel("Treasures of the age", el("p", { class: "empty" }, "Nothing magic has turned up yet. Finds from deep floors, bosses and odd deals are listed here, with what became of them.")));
    else box.append(t, a);
    return box;
  }
  function memorial() {
    const mem = panel("The Memorial");
    mem.id = "hist-memorial";
    if (!L.memorial.length) mem.appendChild(el("p", { class: "empty" }, L.annals ? "Nobody died this age." : "Nobody has died. Yet."));
    for (const m of L.memorial.slice().reverse()) {
      const h = heroes[m.id];
      mem.appendChild(el("div", { class: "grave-row" }, Art.graveGrid().toCanvas(3), h ? A.heroPortrait(h, 1) : null,
        el("div", null, el("b", null, A.heroLink(m.id)), el("div", { class: "small muted" }, `Level ${m.level} ${A.clsName(m.cls)} · ${m.owner}'s hero`),
          el("div", { class: "small" }, A.storyText(`Died ${m.cause} in ${m.place}, season ${m.season}.`)))));
    }
    return mem;
  }
  function annals() {
    const p = panel("The Annals");
    p.id = "hist-annals";
    const n = L.meta.league_seasons || 3;
    if (L.annals) p.appendChild(el("p", null, "The age is over and its story is written: the Legends, the twelve great moments and every hero's last line. ", el("a", { href: "#/annals" }, "Read the Annals ▸")));
    else p.appendChild(el("p", { class: "empty" }, `The Annals are written when the age ends, as season ${n} closes${L.meta.season && L.meta.season < n ? ` (this is season ${L.meta.season})` : ""}. They name the age's Legends and its twelve great moments.`));
    return p;
  }
})();
