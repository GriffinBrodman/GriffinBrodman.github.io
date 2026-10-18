/* Staging, shared by every scene that acts out a line of the world's text (the road replays now, town days next): who does what to whom, with which prop, where, and what they say, caption by caption. */
/*
  Stage.script(rec, ctx) -> { steps: [{ sub, set, act, a, b, prop, say, beh, wx, then }], set }
      rec: { line, outcome }   ctx: { heroes: [{ id, name }] (the lead first), trav: a RoadArt.spec or null (whoever the line is
      about), place: { name, kind, keeper }, pronoun: the traveller's pronoun, hints: { [outcome]: hint } (see hint()) }.
      A hand-written script (FINALE, ARC, or a scene's own SCRIPTS added with Stage.add) wins; else hints steer the line reader;
      else the line is read clause by clause: the first name in a clause does it, the next one has it done to them, the verb
      picks the act, the first thing named is the prop, an animal or cart named is put on stage with what it is doing (beh).
  Stage.split(line) -> the line cut into captions of up to three short lines each, never inside a quote.
  Stage.prop(name) -> a small pixel grid { w, h, px } of a held or handed thing. Stage.propIn(text) -> the first prop a text names
      (a dish of the food module first). Stage.dishIn(text) -> { id, prop } of the first dish a text names; Stage.dishProp(text) -> its prop.
      Stage.undish(text) -> the text with every dish name blanked (same length), for finding the animals a line names.
  Stage.NOUNS -> [pattern, kit id] for the animals and things SceneKits draws (scene_kits.js).
  Actors: h0.. the heroes (h0 the lead), t the traveller (a crew's face), m1.. a crew's members, x:<role> anyone or anything
  else the line names (x:farmer, x:dog, x:cart), crowd a row of onlookers.
  Acts: walk give pay share say call ask decline banter laugh cheer bow nod wave salute shake hug smile blush look point read
  count carve dig pick sit sink wade fish light burn mend push carry spar fall duck sleep leave chase climb sing dance ring echo
  bless teach eat drink fade sun shadow weather beh (an animal or cart doing its thing) talk.
*/
(function (root) {
  "use strict";

  // ---------- props ----------
  const PAL = { k: "#2a1a12", w: "#f4ecd8", p: "#e2d0a8", r: "#b8402c", R: "#7a2018", y: "#e8b84a", Y: "#ffe08a", o: "#c8803a", O: "#8a5420", b: "#6a4a2a", B: "#3a2414",
    g: "#5e8a3a", G: "#3a5a2a", s: "#a8b4c0", S: "#e0e8f0", c: "#4a7ab8", C: "#9ac8e8", n: "#d8a070", m: "#8a8a92", M: "#4a4a52", f: "#f0b0c0", v: "#7a5a9a", t: "#d8c8a0" };
  const P = {
    letter: ["kkkkkkk", "kwwwwwk", "kwkwkwk", "kwwrwwk", "kkkkkkk"],
    map: ["kkkkkkkk", "kpppcppk", "kpprppck", "kpcppppk", "kkkkkkkk"],
    scroll: ["kk.kk", "kppppk", "kpkpk.", "kppppk", "kk.kk"],
    note: ["kkkkk", "kwwwk", "kwkwk", "kwwwk", "kkkkk"],
    lure: ["..k..", ".kyk.", "kyrYk", ".kRk.", "..k..", ".k.k."],
    fish: ["..k...", ".kSk..", "kSSSkk", "kSsSSk", ".kSSkk", "..k..."],
    loaf: [".kkkk.", "koOoOk", "kooooo", ".kkkkk"],
    bun: [".kk.", "kOok", "kook", ".kk."],
    basket: ["k.kk.k", ".k..k.", "kbbbbk", "kOnOnk", ".kbbk."],
    apple: ["..g.", ".kk.", "krrk", "kRrk", ".kk."],
    pasty: ["..kkk.", ".kooOk", "koOoook", ".kkkkk."],
    bowl: ["kSSSSk", "kbbbbk", ".kbbk."],
    cup: ["kkkk.", "kSSkk", "kmmk.k", "kmmkk", ".kk.."],
    mug: ["kwwk.", "kyyk.", "kyykk", "kyyk.", ".kk.."],
    coin: [".kk.", "kyYk", "kyyk", ".kk."],
    purse: [".k.k.", "kbkbk", "kbbbk", "kbbbk", ".kkk."],
    ring: [".kk.", "kY.k", "k..k", ".kk."],
    hat: ["..kk..", ".kvvk.", ".kvvk.", "kkkkkk"],
    card: ["kkkk", "kwrk", "kwwk", "krwk", "kkkk"],
    cards: ["kkkkk.", "kwrkk.", "kwwkwk", "krwkrk", "kkkwwk", "...kkk"],
    flower: [".f.", "fyf", ".f.", ".g.", "gg."],
    flowers: ["f.y.f", ".fgf.", "y.g.y", "..g..", ".ggg."],
    stone: [".kk.", "kmmk", "kmMk", ".kk."],
    pebble: [".kk.", "kcck", ".kk."],
    lamp: [".k.", "kyk", "kYk", "kyk", "kkk"],
    candle: [".Y.", ".y.", "kwk", "kwk", "kwk"],
    rod: ["......k", ".....k.", "....k..", "...k...", "..k....", ".b.....", "b......"],
    boots: ["kk.kk.", "kbkkb.", "kbkkbk", "kbbkbb", "kkkkkk"],
    strap: ["kkkkkk", "bbybbb", "kkkkkk"],
    ledger: ["kkkkkk", "kRRRRk", "kRyRRk", "kRRRRk", "kkkkkk"],
    book: ["kkkkk", "kcccc", "kcyck", "kcccc", "kkkkk"],
    wood: ["....kk", "..kkbk", "kkbbkk", "kbbkk.", "kkk..."],
    egg: [".kk.", "kwwk", "kwpk", ".kk."],
    cheese: ["...kk", ".kkyk", "kyyyk", "kyYyk", "kkkkk"],
    honey: [".kk.", "kOOk", "kyyk", "kyyk", ".kk."],
    jar: [".kk.", "kbbk", "kpwk", "kppk", ".kk."],
    key: [".kk....", "kyYkkkk", ".kk.k.k"],
    feather: ["....kk", "...kwk", "..kwk.", ".kwk..", "kk...."],
    horseshoe: ["k...k", "km.mk", "km.mk", ".kmk."],
    rope: [".kkk.", "kt.tk", "kt.tk", ".kkk."],
    spoon: [".kk", "kmk", ".k.", ".k.", ".k."],
    pot: ["kkkkkk", "kMMMMk", "kMmmMk", ".kkkk."],
    bell: ["..k..", ".kyk.", ".kyk.", "kyyyk", "kkkkk"],
    bottle: [".k.", ".k.", "kgk", "kgk", "kGk", "kkk"],
    shell: [".kkk.", "kfwfk", "kwfwk", ".kkk."],
    medal: ["krk", ".k.", "kyk", "kYk", ".k."],
    ribbon: ["k.k", "krk", ".r.", "krk", "r.r"],
    scarf: ["kkkkkk", "krrrrk", "kkkrrk", "...kk."],
    blanket: ["kkkkkkk", "krkrkrk", "kkkkkkk"],
    sack: [".kkk.", "kttk.", "kttttk", "kttttk", ".kkkk."],
    lute: ["....kk", "...kk.", "..kk..", "kOOk..", "OOOk..", "kOk..."],
    whistle: ["kkkkk", "kSSSk", "kkkkk"],
    drum: ["kkkkk", "kwwwk", "krrrk", "kkkkk"],
    sword: ["......k", ".....k.", "....k..", "...k...", "kbk....", ".k....."],
    stick: [".....b", "....b.", "...b..", "..b...", ".b....", "b....."],
    tonic: [".k.", "kck", "kCk", "kkk"],
    tea: ["kSSk.", "kbbkk", "kbbk.", ".kk.."],
    pail: ["k...k", ".kkk.", "kmmmk", "kmSmk", ".kkk."],
    paper: ["kkkkk", "kwwwk", "kwkwk", "kwwwk", "kkkkk"],
    tabard: ["kkkkk", "kwrwk", "kwrwk", "kwwwk"],
    poster: ["kkkkk", "kpppk", "krkrk", "kpppk", "kkkkk"],
    form: ["kkkkk", "kwwwk", "kwgwk", "kwwwk", "kkkkk"],
    dice: ["kkk.", "kwk.", "kkkk", ".kwk", ".kkk"],
    knot: [".kk.", "ktkt", "tkkt", ".tt."],
    button: [".kk.", "kOOk", "kOOk", ".kk."],
    trunk: ["kkkkkk", "kbybbk", "kbbbbk", "kkkkkk"],
    pie: ["..kkkk..", ".kyoyok.", "koooooOk", "kOOOOOOk", ".kkkkkk."],
    cake: ["...r..", ".kkkk.", "kwfwfk", "kppppk", "kooOOk", ".kkkk."],
    haunch: [".kkkk....", "kooOOk...", "kOoOOOk..", "kOOOOOk..", ".kOOOkwk.", "..kkk.kwkk", "......kwwk", ".......kk."],
    skewer: [".kkk.kkk.kkk..", "kooOkrRrkoOOk.", "bOOOkRRRkOOOkb", ".kkk.kkk.kkk.."],
  };
  const cache = new Map();
  function prop(name) {
    const rows = P[name] || P.note;
    if (cache.has(name)) return cache.get(name);
    const w = Math.max(...rows.map((r) => r.length)), h = rows.length, px = new Array(w * h).fill(null);
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== ".") px[j * w + i] = PAL[row[i]]; });
    const g = { w, h, px };
    cache.set(name, g);
    return g;
  }
  // a word in a line, to the prop that shows it
  const FISH = /\b(fish|trout|pike|eels?|perch|carp|roach|herring|mackerel|cod|salmon|minnows?|sardines?|grayling|char)\b/;
  const PROP_WORDS = [
    [/\bletters?\b|\benvelope|\bintroduction\b/, "letter"], [/\bmaps?\b|\bchart\b/, "map"], [/\brecipe\b|\bscroll\b|\bnews\b|\bverse\b/, "scroll"], [/\bnote\b|\blist\b|\bslate\b|\bposter\b/, "note"],
    [/\blure\b/, "lure"], [FISH, "fish"], [/\b(loaf|bread)\b/, "loaf"], [/\b(buns?|biscuits?|scones?)\b/, "bun"], [/\b(cakes?|tarts?|puddings?)\b/, "cake"],
    [/\bbasket\b/, "basket"], [/\bapples?\b|\bpears?\b|\bplums?\b/, "apple"], [/\b(pasty|pasties)\b/, "pasty"], [/\bpies?\b/, "pie"], [/\b(stew|soup|porridge|bowl)\b/, "bowl"],
    [/\b(tea|tonic|cup)\b/, "tea"], [/\b(ale|beer|mug|tankard|cider)\b/, "mug"], [/\bpurse\b/, "purse"], [/\b(coins?|copper|silver|gold|penny|pennies)\b/, "coin"],
    [/\brings?\b/, "ring"], [/\bhats?\b|\bbonnet\b|\bcap\b/, "hat"], [/\bcards?\b|\bdeck\b/, "card"], [/\bflowers?\b|\bposy\b|\bdaisy|\bdaisies\b|\bbloom/, "flower"],
    [/\bpebbles?\b/, "pebble"], [/\bstones?\b|\brock\b/, "stone"], [/\blanterns?\b|\blamps?\b/, "lamp"], [/\bcandles?\b/, "candle"], [/\brod\b/, "rod"],
    [/\bboots?\b|\bshoes?\b/, "boots"], [/\bstrap\b|\bbelt\b/, "strap"], [/\bledger\b/, "ledger"], [/\bbook\b|\bjournal\b/, "book"], [/\b(firewood|kindling|sticks?|log)\b/, "wood"],
    [/\beggs?\b/, "egg"], [/\bcheese\b/, "cheese"], [/\bhoney\b(?! ?cakes?)/, "honey"], [/\bjar\b/, "jar"], [/\bkey\b/, "key"], [/\bfeathers?\b/, "feather"], [/\bhorseshoe\b/, "horseshoe"],
    [/\brope\b/, "rope"], [/\bknots?\b/, "knot"], [/\bspoon\b/, "spoon"], [/\bpot\b|\bkettle\b/, "pot"], [/\bbells?\b/, "bell"], [/\bbottle\b|\bflask\b/, "bottle"],
    [/\bshells?\b/, "shell"], [/\bmedal\b/, "medal"], [/\bribbon\b/, "ribbon"], [/\bscarf\b/, "scarf"], [/\bblanket\b|\bcloak\b/, "blanket"], [/\bsacks?\b|\bpail\b|\bbucket\b/, "sack"],
    [/\blute\b|\bfiddle\b|\bharp\b/, "lute"], [/\bwhistle\b|\bpipe\b/, "whistle"], [/\bdrum\b/, "drum"], [/\bswords?\b|\blance\b/, "sword"], [/\bdice\b/, "dice"], [/\bbuttons?\b/, "button"],
    [/\bform\b/, "form"], [/\btabard\b/, "tabard"], [/\btrunk\b/, "trunk"],
  ];
  function propIn(text) {
    const d = dishProp(text);
    if (d) return d;
    const s = String(text || "").toLowerCase();
    let best = null, at = 1e9;
    for (const [re, name] of PROP_WORDS) { const m = s.match(re); if (m && m.index < at) { at = m.index; best = name; } }
    return best;
  }

  // a dish of the food module named in a line (data/static.js food.dishes), to the prop that shows it on its plate
  const PLATE = { stew: "bowl", soup: "bowl", porridge: "bowl", pilaf: "bowl", salad: "bowl", ice: "bowl", roast: "haunch", slab: "haunch", sweet: "cake", jelly: "cake",
    crisps: "basket", pie: "pie", eelpie: "pie", bun: "bun", skewer: "skewer", sausage: "skewer", claws: "pot",
    fillet: "fish", wholefish: "fish", plankfish: "fish", clayfish: "fish", bigfish: "fish" };
  const PLATE_NAME = { bun: [[/\bbread\b/, "loaf"]], pie: [[/\bpast(y|ies)\b/, "pasty"]], crisps: [[FISH, "fish"]] };
  // how the town's own lines name its dish (league/content/town_life.py DISHES) where that is not the dish's name
  const DISH_SAID = { "fried river fish": "river_cone", "chowder on the harbour wall": "harbour_chowder" };
  const said = (x) => String(x || "").toLowerCase().replace(/[‘’]/g, "'").replace(/[-\s]/g, " ");
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let dishSrc, dishList = [];
  function dishes() {
    const S = (root.LD && root.LD.static) || (root.App && root.App.S) || {}, src = (S.food || {}).dishes || null;
    if (src === dishSrc) return dishList;
    dishSrc = src;
    const out = [];
    for (const [id, d] of Object.entries(src || {})) {
      const nm = said(d.name).replace(/^the /, ""), own = (PLATE_NAME[d.plate] || []).find(([re]) => re.test(nm));
      out.push([nm, id, own ? own[1] : PLATE[d.plate] || "bowl"]);
    }
    for (const [ph, id] of Object.entries(DISH_SAID)) { const hit = out.find((x) => x[1] === id); if (hit) out.push([ph, id, hit[2]]); }
    dishList = out.sort((a, b) => b[0].length - a[0].length).map(([nm, id, prop]) => [new RegExp("(?<![a-z])" + esc(nm) + "(?![a-z])", "g"), id, prop]);
    return dishList;
  }
  // -> { id, prop } of the first dish a text names (the longest name where two start together), or null
  function dishIn(text) {
    const s = said(text);
    let best = null, at = 1e9;
    for (const [re, id, prop] of dishes()) { re.lastIndex = 0; const m = re.exec(s); if (m && m.index < at) { at = m.index; best = { id, prop }; } }
    return best;
  }
  // -> [[start, end]] of every dish a text names, so an "eel pie" puts no eel on the stage
  function dishSpans(text) {
    const s = said(text), out = [];
    for (const [re] of dishes()) { re.lastIndex = 0; let m; while ((m = re.exec(s))) if (!out.some(([a, b]) => m.index < b && m.index + m[0].length > a)) out.push([m.index, m.index + m[0].length]); }
    return out;
  }
  function undish(text) { let s = String(text || ""); for (const [a, b] of dishSpans(s)) s = s.slice(0, a) + " ".repeat(b - a) + s.slice(b); return s; }
  function dishProp(text) { const d = dishIn(text); return d ? d.prop : null; }

  // ---------- cutting a line into captions ----------
  const MAXC = 84;
  function split(line) {
    const s = String(line || "").replace(/\s+/g, " ").trim();
    if (!s) return [];
    // sentences, never inside a quote (a quote opens after a space or at the start, so "Garrow's" is no quote)
    const out = [];
    let cur = "", q = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i], prev = s[i - 1] || " ", next = s[i + 1] || " ";
      cur += ch;
      if (!q && (ch === "'" || ch === "‘" || ch === '"' || ch === "“") && /[\s(]/.test(prev)) { q = ch; continue; }
      if (q && (ch === "'" || ch === "’" || ch === '"' || ch === "”") && /[\s.,!?;:)]/.test(next)) { q = null; if (/[.!?]/.test(prev) && next === " " && /[A-Z]/.test(s[i + 2] || "") && !/\b(says?|said|asks?|cries|calls?)$/.test(cur)) { out.push(cur.trim()); cur = ""; } continue; }
      if (!q && /[.!?]/.test(ch) && next === " " && /[A-Z'"‘“]/.test(s[i + 2] || "") && !/\b(Mr|Mrs|Dr|St|Mt)\.$/.test(cur)) { out.push(cur.trim()); cur = ""; }
    }
    if (cur.trim()) out.push(cur.trim());
    // a long sentence is cut at its last ", and" / "; " / ", " before the limit
    const res = [];
    for (let t of out) {
      while (t.length > MAXC) {
        let cut = -1;
        for (const sep of [", and ", "; ", ", but ", ", then ", ", where ", ", ", " while ", " and ", " as ", " who ", " with "]) { const k = t.lastIndexOf(sep, MAXC); if (k > 24) { cut = k + (sep.startsWith(",") || sep.startsWith(";") ? 1 : 0); break; } }
        if (cut < 0) break;
        res.push(t.slice(0, cut).trim()); t = t.slice(cut).trim();
      }
      res.push(t);
    }
    // very short tails join the caption before them
    const merged = [];
    for (const t of res) { if (merged.length && (t.length < 22 || merged[merged.length - 1].length < 18) && merged[merged.length - 1].length + t.length < MAXC + 10) merged[merged.length - 1] += " " + t; else merged.push(t); }
    return merged.slice(0, 5);
  }

  // ---------- who is who in a line ----------
  const ROLE_WORDS = /\b(?:the|a|an|one|some) (old |young |little |weary |tired |royal |silent |lost |local |proud |grateful |kindly |stout |grumpy |cheerful )?(farmer|farm wife|child|boy|girl|grandmother|granny|old woman|old man|drover|mapmaker|foreman|carter|wagoner|pedlar|peddler|miner|miners|stranger|merchant|pilgrim|priest|monk|hermit|shepherd|tinker|keeper|innkeeper|landlord|landlady|guard|watchman|sergeant|knight|minstrel|fiddler|harper|piper|beggar|gambler|courier|rider|fisher|fisherman|angler|baker|cook|smith|woodcutter|soldier|veteran|champion|dentist|beekeeper|card reader|reader|widow|hunter|ferryman|ferrywoman|toll-keeper|tollkeeper|bargee|carpenter|potter|weaver|scholar|clerk|witch|sailor|captain|lady|lord|noble|harvest gang|gang|villagers|crowd|street|town|goblins?|dwarves|students)\b/i;
  const PRON = { she: "she", her: "she", he: "he", him: "he", his: "he" };
  function names(ctx) {
    const list = [];
    (ctx.heroes || []).forEach((h, i) => { if (h.name) list.push([h.name, "h" + i]); });
    const t = ctx.trav;
    if (t) {
      const add = (n, id) => { n = String(n || "").replace(/^the /i, "").trim(); if (n.length > 2) list.push([n, id]); };
      add(t.name, "t");
      const words = String(t.name || "").replace(/^the /i, "").split(/\s+/);
      if (words.length > 1) {
        // "Lady Perpetua Vane": also "Lady Perpetua", "Lady Vane", "Perpetua"; "the Wet Boots Angling Club": also "the Club", "the Angling Club"
        const title = /^(lady|lord|sir|brother|sister|old|granny|granfer|mother|father|captain|sergeant|doctor|master|foreman|ma|pa|mrs\.?|mr\.?|dame)$/i;
        if (title.test(words[0])) { add(words.slice(0, 2).join(" "), "t"); add(words[0] + " " + words[words.length - 1], "t"); add(words[1], "t"); if (words.length > 2) add(words[words.length - 1], "t"); }
        else if (t.kind === "crew") { add(words.slice(-2).join(" "), "t"); add(words[words.length - 1], "t"); }
        else add(words[0], "t");
      }
      if (t.kind === "crew") {
        const face = t.raw && t.raw.face;
        if (face) { add(face, "t"); const fw = face.split(/\s+/); fw.forEach((w, i) => { if (i && w.length > 2 && !/^(the|of)$/i.test(w)) add(w, "t"); }); if (fw.length > 2) add(fw.slice(0, 2).join(" "), "t"); }
        (t.members || []).forEach((m, i) => { const n = typeof m === "string" ? m : m.name; add(n, "m" + (i + 1)); const mw = String(n || "").split(/\s+/); if (mw.length > 1 && !/^(the|big|little|old|mrs\.?)$/i.test(mw[0])) add(mw[0], "m" + (i + 1)); else if (mw.length > 1) add(mw.slice(0, 2).join(" "), "m" + (i + 1)); });
        for (const w of ["Company", "Club", "Collective", "Pack", "Pilgrims", "Players", "Scholars", "Truants", "Tinkers", "Caravan", "Circus", "dwarves", "goblins", "players", "pilgrims", "tinkers", "family", "anglers"]) if (String(t.name + " " + (t.what || "")).toLowerCase().includes(w.toLowerCase().replace(/s$/, ""))) add("the " + w, "t");
      }
    }
    if (ctx.place && ctx.place.keeper) { add2(list, ctx.place.keeper, "x:keeper"); }
    list.sort((a, b) => b[0].length - a[0].length);
    return list;
  }
  function add2(list, n, id) {
    list.push([n, id]);
    const w = String(n).split(/\s+/);
    if (w.length > 1) { list.push([w[0] + " " + w[1], id]); if (!/^(ma|pa|old|dame|widow|sergeant|captain|auntie|uncle|granny|mother|father|brother|sister|master|mistress)$/i.test(w[0])) list.push([w[0], id]); else list.push([w[w.length - 1], id]); }
  }
  // everyone a clause names, in the order they come
  function mentions(clause, ctx, nm) {
    const out = [], s = clause;
    for (const [n, id] of nm) {
      const re = new RegExp("(^|[^A-Za-z])" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z])", n.length < 4 ? "" : "i");
      const m = s.match(re);
      if (m && !out.some((o) => o.id === id || (m.index >= o.at && m.index < o.at + o.len))) out.push({ id, at: m.index + m[1].length, len: n.length });
    }
    const role = s.match(ROLE_WORDS);
    if (role && !out.some((o) => role.index >= o.at && role.index < o.at + o.len)) {
      const w = role[2].toLowerCase(), crowd = /^(street|crowd|villagers|town|harvest gang|gang|miners|goblins?|dwarves|students)$/.test(w);
      out.push({ id: crowd ? "crowd" : "x:" + w.replace(/ /g, "_").replace(/^(farm wife)$/, "farmer").replace(/^(peddler)$/, "pedlar").replace(/^(innkeeper|landlord|landlady)$/, ctx.place && ctx.place.keeper ? "keeper" : "innkeeper"), at: role.index, len: role[0].length, role: w });
    }
    // the animals, carts and things the line puts on the road (up to two per caption), each drawn by scene_kits.js
    let n = 0;
    const dished = dishSpans(s);
    for (const [re, id] of NOUNS) {
      if (n >= 2) break;
      const m = s.match(re);
      if (!m || dished.some(([a, b]) => m.index >= a && m.index < b) || out.some((o) => o.id === "x:" + id || (m.index >= o.at && m.index < o.at + o.len))) continue;
      out.push({ id: "x:" + id, at: m.index, len: m[0].length });
      n++;
    }
    // a pronoun at the head of a clause is whoever it can only be
    const pm = s.match(/^(?:and |then |but )?(she|he)\b/i);
    if (pm && !out.some((o) => o.at < 4)) out.push({ id: "pron:" + PRON[pm[1].toLowerCase()], at: 0, len: pm[0].length });
    return out.sort((a, b) => a.at - b.at);
  }

  // what a line can name that the kits draw: [pattern, kit id]; "rook" counts only lower-case (Rook is also a hero)
  const NOUNS = [
    [/\b(oxen|ox|bullocks?)\b/i, "ox"], [/\b(cows?|heifers?|calf|calves|herd)\b/i, "cow"], [/\b(dogs?|hounds?|sheepdogs?|collies?|pupp(y|ies)|mutts?|terriers?|lurchers?)\b/i, "dog"],
    [/\b(cats?|kittens?)\b/i, "cat"], [/\b(hares?|rabbits?)\b/i, "hare"], [/\bfox(es)?\b/i, "fox"], [/\bherons?\b/i, "heron"], [/\bowls?\b/i, "owl"],
    [/\b(ravens?|crows?|jackdaws?)\b|\brooks\b|\brook\b(?! [A-Z])/, "crow"], [/\bmagpies?\b/i, "magpie"], [/\b(rooster|cockerel)s?\b/i, "rooster"], [/\b(hens?|chickens?|pullets?)\b/i, "hen"],
    [/\b(geese|goose|gander|swans?|ducks|ducklings?)\b/i, "goose"], [/\b(sheep|lambs?|ewes?|flock)\b/i, "sheep"], [/\b(goats?|billy-goat)\b/i, "goat"], [/\b(deer|stags?|does|hinds?)\b/i, "deer"],
    [/\b(bees?|swarm|hives?|beekeepers?|skeps?)\b/i, "bees"], [/\beels?\b/i, "eel"], [/\bcrabs?\b/i, "crab"], [/\b(swallows|swifts|martins|swallow)\b/i, "swallow"],
    [/\b(gannets?|gulls?|seagulls?|terns?)\b/i, "gull"], [/\b(horses?|pon(y|ies)|mares?|nags?|carthorse)\b/i, "horse"], [/\b(mules?|donkeys?)\b/i, "mule"],
    [/\b(pigs?|piglets?|sows?|hogs?)\b/i, "pig"], [/\bboar\b/i, "boar"], [/\b(rats?|mice|mouse)\b/i, "rat"], [/\bbear\b/i, "bear"], [/\bwol(f|ves)\b/i, "wolf"],
    [/\b(giant|troll|ogre)\b/i, "giant"], [/\b(wyvern|dragon|wings the size)\b/i, "shadow"],
    [/\btinkers?('s)? (wagon|cart)\b|\btinkers\b/i, "tinker"], [/\bmenagerie\b/i, "menagerie"], [/\b(stalls?|barrows?|booths?)\b/i, "stall"], [/\b(cider press|apple press|press)\b/i, "press"],
    [/\b(ovens?|bakehouse)\b/i, "oven"], [/\b(a|the|wishing|old) well\b/i, "well"], [/\bscarecrows\b|\bscarecrow\b/i, "scarecrow"],
    [/\b(carts?|wagons?|waggons?|haywains?|wains?|axles?|cartwheels?)\b/i, "cart"],
    [/\b(washing|laundry|clothes ?line)\b/i, "washing"], [/\b(brambles?|blackberr(y|ies)|hedges?|hedgerows?|bushes?|thicket)\b/i, "bush"],
    [/\b(trees?|oaks?|ash tree|elm|willow|apple tree)\b/i, "tree"], [/\b(benches?|bench)\b/i, "bench"], [/\b(barrels?|kegs?|casks?)\b/i, "barrel"],
    [/\b(crates?|upturned crate)\b/i, "crate"], [/\b(haystacks?|hayrick|hay)\b/i, "haystack"], [/\b(gates?|gatepost)\b/i, "gate"], [/\bstiles\b|\bstile\b/i, "stile"],
    [/\b(notice board|board|rumour board|slate)\b/i, "board"], [/\b(tide pool|tide-pool|rock pool|puddles?|pond)\b/i, "pool"], [/\blean-to\b/i, "leanto"],
    [/\b(boats?|skiff|punt|rowing boat)\b/i, "boat"], [/\b(signposts?|fingerposts?|sign ?post)\b/i, "signpost"], [/\b(mushrooms?|fairy ring|toadstools?)\b/i, "mushrooms"], [/\bladders\b|\bladder\b/i, "ladder"], [/\b(standing stones?|menhir)\b/i, "standing"], [/\b(puppets?|puppet show|puppeteer)\b/i, "puppets"],

  ];

  // ---------- what a clause does ----------
  const VERBS = [
    ["walk", /\b(passes the|passes a|reaches|comes to|stops (at|by|under|a moment at)|arrives at|walks into|walks past|stamps (up to|into)|follows (a|the) (smell|trail|glow))\b/],
    ["wave", /\b(meets|runs into|comes upon|catches up with|greets|hails|bumps into|falls in with)\b/],
    ["aside", /\b(steps? aside|steps? back|into the ditch|stands? aside|makes? way|out of the way|presses? (himself|herself|themself|themselves) to the)\b/],
    ["sink", /\b(sinks? to the|sinks? in|bog takes|marsh (holds|keeps|takes)|up to (the|her|his|their) (knee|waist|shin)s?|stuck (fast|in the mud))\b/],
    ["banter", /\b(puns?|jokes?|I spy|groans?|teases?|bicker|argue about|riddles?|spies something)\b/],
    ["pick", /\b(picks? (it )?up|finds? (a|an|the|some)|pockets?|fishes? (a|an|the) .* out|unearths?|turns up)\b/],
    ["sit", /\b(sits? (down|beside|on|with)|sat down|takes? a seat)\b/],
    ["carve", /\b(carves?|carving|scratch(es)? (a|his|her|their)|chisels?|cuts? (a|his|her|their|the) name)\b/],
    ["chase", /\b(chases?|chasing|runs? after|gives? chase|shoos?)\b/],
    ["dig", /\b(digs?|digging|unearths?|shovels?|spade)\b/],
    ["point", /\b(points?|shows? (them|him|her|\w+) the way|directs?|the way to)\b/],
    ["wade", /\b(wades?|fords? the|wading|splashes across)\b/],
    ["share", /\b(shares?|splits?|passes? round|hands? round)\b/],
    ["decline", /\b(declines?|says no|refuses?|turns? (it|them|him|her) down|politely declines)\b/],
    ["duck", /\b(lies? flat|lie down|ducks?|dives? for|throws? (himself|herself|themselves|themself) down|hit the ground)\b/],
    ["fall", /\b(on (her|his|their) back|knocked flat|falls? (over|down|in(?! (behind|beside|with|step|alongside)))|pushed back into|into a ditch|tumbles?|ends up on)\b/],
    ["spar", /\b(spars?|bouts?|duel|trade blows|wrestl|wooden swords|fence[sd]?|lance)\b/],
    ["dance", /\bdanc/],
    ["sing", /\b(sings?|singing|song|hymn|verses?|chorus|harmony|perform|hums?|humming|whistles?|whistling)/],
    ["fish", /\b(fish(es|ing)?\b(?! stew)|lands? a|a line\b|rod\b|casts?\b|angl)/],
    ["light", /\b(lights?|relights?|trim[s]? a wick|wick|hangs? a new lantern)\b/],
    ["burn", /\bburns?\b/],
    ["give", /\b(gives?|given|hands?|handed|presses .*into|lends?|passes? .* to|tosses?|is gifted|offers? (him|her|them|\w+) (a|an|the|some|half)|shares? (a|an|the|his|her|their|half)|pays? in|sells? \w+ a|puts .* (in front of|into)|leaves? a stack|buys? the mule)\b/],
    ["pay", /\b(pays?|paid|counts? out|drops? \d+ copper|\d+ copper|\d+ silver)\b/],
    ["bless", /\b(bless|blessing|lays? (her|his|their) hands|prays?|the old words)\b/],
    ["salute", /\bsalutes?\b/],
    ["shake", /\b(shakes? .*hand|handshake)\b/],
    ["bow", /\b(bows?|curts(e)?ys?|takes? a bow)\b/],
    ["ask", /\b(asks?|begs?|petitions?|wonders? aloud|offers? (to|himself|herself|themselves)|whether|would like)\b/],
    ["cheer", /\b(cheers?|cheering|applause|applaud|hurrah|huzzah|turns? out to)\b/],
    ["laugh", /\b(laughs?|laughing|giggles?|chuckles?)\b/],
    ["call", /\b(calls?|cries|shouts?|proclaims?|announces?|tells? everyone|hollers?|yells?)\b/],
    ["carry", /\b(carr(y|ies)|shoulders?|piggyback)\b/],
    ["push", /\b(push(es)?|shoves?|heaves?|lends? a shoulder|shifts? it)\b/],
    ["mend", /\b(mends?|fix(es)?|oils?|repairs?|patch(es)?|darns?|sews?)\b/],
    ["teach", /\b(teach(es)?|shows? \w+ (how|the proper)|drills?|lesson)\b/],
    ["read", /\b(reads?|read out|letters|scrawl|writes? down|writes?)\b/],
    ["count", /\b(counts?|tall(y|ies)|totals?|names every)\b/],
    ["eat", /\b(eats?|supper|breakfast|dinner|stew|pasty|buns?|loaf|feast)\b/],
    ["drink", /\b(drinks?|sips?|tea\b|ale\b|toast)\b/],
    ["climb", /\bclimbs?\b/],
    ["sleep", /\b(asleep|sleeps?|naps?|dozes?|snores?)\b/],
    ["leave", /\b(off (he|she|they) goes|walks? off|walks? away|leaves|retire|speck|goes on ahead|vanish|disappears?|already gone)\b/],
    ["walk", /\b(falls? into step|a whole mile|for a mile|walks? the|walks? (with|beside|along|alongside|\w+ along)|follows?|falls? in beside|leads?|guides?|escorts?|walk(s)? (them|him|her) )/],
    ["wave", /\bwaves?\b/],
    ["nod", /\bnods?\b/],
    ["hug", /\b(hugs?|embrace)/],
    ["look", /\b(watch(es)?|looks?|stares?|studies|gazes?|sees|spots?|finds?|shown|shows?)\b/],
    ["smile", /\b(grins?|smiles?|beams?|blush)/],
    ["hold", /\b(holds?|keeps? it|treasure)\b/],
  ];
  function verbOf(s) {
    const low = s.toLowerCase().replace(/'[^']*'|"[^"]*"/g, " ");
    let best = null, at = 1e9;
    for (const [k, re] of VERBS) { const m = low.match(re); if (m && m.index < at) { at = m.index; best = k; } }
    // asking and declining in one clause is a decline (the answer is what we see)
    if (/\b(declines?|says no)\b/.test(low)) best = "decline";
    return best || "talk";
  }
  const quoteOf = (s) => { const m = String(s).match(/(?:^|\s)['"‘“]([^'"’”]{2,90})['"’”](?=[\s.,!?;:]|$)/); return m ? m[1].replace(/,$/, ".") : null; };
  // a few words a speaker says when the line reports it but does not quote it
  const SAYS = { decline: "No, thank you.", cheer: "Hurrah!", laugh: "Ha!", bless: "Go well.", thanks: "Thank you!" };
  const cap1 = (s) => String(s).replace(/^./, (c) => c.toUpperCase());
  function where(s, rec, prev) {
    const l = s.toLowerCase();
    if (/\bbalcony\b/.test(l)) return "balcony";
    if (/\b(market|stall)\b/.test(l)) return "market";
    if (/\b(the whole street|a whole street|in town|into a town|to a village|the village|town square)\b/.test(l)) return "street";
    if (/\b(academy|city gate|the gate|the towers|town gate)\b/.test(l)) return "gate";
    if (/\b(hilltop|on a hill|hills\b)/.test(l)) return "hill";
    if (/\b(the sea|shore|beach|waves)\b/.test(l)) return "shore";
    if (/\b(over the fire|by the fire|a fire\b|campfire|supper|the pot)\b/.test(l)) return "fire";
    if (/\b(lantern|lamp|wick|lamplighter)\b/.test(l)) return "lamp";
    if (/\b(shrine|chapel)\b/.test(l)) return "shrine";
    if (/\b(crossroads|gallows)\b/.test(l)) return "crossroads";
    if (/\b(tent|ring\b|grand finale|circus)\b/.test(l)) return "tent";
    if (/\b(play\b|opening night|three acts|stage\b|poster)\b/.test(l)) return "stage";
    if (/\b(tavern)\b/.test(l)) return "room";
    if (/\b(waystation)\b/.test(l)) return "waystation";
    if (/\b(barn|farm|haystack|turnip|field)\b/.test(l)) return "farm";
    if (/\b(cart|wagon|axle)\b/.test(l)) return "cart";
    if (/\b(ford|pond|bank|stream|river|brook)\b/.test(l) || (/\b(fish|rod|angl|cast)/.test(l) && !/\bfish stew\b/.test(l))) return "water";
    return prev || null;
  }

  function parse(rec, ctx) {
    const nm = names(ctx), steps = [];
    let last = { a: "h0", b: ctx.trav ? "t" : null }, set = null;
    for (const sub of split(rec.line)) {
      const ms = mentions(sub, ctx, nm).map((m) => (m.id.startsWith("pron:") ? Object.assign(m, { id: pronounTo(m.id.slice(5), last, ctx) }) : m));
      const ids = [];
      for (const m of ms) if (!ids.includes(m.id)) ids.push(m.id);
      const verb = verbOf(sub), low = sub.toLowerCase();
      // a cart, a tree or a bench is set dressing, not someone acting: the first person named acts, the hero if nobody is
      const scenery = (x) => x && x.startsWith("x:") && KIT_IDS.has(x.slice(2)) && !ANIMAL_IDS.has(x.slice(2));
      const people = ids.filter((x) => !scenery(x));
      let a = people[0] || (ids.length ? "h0" : last.a), b = ids.find((x) => x !== a) || (a === last.a ? last.b : last.a);
      if (scenery(last.a) && a === last.a) a = "h0";
      // "is given", "is shown", "is told": the one named first has it done to them
      if (/\b(is|are|gets?) (given|shown|told|handed|blessed|deemed|offered|rewarded|thanked|asked)\b/.test(low) && ids.length) { const by = ids.find((x) => x !== a); b = a; a = by || (last.b && last.b !== a ? last.b : last.a !== a ? last.a : ctx.trav ? "t" : "x:someone"); }
      if (/^(a|an|the|one)\s/i.test(sub) && !ids.length && ctx.trav) a = "t";
      let act = verb;
      const q = quoteOf(sub);
      let prop = ["give", "pay", "read", "hold", "eat", "drink", "look", "burn", "light", "fish", "mend", "carry"].includes(act) ? propIn(sub) : null;
      if (act === "pay") prop = "coin";
      if (act === "give" && !prop) prop = /\b(half|share)\b/.test(low) && /fish|trout/.test(low) ? "fish" : "bun";
      if (act === "decline" && /\bgiven|\bgive\b|\bhands?\b/.test(low)) { steps.push(step(cont(sub), act, a, b, null, q || SAYS.decline)); act = "give"; prop = propIn(sub.slice(Math.max(low.search(/\bgiven|\bgive\b|\bhands?\b/), 0))) || "bun"; const giver = b && b !== a ? b : ctx.trav ? "t" : last.b; steps[steps.length - 1].then = { act: "give", a: giver, b: a, prop }; last = { a, b }; set = where(sub, rec, set); steps[steps.length - 1].set = set; continue; }
      // reported speech said out loud: "is told it is mostly stew", "The rest, Osbert says, is history"
      let rep = null;
      if (!q) {
        const m1 = sub.match(/^(.*?), ([A-Z][\w.' ]+?) (?:says|adds|insists|swears|declares), (.{3,}?)[.!]?$/);
        const m2 = sub.match(/\b(is told|says|announces|insists|declares|swears|whispers|admits)(?: that)? (.{5,46}?)[.!]?$/);
        if (m1 && !/\b(he|she|they|them|their|her|his|him)\b/i.test(m1[1] + " " + m1[3])) { rep = cap1(m1[1] + " " + m1[3]) + "."; const who = ms.find((m) => sub.indexOf(m1[2]) >= 0 && m.at === sub.indexOf(m1[2])); if (who) { b = a === who.id ? b : a; a = who.id; } }
        else if (m2 && !/\b(he|she|they|them|their|her|his|him|tobias)\b/i.test(m2[2]) && !/,/.test(m2[2])) { rep = cap1(m2[2]) + (/[?!]$/.test(m2[2]) ? "" : "."); if (m2[1] === "is told") { const t = a; a = b || (ctx.trav ? "t" : "x:keeper"); b = t; } }
        if (rep && (act === "talk" || act === "call" || act === "ask")) act = "say";
      }
      if (act === "talk" && q) act = "say";
      if (/\bshadows?\b/.test(low) && ["talk", "look", "leave"].includes(act)) act = "shadow";
      // who says the quote: the name or pronoun right before the speech verb, or the name right after it ("'...?' asks Lark")
      if (q) {
        const qi = sub.indexOf(q), befores = [...sub.matchAll(/\b(she|he|[A-Z][\w.'-]*(?: [A-Z][\w.'-]*)*) (?:says|asks|calls|cries|whispers|adds|announces|shouts)\b/g)].filter((m) => m.index < qi);
        const before = befores[befores.length - 1], after = sub.match(/['"’”],? (?:says|asks|calls|cries|whispers|adds|announces|shouts) ((?:the )?[A-Z][\w.'-]*(?: [A-Z][\w.'-]*)*)/);
        const pick = (n) => { if (/^(she|he)$/i.test(n)) return pronounTo(n.toLowerCase(), last, ctx); const m = ms.find((x) => sub.indexOf(n) >= 0 && Math.abs(x.at - sub.indexOf(n)) < 5); return m ? m.id : null; };
        const who = (before && pick(before[1])) || (after && pick(after[1].replace(/^the /, "")));
        if (who && who !== a) { b = a; a = who; }
      }
      if (act === "talk" && /\bthanks?\b/.test(low)) act = "call";
      set = where(sub, rec, set);
      const st = step(cont(sub), act, a, b, prop, (q && cap1(q)) || rep || (act === "call" && /\bthanks?\b/.test(low) ? SAYS.thanks : SAYS[act] || null));
      st.set = set;
      if (ids.includes("x:shadow")) { st.act = "shadow"; ids.splice(ids.indexOf("x:shadow"), 1); if (st.a === "x:shadow") st.a = "h0"; if (st.b === "x:shadow") st.b = null; }
      const things = ids.filter((x) => x.startsWith("x:") && KIT_IDS.has(x.slice(2)));
      if (things.length) { st.beh = {}; for (const x of things) st.beh[x] = behOf(low, x === st.a); if (st.act === "talk" || (st.act === "look" && !st.prop)) st.act = "beh"; }
      const wx = WEATHER.find(([re]) => re.test(low));
      if (wx) { st.wx = wx[1]; if (["talk", "look"].includes(st.act)) st.act = "weather"; }
      steps.push(st);
      last = { a, b };
    }
    return steps;
  }
  function pronounTo(p, last, ctx) {
    // a pronoun that matches the traveller's is the traveller; otherwise whoever did the last thing
    if (ctx.trav && ctx.pronoun === p) return "t";
    return last.a;
  }
  // a caption that picks up mid-sentence says so
  const cont = (s) => (/^[a-z]/.test(s) ? "..." + s : s);
  // what an animal or a cart is doing in a caption
  const KIT_IDS = new Set(NOUNS.map((n) => n[1]));
  const ANIMAL_IDS = new Set(["ox", "cow", "dog", "cat", "hare", "fox", "heron", "owl", "crow", "magpie", "rooster", "hen", "goose", "sheep", "goat", "deer", "bees", "eel", "crab", "swallow", "gull", "horse", "mule", "pig", "boar", "rat", "bear", "wolf", "giant"]);
  function behOf(low, subject) {
    if (/\b(chases?|chasing|shoos?|runs? after)\b/.test(low)) return subject ? "chase" : "flee";
    if (/\b(bolts?|flees?|runs? off|scatters?|darts? (away|off)|takes? flight|flies off|vanish|is gone|makes? off)\b/.test(low)) return "flee";
    if (/\b(won't|will not|refuses?|stubborn|budge|stuck|sits? (down )?in the|blocks?|lies across|in the way)\b/.test(low)) return "stubborn";
    if (/\b(follows?|trots? after|tags? along|at (their|his|her) heels|walks? with|keeps? pace|comes? along)\b/.test(low)) return "follow";
    if (/\b(flies|flying|wheels?|circles?|overhead|swoops?|dives?|soars?|lands? on)\b/.test(low)) return "fly";
    if (/\b(pecks?|grazes?|graze|eats?|nibbles?|chews?|forag|scratch)\b/.test(low)) return "peck";
    if (/\b(rolls?|rattles?|trundles?|passes|goes by|comes? (up|along|down))\b/.test(low)) return "pass";
    return "idle";
  }
  const WEATHER = [[/\b(fog|mist|haze) (rolls?|comes?|creeps?|drifts?|thickens?|falls?)|\bfog\b|\bmist\b/, "fog"], [/\b(rain|shower|downpour|drizzle|cloudburst|soaked|drenched)\b/, "rain"], [/\b(wind|gust|gale|breeze)\b/, "wind"], [/\b(swallows|swifts|martins)\b/, "swallows"], [/\brainbow\b/, "rainbow"]];
  const step = (sub, act, a, b, prop, say) => ({ sub, act, a, b, prop, say: say || null });

  // ---------- hand-staged finales: each variant cut at its own words, each cut acted ----------
  // [match, set, [[at, act, a, b, prop, say, extra], ...]]: at is where the caption starts in the line (lower case); a and b are actors
  const F = (match, set, cuts) => ({ match, set, cuts });
  const FINALE = {
    aldo_names: [
      F("reads out the names", "shrine", [["at the last shrine", "walk", "t", "h0"], ["'s name is there", "read", "t", "h0", "scroll", "...and {n}."]]),
      F("reads the walkers' names", "hill", [["", "read", "t", null, "scroll", "...and {n}."], ["one of them is", "smile", "h0", "t"]]),
    ],
    osk_retire: [
      F("burns the ledger", "road", [["", "say", "t", "h0", "ledger", "I am retired."], ["he burns the ledger", "burn", "t", "h0", "ledger"], ["and admits his real name", "say", "t", "h0", null, "It's Osk."], ["it is still osk", "laugh", "h0", "t"]]),
      F("handshake", "road", [["", "say", "t", "h0", "ledger", "I am retired."], ["a handshake", "shake", "t", "h0", null, "My favourite taxpayer."], ["and off he goes", "leave", "t", null, null, null, { whistle: true }]]),
    ],
    mags_respect: [
      F("on her back", "road", [["", "spar", "t", "h0"], ["and ends up on her back", "fall", "t", "h0"], ["she laughs", "laugh", "t", "h0", null, "Ha! Ha!"]]),
      F("friendly bout", "road", [["", "spar", "h0", "t"], ["and says nothing", "nod", "t", "h0"], ["from mags", "smile", "h0", "t"]]),
    ],
    fourth_best: [],
    fourth_ask: [
      F("as hirelings", "road", [["", "ask", "t", "h0", null, "Might we join you, as hirelings?"], ["says no, kindly", "decline", "h0", "t", null, "No, thank you."], ["they take it well", "give", "m1", "m2", "hat", null, { to: "mule" }]]),
      F("on their own terms", "road", [["", "ask", "t", "h0", null, "Might we join you?"], ["declines, politely", "decline", "h0", "t", null, "No, thank you."], ["says they'll be", "say", "t", "h0", null, "Fourth-best on our own terms, then!"]]),
    ],
    wenna_stall: [
      F("first customer", "market", [["", "look", "h0", "t"], ["the first customer", "wave", "t", "h0", null, "{n}! Come in!"]]),
      F("proper stall", "market", [["", "walk", "h0", "t"], ["she waves", "wave", "t", "h0", null, "Front of the line!"]]),
    ],
    perpetua_balcony: [
      F("waves at", "balcony", [["", "wave", "t", "h0", null, "Yoo-hoo!"], ["is home", "say", "t", "h0", null, "Never lost! Not once!"]]),
      F("calls down thanks", "balcony", [["", "call", "t", "h0", null, "Thank you, {n}!"], ["and tells everyone", "say", "t", "crowd", null, "I found the way myself!"]]),
    ],
    lark_satchel: [
      F("only letters", "road", [["", "give", "t", "h0", "letter"], ["letters, only letters", "read", "h0", "t", "letter"]]),
      F("shown the inside", "road", [["", "give", "t", "h0", "letter"], ["it is full of", "read", "h0", "t", "letter"], ["grins for the first time", "smile", "t", "h0"]]),
    ],
    lantern_rest: [
      F("speaks the name", "crossroads", [["", "say", "h0", "t", null, "Rest now."], ["and the lantern burns white", "fade", "t", "h0"], ["bows, finally at rest", "bow", "t", "h0"]]),
      F("hears her name", "crossroads", [["", "say", "h0", "t", null, "Rest now."], ["the light at gallows cross", "fade", "t", "h0", null, "Thank you."]]),
    ],
    maudie_market: [
      F("sells nothing", "market", [["", "say", "t", "x:buyer", null, "They're family."], ["gets a rare smile", "smile", "t", "h0"]]),
      F("refuses every offer", "market", [["", "decline", "t", "x:buyer", null, "Not for sale."], ["stands by her", "nod", "h0", "t"]]),
    ],
    ines_academy: [
      F("now hangs in the academy", "gate", [["", "look", "t", "h0", "map"], ["she stands under it", "say", "t", "h0", null, "It's mostly right."]]),
      F("has hung", "gate", [["", "walk", "t", "h0", "map"], ["there is a small mistake", "say", "t", "h0", null, "My mistake. I'm proud of it."]]),
    ],
    pim_squire: [
      F("clean tabard", "road", [["", "walk", "t", "h0"], ["and shouts hello", "call", "t", "h0", null, "Hello, {n}!"]]),
      F("squire's tabard", "road", [["", "walk", "t", "h0"], ["standing straighter", "salute", "t", "h0", "loaf"]]),
    ],
    rue_peace: [
      F("chapel's blessing", "shrine", [["", "bless", "t", "h0"], ["and, in a lower voice", "say", "t", "h0", null, "#@%&!"], ["will treasure it", "smile", "h0", "t"]]),
      F("at her chapel door", "shrine", [["", "bless", "t", "h0"], ["and then swears", "say", "t", "h0", null, "#@%&! Begone!"], ["it helps", "smile", "h0", "t"]]),
    ],
    teodor_song: [
      F("sings it to a crowd", "waystation", [["", "sing", "t", "crowd"], ["blushes to the ears", "blush", "h0", "t"]]),
      F("in a tavern", "room", [["", "sing", "t", "crowd"], ["it has all its verses", "blush", "h0", "t"]]),
    ],
    marigold_last: [
      F("the recipe", "fire", [["", "give", "t", "h0", "scroll"], ["with the secret ingredient", "read", "h0", "t", "scroll", "'A friend.'"]]),
      F("a spoon of her own", "fire", [["", "give", "t", "h0", "spoon"], ["'now you can", "say", "t", "h0", null, "Now you can feed yourself."], ["keeps it", "hold", "h0", "t", "spoon"]]),
    ],
    aldous_yield: [
      F("lowers his lance", "bridge", [["", "say", "t", "h0", null, "The bridge is yours."], ["he lowers his lance", "shake", "t", "h0"], ["and says the horse", "leave", "t", null]]),
      F("in a speech with four bows", "bridge", [["", "bow", "t", "h0", null, "The bridge is yours!"], ["the old horse", "smile", "t", "h0"]]),
    ],
    withy_orders: [
      F("the last order", "road", [["", "say", "t", "h0", null, "Look after the ones behind you."], ["he says it softly", "nod", "h0", "t"]]),
      F("salutes", "road", [["", "salute", "t", "h0"], ["'dismissed,'", "leave", "t", null, null, "Dismissed."]]),
    ],
    jory_cry: [
      F("at the top of his voice", "crossroads", [["", "call", "t", null, null, "Hear ye! {n}!"], ["and the echo carries", "echo", "t", "h0"]]),
      F("to the four winds", "crossroads", [["", "call", "t", null, null, "Hear ye! {n}!"], ["it carries", "echo", "t", "h0"]]),
    ],
    tansy_supper: [
      F("hold arrears", "road", [["", "give", "t", "h0", "ferret"], ["the ferret chews", "sleep", "h0", "t", "ferret"]]),
      F("trustworthy", "road", [["", "look", "t", "h0", "ferret"], ["which", "say", "t", "h0", null, "An honour!"]]),
    ],
    mumchance_show: [
      F("best seat in the house", "tent", [["", "look", "t", "h0"], ["and", "cheer", "crowd", "h0"]]),
      F("take a bow", "tent", [["", "call", "t", "h0", null, "{n}, into the ring!"], ["and the whole town cheers", "bow", "h0", "crowd"]]),
    ],
    goblin_ask: [
      F("official goblins", "road", [["", "ask", "t", "h0", null, "Can we be your goblins?"], ["says no", "decline", "h0", "t", null, "No, thank you."], ["and a ceremonial burp", "say", "t", "h0", null, "BURP!"]]),
      F("pointy division", "road", [["", "ask", "t", "h0", null, "Pointy Division, reporting!"], ["politely declines", "decline", "h0", "t", null, "No, thank you."], ["they take it well", "ask", "t", "h0", "boots", "Can we borrow a boot?"]]),
    ],
    thimble_finale: [
      F("shows", "stage", [["", "look", "h0", "t"], ["with real applause", "cheer", "crowd", "h0"]]),
      F("opening night", "stage", [["", "look", "h0", "t"], ["it runs two hours", "cheer", "crowd", "h0"]]),
    ],
    jingle_end: [
      F("hold a dance", "shrine", [["", "dance", "t", "h0"], ["mother hesper says", "say", "t", "h0", null, "The loudest blessing we know!"]]),
      F("paper flowers", "shrine", [["", "give", "t", "h0", "flowers"], ["and ring every bell", "ring", "t", "h0"], ["the echo", "echo", "t", "h0"]]),
    ],
    deepvein_ask: [
      F("caravan guards", "road", [["", "ask", "t", "h0", null, "Hire on as guards?"], ["says no, politely", "decline", "h0", "t", null, "No, thank you."], ["and the dwarves", "nod", "t", "h0", null, "The right answer."]]),
      F("a share of a wagon", "road", [["", "ask", "t", "h0", null, "A wagon share? A bunk?"], ["declines with thanks", "decline", "h0", "t", null, "No, thank you."], ["hjalmar says", "say", "m2", "h0", null, "Lumpy bunk anyway."]]),
    ],
    kettleby_ask: [
      F("marry into the family", "road", [["", "ask", "t", "h0", null, "Marry into the family?"], ["says no, politely", "decline", "h0", "t", null, "No, thank you."], ["and is given a pot", "give", "t", "h0", "pot"]]),
      F("strong back", "road", [["", "ask", "t", "h0", null, "Our strong back, maybe?"], ["declines", "decline", "h0", "t", null, "No, thank you."], ["they give", "give", "t", "h0", "bell"]]),
    ],
    truant_ask: [
      F("apprentices", "road", [["", "ask", "t", "h0", null, "Take us on as apprentices?"], ["says no", "decline", "h0", "t", null, "No."], ["they hand in", "give", "t", "h0", "form"]]),
      F("tag along", "gate", [["", "ask", "t", "h0", null, "Let us come! Forever!"], ["declines, and walks them", "walk", "h0", "t"], ["they go in grumbling", "cheer", "t", "h0"]]),
    ],
    offkey_finale: [
      F("sing as one", "hill", [["", "sing", "t", "h0"], ["it is, for a moment, lovely", "sing", "t", "h0", null, null, { sweet: true }], ["cheers", "cheer", "h0", "t"]]),
      F("single song in harmony", "hill", [["", "sing", "t", "h0", null, null, { sweet: true }], ["it is the best thing", "cheer", "h0", "t"]]),
    ],
    wetboots_ask: [
      F("very shyly", "water", [["", "ask", "t", "h0", null, "Take the Club along?"], ["says no", "decline", "h0", "t", null, "No, thank you."], ["'just as well,'", "say", "t", "h0", null, "We'd scare the monsters."]]),
      F("as a rear guard", "water", [["", "ask", "t", "h0", null, "A rear guard, perhaps?"], ["declines, politely", "decline", "h0", "t", null, "No, thank you."], ["and is given", "give", "t", "h0", "lure"]]),
    ],
    loom_ask: [
      F("as the party's healer", "road", [["", "ask", "t", "h0", "tonic", "Your healer, perhaps?"], ["says no", "decline", "h0", "t", null, "No."], ["'a wise choice,'", "say", "t", "h0", null, "I'd have killed us all."]]),
      F("as the band's physician", "road", [["", "ask", "t", "h0", "tonic", "Your physician?"], ["declines with thanks", "decline", "h0", "t", null, "No, thank you."], ["and he sells", "give", "t", "h0", "tonic"]]),
    ],
    hetty_last: [
      F("lights the last lantern", "lamp", [["", "light", "t", "h0", "lamp"], ["and says that", "say", "t", "h0", null, "{n}'s Lamp, from now on."]]),
      F("hangs a new lantern", "lamp", [["", "light", "t", "h0", "lamp"], ["the road is a little brighter", "smile", "h0", "t"]]),
    ],
    oake_farewell: [
      F("final forecast", "hill", [["", "say", "t", "h0", null, "Fair, with a slight chance of showers."], ["it is correct", "sun", "t", "h0"]]),
      F("waves", "hill", [["", "wave", "t", "h0"], ["'sun,'", "say", "t", "h0", null, "Sun. I am sure of it."], ["and the sun comes out", "sun", "t", "h0"]]),
    ],
    nimble_ask: [
      F("card sharp", "road", [["", "ask", "t", "h0", "cards", "A card sharp on the team?"], ["says no", "decline", "h0", "t", null, "No, thank you."], ["loses a hand", "give", "h0", "t", "cards"]]),
      F("band's luck", "road", [["", "ask", "t", "h0", "cards", "Your luck, perhaps?"], ["declines", "decline", "h0", "t", null, "No, thank you."], ["and he says luck", "say", "t", "h0", null, "Never my strong suit."]]),
    ],
    salt_sea: [
      F("real shore", "shore", [["", "walk", "t", "h0"], ["stands beside her", "look", "h0", "t"]]),
      F("reaches the sea", "shore", [["", "walk", "t", "h0"], ["she removes her hat", "bow", "t", "h0", "hat", "First mate of an empty beach?"]]),
    ],
  };
  // the steps of every arc before its finale, staged the same way
  const ARC = {
    aldo_count: [F("forty shrines", "shrine", [["", "count", "t", "h0", null, "...thirty-nine, forty."], ["and names every one", "sleep", "h0", "t"]]),
      F("knotted string", "road", [["", "count", "h0", "t", "rope"], ["the string is very long", "hold", "t", "h0", "rope"]])],
    aldo_ill: [F("has a fever", "road", [["", "sleep", "t", "h0"], ["walks the pilgrim", "carry", "h0", "t"]]), F("too ill to walk", "road", [["", "sleep", "t", "h0"], ["so ", "carry", "h0", "t"]])],
    osk_bandit: [F("mistakes", "road", [["", "spar", "h0", "t"], ["the tax collector forgives", "read", "t", "h0", "ledger", "Noted."]]),
      F("jumps out of a hedge", "road", [["", "hold", "t", "h0", "ledger", "Halt! Taxes!"], ["nobody is hurt", "read", "t", "h0", "ledger"]])],
    osk_audit: [F("audits", "road", [["", "count", "t", "h0", "ledger"], ["and finds everything", "nod", "t", "h0", null, "All in order. Pity."]]),
      F("for the records", "road", [["", "ask", "t", "h0", "ledger", "For the records."], ["writes it all down", "read", "t", "h0", "ledger"]])],
    mags_fire: [F("shares a fire", "fire", [["", "walk", "t", "h0"], ["a rumour", "say", "t", "h0", null, "Something stirs out there."]]), F("where the money is", "fire", [["", "say", "t", "h0", null, "That's where the money is."]])],
    mags_poster: [F("a poster", "road", [["", "read", "t", "h0", "poster", "Here's how I'd take it."]]), F("learns more about tracking", "road", [["", "teach", "t", "h0"]])],
    fourth_claim: [F("arrive at a waystation", "waystation", [["", "walk", "t", "h0"], ["and tell everyone", "call", "t", "crowd", null, "We slew it!"]]),
      F("claiming", "room", [["", "call", "t", "h0", null, "...and then the dragon!"], ["the story has more dragons", "laugh", "h0", "t"]])],
    fourth_race: [F("challenges", "road", [["", "ask", "t", "h0", null, "Race you to town!"], ["wins by a mile", "leave", "h0", "t"], ["the mule wins the sulk", "sleep", "m2", "t"]]),
      F("races", "road", [["", "walk", "h0", "t"], ["cheats", "laugh", "m1", "h0"], ["wins anyway", "cheer", "h0", "t"]])],
    wenna_squeak: [F("the squeak is deliberate", "cart", [["", "say", "t", "h0", null, "The squeak is on purpose."], ["customers hear her", "pay", "crowd", "t"]]),
      F("offers to oil", "cart", [["", "ask", "h0", "t", null, "Oil for the wheel?"], ["looks as though", "decline", "t", "h0", null, "How DARE you."]])],
    wenna_axle: [F("holds the cart up", "cart", [["", "fall", "x:cart", "h0"], ["holds the cart up", "push", "h0", "t"]]), F("down on one side", "cart", [["", "fall", "x:cart", "h0"], ["lifts and she hammers", "mend", "t", "h0"]])],
    wenna_oiled: [F("the silence is dreadful", "cart", [["", "nod", "t", "h0"], ["the silence", "sleep", "t", "h0"], ["buys", "pay", "h0", "t"]]), F("quiet at last", "cart", [["", "nod", "t", "h0"], ["pays", "pay", "h0", "t"]])],
    perpetua_wrong: [F("fork to the left", "crossroads", [["", "walk", "t", "h0", null, "Left. Definitely left."], ["says nothing", "say", "t", "h0", null, "A most scenic detour."]]), F("down the wrong road", "road", [["", "walk", "t", "h0"], ["because it would be rude", "nod", "h0", "t"]])],
    perpetua_home: [F("the right way round", "gate", [["", "walk", "h0", "t"], ["she calls it", "say", "t", "h0", null, "A pleasant coincidence."]]), F("spots the city gate", "gate", [["", "call", "t", "h0", null, "I knew the way all along!"], ["agrees", "nod", "h0", "t"]])],
    perpetua_letter: [F("presses a letter", "road", [["", "give", "t", "h0", "letter"], ["'doors open", "say", "t", "h0", null, "Doors open for this."]]), F("is the thanks", "road", [["", "give", "t", "h0", "letter"], ["it carries weight", "hold", "h0", "t", "letter"]])],
    lark_run: [F("quickest road", "road", [["", "ask", "t", "h0", null, "Quickest road?"], ["does, and", "leave", "t", "h0"]]), F("hedge-sheltered noon", "road", [["", "eat", "h0", "t", "bun"], ["who eats standing up", "eat", "t", "h0", "bun"]])],
    lark_letter: [F("hands", "road", [["", "give", "t", "h0", "letter"], ["it is from", "read", "h0", "t", "letter"]]), F("folded note", "road", [["", "give", "t", "h0", "note"], ["the courier is gone", "leave", "t", "h0"]])],
    lantern_card: [F("one question", "crossroads", [["", "ask", "t", "h0", null, "Where are you going?"], ["and holds a card", "hold", "t", "h0", "card"], ["it is worth thinking", "look", "h0", "t"]]),
      F("which road", "crossroads", [["", "say", "t", "h0", null, "Which road do you mean to take?"], ["she draws a card", "give", "t", "h0", "card"]])],
    lantern_name: [F("a name she has lost", "crossroads", [["", "ask", "t", "h0", null, "Find my name. Please."], ["", "nod", "h0", "t"]].slice(0, 1)), F("cannot remember", "crossroads", [["", "say", "t", "h0", null, "My name is written somewhere..."], ["promises to look", "nod", "h0", "t", null, "I'll look."]])],
    maudie_count: [F("comes up short", "road", [["", "count", "t", "h0"], ["is deputised", "nod", "h0", "t"]]), F("tuesday has taken", "road", [["", "say", "t", "h0", null, "Prudence, Clementine... Tuesday?"], ["a search begins", "look", "h0", "t"]])],
    maudie_found: [F("contentedly chewing", "road", [["", "look", "h0", "x:cow"], ["is somehow not surprised", "nod", "t", "h0"]]), F("leads her out", "road", [["", "walk", "h0", "x:cow"], ["is relieved", "smile", "t", "h0"]])],
    ines_lost: [F("a road that does not exist", "road", [["", "hold", "t", "h0", "map", "A brand new road!"], ["gently points out", "look", "h0", "t"]]), F("latest map", "road", [["", "read", "h0", "t", "map"], ["the compass rose", "laugh", "t", "h0"]])],
    ines_landmark: [F("lonely hill", "hill", [["", "read", "t", "h0", "map", "{n} Hill."], ["it is a very ordinary hill", "smile", "h0", "t"]]), F("marked with", "hill", [["", "read", "h0", "t", "map"], ["she has been drawing", "smile", "t", "h0"]])],
    pim_pack: [F("insists on carrying", "road", [["", "carry", "t", "h0", "sack"], ["almost forgets", "walk", "h0", "t"]]), F("accepts", "road", [["", "give", "h0", "t", "sack"], ["it is a lot lighter", "walk", "h0", "t"]])],
    pim_mentor: [F("the proper way", "road", [["", "teach", "h0", "t"], ["pim learns fast", "smile", "t", "h0"]]), F("leaving the bakery", "fire", [["", "say", "t", "h0", null, "So I left the bakery..."], ["listens like a master", "nod", "h0", "t"]])],
    pim_home: [F("face the baker", "gate", [["", "walk", "h0", "t"], ["they are given a loaf", "give", "x:baker", "h0", "loaf"]]), F("walks", "gate", [["", "walk", "h0", "t"], ["the baker is waiting", "give", "x:baker", "t", "loaf"]])],
    rue_temple: [F("lays her hands", "road", [["", "bless", "t", "h0"], ["walks away lighter", "smile", "h0", "t"]]), F("warm shawl", "road", [["", "bless", "t", "h0"], ["a curse for the road", "say", "t", "h0", null, "#@%&! Off you go."]])],
    rue_contest: [F("swearing contest", "road", [["", "say", "t", "h0", null, "#@%&!"], ["gives a good account", "say", "h0", "t", null, "%&#@!"], ["wins by a mile", "laugh", "t", "h0", null, "#@%&#@%&#@!!"]]),
      F("tries to out-swear", "road", [["", "say", "h0", "t", null, "%&#@!"], ["she finishes with a prayer", "bless", "t", "h0"]])],
    teodor_half: [F("half of a song", "road", [["", "sing", "t", "h0"], ["knows the other half", "sing", "h0", "t", null, null, { sweet: true }]]), F("hums the end", "road", [["", "sing", "h0", "t"], ["he drops the lute", "fall", "x:lute", "t"]])],
    teodor_swap: [F("swaps song halves", "fire", [["", "sing", "t", "h0"], ["each walks off", "sing", "h0", "t", null, null, { sweet: true }]]), F("trades a verse", "fire", [["", "sing", "h0", "t"], ["a whole song", "sing", "t", "h0", null, null, { sweet: true }]])],
    marigold_supper: [F("sets up the pot", "fire", [["", "hold", "t", "h0", "pot"], ["is given the spoon", "give", "t", "h0", "spoon"]]), F("eats like a king", "fire", [["", "eat", "h0", "t", "bowl"], ["the pot is somehow", "give", "t", "h0", "bowl"]])],
    marigold_ingredient: [F("asks what", "fire", [["", "ask", "h0", "t", null, "What's the secret?"], ["taps her nose", "say", "t", "h0", null, "It's who is waiting."]]), F("will not tell", "fire", [["", "decline", "t", "h0", null, "Secret."], ["but lets", "give", "t", "h0", "spoon"]])],
    aldous_bridge: [F("holds a hill-road bridge", "bridge", [["", "say", "t", "h0", null, "A bout first!"], ["agrees, politely", "bow", "h0", "t"]]), F("none shall cross", "bridge", [["", "say", "t", "h0", null, "None shall cross! ...unless you've time for a bout?"], ["has.", "nod", "h0", "t", null, "I have."]])],
    aldous_bout: [F("wooden swords", "bridge", [["", "spar", "h0", "t"], ["the knight chalks", "say", "t", "h0", null, "Honourable!"]]), F("spar on the bridge", "bridge", [["", "spar", "t", "h0"], ["he marks the result", "count", "t", "h0"]])],
    aldous_tally: [F("reads the score aloud", "bridge", [["", "call", "t", null, null, "{n}: one! Puddle: many!"]]), F("proudly shows", "bridge", [["", "count", "t", "h0"], ["is surprised", "smile", "h0", "t"]])],
    withy_drill: [F("roadside drill", "road", [["", "teach", "t", "h0", null, "Stand! Turn! Kneel! Rise!"], ["comes out of it", "salute", "h0", "t"]]), F("inspection of kit", "road", [["", "look", "t", "h0", null, "Hm."], ["the kit passes", "nod", "t", "h0", null, "Passable."]])],
    withy_squad: [F("invisible squad", "road", [["", "say", "t", "h0", null, "My squad. Say hello."], ["greets all six", "salute", "h0", "t"]]), F("corporal nobody", "road", [["", "say", "t", "h0", null, "This is Corporal Nobody."], ["salutes him", "salute", "h0", "t", null, "Good. He likes you."]])],
    jory_news: [F("day's news", "road", [["", "give", "t", "h0", "scroll"], ["one scrap of it", "call", "t", "h0", null, "OYEZ! A rumour!"]]), F("oyez", "road", [["", "call", "t", "h0", null, "Oyez! Oyez!"], ["and tells the road", "smile", "h0", "t"]])],
    jory_bell: [F("ring the handbell", "road", [["", "give", "t", "h0", "bell"], ["rings it", "ring", "h0", "x:hen"]]), F("handbell", "road", [["", "give", "t", "h0", "bell"], ["the hour is not agreed", "ring", "h0", "t"]])],
    tansy_barn: [F("clear a barn", "farm", [["", "walk", "h0", "t"], ["the ferrets do the work", "hold", "h0", "t", "lamp"], ["and is thanked", "shake", "t", "h0"]]), F("at a farm gate", "farm", [["", "give", "x:farmer", "t", "coin"], ["the ferrets are paid", "give", "x:farmer", "t", "egg"]])],
    tansy_plague: [F("rats in the hundreds", "road", [["", "say", "t", "h0", null, "Rats. Hundreds of them."], ["and means to", "pay", "x:farmer", "t"]].slice(0, 1)), F("lets slip", "fire", [["", "say", "t", "h0", null, "Bold rats, out that way."], ["which interests", "look", "h0", "t"]])],
    mumchance_bear: [F("slipped the chain", "road", [["", "ask", "t", "h0", null, "Help! The bear's loose!"], ["before the bear blesses", "look", "h0", "t"]]), F("bishop's hat", "farm", [["", "walk", "h0", "m3"], ["finds the archbishop asleep", "sleep", "m3", "h0"]])],
    mumchance_mud: [F("up to its axles", "cart", [["", "fall", "x:cart", "h0"], ["puts a shoulder", "push", "h0", "m1"]]), F("out of a bog", "cart", [["", "push", "h0", "m1"], ["who mostly supervises", "nod", "m3", "h0"]])],
    mumchance_fire: [F("breathe a plume", "fire", [["", "teach", "m2", "h0"], ["loses only a few hairs", "laugh", "m2", "h0"]]), F("swallows a torch", "fire", [["", "teach", "m2", "h0"], ["and then tries it", "laugh", "h0", "m2"]])],
    mumchance_ask: [F("human cannonball", "tent", [["", "ask", "t", "h0", null, "Our Human Cannonball?"], ["says no, politely", "decline", "h0", "t", null, "No, thank you."], ["and is given a free sausage", "give", "t", "h0", "bun"]]),
      F("a place in the troupe", "tent", [["", "ask", "t", "h0", null, "Join the troupe?"], ["declines", "decline", "h0", "t", null, "No, thank you."], ["says the offer stands", "say", "t", "h0", null, "The offer stands!"]])],
    goblin_toll: [F("reads tol", "road", [["", "hold", "t", "h0", "note", "TOL!"], ["pays one copper", "pay", "h0", "t"]]), F("on a footbridge", "bridge", [["", "hold", "t", "h0", "rope", "TOL!"], ["pays a copper coin", "pay", "h0", "t"], ["and the goblins cheer", "cheer", "t", "h0"]])],
    goblin_shortcut: [F("bramble tunnel", "road", [["", "walk", "m3", "h0", null, "The Quick Way!"], ["it is quick", "fall", "h0", "m3"]]), F("a shortcut", "road", [["", "walk", "t", "h0"], ["'big hole,'", "say", "m2", "h0", null, "Big hole."]])],
    goblin_spoon: [F("presses a spoon", "road", [["", "give", "m1", "h0", "spoon"], ["it is the best spoon", "hold", "h0", "t", "spoon"]]), F("very old spoon", "road", [["", "give", "t", "h0", "spoon"], ["it is the highest honour", "bow", "t", "h0"]])],
    thimble_notes: [F("takes notes", "road", [["", "read", "t", "h0", "book"], ["'very dramatic,'", "say", "t", "h0", null, "Very dramatic. Could use a hat."]]), F("cross a stream", "water", [["", "walk", "h0", "t"], ["murmurs", "read", "t", "h0", "book", "Act Two."]])],
    thimble_play: [F("in a farmer's barn", "stage", [["", "sing", "t", "h0"], ["pennick plays", "bow", "m2", "h0"], ["standing ovation", "cheer", "crowd", "t"]]), F("at a crossroads", "stage", [["", "sing", "t", "h0"], ["it gets everything wrong", "cheer", "h0", "t"]])],
    thimble_prompt: [F("second villager", "stage", [["", "walk", "h0", "t"], ["do not know the lines", "say", "h0", "t", null, "Er... huzzah?"], ["awarded a round", "cheer", "crowd", "h0"]]), F("ghost of the old king", "stage", [["", "sleep", "m3", "t"], ["fills in", "say", "h0", "t", null, "Remember meee..."], ["it goes better", "cheer", "crowd", "h0"]])],
    thimble_hat: [F("pass a hat", "street", [["", "hold", "t", "crowd", "hat"], ["is given the first copper", "pay", "t", "h0"]]), F("town square", "street", [["", "hold", "t", "crowd", "hat"], ["a tip for", "pay", "t", "h0"]])],
    jingle_song: [F("two notes", "road", [["", "teach", "m1", "h0"], ["humming one of them", "sing", "h0", "t"]]), F("road hymn", "water", [["", "sing", "t", "h0"], ["a heron on the bank", "look", "h0", "t"]])],
    jingle_shrine: [F("dance their prayer", "shrine", [["", "dance", "t", "h0"], ["and tie a ribbon", "give", "t", "h0", "ribbon"]]), F("lays a flower", "shrine", [["", "give", "t", "h0", "flower"], ["the air turns still", "bless", "t", "h0"]])],
    jingle_lost: [F("wanders off", "farm", [["", "leave", "m2", "t"], ["finds the child", "carry", "h0", "m2"]]), F("lost a drum", "road", [["", "look", "h0", "t"], ["finds it in", "hold", "h0", "m3", "drum"]])],
    deepvein_tally: [F("counts the wagons", "cart", [["", "count", "t", "h0"], ["a third count", "count", "h0", "t"]]), F("ore sacks", "cart", [["", "count", "h0", "m1", "sack"], ["the total comes out", "cheer", "t", "h0"]])],
    deepvein_axle: [F("axle cracks", "cart", [["", "fall", "x:cart", "h0"], ["helps", "push", "h0", "m2"]]), F("front wheel splits", "cart", [["", "fall", "x:cart", "h0"], ["lends a back", "push", "h0", "t"], ["note it down", "read", "t", "h0", "ledger"]])],
    deepvein_gem: [F("presses a small rough stone", "cart", [["", "give", "t", "h0", "stone"], ["'not worth much,'", "say", "t", "h0", null, "Not worth much."]]), F("in payment", "cart", [["", "give", "m2", "h0", "stone"], ["'good for a pocket,'", "say", "m2", "h0", null, "Good for a pocket."]])],
    kettleby_mend: [F("mends the strap", "cart", [["", "mend", "t", "h0", "strap"], ["not a coin is taken", "decline", "t", "h0", null, "Put that away."]]), F("patches", "cart", [["", "mend", "m1", "h0", "bottle"], ["and is back inside", "leave", "m1", "h0"]])],
    kettleby_lesson: [F("temper a nail", "fire", [["", "teach", "m2", "h0"], ["makes three crooked", "mend", "h0", "m2"]]), F("mend a pot", "fire", [["", "mend", "h0", "t", "pot"], ["the pot holds", "bless", "t", "h0"]])],
    kettleby_gift: [F("small bright thing", "cart", [["", "give", "m3", "h0", "ring"], ["'a tinker's thank-you,'", "say", "t", "h0", null, "A tinker's thank-you."]]), F("wrapped in a sock", "cart", [["", "give", "t", "h0", "sack"], ["which they say", "nod", "t", "h0", null, "The proper way."]])],
    truant_quiz: [F("properties of a bog", "road", [["", "ask", "t", "h0", "book", "Properties of a bog?"], ["gets all of it right", "cheer", "m1", "h0"]]), F("settle a bet", "road", [["", "ask", "m1", "h0", null, "Trolls and bridges: who wins?"], ["settles it", "say", "h0", "m1", null, "The troll. Always."]])],
    truant_rumour: [F("banned library book", "road", [["", "say", "m2", "h0", "book", "Psst. Something odd out there..."]]), F("what the students say", "road", [["", "say", "m3", "h0", null, "Nobody's dared to check."]])],
    truant_fix: [F("come apart", "road", [["", "fall", "m4", "h0"], ["helps the students", "mend", "h0", "m4", "strap"]]), F("a tree is briefly a goose", "farm", [["", "fall", "m1", "h0"], ["stands between", "say", "h0", "x:farmer", null, "It'll be a tree again soon!"]])],
    offkey_duel: [F("singing duel", "road", [["", "sing", "t", "m1"], ["judges by volume", "say", "h0", "t", null, "The loud one wins."], ["everyone is offended", "laugh", "m1", "h0"]]), F("drunken crows", "road", [["", "sing", "t", "h0"], ["the crows have", "laugh", "h0", "t"]])],
    offkey_song: [F("seven verses", "road", [["", "sing", "t", "h0"], ["five different endings", "laugh", "h0", "t"]]), F("sings a ballad", "road", [["", "sing", "m1", "h0"], ["it is almost accurate", "smile", "h0", "m1"]])],
    offkey_tips: [F("holding a note", "road", [["", "teach", "m3", "h0"], ["finds", "sing", "h0", "m3", null, null, { sweet: true }]]), F("sits in on rehearsal", "fire", [["", "sing", "t", "h0"], ["harmonise", "sing", "h0", "t", null, null, { sweet: true }]])],
    offkey_ask: [F("sixth lead", "road", [["", "ask", "t", "h0", null, "Be our sixth lead!"], ["says no, politely", "decline", "h0", "t", null, "No, thank you."], ["is promised a verse", "sing", "t", "h0"]]),
      F("join their side", "road", [["", "ask", "t", "h0", null, "Join OUR side!"], ["declines every offer", "decline", "h0", "t", null, "No, thank you."], ["agree for the first time", "sing", "t", "h0", null, null, { sweet: true }]])],
    wetboots_cast: [F("a rod and a patch of bank", "water", [["", "give", "t", "h0", "rod", "Shh."], ["catches a boot", "fish", "h0", "t", "boots"]]), F("first rule of fishing", "water", [["", "say", "t", "h0", null, "Shh."], ["has a lovely, silent", "fish", "h0", "t"]])],
    wetboots_catch: [F("from that morning's catch", "water", [["", "give", "t", "h0", "fish"], ["has been given", "hold", "h0", "t", "fish"]]), F("lands a fine trout", "water", [["", "fish", "m2", "h0"], ["and gives half", "give", "m2", "h0", "fish"]])],
    wetboots_tale: [F("great pike", "fire", [["", "say", "t", "h0", null, "The Great Pike. Thirty years."]]), F("whispers", "water", [["", "say", "m3", "h0", null, "The pike's been seen..."]])],
    loom_tonic: [F("free sample", "road", [["", "give", "t", "h0", "tonic", "For the road!"], ["it tastes of pine", "drink", "h0", "t", "tonic"]]), F("famous tonic", "road", [["", "give", "t", "h0", "tonic"], ["it is mostly honey", "drink", "h0", "t", "tonic"]])],
    loom_cure: [F("hurts an ankle", "road", [["", "fall", "h0", "t"], ["the bandage helps", "mend", "t", "h0", "strap"], ["the bottle is for him", "drink", "t", "h0", "bottle"]]), F("real splint", "road", [["", "mend", "t", "h0", "strap", "Hold still."]])],
    loom_herb: [F("real herb", "road", [["", "look", "t", "h0", "flower"], ["has been given", "give", "t", "h0", "flower"]]), F("rare honest moment", "road", [["", "give", "t", "h0", "flower", "The only thing that mattered."]])],
    hetty_lamps: [F("trim a wick", "lamp", [["", "teach", "t", "h0"], ["goes into the dark", "light", "h0", "t"]]), F("every lamp has a name", "lamp", [["", "light", "t", "h0"], ["this one is", "say", "t", "h0", null, "This one is Patience."]])],
    hetty_dark: [F("climbs the post", "lamp", [["", "climb", "h0", "t"], ["relights it", "light", "h0", "t"], ["to a small cheer", "cheer", "t", "h0"]]), F("blown out", "lamp", [["", "look", "t", "h0"], ["helps", "light", "h0", "t"]])],
    hetty_rumour: [F("has not been lit", "lamp", [["", "say", "t", "h0", null, "Nobody will say why."]]), F("flicker for no reason", "lamp", [["", "say", "t", "h0", null, "I've stopped going there."]])],
    oake_forecast: [F("take cover", "road", [["", "say", "t", "h0", null, "Take cover."], ["twenty minutes later", "nod", "t", "h0"]]), F("predicts snow", "road", [["", "say", "t", "h0", null, "Snow. Next Tuesday."], ["nobody asked", "look", "h0", "t"]])],
    oake_shelter: [F("the pantry", "hill", [["", "walk", "t", "h0"], ["it is cold", "sleep", "h0", "t"]]), F("hollow beneath a root", "hill", [["", "walk", "t", "h0"], ["which he has kept dry", "sleep", "h0", "t"]])],
    oake_lore: [F("read the sky", "hill", [["", "teach", "t", "h0"], ["it is, to", "look", "h0", "t"]]), F("how birds act", "hill", [["", "teach", "t", "h0"], ["will now never", "nod", "h0", "t"]])],
    nimble_hand: [F("for buttons", "road", [["", "give", "t", "h0", "cards"], ["wins", "cheer", "h0", "t"]]), F("at cards for a copper", "road", [["", "give", "t", "h0", "cards"], ["he applauds", "pay", "t", "h0"]])],
    nimble_trick: [F("marked deck", "road", [["", "teach", "t", "h0", "cards"], ["spends the evening", "look", "h0", "t", "cards"]]), F("three signs", "road", [["", "teach", "t", "h0", "cards"]])],
    nimble_gift: [F("swears is lucky", "road", [["", "give", "t", "h0", "dice"], ["it is, as far as", "look", "h0", "t", "dice"]]), F("lucky die", "road", [["", "give", "t", "h0", "dice"], ["'never lose it,'", "say", "t", "h0", null, "Never lose it. Never gamble with it."]])],
    salt_course: [F("a line to the sea", "road", [["", "read", "t", "h0", "map"], ["it goes through", "laugh", "h0", "t"]]), F("take the wheel", "cart", [["", "walk", "h0", "t"], ["steers it into a hedge", "fall", "h0", "t"], ["and is told", "say", "t", "h0", null, "Best landing I've seen!"]])],
    salt_knots: [F("sailor's knots", "road", [["", "teach", "t", "h0", "knot"], ["and one that is", "laugh", "t", "h0"]]), F("read the stars", "road", [["", "teach", "t", "h0"], ["finds the pole star", "look", "h0", "t"]])],
    salt_rumour: [F("best rum on land", "road", [["", "say", "t", "h0", null, "Something dreadful out there. And rum!"]]), F("sea shanty", "fire", [["", "sing", "t", "h0"], ["ends, unexpectedly", "say", "t", "h0", null, "...beware!"]])],
  };
  function scripted(rec, ctx) {
    const vs = FINALE[rec.outcome] || ARC[rec.outcome];
    if (!vs || !vs.length) return null;
    const low = String(rec.line || "").toLowerCase(), n = ((ctx.heroes || [])[0] || {}).name || "friend";
    const v = vs.find((x) => low.includes(x.match) && x.cuts.every((c) => !c[0] || low.includes(c[0])));
    if (!v) return null;
    // a cut just after a name ("Tobias| says no") starts at its sentence instead
    const at = v.cuts.map((c) => {
      let k = c[0] ? low.indexOf(c[0]) : 0;
      const head = low.slice(0, k), b = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
      if (k && b >= 0 && k - b < 42 && !/[,;:]/.test(head.slice(b + 2))) k = b + 2;
      return k;
    });
    return v.cuts.map((c, i) => {
      const sub = cont(String(rec.line).slice(at[i], i + 1 < at.length ? at[i + 1] : undefined).trim());
      const say = c[5] ? c[5].replace(/\{n\}/g, n) : null;
      return Object.assign({ sub, set: v.set, act: c[1], a: c[2], b: c[3], prop: c[4] || null, say }, c[6] || {});
    });
  }

  // a hint is a hand staging for every wording of one event: "set | cast | rule; rule; ..."
  //   set: the scene (road, water, farm, ...) or empty; cast: who or what is there from the start (x:dog, x:washing, t);
  //   rule: "<key> = <act> <a> <b> <prop> 'words' <thing>:<behaviour>": key is a word the caption contains, #2 the second
  //   caption, or * every caption; a or b "-" keeps what the line reader found; "." in place of a prop keeps its prop.
  const hintCache = new Map();
  function hint(h) {
    if (hintCache.has(h)) return hintCache.get(h);
    const [set, cast, rules] = h.split("|").map((x) => (x || "").trim());
    const out = { set: set || null, cast: cast ? cast.split(/[ ,]+/).filter(Boolean) : [], rules: [] };
    for (const r of (rules || "").split(";").map((x) => x.trim()).filter(Boolean)) {
      const [key, rhs] = r.split("=").map((x) => x.trim()), say = (rhs.match(/'(.*)'/) || [])[1] || null;
      const toks = rhs.replace(/'.*'/, "").trim().split(/\s+/), beh = {}, plain = [];
      for (const t of toks) { const m = t.match(/^(x:[a-z_]+):([a-z]+)$/); if (m) beh[m[1]] = m[2]; else plain.push(t); }
      out.rules.push({ key: key.toLowerCase(), act: plain[0] || "-", a: plain[1] || "-", b: plain[2] || "-", prop: plain[3] || ".", say, beh });
    }
    hintCache.set(h, out);
    return out;
  }
  function applyHint(steps, h, n) {
    steps.forEach((s, i) => {
      if (h.set) s.set = h.set;
      const low = String(s.sub || "").toLowerCase(), rs = h.rules.filter((r) => r.key === "*" || r.key === "#" + (i + 1) || (r.key[0] !== "#" && low.includes(r.key)));
      for (const r of rs) {
        if (r.act !== "-") s.act = r.act;
        if (r.a !== "-") s.a = r.a;
        if (r.b !== "-") s.b = r.b === "none" ? null : r.b;
        if (r.prop !== ".") s.prop = r.prop === "none" ? null : r.prop;
        if (r.say) s.say = r.say.replace(/\{n\}/g, n);
        if (Object.keys(r.beh).length) s.beh = Object.assign({}, s.beh || {}, r.beh);
      }
    });
    if (steps.length && h.cast.length) steps[0].cast = h.cast;
    return steps;
  }
  function script(rec, ctx) {
    let steps = scripted(rec, ctx);
    if (!steps) { steps = parse(rec, ctx); const H = ctx.hints || {}, h = H[rec.outcome] || H[rec.place_hint] || H[rec.trav_hint]; if (h) applyHint(steps, hint(h), ((ctx.heroes || [])[0] || {}).name || ""); }
    // a caption that only goes on telling what the last one showed (nothing new happens in it) stays up under that act
    const merged = [];
    for (const st of steps) {
      const prev = merged[merged.length - 1];
      if (prev && st.act === "talk" && !st.say && !st.then && String(prev.sub || "").length + String(st.sub || "").length < 170) prev.sub = prev.sub + " " + String(st.sub || "").replace(/^\.\.\./, "");
      else merged.push(st);
    }
    // and one that only sets the scene for the act after it goes up with that act
    for (let i = merged.length - 2; i >= 0; i--) {
      const st = merged[i], nx = merged[i + 1];
      if (st.act === "talk" && !st.say && nx.act !== "talk" && String(st.sub || "").length + String(nx.sub || "").length < 170) { nx.sub = st.sub + " " + String(nx.sub || "").replace(/^[.][.][.]/, ""); merged.splice(i, 1); }
    }
    return { steps: merged, set: (merged.find((s) => s.set) || {}).set || null };
  }

  root.Stage = { script, hint, parse, split, prop, propIn, dishIn, dishProp, undish, PROPS: Object.keys(P), FINALE, ARC, NOUNS, verbOf, names };
})(typeof window !== "undefined" ? window : globalThis);
