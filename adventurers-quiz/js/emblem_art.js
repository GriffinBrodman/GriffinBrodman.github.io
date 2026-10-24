/* Season theme emblems: a 16 x 16 pixel sign per theme (named by its THEMES row's `emblem`), for the Crier's theme strip and board, and the board's pixel lamps. */
(function () {
  "use strict";
  // each emblem is drawn in its own little palette, lit from the top left, then rimmed in its dark so it holds on parchment and on night blue
  const E = {
    nugget: { ol: "#2a1a0c", pal: { S: "#e8eef0", s: "#a8b4bc", d: "#5e6a74", W: "#c8904e", w: "#7e5228", Y: "#fff6b0", G: "#ffd23a", g: "#e0a020", b: "#a86a10" }, rows: [
      "................",
      "....SSSSSSSS....",
      "..SSssssssssSS..",
      ".Sss..sWws..ssd.",
      ".sd....Ww.....d.",
      ".d.....Ww.......",
      ".......Ww.......",
      ".......Ww.......",
      ".......Ww.YG....",
      ".......WwGYGg...",
      ".......WGGGggg..",
      ".......GGGgggbb.",
      "......WGggggbb..",
      "......Wwgggbb...",
      "................",
      "................"] },
    snowflake: { ol: "#14284a", pal: { W: "#ffffff", L: "#c8e8ff", B: "#7ab8f0", b: "#4a86c8" }, rows: [
      "................",
      ".......W........",
      ".....B.W.B......",
      "......BWB.......",
      "..B....L....B...",
      "...b...L...b....",
      ".B..bB.L.Bb..B..",
      "..BBBLLWLLBBB...",
      ".B..bB.L.Bb..B..",
      "...b...L...b....",
      "..B....L....B...",
      "......BWB.......",
      ".....B.W.B......",
      ".......W........",
      "................",
      "................"] },
    well: { ol: "#24160c", pal: { R: "#d8583a", r: "#a83a24", q: "#6e2214", P: "#a87a48", p: "#6e4a28", d: "#4a3424", C: "#d8c8a0", K: "#c8c0b0", k: "#9a9284", j: "#6a645a", N: "#1a2a3a", W: "#ffffff", S: "#8a949c", B: "#d8a060", b: "#9a6a34", Y: "#ffe070" }, rows: [
      "................",
      ".............Y..",
      ".......RR...YWY.",
      ".....RRRrrr..Y..",
      "...RRRRrrrrrr...",
      "..qqqqqqqqqqqq..",
      "...PdddCddddp...",
      "...PdddCddddp...",
      "...PddSSSdddp...",
      "...PddBBbdddp...",
      "..KKKKKKKKKKKK..",
      "..KNNNNNNNNNNk..",
      "..KkjKkjKkjKkj..",
      "..kKKkKKkKKkKj..",
      "..jjjjjjjjjjjj..",
      "................"] },
    dragon: { ol: "#1e0a06", pal: { H: "#f4e4b8", h: "#c8a868", R: "#e8503a", r: "#b02c1e", q: "#6e140c", Y: "#ffe040", T: "#fff4e0", F: "#ffd040", f: "#ff8a20", e: "#d83a10" }, rows: [
      "................",
      "...........H....",
      "..........Hh..H.",
      "........RHhRRHh.",
      "......RRRRRRRrr.",
      "....RRRRRYKRRrr.",
      "..RRRRRRRYYRrrr.",
      ".nRRRRRRRRRRrrq.",
      ".RRrrrrrrrRRrrq.",
      "..TT.TT..rrRrrq.",
      "FF......rrRrrq..",
      "fFF.TT.Trrrrrq..",
      "efFrrrrrrrrrq...",
      ".f..qqqqqqrrq...",
      "..........qq....",
      "................"] },
    skull: { ol: "#1a1410", pal: { W: "#fbf6e8", w: "#e0d6bc", v: "#b0a488", k: "#20180f", G: "#7af0a0" }, rows: [
      "................",
      "................",
      ".....WWWWWw.....",
      "....WWWWWWwv....",
      "...WWWWWWWWwv...",
      "...WWWWWWWWwv...",
      "...WkkWWwkkwv...",
      "...WkGWWwkGwv...",
      "...WwwWkkwwvv...",
      "....wWWkkwvv....",
      "....WwwwwwvV....",
      "....WkWkWkWv....",
      ".....wvwvwv.....",
      "................",
      "................",
      "................"] },
    map: { ol: "#2e1e10", pal: { P: "#f4e2b4", p: "#d8bc84", q: "#b0905a", R: "#d8302a", r: "#8a1a14", g: "#6a9a4a", b: "#5a8ac0" }, rows: [
      "................",
      "................",
      ".PPPPqPPPPqPPPP.",
      ".PPPPqpPPPqpRPr.",
      ".PbbPqpPPPqPPRP.",
      ".PbPPqpPPrqpRPr.",
      ".PPPPqpPrPqpPPP.",
      ".PPrPqprPPqpPPP.",
      ".PPPrqpPPPqpggP.",
      ".PPPPrpPPPqpgPP.",
      ".PPPPqpPPPqpPPP.",
      ".pppppppppppppp.",
      "................",
      "................",
      "................",
      "................"] },
    // a hunter's moon, big and low and orange, over the dark tops of the pines
    hunt_moon: { ol: "#24120a", draw(g) {
      g.blob(10, 5.5, 4.8, 4.8, ["#b0501e", "#d8702c", "#f09640", "#f8b660", "#ffd890"]);
      for (const [x, y] of [[11, 3], [12, 3], [9, 7], [12, 7]]) g.set(x, y, "#d8742e");
      const K = "#1a2416", k = "#4e7a3c";
      const pine = (cx, top, ws) => ws.forEach((w, d) => { g.hline(cx - w, cx + w, top + d, K); if (w) g.set(cx + w, top + d, k); });
      pine(4, 2, [0, 1, 1, 2, 1, 2, 3, 2, 3, 4, 3, 4]);
      pine(12, 8, [0, 1, 1, 2, 1, 2]);
      g.rect(1, 14, 14, 1, K);
    } },
    raindrop: { ol: "#0e2438", pal: { W: "#f0faff", L: "#a8dcf8", B: "#58a8e8", b: "#2a70b8", d: "#1a4a88", T: "#7ac8e8", t: "#3a88b8" }, rows: [
      ".......B........",
      ".......B........",
      "......LBb.......",
      "......LBb.......",
      ".....WLBBb......",
      ".....WLBBb......",
      "....WLBBBbb.....",
      "....LBBBBbd.....",
      "....BBBBbbd.....",
      ".....BbbbdD.....",
      "......dddd......",
      "................",
      ".TTT...TTT...TT.",
      "tttTTtttttTTttt.",
      "..ttt...ttt..tt.",
      "................"] },
    sheaf: { ol: "#2e1c08", pal: { Y: "#fff0a0", G: "#f0c850", g: "#c8962c", b: "#8a6018", R: "#d83a2a", r: "#8a1e14" }, rows: [
      "..G..Y.G..Y..G..",
      ".GYg.GYgGYg.Gg..",
      ".gGg.gGgGgg.gGg.",
      "..gg..gGgg..gg..",
      "...gg.gGg..gg...",
      "....gggGggg.....",
      ".....gGGGg......",
      "......gGg.......",
      ".....RRRRr......",
      ".....rrrrr......",
      "......gGg.......",
      ".....gGGgb......",
      "....gGggGgb.....",
      "...gGg.g.Ggb....",
      "..gg..bg..ggb...",
      "................"] },
    shell: { ol: "#3a1e12", pal: { W: "#fff2e0", P: "#f8c8a0", p: "#e09870", q: "#b06a48", r: "#7e4430" }, rows: [
      "................",
      "................",
      ".....WWPPPP.....",
      "...WWPPpPPpPp...",
      "..WPPpPPpPPpPp..",
      ".WPpPPpPPpPPpPp.",
      ".PPpPPpPPpPPpPq.",
      ".PPpPPpPPpPpPpq.",
      "..PpPpPPpPpPpq..",
      "...pPpPPpPpPq...",
      "....pPpPpPpq....",
      ".....qpPpqq.....",
      "....rqqqqqqr....",
      "....rrqqqqrr....",
      "................",
      "................"] },
    // a lute with its pegbox bent back, and a note rising off it
    lute: { ol: "#24140a", draw(g) {
      g.blob(5.5, 10.5, 4.6, 4.2, ["#6e3e18", "#a8642c", "#d8904a", "#eaa860", "#f8cc88"]);
      for (let i = 0; i < 6; i++) { g.set(8 + i, 7 - i, "#5a3418"); g.set(9 + i, 7 - i, "#8a5a2c"); }
      for (const [x, y] of [[13, 0], [14, 0], [14, 1], [15, 1]]) g.set(x, y, "#3e2410");
      g.set(13, 1, "#f4e8c8"); g.set(15, 0, "#f4e8c8");
      g.blob(5, 10, 1.4, 1.4, ["#1a0e06", "#1a0e06", "#2a1a0c", "#2a1a0c", "#2a1a0c"]);
      for (let i = 0; i < 9; i++) g.set(4 + i, 12 - i, i > 2 && i < 4 ? null : "#f4e8c8");
      g.rect(2, 12, 3, 1, "#3e2410");
      g.vline(3, 1, 4, "#a82a1a"); g.set(4, 1, "#a82a1a"); g.set(5, 2, "#a82a1a");
      g.rect(1, 4, 2, 2, "#c83a24"); g.set(1, 4, "#e86a4a");
    } },
    wagon: { ol: "#24160c", pal: { W: "#fff6e0", C: "#efe2c0", c: "#c8b48a", P: "#b07a44", p: "#7a5028", K: "#3e2a18", S: "#d8a85c", s: "#9a6a34", H: "#4a3424" }, rows: [
      "................",
      "................",
      "....WWWWWW......",
      "..WWCCCCCCCc....",
      ".WCCCcCCcCCcc...",
      ".CCCCcCCcCCccc..",
      ".CCCCcCCcCCccc..",
      ".CCCCcCCcCCccc..",
      ".PPPPPPPPPPPPP..",
      ".ppppppppppppppH",
      "..SSS.....SSS...",
      ".SsKsS...SsKsS..",
      ".SKKKS...SKKKS..",
      ".SsKsS...SsKsS..",
      "..SSS.....SSS...",
      "................"] },
    joust: { ol: "#1c1410", pal: { L: "#e8d0a0", l: "#a87a44", T: "#e8eef0", t: "#9aa4ac", B: "#3a78c8", b: "#24508a", Y: "#ffd860", y: "#d0a030", W: "#f4f0e0" }, rows: [
      "T..............T",
      ".t............t.",
      "..l..........l..",
      "...l........l...",
      "...YYYYYYYYYY...",
      "...YBBBBBBBBy...",
      "...YBBBWWBBby...",
      "...YBBWWWWBby...",
      "...YBWWBBWWby...",
      "...YWWBBBBWWy...",
      "...yBBBBBBBby...",
      "....yBBBBBby....",
      "..l..ybBBby..l..",
      ".l....yBby....l.",
      "l......yy......l",
      "................"] },
    writ: { ol: "#20160e", pal: { I: "#b8bec4", i: "#7a8288", j: "#4a5056", P: "#f4e4bc", p: "#c8ac78", t: "#8a7458", R: "#d8302a", r: "#8a1a14", Y: "#ff7a5a" }, rows: [
      "................",
      "................",
      ".II..........II.",
      ".IiPPPPPPPPPPiI.",
      ".IiPtttPtttPPiI.",
      ".IiPPPPPPPPPPiI.",
      ".IiPttPttttPPiI.",
      ".IiPPPPPPPPPPiI.",
      ".IiPtttPPRRPPiI.",
      ".IiPPPPPRYRrPiI.",
      ".jjppppRRRrrpjj.",
      ".jj.....rRrr.jj.",
      "........r..r....",
      ".......r....r...",
      "................",
      "................"] },
    paw: { ol: "#24180e", pal: { W: "#fffaf0", w: "#e4dcc8", B: "#7a4a28", b: "#4a2c16", L: "#a8704a" }, rows: [
      "................",
      "..WWWWWWWWWWW...",
      ".WWWWLBWLBWWWw..",
      ".WWWWBbWBbWWWw..",
      ".WWLBWWWWWLBWw..",
      ".WWBbWWWWWBbWw..",
      ".WWWWWLBBWWWWw..",
      ".WWWWLBBBbWWWw..",
      ".WWWWBBBBbWWWw..",
      ".WWWWWbbbWWWWw..",
      ".wWWWWWWWWWWww..",
      "..wwWwwwwwwww...",
      "...Ww...........",
      "..Ww............",
      ".w..............",
      "................"] },
    shard_moon: { ol: "#0e1430", pal: { M: "#fff6d0", m: "#e8d898", n: "#b8a868", W: "#ffffff", C: "#a8f0ff", c: "#4ab8e8", d: "#2a6aa8", s: "#f0f8ff" }, rows: [
      "...........W....",
      "....MMM....C....",
      "..MMMm....CWc...",
      ".MMmm....CCWcd..",
      ".MMm.....cCWcd..",
      "MMm.......cCd...",
      "MMm........c....",
      "MMm.............",
      "MMm.......s.....",
      "MMmm......s.....",
      ".MMmm...........",
      ".nMMmm.......s..",
      "..nnMMmmm....s..",
      "....nnnnn.......",
      "................",
      "................"] },
    spark: { ol: "#0e2a24", pal: { W: "#ffffff", M: "#8af0c8", m: "#3ab890", P: "#f0a0d8", p: "#c86aa8", Y: "#fff0a0" }, rows: [
      "......M.........",
      "......M......P..",
      ".....MWm....PWp.",
      ".....MWm.....p..",
      "....MMWmm.......",
      "MMMMMWWWmmmmm...",
      "..mmmWWWmm......",
      "....mmWmm.......",
      ".....mWm........",
      ".....mWm....Y...",
      "......m.....Y...",
      "......m...YYWYY.",
      "..P.........Y...",
      ".PWp........Y...",
      "..p.............",
      "................"] },
    goblin_crown: { ol: "#141c0c", pal: { Y: "#fff0a0", G: "#ffd23a", g: "#d09a20", R: "#e83a3a", S: "#a8d860", s: "#74a63e", d: "#4a7a2a", E: "#ffe04a", K: "#1a1208", T: "#f4f0e0" }, rows: [
      "...G...G...G....",
      "...GG.GYG.GG....",
      "...GYGGGGGgG....",
      "...GGRGGGRgg....",
      "...gggggggggg...",
      "....SSSSSSss....",
      "S..SSSSSSSSss..s",
      "SSSSSEKSSEKssss.",
      ".SSSSSSSSSSssss.",
      "..ssSSSddSSsss..",
      "....SSSSSSsss...",
      "....SKTKTKKss...",
      ".....sSSSsss....",
      "......sssss.....",
      "................",
      "................"] },
    sunk_spire: { ol: "#0e1e24", pal: { R: "#5a9a8a", r: "#3a7066", q: "#244a44", S: "#c8c2b0", s: "#9a9484", t: "#6a6658", K: "#14181c", Y: "#e8c050", y: "#a8802a", T: "#7ac8e8", t2: "#3a88b8", g: "#4a8a3a" }, rows: [
      ".......Y........",
      ".......R........",
      "......RRr.......",
      ".....RRRrq......",
      "....RRRRrrq.....",
      "...RRRRRrrqq....",
      "...qqqqqqqqq....",
      "....SSSSSSt.....",
      "....SKKKKst.....",
      "....SKYyKst.....",
      "....SKyyKst.....",
      "...gSSSSSstg....",
      ".TTTgSsSSstTTT..",
      "TTuuuTTTuuuuTTu.",
      ".uu..uuu...uuu..",
      "................"] },
  };
  E.sunk_spire.pal.u = "#3a88b8";
  E.raindrop.pal.D = "#1a4a88";
  E.skull.pal.V = "#b0a488";

  const cache = new Map();
  function grid(key) {
    if (!window.Art || !E[key]) return null;
    if (cache.has(key)) return cache.get(key);
    const spec = E[key], g = new Art.Grid(16, 16);
    if (spec.draw) spec.draw(g);
    else spec.rows.forEach((row, y) => [...row].forEach((ch, x) => { const c = spec.pal[ch]; if (c) g.set(x, y, c); }));
    g.outline(spec.ol);
    cache.set(key, g);
    return g;
  }
  // the sign at `px` screen pixels per art pixel; the board's sits on a little brass-rimmed plaque so it holds the panel's title line
  function canvas(key, px, plaque) {
    const g = grid(key);
    if (!g) return null;
    let out = g;
    if (plaque) {
      out = new Art.Grid(20, 20);
      for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
        const edge = x === 0 || y === 0 || x === 19 || y === 19, corner = (x === 0 || x === 19) && (y === 0 || y === 19);
        if (corner) continue;
        out.set(x, y, edge ? "#6a4a24" : x === 1 || y === 1 ? "#e8c27a" : x === 18 || y === 18 ? "#a07a3e" : "#f2e2bc");
      }
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = g.get(x, y); if (c) out.set(x + 2, y + 2, c); }
    }
    const cv = out.toCanvas(1);
    cv.className = "emblem";
    cv.style.width = out.w * (px || 2) + "px";
    cv.style.height = out.h * (px || 2) + "px";
    cv.setAttribute("aria-hidden", "true");
    return cv;
  }
  // one of the Long Night's lamps on its board, unlit or lit, 7 x 10 with its hanger
  function lamp(lit) {
    const g = new Art.Grid(7, 10), F = (x, y, w, h, c) => g.rect(x, y, w, h, c);
    F(3, 0, 1, 1, "#2a1e14");
    F(1, 1, 5, 1, "#3a2c1e");
    F(1, 2, 5, 6, lit ? "#f4bc4c" : "#4a4238");
    if (lit) { F(2, 3, 3, 3, "#ffe8a0"); g.set(3, 4, "#fffbe8"); F(2, 6, 3, 1, "#d8902c"); }
    else { F(2, 3, 1, 3, "#5e564a"); }
    F(1, 2, 1, 6, "#3a2c1e"); F(5, 2, 1, 6, "#3a2c1e"); F(3, 2, 1, 6, lit ? "#c8862a" : "#3a2c1e");
    F(0, 8, 7, 1, "#3a2c1e"); F(1, 9, 5, 1, "#5a4a36");
    g.outline("#1a120c");
    const cv = g.toCanvas(1);
    cv.className = "lamp" + (lit ? " lit" : "");
    cv.style.width = g.w * 2 + "px"; cv.style.height = g.h * 2 + "px";
    return cv;
  }
  window.Emblems = { KEYS: Object.keys(E), grid, canvas, lamp };
})();
