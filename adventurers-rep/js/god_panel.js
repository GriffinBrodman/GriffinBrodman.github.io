/* The Gods on a hero's Character tab: what each god thinks of the hero and why, the ask they hold, the ring of ten, the kindness token and the timeline. */
/*
  GodPanel.panel(h) -> a section, filled once static_gods and the god art are in; h.gods is export.god_view (docs/gods/EXPORT.md)
  GodPanel.avel(scale) -> Saint Avel's badge, for the Unbothered
*/
(function () {
  "use strict";
  const A = App, { el, S } = A;
  const WARM = new Set(["doted on", "fond"]), CHILL = new Set(["cold", "furious"]);
  // what holding an ask does to a hero's choices (gods.md, Motivation): said plainly, so a reader sees the hero acting on it
  const PULL = "{n} weighs it every time the crew picks what to do next, and pushes harder as the days run out.";
  const PULL_DONE = "{n} weighed it every time the crew picked what to do next.";

  const by = (id) => ((S.gods || {}).by || {})[id] || {};
  const fire = (id) => by(id).fire || (window.GodArt && GodArt.fire(id)) || "#c8963e";
  const name = (id) => (S.god_names || {})[id] || by(id).name || id;
  const Cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const godHref = (id) => `#/god/${id}`;
  // "S3 day 9", the season always named, as the export's sworn line (export._panel_day)
  const dayWord = (d) => { const [s, sd] = A.seasonOf(d); return `S${s} day ${sd}`; };
  // a god's cross face is its own (Marrow is sorry, Tally is owed): the week's exported face, else GodArt's name for it
  const crossFace = (id) => ((((A.L && A.L.gods) || {}).by || {})[id] || {}).face || (window.GodArt ? GodArt.mood(id, "cross") : "cross");
  const mood = (id, w) => (CHILL.has(w) ? crossFace(id) : null);

  function icon(id, scale, face) {
    const src = GodArt.bust(id, face), c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    c.getContext("2d").drawImage(src, 0, 0);
    c.className = "gp-icon";
    c.style.width = c.style.height = 32 * (scale || 1) + "px";
    return c;
  }

  const AVEL = "Saint Avel's badge, for the Unbothered. Aurel once offered Avel a place on the Mountain, and he said no thank you.";
  // Saint Avel's badge: an empty chair on a pewter medal (he was offered a seat on the Mountain and said no thank you)
  function avel(scale) {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const x = c.getContext("2d"), px = (c0, pts) => { x.fillStyle = c0; for (const [a, b, w, hh] of pts) x.fillRect(a, b, w || 1, hh || 1); };
    px("#16121a", [[5, 0, 6], [3, 1, 2], [11, 1, 2], [2, 2], [13, 2], [1, 3, 1, 2], [14, 3, 1, 2], [0, 5, 1, 6], [15, 5, 1, 6], [1, 11, 1, 2], [14, 11, 1, 2], [2, 13], [13, 13], [3, 14, 2], [11, 14, 2], [5, 15, 6]]);
    px("#8c94a0", [[5, 1, 6], [3, 2, 10], [2, 3, 12, 2], [1, 5, 14, 6], [2, 11, 12, 2], [3, 13, 10], [5, 14, 6]]);
    px("#b8c0c8", [[5, 1, 4], [3, 2, 5], [2, 3, 3], [2, 4, 2], [1, 5, 2, 3]]);
    px("#5e6472", [[13, 7, 1, 4], [11, 12, 3], [6, 14, 5]]);
    px("#3a2a22", [[6, 4, 1, 7], [6, 4, 4], [9, 4, 1, 4], [6, 8, 5], [10, 8, 1, 3], [7, 6, 2]]);
    px("#7a5a3a", [[7, 5, 2], [7, 9, 3]]);
    c.className = "gp-avel";
    c.style.width = c.style.height = 16 * (scale || 2) + "px";
    c.title = AVEL;
    return c;
  }

  // the export's row (warmest, coldest, asking) can come short when one god is two of those: the ring's next warmest fill it to three
  const RANK = ["doted on", "fond", "watching", "indifferent", "cold", "furious"];
  function three(g) {
    const out = (g.row || []).slice(), has = new Set(out.map((x) => x.god));
    const rest = (g.ring || []).filter((x) => !has.has(x.god)).sort((a, b) => RANK.indexOf(a.word) - RANK.indexOf(b.word));
    while (out.length < 3 && rest.length) out.splice(out.length && out[out.length - 1].why === "asks" ? out.length - 1 : out.length, 0, rest.shift());
    const ids = out.map((x) => x.god), a = ids.indexOf("aurel"), b = ids.indexOf("antlered");
    if (a >= 0 && b >= 0 && Math.abs(a - b) === 1 && out.length === 3) { const o = 3 - a - b, m = Math.max(a, b); [out[o], out[m]] = [out[m], out[o]]; }
    return out;
  }
  // each god in the row is named under its face: three dark 32 px busts read alike on a phone
  function row(g) {
    return el("div", { class: "gp-row" }, three(g).map((x) => el("a", { class: "gp-pick", href: godHref(x.god), style: { "--fire": fire(x.god) } },
      icon(x.god, 1, x.why === "asks" ? null : mood(x.god, x.word)),
      el("span", { class: "gp-pick-say" }, el("span", { class: "gp-name" }, Cap(name(x.god))), el("span", { class: "gp-word" + (CHILL.has(x.word) ? " chill" : "") }, x.word)))));
  }
  // the gift's own icon, as the Kit and Treasures draw it
  function giftIcon(x, h) {
    if (!window.Art || !Art.gearIcon) return el("i", { class: "gp-mark-dot" });
    const c = Art.gearIcon(x, h.look).toCanvas(2);
    c.className = "gp-gift-icon";
    Object.assign(c.style, { width: "24px", height: "24px", imageRendering: "pixelated", verticalAlign: "middle", marginRight: "4px" });
    c.title = x.name;
    return c;
  }
  // what the hero holds from the gods, shown even when the panel is folded: a gift is the thing people screenshot
  function gifts(h) {
    const held = (h.kit_items || []).concat(h.relics || []).filter((x) => x.artifact);
    return held.map((x) => el("div", { class: "gp-gift", style: { "--fire": x.glow || fire(x.god) } }, giftIcon(x, h),
      el("span", null, "Holds ", el("a", { href: `#/hero/${h.id}/character`, class: "gp-gift-name" }, x.name), x.day != null ? `, since ${dayWord(x.day)}` : "", ".")));
  }
  // one of the hero's own god lines, the latest: the panel's "why" in the gods' own voice
  function lately(g, h) {
    // an ask's offer is the ask card's own words already
    const n = (g.news || []).filter((x) => !(g.ask && x.kind === "god_ask_offer")).pop();
    if (!n) return null;
    return el("p", { class: "gp-news", style: { "--fire": fire(n.god) } }, el("span", { class: "gp-news-day" }, Cap(dayWord(n.day)) + ": "), A.richText(n.text, [h.id]));
  }
  function spot(x, scale, withName, style) {
    return el("a", { class: "gp-spot" + (WARM.has(x.word) ? " warm" : CHILL.has(x.word) ? " chill" : ""), href: godHref(x.god), title: `${name(x.god)}: ${x.word}`,
      style: Object.assign({ "--fire": fire(x.god) }, style || {}) }, icon(x.god, scale, mood(x.god, x.word)), withName ? el("span", { class: "gp-name" }, name(x.god)) : null, el("span", { class: "gp-word" }, x.word));
  }
  // desktop: the ten around the hero (the Unbothered: around Saint Avel's badge), the sworn god at the top
  function ring(g, h, big) {
    const s = big ? 2 : 1, R = big ? 150 : 118, box = 2 * R + 32 * s + (big ? 44 : 36), list = g.ring || [];
    const wrap = el("div", { class: "gp-ring" + (big ? " big" : ""), style: { width: box + "px", height: box + "px" } });
    wrap.appendChild(el("div", { class: "gp-mid" }, g.badge === "saint_avel" ? avel(big ? 4 : 2) : A.heroPortrait(h, big ? 4 : 2, { cls: "gp-hero" })));
    list.forEach((x, i) => {
      const t = -Math.PI / 2 + (i * 2 * Math.PI) / list.length;
      wrap.appendChild(spot(x, s, false, { left: box / 2 + R * Math.cos(t) + "px", top: box / 2 + R * Math.sin(t) + "px" }));
    });
    return wrap;
  }
  // the phone's ten: three rows (4, 3, 3) in the ring's order
  function grid(g) {
    const r = g.ring || [];
    return el("div", { class: "gp-grid" }, [r.slice(0, 4), r.slice(4, 7), r.slice(7)].filter((x) => x.length).map((xs) => el("div", { class: "gp-grid-row" }, xs.map((x) => spot(x, 2, true)))));
  }

  function pips(got, need) {
    const n = Math.min(need, 6);
    return el("span", { class: "gp-pips", "aria-hidden": "true" }, Array.from({ length: n }, (_, i) => el("i", { class: i < Math.round((got / need) * n) ? "on" : "" })));
  }
  function askCard(g, h, open) {
    const q = g.ask;
    if (!q) return null;
    const n = h.name, left = q.left, last = left != null && left <= 5;
    // today's plan names the ask when it swung the choice (gods_asks.ASK_WHY: "{n} is answering {god}")
    const today = q.motive || (h.why && h.why.includes(`answering ${name(q.god)}`) ? h.why.split("; ").find((x) => x.includes("answering")) : null);
    const how = (left == null ? PULL_DONE : PULL).replace("{n}", n);
    const chip = q.pulling || today ? el("span", { class: "gp-chip hot", title: today || how }, "▶ Today's plan")
      : el("span", { class: "gp-chip", title: how }, `On ${A.poss(n)} mind`);
    return el("div", { class: "gp-ask" + (q.great ? " great" : "") + (last ? " last" : ""), style: { "--fire": fire(q.god) } },
      el("a", { class: "gp-ask-god", href: godHref(q.god), title: name(q.god) }, icon(q.god, 1)),
      el("div", { class: "gp-ask-body" },
        el("div", { class: "gp-ask-text" }, q.great ? el("b", { class: "gp-big", title: "A big ask" }, open ? "A big ask: " : "★ ") : null, open || !q.head ? `“${q.text}”` : q.plain ? q.head : `“${q.head}”`,
          open && q.plain && q.head ? el("span", { class: "gp-ask-plain" }, " " + q.head) : null),
        el("div", { class: "gp-ask-meta" }, pips(q.got || 0, q.need || 1), el("b", null, `${q.got || 0} of ${q.need}`),
          left != null ? el("span", { class: last ? "gp-left last" : "gp-left" }, ` · ${left <= 0 ? "last day" : A.plural(left, "day") + " left"}`) : null, " ", chip),
        open ? el("div", { class: "gp-motive" }, today ? Cap(today) + ", today." : how) : null));
  }

  function token(g) {
    const o = g.token;
    if (!o) return null;
    const left = o.left > 0 ? ` (${A.plural(o.left, "more day")})` : "";
    const head = o.kind === "cross" ? `${Cap(name(o.god))} is cross` : o.kind === "help" ? `Help from ${name(o.god)}` : `A kindness from ${name(o.god)}`;
    return el("div", { class: "gp-token" + (o.kind === "cross" ? " wrath" : ""), style: { "--fire": fire(o.god) } },
      el("a", { class: "gp-token-ring", href: godHref(o.god), title: name(o.god) }, icon(o.god, 1, o.kind === "cross" ? crossFace(o.god) : null)),
      el("span", null, head, o.what ? `: ${o.what}` : "", left, o.why ? el("span", { class: "gp-token-why", style: { display: "block" } }, o.why) : ""));
  }
  function markLine(g) {
    const m = g.mark;
    if (!m) return null;
    return el("div", { class: "gp-mark", style: { "--fire": fire(m.god) } }, el("i", { class: "gp-mark-dot" }),
      el("span", null, `Marked by ${name(m.god)}`, m.day != null ? `, ${dayWord(m.day)}` : "", m.vow ? `: ${m.vow}` : "", m.pale ? " (gone pale)" : ""));
  }
  // the season's twist about this hero stays on the panel, whatever vow came after it
  function unmaskLine(g, h) {
    const u = g.unmasked;
    if (!u) return null;
    return el("div", { class: "gp-mark gp-unmask", style: { "--fire": fire(u.god) }, title: u.text }, el("i", { class: "gp-mark-dot" }),
      el("span", null, `${u.said}, ${dayWord(u.day)}.`));
  }
  function timeline(g, h, n) {
    const rows = g.timeline || [], t = g.tally || {};
    const sum = [t.asks_met ? A.plural(t.asks_met, "ask") + " met" : null, t.kindnesses ? A.plural(t.kindnesses, "kindness", "kindnesses") : null,
      t.wraths ? A.plural(t.wraths, "cross word") : null, t.artifacts ? A.plural(t.artifacts, "gift") : null].filter(Boolean).join(" · ");
    if (!rows.length) return el("p", { class: "gp-tl-none" }, "Nothing between them yet.");
    return el("div", { class: "gp-tl" }, sum ? el("div", { class: "gp-tl-sum" }, sum) : null,
      el("ol", null, rows.slice(-(n || 6)).reverse().map((x) => el("li", { style: { "--fire": fire(x.god) } }, el("span", { class: "gp-tl-day" }, A.when(x.day)), " ", A.richText(x.text, [h.id])))));
  }

  function build(sec, h) {
    const g = h.gods;
    let open = false;
    const draw = () => {
      sec.innerHTML = "";
      sec.className = "panel gods-panel" + (g.badge === "saint_avel" ? " unbothered" : "") + (open ? " open" : "");
      const toggle = el("button", { type: "button", class: "gp-toggle", "aria-expanded": open ? "true" : "false", onclick: () => { open = !open; draw(); } }, open ? "Show less ‹" : "Show all ten ›");
      const unbothered = g.badge === "saint_avel";
      sec.append(
        el("div", { class: "gp-head" }, el("h2", null, "The Gods"), unbothered ? [avel(1.5), el("span", { class: "gp-avel-say" }, "Saint Avel's badge, for the Unbothered")] : null),
        el("div", { class: "gp-main" },
          el("div", { class: "gp-words" },
            g.line ? el("p", { class: "gp-one" }, A.richText(g.line, [h.id])) : null,
            g.because ? el("p", { class: "gp-two" }, A.richText(g.because, [h.id])) : null,
            open && g.cold && g.cold !== g.because ? el("p", { class: "gp-two gp-cold" }, A.richText(g.cold, [h.id])) : null,
            open && unbothered ? el("p", { class: "gp-avel-story" }, AVEL) : null,
            open ? grid(g) : row(g),
            gifts(h), markLine(g), unmaskLine(g, h),
            lately(g, h),
            askCard(g, h, open),
            open ? el("div", { class: "gp-extra" }, token(g), el("h4", null, "Between them"), timeline(g, h))
              // the desktop ring is taller than the words: the latest of the timeline fills the space beside it
              : el("div", { class: "gp-extra gp-wide" }, token(g), (g.timeline || []).length ? [el("h4", null, "Between them"), timeline(g, h, 3)] : null),
            el("div", { class: "gp-foot" }, toggle, open ? el("a", { class: "gp-mountain", href: "#/gods" }, "The Mountain ›") : null)),
          ring(g, h, open)));
    };
    draw();
  }

  let readying = null;
  function ready() {
    if (!readying) readying = (S.gods ? Promise.resolve() : A.load("static_gods").then((d) => { for (const k of Object.keys(d)) S[k] = S[k] && typeof S[k] === "object" && !Array.isArray(S[k]) ? Object.assign(S[k], d[k]) : d[k]; }))
      .then(() => new Promise((res) => { GodArt.init({ fires: Object.fromEntries(Object.entries(S.gods.by || {}).map(([k, v]) => [k, v.fire])) }); GodArt.ready(res); }));
    return readying;
  }
  function panel(h) {
    if (!h || !h.gods) return null;
    const sec = el("section", { class: "panel gods-panel" });
    ready().then(() => build(sec, h), (e) => { console.error(e); sec.remove(); });
    return sec;
  }

  window.GodPanel = { panel, avel };
})();
