/* The enlistment quiz: a looks-only preview (class and temperament stay hidden), then a hero code to send to the commissioner. */
(function () {
  "use strict";
  const A = App;
  const { el, S, L } = A;
  const Q = S.quiz;

  function load() { try { return JSON.parse(localStorage.getItem("al.quiz") || "null"); } catch (e) { return null; } }
  function save(a) { try { localStorage.setItem("al.quiz", JSON.stringify(a)); } catch (e) { /* storage unavailable */ } }

  function lookFrom(ans) {
    const idx = (id) => Q.findIndex((q) => q.id === id);
    const v = (id, d) => (ans[idx(id)] == null ? d : ans[idx(id)]);
    return {
      skin: Q[idx("skin")].colors[v("skin", 1)], hair: Q[idx("hair")].colors[v("hair", 1)], style: v("style", 0), face: v("face", 0),
      fav: Q[idx("fav")].colors[v("fav", 5)], scars: [],
    };
  }

  function encode(ans) {
    const json = JSON.stringify({ v: 1, a: ans });
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  A.route(/^\/join$/, (v) => {
    const ans = (load() || []).slice(0, Q.length);
    while (ans.length < Q.length) ans.push(null);
    // the hidden hero-name slot mirrors the player's name, so the code format never changes
    const NAME = Q.findIndex((q) => q.id === "name"), OWNER = Q.findIndex((q) => q.id === "owner");
    ans[NAME] = ans[OWNER];
    const shown = Q.length - Q.filter((q) => q.hidden).length;
    let num = 0;
    v.appendChild(el("h1", null, "Join the League"));
    v.appendChild(el("p", { class: "muted" }, `Answer honestly (or don't). Your answers decide what your hero looks like, how they fight, what they're like, and what they might become. `,
      `You won't control them; you'll just get to watch. New heroes join at the start of the next season.`));
    const wrap = el("div", { class: "quiz" });
    const form = el("div");
    const prev = el("div", { class: "panel preview" });
    wrap.append(form, prev);
    v.appendChild(wrap);
    const out = el("div");
    v.appendChild(out);

    Q.forEach((q, i) => {
      if (q.hidden) { form.appendChild(el("div", { hidden: true })); return; }
      const box = el("section", { class: "panel q" }, el("h3", null, `${++num}. ${q.q}`));
      if (q.kind === "text") {
        const inp = el("input", { type: "text", maxlength: q.max, value: ans[i] || "", placeholder: "Your real first name, e.g. Sam" });
        inp.addEventListener("input", () => { ans[i] = inp.value.trim() || null; if (i === OWNER) ans[NAME] = ans[i]; changed(); });
        box.appendChild(inp);
      } else if (q.kind === "swatch") {
        const row = el("div", { class: "choices" });
        q.colors.forEach((c, k) => {
          const b = el("button", { class: "swatch" + (ans[i] === k ? " on" : ""), style: { background: c }, title: c, "aria-label": `colour ${k + 1}` });
          b.onclick = () => { ans[i] = k; [...row.children].forEach((x, j) => x.classList.toggle("on", j === k)); changed(); };
          row.appendChild(b);
        });
        box.appendChild(row);
      } else {
        const row = el("div", { class: "choices" });
        q.a.forEach((opt, k) => {
          const b = el("button", { class: ans[i] === k ? "on" : "" }, opt.t);
          b.onclick = () => { ans[i] = k; [...row.children].forEach((x, j) => x.classList.toggle("on", j === k)); changed(); };
          row.appendChild(b);
        });
        box.appendChild(row);
      }
      form.appendChild(box);
    });
    const done = el("button", { class: "btn primary", style: { fontSize: "18px" } }, "Get my hero code →");
    form.appendChild(el("div", { class: "row wrap" }, done, el("button", { class: "btn", onclick: () => { save([]); location.reload(); } }, "Start over")));
    done.onclick = () => {
      const missing = Q.findIndex((q, i) => ans[i] == null || ans[i] === "");
      if (missing >= 0) { A.toast(`Question ${Q.slice(0, missing + 1).filter((q) => !q.hidden).length} still needs an answer`); form.children[missing].scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      const code = encode(ans);
      out.innerHTML = "";
      out.appendChild(el("section", { class: "panel follow" }, el("h2", null, `${ans[0]} is ready`),
        el("p", null, `Send this code to ${L.meta.commissioner}. They'll add your hero, who joins at the start of ${L.meta.phase === "season" ? "next season" : "the season"}.`),
        el("div", { class: "code" }, code),
        el("div", { class: "row wrap", style: { marginTop: "8px" } },
          el("button", { class: "btn primary", onclick: () => A.copy(code, "Hero code copied") }, "Copy code"),
          el("button", { class: "btn", onclick: () => A.copy(`Here's my hero for the league: ${ans[0]}.\n${code}`, "Message copied") }, "Copy as a message")),
        el("p", { class: "small dim", style: { marginTop: "8px" } }, `For ${L.meta.commissioner}: python -m league enlist ${code.slice(0, 12)}…`)));
      out.scrollIntoView({ behavior: "smooth" });
    };

    function changed() { save(ans); drawPreview(); }
    function drawPreview() {
      prev.innerHTML = "";
      // only looks (questions 1-8) show here: class, gear and temperament stay a surprise so nobody can steer them
      const h = { id: "preview", look: lookFrom(ans), weapon: "none", weapon_tier: 1, armor_tier: 1, alive: true, name: ans[0] || "Your hero" };
      prev.appendChild(el("h3", null, ans[0] || "Your hero"));
      const cv = Art.heroGrid(h, 0, { look: { outfit: "vest", head: "none", aura: null, offhand: "none" } }).toCanvas(6);
      cv.className = "main";
      prev.appendChild(el("div", { style: { position: "relative", display: "inline-block" } }, cv));
      prev.appendChild(el("p", { class: "small muted" }, "Who they become depends on your answers. You'll find out when they join."));
      const answered = ans.filter((x, i) => !Q[i].hidden && x != null && x !== "").length;
      prev.appendChild(el("div", { class: "small muted" }, `${answered} / ${shown} answered`, A.bar(answered, shown, "gold")));
    }
    drawPreview();
  });
})();
