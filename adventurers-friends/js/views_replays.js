/* The Replays index (#/replays, #/replays/<hero>, with ?k=<kind>&w=<season>-<week>): every kept replay by day, the season's best fights first. */
(function () {
  const A = App;
  const { L, el, heroes, plural } = A;

  const KINDS = [["fight", "Fights"], ["night", "Camp nights"], ["meal", "Meals"], ["catch", "Catches"], ["reading", "Readings"], ["road", "Road & hunt"], ["table", "Tables"]];
  const ONE = { fight: "Fight", night: "Camp night", meal: "Meal", catch: "Catch", reading: "Reading", road: "Road", table: "Table" };
  const PAGE = 60;
  const week = (r) => `${r.s}-${Math.ceil((r.sd || 1) / 7)}`;

  A.route(/^\/replays(?:\/(\w+))?(?:\?(.*))?$/, (v, hid, query) => {
    v.appendChild(el("p", { class: "loading" }, "Fetching the reels…"));
    return A.load("replays").then((D) => {
      v.innerHTML = "";
      const q = new URLSearchParams(query || "");
      page(v, D.rows || [], heroes[hid] ? hid : null, { k: q.get("k"), w: q.get("w") });
    });
  });

  function page(v, all, hid, f) {
    const h = hid && heroes[hid];
    v.classList.add("rp-page");
    v.appendChild(el("h1", null, h ? `${h.name}'s replays` : "Replays"));
    v.appendChild(el("p", { class: "small muted" }, h ? [A.heroLink(hid), ` has ${plural(all.filter((r) => (r.h || []).includes(hid)).length, "replay")} on file. `, el("a", { href: "#/replays" }, "Everyone's replays ▸")]
      : `Every fight, camp night, meal, catch, reading, road scene and table the league has kept: ${all.length} in all.`));
    const pick = el("select", { class: "rp-who", "aria-label": "Whose replays" }, el("option", { value: "" }, "Every hero"),
      A.L.heroes.filter((x) => all.some((r) => (r.h || []).includes(x.id))).sort((a, b) => a.name.localeCompare(b.name)).map((x) => el("option", { value: x.id, selected: x.id === hid ? "" : null }, x.name)));
    pick.addEventListener("change", () => { location.hash = `#/replays${pick.value ? "/" + pick.value : ""}${qs(f)}`; });
    const mineIds = A.mine().filter((id) => heroes[id] && id !== hid);
    v.appendChild(el("div", { class: "rp-bar" }, el("label", { class: "tiny dim" }, "Whose ", pick),
      mineIds.length ? mineIds.slice(0, 3).map((id) => el("a", { class: "rs-chip", href: `#/replays/${id}${qs(f)}` }, `★ ${heroes[id].name}`)) : null));
    const mine = hid ? all.filter((r) => (r.h || []).includes(hid)) : all;
    const kinds = el("div", { class: "rs-sorts", role: "group", "aria-label": "Kind" });
    const weeks = el("div", { class: "rs-sorts", role: "group", "aria-label": "Week" });
    const best = el("div");
    const list = el("div", { class: "rp-list" });
    v.append(kinds, weeks, best, list);
    const set = (k, val) => {
      f[k] = f[k] === val ? null : val;
      history.replaceState(null, "", `#/replays${hid ? "/" + hid : ""}${qs(f)}`);
      draw();
    };
    function draw() {
      const inWeek = mine.filter((r) => !f.w || week(r) === f.w);
      kinds.innerHTML = "";
      kinds.append(el("span", { class: "tiny dim" }, "Kind"), chip("All", inWeek.length, !f.k, () => set("k", f.k)),
        ...KINDS.map(([k, label]) => { const n = inWeek.filter((r) => r.k === k).length; return n || f.k === k ? chip(label, n, f.k === k, () => set("k", k)) : ""; }));
      const ofKind = mine.filter((r) => !f.k || r.k === f.k);
      const ws = [...new Set(ofKind.map(week))].sort((a, b) => { const [s1, w1] = a.split("-").map(Number), [s2, w2] = b.split("-").map(Number); return s1 - s2 || w1 - w2; });
      weeks.innerHTML = "";
      const many = new Set(ws.map((w) => w.split("-")[0])).size > 1;
      weeks.append(el("span", { class: "tiny dim" }, "Week"), chip("All", null, !f.w, () => set("w", f.w)),
        ...ws.map((w) => { const [s, n] = w.split("-"); return chip(many ? `S${s} W${n}` : `Week ${n}`, null, f.w === w, () => set("w", w)); }));
      const rows = ofKind.filter((r) => !f.w || week(r) === f.w);
      best.innerHTML = "";
      if (!f.w && (!f.k || f.k === "fight")) best.appendChild(bestFights(mine));
      list.innerHTML = "";
      delete list.dataset.day;
      more(list, rows, 0);
    }
    draw();
  }
  function qs(f) {
    const p = Object.entries(f).filter(([, x]) => x).map(([k, x]) => `${k}=${encodeURIComponent(x)}`).join("&");
    return p ? "?" + p : "";
  }
  function chip(label, n, on, fn) {
    return el("button", { class: "rs-chip" + (on ? " on" : ""), "aria-pressed": String(!!on), onclick: fn }, label, n != null ? el("span", { class: "rp-n" }, ` ${n}`) : null);
  }
  // the season's best fights: what the paper made most of, and how much renown changed hands over them
  function bestFights(rows) {
    const s = L.meta.season;
    const top = rows.filter((r) => r.k === "fight" && r.s === s).sort((a, b) => b.score - a.score || b.d - a.d).slice(0, 5);
    if (!top.length) return el("span");
    return el("section", { class: "panel tight rp-best" }, el("h2", null, `The best fights of season ${s}`),
      el("ol", { class: "rp-best-list" }, top.map((r) => el("li", null, line(r, true)))));
  }
  function more(list, rows, from) {
    let day = list.dataset.day ? Number(list.dataset.day) : null;
    for (const r of rows.slice(from, from + PAGE)) {
      if (r.d !== day) {
        day = r.d;
        list.appendChild(el("div", { class: "rp-day" }, `Season ${r.s} · Day ${r.sd || "?"}`, el("span", { class: "dim" }, ` · week ${Math.ceil((r.sd || 1) / 7)}`)));
      }
      list.appendChild(line(r));
    }
    list.dataset.day = day == null ? "" : day;
    if (!rows.length) list.appendChild(el("p", { class: "empty" }, "Nothing kept for that. Try another kind or week."));
    if (rows.length > from + PAGE) {
      const b = el("button", { class: "btn small rp-more", onclick: () => { b.remove(); more(list, rows, from + PAGE); } }, `Show ${Math.min(PAGE, rows.length - from - PAGE)} more (${rows.length - from - PAGE} left)`);
      list.appendChild(b);
    }
  }
  function line(r, ranked) {
    const song = r.k === "night" && r.tag === "song";
    const who = (r.h || []).filter((id) => heroes[id]);
    return el("div", { class: `rp-row k-${r.k}` },
      el("span", { class: `rp-kind k-${r.k}` }, song ? "Song" : r.tag === "hunt" ? "Hunt" : ONE[r.k]),
      el("div", { class: "rp-main" },
        el("div", { class: "rp-title" }, el("a", { href: `#/${r.k}/${r.id}` }, r.t), r.r ? el("span", { class: `rp-res ${r.r}` }, ` ${r.r}`) : null),
        r.x ? el("div", { class: "rp-x small" }, A.storyText(r.x)) : null,
        el("div", { class: "rp-meta tiny" }, ranked ? el("span", { class: "dim" }, `Day ${r.sd || "?"} · `) : null, r.at ? el("span", { class: "dim" }, `${r.at}`) : null,
          who.length ? [r.at ? el("span", { class: "dim" }, " · ") : null, who.slice(0, 5).map((id, i) => [i ? ", " : null, A.heroLink(id)]), who.length > 5 ? el("span", { class: "dim" }, ` and ${who.length - 5} more`) : null] : null)),
      el("a", { class: "watch rp-play", href: `#/${r.k}/${r.id}`, "aria-label": `${song ? "Listen to" : "Watch"} ${r.t}` }, song ? "♪ listen" : "▶ watch"));
  }
})();
