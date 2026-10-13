/* Fight replays: animates a stored combat log on a pixel stage. */
(function () {
  "use strict";
  const A = App;
  const { el, S, heroes } = A;
  const W = 256, H = 132, GROUND = 112;

  A.route(/^\/fight\/(\w+)$/, (v, id) => A.load(`fight/${id}`).then((f) => replayPage(v, f)).catch(() => {
    v.appendChild(el("section", { class: "panel" }, el("h2", null, "That fight has faded from memory"),
      el("p", null, "Only notable fights are kept for long. Routine scraps are forgotten after two weeks.")));
  }));

  function unitGrid(u, frame) {
    const look = u.look || {};
    if (u.kind === "hero" && heroes[u.ref]) return Art.heroGrid(heroes[u.ref], frame, A.heroLook(heroes[u.ref]));
    if (look.pet) return Art.petGrid({ kind: look.pet, name: u.name }, frame);
    const m = S.monsters[u.ref];
    if (m) return Art.monsterGrid(Object.assign({}, m, { boss: u.boss }), frame);
    return Art.graveGrid();
  }

  function layout(units) {
    for (const side of [0, 1]) {
      for (const row of ["front", "back"]) {
        const us = units.filter((u) => u.side === side && u.row === row);
        const front = units.filter((x) => x.side === side && x.row === "front").length;
        const step = Math.max(12, Math.min(19, 92 / Math.max(1, us.length + (row === "back" ? front : 0))));
        us.forEach((u, i) => {
          const start = row === "front" ? 112 : 112 - Math.max(1, front) * step - 4;
          const dist = start - i * step;
          u.x = side === 0 ? dist : W - dist;
          u.y = GROUND - 2 - (i % 2) * 7 + (row === "back" ? -3 : 0);
          u.z = i;
        });
      }
    }
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

  function replayPage(v, f) {
    const units = f.lineup.map((u) => Object.assign({}, u, { hp0: u.hp }));
    for (const e of f.log) if (e.fx === "summon" && e.new) units[e.new.i] = Object.assign({}, e.new, { hidden: true, hp0: e.new.hp });
    layout(units);
    const label = (s) => f.labels[s] || (s === 0 ? "Heroes" : "Foes");
    const heroIds = f.heroes || [];
    v.appendChild(el("h1", null, f.title || `${label(0)} vs ${label(1)}`));
    v.appendChild(el("p", { class: "muted" }, `Season ${f.season}, world day ${f.day} · ${f.place_name} · ${f.rounds} round${f.rounds === 1 ? "" : "s"} · `,
      el("b", { class: "gold" }, outcomeText(f)), " · ", heroIds.filter((h) => heroes[h]).map((h, i) => [i ? ", " : "", A.heroLink(h)])));
    const g = el("div");
    const cv = el("canvas", { class: "stage", width: W * 4, height: H * 4 });
    const logBox = el("div", { class: "rlog" });
    const lines = f.log.map((e, i) => el("div", { "data-i": i }, describe(e, units, f.labels)));
    lines.forEach((l) => logBox.appendChild(l));
    let speed = 1, playing = true;
    const playBtn = el("button", { class: "btn small" }, "❚❚ Pause");
    const ctrls = el("div", { class: "controls" }, playBtn,
      el("button", { class: "btn small", onclick: () => { idx = 0; t = 0; reset(); playing = true; playBtn.textContent = "❚❚ Pause"; } }, "↺ Restart"),
      el("button", { class: "btn small", onclick: () => { finishAll(); } }, "⏭ Skip"),
      ...[1, 2, 4].map((s) => el("button", { class: "btn small", onclick: () => (speed = s) }, `${s}×`)),
      el("button", { class: "btn small", onclick: () => A.copy(`${f.title}: ${outcomeText(f)}\n${A.shareUrl("#/fight/" + f.id)}`) }, "Share"));
    playBtn.onclick = () => { playing = !playing; playBtn.textContent = playing ? "❚❚ Pause" : "▶ Play"; };
    g.append(el("div", null, cv, ctrls), el("section", { class: "panel" }, el("h3", null, "Blow by blow"), logBox));
    const sparks = [];
    let shake = 0;
    v.appendChild(g);

    const kind = Scenes.locKind(f.place);
    const bg = Scenes.backdrop(kind === "town" ? "plains" : kind, W, H, Art.hash(f.id), { battle: true });
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const o = off.getContext("2d");

    let idx = 0, t = 0, last = performance.now(), frame = 0, frameT = 0;
    let res = [100, 100];
    const floats = [];
    function reset() {
      for (const u of units) { u.hp = u.hp0; u.down = false; u.fled = false; u.dx = 0; u.flash = 0; u.hidden = !!u.hidden && f.lineup.every((x) => x.i !== u.i); u.label = null; }
      res = [100, 100];
      floats.length = 0;
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
        case "miss": floats.push({ x: U(e.t).x, y: U(e.t).y - 30, txt: "miss", col: "#a99cba", life: 1 }); break;
        case "heal": U(e.t).hp = e.hp != null ? e.hp : U(e.t).hp + e.v; floats.push({ x: U(e.t).x, y: U(e.t).y - 30, txt: "+" + e.v, col: "#7ad08a", life: 1 }); break;
        case "down": U(e.t).down = true; shake = Math.max(shake, 0.2); break;
        case "flee": U(e.a).fled = true; break;
        case "summon": if (e.new) units[e.new.i].hidden = false; break;
        case "stunned": floats.push({ x: U(e.a).x, y: U(e.a).y - 32, txt: "zz", col: "#9ab8ff", life: 1 }); break;
        case "act": case "guard": case "buff": case "rally": case "fear": case "debuff": case "stealth":
          if (e.k && e.k !== "Attack") floats.push({ x: U(e.a).x, y: U(e.a).y - 40, txt: e.k, col: e.fx === "fear" ? "#ff8a8a" : e.fx === "rally" ? "#ffd84a" : "#c8b8ff", life: 1.3, label: true });
          if (e.fx === "stealth") U(e.a).ghost = 2;
          break;
      }
    }
    let finishing = false;
    function finishAll() { finishing = true; while (idx < f.log.length) { apply(f.log[idx]); idx++; } t = 0; finishing = false; }

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
      const cur = f.log[idx];
      const order = units.filter((u) => u && !u.hidden).sort((a, b) => a.y - b.y);
      o.fillStyle = "rgba(0,0,0,0.28)";
      for (const u of order) if (!u.fled && !u.down) o.fillRect(Math.round(u.x - 8), Math.round(u.y - 1), 16, 2);
      for (const u of order) {
        if (u.fled) continue;
        let g = unitGrid(u, u.down ? 0 : frame);
        if (u.side === 1 && (u.kind !== "hero")) g = g.flipX();
        if (u.side === 1 && u.kind === "hero") g = g.flipX();
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
          o.translate(u.x, u.y - 3);
          o.rotate((u.side === 0 ? -1 : 1) * Math.PI / 2);
          o.drawImage(img, -g.w / 2, -g.h / 2);
        } else {
          if (u.ghost) o.globalAlpha = 0.5;
          o.drawImage(img, x, y);
        }
        o.restore();
        if (!u.down && u.maxhp) {
          const w = 16, bx = Math.round(u.x - w / 2), by = Math.round(u.y + 1);
          o.fillStyle = "#120c18"; o.fillRect(bx - 1, by, w + 2, 3);
          o.fillStyle = u.side === 0 ? "#7ad08a" : "#e2645c";
          o.fillRect(bx, by + 1, Math.max(0, Math.round((w * u.hp) / u.maxhp)), 1);
        }
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
      for (const s of [0, 1]) {
        const x = s === 0 ? 6 : W - 6 - 80, val = Math.max(0, res[s]);
        o.fillStyle = "rgba(42,27,17,0.85)"; o.fillRect(x - 2, 4, 84, 14);
        o.fillStyle = "#c8963e"; o.fillRect(x - 2, 17, 84, 1);
        o.fillStyle = "#4a3020"; o.fillRect(x, 13, 80, 3);
        o.fillStyle = val > 900 ? "#b0a090" : val < 30 ? "#e2645c" : "#e8b84a";
        o.fillRect(x, 13, Math.round(Math.min(80, (Math.min(val, 160) / 160) * 80)), 3);
      }
      ctx.clearRect(0, 0, cv.width, cv.height);
      const sx = shake > 0 ? Math.round((Math.random() - 0.5) * 6) : 0, sy = shake > 0 ? Math.round((Math.random() - 0.5) * 6) : 0;
      ctx.drawImage(off, sx, sy, cv.width, cv.height);
      const K = cv.width / W;
      const txt = (str, x, y, size, col, align) => {
        ctx.font = `${Math.round(size * K)}px 'Pixelify Sans', monospace`;
        ctx.textAlign = align || "center";
        ctx.fillStyle = "#120c18"; ctx.fillText(str, x * K + 2, y * K + 2);
        ctx.fillStyle = col; ctx.fillText(str, x * K, y * K);
      };
      for (const s of [0, 1]) {
        const x = s === 0 ? 6 : W - 6;
        txt(trunc(label(s), 22), x, 11, 6.5, "#f1e3c2", s === 0 ? "left" : "right");
      }
      for (const fl of floats) {
        ctx.globalAlpha = Math.max(0, Math.min(1, fl.life));
        txt(fl.txt, fl.x, fl.y, fl.label ? 6 : fl.big ? 10 : 8, fl.col);
        ctx.globalAlpha = 1;
      }
      if (cur && ["rout", "surrender"].includes(cur.fx) || idx >= f.log.length) {
        const msg = idx >= f.log.length ? outcomeText(f) : cur.fx === "rout" ? vb(label(cur.side), "breaks!", "break!") : vb(label(cur.side), "surrenders!", "surrender!");
        ctx.fillStyle = "rgba(42,27,17,0.82)"; ctx.fillRect(0, (H / 2 - 12) * K, cv.width, 18 * K);
        ctx.fillStyle = "#c8963e"; ctx.fillRect(0, (H / 2 - 12) * K, cv.width, K); ctx.fillRect(0, (H / 2 + 6) * K - K, cv.width, K);
        txt(trunc(msg, 48), W / 2, H / 2 + 1, 9, "#ffd877");
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
