/* The History page (#/history): every season, the memorial and the treasures. */
(function () {
  const A = App;
  const { L, el, heroes } = A;
  const { artifactsPanel, panel, runnerUp, treasuresPanel } = Views;

  A.route(/^\/history$/, (v) => {
    v.appendChild(el("h1", null, "History"));
    const g = el("div", { class: "grid2" });
    const left = el("div"), right = el("div");
    g.append(left, right);
    v.appendChild(g);
    const seasons = (L.seasons || []).slice().reverse();
    if (!seasons.length) left.appendChild(panel("Seasons", el("p", { class: "empty" }, "No season has finished yet. Awards are handed out on the last day.")));
    for (const s of seasons) {
      const p = panel(`Season ${s.season}: ${s.theme}`, el("p", null, el("a", { class: "btn small", href: `#/finale/${s.season}` }, "🏆 The ceremony")));
      const aw = el("div", { class: "cols", style: { gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" } });
      for (const a of s.awards) {
        const h = heroes[a.hero];
        aw.appendChild(el("div", { class: "award" }, h ? A.heroPortrait(h, 1) : null, el("div", null, el("div", { class: "small gold" }, a.name), h ? A.heroLink(h.id) : "?", el("span", { class: "dim small" }, ` (${a.value})`), runnerUp(a))));
      }
      p.appendChild(aw);
      if (s.parties.length) p.appendChild(el("p", { class: "small", style: { marginTop: "8px" } }, "Top party: ", el("b", null, s.parties[0].name), ` (${s.parties[0].renown} renown)`));
      if (s.deaths.length) p.appendChild(el("p", { class: "small red" }, `Lost this season: ${s.deaths.map((d) => d.name).join(", ")}`));
      left.appendChild(p);
    }
    const mem = panel("The Memorial");
    if (!L.memorial.length) mem.appendChild(el("p", { class: "empty" }, L.annals ? "Nobody died this age." : "Nobody has died. Yet."));
    for (const m of L.memorial.slice().reverse()) {
      const h = heroes[m.id];
      mem.appendChild(el("div", { class: "grave-row" }, Art.graveGrid().toCanvas(3), h ? A.heroPortrait(h, 1) : null,
        el("div", null, el("b", null, A.heroLink(m.id)), el("div", { class: "small muted" }, `Level ${m.level} ${A.clsName(m.cls)} · ${m.owner}'s hero`),
          el("div", { class: "small" }, A.storyText(`Died ${m.cause} in ${m.place}, season ${m.season}.`)))));
    }
    right.appendChild(mem);
    right.appendChild(treasuresPanel());
    right.appendChild(artifactsPanel());
  });
})();
