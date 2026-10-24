/* The Map's Roadside mode, Places & Travellers (#/places[/<place>], #/places/travellers[/<traveller>]): the roadside places by road, found or still to find, and the travellers met on the roads. */
(function () {
  "use strict";
  const A = App;
  const { el, heroes } = A;

  A.route(/^\/places(?:\/(\w+))?(?:\/(\w+))?$/, (v, a, b) => {
    const tab = a === "travellers" ? "travellers" : "places", focus = a === "travellers" ? b : a;
    v.appendChild(el("p", { class: "loading" }, "Unrolling the road maps…"));
    return Promise.all([A.load("places"), A.roadArt().catch(() => null)]).then(([D]) => {
      v.innerHTML = "";
      page(v, D, tab, focus);
    });
  });

  function page(v, D, tab, focus) {
    v.classList.add("places-page");
    v.appendChild(el("div", { class: "pl-head" },
      el("h1", null, "The Realm"),
      window.MapModes ? MapModes.bar("roadside") : null,
      el("h2", null, "Places & Travellers"),
      el("p", { class: "small muted" }, "Everything the league has found and met out on the roads between the towns.")));
    const T = [["places", `Places · ${D.found}/${D.total}`], ["travellers", `Travellers · ${D.met}/${D.travellers.length}`]];
    const tabs = el("div", { class: "tabs pl-tabs" });
    const body = el("div");
    for (const [k, label] of T) tabs.appendChild(el("button", { class: k === tab ? "on" : "", onclick: () => go(k) }, label));
    v.append(tabs, body);
    stick(tabs);
    function go(k) {
      history.replaceState(null, "", k === "places" ? "#/places" : "#/places/travellers");
      show(k);
      window.scrollTo(0, Math.min(window.scrollY, v.offsetTop));
    }
    function show(k, f) {
      for (const [i, b] of [...tabs.children].entries()) b.classList.toggle("on", T[i][0] === k);
      body.innerHTML = "";
      (k === "travellers" ? travellersTab : placesTab)(body, D);
      if (f) {
        const card = body.querySelector(`[data-id="${f}"]`);
        if (card) {
          card.classList.add("pl-focus");
          requestAnimationFrame(() => window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - stickTop() - tabs.offsetHeight - 10));
        }
      }
    }
    show(tab, focus);
  }

  // the tabs stay under the site's own sticky header, whose height changes when the nav wraps
  const stickTop = () => { const t = document.querySelector("header.top"); return t ? t.offsetHeight : 0; };
  function stick(tabs) {
    const set = () => { if (tabs.isConnected) tabs.style.top = stickTop() + "px"; else window.removeEventListener("resize", set); };
    set();
    window.addEventListener("resize", set);
  }

  // hiding the grey and hooded cards is a reader's choice, kept for both tabs until they show them again
  const HIDE_KEY = "al.placeshide";
  function hiding() { try { return localStorage.getItem(HIDE_KEY) === "1"; } catch (e) { return false; } }
  function hideToggle(label, redraw) {
    const box = el("input", { type: "checkbox" });
    box.checked = hiding();
    box.addEventListener("change", () => { try { localStorage.setItem(HIDE_KEY, box.checked ? "1" : "0"); } catch (e) { /* storage unavailable */ } redraw(); });
    return el("label", { class: "small pl-hide" }, box, " ", label);
  }

  // ---------- places ----------
  const KIND = { inn: "Inn", shrine: "Shrine", toll: "Toll", ford: "Ford", ferry: "Ferry", milestone: "Milestone", crossroads: "Crossroads", ruin: "Ruin", waystation: "Waystation" };
  const HOUR = { inn: 18.5, waystation: 17.5, shrine: 7.5, ruin: 16, crossroads: 13, milestone: 10, ford: 11, ferry: 9, toll: 14 };
  function roadName(r) { return `${A.nodeName(r[0])} – ${A.nodeName(r[1])}`; }

  function placesTab(body, D) {
    const pct = Math.round((D.found / Math.max(1, D.total)) * 100);
    body.appendChild(el("div", { class: "pl-count" },
      el("div", { class: "pl-count-n" }, el("b", null, D.found), ` of ${D.total} found`),
      el("div", { class: "bar pl-bar" }, el("i", { style: { width: pct + "%" } })),
      el("div", { class: "tiny dim" }, D.found < D.total ? `${D.total - D.found} still out there. Grey cards are places nobody has found yet.` : "Every roadside place on the island has been found."),
      D.found < D.total ? hideToggle("Hide places not found yet", () => { body.innerHTML = ""; placesTab(body, D); }) : null));
    const hide = hiding();
    const roads = new Map();
    for (const p of D.places) {
      const k = p.road.join("~");
      if (!roads.has(k)) roads.set(k, []);
      roads.get(k).push(p);
    }
    const order = [...roads.entries()].sort((x, y) => roadName(x[1][0].road).localeCompare(roadName(y[1][0].road)));
    const grid = el("div", { class: "pl-roads" });
    for (const [, ps] of order) {
      const n = ps.filter((p) => p.found != null).length;
      if (hide && !n) continue;
      grid.appendChild(el("section", { class: "pl-road", "data-biome": ps[0].biome },
        el("h3", { class: "pl-road-name" }, el("span", null, roadName(ps[0].road)), el("span", { class: "tiny dim" }, `${n}/${ps.length}`)),
        ps.filter((p) => !hide || p.found != null).map((p) => (p.found != null ? placeCard(p) : unfoundCard(p)))));
    }
    body.appendChild(grid);
  }

  function placeCard(p) {
    const best = p.best;
    const watch = best && A.kept("road", best.rec) ? el("a", { class: "watch", href: `#/road/${best.rec}` }, "▶ watch") : null;
    return el("article", { class: `pl-card k-${p.kind}`, "data-id": p.id },
      placePic(p),
      el("div", { class: "pl-body" },
        el("div", { class: "pl-kind" }, KIND[p.kind] || p.kind, p.keeper ? el("span", { class: "dim" }, ` · kept by ${p.keeper}`) : null),
        el("h4", { class: "pl-name" }, p.name),
        el("div", { class: "tiny muted" }, "Found ", A.when(p.found, "on"), heroes[p.by] ? [" by ", A.heroLink(p.by)] : null),
        p.tally || p.fee ? el("div", { class: "pl-chips" }, p.tally ? el("span", { class: "pl-chip" }, p.tally) : null,
          p.fee ? el("span", { class: "pl-chip fee" }, `${p.kind === "shrine" ? "offering" : p.kind === "ferry" ? "fare" : "toll"} ${A.coins(p.fee)}`) : null) : null),
      best && best.line ? el("blockquote", { class: "pl-story" }, el("div", { class: "pl-story-h tiny" }, "Best story so far", el("span", { class: "dim" }, ` · ${A.when(best.day, true)}`)),
        el("p", { class: "small" }, A.storyText(best.line), watch ? [" ", watch] : null)) : null);
  }

  function unfoundCard(p) {
    return el("article", { class: "pl-card pl-unfound", "data-id": p.id },
      silhouette(p.kind),
      el("div", { class: "pl-body" },
        el("div", { class: "pl-kind" }, "Undiscovered"),
        el("h4", { class: "pl-name" }, "? ? ?"),
        el("div", { class: "tiny dim" }, "Somewhere along this road. Nobody has stopped here yet.")));
  }

  // a found place is a still of its own stretch of road, its set piece by the verge; drawn when the card scrolls near
  function placePic(p) {
    const W = 128, H = 72, cv = el("canvas", { class: "pl-pic", width: W, height: H, "aria-hidden": "true" });
    const draw = () => {
      if (!window.RoadScenes) return;
      try {
        const sp = Object.assign(RoadScenes.dress({ stretch: "pull", biome: p.biome, place_kind: p.kind, place: p.id, place_name: p.name, seed: p.id }),
          { biome: p.biome, hour: (HOUR[p.kind] || 12) + ((RoadScenes.kit.hash(p.id) % 7) - 3) * 0.4, weather: "clear", seed: p.id, place_x: 0.55, extra: [], heroes: [] });
        const f = RoadScenes.frame(sp, 0, W, H);
        const g = cv.getContext("2d"), im = g.createImageData(W, H);
        im.data.set(f.data);
        g.putImageData(im, 0, 0);
      } catch (e) {
        if (window.RoadArt) iconInto(cv, p.kind, false);
      }
    };
    later(cv, draw);
    return el("div", { class: "pl-frame" }, cv);
  }
  function iconInto(cv, kind, dark) {
    const g = RoadArt.icon(kind), c = cv.getContext("2d"), k = Math.floor(Math.min(cv.width / g.w, cv.height / g.h) * 0.8);
    const ox = Math.round((cv.width - g.w * k) / 2), oy = Math.round((cv.height - g.h * k) / 2);
    for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
      const col = g.px[j * g.w + i];
      if (!col) continue;
      c.fillStyle = dark ? "#2e2018" : col;
      c.fillRect(ox + i * k, oy + j * k, k, k);
    }
  }
  function silhouette(kind) {
    const cv = el("canvas", { class: "pl-pic", width: 64, height: 36, "aria-hidden": "true" });
    if (window.RoadArt) { try { iconInto(cv, kind, true); } catch (e) { /* the ? stands alone */ } }
    return el("div", { class: "pl-frame pl-sil" }, cv, el("span", { class: "pl-q" }, "?"));
  }
  function later(node, fn) {
    if (!("IntersectionObserver" in window)) { fn(); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: "400px" });
    io.observe(node);
  }

  // ---------- travellers ----------
  function travellersTab(body, D) {
    const ts = D.travellers.slice().sort((a, b) => (b.met - a.met) || (a.met ? (b.step / b.steps) - (a.step / a.steps) || (a.name < b.name ? -1 : 1) : 0));
    body.appendChild(el("div", { class: "pl-count" },
      el("div", { class: "pl-count-n" }, el("b", null, D.met), ` of ${D.travellers.length} met`),
      el("div", { class: "bar pl-bar" }, el("i", { style: { width: Math.round((D.met / Math.max(1, D.travellers.length)) * 100) + "%" } })),
      el("div", { class: "tiny dim" }, "Each traveller has a story told a part at a time, to whoever they meet on the road. Hooded cards are travellers nobody has met."),
      D.met < D.travellers.length ? hideToggle("Hide travellers nobody has met", () => { body.innerHTML = ""; travellersTab(body, D); }) : null));
    const hide = hiding();
    body.appendChild(el("div", { class: "tr-grid" }, ts.filter((t) => !hide || t.met).map((t) => (t.met ? travellerCard(t) : hoodedCard(t)))));
  }

  function travellerCard(t) {
    const pic = el("div", { class: "tr-pic" });
    if (window.RoadArt) {
      try { const cv = RoadArt.bust(t.id).toCanvas(2); cv.className = `road-bust${t.kind === "crew" ? " crew" : ""}`; pic.appendChild(cv); } catch (e) { /* a name without a face */ }
    }
    const last = t.last;
    const lastWatch = last && A.kept("road", last.rec) ? el("a", { class: "watch", href: `#/road/${last.rec}` }, "▶ watch") : null;
    return el("article", { class: `tr-card${t.night ? " night" : ""}${t.done != null ? " done" : ""}`, "data-id": t.id },
      el("div", { class: "tr-top" }, pic,
        el("div", { class: "tr-id" },
          el("h4", { class: "pl-name" }, t.name),
          el("div", { class: "tiny muted" }, t.what, t.face ? el("span", null, `, led by ${t.face}`) : null),
          t.night ? el("div", { class: "tr-night tiny" }, "☾ Walks only after dark") : null)),
      dots(t),
      el("div", { class: "tr-row tiny" }, el("b", null, "Last seen: "),
        last ? [`on the road between ${A.nodeName(last.road[0])} and ${A.nodeName(last.road[1])}, ${A.when(last.day, "on")}`, lastWatch ? [" ", lastWatch] : null]
          : el("span", { class: "dim" }, "not in the road's records")),
      el("div", { class: "tr-row tiny" }, el("b", null, t.heroes.length === 1 ? "Met by: " : `Met by ${t.heroes.length} heroes: `),
        t.heroes.map(([hid, n], i) => [i ? ", " : "", A.heroLink(hid), n > 1 ? el("span", { class: "dim" }, ` ×${n}`) : null])),
      t.fought ? el("div", { class: "tr-row tiny" }, el("b", null, "Fought beside a crew: "), t.fought === 1 ? "once" : `${t.fought} times`) : null);
  }

  // the story as dots: a filled dot for each part told, linked to its replay while it is kept; the last dot is the finale
  function dots(t) {
    const row = el("div", { class: "tr-dots" });
    for (let i = 0; i < t.steps; i++) {
      const part = (t.parts || [])[i], told = i < t.step, fin = i === t.steps - 1;
      const cls = `tr-dot${told ? " on" : ""}${fin ? " fin" : ""}`;
      const title = told ? `${fin ? "The finale" : "Part " + (i + 1)}${part ? ", " + A.when(part.day, "on") + (part.line ? ": " + part.line : "") : ""}` : fin ? "The finale, still to come" : `Part ${i + 1}, still to come`;
      row.appendChild(told && part && A.kept("road", part.rec) ? el("a", { class: cls, href: `#/road/${part.rec}`, title }, fin ? "★" : "") : el("span", { class: cls, title }, fin ? "★" : ""));
    }
    const said = t.done != null ? `Story told, finished ${A.when(t.done, "on")}` : t.step ? `${t.step} of ${t.steps} parts told` : "Story not begun";
    const linked = (t.parts || []).some((p, i) => p && i < t.step && A.kept("road", p.rec));
    return el("div", { class: "tr-story" }, row, el("span", { class: "tiny" }, said, linked ? el("span", { class: "dim" }, " · tap a dot to watch") : null));
  }

  // nobody has met them: a hooded figure and what the road says about them
  const HOOD = [
    "..........kkkkkkkk..........", "........kkhhhhhhhhkk........", ".......khhhhhhhhhhhhk.......", "......khhhHhhhhhhhhhhk......", ".....khhhHhhhhhhhhhhhhk.....",
    ".....khhHhhkkkkkkkhhhhk.....", "....khhHhkkkkkkkkkkhhhhk....", "....khhhkkkkkkkkkkkkhhhk....", "....khhkkkkkkkkkkkkkkhhk....", "...khhhkkkkkkkkkkkkkkhhhk...",
    "...khhhkkkkkkkkkkkkkkhhhk...", "...khhhkkkkkkkkkkkkkkhhhk...", "...khhhhkkkkkkkkkkkkhhhhk...", "..khhhhhkkkkkkkkkkkkhhhhhk..", "..khhhhhhkkkkkkkkkkhhhhhhk..",
    "..khhHhhhhhkkkkkkhhhhhhhhk..", ".khhhHhhhhhhhhhhhhhhhhhhhhk.", ".khhhHhhhhhhhhhhhhhhhhhhhhk.", "khhhhHhhhhhhhhhhhhhhhhhhhhhk", "khhhhhhhhhhhhhhhhhhhhhhhhhhk",
  ];
  function hoodCanvas(night) {
    const pal = night ? { k: "#0c1022", h: "#2a3256", H: "#46507e" } : { k: "#1e140c", h: "#5a4630", H: "#7a6244" };
    const cv = el("canvas", { class: "tr-hood", width: 28, height: HOOD.length, "aria-hidden": "true" }), c = cv.getContext("2d");
    HOOD.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { c.fillStyle = pal[ch]; c.fillRect(x, y, 1, 1); } }));
    return cv;
  }
  function hoodedCard(t) {
    return el("article", { class: `tr-card tr-unmet${t.night ? " night" : ""}`, "data-id": t.id },
      el("div", { class: "tr-top" }, el("div", { class: "tr-pic" }, el("div", { class: "tr-hoodbox" }, hoodCanvas(t.night), el("span", { class: "pl-q" }, "?"))),
        el("div", { class: "tr-id" },
          el("h4", { class: "pl-name" }, "Not yet met"),
          t.rumour ? el("p", { class: "small tr-rumour" }, el("span", { class: "dim" }, "Word on the road: "), t.rumour) : null,
          t.night ? el("div", { class: "tr-night tiny" }, "☾ Said to walk only after dark") : null)),
      dots(t));
  }
})();
