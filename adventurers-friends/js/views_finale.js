/* The season finale ceremony (#/finale, #/finale/<n>) and each hero's Your Season card (#/finale/<n>/<hero>). */
(function () {
  const A = App;
  const { L, cap, el, events, heroes, parties, plural } = A;
  const { panel, rivalryPanel, runnerUp } = Views;
  A.needs(/^\/finale/, A.PLACES.concat(["mount_art", "music_replay", "finale_party", "ceremony_replay"]));
  const calm = () => !!(window.Settings && Settings.calm());
  const sfx = (k) => { if (window.Sound) Sound.sfx(k); };
  const num = (v) => Number(v || 0).toLocaleString("en-US");
  const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const valueText = (a) => `${num(a.value)}${a.unit ? " " + a.unit : ""}`;
  // the night happens where the party's vignettes put it (league/ceremony.py), else where the finale record says
  const townOf = (s, fin) => (s.party && s.party.town) || (fin && fin.venue) || null;

  // a visitor who has opened a season's envelopes once (or skipped them) gets the results straight away after that
  const seenKey = (n) => `al.finale.${(L.meta && L.meta.name) || "league"}.${n}`;
  function seen(n) { try { return localStorage.getItem(seenKey(n)) === "1"; } catch (e) { return false; } }
  function markSeen(n) { try { localStorage.setItem(seenKey(n), "1"); } catch (e) { /* storage unavailable */ } }

  // ---------- small art: the wax seal, the ballot box, a hero as they were on a day ----------
  let sealGrid = null;
  function waxSeal(scale, cls) {
    if (!sealGrid) {
      const g = new Art.Grid(26, 26), C = 12.5;
      for (let y = 0; y < 26; y++) for (let x = 0; x < 26; x++) {
        const a = Math.atan2(y - C, x - C), d = Math.hypot(x - C, y - C), r = 11 + Math.sin(a * 7) * 0.7 + Math.sin(a * 3 + 1) * 0.5;
        if (d > r) continue;
        const l = (-(x - C) - (y - C)) / (d || 1);
        let c = d > r - 1.2 ? (l > 0.3 ? "#c8463a" : "#7a1e1a") : d > 8.2 && d < 9.4 ? (l > 0 ? "#6a1414" : "#d05a48") : l > 0.5 && d < 8 ? "#c8463a" : "#a82a24";
        if (d < 8.2) c = (x + y) % 9 === 0 ? "#b8382e" : c;
        g.set(x, y, c);
      }
      const CROWN = ["#...#...#", "#...#...#", "##.###.##", "#########", "#########", ".........", "#########"];
      for (const [dy, c] of [[1, "#5a1010"], [0, "#e8806a"]]) CROWN.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === "#") g.set(8 + i, 9 + j + dy, c); }));
      g.outline("#3a0c08");
      sealGrid = g;
    }
    const cv = sealGrid.toCanvas(scale || 3);
    cv.className = "wax-seal " + (cls || "");
    cv.setAttribute("aria-hidden", "true");
    return cv;
  }
  let boxGrid = null;
  function ballotBox(scale) {
    if (!boxGrid) {
      const g = new Art.Grid(30, 28);
      for (let y = 8; y < 26; y++) for (let x = 2; x < 28; x++) g.set(x, y, y === 8 ? "#c8904a" : x === 2 ? "#b07a44" : x === 27 ? "#4a2a12" : y === 25 ? "#3a2010" : (x - 2) % 8 === 0 ? "#5a3418" : y < 11 ? "#a06a3a" : "#8a5a2a");
      for (let x = 2; x < 28; x++) { g.set(x, 12, "#c8902a"); g.set(x, 22, "#c8902a"); }
      for (let x = 10; x < 20; x++) g.set(x, 9, "#1e120a");
      for (let y = 1; y < 10; y++) for (let x = 12; x < 19; x++) g.set(x, y, x === 18 || y === 9 ? "#c8b898" : "#f6eedc");
      for (let k = 0; k < 4; k++) { g.set(14 + k, 3 + k, "#8a2a24"); g.set(17 - k, 3 + k, "#8a2a24"); }
      g.outline("#2a1a0e");
      boxGrid = g;
    }
    const cv = boxGrid.toCanvas(scale || 3);
    cv.className = "ballot-box";
    cv.setAttribute("aria-hidden", "true");
    return cv;
  }
  // a hero as a Then-and-Now snapshot shows them: that day's look, class and level, without the gear they have since
  // (a snapshot from before today has no record of the kit, so it shows the class's own outfit)
  function snapPortrait(id, snap, scale, then, cls) {
    const h = heroes[id];
    if (!h || !snap) return h ? A.heroPortrait(h, scale, { noGray: true, cls }) : null;
    const x = Object.assign({}, h, { look: snap.look || h.look, cls: snap.cls || h.cls, level: snap.level || h.level, alive: true });
    if (then || snap.day !== L.meta.day) Object.assign(x, { kit: null, weapon_tier: 1, armor_tier: 1 });
    return A.heroPortrait(x, scale, { noGray: true, cls });
  }
  const who = (id) => (heroes[id] ? A.heroLink(id) : el("span", null, "someone"));

  // ---------- the Crier's odds: a bookie's chalkboard (no wagers on the page, just the Crier's prices) ----------
  const VERDICT = { called_it: ["Called it", "called"], upset: ["Upset", "upset"], fair: ["Fair call", "fair"], field: ["The field", "field"], no_award: ["Not given", "none"] };
  function oddsBoard(odds, opts) {
    if (!odds || !(odds.boards || []).length) return null;
    const o = opts || {}, judged = !!o.judged;
    const nameOf = (x) => (x.hero && heroes[x.hero] ? A.heroLink(x.hero) : x.party && parties[x.party] ? A.partyLink(x.party) : el("span", null, x.name));
    const boards = odds.boards.map((b) => {
      const won = new Set(judged ? b.winner || [] : []);
      const rows = b.entries.map((x) => el("li", { class: won.has(x.hero || x.party) ? "won" : "" }, el("span", { class: "chalk-name" }, nameOf(x)),
        el("span", { class: "chalk-dots", "aria-hidden": "true" }), el("b", { class: "chalk-odds", title: `${Math.round(x.p * 100)}% by the Crier's reckoning` }, x.odds)));
      if (b.field) rows.push(el("li", { class: "field" + (judged && b.verdict === "field" ? " won" : "") }, el("span", { class: "chalk-name" }, "the field"), el("span", { class: "chalk-dots", "aria-hidden": "true" }), el("b", { class: "chalk-odds" }, b.field)));
      const v = judged && b.verdict ? VERDICT[b.verdict] || [b.verdict, ""] : null;
      return el("div", { class: "chalk-board" }, el("h4", null, b.name, b.unit ? el("span", { class: "chalk-unit" }, ` · most ${b.unit}`) : null),
        el("ul", null, rows), v ? el("div", { class: `chalk-verdict v-${v[1]}` }, el("span", { class: "chalk-stamp" }, v[0]), b.text ? el("span", null, A.storyText(b.text.replace(/^[A-Z ]+:\s*/, ""))) : null) : null);
    });
    const when = o.live ? `Posted on day ${odds.sday} of ${L.meta.season_length || 30}, with ${plural(odds.left, "day")} to go.` : `As posted on day ${odds.sday}, ${plural(odds.left, "day")} out${judged ? ", and how it went" : ""}.`;
    return el("section", { class: "panel chalk" }, el("div", { class: "chalk-frame" },
      el("div", { class: "chalk-head" }, el("span", { class: "chalk-title" }, "The Crier's Odds"), el("span", { class: "chalk-when" }, when)),
      el("div", { class: "chalk-boards" }, boards),
      el("p", { class: "chalk-foot" }, judged ? "The Crier writes the prices from the table as it stood. Long shots are real." : "The Crier's own prices, from the table as it stands. Long shots are real. Nobody here takes bets.")));
  }

  // ---------- one hero's card in the final table (the reveal and the results share it) ----------
  function honourBit(fin, id) {
    const hon = fin && fin.honours && (fin.honours.heroes || {})[id];
    if (!hon) return null;
    return el("div", { class: `fin-honour tone-${hon.tone}`, title: hon.deed ? cap(hon.deed) + "." : "" }, Trophies.canvas("honour", 1, hon.id, hon.tone), el("span", null, hon.title));
  }
  function awardBits(s, id, party) {
    const list = party ? (s.party_awards || []).filter((a) => a.party === id && a.id !== "party_mvp") : (s.awards || []).filter((a) => a.hero === id && a.id !== "mvp");
    return list.map((a) => el("div", { class: "fin-award", title: `${a.rules ? cap(a.rules) + " · " : ""}${valueText(a)}` }, Trophies.canvas(a.id, 1), el("span", null, a.name)));
  }
  function heroCard(s, fin, r, rank) {
    const h = heroes[r.hero];
    const line = (s.lines || {})[r.hero];
    return el("article", { class: "fin-card" + (r.alive === false ? " fallen" : "") },
      el("div", { class: "fin-rank" }, el("b", null, rank), el("span", null, ord(rank).replace(/^\d+/, ""))),
      snapPortrait(r.hero, fin && fin.bundles && fin.bundles[r.hero] && fin.bundles[r.hero].portrait, 2, false, "fin-face"),
      el("div", { class: "fin-body" },
        el("div", { class: "fin-name" }, A.heroLink(h.id), r.alive === false ? " ✝" : null, el("span", { class: "tiny dim" }, h.npc ? " · league hero" : ` · ${h.owner}'s`)),
        el("div", { class: "tiny muted" }, `Lv ${r.level} ${A.clsName(r.cls)} · `, el("b", { class: "gold" }, num(r.renown)), " renown"),
        awardBits(s, r.hero), honourBit(fin, r.hero),
        line ? el("p", { class: "fin-line small" }, A.storyLine(line)) : null,
        fin && (fin.bundles || {})[r.hero] ? el("a", { class: "tiny fin-yours", href: `#/finale/${s.season}/${r.hero}` }, "Your season card ›") : null));
  }
  function crownCard(s, fin, ids) {
    const mvp = s.awards.find((a) => a.id === "mvp");
    const champs = ids.filter((id) => heroes[id]);
    if (!champs.length) return null;
    const one = heroes[champs[0]], row = (s.standings || []).find((r) => r.hero === one.id);
    const toast = fin && (fin.toasts || {}).heroes && fin.toasts.heroes[one.id];
    const frame = el("a", { href: `#/hero/${one.id}`, class: "laurel-frame" }, Art.laurelGrid().toCanvas(5), snapPortrait(one.id, fin && fin.bundles && fin.bundles[one.id] && fin.bundles[one.id].portrait, 5, false, "champ"));
    return el("section", { class: "panel laurel fin-crown" },
      el("div", { class: "finale-kicker" }, champs.length > 1 ? "Heroes of the Season (a dead heat)" : "Hero of the Season"),
      frame,
      el("h2", { class: "champ-name" }, champs.map((id, i) => [i ? " & " : "", heroes[id].name])),
      one.epithet ? el("div", { class: "epi" }, one.epithet) : null,
      el("p", { class: "small muted" }, `${one.npc ? "League hero" : one.owner + "'s hero"} · Lv ${(row || one).level} ${row ? A.clsName(row.cls) : one.title} · ${mvp ? num(mvp.value) : "?"} renown`),
      awardBits(s, one.id).length ? el("div", { class: "fin-crown-awards" }, awardBits(s, one.id)) : null,
      (s.lines || {})[one.id] ? el("p", { class: "fin-line" }, A.storyLine(s.lines[one.id])) : null,
      toast ? el("blockquote", { class: "fin-toast small" }, A.richText(toast.line, [toast.by, toast.hero].filter(Boolean))) : null,
      fin && (fin.bundles || {})[one.id] ? el("a", { class: "btn small", href: `#/finale/${s.season}/${one.id}` }, "Your season card ›") : null);
  }
  function partyCard(s, fin) {
    const pa = (s.party_awards || []).find((a) => a.id === "party_mvp"), p = pa && parties[pa.party];
    if (!p) return null;
    const grp = el("div", { class: "row fin-crew" }, p.members.filter((m) => heroes[m]).map((m) => el("a", { href: `#/hero/${m}`, title: heroes[m].name }, A.heroPortrait(heroes[m], 2))));
    const toast = fin && (fin.toasts || {}).crews && fin.toasts.crews[p.id];
    return el("section", { class: "panel laurel fin-party" },
      el("div", { class: "finale-kicker" }, "Party of the Season"),
      el("a", { href: `#/party/${p.id}`, class: "fin-banner" }, A.bannerSprite(p.banner, 6, "")),
      el("h2", { class: "champ-name" }, p.name), grp,
      el("p", { class: "small muted" }, `${cap(p.disposition)} · ${num(pa.value)} renown`),
      awardBits(s, p.id, true).length ? el("div", { class: "fin-crown-awards" }, awardBits(s, p.id, true)) : null,
      toast ? el("blockquote", { class: "fin-toast small" }, A.richText(toast.line, [toast.by].filter(Boolean), [p.id])) : null);
  }
  function crewTable(s) {
    const rows = (s.parties || []).filter((r) => parties[r.party] || r.name);
    if (!rows.length) return null;
    return el("ol", { class: "fin-crews" }, rows.map((r, i) => el("li", null, el("span", { class: "fin-crews-n" }, i + 1), parties[r.party] ? A.bannerSprite(parties[r.party].banner, 1) : null,
      parties[r.party] ? A.partyLink(r.party) : el("span", null, r.name), el("span", { class: "gold tiny" }, `${num(r.renown)} renown`))));
  }

  // ---------- pixel leaves for the crown ----------
  function confetti(host) {
    if (calm()) return;
    const cv = document.createElement("canvas"), k = 3;
    cv.className = "fin-confetti";
    host.appendChild(cv);
    const w = Math.ceil(host.clientWidth / k), h = Math.ceil(host.clientHeight / k);
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d"), cols = ["#4e8a3e", "#6aa84a", "#2e5a28", "#e8b84a", "#c8902a", "#c8463a"];
    const bits = Array.from({ length: 70 }, (_, i) => ({ x: Math.random() * w, y: -Math.random() * h * 0.8, v: 10 + Math.random() * 14, s: Math.random() * 6, c: cols[i % cols.length], leaf: i % 3 !== 0 }));
    let t0 = 0;
    const tick = (ms) => {
      if (!cv.isConnected) return;
      if (!t0) t0 = ms;
      const t = (ms - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const b of bits) {
        const y = b.y + b.v * t, x = b.x + Math.sin(t * 2 + b.s) * 3;
        if (y > h) continue;
        const X = Math.round(x), Y = Math.round(y), flip = Math.sin(t * 5 + b.s) > 0 ? 1 : -1;
        ctx.fillStyle = b.c; ctx.fillRect(X, Y, 2, 1);
        if (b.leaf) { ctx.fillRect(X + (flip > 0 ? 1 : 0), Y + 1, 2, 1); ctx.fillStyle = "#1e3a14"; ctx.fillRect(X + (flip > 0 ? 3 : -1), Y + 1, 1, 1); }
      }
      if (t < 9) requestAnimationFrame(tick); else cv.remove();
    };
    requestAnimationFrame(tick);
  }

  // ---------- the envelopes: sealed, read from the bottom up, or the results straight away ----------
  function results(s, fin, onAgain) {
    const rows = (s.standings || []).filter((r) => heroes[r.hero]);
    const mvpEnv = fin && (fin.ceremony || []).find((x) => x.award === "mvp");
    const mvp = s.awards.find((a) => a.id === "mvp");
    const champs = mvp ? [mvp.hero].concat((mvpEnv && mvpEnv.co) || []) : [];
    const box = el("div", { class: "fin-results" });
    const crown = crownCard(s, fin, champs), party = partyCard(s, fin);
    if (crown || party) box.appendChild(el("div", { class: "grid2 even fin-spot" }, crown, party));
    const table = el("div", { class: "fin-table" }, rows.filter((r) => !champs.includes(r.hero)).map((r) => heroCard(s, fin, r, rows.indexOf(r) + 1)));
    const crews = crewTable(s);
    box.appendChild(panel("The final table", el("p", { class: "small muted" }, "Every hero, from the top. Each one gets a line, and most get a trophy or an honour."), table,
      crews ? [el("h4", { style: { marginTop: "12px" } }, "The crews"), crews] : null,
      onAgain ? el("p", { class: "small", style: { marginTop: "8px" } }, el("button", { class: "btn small", type: "button", onclick: onAgain }, "▶ Open the envelopes again")) : null));
    return box;
  }
  function sealed(s, fin, onOpen, onSkip) {
    return el("section", { class: "panel fin-scroll" },
      el("div", { class: "fin-scroll-rod top", "aria-hidden": "true" }),
      el("div", { class: "fin-scroll-body" },
        el("div", { class: "finale-kicker" }, "Sealed on the season's last night"),
        el("h2", null, "The envelopes"),
        el("p", null, `Inside: the final table of ${plural((s.standings || []).length, "hero")}, read from the bottom up. Then the Party of the Season. Then the Hero of the Season.`),
        waxSeal(4, "big"),
        el("div", { class: "row wrap fin-scroll-btns" },
          el("button", { class: "btn primary big", type: "button", onclick: onOpen }, "Break the seal"),
          el("button", { class: "btn small fin-skip", type: "button", onclick: onSkip }, "Skip to results"))),
      el("div", { class: "fin-scroll-rod bottom", "aria-hidden": "true" }));
  }
  // the countdown: one face-down envelope at a time, turned over, from last place up; then the crew, then the crown
  // the order the envelopes open in: every hero but the champions from last place up, the Party of the Season, then the crown
  function revealPlan(s, fin) {
    const rows = (s.standings || []).filter((r) => heroes[r.hero]);
    const mvpEnv = fin && (fin.ceremony || []).find((x) => x.award === "mvp");
    const mvp = (s.awards || []).find((a) => a.id === "mvp");
    const champs = mvp ? [mvp.hero].concat((mvpEnv && mvpEnv.co) || []) : [rows[0] && rows[0].hero].filter(Boolean);
    const pa = (s.party_awards || []).find((a) => a.id === "party_mvp");
    const order = rows.filter((r) => !champs.includes(r.hero)).reverse();
    return { rows, champs, order, steps: order.map((r) => ({ kind: "hero", hero: r.hero, rank: rows.indexOf(r) + 1 }))
      .concat(pa && parties[pa.party] ? [{ kind: "party", party: pa.party }] : [], [{ kind: "crown", heroes: champs }]) };
  }
  function countdown(s, fin, done) {
    const { rows, champs, order } = revealPlan(s, fin);
    const box = el("section", { class: "panel fin-count" });
    const list = el("div", { class: "fin-deck" });
    const status = el("span", { class: "small muted" });
    let i = 0, timer = 0, over = false;
    const next = el("button", { class: "btn small", type: "button" }, "Next ▸");
    const skip = el("button", { class: "btn small fin-skip", type: "button" }, "Skip to results");
    // the controls ride under the newest card, where the reader's eye already is
    box.append(el("h2", null, "The final table, from the bottom up"), list, el("div", { class: "row wrap fin-count-ctl" }, status, next, skip));
    const scroll = (n) => { const r = n.getBoundingClientRect(); if (r.bottom > innerHeight - 40 || r.top < 60) n.scrollIntoView({ block: "center", behavior: "smooth" }); };
    function flip(face, back, sound) {
      const card = el("div", { class: "fin-flip" }, el("div", { class: "fin-flip-in" }, el("div", { class: "fin-back" }, waxSeal(2), back), el("div", { class: "fin-front" }, face)));
      list.appendChild(card);
      scroll(card);
      setTimeout(() => { if (!card.isConnected) return; card.classList.add("flipped"); sfx(sound); }, 380);
      return card;
    }
    function step() {
      if (over || !box.isConnected) return;
      clearTimeout(timer);
      if (i < order.length) {
        const r = order[i], rank = rows.indexOf(r) + 1, hon = fin && fin.honours && (fin.honours.heroes || {})[r.hero];
        const hasAward = s.awards.some((a) => a.hero === r.hero);
        flip(heroCard(s, fin, r, rank), el("span", { class: "fin-back-label" }, `${ord(rank)} place`), hon && hon.tone === "tease" && !hasAward ? "sting" : hasAward || hon ? "fanfare" : "envelope");
        status.textContent = `${rows.length - rank + 1} of ${rows.length}`;
        i++;
        timer = setTimeout(step, rank > 6 ? 1500 : 2600);
        return;
      }
      if (i === order.length) {
        i++;
        const p = partyCard(s, fin);
        if (p) { const c = flip(p, el("span", { class: "fin-back-label" }, "Party of the Season"), "fanfare"); c.classList.add("big"); timer = setTimeout(step, 3400); return; }
      }
      finish(true);
    }
    function finish(withCrown) {
      if (over) return;
      over = true;
      clearTimeout(timer);
      next.hidden = skip.hidden = true;
      status.textContent = "";
      const crown = crownCard(s, fin, champs);
      if (crown) {
        list.appendChild(crown);
        if (withCrown) { crown.classList.add("arrive"); scroll(crown); sfx("crown"); setTimeout(() => confetti(crown), 900); }
      }
      done(withCrown);
    }
    next.onclick = step;
    skip.onclick = () => done(false, true);
    setTimeout(step, 250);
    return box;
  }

  // ---------- Ceremony Night: the envelopes on stage ----------
  const ROLE = { barkeep: "the barkeep", smith: "the smith", guard: "the watch captain", priest: "the priest", merchant: "the merchant", special: "a local", undertaker: "the undertaker" };
  function presenterLine(p) {
    if (!p) return "The presenter";
    if (p.kind === "champion") return `${p.name}, ${p.party ? "who led last season's best crew" : "last season's Hero of the Season"},`;
    if (p.kind === "nib") return "Nib the goblin, who was not invited,";
    return `${cap(p.name)}, ${ROLE[p.role] || "a local"}${p.town ? " of " + A.nodeName(p.town) : ""},`;
  }
  function envWinner(env) { return env.kind === "party" ? (parties[env.winner] || {}).name || "a crew" : [env.winner].concat(env.co || []).map((id) => (heroes[id] || {}).name || "someone").join(" and "); }
  function nightPanel(s, fin) {
    if (!window.CeremonyReplay || !(fin && (fin.ceremony || []).length)) return null;
    const cap0 = el("div", { class: "cn-kicker finale-kicker" }), lines = el("div", { class: "cn-lines" });
    const chips = el("div", { class: "cn-chips" });
    const playBtn = el("button", { class: "btn small", type: "button" }, "❚❚ Pause");
    let st = null;
    const caption = (i, beat) => {
      const env = fin.ceremony[i];
      cap0.textContent = `Envelope ${i + 1} of ${fin.ceremony.length} · ${env.name}`;
      cap0.title = env.rules ? cap(env.rules) : "";
      const ids = (env.kind === "party" ? [] : [env.winner].concat(env.co || [])).concat(env.presenter && env.presenter.hero ? [env.presenter.hero] : []);
      const pids = env.kind === "party" ? [env.winner] : [];
      const ru = env.runner_up, ruName = ru ? (ru.hero ? (heroes[ru.hero] || {}).name : (parties[ru.party] || {}).name) : null;
      const rows = [el("p", { class: "cn-read" }, A.richText(`${presenterLine(env.presenter)} opens the envelope.`, ids, pids))];
      if (beat >= 1) rows.push(el("p", { class: "cn-call" }, A.richText(`“And ${env.name.replace(/^The /, "the ")} goes to… ${envWinner(env)}!”`, ids, pids),
        el("span", { class: "tiny dim" }, ` ${valueText(env)}${ruName ? ` · runner-up ${ruName}, ${num(ru.value)}` : ""}`)));
      if (beat >= 2 && env.quip) rows.push(el("p", { class: "cn-quip" }, A.richText(env.quip, ids, pids)));
      if (beat >= 3 && env.crowd && env.crowd.line) rows.push(el("p", { class: "cn-crowd small muted" }, A.richText(env.crowd.line, Object.keys(heroes), Object.keys(parties))));
      lines.replaceChildren(...rows);
      [...chips.children].forEach((c, k) => c.classList.toggle("on", k === i));
    };
    st = CeremonyReplay.stage(Object.assign({}, fin, { venue: townOf(s, fin) }), s.standings || [], {
      onBeat: (i, beat, from) => { caption(i, beat); if (beat === 1 && from === 0) sfx(fin.ceremony[i].award === "mvp" ? "crown" : "fanfare"); },
      onEnvelope: (i) => caption(i, 0),
    });
    if (!st) return null;
    fin.ceremony.forEach((env, i) => chips.appendChild(el("button", { class: "cn-chip", type: "button", title: `${env.name}: ${envWinner(env)}`, onclick: () => { st.play(true); syncPlay(); st.show(i); } },
      Trophies.canvas(env.award, 1), el("span", null, env.name))));
    const syncPlay = () => { playBtn.textContent = st.playing ? "❚❚ Pause" : "▶ Play"; };
    playBtn.onclick = () => { st.play(!st.playing); syncPlay(); };
    caption(0, calm() ? 3 : 0);
    return panel("Ceremony Night", el("p", { class: "small muted" }, `The envelopes, opened on the stage in ${A.nodeName(townOf(s, fin))}: the small trophies first, then the Party and the Hero of the Season. Tap an envelope to see it again.`),
      el("figure", { class: "cn" }, st.cv, el("figcaption", null, cap0, lines)),
      el("div", { class: "row wrap cn-controls" }, calm() ? null : playBtn), chips);
  }

  // a caption whose hero names the sim placed itself ([start, length, hero]): only those link, so a mount named like a hero stays a mount
  function linked(text, links, pids) {
    const out = [];
    let at = 0;
    for (const [i, n, id] of links.slice().sort((a, b) => a[0] - b[0])) {
      if (i < at || !heroes[id]) continue;
      out.push(...A.richText(text.slice(at, i), [], pids), A.heroLink(id));
      at = i + n;
    }
    out.push(...A.richText(text.slice(at), [], pids));
    return out;
  }

  // ---------- the program after the crown ----------
  function partyPanel(s) {
    const fete = s.party && window.FinaleParty ? s.party.scenes.map((sc, i) => {
      const cv = FinaleParty.scene(sc, s.party.town, s.season * 101 + i * 17);
      if (!cv) return null;
      const pids = (sc.crews || []).map((c) => c.party);
      return el("figure", { class: `party-vig party-${sc.kind}` }, cv,
        el("figcaption", null, el("span", { class: "finale-kicker" }, FinaleParty.TITLES[sc.kind]), el("span", { class: "small" }, sc.links ? linked(sc.caption, sc.links, pids) : A.richText(sc.caption, sc.heroes.concat(sc.owners || []), pids))));
    }).filter(Boolean) : [];
    return fete.length ? panel("The party", el("p", { class: "small muted" }, "The season is done and the whole league is in. Everyone still standing is here somewhere."), el("div", { class: "party-grid" }, fete)) : null;
  }
  function speaker(t) {
    if (t.by_kind === "hero" && heroes[t.by]) return A.heroPortrait(heroes[t.by], 1, { cls: "mini" });
    if (t.by_kind === "pet") { const h = heroes[t.hero]; return h && h.pet ? A.petSprite(h.pet, 1) : null; }
    return el("span", { class: "sp-keeper", "aria-hidden": "true" }, "🍺");
  }
  function speechesPanel(s, fin) {
    const T = fin && fin.toasts;
    if (!T) return null;
    const crews = Object.values(T.crews || {}).filter((t) => parties[t.party]);
    const order = (s.standings || []).map((r) => r.hero);
    const hs = Object.values(T.heroes || {}).filter((t) => heroes[t.hero]).sort((a, b) => order.indexOf(a.hero) - order.indexOf(b.hero));
    if (!crews.length && !hs.length) return null;
    const crewEls = crews.map((t) => el("div", { class: "sp sp-crew" }, A.bannerSprite(parties[t.party].banner, 2),
      el("div", null, el("div", { class: "tiny sp-who" }, heroes[t.by] ? A.heroLink(t.by) : t.by_name, " to ", A.partyLink(t.party)),
        el("p", { class: "small" }, A.richText(t.line, [t.by].filter(Boolean), [t.party])), A.storyLink(t.event) ? el("div", { class: "tiny" }, A.storyLink(t.event)) : null)));
    const heroEls = hs.map((t) => el("div", { class: `sp sp-${t.kind}` },
      el("div", { class: "sp-pair" }, speaker(t), el("span", { class: "sp-arrow", "aria-hidden": "true" }, "→"), A.heroPortrait(heroes[t.hero], 1, { cls: "mini", noGray: true })),
      el("div", null, el("div", { class: "tiny sp-who" }, el("span", { class: `sp-tag t-${t.kind}` }, t.kind), " ", t.by && heroes[t.by] ? A.heroLink(t.by) : t.by_name, " on ", A.heroLink(t.hero)),
        el("p", { class: "small" }, A.richText(t.line, [t.by, t.hero].filter(Boolean))), A.storyLink(t.event) ? el("div", { class: "tiny" }, A.storyLink(t.event)) : null)));
    return panel("Speeches", el("p", { class: "small muted" }, "Each crew's leader raises a glass to the crew. Then every hero gets a toast or a roast from whoever knows them best."),
      crewEls.length ? el("div", { class: "sp-grid crews" }, crewEls) : null, el("div", { class: "sp-grid" }, heroEls));
  }
  function votePanel(fin) {
    const v = fin && fin.vote;
    if (!v || !v.winner || !heroes[v.winner]) return null;
    const top = (v.top || []).filter((x) => heroes[x.hero]);
    const gossip = (v.gossip || []).map((g) => el("li", null, el("span", { class: "vote-faces" }, (g.heroes || []).filter((id) => heroes[id]).slice(0, 2).map((id) => A.heroPortrait(heroes[id], 1, { cls: "mini" }))),
      el("span", null, A.richText(g.line, g.heroes || []))));
    return panel("The Heroes' Choice",
      el("div", { class: "vote" }, el("div", { class: "vote-box" }, ballotBox(3), el("div", { class: "tiny dim" }, `${plural(v.voters, "ballot")} cast`)),
        el("div", { class: "vote-body" },
          el("p", { class: "small muted" }, "Every hero names three: 3 points for the best season they saw, 2 for the next, 1 for the third. Friends vote for friends; some put themselves first."),
          el("div", { class: "vote-top" }, top.map((x, i) => el("a", { class: "vote-pick" + (i === 0 ? " first" : ""), href: `#/hero/${x.hero}` }, A.heroPortrait(heroes[x.hero], i === 0 ? 3 : 2),
            el("b", null, heroes[x.hero].name), el("span", { class: "tiny" }, `${plural(x.points, "point")}${x.firsts ? ` · ${plural(x.firsts, "first place")}` : ""}`)))),
          top.length > 1 && top[0].points === top[1].points ? el("p", { class: "tiny dim" }, `A tie on ${plural(top[0].points, "point")}: ${top[0].firsts !== top[1].firsts ? "more first places takes it" : "it goes to whoever finished higher in the table"}.`) : null,
          gossip.length ? el("ul", { class: "vote-gossip small" }, gossip) : null)));
  }
  function yearbookPanel(s, fin) {
    const H = (fin && fin.honours) || {};
    const order = (s.standings || []).map((r) => r.hero);
    const hs = Object.entries(H.heroes || {}).filter(([id]) => heroes[id]).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    const cs = Object.entries(H.crews || {}).filter(([id]) => parties[id]);
    if (!hs.length && !cs.length) return null;
    const card = (art, face, name, hon) => el("article", { class: `yb-card tone-${hon.tone}`, title: hon.tone === "tease" ? "Said with love" : "" },
      el("div", { class: "yb-art" }, face, el("span", { class: "yb-ribbon" }, Trophies.canvas("honour", 1, hon.id, hon.tone))),
      el("div", { class: "yb-body" }, el("div", { class: "tiny yb-name" }, name), el("b", { class: "yb-title" }, hon.title),
        hon.deed ? el("p", { class: "tiny muted" }, cap(hon.deed) + ".") : null, A.storyLink(hon.event)));
    return panel("Honours", el("p", { class: "small muted" }, "A trophy for everyone the trophies missed: one true thing from each hero's season, and from each crew's."),
      el("div", { class: "yb-grid" }, hs.map(([id, hon]) => card(null, A.heroPortrait(heroes[id], 2, { noGray: true }), A.heroLink(id), hon)),
        cs.map(([id, hon]) => card(null, A.bannerSprite(parties[id].banner, 2), A.partyLink(id), hon))));
  }
  function outtakesPanel(fin) {
    const xs = ((fin && fin.outtakes) || []).filter((e) => heroes[e.hero]);
    if (!xs.length) return null;
    return panel("Outtakes", el("p", { class: "small muted" }, "The bits that didn't make the songs."),
      el("div", { class: "film" }, xs.map((e) => el("figure", { class: "film-frame" }, A.vignette(Object.assign({}, events[e.id] || {}, e), 160, 90, "film-scene"),
        el("figcaption", null, el("b", { class: "tiny" }, heroes[e.hero].name, el("span", { class: "dim" }, ` · day ${e.sday || "?"}`)), el("span", { class: "tiny" }, A.storyLine(e)))))));
  }
  function thenNowPanel(s, fin) {
    const T = fin && fin.then_now;
    if (!T) return null;
    const order = (s.standings || []).map((r) => r.hero);
    const rows = Object.entries(T).filter(([id, x]) => heroes[id] && x.then && x.now).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    if (!rows.length) return null;
    const approx = rows.some(([, x]) => x.then.approx);
    return panel("Then and now", el("p", { class: "small muted" }, "Who walked in on the first day, and who walked out on the last.", approx ? " (This season's first days are pieced together from the records.)" : ""),
      el("div", { class: "tn-grid" }, rows.map(([id, x]) => el("article", { class: "tn" },
        el("b", { class: "tn-name" }, A.heroLink(id)),
        el("div", { class: "tn-pics" }, el("figure", null, snapPortrait(id, x.then, 2, true), el("figcaption", { class: "tiny dim" }, `Day ${x.then.day ? A.seasonOf(x.then.day)[1] : 1}`)),
          el("span", { class: "tn-arrow", "aria-hidden": "true" }, "▸"), el("figure", null, snapPortrait(id, x.now, 2), el("figcaption", { class: "tiny dim" }, "Now"))),
        el("ul", { class: "tiny tn-list" }, (x.changes || []).map((c) => el("li", null, c)))))));
  }
  function songPanel(s, fin) {
    const sg = fin && fin.song;
    if (!sg) return null;
    const songs = L.songs || [], hsongs = L.hero_songs || [];
    const ids = [sg.id].concat(sg.alts || []);
    const pick = ids.map((id) => songs.find((x) => x.id === id && x.title) || hsongs.find((x) => x.id === id && x.title)).find(Boolean);
    if (!pick) return null;
    const ballad = songs.includes(pick);
    const by = ballad ? null : pick.author;
    const why = sg.why === "anthem" ? "the Party of the Season's anthem" : ballad ? "the best-made song the taverns sang this season" : `the best-made song a hero wrote this season`;
    const box = el("div", { class: "sos" });
    box.appendChild(A.later(A.SONG, () => songStage(s, pick, ballad, by, fin)));
    return panel("Song of the Season", el("p", { class: "small muted" }, `The night's last number: “${pick.title}”${by && heroes[by] ? `, by ${heroes[by].name}` : ""}, ${why}. The band plays it through; the words go up on the board.`), box);
  }
  // the closing number on the ballad stage: the tune only (the sung voice is shelved), each line of the words as a caption
  function instrumental(P) {
    const lead = Music.INSTS.includes(P.inst) && P.inst !== "drum" ? P.inst : "fiddle";
    const shift = lead === "flute" ? 12 : lead === "horn" ? -12 : 0;
    P.notes = P.notes.filter((n) => n.part !== "hum" && n.part !== "along").map((n) => (n.part === "voice" ? Object.assign({}, n, { part: "inst", inst: lead, m: n.m + shift, vol: (n.vol || 0.25) * 0.75 }) : n));
    return P;
  }
  function songStage(s, pick, ballad, by, fin) {
    const song = ballad ? pick : { id: pick.id, title: pick.title, heroes: by ? [by] : [], towns: [townOf(s, fin) || "ironhaven"], mood: "glory", day: pick.day };
    const cv = Ballad.scene(song, { W: 256 });
    cv.className = "bard-stage";
    const capEl = el("div", { class: "sos-cap" }, el("span", { class: "dim" }, "♪"));
    const btn = el("button", { class: "btn primary", type: "button" }, "▶ Play the closing number");
    const words = ballad ? (pick.lyrics || []) : (pick.lines || []);
    const plan = () => {
      if (ballad) return instrumental(Music.ballad(pick));
      const rec = { id: "sos:" + pick.id, song: { src: "hero", id: pick.id, meter: pick.meter, bpm: pick.bpm, tone: pick.tone, diff: pick.diff }, lead: { id: by || "bard", skill: 0.85, inst: "lute" }, joiners: [], outcome: "sweet" };
      return instrumental(Music.plan(Music.specFor(rec, Music.words({ src: "hero", id: pick.id }), "full")));
    };
    let handle = null, raf = 0;
    const stop = () => { if (handle) handle.stop(); handle = null; cancelAnimationFrame(raf); cv.ballad.playing(false); btn.textContent = "▶ Play the closing number"; };
    btn.onclick = () => {
      if (handle) { stop(); return; }
      let P;
      try { P = plan(); } catch (e) { console.error(e); return; }
      handle = Music.perform(P, { done: stop });
      if (!handle) { capEl.textContent = "Turn the sound on (top right) to hear it."; return; }
      cv.ballad.playing(true);
      btn.textContent = "■ Stop";
      let shown = -1;
      const tick = () => {
        if (!handle || !cv.isConnected) { if (!cv.isConnected) stop(); return; }
        const t = handle.t, k = P.lines.findIndex((l, i) => t >= l.t0 - 0.1 && (i === P.lines.length - 1 || t < P.lines[i + 1].t0 - 0.1));
        if (k !== shown && k >= 0) { shown = k; capEl.replaceChildren(el("span", { class: P.lines[k].chorus ? "chorus" : "" }, P.lines[k].text || "♪")); }
        if (Math.floor(t * 4) % 2) cv.ballad.strum();
        raf = requestAnimationFrame(tick);
      };
      tick();
    };
    const lyr = words.length ? el("details", { class: "sos-words" }, el("summary", { class: "small" }, "All the words"), el("div", { class: "small" }, words.map((w) => el("div", null, w)))) : null;
    return el("div", null, cv, capEl, el("div", { class: "row wrap" }, btn, el("span", { class: "tiny dim" }, "Instrumental. Sound follows your sound setting.")), lyr);
  }
  function trailerPanel(s, fin, isLast) {
    const t = fin && fin.trailer;
    if (t && t.annals) return el("section", { class: "panel trailer annals" }, el("div", { class: "finale-kicker" }, "The end of an age"),
      el("h2", null, "No next season"), el("p", null, "That was the last season of this age. The legends, the champions, the fallen and the grudges are written down."),
      el("a", { class: "btn primary", href: "#/annals" }, "📜 Read the Annals of the Age"));
    if (!t) return panel(isLast ? "Next season" : "What came next",
      el("p", null, isLast ? "Every hero rests up at home or wherever the season left them, and crews regroup. Bosses that fell have successors waiting." : "The league moved on. It always does."),
      (s.joining || []).length && isLast ? el("p", { class: "small" }, el("b", null, "Joining: "), s.joining.join(", ")) : null,
      el("p", null, el("a", { class: "btn", href: "#/history" }, "All seasons →")));
    const bosses = (t.bosses || []).map((b) => el("div", { class: "tr-boss" }, App.S.monsters[b.monster] ? A.monsterSprite(b.monster, 2) : null,
      el("b", null, b.next), el("span", { class: "tiny" }, b.stronger ? `${plural(b.stronger, "level")} stronger than ${b.was}` : `in place of ${b.was}`), el("span", { class: "tiny dim" }, b.place)));
    const business = [];
    for (const r of t.races || []) business.push(el("li", null, A.storyText(`Nobody brought down ${r.boss} in ${r.place}. The race is still open.`)));
    for (const g of (t.grudges || []).filter((g) => heroes[g.a] && heroes[g.b]).slice(0, 4)) {
      const [a, b] = g.record || [0, 0];
      business.push(el("li", { class: "tr-grudge" }, A.heroPortrait(heroes[g.a], 1, { cls: "mini" }), el("span", { class: "tr-vs" }, g.type === "nemeses" ? "nemeses" : "rivals"), A.heroPortrait(heroes[g.b], 1, { cls: "mini" }),
        el("span", null, A.heroLink(g.a), " and ", A.heroLink(g.b), el("span", { class: "dim" }, a + b ? `, ${a}–${b} so far` : `, since day ${A.seasonOf(g.since)[1]}`))));
    }
    for (const g of t.goals || []) business.push(el("li", null, g.party && parties[g.party] ? A.partyLink(g.party) : g.hero && heroes[g.hero] ? A.heroLink(g.hero) : el("b", null, g.name), ` set out ${/^to /.test(g.text) ? g.text : "to " + g.text}`, el("span", { class: "dim" }, ` (${g.progress})`)));
    const vowed = new Set();
    for (const x of t.vows || []) {
      const key = (x.hero || x.party || x.name) + ":" + x.text;
      if (vowed.has(key)) continue;
      vowed.add(key);
      business.push(el("li", null, x.hero && heroes[x.hero] ? A.heroLink(x.hero) : x.party && parties[x.party] ? A.partyLink(x.party) : x.name, " vowed ", A.storyText(x.text)));
    }
    const dreams = (t.dreams || []).filter((d) => heroes[d.hero]);
    const joiners = (t.joining || []).map((j) => el("div", { class: "tr-join" }, j.look ? A.heroPortrait({ id: j.id, name: j.name, look: j.look, cls: j.cls, weapon: "none", weapon_tier: 1, armor_tier: 1 }, 2) : null,
      el("b", { class: "tiny" }, j.name), el("span", { class: "tiny dim" }, j.npc ? A.clsName(j.cls) : `${j.owner}'s ${A.clsName(j.cls)}`)));
    return el("section", { class: "panel trailer" },
      el("div", { class: "finale-kicker" }, `Next season on ${L.meta.name}…`),
      el("h2", { class: "tr-theme" }, t.theme ? t.theme.name : `Season ${t.season}`),
      t.theme && t.theme.desc ? el("p", { class: "tr-desc" }, t.theme.desc) : null,
      bosses.length ? [el("h4", null, "Waiting in the dark"), el("div", { class: "tr-bosses" }, bosses)] : null,
      business.length ? [el("h4", null, "Unfinished business"), el("ul", { class: "tr-list small" }, business)] : null,
      dreams.length ? [el("h4", null, "Dreams still open"), el("ul", { class: "tr-list small" }, dreams.slice(0, 8).map((d) => el("li", null, A.heroLink(d.hero), ` still wants ${/^to /.test(d.dream) ? d.dream : "to " + d.dream}`)))] : null,
      joiners.length ? [el("h4", null, "New faces"), el("div", { class: "tr-joiners" }, joiners)] : null,
      el("p", { class: "small tr-foot" }, isLast ? `Season ${t.season} starts with the next run. ` : ["What happened next: ", el("a", { href: `#/finale/${t.season}` }, `the Season ${t.season} ceremony`), ". "], el("a", { href: "#/history" }, "All seasons →")));
  }
  function gamesPanel(s) {
    const g = s.closing_games;
    if (!g || !g.rounds) return null;
    const names = {}, rank = {};
    for (const x of g.entrants) { names[x.hero] = heroes[x.hero] ? heroes[x.hero].name : x.hero; rank[x.hero] = x.rank; }
    const all = g.rounds.flatMap((r) => r.matches.map((m) => Object.assign({ event: g.event, round: r.name }, m)));
    const stage = el("div", { class: "cg-stage" }), cards = [];
    const show = (m) => {
      cards.forEach(([x, c]) => c.classList.toggle("on", x === m));
      stage.innerHTML = "";
      const make = g.event === "chess" ? () => ChessReplay.player(GamesReplay.chessRecord(m, names), {}) : () => GamesReplay.player(m, { names });
      stage.append(el("div", { class: "cg-head" }, el("span", { class: "finale-kicker" }, m.round), el("b", null, `${names[m.a]} v ${names[m.b]}`)),
        el("div", { class: "cg-screen" }, A.later(g.event === "chess" ? ["games_replay", "chess_replay"] : ["games_replay"], make)),
        el("p", { class: "small cg-line" }, m.line));
    };
    const side = (m, k) => {
      const id = k ? m.b : m.a, h = id && heroes[id];
      if (!id) return el("div", { class: "cg-side bye" }, el("i", { class: "dim" }, "a bye"));
      return el("div", { class: "cg-side " + (m.winner === k ? "won" : "lost") }, h ? A.heroPortrait(h, 1, { cls: "mini" }) : null,
        el("span", { class: "cg-name" }, names[id]), el("span", { class: "cg-tag", title: "Place in the final table" }, `#${rank[id]}`));
    };
    const bracket = el("div", { class: "cg-bracket" }, g.rounds.map((r) => el("div", { class: "cg-round" }, el("h4", null, r.name),
      all.filter((m) => m.round === r.name).map((m) => {
        const c = el("button", { type: "button", class: "cg-match" + (m.bye ? " bye" : ""), disabled: !!m.bye, title: m.bye ? "" : "Watch this match",
          onclick: () => { show(m); if (stage.getBoundingClientRect().top > innerHeight - 120) stage.scrollIntoView({ block: "center", behavior: "smooth" }); } }, side(m, 0), side(m, 1), m.how === "upset" ? el("span", { class: "cg-upset" }, "upset") : null);
        cards.push([m, c]);
        return c;
      }))));
    const champ = heroes[g.winner];
    bracket.appendChild(el("div", { class: "cg-round cg-champ" }, el("h4", null, "Champion"),
      A.later(["games_replay"], () => GamesReplay.trophy(g.event, 3)), champ ? A.heroPortrait(champ, 2) : null,
      el("b", null, champ ? A.heroLink(champ.id) : g.winner), el("div", { class: "small" }, cap(g.trophy.name)),
      el("div", { class: "tiny dim" }, cap(g.trophy.what))));
    const seats = g.entrants.filter((x) => x.seat === "table").length;
    show(all[all.length - 1]);
    return panel(`The Closing Games: ${cap(g.name)}`,
      el("p", { class: "small muted" }, `${g.blurb} ${cap(["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"][seats] || seats)} `
        + `${seats === 1 ? "seat" : "seats"} went to the bottom half of the table, the rest to volunteers. `
        + `The prize is ${g.trophy.name}: no silver, no renown, just the glory.`),
      el("div", { class: "cg" }, bracket, stage));
  }
  // the numbers that happened; the ones that didn't get one line between them
  const NUMS = [["fights", "Fights", "fights"], ["kills", "Monsters slain", "monsters"], ["bosses", "Bosses slain", "bosses"], ["floors", "Floors cleared", "floors"], ["gold", "Silver earned", "silver"],
    ["levels", "Levels gained", "levels"], ["evolutions", "Class changes", "classes"], ["parties_formed", "Crews formed", "crews"], ["breakups", "Break-ups", "break-ups"],
    ["robberies", "Fights between heroes", "fights"], ["feuds", "New grudges", "grudges"], ["deaths", "Fallen", "heroes"]];
  const ZERO = { deaths: "nobody fell", breakups: "no crew broke up", robberies: "no hero laid a hand on another", feuds: "no new grudges", bosses: "no boss fell", evolutions: "nobody changed class", parties_formed: "no new crews", floors: "no floor got cleared" };
  function numbersPanel(s) {
    const n = s.numbers || {};
    const tiles = NUMS.filter(([k]) => n[k]).map(([k, label, unit]) => el("div", { title: `${num(n[k])} ${unit}` }, el("b", null, num(n[k])), el("span", null, label)));
    const zeros = NUMS.filter(([k]) => n[k] === 0 && ZERO[k]).map(([k]) => ZERO[k]);
    if (!tiles.length && !zeros.length) return null;
    return panel("The season in numbers", el("div", { class: "statgrid finale-nums" }, tiles),
      zeros.length ? el("p", { class: "small muted fin-zeros" }, `And for the record: ${zeros.length > 1 ? zeros.slice(0, -1).join(", ") + " and " + zeros[zeros.length - 1] : zeros[0]}.`) : null);
  }
  function hallPanel(s) {
    const hall = el("div", { class: "hall" });
    for (const a of s.awards) {
      if (a.id === "mvp" || !heroes[a.hero]) continue;
      hall.appendChild(el("div", { class: "award trophy" }, Trophies.canvas(a.id, 2), el("div", null, el("div", { class: "small gold has-tip", title: a.rules ? cap(a.rules) : "" }, a.name), A.heroLink(a.hero),
        el("div", { class: "tiny dim" }, valueText(a)), runnerUp(a))));
    }
    for (const a of s.party_awards || []) {
      if (a.id === "party_mvp" || !parties[a.party]) continue;
      hall.appendChild(el("div", { class: "award trophy" }, Trophies.canvas(a.id, 2), el("div", null, el("div", { class: "small gold has-tip", title: a.rules ? cap(a.rules) : "" }, a.name), A.partyLink(a.party),
        el("div", { class: "tiny dim" }, valueText(a)), runnerUp(a))));
    }
    return hall.children.length ? panel("The hall of awards", el("p", { class: "small muted" }, "Every trophy handed out tonight. Hover a name for what it's for."), hall) : null;
  }
  function storyPanels(s, fin) {
    const out = [];
    if (s.recap) out.push(panel("The season, as the Crier tells it", ...s.recap.split(/\n\s*\n/).map((t) => el("p", { class: "epilogue" }, A.storyText(t)))));
    const weeks = fin && fin.weeks ? fin.weeks.filter((w) => w.event) : null;
    const moments = s.moments || [];
    const side = el("div");
    if (s.rivalry) side.appendChild(rivalryPanel("Rivalry of the season", s.rivalry, events));
    if ((s.goals || []).length) {
      const met = s.goals.filter((g) => g.done).length;
      side.appendChild(panel("Goals of the season", el("p", { class: "small muted" }, `${met} of ${s.goals.length} parties and lone heroes got what they came for.`),
        el("ul", { class: "goals" }, s.goals.map((g) => el("li", { class: g.done ? "met" : "missed" },
          el("span", { class: "mark" }, g.done ? "✔" : "○"), g.party ? A.partyLink(g.party) : g.hero && heroes[g.hero] ? A.heroLink(g.hero) : g.name, " ", g.text,
          g.done ? null : el("span", { class: "tiny dim" }, ` (${g.progress})`))))));
    }
    const sFeuds = L.events.filter((e) => e.season === s.season && e.kind === "feud");
    if (sFeuds.length) side.appendChild(panel("Feuds of the season", el("ul", { class: "diary" }, sFeuds.slice(0, 6).map((e) => el("li", null, A.storyLine(e))))));
    const tl = el("div");
    if (moments.length) tl.appendChild(panel("Moments of the season", el("ol", { class: "timeline" }, moments.map((m) => el("li", null, el("span", { class: "when" }, `Day ${m.sday || "?"}`), el("div", null, A.storyLine(m)))))));
    if (weeks && weeks.length) tl.appendChild(panel("Meanwhile, week by week", el("p", { class: "tiny dim" }, "Each week's other big story."),
      el("ol", { class: "timeline small" }, weeks.map((w) => el("li", null, el("span", { class: "when" }, `Week ${w.week}`), el("div", null, A.storyLine(w.event)))))));
    if (tl.children.length || side.children.length) out.push(el("div", { class: "grid2" }, tl, side));
    return out;
  }
  function memoriam(s) {
    if (!(s.deaths || []).length) return null;
    const mem = panel("In memoriam");
    for (const d of s.deaths) {
      const h = heroes[d.id];
      mem.appendChild(el("div", { class: "grave-row" }, Art.graveGrid().toCanvas(3), h ? A.heroPortrait(h, 1) : null,
        el("div", null, h ? A.heroLink(h.id) : el("b", null, d.name), el("div", { class: "small" }, `Lv ${d.level}. Died ${d.cause} in ${d.place}.`))));
    }
    return mem;
  }

  // the whole night after the crown, in the order it happened
  function program(v, s, fin, isLast) {
    const add = (x) => { if (x) v.appendChild(Array.isArray(x) ? el("div", null, x) : x); };
    add(partyPanel(s));
    add(nightPanel(s, fin));
    add(speechesPanel(s, fin));
    const vote = votePanel(fin), odds = oddsBoard(fin && fin.odds, { judged: true });
    if (vote && odds) add(el("div", { class: "grid2 even" }, vote, odds)); else { add(vote); add(odds); }
    add(yearbookPanel(s, fin));
    add(gamesPanel(s));
    add(outtakesPanel(fin));
    add(thenNowPanel(s, fin));
    for (const x of storyPanels(s, fin)) add(x);
    add(hallPanel(s));
    const nums = numbersPanel(s), mem = memoriam(s);
    if (nums && mem) add(el("div", { class: "grid2 even" }, nums, mem)); else add(nums || mem);
    add(songPanel(s, fin));
    add(trailerPanel(s, fin, isLast));
  }

  function page(v, s, fin, isLast, replay) {
    v.innerHTML = "";
    const venue = townOf(s, fin) ? A.nodeName(townOf(s, fin)) : null;
    v.appendChild(el("section", { class: "finale-hero" },
      el("div", { class: "finale-kicker" }, `The Season ${s.season} Ceremony`),
      el("h1", null, s.theme),
      el("p", null, `${plural((s.end_day - (s.start_day || s.end_day - 27)) + 1, "day")}${venue ? ` · the party is in ${venue}` : ""} · ${L.meta.name}`)));
    const stage = el("div", { class: "fin-stage" }), rest = el("div", { class: "fin-rest" });
    v.append(stage, rest);
    const again = () => page(v, s, fin, isLast, true);
    const showAll = () => { stage.replaceChildren(results(s, fin, calm() ? null : again)); rest.innerHTML = ""; program(rest, s, fin, isLast); };
    if (calm() || (seen(s.season) && !replay)) { showAll(); return; }
    const preOdds = oddsBoard(fin && fin.odds, { judged: false });
    const open = () => {
      markSeen(s.season);
      sfx("envelope");
      if (preOdds) preOdds.remove();
      const deck = countdown(s, fin, (withCrown, skipped) => {
        if (skipped) { showAll(); window.scrollTo({ top: stage.offsetTop - 70 }); return; }
        rest.innerHTML = "";
        rest.appendChild(el("p", { class: "fin-onward" }, "The night goes on ↓"));
        program(rest, s, fin, isLast);
      });
      stage.replaceChildren(deck);
    };
    const skip = () => { markSeen(s.season); showAll(); };
    stage.appendChild(sealed(s, fin, open, skip));
    if (preOdds) stage.appendChild(preOdds);
  }

  A.route(/^\/finale(?:\/(\d+))?$/, (v, n) => {
    const all = L.seasons || [];
    const s = n ? all.find((x) => x.season === +n) : all[all.length - 1];
    if (!s) { v.appendChild(panel("No finale yet", el("p", { class: "empty" }, "The first season hasn't ended. The ceremony happens on its last day."))); return; }
    const isLast = s === all[all.length - 1];
    if (!s.finale) { page(v, s, null, isLast); return; }
    v.appendChild(el("p", { class: "loading" }, "Opening the hall…"));
    return A.load(s.finale).then((fin) => page(v, s, fin, isLast), () => page(v, s, null, isLast));
  });

  // ---------- Your Season: one tall card per hero, sized for a phone screenshot ----------
  function statRow(x) {
    const top = Math.max(x.value, x.median, 1);
    return el("div", { class: "ys-stat", title: `${num(x.value)} ${x.unit || ""} · the league's median: ${num(x.median)}` },
      el("div", { class: "ys-stat-head" }, el("span", null, cap(x.label)), el("b", null, num(x.value))),
      el("div", { class: "ys-bars" }, el("i", { class: "you", style: { width: (x.value / top) * 100 + "%" } }), el("i", { class: "med", style: { left: `calc(${(x.median / top) * 100}% - 1px)` } })),
      el("div", { class: "tiny dim" }, `league median ${num(x.median)}`));
  }
  function voteLine(b) {
    const v = b.vote;
    if (!v) return null;
    if (v.how === "spoiled") return "Spoiled their ballot.";
    if (v.how === "self" || v.for === b.hero) return ["Voted for themselves. Of course."];
    return v.for && heroes[v.for] ? ["Voted for ", A.heroLink(v.for), "."] : null;
  }
  function seasonCard(s, fin, id) {
    const b = fin.bundles[id], h = heroes[id];
    const tn = (fin.then_now || {})[id];
    const awards = (b.awards || []).map((aid) => (s.awards || []).find((a) => a.id === aid && a.hero === id)).filter(Boolean);
    const t = b.toast;
    const tease = b.honour && b.honour.tone === "tease";
    const copyBtn = el("button", { class: "btn small", type: "button", onclick: () => A.copy(`${b.blurb}\n${A.shareUrl(`#/finale/${s.season}/${id}`)}`, "Copied. Paste it in the group chat.") }, "Copy blurb");
    return el("article", { class: "ys-card" + (b.alive ? "" : " fallen") },
      el("header", { class: "ys-head" }, el("div", { class: "ys-league" }, L.meta.name), el("div", { class: "finale-kicker" }, `Season ${s.season} · ${s.theme}`), waxSeal(2, "ys-seal")),
      el("div", { class: "ys-hero" }, el("div", { class: "ys-frame" }, snapPortrait(id, b.portrait, 4)),
        el("h1", null, h.name), h.epithet ? el("div", { class: "epi" }, h.epithet) : null,
        el("div", { class: "small muted" }, `${h.npc ? "League hero" : h.owner + "'s hero"} · Lv ${b.portrait ? b.portrait.level : h.level} ${A.clsName(b.portrait ? b.portrait.cls : h.cls)}`),
        el("div", { class: "ys-rank" }, el("b", null, ord(b.rank)), el("span", null, ` of ${b.of}`), el("span", { class: "ys-ren" }, `${num(b.renown)} renown`))),
      awards.length ? el("section", { class: "ys-sec ys-awards" }, el("h4", null, awards.length > 1 ? "Trophies" : "Trophy"),
        awards.map((a) => el("div", { class: "ys-award" }, Trophies.canvas(a.id, 2), el("div", null, el("b", null, a.name), el("div", { class: "tiny dim" }, valueText(a)))))) : null,
      b.honour ? el("section", { class: "ys-sec ys-honour" + (tease ? " tease" : "") }, el("h4", null, "Honour"),
        el("div", { class: "ys-award" }, Trophies.canvas("honour", 2, b.honour.id, b.honour.tone), el("div", null, el("b", null, b.honour.title), A.storyLink(b.honour.event) ? el("div", { class: "tiny" }, A.storyLink(b.honour.event)) : null))) : null,
      b.best_moment ? el("section", { class: "ys-sec" }, el("h4", null, "The moment"), el("p", { class: "small" }, A.storyLine(b.best_moment))) : null,
      t ? el("section", { class: "ys-sec ys-toast" }, el("h4", null, t.kind === "roast" ? "The roast" : "The toast"),
        el("blockquote", { class: "small" }, A.richText(t.line, [t.by, t.hero].filter(Boolean))),
        el("div", { class: "tiny dim" }, "— ", t.by && heroes[t.by] ? A.heroLink(t.by) : t.by_name)) : null,
      voteLine(b) || b.points ? el("section", { class: "ys-sec ys-vote" }, el("h4", null, "The Heroes' Choice"),
        el("p", { class: "small" }, voteLine(b), b.points ? [" ", el("b", null, plural(b.points, "point")), " came their way."] : null)) : null,
      (b.stats || []).length ? el("section", { class: "ys-sec" }, el("h4", null, "Against the league"), (b.stats || []).slice(0, 3).map(statRow)) : null,
      tn && tn.then && tn.now ? el("section", { class: "ys-sec ys-tn" }, el("h4", null, "Then and now"),
        el("div", { class: "tn-pics" }, snapPortrait(id, tn.then, 2, true), el("span", { class: "tn-arrow", "aria-hidden": "true" }, "▸"), snapPortrait(id, tn.now, 2)),
        el("ul", { class: "tiny" }, (tn.changes || []).map((c) => el("li", null, c)))) : null,
      el("footer", { class: "ys-foot" }, copyBtn, el("a", { class: "btn small", href: `#/finale/${s.season}` }, "The ceremony"), el("a", { class: "btn small", href: `#/hero/${id}` }, "Hero page")));
  }
  A.route(/^\/finale\/(\d+)\/(\w+)$/, (v, n, id) => {
    const s = (L.seasons || []).find((x) => x.season === +n);
    const none = (msg) => { v.innerHTML = ""; v.appendChild(panel("No card here", el("p", null, msg), el("p", null, el("a", { class: "btn", href: `#/finale/${n}` }, "The ceremony")))); };
    if (!s || !s.finale || !heroes[id]) { none("That season or hero doesn't have a ceremony card."); return; }
    return A.load(s.finale).then((fin) => {
      if (!(fin.bundles || {})[id]) { none(`${heroes[id].name} wasn't in season ${n}'s table.`); return; }
      v.innerHTML = "";
      v.appendChild(el("div", { class: "ys" }, seasonCard(s, fin, id)));
    }, () => none("The ceremony's file didn't load."));
  });

  window.Finale = { oddsBoard, seasonCard, results, countdown, revealPlan, waxSeal, seen, markSeen };
})();
