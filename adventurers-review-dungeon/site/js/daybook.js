/* The daybook: a hero's day as an almanac strip of hours, dawn to dusk, with a night cap; Daybook.render(daybook, opts). */
/*
  Daybook.render(daybook, opts) -> <figure class="daybook"> or null when there is nothing to show
      daybook = {day, title?, label, blocks: [{act, from, to, line, label?}], evening: {kind, line} | null}
      opts.title   heading text (default daybook.title, then daybook.label); false for none
      opts.captions false keeps the caption list for screen readers only; otherwise it is a closed "Read the day" fold (hidden in the column layout)
      Blocks: wide show icon, label, time and line (2 lines, road 3); middling show icon, label, time; narrow show icon and time
      The layout follows the space it is given, not the window: a row of hours when wider than 520px, a column below that
  Daybook.ICONS[act]   cached 16x16 canvases, one per act; Daybook.NIGHT[kind] the same for evening kinds
  Daybook.icon(act, scale) a fresh page canvas (falls back to a compass rose); Daybook.LABELS, Daybook.KINDS
*/
(function () {
  "use strict";
  const { Grid, OUTLINE } = Art;
  const PAL = {
    q: "#3a3040", A: "#5a5650", a: "#8f897c", z: "#6a7280", s: "#b4bcc4", S: "#e8eef2",
    d: "#5a3a20", w: "#8a5a30", W: "#bc8c52", n: "#7a5236",
    g: "#e8b84a", G: "#a8762a", y: "#fbe9a0",
    r: "#c0402c", R: "#7a2018", o: "#d98a3a", O: "#9a5420",
    e: "#5a9a3a", E: "#36662a", l: "#9ad060",
    b: "#4a7ab8", B: "#2a4a7a", c: "#b4d8ec",
    p: "#f6ead0", P: "#d4b886", h: "#fbf8f0", f: "#eab48c", m: "#e8909a",
  };
  // drawn after the outline so steam, sparks and fishing line stay thin
  const SOFT = { "1": "#fffaf0", "2": "#ffe27a", "4": "#3a3040" };
  const ART = {
    road: ["......dd......", ".WWWWWWWWWW...", ".WdWWdWWdWWWW.", ".wwwwwwwwww...", "......dd......", "...WWWWWWWWWW.", ".WWWdWWdWWdWW.", "...wwwwwwwwww.", "......dd......", "......dd......", "......dd......", "......dd......", "....nnddnn...."],
    arrive: ["..r.......r...", "..rr......rr..", "..q.......q...", ".a.a.a..a.a.a.", ".aaaaa..aaaaa.", ".aAaaa..aaaAa.", ".aaaaaaaaaaaa.", ".aaaaAAAAaaaa.",
      ".aaaAqqqqAaaa.", ".aAaAqzzqAaAa.", ".aaaAqqqqAaaa.", ".aaaAqzzqAaaa.", ".AAAAqqqqAAAA."],
    errands: ["....dddddd....", "...d......d...", "..d.oo..rr.d..", "..doooo.rrrd..", ".dddddddddddd.", ".dWwWwWwWwWwd.", ".dwWwWwWwWwWd.",
      "..dWwWwWwWwd..", "..dwWwWwWwWd..", "...dddddddd..."],
    work: ["...rr.......", "pppRRppppp..", "pqqqqqqqqp..", "pppppppppp..", "pqqqqqqppp..", "pppppppppp..", "pqqqqqqqqp..", "pppppppppp..",
      "pqqqqqqGGG..", "ppppppGgyyG.", "pqqqqpGyggG.", "ppppppGgggG.", "PPPPPPPGGG.."],
    rest: ["........bbbb", "..........b.", ".........b..", "........bbbb", "...bbb......", "....b.......", "...bbb......", "............",
      ".hhhhhhhhhh.", "hhhhhhhhhhhc", "hhhhhhhhhhcc", "chhhhhhhhccc", ".cccccccccc."],
    train: ["....pppp....", "...pqppqp...", "...pppppP...", "....PPPP....", "WWWWWWWWWWWW", "y..yyyyyy..y", "...yGyyGy...", "...yyyyyy...",
      "...yGyyGy...", "....yyyy....", ".....dd.....", ".....dd.....", "...dddddd..."],
    study: [".ppppp..ppppp.", "ppppppPPpppppp", "pqqqqpPPpqqqqp", "ppppppPPpppppp", "pqqqppPPpqqqqp", "ppppppPPpppppp", "pqqqqpPPpqqqpp",
      "ppppppPPpppppp", "rrrrrrrrrrrrrr", ".RRRRR..RRRRR."],
    brew: ["......1.......", "...1.....1....", ".....1........", "zzzzzzzzzzzzzz", ".zlleleellelz.", ".qAqqqqqqqqqq.", "qAAqqqqqqqqqqq",
      "qAqqqqqqqqqqqq", "qqqqqqqqqqqqqq", ".qqqqqqqqqqqq.", "..qqqqqqqqqq..", "..q.oyooyo.q..", "...oOoooOo...."],
    forge: ["........zz....", "..2.....zz..2.", "WWWWWWWWzz....", "..2.....zz.2..", "..............", "...SSSSSSSSSSS", "SSSssssssssssz",
      ".zzzssssssssqq", "....zssssssz..", ".....zsssz....", "....zzzzzzz...", "...zzzzzzzzz.."],
    forage: ["...rrrrrr.....", ".rrrhhrrrrr...", "rrrrhrrrrhrr..", "rrhrrrrrrrrr..", "RRRRRRRRRRRR..", "....ppPp......", "....ppPp...el.",
      "....ppPp..elll", "....ppPp.eell.", "...pppPppEe...", ".EEeeEEeeEEe.."],
    graverob: ["...aaaa......W", "..aaaaaa....W.", ".aaaAaaaa..W..", ".aaAAAaaa.W...", ".aaaAaaaaW....", ".aaaAaaaW.....", ".aaaaaaW......",
      ".aaaaasss.....", ".aaaaSsss.....", ".aaaaSsss.....", "nnnnnnsnnnnn..", ".nnnnnnnnnn..."],
    pickpocket: ["...n...n......", "....n.n.......", ".....nn.......", "....nnnn......", "...nWnnnn..gg.", "..nWnnnnnn.gg.", ".nWnnnnnnnn...",
      ".nnnnnnnnnn...", ".nnnnnnnnnn.gg", "..nnnnnnnn..gg", "...nnnnnn....."],
    trainer: ["......rrr.....", ".....rrRr.....", "......rR......", "....ssssss....", "...sSSsssss...", "..sSssssssss..", "..ssssssssss..",
      "..ssqqqqqqss..", "..ssssqqssss..", "..sss.qq.sss..", "..sss....sss..", "..zzz....zzz.."],
    labour: ["....ssssss....", "..ss..WW..ss..", ".s....WW....s.", "s.....WW.....s", "......WW......", "......WW......", "......WW......",
      "......WW......", "......WW......", "......WW......", "......WW......", "......ww......"],
    busk: ["..GG.......dd.", "..G.......ddd.", ".GG......WW...", "........WW....", ".......WW.....", "...oooWWo.....", "..ooooWooo....",
      ".ooooWooooo...", ".oooqqoooOo...", ".oooqqooooO...", ".oooooooooO...", "..oooooooO....", "...OOOOOO....."],
    service: ["......g.......", ".....ggg......", "......g.......", ".....RRR......", "....RRRRR.....", "...RRRRRRR....", "....ppbpp.....",
      ".RRRppbppRRR..", "RRRRpppppRRRR.", "ppppppppppppp.", "pbpppnnnpppbp.", "pbpppnnnpppbp.", "PPPPPnnnPPPPP."],
    confession: ["......oo......", ".....oyyo.....", ".....oyyo.....", "......oo......", "......q.......", ".....hhhP.....", ".....hhhP.....",
      ".....hhhP.....", ".....hhhP.....", ".....hhhP.....", "...GggggggG...", "....GGGGGG...."],
    blessing: ["......gg......", ".g....gg....g.", "..g........g..", ".....gggg.....", "....gyyyyg....", "gg..gyhyyg..gg", "gg..gyyyyg..gg",
      "....Ggyygg....", ".....GGGG.....", "..g........g..", ".g....gg....g.", "......gg......"],
    poorhouse: ["....1..1......", "...1..1..1....", "....1..1..1...", "...1..1..1....", "..............", ".oyooooooooo..", "WWWWWWWWWWWWWW",
      ".wWWWWWWWWWWw.", "..wwwwwwwwww..", "...wwwwwwww...", ".....dddd....."],
    church_work: ["............WW", "...........WW.", "..........WW..", ".........WW...", "........WW....", ".......WW.....", ".....rrr......",
      "....yyyy......", "...yyGyyy.....", "..yGyyGyy.....", ".yyyGyyGy.....", "..1.1.........", "1....1........"],
    infirmary: ["....nnnnnn....", "...n......n...", ".PPPPPPPPPPPP.", ".hhhhhhhhhhhh.", ".hhhhheehhhhh.", ".hhhhheehhhhh.", ".hhheeeeeehhh.",
      ".hhheeeeeehhh.", ".hhhhheehhhhh.", ".hhhhheehhhhh.", ".PPPPPPPPPPPP."],
    bath: ["...1.....1....", ".....1......1.", "..1.....1.....", "..hh..hh...hh.", "dWWWWWWWWWWWWd", "dcbbcbbbbcbbbd", ".dwWwwWwwWwwd.",
      ".dwWwwWwwWwwd.", ".dddddddddddd.", ".dwWwwWwwWwwd.", "..dddddddddd..", "..d........d.."],
    fishing: ["..........WWW.", "........WW...4", "......WW.....4", "....WW.......4", "..WW.........4", "WW...........4", ".............4", ".............4", "....s...ssss.4", "....ss.sSSSqs4", "....sssssssss.", "....ss.ccccc..", "....s........."],
    dice: ["hhhhhhP.......", "hqhhhhP.......", "hhhhhhP.......", "hhhqhhP.......", "hhhhhhP.......", "hhhhhqP.......", "PPPPPPP.......",
      ".......rrrrrrR", ".......rhrrrhR", ".......rrrrrrR", ".......rrrrrrR", ".......rhrrrhR", ".......rrrrrrR", ".......RRRRRRR"],
    bakery: ["...1...1......", "....1...1.....", "...1...1......", "..............", "....oooooo....", "..oooyoooyooo.", ".oooyoooyoooyo",
      "oooooooooooooo", "OooooooooooooO", ".OOOOOOOOOOOO."],
    pet: ["...nnn..nnn...", "...nWn..nWn...", "...nnn..nnn...", "nnn........nnn", "nWn........nWn", "nnn..nnnn..nnn", "....nnnnnn....",
      "...nnWnnnnn...", "..nnWnnnnnnn..", "..nnnnnnnnnn..", "..nnnnnnnnnn..", "...nnn..nnn..."],
    mount: ["....ssssss....", "..ssSSssssss..", ".sSs......sss.", ".sSq......qss.", "sSs........sss", "sqs........sqs", "sss........sss",
      "sqs........sqs", "sss........sss", "zzz........zzz", "zz..........zz"],
    crew: ["gWWWWWWWWWWg", ".rrrrrrrrrr.", ".rrrrggrrrr.", ".rrrggggrrr.", ".rrrrggrrrr.", ".rrrrggrrrr.", ".rrrrrrrrrr.", ".rrrrrrrrrr.",
      ".rrrrrrrrrr.", ".rrrr..rrrr.", ".rrr....rrr.", ".rr......rr."],
    meet: [".hhhhhh.......", "hhhhhhhh......", "hqhqhqhh......", "hhhhhhhh......", ".hhhhhh.......", "..hh....ccccc.", "..h....ccccccc",
      ".......cBcBcBc", ".......ccccccc", "........ccccc.", "..........cc..", "...........c.."],
    odd_request: ["..PPPPPPPPP...", ".PpppppppppP..", "..pppRRRppp...", "..ppRpppRpp...", "..pppppRppp...", "..ppppRpppp...", "..pppRppppp...",
      "..pppRppppp...", "..ppppppppp...", "..pppRppppp...", "..ppppppppp...", ".PpppppppppP..", "..PPPPPPPPP..."],
    yeti: ["...hhhhhhhh...", ".hhhhhhhhhhhh.", "hhhhhhhhhhhhhh", "hhcBBccccBBchh", "hccqccccccqcch", "hcccccccccccch", "hcccRhRRhRccch",
      "hhccRRRRRRcchh", "hhhcccccccchhh", ".hhhhhhhhhhhh.", "hh.hhhhhhhh.hh", ".h..h.hh.h..h."],
    event: ["......gg......", ".....gggg.....", "g...ggrrgg...g", ".gggggrrggggg.", "..ggggrrgggg..", "...gggrrggg...", "...gggrrggg...",
      "..gggggggggg..", "..ggggrrgggg..", ".gggg....gggg.", "ggg........ggg"],
    wander: ["..oooooo......", "...nnnn.......", "...nWnn.......", "...nWnn.......", "...nWnn.......", "...nWnnn......", "1..nnnnnnn....", "..nnnnnnnnnn..", "1.nnnnnnnnnnn.", "..dddddddddddd", "..dd....dddd.."],
    carousing: ["..hh.hhh......", ".hhhhhhhhh....", ".hhhhhhhhhh...", ".dhhhhhhhd....", ".dWggggggdddd.", ".dWggggggd..d.", ".dWggggggd..d.",
      ".dWggggggd..d.", ".dWggggggdddd.", ".dWggggggd....", ".dGGGGGGGd....", "..ddddddd....."],
    delve: ["...pppppppp...", "..pppppppppp..", ".pppppppppppp.", ".ppppppppppPp.", ".ppqqqppqqqPp.", ".ppqqqppqqqPp.", "..pppqqpppP...",
      "..pppqqpppP...", "...pppppppP...", "...pqpqpqpP...", "....pPpPpP...."],
    camp: ["......o.......", ".....ooo......", "....ooyoo.....", "...rooyyoo....", "...rooyyyor...", "...rrooyoor...", "....rroorr....",
      ".WWw......wWW.", "..dwWw..wWwd..", "....dwWWwd....", "..dwWw..wWwd..", ".WWw......wWW."],
    // setting out: a full leather waterskin with its cork and carrying cord, a drop at the spout
    depart: ["....nn........", "...n..dd......", "..n..dWWd.....", "..n...dd......", "..n..wWWw.....", "..n.wWWWWw....", "...wWhWWWWw...",
      "..wWhWWWWWww..", "..wWWWWWWwwd..", "..wWWWWWwwwd.b", "..wwWWWwwwdd.c", "...wwwwwwdd...", "....dddddd...."],
    // something happening on the road (the "On the road" stretch): a walking boot mid-stride on a strip of rutted road, kicking up dust
    road_event: ["..............", "...dnnnnd.....", "...dWnnnd.....", "...dWpnpd.....", "...dWnpnd.....", "...dWpnpd.....", "...dWnnnnd....",
      "1.dnWnnnnnd...", "..dWnnnnnnnd..", "1.dnnnnnnnnnd.", "..qqqqqqqqqqq.", "..............", "PWWPWWWPWWPWWP", "PPwPPPwPPPPwPP"],
    // the road's stretches (league/roads.py): the midday halt, the roadside places by kind, and a traveller met on the way
    halt: ["..............", "...oooooo.....", "..oyoooyoo....", ".oooooooooo...", ".OoooooooooO..", "..OOOOOOOOO...", "..............",
      "........ssss..", "........shhs..", "........shhss.", "........shhs.s", "........shhss.", "........ssss.."],
    inn: ["WWWWWWWWWW....", "W....d...d....", "W....d...d....", "W...rrrrrrr...", "W...rgggggr...", "W...rgyyygr...", "W...rgggggr...",
      "W...rrrrrrr...", "W.............", "W.............", "W.............", "W.............", "ww............"],
    shrine: ["......dd......", ".....dWWd.....", "....dWWWWd....", "...dWWWWWWd...", "....aaaaaa....", "....a.o..a....", "....a.y..a....",
      "....a.h..a....", "....a.h..a....", "...aaaaaaaa...", "..AAAAAAAAAA.."],
    toll: ["..............", "rhrhrhrhrhrh..", "rhrhrhrhrhrh..", ".........W....", ".........W....", "..gg.....W....", ".gyyg....W....",
      ".gyyg....W....", "..gg.....W....", ".........W....", "........www..."],
    ferry: ["......W.......", "......Wh......", "......Whh.....", "......Whhh....", "......W.......", "dWWWWWWWWWWWd.", ".dwwwwwwwwwd..",
      "..dddddddddd..", "bcbbcbbbcbbcbb", ".bbbbcbbbbcbb."],
    // a ford: a row of stepping stones across a stream (a ferry is a boat)
    ford: ["..............", "..............", "..............", "..............", "cbbcbbbbcbbbcb", "bbbbbcbbbbbcbb", ".SA.SA..SA.SA.",
      "aaAaaAbaaAbaaA", "AAbAAbbAAbbAAb", "bbcbbbbcbbbbcb", ".bbbbcbbbbcbb."],
    // a squared milestone with a cap stone and its mileage cut in, never a rounded headstone
    milestone: [".aaaaaaaaaaa..", ".aSSSSSSSSSa..", ".aaaaaaaaaaa..", "..aSssssssAa..", "..aSqqqsssAa..", "..aSssqsssAa..", "..aSsqssssAa..",
      "..aSsqssssAa..", "..aSssssssAa..", "..aSqqqqqsAa..", "..aSsssqssAa..", "..aSssssssAa..", ".EeEeeEeEeEe.."],
    traveller: [".....nnn....W.", "....nnfnn...W.", "....nfffn...W.", ".....fff....W.", "....nnnnn..fW.", "...nnnnnnnn.W.", "...nnnnnn...W.",
      "....nnnn....W.", "....nnnn....W.", "....n..n....W.", "....n..n....W.", "...dd..dd...w."],
  };
  const NIGHT_ART = {
    bed: ["W.............", "W.............", "W.............", "Whhh..........", "Whhhrrrrrrrrrr", "WrrrrrrrrrrrrR", "WRRRRRRRRRRRRR",
      "WWWWWWWWWWWWWW", "W............W", "W............W"],
    key: [".ggg..........", "g...g.........", "g...gggggggggg", "g...g.....g.gg", ".ggg......g..g"],

    bars: ["aaaaaaaaaaaaaa", "aAAAAAAAAAAAAa", "aAqsqqsqqsqqAa", "aAqsqqsqqsqqAa", "aAqsqqsqqsqqAa", "aAqsqqsqqsqqAa", "aAqsqqsqqsqqAa",
      "aAqsqqsqqsqqAa", "aAAAAAAAAAAAAa", "aaaaaaaaaaaaaa"],
    torch: [".....o........", ".....oo.......", "....ooyo......", "....oyyo......", "....ryyr......", ".....rr.......", "....zzzz......",
      ".....WW.......", ".....WW.......", ".....WW.......", ".....WW.......", ".....ww......."],
    bedroll: ["..RRR.........", ".RrrrRrrrnrrr.", "RrRRrRrrrnrrrr", "RrRrrRrrrnrrrr", "RrrRRrrrrnrrrr", ".RrrrRrrrnrrr.", "..RRR........."],
  };
  function fromRows(rows) {
    const g = new Grid(14, 14);
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) g.set(x, y, PAL[row[x]]); });
    return g;
  }
  function softRows(rows) {
    const g = new Grid(14, 14);
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) g.set(x, y, SOFT[row[x]]); });
    return g;
  }
  const FN = {
    auction(g) {
      for (let i = 0; i <= 6; i++) { g.set(6 + i, 6 + i, PAL.W); g.set(6 + i, 7 + i, PAL.w); }
      const ax = Math.SQRT1_2, ay = -Math.SQRT1_2;
      for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
        const dx = x + 0.5 - 5, dy = y + 0.5 - 5, u = dx * ax + dy * ay, v = -dx * ay + dy * ax;
        if (Math.abs(u) <= 4.4 && Math.abs(v) <= 2.1) g.set(x, y, Math.abs(Math.abs(u) - 2.6) < 0.6 ? PAL.g : v < -0.9 ? PAL.W : v > 1 ? PAL.d : PAL.w);
      }
      g.rect(0, 12, 7, 1, PAL.g); g.rect(0, 13, 7, 1, PAL.G);
    },
    hay(g) {
      for (let y = 2; y < 12; y++) for (let x = 0; x < 14; x++) {
        if ((y === 2 || y === 11) && (x === 0 || x === 13)) continue;
        g.set(x, y, y === 5 || y === 9 ? PAL.n : y === 11 ? PAL.G : x % 3 === 1 ? PAL.G : (x * 7 + y * 3) % 5 === 0 ? PAL.y : PAL.g);
      }
      for (const [x, y] of [[3, 1], [4, 0], [8, 1], [10, 0], [11, 1]]) g.set(x, y, PAL.g);
    },
    spar(g) {
      const tip = (x, y, c) => { g.set(x, y, c); g.set(13 - x, y, c); };
      for (let i = 0; i <= 8; i++) { tip(i, i, PAL.S); tip(i + 1, i, PAL.s); }
      for (let x = 8; x <= 11; x++) tip(x, 19 - x, PAL.g);
      tip(10, 10, PAL.n); tip(11, 11, PAL.n); tip(12, 12, PAL.G); tip(13, 13, PAL.g);
    },
    hunt(g) {
      const bow = [[4, 0], [3, 1], [2, 2], [1, 3], [1, 4], [0, 5], [0, 6], [0, 7], [0, 8], [1, 9], [1, 10], [2, 11], [3, 12], [4, 13]];
      for (const [x, y] of bow) { g.set(x, y, PAL.W); g.set(x + 1, y, PAL.w); }
      for (let y = 1; y <= 12; y++) g.set(5, y, PAL.p);
      for (let x = 2; x <= 10; x++) g.set(x, 7, PAL.W);
      g.set(13, 7, PAL.S); g.set(12, 7, PAL.s); g.set(11, 7, PAL.s); g.set(11, 6, PAL.s); g.set(11, 8, PAL.s); g.set(12, 6, PAL.S); g.set(12, 8, PAL.z);
      g.set(2, 6, PAL.r); g.set(3, 6, PAL.r); g.set(2, 8, PAL.R); g.set(3, 8, PAL.R);
    },
    fair(g) {
      g.vline(6, 0, 3, PAL.W); g.set(7, 0, PAL.r); g.set(8, 0, PAL.r); g.set(7, 1, PAL.r);
      for (let y = 3; y <= 13; y++) {
        const half = y <= 7 ? (y - 3) * 1.4 + 0.6 : 6.5;
        for (let x = 0; x < 14; x++) {
          const dx = x + 0.5 - 7;
          if (Math.abs(dx) > half) continue;
          const band = Math.floor(x / 2) % 2;
          let c = band ? PAL.h : PAL.r;
          if (y === 8) c = PAL.G;
          if (y >= 9 && Math.abs(dx) < 2 - (y === 9 ? 0.5 : 0)) c = PAL.q;
          if (y === 13) c = band ? PAL.P : PAL.R;
          g.set(x, y, c);
        }
      }
    },
    compass(g) {
      for (let i = 0; i <= 6; i++) {
        const w = 6 - i;
        for (let k = -Math.floor(w / 3); k <= Math.floor(w / 3); k++) {
          g.set(7 + k, i, k < 0 ? PAL.y : PAL.G); g.set(7 + k, 13 - i, k < 0 ? PAL.g : PAL.G);
          g.set(i, 7 + k, k < 0 ? PAL.y : PAL.g); g.set(13 - i, 7 + k, k < 0 ? PAL.g : PAL.G);
        }
      }
      g.set(7, 7, PAL.r); g.set(6, 6, PAL.r); g.set(7, 6, PAL.r); g.set(6, 7, PAL.r);
    },
    moon(g) {
      for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
        const d1 = Math.hypot(x + 0.5 - 7, y + 0.5 - 7), d2 = Math.hypot(x + 0.5 - 10.2, y + 0.5 - 5);
        if (d1 <= 6.4 && d2 > 5.6) g.set(x, y, d2 < 6.8 ? PAL.y : d1 > 5.2 ? "#d8b860" : "#f4e08a");
      }
      g.set(3, 8, "#d8b860"); g.set(4, 10, "#d8b860");
    },
    sun(g) {
      for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
        const dx = x + 0.5 - 7, dy = y + 0.5 - 7, d = Math.hypot(dx, dy);
        if (d <= 3.9) g.set(x, y, d < 1.8 && dx < 0.5 && dy < 0.5 ? PAL.h : d < 2.8 ? PAL.y : PAL.g);
      }
      for (const [dx, dy] of [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]) {
        const r0 = dx && dy ? 4.2 : 5, r1 = dx && dy ? 5.2 : 6.4, n = Math.hypot(dx, dy);
        for (let r = r0; r <= r1; r += 0.5) g.set(Math.floor(7 + dx / n * r), Math.floor(7 + dy / n * r), PAL.o);
      }
    },
  };
  function build(rows, soft) {
    const art = typeof rows === "function" ? (() => { const g = new Grid(14, 14); rows(g); return g; })() : fromRows(rows);
    let x0 = 14, x1 = -1, y0 = 14, y1 = -1;
    for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) if (art.get(x, y) || (soft && soft.get(x, y))) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const ox = 1 + Math.floor((14 - (x1 - x0 + 1)) / 2) - x0, oy = 1 + Math.floor((14 - (y1 - y0 + 1)) / 2) - y0;
    const g = new Grid(16, 16);
    for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) { const c = art.get(x, y); if (c) g.set(x + ox, y + oy, c); }
    g.outline(OUTLINE);
    if (soft) for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) { const c = soft.get(x, y); if (c && !g.get(x + ox, y + oy)) g.set(x + ox, y + oy, c); }
    return g.toCanvas(1);
  }
  function make(src) {
    if (typeof src === "function") return build(src);
    return build(src, src.some((r) => /[124]/.test(r)) ? softRows(src) : null);
  }
  const ICONS = {}, NIGHT = {};
  for (const [k, rows] of Object.entries(ART)) ICONS[k] = make(rows);
  for (const k of ["spar", "hunt", "fair", "auction"]) ICONS[k] = make(FN[k]);
  ICONS.song = ICONS.busk;
  const EXTRA = { compass: make(FN.compass), moon: make(FN.moon), sun: make(FN.sun) };
  const NIGHT_ICON = { inn: "bed", room: "key", stable: "hay", cell: "bars", dungeon: "torch", road: "bedroll" };
  const nightArt = {};
  for (const [k, rows] of Object.entries(NIGHT_ART)) nightArt[k] = make(rows);
  nightArt.hay = make(FN.hay);
  for (const [kind, art] of Object.entries(NIGHT_ICON)) NIGHT[kind] = nightArt[art];
  NIGHT.camp = ICONS.camp;
  const LABELS = {
    road: "On the road", arrive: "Arrival", depart: "Setting out", errands: "Errands", work: "Work", rest: "Rest", train: "Training", study: "Study",
    brew: "Brewing", forge: "The forge", forage: "Foraging", graverob: "Grave-robbing", pickpocket: "Pickpocketing", trainer: "Drills", labour: "Labour",
    busk: "Busking", service: "Service", confession: "Confession", blessing: "Blessing", poorhouse: "Poorhouse", church_work: "Church chores",
    infirmary: "Infirmary", bath: "Bathhouse", fishing: "Fishing", dice: "Dice", bakery: "Bakery", pet: "With the pet", mount: "With the mount",
    crew: "With the crew", meet: "A meeting", spar: "Sparring", odd_request: "Odd request", fair: "The fair", yeti: "Yeti!", auction: "Auction",
    event: "Town event", song: "Music", wander: "Wandering", carousing: "Carousing", hunt: "Hunting", delve: "Delving", camp: "Camp",
    halt: "Midday halt", road_event: "On the road", inn: "The inn", shrine: "A shrine", toll: "The toll", ferry: "The crossing", ford: "The ford", milestone: "A landmark", traveller: "A traveller",
  };
  const KINDS = { inn: "At the inn", camp: "At camp", stable: "In the stables", room: "A rented room", dungeon: "Below ground", cell: "In the cells", road: "By the roadside" };
  const CAT = {
    road: "road", arrive: "road", depart: "road", wander: "road", camp: "road",
    halt: "road", road_event: "road", inn: "road", shrine: "road", toll: "road", ferry: "road", ford: "road", milestone: "road", traveller: "road",
    errands: "town", bakery: "town", bath: "town", dice: "town", fair: "town", auction: "town", event: "town", carousing: "town", meet: "town", odd_request: "town", busk: "town", song: "town",
    work: "craft", labour: "craft", forge: "craft", brew: "craft", study: "craft", forage: "craft", fishing: "craft", rest: "craft",
    train: "arms", trainer: "arms", spar: "arms", hunt: "arms", delve: "arms", yeti: "arms",
    service: "church", confession: "church", blessing: "church", poorhouse: "church", church_work: "church", infirmary: "church",
    graverob: "shady", pickpocket: "shady",
    pet: "kin", mount: "kin", crew: "kin",
  };
  const nightIcon = (kind, scale) => paint(NIGHT[kind] || EXTRA.moon, scale);
  const icon = (act, scale) => paint(ICONS[act] || EXTRA[act] || EXTRA.compass, scale);
  function paint(src, scale) {
    const s = scale || 2;
    const cv = document.createElement("canvas");
    cv.width = src.width * s; cv.height = src.height * s;
    const x = cv.getContext("2d");
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, cv.width, cv.height);
    cv.className = "db-px";
    cv.setAttribute("aria-hidden", "true");
    return cv;
  }
  function h(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "style") for (const [sk, sv] of Object.entries(v)) { if (sv == null) continue; if (sk.startsWith("--")) n.style.setProperty(sk, sv); else n.style[sk] = sv; }
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) n.append(c);
    return n;
  }
  function clock(t) {
    const hh = Math.floor(t), mm = Math.round((t - hh) * 60), m = mm ? ":" + String(mm).padStart(2, "0") : "";
    if (hh % 24 === 12 && !mm) return "noon";
    if (hh % 24 === 0 && !mm) return "midnight";
    const h12 = ((hh + 11) % 12) + 1;
    return `${h12}${m}${hh % 24 < 12 ? "am" : "pm"}`;
  }
  function spanParts(a, b) {
    const x = clock(a), y = clock(b), sx = x.slice(-2), sy = y.slice(-2);
    return [(sx === "am" || sx === "pm") && sx === sy ? x.slice(0, -2) : x, y];
  }
  const span = (a, b) => spanParts(a, b).join("–");
  const hours = (n) => (n === 1 ? "1 hour" : `${+n.toFixed(1)} hours`);
  const SKY = [[5, "#d9a48c"], [6, "#e8b898"], [7, "#efcca4"], [8, "#ead9b4"], [9, "#d6e0cc"], [10, "#c8dcd8"], [11, "#c2d9dc"], [14, "#c2d9dc"],
    [15, "#cfdccc"], [16, "#e6d6a8"], [17, "#ecbe88"], [18, "#d8946c"], [19, "#8a7a8c"], [20, "#4a5470"], [24, "#2a3450"]];
  function sky(t) {
    let c = SKY[0][1];
    for (const [k, v] of SKY) if (t >= k) c = v;
    return c;
  }
  let hillsUrl = null, starsUrl = null;
  function hills() {
    if (hillsUrl) return hillsUrl;
    const g = new Grid(40, 7), far = "#a9b98a", near = "#8aa070";
    for (let x = 0; x < 40; x++) {
      const a = Math.round(3 + 2 * Math.sin(x / 40 * Math.PI * 2) + Math.sin(x / 40 * Math.PI * 6) * 0.8);
      const b = Math.round(4.6 + 1.6 * Math.sin((x + 13) / 40 * Math.PI * 4));
      for (let y = a; y < 7; y++) g.set(x, y, far);
      for (let y = b; y < 7; y++) g.set(x, y, near);
    }
    for (const x of [6, 7, 23, 31]) { g.set(x, 3, "#5f7a4c"); g.set(x, 4, "#5f7a4c"); }
    try { hillsUrl = g.toCanvas(1).toDataURL(); } catch (e) { hillsUrl = ""; }
    return hillsUrl;
  }
  function stars() {
    if (starsUrl) return starsUrl;
    const g = new Grid(46, 40);
    for (const [x, y, c] of [[3, 4, "#d8ccA8"], [30, 9, "#d8cca8"], [12, 22, "#6a7698"], [40, 27, "#8a96b8"], [24, 35, "#6a7698"]]) g.set(x, y, c);
    try { starsUrl = g.toCanvas(1).toDataURL(); } catch (e) { starsUrl = ""; }
    return starsUrl;
  }
  // a sitting at a town table: what it came to, and a link to its replay while the script is kept (a past day's file can outlive it)
  const kept = (route, id) => !!id && (!window.App || App.kept(route, id));
  function tableLink(b) {
    return h("span", null, b.table, kept(b.route || "table", b.game) ? [" ", h("a", { class: "watch", href: `#/${b.route || "table"}/${b.game}` }, "▶ watch")] : null);
  }
  // names in a line link to their pages when the site is around it (a gallery page draws the daybook alone)
  const txt = (s) => (window.App && App.storyText ? App.storyText(s) : s);
  // the fights of a stretch of the day, each linked to its replay while it is kept
  function fightLinks(b) {
    const own = b.ref && window.App ? App.storyLink(b.ref) : null;
    const room = roomLink(b);
    if (own) return [" ", own, room];
    if (b.rec && kept("road", b.rec)) return [" ", h("a", { class: "watch", href: `#/road/${b.rec}` }, "▶ watch")];
    if (room) return [room, ...fightIds(b)];
    return fightIds(b);
  }
  // a room underground opens that floor of the dungeon's map with the room picked out
  function roomLink(b) {
    const r = b.room;
    if (!r || !r.dungeon || !window.App) return null;
    return [" ", h("a", { class: "watch db-room", href: `#/dungeon/${r.dungeon}/${r.floor}/${r.room}` }, "▸ on the map")];
  }
  function fightIds(b) {
    const ids = [...new Set([...(b.fights || []), ...(b.room && b.room.fight ? [b.room.fight] : [])])].filter((id) => kept("fight", id));
    return ids.flatMap((id, i) => [" ", h("a", { class: "watch", href: `#/fight/${id}` }, ids.length > 1 ? `▶ fight ${i + 1}` : "▶ watch")]);
  }
  let uid = 0;
  function render(db, opts) {
    opts = opts || {};
    if (!db) return null;
    const ev = db.evening && (db.evening.kind || db.evening.line) ? db.evening : null;
    const list = (db.blocks || []).filter((b) => b && b.to > b.from).slice().sort((a, b) => a.from - b.from);
    if (!list.length && !ev) return null;
    const id = "db" + ++uid;
    const start = Math.floor(Math.min(6, ...list.map((b) => b.from))), end = Math.ceil(Math.max(18, ...list.map((b) => b.to)));
    const cols = (end - start) * 2, pct = (t) => ((t - start) / (end - start)) * 100;
    const caps = h("ol", { class: "db-caps" + (opts.captions === false ? " db-sr" : "") });
    const rows = [];
    let cursor = start;
    const roadOf = list.filter((b) => b.stretch).pop();
    list.forEach((b, i) => {
      const from = Math.max(b.from, cursor), to = b.to;
      if (to <= from) return;
      cursor = to;
      // a town event and a happening on the road share the act; the road's gets the boot, not the fair's gold star
      const act = b.stretch && b.act === "event" ? "road_event" : b.act, label = b.label || LABELS[act] || (act ? act.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "Busy");
      const parts = spanParts(from, to), when = parts.join("–"), mid = (from + to) / 2, tipId = `${id}-t${i}`;
      const say = b.line || label;
      const cap = h("li", { class: "db-cap" }, icon(act, 1), h("b", { class: "db-when" }, when),
        h("span", { class: "db-cap-txt" }, h("span", { class: "db-cap-act" }, label), b.line ? [h("span", { class: "db-dash" }, " · "), txt(b.line)] : null,
          fightLinks(b), b.table ? [h("span", { class: "db-dash" }, " · "), tableLink(b)] : null));
      caps.append(cap);
      const right = mid > start + (end - start) * 0.55;
      const li = h("li", {
        class: "db-b" + (right ? " db-r" : "") + (to - from <= 1 ? " db-short" : ""),
        "data-act": act || "", "data-cat": CAT[act] || "misc",
        style: { gridColumn: `${Math.round((from - start) * 2) + 1} / ${Math.max(Math.round((from - start) * 2) + 2, Math.round((to - start) * 2) + 1)}`, "--h": String(to - from), "--sky": sky(mid) },
        onmouseenter: () => cap.classList.add("on"), onmouseleave: () => cap.classList.remove("on"),
      },
      h("div", { class: "db-gut", "aria-hidden": "true" }, h("span", { class: "db-gut-t" }, clock(from)), h("span", { class: "db-gut-to" }, "to " + clock(to)),
        from <= 12 && to > 12 ? icon("sun", 1) : null),
      h("button", {
        class: "db-btn", type: "button", "aria-describedby": tipId, "aria-label": `${when}: ${label}${b.line ? ". " + b.line : ""}`,
        onclick: (e) => { const open = !li.classList.contains("open"); for (const o of li.parentNode.querySelectorAll(".db-b.open")) o.classList.remove("open"); li.classList.toggle("open", open); e.stopPropagation(); },
      }, icon(act, 2), h("span", { class: "db-txt" }, h("span", { class: "db-lbl" }, label), h("span", { class: "db-hrs" }, parts[0] + "–", h("wbr"), parts[1]), h("span", { class: "db-hrs-s" }, clock(from).replace(/(am|pm)$/, "")))),
      b.line ? h("p", { class: "db-line" }, txt(b.line), fightLinks(b)) : b.room ? h("p", { class: "db-line" }, roomLink(b)) : null,
      b.table ? h("p", { class: "db-line db-table" }, tableLink(b)) : null,
      h("span", { class: "db-tip", role: "tooltip", id: tipId }, h("b", null, label), h("i", null, ` ${when} · ${hours(to - from)}`), h("br"), say === label ? null : say));
      // a road stretch gets its still road strip behind the line when the road art is loaded (road_scenes.js)
      // and the town errands after a road day get the street at the town's edge, so the day's last tile isn't a bare box
      const roadDay = roadOf || null, street = !b.stretch && roadDay && CAT[act] === "town" && from >= roadDay.to;
      if ((b.stretch || street) && window.RoadScenes && RoadScenes.strip) {
        const base = b.stretch ? b : { stretch: "town", biome: roadDay.biome, weather: roadDay.weather, line: b.line };
        const dressed = RoadScenes.dress ? RoadScenes.dress(Object.assign({}, base, { seed: db.day })) : {};
        const strip = RoadScenes.strip(Object.assign({ biome: base.biome, hour: from, weather: base.weather, place_kind: b.place_kind, heroes: opts.heroes || [] }, dressed),
          // the canvas grows with the stretch, so a long tile shows more road at the same pixel size rather than a bigger band
          { heroes: opts.heroes || [], w: Math.round(Math.max(200, Math.min(480, (to - from) * 120))), h: 80 });
        if (strip) { strip.classList.add("road-strip"); li.append(strip); }
      }
      rows.push(li);
    });
    const ticks = h("div", { class: "db-ruler", "aria-hidden": "true" });
    const NAMES = { 6: "dawn", 12: "noon", 18: "dusk" };
    for (let t = start; t <= end; t++) {
      const major = t % 3 === 0;
      ticks.append(h("i", { class: "db-tick" + (major ? " db-major" : ""), style: { left: pct(t) + "%" } }));
      if (major) ticks.append(h("span", { class: "db-rl" + (NAMES[t] ? " db-name" : "") + (t === start ? " db-first" : t === end ? " db-last" : ""), style: { left: pct(t) + "%" } }, NAMES[t] || clock(t)));
    }
    const stops = [];
    for (let t = start; t < end; t++) stops.push(`${sky(t + 0.5)} ${pct(t)}% ${pct(t + 1)}%`);
    const noon = pct(start <= 12 && end >= 12 ? 12 : (start + end) / 2);
    const skyEl = h("div", { class: "db-sky", "aria-hidden": "true", style: { backgroundImage: `${hills() ? `url(${hills()}),` : ""} linear-gradient(90deg, ${stops.join(", ")})` } });
    skyEl.innerHTML = `<svg class="db-arc" viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M0,40 Q${noon},-24 100,40" fill="none" stroke-width="2" stroke-dasharray="2 5" vector-effect="non-scaling-stroke"/></svg>`;
    const sun = icon("sun", 2);
    sun.classList.add("db-sun");
    sun.style.left = noon + "%";
    skyEl.append(sun);
    const day = list.length ? h("div", { class: "db-day", style: { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } },
      skyEl, h("ol", { class: "db-blocks", style: { gridColumn: `1 / ${cols + 1}`, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } }, rows), ticks) : null;
    let night = null;
    if (ev) {
      const kind = KINDS[ev.kind] || "Night";
      night = h("div", { class: "db-night", style: { "--stars": stars() ? `url(${stars()})` : "none" }, tabindex: "0", "aria-label": `Night: ${kind}${ev.line ? ". " + ev.line : ""}` },
        h("div", { class: "db-moon" }, icon("moon", 2)),
        h("div", { class: "db-ntxt" }, h("span", { class: "db-nt" }, "Night"), h("span", { class: "db-nk" }, kind)),
        NIGHT[ev.kind] ? h("div", { class: "db-nico" }, nightIcon(ev.kind, 2)) : null,
        ev.line ? h("p", { class: "db-line" }, txt(ev.line)) : null,
        ev.table ? h("p", { class: "db-line db-table" }, tableLink(ev)) : null,
        ...(ev.more || []).map((x) => h("p", { class: "db-line db-table" }, tableLink(x))),
        ev.line ? h("span", { class: "db-tip", role: "tooltip" }, h("b", null, "Night"), h("i", null, ` ${kind.toLowerCase()}`), h("br"), ev.line) : null);
      caps.append(h("li", { class: "db-cap db-cap-night" }, icon("moon", 1), h("b", { class: "db-when" }, "night"),
        h("span", { class: "db-cap-txt" }, h("span", { class: "db-cap-act" }, kind), ev.line ? [h("span", { class: "db-dash" }, " · "), txt(ev.line)] : null,
          ev.table ? [h("span", { class: "db-dash" }, " · "), tableLink(ev)] : null,
          (ev.more || []).map((x) => [h("span", { class: "db-dash" }, " · "), tableLink(x)]))));
    }
    const title = opts.title === false ? null : opts.title || db.title || db.label || (db.day != null ? `Day ${db.day}` : null);
    let more = null;
    if (caps.childNodes.length) {
      more = opts.captions === false ? caps
        : h("details", { class: "db-more" }, h("summary", { class: "db-more-s" }, h("span", null, "Read the day")), caps);
    }
    const fig = h("figure", { class: "daybook", "aria-label": !title ? "The day, hour by hour" : /hour by hour/i.test(title) ? title : `${title}, hour by hour` },
      title ? h("figcaption", { class: "db-head" }, h("span", { class: "db-title" }, title)) : null,
      h("div", { class: "db-strip" + (day ? "" : " db-only-night") }, day, night),
      more);
    fig.addEventListener("click", () => { for (const o of fig.querySelectorAll(".db-b.open")) o.classList.remove("open"); });
    return fig;
  }
  window.Daybook = { render, icon, ICONS, NIGHT, LABELS, KINDS, clock };
})();
