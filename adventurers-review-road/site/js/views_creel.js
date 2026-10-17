/* The Creel Book (#/creel): every water, its fish (a species stays a shadow until someone lands one), its legend, and today's fish weather. */
(function () {
  const A = App;
  const { L, S, el, plural } = A;
  const { panel } = Views;
  const KINDS = [["river", "Rivers"], ["lake", "Lakes"], ["sea", "The sea"], ["ice", "Under the ice"], ["swamp", "Swamps"], ["cave", "Underground"]];

  function fishArt(id, known) {
    const box = el("span", { class: "creel-fish" + (known ? "" : " unknown") });
    A.need(["food_art", "fish_art"]).then(() => {
      if (!window.FishArt) return;
      box.appendChild(FishArt.toCanvas(FishArt.fish(id, known ? { size: "codex", still: true } : { size: "codex", still: true, shadow: "#4a3a2a" }), 1));
    }).catch(() => {});
    return box;
  }

  A.route(/^\/creel$/, (v) => {
    const F = S.fish || {}, C = L.creel || { species: {}, legends: {}, weather: {} };
    const caught = Object.values(C.species).filter((x) => x.n).length;
    v.appendChild(el("h1", null, "The Creel Book"));
    v.appendChild(el("p", { class: "small muted" }, `Every water the league fishes, and every fish in it. ${caught} of ${Object.keys(F.species || {}).length} kinds landed so far`,
      C.sessions ? `, over ${plural(C.sessions, "session")} with a line out.` : "."));
    for (const [kind, label] of KINDS) {
      const waters = Object.values(F.waters || {}).filter((w) => w.kind === kind);
      const fish = Object.values(F.species || {}).filter((s) => s.kind === kind).sort((a, b) => b.weight - a.weight);
      const p = panel(label);
      const row = el("div", { class: "creel-row" });
      for (const s of fish) {
        const c = C.species[s.id] || {}, known = !!c.n;
        row.appendChild(el("div", { class: "creel-card" + (s.rare ? " rare" : "") }, fishArt(s.id, known),
          el("div", null, el("b", null, known ? s.name : "???"), s.rare && known ? el("span", { class: "tiny gold" }, " rare") : null,
            known ? el("div", { class: "tiny" }, s.desc) : el("div", { class: "tiny dim" }, "Nobody has landed one yet."),
            known && c.first ? el("div", { class: "tiny dim" }, "First landed by ", A.heroes[c.first.hero] ? A.heroLink(c.first.hero) : c.first.name, `, ${A.when(c.first.day)}`) : null,
            known && c.record ? el("div", { class: "tiny" }, `Record: ${c.record.size} cm, `, A.heroes[c.record.hero] ? A.heroLink(c.record.hero) : c.record.name,
              A.kept("catch", c.record.rec) ? [" ", el("a", { class: "watch", href: `#/catch/${c.record.rec}` }, "▶ watch")] : null) : null,
            known ? el("div", { class: "tiny dim" }, `${plural(c.n, "caught", "caught")} · ${s.lo}–${s.hi} cm`) : null)));
      }
      p.appendChild(row);
      for (const w of waters) {
        const lg = (F.legends || {})[w.legend] || {}, st = C.legends[w.legend] || {}, mood = (F.fish_weather || {})[(C.weather || {})[w.id]];
        const tale = st.caught ? ["Landed by ", A.heroes[st.caught.hero] ? A.heroLink(st.caught.hero) : st.caught.name, `, ${A.when(st.caught.day)}: ${st.caught.size} cm. Gone from the water for good.`,
          A.kept("catch", st.caught.rec) ? [" ", el("a", { class: "watch", href: `#/catch/${st.caught.rec}` }, "▶ watch")] : null]
          : st.lost ? [`Got away ${st.lost === 1 ? "once" : st.lost + " times"}, from `, ...st.by.map((id, i) => [i ? ", " : "", A.heroes[id] ? A.heroLink(id) : "someone"]), `. By now the story has it ${st.told}.`]
          : ["Nobody has had it on a line yet."];
        p.appendChild(el("div", { class: "creel-water" }, st.caught ? Views.fishPlaque({ species: lg.species, legend: w.legend, name: lg.name, size: st.caught.size }) : null,
          el("div", null, el("b", null, w.name.charAt(0).toUpperCase() + w.name.slice(1)), el("span", { class: "tiny dim" }, ` · ${A.nodeName(w.node)}`), mood ? el("span", { class: "tiny" }, ` · today ${mood}`) : null,
            el("div", { class: "small" }, el("b", { class: st.caught ? "gold" : "" }, lg.name), `: ${lg.desc || ""}`), el("div", { class: "tiny" }, ...tale))));
      }
      v.appendChild(p);
    }
  });
})();
