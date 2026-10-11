/* The enlistment quiz: live sprite preview, then a hero code to send to the commissioner. */
(function () {
  "use strict";
  const A = App;
  const { el, S, L } = A;
  const Q = S.quiz;
  const PATH_CLASS = { melee: "warrior", ranged: "ranger", magic: "mage" };
  const WEAPON_FOR = { melee: ["sword", "axe", "mace", "spear", "frying_pan", "daggers"], ranged: ["bow", "crossbow"], magic: ["staff", "wand", "lute"] };
  const DEFAULT_W = { melee: "sword", ranged: "bow", magic: "staff" };
  const ARMOR = { warrior: "chain", ranger: "leather", mage: "cloth" };
  const WORDS = { boldness: ["timid", "cautious", "steady", "bold", "fearless"], risk: ["careful", "prudent", "measured", "daring", "reckless"] };

  function load() { try { return JSON.parse(localStorage.getItem("al.quiz") || "null"); } catch (e) { return null; } }
  function save(a) { try { localStorage.setItem("al.quiz", JSON.stringify(a)); } catch (e) { /* storage unavailable */ } }

  function derive(ans) {
    const path = { melee: 0, ranged: 0, magic: 0 };
    const tr = { boldness: 0, risk: 0 };
    let weapon = null, pet = null;
    Q.forEach((q, i) => {
      const a = ans[i];
      if (q.kind !== "choice" || a == null) return;
      const fx = q.a[a].fx || {};
      for (const [k, v] of Object.entries(fx.path || {})) path[k] += v;
      for (const [k, v] of Object.entries(fx.tr || {})) if (k in tr) tr[k] += v;
      if (fx.weapon) weapon = fx.weapon;
      if (fx.pet) pet = fx.pet;
    });
    const best = Math.max(...Object.values(path));
    const tied = Object.keys(path).filter((k) => path[k] === best);
    const p = tied[0];
    const cls = PATH_CLASS[p];
    const fam = WEAPON_FOR[p].includes(weapon) ? weapon : DEFAULT_W[p];
    return { cls, tied: tied.length > 1 && best > 0 ? tied.map((t) => PATH_CLASS[t]) : null, weapon: fam, pet, tr };
  }

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
      const box = el("section", { class: "panel q" }, el("h3", null, `${i + 1}. ${q.q}`));
      if (q.kind === "text") {
        const inp = el("input", { type: "text", maxlength: q.max, value: ans[i] || "", placeholder: q.id === "name" ? "e.g. Brix Ironbelly" : "Your name" });
        inp.addEventListener("input", () => { ans[i] = inp.value.trim() || null; changed(); });
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
      if (missing >= 0) { A.toast(`Question ${missing + 1} still needs an answer`); form.children[missing].scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      const code = encode(ans);
      out.innerHTML = "";
      const d = derive(ans);
      out.appendChild(el("section", { class: "panel follow" }, el("h2", null, `${ans[0]} is ready`),
        el("p", null, `Send this code to ${L.meta.commissioner}. They'll add your hero, who joins at the start of ${L.meta.phase === "season" ? "next season" : "the season"}.`),
        el("div", { class: "code" }, code),
        el("div", { class: "row wrap", style: { marginTop: "8px" } },
          el("button", { class: "btn primary", onclick: () => A.copy(code, "Hero code copied") }, "Copy code"),
          el("button", { class: "btn", onclick: () => A.copy(`Here's my hero for the league: ${ans[0]}, ${d.tied ? "torn between " + d.tied.map((c) => S.classes[c].name).join(" and ") : "a " + S.classes[d.cls].name}.\n${code}`, "Message copied") }, "Copy as a message")),
        el("p", { class: "small dim", style: { marginTop: "8px" } }, `For ${L.meta.commissioner}: python -m league enlist ${code.slice(0, 12)}…`)));
      out.scrollIntoView({ behavior: "smooth" });
    };

    function changed() { save(ans); drawPreview(); }
    function drawPreview() {
      prev.innerHTML = "";
      const d = derive(ans);
      const h = { look: lookFrom(ans), weapon: d.weapon, weapon_tier: 1, armor_tier: 1, alive: true, cls: d.cls, name: ans[0] || "Your hero" };
      prev.appendChild(el("h3", null, ans[0] || "Your hero"));
      const box = el("div", { style: { position: "relative", display: "inline-block" } }, A.heroSprite(h, 6, { cls: "main" }));
      if (d.pet) { const p = A.petSprite({ kind: d.pet, name: ans[0] || "pet" }, 4); p.style.position = "absolute"; p.style.right = "-30px"; p.style.bottom = "0"; p.style.width = "56px"; box.appendChild(p); }
      prev.appendChild(box);
      prev.appendChild(el("p", { class: "gold" }, `Starts as a ${S.classes[d.cls].name}`));
      if (d.tied) prev.appendChild(el("p", { class: "tiny dim" }, `Torn between ${d.tied.map((c) => S.classes[c].name).join(" and ")}; fate will decide.`));
      const w = (t) => WORDS[t][Math.min(4, Math.max(0, Math.floor((Math.max(-1, Math.min(1, d.tr[t])) + 1) / 0.4)))];
      prev.appendChild(el("p", { class: "small" }, `Boldness: ${w("boldness")} · Risk: ${w("risk")}`));
      prev.appendChild(el("p", { class: "tiny dim" }, `Wielding: ${d.weapon.replace("_", " ")} · ${ARMOR[d.cls]} armor`));
      const answered = ans.filter((x) => x != null && x !== "").length;
      prev.appendChild(el("div", { class: "small muted" }, `${answered} / ${Q.length} answered`, A.bar(answered, Q.length, "gold")));
    }
    drawPreview();
  });
})();
