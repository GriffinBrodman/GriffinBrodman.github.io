/* The dungeon page (#/dungeon/<id>[/<floor>[/<room>]], and #/map/<dungeon>): the island in Dungeons mode on top, then floor tabs, each floor's inked map with the heroes' margin notes, a room's card on a tap (its story, notes and vignette), and a day's delve replayed on the map. */
(function () {
  "use strict";
  const A = App;
  const { L, S, el, cap, heroes, parties } = A;
  const { panel } = Views;

  // ---------- the maps live in dungeon_pen.js and dungeon_map_ink.js ----------
  const Pen = window.DungeonPen, Ink = window.DungeonInk;
  window.DungeonMap = {
    layout: (D, floor, o) => Ink.layout(D, floor, o), inkedState: (D, floor, before) => Pen.known(D, floor, before), lootSprite: (l) => lootSprite(l),
  };

  // ---------- small helpers ----------
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  function mix(a, b, t) { const x = rgb(a), y = rgb(b); return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
  function hashStr(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  const key = (n) => String(n);
  // counted from the rooms themselves, so a found secret room counts on both sides
  const walkedOf = (f) => [f.rooms.filter((r) => r.state).length, f.rooms.length];
  const reduced = () => !!(window.Settings && Settings.reduced());

  // ---------- crews ----------
  function crewName(id) { return parties[id] ? parties[id].name : heroes[id] ? heroes[id].name : "someone"; }
  function crewLink(id, label) {
    if (parties[id]) return el("a", { href: `#/party/${id}` }, parties[id].name);
    if (heroes[id]) return el("a", { href: `#/hero/${id}` }, heroes[id].name);
    return el("span", null, label || "someone");
  }
  const crewInk = (id) => Pen.crewInk(id);
  function crewToken(id, scale) {
    const p = parties[id];
    if (p && p.banner) return A.bannerSprite(p.banner, scale || 2, "dg-token-art");
    const g = new Art.Grid(10, 16), c = crewInk(id), lite = mix(c, "#ffffff", 0.35);
    g.vline(1, 0, 15, "#5a3a20");
    g.set(1, 0, "#e8b84a");
    for (let y = 1; y < 8; y++) for (let x = 2; x < 9 - Math.max(0, y - 4); x++) g.set(x, y, y === 1 ? lite : c);
    g.outline(Art.OUTLINE);
    const cv = g.toCanvas(scale || 2);
    cv.className = "dg-token-art";
    return cv;
  }

  // ---------- room-kind icons (placeholders for the vignettes) ----------
  const IPAL = { k: "#3a3040", w: "#8a5a30", W: "#bc8c52", d: "#5a3a20", g: "#e8b84a", G: "#a8762a", s: "#b4bcc4", S: "#e8eef2", z: "#6a7280",
    r: "#c0402c", R: "#7a2018", o: "#d98a3a", y: "#fbe9a0", b: "#e4dac4", B: "#b8a888", p: "#f6ead0", P: "#d4b886", e: "#5a9a3a", E: "#36662a", c: "#9ad8f0", q: "#2a2430" };
  const ICON = {
    chest: ["............", "..WWWWWWWW..", ".WwwwwwwwwW.", ".WwwwwwwwwW.", ".GGGGggGGGG.", ".wwwwgGwwww.", ".wwwwwwwwww.", ".Wwwwwwwwwww", ".wwwwwwwwww.", ".GwwwwwwwwG.", "............"],
    trap: ["............", "..s.s..s.s..", "..sSs..sSs..", ".sSsS..sSsS.", ".ss......ss.", ".ss......ss.", ".sSs....sSs.", "..sSssssSs..", "...zzzzzz...", "....zzzz....", "............"],
    fight: ["S..........S", ".S........S.", "..S......S..", "...S....S...", "....S..S....", ".....SS.....", ".....SS.....", "....g..g....", "...gG..Gg...", "..ww....ww..", ".ww......ww."],
    puzzle: ["....zzzz....", "..zzssssz...", ".zsssbbsssz.", ".zsbsssbssz.", "zssbsrrsbssz", "zssssrrssssz", "zssbssssbssz", ".zsbssssbsz.", ".zssbbbbssz.", "..zzssssz...", "....zzzz...."],
    obstacle: ["............", "......zz....", ".....zssz...", "....zsssz...", "...zsszssz..", "..zssz.zssz.", ".zsszzzzsssz", "zsszssssszsz", "zszssssssssz", "zzzzzzzzzzzz"],
    fear: ["............", "...bbbbbb...", ".bbbbbbbbbb.", "bbbbrrrrbbbb", "bbbrqqqqrbbb", "bbbrqyyqrbbb", "bbbrqqqqrbbb", "bbbbrrrrbbbb", ".bbbbbbbbbb.", "...bbbbbb..."],
    shrine: [".....y......", "....yoy.....", "....yoy.....", ".....o......", "....bbb.....", "....bbb.....", "....bbb.....", "....bbb.....", "..GGGGGGG...", "...ggggg....", "..GGGGGGG..."],
    remains: ["............", "...bbbbbb...", "..bbbbbbbb..", "..bqqbbqqb..", "..bqqbbqqb..", "..bbbbbbbb..", "...bbqqbb...", "...bbbbbb...", "...b.b.b....", "B.........B.", ".BBBBBBBBB.."],
    lore: ["............", ".PPPPPPPPPP.", "Pppppppppp.P", ".pkkpkkkkp..", ".pppppppppp.", ".pkkkpkkkp..", ".pppppppppp.", ".pkkpkkkkp..", ".pppppppppp.", "Pppppppppp.P", ".PPPPPPPPPP."],
    supplies: ["............", ".WWWWWWWWWW.", ".WwwwwwwwwW.", ".WwWwwwwWwW.", ".WwwWwwWwwW.", ".WwwwWWwwwW.", ".WwwWwwWwwW.", ".WwWwwwwWwW.", ".WwwwwwwwwW.", ".WWWWWWWWWW."],
    cache: ["....PP......", "...PPPP.....", "....yy......", "..PPPPPP....", ".PPPPPPPP...", "PPPPPPPPPP..", "PPPPgPPPPP..", "PPPPPPPPPP..", ".PPPPPPPP...", "..PPPPPP...."],
    camp_spot: [".....r......", "....ror.....", "...royor....", "...ryyyr....", "..royyyor...", "..rooyoor...", "...roooor...", "..WwWwWwWw..", ".wWwWwWwWwW.", "..dd....dd.."],
    secret: [".zzzzzzzzzz.", ".zsszsszssz.", ".zzzzzzzzzz.", ".zszWWWWzsz.", ".zzzWwwWzzz.", ".zszWwwWzsz.", ".zzzWwgWzzz.", ".zszWwwWzsz.", ".zzzWwwWzzz.", ".zzzzzzzzzz."],
    lair: ["..g.g.g.g...", "..ggggggg...", "...bbbbbb...", "..bbbbbbbb..", "..brrbbrrb..", "..brrbbrrb..", "..bbbbbbbb..", "...bbqqbb...", "...bbbbbb...", "...b.b.b...."],
    stair: ["........WWW.", "........www.", ".....WWWwww.", ".....wwwwww.", "..WWWwwwwww.", "..wwwwwwwww.", "WWwwwwwwwww.", "wwwwwwwwwww.", "dddddddddddd"],
    famous: [".....g......", ".....g......", "....ggg.....", "gggggyggggg.", ".gggyyygg...", "..ggyyygg...", "..gggggg....", ".ggg..ggg...", ".gg....gg...", "g........g.."],
    wild: [".....y......", "..y..g..y...", "...g.g.g....", "....ggg.....", "yggggyggggy.", "....ggg.....", "...g.g.g....", "..y..g..y...", ".....y......"],
    camp: [".....r......", "....ror.....", "...royor....", "...ryyyr....", "..rooyoor...", "..WwWwWwWw..", ".wWwWwWwWwW."],
    out: ["....zzzz....", "...zSSSSz...", "..zSyyyySz..", "..zSyyyySz..", "..zSyyyySz..", "..zSyyyySz..", "..zSyyyySz..", ".dddddddddd."],
  };
  const iconCache = {};
  function iconGrid(kind) {
    const k = ICON[kind] ? kind : "wild";
    if (iconCache[k]) return iconCache[k];
    const rows = ICON[k], g = new Art.Grid(14, 14), oy = Math.floor((14 - rows.length) / 2);
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (IPAL[row[x]]) g.set(x + 1, y + oy, IPAL[row[x]]); });
    g.outline(Art.OUTLINE);
    return (iconCache[k] = g);
  }
  const KIND = { chest: "Chest", trap: "Trap", fight: "Fight", puzzle: "Puzzle", obstacle: "Obstacle", fear: "Fear", shrine: "Shrine", remains: "Remains", lore: "Lore",
    supplies: "Supplies", cache: "Cache", camp_spot: "Camp spot", secret: "Secret room", lair: "Lair", stair: "Stair down", famous: "Famous trap" };

  // ---------- loot: each piece as its own sprite with an aura by tier ----------
  const WEAPON_WORDS = [[/crossbow/i, "crossbow"], [/bow\b/i, "bow"], [/axe/i, "axe"], [/mace|hammer|club|maul/i, "mace"], [/spear|pike|glaive|halberd/i, "spear"], [/dagger|knife|dirk/i, "daggers"],
    [/staff/i, "staff"], [/wand/i, "wand"], [/lute/i, "lute"], [/pan\b/i, "frying_pan"], [/./, "sword"]];
  function lootItem(l) {
    const gear = S.gear || {}, slot = l.slot === "ring" ? "ring1" : l.slot;
    const grade = { great: "great", unique: "unique", common: "common", cosmetic: "plain" }[l.tier] || "common";
    const it = { slot, name: l.name, grade, tier: l.tier === "unique" ? 3 : l.tier === "great" ? 2 : l.tier === "cosmetic" ? 0 : 1 };
    const fam = Object.values(gear.families || {}).find((f) => (f.slot === l.slot || (l.slot === "ring" && f.slot === "ring")) && f.names.some((n) => l.name.endsWith(n)));
    if (fam) { it.art = fam.art; it.tier = Math.max(0, fam.names.findIndex((n) => l.name.endsWith(n))); if (slot === "back" || slot === "head" || slot === "offhand") it.tier = Math.max(it.tier, 1); }
    const jw = (gear.jewelry || []).concat(gear.magic || []).find((x) => x.name === l.name);
    if (jw) Object.assign(it, { art: jw.art, gem: jw.gem, tint: jw.tint, glow: jw.glow });
    if (!it.art) {
      if (slot === "weapon") it.art = WEAPON_WORDS.find(([re]) => re.test(l.name))[1];
      else if (slot === "armor") it.art = /robe|vest|coat/i.test(l.name) ? "cloth" : /chain|mail/i.test(l.name) ? "chain" : /plate/i.test(l.name) ? "plate" : "leather";
      else it.art = { head: "leather_cap", back: "cloak", offhand: "shield", ring1: "ring", neck: "amulet", belt: "belt", boots: "boots", gloves: "gloves", pocket: "coin" }[slot] || "coin";
    }
    if (slot === "weapon") it.tier = Math.max(1, it.tier + 1);
    return it;
  }
  const UNIQUE_AURA = ["#4ec8b0", "#e0604a", "#5ab0e8", "#7ad05a", "#e8a03a"];
  function lootSprite(l) {
    const it = lootItem(l), icon = Art.gearIcon(it, null), N = 30, C = N / 2;
    const cv = el("canvas", { width: N, height: N, class: "dg-loot-px" }), ctx = cv.getContext("2d");
    const aura = l.tier === "unique" ? UNIQUE_AURA[hashStr(l.name) % UNIQUE_AURA.length] : l.tier === "great" ? "#f2c450" : null;
    const parts = [];
    let f = 0;
    const draw = () => {
      const img = ctx.createImageData(N, N), d = img.data;
      const put = (x, y, c, a) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= N || y >= N) return; const i = (y * N + x) * 4, [r, g, b] = rgb(c); d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a == null ? 255 : a; };
      if (aura) {
        const R = (l.tier === "great" ? 11 : 12) + (reduced() ? 0 : Math.sin(f / 5) * 1.2);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const r = Math.hypot(x + 0.5 - C, y + 0.5 - C);
          if (r > R) continue;
          const t = 1 - r / R, keep = t > 0.45 || (t > 0.22 ? (x + y) % 2 === 0 : (x + y * 2) % 4 === 0);
          if (keep) put(x, y, t > 0.45 ? mix(aura, "#fff6d0", 0.1 + (t - 0.45) * 0.7) : aura, t > 0.45 ? 255 : 220);
        }
        if (l.tier === "great" && !reduced()) for (let i = 2; i < 6; i++) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) if ((f + i) % 6 < 3) put(C + dx * (i + 6), C + dy * (i + 6), "#ffe9a0", 200);
      }
      ctx.putImageData(img, 0, 0);
      ctx.drawImage(icon.toCanvas(1), C - icon.w / 2, C - icon.h / 2);
      const top = ctx.getImageData(0, 0, N, N);
      const pt = (x, y, c) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= N || y >= N) return; const i = (y * N + x) * 4, [r, g, b] = rgb(c); top.data[i] = r; top.data[i + 1] = g; top.data[i + 2] = b; top.data[i + 3] = 255; };
      if (l.tier === "common" && !reduced() && f % 14 < 2) { const gx = C - 5 + (hashStr(l.name + (f / 14 | 0)) % 9), gy = C - 6 + (hashStr(l.name) % 4); pt(gx, gy, "#ffffff"); pt(gx - 1, gy, "#fff6d0"); pt(gx + 1, gy, "#fff6d0"); pt(gx, gy - 1, "#fff6d0"); pt(gx, gy + 1, "#fff6d0"); }
      if (aura) {
        const ox = C - icon.w / 2, oy = C - icon.h / 2, on = (x, y) => !!icon.get(x - ox, y - oy);
        for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) if (!on(x, y) && (on(x + 1, y) || on(x - 1, y) || on(x, y + 1) || on(x, y - 1))) pt(x, y, mix(aura, "#ffffff", 0.5));
      }
      for (const p of parts) pt(p.x, p.y, p.c);
      ctx.putImageData(top, 0, 0);
    };
    const step = () => {
      f++;
      if (l.tier === "great") {
        if (f % 2 === 0) { const a = (hashStr(l.name + f) % 628) / 100; parts.push({ x: C + Math.cos(a) * 6, y: C + Math.sin(a) * 6, vx: Math.cos(a) * 0.9, vy: Math.sin(a) * 0.9, life: 9, c: f % 4 ? "#ffe27a" : "#ffffff" }); }
      } else if (l.tier === "unique") {
        if (f % 3 === 0) parts.push({ x: C - 8 + (hashStr(l.name + f) % 17), y: N - 4, vx: 0, vy: -0.7, life: 26, c: mix(aura, "#ffffff", f % 2 ? 0.2 : 0.6), wob: hashStr(f + l.name) % 7 });
      }
      for (const p of parts) { p.x += p.vx + (p.wob != null ? Math.sin((f + p.wob) / 3) * 0.3 : 0); p.y += p.vy; p.life--; }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      draw();
    };
    draw();
    if (!reduced()) {
      const t = setInterval(() => { if (!cv.isConnected && f > 4) { clearInterval(t); return; } step(); }, 90);
    }
    return el("div", { class: "dg-loot " + l.tier, title: `${l.name} (${l.tier})` }, cv, el("span", { class: "dg-loot-nm" }, l.name));
  }

  // ---------- the room vignette (placeholder: the room's kind on a lit floor, with the crew) ----------
  const THEME_WALL = { goblin: "#4a3a26", beast: "#4a3e2c", cave: "#3e3428", undead: "#3a3640", swamp: "#2e3a26", ice: "#4a5a6a", sea: "#2a3e46", fire: "#4a2a1e" };
  function vignette(D, rm, crewHeroes) {
    const W = 132, H = 52, g = new Art.Grid(W, H);
    const wall = mix(THEME_WALL[D.theme] || THEME_WALL.cave, "#0e0a0e", Math.min(0.5, (rm.floor - 1) * 0.15)), floorC = mix(wall, "#c8a878", 0.25);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const glow = Math.max(0, 1 - Math.hypot((x - W / 2) / 70, (y - 30) / 40));
      let c = y < 36 ? wall : floorC;
      if (y < 36 && ((y % 8 === 0) || ((x + (y >> 3) * 6) % 12 === 0))) c = mix(c, "#000000", 0.25);
      if (y >= 36 && (x + y) % 5 === 0) c = mix(c, "#000000", 0.15);
      c = mix(c, "#f0b060", glow * 0.35);
      if (glow < 0.15 && (x + y) % 2) c = mix(c, "#000000", 0.4);
      g.set(x, y, c);
    }
    const iconG = iconGrid(rm.kind);
    for (let y = 0; y < iconG.h; y++) for (let x = 0; x < iconG.w; x++) {
      const c = iconG.get(x, y);
      if (c) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) g.set(W - 46 + x * 2 + i, 8 + y * 2 + j, c);
    }
    const cv = g.toCanvas(1);
    const ctx = cv.getContext("2d");
    crewHeroes.slice(0, 4).forEach((hh, i) => { try { ctx.drawImage(A.heroSprite(hh, 1, { animate: false }), 6 + i * 20, 16); } catch (e) { /* a figure is optional */ } });
    cv.className = "dg-vig";
    return cv;
  }

  // ---------- the page ----------
  // one page per dungeon: the island in Dungeons mode on top (views_map.js), the dungeon below, every dungeon at the foot
  A.route(/^\/dungeon\/(\w+)(?:\/(\w+))?(?:\/(\w+))?$/, (v, id, fl, rn) => {
    if (window.MapModes && MapModes.realm) MapModes.realm(v);
    const body = el("div");
    v.appendChild(body);
    const foot = () => { if (window.MapModes && MapModes.dungeonsTable) v.appendChild(MapModes.dungeonsTable()); };
    return A.load(`dungeon/${id}`).then((D) => { page(body, D, fl, rn); foot(); }, () => {
      body.appendChild(panel("No map of this place", el("p", null, "Nobody has drawn this dungeon yet.")));
      foot();
    });
  });

  function page(v, D, fl, rn) {
    const sd = S.dungeons[D.id] || {};
    const firstWalked = (D.floors.find((f) => f.walked) || D.floors[0]).floor;
    const ui = { floor: D.floors.some((f) => String(f.floor) === fl) ? +fl : D.inside.length ? D.inside[0].floor : lastFloorWalked(D) || firstWalked, sel: rn || null, run: null };
    const head = headPanel(D, sd, ui);
    const sheet = el("section", { class: "panel dg-sheet" });
    const days = daysPanel(D, ui);
    v.append(head, sheet, days);
    function pick(f) {
      stopRun(ui);
      ui.floor = f; ui.sel = null;
      try { history.replaceState(null, "", `#/dungeon/${D.id}/${f}`); } catch (e) { /* the address bar just won't follow */ }
      drawSheet(sheet, D, ui);
    }
    ui.pick = pick;
    const go = () => {
      drawSheet(sheet, D, ui);
      if (rn) requestAnimationFrame(() => { const m = sheet.querySelector(".dg-card:not([hidden])") || sheet.querySelector(".dg-mapbox"); if (m) m.scrollIntoView({ block: "center" }); });
    };
    // a font must be in before the sheet measures and writes its notes
    if (Pen.handMode === "font") Pen.fontsReady().then(go); else go();
  }
  // the one-time shift (export: shifted) reset every lair; new tenants since then say it themselves
  const shiftedOnly = (D) => !!D.shifted && !(D.tenant && D.tenant.day && D.tenant.day >= D.shifted);
  function lastFloorWalked(D) {
    let best = null;
    for (const f of D.floors) for (const r of f.rooms) if (r.state && (!best || r.state.d > best.d)) best = { d: r.state.d, f: f.floor };
    return best && best.f;
  }

  function headPanel(D, sd, ui) {
    const p = el("section", { class: "panel dg-head" });
    const info = el("div", { class: "dg-info" });
    p.append(info);
    if (window.TownScenes) { try { const bd = TownScenes.header(D.id, 560, 150); bd.classList.add("dg-header-art"); info.appendChild(bd); } catch (e) { /* the picture is optional */ } }
    info.append(el("h1", { class: "dg-name" }, D.name),
      el("p", { class: "small muted" }, `Level ${D.level} dungeon · ${cap(D.theme)} · ${A.plural(D.floors.length, "floor")}`));
    if (D.desc) info.appendChild(el("p", { class: "small" }, D.desc));
    const ev = window.MapModes && MapModes.eventLine ? MapModes.eventLine(D.id) : null;
    if (ev) info.appendChild(ev);
    const q = () => (window.Views && Views.helpLink ? Views.helpLink("explored", "explored") : null);
    const pct = Math.round(D.explored || 0);
    // a reset lair has nothing mapped yet: say so in words rather than draw an empty bar
    if (shiftedOnly(D) && !pct) info.appendChild(el("div", { class: "small dg-explored" }, el("span", null, `The tunnels shifted ${A.when(D.shifted, "on")}: the new rooms are not yet explored.`, q())));
    else if (D.tenant && D.tenant.day && !pct) info.appendChild(el("div", { class: "small dg-explored" }, el("span", null, "New tenants: not yet explored.", q())));
    else info.appendChild(el("div", { class: "small dg-explored" }, el("span", null, `Explored: ${pct}% of its rooms`, q()), el("div", { class: "bar" }, el("i", { style: { width: pct + "%" } }))));
    if (D.tenant && D.tenant.day) info.appendChild(el("p", { class: "tiny dim dg-tenant" }, `New tenants moved in ${A.when(D.tenant.day, "on")}; the old maps are gone.`));
    const B = D.boss || {}, kill = (B.kills || []).slice(-1)[0];
    const lairFloor = (D.floors.find((f) => f.rooms.some((r) => r.lair)) || {}).floor;
    const lairWalked = D.floors.some((f) => f.rooms.some((r) => r.lair && r.state));
    const bossArt = sd.boss ? A.monsterSprite(sd.boss, 2, B.alive !== false, B) : null;
    if (bossArt && B.alive === false) bossArt.classList.add("dg-slain-art");
    let bossLine;
    if (B.alive === false && kill) bossLine = [el("span", { class: "dg-stamp" }, "SLAIN"), " by ", crewLink(kill.crew, kill.by), ` ${A.when(kill.day, "on")}.`];
    else if (lairWalked) bossLine = [el("span", { class: "red" }, "Alive"), `, in its lair on ${A.floorWords(lairFloor, D.id)}.`];
    else if (B.rumoured) {
      const R = B.rumour_why || {};
      const why = R.by ? ` (${R.by} ${R.how} ${A.when(R.day, "on")})` : R.how ? ` (${R.how})` : "";
      bossLine = [el("span", { class: "dg-pencil" }, "Rumoured"), ` to wait somewhere below${lairFloor ? `, on ${A.floorWords(lairFloor, D.id)} by the talk` : ""}${why}.`];
    }
    else bossLine = [el("span", { class: "dg-pencil" }, "Unseen"), ". Nobody has heard where it waits."];
    const older = (B.kills || []).filter((k) => k !== kill || B.alive !== false);
    info.appendChild(el("div", { class: "dg-boss" }, bossArt, el("div", null, el("b", null, B.name || sd.boss_name || "The boss"), el("div", { class: "small" }, bossLine),
      older.length ? el("div", { class: "tiny dim" }, older.map((k, i) => [i ? "; " : "", `${k.boss} slain by `, crewLink(k.crew, k.by), ` ${A.when(k.day, "on")}`])) : null)));
    const F = D.famous || {};
    if (F.name) {
      const found = F.sprung != null;
      const on = (F.on || []).map((x) => (heroes[x] ? heroes[x].name : x));
      info.appendChild(el("p", { class: "small dg-famous" }, el("b", null, F.name), ": ",
        found ? [F.sprung ? `sprung ${F.sprung === 1 ? "once" : `${F.sprung} times`}` : "never sprung yet", on.length ? ` (on ${on.join(", ")})` : "", F.disarmed_by ? `, disarmed by ${F.disarmed_by}` : "", "."] : "the famous trap here. Nobody has found it yet."));
    }
    // one row per find; what the tenants before the last reset gave up is listed apart, since those rooms are gone
    const gen = (D.tenant || {}).gen || 1, spoils = (D.spoils || []).slice().reverse();
    const row = (s, isOld) => el("li", { class: [s.tier || "", isOld ? "old" : ""].join(" ").trim(), title: s.what ? cap(s.what) : "" }, lootSprite(s),
      el("span", { class: `dg-spoils-name${s.tier === "unique" ? " dg-unique" : ""}` }, s.name),
      el("span", { class: "dg-spoils-who" }, heroes[s.hero] ? el("a", { href: `#/hero/${s.hero}` }, s.who) : s.who, `, on ${A.floorWords(s.floor, D.id)}`, STATE_SAY(s)),
      el("span", { class: "dg-spoils-day" }, A.when(s.day)));
    // where it is today: worn says nothing, a carried unique is kept for later, anything else carried is for sale
    function STATE_SAY(s) { return s.state === "carried" ? (s.tier === "unique" ? ", kept, not yet worn" : ", stashed to sell") : s.state === "gone" && s.tier !== "unique" ? ", since sold" : ""; }
    // every unique is listed; ordinary finds fill up to the cap, and the rest are counted, never dropped silently
    const pick = (list, cap) => {
      const uniq = list.filter((s) => s.tier === "unique"), rest = list.filter((s) => s.tier !== "unique");
      const shown = uniq.concat(rest.slice(0, Math.max(0, cap - uniq.length)));
      return { shown: list.filter((s) => shown.includes(s)), more: list.length - shown.length };
    };
    const now = pick(spoils.filter((s) => (s.gen || 1) === gen), 6), old = pick(spoils.filter((s) => (s.gen || 1) !== gen), 4);
    const more = (n) => (n ? el("p", { class: "tiny dim" }, `and ${A.plural(n, "more find")}`) : null);
    if (spoils.length) {
      info.appendChild(el("div", { class: "small dg-spoils" },
        now.shown.length ? [el("b", null, "Spoils found here:"), el("ul", { class: "dg-spoils-list" }, now.shown.map((s) => row(s, false))), more(now.more)] : null,
        old.shown.length ? [el("b", null, "From earlier tenants:"), el("ul", { class: "dg-spoils-list" }, old.shown.map((s) => row(s, true))), more(old.more)] : null));
    }
    const ins = D.inside || [];
    // tonight: each crew below, the room it sleeps in and who keeps the watch; crews sharing a room are told together
    const groups = [];
    for (const x of ins) {
      const g = x.room != null && groups.find((g) => g[0].floor === x.floor && g[0].room === x.room);
      if (g) g.push(x); else groups.push([x]);
    }
    const watch = (xs) => xs.map((x) => x.camp && x.camp.watch).filter(Boolean);
    const said = (xs) => {
      const x = xs[0], room = x.camp && x.camp.room, w = watch(xs);
      return [xs.map((y, i) => [i ? (i === xs.length - 1 ? " and " : ", ") : "", el("span", { class: "dg-swatch", style: { background: crewInk(y.crew) } }), crewLink(y.crew, y.label)]),
        xs.length > 1 ? ` are sharing ${room || "one room"}` : room ? ` camped in ${room}` : "", ` on ${A.floorWords(x.floor, D.id)}`, x.room != null ? ` (room ${x.room})` : "",
        w.length ? `, ${w.join(" and ")} on watch` : ""];
    };
    info.appendChild(el("p", { class: "small dg-inside" }, ins.length ? ["Below tonight: ", groups.map((xs, i) => [i ? "; " : "", said(xs)]), "."]
      : "Nobody is below tonight."));
    void ui;
    return p;
  }

  // ---------- the floor sheet ----------
  const narrowQ = window.matchMedia ? window.matchMedia("(max-width: 640px)") : { matches: false };
  function drawSheet(sheet, D, ui, replay) {
    sheet.innerHTML = "";
    const floor = D.floors.find((f) => f.floor === ui.floor) || D.floors[0];
    const wide = !narrowQ.matches;
    const G = Ink.layout(D, floor, { wide });
    const st = replay ? replay.state : Pen.known(D, floor);
    st.rumour = !!(D.boss && D.boss.rumoured);
    if (!replay) st.crews = (D.inside || []).filter((x) => x.floor === floor.floor).map((x) => ({ crew: x.crew, n: x.room != null ? x.room : crewRoom(D, x.crew, floor) })).filter((x) => x.n != null);
    const depth = (n) => { const w = Ink.depthWord(n, D.floors.length); return w ? ` · ${w}` : ""; };
    const tabs = el("div", { class: "dg-tabs", role: "tablist" }, D.floors.map((f) => { const [w, t] = walkedOf(f); return el("button", { type: "button", role: "tab", "aria-selected": String(f.floor === floor.floor), class: "dg-tab" + (f.floor === floor.floor ? " on" : ""), onclick: () => ui.pick(f.floor) },
      el("b", null, `Floor ${f.floor}`, el("span", { class: "dg-tab-d" }, depth(f.floor))), el("span", { class: "dg-tab-n" }, `${w} of ${t} walked`)); }));
    sheet.append(el("h2", null, `${D.name}, floor ${floor.floor}${depth(floor.floor)}`), el("div", { class: "dg-floorbar" }, tabs, depthStack(D, floor.floor, ui)),
      el("p", { class: "tiny dim dg-sub" }, walkedOf(floor)[0] ? `${walkedOf(floor)[0]} of ${walkedOf(floor)[1]} rooms walked. Inked as the crews come home; pencil marks the rooms a door away that nobody has opened.` : shiftedOnly(D) ? `The tunnels shifted ${A.when(D.shifted, "on")}, and nobody has walked the new rooms yet. The old maps went in the fire.` : D.tenant && D.tenant.day ? `Nobody has walked this floor since the new tenants moved in ${A.when(D.tenant.day, "on")}. The old maps went with the old tenants.` : floor.floor > 1 && !(D.floors.find((f) => f.floor === floor.floor - 1) || { rooms: [] }).rooms.some((r) => r.stair && r.state) ? "Nobody has found the way down to this floor yet." : "Nobody has walked this floor yet. The way in and the doors off it are pencilled in."));
    const seen = new Set(), notes = (D.notes || []).filter((n) => n.floor === floor.floor && (!replay || n.day < replay.before) && G.byN[key(n.room)] && !seen.has(n.hero + n.room + n.text) && seen.add(n.hero + n.room + n.text)).sort((a, b) => a.day - b.day);
    // the sheet carries the newest notes whose rooms are inked; the rest wait in the list below
    const onSheet = () => { const txt = new Set(); return notes.slice().reverse().filter((n) => n.text.length <= 90 && st.inked.has(key(n.room)) && !txt.has(n.text) && txt.add(n.text)).slice(0, 10); };
    const cv = el("canvas", { class: "dg-map" + (wide ? " wide" : ""), role: "img", "aria-label": `Map of floor ${floor.floor}` });
    let placed = Ink.draw(cv, G, D, st, onSheet());
    if (wide) cv.style.width = G.W * 2 + "px";
    const box = el("div", { class: "dg-mapbox" }, cv);
    const layer = el("div", { class: "dg-layer" });
    box.appendChild(layer);
    const pos = (x, y) => ({ left: (x / G.W) * 100 + "%", top: (y / G.H) * 100 + "%" });
    const card = el("div", { class: "dg-card", hidden: true });
    const list = el("div", { class: "dg-notes" });
    const drawn = new Set(placed.map((p) => p.note));
    const perRoom = {};
    notes.forEach((n, i) => {
      list.appendChild(noteSlip(n, i + 1, i));
      if (drawn.has(n) || G.shown.get(key(n.room)) !== 1) return;
      const b = G.byN[key(n.room)], k = perRoom[key(n.room)] = (perRoom[key(n.room)] || 0) + 1;
      const pin = el("button", { type: "button", class: "dg-pin", style: pos(b.x0 + b.w + 1 + (k - 1) * 6, b.y0 + b.h + (k - 1) * 4), title: `${n.name}'s note`, "aria-label": `Note ${i + 1}, by ${n.name}` }, String(i + 1));
      pin.addEventListener("click", (ev) => { ev.stopPropagation(); showNote(card, n, i + 1); for (const x of list.querySelectorAll(".dg-note")) x.classList.toggle("on", x.dataset.i === String(i)); });
      layer.appendChild(pin);
    });
    const ring = el("div", { class: "dg-ring", hidden: true });
    layer.appendChild(ring);
    const select = (b, scroll) => {
      ui.sel = key(b.r.n);
      Object.assign(ring.style, pos(b.cx, b.cy), { width: ((b.w + 8) / G.W) * 100 + "%", height: ((b.h + 8) / G.H) * 100 + "%" });
      ring.hidden = false;
      showRoom(card, D, floor, b.r, st, notes);
      if (scroll) card.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
    };
    // a tap anywhere on a drawn room opens its card, even mid-replay; rooms the sheet doesn't show can't be hit
    const hitRoom = (ev) => {
      const r = cv.getBoundingClientRect(), x = ((ev.clientX - r.left) / r.width) * G.W, y = ((ev.clientY - r.top) / r.height) * G.H;
      const tol = Math.max(2, (10 * G.W) / r.width);
      const gap = (q) => Math.min(...q.b.cells.map(([cx0, cy0]) => { const [X, Y] = G.cellPx(cx0, cy0); return Math.hypot(Math.max(X - x, 0, x - (X + G.CELL)), Math.max(Y - y, 0, y - (Y + G.CELL))); }));
      return G.rooms.filter((q) => G.shown.has(q.n)).map((q) => [gap(q), q]).filter(([g]) => g <= tol).sort((p, q) => p[0] - q[0]).map(([, q]) => q)[0];
    };
    cv.addEventListener("click", (ev) => {
      const b = hitRoom(ev);
      if (!b) return;
      if (ui.run) { stopRun(ui); drawSheet(sheet, D, Object.assign(ui, { sel: key(b.r.n) })); const c = sheet.querySelector(".dg-card"); if (c) c.scrollIntoView({ block: "nearest" }); return; }
      select(b, true);
      try { history.replaceState(null, "", `#/dungeon/${D.id}/${floor.floor}/${b.r.n}`); } catch (e) { /* the address bar just won't follow */ }
    });
    cv.addEventListener("mousemove", (ev) => { cv.style.cursor = hitRoom(ev) ? "pointer" : "default"; });
    const status = el("div", { class: "dg-status", hidden: true });
    const hint = notes.length ? (wide ? "Tap a room for its story. Every hero's note is below, in their own hand." : "Tap a room for its story, or a numbered pin for a hero's note.") : D.tenant && D.tenant.day ? "Tap a room for its story. The old notes went with the old maps when the new tenants moved in." : "Tap a room for its story.";
    sheet.append(el("div", { class: "dg-mapcol" + (wide ? " wide" : ""), style: wide ? { maxWidth: G.W * 2 + 22 + "px" } : null }, box, status, el("p", { class: "tiny dim dg-hint" }, hint), card));
    if (notes.length) sheet.append(el("h4", { class: "dg-notes-h" }, "In the margins"), list);
    const self = { G, cv, box, layer, st, status, card, pos, floor, redraw: () => { placed = Ink.draw(cv, G, D, st, onSheet()); } };
    if (!sheet.dataset.watch && narrowQ.addEventListener) {
      sheet.dataset.watch = "1";
      narrowQ.addEventListener("change", () => { if (!ui.run && sheet.isConnected) drawSheet(sheet, D, ui); });
    }
    if (replay) return self;
    if (ui.sel && G.byN[ui.sel] && G.shown.has(ui.sel)) select(G.byN[ui.sel], false);
    return self;
  }
  // the floors side-on, stacked going down from the daylight: which floor this sheet is, where each crew is tonight, where the boss waits
  function depthStack(D, on, ui) {
    if (D.floors.length < 2) return null;
    const B = D.boss || {}, lairFloor = (D.floors.find((f) => f.rooms.some((r) => r.lair)) || {}).floor;
    const lairWalked = D.floors.some((f) => f.rooms.some((r) => r.lair && r.state));
    const bossName = String(B.name || "the boss").replace(/^the\s+/i, "");
    const boss = B.alive === false ? el("span", { class: "dg-depth-boss slain" }, `${bossName}, slain`)
      : lairWalked ? el("span", { class: "dg-depth-boss" }, `${bossName}'s lair`)
      : B.rumoured ? el("span", { class: "dg-depth-boss rumour" }, `${bossName}? (rumoured)`) : null;
    const rows = D.floors.map((f, i) => {
      const here = (D.inside || []).filter((x) => x.floor === f.floor);
      return el("button", { type: "button", class: "dg-depth-row" + (f.floor === on ? " on" : ""), style: { "--d": i / Math.max(1, D.floors.length - 1) }, onclick: () => ui.pick(f.floor),
        "aria-label": `Floor ${f.floor}, ${Ink.depthWord(f.floor, D.floors.length)}` },
        el("span", { class: "dg-depth-n" }, `${f.floor}`),
        el("span", { class: "dg-depth-w" }, Ink.depthWord(f.floor, D.floors.length)),
        el("span", { class: "dg-depth-who" }, here.map((x) => el("span", { class: "dg-depth-crew" }, el("span", { class: "dg-swatch", style: { background: crewInk(x.crew) } }), Ink.clean(Pen.crewShort(x.crew)))),
          f.floor === lairFloor ? boss : null));
    });
    return el("div", { class: "dg-depth", role: "group", "aria-label": "The floors, top to bottom" },
      el("div", { class: "dg-depth-sky" }, el("span", null, "daylight"), el("span", { class: "dg-depth-arrow" }, "floors count down ↓")), ...rows);
  }
  // where a crew below tonight stands: the last room it walked on that floor
  function crewRoom(D, crew, floor) {
    for (let i = (D.days || []).length - 1; i >= 0; i--) {
      const d = D.days[i];
      if (d.crew !== crew) continue;
      for (let j = d.rooms.length - 1; j >= 0; j--) if (d.rooms[j].floor === floor.floor) return d.rooms[j].n;
    }
    const mine = floor.rooms.filter((r) => r.state && r.state.crew === crew).sort((a, b) => b.state.d - a.state.d)[0];
    return mine ? mine.n : floor.rooms[0].n;
  }
  // a note card: the writer's bust, who they are and how they write, then the note itself in their hand
  function noteSlip(n, num, i) {
    const who = heroes[n.hero], H = Pen.HANDS[n.hand] || Pen.HANDS.neat;
    const slip = Ink.slip(n, 150);
    let face = null;
    if (who) { try { face = Ink.bustCanvas(who, 16); face.className = "dg-bust"; face.style.width = face.width * 2 + "px"; } catch (e) { /* a face is optional */ } }
    return el("div", { class: "dg-note", "data-i": String(i), style: { "--tilt": ((hashStr(n.text) % 5) - 2) * 0.4 + "deg" } },
      el("span", { class: "dg-num" }, String(num)),
      el("div", { class: "dg-note-head" }, face, el("div", null, who ? el("a", { href: `#/hero/${n.hero}` }, n.name) : el("b", null, n.name),
        el("div", { class: "tiny dim" }, [who ? who.title || cap(who.cls) : null, H.word].filter(Boolean).join(", ") + ` · ${A.when(n.day)}`))),
      slip);
  }
  function showNote(card, n, num) {
    card.hidden = false;
    card.innerHTML = "";
    card.className = "dg-card dg-card-note";
    card.append(el("button", { type: "button", class: "dg-x", "aria-label": "Close", onclick: () => (card.hidden = true) }, "×"),
      el("div", { class: "tiny dim" }, `Note ${num}`), noteSlip(n, num, -1));
  }
  // every day a crew walked this room, newest first: the day, the crew and the room's record (story, finds, beats for the vignette)
  function roomDays(D, floor, n) {
    const out = [];
    for (const d of (D.days || []).slice().sort((a, b) => b.day - a.day)) for (const rm of d.rooms) if (rm.floor === floor && key(rm.n) === key(n)) out.push({ d, rm });
    return out;
  }
  // a room's vignette on its own (delve_scenes.js + delve_fx.js, fetched on first use), each find named as it flies out
  // the story under it is told line by line as each beat plays (the whole story at once if the scene can't play)
  function roomScene(D, d, rm, stage, loot, caption) {
    const crewHeroes = (d.heroes || []).map((x) => heroes[x]).filter(Boolean);
    const named = (e) => {
      if (e.item) loot.appendChild(el("span", { class: "dg-chip " + e.item.tier }, e.item.name));
      else if (e.coin) loot.appendChild(el("span", { class: "dg-chip" }, `${e.coin} silver`));
      else if (e.say && caption) { for (const x of caption.querySelectorAll(".now")) x.classList.remove("now"); caption.append(el("span", { class: "dg-say now" }, A.storyText(e.say)), " "); }
    };
    if (caption) caption.innerHTML = "";
    const sd = S.dungeons[D.id] || {};
    const rec = Object.assign({}, rm, { theme: D.theme, pace: d.pace, crew: crewHeroes, did: D.id, boss: Object.assign({ mon: sd.boss }, D.boss && { name: D.boss.name, role: D.boss.role, gen: D.boss.gen }, d.boss) });
    return A.need(["delve_scenes", "delve_fx"]).then(() => {
      stage.appendChild(DelveScenes.player(rec, { onEvent: named, onRestart: () => { loot.innerHTML = ""; if (caption) caption.innerHTML = ""; }, ownClick: true, label: cap(rm.name) }));
      return DelveScenes.length(rec);
    }).catch(() => {
      stage.appendChild(vignette(D, rm, crewHeroes));
      if (caption) caption.append(A.storyText(rm.story || ""));
      for (const l of rm.loot || []) named({ item: l });
      if (rm.silver) named({ coin: rm.silver });
      return 0;
    });
  }
  const RESULT_SAY = { cleared: "cleared it", passed: "got through", "driven back": "were driven back", open: "left it open" };
  function showRoom(card, D, floor, r, st, notes) {
    card.hidden = false;
    card.innerHTML = "";
    card.className = "dg-card";
    card.appendChild(el("button", { type: "button", class: "dg-x", "aria-label": "Close", onclick: () => (card.hidden = true) }, "×"));
    const sleeping = (D.inside || []).filter((x) => x.floor === floor.floor && x.room != null && key(x.room) === key(r.n));
    const tonight = sleeping.length ? el("p", { class: "small dg-tonight" }, "Tonight: ", sleeping.map((x, i) => [i ? (i === sleeping.length - 1 ? " and " : ", ") : "",
      el("span", { class: "dg-swatch", style: { background: crewInk(x.crew) } }), crewLink(x.crew, x.label)]), sleeping.length > 1 ? " are camped here" : " is camped here",
      sleeping.some((x) => x.camp && x.camp.watch) ? ` (${sleeping.filter((x) => x.camp && x.camp.watch).map((x) => x.camp.watch).join(" and ")} on watch)` : "", ".") : null;
    if (!st.inked.has(key(r.n))) {
      card.append(el("div", { class: "dg-card-head" }, el("div", null, el("b", null, "Not yet explored"))));
      if (tonight) card.appendChild(tonight);
      return;
    }
    const s = r.state || st.inked.get(key(r.n)) || {};
    const icon = iconGrid(r.lair ? "lair" : r.kind).toCanvas(3);
    icon.className = "dg-card-ico";
    card.append(el("div", { class: "dg-card-head" }, icon, el("div", null, el("b", null, cap(r.name)),
      el("div", { class: "tiny dim" }, [KIND[r.kind] || cap(r.kind), r.side ? "off the main way" : null, `floor ${floor.floor}`, `room ${r.n}`].filter(Boolean).join(" · ")))));
    if (r.desc) card.appendChild(el("p", { class: "small" }, r.desc));
    if (tonight) card.appendChild(tonight);
    if (s.crew || s.by) card.appendChild(el("p", { class: "small" }, el("span", { class: "dg-swatch", style: { background: crewInk(s.crew) } }), s.s === "passed" ? "Passed through by " : "Cleared by ", crewLink(s.crew, s.by), s.d != null ? ` ${A.when(s.d, "on")}.` : ".",
      s.s === "wander" ? " Something has wandered back in since." : null,
      r.trap ? el("span", { class: "red" }, ` Trap: ${r.trap}${st.sprung.has(key(r.n)) ? ", sprung" : ""}.`) : null));
    const days = roomDays(D, floor.floor, r.n);
    for (const { d, rm } of days) {
      const fight = rm.fight && A.storyLink({ fight: rm.fight });
      const stage = el("div", { class: "dg-card-stage" }), loot = el("div", { class: "dg-inset-loot" });
      const btn = el("button", { type: "button", class: "watch dg-watch" }, "▸ watch");
      const story = el("p", { class: "small dg-told" }, A.storyText(rm.story || ""));
      btn.addEventListener("click", () => { btn.disabled = true; stage.innerHTML = ""; loot.innerHTML = ""; roomScene(D, d, rm, stage, loot, story).then(() => { btn.disabled = false; btn.textContent = "↻ again"; }); });
      card.appendChild(el("blockquote", { class: "dg-story" },
        el("div", { class: "tiny dim dg-story-head" }, el("span", null, `${A.when(d.day)} · ${d.label}${RESULT_SAY[rm.result] && rm.result !== "cleared" ? ` · ${RESULT_SAY[rm.result]}` : ""}`), btn),
        stage, loot, story,
        rm.loot && rm.loot.length || rm.silver ? el("div", { class: "dg-card-loot" }, (rm.loot || []).map((l) => el("span", { class: "dg-chip " + l.tier }, l.name)), rm.silver ? el("span", { class: "dg-chip" }, `${rm.silver} silver`) : null) : null,
        fight ? el("div", null, fight) : null));
    }
    if (!days.length) card.appendChild(el("p", { class: "tiny dim" }, "The crews' log no longer reaches back to the day this room was walked."));
    const mine = (notes || []).filter((n) => key(n.room) === key(r.n));
    if (mine.length) card.append(el("div", { class: "tiny dim dg-card-notes-h" }, mine.length > 1 ? "Notes about this room" : "A note about this room"), ...mine.map((n) => noteSlip(n, (notes || []).indexOf(n) + 1, -1)));
  }

  // ---------- the days below, each one watchable on the map ----------
  function daysPanel(D, ui) {
    const p = panel("Days below");
    const list = (D.days || []).slice().sort((a, b) => b.day - a.day);
    if (!list.length) {
      p.appendChild(el("p", { class: "small dim" }, shiftedOnly(D) ? `No crew has gone down since the tunnels shifted ${A.when(D.shifted, "on")}${((D.boss || {}).kills || []).length || (D.spoils || []).length ? "; the days below before that went with the old rooms" : ""}.` : "No crew has gone down yet."));
      return p;
    }
    const ul = el("ul", { class: "dg-days" });
    const PACE_SAY = { push: "pressing on", steady: "at a steady pace", cautious: "carefully" };
    // the day's best moment: a find, a wild or famous room, a fight, else the longest story
    const best = (d) => {
      const score = (r) => (r.loot || []).length * 3 + (r.silver || 0) / 10 + (r.fight ? 2 : 0) + (["secret", "famous", "lair"].includes(r.kind) ? 3 : 0) + (r.story || "").length / 400;
      const r = d.rooms.slice().sort((a, b) => score(b) - score(a))[0];
      if (!r || !r.story) return null;
      const first = r.story.split(/(?<=[.!?])\s/)[0];
      return el("div", { class: "tiny dim dg-best" }, `${cap(r.name)}: `, A.storyText(first.length > 160 ? first.slice(0, 157).replace(/\s+\S*$/, "") + "…" : first));
    };
    const row = (d) => {
      const floors = [...new Set(d.rooms.map((r) => r.floor))];
      return el("li", null, el("b", null, A.when(d.day)), ": ", crewLink(d.crew, d.label), `, ${A.plural(d.rooms.length, "room")}`, floors.length > 1 ? ` on the ${floors.sort((a, b) => a - b).map(A.floorOrd).join(" and ")} floors` : ` on ${A.floorWords(floors[0] || d.floor, D.id)}`, `, ${PACE_SAY[d.pace] || d.pace} `,
        el("button", { type: "button", class: "watch dg-watch", onclick: () => watch(D, ui, d) }, "▸ watch"), best(d));
    };
    list.slice(0, 8).forEach((d) => ul.appendChild(row(d)));
    p.appendChild(ul);
    if (list.length > 8) {
      const more = el("button", { type: "button", class: "dg-more" }, `Show ${list.length - 8} earlier days`);
      more.addEventListener("click", () => { list.slice(8).forEach((d) => ul.appendChild(row(d))); more.remove(); });
      p.appendChild(more);
    }
    return p;
  }

  // ---------- the replay ----------
  const PACE = { cautious: 0.55, steady: 1, push: 1.8 };
  function stopRun(ui) {
    if (!ui.run) return;
    ui.run.stopped = true;
    if (ui.run.wake) ui.run.wake();
    ui.run = null;
  }
  function watch(D, ui, day) {
    stopRun(ui);
    const run = { stopped: false, wake: null, skip: null };
    ui.run = run;
    const sheet = document.querySelector(".dg-sheet");
    if (!sheet) return;
    const calm = reduced(), speed = PACE[day.pace] || 1;
    // on a phone the map is far above the list; bring it into view before the banner starts walking
    if (sheet.getBoundingClientRect().top < 0 || sheet.getBoundingClientRect().top > window.innerHeight * 0.6) sheet.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    const wait = (ms) => new Promise((res) => { const t = setTimeout(res, ms); run.wake = () => { clearTimeout(t); res(); }; });
    const nextDay = (D.days || []).some((d) => d.crew === day.crew && d.day === day.day + 1) || ((D.inside || []).some((x) => x.crew === day.crew) && !(D.days || []).some((d) => d.crew === day.crew && d.day > day.day));
    let S2 = null, token = null, at = null, atN = null;
    const open = (f) => {
      ui.floor = f;
      const fl = D.floors.find((x) => x.floor === f);
      S2 = drawSheet(sheet, D, ui, { before: day.day, state: Object.assign(Pen.known(D, fl, day.day), { crews: [] }) });
      token = el("div", { class: "dg-token" + (calm ? " calm" : "") }, crewToken(day.crew, 2));
      S2.layer.appendChild(token);
      S2.status.hidden = false;
      at = null; atN = null;
    };
    const status = (i) => {
      S2.status.innerHTML = "";
      S2.status.append(el("span", null, el("b", null, A.when(day.day)), ` · ${day.label} · room ${Math.min(i + 1, day.rooms.length)} of ${day.rooms.length} · ${day.pace} pace`),
        el("span", { class: "dg-ctl" }, el("button", { type: "button", class: "dg-btn", onclick: () => { if (run.skip) run.skip(); } }, "skip ▸"),
          el("button", { type: "button", class: "dg-btn", onclick: () => { stopRun(ui); drawSheet(sheet, D, ui); } }, "■ stop")));
    };
    const move = async (x, y) => {
      const p = S2.pos(x, y);
      if (!at || calm) { token.style.transition = "none"; Object.assign(token.style, p); at = [x, y]; return; }
      const d = Math.hypot(x - at[0], y - at[1]), ms = Math.min(1600, Math.max(70, (d / (36 * speed)) * 1000));
      token.style.transition = `left ${ms}ms linear, top ${ms}ms linear`;
      Object.assign(token.style, p);
      at = [x, y];
      await wait(ms);
    };
    // along the carved passages, corner to corner
    const walkTo = async (b) => {
      const pts = at && atN != null ? S2.G.route(atN, b.n) : [[b.cx, b.cy]];
      atN = b.n;
      for (const [x, y] of pts) {
        if (run.stopped) return;
        await move(x, y);
      }
    };
    (async () => {
      sheet.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
      for (let i = 0; i < day.rooms.length; i++) {
        if (run.stopped) return;
        const rm = day.rooms[i];
        if (!S2 || S2.floor.floor !== rm.floor) open(rm.floor);
        status(i);
        const b = S2.G.byN[key(rm.n)];
        if (!b) continue;
        await walkTo(b);
        if (run.stopped) return;
        await inset(rm, b);
        if (run.stopped) return;
        S2.st.inked.set(key(rm.n), { crew: day.crew, d: day.day, s: rm.result });
        if (rm.sprung) S2.st.sprung.add(key(rm.n));
        if (rm.kind === "lair" && D.boss && (D.boss.kills || []).some((k) => k.day === day.day)) S2.st.slain = true;
        S2.redraw();
        const flash = el("div", { class: "dg-flash", style: Object.assign(S2.pos(b.cx, b.cy), { width: ((b.w + 10) / S2.G.W) * 100 + "%", height: ((b.h + 10) / S2.G.H) * 100 + "%" }) });
        S2.layer.appendChild(flash);
        await wait(calm ? 500 : 650 / Math.sqrt(speed));
        flash.remove();
      }
      if (run.stopped || !S2) return;
      const last = day.rooms[day.rooms.length - 1], lb = S2.G.byN[key(last.n)];
      if (!nextDay && lb) {
        const door = S2.G.byN[key(S2.floor.rooms[0].n)];
        if (door && door !== lb) await walkTo(door);
      }
      if (run.stopped) return;
      const end = nextDay ? lb : S2.G.byN[key(S2.floor.rooms[0].n)];
      const mark = iconGrid(nextDay ? "camp" : "out").toCanvas(2);
      if (end) S2.layer.appendChild(el("div", { class: "dg-endmark", style: S2.pos(end.x0 + end.w, end.y0 + end.h) }, mark));
      if (!nextDay) token.classList.add("gone");
      S2.status.innerHTML = "";
      S2.status.append(el("span", null, el("b", null, A.when(day.day)), ` · ${day.label} · ${nextDay ? "made camp below" : "walked out into the daylight"}.`),
        el("span", { class: "dg-ctl" }, el("button", { type: "button", class: "dg-btn", onclick: () => watch(D, ui, day) }, "↻ again"),
          el("button", { type: "button", class: "dg-btn", onclick: () => { stopRun(ui); drawSheet(sheet, D, ui); } }, "today's map")));
      ui.run = null;
    })();

    // the room's vignette (delve_scenes.js + delve_fx.js, fetched on first use) plays from the room's record; each find is named as it flies out
    function inset(rm, b) {
      const story = rm.story || "";
      const stage = el("div", { class: "dg-vig-box" });
      const loot = el("div", { class: "dg-inset-loot" });
      const caption = el("p", { class: "small dg-inset-story", "aria-live": "polite" });
      const fight = rm.fight && A.storyLink({ fight: rm.fight });
      const box = el("div", { class: "dg-inset" + (calm ? " calm" : ""), role: "dialog", "aria-label": cap(rm.name) },
        el("div", { class: "dg-inset-head" }, el("span", { class: "tiny" }, KIND[rm.kind] || cap(rm.kind)), el("b", null, cap(rm.name))),
        stage, loot, caption, fight ? el("div", { class: "tiny" }, fight) : null);
      S2.box.appendChild(box);
      box.classList.add(b.cy / S2.G.H < 0.5 ? "low" : "high");
      const ready = roomScene(D, day, rm, stage, loot, caption);
      return new Promise((res) => {
        let done = false;
        const finish = () => { if (done) return; done = true; box.remove(); run.skip = null; res(); };
        run.skip = () => { if (run.wake) run.wake(); finish(); };
        box.addEventListener("click", run.skip);
        (async () => {
          const secs = await ready;
          if (done || run.stopped) return finish();
          const read = Math.min(5200, 1300 + story.length * 26) * (day.pace === "push" ? 0.85 : day.pace === "cautious" ? 1.1 : 1);
          await wait(calm ? read : Math.max(read, secs * 1000 + 2200));
          finish();
        })();
      });
    }
  }
})();
