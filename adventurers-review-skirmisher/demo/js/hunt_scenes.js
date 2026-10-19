/* Hunt scenes: an hour of a hunt day acted out on its wild's strip, hand-staged per act (reading sign, the stalk, a blind, a snare, the shot, the quarry bolting, foraging, dressing the kill, roasting it, camp, a retreat, the quarry turning), with the line's captions on their beats; the player and the daybook tile's loop. */
/*
  HuntScenes.actOf(block) -> { act, game, good, kind } from the stretch's phase (block.stretch, or a record's hour), its test and the
    words of its line. Acts (HuntScenes.ACTS): track look creep blind wade snare shot bolt forage dress roast camp walk retreat ambush.
  HuntScenes.player(block, opts) -> <figure> that plays while on screen, holds on its last beat, replays on click; fig.replay for the
    page's control bar. block: a daybook hunt block { stretch, biome, weather, from, to, line, test, event, fought } or a hunt road
    record { hunt: true, biome, weather, hour, line, heroes, lead }. opts: { hero, heroes (id -> hero, default App.heroes), band }.
  HuntScenes.strip(block, opts) -> <div class="road-strip"> with the act looping (10 fps, on screen only; one still under Static
    scenes). opts: { hero, band: [hero], w, h }.
  HuntScenes.frame(block, t, opts) -> canvas (no loop), for galleries. HuntScenes.make(block, opts) -> the planned scene.
  Needs road_scenes.js, road_art.js, scene_kits.js, stage.js and hunt_art.js; loaded through App.need with App.HUNT_ART.
*/
(function (root) {
  "use strict";
  const RS = root.RoadScenes, K = RS.kit, HA = root.HuntArt, { blit, mix, clamp, lerp, h2, hash } = K;
  const W = 176, H = 96;
  const R = Math.round;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const ease = (x) => x * x * (3 - 2 * x);
  const S = () => (root.App && root.App.S) || (root.LD && root.LD.static) || {};
  const reduced = () => (root.Settings && root.Settings.calm ? root.Settings.calm() : !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches));

  // ---------- which act, which game ----------
  // the line's own nouns pick the animal, the first one named winning ("a hare freezes... Rook does not waste it" is a hare, not a doe);
  // "does" is never a deer, and a drake is the scaled kind here, not a duck
  const GAME_WORDS = [
    [/\b(white (stag|hart)|silver stag|stag as white|pale stag)\b/, "whitestag"], [/\b(great stag|grey stag|crown of antlers|royal|twelve-pointer|old stag)\b/, "royal"],
    [/\b(stags?|harts?|bucks?|antlers?|rack)\b/, "stag"], [/\b(deer|doe|hinds?|fawns?|roe|herd|elk|reindeer)\b/, "doe"],
    [/\b(boars?|sow|hogs?|swine|tusker|tusks?|pigs?)\b/, "boar"], [/\b(hares?|rabbits?|coneys?|leverets?|warren)\b/, "hare"],
    [/\b(ptarmigan|snow ?grouse)\b/, "ptarmigan"], [/\b(pheasants?|covey|partridges?|grouse|woodcock|quail|game ?birds?|brace of birds|cock bird)\b/, "pheasant"],
    [/\b(ducks?|mallards?|teal|wildfowl|geese|goose|snipe|drakes? (sitting |swimming |riding )?on the (water|pool|mere))\b/, "duck"], [/\b(ibex|chamois)\b/, "ibex"], [/\b(goats?|kids?)\b/, "goat"],
    [/\b(crabs?|lobsters?)\b/, "crab"], [/\b(eels?|fish|trout|pike|grayling|salmon)\b/, "fish"], [/\b(fox|vixens?)\b/, "fox"],
    [/\b(wild ?cats?|lynx(es)?)\b/, "wildcat"], [/\bsquirrels?\b/, "squirrel"], [/\bherons?\b/, "heron"],
  ];
  // a small bird the line is about (the jay that gives the game away, the crow on the oak, the owl on its branch): it perches in the
  // scene, it is not the quarry
  const BIRD_WORDS = [[/\bjays?\b/, "jay"], [/\b(crows?|ravens?|rooks?)\b/, "crow"], [/\bmagpies?\b/, "magpie"], [/\bowls?\b/, "owl"]];
  // what climbs: a beast the line puts up a tree is drawn on a bough
  const CLIMBS = new Set(["wildcat", "squirrel", "owl", "jay", "crow", "magpie"]);
  const DEFAULT_GAME = { forest: ["stag", "doe", "boar"], plains: ["pheasant", "hare", "doe"], marsh: ["duck", "duck", "boar"], hills: ["goat", "goat", "hare"], snow: ["ibex", "snowhare", "ptarmigan"], coast: ["goat", "duck", "crab"] };
  const MISS = /\b(miss(es|ed)?|wide|gets? away|got away|gone|flees|fled|bolts?|nothing|empty|too late|vanish(es)?|scatter|loses? (it|the)|walks right past|in a circle|spooks?|startles?|not there|walks away|walks off|walks into)\b/;
  const SPARE = /\b(lowers? the (bow|spear|sling)|(bow|spear) (comes|stays) (down|slung|unstrung)|cannot (lift|bring)|does not reach|doesn't reach|lets it( go| walk| drink)?|spares?|puts the bow down|sees the fawn|stays slung|unstrung)\b/;
  const SHOOT = /\b(bows?|arrows?|shots?|shoots?|looses?|aims?|draws?|fletch|bowshot|spears?|sling(s|shot)?|throws?|in (the )?sights|in line)\b/;
  const KILL = /\b(drops?|clean kill|brings? (it |him |her )?down|kills?|takes (it|the \w+|two|one)\b(?! (a )?(long|moment|breath|bearing|step|look))|settles the matter|in one shot|makes the shot|takes the shot|does not waste it|goes into the bag|for the pot)\b/;
  const FOUND = /\b(took the \w+ before|winter and age|found (it |him |her )?(dead|fallen)|lies dead|already dead|dead in the|dead of its|fallen in the|a carcass)\b/;
  const GLIMPSE = /\b(flicker|glimpse[sd]?|gleam|half-seen|a shape in|catches sight)\b/;
  const FORAGE = /\b(herbs?|mushrooms?|fungus|chanterelles?|puffballs?|ceps?|caps?|berr(y|ies)|brambles?|sloes?|haws|cobbler|eggs?|nest|honey|hive|bees|sorrel|garlic|ramsons|greens|onions?|nettles?|watercress|cress|samphire|mussels?|limpets?|cockles?|shellfish|roots?|tubers?|burdock|\w*nuts?|acorns?|hazel\w*|thyme|mint|sage|moss|lichen|rose ?hips?|peppers?|firepepper|dandelions?|flowers?|moonpetal|truffles?)\b/;
  function phaseOf(b) {
    if (b.stretch) return b.stretch;
    const hr = b.hour != null ? b.hour : 9;
    return hr < 10 ? "sign" : hr < 13 ? "stalk" : hr < 16 ? "quarry" : "camp";
  }
  const HERD = { snow: "ibex", hills: "goat", coast: "goat" };
  function namedGame(L, biome) {
    // a simile is not an animal ("still as a heron"); the white stag and a great stag outrank any other beast in the line
    L = L.replace(/\b(still |quiet |patient |grey |sure )?as an? [a-z]+\b|\blike an? [a-z]+\b/g, " ");
    let id = null, at = 1e9;
    for (const [re, k] of GAME_WORDS) { const m = re.exec(L); if (m && (m.index < at || (k === "whitestag" || k === "royal") && id !== "whitestag")) { at = k === "whitestag" || k === "royal" ? -1 : m.index; id = k; } }
    if (!id) return null;
    // a bare "herd" is whatever runs in herds where the line is: ibex in the snow, goats on the crags and cliffs
    const herd = id === "doe" && !/(deer|does?|hinds?|fawns?|roe|elk|reindeer)/.test(L) && HERD[biome];
    return id === "hare" && biome === "snow" ? "snowhare" : herd || id;
  }
  // the foes a line names, from the league's own monster list (a count before a name repeats it), else the lead-ins' group words;
  // longer names first, so a Dire Wolf is not also a Wolf
  const GROUP = [[/\b(outlaws?|bandits?|brigands?|cutthroats?)\b/, "bandit"], [/\bdeads?\b/, "zombie"], [/\b(beasts? of the wood|wolves|wolf pack|the pack)\b/, "wolf"],
    [/\bspiders?\b/, "giant_spider"], [/\bettercaps?\b/, "ettercap"], [/\btrolls?\b/, "cave_troll"], [/\bbats?\b/, "giant_bat"], [/\bkobolds?\b/, "kobold"],
    [/\bdrakes?\b/, "drake"], [/\bgoblins?\b/, "goblin"], [/\bbog-things\b/, "bog_crawler"], [/\bclaim-jumpers?\b/, "claim_jumper"], [/\bsmugglers?\b/, "fen_smuggler"],
    [/\bwreckers?\b/, "wrecker"], [/\byetis?\b/, "yeti"], [/\bcrawlers?\b/, "bog_crawler"]];
  let monRe = null;
  function foesOf(line) {
    const M = S().monsters || {};
    if (!monRe) {
      const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      monRe = Object.entries(M).filter(([, m]) => m && m.name && !m.boss).map(([id, m]) => {
        const n = esc(m.name), alt = [...new Set([n + "e?s", n.replace(/f$/, "ves"), n.replace(/y$/, "ies"), n.replace(/an$/i, "en"), n])];
        return [id, new RegExp("(?:\\b(\\d+|two|three|four|five|six) )?\\b(?:" + alt.join("|") + ")\\b", "gi"), m.name.length];
      }).sort((a, b) => b[2] - a[2]);
    }
    let txt = String(line || "");
    const hits = [], NUM = { two: 2, three: 3, four: 4, five: 5, six: 6 };
    for (const [id, re] of monRe) {
      re.lastIndex = 0;
      txt = txt.replace(re, (all, num, at) => { hits.push({ id, at, n: num ? +num || NUM[num.toLowerCase()] || 1 : 1 }); return " ".repeat(all.length); });
    }
    if (!hits.length) {
      const L = txt.toLowerCase();
      for (const [re, id] of GROUP) { const m = re.exec(L); if (m && M[id]) hits.push({ id, at: m.index, n: /s$/.test(m[0]) && !/ss$/.test(m[0]) ? 2 : 1 }); }
    }
    // the lead-in and the tally name the same foes twice ("the drake... a Drake"): each kind once, at its biggest count
    const by = new Map();
    for (const h of hits) { const o = by.get(h.id); if (!o) by.set(h.id, h); else { o.at = Math.min(o.at, h.at); o.n = Math.max(o.n, h.n); } }
    const kinds = [...by.values()].sort((a, b) => a.at - b.at).slice(0, 3), n = kinds.map(() => 1);
    for (let left = 3 - kinds.length, grew = true; left > 0 && grew;) { grew = false; kinds.forEach((h, i) => { if (left > 0 && n[i] < Math.min(h.n, 3)) { n[i]++; left--; grew = true; } }); }
    const out = [];
    kinds.forEach((h, i) => { for (let k = 0; k < n[i]; k++) out.push(Object.assign({ id: h.id }, M[h.id])); });
    return out;
  }
  function gameOf(L, biome, key) {
    const n = namedGame(L, biome);
    if (n) return n;
    const opts = DEFAULT_GAME[biome] || DEFAULT_GAME.plains;
    return opts[hash(key) % opts.length];
  }
  function forageKind(L, biome) {
    return /\b(fiddleheads?|ferns?|fern tips|coils|bracken shoots)\b/.test(L) ? "ferns" : /\bsamphire\b/.test(L) ? "samphire" : /\b(crab-?apples?|apples?)\b/.test(L) ? "apples"
      : /\b(trout|fish(es|ing)?|eels?)\b/.test(L) && !/\b(mussels?|limpets?|cockles?)\b/.test(L) ? "pool" : /\b(moonpetal|flowers?|blossoms?)\b/.test(L) ? "flowers"
      : /\b(mushrooms?|fungus|chanterelles?|puffballs?|ceps?|caps?|truffles?)\b/.test(L) ? "mushrooms" : /\b(\w*berr(y|ies)|brambles?|sloes?|haws|cobbler|rose ?hips?)\b/.test(L) ? "berries"
      : /\b(eggs?|nest)\b/.test(L) ? "nest" : /\b(honey|hive|bees)\b/.test(L) ? "honey" : /\b(mussels?|limpets?|cockles?|shellfish|crabs?|samphire)\b/.test(L) ? "shore"
      : /\b(moss|lichen)\b/.test(L) ? "moss" : /\b(roots?|tubers?|burdock|dig(s|ging)?|dug)\b/.test(L) ? "roots" : /\b(\w*nuts?|acorns?|hazel\w*|pine ?nuts?)\b/.test(L) ? "nuts"
      : /\b(sorrel|garlic|ramsons|greens|nettles?|watercress|cress|dandelions?|leaves|chickweed|onions?)\b/.test(L) ? "greens"
      : /\b(peppers?|firepepper)\b/.test(L) ? "pepper" : "herbs";
  }
  // the line read without the heroes' names in it (a hero called Bramble is not a bramble bush)
  function bare(line) {
    let s = String(line || "");
    for (const h of Object.values((root.App && root.App.heroes) || {})) if (h && h.name && h.name.length > 2) s = s.split(h.name).join("Xhero");
    return s.toLowerCase();
  }
  function actOf(b) {
    const L = bare(b.line), ph = phaseOf(b), biome = b.biome || "plains";
    const dish = root.Stage && root.Stage.dishIn ? root.Stage.dishIn(b.line || "") : null;
    const named = namedGame(L, biome);
    let bird = null;
    for (const [re, id] of BIRD_WORDS) if (re.test(L)) { bird = id; break; }
    const spare = SPARE.test(L), shoot = SHOOT.test(L), kill = KILL.test(L);
    let act;
    if (b.fought) act = "ambush";
    else if (ph === "retreat") act = "retreat";
    else if (/\b(snares?|noose|trap ?line|set (a|the|her|his|their) traps?|deadfall)\b/.test(L)) act = "snare";
    else if (ph === "dress") act = dish || /\b(roast|spit|cooks?|stew|pot|over the fire|on the coals|grills?)\b/.test(L) ? "roast" : "dress";
    else if (ph === "camp") act = dish || /\b(roast|spit|turns? the|cooks?|on the coals)\b/.test(L) ? "roast" : "camp";
    else if (FOUND.test(L)) act = "found";
    else if (ph === "forage" || (FORAGE.test(L) && ph !== "quarry" && ph !== "sign" && !/\bants?\b/.test(L))) act = "forage";
    else if (/\b(fords?|wades?|wading|stream|current|brook|beck|stepping stones?)\b/.test(L) && ph !== "quarry") act = "wade";
    else if (GLIMPSE.test(L) && (ph === "quarry" || ph === "stalk" || ph === "sign")) act = "glimpse";
    else if (ph === "quarry") {
      act = (bird || /\bwatch(es|ing)?\b/.test(L)) && !kill && !shoot ? "watch" : spare || shoot || kill ? "shot" : /\b(gets? away|bolts?|scatter|flush(es)?|runs?|bounds?|wind (swings|shifts|turns))\b/.test(L) ? "bolt" : FORAGE.test(L) ? "forage" : "watch";
    } else if (ph === "stalk") act = /\b(blind|hides?|hidden|ferns?|lies? (still|flat|up)|waits?|waiting|hollow|crouch(es)?|frozen|freezes|still as)\b/.test(L) ? "blind" : bird ? "watch" : "creep";
    else if (ph === "sign") act = /\b(ridge|listens?|howls?|smoke|scans?|valley|horizon|look(s)? out|far below|counts the|watch(es)? the)\b/.test(L) ? "look" : "track";
    else act = /\b(ridge|listens?|howls?|valley|horizon|far below|seals|gulls)\b/.test(L) ? "look" : "walk";
    const key = String(b.event || b.line || "") + biome;
    const game = gameOf(L, biome, key);
    // a test says how it went; a line without one is read for a miss
    const good = b.test ? b.test === "good" : !MISS.test(L);
    // the shot's end: a kill only when the line has one (or a good test on a line with the shot in it); the white stag is never taken
    let outcome = spare ? "spare" : (b.test ? b.test === "good" : kill || !MISS.test(L)) && (kill || shoot) ? "kill" : "miss";
    if (game === "whitestag" && outcome !== "spare") outcome = "vanish";
    const kind = forageKind(L, biome);
    const marks = /\bfeathers?\b/.test(L) ? "feather" : /\b(dung|scat|droppings?|spoor)\b/.test(L) ? "scat" : /\b(hair|tufts?|fur)\b(?!-)/.test(L) ? "tuft" : null;
    const tracks = trailOf(L, named);
    const weapon = /\b(spears?|barbed pole|javelin)\b/.test(L) ? "spear" : /\bsling(s|shot)?\b/.test(L) ? "sling" : null;
    const perch = CLIMBS.has(game) && /\b(branch|bough|tree|limb|oak|pine)\b/.test(L);
    // a trail on the ground under every hour of reading sign, and under any other hour whose line is about prints
    const trail = ph === "sign" || /\b(prints?|tracks?|hoofprints?|pugmarks?|slots)\b/.test(L);
    return { act, game, named, bird, good, outcome, kind, marks, tracks, trail, dish, phase: ph, weapon, perch, gulls: /\bgulls?\b/.test(L), mist: /\b(mist|fog|haze)\b/.test(L),
      foes: foesOf(b.line), skull: /\b(skull|rack|trophy|mask)\b/.test(L), hide: /\b(hide|pelt|skin)\b/.test(L),
      // a find looked at and left be: the patch stays whole and the hero stands off it
      leaves: b.branch === "leave" || /\b(leaves? (the \w+ |it |them )?(alone|be)|lets? (it|them) be|steps wide|takes nothing)\b/.test(L) };
  }
  // the prints an animal leaves; a trail nobody has named is plain scuffed prints
  const printOf = (g) => (!g ? "scuff" : g === "duck" ? "webbed" : HA.BIRDS.has(g) ? "bird" : g === "boar" ? "boar" : g === "goat" || g === "ibex" ? "goat"
    : g === "hare" || g === "snowhare" ? "hare" : ["fox", "wildcat", "squirrel"].includes(g) ? "paw" : g === "crab" ? "crab" : g === "fish" ? "scuff" : "deer");
  // what the line says is on the ground: blood, dew brushed off, a webbed foot, a huge pugmark, paws, boots, hooves, else the named animal's;
  // a dragged tail or carcass adds its furrow
  function trailOf(L, named) {
    const base = /\b(blood|bleed\w*|drops)\b/.test(L) ? "blood" : /\bdew\b/.test(L) ? "dew" : /\bwebbed\b/.test(L) ? "webbed"
      : /\b(five toes|dinner plate|bears?|yetis?|wider than)\b/.test(L) ? "bigpaw" : /\b(wolf|wolves|paws?|pads|fox|hounds?|dogs?|badgers?|cats?|toes)\b/.test(L) ? "paw"
      : /\b(boots?|bootprints?|hobnails?|men)\b/.test(L) ? "boot" : !named && /\b(cloven|hoofprints?|hooves|slots)\b/.test(L) ? "deer" : printOf(named);
    return /\bdrag(ged|s|ging)?\b/.test(L) && base !== "blood" ? base + "+drag" : base;
  }
  // the hunting weapon follows the hero: a bow for archers, otherwise what they carry, or a sling for hands that carry a lute or a pan
  const HUNT_WEAPON = { bow: "bow", crossbow: "crossbow", spear: "spear", staff: "staff", wand: "staff", sword: "blade", axe: "blade", mace: "blade", hammer: "blade", daggers: "knife", parrying_dagger: "knife" };
  const weaponOf = (h, line) => line || HUNT_WEAPON[(h && h.weapon) || ""] || (h && h.weapon ? "sling" : "bow");

  // ---------- the cast ----------
  function heroOf(x, all) {
    if (!x) return null;
    const h = typeof x === "string" ? (all[x] || { id: x, name: x }) : x;
    return h;
  }
  function castOf(b, opts) {
    const all = (opts && opts.heroes) || (root.App && root.App.heroes) || {};
    let band = ((opts && opts.band) || []).map((x) => heroOf(x, all)).filter(Boolean);
    // the crew that day (a daybook hour carries it, a record its heroes), not the party the hero is in by the time it is watched
    const crew = b.crew || b.heroes;
    if (crew) band = crew.map((x) => heroOf(x, all)).filter(Boolean);
    const hero = heroOf(opts && opts.hero, all) || band[0] || null;
    if (hero && !band.some((x) => x.id === hero.id)) band.unshift(hero);
    const L = String(b.line || "");
    let lead = b.lead ? heroOf(b.lead, all) : null;
    if (!lead) {
      // whoever the line names first leads the act: the crew's best hunter took the test, not always the page's own hero
      let at = 1e9;
      for (const x of band.concat(Object.values(all))) { const i = x && x.name ? L.indexOf(x.name) : -1; if (i >= 0 && i < at) { at = i; lead = x; } }
    }
    lead = lead || hero || { id: "hunter", name: "A hunter" };
    if (!band.some((x) => x.id === lead.id)) band.unshift(lead);
    const mates = band.filter((x) => x.id !== lead.id).slice(0, 2);
    return { lead: fig(lead), mates: mates.map(fig), pet: lead.pet || null };
  }
  // a hero's figures: standing armed, standing and kneeling with the hands free (for the bow, the knife, the gathering), walk frames
  const figs = new Map();
  function fig(h) {
    const key = h.id + JSON.stringify([h.look, h.cls, h.weapon, h.weapon_tier, h.kit || null]);
    if (figs.has(key)) return figs.get(key);
    const cls = (S().classes || {})[h.cls] || (root.App && root.App.heroLook ? root.App.heroLook(h) : null) || { look: { outfit: "leather", head: "none" } };
    let g = null, free = null, kneel = null;
    try { g = h.look ? root.Art.heroGrid(h, 0, cls) : null; } catch (e) { g = null; }
    if (!g) g = root.RoadArt ? root.RoadArt.figure({ id: "hero:" + h.id, name: h.name, role: "hunter" }, 0) : new root.Art.Grid(28, 34);
    // a posed body is painted on a padded canvas, standing at (34, 34): cropped to what it covers, the feet row kept at the bottom and
    // ax the column the standing body is centred on
    const pose = (q) => {
      if (!h.look || !root.Paint) return null;
      try {
        const clsLook = Object.assign({ cn: cls.name || "" }, cls.look || { outfit: "leather", head: "none" });
        const big = root.Paint.fullBody({ id: h.id, name: h.name, look: h.look, clsLook, weapon: h.weapon, weaponTier: h.weapon_tier || 1, armorTier: h.armor_tier || h.weapon_tier || 1,
          legend: h.legend, kit: h.kit || null, frame: 0, pose: q });
        let x0 = big.w, x1 = 0, y0 = 67;
        for (let y = 0; y <= 67; y++) for (let x = 0; x < big.w; x++) if (big.px[y * big.w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
        if (x1 < x0) return null;
        const out = new root.Art.Grid(x1 - x0 + 1, 68 - y0);
        for (let y = y0; y <= 67; y++) for (let x = x0; x <= x1; x++) out.px[(y - y0) * out.w + x - x0] = big.px[y * big.w + x] || null;
        out.ax = 48 - x0;
        return out;
      } catch (e) { return null; }
    };
    free = pose({ without: ["weapon"] }) || g;
    kneel = pose({ kneel: 1, without: ["weapon"] }) || g;
    // the stalker's crouch: down on the knees and leaning in toward the game
    const creep = pose({ kneel: 1, tilt: 0.35, pivot: [0.5, 1], without: ["weapon"] }) || kneel;
    const f = { h, g, free, kneel, creep, skin: (h.look && h.look.skin) || "#d8a070" };
    figs.set(key, f);
    return f;
  }
  // a figure on the ground line at x: mode stand | free | walk | kneel | creep | limp | aim (free, with the bow drawn by the act)
  function drawFig(img, I, f, x, o) {
    o = o || {};
    let g = f.g;
    if (o.mode === "walk" || o.mode === "limp") g = RS.walker(f.g, o.k || 0);
    else if (o.mode === "free" || o.mode === "aim") g = f.free;
    else if (o.mode === "kneel") g = f.kneel;
    else if (o.mode === "creep") g = f.creep;
    const flip = o.face < 0, dy = (o.dip || 0) - (o.back || 0) + (o.mode === "limp" && (o.k & 3) === 1 ? 1 : 0), ax = g.ax != null ? g.ax : g.w / 2;
    // a soft shadow under the feet
    for (let i = -5; i <= 5; i++) img.px(R(x) + i, I.feet + 1 - (o.back || 0), "#140c06", 0.22 * (1 - Math.abs(i) / 7));
    blit(img, g, R(x - (flip ? g.w - ax : ax)), I.feet - g.h + 1 + dy, { G: I.Gf, flip, alpha: o.alpha });
    return g;
  }
  function drawBeast(img, I, id, pose, f, x, o) {
    o = o || {};
    const g = HA.beast(id, pose, f);
    if (!g) return;
    const lift = o.lift || 0;
    if (!lift && !o.sink) for (let i = -R(g.w * 0.35); i <= R(g.w * 0.35); i++) img.px(R(x) + i, I.feet + 1, "#140c06", 0.18 * (o.alpha == null ? 1 : o.alpha));
    const gx = R(x - g.w / 2), gy = I.feet - g.h + 1 - lift + (o.sink || 0), clip = o.sink ? (xx, yy) => yy <= I.feet - 2 : null;
    // the white stag carries its own light: a pale rim round the whole beast, warmer on the sunward side
    if (id === "whitestag") for (const [dx, dy, c, k] of [[-1, 0, "#fff4d0", 0.7], [0, -1, "#fff8e4", 0.75], [1, 0, "#dfe8ff", 0.45], [0, 1, "#dfe8ff", 0.3]])
      blit(img, g, gx + dx, gy + dy, { flip: o.face < 0, alpha: k * (o.alpha == null ? 1 : o.alpha), clip, map: () => c });
    blit(img, g, gx, gy, { G: I.Gf, flip: o.face < 0, alpha: o.alpha, clip });
  }
  // a bow held out toward face: its stave, the string drawn back by k (0-1) and the arrow on the string until it is loosed
  function bow(img, I, x, face, k, nocked) {
    const bx = R(x + face * 7), by = I.feet - 17, wood = I.Gf("#7a4a22", 0), hi = I.Gf("#b07a40", 0), str = I.Gf("#efe6d0", 0), pull = R(k * 5);
    for (let j = -8; j <= 8; j++) { const dx = R(Math.cos((j / 8) * Math.PI / 2) * 2.6); img.px(bx + face * dx, by + j, Math.abs(j) < 2 ? I.Gf("#3a2414", 0) : j < 0 ? hi : wood); }
    img.line(bx, by - 8, bx - face * pull, by, str); img.line(bx - face * pull, by, bx, by + 8, str);
    if (nocked) { img.line(bx - face * pull, by, bx + face * 5, by, I.Gf("#c8a878", 0)); img.px(bx + face * 6, by, I.Gf("#d8dce4", 0)); img.px(bx - face * pull - face, by - 1, I.Gf("#e8e0d0", 0)); img.px(bx - face * pull - face, by + 1, I.Gf("#c84030", 0)); }
    return [bx, by];
  }
  function arrow(img, I, x, y, face, stuck, short) {
    const c = I.Gf("#c8a878", 0), n = short ? 4 : 7;
    img.line(R(x), R(y), R(x - face * n), R(y + (stuck ? -2 : 0)), c);
    img.px(R(x + face), R(y), I.Gf("#d8dce4", 0));
    img.px(R(x - face * n), R(y - 1 + (stuck ? -2 : 0)), I.Gf("#e8e0d0", 0)); img.px(R(x - face * n), R(y + 1 + (stuck ? -2 : 0)), I.Gf("#c84030", 0));
  }
  function gridAt(img, I, g, x, y, o) { if (g) blit(img, g, R(x - g.w / 2), R(y - g.h + 1), Object.assign({ G: I.Gf }, o || {})); }
  // a camp fire: a ring of stones, crossed logs, flames that never hold still, sparks and smoke, and its warm pool after dusk
  function fire(img, I, x, t, big) {
    const y = I.feet + 2;
    for (let i = -4; i <= 4; i++) img.px(x + i * 1.6, y + (Math.abs(i) > 2 ? 0 : 1), I.Gf(i % 2 ? "#8a8478" : "#5e5a52", 0));
    img.line(x - 5, y - 1, x + 4, y - 2, I.Gf("#4a3420", 0)); img.line(x - 4, y - 2, x + 5, y - 1, I.Gf("#5a4028", 0));
    const hh = big ? 7 : 5;
    for (let i = -3; i <= 3; i++) {
      const fl = hh - Math.abs(i) * 1.4 + Math.round((Math.sin(t * 13 + i * 2.3) + 1) * 1.2);
      for (let j = 0; j < fl; j++) img.px(x + i, y - 2 - j, j < fl * 0.35 ? "#ff7a1a" : j < fl * 0.75 ? "#ffc040" : "#fff2a8");
    }
    for (let k = 0; k < 3; k++) { const ph = (t * 0.9 + k / 3) % 1; img.px(x + Math.sin(ph * 9 + k) * 3, y - hh - 2 - ph * 14, "#ffd070", 1 - ph); }
    const sm = K.smoke(x, y - hh - 4, I.night ? "#6a6a7a" : "#d0d0d4", 0.8, 5);
    sm(img, t);
  }
  function glow(img, I, x, k) {
    if (!(I.hr > 16.6 || I.hr < 6.5 || I.night) || k <= 0) return;
    const r = 34, y = I.feet - 4;
    for (let yy = -r; yy <= r * 0.5; yy++) for (let xx = -r * 1.6; xx <= r * 1.6; xx++) {
      const d = Math.hypot(xx / 1.6, yy) / r;
      if (d < 1) img.px(x + xx, y + yy, "#ff9a3a", (1 - d) * (1 - d) * 0.28 * k * (I.night ? 1.4 : 1));
    }
  }
  function bubble(img, I, x, y, ch) {
    // a "!" or "?" over a head when something gives the game away or the trail goes cold
    const c = "#2a1a12", bg = "#f4e8cc";
    for (let j = -4; j <= 4; j++) for (let i = -3; i <= 3; i++) if (Math.abs(i) + Math.abs(j) * 0.6 < 4) img.px(x + i, y + j, bg);
    if (ch === "!") { for (let j = -3; j <= 1; j++) img.px(x, y + j, c); img.px(x, y + 3, c); }
    else { img.px(x - 1, y - 3, c); img.px(x, y - 4, c); img.px(x + 1, y - 3, c); img.px(x + 1, y - 2, c); img.px(x, y - 1, c); img.px(x, y + 0, c); img.px(x, y + 2, c); }
  }

  // ---------- the acts: each draws the cast and its props at time t; dur, its loop and the beats the captions land on ----------
  // ctx: { I, W, cx, cast, game, good, outcome, kind, marks, dish, biome, line, weapon, bird }
  const walkK = (t, sp) => Math.floor(t * (sp || 6));
  // the crew behind the lead, a step further back from the eye the further down the line, and never pushed off the left of the frame
  function mates(img, I, ctx, t, x0, mode, face) {
    const n = ctx.cast.mates.length;
    ctx.cast.mates.forEach((m, i) => {
      const x = Math.max(16 + (n - 1 - i) * 13, x0 - 20 - i * 16);
      drawFig(img, I, m, x, { mode: mode || "stand", k: walkK(t + i * 0.3), back: 2 + i * 2, face });
    });
  }
  function walkTo(t, t0, t1, x0, x1) { const k = seg(t, t0, t1); return { x: lerp(x0, x1, k), moving: k > 0 && k < 1 }; }
  // an animal going about its business while it is watched: grazing (the head bobbing as it crops), now and then the head up to look
  // about, a few steps on and back; ph staggers two of them so they never move as one
  function idle(t, ph) {
    const T = t + (ph || 0) * 2.3, cyc = Math.floor(T / 7), p = T - cyc * 7, back = cyc % 2 === 1;
    if (p < 2.6) return { pose: "graze", f: Math.floor(T * 2.2) & 1, dx: back ? 0 : 6, face: 1 };
    if (p < 3.8) return { pose: "alert", f: Math.floor(T * 2.5) & 1, dx: back ? 0 : 6, face: 1 };
    if (p < 5) { const k = (p - 3.8) / 1.2; return { pose: "walk", f: Math.floor(T * 7), dx: back ? lerp(6, 0, k) : lerp(0, 6, k), face: back ? -1 : 1 }; }
    return { pose: "graze", f: Math.floor(T * 2.2) & 1, dx: back ? 0 : 6, face: 1 };
  }
  function idleBeast(img, I, id, t, x, ph, o) {
    const s = idle(t, ph);
    drawBeast(img, I, id, s.pose, s.f, x + s.dx - 3, Object.assign({ face: s.face }, o || {}));
  }
  // the weapon a hunter readies: a bow drawn, a crossbow levelled, a spear or a knife lifted to throw, a staff raised, a sling whirled
  function ready(img, I, c, x, k, t, held) {
    const wpn = c.weapon, y = I.feet - 17;
    if (wpn === "bow") return bow(img, I, x, 1, k, held);
    if (wpn === "sling" && held) {
      const a = t * 14, hx = R(x + 3), hy = I.feet - 30, ex = R(hx + Math.cos(a) * 5), ey = R(hy + Math.sin(a) * 2);
      img.line(hx, hy, ex, ey, I.Gf("#c8a878", 0)); img.px(ex, ey, I.Gf("#6a6660", 0)); img.px(ex + 1, ey, I.Gf("#8a8478", 0));
      return [hx, hy];
    }
    if (wpn === "spear" && held) {
      // the spear drawn back over the shoulder, its point toward the game
      const bx = R(x - 6 - k * 3), by = I.feet - 28, tx = bx + 17, ty = by - 3;
      img.line(bx, by, tx, ty, I.Gf("#8a5a32", 0)); img.px(tx + 1, ty, I.Gf("#d8dce4", 0)); img.px(tx, ty - 1, I.Gf("#b0b8c4", 0)); img.px(tx + 2, ty, I.Gf("#eef2f8", 0));
      return [tx - 6, ty];
    }
    if (wpn === "knife" && held) { const hx = R(x + 3 - k * 2), hy = I.feet - 31; img.px(hx, hy, I.Gf("#5a3a22", 0)); img.px(hx, hy - 1, I.Gf("#d8dce4", 0)); img.px(hx, hy - 2, I.Gf("#eef2f8", 0)); return [hx, hy]; }
    if (wpn === "staff" && held) { for (let j = 0; j < 4; j++) img.px(R(x + 8 + Math.cos(t * 9 + j * 1.6) * 2), R(I.feet - 30 + Math.sin(t * 9 + j * 1.6) * 2), "#bfe8ff", 0.5 + k * 0.5); return [R(x + 8), I.feet - 30]; }
    return [R(x + 8), y - 4];
  }
  // what flies from it: an arrow or a bolt, a stone, a spark of light, a spear end over end, a knife spinning
  function missile(img, I, c, x, y, face) {
    const wpn = c.weapon;
    if (wpn === "bow" || wpn === "crossbow") return arrow(img, I, x, y, face, false, wpn === "crossbow");
    if (wpn === "sling") { img.px(R(x), R(y), I.Gf("#6a6660", 0)); img.px(R(x) + 1, R(y), I.Gf("#8a8478", 0)); return; }
    if (wpn === "staff") { for (let k = 0; k < 6; k++) img.px(R(x - face * k), R(y + Math.sin(k) * 0.6), k ? "#9ad8ff" : "#ffffff", 1 - k / 7); return; }
    if (wpn === "spear") { img.line(R(x), R(y), R(x - face * 13), R(y + 2), I.Gf("#8a5a32", 0)); img.px(R(x + face), R(y), I.Gf("#d8dce4", 0)); img.px(R(x), R(y) - 1, I.Gf("#b0b8c4", 0)); return; }
    const a = Math.floor(x / 2) % 2;
    img.px(R(x), R(y), I.Gf("#d8dce4", 0)); img.px(R(x) + (a ? 1 : 0), R(y) + (a ? 0 : 1), I.Gf("#a8b0bc", 0)); img.px(R(x) - 1, R(y), I.Gf("#5a3a22", 0));
  }
  // an animal that has bolted is not gone from the picture: it stops far off on the slope (an ibex on a spur of rock) and looks back
  function farOff(img, I, c, t, t0) {
    if (t < t0 || HA.BIRDS.has(c.game) || c.perch || ["whitestag", "fish", "crab"].includes(c.game)) return;
    distant(img, I, c, c.W - 22, t, seg(t, t0, t0 + 0.8));
  }
  function distant(img, I, c, x, t, a) {
    const g = HA.beast(c.game, Math.sin(t * 1.1) > 0.3 ? "alert" : "stand", 0);
    if (!g) return;
    const sh = shrink(g), spur = (c.game === "ibex" || c.game === "goat") && (c.biome === "snow" || c.biome === "hills"), y = I.roadTop + 1 - (spur ? 7 : 0);
    if (spur) for (let j = 0; j < 8; j++) for (let i = -3 - R(j * 1.1); i <= 2 + j; i++) img.px(R(x) + i, y + j, I.G(j < 2 && c.biome === "snow" && i < 2 ? "#f4f8ff" : i < -1 - j * 0.6 ? "#9a9aa6" : i > j * 0.5 ? "#4a4c58" : "#6e707c", 0.3));
    if (a > 0) blit(img, sh, R(x - sh.w / 2), y - sh.h + 1, { G: I.G, depth: 0.3, flip: true, alpha: a });
  }
  // the white stag is lit from within: a cold light round it that breathes
  function aura(img, I, x, t, a) {
    if (I.weather !== "fog") return;
    const y = I.feet - 30, r = 26;
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) { const d = Math.hypot(xx, yy * 1.2) / r; if (d < 1) img.px(R(x + xx), R(y + yy), "#eef6ff", (1 - d) * (1 - d) * 0.22 * (a == null ? 1 : a) * (0.85 + Math.sin(t * 2) * 0.15)); }
  }
  // the small bird a line is about: on a bough reaching in from the right, hopping and shrieking (or lifting off) by the beat
  function perched(img, I, c, t) {
    if (!c.bird) return;
    const bx = R(c.W * 0.8), by = I.feet - 44;
    for (let x = bx - 10; x < c.W; x++) { img.px(x, by + R((x - bx) * 0.15), I.Gf("#3a2a1e", 0)); img.px(x, by + 1 + R((x - bx) * 0.15), I.Gf("#2a1e14", 0)); }
    const off = t > 5.8, k = seg(t, 5.8, 7.4);
    const g = HA.beast(c.bird, off ? "fly" : Math.sin(t * 5) > 0.3 ? "alert" : "stand", walkK(t, 10) & 1);
    if (g) blit(img, g, R(bx - 4 - g.w / 2 + k * 60), by - g.h + 1 - R(k * 24), { G: I.Gf });
    if (!off && Math.sin(t * 5) > 0.3) for (let j = 0; j < 3; j++) img.px(bx + 4 + j * 2, by - 9 - j, "#f4e8cc", 0.8);
  }
  // a bough reaching in from the right at height up above the ground line
  function bough(img, I, c, up) {
    const by = I.feet - up + 1, x0 = R(c.cx + 26);
    for (let x = x0; x < c.W; x++) { const y = by + R((x - x0) * -0.08); img.px(x, y, I.Gf("#4a3624", 0)); img.px(x, y + 1, I.Gf("#2a1e14", 0)); if ((x * 7) % 11 === 0) img.px(x, y - 1, I.Gf("#5a4630", 0)); }
    for (let k = 0; k < 4; k++) { const lx = c.W - 6 - k * 9, ly = by - 3 - (k % 2) * 2; for (let i = -3; i <= 3; i++) for (let j = -2; j <= 1; j++) if (i * i / 9 + j * j / 4 <= 1) img.px(lx + i, ly + j, I.Gf((i + j) % 3 ? "#3e5a2c" : "#2a4220", 0)); }
  }
  function treeShot(img, I, c, t, hx, gx) {
    const up = c.game === "squirrel" || HA.BIRDS.has(c.game) ? 34 : 30, loose = 4.2, fly = seg(t, loose, loose + 0.4), out = c.outcome, kill = out === "kill";
    bough(img, I, c, up);
    const bx = gx + 2;
    if (t < loose + 0.4) drawBeast(img, I, c.game, t > 2.6 ? "alert" : "stand", walkK(t, 2) & 1, bx, { lift: up, face: -1 });
    else if (kill) { const k = seg(t, loose + 0.4, loose + 1); drawBeast(img, I, c.game, k < 1 ? "bolt" : "down", 0, bx + k * 4, { lift: R(up * (1 - k * k)), face: -1 }); }
    else if (out === "spare") drawBeast(img, I, c.game, "walk", walkK(t, 6), bx + seg(t, 5, 8) * 60, { lift: up });
    else { const k = seg(t, loose + 0.3, loose + 2); drawBeast(img, I, c.game, "bolt", walkK(t, 8) & 1, bx + k * 70, { lift: up + R(k * 8) }); }
    const w = walkTo(t, 0, 1.4, c.cx - 66, hx), after = kill && t > loose + 1.4, v = after ? walkTo(t, loose + 1.6, loose + 3.4, hx, bx - 16) : w;
    mates(img, I, c, t, Math.min(w.x, hx - 4), w.moving ? "walk" : "kneel");
    const aiming = t > 1.4 && t < loose + 1.2 && out !== "spare";
    drawFig(img, I, c.cast.lead, v.x, { mode: v.moving ? "walk" : aiming ? "aim" : "stand", k: walkK(t) });
    if (aiming) {
      const [ax, ay] = ready(img, I, c, v.x, t < loose ? seg(t, 1.8, 3.2) : 0, t, t < loose);
      if (t >= loose && fly < 1) missile(img, I, c, lerp(ax + 6, bx - 4 + (kill ? 0 : 10), fly), lerp(ay - 2, I.feet - up - 6 - (kill ? 0 : 6), fly), 1);
    }
  }
  // the foes a fight is with, stepping out of the brush toward the crew (Art's own monster sprites, the ones the fight replays use)
  const foeMemo = new Map();
  function foeGrid(m, f) {
    const k = m.body + m.pal + f;
    if (!foeMemo.has(k)) { let g = null; try { g = root.Art.monsterGrid(m, f); } catch (e) { g = null; } foeMemo.set(k, g); }
    return foeMemo.get(k);
  }
  const DEFAULT_FOE = { forest: "wolf", plains: "bandit", marsh: "bog_crawler", hills: "kobold", snow: "frost_wolf", coast: "crab" };
  const ACTS = {
    // reading sign: in to the marks, down on one knee to read them, then up and on along the trail (or a shrug where it ends)
    track: { dur: 8, beats: [0.4, 3, 5.6], draw(img, I, c, t) {
      const mx = c.cx + 6;
      const marks = c.marks;
      if (marks === "feather") { const g = root.Stage ? root.Stage.prop("feather") : null; gridAt(img, I, g, mx + 6, I.feet + 4); }
      else if (marks === "scat") { for (let i = 0; i < 6; i++) { img.px(mx + 4 + (i % 3) * 2, I.feet + 4 - (i >> 1 & 1), I.G("#2a1e14", 0)); img.px(mx + 5 + (i % 3) * 2, I.feet + 4 - (i >> 1 & 1), I.G("#4a3624", 0)); } }
      else if (marks === "tuft") { gridAt(img, I, HA.prop("stone", { biome: c.biome }), mx + 10, I.feet + 4); for (const [dx, dy, col] of [[8, -2, "#9a948c"], [9, -3, "#c8c0b4"], [10, -2, "#b0aca4"], [9, -1, "#8a8478"]]) img.px(mx + dx, I.feet + 3 + dy, I.G(col, 0)); }
      HA.prints(img, I, mx - 2, c.W + 4, c.tracks, I.G);
      const w = walkTo(t, 0, 2, c.cx - 64, c.cx - 8);
      let x = w.x, mode = w.moving ? "walk" : "stand", dip = 0;
      if (t > 2 && t < 5.2) { mode = "kneel"; dip = Math.sin(t * 3) > 0.6 ? 1 : 0; }
      if (t >= 5.2) {
        if (c.good) { const v = walkTo(t, 5.6, 8, c.cx - 8, c.cx + 34); x = v.x; mode = v.moving ? "walk" : "stand"; }
        else { mode = "free"; if (t > 5.6) bubble(img, I, R(x), I.feet - 40, "?"); }
      }
      mates(img, I, c, t, Math.min(x, c.cx - 20), w.moving || (c.good && t > 5.6 && t < 8) ? "walk" : "stand");
      drawFig(img, I, c.cast.lead, x, { mode, k: walkK(t), dip });
    } },
    // looking out from a rise: a hand to the brow, the far game moving on the slope beyond
    look: { dur: 7, beats: [0.4, 2.6, 4.8], draw(img, I, c, t) {
      const gx = c.cx + 46 + Math.sin(t * 0.3) * 6, small = HA.SMALL.has(c.game);
      if (!small) { const s = idle(t, 1), g = HA.beast(c.game, s.pose, s.f); if (g) { const sh = shrink(g); blit(img, sh, R(gx + s.dx * 0.5 - sh.w / 2), I.roadTop - sh.h + 2, { G: I.G, depth: 0.3, flip: s.face < 0 }); } }
      const w = walkTo(t, 0, 2.2, c.cx - 64, c.cx - 22);
      mates(img, I, c, t, w.x, w.moving ? "walk" : "stand");
      drawFig(img, I, c.cast.lead, w.x, { mode: w.moving ? "walk" : "stand", k: walkK(t), dip: t > 2.6 && t < 6 && Math.sin(t * 1.4) > 0.7 ? 1 : 0 });
      if (t > 2.6 && t < 6.2) { const hx = R(w.x + 2), hy = I.feet - 29; img.px(hx, hy, I.Gf(c.cast.lead.skin, 0)); img.px(hx + 1, hy, I.Gf(c.cast.lead.skin, 0)); img.px(hx + 2, hy, I.Gf(c.cast.lead.skin, 0)); }
    } },
    // the stalk: down low and slow toward the grazing game, freezing when it lifts its head; it stays or it bolts
    creep: { dur: 9, beats: [0.4, 3.4, 6.6], draw(img, I, c, t) {
      const gx = c.cx + 40;
      const up = (t > 3.2 && t < 4.6) || (!c.good && t > 6);
      const gone = !c.good && t > 6.6;
      if (c.game === "whitestag") aura(img, I, gx, t, gone ? 1 - seg(t, 6.6, 8) : 1);
      if (gone) { const k = seg(t, 6.6, 8.4); drawBeast(img, I, c.game, "bolt", walkK(t, 8) & 1, gx + k * 120, { lift: HA.BIRDS.has(c.game) ? R(k * 30) : R(Math.abs(Math.sin(t * 9)) * 2) }); }
      else if (up) drawBeast(img, I, c.game, "alert", walkK(t, 2.5) & 1, gx + 3);
      else idleBeast(img, I, c.game, t, gx, 0);
      const moving = !(t > 3.2 && t < 4.6) && t > 0.4 && t < 6.4;
      const x = c.cx - 64 + clamp(t - 0.4, 0, 3.2) * 9 + clamp(t - 4.6, 0, 1.8) * 9;
      mates(img, I, c, t, Math.min(x, c.cx - 30), moving ? "creep" : "kneel");
      drawFig(img, I, c.cast.lead, x, { mode: moving ? "creep" : "kneel", dip: moving && walkK(t, 3) % 2 ? 1 : 0 });
      if (gone && t < 7.6) bubble(img, I, R(gx), I.feet - 30, "!");
      if (gone) farOff(img, I, c, t, 7.4);
    } },
    // a blind: the hunter crouched behind a screen of boughs (reeds, snowy pine, a cairn of red stone), the game coming on in its own time
    blind: { dur: 9, beats: [0.4, 3.6, 6.8], draw(img, I, c, t) {
      const bx = c.cx - 8, hx = bx - 6;
      const w = walkTo(t, 0, 1.6, c.cx - 64, hx);
      const k = seg(t, 2.2, 5.6), gx = c.cx + 90 - k * 48;
      if (!c.good && t > 6.4) { const q = seg(t, 6.4, 8.4); drawBeast(img, I, c.game, "bolt", walkK(t, 8) & 1, gx + q * 110, { face: 1, lift: HA.BIRDS.has(c.game) ? R(q * 26) : 0 }); farOff(img, I, c, t, 7.4); }
      else if (k < 1) drawBeast(img, I, c.game, "walk", walkK(t, 7), gx, { face: -1 });
      else if (t > 6 && t < 6.8) drawBeast(img, I, c.game, "alert", 0, gx, { face: -1 });
      else drawBeast(img, I, c.game, "graze", Math.floor(t * 2.2) & 1, gx, { face: -1 });
      mates(img, I, c, t, Math.min(w.x, hx - 4), w.moving ? "walk" : "kneel");
      drawFig(img, I, c.cast.lead, w.x, { mode: w.moving ? "walk" : "kneel", k: walkK(t) });
      gridAt(img, I, HA.prop("blind", { biome: c.biome }), bx + 4, I.feet + 3);
    } },
    // a ford: wading the stream, the water to the knees; a slip sits them down in it
    wade: { dur: 8, beats: [0.4, 3, 5.6], under(img, I, c, t) {
      // the stream comes down out of the trees and runs off toward us, widening, its banks dark and its ripples running downstream
      for (let y = I.roadTop - 3; y < I.h; y++) {
        const k = (y - I.roadTop + 3) / (I.h - I.roadTop + 3), mid = c.cx + 8 - k * 18 + Math.sin(y * 0.4) * 1.5, half = 6 + k * 18;
        for (let x = R(mid - half) - 1; x <= R(mid + half) + 1; x++) {
          const edge = x < mid - half || x > mid + half;
          const rip = (R(x * 0.5) + y * 2 - Math.floor(t * 8)) % 11 === 0 && !edge;
          img.px(x, y, edge ? I.G("#2a3a22", 0) : rip ? I.G("#d8ecf4", 0) : mix(I.G(k < 0.3 ? "#4a7a90" : "#3a6a84", 0), I.sky[1], 0.3));
        }
      }
    }, draw(img, I, c, t) {
      const w = walkTo(t, 0, 6.4, c.cx - 64, c.cx + 50), inW = Math.abs(w.x - c.cx) < 24;
      const slip = !c.good && t > 3.2 && t < 5.6;
      mates(img, I, c, t, Math.min(w.x, c.cx - 30), w.x < c.cx - 30 ? "walk" : "stand");
      drawFig(img, I, c.cast.lead, slip ? c.cx - 4 : w.x, { mode: slip ? "kneel" : "walk", k: walkK(t, 4), dip: slip ? 3 : inW ? 2 : 0 });
      if (inW || slip) { const xx = R(slip ? c.cx - 4 : w.x); for (let i = -7; i <= 7; i++) for (let j = 0; j < 3; j++) img.px(xx + i, I.feet - j - (slip ? 4 : 2), I.G(j === 0 && (i + walkK(t, 8)) % 3 === 0 ? "#e8f4fa" : "#4a7a98", 0), 0.85); }
      if (slip && t > 3.5 && t < 4.4) for (let k = 0; k < 6; k++) img.px(R(c.cx - 4 + Math.cos(k) * (4 + (t - 3.5) * 10)), R(I.feet - 8 - Math.sin(k) * 3 - (t - 3.5) * 6), "#e8f4fa");
    } },
    // a snare: kneel at the run, bend the sapling, set the loop and peg it; later a hare hops in (or hops round it)
    snare: { dur: 9, beats: [0.4, 3.2, 6.6], draw(img, I, c, t) {
      const sx = c.cx + 10;
      const set = seg(t, 1.8, 3.6), pull = c.good && t > 6.6;
      img.line(sx, I.feet + 2, sx, I.feet - 3, I.G("#6a4a2a", 0));
      if (set > 0) { const r = R(1 + set * 2); for (let a = 0; a < 12; a++) img.px(R(sx + 4 + Math.cos(a / 12 * Math.PI * 2) * r * 0.6), R(I.feet - 2 - r + Math.sin(a / 12 * Math.PI * 2) * r * (pull ? 0.6 : 1)), I.G("#b8c0c8", 0)); img.line(sx, I.feet - 3, sx + 4, I.feet - 2 - r * 2, I.G("#b8c0c8", 0)); }
      const prey = c.named && !HA.BIRDS.has(c.named) && c.named !== "whitestag" ? c.named : c.biome === "snow" ? "snowhare" : "hare";
      if (t > 4.6) {
        const k = seg(t, 4.6, 6.6);
        if (pull) drawBeast(img, I, prey, t < 7.4 ? "bolt" : "down", walkK(t, 9) & 1, sx + 4, { face: -1 });
        else if (c.good) drawBeast(img, I, prey, k < 1 ? "walk" : "stand", walkK(t, 5) & 1, c.cx + 80 - k * 66, { face: -1 });
        else drawBeast(img, I, prey, "bolt", walkK(t, 6) & 1, c.cx + 80 - seg(t, 4.6, 8.2) * 150, { face: -1, lift: R(Math.abs(Math.sin(t * 7)) * 4) });
      }
      const w = t < 1.8 ? walkTo(t, 0, 1.6, c.cx - 64, sx - 10) : t > 3.8 ? walkTo(t, 3.8, 4.8, sx - 10, c.cx - 40) : { x: sx - 10, moving: false };
      const mode = t >= 1.6 && t < 3.8 ? "kneel" : w.moving ? "walk" : "kneel";
      mates(img, I, c, t, Math.min(w.x, c.cx - 44), "stand");
      drawFig(img, I, c.cast.lead, w.x, { mode, k: walkK(t), dip: t > 1.8 && t < 3.6 && Math.sin(t * 5) > 0 ? 1 : 0, face: t > 3.8 && t < 4.8 ? -1 : 1 });
      if (pull && t < 7.6) bubble(img, I, R(c.cx - 40), I.feet - 40, "!");
    } },
    // the shot, with the hero's own weapon: readied, held, loosed (or the blade's rush in); a kill drops the game, a miss sends it off,
    // a spared animal sees the weapon lowered and walks away, and the white stag is simply not there when the shot arrives
    shot: { dur: 8.5, beats: [0.4, 2.8, 4.6], draw(img, I, c, t) {
      const hx = c.cx - 30, gx = c.cx + 44, bird = HA.BIRDS.has(c.game) || c.perch, wpn = c.weapon, melee = wpn === "blade" && !c.perch;
      if (c.perch) return treeShot(img, I, c, t, hx, gx);
      const w = walkTo(t, 0, 1.4, c.cx - 66, hx);
      const draw = seg(t, 1.8, 3.2), loose = 4.2, fly = seg(t, loose, loose + 0.35), out = c.outcome;
      const spare = out === "spare", kill = out === "kill";
      if (c.game === "whitestag") aura(img, I, gx, t, out === "vanish" ? 1 - seg(t, loose + 0.2, loose + 1) : 1);
      // the game: going about its business, then alert as the weapon comes up; then down, gone, faded or wandering off
      if (spare) {
        if (t < 5.2) drawBeast(img, I, c.game, t > 3 ? "alert" : "graze", t > 3 ? walkK(t, 2.5) & 1 : Math.floor(t * 2.2) & 1, gx);
        else { const k = seg(t, 5.2, 8.5); drawBeast(img, I, c.game, "walk", walkK(t, 6), gx + k * 60); }
      } else if (melee) {
        const hit = loose + 0.7;
        if (t < hit) drawBeast(img, I, c.game, t > loose ? "alert" : idle(t, 0).pose === "walk" ? "graze" : idle(t, 0).pose, idle(t, 0).f, gx);
        else if (kill) drawBeast(img, I, c.game, "down", 0, gx + 4);
        else { const k = seg(t, loose + 0.2, loose + 2.2); drawBeast(img, I, c.game, bird ? "fly" : "bolt", walkK(t, 8) & 1, gx + k * 130, { lift: bird ? R(k * 34) : R(Math.abs(Math.sin(t * 9)) * 2) }); }
      } else if (t < loose + 0.35) {
        const s = idle(t, 0);
        if (t > 3.4) drawBeast(img, I, c.game, "alert", walkK(t, 2.5) & 1, gx);
        else drawBeast(img, I, c.game, s.pose === "walk" ? "graze" : s.pose, s.f, gx);
      } else if (out === "vanish") drawBeast(img, I, c.game, "alert", 0, gx, { alpha: 1 - seg(t, loose + 0.1, loose + 0.9) });
      else if (kill) {
        const k = seg(t, loose + 0.35, loose + 0.9);
        drawBeast(img, I, c.game, k < 1 ? (bird ? "fly" : "bolt") : "down", 0, gx + k * 6, { lift: bird ? R(Math.sin(k * Math.PI) * 6) : 0 });
      } else { const k = seg(t, loose + 0.3, loose + 2.4); drawBeast(img, I, c.game, bird ? "fly" : "bolt", walkK(t, 8) & 1, gx + k * 130, { lift: bird ? R(k * 34) : R(Math.abs(Math.sin(t * 9)) * 2) }); }
      if (!spare && !kill && out !== "vanish") farOff(img, I, c, t, melee ? loose + 1.2 : loose + 1.3);
      mates(img, I, c, t, Math.min(w.x, hx - 4), w.moving ? "walk" : "kneel");
      // the hunter: in, the weapon up, then after a kill over to the game
      const after = t > loose + 1.4 && kill;
      if (melee && !spare) {
        const run = walkTo(t, loose, loose + 0.7, hx, gx - 16), v = after ? { x: gx - 16, moving: false } : t > loose ? run : w;
        drawFig(img, I, c.cast.lead, v.x, { mode: v.moving || w.moving ? "walk" : t > 1.4 && t < loose ? "creep" : "stand", k: walkK(t, v.moving ? 12 : 6), dip: t > loose + 0.7 && t < loose + 1.1 ? 2 : 0 });
        if (t > loose + 0.7 && t < loose + 1) for (let k = 0; k < 5; k++) img.px(R(gx - 8 + k), R(I.feet - 22 + k * 2), "#f4f8ff", 0.8);
        return;
      }
      const v = after ? walkTo(t, loose + 1.6, loose + 3.4, hx, gx - (HA.SMALL.has(c.game) ? 20 : 16)) : w;
      const aiming = t > 1.4 && (spare ? t < 5.4 : t < loose + 1.4);
      const armed = wpn === "crossbow" || wpn === "staff";
      drawFig(img, I, c.cast.lead, v.x, { mode: v.moving ? "walk" : aiming ? (armed ? "stand" : "aim") : "stand", k: walkK(t) });
      if (aiming) {
        const held = spare ? t < 4.6 : t < loose;
        const [bx, by] = ready(img, I, c, v.x, held ? draw : 0, t, held);
        if (!spare && t >= loose && fly < 1) missile(img, I, c, lerp(bx + 6, gx - 2 + (out === "miss" ? 8 : 0), fly), by - Math.sin(fly * Math.PI) * (wpn === "spear" || wpn === "sling" ? 7 : 3) + fly * (kill ? 6 : 2), 1);
        if (!spare && t >= loose && fly >= 1 && out === "miss" && (wpn === "bow" || wpn === "crossbow" || wpn === "spear")) missile(img, I, c, gx + 14, I.feet + 1, 1);
      }
    } },
    // the quarry bolts: heads up all at once, and the game is gone over the rise (birds go up with a roar of wings)
    bolt: { dur: 7.5, beats: [0.4, 2.8, 4.4], draw(img, I, c, t) {
      const bird = HA.BIRDS.has(c.game), n = bird ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const gx = c.cx + 26 + i * (bird ? 9 : 24), k = seg(t, 3 + i * 0.15, 5.4 + i * 0.15);
        if (t < 2.2) idleBeast(img, I, c.game, t, gx, i);
        else if (t < 3) drawBeast(img, I, c.game, "alert", 0, gx);
        else drawBeast(img, I, c.game, bird ? "fly" : "bolt", walkK(t + i, 8) & 1, gx + k * 140, { lift: bird ? R(k * (30 + i * 8) + Math.sin(t * 12 + i) * 1) : R(Math.abs(Math.sin(t * 9 + i)) * 2) });
      }
      farOff(img, I, c, t, 4.4);
      const x = c.cx - 64 + clamp(t - 0.3, 0, 2) * 12;
      mates(img, I, c, t, Math.min(x, c.cx - 46), t < 2.3 ? "creep" : "kneel");
      drawFig(img, I, c.cast.lead, x, { mode: t < 2.3 ? "creep" : t < 3.6 ? "kneel" : "free", dip: t < 2.3 && walkK(t, 3) % 2 ? 1 : 0 });
      if (t > 3.1 && t < 4.4) bubble(img, I, R(c.cx + 30), I.feet - 32, "!");
    } },
    // watching: the crew down on their heels while the game goes about its business (and wanders off, or is warned off by a bird)
    watch: { dur: 8.5, beats: [0.4, 3, 5.8], draw(img, I, c, t) {
      const gx = c.cx + 40, warned = !c.good;
      if (c.game === "whitestag") aura(img, I, gx, t);
      // an unnamed quarry that is already gone leaves the clearing empty, not a stand-in animal to watch
      if ((!c.bird || c.named) && (c.named || c.good)) {
        if (warned && t > 5.4) { const k = seg(t, 5.4, 7.6); drawBeast(img, I, c.game, HA.BIRDS.has(c.game) ? "fly" : "bolt", walkK(t, 8) & 1, gx + k * 130, { lift: HA.BIRDS.has(c.game) ? R(k * 30) : R(Math.abs(Math.sin(t * 9)) * 2) }); }
        else if (warned && t > 4.6) drawBeast(img, I, c.game, "alert", 0, gx + 3);
        else idleBeast(img, I, c.game, t, gx, 0);
        if (warned) farOff(img, I, c, t, 6.4);
      }
      perched(img, I, c, t);
      const w = walkTo(t, 0, 1.6, c.cx - 64, c.cx - 22);
      mates(img, I, c, t, w.x, w.moving ? "walk" : "kneel");
      drawFig(img, I, c.cast.lead, w.x, { mode: w.moving ? "walk" : "kneel", k: walkK(t), dip: !w.moving && Math.sin(t * 1.3) > 0.85 ? 1 : 0 });
    } },
    // a glimpse: something in the ferns ahead, antlers or a back showing over them, the crew frozen and pointing; then it is gone
    glimpse: { dur: 8, beats: [0.4, 2.8, 5.4], draw(img, I, c, t) {
      const gx = c.cx + 44, g = HA.beast(c.game, Math.sin(t * 0.8) > 0.3 ? "alert" : "stand", 0);
      const fade = 1 - seg(t, 5.2, 6.4);
      if (g && fade > 0) {
        if (c.game === "whitestag") aura(img, I, gx, t, fade);
        // only what shows over the screen of leaf: the beast sunk behind it
        const sink = (HA.SMALL.has(c.game) ? 2 : c.game === "boar" || c.game === "goat" || c.game === "ibex" ? 6 : 3) + R(Math.sin(t * 1.1) * 1);
        drawBeast(img, I, c.game, Math.sin(t * 0.8) > 0.3 ? "alert" : "stand", 0, gx + seg(t, 5.2, 6.4) * 10, { sink, alpha: fade });
      }
      gridAt(img, I, HA.prop("blind", { biome: c.biome }), gx - 6, I.feet + 3);
      gridAt(img, I, HA.prop("blind", { biome: c.biome }), gx + 12, I.feet + 4);
      const w = walkTo(t, 0, 1.6, c.cx - 64, c.cx - 26);
      mates(img, I, c, t, w.x, w.moving ? "walk" : "kneel");
      drawFig(img, I, c.cast.lead, w.x, { mode: w.moving ? "walk" : t < 5.6 ? "free" : "stand", k: walkK(t) });
      if (!w.moving && t < 5.6) { const hx = R(w.x + 7); for (let k = 0; k < 4; k++) img.px(hx + k, I.feet - 22 - k, I.Gf(c.cast.lead.skin, 0)); }
      if (t > 1.8 && t < 3) bubble(img, I, R(w.x), I.feet - 40, "!");
    } },
    // found: the animal already down where age or the winter left it; the hunter kneels beside it a while
    found: { dur: 8, beats: [0.4, 3, 5.6], draw(img, I, c, t) {
      const gx = c.cx + 26;
      drawBeast(img, I, c.game, "down", 0, gx);
      const w = walkTo(t, 0, 2.4, c.cx - 64, gx - 18);
      mates(img, I, c, t, Math.min(w.x, gx - 30), w.moving ? "walk" : "stand");
      drawFig(img, I, c.cast.lead, w.x, { mode: w.moving ? "walk" : "kneel", k: walkK(t), dip: !w.moving && t > 4 && t < 6 ? 1 : 0 });
    } },
    // foraging: knelt at the patch (herbs, mushrooms by a log, a bramble, a nest in the grass, moss on a boulder, roots dug up,
    // a bed of greens, a hazel, the shore rocks, a wild hive), picking into the basket
    forage: { dur: 8, beats: [0.4, 2.8, 5.4], draw(img, I, c, t) {
      const px = c.cx + 12, picked = c.leaves ? 0 : Math.floor(seg(t, 2, 5.4) * 4);
      const kind = c.kind;
      if (kind === "mushrooms") { gridAt(img, I, HA.prop("log"), px + 24, I.feet - 1); gridAt(img, I, HA.prop("mushrooms", { red: c.biome === "forest" && hash(c.line) % 3 === 0, n: 4 - picked }), px + 6, I.feet + 3); }
      else if (kind === "berries") gridAt(img, I, HA.prop("berries", { red: c.biome !== "forest" || /\b(haws|rose ?hips?|rowan)\b/i.test(c.line) }), px + 10, I.feet + 2);
      else if (kind === "nest") gridAt(img, I, HA.prop("nest", { n: 3 - Math.min(3, picked) }), px + 6, I.feet + 3);
      else if (kind === "honey") { gridAt(img, I, HA.prop("hive"), px + 16, I.feet + 1); for (let k = 0; k < 6; k++) img.px(R(px + 16 + Math.sin(t * 4 + k * 2) * (5 + k)), R(I.feet - 18 + Math.cos(t * 5 + k) * 4), "#2a2014"); }
      else if (kind === "shore") { for (const [dx, r] of [[0, 4], [9, 5], [17, 3]]) for (let j = -r; j <= 0; j++) for (let i = -r - 1; i <= r + 1; i++) if ((i / (r + 1)) ** 2 + (j / r) ** 2 <= 1) img.px(px + dx + i, I.feet + 3 + j, I.G(j === -r ? "#a8a49a" : i > r * 0.4 ? "#4e4a44" : "#6e6a62", 0)); for (const [dx, dy] of [[2, -2], [8, -3], [10, -2]]) if (picked < 3) { img.px(px + dx, I.feet + 3 + dy, I.G("#2a2a3a", 0)); img.px(px + dx + 1, I.feet + 3 + dy, I.G("#3a3a52", 0)); } if (picked < 2) drawBeast(img, I, "crab", "walk", walkK(t, 3) & 1, px + 24 + Math.sin(t) * 3); }
      else if (kind === "moss") gridAt(img, I, HA.prop("moss", { biome: c.biome }), px + 8, I.feet + 3);
      else if (kind === "roots") gridAt(img, I, HA.prop("roots", { biome: c.biome }), px + 8, I.feet + 4);
      else if (kind === "greens") gridAt(img, I, HA.prop("greens", { flower: /\b(ramsons|garlic)\b/i.test(c.line) }), px + 8, I.feet + 3);
      else if (kind === "nuts") gridAt(img, I, HA.prop("nuts"), px + 12, I.feet + 2);
      else if (kind === "ferns") { gridAt(img, I, HA.prop("ferns"), px + 10, I.feet + 3); if (picked < 3) gridAt(img, I, HA.prop("ferns"), px + 26, I.feet + 1, { flip: true }); }
      else if (kind === "samphire") { gridAt(img, I, HA.prop("samphire"), px + 10, I.feet + 3); gridAt(img, I, HA.prop("samphire"), px + 30, I.feet + 1, { flip: true }); }
      else if (kind === "flowers") gridAt(img, I, HA.prop("flowers", { pale: /moonpetal|moon/i.test(c.line) }), px + 8, I.feet + 3);
      else if (kind === "apples") { gridAt(img, I, HA.prop("apples", { n: 6 - Math.min(5, picked * 2) }), px + 16, I.feet + 2); for (let k = 0; k < 3; k++) { const q = seg(t, 2.2 + k * 0.9, 2.7 + k * 0.9); if (q > 0 && q < 1) img.px(R(px + 8 + k * 7), R(I.feet - 20 + q * 20), I.G("#c8a838", 0)); } }
      else if (kind === "pool") { gridAt(img, I, HA.prop("pool"), px + 12, I.feet + 6); if (t > 3) drawBeast(img, I, "fish", t < 4.6 ? "walk" : "down", walkK(t, 9) & 1, px + 2 + seg(t, 3, 3.6) * -8, { lift: t < 3.6 ? R(Math.sin(seg(t, 3, 3.6) * Math.PI) * 10) : 0 }); }
      else gridAt(img, I, HA.prop("herbs", { red: kind === "pepper" }), px + 6, I.feet + 2);
      const w = walkTo(t, 0, 1.8, c.cx - 64, c.leaves ? px - 30 : px - 12);
      // a nest left alone: the hen comes back to it once the hero has stepped off
      if (c.leaves && kind === "nest" && t > 3.4) drawBeast(img, I, "pheasant", t < 6 ? "walk" : "down", walkK(t, 6) & 1, px + 6 + (1 - seg(t, 3.4, 6)) * 46);
      // what it goes into: the basket a line names, a sack, a kerchief spread on the ground, or only the hands
      const L = c.line.toLowerCase(), pick = hash(c.line) % 4;
      const box = c.leaves ? null : /\bbasket\b/.test(L) ? "basket" : /\b(sack|bag)\b/.test(L) ? "sack" : /\b(pocket|hat|hatful|handful|fistful)\b/.test(L) ? null : kind === "pool" || kind === "honey" ? null : ["kerchief", "sack", null, "basket"][pick];
      const fill = { mushrooms: "#b07a3e", berries: c.biome === "forest" ? "#2e1838" : "#c8302a", nest: "#e8e0c8", honey: "#e8b040", shore: "#2a2a3a", herbs: "#5e9a3a", pepper: "#d8402a", moss: "#7a9a48", roots: "#d8c49a", greens: "#4e8a34", nuts: "#a8743a", ferns: "#8ab048", samphire: "#6ab840", flowers: "#e8e0c0", apples: "#c8a838", pool: "#9aa08a" }[kind];
      if (box === "basket") { gridAt(img, I, HA.prop("basket"), px - 34, I.feet + 3); for (let i = 0; i < picked * 3; i++) img.px(px - 39 + (i * 3) % 10, I.feet - 5 - (i % 2), I.G(fill, 0)); }
      else if (box === "sack") gridAt(img, I, HA.prop("sack"), px - 34, I.feet + 3);
      else if (box === "kerchief") { gridAt(img, I, HA.prop("kerchief"), px - 32, I.feet + 4); for (let i = 0; i < picked * 3; i++) img.px(px - 40 + (i * 4) % 14, I.feet + 1 - (i % 2), I.G(fill, 0)); }
      mates(img, I, c, t, Math.min(w.x - 14, c.cx - 30), w.moving ? "walk" : "stand");
      const lift = !c.leaves && t > 2 && t < 5.4 && Math.sin(t * 4.2) > 0.2;
      drawFig(img, I, c.cast.lead, w.x, { mode: w.moving ? "walk" : c.leaves || t > 5.6 ? "free" : "kneel", k: walkK(t), dip: lift ? 1 : 0 });
      if (lift) { img.px(R(w.x + 7), I.feet - 4, I.Gf(c.cast.lead.skin, 0)); img.px(R(w.x + 8), I.feet - 5, I.G(fill, 0)); }
      if (kind === "honey" && !c.good && t > 4) bubble(img, I, R(w.x), I.feet - 40, "!");
    } },
    // dressing the kill: the carcass laid out when the line names the animal (a joint on a stone when it doesn't), the knife at work
    // (its glint), the hide coming away and stretched on its frame; a skull or a rack set to dry for a trophy
    dress: { dur: 8, beats: [0.4, 3, 5.6], draw(img, I, c, t) {
      const kx = c.cx + 6, skin = seg(t, 2.6, 5.6);
      const beast = c.named && c.game !== "whitestag";
      if (c.hide || beast) {
        gridAt(img, I, HA.prop("frame"), c.cx + 44, I.feet + 1);
        const pk = c.game === "snowhare" || c.game === "ptarmigan" ? "white" : c.game === "goat" || c.game === "ibex" || c.game === "boar" ? "grey" : "brown";
        if (skin > 0.5) gridAt(img, I, HA.prop("pelt", { kind: pk }), c.cx + 44, I.feet - 7, { alpha: clamp((skin - 0.5) * 3, 0, 1) });
      }
      const foe = !beast && c.foes.length ? foeGrid(c.foes[0], 0) : null;
      if (c.skull) gridAt(img, I, HA.prop("skull", { antlers: /\b(stag|rack|antler)/i.test(c.line) || c.game === "stag", tusk: c.game === "boar" }), kx + 2, I.feet + 3);
      else if (beast) drawBeast(img, I, c.game, "down", 0, kx);
      else if (foe) gridAt(img, I, HA.lay(foe), kx + 4, I.feet + 2, { flip: true });
      else {
        gridAt(img, I, HA.prop("stone", { biome: c.biome }), kx, I.feet + 3);
        const j = root.Stage ? root.Stage.prop("haunch") : null;
        if (j) { gridAt(img, I, j, kx - 4, I.feet - 1); if (skin < 0.6) gridAt(img, I, j, kx + 5, I.feet - 1, { flip: true }); }
      }
      if (c.biome !== "snow") fire(img, I, c.cx - 46, t, false);
      const w = walkTo(t, 0, 1.6, c.cx - 64, kx - 14);
      mates(img, I, c, t, Math.min(w.x, c.cx - 50), "stand");
      const work = t > 1.8 && t < 6;
      drawFig(img, I, c.cast.lead, w.x, { mode: w.moving ? "walk" : work ? "kneel" : "free", k: walkK(t), dip: work && Math.sin(t * 6) > 0.4 ? 1 : 0 });
      if (work && Math.sin(t * 6) > 0.4) { img.px(R(w.x + 8), I.feet - 6, "#f4f8ff"); img.px(R(w.x + 9), I.feet - 7, "#c8d0dc"); }
      glow(img, I, c.cx - 46, 1);
    } },
    // the roast: the fire, the spit across it with the joint turning, the crew sat round; the dish the line names comes off at the end
    roast: { dur: 8.5, beats: [0.4, 3, 6], draw(img, I, c, t) {
      const fx = c.cx + 4;
      glow(img, I, fx, 1);
      gridAt(img, I, HA.prop("spit"), fx, I.feet + 2);
      fire(img, I, fx, t, true);
      const joint = root.Stage ? root.Stage.prop(c.dish && c.dish.prop === "skewer" ? "skewer" : c.dish && (c.dish.prop === "bowl" || c.dish.prop === "pot") ? "pot" : "haunch") : null;
      const pot = c.dish && (c.dish.prop === "bowl" || c.dish.prop === "pot");
      if (joint && t < 6.2) {
        const flip = Math.floor(t * 1.2) % 2 === 1;
        if (pot) { gridAt(img, I, joint, fx, I.feet - 4); for (let k = 0; k < 3; k++) { const ph = (t * 0.7 + k / 3) % 1; img.px(fx - 2 + k * 2 + Math.sin(ph * 6), I.feet - 9 - ph * 8, "#f4f4f4", (1 - ph) * 0.7); } }
        else gridAt(img, I, joint, fx, I.feet - 12 + (joint.h > 4 ? 3 : 0), { flip });
      }
      mates(img, I, c, t, fx - 22, "kneel");
      const x = fx + 20;
      drawFig(img, I, c.cast.lead, x, { mode: t > 6 ? "free" : "kneel", face: -1, dip: t < 6 && Math.sin(t * 2.4) > 0.8 ? 1 : 0 });
      if (t > 6.2 && root.Stage) { const g = root.Stage.prop(c.dish ? c.dish.prop : "haunch"); gridAt(img, I, g, x - 8, I.feet - 13); if (Math.sin(t * 5) > 0) img.px(x - 8, I.feet - 15 - g.h, "#f4f4f4", 0.6); }
      if (c.cast.pet) petAt(img, I, c.cast.pet, fx + 36, t, true);
    } },
    // making camp: the lean-to up, the fire lit, the crew sat round it as the light goes, an owl on the branch
    camp: { dur: 8, beats: [0.4, 3, 5.6], draw(img, I, c, t) {
      const fx = c.cx + 2, lit = seg(t, 1.4, 2.4);
      gridAt(img, I, HA.prop("leanto", { biome: c.biome }), c.cx - 56, I.feet + 1);
      glow(img, I, fx, lit);
      if (lit > 0) fire(img, I, fx, t, lit > 0.6); else { img.line(fx - 5, I.feet + 1, fx + 4, I.feet, I.G("#4a3420", 0)); img.line(fx - 4, I.feet, fx + 5, I.feet + 1, I.G("#5a4028", 0)); }
      const w = walkTo(t, 0, 1.2, c.cx - 60, fx + 18);
      mates(img, I, c, t, fx - 6, t < 1.2 ? "walk" : "kneel");
      drawFig(img, I, c.cast.lead, w.x, { mode: w.moving ? "walk" : "kneel", face: w.moving ? 1 : -1, k: walkK(t), dip: t > 1.3 && t < 2.3 && Math.sin(t * 9) > 0 ? 1 : 0 });
      if (c.cast.pet) petAt(img, I, c.cast.pet, fx + 34, t, t > 2);
      // the first owl, on a bough reaching in from the side
      if (I.hr >= 16.5 && c.biome === "forest" && root.SceneKits) {
        const o = root.SceneKits.sprite("owl", Math.sin(t * 2) > 0.85 ? 1 : 0), ox = R(c.W * 0.86), oy = I.feet - 40;
        for (let x = ox - 6; x < c.W; x++) { img.px(x, oy + R((x - ox) * 0.12), I.Gf("#3a2a1e", 0)); img.px(x, oy + 1 + R((x - ox) * 0.12), I.Gf("#2a1e14", 0)); }
        if (o) blit(img, o, ox - 5, oy - o.h + 1, { G: I.Gf });
      }
    } },
    // walking the wilds: the band picks its way along, looking about
    walk: { dur: 7, beats: [0.4, 2.6, 4.8], draw(img, I, c, t) {
      const x = c.cx - 64 + t * 18;
      if (c.game === "heron") drawBeast(img, I, "heron", "stand", Math.sin(t * 0.7) > 0.95 ? 1 : 0, c.cx + 46);
      if (c.named && !HA.SMALL.has(c.game) && c.game !== "whitestag") {
        const blink = /\b(gone|blinks?|vanish\w*|not there)\b/.test(c.line.toLowerCase()), a = blink ? 1 - seg(t, 4.4, 4.7) : 1, sx = c.cx + 38;
        distant(img, I, c, sx, t, a);
        // a scatter of loosened snow (or scree) where it stood
        if (blink && t > 4.4) for (let k = 0; k < 7; k++) { const q = seg(t, 4.4, 5.6); img.px(R(sx - 4 + k * 1.4 + Math.sin(k * 3) * q * 3), R(I.roadTop - 6 + q * q * 7 + (k % 3)), c.biome === "snow" ? "#f4f8ff" : "#b08a6a", 1 - q * 0.6); }
      }
      if (HA.SMALL.has(c.game) && !HA.BIRDS.has(c.game)) { if (t < 3.6) idleBeast(img, I, c.game, t, c.cx + 50, 0); else drawBeast(img, I, c.game, "bolt", walkK(t, 8) & 1, c.cx + 50 + (t - 3.6) * 60); }
      perched(img, I, c, t);
      mates(img, I, c, t, x, "walk");
      drawFig(img, I, c.cast.lead, x, { mode: "walk", k: walkK(t, 5) });
      if (c.cast.pet) petAt(img, I, c.cast.pet, x + 14, t, false, true);
    } },
    // falling back after a lost fight: the hurt hunter limps out the way they came, a friend's shoulder under their arm
    retreat: { dur: 7, beats: [0.4, 2.8, 4.8], draw(img, I, c, t) {
      const x = c.cx + 50 - t * 11;
      c.cast.mates.forEach((m, i) => drawFig(img, I, m, x - 9 - i * 14, { mode: "walk", k: walkK(t, 3) + i, face: -1, back: 2 + i * 2 }));
      drawFig(img, I, c.cast.lead, x, { mode: "limp", k: walkK(t, 2.4), face: -1 });
      for (let k = 0; k < 3; k++) if ((t * 2 + k) % 3 < 0.2) img.px(R(x + 4 + k * 9), I.feet + 2, "#8a2a1e");
    } },
    // the quarry turns: the band stops, the brush ahead shakes, eyes in the dark of it, weapons out (the fight's own replay follows)
    ambush: { dur: 7, beats: [0.4, 2.4, 4.4], draw(img, I, c, t) {
      const bx = c.cx + 70, shake = t > 1.2 && t < 2.6 ? R(Math.sin(t * 22) * 1.5) : 0;
      let foes = c.foes.length ? c.foes : [];
      if (!foes.length) { const id = DEFAULT_FOE[c.biome] || "wolf", m = (S().monsters || {})[id]; if (m) foes = [Object.assign({ id }, m)]; }
      // back to front, so the nearest foe stands over the others; each steps out of the brush in turn and comes on a few paces
      const spots = [[c.cx + 18, 0], [c.cx + 37, 3], [c.cx + 54, 5]];
      for (let i = foes.length - 1; i >= 0; i--) {
        const [tx, back] = spots[i], k = ease(seg(t, 1.6 + i * 0.35, 2.8 + i * 0.35)), step = t > 4.4 ? R(seg(t, 4.4, 5) * 3) : 0;
        const g = foeGrid(foes[i], k > 0 && k < 1 ? walkK(t, 6) & 1 : Math.sin(t * 2 + i) > 0.6 ? 1 : 0);
        if (!g || k <= 0) continue;
        const x = lerp(bx + 8, tx, k) - step, fly = foes[i].body === "wisp" || foes[i].body === "candle" ? 14 + R(Math.sin(t * 2.2 + i) * 2) : 0;
        if (fly) {
          const cy = I.feet - fly - g.h / 2 - back;
          const pulse = 0.85 + Math.sin(t * 3.1 + i) * 0.15;
          for (let yy = -17; yy <= 17; yy++) for (let xx = -17; xx <= 17; xx++) { const d = Math.hypot(xx, yy) / 17; if (d < 1) img.px(R(x + xx), R(cy + yy), "#8ad0ff", (1 - d) ** 2.2 * 0.6 * pulse * Math.min(1, k * 2)); }
          // its light on the ground below, and the motes it sheds drifting up
          for (let j = -6; j <= 6; j++) img.px(R(x) + j, I.feet + 1 - back, "#8ad0ff", 0.3 * k * (1 - Math.abs(j) / 7));
          for (let m = 0; m < 4; m++) { const q = (t * 0.6 + m / 4) % 1; img.px(R(x - 6 + m * 4 + Math.sin(q * 7 + m) * 2), R(cy + 6 - q * 18), "#dff4ff", (1 - q) * k); }
        } else for (let j = -R(g.w * 0.35); j <= R(g.w * 0.35); j++) img.px(R(x) + j, I.feet + 1 - back, "#140c06", 0.2);
        blit(img, g, R(x - g.w / 2), I.feet - g.h + 1 - back - fly, { G: fly ? null : I.Gf, flip: true, alpha: Math.min(1, k * 3) });
      }
      gridAt(img, I, HA.prop("blind", { biome: c.biome }), bx + shake, I.feet + 2);
      if (t > 0.8 && t < 1.8 && Math.sin(t * 3) < 0.9) for (const [dx, dy] of [[-4, -9], [-1, -9]]) img.px(bx + dx + shake, I.feet + dy, "#ffd040");
      const x = c.cx - 64 + clamp(t, 0, 1.6) * 28;
      mates(img, I, c, t, x, t < 1.6 ? "walk" : "stand");
      drawFig(img, I, c.cast.lead, x, { mode: t < 1.6 ? "walk" : "stand", k: walkK(t), dip: t > 2.4 && t < 2.8 ? 1 : 0 });
      if (t > 2 && t < 3.4) bubble(img, I, R(x), I.feet - 40, "!");
    } },
  };
  const shrinkMemo = new Map();
  // a distant animal: the sprite at half size (every other pixel), for the far slope
  function shrink(g) {
    if (shrinkMemo.has(g)) return shrinkMemo.get(g);
    const o = new root.Art.Grid(Math.ceil(g.w / 2), Math.ceil(g.h / 2));
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.px[y * o.w + x] = g.px[(y * 2 + 1 < g.h ? y * 2 + 1 : y * 2) * g.w + x * 2] || g.px[y * 2 * g.w + x * 2] || null;
    shrinkMemo.set(g, o);
    return o;
  }
  function petAt(img, I, pet, x, t, still, walking) {
    let g = null;
    try { g = root.Art.petGrid(pet, walking ? walkK(t, 5) & 1 : still ? 0 : Math.sin(t * 2) > 0.7 ? 1 : 0); } catch (e) { g = null; }
    if (g) blit(img, g, R(x - g.w / 2), I.feet - g.h + 2, { G: I.Gf, flip: true });
  }

  // gulls wheeling over the cliff, screaming
  function gullsOver(img, I, c, t) {
    for (let k = 0; k < 3; k++) {
      const ph = t * 0.5 + k * 2.1, x = c.cx + Math.sin(ph) * (40 + k * 12), y = I.hz - 18 + Math.sin(ph * 1.7 + k) * 6 + k * 4;
      const g = HA.beast("gull", "fly", Math.floor(t * 4 + k) & 1);
      if (g) blit(img, g, R(x - g.w / 2), R(y), { flip: Math.cos(ph) < 0 });
    }
  }

  // ---------- the scene ----------
  function make(block, opts) {
    opts = opts || {};
    const a = actOf(block), w = opts.w || W, h = opts.h || H;
    const hr = block.hour != null ? block.hour : block.from != null ? Math.min(18.4, (block.from + Math.min(block.to || block.from + 1, block.from + 2)) / 2) : 12;
    const biome = HA.WILD[block.biome] ? block.biome : "plains";
    // a line in the mist is played in it: a clear or cloudy hour that says mist is drawn as fog
    const weather = a.mist && (!block.weather || block.weather === "clear" || block.weather === "cloudy") ? "fog" : block.weather;
    const set = HA.set({ biome, hour: hr, weather, seed: String(block.event || "") }, w, h);
    const cast = castOf(block, opts);
    const A = ACTS[a.act] || ACTS.walk;
    const ctx = Object.assign({}, a, { I: set.info, W: w, cx: R(w / 2), cast, biome, line: String(block.line || ""), weapon: weaponOf(cast.lead.h, a.weapon) });
    const caps = root.Stage && root.Stage.split ? root.Stage.split(block.line || "") : [block.line || ""];
    const dur = Math.max(A.dur, 2 + caps.length * 2.4);
    const k = A.dur / dur;
    // the captions land on the act's beats, stretched to the scene's length when the line runs long
    const last = A.beats[A.beats.length - 1] / k, more = Math.max(1, caps.length - A.beats.length);
    // the first caption is up from the first frame, so the bar under the stage is never an empty strip
    const beats = caps.map((txt, i) => ({ text: txt, t: i === 0 ? 0 : i < A.beats.length ? A.beats[i] / k : last + (i - A.beats.length + 1) * (dur - 1.4 - last) / more }));
    const scale = (t) => Math.min(A.dur, t * k);
    return {
      act: a.act, a, ctx, set, dur, caps: beats, loop: [0, A.dur],
      draw(img, t, still, raw) {
        const I = set.info, at = still ? A.dur * 0.62 : raw ? t : scale(t);
        for (const f of set.loops) if (f.under) f(img, t);
        if (A.under) A.under(img, I, ctx, at);
        // every hour spent reading sign has its trail on the ground, by the animal the line names (plain prints when it names none)
        if (a.trail && a.act !== "track") HA.prints(img, I, R(w * 0.42), w + 4, a.tracks, I.G);
        A.draw(img, I, ctx, at);
        if (a.gulls) gullsOver(img, I, ctx, at);
        I.front(img);
        for (const f of set.loops) if (!f.under) f(img, t);
      },
    };
  }
  function render(m, t, still, punch, raw) {
    const img = m.set.base.copy();
    m.draw(img, t, still, raw);
    const out = new Uint8ClampedArray(img.w * img.h * 4);
    for (let i = 0; i < img.w * img.h; i++) { out[i * 4] = img.d[i * 4]; out[i * 4 + 1] = img.d[i * 4 + 1]; out[i * 4 + 2] = img.d[i * 4 + 2]; out[i * 4 + 3] = 255; }
    return punch && K.punch ? K.punch(out, m.ctx.biome, m.set.info.weather) : out;
  }
  function frame(block, t, opts) {
    const m = make(block, opts), cv = document.createElement("canvas");
    cv.width = m.set.base.w; cv.height = m.set.base.h;
    const g = cv.getContext("2d"), im = g.createImageData(cv.width, cv.height);
    im.data.set(render(m, t, false, opts && opts.punch));
    g.putImageData(im, 0, 0);
    return cv;
  }

  // ---------- the player ----------
  function player(block, opts) {
    opts = opts || {};
    const m = make(block, opts), fig = document.createElement("figure"), cv = document.createElement("canvas");
    fig.className = "town-replay hunt-replay";
    cv.width = m.set.base.w; cv.height = m.set.base.h;
    cv.style.cssText = `image-rendering:pixelated;image-rendering:crisp-edges;display:block;cursor:pointer;${opts.scale ? `width:${cv.width * opts.scale}px;height:${cv.height * opts.scale}px` : "width:100%;height:auto"}`;
    cv.title = "Click to watch again";
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", block.line || "An hour's hunting");
    const cap = document.createElement("div");
    cap.className = "town-cap";
    cap.setAttribute("aria-live", "polite");
    fig.append(cv, cap);
    const g = cv.getContext("2d"), im = g.createImageData(cv.width, cv.height);
    let t = reduced() ? m.dur - 0.01 : 0, raf = 0, last = 0, onscreen = false, rate = 1, held = false, forced = false, shown = -1;
    const live = () => !held && fig.isConnected && onscreen && !document.hidden;
    function caption() {
      const caps = m.caps, i = reduced() && !forced ? caps.length - 1 : caps.reduce((k, c, j) => (c.t <= t ? j : k), -1);
      if (i === shown) return;
      shown = i;
      cap.textContent = "";
      if (i < 0) return;
      for (const c of reduced() && !forced ? caps : [caps[i]]) { const s = document.createElement("span"); s.textContent = c.text; if (/^Why:/.test(c.text)) s.className = "town-why"; cap.append(s, " "); }
      cap.classList.remove("in"); void cap.offsetWidth; cap.classList.add("in");
    }
    const draw = () => { im.data.set(render(m, t, reduced() && !forced)); g.putImageData(im, 0, 0); caption(); };
    function tick(ms) {
      raf = 0;
      if (!live()) { last = 0; return; }
      const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
      last = ms;
      t = Math.min(m.dur, t + dt * rate);
      draw();
      if (t < m.dur) raf = root.requestAnimationFrame(tick);
    }
    const wake = () => { if ((forced || !reduced()) && !raf && live() && t < m.dur) { last = 0; raf = root.requestAnimationFrame(tick); } };
    const restart = () => { held = false; t = 0; shown = -1; draw(); wake(); };
    cv.addEventListener("click", () => { forced = true; restart(); });
    const evening = m.act === "camp" || m.act === "roast" || m.act === "dress";
    const sound = (on) => { if (evening && root.Sound && root.Sound.scene) root.Sound.scene(on ? "camp" : null, fig); };
    if ("IntersectionObserver" in root) {
      const ob = new root.IntersectionObserver((es) => { onscreen = es[es.length - 1].isIntersecting; sound(onscreen && fig.isConnected); if (!fig.isConnected && t > 0) { ob.disconnect(); return; } wake(); });
      ob.observe(fig);
    } else onscreen = true;
    document.addEventListener("visibilitychange", wake);
    fig.replay = {
      get t() { return t; }, get dur() { return m.dur; }, get playing() { return !held && t < m.dur && (forced || !reduced()); },
      play() { held = false; forced = true; if (t >= m.dur) t = 0; wake(); },
      pause() { held = true; },
      restart() { forced = true; restart(); },
      skip() { t = m.dur; shown = -1; draw(); },
      rate(s) { rate = s; },
      seek(s) { t = Math.max(0, Math.min(m.dur, s)); shown = -1; draw(); },
    };
    draw();
    wake();
    return fig;
  }

  // ---------- the daybook strip: the act looping on the wild's ground ----------
  const live = new Set();
  let timer = 0;
  function pump() {
    timer = 0;
    const now = performance.now() / 1000;
    for (const s of live) { if (!s.wrap.isConnected) { live.delete(s); continue; } if (s.on && !document.hidden) s.draw(now); }
    if (live.size) timer = setTimeout(pump, 100);
  }
  function strip(block, opts) {
    opts = opts || {};
    const w = opts.w || 320, h = opts.h || 80;
    let m;
    try { m = make(block, Object.assign({}, opts, { w, h })); } catch (e) { if (root.console) console.error(e); return null; }
    const wrap = document.createElement("div"), cv = document.createElement("canvas");
    wrap.className = "road-strip hunt-strip";
    wrap.dataset.biome = m.ctx.biome;
    wrap.dataset.act = m.act;
    cv.width = w; cv.height = h;
    cv.setAttribute("aria-hidden", "true");
    wrap.appendChild(cv);
    const g = cv.getContext("2d"), im = g.createImageData(w, h), [l0, l1] = m.loop, span = l1 - l0 + 1.2;
    const s = { wrap, on: true, t0: performance.now() / 1000 - (hash(block.line || "") % 50) / 10, draw(now) {
      const t = reduced() ? l0 + (l1 - l0) * 0.62 : l0 + Math.min(l1 - l0, (((now - s.t0) % span) + span) % span);
      im.data.set(render(m, t, reduced(), true, true));
      g.putImageData(im, 0, 0);
    } };
    s.draw(performance.now() / 1000);
    if (!reduced()) {
      live.add(s);
      if ("IntersectionObserver" in root) { const ob = new IntersectionObserver((es) => { s.on = es[es.length - 1].isIntersecting; if (!wrap.isConnected) ob.disconnect(); }); ob.observe(wrap); }
      if (!timer) timer = setTimeout(pump, 100);
    }
    return wrap;
  }

  root.HuntScenes = { actOf, make, player, strip, frame, ACTS: Object.keys(ACTS), W, H };
})(typeof window !== "undefined" ? window : globalThis);
