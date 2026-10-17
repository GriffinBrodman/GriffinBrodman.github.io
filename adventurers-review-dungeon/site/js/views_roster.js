/* The Roster page (#/roster, #/roster/<tab>). */
(function () {
  const A = App;
  const { L, el, heroes } = A;
  const { pendingPanel, sortedHeroes } = Views;

  A.route(/^\/roster(?:\/(\w+))?$/, (v, tab) => {
    tab = tab || (!L.heroes.length && L.pending.length ? "pending" : "active");
    v.appendChild(el("h1", null, "The Roster"));
    const tabs = el("div", { class: "tabs" });
    const counts = { active: L.heroes.filter((h) => h.alive).length, pending: L.pending.length, fallen: L.heroes.filter((h) => !h.alive).length, mine: A.mine().length };
    for (const [k, label] of [["active", "Active"], ["mine", "★ Mine"], ["pending", "Joining next season"], ["fallen", "Fallen"]])
      tabs.appendChild(el("button", { class: k === tab ? "on" : "", onclick: () => (location.hash = `#/roster/${k}`) }, `${label} (${counts[k]})`));
    v.appendChild(tabs);
    if (tab === "pending") { v.appendChild(pendingPanel()); return; }
    let list = tab === "fallen" ? L.heroes.filter((h) => !h.alive) : tab === "mine" ? A.mine().map((id) => heroes[id]).filter(Boolean) : L.heroes.filter((h) => h.alive);
    const grid = el("div", { class: "cols" });
    for (const h of sortedHeroes(list)) grid.appendChild(A.heroCard(h, { extra: el("div", { class: "tiny gold" }, `${h.renown} renown${h.party_name ? " · " + h.party_name : ""}`) }));
    if (!list.length) grid.appendChild(el("p", { class: "empty" }, tab === "mine" ? "You haven't marked any hero as yours yet. Open a hero and press ★." : "No one here."));
    v.appendChild(grid);
  });
})();
