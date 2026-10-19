/* The Settings page (#/settings): sound, talking text and motion, kept in this browser, with a hero to try them on. */
(function () {
  const A = App;
  const { el, L } = A;
  const { panel } = Views;

  const SAMPLES = ["Evening! The {em}stew{/} here is... {beat}fine.", "{whisper}Don't tell the barkeep,{/} but I {slam}WON{/} the dice!",
    "Did you hear that? {shake}Something's in the cellar.{/}", "{wave}La la la~{/} I'm in a {drawl}great{/} mood tonight.", "Right. {beat}{fast}Nobody-panic-it's-only-a-rat.{/}"];

  // one hero (yours if you've picked one) on a scrap of tavern floor, saying sample lines through the same speech layer as the scenes
  function tryIt() {
    const ids = A.mine(), h = A.heroes[ids.find((id) => A.heroes[id])] || (L.heroes || []).find((x) => x.alive) || (L.pending || [])[0];
    const W = 120, H = 64, wrap = el("div", { class: "tavern say-try" }), cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    wrap.appendChild(cv);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const st = Tavern.stage(W, H, 60, 6);
    const a = h ? Tavern.actor(h, 6.2, 5.6, { lines: SAMPLES }) : { name: "A stranger", at: [W / 2, 24] };
    if (a.pet) { a.pet.u = 5.6; a.pet.v = 6.4; a.pet.face = 1; }
    const draw = () => {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#2a1b11"); g.addColorStop(1, "#4a2e1a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#5c3c24"; for (let y = 44; y < H; y += 5) ctx.fillRect(0, y, W, 1);
      if (h) { Tavern.drawActor(ctx, st, a, 0, 0); if (a.pet) Tavern.drawPet(ctx, st, a.pet, 0, 99); }
    };
    draw();
    const talk = Tavern.talk(wrap, cv, st);
    let i = 0;
    const say = () => { talk.say(a, SAMPLES[i++ % SAMPLES.length], 4); };
    const pat = () => { if (a.pet) talk.say(a.pet, Speech.pat(a.pet), 3); };
    const btns = el("div", { class: "say-try-btns" },
      el("button", { class: "btn small", onclick: say }, "Say something"),
      a.pet ? el("button", { class: "btn small", onclick: pat }, `Pat ${a.pet.name}`) : null);
    cv.addEventListener("click", say);
    setTimeout(() => { if (wrap.isConnected) say(); }, 300);
    return el("div", null, wrap, btns, el("p", { class: "tiny dim" }, "Sounds start after your first click or key press on the page."));
  }

  A.needs(/^\/settings$/, A.PLACES.concat(["tavern"]));
  A.route(/^\/settings$/, (v) => {
    v.appendChild(el("h1", null, "Settings"));
    v.appendChild(el("p", { class: "muted" }, "Kept in this browser only, and they apply straight away."));
    v.appendChild(el("div", { class: "grid2 even" }, panel(null, Settings.panel()), panel("Try it", tryIt())));
  });
})();
