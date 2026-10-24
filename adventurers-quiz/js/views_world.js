/* The World page (#/world): the season's great event, factions, legends, the waters and the markets. Towns and dungeons are on the Map. */
(function () {
  const A = App;
  const { L, S, el, cap } = A;
  const { factionsPanel, legendsPanel, panel } = Views;

  A.route(/^\/world$/, (v) => {
    v.appendChild(el("h1", null, "The World"));
    v.appendChild(el("p", { class: "small muted" }, "Towns, dungeons and the roadside are on ", el("a", { href: "#/map" }, "the Map"), ": ",
      el("a", { href: "#/map" }, "Towns"), " · ", el("a", { href: "#/map/dungeons" }, "Dungeons"), " · ", el("a", { href: "#/places" }, "Roadside"), "."));
    v.appendChild(greatEvent());
    v.appendChild(factionsPanel());
    v.appendChild(legendsPanel());
    v.appendChild(panel("The waters", el("p", { class: "small" }, "Twelve waters, twenty-four kinds of fish and a legend in every one: ", el("a", { href: "#/creel" }, "the Creel Book"), ".")));
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
  });

  // the season's great event in a line, with the way to its own page
  function greatEvent() {
    const h = L.hyper, last = (L.hyper_log || []).slice(-1)[0];
    const q = Views.helpLink ? Views.helpLink("great-event", "the great event") : null;
    const p = panel("The great event of the season");
    if (h) {
      const where = h.kind === "plague" ? `holds ${Object.keys(h.towns || {}).map((t) => A.nodeName(t)).join(", ")}` : h.kind === "tournament" ? `is called in ${A.nodeName(h.town)}`
        : h.loc ? `${S.towns[h.loc] ? "is in" : "was last seen in"} ${A.nodeName(h.loc)}` : "is loose";
      p.appendChild(el("p", null, el("b", null, cap(h.name)), ` ${where}.`, h.kind === "megabeast" && (h.ahead || [])[0] ? ` Next: ${A.nodeName(h.ahead[0][0])}, in ${A.plural(h.ahead[0][1], "day")}.` : "", " ", q));
      p.appendChild(el("p", null, el("a", { class: "btn small", href: "#/event" }, "Its route, countdown and story ▸")));
    } else if (last && last.season === L.meta.season) {
      p.appendChild(el("p", null, el("b", null, cap(last.name || last.kind)), `: ${last.outcome}. `, el("a", { href: `#/event/${last.season}` }, "How it went ▸"), " ", q));
    } else {
      p.appendChild(el("p", { class: "small" }, "Every season has one, in its last ten days, with omens a few days before. ", q,
        last ? [" Last time: ", el("a", { href: `#/event/${last.season}` }, cap(last.name || last.kind)), "."] : null));
    }
    return p;
  }
})();
