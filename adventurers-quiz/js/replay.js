/* Fight replays: animates a stored combat log on a pixel stage. */
(function () {
  "use strict";
  const A = App;
  const { el, S, heroes } = A;
  const W = 256, H = 132, GROUND = 112;
  const ASPECT = 0.5, PX = 6;

  A.route(/^\/fight\/(\w+)$/, (v, id) => A.load(`fight/${id}`).then((f) => replayPage(v, f)).catch(() => {
    const art = Scenes.backdrop("plains", 200, 50, Art.hash(id));
    art.className = "faded-art";
    v.appendChild(el("section", { class: "panel faded" }, el("h2", null, "That fight has faded from memory"), art,
      el("p", null, "Only notable fights are kept for long. Routine scraps are forgotten after two weeks."),
      el("p", null, el("a", { class: "btn", href: "#/" }, "Back to the Crier"))));
  }));

  function unitGrid(u, frame) {
    const look = u.look || {};
    if (u.kind === "hero" && heroes[u.ref]) return Art.heroGrid(heroes[u.ref], frame, A.heroLook(heroes[u.ref]));
    if (look.pet) return Art.petGrid({ kind: look.pet, name: u.name, coat: look.coat }, frame);
    const m = S.monsters[u.ref];
    if (m) return Art.monsterGrid(Object.assign({}, m, { boss: u.boss }), frame);
    return Art.graveGrid();
  }

  function measure(u) {
    const g = unitGrid(u, 0);
    let l = g.w, r = -1, top = g.h;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.px[y * g.w + x]) { if (x < l) l = x; if (x > r) r = x; if (y < top) top = y; }
    u.sw = r < l ? g.w : r - l + 1;
    u.sh = r < l ? g.h : g.h - top;
  }
  // how far apart two neighbours must stand: lookalikes may overlap a lot (the stagger keeps them readable), but a short
  // sprite next to a tall one is swallowed by any overlap, so the allowance shrinks with the square of the height ratio
  function need(a, b) {
    const hr = Math.min(a.sh, b.sh) / Math.max(a.sh, b.sh);
    return (a.sw + b.sw) / 2 - 0.7 * Math.min(a.sw, b.sw) * hr * hr;
  }
  // the two sides meet in the middle; a crowded side packs tighter so the camera can come in close
  function layout(units) {
    for (const side of [0, 1]) {
      const mine = units.filter((u) => u && u.side === side);
      mine.forEach(measure);
      const step = Math.max(12, Math.min(20, 64 / Math.max(1, mine.length)));
      const front = mine.filter((u) => u.row === "front"), back = mine.filter((u) => u.row !== "front");
      const line = [...front, ...back], shift = back.length && front.length ? 4 : 0;
      const extra = line.slice(1).map((u, i) => Math.max(0, need(line[i], u) - step));
      // a side too wide for its half of the stage gives up the extra room first, then packs tighter than usual
      const base = step * extra.length, more = extra.reduce((a, b) => a + b, 0);
      const room0 = 113 - shift - (line.length ? line[line.length - 1].sw / 2 : 0);
      // a broad front fighter steps back, if there's room, so it doesn't stand on top of the other side's front
      const lead = line.length ? Math.max(0, Math.min(10, line[0].sw / 2 - 14, room0 - base - more)) : 0;
      const room = room0 - lead;
      const squeeze = base + more <= room ? 1 : Math.max(0, (room - base) / more);
      const pack = base > room ? room / base : 1;
      let dist = 115 - lead;
      line.forEach((u, i) => {
        if (i) dist -= (step + extra[i - 1] * squeeze) * pack;
        u.x = side === 0 ? dist - (u.row !== "front" ? shift : 0) : W - dist + (u.row !== "front" ? shift : 0);
        u.y = GROUND - 2 - (i % 2) * 7 + (u.row !== "front" ? -3 : 0);
      });
    }
  }
  // the view: just wide enough for everyone, ground at the bottom, sky cropped away
  function camera(units) {
    const live = units.filter(Boolean), pad = (u) => Math.max(26, Math.ceil(unitGrid(u, 0).w / 2) + 4);
    const lo = Math.min(...live.map((u) => u.x - pad(u))), hi = Math.max(...live.map((u) => u.x + pad(u)));
    const vw = Math.round(Math.min(W, Math.max(150, hi - lo))), vh = Math.round(vw * ASPECT);
    const vx = Math.round(Math.max(0, Math.min(W - vw, (lo + hi) / 2 - vw / 2)));
    const vy = Math.max(0, Math.min(H - vh, GROUND + 12 - vh));
    return { vx, vy, vw, vh };
  }

  const isPlural = (l) => /^([2-9]|\d\d+)\s/.test(l) || / and /.test(l) || /^(Several|Many|A pack of) /.test(l);
  const vb = (l, one, many) => `${l} ${isPlural(l) ? many : one}`;
  function describe(e, units, labels) {
    const n = (i) => (units[i] ? units[i].name : "?");
    const side = (k) => (labels && labels[k]) || (k === 0 ? "The heroes" : "The enemy");
    switch (e.fx) {
      case "start": return "The fight begins.";
      case "act": return `${n(e.a)} uses ${e.k}.`;
      case "hit": return `${n(e.a)} hits ${n(e.t)} for ${e.v}${e.st ? ` (${e.st})` : ""}.`;
      case "crit": return `CRITICAL! ${n(e.a)} hits ${n(e.t)} for ${e.v}.`;
      case "miss": return `${n(e.a)} misses ${n(e.t)}.`;
      case "heal": return e.t === e.a ? `${n(e.a)} patches up, recovering ${e.v}${e.k ? ` (${e.k})` : ""}.` : `${n(e.a)} heals ${n(e.t)} for ${e.v}${e.k ? ` (${e.k})` : ""}.`;
      case "guard": return `${n(e.a)}: ${e.k}. Come at me.`;
      case "buff": return `${n(e.a)}: ${e.k}.`;
      case "rally": return `${n(e.a)}: ${e.k}! Resolve +${e.v}.`;
      case "fear": return `${n(e.a)}: ${e.k}. Enemy resolve -${e.v}.`;
      case "debuff": return `${n(e.a)}: ${e.k}.`;
      case "stealth": return `${n(e.a)} vanishes into the shadows.`;
      case "summon": return `${n(e.a)} calls in ${e.new ? e.new.name : "help"}.`;
      case "tick": return `${n(e.a)} suffers ${e.v} from ${e.st}.`;
      case "stunned": return `${n(e.a)} is ${e.st === "charm" ? "charmed" : "stunned"} and does nothing.`;
      case "thorns": return `${n(e.t)} is hurt for ${e.v} by ${n(e.a)}'s spikes.`;
      case "down": return `${n(e.t)} goes down!`;
      case "rout": return vb(side(e.side), "breaks and runs!", "break and run!");
      case "surrender": return vb(side(e.side), "surrenders!", "surrender!");
      case "flee": return `${n(e.a)} escapes.`;
      case "carry": return `${n(e.a)} drags ${n(e.t)} out.`;
      case "end": return e.outcome === "stalemate" ? "Both sides back off." : "The fight is over.";
      default: return "";
    }
  }

  // the moments worth telling a friend: first blood, the biggest hit, the save, who did the damage, how it ended
  function highlights(f, units) {
    const n = (i) => (units[i] ? units[i].name : "someone");
    const hp = units.map((u) => (u ? u.hp0 : 0)), lastHit = {}, downs = {};
    let first = null, big = null, save = null, carry = null, misses = 0, swings = 0;
    for (const e of f.log) {
      if (e.fx === "miss") { misses++; swings++; }
      if (e.fx === "hit" || e.fx === "crit") {
        swings++;
        if (!first) first = e;
        if (!big || e.v > big.v) big = e;
        lastHit[e.t] = e.a;
        hp[e.t] = e.hp != null ? e.hp : Math.max(0, hp[e.t] - e.v);
      }
      if (e.fx === "thorns" || e.fx === "tick") { const t = e.fx === "tick" ? e.a : e.t; hp[t] = Math.max(0, hp[t] - e.v); }
      if (e.fx === "heal" && units[e.t]) {
        const before = hp[e.t], max = units[e.t].maxhp || 1;
        if (before / max < 0.35 && (!save || before / max < save.pct)) save = { e, before, pct: before / max };
        hp[e.t] = e.hp != null ? e.hp : hp[e.t] + e.v;
      }
      if (e.fx === "carry" && !carry) carry = e;
      if (e.fx === "down" && lastHit[e.t] != null && units[lastHit[e.t]] && units[lastHit[e.t]].side !== (units[e.t] || {}).side) downs[lastHit[e.t]] = (downs[lastHit[e.t]] || 0) + 1;
    }
    const out = [];
    if (first) out.push(["First blood", `${n(first.a)} hits ${n(first.t)} for ${first.v}.`]);
    if (big && big !== first) out.push(["Biggest hit", `${n(big.a)}, ${big.v} on ${n(big.t)}${big.fx === "crit" ? ", a critical" : ""}.`]);
    else if (big && big.fx === "crit") out.push(["Biggest hit", `That first one, and a critical too.`]);
    if (save) out.push(["The save", `${n(save.e.a)} ${save.e.t === save.e.a ? "patches up" : "heals " + n(save.e.t)} at ${save.before} hp, for ${save.e.v}${save.e.k ? ` (${save.e.k})` : ""}.`]);
    else if (carry) out.push(["The save", `${n(carry.a)} drags ${n(carry.t)} out of it.`]);
    const top = Object.entries(downs).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) out.push(["Most takedowns", `${n(+top[0])}, ${top[1]}.`]);
    out.push(["How it ended", `${outcomeText(f)} after ${f.rounds} round${f.rounds === 1 ? "" : "s"}.`]);
    if (swings >= 8 && misses / swings > 0.6) out.push(["Also", `${misses} of ${swings} swings missed. Nobody is proud of that.`]);
    return out;
  }

  function replayPage(v, f) {
    const units = f.lineup.map((u) => Object.assign({}, u, { hp0: u.hp }));
    for (const e of f.log) if (e.fx === "summon" && e.new) units[e.new.i] = Object.assign({}, e.new, { hidden: true, hp0: e.new.hp });
    layout(units);
    const cam = camera(units);
    const label = (s) => f.labels[s] || (s === 0 ? "Heroes" : "Foes");
    const heroIds = f.heroes || [];
    // every fighter gets a mark: numbers for the left side, letters for the right, the same on the stage and in the list
    const marks = {};
    for (const s of [0, 1]) units.filter((u) => u && u.side === s).forEach((u, k) => (marks[u.i] = s === 0 ? String(k + 1) : String.fromCharCode(65 + (k % 26))));
    v.appendChild(el("h1", null, f.title || `${label(0)} vs ${label(1)}`));
    v.appendChild(el("p", { class: "muted" }, `${A.when(f.day)} · ${f.place_name} · ${f.rounds} round${f.rounds === 1 ? "" : "s"} · `,
      el("b", { class: "gold" }, outcomeText(f)), " · ", heroIds.filter((h) => heroes[h]).map((h, i) => [i ? ", " : "", A.heroLink(h)])));
    const cv = el("canvas", { class: "stage", width: cam.vw * PX, height: cam.vh * PX });
    const logBox = el("div", { class: "rlog" });
    const lines = f.log.map((e, i) => el("div", { "data-i": i }, describe(e, units, f.labels)));
    lines.forEach((l) => logBox.appendChild(l));
    const hl = highlights(f, units);
    let speed = 1, playing = true;
    const playBtn = el("button", { class: "btn small" }, "❚❚ Pause");
    const ctrls = el("div", { class: "controls" }, playBtn,
      el("button", { class: "btn small", onclick: () => { idx = 0; t = 0; reset(); playing = true; playBtn.textContent = "❚❚ Pause"; } }, "↺ Restart"),
      el("button", { class: "btn small", onclick: () => { finishAll(); } }, "⏭ Skip"),
      ...[1, 2, 4].map((s) => el("button", { class: "btn small", onclick: () => (speed = s) }, `${s}×`)),
      el("button", { class: "btn small", onclick: () => A.copy(`${f.title}: ${outcomeText(f)}\n${hl.filter(([k]) => k !== "How it ended" && k !== "Also").map(([k, x]) => `${k}: ${x}`).join("\n")}\n${A.shareUrl("#/fight/" + f.id)}`, "Fight and highlights copied.") }, "Share"));
    playBtn.onclick = () => { playing = !playing; playBtn.textContent = playing ? "❚❚ Pause" : "▶ Play"; };

    const rows = {};
    const sideList = (s) => el("div", { class: "fside s" + s }, el("div", { class: "fside-name" }, label(s)),
      units.filter((u) => u && u.side === s).map((u) => {
        const fill = el("i"), num = el("span", { class: "fhp" }), row = el("div", { class: "fighter", hidden: !!u.hidden },
          el("span", { class: "fmark s" + s }, marks[u.i]), u.kind === "hero" && heroes[u.ref] ? A.heroLink(u.ref) : el("span", null, u.name),
          el("div", { class: "fbar" }, fill), num);
        rows[u.i] = { row, fill, num };
        return row;
      }));
    const roster = el("div", { class: "fighters" }, sideList(0), sideList(1));
    const hlBox = el("section", { class: "panel highlights" }, el("h3", null, "Highlights"),
      el("dl", { class: "kv hl" }, hl.map(([k, x]) => [el("dt", null, k), el("dd", null, x)])));
    v.appendChild(el("div", null, cv, roster, ctrls));
    v.appendChild(hlBox);
    v.appendChild(el("details", { class: "panel blow" }, el("summary", null, el("h3", null, "Blow by blow")), logBox));
    const sparks = [];
    let shake = 0;

    const kind = Scenes.locKind(f.place);
    const bg = window.Battlefield ? Battlefield.backdrop(f) : Scenes.backdrop(kind === "town" ? "plains" : kind, W, H, Art.hash(f.id), { battle: true });
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const o = off.getContext("2d");
    o.imageSmoothingEnabled = false;

    let idx = 0, t = 0, last = performance.now(), frame = 0, frameT = 0;
    let res = [100, 100];
    const floats = [];
    function syncRoster() {
      for (const u of units) {
        const r = u && rows[u.i];
        if (!r) continue;
        r.row.hidden = !!u.hidden;
        r.row.classList.toggle("out", !!(u.down || u.fled));
        r.fill.style.width = `${Math.max(0, Math.min(100, (100 * u.hp) / Math.max(1, u.maxhp)))}%`;
        r.num.textContent = u.down ? "down" : u.fled ? "fled" : `${Math.max(0, Math.round(u.hp))}/${u.maxhp}`;
      }
    }
    function reset() {
      for (const u of units) { if (!u) continue; u.hp = u.hp0; u.down = false; u.fled = false; u.dx = 0; u.flash = 0; u.hidden = !!u.hidden && f.lineup.every((x) => x.i !== u.i); u.label = null; }
      res = [100, 100];
      floats.length = 0;
      syncRoster();
    }
    reset();
    function apply(e) {
      const U = (i) => units[i] || {};
      if (e.res) res = e.res.map((x) => Math.min(x, 160));
      if (window.Sound && !finishing) Sound.sfx({ hit: "hit", crit: "crit", miss: "miss", heal: "heal", down: "down" }[e.fx]);
      switch (e.fx) {
        case "hit": case "crit": case "thorns":
          U(e.t).hp = e.hp != null ? e.hp : Math.max(0, U(e.t).hp - e.v); U(e.t).flash = 1;
          for (let k = 0; k < (e.fx === "crit" ? 14 : 7); k++) {
            const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * (e.fx === "crit" ? 50 : 30);
            sparks.push({ x: U(e.t).x, y: U(e.t).y - 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 15, life: 0.5, col: e.fx === "crit" ? "#ffd84a" : k % 2 ? "#ffffff" : "#ffb070" });
          }
          if (e.fx === "crit") shake = 0.35;
          floats.push({ x: U(e.t).x, y: U(e.t).y - 30, txt: String(e.v), col: e.fx === "crit" ? "#ffd84a" : "#ffffff", life: 1, big: e.fx === "crit" });
          break;
        case "tick": U(e.a).hp = Math.max(0, U(e.a).hp - e.v); floats.push({ x: U(e.a).x, y: U(e.a).y - 30, txt: String(e.v), col: e.st === "burn" ? "#ff8a2a" : "#7ad08a", life: 1 }); break;
        case "miss": floats.push({ x: U(e.t).x, y: U(e.t).y - 30, txt: "miss", col: "#c8bca8", life: 1 }); break;
        case "heal": U(e.t).hp = e.hp != null ? e.hp : U(e.t).hp + e.v; floats.push({ x: U(e.t).x, y: U(e.t).y - 30, txt: "+" + e.v, col: "#7ad08a", life: 1 }); break;
        case "down": U(e.t).down = true; shake = Math.max(shake, 0.2); break;
        case "flee": U(e.a).fled = true; break;
        case "summon": if (e.new) units[e.new.i].hidden = false; break;
        case "stunned": floats.push({ x: U(e.a).x, y: U(e.a).y - 32, txt: "zz", col: "#9ab8ff", life: 1 }); break;
        case "act": case "guard": case "buff": case "rally": case "fear": case "debuff": case "stealth":
          if (e.k && e.k !== "Attack") floats.push({ x: U(e.a).x, y: U(e.a).y - 40, txt: e.k, col: e.fx === "fear" ? "#ff8a8a" : e.fx === "rally" ? "#ffd84a" : "#f1e3c2", life: 1.3, label: true });
          if (e.fx === "stealth") U(e.a).ghost = 2;
          break;
      }
      if (!finishing) syncRoster();
    }
    let finishing = false;
    function finishAll() { finishing = true; while (idx < f.log.length) { apply(f.log[idx]); idx++; } t = 0; finishing = false; syncRoster(); }

    function step(now) {
      if (!cv.isConnected) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      frameT += dt;
      if (frameT > 0.4) { frame ^= 1; frameT = 0; }
      if (playing && idx < f.log.length) {
        const e = f.log[idx];
        const dur = ["act", "hit", "crit", "down", "rout", "surrender", "end", "summon"].includes(e.fx) ? 0.55 : 0.35;
        t += (dt * speed) / dur;
        if (t >= 1) {
          apply(e);
          lines.forEach((l) => l.classList.remove("cur"));
          if (lines[idx]) { lines[idx].classList.add("cur"); const top = lines[idx].offsetTop - logBox.offsetTop - 120; logBox.scrollTop = top; }
          idx++; t = 0;
        }
      }
      for (const fl of floats) { fl.life -= dt * 1.1 * speed; fl.y -= dt * 14; }
      for (const sp of sparks) { sp.life -= dt * speed; sp.x += sp.vx * dt * speed; sp.y += sp.vy * dt * speed; sp.vy += 120 * dt * speed; }
      for (let k = sparks.length - 1; k >= 0; k--) if (sparks[k].life <= 0) sparks.splice(k, 1);
      shake = Math.max(0, shake - dt);
      while (floats.length && floats[0].life <= 0) floats.shift();
      draw();
      requestAnimationFrame(step);
    }

    function draw() {
      o.clearRect(0, 0, W, H);
      o.drawImage(bg, 0, 0);
      if (bg.life) bg.life(o, performance.now() / 1000);
      const cur = f.log[idx];
      // sprites shorter than the tallest on stage draw over taller ones that stand a little nearer, so a lunging troll
      // never swallows a slime; a line of lookalikes keeps plain depth order
      const tallest = Math.max(...units.map((u) => (u ? u.sh : 0)));
      const depth = (u) => u.y + (tallest - u.sh) * 0.6;
      const order = units.filter((u) => u && !u.hidden).sort((a, b) => depth(a) - depth(b));
      o.fillStyle = "rgba(0,0,0,0.28)";
      for (const u of order) if (!u.fled && !u.down) o.fillRect(Math.round(u.x - 8), Math.round(u.y - 1), 16, 2);
      for (const u of order) {
        if (u.fled) continue;
        let g = unitGrid(u, u.down ? 0 : frame);
        if (u.side === 1) g = g.flipX();
        let dx = 0;
        if (cur && cur.a === u.i && (cur.fx === "act" || cur.fx === "hit" || cur.fx === "crit") && !cur.ranged) dx = Math.sin(Math.min(1, t) * Math.PI) * 10 * (u.side === 0 ? 1 : -1);
        if (cur && cur.t === u.i && (cur.fx === "hit" || cur.fx === "crit")) dx += Math.sin(t * 40) * 1.5;
        if (cur && cur.fx === "flee" && cur.a === u.i) dx = t * 60 * (u.side === 0 ? -1 : 1);
        let img = u.flash > 0 ? g.tint("#ffffff", 0.7).toCanvas(1) : g.toCanvas(1);
        u.flash = Math.max(0, (u.flash || 0) - 0.15);
        const x = Math.round(u.x - g.w / 2 + dx), y = Math.round(u.y - g.h);
        o.save();
        if (u.down) {
          o.globalAlpha = 0.75;
          o.translate(Math.round(u.x), Math.round(u.y) - 3);
          o.rotate((u.side === 0 ? -1 : 1) * Math.PI / 2);
          o.drawImage(img, -(g.w >> 1), -(g.h >> 1));
        } else {
          if (u.ghost) o.globalAlpha = 0.5;
          o.drawImage(img, x, y);
        }
        o.restore();
      }
      // bars go on top of every sprite and step down past each other, or a neighbour's sprite or bar hides them
      const bars = [];
      for (const u of order) {
        if (u.fled || u.down || !u.maxhp) continue;
        const w = u.look && u.look.pet ? 12 : 16, bx = Math.round(u.x - w / 2);
        let by = Math.round(u.y + 1);
        while (bars.some((b) => bx - 1 < b.x + b.w + 2 && b.x - 1 < bx + w + 2 && by < b.y + 4 && b.y < by + 4)) by++;
        bars.push({ x: bx, y: by, w, u });
        o.fillStyle = "#120c18"; o.fillRect(bx - 1, by, w + 2, 4);
        o.fillStyle = u.side === 0 ? "#2a4a22" : "#4a1a16"; o.fillRect(bx, by + 1, w, 2);
        o.fillStyle = u.side === 0 ? "#7ad08a" : "#e2645c";
        o.fillRect(bx, by + 1, Math.max(0, Math.round((w * u.hp) / u.maxhp)), 2);
      }
      if (cur && cur.ranged && cur.fx === "act") {
        const a = units[cur.a], nxt = f.log[idx + 1];
        const tgt = nxt && units[nxt.t];
        if (a && tgt) {
          const px = a.x + (tgt.x - a.x) * t, py = a.y - 14 + (tgt.y - a.y) * t - Math.sin(t * Math.PI) * 12;
          o.fillStyle = "#ffe8a0"; o.fillRect(Math.round(px), Math.round(py), 2, 2);
          o.fillStyle = "#ff9a3a"; o.fillRect(Math.round(px) - (a.side === 0 ? 1 : -2), Math.round(py), 1, 1);
        }
      }
      for (const sp of sparks) { o.fillStyle = sp.col; o.fillRect(Math.round(sp.x), Math.round(sp.y), 1, 1); }

      ctx.clearRect(0, 0, cv.width, cv.height);
      const sx = shake > 0 ? Math.round((Math.random() - 0.5) * 6) : 0, sy = shake > 0 ? Math.round((Math.random() - 0.5) * 6) : 0;
      ctx.drawImage(off, cam.vx, cam.vy, cam.vw, cam.vh, sx, sy, cv.width, cv.height);
      // world to canvas, and a unit (U) that keeps type and plates the same size on screen however close the camera is
      const K = cv.width / cam.vw, U = cv.width / 256;
      // marks and numbers grow on a small screen, where the whole stage is only a few inches wide
      const B = U * Math.max(1, Math.min(1.8, 600 / (cv.clientWidth || 600)));
      const X = (x) => (x - cam.vx) * K, Y = (y) => (y - cam.vy) * K;
      const txt = (str, x, y, size, col, align, u) => {
        ctx.font = `${Math.round(size * (u || U))}px 'League Five', 'Pixelify Sans', monospace`;
        ctx.textAlign = align || "center";
        ctx.fillStyle = "#120c18"; ctx.fillText(str, x + 2, y + 2);
        ctx.fillStyle = col; ctx.fillText(str, x, y);
      };
      for (const b of bars) {
        const s = Math.round(4.5 * B), bx = Math.round(X(b.x) - s - 3), by = Math.round(Y(b.y) - s / 2 + K * 2);
        ctx.fillStyle = "#120c18"; ctx.fillRect(bx - 2, by - 2, s + 4, s + 4);
        ctx.fillStyle = b.u.side === 0 ? "#3f6a2c" : "#8e2a22"; ctx.fillRect(bx, by, s, s);
        ctx.font = `${Math.round(4 * B)}px 'League Five', 'Pixelify Sans', monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "#f6ebd0"; ctx.fillText(marks[b.u.i] || "", bx + s / 2, by + s / 2 + 1);
        ctx.textBaseline = "alphabetic";
      }
      for (const s of [0, 1]) {
        const pw = 88 * U, x = s === 0 ? 5 * U : cv.width - 5 * U - pw, val = Math.max(0, res[s]);
        ctx.fillStyle = "rgba(42,27,17,0.85)"; ctx.fillRect(x, 4 * U, pw, 15 * U);
        ctx.fillStyle = "#c8963e"; ctx.fillRect(x, 19 * U - U, pw, U);
        ctx.fillStyle = "#4a3020"; ctx.fillRect(x + 2 * U, 14 * U, pw - 4 * U, 3 * U);
        ctx.fillStyle = val > 900 ? "#b0a090" : val < 30 ? "#e2645c" : "#e8b84a";
        ctx.fillRect(x + 2 * U, 14 * U, Math.round(Math.min(1, Math.min(val, 160) / 160) * (pw - 4 * U)), 3 * U);
        txt(trunc(label(s), 24), s === 0 ? x + 3 * U : x + pw - 3 * U, 11.5 * U, 6.5, "#f1e3c2", s === 0 ? "left" : "right");
      }
      for (const fl of floats) {
        ctx.globalAlpha = Math.max(0, Math.min(1, fl.life));
        txt(fl.txt, X(fl.x), Y(fl.y), fl.label ? 6 : fl.big ? 10 : 8, fl.col, "center", B);
        ctx.globalAlpha = 1;
      }
      if (cur && ["rout", "surrender"].includes(cur.fx) || idx >= f.log.length) {
        const msg = idx >= f.log.length ? outcomeText(f) : cur.fx === "rout" ? vb(label(cur.side), "breaks!", "break!") : vb(label(cur.side), "surrenders!", "surrender!");
        const my = cv.height * 0.42;
        ctx.fillStyle = "rgba(42,27,17,0.82)"; ctx.fillRect(0, my - 12 * U, cv.width, 18 * U);
        ctx.fillStyle = "#c8963e"; ctx.fillRect(0, my - 12 * U, cv.width, U); ctx.fillRect(0, my + 6 * U - U, cv.width, U);
        txt(trunc(msg, 48), cv.width / 2, my + U, 9, "#ffd877");
      }
    }
    requestAnimationFrame((n) => { last = n; step(n); });
  }
  function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function outcomeText(f) {
    const L0 = f.labels[0], L1 = f.labels[1];
    if (f.outcome === "stalemate" || f.winner == null) return "Stalemate";
    const w = f.winner === 0 ? L0 : L1, l = f.winner === 0 ? L1 : L0;
    return { wiped: vb(w, "wins", "win"), fled: vb(l, "flees", "flee"), surrender: vb(l, "surrenders", "surrender") }[f.outcome] || vb(w, "wins", "win");
  }
})();
