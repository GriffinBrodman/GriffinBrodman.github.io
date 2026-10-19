/* The Roster page (#/roster[/<tab>[/<sort>]]): the standings, sortable, with each hero's crew, purse, mount, pet and goal. */
(function () {
  const A = App;
  const { L, el, heroes } = A;
  const { pendingPanel, sortedHeroes } = Views;

  A.needs(/^\/roster/, ["mount_art"]);
  const SORTS = [["renown", "Renown"], ["level", "Level"], ["class", "Class"], ["crew", "Crew"], ["silver", "Silver"]];
  const purse = (h) => (h.gold || 0) * 10 + (h.copper || 0);
  const crewOf = (h) => h.party_name || "";
  const clsOf = (h) => h.title || A.clsName(h.cls);
  const ORDER = {
    renown: (a, b) => b.renown - a.renown || b.level - a.level,
    level: (a, b) => b.level - a.level || b.renown - a.renown,
    class: (a, b) => clsOf(a).localeCompare(clsOf(b)) || b.renown - a.renown,
    crew: (a, b) => (!crewOf(a) - !crewOf(b)) || crewOf(a).localeCompare(crewOf(b)) || b.renown - a.renown,
    silver: (a, b) => purse(b) - purse(a) || b.renown - a.renown,
  };
  const GROUP = { class: clsOf, crew: (h) => crewOf(h) || "On their own" };

  A.route(/^\/roster(?:\/(\w+))?(?:\/(\w+))?$/, (v, tab, sort) => {
    tab = tab || (!L.heroes.length && L.pending.length ? "pending" : "active");
    sort = ORDER[sort] ? sort : "renown";
    v.appendChild(el("div", { class: "rs-head" }, el("h1", null, "The Roster"),
      el("span", { class: "small muted" }, "The standings, by ", el("b", null, "renown"), " ", Views.helpLink ? Views.helpLink("renown", "renown") : null)));
    const tabs = el("div", { class: "tabs" });
    const counts = { active: L.heroes.filter((h) => h.alive).length, pending: L.pending.length, fallen: L.heroes.filter((h) => !h.alive).length, mine: A.mine().length };
    for (const [k, label] of [["active", "Active"], ["mine", "★ Mine"], ["pending", "Joining next season"], ["fallen", "Fallen"]])
      tabs.appendChild(el("button", { class: k === tab ? "on" : "", onclick: () => (location.hash = `#/roster/${k}${sort !== "renown" ? "/" + sort : ""}`) }, `${label} (${counts[k]})`));
    v.appendChild(tabs);
    if (tab === "pending") { v.appendChild(pendingPanel()); return; }
    const list = tab === "fallen" ? L.heroes.filter((h) => !h.alive) : tab === "mine" ? A.mine().map((id) => heroes[id]).filter(Boolean) : L.heroes.filter((h) => h.alive);
    if (!list.length) {
      v.appendChild(el("p", { class: "empty" }, tab === "mine" ? "You haven't marked any hero as yours yet. Open a hero and press ★." : "No one here."));
      return;
    }
    const rank = {};
    sortedHeroes(L.heroes.filter((h) => h.alive)).forEach((h, i) => (rank[h.id] = i + 1));
    v.appendChild(el("div", { class: "rs-sorts", role: "group", "aria-label": "Sort by" }, el("span", { class: "tiny dim" }, "Sort by"),
      SORTS.map(([k, label]) => el("a", { class: "rs-chip" + (k === sort ? " on" : ""), href: `#/roster/${tab}${k === "renown" ? "" : "/" + k}`, "aria-pressed": String(k === sort) }, label))));
    const box = el("div", { class: "rs-list" });
    let group = null;
    for (const h of list.slice().sort(ORDER[sort])) {
      const g = GROUP[sort] && GROUP[sort](h);
      if (g != null && g !== group) {
        group = g;
        box.appendChild(el("div", { class: "rs-group" }, g));
      }
      box.appendChild(row(h, rank[h.id], sort));
    }
    v.appendChild(box);
    if (L.rank_week && Object.keys(L.rank_week).length && tab !== "fallen") v.appendChild(el("p", { class: "tiny dim" }, "▲▼ show how far a hero has moved in the standings since the end of last week."));
  });

  function move(h, r) {
    const was = (L.rank_week || {})[h.id];
    if (!r || !L.rank_week || !Object.keys(L.rank_week).length) return null;
    if (was == null) return el("span", { class: "rs-move dim" }, "new");
    return was > r ? el("span", { class: "rs-move green", title: `${was - r} up since last week` }, `▲${was - r}`)
      : was < r ? el("span", { class: "rs-move red", title: `${r - was} down since last week` }, `▼${r - was}`) : el("span", { class: "rs-move dim" }, "–");
  }
  function beasts(h) {
    const out = [];
    if (h.mount && window.MountArt) {
      try {
        const cv = MountArt.mountSprite(h.mount.kind, h.mount.colour, 1);
        out.push(el("span", { class: "rs-beast", title: `Rides ${h.mount.name}, ${h.mount.label.toLowerCase()}` }, cv, el("span", { class: "rs-beast-n" }, h.mount.name)));
      } catch (e) { /* the name stands alone */ }
    }
    if (h.pet) out.push(el("span", { class: "rs-beast", title: `Travels with ${h.pet.name}, ${h.pet.kind}` }, A.petSprite(h.pet, 2), el("span", { class: "rs-beast-n" }, h.pet.name)));
    return out.length ? el("span", { class: "rs-beasts" }, out) : null;
  }
  function aims(h) {
    const bits = [];
    if (h.goal && h.goal.text) bits.push(el("span", null, el("b", null, h.goal.party ? "Crew goal: " : "Goal: "), h.goal.text, h.goal.done ? el("span", { class: "green" }, " (done)") : h.goal.progress ? el("span", { class: "dim" }, ` (${h.goal.progress})`) : null));
    if (h.dream) bits.push(el("span", null, el("b", null, "Dreams "), h.dream));
    return bits.length ? el("div", { class: "rs-aims tiny" }, bits.map((b, i) => [i ? " · " : null, b])) : null;
  }
  function row(h, r, sort) {
    const m = A.mine().includes(h.id);
    return el("div", { class: `rs-row${h.alive ? "" : " dead"}${m ? " mine" : ""}` },
      el("div", { class: "rs-rank" }, h.alive && r ? el("b", null, r) : el("span", { class: "dim" }, "†"), move(h, r)),
      el("a", { class: "rs-pic", href: `#/hero/${h.id}`, tabindex: "-1", "aria-hidden": "true" }, A.heroPortrait(h, 2)),
      el("div", { class: "rs-who" },
        el("div", { class: "rs-name" }, A.heroLink(h.id), h.epithet ? el("span", { class: "gold small" }, " " + h.epithet) : null, m ? el("span", { class: "rs-yours" }, "YOURS") : null),
        el("div", { class: "small" }, el("span", { class: sort === "level" ? "rs-key" : "" }, `Lv ${h.level}`), " ", el("span", { class: sort === "class" ? "rs-key" : "" }, clsOf(h)),
          el("span", { class: "dim" }, h.npc ? " · league hero" : String(h.owner || "").toLowerCase().startsWith(h.name.toLowerCase()) ? "" : ` · ${h.owner}`)),
        el("div", { class: "tiny" }, h.party ? A.partyLink(h.party) : el("span", { class: "dim" }, h.alive === false ? `Fell in season ${h.died_season || "?"}` : "No crew"),
          h.alive ? el("span", { class: "dim" }, " · " + (h.travel ? `on the road to ${A.nodeName(h.travel.to)}` : h.doing || A.nodeName(h.loc))) : null),
        aims(h)),
      el("div", { class: "rs-nums" },
        el("div", { class: "rs-renown" + (sort === "renown" ? " rs-key" : "") }, el("b", null, h.renown), el("span", { class: "tiny dim" }, " renown")),
        el("div", { class: "tiny" + (sort === "silver" ? " rs-key" : "") }, A.money(purse(h))),
        beasts(h)));
  }
})();
