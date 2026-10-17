/* The Map page (#/map, #/map/<place>): the island, and the panel for the picked town, wild or dungeon. */
(function () {
  const A = App;
  const { L, S, cap, el } = A;
  const { boardPanel, byDayDesc, civicPanel, dangerWord, panel, stablesBlock, tip, townLedger } = Views;

  A.route(/^\/map(?:\/(\w+))?$/, (v, sel) => {
    v.appendChild(el("h1", null, "The Realm"));
    const g = el("div");
    const wrap = el("div", { class: "mapwrap" });
    const cv = el("canvas");
    const tip = el("div", { class: "maptip", hidden: true });
    wrap.append(cv, tip);
    const side = el("div", { class: "grid2 even" });
    g.append(el("div", null, wrap, el("p", { class: "small dim" }, "Tap a place to see who's there. Tap a hero to visit them.")), side);
    v.appendChild(g);
    let placed = Scenes.drawMap(cv, { scale: 3 });
    const toMap = (ev) => {
      const r = cv.getBoundingClientRect();
      return [((ev.clientX - r.left) / r.width) * cv.width, ((ev.clientY - r.top) / r.height) * cv.height, ev.clientX - r.left, ev.clientY - r.top];
    };
    const hit = (mx, my) => placed.find((p) => Math.abs(p.x - mx) < p.r && Math.abs(p.y - my) < p.r * 1.3);
    // a found roadside place: its pin stands above its point on the road; a tap anywhere near it says what it is
    const pins = window.Isle && Isle.pinsOn ? Isle.pinsOn(cv) : [];
    const pinAt = (mx, my) => {
      const k = cv._k || 2;
      // a finger is wider than a pin: the target reaches 12 screen pixels round it, 22 on a phone
      const box = cv.getBoundingClientRect().width, ph = ((window.RoadArt && RoadArt.PIN) || { h: 14 }).h;
      const reach = (box < 520 ? 22 : 12) * (cv.width / box);
      let best = null, bd = reach ** 2;
      for (const q of pins) { const d = (q.x - mx) ** 2 + (q.y - (ph / 2) * k - my) ** 2; if (d < bd) { bd = d; best = q.p; } }
      return best;
    };
    const pinText = (p) => {
      const by = (A.heroes || {})[p.by];
      return `${p.name} · found ${A.when(p.found, "on")}${by ? " by " + by.name : ""}${p.tally ? " · " + p.tally : ""}`;
    };
    // the tip stays inside the map: it flips to the left of the pointer near the right edge, and wraps on a phone
    const showTip = (txt, cx, cy) => {
      tip.hidden = !txt;
      tip.textContent = txt;
      const box = cv.getBoundingClientRect().width;
      tip.style.maxWidth = Math.max(140, box - 24) + "px";
      tip.style.whiteSpace = "normal";
      const w = tip.offsetWidth;
      tip.style.left = Math.max(4, cx + 12 + w > box ? cx - 12 - w : cx + 12) + "px"; tip.style.top = cy + 12 + "px";
    };
    cv.addEventListener("mousemove", (ev) => {
      const [mx, my, cx, cy] = toMap(ev);
      const ph = hit(mx, my);
      const pin = ph ? null : pinAt(mx, my);
      const nd = Scenes.nearestNode(mx, my, cv);
      showTip(ph ? `${ph.h.name} · ${ph.h.doing || ""}` : pin ? pinText(pin) : nd ? A.nodeName(nd) : "", cx, cy);
    });
    cv.addEventListener("mouseleave", () => (tip.hidden = true));
    cv.addEventListener("click", (ev) => {
      const [mx, my, cx, cy] = toMap(ev);
      const ph = hit(mx, my);
      if (ph) { location.hash = `#/hero/${ph.h.id}`; return; }
      const pin = pinAt(mx, my);
      if (pin) { showTip(pinText(pin), cx, cy); return; }
      const nd = Scenes.nearestNode(mx, my, cv);
      if (nd) showNode(side, nd);
    });
    showNode(side, sel && (S.towns[sel] || S.wilds[sel] || S.dungeons[sel]) ? sel : mostPopulated());
  });
  function mostPopulated() {
    const c = {};
    for (const h of L.heroes) if (h.alive && !h.travel) c[h.loc] = (c[h.loc] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map((x) => x[0])[0] || "ironhaven";
  }
  // a town's own page: its colours, motto, people, what it's known for, today's mood and deals, and what's been happening
  const TOWN_ROLE = { barkeep: "Barkeep", priest: "Priest", smith: "Smith", merchant: "Merchant", guard: "Guard", special: "" };
  function townIdentity(p, id, t) {
    const idn = t.identity || {};
    const th = (window.TownScenes && TownScenes.THEME && TownScenes.THEME[id]) || null;
    p.classList.add("town-panel");
    p.dataset.town = id;
    if (th) for (const [k, v] of Object.entries(th)) p.style.setProperty(`--town-${k}`, v);
    if (idn.tagline) p.appendChild(el("p", { class: "town-tagline" }, idn.tagline));
    if (idn.motto) p.appendChild(el("div", { class: "town-motto" }, `“${idn.motto}”`));
    p.appendChild(el("p", { class: "small muted" }, `${cap(t.size)} · ${t.services.join(", ")}`));
    if ((idn.known_for || []).length) p.appendChild(el("div", { class: "town-chips" }, el("span", { class: "tiny dim" }, "Known for "), idn.known_for.map((k) => el("span", { class: "town-chip" }, k))));
    p.appendChild(el("p", null, t.desc));
    if (idn.landmark) p.appendChild(el("p", { class: "small" }, el("b", null, idn.landmark + ". "), idn.landmark_line || ""));
    if (id === "frosthold" && L.yeti) p.appendChild(yetiBoard(L.yeti));
    const md = (L.town_mood || {})[id];
    if (md) {
      const deals = (md.deals || []).map((x) => x.good ? `${S.goods[x.good].name.toLowerCase()} ${Math.round(x.off * 100)}% off` : x.text);
      p.appendChild(el("div", { class: "town-mood" }, el("span", { class: `mood-badge mood-${md.word}` }, cap(md.word)), " ",
        el("span", { class: "small" }, (idn.mood_words || {})[md.word] || ""),
        deals.length ? el("div", { class: "town-chips", style: { marginTop: "4px" } }, el("span", { class: "tiny dim" }, "Today's deals "), deals.map((x) => el("span", { class: "town-chip deal" }, x))) : null));
    }
    const folk = t.folk || {};
    const who = Object.entries(TOWN_ROLE).filter(([r]) => folk[r]).map(([r, lab]) => {
      const name = r === "special" ? folk.special[0] : folk[r];
      const where = r === "special" ? ` (${folk.special[1]})` : "";
      return el("li", null, el("b", null, name), lab ? el("span", { class: "tiny dim" }, ` · ${lab}`) : el("span", { class: "tiny dim" }, where),
        (idn.folk || {})[r] ? el("div", { class: "tiny" }, idn.folk[r]) : null);
    });
    const buys = Object.entries(t.buyers).filter(([, m]) => m > 1).map(([g]) => S.goods[g].name.toLowerCase());
    const around = [
      el("li", null, el("b", null, "Tavern: "), `${t.tavern}`),
      t.trainer ? el("li", null, el("b", null, "Trainer: "), `${t.trainer[0]}, at ${t.trainer[1]}`) : null,
      t.dish ? el("li", null, el("b", null, "To eat: "), t.dish) : null,
      t.game ? el("li", null, el("b", null, "Game of choice: "), `${t.game.name}, dealt by ${t.game.dealer}`) : null,
      (L.tarot_readers || {})[id] ? (() => {
        const r = L.tarot_readers[id], name = r.label === "seer" ? "a seer" : r.label === "fraud" ? "a fraud, say some" : null;
        return el("li", null, el("b", null, "Fortune-teller: "), `${r.name}, ${r.title}`, name ? el("span", { class: r.label === "seer" ? "gold" : "dim" }, ` (${name}: ${r.hits} of ${r.checked} came true)`) : null,
          r.also ? el("div", { class: "tiny" }, `${r.also.name}, ${r.also.title}, reads for ${r.also.for.map((c) => c + "s").join(", ").replace(/, ([^,]*)$/, " and $1")}.`) : null,
          r.fair ? el("div", { class: "tiny gold" }, "The omen fair is on: readings at half price.") : null,
          r.visitor ? el("div", { class: "tiny" }, `Visiting: ${r.visitor.name}, ${r.visitor.title}.`) : null,
          r.rival ? el("div", { class: "tiny" }, `Across the square: ${r.rival.name}, ${r.rival.title}.`) : null);
      })() : null,
      buys.length ? el("li", { class: "gold" }, el("b", null, "Pays well for: "), buys.join(", ")) : null,
      el("li", { class: "dim" }, el("b", null, "Odd jobs: "), t.jobs.join(", ").replace(/_/g, " ")),
    ].filter(Boolean);
    p.appendChild(el("div", { class: "town-grid" }, el("div", null, el("h4", null, "Who's who"), el("ul", { class: "town-list" }, who)),
      el("div", null, el("h4", null, "Around town"), el("ul", { class: "town-list" }, around))));
    const lately = L.events.filter((e) => e.loc === id && ["town_life", "town", "errand", "festival", "world", "civic", "busk", "donation", "craft", "town_rep", "folk"].includes(e.kind))
      .sort(byDayDesc).slice(0, 4);
    if (lately.length) p.appendChild(el("div", null, el("h4", null, "Lately in " + t.name), A.feed(lately, {})));
    const maps = (L.map_stock || {})[id] || [];
    if (maps.length) p.appendChild(el("p", { class: "small" }, "The mapmaker sells: ", maps.map((m, i) => [i ? ", " : "",
      el("a", { href: `#/map/${m.dungeon}` }, S.dungeons[m.dungeon].name), ` (${m.pct}%, drawn by `, A.heroLink(m.by), ")"])));
  }
  // one move a day, pinned under a white footprint; whoever answers the Society's letters is never named
  function yetiBoard(y) {
    const box = el("div", { class: "yeti-board" }, el("h4", null, "The Yeti Society's correspondence game"));
    const spot = el("div");
    box.appendChild(spot);
    A.need(["chess_replay"]).then(() => spot.replaceWith(ChessReplay.player(y))).catch(() => { /* the words below still tell it */ });
    const us = y.players.find((x) => !x.yeti);
    const who = y.hero ? [A.heroLink(y.hero), " plays the Society's side by letter"] : ["The Society plays its own side"];
    const state = y.result ? (y.result === "draw" ? "The game was drawn." : y.players[y.winner].yeti ? "The footprint won." : `${us.name} beat the footprint${y.badge ? " and wears the Society's badge" : ""}.`)
      : `Move ${y.move}, day ${y.yeti.day}. The reply arrives overnight, under a white footprint.`;
    box.appendChild(el("p", { class: "small" }, ...who, ". ", state));
    const past = (y.past || []).filter((x) => x.society_won);
    if (past.length) box.appendChild(el("p", { class: "tiny dim" }, "Beaten the footprint before: ", past.map((x, i) => [i ? ", " : "", x.hero ? A.heroLink(x.hero) : "the Society"])));
    return box;
  }
  function showNode(side, id) {
    side.innerHTML = "";
    const t = S.towns[id], d = S.dungeons[id], w = S.wilds[id];
    const here = L.heroes.filter((h) => h.alive && h.loc === id && !h.travel);
    const p = panel(A.nodeName(id));
    const kind = Scenes.locKind(id);
    const TS = window.TownScenes;
    let bd = null;
    if (TS) { try { bd = TS.header(id, 560, 170); } catch (e) { bd = null; } }
    if (!bd) bd = Scenes.backdrop(kind === "town" ? "plains" : kind, 200, 60, Art.hash(id));
    bd.style.width = "100%"; bd.style.borderRadius = "4px";
    p.appendChild(bd);
    if (window.TownMusic) { try { t ? TownMusic.play(id) : TownMusic.stop(); } catch (e) { /* sound is optional */ } }
    if (t) townIdentity(p, id, t);
    if (d) {
      const st = L.dungeons[id] || {};
      p.appendChild(el("p", { class: "small muted" }, `Level ${d.level} dungeon · ${d.floors} floors · ${dangerWord(st.danger)}`));
      p.appendChild(el("p", null, d.desc));
      p.appendChild(el("p", null, el("a", { class: "dg-open", href: `#/dungeon/${id}` }, "Open the map of its floors ▸")));
      const pct = Math.round(st.explored || 0);
      p.appendChild(el("div", { class: "small" }, `Explored: ${st.explored_word || "untouched (0%)"}`,
        el("div", { class: "bar", style: { marginTop: "3px" } }, el("i", { style: { width: `${pct}%` } }))));
      const mappers = L.heroes.filter((x) => (x.maps || []).some((m) => m.dungeon === id && m.pct >= 30));
      if (mappers.length) p.appendChild(el("p", { class: "small dim" }, "Holding maps of it: ", mappers.map((x, i) => [i ? ", " : "", A.heroLink(x.id)])));
      const bossRow = el("div", { class: "row" }, A.monsterSprite(d.boss, 2, true), el("div", null, el("b", null, d.boss_name),
        el("div", { class: st.boss_alive === false ? "green small" : "red small" }, st.boss_alive === false ? "Slain. Something new will move in." : "Lurking in the deepest chamber.")));
      p.appendChild(bossRow);
      for (const k of (st.boss_kills || []).slice(-3)) p.appendChild(el("p", { class: "small" }, `Slain by ${k.by} (season ${k.season})`));
    }
    if (w) p.appendChild(el("p", { class: "small muted" }, `Wilderness · roughly level ${w.level}`));
    const bodies = (L.remains || {})[id] || [];
    if (bodies.length) p.appendChild(el("p", { class: "small red" }, "Unburied here: ", bodies.map((r, i) => [i ? ", " : "", A.heroLink(r.hero)])));
    const who = panel(here.length ? `Here now (${here.length})` : "Nobody here right now");
    const grid = el("div", { class: "stack" });
    for (const h of here) grid.appendChild(A.heroCard(h));
    who.appendChild(grid);
    if (!t) {
      side.append(p, who);
      return;
    }
    // two columns that stack independently: the town's long story on the left, the short practical panels on the right
    const stb = stablesBlock(id);
    side.append(el("div", { class: "town-col" }, p, townLedger(id)),
      el("div", { class: "town-col" }, boardPanel(id), stb ? panel("The stables", stb) : null, civicPanel(id), who));
  }

  window.addEventListener("hashchange", () => { if (!/^#\/map/.test(location.hash) && window.TownMusic) { try { TownMusic.stop(); } catch (e) { /* optional */ } } });
})();
