/* Road art: travellers' bust portraits, crew group portraits, a parametric fallback for any traveller, roadside place icons, tiny map pins, and travellers as fight and scene sprites; every piece an Art.Grid drawn from data. */
/*
  RoadArt.bust(spec)            -> Grid 40x40: a named traveller's bust (the paper doll in their look, their props, a road backdrop),
                                   or a crew's group portrait (72x40) when spec is a crew; anything unknown gets the fallback.
  RoadArt.crew(spec)            -> Grid 72x40: a crew's group portrait (the Fourth-Best Company, the circus, a goblin pack, the players,
                                   the Grey Procession, or a fallback built from spec.members).
  RoadArt.fallback(spec)        -> the parametric bust or crew portrait from { id, name, kind: "person"|"crew", role, palette?, members? }.
  RoadArt.figure(spec, frame, member?) -> Grid ~28x34 facing right: a traveller standing on the road (a crew's member by index or id).
  RoadArt.fighter(u, frame)     -> Grid facing right for a fight lineup (u.ref or u.traveller = traveller id, u.member = crew member).
  RoadArt.icon(kind)            -> Grid 16x16: a place kind's daybook icon. RoadArt.KINDS lists the kinds.
  RoadArt.pin(kind)             -> Grid 11x14 map pin (RoadArt.PIN = { w, h, tipX, tipY }); RoadArt.drawPin(ctx, kind, x, y, k) draws one with
                                   its point at (x, y), at least k px per pixel (more where the map is shown small, so a pin is ~13 css px
                                   wide on a phone), and returns its box { x, y, w, h, k } in canvas pixels (for tap targets);
                                   RoadArt.pinPx(ctx, k) is that pixel size: a tap target is PIN.w * pinPx by PIN.h * pinPx.
  RoadArt.spec(t)               -> the traveller spec RoadArt resolves an id, a name or an object to: { key, id, name, what, kind, members }.

  Looks: S.road.travellers[id].look (league content, the COMPANION_LOOKS format) wins when exported; LOOKS below is the art's own copy
  (the eight promoted companions match league/content/solo.py COMPANION_LOOKS).

  WIRING (for the engine; road_art.js and road_scenes.js load eagerly after mount_art.js / beasts.js, road.css after daybook.css):
    index.html   <link rel="stylesheet" href="css/road.css"> and, after wild_scenes.js: <script src="js/road_scenes.js"></script>
                 <script src="js/road_art.js"></script>
    replay.js    KIT.road = ["food_art", "road_replay"]; a #/road/<id> route that stages RoadReplay.player(rec) with controls(fig.replay, ...).
                 Fights: first line of unitGrid(u, frame): if (u.kind === "traveller" && window.RoadArt) return RoadArt.fighter(u, frame);
                 (u.ref = traveller id, u.member = crew member id or index; side and row as for any unit).
    daybook.js   a road stretch block {act: "road_*", road: {biome, hour, weather, theme?, place_kind?, heroes?}} gets
                 RoadScenes.strip(block.road, { heroes }) appended behind its text (class "road-strip"; see road.css).
    isle.js      drawMap, before the hero loop: for (const p of opts.pins || []) { const [x, y] = project(p.xy[0], p.xy[1]); RoadArt.drawPin(ctx, p.kind, x * k, y * k, k); }
                 with the discovered places only.
*/
(function (root) {
  "use strict";
  const A = root.Art, Pt = root.Paint;
  const { Grid, mix, hash, rng } = A;
  const INK = "#120e14";

  // ---------- grids ----------
  function paste(dst, src, dx, dy, fn) {
    if (!src) return dst;
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      let c = src.px[y * src.w + x];
      if (!c) continue;
      if (fn) { c = fn(c, x, y); if (!c) continue; }
      dst.set(x + dx, y + dy, c);
    }
    return dst;
  }
  function crop(g, x0, y0, w, h) { const o = new Grid(w, h); paste(o, g, -x0, -y0); return o; }
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.55 + (n & 255) * 0.15) / 255; };
  // a shaded drawing on a Paint canvas, rendered with the hero painter's ramps
  function painted(w, h, pal, fn, o) {
    const P = new Pt.Paint(w, h);
    fn(P);
    const mats = {};
    for (const k in pal) mats[k] = Pt.ramp(pal[k]);
    return P.render(mats, Object.assign({ outline: INK }, o || {}));
  }
  const BAY = [0, 0.5, 0.75, 0.25];
  const dith = (x, y) => BAY[(x & 1) + (y & 1) * 2];

  // ---------- who is who ----------
  // the art's copy of each traveller's look (hair style and face use the quiz numbering; kit pieces use paint.js art names)
  const LOOKS = {
    aldo: { name: "Brother Aldo", what: "a pilgrim walking to every shrine", skin: "#c98e62", hair: "#9a9aa6", style: 4, face: 2, fav: "#7a5a3a", outfit: "robe", tier: 1, weapon: "staff", neck: "beads", prop: "shell", sky: "day", motif: "spire" },
    wenna: { name: "Wenna", what: "a pedlar with a squeaky handcart", skin: "#e8b088", hair: "#c46a2c", style: 7, face: 0, fav: "#a04a3a", outfit: "vest", head: "bandana", neck: "scarf", prop: "cart", sky: "day" },
    vane: { name: "Lady Perpetua Vane", what: "a lost noble walking home to Ironhaven", skin: "#f6d5b8", hair: "#b8783a", style: 21, face: 0, fav: "#2e5a6a", outfit: "fancy", tier: 3, head: "feather_cap", head_tier: 3, neck: "pearl", prop: "parasol", sky: "dusk" },
    lark: { name: "Lark", what: "a courier who never says what's in the satchel", skin: "#6e4428", hair: "#1c1a1f", style: 12, face: 0, fav: "#3a6a4a", outfit: "leather", prop: "satchel", sky: "day" },
    osk: { name: "Osk", what: "a tax collector who would rather not be recognised", skin: "#f6d5b8", hair: "#4b2e1e", style: 0, face: 3, fav: "#6a5040", outfit: "cloak", head: "hood", head_tier: 0, offhand: "ledger", off_tier: 2, sky: "day" },
    lantern_lady: { name: "the Lantern Lady", what: "a ghost at Gallows Cross", skin: "#e8e4dc", hair: "#cfd6e0", style: 16, face: 0, fav: "#6a7a8a", outfit: "cloak", tier: 3, head: "hood", head_tier: 1, prop: "lantern", ghost: true, sky: "night", motif: "gallows" },
    maudie: { name: "Old Maudie", what: "a drover with three cows", skin: "#e8b088", hair: "#efe2c0", style: 7, face: 0, fav: "#6a7a3a", outfit: "cloak", head: "wide_hat", head_tier: 1, weapon: "staff", prop: "cow", sky: "day" },
    ines: { name: "Ines", what: "a mapmaker who keeps getting lost", skin: "#f6d5b8", hair: "#1c1a1f", style: 15, face: 0, fav: "#2a6a8a", outfit: "cloak", offhand: "ledger", off_tier: 0, prop: "map", sky: "day" },
    pim: { name: "Pim", what: "a runaway apprentice", skin: "#f6d5b8", hair: "#e0b45a", style: 14, face: 0, fav: "#4a7a8a", outfit: "vest", head: "leather_cap", head_tier: 0, back: "backpack", back_tier: 0, prop: "flour", sky: "day" },
    rue: { name: "Sister Rue", what: "a nun who swears beautifully", skin: "#a06a42", hair: "#1c1a1f", style: 0, face: 0, fav: "#2e2a2a", outfit: "robe", head: "hood", head_tier: 3, neck: "scarf", neck_gem: "#ece6da", prop: "grawlix", sky: "day" },
    teodor: { name: "Teodor", what: "a minstrel who knows half of every song", skin: "#a06a42", hair: "#1c1a1f", style: 1, face: 3, fav: "#b8402a", outfit: "fancy", head: "feather_cap", head_tier: 2, weapon: "lute", prop: "notes", sky: "dusk" },
    marigold: { name: "Marigold", what: "a travelling cook with a pot on her back", skin: "#c98e62", hair: "#4b2e1e", style: 5, face: 0, fav: "#c87a2a", outfit: "vest", neck: "scarf", neck_gem: "#e8d8b0", prop: "pot", sky: "dusk" },
    aldous: { name: "Sir Aldous Puddle", what: "a knight errant on a very old horse", skin: "#e8b088", hair: "#efe2c0", style: 4, face: 3, fav: "#3a5a8a", outfit: "plate", tier: 2, weapon: "spear", weapon_tier: 1, offhand: "shield", off_tier: 1, prop: "horse", sky: "day", motif: "bridge" },
    mags: { name: "Mags Halloran", what: "a bounty hunter", skin: "#c98e62", hair: "#7a4424", style: 17, face: 0, fav: "#5a3a2a", outfit: "leather", tier: 3, head: "tricorn", head_tier: 1, weapon: "crossbow", weapon_tier: 3, neck: "scarf", scars: ["scar"], prop: "poster", sky: "dusk" },
    mabb: { name: "Captain Mabb", what: "the captain of the Fourth-Best Company", skin: "#e8b088", hair: "#8a3a1c", style: 13, face: 2, fav: "#8a6a2a", outfit: "chain", tier: 2, head: "helm", head_tier: 1, weapon: "sword", weapon_tier: 2, offhand: "shield", off_tier: 0, prop: "badge", sky: "day" },
    twice: { name: "Twice", what: "who says everything twice", skin: "#6e4428", hair: "#1c1a1f", style: 11, face: 1, fav: "#8a6a2a", outfit: "leather", tier: 1, head: "leather_cap", head_tier: 0, weapon: "axe", sky: "day" },
    strongwoman: { name: "Big Berta", what: "the circus strongwoman", skin: "#c98e62", hair: "#2a1c14", style: 18, face: 0, fav: "#b8302a", outfit: "vest", tier: 1, neck: "torc", sky: "dusk" },
    fire_eater: { name: "Salvo", what: "the circus fire-eater", skin: "#a06a42", hair: "#1c1a1f", style: 3, face: 3, fav: "#d8a838", outfit: "motley", tier: 2, sky: "dusk" },
    player_king: { name: "the Player King", what: "who plays every king", skin: "#f6d5b8", hair: "#7a4424", style: 1, face: 2, fav: "#8e2a2a", outfit: "fancy", tier: 3, head: "crown", head_tier: 0, offhand: "skull", off_tier: 1, sky: "dusk" },
    player_mask: { name: "Merrow", what: "who plays everyone else", skin: "#e8b088", hair: "#c46a2c", style: 10, face: 0, fav: "#2a6a5a", outfit: "motley", tier: 2, mark: "domino", sky: "dusk" },
  };
  const CREWS = {
    fourth_best: { name: "the Fourth-Best Company", what: "a rival crew who always arrive second", members: ["mabb", "twice", "reputation"], face: "mabb" },
    circus: { name: "Mumchance & Daughters' Circus", what: "wagons, a strongwoman, a fire-eater and a bear in a hat", members: ["archbishop", "strongwoman", "fire_eater"], face: "archbishop" },
    goblins: { name: "the Muddyfoot goblins", what: "a pack of goblins on the move", members: ["gob_grunt", "gob_archer", "gob_shaman", "gob_small"], face: "gob_grunt" },
    players: { name: "the Wagonwheel Players", what: "a troupe who put on plays from a fold-out stage", members: ["player_king", "player_mask"], face: "player_king" },
    grey_procession: { name: "the Grey Procession", what: "silent pilgrims who walk at night", members: ["grey"], face: "grey" },
  };
  // what a traveller's name or id may be written as, and which art it is
  const ALIAS = {
    "brother aldo": "aldo", wenna: "wenna", "lady perpetua vane": "vane", "perpetua vane": "vane", "lady vane": "vane", lark: "lark", osk: "osk",
    "the lantern lady": "lantern_lady", "lantern lady": "lantern_lady", "the lantern lady of gallows cross": "lantern_lady", "old maudie": "maudie", maudie: "maudie",
    ines: "ines", pim: "pim", "sister rue": "rue", teodor: "teodor", marigold: "marigold", "sir aldous puddle": "aldous", "sir aldous": "aldous",
    "mags halloran": "mags", mags: "mags", "captain mabb": "mabb", mabb: "mabb", twice: "twice",
    "the fourth-best company": "fourth_best", "fourth-best company": "fourth_best", fourth_best_company: "fourth_best", fourth_best: "fourth_best",
    "mumchance & daughters' circus": "circus", "mumchance and daughters' circus": "circus", mumchance: "circus", circus: "circus",
    goblin_pack: "goblins", "a pack of goblins": "goblins", goblins: "goblins", troupe: "players", players: "players", "the travelling players": "players",
    muddy_boot: "goblins", "the muddy boot pack": "goblins", gilded_thimble: "players", "the gilded thimble players": "players",
    "the grey procession": "grey_procession", "grey procession": "grey_procession", grey_procession: "grey_procession",
  };
  const S = () => (root.App && root.App.S) || (root.LD && root.LD.static) || {};
  const exported = (id) => { const R = S().road || {}; return (R.travellers || {})[id] || null; };
  const norm = (s) => String(s || "").toLowerCase().trim();
  function keyOf(t) {
    if (!t) return null;
    const cands = typeof t === "string" ? [t] : [t.art, t.id, t.name];
    for (const c of cands) {
      const n = norm(c);
      if (!n) continue;
      if (LOOKS[n] || CREWS[n]) return n;
      if (ALIAS[n]) return ALIAS[n];
      const u = n.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      if (LOOKS[u] || CREWS[u]) return u;
      if (ALIAS[u]) return ALIAS[u];
    }
    return null;
  }
  function spec(t) {
    const o = typeof t === "string" ? { id: t } : Object.assign({}, t || {});
    const ex = o.id ? exported(o.id) : null;
    if (ex) for (const k in ex) if (o[k] === undefined) o[k] = ex[k];
    const key = keyOf(o);
    const known = key ? LOOKS[key] || CREWS[key] : null;
    const crew = CREWS[key] || o.kind === "crew" || (o.members && o.members.length > 1);
    return Object.assign({ key, id: o.id || key || norm(o.name) || "traveller", name: o.name || (known && known.name) || "a traveller", what: o.what || (known && known.what) || o.role || "",
      kind: crew ? "crew" : "person", members: o.members || (CREWS[key] && CREWS[key].members) || null, role: o.role || "", look: o.look || null, palette: o.palette || null }, { raw: o });
  }

  // ---------- the paper doll, as export._npc_art builds it for the night scenes ----------
  function npc(id, lk) {
    const part = (art, t) => (art ? { art, tier: t, glow: null } : null);
    const tier = (v, d) => (v === undefined || v === null ? d : v);
    const kit = {
      weapon: { family: lk.weapon || "none", tier: tier(lk.weapon_tier, 1), two: false, glow: null }, offhand: part(lk.offhand, tier(lk.off_tier, 1)),
      armor: { tier: tier(lk.tier, 2), outfit: lk.outfit || "cloak", glow: null }, head: part(lk.head, tier(lk.head_tier, 1)), back: part(lk.back, tier(lk.back_tier, 1)),
      neck: lk.neck ? { art: lk.neck, gem: lk.neck_gem || null, glow: null } : null, rings: [], pocket: null, mark: lk.mark || null,
    };
    const look = { skin: lk.skin, hair: lk.hair, style: lk.style || 0, face: lk.face || 0, fav: lk.fav, scars: lk.scars || [] };
    if (lk.child) look.child = true;
    const h = { id: "road:" + id, name: lk.name || id, look, kit, weapon: kit.weapon.family, weapon_tier: kit.weapon.tier, armor_tier: kit.armor.tier };
    return { h, cls: { look: { outfit: kit.armor.outfit, head: "none", aura: null, offhand: "none" } } };
  }
  function lookOf(key, sp) {
    const ex = sp && sp.look;
    // a traveller the art has drawn by hand keeps that drawing; the league's look fills in only what the art left open
    return ex ? Object.assign({}, ex, LOOKS[key] || {}) : LOOKS[key];
  }

  // ---------- backdrops ----------
  const SKIES = {
    day: { sky: ["#8eb6c8", "#b4d0d4", "#dce4c8"], far: "#7e9a6a", near: "#5e7a4a", road: "#b89a6a", sun: "#fff2c0" },
    dusk: { sky: ["#3e4a6a", "#c0705a", "#f0b070"], far: "#5a4a4a", near: "#3e3a34", road: "#8a6a4a", sun: "#ffd890" },
    night: { sky: ["#0c1230", "#18224a", "#2a3460"], far: "#1c2638", near: "#141c28", road: "#3a3a44", sun: "#f0e8c8" },
    dawn: { sky: ["#6a7a9a", "#e0a08a", "#f6d6a0"], far: "#6a6a62", near: "#4a5040", road: "#a08868", sun: "#fff0c8" },
  };
  function backdrop(w, h, sky, seed, motif) {
    const T = SKIES[sky] || SKIES.day, g = new Grid(w, h), r = rng(seed);
    const hz = Math.round(h * 0.62), n1 = r() * 9, n2 = r() * 9;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = y / hz * 2, i = Math.floor(t), f = t - i;
      g.px[y * w + x] = T.sky[Math.min(2, f > dith(x, y) ? i + 1 : i)] || T.sky[2];
    }
    if (sky === "night") for (let i = 0; i < w * h / 70; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * hz * 0.9); g.set(x, y, r() < 0.3 ? "#f0e8c8" : "#8a94b8"); }
    const sx = Math.round(w * (0.12 + r() * 0.1)), sy = Math.round(h * 0.18);
    if (sky !== "day" || r() < 0.6) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) g.set(sx + x, sy + y, x * x + y * y > 5 ? mix(T.sun, T.sky[0], 0.35) : T.sun);
    for (let x = 0; x < w; x++) {
      const top = Math.round(hz - 3 - Math.sin(x * 0.11 + n1) * 2.2 - Math.sin(x * 0.29 + n2) * 1.2);
      for (let y = top; y < h; y++) g.set(x, y, y > hz + 2 ? T.near : T.far);
      const rt = hz + 5 + Math.round(Math.sin(x * 0.07 + n2));
      for (let y = rt; y < rt + 3; y++) g.set(x, y, (x + y) % 5 === 0 ? mix(T.road, T.near, 0.3) : T.road);
    }
    if (motif) MOTIF[motif] && MOTIF[motif](g, w, hz, T);
    // a soft frame: the corners darken toward the card edge
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.max(Math.abs(x + 0.5 - w / 2) / (w / 2), Math.abs(y + 0.5 - h / 2) / (h / 2));
      if (d > 0.9 && dith(x, y) < (d - 0.9) * 10) g.px[y * w + x] = mix(g.px[y * w + x], "#1a1412", 0.35);
    }
    return g;
  }
  const MOTIF = {
    spire: (g, w, hz, T) => { const x = w - 9; for (let y = hz - 11; y < hz; y++) g.hline(x - (y > hz - 6 ? 2 : 1), x + (y > hz - 6 ? 2 : 1), y, mix(T.far, "#2a2a30", 0.3)); g.vline(x, hz - 15, hz - 11, mix(T.far, "#2a2a30", 0.3)); g.set(x, hz - 7, "#f0d070"); },
    gallows: (g, w, hz) => { const c = "#0a0e1a", x = w - 10; g.vline(x, hz - 14, hz, c); g.hline(x - 6, x, hz - 14, c); g.vline(x - 6, hz - 13, hz - 10, c); g.line(x - 3, hz - 14, x, hz - 11, c); },
    bridge: (g, w, hz, T) => { const c = mix(T.far, "#6a6a70", 0.5); for (let x = w - 16; x < w - 1; x++) { const a = Math.round(Math.sin((x - w + 16) / 15 * Math.PI) * 3); g.set(x, hz - 2 - a, c); g.set(x, hz - 1 - a, c); } },
  };

  // ---------- props drawn around a bust (back: behind the figure; front: over it) ----------
  const PROPS = {
    shell: { front: (P) => { P.ell(25.5, 34, 2.4, 2.1, "shell", { s: 0.2 }); for (const x of [24, 25.5, 27]) P.px(x, 34.5, "shell", -0.6); } },
    cart: {
      back: (P) => {
        P.rect(27, 25, 13, 7, "wood", (x, y) => (y === 25 ? 0.4 : (x - 27) % 4 === 0 ? -0.4 : 0));
        P.ell(30, 23.5, 2.4, 2, "apple", { s: 0.2 }); P.ell(34.5, 23, 2.2, 2.2, "cloth", { s: 0.1 }); P.ell(38.5, 23.5, 2, 1.8, "cheese", { s: 0.2 });
        P.ell(33, 33, 4.2, 4.2, "wheel", { s: 0, k: 0.4 }); P.ell(33, 33, 2.4, 2.4, "wood", { s: -0.2 }); P.px(33, 33, "iron");
      },
    },
    parasol: {
      back: (P) => {
        P.line(9, 12, 15, 34, "wood", 0.1);
        P.poly([[0, 13], [4, 4], [12, 1], [19, 5], [21, 11]], "lace", (x, y) => 0.35 - (y - 1) * 0.05 + ((x + y) % 4 === 0 ? -0.35 : 0));
        for (const [x, y] of [[0, 13], [5, 12], [10, 12], [16, 12], [21, 11]]) P.px(x, y + 1, "lace", -0.4);
      },
    },
    satchel: { front: (P) => { P.line(12, 27, 27, 38, "strap", 0.1); P.rect(25, 33, 9, 7, "satch", (x, y) => (y === 33 ? 0.4 : -0.05)); P.rect(25, 33, 9, 3, "satch", 0.25); P.ell(29.5, 35.5, 1.2, 1.2, "wax", { s: 0.3 }); } },
    lantern: {
      front: (P) => {
        P.line(31, 22, 31, 25, "iron", 0);
        P.rect(28.5, 25, 5, 1, "iron", 0.2); P.rect(29, 26, 4, 6, "flame", (x, y) => 0.6 - Math.abs(x - 30.5) * 0.4 - (y - 26) * 0.08);
        P.rect(28.5, 32, 5, 1, "iron", -0.2); P.px(28.5, 26, "iron", 0); P.px(32.5, 26, "iron", -0.2);
      },
    },
    cow: {
      front: (P) => {
        P.ell(35, 33, 5.2, 4.6, "cow", { s: 0.1 });
        P.ell(37.5, 31, 2.2, 2.6, "cowp", { s: -0.1 });
        P.ell(31.5, 37.2, 3.4, 2.4, "muzzle", { s: 0.15 });
        P.px(30.5, 37, "ink"); P.px(32.5, 37.4, "ink");
        P.ell(29.6, 29, 2.2, 1.1, "cow", { s: 0.2 }); P.ell(30, 27.6, 0.9, 1.4, "horn", { s: 0.3 });
        P.px(33, 31.5, "ink"); P.px(33, 30.6, "cow", 0.6);
        P.ell(35.5, 39, 1.4, 1.3, "bell", { s: 0.3 });
      },
    },
    map: { front: (P) => { P.poly([[26, 30], [38, 27], [39, 36], [27, 39]], "paper", (x, y) => 0.2 - (y - 27) * 0.02); P.line(28, 33, 36, 30, "inkred", 0); P.px(31, 32, "inkred", 0); P.px(34, 34, "ink", 0); P.line(9, 6, 13, 13, "quill", 0.4); } },
    flour: { front: (P) => { for (const [x, y] of [[15, 21], [16, 22], [14, 22], [24, 14], [25, 15]]) P.px(x, y, "flour", 0.3); P.ell(30, 35, 4, 2.6, "bread", { s: 0.2 }); for (const x of [28, 30, 32]) P.px(x, 34, "bread", -0.6); } },
    grawlix: {
      front: (P) => {
        P.rect(28, 2, 11, 7, "paper", 0.3); P.poly([[29, 9], [31, 9], [28, 11]], "paper", 0.1);
        P.px(30, 4, "inkred"); P.px(30, 6, "inkred"); P.px(31, 5, "inkred"); P.px(29, 5, "inkred");
        P.px(33, 3, "ink"); P.px(33, 4, "ink"); P.px(33, 6, "ink");
        P.px(35, 4, "inkred"); P.px(36, 4, "inkred"); P.px(35, 5, "inkred"); P.px(36, 6, "inkred"); P.px(37, 5, "inkred");
      },
    },
    notes: { front: (P) => { for (const [x, y] of [[4, 9], [8, 4]]) { P.ell(x, y + 4, 1.4, 1.1, "brass", { s: 0.3 }); P.line(x + 1, y + 4, x + 1, y, "brass", 0.2); P.px(x + 2, y, "brass", 0); } } },
    pot: {
      back: (P) => {
        P.ell(8, 15, 7.5, 6.5, "copper", { s: 0.1 });
        P.ell(8, 9.6, 7, 1.8, "copperd", { s: -0.3 }); P.ell(8, 9.4, 5.5, 1.1, "stew", { s: 0.2 });
        P.line(14, 10, 16, 4, "iron", 0.2); P.ell(16.4, 3.4, 1.2, 1.2, "iron", { s: 0.2 });
      },
      front: (P) => { for (const [x, y] of [[6, 6], [7, 4], [6, 2], [9, 5], [10, 3]]) P.px(x, y, "steam", 0.3); },
    },
    horse: {
      back: (P) => {
        // the very old horse in profile, facing out of the card: ears up, eyelid half shut, lower lip hanging, a forelock gone white
        P.layer = 1;
        P.poly([[9, 10], [17, 14], [19, 40], [4, 40], [6, 24]], "horse", (x, y) => -0.1 - (y - 10) * 0.01);
        P.layer = 2;
        P.poly([[9, 0], [11, 1], [11.5, 6], [9, 5]], "horse", 0.2); P.poly([[5, 2], [7, 1], [8, 6], [6, 6]], "horse", -0.1);
        P.poly([[5, 5], [11, 5], [13, 12], [12, 19], [7, 27], [2, 29], [0, 26], [0, 20], [3, 12]], "horse", (x, y) => 0.3 - x * 0.03 - (y - 5) * 0.012);
        P.ell(2.5, 25, 3.2, 3.6, "muzzle2", { s: 0.15 });
        P.ell(3.5, 29.4, 2.6, 1.3, "lip", { s: 0 });
        P.px(1, 24, "ink"); P.px(1, 25, "ink");
        P.ell(7.5, 6, 3, 1.8, "mane", { s: 0.25 });
        P.rect(7, 12, 3, 1, "ink", 0); P.px(8, 13, "eye", 0); P.px(9, 13, "ink");
        P.line(5, 15, 3, 21, "coatline", 0);
        P.poly([[4, 33], [17, 31], [19, 40], [3, 40]], "caparison", (x, y) => 0.1 - (y - 31) * 0.03 + ((x + y) % 6 === 0 ? 0.4 : 0));
        P.rect(4, 32, 14, 1, "brass", 0.2);
      },
    },
    poster: {
      back: (P) => {
        P.rect(1, 3, 12, 15, "paper", (x, y) => 0.15 - (y - 3) * 0.02 + ((x * 3 + y) % 11 === 0 ? -0.3 : 0));
        P.rect(3, 5, 8, 2, "ink", 0); P.ell(7, 11, 2.4, 2.6, "inkred", { s: -0.2 }); P.rect(3, 15, 8, 1, "ink", 0);
        P.px(7, 3, "iron", 0.4);
      },
    },
    badge: { front: (P) => { P.ell(14, 33, 2.4, 2.4, "brass", { s: 0.2 }); P.px(13.5, 32.5, "ink"); P.px(14.5, 33.5, "ink"); P.px(13.5, 33.5, "ink"); } },
    // a lady's travelling trunk, banded in brass, beside her
    trunk: {
      back: (P) => {
        P.rect(27, 27, 12, 9, "trunk", (x, y) => (y === 27 ? 0.35 : 0.05 - (y - 27) * 0.03));
        P.rect(27, 26, 12, 2, "trunkd", 0.25);
        for (const x of [29, 36]) P.rect(x, 26, 1, 10, "brass", 0.15);
        P.px(32.5, 30, "brass", 0.4); P.px(32.5, 31, "ink");
      },
    },
    // two ferrets, one on the shoulder and one peering out of the pack
    ferrets: {
      front: (P) => {
        P.ell(31, 28, 4.5, 1.8, "ferret", { s: 0.15 }); P.ell(35.5, 27, 1.8, 1.5, "ferret", { s: 0.25 }); P.px(36, 26.5, "ink"); P.px(37, 27.5, "muzzle");
        P.ell(7, 31, 1.8, 1.6, "ferret2", { s: 0.25 }); P.px(6.5, 30.5, "ink"); P.px(7.5, 30.5, "ink"); P.ell(7, 33.5, 3, 1.6, "ferret2", { s: 0 });
      },
    },
    fish: { front: (P) => { P.ell(31, 32, 5, 1.8, "fish", { s: 0.25 }); P.poly([[36, 32], [39, 30], [39, 34]], "fish", -0.1); P.px(27.5, 31.5, "ink"); } },
    pots: {
      back: (P) => {
        P.ell(31, 30, 3.4, 2.6, "copper", { s: 0.2 }); P.rect(28, 28, 7, 1, "copperd", 0);
        P.ell(37, 33, 2.6, 2.2, "iron", { s: 0.2 }); P.line(27, 26, 30, 28, "copperd", 0);
      },
    },
  };
  // the league's names for props (content looks) to the art's
  const PROP_ALIAS = { handcart: "cart", oldhorse: "horse" };
  const propOf = (p) => PROPS[p] || PROPS[PROP_ALIAS[p]] || {};
  const PROP_PAL = {
    shell: "#f0dcc0", wood: "#8a5a32", apple: "#c04a3a", cloth: "#5a7aa0", cheese: "#e8c450", wheel: "#6a4a2a", iron: "#5a5660",
    lace: "#efe6d8", strap: "#6a4426", satch: "#8a5a34", wax: "#b82a2a", brass: "#c8963a", flame: "#ffcc5a", cow: "#ece6dc", cowp: "#2e2a2c",
    muzzle: "#e8a8a0", ink: "#1a1416", horn: "#d8ccb0", bell: "#c8963a", paper: "#efe2c2", inkred: "#9a2a20", quill: "#ece6d6", flour: "#f4f0e8",
    bread: "#c8883a", copper: "#b8682e", copperd: "#6a3a1c", stew: "#8a4a22", steam: "#e8e8e8", horse: "#a6a29e", muzzle2: "#cfcac2", lip: "#8a7a78",
    mane: "#e6e2dc", eye: "#3a2a28", caparison: "#3a5a8a", coatline: "#8a8682",
    trunk: "#6a3e24", trunkd: "#4a2a18", ferret: "#d8c09a", ferret2: "#8a6a4a", fish: "#8aa8b8",
  };

  // ---------- busts ----------
  const cache = new Map();
  const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
  function portraitOf(id, lk) {
    const { h, cls } = npc(id, lk);
    return Pt.portraitGrid(h, cls, { bg: false });
  }
  function ghostly(g) {
    const G = ["#2a3450", "#5a6a8a", "#9aaac4", "#d4def0", "#f4f8ff"];
    return paste(new Grid(g.w, g.h), g, 0, 0, (c) => (c === INK ? "#1a2238" : G[Math.min(4, Math.floor(lum(c) * 5.2))]));
  }
  function namedBust(key, sp) {
    const lk = lookOf(key, sp);
    const g = backdrop(40, 40, lk.sky || "day", hash(key + ":bg"), lk.motif);
    const pr = propOf(lk.prop);
    if (pr.back) paste(g, painted(40, 40, PROP_PAL, pr.back), 0, 0);
    let face = portraitOf(key, lk);
    if (lk.ghost) {
      face = ghostly(face);
      // her light: a warm halo round the lantern, painted under the figure's edge
      for (let y = 14; y < 40; y++) for (let x = 18; x < 40; x++) { const d = Math.hypot(x - 31, y - 28); if (d < 11 && dith(x, y) < 1 - d / 11) g.set(x, y, mix(g.get(x, y) || "#1a2238", "#ffcc5a", 0.28 * (1 - d / 11) + 0.08)); }
    }
    paste(g, face, 0, 0);
    if (pr.front) paste(g, painted(40, 40, PROP_PAL, pr.front), 0, 0);
    return g;
  }

  // ---------- crews ----------
  const CW = 72, CH = 40;
  function dim(g, t, to) { return paste(new Grid(g.w, g.h), g, 0, 0, (c) => (c === INK ? c : mix(c, to || "#2a2030", t))); }
  function archbishop() {
    return painted(34, 40, { fur: "#7a5236", furd: "#5a3a26", snout: "#c8a07a", nose: "#2a1c16", mitre: "#ece2c8", gold: "#d8a838", eye: "#1a1210", tongue: "#c86a6a" }, (P) => {
      P.layer = 1;
      P.ell(17, 37, 15, 7, "fur", { s: -0.1 });
      P.ell(6.5, 16, 3.6, 3.6, "fur", { s: 0.1 }); P.ell(27.5, 16, 3.6, 3.6, "fur", { s: -0.1 });
      P.ell(6.5, 16, 1.8, 1.8, "furd", { s: -0.2 }); P.ell(27.5, 16, 1.8, 1.8, "furd", { s: -0.3 });
      P.layer = 2;
      P.ell(17, 24, 11, 10, "fur", { s: 0.05, fn: (x, y, s) => s + ((x * 7 + y * 3) % 9 === 0 ? -0.3 : 0) });
      P.ell(17, 29, 5.6, 4.4, "snout", { s: 0.2 });
      P.ell(17, 26.4, 2.4, 1.6, "nose", { s: 0.3 });
      P.px(16, 31, "tongue", 0.2); P.px(17, 31, "tongue", 0); P.px(17, 30, "nose", -0.3);
      P.px(12, 22, "eye"); P.px(22, 22, "eye"); P.px(12, 21, "#f4ecd8"); P.px(22, 21, "#f4ecd8");
      P.layer = 3;
      // the Archbishop's mitre, a touch too small and on at an angle
      P.poly([[10, 15], [24, 13], [22, 3], [17, -1], [12, 4]], "mitre", (x, y) => 0.35 - (x - 10) * 0.05 - (y - 0) * 0.01);
      P.line(17, 0, 17, 14, "gold", 0.3); P.line(11, 12, 24, 10, "gold", 0.1);
      P.rect(16, 5, 3, 1, "gold", 0.4);
      P.poly([[11, 15], [9, 21], [11, 21], [12.5, 15]], "gold", 0); P.poly([[23, 13], [25, 19], [27, 19], [24.5, 13]], "gold", -0.2);
    });
  }
  function mule() {
    return painted(26, 40, { mule: "#7a6a5a", muled: "#4a4038", muzzle: "#c8bca8", ink: "#1a1416", tack: "#8a3a2a", brass: "#c8963a" }, (P) => {
      P.layer = 1;
      P.ell(13, 36, 11, 6, "mule", { s: -0.1 });
      P.poly([[5, 4], [7, -1], [9, 8]], "mule", 0.2); P.poly([[12, 4], [17, -1], [15, 8]], "mule", 0);
      P.px(7, 2, "muled", -0.3); P.px(15, 1, "muled", -0.3);
      P.layer = 2;
      P.poly([[4, 8], [16, 7], [19, 18], [17, 30], [8, 31], [3, 20]], "mule", (x, y) => 0.25 - (x - 4) * 0.03 - (y - 7) * 0.01);
      P.ell(12.5, 28, 5.4, 4.2, "muzzle", { s: 0.15 });
      P.px(10, 29, "ink"); P.px(15, 29, "ink"); P.rect(10, 31, 6, 1, "muled", -0.2);
      P.px(7, 15, "ink"); P.px(15, 15, "ink"); P.px(7, 14, "#e8e0d0"); P.px(15, 14, "#e8e0d0");
      P.line(4, 18, 18, 18, "tack", 0.1); P.line(8, 18, 9, 27, "tack", 0); P.ell(5, 18.5, 1.2, 1.2, "brass", { s: 0.3 });
      // Reputation's own small bell: the only thing about it anybody remembers
      P.ell(12, 36, 1.6, 1.6, "brass", { s: 0.3 });
    });
  }
  function goblinSprite(pal, frame, kit) {
    const g = A.monsterGrid({ body: "goblin", pal }, frame || 0);
    return kit ? travelling(g, kit) : g;
  }
  // a goblin on the road, not in the stockade: a bedroll, a pot, or a little flag of the pack
  function travelling(g, kit) {
    const o = paste(new Grid(g.w, g.h), g, 0, 0);
    const p = painted(g.w, g.h, { roll: "#8a5a3a", band: "#d8b45a", pot: "#5a5660", flag: "#c8a03a", pole: "#6a4a2a", rag: "#a8402a" }, (P) => {
      if (kit === "roll") { P.ell(8, 16, 3.4, 2.2, "roll", { s: 0.1 }); P.px(8, 15, "band", 0.2); P.px(8, 17, "band", -0.1); }
      if (kit === "pot") { P.ell(7, 17, 2.6, 2.2, "pot", { s: 0.1 }); P.rect(5, 14, 5, 1, "pot", 0.4); }
      if (kit === "flag") { P.rect(3, 2, 1, 14, "pole", 0.1); P.poly([[4, 2], [9, 3.5], [4, 6]], "rag", 0.2); }
    }, { outer: true });
    return paste(paste(new Grid(g.w, g.h), p, 0, 0), o, 0, 0);
  }
  function grey(scale) {
    return painted(20, 40, { robe: "#8a8e96", robed: "#5e626c", void: "#14161c", wax: "#ece2c8", flame: "#ffd070" }, (P) => {
      const s = scale || 1, cx = 10;
      P.layer = 1;
      P.poly([[cx - 8 * s, 40], [cx - 6 * s, 20], [cx, 13], [cx + 6 * s, 20], [cx + 8 * s, 40]], "robe", (x, y) => 0.15 - (x - cx) * 0.06 + (Math.round(x) % 3 === 0 ? -0.25 : 0));
      P.layer = 2;
      P.ell(cx, 14, 5 * s, 6 * s, "robed", { s: 0.15 });
      P.ell(cx + 0.5, 15.5, 2.8 * s, 3.8 * s, "void", { s: 0 });
      P.layer = 3;
      P.rect(cx + 3, 23, 2, 6, "wax", 0.2); P.px(cx + 3, 21, "flame", 0.6); P.px(cx + 4, 22, "flame", 0.2); P.px(cx + 3, 22, "flame", 0.4);
    });
  }
  function stageCart(w, h) {
    return painted(w, h, { wood: "#7a5232", woodd: "#4a3020", curtain: "#9a2a2a", gold: "#d8a838", back: "#3a5a7a", tree: "#4a6a3a", wheel: "#5a3a22" }, (P) => {
      P.rect(2, 4, w - 4, 2, "gold", 0.3);
      P.rect(3, 6, w - 6, 18, "back", (x, y) => -0.1 + (y > 16 ? -0.2 : 0));
      P.ell(w * 0.3, 15, 4, 4, "tree", { s: 0.1 }); P.rect(w * 0.3 - 0.5, 18, 1, 6, "woodd", 0);
      P.ell(w * 0.75, 10, 3, 3, "gold", { s: 0.3 });
      for (const side of [0, 1]) {
        const x0 = side ? w - 13 : 2;
        P.poly([[x0, 4], [x0 + 11, 4], [x0 + (side ? 11 : 0) + (side ? -4 : 4), 26], [x0 + (side ? 11 : 0), 26]], "curtain", (x, y) => 0.1 + ((Math.round(x) + side) % 3 === 0 ? -0.35 : 0.1) - (y - 4) * 0.01);
      }
      P.rect(0, 24, w, 4, "wood", (x, y) => (y === 24 ? 0.4 : 0) + (x % 7 === 0 ? -0.3 : 0));
      P.rect(1, 28, w - 2, 6, "woodd", (x) => (x % 5 === 0 ? -0.3 : 0));
      for (const x of [8, w - 9]) { P.ell(x, 35, 4, 4, "wheel", { s: 0 }); P.ell(x, 35, 1.5, 1.5, "wood", { s: 0.2 }); }
    });
  }
  function bigTop(w, h) {
    const g = new Grid(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const stripe = Math.floor((x - (y - 6) * 0.35 * Math.sign(x - w / 2)) / 6) % 2 === 0;
      const roof = y < 18 - Math.abs(x - w / 2) * 0.32;
      if (roof) continue;
      g.set(x, y, stripe ? "#b8382a" : "#efe2c2");
    }
    for (let x = 0; x < w; x += 2) g.set(x, Math.round(18 - Math.abs(x - w / 2) * 0.32), "#d8a838");
    g.vline(Math.round(w / 2), 0, 6, "#5a3a22"); g.rect(Math.round(w / 2) + 1, 0, 4, 2, "#d8a838");
    return g;
  }
  // members' busts, overlapped: the face of the crew in front, the others half a step back and a shade darker
  function lineup(bg, list) {
    const g = paste(new Grid(CW, CH), bg, 0, 0);
    for (const m of list.filter((m) => m.back)) paste(g, dim(m.g, 0.2), m.x, m.y || 0);
    for (const m of list.filter((m) => !m.back)) paste(g, m.g, m.x, m.y || 0);
    return g;
  }
  const CREW_ART = {
    fourth_best: () => lineup(backdrop(CW, CH, "day", hash("fbc"), null), [
      { g: mule(), x: 0, y: 1, back: true }, { g: portraitOf("twice", LOOKS.twice), x: 36, y: -1, back: true },
      { g: (() => { const b = portraitOf("mabb", LOOKS.mabb); paste(b, painted(40, 40, PROP_PAL, PROPS.badge.front), 0, 0); return b; })(), x: 11 },
    ]),
    circus: () => {
      const bg = backdrop(CW, CH, "dusk", hash("circus"), null);
      paste(bg, bigTop(CW, 30), 0, 4);
      for (let x = 0; x < CW; x++) bg.set(x, 3 + Math.round(Math.sin(x / CW * Math.PI) * 4), x % 4 < 2 ? "#d8a838" : "#3a6a8a");
      const fire = portraitOf("fire_eater", LOOKS.fire_eater);
      paste(fire, painted(40, 40, { flame: "#ffb040", core: "#fff0a0", wood: "#6a4a2a" }, (P) => { P.line(28, 39, 31, 24, "wood", 0.1); P.ell(31, 20, 2.2, 3.6, "flame", { s: 0.3 }); P.ell(31, 21, 1, 1.6, "core", { s: 0.4 }); }), 0, 0);
      return lineup(bg, [{ g: portraitOf("strongwoman", LOOKS.strongwoman), x: -8, y: 1, back: true }, { g: fire, x: 38, y: 1, back: true }, { g: archbishop(), x: 19, y: 0 }]);
    },
    goblins: () => {
      const bg = backdrop(CW, CH, "dusk", hash("gob"), null);
      const gs = [goblinSprite("green_archer", 0, "roll"), goblinSprite("green_shaman", 0, "pot"), goblinSprite("green", 0, "flag"), goblinSprite("green", 1, "roll")];
      const out = paste(new Grid(CW, CH), bg, 0, 0);
      [[2, 9, 0.25], [44, 8, 0.25], [24, 10, 0], [56, 12, 0]].forEach(([x, y, d], i) => paste(out, d ? dim(gs[i], d) : gs[i], x, y));
      return out;
    },
    players: () => {
      const bg = backdrop(CW, CH, "dusk", hash("players"), null);
      paste(bg, stageCart(CW - 4, 38), 2, 2);
      return lineup(bg, [{ g: portraitOf("player_mask", LOOKS.player_mask), x: 30, y: 1, back: true }, { g: portraitOf("player_king", LOOKS.player_king), x: 4 }]);
    },
    grey_procession: () => {
      const g = backdrop(CW, CH, "night", hash("grey"), null);
      const fig = [[56, -8, 0.55], [44, -6, 0.45], [32, -4, 0.3], [18, -2, 0.15], [2, 0, 0]];
      for (const [x, y, d] of fig) { const p = grey(1); paste(g, d ? dim(p, d, "#1a2238") : p, x, y + 2); }
      return g;
    },
  };

  // ---------- the fallback: a bust or a crew from a seed and a role ----------
  const FB = {
    skins: ["#f6d5b8", "#e8b088", "#c98e62", "#a06a42", "#6e4428"], hairs: ["#1c1a1f", "#4b2e1e", "#7a4424", "#c46a2c", "#e0b45a", "#efe2c0", "#9a9aa6"],
    favs: ["#7a5a3a", "#a04a3a", "#3a6a4a", "#2a6a8a", "#6a7a3a", "#8a6a2a", "#5a4a6a", "#b8682e", "#3a5a8a", "#6a3a3a"],
  };
  // a role word in what they are picks their kit; the rest comes from the seed
  const ROLES = [
    [/ghost|spirit|wraith|phantom|haunt/, { outfit: "cloak", head: "hood", ghost: true, sky: "night" }],
    [/ferry|boat|bargee|fisher/, { outfit: "cloak", head: "wide_hat", offhand: "lantern", sky: "dawn" }],
    [/pilgrim|monk|friar|priest|holy|nun|hermit/, { outfit: "robe", head: "hood", weapon: "staff", neck: "beads", sky: "day" }],
    [/knight|soldier|guard|captain|sergeant|veteran|squire/, { outfit: "chain", head: "helm", weapon: "sword", offhand: "shield", sky: "day" }],
    [/hunter|bounty|ranger|trapper|poacher|archer/, { outfit: "leather", head: "tricorn", weapon: "bow", sky: "dusk" }],
    [/cook|baker|brewer|innkeeper|alewife/, { outfit: "vest", neck: "scarf", offhand: "frying_pan", sky: "dusk" }],
    [/minstrel|bard|singer|piper|fiddler|player|actor|juggler/, { outfit: "fancy", head: "feather_cap", weapon: "lute", sky: "dusk" }],
    [/noble|lady|lord|duke|countess|heir/, { outfit: "fancy", head: "circlet", neck: "pearl", sky: "dusk" }],
    [/courier|messenger|rider|post/, { outfit: "leather", head: "leather_cap", back: "backpack", sky: "day" }],
    [/pedlar|merchant|trader|tinker|hawker|cheesemonger/, { outfit: "vest", head: "bandana", back: "backpack", sky: "day" }],
    [/drover|farmer|shepherd|herd|goose|pig/, { outfit: "cloak", head: "wide_hat", weapon: "staff", sky: "day" }],
    [/witch|wizard|mage|seer|fortune|astrolog/, { outfit: "robe", head: "wizard_hat", weapon: "wand", sky: "night" }],
    [/mapmaker|scholar|clerk|scribe|tax|lawyer|surveyor/, { outfit: "cloak", offhand: "ledger", head: "top_hat", sky: "day" }],
    [/thief|smuggler|rogue|bandit|highway/, { outfit: "leather", head: "hood", weapon: "daggers", sky: "night" }],
    [/smith|mason|miner|digger|woodcutter|carter/, { outfit: "leather", offhand: "hammer", head: "leather_cap", sky: "day" }],
  ];
  function fallbackLook(seed, role, palette) {
    const r = rng(hash(String(seed)) + 11), pick = (xs) => xs[Math.floor(r() * xs.length)];
    const lk = { skin: pick(FB.skins), hair: pick(FB.hairs), style: Math.floor(r() * 22), face: r() < 0.6 ? 0 : Math.floor(r() * 4), fav: pick(FB.favs), outfit: "cloak", tier: 2, sky: pick(["day", "day", "dusk", "dawn"]) };
    const hit = ROLES.find(([re]) => re.test(norm(role)));
    if (hit) Object.assign(lk, hit[1]);
    else Object.assign(lk, pick([{ outfit: "cloak", head: "hood" }, { outfit: "vest", head: "wide_hat" }, { outfit: "leather", head: "leather_cap" }, { outfit: "robe", neck: "scarf" }]));
    if (palette) Object.assign(lk, typeof palette === "string" ? { fav: palette } : palette);
    return lk;
  }
  function fallbackBust(sp) {
    const lk = Object.assign(fallbackLook(sp.id + "|" + sp.name, sp.what + " " + sp.role, sp.palette), sp.look || {}), pr = propOf(lk.prop);
    const g = backdrop(40, 40, lk.sky, hash(sp.id + ":bg"), null);
    if (pr.back) paste(g, painted(40, 40, PROP_PAL, pr.back), 0, 0);
    let face = portraitOf(sp.id, lk);
    if (lk.ghost) face = ghostly(face);
    paste(g, face, 0, 0);
    if (pr.front) paste(g, painted(40, 40, PROP_PAL, pr.front), 0, 0);
    return g;
  }
  function fallbackCrew(sp) {
    const ms = (sp.members || [sp.name + " 1", sp.name + " 2", sp.name + " 3"]).slice(0, 3).map((m, i) => (typeof m === "string" ? { id: m, name: m } : m));
    const lead = Object.assign(fallbackLook(sp.id + "|lead", sp.what + " " + sp.role, sp.palette), sp.look || {});
    const bg = backdrop(CW, CH, lead.sky, hash(sp.id + ":crew"), null);
    // one crew, one colour: everyone wears the leader's favourite, so they read as a company
    const looks = ms.map((m, i) => (i === 0 ? lead : Object.assign(fallbackLook(sp.id + "|" + (m.id || m.name || i), (m.role || "") + " " + sp.what, sp.palette), { fav: lead.fav })));
    const spots = [[16, 0, false], [-6, 1, true], [38, 1, true]];
    const list = looks.map((lk, i) => ({ g: portraitOf(sp.id + ":" + i, lk), x: spots[i][0], y: spots[i][1], back: spots[i][2] }));
    const g = lineup(bg, list);
    // the company's pennant over the back row
    const flag = lead.fav;
    for (let y = 2; y < 10; y++) g.set(66, y, "#5a3a22");
    for (let y = 2; y < 6; y++) for (let x = 59; x < 66; x++) if (x - 59 > (y - 2) * 0.6 && x - 59 < 7 - Math.abs(y - 4) * 0.5) g.set(x, y, mix(flag, "#ffffff", y === 2 ? 0.25 : 0));
    return g;
  }

  function bust(t) {
    const sp = spec(t);
    if (sp.kind === "crew") return crew(sp);
    return memo("b:" + (sp.key || "fb:" + sp.id + "|" + sp.name + "|" + sp.role) + JSON.stringify(sp.look || null), () => (sp.key && LOOKS[sp.key] ? namedBust(sp.key, sp) : fallbackBust(sp)));
  }
  function crew(t) {
    const sp = t && t.raw ? t : spec(t);
    return memo("c:" + (sp.key || "fb:" + sp.id + JSON.stringify(sp.members || [])), () => (sp.key && CREW_ART[sp.key] ? CREW_ART[sp.key]() : fallbackCrew(sp)));
  }
  function fallback(t) { const sp = spec(Object.assign({}, typeof t === "string" ? { id: t } : t, { art: "-" })); sp.key = null; return sp.kind === "crew" ? fallbackCrew(sp) : fallbackBust(sp); }

  // ---------- standing figures: on the road and in a fight ----------
  function heroLike(id, lk, frame, seated) {
    const { h, cls } = npc(id, lk);
    return seated ? A.heroSeated(h, frame, cls, seated) : A.heroGrid(h, frame, cls);
  }
  function ghostFig(g) { return ghostly(g); }
  // the very old horse at people scale: swaybacked, grey to the muzzle, head low, one hind hoof resting; Sir Aldous sits on it
  function oldHorse(frame) {
    return memo("horse" + (frame ? 1 : 0), () => painted(56, 38, { coat: "#a8a4a0", coatd: "#86827e", mane: "#e2ded8", muzzle: "#d2ccc4", hoof: "#4a3c36", cap: "#3a5a8a", capt: "#d8a838", eye: "#2a1c18" }, (P) => {
      const d = frame ? 1 : 0;
      // drawn in the 44x30 design space at 1.25, so the horse stands a head taller than a pony beside the heroes
      P.tf = { ox: 0, oy: 0, cx: 0, cy: 0, s: 1.25 };
      P.layer = 1;
      for (const [x, k] of [[9, 0], [31, 0.4]]) P.rect(x + 2, 18, 2.4, 10, "coatd", -0.2 - k);
      P.layer = 2;
      // a swayback: the barrel dips in the middle
      P.ell(21, 15, 13, 6.4, "coat", { s: 0.05, fn: (x, y, s) => (y < 10 + Math.sin((x - 8) / 26 * Math.PI) * 1.6 ? false : s) });
      P.poly([[31, 13], [36, 10 + d], [40, 18 + d], [43, 21 + d], [41, 24 + d], [37, 22 + d], [32, 18]], "coat", (x, y) => 0.25 - (y - 10) * 0.03);
      P.ell(41.5, 22.5 + d, 2.4, 2, "muzzle", { s: 0.2 });
      P.px(42, 25 + d, "#7a6a68");
      P.poly([[36, 9 + d], [37, 6 + d], [38.5, 10 + d]], "coat", 0.2);
      P.rect(37, 14 + d, 2, 1, "eye", 0);
      P.poly([[31, 12], [36, 9 + d], [37, 11 + d], [32, 15]], "mane", 0.2);
      P.poly([[8, 12], [5, 15], [4, 24], [7, 22], [9, 15]], "mane", 0.1);
      for (const [x, k] of [[12, 0], [28, 0.2]]) { P.rect(x, 18, 2.6, 9, "coat", 0.1 - k); P.rect(x, 26, 3, 2, "hoof", 0); }
      P.rect(9 + 2, 26, 3, 2, "hoof", -0.3);
      P.layer = 3;
      P.poly([[13, 9], [27, 9], [29, 18], [11, 18]], "cap", (x, y) => 0.1 - (y - 9) * 0.02 + (Math.round(x) % 4 === 0 ? -0.3 : 0));
      P.rect(11, 17, 18, 1, "capt", 0.3);
    }));
  }
  function aldousFig(frame) {
    return memo("aldous:" + (frame ? 1 : 0), () => {
      const horse = oldHorse(frame), rider = heroLike("aldous", Object.assign({}, LOOKS.aldous, { offhand: null }), frame, 33);
      const g = new Grid(58, 52);
      paste(g, horse, 0, 14);
      paste(g, rider, 9, 0);
      g.pad = 0;
      return g;
    });
  }
  const MEMBER_FIG = {
    mabb: (f) => heroLike("mabb", LOOKS.mabb, f), twice: (f) => heroLike("twice", LOOKS.twice, f),
    reputation: (f) => memo("rep" + f, () => painted(30, 26, { mule: "#7a6a5a", muled: "#5a4c40", muzzle: "#c8bca8", hoof: "#3a2c28", pack: "#8a6a42", rope: "#d8b45a", brass: "#c8963a" }, (P) => {
      const d = f ? 1 : 0;
      P.layer = 1; for (const x of [7, 20]) P.rect(x, 15, 2.2, 9, "muled", -0.3);
      P.layer = 2;
      P.ell(14, 12, 9, 5, "mule", { s: 0.05 });
      P.poly([[21, 10], [25, 6 + d], [29, 13 + d], [27, 15 + d], [22, 14]], "mule", 0.2);
      P.ell(27.5, 13.5 + d, 1.8, 1.6, "muzzle", { s: 0.2 });
      P.poly([[24, 6 + d], [24, 1 + d], [26, 5 + d]], "mule", 0.3); P.poly([[22, 7 + d], [20, 2 + d], [23.5, 6 + d]], "mule", 0);
      for (const x of [9, 18]) { P.rect(x, 15, 2.4, 9, "mule", 0.1); P.rect(x, 23, 2.6, 2, "hoof", 0); }
      P.layer = 3;
      P.rect(9, 4, 10, 7, "pack", (x, y) => 0.2 - (y - 4) * 0.05);
      P.line(8, 8, 20, 8, "rope", 0.2); P.ell(23, 12, 1, 1, "brass", { s: 0.3 });
    })),
    archbishop: (f) => memo("bear" + f, () => painted(30, 32, { fur: "#7a5236", furd: "#5a3a26", snout: "#c8a07a", nose: "#2a1c16", mitre: "#ece2c8", gold: "#d8a838" }, (P) => {
      const d = f ? 1 : 0;
      P.layer = 1; for (const x of [6, 18]) P.rect(x, 22, 4, 9, "furd", -0.2);
      P.layer = 2;
      P.ell(14, 17, 10, 8, "fur", { s: 0.05, fn: (x, y, s) => s + ((x * 7 + y * 3) % 9 === 0 ? -0.3 : 0) });
      P.ell(23, 12 + d, 5.5, 5, "fur", { s: 0.15 });
      P.ell(27, 14 + d, 2.4, 2, "snout", { s: 0.2 }); P.px(29, 13 + d, "nose");
      P.ell(21, 7.5 + d, 1.6, 1.6, "fur", { s: 0.2 });
      P.px(25, 11 + d, "nose");
      for (const x of [8, 20]) P.rect(x, 22, 4, 9, "fur", 0.1);
      P.layer = 3;
      P.poly([[19, 8 + d], [27, 7 + d], [25, 0 + d], [22, -2 + d]], "mitre", (x) => 0.35 - (x - 19) * 0.05);
      P.line(23, -1 + d, 23, 7 + d, "gold", 0.3);
    })),
    strongwoman: (f) => heroLike("strongwoman", LOOKS.strongwoman, f), fire_eater: (f) => heroLike("fire_eater", LOOKS.fire_eater, f),
    player_king: (f) => heroLike("player_king", LOOKS.player_king, f), player_mask: (f) => heroLike("player_mask", LOOKS.player_mask, f),
    gob_grunt: (f) => goblinSprite("green", f, "flag"), gob_archer: (f) => goblinSprite("green_archer", f, "roll"),
    gob_shaman: (f) => goblinSprite("green_shaman", f, "pot"), gob_small: (f) => goblinSprite("green", f, "roll"),
    grey: (f) => memo("greyfig" + f, () => crop(grey(1), 0, 10, 20, 30)),
  };
  function figure(t, frame, member) {
    const sp = spec(t), f = frame ? 1 : 0;
    if (sp.kind === "crew") {
      const ms = sp.members || [];
      // a fight lineup's member is an index into the crew's fighters (league roads.static: fights), which name the face first
      const fights = sp.raw.fights || [];
      let m = member == null ? (CREWS[sp.key] || {}).face || sp.raw.face || ms[0] : typeof member === "number" ? fights[member] || ms[member % Math.max(1, ms.length)] : member;
      if (m && typeof m === "object") m = m.id || m.name;
      // only a crew the art drew by hand has members of its own ("Rosalind Grey" is no Grey Procession)
      if (CREWS[sp.key]) {
        m = memberKey(m);
        // the league's own names for a hand-drawn crew's fighters ("Snaggle") stand in the art's members, in order
        if (!MEMBER_FIG[m] && typeof member === "number") m = CREWS[sp.key].members[member % CREWS[sp.key].members.length];
      }
      if (MEMBER_FIG[m]) return MEMBER_FIG[m](f);
      // the same looks the crew's portrait gives them: the face (or the first member) in the leader's look and the league's own
      // look for it, the rest in their own with the leader's colour
      const names = (sp.members || []).map((x) => (typeof x === "string" ? x : x.id || x.name));
      const lead = Object.assign(fallbackLook(sp.id + "|lead", sp.what + " " + sp.role, sp.palette), sp.look || {});
      const i = names.indexOf(m);
      if (i <= 0) return heroLike(sp.id + ":lead", lead, f);
      const mm = (sp.members || [])[i];
      const lk = Object.assign(fallbackLook(sp.id + "|" + m, ((mm && mm.role) || "") + " " + sp.what, sp.palette), { fav: lead.fav });
      return heroLike(sp.id + ":" + m, lk, f);
    }
    if (sp.key === "aldous") return aldousFig(f);
    if (sp.key && LOOKS[sp.key]) {
      const lk = lookOf(sp.key, sp);
      const g = heroLike(sp.key, lk, f);
      return lk.ghost ? memo("gf:" + sp.key + f, () => ghostFig(g)) : g;
    }
    const lk = Object.assign(fallbackLook(sp.id + "|" + sp.name, sp.what + " " + sp.role, sp.palette), sp.look || {});
    const g = heroLike(sp.id, lk, f);
    return lk.ghost ? ghostFig(g) : g;
  }
  // a member named as the league names them ("Captain Mabb", "Reputation the mule") to the art's own key ("mabb", "reputation")
  function memberKey(m) {
    if (!m || MEMBER_FIG[m]) return m;
    const n = norm(m);
    if (MEMBER_FIG[n]) return n;
    for (const k in MEMBER_FIG) if (norm((LOOKS[k] || {}).name) === n || n.split(/\s+/).includes(k)) return k;
    return m;
  }
  // a fight lineup unit: { kind: "traveller", ref | traveller, member? }; the grid faces right like Art.heroGrid
  function fighter(u, frame) {
    const t = u.traveller || u.ref || u.id || u.name;
    return figure(t, frame, u.member);
  }

  // ---------- place icons (daybook size) and map pins ----------
  const KINDS = ["inn", "shrine", "toll", "ford", "ferry", "milestone", "crossroads", "ruin", "waystation"];
  const IPAL = {
    k: "#2a1c16", w: "#8a5a30", W: "#bc8c52", d: "#5a3a20", r: "#b8402c", R: "#7a2018", p: "#efe2c2", P: "#c8b48a", y: "#ffd870", g: "#e8b84a", G: "#a8762a",
    s: "#a8a6a0", S: "#d8d6d0", z: "#6a6870", b: "#4a7ab8", B: "#2a4a7a", c: "#b4d8ec", e: "#5a9a3a", E: "#36662a", o: "#d98a3a", f: "#f4f0e8",
  };
  const ICONS = {
    inn: [
      "...........kk...", "..........kddk..", "....rrrrrrrdk...", "...rRRRRRRRRr...", "..rRrrrrrrrrRr..", ".rRrrrrrrrrrrRr.", "rRRRRRRRRRRRRRRr",
      ".pPpppppppppPpk.", ".pkkpPpppkkpPpk.", ".pkypPpppkypPpk.", ".pkkpPpppkkpPpk.", ".pppppkkkpppPp.g", ".pPpppkwkpppPpgg", ".pPpppkwkpppPp.G", ".PPPPPkwkPPPPP..", "kkkkkkkkkkkkkkk.",
    ],
    shrine: [
      ".......kk.......", "......kgGk......", ".....kgggGk.....", "....kkkkkkkk....", "....ksSssSsk....", "....kS.y..sk....", "....ks.yy.sk....", "....kS.ww.sk....",
      "....ksSwwSsk....", "....kssssssk....", "...kSSSSSSSSk...", "...kzzzzzzzzk...", "..e.kssssssk.e..", ".eEe.kSsSsk.eEe.", "..E..kzzzzk..E..", "...kkkkkkkkkk...",
    ],
    toll: [
      "................", ".kk..........kk.", ".kSk........kSk.", ".kSkkkkkkkkkkSk.", ".kSrrffrrffrrSk.", ".kSkkkkkkkkkkSk.", ".kSk........kSk.", "kkkkkkkkkkkkkkkk", "kSSSSSSSSSSSSSSk", "kSsssssssssssssk", "kSsskkkkkkkksssk", "kSskbbbbbbbbkssk", "kSkbbcbbbbcbbksk", "kkbbbbbbcbbbbbkk", "bbbcbbbbbbbbcbbb", "bBbbbbBbbbbbbbBb",
    ],
    ford: [
      "................", ".kkkkk..........", ".kWWWk..........", ".kkwkk..........", "...w........E...", "eeewEeeeeeeeEeee", "WWWWWWWWWWWWWWWW", "bbbbbbbbbbbbbbbb", "bcbbbbcbbbbbcbbb", "bkSkbbkSkbbkSkbb", "kSsskkSsskkSsskb", "bkkkbbkkkbbkkkbc", "bbcbbbbbbcbbbbbb", "WWWWWWWWWWWWWWWW", "eEeeeEeeeEeeeEee", "eeeeeeeeeeeeeeee",
    ],
    ferry: [
      "...kk...........", "..kggk..........", "..kGGk..........", "...kk...........", "...kw...........", "...kw..dddddddd.", "...kw...........", "..kkwkk...kk....",
      "bbbbbbbbkwwkbbbb", "bcbkkkkkkkkkkkbb", "bbbkWwWwWwWwWkbc", "Bbbbkwwwwwwwkbbb", "bbcbbkkkkkkkbbbb", "bbbbbbbbcbbbbBbb", "BbbcbbBbbbbbbbbb", "bBBbbbbbBBbbbcbb",
    ],
    // a sandstone milestone with its mileage and an arrow cut in, so it never reads as a headstone
    milestone: [
      "................", "....kkkkkkk.....", "...kpPPPPPPWk...", "..kpPPPPPPPPWk..", "..kpPkPkkkPPWk..", "..kpkkPPPkPPWk..", "..kpPkPkkkPPWk..", "..kpPkPkPPPPWk..",
      "..kpkkkkkkPPWk..", "..kpPPPPPkPPWk..", "..kpPkkkkkkPWk..", "..kpPPPPPkPPWk..", "..kpPPPPPPPPWk..", ".ekkkkkkkkkkkke.", "eEeEeeEeEeeEeEeE", "................",
    ],
    crossroads: [
      ".......kk.......", ".......kwk......", "..kkkkkkwkkkkk..", ".kWWWWWWWWWWWWk.", "..kwwwwwkwwwwwk.", "...kkkkkwkkkkk..", ".......kwk......", ".kkkkkkkwkkkkkk.",
      "kWWWWWWWWWWWWWk.", ".kwwwwwwkwwwwwk.", "..kkkkkkwkkkkk..", ".......kwk......", ".......kwk......", "......kkwkk.....", ".e...kkdddkk..e.", "eEe.kkkkkkkkkeEe",
    ],
    ruin: [
      "................", "....k...........", "...kSk..k.......", "...kSkkkSk......", "...kSssssSk.....", "...kSsssssk.....", "...kSskkssk.....", "...kSkzzkssk....", "...kSkzzksssk...", "...kSssssssssk..", "...kSssskkssssk.", "...kSsskzzkssssk", "...kSsskzzksssk.", "..ekSssssssssske", ".eEkkkkkkkkkkkkE", "..E..s.ss..s....",
    ],
    waystation: [
      "................", "..kkkkkkkkkkkk..", ".kGgGgGgGgGgGgk.", "kGgGgGgGgGgGgGgk", "kkkkkkkkkkkkkkkk", ".kwddddddddddwk.", ".kwddkkkkkdddwk.", ".kwddkPPPkdddwk.", ".kwddkpPpkdddwk.", ".kwddkkkkkdddwk.", ".kwddddddddddwk.", ".kwdkkkkkkdddwk.", ".kwdkbcbbkdddwk.", ".kwdkkkkkkdddwk.", "kkkkkkkkkkkkkkkk", ".eEe......eEe...",
    ],
  };
  const ICON_ALIAS = { bridge: "toll", toll_bridge: "toll", gallows: "crossroads", cross: "crossroads", stone: "milestone", tavern: "inn", caravanserai: "waystation", hut: "waystation", shelter: "ruin", tower: "ruin", chapel: "shrine", cairn: "shrine", well: "waystation", plank_road: "ferry" };
  const kindOf = (k) => (ICONS[k] ? k : ICON_ALIAS[k] || "milestone");
  function rowsGrid(rows, pal) {
    const w = Math.max(...rows.map((r) => r.length)), g = new Grid(w, rows.length);
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (pal[row[x]]) g.set(x, y, pal[row[x]]); });
    return g;
  }
  function icon(kind) { const k = kindOf(kind); return memo("i:" + k, () => rowsGrid(ICONS[k], IPAL)); }

  // a pin: a 5x5 glyph on a round parchment marker with a point below, 9x12 with its outline; one strong shape each, so the kinds tell
  // apart on a phone map's scale
  const PINS = {
    inn: ["..r..", ".rrr.", "rrrrr", ".wyw.", ".www."],
    shrine: ["..y..", "..o..", ".kfk.", ".kfk.", "kkkkk"],
    toll: ["k...k", "rfrfr", "k...k", "bcbbb", "bbbcb"],
    ford: ["bbcbb", "cbbbc", "sbsbs", "bbbbb", "bcbbc"],
    ferry: ["..k..", "..kk.", "wwwww", "bwwwb", "bbcbb"],
    milestone: ["sssss", "sSkks", "sSsks", "sSsss", "eeeee"],
    crossroads: ["..w..", "WWWw.", "..w..", ".wWWW", "..w.."],
    ruin: ["s.s..", "sss.s", "sSsss", "sS.ss", "sSsss"],
    waystation: ["GGGGG", "GGGGG", ".d.d.", ".d.d.", "ddddd"],
  };
  // the pin is a bright cream disc in a near-black ring with a point below: dark-on-light reads on grass, sea and snow alike,
  // and the shadow under the point lifts it off busy ground; PIN gives its size and where its point is
  const PIN = { w: 11, h: 14, tipX: 5, tipY: 13 };
  // the glyphs a shade deeper than the icons', so stone and water still read on the cream disc
  const PIN_PAL = Object.assign({}, IPAL, { s: "#5e5c64", S: "#8e8c86", w: "#6a3e1c", W: "#9a6630", b: "#2a5aa8", c: "#6aa8d8", G: "#8a5a1a", e: "#3a7a2a" });
  function pin(kind) {
    const k = kindOf(kind);
    return memo("p:" + k, () => {
      const g = new Grid(PIN.w, PIN.h), OUT = "#1a100a", FILL = "#fff6dc", SHADE = "#e8d4a4";
      const inside = (x, y) => (x >= 0 && x < PIN.w && y >= 0 && y < PIN.h) && (((x - 5) ** 2 + (y - 5) ** 2) <= 27.5 || (y >= 9 && Math.abs(x - 5) <= (13 - y) * 0.75));
      for (let y = 0; y < PIN.h; y++) for (let x = 0; x < PIN.w; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        g.set(x, y, edge ? OUT : x + y > 12 ? SHADE : FILL);
      }
      paste(g, rowsGrid(PINS[k], PIN_PAL), 3, 3);
      return g;
    });
  }
  // a pin is drawn at whatever whole pixel size makes it about PIN_CSS css pixels wide where the map is shown: a phone shows the
  // 1280px map at ~375px, where k = 2 alone leaves a 6px pin; a desktop map keeps k. The shown width is read from the canvas when it
  // is laid out, else guessed from the window (the map spans the column)
  // 13, not bigger: a league late in its run has found forty places, and fatter pins bury the town names; the tap target can be
  // wider than the drawing
  const PIN_CSS = 13;
  function pinPx(ctx, k) {
    k = k || 1;
    const cv = ctx && ctx.canvas;
    if (!cv || !cv.width) return k;
    let shown = cv.clientWidth || 0;
    if (!shown && typeof root.innerWidth === "number" && root.innerWidth) shown = Math.min(cv.width, Math.max(240, root.innerWidth - 32), 1200);
    if (!shown) return k;
    return Math.max(k, Math.round(PIN_CSS / (PIN.w * (shown / cv.width))));
  }
  function drawPin(ctx, kind, x, y, k) {
    k = pinPx(ctx, k);
    const g = pin(kind);
    ctx.save();
    ctx.fillStyle = "rgba(16,12,8,0.45)";
    ctx.fillRect(Math.round(x - 3 * k), Math.round(y + k), 7 * k, k);
    ctx.fillRect(Math.round(x - 2 * k), Math.round(y + 2 * k), 5 * k, k);
    for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
      const c = g.px[j * g.w + i];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x + (i - PIN.tipX) * k), Math.round(y + (j - PIN.tipY) * k), k, k);
    }
    ctx.restore();
    return { w: PIN.w * k, h: PIN.h * k, x: Math.round(x - PIN.tipX * k), y: Math.round(y - PIN.tipY * k), k };
  }

  root.RoadArt = { bust, crew, fallback, figure, fighter, icon, pin, drawPin, pinPx, PIN, spec, KINDS, LOOKS, CREWS, kindOf, paste, painted, npc, oldHorse, backdrop, grid: { paste, crop, dim } };
})(typeof window !== "undefined" ? window : globalThis);
