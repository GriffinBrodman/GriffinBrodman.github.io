/* Scene kits, shared by every pixel scene that stages the world's lines (road replays now, town days next): animals with their gaits, carts and stalls and roadside things, the busiest places' own dressing, and weather that rolls in mid-scene. */
/*
  SceneKits.sprite(id, frame)   -> a grid at people scale facing right (frame 0/1: legs, a peck, a wingbeat); null for an unknown id.
  SceneKits.BIRDS               -> the ids that fly; ANIMALS, CARTS -> every id sprite() draws; PLACES -> every dressed place id.
  SceneKits.dress(img, I, id, t) -> draws a place's own dressing over its set piece (I.place: the piece's anchors, I.G a grader);
                                    false if that place has none. SceneKits.addDress(id, fn) and addSprite(id, fn) extend the kits.
  SceneKits.weather(img, I, kind, k, t) -> fog rolling in, sudden rain, a gust of wind, dusk swallows (k: how far in, 0-1).
  Images are RoadScenes buffers (px, rect, line); needs road_scenes.js (kit.painted, blit) and road_art.js (the old horse, the mule).
*/
(function (root) {
  "use strict";
  const RS = root.RoadScenes, K = RS.kit, { clamp, lerp, h2 } = K;
  const memo = new Map();
  const P = (key, w, h, pal, fn) => { if (!memo.has(key)) memo.set(key, K.painted(w, h, pal, fn)); return memo.get(key); };

  // ---------- animals: every sprite faces right, frame 1 is the other step (legs swapped, head down, wings up) ----------
  const FUR = { hide: "#8a5a32", hided: "#5a3a20", horn: "#e2d6b8", hoof: "#2e241e", nose: "#d8a088" };
  const A = {
    ox: (f) => P("ox" + f, 36, 25, Object.assign({}, FUR, { hide: "#7a4e2c" }), (p) => {
      p.layer = 1;
      for (const [x, k] of [[6, 0], [11, 1], [23, 0], [28, 1]]) p.rect(x + (k === f ? 1 : 0), 15, 3, 8, "hided", -0.2);
      p.layer = 2;
      p.ell(17, 11, 13, 7, "hide", { s: 0.15 }); p.ell(13, 6, 6, 3, "hide", { s: 0.35 });
      p.ell(31, 11 + f, 4.4, 4.2, "hide", { s: 0.2 }); p.ell(33, 14 + f, 2.6, 2, "nose", { s: 0.2 });
      p.line(28, 7 + f, 25, 4 + f, "horn", 0.3); p.line(34, 7 + f, 36, 4 + f, "horn", 0.3);
      p.line(4, 10, 2, 18, "hided", 0);
      for (const x of [6, 11, 23, 28]) p.rect(x, 23, 3, 2, "hoof", 0);
    }),
    dog: (f) => P("dog" + f, 20, 14, { coat: "#a8743e", coatd: "#6a4424", nose: "#1e1614", tongue: "#d8606a" }, (p) => {
      p.layer = 1;
      for (const [x, k] of [[4, 0], [7, 1], [13, 0], [16, 1]]) p.rect(x, 9 + (k === f ? 0 : 1), 2, 4 - (k === f ? 0 : 1), "coatd", -0.1);
      p.layer = 2;
      p.ell(10, 7, 7, 3.4, "coat", { s: 0.2 }); p.ell(16, 4 - f, 3.2, 3, "coat", { s: 0.3 }); p.rect(18, 4 - f, 2, 2, "coat", 0.1); p.px(19, 4 - f, "nose");
      p.rect(14, 1 - f, 2, 2, "coatd", 0); p.line(3, 6, 0, 2 + f * 2, "coat", 0.2); if (f) p.px(18, 6, "tongue");
    }),
    cat: (f) => P("cat" + f, 16, 12, { fur: "#5a5a62", furd: "#3a3a42", eye: "#d8c040" }, (p) => {
      p.layer = 1;
      for (const x of [3, 6, 10, 12]) p.rect(x, 8, 1, 3 + (f && x % 2 ? -1 : 0), "furd", 0);
      p.layer = 2;
      p.ell(8, 6.5, 5.4, 2.8, "fur", { s: 0.2 }); p.ell(13, 4, 2.6, 2.4, "fur", { s: 0.3 });
      p.px(12, 1, "fur", 0.2); p.px(14, 1, "fur", 0.2); p.px(14, 4, "eye", 0.4);
      p.line(2, 6, 0, 1 + f * 2, "fur", 0);
    }),
    hare: (f) => P("hare" + f, 16, 13, { fur: "#9a7a52", furd: "#6a5236", tail: "#efe6d4" }, (p) => {
      p.layer = 2;
      if (f) { p.ell(7, 8, 5.5, 3, "fur", { s: 0.2 }); p.rect(3, 10, 6, 2, "furd", 0); }
      else { p.ell(7, 7, 4.4, 4, "fur", { s: 0.2 }); p.ell(6, 11, 4, 1.4, "furd", { s: 0 }); }
      p.ell(12, 5 + f, 2.4, 2.2, "fur", { s: 0.3 }); p.line(11, 3 + f, 10, 0 + f, "furd", 0.1); p.line(12, 3 + f, 12, 0 + f, "fur", 0.2);
      p.ell(2.5, 7, 1.4, 1.4, "tail", { s: 0.3 });
    }),
    fox: (f) => P("fox" + f, 22, 13, { fur: "#c8642a", furd: "#8a3e1a", white: "#f0e6d4", sock: "#2a1a14" }, (p) => {
      p.layer = 1;
      for (const [x, k] of [[6, 0], [9, 1], [14, 0], [17, 1]]) p.rect(x, 8, 2, 4 + (k === f ? 0 : -1), "sock", 0);
      p.layer = 2;
      p.ell(12, 6.5, 6.5, 3, "fur", { s: 0.2 }); p.ell(18, 4, 3, 2.6, "fur", { s: 0.3 }); p.rect(20, 5, 2, 1, "white", 0.2); p.px(21, 4, "sock");
      p.px(17, 1, "furd"); p.px(19, 1, "furd");
      p.ell(4, 6 - f, 4, 2.2, "fur", { s: 0.15 }); p.ell(1, 6 - f, 1.4, 1.4, "white", { s: 0.3 });
    }),
    owl: (f) => P("owl" + f, 12, 14, { feather: "#8a6a42", featherd: "#5a4228", face: "#e8dcc0", eye: "#f0c040", beak: "#3a2a1a" }, (p) => {
      p.layer = 2;
      p.ell(6, 8, 4.6, 5.4, "feather", { s: 0.15, fn: (x, y, s) => s + ((x + y) % 3 === 0 ? -0.2 : 0) });
      if (f) { p.line(1, 7, -1, 3, "featherd", 0); p.line(11, 7, 13, 3, "featherd", 0); }
      p.ell(6, 5, 3.6, 2.6, "face", { s: 0.2 }); p.px(4, 5, "eye"); p.px(8, 5, "eye"); p.px(6, 6, "beak");
      p.px(3, 1, "featherd"); p.px(9, 1, "featherd");
    }),
    crow: (f) => P("crow" + f, 12, 9, { black: "#1e1a24", sheen: "#3a3a5a", beak: "#4a4038" }, (p) => {
      p.layer = 2;
      p.ell(5, 5, 4, 2.6, "black", { s: 0.1 }); p.ell(9, 3 + f, 2, 2, "black", { s: 0.2 }); p.px(11, 3 + f, "beak"); p.px(12, 4 + f, "beak");
      p.line(1, 5, -1, 4, "black", 0); p.px(4, 4, "sheen", 0.4);
      if (f) p.line(4, 3, 2, 0, "black", 0);
      p.px(5, 8, "beak"); p.px(7, 8, "beak");
    }),
    magpie: (f) => P("magpie" + f, 14, 9, { black: "#1e1a24", white: "#f0f0ea", blue: "#3a5a9a", beak: "#2a2a2a" }, (p) => {
      p.layer = 2;
      p.ell(6, 5, 4, 2.4, "black", { s: 0.1 }); p.ell(6, 6, 2.4, 1.4, "white", { s: 0.2 }); p.ell(10, 3 + f, 2, 1.8, "black", { s: 0.2 }); p.px(12, 3 + f, "beak");
      p.line(2, 4, -2, 2, "blue", 0.1); p.line(2, 5, -2, 3, "black", 0); p.px(5, 4, "blue", 0.3);
      p.px(6, 8, "beak"); p.px(8, 8, "beak");
    }),
    rooster: (f) => P("rooster" + f, 14, 15, { body: "#c86a2a", bodyd: "#8a3a1a", tail: "#2a4a3a", comb: "#d8302a", beak: "#e8b040", leg: "#d8a040" }, (p) => {
      p.layer = 1;
      p.line(1, 3, 4, 8, "tail", 0.2); p.line(2, 2, 5, 7, "tail", 0); p.line(0, 5, 4, 9, "tail", -0.2);
      p.layer = 2;
      p.ell(7, 8, 4.4, 3.6, "body", { s: 0.2 }); p.ell(10, 4 - f, 2, 2.4, "body", { s: 0.3 });
      p.rect(10, 0 - f + 1, 2, 2, "comb", 0.2); p.px(12, 4 - f, "beak"); p.px(10, 6 - f, "comb");
      p.line(6, 11, 6, 14, "leg", 0); p.line(8, 11, 8 + f, 14, "leg", 0);
    }),
    hen: (f) => P("hen" + f, 11, 10, { body: "#c8a070", bodyd: "#8a6a40", comb: "#c8302a", beak: "#e8b040", leg: "#d8a040" }, (p) => {
      p.layer = 2;
      p.ell(5, 5 + f, 3.8, 2.8, "body", { s: 0.2 }); p.ell(8 + f, 3 + f * 2, 1.8, 1.8, "body", { s: 0.3 });
      p.px(8 + f, 1 + f * 2, "comb"); p.px(10 + f, 3 + f * 2, "beak"); p.line(1, 3, 2, 5, "bodyd", 0);
      p.px(4, 9, "leg"); p.px(6, 9, "leg");
    }),
    goose: (f) => P("goose" + f, 15, 15, { white: "#f0ece2", grey: "#b8b4a8", beak: "#e88a2a" }, (p) => {
      p.layer = 2;
      p.ell(6, 10, 5, 3.4, "white", { s: 0.15 }); p.line(2, 9, 0, 8, "grey", 0);
      p.line(10, 9, 11 + f * 2, 3 + f * 4, "white", 0.2, 1); p.ell(12 + f * 2, 3 + f * 4, 1.8, 1.6, "white", { s: 0.3 }); p.px(14 + f * 2, 3 + f * 4, "beak");
      p.px(5, 14, "beak"); p.px(7, 14, "beak");
    }),
    sheep: (f) => P("sheep" + f, 20, 16, { wool: "#ece6d8", woold: "#c8c0b0", face: "#3a2e2a", leg: "#2a2420" }, (p) => {
      p.layer = 1;
      for (const [x, k] of [[5, 0], [8, 1], [12, 0], [15, 1]]) p.rect(x, 11, 1, 4 - (k === f ? 0 : 1), "leg", 0);
      p.layer = 2;
      p.ell(10, 8, 7.4, 4.6, "wool", { s: 0.2, fn: (x, y, s) => s + (((x * 3 + y * 5) % 4) === 0 ? -0.25 : 0) });
      p.ell(17, 6 + f, 2.4, 2.4, "face", { s: 0.2 }); p.px(15, 5 + f, "woold");
    }),
    goat: (f) => P("goat" + f, 20, 18, { coat: "#d8d0c0", coatd: "#9a9080", horn: "#6a5a48", hoof: "#2a2420", beard: "#efe6d4" }, (p) => {
      p.layer = 1;
      for (const [x, k] of [[5, 0], [8, 1], [13, 0], [15, 1]]) p.rect(x, 12, 1, 5 - (k === f ? 0 : 1), "coatd", 0);
      p.layer = 2;
      p.ell(10, 10, 6.6, 3.6, "coat", { s: 0.2 }); p.ell(16, 6 + f, 2.4, 2.8, "coat", { s: 0.3 });
      p.line(15, 3 + f, 13, 0 + f, "horn", 0.1); p.line(16, 3 + f, 15, 0 + f, "horn", 0.2); p.px(17, 9 + f, "beard"); p.px(17, 10 + f, "beard");
      p.line(4, 9, 3, 7, "coatd", 0);
    }),
    deer: (f) => P("deer" + f, 24, 26, { coat: "#a8703e", coatd: "#6e4424", belly: "#e8d6b8", antler: "#d8c8a0", hoof: "#2a2018" }, (p) => {
      p.layer = 1;
      for (const [x, k] of [[6, 0], [9, 1], [16, 0], [19, 1]]) p.rect(x, 16, 1, 9 - (k === f ? 0 : 1), "coatd", 0);
      p.layer = 2;
      p.ell(12, 14, 8, 4, "coat", { s: 0.2 }); p.ell(12, 16, 5, 1.6, "belly", { s: 0.3 });
      p.line(18, 12, 20, 6 + f, "coat", 0.2, 1.4); p.ell(21, 5 + f, 2.4, 2, "coat", { s: 0.3 });
      p.line(20, 3 + f, 18, 0 + f, "antler", 0.2); p.line(22, 3 + f, 24, 0 + f, "antler", 0.2); p.line(19, 1 + f, 17, 1 + f, "antler", 0.1);
      p.px(4, 12, "belly");
    }),
    eel: (f) => P("eel" + f, 22, 7, { eel: "#4a5a3a", eeld: "#2e3a24", eye: "#e8d870" }, (p) => {
      p.layer = 2;
      for (let x = 0; x < 20; x++) p.ell(x + 1, 3.5 + Math.sin(x / 3 + f * 1.6) * 1.6, 1.4, 1.4, x > 16 ? "eel" : "eeld", { s: 0.2 });
      p.px(19, 3 + Math.round(Math.sin(19 / 3 + f * 1.6) * 1.6), "eye");
    }),
    crab: (f) => P("crab" + f, 14, 9, { shell: "#d0503a", shelld: "#8a2a1e", eye: "#1a1414" }, (p) => {
      p.layer = 2;
      p.ell(7, 5, 4.6, 2.6, "shell", { s: 0.2 });
      p.ell(1.8, 3 - f, 1.6, 1.4, "shell", { s: 0.3 }); p.ell(12.2, 3 - (1 - f), 1.6, 1.4, "shell", { s: 0.3 });
      for (const x of [3, 5, 9, 11]) p.px(x, 8, "shelld"); p.px(6, 2, "eye"); p.px(8, 2, "eye");
    }),
    gull: (f) => P("gull" + f, 14, 8, { white: "#f0f0ea", grey: "#a8b0b8", tip: "#2a2a30", beak: "#e8b040" }, (p) => {
      p.layer = 2;
      p.ell(7, 5, 3.4, 2, "white", { s: 0.2 }); p.ell(10, 4, 1.6, 1.4, "white", { s: 0.3 }); p.px(12, 4, "beak");
      if (f) { p.line(6, 4, 1, 0, "grey", 0.1); p.line(8, 4, 13, 0, "grey", 0.1); p.px(1, 0, "tip"); p.px(13, 0, "tip"); }
      else { p.line(4, 4, 8, 4, "grey", 0); p.px(3, 5, "tip"); }
    }),
    swallow: (f) => P("swallow" + f, 10, 6, { blue: "#2a3a6a", red: "#b8402c", white: "#efe6d4" }, (p) => {
      p.layer = 2;
      p.ell(5, 3, 2.4, 1.2, "blue", { s: 0.2 }); p.px(7, 3, "red"); p.px(5, 4, "white");
      if (f) { p.line(4, 2, 1, 0, "blue", 0); p.line(6, 2, 8, 0, "blue", 0); } else { p.line(4, 3, 0, 5, "blue", 0); p.line(6, 3, 9, 5, "blue", 0); }
      p.line(2, 3, 0, 2, "blue", 0); p.line(2, 3, 0, 4, "blue", 0);
    }),
    pig: (f) => P("pig" + f, 22, 15, { pink: "#e0a090", pinkd: "#b8706a", snout: "#f0b8a8" }, (p) => {
      p.layer = 1;
      for (const [x, k] of [[5, 0], [8, 1], [14, 0], [17, 1]]) p.rect(x, 10, 2, 4 - (k === f ? 0 : 1), "pinkd", 0);
      p.layer = 2;
      p.ell(11, 7, 8, 4.4, "pink", { s: 0.2 }); p.ell(19, 7 + f, 2.4, 2, "snout", { s: 0.2 }); p.px(20, 7 + f, "pinkd");
      p.px(16, 3, "pinkd"); p.line(2, 6, 0, 4, "pinkd", 0);
    }),
    rat: (f) => P("rat" + f, 13, 6, { fur: "#6a6058", nose: "#d8a0a0" }, (p) => {
      p.layer = 2;
      p.ell(6, 3, 3.6, 2, "fur", { s: 0.2 }); p.ell(10, 3, 1.8, 1.4, "fur", { s: 0.3 }); p.px(12, 3, "nose");
      p.line(2, 3, 0, 1 + f * 3, "nose", 0);
    }),
    bees: () => null,
  };
  A.cow = (f) => P("cow" + f, 36, 25, { hide: "#efe6d8", hided: "#4a3a32", horn: "#e2d6b8", hoof: "#2e241e", nose: "#e8b0a0" }, (p) => {
    p.layer = 1;
    for (const [x, k] of [[6, 0], [11, 1], [23, 0], [28, 1]]) p.rect(x + (k === f ? 1 : 0), 15, 3, 8, x < 20 ? "hide" : "hided", -0.15);
    p.layer = 2;
    p.ell(17, 11, 13, 7, "hide", { s: 0.15 }); p.ell(13, 9, 4.5, 3.4, "hided", { s: 0 }); p.ell(23, 12, 3, 2.6, "hided", { s: -0.1 });
    p.ell(31, 11 + f, 4.4, 4.2, "hide", { s: 0.2 }); p.ell(33, 14 + f, 2.6, 2, "nose", { s: 0.2 });
    p.line(28, 7 + f, 27, 5 + f, "horn", 0.3); p.line(34, 7 + f, 35, 5 + f, "horn", 0.3);
    p.line(4, 10, 2, 18, "hided", 0);
    for (const x of [6, 11, 23, 28]) p.rect(x, 23, 3, 2, "hoof", 0);
  });
  A.heron = (f) => P("heron" + f, 14, 22, { grey: "#a8b0b8", greyd: "#6a7480", white: "#e8e4dc", beak: "#d8a838", leg: "#c8a050" }, (p) => {
    p.layer = 2;
    p.line(6, 14, 6, 21, "leg", 0); p.line(8, 14, 8, 21, "leg", 0);
    p.ell(7, 11, 4, 3.6, "grey", { s: 0.2 }); p.line(3, 11, 1, 14, "greyd", 0);
    p.line(9, 9, 10, 4 + f * 4, "white", 0.2); p.ell(10, 3 + f * 4, 1.6, 1.4, "white", { s: 0.3 }); p.line(12, 3 + f * 4, 14, 3 + f * 5, "beak", 0.2);
  });
  A.horse = (f) => root.RoadArt.oldHorse(f);
  A.mule = (f) => root.RoadArt.figure("fourth_best", f, "reputation");
  const BIRDS = new Set(["crow", "magpie", "owl", "gull", "swallow"]);

  // ---------- carts and stalls ----------
  const WOOD = { wood: "#8a5a32", woodd: "#5a3a20", iron: "#4a4650", canvas: "#e8dcc0", red: "#b8402c", gold: "#d8a838", green: "#4e7a34" };
  const wheel = (p, cx, cy, r, f) => { p.ell(cx, cy, r, r, "woodd", { s: 0, fn: (x, y, s) => ((x - cx) ** 2 + (y - cy) ** 2 < (r - 1.4) ** 2 ? false : s) }); for (let a = 0; a < 4; a++) { const an = a * Math.PI / 4 + f * 0.4; p.line(cx - Math.cos(an) * (r - 1), cy - Math.sin(an) * (r - 1), cx + Math.cos(an) * (r - 1), cy + Math.sin(an) * (r - 1), "wood", 0); } p.ell(cx, cy, 1.2, 1.2, "iron", { s: 0.3 }); };
  const C = {
    cart: (f) => P("cart" + f, 46, 26, Object.assign({ hay: "#e0bc5a" }, WOOD), (p) => {
      p.layer = 1;
      p.ell(22, 8, 18, 7, "hay", { s: 0.25, fn: (x, y, s) => (y > 12 ? false : s + ((x + y) % 4 === 0 ? -0.3 : 0)) });
      p.layer = 2;
      p.rect(2, 12, 40, 6, "wood", (x, y) => (y === 12 ? 0.4 : x % 8 === 0 ? -0.3 : 0)); p.rect(41, 15, 5, 1, "woodd", 0);
      p.layer = 3; wheel(p, 10, 20, 5.5, f); wheel(p, 34, 20, 5.5, f);
    }),
    tinker: (f) => P("tinker" + f, 54, 40, WOOD, (p) => {
      p.layer = 1;
      p.poly([[4, 6], [46, 6], [48, 26], [2, 26]], "green", (x, y) => 0.3 - (y - 6) * 0.03 + (Math.round(x) % 7 === 0 ? -0.3 : 0));
      p.poly([[6, 2], [44, 2], [46, 8], [4, 8]], "red", (x) => 0.2 + (Math.round(x) % 6 < 3 ? 0.1 : -0.1));
      for (const [x, m] of [[10, "iron"], [18, "gold"], [26, "iron"], [34, "gold"]]) { p.line(x, 8, x, 12, "iron", 0); p.ell(x, 14, 2.4, 2, m, { s: 0.3 }); }
      p.layer = 2;
      p.rect(0, 26, 50, 6, "wood", (x, y) => (y === 26 ? 0.4 : x % 8 === 0 ? -0.3 : 0)); p.rect(48, 29, 6, 1, "woodd", 0);
      p.rect(38, 14, 6, 9, "woodd", -0.2); p.px(42, 18, "gold", 0.4);
      p.layer = 3; wheel(p, 10, 33, 6, f); wheel(p, 40, 33, 6, f);
    }),
    menagerie: (f) => P("menagerie" + f, 54, 40, Object.assign({ bear: "#7a5236", bars: "#d8a838", cage: "#2a1e18" }, WOOD), (p) => {
      p.layer = 1;
      p.rect(4, 4, 42, 22, "cage", -0.2);
      p.ell(24 + f, 18, 7, 6, "bear", { s: 0.2 }); p.ell(29 + f, 13, 3.6, 3.2, "bear", { s: 0.3 }); p.px(30 + f, 12, "cage");
      p.layer = 2;
      for (let x = 5; x < 46; x += 4) p.rect(x, 4, 1, 22, "bars", 0.3);
      p.rect(2, 2, 46, 3, "red", 0.2); p.rect(2, 1, 46, 1, "gold", 0.4);
      p.rect(0, 26, 50, 6, "wood", (x, y) => (y === 26 ? 0.4 : x % 8 === 0 ? -0.3 : 0)); p.rect(48, 29, 6, 1, "woodd", 0);
      p.layer = 3; wheel(p, 10, 33, 6, f); wheel(p, 40, 33, 6, f);
    }),
    stall: () => P("stallthing", 40, 34, Object.assign({ awn: "#b8402c", awn2: "#efe6d4", apple: "#c8402c" }, WOOD), (p) => {
      p.layer = 1;
      for (const x of [2, 36]) p.rect(x, 6, 2, 28, "wood", 0);
      p.layer = 2;
      for (let x = 0; x < 40; x++) for (let y = 2; y < 9; y++) p.px(x, y, Math.floor(x / 5) % 2 ? "awn" : "awn2", 0.2 - (y - 2) * 0.03);
      p.layer = 3;
      p.rect(0, 22, 40, 12, "wood", (x, y) => (y === 22 ? 0.4 : x % 9 === 0 ? -0.3 : 0.05));
      for (let k = 0; k < 6; k++) p.ell(5 + k * 6, 20, 2.4, 2, k % 2 ? "apple" : "gold", { s: 0.25 });
    }),
    press: () => P("press", 26, 30, Object.assign({ apple: "#c8402c", juice: "#e8b040" }, WOOD), (p) => {
      p.layer = 1;
      for (const x of [3, 21]) p.rect(x, 2, 2, 28, "wood", 0);
      p.rect(3, 2, 20, 3, "woodd", 0.1); p.rect(12, 5, 2, 9, "iron", 0.2);
      p.layer = 2;
      p.ell(13, 18, 8, 6, "woodd", { s: 0, fn: (x, y, s) => (y < 15 ? false : s) }); p.rect(6, 14, 15, 2, "wood", 0.3);
      for (let k = 0; k < 4; k++) p.ell(8 + k * 4, 13, 1.6, 1.4, "apple", { s: 0.3 });
      p.rect(20, 22, 4, 2, "juice", 0.3); p.ell(23, 27, 3, 2.4, "wood", { s: 0.2 });
    }),
    oven: () => P("oven", 30, 26, { stone: "#9a8a76", stoned: "#6a5c4c", fire: "#ff8a2a", glow: "#ffd060", soot: "#2a1e18" }, (p) => {
      p.layer = 1;
      p.ell(15, 14, 13, 11, "stone", { s: 0.15, fn: (x, y, s) => (y > 23 ? false : s + ((x + Math.floor(y / 3) * 2) % 5 === 0 ? -0.3 : 0)) });
      p.layer = 2;
      p.ell(15, 18, 5, 4.4, "soot", { s: -0.3, fn: (x, y, s) => (y > 22 ? false : s) }); p.ell(15, 21, 3.4, 1.6, "fire", { s: 0.3 }); p.px(15, 19, "glow", 0.5);
      p.rect(0, 23, 30, 3, "stoned", 0); p.rect(20, 0, 4, 6, "stoned", -0.1);
    }),
    well: () => P("well", 26, 32, Object.assign({ stone: "#9a968e", rope: "#c4a26a", slate: "#5a6070" }, WOOD), (p) => {
      p.layer = 1;
      for (const x of [3, 21]) p.rect(x, 4, 2, 18, "wood", 0);
      p.poly([[0, 6], [13, 0], [26, 6]], "slate", (x) => 0.3 - (x - 13) * 0.03);
      p.line(5, 9, 21, 9, "woodd", 0); p.line(13, 9, 13, 17, "rope", 0.2); p.rect(11, 17, 4, 3, "woodd", 0.1);
      p.layer = 2;
      p.ell(13, 26, 11, 5.6, "stone", { s: 0.15, fn: (x, y, s) => (y < 22 ? false : s + ((x + Math.floor(y / 2) * 3) % 5 === 0 ? -0.3 : 0)) });
    }),
    skep: () => P("skep", 14, 14, { straw: "#d8a848", strawd: "#9a7230", door: "#2a1a10", wood: "#8a5a32" }, (p) => {
      p.layer = 2; p.ell(7, 7, 6, 6, "straw", { s: 0.2, fn: (x, y, s) => (y > 11 ? false : s + (y % 2 ? -0.25 : 0)) }); p.rect(5, 9, 3, 2, "door", 0); p.rect(0, 12, 14, 2, "wood", 0);
    }),
    washing: () => P("washing", 70, 34, Object.assign({ shirt: "#efe6d4", blue: "#4a6a9a", red: "#b8402c", yellow: "#e8c060" }, WOOD), (p) => {
      // a washing line strung across the road on two poles, a whole wardrobe pegged out on it
      p.layer = 1; for (const x of [1, 67]) p.rect(x, 2, 2, 32, "wood", 0);
      p.layer = 2; for (let x = 3; x < 67; x++) p.px(x, 4 + Math.round(Math.sin((x - 3) / 64 * Math.PI) * 4), "woodd", 0);
      [[8, 10, 9, "shirt"], [20, 8, 12, "blue"], [31, 12, 7, "yellow"], [42, 9, 11, "red"], [54, 10, 8, "shirt"]].forEach(([x, w, h, m]) => { const y = 5 + Math.round(Math.sin((x - 3) / 64 * Math.PI) * 4); p.rect(x, y, w, h, m, (xx, yy) => 0.2 - (yy - y) * 0.03); if (m === "blue") { p.rect(x, y + h, 3, 5, m, -0.1); p.rect(x + w - 3, y + h, 3, 5, m, -0.1); } });
    }),
    bush: () => P("bush", 34, 20, { leaf: "#4e7a34", leafd: "#2e5224", berry: "#5a2a5a", thorn: "#6a4a2a" }, (p) => {
      p.layer = 2;
      for (const [cx, cy, r] of [[8, 12, 8], [18, 9, 9], [27, 12, 7]]) p.ell(cx, cy, r, r * 0.8, "leaf", { s: 0.15, fn: (x, y, s) => s + ((x * 3 + y * 5) % 7 === 0 ? -0.35 : 0) });
      for (let k = 0; k < 12; k++) p.px(4 + (k * 7) % 27, 6 + (k * 5) % 10, "berry", 0.3);
    }),
    tree: () => P("tree", 40, 58, { bark: "#6a4a30", barkd: "#4a3020", leaf: "#4e7a34", leafd: "#2e5224" }, (p) => {
      p.layer = 1; p.rect(16, 26, 8, 32, "bark", (x) => (x < 18 ? 0.25 : x > 21 ? -0.3 : 0)); p.rect(12, 54, 16, 4, "barkd", 0);
      p.layer = 2; for (const [cx, cy, r] of [[20, 16, 15], [9, 22, 9], [31, 22, 9]]) p.ell(cx, cy, r, r * 0.85, "leaf", { s: 0.15, fn: (x, y, s) => s + ((x * 3 + y * 7) % 9 === 0 ? -0.35 : 0) });
    }),
    bench: () => P("bench", 30, 14, WOOD, (p) => { p.layer = 1; for (const x of [3, 25]) p.rect(x, 6, 2, 8, "woodd", 0); p.layer = 2; p.rect(0, 4, 30, 3, "wood", (x, y) => (y === 4 ? 0.4 : 0)); for (let k = 0; k < 3; k++) p.ell(8 + k * 6, 3, 2, 1.4, k % 2 ? "iron" : "woodd", { s: 0.2 }); }),
    barrel: () => P("barrel", 14, 18, WOOD, (p) => { p.layer = 2; p.ell(7, 9, 6.4, 8.6, "wood", { s: 0.15, fn: (x, y, s) => (y % 6 === 2 ? -0.2 : s) }); for (const y of [3, 14]) p.rect(1, y, 12, 1, "iron", 0.2); p.rect(2, 0, 10, 2, "woodd", 0.3); }),
    crate: () => P("crate", 16, 13, WOOD, (p) => { p.layer = 2; p.rect(0, 0, 16, 13, "wood", (x, y) => (x === 0 || y === 0 ? 0.3 : (x + y) % 6 === 0 ? -0.3 : 0)); p.line(0, 0, 15, 12, "woodd", 0); }),
    haystack: () => P("haystack", 34, 26, { hay: "#e0bc5a", hayd: "#b08a3a" }, (p) => { p.layer = 2; p.ell(17, 15, 16, 12, "hay", { s: 0.2, fn: (x, y, s) => (y > 25 ? false : s + ((x + y * 2) % 5 === 0 ? -0.35 : 0)) }); }),
    gate: () => P("gate", 38, 22, WOOD, (p) => { p.layer = 1; for (const x of [0, 35]) p.rect(x, 0, 3, 22, "woodd", 0.1); p.layer = 2; for (const y of [4, 11, 18]) p.rect(3, y, 32, 2, "wood", 0.2); p.line(3, 19, 34, 5, "wood", 0); }),
    stile: () => P("stile", 24, 20, WOOD, (p) => { p.layer = 1; for (const x of [2, 20]) p.rect(x, 0, 2, 20, "woodd", 0); p.layer = 2; for (const y of [6, 13]) p.rect(0, y, 24, 2, "wood", 0.2); p.rect(6, 15, 12, 2, "wood", 0.35); }),
    board: () => P("board", 26, 34, Object.assign({ paper: "#efe2c2" }, WOOD), (p) => { p.layer = 1; for (const x of [3, 21]) p.rect(x, 10, 2, 24, "woodd", 0); p.layer = 2; p.rect(0, 0, 26, 16, "wood", (x, y) => (y === 0 ? 0.4 : 0)); for (const [x, y, w, h] of [[2, 2, 8, 9], [12, 3, 6, 6], [19, 2, 5, 10], [12, 10, 6, 4]]) p.rect(x, y, w, h, "paper", 0.2 - (y + 0) * 0.01); }),
    pool: () => P("pool", 40, 10, { rock: "#7a766e", water: "#3e6e98", glint: "#a8d0e8" }, (p) => { p.layer = 2; p.ell(20, 5, 19, 4.6, "rock", { s: 0.1 }); p.ell(20, 5, 15, 3, "water", { s: 0.2 }); p.px(14, 4, "glint", 0.4); p.px(25, 5, "glint", 0.4); }),
    leanto: () => P("leanto", 36, 28, Object.assign({ thatch: "#c8a050" }, WOOD), (p) => { p.layer = 1; for (const x of [2, 32]) p.rect(x, 8, 2, 20, "woodd", 0); p.layer = 2; p.poly([[0, 10], [36, 2], [36, 6], [0, 14]], "thatch", (x) => 0.2 - x * 0.005); }),
    boat: () => P("boatthing", 38, 12, WOOD, (p) => { p.layer = 2; p.poly([[0, 2], [38, 2], [33, 11], [5, 11]], "wood", (x, y) => 0.3 - (y - 2) * 0.06 + (x % 7 === 0 ? -0.2 : 0)); p.rect(0, 1, 38, 2, "woodd", 0.2); }),
    standing: () => P("standing", 16, 34, { stone: "#8e8a84", moss: "#5a7a3a" }, (p) => { p.layer = 2; p.poly([[3, 34], [2, 6], [7, 0], [13, 4], [14, 34]], "stone", (x, y) => 0.25 - (x - 3) * 0.05 + ((x + y * 3) % 7 === 0 ? -0.2 : 0)); for (let k = 0; k < 6; k++) p.px(4 + k, 28 + (k % 2), "moss", 0.1); }),
    puppets: () => P("puppets", 34, 40, Object.assign({ cloth: "#b8402c", cloth2: "#e8c060", dark: "#2a1a24" }, WOOD), (p) => { p.layer = 1; p.rect(2, 4, 30, 36, "cloth", (x) => (Math.floor(x / 5) % 2 ? 0.1 : -0.1)); p.layer = 2; p.rect(6, 8, 22, 12, "dark", -0.2); p.rect(0, 0, 34, 5, "cloth2", 0.2); p.rect(6, 19, 22, 2, "wood", 0.3); }),
    signpost: () => P("signpost", 34, 40, Object.assign({ paint: "#e8dcc0" }, WOOD), (p) => { p.layer = 1; p.rect(16, 4, 3, 36, "woodd", (x) => (x === 16 ? 0.3 : -0.2)); p.layer = 2; p.poly([[19, 6], [32, 6], [34, 9], [32, 12], [19, 12]], "wood", 0.25); p.poly([[16, 15], [3, 15], [0, 18], [3, 21], [16, 21]], "wood", 0.1); for (const [x, y] of [[22, 9], [26, 9], [6, 18], [10, 18]]) p.rect(x, y, 3, 1, "paint", 0.3); }),
    mushrooms: () => P("mushrooms", 34, 8, { cap: "#c8402c", spot: "#f4efe4", stem: "#e8dcc0", grass: "#5e8a3a" }, (p) => { p.layer = 2; for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, x = 17 + Math.cos(a) * 14, y = 4 + Math.sin(a) * 2.6; p.rect(x, y + 1, 1, 2, "stem", 0.2); p.ell(x, y, 1.8, 1.2, "cap", { s: 0.3 }); p.px(x, y - 1, "spot", 0.4); } }),
    ladder: () => P("ladder", 14, 44, WOOD, (p) => { p.layer = 2; p.line(2, 44, 4, 0, "wood", 0.2); p.line(11, 44, 13, 0, "wood", 0); for (let y = 4; y < 44; y += 6) p.line(3 + (44 - y) * -0.04 + 1, y, 12, y, "woodd", 0.1); }),
    scarecrow: (f) => P("scarecrow" + f, 22, 34, Object.assign({ straw: "#e0bc5a", coat: "#6a5a8a", hat: "#4a3a2a", face: "#d8c090" }, WOOD), (p) => {
      p.layer = 1; p.rect(10, 8, 2, 26, "wood", 0); p.line(0, 13 + f, 21, 13 - f, "wood", 0);
      p.layer = 2; p.rect(6, 12, 10, 11, "coat", 0.1); p.ell(11, 7, 3.6, 3.6, "face", { s: 0.2 }); p.rect(6, 3, 10, 2, "hat", 0); p.rect(8, 0, 6, 3, "hat", 0.1);
      for (const x of [0, 21]) p.line(x, 13, x, 16, "straw", 0.2); p.px(10, 7, "hat"); p.px(12, 7, "hat");
    }),
  };
  const sprite = (id, f) => { const fn = A[id] || C[id]; return fn ? fn(f ? 1 : 0) : null; };

  // ---------- the busiest places' own dressing, drawn over their set piece ----------
  const dot = (img, I, x, y, c, d) => img.px(x, y, I.G(c, d || 0.12));
  const B = (img, I, g, x, y, o) => K.blit(img, g, Math.round(x), Math.round(y), Object.assign({ G: I.G, depth: 0.1 }, o || {}));
  const DRESS = {
    // the shrine's wall of carved names, and a row of candles in jars along its foot
    quiet_names(img, I, t) {
      const p = I.place; if (!p || !p.top) return false;
      const x0 = p.top[0] + 16, y0 = I.roadTop - 16;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 34; x++) { const edge = y === 0 || x === 0 || x === 33; dot(img, I, x0 + x, y0 + y, edge ? "#6a6660" : (x * 3 + y * 7) % 11 === 0 ? "#86827a" : "#a8a49a", 0.12); }
      for (let r = 0; r < 4; r++) for (let x = 2; x < 31; x += 1) if (h2(x, r, 7) > 0.45) dot(img, I, x0 + x, y0 + 3 + r * 3, "#5a5650", 0.12);
      for (let k = 0; k < 5; k++) { const cx = x0 + 3 + k * 7, cy = I.roadTop; dot(img, I, cx, cy - 1, "#c8d8e0"); dot(img, I, cx, cy - 2, "#efe2c2"); const fl = Math.sin(t * 6 + k) > 0; img.px(cx, cy - 3 - (fl ? 1 : 0), "#ffc850"); img.px(cx, cy - 4, "#ffe8a0", 0.5); }
      return true;
    },
    // the Scratched Stone: names and tallies cut all over its face
    scratched_stone(img, I) {
      const p = I.place; if (!p || !p.top) return false;
      for (let k = 0; k < 14; k++) { const x = p.top[0] - 5 + Math.floor(h2(k, 1, 3) * 10), y = p.top[1] + 5 + Math.floor(h2(k, 2, 3) * 18); dot(img, I, x, y, "#4a4640"); if (k % 3) dot(img, I, x + 1, y + (k % 2), "#4a4640"); }
      return true;
    },
    // the Four Stones: a crude map scratched on the lowest, a pebble left on each
    four_stones(img, I) {
      const p = I.place; if (!p || !p.heap) return false;
      for (const [dx, dy] of [[-32, -12], [24, -11], [-22, -2], [16, -1]]) dot(img, I, p.x + dx + 4, I.roadTop + dy - 22, "#d8e0e8");
      return true;
    },
    // Wetfoot Ford: a post of boots hung up to dry and a hand-painted sign
    wetfoot_ford(img, I) {
      const p = I.place; if (!p || !p.river) return false;
      const x = p.river[0] - 14, y = I.roadTop;
      for (let j = 0; j < 22; j++) dot(img, I, x, y - j, "#5a3a22", 0.1);
      img.rect(x - 7, y - 24, 15, 6, I.G("#c89a52", 0.1)); img.rect(x - 6, y - 22, 13, 1, I.G("#5a3a22", 0.1));
      for (const [bx, by] of [[x - 4, y - 14], [x + 2, y - 12]]) { img.rect(bx, by, 3, 4, I.G("#4a2e1c", 0.1)); img.rect(bx, by + 4, 5, 2, I.G("#4a2e1c", 0.1)); dot(img, I, bx + 1, by - 1, "#c4a26a"); }
      return true;
    },
    // the Reed and Rooster: a weathervane cockerel, reeds by the wall, hens about the door
    reed_and_rooster(img, I, t) {
      const p = I.place; if (!p || !p.chimney) return false;
      B(img, I, sprite("rooster", 0), p.chimney[0] - 30, p.gy - 12);
      for (let k = 0; k < 9; k++) { const x = p.door[0] - 34 + k * 3, h = 6 + (k % 3) * 2; for (let j = 0; j < h; j++) dot(img, I, x + (j > h - 3 ? 1 : 0), I.roadTop - j, j === h - 1 ? "#8a6a3a" : "#7a8a4a"); }
      for (let k = 0; k < 2; k++) B(img, I, sprite("hen", Math.floor(t * 2 + k) % 2), p.door[0] + 12 + k * 12, I.roadTop - 9, { flip: k === 1 });
      return true;
    },
    // the Halfway Hen: hens in the yard
    halfway_hen(img, I, t) {
      const p = I.place; if (!p || !p.door) return false;
      for (let k = 0; k < 3; k++) B(img, I, sprite("hen", Math.floor(t * 2 + k) % 2), p.door[0] - 26 + k * 10, I.roadTop - 9, { flip: k % 2 === 1 });
      return true;
    },
    // the Last Dry Sock: a sock on a pole for a sign
    last_dry_sock(img, I, t) {
      const p = I.place; if (!p || !p.door) return false;
      const x = p.door[0] - 22;
      for (let j = 0; j < 30; j++) dot(img, I, x, I.roadTop - j, "#5a3a22");
      const sw = Math.round(Math.sin(t * 2) * 1);
      img.rect(x + 1, I.roadTop - 30, 4, 7, I.G("#c8402c", 0.1)); img.rect(x + 1 + sw, I.roadTop - 23, 7, 3, I.G("#c8402c", 0.1)); img.rect(x + 1, I.roadTop - 28, 4, 1, I.G("#efe6d4", 0.1));
      return true;
    },
    // Salt & Sorrow: nets drying on poles and a lobster pot by the door
    salt_and_sorrow(img, I) {
      const p = I.place; if (!p || !p.door) return false;
      const x = p.door[0] + 46;
      for (const px of [x, x + 16]) for (let j = 0; j < 18; j++) dot(img, I, px, I.roadTop - j, "#5a3a22");
      for (let y = 0; y < 10; y++) for (let k = 0; k < 15; k++) if ((k + y) % 3 === 0) dot(img, I, x + 1 + k, I.roadTop - 17 + y + Math.round(Math.sin(k / 4) * 1.5), "#c4a26a");
      img.rect(p.door[0] - 18, I.roadTop - 5, 8, 5, I.G("#8a5a32", 0.1)); for (let k = 0; k < 8; k += 2) dot(img, I, p.door[0] - 18 + k, I.roadTop - 4, "#3a2416");
      return true;
    },
    // the Gannet ferry: gannets on the landing posts
    gannet_ferry(img, I, t) {
      const p = I.place; if (!p || !p.landing) return false;
      for (const [k, x] of [[0, p.landing[0] - 6], [1, p.landing[1] + 1]]) B(img, I, sprite("gull", Math.sin(t * 3 + k) > 0.8 ? 1 : 0), x, I.roadTop - 14, { flip: k === 1 });
      return true;
    },
    // the Miller's Tankard: grain sacks stacked by the door like bar stools
    millers_tankard(img, I) {
      const p = I.place; if (!p || !p.door) return false;
      for (const [dx, dy] of [[-22, 0], [-16, 0], [-19, -5]]) { const x = p.door[0] + dx, y = I.roadTop + dy; for (let j = 0; j < 6; j++) for (let i = -2; i <= 2; i++) dot(img, I, x + i, y - j, j === 5 ? "#8a6a40" : i > 1 ? "#a88a5a" : "#d8c090"); }
      return true;
    },
    // Gull's Rest: gulls along the roof ridge
    gulls_rest(img, I, t) {
      const p = I.place; if (!p || !p.gy) return false;
      for (let k = 0; k < 4; k++) B(img, I, sprite("gull", Math.sin(t * 2.4 + k * 1.7) > 0.85 ? 1 : 0), p.door[0] - 26 + k * 13, p.gy + 6 - Math.abs(k - 1.5) * 4, { flip: k % 2 === 1 });
      return true;
    },
    // the Pickaxe Rest: crossed picks over the door and an ore tub
    pickaxe_rest(img, I) {
      const p = I.place; if (!p || !p.door) return false;
      const x = p.door[0], y = I.roadTop - 24;
      for (const d of [-1, 1]) { for (let k = 0; k < 9; k++) dot(img, I, x + d * (k - 4), y + k, "#6a4a2a"); for (let k = -2; k <= 2; k++) dot(img, I, x + d * -4 + k, y - 1 + Math.abs(k), "#8a8a92"); }
      img.rect(x + 24, I.roadTop - 6, 10, 6, I.G("#5a5a62", 0.1)); for (let k = 0; k < 4; k++) dot(img, I, x + 25 + k * 2, I.roadTop - 7, k % 2 ? "#8a7a6a" : "#c8963a");
      return true;
    },
  };
  DRESS.pitmens_rest = DRESS.pickaxe_rest;
  function dress(img, I, id, t) { const f = DRESS[id]; return f ? f(img, I, t || 0) !== false : false; }

  // ---------- weather that arrives during a beat ----------
  function weather(img, I, kind, k, t) {
    if (kind === "fog") {
      // a fog bank rolls in from the right and settles
      const front = lerp(I.w + 40, -40, k);
      for (let y = I.hz - 10; y < I.h; y++) for (let x = Math.max(0, Math.floor(front) - 40); x < I.w; x++) {
        const n = K.fbm((x + t * 6) / 34, y / 9, 41, 2), edge = clamp((x - front) / 40, 0, 1);
        const a = clamp((n - 0.3) * 1.3, 0, 0.7) * edge * (y > I.hz && y < I.roadBot + 8 ? 1 : 0.5);
        if (a > 0) img.px(x, y, "#d8dcd6", a);
      }
    } else if (kind === "rain") {
      // a sudden shower: the light drops, drops slant down harder and harder, splashes on the road
      const n = Math.round(30 + 160 * k);
      for (let i = 0; i < I.w * I.h; i += 4) { const x = i % I.w, y = Math.floor(i / I.w); if ((x + y) % 2 === 0) img.px(x, y, "#2a3448", 0.12 * k); }
      for (let i = 0; i < n; i++) { const x = (h2(i, 1, 9) * (I.w + 40) - (t * 70) % 40 + 40) % (I.w + 20), y = (h2(i, 2, 9) * I.h + t * 160) % I.h; img.line(x, y, x - 2, y + 5, "#b8c8e0", 0.55); }
      for (let i = 0; i < n / 6; i++) { const ph = (t * 3 + i / 7) % 1, x = h2(i, 3, 9) * I.w, y = I.roadTop + h2(i, 4, 9) * (I.roadBot - I.roadTop); if (ph < 0.3) { img.px(x - 1, y, "#d8e4f0", 0.6); img.px(x + 1, y, "#d8e4f0", 0.6); } }
    } else if (kind === "wind") {
      // a gust: streaks and leaves across the frame
      for (let i = 0; i < 18; i++) { const x = (h2(i, 5, 2) * I.w + t * 140) % (I.w + 30) - 15, y = I.hz - 20 + h2(i, 6, 2) * 70 + Math.sin(t * 4 + i) * 3; if (i % 3) img.line(x, y, x - 10, y, "#f4f0e4", 0.35 * k); else { img.px(x, y, "#c8903a", k); img.px(x + 1, y + 1, "#8a6a2a", k); } }
    } else if (kind === "swallows") {
      // dusk swallows wheeling low over the road
      for (let i = 0; i < 6; i++) { const ph = t * 0.6 + i * 1.3, x = I.w / 2 + Math.sin(ph) * (60 + i * 10), y = I.hz - 4 + Math.sin(ph * 2.1 + i) * 14; K.blit(img, sprite("swallow", Math.floor(t * 8 + i) % 2), Math.round(x - 5), Math.round(y - 3), { flip: Math.cos(ph) < 0 }); }
    }
  }

  const addDress = (id, fn) => { DRESS[id] = fn; }, addSprite = (id, fn) => { A[id] = fn; };
  root.SceneKits = { sprite, dress, weather, addDress, addSprite, BIRDS, ANIMALS: Object.keys(A).filter((k) => k !== "bees"), CARTS: Object.keys(C), PLACES: Object.keys(DRESS) };
})(typeof window !== "undefined" ? window : globalThis);
