/* Road replays: a road record dressed in beats on the road strip (a meeting, a broken wagon, a ferry, a shrine, the crossroads at night, a toll, an inn, the plain walk), with synthesised sound; the record decides everything, the replay only shows it. */
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
  Needs road_scenes.js, road_art.js and food_art.js (the pixel font); loaded with them through App.need (replay.js KIT.road).
*/
(function (root) {
  "use strict";
  const RS = root.RoadScenes, RA = root.RoadArt, K = RS.kit, FK = root.FoodArt.kit;
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
    r.cast = (r.heroes || []).slice(0, 4).map((x) => heroOf(x, opts));
    if (!r.cast.length) r.cast = [heroOf({ id: "someone", name: "someone" }, opts)];
    r.trav = r.traveller ? RA.spec(r.traveller) : null;
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
  function put(img, g, cx, feet, o) {
    o = o || {};
    if (!g) return;
    const fr = o.walk !== undefined ? RS.walker(g, o.walk) : g;
    blit(img, fr, Math.round(cx - fr.w / 2), Math.round(feet - fr.h + 1 + (o.dy || 0)), { G: o.G, depth: 0, flip: o.flip, alpha: o.alpha, clip: o.clip, map: o.map });
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
    let bx = Math.round(clamp(x - w / 2, 3, W - w - 3)), by = Math.round(clamp(y - h - 6, 3, H - h - 3));
    if (o.a !== undefined && o.a < 1) { by += Math.round((1 - o.a) * 4); }
    panel(img, bx, by, w, h, { edge: "#2a1a12" });
    const tx = clamp(Math.round(x), bx + 4, bx + w - 5);
    for (let k = 0; k < 4; k++) for (let i = -2 + k; i <= 2 - k; i++) img.px(tx + i - k, by + h + k, k === 0 ? PAPER : "#2a1a12");
    img.px(tx - 2, by + h, "#2a1a12"); img.px(tx + 2, by + h, "#2a1a12");
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

  function meetBeats(r) {
    const sp = r.trav || RA.spec({ id: "stranger", name: "a stranger", role: "pilgrim" });
    r.trav = sp;
    const crew = sp.kind === "crew", back = crew ? 30 : 0, met = r.met > 1;
    const place = r.place.kind && r.place.kind !== "milestone" ? r.place.kind : null;
    const bg = specOf(r, place ? { place_kind: place, place_x: 0.86 } : {});
    const bgPart = specOf(r, { place_kind: "milestone", place_x: 0.56 });
    const say = r.say || (crew ? "Well met, well met." : "Well met.");
    return [
      B("ahead", 2.6, { spec: bg, cap: r.place.name || (met ? "a familiar figure" : "a figure ahead"), act(img, lt, I) {
        drawBand(img, r, walkIn(r, lt, -10, 66, 2.6), I.feet, { walk: Math.floor(lt * 6), G: I.Gf });
        const tx = walkIn(r, lt, W + 30 + back, 196, 2.6);
        drawTrav(img, r, tx, I.feet, { flip: true, walk: Math.floor(lt * 5), G: I.Gf });
        dust(img, tx + 8, I.feet, lt, 4);
      }, sfx: [[0.1, "steps", 2.4]] }),
      B("closer", 1.8, { spec: bg, act(img, lt, I) {
        drawBand(img, r, walkIn(r, lt, 66, 88, 1.2), I.feet, { walk: lt < 1.2 ? Math.floor(lt * 6) : undefined, G: I.Gf });
        drawTrav(img, r, walkIn(r, lt, 196, 150 + back * 0.3, 1.2), I.feet, { flip: true, walk: lt < 1.2 ? Math.floor(lt * 5) : undefined, G: I.Gf });
      }, ui(img, lt) { pop(img, met ? "?" : "!", 88, FEET() - 38, lt - 0.9); }, sfx: [[0.9, "blip"]] }),
      B("known", 3.0, { spec: bg, act(img, lt, I) { drawBand(img, r, 88, I.feet, { G: I.Gf }); drawTrav(img, r, 150 + back * 0.3, I.feet, { flip: true, G: I.Gf }); },
        ui(img, lt) { knownCard(img, r, lt); }, sfx: [[0.15, "card"], [0.5, met ? "chime" : "blip"]] }),
      B("talk", 3.8, { spec: bg, cap: "walking together", say: { who: "trav", text: say, at: 0.3 }, act(img, lt, I) {
        const x = 88 + lt * 4;
        drawBand(img, r, x, I.feet, { walk: Math.floor(lt * 4), G: I.Gf });
        drawTrav(img, r, x + 44 + back * 0.3, I.feet, { walk: Math.floor(lt * 4) + 1, G: I.Gf });
      }, bubble: (lt) => ({ text: say, x: 88 + lt * 4 + 44 + back * 0.3, y: FEET() - 34, a: seg(lt, 0.3, 0.6) }), sfx: [[0.1, "steps", 3.6]] }),
      B("beat", 2.6, { spec: bg, act(img, lt, I) {
        const x = 103;
        drawBand(img, r, x, I.feet, { G: I.Gf, hop: lt > 0.6 && lt < 0.9 ? 2 : 0 });
        drawTrav(img, r, x + 44 + back * 0.3, I.feet, { G: I.Gf });
        outcomeProp(img, r, x + 22, I.feet - 30, lt);
      }, ui(img, lt) { if (lt > 0.4) tag(img, outcomeWord(r), 125, 24, "#ffe08a"); }, sfx: [[0.5, "sparkle"]] }),
      B("part", 3.0, { spec: bgPart, cap: "parting at a milestone", act(img, lt, I) {
        const k = seg(lt, 0.7, 3.0);
        drawBand(img, r, lerp(118, 250, k * k), I.feet, { walk: k > 0 ? Math.floor(lt * 6) : undefined, G: I.Gf, hop: lt > 0.2 && lt < 0.5 ? 2 : 0 });
        drawTrav(img, r, lerp(150, -60, k * k) , I.feet + 1, { flip: k > 0, walk: k > 0 ? Math.floor(lt * 6) : undefined, G: I.Gf });
      }, sfx: [[0.2, "wave"], [0.8, "steps", 2]] }),
      B("line", 3.6, { spec: bgPart, ui(img, lt) { lineCard(img, r, lt); }, sfx: [[0.15, "scribble"]] }),
    ];
  }
  function outcomeWord(r) {
    const o = String(r.outcome || r.branch || "").toLowerCase();
    const MAP = { rumour: "a rumour", gift: "a gift", joke: "...", race: "a race!", push: "heave!", ride: "a ride", ring: "a cold ring", letter: "a letter", song: "half a song", supper: "supper", map: "a map", bout: "a bout!", none: "", help: "helped" };
    return MAP[o] !== undefined ? MAP[o] : o.replace(/_/g, " ");
  }
  function outcomeProp(img, r, x, y, lt) {
    const o = String(r.outcome || "").toLowerCase(), k = ease(seg(lt, 0.3, 0.8)), yy = Math.round(y - k * 6);
    if (lt < 0.3) return;
    if (o === "rumour" || o === "letter" || o === "map") { img.rect(x - 5, yy, 10, 7, PAPER); img.rect(x - 5, yy, 10, 1, "#b8a07a"); for (let i = 0; i < 3; i++) img.rect(x - 3, yy + 2 + i * 2, 6, 1, "#6a5236"); img.px(x + 3, yy + 6, RUBRIC); }
    else if (o === "joke") { text(img, "*ahem*", x - 13, yy + 6, "#f6ead0", { outline: "#2a1a12" }); }
    else { for (let i = 0; i < 5; i++) { const a = lt * 3 + i * 1.3, rr = 4 + k * 4; img.px(x + Math.cos(a) * rr, yy + Math.sin(a) * rr * 0.6, "#ffe08a"); } glow(img, x, yy, 5, "#ffe08a", 0.6 * k); }
  }

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
        bubble: (lt) => (lt > 1.4 ? { text: "*bites it*", x: KX, y: FEET() - 34 } : null), sfx: [[0.3, "coin"], [0.6, "coin"], [1.5, "chomp"]] }),
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

  function innBeats(r) {
    // the inn at the record's own hour: a night's stay ends on the sign creaking in the dark; a call in daylight is the common room
    // and back on the road, and a line that only passes the inn walks by its door
    const hr = r.hr, stay = hr >= 17 || hr < 5, pass = /\b(pass(es|ing)?|walks? past|walks? by)\b/i.test(String(r.line || ""));
    const here = specOf(r, { place_kind: "inn", place_x: 0.6, hour: hr }), late = specOf(r, { place_kind: "inn", place_x: 0.6, hour: 23 });
    const P = RS.scene(here, W, H).info.place;
    const keeper = RA.figure({ id: "innkeeper:" + (r.place.id || r.id), name: "the innkeeper", role: "innkeeper" }, 0);
    const pats = [RA.figure({ id: "drover:" + r.id, role: "drover" }, 0), RA.figure({ id: "pedlar:" + r.id, role: "pedlar" }, 0)];
    const dx = P.door[0], name = cap(r.place.name || "an inn");
    const arrive = B("arrive", 3.0, { spec: here, cap: name + ", " + when(hr), act(img, lt, I) {
      if (pass) put(img, keeper, dx + 14, I.feet, { G: I.Gf, flip: true });
      drawBand(img, r, walkIn(r, lt, -20, dx - 8, 2.8), I.feet, { walk: lt < 2.8 ? Math.floor(lt * 6) : undefined, G: I.Gf });
    }, sfx: [[0.1, "steps", 2.6], [0.6, "creak"], [2.0, "creak"]] });
    if (pass) return [arrive,
      B("nod", 2.6, { spec: here, act(img, lt, I) { put(img, keeper, dx + 14, I.feet, { G: I.Gf, flip: true, dy: lt > 0.6 && lt < 0.9 ? 1 : 0 }); drawBand(img, r, dx - 8, I.feet, { G: I.Gf }); },
        ui(img, lt) { pop(img, "!", dx + 14, FEET() - 38, lt - 0.4); }, sfx: [[0.4, "blip"]] }),
      B("by", 3.0, { spec: here, cap: "and on up the road", act(img, lt, I) { put(img, keeper, dx + 14, I.feet, { G: I.Gf, flip: lt < 1.2 }); drawBand(img, r, walkIn(r, lt, dx - 8, W + 60, 3.0), I.feet + 2, { walk: Math.floor(lt * 6), G: I.Gf }); }, sfx: [[0.1, "steps", 2.9]] }),
      B("line", 3.6, { spec: here, ui(img, lt) { lineCard(img, r, lt); }, sfx: [[0.15, "scribble"]] })];
    const out = [arrive,
      B("door", 2.2, { spec: here, act(img, lt, I) {
        const k = seg(lt, 0, 0.5), lit = P.lit ? 1 : 0.35;
        for (let y = I.roadTop; y < I.roadBot + 4; y++) { const sp = (y - I.roadTop) * 0.7; for (let x = Math.round(dx - 4 - sp); x < dx + 5 + sp; x++) img.px(x, y, "#ffc860", 0.35 * k * lit * (1 - (y - I.roadTop) / 20)); }
        img.rect(dx - 4, I.roadTop - 13, 9, 13, P.lit ? "#ffcc6a" : "#3a2416", k * 0.9);
        r.cast.forEach((c, i) => { const a = 1 - seg(lt, 0.6 + i * 0.25, 1.1 + i * 0.25); if (a > 0) put(img, c.g, lerp(dx - 8 - i * 15, dx, seg(lt, 0.5 + i * 0.25, 1.1 + i * 0.25)), I.feet, { G: I.Gf, alpha: a, walk: Math.floor(lt * 6) }); });
      }, sfx: [[0.1, "door"]] }),
      B("room", 3.8, { spec: here, cap: "the common room", draw(img, lt) { commonRoom(img, r, lt, keeper, pats); }, sfx: [[0.1, "room", 3.7], [0.3, "fire", 3.5]] })];
    if (!stay) {
      out.push(B("out", 3.0, { spec: here, cap: "back on the road", act(img, lt, I) { drawBand(img, r, walkIn(r, lt, dx + 2, W + 60, 3.0), I.feet, { walk: Math.floor(lt * 6), G: I.Gf }); }, sfx: [[0.1, "door"], [0.4, "steps", 2.5]] }));
      out.push(B("line", 3.6, { spec: here, ui(img, lt) { lineCard(img, r, lt); }, sfx: [[0.15, "scribble"]] }));
      return out;
    }
    return out.concat([
      B("night", 3.0, { spec: late, cap: "the sign creaked till morning", act(img, lt, I) {
        const [a, b, c] = I.place.windows;
        for (const [i, wpos] of [a, b, c].entries()) if (lt > 0.6 + i * 0.6) img.rect(wpos[0] - 4, wpos[1] - 3, 9, 7, I.G("#2a3040", 0.1));
        // the lamp by the door stays lit all night, and catches the sign as it swings
        const [dx0] = I.place.door, fl = 0.5 + Math.sin(lt * 7) * 0.06;
        glow(img, dx0 + 8, I.roadTop - 10, 18, "#ffc060", fl);
        img.px(dx0 + 8, I.roadTop - 10, "#fff0b0"); img.px(dx0 + 8, I.roadTop - 9, "#ffb040");
        glow(img, I.place.sign[0], I.place.sign[1] + 6, 10, "#ffc060", 0.25);
      }, sfx: [[0.4, "creak"], [1.6, "creak"], [2.6, "owl"]] }),
      B("line", 3.6, { spec: late, ui(img, lt) { lineCard(img, r, lt); }, sfx: [[0.15, "scribble"]] }),
    ]);
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
  function stripBeats(r) {
    const pk = PLACE_X[r.place.kind] ? r.place.kind : null, d = r.dress, any = pk || d.who || d.cart || d.mule || d.turtle || d.heron || d.bird;
    if (any) return placeStrip(r, pk);
    const bg = specOf(r);
    const dd = 9.6;
    const walk = (img, lt0, I) => drawBand(img, r, lerp(-20, W + 50, lt0 / dd), I.feet, { walk: Math.floor(lt0 * 6), G: I.Gf });
    return [
      B("set", 3.2, { spec: bg, cap: { forest: "the forest road", marsh: "the marsh road", hills: "the hill road", snow: "the high road", coast: "the cliff road", volcanic: "the burnt road", dungeon: "the last mile" }[r.biome] || "the road", act(img, lt, I) { walk(img, lt, I); }, sfx: [[0.1, "steps", 3.1]] }),
      B("miles", 3.2, { spec: bg, act(img, lt, I) { walk(img, lt + 3.2, I); }, sfx: [[0.1, "steps", 3.1]] }),
      B("on", 3.2, { spec: bg, act(img, lt, I) { walk(img, lt + 6.4, I); }, sfx: [[0.1, "steps", 3]] }),
      B("line", 3.6, { spec: bg, ui(img, lt) { lineCard(img, r, lt); }, sfx: [[0.15, "scribble"]] }),
    ];
  }

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

  // ---------- the plan and the frame ----------
  const plans = new Map();
  function planFor(rec, opts) {
    const key = JSON.stringify(rec);
    if (plans.has(key)) return plans.get(key);
    const r = norm(rec, opts);
    const beats = { meet: meetBeats, repair: repairBeats, ferry: ferryBeats, shrine: shrineBeats, crossroads: crossBeats, toll: tollBeats, inn: innBeats, strip: stripBeats }[r.kind](r);
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
    if (b.draw) { img = new K.Buf(W, H); b.draw(img, lt); I = RS.scene(b.spec, W, H).info; }
    else {
      const sc = RS.scene(b.spec, W, H), tt = Math.max(0, t);
      I = sc.info; img = sc.base.copy();
      for (const f of sc.loops) if (f.under) f(img, tt);
      // bare: the backdrop alone (the still and its weather), what a cut cross-fades; the people and props come in whole
      if (o.bare) { for (const f of sc.loops) if (!f.under) f(img, tt); return { img, i, lt }; }
      if (p.r.scenery) p.r.scenery(img, I, tt);
      if (b.act) b.act(img, lt, I);
      for (const f of sc.loops) if (!f.under) f(img, tt);
    }
    if (o.bare) return { img, i, lt };
    if (b.cap) caption(img, typeof b.cap === "function" ? b.cap(lt) : b.cap);
    if (b.bubble && o.bubbles !== false) { const bb = b.bubble(lt); if (bb) bubble(img, bb.text, bb.x, bb.y, bb); }
    else if (b.bubble && b.say === undefined) { const bb = b.bubble(lt); if (bb) bubble(img, bb.text, bb.x, bb.y, bb); }
    if (b.ui) b.ui(img, lt, I);
    return { img, i, lt };
  }
  function render(rec, t, opts) {
    const p = planFor(rec, opts), { img, i, lt } = paint(p, t, opts);
    const out = new Uint8ClampedArray(W * H * 4), fade = i > 0 && lt < FADE ? lt / FADE : 1;
    // a cut cross-fades the backdrop only, from the beat before's to this one's: whatever this beat draws over its backdrop (the
    // band, a traveller, a cart, a caption) stands there whole from the first frame, so no figure is ever seen half through another
    const bareOpts = Object.assign({}, opts, { bare: true });
    const prev = fade < 1 ? paint(p, p.beats[i].t0 - 0.001, bareOpts).img : null, bare = prev ? paint(p, t, bareOpts).img : null, k = io(fade);
    const d = img.d;
    for (let o = 0; o < W * H * 4; o += 4) {
      if (prev && d[o] === bare.d[o] && d[o + 1] === bare.d[o + 1] && d[o + 2] === bare.d[o + 2]) {
        out[o] = prev.d[o] + (d[o] - prev.d[o]) * k; out[o + 1] = prev.d[o + 1] + (d[o + 1] - prev.d[o + 1]) * k; out[o + 2] = prev.d[o + 2] + (d[o + 2] - prev.d[o + 2]) * k;
      } else { out[o] = d[o]; out[o + 1] = d[o + 1]; out[o + 2] = d[o + 2]; }
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
      talk.say({ name: sp.name, h: { id: "road:" + (sp.key || sp.id) }, at: bb ? [bb.x, bb.y - 4] : [W / 2, 40] }, b.say.text, Math.max(1.2, (b.t1 - t) / rate - 0.3));
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
    frame: render,
    length: (rec, opts) => planFor(rec, opts).dur,
    beats: (rec, opts) => planFor(rec, opts).beats.map((b) => ({ id: b.id, t0: b.t0, t1: b.t1 })),
    events: (rec, opts) => planFor(rec, opts).ev.slice(),
    sound: Snd,
  };
})(typeof window !== "undefined" ? window : globalThis);
