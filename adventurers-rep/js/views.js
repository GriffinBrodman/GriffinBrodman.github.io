/* Page views. */
(function () {
  "use strict";
  const A = App;
  const { el, L, S, heroes, parties, events, cap, plural } = A;

  const byDayDesc = (a, b) => b.day - a.day || b.imp - a.imp || idNum(b.id) - idNum(a.id);
  const idNum = (id) => parseInt(String(id).replace(/\D/g, ""), 10) || 0;
  const evs = () => L.events.slice();
  const lastDay = () => Math.max(0, ...L.events.map((e) => e.day));
  const fightSet = new Set(L.fights_index || []);
  const TRAIT_WORDS = {
    boldness: ["wary", "cautious", "steady", "bold", "fearless"], risk: ["careful", "prudent", "measured", "daring", "reckless"],
    greed: ["generous", "modest", "fair", "coin-minded", "treasure-hungry"], sociability: ["loner", "reserved", "easygoing", "outgoing", "the life of the party"],
    honor: ["roguish", "rule-bending", "practical", "decent", "upright"], curiosity: ["unbothered", "settled", "interested", "nosy", "insatiable"],
    temper: ["serene", "calm", "even", "touchy", "fiery"], loyalty: ["free-spirited", "independent", "dependable", "devoted", "unshakeable"],
  };
  // how a voice reads on the hero's own page, where the owner's friends see it
  const VOICE_WORD = { cruel: "sharp", mercenary: "business", pompous: "grandly", curt: "short", esoteric: "in riddles" };
  const voiceWord = (v) => VOICE_WORD[v] || v;
  const TRAIT_LABEL = { boldness: "Boldness", risk: "Risk tolerance", greed: "Greed", sociability: "Sociability", honor: "Honour",
    curiosity: "Curiosity", temper: "Temper", loyalty: "Loyalty" };
  function traitWord(t, v) { const w = TRAIT_WORDS[t]; return w[Math.min(4, Math.max(0, Math.floor((v + 1) / 0.4)))]; }

  function panel(title, ...kids) { return el("section", { class: "panel" }, title ? el("h2", null, title) : null, ...kids); }

  // ---------- class identity: blade, bow or spell gives a hero's page its own colours, emblem and fighting summary ----------
  function basePath(c) {
    let k = c;
    for (let i = 0; i < 4 && S.classes[k] && (S.classes[k].from || []).length; i++) k = S.classes[k].from[0];
    return { warrior: "warrior", ranger: "ranger", mage: "mage" }[k] || "warrior";
  }
  const PATH = {
    warrior: { word: "steel", stat: "might" },
    ranger: { word: "the bow", stat: "agility" },
    mage: { word: "spellwork", stat: "mind" },
  };
  // class emblems come from the art engine (Art.classEmblem); until it has them, the slot stays empty
  function classIcon(path, px) {
    if (!(window.Art && Art.classEmblem)) return el("span", { class: "cls-icon empty" });
    const cv = Art.classEmblem(path).toCanvas(1);
    cv.className = "cls-icon";
    cv.style.width = cv.style.height = 16 * (px || 2) + "px";
    return cv;
  }
  function signature(h) {
    const used = (h.skills || []).filter((s) => s.type !== "world" && s.uses).sort((a, b) => b.uses - a.uses);
    return used[0] || null;
  }
  function nextStep(h) {
    const nx = h.next_class;
    if (nx && nx.level === h.level + 1) return `Becomes ${/^[aeiou]/i.test(nx.name) ? "an" : "a"} ${nx.name} at level ${nx.level}`;
    return `New skill at level ${h.level + 1}`;
  }
  // the strongest few traits, in the same words as the Personality panel, plus what they fear
  function strongTraits(traits, n) {
    return Object.entries(traits || {}).filter(([t, v]) => TRAIT_WORDS[t] && Math.abs(v) >= 0.35).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, n).map(([t, v]) => traitWord(t, v));
  }
  function personaStrip(h) {
    const words = strongTraits(h.traits, 4);
    const fears = (h.fears || []).slice(0, 1).map((f) => `afraid of ${f}`);
    if (!words.length && !fears.length) return null;
    return el("div", { class: "class-strip persona" }, ...words.map((w) => el("span", { class: "pill soft" }, w)), ...fears.map((f) => el("span", { class: "pill soft" }, f)),
      h.voice ? el("span", { class: "pill soft" }, `talks ${voiceWord(h.voice)}`) : null);
  }
  // the row the hero really fights in (a crossbow puts anyone at the back), from the export; the class row only as a fallback
  const rowOf = (h) => h.row || (S.classes[h.cls] || {}).row || "front";
  const ROW_TIP = { front: "Front row: stands in front with a blade, axe, mace, daggers or a spear, and takes the hits first.",
    back: "Back row: fights from behind the line with a bow, crossbow, staff or wand, where foes have a harder time reaching." };
  function classStrip(h) {
    const path = basePath(h.cls), sig = signature(h), row = rowOf(h);
    return el("div", { class: "class-strip" }, classIcon(path, 2),
      tip(el("span", { class: "pill" }, row === "front" ? "Front row" : "Back row"), ROW_TIP[row]),
      el("span", { class: "pill" }, `Fights with ${PATH[path].word}`),
      sig ? tip(el("span", { class: "pill gold" }, `Signature: ${sig.name}, used ${plural(sig.uses, "time")}`),
        `${h.name}'s signature move: the fighting skill used most. ${sig.desc || ""}`, sig.name) : null,
      h.alive ? el("span", { class: "pill" }, nextStep(h)) : null);
  }
  function fightCard(h) {
    const c = Object.assign({}, S.classes[h.cls] || {}, { row: rowOf(h) }), path = basePath(h.cls), sig = signature(h);
    const fighting = (h.skills || []).filter((s) => s.type !== "world");
    const known = new Set((h.skills || []).map((s) => s.name));
    const learned = (h.diary || []).slice().reverse().map(([, t]) => /reached level \d+ \(learned ([^;)]+)/.exec(t)).find((m) => m && known.has(m[1].trim()));
    const line = `${h.name} fights from the ${c.row === "front" ? "front row, taking the hits" : "back row, out of reach"}, with ${PATH[path].word}` +
      (sig ? `. Best known for ${sig.name} (${plural(sig.uses, "use")}).` : ". No signature move yet; the first real fight will tell.");
    return el("section", { class: "panel tight fight-card" }, el("div", { class: "row", style: { gap: "12px", alignItems: "flex-start" } }, classIcon(path, 3),
      el("div", { style: { flex: 1 } }, el("div", { class: "small" }, el("b", null, `${h.title}. `), c.desc || ""), el("div", { class: "small", style: { marginTop: "3px" } }, line),
        fighting.length ? el("div", { class: "row wrap", style: { gap: "4px", marginTop: "6px" } }, ...fighting.map((s) => skillTip(el("span", { class: "pill" + (sig && s.id === sig.id ? " gold" : "") }, s.name), s))) : null,
        learned ? el("div", { class: "tiny dim", style: { marginTop: "4px" } }, `Latest trick: ${learned[1]}. ${nextStep(h)}.`) : null)));
  }
  const SKILL_GROUPS = [["Damage", ["attack", "aoe", "multi", "cleave"]], ["Healing", ["heal", "heal_all"]], ["Defence", ["guard", "buff_all", "rally", "buff_self"]],
    ["Tricks", ["debuff_all", "fear", "stealth", "summon", "trigger"]], ["Always on", ["passive"]], ["On the road", ["world"]]];
  function keystoneCard(s, h) {
    return el("div", { class: "skill keystone-card" }, el("div", { class: "row between" }, el("span", { class: "nm" }, "✦ ", s.name), el("span", { class: "tiny" }, `keystone · level ${s.keystone}`)),
      el("div", { class: "small" }, s.does || s.desc), s.does ? el("div", { class: "tiny dim", style: { fontStyle: "italic" } }, s.desc) : null,
      el("div", { class: "tiny muted" }, `A turning point: ${h.name} became this at level ${s.keystone}, and it stays for good.`
        + (s.uses ? ` It has come into play ${plural(s.uses, "time")}.` : "")));
  }
  function skillCard(s, sig, most) {
    const kinds = { passive: "passive", trigger: "trigger", world: "world" };
    return el("div", { class: `skill ${kinds[s.type] || ""}${sig && s.id === sig.id ? " sig" : ""}`, style: { marginBottom: "5px" } },
      el("div", { class: "row between" }, el("span", { class: "nm" }, sig && s.id === sig.id ? "★ " : "", s.name, s.rank > 1 ? ` ${"I".repeat(s.rank)}` : ""),
        el("span", { class: "tiny dim" }, s.type === "world" ? "out of combat" : s.type === "passive" ? "always on" : s.uses ? `used ${plural(s.uses, "time")}` : "not used yet")),
      el("div", { class: "small muted" }, s.desc),
      s.uses && s.type !== "world" && s.type !== "passive" ? A.bar(s.uses, most, "gold") : null,
      s.school ? el("span", { class: "school" }, s.school.replace(/_/g, " ")) : null);
  }
  function skillsPanel(h) {
    const sk = panel("Skills");
    const sig = signature(h);
    const most = Math.max(1, ...(h.skills || []).map((s) => s.uses || 0));
    const all = h.skills || [], keys = all.filter((s) => s.keystone).sort((a, b) => a.keystone - b.keystone);
    for (const s of keys) sk.appendChild(keystoneCard(s, h));
    for (const [label, types] of SKILL_GROUPS) {
      if (types.includes("world")) continue;
      const list = all.filter((s) => types.includes(s.type) && !s.keystone).sort((a, b) => (b.uses || 0) - (a.uses || 0));
      if (!list.length) continue;
      sk.appendChild(el("div", { class: "tiny gold skill-group" }, label));
      for (const s of list) sk.appendChild(skillCard(s, sig, most));
    }
    const road = all.filter((s) => s.type === "world" && !s.keystone);
    if (road.length) {
      const names = road.map((s) => s.name.charAt(0).toLowerCase() + s.name.slice(1));
      sk.appendChild(el("details", { class: "also-good" }, el("summary", { class: "small" }, el("b", null, "Also good at: "), names.join(", ")),
        ...road.map((s) => skillCard(s, sig, most))));
    }
    if (!(h.skills || []).length) sk.appendChild(el("p", { class: "empty" }, "No skills yet."));
    sk.appendChild(el("p", { class: "tiny dim", style: { marginTop: "6px" } }, `Every level brings a skill, picked by what ${h.name} has been doing. ${nextStep(h)}.`));
    return sk;
  }
  function classTree(h) {
    const p = panel("Class journey");
    const row = el("div", { class: "journey" });
    const sprite = (c) => A.spriteCanvas((f) => Art.heroGrid(Object.assign({}, h, { cls: c, legend: false, kit: null }), f, S.classes[c]), 2, "", false);
    h.class_history.forEach(([day, c], i) => {
      if (i) row.appendChild(el("div", { class: "arrow" }, "→"));
      row.appendChild(el("div", { class: "step" }, sprite(c), el("div", { class: "small" }, S.classes[c].name), el("div", { class: "tiny dim" }, day ? A.when(day) : "")));
    });
    p.appendChild(row);
    p.appendChild(el("p", { class: "tiny dim" }, "Drawn in each class's own look; the Kit shows what they actually wear."));
    p.appendChild(el("p", { class: "small muted" }, S.classes[h.cls].desc));
    return p;
  }
  function sortedHeroes(list) { return list.slice().sort((a, b) => (b.alive - a.alive) || b.renown - a.renown || b.level - a.level); }

  // ================= HOME: The Daily Crier =================
  const heroic = (e) => (e.heroes || []).length || (e.parties || []).length || ["season_end", "season_start"].includes(e.kind);
  // what one day's front page shows, from that day's events and the two days before it
  function crierDay(today, E) {
    const allToday = E.filter((e) => e.day === today).sort((a, b) => b.imp - a.imp || idNum(a.id) - idNum(b.id));
    const todays = allToday.filter(heroic);
    const elsewhere = allToday.filter((e) => !heroic(e) && e.imp >= 2);
    const seasonEnd = todays.find((e) => e.kind === "season_end");
    // deaths are rare by design; when one happens it is the story of the day
    const death = todays.find((e) => e.kind === "death");
    // the spotlight rotates: yesterday's stars don't take the lead again unless nothing else comes close
    const leadOf = (day) => E.filter((e) => e.day === day && heroic(e)).sort((a, b) => b.imp - a.imp || idNum(a.id) - idNum(b.id))[0];
    const recentStars = new Set([leadOf(today - 1), leadOf(today - 2)].filter(Boolean).flatMap((e) => e.heroes || []));
    const fresh = todays.find((e) => e.imp >= (todays[0] ? todays[0].imp - 1 : 9) && e.imp >= 3 && !(e.heroes || []).some((id) => recentStars.has(id)));
    let lead = seasonEnd || death || fresh || todays[0];
    if (!lead || lead.imp < 3) {
      const recent = E.filter((e) => heroic(e) && e.day >= today - 1 && e.day <= today && e.imp >= 3).sort((a, b) => b.imp - a.imp || b.day - a.day);
      lead = recent[0] || lead || E.filter((e) => heroic(e) && e.day <= today).sort(byDayDesc)[0];
    }
    const keys = todays.filter((e) => e.kind === "keystone" && e.imp >= 4 && e !== lead);
    const roundup = keys.length > 2 ? keys : [];
    const few = roundup.length ? [] : keys;
    const second = few.concat(todays.filter((e) => e !== lead && e.imp >= 3 && !keys.includes(e)).slice(0, Math.max(0, 4 - few.length)));
    const shown = new Set([lead, ...second, ...roundup]);
    return { todays, elsewhere, lead, second, roundup, main: todays.filter((e) => e.imp >= 2 && !shown.has(e)), small: todays.filter((e) => e.imp < 2) };
  }
  function leadAndSecond(parch, lead, second, today, roundup) {
    if (lead) {
      const scene = Scenes.vignette(lead, 240, 72);
      scene.className = "scene";
      const hl = (L.llm_lead || {})[lead.id] || headline(lead);
      parch.appendChild(el("div", { class: "lead" },
        lead.day < today ? el("div", { class: "small muted" }, "Still the talk of the taverns, from yesterday:") : null,
        el("h1", null, A.richText(hl, lead.heroes, lead.parties)),
        (() => { const owners = [...new Set((lead.heroes || []).map((id) => heroes[id]).filter((x) => x && !x.npc).map((x) => `${x.name} (${x.owner})`))].slice(0, 4);
          return owners.length ? el("div", { class: "small muted" }, "Starring " + owners.join(", ")) : null; })(),
        scene,
        el("p", { class: "muted" }, hl === lead.text ? (lead.loc ? A.nodeName(lead.loc) : "") : A.richText(lead.text, lead.heroes, lead.parties),
          lead.fight && fightSet.has(lead.fight) ? el("a", { href: `#/fight/${lead.fight}`, class: "watch" }, "  ▶ watch the fight") : null,
          " ", A.shareBtn(hl === lead.text ? lead.text : `${hl}. ${lead.text}`, issueOf(lead.day) && lead.day !== lastDay() ? `#/day/${lead.day}` : (lead.heroes || []).some((id) => heroes[id]) ? `#/hero/${lead.heroes.find((id) => heroes[id])}` : "#/")),
        lead.kind === "season_end" ? el("p", null, el("a", { class: "btn primary", href: `#/finale/${lead.season}` }, "🏆 Enter the ceremony"),
          L.annals ? [" ", el("a", { class: "btn primary", href: "#/annals" }, "📜 The Annals of the Age")] : null) : null));
    }
    if (second.length || (roundup || []).length) parch.appendChild(el("h4", { style: { color: "#6a5a4a", marginTop: "6px" } }, "Also today"));
    if ((roundup || []).length) parch.appendChild(el("div", { class: "ks-roundup" }, el("div", { class: "ks-head" }, "✦ Reaching new heights"),
      el("p", { class: "tiny muted" }, `${plural(roundup.length, "hero")} reached a turning point today.`), A.feed(roundup, { noDay: true })));
    if (second.length) parch.appendChild(A.feed(second, { noDay: true }));
  }
  function smallerHappenings(p, small) {
    if (!small.length) return;
    const more = el("div", { hidden: true }, A.feed(small, { noDay: true }));
    p.appendChild(el("button", { class: "btn small", onclick: (ev) => { more.hidden = !more.hidden; ev.target.textContent = more.hidden ? `+ ${small.length} smaller happenings` : "hide"; } }, `+ ${small.length} smaller happenings`));
    p.appendChild(more);
  }
  const issueOf = (day) => (L.issues || []).find((x) => x.day === day);
  const issueLabel = (x) => `Season ${x.season} · Day ${x.sday}`;
  const issueHref = (x) => (x.day === lastDay() ? "#/" : `#/day/${x.day}`);
  function issueNav(day) {
    const is = L.issues || [], i = is.findIndex((x) => x.day === day);
    const prev = i > 0 ? is[i - 1] : null, next = i >= 0 && i < is.length - 1 ? is[i + 1] : null;
    if (!prev && !next) return null;
    return el("div", { class: "issue-nav" },
      prev ? el("a", { href: issueHref(prev) }, `‹ Day ${prev.sday}`) : el("span"),
      el("a", { href: "#/days" }, "Back issues"),
      next ? el("a", { href: issueHref(next) }, `Day ${next.sday} ›`) : el("span"));
  }

  // ================= BACK ISSUES =================
  A.route(/^\/days$/, (v) => {
    const is = (L.issues || []).slice().reverse();
    const p = panel("Back issues of the Crier", el("p", { class: "small muted" }, "Every day's front page this age, newest first."));
    let season = null, ul = null;
    for (const x of is) {
      if (x.season !== season) { season = x.season; p.appendChild(el("h4", null, `Season ${season}`)); ul = el("div", { class: "issues" }); p.appendChild(ul); }
      ul.appendChild(el("a", { class: "btn small", href: issueHref(x) }, `Day ${x.sday}`));
    }
    if (!is.length) p.appendChild(el("p", { class: "empty" }, "The first issue comes out on day 1."));
    v.appendChild(p);
  });
  A.route(/^\/day\/(\d+)$/, (v, d) => {
    const day = +d, x = issueOf(day);
    if (!x) { v.appendChild(panel("No such issue", el("p", null, el("a", { href: "#/days" }, "All back issues →")))); return; }
    return A.load(`day/${day}`).then((iss) => {
      const parch = el("section", { class: "panel parch" });
      parch.appendChild(el("div", { class: "mast" },
        el("div", { class: "title" }, "The Daily Crier"),
        el("div", { class: "sub" }, el("span", null, issueLabel(x)), el("span", null, L.meta.name), el("span", null, "Back issue")),
        issueNav(day)));
      const { elsewhere, lead, second, roundup, main, small } = crierDay(day, iss.events);
      leadAndSecond(parch, lead, second, day, roundup);
      v.appendChild(parch);
      const p = panel(`That day · ${issueLabel(x)}`);
      p.appendChild(A.feed(main, { noDay: true, empty: "A quiet day." }));
      smallerHappenings(p, small);
      v.appendChild(p);
      if (elsewhere.length) v.appendChild(panel("Elsewhere in the realm", el("ul", { class: "diary" }, elsewhere.slice(0, 5).map((e) => el("li", null, A.richText(e.text, [], e.parties))))));
    });
  });

  A.route(/^\/$/, (v) => {
    const meta = L.meta;
    const parch = el("section", { class: "panel parch" });
    const theme = meta.theme;
    parch.appendChild(el("div", { class: "mast" },
      el("div", { class: "title" }, "The Daily Crier"),
      el("div", { class: "sub" },
        el("span", null, meta.phase === "preseason" ? "Preseason edition" : `Season ${meta.season} · Day ${meta.season_day}`),
        el("span", null, meta.name),
        el("span", null, theme ? theme.name : "All the news that's fit to shout")),
      meta.phase === "preseason" ? null : issueNav(lastDay())));
    const mineFirst = A.mine().map((id) => heroes[id]).filter(Boolean);
    if (L.annals) v.appendChild(el("section", { class: "finale-hero age-end" },
      el("div", { class: "finale-kicker" }, "The end of an age"),
      el("h1", null, "The league closes its books"),
      el("p", null, `${plural(L.annals.seasons, "season")}, ${plural(L.annals.days, "day")}. The legends, the champions, the fallen and the grudges are written down.`),
      el("a", { class: "btn primary", href: "#/annals" }, "📜 Read the Annals of the Age")));
    if (mineFirst.length && meta.phase !== "preseason") v.appendChild(followPanel(mineFirst, lastDay()));
    const picker = !mineFirst.length && !skippedPick() && L.heroes.length ? pickPanel() : null;
    v.appendChild(parch);
    if ((L.card || []).length && meta.phase === "season") v.appendChild(panel("On the card", el("p", { class: "small dim" }, "What to watch for next."),
      el("ul", { class: "diary card-list" }, L.card.map((c) => el("li", null, A.richText(c.text, c.heroes, c.parties))))));
    if (picker) v.appendChild(picker);
    const wxs = weatherStrip();
    if (wxs) parch.appendChild(wxs);
    const hb = hyperBanner();
    if (hb) v.appendChild(hb);

    if (meta.phase === "preseason" || !L.heroes.length) {
      parch.appendChild(el("div", { class: "lead" },
        el("h1", null, "The league opens soon"),
        el("p", null, `Heroes are signing up. When ${meta.commissioner} runs the first day, every hero below will wake up in a random town and start living their life. You don't control them; you just check in.`)));
      const yours = A.mine().map((id) => L.pending.find((h) => h.id === id)).filter(Boolean);
      if (yours.length) v.appendChild(el("section", { class: "panel follow" }, el("div", { class: "row wrap between" },
        el("b", null, `You're ${yours.map((h) => h.name).join(" and ")}. `, el("span", { class: "small muted" }, "They'll be waiting here every time you check in, from day 1.")),
        el("button", { class: "btn small", onclick: () => { for (const h of yours) A.toggleMine(h.id); rerender(); } }, "Switch hero"))));
      else v.appendChild(skippedPick() ? panel(null, notListed()) : pickPanel());
      v.appendChild(pendingPanel());
      if (L.pending.length && window.Tavern) v.appendChild(panel(L.tavern ? `Meanwhile, at ${L.tavern.name}` : "Meanwhile, at the tavern",
        el("p", { class: "small muted" }, "Everyone who's signed up, the night before the league opens. Tap someone to hear what they have to say."),
        Tavern.scene(L, S, A)));
      return;
    }

    const today = lastDay();
    const { elsewhere, lead, second, roundup, main, small } = crierDay(today, L.events);
    leadAndSecond(parch, lead, second, today, roundup);

    const lastSeason = (L.seasons || [])[L.seasons.length - 1];
    if (lastSeason && (meta.phase === "offseason" || lastSeason.end_day >= meta.day - 1)) v.appendChild(finalePanel(lastSeason));
    if (!mineFirst.length && skippedPick()) v.appendChild(el("section", { class: "panel follow tight" },
      el("div", { class: "row wrap between" }, el("span", null, "Tip: open your hero's page and press ", el("b", null, "★ This is mine"), " to pin them here every time you check in."),
        el("a", { class: "btn small", href: "#/roster" }, "Find your hero"))));

    v.appendChild(el("div", { class: "grid2 even" }, tablePanel(), partiesPanel()));
    const lifetime = lifetimePanel();
    if (lifetime) v.appendChild(lifetime);
    const grid = el("div", { class: "grid2" });
    const left = el("div");
    const right = el("div");
    grid.append(left, right);
    v.appendChild(grid);

    const p = panel(`Since yesterday · Day ${L.meta.season_day}`);
    p.appendChild(A.feed(main, { noDay: true, empty: "A quiet day." }));
    const snips = (L.snippets || []).filter((x) => heroes[x.hero]);
    if (main.length < 5 && snips.length) {
      p.appendChild(el("h4", { style: { marginTop: "10px" } }, "Around the league"));
      p.appendChild(el("ul", { class: "diary" }, snips.slice(0, 6 - Math.min(4, main.length)).map((x) => el("li", null, x.text.startsWith(heroes[x.hero].name) ? A.richText(x.text + ".", Object.keys(heroes), []) : [A.heroLink(x.hero), " " + x.text + "."]))));
    }
    smallerHappenings(p, small);
    left.appendChild(p);
    const week = L.events.filter((e) => e !== lead && heroic(e) && e.day < today && e.day >= today - 6 && e.imp >= 4).sort(byDayDesc).slice(0, 14);
    if (week.length) left.appendChild(panel("Earlier this week", A.feed(week, { dayHeaders: true })));

    if (theme) right.appendChild(el("section", { class: "panel theme-banner tight" }, el("div", null, el("h3", { class: "gold" }, theme.name), el("p", { class: "small" }, theme.desc))));
    const radar = (L.world_events || []).map((we) => we.kind === "sighting" ? `Monster sighting in ${A.nodeName(we.wild, true)}: double bounties (${plural(we.days, "day")} left)`
      : we.kind === "festival" ? `Festival in ${A.nodeName(we.town, true)} (${plural(we.days, "day")} left)` : we.kind === "games" ? `${cap(we.event)} contest in ${A.nodeName(we.town, true)} in ${plural(we.days - 1, "day")}` : null).filter(Boolean);
    if (radar.length) right.appendChild(panel("On the radar", el("ul", { class: "diary" }, radar.map((r) => el("li", null, r)))));
    const wider = elsewhere.concat(L.events.filter((e) => !heroic(e) && e.day === today - 1 && e.imp >= 3)).slice(0, 5);
    if (wider.length) right.appendChild(panel("Elsewhere in the realm", el("ul", { class: "diary" }, wider.map((e) => el("li", null, A.richText(e.text, [], e.parties)))),
      el("p", { class: "small" }, el("a", { href: "#/world" }, "The wider world →"))));
    right.appendChild(songsPanel());
    right.appendChild(bondsPanel());
    if (L.pending.length) right.appendChild(pendingPanel(true));
    const mini = el("canvas");
    Scenes.drawMap(mini, { scale: 1, small: true });
    mini.style.width = "100%";
    right.appendChild(panel("Where is everyone?", el("a", { href: "#/map" }, mini), el("p", { class: "small muted" }, el("a", { href: "#/map" }, "Open the map →"))));
  });

  function headline(e) {
    const H = (id) => (heroes[id] || {}).name || "Someone";
    const P = (id) => (parties[id] || {}).name || "A party";
    const h0 = H((e.heroes || [])[0]), h1 = H((e.heroes || [])[1]);
    switch (e.kind) {
      case "death": return `${h0} is dead`;
      case "boss_kill": return `${(e.parties || []).length ? P(e.parties[0]) : h0} slays the beast of ${A.nodeName(e.loc, true)}`;
      case "body_sold": return `${h0} sells ${h1}'s body`;
      case "body_taken": return `${h0} bags a fallen hero`;
      case "party_formed": return `New party: ${P(e.parties[0])}`;
      case "party_disband": return `${P(e.parties[0])} breaks up`;
      case "evolve": return `${h0} becomes a ${A.clsName(e.cls_to)}`;
      case "bond": return e.bond === "sweethearts" ? `${h0} & ${h1}: it's love` : e.bond === "nemeses" ? `${h0} and ${h1} declare war` : e.bond === "rivals" ? `${h0} vs ${h1}: a rivalry is born` : `${h0} and ${h1}, friends`;
      case "pvp": return `Blood between heroes near ${A.nodeName(e.loc, true)}`;
      case "robbery": return `Highway robbery!`;
      case "season_start": return e.text.split(":")[0];
      case "season_end": return (e.heroes || []).length ? `${h0} is Hero of the Season` : `Season over`;
      case "brawl": return `Tavern brawl`;
      case "funeral": return `Farewell, ${h0}`;
      case "trait": return `${h0} is not the same hero`;
      case "poached": return `Transfer scandal: ${h0}`;
      case "crime": return `${h0} in trouble with the law`;
      case "legend": return `${h0} becomes a legend`;
      case "join": return `${h0} joins the league`;
      case "relic": return `${h0}'s mystery relic identified`;
      case "keystone": if (e.ks) return `${h0}: ${e.ks}`;
      // falls through
      default: {
        if (e.text.length < 70) return e.text;
        if (e.text.length > 110) {
          const first = (e.text.match(/^[^.!?]+[.!?]/) || [e.text])[0];
          const q = (first.match(/["\u201c\u201d]/g) || []).length % 2;
          if (!q && first.length <= 110 && (e.heroes || []).slice(0, 1).map(H).every((n) => first.includes(n))) return first.replace(/[.]$/, "");
        }
        const names = (e.heroes || []).slice(0, 2).map(H).filter((n) => n !== "Someone");
        const parts = e.text.match(/[^.!?]+[.!?]*/g) || [e.text];
        let out = "";
        for (const part of parts) {
          out += part;
          if (names.every((n) => out.includes(n))) break;
        }
        // never cut inside a quotation
        if (((out.match(/["“”]/g) || []).length % 2) || ((out.match(/(^|\s)'/g) || []).length > (out.match(/'(\s|$|[,.!?])/g) || []).length)) return e.text;
        return out.trim().replace(/[.]$/, "");
      }
    }
  }

  function runnerUp(a) {
    const r = a.runner_up;
    if (!r) return null;
    const who = r.hero ? (heroes[r.hero] || {}).name : r.party ? (parties[r.party] || {}).name : null;
    return who ? el("div", { class: "tiny runner" }, `runner-up: ${who} ${Number(r.value).toLocaleString()}`) : null;
  }
  // from season 2 on: every season side by side, so a great first season still counts
  function lifetimePanel() {
    const lt = L.lifetime;
    if (!lt || !(lt.heroes || []).length) return null;
    const n = lt.seasons, cols = Array.from({ length: n }, (_, i) => i + 1);
    const crown = (k) => (k ? el("span", { class: "gold", title: `${plural(k, "season")} won` }, " ♛".repeat(Math.min(k, 3)).trim()) : null);
    const table = (rows, name, link, alive) => {
      const t = el("table", { class: "lifetime" });
      t.appendChild(el("tr", null, el("th", null, "#"), el("th", null, name), cols.map((c) => el("th", { class: "num hide-sm" }, `S${c}`)), el("th", { class: "num" }, "Total")));
      rows.forEach((r, i) => t.appendChild(el("tr", { class: alive(r) ? "" : "dim" }, el("td", { class: "dim" }, i + 1),
        el("td", null, link(r), alive(r) ? null : " ✝", " ", crown(r.crowns)),
        cols.map((c, k) => el("td", { class: "num hide-sm" + (k === n - 1 && L.meta.phase === "season" ? " live" : "") }, r.seasons[k] == null ? "–" : r.seasons[k])),
        el("td", { class: "num gold" }, r.total))));
      return t;
    };
    const hs = lt.heroes.filter((r) => heroes[r.hero]);
    const top = table(hs.slice(0, 10), "Hero", (r) => A.heroLink(r.hero), (r) => r.alive !== false);
    const more = hs.length > 10 ? el("details", null, el("summary", { class: "small" }, `All ${hs.length} heroes`), table(hs.slice(10), "Hero", (r) => A.heroLink(r.hero), (r) => r.alive !== false)) : null;
    const ps = (lt.parties || []).slice(0, 8);
    return panel("All seasons", el("p", { class: "small muted" }, `Renown added up across ${plural(n, "season")}${L.meta.phase === "season" ? ", this one still counting" : ""}. ♛ marks a season won.`),
      el("div", { class: "scrollx" }, top), more,
      ps.length ? [el("h4", { style: { marginTop: "10px" } }, "Parties"), el("div", { class: "scrollx" }, table(ps, "Party", (r) => parties[r.party] ? A.partyLink(r.party) : el("span", null, r.name), (r) => r.active !== false))] : null);
  }
  function finalePanel(s) {
    const p = el("section", { class: "panel theme-banner" });
    p.appendChild(el("div", { style: { width: "100%" } },
      el("div", { class: "row wrap between" }, el("h2", { style: { flex: 1 } }, `Season ${s.season} is over: the awards`),
        el("a", { class: "btn primary", href: `#/finale/${s.season}` }, "🏆 The full ceremony")),
      el("p", { class: "small muted" }, L.annals ? `${s.theme}, in the books. That was the last season of this age: the Annals have the whole story.`
        : L.meta.phase === "offseason" ? "The next run starts a new season: everyone wakes up in a random town, and new heroes join." : `${s.theme}, in the books.`)));
    const aw = el("div", { class: "cols", style: { gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", width: "100%" } });
    for (const a of s.awards) {
      const h = heroes[a.hero];
      if (!h) continue;
      aw.appendChild(el("div", { class: "award" }, A.heroPortrait(h, 2), el("div", null, el("div", { class: "small gold" }, a.name), A.heroLink(h.id),
        el("div", { class: "tiny dim" }, h.npc ? "" : `${h.owner}'s hero · ${a.value}`), runnerUp(a))));
    }
    p.lastChild.appendChild(aw);
    if ((s.party_awards || []).length) {
      p.lastChild.appendChild(el("h3", { style: { marginTop: "12px" } }, "Party awards"));
      const pw = el("div", { class: "cols", style: { gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", width: "100%" } });
      for (const a of s.party_awards) {
        const pt = parties[a.party];
        if (!pt) continue;
        pw.appendChild(el("div", { class: "award" }, A.bannerSprite(pt.banner, 2), el("div", null, el("div", { class: "small gold" }, a.name), A.partyLink(pt.id),
          el("div", { class: "tiny dim" }, `${pt.members.map((m) => (heroes[m] || {}).name).filter(Boolean).join(", ")} · ${a.value}`), runnerUp(a))));
      }
      p.lastChild.appendChild(pw);
    }
    return p;
  }

  const rerender = () => window.dispatchEvent(new HashChangeEvent("hashchange"));
  function skippedPick() { try { return localStorage.getItem("al.nopick") === "1"; } catch (e) { return false; } }
  function notListed() {
    const url = L.meta.quiz_url;
    return el("p", { class: "small muted", style: { marginTop: "8px" } }, "Not listed? ",
      url ? [el("a", { href: url, target: "_blank", rel: "noopener" }, "Take the quiz"), ` and send ${L.meta.commissioner} the code it gives you.`]
        : `Ask ${L.meta.commissioner} for the quiz.`);
  }
  // the name this browser gave the quiz, if it took it here
  function quizOwner() {
    try {
      const a = JSON.parse(localStorage.getItem("al.quiz") || "null"), i = (S.quiz || []).findIndex((q) => q.id === "owner");
      return Array.isArray(a) && i >= 0 && a[i] ? String(a[i]).trim().toLowerCase() : null;
    } catch (e) { return null; }
  }
  function pickPanel() {
    const me = quizOwner(), isMe = (h) => !!me && String(h.owner || "").trim().toLowerCase() === me;
    const pool = (L.heroes.length ? L.heroes.filter((h) => h.alive && !h.npc) : L.pending.filter((h) => !h.npc).map((h) => Object.assign({}, h, { weapon_tier: 1, armor_tier: 1, alive: true })))
      .sort((a, b) => isMe(b) - isMe(a) || String(a.owner).localeCompare(String(b.owner)));
    if (!pool.length) return panel("Which one is you?", notListed());
    const grid = el("div", { class: "pick-grid" });
    const cards = pool.map((h) => {
      const b = el("button", { class: "pick" + (isMe(h) ? " me" : ""), title: `Pin ${h.name} to your Crier`, onclick: () => { A.toggleMine(h.id); A.toast(`${h.name} is yours. They'll be waiting here every time you check in.`); rerender(); } },
        A.heroPortrait(h, 1), el("b", null, h.name), String(h.owner || "").startsWith(h.name) ? null : el("span", { class: "tiny dim" }, h.owner));
      b.dataset.q = `${h.name} ${h.owner || ""}`.toLowerCase();
      grid.appendChild(b);
      return b;
    });
    const search = pool.length > 8 ? el("input", { type: "text", class: "pick-search", placeholder: "Type your name or your hero's", "aria-label": "Find your hero" }) : null;
    if (search) search.addEventListener("input", () => { const q = search.value.trim().toLowerCase(); for (const b of cards) b.hidden = !!q && !b.dataset.q.includes(q); });
    return el("section", { class: "panel follow pick-panel tight" },
      el("div", { class: "row between pick-head" }, el("b", null, "Which one is you? ", el("span", { class: "small muted" }, "Tap to pin them here.")),
        el("button", { class: "btn small", onclick: () => { try { localStorage.setItem("al.nopick", "1"); } catch (e) { /* storage unavailable */ } rerender(); } }, "Just browsing")),
      search, grid, notListed());
  }
  function followPanel(list, today) {
    const p = el("section", { class: "panel follow" }, el("div", { class: "row wrap between" },
      el("h2", null, list.length > 1 ? "Your heroes today" : "Your hero today"),
      el("button", { class: "btn small", onclick: () => { for (const h of list) A.toggleMine(h.id); try { localStorage.removeItem("al.nopick"); } catch (e) { /* storage unavailable */ } rerender(); } }, "Switch hero")));
    for (const h of list) {
      const ep = L.annals && (L.annals.epitaphs || {})[h.id];
      if (ep) p.appendChild(el("p", { class: "epilogue" }, el("b", null, `${h.name}, in the Annals: `), ep));
      const box = el("div", { class: "grid2", style: { marginBottom: "10px" } });
      box.append(A.heroCard(h), catchUp(h, today));
      p.appendChild(box);
    }
    return p;
  }

  function tablePanel() {
    const list = sortedHeroes(L.heroes.filter((h) => h.joined === L.meta.season || h.alive)).slice(0, 10);
    const t = el("table");
    t.appendChild(el("tr", null, el("th", null, "#"), el("th", null, "Hero"), el("th", { class: "num" }, "Lv"), el("th", { class: "num" }, "Renown")));
    list.forEach((h, i) => t.appendChild(el("tr", null, el("td", { class: "dim" }, i + 1),
      el("td", null, el("div", { class: "row", style: { gap: "4px" } }, A.heroPortrait(h, 1), el("div", null, A.heroLink(h.id), el("div", { class: "tiny dim" }, h.npc ? "" : h.owner)))),
      el("td", { class: "num" }, h.level), el("td", { class: "num gold" }, h.renown))));
    return panel("Hero standings", t, el("p", { class: "small" }, el("a", { href: "#/roster" }, "Full roster →")));
  }
  function partiesPanel() {
    const ps = L.parties.filter((p) => !p.disbanded).sort((a, b) => b.renown - a.renown).slice(0, 10);
    const box = panel("Party standings");
    if (!ps.length) { box.appendChild(el("p", { class: "empty" }, "No parties yet. Everyone's a lone wolf.")); return box; }
    const t = el("table", { class: "ptable" });
    t.appendChild(el("tr", null, el("th", null, "#"), el("th", null, "Party"), el("th", { class: "num" }, "Morale"), el("th", { class: "num" }, "Renown")));
    ps.forEach((p, i) => {
      const grp = el("div", { class: "grp-row" });
      for (const m of p.members) if (heroes[m]) grp.appendChild(A.heroPortrait(heroes[m], 1, { cls: "grp" }));
      t.appendChild(el("tr", null, el("td", { class: "dim" }, i + 1),
        el("td", null, el("div", { class: "row", style: { gap: "6px" } }, A.bannerSprite(p.banner, 2), el("div", null, A.partyLink(p.id), el("div", { class: "tiny dim" }, p.disposition), grp))),
        el("td", { class: "num" }, p.morale), el("td", { class: "num gold" }, p.renown)));
    });
    box.append(t, el("p", { class: "small" }, el("a", { href: "#/parties" }, "All parties →")));
    return box;
  }
  function bondsPanel() {
    const bs = (L.bonds || []).filter((b) => heroes[b.a] && heroes[b.b]);
    const feuds = L.events.filter((e) => e.kind === "feud" && e.day >= lastDay() - 14 && (e.parties || []).length === 2 && e.parties.every((p) => parties[p] && !parties[p].disbanded));
    if (!bs.length && !feuds.length) return el("span");
    const order = { sweethearts: 0, nemeses: 1, "best friends": 2, rivals: 3, friends: 4 };
    bs.sort((a, b) => order[a.type] - order[b.type]);
    const box = panel("Bonds & grudges");
    const seenF = new Set();
    for (const f of feuds) {
      const key = f.parties.slice().sort().join("|");
      if (seenF.has(key)) continue;
      seenF.add(key);
      box.appendChild(el("div", { class: "row small feud-row" }, el("span", { class: "red" }, "⚔ FEUD"), A.partyLink(f.parties[0]), el("span", { class: "dim" }, "vs"), A.partyLink(f.parties[1])));
    }
    for (const b of bs.slice(0, 8)) box.appendChild(el("div", { class: "row small", style: { marginBottom: "3px" } },
      A.heroLink(b.a), el("span", { class: b.type === "rivals" || b.type === "nemeses" ? "red" : "green" }, { sweethearts: "♥", nemeses: "☠", rivals: "⚔", "best friends": "★", friends: "☺" }[b.type] || "·"),
      A.heroLink(b.b), el("span", { class: "dim" }, b.type)));
    return box;
  }
  function pendingPanel(compact) {
    const box = panel(compact ? "Joining next season" : "Signed up so far");
    if (!L.pending.length) box.appendChild(el("p", { class: "empty" }, "Nobody yet."));
    const wrap = el("div", { class: compact ? "chip-heroes" : "cols" });
    for (const h of L.pending) {
      const hs = Object.assign({}, h, { weapon_tier: 1, armor_tier: 1, alive: true });
      if (compact) wrap.appendChild(el("span", { class: "chip-heroes" }, el("a", { href: "#/roster/pending" }, A.heroPortrait(hs, 1, { cls: "mini" }), h.name)));
      else wrap.appendChild(el("div", { class: "hcard" }, A.heroPortrait(hs, 2, { cls: "spr" }), el("div", { class: "info" }, el("div", { class: "nm" }, h.name),
        el("div", { class: "small" }, A.clsName(h.cls)), el("div", { class: "small muted" }, h.npc ? "League hero" : `${h.owner}'s hero`))));
    }
    box.appendChild(wrap);
    return box;
  }

  // ================= ROSTER =================
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

  // ================= HERO =================
  A.route(/^\/hero\/(\w+)(?:\/(\w+))?$/, (v, id, tab) => {
    const lost = () => { v.innerHTML = ""; v.appendChild(panel("We can't find that hero", el("p", null, "The link may be from an older league, or it has a typo. Every hero in this league is on the roster."),
      el("p", null, el("a", { class: "btn", href: "#/roster" }, "The Roster"), " ", el("a", { class: "btn", href: "#/" }, "Back to the Crier")))); };
    if (!heroes[id]) { lost(); return; }
    v.appendChild(el("p", { class: "loading" }, "Loading hero…"));
    return A.load(`hero/${id}`).then((h) => { v.innerHTML = ""; heroPage(v, h, tab || "story"); }, lost);
  });

  function heroPage(page, h, tab) {
    const v = el("div", { class: `heropage path-${basePath(h.cls)}` });
    page.appendChild(v);
    const head = el("section", { class: "panel hero-panel" });
    head.appendChild(el("div", { class: "path-mark" }, classIcon(basePath(h.cls), 8)));
    const portrait = el("div", { class: "portrait" }, A.heroPortrait(h, 5, { cls: "main" }), A.heroSprite(h, 3, { cls: "full" }));
    if (h.pet) portrait.appendChild(A.petSprite(h.pet, 4));
    const isMine = A.mine().includes(h.id);
    const followBtn = el("button", { class: "btn " + (isMine ? "primary" : ""), onclick: () => { const on = A.toggleMine(h.id); followBtn.textContent = on ? "★ Yours" : "☆ This is mine"; followBtn.classList.toggle("primary", on); A.toast(on ? `${h.name} pinned to your Crier` : "Unpinned"); } }, isMine ? "★ Yours" : "☆ This is mine");
    const shareBtn = el("button", { class: "btn", onclick: () => A.copy(`${shareBlurb(h)}\n${A.shareUrl("#/hero/" + h.id)}`, "Link & blurb copied. Go brag.") }, "Share");
    const status = h.alive ? (h.jail ? `In the cells in ${A.nodeName(h.loc, true)}` : h.travel ? `On the road from ${A.nodeName(h.travel.from, true)} to ${A.nodeName(h.travel.to, true)}` : ((h.doing || "").includes(A.nodeName(h.loc)) ? cap(h.doing) : `${cap(h.doing || "around")} · in ${A.nodeName(h.loc, true)}`)) :
      `Died in season ${h.died_season}, day ${h.died_sday || "?"}, ${h.death_cause} in ${A.nodeName(h.death_place, true)}${h.buried ? ". Buried in " + A.nodeName(h.buried) : h.memorial_at ? ". No grave; remembered in " + A.nodeName(h.memorial_at) : ""}.`;
    head.appendChild(el("div", { class: "hero-head" }, portrait,
      el("div", { class: "hero-title" },
        el("h1", null, h.name),
        h.epithet ? el("div", { class: "epi" }, h.epithet) : null,
        el("div", { class: "small" }, `Level ${h.level} `, el("span", { class: "has-tip", title: (S.classes[h.cls] || {}).desc || "" }, h.title), h.party ? [" of ", A.partyLink(h.party)] : " · solo"),
        el("div", { class: "small muted" }, h.npc ? "A league hero" : `${h.owner}'s hero`)),
      el("div", { class: "hero-details" },
        (S.classes[h.cls] || {}).desc ? el("div", { class: "tiny muted", style: { fontStyle: "italic" } }, `${h.title}: ${S.classes[h.cls].desc}${(S.classes[h.cls].tier || 0) > 0 ? " (an evolved class, earned by how " + h.name + " fights)" : ""}`) : null,
        keystoneBadges(h),
        wearingStrip(h),
        classStrip(h),
        personaStrip(h),
        h.faction && (S.factions || {})[h.faction] ? el("div", { class: "tiny" }, `${S.factions[h.faction].icon || ""} ${S.factions[h.faction].ranks[h.frank || 0]} of ${S.factions[h.faction].name}`,
          el("span", { class: "dim" }, ` · rank ${(h.frank || 0) + 1} of ${S.factions[h.faction].ranks.length}`)) : null,
        el("div", { class: "small muted" }, `Joined season ${h.joined || "next"}`,
          h.home ? ` · owns a ${h.home.kind} in ${A.nodeName(h.home.town, true)}` : ""),
        el("p", { style: { marginTop: "8px", marginBottom: "2px" } }, el("span", { class: h.alive ? "green" : "red" }, h.alive ? "● " : "✝ "), status),
        h.why ? el("p", { class: "small muted", style: { fontStyle: "italic" } }, `Why: ${h.why}.`) : null,
        goalLine(h.goal, h.party),
        ...(h.vows || []).map((v) => vowLine(v, h.party)),
        h.alive ? el("div", { class: "row wrap small", style: { gap: "14px" } },
          el("div", { style: { minWidth: "150px" } }, `HP ${h.hp}/${h.maxhp}`, A.bar(h.hp, h.maxhp)),
          el("div", { style: { minWidth: "150px" } }, `XP ${h.xp}/${h.xp_next} (to level ${h.level + 1})`, A.bar(h.xp, h.xp_next, "gold")),
          el("div", { style: { minWidth: "150px" } }, `Stress ${h.stress} (${h.stress >= 70 ? "frayed" : h.stress >= 40 ? "tense" : "calm"})`, A.bar(h.stress, 100, "red")),
          el("div", null, el("b", { class: "gold" }, String(h.gold)), " silver"),
          h.joined ? el("div", { style: { minWidth: "150px" } }, el("b", { class: "gold" }, h.renown), " renown",
            el("div", { class: "tiny dim" }, renownCaption(h)),
            (h.renown_parts || []).length ? el("div", { class: "tiny" }, "Renown from: " + h.renown_parts.slice(0, 4).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join(" · ")) : null) : null,
          h.injuries.length ? el("div", { class: "red" }, "Hurt: " + h.injuries.join(", ")) : null) : null,
        el("div", { class: "row wrap", style: { marginTop: "10px" } }, followBtn, shareBtn))));
    v.appendChild(head);
    const night = h.alive && h.tonight && window.Night ? Night.scene(h, L) : null;
    if (night) v.appendChild(panel(null, night));

    const tabs = el("div", { class: "tabs" });
    const body = el("div");
    const T = [["story", "Story"], ["diary", "Diary"], ["character", "Character"], ["people", "People"], ["record", "Record"]];
    if (!T.some((t) => t[0] === tab)) tab = "story";
    for (const [k, label] of T) tabs.appendChild(el("button", { class: k === tab ? "on" : "", onclick: () => history.replaceState(null, "", `#/hero/${h.id}/${k}`) || show(k) }, label));
    v.append(tabs, body);
    function show(k) {
      for (const b of tabs.children) b.classList.toggle("on", b.textContent === T.find((t) => t[0] === k)[1]);
      body.innerHTML = "";
      ({ story: (b, x) => { if (x.alive === false) b.appendChild(dirgePanel(x)); storyTab(b, x); }, character: (b, x) => { charTab(b, x); b.appendChild(heroExtras(x)); }, diary: diaryTab, people: (b, x) => { peopleTab(b, x); b.appendChild(repPanel(x)); b.appendChild(factionRows(x)); }, record: recordTab })[k](body, h);
    }
    show(tab);
  }

  function keystoneBadges(h) {
    const keys = (h.skills || []).filter((s) => s.keystone).sort((a, b) => a.keystone - b.keystone);
    if (!keys.length) return null;
    return el("div", { class: "row wrap", style: { gap: "4px", margin: "3px 0" } }, keys.map((s) => skillTip(el("span", { class: "ks-badge" }, "✦ ", s.name, el("span", { class: "lv" }, ` · level ${s.keystone}`)), s)));
  }
  // the weapon icon knows whether the daggers are a pair or one blade beside a shield
  function kitIcon(x, h, scale) {
    const it = x.slot === "weapon" && h.kit && h.kit.weapon ? Object.assign({}, x, { two: h.kit.weapon.two }) : x;
    return Art.gearIcon(it, h.look).toCanvas(scale);
  }
  // worn items as a row of icons, plus anything gained in the last week, so phones see the kit without scrolling
  function wearingStrip(h) {
    const items = h.kit_items || [];
    if (!h.kit || !items.length) return null;
    const today = lastDay(), fresh = items.filter((x) => x.day != null && x.day > today - 7).sort((a, b) => b.day - a.day);
    const icons = el("a", { class: "wearing", href: `#/hero/${h.id}/character`, title: "See the kit" },
      items.map((x) => { const cv = kitIcon(x, h, 2); cv.title = x.name; if (x.magic) cv.className = "magic"; return cv; }));
    return el("div", { class: "wearing-strip" }, icons,
      fresh.length ? el("div", { class: "tiny" }, el("b", null, `New since ${A.when(fresh[fresh.length - 1].day, true)}: `), fresh.map((x) => x.name + (x.plus ? ` (${x.plus})` : "")).join(", ")) : null);
  }
  const NOT_THEIR_STORY = new Set(["weather", "sale", "map_sale", "levelups", "delve", "meet", "edict", "world", "hyper", "omen", "gossip", "town", "drift", "watch", "raid"]);
  function bestStory(h) {
    const all = (h.events || []).map((x) => (typeof x === "string" ? events[x] : x)).filter(Boolean);
    const theirs = all.filter((e) => !NOT_THEIR_STORY.has(e.kind) && e.text.includes(h.name) && ((e.heroes || [])[0] === h.id || e.text.startsWith(h.name)));
    if (!theirs.length) return null;
    const newest = Math.max(...theirs.map((e) => e.day));
    const score = (e) => e.imp * 10 - (newest - e.day) * 1.5;
    // a big story from last week beats a small one from today; nothing older than a fortnight
    return theirs.filter((e) => e.day >= newest - 14).sort((a, b) => score(b) - score(a) || b.day - a.day)[0];
  }
  function shareBlurb(h) {
    const ep = L.annals && (L.annals.epitaphs || {})[h.id];
    if (!h.alive) return `RIP ${h.name}, my level ${h.level} ${h.title}. ${cap(h.death_cause || "")}.${ep ? " " + ep : ""}`;
    const best = bestStory(h);
    return `My hero ${h.name} (level ${h.level} ${h.title}${h.party ? ", " + (parties[h.party] || {}).name : ""}): ${best ? best.text : cap(h.doing || "out in the world") + "."}`;
  }

  const GOAL_TIP = "Every party, and every hero on their own, picks one goal a season: a boss to bring down, a purse to fill, places to see. The season's ceremony counts who got there.";
  const VOW_TIP = "A promise sworn after a big moment: to repay a rescue, to get even for a robbery, never to pay a toll. Kept or broken, the Crier remembers.";
  function goalLine(g, inParty) {
    if (!g) return null;
    return el("div", { class: "goal-line" + (g.done ? " met" : g.missed ? " missed" : "") },
      tip(el("b", null, (g.done ? "✔ " : g.missed ? "○ " : "") + (g.party ? "Party goal: " : "Season goal: ")), GOAL_TIP), g.text,
      el("span", { class: "small muted" }, ` · ${g.done ? "done" : g.missed ? "not this season" + (/\d/.test(g.progress) ? ` (${g.progress})` : "") : g.progress}`), g.party && inParty !== undefined ? [" · ", A.partyLink(g.party)] : null);
  }
  function vowLine(v, inParty) {
    const state = v.state === "open" ? v.progress : v.through ? "kept through the age" : `${v.state} on ${A.when(v.ended, true)}`;
    return el("div", { class: "goal-line vow" + (v.state === "kept" ? " met" : v.state === "broken" ? " missed" : "") },
      tip(el("b", null, (v.state === "kept" ? "✔ " : v.state === "broken" ? "○ " : "") + "Vow: "), VOW_TIP), v.text,
      el("span", { class: "small muted" }, ` · sworn on ${A.when(v.day, true)} · ${state}`), v.party && inParty !== undefined ? [" · ", A.partyLink(v.party)] : null);
  }
  function threadsPanel(h) {
    if (!(h.threads || []).length) return null;
    const p = panel("Threads", el("p", { class: "small dim" }, "How one thing led to another."));
    for (const ch of h.threads) p.appendChild(el("ol", { class: "thread" }, ch.map((e, i) => el("li", { class: i === ch.length - 1 ? "now" : "" },
      el("span", { class: "when" }, A.when(e.day)), el("div", null, A.richText(e.text, e.heroes, e.parties),
        e.fight ? [" ", el("a", { class: "watch", href: `#/fight/${e.fight}` }, "▶ watch")] : null)))));
    return p;
  }
  function lettersPanel(h) {
    const ls = (h.letters || []).slice().reverse();
    if (!ls.length) return null;
    const p = panel("Letters home", el("p", { class: "small dim" }, `${h.name} writes once a week.`));
    p.appendChild(el("blockquote", { class: "letter" }, el("div", { class: "tiny dim" }, A.when(ls[0].day)), ls[0].text));
    if (ls.length > 1) p.appendChild(el("details", null, el("summary", { class: "small" }, `Earlier letters (${ls.length - 1})`),
      ...ls.slice(1).map((l) => el("blockquote", { class: "letter" }, el("div", { class: "tiny dim" }, A.when(l.day)), l.text))));
    return p;
  }
  function storyTab(b, h) {
    const lp = lettersPanel(h);
    if (lp) b.appendChild(lp);
    const th = threadsPanel(h);
    if (th) b.appendChild(th);
    const list = h.events.map((x) => (typeof x === "string" ? events[x] : x)).filter(Boolean).sort(byDayDesc);
    b.appendChild(panel(`${h.name}'s story`, A.feed(list, { dayHeaders: true, empty: "Their story hasn't started yet." })));
  }
  function diaryTab(b, h) {
    const ul = el("ul", { class: "diary" });
    let lastD = null;
    for (const [d, t] of h.diary.slice().reverse()) {
      if (d !== lastD) { ul.appendChild(el("li", { class: "daydiv", style: { listStyle: "none", marginLeft: "-18px" } }, A.when(d))); lastD = d; }
      ul.appendChild(el("li", null, cap(t)));
    }
    b.appendChild(panel("Diary", el("p", { class: "small dim" }, "The small stuff: shifts worked, dice lost, conversations had."), ul));
  }
  function charTab(b, h) {
    if (h.alive) b.appendChild(fightCard(h));
    if (h.kit) b.appendChild(kitPanel(h));
    const g = el("div", { class: "grid2" });
    const left = el("div"), right = el("div");
    g.append(left, right);
    b.appendChild(g);
    const sg = el("div", { class: "statgrid" });
    for (const s of ["might", "agility", "mind", "grit", "heart"]) {
      const d = h.eff[s] - h.stats[s];
      sg.appendChild(el("div", null, el("b", null, h.eff[s]), el("span", null, s), d ? el("div", { class: d < 0 ? "tiny red" : "tiny green" }, (d > 0 ? "+" : "") + d) : null));
    }
    left.appendChild(panel("Stats", sg));
    const tp = panel("Personality");
    for (const t of ["boldness", "risk"]) tp.appendChild(traitRow(t, h.traits[t], true));
    tp.appendChild(el("div", { style: { height: "6px" } }));
    for (const t of ["greed", "honor", "sociability", "curiosity", "temper", "loyalty"]) tp.appendChild(traitRow(t, h.traits[t]));
    tp.appendChild(el("p", { class: "small muted", style: { marginTop: "8px" } },
      h.fears.length ? `Afraid of ${h.fears.join(" and ")}. ` : "Afraid of nothing (allegedly). ",
      `Orders ${h.food === "milk" ? "a glass of milk" : h.food === "ale" ? "a big ale" : h.food === "wine" ? "red wine" : h.food === "mystery stew" ? "the mystery stew" : "whatever's cheapest"}.`,
      h.pet ? ` Travels with ${h.pet.name} the ${h.pet.kind}.` : "", h.keepsake ? ` Carries ${h.keepsake}.` : ""));
    left.appendChild(tp);
    if (h.ambition || h.ambitions_done.length) left.appendChild(panel("Ambition",
      h.ambition ? el("p", null, `${h.name} wants ${h.ambition}.`) : null,
      h.ambitions_done.length ? el("p", { class: "small green" }, "Achieved: " + h.ambitions_done.map((x) => x.replace(/^to /, "")).join("; ")) : null));
    left.appendChild(classTree(h));
    right.appendChild(skillsPanel(h));
    right.appendChild(affinityPanel(h));
    right.appendChild(gearPanel(h));
  }
  function traitRow(t, v, big) {
    return el("div", { class: "trait" + (big ? " big" : "") }, el("span", { class: big ? "" : "small" }, TRAIT_LABEL[t]),
      el("div", { class: "tbar" }, el("i", { style: { left: ((v + 1) / 2) * 100 + "%" } })), el("span", { class: "word" }, traitWord(t, v)));
  }
  function affinityPanel(h) {
    const top = Object.entries(h.aff).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const max = top.length ? top[0][1] : 1;
    const p = panel("What shapes them");
    if (h.voice) p.appendChild(el("p", { class: "small" }, "Talks: ", el("b", null, voiceWord(h.voice)), el("span", { class: "dim" }, " (from the quiz, their traits and their class)")));
    p.appendChild(el("p", { class: "small dim" }, "Every deed feeds these. They decide which skills come next and what this hero becomes."));
    for (const [k, val] of top) p.appendChild(el("div", { class: "trait" }, el("span", { class: "small" }, cap(k)), A.bar(val, max, "blue"), el("span", { class: "word small" }, val.toFixed(1))));
    const nxt = nextClass(h);
    if (nxt) p.appendChild(el("p", { class: "small", style: { marginTop: "8px" } }, `At level ${nxt.level}, the smart money says: `, el("b", { class: "gold" }, nxt.name),
      nxt.alt ? el("span", { class: "dim" }, ` (or ${nxt.alt})`) : null));
    return p;
  }
  function nextClass(h) { return h.next_class || null; }
  // the paper doll: what the hero wears, slot by slot, with the story of each piece
  const KIT_SLOTS = { head: "Head", neck: "Neck", armor: "Armor", ring1: "Ring", back: "Back", offhand: "Off-hand", pocket: "Pocket", ring2: "Ring", weapon: "Weapon" };
  const QUALITY = ["plain", "decent", "fine", "masterwork"], QUALITY5 = ["", "battered", "plain", "good", "fine", "masterwork"];
  function qualityWord(it) {
    if (it.tier == null || it.slot === "pocket" || /^ring|neck/.test(it.slot)) return null;
    return it.slot === "weapon" || it.slot === "armor" ? QUALITY5[it.tier] : QUALITY[it.tier];
  }
  function historyList(hist) {
    if (!(hist || []).length) return null;
    return el("ol", { class: "kit-hist" }, hist.slice(-8).map((x) => el("li", null, el("span", { class: "when" }, A.when(x.day)), " ", A.richText(cap(x.text), Object.keys(heroes), []))));
  }
  function kitPanel(h) {
    const items = h.kit_items || [], rings = items.filter((x) => /^ring/.test(x.slot));
    const bySlot = (k) => (k === "ring1" ? rings[0] : k === "ring2" ? rings[1] : items.find((x) => x.slot === k)) || null;
    const info = el("div", { class: "kit-info" });
    const tiles = [];
    const show = (it, k, tile) => {
      tiles.forEach((t) => t.classList.toggle("on", t === tile));
      info.innerHTML = "";
      if (!it) {
        const two = k === "offhand" && h.kit.weapon && h.kit.weapon.two;
        info.append(el("div", { class: "nm dim" }, KIT_SLOTS[k] || "Pocket"), el("p", { class: "small muted" }, two ? `Both hands are on the ${(bySlot("weapon") || {}).name || "weapon"}.` : "Nothing here yet."));
        return;
      }
      const sub = [KIT_SLOTS[k] || cap(it.slot || ""), it.magic ? (it.enchant ? `enchanted: ${it.enchant}` : "magic") : qualityWord(it)].filter(Boolean).join(" · ");
      info.append(...[el("div", { class: "nm" + (it.magic ? " magic" : ""), style: it.glow ? "--glow:" + it.glow : null }, it.name),
        el("div", { class: "tiny dim" }, sub),
        it.plus ? el("div", { class: "small plus" }, it.plus, el("span", { class: "dim" }, it.slot === "weapon" ? " to every blow" : " against every blow")) : null,
        it.fx ? el("div", { class: "small fx" }, it.fx) : null,
        it.desc ? el("p", { class: "small" }, it.desc.replace(/\{n\}/g, h.name)) : null,
        (it.history || []).length ? historyList(it.history) : it.story ? el("p", { class: "tiny muted story" }, cap(it.story) + (/[.!?]$/.test(it.story) ? "" : ".")) : null].filter(Boolean));
    };
    const tile = (k) => {
      const it = bySlot(k), cv = it ? kitIcon(it, h, 3) : null;
      const t = el("button", { class: "kit-slot" + (it ? "" : " empty") + (it && it.magic ? " magic" : ""), type: "button", title: it ? it.name + (it.plus ? ` (${it.plus})` : "") : KIT_SLOTS[k],
        style: it && it.glow ? "--glow:" + it.glow : null }, cv || el("span", { class: "ph" }), el("span", { class: "lbl" }, KIT_SLOTS[k]));
      const go = () => show(it, k, t);
      t.addEventListener("mouseenter", go); t.addEventListener("focus", go); t.addEventListener("click", go);
      tiles.push(t);
      return t;
    };
    const doll = el("div", { class: "kit-doll" },
      el("div", { class: "kit-col" }, ["head", "neck", "armor", "ring1"].map(tile)),
      el("div", { class: "kit-mid" }, A.heroSprite(h, 4, { cls: "kit-hero" }), tile("weapon")),
      el("div", { class: "kit-col" }, ["back", "offhand", "pocket", "ring2"].map(tile)));
    const p = panel("Kit", el("div", { class: "kit" }, doll, info));
    const first = items.find((x) => x.magic) || bySlot("weapon");
    const firstK = first ? Object.keys(KIT_SLOTS).find((k) => bySlot(k) === first) : "weapon";
    show(first, firstK, tiles[["head", "neck", "armor", "ring1", "weapon", "back", "offhand", "pocket", "ring2"].indexOf(firstK)]);
    const extra = (h.curios || []).map((c) => ({ it: Object.assign({ slot: "curio" }, c), k: "curio" }))
      .concat((h.relics || []).map((r) => ({ relic: r })));
    if (extra.length) {
      const row = el("div", { class: "kit-curios" });
      for (const x of extra) {
        if (x.relic) {
          const hidden = x.relic.identified === false;
          row.appendChild(el("span", { class: "it" }, A.itemSprite("relic", 2), hidden ? "an unidentified relic" : x.relic.name));
          continue;
        }
        const c = x.it, b = el("button", { class: "it curio", type: "button" }, Art.gearIcon(Object.assign({ slot: "pocket" }, c), h.look).toCanvas(2), c.name);
        const go = () => {
          tiles.forEach((t) => t.classList.remove("on")); info.innerHTML = ""; info.append(el("div", { class: "nm" }, c.name), el("div", { class: "tiny dim" }, "Curio, in the pack"));
          if (c.desc) info.appendChild(el("p", { class: "small" }, c.desc.replace(/\{n\}/g, h.name)));
          const hl = historyList(c.history);
          if (hl) info.appendChild(hl); else if (c.story) info.appendChild(el("p", { class: "tiny muted story" }, cap(c.story) + (/[.!?]$/.test(c.story) ? "" : ".")));
        };
        b.addEventListener("mouseenter", go); b.addEventListener("focus", go); b.addEventListener("click", go);
        row.appendChild(b);
      }
      p.append(el("h4", { style: { marginTop: "10px" } }, "Also carrying"), row);
    }
    return p;
  }
  function gearPanel(h) {
    const p = panel(h.kit ? "Pack" : "Gear & pack");
    if (!h.kit) p.appendChild(el("p", null, el("b", null, h.gear.weapon.name), el("span", { class: "dim small" }, ` (tier ${h.gear.weapon.tier} ${h.gear.weapon.family.replace("_", " ")})`), " · ",
      el("b", null, h.gear.armor.name), el("span", { class: "dim small" }, ` (tier ${h.gear.armor.tier})`)));
    const inv = el("div", { class: "inv" });
    inv.appendChild(el("span", { class: "it" }, A.itemSprite("gold", 2), `${h.gold} silver`));
    const one = { "Fangs & Claws": "fang", "Remains": "set of remains", "Stolen Goods": "bag of stolen goods" };
    const goodName = (g, q) => { const n = S.goods[g].name; return (q === 1 ? one[n] || n.replace(/s$/, "") : n).toLowerCase(); };
    for (const [g, q] of Object.entries(h.inv)) inv.appendChild(el("span", { class: "it" }, A.itemSprite(g, 2), `${q} ${goodName(g, q)}`));
    if (!h.kit) for (const r of h.relics) inv.appendChild(el("span", { class: "it" }, A.itemSprite("relic", 2), r.identified === false ? "an unidentified relic" : r.name));
    for (const rid of h.remains_of) inv.appendChild(el("span", { class: "it red" }, A.itemSprite("remains", 2), `the remains of ${(heroes[rid] || {}).name || "someone"}`));
    p.appendChild(inv);
    if ((h.maps || []).length) {
      p.appendChild(el("p", { class: "small muted", style: { marginTop: "8px" } }, "Maps in the pack"));
      p.appendChild(el("div", { class: "small" }, h.maps.map((m, i) => [i ? " · " : "", el("a", { href: `#/map/${m.dungeon}` }, S.dungeons[m.dungeon].name),
        ` (${m.pct}% mapped${m.worked ? `, ${m.worked}% opened up by ${h.name}` : ""})`])));
    }
    return p;
  }
  function peopleTab(b, h) {
    const p = panel("Relationships");
    const symbols = { sweethearts: ["♥ sweethearts", "green"], "best friends": ["★ best friends", "green"], friends: ["☺ friends", "green"], rivals: ["⚔ rivals", "red"], nemeses: ["☠ nemeses", "red"] };
    if (!h.rels.length) p.appendChild(el("p", { class: "empty" }, `${h.name} hasn't really gotten to know anyone yet.`));
    for (const r of h.rels) {
      const o = heroes[r.hero];
      if (!o) continue;
      const [lab, col] = symbols[r.bond] || [r.score > 0 ? "friendly" : "cool", r.score > 0 ? "" : "dim"];
      p.appendChild(el("div", { class: "row", style: { marginBottom: "6px" } }, A.heroPortrait(o, 1),
        el("div", { style: { flex: 1 } }, A.heroLink(o.id), el("span", { class: "small " + col }, "  " + lab), r.mentor ? el("span", { class: "small gold" }, r.mentor === h.id ? " · mentors them" : " · their mentor") : null,
          el("div", { style: { maxWidth: "240px" } }, el("div", { class: "trait", style: { gridTemplateColumns: "1fr" } }, el("div", { class: "tbar" }, el("i", { style: { left: ((r.score + 100) / 200) * 100 + "%" } })))))));
    }
    b.appendChild(p);
    if (h.debts.length) {
      const d = panel("Debts");
      for (const x of h.debts) d.appendChild(el("p", null, x.owes ? ["Owes ", A.heroLink(x.owes), ` ${x.amount} silver.`] : [A.heroLink(x.owed_by), ` owes them ${x.amount} silver.`]));
      b.appendChild(d);
    }
    const regs = Object.entries(h.regular || {}).sort((a, b) => b[1] - a[1]);
    const jobs = Object.entries(h.jobs || {}).sort((a, b) => b[1] - a[1]);
    const t = panel("Around town");
    if (regs.length) t.appendChild(el("p", null, "Regular at ", regs.slice(0, 3).map(([tid, n], i) => [i ? ", " : "", `${S.towns[tid].tavern} (${n} nights)`])));
    if (jobs.length) t.appendChild(el("p", null, "Side jobs: ", jobs.slice(0, 4).map(([j, n], i) => `${i ? ", " : ""}${j.replace("_", " ")} ×${n}`).join("")));
    if (!regs.length && !jobs.length) t.appendChild(el("p", { class: "empty" }, "No local ties yet."));
    b.appendChild(t);
  }
  function recordTab(b, h) {
    const keys = [["kills", "Kills"], ["bosses", "Bosses slain"], ["fights", "Fights"], ["wins", "Wins"], ["fled", "Retreats"], ["downed", "Times downed"], ["floors", "Dungeon floors"],
      ["delves", "Delves"], ["gold_earned", "Silver earned"], ["loot_sold", "Loot sold"], ["days_worked", "Days worked"], ["travel_days", "Days on the road"], ["injuries", "Injuries"],
      ["gambled", "Silver gambled"], ["pvp_wins", "Hero fights won"], ["pvp_losses", "Hero fights lost"], ["robberies", "Robberies committed"], ["robbed", "Silver lost to robbers"], ["corpses_sold", "Bodies sold"], ["levels", "Levels gained"]];
    const t = el("table");
    t.appendChild(el("tr", null, el("th", null, ""), el("th", { class: "num" }, h.alive ? "This season" : "Final season"), el("th", { class: "num" }, "Career")));
    for (const [k, lab] of keys) t.appendChild(el("tr", null, el("td", null, lab), el("td", { class: "num" }, h.season[k] || 0), el("td", { class: "num" }, (h.career[k] || 0) + (k in h.career ? 0 : 0))));
    b.appendChild(panel("Record", t));
    if (h.past.length) {
      const p = panel("Past seasons");
      for (const s of h.past) p.appendChild(el("p", null, `Season ${s.season}: level ${s.level} ${A.clsName(s.cls)}, ${s.renown} renown, ${plural(s.stats.kills, "kill")}, ${s.stats.gold_earned} silver earned.`));
      b.appendChild(p);
    }
  }

  // ================= PARTIES =================
  A.route(/^\/parties$/, (v) => {
    v.appendChild(el("h1", null, "Parties"));
    const live = L.parties.filter((p) => !p.disbanded).sort((a, b) => b.renown - a.renown);
    const dead = L.parties.filter((p) => p.disbanded).sort((a, b) => b.disbanded - a.disbanded);
    const grid = el("div", { class: "cols", style: { gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" } });
    for (const p of live) grid.appendChild(partyCard(p));
    if (!live.length) grid.appendChild(el("p", { class: "empty" }, "No parties right now. Heroes form parties when they click at a tavern."));
    v.appendChild(grid);
    if (dead.length) {
      v.appendChild(el("h2", { style: { marginTop: "20px" } }, "Disbanded"));
      const g2 = el("div", { class: "cols", style: { gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" } });
      for (const p of dead) g2.appendChild(partyCard(p));
      v.appendChild(g2);
    }
  });
  function dangerWord(v) {
    v = v == null ? 1 : v;
    return v < 0.6 ? "thinned out" : v < 0.85 ? "recovering" : v < 1.05 ? "normal" : "teeming";
  }
  function moveMark(r, week) {
    if (r.rank == null || week === 1) return el("span");
    return r.prev == null ? el("span", { class: "dim" }, "new") : r.prev > r.rank ? el("span", { class: "green" }, `▲${r.prev - r.rank}`) : r.prev < r.rank ? el("span", { class: "red" }, `▼${r.rank - r.prev}`) : el("span", { class: "dim" }, "–");
  }
  function lastNews(p) {
    const e = L.events.filter((x) => (x.parties || []).includes(p.id) && x.imp >= 2).sort(byDayDesc)[0];
    return e ? el("p", { class: "small", style: { marginTop: "6px" } }, el("span", { class: "dim" }, `${A.when(e.day)}: `), e.text) : null;
  }
  function moraleWord(m) { return m >= 70 ? "happy" : m >= 40 ? "steady" : m >= 20 ? "grumbling" : "about to split"; }
  function moraleBar(p) {
    return el("div", { class: "has-tip", title: "The party's mood, 0 to 100. Wins and silver raise it; losses, arguments and skimming lower it. Below 20, members start leaving.",
      style: { marginTop: "6px" } },
      el("div", { class: "small", style: { display: "flex", justifyContent: "space-between" } }, el("span", null, "Morale"),
        el("span", { class: p.morale < 30 ? "red" : "muted" }, `${p.morale}/100 · ${moraleWord(p.morale)}`)),
      A.bar(p.morale, 100, p.morale < 30 ? "red" : "gold"));
  }
  // a parchment card that follows a skill badge: what it does, whose it is, how often it's been used
  let tipBox = null;
  function skillTip(node, s, owner) {
    // DOM append prints a null as the word "null", so the optional lines are filtered out first
    return attachTip(node, (box) => box.append(...[el("div", { class: "nm" }, s.keystone ? "✦ " : "", s.name, s.rank > 1 ? ` ${"I".repeat(s.rank)}` : ""),
      owner ? el("div", { class: "tiny gold" }, owner) : null,
      el("div", { class: "small" }, s.does || s.desc), s.does ? el("div", { class: "tiny dim" }, s.desc) : null,
      el("div", { class: "tiny dim" }, s.keystone ? `A keystone: a one-of-a-kind gift every hero earns at levels 10 and 20. Only one living hero holds each. This one came at level ${s.keystone}.`
        : [s.school ? s.school.replace(/_/g, " ") : "", s.type === "world" ? "out of combat" : s.uses ? `used ${plural(s.uses, "time")}` : "not used yet"].filter(Boolean).join(" — "))].filter(Boolean)));
  }
  function tip(node, text, title) {
    return attachTip(node, (box) => box.append(...[title ? el("div", { class: "nm" }, title) : null, el("div", { class: "small" }, text)].filter(Boolean)));
  }
  function attachTip(node, fill) {
    const show = () => {
      if (!tipBox) { tipBox = el("div", { class: "skilltip", role: "tooltip" }); document.body.appendChild(tipBox); }
      tipBox.innerHTML = "";
      fill(tipBox);
      const r = node.getBoundingClientRect();
      tipBox.style.display = "block";
      const w = tipBox.offsetWidth, hgt = tipBox.offsetHeight;
      tipBox.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
      tipBox.style.top = (r.top - hgt - 8 > 8 ? r.top - hgt - 8 : r.bottom + 8) + window.scrollY + "px";
    };
    const hide = () => { if (tipBox) tipBox.style.display = "none"; };
    node.classList.add("tipped");
    node.tabIndex = 0;
    node.addEventListener("mouseenter", show);
    node.addEventListener("focus", show);
    node.addEventListener("mouseleave", hide);
    node.addEventListener("blur", hide);
    node.addEventListener("click", (e) => { e.stopPropagation(); show(); });
    return node;
  }
  window.addEventListener("hashchange", () => { if (tipBox) tipBox.style.display = "none"; });
  document.addEventListener("click", () => { if (tipBox) tipBox.style.display = "none"; });
  function partyTags(p) {
    const t = p.tactics;
    if (!t || p.disbanded) return null;
    const temper = ["bold", "cautious", "patient", "reckless", "silver-hungry"];
    const persona = [cap(p.disposition), ...strongTraits(t.traits, 3)].filter((w, i, a) => a.indexOf(w) === i);
    const fight = [t.mix, ...t.style.filter((s) => !temper.includes(s))];
    return el("div", null,
      el("div", { class: "class-strip persona" }, ...persona.map((w) => el("span", { class: "pill soft" }, w))),
      el("div", { class: "class-strip" }, ...fight.map((w) => el("span", { class: "pill" }, w))));
  }
  function tacticsPanel(p) {
    const t = p.tactics;
    if (!t) return null;
    const pn = panel("How they fight");
    const who = (id) => heroes[id];
    const fig = (id) => el("a", { class: "fig", href: `#/hero/${id}` }, A.heroSprite(who(id), 2), el("div", { class: "tiny" }, who(id).name),
      el("div", { class: "tiny gold" }, ((p.roles || {})[id] || "").replace("Leader · ", "")), classIcon(basePath(who(id).cls), 1));
    const form = el("div", { class: "formation" },
      el("div", { class: "rank" }, el("div", { class: "tiny dim lbl" }, "BACK ROW"), ...(t.back.some(who) ? t.back.filter(who).map(fig) : [el("div", { class: "small dim nobody" }, "nobody")])),
      el("div", { class: "rank" }, el("div", { class: "tiny dim lbl" }, "FRONT ROW"), ...(t.front.some(who) ? t.front.filter(who).map(fig) : [el("div", { class: "small dim nobody" }, "nobody")])),
      el("div", { class: "foe" }, window.Art && Art.dummyGrid ? Object.assign(Art.dummyGrid().toCanvas(1), { className: "dummy" }) : null, el("div", { class: "tiny dim" }, "the enemy")));
    pn.appendChild(form);
    if (t.plan) pn.appendChild(el("p", { style: { marginTop: "8px" } }, el("b", null, "The plan: "), t.plan));
    if (t.notes.length) pn.appendChild(el("ul", { class: "small tac-notes" }, ...t.notes.map((n) => el("li", null, n))));
    const g = el("div", { class: "grid2 even", style: { marginTop: "10px" } });
    const share = el("div");
    const cols = [["dmg", "Damage dealt", "red"], ["healed", "Healing", "green"], ["taken", "Damage taken", "blue"]];
    share.appendChild(el("div", { class: "tiny gold skill-group" }, "Who does what this season"));
    for (const [k, label, col] of cols) {
      const tot = t.share.reduce((a, s) => a + s[k], 0);
      if (!tot && k === "taken" && t.share.some((s) => s.dmg)) { share.append(el("div", { class: "tiny dim", style: { marginTop: "6px" } }, label), el("div", { class: "small dim", style: { fontStyle: "italic" } }, "Not a scratch so far.")); continue; }
      if (!tot) continue;
      share.appendChild(el("div", { class: "tiny dim", style: { marginTop: "6px" } }, label));
      for (const s of t.share.slice().sort((a, b) => b[k] - a[k])) if (who(s.hero) && s[k]) share.appendChild(el("div", { class: "trait" }, el("span", { class: "small" }, who(s.hero).name), A.bar(s[k], tot, col), el("span", { class: "word small" }, `${Math.round((100 * s[k]) / tot)}%`)));
    }
    if (!t.share.some((s) => s.dmg || s.healed || s.taken)) share.appendChild(el("p", { class: "empty" }, "No fights together yet."));
    if (t.ground) share.appendChild(el("p", { class: "small", style: { marginTop: "8px" } }, "Home ground: ", el("b", null, t.ground.name), el("span", { class: "dim" }, ` (${plural(t.ground.fights, "fight")})`)));
    const sk = el("div", { class: "together" });
    sk.appendChild(el("div", { class: "tiny gold skill-group" }, "What they can do, together"));
    for (const grp of t.skills) {
      if (grp.label === "On the road" || grp.label === "Always on") continue;
      sk.appendChild(el("div", { class: "tiny dim", style: { marginTop: "6px" } }, grp.label));
      sk.appendChild(el("div", { class: "row wrap", style: { gap: "4px" } }, ...grp.skills.map((s) => skillTip(el("span", { class: "pill" + (s.uses ? " gold" : "") },
        `${s.name}`, el("span", { class: "dim" }, ` · ${who(s.hero) ? who(s.hero).name : ""}${s.uses ? " ×" + s.uses : ""}`)), s, who(s.hero) ? `${who(s.hero).name}'s skill` : ""))));
    }
    const road = t.skills.filter((g) => g.label === "On the road" || g.label === "Always on").flatMap((g) => g.skills);
    if (road.length) sk.appendChild(el("p", { class: "tiny dim", style: { marginTop: "6px" } }, "Also: ", ...road.map((s, i) => [i ? ", " : "", skillTip(el("span", null, `${s.name} (${who(s.hero) ? who(s.hero).name : ""})`), s, who(s.hero) ? `${who(s.hero).name}'s skill` : "")])));
    g.append(share, sk);
    pn.appendChild(g);
    return pn;
  }
  function partyCard(p) {
    const ms = el("div", { class: "row", style: { gap: "0" } });
    for (const m of (p.disbanded ? p.members : p.members)) if (heroes[m]) ms.appendChild(A.heroPortrait(heroes[m], 1, { cls: "grp big" }));
    return el("a", { class: "panel", href: `#/party/${p.id}`, style: { display: "block", color: "inherit", opacity: p.disbanded ? 0.65 : 1 } },
      el("div", { class: "row" }, A.bannerSprite(p.banner, 3), el("div", null, el("h3", { style: { marginBottom: "2px" } }, p.name),
        p.motto ? el("div", { class: "small motto" }, `“${p.motto}”`) : null,
        el("div", { class: "small muted" }, p.disbanded ? `Disbanded on ${A.when(p.disbanded, true)}` : [el("span", { class: "has-tip", title: S.dispositions[p.disposition] || "" }, cap(p.disposition)),
          ` · ${p.renown} renown`]),
        el("div", { class: "small dim" }, p.disbanded ? "" : cap(p.doing || "in " + p.loc_name)))),
      ms, p.disbanded ? null : moraleBar(p), lastNews(p));
  }
  A.route(/^\/party\/(\w+)$/, (v, id) => A.load(`party/${id}`).then((p) => {
    const head = panel(null);
    head.appendChild(el("div", { class: "row wrap party-head", style: { gap: "16px" } }, A.bannerSprite(p.banner, 6),
      el("div", { class: "party-head-body" }, el("h1", null, p.name), p.motto ? el("div", { class: "motto big" }, `“${p.motto}”`) : null, partyTags(p),
        el("p", { class: "muted" }, `Founded on ${A.when(p.founded_day, true)}`, p.disbanded ? ` · disbanded on ${A.when(p.disbanded, true)}` : ` · ${p.renown} renown`),
        el("p", null, S.dispositions[p.disposition]),
        p.disbanded ? null : el("div", { style: { maxWidth: "320px" } }, `Morale ${p.morale}/100 · ${moraleWord(p.morale)}`, A.bar(p.morale, 100, p.morale < 30 ? "red" : "gold"),
          el("div", { class: "tiny dim" }, "The party's mood. Wins and silver raise it; losses, arguments and skimming lower it. Below 20, members start leaving.")),
        p.disbanded ? null : el("p", { class: "small", style: { marginTop: "6px" } }, p.doing ? [cap(p.doing), p.doing.includes(p.loc_name) ? "" : ` · in ${p.loc_name}`] : `In ${p.loc_name}`),
        p.why && !p.disbanded && !p.quest ? el("p", { class: "small muted", style: { fontStyle: "italic" } }, `Why: ${p.why}.`) : null,
        goalLine(p.goal), ...(p.vows || []).map((v) => vowLine(v))),
      el("button", { class: "btn", onclick: () => A.copy(`${p.name}: ${p.members.map((m) => (heroes[m] || {}).name).join(", ")}\n${A.shareUrl("#/party/" + p.id)}`) }, "Share")));
    v.appendChild(head);
    const mem = el("div", { class: "members" });
    for (const m of p.members) if (heroes[m]) mem.appendChild(el("a", { href: `#/hero/${m}` }, A.heroPortrait(heroes[m], 3), heroes[m].name,
      el("div", { class: "tiny gold" }, (p.roles || {})[m] || (m === p.leader ? "leader" : "")), el("div", { class: "tiny dim" }, `Lv ${heroes[m].level} ${heroes[m].title}`)));
    const q = p.quest;
    const quest = q ? panel("Current quest", el("div", { class: "row wrap", style: { gap: "14px" } },
      el("div", { class: "quest-seal" }, q.what),
      el("div", { style: { flex: 1, minWidth: "200px" } },
        el("h3", { style: { margin: 0 } }, q.where ? `${q.what}: ${q.where}` : q.what),
        q.floors ? el("div", { class: "small" }, `Floor ${Math.min(q.floors, (q.floor || 0) + 1)} of ${q.floors}`, A.bar((q.floor || 0) + 1, q.floors, "gold")) : null,
        q.why ? el("p", { class: "small muted", style: { fontStyle: "italic", marginTop: "4px" } }, `Why: ${q.why}.`) : null))) : null;
    if (quest) v.appendChild(quest);
    const tac = p.disbanded ? null : tacticsPanel(p);
    v.appendChild(panel("Members", mem,
      p.fallen.length ? el("p", { class: "small red", style: { marginTop: "8px" } }, "Fallen: ", p.fallen.map((f, i) => [i ? ", " : "", A.heroLink(f)])) : null,
      p.former.length ? el("p", { class: "small dim" }, "Former members: ", p.former.filter((f) => !p.fallen.includes(f)).map((f, i) => [i ? ", " : "", A.heroLink(f)])) : null));
    if (tac) v.appendChild(tac);
    const g = el("div", { class: "grid2" });
    const list = p.events.map((x) => (typeof x === "string" ? events[x] : x)).filter(Boolean).sort(byDayDesc);
    g.appendChild(panel("History", A.feed(list, { dayHeaders: true })));
    const right = el("div");
    const rels = panel("Other parties");
    if (!p.rels.length) rels.appendChild(el("p", { class: "empty" }, "No dealings with other parties yet."));
    for (const r of p.rels) rels.appendChild(el("div", { class: "row small" }, A.partyLink(r.party), el("span", { class: r.score >= 0 ? "green" : "red" }, r.score >= 40 ? "allies" : r.score >= 10 ? "friendly" : r.score <= -40 ? "enemies" : r.score <= -10 ? "hostile" : "neutral"), el("span", { class: "dim" }, `(${r.score})`)));
    right.appendChild(rels);
    const st = el("table");
    for (const [k, lab] of [["wins", "Fights won"], ["bosses", "Bosses slain"], ["floors", "Floors cleared"], ["fled", "Retreats"], ["deaths", "Members lost"], ["pvp_wins", "Hero fights won"], ["pvp_losses", "Hero fights lost"]])
      st.appendChild(el("tr", null, el("td", null, lab), el("td", { class: "num" }, p.season[k] || 0)));
    right.appendChild(panel(p.disbanded ? "Final season" : "This season", st));
    g.appendChild(right);
    v.appendChild(g);
  }));

  // ================= MAP =================
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
    cv.addEventListener("mousemove", (ev) => {
      const [mx, my, cx, cy] = toMap(ev);
      const ph = hit(mx, my);
      const nd = Scenes.nearestNode(mx, my, cv);
      const txt = ph ? `${ph.h.name} · ${ph.h.doing || ""}` : nd ? A.nodeName(nd) : "";
      tip.hidden = !txt;
      tip.textContent = txt;
      tip.style.left = cx + 12 + "px"; tip.style.top = cy + 12 + "px";
    });
    cv.addEventListener("mouseleave", () => (tip.hidden = true));
    cv.addEventListener("click", (ev) => {
      const [mx, my] = toMap(ev);
      const ph = hit(mx, my);
      if (ph) { location.hash = `#/hero/${ph.h.id}`; return; }
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
  function showNode(side, id) {
    side.innerHTML = "";
    const t = S.towns[id], d = S.dungeons[id], w = S.wilds[id];
    const here = L.heroes.filter((h) => h.alive && h.loc === id && !h.travel);
    const p = panel(A.nodeName(id));
    const kind = Scenes.locKind(id);
    const bd = Scenes.backdrop(kind === "town" ? "plains" : kind, 200, 60, Art.hash(id));
    bd.style.width = "100%"; bd.style.borderRadius = "4px";
    p.appendChild(bd);
    if (t) {
      p.appendChild(el("p", { class: "small muted" }, `${cap(t.size)} · ${t.services.join(", ")}`));
      p.appendChild(el("p", null, t.desc));
      p.appendChild(el("p", { class: "small" }, `Tavern: ${t.tavern}, kept by ${t.folk.barkeep}.`, t.folk.special ? ` Also: ${t.folk.special[0]} at ${t.folk.special[1]}.` : ""));
      const buys = Object.entries(t.buyers).filter(([, m]) => m > 1).map(([g]) => S.goods[g].name.toLowerCase());
      if (buys.length) p.appendChild(el("p", { class: "small gold" }, "Pays well for: " + buys.join(", ")));
      p.appendChild(el("p", { class: "small dim" }, "Odd jobs: " + t.jobs.join(", ").replace(/_/g, " ")));
      const maps = (L.map_stock || {})[id] || [];
      if (maps.length) p.appendChild(el("p", { class: "small" }, "The mapmaker sells: ", maps.map((m, i) => [i ? ", " : "",
        el("a", { href: `#/map/${m.dungeon}` }, S.dungeons[m.dungeon].name), ` (${m.pct}%, drawn by `, A.heroLink(m.by), ")"])));
    }
    if (d) {
      const st = L.dungeons[id] || {};
      p.appendChild(el("p", { class: "small muted" }, `Level ${d.level} dungeon · ${d.floors} floors · ${dangerWord(st.danger)}`));
      p.appendChild(el("p", null, d.desc));
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
    side.appendChild(p);
    if (t) side.appendChild(boardPanel(id));
    if (t) side.appendChild(townLedger(id));
    if (t) side.appendChild(civicPanel(id));
    const who = panel(here.length ? `Here now (${here.length})` : "Nobody here right now");
    const grid = el("div", { class: "stack" });
    for (const h of here) grid.appendChild(A.heroCard(h));
    who.appendChild(grid);
    side.appendChild(who);
  }

  // ================= DIGEST =================
  A.route(/^\/digest(?:\/(\d+)\/(\d+))?$/, (v, s, w) => {
    const ds = (L.digests || []).slice().sort((a, b) => b.season - a.season || b.week - a.week);
    if (!ds.length) { v.appendChild(panel("The Weekly Digest", el("p", { class: "empty" }, "The first digest comes out after the first day of the season."))); return; }
    const d = s ? ds.find((x) => x.season == s && x.week == w) || ds[0] : ds[0];
    const g = el("div", { class: "grid2" });
    const main = el("section", { class: "panel parch" });
    const inProgress = d.season === L.meta.season && L.meta.phase === "season" && d.day_to < d.week * 7;
    main.appendChild(el("div", { class: "mast" }, el("div", { class: "title", style: { fontSize: "34px" } }, "The Weekly Digest"),
      el("div", { class: "sub" }, el("span", null, `Season ${d.season} · Week ${d.week}`), el("span", null, inProgress ? `So far: through day ${d.day_to}` : `Days ${d.day_from}–${d.day_to}`), el("span", null, `${d.events_total} things happened`))));
    const top = d.top.map((id) => events[id]).filter(Boolean);
    if (top[0]) {
      const sc = Scenes.vignette(top[0], 240, 72);
      sc.className = "scene";
      main.appendChild(el("div", { class: "lead" }, el("h1", null, A.richText(headline(top[0]), top[0].heroes, top[0].parties)), sc, el("p", null, A.richText(top[0].text, top[0].heroes, top[0].parties))));
    }
    if (d.column) main.appendChild(el("div", { style: { borderTop: "1px solid #b0915e", borderBottom: "1px solid #b0915e", padding: "8px 0", margin: "8px 0 12px" } },
      el("h4", null, d.columnist ? `From the columnist: ${d.columnist}` : "From the columnist"), el("p", { style: { fontSize: "21px", lineHeight: "1.3" } }, A.richText(d.column, Object.keys(heroes), []))));
    main.appendChild(el("h4", null, "The week's biggest stories"));
    main.appendChild(A.feed(top.slice(1), { empty: top.length ? "That was the big one." : "A quiet week." }));
    g.appendChild(main);
    const right = el("div");
    const hw = heroes[d.hero_of_week];
    if (hw) right.appendChild(panel("Hero of the week", A.heroCard(hw),
      el("p", { class: "tiny dim", style: { marginTop: "6px" } }, `The most talked-about hero this week${d.hero_of_week_n ? ` (${plural(d.hero_of_week_n, "story", "stories")})` : ""}, not the strongest: that's the power rankings.`)));
    const pw = parties[d.party_of_week];
    if (pw) right.appendChild(panel("Party of the week", partyCard(pw),
      d.party_of_week_n ? el("p", { class: "tiny dim", style: { marginTop: "6px" } }, `The most talked-about crew this week (${plural(d.party_of_week_n, "story", "stories")}).`) : null));
    const moves = (d.big_moves || []).map((id) => events[id]).filter(Boolean);
    if (moves.length) right.appendChild(panel("Big moves", el("p", { class: "tiny dim" }, "Days someone jumped 50 renown or more."), A.feed(moves, { noShare: true })));
    const boxTable = (rows, link, label) => {
      const t = el("table", { class: "boxscore" });
      t.appendChild(el("tr", null, el("th", null, label), el("th", { class: "num", title: "stories that named them" }, "Stories"), el("th", { class: "num", title: "how big those stories were, added up" }, "Score"), el("th", { class: "num", title: "renown gained this week" }, "Renown")));
      for (const r of rows) t.appendChild(el("tr", null, el("td", null, link(r)), el("td", { class: "num" }, r.stories), el("td", { class: "num" }, r.score), el("td", { class: "num gold" }, r.gain > 0 ? `+${r.gain}` : r.gain)));
      return t;
    };
    const hb = (d.box || []).filter((r) => heroes[r.hero]).slice(0, 8), pb = (d.party_box || []).filter((r) => parties[r.party]).slice(0, 5);
    if (hb.length) right.appendChild(panel("The week's box score", el("p", { class: "tiny dim" }, "Who the week's stories were about. The top line is the hero (and the party) of the week."),
      boxTable(hb, (r) => A.heroLink(r.hero), "Hero"), pb.length ? boxTable(pb, (r) => A.partyLink(r.party), "Party") : null));
    if (d.rankings && d.rankings.length) {
      const t = el("table");
      for (const r of d.rankings.slice(0, 10)) {
        const h = heroes[r.hero];
        if (!h) continue;
        const mv = moveMark(r, d.week);
        t.appendChild(el("tr", null, el("td", { class: "dim" }, r.rank), el("td", null, mv), el("td", null, A.heroLink(h.id)), el("td", { class: "num gold" }, r.renown)));
      }
      right.appendChild(panel("Hero power rankings", t));
    }
    if (d.party_rankings && d.party_rankings.length) {
      const t = el("table");
      d.party_rankings.slice(0, 8).forEach((r, i) => {
        const p = parties[r.party];
        if (!p) return;
        const grp = el("div", { class: "grp-row" });
        for (const m of p.members) if (heroes[m]) grp.appendChild(A.heroPortrait(heroes[m], 1, { cls: "grp" }));
        t.appendChild(el("tr", null, el("td", { class: "dim" }, r.rank || i + 1), el("td", null, moveMark(r, d.week)), el("td", null, A.bannerSprite(p.banner, 2)), el("td", null, A.partyLink(p.id), grp), el("td", { class: "num gold" }, r.renown)));
      });
      right.appendChild(panel("Party power rankings", t));
    }
    const c = d.counts;
    const kv = el("dl", { class: "kv" });
    for (const [k, lab] of [["fight", "Fights"], ["boss_kill", "Bosses slain"], ["death", "Deaths"], ["evolve", "Class changes"], ["party_formed", "Parties formed"], ["party_disband", "Parties broken"],
      ["bond", "New bonds"], ["brawl", "Brawls"], ["pvp", "Hero vs hero"], ["robbery", "Robberies"], ["body_sold", "Bodies sold"], ["crime", "Arrests & crimes"], ["funeral", "Funerals"]])
      if (c[k]) kv.append(el("dt", null, lab), el("dd", null, c[k]));
    right.appendChild(panel("By the numbers", kv));
    const m = panel("Market report");
    m.appendChild(el("p", { class: "small" }, "Hot: ", d.market_hot.map((x, i) => [i ? ", " : "", el("span", { class: "green" }, `${S.goods[x.good].name} in ${S.towns[x.town].name} (×${x.ratio})`)])));
    m.appendChild(el("p", { class: "small" }, "Glutted: ", d.market_cold.map((x, i) => [i ? ", " : "", el("span", { class: "red" }, `${S.goods[x.good].name} in ${S.towns[x.town].name} (×${x.ratio})`)])));
    right.appendChild(m);
    const arch = panel("Back issues", el("p", { class: "small" }, el("a", { href: "#/days" }, "Every day's Crier →")));
    for (const x of ds) arch.appendChild(el("div", null, el("a", { href: `#/digest/${x.season}/${x.week}`, class: x === d ? "gold" : "" }, `Season ${x.season}, week ${x.week}`)));
    right.appendChild(arch);
    g.appendChild(right);
    v.appendChild(g);
  });

  // ================= WORLD =================
  A.route(/^\/world$/, (v) => {
    v.appendChild(el("h1", null, "The World"));
    v.appendChild(factionsPanel());
    v.appendChild(legendsPanel());
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

  // ================= HISTORY =================
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
          el("div", { class: "small" }, `Died ${m.cause} in ${m.place}, season ${m.season}.`))));
    }
    right.appendChild(mem);
    right.appendChild(treasuresPanel());
    right.appendChild(artifactsPanel());
  });

  // ================= GUIDE =================
  const GUIDE = [
    ["How it works", [
      ["Watching, not playing", "You make a hero with the quiz, then you watch. Every run of the league is one day. Heroes decide for themselves where to go, who to drink with and when to run."],
      ["Seasons", "A season lasts a few weeks of days. At the start, every hero wakes up in a random town (bigger towns are likelier). At the end come awards for heroes and parties, then a fresh start. Levels, gear, scars and grudges carry over."],
      ["Joining", "Heroes made mid-season join at the next season start. Until then they wait on the Roster under \"Joining next season\"."],
      ["Your hero", "Pick your hero on the Crier (or press \"This is mine\" on their page). They will be pinned to the top of the Crier whenever you check in. \"Switch hero\" changes it."],
    ]],
    ["Heroes", [
      ["Renown", "Fame. It comes from fights won, floors cleared, bosses slain, silver earned and stories told about you. It drives the standings and the awards."],
      ["Boldness", "How brave a hero is in a fight. Bold heroes hold the line longer before breaking and running."],
      ["Risk tolerance", "How big a gamble a hero will take when choosing what to do: deeper dungeons, longer odds, dice at the tavern."],
      ["Other traits", "Greed, sociability, honour, curiosity, temper and loyalty. They shape choices (skimming loot, picking fights, staying with a party). Big events can shift them, and the Crier will notice."],
      ["Titles", "A hero's class name is their title, from Warrior to Lich. Evolved classes are earned by how a hero actually fights. Faction members also carry a rank (Squire, Knight, Paladin...), shown under their name."],
      ["Stress", "Builds up from danger and bad days. A night at the tavern or a quiet rest brings it down. Stressed heroes argue more."],
      ["Classes", "Everyone starts as a Warrior, Ranger or Mage. At levels 9 and 18 a hero evolves into a new class shaped by what sets them apart (heal a lot and you lean holy, loot corpses and you lean dark). Crowded classes are harder to get into. The first few heroes to reach level 21 become Legends; once those places are taken, the age has its Legends."],
      ["Scars", "Bad fights leave marks: a lost eye, a hook for a hand, burn scars. They change stats and appearance for good."],
      ["Death", "Heroes can die. The fallen get a funeral (if anyone pays for it) and a spot on the History page. Their bodies may be sold to a necromancer first."],
    ]],
    ["Parties", [
      ["Forming up", "Lonely heroes go looking for company in taverns, around campfires and on the road. Most heroes find a party in the first week or so."],
      ["Morale", "A party's mood, 0 to 100. Wins, silver and good company raise it. Losses, poverty, arguments and skimmed loot lower it. Low morale means members leave or the party breaks up."],
      ["Disposition", "A party's attitude to other parties: honorable, friendly, wary, territorial or predatory (other parties look like walking purses). It decides whether meetings on the road end in a shared fire or a robbery."],
      ["Party awards", "Parties get their own season awards, a party of the week and power rankings, alongside the heroes'."],
      ["Party goal", "Every party, and every hero on their own, picks one goal a season: a boss to bring down, a purse to fill, places to see. The season's ceremony counts who got there; a goal that didn't happen just becomes part of the story."],
      ["Vow", "A promise sworn after a big moment: to repay a rescue, to get even for a robbery, never to pay a toll. Kept vows make the Crier. Broken ones too."],
    ]],
    ["Skills, gear and fights", [
      ["Skills", "Every level brings a skill, picked by what the hero has been doing: patch up friends and healing comes; sneak about and shadow tricks follow. Some skills are for fights, some are always on, and some are for the road (trading, singing, cooking, tracking)."],
      ["Schools", "Each skill belongs to a school. Heroes drift toward the schools they use, and their class changes follow. The schools: {schools}."],
      ["Signature", "The fighting skill a hero has used most. It sits on their page, gold, and it's what the taverns know them for."],
      ["Keystones ✦", "At levels 10 and 20 every hero earns a keystone: a big, one-of-a-kind gift. Only one living hero holds each one. Some change how a hero always fights or lives; others spring at a moment (a killing blow, a friend falling). They stay for good. Tap a ✦ badge to read what it does."],
      ["Front row and back row", "Blades, axes, maces and daggers stand in front and take the hits. Bows, crossbows, staffs and wands fight from the back, where foes have a harder time reaching. Spears hold the front for fighters and the back for everyone else."],
      ["Gear", "Weapon and armour come in tiers, from battered to masterwork. The Kit shows what each piece adds: more power on every blow, more armour against every hit. Hats, cloaks and off-hands add a little protection or a knack. Plain rings and necklaces are worn for show."],
      ["Magic items", "Rare finds from deep floors, bosses and odd deals, each with its own name, look and story. They can be lost, sold, stolen or handed down. The History page lists every one found this age."],
      ["How a fight ends", "Each side has resolve: its nerve, the bar over each team in a replay. Hits, fallen friends and fear wear it down. When it breaks, that side runs; some are cut down as they go, and strong friends carry the fallen out. Between heroes, the losers may surrender instead. If one side is all down, it's a wipe. If nobody breaks for many rounds, both sides back off."],
    ]],
    ["The world", [
      ["Delve", "An expedition into a dungeon that can last days. Each day the crew dives deeper, maps side passages, sweeps for loot, rests in a cleared chamber, takes on the boss or climbs out. Bold crews dive; careful ones map first, and a mapped lair makes the boss fight fairer."],
      ["Explored", "How much of a dungeon has been opened up, from untouched to picked clean. A worked-over dungeon is safer but pays less. Something always moves back in: it slowly fills up again, and a lot faster when a new boss arrives."],
      ["Maps", "Heroes map what they explore and can sell copies to a town's mapmaker. Other crews buy them before setting out."],
      ["Hunt", "A trip into the wilderness for pelts, herbs and bounties. Lower risk, lower reward."],
      ["Monsters", "Dungeons can be teeming, normal, recovering or thinned out. Clearing a dungeon thins it out for a while, and slain bosses are eventually replaced."],
      ["The economy", "Every town pays different prices. Heroes remember prices and swap tips, so some carry loot across the map to sell it better. The undertaker in Ashfen pays well for remains, no questions asked."],
      ["Watch the fight", "Notable fights are kept as replays. Look for \"watch\" next to a story."],
    ]],
  ];
  A.route(/^\/guide$/, (v) => {
    v.appendChild(el("h1", null, "The Guide"));
    v.appendChild(el("p", { class: "muted" }, "Everything you need to follow the league, in one page."));
    const g = el("div", { class: "grid2 even" });
    for (const [title, items] of GUIDE) {
      const dl = el("dl", { class: "kv guide" });
      for (const [k, txt] of items) dl.append(el("dt", null, k), el("dd", null, txt.replace("{schools}", Object.values(S.schools || {}).flat().join(", "))));
      g.appendChild(panel(title, dl));
    }
    v.appendChild(g);
  });

  // ================= SEASON FINALE CEREMONY =================
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
      el("p", null, `${plural((s.end_day - (s.start_day || s.end_day - 27)) + 1, "day")} · ${num.events || "?"} stories · ${num.deaths || 0} fallen · ${num.bosses || 0} bosses slain`)));
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

  // ================= SONGBOOK & THE BARD =================
  const songs = () => (L.songs || []).slice().sort((a, b) => b.day - a.day);
  const MOOD = { glory: ["♪ glory", "gold"], sad: ["♪ lament", "dim"], shame: ["♪ ballad of shame", "red"] };
  const BARD = { id: "bard", name: "The Bard", look: { skin: "#e8b088", hair: "#7a4424", style: 1, face: 2, fav: "#c8463a", scars: [] }, weapon: "lute", weapon_tier: 2, armor_tier: 1 };

  function bardStage(song, slides) {
    const box = el("div", { class: "bard" });
    const cv = el("canvas", { class: "bard-stage" });
    const W = 240, H = 84;
    cv.width = W * 4; cv.height = H * 4;
    const bg = Scenes.backdrop("tavern", W, H, Art.hash(song.id));
    const bardCls = S.classes.bard || { look: { outfit: "fancy", head: "feather_cap", offhand: "lute" } };
    const listeners = (song.heroes || []).map((id) => heroes[id]).filter((h) => h && h.alive !== false).slice(0, 3);
    const ghost = song.dirge && heroes[song.dirge];
    const slide = el("div", { class: "slide", hidden: !slides || !slides.length });
    const lyr = el("div", { class: "lyrics" });
    const lineEls = song.lyrics.map((line) => {
      const row = el("div", { class: line === song.title ? "chorus" : "" });
      for (const s of Sound.syllables(line)) row.appendChild(el("span", null, s));
      lyr.appendChild(row);
      return row;
    });
    let playing = false, frame = 0, raf = 0, notes = [];
    const draw = () => {
      const c = cv.getContext("2d"), off = document.createElement("canvas");
      off.width = W; off.height = H;
      const o = off.getContext("2d");
      o.imageSmoothingEnabled = false;
      o.drawImage(bg, 0, 0);
      const ground = Math.round(H * 0.62) + 16;
      const g = Art.heroGrid(BARD, playing ? frame : 0, bardCls);
      o.fillStyle = "#3a2214"; o.fillRect(W / 2 - 10, ground - 6, 20, 6);
      o.drawImage(g.toCanvas(1), Math.round(W / 2 - g.w / 2), ground - g.h - 4);
      if (ghost) { o.globalAlpha = 0.45; const gg = Art.heroGrid(ghost, 0, A.heroLook(ghost)); o.drawImage(gg.toCanvas(1), W / 2 + 30, ground - gg.h - 10 - Math.round(Math.sin(Date.now() / 600) * 2)); o.globalAlpha = 1; }
      listeners.forEach((h, i) => { const hg = Art.heroGrid(h, 0, A.heroLook(h)); o.drawImage((i % 2 ? hg : hg.flipX()).toCanvas(1), i % 2 ? W - 60 - i * 12 : 30 + i * 12, ground - hg.h); });
      for (const n of notes) { o.fillStyle = n.c; o.fillRect(Math.round(n.x), Math.round(n.y), 2, 2); o.fillRect(Math.round(n.x) + 2, Math.round(n.y) - 4, 1, 5); }
      c.imageSmoothingEnabled = false;
      c.drawImage(off, 0, 0, cv.width, cv.height);
    };
    const tick = () => {
      if (!cv.isConnected) { Sound.stopSong(); return; }
      if (playing) {
        if (Math.random() < 0.08) notes.push({ x: W / 2 + 6 + Math.random() * 10, y: H * 0.45, vx: (Math.random() - 0.3) * 0.4, c: ["#ffd86a", "#ffffff", "#e87a5a"][Math.floor(Math.random() * 3)], life: 80 });
        for (const n of notes) { n.y -= 0.35; n.x += n.vx; n.life--; }
        notes = notes.filter((n) => n.life > 0);
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    const btn = el("button", { class: "btn primary" }, "▶ Ask the bard to play");
    const about = (song.heroes || []).map((id) => (heroes[id] || {}).name).filter(Boolean);
    const shareSong = A.shareBtn(`"${song.title}", a song${about.length ? " about " + about.slice(0, 3).join(", ") : ""}, sung in ${plural(song.towns.length, "town")}. ${song.lyrics.slice(0, 2).join(" / ")}`, `#/songs/${song.id}`, "Song copied with a link.");
    const stop = () => { playing = false; Sound.stopSong(); btn.textContent = "▶ Play it again"; for (const r of lineEls) for (const s of r.children) s.classList.remove("on", "sung"); };
    btn.onclick = () => {
      if (playing) { stop(); return; }
      playing = true;
      btn.textContent = "■ Stop";
      let beatTimer = setInterval(() => { if (!playing) clearInterval(beatTimer); frame ^= 1; }, 280);
      Sound.playSong(song, (li, si) => {
        lineEls.forEach((r, i) => [...r.children].forEach((s, j) => { s.classList.toggle("on", i === li && j === si); s.classList.toggle("sung", i < li || (i === li && j < si)); }));
        if (slides && slides.length && si === 0) { slide.textContent = slides[li % slides.length]; slide.hidden = false; }
        lineEls[li].scrollIntoView({ block: "nearest", behaviour: "smooth" });
      }, () => { playing = false; btn.textContent = "▶ Play it again"; });
    };
    const [moodTxt, moodCls] = MOOD[song.mood] || MOOD.glory;
    box.append(
      el("div", { class: "bard-head" }, el("div", null, el("div", { class: `tiny ${moodCls}` }, moodTxt), el("h2", { class: "song-title" }, `"${song.title}"`),
        el("div", { class: "small muted" }, (song.heroes || []).length ? ["About ", (song.heroes || []).map((id, i) => [i ? ", " : "", A.heroLink(id)])] : "A song for the town",
          ` · first sung in ${A.nodeName(song.towns[0], true)}, season ${song.season} day ${song.sday || "?"} · now heard in ${plural(song.towns.length, "town")}`)), el("div", { class: "row" }, btn, shareSong)),
      cv, slide, lyr);
    const lies = Object.entries(song.versions || {});
    if (lies.length) box.appendChild(el("div", { class: "small muted", style: { marginTop: "6px" } }, "The song changes on the road: ",
      lies.map(([t, v], i) => [i ? "; " : "", `in ${A.nodeName(t, true)} they sing "${v.title}"`]), "."));
    requestAnimationFrame(tick);
    return box;
  }

  A.route(/^\/songs(?:\/([\w]+))?$/, (v, sid) => {
    const all = songs();
    v.appendChild(el("h1", null, "The Songbook"));
    v.appendChild(el("p", { class: "muted" }, "Every big moment in the league ends up as a song in some tavern. Songs travel the roads town to town. Heroes hear them. Some of them are proud of it."));
    if (!all.length) { v.appendChild(panel("No songs yet", el("p", { class: "empty" }, "Nobody has done anything worth singing about. Give it a week."))); return; }
    const cur = all.find((s) => s.id === sid) || all[0];
    const stage = el("section", { class: "panel" }, bardStage(cur));
    v.appendChild(stage);
    const list = el("div", { class: "songlist" });
    const fresh = all.filter((s) => L.meta.day - s.day <= 21), old = all.filter((s) => L.meta.day - s.day > 21);
    const row = (s) => el("a", { class: "song-row" + (s === cur ? " on" : ""), href: `#/songs/${s.id}` },
      el("span", { class: `tiny ${(MOOD[s.mood] || MOOD.glory)[1]}` }, (MOOD[s.mood] || MOOD.glory)[0]), el("b", null, s.title),
      el("span", { class: "tiny dim" }, `S${s.season} · Day ${s.sday || "?"} · ${plural(s.towns.length, "town")}`));
    if (fresh.length) list.append(el("h3", null, "On the road now"), ...fresh.map(row));
    if (old.length) list.append(el("h3", { style: { marginTop: "10px" } }, "Old songs"), ...old.map(row));
    v.appendChild(panel("All songs", list));
  });

  function songsPanel() {
    const fresh = songs().filter((s) => L.meta.day - s.day <= 21).sort((a, b) => b.towns.length - a.towns.length).slice(0, 3);
    if (!fresh.length) return el("span");
    return panel("Songs on the road", ...fresh.map((s) => el("div", { class: "row", style: { marginBottom: "6px" } },
      el("a", { class: "btn small", href: `#/songs/${s.id}` }, "▶"), el("div", null, el("b", null, `"${s.title}"`), el("div", { class: "tiny dim" }, `sung in ${plural(s.towns.length, "town")}`)))),
      el("p", { class: "small" }, el("a", { href: "#/songs" }, "The Songbook →")));
  }

  // ================= TOWN MEMORY =================
  const REP_TIERS = [[70, (t) => `Hero of ${t}`], [40, () => "Beloved"], [15, () => "Welcome"], [-15, () => "Known"], [-40, () => "Distrusted"], [-101, () => "Wanted"]];
  const repTier = (v, town) => REP_TIERS.find(([f]) => v >= f)[1](A.nodeName(town));
  const folkWord = (v) => (v >= 60 ? "old friend" : v >= 30 ? "friendly" : v <= -60 ? "sworn enemy" : v <= -30 ? "can't stand them" : null);
  const GUARDS = ["no guards to speak of", "a night watch", "a proper garrison", "walls and a garrison"];

  const JOB = { escort: ["📦", "Escort"], bounty: ["🎯", "Wanted"], clear: ["🗡", "Clear-out"], retrieve: ["🔦", "Retrieval"], defend: ["🛡", "Defend the town"] };
  function boardPanel(id) {
    const p = panel("Notice board");
    const day = L.meta.day;
    const jobs = ((L.boards || {})[id] || []).filter((c) => c.kind !== "shady");
    const shady = ((L.boards || {})[id] || []).some((c) => c.kind === "shady");
    const line = (c) => {
      const to = A.nodeName(c.dest, true);
      const left = Math.max(0, c.expires - day);
      const what = {
        escort: `Guard ${c.cargo} to ${to}`,
        bounty: `${c.name}, ${c.what}, last seen in ${to}`,
        clear: `Clear ${c.need} ${c.mon ? (S.monsters[c.mon] || {}).name || "beasts" : "beasts"} out of ${to} by day ${c.deadline}`,
        retrieve: `Fetch ${c.item} from floor ${c.floor} of ${to}`,
        defend: `Raiders expected on day ${c.night}. Hold the walls`,
      }[c.kind] || "Work going";
      const [icon, label] = JOB[c.kind] || ["📜", "Job"];
      return el("li", null, el("b", null, `${icon} ${label}: `), what, el("span", { class: "dim small" }, ` · ${c.pay} silver${c.kind === "bounty" ? "" : " each"} · ${left ? `${left} day${left > 1 ? "s" : ""} left` : "last day"}`));
    };
    if (jobs.length) p.appendChild(el("ul", { class: "board" }, jobs.map(line)));
    else p.appendChild(el("p", { class: "empty" }, "The board is bare today. Someone has drawn a rude goblin on it."));
    const wanted = (L.wanted || []).filter((b) => b.town === id);
    for (const b of wanted) {
      const hunters = b.takers.map((t) => heroes[t] ? A.heroLink(t) : parties[t] ? A.partyLink(t) : null).filter(Boolean);
      p.appendChild(el("p", { class: "small" }, el("b", null, "WANTED: "), `${b.name}. ${b.pay} silver, until day ${b.until}. `,
        hunters.length ? ["Hunting it: ", hunters.map((x, i) => [i ? ", " : "", x])] : "Nobody has taken the job yet."));
    }
    if (shady) p.appendChild(el("p", { class: "small dim" }, "Someone in the back of the tavern is hiring for work that isn't on the board."));
    return p;
  }

  function townLedger(id) {
    const ts = (L.town_state || {})[id] || { guards: 0, raids: 0, repelled: 0, looted: 0, history: [] };
    const fans = L.heroes.filter((h) => h.alive && (h.rep || {})[id] != null).sort((a, b) => (b.rep[id] || 0) - (a.rep[id] || 0));
    const p = panel("Town ledger");
    p.appendChild(el("p", { class: "small" }, `Defences: ${GUARDS[ts.guards || 0]}. Raids: ${ts.raids || 0} (${ts.repelled || 0} repelled, ${ts.looted || 0} looted).`));
    const loved = fans.filter((h) => h.rep[id] >= 15).slice(0, 4), hated = fans.filter((h) => h.rep[id] <= -15).slice(-3).reverse();
    if (loved.length) p.appendChild(el("p", { class: "small" }, el("b", null, "Local favourites: "), loved.map((h, i) => [i ? ", " : "", A.heroLink(h.id), el("span", { class: "dim" }, ` (${repTier(h.rep[id], id).toLowerCase()})`)])));
    if (hated.length) p.appendChild(el("p", { class: "small red" }, el("b", null, "Not welcome: "), hated.map((h, i) => [i ? ", " : "", A.heroLink(h.id), ` (${repTier(h.rep[id], id).toLowerCase()})`])));
    const hist = (ts.history || []).slice().reverse().slice(0, 8);
    if (hist.length) p.appendChild(el("ol", { class: "timeline small" }, hist.map((x) => el("li", null, el("span", { class: "when" }, `S${x.season} · Day ${x.sday || "?"}`), el("div", null, A.richText(`${A.nodeName(id)} ${x.text}.`, Object.keys(heroes), []))))));
    else p.appendChild(el("p", { class: "empty" }, "Nothing worth remembering has happened here yet."));
    return p;
  }

  function repPanel(h) {
    const p = panel("Reputation");
    const reps = Object.entries(h.rep || {}).sort((a, b) => b[1] - a[1]);
    if (!reps.length) { p.appendChild(el("p", { class: "empty" }, "No town has formed an opinion yet.")); return p; }
    const t = el("table");
    for (const [town, v] of reps) {
      const folks = Object.entries((h.folk || {})[town] || {}).map(([role, rv]) => [S.towns[town].folk[role], folkWord(rv), rv]).filter(([who, w]) => who && w);
      t.appendChild(el("tr", null, el("td", null, el("a", { href: `#/map/${town}` }, A.nodeName(town))), el("td", { class: v >= 15 ? "green" : v <= -15 ? "red" : "dim" }, repTier(v, town)),
        el("td", { class: "small" }, folks.map(([who, w, rv], i) => [i ? ", " : "", el("span", { class: rv > 0 ? "green" : "red" }, `${who}: ${w}`)]))));
    }
    p.appendChild(t);
    return p;
  }

  // ================= WEATHER, WONDERS, HYPER EVENTS =================
  const WX = { clear: ["☀", "clear"], cloudy: ["☁", "grey"], rain: ["🌧", "rain"], fog: ["🌫", "fog"], storm: ["⛈", "storm"], snow: ["❄", "snow"], heat: ["🔥", "heatwave"] };
  const WONDER_NAMES = { blood_moon: "🌕 Blood moon", aurora: "🌌 Aurora", frogs: "🐸 Rain of frogs", golden_fog: "✨ Golden fog", brimstone: "☄ Brimstone rain" };
  function weatherStrip() {
    const wx = L.weather || {};
    const bits = ["north", "west", "central", "east"].filter((r) => wx[r]).map((r) => el("span", { class: "wx" }, `${cap(r)} ${WX[wx[r]][0]} ${WX[wx[r]][1]}`));
    if (!bits.length) return null;
    const row = el("div", { class: "wx-strip" }, el("b", null, "Weather: "), bits);
    if (L.wonder) row.appendChild(el("span", { class: "wx wonder" }, `${WONDER_NAMES[L.wonder.kind] || L.wonder.kind} over the ${L.wonder.region}`));
    return row;
  }
  function hyperBanner() {
    const h = L.hyper;
    if (!h) return null;
    const line = h.kind === "megabeast" ? `${h.name} is loose. Last seen in ${A.nodeName(h.loc, true)}. It ${h.habit}.`
      : h.kind === "plague" ? `${cap(h.name)} is spreading: ${Object.keys(h.towns || {}).map(A.nodeName).join(", ") || "fading"}.`
      : h.kind === "comet" ? `A star has fallen in ${A.nodeName(h.loc, true)}. Whoever reaches it first gets the star-metal.`
      : h.kind === "tournament" ? `The Tournament of Crowns in Ironhaven, ${plural(h.left, "day")} away.` : h.name;
    return el("section", { class: "panel hyper-banner" }, el("div", { class: "finale-kicker" }, "The great event of the season"), el("h2", null, cap(h.name)), el("p", null, line));
  }

  // ================= ARTIFACTS =================
  const arts = () => L.artifacts || [];
  const MOOD_WORD = { proud: "proud", sulky: "sulking", content: "content", bloodthirsty: "bloodthirsty", bored: "bored" };
  function artifactCard(a, full) {
    const owner = a.owner && heroes[a.owner];
    const where = a.destroyed ? "destroyed" : owner ? ["carried by ", A.heroLink(owner.id)] : a.pawned_in ? `in a ${A.nodeName(a.pawned_in)} pawnshop` : a.lost_at ? `lost in ${A.nodeName(a.lost_at, true)}` : "unclaimed";
    const stats = Object.entries(a.stats).map(([k, v]) => `+${v} ${k}`).join(", ");
    const curse = a.cursed && a.revealed;
    const card = el("div", { class: "artifact" + (curse ? " cursed" : "") },
      el("div", { class: "art-name" }, (curse ? "☠ " : "✦ ") + a.name),
      el("div", { class: "tiny dim" }, curse ? `Cursed. ${a.desc}.` : `${stats} · ${MOOD_WORD[a.mood] || a.mood}${a.kills >= 1 ? ` · ${plural(Math.round(a.kills), "kill")}` : ""}`),
      el("div", { class: "small" }, where, a.owners.length > 1 ? el("span", { class: "dim" }, ` · ${plural(a.owners.length, "owner")}`) : null));
    if (full && a.history.length) card.appendChild(el("ol", { class: "timeline small" }, a.history.slice().reverse().slice(0, 8).map((x) =>
      el("li", null, el("span", { class: "when" }, `S${x.season} · Day ${x.sday || "?"}`), el("div", null, A.richText(cap(x.text) + ".", Object.keys(heroes), []))))));
    return card;
  }
  function treasuresPanel() {
    const list = L.treasures || [];
    if (!list.length) return el("span");
    const p = panel("Treasures of the age", el("p", { class: "small dim" }, "Every magic thing found this age, and what became of it."));
    for (const t of list) {
      const owner = t.owner && heroes[t.owner], cv = Art.gearIcon(t, owner ? owner.look : null).toCanvas(2);
      const card = el("div", { class: "artifact treasure", style: t.glow ? "--glow:" + t.glow : null },
        el("div", { class: "row", style: { gap: "8px" } }, cv, el("div", null, el("div", { class: "art-name" }, t.name),
          el("div", { class: "small" }, owner ? ["carried by ", A.heroLink(owner.id)] : "no one carries it now"))));
      const hl = historyList(t.history);
      if (hl) card.appendChild(hl);
      p.appendChild(card);
    }
    return p;
  }
  function artifactsPanel() {
    const list = arts().filter((a) => !a.cursed || a.revealed);
    if (!list.length) return el("span");
    const p = panel("Legendary artifacts");
    for (const a of list) p.appendChild(artifactCard(a, true));
    return p;
  }

  // ================= TOWN LIFE ADDITIONS =================
  function civicPanel(id) {
    const r = (L.rulers || {})[id], watch = (L.watch || {})[id] || [], special = (L.specials || {})[id];
    const p = panel("Who runs the place");
    if (r) p.appendChild(el("p", { class: "small" }, el("b", null, `${r.title.replace(/\b\w/g, (c) => c.toUpperCase())}: ${r.name}`), ` (${r.mood}). This week: `,
      el("span", { class: r.edict === "nothing" ? "dim" : "gold" }, (S.edicts && S.edicts[r.edict]) || r.edict.replace(/_/g, " ")), r.banned_song ? ` (banned: "${r.banned_song}")` : ""));
    if (watch.length) p.appendChild(el("p", { class: "small" }, el("b", null, "The watch: "), watch.map((o, i) => [i ? ", " : "", `${o.title}${o.catches ? ` (${o.catches} arrests)` : ""}`])));
    if (special) p.appendChild(el("p", { class: "small" }, el("b", null, "Tavern special: "), special));
    const cult = Object.entries(L.cults || {}).find(([, c]) => c.town === id && !c.ended);
    if (cult) p.appendChild(el("p", { class: "small gold" }, el("b", null, "Shrine: "), `${cult[1].name} (${plural(cult[1].members, "member")}), devoted to `, A.heroLink(cult[0])));
    return p;
  }
  function heroExtras(h) {
    const box = el("div");
    const HAB = { generous: "gives to beggars and the temple", luxury: "likes the best room and the good bottle", glutton: "eats everything", frugal: "pinches every coin" };
    if ((h.habits || []).length || h.hobby) box.appendChild(panel("Where the money goes", el("p", null,
      (h.habits || []).map((x) => HAB[x]).filter(Boolean).join("; ") || "nothing unusual",
      h.hobby ? `. Hobby: ${h.hobby}${h.hobby_spent ? ` (${h.hobby_spent} silver so far)` : ""}.` : ".")));
    const a = arts().find((x) => x.owner === h.id && (!x.cursed || x.revealed));
    if (a) box.appendChild(panel("Carrying", artifactCard(a, true)));
    const c = (L.cults || {})[h.id];
    if (c && !c.ended) box.appendChild(panel("Has a cult", el("p", null, `${cap(c.name)}: ${plural(c.members, "member")}, with a shrine in ${A.nodeName(c.town, true)}.`), c.demand ? el("p", { class: "small" }, `Current demand: ${c.demand}.`) : null));
    return box;
  }

  // ================= THE DIRGE =================
  function dirgePanel(h) {
    const song = (L.songs || []).find((s) => s.dirge === h.id);
    if (!song) return el("span");
    const moments = L.events.filter((e) => (e.heroes || []).includes(h.id) && e.imp >= 3 && e.kind !== "join").sort((a, b) => a.day - b.day).slice(-6);
    const stage = bardStage(song, moments.map((e) => e.text));
    return panel("The dirge", el("p", { class: "small muted" }, `${A.nodeName(song.towns[0])} still sings it. Press play for a song and a life.`), stage);
  }

  // ================= FACTIONS & LEGENDS =================
  function factionsPanel() {
    const F = S.factions || {}, st = L.factions || {};
    const p = panel("Factions");
    const grid = el("div", { class: "cols", style: { gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" } });
    for (const [fid, f] of Object.entries(F)) {
      const s = st[fid] || { power: 50, log: [], members: [] };
      const last = (s.log || []).slice(-1)[0];
      const fans = L.heroes.filter((h) => h.alive && (h.fstanding || {})[fid] >= 20).sort((a, b) => b.fstanding[fid] - a.fstanding[fid]).slice(0, 3);
      grid.appendChild(el("div", { class: "faction" },
        el("div", { class: "fac-name" }, `${f.icon} ${cap(f.name)}`),
        el("div", { class: "tiny dim" }, f.hq ? `Based in ${A.nodeName(f.hq, true)}${f.mobile && s.loc && s.loc !== f.hq ? ` · now in ${A.nodeName(s.loc, true)}` : ""}` : "Everywhere and nowhere"),
        el("p", { class: "small" }, f.blurb),
        el("div", { class: "small" }, "Strength", A.bar(Math.min(100, s.power), 100, f.kind === "cult" ? "red" : "gold")),
        last ? el("p", { class: "small muted" }, `Lately: ${last.text}.`) : null,
        (s.members || []).length ? el("p", { class: "small" }, "Sworn: ", s.members.map((m, i) => [i ? ", " : "", A.heroLink(m)])) : f.secret ? el("p", { class: "small dim" }, "Members unknown.") : null,
        fans.length ? el("p", { class: "small dim" }, "Well regarded: ", fans.map((h, i) => [i ? ", " : "", A.heroLink(h.id)])) : null));
    }
    p.appendChild(grid);
    return p;
  }
  function legendsPanel() {
    const ls = (L.legends || []).slice().sort((a, b) => b.last - a.last);
    if (!ls.length) return el("span");
    const p = panel("Legends of the realm");
    p.appendChild(el("p", { class: "small muted" }, "Famous figures who turn up rarely, when they feel like it."));
    for (const lg of ls) {
      const s = (lg.sightings || []).slice(-1)[0];
      p.appendChild(el("div", { class: "legend-row" }, el("b", null, lg.name), lg.title ? el("span", { class: "gold" }, `, ${lg.title}`) : null,
        lg.note ? el("div", { class: "tiny dim" }, cap(lg.note) + ".") : null,
        el("div", { class: "small" }, s ? A.richText(s.text, Object.keys(heroes), []) : el("span", { class: "dim" }, "Not seen yet this age."))));
    }
    return p;
  }
  function renownCaption(h) {
    const live = L.heroes.filter((x) => x.alive && x.joined).sort((a, b) => b.renown - a.renown);
    const i = live.findIndex((x) => x.id === h.id);
    const where = i < 0 ? null : live.length >= 8 && i >= live.length - 3 ? "still making a name this season" : `${ordinal(i + 1)} of ${live.length} this season`;
    return where ? `${where} · fame from fights, deeds and stories; resets each season` : "fame earned this season";
  }
  function ordinal(n) { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function rivalryPanel(title, r, events) {
    const a = heroes[r.a], b = heroes[r.b];
    if (!a || !b) return el("span");
    const [wa, wb] = r.record || [0, 0];
    const p = panel(title, el("div", { class: "row rival-row" },
      el("a", { href: `#/hero/${a.id}`, class: "rival" }, A.heroPortrait(a, 2), el("b", null, a.name)),
      el("div", { class: "rival-vs" }, el("div", { class: "finale-kicker" }, r.type === "nemeses" ? "nemeses" : "rivals"), el("b", null, wa + wb ? `${wa} – ${wb}` : "vs"), wa + wb ? el("div", { class: "tiny dim" }, "showdowns won") : null),
      el("a", { href: `#/hero/${b.id}`, class: "rival" }, A.heroPortrait(b, 2), el("b", null, b.name))));
    const evs = (r.events || []).map((id) => events[id]).filter(Boolean);
    if (evs.length) p.appendChild(el("ul", { class: "diary small" }, evs.map((e) => el("li", null, A.richText(e.text, e.heroes, e.parties)))));
    if (r.seasons && r.seasons.length > 1) p.appendChild(el("p", { class: "tiny dim" }, `Top rivalry in seasons ${r.seasons.join(" and ")}.`));
    return p;
  }
  function factionRows(h) {
    const F = S.factions || {};
    const rows = Object.entries(h.fstanding || {}).filter(([, v]) => Math.abs(v) >= 5).sort((a, b) => b[1] - a[1]);
    if (!rows.length && !h.faction) return el("span");
    const p = panel("Factions");
    if (h.faction && F[h.faction]) p.appendChild(el("p", null, el("b", null, `${F[h.faction].ranks[h.frank || 0]} of ${F[h.faction].name}`)));
    for (const [fid, v] of rows) if (F[fid]) p.appendChild(el("div", { class: "row small" }, el("span", { style: { width: "220px" } }, `${F[fid].icon} ${cap(F[fid].name)}`),
      el("span", { class: v >= 20 ? "green" : v <= -20 ? "red" : "dim" }, v >= 60 ? "revered" : v >= 35 ? "trusted" : v >= 20 ? "liked" : v <= -40 ? "hated" : v <= -20 ? "disliked" : "noticed")));
    return p;
  }

  // ================= THE ANNALS (end of the age) =================
  A.route(/^\/annals$/, (v) => {
    const an = L.annals;
    if (!an) { v.appendChild(panel("The Annals", el("p", { class: "empty" }, `The age isn't over yet. The books close after season ${(S.config && S.config.league_seasons) || 3}.`))); return; }
    v.appendChild(el("section", { class: "finale-hero" }, el("div", { class: "finale-kicker" }, "The end of an age"), el("h1", null, "The Annals of the League"),
      el("p", null, `${plural(an.seasons, "season")} · ${plural(an.days, "day")} · ${an.fallen.length} fallen · ${plural(an.artifacts.length, "artifact")} still in the world`)));
    if (an.story) v.appendChild(panel("The story of the age", ...an.story.split(/\n\s*\n/).map((t) => el("p", { class: "epilogue" }, t))));
    const top = an.legends[0] && heroes[an.legends[0].hero];
    if (top) v.appendChild(el("section", { class: "panel laurel" }, el("div", { class: "finale-kicker" }, "Greatest of the age"),
      el("a", { href: `#/hero/${top.id}`, class: "laurel-frame" }, Art.laurelGrid().toCanvas(5), A.heroPortrait(top, 5, { cls: "champ" })), el("h2", { class: "champ-name" }, top.name),
      el("p", { class: "small muted" }, `${top.npc ? "League hero" : top.owner + "'s hero"} · ${an.legends[0].renown} renown across the age`)));
    const t = el("table");
    t.appendChild(el("tr", null, el("th", null, "#"), el("th", null, "Hero"), el("th", { class: "hide-sm" }, "Class"), el("th", { class: "num" }, "Lv"), el("th", { class: "num" }, "Renown")));
    an.legends.forEach((r, i) => { const h = heroes[r.hero]; if (h) t.appendChild(el("tr", null, el("td", { class: "dim" }, i + 1),
      el("td", null, el("div", { class: "row", style: { gap: "6px" } }, A.heroPortrait(h, 1, { cls: "mini" }), A.heroLink(h.id), r.alive ? null : " ✝",
          A.shareBtn(`${h.name}${h.npc ? "" : ` (${h.owner}'s hero)`}, #${i + 1} in the Annals of ${L.meta.name}: level ${r.level} ${A.clsName(r.cls)}, ${r.renown} renown across the age.${r.epitaph ? " " + r.epitaph : ""}`, `#/hero/${h.id}`)),
        r.epitaph ? el("div", { class: "tiny" }, r.epitaph) : null,
        r.moment ? el("div", { class: "tiny dim" }, "“", A.richText(r.moment, [], []), "”") : null),
      el("td", { class: "small hide-sm" }, A.clsName(r.cls)), el("td", { class: "num" }, r.level), el("td", { class: "num gold" }, r.renown))); });
    const champs = el("ol", { class: "timeline small" }, an.champions.map((c) => el("li", null, el("span", { class: "when" }, `Season ${c.season}`),
      el("div", null, c.hero && heroes[c.hero] ? A.heroLink(c.hero) : "—", c.party && parties[c.party] ? [" · ", A.partyLink(c.party)] : null))));
    v.appendChild(el("div", { class: "grid2" }, panel("Legends of the age", el("div", { class: "scrollx" }, t)), panel("Champions", champs)));
    if ((an.vows || []).length) {
      const kept = an.vows.filter((x) => x.state === "kept").length;
      v.appendChild(panel("Vows of the age", el("p", { class: "small muted" }, `${kept} of ${an.vows.length} vows kept.`),
        el("ul", { class: "goals" }, an.vows.map((x) => el("li", { class: x.state === "kept" ? "met" : "missed" },
          el("span", { class: "mark" }, x.state === "kept" ? "✔" : "○"), x.party ? A.partyLink(x.party) : x.hero && heroes[x.hero] ? A.heroLink(x.hero) : x.name,
          ` swore on ${A.when(x.day, true)} ${x.text}`, el("span", { class: "tiny dim" }, x.through ? " · kept through the age" : x.state === "unfinished" ? " · left unfinished" : ` · ${x.state} on ${A.when(x.ended, true)}`))))));
    }
    if ((an.honours || []).length) v.appendChild(panel("Honours of the age", el("div", { class: "awards" }, an.honours.map((o) => heroes[o.hero] ? el("div", { class: "award" },
      A.heroPortrait(heroes[o.hero], 1, { cls: "mini" }), el("div", null, el("b", null, o.name), el("div", { class: "small" }, A.heroLink(o.hero), el("span", { class: "dim" }, ` · ${o.value} ${o.why}`)))) : null))));
    const eps = Object.entries(an.epitaphs || {}).filter(([id]) => heroes[id] && !an.legends.some((r) => r.hero === id));
    if (eps.length) v.appendChild(panel("Every other hero of the age", el("ul", { class: "diary" }, eps.map(([id, ep]) =>
      el("li", null, el("span", { class: "row", style: { gap: "6px" } }, A.heroPortrait(heroes[id], 1, { cls: "mini" }), A.heroLink(id),
        el("span", { class: "tiny dim" }, heroes[id].npc ? "" : heroes[id].owner + "'s"), A.shareBtn(`${heroes[id].name}, in the Annals of ${L.meta.name}: ${ep}`, `#/hero/${id}`)), el("div", { class: "small" }, ep))))));
    if (an.rivalry) v.appendChild(rivalryPanel("Rivalry of the age", an.rivalry, Object.fromEntries((L.events || []).map((e) => [e.id, e]))));
    if (an.moments.length) v.appendChild(panel("The moments they'll still talk about", el("ol", { class: "timeline" }, an.moments.map((m) =>
      el("li", null, el("span", { class: "when" }, `Season ${m.season}`), el("div", null, A.richText(m.text, m.heroes, m.parties), " ", A.shareBtn(m.text, (m.heroes || []).some((id) => heroes[id]) ? `#/hero/${m.heroes.find((id) => heroes[id])}` : "#/annals")))))));
    v.appendChild(el("p", null, el("a", { class: "btn", href: "#/history" }, "Every season →"), " ", el("a", { class: "btn", href: "#/songs" }, "The songs they sang →")));
  });

  const FIGHT_KINDS = ["fight", "ambush", "boss", "boss_kill", "showdown", "pvp"];
  const times = (n, one, many) => (n === 1 ? one : n === 2 ? `${many} twice` : `${many} ${n} times`);
  // a line or two that sums up a stretch of a hero's days, built from the stories in it
  function gapSummary(h, list, days) {
    const of = (ks) => list.filter((e) => ks.includes(e.kind));
    const bits = [];
    const died = of(["death"]).find((e) => (e.heroes || [])[0] === h.id);
    for (const e of of(["evolve"])) if ((e.heroes || [])[0] === h.id && e.cls_to) bits.push(`became ${/^[aeiou]/i.test(A.clsName(e.cls_to)) ? "an" : "a"} ${A.clsName(e.cls_to)}`);
    for (const e of of(["keystone"])) if ((e.heroes || [])[0] === h.id && e.ks) bits.push(`gained the keystone ${e.ks}`);
    const lv = of(["levelups"]).length;
    if (lv) bits.push(times(lv, "levelled up", "levelled up"));
    const joined = of(["party_join", "party_formed"]).find((e) => (e.parties || []).length);
    if (joined && parties[joined.parties[0]]) bits.push(`${joined.kind === "party_formed" ? "helped found" : "joined"} ${parties[joined.parties[0]].name}`);
    if (of(["party_leave"]).length) bits.push("went their own way from a party");
    if (of(["boss_kill"]).length) bits.push("brought down a boss");
    const fights = of(FIGHT_KINDS).length;
    if (fights) bits.push(fights === 1 ? "fought once" : `fought ${fights} times`);
    if (of(["song"]).length && !died) bits.push("got a song");
    if (of(["vow_kept"]).length) bits.push("kept a vow");
    const bonds = of(["bond"]).length;
    if (bonds) bits.push(bonds === 1 ? "made a new bond" : `made ${bonds} new bonds`);
    const top = bits.slice(0, died ? 4 : 5);
    if (died) top.push(`fell on ${A.when(died.day, true)}`);
    if (!top.length) return null;
    const shown = top;
    const line = shown.length > 1 ? shown.slice(0, -1).join(", ") + " and " + shown[shown.length - 1] : shown[0];
    return `In ${plural(days, "day")}, ${h.name} ${line}.`;
  }
  function catchUp(h, today) {
    const key = "al.seen." + h.id;
    let last = null;
    try { last = +localStorage.getItem(key) || null; localStorage.setItem(key, String(today)); } catch (e) { /* storage unavailable */ }
    const from = last && last < today ? last : today - 1, gap = today - from;
    const box = el("div", { class: "catchup" });
    const fill = (all, d) => {
      box.innerHTML = "";
      const mineEv = all.filter((e) => (e.heroes || []).includes(h.id));
      const inGap = mineEv.filter((e) => e.day > from && e.imp >= 2).sort((a, b) => a.day - b.day || idNum(a.id) - idNum(b.id));
      box.appendChild(el("div", { class: "small gold" }, gap > 1 ? `Since you last checked in (${plural(gap, "day")} ago):` : "Since yesterday:"));
      if (h.alive === false && h.died_day && h.died_day <= from) {
        const cause = (d || {}).death_cause;
        box.appendChild(el("p", { class: "small" }, `${h.name} fell on ${A.when(h.died_day, true)}${cause ? ", " + cause : ""}. The league remembers: `,
          el("a", { href: `#/hero/${h.id}` }, "their story and their song →")));
        return;
      }
      const sum = gap >= 3 ? gapSummary(h, mineEv.filter((e) => e.day > from), gap) : null;
      if (sum) box.appendChild(el("p", { class: "catchup-sum" }, sum));
      // a long gap shows its big moments first; the rest wait behind a button, still in order
      const big = inGap.length > 10 ? inGap.filter((e) => e.imp >= 3).slice(-12) : inGap;
      const empty = h.alive === false ? `${h.name} is gone, and the league is quieter for it.` : `${h.name} had a quiet time${h.doing ? ", " + h.doing : ""}.`;
      box.appendChild(A.feed(big, { dayHeaders: gap > 1, empty }));
      if (big.length < inGap.length) {
        const rest = el("div", { hidden: true }, A.feed(inGap, { dayHeaders: true }));
        box.appendChild(el("button", { class: "btn small", onclick: (ev) => { rest.hidden = !rest.hidden; big.length && (box.querySelector(".feed").hidden = !rest.hidden); ev.target.textContent = rest.hidden ? `Show all ${inGap.length}` : "Just the big moments"; } }, `Show all ${inGap.length}`));
        box.appendChild(rest);
      }
      if (h.alive !== false && gap <= 1) {
        const week = mineEv.filter((e) => e.day > today - 7);
        const k = (ks) => week.filter((e) => ks.includes(e.kind)).length;
        const bits = [k(FIGHT_KINDS) && plural(k(FIGHT_KINDS), "fight"), k(["levelups"]) && "levelled up", k(["bond", "feud", "showdown"]) && "made the gossip pages",
          k(["song"]) && "got a song", k(["fame"]) && "got recognised in the street"].filter(Boolean);
        if (bits.length) box.appendChild(el("p", { class: "small muted", style: { marginTop: "6px" } }, `This week, ${h.name} ${bits.join(", ")}.`));
      }
    };
    fill(L.events);
    // the front page only carries two weeks of small news; the hero's own file has the whole gap
    if (gap > 1 || h.alive === false) A.load(`hero/${h.id}`).then((d) => { if (box.isConnected) fill((d.events || []).map((x) => (typeof x === "string" ? events[x] : x)).filter(Boolean), d); }, () => {});
    return box;
  }
})();
