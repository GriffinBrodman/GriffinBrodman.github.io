/* The season finale ceremony (#/finale, #/finale/<n>). */
(function () {
  const A = App;
  const { L, cap, el, events, heroes, parties, plural } = A;
  const { fightSet, panel, rivalryPanel, runnerUp } = Views;

  A.route(/^\/finale(?:\/(\d+))?$/, (v, n) => {
    const all = L.seasons || [];
    const s = n ? all.find((x) => x.season === +n) : all[all.length - 1];
    if (!s) { v.appendChild(panel("No finale yet", el("p", { class: "empty" }, "The first season hasn't ended. The ceremony happens on its last day."))); return; }
    const mvpA = s.awards.find((a) => a.id === "mvp");
    const champ = mvpA && heroes[mvpA.hero];
    const ppA = (s.party_awards || []).find((a) => a.id === "party_mvp");
    const champP = ppA && parties[ppA.party];
    const num = s.numbers || {};

    v.appendChild(el("section", { class: "finale-hero" },
      el("div", { class: "finale-kicker" }, `The Season ${s.season} Ceremony`),
      el("h1", null, s.theme),
      el("p", null, `${plural((s.end_day - (s.start_day || s.end_day - 27)) + 1, "day")} · ${num.events ? plural(num.events, "story", "stories") : "? stories"} · ${num.deaths || 0} fallen · ${plural(num.bosses || 0, "boss", "bosses")} slain`)));
    if (s.recap) v.appendChild(panel("The season, as the Crier tells it", ...s.recap.split(/\n\s*\n/).map((t) => el("p", { class: "epilogue" }, t))));

    const spot = el("div", { class: "grid2 even finale-spot" });
    if (champ) spot.appendChild(el("section", { class: "panel laurel" },
      el("div", { class: "finale-kicker" }, "Hero of the Season"),
      el("a", { href: `#/hero/${champ.id}`, class: "laurel-frame" }, Art.laurelGrid().toCanvas(5), A.heroPortrait(champ, 5, { cls: "champ" })),
      el("h2", { class: "champ-name" }, champ.name),
      champ.epithet ? el("div", { class: "epi" }, champ.epithet) : null,
      el("p", { class: "small muted" }, `${champ.npc ? "League hero" : champ.owner + "'s hero"} · Lv ${champ.level} ${champ.title} · ${mvpA.value} renown`)));
    if (champP) {
      const grp = el("div", { class: "row", style: { justifyContent: "center", gap: "6px", flexWrap: "wrap" } });
      for (const m of champP.members) if (heroes[m]) grp.appendChild(el("a", { href: `#/hero/${m}`, title: heroes[m].name }, A.heroPortrait(heroes[m], 2)));
      spot.appendChild(el("section", { class: "panel laurel" },
        el("div", { class: "finale-kicker" }, "Party of the Season"),
        el("a", { href: `#/party/${champP.id}` }, A.bannerSprite(champP.banner, 6, "")),
        el("h2", { class: "champ-name" }, champP.name), grp,
        el("p", { class: "small muted" }, `${cap(champP.disposition)} · ${ppA.value} renown`)));
    }
    v.appendChild(spot);

    const podium = (title, rows, render) => {
      const order = [rows[1], rows[0], rows[2]];
      const box = el("div", { class: "podium" });
      order.forEach((r, i) => {
        if (!r) return;
        const place = [2, 1, 3][i];
        box.appendChild(el("div", { class: `step p${place}` }, render(r), el("div", { class: "block" }, el("b", null, place), el("span", { class: "tiny" }, `${r.renown} renown`))));
      });
      return panel(title, box);
    };
    const pods = el("div", { class: "grid2 even" });
    pods.appendChild(podium("Hero standings", (s.standings || []).slice(0, 3), (r) => {
      const h = heroes[r.hero];
      return h ? el("a", { href: `#/hero/${h.id}` }, A.heroPortrait(h, 2), el("div", { class: "small" }, h.name)) : el("span", null, "?");
    }));
    pods.appendChild(podium("Party standings", (s.parties || []).slice(0, 3), (r) => {
      const p = parties[r.party];
      return el("a", { href: `#/party/${r.party}` }, p ? A.bannerSprite(p.banner, 3) : null, el("div", { class: "small" }, r.name));
    }));
    v.appendChild(pods);
    const ft = el("table");
    ft.appendChild(el("tr", null, el("th", null, "#"), el("th", null, "Hero"), el("th", null, "Class"), el("th", { class: "num" }, "Lv"), el("th", { class: "num" }, "Renown")));
    (s.standings || []).forEach((r, i) => { const h = heroes[r.hero]; if (h) ft.appendChild(el("tr", { class: r.alive ? "" : "dim" }, el("td", { class: "dim" }, i + 1),
      el("td", null, el("div", { class: "row", style: { gap: "6px" } }, A.heroPortrait(h, 1, { cls: "mini" }), A.heroLink(h.id), r.alive ? null : " ✝")), el("td", { class: "small" }, A.clsName(r.cls)),
      el("td", { class: "num" }, r.level), el("td", { class: "num gold" }, r.renown))); });
    const sFeuds = L.events.filter((e) => e.season === s.season && e.kind === "feud");
    const cal = (L.digests || []).filter((dg) => dg.season === s.season).sort((a, b) => a.week - b.week);
    const side = el("div");
    if (s.rivalry) side.appendChild(rivalryPanel("Rivalry of the season", s.rivalry, events));
    if ((s.goals || []).length) {
      const met = s.goals.filter((g) => g.done).length;
      side.appendChild(panel("Goals of the season", el("p", { class: "small muted" }, `${met} of ${s.goals.length} parties and lone heroes got what they came for.`),
        el("ul", { class: "goals" }, s.goals.map((g) => el("li", { class: g.done ? "met" : "missed" },
          el("span", { class: "mark" }, g.done ? "✔" : "○"), g.party ? A.partyLink(g.party) : g.hero && heroes[g.hero] ? A.heroLink(g.hero) : g.name, " ", g.text,
          g.done ? null : el("span", { class: "tiny dim" }, ` (${g.progress})`))))));
    }
    if (sFeuds.length) side.appendChild(panel("Feuds of the season", el("ul", { class: "diary" }, sFeuds.slice(0, 6).map((e) => el("li", null, A.richText(e.text, e.heroes, e.parties))))));
    if (cal.length) side.appendChild(panel("The season, week by week", el("ol", { class: "timeline small" }, cal.map((dg) => {
      const top = (dg.top || []).map((id) => events[id]).filter(Boolean)[0];
      return el("li", null, el("span", { class: "when" }, `Week ${dg.week}`), el("div", null, top ? A.richText(top.text, top.heroes, top.parties) : "A quiet week."));
    }))));
    v.appendChild(el("div", { class: "grid2" }, panel("The final table", el("div", { class: "scrollx" }, ft)), side));
    if (s.lines) {
      const rows = s.standings.filter((r) => s.lines[r.hero] && heroes[r.hero]);
      if (rows.length) v.appendChild(panel("Every hero's season, in one line", el("p", { class: "small muted" }, "Not everyone wins. Everyone has a story."),
        el("ul", { class: "diary everyone" }, rows.map((r) => { const m = s.lines[r.hero], h = heroes[r.hero];
          return el("li", null, el("span", { class: "row", style: { gap: "6px" } }, A.heroPortrait(h, 1, { cls: "mini" }), el("b", null, A.heroLink(h.id)),
            el("span", { class: "tiny dim" }, `${h.npc ? "" : h.owner + "'s · "}#${s.standings.indexOf(r) + 1}`)),
            el("div", null, A.richText(m.text, m.heroes, m.parties))); }))));
    }

    const hall = el("div", { class: "cols", style: { gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" } });
    for (const a of s.awards) {
      if (a.id === "mvp") continue;
      const h = heroes[a.hero];
      if (h) hall.appendChild(el("div", { class: "award trophy" }, A.heroPortrait(h, 2), el("div", null, el("div", { class: "small gold" }, a.name), A.heroLink(h.id), el("div", { class: "tiny dim" }, String(a.value)), runnerUp(a))));
    }
    for (const a of s.party_awards || []) {
      if (a.id === "party_mvp") continue;
      const p = parties[a.party];
      if (p) hall.appendChild(el("div", { class: "award trophy" }, A.bannerSprite(p.banner, 2), el("div", null, el("div", { class: "small gold" }, a.name), A.partyLink(p.id), el("div", { class: "tiny dim" }, String(a.value)), runnerUp(a))));
    }
    v.appendChild(panel("The hall of awards", hall));

    const tiles = [["Fights", num.fights], ["Monsters slain", num.kills], ["Bosses slain", num.bosses], ["Floors cleared", num.floors],
      ["Silver earned", num.gold], ["Levels gained", num.levels], ["Class changes", num.evolutions], ["Parties formed", num.parties_formed],
      ["Break-ups", num.breakups], ["Hero-on-hero fights", num.robberies], ["Feuds", num.feuds], ["Fallen", num.deaths]].filter(([, x]) => x != null);
    v.appendChild(panel("The season in numbers", el("div", { class: "statgrid finale-nums" }, tiles.map(([k, x]) => el("div", null, el("b", null, Number(x).toLocaleString()), el("span", null, k))))));

    if ((s.moments || []).length) {
      const tl = el("ol", { class: "timeline" });
      for (const m of s.moments) tl.appendChild(el("li", null, el("span", { class: "when" }, `Day ${m.sday || "?"}`),
        el("div", null, A.richText(m.text, m.heroes, m.parties), m.fight && fightSet.has(m.fight) ? el("a", { class: "watch", href: `#/fight/${m.fight}` }, "  ▶ watch") : null)));
      v.appendChild(panel("Moments of the season", tl));
    }

    const g = el("div", { class: "grid2 even" });
    const mem = panel("In memoriam");
    if (!(s.deaths || []).length) mem.appendChild(el("p", { class: "empty" }, "Nobody fell this season. Enjoy it while it lasts."));
    for (const d of s.deaths || []) {
      const h = heroes[d.id];
      mem.appendChild(el("div", { class: "grave-row" }, Art.graveGrid().toCanvas(3), h ? A.heroPortrait(h, 1) : null,
        el("div", null, h ? A.heroLink(h.id) : el("b", null, d.name), el("div", { class: "small" }, `Lv ${d.level}. Died ${d.cause} in ${d.place}.`))));
    }
    g.appendChild(mem);
    const isLast = s === all[all.length - 1];
    g.appendChild(panel(isLast ? "Next season" : "What came next",
      el("p", null, isLast ? "Every hero wakes up in a random town. Parties try to find each other again. Bosses that fell have successors waiting." : "The league moved on. It always does."),
      (s.joining || []).length && isLast ? el("p", { class: "small" }, el("b", null, "Joining: "), s.joining.join(", ")) : null,
      el("p", null, el("a", { class: "btn", href: "#/history" }, "All seasons →"))));
    v.appendChild(g);
  });
})();
