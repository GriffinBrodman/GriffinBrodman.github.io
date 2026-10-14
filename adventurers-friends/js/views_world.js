/* The World page (#/world): dungeons, factions and legends. */
(function () {
  const A = App;
  const { L, S, el, plural } = A;
  const { dangerWord, factionsPanel, legendsPanel, panel } = Views;

  A.route(/^\/world$/, (v) => {
    v.appendChild(el("h1", null, "The World"));
    v.appendChild(factionsPanel());
    v.appendChild(legendsPanel());
    const moods = Object.entries(L.town_mood || {});
    if (moods.length || L.pip) v.appendChild(panel("Town life",
      moods.length ? el("p", { class: "small" }, moods.map(([t, m], i) => [i ? " · " : "", el("a", { href: `#/map/${t}` }, S.towns[t].name), `: ${m.word}` + ((m.deals || []).length ? " (deals)" : "")])) : null,
      L.pip && L.pip[0] + L.pip[1] ? el("p", { class: "small" }, el("b", null, "Pip the Unstoppable Lutist: "), `${plural(L.pip[0], "win")}, ${plural(L.pip[1], "loss", "losses")} against the league's buskers.`) : null));
    const dt = el("table");
    dt.appendChild(el("tr", null, el("th", null, ""), el("th", null, "Dungeon"), el("th", { class: "num" }, "Level"), el("th", { class: "num" }, "Floors"), el("th", null, "Boss"), el("th", null, "Monsters"), el("th", null, "Explored"), el("th", { class: "num" }, "Delves")));
    for (const [id, d] of Object.entries(S.dungeons).sort((a, b) => a[1].level - b[1].level)) {
      const st = L.dungeons[id] || {};
      dt.appendChild(el("tr", null, el("td", null, A.monsterSprite(d.boss, 1)), el("td", null, el("a", { href: `#/map/${id}` }, d.name)), el("td", { class: "num" }, d.level), el("td", { class: "num" }, d.floors),
        el("td", { class: st.boss_alive === false ? "green" : "" }, st.boss_alive === false ? `${d.boss_name} (slain)` : d.boss_name), el("td", null, dangerWord(st.danger)), el("td", null, st.explored_word || "untouched (0%)"), el("td", { class: "num" }, st.visits || 0)));
    }
    v.appendChild(panel("Dungeons", el("div", { class: "scrollx" }, dt)));
    const goods = ["ration", "potion", "herbs", "pelt", "fang", "ore", "gem", "trinket", "remains", "bones", "relic", "frost_crystal", "ember_core"];
    const mt = el("table");
    mt.appendChild(el("tr", null, el("th", null, "Town"), goods.map((g) => el("th", { class: "num", title: S.goods[g].name }, Art.itemGrid(g).toCanvas(2)))));
    for (const [tid, t] of Object.entries(S.towns)) {
      mt.appendChild(el("tr", null, el("td", null, el("a", { href: `#/map/${tid}` }, t.name)), goods.map((g) => {
        const p = L.markets[tid][g], base = S.goods[g].base, r = p / base;
        const col = r > 1.4 ? "#2f6a22" : r > 1.1 ? "#4f7a36" : r < 0.6 ? "#a02a1e" : r < 0.85 ? "#9a5a3a" : "#4a3826";
        return el("td", { class: "heat", style: { color: col }, title: `${S.goods[g].name}: ${p} silver (base ${base})` }, Math.round(p));
      })));
    }
    v.appendChild(panel("Market prices (silver)", el("p", { class: "small dim" }, "Green: a town pays well right now. Red: glutted. Heroes only know prices they've seen or heard about at a tavern."), el("div", { class: "scrollx" }, mt)));
    const tw = el("div", { class: "cols" });
    for (const [tid, t] of Object.entries(S.towns)) tw.appendChild(el("div", { class: "panel tight" }, el("h3", null, el("a", { href: `#/map/${tid}` }, t.name)), el("p", { class: "small muted" }, t.desc),
      el("p", { class: "tiny dim" }, `${t.folk.barkeep} keeps ${t.tavern}.${t.folk.special ? " " + t.folk.special[0] + " runs " + t.folk.special[1] + "." : ""}`)));
    v.appendChild(panel("Towns", tw));
  });
})();
