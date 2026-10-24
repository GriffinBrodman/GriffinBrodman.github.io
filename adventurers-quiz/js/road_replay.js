/* Road replays: a road record acted out on the road strip, its line shown caption by caption in step with what the people do (a meeting, a finale, a broken wagon, a ferry, a shrine, the crossroads at night, a toll, an inn and its common room, a stretch with something on it), with synthesised sound; the record decides everything, the replay only shows it. */
/*
  INPUT: one road record (league/roads.py; road.md §4):
    { id, day, kind: "meet" | "repair" | "ferry" | "shrine" | "crossroads" | "toll" | "inn" | "strip" (any other kind, e.g. ford, milestone,
      ruin, waystation, event, plays as a strip that walks up to its place's set piece and whatever the line names: a cart, a mule,
      someone by the road, a turtle on a stepping stone, a heron, a crow),
      place: a place id (S.road.places[id] = { name, kind }) or { id, name, kind } or "",  biome, theme? (dungeon roads),
      weather: clear cloudy rain storm fog snow heat,  tod: dawn morning noon afternoon dusk evening night (or hour: 0-24),
      heroes: [ id | { id, name } ],  traveller?: id | name | { id, name, what, role, kind, members },  met_count?, arc_step?, arc_len?,
      branch?: repair help|walk|rob, toll pay|argue|ford, shrine candle|flower|lace|copper,  outcome: a word (rumour, gift, ring, wet, omen_good,
      omen_bad, ...),  line: the sentence it leaves,  say?: the traveller's spoken line,  fare?: copper,  tally?: the place's count,  card?: a tarot card name }

  RoadReplay.player(rec, opts) -> <figure> that plays while on screen, holds on its last beat, replays on click; spoken lines go through
    Speech when it is loaded (otherwise they are painted in). opts.heroes (id -> hero, default App.heroes), opts.places (id -> place).
  RoadReplay.frame(rec, t, opts) -> { w, h, data } (no DOM). RoadReplay.length(rec), beats(rec) -> [{ id, t0, t1 }], events(rec) -> sound cues.
  Needs road_scenes.js, road_art.js, stage.js and food_art.js (the pixel font); loaded with them through App.need (replay.js KIT.road);
  tavern.js, when loaded, draws the inns' common room.
*/
(function (root) {
  "use strict";
  const RS = root.RoadScenes, RA = root.RoadArt, RActs = root.Stage, K = RS.kit, FK = root.FoodArt.kit;
  const { blit, mix, clamp, lerp, bay, h2, hash, rng } = K;
  const W = 240, H = 136, FADE = 0.28;
  const ease = (t) => 1 - (1 - t) * (1 - t);
  const io = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const INK = "#2a1a12", PAPER = "#f4e8cc", PAPER2 = "#e2d0a8", RUBRIC = "#9a2a20", GOLD = "#d8a838", EDGE = "#6a4a2a";

  // ---------- the record, filled in ----------
  const S = () => (root.App && root.App.S) || (root.LD && root.LD.static) || {};
  const PLACE_OF = { ferry: "ferry", shrine: "shrine", crossroads: "crossroads", toll: "toll", inn: "inn" };
  function placeOf(rec, opts) {
    const p = rec.place, table = (opts && opts.places) || (S().road || {}).places || {};
    let o = p && typeof p === "object" ? p : table[p] || null;
    if (!o && typeof p === "string" && p) o = { id: p, name: p.replace(/_/g, " ") };
    o = Object.assign({ id: "", name: "" }, o || {});
    if (!o.kind) o.kind = PLACE_OF[rec.kind] || (RA.KINDS.includes(rec.kind) ? rec.kind : null);
    if (rec.place_kind) o.kind = rec.place_kind;
    if (rec.kind === "toll" && rec.branch === "ford" && o.kind === "ford") o.kind = "toll";
    return o;
  }
  // which drawing of a kind this place is: the Four Stones are standing stones, the Leaning Mile leans, Gallows Cross has its gallows
  function variantOf(r) {
    const k = r.place.kind, n = String(r.place.name || r.place.id || "").toLowerCase();
    if (k === "crossroads") return /gallows/.test(n) || (r.trav && r.trav.key === "lantern_lady") ? "gallows" : /stone/.test(n) ? "stones" : null;
    if (k === "milestone") return /cairn/.test(n) ? "cairn" : /lean/.test(n) ? "lean" : null;
    return null;
  }
  // what the line puts by the road besides the place: someone standing there, a cart, a mule, a turtle on a stone, a heron, a crow
  const WHO = /\b(pedlar|peddler|beggar|fiddler|harper|piper|drover|mapmaker|old adventurer|sellsword|gambler|card reader|reader|beekeeper|dentist|stranger|stile-keeper|watchman|wagoner|carter|farm wife|miner|courier|rider|page|old woman|old man|hermit|tinker|shepherd|knight|minstrel|monk|merchant|pilgrim|child|veteran|farmer)\b/i;
  function dressOf(r) {
    const s = String(r.line || ""), d = {};
    const who = r.trav ? null : s.match(WHO);
    if (who) d.who = who[1].toLowerCase();
    if (/\b(cart|wagon|wagoner|carter|haywain|menagerie)\b/i.test(s)) d.cart = true;
    if (/\bmules?\b/i.test(s)) d.mule = true;
    if (/\bturtle\b/i.test(s)) d.turtle = true;
    if (/\bheron\b/i.test(s)) d.heron = true;
    // "Rook" is also a hero's name, so only the lower-case bird counts
    if (/\b(ravens?|crows?|swallows?|magpies?)\b/i.test(s) || /\brooks?\b/.test(s)) d.bird = true;
    // someone fishing (a line, a rod, casting, a catch), but not a fish caught in the hands, a fish stew or catching up with someone
    if (FISH.test(s) && !/\b(both|bare|his|her|their) hands\b/i.test(s)) d.fish = /\blands? a\b|\bcatch(es)? (a|an|two|three)\b|\bwith a catch\b/i.test(s) ? "catch" : /\b(tugs?|bites?|nibbles?)\b/i.test(s) ? "bite" : "none";
    return d;
  }
  const FISH = /\bfish(es|ing)? (the|from|off|in|for|at)\b|\bfishing\b|\b(hangs?|drops?|casts?) (a |her |his |their )?line\b|\blines? hanging\b|\bcasts?\b|\brods?\b|\bfloats? drift|\bcatch(es)? (a|an|two|three|nothing|anything)\b|\bwith a catch\b|\blands? a (fine |fat |small |big |silver )?(trout|fish|pike|carp|eel|perch|roach)\b/i;
  // the hour in words, for a scene's caption
  function when(hr) {
    return hr < 5 ? "before dawn" : hr < 7.5 ? "at dawn" : hr < 11 ? "in the morning" : hr < 13.5 ? "at noon" : hr < 17 ? "in the afternoon" : hr < 19 ? "at dusk" : hr < 21.5 ? "in the evening" : "late at night";
  }
  function heroOf(x, opts) {
    const id = typeof x === "string" ? x : x.id, A = root.App || {}, hs = (opts && opts.heroes) || A.heroes || {};
    const h = Object.assign({ id, name: (x && x.name) || id }, hs[id] || {}, typeof x === "object" && x.look ? x : {});
    const cls = (S().classes || {})[h.cls] || null;
    let g = null;
    try { if (h.look) g = root.Art.heroGrid(h, 0, (A.heroLook && A.heroLook(h)) || cls || { look: { outfit: "leather", head: "none" } }); } catch (e) { g = null; }
    if (!g) g = RA.figure({ id: "hero:" + id, name: h.name, role: "adventurer" }, 0);
    return { id, name: h.name || id, h, g };
  }
  function norm(rec, opts) {
    const r = Object.assign({}, rec);
    r.kind = ["meet", "repair", "ferry", "shrine", "crossroads", "toll", "inn", "strip"].includes(r.kind) ? r.kind : "strip";
    r.place = placeOf(rec, opts);
    r.hr = RS.hourOf(rec);
    if (r.kind === "crossroads" && rec.tod === undefined && rec.hour === undefined) r.hr = 23;
    r.weather = r.weather || "clear";
    r.biome = r.biome || "plains";
    const hs = (r.heroes || []).slice(), li = hs.findIndex((x) => (typeof x === "string" ? x : x.id) === rec.lead);
    if (li > 0) hs.unshift(hs.splice(li, 1)[0]);
    r.cast = hs.slice(0, 4).map((x) => heroOf(x, opts));
    if (!r.cast.length) r.cast = [heroOf({ id: "someone", name: "someone" }, opts)];
    r.trav = r.traveller ? RA.spec(r.traveller) : null;
    r.pronoun = r.trav && r.traveller && ((S().road || {}).travellers || {})[typeof r.traveller === "string" ? r.traveller : r.traveller.id] ? S().road.travellers[typeof r.traveller === "string" ? r.traveller : r.traveller.id].pronoun : null;
    if (r.place.id && !r.place.keeper) { const pl = ((S().road || {}).places || {})[r.place.id]; if (pl && pl.keeper) r.place.keeper = pl.keeper; }
    // the crossroads at night is the Lantern Lady's scene: met there, it plays; any other crossroads is a plain stretch past its signpost
    const lady = r.trav && r.trav.key === "lantern_lady";
    if (r.kind === "meet" && lady) { r.kind = "crossroads"; if (rec.tod === "evening") r.hr = 23; }
    else if (r.kind === "crossroads" && !lady) r.kind = "strip";
    // a toll nobody paid walks over the bridge without the pay-the-keeper beat: the engine sends a free crossing as a strip at a
    // toll place, and an older record is a toll with no fee, no haggle and no copper in its line
    const fee = String(rec.line || "").match(/\b(\d+) copper\b/i);
    r.fare = rec.fare || (fee ? +fee[1] : 0);
    if (r.kind === "toll" && !r.fare && !["pay", "argue", "ford"].includes(rec.branch) && !/\bpays?\b[^.]*\btoll\b/i.test(String(rec.line || ""))) r.kind = "strip";
    r.seed = hash(r.id || r.kind);
    r.met = r.met_count || r.met || 0;
    r.say = r.say || (r.trav && r.trav.raw && r.trav.raw.say) || null;
    r.variant = variantOf(r);
    r.dress = dressOf(r);
    return r;
  }
  const specOf = (r, o) => {
    const s = Object.assign({ biome: r.biome, theme: r.theme, hour: r.hr, weather: r.weather, seed: r.biome + (r.theme || "") + (r.place.id || "") }, o || {});
    if (s.place_kind && s.place_kind === r.place.kind && r.variant) s.place_variant = r.variant;
    return s;
  };

  // ---------- drawing pieces ----------
  // after dark (and through the last of the dusk) the people on the road keep a moonlit edge, so dark kit doesn't sink into the night
  // and whoever stands in reach of a lamp, a fire or a lit door takes a warm edge on the side facing it; FIG marks the people's
  // pixels so the night's light pass darkens them a step less than the land
  let MOONRIM = null, LAMPS = [], FIG = null;
  function put(img, g, cx, feet, o) {
    o = o || {};
    if (!g) return;
    const fr = o.walk !== undefined ? RS.walker(g, o.walk) : g;
    let warm = null, best = 1e9;
    for (const [lx, ly, r] of LAMPS) {
      const dx = lx - cx, reach = r * 0.8 + fr.w / 2;
      if (Math.abs(dx) > fr.w / 4 && Math.abs(dx) < reach && Math.abs(dx) < best && ly > feet - fr.h - 30) { best = Math.abs(dx); warm = { side: dx > 0 ? 1 : -1, col: "#e8a050" }; }
    }
    const rim = warm && warm.side > 0 ? null : MOONRIM;
    blit(img, fr, Math.round(cx - fr.w / 2), Math.round(feet - fr.h + 1 + (o.dy || 0)), { G: o.G, depth: 0, flip: o.flip, alpha: o.alpha, clip: o.clip, map: o.map, rim, warm, mark: FIG });
  }
  function text(img, s, x, y, col, o) { return FK.text(img, s, x, y, col, o); }
  const tw = (s, o) => FK.textWidth(s, o);
  function wrap(s, maxW) {
    const out = [];
    let line = "";
    for (const w of String(s || "").split(/\s+/)) {
      if (!w) continue;
      const t = line ? line + " " + w : w;
      if (tw(t) > maxW && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }
  function panel(img, x, y, w, h, o) {
    o = o || {};
    x = Math.round(x); y = Math.round(y);
    img.rect(x + 2, y + 2, w, h, "#120c08", 0.45);
    img.rect(x - 1, y - 1, w + 2, h + 2, o.edge || EDGE);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) img.px(x + i, y + j, (i + j) % 7 === 0 && bay(i, j) < 0.3 ? PAPER2 : o.fill || PAPER);
    img.rect(x, y, w, 1, "#fff8e4"); img.rect(x, y + h - 1, w, 1, PAPER2);
    if (o.band) img.rect(x, y, w, o.band, o.bandCol || GOLD);
  }
  function caption(img, s, a) {
    if (!s) return;
    s = s.toUpperCase();
    text(img, s, 5, 12, "#f6ead0", { outline: "#1a1210" });
  }
  // a speech bubble over a speaker's head (x, y), kept on the stage
  function bubble(img, s, x, y, o) {
    o = o || {};
    const lines = wrap(s, o.maxW || 120), w = Math.max(...lines.map((l) => tw(l))) + 10, h = lines.length * 11 + 5;
    // no room over the speaker's head (someone up on a balcony or a stage): the bubble sits beside them, its tail pointing in
    const side = y - h - 6 < 3;
    let bx = Math.round(side ? (x > W / 2 ? x - w - 12 : x + 12) : clamp(x - w / 2, 3, W - w - 3)), by = Math.round(side ? clamp(y - h / 2 + 4, 3, H - h - 3) : clamp(y - h - 6, 3, H - h - 3));
    bx = Math.round(clamp(bx, 3, W - w - 3));
    if (o.a !== undefined && o.a < 1) { by += Math.round((1 - o.a) * 4); }
    panel(img, bx, by, w, h, { edge: "#2a1a12" });
    if (side) {
      const right = x > bx + w, ty = clamp(Math.round(y + 4), by + 3, by + h - 4), ex = right ? bx + w : bx - 1;
      for (let k = 0; k < 4; k++) for (let j = -2 + k; j <= 2 - k; j++) img.px(ex + (right ? k : -k), ty + j, k === 0 ? PAPER : "#2a1a12");
    } else {
      const tx = clamp(Math.round(x), bx + 4, bx + w - 5);
      for (let k = 0; k < 4; k++) for (let i = -2 + k; i <= 2 - k; i++) img.px(tx + i - k, by + h + k, k === 0 ? PAPER : "#2a1a12");
      img.px(tx - 2, by + h, "#2a1a12"); img.px(tx + 2, by + h, "#2a1a12");
    }
    lines.forEach((l, i) => text(img, l, bx + 5, by + 11 + i * 11, o.col || INK));
  }
  function pop(img, s, x, y, lt) {
    const k = seg(lt, 0, 0.18), dy = Math.round((1 - ease(k)) * 4);
    if (k <= 0) return;
    panel(img, x - 4, y - 11 + dy, 9, 11, { edge: "#2a1a12" });
    text(img, s, x - (s === "!" ? 0 : 2), y - 2 + dy, RUBRIC);
  }
  function tag(img, s, x, y, col) { text(img, s.toUpperCase(), x, y, col || "#ffe08a", { outline: "#2a1a12", center: true }); }
  function dust(img, x, y, lt, n) { for (let i = 0; i < (n || 4); i++) { const ph = (lt * 1.6 + i / (n || 4)) % 1, px = x - ph * 10 - i, py = y - ph * 4; img.px(px, py, "#d8c8a8", (1 - ph) * 0.6); img.px(px + 1, py, "#d8c8a8", (1 - ph) * 0.4); } }
  function glow(img, x, y, rad, col, a) { for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) { const d = Math.hypot(i, j) / rad; if (d < 1) img.px(x + i, y + j, col, a * (1 - d) * (1 - d)); } }
  function coin(img, x, y, ph) { const w = Math.max(0, Math.round(Math.abs(Math.cos(ph)) * 2)); for (let j = -2; j <= 2; j++) for (let i = -w; i <= w; i++) img.px(x + i, y + j, Math.abs(j) === 2 || Math.abs(i) === w ? "#8a5a20" : "#d8903a"); if (w > 0) img.px(x - 1, y - 1, "#ffd890"); }
  function darken(img, a, col) { for (let i = 0; i < img.w * img.h; i++) img.px(i % img.w, Math.floor(i / img.w), col || "#120c08", a); }

  // the traveller as drawn on the road: a crew walks as its members, the face of it in front
  function travFigs(r) {
    const sp = r.trav;
    if (!sp) return [];
    if (sp.kind === "crew") {
      const ms = (sp.members || []).slice(0, 3);
      return ms.map((m, i) => ({ g: RA.figure(sp.raw, 0, i), dx: i * 15 }));
    }
    return [{ g: RA.figure(sp.raw, 0), dx: 0 }];
  }
  function drawTrav(img, r, x, feet, o) {
    o = o || {};
    const figs = travFigs(r);
    figs.slice().reverse().forEach((f, i) => put(img, f.g, x + (o.flip ? f.dx : -f.dx), feet + (figs.length - 1 - i) % 2, Object.assign({}, o, { walk: o.walk !== undefined ? o.walk + i : undefined })));
  }
  function drawBand(img, r, x, feet, o) {
    o = o || {};
    r.cast.forEach((c, i) => {
      const cx = x - i * 15 * (o.flip ? -1 : 1);
      put(img, c.g, cx, feet + (i % 2), Object.assign({}, o, { walk: o.walk !== undefined ? o.walk + i * 2 : undefined, dy: (o.hop && i === 0 ? -o.hop : 0) }));
    });
  }

  // ---------- the cart (the broken wagon) and the raft, at people scale ----------
  let cartG = null, wheelG = [];
  function cartGrid() {
    if (cartG) return cartG;
    cartG = K.painted(48, 30, { wood: "#8a5a32", woodd: "#5a3a20", canvas: "#e8dcc0", hoop: "#7a5a3a", sack: "#c8a870", apple: "#c04a3a" }, (P) => {
      P.layer = 1;
      P.poly([[4, 2], [40, 2], [44, 18], [0, 18]], "canvas", (x, y) => 0.3 - (y - 2) * 0.03 + ((Math.round(x) % 9) === 0 ? -0.35 : 0));
      for (const x of [9, 22, 35]) P.rect(x, 3, 1, 15, "hoop", -0.1);
      P.layer = 2;
      P.rect(0, 18, 46, 6, "wood", (x, y) => (y === 18 ? 0.4 : x % 8 === 0 ? -0.3 : 0));
      P.ell(6, 16, 3, 2.4, "sack", { s: 0.2 }); P.ell(41, 16, 2, 2, "apple", { s: 0.3 });
      P.rect(44, 21, 4, 1, "woodd", 0);
    });
    return cartG;
  }
  function wheelGrid(k) {
    k = ((k % 2) + 2) % 2;
    if (wheelG[k]) return wheelG[k];
    wheelG[k] = K.painted(13, 13, { rim: "#5a3a20", hub: "#8a6a42", spoke: "#7a5232" }, (P) => {
      P.ell(6.5, 6.5, 6, 6, "rim", { s: 0, fn: (x, y, s) => ((x - 6) ** 2 + (y - 6) ** 2 < 14 ? false : s) });
      for (let a = 0; a < 4; a++) { const an = a * Math.PI / 4 + k * Math.PI / 8; P.line(6.5 - Math.cos(an) * 4.5, 6.5 - Math.sin(an) * 4.5, 6.5 + Math.cos(an) * 4.5, 6.5 + Math.sin(an) * 4.5, "spoke", 0); }
      P.ell(6.5, 6.5, 1.6, 1.6, "hub", { s: 0.3 });
    });
    return wheelG[k];
  }
  // tilt: the near-side drop where the wheel came off (0 level), rolled: wheel turn; off: where the loose wheel lies
  function cart(img, x, feet, o) {
    o = o || {};
    const g = cartGrid(), tilt = o.tilt || 0, G = o.G;
    const x0 = Math.round(x - 24), y0 = feet - 34;
    // the near end sags where its wheel came off: each column drops by its share of the tilt
    for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) { const c = g.px[j * g.w + i]; if (c) img.px(x0 + i, y0 + 4 + j + Math.round(tilt * (1 - i / (g.w - 1))), G ? G(c, 0) : c); }
    const turn = o.roll || 0;
    if (!o.off) blit(img, wheelGrid(Math.floor(turn)), x0 + 1, feet - 12 + Math.round(tilt), { G });
    blit(img, wheelGrid(Math.floor(turn) + 1), x0 + 33, feet - 12, { G });
    if (o.off) { const [wx, wy] = o.off; blit(img, wheelGrid(0), wx - 6, wy - 12, { G }); }
  }
  // the raft with the ferryman poling it
  function raft(img, I, x, o) {
    o = o || {};
    const g = K.pieceGrid("raft", false, 0), y = I.feet - 4 + Math.round(Math.sin((o.t || 0) * 2.4) * 0.8);
    blit(img, g, Math.round(x - 20), y, { G: I.Gf, depth: 0.05 });
    return y + 2;
  }

  // ---------- the cards: the recognition card on a repeat meeting, the line it leaves ----------
  function knownCard(img, r, lt) {
    const k = ease(seg(lt, 0, 0.35)), sp = r.trav, crew = sp.kind === "crew", bw = crew ? 72 : 40;
    const w = bw + 96, h = 50, x = W - w - 6, y = Math.round(lerp(-h - 4, 18, k));
    panel(img, x, y, w, h, { band: 3, bandCol: crew ? "#3a6a8a" : GOLD });
    const b = crew ? RA.crew(sp.raw) : RA.bust(sp.raw);
    blit(img, b, x + 4, y + 6);
    img.rect(x + 3, y + 5, bw + 2, 1, EDGE); img.rect(x + 3, y + 46, bw + 2, 1, EDGE); img.rect(x + 3, y + 5, 1, 42, EDGE); img.rect(x + 4 + bw, y + 5, 1, 42, EDGE);
    const tx = x + bw + 9, room = w - bw - 14, name = sp.name.replace(/^the /, "The ");
    const nl = wrap(name, room).slice(0, 2), wl = wrap(sp.what || "", room).slice(0, 3 - nl.length);
    nl.forEach((l, i) => text(img, l, tx, y + 14 + i * 10, RUBRIC));
    wl.forEach((l, i) => text(img, l, tx, y + 14 + (nl.length + i) * 10, "#6a5236"));
    const yy = y + h - 5;
    if (r.met > 1) {
      const pips = Math.min(r.met, 6);
      text(img, "met", tx, yy, INK);
      for (let i = 0; i < pips; i++) { const px = tx + 19 + i * 6, on = seg(lt, 0.4 + i * 0.08, 0.5 + i * 0.08) > 0; img.rect(px, yy - 6, 4, 5, on ? GOLD : PAPER2); img.rect(px, yy - 6, 4, 1, on ? "#ffe08a" : PAPER2); }
      if (r.met > 6) text(img, "+", tx + 19 + 6 * 6, yy, INK);
    } else text(img, "first meeting", tx, yy, INK);
    if (r.arc_step) {
      // the arc's parts as knots on a cord, bottom right; the newest one blinks in
      const n = Math.max(r.arc_len || 4, r.arc_step), ax = x + w - 5 - n * 5;
      img.rect(ax - 1, yy - 4, n * 5, 1, "#b8a07a");
      for (let i = 0; i < n; i++) { const done = i < r.arc_step, cur = i === r.arc_step - 1, blink = cur && Math.floor(lt * 3) % 2 === 0 && lt < 1.6; img.rect(ax + i * 5, yy - 5, 3, 3, done && !blink ? RUBRIC : "#c8b48a"); }
    }
  }
  function lineCard(img, r, lt) {
    darken(img, 0.45 * seg(lt, 0, 0.4));
    const k = ease(seg(lt, 0.1, 0.5)), w = 196, lines = wrap(r.line || "", w - 58).slice(0, 8), h = Math.max(54, 30 + lines.length * 11), x = (W - w) / 2, y = Math.round(lerp(H + 4, (H - h) / 2, k));
    panel(img, x, y, w, h, { band: 3 });
    const title = r.trav && r.kind === "meet" ? r.trav.name : r.place.name || ({ strip: "On the road", repair: "A broken wagon", ferry: "The ferry", shrine: "A wayside shrine", crossroads: "The crossroads", toll: "The toll", inn: "The inn" }[r.kind]);
    const tl = wrap(cap(title), w - 58)[0] || "";
    text(img, tl, x + 50, y + 15, RUBRIC);
    img.rect(x + 50, y + 18, w - 58, 1, PAPER2);
    lines.forEach((l, i) => text(img, l, x + 50, y + 30 + i * 11, INK, {}));
    const pic = r.trav && (r.kind === "meet" || r.kind === "crossroads") && r.trav.kind !== "crew" ? RA.bust(r.trav.raw) : null;
    const kind = r.place.kind && RA.KINDS.includes(r.place.kind) ? r.place.kind : r.kind === "repair" ? null : RA.KINDS.includes(r.kind) ? r.kind : null;
    if (pic) { img.rect(x + 5, y + 7, 42, 42, EDGE); blit(img, pic, x + 6, y + 8); }
    else if (kind) { const ic = RA.icon(kind); img.rect(x + 9, y + 11, 36, 36, PAPER2); blit(img, RA.grid.crop(ic, 0, 0, 16, 16), x + 19, y + 21); }
    else {
      // a plain stretch or a wagon has no place to show: the one whose line it is stands in the frame, on a scrap of road
      const g = r.cast[0].g;
      img.rect(x + 5, y + 7, 42, 42, EDGE); img.rect(x + 6, y + 8, 40, 40, "#c8dcd8"); img.rect(x + 6, y + 36, 40, 12, "#8aa070"); img.rect(x + 6, y + 40, 40, 5, "#b89a6a");
      blit(img, g, Math.round(x + 26 - g.w / 2), y + 45 - g.h, { clip: (xx, yy) => yy >= y + 8 && yy < y + 48 && xx >= x + 6 && xx < x + 46 });
    }
    if (r.day && tw(tl) < w - 90) text(img, "Day " + r.day, x + w - 6 - tw("Day " + r.day), y + 15, "#8a6a42");
  }
  const cap = (s) => String(s || "").replace(/^./, (c) => c.toUpperCase());

  // ---------- beats ----------
  function B(id, dur, o) { return Object.assign({ id, dur, sfx: [] }, o); }
  // positions: the band comes in from the left, whoever they meet from the right
  const FEET = () => RS.scene({ biome: "plains" }, W, H).info.feet;
  function walkIn(r, lt, from, to, dur) { return lerp(from, to, io(seg(lt, 0, dur))); }

  function repairBeats(r) {
    const carter = r.trav || RA.spec({ id: "carter:" + r.id, name: "the carter", role: "carter" });
    const cg = RA.figure(carter.raw, 0), branch = r.branch || "help";
    const bg = specOf(r);
    const CX = 160, off = [CX - 34, 0];
    const base = (img, I, o) => { cart(img, CX, I.feet, Object.assign({ G: I.Gf, tilt: 5, off: [CX - 34, I.feet + 2] }, o || {})); };
    const out = [
      B("stuck", 2.8, { spec: bg, cap: r.place.name || "a wagon in the road", act(img, lt, I) {
        base(img, I);
        put(img, cg, CX + 34, I.feet, { flip: true, G: I.Gf });
        drawBand(img, r, walkIn(r, lt, -10, 80, 2.2), I.feet, { walk: lt < 2.2 ? Math.floor(lt * 6) : undefined, G: I.Gf });
      }, bubble: (lt) => (lt > 1.4 ? { text: "Help?", x: CX + 34, y: FEET() - 34 } : null), sfx: [[0.1, "steps", 2], [1.4, "blip"]] }),
      B("choice", 2.4, { spec: bg, act(img, lt, I) { base(img, I); put(img, cg, CX + 34, I.feet, { flip: true, G: I.Gf }); drawBand(img, r, 80, I.feet, { G: I.Gf }); },
        ui(img, lt) {
          const opts = [["help", "help"], ["walk", "walk on"], ["rob", "rob it"]];
          panel(img, 54, 18, 76, 46, {});
          opts.forEach(([k, label], i) => { const on = k === branch, a = seg(lt, 0.2 + i * 0.15, 0.4 + i * 0.15); if (a <= 0) return; text(img, (on && lt > 1.1 ? "> " : "  ") + label, 60, 32 + i * 12, on ? (k === "rob" ? RUBRIC : INK) : "#b4a07a"); });
        }, sfx: [[1.1, "tick"]] }),
    ];
    if (branch === "help") out.push(
      B("heave", 2.4, { spec: bg, cap: "heave", act(img, lt, I) {
        const lift = Math.max(0, Math.sin(lt * 5)) * 2 + seg(lt, 1.2, 2.2) * 2;
        cart(img, CX, I.feet, { G: I.Gf, tilt: 5 - lift, off: [CX - 34, I.feet + 2] });
        drawBand(img, r, CX - 30, I.feet, { G: I.Gf, dy: lt % 0.4 < 0.2 ? 1 : 0 });
        put(img, cg, CX + 34, I.feet, { flip: true, G: I.Gf });
        if (lt > 0.5) for (let i = 0; i < 2; i++) img.px(CX - 26 + i * 4, I.feet - 36 - ((lt * 8 + i * 3) % 4), "#c8e4f8");
      }, sfx: [[0.3, "grunt"], [1.2, "grunt"], [2.0, "creak"]] }),
      B("mend", 2.6, { spec: bg, cap: "mending", act(img, lt, I) {
        const k = ease(seg(lt, 0.2, 1.4));
        cart(img, CX, I.feet, { G: I.Gf, tilt: 1, off: k < 1 ? [lerp(CX - 34, CX - 23, k), I.feet + 2 - Math.round(Math.sin(k * Math.PI) * 3)] : null, roll: k * 3 });
        drawBand(img, r, CX - 40, I.feet, { G: I.Gf });
        put(img, cg, CX + 34, I.feet, { flip: true, G: I.Gf });
        if (lt > 1.5) for (let i = 0; i < 4; i++) { const ph = (lt * 3 + i * 0.25) % 1; img.px(CX - 22 + Math.cos(i * 2) * ph * 5, I.feet - 8 - ph * 6, "#ffe08a", 1 - ph); }
      }, sfx: [[0.4, "roll"], [1.6, "hammer"], [2.0, "hammer"], [2.3, "hammer"]] }),
      B("upright", 2.0, { spec: bg, act(img, lt, I) { cart(img, CX, I.feet, { G: I.Gf }); drawBand(img, r, CX - 40, I.feet, { G: I.Gf, hop: lt < 0.3 ? 2 : 0 }); put(img, cg, CX + 34, I.feet, { flip: true, G: I.Gf, dy: lt > 0.4 && lt < 0.7 ? -2 : 0 }); },
        bubble: (lt) => (lt > 0.4 ? { text: "Ha!", x: CX + 34, y: FEET() - 34 } : null), sfx: [[0.4, "cheer"]] }),
      B("ride", 3.0, { spec: bg, cap: "a ride in the back", act(img, lt, I) {
        const k = io(seg(lt, 0.2, 3.0)), x = lerp(CX, 300, k);
        r.cast.forEach((c, i) => put(img, c.g, x - 12 + i * 8, I.feet - 14 + (i % 2), { G: I.Gf, dy: Math.round(Math.sin(lt * 9 + i)) }));
        cart(img, x, I.feet, { G: I.Gf, roll: lt * 6 });
        put(img, cg, x + 30, I.feet - 10, { G: I.Gf });
      }, sfx: [[0.2, "roll"]] }));
    else if (branch === "rob") out.push(
      B("sneak", 2.6, { spec: bg, cap: "nobody looking", act(img, lt, I) {
        base(img, I);
        put(img, cg, CX + 34, I.feet, { G: I.Gf });
        drawBand(img, r, walkIn(r, lt, 80, CX - 22, 2.2), I.feet + 1, { walk: Math.floor(lt * 3), G: I.Gf });
      }, sfx: [[0.3, "tiptoe"]] }),
      B("grab", 2.6, { spec: bg, act(img, lt, I) {
        base(img, I);
        put(img, cg, CX + 34, I.feet, { flip: lt > 0.6, G: I.Gf, dy: lt > 0.6 && lt < 0.8 ? -2 : 0 });
        const x = lt < 0.7 ? CX - 22 : lerp(CX - 22, -60, io(seg(lt, 0.8, 2.4)));
        drawBand(img, r, x, I.feet, { flip: lt > 0.7, walk: lt > 0.7 ? Math.floor(lt * 10) : undefined, G: I.Gf });
        if (lt > 0.7) { coin(img, x + 8, I.feet - 22, lt * 8); coin(img, x + 3, I.feet - 26, lt * 8 + 1); }
      }, ui(img, lt) { pop(img, "!", CX + 34, FEET() - 34, lt - 0.6); }, sfx: [[0.6, "blip"], [0.8, "coins"], [0.9, "steps", 1.5]] }));
    else out.push(
      B("pass", 3.2, { spec: bg, act(img, lt, I) {
        base(img, I);
        put(img, cg, CX + 34, I.feet, { flip: lt < 1.6, G: I.Gf, dy: lt > 1.6 ? 1 : 0 });
        drawBand(img, r, walkIn(r, lt, 80, 300, 3.2), I.feet + 3, { walk: Math.floor(lt * 6), G: I.Gf });
      }, bubble: (lt) => (lt > 2.0 ? { text: "...", x: CX + 34, y: FEET() - 33 } : null), sfx: [[0.1, "steps", 3]] }));
    out.push(B("line", 3.6, { spec: bg, act(img, lt, I) { if (branch !== "help") base(img, I); else cart(img, 300, I.feet, { G: I.Gf }); }, ui(img, lt) { lineCard(img, r, lt); }, sfx: [[0.15, "scribble"]] }));
    return out;
  }

  function ferryBeats(r) {
    const bg = specOf(r, { place_kind: "ferry" }), I0 = RS.scene(bg, W, H).info, P = I0.place;
    const man = r.trav || RA.spec({ id: "ferryman:" + (r.place.id || r.id), name: "the ferryman", role: "ferryman" });
    const mg = RA.figure(man.raw, 0), fare = r.fare || 2;
    const [x0, x1] = P.river;
    const L = x0 + 2, R = x1 - 2, mid = (x0 + x1) / 2;
    const raftAt = (lt, a, b, d) => lerp(a, b, io(seg(lt, 0, d)));
    const crew = (img, I, x, y, o) => r.cast.forEach((c, i) => put(img, c.g, x - 8 + i * 9, y + (i % 2), Object.assign({ G: I.Gf }, o || {})));
    return [
      B("bell", 2.8, { spec: bg, cap: r.place.name || "the ferry", act(img, lt, I) {
        const sw = lt > 0.9 ? Math.sin((lt - 0.9) * 9) * Math.exp(-(lt - 0.9)) * 2 : 0;
        drawBand(img, r, walkIn(r, lt, -20, P.bell[0] - 4, 0.9), I.feet, { walk: lt < 0.9 ? Math.floor(lt * 6) : undefined, G: I.Gf });
        if (lt > 0.9) for (let k = 0; k < 3; k++) { const ph = ((lt - 0.9) * 0.9 + k / 3) % 1, rr = 4 + ph * 18; for (let a = -1.1; a < 1.1; a += 0.12) img.px(P.bell[0] + 4 + Math.cos(a) * rr, P.bell[1] + 2 + Math.sin(a) * rr * 0.6, "#f4e8cc", (1 - ph) * 0.7); }
        img.px(P.bell[0] + 4 + Math.round(sw), P.bell[1] + 6, "#3a2a20");
      }, sfx: [[1.0, "bell"], [1.7, "bell"]] }),
      B("boat", 3.0, { spec: bg, cap: "the ferryman", act(img, lt, I) {
        drawBand(img, r, P.bell[0] - 4, I.feet, { G: I.Gf });
        const x = raftAt(lt, R - 18, L + 22, 2.8), y = raft(img, I, x, { t: lt });
        put(img, mg, x + 12, y, { flip: true, G: I.Gf });
        poleAt(img, I, x + 6, y, lt);
        if (r.hr >= 17.4 || r.weather === "fog" || r.hr < 6.5) glow(img, x + 4, y - 22, 8, "#ffc860", 0.5);
      }, sfx: [[0.2, "pole"], [1.4, "pole"]] }),
      B("cross", 3.2, { spec: bg, act(img, lt, I) {
        const x = raftAt(lt, L + 22, mid, 3.2), y = raft(img, I, x, { t: lt });
        crew(img, I, x - 6, y);
        put(img, mg, x + 12, y, { G: I.Gf });
        poleAt(img, I, x + 18, y, lt);
      }, sfx: [[0.2, "water", 3]] }),
      B("below", 3.4, { spec: bg, cap: "something below", act(img, lt, I) {
        const x = mid, y = raft(img, I, x, { t: lt * 2.5 });
        // a long dark back passes under the raft from right to left, one eye, then a swirl
        const bx = lerp(R + 30, L - 30, seg(lt, 0.2, 3.0)), by = I.roadTop + 14;
        for (let j = -5; j <= 5; j++) for (let i = -34; i <= 34; i++) { const d = (i / 34) ** 2 + (j / 5) ** 2; const px = Math.round(bx + i), py = by + j; if (d < 1 && px > x0 + 1 && px < x1 - 1 && py < I.h) img.px(px, py, "#0e1a2a", 0.55 * (1 - d * 0.6)); }
        if (lt > 1.2 && lt < 1.8) { img.px(bx - 28, by - 2, "#e8d870"); img.px(bx - 27, by - 2, "#1a1a1a"); }
        crew(img, I, x - 6, y, { dy: lt > 1 && lt < 2 ? Math.round(Math.sin(lt * 20)) : 0 });
        put(img, mg, x + 12, y, { G: I.Gf });
      }, ui(img, lt) { if (lt > 1.1) pop(img, "!", mid - 6, I0.roadTop - 34, lt - 1.1); }, sfx: [[0.3, "rumble"], [1.1, "blip"], [2.4, "bubbles"]] }),
      B("fare", 2.8, { spec: bg, act(img, lt, I) {
        const x = raftAt(lt, mid, R - 22, 1.2), y = raft(img, I, x, { t: lt });
        crew(img, I, x - 6, y);
        put(img, mg, x + 12, y, { G: I.Gf, flip: lt > 1.2 });
        for (let i = 0; i < Math.min(fare, 4); i++) { const k = seg(lt, 1.4 + i * 0.25, 1.9 + i * 0.25); if (k > 0 && k < 1) coin(img, lerp(x - 2, x + 10, k), y - 22 - Math.sin(k * Math.PI) * 10, lt * 9); }
      }, ui(img, lt) { if (lt > 1.4) tag(img, fare + " copper", 120, 26); }, sfx: [[1.4, "coin"], [1.65, "coin"], [1.9, "coin"]] }),
      B("line", 3.6, { spec: bg, ui(img, lt) { lineCard(img, r, lt); }, sfx: [[0.15, "scribble"]] }),
    ];
  }
  function poleAt(img, I, x, y, lt) { const a = Math.sin(lt * 2.4) * 3; img.line(x + a, y - 26, x - a - 3, I.roadTop + 14, I.G("#6a4a2a", 0)); }

  function shrineBeats(r) {
    const bg = specOf(r, { place_kind: "shrine", place_x: 0.66 }), P = RS.scene(bg, W, H).info.place, branch = r.branch || "candle";
    const good = !/bad|ill|gutter/.test(String(r.outcome || "")), hx = P.candle[0] - 24;
    const lit = (img, I, k, gutter, lt) => {
      const [cx, cy] = P.candle;
      const fl = gutter ? Math.max(0, 1 - k * 1.2) : 1;
      if (k <= 0) return;
      glow(img, cx, cy - 2, Math.round(6 + 10 * k * fl), "#ffc860", 0.55 * fl);
      const hh = gutter ? Math.round(2 * fl + (Math.sin(lt * 30) > 0 ? 1 : 0)) : 3 + Math.round(k);
      for (let j = 0; j < hh; j++) img.px(cx, cy - 2 - j, j === 0 ? "#fff0a0" : "#ffb040");
      if (gutter && k > 0.7) for (let i = 0; i < 4; i++) { const ph = (lt * 0.7 + i / 4) % 1; img.px(cx + Math.sin(ph * 6 + i) * 2, cy - 4 - ph * 14, "#9aa0a8", (1 - ph) * 0.6); }
    };
    const kneel = (img, I, lt) => drawBand(img, r, hx, I.feet + 3, { G: I.Gf });
    return [
      B("arrive", 2.6, { spec: bg, cap: r.place.name || "a wayside shrine", act(img, lt, I) { drawBand(img, r, walkIn(r, lt, -20, hx, 2.2), I.feet, { walk: lt < 2.2 ? Math.floor(lt * 6) : undefined, G: I.Gf }); }, sfx: [[0.1, "steps", 2]] }),
      B("offer", 2.6, { spec: bg, cap: { candle: "a copper for the saint", flower: "a flower", lace: "a bootlace", copper: "a copper" }[branch] || "an offering", act(img, lt, I) {
        kneel(img, I, lt);
        const k = seg(lt, 0.6, 1.4), [bx, by] = P.bowl;
        if (k > 0 && k < 1) { const x = lerp(hx + 6, bx, k), y = by - 8 - Math.sin(k * Math.PI) * 10; if (branch === "flower") { img.px(x, y, "#f0e070"); img.px(x - 1, y, "#f4f0e8"); img.px(x + 1, y, "#f4f0e8"); img.px(x, y - 1, "#f4f0e8"); } else if (branch === "lace") img.line(x - 2, y, x + 2, y + 1, "#5a3a22"); else coin(img, x, y, lt * 10); }
      }, sfx: [[1.4, branch === "flower" || branch === "lace" ? "soft" : "coin"]] }),
      B("candle", 2.8, { spec: bg, cap: "a candle lit", act(img, lt, I) { kneel(img, I, lt); lit(img, I, seg(lt, 0.4, 1.6), false, lt); }, sfx: [[0.4, "strike"], [0.6, "candle"]] }),
      B("omen", 3.0, { spec: bg, cap: good ? "the flame stood straight" : "the flame guttered", act(img, lt, I) {
        kneel(img, I, lt);
        lit(img, I, good ? 1 : seg(lt, 0.3, 2.0), !good, lt);
        if (good && lt > 1) { const k = seg(lt, 1, 3), x = P.top[0] + k * 50, y = P.top[1] - 4 - k * 40, f = Math.sin(lt * 14) > 0; img.px(x, y, "#f4f4f0"); img.px(x - 1, y - (f ? 1 : 0), "#f4f4f0"); img.px(x + 1, y - (f ? 1 : 0), "#f4f4f0"); img.px(x + 1, y, "#d8d8d0"); }
        if (!good) darken(img, 0.18 * seg(lt, 0.5, 2), "#1a2238");
      }, sfx: good ? [[1.0, "chime"], [1.2, "wings"]] : [[0.5, "gutter"], [1.2, "low"]] }),
      B("tally", 3.0, { spec: bg, act(img, lt, I) { kneel(img, I, lt); lit(img, I, good ? 1 : 0.2, false, lt); }, ui(img, lt) {
        const n = r.tally || 1, k = ease(seg(lt, 0, 0.4)), x = 128, y = Math.round(lerp(-60, 16, k)), w = 104, h = 54;
        panel(img, x, y, w, h, { fill: "#4a3a2a", edge: "#2a1a12" });
        text(img, "candles lit", x + 6, y + 12, "#e8d8b0");
        text(img, "this season", x + 6, y + 22, "#e8d8b0");
        const shown = lt > 2.2 ? n : Math.floor(seg(lt, 0.5, 2.2) * n), groups = Math.min(shown, 30);
        for (let i = 0; i < groups; i++) { const g = Math.floor(i / 5), j = i % 5, gx = x + 6 + (g % 6) * 16, gy = y + 30 + Math.floor(g / 6) * 10; if (j < 4) img.rect(gx + j * 3, gy, 1, 7, "#f4ead0"); else img.line(gx - 1, gy + 5, gx + 11, gy + 1, "#f4ead0"); }
        text(img, String(Math.min(n, shown)), x + w - 6 - tw(String(Math.min(n, shown)), { k: 2 }), y + 22, "#ffe08a", { k: 2 });
      }, sfx: [[0.7, "chalk"], [1.3, "chalk"], [1.9, "chalk"]] }),
      B("line", 3.6, { spec: bg, act(img, lt, I) { lit(img, I, 1, false, lt); }, ui(img, lt) { lineCard(img, r, lt); }, sfx: [[0.15, "scribble"]] }),
    ];
  }

  function crossBeats(r) {
    const night = specOf(r, { place_kind: "crossroads", place_variant: "gallows", place_x: 0.6, hour: r.hr }), dawn = specOf(r, { place_kind: "crossroads", place_variant: "gallows", place_x: 0.6, hour: 6.2, weather: r.weather === "storm" ? "cloudy" : r.weather });
    const P = RS.scene(night, W, H).info.place, lady = r.trav || RA.spec("lantern_lady"), lg = RA.figure(lady.raw, 0);
    const LX = P.post[0] + 26, hx = 70;
    const say = r.say || "Which way is home?";
    const ghost = (img, I, a, lt) => {
      const bob = Math.round(Math.sin(lt * 2) * 1);
      glow(img, LX + 8, I.feet - 18 + bob, 16, "#ffc860", 0.35 * a);
      put(img, lg, LX, I.feet - 1 + bob, { flip: true, alpha: a * (0.75 + Math.sin(lt * 5) * 0.08) });
      for (let i = 0; i < 5; i++) { const ph = (lt * 0.3 + i / 5) % 1; img.px(LX - 10 + i * 5, I.feet - ph * 10, "#c8d8f0", (1 - ph) * 0.4 * a); }
    };
    const out = [
      B("night", 2.8, { spec: night, cap: (r.place.name || "the crossroads") + ", " + (r.hr >= 23 || r.hr < 1 ? "midnight" : when(r.hr)), act(img, lt, I) { drawBand(img, r, walkIn(r, lt, -20, hx, 2.2), I.feet, { walk: lt < 2.2 ? Math.floor(lt * 5) : undefined, G: I.Gf }); }, sfx: [[0.1, "steps", 2], [0.2, "wind", 3]] }),
      B("lantern", 2.4, { spec: night, cap: "a lantern, far off", act(img, lt, I) { drawBand(img, r, hx, I.feet, { G: I.Gf }); const x = lerp(W + 4, LX + 8, ease(seg(lt, 0, 2.4))), y = I.feet - 18 + Math.sin(lt * 3) * 2; glow(img, Math.round(x), Math.round(y), 7, "#ffc860", 0.6); img.px(x, y, "#fff0a0"); img.px(x, y + 1, "#ffb040"); }, sfx: [[0.3, "low"]] }),
      B("lady", 3.0, { spec: night, cap: lady.name || "the Lantern Lady", act(img, lt, I) { drawBand(img, r, hx, I.feet, { G: I.Gf }); ghost(img, I, ease(seg(lt, 0, 2)), lt); }, sfx: [[0.1, "ghost"]] }),
      B("question", 3.6, { spec: night, say: { who: "trav", text: say, at: 0.3 }, act(img, lt, I) { drawBand(img, r, hx, I.feet, { G: I.Gf }); ghost(img, I, 1, lt); },
        bubble: (lt) => ({ text: say, x: LX, y: FEET() - 36, a: seg(lt, 0.3, 0.6) }) }),
    ];
    if (r.card) out.push(B("card", 3.2, { spec: night, cap: "a card turns", act(img, lt, I) { drawBand(img, r, hx, I.feet, { G: I.Gf }); ghost(img, I, 1, lt); }, ui(img, lt) { tarot(img, r.card, 30, 18, lt); }, sfx: [[0.4, "flip"], [0.9, "chime"]] }));
    out.push(
      B("fade", 2.8, { spec: night, cap: "she points, and fades", act(img, lt, I) {
        drawBand(img, r, hx, I.feet, { G: I.Gf });
        const a = 1 - seg(lt, 0.8, 2.4);
        ghost(img, I, a, lt);
        if (lt > 0.4 && lt < 2) for (let i = 0; i < 18; i++) img.px(LX - 4 - i * 2, I.feet - 20 - i * 0.3, "#c8d8f0", (1 - i / 18) * (1 - seg(lt, 1.4, 2)));
        for (let i = 0; i < 10; i++) { const ph = seg(lt, 0.8 + i * 0.05, 2.6); if (ph > 0 && ph < 1) img.px(LX + (h2(i, 1, r.seed) - 0.5) * 12, I.feet - 10 - ph * 30, "#e8f0ff", 1 - ph); }
      }, sfx: [[0.8, "fade"]] }),
      B("dawn", 3.0, { spec: dawn, cap: /ring|gift|coin/.test(String(r.outcome)) ? "dawn: a cold copper ring" : "dawn", act(img, lt, I) {
        drawBand(img, r, hx, I.feet, { G: I.Gf });
        if (/ring|gift|coin/.test(String(r.outcome))) { const x = LX, y = I.feet - 1, s = Math.sin(lt * 4) > 0.6; img.px(x - 1, y, "#b87440"); img.px(x + 1, y, "#b87440"); img.px(x, y - 1, "#b87440"); img.px(x, y + 1, "#8a5420"); if (s) { img.px(x, y - 3, "#ffffff"); img.px(x - 2, y - 2, "#ffe8c0"); img.px(x + 2, y - 2, "#ffe8c0"); } }
      }, sfx: [[0.2, "birds"], [1.0, "sparkle"]] }),
      B("line", 3.6, { spec: dawn, ui(img, lt) { lineCard(img, r, lt); }, sfx: [[0.15, "scribble"]] }));
    return out;
  }
  function tarot(img, name, x, y, lt) {
    const k = seg(lt, 0.2, 0.9), sx = Math.abs(Math.cos(k * Math.PI)), face = k > 0.5, w = 42, h = 58, cw = Math.max(1, Math.round(w * sx)), cx = x + Math.round((w - cw) / 2);
    img.rect(cx - 1, y - 1, cw + 2, h + 2, "#2a1a12");
    img.rect(cx, y, cw, h, face ? "#f0e2c0" : "#3a2a5a");
    if (!face) { for (let j = 3; j < h - 3; j += 4) for (let i = 2; i < cw - 2; i += 4) img.px(cx + i, y + j, GOLD); return; }
    if (cw < w - 2) return;
    img.rect(cx + 2, y + 2, w - 4, 1, GOLD); img.rect(cx + 2, y + h - 3, w - 4, 1, GOLD); img.rect(cx + 2, y + 2, 1, h - 4, GOLD); img.rect(cx + w - 3, y + 2, 1, h - 4, GOLD);
    const sd = hash(name) % 3, mx = cx + w / 2, my = y + 20;
    if (sd === 0) K.disc(img, Math.round(mx), my, 7, "#ffd870", "#d8a838", 1);
    else if (sd === 1) K.disc(img, Math.round(mx), my, 7, "#e8e4d8", "#a8a49a", 1, (px, py) => (px - mx - 3) ** 2 + (py - my + 2) ** 2 > 30);
    else for (let i = 0; i < 9; i++) { img.px(mx, my - 6 + i, "#d8a838"); img.px(mx - 4 + i, my - 2 + (i % 2), "#d8a838"); }
    const nm = wrap(name, w - 6);
    nm.slice(0, 2).forEach((l, i) => text(img, l, mx - tw(l) / 2, y + 40 + i * 9, RUBRIC));
  }

  function tollBeats(r) {
    const branch = r.branch || "pay", bg = specOf(r, { place_kind: "toll", place_x: 0.58 }), P = RS.scene(bg, W, H).info.place;
    const kg = tollKeeper(r), fare = r.fare || 2;
    const [px, py] = P.pole, KX = P.keeper[0] + 4, gate = (img, I, up) => tollGate(img, I, P, up);
    // the band waits short of the pole, clear of the keeper's booth
    const hx = px - 30;
    // a wagoner and their mule waiting their turn on the far bank, when the line has them
    const fb = P.river[1];
    r.scenery = scenery(r, { cart: clamp(fb + 44, 40, W - 22), mule: clamp(fb + 14, 20, W - 16), who: clamp(fb + 32, 30, W - 12), bird: [px, py - 4] });
    const out = [B("gate", 2.8, { spec: bg, cap: r.place.name || "a toll bridge", act(img, lt, I) {
      put(img, kg, KX, I.feet, { G: I.Gf });
      gate(img, I, 0);
      drawBand(img, r, walkIn(r, lt, -30, hx, 1.8), I.feet, { walk: lt < 1.8 ? Math.floor(lt * 6) : undefined, G: I.Gf });
    }, bubble: (lt) => (lt > 1.6 ? { text: fare + " copper.", x: KX, y: FEET() - 34 } : null), sfx: [[0.1, "steps", 1.7], [1.6, "blip"]] })];
    // paid, and then a line off the parapet: onto the bridge, stop halfway, fish
    const payThenFish = () => {
      const stand = Math.round((P.river[0] + P.river[1]) / 2) - 6, deck = (x, I) => I.feet - (x > P.river[0] - 8 && x < P.river[1] + 8 ? 6 : 0);
      const onto = B("onto", 2.6, { spec: bg, act(img, lt, I) { put(img, kg, KX, I.feet, { G: I.Gf }); gate(img, I, ease(seg(lt, 0, 0.6))); const x = lerp(hx, stand, io(seg(lt, 0.3, 2.4))); drawBand(img, r, x, deck(x, I), { walk: lt < 2.4 ? Math.floor(lt * 6) : undefined, G: I.Gf }); }, sfx: [[0.1, "creak"], [0.6, "steps", 1.8]] });
      const fb = fishBeat(r, bg, stand, deck, stand + 24, H - 12), act0 = fb.act;
      fb.act = (img, lt, I) => { put(img, kg, KX, I.feet, { G: I.Gf }); gate(img, I, 1); act0(img, lt, I); };
      return [onto, fb];
    };
    const over = (img, I, lt, d) => { const k = io(seg(lt, 0.3, d)), x = lerp(hx, P.river[1] + 30, k), deck = I.feet - (x > P.river[0] - 8 && x < P.river[1] + 8 ? 6 : 0); drawBand(img, r, x, deck, { walk: Math.floor(lt * 6), G: I.Gf }); };
    if (branch === "pay") out.push(
      B("pay", 2.6, { spec: bg, act(img, lt, I) { put(img, kg, KX, I.feet, { G: I.Gf }); gate(img, I, 0); drawBand(img, r, hx, I.feet, { G: I.Gf });
        for (let i = 0; i < Math.min(fare, 4); i++) { const k = seg(lt, 0.3 + i * 0.3, 0.8 + i * 0.3); if (k > 0 && k < 1) coin(img, lerp(hx, KX + 4, k), I.feet - 24 - Math.sin(k * Math.PI) * 8, lt * 9); } },
        bubble: (lt) => (lt > 1.4 ? { text: "(bites it)", x: KX, y: FEET() - 34 } : null), sfx: [[0.3, "coin"], [0.6, "coin"], [1.5, "chomp"]] }),
      ...(r.dress.fish ? payThenFish() : [B("lift", 3.0, { spec: bg, cap: "the bar lifts", act(img, lt, I) { put(img, kg, KX, I.feet, { G: I.Gf }); gate(img, I, ease(seg(lt, 0, 0.6))); over(img, I, lt, 3.0); }, sfx: [[0.1, "creak"], [0.6, "steps", 2.2]] })]));
    else if (branch === "argue") {
      const lines = ["Two copper? For a bridge?", fare + " copper.", "It's barely a bridge!", "Then swim."];
      lines.forEach((l, i) => out.push(B("argue" + (i + 1), 1.8, { spec: bg, act(img, lt, I) { put(img, kg, KX, I.feet, { G: I.Gf, dy: i % 2 && lt < 0.2 ? -1 : 0 }); gate(img, I, 0); drawBand(img, r, hx, I.feet, { G: I.Gf, hop: i % 2 === 0 && lt < 0.2 ? 1 : 0 }); },
        bubble: () => ({ text: l, x: i % 2 ? KX : hx, y: FEET() - 34 }), sfx: [[0.1, "blip"]] })));
      const paid = /paid|pay/.test(String(r.outcome));
      out.push(B("wave", 3.0, { spec: bg, cap: paid ? "paid, in the end" : "waved through", act(img, lt, I) { put(img, kg, KX, I.feet, { G: I.Gf }); gate(img, I, ease(seg(lt, 0, 0.6))); over(img, I, lt, 3.0); }, sfx: [[0.1, "creak"], [0.6, "steps", 2.2]] }));
    } else {
      const [fx0, fx1] = P.ford;
      out.push(
        B("down", 3.0, { spec: bg, cap: "ford it instead", act(img, lt, I) {
          put(img, kg, KX, I.feet, { G: I.Gf }); gate(img, I, 0);
          const x = lerp(hx, fx0 + 22, io(seg(lt, 0.2, 2.8))), wet = x > fx0 ? clamp((x - fx0) / 10, 0, 1) : 0;
          // wading: down the bank into the river in front of the bridge, the water at the knees
          const deep = Math.round(wet * 16), wl = I.feet + deep - 7;
          drawBand(img, r, x, I.feet + deep, { walk: Math.floor(lt * 4), G: I.Gf, clip: (xx, yy) => yy < wl || xx < fx0 - 2 });
          if (wet > 0) for (let i = -10; i < 12; i++) img.px(x + i, wl, "#d8ecf8", 0.7);
          if (wet > 0) for (let i = 0; i < 6; i++) { const ph = (lt * 2 + i / 6) % 1; img.px(x - 8 + i * 3, wl - ph * 4, "#e0f0f8", 1 - ph); }
        }, sfx: [[0.9, "splash"], [1.5, "splash"], [2.2, "splash"]] }),
        B("wet", 2.8, { spec: bg, cap: "wet to the knees", act(img, lt, I) {
          put(img, kg, KX, I.feet, { G: I.Gf, dy: lt > 1 && lt < 1.3 ? -1 : 0 }); gate(img, I, 0);
          const x = lerp(fx1 - 4, fx1 + 30, ease(seg(lt, 0, 1.2)));
          drawBand(img, r, x, I.feet, { walk: lt < 1.2 ? Math.floor(lt * 5) : undefined, G: I.Gf, dy: lt > 1.2 && Math.floor(lt * 14) % 2 ? 0 : 0 });
          for (let i = 0; i < 5; i++) { const ph = (lt * 1.5 + i / 5) % 1; img.px(x - 6 + i * 3, I.feet - 6 + ph * 6, "#9ac8e8", 1 - ph); }
        }, ui(img, lt) { if (lt > 1.4) { const x = clamp(lerp(P.ford[1] - 4, P.ford[1] + 30, 1), 20, W - 20); text(img, "brr", x - 6 + (Math.floor(lt * 16) % 2), FEET() - 38, "#d8ecf8", { outline: "#1a2238" }); } }, sfx: [[0.2, "drip"], [1.4, "shiver"]] }));
    }
    out.push(B("line", 3.6, { spec: bg, act(img, lt, I) { put(img, kg, KX, I.feet, { G: I.Gf }); }, ui(img, lt) { lineCard(img, r, lt); }, sfx: [[0.15, "scribble"]] }));
    return out;
  }

  // the inn's common room: a hearth on the left, the bar on the right, beams, a table for the crew
  let roomBase = null;
  function commonRoom(img, r, lt, keeper, pats) {
    if (!roomBase) {
      roomBase = new K.Buf(W, H);
      const R0 = roomBase;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const floor = y > 92, plank = floor ? (y % 6 === 0 ? "#3a2416" : (Math.floor(x / 22) + Math.floor(y / 6)) % 2 ? "#6a4428" : "#5e3c24") : (x % 18 === 0 ? "#4a3020" : (y % 12 === 0 ? "#6a4a30" : "#7a5838"));
        R0.px(x, y, plank);
      }
      for (const bx of [0, 60, 120, 180]) R0.rect(bx, 0, 6, 92, "#3a2416");
      R0.rect(0, 10, W, 6, "#3a2416"); R0.rect(0, 16, W, 1, "#2a180e");
      R0.rect(14, 44, 46, 50, "#6a6660"); R0.rect(18, 50, 38, 6, "#8a867e"); R0.rect(22, 60, 30, 34, "#1a120c");
      for (let y = 22; y < 44; y++) R0.rect(26 + Math.round((y - 22) * 0.1), y, 22 - Math.round((y - 22) * 0.2), 1, "#7a766e");
      R0.rect(160, 70, 80, 24, "#5a3a22"); R0.rect(158, 68, 82, 4, "#8a5a32");
      for (let i = 0; i < 6; i++) { R0.rect(166 + i * 11, 30, 7, 9, i % 2 ? "#8a6a3a" : "#6a7a5a"); R0.rect(166 + i * 11, 39, 7, 1, "#3a2416"); }
      R0.rect(160, 40, 80, 2, "#4a3020");
      R0.rect(78, 96, 66, 6, "#8a5a32"); R0.rect(80, 102, 4, 14, "#5a3a22"); R0.rect(138, 102, 4, 14, "#5a3a22"); R0.rect(78, 96, 66, 1, "#b08050");
      R0.rect(104, 90, 6, 6, "#c8b48a"); R0.rect(116, 91, 5, 5, "#d8d0c0");
    }
    img.d.set(roomBase.d);
    for (let i = 0; i < 6; i++) { const ph = (lt * 2.2 + i / 6) % 1, x = 30 + (h2(i, 1, 3) * 14), y = 92 - ph * 22; for (let j = 0; j < 3; j++) img.px(x + j - 1, y, ph < 0.4 ? "#ffe080" : ph < 0.7 ? "#ff9a3a" : "#c8402a", 1 - ph * 0.6); }
    glow(img, 37, 82, 34, "#ff9a40", 0.32 + Math.sin(lt * 9) * 0.04);
    blit(img, keeper, 196 - 14, 70 - keeper.h + 8, { flip: true });
    blit(img, pats[0], 150, 116 - pats[0].h, {});
    blit(img, pats[1], 6, 128 - pats[1].h, {});
    r.cast.forEach((c, i) => blit(img, c.g, 84 + i * 16, 112 - c.g.h + (i % 2), { flip: i % 2 === 1 }));
    for (let i = 0; i < 4; i++) { const ph = (lt * 0.5 + i / 4) % 1; img.px(108 + i, 88 - ph * 10, "#e8e8e8", (1 - ph) * 0.5); }
  }

  // the things a line names, by the road: drawn under the band in every beat of a strip or a toll
  let muleG = null;
  function scenery(r, at) {
    const d = r.dress, who = d.who ? RA.figure({ id: "road:" + r.id + ":" + d.who, name: d.who, role: d.who }, 0) : null;
    if (!muleG && d.mule) muleG = RA.figure("fourth_best", 0, "reputation");
    return (img, I, t) => {
      if (d.cart) cart(img, at.cart, I.feet - 5, { G: I.Gf });
      if (d.mule) put(img, muleG, at.mule, I.feet - 2, { G: I.Gf, flip: true, dy: Math.sin(t * 1.3) > 0.85 ? -1 : 0 });
      if (who) put(img, who, at.who, I.feet, { G: I.Gf, flip: true });
      if (d.heron && at.heron) heron(img, I, at.heron, t);
      if (d.bird && at.bird) crowAt(img, I, at.bird[0], at.bird[1], t);
    };
  }
  function heron(img, I, x, t) {
    const y = I.feet - 2, G = (c) => I.Gf(c, 0), dip = Math.sin(t * 0.9) > 0.7 ? 3 : 0;
    for (let j = 0; j < 7; j++) img.px(x + (j > 4 ? 1 : 0), y - j, G("#e8e4dc"));
    img.rect(x - 2, y - 11, 5, 4, G("#a8b0b8")); img.rect(x - 3, y - 10, 2, 2, G("#7a8490"));
    img.px(x + 2, y - 12 - (dip ? -2 : 0), G("#e8e4dc")); img.px(x + 2, y - 13 - (dip ? -2 : 0), G("#e8e4dc")); img.px(x + 3, y - 14 + dip, G("#1a1a1a"));
    img.px(x + 4, y - 14 + dip, G("#d8a838")); img.px(x + 5, y - 14 + dip, G("#d8a838"));
  }
  function crowAt(img, I, x, y, t) {
    const G = (c) => I.Gf(c, 0), hop = Math.sin(t * 2.2) > 0.9 ? 1 : 0, rows = ["....kk.", "...kkkb", ".kkkkkk", "kkkkkk.", ".kkkk..", "..d.d.."];
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== ".") img.px(x - 3 + i, y - 5 + j - (j < 5 ? hop : 0), G(row[i] === "b" ? "#d8a838" : row[i] === "d" ? "#3a3030" : (i + j) % 4 === 0 ? "#2e2a3a" : "#16121a")); });
  }
  function turtle(img, I, x, y, peek) {
    const g = K.pieceGrid("turtle", false, 0);
    blit(img, g, x - 7, y - 6, { G: I.Gf });
    if (peek) { for (const [i, j, c] of [[8, -3, "#8aa05a"], [9, -3, "#8aa05a"], [10, -4, "#8aa05a"], [11, -4, "#8aa05a"], [11, -5, "#1a1a1a"], [12, -4, "#6a8040"]]) img.px(x + i, y + j, I.Gf(c, 0)); }
  }
  // a rod held out from the lead's hands over the water, its line sagging to a float; bite: the float dips; catch: a fish comes up
  // on the line and hangs there wriggling; none: the float just rides the ripples
  function rod(img, I, hx, hy, fx, fy, lt, how) {
    const G = (c) => I.Gf(c, 0), tx = hx + 15, ty = hy - 16;
    img.line(hx, hy, tx, ty, G("#6a4626")); img.line(hx - 1, hy + 1, hx + 3, hy - 3, G("#3a2414")); img.px(hx + 2, hy - 2, G("#a8a4a0"));
    const dip = how !== "none" && lt > 1.5 && lt < 2.5 && Math.floor(lt * 8) % 3 !== 0 ? 2 : 0, k = how === "catch" ? seg(lt, 2.4, 3.1) : 0;
    let ex = fx, ey = fy + Math.round(Math.sin(lt * 2.6) * 0.6) + dip;
    if (k > 0) { ex = Math.round(lerp(fx, tx + 1, k)); ey = Math.round(lerp(fy, ty + 7, k) - Math.sin(k * Math.PI) * 12); }
    const n = Math.max(6, Math.round(Math.hypot(ex - tx, ey - ty)));
    for (let i = 1; i < n; i++) { const u = i / n; img.px(Math.round(lerp(tx, ex, u)), Math.round(lerp(ty, ey, u) + (k > 0 ? 0 : Math.sin(u * Math.PI) * 2)), "#ece6d6", 0.8); }
    if (k > 0) {
      const wig = Math.floor(lt * 7) % 2;
      // a hand-long silver fish on the hook, nose up, its tail flicking
      const F = [".k.", "kak", "kbk", "kbk", "kbk", "kck", ".k.", wig ? "k.." : "..k", wig ? "kk." : ".kk"], PAL = { k: "#2a3440", a: "#1a1a1a", b: "#d8e4ec", c: "#9ab0c0" };
      F.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] !== ".") img.px(ex - 1 + i, ey + j, G(row[i] === "b" && i === 2 ? "#a8bccb" : PAL[row[i]])); });
    } else {
      img.px(ex, ey - 1, G("#d03a2a")); img.px(ex, ey, G("#f4f0e8")); img.px(ex + 1, ey, G("#c8c0b0"));
      const ph = (lt * 0.7) % 1, rr = 1 + Math.round(ph * 4);
      for (const i of [-rr, rr]) img.px(fx + i, fy + 1, "#c8e4f4", (1 - ph) * 0.7);
      if (dip) for (const i of [-2, 2]) img.px(fx + i, fy - 1, "#e8f4fa", 0.8);
    }
  }
  // a fishing beat: the band stands (feet by footAt), the lead with the rod; then a word for how it went
  function fishBeat(r, bg, stand, footAt, fx, fy) {
    const how = r.dress.fish, cast = (img, I) => r.cast.forEach((c, i) => { const x = stand - i * 15; put(img, c.g, x, footAt(x, I) + (i % 2), { G: I.Gf }); });
    return B("fish", 4.2, { spec: bg, cap: "a line in the water", act(img, lt, I) { cast(img, I); rod(img, I, stand + 6, footAt(stand, I) - 13, fx, fy, lt, how); },
      ui(img, lt) { if (how === "catch" && lt > 3.1) tag(img, "a catch!", fx - 14, 26); else if (how === "bite" && lt > 1.5) pop(img, "!", fx, fy - 8, lt - 1.5); else if (how === "none" && lt > 3) tag(img, "nothing", fx - 10, 26, "#e8dcc0"); },
      sfx: how === "catch" ? [[0.3, "soft"], [1.6, "splash"], [2.5, "splash"], [3.1, "cheer"]] : how === "bite" ? [[0.3, "soft"], [1.6, "blip"]] : [[0.3, "soft"], [2.2, "water", 1.5]] });
  }
  // the toll bar at the booth: a striped pole that swings up (up 0 down, 1 raised)
  function tollGate(img, I, P, up) {
    const [px, py] = P.pole, a = up * Math.PI / 2.2, L = 26;
    img.line(px, py, px + Math.cos(a) * L, py - Math.sin(a) * L, I.G("#efe6d4", 0.05));
    for (let i = 4; i < L; i += 6) img.px(px + Math.cos(a) * i, py - Math.sin(a) * i, I.G("#b8402c", 0.05));
  }
  const tollKeeper = (r) => RA.figure((r.trav || RA.spec({ id: "tollkeeper:" + (r.place.id || r.id), name: "the toll-keeper", role: "guard" })).raw, 0);
  // where the set piece stands and where the band stops short of it
  const PLACE_X = { ford: 0.55, milestone: 0.62, ruin: 0.7, waystation: 0.66, crossroads: 0.62, inn: 0.66, shrine: 0.64, toll: 0.58 };
  const ROADNAME = { forest: "the forest road", marsh: "the marsh road", hills: "the hill road", snow: "the high road", coast: "the cliff road", volcanic: "the burnt road", dungeon: "the last mile" };
  // a stretch with something to see: the band walks up to it, stops (or, at a ford, crosses on the stones; at a toll nobody paid, is
  // waved over the bridge), and walks on; a line that fishes stops at the water and fishes
  function placeStrip(r, pk) {
    const bg = specOf(r, pk ? { place_kind: pk, place_x: PLACE_X[pk] } : {});
    const I0 = RS.scene(bg, W, H).info, P = I0.place || { x: Math.round(W * 0.62) }, SX = P.x, d = r.dress, ford = pk === "ford" && P.stones;
    const toll = pk === "toll" && P.river && P.pole, fish = d.fish && P.river;
    const at = {
      who: pk ? clamp(SX + 36, 30, W - 14) : 166, cart: pk ? clamp(SX + 54, 40, W - 22) : 184, mule: pk ? clamp(SX + 24, 20, W - 16) : 150,
      heron: ford ? P.river[1] - 9 : null, bird: P.top ? [P.top[0], P.top[1] - 2] : toll ? [P.pole[0], P.pole[1] - 4] : [SX + 30, I0.roadTop - 9],
    };
    if (toll) { const fb = P.river[1]; Object.assign(at, { cart: clamp(fb + 44, 40, W - 22), mule: clamp(fb + 14, 20, W - 16), who: clamp(fb + 32, 30, W - 12) }); }
    if (d.cart && d.who) at.who = at.cart - 30;
    const things = scenery(r, at), kg = toll ? tollKeeper(r) : null;
    // a free crossing: the keeper by the booth and the bar already up
    r.scenery = (img, I, t) => { if (toll) { put(img, kg, P.keeper[0] + 4, I.feet, { G: I.Gf, flip: true }); tollGate(img, I, P, 1); } things(img, I, t); };
    const mid = P.river ? Math.round((P.river[0] + P.river[1]) / 2) : SX;
    const stopX = fish ? (toll ? mid - 6 : P.river[0] - 10) : ford ? P.river[0] - 12 : toll ? P.keeper[0] - 30 : pk ? SX - 32 : (d.who ? at.who - 36 : d.cart ? at.cart - 50 : 112);
    const path = ford ? [[P.river[0] - 8, I0.feet]].concat(P.stones.map(([x, y]) => [x, y + 1]), [[P.river[1] + 8, I0.feet]]) : null;
    const footAt = (x, I) => {
      if (toll) return I.feet - (x > P.river[0] - 8 && x < P.river[1] + 8 ? 6 : 0);
      if (!path || x < path[0][0] || x >= path[path.length - 1][0]) return I.feet;
      let i = 0;
      while (i < path.length - 2 && x >= path[i + 1][0]) i++;
      const [ax, ay] = path[i], [bx, by] = path[i + 1], k = (x - ax) / (bx - ax);
      return Math.round(lerp(ay, by, k) - Math.sin(k * Math.PI) * 4);
    };
    const band = (img, I, lead, o) => r.cast.forEach((c, i) => { const x = lead - i * 15; put(img, c.g, x, footAt(x, I) + (path || toll ? 0 : i % 2), Object.assign({ G: I.Gf }, o, { walk: o && o.walk !== undefined ? o.walk + i * 2 : undefined })); });
    const tStone = ford ? P.stones[2] : null, nearT = (lead) => tStone && d.turtle && r.cast.some((c, i) => Math.abs(lead - i * 15 - tStone[0]) < 6);
    const stoneTurtle = (img, I, lead) => { if (tStone && d.turtle) turtle(img, I, tStone[0], tStone[1] + 1, nearT(lead)); };
    const cap = r.place.name || (d.who ? "a " + d.who + " by the road" : ROADNAME[r.biome] || "the road");
    const beats = [
      B("come", 3.0, { spec: bg, cap, act(img, lt, I) { const x = walkIn(r, lt, -20, stopX, 2.6); stoneTurtle(img, I, x); band(img, I, x, { walk: lt < 2.6 ? Math.floor(lt * 6) : undefined }); }, sfx: [[0.1, "steps", 2.5]] }),
    ];
    // off a bridge the float lands in the river below the arch; from a bank, a little way out into the stream
    if (fish) beats.push(fishBeat(r, bg, stopX, footAt, toll ? stopX + 24 : P.river[0] + 18, toll ? I0.h - 12 : I0.feet + 10));
    if (ford) {
      const end = P.river[1] + 14;
      beats.push(B("cross", 4.4, { spec: bg, cap: d.turtle ? "the third stone" : "the stepping stones", act(img, lt, I) {
        const x = lerp(stopX, end + (r.cast.length - 1) * 15, seg(lt, 0.2, 4.2));
        stoneTurtle(img, I, x);
        band(img, I, x, { walk: Math.floor(lt * 5) });
        for (const [sx, sy] of P.stones) if (r.cast.some((c, i) => Math.abs(x - i * 15 - sx) < 2)) for (let k = 0; k < 4; k++) img.px(sx - 4 + k * 3, sy + 2 - ((lt * 9 + k) % 3), "#e0f0f8", 0.8);
      }, ui(img, lt) { if (d.turtle) { const x = lerp(stopX, end + (r.cast.length - 1) * 15, seg(lt, 0.2, 4.2)); if (nearT(x)) pop(img, "!", tStone[0], tStone[1] - 30, 0.5); } }, sfx: [[0.6, "splash"], [1.5, "splash"], [2.4, "splash"], [3.3, "splash"]] }));
      beats.push(B("on", 2.6, { spec: bg, act(img, lt, I) { stoneTurtle(img, I, 0); band(img, I, walkIn(r, lt, end + (r.cast.length - 1) * 15, W + 60, 2.6), { walk: Math.floor(lt * 6) }); }, sfx: [[0.1, "steps", 2.4]] }));
    } else {
      const glyph = d.who || d.mule || d.bird || d.cart ? "!" : pk === "milestone" || pk === "crossroads" ? "?" : null;
      if (!fish) beats.push(B("stop", 3.2, { spec: bg, cap: toll ? "waved through" : undefined, act(img, lt, I) { band(img, I, stopX, { hop: 0, dy: 0 }); }, ui(img, lt) { if (glyph) pop(img, glyph, stopX, FEET() - 38, lt - 0.5); }, sfx: glyph ? [[0.5, "blip"]] : [] }));
      beats.push(B("on", 3.2, { spec: bg, act(img, lt, I) { band(img, I, walkIn(r, lt, stopX, W + 60, 3.2), { walk: Math.floor(lt * 6) }); }, sfx: [[0.1, "steps", 3]] }));
    }
    beats.push(B("line", 3.6, { spec: bg, ui(img, lt) { lineCard(img, r, lt); }, sfx: [[0.15, "scribble"]] }));
    return beats;
  }

  // ---------- the director: the line acted out, caption by caption ----------
  // where everyone stands on each set, and what the set adds to the road
  const SETS = {
    road: { band: 92, trav: 138 },
    place: { band: 96, trav: 140 },
    balcony: { band: 112, extra: [["balcony", 0.68]], up: true, crowd: [14, 30, 206, 222] },
    market: { band: 118, extra: [["stall", 0.7]], stall: true, crowd: [16, 32, 214] },
    street: { band: 96, trav: 140, extra: [["town", 0.5, "street"]], crowd: [168, 186, 204, 222] },
    gate: { band: 132, trav: 164, extra: [["town", 0.14, "near"]] },
    hill: { band: 96, trav: 140, biome: "hills" },
    snow: { band: 96, trav: 140, biome: "snow" },
    shore: { band: 96, trav: 140, biome: "coast" },
    fire: { band: 98, trav: 146, extra: [["camp", 0.5]], hour: 19.6 },
    lamp: { band: 94, trav: 128, extra: [["lamppost", 0.6]] },
    water: { band: 104, trav: 132, place: "ford", px: 0.78 },
    shrine: { band: 92, trav: 132, place: "shrine", px: 0.68 },
    crossroads: { band: 82, trav: 136, place: "crossroads", px: 0.62 },
    waystation: { band: 90, trav: 136, place: "waystation", px: 0.74, crowd: [196, 212] },
    tent: { band: 70, trav: 150, extra: [["tent", 0.62]], crowd: [196, 212, 228] },
    stage: { band: 54, extra: [["stage", 0.64]], stageUp: true, crowd: [70, 12] },
    bridge: { band: 70, trav: 120, place: "toll", px: 0.6 },
    cart: { band: 74, trav: 132, cart: true },
    farm: { band: 92, trav: 138, extra: [["haycart", 0.86]] },
  };
  function setSpec(r, set) {
    const S0 = SETS[set] || SETS.road, o = {};
    if (S0.biome) o.biome = S0.biome;
    if (S0.hour && (r.hr > 9 && r.hr < 17)) o.hour = S0.hour;
    if (S0.place) { o.place_kind = S0.place; o.place_x = S0.px; if (S0.place === "crossroads" && r.trav && r.trav.key === "lantern_lady") o.place_variant = "gallows"; }
    else if (set === "place" && r.place.kind && PLACE_X[r.place.kind]) { o.place_kind = r.place.kind; o.place_x = 0.76; }
    if (S0.extra) o.extra = S0.extra;
    // fishing behind an inn or a hut: the building stands on the near bank behind the band
    if (set === "water" && ["inn", "waystation", "ruin", "shrine"].includes(r.place.kind)) o.extra = [[r.place.kind, 0.28]];
    const s = specOf(r, o);
    if (S0.biome) s.seed = S0.biome + (r.place.id || "");
    if (s.place_kind && s.place_kind === "milestone" && r.variant) s.place_variant = r.variant;
    return s;
  }
  // the people a line needs: the band, the traveller and a crew's members, anyone else named, a crowd
  function actorsOf(r, steps, set) {
    const A = {};
    r.cast.forEach((c, i) => { A["h" + i] = { g: c.g, name: c.name, h: c.h, band: i }; });
    const sp = r.trav;
    if (sp) {
      const f = travFigs(r)[0];
      A.t = { g: f ? f.g : RA.figure(sp.raw, 0), name: sp.raw.face || sp.name, trav: true };
      // a crew the art has not drawn by hand shows its first member in the leader's look, so that one is the face
      const drawn = !!(RA.CREWS || {})[sp.key];
      if (sp.kind === "crew") (sp.members || []).slice(0, 3).forEach((m, i) => { const n = typeof m === "string" ? m : m.name; if (i || drawn) A["m" + (i + 1)] = { g: RA.figure(sp.raw, 0, n), name: n, trav: true, member: i + 1 }; });
      if (sp.kind === "crew" && !drawn) for (const s of steps) for (const k of ["a", "b"]) if (s[k] === "m1") s[k] = "t";
    }
    const want = new Set();
    for (const s of steps) for (const k of [s.a, s.b, s.then && s.then.a, s.then && s.then.b, ...(s.cast || []), ...Object.keys(s.beh || {})]) if (k) want.add(k);
    if ((SETS[set] || {}).cart) want.add("x:cart");
    for (const k of want) {
      if (A[k] || !k.startsWith("x:")) continue;
      const tg = thingGrid(k.slice(2), 0);
      if (tg) { A[k] = { g: tg, name: k.slice(2), extra: true, thing: k.slice(2), bird: !!(root.SceneKits && root.SceneKits.BIRDS.has(k.slice(2))) }; continue; }
      const role = k.slice(2), child = /^(child|boy|girl)$/.test(role);
      let g = RA.figure({ id: "road:" + (r.place.id || r.id) + ":" + role, name: role, role: role === "keeper" ? "innkeeper" : role }, 0);
      if (child) g = shrink(g, 0.74);
      A[k] = { g, name: role === "keeper" && r.place.keeper ? r.place.keeper : "the " + role, extra: true };
    }
    if (want.has("crowd") || (SETS[set] || {}).crowd) {
      A.crowd = { crowd: true, list: ((SETS[set] || {}).crowd || [168, 186, 204, 222]).map((x, i) => ({ x, g: RA.figure({ id: "crowd:" + (r.place.id || r.biome) + i, role: ["farmer", "merchant", "pedlar", "baker", "", "drover"][i % 6] }, 0) })) };
    }
    return A;
  }
  // the things a line can name that are not people: the kits' animals, carts and stalls (scene_kits.js), the dungeon beasts, a giant
  const BEASTS = { wolf: ["wolf", "grey"], bear: ["bear", "brown"], boar: ["boar", "brown"], giant: ["troll", "stone", 1.7], troll: ["troll", "stone"] };
  const beast = (body, pal) => { try { return root.Art.monsterGrid({ body, pal }, 0); } catch (e) { return RActs.prop("stone"); } };
  function thingGrid(id, f) {
    if (id === "cart" || id === "wagon") return cartGrid();
    if (id === "lute") return RActs.prop("lute");
    if (id === "bees") return root.SceneKits.sprite("skep", 0);
    const bz = BEASTS[id];
    if (bz) { const g = beast(bz[0], bz[1]); return bz[2] ? shrink(g, bz[2]) : g; }
    return root.SceneKits ? root.SceneKits.sprite(id, f) : null;
  }
  function shrink(g, k) {
    const w = Math.round(g.w * k), h = Math.round(g.h * k), px = new Array(w * h).fill(null);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = g.px[Math.floor(y / k) * g.w + Math.floor(x / k)];
    return { w, h, px };
  }
  // a figure laid on their back on the road
  const lyingCache = new Map();
  function lying(g) {
    if (lyingCache.has(g)) return lyingCache.get(g);
    const w = g.h, h = g.w, px = new Array(w * h).fill(null);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) px[x * w + (g.h - 1 - y)] = g.px[y * g.w + x];
    const out = { w, h, px };
    lyingCache.set(g, out);
    return out;
  }
  // the opening formation of a set: x and feet for everyone, who faces whom
  function formation(r, A, set, I) {
    const S0 = SETS[set] || SETS.road, P = I.place || {}, pos = {};
    r.cast.forEach((c, i) => { pos["h" + i] = { x: S0.band - i * 15, y: I.feet + (i % 2), flip: false }; });
    let tx = S0.trav || 140, ty = I.feet;
    const ex = (I.extras || [])[0] || {};
    if (S0.up && ex.floor) { tx = ex.floor[0]; ty = ex.floor[1]; }
    if (S0.stall && ex.behind) { tx = ex.x; ty = ex.behind; }
    if (S0.stageUp && ex.floor) { tx = ex.floor[0] - 10; ty = ex.floor[1]; }
    if (set === "crossroads" && P.post && r.trav && r.trav.key === "lantern_lady") tx = P.post[0] + 26;
    // a wagon stands between the band and its owners, so whoever helps with it has a side to push on
    const cartX = A["x:cart"] ? S0.band + 50 : null;
    if (cartX) tx = cartX + 40;
    if (A.t) pos.t = { x: tx, y: ty, flip: true };
    let k = 0;
    for (const id in A) if (/^m\d/.test(id)) { k++; pos[id] = { x: tx + k * (S0.stageUp ? 16 : S0.up || S0.stall ? 0 : 14), y: ty + (S0.up || S0.stall ? 0 : k % 2), flip: true, hide: !!(S0.up || S0.stall) }; }
    let e = 0;
    if (cartX) pos["x:cart"] = { x: cartX, y: I.feet - 3, flip: false };
    for (const id in A) if (A[id].extra && !pos[id]) { e++; pos[id] = { x: Math.min(W - 14, A.t ? Math.max(tx, S0.band) + 24 + e * 16 + (S0.stageUp ? k * 16 : k * 14) : S0.band + 34 + e * 22 + (A[id].thing ? 16 : 0)), y: I.feet, flip: true }; }
    return pos;
  }
  const copyPos = (p) => { const o = {}; for (const k in p) o[k] = Object.assign({}, p[k]); return o; };
  // where each act leaves everyone
  function settle(s, pos, A) {
    const p = copyPos(pos);
    // a hero who went over is back on their feet by the next beat
    for (const id in p) if (/^h/.test(id) && p[id].down) p[id].down = false;
    const a = p[s.a], b = p[s.b];
    const level = (q) => q && pos.h0 && Math.abs(q.y - pos.h0.y) < 4;
    const near = (from, to, gap) => { if (!from || !to || !level(from) || !level(to)) return; const d = to.x - from.x, want = Math.sign(d || 1) * gap; if (Math.abs(d) > Math.abs(want) + 2) from.x = to.x - want; from.flip = d < 0; };
    if (["give", "pay", "shake", "hug", "bless", "carry"].includes(s.act) && a && b) near(a, b, s.act === "give" || s.act === "pay" ? 20 : 13);
    if (s.act === "spar" && a && b) near(a, b, 22);
    if ((s.act === "push" || s.act === "mend") && a) { const c = p["x:cart"]; if (c && level(a)) { a.x = a.x < c.x ? c.x - 28 : c.x + 28; a.flip = a.x > c.x; } else if (b && b !== a) near(a, b, 14); }
    if (s.act === "walk" && a) {
      const dx = 30, moved = new Set([s.a, s.b]);
      if (A[s.a] && A[s.a].band !== undefined) for (const id in p) if (/^h/.test(id)) moved.add(id);
      for (const id of moved) if (p[id] && level(p[id])) p[id].x += dx;
      const span = Math.max(...[...moved].filter((id) => p[id]).map((id) => p[id].x));
      if (span > W - 16) for (const id of moved) if (p[id]) p[id].x -= span - (W - 16);
    }
    if (s.act === "leave" && a) { a.x = W + 40; a.flip = false; a.gone = true; }
    if (s.act === "fall" && a) a.down = true;
    if (s.act === "sleep" && a && A[s.a] && A[s.a].thing) a.down = true;
    // stepping aside: the band backs onto the verge (up the frame a little) and whatever passes keeps the road
    for (const id in p) if (p[id].ay !== undefined && s.act !== "aside") { p[id].y = p[id].ay; delete p[id].ay; }
    if (s.act === "aside") for (const id in p) if ((/^h/.test(id) || (A[id] && A[id].trav)) && p[id].ay === undefined) { p[id].ay = p[id].y; p[id].y -= 8; }
    if (s.act === "duck") for (const id in p) if (/^h/.test(id) || (A[id] && A[id].trav)) p[id].down = true;
    if ((s.act === "push" || s.act === "mend") && p["x:cart"]) p["x:cart"].down = false;
    if (s.act === "fade" && a) a.gone = true;
    if ((s.act === "carve" || s.act === "dig" || s.act === "pick") && a && b && A[s.b] && A[s.b].thing) near(a, b, 18);
    if (s.act === "chase" && a) { a.x = clamp(a.x + 44, 20, W - 30); a.flip = false; }
    // what the line's animals and carts do: follow the band, run off, sit tight in the road, fly over, come along the road
    for (const id in s.beh || {}) {
      const q = p[id], how = s.beh[id];
      if (!q) continue;
      if (how === "flee" || (how === "flee" && s.act === "chase")) { q.x = q.x > W / 2 || s.act === "chase" ? W + 50 : -50; q.gone = true; q.flip = q.x < 0; }
      if (how === "follow" && p.h0) { const last = Object.keys(p).filter((k) => /^h/.test(k)).length - 1; q.x = (p["h" + last] || p.h0).x - 20; q.flip = false; }
      if (how === "pass") { q.x = q.x > W / 2 ? -60 : W + 60; q.gone = true; }
      q.beh = how;
    }
    if (a && b && !["walk", "leave", "chase"].includes(s.act)) { a.flip = b.x < a.x; if (!["sing", "call"].includes(s.act)) b.flip = a.x < b.x; }
    return p;
  }
  const NOTE = ["..xx", "..x.", "..x.", "xxx.", "xx.."];
  function note(img, x, y, col, a) { NOTE.forEach((row, j) => { for (let i = 0; i < 4; i++) if (row[i] === "x") img.px(x + i, y + j, col, a); }); }
  const HEART = ["x.x", "xxx", ".x."];
  function heart(img, x, y, a) { HEART.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === "x") img.px(x + i, y + j, "#e8566a", a); }); }
  function holdAt(img, P, id, name, I) {
    const p = P[id];
    if (!p || !name) return;
    const g = RActs.prop(name), dir = p.flip ? -1 : 1;
    blit(img, g, Math.round(p.x + dir * 6 - g.w / 2), Math.round(p.y - 14 - g.h / 2), { G: I.Gf });
  }
  function headOf(A, P, id) { const p = P[id], g = A[id] && A[id].g; return p ? [Math.round(p.x), Math.round(p.y - (g ? g.h : 30) + 4)] : [W / 2, 40]; }
  function sparkle(img, x, y, lt, col) { for (let i = 0; i < 6; i++) { const a = lt * 3 + i * 1.05, rr = 4 + (lt * 6 % 4); img.px(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7, col || "#ffe08a", 0.9); } }
  // the people of a story beat at local time lt, moving from where the last beat left them to where this one puts them
  function drawPeople(img, I, r, A, p0, p1, lt, s, held) {
    if (A.crowd) A.crowd.list.forEach((c, i) => {
      const hop = s && (s.act === "cheer" || s.b === "crowd") && lt > 0.6 ? (Math.floor(lt * 5 + i) % 2) * 2 : 0;
      put(img, c.g, c.x, I.feet - 9 - (i % 2) * 2, { G: (col) => I.G(col, 0.3), flip: c.x > W / 2, dy: -hop });
    });
    const order = Object.keys(A).filter((id) => !A[id].crowd && p1[id]).sort((a, b) => p1[a].y - p1[b].y || p1[a].x - p1[b].x);
    const out = {};
    for (const id of order) {
      const a0 = p0[id] || p1[id], a1 = p1[id];
      const how = s && s.beh && s.beh[id], slow = A[id].thing && (how === "pass" || how === "flee");
      const d = a1.x - a0.x, md = slow ? 3.2 : Math.min(1.8, Math.max(0.5, Math.abs(d) / 34)), k = (slow ? (q) => q : io)(seg(lt, slow ? 0.3 : 0.05, (slow ? 0.3 : 0.05) + md)), x = lerp(a0.x, a1.x, k), moving = Math.abs(d) > 1 && k > 0 && k < 1;
      const yy = lerp(a0.y, a1.y, io(seg(lt, 0.05, 0.6)));
      const flip = moving ? d < 0 : a1.flip;
      out[id] = { x, y: yy, flip };
      if (a1.hide || (a0.gone && a1.gone) || (a1.gone && !moving && !(s && s.act === "fade" && s.a === id))) continue;
      let g = A[id].g, dy = 0, alpha;
      if (A[id].thing === "cart" || A[id].thing === "wagon") {
        const broke = a1.down && (a0.down || (s && s.act === "fall" && s.a === id && lt > 0.7)), fixing = a0.down && !a1.down;
        const tilt = broke ? 9 : fixing ? 9 * (1 - seg(lt, 1.2, 2.6)) : 0;
        cart(img, x, a1.y + 2, { G: I.Gf, tilt, off: tilt > 0.5 ? [x - 34, a1.y + 4] : null, roll: moving ? lt * 6 : 0 });
        continue;
      }
      if (a1.down && (a0.down || (s && (s.act === "fall" || s.act === "duck" || s.act === "sleep") && lt > 0.7))) {
        const lg = lying(g);
        for (let i = -12; i <= 12; i++) img.px(x + i, a1.y + 1, "#1a1008", 0.16 * (1 - Math.abs(i) / 13));
        blit(img, lg, Math.round(x - lg.w / 2), a1.y - lg.h + 3, { G: I.Gf });
        continue;
      }
      if (A[id].thing && root.SceneKits) {
        const how = (s && s.beh && s.beh[id]) || a1.beh || "idle", kid = A[id].thing;
        const step = moving || how === "peck" || how === "stubborn" ? Math.floor(lt * (how === "flee" ? 8 : 3)) % 2 : 0;
        let tg = thingGrid(kid, step) || g;
        let ty = a1.y + (A[id].bird && how === "fly" ? -42 + Math.round(Math.sin(lt * 2.4) * 5) : 0);
        if (A[id].bird && how !== "fly" && moving) ty -= Math.round(Math.sin(k * Math.PI) * 18);
        if (how === "stubborn" && s && (s.act === "push" || s.act === "chase")) dy = Math.floor(lt * 7) % 2;
        if (kid === "bees") { for (let i = 0; i < 9; i++) { const ph = lt * 2 + i * 0.7; img.px(x + Math.cos(ph * 1.3 + i) * 9, a1.y - 14 + Math.sin(ph * 1.7) * 6, i % 2 ? "#2a1a10" : "#f0c040"); } }
        if (Math.abs(ty - I.feet) < 6) for (let i = -6; i <= 6; i++) img.px(x + i, ty + 1, "#1a1008", 0.18 * (1 - Math.abs(i) / 7));
        blit(img, tg, Math.round(x - tg.w / 2), Math.round(ty - tg.h + 1 + dy), { G: I.Gf, flip: !flip ? false : true });
        continue;
      }
      if (s) dy = poseDy(s, id, lt);
      if (s && s.act === "fade" && s.a === id) alpha = 1 - seg(lt, 1.4, 2.8);
      let clipFeet = null;
      if (s && s.act === "sink" && s.a === id) { const k2 = seg(lt, 0.3, 1.2) - seg(lt, 2.2, 3.0); dy = Math.round(9 * k2); clipFeet = a1.y + 1; }
      if (s && s.act === "wade" && (s.a === id || /^h/.test(id))) { dy = 5; clipFeet = a1.y - 1; }
      if (s && s.act === "sit" && s.a === id && lt > 0.6) dy = 4;
      if (clipFeet !== null) { put(img, g, x, a1.y, { G: I.Gf, flip, dy, clip: (xx, yy) => yy < clipFeet }); if (s.act === "wade" || s.act === "sink") for (let i = -8; i <= 8; i++) img.px(x + i, clipFeet, s.act === "wade" ? "#c8e0f0" : "#3a2a1a", 0.7); continue; }
      if (A[id].trav && r.trav && r.trav.key === "lantern_lady") alpha = (alpha === undefined ? 1 : alpha) * (0.8 + Math.sin(lt * 5) * 0.08);
      if (Math.abs(yy - I.feet) < 10) for (let i = -6; i <= 6; i++) img.px(x + i, yy + 1, "#1a1008", 0.2 * (1 - Math.abs(i) / 7));
      const flipNow = s && s.act === "decline" && s.a === id && lt > 0.3 && lt < 1.3 ? Math.floor(lt * 6) % 2 === 0 : flip;
      put(img, g, x, yy, { G: I.Gf, flip: flipNow, walk: moving ? Math.floor(lt * 6) : undefined, dy, alpha });
      if (held && held[id]) holdAt(img, out, id, held[id], I);
    }
    return out;
  }
  function poseDy(s, id, lt) {
    const me = s.a === id, you = s.b === id;
    if (me && (s.act === "bow" || s.act === "ask")) return lt > 0.4 && lt < 1.4 ? 2 : 0;
    if (me && (s.act === "nod" || s.act === "salute")) return lt > 0.4 && lt < 1.6 && Math.floor(lt * 5) % 2 ? 1 : 0;
    if (me && (s.act === "laugh" || s.act === "cheer" || s.act === "call")) return lt > 0.3 && lt < 2 ? -(Math.floor(lt * 7) % 2) : 0;
    if (me && s.act === "dance") return -(Math.floor(lt * 5) % 2) * 3;
    if (s.act === "dance" && /^m/.test(id)) return -(Math.floor(lt * 5 + 1) % 2) * 3;
    if (you && s.act === "cheer") return -(Math.floor(lt * 6) % 2) * 2;
    if (me && s.act === "smile") return lt > 0.5 && lt < 0.8 ? -2 : 0;
    if (me && s.act === "spar") return Math.floor(lt * 3) % 2 ? 0 : -1;
    if (me && s.act === "climb") return -Math.round(Math.sin(clamp(lt / 3, 0, 1) * Math.PI) * 12);
    return 0;
  }
  // what an act draws over the people: props in flight, a stick fight, notes, an echo, a lamp lit, the sun breaking through
  function actFx(img, I, r, A, P, s, lt) {
    const pa = P[s.a], pb = P[s.b];
    const hand = (p) => [Math.round(p.x + (p.flip ? -6 : 6)), Math.round(p.y - 14)];
    if ((s.act === "give" || s.act === "pay") && pa && pb) {
      const n = s.act === "pay" ? Math.min(4, r.fare || 2) : 1;
      for (let i = 0; i < n; i++) {
        const k = seg(lt, 0.9 + i * 0.22, 1.7 + i * 0.22);
        if (k <= 0 || k >= 1) continue;
        const [x0, y0] = hand(pa), [x1, y1] = hand(pb), x = lerp(x0, x1, ease(k)), y = lerp(y0, y1, k) - Math.sin(k * Math.PI) * 10;
        if (s.prop === "coin") coin(img, x, y, lt * 9); else { const g = RActs.prop(s.prop || "bun"); blit(img, g, Math.round(x - g.w / 2), Math.round(y - g.h / 2), { G: I.Gf }); }
      }
      if (lt <= 0.9 && s.prop !== "coin") holdAt(img, P, s.a, s.prop, I);
      if (lt >= 1.7 && s.prop !== "coin" && s.act === "give") holdAt(img, P, s.b, s.prop, I);
      if (lt > 1.7 + n * 0.2 && lt < 2.8) sparkle(img, hand(pb)[0], hand(pb)[1] - 2, lt);
    }
    if (s.act === "spar" && pa && pb) {
      const ph = Math.floor(lt * 3) % 2, [ax, ay] = hand(pa), [bx, by] = hand(pb), mx = Math.round((ax + bx) / 2);
      img.line(ax, ay, mx + (ph ? 3 : -3), ay - 10, I.Gf("#8a6a42", 0)); img.line(bx, by, mx + (ph ? -3 : 3), by - 10, I.Gf("#8a6a42", 0));
      if ((lt * 3) % 1 < 0.2) for (let i = 0; i < 6; i++) img.px(mx + Math.cos(i * 1.05) * 4, ay - 11 + Math.sin(i * 1.05) * 3, "#fff4c0");
    }
    if (s.act === "fall" && pa && lt > 0.6 && lt < 1.6) for (let i = 0; i < 8; i++) { const ph = (lt - 0.6); img.px(pa.x - 12 + i * 3, pa.y - ph * 6, "#d8c8a8", 1 - ph); }
    if ((s.act === "sing" || s.act === "dance") && pa) {
      const singers = Object.keys(P).filter((id) => id === s.a || (/^m/.test(id) && A[id].trav));
      singers.forEach((id, j) => { const [x, y] = headOf(A, P, id); for (let i = 0; i < 2; i++) { const ph = (lt * 0.6 + i * 0.5 + j * 0.27) % 1, wob = s.sweet ? 0 : Math.round(Math.sin(lt * 9 + j) * 2); note(img, x + 2 + ph * 10 + wob, y - 8 - ph * 16, s.sweet ? "#ffe08a" : ["#f4e8cc", "#c8e0f0", "#f0c0c8"][j % 3], 1 - ph); } });
      if (s.act === "dance" && pb) for (let i = 0; i < 8; i++) { const a = lt * 2 + i * 0.785; img.px(pb.x + Math.cos(a) * 16, pb.y - 4 + Math.sin(a) * 3, "#ffe08a", 0.8); }
    }
    if (s.act === "ring") for (const id of Object.keys(P).filter((x) => A[x] && A[x].trav)) { const [x, y] = headOf(A, P, id); if (Math.floor(lt * 6) % 2) { blit(img, RActs.prop("bell"), x + 4, y - 2, {}); } }
    if ((s.act === "echo" || s.act === "ring" || (s.act === "call" && !pb)) && pa) {
      const [x, y] = headOf(A, P, s.a);
      for (let k = 0; k < 3; k++) { const ph = (lt * 0.5 + k / 3) % 1, rr = 6 + ph * 70; for (let a = -0.9; a < 0.9; a += 0.06) img.px(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.5, "#f4e8cc", (1 - ph) * 0.5); }
    }
    if (s.act === "light" && pa) {
      const lamp = ((I.extras || []).find((e) => e.lamp) || {}).lamp || [pa.x + 10, pa.y - 34], k = seg(lt, 0.8, 1.8);
      if (k > 0) { glow(img, lamp[0], lamp[1], Math.round(6 + 16 * k), "#ffc860", 0.6 * k); img.rect(lamp[0] - 2, lamp[1] - 3, 5, 6, "#fff0a0", k * 0.9); }
      if (lt < 1.2) { const [x, y] = hand(pa); img.line(x, y, lamp[0] - 2, lamp[1] + 3, I.Gf("#6a4a2a", 0)); img.px(lamp[0] - 2, lamp[1] + 2, "#ffb040"); }
    }
    if (s.act === "burn" && pa) {
      const x = Math.round(pa.x + (pa.flip ? -14 : 14)), y = pa.y, k = seg(lt, 0.7, 1.3);
      if (k > 0) { blit(img, RActs.prop("ledger"), x - 3, y - 4, { G: I.Gf }); glow(img, x, y - 4, 10, "#ff9a40", 0.5 * k); for (let i = 0; i < 8; i++) { const ph = (lt * 1.8 + i / 8) % 1; img.px(x - 3 + (i % 6), y - 4 - ph * 9, ph < 0.4 ? "#ffe080" : ph < 0.7 ? "#ff9a3a" : "#8a8a92", 1 - ph); } }
    }
    if ((s.act === "read" || s.act === "look" || s.act === "hold") && pa && s.prop) {
      const g = RActs.prop(s.prop), [x, y] = hand(pa), bob = Math.round(Math.sin(lt * 2));
      blit(img, g, Math.round(x - g.w / 2), Math.round(y - 4 - g.h + bob), { G: I.Gf });
      if (lt > 0.8) sparkle(img, x, y - 8, lt, "#fff4c0");
    }
    if ((s.act === "eat" || s.act === "drink") && pa) {
      const g = RActs.prop(s.prop || (s.act === "drink" ? "tea" : "bun")), up = Math.floor(lt * 2) % 2, [x, y] = hand(pa);
      blit(img, g, Math.round(x - g.w / 2), Math.round(y - g.h - (up ? 6 : 0)), { G: I.Gf });
      if (s.act === "eat" && up) img.px(x + 2, y - 4, "#e8c890");
    }
    if (s.act === "bless" && pb) { glow(img, Math.round(pb.x), pb.y - 16, 18, "#fff0b0", 0.45 * seg(lt, 0.4, 1.4)); if (lt > 0.4) sparkle(img, pb.x, pb.y - 32, lt, "#fff8d0"); }
    if ((s.act === "smile" || s.act === "hug" || s.act === "blush") && pa && lt > 0.4) {
      const [x, y] = headOf(A, P, s.a), ph = ((lt - 0.4) * 0.8) % 1;
      heart(img, x - 1, y - 8 - Math.round(ph * 10), 1 - ph);
      if (s.act === "blush") { img.px(x - 3, y + 8, "#e86a6a", 0.8); img.px(x + 2, y + 8, "#e86a6a", 0.8); }
    }
    if (s.act === "wave" && pa) { const [x, y] = headOf(A, P, s.a), w = Math.floor(lt * 5) % 2, hx = x + (pa.flip ? -8 : 8) + (w ? 1 : -1); img.rect(hx, y - 1, 2, 2, I.Gf("#e8b088", 0)); img.px(hx, y + 1, I.Gf("#c98e62", 0)); }
    if (s.act === "salute" && pa && lt > 0.4) { const [x, y] = headOf(A, P, s.a); img.rect(x + (pa.flip ? -5 : 3), y + 1, 2, 2, I.Gf("#e8b088", 0)); }
    if (s.act === "shake" && pa && pb) { const mx = Math.round((pa.x + pb.x) / 2), my = Math.round(pa.y - 14 + (lt > 0.5 && lt < 2 ? Math.floor(lt * 6) % 2 : 0)); img.rect(mx - 2, my, 4, 2, I.Gf("#d8a070", 0)); img.px(mx - 2, my, I.Gf("#2a1a12", 0)); }
    if (s.act === "count" && pa && lt > 0.3) { const n = Math.min(9, 1 + Math.floor((lt - 0.3) * 2.5)), [x, y] = headOf(A, P, s.a); text(img, String(n), x + 5, y - 2, "#ffe08a", { outline: "#2a1a12" }); }
    if (s.act === "sleep" && pa) { const [x, y] = headOf(A, P, s.a); text(img, "z", Math.round(x + 5 + (lt * 3 % 3)), Math.round(y - 2 - (lt * 4 % 6)), "#e8e2d4", { outline: "#2a1a12" }); }
    if (s.act === "fish" && pa && A[s.a] && A[s.a].thing) { if (lt > 1 && lt < 1.6) for (let i = 0; i < 6; i++) img.px(pa.x + (pa.flip ? -8 : 8) + Math.cos(i) * 4, pa.y - 2 - (lt - 1) * 8 + Math.sin(i * 2) * 2, "#d8ecf8", 0.8); if (lt > 1.4) blit(img, RActs.prop("fish"), Math.round(pa.x + (pa.flip ? -12 : 8)), Math.round(pa.y - 22), { G: I.Gf }); }
    else if (s.act === "fish" && pa) { const [x, y] = hand(pa), river = I.place && I.place.river; rod(img, I, x, y + 2, river ? river[0] + 14 : x + 28, river ? I.feet + 8 : I.feet + 4, lt, /\b(lands?|catch(es)?|trout|caught)\b/.test(String(s.sub).toLowerCase()) && !/\bnothing\b/.test(String(s.sub).toLowerCase()) ? "catch" : "bite"); }
    if (s.act === "shadow") {
      // something huge goes over: its shadow sweeps the road from right to left, and the light dips as it passes
      const k = seg(lt, 0.3, 2.4), cx = lerp(W + 90, -90, k);
      if (k > 0 && k < 1) for (let y = I.roadTop - 8; y < H; y++) for (let x = Math.round(cx - 80); x < cx + 80; x++) { const d = ((x - cx) / 80) ** 2 + ((y - I.feet) / 22) ** 2; if (d < 1) img.px(x, y, "#0a0810", 0.42 * (1 - d)); }
      if (k > 0.2 && k < 0.8) darken(img, 0.12, "#0a0c18");
    }
    if (s.act === "sun") { const k = seg(lt, 0.4, 1.8); if (k > 0) { glow(img, 214, 12, 26, "#fff0b0", 0.55 * k); for (let i = 0; i < 6; i++) { const a = 2.2 + i * 0.16; for (let d = 14; d < 90; d++) img.px(214 + Math.cos(a) * d, 12 + Math.sin(a) * d, "#fff4c0", 0.16 * k * (1 - d / 90)); } } }
    if (s.act === "fade" && pa) { const k = seg(lt, 0.2, 1.2) - seg(lt, 1.6, 2.8); glow(img, Math.round(pa.x + 6), pa.y - 18, Math.round(10 + 18 * Math.max(0, k)), k > 0.6 ? "#ffffff" : "#ffc860", 0.55 * Math.max(0, k)); if (lt > 1.6) for (let i = 0; i < 10; i++) { const ph = seg(lt, 1.6 + i * 0.05, 3); if (ph > 0 && ph < 1) img.px(pa.x + (h2(i, 1, r.seed) - 0.5) * 12, pa.y - 10 - ph * 30, "#e8f0ff", 1 - ph); } }
    if (s.act === "carve" && pa) {
      // chips fly from the point of a knife into the stone; scratches appear one by one
      const sx = Math.round(pa.x + (pa.flip ? -9 : 9)), sy = pa.y - 12, n = Math.floor(seg(lt, 0.5, 2.5) * 6);
      img.line(sx - (pa.flip ? -3 : 3), sy + 2, sx, sy, I.Gf("#a8a4a0", 0));
      for (let i = 0; i < n; i++) img.px(sx + (pa.flip ? -3 : 3) + (i % 3), sy - 4 + Math.floor(i / 3) * 2, "#3a3630", 0.9);
      if (lt > 0.5 && lt < 2.6) for (let i = 0; i < 3; i++) { const ph = (lt * 4 + i / 3) % 1; img.px(sx + (pa.flip ? 1 : -1) * ph * 6, sy - ph * 5 + ph * ph * 8, "#d8d0c0", 1 - ph); }
    }
    if (s.act === "dig" && pa) {
      const sx = Math.round(pa.x + (pa.flip ? -8 : 8)), up = Math.floor(lt * 2.5) % 2;
      img.line(sx, pa.y - 16 + up * 3, sx + (pa.flip ? -2 : 2), pa.y - 2 + up * 3, I.Gf("#6a4a2a", 0)); img.rect(sx + (pa.flip ? -4 : 1), pa.y - 2 + up * 3, 3, 2, I.Gf("#8a8a92", 0));
      for (let i = 0; i < 4; i++) { const ph = (lt * 2.5 + i / 4) % 1; img.px(sx + (pa.flip ? 1 : -1) * (2 + ph * 8), pa.y - ph * 8 + ph * ph * 10, "#6a4a2a", 1 - ph); }
      img.rect(sx - 3, pa.y + 1, 7, 2, "#4a3420", 0.8);
    }
    if (s.act === "point" && pa && lt > 0.4) {
      const [hx, hy] = headOf(A, P, s.a), dir = pa.flip ? -1 : 1, k = ease(seg(lt, 0.4, 0.9));
      img.line(hx + dir * 3, hy + 9, hx + dir * (3 + 9 * k), hy + 6, I.Gf("#e8b088", 0));
      if (k >= 1) { const ax = hx + dir * (22 + Math.floor(lt * 4) % 2 * 2); text(img, dir > 0 ? ">" : "<", ax, hy + 6, "#ffe08a", { outline: "#2a1a12" }); }
    }
    if (s.act === "share" && pa) {
      const g = RActs.prop(s.prop || "bun"), takers = Object.keys(P).filter((id) => /^h/.test(id) && id !== s.a);
      takers.forEach((id, i) => { const k = seg(lt, 0.6 + i * 0.5, 1.2 + i * 0.5), q = P[id]; if (k > 0 && k < 1) blit(img, g, Math.round(lerp(pa.x, q.x, k) - g.w / 2), Math.round(pa.y - 16 - Math.sin(k * Math.PI) * 8), { G: I.Gf }); else if (k >= 1) holdAt(img, P, id, s.prop || "bun", I); });
      holdAt(img, P, s.a, s.prop || "bun", I);
    }
    if (s.act === "banter" && pa && pb) {
      // a back-and-forth: a quip, a groan, a quip back
      const turn = Math.floor(lt / 1.1) % 2, who = turn ? s.b : s.a, [x, y] = headOf(A, P, who);
      pop(img, ["ha!", "?", "!", "...", "ugh"][(Math.floor(lt / 1.1) + r.seed) % 5], x, y - 2, lt % 1.1);
    }
    if (s.act === "pick" && pa && lt > 1.0) holdAt(img, P, s.a, s.prop || "coin", I);
    if (s.act === "pick" && pa && lt > 0.9 && lt < 2) sparkle(img, pa.x + (pa.flip ? -6 : 6), pa.y - 16, lt);
    if ((s.act === "weather" || s.wx) && root.SceneKits) {
      const wx = s.wx || "wind";
      if (wx === "rainbow") { const k = seg(lt, 0.3, 1.8); for (let a = 0; a < Math.PI; a += 0.01) for (const [rr, c] of [[70, "#e85a4a"], [67, "#f0b040"], [64, "#e8e060"], [61, "#6ac86a"], [58, "#5a8ad8"], [55, "#8a6ac8"]]) img.px(W / 2 + 30 + Math.cos(a) * rr, I.feet + 4 - Math.sin(a) * rr * 0.9, c, 0.35 * k); }
      else root.SceneKits.weather(img, I, wx, seg(lt, 0, 1.8), lt);
    }
    if (s.act === "mend" && pa && lt > 0.6) for (let i = 0; i < 4; i++) { const ph = (lt * 3 + i * 0.25) % 1; img.px(pa.x + (pa.flip ? -10 : 10) + Math.cos(i * 2) * ph * 5, pa.y - 6 - ph * 6, "#ffe08a", 1 - ph); }
    if (s.act === "chase" && pa && lt < 2) dust(img, pa.x - 8, pa.y, lt, 4);
    if (s.act === "decline" && pa && lt > 0.3 && lt < 1.4) { const [x, y] = headOf(A, P, s.a); for (const dx of [-7, 7]) img.px(x + dx, y + 3, "#f4e8cc", 0.8); }
    if ((s.act === "ask" || s.act === "talk") && pa && !s.say && lt > 0.4) pop(img, s.act === "ask" ? "?" : "...", headOf(A, P, s.a)[0], headOf(A, P, s.a)[1] - 2, lt - 0.4);
    if (s.act === "leave" && pa && lt < 2.5) { const [x, y] = headOf(A, P, s.a); for (let i = 0; i < 2; i++) { const ph = (lt * 0.7 + i * 0.5) % 1; note(img, x - 6 - ph * 8, y - 6 - ph * 10, "#f4e8cc", 1 - ph); } }
  }
  // the words: a caption band along the bottom, in step with what it says
  function subtitle(img, s, lt, still) {
    if (!s) return;
    const lines = wrap(s, W - 16).slice(0, 4), h = lines.length * 10 + 5, y0 = H - h, a = still ? 1 : seg(lt, 0, 0.3);
    for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) img.px(x, y, "#140c08", (0.66 + (y - y0) / h * 0.2) * a);
    for (let x = 0; x < W; x++) img.px(x, y0, "#d8a838", 0.45 * a);
    if (a < 0.4) return;
    lines.forEach((l, i) => text(img, l, Math.round((W - tw(l)) / 2), y0 + 10 + i * 10, "#f6ead0", { outline: "#140c08" }));
  }
  function nameChip(img, s, lt) {
    if (!s) return;
    const w = tw(s) + 10, k = ease(seg(lt, 0, 0.4));
    panel(img, Math.round(lerp(-w - 4, 4, k)), 4, w, 13, { edge: "#2a1a12" });
    text(img, s, Math.round(lerp(-w - 4, 4, k)) + 5, 14, RUBRIC);
  }
  // the beats of a line: the band (and whoever they meet) come into frame, then one beat per caption, then the scene held with its name
  function storyBeats(r, opts) {
    opts = opts || {};
    const ctx = { heroes: r.cast.map((c) => ({ id: c.id, name: c.name })), trav: r.trav, place: r.place, pronoun: r.pronoun, hints: root.RoadHints || {} };
    const sc = RActs.script(Object.assign({}, r, { place_hint: r.place.id || null, trav_hint: r.trav ? "meet:" + (r.trav.id || r.trav.key) : null }), ctx);
    let steps = (sc.steps.length ? sc.steps : [{ sub: r.line, act: "talk", a: "h0", b: r.trav ? "t" : null }]).map((s) => Object.assign({}, s));
    if (opts.only) steps = steps.filter((s) => opts.only.some((c) => c.includes(String(s.sub).slice(0, 20)) || String(s.sub).includes(c.slice(0, 20))));
    if (!steps.length) return [];
    const set = opts.set || sc.set || (r.place.kind && PLACE_X[r.place.kind] && r.kind !== "meet" ? "place" : "road");
    let cur = set;
    for (const st of steps) { if (opts.set || !st.set || (st.set === "room" && !opts.room)) st.set = cur === "room" && !opts.room ? "place" : cur; cur = st.set; }
    const A = actorsOf(r, steps, steps[0].set);
    const beats = [];
    let spec = setSpec(r, steps[0].set), I = RS.scene(spec, W, H).info, pos = formation(r, A, steps[0].set, I);
    const held = {};
    const S0 = SETS[steps[0].set] || {}, home = S0.up || S0.stall || S0.stageUp || !r.trav || r.kind !== "meet";
    // what the line finds already lying there (a giant asleep across the road) is lying there from the start
    if (steps[0].act === "sleep" && A[steps[0].a] && A[steps[0].a].thing && pos[steps[0].a]) pos[steps[0].a].down = true;
    const start = copyPos(pos);
    for (const id in start) { if (/^h/.test(id)) start[id].x -= 130; else if (A[id] && A[id].trav && !home) start[id].x += 120; }
    const title = r.trav ? r.trav.name : r.place.name || ROADNAME[r.biome] || "the road";
    const mk = (id, dur, o) => { const b = B(id, dur, Object.assign({ spec, r, A }, o)); b.act = storyAct(b); return b; };
    if (!opts.noArrive) beats.push(mk("arrive", 3.0, { chip: cap(title), people: [start, pos, null, {}], sfx: [[0.1, "steps", 2.6]] }));
    if (r.trav && r.kind === "meet" && !opts.noCard) beats.push(mk("known", 2.8, { people: [pos, pos, null, {}], ui(img, lt) { knownCard(img, r, lt); }, sfx: [[0.15, "card"], [0.5, r.met > 1 ? "chime" : "blip"]] }));
    steps.forEach((s, i) => {
      if (i && s.set !== steps[i - 1].set) {
        spec = setSpec(r, s.set); I = RS.scene(spec, W, H).info;
        const f = formation(r, A, s.set, I);
        for (const id in pos) if (pos[id].gone && f[id]) f[id].gone = true;
        pos = f;
      }
      const after = settle(s, pos, A), h0 = Object.assign({}, held);
      if ((s.act === "give" || s.act === "pay") && s.prop !== "coin") { held[s.b] = s.prop; delete held[s.a]; }
      if (s.act === "hold" && s.prop) held[s.a] = s.prop;
      const dur = clamp(1.8 + String(s.sub || "").length * 0.045, 3.4, 6.6);
      const hd = headOf(A, after, s.a);
      const say = s.say ? { who: s.a, name: (A[s.a] || {}).name, h: (A[s.a] || {}).h, text: s.say, at: 0.5 } : null;
      beats.push(mk("act" + (i + 1), dur, { sub: s.sub, set: s.set, people: [pos, after, s, h0], say, bubble: say ? (lt) => ({ text: s.say, x: hd[0], y: hd[1] - 2, a: seg(lt, 0.5, 0.8) }) : null, sfx: sfxOf(s) }));
      pos = after;
      if (s.then) {
        const t2 = Object.assign({}, s.then), after2 = settle(t2, pos, A), h1 = Object.assign({}, held);
        if (t2.prop) { held[t2.b] = t2.prop; delete held[t2.a]; }
        beats.push(mk("act" + (i + 1) + "b", 3.0, { sub: s.sub, set: s.set, keep: true, people: [pos, after2, t2, h1], sfx: sfxOf(t2) }));
        pos = after2;
      }
    });
    frame2x(beats, A, I);
    const fin = !!(r.trav && r.arc_step && r.arc_step >= (r.arc_len || 99));
    beats.push(mk("line", 3.0, { people: [pos, pos, null, Object.assign({}, held)], ui(img, lt) { endPlate(img, r, lt, fin); }, sfx: [[0.2, fin ? "chime" : "scribble"]] }));
    return beats;
  }
  // the camera: the arrival is the whole road, then each act is shown at twice the size, framed round the people in it (as the
  // meal and tavern scenes show a room), the frame panning from one act's people to the next; an act too wide to frame stays wide
  const ZW = W / 2, ZH = H / 2;
  function frame2x(beats, A, I) {
    let last = null;
    for (const b of beats) {
      if (!/^act/.test(b.id) || !b.people) { last = null; continue; }
      const [p0, p1, s] = b.people, ids = new Set([s.a, s.b, s.then && s.then.b].filter(Boolean));
      for (const id in s.beh || {}) ids.add(id);
      if (["walk", "duck", "banter", "share", "wade", "chase", "sing", "dance", "cheer"].includes(s.act)) for (const id in p1) if (/^h/.test(id)) ids.add(id);
      let x0 = 1e9, x1 = -1e9, top = 1e9, bot = -1e9;
      for (const id of ids) for (const q of [p0[id], p1[id]]) {
        if (!q || !A[id] || q.gone || q.hide) continue;
        const g = A[id].g, fly = A[id].bird && (s.beh || {})[id] === "fly" ? 44 : 0;
        x0 = Math.min(x0, q.x - g.w / 2 - 6); x1 = Math.max(x1, q.x + g.w / 2 + 6); top = Math.min(top, q.y - g.h - fly - 14); bot = Math.max(bot, q.y + 3);
      }
      if (x0 > x1 || x1 - x0 > ZW - 4 || bot - top > ZH + 12) { last = null; continue; }
      const wx = clamp(Math.round((x0 + x1) / 2 - ZW / 2), 0, W - ZW), wy = clamp(Math.round(Math.max(bot - 50, top - 4)), 0, H - ZH);
      b.win = [wx, wy]; b.win0 = last || b.win; last = b.win;
      const bub = b.bubble;
      if (bub) b.bubble = (lt) => { const bb = bub(lt); if (!bb) return bb; const [ax, ay] = winAt(b, lt); return Object.assign({}, bb, { x: (bb.x - ax) * 2, y: (bb.y - ay) * 2 }); };
    }
  }
  const winAt = (b, lt) => { const k = io(seg(lt, 0, 0.9)); return [Math.round(lerp(b.win0[0], b.win[0], k)), Math.round(lerp(b.win0[1], b.win[1], k))]; };
  function zoom(img, b, lt) {
    const [wx, wy] = winAt(b, lt), out = new K.Buf(W, H), d = img.d, o = out.d;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = ((wy + (y >> 1)) * W + wx + (x >> 1)) * 4, j = (y * W + x) * 4; o[j] = d[i]; o[j + 1] = d[i + 1]; o[j + 2] = d[i + 2]; o[j + 3] = 255; }
    return out;
  }
  function sfxOf(s) {
    return { give: [[0.9, "card"], [1.7, "sparkle"]], pay: [[0.9, "coin"], [1.12, "coin"]], spar: [[0.3, "hammer"], [0.95, "hammer"], [1.6, "hammer"]], fall: [[0.7, "grunt"]], sing: [[0.2, "chime"]], dance: [[0.2, "chime"], [1.0, "chime"]],
      ring: [[0.2, "bell"], [0.6, "bell"]], shadow: [[0.3, "wings"], [0.5, "rumble"]], duck: [[0.7, "grunt"]], echo: [[0.2, "low"]], call: [[0.5, "blip"]], ask: [[0.5, "blip"]], decline: [[0.5, "blip"]], laugh: [[0.4, "cheer"]], cheer: [[0.4, "cheer"]], light: [[0.8, "strike"], [1.0, "candle"]],
      burn: [[0.7, "strike"], [0.9, "fire", 2]], fade: [[0.2, "ghost"], [1.6, "fade"]], sun: [[0.6, "chime"]], walk: [[0.1, "steps", 1.6]], leave: [[0.1, "steps", 2]], bless: [[0.4, "chime"]], fish: [[0.3, "soft"], [1.6, "splash"]],
      mend: [[0.6, "hammer"], [1.0, "hammer"]], shake: [[0.4, "soft"]], wave: [[0.3, "wave"]], read: [[0.3, "flip"]], eat: [[0.5, "chomp"]], drink: [[0.5, "soft"]], count: [[0.4, "tick"], [0.8, "tick"], [1.2, "tick"]],
    }[s.act] || [[0.4, "soft"]];
  }
  // the closing plate: who or where, the day, and for a finale the end of the road
  function endPlate(img, r, lt, fin) {
    const k = ease(seg(lt, 0.1, 0.6)), name = cap(r.trav ? r.trav.name : r.place.name || ROADNAME[r.biome] || "the road");
    const sub2 = fin ? "the end of the road" : r.trav && r.arc_step ? "a chapter of the road" : r.day ? "day " + r.day : "";
    const w = Math.min(W - 8, Math.max(tw(name), tw(sub2)) + 18), x = Math.round((W - w) / 2), y = Math.round(lerp(H + 2, H - 40, k));
    panel(img, x, y, w, 31, { band: 3, bandCol: fin ? RUBRIC : GOLD });
    text(img, name, Math.round(x + (w - tw(name)) / 2), y + 15, RUBRIC);
    if (sub2) text(img, sub2, Math.round(x + (w - tw(sub2)) / 2), y + 26, "#6a5236");
    if (fin) for (let i = 0; i < 6; i++) { const a = lt * 1.5 + i * 1.05; img.px(x + w / 2 + Math.cos(a) * (w / 2 + 6), y + 15 + Math.sin(a) * 19, "#ffe08a", 0.8); }
  }
  // a story beat drawn: its people at lt, the stall front over whoever stands behind it, then the act's effects
  function storyAct(b) {
    return (img, lt, I) => {
      const [p0, p1, s, held] = b.people;
      const P = drawPeople(img, I, b.r, b.A, p0, p1, lt, s, held);
      const st = (I.extras || []).find((e) => e.front);
      if (st) blit(img, st.front, st.gx, st.gy, { G: I.G, depth: 0.12, clip: (x, y) => y >= st.cut });
      if (s) actFx(img, I, b.r, b.A, P, s, lt);
    };
  }

  // a set piece's own beats, each given the caption that tells it; the captions no beat tells are acted after them, at the place
  function attach(r, beats, rules) {
    const caps = RActs.split(r.line), left = [], tidy = (c) => cap(c.replace(/^(and|but|then|plus) /i, ""));
    let last = -1;
    for (const c of caps) {
      const low = c.toLowerCase(), fits = rules.filter(([re]) => re.test(low));
      let k = -1, add = -1;
      // a catch-all rule only reaches forward; a named one may take an earlier beat, or share a beat that already says something
      for (const rule of fits) {
        const any = rule[0].source === ".";
        k = beats.findIndex((b, i) => rule[1].test(b.id) && !b.sub && (!any || i > last));
        if (k >= 0) break;
        if (!any && add < 0) add = beats.findIndex((b) => rule[1].test(b.id) && b.sub && b.sub.length + c.length < 150);
      }
      const tail = last >= 0 && /^[a-z]/.test(c) && beats[last].sub.length + c.length < 150;
      if (tail && (k < 0 || rules.find(([re]) => re.test(low))[0].source === ".")) beats[last].sub += " " + c;
      else if (k >= 0) { beats[k].sub = tidy(c); beats[k].cap = null; last = k; }
      else if (add >= 0) { beats[add].sub += " " + tidy(c); last = add; }
      else left.push(c);
    }
    // a caption stays up through the wordless beats that go on acting it
    let carry = null;
    for (const b of beats) { if (b.id === "line") break; if (b.sub) carry = b.sub; else if (carry && b.id !== "arrive") { b.sub = carry; b.keep = true; } }
    const end = beats.findIndex((b) => b.id === "line");
    const tail = left.length ? storyBeats(r, { noArrive: true, noCard: true, only: left, set: "place" }) : [];
    if (tail.length) tail[0].cut = "dip";
    beats.splice(end, beats.length - end, ...tail);
    if (!tail.length) beats.push(holdBeat(r, beats[beats.length - 1]));
    return beats;
  }
  // the last frame of a beat held under the closing plate
  function holdBeat(r, prev) {
    const fin = !!(r.trav && r.arc_step && r.arc_step >= (r.arc_len || 99)), t = prev.dur - 0.01;
    return B("line", 3.0, { spec: prev.spec, act: prev.act ? (img, lt, I) => prev.act(img, t, I) : null, draw: prev.draw ? (img) => prev.draw(img, t) : null, ui(img, lt) { endPlate(img, r, lt, fin); }, sfx: [[0.2, fin ? "chime" : "scribble"]] });
  }

  // ---------- the inn's common room: the tavern's own room (tavern.js), lit by its fire, lanterns and candles ----------
  // where people stand in the room, on the tavern's floor grid (u along the bar wall, v along the hearth wall)
  const RSPOT = { h0: [3.5, 4.75], h1: [2.5, 5.5], h2: [1.5, 6.0], h3: [1.0, 4.0], keeper: [3.6, 0.6], serve: [5.0, 4.4], t: [6.6, 3.4], near: [5.6, 4.8] };
  const FOOD = /^(pasty|bowl|bun|loaf|fish|mug|tea|apple|cheese|egg|honey|pot|bottle|cup)$/;
  const LOCALS = [[8.8, 3.8], [9.8, 5.2], [6.8, 6.6], [1.4, 3.4]];
  const KEEPER_PATH = [[3.6, 0.6], [7.7, 0.8], [7.7, 3.0], [5.0, 4.4]];
  let roomKit = null;
  function tavernKit(day) {
    const T = root.Tavern;
    if (!T || !root.document || !T.room || !T.furnish) return null;
    roomKit = roomKit || {};
    if (roomKit[day ? 1 : 0]) return roomKit[day ? 1 : 0];
    const R = T.ROOM, st = T.stage(W, H, 108, 44), r = root.Art.rng(root.Art.hash("road-inn"));
    const look = {};
    const bg = T.room(st, r, look);
    if (day) {
      // the same windows by day: sky and a green hill through the panes, the mullions drawn back over them
      const ctx = bg.getContext("2d");
      for (const [a0, a1] of [[8.2, 10.2], [10.6, 12.5]]) {
        T.fillPoly(ctx, st.quad(st.rwall, a0, a1, 19, 41), (x, y) => { const [, h] = st.onR(x, y), t = (h - 19) / 22; return t < 0.28 ? ((x + y) % 3 ? "#7aa05a" : "#6a9450") : t < 0.4 ? "#a8c890" : (x + y * 2) % 7 === 0 ? "#e8f0f4" : t < 0.7 ? "#a8cce4" : "#86b4dc"; });
        const mid = (a0 + a1) / 2;
        T.fillPoly(ctx, st.quad(st.rwall, mid - 0.06, mid + 0.06, 19, 41), "#3a2414");
        T.fillPoly(ctx, st.quad(st.rwall, a0, a1, 29.5, 30.5), "#3a2414");
      }
    }
    const f = T.furnish(st, r, false), inside = T.inRoom(st, R.NU, R.NV, R.WH);
    const shine = T.lighting(W, H, (x, y) => inside(x, y)), cv = root.document.createElement("canvas");
    cv.width = W; cv.height = H;
    const kit = { T, R, st, bg, furniture: f.furniture, candles: f.candles, sleepers: f.sleepers, shine, cv, ctx: cv.getContext("2d"), canv: new Map(), day };
    kit.ctx.imageSmoothingEnabled = false;
    roomKit[day ? 1 : 0] = kit;
    return kit;
  }
  function canvasOf(kit, g, flip) {
    const key = g, m = kit.canv.get(key) || {};
    if (!m[flip ? 1 : 0]) {
      const c = root.document.createElement("canvas");
      c.width = g.w; c.height = g.h;
      const x = c.getContext("2d");
      for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) { const col = g.px[j * g.w + (flip ? g.w - 1 - i : i)]; if (col) { x.fillStyle = typeof col === "string" ? col : "rgb(" + col.join(",") + ")"; x.fillRect(i, j, 1, 1); } }
      m[flip ? 1 : 0] = c;
      kit.canv.set(key, m);
    }
    return m[flip ? 1 : 0];
  }
  const pathAt = (pts, k) => {
    const segs = [];
    let len = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); len += d; }
    let at = k * len;
    for (let i = 0; i < segs.length; i++) { if (at <= segs[i] || i === segs.length - 1) { const f = segs[i] ? Math.min(1, at / segs[i]) : 1; return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)]; } at -= segs[i]; }
    return pts[pts.length - 1];
  };
  // everyone's floor spot after a room step
  function roomSettle(s, pos) {
    const p = copyPos(pos), k = "x:keeper";
    for (const id in p) if (id === k && !(s && (s.a === k || s.b === k))) Object.assign(p[id], { u: RSPOT.keeper[0], v: RSPOT.keeper[1], face: 1 });
    if (!s) return p;
    const serve = (id, other) => { if (!p[id]) return; if (id === k) Object.assign(p[id], { u: RSPOT.serve[0], v: RSPOT.serve[1] }); else if (!/^h/.test(id)) Object.assign(p[id], { u: RSPOT.near[0] + 0.6, v: RSPOT.near[1] - 0.6 }); };
    if (["give", "pay", "shake", "hug", "bless", "teach", "count", "ask", "decline"].includes(s.act)) { serve(s.a, s.b); serve(s.b, s.a); }
    if (s.act === "leave" && p[s.a]) Object.assign(p[s.a], { u: 12.5, v: 9.4, gone: true });
    for (const id of [s.a, s.b]) if (p[id] && p[s.a] && p[s.b] && s.a !== s.b) { const o = id === s.a ? p[s.b] : p[s.a], me = p[id]; me.face = (o.u - o.v) - (me.u - me.v) >= 0 ? 1 : -1; }
    return p;
  }
  function roomStart(r, A) {
    const p = {};
    r.cast.forEach((c, i) => { p["h" + i] = { u: RSPOT["h" + i][0], v: RSPOT["h" + i][1], face: i % 2 ? 1 : -1 }; });
    p["x:keeper"] = { u: RSPOT.keeper[0], v: RSPOT.keeper[1], face: 1 };
    if (A.t) p.t = { u: RSPOT.t[0], v: RSPOT.t[1], face: -1 };
    let n = 0;
    for (const id in A) if ((A[id].extra && id !== "x:keeper") || /^m\d/.test(id)) { const s = LOCALS[n++ % LOCALS.length]; p[id] = { u: s[0], v: s[1], face: -1 }; }
    return p;
  }
  function roomDraw(img0, b, lt) {
    let img = img0;
    const r = b.r, kit = tavernKit(!(r.hr >= 18 || r.hr < 6));
    if (!kit) { commonRoom(img, r, lt, b.A["x:keeper"].g, [b.A.l0.g, b.A.l1.g]); return; }
    const { T, R, st, ctx } = kit, now = b.t0 + lt, [p0, p1, s] = b.people;
    ctx.drawImage(kit.bg, 0, 0);
    const flick = 0.75 + Math.sin(now * 13) * 0.08 + Math.sin(now * 7.3) * 0.08;
    T.flames(ctx, st, now, R.FIRE.v0, R.FIRE.v1, flick, 1, true);
    const things = kit.furniture.map((f) => ({ key: f.key, draw: () => { ctx.drawImage(f.cv, 0, 0); if (f.at) T.candle(ctx, Math.round(f.at[0]), Math.round(f.at[1]), now, flick, 3); } }));
    const at = {};
    for (const id in p1) {
      const a0 = p0[id] || p1[id], a1 = p1[id], A = b.A[id];
      if (!A || (a0.gone && a1.gone)) continue;
      const moving = a0.u !== a1.u || a0.v !== a1.v, k = io(seg(lt, 0.1, 1.9));
      let u = a1.u, v = a1.v;
      if (moving) { [u, v] = id === "x:keeper" ? pathAt(a1.u === RSPOT.keeper[0] ? KEEPER_PATH.slice().reverse() : KEEPER_PATH, k) : [lerp(a0.u, a1.u, k), lerp(a0.v, a1.v, k)]; }
      const walking = moving && k > 0 && k < 1, face = walking ? (Math.sign((a1.u - a1.v) - (a0.u - a0.v)) || a1.face) : a1.face;
      at[id] = { u, v, face };
      if (a1.gone && k >= 1) continue;
      const g = walking ? RS.walker(A.g, Math.floor(now * 6)) : A.g, cvs = canvasOf(kit, g, face < 0);
      const dy = s ? poseDy(s, id, lt) : 0;
      things.push({ key: u + v, draw: () => { const [x, y] = st.iso(u, v); ctx.fillStyle = "rgba(20,10,4,0.35)"; ctx.fillRect(Math.round(x) - 6, Math.round(y) - 1, 12, 2); ctx.drawImage(cvs, Math.round(x - g.w / 2), Math.round(y - g.h + 1 + dy)); } });
    }
    things.sort((a, c) => a.key - c.key).forEach((t) => t.draw());
    const lights = [];
    const fireAt = st.lwall((R.FIRE.v0 + R.FIRE.v1) / 2, 8);
    lights.push({ x: fireAt[0] + 14, y: fireAt[1] + 4, r: 84, k: 0.62 + flick * 0.35 });
    for (const [lu, lv] of [[3.6, 4.0], [8.8, 6.8]]) { T.lantern(ctx, st, lu, lv, flick, 50, true); const [x, y] = st.iso(lu, lv); lights.push({ x, y: y - 40, r: 62, k: 0.5 + flick * 0.1 }); }
    for (const [x, y] of kit.candles) lights.push({ x, y: y - 5, r: 26, k: 0.5 + flick * 0.12 });
    for (const a of [9.2, 11.5]) { const [x, y] = st.rwall(a, 26); lights.push({ x, y: y + 10, r: kit.day ? 60 : 30, k: kit.day ? 0.9 : 0.5, cool: !kit.day }); }
    kit.shine(ctx, now, lights, kit.day ? 0.56 : 0.42);
    // the room is drawn whole at the tavern's own scale, the act put on it, and then the corner round the crew's table shown at
    // twice the size, as the meal replays show a tavern: hearth, bar and table, the people big enough to see what they do
    const full = new K.Buf(W, H);
    full.d.set(ctx.getImageData(0, 0, W, H).data);
    const out = img;
    img = full;
    // the act on top, in screen space: props in flight between hands, notes, hearts
    const P = {};
    for (const id in at) { const [x, y] = st.iso(at[id].u, at[id].v); P[id] = { x, y, flip: at[id].face < 0 }; }
    const I = { G: (c) => c, Gf: (c) => c, feet: 100, extras: [], place: null };
    // food is served onto the crew's table and stays there; anything else goes from hand to hand
    const [tx, ty] = st.up(st.iso(3.5, 6.1), 9), served = s && s.act === "give" && FOOD.test(s.prop || "");
    const onTable = served && lt > 2.6 ? s.prop : b.table;
    if (onTable) { const g = RActs.prop(onTable), eaten = b.eat ? Math.min(1, lt / (b.dur * 0.9)) : 0; blit(img, g, Math.round(tx - g.w / 2), Math.round(ty - g.h + 1), { clip: (x, y) => y >= Math.round(ty - g.h + 1) + Math.floor(g.h * eaten) }); }
    if (served && P[s.a]) {
      const k = seg(lt, 1.95, 2.6), [hx, hy] = [P[s.a].x + (P[s.a].flip ? -6 : 6), P[s.a].y - 14];
      if (k > 0 && k < 1) { const g = RActs.prop(s.prop); blit(img, g, Math.round(lerp(hx, tx, ease(k)) - g.w / 2), Math.round(lerp(hy, ty - g.h, k) - Math.sin(k * Math.PI) * 6), {}); }
      else if (k <= 0) holdAt(img, P, s.a, s.prop, I);
      if (lt > 2.6 && lt < 3.6) sparkle(img, tx, ty - 4, lt);
    } else if (s) actFx(img, I, r, b.A, P, s, lt);
    if (b.wide) { out.d.set(full.d); return; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4, i = ((ROOM_WIN[1] + (y >> 1)) * W + ROOM_WIN[0] + (x >> 1)) * 4;
      out.d[o] = full.d[i]; out.d[o + 1] = full.d[i + 1]; out.d[o + 2] = full.d[i + 2]; out.d[o + 3] = 255;
    }
  }
  const ROOM_WIN = [31, 34];
  const roomPx = (x, y) => [(x - ROOM_WIN[0]) * 2, (y - ROOM_WIN[1]) * 2];
  // an inn: the door by the record's hour, the common room where the line happens (or the yard, the cliff, the roof, if that is where
  // the line puts it), then back on the road or the sign creaking in the dark
  const OUTSIDE = /\b(yard|cliff|tide-pool|tide pool|roof|icicles?|sign\b|pole|door|outside|step|sacks|garden|well\b|stable|porch|fish(es|ing)?\b|line\b|hole|lake|pass(es)? \w+ |passes|walks? (past|by)|outnumber)/;
  function innFlow(r) {
    const low = String(r.line || "").toLowerCase(), stay = r.hr >= 17 || r.hr < 5;
    if (OUTSIDE.test(low) && !/\b(stew|pot|pasty|bar\b|breakfast|supper|board|slate|dice|reads?)\b/.test(low)) return storyBeats(r);
    const ctx = { heroes: r.cast.map((c) => ({ id: c.id, name: c.name })), trav: r.trav, place: r.place, pronoun: r.pronoun, hints: root.RoadHints || {} };
    const steps = RActs.script(Object.assign({}, r, { place_hint: r.place.id || null, trav_hint: r.trav ? "meet:" + (r.trav.id || r.trav.key) : null }), ctx).steps.map((s) => Object.assign({}, s));
    for (const s of steps) { for (const k of ["a", "b"]) if (s[k] === "x:innkeeper" || s[k] === "crowd") s[k] = s[k] === "crowd" ? "l0" : "x:keeper"; if (s.a === s.b) s.b = s.a === "h0" ? "x:keeper" : "h0"; if (!s.b) s.b = "x:keeper"; }
    const here = specOf(r, { place_kind: "inn", place_x: 0.6, hour: r.hr }), P = RS.scene(here, W, H).info.place, dx = P.door[0], name = cap(r.place.name || "an inn");
    const A = {};
    r.cast.forEach((c, i) => { A["h" + i] = { g: c.g, name: c.name, h: c.h, band: i }; });
    A["x:keeper"] = { g: RA.figure({ id: "innkeeper:" + (r.place.id || r.id), name: r.place.keeper || "the innkeeper", role: "innkeeper" }, 0), name: r.place.keeper || "the innkeeper", extra: true };
    if (r.trav) A.t = { g: RA.figure(r.trav.raw, 0), name: r.trav.name, trav: true };
    A.l0 = { g: RA.figure({ id: "drover:" + r.id, role: "drover" }, 0), name: "a drover", extra: true };
    A.l1 = { g: RA.figure({ id: "pedlar:" + r.id, role: "pedlar" }, 0), name: "a pedlar", extra: true };
    for (const s of steps) for (const k of [s.a, s.b]) if (k && !A[k] && k.startsWith("x:")) A[k] = { g: RA.figure({ id: "inn:" + r.id + k, role: k.slice(2) }, 0), name: "the " + k.slice(2), extra: true };
    const out = [
      B("arrive", 3.0, { spec: here, chip: name, act(img, lt, I) { drawBand(img, r, walkIn(r, lt, -20, dx - 8, 2.8), I.feet, { walk: lt < 2.8 ? Math.floor(lt * 6) : undefined, G: I.Gf }); }, sfx: [[0.1, "steps", 2.6], [0.6, "creak"], [2.0, "creak"]] }),
      B("door", 2.0, { spec: here, act(img, lt, I) {
        const k = seg(lt, 0, 0.5), lit = P.lit ? 1 : 0.35;
        for (let y = I.roadTop; y < I.roadBot + 4; y++) { const sp = (y - I.roadTop) * 0.7; for (let x = Math.round(dx - 4 - sp); x < dx + 5 + sp; x++) img.px(x, y, "#ffc860", 0.35 * k * lit * (1 - (y - I.roadTop) / 20)); }
        img.rect(dx - 4, I.roadTop - 13, 9, 13, P.lit ? "#ffcc6a" : "#3a2416", k * 0.9);
        r.cast.forEach((c, i) => { const a = 1 - seg(lt, 0.6 + i * 0.25, 1.1 + i * 0.25); if (a > 0) put(img, c.g, lerp(dx - 8 - i * 15, dx, seg(lt, 0.5 + i * 0.25, 1.1 + i * 0.25)), I.feet, { G: I.Gf, alpha: a, walk: Math.floor(lt * 6) }); });
      }, sfx: [[0.1, "door"]] }),
    ];
    let pos = roomStart(r, A);
    const mkRoom = (id, dur, o) => { const b = B(id, dur, Object.assign({ spec: here, r, A }, o)); b.draw = (img, lt) => roomDraw(img, b, lt); return b; };
    out.push(mkRoom("room", 2.8, { wide: true, chip: "The common room", people: [pos, pos, null], sfx: [[0.1, "room", 2.5], [0.3, "fire", 2.4]] }));
    let table = null;
    steps.forEach((s, i) => {
      const after = roomSettle(s, pos), kit = !!(root.Tavern && root.document), was = table;
      if (s.act === "give" && FOOD.test(s.prop || "")) table = s.prop;
      const hd = () => { const st = kit ? tavernKit(false).st : null, a = after[s.a] || after.h0; if (!st) return [120, 50]; const [x, y] = st.iso(a.u, a.v); return roomPx(x, y - 30); };
      const say = s.say ? { who: s.a, name: (A[s.a] || {}).name, h: (A[s.a] || {}).h, text: s.say, at: 0.5 } : null;
      out.push(mkRoom("act" + (i + 1), clamp(1.8 + String(s.sub || "").length * 0.045, 3.4, 6.6), { sub: s.sub, people: [pos, after, s], say, table: was, eat: !!was && /\b(finish|eats?|gone|empty|clean)/.test(String(s.sub).toLowerCase()), bubble: say ? (lt) => { const [x, y] = hd(); return { text: s.say, x, y, a: seg(lt, 0.5, 0.8) }; } : null, sfx: sfxOf(s).concat([[0.1, "room", 2]]) }));
      pos = after;
    });
    if (!stay) {
      out.push(B("out", 3.0, { spec: here, act(img, lt, I) { drawBand(img, r, walkIn(r, lt, dx + 2, W + 60, 3.0), I.feet, { walk: Math.floor(lt * 6), G: I.Gf }); }, sfx: [[0.1, "door"], [0.4, "steps", 2.5]] }));
    } else {
      const late = specOf(r, { place_kind: "inn", place_x: 0.6, hour: 23 });
      out.push(B("night", 3.0, { spec: late, chip: "The sign creaked till morning", act(img, lt, I) {
        const [a, b2, c] = I.place.windows;
        for (const [i, wpos] of [a, b2, c].entries()) if (lt > 0.6 + i * 0.6) img.rect(wpos[0] - 4, wpos[1] - 3, 9, 7, I.G("#2a3040", 0.1));
        const [dx0] = I.place.door, fl = 0.5 + Math.sin(lt * 7) * 0.06;
        glow(img, dx0 + 8, I.roadTop - 10, 18, "#ffc060", fl);
        img.px(dx0 + 8, I.roadTop - 10, "#fff0b0"); img.px(dx0 + 8, I.roadTop - 9, "#ffb040");
        glow(img, I.place.sign[0], I.place.sign[1] + 6, 10, "#ffc060", 0.25);
      }, sfx: [[0.4, "creak"], [1.6, "creak"], [2.6, "owl"]] }));
    }
    out.push(holdBeat(r, out[out.length - 1]));
    return out;
  }

  // which beats a record plays: a set piece's own (the ferry crossing, the toll, the shrine's candle, the stepping stones, a wagon in the
  // road, the Lantern Lady's question) with the line's captions on them, or the line acted out caption by caption
  const FIN = (r) => !!(r.trav && r.arc_step && r.arc_step >= (r.arc_len || 99));
  function route(r) {
    const low = String(r.line || "").toLowerCase();
    if (r.kind === "meet" || FIN(r)) return storyBeats(r, r.kind === "crossroads" ? { set: "crossroads" } : {});
    if (r.kind === "crossroads") return attach(r, crossBeats(r), [[/\b(asks?|question|which)\b/, /^question$/], [/\bcard\b/, /^card$/], [/\b(fades?|goes out|points?)\b/, /^fade$/], [/\b(lantern|light)\b/, /^(lantern|lady)$/], [/./, /^(night|lady)$/]]);
    if (r.kind === "ferry") return attach(r, ferryBeats(r).filter((b) => b.id !== "below" || /\b(below|beneath|large|pike|shadow|something|monster|serpent)\b/.test(low)), [[/\b(bell)\b/, /^bell$/], [/\b(copper|pays?|fare|counts?)\b/, /^fare$/], [/\b(ferryman|ferrywoman|poles?|hauls?|rope)\b/, /^(boat|cross)$/], [/\b(below|beneath|under|something|large|shadow)\b/, /^below$/], [/\b(mist|drifts?|crossing|water|far bank|sideways)\b/, /^(cross|boat)$/]]);
    if (r.kind === "shrine") return attach(r, shrineBeats(r), [[/\b(copper|coin|drops?|tin|bowl|flower|lace|offering)\b/, /^offer$/], [/\b(candle|lights?)\b/, /^candle$/], [/\b(flame|lean|gutter|omen|wind)\b/, /^omen$/], [/./, /^arrive$/]]);
    if (r.kind === "repair") return attach(r, repairBeats(r), [[/\b(catch(es)?|shouts?|runs?|flees?|word)\b/, /^grab$/], [/\b(hand in|helps?|lifts?|heave|shoulder|push)\b/, /^(sneak|heave|choice)$/], [/\b(mend|wheel|fix)\b/, /^mend$/], [/\b(ride|back of)\b/, /^ride$/], [/./, /^(stuck|pass)$/]]);
    if (r.kind === "toll") return attach(r, tollBeats(r), [[/\b(argues?|haggles?|complains?)\b/, /^argue1$/], [/\b(copper|pays?|drops?|box|coin)\b/, /^(pay|argue4|wave)$/], [/\b(wades?|ford|swim|freezing|hugging)\b/, /^(down|wet)$/], [/\b(bar|lifts?|planks|creak|waved)\b/, /^(lift|wave|onto)$/], [/./, /^gate$/]]);
    if (r.kind === "inn") return innFlow(r);
    if (r.place.kind === "toll" && ["argue", "ford", "pay"].includes(r.branch)) { r.kind = "toll"; return attach(r, tollBeats(r), [[/\b(argues?|haggles?)\b/, /^argue1$/], [/\b(wades?|ford|freezing|hugging)\b/, /^(down|wet)$/], [/\b(bar|lifts?|noise)\b/, /^(wave|lift)$/]]); }
    if (r.place.kind === "ford" && !/\b(fish|rod|line)\b/.test(low)) return attach(r, placeStrip(r, "ford"), [[/\b(stones?|sink|wade|cross|stepping|turtle)\b/, /^cross$/], [/./, /^come$/]]);
    return storyBeats(r);
  }

  // ---------- the plan and the frame ----------
  const plans = new Map();
  function planFor(rec, opts) {
    const key = JSON.stringify(rec);
    if (plans.has(key)) return plans.get(key);
    const r = norm(rec, opts);
    const beats = route(r);
    let t0 = 0;
    const ev = [];
    for (const b of beats) {
      b.t0 = t0; b.t1 = t0 + b.dur;
      for (const [at, name, v] of b.sfx || []) ev.push([t0 + at, name, v]);
      t0 += b.dur;
    }
    ev.sort((a, b) => a[0] - b[0]);
    const p = { r, beats, dur: t0, ev };
    if (plans.size > 16) plans.delete(plans.keys().next().value);
    plans.set(key, p);
    return p;
  }
  function beatAt(p, t) { let i = p.beats.findIndex((b) => t < b.t1); if (i < 0) i = p.beats.length - 1; return [p.beats[i], i]; }
  function paint(p, t, o) {
    o = o || {};
    const [b, i] = beatAt(p, Math.max(0, t)), lt = Math.max(0, t) - b.t0;
    let img, I;
    if (b.draw) { MOONRIM = null; LAMPS = []; FIG = null; img = new K.Buf(W, H); b.draw(img, lt); I = RS.scene(b.spec, W, H).info; }
    else {
      const sc = RS.scene(b.spec, W, H), tt = Math.max(0, t);
      I = sc.info; img = sc.base.copy();
      MOONRIM = I.nk > 0.3 && !I.dungeon ? "#b4c4f0" : null;
      LAMPS = lightsOf(I, tt); FIG = LAMPS.length || I.night ? new Uint8Array(W * H) : null;
      for (const f of sc.loops) if (f.under) f(img, tt);
      // bare: the backdrop alone (the still and its weather), what a cut cross-fades; the people and props come in whole
      if (o.bare) { for (const f of sc.loops) if (!f.under) f(img, tt); return { img, i, lt }; }
      if (p.r.scenery) p.r.scenery(img, I, tt);
      if (b.act) b.act(img, lt, I);
      for (const f of sc.loops) if (!f.under) f(img, tt);
    }
    if (o.bare) return { img, i, lt };
    if (!b.draw) lightPass(img, I, Math.max(0, t));
    if (b.win) img = zoom(img, b, lt);
    if (!b.draw) vignette(img);
    if (b.cap) nameChip(img, cap(typeof b.cap === "function" ? b.cap(lt) : b.cap), lt);
    if (b.bubble && o.bubbles !== false) { const bb = b.bubble(lt); if (bb) bubble(img, bb.text, bb.x, bb.y, bb); }
    else if (b.bubble && b.say === undefined) { const bb = b.bubble(lt); if (bb) bubble(img, bb.text, bb.x, bb.y, bb); }
    if (b.ui) b.ui(img, lt, I);
    if (b.chip) nameChip(img, b.chip, lt);
    if (b.sub) subtitle(img, b.sub, lt, b.keep);
    return { img, i, lt };
  }
  // after dusk the scene's own lights carry it: a fire, a lamp post, an inn's door and windows throw warm pools with a dithered
  // edge and everything outside them sinks toward the night, as the camp and tavern scenes are lit
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function lightsOf(I, t) {
    const hr = I.hr, dusk = hr >= 17.6 || hr < 6.2;
    if (!dusk) return [];
    const lights = [], fl = 0.92 + Math.sin(t * 11) * 0.04 + Math.sin(t * 6.3) * 0.04;
    for (const e of I.extras || []) { if (e.fire) lights.push([e.fire[0], e.fire[1] - 2, 46, 1.0 * fl]); if (e.lamp) lights.push([e.lamp[0], e.lamp[1], 40, 0.9 * fl]); }
    const P = I.place || {};
    if (P.door && P.lit) lights.push([P.door[0], I.roadTop - 6, 40, 0.8 * fl]);
    for (const w of P.windows || []) if (P.lit) lights.push([w[0], w[1], 18, 0.5]);
    if (P.candle) lights.push([P.candle[0], P.candle[1], 20, 0.6 * fl]);
    return lights;
  }
  function lightPass(img, I, t) {
    const hr = I.hr, dusk = hr >= 17.6 || hr < 6.2;
    if (!dusk) return;
    const lights = lightsOf(I, t);
    // the people are lit a step brighter than the land, so a face at night still reads as a face (skin, not grey)
    const night = I.night, amb = night ? 0.62 : 0.8, ambF = night ? 0.8 : 0.88, d = img.d;
    if (!lights.length && !night) return;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let L = 0;
      for (const [lx, ly, r, k] of lights) { const q = ((x - lx) ** 2 + ((y - ly) * 1.4) ** 2) / (r * r); if (q < 1) L += (1 - q) * (1 - q) * k; }
      const th = (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16, Lq = Math.min(1.2, Math.floor((L * 6 + th)) / 6), a = FIG && FIG[y * W + x] ? ambF : amb;
      const m = a + (1 - a) * Math.min(1, Lq) , warm = Math.min(1, Lq) * 0.32, o = (y * W + x) * 4;
      d[o] = Math.min(255, d[o] * m + 255 * warm * 0.5); d[o + 1] = Math.min(255, d[o + 1] * m + 170 * warm * 0.5); d[o + 2] = d[o + 2] * m + 60 * warm * 0.3;
    }
  }
  // the edges of an outdoor frame fall off a little, so the eye goes to the middle where the people are
  let VIG = null;
  function vignette(img) {
    if (!VIG) {
      VIG = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot((x - W / 2) / (W * 0.62), (y - H * 0.55) / (H * 0.7)), k = clamp((d - 0.62) / 0.5, 0, 1); VIG[y * W + x] = 1 - 0.3 * k * k * (3 - 2 * k); }
    }
    const d = img.d;
    for (let i = 0; i < W * H; i++) { const k = VIG[i]; if (k < 1) { d[i * 4] *= k; d[i * 4 + 1] *= k; d[i * 4 + 2] *= k; } }
  }
  const sceneOf = (b) => (b.draw ? "draw:" + (b.wide ? "wide" : "room") : JSON.stringify(b.spec || {}) + (b.win ? "|2x" : ""));
  function render(rec, t, opts) {
    const p = planFor(rec, opts), { img, i, lt } = paint(p, t, opts), b = p.beats[i], prev = p.beats[i - 1];
    // every cut is eased: within one set a short cross-fade (everyone is where the last beat left them), to another set a dip
    // through the dark, so nothing jumps
    const dip = !!prev && (b.cut === "dip" || sceneOf(prev) !== sceneOf(b)), D = dip ? 0.8 : 0.35;
    const out = new Uint8ClampedArray(W * H * 4), d = img.d;
    const was = prev && lt < D ? paint(p, b.t0 - 0.001, opts).img.d : null, k = lt / D;
    for (let o = 0; o < W * H * 4; o += 4) {
      for (let c = 0; c < 3; c++) {
        let v = d[o + c];
        if (was) v = dip ? (k < 0.5 ? was[o + c] * (1 - k * 2) + 12 * k * 2 : v * (k - 0.5) * 2 + 12 * (1 - (k - 0.5) * 2)) : was[o + c] + (v - was[o + c]) * io(k);
        out[o + c] = v;
      }
      out[o + 3] = 255;
    }
    return { w: W, h: H, data: out };
  }

  // ---------- sound: its own WebAudio context on the site's sound settings ----------
  const Snd = (() => {
    let ctx = null, out = null, noiseBuf = null, unlocked = false;
    const prefs = () => {
      if (root.Sound && root.Sound.fxPrefs) return root.Sound.fxPrefs();
      try { return Object.assign({ on: true, master: 0.7, sfx: 0.6 }, JSON.parse(root.localStorage.getItem("al.sound") || "{}")); } catch (e) { return { on: true, master: 0.7, sfx: 0.6 }; }
    };
    const open = () => unlocked || !!(root.Sound && root.Sound.unlocked);
    function init() {
      if (ctx) return ctx;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      out = ctx.createGain(); out.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }
    function ok() { const pr = prefs(); if (!open() || !pr.on || !init()) return null; if (ctx.state === "suspended") ctx.resume(); out.gain.value = pr.master * pr.sfx * 0.9; return ctx; }
    function noise(t, dur, vol, type, freq, q, f2, attack) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; s.loop = true;
      f.type = type || "lowpass"; f.frequency.setValueAtTime(freq || 800, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (attack || Math.min(0.004, dur / 4))); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    }
    function tone(t, f0, f1, dur, vol, type, attack) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.003)); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
    function ring(t, f, dur, vol) { for (const [m, a] of [[1, 1], [2.76, 0.45], [5.4, 0.2]]) tone(t, f * m, f * m * 0.997, dur / Math.sqrt(m), vol * a); }
    const FX = {
      steps: (t, secs) => { secs = Math.min(6, secs || 2); for (let k = 0; k < secs * 3.2; k++) noise(t + k * 0.31 + Math.random() * 0.03, 0.06, 0.07, "lowpass", 380 + Math.random() * 200); },
      blip: (t) => { tone(t, 660, 990, 0.08, 0.06, "square"); },
      card: (t) => { noise(t, 0.18, 0.08, "bandpass", 1400, 1.2, 600); },
      chime: (t) => { ring(t, 1047, 0.9, 0.05); ring(t + 0.12, 1319, 0.8, 0.04); ring(t + 0.24, 1568, 0.9, 0.04); },
      sparkle: (t) => { [2093, 2637, 3136].forEach((f, i) => ring(t + i * 0.07, f, 0.5, 0.03)); },
      wave: (t) => { tone(t, 520, 620, 0.12, 0.05, "triangle"); tone(t + 0.14, 620, 520, 0.14, 0.05, "triangle"); },
      scribble: (t) => { for (let i = 0; i < 7; i++) noise(t + i * 0.06 + Math.random() * 0.02, 0.04, 0.05, "bandpass", 3200 + Math.random() * 1400, 3); },
      tick: (t) => { noise(t, 0.03, 0.1, "highpass", 3000); },
      grunt: (t) => { tone(t, 140, 110, 0.18, 0.08, "sawtooth", 0.02); },
      creak: (t) => { for (let i = 0; i < 5; i++) tone(t + i * 0.05, 300 + i * 30, 260 + i * 30, 0.06, 0.04, "sawtooth"); },
      roll: (t) => { noise(t, 1.2, 0.06, "lowpass", 220, 0.7, null, 0.1); },
      hammer: (t) => { ring(t, 1800, 0.18, 0.05); noise(t, 0.04, 0.12, "highpass", 2000); },
      cheer: (t) => { tone(t, 330, 440, 0.15, 0.06, "triangle"); tone(t + 0.15, 440, 523, 0.25, 0.06, "triangle"); },
      tiptoe: (t) => { for (let k = 0; k < 6; k++) noise(t + k * 0.4, 0.03, 0.04, "bandpass", 2000, 2); },
      coins: (t) => { for (let i = 0; i < 4; i++) ring(t + i * 0.06 + Math.random() * 0.03, 2400 + Math.random() * 600, 0.2, 0.03); },
      coin: (t) => { ring(t, 2600, 0.3, 0.04); },
      bell: (t) => { ring(t, 523, 2.2, 0.09); ring(t, 784, 1.6, 0.03); },
      pole: (t) => { noise(t, 0.4, 0.07, "bandpass", 600, 1.5, 300, 0.05); },
      water: (t, secs) => { secs = Math.min(6, secs || 2); noise(t, secs, 0.04, "bandpass", 700, 0.6, null, 0.3); },
      rumble: (t) => { tone(t, 55, 42, 2.4, 0.16, "sawtooth", 0.4); noise(t, 2.2, 0.06, "lowpass", 160, 0.5, null, 0.5); },
      bubbles: (t) => { for (let i = 0; i < 5; i++) { const at = t + i * 0.12 + Math.random() * 0.05, f = 220 + Math.random() * 160; tone(at, f, f * 2.2, 0.07, 0.08); } },
      soft: (t) => { noise(t, 0.12, 0.05, "lowpass", 900); },
      strike: (t) => { noise(t, 0.15, 0.15, "highpass", 2500, 0.8, 5000); },
      candle: (t) => { noise(t, 0.6, 0.06, "lowpass", 500, 0.7, 1200, 0.1); },
      wings: (t) => { for (let i = 0; i < 4; i++) noise(t + i * 0.12, 0.08, 0.05, "bandpass", 900, 1); },
      gutter: (t) => { noise(t, 0.5, 0.06, "lowpass", 400, 0.8, 150, 0.05); },
      low: (t) => { tone(t, 110, 98, 1.6, 0.06, "triangle", 0.3); },
      chalk: (t) => { noise(t, 0.12, 0.06, "bandpass", 2600, 3, 1800); },
      wind: (t, secs) => { noise(t, Math.min(6, secs || 3), 0.05, "bandpass", 500, 0.8, 900, 0.8); },
      ghost: (t) => { tone(t, 392, 370, 2.0, 0.04, "sine", 0.8); tone(t, 587, 554, 2.0, 0.025, "sine", 0.9); },
      flip: (t) => { noise(t, 0.12, 0.1, "bandpass", 1600, 1.4, 600); },
      fade: (t) => { [784, 659, 523, 392].forEach((f, i) => tone(t + i * 0.18, f, f, 0.6, 0.03, "sine", 0.05)); },
      birds: (t) => { for (let i = 0; i < 4; i++) { const f = 2400 + Math.random() * 800; tone(t + i * 0.22, f, f * 1.3, 0.08, 0.025, "sine"); } },
      chomp: (t) => { tone(t, 150, 70, 0.1, 0.12); },
      splash: (t) => { noise(t, 0.3, 0.12, "bandpass", 900, 0.8, 300, 0.01); },
      drip: (t) => { for (let i = 0; i < 4; i++) tone(t + i * 0.3, 900, 1500, 0.05, 0.04); },
      shiver: (t) => { for (let i = 0; i < 6; i++) tone(t + i * 0.05, 300, 280, 0.04, 0.03, "square"); },
      door: (t) => { tone(t, 180, 120, 0.4, 0.06, "sawtooth", 0.05); noise(t + 0.35, 0.08, 0.1, "lowpass", 400); },
      room: (t, secs) => { secs = Math.min(8, secs || 3); noise(t, secs, 0.035, "bandpass", 520, 0.7, null, 0.4); for (let i = 0; i < secs * 1.5; i++) noise(t + Math.random() * secs, 0.2, 0.012, "bandpass", 500 + Math.random() * 700, 5); },
      fire: (t, secs) => { secs = Math.min(8, secs || 3); noise(t, secs, 0.04, "lowpass", 260, 0.7, null, 0.4); for (let at = t; at < t + secs; at += 0.08 + Math.random() * 0.3) noise(at, 0.012, 0.08, "bandpass", 2500 + Math.random() * 3000, 2.5); },
      owl: (t) => { tone(t, 420, 380, 0.3, 0.05, "sine", 0.05); tone(t + 0.45, 420, 360, 0.5, 0.05, "sine", 0.05); },
    };
    function play(name, v) { const c = ok(); if (!c || !FX[name]) return; try { FX[name](c.currentTime + 0.01, v); } catch (e) { /* audio node limits */ } }
    if (root.document) root.document.addEventListener("pointerdown", () => { unlocked = true; }, { capture: true });
    return { play, FX, get ready() { return open() && prefs().on; } };
  })();

  // ---------- the player ----------
  const reduced = () => (root.Settings && root.Settings.calm ? root.Settings.calm() : !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches));
  function player(rec, opts) {
    opts = opts || {};
    const doc = root.document, fig = doc.createElement("figure"), cv = doc.createElement("canvas");
    fig.className = "road-replay night-replay";
    cv.width = W; cv.height = H;
    cv.style.cssText = `image-rendering:pixelated;image-rendering:crisp-edges;display:block;cursor:pointer;${opts.scale ? `width:${W * opts.scale}px;height:${H * opts.scale}px` : "width:100%;height:auto"}`;
    cv.title = "Click to watch again";
    fig.appendChild(cv);
    const g = cv.getContext("2d"), img = g.createImageData(W, H);
    const p = planFor(rec, opts), still = p.beats.find((b) => b.id === "known" || b.id === "question" || b.id === "omen" || b.id === "below" || b.id === "stop" || b.id === "cross") || p.beats[Math.max(0, p.beats.length - 2)];
    // spoken lines go through Speech when it is here: words land one at a time in the speaker's own voice
    const talk = root.Speech && root.Speech.layer ? root.Speech.layer(fig, (a) => { const k = cv.clientWidth / W; return [a.at[0] * k, a.at[1] * k]; }) : null;
    const o2 = Object.assign({}, opts, { bubbles: !talk });
    let t = reduced() ? still.t0 + Math.min(1.6, still.dur - 0.01) : 0, raf = 0, last = 0, onscreen = false, fired = 0, said = -1, lastDraw = -1, rate = 1, held = false, forced = false;
    const paintNow = () => { const f = render(rec, t, o2); img.data.set(f.data); g.putImageData(img, 0, 0); };
    const live = () => !held && fig.isConnected && onscreen && !doc.hidden;
    function speak() {
      if (!talk) return;
      const [b, i] = beatAt(p, t);
      if (!b.say || said === i || t - b.t0 < b.say.at) return;
      said = i;
      const bb = b.bubble ? b.bubble(b.say.at + 0.5) : null, sp = p.r.trav || { id: "someone", name: "" };
      const who = b.say.name ? { name: b.say.name, h: b.say.h || { id: "road:" + b.say.who + ":" + b.say.name } } : { name: sp.name, h: { id: "road:" + (sp.key || sp.id) } };
      talk.say(Object.assign(who, { at: bb ? [bb.x, bb.y - 4] : [W / 2, 40] }), b.say.text, Math.max(1.2, (b.t1 - t) / rate - 0.3));
    }
    function frame(ms) {
      raf = 0;
      if (!live()) { last = 0; return; }
      const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
      last = ms;
      t += dt * rate;
      while (fired < p.ev.length && p.ev[fired][0] <= t) { const e = p.ev[fired]; if (t - e[0] < 0.25) Snd.play(e[1], e[2]); fired++; }
      speak();
      const end = t >= p.dur;
      if (!end || t - lastDraw > 1 / 10) { paintNow(); lastDraw = t; }
      if (t < p.dur + 30) raf = root.requestAnimationFrame(frame);
    }
    const wake = () => { if ((forced || !reduced()) && !raf && live()) { last = 0; raf = root.requestAnimationFrame(frame); } };
    const restart = () => { held = false; t = 0; fired = 0; said = -1; lastDraw = -1; paintNow(); wake(); };
    cv.addEventListener("click", restart);
    if ("IntersectionObserver" in root) {
      const ob = new root.IntersectionObserver((es) => { onscreen = es[es.length - 1].isIntersecting; if (!fig.isConnected && t > 0) { ob.disconnect(); return; } wake(); });
      ob.observe(fig);
    } else onscreen = true;
    doc.addEventListener("visibilitychange", wake);
    fig.replay = {
      get t() { return t; }, get dur() { return p.dur; }, get playing() { return !held && t < p.dur && (forced || !reduced()); },
      play() { held = false; forced = true; if (talk && talk.hold) talk.hold(false); wake(); },
      pause() { held = true; if (talk && talk.hold) talk.hold(true); },
      restart() { forced = true; restart(); },
      skip() { t = p.dur; fired = p.ev.length; lastDraw = -1; paintNow(); wake(); },
      rate(s) { rate = s; },
    };
    paintNow();
    wake();
    return fig;
  }

  root.RoadReplay = {
    player, W, H, KINDS: ["meet", "repair", "ferry", "shrine", "crossroads", "toll", "inn", "strip"],
    frame: render, _plan: (rec, opts) => planFor(rec, opts),
    length: (rec, opts) => planFor(rec, opts).dur,
    beats: (rec, opts) => planFor(rec, opts).beats.map((b) => ({ id: b.id, t0: b.t0, t1: b.t1 })),
    events: (rec, opts) => planFor(rec, opts).ev.slice(),
    sound: Snd,
  };
})(typeof window !== "undefined" ? window : globalThis);
