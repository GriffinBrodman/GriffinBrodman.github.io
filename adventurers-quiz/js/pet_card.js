/* The pet card on a hero page, after a season the beasts could talk (The Year the Beasts Spoke): the pet and its hero by the hearth, the pet saying its
   own words through the speech layer in its voice preset, what it is like, and the latest things it and the mount said. */
(function () {
  const A = App;
  const { el } = A;

  // a pet's sprite with a 1px light rim along its top edge, so a dark coat still separates from the floor
  function rimmed(img) {
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height + 1;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = "source-in"; x.fillStyle = "#d8c8a8"; x.fillRect(0, 0, c.width, c.height);
    const out = document.createElement("canvas");
    out.width = img.width; out.height = img.height;
    const o = out.getContext("2d");
    o.drawImage(c, 0, -1); o.drawImage(img, 0, 0);
    return out;
  }

  // the fire in two frames, 9 x 8 (r red, o orange, y yellow, w the white-hot core)
  const FLAME = [
    ["....y....", "...yy.o..", "..oyyo...", ".ooywyo..", ".oyywyoo.", "roywwyyor", "rooyyyoor", ".rrooorr."],
    ["...o.....", "..oy..y..", "..oyy.yo.", ".oyywyo..", "ooyywwyo.", "royywwyor", "rooyyyoor", ".rrooorr."],
  ];
  const FLAME_C = { r: "#c8401e", o: "#f07a2a", y: "#ffd27a", w: "#fff2c8" };
  // the room: plank walls, a stone hearth on the left with its fire (frame f), a rug, a floor of long boards lit along their front
  // edges, and a two-step dithered vignette
  function room(ctx, W, H, f) {
    const F = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }, FL = 30;
    for (let x = 0; x < W; x += 6) { F(x, 0, 6, FL, (x / 6) % 2 ? "#6e4426" : "#7a4c2a"); F(x, 0, 1, FL, "#3a2414"); F(x + 1, 0, 1, FL, "#8a5a32"); }
    F(0, FL - 4, W, 2, "#a87a48"); F(0, FL - 2, W, 2, "#5a3820");
    // boards the length of the room, deeper toward the viewer, each with a dark seam behind it and a lit front edge
    let fy = FL, row = 0;
    for (const bh of [3, 4, 4, 5, 5, 5]) {
      F(0, fy, W, bh, row % 2 ? "#9a6a3e" : "#a4743f"); F(0, fy, W, 1, "#3a2414"); F(0, fy + bh - 1, W, 1, "#c08a52");
      for (let x = 17 + ((row * 37) % 53); x < W; x += 58 + ((row * 11) % 17)) { F(x, fy + 1, 1, bh - 2, "#3a2414"); F(x + 1, fy + 1, 1, bh - 2, "#b88450"); }
      fy += bh; row++;
    }
    // the hearth: a surround of stone courses under a wooden mantel, an arched firebox with logs and the fire, a hearthstone in front
    const SC = ["#8a8076", "#7a7066", "#968c80"];
    F(3, 8, 22, FL - 7, "#4a423c");
    for (let r = 0, yy = 9; yy < FL; r++, yy += 3) for (let x = r % 2 ? 1 : 3, i = 0; x < 25; i++) {
      const w = 5 + ((r * 3 + i) % 3), x0 = Math.max(3, x), x1 = Math.min(25, x + w - 1);
      if (x1 > x0) { F(x0, yy, x1 - x0, 2, SC[(r + i) % 3]); F(x0, yy, x1 - x0, 1, "#a8a094"); }
      x += w;
    }
    F(1, 6, 26, 3, "#5a4030"); F(1, 6, 26, 1, "#8a6a48"); F(1, 8, 26, 1, "#2a1a10");
    F(8, 15, 12, FL - 15, "#1e120c"); F(9, 14, 10, 1, "#1e120c"); F(10, 13, 8, 1, "#1e120c"); F(9, 15, 10, 3, "#2a1a12");
    FLAME[f % 2].forEach((rw, j) => [...rw].forEach((ch, i) => { if (FLAME_C[ch]) F(9 + i, FL - 11 + j, 1, 1, FLAME_C[ch]); }));
    F(9, FL - 3, 10, 2, "#5a3418"); F(9, FL - 3, 1, 2, "#c89060"); F(18, FL - 3, 1, 2, "#c89060"); F(11, FL - 2, 6, 1, "#ff9a3a");
    F(1, FL, 26, 2, "#6a6056"); F(1, FL, 26, 1, "#9a9086");
    // a rug the two of them share
    F(30, 38, 56, 9, "#8a3a2a"); F(31, 39, 54, 7, "#a84a30"); F(33, 42, 50, 1, "#c8a050");
    for (let x = 34; x < 82; x += 4) F(x, 42, 2, 1, "#8a3a2a");
    // firelight on the left, falling off in a dither rather than a smooth gradient
    for (let y = 0; y < H; y++) for (let x = 0; x < 44; x++) if ((x + y) % 2 === 0 && x < 24 + (y % 4) * 4 + (f % 2)) { ctx.globalAlpha = 0.12; F(x, y, 1, 1, "#ffc070"); }
    ctx.globalAlpha = 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const e = Math.min(x, W - 1 - x, y, H - 1 - y);
      if (e < 1 || (e < 3 && (x + y) % 2 === 0) || (e < 5 && x % 2 === 0 && y % 2 === 0)) F(x, y, 1, 1, "#1a0e08");
    }
  }

  function stageFor(h, quotes) {
    if (!window.Tavern || !window.Speech || !h.pet) return null;
    // under the room a dark band holds the pet's words, so a long line never crosses a face
    const W = 112, H = 56, BAND = 22, wrap = el("div", { class: "tavern pet-card-stage" }), cv = document.createElement("canvas");
    cv.width = W; cv.height = H + BAND;
    wrap.appendChild(cv);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const st = Tavern.stage(W, H, 56, 8);
    // the hero on the left, turned to the pet; the pet on the right, turned up to answer
    const a = Tavern.actor(h, 3.9, 5.1, { lines: [], face: 1 });
    if (!a.pet) return null;
    Object.assign(a.pet, { u: 5.3, v: 3.8, face: -1, right: a.pet.right.map(rimmed), left: a.pet.left.map(rimmed), at: [st.iso(5.3, 3.8)[0], H + BAND] });
    let f = 0, seen = false;
    const draw = () => {
      room(ctx, W, H, f);
      ctx.fillStyle = "#1a0e08"; ctx.fillRect(0, H, W, BAND);
      Tavern.drawActor(ctx, st, a, 0, 0);
      Tavern.drawPet(ctx, st, a.pet, 0, 99);
    };
    draw();
    const still = () => (window.Settings && Settings.calm ? Settings.calm() : false);
    const iv = setInterval(() => {
      if (!wrap.isConnected) { if (seen) clearInterval(iv); return; }
      seen = true;
      if (!document.hidden && !still()) { f++; draw(); }
    }, 300);
    const talk = Tavern.talk(wrap, cv, st);
    const mine = quotes.filter((q) => q.who === "pet").map((q) => q.text);
    let i = mine.length - 1;
    const say = () => { if (mine.length) { talk.say(a.pet, "{talk}" + mine[(i + mine.length) % mine.length], 5); i -= 1; } };
    cv.addEventListener("click", say);
    setTimeout(() => { if (wrap.isConnected) say(); }, 400);
    const btn = mine.length ? el("button", { class: "btn small", onclick: say }, `Hear ${h.pet.name}`) : null;
    return el("div", { class: "pet-card-play" }, wrap, btn);
  }

  function card(h) {
    const b = h.beasts;
    if (!b || !(b.quotes || []).length) return null;
    const lead = b.talking ? "Can talk this season" : "Talked, the year the beasts spoke";
    const rows = b.quotes.slice().reverse().slice(0, 4).map((q) => el("li", { class: "pet-quote" + (q.no ? " no" : "") },
      el("span", { class: "pet-quote-who" }, q.name + (q.no ? ", disagreeing" : "")), el("span", { class: "pet-quote-text" }, `“${q.text}”`),
      el("span", { class: "tiny dim" }, ` · ${A.when(q.day)}`)));
    const facts = [`${b.said} thing${b.said === 1 ? "" : "s"} said`, b.argued ? `${b.argued} argument${b.argued === 1 ? "" : "s"} with ${h.name}` : null].filter(Boolean).join(" · ");
    return el("div", { class: "pet-card" },
      el("div", { class: "pet-card-head" }, el("b", { class: "gold" }, lead), b.nature && h.pet ? el("span", { class: "tiny" }, ` · ${h.pet.name} is ${b.nature}.`) : null,
        b.mount_nature && h.mount ? el("span", { class: "tiny" }, ` ${h.mount.name} is ${b.mount_nature}.`) : null),
      stageFor(h, b.quotes),
      el("ul", { class: "pet-quotes" }, rows),
      el("div", { class: "tiny dim" }, facts));
  }

  window.PetCard = { card };
})();
