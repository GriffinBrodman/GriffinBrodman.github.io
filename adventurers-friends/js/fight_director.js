/* Fight-replay director: turns a stored combat log into a timeline of beats with tempo, close-ups, cut-ins and impacts. */
(function () {
  "use strict";
  const FX = () => window.FightFX;
  const realFX = () => !!(window.FightFX && FightFX.FAMILIES && Object.keys(FightFX.FAMILIES).length);

  // seconds of replay time; the director's knobs
  const T = {
    title: 1.4, bossIntro: 1.3, hold: 2.8, cutin: 1.1, glint: 0.32, morale: 1.15, settle: 0.12,
    minorRate: 3, slowRate: 0.4, flagSlowRate: 0.7, mergeMax: 3, killFreeze: 0.55, turnFreeze: 0.42, critFreeze: 0.2,
  };
  const SUPPORT = { guard: "guard", buff: "buff", rally: "buff", fear: "curse", debuff: "curse", parley: "curse", stealth: "buff", summon: "summon" };
  const SHAPE = { rally: "shout", stealth: "vanish", fear: "dread", debuff: "hex", parley: "hex" };

  // ---------- what a skill looks like ----------
  function guess(e, unit, ranged) {
    const k = (e.k || "").toLowerCase();
    const school = /fire|flame|ember|burn|inferno|meteor/.test(k) ? "flame" : /frost|ice|bliz|chill/.test(k) ? "frost" : /lightn|storm|arc |thunder|shock/.test(k) ? "storm"
      : /holy|smite|radiant|light/.test(k) ? "holy" : /shadow|hex|curse|dark/.test(k) ? "shadow" : /poison|venom|toxic/.test(k) ? "poison" : /bone|death|necro/.test(k) ? "death" : null;
    if (SUPPORT[e.fx]) return { family: SUPPORT[e.fx], params: { shape: SHAPE[e.fx] } };
    if (e.fx === "heal") return { family: "heal", params: { school: "healing" } };
    if (e.aoe && (ranged || school)) return { family: "nova", params: { school: school || "arcane" } };
    if (school) return { family: /arc |lightn|chain/.test(k) ? "beam" : "bolt", params: { school, shape: /arc |chain/.test(k) ? "chain" : undefined } };
    if (ranged) return { family: "arrow", params: { shape: e.aoe ? "volley" : "arrow" } };
    if (unit && unit.kind !== "hero") return { family: /bite|maul|fang/.test(k) ? "slash" : "smash", params: { shape: /bite|fang/.test(k) ? "bite" : /claw|rake/.test(k) ? "claw" : "slam" } };
    return { family: e.aoe ? "slash" : /stab|thrust|pierce|lunge/.test(k) ? "thrust" : /smash|crush|hammer|slam|power/.test(k) ? "smash" : "slash", params: { shape: e.aoe ? "wide" : undefined } };
  }
  function skillFx(S, e, unit, heroes) {
    const sf = S.skill_fx || {}, tab = sf.fx || {};
    let key = e.anim;
    if (!key && e.sid && e.sid !== "basic") key = unit && unit.kind !== "hero" && tab["m:" + e.sid] ? "m:" + e.sid : e.sid;
    if (!key && e.sid === "basic") {
      if (unit && unit.kind === "hero") { const h = heroes[unit.ref]; key = h && h.weapon && tab["basic:" + h.weapon] ? "basic:" + h.weapon : e.ranged ? "basic:bow" : "basic:sword"; }
      else if (unit) key = (sf.monster_basic || {})[unit.ref] || "basic:brute";
    }
    const m = key && tab[key];
    if (m) return { family: m.family, params: Object.assign({}, m.params), big: !!m.big, slow: !!m.slow, key };
    return Object.assign({ big: false, slow: false, key: null }, guess(e, unit, e.ranged));
  }

  // ---------- effect timing, from FightFX or a stand-in ----------
  const IMPACT = { slash: 0.3, thrust: 0.3, smash: 0.45, arrow: 0.15, bolt: 0.3, beam: 0.4, nova: 0.45, heal: 0.45, buff: 0.35, summon: 0.8, curse: 0.45, guard: 0.25 };
  function timing(fam, params, from, to) {
    const list = Array.isArray(to) ? to : [to];
    if (realFX()) {
      const t = FightFX.timing(fam, params, from, list.length === 1 ? list[0] : list);
      if (t && t.impacts && t.impacts.length >= list.length) return t;
      if (t) return Object.assign({}, t, { impacts: list.map((_, k) => (t.impacts && t.impacts[k]) || t.impact + k * 0.12) });
    }
    const sp = (params && params.speed) || 1, dist = list.length ? Math.abs(list[0].x - from.x) : 0;
    const fly = fam === "arrow" ? dist / 260 : fam === "bolt" ? dist / 190 : 0;
    const first = (IMPACT[fam] || 0.3) + fly, step = fam === "nova" ? 0.04 : 0.12;
    const impacts = list.map((_, k) => (first + k * step) / sp);
    return { dur: impacts[impacts.length - 1] + 0.4 / sp, impact: impacts[0], impacts, windup: 0.15 / sp, marks: [] };
  }

  // ---------- the log as beats ----------
  function beats(f, units, S, heroes, pos) {
    const out = [];
    let cur = null;
    const alive = units.map((u) => !!u && !u.hidden);
    const add = (b) => { b.ev = b.ev || []; b.hits = b.hits || []; out.push(b); return b; };
    f.log.forEach((e, li) => {
      switch (e.fx) {
        case "start": add({ kind: "start", ev: [li] }); cur = null; break;
        case "end": add({ kind: "end", ev: [li], e }); cur = null; break;
        case "act": cur = add({ kind: "act", a: e.a, e, ev: [li] }); break;
        case "hit": case "crit": case "miss":
          if (!cur || cur.kind !== "act" || cur.a !== e.a) cur = add({ kind: "act", a: e.a, e: { fx: "act", a: e.a, k: "Attack", sid: "basic" }, ev: [] });
          cur.ev.push(li); cur.hits.push(li); break;
        case "heal":
          if (!e.k && cur && cur.kind === "act" && cur.a === e.a) { cur.ev.push(li); cur.hits.push(li); }
          else cur = add({ kind: "act", a: e.a, e, ev: [li], hits: [li] });
          break;
        case "down": if (e.t != null) alive[e.t] = false; // falls through
        case "thorns": case "flee": case "rout": case "surrender":
          if (e.fx === "flee") alive[e.a] = false;
          // the last of a group running for it is a moment of its own, seen wide
          if (e.bolt) { add({ kind: "flee", ev: [li], e }); cur = null; break; }
          if (cur && cur.kind === "act") cur.ev.push(li);
          else add({ kind: e.fx === "down" || e.fx === "thorns" ? "aside" : e.fx, ev: [li], e });
          break;
        case "summon": if (e.new) alive[e.new.i] = true; // falls through
        case "guard": case "buff": case "rally": case "fear": case "debuff": case "parley": case "stealth":
          cur = add({ kind: "act", a: e.a, e, ev: [li], support: e.fx, allies: units.filter((u) => u && u.side === (units[e.a] || {}).side && alive[u.i]).map((u) => u.i),
            foes: units.filter((u) => u && u.side !== (units[e.a] || {}).side && alive[u.i]).map((u) => u.i) });
          cur = null; break;
        case "tick": add({ kind: "tick", a: e.a, e, ev: [li] }); cur = null; break;
        case "stunned": add({ kind: "stun", a: e.a, e, ev: [li] }); cur = null; break;
        case "carry": add({ kind: "carry", a: e.a, e, ev: [li] }); cur = null; break;
        default: add({ kind: "aside", ev: [li], e });
      }
    });
    for (const b of out) {
      if (b.kind !== "act") continue;
      const actor = units[b.a];
      const first = b.e.fx === "act" ? b.e : f.log[b.hits[0]] || b.e;
      const healing = b.hits.length && b.hits.every((li) => f.log[li].fx === "heal");
      b.look = skillFx(S, b.e.fx === "act" && healing && !b.e.sid ? Object.assign({}, b.e, { fx: "heal" }) : b.e, actor, heroes);
      if (healing && !b.e.sid && b.look.family !== "heal") b.look = { family: "heal", params: { school: "healing" }, big: false, slow: false, key: null };
      b.ranged = !!(first.ranged || first.aoe && first.ranged);
      b.aoe = !!b.e.aoe;
      let tgt = b.hits.map((li) => f.log[li].t);
      if (!tgt.length) {
        const e = b.e;
        // a crew buff plays on everyone it buffed; a status nobody fell for still reaches the other side and fizzles there
        const missed = e.fx === "debuff" && e.t != null && ![].concat(e.t).length;
        if (missed) b.whiff = true;
        tgt = missed ? b.foes : (e.fx === "debuff" || e.fx === "parley") && e.t != null ? [].concat(e.t) : e.fx === "fear" ? b.foes : e.fx === "rally" || (e.fx === "buff" || /all/.test(e.st || "")) && !e.own ? b.allies
          : e.fx === "summon" && e.new ? [e.new.i] : [b.a];
      }
      b.to = tgt.filter((i) => units[i]);
      b.from = pos(b.a, b);
      const pts = b.to.map(pos);
      b.time = timing(b.look.family, b.look.params, b.from, pts.length ? (pts.length === 1 ? pts : pts) : [b.from]);
      b.dmg = b.hits.reduce((s, li) => { const e = f.log[li]; return s + (e.fx === "hit" || e.fx === "crit" ? e.v : 0); }, 0);
      b.crit = b.hits.some((li) => f.log[li].fx === "crit");
      b.peak = Math.max(0, ...b.hits.map((li) => { const e = f.log[li]; return e.fx === "miss" ? 0 : e.v / Math.max(1, (units[e.t] || {}).maxhp || 1); }));
    }
    for (const b of out) b.downs = b.ev.filter((li) => f.log[li].fx === "down").map((li) => f.log[li].t);
    return out;
  }

  // ---------- the plan ----------
  function plan(f, units, opts) {
    const S = opts.S || {}, heroes = opts.heroes || {}, pos = opts.pos;
    const bs = beats(f, units, S, heroes, pos);
    const acts = bs.filter((b) => b.kind === "act");
    const loser = f.winner == null ? null : 1 - f.winner;
    let kill = null;
    let killLi = null;
    for (const b of bs) for (const li of b.ev) if (f.log[li].fx === "down" && units[f.log[li].t] && units[f.log[li].t].side === loser) { kill = b; killLi = li; }
    const turn = bs.find((b) => b.kind === "act" && f.log[b.ev[0]] && f.log[b.ev[0]].turn && b !== kill) || null;
    const cutins = bs.filter((b) => b.kind === "act" && f.log[b.ev[0]] && f.log[b.ev[0]].cutin && units[b.a] && units[b.a].kind === "hero");
    // close-ups: the cleanest single-target crits and big hits, a few per fight
    const nClose = Math.max(1, Math.min(3, Math.round(acts.length / 7)));
    const close = acts.filter((b) => !cutins.includes(b) && !b.aoe && new Set(b.to).size === 1 && b.to[0] !== b.a && (b.crit || b.peak >= 0.3))
      .sort((a, b) => (b.crit - a.crit) || (b.peak - a.peak)).slice(0, nClose);
    const slowFlag = acts.filter((b) => b.look.slow && !cutins.includes(b) && b !== kill && b !== turn).slice(0, 3);
    let st = { minorRate: T.minorRate, mergeMax: T.mergeMax, slowFlags: true, close };
    let out = build(f, units, bs, { kill, killLi, turn, cutins, close, slowFlag, boss: units.find((u) => u && u.boss && u.side === 1), mounted: !!opts.mounted }, st);
    // a long fight keeps moving: merge more, run the small stuff faster, drop the gentler slow-downs and close-ups
    if (out.total > 18) out = build(f, units, bs, { kill, killLi, turn, cutins, close: close.slice(0, 2), slowFlag: [], boss: units.find((u) => u && u.boss && u.side === 1), mounted: !!opts.mounted }, { minorRate: 4, mergeMax: 4, beatRate: 1.2 });
    if (out.total > 24) out = build(f, units, bs, { kill, killLi, turn, cutins, close: close.slice(0, 1), slowFlag: [], boss: units.find((u) => u && u.boss && u.side === 1), mounted: !!opts.mounted }, { minorRate: 5, mergeMax: 5, beatRate: 1.4 });
    out.kill = kill; out.turn = turn;
    return out;
  }

  function hitKind(f, units, b, li) {
    const e = f.log[li];
    if (b.downs.length && b.ev.some((x) => x > li && f.log[x].fx === "down" && f.log[x].t === e.t)) return "ko";
    if (e.fx === "crit") return "crit";
    return e.v >= 0.2 * ((units[e.t] || {}).maxhp || 1) ? "heavy" : "hit";
  }

  function build(f, units, bs, sel, st) {
    const slots = [], events = new Array(f.log.length).fill(null), impacts = [], marks = [];
    let t = 0;
    // a mount's own trick (the kelpie's lure, the stag's path) always gets a beat of its own, at the speed it was drawn for
    const signature = (b) => sel.mounted && /^(lure|path)$/.test((b.look && b.look.params && b.look.params.shape) || "");
    const isMinor = (b) => b.kind === "tick" || b.kind === "stun" || b.kind === "aside" ||
      b.kind === "act" && !signature(b) && !b.crit && !b.downs.length && b.peak < 0.22 && !b.look.big && !sel.cutins.includes(b) && !sel.close.includes(b) && b !== sel.kill && b !== sel.turn && !sel.slowFlag.includes(b);
    const at = (li, time) => { if (events[li] == null) events[li] = time; };

    // start: the title card, then a boss steps forward if there is one
    const start = bs.find((b) => b.kind === "start");
    slots.push({ kind: "title", t0: 0, len: T.title, members: [] });
    if (start) at(start.ev[0], 0);
    t = T.title;
    if (sel.boss) { slots.push({ kind: "boss", t0: t, len: T.bossIntro, members: [], who: sel.boss.i }); t += T.bossIntro; }

    let i = 0;
    while (i < bs.length) {
      const b = bs[i];
      if (b.kind === "start") { i++; continue; }
      if (b.kind === "end") { for (const li of b.ev) at(li, t); i++; continue; }
      if (b.kind === "rout" || b.kind === "surrender") {
        slots.push({ kind: "morale", t0: t, len: T.morale, members: [], side: b.e.side });
        for (const li of b.ev) at(li, t + 0.1);
        t += T.morale; i++; continue;
      }
      if (b.kind === "flee" || b.kind === "carry") {
        // a foe talked out of the fight walks off, and the replay gives it time to
        const len = b.e && b.e.walk ? 1.8 : b.e && b.e.bolt ? 1.2 : 0.8;
        slots.push({ kind: "move", t0: t, len, members: [{ b, off: 0, knots: [[0, 0], [len, len]] }] });
        for (const li of b.ev) at(li, t + 0.05);
        t += len; i++; continue;
      }
      if (isMinor(b)) {
        // a run of small trades plays as one beat, everyone at once, fast
        const group = [b], who = new Set([b.a]);
        let j = i + 1;
        while (j < bs.length && group.length < st.mergeMax && isMinor(bs[j]) && !who.has(bs[j].a)) { group.push(bs[j]); who.add(bs[j].a); j++; }
        const r = st.minorRate;
        let len = 0;
        const members = group.map((g, k) => {
          const off = k * 0.09, dur = g.time ? g.time.dur : g.kind === "tick" ? 0.45 : 0.5;
          len = Math.max(len, (dur + off) / r);
          return { b: g, off, knots: [[0, -off], [100, 100 * r - off]] };
        });
        len = Math.max(len, 0.28) + 0.04;
        const slot = { kind: group.length > 1 ? "merge" : "minor", t0: t, len, members, rate: r };
        slots.push(slot);
        for (const m of members) place(f, units, slot, m, at, impacts, marks, sel);
        t += len; i = j; continue;
      }
      // a beat that matters: its own slot, at its own pace
      const slot = { kind: "beat", t0: t, members: [], rate: st.beatRate || 1, pre: 0 };
      if (b === sel.kill) { slot.rate = T.slowRate; slot.kill = true; }
      else if (b === sel.turn) { slot.rate = T.slowRate; slot.turning = true; }
      else if (sel.slowFlag.includes(b)) slot.rate = T.flagSlowRate;
      if (sel.cutins.includes(b)) { slot.cutin = true; slot.pre = T.cutin; }
      else if (sel.close.includes(b)) { slot.close = true; slot.pre = T.glint; }
      const dur = b.time ? b.time.dur : 0.5, r = slot.rate;
      const knots = [[0, 0], [slot.pre, 0]];
      let u = slot.pre, tau = 0;
      const imp = b.time ? b.time.impacts.slice() : [];
      b.hits.forEach((li, k) => {
        const it = imp[k] != null ? imp[k] : imp[imp.length - 1] || 0.3;
        if (it <= tau) return;
        u += (it - tau) / r; tau = it;
        knots.push([u, tau]);
        const kind = f.log[li].fx === "heal" || f.log[li].fx === "miss" ? null : hitKind(f, units, b, li);
        const freeze = !kind ? 0 : slot.kill && kind === "ko" ? T.killFreeze : slot.turning ? T.turnFreeze : slot.close && kind !== "hit" ? T.critFreeze
          : (window.FightFX ? FightFX.hitStop(kind) : 0.08) || 0;
        if (freeze) { u += freeze; knots.push([u, tau]); }
      });
      u += Math.max(0, dur - tau) / r + T.settle;
      knots.push([u, dur + T.settle * r]);
      slot.len = u;
      slot.members.push({ b, off: 0, knots });
      slots.push(slot);
      place(f, units, slot, slot.members[0], at, impacts, marks, sel);
      t += slot.len;
      i++;
    }
    slots.push({ kind: "end", t0: t, len: T.hold, members: [] });
    const endTime = t;
    f.log.forEach((e, li) => { if (events[li] == null) events[li] = e.fx === "end" ? endTime : 0; });
    // log order is the truth; a later event may never be stamped before an earlier one
    for (let k = 1; k < events.length; k++) if (events[k] < events[k - 1] && f.log[k].fx !== "act") events[k] = Math.max(events[k], events[k - 1]);
    return { slots, total: t + T.hold, end: endTime, events, impacts, marks };
  }

  // replay time u at which a member's effect time reaches tau
  function uAt(knots, tau) {
    for (let k = 1; k < knots.length; k++) {
      const [u0, a] = knots[k - 1], [u1, b] = knots[k];
      if (tau <= b && b > a) return u0 + (u1 - u0) * Math.max(0, tau - a) / (b - a);
      if (tau <= b && b === a && tau === b) return u0;
    }
    const [ul, tl] = knots[knots.length - 1], [up, tp] = knots[knots.length - 2] || [0, 0];
    return ul + (tau - tl) * ((ul - up) / Math.max(1e-6, tl - tp) || 1);
  }
  function tauAt(knots, u) {
    if (u <= knots[0][0]) return knots[0][1];
    for (let k = 1; k < knots.length; k++) {
      const [u0, a] = knots[k - 1], [u1, b] = knots[k];
      if (u <= u1) return u1 === u0 ? b : a + (b - a) * (u - u0) / (u1 - u0);
    }
    const [ul, tl] = knots[knots.length - 1];
    return tl + (u - ul);
  }

  function place(f, units, slot, m, at, impacts, marks, sel) {
    const b = m.b, t0 = slot.t0;
    if (b.kind !== "act") {
      const time = t0 + uAt(m.knots, 0.15);
      for (const li of b.ev) at(li, time);
      if (b.kind === "tick") impacts.push({ T: time, li: b.ev[0], t: b.a, kind: "tick", slot });
      return;
    }
    at(b.ev[0], t0 + uAt(m.knots, 0));
    const imp = b.time.impacts;
    let last = t0 + uAt(m.knots, imp[0] || 0.3), k = 0;
    for (const li of b.ev) {
      const e = f.log[li];
      if (e.fx === "hit" || e.fx === "crit" || e.fx === "miss" || e.fx === "heal" && b.hits.includes(li)) {
        const tau = imp[k] != null ? imp[k] : imp[imp.length - 1] || 0.3;
        last = t0 + uAt(m.knots, tau);
        at(li, last);
        impacts.push({ T: last, li, t: e.t, a: b.a, kind: e.fx, k, b, slot, crit: e.fx === "crit", heavy: e.v >= 0.2 * ((units[e.t] || {}).maxhp || 1) });
        k++;
      } else if (e.fx === "down") { at(li, last + 0.03); impacts.push({ T: last + 0.03, li, t: e.t, kind: "down", b, slot, kill: !!slot.kill && li === sel.killLi }); }
      else if (e.fx === "act" || e.fx === "summon") at(li, t0 + uAt(m.knots, 0));
      else if (SUPPORT[e.fx]) at(li, t0 + uAt(m.knots, b.time.impact || 0.3));
      else at(li, last + 0.08);
    }
    for (const mk of b.time.marks || []) marks.push(Object.assign({}, mk, { T: t0 + uAt(m.knots, mk.at || b.time.impact) }));
  }

  window.FightDirector = { plan, tauAt, uAt, skillFx, T };
})();
